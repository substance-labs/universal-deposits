import Joi from 'joi'

// Common address validation pattern
const ethereumAddressPattern = /^0x[a-fA-F0-9]{40}$/

// Common validation for Ethereum addresses
const ethereumAddress = Joi.string().pattern(ethereumAddressPattern).messages({
  'string.pattern.base':
    'Address must be a valid Ethereum address (0x followed by 40 hex characters)',
  'string.empty': 'Address cannot be empty',
  'any.required': 'Address is required',
})

// Common validation for chain IDs
const chainId = Joi.number().integer().min(1).messages({
  'number.base': 'Chain ID must be a number',
  'number.integer': 'Chain ID must be an integer',
  'number.min': 'Chain ID must be greater than 0',
  'any.required': 'Chain ID is required',
})

// Validation for UD safe address endpoint
export const udSafeAddressSchema = Joi.object({
  destinationToken: ethereumAddress.required(),
  destinationChain: chainId.required(),
  destinationRecipient: ethereumAddress.required(),
})
  .required()
  .messages({
    'object.unknown': 'Unknown field in request: {{#label}}',
  })

// Validation for order ID path parameter
export const orderIdPathSchema = Joi.object({
  orderId: Joi.string()
    .pattern(/^0x[a-fA-F0-9]{64}$/)
    .required()
    .messages({
      'string.pattern.base': 'orderId must be a valid hash (0x followed by 64 hex characters)',
      'string.empty': 'orderId cannot be empty',
      'any.required': 'orderId is required',
    }),
}).required()

// Validation for order endpoint with query parameters
export const orderParamsSchema = Joi.object({
  sourceChainToken: ethereumAddress.required(),
  sourceChainUD: ethereumAddress.required(),
  sourceChainId: chainId.required(),
  destinationChainToken: ethereumAddress.required(),
  destinationChainAddress: ethereumAddress.required(),
  destinationChainId: chainId.required(),
})
  .required()
  .messages({
    'object.unknown': 'Unknown field in request: {{#label}}',
  })

// Validation for quote endpoint
export const quoteSchema = Joi.object({
  sourceChainToken: ethereumAddress.required(),
  sourceChainUD: ethereumAddress.required(),
  sourceChainId: chainId.required(),
  destinationChainToken: ethereumAddress.required(),
  destinationChainAddress: ethereumAddress.required(),
  destinationChainId: chainId.required(),
  amount: Joi.string()
    .pattern(/^[0-9]+$/)
    .required()
    .messages({
      'string.pattern.base': 'amount must be a string of numbers (wei)',
      'string.empty': 'amount cannot be empty',
      'any.required': 'amount is required',
    }),
})
  .required()
  .messages({
    'object.unknown': 'Unknown field in request: {{#label}}',
  })

// Validation for order-id endpoint
export const orderIdSchema = Joi.object({
  sourceChainToken: ethereumAddress.required(),
  sourceChainUD: ethereumAddress.required(),
  sourceChainId: chainId.required(),
  destinationChainToken: ethereumAddress.required(),
  destinationChainAddress: ethereumAddress.required(),
  destinationChainId: chainId.required(),
})
  .required()
  .messages({
    'object.unknown': 'Unknown field in request: {{#label}}',
  })

// Validation for safe-deployed endpoint
export const safeDeployedSchema = Joi.object({
  sourceChainId: chainId.required(),
  destinationChainToken: ethereumAddress.required(),
  destinationChainAddress: ethereumAddress.required(),
  destinationChainId: chainId.required(),
})
  .required()
  .messages({
    'object.unknown': 'Unknown field in request: {{#label}}',
  })

// Validation for register-address endpoint
export const registerAddressSchema = Joi.object({
  address: ethereumAddress.required(),
  destinationToken: ethereumAddress.optional(),
  destinationChain: chainId.optional(),
})
  .required()
  .messages({
    'object.unknown': 'Unknown field in request: {{#label}}',
  })

// Validation for deposit-address-registered endpoint
export const depositAddressRegisteredSchema = Joi.object({
  address: ethereumAddress.required(),
})
  .required()
  .messages({
    'object.unknown': 'Unknown field in request: {{#label}}',
  })

// Validation for health check endpoint
export const healthCheckSchema = Joi.object({}).required()

// Validation for supported-chains-assets endpoint
export const supportedChainsAssetsSchema = Joi.object({}).required()

// Validation for settle endpoint
export const settleSchema = Joi.object({
  orderId: Joi.string()
    .pattern(/^0x[a-fA-F0-9]{64}$/)
    .required()
    .messages({
      'string.pattern.base': 'orderId must be a valid hash (0x followed by 64 hex characters)',
      'string.empty': 'orderId cannot be empty',
      'any.required': 'orderId is required',
    }),
})
  .required()
  .messages({
    'object.unknown': 'Unknown field in request: {{#label}}',
  })

// Validation for deploy-contracts endpoint
export const deployContractsSchema = Joi.object({
  type: Joi.string().valid('deploySafeModule', 'deploySafe').required().messages({
    'any.only': 'type must be either "deploySafeModule" or "deploySafe"',
    'string.empty': 'type cannot be empty',
    'any.required': 'type is required',
  }),
  chainId: chainId.required(),
  params: Joi.object().required(),
})
  .required()
  .messages({
    'object.unknown': 'Unknown field in request: {{#label}}',
  })
