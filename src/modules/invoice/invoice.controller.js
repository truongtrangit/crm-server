const invoiceService = require('./invoice.service');
const { sendSuccess, createHttpError } = require('../../core/utils/http');
const SystemLogService = require('../system/log/systemLog.service');
const { RESOURCES } = require('../../core/constants/rbac');
const BkavAdapter = require('./adapters/BkavAdapter');
const logger = require('../../core/utils/logger');
const {
  createInvoiceSchema,
  updateInvoiceSchema,
  replaceAdjustInvoiceSchema,
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

  async exportInvoices(req, res) {
    const items = await invoiceService.exportInvoices(req.query);
    return sendSuccess(res, 200, 'Xuất danh sách hoá đơn thành công', items);
  }

  async getInvoiceById(req, res) {
    const invoice = await invoiceService.getInvoiceById(req.params.id);
    return sendSuccess(res, 200, 'Lấy chi tiết hoá đơn thành công', invoice);
  }

  async getStats(req, res) {
    const stats = await invoiceService.getStats();
    return sendSuccess(res, 200, 'Lấy thống kê hoá đơn thành công', stats);
  }

  async getQuota(req, res) {
    const quotas = await invoiceService.getQuota();
    return sendSuccess(res, 200, 'Lấy hạn mức hoá đơn thành công', quotas);
  }

  async lookupTaxCode(req, res) {
    const { code } = req.query;
    if (!code || code.length < 10) {
      throw createHttpError(400, 'Mã số thuế phải có ít nhất 10 ký tự');
    }

    try {
      // 1. Lấy cấu hình BKAV mặc định hoặc provider đầu tiên (vì lookupTaxCode không cần auth theo user, nhưng cần config BKAV)
      // Pass mask = false to get the real credentials for BKAV
      const providers = await invoiceService.getProviders({}, false);
      const bkavProvider = providers.find(
        (p) => p.providerType === 'bkav' && p.isActive,
      );

      if (bkavProvider && bkavProvider.bkav && bkavProvider.bkav.partnerGUID) {
        const adapter = new BkavAdapter(bkavProvider);
        const bkavRes = await adapter.lookupTaxCode(code);

        if (bkavRes.success && bkavRes.data) {
          const d = bkavRes.data;
          return sendSuccess(res, 200, 'Tra cứu MST qua BKAV thành công', {
            name: d.TenChinhThuc || d.tenChinhThuc || '',
            shortName: '',
            address:
              d.DiaChiGiaoDichChinh ||
              d.diaChiGiaoDichChinh ||
              d.DiaChiGiaoDichPhu ||
              '',
            taxCode: d.MaSoThue || d.maSoThue || code,
            owner: d.ChuDoanhNghiep || d.chuDoanhNghiep || '',
            status: d.TrangThaiHoatDong || d.trangThaiHoatDong || '',
          });
        }
      }

      // 2. Fallback to VietQR API if BKAV fails or not configured
      const response = await fetch(`https://api.vietqr.io/v2/business/${code}`);
      const data = await response.json();

      if (data.code === '00' && data.data) {
        return sendSuccess(res, 200, 'Tra cứu MST qua VietQR thành công', {
          name: data.data.name || '',
          shortName: data.data.shortName || '',
          address: data.data.address || '',
          taxCode: code,
          owner: '',
          status: '',
        });
      }

      return sendSuccess(res, 200, 'Không tìm thấy thông tin MST', null);
    } catch (err) {
      logger.error('Lookup tax code error:', err);
      return sendSuccess(res, 200, 'Không thể tra cứu MST', null);
    }
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
      metadata: {
        invoiceId: invoice.id,
        status: invoice.status,
        providerId: invoice.providerId,
      },
      req,
    });

    return sendSuccess(res, 201, 'Tạo hoá đơn thành công', invoice);
  }

  async updateInvoice(req, res) {
    const { error, value } = updateInvoiceSchema.validate(req.body);
    if (error) throw createHttpError(400, error.details[0].message);

    const invoice = await invoiceService.updateInvoice(
      req.params.id,
      value,
      req.user?.id,
    );

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

  async syncTaxStatus(req, res) {
    const result = await invoiceService.syncTaxStatus(req.params.id);

    SystemLogService.log({
      action: 'sync',
      resource: RESOURCES.INVOICES,
      resourceId: req.params.id,
      resourceName: `Hoá đơn ${req.params.id}`,
      description: `Đồng bộ trạng thái CQT hoá đơn ${req.params.id}`,
      req,
    });

    return sendSuccess(
      res,
      200,
      'Đồng bộ trạng thái thuế thành công',
      result.data,
    );
  }

  async resendEmail(req, res) {
    await invoiceService.resendEmail(req.params.id);

    SystemLogService.log({
      action: 'email',
      resource: RESOURCES.INVOICES,
      resourceId: req.params.id,
      resourceName: `Hoá đơn ${req.params.id}`,
      description: `Gửi lại email hoá đơn ${req.params.id}`,
      req,
    });

    return sendSuccess(res, 200, 'Gửi lại email thành công');
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

  async batchIssueInvoices(req, res) {
    const { ids } = req.body || {};
    const result = await invoiceService.batchIssueInvoices(ids);

    SystemLogService.log({
      action: 'update',
      resource: RESOURCES.INVOICES,
      resourceId: 'batch',
      resourceName: `Phát hành hàng loạt ${ids?.length} hoá đơn`,
      description: `Phát hành hàng loạt ${ids?.length} hoá đơn. Thành công: ${result.successCount}, Thất bại: ${result.failCount}`,
      metadata: { ids, result },
      req,
    });

    return sendSuccess(res, 200, 'Hoàn tất phát hành hàng loạt', result);
  }

  async downloadPdf(req, res) {
    const result = await invoiceService.downloadInvoice(req.params.id, 'pdf');
    return sendSuccess(res, 200, 'Lấy link tải PDF thành công', result);
  }

  async downloadXml(req, res) {
    const result = await invoiceService.downloadInvoice(req.params.id, 'xml');
    return sendSuccess(res, 200, 'Lấy link tải XML thành công', result);
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

  async replaceInvoice(req, res) {
    const { error, value } = replaceAdjustInvoiceSchema.validate(req.body);
    if (error) throw createHttpError(400, error.details[0].message);

    const invoice = await invoiceService.replaceInvoice(
      req.params.id,
      value,
      req.user?.id,
    );

    SystemLogService.log({
      action: 'create',
      resource: RESOURCES.INVOICES,
      resourceId: invoice.id,
      resourceName: `Thay thế hoá đơn ${req.params.id}`,
      description: `Tạo hoá đơn thay thế ${invoice.id} cho HĐ gốc ${req.params.id}`,
      metadata: {
        originalInvoiceId: req.params.id,
        newInvoiceId: invoice.id,
        relationType: 'replacement',
      },
      req,
    });

    return sendSuccess(res, 201, 'Thay thế hoá đơn thành công', invoice);
  }

  async adjustInvoice(req, res) {
    const { error, value } = replaceAdjustInvoiceSchema.validate(req.body);
    if (error) throw createHttpError(400, error.details[0].message);

    const invoice = await invoiceService.adjustInvoice(
      req.params.id,
      value,
      req.user?.id,
    );

    SystemLogService.log({
      action: 'create',
      resource: RESOURCES.INVOICES,
      resourceId: invoice.id,
      resourceName: `Điều chỉnh hoá đơn ${req.params.id}`,
      description: `Tạo hoá đơn điều chỉnh ${invoice.id} cho HĐ gốc ${req.params.id}`,
      metadata: {
        originalInvoiceId: req.params.id,
        newInvoiceId: invoice.id,
        relationType: 'adjustment',
      },
      req,
    });

    return sendSuccess(res, 201, 'Điều chỉnh hoá đơn thành công', invoice);
  }

  async signInvoiceWithHSM(req, res) {
    const result = await invoiceService.signInvoiceWithHSM(req.params.id);

    SystemLogService.log({
      action: 'update',
      resource: RESOURCES.INVOICES,
      resourceId: req.params.id,
      resourceName: `Ký HSM hoá đơn ${req.params.id}`,
      description: `Ký hoá đơn ${req.params.id} bằng HSM`,
      metadata: { invoiceId: req.params.id },
      req,
    });

    return sendSuccess(res, 200, 'Đã gửi yêu cầu ký HSM', result);
  }

  async batchSignWithHSM(req, res) {
    const { ids } = req.body || {};
    const result = await invoiceService.batchSignWithHSM(ids);

    SystemLogService.log({
      action: 'update',
      resource: RESOURCES.INVOICES,
      resourceId: 'batch',
      resourceName: `Ký HSM hàng loạt ${ids?.length} hoá đơn`,
      description: `Ký HSM hàng loạt ${ids?.length} hoá đơn`,
      metadata: { ids, result },
      req,
    });

    return sendSuccess(res, 200, 'Hoàn tất ký HSM hàng loạt', result);
  }

  async explainToCQT(req, res) {
    const { reason, notify, dateNotify, numberNotify } = req.body || {};
    if (!reason) throw createHttpError(400, 'Lý do giải trình là bắt buộc');

    const result = await invoiceService.explainToCQT(req.params.id, {
      reason,
      notify,
      dateNotify,
      numberNotify,
    });

    SystemLogService.log({
      action: 'update',
      resource: RESOURCES.INVOICES,
      resourceId: req.params.id,
      resourceName: `Giải trình CQT hoá đơn ${req.params.id}`,
      description: `Giải trình với CQT cho hoá đơn ${req.params.id}: ${reason}`,
      metadata: { invoiceId: req.params.id, reason },
      req,
    });

    return sendSuccess(res, 200, 'Đã gửi giải trình CQT', result);
  }

  async explainReplacedToCQT(req, res) {
    const { reason } = req.body || {};
    if (!reason) throw createHttpError(400, 'Lý do giải trình là bắt buộc');

    const result = await invoiceService.explainReplacedToCQT(req.params.id, {
      reason,
    });

    SystemLogService.log({
      action: 'update',
      resource: RESOURCES.INVOICES,
      resourceId: req.params.id,
      resourceName: `Giải trình TT/ĐC hoá đơn ${req.params.id}`,
      description: `Giải trình HĐ bị thay thế/điều chỉnh ${req.params.id}: ${reason}`,
      metadata: { invoiceId: req.params.id, reason },
      req,
    });

    return sendSuccess(res, 200, 'Đã gửi giải trình CQT', result);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Provider Endpoints
  // ═══════════════════════════════════════════════════════════════════════════

  async getProviders(req, res) {
    const providers = await invoiceService.getProviders(req.query);
    return sendSuccess(
      res,
      200,
      'Lấy danh sách nhà cung cấp thành công',
      providers,
    );
  }

  async getProviderById(req, res) {
    const provider = await invoiceService.getProviderById(req.params.id);
    return sendSuccess(
      res,
      200,
      'Lấy chi tiết nhà cung cấp thành công',
      provider,
    );
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
      metadata: {
        providerId: provider.id,
        providerType: provider.providerType,
      },
      req,
    });

    return sendSuccess(res, 201, 'Tạo nhà cung cấp thành công', provider);
  }

  async updateProvider(req, res) {
    const { error, value } = updateProviderSchema.validate(req.body);
    if (error) throw createHttpError(400, error.details[0].message);

    const provider = await invoiceService.updateProvider(
      req.params.id,
      value,
      req.user?.id,
    );

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
