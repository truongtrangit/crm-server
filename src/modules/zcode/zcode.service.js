const ZCode = require('./zcode.model');
const { buildPaginatedResponse } = require('../../core/utils/pagination');
const { createHttpError } = require('../../core/utils/http');
const {
  generateMonotonicIdsBatch,
  ID_PREFIXES,
} = require('../../core/utils/id');
const {
  ZCODE_STATUSES,
  ZCODE_ERROR_REASONS,
  ZCODE_SKU_LIST_PRICES,
  ZCODE_PRICE_ADJUSTMENT_TYPES,
  ZCODE_MAX_CODES_PER_REQUEST,
  getValidSkus,
  getSkuListPrice,
} = require('../../core/constants/zcode');
const { escapeRegex } = require('../../core/utils/query');
const { getStartOfDayVN, getEndOfDayVN } = require('../../core/utils/date');
const {
  encryptZCodeField,
  decryptZCodeField,
} = require('../../core/utils/crypto');

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
          filter.$or.push({
            partB: encryptZCodeField(parts[0]),
            partC: encryptZCodeField(parts[1]),
          });
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
    if (query.importedAt) {
      filter.importedAt = query.importedAt;
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
        partialCode: partB && partC ? `${partB}-${partC}` : '',
      };
    });

    return buildPaginatedResponse(decryptedItems, total, page, limit);
  }

  async getZCodeBatches(query) {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 20;
    const skip = (page - 1) * limit;

    const pipeline = [];

    // Date & SKU filters (applied before grouping)
    const matchFilter = {};
    if (query.sku) matchFilter.sku = query.sku;
    if (query.startDate || query.endDate) {
      matchFilter.importedAt = {};
      if (query.startDate)
        matchFilter.importedAt.$gte = getStartOfDayVN(query.startDate);
      if (query.endDate)
        matchFilter.importedAt.$lte = getEndOfDayVN(query.endDate);
    }
    if (Object.keys(matchFilter).length > 0) {
      pipeline.push({ $match: matchFilter });
    }

    // Grouping by importedAt, batchDate, sku
    pipeline.push({
      $group: {
        _id: {
          importedAt: '$importedAt',
          batchDate: '$batchDate',
          sku: '$sku',
          listPrice: '$listPrice',
          finalPrice: '$finalPrice',
          priceAdjustmentType: '$priceAdjustmentType',
          priceAdjustmentValue: '$priceAdjustmentValue',
        },
        totalCodes: { $sum: 1 },
        availableCodes: {
          $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] },
        },
        errorCodes: {
          $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] },
        },
        usedCodes: {
          $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] },
        },
        unavailableCodes: {
          $sum: { $cond: [{ $eq: ['$status', 'unavailable'] }, 1, 0] },
        },
      },
    });

    // Flatten output
    pipeline.push({
      $project: {
        _id: 0,
        id: {
          $concat: [
            'batch_',
            { $toString: '$_id.importedAt' },
            '_',
            '$_id.sku',
          ],
        },
        importedAt: '$_id.importedAt',
        batchDate: '$_id.batchDate',
        sku: '$_id.sku',
        listPrice: '$_id.listPrice',
        finalPrice: '$_id.finalPrice',
        priceAdjustmentType: '$_id.priceAdjustmentType',
        priceAdjustmentValue: '$_id.priceAdjustmentValue',
        totalCodes: 1,
        availableCodes: 1,
        errorCodes: 1,
        usedCodes: 1,
        unavailableCodes: 1,
      },
    });

    // Sorting
    pipeline.push({
      $sort: { importedAt: -1 },
    });

    // Pagination
    const facet = {
      metadata: [{ $count: 'total' }],
      data: [{ $skip: skip }, { $limit: limit }],
    };
    pipeline.push({ $facet: facet });

    const results = await ZCode.aggregate(pipeline);

    const data = results[0].data || [];
    const total = results[0].metadata[0] ? results[0].metadata[0].total : 0;

    return buildPaginatedResponse(data, total, page, limit);
  }

  async getZCodeBatchStats(query = {}) {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {};
    if (query.sku) {
      filter.sku = { $regex: new RegExp(query.sku, 'i') };
    }
    if (query.startDate || query.endDate) {
      filter.importedAt = {};
      if (query.startDate)
        filter.importedAt.$gte = getStartOfDayVN(query.startDate);
      if (query.endDate) filter.importedAt.$lte = getEndOfDayVN(query.endDate);
    }

    const pipeline = [];

    if (Object.keys(filter).length > 0) {
      pipeline.push({ $match: filter });
    }

    // Step 1: Group by batchDate, importedAt, sku to get SKU-level aggregates (treating same SKU imported at different times as different items)
    pipeline.push({
      $group: {
        _id: {
          batchDate: '$batchDate',
          // importedAt: '$importedAt',
          sku: '$sku',
          finalPrice: '$finalPrice',
        },
        quantity: { $sum: 1 },
        availableCodes: {
          $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] },
        },
        usedCodes: {
          $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] },
        },
        errorCodes: {
          $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] },
        },
        unavailableCodes: {
          $sum: { $cond: [{ $eq: ['$status', 'unavailable'] }, 1, 0] },
        },
      },
    });

    // Step 2: Calculate financial values for each SKU group
    pipeline.push({
      $addFields: {
        totalValue: { $multiply: ['$quantity', '$_id.finalPrice'] },
        soldValue: { $multiply: ['$usedCodes', '$_id.finalPrice'] },
      },
    });

    // Step 3: Sort SKUs before pushing (optional, but helps keep output consistent, e.g., sort by importedAt ascending)
    pipeline.push({
      $sort: { '_id.importedAt': 1, '_id.sku': 1 },
    });

    // Step 4: Group by batchDate to get the batch-level aggregates
    pipeline.push({
      $group: {
        _id: {
          batchDate: '$_id.batchDate',
        },
        totalCodes: { $sum: '$quantity' },
        grandTotalValue: { $sum: '$totalValue' },
        grandTotalSoldValue: { $sum: '$soldValue' },
        skus: {
          $push: {
            sku: '$_id.sku',
            importedAt: '$_id.importedAt',
            quantity: '$quantity',
            unitPrice: '$_id.finalPrice',
            totalValue: '$totalValue',
            soldValue: '$soldValue',
            availableCodes: '$availableCodes',
            usedCodes: '$usedCodes',
            errorCodes: '$errorCodes',
            unavailableCodes: '$unavailableCodes',
          },
        },
      },
    });

    // Step 5: Flatten output
    pipeline.push({
      $project: {
        _id: 0,
        id: { $toString: '$_id.batchDate' },
        batchDate: '$_id.batchDate',
        totalCodes: 1,
        grandTotalValue: 1,
        grandTotalSoldValue: 1,
        skus: 1,
      },
    });

    // Step 6: Sorting by batchDate descending
    pipeline.push({
      $sort: { batchDate: -1 },
    });

    // Step 6: Pagination
    const facet = {
      metadata: [{ $count: 'total' }],
      data: [{ $skip: skip }, { $limit: limit }],
    };
    pipeline.push({ $facet: facet });

    const results = await ZCode.aggregate(pipeline);

    const data = results[0].data || [];
    const total = results[0].metadata[0] ? results[0].metadata[0].total : 0;

    return buildPaginatedResponse(data, total, page, limit);
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
    zcode.partialCode = partB && partC ? `${partB}-${partC}` : '';
    return zcode;
  }

  // ─── Pricing ──────────────────────────────────────────────────────────────

  /**
   * Returns all SKU list prices.
   * @returns {Object} Map of SKU → list price
   */
  getSkuPrices() {
    return { ...ZCODE_SKU_LIST_PRICES };
  }

  /**
   * Calculate final price based on list price and adjustment.
   * @param {number} listPrice
   * @param {{ priceAdjustmentType: string, priceAdjustmentValue: number }} data
   * @returns {{ listPrice: number, priceAdjustmentType: string, priceAdjustmentValue: number|null, finalPrice: number }}
   */
  _calculateFinalPrice(listPrice, data) {
    const type = data.priceAdjustmentType || ZCODE_PRICE_ADJUSTMENT_TYPES.NONE;
    const value = data.priceAdjustmentValue;
    let finalPrice;

    switch (type) {
      case ZCODE_PRICE_ADJUSTMENT_TYPES.DISCOUNT_PERCENT:
        if (value < 0 || value > 100) {
          throw createHttpError(400, 'Phần trăm giảm giá phải từ 0 đến 100');
        }
        finalPrice = Math.round(listPrice - (listPrice * value) / 100);
        break;
      case ZCODE_PRICE_ADJUSTMENT_TYPES.DISCOUNT_AMOUNT:
        if (value > listPrice) {
          throw createHttpError(
            400,
            'Số tiền giảm không được vượt quá giá niêm yết',
          );
        }
        finalPrice = listPrice - value;
        break;
      case ZCODE_PRICE_ADJUSTMENT_TYPES.CUSTOM:
        finalPrice = value;
        break;
      default:
        finalPrice = listPrice;
        break;
    }

    if (finalPrice < 0) {
      throw createHttpError(400, 'Giá bán cuối cùng không được âm');
    }

    return {
      listPrice,
      priceAdjustmentType: type,
      priceAdjustmentValue:
        type === ZCODE_PRICE_ADJUSTMENT_TYPES.NONE ? null : value,
      finalPrice,
    };
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

    const invalidFormat = keys.find(
      (k) => !/^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/.test(k),
    );
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
      throw createHttpError(
        400,
        `Mã Key "${keyCode}" không đúng định dạng chuẩn`,
      );
    }
    return { partA, partB, partC, partialCode };
  }

  async createZCodes(data, userId) {
    const validSkus = getValidSkus();

    const allKeyCodes = [];
    const itemDataList = [];

    for (const item of data.items) {
      if (!validSkus.includes(item.sku)) {
        throw createHttpError(400, `SKU "${item.sku}" không hợp lệ`);
      }

      const keyCodes = this._parseKeyCodes(item.listCode);
      if (keyCodes.length === 0) {
        throw createHttpError(400, `Danh sách mã Key rỗng cho SKU ${item.sku}`);
      }

      const listPrice = getSkuListPrice(item.sku);
      if (listPrice == null) {
        throw createHttpError(
          400,
          `Không tìm thấy giá niêm yết cho SKU "${item.sku}"`,
        );
      }
      const pricing = this._calculateFinalPrice(listPrice, item);

      itemDataList.push({
        sku: item.sku,
        keyCodes,
        pricing,
      });

      allKeyCodes.push(...keyCodes);
    }

    // Check total code count limit
    if (allKeyCodes.length > ZCODE_MAX_CODES_PER_REQUEST) {
      throw createHttpError(
        400,
        `Tổng số mã không được vượt quá ${ZCODE_MAX_CODES_PER_REQUEST} mã mỗi lần nhập (bạn đã nhập ${allKeyCodes.length} mã)`,
      );
    }

    // Check for duplicates within the input itself
    const uniqueKeys = [...new Set(allKeyCodes)];
    if (uniqueKeys.length !== allKeyCodes.length) {
      const dupsInInput = allKeyCodes.filter(
        (k, i) => allKeyCodes.indexOf(k) !== i,
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
    const docs = [];
    let idIndex = 0;

    for (const itemData of itemDataList) {
      for (const keyCode of itemData.keyCodes) {
        const { partA, partB, partC, partialCode } =
          this._splitKeyCode(keyCode);
        docs.push({
          id: ids[idIndex++],
          batchDate: data.batchDate,
          importedAt: data.importedAt,
          sku: itemData.sku,
          keyCode: encryptZCodeField(keyCode),
          partA: encryptZCodeField(partA),
          partB: encryptZCodeField(partB),
          partC: encryptZCodeField(partC),
          status: ZCODE_STATUSES.AVAILABLE,
          listPrice: itemData.pricing.listPrice,
          priceAdjustmentType: itemData.pricing.priceAdjustmentType,
          priceAdjustmentValue: itemData.pricing.priceAdjustmentValue,
          finalPrice: itemData.pricing.finalPrice,
          createdBy: userId || null,
        });
      }
    }

    const result = await ZCode.insertMany(docs);
    return {
      count: result.length,
      items: result,
      skus: [...new Set(data.items.map((i) => i.sku))],
    };
  }

  // ─── Check Duplicates ──────────────────────────────────────────────────────

  async checkDuplicates(keys) {
    const existing = await ZCode.find({
      keyCode: { $in: keys.map(encryptZCodeField) },
    })
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
      throw createHttpError(
        400,
        `Mã ZCode hiện đã ở trạng thái "${oldStatus}"`,
      );
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

  async checkBulkStatus({ listCode, targetStatus }) {
    const keyCodes = this._parseKeyCodes(listCode);
    if (keyCodes.length === 0) {
      throw createHttpError(400, 'Danh sách mã Key rỗng sau khi parse');
    }
    if (keyCodes.length > ZCODE_MAX_CODES_PER_REQUEST) {
      throw createHttpError(
        400,
        `Tổng số mã không được vượt quá ${ZCODE_MAX_CODES_PER_REQUEST} mã mỗi lần cập nhật (bạn đã nhập ${keyCodes.length} mã)`,
      );
    }

    const uniqueKeys = [...new Set(keyCodes)];
    const duplicatesInInput = keyCodes.filter(
      (k, i) => keyCodes.indexOf(k) !== i,
    );
    const uniqueDuplicates = [...new Set(duplicatesInInput)];

    const existingCodes = await ZCode.find({
      keyCode: { $in: uniqueKeys.map(encryptZCodeField) },
    }).lean();

    const existingKeyCodes = existingCodes.map((c) =>
      decryptZCodeField(c.keyCode),
    );
    const notFound = uniqueKeys.filter((k) => !existingKeyCodes.includes(k));

    const validCodes = [];
    const invalidCodes = [];

    existingCodes.forEach((code) => {
      const keyCodeStr = decryptZCodeField(code.keyCode);
      if (code.status === ZCODE_STATUSES.SUCCESS) {
        invalidCodes.push({
          keyCode: keyCodeStr,
          reason: 'Mã đã được sử dụng thành công (SUCCESS)',
          currentStatus: code.status,
        });
      } else if (code.status === targetStatus) {
        invalidCodes.push({
          keyCode: keyCodeStr,
          reason: `Mã hiện đã ở trạng thái "${targetStatus}"`,
          currentStatus: code.status,
        });
      } else {
        validCodes.push({
          id: code.id,
          keyCode: keyCodeStr,
          sku: code.sku,
          currentStatus: code.status,
        });
      }
    });

    // Group valid codes by sku
    const groupedBySkuMap = {};
    validCodes.forEach((c) => {
      if (!groupedBySkuMap[c.sku])
        groupedBySkuMap[c.sku] = { sku: c.sku, count: 0, codes: [] };
      groupedBySkuMap[c.sku].count += 1;
      groupedBySkuMap[c.sku].codes.push(c);
    });
    const validGroupedBySku = Object.values(groupedBySkuMap);

    return {
      totalInput: keyCodes.length,
      uniqueInput: uniqueKeys.length,
      duplicatesInInput: uniqueDuplicates,
      notFound,
      validCodes,
      validGroupedBySku,
      invalidCodes,
    };
  }

  async updateBulkStatus({ listCode, targetStatus, note }) {
    const checkResult = await this.checkBulkStatus({ listCode, targetStatus });

    if (checkResult.validCodes.length === 0) {
      throw createHttpError(
        400,
        'Không có mã hợp lệ nào để cập nhật trạng thái',
      );
    }

    const validIds = checkResult.validCodes.map((c) => c.id);

    const updateQuery = { status: targetStatus };
    if (note !== undefined) {
      updateQuery.note = note || null;
    }

    // Clear error fields if changing to AVAILABLE
    if (targetStatus === ZCODE_STATUSES.AVAILABLE) {
      updateQuery.errorReason = null;
      updateQuery.calledAt = null;
      updateQuery.respondedAt = null;
      updateQuery.responseTime = null;
      updateQuery.callerIp = null;
    }

    const result = await ZCode.updateMany(
      { id: { $in: validIds } },
      { $set: updateQuery },
    );

    return {
      updatedCount: result.modifiedCount,
      checkSummary: checkResult,
    };
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
    const [totalCount, statusCounts, skuAvailableCounts, revenueSummary] =
      await Promise.all([
        ZCode.countDocuments(),
        ZCode.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
        ZCode.aggregate([
          { $match: { status: ZCODE_STATUSES.AVAILABLE } },
          { $group: { _id: '$sku', count: { $sum: 1 } } },
        ]),
        ZCode.aggregate([
          { $match: { finalPrice: { $ne: null } } },
          {
            $group: {
              _id: '$status',
              totalListPrice: { $sum: '$listPrice' },
              totalFinalPrice: { $sum: '$finalPrice' },
              count: { $sum: 1 },
            },
          },
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

    // Revenue stats
    const revenueMap = {};
    for (const r of revenueSummary) {
      revenueMap[r._id] = r;
    }
    const successRevenue = revenueMap[ZCODE_STATUSES.SUCCESS] || {};

    return {
      total: totalCount,
      available: totalAvailable,
      error: totalError,
      success: totalSuccess,
      successRate,
      skuAvailable: skuAvailableMap,
      revenue: {
        totalListPrice: successRevenue.totalListPrice || 0,
        totalFinalPrice: successRevenue.totalFinalPrice || 0,
        totalDiscount:
          (successRevenue.totalListPrice || 0) -
          (successRevenue.totalFinalPrice || 0),
        redeemedCount: successRevenue.count || 0,
      },
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
          filter.$or.push({
            partB: encryptZCodeField(parts[0]),
            partC: encryptZCodeField(parts[1]),
          });
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
        partialCode: partB && partC ? `${partB}-${partC}` : '',
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

    const encPartB = encryptZCodeField(partB);
    const encPartC = encryptZCodeField(partC);

    // Check for duplicate partB-partC among AVAILABLE codes
    const availableCodes = await ZCode.find({
      sku,
      partB: encPartB,
      partC: encPartC,
      status: ZCODE_STATUSES.AVAILABLE,
    }).lean();

    if (availableCodes.length > 1) {
      // Duplicate partB-partC detected — mark all matching codes as ERROR
      const duplicateIds = availableCodes.map((c) => c._id);
      await ZCode.updateMany(
        { _id: { $in: duplicateIds } },
        {
          $set: {
            status: ZCODE_STATUSES.ERROR,
            errorReason: ZCODE_ERROR_REASONS.DUPLICATE_CODE,
            calledAt,
            respondedAt: new Date(),
            callerIp,
          },
        },
      );
      throw createHttpError(
        400,
        'Duplicate codes detected – matching codes have been marked as error',
        {
          code: 'ZCODE_DUPLICATE_CODE',
          duplicateCount: availableCodes.length,
        },
      );
    }

    if (availableCodes.length === 1) {
      // Exactly one available code — redeem it
      const zcode = await ZCode.findOneAndUpdate(
        { _id: availableCodes[0]._id, status: ZCODE_STATUSES.AVAILABLE },
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
        throw createHttpError(
          409,
          'Code was just redeemed by another request',
          {
            code: 'ZCODE_RACE_CONDITION',
          },
        );
      }

      // Calculate response time
      const respondedAt = zcode.respondedAt;
      const diffMs = respondedAt.getTime() - calledAt.getTime();
      const responseTime =
        diffMs < 1000 ? `${diffMs}ms` : `${(diffMs / 1000).toFixed(2)}s`;

      await ZCode.updateOne({ _id: zcode._id }, { $set: { responseTime } });

      return {
        partA: decryptZCodeField(zcode.partA),
        sku: zcode.sku,
        id: zcode.id,
      };
    }

    // No available codes found — check if code exists in other states
    const exists = await ZCode.findOne({
      sku,
      partB: encPartB,
      partC: encPartC,
    }).lean();
    if (exists) {
      let reason, code, statusCode;
      switch (exists.status) {
        case ZCODE_STATUSES.SUCCESS:
          reason = 'Code already redeemed';
          code = 'ZCODE_ALREADY_REDEEMED';
          statusCode = 409; // Conflict
          break;
        case ZCODE_STATUSES.UNAVAILABLE:
          reason = 'Code is unavailable';
          code = 'ZCODE_UNAVAILABLE';
          statusCode = 403; // Forbidden
          break;
        default:
          reason = 'Code is in error state';
          code = 'ZCODE_ERROR_STATE';
          statusCode = 422; // Unprocessable Entity
          break;
      }
      throw createHttpError(statusCode, reason, {
        code,
        currentStatus: exists.status,
      });
    }
    throw createHttpError(404, 'Code not found', {
      code: 'ZCODE_NOT_FOUND',
    });
  }

  // ─── Duplicate Scan (Admin) ─────────────────────────────────────────────────

  /**
   * Find all groups of codes that share the same (partB, partC).
   * Returns groups with >1 member so Admin can review.
   */
  async findDuplicateGroups() {
    const groups = await ZCode.aggregate([
      {
        $group: {
          _id: { partB: '$partB', partC: '$partC' },
          count: { $sum: 1 },
          docs: {
            $push: {
              _id: '$_id',
              id: '$id',
              keyCode: '$keyCode',
              partA: '$partA',
              sku: '$sku',
              status: '$status',
              errorReason: '$errorReason',
              batchDate: '$batchDate',
            },
          },
        },
      },
      { $match: { count: { $gt: 1 } } },
      { $sort: { count: -1 } },
    ]);

    return groups.map((g) => {
      const partB = decryptZCodeField(g._id.partB);
      const partC = decryptZCodeField(g._id.partC);
      return {
        partialCode: `${partB}-${partC}`,
        count: g.count,
        codes: g.docs.map((d) => ({
          id: d.id,
          keyCode: decryptZCodeField(d.keyCode),
          partA: decryptZCodeField(d.partA),
          sku: d.sku,
          status: d.status,
          errorReason: d.errorReason,
          batchDate: d.batchDate,
        })),
      };
    });
  }

  /**
   * Mark selected ZCode IDs as ERROR with reason DUPLICATE_CODE.
   * Skips codes already in SUCCESS status.
   * @param {string[]} ids - Array of ZCode `id` values
   * @returns {{ markedCount: number, skippedCount: number }}
   */
  async markDuplicates(ids) {
    if (!ids || ids.length === 0) {
      throw createHttpError(400, 'Danh sách mã cần đánh dấu không được rỗng');
    }

    const result = await ZCode.updateMany(
      {
        id: { $in: ids },
        status: { $ne: ZCODE_STATUSES.SUCCESS },
      },
      {
        $set: {
          status: ZCODE_STATUSES.ERROR,
          errorReason: ZCODE_ERROR_REASONS.DUPLICATE_CODE,
        },
      },
    );

    return {
      markedCount: result.modifiedCount,
      skippedCount: ids.length - result.modifiedCount,
    };
  }

  // ─── Delete Operations ─────────────────────────────────────────────────────

  /**
   * Delete a batch of ZCodes. Skips codes in SUCCESS status.
   * @param {string} batchDate
   * @param {string} importedAt
   * @param {string} [sku]
   * @returns {Promise<{ deletedCount: number }>}
   */
  async deleteBatch(batchDate, importedAt, sku) {
    const query = {
      batchDate: new Date(batchDate),
      importedAt: new Date(importedAt),
      status: { $ne: ZCODE_STATUSES.SUCCESS },
    };
    if (sku) {
      query.sku = sku;
    }

    const result = await ZCode.deleteMany(query);
    return { deletedCount: result.deletedCount };
  }

  /**
   * Check list of ZCodes before deleting.
   * @param {string} listCode
   * @returns {Promise<any>}
   */
  async checkDeleteList(listCode) {
    const keyCodes = this._parseKeyCodes(listCode);
    if (keyCodes.length === 0) {
      throw createHttpError(400, 'Danh sách mã Key rỗng sau khi parse');
    }
    if (keyCodes.length > ZCODE_MAX_CODES_PER_REQUEST) {
      throw createHttpError(
        400,
        `Chỉ được phép xoá tối đa ${ZCODE_MAX_CODES_PER_REQUEST} mã mỗi lần (bạn đã nhập ${keyCodes.length} mã)`,
      );
    }

    const uniqueKeys = [...new Set(keyCodes)];
    const duplicatesInInput = keyCodes.filter(
      (k, i) => keyCodes.indexOf(k) !== i,
    );
    const uniqueDuplicates = [...new Set(duplicatesInInput)];

    const existingCodes = await ZCode.find({
      keyCode: { $in: uniqueKeys.map(encryptZCodeField) },
    }).lean();

    const existingKeyCodes = existingCodes.map((c) =>
      decryptZCodeField(c.keyCode),
    );
    const notFound = uniqueKeys.filter((k) => !existingKeyCodes.includes(k));

    const validCodes = [];
    const invalidCodes = [];

    existingCodes.forEach((code) => {
      const keyCodeStr = decryptZCodeField(code.keyCode);
      if (code.status === ZCODE_STATUSES.SUCCESS) {
        invalidCodes.push({
          keyCode: keyCodeStr,
          reason: 'Mã đã được sử dụng thành công - Không thể xoá',
          currentStatus: code.status,
        });
      } else {
        validCodes.push({
          id: code.id,
          keyCode: keyCodeStr,
          sku: code.sku,
          currentStatus: code.status,
        });
      }
    });

    // Group valid codes by sku
    const groupedBySkuMap = {};
    validCodes.forEach((c) => {
      if (!groupedBySkuMap[c.sku])
        groupedBySkuMap[c.sku] = { sku: c.sku, count: 0, codes: [] };
      groupedBySkuMap[c.sku].count += 1;
      groupedBySkuMap[c.sku].codes.push(c);
    });
    const validGroupedBySku = Object.values(groupedBySkuMap);

    return {
      totalInput: keyCodes.length,
      uniqueInput: uniqueKeys.length,
      duplicatesInInput: uniqueDuplicates,
      notFound,
      validCodes,
      validGroupedBySku,
      invalidCodes,
    };
  }

  /**
   * Delete a list of ZCodes by key codes. Skips codes in SUCCESS status.
   * Max 1000 codes allowed.
   * @param {string} listCode
   * @returns {Promise<{ deletedCount: number, notFoundOrSuccessCount: number }>}
   */
  async deleteList(listCode) {
    const keyCodes = this._parseKeyCodes(listCode);
    if (keyCodes.length === 0) {
      throw createHttpError(400, 'Danh sách mã Key rỗng sau khi parse');
    }
    if (keyCodes.length > 1000) {
      throw createHttpError(
        400,
        `Chỉ được phép xoá tối đa 1000 mã mỗi lần (bạn đã nhập ${keyCodes.length} mã)`,
      );
    }

    const uniqueKeys = [...new Set(keyCodes)];
    const encryptedKeys = uniqueKeys.map(encryptZCodeField);

    const result = await ZCode.deleteMany({
      keyCode: { $in: encryptedKeys },
      status: { $ne: ZCODE_STATUSES.SUCCESS },
    });

    return {
      deletedCount: result.deletedCount,
      notFoundOrSuccessCount: uniqueKeys.length - result.deletedCount,
    };
  }

  /**
   * Delete a single ZCode by ID.
   * @param {string} id
   * @returns {Promise<{ deleted: boolean }>}
   */
  async deleteById(id) {
    const zcode = await ZCode.findOne({ id });
    if (!zcode) {
      throw createHttpError(404, 'Không tìm thấy mã ZCode');
    }

    if (zcode.status === ZCODE_STATUSES.SUCCESS) {
      throw createHttpError(
        400,
        'Không thể xoá mã ZCode đã được sử dụng thành công (SUCCESS)',
      );
    }

    await ZCode.deleteOne({ id });
    return { deleted: true };
  }
}

module.exports = new ZCodeService();
