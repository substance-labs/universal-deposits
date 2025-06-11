import crypto from 'crypto';

/**
 * Generate a unique request ID
 * @returns {string} A unique request ID
 */
function generateRequestId() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Middleware to log request details and assign a unique ID
 */
export const logRequest = (req, res, next) => {
  // Generate a unique request ID
  req.id = generateRequestId();
  
  // Add request ID to response headers
  res.setHeader('X-Request-ID', req.id);
  
  const start = Date.now();
  const requestStartTime = new Date().toISOString();
  
  // Log request details when response is sent
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('user-agent') || '',
      ip: req.ip || req.connection.remoteAddress,
      requestTime: requestStartTime,
      responseTime: new Date().toISOString()
    };
    
    // Log at appropriate level based on status code
    if (res.statusCode >= 500) {
      console.error('Request failed with server error', logData);
    } else if (res.statusCode >= 400) {
      console.warn('Request failed with client error', logData);
    } else {
      console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms [${req.id}]`);
    }
  });
  
  next();
};