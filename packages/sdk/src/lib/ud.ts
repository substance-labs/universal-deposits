import {
  AbiParameter,
  Address,
  ByteArray,
  checksumAddress,
  concat,
  createPublicClient,
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  getAddress,
  getContract,
  getContractAddress,
  Hex,
  hexToBigInt,
  http,
  isBytes,
  keccak256,
  pad,
  padHex,
  parseAbiParameter,
  parseAbiParameters,
  PublicClient,
  toBytes,
  toFunctionSignature,
  toHex,
  zeroAddress,
} from 'viem'
import SafeModuleJson from './abis/SafeModule.json'
import ERC1967Proxy from './abis/ERC1967Proxy.json'
import ISafeJson from './abis/ISafe.json'

const CREATEX_REDEPLOY_PROTECTION_FLAG = '0x00' as Hex
const SAFEMODULE_SALT = toHex('universal-deposits') as Hex // TODO: rename
const SAFE_MODULE_SETUP = '0x8EcD4ec46D4D2a6B64fE960B3D64e8B94B2234eb' as Address
const ADDRESS_CREATEX = '0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed' as Address
const ADDRESS_SAFE_PROXY_FACTORY = '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67' as Address
const SAFE_FALLBACK_HANDLER = '0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99' as Address
const SAFE_PAYMENT_RECEIVER = '0x5afe7A11E7000000000000000000000000000000' as Address
const SAFE_PROXY_CREATION_CODE =
  '0x608060405234801561001057600080fd5b506040516101e63803806101e68339818101604052602081101561003357600080fd5b8101908080519060200190929190505050600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff1614156100ca576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260228152602001806101c46022913960400191505060405180910390fd5b806000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055505060ab806101196000396000f3fe608060405273ffffffffffffffffffffffffffffffffffffffff600054167fa619486e0000000000000000000000000000000000000000000000000000000060003514156050578060005260206000f35b3660008037600080366000845af43d6000803e60008114156070573d6000fd5b3d6000f3fea264697066735822122003d1488ee65e08fa41e58e888a9865554c535f2c77126a82cb4c0f917f31441364736f6c63430007060033496e76616c69642073696e676c65746f6e20616464726573732070726f7669646564' as Hex
const ADDRESS_SAFE_SINGLETON = '0x41675C099F32341bf84BFc5382aF534df5C7461a' as Address

type UniversalDepositsConfig = {
  destinationAddress: Address
  destinationToken: Address
  destinationChain: bigint,
  urls?: string[],
  checkIntervalMs?: number
}

type DeploymentFeedback = { 
  onLogicDeploy: EventListenerOrEventListenerObject, 
  onProxyDeploy: EventListenerOrEventListenerObject, 
  onSafeDeploy: EventListenerOrEventListenerObject 
}

type EventMapping = {
  [key: string]: EventListenerOrEventListenerObject
}

export class UniversalDeposits {
  config: UniversalDepositsConfig
  constructor(config: UniversalDepositsConfig) {
    this.config = config
  }

  _abiEncode(_abiParameters: string, _params: unknown[]): Hex {
    return encodeAbiParameters(parseAbiParameters(_abiParameters), _params)
  }

  getSafeModuleLogicAddress(): Address {
    const from = ADDRESS_CREATEX
    let salt = concat([
      encodePacked(['bytes'], [SAFEMODULE_SALT]),
      CREATEX_REDEPLOY_PROTECTION_FLAG,
    ])

    salt = keccak256(this._abiEncode('bytes32', [padHex(salt, { dir: 'right', size: 32 })]))

    const bytecode = encodePacked(['bytes'], [SafeModuleJson.bytecode.object as Hex])

    return getContractAddress({ opcode: 'CREATE2', from, salt, bytecode })
  }

  getSafeModuleProxyAddress(): Address {
    const data = encodeFunctionData({
      abi: SafeModuleJson.abi,
      functionName: 'initialize',
      args: [
        this.config.destinationAddress,
        this.config.destinationToken,
        this.config.destinationChain,
      ],
    })

    const logic = this.getSafeModuleLogicAddress()
    const salt = keccak256(
      concat([
        encodePacked(
          ['address', 'address', 'uint256'],
          [
            this.config.destinationAddress,
            this.config.destinationToken,
            this.config.destinationChain,
          ],
        ),
        CREATEX_REDEPLOY_PROTECTION_FLAG,
      ]),
    )
    const bytecode = encodePacked(
      ['bytes', 'bytes'],
      [ERC1967Proxy.bytecode.object as Hex, this._abiEncode('address,bytes', [logic, data])],
    )

    const from = ADDRESS_CREATEX

    return getContractAddress({
      opcode: 'CREATE2',
      from,
      salt: keccak256(this._abiEncode('bytes32', [salt])),
      bytecode,
    })
  }

  getUDSafeAddress() {
    const safeModule = this.getSafeModuleProxyAddress()
    const saltNonce = hexToBigInt(keccak256(encodePacked(['address'], [safeModule])))

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
        SAFE_FALLBACK_HANDLER,
        paymentToken,
        paymentAmount,
        SAFE_PAYMENT_RECEIVER,
      ],
    })

    const salt = keccak256(
      encodePacked(['bytes32', 'uint256'], [keccak256(initializer), saltNonce]),
    )

    const deploymentData = encodePacked(
      ['bytes', 'uint256'],
      [SAFE_PROXY_CREATION_CODE, hexToBigInt(ADDRESS_SAFE_SINGLETON)],
    )

    const hash = keccak256(
      encodePacked(
        ['bytes1', 'address', 'bytes32', 'bytes32'],
        ['0xff', ADDRESS_SAFE_PROXY_FACTORY, salt, keccak256(deploymentData)],
      ),
    )

    return toHex(toBytes(hash).slice(12))
  }

  watchDeployment(feedback: DeploymentFeedback) {
    if (this.config.urls?.length === 0) 
      throw new Error('Please provide to monitor the safe address')

    const checkIntervalMs = this.config.checkIntervalMs ? this.config.checkIntervalMs : 1000
    const clear = (_intervalId: number) => clearInterval(_intervalId) 
    const eventTarget = new EventTarget()

    
    let intervalIds: NodeJS.Timeout[] = []
    const checkContractDeployment = async (
      client: PublicClient,
      address: Address, 
      eventTarget: EventTarget, 
      eventName: string,
      intervalIdsIndex: number
    ) => {
      const bytecode = await client.getCode({ address })

      if (bytecode) {
        eventTarget.dispatchEvent(new CustomEvent(eventName, { 
          detail: { 
            chainId: await client.getChainId() 
          } 
        }))
        clearInterval(intervalIds[intervalIdsIndex])
      }
    }

    const eventsMapping: EventMapping = {
      "onLogicDeploy": feedback.onLogicDeploy,
      "onProxyDeploy": feedback.onProxyDeploy,
      "onSafeDeploy": feedback.onSafeDeploy,
    }

    let i = 0
    for (let url of this.config.urls as string[]) {
      const client = createPublicClient({
        transport: http(url)
      })
      for (let eventName in eventsMapping) {
        eventTarget.addEventListener(eventName, eventsMapping[eventName])
        intervalIds[i] = setInterval(
          checkContractDeployment, 
          checkIntervalMs,
          client,
          this.getSafeModuleLogicAddress(),
          eventTarget,
          eventName,
          i
        )  
        i++
      }
    }
  }
}
