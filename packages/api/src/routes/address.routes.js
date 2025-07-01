import express from 'express'
import { rateLimit } from 'express-rate-limit'
import * as addressController from '../controllers/address.controller.js'
import { validateRequest } from '../middleware/validateRequest.js'

const router = express.Router()

// Rate limit for register-address endpoint (more restrictive for DDoS protection)
const registerAddressLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 5, // 5 requests per minute
  standardHeaders: 'draft-7',
  legacyHeaders: false,
})

/**
 * @swagger
 * /register-address:
 *   post:
 *     summary: Register user address
 *     description: Registers a user address for a given chain and token.
 *     tags:
 *       - Address
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - address
 *             properties:
 *               destinationAddress:
 *                 type: string
 *                 description: The user's wallet address
 *               destinationChain:
 *                 type: string
 *                 description: The chain ID the address belongs to, default to Gnosis Chain ID (1)
 *               destinationToken:
 *                 type: string
 *                 description: (Optional) Token associated with the registration, default to EURe on Gnosis Chain
 *     responses:
 *       200:
 *         description: Address successfully registered
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Address registered successfully
 *       400:
 *         description: Bad request (e.g. validation error)
 *       429:
 *         description: Too many requests
 *       500:
 *         description: Internal server error
 */
router.post(
  '/register-address',
  registerAddressLimiter,
  validateRequest(addressController.registerAddressSchema),
  addressController.registerAddress,
)

export default router
