import { createClient } from 'redis'
import { createPublicClient, http, keccak256, encodePacked, erc20Abi } from 'viem'
import { allowListToken } from '../utils/constants.js'
import * as chains from 'viem/chains'
import { multiChainClient } from '../utils/multiChainClient.js'
import { UniversalDeposits } from '@universal-deposits/sdk'

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'
// TODO: fix
const DESTINATION_CHAIN_ID = 100
const DESTINATION_TOKEN = '0xcB444e90D8198415266c6a2724b7900fb12FC56E'

class BalanceWatcher {
  constructor(config = {}) {
    this.interval = config.interval || process.env.INTERVAL || 30000 // 30 seconds default
    this.redisSubscriber = createClient({ url: REDIS_URL })
    this.redisPublisher = createClient({ url: REDIS_URL })
    this.redisDatabaseClient = createClient({ url: REDIS_URL })
    this.publicClients = {}
    this.isRunning = false
    this.mongoInitialized = false
    this.redisQueueInitialized = false
    this.subscriberInitialized = false

    this.chainMap = Object.values(chains).reduce((acc, chain) => {
      acc[chain.id] = chain
      return acc
    }, {})
  }

  async initializeDatabases() {
    if (!this.mongoInitialized) {
      const { mongoDBClient } = await import('../utils/mongoClient.js')
      await mongoDBClient.connect()
      this.mongoInitialized = true
      console.log('MongoDB initialized for BalanceWatcher')
    }

    if (!this.redisQueueInitialized) {
      const { redisQueueManager } = await import('../utils/redisQueue.js')
      await redisQueueManager.connect()
      this.redisQueueInitialized = true
      console.log('Redis queue initialized for BalanceWatcher')
    }

    if (!this.subscriberInitialized) {
      await this.setupRedisSubscriber()
      this.subscriberInitialized = true
      console.log('Redis subscriber initialized for BalanceWatcher')
    }

    try {
      const privateKey = process.env.DEPLOYER_PRIVATE_KEY
      if (privateKey && !multiChainClient.supportedChainIds?.length) {
        console.log('Initializing multi-chain clients for balance watching...')
        await multiChainClient.initialize(privateKey)
        console.log(
          `Initialized balance watch clients for chains: ${multiChainClient.getSupportedChainIds().join(', ')}`,
        )
      }
    } catch (error) {
      console.warn('Failed to initialize multi-chain clients for balance watching:', error.message)
    }
  }

  // Set up Redis subscriber to listen for address changes
  async setupRedisSubscriber() {
    try {
      if (!this.redisSubscriber.isOpen) {
        console.log('Connecting Redis subscriber client...')

        this.redisSubscriber.on('error', err => {
          console.log('Redis Subscriber Error:', err)
          // Try to reconnect if connection is lost
          if (!this.redisSubscriber.isOpen && this.subscriberInitialized) {
            console.log('Redis subscriber disconnected, attempting to reconnect...')
            this.subscriberInitialized = false
            setTimeout(() => this.setupRedisSubscriber(), 5000)
          }
        })

        // Set up reconnect handler
        this.redisSubscriber.on('reconnect', () => {
          console.log('Redis subscriber reconnected, reestablishing subscriptions...')
          this.setupSubscriptions()
        })

        await this.redisSubscriber.connect()
      }

      await this.setupSubscriptions()

      console.log('Successfully set up Redis subscriber')
    } catch (error) {
      console.log('Error setting up Redis subscriber:', error)
      this.subscriberInitialized = false
      // Try to reconnect after a delay
      setTimeout(() => this.setupRedisSubscriber(), 5000)
      throw error
    }
  }

  // Handle subscriptions to Redis channels
  async setupSubscriptions() {
    try {
      // Subscribe to the universal-deposits:changes channel
      await this.redisSubscriber.subscribe('universal-deposits:changes', async message => {
        console.log('Received message on Redis channel:', message)

        if (message === 'address_added') {
          console.log('New address detected, refreshing address list and checking balances...')
          // Force a balance check with updated addresses
          if (this.isRunning) {
            try {
              // Small delay to ensure Redis hash is updated before we read it
              await new Promise(resolve => setTimeout(resolve, 100))

              const balances = await this.readBalance()
              if (Object.keys(balances).length > 0) {
                console.log(
                  'Non-zero balances found for new addresses:',
                  JSON.stringify(balances, null, 2),
                )
                await this.storeBalances(balances)
              } else {
                console.log('No non-zero balances found for new addresses')
              }
            } catch (error) {
              console.log('Error checking balances for new addresses:', error)
            }
          }
        }
      })

      console.log('Successfully subscribed to Redis changes channel')
    } catch (error) {
      console.log('Error setting up Redis subscriptions:', error)
      throw error
    }
  }
  getPublicClients = chainTokens => {
    const clients = {}
    Object.keys(chainTokens)
      .map(Number)
      .filter(chainId => this.chainMap[chainId])
      .forEach(chainId => {
        // Try to use multiChainClient if available
        if (multiChainClient.isChainSupported && multiChainClient.isChainSupported(chainId)) {
          clients[chainId] = multiChainClient.getPublicClient(chainId)
          console.log(`Using shared public client for chain ${chainId}`)
        } else {
          // Fall back to creating a new client
          clients[chainId] = createPublicClient({
            chain: this.chainMap[chainId],
            transport: http(),
          })
          console.log(`Created new public client for chain ${chainId}`)
        }
      })

    return clients
  }

  setupRedisWatcher = async () => {
    try {
      // Ensure Redis database client is connected
      if (!this.redisDatabaseClient.isOpen) {
        this.redisDatabaseClient.on('error', err => {
          console.log('Redis Database Client Error:', err)
        })

        // Set up reconnect handler
        this.redisDatabaseClient.on('reconnect', () => {
          console.log('Redis database client reconnected')
        })

        await this.redisDatabaseClient.connect()
      }

      // Ensure Redis publisher client is connected
      if (!this.redisPublisher.isOpen) {
        this.redisPublisher.on('error', err => {
          console.log('Redis Publisher Client Error:', err)
        })

        // Set up reconnect handler
        this.redisPublisher.on('reconnect', () => {
          console.log('Redis publisher client reconnected')
        })

        await this.redisPublisher.connect()
      }

      // Fetch all addresses from the hash
      const addresses = await this.redisDatabaseClient.hGetAll('universal-deposits:addresses')

      if (Object.keys(addresses).length > 0) {
        console.log(`Found ${Object.keys(addresses).length} addresses in Redis hash`)
      }

      return addresses
    } catch (error) {
      console.log('Redis setup failed:', error)
      throw error
    }
  }

  getTokenBalance = async (publicClient, tokenAddress, walletAddress) => {
    try {
      const balance = await publicClient.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [walletAddress],
      })
      return balance
    } catch (error) {
      console.log(`Error reading balance for ${walletAddress} on token ${tokenAddress}:`, error)
      return 0n
    }
  }

  readBalance = async () => {
    try {
      const addresses = await this.setupRedisWatcher()

      if (Object.keys(addresses).length === 0) {
        console.log('No addresses found in Redis')
        return {}
      }

      // Initialize public clients for all supported chains
      this.publicClients = this.getPublicClients(allowListToken)

      const result = {}

      for (const [chainId, tokens] of Object.entries(allowListToken)) {
        const chainIdNum = Number(chainId)
        const publicClient = this.publicClients[chainIdNum]

        if (!publicClient) {
          console.log(`No public client found for chain ${chainId}`)
          continue
        }

        result[chainId] = {}

        // Iterate through each token (usdc, usdt) for this chain
        for (const [tokenName, tokenAddress] of Object.entries(tokens)) {
          const nonZeroBalances = []

          // Check balance for each address
          // key: address, value: balance
          for (const [key, value] of Object.entries(addresses)) {
            try {
              const balance = await this.getTokenBalance(publicClient, tokenAddress, value)

              if (balance > 0n) {
                nonZeroBalances.push({ [key]: value })
              }
            } catch (error) {
              console.log(`Error checking balance for ${value} on chain ${chainId}:`, error)
            }
          }

          // Only add token to result if there are non-zero balances
          if (nonZeroBalances.length > 0) {
            result[chainId][tokenAddress] = nonZeroBalances
          }
        }

        // Remove chain from result if no tokens have non-zero balances
        if (Object.keys(result[chainId]).length === 0) {
          delete result[chainId]
        }
      }

      return result
    } catch (error) {
      console.log('Error in readBalance:', error)
      return {}
    }
  }

  storeBalances = async balances => {
    try {
      if (!this.redisDatabaseClient.isOpen) {
        await this.redisDatabaseClient.connect()
      }

      // Check if balances object is empty
      if (!balances || Object.keys(balances).length === 0) {
        console.log('No balances to store (empty object)')
        return
      }

      const timestamp = Date.now()
      await this.initializeDatabases()

      const { mongoDBClient } = await import('../utils/mongoClient.js')
      const { redisQueueManager } = await import('../utils/redisQueue.js')

      // Iterate through each chainId in balances
      for (const [chainId, chainBalances] of Object.entries(balances)) {
        const publicClient = createPublicClient({
          chain: this.chainMap[chainId],
          transport: http(),
        })

        // Skip if chainBalances is empty
        if (!chainBalances || Object.keys(chainBalances).length === 0) {
          continue
        }

        const balancesRedisKey = `universal-deposits:balances:${chainId}`
        const ordersRedisKey = `universal-deposits:orders:${chainId}`

        // Store each token address as a field with its balance array as value
        for (const [tokenAddress, balanceArray] of Object.entries(chainBalances)) {
          // Only store if balanceArray is not empty
          if (balanceArray && balanceArray.length > 0) {
            // Note: The above Redis hSet operation can be kept for backward compatibility
            // but the primary storage will be MongoDB

            // Process each element in the balance array to create orders
            for (const balanceElement of balanceArray) {
              // Each element is an object with one key-value pair
              for (const [recipientAddress, udAddress] of Object.entries(balanceElement)) {
                // check if udAddress.code > 0
                let status = 'Registered' // Set every new order as Registered
                // TODO: also check for Safe Module address bytecode
                if ((await publicClient.getCode({ address: udAddress })) > 0) {
                  status = 'Deployed'
                }

                // Create order ID using keccak256
                const orderIdHash = keccak256(
                  encodePacked(
                    ['uint256', 'uint256', 'address', 'address', 'address', 'address'],
                    [
                      BigInt(chainId), // sourceChainId
                      BigInt(DESTINATION_CHAIN_ID), // destinationChainId
                      recipientAddress, // recipientAddress
                      udAddress, // udAddress
                      tokenAddress, // sourceToken
                      DESTINATION_TOKEN, // destinationToken
                    ],
                  ),
                )

                // Check if order already exists in MongoDB
                const existingOrder = await mongoDBClient.getOrder(orderIdHash)

                // Create order value object
                const orderValue = {
                  orderId: orderIdHash,
                  orderIdHash, // Store the hash as a separate field for easier querying
                  sourceChainId: parseInt(chainId),
                  destinationChainId: DESTINATION_CHAIN_ID,
                  recipientAddress: recipientAddress,
                  udAddress: udAddress,
                  sourceToken: tokenAddress,
                  destinationToken: DESTINATION_TOKEN,
                  status: status,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  // Adding additional fields for tracking
                  deployedAt: null,
                  settledAt: null,
                  lastError: null,
                  retryCount: 0,
                }

                if (!existingOrder) {
                  console.log('Adding new order to MongoDB:', orderIdHash)

                  // Store in MongoDB as primary storage
                  await mongoDBClient.storeOrder(orderValue)

                  // Only queue for deployment if the status is 'Registered'
                  // if (status === 'Registered') {
                  // Add to deploy queue using Redis
                  await redisQueueManager.addToDeployQueue(orderValue)
                  console.log('Order added to deploy queue:', orderIdHash)
                  // }
                } else if (status == 'DeploymentFailed' && status.retryCount < 2) {
                  await mongoDBClient.updateOrderStatus(orderIdHash, 'Registered')
                } else if (status == 'Deployed') {
                  // Update teh deplyment details struct by calling sdk
                  let universalDepositInstance = new UniversalDeposits({
                    destinationAddress: recipientAddress,
                    destinationToken: DESTINATION_TOKEN,
                    destinationChain: DESTINATION_CHAIN_ID,
                  })
                  const deploymentDetailsProd = {
                    safeModuleLogic:
                      universalDepositInstance.getSafeModuleLogicParams().contractAddress,
                    safeModuleProxy:
                      universalDepositInstance.getSafeModuleProxyParams().contractAddress,
                    universalSafe: universalDepositInstance.getUDSafeParams().contractAddress,
                  }

                  await mongoDBClient.storeOrder({
                    ...existingOrder,
                    updatedAt: new Date(),
                    deploymentDetails:
                      process.env.MODE == 'dev' ? deployResult : deploymentDetailsProd,
                  })
                  // TODO: only when during restarting, the status is 'Deployed' , but not push to settle queue
                  // fix: when the order is already settling, and the order status is not updated, it will add the same order into the queue
                  // await redisQueueManager.addToSettleQueue(existingOrder)
                } else {
                  console.log(
                    'Order already exists with same status:',
                    existingOrder.status,
                    ' for orderId ',
                    orderIdHash,
                  )
                }
              }
            }
          }
        }
      }

      console.log(`Stored balances and orders at ${new Date(timestamp).toISOString()}`)
    } catch (error) {
      console.log('Error storing balances:', error)
    }
  }
  watchBalances = async () => {
    if (this.isRunning) {
      console.log('Balance watcher is already running')
      return
    }

    this.isRunning = true
    console.log(`Starting balance watcher with ${this.interval}ms interval`)

    const watch = async () => {
      try {
        console.log('Checking balances...')
        const balances = await this.readBalance()

        if (Object.keys(balances).length > 0) {
          console.log('Non-zero balances found:', JSON.stringify(balances, null, 2))
          await this.storeBalances(balances)
        } else {
          console.log('No non-zero balances found')
        }
      } catch (error) {
        console.log('Error in balance watch cycle:', error)
      }
    }

    await watch()

    this.watchInterval = setInterval(watch, this.interval)
  }

  stopWatching = () => {
    if (this.watchInterval) {
      clearInterval(this.watchInterval)
      this.watchInterval = null
    }
    this.isRunning = false
    console.log('Balance watcher stopped')
  }

  cleanup = async () => {
    this.stopWatching()

    try {
      // Unsubscribe from Redis channels before disconnecting
      if (this.redisSubscriber.isOpen) {
        console.log('Unsubscribing from Redis channels...')
        try {
          await this.redisSubscriber.unsubscribe('universal-deposits:changes')
          console.log('Successfully unsubscribed from Redis channels')
        } catch (unsubError) {
          console.log('Error unsubscribing from Redis channels:', unsubError)
        }

        console.log('Disconnecting Redis subscriber client...')
        await this.redisSubscriber.destroy()
      }

      // Disconnect database client
      if (this.redisDatabaseClient.isOpen) {
        console.log('Disconnecting Redis database client...')
        await this.redisDatabaseClient.destroy()
      }

      // Disconnect publisher client
      if (this.redisPublisher.isOpen) {
        console.log('Disconnecting Redis publisher client...')
        await this.redisPublisher.destroy()
      }

      console.log('All Redis connections cleaned up successfully')

      // Reset initialization flags
      this.subscriberInitialized = false
      this.redisQueueInitialized = false
    } catch (error) {
      console.log('Error during cleanup:', error)
    }
  }

  // Main run method
  async run() {
    try {
      console.log('======================================')
      console.log('STARTING BALANCE WATCHER SERVICE')
      console.log('======================================')
      console.log('Initializing database connections and Redis subscribers...')

      // Initialize database connections first
      await this.initializeDatabases()

      console.log('Starting balance watcher with MongoDB storage and Redis queues')
      console.log('Redis subscription status:', this.subscriberInitialized ? 'ACTIVE' : 'INACTIVE')
      console.log('Watching address changes on channel: universal-deposits:changes')
      console.log('======================================')

      await this.watchBalances()
    } catch (error) {
      console.log('Error starting balance watcher:', error)
    }
  }
}

export { BalanceWatcher }
