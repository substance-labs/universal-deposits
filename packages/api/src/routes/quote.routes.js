import express from 'express'
import { rateLimit } from 'express-rate-limit'
import * as quoteController from '../controllers/quote.controller.js'
import { validateQueryParams } from '../middleware/validateRequest.js'

const router = express.Router()

// Rate limit for quote endpoint (more restrictive due to external API calls)
const quoteLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 10, // 10 requests per minute
  standardHeaders: 'draft-7',
  legacyHeaders: false,
})

/**
 * @swagger
 * /api/quote:
 *   get:
 *     summary: Get bridge quote for cross-chain transfer
 *     description: Returns the best quote for a cross-chain token transfer.
 *     tags:
 *       - Bridge
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
 *         description: The token address on the destination chain.
 *       - in: query
 *         name: destinationChainAddress
 *         required: true
 *         schema:
 *           type: string
 *         description: The user address on the destination chain.
 *       - in: query
 *         name: destinationChainId
 *         required: true
 *         schema:
 *           type: integer
 *           example: 100
 *         description: Chain ID of the destination blockchain.
 *       - in: query
 *         name: amount
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[0-9]+$'
 *           example: "1000000000000000000"
 *         description: Amount to send in wei (as a numeric string).
 *     responses:
 *       200:
 *         description: Successful quote response
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
 *                     bridge:
 *                       type: string
 *                       example: "hop"
 *                     tool:
 *                       type: string
 *                       example: "hop-mainnet"
 *                     inputAmount:
 *                       type: string
 *                       example: "1000000000000000000"
 *                     expectedOutput:
 *                       type: string
 *                       example: "990000000000000000"
 *                     slippage:
 *                       type: string
 *                       example: "0.5"
 *                     estimatedGas:
 *                       type: string
 *                       example: "100000"
 *                     executionTime:
 *                       type: string
 *                       example: "30 seconds"
 *                     approvalRequired:
 *                       type: boolean
 *                       example: true
 *                     approvalAddress:
 *                       type: string
 *                       example: "0xapprovalContractAddress"
 *       400:
 *         description: Invalid input or quote error
 */

router.get(
  '/quote',
  quoteLimiter,
  validateQueryParams(quoteController.quoteSchema),
  quoteController.getQuote,
)

export default router
