const crypto = require("crypto");
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
      rewardPoints,
      maxUses,
      usagePerUser,
      batch,
      status,
      expiresAt,
    } = data;

    const voucherData = {
      type: type || VOUCHER_TYPES.SINGLE,
      code: code ? code.trim().toUpperCase() : generateVoucherCode(),
      rewardPoints,
      maxUses: type === VOUCHER_TYPES.SINGLE ? 1 : maxUses,
      usagePerUser: usagePerUser || 1,
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
    const { prefix, count, rewardPoints, batch, status, expiresAt } = data;

    if (!count || count <= 0) {
      throw createHttpError(400, "Count must be greater than 0");
    }

    // Pre-generate codes
    const vouchers = [];
    for (let i = 0; i < count; i++) {
      // Generate until we get unique ones locally just in case
      vouchers.push({
        type: VOUCHER_TYPES.SINGLE,
        code: generateVoucherCode(prefix),
        rewardPoints,
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
      filter.code = { $regex: search, $options: "i" };
    }

    const [data, total] = await Promise.all([
      CourseVoucher.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      CourseVoucher.countDocuments(filter),
    ]);

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
      filter.code = { $regex: search, $options: "i" };
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
    return CourseVoucher.findByIdAndUpdate(id, { status }, { new: true });
  }
}

module.exports = new CourseVoucherService();
