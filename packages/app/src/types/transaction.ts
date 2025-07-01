export interface Transaction {
  id: string
  txHash: string
  destinationAddress: string
  destinationChain: string
  destinationToken: string
  sourceChain: string
  sourceToken: string
  amount: string
  status: 'Deposited' | 'Registered' | 'Deploying' | 'Deployed' | 'Settling' | 'Settled' | 'Verifying' | 'Completed' | 'Failed'
  statusMessage?: string
  createdAt: number
  details: {
    sourceChainName: string
    sourceTokenSymbol: string
    destinationTokenSymbol: string
    toAddress: string
  }
}