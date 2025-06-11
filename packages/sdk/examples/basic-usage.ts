// Example showing how to use both UniversalDeposits and QuoteService

import { UniversalDeposits, QuoteService, QuoteRequest, defaultBridgeConfigs } from '../src/index'

async function main() {
  console.log('Universal Deposits SDK Example')
  console.log('----------------------------------')

  // 1. Using UniversalDeposits
  console.log('\n1. Using UniversalDeposits:')

  const universalDeposits = new UniversalDeposits({
    destinationAddress: '0xCEf67989ae740cC9c92fa7385F003F84EAAFd915',
    destinationToken: '0xcB444e90D8198415266c6a2724b7900fb12FC56E', // EURE on Gnosis
    destinationChain: '100', // Gnosis Chain
  })

  // Get the Universal Deposits Safe address
  const safeAddress = universalDeposits.getUDSafeParams().contractAddress
  console.log(`Universal Deposits Safe Address: ${safeAddress}`)

  // Get the Safe Module Proxy address
  const moduleProxyAddress = universalDeposits.getSafeModuleProxyParams().contractAddress
  console.log(`Safe Module Proxy Address: ${moduleProxyAddress}`)

  // Get the Safe Module Logic address
  const moduleLogicAddress = universalDeposits.getSafeModuleLogicParams().contractAddress
  console.log(`Safe Module Logic Address: ${moduleLogicAddress}`)

  // 2. Using QuoteService
  console.log('\n2. Using QuoteService:')

  // Create a QuoteService instance with the default bridge configs
  const quoteService = new QuoteService(defaultBridgeConfigs)

  // List available bridge services
  const availableServices = quoteService.getAvailableServices()
  console.log(`Available bridge services: ${availableServices.join(', ')}`)

  // Create a quote request
  const quoteRequest: QuoteRequest = {
    fromChain: 8453, // Base
    toChain: 100, // Gnosis Chain
    fromToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
    toToken: '0xcB444e90D8198415266c6a2724b7900fb12FC56E', // EURe on Gnosis
    fromAmount: '10000000', // 0.01 ETH in wei
    fromAddress: '0xCEf67989ae740cC9c92fa7385F003F84EAAFd915', // Sample address
    slippage: 0.5, // 0.5%
  }

  try {
    // Get a quote from a specific service
    console.log('\nGetting quote from LiFi:')
    const lifiQuote = await quoteService.getQuote(quoteRequest, 'lifi')
    console.log(`Expected return amount: ${lifiQuote.expectedReturnAmount}`)

    // Get the best quote across all enabled services
    console.log('\nGetting best quote:')
    const bestQuote = await quoteService.getBestQuote(quoteRequest)
    console.log(`Best quote from: ${bestQuote.service}`)
    console.log(`Expected return amount: ${bestQuote.expectedReturnAmount}`)
  } catch (error) {
    console.error('Error getting quotes:', error)
  }
}

// Run the example
main().catch((error) => {
  console.error('Example failed:', error)
})
