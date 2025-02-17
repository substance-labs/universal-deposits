pragma solidity ^0.8.28;

import {GPv2Order} from './GPv2Order.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {CoWSwapEip712} from './CoWSwapEip712.sol';

interface ICoWSwapSettlement {
    function filledAmount(bytes memory orderUid) external returns (uint256);
    function vaultRelayer() external returns (address);
}

// SPDX-License-Identifier: LGPL-3.0-or-later
pragma solidity ^0.8;

interface ICoWSwapOnchainOrders {
    enum OnchainSigningScheme {
        Eip1271,
        PreSign
    }

    struct OnchainSignature {
        OnchainSigningScheme scheme;
        bytes data;
    }

    event OrderPlacement(
        address indexed sender,
        GPv2Order.Data order,
        OnchainSignature signature,
        bytes data
    );
    event OrderInvalidation(bytes orderUid);
}

/**
 * The CoW contract does this and that...
 */
contract Cow {
    using GPv2Order for GPv2Order.Data;
    using GPv2Order for bytes;

    event OrderPlacement(
        address indexed sender,
        GPv2Order.Data order,
        ICoWSwapOnchainOrders.OnchainSignature signature,
        bytes data
    );

    address cowSwapSettlement = 0x9008D19f58AAbD9eD0D60971565AA8510560ab41;

    function placeOrder() public returns (bytes32) {
        IERC20 EURe = IERC20(0xcB444e90D8198415266c6a2724b7900fb12FC56E);
        IERC20 USDCe = IERC20(0x2a22f9c3b484c3629090FeED35F17Ff8F88f76F0);

        uint16 exrate = 10_000;
        uint256 balance = EURe.balanceOf(msg.sender);
        uint256 buyAmount = (exrate * balance) / 10_000;
        address receiver = 0xCEf67989ae740cC9c92fa7385F003F84EAAFd915;

        EURe.approve(ICoWSwapSettlement(cowSwapSettlement).vaultRelayer(), type(uint256).max);

        GPv2Order.Data memory order = GPv2Order.Data(
            USDCe, // sellToken (IERC20)
            EURe, // buyToken (IERC20)
            receiver, // receiver (address)
            balance, // sellAmount (uint256)
            buyAmount, // buyAmount (uint256)
            1739553453, // validTo (uint32)
            bytes32(0), // appData (bytes32)
            0, // feeAmount (uint256)
            GPv2Order.KIND_SELL, // kind (bytes32)
            false, // partiallyFillable (bool)
            GPv2Order.BALANCE_ERC20, // sellTokenBalance (bytes32)
            GPv2Order.BALANCE_ERC20 // buyTokenBalance (bytes32)
        );

        bytes memory data = abi.encodePacked(gasleft(), order.validTo);
        ICoWSwapOnchainOrders.OnchainSignature memory signature = ICoWSwapOnchainOrders
            .OnchainSignature(
                ICoWSwapOnchainOrders.OnchainSigningScheme.Eip1271,
                abi.encodePacked(address(this))
            );
        bytes32 cowSwapDomainSeparator = CoWSwapEip712.domainSeparator(cowSwapSettlement);

        emit OrderPlacement(msg.sender, order, signature, data);
        return order.hash(cowSwapDomainSeparator);
    }
}
