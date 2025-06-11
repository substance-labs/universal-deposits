import { BaseBridge } from './base'
import { QuoteRequest, QuoteResponse, RelayAxiosResponse } from '../../types'

export class RelayBridge extends BaseBridge {
  getName(): string {
    return 'relaybridge'
  }

  isApprovalRequired(): boolean {
    // relay bridge doesn't require a 'approve' call in the SafeModule contract on the source token
    return false
  }
  async getQuote(request: QuoteRequest): Promise<any> {
    // export interface QuoteRequest {
    //     fromChain: number;
    //     toChain: number;
    //     fromToken: string;
    //     toToken: string;
    //     fromAmount: string | bigint;
    //     fromAddress?: string;
    //     toAddress?: string;
    //     slippage?: number;
    //   }

    const quoteRequest: any = {
      user: request.fromAddress,
      recipient: request.toAddress ? request.toAddress : request.fromAddress,
      originChainId: request.fromChain,
      destinationChainId: request.toChain,
      originCurrency: request.fromToken,
      destinationCurrency: request.toToken,
      amount: request.fromAmount.toString(), // convert bigint to string
      tradeType: 'EXACT_INPUT',
    }

    const paramString = new URLSearchParams(quoteRequest)
    // URL is not working because it uses POST
    const url = `https://api.relay.link/quote?useReceiver=true&${paramString.toString()}`

    const response: RelayAxiosResponse = await this.makeRequest<any>(
      'https://api.relay.link/quote',
      {
        method: 'POST',
        data: quoteRequest,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
    console.log('response from relay', response.steps[0].items[0].data)

    return {
      service: this.getName(),
      to: response.steps[0].items[0].data.to || '',
      data: response.steps[0].items[0].data.data || '',
      value: response.steps[0].items[0].data.value || '0',
      expectedReturnAmount: response.details.currencyOut.amount, // convert to decimals
      estimatedGas:
        response.steps[0].items[0].data.maxFeePerGas +
          response.steps[0].items[0].data.maxPriorityFeePerGas || '', // TODO: fix the formula
      executionTime: response.details.timeEstimate, // in seconds
      approvalAddress: response.steps[0].items[0].data.to || '', // TODO: check if this is true
      isApprovedRequired: this.isApprovalRequired(),
    }
  }
}
