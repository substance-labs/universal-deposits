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

// struct OrderCreation {
//     /// Address of the ERC-20 token that the maker is offering as part of this order.
//     /// Use the zero address to indicate that the maker is offering a native blockchain token (such as Ether, Matic, etc.).
//     address giveTokenAddress;
//     /// Amount of tokens the maker is offering.
//     uint256 giveAmount;
//     /// Address of the ERC-20 token that the maker is willing to accept on the destination chain.
//     bytes takeTokenAddress;
//     /// Amount of tokens the maker is willing to accept on the destination chain.
//     uint256 takeAmount;
//     // the ID of the chain where an order should be fulfilled.
//     uint256 takeChainId;
//     /// Address on the destination chain where funds should be sent upon order fulfillment.
//     bytes receiverDst;
//     /// Address on the source (current) chain authorized to patch the order by adding more input tokens, making it more attractive to takers.
//     address givePatchAuthoritySrc;
//     /// Address on the destination chain authorized to patch the order by reducing the take amount, making it more attractive to takers,
//     /// and can also cancel the order in the take chain.
//     bytes orderAuthorityAddressDst;
//     // An optional address restricting anyone in the open market from fulfilling
//     // this order but the given address. This can be useful if you are creating a order
//     // for a specific taker. By default, set to empty bytes array (0x)
//     bytes allowedTakerDst;
//     /// An optional external call data payload.
//     bytes externalCall;
//     // An optional address on the source (current) chain where the given input tokens
//     // would be transferred to in case order cancellation is initiated by the orderAuthorityAddressDst
//     // on the destination chain. This property can be safely set to an empty bytes array (0x):
//     // in this case, tokens would be transferred to the arbitrary address specified
//     // by the orderAuthorityAddressDst upon order cancellation
//     bytes allowedCancelBeneficiarySrc;
// }

contract SafeModule is OwnableUpgradeable {
    string public constant NAME = 'Allowance Module';
    string public constant VERSION = '0.1.0';

    address public legacySafe;
    address public deBridgeDlnSource;

    address immutable usdtArbitrum = 0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9;
    address immutable usdtGnosis = 0x4ECaBa5870353805a9F068101A40E0f32ed605C6;

    uint256 nonce;
    mapping(address => uint256) public rates;
    mapping(address => bool) public autoSettlement;

    function initialize(
        address _legacySafe,
        address _autoSettlementToken,
        address _deBridgeDlnSource
    ) public initializer {
        __Ownable_init(tx.origin);
        legacySafe = _legacySafe;
        deBridgeDlnSource = _deBridgeDlnSource;
        autoSettlement[_autoSettlementToken] = true;

        // if _autoSettlementToken.balance > 0 => call settle
    }

    function toggleAutoSettlement(address token) public onlyOwner {
        autoSettlement[token] = !autoSettlement[token];
    }

    function setExchangeRate(address token, uint256 exchangeRate) public onlyOwner {
        rates[token] = exchangeRate;
    }

    function settle(ISafe safe, address token) public payable {
        if (token == address(0)) {
            // TODO: forwards native asset
        } else {
            uint256 protocolFee = IDlnSource(deBridgeDlnSource).globalFixedNativeFee();
            uint256 giveAmount = IERC20(usdtArbitrum).balanceOf(address(safe));

            uint256 takeAmount = (giveAmount * (10_000 - 8)) / 10_000 - 6;
            uint256 gnosisChainId = 100000002;

            // bytes memory empty = new bytes(0);
            // DlnOrderLib.OrderCreation memory order = DlnOrderLib.OrderCreation(
            //     usdtArbitrum, // giveTokenAddress (address)
            //     giveAmount, // giveAmount (uint256)
            //     abi.encodePacked(usdtGnosis), // takeTokenAddress (bytes)
            //     takeAmount, // takeAmount (uint256)
            //     gnosisChainId, // takeChainId (uint256)
            //     abi.encodePacked(legacySafe), // receiverDst (bytes)
            //     address(safe), // givePatchAuthoritySrc (address)
            //     abi.encodePacked(legacySafe), // orderAuthorityAddressDst (bytes)
            //     abi.encodePacked(address(0x555CE236C0220695b68341bc48C68d52210cC35b)), // allowedTakerDst (bytes)
            //     empty, // externalCall (bytes)
            //     empty // allowedCancelBeneficiarySrc (bytes)
            // );

            // IModuleManager(safe).execTransactionFromModule(
            //     token, // address to,
            //     0, // uint256 value,
            //     abi.encodeWithSignature('approve(address,uint256)', deBridgeDlnSource, giveAmount), // bytes calldata data,
            //     Enum.Operation.Call // Enum.Operation operation,
            // );

            // IDlnSource(deBridgeDlnSource).createSaltedOrder{value: protocolFee}(
            //     order,
            //     salt,
            //     empty,
            //     0,
            //     empty,
            //     empty
            // );

            // address multisendContract = 0x38869bf66a61cF6bDB996A6aE40D5853Fd43B526;

            // bytes memory approveCalldata = abi.encodeWithSignature(
            //     'approve(address,uint256)',
            //     deBridgeDlnSource,
            //     giveAmount
            // );
            // uint64 salt = uint64(nonce++ + gasleft());
            // bytes memory createOrderCalldata = abi.encodeWithSelector(
            //     IDlnSource.createSaltedOrder.selector,
            //     order,
            //     salt,
            //     empty,
            //     0,
            //     empty,
            //     empty
            // );
            // bytes memory txs = bytes.concat(
            //     abi.encodePacked(
            //         uint8(0),
            //         token,
            //         uint256(0),
            //         approveCalldata.length,
            //         approveCalldata
            //     ),
            //     abi.encodePacked(
            //         uint8(0),
            //         deBridgeDlnSource,
            //         uint256(protocolFee),
            //         createOrderCalldata.length,
            //         createOrderCalldata
            //     )
            // );

            // IModuleManager(safe).execTransactionFromModule(
            //     multisendContract, // address to,
            //     0, // uint256 value,
            //     abi.encodeWithSignature('multiSend(bytes)', txs), // bytes calldata data,
            //     Enum.Operation.DelegateCall // Enum.Operation operation,
            // );
        }
    }
}
