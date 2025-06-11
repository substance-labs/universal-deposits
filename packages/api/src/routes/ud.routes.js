import express from 'express'
import { rateLimit } from 'express-rate-limit'
import * as udController from '../controllers/ud.controller.js'
import { validateQuery } from '../middleware/validateRequest.js'
import { udSafeAddressSchema } from '../schemas/validation.js'

const router = express.Router()

// Rate limit for UD safe address endpoint
const udSafeAddressLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 30, // 30 requests per minute
  standardHeaders: 'draft-7',
  legacyHeaders: false,
})

/**
 * @swagger
 * /ud-address:
 *   get:
 *     summary: Get Universal Deposit Safe address for given parameters
 *     tags: [Safe Addresses]
 *     description: Returns a Universal Deposit Safe address based on destination parameters
 *     parameters:
 *       - in: query
 *         name: destinationToken
 *         required: true
 *         schema:
 *           type: string
 *         description: Destination token contract address (must be a valid Ethereum address)
 *       - in: query
 *         name: destinationChain
 *         required: true
 *         schema:
 *           type: integer
 *         description: Destination chain ID
 *       - in: query
 *         name: destinationRecipient
 *         required: true
 *         schema:
 *           type: string
 *         description: Recipient address on destination chain (must be a valid Ethereum address)
 *     responses:
 *       200:
 *         description: Universal Deposit Safe address and parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UDSafeAddress'
 *       400:
 *         description: Bad request - invalid parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Too many requests - rate limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  '/ud-address',
  udSafeAddressLimiter,
  validateQuery(udSafeAddressSchema),
  udController.getUDSafeAddress,
)

export default router
