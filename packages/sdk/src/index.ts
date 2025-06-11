// Main SDK exports

// Export UniversalDeposits
export { UniversalDeposits } from './core/universalDeposit'

// Export QuoteService (Renamed BridgeAggregator for clarity)
export { QuoteService } from './quote/service'

// Export bridge implementations
export { BaseBridge, LiFiBridge, DeBridgeBridge, RelayBridge } from './quote/bridges'

// Export types
export type { QuoteRequest, QuoteResponse, BridgeConfig } from './types'

// Export order ID types
export type { OrderIdParams, OrderIdResult } from './core/universalDeposit'

import { BridgeConfig } from './types'

// Define a default configuration object that can be used by consumers
export const defaultBridgeConfigs: BridgeConfig[] = [
  {
    name: 'lifi',
    enabled: true,
    timeout: 10000,
  },
  {
    name: 'debridge',
    enabled: true,
    timeout: 10000,
  },
  {
    name: 'relay',
    enabled: true,
    timeout: 10000,
  },
]
