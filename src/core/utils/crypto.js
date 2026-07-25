const crypto = require('crypto');
const env = require('../config/env');

const ALGORITHM = 'aes-256-cbc';

// Fixed IV for deterministic encryption so we can query DB
const FIXED_IV = Buffer.alloc(16, 0);

// Key derived for deterministic encryption
let encryptionKey = null;

function getEncryptionKey() {
  if (!encryptionKey) {
    // derive a 32-byte key from the env secret
    encryptionKey = crypto.scryptSync(env.zcodeEncryptionKey || 'default_zcode_enc_key', 'salt', 32);
  }
  return encryptionKey;
}

/**
 * Deterministically encrypts a string (same input always produces same output)
 * @param {string} text
 * @returns {string} encrypted hex string
 */
function encryptZCodeField(text) {
  if (!text) return text;
  try {
    const key = getEncryptionKey();
    const cipher = crypto.createCipheriv(ALGORITHM, key, FIXED_IV);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  } catch (err) {
    return text;
  }
}

/**
 * Decrypts a deterministically encrypted string
 * @param {string} encryptedText
 * @returns {string} decrypted string, or original if failed
 */
function decryptZCodeField(encryptedText) {
  if (!encryptedText) return encryptedText;
  try {
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, FIXED_IV);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return encryptedText; // Fallback to return original (for unencrypted legacy data)
  }
}

module.exports = {
  encryptZCodeField,
  decryptZCodeField,
};
