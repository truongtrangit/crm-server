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
 * ─── ZCode SKU List Prices (Giá niêm yết) ───────────────────────────────────
 */
const ZCODE_SKU_LIST_PRICES = Object.freeze({
  ZB5000: 1990000,
  ZB10000: 3990000,
  ZC10GB: 190000,
  ZC100GB: 490000,
  ZC500GB: 1490000,
  ZC1T: 2990000,
});

/**
 * ─── ZCode Price Adjustment Types ────────────────────────────────────────────
 */
const ZCODE_PRICE_ADJUSTMENT_TYPES = Object.freeze({
  NONE: 'none',
  DISCOUNT_PERCENT: 'discount_percent',
  DISCOUNT_AMOUNT: 'discount_amount',
  CUSTOM: 'custom',
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

/**
 * Returns the list price for a given SKU.
 * @param {string} sku
 * @returns {number|null}
 */
function getSkuListPrice(sku) {
  return ZCODE_SKU_LIST_PRICES[sku] ?? null;
}

module.exports = {
  ZCODE_STATUSES,
  ZCODE_ERROR_REASONS,
  ZCODE_SKU_LIST_PRICES,
  ZCODE_PRICE_ADJUSTMENT_TYPES,
  getValidSkus,
  getSkuListPrice,
};
