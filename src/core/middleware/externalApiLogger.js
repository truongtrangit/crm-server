const ExternalApiLog = require('../../modules/zcode/externalApiLog.model');
const logger = require('../utils/logger');

/**
 * ─── External API Audit Logger ────────────────────────────────────────────────
 *
 * Captures request and response details for external API calls.
 * Uses res.on('finish') to capture the final response status after processing.
 *
 * Must be placed AFTER security middlewares (so security context is populated)
 * and BEFORE the controller handler.
 */
function externalApiLogger(systemName = 'ZCODE') {
  return function (req, res, next) {
    const startTime = Date.now();

    // Intercept res.json to capture the response body
    const originalJson = res.json.bind(res);
    let capturedBody = null;

    res.json = function (body) {
      capturedBody = body;
      return originalJson(body);
    };

    res.on('finish', () => {
      const durationMs = Date.now() - startTime;
      const secCtx = req.zcodeSecurityContext || {};
      const clientIp =
        req.headers['cf-connecting-ip'] ||
        (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
        req.ip || '';

      // Fire-and-forget — don't await
      ExternalApiLog.create({
        method: req.method,
        path: req.originalUrl,
        system: systemName,
        callerIp: clientIp,
        apiKeyValid: secCtx.apiKeyValid !== false,
        idempotencyKey: secCtx.idempotencyKey || null,
        idempotentHit: secCtx.idempotentHit || false,
        requestBody: req.body ? { sku: req.body.sku, partialCode: req.body.partialCode ? '***' : undefined } : null,
        responseStatus: res.statusCode,
        responseCode: capturedBody?.code || capturedBody?.data?.code || null,
        durationMs,
        error: res.statusCode >= 400 ? (capturedBody?.message || null) : null,
      }).catch((err) => {
        logger.error('ExternalApiLog: Failed to write audit log', { error: err.message });
      });
    });

    return next();
  };
}

module.exports = { externalApiLogger };
