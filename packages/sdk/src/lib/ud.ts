import viem from 'viem'
import {c} from '@universal-deposits/contracts'

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

  getSSLogicAddress() {

  }
}
