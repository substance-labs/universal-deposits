import {
  AbiParameter,
  Address,
  ByteArray,
  concat,
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  getAddress,
  getContract,
  getContractAddress,
  Hex,
  isBytes,
  keccak256,
  pad,
  padHex,
  parseAbiParameter,
  parseAbiParameters,
  toBytes,
  toHex,
} from 'viem'
import SafeModuleJson from './abis/SafeModule.json'
import ERC1967Proxy from './abis/ERC1967Proxy.json'

const CREATEX_REDEPLOY_PROTECTION_FLAG = '0x00' as Hex
const SAFEMODULE_SALT = toHex('universal-deposits') as Hex
const ADDRESS_CREATEX = '0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed' as Address

type UniversalDepositsConfig = {
  destinationAddress: Address
  destinationToken: Address
  destinationChain: bigint
}

export class UniversalDeposits {
  config: UniversalDepositsConfig
  constructor(config: UniversalDepositsConfig) {
    this.config = config
  }

  // TODO: when going through a lot of addresses, use
  // https://viem.sh/docs/contract/encodeFunctionData.html#preparation-performance-optimization
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

  getSafeModuleProxyAddress() {
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
}
