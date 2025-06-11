export const errorHandler = (err, req, res, next) => {
  // Default error status and message
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  
  // Get request information for logging
  const requestInfo = {
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    timestamp: new Date().toISOString()
  };
  
  // Log the error with request context
  if (status >= 500) {
    console.error('Server Error:', { error: err, request: requestInfo });
  } else {
    console.warn('Client Error:', { error: err, request: requestInfo });
  }
  
  // Define error codes based on status if not provided
  let errorCode = err.code;
  if (!errorCode) {
    switch(status) {
      case 400: errorCode = 'BAD_REQUEST'; break;
      case 401: errorCode = 'UNAUTHORIZED'; break;
      case 403: errorCode = 'FORBIDDEN'; break;
      case 404: errorCode = 'NOT_FOUND'; break;
      case 429: errorCode = 'TOO_MANY_REQUESTS'; break;
      default: errorCode = 'INTERNAL_SERVER_ERROR';
    }
  }
  
  // Send standardized error response
  res.status(status).json({
    success: false,
    error: {
      code: errorCode,
      message,
      details: err.details || {},
      requestId: req.id // Assuming request ID is set by request logger
    }
  });
};

// Custom error class for API errors
export class ApiError extends Error {
  constructor(code, message, status = 400, details = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
  
  static badRequest(message, code = 'BAD_REQUEST', details = {}) {
    return new ApiError(code, message, 400, details);
  }
  
  static notFound(message = 'Resource not found', code = 'NOT_FOUND', details = {}) {
    return new ApiError(code, message, 404, details);
  }
  
  static unauthorized(message = 'Unauthorized', code = 'UNAUTHORIZED', details = {}) {
    return new ApiError(code, message, 401, details);
  }
  
  static forbidden(message = 'Forbidden', code = 'FORBIDDEN', details = {}) {
    return new ApiError(code, message, 403, details);
  }
  
  static internal(message = 'Internal Server Error', code = 'INTERNAL_SERVER_ERROR', details = {}) {
    return new ApiError(code, message, 500, details);
  }
};