import { erc20Abi, createPublicClient, http } from 'viem'
import { gnosis } from 'viem/chains'
import { databaseManager } from '../utils/databaseManager.js'
import { VERIFY_QUEUE, REDIS_ADDRESS_HASH_KEY } from '../utils/redisQueue.js'
import { getServiceLogger } from '../utils/logger.js'

// Configuration constants
const DEFAULT_PROCESS_INTERVAL = 5000 // 5 seconds
const DEFAULT_BALANCE_CHECK_INTERVAL = 15000 // 15 seconds
const DEFAULT_MAX_VERIFICATION_TIME = 10 * 60 * 1000 // 10 minutes
const DEFAULT_MONITOR_LOCK_DURATION = 30 * 60 * 1000 // 30 minutes
const DEFAULT_PROCESSING_LOCK_DURATION = 5 * 60 * 1000 // 5 minutes
const MAX_RETRY_COUNT = 3

class CompletionVerifier {
  constructor(config = {}) {
    this.name = 'completion-verifier'
    this.isRunning = false
    this.processInterval = config.processInterval || DEFAULT_PROCESS_INTERVAL
    this.checkBalanceInterval = config.checkBalanceInterval || DEFAULT_BALANCE_CHECK_INTERVAL
    this.maxVerificationTime =
      config.maxVerificationTime ||
      parseInt(process.env.MAX_VERIFICATION_TIME) ||
      DEFAULT_MAX_VERIFICATION_TIME

    this.intervalId = null
    this.recoveryInterval = null
    this.balanceChecks = new Map() // Map to track ongoing balance checks
    this.databaseInitialized = false
    this.logger = getServiceLogger('completionVerifier')

    // Create public client for Gnosis chain
    this.publicClient = createPublicClient({
      chain: gnosis,
      transport: http('https://rpc.gnosischain.com'),
    })
  }

  _validateOrder(order) {
    const requiredFields = ['orderId', 'destinationToken', 'recipientAddress']

    for (const field of requiredFields) {
      if (!order[field]) {
        throw new Error(`Missing required field: ${field}`)
      }
    }

    // Validate addresses
    if (!/^0x[a-fA-F0-9]{40}$/.test(order.destinationToken)) {
      throw new Error(`Invalid destination token address: ${order.destinationToken}`)
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(order.recipientAddress)) {
      throw new Error(`Invalid recipient address: ${order.recipientAddress}`)
    }
  }

  async initializeDatabases() {
    if (!this.databaseInitialized) {
      await databaseManager.initialize()
      this.databaseInitialized = true
      this.logger.info('Databases initialized for CompletionVerifier')
    }
  }

  async verify(order) {
    let mongoDBClient

    try {
      this.logger.info('Completion verifier processing order:', order.orderId)

      // Validate order data
      this._validateOrder(order)

      await this.initializeDatabases()
      mongoDBClient = databaseManager.getMongoClient()

      // Get the most up-to-date order with proper error handling
      const latestOrder = await mongoDBClient.getOrder(order.orderId)

      // If order is already completed, just return
      if (latestOrder && latestOrder.status === 'Completed') {
        this.logger.info(`Order ${order.orderId} is already completed, skipping verification`)
        return { status: 'Completed' }
      }

      // Update status to verifying
      await mongoDBClient.updateOrderStatus(order.orderId, 'Verifying')

      const orderToProcess = latestOrder

      // Check if the order already has initialDestinationBalance recorded
      if (orderToProcess.initialDestinationBalance) {
        this.logger.info(
          `Using existing initial balance for order ${order.orderId}: ${orderToProcess.initialDestinationBalance}`,
        )
        await this.startBalanceMonitoring(orderToProcess)
      } else {
        // Start monitoring the recipient's balance on the destination chain
        await this.startBalanceMonitoring(orderToProcess)
      }

      return { status: 'Verifying' }
    } catch (error) {
      this.logger.error('Error during completion verification setup:', error)

      try {
        if (!mongoDBClient) {
          mongoDBClient = databaseManager.getMongoClient()
        }

        await mongoDBClient.updateOrderStatus(order.orderId, 'VerificationFailed')

        const retryCount = (order.retryCount || 0) + 1
        await mongoDBClient.storeOrder({
          ...order,
          status: 'VerificationFailed',
          lastError: error.message || 'Unknown error during verification setup',
          retryCount,
          updatedAt: new Date(),
        })
      } catch (dbError) {
        this.logger.error('Error updating order status after verification failure:', dbError)
      }

      throw error
    }
  }

  async startBalanceMonitoring(order) {
    let redisQueueManager
    let mongoDBClient
    let monitorLockKey
    let intervalId

    try {
      // Check if we already have active monitoring for this order
      if (this.balanceChecks.has(order.orderId)) {
        this.logger.info(`Balance monitoring already active for order ${order.orderId}`)
        return
      }

      // Acquire a lock for this order's monitoring
      redisQueueManager = databaseManager.getRedisQueueManager()
      monitorLockKey = `monitor:${order.orderId}`
      const lockAcquired = await redisQueueManager.acquireLock(
        monitorLockKey,
        DEFAULT_MONITOR_LOCK_DURATION,
      )

      if (!lockAcquired) {
        this.logger.info(
          `Another worker is already monitoring order ${order.orderId}, skipping duplicate monitoring`,
        )
        return
      }

      // Get the appropriate public client for the destination chain

      mongoDBClient = databaseManager.getMongoClient()

      // Get initial balance with retry logic
      const tokenContract = {
        address: order.destinationToken,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [order.recipientAddress],
      }

      const startTime = Date.now()

      // Set up interval to check balance
      intervalId = setInterval(async () => {
        await this._checkBalance(order.orderId, {
          tokenContract,
          initialBalance: order.initialDestinationBalance,
          startTime,
          mongoDBClient,
          redisQueueManager,
          monitorLockKey,
        })
      }, this.checkBalanceInterval)

      // Store the monitoring data
      this.balanceChecks.set(order.orderId, {
        intervalId,
        startTime,
        monitorLockKey,
        initialBalance: order.initialDestinationBalance,
        publicClient: this.publicClient,
        tokenContract,
      })

      this.logger.info(`Started balance monitoring for order ${order.orderId}`)
    } catch (error) {
      this.logger.error(`Error setting up balance monitoring for order ${order.orderId}:`, error)

      // Cleanup on error
      if (intervalId) {
        clearInterval(intervalId)
      }

      if (monitorLockKey && redisQueueManager) {
        try {
          await redisQueueManager.releaseLock(monitorLockKey)
        } catch (lockError) {
          this.logger.error(`Error releasing monitor lock on error:`, lockError)
        }
      }

      if (!mongoDBClient) {
        mongoDBClient = databaseManager.getMongoClient()
      }

      await mongoDBClient.updateOrderStatus(order.orderId, 'VerificationFailed')
      await mongoDBClient.storeOrder({
        ...order,
        status: 'VerificationFailed',
        lastError: error.message || 'Unknown error during balance monitoring setup',
        updatedAt: new Date(),
      })

      throw error
    }
  }

  async _checkBalance(orderId, context) {
    const {
      tokenContract,
      initialBalance,
      startTime,
      mongoDBClient,
      redisQueueManager,
      monitorLockKey,
    } = context

    try {
      // Read current balance with error handling
      let currentBalance
      try {
        currentBalance = await this.publicClient.readContract(tokenContract)
      } catch (contractError) {
        this.logger.error(`Error reading current balance for order ${orderId}:`, contractError)
        return // Skip this check, will try again next interval
      }

      this.logger.debug(
        `Current balance for order ${orderId}: ${currentBalance} (initial: ${initialBalance})`,
      )

      if (currentBalance > initialBalance) {
        this.logger.info(`Balance increased for order ${orderId}! Marking as Completed`)

        await this._completeOrder(orderId, {
          currentBalance,
          initialBalance,
          mongoDBClient,
          redisQueueManager,
          monitorLockKey,
        })
      } else {
        // Check for timeout
        const elapsedTime = Date.now() - startTime
        if (elapsedTime > this.maxVerificationTime) {
          this.logger.warn(`Verification timeout for order ${orderId} (${elapsedTime}ms elapsed)`)

          await this._timeoutOrder(orderId, {
            mongoDBClient,
            redisQueueManager,
            monitorLockKey,
          })
        } else {
          this.logger.debug(`No balance increase yet for order ${orderId} (${elapsedTime}ms elapsed)`)
        }
      }
    } catch (error) {
      this.logger.error(`Error in balance check for order ${orderId}:`, error)
    }
  }

  async _completeOrder(orderId, context) {
    const { currentBalance, initialBalance, mongoDBClient, redisQueueManager, monitorLockKey } =
      context

    try {
      // Stop monitoring
      const monitoringData = this.balanceChecks.get(orderId)
      if (monitoringData) {
        clearInterval(monitoringData.intervalId)
        this.balanceChecks.delete(orderId)
      }

      // Update order status to "Completed"
      await mongoDBClient.updateOrderStatus(orderId, 'Completed')

      // Get the current order to preserve all data
      const currentOrder = await mongoDBClient.getOrder(orderId)

      // Update with completion details
      await mongoDBClient.storeOrder({
        ...currentOrder,
        status: 'Completed',
        completedAt: new Date(),
        updatedAt: new Date(),
        finalDestinationBalance: currentBalance.toString(),
        balanceIncrease: (currentBalance - BigInt(initialBalance)).toString(),
      })

      // Release the monitoring lock
      await redisQueueManager.releaseLock(monitorLockKey)

      await redisQueueManager.removeHashField(REDIS_ADDRESS_HASH_KEY, currentOrder.recipientAddress)

      this.logger.info(`Successfully completed order ${orderId}`)
    } catch (error) {
      this.logger.error(`Error completing order ${orderId}:`, error)
    }
  }

  async _timeoutOrder(orderId, context) {
    const { mongoDBClient, redisQueueManager, monitorLockKey } = context

    try {
      // Stop monitoring
      const monitoringData = this.balanceChecks.get(orderId)
      if (monitoringData) {
        clearInterval(monitoringData.intervalId)
        this.balanceChecks.delete(orderId)
      }

      // Update order status
      await mongoDBClient.updateOrderStatus(orderId, 'VerificationTimeout')

      // Get the current order to preserve all data
      const currentOrder = await mongoDBClient.getOrder(orderId)

      await mongoDBClient.storeOrder({
        ...currentOrder,
        status: 'VerificationTimeout',
        updatedAt: new Date(),
        verificationEndedAt: new Date(),
      })

      // Release the monitoring lock
      await redisQueueManager.releaseLock(monitorLockKey)

      this.logger.warn(`Verification timeout for order ${orderId}`)
    } catch (error) {
      this.logger.error(`Error timing out order ${orderId}:`, error)
    }
  }

  async processQueue() {
    await this.initializeDatabases()
    const redisQueueManager = databaseManager.getRedisQueueManager()
    const mongoDBClient = databaseManager.getMongoClient()

    if (process.env.MODE === 'dev') {
      await this._processDevMode(redisQueueManager, mongoDBClient)
    } else {
      await this._processProductionMode(redisQueueManager, mongoDBClient)
    }
  }

  async _processDevMode(redisQueueManager, mongoDBClient) {
    try {
      // Wait for a few seconds in dev mode
      await new Promise(resolve => setTimeout(resolve, 10000))

      const order = await redisQueueManager.getNextFromVerifyQueue()
      if (!order) {
        this.logger.warn('[dev] No order found in verify queue')
        return
      }

      // Acquire a lock with proper timeout
      const lockAcquired = await redisQueueManager.acquireLock(
        order.orderId,
        DEFAULT_PROCESSING_LOCK_DURATION,
      )

      if (!lockAcquired) {
        this.logger.info(
          `[dev] Order ${order.orderId} is being processed by another verify worker, skipping`,
        )
        await redisQueueManager.completeVerifyProcessing(order.orderId)
        return
      }

      try {
        const latestOrder = await mongoDBClient.getOrder(order.orderId)

        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 10000))

        this.logger.info('[dev] Order is set to completed')

        const orderToUpdate = latestOrder || order
        await mongoDBClient.updateOrderStatus(orderToUpdate.orderId, 'Completed')

        await mongoDBClient.storeOrder({
          ...orderToUpdate,
          status: 'Completed',
          completedAt: new Date(),
          updatedAt: new Date(),
          finalDestinationBalance: '10000000000',
          balanceIncrease: '500000',
        })

        await redisQueueManager.completeVerifyProcessing(order.orderId)
      } finally {
        await redisQueueManager.releaseLock(order.orderId)
      }
    } catch (error) {
      this.logger.error(`[dev] Error processing verify order:`, error)
    }
  }

  async _processProductionMode(redisQueueManager, mongoDBClient) {
    try {
      const queueLength = await redisQueueManager.getVerifyQueueLength()

      if (queueLength > 0) {
        this.logger.info(`Processing verify queue. Items in queue: ${queueLength}`)

        const order = await redisQueueManager.getNextFromVerifyQueue()

        if (order) {
          await this._processOrder(order, redisQueueManager, mongoDBClient)
        }
      } else {
        // Check for any orders in "Settled" status that need verification
        // TODO: remove, only process from the redis queue
        //  await this._processSettledOrders(redisQueueManager, mongoDBClient)
      }
    } catch (error) {
      this.logger.error('Error processing verify queue:', error)
    }
  }

  async _processOrder(order, redisQueueManager, mongoDBClient) {
    // Acquire lock with proper timeout
    const lockAcquired = await redisQueueManager.acquireLock(
      order.orderId,
      DEFAULT_PROCESSING_LOCK_DURATION,
    )

    if (!lockAcquired) {
      this.logger.info(`Order ${order.orderId} is being processed by another verify worker, skipping`)
      await redisQueueManager.completeVerifyProcessing(order.orderId)
      return
    }

    try {
      const latestOrder = await mongoDBClient.getOrder(order.orderId)

      if (latestOrder) {
        // Only process if status allows it
        if (this._shouldProcessOrder(latestOrder)) {
          await this.verify(latestOrder)
        } else {
          this.logger.info(`Skipping order ${order.orderId} - status is ${latestOrder.status}`)
        }
      }
      // remove from the queue
      await redisQueueManager.completeVerifyProcessing(order.orderId)
    } catch (error) {
      this.logger.error(`Error processing verify order ${order.orderId}:`, error)
    } finally {
      await redisQueueManager.releaseLock(order.orderId)
    }
  }

  _shouldProcessOrder(order) {
    return (
      order.status === 'Settled' ||
      (order.status === 'VerificationFailed' && (order.retryCount || 0) < MAX_RETRY_COUNT)
    )
  }

  async _processSettledOrders(redisQueueManager, mongoDBClient) {
    const settledOrders = await mongoDBClient.getOrdersByStatus('Settled')
    if (settledOrders && settledOrders.length > 0) {
      this.logger.info(`Found ${settledOrders.length} settled orders that need verification`)

      // Process the first one immediately
      await this.verify(settledOrders[0])

      // Queue the rest
      for (let i = 1; i < settledOrders.length; i++) {
        await redisQueueManager.addToVerifyQueue(settledOrders[i])
      }
    }
  }

  async run() {
    try {
      await this.initializeDatabases()

      if (this.isRunning) {
        this.logger.info('Completion verifier is already running')
        return
      }

      this.isRunning = true
      this.logger.info('Completion verifier started')

      // Start recovery check for hanging items
      this.recoveryInterval = setInterval(async () => {
        try {
          const redisQueueManager = databaseManager.getRedisQueueManager()
          await redisQueueManager.recoverHangingItems()
          this.checkBalanceCheckTimeouts()
        } catch (error) {
          this.logger.error('Error recovering hanging items in verification worker:', error)
        }
      }, 60000) // Check every minute

      // Listen for queue notifications
      await databaseManager.subscribe('universal-deposits:verify', async message => {
        this.logger.debug('Received message on channel:', message)
        if (message === 'verify_called') {
          this.logger.info('Verify queue notification received')
          await this.processQueue()
        }
      })

      // Set up interval for processing queue periodically
      // TODO: remove this to only listen to the redis queue  in order to avoid duplicated order processing
      // this.intervalId = setInterval(() => this.processQueue(), this.processInterval)
    } catch (error) {
      this.logger.error('Error starting completion verifier:', error)
      this.isRunning = false
    }
  }

  checkBalanceCheckTimeouts() {
    const now = Date.now()

    for (const [orderId, data] of this.balanceChecks.entries()) {
      if (!data.startTime) continue

      const elapsedTime = now - data.startTime
      if (elapsedTime > this.maxVerificationTime) {
        this.logger.warn(`Force timeout for order ${orderId} (${elapsedTime}ms elapsed)`)

        // Stop the interval
        clearInterval(data.intervalId)
        this.balanceChecks.delete(orderId)

        // Update order status asynchronously with proper error handling
        this._handleForcedTimeout(orderId, data.monitorLockKey)
      }
    }
  }

  async _handleForcedTimeout(orderId, monitorLockKey) {
    try {
      const mongoDBClient = databaseManager.getMongoClient()
      const redisQueueManager = databaseManager.getRedisQueueManager()

      await mongoDBClient.updateOrderStatus(orderId, 'VerificationTimeout')

      const currentOrder = await mongoDBClient.getOrder(orderId)
      if (currentOrder) {
        await mongoDBClient.storeOrder({
          ...currentOrder,
          status: 'VerificationTimeout',
          updatedAt: new Date(),
          verificationEndedAt: new Date(),
        })
      }

      // Release the monitor lock
      if (monitorLockKey) {
        await redisQueueManager.releaseLock(monitorLockKey)
      }

      this.logger.info(`Updated order ${orderId} status to VerificationTimeout`)
    } catch (error) {
      this.logger.error(`Error updating timeout status for order ${orderId}:`, error)
    }
  }

  async stop() {
    this.logger.info('Stopping completion verifier...')

    // Clear intervals
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }

    if (this.recoveryInterval) {
      clearInterval(this.recoveryInterval)
      this.recoveryInterval = null
    }

    // Clear all active balance checks and release locks
    const cleanupPromises = []

    for (const [orderId, data] of this.balanceChecks.entries()) {
      clearInterval(data.intervalId)
      this.logger.info(`Stopped balance monitoring for order ${orderId}`)

      // Release monitoring locks
      if (data.monitorLockKey) {
        cleanupPromises.push(
          (async () => {
            try {
              const redisQueueManager = databaseManager.getRedisQueueManager()
              await redisQueueManager.releaseLock(data.monitorLockKey)
            } catch (error) {
              this.logger.error(`Error releasing monitor lock for order ${orderId}:`, error)
            }
          })(),
        )
      }
    }

    this.balanceChecks.clear()

    // Wait for all cleanup operations to complete
    await Promise.all(cleanupPromises)

    // Cleanup database connections
    await databaseManager.cleanup()
    this.databaseInitialized = false

    this.isRunning = false
    this.logger.info('Completion verifier stopped')
  }
}

export { CompletionVerifier, VERIFY_QUEUE }
