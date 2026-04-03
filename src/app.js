const express = require("express");
const cors = require("cors");
const env = require("./config/env");
const { authenticateRequest } = require("./middleware/auth");
const { createHttpError, sendError, sendSuccess } = require("./utils/http");
const authRouter = require("./routes/auth");
const customersRouter = require("./routes/customers");
const usersRouter = require("./routes/users");
const leadsRouter = require("./routes/leads");
const tasksRouter = require("./routes/tasks");
const organizationRouter = require("./routes/organization");
const metadataRouter = require("./routes/metadata");
const functionsRouter = require("./routes/functions");

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
      "organization",
      "metadata",
      "functions",
    ],
  });
});

app.use("/api/auth", authRouter);
app.use("/api/customers", authenticateRequest, customersRouter);
app.use("/api/users", usersRouter);
app.use("/api/leads", authenticateRequest, leadsRouter);
app.use("/api/tasks", authenticateRequest, tasksRouter);
app.use("/api/organization", authenticateRequest, organizationRouter);
app.use("/api/metadata", authenticateRequest, metadataRouter);
app.use("/api/functions", authenticateRequest, functionsRouter);

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
  console.error(error);

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
