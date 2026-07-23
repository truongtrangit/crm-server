const ZCode = require('./zcode.model');
const {
  buildPaginatedResponse,
} = require('../../core/utils/pagination');
const { createHttpError } = require('../../core/utils/http');
const { generateMonotonicIdsBatch, ID_PREFIXES } = require('../../core/utils/id');
const { ZCODE_STATUSES } = require('../../core/constants/zcode');
const { getValidSkus } = require('../../core/constants/zcode');
const { escapeRegex } = require('../../core/utils/query');
const { encryptZCodeField, decryptZCodeField } = require('../../core/utils/crypto');

class ZCodeService {
  // ─── List & Query ──────────────────────────────────────────────────────────

  async getZCodes(query) {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {};

    if (query.search) {
      const escaped = escapeRegex(query.search);
      filter.$or = [
        { id: { $regex: escaped, $options: 'i' } },
        { sku: { $regex: escaped, $options: 'i' } },
        { callerIp: { $regex: escaped, $options: 'i' } },
        { partA: encryptZCodeField(query.search) },
      ];
      if (query.search.includes('-')) {
        const parts = query.search.split('-');
        if (parts.length === 3) {
          filter.$or.push({ keyCode: encryptZCodeField(query.search) });
        } else if (parts.length === 2) {
          filter.$or.push({ partB: encryptZCodeField(parts[0]), partC: encryptZCodeField(parts[1]) });
        }
      } else {
        filter.$or.push({ partB: encryptZCodeField(query.search) });
        filter.$or.push({ partC: encryptZCodeField(query.search) });
      }
    }
    if (query.status && query.status !== 'all') {
      filter.status = query.status;
    }
    if (query.sku && query.sku !== 'all') {
      filter.sku = query.sku;
    }

    const [items, total] = await Promise.all([
      ZCode.find(filter)
        .sort({ importedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ZCode.countDocuments(filter),
    ]);

    const decryptedItems = items.map((item) => {
      const partB = item.partB ? decryptZCodeField(item.partB) : '';
      const partC = item.partC ? decryptZCodeField(item.partC) : '';
      return {
        ...item,
        keyCode: decryptZCodeField(item.keyCode),
        partA: decryptZCodeField(item.partA),
        partB: partB || undefined,
        partC: partC || undefined,
        partialCode: (partB && partC) ? `${partB}-${partC}` : '',
      };
    });

    return buildPaginatedResponse(decryptedItems, total, page, limit);
  }

  async getZCodeById(id) {
    const zcode = await ZCode.findOne({ id }).lean();
    if (!zcode) throw createHttpError(404, 'Không tìm thấy mã ZCode');
    zcode.keyCode = decryptZCodeField(zcode.keyCode);
    zcode.partA = decryptZCodeField(zcode.partA);
    const partB = zcode.partB ? decryptZCodeField(zcode.partB) : '';
    const partC = zcode.partC ? decryptZCodeField(zcode.partC) : '';
    if (partB) zcode.partB = partB;
    if (partC) zcode.partC = partC;
    zcode.partialCode = (partB && partC) ? `${partB}-${partC}` : '';
    return zcode;
  }

  // ─── Batch Create ──────────────────────────────────────────────────────────

  /**
   * Parse listCode text into individual key codes.
   * Supports newline or comma separation.
   * @param {string} listCode
   * @returns {string[]}
   */
  _parseKeyCodes(listCode) {
    const keys = listCode
      .split(/[\n,]+/)
      .map((k) => k.trim())
      .filter(Boolean);

    const invalidFormat = keys.find(k => !/^[A-Za-z0-9]+-[A-Za-z0-9]+-[A-Za-z0-9]+$/.test(k));
    if (invalidFormat) {
      throw createHttpError(
        400,
        `Mã Key "${invalidFormat}" không đúng định dạng (VD: AAAA-BBBB-CCCC)`,
      );
    }
    return keys;
  }

  /**
   * Split a full keyCode (A-B-C) into partA and partialCode (B-C).
   * E.g. "ZL01-C2W7-R4N8" → { partA: "ZL01", partialCode: "C2W7-R4N8" }
   * @param {string} keyCode
   * @returns {{ partA: string, partialCode: string }}
   */
  _splitKeyCode(keyCode) {
    const parts = keyCode.split('-');
    if (parts.length < 3) {
      throw createHttpError(
        400,
        `Mã Key "${keyCode}" không hợp lệ — cần ít nhất 2 phần phân cách bởi dấu "-"`,
      );
    }
    const partA = parts[0];
    const partB = parts[1];
    const partC = parts.slice(2).join('-');
    const partialCode = keyCode.substring(partA.length + 1);
    
    if (!partA || !partialCode) {
      throw createHttpError(400, `Mã Key "${keyCode}" không đúng định dạng chuẩn`);
    }
    return { partA, partB, partC, partialCode };
  }

  async createZCodes(data, userId) {
    const validSkus = getValidSkus();
    if (!validSkus.includes(data.sku)) {
      throw createHttpError(400, `SKU "${data.sku}" không hợp lệ`);
    }

    const keyCodes = this._parseKeyCodes(data.listCode);
    if (keyCodes.length === 0) {
      throw createHttpError(400, 'Danh sách mã Key rỗng sau khi parse');
    }

    // Check for duplicates within the input itself
    const uniqueKeys = [...new Set(keyCodes)];
    if (uniqueKeys.length !== keyCodes.length) {
      const dupsInInput = keyCodes.filter(
        (k, i) => keyCodes.indexOf(k) !== i,
      );
      throw createHttpError(400, 'Danh sách mã Key chứa mã trùng lặp', {
        code: 'DUPLICATE_IN_INPUT',
        duplicates: [...new Set(dupsInInput)],
      });
    }

    // Check for duplicates against DB
    const existing = await ZCode.find({
      keyCode: { $in: uniqueKeys.map(encryptZCodeField) },
    })
      .select('keyCode')
      .lean();

    if (existing.length > 0) {
      throw createHttpError(400, 'Một số mã Key đã tồn tại trong hệ thống', {
        code: 'DUPLICATE_IN_DB',
        duplicates: existing.map((e) => decryptZCodeField(e.keyCode)),
      });
    }

    // Generate IDs
    const ids = await generateMonotonicIdsBatch(
      ID_PREFIXES.ZCODE,
      uniqueKeys.length,
    );

    // Build documents
    const docs = uniqueKeys.map((keyCode, i) => {
      const { partA, partB, partC, partialCode } = this._splitKeyCode(keyCode);
      return {
        id: ids[i],
        batchDate: data.batchDate,
        importedAt: data.importedAt,
        sku: data.sku,
        keyCode: encryptZCodeField(keyCode),
        partA: encryptZCodeField(partA),
        partB: encryptZCodeField(partB),
        partC: encryptZCodeField(partC),
        status: ZCODE_STATUSES.AVAILABLE,
        createdBy: userId || null,
      };
    });

    const result = await ZCode.insertMany(docs);
    return { count: result.length, items: result };
  }

  // ─── Check Duplicates ──────────────────────────────────────────────────────

  async checkDuplicates(keys) {
    const existing = await ZCode.find({ keyCode: { $in: keys.map(encryptZCodeField) } })
      .select('keyCode sku status')
      .lean();
    return {
      total: keys.length,
      duplicateCount: existing.length,
      duplicates: existing.map((e) => ({
        ...e,
        keyCode: decryptZCodeField(e.keyCode),
      })),
    };
  }

  // ─── Status Management ─────────────────────────────────────────────────────

  async updateStatus(id, newStatus) {
    const zcode = await ZCode.findOne({ id });
    if (!zcode) throw createHttpError(404, 'Không tìm thấy mã ZCode');

    const oldStatus = zcode.status;

    if (oldStatus === newStatus) {
      throw createHttpError(400, `Mã ZCode hiện đã ở trạng thái "${oldStatus}"`);
    }

    if (oldStatus === ZCODE_STATUSES.SUCCESS) {
      throw createHttpError(
        400,
        'Không thể thay đổi trạng thái của mã ZCode đã được sử dụng thành công (SUCCESS)',
      );
    }

    if (newStatus === ZCODE_STATUSES.SUCCESS) {
      throw createHttpError(
        400,
        'Không thể cập nhật thủ công thành trạng thái SUCCESS. Trạng thái này chỉ được cập nhật tự động khi gọi API Redeem.',
      );
    }

    zcode.status = newStatus;

    // Clear error info when resetting to available
    if (newStatus === ZCODE_STATUSES.AVAILABLE) {
      zcode.errorReason = null;
      zcode.calledAt = null;
      zcode.respondedAt = null;
      zcode.responseTime = null;
      zcode.callerIp = null;
    }

    await zcode.save();
    return { zcode: zcode.toObject(), oldStatus };
  }

  async retryZCode(id) {
    const zcode = await ZCode.findOne({ id });
    if (!zcode) throw createHttpError(404, 'Không tìm thấy mã ZCode');

    if (zcode.status !== ZCODE_STATUSES.ERROR) {
      throw createHttpError(
        400,
        'Chỉ có thể retry mã ZCode đang ở trạng thái lỗi',
      );
    }

    zcode.status = ZCODE_STATUSES.AVAILABLE;
    zcode.errorReason = null;
    zcode.calledAt = null;
    zcode.respondedAt = null;
    zcode.responseTime = null;
    zcode.callerIp = null;
    await zcode.save();
    return zcode.toObject();
  }

  // ─── Stats ─────────────────────────────────────────────────────────────────

  async getStats() {
    const [totalCount, statusCounts, skuAvailableCounts] = await Promise.all([
      ZCode.countDocuments(),
      ZCode.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      ZCode.aggregate([
        { $match: { status: ZCODE_STATUSES.AVAILABLE } },
        { $group: { _id: '$sku', count: { $sum: 1 } } },
      ]),
    ]);

    const statusMap = {};
    for (const s of statusCounts) {
      statusMap[s._id] = s.count;
    }

    const skuAvailableMap = {};
    for (const s of skuAvailableCounts) {
      skuAvailableMap[s._id] = s.count;
    }

    const totalAvailable = statusMap[ZCODE_STATUSES.AVAILABLE] || 0;
    const totalError = statusMap[ZCODE_STATUSES.ERROR] || 0;
    const totalSuccess = statusMap[ZCODE_STATUSES.SUCCESS] || 0;
    const totalProcessed = totalSuccess + totalError;
    const successRate =
      totalProcessed > 0
        ? parseFloat(((totalSuccess / totalProcessed) * 100).toFixed(1))
        : 0;

    return {
      total: totalCount,
      available: totalAvailable,
      error: totalError,
      success: totalSuccess,
      successRate,
      skuAvailable: skuAvailableMap,
    };
  }

  // ─── Export ────────────────────────────────────────────────────────────────

  async exportZCodes(query) {
    const filter = {};

    if (query.search) {
      const escaped = escapeRegex(query.search);
      filter.$or = [
        { id: { $regex: escaped, $options: 'i' } },
        { sku: { $regex: escaped, $options: 'i' } },
        { callerIp: { $regex: escaped, $options: 'i' } },
        { partA: encryptZCodeField(query.search) },
      ];
      if (query.search.includes('-')) {
        const parts = query.search.split('-');
        if (parts.length === 3) {
          filter.$or.push({ keyCode: encryptZCodeField(query.search) });
        } else if (parts.length === 2) {
          filter.$or.push({ partB: encryptZCodeField(parts[0]), partC: encryptZCodeField(parts[1]) });
        }
      } else {
        filter.$or.push({ partB: encryptZCodeField(query.search) });
        filter.$or.push({ partC: encryptZCodeField(query.search) });
      }
    }
    if (query.status && query.status !== 'all') {
      filter.status = query.status;
    }
    if (query.sku && query.sku !== 'all') {
      filter.sku = query.sku;
    }

    const items = await ZCode.find(filter)
      .sort({ importedAt: -1, createdAt: -1 })
      .lean();

    return items.map((item) => {
      const partB = item.partB ? decryptZCodeField(item.partB) : '';
      const partC = item.partC ? decryptZCodeField(item.partC) : '';
      return {
        ...item,
        keyCode: decryptZCodeField(item.keyCode),
        partA: decryptZCodeField(item.partA),
        partB: partB || undefined,
        partC: partC || undefined,
        partialCode: (partB && partC) ? `${partB}-${partC}` : '',
      };
    });
  }

  // ─── External API: Redeem ──────────────────────────────────────────────────

  /**
   * Atomic redeem: find an available code matching sku + partialCode,
   * set status to SUCCESS, record call metadata.
   * Uses findOneAndUpdate to prevent race conditions.
   *
   * @param {string} sku
   * @param {string} partialCode
   * @param {string} callerIp
   * @returns {Promise<{ partA: string, sku: string, id: string }>}
   */
  async redeemCode(sku, partialCode, callerIp) {
    const validSkus = getValidSkus();
    if (!validSkus.includes(sku)) {
      throw createHttpError(400, `Invalid SKU: "${sku}"`, {
        code: 'ZCODE_INVALID_SKU',
      });
    }

    const calledAt = new Date();
    
    const parts = partialCode.split('-');
    if (parts.length !== 2) throw createHttpError(400, 'Mã không hợp lệ');
    const [partB, partC] = parts;

    const zcode = await ZCode.findOneAndUpdate(
      {
        sku,
        partB: encryptZCodeField(partB),
        partC: encryptZCodeField(partC),
        status: ZCODE_STATUSES.AVAILABLE,
      },
      {
        $set: {
          status: ZCODE_STATUSES.SUCCESS,
          calledAt,
          respondedAt: new Date(),
          callerIp,
        },
      },
      { new: true },
    ).lean();

    if (!zcode) {
      // Check if code exists but is not available
      const exists = await ZCode.findOne({ 
        sku, 
        partB: encryptZCodeField(partB),
        partC: encryptZCodeField(partC) 
      }).lean();
      if (exists) {
        const reason =
          exists.status === ZCODE_STATUSES.SUCCESS
            ? 'Code already redeemed'
            : exists.status === ZCODE_STATUSES.UNAVAILABLE
              ? 'Code is unavailable'
              : 'Code is in error state';
        throw createHttpError(409, reason, {
          code: 'ZCODE_NOT_AVAILABLE',
          currentStatus: exists.status,
        });
      }
      throw createHttpError(404, 'Code not found', {
        code: 'ZCODE_NOT_FOUND',
      });
    }

    // Calculate response time
    const respondedAt = zcode.respondedAt;
    const diffMs = respondedAt.getTime() - calledAt.getTime();
    const responseTime = `${(diffMs / 1000).toFixed(1)}s`;

    await ZCode.updateOne(
      { _id: zcode._id },
      { $set: { responseTime } },
    );

    return {
      partA: decryptZCodeField(zcode.partA),
      sku: zcode.sku,
      id: zcode.id,
    };
  }
}

module.exports = new ZCodeService();
