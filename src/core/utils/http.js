const STATUS_CODE_MAP = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  422: "UNPROCESSABLE_ENTITY",
  500: "INTERNAL_SERVER_ERROR",
};

function getErrorCodeByStatus(status) {
  return STATUS_CODE_MAP[status] || "INTERNAL_SERVER_ERROR";
}

function createHttpError(status, message, options = {}) {
  const error = new Error(message);
  error.status = status;
  error.code = options.code || getErrorCodeByStatus(status);
  error.details = options.details;
  error.references = options.references;
  return error;
}

function sendError(res, status, message, options = {}) {
  const payload = {
    statusCode: status,
    code: options.code || getErrorCodeByStatus(status),
    message,
  };

  if (options.details !== undefined) {
    payload.details = options.details;
  }

  if (options.references !== undefined) {
    payload.references = options.references;
  }

  return res.status(status).json(payload);
}

function sendSuccess(res, status, message, data = null) {
  return res.status(status).json({
    statusCode: status,
    message,
    data,
  });
}

// ─── ACB Webhook Response Helpers ─────────────────────────────────────────────
// ACB yêu cầu tất cả response (cả success lẫn error) đều theo format:
//   { timestamp, responseCode, message, responseBody }
// ACB coi callback thành công khi HTTP 200 + responseCode = '00000000'

/**
 * Trả response lỗi theo ACB format.
 * @param {Object} res - Express response
 * @param {number} httpStatus - HTTP status code (400, 401, 403, 500, ...)
 * @param {string} responseCode - ACB response code (ví dụ: '40100001')
 * @param {string} message - Thông báo lỗi
 */
function sendAcbError(res, httpStatus, responseCode, message) {
  return res.status(httpStatus).json({
    timestamp: new Date().toISOString(),
    responseCode,
    message,
    responseBody: null,
  });
}

/**
 * Trả response thành công theo ACB format.
 * @param {Object} res - Express response
 * @param {string} referenceCode - clientRequestId từ ACB
 * @param {number} index - Số giao dịch đã xử lý
 */
function sendAcbSuccess(res, referenceCode, index) {
  return res.status(200).json({
    timestamp: new Date().toISOString(),
    responseCode: '00000000',
    message: 'Success',
    responseBody: {
      referenceCode,
      index,
    },
  });
}

module.exports = {
  createHttpError,
  getErrorCodeByStatus,
  sendError,
  sendSuccess,
  sendAcbError,
  sendAcbSuccess,
};
