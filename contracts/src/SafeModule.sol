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
import './Enum.sol';

interface ISafe {
    function execTransactionFromModule(
        address to,
        uint256 value,
        bytes calldata data,
        Enum.Operation operation
    ) external returns (bool success);
}
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

    address public deBridgeDlnSource;

    uint256 nonce;
    mapping(address => uint256) public rates;
    mapping(address => bool) public autoSettlement;

    /**
     * Initialize the contract
     * @param _owner The owner of this contract
     * @param _autoSettlementToken the first token that will have autoSettlement activated
     * @param _deBridgeDlnSource deBridge DLN source contract to create orders
     */
    function initialize(
        address _owner,
        address _autoSettlementToken,
        address _deBridgeDlnSource
    ) public initializer {
        __Ownable_init(_owner);
        deBridgeDlnSource = _deBridgeDlnSource;
        autoSettlement[_autoSettlementToken] = true;
    }

    function toggleAutoSettlement(address token) public onlyOwner {
        autoSettlement[token] = !autoSettlement[token];
    }

    function setExchangeRate(address token, uint256 exchangeRate) public onlyOwner {
        rates[token] = exchangeRate;
    }

    function settle(ISafe safe, address token) public {
        if (token == address(0)) {
            // TODO: forwards native asset
        } else {
            uint256 protocolFee = IDlnSource(deBridgeDlnSource).globalFixedNativeFee();
            uint256 giveAmount = IERC20(token).balanceOf(address(this));

            uint256 takeAmount = (giveAmount * (10_000 - 8)) / 10_000 - 6;
            uint8 gnosisChainId = 100;
            // USDT(arbitrum) 0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9
            // USDT(gnosis)   0x4ecaba5870353805a9f068101a40e0f32ed605c6

            address usdtGnosis = 0x4ECaBa5870353805a9F068101A40E0f32ed605C6;
            address _owner = owner();
            // owner is relative to the secondary safe
            DlnOrderLib.OrderCreation memory order = DlnOrderLib.OrderCreation(
                token, // giveTokenAddress (address)
                giveAmount, // giveAmount (uint256)
                abi.encodePacked(usdtGnosis), // takeTokenAddress (bytes)
                takeAmount, // takeAmount (uint256)
                gnosisChainId, // takeChainId (uint256)
                abi.encodePacked(_owner), // receiverDst (bytes)
                _owner, // givePatchAuthoritySrc (address)
                abi.encodePacked(_owner), // orderAuthorityAddressDst (bytes)
                '0x', // allowedTakerDst (bytes)
                '0x', // externalCall (bytes)
                '0x' // allowedCancelBeneficiarySrc (bytes)
            );
            IERC20(token).approve(deBridgeDlnSource, giveAmount);
            uint64 salt = uint64(nonce++ + gasleft());
            IDlnSource(deBridgeDlnSource).createSaltedOrder{value: protocolFee}(
                order,
                salt,
                '0x',
                0,
                '0x',
                '0x'
            );
        }
    }
}
