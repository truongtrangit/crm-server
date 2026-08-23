const logger = require('../utils/logger');
const env = require('../config/env');
const { extractRequestMeta } = require('../utils/request');

/**
 * Middleware to log every HTTP request/response.
 * Captures method, URL, status, duration, user id (if authenticated), and request body for mutations.
 */
function requestLogger(req, res, next) {
  const start = Date.now();

  // Capture the original end to hook into response completion
  const originalEnd = res.end;

  res.end = function (...args) {
    const duration = Date.now() - start;
    const requestMeta = extractRequestMeta(req);
    const meta = {
      ...requestMeta,
      status: res.statusCode,
      duration: `${duration}ms`,
    };

    const isProduction = env.nodeEnv === 'production';
    const logLevel =
      res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

    if (isProduction) {
      logger[logLevel](
        `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`,
        meta,
      );
    } else {
      let ext = '';
      if (meta.userId) ext += ` [User:${meta.userId}]`;
      logger[logLevel](
        `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms${ext}`,
        meta,
      );
    }

    originalEnd.apply(res, args);
  };

  return next();
}

module.exports = requestLogger;
