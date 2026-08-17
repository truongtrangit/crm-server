const { sendSuccess } = require('../../../core/utils/http');
const IntegrationConfigService = require('./integrationConfig.service');
const CrmEventEmitter = require('../../../core/services/CrmEventEmitter');

class IntegrationConfigController {
  async listConfigs(req, res) {
    const configs = await IntegrationConfigService.listConfigs(req.query);
    return sendSuccess(res, 200, 'Integration configs retrieved', { configs });
  }

  async getConfigById(req, res) {
    const config = await IntegrationConfigService.getConfigById(req.params.id);
    return sendSuccess(res, 200, 'Integration config retrieved', { config });
  }

  async getSources(req, res) {
    const sources = await IntegrationConfigService.getSources();
    return sendSuccess(res, 200, 'Sources retrieved', { sources });
  }

  getSystemEvents(req, res) {
    const systemEvents = IntegrationConfigService.getSystemEvents();
    return sendSuccess(res, 200, 'System events retrieved', { systemEvents });
  }

  /**
   * GET /api/v1/integration-configs/:id/variables
   * Trả về danh sách biến template khả dụng (predefined + auto-discovered).
   */
  async getVariables(req, res) {
    const config = await IntegrationConfigService.getConfigById(req.params.id);
    const variables = IntegrationConfigService.getVariablesForConfig(config);
    return sendSuccess(res, 200, 'Variables retrieved', { variables });
  }

  /**
   * GET /api/v1/integration-configs/variables/preview?source=...&eventType=...
   * Preview biến template cho source+eventType (chưa cần config tồn tại).
   */
  getVariablesPreview(req, res) {
    const { source, eventType } = req.query;
    const variables = IntegrationConfigService._getPredefinedVariables(source || '', eventType || '');
    return sendSuccess(res, 200, 'Variables preview', { variables });
  }

  async testTrigger(req, res) {
    const { source, eventType, payload } = req.body;
    const result = await IntegrationConfigService.testTrigger(
      source,
      eventType,
      payload || {},
    );
    return sendSuccess(res, 200, result.message, result);
  }

  /**
   * Endpoint public cho third-party gọi webhook.
   * POST /api/v1/integration-configs/webhook/:source/:eventType
   */
  async genericWebhook(req, res) {
    const { source, eventType } = req.params;
    const payload = req.body || {};

    // Gọi CrmEventEmitter (fire and forget)
    CrmEventEmitter.emit(source, eventType, payload);

    // Trả về 200 OK ngay lập tức (không block third-party)
    return sendSuccess(res, 200, 'Webhook received and processing started');
  }

  async createConfig(req, res) {
    const config = await IntegrationConfigService.createConfig(
      req.body,
      req.user,
    );
    return sendSuccess(res, 201, 'Integration config created', { config });
  }

  async updateConfig(req, res) {
    const config = await IntegrationConfigService.updateConfig(
      req.params.id,
      req.body,
    );
    return sendSuccess(res, 200, 'Integration config updated', { config });
  }

  async deleteConfig(req, res) {
    await IntegrationConfigService.deleteConfig(req.params.id);
    return sendSuccess(res, 200, 'Integration config deleted');
  }
}

module.exports = new IntegrationConfigController();
