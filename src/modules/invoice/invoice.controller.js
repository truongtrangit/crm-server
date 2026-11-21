const invoiceService = require('./invoice.service');
const { sendSuccess, createHttpError } = require('../../core/utils/http');
const SystemLogService = require('../system/log/systemLog.service');
const { RESOURCES } = require('../../core/constants/rbac');
const BkavAdapter = require('./adapters/BkavAdapter');
const logger = require('../../core/utils/logger');
const {
  saveExternalInvoiceIdempotency,
} = require('../../core/middleware/externalInvoiceAuth');
const {
  createInvoiceSchema,
  updateInvoiceSchema,
  replaceAdjustInvoiceSchema,
  createProviderSchema,
  updateProviderSchema,
  createInvoiceProductSchema,
  updateInvoiceProductSchema,
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
    const result = await invoiceService.lookupTaxInfo(req.query.code);
    if (result) {
      return sendSuccess(res, 200, 'Tra cứu thông tin MST/CCCD thành công', result);
    }
    return sendSuccess(res, 200, 'Không tìm thấy thông tin MST/CCCD', null);
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
      description: `Cập nhật hoá đơn ${value.isDraft === false ? 'và phát hành' : 'nháp'} ${req.params.id}`,
      metadata: { invoiceId: req.params.id, status: invoice.status },
      req,
    });

    const successMessage =
      value.isDraft === false
        ? 'Cập nhật và phát hành hoá đơn thành công'
        : 'Cập nhật hoá đơn thành công';
    return sendSuccess(res, 200, successMessage, invoice);
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

  async syncFromProvider(req, res) {
    const invoice = await invoiceService.syncFromProvider(req.params.id);

    SystemLogService.log({
      action: 'update',
      resource: RESOURCES.INVOICES,
      resourceId: req.params.id,
      resourceName: `Hoá đơn ${req.params.id}`,
      description: `Đồng bộ hoá đơn ${req.params.id} từ BKAV/NCC`,
      req,
    });

    return sendSuccess(
      res,
      200,
      'Đồng bộ dữ liệu từ nhà cung cấp thành công',
      invoice,
    );
  }

  async downloadInvoice(req, res) {
    const format = req.query.format === 'xml' ? 'xml' : 'pdf';
    const disposition = req.query.inline === 'true' ? 'inline' : 'attachment';
    const file = await invoiceService.downloadInvoiceFile(
      req.params.id,
      format,
    );
    res.setHeader(
      'Content-Type',
      format === 'xml' ? 'application/xml' : 'application/pdf',
    );
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename="${encodeURIComponent(file.filename)}"`,
    );
    return res.send(file.buffer);
  }

  async cancelInvoice(req, res) {
    const reason = req.body?.reason?.trim();
    if (!reason) throw createHttpError(400, 'Lý do huỷ hoá đơn là bắt buộc');
    const invoice = await invoiceService.cancelInvoice(
      req.params.id,
      reason,
      req.user?.id,
    );

    SystemLogService.log({
      action: 'update',
      resource: RESOURCES.INVOICES,
      resourceId: req.params.id,
      resourceName: `Hoá đơn ${req.params.id}`,
      description: `Huỷ hoá đơn ${req.params.id}`,
      req,
    });

    return sendSuccess(res, 200, 'Huỷ hoá đơn thành công', invoice);
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

  // ═══════════════════════════════════════════════════════════════════════════
  // Product / Catalog Endpoints
  // ═══════════════════════════════════════════════════════════════════════════

  async getProducts(req, res) {
    const result = await invoiceService.getProducts(req.query);
    return sendSuccess(res, 200, 'Lấy danh sách sản phẩm thành công', result);
  }

  async getProductById(req, res) {
    const product = await invoiceService.getProductById(req.params.id);
    return sendSuccess(res, 200, 'Lấy chi tiết sản phẩm thành công', product);
  }

  async createProduct(req, res) {
    const { error, value } = createInvoiceProductSchema.validate(req.body);
    if (error) throw createHttpError(400, error.details[0].message);

    const product = await invoiceService.createProduct(value, req.user?.id);

    SystemLogService.log({
      action: 'create',
      resource: RESOURCES.INVOICE_PRODUCTS,
      resourceId: product.id,
      resourceName: `Sản phẩm hoá đơn "${product.name}"`,
      description: `Tạo sản phẩm hoá đơn "${product.name}" (${product.code})`,
      metadata: { productId: product.id, code: product.code },
      req,
    });

    return sendSuccess(res, 201, 'Tạo sản phẩm thành công', product);
  }

  async updateProduct(req, res) {
    const { error, value } = updateInvoiceProductSchema.validate(req.body);
    if (error) throw createHttpError(400, error.details[0].message);

    const product = await invoiceService.updateProduct(
      req.params.id,
      value,
      req.user?.id,
    );

    SystemLogService.log({
      action: 'update',
      resource: RESOURCES.INVOICE_PRODUCTS,
      resourceId: req.params.id,
      resourceName: `Sản phẩm hoá đơn "${product.name}"`,
      description: `Cập nhật sản phẩm hoá đơn "${product.name}" (${product.code})`,
      metadata: { productId: req.params.id, code: product.code },
      req,
    });

    return sendSuccess(res, 200, 'Cập nhật sản phẩm thành công', product);
  }

  async deleteProduct(req, res) {
    const result = await invoiceService.deleteProduct(
      req.params.id,
      req.user?.id,
    );

    SystemLogService.log({
      action: 'delete',
      resource: RESOURCES.INVOICE_PRODUCTS,
      resourceId: req.params.id,
      resourceName: `Sản phẩm hoá đơn ${req.params.id}`,
      description: `Xoá sản phẩm hoá đơn ${req.params.id}`,
      req,
    });

    return sendSuccess(res, 200, 'Xoá sản phẩm thành công', result);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Public Customer Lookup Endpoints (No Auth — For Customer Shareable URL)
  // ═══════════════════════════════════════════════════════════════════════════

  async getPublicInvoiceByCode(req, res) {
    const data = await invoiceService.getPublicInvoiceByCode(req.params.code);
    return sendSuccess(res, 200, 'Tra cứu hoá đơn thành công', data);
  }

  async downloadPublicInvoiceByCode(req, res) {
    const format = req.query.format === 'xml' ? 'xml' : 'pdf';
    const disposition = req.query.inline === 'true' ? 'inline' : 'attachment';
    const file = await invoiceService.downloadPublicInvoiceFile(
      req.params.code,
      format,
    );
    res.setHeader(
      'Content-Type',
      format === 'xml' ? 'application/xml' : 'application/pdf',
    );
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename="${encodeURIComponent(file.filename)}"`,
    );
    return res.send(file.buffer);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // External API Endpoints (Key.vn / ZCode & 3rd-party Integrations)
  // ═══════════════════════════════════════════════════════════════════════════

  async getExternalTemplate(req, res) {
    const template = await invoiceService.getExternalInvoiceTemplate();
    return sendSuccess(
      res,
      200,
      'Lấy template tạo hoá đơn bên thứ 3 thành công',
      template,
    );
  }

  async getExternalProducts(req, res) {
    const products = await invoiceService.getExternalProducts();
    return sendSuccess(
      res,
      200,
      'Lấy danh mục sản phẩm hoá đơn thành công',
      products,
    );
  }

  async getExternalInvoiceByRef(req, res) {
    const caller = req.externalCaller || 'external_api';
    const invoice = await invoiceService.getExternalInvoiceByRef(
      req.params.id,
      caller,
    );
    return sendSuccess(res, 200, 'Tra cứu hoá đơn thành công', invoice);
  }

  async createExternalInvoices(req, res) {
    const caller = req.externalCaller || 'external_api';
    const result = await invoiceService.createExternalInvoices(req.body, {
      caller,
      createdBy: `external:${caller}`,
    });

    if (result.isBatch) {
      const responseData = {
        total: result.total,
        successCount: result.successCount,
        failCount: result.failCount,
        duplicateCount: result.duplicateCount,
        results: result.results,
      };
      const message = `Xử lý xong ${result.total} hoá đơn (thành công: ${result.successCount}, thất bại: ${result.failCount})`;

      SystemLogService.log({
        action: 'create',
        resource: RESOURCES.INVOICES,
        resourceId: 'external-batch',
        resourceName: `External Batch (${caller}) — ${result.total} hoá đơn`,
        description: `Hệ thống ngoài (${caller}) gửi tạo ${result.total} hoá đơn (thành công: ${result.successCount}, thất bại: ${result.failCount})`,
        metadata: {
          caller,
          total: result.total,
          successCount: result.successCount,
          failCount: result.failCount,
          duplicateCount: result.duplicateCount,
        },
        req,
      });

      const responseBody = {
        statusCode: 200,
        message,
        data: responseData,
      };
      await saveExternalInvoiceIdempotency(
        req.externalInvoiceIdempotencyKey,
        200,
        responseBody,
        req,
      );

      return sendSuccess(res, 200, message, responseData);
    }

    // Single invoice mode
    const statusCode = result.duplicate ? 200 : 201;
    const message = result.duplicate
      ? 'Hoá đơn đã tồn tại cho mã chứng từ này (idempotent)'
      : 'Tạo hoá đơn thành công';

    if (!result.duplicate && result.invoice) {
      SystemLogService.log({
        action: 'create',
        resource: RESOURCES.INVOICES,
        resourceId: result.invoice.id,
        resourceName: `Hoá đơn ${result.invoice.id} (${caller})`,
        description: `Hệ thống ngoài (${caller}) tạo hoá đơn ${result.invoice.id} cho ${result.invoice.buyer?.name || 'N/A'}`,
        metadata: {
          caller,
          invoiceId: result.invoice.id,
          status: result.invoice.status,
          billCode: result.invoice.billCode,
          sourceId: result.invoice.sourceId,
        },
        req,
      });
    }

    const responseData = {
      ...result.invoice,
      duplicate: result.duplicate,
    };
    const responseBody = {
      statusCode,
      message,
      data: responseData,
    };
    await saveExternalInvoiceIdempotency(
      req.externalInvoiceIdempotencyKey,
      statusCode,
      responseBody,
      req,
    );

    return sendSuccess(res, statusCode, message, responseData);
  }
}

module.exports = new InvoiceController();
