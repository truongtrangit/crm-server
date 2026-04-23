const crypto = require("crypto");
const env = require("../config/env");
const { sendError } = require("../utils/http");
const WebhookLog = require("../models/WebhookLog");
const logger = require("../utils/logger");

/**
 * Verify webhook bearer token.
 * 3rd party sends: Authorization: Bearer <WEBHOOK_SECRET>
 */
function verifyWebhookToken(req, res, next) {
  const authHeader = req.get("authorization") || "";

  if (!authHeader.startsWith("Bearer ")) {
    logger.warn("Webhook: Missing or malformed Authorization header", {
      ip: req.ip,
    });
    return sendError(res, 401, "Authentication required", {
      code: "WEBHOOK_AUTH_REQUIRED",
    });
  }

  const token = authHeader.slice(7).trim();

  // Use timing-safe comparison to prevent timing attacks
  const expected = env.webhookSecret;
  if (
    token.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))
  ) {
    logger.warn("Webhook: Invalid token", { ip: req.ip });
    return sendError(res, 401, "Invalid webhook token", {
      code: "WEBHOOK_INVALID_TOKEN",
    });
  }

  return next();
}

/**
 * Optional IP allowlist check.
 * Only active if WEBHOOK_ALLOWED_IPS is configured (non-empty).
 */
function checkIpAllowlist(req, res, next) {
  const allowedIps = env.webhookAllowedIps;

  // Skip if no allowlist configured
  if (!allowedIps) {
    return next();
  }

  const whitelist = allowedIps
    .split(",")
    .map((ip) => ip.trim())
    .filter(Boolean);

  if (whitelist.length === 0) {
    return next();
  }

  const clientIp = req.ip || req.socket?.remoteAddress || "";

  if (!whitelist.includes(clientIp)) {
    logger.warn("Webhook: IP not in allowlist", {
      ip: clientIp,
      allowed: whitelist,
    });
    return sendError(res, 403, "IP address not allowed", {
      code: "WEBHOOK_IP_FORBIDDEN",
    });
  }

  return next();
}

/**
 * Idempotency check — prevents duplicate processing of the same delivery.
 * X-Webhook-Delivery-Id is optional:
 *   - If provided → check for duplicates, reject if already processed
 *   - If not provided → skip check, deliveryId = null
 */
async function checkIdempotency(req, res, next) {
  const deliveryId = req.get("x-webhook-delivery-id") || null;

  req.webhookDeliveryId = deliveryId;

  if (deliveryId) {
    const existing = await WebhookLog.findOne({ deliveryId });

    if (existing) {
      logger.info("Webhook: Duplicate delivery rejected", { deliveryId });
      return sendError(res, 409, "Webhook already processed", {
        code: "WEBHOOK_DUPLICATE_DELIVERY",
        details: { deliveryId, status: existing.status },
      });
    }
  }

  return next();
}

module.exports = {
  verifyWebhookToken,
  checkIpAllowlist,
  checkIdempotency,
};
