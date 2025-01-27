import {
  Address,
  ByteArray,
  concat,
  encodeAbiParameters,
  encodePacked,
  getAddress,
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

const CREATEX_REDEPLOY_PROTECTION_FLAG = '0x00' as Hex
const SAFEMODULE_SALT = toHex('universal-deposits') as Hex
const ADDRESS_CREATEX = '0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed' as Address

type UniversalDepositsConfig = {
  destinationAddress: string
  tokenAddress: string
  destinationChain: number
}

export class UniversalDeposits {
  config: UniversalDepositsConfig
  constructor(config: UniversalDepositsConfig) {
    this.config = config
  }

  getSafeModuleLogicAddress() {
    const from = ADDRESS_CREATEX
    let salt = concat([
      encodePacked(['bytes'], [SAFEMODULE_SALT]),
      CREATEX_REDEPLOY_PROTECTION_FLAG,
    ])
    salt = keccak256(
      encodeAbiParameters(parseAbiParameters('bytes32'), [
        padHex(salt, { dir: 'right', size: 32 }),
      ]),
    )

    const bytecode = encodePacked(['bytes'], [SafeModuleJson.bytecode.object as Hex])

    return getContractAddress({ opcode: 'CREATE2', from, salt, bytecode })
  }
}
