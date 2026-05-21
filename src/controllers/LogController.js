const SystemLogService = require("../services/SystemLogService");
const AutomationLogService = require("../services/AutomationLogService");
const WebhookService = require("../services/WebhookService");
const { sendSuccess } = require("../utils/http");

/**
 * LogController — Unified API endpoints for all log types.
 * All logs are append-only — read-only endpoints only.
 */
class LogController {
  /**
   * GET /api/v1/logs/webhook
   * Query params: page, limit, status, eventType
   */
  async getWebhookLogs(req, res) {
    const result = await WebhookService.getLogs(req.query);
    return sendSuccess(res, 200, "Webhook logs retrieved", result);
  }

  /**
   * GET /api/v1/logs/system
   * Query params: page, limit, action, resource, status, userId
   */
  async getSystemLogs(req, res) {
    const result = await SystemLogService.getLogs(req.query);
    return sendSuccess(res, 200, "System logs retrieved", result);
  }

  /**
   * GET /api/v1/logs/automation
   * Query params: page, limit, status, eventId, blockAutomationId
   */
  async getAutomationLogs(req, res) {
    const result = await AutomationLogService.getLogs(req.query);
    return sendSuccess(res, 200, "Automation logs retrieved", result);
  }

  /**
   * POST /api/v1/logs/webhook/:id/retry
   */
  async retryWebhook(req, res) {
    const { id } = req.params;
    const result = await WebhookService.retryEvent(id);
    return sendSuccess(res, 200, "Thử lại webhook thành công", result);
  }
}

module.exports = new LogController();
