const env = require('../config/env');

/**
 * ─── ZCode Status Definitions ────────────────────────────────────────────────
 */
const ZCODE_STATUSES = Object.freeze({
  AVAILABLE: 'available',
  UNAVAILABLE: 'unavailable',
  SUCCESS: 'success',
  ERROR: 'error',
});

/**
 * ─── ZCode Error Reason Definitions ──────────────────────────────────────────
 */
const ZCODE_ERROR_REASONS = Object.freeze({
  WRONG_IP: 'wrong_ip',
  DUPLICATE_CODE: 'duplicate_code',
  REJECTED: 'rejected',
  TIMEOUT: 'timeout',
  OTHER: 'other',
});

/**
 * Returns the list of valid SKU values from environment config.
 * @returns {string[]}
 */
function getValidSkus() {
  return env.zcodeSkus
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

module.exports = {
  ZCODE_STATUSES,
  ZCODE_ERROR_REASONS,
  getValidSkus,
};
