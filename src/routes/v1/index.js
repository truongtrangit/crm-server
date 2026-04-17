const { Router } = require("express");

const authRouter = require("../auth");
const customersRouter = require("../customers");
const usersRouter = require("../users");
const leadsRouter = require("../leads");
const tasksRouter = require("../tasks");
const eventsRouter = require("../events");
const organizationRouter = require("../organization");
const metadataRouter = require("../metadata");
const functionsRouter = require("../functions");
const rbacRouter = require("../rbac");
const actionConfigRouter = require("../actionConfig");
const eventChainsRouter = require("../eventChains");

const { authenticateRequest } = require("../../middleware/auth");
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
      "leads",
      "tasks",
      "events",
      "organization",
      "metadata",
      "functions",
      "rbac",
      "action-config",
      "event-chains",
    ],
  }),
);

v1Router.use("/auth", authRouter);

// ─── Protected ───────────────────────────────────────────────────────────────
v1Router.use(authenticateRequest);

v1Router.use("/customers", customersRouter);
v1Router.use("/users", usersRouter);
v1Router.use("/leads", leadsRouter);
v1Router.use("/tasks", tasksRouter);
v1Router.use("/events", eventsRouter);
v1Router.use("/organization", organizationRouter);
v1Router.use("/metadata", metadataRouter);
v1Router.use("/functions", functionsRouter);
v1Router.use("/rbac", rbacRouter);
v1Router.use("/action-config", actionConfigRouter);

// Nested: chuỗi hành động trong sự kiện
v1Router.use("/events/:eventId/chains", eventChainsRouter);

// Task Queue: lấy tất cả steps cần làm (cross-event)
const asyncHandler = require("../../utils/asyncHandler");
const EventActionChainController = require("../../controllers/EventActionChainController");
v1Router.get(
  "/event-chains/queue",
  asyncHandler(EventActionChainController.getTaskQueue),
);

module.exports = v1Router;
