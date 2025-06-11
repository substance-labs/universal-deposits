import { BalanceWatcher } from './service/balanceWatcher.js'
import { DeployWorker } from './service/deployWorker.js'
import { SettleWorker } from './service/settleWorker.js'
import { CompletionVerifier } from './service/completionVerifier.js'

const initializeServices = async () => {
  try {
    const { mongoDBClient } = await import('./utils/mongoClient.js')
    await mongoDBClient.connect()
    console.log('MongoDB connected successfully')

    const { redisQueueManager } = await import('./utils/redisQueue.js')
    await redisQueueManager.connect()
    console.log('Redis queue manager connected successfully')

    // Create and start services
    const balanceWatcher = new BalanceWatcher({
      interval: process.env.INTERVAL, // Check every 5 seconds
    })

    const deployWorker = new DeployWorker({
      processInterval: process.env.INTERVAL, // Process queue every 5 seconds
    })

    const settleWorker = new SettleWorker({
      processInterval: process.env.INTERVAL, // Process queue every 5 seconds
    })

    const completionVerifier = new CompletionVerifier({
      processInterval: process.env.INTERVAL, // Process verification queue every 5 seconds
      checkBalanceInterval: 15000, // Check balance every 15 seconds
    })

    console.log('Starting universal-deposits services...')

    await Promise.all([
      balanceWatcher.run(),
      deployWorker.run(),
      settleWorker.run(),
      completionVerifier.run(),
    ])

    console.log('All services started successfully')

    const shutdown = async () => {
      console.log('Shutting down all services...')

      try {
        await Promise.all([
          balanceWatcher.cleanup(),
          deployWorker.stop(),
          settleWorker.stop(),
          completionVerifier.stop(),
        ])

        await mongoDBClient.disconnect()
        await redisQueueManager.destroy()

        console.log('All services stopped successfully')
        process.exit(0)
      } catch (error) {
        console.error('Error during shutdown:', error)
        process.exit(1)
      }
    }

    // Register shutdown handlers
    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)

    return {
      balanceWatcher,
      deployWorker,
      settleWorker,
      completionVerifier,
    }
  } catch (error) {
    console.error('Error initializing services:', error)
    process.exit(1)
  }
}

// Start all services
initializeServices()
  .then(services => {
    console.log('Universal Deposits system running with MongoDB storage and Redis queues')
  })
  .catch(error => {
    console.error('Failed to start services:', error)
    process.exit(1)
  })
