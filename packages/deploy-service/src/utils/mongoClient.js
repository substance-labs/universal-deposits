import { MongoClient } from 'mongodb'

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017'
const DB_NAME = 'universal-deposits'

class MongoDBClient {
  constructor() {
    this.client = new MongoClient(MONGO_URL)
    this.db = null
    this.collections = {}
  }

  async connect() {
    try {
      if (!this.db) {
        await this.client.connect()
        this.db = this.client.db(DB_NAME)

        // Initialize collections
        this.collections.orders = this.db.collection('orders')

        // Create indexes for better performance
        await this.collections.orders.createIndex({ orderId: 1 }, { unique: true })
        await this.collections.orders.createIndex({ status: 1 })

        console.log('MongoDB connected successfully')
      }
    } catch (error) {
      console.error('MongoDB connection error:', error)
      throw error
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.close()
      this.db = null
      this.collections = {}
      console.log('MongoDB disconnected')
    }
  }

  // Store an order in MongoDB
  async storeOrder(order) {
    try {
      await this.connect()

      // Create a copy of the order without _id to avoid the immutable field error
      const orderToStore = { ...order }
      delete orderToStore._id

      const result = await this.collections.orders.updateOne(
        { orderId: order.orderId },
        { $set: orderToStore },
        { upsert: true },
      )
      return result
    } catch (error) {
      console.error('Error storing order in MongoDB:', error)
      throw error
    }
  }

  // Update order status
  async updateOrderStatus(orderId, status) {
    try {
      await this.connect()

      const existingOrder = await this.collections.orders.findOne({ orderId })
      if (!existingOrder) {
        console.warn(`Order ${orderId} not found for status update to ${status}`)
        return { acknowledged: false, matchedCount: 0, modifiedCount: 0 }
      }

      // Update the status and timestamp
      const result = await this.collections.orders.updateOne(
        { orderId },
        {
          $set: {
            status,
            updatedAt: new Date(),
            ...(status === 'Deployed' ? { deployedAt: new Date() } : {}),
            ...(status === 'Settled' ? { settledAt: new Date() } : {}),
          },
        },
      )

      return result
    } catch (error) {
      console.error(`Error updating order ${orderId} status to ${status}:`, error)
      throw error
    }
  }

  // Get order by ID
  async getOrder(orderId) {
    try {
      await this.connect()
      return await this.collections.orders.findOne({ orderId })
    } catch (error) {
      console.error(`Error getting order ${orderId}:`, error)
      throw error
    }
  }

  // Get orders by status
  async getOrdersByStatus(status) {
    try {
      await this.connect()
      return await this.collections.orders.find({ status }).toArray()
    } catch (error) {
      console.error(`Error getting orders with status ${status}:`, error)
      throw error
    }
  }
}

// Singleton instance
const mongoDBClient = new MongoDBClient()

export { mongoDBClient }
