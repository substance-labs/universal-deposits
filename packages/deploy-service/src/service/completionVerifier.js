import { createClient } from 'redis'
import { erc20Abi, createPublicClient } from 'viem'
import * as chains from 'viem/chains'
import { multiChainClient } from '../utils/multiChainClient.js'

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'
const VERIFY_QUEUE = 'universal-deposits:queue:verify'

// TODO: fix when 'relay' bridge is faster than the watch interval
// example: https://www.relay.link/transaction/0xfbe2754afa2d55fe7fab1ad682df648b939051b316878e208a848e373bddf055
class CompletionVerifier {
  constructor(config = {}) {
    this.name = 'completion-verifier'
    this.redisSubscriber = createClient({ url: REDIS_URL })
    this.redisPublisher = createClient({ url: REDIS_URL })
    this.redisDatabaseClient = createClient({ url: REDIS_URL })
    this.isRunning = false
    this.processInterval = config.processInterval || 5000 // Default: process queue every 5 seconds
    this.checkBalanceInterval = config.checkBalanceInterval || 15000 // Default: check balance every 15 seconds
    this.intervalId = null
    this.balanceChecks = new Map() // Map to track ongoing balance checks

    // Create a map of chain IDs to chain objects
    this.chainMap = Object.values(chains).reduce((acc, chain) => {
      acc[chain.id] = chain
      return acc
    }, {})
  }

  async verify(order) {
    try {
      console.log('Completion verifier processing order:', order.orderId)

      const { mongoDBClient } = await import('../utils/mongoClient.js')
      await mongoDBClient.updateOrderStatus(order.orderId, 'Verifying')

      // Start monitoring the recipient's balance on the destination chain
      this.startBalanceMonitoring(order)

      return { status: 'Verifying' }
    } catch (error) {
      console.error('Error during completion verification setup:', error)

      const { mongoDBClient } = await import('../utils/mongoClient.js')

      await mongoDBClient.updateOrderStatus(order.orderId, 'VerificationFailed')

      await mongoDBClient.storeOrder({
        ...order,
        status: 'VerificationFailed',
        lastError: error.message || 'Unknown error during verification setup',
        updatedAt: new Date(),
      })

      throw error
    }
  }

  async startBalanceMonitoring(order) {
    try {
      // Check if we already have an active monitoring for this order
      if (this.balanceChecks.has(order.orderId)) {
        console.log(`Balance monitoring already active for order ${order.orderId}`)
        return
      }

      const publicClient = createPublicClient({
        chain: gnosis,
        transport: http('https://rpc.gnosischain.com'),
      })

      const { mongoDBClient } = await import('../utils/mongoClient.js')

      // Get initial balance
      const tokenContract = {
        address: order.destinationToken,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [order.recipientAddress],
      }
      const initialBalance = await publicClient.readContract(tokenContract)

      console.log(
        `Initial balance for ${order.recipientAddress} on chain ${order.destinationChainId}: ${initialBalance}`,
      )

      // Store initial balance with the order
      await mongoDBClient.storeOrder({
        ...order,
        initialDestinationBalance: initialBalance.toString(),
        verificationStartedAt: new Date(),
      })

      // Set up interval to check balance
      const checkId = setInterval(async () => {
        try {
          const currentBalance = await publicClient.readContract(tokenContract)
          console.log(
            `Current balance for ${order.recipientAddress} on chain ${order.destinationChainId}: ${currentBalance}`,
          )

          if (currentBalance > initialBalance) {
            console.log(`Balance increased for order ${order.orderId}! Marking as Completed`)

            clearInterval(checkId)
            this.balanceChecks.delete(order.orderId)

            // Update order status to "Completed" in MongoDB
            await mongoDBClient.updateOrderStatus(order.orderId, 'Completed')

            // Update other details
            await mongoDBClient.storeOrder({
              ...order,
              status: 'Completed',
              completedAt: new Date(),
              updatedAt: new Date(),
              finalDestinationBalance: currentBalance.toString(),
              balanceIncrease: (currentBalance - initialBalance).toString(),
            })

            await this.redisPublisher.publish('universal-deposits:completed', order.orderId)
          } else {
            console.log(`No balance increase yet for order ${order.orderId}`)

            // Check if we need to timeout the verification
            const verificationStartTime = new Date(order.verificationStartedAt).getTime()
            const currentTime = Date.now()
            const elapsedTime = currentTime - verificationStartTime

            const maxVerificationTime = process.env.MAX_VERIFICATION_TIME || 10 * 60 * 1000 // Default: 10 mins
            if (elapsedTime > maxVerificationTime) {
              console.log(`Verification timeout for order ${order.orderId}`)

              // Stop checking
              clearInterval(checkId)
              this.balanceChecks.delete(order.orderId)

              // Update order status to "VerificationTimeout" in MongoDB
              await mongoDBClient.updateOrderStatus(order.orderId, 'VerificationTimeout')

              // Update other details
              await mongoDBClient.storeOrder({
                ...order,
                status: 'VerificationTimeout',
                updatedAt: new Date(),
                verificationEndedAt: new Date(),
              })
            }
          }
        } catch (error) {
          console.error(`Error checking balance for order ${order.orderId}:`, error)
        }
      }, this.checkBalanceInterval)

      // Store the interval ID so we can clear it later if needed
      this.balanceChecks.set(order.orderId, checkId)

      console.log(`Started balance monitoring for order ${order.orderId}`)
    } catch (error) {
      console.error(`Error setting up balance monitoring for order ${order.orderId}:`, error)

      const { mongoDBClient } = await import('../utils/mongoClient.js')
      await mongoDBClient.updateOrderStatus(order.orderId, 'VerificationFailed')
      await mongoDBClient.storeOrder({
        ...order,
        status: 'VerificationFailed',
        lastError: error.message || 'Unknown error during balance monitoring setup',
        updatedAt: new Date(),
      })
    }
  }

  async processQueue() {
    try {
      const { redisQueueManager } = await import('../utils/redisQueue.js')
      const { mongoDBClient } = await import('../utils/mongoClient.js')

      const queueLength = await redisQueueManager.getVerifyQueueLength()

      if (queueLength > 0) {
        console.log(`Processing verify queue. Items in queue: ${queueLength}`)

        const order = await redisQueueManager.getNextFromVerifyQueue()

        if (order) {
          const latestOrder = await mongoDBClient.getOrder(order.orderId)

          if (latestOrder) {
            await this.verify(latestOrder)
          } else {
            // If for some reason the order is not in MongoDB, use the order from the queue
            await this.verify(order)
          }
        }
      } else {
        // Check for any orders in "Settled" status that need verification
        const settledOrders = await mongoDBClient.getOrdersByStatus('Settled')
        if (settledOrders && settledOrders.length > 0) {
          console.log(`Found ${settledOrders.length} settled orders that need verification`)

          // Process the first one
          await this.verify(settledOrders[0])

          // Queue the rest if there are more
          for (let i = 1; i < settledOrders.length; i++) {
            await redisQueueManager.addToVerifyQueue(settledOrders[i])
          }
        }
      }
    } catch (error) {
      console.error('Error processing verify queue:', error)
    }
  }

  async run() {
    try {
      await this.redisSubscriber.connect()
      await this.redisDatabaseClient.connect()
      await this.redisPublisher.connect()

      if (this.isRunning) {
        console.log('Completion verifier is already running')
        return
      }

      this.isRunning = true
      console.log('Completion verifier started')

      // Listen for queue notifications
      await this.redisSubscriber.subscribe('universal-deposits:verify', async message => {
        console.log('Received message on channel:', message)
        if (message === 'verify_called') {
          console.log('Verify queue notification received')
          await this.processQueue()
        }
      })

      // Also set up interval for processing queue periodically
      // This ensures we process any items that might be missed by the pub/sub mechanism
      this.intervalId = setInterval(() => this.processQueue(), this.processInterval)
    } catch (error) {
      console.error('Error starting completion verifier:', error)
      this.isRunning = false
    }
  }

  async stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }

    // Clear all active balance checks
    for (const [orderId, intervalId] of this.balanceChecks.entries()) {
      clearInterval(intervalId)
      console.log(`Stopped balance monitoring for order ${orderId}`)
    }
    this.balanceChecks.clear()

    if (this.redisSubscriber.isOpen) {
      await this.redisSubscriber.unsubscribe('universal-deposits:verify')
      this.redisSubscriber.destroy()
    }

    if (this.redisPublisher.isOpen) {
      this.redisPublisher.destroy()
    }

    if (this.redisDatabaseClient.isOpen) {
      this.redisDatabaseClient.destroy()
    }

    this.isRunning = false
    console.log('Completion verifier stopped')
  }
}

export { CompletionVerifier, VERIFY_QUEUE }
