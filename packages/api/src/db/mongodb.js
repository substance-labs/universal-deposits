import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/universal-deposits';

let client;
let db;

export const connectToMongoDB = async () => {
  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db();
    
    // Create collections and indexes
    const orders = db.collection('orders');
    await orders.createIndex({ orderId: 1 }, { unique: true });
    await orders.createIndex({ sourceChainId: 1 });
    await orders.createIndex({ destinationChainId: 1 });
    await orders.createIndex({ status: 1 });
    
    console.log('Connected to MongoDB');
    return db;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
};

export const getDb = () => {
  if (!db) {
    throw new Error('MongoDB not initialized. Call connectToMongoDB first.');
  }
  return db;
};

export const getCollection = (collectionName) => {
  return getDb().collection(collectionName);
};

export const disconnectFromMongoDB = async () => {
  if (client) {
    await client.close();
    console.log('Disconnected from MongoDB');
  }
};

// Process termination handlers
process.on('SIGINT', async () => {
  await disconnectFromMongoDB();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await disconnectFromMongoDB();
  process.exit(0);
});