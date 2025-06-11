# Universal Deposits SDK

The Universal Deposits SDK provides a modular, flexible, and type-safe interface for creating cross-chain deposits and managing bridge quotes. It allows dApps to easily integrate with multiple bridges and provide the best rates for cross-chain token transfers.

## Installation

```bash
npm install @universal-deposits/sdk
```

## Features

- Universal Deposit address generation
- Multi-bridge quote aggregation

### Key Components

1. **Core Layer**: Implements Universal Deposits functionality

   - Safe address generation
   - Contract deployment calculations
   - Transaction monitoring

2. **Bridge Abstraction Layer**: Provides a consistent interface across bridges

   - Abstract base class for all bridge implementations
   - Standardized error handling and response normalization

3. **Quote Service**: Aggregates quotes from multiple bridges
   - Compares quotes based on return amount and execution time
   - Selects optimal route for transfers

## Usage Examples

### Basic Usage - Universal Deposit Address

```typescript
import { UniversalDeposits } from '@universal-deposits/sdk'

// Create a Universal Deposits instance
const ud = new UniversalDeposits({
  destinationAddress: '0x1234...', // Recipient address
  destinationToken: '0xabcd...', // Token on destination chain
  destinationChain: '100', // Destination chain ID (Gnosis)
})

// Get the Universal Deposit Safe address
const safeAddress = ud.getUDSafeParams().contractAddress
console.log(`Send tokens to: ${safeAddress}`)
```

### Quote Aggregation

```typescript
import { QuoteService, defaultBridgeConfigs } from '@universal-deposits/sdk'

// Create a quote service with all bridges enabled
const quoteService = new QuoteService(defaultBridgeConfigs)

// Request quotes
const quotes = await quoteService.getAllQuotes({
  fromChain: 8453, // Base
  toChain: 100, // Gnosis
  fromToken: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // USDC on Base
  toToken: '0xcB444e90D8198415266c6a2724b7900fb12FC56E', // EURe on Gnosis
  fromAmount: '1000000', // 1 USDC (6 decimals)
  fromAddress: '0x1234...', // User's wallet address
  toAddress: '0x1234...', // Recipient address
  slippage: 0.5, // 0.5% slippage tolerance
})

// Get the best quote
const bestQuote = await quoteService.getBestQuote({
  fromChain: 8453,
  toChain: 100,
  fromToken: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
  toToken: '0xcB444e90D8198415266c6a2724b7900fb12FC56E',
  fromAmount: '1000000',
  slippage: 0.5,
})

console.log(`Best quote from ${bestQuote.service}: ${bestQuote.expectedReturnAmount} EURe`)
```
