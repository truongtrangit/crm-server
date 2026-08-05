const Invoice = require('./invoice.model');
const InvoiceProvider = require('./invoiceProvider.model');
const AdapterFactory = require('./adapters/AdapterFactory');
const { buildPaginatedResponse } = require('../../core/utils/pagination');
const { createHttpError } = require('../../core/utils/http');
const { generateMonotonicId, ID_PREFIXES } = require('../../core/utils/id');
const {
  INVOICE_STATUSES,
  INVOICE_RELATION_TYPES,
} = require('../../core/constants/invoice');
const { escapeRegex } = require('../../core/utils/query');
const logger = require('../../core/utils/logger');

class InvoiceService {
  // ═══════════════════════════════════════════════════════════════════════════
  // Invoice CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  async getInvoices(query) {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {};

    if (query.search) {
      const escaped = escapeRegex(query.search);
      filter.$or = [
        { id: { $regex: escaped, $options: 'i' } },
        { 'buyer.name': { $regex: escaped, $options: 'i' } },
        { 'buyer.taxCode': { $regex: escaped, $options: 'i' } },
        { billCode: { $regex: escaped, $options: 'i' } },
        { invoiceSerial: { $regex: escaped, $options: 'i' } },
      ];
    }
    if (query.status && query.status !== 'all') {
      filter.status = query.status;
    }
    if (query.providerId) {
      filter.providerId = query.providerId;
    }
    if (query.providerType && query.providerType !== 'all') {
      filter.providerType = query.providerType;
    }
    if (query.startDate || query.endDate) {
      filter.invoiceDate = {};
      if (query.startDate) {
        filter.invoiceDate.$gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        filter.invoiceDate.$lte = end;
      }
    }

    const [items, total] = await Promise.all([
      Invoice.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Invoice.countDocuments(filter),
    ]);

    return buildPaginatedResponse(items, total, page, limit);
  }

  async exportInvoices(query) {
    const filter = {};
    if (query.search) {
      const escaped = escapeRegex(query.search);
      filter.$or = [
        { id: { $regex: escaped, $options: 'i' } },
        { 'buyer.name': { $regex: escaped, $options: 'i' } },
        { 'buyer.taxCode': { $regex: escaped, $options: 'i' } },
        { billCode: { $regex: escaped, $options: 'i' } },
        { invoiceSerial: { $regex: escaped, $options: 'i' } },
      ];
    }
    if (query.status && query.status !== 'all') {
      filter.status = query.status;
    }
    if (query.startDate || query.endDate) {
      filter.invoiceDate = {};
      if (query.startDate) filter.invoiceDate.$gte = new Date(query.startDate);
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        filter.invoiceDate.$lte = end;
      }
    }

    return Invoice.find(filter).sort({ createdAt: -1 }).limit(5000).lean();
  }

  async getInvoiceById(id) {
    const invoice = await Invoice.findOne({ id }).lean();
    if (!invoice) throw createHttpError(404, 'Không tìm thấy hoá đơn');
    return invoice;
  }

  async createInvoice(data, userId) {
    const provider = await InvoiceProvider.findOne({
      id: data.providerId,
    }).lean();
    if (!provider) throw createHttpError(400, 'Nhà cung cấp không tồn tại');
    if (!provider.isActive)
      throw createHttpError(400, 'Nhà cung cấp đã bị vô hiệu hoá');

    const id = await generateMonotonicId(ID_PREFIXES.INVOICE);

    // Tính tổng
    const totals = this._calculateTotals(data.items);

    const invoiceDoc = {
      id,
      providerId: provider.id,
      providerType: provider.providerType,
      invoiceForm: data.invoiceForm || provider.invoiceForm,
      invoiceSerial: data.invoiceSerial || provider.invoiceSerial,
      invoiceNo: data.invoiceNo || 0,
      invoiceDate: data.invoiceDate || new Date(),
      buyer: data.buyer,
      paymentMethod: data.paymentMethod,
      currency: data.currency,
      exchangeRate: data.exchangeRate,
      note: data.note,
      billCode: data.billCode,
      userDefine: data.userDefine,
      items: data.items,
      ...totals,
      status: data.isDraft ? INVOICE_STATUSES.DRAFT : INVOICE_STATUSES.PENDING,
      relatedInvoiceId: data.relatedInvoiceId || null,
      relationType: data.relationType || null,
      createdBy: userId,
    };

    const invoice = await Invoice.create(invoiceDoc);

    // Nếu không phải draft → phát hành ngay qua adapter
    if (!data.isDraft) {
      const issued = await this._issueViaProvider(invoice, provider);
      return issued;
    }

    return invoice.toObject();
  }

  async updateInvoice(id, data, userId) {
    const invoice = await Invoice.findOne({ id });
    if (!invoice) throw createHttpError(404, 'Không tìm thấy hoá đơn');
    if (invoice.status !== INVOICE_STATUSES.DRAFT) {
      throw createHttpError(400, 'Chỉ có thể sửa hoá đơn nháp');
    }

    // Nếu cập nhật items → tính lại tổng
    if (data.items) {
      const totals = this._calculateTotals(data.items);
      Object.assign(data, totals);
    }

    data.updatedBy = userId;

    const updated = await Invoice.findOneAndUpdate(
      { id },
      { $set: data },
      { new: true, lean: true },
    );
    return updated;
  }

  async deleteInvoice(id) {
    const invoice = await Invoice.findOne({ id });
    if (!invoice) throw createHttpError(404, 'Không tìm thấy hoá đơn');
    if (invoice.status !== INVOICE_STATUSES.DRAFT) {
      throw createHttpError(400, 'Chỉ có thể xoá hoá đơn nháp');
    }

    if (invoice.providerInvoiceGUID) {
      const provider = await InvoiceProvider.findOne({
        id: invoice.providerId,
      }).lean();
      if (provider) {
        try {
          const adapter = AdapterFactory.create(provider);
          if (typeof adapter.deleteDraft === 'function') {
            await adapter.deleteDraft(invoice);
          }
        } catch (err) {
          logger.error(
            `[Invoice] Error deleting draft on provider for ${id}:`,
            err.message,
          );
        }
      }
    }

    await Invoice.deleteOne({ id });
    return { id };
  }

  async syncTaxStatus(id) {
    const invoice = await Invoice.findOne({ id });
    if (!invoice) throw createHttpError(404, 'Không tìm thấy hoá đơn');

    const provider = await InvoiceProvider.findOne({
      id: invoice.providerId,
    }).lean();
    if (!provider)
      throw createHttpError(404, 'Không tìm thấy cấu hình nhà cung cấp');

    try {
      const adapter = AdapterFactory.create(provider);
      if (typeof adapter.syncTaxStatus !== 'function') {
        throw createHttpError(
          400,
          'Nhà cung cấp này không hỗ trợ đồng bộ trạng thái thuế',
        );
      }

      const result = await adapter.syncTaxStatus(invoice);
      if (!result.success) {
        throw createHttpError(
          400,
          result.error || 'Lỗi đồng bộ trạng thái thuế',
        );
      }

      // Update invoice status from provider
      if (result.data && result.data.TaxStatus) {
        invoice.taxStatus = result.data.TaxStatus;
        if (result.data.BkavStatus) {
          invoice.bkavStatus = result.data.BkavStatus;
        }
        await invoice.save();
      }

      return { success: true, data: result.data };
    } catch (err) {
      logger.error(`[Invoice] Error sync tax status for ${id}:`, err.message);
      throw createHttpError(500, err.message);
    }
  }

  async resendEmail(id) {
    const invoice = await Invoice.findOne({ id });
    if (!invoice) throw createHttpError(404, 'Không tìm thấy hoá đơn');

    const provider = await InvoiceProvider.findOne({
      id: invoice.providerId,
    }).lean();
    if (!provider)
      throw createHttpError(404, 'Không tìm thấy cấu hình nhà cung cấp');

    try {
      const adapter = AdapterFactory.create(provider);
      if (typeof adapter.resendEmail !== 'function') {
        throw createHttpError(
          400,
          'Nhà cung cấp này không hỗ trợ gửi lại email',
        );
      }

      const result = await adapter.resendEmail(invoice);
      if (!result.success) {
        throw createHttpError(400, result.error || 'Lỗi gửi email');
      }

      return { success: true };
    } catch (err) {
      logger.error(`[Invoice] Error resend email for ${id}:`, err.message);
      throw createHttpError(500, err.message);
    }
  }

  async downloadInvoice(id, format = 'pdf') {
    const invoice = await Invoice.findOne({ id });
    if (!invoice) throw createHttpError(404, 'Không tìm thấy hoá đơn');

    if (!invoice.lookupCode && !invoice.providerInvoiceGUID) {
      throw createHttpError(
        400,
        'Hoá đơn chưa được phát hành hoặc chưa có mã tra cứu',
      );
    }

    const provider = await InvoiceProvider.findOne({
      id: invoice.providerId,
    }).lean();
    if (!provider) throw createHttpError(400, 'Nhà cung cấp không tồn tại');

    const adapter = AdapterFactory.create(provider);
    const result = await adapter.download(invoice, format);

    if (!result.success) {
      throw createHttpError(
        400,
        result.error || 'Lỗi khi tải hoá đơn từ provider',
      );
    }

    return result;
  }

  async issueInvoice(id) {
    const invoice = await Invoice.findOne({ id });
    if (!invoice) throw createHttpError(404, 'Không tìm thấy hoá đơn');
    if (
      invoice.status !== INVOICE_STATUSES.DRAFT &&
      invoice.status !== INVOICE_STATUSES.ERROR
    ) {
      throw createHttpError(
        400,
        'Chỉ có thể phát hành hoá đơn nháp hoặc hoá đơn bị lỗi',
      );
    }

    const provider = await InvoiceProvider.findOne({
      id: invoice.providerId,
    }).lean();
    if (!provider) throw createHttpError(400, 'Nhà cung cấp không tồn tại');
    if (!provider.isActive)
      throw createHttpError(400, 'Nhà cung cấp đã bị vô hiệu hoá');

    return this._issueViaProvider(invoice, provider);
  }

  async batchIssueInvoices(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw createHttpError(400, 'Danh sách mã hoá đơn là bắt buộc');
    }

    const results = [];
    for (const id of ids) {
      try {
        const res = await this.issueInvoice(id);
        const isSuccess = res.status === INVOICE_STATUSES.ISSUED;
        results.push({
          id,
          success: isSuccess,
          status: res.status,
          error: res.providerErrorMessage || null,
        });
      } catch (err) {
        results.push({
          id,
          success: false,
          status: INVOICE_STATUSES.ERROR,
          error: err.message,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return {
      total: ids.length,
      successCount,
      failCount,
      results,
    };
  }

  async cancelInvoice(id, reason) {
    const invoice = await Invoice.findOne({ id });
    if (!invoice) throw createHttpError(404, 'Không tìm thấy hoá đơn');

    if (invoice.status === INVOICE_STATUSES.CANCELLED) {
      throw createHttpError(400, 'Hoá đơn đã được huỷ');
    }

    // Gọi adapter huỷ trên provider (BKAV CmdType 200)
    if (invoice.providerInvoiceGUID) {
      const provider = await InvoiceProvider.findOne({
        id: invoice.providerId,
      }).lean();
      if (provider) {
        try {
          const adapter = AdapterFactory.create(provider);
          const result = await adapter.cancel(invoice, reason);
          invoice.providerResponse = result.rawResponse;
          if (!result.success) {
            logger.warn(
              `[Invoice] Provider cancel failed for ${id}: ${result.error}`,
            );
            // Nếu adapter cancel thất bại → không set CANCELLED trong DB
            invoice.providerErrorMessage = result.error;
            await invoice.save();
            throw createHttpError(
              400,
              `Huỷ hoá đơn trên nhà cung cấp thất bại: ${result.error}`,
            );
          }
        } catch (err) {
          if (err.status) throw err; // Re-throw HTTP errors
          logger.error(
            `[Invoice] Adapter cancel error for ${id}:`,
            err.message,
          );
          throw createHttpError(500, `Lỗi khi huỷ hoá đơn: ${err.message}`);
        }
      }
    }

    invoice.status = INVOICE_STATUSES.CANCELLED;
    invoice.note = reason
      ? `${invoice.note}\n[Lý do huỷ] ${reason}`.trim()
      : invoice.note;
    await invoice.save();

    return invoice.toObject();
  }

  async retryInvoice(id) {
    const invoice = await Invoice.findOne({ id });
    if (!invoice) throw createHttpError(404, 'Không tìm thấy hoá đơn');
    if (invoice.status !== INVOICE_STATUSES.ERROR) {
      throw createHttpError(400, 'Chỉ có thể retry hoá đơn bị lỗi');
    }

    invoice.retryCount += 1;
    invoice.lastRetryAt = new Date();

    const provider = await InvoiceProvider.findOne({
      id: invoice.providerId,
    }).lean();
    if (!provider) throw createHttpError(400, 'Nhà cung cấp không tồn tại');

    logger.info(`[Invoice] Invoice ${id} retry #${invoice.retryCount}`);

    return this._issueViaProvider(invoice, provider);
  }

  async replaceInvoice(id, payload, userId) {
    const originalInvoice = await Invoice.findOne({ id });
    if (!originalInvoice)
      throw createHttpError(404, 'Không tìm thấy hoá đơn gốc');
    if (originalInvoice.status !== INVOICE_STATUSES.ISSUED) {
      throw createHttpError(
        400,
        'Chỉ có thể thay thế hoá đơn đã phát hành (ISSUED)',
      );
    }

    const provider = await InvoiceProvider.findOne({
      id: originalInvoice.providerId,
    }).lean();
    if (!provider) throw createHttpError(400, 'Nhà cung cấp không tồn tại');
    if (!provider.isActive)
      throw createHttpError(400, 'Nhà cung cấp đã bị vô hiệu hoá');

    const newId = await this._generateInvoiceId();
    const totals = this._calculateTotals(payload.items);

    const identify =
      originalInvoice.invoiceForm &&
      originalInvoice.invoiceSerial &&
      originalInvoice.invoiceNo
        ? `${originalInvoice.invoiceForm}_${originalInvoice.invoiceSerial}_${String(originalInvoice.invoiceNo).padStart(7, '0')}`
        : originalInvoice.providerInvoiceGUID || originalInvoice.id;

    const replacementInvoice = new Invoice({
      ...payload,
      id: newId,
      providerId: originalInvoice.providerId,
      providerType: originalInvoice.providerType,
      invoiceForm: payload.invoiceForm || originalInvoice.invoiceForm,
      invoiceSerial: payload.invoiceSerial || originalInvoice.invoiceSerial,
      status: INVOICE_STATUSES.DRAFT,
      relatedInvoiceId: originalInvoice.id,
      relationType: INVOICE_RELATION_TYPES.REPLACEMENT,
      relatedInvoiceIdentify: identify,
      providerInvoiceGUID: originalInvoice.providerInvoiceGUID,
      reason: payload.reason,
      totalAmountBeforeTax: totals.totalAmountBeforeTax,
      totalTaxAmount: totals.totalTaxAmount,
      totalDiscountAmount: totals.totalDiscountAmount,
      totalAmount: totals.totalAmount,
      createdBy: userId,
      updatedBy: userId,
    });

    await replacementInvoice.save();

    logger.info(
      `[Invoice] Created replacement draft ${newId} for original ${id}`,
    );

    const result = await this._issueViaProvider(replacementInvoice, provider);

    // Cập nhật status HĐ gốc → REPLACED nếu phát hành thay thế thành công
    if (result.status === INVOICE_STATUSES.ISSUED) {
      await Invoice.findOneAndUpdate(
        { id },
        { $set: { status: INVOICE_STATUSES.REPLACED } },
      );
      logger.info(`[Invoice] Original invoice ${id} marked as REPLACED`);
    }

    return result;
  }

  async adjustInvoice(id, payload, userId) {
    const originalInvoice = await Invoice.findOne({ id });
    if (!originalInvoice)
      throw createHttpError(404, 'Không tìm thấy hoá đơn gốc');
    if (originalInvoice.status !== INVOICE_STATUSES.ISSUED) {
      throw createHttpError(
        400,
        'Chỉ có thể điều chỉnh hoá đơn đã phát hành (ISSUED)',
      );
    }

    const provider = await InvoiceProvider.findOne({
      id: originalInvoice.providerId,
    }).lean();
    if (!provider) throw createHttpError(400, 'Nhà cung cấp không tồn tại');
    if (!provider.isActive)
      throw createHttpError(400, 'Nhà cung cấp đã bị vô hiệu hoá');

    const newId = await this._generateInvoiceId();
    const totals = this._calculateTotals(payload.items);

    const identify =
      originalInvoice.invoiceForm &&
      originalInvoice.invoiceSerial &&
      originalInvoice.invoiceNo
        ? `${originalInvoice.invoiceForm}_${originalInvoice.invoiceSerial}_${String(originalInvoice.invoiceNo).padStart(7, '0')}`
        : originalInvoice.providerInvoiceGUID || originalInvoice.id;

    const adjustmentInvoice = new Invoice({
      ...payload,
      id: newId,
      providerId: originalInvoice.providerId,
      providerType: originalInvoice.providerType,
      invoiceForm: payload.invoiceForm || originalInvoice.invoiceForm,
      invoiceSerial: payload.invoiceSerial || originalInvoice.invoiceSerial,
      status: INVOICE_STATUSES.DRAFT,
      relatedInvoiceId: originalInvoice.id,
      relationType: INVOICE_RELATION_TYPES.ADJUSTMENT,
      relatedInvoiceIdentify: identify,
      providerInvoiceGUID: originalInvoice.providerInvoiceGUID,
      reason: payload.reason,
      totalAmountBeforeTax: totals.totalAmountBeforeTax,
      totalTaxAmount: totals.totalTaxAmount,
      totalDiscountAmount: totals.totalDiscountAmount,
      totalAmount: totals.totalAmount,
      createdBy: userId,
      updatedBy: userId,
    });

    await adjustmentInvoice.save();

    logger.info(
      `[Invoice] Created adjustment draft ${newId} for original ${id}`,
    );

    const result = await this._issueViaProvider(adjustmentInvoice, provider);

    // Cập nhật status HĐ gốc → ADJUSTED nếu phát hành điều chỉnh thành công
    if (result.status === INVOICE_STATUSES.ISSUED) {
      await Invoice.findOneAndUpdate(
        { id },
        { $set: { status: INVOICE_STATUSES.ADJUSTED } },
      );
      logger.info(`[Invoice] Original invoice ${id} marked as ADJUSTED`);
    }

    return result;
  }

  async getStats() {
    const [total, draft, pending, issued, error, cancelled] = await Promise.all(
      [
        Invoice.countDocuments(),
        Invoice.countDocuments({ status: INVOICE_STATUSES.DRAFT }),
        Invoice.countDocuments({ status: INVOICE_STATUSES.PENDING }),
        Invoice.countDocuments({ status: INVOICE_STATUSES.ISSUED }),
        Invoice.countDocuments({ status: INVOICE_STATUSES.ERROR }),
        Invoice.countDocuments({ status: INVOICE_STATUSES.CANCELLED }),
      ],
    );
    return { total, draft, pending, issued, error, cancelled };
  }

  /**
   * Lấy thông tin hạn mức hoá đơn cho từng provider.
   * - BKAV: count từ DB (BKAV không có API quota)
   * - SePay: sẽ gọi SePay API khi tích hợp
   */
  async getQuota() {
    const providers = await InvoiceProvider.find({ isActive: true }).lean();
    const quotas = [];

    for (const provider of providers) {
      const issued = await Invoice.countDocuments({
        providerId: provider.id,
        status: {
          $in: [
            INVOICE_STATUSES.ISSUED,
            INVOICE_STATUSES.REPLACED,
            INVOICE_STATUSES.ADJUSTED,
          ],
        },
      });
      const total = await Invoice.countDocuments({ providerId: provider.id });

      quotas.push({
        providerId: provider.id,
        providerName: provider.name,
        providerType: provider.providerType,
        issued,
        total,
        // BKAV không có API quota → hiển thị count từ DB
        // SePay có thể gọi API GET /v1/usage để lấy quota_remaining
        quotaRemaining: null, // null = không xác định
      });
    }

    return quotas;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Provider CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  async getProviders(query = {}, mask = true) {
    const filter = {};
    if (query.providerType) filter.providerType = query.providerType;
    if (query.isActive !== undefined)
      filter.isActive = query.isActive === 'true';

    const providers = await InvoiceProvider.find(filter)
      .sort({ isDefault: -1, createdAt: -1 })
      .lean();

    if (mask) {
      return providers.map((p) => this._maskProviderSecrets(p));
    }
    return providers;
  }

  async getProviderById(id) {
    const provider = await InvoiceProvider.findOne({ id }).lean();
    if (!provider) throw createHttpError(404, 'Không tìm thấy nhà cung cấp');
    return this._maskProviderSecrets(provider);
  }

  async createProvider(data, userId) {
    const id = await generateMonotonicId(ID_PREFIXES.INVOICE_PROVIDER);

    // Nếu set isDefault → unset các provider default cũ
    if (data.isDefault) {
      await InvoiceProvider.updateMany(
        { isDefault: true },
        { $set: { isDefault: false } },
      );
    }

    const provider = await InvoiceProvider.create({
      ...data,
      id,
      createdBy: userId,
    });

    return this._maskProviderSecrets(provider.toObject());
  }

  async updateProvider(id, data, userId) {
    const provider = await InvoiceProvider.findOne({ id });
    if (!provider) throw createHttpError(404, 'Không tìm thấy nhà cung cấp');

    // Nếu set isDefault → unset các provider default cũ
    if (data.isDefault) {
      await InvoiceProvider.updateMany(
        { isDefault: true, id: { $ne: id } },
        { $set: { isDefault: false } },
      );
    }

    // Strip masked values — don't overwrite real secrets with masked placeholders
    const isMasked = (val) =>
      !val || val === '***' || /^[a-f0-9]{4}\.\.\.[a-f0-9]{4}$/i.test(val);
    if (data.bkav) {
      if (isMasked(data.bkav.partnerToken)) delete data.bkav.partnerToken;
      if (isMasked(data.bkav.partnerGUID)) delete data.bkav.partnerGUID;
    }
    if (data.sepay) {
      if (isMasked(data.sepay.bearerToken)) delete data.sepay.bearerToken;
    }

    // Flatten nested objects to dot notation for $set
    // This prevents MongoDB from replacing entire subdocuments (e.g. bkav, sepay)
    const setPayload = {};
    for (const [key, value] of Object.entries(data)) {
      if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        !(value instanceof Date)
      ) {
        // Flatten: { bkav: { endpoint: 'x' } } → { 'bkav.endpoint': 'x' }
        for (const [subKey, subVal] of Object.entries(value)) {
          setPayload[`${key}.${subKey}`] = subVal;
        }
      } else {
        setPayload[key] = value;
      }
    }
    setPayload.updatedBy = userId;

    const updated = await InvoiceProvider.findOneAndUpdate(
      { id },
      { $set: setPayload },
      { new: true, lean: true },
    );
    return this._maskProviderSecrets(updated);
  }

  async deleteProvider(id) {
    const provider = await InvoiceProvider.findOne({ id });
    if (!provider) throw createHttpError(404, 'Không tìm thấy nhà cung cấp');

    // Check xem có HĐ nào đang dùng provider này không
    const invoiceCount = await Invoice.countDocuments({ providerId: id });
    if (invoiceCount > 0) {
      throw createHttpError(
        400,
        `Không thể xoá: có ${invoiceCount} hoá đơn đang sử dụng nhà cung cấp này`,
      );
    }

    await InvoiceProvider.deleteOne({ id });
    return { id };
  }

  async testProviderConnection(id) {
    const provider = await InvoiceProvider.findOne({ id }).lean();
    if (!provider) throw createHttpError(404, 'Không tìm thấy nhà cung cấp');

    try {
      const adapter = AdapterFactory.create(provider);
      const result = await adapter.testConnection();
      return {
        providerId: id,
        providerType: provider.providerType,
        ...result,
      };
    } catch (err) {
      return {
        providerId: id,
        providerType: provider.providerType,
        success: false,
        message: `Lỗi tạo adapter: ${err.message}`,
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private: Provider Integration
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Issue hoá đơn qua provider adapter.
   * Cập nhật trạng thái invoice dựa trên kết quả trả về.
   */
  async _issueViaProvider(invoice, provider) {
    invoice.status = INVOICE_STATUSES.PENDING;
    await invoice.save();

    try {
      const adapter = AdapterFactory.create(provider);
      const result = await adapter.issue(invoice);
      logger.info(`[Invoice] Issue invoice ${invoice.id}:`, result);

      if (result.success) {
        invoice.status = INVOICE_STATUSES.ISSUED;
        invoice.providerInvoiceGUID = result.invoiceGUID || null;
        invoice.invoiceNo = result.invoiceNo || invoice.invoiceNo;
        invoice.lookupCode = result.lookupCode || null;
        invoice.issuedAt = new Date();
        invoice.providerResponse = result.rawResponse;
        invoice.providerErrorCode = null;
        invoice.providerErrorMessage = null;
        logger.info(
          `[Invoice] ✅ Invoice ${invoice.id} issued successfully (GUID: ${JSON.stringify(result)})`,
        );
      } else {
        invoice.status = INVOICE_STATUSES.ERROR;
        invoice.providerErrorCode = result.errorCode || null;
        invoice.providerErrorMessage = result.error || 'Unknown error';
        invoice.providerResponse = result.rawResponse;
        logger.error(
          `[Invoice] ❌ Invoice ${invoice.id} issue failed: ${JSON.stringify(result)}`,
        );
      }

      await invoice.save();
      return invoice.toObject();
    } catch (err) {
      invoice.status = INVOICE_STATUSES.ERROR;
      invoice.providerErrorMessage = err.message;
      await invoice.save();
      logger.error(`[Invoice] ❌ Adapter exception for ${invoice.id}:`, err);
      return invoice.toObject();
    }
  }

  /**
   * Ký hoá đơn bằng HSM qua BKAV.
   */
  async signInvoiceWithHSM(id) {
    const invoice = await Invoice.findOne({ id });
    if (!invoice) throw createHttpError(404, 'Không tìm thấy hoá đơn');
    if (!invoice.providerInvoiceGUID) {
      throw createHttpError(400, 'Hoá đơn chưa có InvoiceGUID từ BKAV');
    }

    const provider = await InvoiceProvider.findOne({
      id: invoice.providerId,
    }).lean();
    if (!provider) throw createHttpError(400, 'Nhà cung cấp không tồn tại');

    const adapter = AdapterFactory.create(provider);
    if (typeof adapter.signWithHSM !== 'function') {
      throw createHttpError(400, 'Nhà cung cấp không hỗ trợ ký HSM');
    }

    const result = await adapter.signWithHSM(invoice);
    return {
      invoiceId: id,
      ...result,
    };
  }

  /**
   * Ký nhiều hoá đơn bằng HSM.
   */
  async batchSignWithHSM(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw createHttpError(400, 'Danh sách mã hoá đơn là bắt buộc');
    }

    // Group invoices by provider
    const invoices = await Invoice.find({ id: { $in: ids } }).lean();
    if (invoices.length === 0)
      throw createHttpError(404, 'Không tìm thấy hoá đơn');

    const guids = invoices
      .filter((inv) => inv.providerInvoiceGUID)
      .map((inv) => inv.providerInvoiceGUID);

    if (guids.length === 0) {
      throw createHttpError(400, 'Không có hoá đơn nào có InvoiceGUID từ BKAV');
    }

    // Giả sử tất cả cùng 1 provider
    const firstInvoice = invoices[0];
    const provider = await InvoiceProvider.findOne({
      id: firstInvoice.providerId,
    }).lean();
    if (!provider) throw createHttpError(400, 'Nhà cung cấp không tồn tại');

    const adapter = AdapterFactory.create(provider);
    if (typeof adapter.signBatchWithHSM !== 'function') {
      throw createHttpError(400, 'Nhà cung cấp không hỗ trợ ký HSM');
    }

    const result = await adapter.signBatchWithHSM(guids);
    return {
      total: ids.length,
      signed: guids.length,
      ...result,
    };
  }

  /**
   * Giải trình với CQT — HĐ sai sót.
   */
  async explainToCQT(id, payload) {
    const invoice = await Invoice.findOne({ id });
    if (!invoice) throw createHttpError(404, 'Không tìm thấy hoá đơn');
    if (!invoice.providerInvoiceGUID) {
      throw createHttpError(400, 'Hoá đơn chưa có InvoiceGUID từ BKAV');
    }

    const provider = await InvoiceProvider.findOne({
      id: invoice.providerId,
    }).lean();
    if (!provider) throw createHttpError(400, 'Nhà cung cấp không tồn tại');

    const adapter = AdapterFactory.create(provider);
    if (typeof adapter.explainToCQT !== 'function') {
      throw createHttpError(400, 'Nhà cung cấp không hỗ trợ giải trình CQT');
    }

    const result = await adapter.explainToCQT({
      invoiceGUID: invoice.providerInvoiceGUID,
      reason: payload.reason,
      notify: payload.notify || false,
      dateNotify: payload.dateNotify,
      numberNotify: payload.numberNotify,
    });

    return {
      invoiceId: id,
      ...result,
    };
  }

  /**
   * Giải trình với CQT — HĐ bị thay thế / bị điều chỉnh.
   */
  async explainReplacedToCQT(id, payload) {
    const invoice = await Invoice.findOne({ id });
    if (!invoice) throw createHttpError(404, 'Không tìm thấy hoá đơn');
    if (!invoice.providerInvoiceGUID) {
      throw createHttpError(400, 'Hoá đơn chưa có InvoiceGUID từ BKAV');
    }

    const provider = await InvoiceProvider.findOne({
      id: invoice.providerId,
    }).lean();
    if (!provider) throw createHttpError(400, 'Nhà cung cấp không tồn tại');

    const adapter = AdapterFactory.create(provider);
    if (typeof adapter.explainReplacedToCQT !== 'function') {
      throw createHttpError(400, 'Nhà cung cấp không hỗ trợ giải trình CQT');
    }

    const result = await adapter.explainReplacedToCQT({
      invoiceGUID: invoice.providerInvoiceGUID,
      reason: payload.reason,
    });

    return {
      invoiceId: id,
      ...result,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private helpers
  // ═══════════════════════════════════════════════════════════════════════════

  _calculateTotals(items) {
    let totalAmountBeforeTax = 0;
    let totalTaxAmount = 0;
    let totalDiscountAmount = 0;

    for (const item of items) {
      if (item.isDiscount) {
        totalDiscountAmount += Math.abs(item.amount || 0);
      } else if (item.itemTypeId !== 4) {
        // Bỏ qua dòng ghi chú
        totalAmountBeforeTax += item.amount || 0;
        totalTaxAmount += item.taxAmount || 0;
        totalDiscountAmount += item.discountAmount || 0;
      }
    }

    return {
      totalAmountBeforeTax: Math.round(totalAmountBeforeTax * 100) / 100,
      totalTaxAmount: Math.round(totalTaxAmount * 100) / 100,
      totalDiscountAmount: Math.round(totalDiscountAmount * 100) / 100,
      totalAmount:
        Math.round(
          (totalAmountBeforeTax + totalTaxAmount - totalDiscountAmount) * 100,
        ) / 100,
    };
  }

  async _generateInvoiceId() {
    return generateMonotonicId(ID_PREFIXES.INVOICE);
  }

  _maskProviderSecrets(provider) {
    const masked = { ...provider };
    if (masked.bkav) {
      masked.bkav = {
        ...masked.bkav,
        ...(masked.bkav.partnerToken ? { partnerToken: '***' } : {}),
        ...(masked.bkav.partnerGUID ? { partnerGUID: '***' } : {}),
      };
    }
    if (masked.sepay?.bearerToken) {
      masked.sepay = { ...masked.sepay, bearerToken: '***' };
    }
    return masked;
  }
}

module.exports = new InvoiceService();
