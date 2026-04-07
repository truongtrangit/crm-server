const logger = require("../utils/logger");

/**
 * Middleware to log every HTTP request/response.
 * Captures method, URL, status, duration, user id (if authenticated), and request body for mutations.
 */
function requestLogger(req, res, next) {
  const start = Date.now();

  // Capture the original end to hook into response completion
  const originalEnd = res.end;

  res.end = function (...args) {
    const duration = Date.now() - start;
    const meta = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.get("user-agent") || "",
    };

    // Attach user id if authenticated
    if (req.user?.id) {
      meta.userId = req.user.id;
    }

    // Log request body for mutation methods (POST/PUT/PATCH/DELETE) — omit sensitive fields
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method) && req.body) {
      const sanitized = { ...req.body };
      const sensitiveKeys = [
        "password",
        "newPassword",
        "currentPassword",
        "passwordHash",
        "resetToken",
        "refreshToken",
        "accessToken",
      ];

      for (const key of sensitiveKeys) {
        if (sanitized[key] !== undefined) {
          sanitized[key] = "***";
        }
      }

      meta.body = sanitized;
    }

    const logLevel = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";

    logger[logLevel](`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`, meta);

    originalEnd.apply(res, args);
  };

  return next();
}

module.exports = requestLogger;
