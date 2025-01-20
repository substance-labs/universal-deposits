pragma solidity ^0.8.28;

import {SafeModule} from '../src/SafeModule.sol';
import {ICreateX, CreateXScript} from 'createx-forge/script/CreateXScript.sol';
import {ERC1967Proxy} from '@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol';
import {ISafe} from '../src/interfaces/ISafe.sol';
import {IModuleManager} from '../src/interfaces/IModuleManager.sol';

import {console} from 'forge-std/console.sol';

interface SafeProxyFactory {
	function createProxyWithNonce(
		address _singleton,
		bytes memory initializer,
		uint256 saltNonce
	) external returns (address);
}

/**
 * Deploys a new UD safe
 */
contract DeploymentService is CreateXScript {
	address legacyAddress = vm.addr(1);
	address owner = 0xf9A9e6288c7A23B2b07f06f668084A1101835fA6;
	address dlnSource = 0xeF4fB24aD0916217251F553c0596F8Edc630EB66;
	address token = 0x2B5757720f361559fe0C499C55eFa65bd6bC6cA3;
	uint256 deployer = vm.envUint('PRIVATE_KEY');

	function getCreate2Address(
		bytes memory bytecode,
		uint256 _salt
	) internal view returns (address) {
		bytes32 hash = keccak256(
			abi.encodePacked(bytes1(0xff), address(this), _salt, keccak256(bytecode))
		);

		// NOTE: cast last 20 bytes of hash to address
		return address(uint160(uint256(hash)));
	}

	function setUp() public withCreateX {}

	function run() public {
		console.log('CreateX', address(CreateX));
		console.log('Deployer @', vm.addr(deployer));

		vm.startBroadcast(deployer);

		// address logicAddress = 0x33484BB3FE7fF72B043B4116A632A5487ad95Dd5;
		SafeModule logicAddress = new SafeModule();
		console.log('Logic address @', address(logicAddress));

		bytes memory initializeData = abi.encodeWithSignature(
			'initialize(address,address,address)',
			owner,
			token,
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

		// address module = 0x09BcAFEAAdE8753130B3a14dd1F6790006565503;
		address module = CreateX.deployCreate2(salt, initCode);

		assert(module == safeModuleAddress);
		assert(SafeModule(safeModuleAddress).owner() == owner);

		// Commitment over the module
		uint256 nonce = uint256(bytes32(keccak256(abi.encodePacked(safeModuleAddress))));
		address safeProxyFactory = 0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67; // arb
		address safeSingleton = 0x41675C099F32341bf84BFc5382aF534df5C7461a; // arb
		address safeToL2SetupContract = 0xBD89A1CE4DDe368FFAB0eC35506eEcE0b1fFdc54; // https://github.com/safe-global/safe-smart-account/blob/main/CHANGELOG.md
		bytes memory safeToL2SetupData = abi.encodeWithSignature(
			'setupToL2(address)',
			0x29fcB43b46531BcA003ddC8FCB67FFE91900C762
		);
		address fallbackHandler = 0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99;
		address paymentReceiver = 0x5afe7A11E7000000000000000000000000000000;

		address[] memory owners = new address[](1);
		owners[0] = owner;

		bytes memory addModuleData = abi.encodeWithSelector(
			IModuleManager.enableModule.selector,
			module
		);

		bytes memory setupData = abi.encodeWithSelector(
			ISafe.setup.selector,
			owners,
			1, // threshold
			safeToL2SetupContract,
			safeToL2SetupData,
			fallbackHandler,
			address(0), // payment token
			0, // payment
			paymentReceiver
		);

		bytes memory safeInitializerData = abi.encodePacked(setupData, addModuleData);

		address safe = SafeProxyFactory(safeProxyFactory).createProxyWithNonce(
			safeSingleton,
			setupData, // safeInitializerData, // setupData,
			nonce
		);

		console.log('Safe @', safe);
	}

	// function settle(address safeModule)
}
