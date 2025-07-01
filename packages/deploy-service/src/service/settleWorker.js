// give the address and parameter call settle
import { multiChainClient } from '../utils/multiChainClient.js'
import { QuoteService } from '@universal-deposits/sdk'
import { parseAbiItem, erc20Abi, encodeAbiParameters, createPublicClient, http } from 'viem'
import { bridgeConfigs } from '../utils/config.js'
import { databaseManager } from '../utils/databaseManager.js'
import { REDIS_ADDRESS_HASH_KEY } from '../utils/redisQueue.js'
import { gnosis } from 'viem/chains'
import { getServiceLogger } from '../utils/logger.js'

class SettleWorker {
  constructor(config = {}) {
    this.name = 'settle-worker'
    this.isRunning = false
    this.processInterval = config.processInterval || process.env.INTERVAL || 5000
    this.intervalId = null
    this.clientsInitialized = false
    this.databaseInitialized = false
    this.quoteService = new QuoteService(bridgeConfigs)
    this.logger = getServiceLogger('settleWorker')
  }

  async initializeChainClients() {
    try {
      if (!this.clientsInitialized) {
        const privateKey = process.env.DEPLOYER_PRIVATE_KEY
        if (!privateKey) {
          throw new Error('DEPLOYER_PRIVATE_KEY environment variable is required')
        }

        this.logger.info('Initializing multi-chain clients for settlement...')
        await multiChainClient.initialize(privateKey)
        this.clientsInitialized = true

        const supportedChainIds = multiChainClient.getSupportedChainIds()
        this.logger.info(
          `Initialized settlement clients for chains: ${supportedChainIds.join(', ')}`,
        )
      }
    } catch (error) {
      this.logger.error('Failed to initialize multi-chain clients for settlement:', error)
      throw error
    }
  }

  async getQuote(quoteRequest) {
    const quoteResponse = this.quoteService.getBestQuote(quoteRequest)
    return quoteResponse
  }

  async initializeDatabases() {
    if (!this.databaseInitialized) {
      await databaseManager.initialize()
      this.databaseInitialized = true
      this.logger.info('Databases initialized for SettleWorker')
    }
  }

  async settle(order) {
    try {
      this.logger.info('Settle worker processing order:', order.orderId)

      await this.initializeDatabases()
      const mongoDBClient = databaseManager.getMongoClient()

      await mongoDBClient.updateOrderStatus(order.orderId, 'Settling')

      if (!this.clientsInitialized) {
        await this.initializeChainClients()
      }

      const destinationChainId = order.destinationChainId
      const sourceChainId = order.sourceChainId
      let publicClient = null
      let walletClient = null
      // Check initial balance before adding to verification queue

      if (multiChainClient.isChainSupported(sourceChainId)) {
        this.logger.debug(`Using multi-chain client for settlement on chain ${sourceChainId}`)
        publicClient = multiChainClient.getPublicClient(sourceChainId)
        walletClient = multiChainClient.getWalletClient(sourceChainId)
      } else {
        this.logger.warn(
          `No multi-chain client available for destination chain ${destinationChainId}, settlement may fail`,
        )
      }

      // =================== Quote Service ==============================
      // List available bridge services
      const availableServices = this.quoteService.getAvailableServices()
      this.logger.info(`Available bridge services: ${availableServices.join(', ')}`)

      // ================================================================
      // TODO: Initialize proper logger

      // Prepare for settlement transaction if clients are available
      if (process.env.MODE !== 'dev') {
        try {
          // Get quote
          this.logger.info('Getting quote for order:', order.orderId)

          const fromAmount = await publicClient.readContract({
            address: order.sourceToken,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [order.udAddress],
          })

          const logger = this.logger

          logger.info(
            'Calling settle from token ',
            order.sourceToken,
            ' from chain ',
            order.sourceChainId,
            'for destination token ',
            order.destinationToken,
            'on chain ',
            destinationChainId,
            'with amount ',
            fromAmount,
          )

          const quoteRequestFromOrder = {
            fromChain: order.sourceChainId,
            toChain: order.destinationChainId,
            fromToken: order.sourceToken,
            toToken: order.destinationToken,
            fromAmount,
            fromAddress: order.udAddress,
            toAddress: order.recipientAddress, // have to explicitly define toAddress
            slippage: 0.5,
          }
          let quoteResponse
          try {
            quoteResponse = await this.getQuote(quoteRequestFromOrder)
          } catch (error) {
            this.logger.error('Error from get Quote:', error)
          }

          this.logger.debug('Quote Response:', quoteResponse)

          const to = quoteResponse.to
          const value = quoteResponse.value
          const data = quoteResponse.data
          const encodedData = encodeAbiParameters(
            [
              { name: 'to', type: 'address' },
              { name: 'value', type: 'uint256' },
              { name: 'data', type: 'bytes' },
            ],
            [to, value, data],
          )

          let settleUrl = 'Service is not supported'
          let hash = null
          
          if (process.env.MODE !== 'dev') {
            // Reference: calling multiSend from SafeModule delegate call  // https://www.tdly.co/shared/simulation/0f505608-69cd-4803-af95-d80b0634d0b7
            const { request: settleRequest } = await publicClient.simulateContract({
              account: walletClient.account,
              address: order.deploymentDetails.safeModuleProxy,
              abi: [
                parseAbiItem(
                  'function settleWithData(address safe, address token, bytes memory encodedTxData)',
                ),
              ],
              functionName: 'settleWithData',
              args: [order.deploymentDetails.universalSafe, order.sourceToken, encodedData],
            })

            hash = await walletClient.writeContract(settleRequest)
            logger.info(`Settlement transaction broadcasted:`, hash)
            
            // TODO: if service is relay bridge, it can be withint 5 seconds (~ 3 s)
            if (quoteResponse.service == 'relaybridge') {
              settleUrl = `https://www.relay.link/transaction/${hash}`
            } else if (quoteResponse.service == 'lifi') {
              settleUrl = `https://scan.li.fi/tx/${hash}`
            } else if (quoteResponse.service == 'deBridge') {
              settleUrl = `https://app.debridge.finance/orders?s=${hash}`
            }

            await publicClient.waitForTransactionReceipt({
              hash,
            })
          } else {
            // Dev mode: skip contract calls
            this.logger.info('[dev] Skipping simulateContract and writeContract calls')
            settleUrl = '[dev] Test settle url'
            hash = '[dev] mock-hash-' + Date.now()
          }
          
          // update the initialBalance before calling settle
          // to prevent the order is already completed before checking initial destination recipient balance
          // hardcoded GnosisChain as destination chain
          let initialBalance
          if (process.env.MODE !== 'dev') {
            const destinationPublicClient = createPublicClient({
              chain: gnosis,
              transport: http('https://rpc.gnosischain.com'),
            })

            // Record initial balance before verification starts
            initialBalance = await destinationPublicClient.readContract({
              address: order.destinationToken,
              abi: erc20Abi,
              functionName: 'balanceOf',
              args: [order.recipientAddress],
            })
          } else {
            // Dev mode: use mock initial balance
            initialBalance = BigInt('10000000000')
          }

          this.logger.info(
            `${process.env.MODE === 'dev' ? '[dev] ' : ''}Initial destination balance for ${order.recipientAddress}: ${initialBalance}`,
          )

          // Store the initial balance with the order
          await mongoDBClient.storeOrder({
            ...order,
            initialDestinationBalance: initialBalance.toString(),
            verificationStartedAt: new Date(),
          })

          // TODOO: update the status, and notify the destination balance watcher

          /*
        // TODO: fix the CowOrder
        const account = walletClient.account;

        const { request } = await this.publicClient.simulateContract({
          address,
          abi: safeModuleProxyAbi,
          functionName: 'settle',
          args: [safe, token],
          value,
          account,
          gas: 600000,
        })

        const hash = await walletClient.writeContract(request)
        logger.info(`Settlement transaction broadcasted:`, hash)

        const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 2 })
        // TODO: fix the cow order
        // await maybeSubmitCoWOrder({ receipt, publicClient, safe });
        */
          // await mongoDBClient.updateOrderStatus(order.orderId, 'Settled')
          // Also update the settlement timestamp
          await mongoDBClient.storeOrder({
            ...order,
            status: 'Settled',
            settledAt: new Date(),
            updatedAt: new Date(),
            settleUrl: settleUrl,
            settleOption: quoteResponse.service,
          })

          this.logger.info('Order settled successfully:', order.orderId)

          try {
            let currentBalance
            if (process.env.MODE !== 'dev') {
              const destinationPublicClient = createPublicClient({
                chain: gnosis,
                transport: http('https://rpc.gnosischain.com'),
              })
              
              // Check balance again immediately after the settlement to see if it already increased
              currentBalance = await destinationPublicClient.readContract({
                address: order.destinationToken,
                abi: erc20Abi,
                functionName: 'balanceOf',
                args: [order.recipientAddress],
              })
            } else {
              // Dev mode: simulate balance increase and set to Completed
              currentBalance = BigInt('10500000000') // Mock increased balance
              this.logger.info(`[dev] Simulating balance increase for order ${order.orderId}`)
            }

            if (currentBalance > initialBalance || process.env.MODE === 'dev') {
              this.logger.info(
                `${process.env.MODE === 'dev' ? '[dev] ' : ''}Balance already increased for order ${order.orderId}! Marking as Completed immediately`,
              )

              // Update order status to "Completed" directly without going through verification
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

              const redisQueueManager = databaseManager.getRedisQueueManager()
              await redisQueueManager.removeHashField(
                REDIS_ADDRESS_HASH_KEY,
                order.recipientAddress,
              )

              this.logger.info(`${process.env.MODE === 'dev' ? '[dev] ' : ''}Order completed successfully:`, order.orderId)
            } else {
              // Add to verification queue to confirm balance increase on destination chain (non-dev mode only)
              const redisQueueManager = databaseManager.getRedisQueueManager()
              const updatedOrder = await mongoDBClient.getOrder(order.orderId)
              await redisQueueManager.addToVerifyQueue(updatedOrder)

              this.logger.info('Order added to verification queue:', order.orderId)
            }
          } catch (error) {
            this.logger.error(`${process.env.MODE === 'dev' ? '[dev] ' : ''}Error checking initial destination balance:`, error)
            // // Continue with normal verification even if balance check fails
            //  const redisQueueManager = databaseManager.getRedisQueueManager()
            //  await redisQueueManager.addToVerifyQueue(order)
          }
        } catch (error) {
          this.logger.error(`Settlement transaction simulation failed:`, error)
          throw error
        }
      } else {
        this.logger.warn('Settlement skipped: missing client or module address')
      }
    } catch (error) {
      this.logger.error('Error during settlement:', error)
      const mongoDBClient = databaseManager.getMongoClient()
      await mongoDBClient.updateOrderStatus(order.orderId, 'SettlementFailed')

      // Also update error information
      await mongoDBClient.storeOrder({
        ...order,
        status: 'SettlementFailed',
        lastError: error.message || 'Unknown error during settlement',
        updatedAt: new Date(),
      })
    }
  }

  async processQueue() {
    await this.initializeDatabases()
    const redisQueueManager = databaseManager.getRedisQueueManager()
    const mongoDBClient = databaseManager.getMongoClient()

    if (process.env.MODE == 'dev') {
      const order = await redisQueueManager.getNextFromSettleQueue()
      if (!order) {
        this.logger.warn('[dev] No order found in settle queue')
        return
      }

      // Acquire a lock to ensure no other worker processes this order
      const lockAcquired = await redisQueueManager.acquireLock(order.orderId)
      if (!lockAcquired) {
        this.logger.info(
          `[dev] Order ${order.orderId} is being processed by another worker, skipping`,
        )
        // Return to processing queue for later recovery
        await redisQueueManager.completeSettleProcessing(order.orderId)
        return
      }

      try {
        const latestOrder = await mongoDBClient.getOrder(order.orderId)
        
        // Run the same logic as non-dev mode but skip contract calls
        await this.settle(latestOrder)

        // Mark processing as complete and release lock
        await redisQueueManager.completeSettleProcessing(order.orderId)
        await redisQueueManager.releaseLock(order.orderId)
      } catch (error) {
        this.logger.error(`[dev] Error processing settle order ${order.orderId}:`, error)
      } finally {
        // Always release the lock even if there was an error
        await redisQueueManager.releaseLock(order.orderId)
      }
    } else {
      try {
        const queueLength = await redisQueueManager.getSettleQueueLength()

        if (queueLength > 0) {
          this.logger.info(`Processing settle queue. Items in queue: ${queueLength}`)

          const order = await redisQueueManager.getNextFromSettleQueue()

          if (order) {
            // Acquire lock to ensure exclusive processing
            const lockAcquired = await redisQueueManager.acquireLock(order.orderId)
            if (!lockAcquired) {
              this.logger.info(
                `Order ${order.orderId} is being processed by another settle worker, skipping`,
              )
              // Return item to processing queue for recovery later
              await redisQueueManager.completeSettleProcessing(order.orderId)
              return
            }

            try {
              const latestOrder = await mongoDBClient.getOrder(order.orderId)

              if (latestOrder) {
                // Only process if status is 'Deployed' or if settling failed with limited retries
                if (
                  latestOrder.status === 'Deployed' ||
                  (latestOrder.status === 'SettlementFailed' && (latestOrder.retryCount || 0) < 3)
                ) {
                  await this.settle(latestOrder)
                } else {
                  this.logger.info(
                    `Skipping order ${order.orderId} - status is ${latestOrder.status}`,
                  )
                }
              } else {
                // If not found in MongoDB, process it anyway and it will be created
                await this.settle(order)
              }

              // Mark as complete in processing queue
              await redisQueueManager.completeSettleProcessing(order.orderId)
            } catch (error) {
              this.logger.error(`Error processing settle order ${order.orderId}:`, error)
            } finally {
              // Always release the lock
              await redisQueueManager.releaseLock(order.orderId)
            }
          }
        } else {
          // Even if the queue is empty, check for any orders in "Deployed" status that need settlement
          const mongoDBClient = databaseManager.getMongoClient()
          const deployedOrders = await mongoDBClient.getOrdersByStatus('Deployed')
          if (deployedOrders && deployedOrders.length > 0) {
            this.logger.info(`Found ${deployedOrders.length} deployed orders that need settlement`)
            // Process the first one
            await this.settle(deployedOrders[0])
            // Queue the rest if there are more
            for (let i = 1; i < deployedOrders.length; i++) {
              await redisQueueManager.addToSettleQueue(deployedOrders[i])
            }
          }
        }
      } catch (error) {
        this.logger.error('Error processing settle queue:', error)
      }
    }
  }

  async run() {
    try {
      // Initialize databases
      await this.initializeDatabases()

      // Initialize chain clients for settlement
      await this.initializeChainClients()

      if (this.isRunning) {
        this.logger.info('Settle worker is already running')
        return
      }

      this.isRunning = true
      this.logger.info('Settle worker started')

      // Start recovery check for hanging items
      this.recoveryInterval = setInterval(async () => {
        try {
          const redisQueueManager = databaseManager.getRedisQueueManager()
          await redisQueueManager.recoverHangingItems()
        } catch (error) {
          this.logger.error('Error recovering hanging items in settle worker:', error)
        }
      }, 60000) // Check every minute

      await databaseManager.subscribe('universal-deposits:settle', async message => {
        this.logger.debug('Received message on channel:', message)
        if (message === 'settle_called') {
          this.logger.info('Settle queue notification received')
          // Process immediately when notification received
          await this.processQueue()
        }
      })

      // Also set up interval for processing queue periodically
      // This ensures we process any items that might be missed by the pub/sub mechanism
      // TODO: remove this to only listen to the redis queue  in order to avoid duplicated order processing
      // this.intervalId = setInterval(() => this.processQueue(), this.processInterval)
    } catch (error) {
      this.logger.error('Error starting settle worker:', error)
      this.isRunning = false
    }
  }

  async stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }

    if (this.recoveryInterval) {
      clearInterval(this.recoveryInterval)
      this.recoveryInterval = null
    }

    await databaseManager.cleanup()
    this.databaseInitialized = false

    this.isRunning = false
    this.logger.info('Settle worker stopped')
  }
}

export { SettleWorker }
