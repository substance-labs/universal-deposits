import { BaseBridge, LiFiBridge, DeBridgeBridge, RelayBridge } from '../bridges'
import { QuoteRequest, QuoteResponse, BridgeConfig } from '../../types'

export class QuoteService {
  private bridges: Map<string, BaseBridge> = new Map()

  constructor(configs: BridgeConfig[]) {
    this.initializeBridges(configs)
  }

  private initializeBridges(configs: BridgeConfig[]) {
    configs.forEach((config) => {
      if (!config.enabled) return

      let bridge: BaseBridge

      switch (config.name.toLowerCase()) {
        case 'lifi':
          bridge = new LiFiBridge(config)
          break
        case 'debridge':
          bridge = new DeBridgeBridge(config)
          break
        case 'relay':
          bridge = new RelayBridge(config)
          break
        default:
          console.warn(`Bridge: ${config.name} is not supported`)
          return
      }

      this.bridges.set(config.name.toLowerCase(), bridge)
    })
  }

  async getQuote(request: QuoteRequest, service?: string): Promise<QuoteResponse> {
    if (service) {
      const bridge = this.bridges.get(service.toLowerCase())
      if (!bridge) {
        throw new Error(`Bridge service '${service}' not found or not enabled`)
      }
      return await bridge.getQuote(request)
    }

    // If no specific service requested, get the best quote
    let bestQuote = await this.getBestQuote(request)
    if (bestQuote.service == 'lifi') {
      // check if the service from lifi is relay, if supported, quote relay directly
      // TODO:
    }
    return bestQuote
  }

  async getAllQuotes(request: QuoteRequest): Promise<QuoteResponse[]> {
    const promises = Array.from(this.bridges.values()).map(async (bridge) => {
      try {
        return await bridge.getQuote(request)
      } catch (error: any) {
        console.error(`Error getting quote from ${bridge.getName()}:`, error.message)
        return null
      }
    })

    const results = await Promise.allSettled(promises)
    return results
      .filter(
        (result): result is PromiseFulfilledResult<QuoteResponse> =>
          result.status === 'fulfilled' && result.value !== null,
      )
      .map((result) => result.value)
  }

  async getBestQuote(request: QuoteRequest): Promise<QuoteResponse> {
    // Same transaction from Base USDC -> Gnosis EURe, the expected return amount is the same, but Lifi has more gas, Relay doesn't require approval, but only transfer()
    // Relay: https://www.tdly.co/shared/simulation/8f45fb3a-e79a-435b-98a1-b3cd4ea2146e
    // LiFi: https://www.tdly.co/shared/simulation/b169c24d-ec16-4180-a789-0b24c4c62566

    const quotes = await this.getAllQuotes(request)

    if (quotes.length === 0) {
      throw new Error('No quotes available from any bridge service')
    } else {
      console.log('\nFound', quotes.length, 'quotes:')
      console.log('-----------------------------------------------------------')

      quotes.forEach((quote, index) => {
        console.log(`Quote ${index + 1} from ${quote.service}:`)
        console.log('  Transaction Details:')
        console.log(`    To Address: ${quote.to}`)
        console.log(`    Value: ${quote.value}`)
        console.log(`    Data: ${quote.data}...`)
        console.log('  Return Details:')
        console.log(`    Expected Return Amount: ${quote.expectedReturnAmount}`)
        console.log(`    Estimated Gas: ${quote.estimatedGas || 'N/A'}`)
        console.log(`    Execution Time: ${quote.executionTime || 'N/A'} seconds`)
        if (quote.fees) {
          console.log('  Fees:')
          console.log(`    Gas Price: ${quote.fees.gasPrice || 'N/A'}`)
          console.log(`    Bridge Fee: ${quote.fees.bridgeFee || 'N/A'}`)
          console.log(`    Protocol Fee: ${quote.fees.protocolFee || 'N/A'}`)
        }
        if (quote.approvalAddress) {
          console.log(`  Approval Address: ${quote.approvalAddress}`)
        }
        console.log('-----------------------------------------------------------')
      })
    }

    // Sort by expected return amount (descending) and execution time (ascending)
    quotes.sort((a, b) => {
      const amountDiff = parseFloat(b.expectedReturnAmount) - parseFloat(a.expectedReturnAmount)
      if (Math.abs(amountDiff) < 0.01) {
        // If amounts are very close, prefer faster execution
        return (a.executionTime || 0) - (b.executionTime || 0)
      }
      return amountDiff
    })

    console.log(
      `\nSelected best quote from ${quotes[0].service} with return amount: ${quotes[0].expectedReturnAmount}`,
    )

    return quotes[0]
  }

  getAvailableServices(): string[] {
    return Array.from(this.bridges.keys())
  }
}
