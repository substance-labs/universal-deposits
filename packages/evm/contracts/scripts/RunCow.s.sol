pragma solidity ^0.8.28;

import {Script, console} from 'forge-std/Script.sol';
import {Cow} from './Cow.sol';

contract RunCow is Script {
    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        Cow cow = new Cow();

        bytes32 hash = cow.placeOrder();

        console.log('hash');
        console.logBytes32(hash);

        vm.stopBroadcast();
    }
}
