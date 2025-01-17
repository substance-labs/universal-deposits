pragma solidity ^0.8.28;

import {SafeModule} from '../src/SafeModule.sol';
import {CreateXScript} from 'createx-forge/script/CreateXScript.sol';

import {console} from 'forge-std/console.sol';
/**
 * Deploys a new UD safe
 */
contract DeploymentService is CreateXScript {
	address legacyAddress = vm.addr(1);

	function setUp() public withCreateX {}

	function run() public {
		// vm.startBroadcast();
		address deployer = msg.sender;
		bytes memory bytecode = type(SafeModule).creationCode;
		bytes32 byteCodeDigest = keccak256(bytecode);

		bytes32 salt = bytes32(abi.encodePacked(legacyAddress));
		address safeModuleAddress = computeCreate2Address(salt, byteCodeDigest);

		console.log('Deployer:', deployer);
		console.log('Expected SafeModule address', safeModuleAddress);

		// SafeModule module = new SafeModule();

		// // Calculate the predetermined address of the Counter contract deployment
		// address computedAddress = computeCreate2Address(salt, deployer);

		// console.log('Proxy computed contract address:', computedAddress);

		// bytes memory initializeData = abi.encodeWithSignature(
		// 	'initailize(address,address,address)'
		// );
	}
}
