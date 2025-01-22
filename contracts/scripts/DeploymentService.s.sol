pragma solidity ^0.8.28;

import {SafeModule} from '../src/SafeModule.sol';
import {ICreateX, CreateXScript} from 'createx-forge/script/CreateXScript.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {ERC1967Proxy} from '@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol';
import {ERC1967Utils} from '@openzeppelin/contracts/proxy/ERC1967/ERC1967Utils.sol';
import {ISafe} from '../src/interfaces/ISafe.sol';
import {IModuleManager} from '../src/interfaces/IModuleManager.sol';
import {Enum} from '../src/interfaces/Enum.sol';
import {SafeProxy} from '@safe-global/safe-contracts/contracts/proxies/SafeProxy.sol';
import {SafeProxyFactory} from '@safe-global/safe-contracts/contracts/proxies/SafeProxyFactory.sol';

import {StdCheats} from 'forge-std/StdCheats.sol';
import {console} from 'forge-std/console.sol';
import {stdStorage, StdStorage} from 'forge-std/Test.sol';

/**
 * Deploys a new UD safe
 */
contract DeploymentService is CreateXScript, StdCheats {
	using stdStorage for StdStorage;

	address immutable ADDRESS_USDC_ARBITRUM = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;
	address immutable ADDRESS_SAFE_PROXY_FACTORY = 0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67;
	address immutable ADDRESS_SAFE_SINGLETON = 0x41675C099F32341bf84BFc5382aF534df5C7461a;
	address immutable SAFE_FALLBACK_HANDLER = 0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99;
	address immutable SAFE_PAYMENT_RECEIVER = 0x5afe7A11E7000000000000000000000000000000;
	address immutable SAFE_MODULE_SETUP = 0x8EcD4ec46D4D2a6B64fE960B3D64e8B94B2234eb;

	string SAFEMODULE_SALT = 'universal-deposits';

	bytes1 immutable CREATEX_REDEPLOY_PROTECTION_FLAG = bytes1(0x00);

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

	function _getSafeModuleLogicParameters()
		internal
		view
		returns (bytes32 salt, bytes memory initCode, address expected)
	{
		bytes memory saltBytes = bytes.concat(
			abi.encodePacked(SAFEMODULE_SALT),
			CREATEX_REDEPLOY_PROTECTION_FLAG
		);

		salt = bytes32(saltBytes);

		initCode = abi.encodePacked(type(SafeModule).creationCode);

		expected = CreateX.computeCreate2Address(keccak256(abi.encode(salt)), keccak256(initCode));
	}

	function _getSafeModuleProxyParameters(
		address _legacyAddress
	) internal view returns (bytes32 salt, bytes memory initCode, address expected) {
		(, , address safeModuleLogic) = _getSafeModuleLogicParameters();

		bytes memory safeModuleLogicInitializeData = abi.encodeWithSignature(
			'initialize(address)',
			_legacyAddress
		);

		salt = bytes32(
			bytes.concat(abi.encodePacked(_legacyAddress), CREATEX_REDEPLOY_PROTECTION_FLAG)
		);

		initCode = abi.encodePacked(
			type(ERC1967Proxy).creationCode,
			abi.encode(safeModuleLogic, safeModuleLogicInitializeData)
		);

		expected = CreateX.computeCreate2Address(keccak256(abi.encode(salt)), keccak256(initCode));
	}

	function toggleAutoSettlement(address _legacyAddress, address _token) public {
		vm.startBroadcast(deployer);
		(, , address proxy) = _getSafeModuleProxyParameters(_legacyAddress);

		SafeModule(proxy).toggleAutoSettlement(_token);

		vm.stopBroadcast();
	}

	function setExchangeRate(address _legacyAddress, address _token, uint256 _rate) public {
		vm.startBroadcast(deployer);
		(, , address proxy) = _getSafeModuleProxyParameters(_legacyAddress);

		SafeModule(proxy).setExchangeRate(_token, _rate);

		vm.stopBroadcast();
	}

	function deploySafeModuleLogic() public {
		vm.startBroadcast(deployer);
		(bytes32 salt, bytes memory initCode, address expected) = _getSafeModuleLogicParameters();

		address safeModuleLogic = CreateX.deployCreate2(salt, initCode);

		assert(safeModuleLogic == expected);

		console.log('Logic address @', safeModuleLogic);

		vm.stopBroadcast();
	}

	function deploySafeModuleProxy(address _legacyAddress) public {
		vm.startBroadcast(deployer);
		(bytes32 salt, bytes memory initCode, address expected) = _getSafeModuleProxyParameters(
			_legacyAddress
		);

		address safeModule = CreateX.deployCreate2(salt, initCode);

		assert(safeModule == expected);

		console.log('Proxy @', safeModule);
		vm.stopBroadcast();
	}

	function settle(address _legacyAddress, address _safe, address _token) public {
		vm.startBroadcast(deployer);
		(, , address safeModule) = _getSafeModuleProxyParameters(_legacyAddress);
		SafeModule(safeModule).settle(ISafe(_safe), _token);
		vm.stopBroadcast();
	}

	function _getUniversalSafeParameters(
		address _legacyAddress
	) internal view returns (uint256 saltNonce, bytes memory setupData, address expected) {
		(, , address safeModule) = _getSafeModuleProxyParameters(_legacyAddress);

		saltNonce = uint256(keccak256(abi.encodePacked(safeModule)));

		address[] memory owners = new address[](1);
		owners[0] = _legacyAddress;

		address[] memory modules = new address[](1);
		modules[0] = safeModule;

		bytes memory enableModuleData = abi.encodeWithSignature(
			'enableModules(address[])',
			modules
		);

		uint256 threshold = 1;
		address paymentToken = address(0);
		uint256 paymentAmount = 0;
		setupData = abi.encodeWithSelector(
			ISafe.setup.selector,
			owners,
			threshold,
			SAFE_MODULE_SETUP,
			enableModuleData,
			SAFE_FALLBACK_HANDLER,
			paymentToken,
			paymentAmount,
			SAFE_PAYMENT_RECEIVER
		);

		bytes32 salt = keccak256(abi.encodePacked(keccak256(setupData), saltNonce));
		console.log('salt');
		console.logBytes32(salt);

		bytes memory bytecode = abi.encodePacked(
			type(SafeProxy).creationCode,
			uint256(uint160(ADDRESS_SAFE_SINGLETON))
		);

		// bytes32 hash = keccak256(
		// 	abi.encodePacked(bytes1(0xff), vm.addr(deployer), salt, keccak256(bytecode))
		// );

		// expected = address(uint160(uint256(hash)));

		expected = CreateX.computeCreate2Address(salt, keccak256(bytecode));

		console.log('expected', expected);
	}

	function deployUniversalSafe(address _legacyAddress) public {
		vm.startBroadcast(deployer);

		(, , address safeModule) = _getSafeModuleProxyParameters(_legacyAddress);

		(
			uint256 nonce,
			bytes memory setupData,
			address safeExpectedAddress
		) = _getUniversalSafeParameters(_legacyAddress);

		SafeProxy safe = SafeProxyFactory(ADDRESS_SAFE_PROXY_FACTORY).createProxyWithNonce(
			ADDRESS_SAFE_SINGLETON,
			setupData,
			nonce
		);

		// assert(address(safe) == safeExpectedAddress);
		assert(IModuleManager(address(safe)).isModuleEnabled(safeModule));

		console.log('Expected @', address(safeExpectedAddress));
		console.log('Safe @', address(safe));

		vm.stopBroadcast();
	}

	function run() public {
		address legacyAddress = 0xf9A9e6288c7A23B2b07f06f668084A1101835fA6;

		console.log('CreateX', address(CreateX));
		console.log('Deployer @', vm.addr(deployer));

		vm.startBroadcast(deployer);

		(
			bytes32 safeModuleLogicSalt,
			bytes memory safeModuleLogicInitCode,
			address safeModuleLogicExpectedAddress
		) = _getSafeModuleLogicParameters();

		address safeModuleLogic = CreateX.deployCreate2(
			safeModuleLogicSalt,
			safeModuleLogicInitCode
		);

		console.log('Logic @', safeModuleLogic);

		assert(safeModuleLogic == safeModuleLogicExpectedAddress);

		(
			bytes32 safeModuleProxySalt,
			bytes memory safeModuleProxyInitCode,
			address safeModuleExpectedAddress
		) = _getSafeModuleProxyParameters(legacyAddress);

		address safeModule = CreateX.deployCreate2(safeModuleProxySalt, safeModuleProxyInitCode);

		console.log('Proxy @', safeModule);

		SafeModule(safeModule).toggleAutoSettlement(ADDRESS_USDC_ARBITRUM);
		SafeModule(safeModule).setExchangeRate(ADDRESS_USDC_ARBITRUM, 9500);

		assert(safeModule == safeModuleExpectedAddress);
		assert(SafeModule(safeModule).owner() == vm.addr(deployer));
		assert(SafeModule(safeModule).autoSettlement(ADDRESS_USDC_ARBITRUM));

		// Commitment over the module
		// uint256 nonce = uint256(bytes32(keccak256(abi.encodePacked(safeModule))));

		// address[] memory owners = new address[](1);
		// owners[0] = legacyAddress;

		// address[] memory modules = new address[](1);
		// modules[0] = safeModule;

		// bytes memory enableModuleData = abi.encodeWithSignature(
		// 	'enableModules(address[])',
		// 	modules
		// );

		// bytes memory setupData = abi.encodeWithSelector(
		// 	ISafe.setup.selector,
		// 	owners,
		// 	1, // threshold
		// 	SAFE_MODULE_SETUP,
		// 	enableModuleData,
		// 	SAFE_FALLBACK_HANDLER,
		// 	address(0), // payment token
		// 	0, // payment
		// 	SAFE_PAYMENT_RECEIVER
		// );

		// address safe = SafeProxyFactory(ADDRESS_SAFE_PROXY_FACTORY).createProxyWithNonce(
		// 	ADDRESS_SAFE_SINGLETON,
		// 	setupData,
		// 	nonce
		// );

		(
			uint256 nonce,
			bytes memory setupData,
			address safeExpectedAddress
		) = _getUniversalSafeParameters(legacyAddress);

		SafeProxy safe = SafeProxyFactory(ADDRESS_SAFE_PROXY_FACTORY).createProxyWithNonce(
			ADDRESS_SAFE_SINGLETON,
			setupData,
			nonce
		);

		console.log('Expected universal safe address', safeExpectedAddress);

		assert(address(safe) == safeExpectedAddress);
		assert(IModuleManager(address(safe)).isModuleEnabled(safeModule));

		console.log('Safe @', address(safe));

		// 	token.transfer(safe, 0.1 ether);
		// 	payable(vm.addr(1)).send(1 ether);

		// 	address usdtArbitrum = 0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9;
		// 	deal(usdtArbitrum, safe, 2000000);

		// 	// stdstore
		// 	// 	.enable_packed_slots()
		// 	// 	.target(usdtArbitrum)
		// 	// 	.sig('balanceOf(address)')
		// 	// 	.with_key(safe)
		// 	// 	.checked_write(2000000);

		// 	console.log('balance usdt balance', IERC20(usdtArbitrum).balanceOf(safe));
		// 	console.log('eth balance', vm.addr(1).balance);

		// 	SafeModule(module).settle{value: 0.001 ether}(ISafe(safe), usdtArbitrum);
	}
}
