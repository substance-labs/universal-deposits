export interface QuoteRequest {
  fromChain: number
  toChain: number
  fromToken: string
  toToken: string
  fromAmount: string
  fromAddress?: string
  toAddress?: string
  slippage?: number
}

export interface QuoteResponse {
  service: string
  to: string
  data: string
  value: string
  expectedReturnAmount: string
  estimatedGas?: string
  fees?: {
    gasPrice?: string
    bridgeFee?: string
    protocolFee?: string
  }
  executionTime?: number // in seconds
  priceImpact?: number
  slippage?: number
  approvalAddress?: string // approval Address for the token on source chain
  isApprovedRequired: boolean
}

export interface BridgeConfig {
  name: string
  enabled: boolean
  apiKey?: string
  baseUrl?: string
  timeout?: number
}

export type deBridgeEstimationResponse = {
  estimation: {
    srcChainTokenIn: {
      address: string
      chainId: number
      decimals: number
      name: string
      symbol: string
      amount: string
      approximateOperatingExpense: string
      mutatedWithOperatingExpense: boolean
      approximateUsdValue: number
      originApproximateUsdValue: number
    }
    dstChainTokenOut: {
      address: string
      chainId: number
      decimals: number
      name: string
      symbol: string
      amount: string
      recommendedAmount: string
      maxTheoreticalAmount: string
      approximateUsdValue: number
      recommendedApproximateUsdValue: number
      maxTheoreticalApproximateUsdValue: number
    }
    costsDetails: {
      chain: string
      tokenIn: string
      tokenOut: string
      amountIn: string
      amountOut: string
      type:
        | 'DlnProtocolFee'
        | 'TakerMargin'
        | 'EstimatedOperatingExpenses'
        | 'AfterSwap'
        | 'AfterSwapEstimatedSlippage'
      payload:
        | {
            feeAmount: string
            feeBps: string
            feeApproximateUsdValue: string
          }
        | {
            feeAmount: string
            feeBps: string
          }
        | {
            feeAmount: string
          }
        | {
            amountOutBeforeCorrection: string
          }
        | {
            feeAmount: string
            feeBps: string
            estimatedVolatilityBps: string
          }
    }[]
    recommendedSlippage: number
  }
  tx: {
    data: string
    to: string
    value: string
  }
  order: {
    approximateFulfillmentDelay: number
    salt: number
    metadata: string
  }
  orderId: string
  fixFee: string
  userPoints: number
  integratorPoints: number
}

type TokenInfo = {
  address: string
  chainId: number
  symbol: string
  decimals: number
  name: string
  coinKey: string
  logoURI: string
  priceUSD: string
}

type FeeCost = {
  name: string
  description: string
  token: TokenInfo
  amount: string
  amountUSD: string
  percentage: string
  included: boolean
}

type GasCost = {
  type: string
  price: string
  estimate: string
  limit: string
  amount: string
  amountUSD: string
  token: TokenInfo
}

type Estimate = {
  tool: string
  approvalAddress: string
  toAmountMin: string
  toAmount: string
  fromAmount: string
  feeCosts: FeeCost[]
  gasCosts: GasCost[]
  executionDuration: number
  fromAmountUSD: string
  toAmountUSD: string
}

type Action = {
  fromToken: TokenInfo
  fromAmount: string
  toToken: TokenInfo
  fromChainId: number
  toChainId: number
  slippage: number
  fromAddress: string
  toAddress: string
  destinationGasConsumption?: string // optional for top-level action
}

type IncludedStep = {
  id: string
  type: string
  action: Action
  estimate: Estimate
}

type ToolDetails = {
  key: string
  name: string
  logoURI: string
}

type transactionRequest = {
  value: string
  to: string
  data: string
  from: string
  chainId: number
  gasPrice: string
  gasLimit: string
}
export type LifiAxiosResponse = {
  type: string
  id: string
  tool: string
  toolDetails: ToolDetails
  action: Action
  estimate: Estimate
  includedSteps: IncludedStep[]
  transactionRequest: transactionRequest
}

type relayDetails = {
  operation: string
  sender: string
  recipient: string
  currencyIn: object
}

export type RelayRequest = {
  user: string
  originChainId: number
  destinationChainId: number
  originCurrency: string
  destinationCurrency: string
  amount: string
  tradeType: 'EXACT_INPUT' | 'EXACT_OUTPUT' | 'EXPECTED_OUTPUT'
  recipient?: string
  txs?: Array<Record<string, any>>
  txsGasLimit?: number
  referrer?: string
  referrerAddress?: string
  refundTo?: string
  refundOnOrigin?: boolean
  topupGas?: boolean
  useReceiver?: boolean
  useProtocol?: boolean
  useExternalLiquidity?: boolean
  usePermit?: boolean
  useDepositAddress?: boolean
  slippageTolerance?: string
  appFees?: Array<Record<string, any>>
  gasLimitForDepositSpecifiedTxs?: number
  userOperationGasOverhead?: number
  forceSolverExecution?: boolean
  includedSwapSources?: string[]
  excludedSwapSources?: string[]
}

export interface RelayAxiosResponse {
  steps: Array<{
    id: string
    action: string
    description: string
    kind: string
    requestId: string
    items: Array<{
      status: string
      data: {
        from: string
        to: string
        data: string
        value: string
        maxFeePerGas: string
        maxPriorityFeePerGas: string
        chainId: number
      }
      check: {
        endpoint: string
        method: string
      }
    }>
  }>
  fees: Record<string, any>
  details: {
    operation: string
    sender: string
    recipient: string
    currencyIn: CurrencyDetail
    currencyOut: CurrencyDetail
    currencyGasTopup?: CurrencyDetail
    totalImpact?: Record<string, any>
    swapImpact?: Record<string, any>
    rate: string
    slippageTolerance: {
      origin?: Record<string, any>
      destination?: {
        usd: string
        value: string
        percent: string
      }
    }
    timeEstimate: number
    userBalance: string
  }
}

interface CurrencyDetail {
  currency: {
    chainId: number
    address: string
    symbol: string
    name: string
    decimals: number
    metadata: {
      logoURI: string
      verified: boolean
      isNative: boolean
    }
  }
  amount: string
  amountFormatted: string
  amountUsd: string
  minimumAmount: string
}
