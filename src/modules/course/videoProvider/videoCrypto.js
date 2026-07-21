/**
 * Video ID encryption/decryption utility.
 *
 * Encrypts videoId with AES-256-GCM before sending to client.
 * Client decrypts using the same shared key via Web Crypto API.
 *
 * Format: iv.ciphertext.authTag (all base64url-encoded)
 *
 * This prevents users from reading the plain videoId in
 * DevTools Network tab or API response inspection.
 */
const crypto = require('crypto');
const env = require('../../../core/config/env');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV for GCM

/**
 * Get encryption key from env.
 * Must be 32 bytes (64 hex characters).
 */
function getKey() {
  const key = env.videoEncryptionKey;
  if (!key || key.length !== 64) {
    throw new Error(
      'VIDEO_ENCRYPTION_KEY must be set (64 hex chars = 32 bytes). ' +
      'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }
  return Buffer.from(key, 'hex');
}

/**
 * Encrypt a videoId string with embedded timestamp.
 * Payload format: videoId:epochMs
 * Client must verify the timestamp is within TTL (5 minutes).
 *
 * @param {string} videoId — Plain YouTube video ID
 * @returns {string} Encrypted token: iv.ciphertext.authTag
 */
function encryptVideoId(videoId) {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  // Embed timestamp for time-limited validation
  const payload = `${videoId}:${Date.now()}`;

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(payload, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString('base64url'),
    encrypted.toString('base64url'),
    authTag.toString('base64url'),
  ].join('.');
}

/**
 * Decrypt an encrypted videoId token (for testing/internal use).
 * Returns { videoId, timestamp } from the payload.
 * @param {string} token — Encrypted token from encryptVideoId()
 * @returns {{ videoId: string, timestamp: number }}
 */
function decryptVideoId(token) {
  const key = getKey();
  const [ivB64, encB64, tagB64] = token.split('.');

  const iv = Buffer.from(ivB64, 'base64url');
  const encrypted = Buffer.from(encB64, 'base64url');
  const authTag = Buffer.from(tagB64, 'base64url');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, null, 'utf8');
  decrypted += decipher.final('utf8');

  // Parse payload: videoId:epochMs
  const lastColon = decrypted.lastIndexOf(':');
  return {
    videoId: decrypted.substring(0, lastColon),
    timestamp: parseInt(decrypted.substring(lastColon + 1), 10),
  };
}

module.exports = { encryptVideoId, decryptVideoId };
