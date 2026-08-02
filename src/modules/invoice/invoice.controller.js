const invoiceService = require('./invoice.service');
const { sendSuccess, createHttpError } = require('../../core/utils/http');
const SystemLogService = require('../system/log/systemLog.service');
const { RESOURCES } = require('../../core/constants/rbac');
const {
  createInvoiceSchema,
  updateInvoiceSchema,
  createProviderSchema,
  updateProviderSchema,
} = require('./invoice.validation');

class InvoiceController {
  // ═══════════════════════════════════════════════════════════════════════════
  // Invoice Endpoints
  // ═══════════════════════════════════════════════════════════════════════════

  async getInvoices(req, res) {
    const result = await invoiceService.getInvoices(req.query);
    return sendSuccess(res, 200, 'Lấy danh sách hoá đơn thành công', result);
  }

  async getInvoiceById(req, res) {
    const invoice = await invoiceService.getInvoiceById(req.params.id);
    return sendSuccess(res, 200, 'Lấy chi tiết hoá đơn thành công', invoice);
  }

  async getStats(req, res) {
    const stats = await invoiceService.getStats();
    return sendSuccess(res, 200, 'Lấy thống kê hoá đơn thành công', stats);
  }

  async createInvoice(req, res) {
    const { error, value } = createInvoiceSchema.validate(req.body);
    if (error) throw createHttpError(400, error.details[0].message);

    const invoice = await invoiceService.createInvoice(value, req.user?.id);

    SystemLogService.log({
      action: 'create',
      resource: RESOURCES.INVOICES,
      resourceId: invoice.id,
      resourceName: `Hoá đơn ${invoice.id}`,
      description: `Tạo hoá đơn ${value.isDraft ? 'nháp' : ''} cho ${invoice.buyer?.name || 'N/A'}`,
      metadata: { invoiceId: invoice.id, status: invoice.status, providerId: invoice.providerId },
      req,
    });

    return sendSuccess(res, 201, 'Tạo hoá đơn thành công', invoice);
  }

  async updateInvoice(req, res) {
    const { error, value } = updateInvoiceSchema.validate(req.body);
    if (error) throw createHttpError(400, error.details[0].message);

    const invoice = await invoiceService.updateInvoice(req.params.id, value, req.user?.id);

    SystemLogService.log({
      action: 'update',
      resource: RESOURCES.INVOICES,
      resourceId: req.params.id,
      resourceName: `Hoá đơn ${req.params.id}`,
      description: `Cập nhật hoá đơn nháp ${req.params.id}`,
      metadata: { invoiceId: req.params.id },
      req,
    });

    return sendSuccess(res, 200, 'Cập nhật hoá đơn thành công', invoice);
  }

  async deleteInvoice(req, res) {
    const result = await invoiceService.deleteInvoice(req.params.id);

    SystemLogService.log({
      action: 'delete',
      resource: RESOURCES.INVOICES,
      resourceId: req.params.id,
      resourceName: `Hoá đơn ${req.params.id}`,
      description: `Xoá hoá đơn nháp ${req.params.id}`,
      req,
    });

    return sendSuccess(res, 200, 'Xoá hoá đơn thành công', result);
  }

  async issueInvoice(req, res) {
    const invoice = await invoiceService.issueInvoice(req.params.id);

    SystemLogService.log({
      action: 'update',
      resource: RESOURCES.INVOICES,
      resourceId: req.params.id,
      resourceName: `Phát hành hoá đơn ${req.params.id}`,
      description: `Phát hành hoá đơn ${req.params.id} lên nhà cung cấp`,
      metadata: { invoiceId: req.params.id, status: invoice.status },
      req,
    });

    return sendSuccess(res, 200, 'Đã gửi yêu cầu phát hành hoá đơn', invoice);
  }

  async cancelInvoice(req, res) {
    const { reason } = req.body || {};
    const invoice = await invoiceService.cancelInvoice(req.params.id, reason);

    SystemLogService.log({
      action: 'update',
      resource: RESOURCES.INVOICES,
      resourceId: req.params.id,
      resourceName: `Huỷ hoá đơn ${req.params.id}`,
      description: `Huỷ hoá đơn ${req.params.id}${reason ? ': ' + reason : ''}`,
      metadata: { invoiceId: req.params.id, reason },
      req,
    });

    return sendSuccess(res, 200, 'Huỷ hoá đơn thành công', invoice);
  }

  async retryInvoice(req, res) {
    const invoice = await invoiceService.retryInvoice(req.params.id);

    SystemLogService.log({
      action: 'update',
      resource: RESOURCES.INVOICES,
      resourceId: req.params.id,
      resourceName: `Retry hoá đơn ${req.params.id}`,
      description: `Retry hoá đơn ${req.params.id} (lần ${invoice.retryCount})`,
      metadata: { invoiceId: req.params.id, retryCount: invoice.retryCount },
      req,
    });

    return sendSuccess(res, 200, 'Đã gửi retry hoá đơn', invoice);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Provider Endpoints
  // ═══════════════════════════════════════════════════════════════════════════

  async getProviders(req, res) {
    const providers = await invoiceService.getProviders(req.query);
    return sendSuccess(res, 200, 'Lấy danh sách nhà cung cấp thành công', providers);
  }

  async getProviderById(req, res) {
    const provider = await invoiceService.getProviderById(req.params.id);
    return sendSuccess(res, 200, 'Lấy chi tiết nhà cung cấp thành công', provider);
  }

  async createProvider(req, res) {
    const { error, value } = createProviderSchema.validate(req.body);
    if (error) throw createHttpError(400, error.details[0].message);

    const provider = await invoiceService.createProvider(value, req.user?.id);

    SystemLogService.log({
      action: 'create',
      resource: RESOURCES.INVOICE_PROVIDERS,
      resourceId: provider.id,
      resourceName: `NCC hoá đơn "${provider.name}"`,
      description: `Tạo nhà cung cấp hoá đơn "${provider.name}" (${provider.providerType})`,
      metadata: { providerId: provider.id, providerType: provider.providerType },
      req,
    });

    return sendSuccess(res, 201, 'Tạo nhà cung cấp thành công', provider);
  }

  async updateProvider(req, res) {
    const { error, value } = updateProviderSchema.validate(req.body);
    if (error) throw createHttpError(400, error.details[0].message);

    const provider = await invoiceService.updateProvider(req.params.id, value, req.user?.id);

    SystemLogService.log({
      action: 'update',
      resource: RESOURCES.INVOICE_PROVIDERS,
      resourceId: req.params.id,
      resourceName: `NCC hoá đơn "${provider.name}"`,
      description: `Cập nhật nhà cung cấp hoá đơn "${provider.name}"`,
      metadata: { providerId: req.params.id },
      req,
    });

    return sendSuccess(res, 200, 'Cập nhật nhà cung cấp thành công', provider);
  }

  async deleteProvider(req, res) {
    const result = await invoiceService.deleteProvider(req.params.id);

    SystemLogService.log({
      action: 'delete',
      resource: RESOURCES.INVOICE_PROVIDERS,
      resourceId: req.params.id,
      resourceName: `NCC hoá đơn ${req.params.id}`,
      description: `Xoá nhà cung cấp hoá đơn ${req.params.id}`,
      req,
    });

    return sendSuccess(res, 200, 'Xoá nhà cung cấp thành công', result);
  }

  async testProviderConnection(req, res) {
    const result = await invoiceService.testProviderConnection(req.params.id);
    return sendSuccess(res, 200, 'Kết quả test kết nối', result);
  }
}

module.exports = new InvoiceController();
