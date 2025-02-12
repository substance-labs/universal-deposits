// SPDX-License-Identifier: LGPL-3.0-only

pragma solidity ^0.8.28;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import 'dln-contracts/interfaces/IDlnSource.sol';
import 'dln-contracts/libraries/DlnOrderLib.sol';
import './interfaces/ISafe.sol';
import './interfaces/IModuleManager.sol';

interface TokenWithDecimals {
    function decimals() external view returns (uint256);
}

contract SafeModule is OwnableUpgradeable, UUPSUpgradeable {
    error AutoSettlementDisabled();
    string public constant NAME = 'Universal Deposits Module';
    string public constant VERSION = '0.1.1';

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

    function initialize(
        address _destinationAddress,
        address _destinationToken,
        uint256 _destinationChain
    ) public initializer {
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

    function setSettlementChainIds(
        uint256 actualChainId,
        uint256 settlementChainId
    ) public onlyOwner {
        settlementChainIds[actualChainId] = settlementChainId;
    }

    function _placeDeBridgeOrder(address safe, address token) internal {
        require(settlementChainIds[destinationChain] != 0, 'Settlement chain id not set');
        uint256 tokenDecimals = _getTokenDecimals(token);
        uint256 protocolFee = IDlnSource(DEBRIDGE_DLN_SOURCE).globalFixedNativeFee();
        uint256 tokenBalance = IERC20(token).balanceOf(safe);
        uint256 giveAmount = tokenBalance;
        uint256 bps = 10_000 - 8;
        uint256 takeAmount = ((tokenBalance * rates[token] * bps) /
            (EX_RATE_DIVISOR * EX_RATE_DIVISOR)) - 6; // see deBridge doc
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

        bytes memory approveCalldata = abi.encodeWithSignature(
            'approve(address,uint256)',
            DEBRIDGE_DLN_SOURCE,
            giveAmount
        );
        uint64 salt = uint64(nonce++ + gasleft());
        bytes memory createOrderCalldata = abi.encodeWithSelector(
            IDlnSource.createSaltedOrder.selector,
            order,
            salt,
            empty,
            0,
            empty,
            empty
        );
        bytes memory txs = bytes.concat(
            abi.encodePacked(uint8(0), token, uint256(0), approveCalldata.length, approveCalldata),
            abi.encodePacked(
                uint8(0),
                DEBRIDGE_DLN_SOURCE,
                uint256(protocolFee),
                createOrderCalldata.length,
                createOrderCalldata
            )
        );

        // Check re-entrancy
        (bool success, ) = safe.call{value: protocolFee}('');

        if (!success) {
            revert('Failed to send ETH to safe');
        }

        IModuleManager(safe).execTransactionFromModule(
            SAFE_MULTISEND, // address to,
            0, // uint256 value,
            abi.encodeWithSignature('multiSend(bytes)', txs), // bytes calldata data,
            Enum.Operation.DelegateCall // Enum.Operation operation,
        );
    }

    function settle(address safe, address token) external payable {
        require(token != address(0), 'Native currency not supported');

        if (!autoSettlement[token]) revert AutoSettlementDisabled();

        if (token == destinationToken && destinationChain == block.chainid) {
            uint256 tokenBalance = IERC20(token).balanceOf(safe);
            bytes memory transferCalldata = abi.encodeWithSignature(
                'transfer(address,uint256)',
                destinationAddress,
                tokenBalance
            );

            bytes memory txs = bytes.concat(
                abi.encodePacked(
                    uint8(0),
                    token,
                    uint256(0),
                    transferCalldata.length,
                    transferCalldata
                )
            );

            IModuleManager(safe).execTransactionFromModule(
                SAFE_MULTISEND, // address to,
                0, // uint256 value,
                abi.encodeWithSignature('multiSend(bytes)', txs), // bytes calldata data,
                Enum.Operation.DelegateCall // Enum.Operation operation,
            );
        } else {
            _placeDeBridgeOrder(safe, token);
        }
    }

    function _getTokenDecimals(address token) internal view returns (uint256) {
        try TokenWithDecimals(token).decimals() returns (uint256 decimals) {
            return decimals;
        } catch {}

        return 18;
    }

    function _authorizeUpgrade(address newImplementation) internal override {}
}
