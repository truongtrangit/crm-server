const mongoose = require("mongoose");
const Customer = require("../customer/customer.model");
const CourseVoucher = require("../../course/courseConfig/courseVoucher.model");
const VoucherRedemption = require("../../course/courseConfig/voucherRedemption.model");
const CreditTransaction = require("./creditTransaction.model");
const {
  VOUCHER_STATUSES,
  VOUCHER_TYPES,
  CREDIT_TRANSACTION_TYPES,
  CREDIT_TYPES,
  CREDIT_SOURCES,
  CREDIT_TRANSACTION_STATUS,
} = require("../../../core/constants/appData");
const { createHttpError } = require("../../../core/utils/http");

class CreditService {
  /**
   * Redeem a voucher code for a user
   * @param {string} customerId
   * @param {string} code
   * @returns {object} { success, credits: { mainCredit, rewardCredit, eduCredit }, currentCredit }
   */
  async redeemVoucher(customerId, code) {
    if (!code) throw createHttpError(400, 'Mã code không được để trống');

    const customer = await Customer.findOne({ id: customerId });
    if (!customer) {
      throw createHttpError(404, 'Không tìm thấy khách hàng');
    }

    const cleanCode = code.trim().toUpperCase();

    // 1. Find voucher to check basic conditions
    const voucher = await CourseVoucher.findOne({ code: cleanCode });
    if (!voucher) {
      throw createHttpError(404, 'Mã code không hợp lệ');
    }

    if (voucher.status !== VOUCHER_STATUSES.ACTIVE) {
      throw createHttpError(
        400,
        'Voucher không hoạt động hoặc đã được sử dụng',
      );
    }

    if (voucher.expiresAt && new Date() > voucher.expiresAt) {
      throw createHttpError(400, 'Voucher đã hết hạn');
    }

    if (voucher.currentUses >= voucher.maxUses) {
      throw createHttpError(400, 'Voucher đã hết lượt sử dụng');
    }

    let updatedVoucher;

    switch (voucher.type) {
      case VOUCHER_TYPES.SINGLE:
        // 1. SINGLE VOUCHER LOGIC
        // No need to check usagePerUser since maxUses is globally 1.
        // Atomic update: must be ACTIVE. Set to USED directly.
        updatedVoucher = await CourseVoucher.findOneAndUpdate(
          {
            _id: voucher._id,
            status: VOUCHER_STATUSES.ACTIVE,
          },
          {
            $set: { status: VOUCHER_STATUSES.USED },
            $inc: { currentUses: 1 },
            $unset: { deleteAt: 1 }, // Stop TTL expiration
          },
          { new: true },
        );

        if (!updatedVoucher) {
          throw createHttpError(400, 'Voucher không còn khả dụng');
        }
        break;
      case VOUCHER_TYPES.SHARED:
        // 2. SHARED VOUCHER LOGIC
        // Check usagePerUser limit if applicable (>0)
        if (voucher.usagePerUser > 0) {
          const userUsageCount = await VoucherRedemption.countDocuments({
            code: cleanCode,
            userId: customerId,
          });

          if (userUsageCount >= voucher.usagePerUser) {
            throw createHttpError(
              400,
              'Bạn đã đạt đến giới hạn sử dụng cho voucher này',
            );
          }
        }

        // Optimistic Concurrency: atomic update to secure slot
        updatedVoucher = await CourseVoucher.findOneAndUpdate(
          {
            _id: voucher._id,
            status: VOUCHER_STATUSES.ACTIVE,
            currentUses: { $lt: voucher.maxUses },
          },
          { $inc: { currentUses: 1 } },
          { new: true },
        );

        if (!updatedVoucher) {
          // If it returns null, another request beat us to it and hit maxUses, or it was deactivated
          throw createHttpError(400, 'Voucher không còn khả dụng');
        }

        // If this was the last use, update status to USED
        if (updatedVoucher.currentUses >= updatedVoucher.maxUses) {
          await CourseVoucher.updateOne(
            { _id: updatedVoucher._id },
            { status: VOUCHER_STATUSES.USED },
          );
        }
        break;
      default:
        throw createHttpError(400, 'Loại voucher không hợp lệ');
    }

    // 4. Create history record
    await VoucherRedemption.create({
      code: cleanCode,
      userId: customerId,
      mainCredit: updatedVoucher.mainCredit || 0,
      rewardCredit: updatedVoucher.rewardCredit || 0,
      eduCredit: updatedVoucher.eduCredit || 0,
    });

    // 5. Update customer credits
    const updatedCustomer = await Customer.findOneAndUpdate(
      { id: customerId },
      {
        $inc: {
          mainCredit: updatedVoucher.mainCredit || 0,
          rewardCredit: updatedVoucher.rewardCredit || 0,
          eduCredit: updatedVoucher.eduCredit || 0,
        },
      },
      { new: true },
    );

    return {
      success: true,
      mainCredit: updatedVoucher.mainCredit || 0,
      rewardCredit: updatedVoucher.rewardCredit || 0,
      eduCredit: updatedVoucher.eduCredit || 0,
      currentMainCredit: updatedCustomer.mainCredit,
      currentRewardCredit: updatedCustomer.rewardCredit,
      currentEduCredit: updatedCustomer.eduCredit,
    };
  }

  /**
   * Get credits for a customer
   * @param {string} customerId
   * @returns {object} { rewardCredit, mainCredit }
   */
  async getCredits(customerId) {
    const customer = await Customer.findOne({ id: customerId }).select(
      'rewardCredit mainCredit eduCredit isEduAccount',
    );

    if (!customer) {
      throw createHttpError(404, 'Customer not found');
    }

    return {
      rewardCredit: customer.rewardCredit || 0,
      mainCredit: customer.mainCredit || 0,
      eduCredit: customer.eduCredit || 0,
      isEduAccount: customer.isEduAccount || false,
    };
  }

  /**
   * Get deposit history for a customer
   * @param {string} customerId
   * @returns {Array} List of redemptions
   */
  async getHistory(customerId) {
    const vouchers = await VoucherRedemption.find({ userId: customerId }).lean();
    const transactions = await CreditTransaction.find({ 
      userId: customerId, 
      status: CREDIT_TRANSACTION_STATUS.SUCCESS, 
      transactionType: CREDIT_TRANSACTION_TYPES.IN 
    }).lean();

    const formattedTransactions = transactions.map(t => ({
      _id: t._id,
      code: t.reference,
      rewardPoints: t.amount,
      redeemedAt: t.createdAt,
      source: t.source
    }));

    const combined = [...vouchers, ...formattedTransactions].sort((a, b) => {
      const dateA = new Date(a.redeemedAt);
      const dateB = new Date(b.redeemedAt);
      return dateB - dateA;
    });

    return combined;
  }

  /**
   * Redeem a SmaxAi code
   * @param {string} customerId
   * @param {string} code
   * @param {string} idempotencyKey
   * @returns {object} { success, amount, currentCredit }
   */
  async redeemSmaxAi(customerId, code, idempotencyKey) {
    if (!code) throw createHttpError(400, "Mã code không được để trống");
    
    const customer = await Customer.findOne({ id: customerId });
    if (!customer) throw createHttpError(404, "Không tìm thấy khách hàng");

    const cleanCode = code.trim().toUpperCase();

    // 1. Check idempotency key from client
    if (idempotencyKey) {
      const existingTx = await CreditTransaction.findOne({ idempotencyKey });
      if (existingTx) {
        if (existingTx.status === CREDIT_TRANSACTION_STATUS.SUCCESS) {
           return { success: true, amount: existingTx.amount, currentCredit: customer.mainCredit };
        }
        throw createHttpError(400, "Yêu cầu đang được xử lý hoặc đã thất bại.");
      }
    }

    // 2. Pre-check if code already used
    const usedCode = await CreditTransaction.findOne({ 
      source: CREDIT_SOURCES.SMAXAI, 
      reference: cleanCode, 
      status: CREDIT_TRANSACTION_STATUS.SUCCESS 
    });
    if (usedCode) {
      throw createHttpError(400, "Mã code đã được nạp trước đó");
    }

    // 3. Create PENDING transaction
    let transaction;
    try {
      transaction = await CreditTransaction.create({
        userId: customerId,
        amount: 0, 
        creditType: CREDIT_TYPES.MAIN,
        transactionType: CREDIT_TRANSACTION_TYPES.IN,
        source: CREDIT_SOURCES.SMAXAI,
        reference: cleanCode,
        idempotencyKey: idempotencyKey || undefined,
        status: CREDIT_TRANSACTION_STATUS.PENDING
      });
    } catch (error) {
      if (error.code === 11000) {
        throw createHttpError(400, "Mã code đã được nạp trước đó hoặc yêu cầu trùng lặp.");
      }
      throw error;
    }

    // 4. Call 3rd Party API (Mock for now)
    let valid = false;
    let amount = 0;
    try {
      // Giả lập network delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Giả lập logic trả về: mã code bắt đầu bằng SMAX thì tặng 100k, SMAX50 tặng 50k
      if (cleanCode.startsWith("SMAX50")) {
        valid = true;
        amount = 50000;
      } else if (cleanCode.startsWith("SMAX")) {
        valid = true;
        amount = 100000;
      } else {
        valid = false;
      }
    } catch (apiError) {
      await CreditTransaction.updateOne({ _id: transaction._id }, { status: CREDIT_TRANSACTION_STATUS.FAILED, description: 'Lỗi kết nối API SmaxAi' });
      throw createHttpError(500, "Không thể kết nối đến hệ thống SmaxAi");
    }

    if (!valid) {
      await CreditTransaction.updateOne({ _id: transaction._id }, { status: CREDIT_TRANSACTION_STATUS.FAILED, description: 'Mã không hợp lệ' });
      throw createHttpError(400, "Mã SmaxAi không hợp lệ");
    }

    // 5. Success -> Update Transaction and Customer (Using transaction for ACID safety)
    const session = await mongoose.startSession();
    session.startTransaction();
    let updatedCustomer;
    try {
      updatedCustomer = await Customer.findOneAndUpdate(
        { id: customerId },
        { $inc: { mainCredit: amount } },
        { new: true, session }
      );
      
      await CreditTransaction.updateOne(
        { _id: transaction._id },
        { status: CREDIT_TRANSACTION_STATUS.SUCCESS, amount: amount },
        { session }
      );
      
      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw createHttpError(500, "Lỗi hệ thống khi cập nhật điểm");
    } finally {
      session.endSession();
    }

    return {
      success: true,
      amount: amount,
      currentCredit: updatedCustomer.mainCredit
    };
  }
}

module.exports = new CreditService();
