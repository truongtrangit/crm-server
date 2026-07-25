const { sendError } = require('../utils/http');
const logger = require('../utils/logger');
const ZCodeIdempotencyKey = require('../../modules/zcode/zcodeIdempotencyKey.model');

/**
 * ─── Idempotency Key ──────────────────────────────────────────────────────────
 *
 * Checks X-Idempotency-Key header. If the key was already processed,
 * returns the cached response immediately. Otherwise, continues to the handler.
 *
 * This middleware is optional — if no X-Idempotency-Key is sent, it passes through.
 */
async function verifyIdempotency(req, res, next) {
  const idempotencyKey = req.header('X-Idempotency-Key');

  req.zcodeSecurityContext = req.zcodeSecurityContext || {};
  req.zcodeSecurityContext.idempotencyKey = idempotencyKey || null;

  if (!idempotencyKey) {
    return next();
  }

  try {
    const existing = await ZCodeIdempotencyKey.findOne({ key: idempotencyKey }).lean();
    if (existing) {
      logger.info('ZCode Idempotency: Returning cached response', {
        key: idempotencyKey,
        ip: req.ip,
      });
      req.zcodeSecurityContext.idempotentHit = true;
      return res.status(existing.responseStatus).json({
        ...existing.responseBody,
        idempotent: true,
      });
    }
  } catch (err) {
    // If idempotency check fails, log but don't block the request
    logger.error('ZCode Idempotency: Lookup failed', { error: err.message });
  }

  return next();
}

/**
 * Save idempotency result after successful processing.
 * Call this from the controller after generating the response.
 *
 * @param {string} key - The idempotency key
 * @param {number} status - HTTP status code
 * @param {object} body - Response body
 */
async function saveIdempotencyResult(key, status, body) {
  if (!key) return;
  try {
    await ZCodeIdempotencyKey.create({
      key,
      responseStatus: status,
      responseBody: body,
    });
  } catch (err) {
    // Ignore duplicate key errors (race condition)
    if (err.code !== 11000) {
      logger.error('ZCode Idempotency: Failed to save result', { error: err.message });
    }
  }
}

module.exports = {
  verifyIdempotency,
  saveIdempotencyResult,
};
