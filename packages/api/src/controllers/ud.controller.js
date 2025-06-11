import { UniversalDeposits } from '@universal-deposits/sdk';
import { ApiError } from '../middleware/errorHandler.js';
import { udSafeAddressSchema } from '../schemas/validation.js';

/**
 * Get Universal Deposit Safe address for given parameters
 * @route GET /api/ud-safe-address
 */
export const getUDSafeAddress = async (req, res, next) => {
  try {
    const { destinationToken, destinationChain, destinationRecipient } = req.query;
    
    // Create UD instance
    const ud = new UniversalDeposits({
      destinationAddress: destinationRecipient,
      destinationToken,
      destinationChain: destinationChain.toString()
    });
    
    // Get UD Safe address
    const udSafeParams = ud.getUDSafeParams();
    
    // Return response
    res.json({
      success: true,
      data: {
        udSafeAddress: udSafeParams.contractAddress,
        destinationToken,
        destinationChain,
        destinationRecipient
      }
    });
  } catch (error) {
    next(ApiError.badRequest(`Error getting UD Safe address: ${error.message}`, 'UD_SAFE_ERROR'));
  }
};

// Export the schema for validation
export { udSafeAddressSchema };