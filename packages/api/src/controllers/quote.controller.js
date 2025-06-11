import { QuoteService, defaultBridgeConfigs } from '@universal-deposits/sdk'
import { ApiError } from '../middleware/errorHandler.js'
import { quoteSchema } from '../schemas/validation.js'

// Create quote service instance with default configs
const quoteService = new QuoteService(defaultBridgeConfigs)

/**
 * Get bridge quote for cross-chain transfer
 * @route GET /api/quote
 */
export const getQuote = async (req, res, next) => {
  try {
    const {
      sourceChainToken,
      sourceChainUD,
      sourceChainId,
      destinationChainToken,
      destinationChainAddress,
      destinationChainId,
      amount,
    } = req.query

    // Create quote request
    const quoteRequest = {
      fromChain: Number(sourceChainId),
      toChain: Number(destinationChainId),
      fromToken: sourceChainToken,
      toToken: destinationChainToken,
      fromAmount: amount.toString(),
      fromAddress: sourceChainUD,
      toAddress: destinationChainAddress,
      slippage: 0.5, // Default slippage
    }

    // Get quote
    const quote = await quoteService.getBestQuote(quoteRequest)

    // Format response
    const response = {
      success: true,
      data: {
        bridge: quote.service.split('-')[0], // Extract main bridge name
        tool: quote.service,
        inputAmount: quoteRequest.fromAmount,
        expectedOutput: quote.expectedReturnAmount,
        slippage: quote.slippage?.toString() || '0.5',
        estimatedGas: quote.estimatedGas || 'unknown',
        executionTime: quote.executionTime ? `${quote.executionTime} seconds` : '2-5 minutes',
        approvalRequired: quote.isApprovedRequired || false,
        approvalAddress: quote.approvalAddress || null,
      },
    }

    // Return response
    res.json(response)
  } catch (error) {
    console.error('Quote error:', error)
    next(ApiError.badRequest(`Error getting quote: ${error.message}`, 'QUOTE_ERROR'))
  }
}

// Export schema for validation
export { quoteSchema }
