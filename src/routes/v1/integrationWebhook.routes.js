const express = require("express");
const { requireApiKey } = require("../../core/middleware/externalAuth");
const env = require("../../core/config/env");
const IntegrationConfigController = require("../../modules/system/integrationConfig/integrationConfig.controller");

const router = express.Router();

// POST /api/v1/integration-webhook/:source/:eventType — Public Webhook cho hệ thống bên ngoài
// Yêu cầu header X-API-Key khớp với INTEGRATION_WEBHOOK_API_KEY
const middlewares = [];
if (env.integrationWebhookApiKey) {
  middlewares.push(requireApiKey(env.integrationWebhookApiKey, 'INTEGRATION_WEBHOOK'));
}

router.post(
  "/:source/:eventType",
  ...middlewares,
  IntegrationConfigController.genericWebhook,
);

module.exports = router;
