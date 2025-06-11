// give the address and parameter call settle
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'
import { createClient } from 'redis'
import { multiChainClient } from '../utils/multiChainClient.js'
import { QuoteService } from '@universal-deposits/sdk'
import { parseAbiItem, erc20Abi, encodeAbiParameters } from 'viem'
import { bridgeConfigs } from '../utils/config.js'

class SettleWorker {
  constructor(config = {}) {
    this.name = 'settle-worker'
    this.redisSubscriber = createClient({ url: REDIS_URL })
    this.redisDatabaseClient = createClient({ url: REDIS_URL })
    this.isRunning = false
    this.processInterval = config.processInterval || process.env.INTERVAL || 5000
    this.intervalId = null
    this.clientsInitialized = false
    this.quoteService = new QuoteService(bridgeConfigs)
  }

  async initializeChainClients() {
    try {
      if (!this.clientsInitialized) {
        const privateKey = process.env.DEPLOYER_PRIVATE_KEY
        if (!privateKey) {
          throw new Error('DEPLOYER_PRIVATE_KEY environment variable is required')
        }

        console.log('Initializing multi-chain clients for settlement...')
        await multiChainClient.initialize(privateKey)
        this.clientsInitialized = true

        const supportedChainIds = multiChainClient.getSupportedChainIds()
        console.log(`Initialized settlement clients for chains: ${supportedChainIds.join(', ')}`)
      }
    } catch (error) {
      console.error('Failed to initialize multi-chain clients for settlement:', error)
      throw error
    }
  }

  async getQuote(quoteRequest) {
    const quoteResponse = this.quoteService.getBestQuote(quoteRequest)
    return quoteResponse
  }

  async settle(order) {
    try {
      console.log('Settle worker processing order:', order.orderId)

      const { mongoDBClient } = await import('../utils/mongoClient.js')

      await mongoDBClient.updateOrderStatus(order.orderId, 'Settling')

      if (!this.clientsInitialized) {
        await this.initializeChainClients()
      }

      const destinationChainId = order.destinationChainId
      const sourceChainId = order.sourceChainId
      let publicClient = null
      let walletClient = null

      if (multiChainClient.isChainSupported(sourceChainId)) {
        console.log(`Using multi-chain client for settlement on chain ${sourceChainId}`)
        publicClient = multiChainClient.getPublicClient(sourceChainId)
        walletClient = multiChainClient.getWalletClient(sourceChainId)
      } else {
        console.warn(
          `No multi-chain client available for destination chain ${destinationChainId}, settlement may fail`,
        )
      }

      // =================== Quote Service ==============================
      // List available bridge services
      const availableServices = this.quoteService.getAvailableServices()
      console.log(`Available bridge services: ${availableServices.join(', ')}`)

      // ================================================================
      // TODO: Initialize proper logger

      // Prepare for settlement transaction if clients are available
      if (process.env.MODE !== 'dev') {
        try {
          // Get quote
          console.log('Getting quote for order ', order)

          const fromAmount = await publicClient.readContract({
            address: order.sourceToken,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [order.udAddress],
          })

          const logger = console

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
            slippage: 0.5,
          }
          let quoteResponse
          try {
            quoteResponse = await this.getQuote(quoteRequestFromOrder)
          } catch (error) {
            console.log('Error from get Quote ', error)
          }

          console.log('Quote Response ', quoteResponse)

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

          const hash = await walletClient.writeContract(settleRequest)
          logger.info(`Settlement transaction broadcasted @`, hash)
          let settleUrl
          if (quoteResponse.service == 'relaybridge') {
            settleUrl = `https://www.relay.link/transaction/${hash}`
          } else if (quoteResponse.service == 'lifi') {
            settleUrl = `ttps://scan.li.fi/tx/${hash}`
          } else if (quoteResponse.service == 'deBridge') {
            settleUrl = `https://app.debridge.finance/orders?s=${hash}`
          } else {
            settleUrl = 'Not supported'
          }

          await publicClient.waitForTransactionReceipt({
            hash,
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
          logger.info(`Settlement transaction broadcasted @`, hash)

          const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 2 })
          // TODO: fix the cow order
          // await maybeSubmitCoWOrder({ receipt, publicClient, safe });
          */
          await mongoDBClient.updateOrderStatus(order.orderId, 'Settled')

          // Also update the settlement timestamp
          await mongoDBClient.storeOrder({
            ...order,
            status: 'Settled',
            settledAt: new Date(),
            updatedAt: new Date(),
            settleUrl: settleUrl,
            settleOption: quoteResponse.service,
          })

          // Add to verification queue to confirm balance increase on destination chain
          const { redisQueueManager } = await import('../utils/redisQueue.js')
          await redisQueueManager.addToVerifyQueue(order)
          console.log('Order added to verification queue:', order.orderId)

          console.log('Order settled successfully:', order.orderId)
        } catch (error) {
          console.error(`Settlement transaction simulation failed:`, error)
          throw error
        }
      } else {
        console.warn('Settlement skipped: missing client or module address')
      }
    } catch (error) {
      console.error('Error during settlement:', error)
      const { mongoDBClient } = await import('../utils/mongoClient.js')
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
    try {
      const { redisQueueManager } = await import('../utils/redisQueue.js')
      const { mongoDBClient } = await import('../utils/mongoClient.js')

      const queueLength = await redisQueueManager.getSettleQueueLength()

      if (queueLength > 0) {
        console.log(`Processing settle queue. Items in queue: ${queueLength}`)

        const order = await redisQueueManager.getNextFromSettleQueue()

        if (order) {
          const latestOrder = await mongoDBClient.getOrder(order.orderId)

          if (latestOrder) {
            await this.settle(latestOrder)
          } else {
            // If for some reason the order is not in MongoDB, use the order from the queue
            await this.settle(order)
          }
        }
      } else {
        // Even if the queue is empty, check for any orders in "Deployed" status that need settlement
        const { mongoDBClient } = await import('../utils/mongoClient.js')
        const deployedOrders = await mongoDBClient.getOrdersByStatus('Deployed')
        if (deployedOrders && deployedOrders.length > 0) {
          console.log(`Found ${deployedOrders.length} deployed orders that need settlement`)
          // Process the first one
          await this.settle(deployedOrders[0])
          // Queue the rest if there are more
          for (let i = 1; i < deployedOrders.length; i++) {
            await redisQueueManager.addToSettleQueue(deployedOrders[i])
          }
        }
      }
    } catch (error) {
      console.error('Error processing settle queue:', error)
    }
  }

  async run() {
    try {
      // Connect to Redis
      await this.redisSubscriber.connect()
      await this.redisDatabaseClient.connect()

      // Initialize chain clients for settlement
      await this.initializeChainClients()

      if (this.isRunning) {
        console.log('Settle worker is already running')
        return
      }

      this.isRunning = true
      console.log('Settle worker started')

      await this.redisSubscriber.subscribe('universal-deposits:settle', async message => {
        console.log('Received message on channel:', message)
        if (message === 'settle_called') {
          console.log('Settle queue notification received')
          // Process immediately when notification received
          await this.processQueue()
        }
      })

      // Also set up interval for processing queue periodically
      // This ensures we process any items that might be missed by the pub/sub mechanism
      this.intervalId = setInterval(() => this.processQueue(), this.processInterval)
    } catch (error) {
      console.error('Error starting settle worker:', error)
      this.isRunning = false
    }
  }

  async stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }

    if (this.redisSubscriber.isOpen) {
      await this.redisSubscriber.unsubscribe('universal-deposits:settle')
      this.redisSubscriber.destroy()
    }

    if (this.redisDatabaseClient.isOpen) {
      this.redisDatabaseClient.destroy()
    }

    this.isRunning = false
    console.log('Settle worker stopped')
  }
}

export { SettleWorker }
