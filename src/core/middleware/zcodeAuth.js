const { sendError } = require('../utils/http');
const logger = require('../utils/logger');
const env = require('../config/env');

/**
 * IP allowlist check for ZCode external API.
 * Only active if ZCODE_ALLOWED_IPS is configured (non-empty).
 */
function checkZcodeIpAllowlist(req, res, next) {
  const allowedIps = env.zcodeAllowedIps;

  const whitelist = (allowedIps || '')
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean);

  if (whitelist.includes('0.0.0.0')) {
    return next();
  }

  const clientIp = req.ip || req.socket?.remoteAddress || '';

  if (whitelist.length === 0) {
    logger.warn('ZCode: IP not in allowlist (whitelist is empty)', {
      ip: clientIp,
    });
    return sendError(res, 403, 'IP address not allowed', {
      code: 'ZCODE_IP_FORBIDDEN',
    });
  }

  if (!whitelist.includes(clientIp)) {
    logger.warn('ZCode: IP not in allowlist', {
      ip: clientIp,
      allowed: whitelist,
    });
    return sendError(res, 403, 'IP address not allowed', {
      code: 'ZCODE_IP_FORBIDDEN',
    });
  }

  return next();
}

module.exports = {
  checkZcodeIpAllowlist,
};
