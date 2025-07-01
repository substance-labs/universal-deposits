import { createPublicClient, http, keccak256, encodePacked, erc20Abi } from 'viem'
import { allowListToken } from '@universal-deposits/constants'
import * as chains from 'viem/chains'
import { multiChainClient } from '../utils/multiChainClient.js'
import { UniversalDeposits } from '@universal-deposits/sdk'
import { databaseManager } from '../utils/databaseManager.js'
import { getServiceLogger } from '../utils/logger.js'

const DESTINATION_CHAIN_ID = 100

class BalanceWatcher {
  constructor(config = {}) {
    this.interval = config.interval || process.env.INTERVAL || 30000 // 30 seconds
    this.publicClients = {}
    this.isRunning = false
    this.databaseInitialized = false
    this.logger = getServiceLogger('balanceWatcher')

    this.chainMap = Object.values(chains).reduce((acc, chain) => {
      acc[chain.id] = chain
      return acc
    }, {})
  }

  async initializeDatabases() {
    if (!this.databaseInitialized) {
      await databaseManager.initialize()
      this.databaseInitialized = true
      this.logger.info('Databases initialized for BalanceWatcher')
    }

    try {
      const privateKey = process.env.DEPLOYER_PRIVATE_KEY
      if (privateKey && !multiChainClient.supportedChainIds?.length) {
        this.logger.info('Initializing multi-chain clients for balance watching...')
        await multiChainClient.initialize(privateKey)
        this.logger.info(
          `Initialized balance watch clients for chains: ${multiChainClient.getSupportedChainIds().join(', ')}`,
        )
      }
    } catch (error) {
      this.logger.warn(
        'Failed to initialize multi-chain clients for balance watching:',
        error.message,
      )
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
          this.logger.debug(`Using shared public client for chain ${chainId}`)
        } else {
          // Fall back to creating a new client
          clients[chainId] = createPublicClient({
            chain: this.chainMap[chainId],
            transport: http(),
          })
          this.logger.debug(`Created new public client for chain ${chainId}`)
        }
      })

    return clients
  }

  setupRedisWatcher = async () => {
    try {
      // Initialize database connection if needed
      await this.initializeDatabases()

      // Fetch all addresses from the hash
      const addresses = await databaseManager.readFromRedisHash('universal-deposits:addresses')

      if (Object.keys(addresses).length > 0) {
        this.logger.info(`Found ${Object.keys(addresses).length} addresses in Redis hash`)
      }
      // struct
      // {[address]: JSONStringify([universalDepositAddress, destinationToken])}
      return addresses
    } catch (error) {
      this.logger.error('Redis setup failed:', error)
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
      this.logger.error(
        `Error reading balance for ${walletAddress} on token ${tokenAddress}:`,
        error,
      )
      return 0n
    }
  }

  readBalance = async () => {
    try {
      const addresses = await this.setupRedisWatcher()

      if (Object.keys(addresses).length === 0) {
        this.logger.info('No addresses found in Redis')
        return {}
      }

      // Initialize public clients for all supported chains
      this.publicClients = this.getPublicClients(allowListToken)

      const result = {}

      for (const [chainId, tokens] of Object.entries(allowListToken)) {
        const chainIdNum = Number(chainId)
        const publicClient = this.publicClients[chainIdNum]

        if (!publicClient) {
          this.logger.warn(`No public client found for chain ${chainId}`)
          continue
        }

        result[chainId] = {}

        // Iterate through each token (usdc, usdt) for this chain
        for (const [tokenName, tokenAddress] of Object.entries(tokens)) {
          const nonZeroBalances = []

          // Check balance for each address
          //  key: address, value: JSONStringify([UD Safe, Destination token])

          for (const [key, value] of Object.entries(addresses)) {
            try {
              const [udSafe, destinationToken] = JSON.parse(value)
              const balance = await this.getTokenBalance(publicClient, tokenAddress, udSafe)

              if (balance > 0n) {
                //  key: address, value: JSONStringify([UD Safe, Destination token])

                nonZeroBalances.push({ [key]: value })
              }
            } catch (error) {
              this.logger.error(`Error checking balance for ${value} on chain ${chainId}:`, error)
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
      // A list of chains, with each tokens and balances w.r.t addresses
      return result
    } catch (error) {
      this.logger.error('Error in readBalance:', error)
      return {}
    }
  }

  storeBalances = async balances => {
    try {
      // Check if balances object is empty
      if (!balances || Object.keys(balances).length === 0) {
        this.logger.debug('No balances to store (empty object)')
        return
      }

      const timestamp = Date.now()
      await this.initializeDatabases()

      const mongoDBClient = databaseManager.getMongoClient()
      const redisQueueManager = databaseManager.getRedisQueueManager()

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

        // Store each token address as a field with its balance array as value
        for (const [tokenAddress, balanceArray] of Object.entries(chainBalances)) {
          // Only store if balanceArray is not empty
          if (balanceArray && balanceArray.length > 0) {
            // Note: The above Redis hSet operation can be kept for backward compatibility
            // but the primary storage will be MongoDB

            // Process each element in the balance array to create orders
            for (const balanceElement of balanceArray) {
              // Each element is an object with one key-value pair
              for (const [recipientAddress, udAddressDestinationTokenArray] of Object.entries(
                balanceElement,
              )) {
                const [udAddress, destinationToken] = JSON.parse(udAddressDestinationTokenArray)
                // check if udAddress.code > 0
                let status = 'Registered' // Set every new order as Registered
                // TODO: also check for Safe Module address bytecode
                if ((await publicClient.getCode({ address: udAddress })) > 0) {
                  this.logger.debug(' The public client chain ID:', await publicClient.getChainId())
                  status = 'Deployed'
                } else {
                  this.logger.debug('Status is:', status)
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
                      destinationToken, // destinationToken
                    ],
                  ),
                )

                // Check if order already exists in MongoDB
                const existingOrder = await mongoDBClient.getOrder(orderIdHash)

                // Create order value object
                let orderValue = {
                  orderId: orderIdHash,
                  orderIdHash, // Store the hash as a separate field for easier querying
                  sourceChainId: parseInt(chainId),
                  destinationChainId: DESTINATION_CHAIN_ID,
                  recipientAddress: recipientAddress,
                  udAddress: udAddress,
                  sourceToken: tokenAddress,
                  destinationToken: destinationToken,
                  status: status,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  // Adding additional fields for tracking
                  deployedAt: null,
                  settledAt: null,
                  lastError: null,
                  retryCount: 0,
                }
                if (status == 'Deployed') {
                  let universalDepositInstance = new UniversalDeposits({
                    destinationAddress: recipientAddress,
                    destinationToken: destinationToken,
                    destinationChain: DESTINATION_CHAIN_ID,
                  })
                  const deploymentDetails = {
                    safeModuleLogic:
                      universalDepositInstance.getSafeModuleLogicParams().contractAddress,
                    safeModuleProxy:
                      universalDepositInstance.getSafeModuleProxyParams().contractAddress,
                    universalSafe: universalDepositInstance.getUDSafeParams().contractAddress,
                  }
                  // update the deployedment details
                  orderValue = { ...orderValue, deploymentDetails }
                }

                if (!existingOrder) {
                  this.logger.info('Adding new order to MongoDB:', orderIdHash)

                  // Store in MongoDB as primary storage
                  await mongoDBClient.storeOrder(orderValue)
                  this.logger.debug('The status now:', status)

                  // Only queue for deployment if the status is 'Registered'
                  if (status === 'Registered') {
                    await redisQueueManager.addToDeployQueue(orderValue)

                    this.logger.info('Order added to deploy queue:', orderIdHash)
                  } else if (status === 'Deployed') {
                    // if ud Safe is already deployed, set to settle queue
                    this.logger.info('Order added to settle queue:', orderIdHash)
                    await redisQueueManager.addToSettleQueue(orderValue)
                  }
                  // }
                } else if (status == 'DeploymentFailed' && status.retryCount < 2) {
                  // Try again
                  await mongoDBClient.updateOrderStatus(orderIdHash, 'Registered')
                } else if (status == 'Deployed') {
                  // If there is existing order, skip
                  this.logger.debug(
                    `Order already exists with same status: ${existingOrder.status} for orderId: ${orderIdHash}`,
                  )

                  // // Update the deplyment details struct by calling sdk
                  // let universalDepositInstance = new UniversalDeposits({
                  //   destinationAddress: recipientAddress,
                  //   destinationToken: DESTINATION_TOKEN,
                  //   destinationChain: DESTINATION_CHAIN_ID,
                  // })
                  // const deploymentDetailsProd = {
                  //   safeModuleLogic:
                  //     universalDepositInstance.getSafeModuleLogicParams().contractAddress,
                  //   safeModuleProxy:
                  //     universalDepositInstance.getSafeModuleProxyParams().contractAddress,
                  //   universalSafe: universalDepositInstance.getUDSafeParams().contractAddress,
                  // }
                  // await mongoDBClient.storeOrder({
                  //   ...existingOrder,
                  //   updatedAt: new Date(),
                  //   deploymentDetails:
                  //     process.env.MODE == 'dev' ? deployResult : deploymentDetailsProd,
                  // })
                  // // TODO: only when during restarting, the status is 'Deployed' , but not push to settle queue
                  // // fix: when the order is already settling, and the order status is not updated, it will add the same order into the queue
                  // // await redisQueueManager.addToSettleQueue(existingOrder)
                } else {
                  // Settling || Settle || Verifying || Verify
                  this.logger.debug(
                    `Order already exists with same status: ${existingOrder.status} for orderId: ${orderIdHash}`,
                  )
                }
              }
            }
          }
        }
      }

      this.logger.info(`Stored balances and orders at ${new Date(timestamp).toISOString()}`)
    } catch (error) {
      this.logger.error('Error storing balances:', error)
    }
  }

  testWatchAndCreateOrder = async () => {
    const redisQueueManager = databaseManager.getRedisQueueManager()

    const addresses = await this.setupRedisWatcher()
    await new Promise(resolve => setTimeout(resolve, 3000)) // wait to seconds

    // Mode: dev
    // manually add the registered address on Redis into the queue
    if (process.env.MODE == 'dev') {
      // for testing purpose, manually create the fake balance of the inserted token
      // key: recipient address
      // value: ud address
      for (const [key, value] of Object.entries(addresses)) {
        // Create order ID using keccak256
        const orderIdHash = keccak256(
          encodePacked(
            ['uint256', 'uint256', 'address', 'address', 'address', 'address'],
            [
              BigInt(8453), // sourceChainId
              BigInt(100), // destinationChainId
              key, // recipientAddress
              value, // udAddress
              '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // sourceToken: USDC on Base
              '0xcB444e90D8198415266c6a2724b7900fb12FC56E', // destinationToken: EURe on Gnosis
            ],
          ),
        )

        const orderValue = {
          orderId: orderIdHash,
          orderIdHash, // Store the hash as a separate field for easier querying
          sourceChainId: parseInt(8453),
          destinationChainId: DESTINATION_CHAIN_ID,
          recipientAddress: key,
          udAddress: value,
          sourceToken: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
          destinationToken: '0xcB444e90D8198415266c6a2724b7900fb12FC56E',
          status: 'Registered',
          createdAt: new Date(),
          updatedAt: new Date(),
          // Adding additional fields for tracking
          deployedAt: null,
          settledAt: null,
          lastError: null,
          retryCount: 0,
        }

        const mongoDBClient = databaseManager.getMongoClient()

        // Store in MongoDB as primary storage
        if (await mongoDBClient.getOrder(orderIdHash)) {
          this.logger.debug('Already tracked it in the database')
        } else {
          this.logger.info('Adding new order to MongoDB:', orderIdHash)
          await mongoDBClient.storeOrder(orderValue)

          await redisQueueManager.addToDeployQueue(orderValue)
          this.logger.info('Order added to deploy queue:', orderIdHash)
        }

        //  await this.redisDatabaseClient.del('universal-deposits:addresses')
      }
    }
  }

  watchBalances = async () => {
    if (this.isRunning) {
      this.logger.info('Balance watcher is already running')
      return
    }

    this.isRunning = true
    this.logger.info(`Starting balance watcher with ${this.interval}ms interval`)

    if (process.env.MODE == 'dev') {
      const watch = async () => {
        try {
          this.logger.info('Checking balances in dev environment...')
          await this.testWatchAndCreateOrder()
        } catch (error) {
          this.logger.error('Error in balance watch cycle:', error)
        }
      }

      await watch()

      this.watchInterval = setInterval(watch, this.interval)
    } else {
      const watch = async () => {
        try {
          this.logger.info('Checking balances...')
          // balances =
          //   {
          //     "10":{
          //        "USDC_Address":[
          //           {
          //              "recipientAddress":jsonStringify([
          //                 "UDSafe",
          //                 "destinationToken"
          //              ])
          //           }
          //        ]
          //     }
          //  }

          const balances = await this.readBalance()

          if (Object.keys(balances).length > 0) {
            this.logger.info('Non-zero balances found:', JSON.stringify(balances, null, 2))
            await this.storeBalances(balances)
          } else {
            this.logger.debug('No non-zero balances found')
          }
        } catch (error) {
          this.logger.error('Error in balance watch cycle:', error)
        }
      }

      await watch()

      this.watchInterval = setInterval(watch, this.interval)
    }
  }

  stopWatching = () => {
    if (this.watchInterval) {
      clearInterval(this.watchInterval)
      this.watchInterval = null
    }
    this.isRunning = false
    this.logger.info('Balance watcher stopped')
  }

  cleanup = async () => {
    this.stopWatching()

    try {
      await databaseManager.cleanup()
      this.databaseInitialized = false
      this.logger.info('All database connections cleaned up successfully')
    } catch (error) {
      this.logger.error('Error during cleanup:', error)
    }
  }

  // Main run method
  async run() {
    try {
      this.logger.info('======================================')
      this.logger.info('STARTING BALANCE WATCHER SERVICE')
      this.logger.info('======================================')
      this.logger.info('Initializing database connections...')

      // Initialize database connections first
      await this.initializeDatabases()

      // Dev: unlike the other service, balanceWatcher will continuously watch the redis address data instead of watching the address_added pub
      // Setup Redis subscriptions for address_added
      // only one time execution
      // await this.setupSubscriptions()

      this.logger.info('Starting balance watcher with MongoDB storage and Redis queues')
      this.logger.info('Database status:', this.databaseInitialized ? 'ACTIVE' : 'INACTIVE')
      this.logger.info('Watching address changes on channel: universal-deposits:changes')
      this.logger.info('======================================')

      await this.watchBalances()
    } catch (error) {
      this.logger.error('Error starting balance watcher:', error)
    }
  }
}

export { BalanceWatcher }
