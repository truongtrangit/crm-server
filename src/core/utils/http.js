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

module.exports = {
  createHttpError,
  getErrorCodeByStatus,
  sendError,
  sendSuccess,
};
