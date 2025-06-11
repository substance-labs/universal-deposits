import {
  Address,
  concat,
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  getContractAddress,
  Hex,
  hexToBigInt,
  keccak256,
  padHex,
  parseAbiParameters,
  toBytes,
  toHex,
  zeroAddress,
} from 'viem'
import SafeModuleJson from '../lib/abis/SafeModule.json'
import ERC1967Proxy from '../lib/abis/ERC1967Proxy.json'
import ISafeJson from '../lib/abis/ISafe.json'

// TODO: read from packages/constants
const CREATEX_REDEPLOY_PROTECTION_FLAG = '0x00' as Hex
const SAFEMODULE_SALT = toHex('universal-deposits') as Hex // TODO: rename
const SAFE_MODULE_SETUP = '0x8EcD4ec46D4D2a6B64fE960B3D64e8B94B2234eb' as Address
const ADDRESS_CREATEX = '0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed' as Address
const ADDRESS_SAFE_PROXY_FACTORY = '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67' as Address
const SAFE_FALLBACK_HANDLER = '0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99' as Address
const SAFE_EXTENSIBLE_FALLBACK_HANDLER = '0x2f55e8b20D0B9FEFA187AA7d00B6Cbe563605bF5' as Address
const SAFE_PAYMENT_RECEIVER = '0x5afe7A11E7000000000000000000000000000000' as Address
const SAFE_PROXY_CREATION_CODE =
  '0x608060405234801561001057600080fd5b506040516101e63803806101e68339818101604052602081101561003357600080fd5b8101908080519060200190929190505050600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff1614156100ca576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260228152602001806101c46022913960400191505060405180910390fd5b806000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055505060ab806101196000396000f3fe608060405273ffffffffffffffffffffffffffffffffffffffff600054167fa619486e0000000000000000000000000000000000000000000000000000000060003514156050578060005260206000f35b3660008037600080366000845af43d6000803e60008114156070573d6000fd5b3d6000f3fea264697066735822122003d1488ee65e08fa41e58e888a9865554c535f2c77126a82cb4c0f917f31441364736f6c63430007060033496e76616c69642073696e676c65746f6e20616464726573732070726f7669646564' as Hex
const ADDRESS_SAFE_SINGLETON = '0x41675C099F32341bf84BFc5382aF534df5C7461a' as Address

type UniversalDepositsConfig = {
  destinationAddress: Address
  destinationToken: Address
  destinationChain: string
  urls?: string[]
  checkIntervalMs?: number
  destinationUrl?: string
}

type DeploymentFeedback = {
  onLogicDeploy: EventListenerOrEventListenerObject
  onProxyDeploy: EventListenerOrEventListenerObject
  onSafeDeploy: EventListenerOrEventListenerObject
}

type EventMappingValue = {
  callback: EventListenerOrEventListenerObject
  address: Address
}

type EventMapping = {
  [key: string]: EventMappingValue
}

type ChainIdToString = {
  [key: string]: string
}

export interface OrderIdParams {
  sourceChainId: number | string
  destinationChainId: number | string
  recipientAddress: Address
  udAddress: Address
  sourceToken: Address
  destinationToken: Address
}

export interface OrderIdResult {
  orderId: Hex
  parameters: OrderIdParams
}

export class UniversalDeposits {
  // TODO: replace with reading from constants
  static readonly USDC_MAPPING: ChainIdToString = {
    '8453': '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // base
    '137': '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359', // polygon
    '42161': '0xaf88d065e77c8cc2239327c5edb3a432268e5831', // arbitrum
    '100': '0x2a22f9c3b484c3629090feed35f17ff8f88f76f0', // gnosis
  }

  static readonly EURE_MAPPING: ChainIdToString = {
    '100': '0xcB444e90D8198415266c6a2724b7900fb12FC56E', // gnosis
  }

  /**
   * Generate a deterministic order ID from order parameters
   * @param params Order parameters
   * @returns Order ID hash and the original parameters
   */
  static generateOrderId(params: OrderIdParams): OrderIdResult {
    const {
      sourceChainId,
      destinationChainId,
      recipientAddress,
      udAddress,
      sourceToken,
      destinationToken,
    } = params

    // Create a deterministic hash from the parameters
    const orderIdHash = keccak256(
      encodePacked(
        ['uint256', 'uint256', 'address', 'address', 'address', 'address'],
        [
          BigInt(sourceChainId),
          BigInt(destinationChainId),
          recipientAddress,
          udAddress,
          sourceToken,
          destinationToken,
        ],
      ),
    )

    return {
      orderId: orderIdHash,
      parameters: params,
    }
  }

  config: UniversalDepositsConfig
  constructor(config: UniversalDepositsConfig) {
    const { destinationChain } = config
    this.config = config
    this.config.destinationChain = destinationChain.toString()
    if (!this.config.destinationChain) {
      throw new Error('Unsupported chain id')
    }
  }

  _abiEncode(_abiParameters: string, _params: unknown[]): Hex {
    return encodeAbiParameters(parseAbiParameters(_abiParameters), _params)
  }

  getSafeModuleLogicParams(): { salt: Hex; bytecode: Hex; contractAddress: Address } {
    const from = ADDRESS_CREATEX

    let salt = concat([
      encodePacked(['bytes'], [SAFEMODULE_SALT]),
      CREATEX_REDEPLOY_PROTECTION_FLAG,
    ])

    salt = keccak256(this._abiEncode('bytes32', [padHex(salt, { dir: 'right', size: 32 })]))

    const bytecode = encodePacked(['bytes'], [SafeModuleJson.bytecode.object as Hex])
    // const bytecode = SafeModuleJson.bytecode.object as Hex;

    // TODO: fix the keccak256(salt) as it is a temporary fix to result in the same address as using createX guardedSalt
    const contractAddress = getContractAddress({
      opcode: 'CREATE2',
      from,
      salt: keccak256(salt),
      bytecode,
    })

    return { salt, bytecode, contractAddress }
  }

  getSafeModuleProxyParams(): { salt: Hex; bytecode: Hex; contractAddress: Address } {
    const data = encodeFunctionData({
      abi: SafeModuleJson.abi,
      functionName: 'initialize',
      args: [
        this.config.destinationAddress,
        this.config.destinationToken,
        this.config.destinationChain,
      ],
    })

    const { contractAddress: logic } = this.getSafeModuleLogicParams()

    const rawSalt = keccak256(
      concat([
        encodePacked(
          ['address', 'address', 'uint256'],
          [
            this.config.destinationAddress,
            this.config.destinationToken,
            BigInt(this.config.destinationChain),
          ],
        ),
        CREATEX_REDEPLOY_PROTECTION_FLAG,
      ]),
    )

    const salt = keccak256(this._abiEncode('bytes32', [rawSalt]))

    const bytecode = encodePacked(
      ['bytes', 'bytes'],
      [ERC1967Proxy.bytecode.object as Hex, this._abiEncode('address,bytes', [logic, data])],
    )

    const from = ADDRESS_CREATEX
    const contractAddress = getContractAddress({
      opcode: 'CREATE2',
      from,
      salt: keccak256(salt), // use keccak again because in createX, the original salt will result in keccak256(salt)
      bytecode,
    })

    // corresponding on chain function call for reference
    //   const {
    //     salt, // the original salt returned below
    //     bytecode: initCode,
    //     contractAddress: expectedSafeModuleLogicAddress,
    //   } = universalDepositInstance.getSafeModuleProxyParams()

    //   const expectedSafeByCreateX = await createxContract.read.computeCreate2Address({
    //     address: ADDRESSES.CREATEX,
    //     abi: CreateXAbi,
    //     client: publicClient,
    //     args: [keccak256(salt), keccak256(initCode)],
    //   })

    return { salt, bytecode, contractAddress }
  }

  getUDSafeParams(): { saltNonce: BigInt; initializer: Hex; contractAddress: Address } {
    const { contractAddress: safeModule } = this.getSafeModuleProxyParams()
    const saltNonce = hexToBigInt(keccak256(encodePacked(['address'], [safeModule]))) // this is flexible

    // Encode enableModules call
    const abi = [
      {
        type: 'function',
        name: 'enableModules',
        inputs: [{ name: 'module', type: 'address[]' }],
        outputs: [],
        stateMutability: 'nonpayable',
      },
    ]
    const data = encodeFunctionData({ abi, functionName: 'enableModules', args: [[safeModule]] })

    // Encode Safe initializer
    const owners = [this.config.destinationAddress]
    const threshold = 1
    const paymentToken = zeroAddress
    const paymentAmount = 0
    const initializer = encodeFunctionData({
      abi: ISafeJson.abi,
      functionName: 'setup',
      args: [
        owners,
        threshold,
        SAFE_MODULE_SETUP,
        data,
        SAFE_EXTENSIBLE_FALLBACK_HANDLER,
        paymentToken,
        paymentAmount,
        SAFE_PAYMENT_RECEIVER,
      ],
    })

    // keccak256(abi.encodePacked(keccak256(initializer), saltNonce));
    // Compute salt: this logic is on SafeProxyFactory.sol
    const salt = keccak256(
      encodePacked(['bytes32', 'uint256'], [keccak256(initializer), saltNonce]),
    )

    // Compute bytecode
    const bytecode = encodePacked(
      ['bytes', 'uint256'],
      [SAFE_PROXY_CREATION_CODE, hexToBigInt(ADDRESS_SAFE_SINGLETON)],
    )

    // Compute create2 contract address
    const hash = keccak256(
      encodePacked(
        ['bytes1', 'address', 'bytes32', 'bytes32'],
        ['0xff', ADDRESS_SAFE_PROXY_FACTORY, salt, keccak256(bytecode)],
      ),
    )

    const contractAddress = toHex(toBytes(hash).slice(12))

    return { saltNonce, initializer, contractAddress }
  }
}
