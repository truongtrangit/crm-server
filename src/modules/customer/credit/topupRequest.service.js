const mongoose = require('mongoose');
const TopupRequest = require('./topupRequest.model');
const Customer = require('../customer/customer.model');
const CreditTransaction = require('./creditTransaction.model');
const BotvnConfig = require('../../course/courseConfig/botvnConfig.model');
const { generateMonotonicId, ID_PREFIXES } = require('../../../core/utils/id');
const { buildPaginatedResponse } = require('../../../core/utils/pagination');
const { createHttpError } = require('../../../core/utils/http');
const { escapeRegex } = require('../../../core/utils/query');
const { getVietnamTime, getStartOfDayVN, getEndOfDayVN } = require('../../../core/utils/date');
const {
  TOPUP_REQUEST_STATUS,
  CREDIT_TYPES,
  CREDIT_TRANSACTION_TYPES,
  CREDIT_SOURCES,
  CREDIT_TRANSACTION_STATUS,
} = require('../../../core/constants/appData');
const {
  SYSTEM_SOURCES,
  SYSTEM_EVENT_TYPES,
} = require('../../../core/constants/integrationConfig');

class TopupRequestService {
  // ─── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Get bank transfer config from BotvnConfig
   * @returns {object} bankTransfer config
   */
  async _getBankTransferConfig() {
    const config = await BotvnConfig.findOne().lean();
    if (!config || !config.bankTransfer) {
      return null;
    }
    return config.bankTransfer;
  }

  /**
   * Generate transfer content from template
   */
  _generateTransferContent(template, { requestId, customerId, amount }) {
    return template
      .replace(/\{requestId\}/g, requestId)
      .replace(/\{customerId\}/g, customerId)
      .replace(/\{amount\}/g, String(amount));
  }

  /**
   * Build VietQR URL (public, no API key needed)
   * @see https://www.vietqr.io/en/api-document
   */
  _buildVietQRUrl({ bankCode, accountNumber, amount, transferContent, accountHolder }) {
    const params = new URLSearchParams();
    if (amount) params.set('amount', String(amount));
    if (transferContent) params.set('addInfo', transferContent);
    if (accountHolder) params.set('accountName', accountHolder);

    return `https://img.vietqr.io/image/${bankCode}-${accountNumber}-compact.png?${params.toString()}`;
  }

  // ─── External (BotVN) ──────────────────────────────────────────────────────

  /**
   * Get topup config for display on BotVN
   */
  async getTopupConfig() {
    const bankTransfer = await this._getBankTransferConfig();
    if (!bankTransfer || !bankTransfer.isEnabled) {
      return { isEnabled: false };
    }

    return {
      isEnabled: true,
      bankName: bankTransfer.bankName,
      bankCode: bankTransfer.bankCode,
      accountNumber: bankTransfer.accountNumber,
      accountHolder: bankTransfer.accountHolder,
      creditRatio: bankTransfer.creditRatio || 1,
      quickAmounts: bankTransfer.quickAmounts || [],
      notes: bankTransfer.notes || [],
    };
  }

  /**
   * Create a new topup request
   * @param {string} customerId
   * @param {object} data - { amount, requestInvoice, invoiceInfo }
   */
  async createTopupRequest(customerId, data) {
    const { amount, expectedCredit, requestInvoice, invoiceInfo } = data;

    // Validate bank transfer is enabled
    const bankTransfer = await this._getBankTransferConfig();
    if (!bankTransfer || !bankTransfer.isEnabled) {
      throw createHttpError(400, 'Tính năng nạp tiền qua chuyển khoản chưa được bật');
    }

    // Validate required bank info
    if (!bankTransfer.accountNumber || !bankTransfer.bankCode) {
      throw createHttpError(500, 'Cấu hình ngân hàng chưa đầy đủ');
    }

    // Check customer exists
    const customer = await Customer.findOne({ id: customerId });
    if (!customer) {
      throw createHttpError(404, 'Không tìm thấy khách hàng');
    }

    // Calculate credit amount
    const creditRatio = bankTransfer.creditRatio || 1;
    const creditAmount = Math.floor(amount * creditRatio);

    if (creditAmount !== expectedCredit) {
      throw createHttpError(400, 'Tỷ giá đã thay đổi, vui lòng tải lại trang và tạo lại yêu cầu nạp tiền');
    }

    // Generate ID
    const requestId = await generateMonotonicId(ID_PREFIXES.TOPUP_REQUEST);

    // Generate transfer content from template
    const transferContent = this._generateTransferContent(
      bankTransfer.transferContentTemplate || 'BOTVN {requestId}',
      { requestId, customerId, amount },
    );

    // Build VietQR URL
    const qrDataUrl = this._buildVietQRUrl({
      bankCode: bankTransfer.bankCode,
      accountNumber: bankTransfer.accountNumber,
      amount,
      transferContent,
      accountHolder: bankTransfer.accountHolder,
    });

    // Save billing info to customer if provided
    if (requestInvoice && invoiceInfo) {
      await Customer.updateOne(
        { id: customerId },
        { $set: { billingInfo: invoiceInfo } },
      );
    }

    // Create topup request
    const topupRequest = await TopupRequest.create({
      id: requestId,
      customerId,
      amount,
      creditAmount,
      creditType: CREDIT_TYPES.MAIN,
      bankInfo: {
        bankName: bankTransfer.bankName,
        bankCode: bankTransfer.bankCode,
        accountNumber: bankTransfer.accountNumber,
        accountHolder: bankTransfer.accountHolder,
        transferContent,
      },
      qrDataUrl,
      status: TOPUP_REQUEST_STATUS.PENDING,
      requestInvoice: requestInvoice || false,
      invoiceInfo: requestInvoice ? invoiceInfo : undefined,
    });

    return {
      id: topupRequest.id,
      amount: topupRequest.amount,
      creditAmount: topupRequest.creditAmount,
      bankInfo: topupRequest.bankInfo,
      qrDataUrl: topupRequest.qrDataUrl,
      status: topupRequest.status,
      requestInvoice: topupRequest.requestInvoice,
      invoiceInfo: topupRequest.invoiceInfo,
      createdAt: topupRequest.createdAt,
    };
  }

  /**
   * User confirms they have transferred money
   * @param {string} customerId
   * @param {string} requestId
   */
  async confirmTransfer(customerId, requestId) {
    const request = await TopupRequest.findOne({
      id: requestId,
      customerId,
    });

    if (!request) {
      throw createHttpError(404, 'Không tìm thấy yêu cầu nạp tiền');
    }

    if (request.status !== TOPUP_REQUEST_STATUS.PENDING) {
      throw createHttpError(400, 'Yêu cầu này không ở trạng thái chờ xác nhận');
    }

    request.status = TOPUP_REQUEST_STATUS.USER_CONFIRMED;
    request.userConfirmedAt = getVietnamTime().toDate();
    await request.save();

    return {
      id: request.id,
      status: request.status,
      userConfirmedAt: request.userConfirmedAt,
    };
  }

  /**
   * User cancels their pending topup request
   * @param {string} customerId
   * @param {string} requestId
   */
  async cancelRequest(customerId, requestId) {
    const request = await TopupRequest.findOne({
      id: requestId,
      customerId,
    });

    if (!request) {
      throw createHttpError(404, 'Không tìm thấy yêu cầu nạp tiền');
    }

    if (request.status !== TOPUP_REQUEST_STATUS.PENDING) {
      throw createHttpError(400, 'Chỉ có thể hủy yêu cầu đang ở trạng thái chờ');
    }

    request.status = TOPUP_REQUEST_STATUS.CANCELED;
    await request.save();

    return {
      id: request.id,
      status: request.status,
    };
  }

  /**
   * Get customer's topup requests
   * @param {string} customerId
   */
  async getMyRequests(customerId) {
    const requests = await TopupRequest.find({ customerId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return requests.map((r) => ({
      id: r.id,
      amount: r.amount,
      creditAmount: r.creditAmount,
      status: r.status,
      bankInfo: r.bankInfo,
      qrDataUrl: r.qrDataUrl,
      requestInvoice: r.requestInvoice,
      invoiceInfo: r.invoiceInfo,
      userConfirmedAt: r.userConfirmedAt,
      processedAt: r.processedAt,
      adminNote: r.adminNote,
      createdAt: r.createdAt,
    }));
  }

  /**
   * Get customer's billing info
   * @param {string} customerId
   */
  async getBillingInfo(customerId) {
    const customer = await Customer.findOne({ id: customerId })
      .select('billingInfo')
      .lean();

    if (!customer) {
      throw createHttpError(404, 'Không tìm thấy khách hàng');
    }

    return customer.billingInfo || null;
  }

  /**
   * Save customer's billing info
   * @param {string} customerId
   * @param {object} billingInfo
   */
  async saveBillingInfo(customerId, billingInfo) {
    const customer = await Customer.findOneAndUpdate(
      { id: customerId },
      { $set: { billingInfo } },
      { new: true },
    );

    if (!customer) {
      throw createHttpError(404, 'Không tìm thấy khách hàng');
    }

    return customer.billingInfo;
  }

  // ─── Internal (CRM Admin) ──────────────────────────────────────────────────

  /**
   * Admin: Get paginated topup requests
   * @param {object} query
   */
  async adminGetRequests(query) {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 20;
    const skip = (page - 1) * limit;
    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    const filter = {};

    if (query.search) {
      const escaped = escapeRegex(query.search);
      filter.$or = [
        { id: { $regex: escaped, $options: 'i' } },
        { customerId: { $regex: escaped, $options: 'i' } },
        { 'bankInfo.transferContent': { $regex: escaped, $options: 'i' } },
      ];
    }

    if (query.status) {
      filter.status = query.status;
    }

    const from = query.fromDate || query.startDate;
    const to = query.toDate || query.endDate;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = getStartOfDayVN(from);
      if (to) filter.createdAt.$lte = getEndOfDayVN(to);
    }

    const [items, total] = await Promise.all([
      TopupRequest.find(filter)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      TopupRequest.countDocuments(filter),
    ]);

    // Enrich with customer info
    const customerIds = [...new Set(items.map((i) => i.customerId))];
    const customers = await Customer.find({ id: { $in: customerIds } })
      .select('id name phone email billingInfo')
      .lean();
    const customerMap = new Map(customers.map((c) => [c.id, c]));

    const enrichedItems = items.map((item) => {
      const customer = customerMap.get(item.customerId);
      const invoiceInfo = item.invoiceInfo || (item.requestInvoice && customer?.billingInfo ? customer.billingInfo : null);
      return {
        ...item,
        invoiceInfo,
        customer: customer
          ? { id: customer.id, name: customer.name, phone: customer.phone, email: customer.email }
          : null,
      };
    });

    return buildPaginatedResponse(enrichedItems, total, page, limit);
  }

  /**
   * Admin: Get single topup request detail
   * @param {string} requestId
   */
  async adminGetRequestById(requestId) {
    const request = await TopupRequest.findOne({ id: requestId }).lean();
    if (!request) {
      throw createHttpError(404, 'Không tìm thấy yêu cầu nạp tiền');
    }

    const customer = await Customer.findOne({ id: request.customerId })
      .select('id name phone email billingInfo')
      .lean();
    const invoiceInfo = request.invoiceInfo || (request.requestInvoice && customer?.billingInfo ? customer.billingInfo : null);

    return {
      ...request,
      invoiceInfo,
      customer: customer || null,
    };
  }

  /**
   * Admin: Approve topup request → add credit to customer
   * @param {string} requestId
   * @param {string} adminUserId
   * @param {string} note
   */
  async adminApprove(requestId, adminUserId, note = '') {
    const request = await TopupRequest.findOne({ id: requestId });
    if (!request) {
      throw createHttpError(404, 'Không tìm thấy yêu cầu nạp tiền');
    }

    if (request.status === TOPUP_REQUEST_STATUS.APPROVED) {
      throw createHttpError(400, 'Yêu cầu này đã được duyệt');
    }

    if (request.status === TOPUP_REQUEST_STATUS.REJECTED) {
      throw createHttpError(400, 'Yêu cầu này đã bị từ chối');
    }

    // ACID transaction: update request + update customer credit + create credit transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Update request status
      request.status = TOPUP_REQUEST_STATUS.APPROVED;
      request.processedBy = adminUserId;
      request.processedAt = getVietnamTime().toDate();
      request.adminNote = note;
      await request.save({ session });

      // 2. Add credit to customer
      const creditField = 'mainCredit'; // Always mainCredit for bank transfer
      await Customer.findOneAndUpdate(
        { id: request.customerId },
        { $inc: { [creditField]: request.creditAmount } },
        { session },
      );

      // 3. Create credit transaction record
      const transactionGroupId = new mongoose.Types.ObjectId().toString();
      await CreditTransaction.create(
        [
          {
            userId: request.customerId,
            amount: request.creditAmount,
            creditType: CREDIT_TYPES.MAIN,
            transactionType: CREDIT_TRANSACTION_TYPES.IN,
            source: CREDIT_SOURCES.BANK_TRANSFER,
            reference: request.id,
            transactionGroupId,
            status: CREDIT_TRANSACTION_STATUS.SUCCESS,
            description: `Nạp ${request.amount.toLocaleString('vi-VN')}₫ qua chuyển khoản (${request.bankInfo.transferContent})`,
          },
        ],
        { session },
      );

      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      if (err.status || err.statusCode) throw err;
      throw createHttpError(500, 'Lỗi hệ thống khi duyệt yêu cầu nạp tiền');
    } finally {
      session.endSession();
    }

    // Bắn event vào CRM (fire-and-forget, sau khi transaction commit)
    require("../../../core/services/CrmEventEmitter").emit(SYSTEM_SOURCES.BOTVN, SYSTEM_EVENT_TYPES.BOTVN_CHUYEN_KHOAN, {
      name: request.customerName || "",
      email: request.customerEmail || "",
      phone: request.customerPhone || "",
      customerId: request.customerId,
      amount: request.amount,
    });

    return {
      id: request.id,
      status: request.status,
      creditAmount: request.creditAmount,
      processedAt: request.processedAt,
    };
  }

  /**
   * Admin: Reject topup request
   * @param {string} requestId
   * @param {string} adminUserId
   * @param {string} note
   */
  async adminReject(requestId, adminUserId, note = '') {
    const request = await TopupRequest.findOne({ id: requestId });
    if (!request) {
      throw createHttpError(404, 'Không tìm thấy yêu cầu nạp tiền');
    }

    if (request.status === TOPUP_REQUEST_STATUS.APPROVED) {
      throw createHttpError(400, 'Yêu cầu này đã được duyệt, không thể từ chối');
    }

    if (request.status === TOPUP_REQUEST_STATUS.REJECTED) {
      throw createHttpError(400, 'Yêu cầu này đã bị từ chối');
    }

    request.status = TOPUP_REQUEST_STATUS.REJECTED;
    request.processedBy = adminUserId;
    request.processedAt = getVietnamTime().toDate();
    request.adminNote = note;
    await request.save();

    return {
      id: request.id,
      status: request.status,
      processedAt: request.processedAt,
    };
  }

  /**
   * Admin: Get stats for topup requests
   * @param {Object} query - Optional query params including date range
   */
  async adminGetStats(query = {}) {
    const filter = {};
    const from = query.fromDate || query.startDate;
    const to = query.toDate || query.endDate;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = getStartOfDayVN(from);
      if (to) filter.createdAt.$lte = getEndOfDayVN(to);
    }

    const [total, pending, userConfirmed, approved, rejected, canceled] = await Promise.all([
      TopupRequest.countDocuments(filter),
      TopupRequest.countDocuments({ ...filter, status: TOPUP_REQUEST_STATUS.PENDING }),
      TopupRequest.countDocuments({ ...filter, status: TOPUP_REQUEST_STATUS.USER_CONFIRMED }),
      TopupRequest.countDocuments({ ...filter, status: TOPUP_REQUEST_STATUS.APPROVED }),
      TopupRequest.countDocuments({ ...filter, status: TOPUP_REQUEST_STATUS.REJECTED }),
      TopupRequest.countDocuments({ ...filter, status: TOPUP_REQUEST_STATUS.CANCELED }),
    ]);

    const totalApprovedAmount = await TopupRequest.aggregate([
      { $match: { ...filter, status: TOPUP_REQUEST_STATUS.APPROVED } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    return {
      total,
      pending,
      userConfirmed,
      approved,
      rejected,
      canceled,
      needsAttention: pending + userConfirmed,
      totalApprovedAmount: totalApprovedAmount[0]?.total || 0,
    };
  }
}

module.exports = new TopupRequestService();
