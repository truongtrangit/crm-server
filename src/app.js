const express = require("express");
const cors = require("cors");
const env = require("./config/env");
const { authenticateRequest } = require("./middleware/auth");
const requestLogger = require("./middleware/requestLogger");
const { createHttpError, sendError, sendSuccess } = require("./utils/http");
const logger = require("./utils/logger");
const authRouter = require("./routes/auth");
const customersRouter = require("./routes/customers");
const usersRouter = require("./routes/users");
const leadsRouter = require("./routes/leads");
const tasksRouter = require("./routes/tasks");
const eventsRouter = require("./routes/events");
const organizationRouter = require("./routes/organization");
const metadataRouter = require("./routes/metadata");
const functionsRouter = require("./routes/functions");
const rbacRouter = require("./routes/rbac");
const actionConfigRouter = require("./routes/actionConfig");

const app = express();
const allowedOrigins = env.clientUrl
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

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

app.get("/health", (_req, res) => {
  return sendSuccess(res, 200, "Health check success", {
    status: "ok",
    service: "crm-server",
  });
});

app.get("/api", (_req, res) => {
  return sendSuccess(res, 200, "CRM server API is running", {
    resources: [
      "customers",
      "staff",
      "auth",
      "leads",
      "tasks",
      "events",
      "organization",
      "metadata",
      "functions",
      "action-config",
    ],
  });
});

app.use("/api/auth", authRouter);

app.use(authenticateRequest);
app.use("/api/customers", customersRouter);
app.use("/api/users", usersRouter);
app.use("/api/leads", leadsRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/events", eventsRouter);
app.use("/api/organization", organizationRouter);
app.use("/api/metadata", metadataRouter);
app.use("/api/functions", functionsRouter);
app.use("/api/rbac", rbacRouter);
app.use("/api/action-config", actionConfigRouter);

app.use((req, res) => {
  return sendError(
    res,
    404,
    `Route not found: ${req.method} ${req.originalUrl}`,
    {
      code: "ROUTE_NOT_FOUND",
    },
  );
});

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
