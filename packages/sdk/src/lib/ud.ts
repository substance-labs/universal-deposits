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
  erc20Abi,
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
  parseAbiItem,
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

export class UniversalDeposits {
  static readonly USDC_MAPPING: ChainIdToString = {
    '8453': '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // base
    '137': '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359', // polygon
    '42161': '0xaf88d065e77c8cc2239327c5edb3a432268e5831', // arbitrum
    '100': '0x2a22f9c3b484c3629090feed35f17ff8f88f76f0', // gnosis
  }

  static readonly EURE_MAPPING: ChainIdToString = {
    '100': '0xcB444e90D8198415266c6a2724b7900fb12FC56E', // gnosis
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
            BigInt(this.config.destinationChain),
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
        SAFE_EXTENSIBLE_FALLBACK_HANDLER,
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

  // FIXME: shortcut, create instea a more general
  // watch event accepting the tokens to watch as a
  // parameter
  async watchDestinationTokenTransfer({
    url,
    onBalanceChange,
  }: {
    url: string
    onBalanceChange: EventListenerOrEventListenerObject
  }) {
    const universalSafe = this.getUDSafeAddress()
    const client = createPublicClient({
      transport: http(url),
      batch: { multicall: true },
    })

    const chainId = await client.getChainId()
    const erc20Address = this.config.destinationToken
    const token = getContract({ address: erc20Address, abi: erc20Abi, client })
    const initBalance = await token.read.balanceOf([universalSafe])
    console.log(`${chainId}: initBalance: ${initBalance}`)
    const eventTarget = new EventTarget()
    eventTarget.addEventListener('onBalanceChanged', onBalanceChange)
    const id = setInterval(async () => {
      try {
        // console.log(`${chainId} checking balance...`)
        const balance = await token.read.balanceOf([universalSafe])
        if (balance !== initBalance) {
          console.log(`${chainId}: Balance changed, sending event`)
          const event = new CustomEvent('onBalanceChanged', {
            detail: { chainId, token: erc20Address },
          })
          eventTarget.dispatchEvent(event)
          clearInterval(id)
        }
      } catch (e) {
        console.log('ERROR when checking balance:')
      }
    }, 2000)
  }

  async watchTokenTransfer({
    onBalanceChange,
  }: {
    onBalanceChange: EventListenerOrEventListenerObject
  }) {
    const universalSafe = this.getUDSafeAddress()
    for (let url of this.config.urls as string[]) {
      const client = createPublicClient({
        transport: http(url),
        batch: { multicall: true },
      })

      const chainId = await client.getChainId()
      const erc20Address = UniversalDeposits.USDC_MAPPING[chainId] as Address
      const token = getContract({ address: erc20Address, abi: erc20Abi, client })
      const initBalance = await token.read.balanceOf([universalSafe])
      console.log(`${chainId}: initBalance: ${initBalance}`)
      const eventTarget = new EventTarget()
      eventTarget.addEventListener('onBalanceChanged', onBalanceChange)
      const id = setInterval(async () => {
        try {
          // console.log(`${chainId} checking balance...`)
          const balance = await token.read.balanceOf([universalSafe])
          if (balance !== initBalance) {
            console.log(`${chainId}: Balance changed, sending event`)
            const event = new CustomEvent('onBalanceChanged', {
              detail: { chainId, token: erc20Address },
            })
            eventTarget.dispatchEvent(event)
            clearInterval(id)
          }
        } catch (e) {
          console.log('ERROR when checking balance:')
        }
      }, 2000)
    }
  }

  async watchAssetReceived({
    onAssetReceived,
  }: {
    onAssetReceived: EventListenerOrEventListenerObject
  }) {
    const address = this.config.destinationAddress
    const transferEventAbi = parseAbiItem(
      'event Transfer(address indexed from, address indexed to, uint256 value)',
    )

    if (this.config.destinationUrl === undefined) {
      throw new Error('Please provide the destination chain url')
    }

    const client = createPublicClient({
      transport: http(this.config.destinationUrl),
      batch: { multicall: true },
    })

    const erc20Address = this.config.destinationToken
    const contract = getContract({ address: erc20Address, abi: erc20Abi, client })

    const initialBalance = await contract.read.balanceOf([this.config.destinationAddress])
    console.log('Initial balance is:', initialBalance)
    const eventTarget = new EventTarget()
    eventTarget.addEventListener('onAssetReceived', onAssetReceived)
    const id = setInterval(async () => {
      try {
        // const balance = 0n
        const balance = await contract.read.balanceOf([this.config.destinationAddress])
        // console.log('Checking balance')
        if (balance !== initialBalance) {
          console.log('Balance changed, sending event')
          const event = new CustomEvent('onAssetReceived')
          eventTarget.dispatchEvent(event)
          clearInterval(id)
        }
      } catch (e) {
        console.log('ERROR when checking balance:')
      }
    }, this.config.checkIntervalMs || 1500)
  }

  async watchSettle({ onSettleCalled }: { onSettleCalled: EventListenerOrEventListenerObject }) {
    const address = this.getUDSafeAddress()
    const transferEventAbi = parseAbiItem(
      'event Transfer(address indexed from, address indexed to, uint256 value)',
    )
    for (let url of this.config.urls as string[]) {
      const client = createPublicClient({ transport: http(url) })
      const chainId = await client.getChainId()

      const eventTarget = new EventTarget()
      eventTarget.addEventListener('onSettleCalled', onSettleCalled)
      const erc20Address = UniversalDeposits.USDC_MAPPING[chainId] as `0x${string}`
      const unwatch = client.watchEvent({
        address: erc20Address, // ERC-20 token address
        event: transferEventAbi,
        args: {
          from: [this.getUDSafeAddress()],
        },
        onLogs: () => {
          const event = new CustomEvent('onSettleCalled', {
            detail: { chainId, token: erc20Address },
          })
          eventTarget.dispatchEvent(event)
        },
      })
    }
  }

  watchDeployment(feedback: DeploymentFeedback) {
    if (this.config.urls?.length === 0)
      throw new Error('Please provide to monitor the safe address')

    const checkIntervalMs = this.config.checkIntervalMs ? this.config.checkIntervalMs : 3000
    const eventTarget = new EventTarget()

    let intervalIds: NodeJS.Timeout[] = []

    const checkContractDeployment = async (
      client: PublicClient,
      address: Address,
      eventTarget: EventTarget,
      eventName: string,
      intervalIdsIndex: number,
    ) => {
      const chainId = await client.getChainId()
      try {
        const bytecode = await client.getBytecode({ address })
        if (bytecode) {
          eventTarget.dispatchEvent(
            new CustomEvent(eventName, {
              detail: { chainId },
            }),
          )
          clearInterval(intervalIds[intervalIdsIndex])
        }
      } catch (e) {
        console.log('ERROR:', e)
      }
    }

    const eventsMapping: EventMapping = {
      onLogicDeploy: {
        callback: feedback.onLogicDeploy,
        address: this.getSafeModuleLogicAddress(),
      },
      onProxyDeploy: {
        callback: feedback.onProxyDeploy,
        address: this.getSafeModuleProxyAddress(),
      },
      onSafeDeploy: {
        callback: feedback.onSafeDeploy,
        address: this.getUDSafeAddress(),
      },
    }

    let i = 0
    for (let url of this.config.urls as string[]) {
      const client = createPublicClient({
        transport: http(url),
      })
      for (let eventName in eventsMapping) {
        eventTarget.addEventListener(eventName, eventsMapping[eventName].callback)
        const id = setInterval(
          checkContractDeployment,
          checkIntervalMs,
          client,
          eventsMapping[eventName].address,
          eventTarget,
          eventName,
          i,
        )
        intervalIds.push(id)
        i++
      }
    }
  }
}
