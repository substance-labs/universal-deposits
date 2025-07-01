import { deployContractOnOriginChain } from '../utils/deployLogic.js'
import { multiChainClient } from '../utils/multiChainClient.js'
import { UniversalDeposits } from '@universal-deposits/sdk'
import { databaseManager } from '../utils/databaseManager.js'
import { getServiceLogger } from '../utils/logger.js'

class DeployWorker {
  constructor(config = {}) {
    this.name = 'deploy-worker'
    this.isRunning = false
    this.processInterval = config.processInterval || process.env.INTERVAL || 5000 // Default: process queue every 5 seconds
    this.intervalId = null
    this.clientsInitialized = false
    this.databaseInitialized = false
    this.logger = getServiceLogger('deployWorker')
  }

  async callDeploy(order) {
    try {
      this.logger.info('Deploy worker processing order:', order.orderId)

      await this.initializeDatabases()
      const mongoDBClient = databaseManager.getMongoClient()
      const redisQueueManager = databaseManager.getRedisQueueManager()

      if (!this.clientsInitialized) {
        await this.initializeChainClients()
      }

      if (multiChainClient.isChainSupported(order.sourceChainId)) {
        this.logger.debug(`Using multi-chain client for chain ${order.sourceChainId}`)
      } else {
        this.logger.warn(
          `No multi-chain client available for chain ${order.sourceChainId}, using default RPC`,
        )
      }

      // Call deployment with proper parameters
      const deployResult = await deployContractOnOriginChain(
        multiChainClient.getPublicClient(order.sourceChainId),
        multiChainClient.getWalletClient(order.sourceChainId),
        order.recipientAddress,
        order.destinationToken,
        order.destinationChainId,
        order.sourceToken,
        '1000000000000000000', // Exchange rate, should be configured properly
      )

      // Update the order status to "Deployed" in MongoDB with deployment details
      await mongoDBClient.storeOrder({
        ...order,
        status: 'Deployed',
        deployedAt: new Date(),
        updatedAt: new Date(),
        deploymentDetails: deployResult,
      })

      // Get the updated order from MongoDB to ensure we have the latest data
      const updatedOrder = await mongoDBClient.getOrder(order.orderId)

      await redisQueueManager.addToSettleQueue(updatedOrder || order)
      this.logger.info('Order added to settle queue:', order.orderId)

      return deployResult
    } catch (error) {
      this.logger.error('Error during deployment:', error)

      const mongoDBClient = databaseManager.getMongoClient()

      // Update status to failed in MongoDB with error details
      await mongoDBClient.storeOrder({
        ...order,
        status: 'DeploymentFailed',
        lastError: error.message || 'Unknown error during deployment',
        updatedAt: new Date(),
        retryCount: (order.retryCount || 0) + 1,
      })

      throw error
    }
  }

  async initializeDatabases() {
    if (!this.databaseInitialized) {
      await databaseManager.initialize()
      this.databaseInitialized = true
      this.logger.info('Databases initialized for DeployWorker')
    }
  }

  async processQueue() {
    await this.initializeDatabases()
    const redisQueueManager = databaseManager.getRedisQueueManager()
    const mongoDBClient = databaseManager.getMongoClient()
    if (process.env.MODE == 'dev') {
      // Update the order status to "Deployed" in MongoDB without deploying
      const order = await redisQueueManager.getNextFromDeployQueue()
      await new Promise(resolve => setTimeout(resolve, 2000))

      if (!order) {
        this.logger.warn('[dev] No order found in deploy queue')
        return
      }

      // Acquire a lock to ensure no other worker processes this order
      const lockAcquired = await redisQueueManager.acquireLock(order.orderId)
      if (!lockAcquired) {
        this.logger.info(
          `[dev] Order ${order.orderId} is being processed by another worker, skipping`,
        )
        return
      }
      let universalDepositInstance = new UniversalDeposits({
        destinationAddress: order.recipientAddress,
        destinationToken: order.destinationToken,
        destinationChain: order.destinationChainId,
      })
      const deploymentDetailsTest = {
        safeModuleLogic: universalDepositInstance.getSafeModuleLogicParams().contractAddress,
        safeModuleProxy: universalDepositInstance.getSafeModuleProxyParams().contractAddress,
        universalSafe: universalDepositInstance.getUDSafeParams().contractAddress,
      }
      await new Promise(resolve => setTimeout(resolve, 2000))

      await mongoDBClient.storeOrder({
        ...order,
        status: 'Deployed',
        deployedAt: new Date(),
        updatedAt: new Date(),
        deploymentDetails: deploymentDetailsTest,
      })

      this.logger.info(`[dev] Order Id ${order.orderIdHash} is set to Deployed`)
      await redisQueueManager.addToSettleQueue(order)
      this.logger.info('[dev] Order added to settle queue:', order.orderId)

      // Mark processing as complete and release lock
      await redisQueueManager.completeDeployProcessing(order.orderId)
      await redisQueueManager.releaseLock(order.orderId)
    } else {
      try {
        // Get queue length
        const queueLength = await redisQueueManager.getDeployQueueLength()

        if (queueLength > 0) {
          this.logger.info(`Processing deploy queue. Items in queue: ${queueLength}`)
          const order = await redisQueueManager.getNextFromDeployQueue()

          if (order) {
            // Acquire lock to ensure exclusive processing
            const lockAcquired = await redisQueueManager.acquireLock(order.orderId)
            if (!lockAcquired) {
              this.logger.info(
                `Order ${order.orderId} is being processed by another worker, skipping`,
              )
              // Return item to processing queue for recovery later if needed
              await redisQueueManager.completeDeployProcessing(order.orderId)
              return
            }

            try {
              const latestOrder = await mongoDBClient.getOrder(order.orderId)

              if (latestOrder) {
                // Only process if status is still 'Registered' or failed with retries
                if (
                  latestOrder.status === 'Registered' ||
                  (latestOrder.status === 'DeploymentFailed' && (latestOrder.retryCount || 0) < 3)
                ) {
                  await this.callDeploy(latestOrder)
                } else {
                  this.logger.info(
                    `Skipping order ${order.orderId} - status is already ${latestOrder.status}`,
                  )
                }
              } else {
                // If not found in MongoDB, process it anyway and it will be created
                await this.callDeploy(order)
              }

              // Processing complete, remove from processing queue
              await redisQueueManager.completeDeployProcessing(order.orderId)
            } catch (error) {
              this.logger.error(`Error processing deploy order ${order.orderId}:`, error)
            } finally {
              // Always release the lock
              await redisQueueManager.releaseLock(order.orderId)
            }
          }
        }
      } catch (error) {
        this.logger.error('Error processing deploy queue:', error)
      }
    }
  }

  async initializeChainClients() {
    try {
      if (!this.clientsInitialized) {
        const privateKey = process.env.DEPLOYER_PRIVATE_KEY
        if (!privateKey) {
          throw new Error('DEPLOYER_PRIVATE_KEY environment variable is required')
        }

        this.logger.info('Initializing multi-chain clients...')
        await multiChainClient.initialize(privateKey)
        this.clientsInitialized = true

        const supportedChainIds = multiChainClient.getSupportedChainIds()
        this.logger.info(`Initialized wallet clients for chains: ${supportedChainIds.join(', ')}`)
      }
    } catch (error) {
      this.logger.error('Failed to initialize multi-chain clients:', error)
      throw error
    }
  }

  async run() {
    try {
      await this.initializeDatabases()
      await this.initializeChainClients()

      if (this.isRunning) {
        this.logger.info('Deploy worker is already running')
        return
      }

      this.isRunning = true
      this.logger.info('Deploy worker started')

      // Start recovery check for hanging items
      this.recoveryInterval = setInterval(async () => {
        try {
          const redisQueueManager = databaseManager.getRedisQueueManager()
          await redisQueueManager.recoverHangingItems()
        } catch (error) {
          this.logger.error('Error recovering hanging items:', error)
        }
      }, 60000) // Check every minute

      // Listen for queue notifications
      await databaseManager.subscribe('universal-deposits:deploy', async message => {
        this.logger.debug('Received message on channel:', message)
        if (message === 'deployqueue_added') {
          this.logger.info('Deploy queue notification received')

          await this.processQueue()
        }
      })
    } catch (error) {
      this.logger.error('Error starting deploy worker:', error)
      this.isRunning = false
    }
  }

  async stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }

    if (this.recoveryInterval) {
      clearInterval(this.recoveryInterval)
      this.recoveryInterval = null
    }

    await databaseManager.cleanup()
    this.databaseInitialized = false

    this.isRunning = false
    this.logger.info('Deploy worker stopped')
  }
}

export { DeployWorker }
