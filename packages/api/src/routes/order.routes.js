import express from 'express'
import { rateLimit } from 'express-rate-limit'
import * as orderController from '../controllers/order.controller.js'
import { validateQueryParams } from '../middleware/validateRequest.js'

const router = express.Router()

// Rate limit for order endpoints
const orderLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 30, // 30 requests per minute
  standardHeaders: 'draft-7',
  legacyHeaders: false,
})

/**
 * @swagger
 * /order/orderId/{orderId}:
 *   get:
 *     summary: Get order by ID
 *     description: Retrieves a specific order using its unique order ID.
 *     tags:
 *       - Orders
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *           example: "0x1234567890abcdef1234567890abcdef12345678"
 *         description: The unique order ID hash.
 *     responses:
 *       200:
 *         description: Successful order retrieval
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     orderId:
 *                       type: string
 *                       example: "0x1234567890abcdef1234567890abcdef12345678"
 *                     sourceChainToken:
 *                       type: string
 *                       example: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
 *                     sourceChainUD:
 *                       type: string
 *                       example: "0xuser1234567890abcdef1234567890abcdef1234"
 *                     sourceChainId:
 *                       type: integer
 *                       example: 1
 *                     destinationChainToken:
 *                       type: string
 *                       example: "0xdddddddddddddddddddddddddddddddddddddddd"
 *                     destinationChainAddress:
 *                       type: string
 *                       example: "0xuser5678901234567890abcdef1234567890ab"
 *                     destinationChainId:
 *                       type: integer
 *                       example: 100
 *                     status:
 *                       type: string
 *                       example: "pending"
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-01T12:00:00Z"
 *       404:
 *         description: Order not found
 *       400:
 *         description: Invalid order ID format
 */
router.get('/order/orderId/:orderId', orderLimiter, orderController.getOrderById)

/**
 * @swagger
 * /order:
 *   get:
 *     summary: Get order by parameters
 *     description: Retrieves an order by matching specific cross-chain transfer parameters.
 *     tags:
 *       - Orders
 *     parameters:
 *       - in: query
 *         name: sourceChainToken
 *         required: true
 *         schema:
 *           type: string
 *           example: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
 *         description: The token address on the source chain.
 *       - in: query
 *         name: sourceChainUD
 *         required: true
 *         schema:
 *           type: string
 *           example: "0xuser1234567890abcdef1234567890abcdef1234"
 *         description: The user address on the source chain.
 *       - in: query
 *         name: sourceChainId
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *         description: Chain ID of the source blockchain.
 *       - in: query
 *         name: destinationChainToken
 *         required: true
 *         schema:
 *           type: string
 *           example: "0xdddddddddddddddddddddddddddddddddddddddd"
 *         description: The token address on the destination chain.
 *       - in: query
 *         name: destinationChainAddress
 *         required: true
 *         schema:
 *           type: string
 *           example: "0xuser5678901234567890abcdef1234567890ab"
 *         description: The user address on the destination chain.
 *       - in: query
 *         name: destinationChainId
 *         required: true
 *         schema:
 *           type: integer
 *           example: 100
 *         description: Chain ID of the destination blockchain.
 *     responses:
 *       200:
 *         description: Successful order retrieval
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     orderId:
 *                       type: string
 *                       example: "0x1234567890abcdef1234567890abcdef12345678"
 *                     sourceChainToken:
 *                       type: string
 *                       example: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
 *                     sourceChainUD:
 *                       type: string
 *                       example: "0xuser1234567890abcdef1234567890abcdef1234"
 *                     sourceChainId:
 *                       type: integer
 *                       example: 1
 *                     destinationChainToken:
 *                       type: string
 *                       example: "0xdddddddddddddddddddddddddddddddddddddddd"
 *                     destinationChainAddress:
 *                       type: string
 *                       example: "0xuser5678901234567890abcdef1234567890ab"
 *                     destinationChainId:
 *                       type: integer
 *                       example: 100
 *                     status:
 *                       type: string
 *                       example: "pending"
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-01T12:00:00Z"
 *       404:
 *         description: Order not found with the specified parameters
 *       400:
 *         description: Invalid input parameters
 */
router.get(
  '/order',
  orderLimiter,
  validateQueryParams(orderController.orderParamsSchema),
  orderController.getOrderByParams,
)

/**
 * @swagger
 * /order-id:
 *   get:
 *     summary: Generate deterministic order ID hash
 *     description: Generates a deterministic hash that can be used as an order ID based on cross-chain transfer parameters.
 *     tags:
 *       - Orders
 *     parameters:
 *       - in: query
 *         name: sourceChainToken
 *         required: true
 *         schema:
 *           type: string
 *           example: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
 *         description: The token address on the source chain.
 *       - in: query
 *         name: sourceChainUD
 *         required: true
 *         schema:
 *           type: string
 *           example: "0xuser1234567890abcdef1234567890abcdef1234"
 *         description: The user address on the source chain.
 *       - in: query
 *         name: sourceChainId
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *         description: Chain ID of the source blockchain.
 *       - in: query
 *         name: destinationChainToken
 *         required: true
 *         schema:
 *           type: string
 *           example: "0xdddddddddddddddddddddddddddddddddddddddd"
 *         description: The token address on the destination chain.
 *       - in: query
 *         name: destinationChainAddress
 *         required: true
 *         schema:
 *           type: string
 *           example: "0xuser5678901234567890abcdef1234567890ab"
 *         description: The user address on the destination chain.
 *       - in: query
 *         name: destinationChainId
 *         required: true
 *         schema:
 *           type: integer
 *           example: 100
 *         description: Chain ID of the destination blockchain.
 *     responses:
 *       200:
 *         description: Successfully generated order ID
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     orderId:
 *                       type: string
 *                       example: "0x1234567890abcdef1234567890abcdef12345678"
 *                     hash:
 *                       type: string
 *                       example: "0x1234567890abcdef1234567890abcdef12345678"
 *       400:
 *         description: Invalid input parameters
 */
router.get(
  '/order-id',
  orderLimiter,
  validateQueryParams(orderController.orderIdSchema),
  orderController.generateOrderId,
)

/**
 * @swagger
 * /order/recipient/{recipientAddress}:
 *   get:
 *     summary: Get order by recipient address
 *     description: Retrieves an order by the recipient address. Note that if multiple orders exist for the same recipient address, this endpoint returns one of them (implementation may vary).
 *     tags:
 *       - Orders
 *     parameters:
 *       - in: path
 *         name: recipientAddress
 *         required: true
 *         schema:
 *           type: string
 *           example: "0xuser5678901234567890abcdef1234567890ab"
 *         description: The recipient address to search for in orders.
 *     responses:
 *       200:
 *         description: Successfully retrieved order by recipient address
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     orderId:
 *                       type: string
 *                       example: "0x1234567890abcdef1234567890abcdef12345678"
 *                       description: The unique order identifier
 *                     status:
 *                       type: string
 *                       example: "pending"
 *                       description: Current status of the order
 *                     sourceChain:
 *                       type: integer
 *                       example: 1
 *                       description: Chain ID of the source blockchain
 *                     destinationChain:
 *                       type: integer
 *                       example: 100
 *                       description: Chain ID of the destination blockchain
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-01T12:00:00.000Z"
 *                       description: Timestamp when the order was created
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-01T12:30:00.000Z"
 *                       description: Timestamp when the order was last updated
 *       404:
 *         description: Order not found with the given recipient address
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "Order not found with the given parameters"
 *                     code:
 *                       type: string
 *                       example: "ORDER_NOT_FOUND"
 *       400:
 *         description: Bad request - error querying order
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "Error getting order: Database connection failed"
 *                     code:
 *                       type: string
 *                       example: "ORDER_QUERY_ERROR"
 */
router.get(
  '/order/recipient/:recipientAddress',
  orderLimiter,
  orderController.getOrderByRecipientAddress,
)

export default router
