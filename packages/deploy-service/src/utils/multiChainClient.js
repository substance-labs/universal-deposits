import { createWalletClient, createPublicClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import * as chains from 'viem/chains'
import { allowListToken } from './constants.js'
import dotenv from 'dotenv'
dotenv.config()

// Create a map of chain IDs to chain objects
const chainMap = Object.values(chains).reduce((acc, chain) => {
  acc[chain.id] = chain
  return acc
}, {})

class MultiChainClient {
  constructor() {
    this.walletClients = {}
    this.publicClients = {}
    this.supportedChainIds = []
  }

  /**
   * Initialize clients for all supported chains
   * @param {string} privateKey - The private key to use for wallet clients
   * @returns {Object} - Object containing wallet and public clients for each chain
   */
  async initialize(privateKey) {
    // Get all chain IDs from allowListToken
    this.supportedChainIds = Object.keys(allowListToken).map(Number)
    console.log(`Initializing clients for chains: ${this.supportedChainIds.join(', ')}`)

    if (!privateKey && process.env.PRIVATE_KEY) {
      privateKey = process.env.PRIVATE_KEY
    }

    if (!privateKey) {
      throw new Error('Private key is required for wallet clients')
    }

    const account = privateKeyToAccount(privateKey)
    console.log(`Using account: ${account.address}`)

    // Initialize clients for each chain
    for (const chainId of this.supportedChainIds) {
      // Get the chain object from the map
      const chain = chainMap[chainId]

      if (!chain) {
        console.warn(`Chain with ID ${chainId} not found in viem chains, skipping`)
        continue
      }

      // Check for RPC URL in environment variables
      const rpcEnvVar = `URL_${chainId}`
      let rpcUrl

      if (process.env[rpcEnvVar]) {
        rpcUrl = process.env[rpcEnvVar]
      } else {
        // Default RPC URL based on chain
        console.warn(
          `No RPC URL found for chain ${chainId} in environment (${rpcEnvVar}), using default`,
        )

        // Use a default based on the chain
        switch (chainId) {
          case 10: // Optimism
            rpcUrl = process.env.URL_10 || 'https://mainnet.optimism.io'
            break
          case 137: // Polygon
            rpcUrl = process.env.URL_137 || 'https://polygon-rpc.com'
            break
          case 8453: // Base
            rpcUrl = process.env.URL_8453 || ''
            break
          case 42161: // Arbitrum
            rpcUrl = process.env.URL_42161 || 'https://arb1.arbitrum.io/rpc'
            break
          case 11155111: // Sepolia
            rpcUrl = process.env.URL_11155111 || ''
            break
          case 10200: // Chiado
            rpcUrl = process.env.URL_10200 || 'https://rpc.chiadochain.net'
            break
          case 100:
            rpcUrl = 'https://rpc.gnosischain.com'
            break
          default:
            console.warn(`No default RPC URL for chain ${chainId}`)
            rpcUrl = process.env[`URL_${chainId}`]
        }
      }

      try {
        this.walletClients[chainId] = createWalletClient({
          account,
          chain,
          transport: http(rpcUrl),
        })

        this.publicClients[chainId] = createPublicClient({
          chain,
          transport: http(rpcUrl),
        })

        console.log(`Initialized clients for chain ${chainId} (${chain.name}) using RPC: ${rpcUrl}`)
      } catch (error) {
        console.error(`Error initializing clients for chain ${chainId}:`, error)
      }
    }

    return {
      walletClients: this.walletClients,
      publicClients: this.publicClients,
      supportedChainIds: this.supportedChainIds,
    }
  }

  /**
   * Get wallet client for a specific chain
   * @param {number} chainId - The chain ID
   * @returns {Object} - The wallet client for the specified chain
   */
  getWalletClient(chainId) {
    if (!this.walletClients[chainId]) {
      throw new Error(`Wallet client for chain ${chainId} not initialized`)
    }
    return this.walletClients[chainId]
  }

  /**
   * Get public client for a specific chain
   * @param {number} chainId - The chain ID
   * @returns {Object} - The public client for the specified chain
   */
  getPublicClient(chainId) {
    if (!this.publicClients[chainId]) {
      throw new Error(`Public client for chain ${chainId} not initialized`)
    }
    return this.publicClients[chainId]
  }

  /**
   * Get all wallet clients as an array
   * @returns {Array} - Array of wallet clients
   */
  getWalletClientsArray() {
    return Object.values(this.walletClients)
  }

  /**
   * Get all public clients as an array
   * @returns {Array} - Array of public clients
   */
  getPublicClientsArray() {
    return Object.values(this.publicClients)
  }

  /**
   * Check if a chain is supported
   * @param {number} chainId - The chain ID to check
   * @returns {boolean} - Whether the chain is supported
   */
  isChainSupported(chainId) {
    return this.supportedChainIds.includes(Number(chainId)) && !!this.walletClients[chainId]
  }

  /**
   * Get all supported chain IDs
   * @returns {Array} - Array of supported chain IDs
   */
  getSupportedChainIds() {
    return this.supportedChainIds
  }
}

// Create a singleton instance
const multiChainClient = new MultiChainClient()

export { multiChainClient }
