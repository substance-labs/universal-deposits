import express from 'express'
import { rateLimit } from 'express-rate-limit'
import * as safeController from '../controllers/safe.controller.js'
import { validateQueryParams } from '../middleware/validateRequest.js'

const router = express.Router()

// Rate limit for safe-deployed endpoint
const safeDeployedLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 30, // 30 requests per minute
  standardHeaders: 'draft-7',
  legacyHeaders: false,
})

/**
 * @swagger
 * /safe-deployed:
 *   get:
 *     summary: Check if Safe contracts are deployed on source chain
 *     description: Verifies whether the Universal Deposits Safe contracts (UDSafe, SafeModuleLogic, and SafeModuleProxy) are properly deployed on the specified source chain.
 *     tags:
 *       - Safe Contracts
 *     parameters:
 *       - in: query
 *         name: sourceChainId
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *         description: Chain ID of the source blockchain where Safe contracts should be checked.
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
 *         description: Safe contracts deployment status retrieved successfully
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
 *                     isDeployed:
 *                       type: boolean
 *                       example: true
 *                       description: Whether all required Safe contracts are deployed
 *                     contracts:
 *                       type: object
 *                       properties:
 *                         udSafe:
 *                           type: object
 *                           properties:
 *                             address:
 *                               type: string
 *                               example: "0x1234567890abcdef1234567890abcdef12345678"
 *                               description: Address of the UDSafe contract
 *                             hasCode:
 *                               type: boolean
 *                               example: true
 *                               description: Whether the contract has bytecode deployed
 *                         safeModuleLogic:
 *                           type: object
 *                           properties:
 *                             address:
 *                               type: string
 *                               example: "0x2345678901abcdef234567890abcdef123456789"
 *                               description: Address of the SafeModuleLogic contract
 *                             hasCode:
 *                               type: boolean
 *                               example: true
 *                               description: Whether the contract has bytecode deployed
 *                         safeModuleProxy:
 *                           type: object
 *                           properties:
 *                             address:
 *                               type: string
 *                               example: "0x3456789012abcdef34567890abcdef1234567890"
 *                               description: Address of the SafeModuleProxy contract
 *                             hasCode:
 *                               type: boolean
 *                               example: true
 *                               description: Whether the contract has bytecode deployed
 *       400:
 *         description: Bad request - invalid parameters or unsupported chain
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
 *                       example: "Unsupported source chain ID: 999"
 *                     code:
 *                       type: string
 *                       example: "INVALID_CHAIN_ID"
 *       500:
 *         description: Internal server error - Safe deployment check failed
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
 *                       example: "Error checking Safe deployment: RPC connection failed"
 *                     code:
 *                       type: string
 *                       example: "SAFE_DEPLOYMENT_ERROR"
 */
router.get(
  '/safe-deployed',
  safeDeployedLimiter,
  validateQueryParams(safeController.safeDeployedSchema),
  safeController.checkSafeDeployed,
)

export default router
