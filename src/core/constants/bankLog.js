/**
 * ─── Bank Log Constants ─────────────────────────────────────────────────────
 * Statuses, condition parameters, operators, and auth types for the Bank Log module.
 */

const BANK_LOG_TX_STATUSES = Object.freeze({
  SUCCESS: 'success',
  FAILED: 'failed',
  NO_ROUTE: 'no_route',
  PENDING: 'pending',
  IGNORED: 'ignored',
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

// ACB Webhook Response Codes
// ACB chỉ coi callback thành công khi HTTP 200 + responseCode = '00000000'
// Các code khác dùng để ACB phân loại lỗi và quyết định retry
const ACB_RESPONSE_CODES = Object.freeze({
  SUCCESS: '00000000',          // Tiếp nhận thành công
  INVALID_REQUEST: '40000001',  // Request body validation lỗi
  INVALID_CONTENT: '40000002',  // Content-Type không hợp lệ
  UNAUTHORIZED: '40100001',     // API Key không hợp lệ hoặc thiếu
  INVALID_CHECKSUM: '40100002', // Checksum signature không khớp
  MISSING_CHECKSUM: '40100003', // Thiếu checksum header
  IP_FORBIDDEN: '40300001',     // IP không nằm trong allowlist
  IP_BLOCKED: '40300002',       // IP bị chặn do brute-force
  INTERNAL_ERROR: '50000001',   // Lỗi nội bộ server
});

module.exports = {
  BANK_LOG_TX_STATUSES,
  BANK_LOG_CONDITION_PARAMS,
  BANK_LOG_OPERATORS,
  BANK_LOG_AUTH_TYPES,
  ACB_RESPONSE_CODES,
};
