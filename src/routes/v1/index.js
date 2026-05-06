const { Router } = require("express");

const authRouter = require("./auth");
const customersRouter = require("./customers");
const usersRouter = require("./users");

const eventsRouter = require("./events");
const organizationRouter = require("./organization");
const metadataRouter = require("./metadata");
const functionsRouter = require("./functions");
const rbacRouter = require("./rbac");
const actionConfigRouter = require("./actionConfig");
const eventChainsRouter = require("./eventChains");
const webhooksRouter = require("./webhooks");
const logsRouter = require("./logs");
const metaRouter = require("./meta");

const { authenticateRequest, requirePermission } = require("../../middleware/auth");
const { PERMISSIONS } = require("../../constants/rbac");
const { sendSuccess } = require("../../utils/http");

const v1Router = Router();

// ─── Public ──────────────────────────────────────────────────────────────────
v1Router.get("/", (_req, res) =>
  sendSuccess(res, 200, "CRM API v1 is running", {
    version: "v1",
    resources: [
      "auth",
      "customers",
      "users",

      "events",
      "organization",
      "metadata",
      "functions",
      "rbac",
      "action-config",
      "event-chains",
      "webhooks",
      "logs",
      "meta",
    ],
  }),
);

v1Router.use("/auth", authRouter);

// ─── Webhook ingestion (own auth — bearer token, not CRM session) ───────────
v1Router.use("/webhooks", webhooksRouter);

// ─── Protected ───────────────────────────────────────────────────────────────
v1Router.use(authenticateRequest);

v1Router.use("/customers", customersRouter);
v1Router.use("/users", usersRouter);

v1Router.use("/events", eventsRouter);
v1Router.use("/organization", organizationRouter);
v1Router.use("/metadata", metadataRouter);
v1Router.use("/functions", functionsRouter);
v1Router.use("/rbac", rbacRouter);
v1Router.use("/action-config", actionConfigRouter);
v1Router.use("/logs", logsRouter);
v1Router.use("/meta", metaRouter);

// Nested: chuỗi hành động trong sự kiện
v1Router.use("/events/:eventId/chains", eventChainsRouter);

// Task Queue: lấy tất cả steps cần làm (cross-event)
const EventActionChainController = require("../../controllers/EventActionChainController");
v1Router.get(
  "/event-chains/queue",
  requirePermission(PERMISSIONS.EVENT_CHAINS_READ),
  EventActionChainController.getTaskQueue,
);

module.exports = v1Router;
