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

	error DeployError(string);

	address immutable ADDRESS_SAFE_PROXY_FACTORY = 0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67;
	address immutable ADDRESS_SAFE_SINGLETON = 0x41675C099F32341bf84BFc5382aF534df5C7461a;
	address immutable SAFE_FALLBACK_HANDLER = 0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99;
	address immutable SAFE_PAYMENT_RECEIVER = 0x5afe7A11E7000000000000000000000000000000;
	address immutable SAFE_MODULE_SETUP = 0x8EcD4ec46D4D2a6B64fE960B3D64e8B94B2234eb;
	address immutable DEBRIDGE_DLN_SOURCE = 0xeF4fB24aD0916217251F553c0596F8Edc630EB66;
	address immutable SAFE_EXTENSIBLE_FALLBACK_HANDLER = 0x2f55e8b20D0B9FEFA187AA7d00B6Cbe563605bF5;

	mapping(uint256 => uint256) settlementChainIds;

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

	// uint256 deployer = vm.envUint('PRIVATE_KEY');
	// address deployerAddress = vm.addr(deployer);
	// address destinationAddress = vm.envAddress('DESTINATION_ADDRESS');
	// address destinationToken = vm.envAddress('DESTINATION_TOKEN');
	// uint256 destinationChain = vm.envUint('DESTINATION_CHAIN');
	// address originToken = vm.envAddress('USDC_ADDRESS');
	// uint256 originTokenExchangeRate = vm.envUint('ER_USD_EUR');
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

		// Gnosis => deBridge
		settlementChainIds[100] = 100000002;
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
				keccak256(initCode),
				address(CreateX)
			);
		} else {
			expected = previousLogic;
		}
	}

	function _getSafeModuleProxyParameters(
		address _destinationAddress,
		address _destinationToken,
		uint256 _destinationChain
	) internal view returns (bytes32 salt, bytes memory initCode, address expected) {
		(, , address safeModuleLogic) = _getSafeModuleLogicParameters();
		bytes memory safeModuleLogicInitializeData = abi.encodeWithSelector(
			SafeModule.initialize.selector,
			_destinationAddress,
			_destinationToken,
			_destinationChain
		);

		salt = keccak256(
			bytes.concat(
				abi.encodePacked(_destinationAddress, _destinationToken, _destinationChain),
				CREATEX_REDEPLOY_PROTECTION_FLAG
			)
		);

		initCode = abi.encodePacked(
			type(ERC1967Proxy).creationCode,
			abi.encode(safeModuleLogic, safeModuleLogicInitializeData)
		);

		expected = CreateX.computeCreate2Address(keccak256(abi.encode(salt)), keccak256(initCode));
	}

	function toggleAutoSettlement(
		address _destinationAddress,
		address _destinationToken,
		uint256 _destinationChain,
		address _token
	) public {
		vm.startBroadcast();
		(, , address proxy) = _getSafeModuleProxyParameters(
			_destinationAddress,
			_destinationToken,
			_destinationChain
		);

		SafeModule(proxy).toggleAutoSettlement(_token);

		vm.stopBroadcast();
	}

	function toggleAutoSettlement(address _safeModule, address _token) public {
		vm.startBroadcast();
		SafeModule(_safeModule).toggleAutoSettlement(_token);
		vm.stopBroadcast();
	}

	function setExchangeRate(address _safeModuleAddress, address _token, uint256 _rate) public {
		vm.startBroadcast();

		SafeModule(_safeModuleAddress).setExchangeRate(_token, _rate);

		vm.stopBroadcast();
	}

	function setExchangeRate(
		address _destinationAddress,
		address _destinationToken,
		uint256 _destinationChain,
		address _token,
		uint256 _rate
	) public {
		vm.startBroadcast();
		(, , address proxy) = _getSafeModuleProxyParameters(
			_destinationAddress,
			_destinationToken,
			_destinationChain
		);

		SafeModule(proxy).setExchangeRate(_token, _rate);

		vm.stopBroadcast();
	}

	function deploySafeModuleLogic() public {
		vm.startBroadcast();
		(bytes32 salt, bytes memory initCode, address expected) = _getSafeModuleLogicParameters();

		address safeModuleLogic = CreateX.deployCreate2(salt, initCode);

		console.log('Logic address @', safeModuleLogic);
		console.log('Logic address expected:', expected);

		vm.stopBroadcast();
	}

	function deploySafeModuleProxy(
		address _destinationAddress,
		address _destinationToken,
		uint256 _destinationChain
	) public {
		vm.startBroadcast();
		(bytes32 salt, bytes memory initCode, address expected) = _getSafeModuleProxyParameters(
			_destinationAddress,
			_destinationToken,
			_destinationChain
		);

		address safeModule = CreateX.deployCreate2(salt, initCode);

		assert(safeModule == expected);

		console.log('Proxy @', safeModule);
		vm.stopBroadcast();
	}

	function settle(
		address _destinationAddress,
		address _destinationToken,
		uint256 _destinationChain,
		address _token
	) public {
		vm.startBroadcast();
		(, , address safeModule) = _getSafeModuleProxyParameters(
			_destinationAddress,
			_destinationToken,
			_destinationChain
		);
		(, , address safe) = _getUniversalSafeParameters(
			_destinationAddress,
			_destinationToken,
			_destinationChain
		);
		uint256 protocolFee = IDlnSource(DEBRIDGE_DLN_SOURCE).globalFixedNativeFee();
		SafeModule(safeModule).settle{value: protocolFee}(safe, _token);
		vm.stopBroadcast();
	}

	function settle(address _safeModuleAddress, address _safe, address _token) public {
		vm.startBroadcast();
		uint256 protocolFee = IDlnSource(DEBRIDGE_DLN_SOURCE).globalFixedNativeFee();
		SafeModule(_safeModuleAddress).settle{value: protocolFee}(_safe, _token);
		vm.stopBroadcast();
	}
	function settleCow(address _safeModuleAddress, address _safe, address _token) public {
		vm.startBroadcast();
		SafeModule(_safeModuleAddress).settle(_safe, _token);
		vm.stopBroadcast();
	}

	function upgrade(address proxy, address newImpl) public {
		vm.startBroadcast();
		Core.upgradeProxyTo(proxy, newImpl, '');
		vm.stopBroadcast();
	}

	function _getUniversalSafeParameters(
		address _destinationAddress,
		address _destinationToken,
		uint256 _destinationChain
	) internal view returns (uint256 saltNonce, bytes memory initializer, address expected) {
		(, , address safeModule) = _getSafeModuleProxyParameters(
			_destinationAddress,
			_destinationToken,
			_destinationChain
		);

		saltNonce = uint256(keccak256(abi.encodePacked(safeModule)));

		address[] memory owners = new address[](1);
		owners[0] = _destinationAddress;

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
			SAFE_EXTENSIBLE_FALLBACK_HANDLER, // SAFE_FALLBACK_HANDLER,
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

	function deployUniversalSafe(
		address _destinationAddress,
		address _destinationToken,
		uint256 _destinationChain
	) public {
		vm.startBroadcast();

		(, , address safeModule) = _getSafeModuleProxyParameters(
			_destinationAddress,
			_destinationToken,
			_destinationChain
		);

		(uint256 nonce, bytes memory setupData, address expected) = _getUniversalSafeParameters(
			_destinationAddress,
			_destinationToken,
			_destinationChain
		);

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

	function _slice(
		bytes memory data,
		uint256 start,
		uint256 length
	) public pure returns (bytes memory) {
		require(start + length <= data.length, 'Out of bounds');

		bytes memory result = new bytes(length);

		assembly {
			let startPtr := add(add(data, 0x20), start) // Get pointer to start position
			let resultPtr := add(result, 0x20) // Get pointer to result

			for {
				let i := 0
			} lt(i, length) {
				i := add(i, 0x20)
			} {
				mstore(add(resultPtr, i), mload(add(startPtr, i)))
			}
		}

		return result;
	}

	function _maybeDeployLogic() internal {
		(
			bytes32 safeModuleLogicSalt,
			bytes memory safeModuleLogicInitCode,
			address safeModuleLogic
		) = _getSafeModuleLogicParameters();

		if (safeModuleLogic.code.length > 0) {
			console.log('SafeModule logic already deployed @', safeModuleLogic);
		} else {
			safeModuleLogic = CreateX.deployCreate2(safeModuleLogicSalt, safeModuleLogicInitCode);
			console.log('Logic @', safeModuleLogic);
		}
	}

	function _maybeDeployProxy(
		address _destinationAddress,
		address _destinationToken,
		uint256 _destinationChain
	) internal returns (address) {
		(
			bytes32 safeModuleProxySalt,
			bytes memory safeModuleProxyInitCode,
			address safeModule
		) = _getSafeModuleProxyParameters(
				_destinationAddress,
				_destinationToken,
				_destinationChain
			);

		if (safeModule.code.length > 0) {
			console.log('SafeModule proxy already deployed @', safeModule);
		} else {
			safeModule = CreateX.deployCreate2(safeModuleProxySalt, safeModuleProxyInitCode);
			console.log('Proxy @', safeModule);
		}

		return safeModule;
	}

	function getExchangeRate(address _safeModuleAddress, address _token) public {
		vm.startBroadcast();
		console.log('Exchange rate:', SafeModule(_safeModuleAddress).rates(_token));
	}

	function setDomain(address _safeModule, address safe) public {
		vm.startBroadcast();
		SafeModule(_safeModule).setDomain(safe);
		vm.stopBroadcast();
	}

	function run(
		uint256 _originTokenExchangeRate,
		address _originTokenAddress,
		address _destinationAddress,
		address _destinationToken,
		uint256 _destinationChain
	) public {
		address deployerAddress = msg.sender;
		console.log('CreateX', address(CreateX));
		console.log('Deployer @', deployerAddress);
		console.log('Destination address @', _destinationAddress);
		console.log('Destination chain @', _destinationChain);
		console.log('Destination token @', _destinationToken);

		vm.startBroadcast();

		_maybeDeployLogic();

		address safeModule = _maybeDeployProxy(
			_destinationAddress,
			_destinationToken,
			_destinationChain
		);

		SafeModule(safeModule).setSettlementChainIds(
			_destinationChain,
			settlementChainIds[_destinationChain]
		);

		if (!SafeModule(safeModule).autoSettlement(_originTokenAddress)) {
			SafeModule(safeModule).toggleAutoSettlement(_originTokenAddress);
			SafeModule(safeModule).setExchangeRate(_originTokenAddress, _originTokenExchangeRate);
		}

		assert(SafeModule(safeModule).owner() == deployerAddress);

		(uint256 nonce, bytes memory setupData, address safe) = _getUniversalSafeParameters(
			_destinationAddress,
			_destinationToken,
			_destinationChain
		);

		if (safe.code.length > 0) {
			console.log('UD safe already deployed @', safe);
		} else {
			safe = address(
				SafeProxyFactory(ADDRESS_SAFE_PROXY_FACTORY).createProxyWithNonce(
					ADDRESS_SAFE_SINGLETON,
					setupData,
					nonce
				)
			);

			// Needed in order to verify EIP712 signature
			// for CoW swaps
			// TODO: this should be included into the
			// safe initializer data somehow, keeping this shortcut
			// for now
			SafeModule(safeModule).setDomain(safe);
			console.log('UD deployed @', safe);
		}

		assert(IModuleManager(safe).isModuleEnabled(safeModule));
	}
}
