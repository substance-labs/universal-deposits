import { createClient } from 'redis'
import { getServiceLogger } from './logger.js'

const logger = getServiceLogger('database')
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

// Registered addresses cache
const REDIS_ADDRESS_HASH_KEY = 'universal-deposits:addresses'

// Queue names
const DEPLOY_QUEUE = 'universal-deposits:queue:deploy'
const SETTLE_QUEUE = 'universal-deposits:queue:settle'
const VERIFY_QUEUE = 'universal-deposits:queue:verify'

// Processing queues
const DEPLOY_PROCESSING = `${DEPLOY_QUEUE}:processing`
const SETTLE_PROCESSING = `${SETTLE_QUEUE}:processing`
const VERIFY_PROCESSING = `${VERIFY_QUEUE}:processing`

// Lock TTL in milliseconds (30 seconds)
const LOCK_TTL = 30000

class RedisQueueManager {
  constructor() {
    this.redisClient = createClient({ url: REDIS_URL })
    this.redisClient.on('error', err => {
      logger.error('Redis Queue Error:', err)
    })
  }

  async connect() {
    if (!this.redisClient.isOpen) {
      await this.redisClient.connect()
    }
  }

  async destroy() {
    if (this.redisClient.isOpen) {
      this.redisClient.destroy()
    }
  }

  async removeHashField(hashKey, field) {
    try {
      await this.redisClient.hDel(hashKey, field)
    } catch (error) {
      logger.error('Error removing Redis hash field:', error)
    }
  }

  // Acquire a lock for processing an order
  async acquireLock(orderId, ttlMs = LOCK_TTL) {
    await this.connect()
    const lockKey = `lock:${orderId}`
    const result = await this.redisClient.set(lockKey, Date.now().toString(), {
      NX: true, // Only set if key does not exist
      PX: ttlMs, // Expire after ttlMs milliseconds
    })
    return result === 'OK'
  }

  // Release a lock after processing
  async releaseLock(orderId) {
    await this.connect()
    const lockKey = `lock:${orderId}`
    await this.redisClient.del(lockKey)
  }

  // Check if an order is locked
  async isLocked(orderId) {
    await this.connect()
    const lockKey = `lock:${orderId}`
    return (await this.redisClient.exists(lockKey)) === 1
  }

  // Add order to deploy queue
  async addToDeployQueue(order) {
    await this.connect()
    const result = await this.redisClient.lPush(DEPLOY_QUEUE, JSON.stringify(order))
    await this.redisClient.publish('universal-deposits:deploy', 'deployqueue_added')
    return result
  }

  // Add order to settle queue
  async addToSettleQueue(order) {
    await this.connect()
    const result = await this.redisClient.lPush(SETTLE_QUEUE, JSON.stringify(order))
    await this.redisClient.publish('universal-deposits:settle', 'settle_called')
    return result
  }

  // Add order to verify queue
  async addToVerifyQueue(order) {
    await this.connect()
    const result = await this.redisClient.lPush(VERIFY_QUEUE, JSON.stringify(order))
    await this.redisClient.publish('universal-deposits:verify', 'verify_called')
    return result
  }

  // Get next order from deploy queue with atomic move to processing queue
  async getNextFromDeployQueue() {
    await this.connect()
    // Move item from main queue to processing queue atomically
    const orderJson = await this.redisClient.rPopLPush(DEPLOY_QUEUE, DEPLOY_PROCESSING)
    if (!orderJson) return null

    const order = JSON.parse(orderJson)
    order.processingStarted = Date.now()

    // Update the order in the processing queue with timestamp
    await this.redisClient.lRem(DEPLOY_PROCESSING, 1, orderJson)
    await this.redisClient.lPush(DEPLOY_PROCESSING, JSON.stringify(order))

    return order
  }

  // Get next order from settle queue with atomic move to processing queue
  async getNextFromSettleQueue() {
    await this.connect()
    // Move item from main queue to processing queue atomically
    const orderJson = await this.redisClient.rPopLPush(SETTLE_QUEUE, SETTLE_PROCESSING)
    if (!orderJson) return null

    const order = JSON.parse(orderJson)
    order.processingStarted = Date.now()

    // Update the order in the processing queue with timestamp
    await this.redisClient.lRem(SETTLE_PROCESSING, 1, orderJson)
    await this.redisClient.lPush(SETTLE_PROCESSING, JSON.stringify(order))

    return order
  }

  // Get next order from verify queue with atomic move to processing queue
  async getNextFromVerifyQueue() {
    await this.connect()
    // Move item from main queue to processing queue atomically
    const orderJson = await this.redisClient.rPopLPush(VERIFY_QUEUE, VERIFY_PROCESSING)
    if (!orderJson) return null

    const order = JSON.parse(orderJson)
    order.processingStarted = Date.now()

    // Update the order in the processing queue with timestamp
    await this.redisClient.lRem(VERIFY_PROCESSING, 1, orderJson)
    await this.redisClient.lPush(VERIFY_PROCESSING, JSON.stringify(order))

    return order
  }

  // Mark an order as completed in the deploy processing queue
  async completeDeployProcessing(orderId) {
    await this.removeFromProcessingQueue(DEPLOY_PROCESSING, orderId)
  }

  // Mark an order as completed in the settle processing queue
  async completeSettleProcessing(orderId) {
    await this.removeFromProcessingQueue(SETTLE_PROCESSING, orderId)
  }

  // Mark an order as completed in the verify processing queue
  async completeVerifyProcessing(orderId) {
    await this.removeFromProcessingQueue(VERIFY_PROCESSING, orderId)
  }

  // Remove an order from a processing queue
  async removeFromProcessingQueue(queueName, orderId) {
    await this.connect()
    const items = await this.redisClient.lRange(queueName, 0, -1)

    for (const item of items) {
      try {
        const parsedItem = JSON.parse(item)
        if (parsedItem.orderId === orderId) {
          await this.redisClient.lRem(queueName, 1, item)
          return true
        }
      } catch (error) {
        logger.error(`Error parsing item in ${queueName}:`, error)
      }
    }

    return false
  }

  // Recover hanging items that have been in processing queues too long
  async recoverHangingItems(timeoutMs = 300000) {
    await this.connect()
    const now = Date.now()

    // Process each queue
    await this.recoverHangingItemsFromQueue(DEPLOY_PROCESSING, DEPLOY_QUEUE, now, timeoutMs)
    await this.recoverHangingItemsFromQueue(SETTLE_PROCESSING, SETTLE_QUEUE, now, timeoutMs)
    await this.recoverHangingItemsFromQueue(VERIFY_PROCESSING, VERIFY_QUEUE, now, timeoutMs)
  }

  async recoverHangingItemsFromQueue(processingQueue, targetQueue, now, timeoutMs) {
    const items = await this.redisClient.lRange(processingQueue, 0, -1)
    let recoveredCount = 0

    for (const item of items) {
      try {
        const parsedItem = JSON.parse(item)
        const processingTime = now - (parsedItem.processingStarted || 0)

        if (processingTime > timeoutMs) {
          // Remove from processing queue
          await this.redisClient.lRem(processingQueue, 1, item)

          // Update retry information
          parsedItem.retryCount = (parsedItem.retryCount || 0) + 1
          parsedItem.lastProcessingAttempt = new Date().toISOString()
          parsedItem.processingStarted = null

          // Add back to main queue
          await this.redisClient.lPush(targetQueue, JSON.stringify(parsedItem))
          recoveredCount++
        }
      } catch (error) {
        logger.error(`Error recovering item from ${processingQueue}:`, error)
      }
    }

    if (recoveredCount > 0) {
      logger.info(`Recovered ${recoveredCount} hanging items from ${processingQueue}`)
    }

    return recoveredCount
  }

  async getDeployQueueLength() {
    await this.connect()
    return this.redisClient.lLen(DEPLOY_QUEUE)
  }

  async getSettleQueueLength() {
    await this.connect()
    return this.redisClient.lLen(SETTLE_QUEUE)
  }

  async getVerifyQueueLength() {
    await this.connect()
    return this.redisClient.lLen(VERIFY_QUEUE)
  }
}

// Singleton instance
const redisQueueManager = new RedisQueueManager()

export {
  redisQueueManager,
  DEPLOY_QUEUE,
  SETTLE_QUEUE,
  VERIFY_QUEUE,
  DEPLOY_PROCESSING,
  SETTLE_PROCESSING,
  VERIFY_PROCESSING,
  LOCK_TTL,
  REDIS_ADDRESS_HASH_KEY,
}
