const crypto = require('crypto');
const env = require('../config/env');
const { getClientIp } = require('../utils/request');
const { sendAcbError, sendAcbSuccess } = require('../utils/http');
const { ACB_RESPONSE_CODES } = require('../constants/bankLog');
const logger = require('../utils/logger');

/**
 * ─── ACB Bank Webhook Security Middleware ────────────────────────────────────
 *
 * Completely separate from webhookAuth.js and zcodeAuth.js.
 * Used exclusively for ACB bank transaction webhook.
 *
 * Security layers:
 *   1. Content-Type enforcement
 *   2. IP allowlist (supports CIDR notation)
 *   3. Brute-force auto-block (IP-based)
 *   4. API Key verification (timing-safe)
 *   5. SHA256 Checksum verification (RequestBody + SecretKey + BankKey)
 *   6. clientRequestId dedup (replay protection)
 */

// ─── Supported hash algorithms ──────────────────────────────────────────────
const SUPPORTED_ALGORITHMS = new Set(['SHA1', 'SHA256', 'SHA512', 'MD5']);

// ─── Brute-force Protection ─────────────────────────────────────────────────
// Track auth failures per IP. After threshold → auto-block.
const AUTH_FAIL_THRESHOLD = 5; // 5 failures
const AUTH_FAIL_WINDOW_MS = 10 * 60 * 1000; // within 10 minutes
const AUTH_BLOCK_DURATION_MS = 30 * 60 * 1000; // block for 30 minutes
const AUTH_TRACKER_MAX_SIZE = 10_000; // Hard cap — evict oldest when exceeded

// ip → { failures: [timestamps], blockedUntil: timestamp | null }
const _authTracker = new Map();



function _recordAuthFailure(ip) {
  if (!_authTracker.has(ip)) {
    // Evict oldest entry if at capacity (FIFO — Map preserves insertion order)
    if (_authTracker.size >= AUTH_TRACKER_MAX_SIZE) {
      const oldestKey = _authTracker.keys().next().value;
      _authTracker.delete(oldestKey);
    }
    _authTracker.set(ip, { failures: [], blockedUntil: null });
  }
  const data = _authTracker.get(ip);
  const now = Date.now();

  // Prune old failures outside the window
  data.failures = data.failures.filter((t) => now - t < AUTH_FAIL_WINDOW_MS);
  data.failures.push(now);

  if (data.failures.length >= AUTH_FAIL_THRESHOLD) {
    data.blockedUntil = now + AUTH_BLOCK_DURATION_MS;
    data.failures = []; // Reset counter after blocking
    logger.warn('ACB Webhook: IP auto-blocked after repeated auth failures', {
      ip,
      blockMinutes: AUTH_BLOCK_DURATION_MS / 60000,
    });
  }
}

function _isIpBlocked(ip) {
  const data = _authTracker.get(ip);
  if (!data) return false;

  const now = Date.now();

  // 1. Lazy cleanup: Block expired
  if (data.blockedUntil && now > data.blockedUntil) {
    _authTracker.delete(ip);
    return false;
  }

  // 2. Lazy cleanup: Prune old failures if not currently blocked
  if (!data.blockedUntil) {
    data.failures = data.failures.filter((t) => now - t < AUTH_FAIL_WINDOW_MS);
    if (data.failures.length === 0) {
      _authTracker.delete(ip);
      return false;
    }
  }

  return Boolean(data.blockedUntil);
}

// ─── clientRequestId Dedup Store ────────────────────────────────────────────
// Stores seen clientRequestIds to prevent duplicate processing.
// Map: clientRequestId → receivedAt (timestamp ms)
const _seenRequestIds = new Map();
const REQUEST_ID_STORE_MAX_SIZE = 10_000;
const REQUEST_ID_TTL_MS = 60 * 60 * 1000; // Keep for 1 hour

// ─── CIDR IP Matching ───────────────────────────────────────────────────────

/**
 * Parse IP address string to 32-bit integer.
 * Supports IPv4 only (ACB uses IPv4 exclusively).
 */
function _ipToLong(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;

  let result = 0;
  for (let i = 0; i < 4; i++) {
    const octet = parseInt(parts[i], 10);
    if (isNaN(octet) || octet < 0 || octet > 255) return null;
    result = result * 256 + octet;
  }
  return result >>> 0; // Ensure unsigned 32-bit
}

/**
 * Check if an IP address matches a CIDR range or exact IP.
 *
 * @param {string} clientIp - The IP to check
 * @param {string} entry - IP or CIDR notation (e.g., '123.30.82.230/30')
 * @returns {boolean}
 */
function _matchesCidr(clientIp, entry) {
  // Split entry into IP and prefix length
  const [network, prefixStr] = entry.split('/');
  const prefix = prefixStr !== undefined ? parseInt(prefixStr, 10) : 32;

  if (isNaN(prefix) || prefix < 0 || prefix > 32) return false;

  const clientLong = _ipToLong(clientIp);
  const networkLong = _ipToLong(network);
  if (clientLong === null || networkLong === null) return false;

  // Create subnet mask: prefix bits of 1, rest 0
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;

  return (clientLong & mask) === (networkLong & mask);
}

// ─── Middleware: Content-Type Enforcement ────────────────────────────────────

/**
 * Reject any request that is not application/json.
 * Prevents XML injection, form-data attacks, etc.
 */
function enforceJsonContentType(req, res, next) {
  // Log all headers in request
  logger.info('ACB Webhook: Request headers', { headers: req.headers });
  const contentType = req.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    logger.warn('ACB Webhook: Invalid Content-Type', {
      ip: getClientIp(req),
      contentType,
    });
    return sendAcbError(
      res,
      415,
      ACB_RESPONSE_CODES.INVALID_CONTENT,
      'Content-Type must be application/json',
    );
  }
  return next();
}

// ─── Middleware: IP Allowlist (CIDR support) ─────────────────────────────────

// Cache parsed allowlist — avoids split/map/filter on every request.
let _cachedAllowlistRaw = null;
let _cachedAllowlistEntries = null;
let _cachedAllowAll = false;

function _getAllowlistEntries() {
  const raw = env.acbWebhookAllowedIps || '';
  if (raw === _cachedAllowlistRaw) return _cachedAllowlistEntries;

  _cachedAllowlistRaw = raw;
  const entries = raw
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean);
  _cachedAllowAll = entries.includes('0.0.0.0');
  _cachedAllowlistEntries = entries;
  return _cachedAllowlistEntries;
}

/**
 * IP allowlist check for ACB webhook with CIDR support.
 *
 * Behaviour:
 *   - '0.0.0.0' in list → allow all (dev mode)
 *   - Non-empty list     → only allow listed IPs/CIDRs
 *   - Empty list         → block all (secure by default)
 */
function checkAcbIpAllowlist(req, res, next) {
  const entries = _getAllowlistEntries();

  // Dev mode: 0.0.0.0 means allow all
  if (_cachedAllowAll) {
    return next();
  }

  const clientIp = getClientIp(req);

  // Empty whitelist = block all (secure by default)
  if (entries.length === 0) {
    logger.warn('ACB Webhook: IP blocked (allowlist is empty)', {
      ip: clientIp,
    });
    return sendAcbError(
      res,
      403,
      ACB_RESPONSE_CODES.IP_FORBIDDEN,
      'IP address not allowed',
    );
  }

  // Check client IP against each entry (exact or CIDR)
  const isAllowed = entries.some((entry) => _matchesCidr(clientIp, entry));

  if (!isAllowed) {
    logger.warn('ACB Webhook: IP not in allowlist', {
      ip: clientIp,
    });
    return sendAcbError(
      res,
      403,
      ACB_RESPONSE_CODES.IP_FORBIDDEN,
      'IP address not allowed',
    );
  }

  return next();
}

// ─── Middleware: Brute-force Auto-block ──────────────────────────────────────

/**
 * Check if the IP is currently blocked due to repeated auth failures.
 * This runs BEFORE API key and checksum checks.
 *
 * Auto-block: 5 auth failures within 10 minutes → block IP for 30 minutes.
 */
function checkAcbBruteForce(req, res, next) {
  const clientIp = getClientIp(req);

  if (_isIpBlocked(clientIp)) {
    logger.warn('ACB Webhook: Request from blocked IP', { ip: clientIp });
    return sendAcbError(
      res,
      403,
      ACB_RESPONSE_CODES.IP_BLOCKED,
      'Too many failed attempts. Try again later.',
    );
  }

  // Attach helper so downstream middleware can record failures
  req._acbRecordAuthFailure = () => _recordAuthFailure(clientIp);

  return next();
}

// ─── Middleware: API Key Verification ───────────────────────────────────────

/**
 * ACB-specific API key verification.
 * Integrates with the brute-force auto-block tracker.
 * Uses timing-safe comparison to prevent timing attacks on the key.
 */
function verifyAcbApiKey(req, res, next) {
  const clientIp = getClientIp(req);
  const apiKey = req.header('X-API-Key') || '';
  const expected = env.acbWebhookApiKey;

  if (
    !apiKey ||
    apiKey.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(apiKey), Buffer.from(expected))
  ) {
    logger.warn('ACB Webhook: Invalid or missing API key', { ip: clientIp });
    if (req._acbRecordAuthFailure) req._acbRecordAuthFailure();
    return sendAcbError(
      res,
      401,
      ACB_RESPONSE_CODES.UNAUTHORIZED,
      'Invalid or missing X-API-Key',
    );
  }

  return next();
}

// ─── Middleware: SHA256 Checksum Verification ────────────────────────────────

/**
 * ACB Checksum verification.
 *
 * ACB gửi checksum trong header (mặc định: `signature`).
 * Checksum = hash(RequestBody + SecretKey + BankKey)
 *
 * Trong đó:
 *   - RequestBody: raw JSON body (nguyên bytes)
 *   - SecretKey: VIK tạo & cung cấp cho ACB (ACB gọi là "secret_key")
 *   - BankKey: ACB tạo & cung cấp cho VIK (ACB gọi là "server_key")
 *   - Algorithm: SHA256 (configurable: SHA1, SHA256, SHA512, MD5)
 *
 * So sánh bằng timing-safe comparison.
 */
function verifyAcbChecksum(req, res, next) {
  const clientIp = getClientIp(req);
  const checksumHeader = env.acbWebhookChecksumHeader || 'signature';
  const receivedChecksum = req.get(checksumHeader) || '';
  if (!receivedChecksum) {
    logger.warn('ACB Webhook: Missing checksum header', {
      ip: clientIp,
      header: checksumHeader,
    });
    if (req._acbRecordAuthFailure) req._acbRecordAuthFailure();
    return sendAcbError(
      res,
      401,
      ACB_RESPONSE_CODES.MISSING_CHECKSUM,
      'Missing checksum signature',
    );
  }

  const rawBody = req.rawBody;
  if (!rawBody) {
    logger.error(
      'ACB Webhook: rawBody not available — verify express.json({ verify }) is configured',
    );
    return sendAcbError(
      res,
      500,
      ACB_RESPONSE_CODES.INTERNAL_ERROR,
      'Internal server error',
    );
  }

  // Determine algorithm
  let nodeAlgorithm = (
    env.acbWebhookChecksumAlgorithm || 'SHA256'
  ).toLowerCase();
  if (!SUPPORTED_ALGORITHMS.has(nodeAlgorithm.toUpperCase())) {
    logger.warn(
      'ACB Webhook: Unsupported checksum algorithm, falling back to sha256',
      {
        configured: env.acbWebhookChecksumAlgorithm,
        supported: Array.from(SUPPORTED_ALGORITHMS),
      },
    );
    nodeAlgorithm = 'sha256';
  }

  // Compute expected checksum: hash(RequestBody + SecretKey + BankKey)
  const secretKey = env.acbWebhookSecretKey || '';
  const bankKey = env.acbWebhookBankKey || '';

  const hash = crypto.createHash(nodeAlgorithm);
  hash.update(rawBody); // rawBody is a Buffer
  hash.update(secretKey);
  hash.update(bankKey);
  const expectedChecksum = hash.digest('hex');

  // Timing-safe comparison
  if (
    receivedChecksum.length !== expectedChecksum.length ||
    !crypto.timingSafeEqual(
      Buffer.from(receivedChecksum),
      Buffer.from(expectedChecksum),
    )
  ) {
    logger.warn('ACB Webhook: Checksum mismatch', {
      ip: clientIp,
      received: receivedChecksum,
      algorithm: nodeAlgorithm,
    });
    if (req._acbRecordAuthFailure) req._acbRecordAuthFailure();
    return sendAcbError(
      res,
      401,
      ACB_RESPONSE_CODES.INVALID_CHECKSUM,
      'Invalid checksum signature',
    );
  }

  return next();
}

// ─── Middleware: clientRequestId Dedup ───────────────────────────────────────

/**
 * Prevent duplicate processing of the same ACB webhook request.
 * Uses `masterMeta.clientRequestId` from the ACB payload as dedup key.
 *
 * Note: This runs AFTER body parsing, so `req.body` is available.
 */
function checkAcbRequestIdDedup(req, res, next) {
  const clientRequestId = req.body?.masterMeta?.clientRequestId;

  if (!clientRequestId) {
    // Let validation handle missing fields — just pass through
    return next();
  }

  const now = Date.now();

  // Lazy cleanup: remove expired entries
  if (_seenRequestIds.has(clientRequestId)) {
    const receivedAt = _seenRequestIds.get(clientRequestId);
    if (now - receivedAt > REQUEST_ID_TTL_MS) {
      _seenRequestIds.delete(clientRequestId);
    } else {
      logger.info('ACB Webhook: Duplicate clientRequestId detected', {
        clientRequestId,
        ip: getClientIp(req),
      });
      // Return ACB-format success response (idempotent — not an error)
      return sendAcbSuccess(res, clientRequestId, 1);
    }
  }

  // Only save clientRequestId if the request is processed successfully
  res.on('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      if (!_seenRequestIds.has(clientRequestId)) {
        if (_seenRequestIds.size >= REQUEST_ID_STORE_MAX_SIZE) {
          const oldestKey = _seenRequestIds.keys().next().value;
          _seenRequestIds.delete(oldestKey);
        }
        _seenRequestIds.set(clientRequestId, Date.now());
      }
    }
  });

  return next();
}

module.exports = {
  enforceJsonContentType,
  checkAcbIpAllowlist,
  checkAcbBruteForce,
  verifyAcbApiKey,
  verifyAcbChecksum,
  checkAcbRequestIdDedup,
};
