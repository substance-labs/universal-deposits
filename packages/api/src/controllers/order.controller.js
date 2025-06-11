import { UniversalDeposits } from '@universal-deposits/sdk'
import { getCollection } from '../db/mongodb.js'
import { ApiError } from '../middleware/errorHandler.js'
import { orderParamsSchema, orderIdSchema } from '../schemas/validation.js'

/**
 * Get order by ID
 * @route GET /api/order/:orderId
 */
export const getOrderById = async (req, res, next) => {
  try {
    const { orderId } = req.params
    console.log('ORderId ', orderId)

    // Get order from database
    const ordersCollection = getCollection('orders')
    console.log('Orders ', ordersCollection)
    const order = await ordersCollection.findOne({ orderId })

    if (!order) {
      return next(ApiError.notFound(`Order with ID ${orderId} not found`, 'ORDER_NOT_FOUND'))
    }

    // Return response
    res.json({
      success: true,
      data: {
        orderId: order.orderId,
        status: order.status,
        sourceChain: order.sourceChainId,
        destinationChain: order.destinationChainId,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      },
    })
  } catch (error) {
    next(ApiError.internal(`Error getting order: ${error.message}`, 'DATABASE_ERROR'))
  }
}

/**
 * Get order by parameters
 * @route GET /api/order
 */
export const getOrderByParams = async (req, res, next) => {
  try {
    const {
      sourceChainToken,
      sourceChainUD,
      sourceChainId,
      destinationChainToken,
      destinationChainAddress,
      destinationChainId,
    } = req.query

    // Generate order ID from parameters
    const { orderId } = UniversalDeposits.generateOrderId({
      sourceChainId,
      destinationChainId,
      recipientAddress: destinationChainAddress,
      udAddress: sourceChainUD,
      sourceToken: sourceChainToken,
      destinationToken: destinationChainToken,
    })

    // Get order from database
    const ordersCollection = getCollection('orders')
    const order = await ordersCollection.findOne({ orderId })

    if (!order) {
      return next(ApiError.notFound('Order not found with the given parameters', 'ORDER_NOT_FOUND'))
    }

    // Return response
    res.json({
      success: true,
      data: {
        orderId: order.orderId,
        status: order.status,
        sourceChain: order.sourceChainId,
        destinationChain: order.destinationChainId,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      },
    })
  } catch (error) {
    next(ApiError.badRequest(`Error getting order: ${error.message}`, 'ORDER_QUERY_ERROR'))
  }
}

/**
 * Get order by parameters
 * @route GET /api/order
 */
export const getOrderByRecipientAddress = async (req, res, next) => {
  try {
    const { recipientAddress } = req.params
    console.log('getOrderByRecipientAddress called ', recipientAddress)

    if (!recipientAddress) {
      return next(ApiError.badRequest('recipientAddress is required', 'INVALID_QUERY'))
    }

    // Get order from database
    const ordersCollection = getCollection('orders')

    const orderCursor = await ordersCollection
      .find({ recipientAddress: recipientAddress })
      .sort({ createdAt: -1 }) // Sort by createdAt descending (latest first)
      .limit(1)

    const order = await orderCursor.next()

    console.log('The order ', order)
    if (!order) {
      return next(ApiError.notFound('Order not found with the given parameters', 'ORDER_NOT_FOUND'))
    }

    // Return response
    res.json({
      success: true,
      data: {
        orderId: order.orderId,
        status: order.status,
        sourceChain: order.sourceChainId,
        destinationChain: order.destinationChainId,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      },
    })
  } catch (error) {
    next(ApiError.badRequest(`Error getting order: ${error.message}`, 'ORDER_QUERY_ERROR'))
  }
}

/**
 * Generate deterministic order ID hash
 * @route GET /api/order-id
 */
export const generateOrderId = async (req, res, next) => {
  try {
    const {
      sourceChainToken,
      sourceChainUD,
      sourceChainId,
      destinationChainToken,
      destinationChainAddress,
      destinationChainId,
    } = req.query

    // Generate order ID
    const result = UniversalDeposits.generateOrderId({
      sourceChainId,
      destinationChainId,
      recipientAddress: destinationChainAddress,
      udAddress: sourceChainUD,
      sourceToken: sourceChainToken,
      destinationToken: destinationChainToken,
    })

    // Return response
    res.json({
      success: true,
      data: {
        orderId: result.orderId,
        parameters: {
          sourceChainId: Number(result.parameters.sourceChainId),
          destinationChainId: Number(result.parameters.destinationChainId),
          recipientAddress: result.parameters.recipientAddress,
          udAddress: result.parameters.udAddress,
          sourceToken: result.parameters.sourceToken,
          destinationToken: result.parameters.destinationToken,
        },
      },
    })
  } catch (error) {
    next(ApiError.badRequest(`Error generating order ID: ${error.message}`, 'ORDER_ID_ERROR'))
  }
}

// Export schemas for validation
export { orderParamsSchema, orderIdSchema }
