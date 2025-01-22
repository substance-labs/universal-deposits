// SPDX-License-Identifier: LGPL-3.0-only
/**
 * Created on 2025-01-17 15:59
 * @summary:
 * @author: mauro
 */
pragma solidity ^0.8.28;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import 'dln-contracts/interfaces/IDlnSource.sol';
import 'dln-contracts/libraries/DlnOrderLib.sol';
import './interfaces/ISafe.sol';
import './interfaces/IModuleManager.sol';

contract SafeModule is OwnableUpgradeable {
    string public constant NAME = 'Allowance Module';
    string public constant VERSION = '0.1.0';

    address public legacySafe;

    address immutable SAFE_MULTISEND = 0x38869bf66a61cF6bDB996A6aE40D5853Fd43B526;
    address immutable DEBRIDGE_DLN_SOURCE = 0xeF4fB24aD0916217251F553c0596F8Edc630EB66;
    uint256 immutable DEBRIDGE_GNOSIS_CHAIN_ID = 100000002;

    address immutable EURe_GNOSIS = 0xcB444e90D8198415266c6a2724b7900fb12FC56E;

    // @dev we allow 4 decimals for the exchange rate
    uint256 immutable EX_RATE_DIVISOR = 10_000;

    uint256 nonce;
    mapping(address => uint256) public rates;
    mapping(address => bool) public autoSettlement;

    function initialize(address _legacySafe) public initializer {
        __Ownable_init(tx.origin); // deployer address
        legacySafe = _legacySafe;
    }

    function toggleAutoSettlement(address token) external onlyOwner {
        autoSettlement[token] = !autoSettlement[token];
    }

    function setExchangeRate(address token, uint256 exchangeRate) external onlyOwner {
        rates[token] = exchangeRate;
    }

    function settle(ISafe safe, address token) external payable {
        if (token == address(0)) {
            // TODO: forwards native asset
        } else {
            uint256 protocolFee = IDlnSource(DEBRIDGE_DLN_SOURCE).globalFixedNativeFee();
            uint256 giveAmount = (IERC20(token).balanceOf(address(safe)) * rates[token]) /
                EX_RATE_DIVISOR;

            uint256 takeAmount = (giveAmount * (10_000 - 8)) / 10_000 - 6;

            bytes memory empty = new bytes(0);
            DlnOrderLib.OrderCreation memory order = DlnOrderLib.OrderCreation(
                token, // giveTokenAddress (address)
                giveAmount, // giveAmount (uint256)
                abi.encodePacked(EURe_GNOSIS), // takeTokenAddress (bytes)
                takeAmount, // takeAmount (uint256)
                DEBRIDGE_GNOSIS_CHAIN_ID, // takeChainId (uint256)
                abi.encodePacked(legacySafe), // receiverDst (bytes)
                address(safe), // givePatchAuthoritySrc (address)
                abi.encodePacked(legacySafe), // orderAuthorityAddressDst (bytes)
                abi.encodePacked(legacySafe), // allowedTakerDst (bytes)
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
                abi.encodePacked(
                    uint8(0),
                    token,
                    uint256(0),
                    approveCalldata.length,
                    approveCalldata
                ),
                abi.encodePacked(
                    uint8(0),
                    DEBRIDGE_DLN_SOURCE,
                    uint256(protocolFee),
                    createOrderCalldata.length,
                    createOrderCalldata
                )
            );

            IModuleManager(safe).execTransactionFromModule(
                SAFE_MULTISEND, // address to,
                0, // uint256 value,
                abi.encodeWithSignature('multiSend(bytes)', txs), // bytes calldata data,
                Enum.Operation.DelegateCall // Enum.Operation operation,
            );
        }
    }
}
