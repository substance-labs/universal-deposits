import { UniversalDeposits } from '@universal-deposits/sdk'
import { getRedisClient } from '../db/redis.js'
import { ApiError } from '../middleware/errorHandler.js'
import { registerAddressSchema } from '../schemas/validation.js'

/**
 * Register user address
 * @route POST /register-address
 */
export const registerAddress = async (req, res, next) => {
  try {
    console.log(req.body)
    const { destinationAddress, destinationToken, destinationChain } = req.body

    // Generate universal deposit address
    const ud = new UniversalDeposits({
      destinationAddress,
      destinationToken: destinationToken
        ? destinationToken
        : '0xcb444e90d8198415266c6a2724b7900fb12fc56e',
      destinationChain,
    })
    console.log('Destination token ', destinationToken)

    const universalDepositParams = ud.getUDSafeParams()
    const universalDepositAddress = universalDepositParams.contractAddress

    // Store in Redis
    const redisClient = getRedisClient()

    // // Add address to Redis hash
    // await redisClient.hSet('universal-deposits:addresses', {
    //   [address]: universalDepositAddress,
    // })

    // Add {recipient: string, JSON.stringify([universalDepositAddress, destinationToken]): string}
    // const value = await redisClient.hGet('universal-deposits:addresses', address)
    // const [universalDepositAddress, destinationToken] = JSON.parse(value)
    await redisClient.hSet('universal-deposits:addresses', {
      [destinationAddress]: JSON.stringify([universalDepositAddress, destinationToken]),
    })

    // Publish change event
    // TODO: remove as it is not used by balanceWatcher
    await redisClient.publish('universal-deposits:changes', 'address_added')

    // Return response
    res.status(200).json({
      success: true,
      message: 'Address registered successfully',
      data: {
        destinationAddress,
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
