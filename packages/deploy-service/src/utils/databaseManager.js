import { createClient } from 'redis';
import { mongoDBClient } from './mongoClient.js';
import { redisQueueManager } from './redisQueue.js';
import { getServiceLogger } from './logger.js';

const logger = getServiceLogger('database');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

class DatabaseManager {
  constructor() {
    this.initialized = false;
    this.redisClients = {
      subscriber: null,
      publisher: null,
      database: null
    };
    this.subscriptions = new Map();
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Initialize MongoDB connection
      await mongoDBClient.connect();
      logger.info('MongoDB connected successfully via DatabaseManager');

      // Initialize Redis Queue Manager
      await redisQueueManager.connect();
      logger.info('Redis queue manager connected successfully via DatabaseManager');

      // Initialize Redis clients
      await this.initializeRedisClients();

      this.initialized = true;
      logger.info('All database connections initialized successfully');
    } catch (error) {
      logger.error('Error initializing database connections:', error);
      throw error;
    }
  }

  async initializeRedisClients() {
    // Setup database client
    this.redisClients.database = createClient({ url: REDIS_URL });
    this.redisClients.database.on('error', err => {
      logger.error('Redis Database Client Error:', err);
      this.handleRedisError('database', err);
    });

    // Setup publisher client
    this.redisClients.publisher = createClient({ url: REDIS_URL });
    this.redisClients.publisher.on('error', err => {
      logger.error('Redis Publisher Client Error:', err);
      this.handleRedisError('publisher', err);
    });

    // Setup subscriber client
    this.redisClients.subscriber = createClient({ url: REDIS_URL });
    this.redisClients.subscriber.on('error', err => {
      logger.error('Redis Subscriber Client Error:', err);
      this.handleRedisError('subscriber', err);
    });

    // Connect all clients
    await Promise.all([
      this.redisClients.database.connect(),
      this.redisClients.publisher.connect(),
      this.redisClients.subscriber.connect()
    ]);

    // Set up reconnection handlers
    for (const [clientType, client] of Object.entries(this.redisClients)) {
      client.on('reconnect', () => {
        logger.info(`Redis ${clientType} client reconnected`);
        if (clientType === 'subscriber') {
          this.reestablishSubscriptions();
        }
      });
    }

    logger.info('All Redis clients connected successfully');
  }

  async handleRedisError(clientType, error) {
    logger.error(`Redis ${clientType} client error:`, error);
    // Check if connection is lost and try to reconnect
    if (!this.redisClients[clientType].isOpen) {
      logger.info(`Redis ${clientType} client disconnected, attempting to reconnect...`);
      try {
        await this.redisClients[clientType].connect();
        logger.info(`Redis ${clientType} client reconnected successfully`);
        
        if (clientType === 'subscriber') {
          await this.reestablishSubscriptions();
        }
      } catch (reconnectError) {
        logger.error(`Failed to reconnect Redis ${clientType} client:`, reconnectError);
      }
    }
  }

  async reestablishSubscriptions() {
    logger.info('Reestablishing Redis subscriptions...');
    for (const [channel, callback] of this.subscriptions.entries()) {
      try {
        await this.redisClients.subscriber.subscribe(channel, callback);
        logger.info(`Successfully resubscribed to channel: ${channel}`);
      } catch (error) {
        logger.error(`Failed to resubscribe to channel ${channel}:`, error);
      }
    }
  }

  async subscribe(channel, callback) {
    await this.initialize();
    await this.redisClients.subscriber.subscribe(channel, callback);
    this.subscriptions.set(channel, callback);
    logger.info(`Subscribed to Redis channel: ${channel}`);
  }

  async publish(channel, message) {
    await this.initialize();
    return this.redisClients.publisher.publish(channel, message);
  }

  getRedisClient(type = 'database') {
    if (!this.initialized) {
      throw new Error('DatabaseManager not initialized. Call initialize() first.');
    }
    return this.redisClients[type];
  }

  getMongoClient() {
    if (!this.initialized) {
      throw new Error('DatabaseManager not initialized. Call initialize() first.');
    }
    return mongoDBClient;
  }

  getRedisQueueManager() {
    if (!this.initialized) {
      throw new Error('DatabaseManager not initialized. Call initialize() first.');
    }
    return redisQueueManager;
  }

  async cleanup() {
    logger.info('Cleaning up database connections...');
    
    // Unsubscribe from all channels
    if (this.redisClients.subscriber?.isOpen) {
      for (const channel of this.subscriptions.keys()) {
        try {
          await this.redisClients.subscriber.unsubscribe(channel);
          logger.info(`Unsubscribed from channel: ${channel}`);
        } catch (error) {
          logger.error(`Error unsubscribing from channel ${channel}:`, error);
        }
      }
      this.subscriptions.clear();
    }

    // Close Redis connections
    for (const [clientType, client] of Object.entries(this.redisClients)) {
      if (client?.isOpen) {
        client.destroy();
        logger.info(`Redis ${clientType} client disconnected`);
      }
    }

    // Close Redis queue manager
    await redisQueueManager.destroy();
    logger.info('Redis queue manager disconnected');

    // Close MongoDB connection
    await mongoDBClient.disconnect();
    logger.info('MongoDB disconnected');

    this.initialized = false;
    logger.info('All database connections cleaned up successfully');
  }

  // Helper methods for common operations
  async readFromRedisHash(hashName) {
    await this.initialize();
    return this.redisClients.database.hGetAll(hashName);
  }

  async writeToRedisHash(hashName, field, value) {
    await this.initialize();
    return this.redisClients.database.hSet(hashName, field, value);
  }
}

// Create and export singleton instance
const databaseManager = new DatabaseManager();

export { databaseManager };