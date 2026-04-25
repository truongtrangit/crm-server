const WebhookService = require("../services/WebhookService");
const { sendSuccess } = require("../utils/http");

/**
 * Mapping URL path → eventType constant.
 * URL dùng kebab-case chuyên nghiệp, eventType dùng snake_case nội bộ.
 */
const ROUTE_TO_EVENT_TYPE = {
  "new-login": "user_login",
  "new-registration": "user_moi",
  "new-business": "biz_moi",
  "expiring-subscription": "sap_het_han",
  "upgrade-required": "can_nang_cap",
};

class WebhookController {
  /**
   * POST /api/v1/webhooks/:eventSlug
   * Nhận event từ bên thứ 3.
   * eventType được xác định từ URL path, không cần gửi trong body.
   * Body chính là payload — bên thứ 3 chỉ gửi data, không cần wrap.
   */
  async ingest(req, res) {
    // Lấy event slug từ URL path (e.g. "/new-registration" → "new-registration")
    const eventSlug = req.path.replace(/^\//, "");
    const eventType = ROUTE_TO_EVENT_TYPE[eventSlug];

    // Body chính là payload — không cần wrap trong { payload: ... }
    const payload = req.body;
    const deliveryId = req.webhookDeliveryId;
    const ipAddress = req.ip || req.socket?.remoteAddress || "";
    const source = payload.source || "external";

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
