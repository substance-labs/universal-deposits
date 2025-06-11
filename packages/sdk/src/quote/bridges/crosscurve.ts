import { BaseBridge } from './base'
import { QuoteRequest, QuoteResponse } from '../../types'

// Define types based on the API documentation
interface CrossCurveRoutingParams {
  params: {
    chainIdIn: number
    chainIdOut: number
    tokenIn: string
    tokenOut: string
    amountIn: string
  }
  slippage: number
}

interface CrossCurveRoute {
  query: CrossCurveRoutingParams
  route: any[]
  amountIn: string
  amountOut: string
  amountOutWithoutSlippage: string
  tokenInPrice: number
  tokenOutPrice: number
  priceImpact: number
  totalFee: {
    type: string
    percent: string
    amount: number
  }
}

interface CrossCurveEstimate {
  priceInDollars: string
  executionPrice: string
  stablePrice: string
  workerFee: string
  deadline: string
  signature: string
}

interface CrossCurveTxCreateParams {
  from: string
  recipient: string
  routing: CrossCurveRoute
  estimate: CrossCurveEstimate
}

interface CrossCurveTxResponse {
  to: string
  abi: string
  args: any[]
  value: string
}

export class CrossCurveBridge extends BaseBridge {
  getName(): string {
    return 'crosscurve'
  }

  isApprovalRequired(): boolean {
    // Based on the documentation, it seems approval might be required for ERC20 tokens
    return true
  }

  async getQuote(request: QuoteRequest): Promise<any> {
    console.log('CrossCurve getQuote called')

    try {
      // Step 1: Routing construction
      const routing = await this.getRouting(request)
      if (!routing || routing.length === 0) {
        throw new Error('No routes found')
      }

      // Take the best route (first one)
      const bestRoute = routing[0]

      // Step 2: Making a route estimate
      const estimate = await this.getEstimate(bestRoute)

      // Step 3: Forming data for sending the transaction
      const txData = await this.createTransaction({
        from: request.fromAddress || '',
        recipient: request.toAddress || request.fromAddress || '',
        routing: bestRoute,
        estimate: estimate,
      })

      return {
        service: this.getName(),
        to: txData.to,
        data: this.encodeTransactionData(txData),
        value: this.calculateTotalValue(txData.value, estimate.executionPrice),
        expectedReturnAmount: bestRoute.amountOut,
        estimatedGas: '500000', // You may want to estimate this more accurately
        executionTime: 300, // Estimated time in seconds (5 minutes for cross-chain)
        approvalAddress: txData.to,
        isApprovedRequired: this.isApprovalRequired(),
        // Additional CrossCurve specific data
        crossCurveData: {
          routing: bestRoute,
          estimate: estimate,
          txData: txData,
        },
      }
    } catch (error) {
      console.error('CrossCurve getQuote error:', error)
      throw error
    }
  }

  private async getRouting(request: QuoteRequest): Promise<CrossCurveRoute[]> {
    const requestRoutingParams: CrossCurveRoutingParams = {
      params: {
        chainIdIn: request.fromChain,
        chainIdOut: request.toChain,
        tokenIn: request.fromToken,
        tokenOut: request.toToken,
        amountIn: request.fromAmount,
      },
      slippage: request.slippage || 1, // Default 1% slippage
    }

    const response = await this.makeRequest<CrossCurveRoute[]>(
      'https://api.crosscurve.fi/routing/scan',
      {
        method: 'POST',
        data: requestRoutingParams,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )

    return response
  }

  private async getEstimate(route: CrossCurveRoute): Promise<CrossCurveEstimate> {
    const response = await this.makeRequest<CrossCurveEstimate>(
      'https://api.crosscurve.fi/estimate',
      {
        method: 'POST',
        data: route,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )

    return response
  }

  private async createTransaction(params: CrossCurveTxCreateParams): Promise<CrossCurveTxResponse> {
    const response = await this.makeRequest<CrossCurveTxResponse>(
      'https://api.crosscurve.fi/tx/create',
      {
        method: 'POST',
        data: params,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )

    return response
  }

  private encodeTransactionData(txData: CrossCurveTxResponse): string {
    // The transaction data is complex with multiple arguments
    // For now, we'll return a placeholder. You might need to use ethers.js or web3.js
    // to properly encode the function call with the ABI and arguments

    // Example implementation (you'll need to adapt this based on your encoding needs):
    // const iface = new ethers.utils.Interface([txData.abi]);
    // return iface.encodeFunctionData('start', txData.args);

    // For now, return empty data - you'll need to implement proper ABI encoding
    return '0x'
  }

  private calculateTotalValue(baseValue: string, executionPrice: string): string {
    // According to the documentation: value = BigInt(rawTx.value) + BigInt(estimate.executionPrice)
    const base = BigInt(baseValue || '0')
    const execution = BigInt(executionPrice || '0')
    return (base + execution).toString()
  }

  // Method to track cross-chain swap by transaction hash
  async trackSwapByHash(txHash: string): Promise<any> {
    const searchParams = new URLSearchParams({
      search: txHash,
      limit: '1',
    })

    const response = await this.makeRequest<any>(
      `https://api.crosscurve.fi/search?${searchParams.toString()}`,
      {
        method: 'GET',
      },
    )

    return response
  }

  // Method to track cross-chain swap by requestId
  async trackSwapByRequestId(requestId: string): Promise<any> {
    const response = await this.makeRequest<any>(
      `https://api.crosscurve.fi/transaction/${requestId}`,
      {
        method: 'GET',
      },
    )

    return response
  }

  // Method to get requestId from transaction hash
  async getRequestIdFromHash(txHash: string): Promise<string | null> {
    try {
      const result = await this.trackSwapByHash(txHash)
      if (result.result && result.result.length > 0) {
        return result.result[0].requestId
      }
      return null
    } catch (error) {
      console.error('Error getting requestId from hash:', error)
      return null
    }
  }
}
