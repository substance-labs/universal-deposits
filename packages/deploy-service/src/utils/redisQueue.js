import { createClient } from 'redis'

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

// Queue names
const DEPLOY_QUEUE = 'universal-deposits:queue:deploy'
const SETTLE_QUEUE = 'universal-deposits:queue:settle'
const VERIFY_QUEUE = 'universal-deposits:queue:verify'

class RedisQueueManager {
  constructor() {
    this.redisClient = createClient({ url: REDIS_URL })
    this.redisClient.on('error', err => {
      console.error('Redis Queue Error:', err)
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

  // Get next order from deploy queue (non-blocking)
  async getNextFromDeployQueue() {
    await this.connect()
    const orderJson = await this.redisClient.rPop(DEPLOY_QUEUE)
    return orderJson ? JSON.parse(orderJson) : null
  }

  // Get next order from settle queue (non-blocking)
  async getNextFromSettleQueue() {
    await this.connect()
    const orderJson = await this.redisClient.rPop(SETTLE_QUEUE)
    return orderJson ? JSON.parse(orderJson) : null
  }

  // Get next order from verify queue (non-blocking)
  async getNextFromVerifyQueue() {
    await this.connect()
    const orderJson = await this.redisClient.rPop(VERIFY_QUEUE)
    return orderJson ? JSON.parse(orderJson) : null
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

export { redisQueueManager, DEPLOY_QUEUE, SETTLE_QUEUE, VERIFY_QUEUE }
