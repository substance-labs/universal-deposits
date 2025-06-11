import { ApiError } from './errorHandler.js';

/**
 * Generic validation middleware that can validate any part of the request
 * @param {Object} schema - Joi schema
 * @param {String} source - Source of data to validate ('body', 'query', 'params')
 * @returns {Function} Express middleware
 */
export const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    // Get data to validate
    const data = req[source];
    
    // Validate data against schema
    const options = {
      abortEarly: false, // Report all errors, not just the first one
      stripUnknown: true // Remove unknown fields
    };
    
    const { error, value } = schema.validate(data, options);
    
    if (error) {
      // Format error messages
      const errorDetails = error.details.map(detail => ({
        field: detail.context?.key || detail.path.join('.'),
        message: detail.message.replace(/['"]/g, ''),
        type: detail.type
      }));
      
      const errorMessage = errorDetails.map(err => `${err.field}: ${err.message}`).join(', ');
      
      return next(ApiError.badRequest(
        `Validation error: ${errorMessage}`, 
        'VALIDATION_ERROR', 
        { details: errorDetails }
      ));
    }
    
    // Replace request data with validated data
    req[source] = value;
    next();
  };
};

// Specific validation helpers
export const validateBody = (schema) => validate(schema, 'body');
export const validateQuery = (schema) => validate(schema, 'query');
export const validateParams = (schema) => validate(schema, 'params');

// Backward compatibility
export const validateRequest = validateBody;
export const validateQueryParams = validateQuery;