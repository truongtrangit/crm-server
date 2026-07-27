const crypto = require('crypto');
const env = require('../config/env');
const { sendError } = require('../utils/http');
const logger = require('../utils/logger');

/**
 * ─── ACB Bank Webhook Security Middleware ────────────────────────────────────
 *
 * Completely separate from webhookAuth.js and zcodeAuth.js.
 * Used exclusively for ACB bank transaction webhook.
 *
 * Security layers:
 *   1. Content-Type enforcement
 *   2. IP allowlist
 *   3. Brute-force auto-block (IP-based)
 *   4. Ed25519 asymmetric signature + timestamp + replay nonce
 */

const SIGNATURE_HEADER = 'x-webhook-signature';
const TIMESTAMP_HEADER = 'x-webhook-timestamp';
const SIGNATURE_PREFIX = 'ed25519=';
const MAX_TIMESTAMP_DRIFT_MS = 5 * 60 * 1000; // 5 minutes

// Cache Ed25519 public key as KeyObject once at module load (avoids PEM parsing per request)
let _acbPublicKeyObject = null;
function _getPublicKey() {
  if (_acbPublicKeyObject) return _acbPublicKeyObject;
  try {
    _acbPublicKeyObject = crypto.createPublicKey(env.acbWebhookPublicKey);
  } catch (err) {
    logger.error('ACB Webhook: Failed to parse Ed25519 public key from env', { error: err.message });
  }
  return _acbPublicKeyObject;
}

// ─── Brute-force Protection ─────────────────────────────────────────────────
// Track auth failures per IP. After threshold → auto-block.
const AUTH_FAIL_THRESHOLD = 5;         // 5 failures
const AUTH_FAIL_WINDOW_MS = 10 * 60 * 1000; // within 10 minutes
const AUTH_BLOCK_DURATION_MS = 30 * 60 * 1000; // block for 30 minutes
const AUTH_TRACKER_MAX_SIZE = 10_000; // Hard cap — evict oldest when exceeded

// ip → { failures: [timestamps], blockedUntil: timestamp | null }
const _authTracker = new Map();

function _getClientIp(req) {
  return (
    req.headers['cf-connecting-ip'] ||
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.ip ||
    req.socket?.remoteAddress ||
    ''
  );
}

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

// ─── Replay Nonce Store ─────────────────────────────────────────────────────
// Store used signatures to prevent replay within the timestamp window.
// Map: signatureHex → expiresAt (timestamp ms)
const _usedSignatures = new Map();
const NONCE_STORE_MAX_SIZE = 5_000; // Hard cap — evict oldest when exceeded

// ─── Middleware: Content-Type Enforcement ────────────────────────────────────

/**
 * Reject any request that is not application/json.
 * Prevents XML injection, form-data attacks, etc.
 */
function enforceJsonContentType(req, res, next) {
  const contentType = req.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    logger.warn('ACB Webhook: Invalid Content-Type', {
      ip: _getClientIp(req),
      contentType,
    });
    return sendError(res, 415, 'Content-Type must be application/json', {
      code: 'ACB_INVALID_CONTENT_TYPE',
    });
  }
  return next();
}

// ─── Middleware: IP Allowlist ────────────────────────────────────────────────

// Cache parsed allowlist — avoids split/map/filter on every request.
// Invalidated automatically when env value changes (hot-reload safe).
let _cachedAllowlistRaw = null;
let _cachedAllowlistSet = null;
let _cachedAllowAll = false;

function _getAllowlistSet() {
  const raw = env.acbWebhookAllowedIps || '';
  if (raw === _cachedAllowlistRaw) return _cachedAllowlistSet;

  _cachedAllowlistRaw = raw;
  const entries = raw.split(',').map((ip) => ip.trim()).filter(Boolean);
  _cachedAllowAll = entries.includes('0.0.0.0');
  _cachedAllowlistSet = new Set(entries);
  return _cachedAllowlistSet;
}

/**
 * IP allowlist check for ACB webhook.
 *
 * Behaviour:
 *   - '0.0.0.0' in list → allow all (dev mode)
 *   - Non-empty list     → only allow listed IPs
 *   - Empty list         → block all (secure by default)
 */
function checkAcbIpAllowlist(req, res, next) {
  const whitelist = _getAllowlistSet();

  // Dev mode: 0.0.0.0 means allow all
  if (_cachedAllowAll) {
    return next();
  }

  const clientIp = _getClientIp(req);

  // Empty whitelist = block all (secure by default)
  if (whitelist.size === 0) {
    logger.warn('ACB Webhook: IP blocked (allowlist is empty)', {
      ip: clientIp,
    });
    return sendError(res, 403, 'IP address not allowed', {
      code: 'ACB_IP_FORBIDDEN',
    });
  }

  if (!whitelist.has(clientIp)) {
    logger.warn('ACB Webhook: IP not in allowlist', {
      ip: clientIp,
      allowed: [...whitelist],
    });
    return sendError(res, 403, 'IP address not allowed', {
      code: 'ACB_IP_FORBIDDEN',
    });
  }

  return next();
}

// ─── Middleware: Brute-force Auto-block ──────────────────────────────────────

/**
 * Check if the IP is currently blocked due to repeated auth failures.
 * This runs BEFORE API key and signature checks.
 *
 * Auto-block: 5 auth failures within 10 minutes → block IP for 30 minutes.
 */
function checkAcbBruteForce(req, res, next) {
  const clientIp = _getClientIp(req);

  if (_isIpBlocked(clientIp)) {
    logger.warn('ACB Webhook: Request from blocked IP', { ip: clientIp });
    return sendError(res, 403, 'Too many failed attempts. Try again later.', {
      code: 'ACB_IP_BLOCKED',
    });
  }

  // Attach helper so downstream middleware can record failures
  req._acbRecordAuthFailure = () => _recordAuthFailure(clientIp);

  return next();
}

// ─── Middleware: Ed25519 Signature Verification ─────────────────────────────

/**
 * Ed25519 asymmetric webhook signature verification.
 *
 * Required headers:
 *   - X-Webhook-Signature: ed25519=<hex_or_base64_digest>
 *   - X-Webhook-Timestamp: <unix_seconds>
 *
 * Signature is verified as:
 *   crypto.verify(null, Buffer(timestamp + "." + rawBody), publicKey, signatureBuffer)
 *
 * Security features:
 *   - Ed25519 asymmetric verification (server holds public key only)
 *   - Timestamp drift check (max 5 minutes) — anti-replay
 *   - Replay nonce — same signature cannot be used twice
 *   - Auto-block on repeated failures
 *   - Raw body required (set by express.json verify callback)
 */
function verifyAcbWebhookSignature(req, res, next) {
  const clientIp = _getClientIp(req);
  const signatureHeader = req.get(SIGNATURE_HEADER);
  const timestampHeader = req.get(TIMESTAMP_HEADER);

  // Both headers are required
  if (!signatureHeader || !timestampHeader) {
    logger.warn('ACB Webhook: Missing signature or timestamp header', {
      ip: clientIp,
      hasSignature: !!signatureHeader,
      hasTimestamp: !!timestampHeader,
    });
    if (req._acbRecordAuthFailure) req._acbRecordAuthFailure();
    return sendError(res, 401, 'Missing webhook signature', {
      code: 'ACB_MISSING_SIGNATURE',
    });
  }

  // Validate timestamp format (must be numeric)
  const timestamp = Number(timestampHeader);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    logger.warn('ACB Webhook: Invalid timestamp format', {
      ip: clientIp,
      timestamp: timestampHeader,
    });
    if (req._acbRecordAuthFailure) req._acbRecordAuthFailure();
    return sendError(res, 401, 'Invalid webhook timestamp', {
      code: 'ACB_INVALID_TIMESTAMP',
    });
  }

  // Anti-replay: reject if timestamp is too old or too far in the future
  const now = Math.floor(Date.now() / 1000);
  const drift = Math.abs(now - timestamp);
  if (drift > MAX_TIMESTAMP_DRIFT_MS / 1000) {
    logger.warn('ACB Webhook: Timestamp drift too large', {
      ip: clientIp,
      timestamp,
      now,
      driftSeconds: drift,
    });
    if (req._acbRecordAuthFailure) req._acbRecordAuthFailure();
    return sendError(res, 401, 'Webhook timestamp expired', {
      code: 'ACB_TIMESTAMP_EXPIRED',
    });
  }

  // Extract hex digest from signature header
  if (!signatureHeader.startsWith(SIGNATURE_PREFIX)) {
    logger.warn('ACB Webhook: Invalid signature format', {
      ip: clientIp,
    });
    if (req._acbRecordAuthFailure) req._acbRecordAuthFailure();
    return sendError(res, 401, 'Invalid webhook signature format', {
      code: 'ACB_INVALID_SIGNATURE',
    });
  }

  const receivedDigest = signatureHeader.slice(SIGNATURE_PREFIX.length);

  const rawBody = req.rawBody;
  if (!rawBody) {
    logger.error('ACB Webhook: rawBody not available — verify express.json({ verify }) is configured');
    return sendError(res, 500, 'Internal server error', {
      code: 'ACB_INTERNAL_ERROR',
    });
  }

  // ─── Ed25519 Signature Verification ─────────────────────────────────────
  // Payload signed by ACB Private Key = "<timestamp>.<rawBody>"
  // Verified using ACB Public Key stored in env.acbWebhookPublicKey
  const timestampPrefix = Buffer.from(`${timestamp}.`);
  const signedPayloadBuffer = Buffer.concat([timestampPrefix, rawBody]);
  const signatureBuffer = Buffer.from(
    receivedDigest,
    receivedDigest.length === 128 ? 'hex' : 'base64',
  );

  const publicKey = _getPublicKey();
  if (!publicKey) {
    logger.error('ACB Webhook: Ed25519 public key not configured');
    return sendError(res, 500, 'Internal server error', {
      code: 'ACB_INTERNAL_ERROR',
    });
  }

  let isValidSignature = false;
  try {
    isValidSignature = crypto.verify(
      null, // null algorithm for Ed25519 / PureEd25519
      signedPayloadBuffer,
      publicKey,
      signatureBuffer,
    );
  } catch (err) {
    logger.warn('ACB Webhook: Ed25519 signature verification error', {
      ip: clientIp,
      error: err.message,
    });
  }

  if (!isValidSignature) {
    logger.warn('ACB Webhook: Ed25519 signature mismatch or invalid', { ip: clientIp });
    if (req._acbRecordAuthFailure) req._acbRecordAuthFailure();
    return sendError(res, 401, 'Invalid webhook signature', {
      code: 'ACB_INVALID_SIGNATURE',
    });
  }

  // ─── Replay Nonce Check ─────────────────────────────────────────────────
  // Even within the 5-minute timestamp window, the same signature
  // cannot be used twice. This closes the replay gap completely.
  if (_usedSignatures.has(receivedDigest)) {
    const expiresAt = _usedSignatures.get(receivedDigest);
    if (Date.now() > expiresAt) {
      _usedSignatures.delete(receivedDigest); // Lazy cleanup expired nonce
    } else {
      logger.warn('ACB Webhook: Replay detected — signature already used', {
        ip: clientIp,
      });
      return sendError(res, 401, 'Webhook signature already used', {
        code: 'ACB_REPLAY_DETECTED',
      });
    }
  }

  // Store signature with TTL = remaining timestamp validity
  // Evict oldest nonce if at capacity (FIFO)
  if (_usedSignatures.size >= NONCE_STORE_MAX_SIZE) {
    const oldestKey = _usedSignatures.keys().next().value;
    _usedSignatures.delete(oldestKey);
  }
  const expiresAt = Date.now() + MAX_TIMESTAMP_DRIFT_MS;
  _usedSignatures.set(receivedDigest, expiresAt);

  return next();
}

// ─── Middleware: API Key with Brute-force Integration ───────────────────────

/**
 * ACB-specific API key verification.
 * Unlike the shared requireApiKey, this integrates with the brute-force
 * auto-block tracker — failed API key attempts count toward the block threshold.
 * Also uses timing-safe comparison to prevent timing attacks on the key.
 */
function verifyAcbApiKey(req, res, next) {
  const clientIp = _getClientIp(req);
  const apiKey = req.header('X-API-Key') || '';
  const expected = env.acbWebhookApiKey;

  if (
    !apiKey ||
    apiKey.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(apiKey), Buffer.from(expected))
  ) {
    logger.warn('ACB Webhook: Invalid or missing API key', { ip: clientIp });
    if (req._acbRecordAuthFailure) req._acbRecordAuthFailure();
    return sendError(res, 401, 'Invalid or missing X-API-Key', {
      code: 'ACB_INVALID_API_KEY',
    });
  }

  return next();
}

module.exports = {
  enforceJsonContentType,
  checkAcbIpAllowlist,
  checkAcbBruteForce,
  verifyAcbApiKey,
  verifyAcbWebhookSignature,
};
