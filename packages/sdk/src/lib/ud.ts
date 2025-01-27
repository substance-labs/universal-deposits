import viem from 'viem'

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



}
