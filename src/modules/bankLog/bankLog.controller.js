const bankLogService = require('./bankLog.service');
const { sendSuccess, createHttpError } = require('../../core/utils/http');
const SystemLogService = require('../system/log/systemLog.service');
const { RESOURCES } = require('../../core/constants/rbac');
const {
  createRuleSchema,
  updateRuleSchema,
  acbTransactionSchema,
} = require('./bankLog.validation');

class BankLogController {
  // ─── Transaction Endpoints ────────────────────────────────────────────────

  async getTransactions(req, res) {
    const result = await bankLogService.getTransactions(req.query);
    return sendSuccess(res, 200, 'Lấy danh sách giao dịch thành công', result);
  }

  async getTransactionById(req, res) {
    const tx = await bankLogService.getTransactionById(req.params.id);
    return sendSuccess(res, 200, 'Lấy chi tiết giao dịch thành công', tx);
  }

  async getStats(req, res) {
    const stats = await bankLogService.getStats();
    return sendSuccess(res, 200, 'Lấy thống kê thành công', stats);
  }

  async retryTransaction(req, res) {
    const result = await bankLogService.retryTransaction(req.params.id);

    SystemLogService.log({
      action: 'update',
      resource: RESOURCES.BANK_LOGS,
      resourceId: req.params.id,
      resourceName: `Retry giao dịch ${result.txId}`,
      description: `Retry giao dịch ${result.txId} (lần ${result.retryCount})`,
      metadata: { txId: result.txId, retryCount: result.retryCount },
      req,
    });

    return sendSuccess(res, 200, 'Đã gửi retry giao dịch', result);
  }

  async dispatchTransaction(req, res) {
    const { ruleId } = req.body;
    if (!ruleId) throw createHttpError(400, 'ruleId là bắt buộc');

    const result = await bankLogService.dispatchTransaction(req.params.id, ruleId);

    SystemLogService.log({
      action: 'update',
      resource: RESOURCES.BANK_LOGS,
      resourceId: req.params.id,
      resourceName: `Dispatch giao dịch ${result.txId} → ${result.ruleName}`,
      description: `Dispatch thủ công giao dịch ${result.txId} qua quy tắc "${result.ruleName}" (${result.status}, HTTP ${result.apiResponseCode})`,
      metadata: { txId: result.txId, ruleId, ruleName: result.ruleName, status: result.status },
      req,
    });

    return sendSuccess(res, 200, 'Dispatch giao dịch thành công', result);
  }

  // ─── Routing Rule Endpoints ───────────────────────────────────────────────

  async getRules(req, res) {
    const result = await bankLogService.getRules(req.query);
    return sendSuccess(res, 200, 'Lấy danh sách quy tắc thành công', result);
  }

  async createRule(req, res) {
    const { error, value } = createRuleSchema.validate(req.body);
    if (error) throw createHttpError(400, error.details[0].message);

    const rule = await bankLogService.createRule(value, req.user?.id);

    SystemLogService.log({
      action: 'create',
      resource: RESOURCES.BANK_LOG_RULES,
      resourceId: rule.id,
      resourceName: rule.name,
      description: `Tạo quy tắc định tuyến "${rule.name}"`,
      metadata: { ruleId: rule.id, targetApi: rule.targetApi?.url },
      req,
    });

    return sendSuccess(res, 201, 'Tạo quy tắc thành công', rule);
  }

  async updateRule(req, res) {
    const { error, value } = updateRuleSchema.validate(req.body);
    if (error) throw createHttpError(400, error.details[0].message);

    const rule = await bankLogService.updateRule(req.params.id, value);

    SystemLogService.log({
      action: 'update',
      resource: RESOURCES.BANK_LOG_RULES,
      resourceId: rule.id,
      resourceName: rule.name,
      description: `Cập nhật quy tắc "${rule.name}"`,
      metadata: { ruleId: rule.id },
      req,
    });

    return sendSuccess(res, 200, 'Cập nhật quy tắc thành công', rule);
  }

  async deleteRule(req, res) {
    const rule = await bankLogService.deleteRule(req.params.id);

    SystemLogService.log({
      action: 'delete',
      resource: RESOURCES.BANK_LOG_RULES,
      resourceId: rule.id,
      resourceName: rule.name,
      description: `Xóa quy tắc "${rule.name}"`,
      metadata: { ruleId: rule.id },
      req,
    });

    return sendSuccess(res, 200, 'Xóa quy tắc thành công', rule);
  }

  // ─── ACB Webhook Ingestion (Secure) ────────────────────────────────────────

  async ingestAcbTransaction(req, res) {
    const { error, value } = acbTransactionSchema.validate(req.body);
    if (error) throw createHttpError(400, error.details[0].message);

    // Map ACB fields → internal bank log format
    const mapped = {
      txId: value.txId,
      bank: 'ACB',
      sender: value.sender || null,
      amount: value.amount,
      content: value.content || null,
      transactionDate: value.transactionDate || new Date(),
    };

    const result = await bankLogService.ingestTransaction(mapped);

    return sendSuccess(res, 200, 'Transaction received', result);
  }
}

module.exports = new BankLogController();
