const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const env = require("./config/env");
const requestLogger = require("./middleware/requestLogger");
const { createHttpError, sendError, sendSuccess } = require("./utils/http");
const logger = require("./utils/logger");

// ─── Versioned Routers ────────────────────────────────────────────────────────
const v1Router = require("./routes/v1");

const app = express();
const allowedOrigins = env.clientUrl
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

// ─── Security Headers ─────────────────────────────────────────────────────────
app.use(helmet());

// ─── Rate Limiters ────────────────────────────────────────────────────────────
/** Strict limiter for auth routes – chống brute-force login */
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 15 giây
  max: 500,                  // tối đa 500 requests / 15 giây / IP
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests from this IP, please try again after 15 seconds.",
    code: "TOO_MANY_REQUESTS",
  },
});

/** General limiter cho toàn bộ API */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 15 phút
  max: 500,                 // tối đa 200 requests / 15 phút / IP
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests from this IP, please try again after 15 minutes.",
    code: "TOO_MANY_REQUESTS",
  },
});

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin(origin, callback) {
      if (
        !origin ||
        allowedOrigins.length === 0 ||
        allowedOrigins.includes(origin)
      ) {
        return callback(null, true);
      }

      return callback(
        createHttpError(403, "Origin not allowed by CORS", {
          code: "CORS_ORIGIN_FORBIDDEN",
        }),
      );
    },
    credentials: true,
  }),
);

app.use(express.json());
app.use(requestLogger);

// ─── Utility Routes ───────────────────────────────────────────────────────────
app.get("/health", (_req, res) =>
  sendSuccess(res, 200, "Health check success", {
    status: "ok",
    service: "crm-server",
  }),
);

/** API root: thông tin các versions hiện có */
app.get("/api", (_req, res) =>
  sendSuccess(res, 200, "CRM server API", {
    versions: {
      v1: "/api/v1",
    },
    latest: "v1",
  }),
);

// ─── API Versioning ───────────────────────────────────────────────────────────
// Áp dụng rate limiter chung cho toàn bộ /api/v1
app.use("/api/v1", apiLimiter);

// Auth limiter cho riêng /api/v1/auth
app.use("/api/v1/auth", authLimiter);

// Mount versioned router
app.use("/api/v1", v1Router);

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) =>
  sendError(res, 404, `Route not found: ${req.method} ${req.originalUrl}`, {
    code: "ROUTE_NOT_FOUND",
  }),
);

// ─── Global Error Handler ────────────────────────────────────────────────────
app.use((error, _req, res, _next) => {
  logger.error("Unhandled error", {
    message: error.message,
    code: error.code,
    status: error.status,
    stack: error.stack,
  });

  if (error?.code === 11000) {
    return sendError(res, 409, "Duplicate value detected", {
      code: "DUPLICATE_VALUE",
      details: error.keyValue,
    });
  }

  if (error?.type === "entity.parse.failed") {
    return sendError(res, 400, "Invalid JSON payload", {
      code: "INVALID_JSON_PAYLOAD",
    });
  }

  return sendError(
    res,
    error.status || 500,
    error.message || "Internal server error",
    {
      code: error.code,
      details: error.details,
    },
  );
});

module.exports = app;
