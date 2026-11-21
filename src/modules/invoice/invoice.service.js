const axios = require('axios');
const Invoice = require('./invoice.model');
const InvoiceProvider = require('./invoiceProvider.model');
const InvoiceProduct = require('./invoiceProduct.model');
const TopupRequest = require('../customer/credit/topupRequest.model');
const AdapterFactory = require('./adapters/AdapterFactory');
const { buildPaginatedResponse } = require('../../core/utils/pagination');
const { createHttpError } = require('../../core/utils/http');
const { generateMonotonicId, ID_PREFIXES } = require('../../core/utils/id');
const {
  INVOICE_PROVIDER_TYPES,
  INVOICE_STATUSES,
  INVOICE_RELATION_TYPES,
  INVOICE_SOURCE_MODULES,
  INVOICE_ITEM_TYPE_ALIASES,
  BKAV_CMD_TYPES,
  BKAV_TAX_RATE_IDS,
  BKAV_TAX_RATE_TO_ID,
  BKAV_MAX_INVOICES_PER_REQUEST,
} = require('../../core/constants/invoice');
const { externalCreateInvoiceSchema } = require('./invoice.validation');
const { TOPUP_REQUEST_STATUS } = require('../../core/constants/appData');
const { escapeRegex } = require('../../core/utils/query');
const env = require('../../core/config/env');
const logger = require('../../core/utils/logger');

class InvoiceService {
  constructor() {
    // In-flight serialization map for (sourceModule:sourceId) to prevent concurrent duplicate issuance
    this._inFlightExternalKeys = new Map();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Invoice CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  _buildInvoiceListFilter(query = {}) {
    const filter = { isDeleted: { $ne: true } };

    if (query.search) {
      const escaped = escapeRegex(query.search);
      filter.$or = [
        { id: { $regex: escaped, $options: 'i' } },
        { 'buyer.name': { $regex: escaped, $options: 'i' } },
        { 'buyer.taxCode': { $regex: escaped, $options: 'i' } },
        { billCode: { $regex: escaped, $options: 'i' } },
        { sourceId: { $regex: escaped, $options: 'i' } },
        { lookupCode: { $regex: escaped, $options: 'i' } },
        { invoiceSerial: { $regex: escaped, $options: 'i' } },
      ];
      if (/^\d+$/.test(String(query.search).trim())) {
        filter.$or.push({ invoiceNo: Number(String(query.search).trim()) });
      }
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
    if (query.sourceModule && query.sourceModule !== 'all') {
      filter.sourceModule = query.sourceModule;
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

    return filter;
  }

  async getInvoices(query = {}) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(query.limit, 10) || 20));
    const skip = (page - 1) * limit;
    const filter = this._buildInvoiceListFilter(query);

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

  async exportInvoices(query = {}) {
    const filter = this._buildInvoiceListFilter(query);
    return Invoice.find(filter).sort({ createdAt: -1 }).limit(5000).lean();
  }

  async getInvoiceById(id) {
    const invoice = await Invoice.findOne({
      id,
      isDeleted: { $ne: true },
    }).lean();
    if (!invoice) throw createHttpError(404, 'Không tìm thấy hoá đơn');
    return invoice;
  }

  async createInvoice(data, userId) {
    const provider = await InvoiceProvider.findOne({
      id: data.providerId,
    }).lean();
    if (!provider) throw createHttpError(400, 'Nhà cung cấp không tồn tại');
    if (!provider.isActive) {
      throw createHttpError(400, 'Nhà cung cấp đã bị vô hiệu hoá');
    }

    // Ràng buộc Backend: Nếu hóa đơn phát sinh từ Yêu cầu nạp tiền, kiểm tra trạng thái duyệt
    const isCourseCreditTopup =
      data.sourceModule === INVOICE_SOURCE_MODULES.COURSE_CREDIT ||
      (data.billCode && data.billCode.startsWith('TPR'));
    const topupRequestId = data.sourceId || data.billCode;
    if (isCourseCreditTopup && topupRequestId) {
      const topupReq = await TopupRequest.findOne({
        id: topupRequestId,
      }).lean();
      if (!topupReq) {
        throw createHttpError(
          400,
          `Không tìm thấy yêu cầu nạp tiền #${topupRequestId}`,
        );
      }
      if (topupReq.status !== TOPUP_REQUEST_STATUS.APPROVED) {
        throw createHttpError(
          400,
          `Yêu cầu nạp tiền #${topupRequestId} chưa được duyệt, không thể tạo hóa đơn`,
        );
      }
      const duplicated = await Invoice.findOne({
        sourceId: topupRequestId,
        isDeleted: { $ne: true },
        status: {
          $nin: [INVOICE_STATUSES.CANCELLED, INVOICE_STATUSES.REPLACED],
        },
      }).lean();
      if (duplicated) {
        throw createHttpError(
          400,
          `Yêu cầu nạp tiền #${topupRequestId} đã có hoá đơn ${duplicated.id}`,
        );
      }
    }

    // Phân giải thông tin hàng hoá nếu có itemCode / productId
    if (Array.isArray(data.items)) {
      data.items = await this._resolveItems(data.items);
    }

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
      sourceModule:
        data.sourceModule ||
        (data.billCode?.startsWith('TPR')
          ? INVOICE_SOURCE_MODULES.COURSE_CREDIT
          : INVOICE_SOURCE_MODULES.DIRECT_SALE),
      sourceId:
        data.sourceId ||
        (data.billCode?.startsWith('TPR') ? data.billCode : null),
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
    const invoice = await Invoice.findOne({ id, isDeleted: { $ne: true } });
    if (!invoice) throw createHttpError(404, 'Không tìm thấy hoá đơn');
    if (
      invoice.status !== INVOICE_STATUSES.DRAFT &&
      invoice.status !== INVOICE_STATUSES.PENDING_SIGN
    ) {
      throw createHttpError(400, 'Chỉ có thể sửa hoá đơn nháp hoặc chờ ký');
    }

    // Nếu cập nhật items → phân giải và tính lại tổng
    if (data.items) {
      data.items = await this._resolveItems(data.items);
      const totals = this._calculateTotals(data.items);
      Object.assign(data, totals);
    }

    data.updatedBy = userId;

    const updated = await Invoice.findOneAndUpdate(
      { id },
      { $set: data },
      { new: true },
    );

    // Nếu hoá đơn đã được đẩy lên BKAV (có InvoiceGUID), cần update nội dung sang BKAV
    if (updated.providerInvoiceGUID) {
      const provider = await InvoiceProvider.findOne({
        id: updated.providerId,
      }).lean();
      if (provider) {
        try {
          const adapter = AdapterFactory.create(provider);
          if (typeof adapter.updateDraft === 'function') {
            const updateResult = await adapter.updateDraft(updated);
            if (!updateResult.success) {
              logger.error(
                `[Invoice] Failed to sync draft update to provider for ${id}:`,
                updateResult.error,
              );
              this._appendCallLog(updated, {
                action: 'update_draft',
                cmdType: BKAV_CMD_TYPES.UPDATE_204,
                success: false,
                errorMessage: updateResult.error,
              });
              // Lưu lỗi vào providerErrorMessage để hiển thị trên giao diện
              await Invoice.updateOne(
                { id },
                {
                  $set: {
                    providerErrorMessage: `Lỗi đồng bộ cập nhật BKAV: ${updateResult.error}`,
                    providerCallLogs: updated.providerCallLogs,
                  },
                },
              );
            } else {
              this._appendCallLog(updated, {
                action: 'update_draft',
                cmdType: BKAV_CMD_TYPES.UPDATE_204,
                success: true,
              });
              // Cập nhật thành công, xoá lỗi (nếu có)
              await Invoice.updateOne(
                { id },
                {
                  $set: {
                    providerErrorMessage: null,
                    providerCallLogs: updated.providerCallLogs,
                  },
                },
              );
            }
          }
        } catch (err) {
          logger.error(
            `[Invoice] Exception syncing draft update to provider for ${id}:`,
            err.message,
          );
        }
      }
    }

    // Nếu yêu cầu phát hành ngay (isDraft = false)
    if (data.isDraft === false) {
      const provider = await InvoiceProvider.findOne({
        id: updated.providerId,
      }).lean();
      if (!provider) throw createHttpError(400, 'Nhà cung cấp không tồn tại');
      if (!provider.isActive) {
        throw createHttpError(400, 'Nhà cung cấp đã bị vô hiệu hoá');
      }
      return await this._issueViaProvider(updated, provider);
    }

    return await Invoice.findOne({ id, isDeleted: { $ne: true } }).lean();
  }

  async deleteInvoice(id) {
    const invoice = await Invoice.findOne({ id, isDeleted: { $ne: true } });
    if (!invoice) throw createHttpError(404, 'Không tìm thấy hoá đơn');
    if (
      invoice.status !== INVOICE_STATUSES.DRAFT &&
      invoice.status !== INVOICE_STATUSES.PENDING_SIGN
    ) {
      throw createHttpError(400, 'Chỉ có thể xoá hoá đơn nháp hoặc chờ ký');
    }

    if (invoice.providerInvoiceGUID) {
      const provider = await InvoiceProvider.findOne({
        id: invoice.providerId,
      }).lean();
      if (provider) {
        try {
          const adapter = AdapterFactory.create(provider);
          if (typeof adapter.deleteDraft === 'function') {
            const result = await adapter.deleteDraft(invoice);
            if (result && !result.success) {
              this._appendCallLog(invoice, {
                action: 'delete_draft',
                cmdType: BKAV_CMD_TYPES.DELETE_DRAFT_301,
                success: false,
                errorMessage: result.error,
              });
              await invoice.save();
              throw createHttpError(
                400,
                `Lỗi khi xoá hoá đơn nháp trên BKAV: ${result.error}`,
              );
            }
            this._appendCallLog(invoice, {
              action: 'delete_draft',
              cmdType: BKAV_CMD_TYPES.DELETE_DRAFT_301,
              success: true,
            });
          }
        } catch (err) {
          logger.error(
            `[Invoice] Error deleting draft on provider for ${id}:`,
            err.message,
          );
          if (err.status) throw err; // Re-throw if it's an HTTP error we just created
          throw createHttpError(
            500,
            `Lỗi khi giao tiếp với BKAV: ${err.message}`,
          );
        }
      }
    }

    invoice.isDeleted = true;
    await invoice.save();
    return { id };
  }

  async syncFromProvider(id) {
    const invoice = await Invoice.findOne({ id, isDeleted: { $ne: true } });
    if (!invoice) throw createHttpError(404, 'Không tìm thấy hoá đơn');

    const provider = await InvoiceProvider.findOne({
      id: invoice.providerId,
    }).lean();
    if (!provider)
      throw createHttpError(404, 'Không tìm thấy cấu hình nhà cung cấp');

    try {
      const adapter = AdapterFactory.create(provider);
      if (typeof adapter.getInfo !== 'function') {
        throw createHttpError(
          400,
          'Nhà cung cấp này không hỗ trợ lấy thông tin từ xa',
        );
      }

      const result = await adapter.getInfo(invoice);
      if (!result.success || !result.data) {
        throw createHttpError(
          400,
          result.error || 'Không thể lấy thông tin hoá đơn từ BKAV',
        );
      }

      const data = result.data;
      const bkavInvoice = data.Invoice || data;

      // Cập nhật người mua
      if (bkavInvoice.BuyerName !== undefined) {
        invoice.buyer = invoice.buyer || {};
        if (bkavInvoice.BuyerName) invoice.buyer.name = bkavInvoice.BuyerName;
        if (bkavInvoice.BuyerCode !== undefined)
          invoice.buyer.code = bkavInvoice.BuyerCode;
        if (bkavInvoice.BuyerTaxCode !== undefined)
          invoice.buyer.taxCode = bkavInvoice.BuyerTaxCode;
        if (bkavInvoice.BuyerUnitName !== undefined)
          invoice.buyer.unitName = bkavInvoice.BuyerUnitName;
        if (bkavInvoice.BuyerAddress !== undefined)
          invoice.buyer.address = bkavInvoice.BuyerAddress;
        if (bkavInvoice.ReceiverEmail || bkavInvoice.BuyerEmail) {
          invoice.buyer.email =
            bkavInvoice.ReceiverEmail || bkavInvoice.BuyerEmail;
        }
        if (bkavInvoice.ReceiverMobile || bkavInvoice.BuyerPhone) {
          invoice.buyer.phone =
            bkavInvoice.ReceiverMobile || bkavInvoice.BuyerPhone;
        }
      }

      // Cập nhật thông tin hoá đơn
      if (bkavInvoice.InvoiceNo) {
        invoice.invoiceNo = bkavInvoice.InvoiceNo;
      }
      if (bkavInvoice.MTC || bkavInvoice.InvoiceCode) {
        invoice.lookupCode = bkavInvoice.MTC || bkavInvoice.InvoiceCode;
      }
      if (bkavInvoice.MaCuaCQT) {
        invoice.maCuaCQT = bkavInvoice.MaCuaCQT;
      }
      if (bkavInvoice.Note !== undefined) {
        invoice.note = bkavInvoice.Note;
      }

      // Cập nhật danh sách hàng hoá dịch vụ nếu có
      if (
        Array.isArray(data.ListInvoiceDetailsWS) &&
        data.ListInvoiceDetailsWS.length > 0
      ) {
        invoice.items = data.ListInvoiceDetailsWS.map((item) => ({
          itemCode: item.ItemCode || '',
          itemName: item.ItemName || '',
          unitName: item.UnitName || '',
          quantity: item.Qty || 0,
          unitPrice: item.Price || 0,
          amount: item.Amount || 0,
          taxRateId: item.TaxRateID || 3,
          taxRate:
            item.TaxRate !== undefined && item.TaxRate !== null
              ? item.TaxRate
              : 10,
          taxAmount: item.TaxAmount || 0,
          discountRate: item.DiscountRate || 0,
          discountAmount: item.DiscountAmount || 0,
          isDiscount: item.IsDiscount || false,
          itemTypeId: item.ItemTypeID || 0,
          userDefineDetails: item.UserDefineDetails || '',
          isIncrease: item.IsIncrease !== undefined ? item.IsIncrease : null,
        }));
        const totals = this._calculateTotals(invoice.items);
        Object.assign(invoice, totals);
      }

      // Cập nhật trạng thái
      if (result.crmStatus) {
        invoice.status = result.crmStatus;
        if (result.crmStatus === INVOICE_STATUSES.ISSUED && !invoice.issuedAt) {
          invoice.issuedAt = bkavInvoice.SignedDate
            ? new Date(bkavInvoice.SignedDate)
            : new Date();
        }
      }

      invoice.providerResponse = data;
      invoice.providerErrorMessage = null;
      this._appendCallLog(invoice, {
        action: 'sync',
        cmdType: BKAV_CMD_TYPES.GET_INFO_800,
        success: true,
      });
      await invoice.save();

      // Nếu đây là hoá đơn thay thế hoặc điều chỉnh và vừa chuyển sang ISSUED
      // thì cập nhật hoá đơn gốc tương ứng
      if (
        result.crmStatus === INVOICE_STATUSES.ISSUED &&
        invoice.relatedInvoiceId
      ) {
        let originalStatus = null;
        if (
          invoice.relationType === INVOICE_RELATION_TYPES.REPLACEMENT ||
          invoice.relationType === 'replacement'
        ) {
          originalStatus = INVOICE_STATUSES.REPLACED;
        } else if (
          invoice.relationType === INVOICE_RELATION_TYPES.ADJUSTMENT ||
          invoice.relationType === 'adjustment' ||
          invoice.relationType === INVOICE_RELATION_TYPES.ADJUSTMENT_DISCOUNT ||
          invoice.relationType === 'adjustment_discount'
        ) {
          originalStatus = INVOICE_STATUSES.ADJUSTED;
        }

        if (originalStatus) {
          await Invoice.findOneAndUpdate(
            { id: invoice.relatedInvoiceId },
            { $set: { status: originalStatus } },
          );
          logger.info(
            `[Invoice] Original invoice ${invoice.relatedInvoiceId} marked as ${originalStatus} after sync`,
          );
        }
      }

      return invoice.toObject();
    } catch (err) {
      logger.error(
        `[Invoice] Error sync from provider for ${id}:`,
        err.message,
      );
      this._appendCallLog(invoice, {
        action: 'sync',
        cmdType: BKAV_CMD_TYPES.GET_INFO_800,
        success: false,
        errorMessage: err.message,
      });
      await invoice.save().catch(() => {});
      throw createHttpError(500, err.message);
    }
  }

  async downloadInvoiceFile(id, format = 'pdf') {
    const invoice = await Invoice.findOne({
      id,
      isDeleted: { $ne: true },
    }).lean();
    if (!invoice) throw createHttpError(404, 'Không tìm thấy hoá đơn');
    if (!invoice.providerInvoiceGUID && !invoice.lookupCode) {
      throw createHttpError(400, 'Hoá đơn chưa được tạo trên nhà cung cấp');
    }
    const provider = await InvoiceProvider.findOne({
      id: invoice.providerId,
    }).lean();
    if (!provider) throw createHttpError(400, 'Nhà cung cấp không tồn tại');

    const adapter = AdapterFactory.create(provider);
    const result = await adapter.download(
      invoice,
      format === 'xml' ? 'xml' : 'pdf',
    );
    if (!result.success || !result.base64) {
      throw createHttpError(400, result.error || 'Không tải được file hoá đơn');
    }
    return {
      buffer: Buffer.from(result.base64, 'base64'),
      format: result.format,
      filename: `hoa-don-${invoice.invoiceSerial || ''}-${invoice.invoiceNo || invoice.id}.${result.format}`,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Public Customer Invoice Lookup (No Auth — Lookup by MTC / InvoiceGUID only)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Tạo URL tra cứu công khai trên CRM để gửi cho khách hàng xem trực tiếp
   * (thay thế trang tra cứu nhiều quảng cáo của BKAV).
   * Dùng INVOICE_PUBLIC_URL (nếu tách domain riêng) hoặc PUBLIC_APP_URL — tuyệt đối không tái sử dụng
   * CLIENT_URL (vốn chỉ dùng làm CORS allowlist và có thể chứa nhiều origin / IP / '*').
   */
  _buildPublicLookupUrl(inv) {
    const publicCode = inv?.lookupCode || inv?.providerInvoiceGUID || null;
    if (!publicCode) return null;
    const base = env.invoicePublicUrl || env.publicAppUrl;
    if (!base) {
      logger.warn(
        '[Invoice] PUBLIC_APP_URL / INVOICE_PUBLIC_URL chưa được cấu hình — không thể tạo public lookupUrl',
      );
      return null;
    }
    return `${base}/tra-cuu-hoa-don/${encodeURIComponent(publicCode)}`;
  }

  /**
   * Tìm hoá đơn theo Mã tra cứu (lookupCode / MTC) hoặc providerInvoiceGUID.
   * TUYỆT ĐỐI KHÔNG cho phép tra cứu public bằng mã tuần tự nội bộ (INV-YYYYMMDD-XXXX)
   * để chống dò quét (enumeration attack) dữ liệu khách hàng.
   */
  async _findInvoiceByPublicCode(rawCode) {
    const code = String(rawCode || '').trim();
    if (!code || code.length < 6 || /^INV-\d{8}-\d+$/i.test(code)) {
      throw createHttpError(
        404,
        'Mã tra cứu hoá đơn không hợp lệ hoặc không tồn tại',
      );
    }

    const exactCodeRegex = new RegExp(`^${escapeRegex(code)}$`, 'i');
    const invoice = await Invoice.findOne({
      isDeleted: { $ne: true },
      status: { $ne: INVOICE_STATUSES.DRAFT },
      $or: [
        { lookupCode: exactCodeRegex },
        { providerInvoiceGUID: exactCodeRegex },
      ],
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!invoice) {
      throw createHttpError(
        404,
        `Không tìm thấy hoá đơn với mã tra cứu "${code}"`,
      );
    }

    return invoice;
  }

  /**
   * Trả thông tin hiển thị hoá đơn công khai cho khách hàng (đã lọc bỏ toàn bộ dữ liệu nội bộ CRM).
   */
  async getPublicInvoiceByCode(rawCode) {
    const inv = await this._findInvoiceByPublicCode(rawCode);
    const publicCode = inv.lookupCode || inv.providerInvoiceGUID;

    return {
      publicCode,
      lookupCode: inv.lookupCode || null,
      lookupUrl: this._buildPublicLookupUrl(inv),
      status: inv.status,
      providerType: inv.providerType,
      invoiceForm: inv.invoiceForm || null,
      invoiceSerial: inv.invoiceSerial || null,
      invoiceNo: inv.invoiceNo || 0,
      invoiceDate: inv.invoiceDate || null,
      maCuaCQT: inv.maCuaCQT || '',
      billCode: inv.billCode || '',
      paymentMethod: inv.paymentMethod,
      currency: inv.currency || 'VND',
      exchangeRate: inv.exchangeRate || 1,
      note: inv.note || '',
      buyer: {
        type: inv.buyer?.type || 'company',
        name: inv.buyer?.name || '',
        unitName: inv.buyer?.unitName || '',
        taxCode: inv.buyer?.taxCode || '',
        address: inv.buyer?.address || '',
      },
      items: (inv.items || []).map((it) => ({
        itemCode: it.itemCode || '',
        itemName: it.itemName || '',
        unitName: it.unitName || '',
        quantity: it.quantity || 0,
        unitPrice: it.unitPrice || 0,
        amount: it.amount || 0,
        taxRate: it.taxRate,
        taxAmount: it.taxAmount || 0,
        discountRate: it.discountRate || 0,
        discountAmount: it.discountAmount || 0,
        isDiscount: !!it.isDiscount,
        itemTypeId: it.itemTypeId || 0,
      })),
      totalAmountBeforeTax: inv.totalAmountBeforeTax || 0,
      totalDiscountAmount: inv.totalDiscountAmount || 0,
      totalTaxAmount: inv.totalTaxAmount || 0,
      totalAmount: inv.totalAmount || 0,
      issuedAt: inv.issuedAt || null,
    };
  }

  /**
   * Tải file PDF hoặc XML bản thể hiện hoá đơn qua mã tra cứu công khai (không cần đăng nhập).
   */
  async downloadPublicInvoiceFile(rawCode, format = 'pdf') {
    const invoice = await this._findInvoiceByPublicCode(rawCode);
    const provider = await InvoiceProvider.findOne({
      id: invoice.providerId,
    }).lean();
    if (!provider) throw createHttpError(400, 'Nhà cung cấp không tồn tại');

    const adapter = AdapterFactory.create(provider);
    const result = await adapter.download(
      invoice,
      format === 'xml' ? 'xml' : 'pdf',
    );
    if (!result.success || !result.base64) {
      throw createHttpError(
        400,
        result.error || 'Không tải được bản thể hiện hoá đơn từ nhà cung cấp',
      );
    }
    const codeLabel =
      invoice.invoiceNo || invoice.lookupCode || invoice.providerInvoiceGUID;
    return {
      buffer: Buffer.from(result.base64, 'base64'),
      format: result.format,
      filename: `hoa-don-${invoice.invoiceSerial || ''}-${codeLabel}.${result.format}`,
    };
  }

  async cancelInvoice(id, reason, userId) {
    const invoice = await Invoice.findOne({ id, isDeleted: { $ne: true } });
    if (!invoice) throw createHttpError(404, 'Không tìm thấy hoá đơn');
    if (invoice.status !== INVOICE_STATUSES.ISSUED) {
      throw createHttpError(400, 'Chỉ có thể huỷ hoá đơn đã phát hành');
    }
    if (!reason || !String(reason).trim()) {
      throw createHttpError(400, 'Lý do huỷ là bắt buộc');
    }

    const provider = await InvoiceProvider.findOne({
      id: invoice.providerId,
    }).lean();
    if (!provider) throw createHttpError(400, 'Nhà cung cấp không tồn tại');

    const adapter = AdapterFactory.create(provider);
    if (typeof adapter.cancel !== 'function') {
      throw createHttpError(400, 'Nhà cung cấp không hỗ trợ huỷ hoá đơn');
    }

    const result = await adapter.cancel(invoice, String(reason).trim());
    if (!result.success) {
      invoice.providerErrorMessage = result.error || 'Lỗi huỷ hoá đơn';
      this._appendCallLog(invoice, {
        action: 'cancel',
        cmdType: BKAV_CMD_TYPES.CANCEL_202,
        success: false,
        errorMessage: invoice.providerErrorMessage,
      });
      await invoice.save();
      throw createHttpError(400, invoice.providerErrorMessage);
    }

    invoice.status = INVOICE_STATUSES.CANCELLED;
    invoice.cancelReason = String(reason).trim();
    invoice.providerErrorMessage = null;
    invoice.updatedBy = userId;
    this._appendCallLog(invoice, {
      action: 'cancel',
      cmdType: BKAV_CMD_TYPES.CANCEL_202,
      success: true,
    });
    await invoice.save();
    return invoice.toObject();
  }

  async issueInvoice(id) {
    const invoice = await Invoice.findOne({ id, isDeleted: { $ne: true } });
    if (!invoice) throw createHttpError(404, 'Không tìm thấy hoá đơn');
    if (
      invoice.status !== INVOICE_STATUSES.DRAFT &&
      invoice.status !== INVOICE_STATUSES.ERROR &&
      invoice.status !== INVOICE_STATUSES.PENDING_SIGN
    ) {
      throw createHttpError(
        400,
        'Chỉ có thể phát hành hoá đơn nháp, chờ ký hoặc bị lỗi',
      );
    }

    const provider = await InvoiceProvider.findOne({
      id: invoice.providerId,
    }).lean();
    if (!provider) throw createHttpError(400, 'Nhà cung cấp không tồn tại');
    if (!provider.isActive)
      throw createHttpError(400, 'Nhà cung cấp đã bị vô hiệu hoá');

    // Chờ ký bằng USB Token trên cổng BKAV (không dùng HSM) → chỉ đồng bộ trạng thái từ BKAV
    if (
      invoice.status === INVOICE_STATUSES.PENDING_SIGN &&
      !provider.bkav?.autoSign
    ) {
      return this.syncFromProvider(id);
    }

    return this._issueViaProvider(invoice, provider);
  }

  async batchIssueInvoices(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw createHttpError(400, 'Danh sách mã hoá đơn là bắt buộc');
    }
    if (ids.length > BKAV_MAX_INVOICES_PER_REQUEST) {
      throw createHttpError(
        400,
        `Chỉ được phát hành tối đa ${BKAV_MAX_INVOICES_PER_REQUEST} hoá đơn một lần`,
      );
    }

    const results = [];
    for (const id of ids) {
      try {
        const res = await this.issueInvoice(id);
        const isSuccess =
          res.status === INVOICE_STATUSES.ISSUED ||
          res.status === INVOICE_STATUSES.PENDING_SIGN;
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

  async retryInvoice(id) {
    const invoice = await Invoice.findOne({ id, isDeleted: { $ne: true } });
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
    const originalInvoice = await Invoice.findOne({
      id,
      isDeleted: { $ne: true },
    });
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

    if (Array.isArray(payload.items)) {
      payload.items = await this._resolveItems(payload.items);
    }
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

    let replaceCmdType = BKAV_CMD_TYPES.REPLACE_123;
    try {
      const adapter = AdapterFactory.create(provider);
      if (typeof adapter._determineCmdType === 'function') {
        replaceCmdType = adapter._determineCmdType(replacementInvoice);
      }
    } catch {
      // fallback to BKAV_CMD_TYPES.REPLACE_123
    }

    const result = await this._issueViaProvider(replacementInvoice, provider);

    // Cập nhật status HĐ gốc → REPLACED nếu phát hành thay thế thành công
    if (result.status === INVOICE_STATUSES.ISSUED) {
      this._appendCallLog(originalInvoice, {
        action: 'replace',
        cmdType: replaceCmdType,
        success: true,
      });
      await Invoice.findOneAndUpdate(
        { id },
        {
          $set: {
            status: INVOICE_STATUSES.REPLACED,
            providerErrorMessage: null,
            providerCallLogs: originalInvoice.providerCallLogs,
          },
        },
      );
      logger.info(`[Invoice] Original invoice ${id} marked as REPLACED`);
    } else if (result.status === INVOICE_STATUSES.PENDING_SIGN) {
      // Đã tạo trên BKAV, chờ kế toán ký (USB Token) — giữ lại HĐ mới, không xoá
      this._appendCallLog(originalInvoice, {
        action: 'replace',
        cmdType: replaceCmdType,
        success: true,
      });
      await Invoice.findOneAndUpdate(
        { id },
        {
          $set: {
            providerCallLogs: originalInvoice.providerCallLogs,
          },
        },
      );
      logger.info(
        `[Invoice] Invoice ${newId} created on provider, awaiting signature`,
      );
    } else {
      // Xoá hoá đơn lỗi vừa tạo để không rác DB
      await Invoice.deleteOne({ id: newId });

      // Update original invoice with the error message
      const errorMessage = `Lỗi thay thế: ${result.providerErrorMessage || result.error || 'Lỗi nhà cung cấp'}`;
      this._appendCallLog(originalInvoice, {
        action: 'replace',
        cmdType: replaceCmdType,
        success: false,
        errorCode: result.providerErrorCode || null,
        errorMessage,
      });
      await Invoice.findOneAndUpdate(
        { id },
        {
          $set: {
            providerErrorMessage: errorMessage,
            providerCallLogs: originalInvoice.providerCallLogs,
          },
        },
      );

      logger.info(
        `[Invoice] Deleted failed replacement invoice ${newId} and updated original invoice with error`,
      );
    }

    return result;
  }

  async adjustInvoice(id, payload, userId) {
    const originalInvoice = await Invoice.findOne({
      id,
      isDeleted: { $ne: true },
    });
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

    if (Array.isArray(payload.items)) {
      payload.items = await this._resolveItems(payload.items);
    }
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

    let adjustCmdType = BKAV_CMD_TYPES.ADJUST_124;
    try {
      const adapter = AdapterFactory.create(provider);
      if (typeof adapter._determineCmdType === 'function') {
        adjustCmdType = adapter._determineCmdType(adjustmentInvoice);
      }
    } catch {
      // fallback to BKAV_CMD_TYPES.ADJUST_124
    }

    const result = await this._issueViaProvider(adjustmentInvoice, provider);

    // Cập nhật status HĐ gốc → ADJUSTED nếu phát hành điều chỉnh thành công
    if (result.status === INVOICE_STATUSES.ISSUED) {
      this._appendCallLog(originalInvoice, {
        action: 'adjust',
        cmdType: adjustCmdType,
        success: true,
      });
      await Invoice.findOneAndUpdate(
        { id },
        {
          $set: {
            status: INVOICE_STATUSES.ADJUSTED,
            providerErrorMessage: null,
            providerCallLogs: originalInvoice.providerCallLogs,
          },
        },
      );
      logger.info(`[Invoice] Original invoice ${id} marked as ADJUSTED`);
    } else if (result.status === INVOICE_STATUSES.PENDING_SIGN) {
      // Đã tạo trên BKAV, chờ kế toán ký (USB Token) — giữ lại HĐ mới, không xoá
      this._appendCallLog(originalInvoice, {
        action: 'adjust',
        cmdType: adjustCmdType,
        success: true,
      });
      await Invoice.findOneAndUpdate(
        { id },
        {
          $set: {
            providerCallLogs: originalInvoice.providerCallLogs,
          },
        },
      );
      logger.info(
        `[Invoice] Invoice ${newId} created on provider, awaiting signature`,
      );
    } else {
      // Xoá hoá đơn lỗi vừa tạo để không rác DB
      await Invoice.deleteOne({ id: newId });

      // Update original invoice with the error message
      const errorMessage = `Lỗi điều chỉnh: ${result.providerErrorMessage || result.error || 'Lỗi nhà cung cấp'}`;
      this._appendCallLog(originalInvoice, {
        action: 'adjust',
        cmdType: adjustCmdType,
        success: false,
        errorCode: result.providerErrorCode || null,
        errorMessage,
      });
      await Invoice.findOneAndUpdate(
        { id },
        {
          $set: {
            providerErrorMessage: errorMessage,
            providerCallLogs: originalInvoice.providerCallLogs,
          },
        },
      );

      logger.info(
        `[Invoice] Deleted failed adjustment invoice ${newId} and updated original invoice with error`,
      );
    }

    return result;
  }

  async getStats() {
    const baseFilter = { isDeleted: { $ne: true } };
    const [
      total,
      draft,
      pendingSign,
      pending,
      issued,
      replaced,
      adjusted,
      error,
      cancelled,
    ] = await Promise.all([
      Invoice.countDocuments(baseFilter),
      Invoice.countDocuments({
        ...baseFilter,
        status: INVOICE_STATUSES.DRAFT,
      }),
      Invoice.countDocuments({
        ...baseFilter,
        status: INVOICE_STATUSES.PENDING_SIGN,
      }),
      Invoice.countDocuments({
        ...baseFilter,
        status: INVOICE_STATUSES.PENDING,
      }),
      Invoice.countDocuments({
        ...baseFilter,
        status: INVOICE_STATUSES.ISSUED,
      }),
      Invoice.countDocuments({
        ...baseFilter,
        status: INVOICE_STATUSES.REPLACED,
      }),
      Invoice.countDocuments({
        ...baseFilter,
        status: INVOICE_STATUSES.ADJUSTED,
      }),
      Invoice.countDocuments({
        ...baseFilter,
        status: INVOICE_STATUSES.ERROR,
      }),
      Invoice.countDocuments({
        ...baseFilter,
        status: INVOICE_STATUSES.CANCELLED,
      }),
    ]);
    return {
      total,
      draft,
      pendingSign,
      pending,
      issued,
      replaced,
      adjusted,
      error,
      cancelled,
    };
  }

  /**
   * Lấy thông tin hạn mức hoá đơn cho từng provider.
   * - BKAV: count từ DB (BKAV không có API quota)
   * - SePay: sẽ gọi SePay API khi tích hợp
   */
  async getQuota() {
    const providers = await InvoiceProvider.find({ isActive: true }).lean();
    if (providers.length === 0) return [];

    const providerIds = providers.map((p) => p.id);
    const issuedStatuses = [
      INVOICE_STATUSES.ISSUED,
      INVOICE_STATUSES.REPLACED,
      INVOICE_STATUSES.ADJUSTED,
    ];

    const counts = await Invoice.aggregate([
      {
        $match: {
          providerId: { $in: providerIds },
          isDeleted: { $ne: true },
        },
      },
      {
        $group: {
          _id: '$providerId',
          total: { $sum: 1 },
          issued: {
            $sum: {
              $cond: [{ $in: ['$status', issuedStatuses] }, 1, 0],
            },
          },
        },
      },
    ]);

    const countMap = new Map(counts.map((c) => [c._id, c]));

    return providers.map((provider) => {
      const stat = countMap.get(provider.id) || { issued: 0, total: 0 };
      return {
        providerId: provider.id,
        providerName: provider.name,
        providerType: provider.providerType,
        issued: stat.issued,
        total: stat.total,
        // BKAV không có API quota → hiển thị count từ DB
        // SePay có thể gọi API GET /v1/usage để lấy quota_remaining
        quotaRemaining: null, // null = không xác định
      };
    });
  }

  /**
   * Tra cứu thông tin người nộp thuế theo MST (10/14 số) hoặc CCCD (12 số định danh cá nhân).
   * Cascade qua 4 tầng:
   *  1. BKAV CmdType 904 (tự động đọc cả TenChinhThuc, TenNNT, ChuDoanhNghiep, HoVaTen)
   *  2. VietQR Business API (/v2/business/:code)
   *  3. Esgoo Tax API (https://esgoo.net/api-mst/:code.htm)
   *  4. Lịch sử hoá đơn CRM (buyer.taxCode hoặc buyer.cccd đã từng xuất hoá đơn)
   * Chỉ trả kết quả khi tìm được tên đơn vị / họ tên khác rỗng; nếu không có trả null.
   */
  async lookupTaxInfo(rawCode) {
    const code = String(rawCode || '')
      .trim()
      .replace(/\s+/g, '');
    if (!code || code.length < 10) {
      throw createHttpError(400, 'Mã số thuế / CCCD không hợp lệ');
    }

    const isCccdFormat = /^\d{12}$/.test(code);

    // 1. Ưu tiên tra qua BKAV (CmdType 904)
    try {
      const bkavProvider = await InvoiceProvider.findOne({
        providerType: INVOICE_PROVIDER_TYPES.BKAV,
        isActive: true,
      })
        .sort({ isDefault: -1 })
        .lean();

      if (bkavProvider) {
        const adapter = AdapterFactory.create(bkavProvider);
        const bkavRes = await adapter.lookupTaxCode(code);
        if (bkavRes?.success && bkavRes.data) {
          const d = bkavRes.data;
          const resolvedName = String(
            d.TenChinhThuc ||
              d.tenChinhThuc ||
              d.TenNNT ||
              d.tenNNT ||
              d.TenDonVi ||
              d.tenDonVi ||
              d.HoVaTen ||
              d.hoVaTen ||
              d.HoTen ||
              d.hoTen ||
              d.ChuDoanhNghiep ||
              d.chuDoanhNghiep ||
              d.NguoiDaiDien ||
              d.TenGiaoDich ||
              '',
          ).trim();

          const resolvedAddress = String(
            d.DiaChiGiaoDichChinh ||
              d.diaChiGiaoDichChinh ||
              d.DiaChiGiaoDichPhu ||
              d.DiaChiTruSo ||
              d.diaChiTruSo ||
              d.DiaChi ||
              d.diaChi ||
              '',
          ).trim();

          const resolvedOwner = String(
            d.ChuDoanhNghiep ||
              d.chuDoanhNghiep ||
              d.NguoiDaiDien ||
              d.HoVaTen ||
              d.HoTen ||
              '',
          ).trim();

          if (resolvedName) {
            return {
              taxCode: d.MaSoThue || code,
              cccd: isCccdFormat ? code : '',
              name: resolvedName,
              shortName: String(d.TenGiaoDich || '').trim(),
              address: resolvedAddress,
              status: String(d.TrangThaiHoatDong || '').trim(),
              owner: resolvedOwner,
              taxAgency: String(d.CoQuanThue || '').trim(),
              source: 'bkav',
            };
          }
        }
      }
    } catch (err) {
      logger.warn('[Invoice] BKAV tax/CCCD lookup failed, trying fallback', {
        code,
        error: err.message,
      });
    }

    // 2. Fallback 1: VietQR API (business & hộ kinh doanh)
    try {
      const { data } = await axios.get(
        `https://api.vietqr.io/v2/business/${encodeURIComponent(code)}`,
        { timeout: 5000 },
      );
      if (data?.code === '00' && data?.data) {
        const resolvedName = String(
          data.data.name ||
            data.data.internationalName ||
            data.data.shortName ||
            '',
        ).trim();
        if (resolvedName) {
          return {
            taxCode: data.data.id || code,
            cccd: isCccdFormat ? code : '',
            name: resolvedName,
            shortName: String(data.data.shortName || '').trim(),
            address: String(data.data.address || '').trim(),
            source: 'vietqr',
          };
        }
      }
    } catch (err) {
      logger.warn('[Invoice] VietQR tax lookup failed, trying Esgoo fallback', {
        code,
        error: err.message,
      });
    }

    // 3. Fallback 2: Esgoo MST API (hỗ trợ cả MST cá nhân / CCCD 12 số khi đã đồng bộ định danh thuế)
    try {
      const { data } = await axios.get(
        `https://esgoo.net/api-mst/${encodeURIComponent(code)}.htm`,
        { timeout: 5000 },
      );
      if (data?.error === 0 && data?.data) {
        const d = data.data;
        const resolvedName = String(
          d.ten || d.ten_quoc_te || d.ten_viet_tat || d.nguoi_dai_dien || '',
        ).trim();
        if (resolvedName) {
          return {
            taxCode: d.mst || code,
            cccd: isCccdFormat ? code : '',
            name: resolvedName,
            shortName: String(d.ten_viet_tat || '').trim(),
            address: String(d.dia_chi || '').trim(),
            owner: String(d.nguoi_dai_dien || '').trim(),
            phone: String(d.dien_thoai || '').trim(),
            status: String(d.tinh_trang || '').trim(),
            source: 'esgoo',
          };
        }
      }
    } catch (err) {
      logger.warn(
        '[Invoice] Esgoo tax lookup failed, trying CRM history fallback',
        {
          code,
          error: err.message,
        },
      );
    }

    // 4. Fallback 3: Tra cứu từ lịch sử hoá đơn đã tạo trong CRM (theo MST hoặc CCCD)
    try {
      const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const exactRegex = new RegExp(`^${escaped}$`, 'i');
      const prevInvoice = await Invoice.findOne({
        isDeleted: { $ne: true },
        $or: [{ 'buyer.taxCode': exactRegex }, { 'buyer.cccd': exactRegex }],
      })
        .sort({ createdAt: -1 })
        .select('buyer')
        .lean();

      if (prevInvoice?.buyer) {
        const b = prevInvoice.buyer;
        const resolvedName = String(b.unitName || b.name || '').trim();
        if (resolvedName && resolvedName !== 'Khách lẻ') {
          return {
            taxCode: b.taxCode || code,
            cccd: b.cccd || (isCccdFormat ? code : ''),
            name: resolvedName,
            shortName: '',
            address: String(b.address || '').trim(),
            owner: String(b.name || '').trim(),
            email: String(b.email || '').trim(),
            phone: String(b.phone || '').trim(),
            source: 'crm_history',
          };
        }
      }
    } catch (err) {
      logger.warn('[Invoice] CRM history lookup failed', {
        code,
        error: err.message,
      });
    }

    return null;
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
      .sort({ createdAt: -1 })
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

    // Nếu đây là provider đầu tiên, ép buộc nó làm mặc định
    const totalProviders = await InvoiceProvider.countDocuments();
    if (totalProviders === 0) {
      data.isDefault = true;
    }

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

    // Nếu đang tắt mặc định (data.isDefault === false)
    if (data.isDefault === false && provider.isDefault) {
      const otherDefaultCount = await InvoiceProvider.countDocuments({
        isDefault: true,
        id: { $ne: id },
      });
      if (otherDefaultCount === 0) {
        throw createHttpError(
          400,
          'Phải có ít nhất 1 nhà cung cấp được đặt làm mặc định',
        );
      }
    }

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

    // Nếu xoá provider mặc định, tìm provider khác (nếu có) để làm mặc định thay thế
    if (provider.isDefault) {
      const otherProvider = await InvoiceProvider.findOne().sort({
        createdAt: -1,
      });
      if (otherProvider) {
        await InvoiceProvider.updateOne(
          { id: otherProvider.id },
          { $set: { isDefault: true } },
        );
      }
    }

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
  // Product / Catalog CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  async getProducts(query = {}) {
    const filter = { isDeleted: { $ne: true } };
    if (query.isActive !== undefined && query.isActive !== 'all') {
      filter.isActive = query.isActive === 'true' || query.isActive === true;
    }
    if (query.search) {
      const escaped = escapeRegex(query.search);
      filter.$or = [
        { code: { $regex: escaped, $options: 'i' } },
        { name: { $regex: escaped, $options: 'i' } },
        { description: { $regex: escaped, $options: 'i' } },
      ];
    }

    // Trả về toàn bộ danh sách khi lấy cho dropdown / chọn nhanh trong form
    if (query.limit === 'all' || query.all === 'true') {
      const items = await InvoiceProduct.find(filter).sort({ name: 1 }).lean();
      return { items, total: items.length };
    }

    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(query.limit) || 20));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      InvoiceProduct.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      InvoiceProduct.countDocuments(filter),
    ]);

    return buildPaginatedResponse(items, total, page, limit);
  }

  async getProductById(id) {
    const product = await InvoiceProduct.findOne({
      id,
      isDeleted: { $ne: true },
    }).lean();
    if (!product) throw createHttpError(404, 'Không tìm thấy sản phẩm');
    return product;
  }

  async getProductByCode(code) {
    const product = await InvoiceProduct.findOne({
      code: String(code).trim().toUpperCase(),
      isDeleted: { $ne: true },
    }).lean();
    if (!product) {
      throw createHttpError(404, `Không tìm thấy sản phẩm với mã "${code}"`);
    }
    return product;
  }

  async createProduct(data, userId) {
    const code = String(data.code).trim().toUpperCase();
    const existing = await InvoiceProduct.findOne({
      code,
      isDeleted: { $ne: true },
    }).lean();
    if (existing) {
      throw createHttpError(400, `Mã sản phẩm "${code}" đã tồn tại`);
    }

    const id = await generateMonotonicId(ID_PREFIXES.INVOICE_PRODUCT);
    const product = await InvoiceProduct.create({
      ...data,
      id,
      code,
      createdBy: userId,
      updatedBy: userId,
    });

    return product.toObject();
  }

  async updateProduct(id, data, userId) {
    const product = await InvoiceProduct.findOne({
      id,
      isDeleted: { $ne: true },
    });
    if (!product) throw createHttpError(404, 'Không tìm thấy sản phẩm');

    if (data.code) {
      const newCode = String(data.code).trim().toUpperCase();
      if (newCode !== product.code) {
        const existing = await InvoiceProduct.findOne({
          code: newCode,
          isDeleted: { $ne: true },
          id: { $ne: id },
        }).lean();
        if (existing) {
          throw createHttpError(400, `Mã sản phẩm "${newCode}" đã tồn tại`);
        }
        data.code = newCode;
      }
    }

    Object.assign(product, data);
    product.updatedBy = userId;
    await product.save();

    return product.toObject();
  }

  async deleteProduct(id, userId) {
    const product = await InvoiceProduct.findOne({
      id,
      isDeleted: { $ne: true },
    });
    if (!product) throw createHttpError(404, 'Không tìm thấy sản phẩm');

    product.isDeleted = true;
    product.updatedBy = userId;
    await product.save();

    return { id, success: true };
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

      // Nếu hoá đơn đã tồn tại trên BKAV (đã có GUID từ lần đẩy nháp trước)
      // → Nếu cấu hình autoSign = false (dùng USB Token), đồng bộ lại trạng thái từ BKAV xem kế toán đã ký chưa
      // → Nếu cấu hình autoSign = true (dùng HSM), gọi ký HSM để phát hành chính thức thay vì tạo mới
      if (invoice.providerInvoiceGUID) {
        if (!provider.bkav?.autoSign) {
          logger.info(
            `[Invoice] Invoice ${invoice.id} already has GUID ${invoice.providerInvoiceGUID} and autoSign is false (USB token), syncing status from provider`,
          );
          return this.syncFromProvider(invoice.id);
        }

        logger.info(
          `[Invoice] Invoice ${invoice.id} already has GUID ${invoice.providerInvoiceGUID}, signing with HSM to publish`,
        );
        const signResult = await adapter.signWithHSM(invoice);
        logger.info(`[Invoice] HSM sign result for ${invoice.id}:`, signResult);

        if (signResult.success) {
          invoice.status = INVOICE_STATUSES.ISSUED;
          invoice.issuedAt = new Date();
          invoice.invoiceNo = signResult.invoiceNo || invoice.invoiceNo;
          invoice.lookupCode = signResult.lookupCode || invoice.lookupCode;
          invoice.providerResponse = signResult.rawResponse;
          invoice.providerErrorCode = null;
          invoice.providerErrorMessage = null;
          this._appendCallLog(invoice, {
            action: 'sign_hsm',
            cmdType: BKAV_CMD_TYPES.SIGN_HSM_205,
            success: true,
          });
          logger.info(
            `[Invoice] ✅ Invoice ${invoice.id} signed and published via HSM`,
          );
        } else {
          // Đã có GUID trên BKAV → giữ PENDING_SIGN để thử ký lại, tránh tạo trùng HĐ
          invoice.status = INVOICE_STATUSES.PENDING_SIGN;
          invoice.providerErrorMessage = signResult.error || 'Lỗi ký HSM';
          invoice.providerResponse = signResult.rawResponse;
          this._appendCallLog(invoice, {
            action: 'sign_hsm',
            cmdType: BKAV_CMD_TYPES.SIGN_HSM_205,
            success: false,
            errorMessage: invoice.providerErrorMessage,
          });
          logger.error(
            `[Invoice] ❌ Invoice ${invoice.id} HSM sign failed: ${signResult.error}`,
          );
        }

        await invoice.save();
        return invoice.toObject();
      }

      // Flow bình thường: tạo mới hoá đơn trên BKAV
      const result = await adapter.issue(invoice);
      logger.info(`[Invoice] Issue invoice ${invoice.id}:`, result);

      if (result.success) {
        // Lưu GUID và số HĐ nhận được từ BKAV trước
        invoice.providerInvoiceGUID = result.invoiceGUID || null;
        invoice.invoiceNo = result.invoiceNo || invoice.invoiceNo;
        invoice.lookupCode = result.lookupCode || null;
        invoice.providerResponse = result.rawResponse;
        invoice.providerErrorCode = null;
        invoice.providerErrorMessage = null;
        this._appendCallLog(invoice, {
          action: 'issue',
          cmdType: adapter._determineCmdType
            ? adapter._determineCmdType(invoice)
            : adapter.cmdType,
          success: true,
        });

        if (provider.bkav?.autoSign && invoice.providerInvoiceGUID) {
          // autoSign = true + có GUID → gọi CmdType 205 (ký HSM) để phát hành chính thức
          // HĐ tạo bởi CmdType 112 chỉ ở trạng thái "Chờ ký" trên BKAV cho đến khi HSM ký
          logger.info(
            `[Invoice] autoSign=true — signing invoice ${invoice.id} with HSM (CmdType 205)`,
          );
          // Lưu tạm PENDING_SIGN để giữ trạng thái chính xác khi HSM gọi
          invoice.status = INVOICE_STATUSES.PENDING_SIGN;
          await invoice.save();

          const signResult = await adapter.signWithHSM(invoice);
          if (signResult.success) {
            invoice.status = INVOICE_STATUSES.ISSUED;
            invoice.issuedAt = new Date();
            invoice.invoiceNo = signResult.invoiceNo || invoice.invoiceNo;
            invoice.lookupCode = signResult.lookupCode || invoice.lookupCode;
            invoice.providerResponse =
              signResult.rawResponse || invoice.providerResponse;
            this._appendCallLog(invoice, {
              action: 'sign_hsm',
              cmdType: BKAV_CMD_TYPES.SIGN_HSM_205,
              success: true,
            });
            logger.info(
              `[Invoice] ✅ Invoice ${invoice.id} issued and signed via HSM (status: ISSUED)`,
            );
          } else {
            // HSM ký thất bại → giữ PENDING_SIGN, để user tự ký lại hoặc sync
            invoice.status = INVOICE_STATUSES.PENDING_SIGN;
            invoice.providerErrorMessage =
              signResult.error || 'Lỗi ký HSM sau khi tạo HĐ';
            this._appendCallLog(invoice, {
              action: 'sign_hsm',
              cmdType: BKAV_CMD_TYPES.SIGN_HSM_205,
              success: false,
              errorMessage: invoice.providerErrorMessage,
            });
            logger.error(
              `[Invoice] ❌ HSM sign failed after create for ${invoice.id}: ${signResult.error}`,
            );
          }
        } else {
          // autoSign = false (USB Token) hoặc không có GUID:
          // Phân biệt trạng thái CRM dựa trên CmdType và kết quả tạo HĐ:
          // - CmdType 100, 110: tạo "Hoá đơn mới tạo" (chưa được cấp số, InvoiceNo = 0) -> CRM status = DRAFT
          // - CmdType 101, 111, 112, 120-127: tạo "Hoá đơn chờ / Chờ ký" (được cấp số HĐ) -> CRM status = PENDING_SIGN
          const effectiveCmdType = adapter._determineCmdType
            ? adapter._determineCmdType(invoice)
            : adapter.cmdType;
          const isUnnumberedDraft =
            [BKAV_CMD_TYPES.CREATE_100, BKAV_CMD_TYPES.CREATE_110].includes(
              effectiveCmdType,
            ) &&
            (!result.invoiceNo ||
              result.invoiceNo === 0 ||
              result.invoiceNo === '0');

          if (isUnnumberedDraft) {
            invoice.status = INVOICE_STATUSES.DRAFT;
          } else {
            invoice.status = INVOICE_STATUSES.PENDING_SIGN;
          }
        }

        logger.info(
          `[Invoice] ✅ Invoice ${invoice.id} processed successfully (GUID: ${invoice.providerInvoiceGUID}, No: ${invoice.invoiceNo}, status: ${invoice.status})`,
        );
      } else {
        invoice.status = INVOICE_STATUSES.ERROR;
        invoice.providerErrorCode = result.errorCode || null;
        invoice.providerErrorMessage = result.error || 'Unknown error';
        invoice.providerResponse = result.rawResponse;
        this._appendCallLog(invoice, {
          action: 'issue',
          cmdType: adapter._determineCmdType
            ? adapter._determineCmdType(invoice)
            : adapter.cmdType,
          success: false,
          errorCode: invoice.providerErrorCode,
          errorMessage: invoice.providerErrorMessage,
        });
        logger.error(
          `[Invoice] ❌ Invoice ${invoice.id} issue failed: ${JSON.stringify(result)}`,
        );
      }

      await invoice.save();
      return invoice.toObject();
    } catch (err) {
      invoice.status = INVOICE_STATUSES.ERROR;
      invoice.providerErrorMessage = err.message;
      this._appendCallLog(invoice, {
        action: 'issue',
        success: false,
        errorMessage: err.message,
      });
      await invoice.save();
      logger.error(`[Invoice] ❌ Adapter exception for ${invoice.id}:`, err);
      return invoice.toObject();
    }
  }

  /**
   * Ký hoá đơn bằng HSM qua BKAV.
   */
  async signInvoiceWithHSM(id) {
    const invoice = await Invoice.findOne({ id, isDeleted: { $ne: true } });
    if (!invoice) throw createHttpError(404, 'Không tìm thấy hoá đơn');
    if (!invoice.providerInvoiceGUID) {
      throw createHttpError(400, 'Hoá đơn chưa có InvoiceGUID từ BKAV');
    }

    const provider = await InvoiceProvider.findOne({
      id: invoice.providerId,
    }).lean();
    if (!provider) throw createHttpError(400, 'Nhà cung cấp không tồn tại');
    if (!provider.bkav?.autoSign) {
      throw createHttpError(
        400,
        'Cấu hình nhà cung cấp không bật tính năng ký HSM tự động (đang dùng USB Token). Vui lòng cắm USB Token để ký trên cổng BKAV eHóaĐơn và bấm Đồng bộ.',
      );
    }

    const adapter = AdapterFactory.create(provider);
    if (typeof adapter.signWithHSM !== 'function') {
      throw createHttpError(400, 'Nhà cung cấp không hỗ trợ ký HSM');
    }

    const result = await adapter.signWithHSM(invoice);
    if (result.success) {
      invoice.status = INVOICE_STATUSES.ISSUED;
      invoice.issuedAt = new Date();
      invoice.invoiceNo = result.invoiceNo || invoice.invoiceNo;
      invoice.lookupCode = result.lookupCode || invoice.lookupCode;
      invoice.providerResponse = result.rawResponse;
      invoice.providerErrorCode = null;
      invoice.providerErrorMessage = null;
      this._appendCallLog(invoice, {
        action: 'sign_hsm',
        cmdType: BKAV_CMD_TYPES.SIGN_HSM_205,
        success: true,
      });
      await invoice.save();
    } else {
      invoice.providerErrorMessage = result.error || 'Lỗi ký HSM';
      invoice.providerResponse = result.rawResponse;
      this._appendCallLog(invoice, {
        action: 'sign_hsm',
        cmdType: BKAV_CMD_TYPES.SIGN_HSM_205,
        success: false,
        errorMessage: invoice.providerErrorMessage,
      });
      await invoice.save();
      throw createHttpError(400, invoice.providerErrorMessage);
    }

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
    if (!provider.bkav?.autoSign) {
      throw createHttpError(
        400,
        'Cấu hình nhà cung cấp không bật tính năng ký HSM tự động (đang dùng USB Token). Vui lòng cắm USB Token để ký trên cổng BKAV eHóaĐơn và bấm Đồng bộ.',
      );
    }

    const adapter = AdapterFactory.create(provider);
    if (typeof adapter.signBatchWithHSM !== 'function') {
      throw createHttpError(400, 'Nhà cung cấp không hỗ trợ ký HSM');
    }

    const result = await adapter.signBatchWithHSM(guids);
    if (result && result.success !== false) {
      await Invoice.updateMany(
        {
          id: {
            $in: invoices.filter((i) => i.providerInvoiceGUID).map((i) => i.id),
          },
          status: INVOICE_STATUSES.PENDING_SIGN,
        },
        {
          $set: {
            status: INVOICE_STATUSES.ISSUED,
            issuedAt: new Date(),
            providerErrorMessage: null,
          },
        },
      );
    }
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
    const invoice = await Invoice.findOne({ id, isDeleted: { $ne: true } });
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

    this._appendCallLog(invoice, {
      action: 'explain_cqt',
      cmdType: BKAV_CMD_TYPES.EXPLAIN_300,
      success: !!result.success,
      errorMessage: result.error || null,
    });
    await invoice.save();

    if (!result.success) {
      throw createHttpError(400, result.error || 'Lỗi giải trình CQT từ BKAV');
    }

    return {
      invoiceId: id,
      ...result,
    };
  }

  /**
   * Giải trình với CQT — HĐ bị thay thế / bị điều chỉnh.
   */
  async explainReplacedToCQT(id, payload) {
    const invoice = await Invoice.findOne({ id, isDeleted: { $ne: true } });
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

    this._appendCallLog(invoice, {
      action: 'explain_cqt',
      cmdType: BKAV_CMD_TYPES.EXPLAIN_304,
      success: !!result.success,
      errorMessage: result.error || null,
    });
    await invoice.save();

    if (!result.success) {
      throw createHttpError(
        400,
        result.error || 'Lỗi giải trình HĐ bị thay thế/điều chỉnh từ BKAV',
      );
    }

    return {
      invoiceId: id,
      ...result,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // External API (Key.vn / ZCode & 3rd-party Integrations)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Tự động chọn nhà cung cấp mặc định đang hoạt động khi 3rd-party không truyền providerId.
   * Hỗ trợ tái sử dụng providerCache (Map lưu Promise — singleflight) trong chế độ batch
   * để tránh N+1 và cache stampede khi nhiều worker chạy song song.
   */
  async resolveDefaultProvider(providerId = null, providerCache = null) {
    const cacheKey = providerId || '__default__';
    if (providerCache && providerCache.has(cacheKey)) {
      return providerCache.get(cacheKey);
    }

    const loadPromise = (async () => {
      if (providerId) {
        const provider = await InvoiceProvider.findOne({
          id: providerId,
        }).lean();
        if (!provider) throw createHttpError(400, 'Nhà cung cấp không tồn tại');
        if (!provider.isActive) {
          throw createHttpError(400, 'Nhà cung cấp đã bị vô hiệu hoá');
        }
        return provider;
      }

      let provider = await InvoiceProvider.findOne({
        isDefault: true,
        isActive: true,
      }).lean();

      if (!provider) {
        provider = await InvoiceProvider.findOne({ isActive: true })
          .sort({ createdAt: 1 })
          .lean();
      }

      if (!provider) {
        throw createHttpError(
          400,
          'Chưa có nhà cung cấp hoá đơn nào đang hoạt động trong hệ thống',
        );
      }
      return provider;
    })();

    if (providerCache) {
      providerCache.set(cacheKey, loadPromise);
      loadPromise.catch(() => {
        if (providerCache.get(cacheKey) === loadPromise) {
          providerCache.delete(cacheKey);
        }
      });
    }

    return loadPromise;
  }

  /**
   * Prefetch toàn bộ InvoiceProduct đang hoạt động được tham chiếu bởi danh sách entries (1 query duy nhất).
   */
  async _prefetchActiveProducts(entries) {
    const idSet = new Set();
    const codeSet = new Set();

    for (const entry of entries) {
      if (!entry || !Array.isArray(entry.items)) continue;
      for (const rawItem of entry.items) {
        if (!rawItem || typeof rawItem !== 'object') continue;
        const pid = String(rawItem.productId || rawItem.id || '').trim();
        const code = String(rawItem.itemCode || rawItem.productCode || '')
          .trim()
          .toUpperCase();
        if (pid) idSet.add(pid);
        else if (code) codeSet.add(code);
      }
    }

    const byId = new Map();
    const byCode = new Map();
    const orConditions = [];
    if (idSet.size > 0) orConditions.push({ id: { $in: Array.from(idSet) } });
    if (codeSet.size > 0) {
      orConditions.push({ code: { $in: Array.from(codeSet) } });
    }

    if (orConditions.length === 0) {
      return { byId, byCode };
    }

    const products = await InvoiceProduct.find({
      isActive: true,
      isDeleted: { $ne: true },
      $or: orConditions,
    }).lean();

    for (const p of products) {
      if (p.id) byId.set(p.id, p);
      if (p.code) byCode.set(String(p.code).toUpperCase(), p);
    }

    return { byId, byCode };
  }

  /**
   * Chuẩn hoá response trả ra cho bên thứ 3 (không để lộ raw credential/nội bộ).
   */
  _formatExternalInvoiceSummary(inv) {
    if (!inv) return null;
    return {
      id: inv.id,
      status: inv.status,
      providerId: inv.providerId,
      providerType: inv.providerType,
      invoiceForm: inv.invoiceForm || null,
      invoiceSerial: inv.invoiceSerial || null,
      invoiceNo: inv.invoiceNo || 0,
      invoiceDate: inv.invoiceDate || null,
      lookupCode: inv.lookupCode || null,
      lookupUrl: this._buildPublicLookupUrl(inv),
      maCuaCQT: inv.maCuaCQT || '',
      billCode: inv.billCode || '',
      sourceModule: inv.sourceModule || null,
      sourceId: inv.sourceId || null,
      buyer: inv.buyer || {},
      paymentMethod: inv.paymentMethod,
      currency: inv.currency,
      totalAmountBeforeTax: inv.totalAmountBeforeTax || 0,
      totalDiscountAmount: inv.totalDiscountAmount || 0,
      totalTaxAmount: inv.totalTaxAmount || 0,
      totalAmount: inv.totalAmount || 0,
      items: (inv.items || []).map((it) => ({
        productId: it.productId || null,
        itemCode: it.itemCode || '',
        itemName: it.itemName,
        unitName: it.unitName || '',
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        amount: it.amount,
        taxRate: it.taxRate,
        taxRateId: it.taxRateId,
        taxAmount: it.taxAmount,
        discountRate: it.discountRate || 0,
        discountAmount: it.discountAmount || 0,
        isDiscount: !!it.isDiscount,
        itemTypeId: it.itemTypeId || 0,
      })),
      providerErrorMessage: inv.providerErrorMessage || null,
      issuedAt: inv.issuedAt || null,
      createdAt: inv.createdAt || null,
      updatedAt: inv.updatedAt || null,
    };
  }

  /**
   * Tạo 1 hoá đơn đơn lẻ từ payload external (đã validate).
   * - Luôn ép sourceModule theo đối tác đã xác thực (chống giả mạo sourceModule).
   * - Tuần tự hoá in-flight theo (sourceModule, sourceId/billCode) chống race condition xuất trùng.
   */
  async _createSingleExternalInvoice(validatedEntry, context = {}) {
    const caller = context.caller || INVOICE_SOURCE_MODULES.EXTERNAL_API;
    const createdBy = context.createdBy || `external:${caller}`;

    // Bảo mật: luôn dùng sourceModule của đối tác đã xác thực qua API Key, không tin client body
    const sourceModule = caller;
    const sourceId =
      validatedEntry.sourceId ||
      validatedEntry.externalRef ||
      validatedEntry.billCode ||
      null;
    const billCode = validatedEntry.billCode || sourceId || '';

    const runCore = async () => {
      // Chống tạo trùng theo (sourceModule + sourceId/billCode) khi bên thứ 3 retry
      if (sourceId || billCode) {
        const refOr = [];
        if (sourceId) refOr.push({ sourceId });
        if (billCode) refOr.push({ billCode });
        const existing = await Invoice.findOne({
          sourceModule,
          isDeleted: { $ne: true },
          status: {
            $nin: [INVOICE_STATUSES.CANCELLED, INVOICE_STATUSES.REPLACED],
          },
          $or: refOr,
        }).lean();

        if (existing) {
          return {
            duplicate: true,
            invoice: this._formatExternalInvoiceSummary(existing),
          };
        }
      }

      const provider = await this.resolveDefaultProvider(
        validatedEntry.providerId,
        context.providerCache || null,
      );

      const resolvedItems = await this._resolveItems(validatedEntry.items, {
        strictSkuLookup: true,
        productCache: context.productCache || null,
      });
      const totals = this._calculateTotals(resolvedItems);
      const id = await generateMonotonicId(ID_PREFIXES.INVOICE);

      const buyer = { ...(validatedEntry.buyer || {}) };
      if (!buyer.name && !buyer.unitName) {
        buyer.name = 'Khách lẻ';
      }

      const invoiceDoc = {
        id,
        providerId: provider.id,
        providerType: provider.providerType,
        invoiceForm: validatedEntry.invoiceForm || provider.invoiceForm,
        invoiceSerial: validatedEntry.invoiceSerial || provider.invoiceSerial,
        invoiceNo: 0,
        invoiceDate: validatedEntry.invoiceDate || new Date(),
        buyer,
        paymentMethod: validatedEntry.paymentMethod,
        currency: validatedEntry.currency,
        exchangeRate: validatedEntry.exchangeRate,
        note: validatedEntry.note,
        billCode,
        userDefine: validatedEntry.userDefine,
        sourceModule,
        sourceId,
        items: resolvedItems,
        ...totals,
        status: validatedEntry.isDraft
          ? INVOICE_STATUSES.DRAFT
          : INVOICE_STATUSES.PENDING,
        relatedInvoiceId: null,
        relationType: null,
        createdBy,
      };

      const invoice = await Invoice.create(invoiceDoc);

      if (!validatedEntry.isDraft) {
        const issued = await this._issueViaProvider(invoice, provider);
        return {
          duplicate: false,
          invoice: this._formatExternalInvoiceSummary(issued),
        };
      }

      return {
        duplicate: false,
        invoice: this._formatExternalInvoiceSummary(invoice.toObject()),
      };
    };

    const lockRef = sourceId || billCode;
    if (!lockRef) {
      return runCore();
    }

    const lockKey = `${sourceModule}:${lockRef}`;
    // Nếu đang có request đồng thời với cùng (sourceModule, sourceId/billCode), chờ request trước hoàn tất rồi kiểm tra lại DB
    while (this._inFlightExternalKeys.has(lockKey)) {
      await this._inFlightExternalKeys.get(lockKey).catch(() => {});
    }

    const taskPromise = runCore();
    this._inFlightExternalKeys.set(lockKey, taskPromise);
    try {
      return await taskPromise;
    } finally {
      if (this._inFlightExternalKeys.get(lockKey) === taskPromise) {
        this._inFlightExternalKeys.delete(lockKey);
      }
    }
  }

  /**
   * Tạo hoá đơn từ hệ thống bên thứ 3 (Key.vn / ZCode / đối tác khác).
   * - Gửi 1 object → xuất 1 hoá đơn
   * - Gửi array `[...]` hoặc `{ invoices: [...] }` → mỗi phần tử xuất 1 hoá đơn riêng biệt (tối đa 30 HĐ/request)
   */
  async createExternalInvoices(rawPayload, context = {}) {
    let isBatch = false;
    let entries = [];

    if (Array.isArray(rawPayload)) {
      isBatch = true;
      entries = rawPayload;
    } else if (rawPayload && Array.isArray(rawPayload.invoices)) {
      isBatch = true;
      entries = rawPayload.invoices;
    } else if (rawPayload && typeof rawPayload === 'object') {
      isBatch = false;
      entries = [rawPayload];
    } else {
      throw createHttpError(
        400,
        'Payload phải là object hoá đơn hoặc mảng các hoá đơn',
      );
    }

    if (entries.length === 0) {
      throw createHttpError(400, 'Danh sách hoá đơn không được để trống');
    }
    if (entries.length > BKAV_MAX_INVOICES_PER_REQUEST) {
      throw createHttpError(
        400,
        `Chỉ được gửi tối đa ${BKAV_MAX_INVOICES_PER_REQUEST} hoá đơn mỗi request`,
      );
    }

    // Single invoice mode: validate & throw directly on error
    if (!isBatch) {
      const { error, value } = externalCreateInvoiceSchema.validate(
        entries[0],
        {
          abortEarly: false,
        },
      );
      if (error) {
        throw createHttpError(
          400,
          error.details.map((d) => d.message).join('; '),
        );
      }
      const res = await this._createSingleExternalInvoice(value, context);
      return {
        isBatch: false,
        duplicate: res.duplicate,
        invoice: res.invoice,
      };
    }

    // Batch mode:
    // 1. Prefetch toàn bộ Product & chia sẻ Provider cache → loại bỏ N+1 DB queries
    // 2. Xử lý song song có giới hạn (bounded concurrency = 4) → giảm latency 30 HĐ từ ~50s xuống ~12s
    const providerCache = new Map();
    const productCache = await this._prefetchActiveProducts(entries);
    const batchContext = {
      ...context,
      providerCache,
      productCache,
    };

    const results = new Array(entries.length);
    const BATCH_CONCURRENCY = Math.min(4, entries.length);
    let cursor = 0;

    const processOne = async (index) => {
      const rawEntry = entries[index];
      const refBillCode =
        rawEntry?.billCode ||
        rawEntry?.sourceId ||
        rawEntry?.externalRef ||
        null;
      const refSourceId =
        rawEntry?.sourceId ||
        rawEntry?.externalRef ||
        rawEntry?.billCode ||
        null;

      try {
        const { error, value } = externalCreateInvoiceSchema.validate(
          rawEntry,
          { abortEarly: false },
        );
        if (error) {
          results[index] = {
            index,
            billCode: refBillCode,
            sourceId: refSourceId,
            success: false,
            duplicate: false,
            invoice: null,
            error: error.details.map((d) => d.message).join('; '),
          };
          return;
        }

        const res = await this._createSingleExternalInvoice(
          value,
          batchContext,
        );
        const failedAtProvider =
          !res.duplicate && res.invoice?.status === INVOICE_STATUSES.ERROR;

        results[index] = {
          index,
          billCode: res.invoice?.billCode || refBillCode,
          sourceId: res.invoice?.sourceId || refSourceId,
          success: !failedAtProvider,
          duplicate: res.duplicate,
          invoice: res.invoice,
          error: failedAtProvider
            ? res.invoice.providerErrorMessage ||
              'Lỗi phát hành từ nhà cung cấp'
            : null,
        };
      } catch (err) {
        results[index] = {
          index,
          billCode: refBillCode,
          sourceId: refSourceId,
          success: false,
          duplicate: false,
          invoice: null,
          error: err.message || 'Lỗi tạo hoá đơn',
        };
      }
    };

    const workers = Array.from({ length: BATCH_CONCURRENCY }, async () => {
      while (cursor < entries.length) {
        const current = cursor;
        cursor += 1;
        await processOne(current);
      }
    });
    await Promise.all(workers);

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;
    const duplicateCount = results.filter((r) => r.duplicate).length;

    return {
      isBatch: true,
      total: entries.length,
      successCount,
      failCount,
      duplicateCount,
      results,
    };
  }

  /**
   * Tra cứu hoá đơn cho bên thứ 3 theo CRM id, sourceId, hoặc billCode.
   * Bắt buộc lọc theo sourceModule của đối tác gọi sang để chống truy cập chéo (IDOR).
   */
  async getExternalInvoiceByRef(refId, caller = null) {
    const trimmed = String(refId || '').trim();
    if (!trimmed) throw createHttpError(400, 'Mã tra cứu hoá đơn là bắt buộc');

    const query = {
      isDeleted: { $ne: true },
      $or: [{ id: trimmed }, { sourceId: trimmed }, { billCode: trimmed }],
    };
    if (caller) {
      query.sourceModule = caller;
    }

    const invoice = await Invoice.findOne(query).sort({ createdAt: -1 }).lean();

    if (!invoice) {
      throw createHttpError(404, `Không tìm thấy hoá đơn "${trimmed}"`);
    }

    return this._formatExternalInvoiceSummary(invoice);
  }

  /**
   * Lấy danh mục sản phẩm (SKU) đang kích hoạt cho bên thứ 3.
   */
  async getExternalProducts() {
    const products = await InvoiceProduct.find({
      isActive: true,
      isDeleted: { $ne: true },
    })
      .sort({ code: 1 })
      .lean();

    return products.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      unitName: p.unitName,
      unitPrice: p.unitPrice,
      taxRate: p.taxRate,
      taxRateId: p.taxRateId,
      itemTypeId: p.itemTypeId,
      description: p.description || '',
      userDefineDetails: p.userDefineDetails || '',
    }));
  }

  /**
   * Trả về template chuẩn + bảng quy ước enum cho dev bên thứ 3 tự khám phá & tích hợp.
   */
  async getExternalInvoiceTemplate() {
    const products = await this.getExternalProducts();
    const sampleSku = products[0]?.code || 'ZB5000';

    return {
      version: '2.0',
      maxInvoicesPerRequest: BKAV_MAX_INVOICES_PER_REQUEST,
      auth: {
        header: 'X-API-Key (bắt buộc — riêng cho từng đối tác)',
        partnerHeader:
          'X-Partner-Id (khuyến nghị — định danh đối tác để cô lập key & IP allowlist)',
        idempotencyHeader:
          'X-Idempotency-Key (tùy chọn, TTL 24h, cô lập namespace theo từng đối tác)',
        perItemDeduplication:
          'Truyền sourceId hoặc billCode để tự động chống trùng lặp hoá đơn khi retry',
      },
      itemResolutionRules: {
        branch1_byProduct:
          'Truyền productId/id hoặc itemCode/productCode → CRM tra cứu sản phẩm đang kích hoạt trong DB và dùng 100% thông tin cấu hình sẵn của sản phẩm đó kết hợp với quantity (> 0).',
        branch2_customTemplate:
          'Không truyền productId/itemCode → bắt buộc truyền đầy đủ các trường hợp lệ theo itemType: goods (itemName, unitName, quantity > 0, unitPrice >= 0, taxRate), vehicle (như goods + userDefineDetails), promotion (itemName, unitName, quantity > 0), discount (itemName + amount > 0), note (itemName).',
      },
      buyerRules: {
        company:
          'type="company": Nên truyền đủ taxCode (MST 10/14 số hoặc CCCD 12 số với hộ KD), unitName (Tên đơn vị) và address (Địa chỉ trụ sở). Trường name (Người mua hàng), email, phone, code, bankAccount là tuỳ chọn.',
        personal:
          'type="personal": Truyền name (Họ và tên; nếu bỏ trống CRM tự điền "Khách lẻ"). KHÔNG cần truyền unitName (CRM luôn gửi BuyerUnitName="" sang BKAV). Tuỳ chọn truyền cccd (12 chữ số), taxCode (MST cá nhân), address, email, phone.',
        fields: [
          { field: 'type', type: 'string', default: 'company', description: '"company" | "personal"' },
          { field: 'unitName', type: 'string', default: '', description: 'Tên đơn vị / doanh nghiệp (chỉ dùng cho company; personal tự để trống)' },
          { field: 'taxCode', type: 'string', default: '', description: 'Mã số thuế 10/14 số (hoặc CCCD 12 số với hộ KD)' },
          { field: 'cccd', type: 'string', default: '', description: 'Số CCCD / định danh cá nhân 12 số (map sang trường CCCD trên BKAV)' },
          { field: 'name', type: 'string', default: '', description: 'Họ và tên người mua (mặc định "Khách lẻ" nếu cả name & unitName đều trống)' },
          { field: 'address', type: 'string', default: '', description: 'Địa chỉ trụ sở / địa chỉ liên hệ' },
          { field: 'email', type: 'string', default: '', description: 'Email nhận hoá đơn điện tử (đúng định dạng email nếu truyền)' },
          { field: 'phone', type: 'string', default: '', description: 'Số điện thoại người mua' },
          { field: 'code', type: 'string', default: '', description: 'Mã khách hàng đối tác (BuyerCode)' },
          { field: 'bankAccount', type: 'string', default: '', description: 'Số tài khoản ngân hàng người mua' },
        ],
      },
      enums: {
        itemType: [
          {
            alias: 'goods',
            itemTypeId: 0,
            description: 'Hàng hoá / dịch vụ thông thường (mặc định)',
          },
          {
            alias: 'note',
            itemTypeId: 4,
            description: 'Dòng ghi chú (SL=0, đơn giá=0, không tính tiền/thuế)',
          },
          {
            alias: 'promotion',
            itemTypeId: 15,
            description: 'Hàng khuyến mãi (đơn giá=0, thành tiền=0, thuế=0)',
          },
          {
            alias: 'vehicle',
            itemTypeId: 21,
            description:
              'Xe ô tô / mô tô (truyền userDefineDetails chứa SKhung, SMay)',
          },
          {
            alias: 'discount',
            itemTypeId: 30,
            description: 'Chiết khấu thương mại (giảm trừ trước thuế, thuế=0)',
          },
        ],
        taxRates: [
          {
            taxRate: 10,
            taxRateId: BKAV_TAX_RATE_IDS.TAX_10,
            label: 'VAT 10% (mặc định)',
          },
          { taxRate: 8, taxRateId: BKAV_TAX_RATE_IDS.TAX_8, label: 'VAT 8%' },
          { taxRate: 5, taxRateId: BKAV_TAX_RATE_IDS.TAX_5, label: 'VAT 5%' },
          { taxRate: 0, taxRateId: BKAV_TAX_RATE_IDS.TAX_0, label: 'VAT 0%' },
          {
            taxRate: -1,
            taxRateId: BKAV_TAX_RATE_IDS.TAX_KCT,
            label: 'Không chịu thuế (KCT)',
          },
          {
            taxRate: -2,
            taxRateId: BKAV_TAX_RATE_IDS.TAX_KKK,
            label: 'Không kê khai nộp thuế (KKK)',
          },
          {
            taxRate: -4,
            taxRateId: BKAV_TAX_RATE_IDS.TAX_OTHER,
            label: 'Thuế suất khác',
          },
        ],
        paymentMethods: [
          { value: 'TM', label: 'Tiền mặt' },
          { value: 'CK', label: 'Chuyển khoản' },
          { value: 'TM/CK', label: 'Tiền mặt / Chuyển khoản (mặc định)' },
        ],
        buyerTypes: [
          { value: 'company', label: 'Doanh nghiệp (có MST)' },
          { value: 'personal', label: 'Cá nhân / khách lẻ' },
        ],
      },
      activeProductsCount: products.length,
      activeProductsPreview: products.slice(0, 10),
      examples: {
        singleBySku: {
          sourceId: 'KEYVN-ORD-20261120-001',
          billCode: 'KEYVN-ORD-20261120-001',
          isDraft: false,
          paymentMethod: 'CK',
          buyer: {
            type: 'company',
            name: 'Nguyễn Văn A',
            unitName: 'CÔNG TY TNHH ABC',
            taxCode: '0101234567',
            address: '123 Cầu Giấy, Hà Nội',
            email: 'ketoan@abc.vn',
            phone: '0901234567',
          },
          items: [
            {
              itemCode: sampleSku,
              quantity: 2,
            },
          ],
        },
        singleCustomTemplate: {
          sourceId: 'PARTNER-ORD-20261120-002',
          isDraft: false,
          paymentMethod: 'TM/CK',
          note: 'Đơn hàng thanh toán chuyển khoản',
          buyer: {
            type: 'personal',
            name: 'Trần Thị B',
            email: 'tranthib@gmail.com',
            phone: '0988888888',
          },
          items: [
            {
              itemType: 'goods',
              itemName: 'Gói dịch vụ ZCode Pro 12 tháng',
              unitName: 'Gói',
              quantity: 1,
              unitPrice: 1000000,
              taxRate: 10,
            },
            {
              itemType: 'promotion',
              itemName: 'Tặng kèm 1 tháng sử dụng',
              unitName: 'Tháng',
              quantity: 1,
            },
            {
              itemType: 'discount',
              itemName: 'Chiết khấu ưu đãi 10%',
              amount: 100000,
            },
            {
              itemType: 'note',
              itemName: 'Mã đơn hàng đối tác: PARTNER-ORD-20261120-002',
            },
          ],
        },
        batchArray: [
          {
            sourceId: 'KEYVN-ORD-001',
            buyer: {
              type: 'personal',
              name: 'Khách hàng 1',
              email: 'kh1@example.com',
            },
            items: [{ itemCode: sampleSku, quantity: 1 }],
          },
          {
            sourceId: 'KEYVN-ORD-002',
            buyer: {
              type: 'company',
              name: 'Khách hàng 2',
              unitName: 'CÔNG TY XYZ',
              taxCode: '0309999999',
              address: 'TP.HCM',
              email: 'kh2@xyz.vn',
            },
            items: [
              {
                itemType: 'goods',
                itemName: 'Dịch vụ tuỳ chỉnh',
                unitName: 'Lần',
                quantity: 1,
                unitPrice: 500000,
                taxRate: 8,
              },
            ],
          },
        ],
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private helpers
  // ═══════════════════════════════════════════════════════════════════════════

  async _resolveItems(items, options = {}) {
    if (!Array.isArray(items)) return [];
    const { strictSkuLookup = false, productCache = null } = options;

    const productBaseFilter = strictSkuLookup
      ? { isActive: true, isDeleted: { $ne: true } }
      : { isDeleted: { $ne: true } };

    // Nếu không có cache từ batch và hoá đơn có > 1 mã sản phẩm cần tra cứu → prefetch 1 query $in tránh N+1
    let localCache = productCache;
    if (!localCache) {
      const idSet = new Set();
      const codeSet = new Set();
      for (const rawItem of items) {
        const pid = String(rawItem?.productId || rawItem?.id || '').trim();
        const code = String(rawItem?.itemCode || rawItem?.productCode || '')
          .trim()
          .toUpperCase();
        if (pid) idSet.add(pid);
        else if (code) codeSet.add(code);
      }
      if (idSet.size + codeSet.size > 1) {
        const orConds = [];
        if (idSet.size > 0) orConds.push({ id: { $in: Array.from(idSet) } });
        if (codeSet.size > 0) {
          orConds.push({ code: { $in: Array.from(codeSet) } });
        }
        const docs = await InvoiceProduct.find({
          ...productBaseFilter,
          $or: orConds,
        }).lean();
        const byId = new Map();
        const byCode = new Map();
        for (const p of docs) {
          if (p.id) byId.set(p.id, p);
          if (p.code) byCode.set(String(p.code).toUpperCase(), p);
        }
        localCache = { byId, byCode };
      }
    }

    const resolved = [];
    for (const rawItem of items) {
      const item = { ...rawItem };
      const lookupProductId = (item.productId || item.id || '').trim();
      const lookupCode = (item.itemCode || item.productCode || '')
        .trim()
        .toUpperCase();
      delete item.id;
      delete item.productCode;

      // Hỗ trợ alias itemType ('goods' | 'note' | 'promotion' | 'vehicle' | 'discount')
      if (
        (item.itemTypeId === undefined || item.itemTypeId === null) &&
        typeof item.itemType === 'string'
      ) {
        const mappedTypeId =
          INVOICE_ITEM_TYPE_ALIASES[item.itemType.trim().toLowerCase()];
        if (mappedTypeId !== undefined) {
          item.itemTypeId = mappedTypeId;
        }
      }
      delete item.itemType;

      // Nếu userDefineDetails truyền object/array (vd: xe cơ giới), tự động serialize JSON
      if (
        item.userDefineDetails !== undefined &&
        item.userDefineDetails !== null &&
        typeof item.userDefineDetails === 'object'
      ) {
        item.userDefineDetails = JSON.stringify(item.userDefineDetails);
      }

      let product = null;
      if (lookupProductId) {
        product = localCache
          ? localCache.byId.get(lookupProductId) || null
          : await InvoiceProduct.findOne({
              id: lookupProductId,
              ...productBaseFilter,
            }).lean();
      } else if (lookupCode) {
        product = localCache
          ? localCache.byCode.get(lookupCode) || null
          : await InvoiceProduct.findOne({
              code: lookupCode,
              ...productBaseFilter,
            }).lean();
      }

      // Khi gọi qua External API (strictSkuLookup=true):
      // 1) Nếu có gửi ID/Mã liên quan đến Product → bắt buộc Product phải tồn tại & đang active,
      //    và dùng hoàn toàn thông tin cấu hình sẵn của Product đó.
      // 2) Nếu không gửi ID/Mã Product → dùng toàn bộ các field hợp lệ đã được validate để điền vào item.
      if (strictSkuLookup && (lookupProductId || lookupCode)) {
        if (!product) {
          if (lookupProductId) {
            throw createHttpError(
              400,
              `Không tìm thấy sản phẩm đang hoạt động với productId "${lookupProductId}"`,
            );
          }
          throw createHttpError(
            400,
            `Không tìm thấy sản phẩm đang hoạt động với mã SKU "${lookupCode}"`,
          );
        }

        // Gán trực tiếp thông tin của Product có sẵn trong DB
        item.productId = product.id;
        item.itemCode = product.code;
        item.itemName = product.name;
        item.unitName = product.unitName || '';
        item.unitPrice =
          product.unitPrice !== undefined ? Number(product.unitPrice) : 0;
        item.taxRate =
          product.taxRate !== undefined ? Number(product.taxRate) : 10;
        item.taxRateId =
          product.taxRateId ||
          BKAV_TAX_RATE_TO_ID[item.taxRate] ||
          BKAV_TAX_RATE_IDS.TAX_OTHER;
        item.itemTypeId =
          product.itemTypeId !== undefined && product.itemTypeId !== null
            ? Number(product.itemTypeId)
            : 0;
        item.userDefineDetails =
          item.userDefineDetails || product.userDefineDetails || '';
      } else if (product) {
        // Luồng nội bộ CRM (cho phép override linh hoạt trên UI form)
        if (!item.productId) item.productId = product.id;
        if (!item.itemName) item.itemName = product.name;
        if (!item.itemCode) item.itemCode = product.code;
        if (!item.unitName && product.unitName)
          item.unitName = product.unitName;
        if (
          (item.unitPrice === undefined ||
            item.unitPrice === null ||
            item.unitPrice === 0) &&
          product.unitPrice !== undefined
        ) {
          item.unitPrice = product.unitPrice;
        }
        if (item.taxRate === undefined || item.taxRate === null) {
          item.taxRate = product.taxRate;
        }
        if (!item.taxRateId && item.taxRate === product.taxRate) {
          item.taxRateId = product.taxRateId;
        }
        if (item.itemTypeId === undefined || item.itemTypeId === null) {
          item.itemTypeId = product.itemTypeId || 0;
        }
        if (!item.userDefineDetails && product.userDefineDetails) {
          item.userDefineDetails = product.userDefineDetails;
        }
      } else {
        item.productId = null;
        item.itemCode = item.itemCode || '';
        item.unitName = item.unitName || '';
        item.userDefineDetails = item.userDefineDetails || '';
      }

      // Chuẩn hoá mặc định cho itemTypeId, taxRate, taxRateId
      if (item.itemTypeId === undefined || item.itemTypeId === null) {
        item.itemTypeId = 0;
      }
      if (item.taxRate === undefined || item.taxRate === null) {
        item.taxRate = 10;
      } else {
        item.taxRate = Number(item.taxRate);
      }
      if (!item.taxRateId) {
        item.taxRateId =
          BKAV_TAX_RATE_TO_ID[item.taxRate] || BKAV_TAX_RATE_IDS.TAX_OTHER;
      }

      // Đảm bảo số lượng và đơn giá là số hợp lệ
      item.quantity =
        item.quantity !== undefined && item.quantity !== null
          ? Number(item.quantity)
          : 1;
      item.unitPrice =
        item.unitPrice !== undefined && item.unitPrice !== null
          ? Number(item.unitPrice)
          : 0;

      // Xử lý theo từng loại dòng
      const isDiscount = item.isDiscount || item.itemTypeId === 30;
      if (item.itemTypeId === 4) {
        // Ghi chú: không tính tiền, không tính thuế
        item.amount = 0;
        item.taxAmount = 0;
        item.quantity = 0;
        item.unitPrice = 0;
        item.taxRate = 0;
        item.taxRateId = 1;
      } else if (item.itemTypeId === 15) {
        // Hàng khuyến mại: đơn giá = 0, thành tiền = 0, thuế = 0
        item.unitPrice = 0;
        item.amount = 0;
        item.discountRate = 0;
        item.discountAmount = 0;
        item.taxRate = 0;
        item.taxRateId = 1;
        item.taxAmount = 0;
      } else if (isDiscount) {
        // Dòng chiết khấu: không tính thuế, chỉ giảm trừ tiền hàng trước thuế
        if (
          item.amount === undefined ||
          item.amount === null ||
          item.amount === 0
        ) {
          item.amount = Math.round(item.quantity * item.unitPrice * 100) / 100;
        }
        item.taxRate = 0;
        item.taxRateId = 1;
        item.taxAmount = 0;
        item.isDiscount = true;
      } else {
        // Dòng hàng hoá / dịch vụ bình thường
        if (
          item.amount === undefined ||
          item.amount === null ||
          item.amount === 0
        ) {
          item.amount = Math.round(item.quantity * item.unitPrice * 100) / 100;
        }
        // Tính chiết khấu theo dòng nếu có discountRate mà chưa có discountAmount
        if (
          item.discountRate > 0 &&
          (item.discountAmount === undefined || item.discountAmount === null)
        ) {
          item.discountAmount =
            Math.round(item.amount * item.discountRate) / 100;
        }
        const taxableBase = Math.max(
          0,
          item.amount - (item.discountAmount || 0),
        );
        // Tính taxAmount nếu chưa có
        if (item.taxAmount === undefined || item.taxAmount === null) {
          item.taxAmount =
            item.taxRate > 0
              ? Math.round((taxableBase * item.taxRate) / 100)
              : 0;
        }
      }

      if (!item.itemName) {
        throw createHttpError(400, 'Tên hàng hoá / dịch vụ là bắt buộc');
      }

      resolved.push(item);
    }

    return resolved;
  }

  _calculateTotals(items) {
    let grossGoodsAmount = 0;
    let itemLevelDiscount = 0;
    let discountRowsAmount = 0;
    let goodsTax = 0;

    for (const item of items) {
      const isDiscount = item.isDiscount || item.itemTypeId === 30;
      if (isDiscount) {
        discountRowsAmount += Math.abs(item.amount || 0);
      } else if (item.itemTypeId !== 4) {
        // Bỏ qua dòng ghi chú
        grossGoodsAmount += item.amount || 0;
        itemLevelDiscount += item.discountAmount || 0;
        goodsTax += item.taxAmount || 0;
      }
    }

    const totalDiscountAmount =
      Math.round((itemLevelDiscount + discountRowsAmount) * 100) / 100;
    const totalAmountBeforeTax = Math.max(
      0,
      Math.round((grossGoodsAmount - totalDiscountAmount) * 100) / 100,
    );
    const totalTaxAmount = Math.round(goodsTax * 100) / 100;
    const totalAmount =
      Math.round((totalAmountBeforeTax + totalTaxAmount) * 100) / 100;

    return {
      totalAmountBeforeTax,
      totalTaxAmount,
      totalDiscountAmount,
      totalAmount,
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

  /**
   * Thêm 1 bản ghi vào providerCallLogs của invoice.
   * Giới hạn tối đa 50 bản ghi (xóa cũ nhất nếu vượt).
   * Không save() — caller tự gọi save() sau.
   */
  _appendCallLog(
    invoice,
    { action, cmdType = null, success, errorCode = null, errorMessage = null },
  ) {
    if (!Array.isArray(invoice.providerCallLogs)) {
      invoice.providerCallLogs = [];
    }
    invoice.providerCallLogs.push({
      calledAt: new Date(),
      action,
      cmdType,
      success,
      errorCode,
      errorMessage,
    });
    // Giữ tối đa 50 entries
    if (invoice.providerCallLogs.length > 50) {
      invoice.providerCallLogs = invoice.providerCallLogs.slice(-50);
    }
  }
}

module.exports = new InvoiceService();
