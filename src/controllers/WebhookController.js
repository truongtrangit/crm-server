const crypto = require("crypto");
const WebhookService = require("../services/WebhookService");
const { sendSuccess } = require("../utils/http");

class WebhookController {
  /**
   * POST /api/v1/webhooks/ingest
   * Nhận event từ bên thứ 3.
   * Body: { eventType, payload, timestamp?, source? }
   */
  async ingest(req, res) {
    const { eventType, payload, source } = req.body;
    const deliveryId = req.webhookDeliveryId || crypto.randomUUID();
    const ipAddress = req.ip || req.socket?.remoteAddress || "";

    const result = await WebhookService.processEvent(
      eventType,
      payload,
      deliveryId,
      ipAddress,
      source,
    );

    return sendSuccess(res, 201, "Webhook processed successfully", {
      deliveryId,
      eventType,
      status: result.webhookLog.status,
      eventId: result.event?.id || null,
    });
  }

  /**
   * GET /api/v1/webhooks/logs
   * Xem lịch sử webhook — chỉ dành cho authenticated admin/owner.
   */
  async getLogs(req, res) {
    const result = await WebhookService.getLogs(req.query);

    return sendSuccess(res, 200, "Webhook logs retrieved", {
      items: result.logs,
      pagination: {
        page: result.page,
        limit: result.limit,
        totalItems: result.totalItems,
        totalPages: Math.ceil(result.totalItems / result.limit),
      },
    });
  }
}

module.exports = new WebhookController();
