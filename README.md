# Universal Deposits

## Overview

Universal Deposits creates deterministic safe addresses that can receive tokens from any supported chain. When tokens are deposited, the system can automatically:

1. Forward the tokens to a destination address on the same chain
2. Swap the tokens to a different token on the same chain (via CoW Protocol)
3. Bridge the tokens to a different chain

## Architecture

The project consists of four main packages:

### @universal-deposits/contracts (evm)

Contains the Solidity smart contracts that power the Universal Deposits system:

- **SafeModule.sol**: Core contract that handles:
  - Token transfers (same token, same chain)
  - Token swaps via CoW Protocol (different token, same chain)
  - Cross-chain transfers (any token, different chain)
- Uses CREATE2 for deterministic contract deployment for Safe Proxy address (Universal address)
- Integrates with Safe smart accounts
- Implements UUPS proxy pattern for upgradeability

### @universal-deposits/sdk

TypeScript library for interacting with the Universal Deposits system:

- Address derivation (calculating deterministic addresses)
- Quote query and aggregation
- Integration with viem for blockchain interactions

### @universal-deposits/deploy-service

Service that monitors and manages Universal Deposits:

- Monitors token balances in Universal Deposit safes
- Automatically deploys contracts when needed (Safe Module Proxy & Logic, Safe Proxy)
- Executes settlements when tokens are detected
- Detects the settlement status on destination chain

### @universal-deposits/api

- API logic for app to interact with
- Allows users to registers UD address, get quote, get order

### @universal-deposits/app

Simple web application for user interaction:

- Allows users to register destination addresses
- Provides endpoints for submitting new destination addresses

## Workflow

```mermaid
graph TD
    User[User] -->|Deposits tokens| UDAddress[Universal Deposit Address]

    subgraph "Universal Deposits System"
        UDAddress -->|Funds detected| DeployService[Deploy Service]
        DeployService -->|Monitors balances| UDAddress
        DeployService -->|Deploys if needed| Contracts[Safe + SafeModule]
        DeployService -->|Triggers settlement| Settlement[Settlement Process]

        Settlement -->|Same chain, same token| DirectTransfer[Direct Transfer]
        Settlement -->|Same chain, different token| CoWSwap[CoW Protocol Swap]
        Settlement -->|Different chain| Bridge[Cross-Chain Bridge]

        DirectTransfer -->|Transfers tokens| Destination[Destination Address]
        CoWSwap -->|Swaps and transfers| Destination
        Bridge -->|Bridges and transfers| Destination
    end
```

## Component Interaction

### TODO: update

```mermaid

sequenceDiagram
    participant User
    participant App
    participant SDK
    participant DeployService
    participant SafeModule
    participant Safe
    participant CoWProtocol
    participant DLN

    User->>App: Register destination address
    App->>DeployService: Store destination address
    DeployService->>SDK: Compute UD safe address
    SDK->>DeployService: Return deterministic address

    User->>Safe: Deposit tokens

    DeployService->>Safe: Monitor balance
    DeployService->>SDK: Check if contracts deployed

    alt Contracts not deployed
        DeployService->>SafeModule: Deploy module logic
        DeployService->>SafeModule: Deploy proxy
        DeployService->>Safe: Deploy safe
    end

    DeployService->>SafeModule: Configure for token
    DeployService->>SafeModule: Trigger settlement

    alt Same chain, same token
        SafeModule->>Safe: Execute direct transfer
        Safe->>User: Receive tokens at destination
    else Same chain, different token
        SafeModule->>Safe: Create CoW order
        Safe->>CoWProtocol: Submit order
        CoWProtocol->>User: Receive swapped tokens
    else Different chain
        SafeModule->>Safe: Create DLN order
        Safe->>DLN: Submit cross-chain order
        DLN->>User: Receive tokens on destination chain
    end

```

## Implementation Details

- Uses CREATE2 for deterministic contract addresses
- Safe smart accounts for custody of funds
- UUPS proxy pattern for contract upgradeability
- Integrates with CoW Protocol for token swaps
- Integrates with DLN, LiFi, Relay for cross-chain transfers
- Written in TypeScript (SDK and services) and Solidity (contracts)

## How It Works for Users

Universal Deposits makes it simple for anyone to receive EURe on Gnosis Chain in their Gnosis Pay address, regardless of which blockchain they're coming from.

```mermaid
graph TD
    subgraph "What Users See"
        User1[User on Ethereum] -->|Deposits USDC| UD1[Universal Deposit Address]
        User2[User on Polygon] -->|Deposits USDC| UD2[Universal Deposit Address]
        User3[User on Optimism] -->|Deposits USDC| UD3[Universal Deposit Address]
        User4[User on Arbitrum] -->|Deposits USDC| UD4[Universal Deposit Address]

        UD1 & UD2 & UD3 & UD4 -->|Automatic conversion| GnosisPay[Gnosis Pay Address with EURe]
    end
```

### Example User Scenarios

#### Scenario 1: Arbitrum User

Alice has USDC on Arbitrum and wants to fund her Gnosis Pay account with EURe.

1. Alice gets her Universal Deposit address for her Gnosis Pay account
2. She sends USDC from her Arbitrum wallet to this address
3. The system automatically:
   - Detects her deposit
   - Bridges her USDC from Arbitrum to Gnosis Chain
   - Swaps it for EURe
   - Sends the EURe to her Gnosis Pay address

#### Scenario 2: Withdraw from CEX

Bob has USDC on Coinbase and wants to withdraw to Gnosis Chain with USDCe. Since Coinbase doesn't support withdrawing to Gnosis Chain at the moment, Bob could withdraw the USDC on his account to Base chain to the UD Safe address.

1. Bob specify the recipient address, and recipient token on Gnosis Chain.
2. Bob gets the UD Safe address.
3. Bob initiates withdrawal on Coinbase and paste the UD Safe address as `Withdraw to` address, and Base as the chain.
4. Once the withdrawal from Coinbase is completed, the system automatically:
   - Detects his deposit
   - Bridges his USDC from Base to Gnosis Chain
   - Swap USDC to USDCe
   - Sends USDCe to his recipient address

#### Scenario 2: Polygon User

Bob has USDC on Polygon and wants to fund his Gnosis Pay account with EURe.

1. Bob gets his Universal Deposit address for his Gnosis Pay account
2. He sends USDC from his Polygon wallet to this address
3. The system automatically:
   - Detects his deposit
   - Bridges his USDC from Polygon to Gnosis Chain
   - Swaps it for EURe
   - Sends the EURe to his Gnosis Pay address

#### Scenario 3: Gnosis Chain User

Chris has USDC.e on Gnosis Chain and wants to fund his Gnosis Pay account with EURe.

1. Chris gets his Universal Deposit address for his Gnosis Pay account
2. He sends USDC.e from his Gnosis Chain wallet to this address
3. The system automatically:
   - Detects his deposit
   - Swap his USDC.e to EURe using CowSwap
   - Sends the EURe to his Gnosis Pay address

### System Overview

```mermaid
graph TD
    subgraph "Source Chains"
        Ethereum[Ethereum]
        Polygon[Polygon]
        Optimism[Optimism]
        Arbitrum[Arbitrum]
        Other[Other EVM Chains...]
    end

    subgraph "Universal Deposits System"
        UDSafes[Universal Deposit Safes]
        DeployService[Deployment Service]
        Bridge[Cross-chain bridges]
        Swap[CoW Protocol]
    end

    subgraph "Destination"
        GnosisPay[Gnosis Pay on Gnosis Chain]
    end

    Ethereum & Polygon & Optimism & Arbitrum & Other -->|USDC Deposits| UDSafes
    UDSafes -->|Detected Deposits| DeployService
    DeployService -->|Cross-chain Transfer| Bridge
    Bridge -->|USDC.e on Gnosis Chain| Swap
    Swap -->|Swap USDC.e to EURe| GnosisPay

```

## Getting Started

### Prerequisites

- Node.js and Yarn
- Foundry for Solidity development
- Access to EVM-compatible blockchain nodes

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/universal-deposits.git
cd universal-deposits

# Install dependencies
yarn install

# Build the packages
yarn workspaces run build
```

### Running the Service

```bash
cd packages/deploy-service
cp .env.example .env
source .env
yarn start
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
