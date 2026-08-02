const zcodeService = require('./zcode.service');
const { sendSuccess, createHttpError } = require('../../core/utils/http');
const SystemLogService = require('../system/log/systemLog.service');
const { RESOURCES } = require('../../core/constants/rbac');
const { saveIdempotencyResult } = require('../../core/middleware/zcodeSecurityAuth');
const { getVietnamTime } = require('../../core/utils/date');
const {
  createZCodesSchema,
  updateStatusSchema,
  bulkStatusCheckSchema,
  bulkStatusUpdateSchema,
  checkDuplicatesSchema,
  redeemCodeSchema,
  markDuplicatesSchema,
  deleteBatchSchema,
  deleteListSchema,
} = require('./zcode.validation');

class ZCodeController {
  // ─── List & Detail ─────────────────────────────────────────────────────────

  async getZCodes(req, res) {
    const result = await zcodeService.getZCodes(req.query);
    return sendSuccess(res, 200, 'Lấy danh sách mã ZCode thành công', result);
  }

  async getZCodeBatches(req, res) {
    const result = await zcodeService.getZCodeBatches(req.query);
    return sendSuccess(res, 200, 'Lấy danh sách lô mã ZCode thành công', result);
  }

  async getBatchStats(req, res) {
    const result = await zcodeService.getZCodeBatchStats(req.query);
    return sendSuccess(res, 200, 'Lấy thống kê lô ZCode thành công', result);
  }

  async getZCodeById(req, res) {
    const zcode = await zcodeService.getZCodeById(req.params.id);
    return sendSuccess(res, 200, 'Lấy chi tiết mã ZCode thành công', zcode);
  }

  // ─── Batch Create ──────────────────────────────────────────────────────────

  async createZCodes(req, res) {
    const { error, value } = createZCodesSchema.validate(req.body);
    if (error) {
      throw createHttpError(400, error.details[0].message);
    }

    const result = await zcodeService.createZCodes(value, req.user?.id);

    const skusString = result.skus.join(', ');

    SystemLogService.log({
      action: 'create',
      resource: RESOURCES.ZCODES,
      resourceId: null,
      resourceName: `Batch ${result.count} mã (SKU: ${skusString})`,
      description: `Nhập lô ${result.count} mã ZCode (Gồm các SKU: ${skusString})`,
      metadata: {
        count: result.count,
        skus: result.skus,
      },
      req,
    });

    return sendSuccess(
      res,
      200,
      `Nhập thành công ${result.count} mã ZCode`,
      result,
    );
  }

  // ─── Check Duplicates ──────────────────────────────────────────────────────

  async checkDuplicates(req, res) {
    const { error, value } = checkDuplicatesSchema.validate(req.body);
    if (error) {
      throw createHttpError(400, error.details[0].message);
    }

    const result = await zcodeService.checkDuplicates(value.keys);
    return sendSuccess(res, 200, 'Kiểm tra trùng mã thành công', result);
  }

  // ─── Status Management ─────────────────────────────────────────────────────

  async updateStatus(req, res) {
    const { error, value } = updateStatusSchema.validate(req.body);
    if (error) {
      throw createHttpError(400, error.details[0].message);
    }

    const { zcode, oldStatus } = await zcodeService.updateStatus(
      req.params.id,
      value.status,
    );

    SystemLogService.log({
      action: 'update',
      resource: RESOURCES.ZCODES,
      resourceId: zcode.id,
      resourceName: zcode.keyCode,
      description: `Đổi trạng thái mã ZCode "${zcode.keyCode}": ${oldStatus} → ${value.status}`,
      metadata: { oldStatus, newStatus: value.status },
      req,
    });

    return sendSuccess(res, 200, 'Cập nhật trạng thái thành công', zcode);
  }

  async checkBulkStatus(req, res) {
    const { error, value } = bulkStatusCheckSchema.validate(req.body);
    if (error) {
      throw createHttpError(400, error.details[0].message);
    }

    const result = await zcodeService.checkBulkStatus(value);
    return sendSuccess(res, 200, 'Kiểm tra cập nhật hàng loạt thành công', result);
  }

  async updateBulkStatus(req, res) {
    const { error, value } = bulkStatusUpdateSchema.validate(req.body);
    if (error) {
      throw createHttpError(400, error.details[0].message);
    }

    const result = await zcodeService.updateBulkStatus(value, req.user?.id, req);

    SystemLogService.log({
      action: 'update',
      resource: RESOURCES.ZCODES,
      resourceId: null,
      resourceName: `Cập nhật trạng thái ${result.updatedCount} mã`,
      description: `Cập nhật trạng thái hàng loạt ${result.updatedCount} mã ZCode thành "${value.targetStatus}" (Ghi chú: ${value.note || 'Không có'})`,
      metadata: { targetStatus: value.targetStatus, note: value.note, updatedCount: result.updatedCount },
      req,
    });

    return sendSuccess(res, 200, `Cập nhật thành công ${result.updatedCount} mã`, result);
  }

  async retryZCode(req, res) {
    const zcode = await zcodeService.retryZCode(req.params.id);

    SystemLogService.log({
      action: 'update',
      resource: RESOURCES.ZCODES,
      resourceId: zcode.id,
      resourceName: zcode.keyCode,
      description: `Retry mã ZCode "${zcode.keyCode}" — reset về trạng thái khả dụng`,
      metadata: { retried: true },
      req,
    });

    return sendSuccess(res, 200, 'Retry mã ZCode thành công', zcode);
  }

  // ─── Stats ─────────────────────────────────────────────────────────────────

  async getStats(req, res) {
    const stats = await zcodeService.getStats();
    return sendSuccess(res, 200, 'Lấy thống kê ZCode thành công', stats);
  }

  // ─── SKU Prices ─────────────────────────────────────────────────────────────

  async getSkuPrices(req, res) {
    const prices = zcodeService.getSkuPrices();
    return sendSuccess(res, 200, 'Lấy giá niêm yết SKU thành công', prices);
  }

  // ─── Export ────────────────────────────────────────────────────────────────

  async exportZCodes(req, res) {
    const ExcelJS = require('exceljs');

    const items = await zcodeService.exportZCodes(req.query);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('ZCode');

    sheet.columns = [
      { header: 'Mã', key: 'id', width: 12 },
      { header: 'Key Code', key: 'keyCode', width: 25 },
      { header: 'SKU', key: 'sku', width: 12 },
      { header: 'Trạng thái', key: 'status', width: 15 },
      { header: 'Giá niêm yết', key: 'listPrice', width: 16 },
      { header: 'Loại điều chỉnh', key: 'priceAdjustmentType', width: 18 },
      { header: 'Giá trị điều chỉnh', key: 'priceAdjustmentValue', width: 18 },
      { header: 'Giá bán', key: 'finalPrice', width: 16 },
      { header: 'Lô ngày', key: 'batchDate', width: 15 },
      { header: 'Ngày nhập', key: 'importedAt', width: 20 },
      { header: 'Thời gian gọi', key: 'calledAt', width: 20 },
      { header: 'Thời gian phản hồi', key: 'respondedAt', width: 20 },
      { header: 'Response Time', key: 'responseTime', width: 14 },
      { header: 'IP gọi', key: 'callerIp', width: 18 },
      { header: 'Lý do lỗi', key: 'errorReason', width: 16 },
    ];

    // Style header
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E7FF' },
    };

    for (const item of items) {
      sheet.addRow({
        id: item.id,
        keyCode: item.keyCode,
        sku: item.sku,
        status: item.status,
        listPrice: item.listPrice,
        priceAdjustmentType: item.priceAdjustmentType,
        priceAdjustmentValue: item.priceAdjustmentValue,
        finalPrice: item.finalPrice,
        batchDate: item.batchDate,
        importedAt: item.importedAt,
        calledAt: item.calledAt,
        respondedAt: item.respondedAt,
        responseTime: item.responseTime,
        callerIp: item.callerIp,
        errorReason: item.errorReason,
      });
    }

    SystemLogService.log({
      action: 'export',
      resource: RESOURCES.ZCODES,
      resourceId: null,
      resourceName: `Export ${items.length} mã ZCode`,
      description: `Xuất Excel ${items.length} mã ZCode`,
      metadata: { count: items.length },
      req,
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=zcodes_${Date.now()}.xlsx`,
    );
    await workbook.xlsx.write(res);
    res.end();
  }

  // ─── External API: Redeem ──────────────────────────────────────────────────

  async redeemCode(req, res) {
    const { error, value } = redeemCodeSchema.validate(req.body);
    if (error) {
      throw createHttpError(400, error.details[0].message);
    }

    const callerIp =
      req.headers['cf-connecting-ip'] ||
      (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
      req.ip ||
      req.socket?.remoteAddress ||
      '';
    const result = await zcodeService.redeemCode(
      value.sku,
      value.partialCode,
      callerIp,
    );

    SystemLogService.log({
      action: 'redeem',
      resource: RESOURCES.ZCODES,
      resourceId: result.id,
      resourceName: `${result.sku}-${value.partialCode}`,
      description: `Hệ thống B redeem mã ZCode "${result.id}" (SKU: ${result.sku}, IP: ${callerIp})`,
      metadata: { sku: result.sku, partialCode: value.partialCode, callerIp },
      req,
    });

    const responseData = {
      partA: result.partA,
      sku: result.sku,
    };

    // Save idempotency cache (fire-and-forget)
    const idempotencyKey = req.zcodeSecurityContext?.idempotencyKey;
    if (idempotencyKey) {
      saveIdempotencyResult(idempotencyKey, 200, {
        success: true,
        message: 'Redeem successful',
        data: responseData,
      });
    }

    return sendSuccess(res, 200, 'Redeem successful', responseData);
  }

  // ─── Duplicate Scan (Admin) ────────────────────────────────────────────────

  async findDuplicateGroups(req, res) {
    const groups = await zcodeService.findDuplicateGroups();
    return sendSuccess(res, 200, 'Quét mã trùng lặp thành công', {
      totalGroups: groups.length,
      groups,
    });
  }

  async markDuplicates(req, res) {
    const { error, value } = markDuplicatesSchema.validate(req.body);
    if (error) {
      throw createHttpError(400, error.details[0].message);
    }

    const result = await zcodeService.markDuplicates(value.ids);

    SystemLogService.log({
      action: 'update',
      resource: RESOURCES.ZCODES,
      resourceId: null,
      resourceName: `Đánh dấu ${result.markedCount} mã trùng lặp`,
      description: `Admin đánh dấu ${result.markedCount} mã ZCode là trùng lặp (bỏ qua ${result.skippedCount} mã đã SUCCESS)`,
      metadata: { ids: value.ids, ...result },
      req,
    });

    return sendSuccess(res, 200, `Đã đánh dấu ${result.markedCount} mã trùng lặp`, result);
  }

  // ─── Delete Operations ─────────────────────────────────────────────────────

  async deleteBatch(req, res) {
    const { error, value } = deleteBatchSchema.validate(req.body);
    if (error) {
      throw createHttpError(400, error.details[0].message);
    }

    const result = await zcodeService.deleteBatch(
      value.batchDate,
      value.importedAt,
      value.sku
    );

    const batchDateStr = getVietnamTime(value.batchDate).format('DD/MM/YYYY');
    const importedAtStr = getVietnamTime(value.importedAt).format('DD/MM/YYYY HH:mm:ss');

    SystemLogService.log({
      action: 'delete',
      resource: RESOURCES.ZCODES,
      resourceId: null,
      resourceName: `Lô ngày ${batchDateStr}`,
      description: `Xoá lô ZCode ngày ${batchDateStr} (Nhập lúc: ${importedAtStr}). Đã xoá: ${result.deletedCount} mã.`,
      metadata: { ...value, result },
      req,
    });

    return sendSuccess(res, 200, `Đã xoá ${result.deletedCount} mã ZCode trong lô`, result);
  }

  async checkDeleteList(req, res) {
    const { error, value } = deleteListSchema.validate(req.body);
    if (error) {
      throw createHttpError(400, error.details[0].message);
    }

    const result = await zcodeService.checkDeleteList(value.listCode);
    return sendSuccess(res, 200, 'Kiểm tra danh sách xoá thành công', result);
  }

  async deleteList(req, res) {
    const { error, value } = deleteListSchema.validate(req.body);
    if (error) {
      throw createHttpError(400, error.details[0].message);
    }

    const result = await zcodeService.deleteList(value.listCode);

    SystemLogService.log({
      action: 'delete',
      resource: RESOURCES.ZCODES,
      resourceId: null,
      resourceName: 'Danh sách mã ZCode',
      description: `Xoá danh sách mã ZCode. Đã xoá: ${result.deletedCount} mã (Bỏ qua ${result.notFoundOrSuccessCount} mã không tìm thấy hoặc đã sử dụng).`,
      metadata: { result },
      req,
    });

    return sendSuccess(
      res,
      200,
      `Đã xoá ${result.deletedCount} mã ZCode (Bỏ qua ${result.notFoundOrSuccessCount} mã)`,
      result
    );
  }

  async deleteZCode(req, res) {
    await zcodeService.deleteById(req.params.id);

    SystemLogService.log({
      action: 'delete',
      resource: RESOURCES.ZCODES,
      resourceId: req.params.id,
      resourceName: req.params.id,
      description: `Xoá mã ZCode ID: ${req.params.id}`,
      metadata: {},
      req,
    });

    return sendSuccess(res, 200, 'Xoá mã ZCode thành công', { id: req.params.id });
  }
}

module.exports = new ZCodeController();
