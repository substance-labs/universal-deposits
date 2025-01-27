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
import {IDlnSource} from 'dln-contracts/interfaces/IDlnSource.sol';

import {StdCheats} from 'forge-std/StdCheats.sol';
import {console} from 'forge-std/console.sol';
import {stdStorage, StdStorage} from 'forge-std/Test.sol';

import {Core} from 'openzeppelin-foundry-upgrades/internal/Core.sol';

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
	address immutable DEBRIDGE_DLN_SOURCE = 0xeF4fB24aD0916217251F553c0596F8Edc630EB66;

	// Needed to compute the safe address (mismatch among bytecode retrieved
	// from the library vs. bytecode on chain)
	bytes SAFE_PROXY_CREATION_CODE =
		vm.parseBytes(
			// Taken from Tenderly:
			//   1. Go to the CREATE2 call and press debug
			//   2. See the [OPCODE] parameters under the source code
			//   3. Copy [RAW_INPUT] and remove the ending part related to the SAFE_SINGLETON encoding
			//   4. Done!
			'0x608060405234801561001057600080fd5b506040516101e63803806101e68339818101604052602081101561003357600080fd5b8101908080519060200190929190505050600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff1614156100ca576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260228152602001806101c46022913960400191505060405180910390fd5b806000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055505060ab806101196000396000f3fe608060405273ffffffffffffffffffffffffffffffffffffffff600054167fa619486e0000000000000000000000000000000000000000000000000000000060003514156050578060005260206000f35b3660008037600080366000845af43d6000803e60008114156070573d6000fd5b3d6000f3fea264697066735822122003d1488ee65e08fa41e58e888a9865554c535f2c77126a82cb4c0f917f31441364736f6c63430007060033496e76616c69642073696e676c65746f6e20616464726573732070726f7669646564'
		);

	string SAFEMODULE_SALT = 'universal-deposits';

	bytes1 immutable CREATEX_REDEPLOY_PROTECTION_FLAG = bytes1(0x00);

	uint256 deployer = vm.envUint('PRIVATE_KEY');
	address deployerAddress = vm.addr(deployer);
	address destinationAddress = vm.envAddress('DESTINATION_ADDRESS');
	address destinationToken = vm.envAddress('DESTINATION_TOKEN');
	uint256 destinationChain = vm.envUint('DESTINATION_CHAIN');

	address previousLogic;

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

	function setUp() public withCreateX {
		try vm.envAddress('PREVIOUS_LOGIC') returns (address result) {
			console.log('Previous logic found in .env');
			previousLogic = result;
		} catch {}
	}

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

		if (previousLogic == address(0)) {
			expected = CreateX.computeCreate2Address(
				keccak256(abi.encode(salt)),
				keccak256(initCode)
			);
		} else {
			expected = previousLogic;
		}
	}

	function _getSafeModuleProxyParameters()
		internal
		view
		returns (bytes32 salt, bytes memory initCode, address expected)
	{
		(, , address safeModuleLogic) = _getSafeModuleLogicParameters();
		bytes memory safeModuleLogicInitializeData = abi.encodeWithSignature(
			'initialize(address,address,address)',
			destinationAddress
		);

		salt = bytes32(
			bytes.concat(
				abi.encodePacked(destinationAddress, destinationToken, destinationChain),
				CREATEX_REDEPLOY_PROTECTION_FLAG
			)
		);

		initCode = abi.encodePacked(
			type(ERC1967Proxy).creationCode,
			abi.encode(safeModuleLogic, safeModuleLogicInitializeData)
		);

		expected = CreateX.computeCreate2Address(keccak256(abi.encode(salt)), keccak256(initCode));
	}

	function toggleAutoSettlement(address _token) public {
		vm.startBroadcast(deployer);
		(, , address proxy) = _getSafeModuleProxyParameters();

		SafeModule(proxy).toggleAutoSettlement(_token);

		vm.stopBroadcast();
	}

	function setExchangeRate(address _token, uint256 _rate) public {
		vm.startBroadcast(deployer);
		(, , address proxy) = _getSafeModuleProxyParameters();

		SafeModule(proxy).setExchangeRate(_token, _rate);

		vm.stopBroadcast();
	}

	function deploySafeModuleLogic() public {
		vm.startBroadcast(deployer);
		(bytes32 salt, bytes memory initCode, ) = _getSafeModuleLogicParameters();

		address safeModuleLogic = CreateX.deployCreate2(salt, initCode);

		console.log('Logic address @', safeModuleLogic);

		vm.stopBroadcast();
	}

	function deploySafeModuleProxy() public {
		vm.startBroadcast(deployer);
		(bytes32 salt, bytes memory initCode, address expected) = _getSafeModuleProxyParameters();

		address safeModule = CreateX.deployCreate2(salt, initCode);

		assert(safeModule == expected);

		console.log('Proxy @', safeModule);
		vm.stopBroadcast();
	}

	function settle(address _token) public {
		vm.startBroadcast(deployer);
		(, , address safeModule) = _getSafeModuleProxyParameters();
		(, , address safe) = _getUniversalSafeParameters();
		uint256 protocolFee = IDlnSource(DEBRIDGE_DLN_SOURCE).globalFixedNativeFee();
		SafeModule(safeModule).settle{value: protocolFee}(safe, _token);
		vm.stopBroadcast();
	}

	function upgrade(address newImpl) public {
		vm.startBroadcast(vm.envUint('OTHER'));
		(, , address proxy) = _getSafeModuleProxyParameters();
		Core.upgradeProxyTo(proxy, newImpl, '');
		vm.stopBroadcast();
	}

	function _getUniversalSafeParameters()
		internal
		view
		returns (uint256 saltNonce, bytes memory initializer, address expected)
	{
		(, , address safeModule) = _getSafeModuleProxyParameters();

		saltNonce = uint256(keccak256(abi.encodePacked(safeModule)));

		address[] memory owners = new address[](1);
		owners[0] = destinationAddress;

		address[] memory modules = new address[](1);
		modules[0] = safeModule;

		bytes memory enableModuleData = abi.encodeWithSignature(
			'enableModules(address[])',
			modules
		);

		uint256 threshold = 1;
		address paymentToken = address(0);
		uint256 paymentAmount = 0;
		initializer = abi.encodeWithSelector(
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

		bytes32 salt = keccak256(abi.encodePacked(keccak256(initializer), saltNonce));

		bytes memory deploymentData = abi.encodePacked(
			SAFE_PROXY_CREATION_CODE, // with `type(SafeProxy).creationCode,` doesn't work
			uint256(uint160(ADDRESS_SAFE_SINGLETON))
		);

		bytes32 hash = keccak256(
			abi.encodePacked(
				bytes1(0xff),
				address(ADDRESS_SAFE_PROXY_FACTORY),
				salt,
				keccak256(deploymentData)
			)
		);

		expected = address(uint160(uint256(hash)));
	}

	function deployUniversalSafe() public {
		vm.startBroadcast(deployer);

		(, , address safeModule) = _getSafeModuleProxyParameters();

		(uint256 nonce, bytes memory setupData, address expected) = _getUniversalSafeParameters();

		SafeProxy safe = SafeProxyFactory(ADDRESS_SAFE_PROXY_FACTORY).createProxyWithNonce(
			ADDRESS_SAFE_SINGLETON,
			setupData,
			nonce
		);

		assert(address(safe) == expected);
		assert(IModuleManager(expected).isModuleEnabled(safeModule));

		console.log('UD address @', expected);

		vm.stopBroadcast();
	}

	function run() public {
		console.log('CreateX', address(CreateX));
		console.log('Deployer @', deployerAddress);
		console.log('Destination address @', destinationAddress);
		console.log('Destination chain @', destinationChain);
		console.log('Destination token @', destinationToken);

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
		) = _getSafeModuleProxyParameters();

		address safeModule = CreateX.deployCreate2(safeModuleProxySalt, safeModuleProxyInitCode);

		console.log('Proxy @', safeModule);

		SafeModule(safeModule).toggleAutoSettlement(ADDRESS_USDC_ARBITRUM);
		SafeModule(safeModule).setExchangeRate(ADDRESS_USDC_ARBITRUM, 9500);

		assert(safeModule == safeModuleExpectedAddress);
		assert(SafeModule(safeModule).owner() == deployerAddress);
		assert(SafeModule(safeModule).autoSettlement(ADDRESS_USDC_ARBITRUM));

		(
			uint256 nonce,
			bytes memory setupData,
			address safeExpectedAddress
		) = _getUniversalSafeParameters();

		SafeProxy safe = SafeProxyFactory(ADDRESS_SAFE_PROXY_FACTORY).createProxyWithNonce(
			ADDRESS_SAFE_SINGLETON,
			setupData,
			nonce
		);

		console.log('Expected universal safe address', safeExpectedAddress);

		assert(address(safe) == safeExpectedAddress);
		assert(IModuleManager(address(safe)).isModuleEnabled(safeModule));

		console.log('Safe @', address(safe));
	}
}
