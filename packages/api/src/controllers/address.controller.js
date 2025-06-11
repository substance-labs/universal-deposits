import { UniversalDeposits } from '@universal-deposits/sdk'
import { getRedisClient } from '../db/redis.js'
import { ApiError } from '../middleware/errorHandler.js'
import { registerAddressSchema } from '../schemas/validation.js'

/**
 * Register user address
 * @route POST /api/register-address
 */
export const registerAddress = async (req, res, next) => {
  try {
    const { address, destinationToken, destinationChain } = req.body

    // Use provided values or defaults
    const DESTINATION_CHAIN = destinationChain || 100 // Gnosis Chain
    const DESTINATION_TOKEN = destinationToken || '0xcb444e90d8198415266c6a2724b7900fb12fc56e' // EURe on Gnosis

    // Generate universal deposit address
    const ud = new UniversalDeposits({
      destinationAddress: address,
      destinationToken: DESTINATION_TOKEN,
      destinationChain: DESTINATION_CHAIN,
    })

    const universalDepositParams = ud.getUDSafeParams()
    const universalDepositAddress = universalDepositParams.contractAddress

    // Store in Redis
    const redisClient = getRedisClient()

    // Add address to Redis hash
    await redisClient.hSet('universal-deposits:addresses', {
      [address]: universalDepositAddress,
    })

    // Publish change event
    await redisClient.publish('universal-deposits:changes', 'address_added')

    // Return response
    res.status(200).json({
      success: true,
      message: 'Address registered successfully',
      data: {
        address,
        udAddress: universalDepositAddress,
        registeredAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    next(
      ApiError.badRequest(
        `Error registering address: ${error.message}`,
        'ADDRESS_REGISTRATION_ERROR',
      ),
    )
  }
}

// Export schema for validation
export { registerAddressSchema }
