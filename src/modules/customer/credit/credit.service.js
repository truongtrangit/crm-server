const Customer = require("../customer/customer.model");
const CourseVoucher = require("../../course/courseConfig/courseVoucher.model");
const VoucherRedemption = require("../../course/courseConfig/voucherRedemption.model");
const {
  VOUCHER_STATUSES,
  VOUCHER_TYPES,
} = require("../../../core/constants/appData");
const { createHttpError } = require("../../../core/utils/http");

class CreditService {
  /**
   * Redeem a voucher code for a user
   * @param {string} customerId
   * @param {string} code
   * @returns {object} { success, rewardPoints, currentCredit }
   */
  async redeemVoucher(customerId, code) {
    if (!code) throw createHttpError(400, "Mã code không được để trống");

    const customer = await Customer.findOne({ id: customerId });
    if (!customer) {
      throw createHttpError(404, "Không tìm thấy khách hàng");
    }

    const cleanCode = code.trim().toUpperCase();

    // 1. Find voucher to check basic conditions
    const voucher = await CourseVoucher.findOne({ code: cleanCode });
    if (!voucher) {
      throw createHttpError(404, "Mã code không hợp lệ");
    }

    if (voucher.status !== VOUCHER_STATUSES.ACTIVE) {
      throw createHttpError(
        400,
        "Voucher không hoạt động hoặc đã được sử dụng",
      );
    }

    if (voucher.expiresAt && new Date() > voucher.expiresAt) {
      throw createHttpError(400, "Voucher đã hết hạn");
    }

    if (voucher.currentUses >= voucher.maxUses) {
      throw createHttpError(400, "Voucher đã hết lượt sử dụng");
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
          throw createHttpError(400, "Voucher không còn khả dụng");
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
              "Bạn đã đạt đến giới hạn sử dụng cho voucher này",
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
          throw createHttpError(400, "Voucher không còn khả dụng");
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
        throw createHttpError(400, "Loại voucher không hợp lệ");
    }

    // 4. Create history record
    await VoucherRedemption.create({
      code: cleanCode,
      userId: customerId,
      rewardPoints: updatedVoucher.rewardPoints,
    });

    // 5. Update customer credits
    const updatedCustomer = await Customer.findOneAndUpdate(
      { id: customerId },
      { $inc: { rewardCredit: updatedVoucher.rewardPoints } },
      { new: true },
    );

    return {
      success: true,
      rewardPoints: updatedVoucher.rewardPoints,
      currentCredit: updatedCustomer.rewardCredit,
    };
  }

  /**
   * Get credits for a customer
   * @param {string} customerId
   * @returns {object} { rewardCredit, mainCredit }
   */
  async getCredits(customerId) {
    const customer = await Customer.findOne({ id: customerId }).select(
      "rewardCredit mainCredit",
    );

    if (!customer) {
      throw createHttpError(404, "Customer not found");
    }

    return {
      rewardCredit: customer.rewardCredit || 0,
      mainCredit: customer.mainCredit || 0,
    };
  }

  /**
   * Get deposit history for a customer
   * @param {string} customerId
   * @returns {Array} List of redemptions
   */
  async getHistory(customerId) {
    const history = await VoucherRedemption.find({ userId: customerId })
      .sort({ redeemedAt: -1 })
      .lean();
    return history;
  }
}

module.exports = new CreditService();
