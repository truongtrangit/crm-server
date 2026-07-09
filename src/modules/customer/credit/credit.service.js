const mongoose = require('mongoose');
const Customer = require('../customer/customer.model');
const CourseVoucher = require('../../course/courseConfig/courseVoucher.model');
const CreditTransaction = require('./creditTransaction.model');
const {
  VOUCHER_STATUSES,
  VOUCHER_TYPES,
  CREDIT_TRANSACTION_TYPES,
  CREDIT_TYPES,
  CREDIT_SOURCES,
  CREDIT_TRANSACTION_STATUS,
} = require('../../../core/constants/appData');
const { createHttpError } = require('../../../core/utils/http');
const env = require('../../../core/config/env');
const httpClient = require('../../../core/utils/httpClient');

class CreditService {
  /**
   * Redeem a voucher code for a user
   * @param {string} customerId
   * @param {string} code
   * @returns {object} { success, credits: { mainCredit, rewardCredit, eduCredit }, currentCredit }
   */
  async redeemVoucher(customerId, code, idempotencyKey) {
    if (!code) throw createHttpError(400, 'Mã code không được để trống');

    if (idempotencyKey) {
      // Check for existing transactions to prevent double click
      const existingTxs = await CreditTransaction.find({
        idempotencyKey: {
          $in: [
            `${idempotencyKey}-MAIN`,
            `${idempotencyKey}-REWARD`,
            `${idempotencyKey}-EDU`,
          ],
        },
        status: CREDIT_TRANSACTION_STATUS.SUCCESS,
      });

      if (existingTxs.length > 0) {
        let mainCredit = 0;
        let rewardCredit = 0;
        let eduCredit = 0;
        existingTxs.forEach((tx) => {
          if (tx.creditType === CREDIT_TYPES.MAIN) mainCredit += tx.amount;
          if (tx.creditType === CREDIT_TYPES.REWARD) rewardCredit += tx.amount;
          if (tx.creditType === CREDIT_TYPES.EDU) eduCredit += tx.amount;
        });
        return { mainCredit, rewardCredit, eduCredit };
      }
    }

    const customer = await Customer.findOne({ id: customerId });
    if (!customer) {
      throw createHttpError(404, 'Không tìm thấy khách hàng');
    }

    const cleanCode = code.trim().toUpperCase();

    // 1. Find voucher to check basic conditions (no lock yet)
    const voucherInfo = await CourseVoucher.findOne({ code: cleanCode });
    if (!voucherInfo) {
      throw createHttpError(404, 'Mã code không hợp lệ');
    }

    if (voucherInfo.status !== VOUCHER_STATUSES.ACTIVE) {
      throw createHttpError(
        400,
        'Voucher không hoạt động hoặc đã được sử dụng',
      );
    }

    if (voucherInfo.expiresAt && new Date() > voucherInfo.expiresAt) {
      throw createHttpError(400, 'Voucher đã hết hạn');
    }

    if (voucherInfo.currentUses >= voucherInfo.maxUses) {
      throw createHttpError(400, 'Voucher đã hết lượt sử dụng');
    }

    // 2. Start ACID Transaction for all modifications
    const session = await mongoose.startSession();
    session.startTransaction();
    let updatedVoucher;
    let updatedCustomer;
    const transactionGroupId = new mongoose.Types.ObjectId().toString();
    const transactionsToInsert = [];

    try {
      switch (voucherInfo.type) {
        case VOUCHER_TYPES.SINGLE:
          // SINGLE VOUCHER LOGIC
          updatedVoucher = await CourseVoucher.findOneAndUpdate(
            {
              _id: voucherInfo._id,
              status: VOUCHER_STATUSES.ACTIVE,
            },
            {
              $set: { status: VOUCHER_STATUSES.USED },
              $inc: { currentUses: 1 },
              $unset: { deleteAt: 1 }, // Stop TTL expiration
            },
            { new: true, session },
          );

          if (!updatedVoucher) {
            throw createHttpError(400, 'Voucher không còn khả dụng');
          }
          break;
        case VOUCHER_TYPES.SHARED:
          // SHARED VOUCHER LOGIC
          if (voucherInfo.usagePerUser > 0) {
            const userTx = await CreditTransaction.find({
              source: CREDIT_SOURCES.VOUCHER,
              reference: cleanCode,
              userId: customerId,
              status: CREDIT_TRANSACTION_STATUS.SUCCESS,
            })
              .session(session)
              .select('transactionGroupId')
              .lean();

            const uniqueGroups = new Set(
              userTx.map((t) => t.transactionGroupId),
            );
            if (uniqueGroups.size >= voucherInfo.usagePerUser) {
              throw createHttpError(
                400,
                'Bạn đã đạt đến giới hạn sử dụng cho voucher này',
              );
            }
          }

          // Optimistic Concurrency inside session
          updatedVoucher = await CourseVoucher.findOneAndUpdate(
            {
              _id: voucherInfo._id,
              status: VOUCHER_STATUSES.ACTIVE,
              currentUses: { $lt: voucherInfo.maxUses },
            },
            { $inc: { currentUses: 1 } },
            { new: true, session },
          );

          if (!updatedVoucher) {
            throw createHttpError(400, 'Voucher không còn khả dụng');
          }

          // If this was the last use, update status to USED
          if (updatedVoucher.currentUses >= updatedVoucher.maxUses) {
            await CourseVoucher.updateOne(
              { _id: updatedVoucher._id },
              { status: VOUCHER_STATUSES.USED },
              { session },
            );
          }
          break;
        default:
          throw createHttpError(400, 'Loại voucher không hợp lệ');
      }

      // 3. Generate history record(s)
      if (updatedVoucher.mainCredit) {
        transactionsToInsert.push({
          userId: customerId,
          amount: updatedVoucher.mainCredit,
          creditType: CREDIT_TYPES.MAIN,
          transactionType: CREDIT_TRANSACTION_TYPES.IN,
          source: CREDIT_SOURCES.VOUCHER,
          reference: cleanCode,
          idempotencyKey: idempotencyKey ? `${idempotencyKey}-MAIN` : undefined,
          transactionGroupId,
          status: CREDIT_TRANSACTION_STATUS.SUCCESS,
        });
      }
      if (updatedVoucher.rewardCredit) {
        transactionsToInsert.push({
          userId: customerId,
          amount: updatedVoucher.rewardCredit,
          creditType: CREDIT_TYPES.REWARD,
          transactionType: CREDIT_TRANSACTION_TYPES.IN,
          source: CREDIT_SOURCES.VOUCHER,
          reference: cleanCode,
          idempotencyKey: idempotencyKey
            ? `${idempotencyKey}-REWARD`
            : undefined,
          transactionGroupId,
          status: CREDIT_TRANSACTION_STATUS.SUCCESS,
        });
      }
      if (updatedVoucher.eduCredit) {
        transactionsToInsert.push({
          userId: customerId,
          amount: updatedVoucher.eduCredit,
          creditType: CREDIT_TYPES.EDU,
          transactionType: CREDIT_TRANSACTION_TYPES.IN,
          source: CREDIT_SOURCES.VOUCHER,
          reference: cleanCode,
          idempotencyKey: idempotencyKey ? `${idempotencyKey}-EDU` : undefined,
          transactionGroupId,
          status: CREDIT_TRANSACTION_STATUS.SUCCESS,
        });
      }

      if (transactionsToInsert.length > 0) {
        await CreditTransaction.insertMany(transactionsToInsert, { session });
      }

      updatedCustomer = await Customer.findOneAndUpdate(
        { id: customerId },
        {
          $inc: {
            mainCredit: updatedVoucher.mainCredit || 0,
            rewardCredit: updatedVoucher.rewardCredit || 0,
            eduCredit: updatedVoucher.eduCredit || 0,
          },
        },
        { new: true, session },
      );

      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      // Rethrow custom HTTP errors
      if (err.status || err.statusCode) {
        throw err;
      }
      // Rethrow unique constraint (11000) for controller to handle
      if (err.code === 11000) {
        throw err;
      }
      console.error(err);
      throw createHttpError(500, 'Lỗi hệ thống khi nạp voucher');
    } finally {
      session.endSession();
    }

    return {
      mainCredit: updatedVoucher.mainCredit || 0,
      rewardCredit: updatedVoucher.rewardCredit || 0,
      eduCredit: updatedVoucher.eduCredit || 0,
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
   * Get credit transaction history for a customer
   * @param {string} customerId
   * @param {string} type - Transaction type (IN or OUT)
   * @returns {Array} List of transactions
   */
  async getHistory(customerId, type = CREDIT_TRANSACTION_TYPES.IN) {
    const transactions = await CreditTransaction.find({
      userId: customerId,
      status: CREDIT_TRANSACTION_STATUS.SUCCESS,
      transactionType: type,
    })
      .sort({ createdAt: -1 })
      .lean();

    const formattedTransactions = transactions.map((t) => ({
      _id: t._id,
      code: t.reference,
      rewardPoints: t.amount,
      creditType: t.creditType,
      redeemedAt: t.createdAt,
      source: t.source,
      description: t.description,
    }));

    return formattedTransactions;
  }

  /**
   * Redeem a SmaxAi code
   * @param {string} customerId
   * @param {string} code
   * @param {string} idempotencyKey
   * @returns {object} { success, amount, currentCredit }
   */
  async redeemSmaxAi(customerId, code, idempotencyKey) {
    if (!code) throw createHttpError(400, 'Mã code không được để trống');

    const customer = await Customer.findOne({ id: customerId });
    if (!customer) throw createHttpError(404, 'Không tìm thấy khách hàng');

    const cleanCode = code.trim().toUpperCase();

    // 1. Check idempotency key from client
    if (idempotencyKey) {
      const existingTx = await CreditTransaction.findOne({ idempotencyKey });
      if (existingTx) {
        if (existingTx.status === CREDIT_TRANSACTION_STATUS.SUCCESS) {
          return {
            success: true,
            amount: existingTx.amount,
            currentCredit: customer.mainCredit,
          };
        }
        throw createHttpError(400, 'Yêu cầu đang được xử lý hoặc đã thất bại.');
      }
    }

    // 2. Pre-check if code already used
    const usedCode = await CreditTransaction.findOne({
      source: CREDIT_SOURCES.SMAXAI,
      reference: cleanCode,
      status: CREDIT_TRANSACTION_STATUS.SUCCESS,
    });
    if (usedCode) {
      throw createHttpError(400, 'Mã code đã được nạp trước đó');
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
        status: CREDIT_TRANSACTION_STATUS.PENDING,
      });
    } catch (error) {
      if (error.code === 11000) {
        throw createHttpError(
          400,
          'Mã code đã được nạp trước đó hoặc yêu cầu trùng lặp.',
        );
      }
      throw error;
    }

    // 4. Call 3rd Party API
    let valid = false;
    let amount = 0;
    try {
      const smaxCreditValidToken = env.smaxCreditValidationToken;
      const smaxCreditValidUrl = env.smaxCreditValidationUrl;
      const url = `${smaxCreditValidUrl}?code_redeem=${encodeURIComponent(cleanCode)}`;
      const responseData = await httpClient.get(url, {
        headers: {
          authorization: `Bearer ${smaxCreditValidToken}`,
        },
      });

      if (responseData && responseData.data) {
        valid = true;
        amount = responseData.data.amount || 0;
      }
    } catch (apiError) {
      let clientErrorMessage = 'Không thể kết nối đến hệ thống SmaxAi';
      let dbDescription = 'Lỗi kết nối API SmaxAi';

      if (apiError.response) {
        const smaxMessage =
          apiError.response.data?.message ||
          apiError.response.data?.error ||
          `HTTP ${apiError.response.status}`;

        if (apiError.response.status === 400) {
          dbDescription = `Mã không hợp lệ: ${smaxMessage}`;
          clientErrorMessage = `Lỗi xác thực mã: ${smaxMessage}`;
        } else if (apiError.response.status === 403) {
          dbDescription = 'Sai token xác thực SmaxAi';
          clientErrorMessage =
            'Lỗi cấu hình hệ thống (403). Vui lòng báo cho admin.';
        } else {
          dbDescription = `Lỗi API SmaxAi: ${smaxMessage}`;
          clientErrorMessage = `Lỗi từ hệ thống SmaxAi: ${smaxMessage}`;
        }
      } else {
        dbDescription = `Lỗi kết nối API SmaxAi: ${apiError.message}`;
        clientErrorMessage = `Không thể kết nối đến hệ thống SmaxAi: ${apiError.message}`;
      }

      await CreditTransaction.updateOne(
        { _id: transaction._id },
        {
          status: CREDIT_TRANSACTION_STATUS.FAILED,
          description: dbDescription,
        },
      );

      const statusCode = apiError.response?.status === 400 ? 400 : 500;
      throw createHttpError(statusCode, clientErrorMessage);
    }

    if (!valid) {
      await CreditTransaction.updateOne(
        { _id: transaction._id },
        {
          status: CREDIT_TRANSACTION_STATUS.FAILED,
          description: 'Mã code không hợp lệ hoặc thiếu dữ liệu credit',
        },
      );
      throw createHttpError(400, 'Mã nạp không hợp lệ hoặc đã được sử dụng.');
    }

    // 5. Success -> Update Transaction and Customer (Using transaction for ACID safety)
    const session = await mongoose.startSession();
    session.startTransaction();
    let updatedCustomer;
    try {
      updatedCustomer = await Customer.findOneAndUpdate(
        { id: customerId },
        { $inc: { mainCredit: amount } },
        { new: true, session },
      );

      await CreditTransaction.updateOne(
        { _id: transaction._id },
        { status: CREDIT_TRANSACTION_STATUS.SUCCESS, amount: amount },
        { session },
      );

      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw createHttpError(500, 'Lỗi hệ thống khi cập nhật điểm');
    } finally {
      session.endSession();
    }

    return {
      success: true,
      amount: amount,
      currentCredit: updatedCustomer.mainCredit,
    };
  }
}

module.exports = new CreditService();
