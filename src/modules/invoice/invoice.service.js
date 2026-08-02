const Invoice = require('./invoice.model');
const InvoiceProvider = require('./invoiceProvider.model');
const AdapterFactory = require('./adapters/AdapterFactory');
const { buildPaginatedResponse } = require('../../core/utils/pagination');
const { createHttpError } = require('../../core/utils/http');
const { generateMonotonicId, ID_PREFIXES } = require('../../core/utils/id');
const { INVOICE_STATUSES } = require('../../core/constants/invoice');
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
    await Invoice.deleteOne({ id });
    return { id };
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
          }
        } catch (err) {
          logger.error(
            `[Invoice] Adapter cancel error for ${id}:`,
            err.message,
          );
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

  // ═══════════════════════════════════════════════════════════════════════════
  // Provider CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  async getProviders(query) {
    const filter = {};
    if (query.providerType) filter.providerType = query.providerType;
    if (query.isActive !== undefined)
      filter.isActive = query.isActive === 'true';

    const providers = await InvoiceProvider.find(filter)
      .sort({ isDefault: -1, createdAt: -1 })
      .lean();

    // Mask sensitive tokens in response
    return providers.map((p) => this._maskProviderSecrets(p));
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

    data.updatedBy = userId;

    const updated = await InvoiceProvider.findOneAndUpdate(
      { id },
      { $set: data },
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
          `[Invoice] ✅ Invoice ${invoice.id} issued successfully (GUID: ${result})`,
        );
      } else {
        invoice.status = INVOICE_STATUSES.ERROR;
        invoice.providerErrorCode = result.errorCode || null;
        invoice.providerErrorMessage = result.error || 'Unknown error';
        invoice.providerResponse = result.rawResponse;
        logger.error(
          `[Invoice] ❌ Invoice ${invoice.id} issue failed: ${result}`,
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
      totalAmountBeforeTax,
      totalTaxAmount,
      totalDiscountAmount,
      totalAmount: totalAmountBeforeTax + totalTaxAmount - totalDiscountAmount,
    };
  }

  _maskProviderSecrets(provider) {
    const masked = { ...provider };
    if (masked.bkav?.partnerToken) {
      masked.bkav = { ...masked.bkav, partnerToken: '***' };
    }
    if (masked.bkav?.partnerGUID) {
      const guid = masked.bkav.partnerGUID;
      masked.bkav = {
        ...masked.bkav,
        partnerGUID:
          guid.length > 8
            ? `${guid.substring(0, 4)}...${guid.substring(guid.length - 4)}`
            : '***',
      };
    }
    if (masked.sepay?.bearerToken) {
      masked.sepay = { ...masked.sepay, bearerToken: '***' };
    }
    return masked;
  }
}

module.exports = new InvoiceService();
