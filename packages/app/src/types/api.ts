export interface Order {
  orderId: string
  orderIdHash: string
  sourceChainId: number
  destinationChainId: number
  recipientAddress: string
  udAddress: string
  sourceToken: string
  destinationToken: string
  status: OrderStatus
  createdAt: string
  updatedAt: string
  deployedAt?: string
  settledAt?: string
  completedAt?: string
  verificationStartedAt?: string
  verificationEndedAt?: string
  lastError?: string
  retryCount: number
  deploymentDetails?: DeploymentDetails
  settleUrl?: string
  settleOption?: string
  initialDestinationBalance?: string
  finalDestinationBalance?: string
  balanceIncrease?: string
}

export type OrderStatus = 
  | 'Registered'
  | 'Deploying'
  | 'Deployed'
  | 'Settling'
  | 'Settled'
  | 'Verifying'
  | 'Completed'
  | 'DeploymentFailed'
  | 'SettlementFailed'
  | 'VerificationFailed'
  | 'VerificationTimeout'

export interface DeploymentDetails {
  safeModuleLogic: string
  safeModuleProxy: string
  universalSafe: string
}

export interface Quote {
  amount: string
  estimatedTime: number
  bridgeProvider: string
  fee: string
  route: QuoteRoute[]
}

export interface QuoteRoute {
  chainId: number
  tokenAddress: string
  amount: string
}

export interface TokenBalance {
  chainId: number
  tokenAddress: string
  symbol: string
  name: string
  balance: string
  decimals: number
  logoURI?: string
}

export interface UDSafeParams {
  destinationAddress: string
  destinationToken: string
  destinationChain: string
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}