const crypto = require('crypto');
const { runWithContext } = require('../utils/asyncContext');

/**
 * Middleware to generate a unique traceId per request
 * and run the rest of the request lifecycle within an AsyncLocalStorage context.
 */
function traceMiddleware(req, res, next) {
  // Use existing trace ID from headers (e.g. from an API gateway) or generate a new one
  const traceId = req.headers['x-trace-id'] || req.headers['x-request-id'] || crypto.randomUUID();
  
  // Attach it to the response header so the client knows it too
  res.setHeader('X-Trace-Id', traceId);

  // Expose it on the req object for convenience, though getContext('traceId') is preferred
  req.traceId = traceId;

  // Run the rest of the middleware chain inside this context
  runWithContext({ traceId }, next);
}

module.exports = traceMiddleware;
