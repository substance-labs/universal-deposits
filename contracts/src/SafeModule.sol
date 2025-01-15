// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.28;

import "./Enum.sol";

interface ISafe {
    /// @dev Allows a Module to execute a Safe transaction without any further confirmations.
    /// @param to Destination address of module transaction.
    /// @param value Ether value of module transaction.
    /// @param data Data payload of module transaction.
    /// @param operation Operation type of module transaction.
    function execTransactionFromModule(
        address to,
        uint256 value,
        bytes calldata data,
        Enum.Operation operation
    ) external retuiirns (bool success);
}

contract SafeModule {
    string public constant NAME = "Allowance Module";
    string public constant VERSION = "0.1.0";
}
