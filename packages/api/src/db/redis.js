import { createClient } from 'redis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let redisClient;

export const connectToRedis = async () => {
  try {
    redisClient = createClient({ url: REDIS_URL });
    
    // Add error handler
    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });
    
    await redisClient.connect();
    console.log('Connected to Redis');
    return redisClient;
  } catch (error) {
    console.error('Redis connection error:', error);
    throw error;
  }
};

export const getRedisClient = () => {
  if (!redisClient || !redisClient.isOpen) {
    throw new Error('Redis client not initialized or not connected. Call connectToRedis first.');
  }
  return redisClient;
};

export const disconnectFromRedis = async () => {
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit();
    console.log('Disconnected from Redis');
  }
};

// Process termination handlers
process.on('SIGINT', async () => {
  await disconnectFromRedis();
});

process.on('SIGTERM', async () => {
  await disconnectFromRedis();
});