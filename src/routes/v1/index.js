const { Router } = require("express");

const authRouter = require("./auth");
const customersRouter = require("./customers");
const usersRouter = require("./users");

const eventsRouter = require("./events");
const organizationRouter = require("./organization");
const metadataRouter = require("./metadata");
const functionsRouter = require("./functions");
const functionalGroupsRouter = require("./functionalGroups");
const rbacRouter = require("./rbac");
const actionConfigRouter = require("./actionConfig");
const eventChainsRouter = require("./eventChains");
const globalEventChainsRouter = require("./globalEventChains");
const webhooksRouter = require("./webhooks");
const logsRouter = require("./logs");
const metaRouter = require("./meta");
const leadConfigRouter = require("./leadConfig");
const leadRouter = require("./leads");
const taskRouter = require("./tasks");
const taskChainsRouter = require("./taskChains");
const funnelsRouter = require("./funnels");
const staffRouter = require("./staffs");
const salaryRouter = require("./salaries");
const salaryConfigRouter = require("./salaryConfigs");
const revenueRouter = require("./revenues");
const expenseRouter = require("./expenses");
const companiesRouter = require("./companies");
const financeRouter = require("./finance");

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

// ─── Module APIs (RBAC applied in individual routers) ────────────────────────
v1Router.use("/customers", customersRouter);
v1Router.use("/users", usersRouter);
v1Router.use("/events", eventsRouter);
v1Router.use("/meta", metaRouter);
v1Router.use("/lead-config", leadConfigRouter);
v1Router.use("/leads", leadRouter);
v1Router.use("/tasks", taskRouter);
v1Router.use("/logs", logsRouter);
v1Router.use("/staffs", staffRouter);
v1Router.use("/salaries", salaryRouter);
v1Router.use("/salary-configs", salaryConfigRouter);
v1Router.use("/revenues", revenueRouter);
v1Router.use("/expenses", expenseRouter);
v1Router.use("/companies", companiesRouter);
v1Router.use("/finance", financeRouter);

// ─── Shared / Lookup APIs — no MLAC, only auth login required ───────────────
v1Router.use("/organization", organizationRouter);
v1Router.use("/metadata", metadataRouter);
v1Router.use("/functions", functionsRouter);
v1Router.use("/functional-groups", functionalGroupsRouter);
v1Router.use("/rbac", rbacRouter);
v1Router.use("/action-config", actionConfigRouter);
v1Router.use("/funnels", funnelsRouter);
v1Router.use("/event-chains", globalEventChainsRouter);

// Nested: chuỗi hành động trong sự kiện
v1Router.use("/events/:eventId/chains", eventChainsRouter);

// Nested: chuỗi hành động trong tác vụ
v1Router.use("/tasks/:taskId/chains", taskChainsRouter);

module.exports = v1Router;
