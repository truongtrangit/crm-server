const crypto = require('crypto');
const env = require('../config/env');
const { sendError } = require('../utils/http');
const logger = require('../utils/logger');
const { getClientIp } = require('../utils/request');
const ZCodeIdempotencyKey = require('../../modules/zcode/zcodeIdempotencyKey.model');

const IDEMPOTENCY_PREFIX = 'inv_ext:';

/**
 * Constant-time string equality check to prevent timing attacks on API keys.
 */
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Normalize partner identifier (e.g. "Key.vn" -> "key.vn", "PARTNER_A" -> "partner_a").
 */
function normalizePartnerKey(raw) {
  if (!raw || typeof raw !== 'string') return '';
  return raw.trim().toLowerCase();
}

/**
 * Get list of active configured external partners from env (or custom config object for unit testing).
 * Each partner has isolated: { id, name, aliases, sourceModule, system, apiKey, allowedIps }
 */
function getConfiguredPartners(config = env) {
  const partnersMap = config?.invoiceExternalPartners || {};
  return Object.values(partnersMap).filter(
    (p) => p && typeof p.apiKey === 'string' && p.apiKey.trim().length > 0,
  );
}

/**
 * Find partner by explicit partnerId/alias (e.g. 'keyvn', 'zcode', or any dynamically configured partner).
 */
function findPartnerByIdentifier(identifier, partners) {
  const norm = normalizePartnerKey(identifier);
  if (!norm) return null;
  const stripped = norm.replace(/\.vn$/, '');
  return (
    partners.find(
      (p) =>
        p.id === norm ||
        p.id === stripped ||
        p.sourceModule === norm ||
        (Array.isArray(p.aliases) &&
          p.aliases.some((a) => a.toLowerCase() === norm || a.toLowerCase() === stripped)),
    ) || null
  );
}

/**
 * Strip IPv4-mapped IPv6 prefix ("::ffff:103.1.2.3" -> "103.1.2.3") so Node/Docker
 * socket addresses match IPv4 entries in ALLOWED_IPS reliably.
 */
function normalizeIp(ip) {
  if (!ip || typeof ip !== 'string') return '';
  return ip.trim().replace(/^::ffff:/i, '');
}

/**
 * Parse IPv4 string to unsigned 32-bit integer (returns null for non-IPv4).
 */
function ipToLong(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let result = 0;
  for (let i = 0; i < 4; i++) {
    if (!/^\d+$/.test(parts[i])) return null;
    const octet = Number(parts[i]);
    if (octet < 0 || octet > 255) return null;
    result = result * 256 + octet;
  }
  return result >>> 0;
}

/**
 * Match clientIp against an exact IP (IPv4/IPv6) or IPv4 CIDR entry (e.g. "103.112.10.0/24").
 */
function matchesIpOrCidr(clientIp, entry) {
  const normClient = normalizeIp(clientIp);
  const normEntry = normalizeIp(entry);
  if (!normClient || !normEntry) return false;
  if (!normEntry.includes('/')) {
    return normClient.toLowerCase() === normEntry.toLowerCase();
  }
  const [network, prefixStr] = normEntry.split('/');
  const prefix = Number(prefixStr);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;
  const clientLong = ipToLong(normClient);
  const networkLong = ipToLong(network);
  if (clientLong === null || networkLong === null) return false;
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (clientLong & mask) === (networkLong & mask);
}

/**
 * Check if clientIp is allowed by a specific partner's allowedIps configuration.
 * - Supports exact IPv4, IPv6, IPv4-mapped IPv6 (::ffff:x.x.x.x), and IPv4 CIDR (x.x.x.x/nn)
 * - If allowedIps is empty or contains '0.0.0.0' → allowed
 * - Otherwise clientIp must match at least one entry in partner's whitelist
 */
function isIpAllowedForPartner(clientIp, partner) {
  const rawAllowed = partner?.allowedIps || '';
  if (!rawAllowed) return true;

  const whitelist = String(rawAllowed)
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean);

  if (whitelist.length === 0 || whitelist.includes('0.0.0.0')) {
    return true;
  }

  return whitelist.some((entry) => matchesIpOrCidr(clientIp, entry));
}

/**
 * Extract normalized client IP consistently from request headers/socket.
 */
function extractCallerIp(req) {
  return normalizeIp(getClientIp(req));
}

/**
 * Multi-Partner Authentication & Per-Partner IP Allowlist Middleware.
 *
 * Flow:
 * 1. Resolve partner:
 *    - If caller passes `X-Partner-Id` header (or `:partnerId` param, e.g. `keyvn`, `zcode`, or any configured partner),
 *      look up that specific partner and verify `X-API-Key` against THAT partner's `apiKey`.
 *    - If `X-Partner-Id` is omitted, match `X-API-Key` across configured partners via constant-time `safeEqual`.
 * 2. Verify caller IP against the matched partner's OWN `allowedIps` (each partner has an isolated IP allowlist).
 * 3. Attach `req.externalPartner` and `req.externalCaller` (`partner.sourceModule`, e.g. 'zcode', or partner id).
 */
function createExternalInvoicePartnerAuth(config = env) {
  return function authenticatePartnerMiddleware(req, res, next) {
    const apiKey = req.header('X-API-Key');
    const requestedPartnerId =
      req.params?.partnerId || req.header('X-Partner-Id') || '';
    const clientIp = extractCallerIp(req);

    req.zcodeSecurityContext = req.zcodeSecurityContext || {};

    if (!apiKey) {
      req.zcodeSecurityContext.apiKeyValid = false;
      logger.warn('INVOICE_EXTERNAL: Missing X-API-Key', {
        ip: clientIp,
        partnerId: requestedPartnerId || undefined,
      });
      return sendError(res, 401, 'Invalid or missing X-API-Key', {
        code: 'INVOICE_EXTERNAL_INVALID_API_KEY',
      });
    }

    const partners = getConfiguredPartners(config);
    let matchedPartner = null;

    if (requestedPartnerId) {
      const targetPartner = findPartnerByIdentifier(
        requestedPartnerId,
        partners,
      );
      if (!targetPartner || !safeEqual(apiKey, targetPartner.apiKey)) {
        req.zcodeSecurityContext.apiKeyValid = false;
        logger.warn(
          'INVOICE_EXTERNAL: Invalid X-API-Key for requested partner',
          {
            ip: clientIp,
            partnerId: requestedPartnerId,
          },
        );
        return sendError(
          res,
          401,
          `Invalid X-API-Key for partner "${requestedPartnerId}"`,
          {
            code: 'INVOICE_EXTERNAL_INVALID_API_KEY',
          },
        );
      }
      matchedPartner = targetPartner;
    } else {
      matchedPartner =
        partners.find((p) => safeEqual(apiKey, p.apiKey)) || null;
      if (!matchedPartner) {
        req.zcodeSecurityContext.apiKeyValid = false;
        logger.warn('INVOICE_EXTERNAL: Invalid X-API-Key', { ip: clientIp });
        return sendError(res, 401, 'Invalid or missing X-API-Key', {
          code: 'INVOICE_EXTERNAL_INVALID_API_KEY',
        });
      }
    }

    // Per-partner IP allowlist check
    if (!isIpAllowedForPartner(clientIp, matchedPartner)) {
      req.zcodeSecurityContext.apiKeyValid = true;
      logger.warn(
        `INVOICE_EXTERNAL [${matchedPartner.id}]: IP not in partner allowlist`,
        {
          partner: matchedPartner.id,
          ip: clientIp,
          allowed: matchedPartner.allowedIps,
        },
      );
      return sendError(
        res,
        403,
        `IP address not allowed for partner "${matchedPartner.id}"`,
        {
          code: `${matchedPartner.system || 'INVOICE_EXTERNAL'}_IP_FORBIDDEN`,
        },
      );
    }

    req.zcodeSecurityContext.apiKeyValid = true;
    req.externalPartner = matchedPartner;
    req.externalCaller = matchedPartner.sourceModule;
    return next();
  };
}

const authenticateExternalInvoicePartner =
  createExternalInvoicePartnerAuth(env);

/**
 * Request-level Idempotency check using X-Idempotency-Key header.
 * Namespaced per partner ("inv_ext:<partnerId>:<key>") so keys from different partners never collide.
 *
 * Uses atomic insert-first lock (status: 'processing') to prevent TOCTOU double-issuance
 * when concurrent retries arrive while BKAV is still processing the first request.
 */
async function verifyExternalInvoiceIdempotency(req, res, next) {
  const rawKey = req.header('X-Idempotency-Key');
  req.zcodeSecurityContext = req.zcodeSecurityContext || {};
  req.zcodeSecurityContext.idempotencyKey = rawKey || null;

  if (!rawKey) return next();

  const partnerId = req.externalPartner?.id || req.externalCaller || 'default';
  const namespacedKey = `${IDEMPOTENCY_PREFIX}${partnerId}:${String(rawKey).trim().slice(0, 128)}`;
  req.externalInvoiceIdempotencyKey = namespacedKey;

  try {
    // Atomic claim: insert lock record before hitting BKAV
    await ZCodeIdempotencyKey.create({
      key: namespacedKey,
      status: 'processing',
      responseStatus: 0,
      responseBody: null,
    });

    // Safety net: if request fails/aborts without calling saveExternalInvoiceIdempotency,
    // release the 'processing' lock so the partner can safely retry.
    if (typeof res.on === 'function') {
      res.on('finish', () => {
        if (!req._externalIdempotencySaved) {
          releaseExternalInvoiceIdempotency(namespacedKey).catch(() => {});
        }
      });
    }
    return next();
  } catch (err) {
    // Duplicate key (11000) → already completed OR currently in-flight
    if (err.code === 11000) {
      try {
        const existing = await ZCodeIdempotencyKey.findOne({
          key: namespacedKey,
        }).lean();

        if (existing) {
          if (existing.status === 'processing') {
            logger.warn(
              'INVOICE_EXTERNAL Idempotency: Concurrent request in progress',
              {
                partner: partnerId,
                key: rawKey,
                ip: extractCallerIp(req),
              },
            );
            return sendError(
              res,
              409,
              'Yêu cầu với X-Idempotency-Key này đang được xử lý, vui lòng thử lại sau giây lát',
              {
                code: 'INVOICE_EXTERNAL_IN_PROGRESS',
              },
            );
          }

          if (existing.responseBody) {
            logger.info(
              'INVOICE_EXTERNAL Idempotency: Returning cached response',
              {
                partner: partnerId,
                key: rawKey,
                ip: extractCallerIp(req),
              },
            );
            req.zcodeSecurityContext.idempotentHit = true;
            return res.status(existing.responseStatus || 200).json({
              ...existing.responseBody,
              idempotent: true,
            });
          }
        }
      } catch (lookupErr) {
        logger.error('INVOICE_EXTERNAL Idempotency: Lookup failed', {
          error: lookupErr.message,
        });
      }
    } else {
      logger.error('INVOICE_EXTERNAL Idempotency: Atomic claim failed', {
        error: err.message,
      });
    }
  }

  return next();
}

async function saveExternalInvoiceIdempotency(
  namespacedKey,
  status,
  body,
  req = null,
) {
  if (!namespacedKey) return;
  try {
    await ZCodeIdempotencyKey.updateOne(
      { key: namespacedKey },
      {
        $set: {
          status: 'completed',
          responseStatus: status,
          responseBody: body,
        },
      },
      { upsert: true },
    );
    if (req) req._externalIdempotencySaved = true;
  } catch (err) {
    logger.error('INVOICE_EXTERNAL Idempotency: Failed to save result', {
      error: err.message,
    });
  }
}

async function releaseExternalInvoiceIdempotency(namespacedKey) {
  if (!namespacedKey) return;
  try {
    await ZCodeIdempotencyKey.deleteOne({
      key: namespacedKey,
      status: 'processing',
    });
  } catch (err) {
    logger.error('INVOICE_EXTERNAL Idempotency: Failed to release lock', {
      error: err.message,
    });
  }
}

module.exports = {
  normalizeIp,
  matchesIpOrCidr,
  getConfiguredPartners,
  findPartnerByIdentifier,
  isIpAllowedForPartner,
  createExternalInvoicePartnerAuth,
  authenticateExternalInvoicePartner,
  requireExternalInvoiceApiKey: authenticateExternalInvoicePartner,
  verifyExternalInvoiceIdempotency,
  saveExternalInvoiceIdempotency,
  releaseExternalInvoiceIdempotency,
};
