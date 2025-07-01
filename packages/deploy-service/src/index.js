import { BalanceWatcher } from './service/balanceWatcher.js'
import { DeployWorker } from './service/deployWorker.js'
import { SettleWorker } from './service/settleWorker.js'
import { CompletionVerifier } from './service/completionVerifier.js'
import { getServiceLogger } from './utils/logger.js'

const logger = getServiceLogger('main')

const initializeServices = async () => {
  try {
    const { mongoDBClient } = await import('./utils/mongoClient.js')
    await mongoDBClient.connect()
    logger.info('MongoDB connected successfully')

    const { redisQueueManager } = await import('./utils/redisQueue.js')
    await redisQueueManager.connect()
    logger.info('Redis queue manager connected successfully')

    // Create and start services
    const balanceWatcher = new BalanceWatcher({
      interval: process.env.INTERVAL,
    })

    const deployWorker = new DeployWorker({
      processInterval: process.env.INTERVAL,
    })

    const settleWorker = new SettleWorker({
      processInterval: process.env.INTERVAL,
    })

    const completionVerifier = new CompletionVerifier({
      processInterval: process.env.INTERVAL,
      checkBalanceInterval: process.env.INTERVAL,
    })

    logger.info('Starting universal-deposits services...')

    await Promise.all([
      balanceWatcher.run(),
      deployWorker.run(),
      settleWorker.run(),
      completionVerifier.run(),
    ])

    logger.info('All services started successfully')

    const shutdown = async () => {
      logger.info('Shutting down all services...')

      try {
        await Promise.all([
          balanceWatcher.cleanup(),
          deployWorker.stop(),
          settleWorker.stop(),
          completionVerifier.stop(),
        ])

        await mongoDBClient.disconnect()
        await redisQueueManager.destroy()

        logger.info('All services stopped successfully')
        process.exit(0)
      } catch (error) {
        logger.error('Error during shutdown:', error)
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
    logger.error('Error initializing services:', error)
    process.exit(1)
  }
}

// Start all services
initializeServices()
  .then(services => {
    logger.info('Universal Deposits system running with MongoDB storage and Redis queues')
  })
  .catch(error => {
    logger.error('Failed to start services:', error)
    process.exit(1)
  })
