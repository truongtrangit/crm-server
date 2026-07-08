const crypto = require("crypto");
const SystemLogService = require("../../system/log/systemLog.service");
const CourseVoucher = require("./courseVoucher.model");
const {
  VOUCHER_TYPES,
  VOUCHER_STATUSES,
} = require("../../../core/constants/appData");
const {
  resolvePagination,
  buildPaginatedResponse,
} = require("../../../core/utils/pagination");
const { createHttpError } = require("../../../core/utils/http");
const { escapeRegex } = require("../../../core/utils/query");

/**
 * Generate a cryptographically secure random string for vouchers
 * @param {string} prefix - Optional prefix (e.g. BOTVN)
 * @returns {string} - e.g. BOTVN-A8B9C3D4
 */
function generateVoucherCode(prefix = "") {
  const entropy = crypto.randomBytes(4).toString("hex").toUpperCase();
  if (prefix) {
    return `${prefix.toUpperCase().trim()}-${entropy}`;
  }
  return entropy;
}

class CourseVoucherService {
  /**
   * Create a single shared voucher or manual single-use voucher
   */
  async createVoucher(data, adminId) {
    const {
      type,
      code,
      mainCredit,
      rewardCredit,
      eduCredit,
      maxUses,
      usagePerUser,
      batch,
      status,
      expiresAt,
    } = data;

    if ((!type || type === VOUCHER_TYPES.SINGLE) && !batch) {
      throw createHttpError(
        400,
        "Tên đợt (Batch) là bắt buộc đối với mã dùng 1 lần",
      );
    }

    const voucherData = {
      type: type || VOUCHER_TYPES.SINGLE,
      code: code ? code.trim().toUpperCase() : generateVoucherCode(),
      mainCredit,
      rewardCredit,
      eduCredit,
      maxUses: type === VOUCHER_TYPES.SINGLE ? 1 : maxUses,
      usagePerUser: usagePerUser ?? 1,
      batch: batch || null,
      status: status || VOUCHER_STATUSES.INACTIVE,
      expiresAt: expiresAt || null,
      createdBy: adminId,
    };

    // If there's an expiration date and it's a single use voucher, we want to auto-delete it if unused
    if (voucherData.type === VOUCHER_TYPES.SINGLE && voucherData.expiresAt) {
      voucherData.deleteAt = voucherData.expiresAt;
    }

    const voucher = new CourseVoucher(voucherData);
    await voucher.save();
    return voucher;
  }

  /**
   * Bulk generate single-use vouchers
   */
  async bulkCreateVouchers(data, adminId) {
    const { prefix, count, mainCredit, rewardCredit, eduCredit, batch, status, expiresAt } = data;

    if (!count || count <= 0) {
      throw createHttpError(400, "Count must be greater than 0");
    }

    if (!batch) {
      throw createHttpError(
        400,
        "Tên đợt (Batch) là bắt buộc đối với mã dùng 1 lần",
      );
    }

    // Pre-generate codes
    const vouchers = [];
    for (let i = 0; i < count; i++) {
      // Generate until we get unique ones locally just in case
      vouchers.push({
        type: VOUCHER_TYPES.SINGLE,
        code: generateVoucherCode(prefix),
        mainCredit,
        rewardCredit,
        eduCredit,
        maxUses: 1,
        usagePerUser: 1,
        batch: batch || null,
        status: status || VOUCHER_STATUSES.INACTIVE,
        expiresAt: expiresAt || null,
        deleteAt: expiresAt || null, // For TTL index cleanup
        createdBy: adminId,
      });
    }

    // Using ordered: false allows inserting as many as possible even if one randomly duplicates (astronomically low chance)
    const result = await CourseVoucher.insertMany(vouchers, { ordered: false });
    return result;
  }

  /**
   * Get paginated list of vouchers
   */
  async getVouchers(query) {
    const { page, limit, skip } = resolvePagination(query);
    const { batch, status, type, search } = query;

    const filter = {};
    if (batch) filter.batch = batch;
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (search) {
      filter.code = { $regex: escapeRegex(search), $options: "i" };
    }

    const [data, total] = await Promise.all([
      CourseVoucher.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("creator", "name"),
      CourseVoucher.countDocuments(filter),
    ]);

    const formattedData = data.map(doc => {
      const obj = doc.toJSON ? doc.toJSON() : doc;
      if (obj.creator) {
        obj.createdBy = { id: obj.createdBy, name: obj.creator.name };
        delete obj.creator;
      } else {
        obj.createdBy = { id: obj.createdBy, name: "Unknown" };
      }
      return obj;
    });

    return buildPaginatedResponse(formattedData, total, page, limit);
  }

  /**
   * Get paginated list of voucher batches (grouped single-use vouchers)
   */
  async getVoucherBatches(query) {
    const { page, limit, skip } = resolvePagination(query);
    const { search } = query;

    const matchStage = { type: VOUCHER_TYPES.SINGLE };
    if (search) {
      matchStage.batch = { $regex: escapeRegex(search), $options: "i" };
    }

    const aggregationPipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: "$batch",
          totalVouchers: { $sum: 1 },
          usedVouchers: {
            $sum: {
              $cond: [{ $eq: ["$status", VOUCHER_STATUSES.USED] }, 1, 0],
            },
          },
          mainCredit: { $first: "$mainCredit" },
          rewardCredit: { $first: "$rewardCredit" },
          eduCredit: { $first: "$eduCredit" },
          createdAt: { $first: "$createdAt" },
          expiresAt: { $first: "$expiresAt" },
          createdBy: { $first: "$createdBy" },
          statuses: { $addToSet: "$status" },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "createdBy",
          foreignField: "id",
          as: "creator",
        },
      },
      {
        $unwind: { path: "$creator", preserveNullAndEmptyArrays: true },
      },
      {
        $project: {
          _id: 0,
          batch: { $ifNull: ["$_id", "Không có đợt"] },
          totalVouchers: 1,
          usedVouchers: 1,
          mainCredit: 1,
          rewardCredit: 1,
          eduCredit: 1,
          createdAt: 1,
          expiresAt: 1,
          createdBy: {
            id: "$createdBy",
            name: "$creator.name",
          },
          status: {
            $cond: {
              if: { $eq: ["$totalVouchers", "$usedVouchers"] },
              then: VOUCHER_STATUSES.USED,
              else: {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: "$statuses",
                      as: "s",
                      cond: { $ne: ["$$s", VOUCHER_STATUSES.USED] },
                    },
                  },
                  0,
                ],
              },
            },
          },
        },
      },
      { $sort: { createdAt: -1 } },
    ];

    const [data, totalCountResult] = await Promise.all([
      CourseVoucher.aggregate([
        ...aggregationPipeline,
        { $skip: skip },
        { $limit: limit },
      ]),
      CourseVoucher.aggregate([...aggregationPipeline, { $count: "total" }]),
    ]);

    const total = totalCountResult.length > 0 ? totalCountResult[0].total : 0;
    return buildPaginatedResponse(data, total, page, limit);
  }

  /**
   * Export vouchers by batch or query
   */
  async getVouchersForExport(query) {
    const { batch, status, type, search } = query;
    const filter = {};
    if (batch) filter.batch = batch;
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (search) {
      filter.code = { $regex: escapeRegex(search), $options: "i" };
    }
    // Exclude massive objects to save memory
    return CourseVoucher.find(filter).lean();
  }

  /**
   * Delete a voucher by ID
   */
  async deleteVoucher(id) {
    return CourseVoucher.findByIdAndDelete(id);
  }

  /**
   * Delete all vouchers by batch
   */
  async deleteVouchersByBatch(batch) {
    if (!batch) throw createHttpError(400, "Batch name is required");
    return CourseVoucher.deleteMany({ batch });
  }

  /**
   * Update voucher status (e.g. active to inactive)
   */
  async updateVoucherStatus(id, status) {
    const voucher = await CourseVoucher.findById(id);
    if (!voucher) throw createHttpError(404, "Không tìm thấy vourcher");
    if (
      voucher.status === VOUCHER_STATUSES.USED ||
      voucher.status === VOUCHER_STATUSES.EXPIRED
    ) {
      throw createHttpError(
        400,
        "Không thể cập nhật trạng thái của mã đã sử dụng hoặc đã hết hạn",
      );
    }

    return CourseVoucher.findByIdAndUpdate(id, { status }, { new: true });
  }

  /**
   * Update all vouchers status in a batch (excluding 'used' vouchers)
   */
  async updateBatchStatus(batch, status) {
    if (!batch) throw createHttpError(400, "Tên đợt không được để trống");

    return CourseVoucher.updateMany(
      { batch, status: { $nin: [VOUCHER_STATUSES.USED, VOUCHER_STATUSES.EXPIRED] } },
      { $set: { status } },
    );
  }

  /**
   * Auto update expired vouchers by checking expiresAt against current time
   */
  async autoUpdateExpiredVouchers() {
    const now = new Date();
    try {
      const result = await CourseVoucher.updateMany(
        {
          expiresAt: { $lt: now, $ne: null },
          status: { $in: [VOUCHER_STATUSES.ACTIVE, VOUCHER_STATUSES.INACTIVE] },
        },
        { $set: { status: VOUCHER_STATUSES.EXPIRED } },
      );
      if (result.modifiedCount > 0) {
        console.log(
          `[CourseVoucherService] Auto-expired ${result.modifiedCount} vouchers.`,
        );

        SystemLogService.log({
          action: "update",
          resource: "voucher",
          description: `Hệ thống tự động cập nhật ${result.modifiedCount} voucher đã hết hạn`,
          performedBy: { userId: "SYSTEM", userName: "System", userAvatar: "" },
        });
      }
    } catch (error) {
      console.error(
        "[CourseVoucherService] Error auto-updating expired vouchers:",
        error,
      );
    }
  }
}

module.exports = new CourseVoucherService();
