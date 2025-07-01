// SPDX-License-Identifier: LGPL-3.0-only

pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "dln-contracts/interfaces/IDlnSource.sol";
import "dln-contracts/libraries/DlnOrderLib.sol";
import "./interfaces/ISafe.sol";
import "./interfaces/IModuleManager.sol";
import "composable-cow/src/ComposableCoW.sol";
import "composable-cow/src/interfaces/IConditionalOrder.sol";
import "composable-cow/src/BaseConditionalOrder.sol";
import "cowprotocol/contracts/libraries/GPv2Order.sol";
import "cowprotocol/contracts/GPv2Settlement.sol";
import "cowprotocol/contracts/GPv2VaultRelayer.sol";
import "safe/handler/extensible/SignatureVerifierMuxer.sol";

interface TokenWithDecimals {
    function decimals() external view returns (uint256);
}

contract SafeModule is OwnableUpgradeable, UUPSUpgradeable, BaseConditionalOrder {
    error OrderFailed(string);
    error AutoSettlementDisabled();

    string public constant NAME = "Universal Deposits Module";
    string public constant VERSION = "0.1.3";

    address internal constant COW_COMPOSABLE = 0xfdaFc9d1902f4e0b84f65F49f244b32b31013b74;
    address payable internal constant COW_SETTLEMENT = payable(0x9008D19f58AAbD9eD0D60971565AA8510560ab41);
    address internal constant SAFE_MULTISEND = 0x38869bf66a61cF6bDB996A6aE40D5853Fd43B526;
    address internal constant DEBRIDGE_DLN_SOURCE = 0xeF4fB24aD0916217251F553c0596F8Edc630EB66;
    uint256 internal constant EX_RATE_DIVISOR = 10_000;

    address public destinationAddress;
    address public destinationToken;
    uint256 public destinationChain;
    uint256 nonce;

    // @dev we allow 4 decimals for the exchange rate
    mapping(address => uint256) public rates;
    mapping(address => bool) public autoSettlement;
    mapping(uint256 => uint256) public settlementChainIds;
    mapping(uint256 => GPv2Order.Data) orders;

    event PrintOrder(GPv2Order.Data order);

    struct TxData {
        address to;
        uint256 value;
        bytes data;
    }

    function initialize(address _destinationAddress, address _destinationToken, uint256 _destinationChain)
        public
        initializer
    {
        __Ownable_init(tx.origin); // deployer address
        destinationAddress = _destinationAddress;
        destinationToken = _destinationToken;
        destinationChain = _destinationChain;
    }

    function toggleAutoSettlement(address token) external onlyOwner {
        autoSettlement[token] = !autoSettlement[token];
    }

    function setExchangeRate(address token, uint256 exchangeRate) external onlyOwner {
        rates[token] = exchangeRate;
    }

    function setSettlementChainIds(uint256 actualChainId, uint256 settlementChainId) public onlyOwner {
        settlementChainIds[actualChainId] = settlementChainId;
    }

    function setDomain(address safe) public {
        bytes memory data = abi.encodeWithSelector(
            ISignatureVerifierMuxer.setDomainVerifier.selector,
            GPv2Settlement(COW_SETTLEMENT).domainSeparator(),
            COW_COMPOSABLE
        );

        IModuleManager(safe).execTransactionFromModule(
            safe, // address to,
            0, // uint256 value,
            data,
            Enum.Operation.Call // Enum.Operation operation,
        );
    }

    // TODO: replace COW order with offchain quote and onchain calldata
    function getTradeableOrder(
        address owner,
        address sender,
        bytes32 ctx,
        bytes calldata staticInput,
        bytes calldata offchainInput
    ) public view override returns (GPv2Order.Data memory) {
        GPv2Order.Data memory order = abi.decode(staticInput, (GPv2Order.Data));

        if (!autoSettlement[address(order.sellToken)]) {
            revert IConditionalOrder.OrderNotValid("autoSettlement is disabled");
        }
        if (address(order.buyToken) != destinationToken) {
            revert IConditionalOrder.OrderNotValid("invalid buyToken");
        }
        if (order.receiver != destinationAddress) {
            revert IConditionalOrder.OrderNotValid("invalid receiver");
        }

        if (!(block.timestamp <= order.validTo)) {
            revert IConditionalOrder.OrderNotValid("order expired");
        }

        uint256 balance = IERC20(order.sellToken).balanceOf(owner); // checking the safe's balance

        if (balance != order.sellAmount) revert IConditionalOrder.OrderNotValid("invalid amount");

        uint256 expectedBuyAmount = (rates[address(order.sellToken)] * balance) / EX_RATE_DIVISOR;
        if (order.buyAmount != expectedBuyAmount) {
            revert IConditionalOrder.OrderNotValid("invalid buyAmount");
        }

        return order;
    }
    

    /// @dev allow arbitrary encodedTxData to be executed
    function settleWithData(address safe, address token, bytes memory encodedTxData) external payable onlyOwner {
        if (token == destinationToken && destinationChain == block.chainid) {
            _performTransfer(safe, token);
        } else if (token != destinationToken && destinationChain == block.chainid) {
            _placeCoWOrder(safe, token);
        } else {
            // decode the bytes memory transactionData
            (address to, uint256 value, bytes memory callData) = abi.decode(encodedTxData, (address, uint256, bytes));

            uint256 tokenBalance = IERC20(token).balanceOf(safe);
            uint256 giveAmount = tokenBalance;
            bytes memory approveCalldata = abi.encodeWithSignature("approve(address,uint256)", to, giveAmount);

            bytes memory txs = bytes.concat(
                // in multisend, the first bytes is operation: 0 call / 1 delegatecall
                abi.encodePacked(uint8(0), token, uint256(0), approveCalldata.length, approveCalldata),
                abi.encodePacked(uint8(0), to, uint256(0), callData.length, callData)
            );

            // function multiSend(bytes memory transactions)
            // @param transactions Encoded transactions. Each transaction is encoded as a
            //                     tuple(operation,address,uint256,bytes), where operation
            //                     can be 0 for a call or 1 for a delegatecall. The bytes
            //                    of all encoded transactions are concatenated to form the input.

            //    enum Operation {
            //     Call, // 0
            //     DelegateCall  // 1
            // }

            bool success = IModuleManager(safe).execTransactionFromModule(
                SAFE_MULTISEND, // address to,
                0, // uint256 value,
                abi.encodeWithSignature("multiSend(bytes)", txs), // bytes calldata data,
                Enum.Operation.DelegateCall // Enum.Operation operation = 1
            );

            require(success, "Unsuccessful execTransactionFromModule call");
        }
    }
    
    function settle(address safe, address token) external payable {
        require(token != address(0), "Native currency not supported");

        if (!autoSettlement[token]) revert AutoSettlementDisabled();

        if (token == destinationToken && destinationChain == block.chainid) {
            _performTransfer(safe, token);
        } else if (token != destinationToken && destinationChain == block.chainid) {
            _placeCoWOrder(safe, token);
        } else {
            _placeDeBridgeOrder(safe, token);
        }
    }

    function _performTransfer(address safe, address token) internal {
        uint256 tokenBalance = IERC20(token).balanceOf(safe);
        bytes memory transferCalldata =
            abi.encodeWithSignature("transfer(address,uint256)", destinationAddress, tokenBalance);

        bytes memory txs =
            bytes.concat(abi.encodePacked(uint8(0), token, uint256(0), transferCalldata.length, transferCalldata));

        bool success = IModuleManager(safe).execTransactionFromModule(
            SAFE_MULTISEND, // address to,
            0, // uint256 value,
            abi.encodeWithSignature("multiSend(bytes)", txs), // bytes calldata data,
            Enum.Operation.DelegateCall // Enum.Operation operation,
        );

        if (!success) {
            revert OrderFailed("Failed to transfer the token");
        }
    }

    function _placeDeBridgeOrder(address safe, address token) internal {
        require(settlementChainIds[destinationChain] != 0, "Settlement chain id not set");
        uint256 tokenDecimals = _getTokenDecimals(token);
        uint256 protocolFee = IDlnSource(DEBRIDGE_DLN_SOURCE).globalFixedNativeFee();
        uint256 tokenBalance = IERC20(token).balanceOf(safe);
        uint256 giveAmount = tokenBalance;
        uint256 bps = 10_000 - 8;
        uint256 takeAmount = ((tokenBalance * rates[token] * bps) / (EX_RATE_DIVISOR * EX_RATE_DIVISOR)) - 6; // see deBridge doc
        takeAmount *= (10 ** (18 - tokenDecimals));

        bytes memory empty = new bytes(0);

        DlnOrderLib.OrderCreation memory order = DlnOrderLib.OrderCreation(
            token, // giveTokenAddress (address)
            giveAmount, // giveAmount (uint256)
            abi.encodePacked(destinationToken), // takeTokenAddress (bytes)
            takeAmount, // takeAmount (uint256)
            settlementChainIds[destinationChain], // takeChainId (uint256)
            abi.encodePacked(destinationAddress), // receiverDst (bytes)
            safe, // givePatchAuthoritySrc (address)
            abi.encodePacked(destinationAddress), // orderAuthorityAddressDst (bytes)
            abi.encodePacked(address(0x555CE236C0220695b68341bc48C68d52210cC35b)), // allowedTakerDst (bytes)
            empty, // externalCall (bytes)
            empty // allowedCancelBeneficiarySrc (bytes)
        );

        bytes memory approveCalldata =
            abi.encodeWithSignature("approve(address,uint256)", DEBRIDGE_DLN_SOURCE, giveAmount);
        uint64 salt = uint64(nonce++);
        bytes memory createOrderCalldata =
            abi.encodeWithSelector(IDlnSource.createSaltedOrder.selector, order, salt, empty, 0, empty, empty);
        bytes memory txs = bytes.concat(
            abi.encodePacked(uint8(0), token, uint256(0), approveCalldata.length, approveCalldata),
            abi.encodePacked(
                uint8(0), DEBRIDGE_DLN_SOURCE, uint256(protocolFee), createOrderCalldata.length, createOrderCalldata
            )
        );

        // Check re-entrancy
        (bool success,) = safe.call{value: protocolFee}("");

        if (!success) {
            revert("Failed to send ETH to safe");
        }

        success = IModuleManager(safe).execTransactionFromModule(
            SAFE_MULTISEND, // address to,
            0, // uint256 value,
            abi.encodeWithSignature("multiSend(bytes)", txs), // bytes calldata data,
            Enum.Operation.DelegateCall // Enum.Operation operation,
        );

        if (!success) {
            revert OrderFailed("Failed to transfer the token");
        }
    }

    function _placeCoWOrder(address safe, address token) internal {
        uint256 balance = IERC20(token).balanceOf(safe);

        GPv2Order.Data memory orderData = GPv2Order.Data(
            IERC20(token), // sellToken (IERC20)
            IERC20(destinationToken), // buyToken (IERC20)
            destinationAddress, // receiver (address)
            balance, // sellAmount (uint256)
            (rates[token] * balance) / EX_RATE_DIVISOR, // buyAmount (uint256)
            uint32(block.timestamp + 3600), // validTo (uint32)
            bytes32(0), // appData (bytes32)
            0, // feeAmount (uint256)
            GPv2Order.KIND_SELL, // kind (bytes32)
            false, // partiallyFillable (bool)
            GPv2Order.BALANCE_ERC20, // sellTokenBalance (bytes32)
            GPv2Order.BALANCE_ERC20 // buyTokenBalance (bytes32)
        );

        IConditionalOrder.ConditionalOrderParams memory params = IConditionalOrder.ConditionalOrderParams({
            handler: this,
            salt: keccak256(abi.encode(bytes32(nonce))),
            staticInput: abi.encode(orderData)
        });

        GPv2VaultRelayer vaultRelayer = GPv2Settlement(COW_SETTLEMENT).vaultRelayer();

        bytes memory approveCalldata = abi.encodeWithSignature("approve(address,uint256)", vaultRelayer, balance);

        bytes memory createCalldata = abi.encodeWithSelector(ComposableCoW.create.selector, params, true);

        bytes memory txs = bytes.concat(
            abi.encodePacked(uint8(0), token, uint256(0), approveCalldata.length, approveCalldata),
            abi.encodePacked(uint8(0), COW_COMPOSABLE, uint256(0), createCalldata.length, createCalldata)
        );

        bool success = IModuleManager(safe).execTransactionFromModule(
            SAFE_MULTISEND, // address to,
            0, // uint256 value,
            abi.encodeWithSignature("multiSend(bytes)", txs), // bytes calldata data,
            Enum.Operation.DelegateCall // Enum.Operation operation,
        );

        if (!success) {
            revert OrderFailed("Failed to transfer the token");
        }

        emit PrintOrder(orderData);
    }

    function _getTokenDecimals(address token) internal view returns (uint256) {
        try TokenWithDecimals(token).decimals() returns (uint256 decimals) {
            return decimals;
        } catch {}

        return 18;
    }

    function _authorizeUpgrade(address newImplementation) internal override {}
}
