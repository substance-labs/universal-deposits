const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'
import { createClient } from 'redis'
import { deployContractOnOriginChain } from '../utils/deployLogic.js'
import { multiChainClient } from '../utils/multiChainClient.js'

class DeployWorker {
  constructor(config = {}) {
    this.name = 'deploy-worker'
    this.redisSubscriber = createClient({ url: REDIS_URL })
    this.redisPublisher = createClient({ url: REDIS_URL })
    this.redisDatabaseClient = createClient({ url: REDIS_URL })
    this.isRunning = false
    this.processInterval = config.processInterval || process.env.INTERVAL || 5000 // Default: process queue every 5 seconds
    this.intervalId = null
    this.clientsInitialized = false
  }

  async callDeploy(order) {
    try {
      console.log('Deploy worker processing order:', order.orderId)

      const { mongoDBClient } = await import('../utils/mongoClient.js')
      const { redisQueueManager } = await import('../utils/redisQueue.js')

      await mongoDBClient.updateOrderStatus(order.orderId, 'Deploying')

      if (!this.clientsInitialized) {
        await this.initializeChainClients()
      }

      if (multiChainClient.isChainSupported(order.sourceChainId)) {
        console.log(`Using multi-chain client for chain ${order.sourceChainId}`)
      } else {
        console.warn(
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
      console.log('Order added to settle queue:', order.orderId)

      return deployResult
    } catch (error) {
      console.error('Error during deployment:', error)

      // Import MongoDB client
      const { mongoDBClient } = await import('../utils/mongoClient.js')

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

  async processQueue() {
    try {
      const { redisQueueManager } = await import('../utils/redisQueue.js')
      const { mongoDBClient } = await import('../utils/mongoClient.js')

      // Get queue length
      const queueLength = await redisQueueManager.getDeployQueueLength()

      if (queueLength > 0) {
        console.log(`Processing deploy queue. Items in queue: ${queueLength}`)
        const order = await redisQueueManager.getNextFromDeployQueue()

        if (order) {
          const latestOrder = await mongoDBClient.getOrder(order.orderId)

          if (latestOrder) {
            // Only process if status is still 'Registered'
            if (latestOrder.status === 'Registered') {
              await this.callDeploy(latestOrder)
            } else {
              console.log(
                `Skipping order ${order.orderId} - status is already ${latestOrder.status}`,
              )
            }
          } else {
            // If not found in MongoDB, process it anyway and it will be created
            await this.callDeploy(order)
          }
        }
      } else {
        // Even if the queue is empty, check for any 'Registered' orders in MongoDB that might have been missed
        const { mongoDBClient } = await import('../utils/mongoClient.js')
        const registeredOrders = await mongoDBClient.getOrdersByStatus('Registered')

        if (registeredOrders && registeredOrders.length > 0) {
          console.log(`Found ${registeredOrders.length} registered orders that need deployment`)

          // Process the first one
          await this.callDeploy(registeredOrders[0])

          // Queue the rest if there are more
          for (let i = 1; i < registeredOrders.length; i++) {
            await redisQueueManager.addToDeployQueue(registeredOrders[i])
          }
        }
      }
    } catch (error) {
      console.error('Error processing deploy queue:', error)
    }
  }

  async initializeChainClients() {
    try {
      if (!this.clientsInitialized) {
        const privateKey = process.env.DEPLOYER_PRIVATE_KEY
        if (!privateKey) {
          throw new Error('DEPLOYER_PRIVATE_KEY environment variable is required')
        }

        console.log('Initializing multi-chain clients...')
        await multiChainClient.initialize(privateKey)
        this.clientsInitialized = true

        const supportedChainIds = multiChainClient.getSupportedChainIds()
        console.log(`Initialized wallet clients for chains: ${supportedChainIds.join(', ')}`)
      }
    } catch (error) {
      console.error('Failed to initialize multi-chain clients:', error)
      throw error
    }
  }

  async run() {
    try {
      await this.redisSubscriber.connect()
      await this.redisDatabaseClient.connect()
      await this.redisPublisher.connect()

      await this.initializeChainClients()

      if (this.isRunning) {
        console.log('Deploy worker is already running')
        return
      }

      this.isRunning = true
      console.log('Deploy worker started')

      // Listen for queue notifications
      await this.redisSubscriber.subscribe('universal-deposits:deploy', async message => {
        console.log('Received message on channel:', message)
        if (message === 'deployqueue_added') {
          console.log('Deploy queue notification received')

          await this.processQueue()
        }
      })

      // Also set up interval for processing queue periodically
      // This ensures we process any items that might be missed by the pub/sub mechanism
      this.intervalId = setInterval(() => this.processQueue(), this.processInterval)
    } catch (error) {
      console.error('Error starting deploy worker:', error)
      this.isRunning = false
    }
  }

  async stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }

    if (this.redisSubscriber.isOpen) {
      await this.redisSubscriber.unsubscribe('universal-deposits:deploy')
      this.redisSubscriber.destroy()
    }

    if (this.redisPublisher.isOpen) {
      this.redisPublisher.destroy()
    }

    if (this.redisDatabaseClient.isOpen) {
      this.redisDatabaseClient.destroy()
    }

    this.isRunning = false
    console.log('Deploy worker stopped')
  }
}

export { DeployWorker }
