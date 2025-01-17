pragma solidity ^0.8.28;

import {SafeModule} from '../src/SafeModule.sol';
import {TestToken} from '../src/test/TestToken.sol';
import {ICreateX, CreateXScript} from 'createx-forge/script/CreateXScript.sol';
import {ERC1967Proxy} from '@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol';

import {console} from 'forge-std/console.sol';

/**
 * Deploys a new UD safe
 */
contract DeploymentService is CreateXScript {
	address legacyAddress = vm.addr(1);
	address owner = 0xf9A9e6288c7A23B2b07f06f668084A1101835fA6;
	address dlnSource = 0xeF4fB24aD0916217251F553c0596F8Edc630EB66;

	function setUp() public withCreateX {}

	function run() public {
		address deployer = msg.sender;

		console.log('CreateX', address(CreateX));
		console.log('Deployer @', deployer);

		vm.startBroadcast();

		TestToken token = new TestToken();
		SafeModule logicAddress = new SafeModule();
		console.log('Logic address @', address(logicAddress));

		bytes memory initializeData = abi.encodeWithSignature(
			'initialize(address,address,address)',
			owner,
			address(token),
			dlnSource
		);

		bytes memory initCode = abi.encodePacked(
			type(ERC1967Proxy).creationCode,
			abi.encode(address(logicAddress), initializeData)
		);

		bytes32 salt = bytes32(bytes.concat(abi.encodePacked(legacyAddress), bytes1(0x00)));
		address safeModuleAddress = CreateX.computeCreate2Address(
			keccak256(abi.encode(salt)), // as per CreateX._guardedSalt()
			keccak256(initCode)
		);

		console.log('Expected SafeModule address', safeModuleAddress);

		// ICreateX.Values memory values = ICreateX.Values(0.01 ether, 0.01 ether);
		// address module = CreateX.deployCreate2AndInit{value: 0.03 ether}(
		// 	salt,
		// 	bytecode,
		// 	constructorData,
		// 	values,
		// 	msg.sender
		// );

		address module = CreateX.deployCreate2(salt, initCode);

		assert(module == safeModuleAddress);
		assert(SafeModule(safeModuleAddress).owner() == owner);
	}
}
