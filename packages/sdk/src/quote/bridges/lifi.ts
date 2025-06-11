import { BaseBridge } from './base'
import { QuoteRequest, QuoteResponse, LifiAxiosResponse } from '../../types'

export class LiFiBridge extends BaseBridge {
  getName(): string {
    return 'lifi'
  }

  isApprovalRequired(): boolean {
    return true
  }

  async getQuote(request: QuoteRequest): Promise<any> {
    const quoteRequest: any = {
      fromChain: request.fromChain,
      toChain: request.toChain,
      fromToken: request.fromToken,
      toToken: request.toToken,
      fromAmount: request.fromAmount,
      fromAddress: request.fromAddress,
      toAddress: request.toAddress || request.fromAddress,
      slippage: request.slippage || 0.1,
    }

    try {
      const paramsString = new URLSearchParams(quoteRequest)
      const url = `https://li.quest/v1/quote?${paramsString.toString()}`
      console.log('lifi quote url: ', url)
      const response: LifiAxiosResponse = await this.makeRequest<any>('https://li.quest/v1/quote', {
        method: 'GET',
        params: quoteRequest,
      })

      return {
        service: this.getName(),
        to: response.transactionRequest?.to || '',
        data: response.transactionRequest?.data || '0x',
        value: response.transactionRequest?.value || '0',
        expectedReturnAmount: response.estimate?.toAmount || '0',
        estimatedGas: response.estimate?.gasCosts?.[0]?.estimate,
        executionTime: response.estimate?.executionDuration,
        approvalAddress: response.estimate?.approvalAddress,
        isApprovedRequired: this.isApprovalRequired(),
      }
    } catch (error: any) {
      throw new Error(`LiFi quote failed: ${error.message}`)
    }
  }
}

//  Example response from LiFi

// response: {
//     type: 'lifi',
//     id: '57fb454e-8dce-4044-8a67-a7eba0f972e6:0',
//     tool: 'symbiosis',
//     toolDetails: {
//       key: 'symbiosis',
//       name: 'Symbiosis',
//       logoURI: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/bridges/symbiosis.svg'
//     },
//     action: {
//       fromToken: [Object],
//       fromAmount: '10000000000000000',
//       toToken: [Object],
//       fromChainId: 8453,
//       toChainId: 100,
//       slippage: 0.1,
//       fromAddress: '0xCEf67989ae740cC9c92fa7385F003F84EAAFd915',
//       toAddress: '0xCEf67989ae740cC9c92fa7385F003F84EAAFd915'
//     },
//     estimate: {
//       tool: 'symbiosis',
//       approvalAddress: '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE',
//       toAmountMin: '19305880942619502544',
//       toAmount: '21450978825132780605',
//       fromAmount: '10000000000000000',
//       feeCosts: [Array],
//       gasCosts: [Array],
//       executionDuration: 45,
//       fromAmountUSD: '25.3859',
//       toAmountUSD: '24.3341'
//     },
//     includedSteps: [ [Object] ],
//     integrator: 'lifi-api',
//     transactionRequest: {
//       value: '0x2386f26fc10000',
//       to: '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE',
//       data: '0x'... 10554 more characters,
//       from: '0xCEf67989ae740cC9c92fa7385F003F84EAAFd915',
//       chainId: 8453,
//       gasPrice: '0x1d2f8f',
//       gasLimit: '0xfc8a0'
//     }
//   }
