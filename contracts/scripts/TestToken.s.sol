pragma solidity ^0.8.28;

import {Script} from 'forge-std/Script.sol';
import {TestToken} from '../src/test/TestToken.sol';

import {console} from 'forge-std/console.sol';

contract DeploymentService is Script {
    uint256 deployer = vm.envUint('PRIVATE_KEY');
    function setUp() public {}

    function run() public {
        vm.startBroadcast(deployer);

        TestToken token = new TestToken();

        console.log('Token @', address(token));
        console.log('Token balance:', token.balanceOf(vm.addr(deployer)));
        vm.stopBroadcast();
    }

    function transfer(address token, address to, uint256 amount) public {
        vm.startBroadcast();
        TestToken(token).transfer(to, amount);
        vm.stopBroadcast();
    }
}
