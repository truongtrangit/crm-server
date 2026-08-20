const orderWebhookService = require('./orderWebhook.service');
const { sendSuccess } = require('../../../core/utils/http');
const SystemLogService = require('../../system/log/systemLog.service');
const { RESOURCES } = require('../../../core/constants/rbac');

class OrderWebhookController {
  // ─── Rules ──────────────────────────────────────────────────────────────────

  async getRules(req, res) {
    const result = await orderWebhookService.getRules(req.query);
    return sendSuccess(res, 200, 'Lấy danh sách cấu hình webhook thành công', result);
  }

  async getRuleById(req, res) {
    const rule = await orderWebhookService.getRuleById(req.params.id);
    return sendSuccess(res, 200, 'Lấy chi tiết cấu hình webhook thành công', rule);
  }

  async createRule(req, res) {
    const rule = await orderWebhookService.createRule(req.body, req.user?.id);

    SystemLogService.log({
      action: 'create',
      resource: RESOURCES.COURSES_ORDER_WEBHOOKS,
      resourceId: rule.id,
      resourceName: rule.name,
      description: `Tạo cấu hình webhook "${rule.name}" → ${rule.url}`,
      metadata: { ruleId: rule.id, url: rule.url, events: rule.events },
      req,
    });

    return sendSuccess(res, 201, 'Tạo cấu hình webhook thành công', rule);
  }

  async updateRule(req, res) {
    const rule = await orderWebhookService.updateRule(req.params.id, req.body);

    SystemLogService.log({
      action: 'update',
      resource: RESOURCES.COURSES_ORDER_WEBHOOKS,
      resourceId: rule.id,
      resourceName: rule.name,
      description: `Cập nhật cấu hình webhook "${rule.name}"`,
      metadata: { ruleId: rule.id },
      req,
    });

    return sendSuccess(res, 200, 'Cập nhật cấu hình webhook thành công', rule);
  }

  async toggleRule(req, res) {
    const rule = await orderWebhookService.toggleRule(req.params.id);

    SystemLogService.log({
      action: 'update',
      resource: RESOURCES.COURSES_ORDER_WEBHOOKS,
      resourceId: rule.id,
      resourceName: rule.name,
      description: `${rule.isActive ? 'Bật' : 'Tắt'} webhook "${rule.name}"`,
      metadata: { ruleId: rule.id, isActive: rule.isActive },
      req,
    });

    return sendSuccess(res, 200, `${rule.isActive ? 'Bật' : 'Tắt'} webhook thành công`, rule);
  }

  async deleteRule(req, res) {
    const rule = await orderWebhookService.deleteRule(req.params.id);

    SystemLogService.log({
      action: 'delete',
      resource: RESOURCES.COURSES_ORDER_WEBHOOKS,
      resourceId: rule.id,
      resourceName: rule.name,
      description: `Xóa cấu hình webhook "${rule.name}"`,
      metadata: { ruleId: rule.id },
      req,
    });

    return sendSuccess(res, 200, 'Xóa cấu hình webhook thành công', rule);
  }

  // ─── Delivery Logs ──────────────────────────────────────────────────────────

  async getDeliveryLogs(req, res) {
    const result = await orderWebhookService.getDeliveryLogs(req.query);
    return sendSuccess(res, 200, 'Lấy lịch sử gửi webhook thành công', result);
  }

  // ─── Sample Payload ─────────────────────────────────────────────────────────

  async getSamplePayload(req, res) {
    const sample = orderWebhookService.getSamplePayload();
    return sendSuccess(res, 200, 'Payload mẫu', sample);
  }
}

module.exports = new OrderWebhookController();
