/**
 * ─── Bank Log Constants ─────────────────────────────────────────────────────
 * Statuses, condition parameters, operators, and auth types for the Bank Log module.
 */

const BANK_LOG_TX_STATUSES = Object.freeze({
  SUCCESS: 'success',
  FAILED: 'failed',
  NO_ROUTE: 'no_route',
  PENDING: 'pending',
});

const BANK_LOG_CONDITION_PARAMS = Object.freeze({
  AMOUNT: 'amount',
  CONTENT: 'content',
  SENDER: 'sender',
});

const BANK_LOG_OPERATORS = Object.freeze({
  // Numeric operators (for amount)
  GREATER_THAN: 'greater_than',
  LESS_THAN: 'less_than',
  EQUAL: 'equal',
  // String operators (for content, sender)
  CONTAINS: 'contains',
  STARTS_WITH: 'starts_with',
  ENDS_WITH: 'ends_with',
  REGEX: 'regex',
});

const BANK_LOG_AUTH_TYPES = Object.freeze({
  NONE: 'none',
  BEARER: 'bearer',
  API_KEY: 'api_key',
  BASIC: 'basic',
  CUSTOM_HEADER: 'custom_header',
});

module.exports = {
  BANK_LOG_TX_STATUSES,
  BANK_LOG_CONDITION_PARAMS,
  BANK_LOG_OPERATORS,
  BANK_LOG_AUTH_TYPES,
};
