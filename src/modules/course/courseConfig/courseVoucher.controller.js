const courseVoucherService = require("./courseVoucher.service");
const SystemLogService = require("../../system/log/systemLog.service");
const { sendSuccess } = require("../../../core/utils/http");

class CourseVoucherController {
  createVoucher = async (req, res) => {
    const adminId = req.user.id || req.user._id; // Depending on how auth sets user
    const voucher = await courseVoucherService.createVoucher(req.body, adminId);

    SystemLogService.log({
      action: "create",
      resource: "courses",
      resourceId: voucher._id,
      resourceName: voucher.code,
      description: `Tạo voucher mới: ${voucher.code}`,
      req,
    });

    return sendSuccess(res, 201, "Tạo voucher thành công", voucher);
  };

  bulkCreateVouchers = async (req, res) => {
    const adminId = req.user.id || req.user._id;
    const result = await courseVoucherService.bulkCreateVouchers(
      req.body,
      adminId,
    );

    SystemLogService.log({
      action: "create",
      resource: "courses",
      resourceId: `batch-${req.body.batch}`,
      resourceName: `Batch ${req.body.batch}`,
      description: `Tạo hàng loạt ${result.count} voucher (Batch: ${req.body.batch})`,
      req,
    });

    return sendSuccess(res, 201, "Tạo voucher hàng loạt thành công", result);
  };

  getVouchers = async (req, res) => {
    const result = await courseVoucherService.getVouchers(req.query);
    return sendSuccess(res, 200, "Lấy danh sách voucher thành công", result);
  };

  getVoucherBatches = async (req, res) => {
    const result = await courseVoucherService.getVoucherBatches(req.query);
    return sendSuccess(
      res,
      200,
      "Lấy danh sách đợt voucher thành công",
      result,
    );
  };

  deleteVoucher = async (req, res) => {
    await courseVoucherService.deleteVoucher(req.params.id);

    SystemLogService.log({
      action: "delete",
      resource: "courses",
      resourceId: req.params.id,
      description: `Xóa voucher ID ${req.params.id}`,
      req,
    });

    return sendSuccess(res, 200, "Xóa voucher thành công");
  };

  deleteVouchersByBatch = async (req, res) => {
    const { batch } = req.query;
    const result = await courseVoucherService.deleteVouchersByBatch(batch);

    SystemLogService.log({
      action: "delete",
      resource: "courses",
      resourceId: `batch-${batch}`,
      description: `Xóa hàng loạt ${result.deletedCount} voucher thuộc batch ${batch}`,
      req,
    });

    return sendSuccess(res, 200, "Xóa voucher hàng loạt thành công", result);
  };

  updateVoucherStatus = async (req, res) => {
    const { status } = req.body;
    const voucher = await courseVoucherService.updateVoucherStatus(
      req.params.id,
      status,
    );

    SystemLogService.log({
      action: "update",
      resource: "courses",
      resourceId: voucher._id,
      resourceName: voucher.code,
      description: `Cập nhật trạng thái voucher ${voucher.code} thành ${status}`,
      req,
    });

    return sendSuccess(res, 200, "Cập nhật trạng thái thành công", voucher);
  };

  updateBatchStatus = async (req, res) => {
    const { batch, status } = req.body;
    const result = await courseVoucherService.updateBatchStatus(batch, status);

    SystemLogService.log({
      action: "update",
      resource: "courses",
      resourceId: `batch-${batch}`,
      resourceName: `Batch ${batch}`,
      description: `Cập nhật trạng thái hàng loạt ${result.modifiedCount} voucher thuộc batch ${batch} thành ${status}`,
      req,
    });

    return sendSuccess(
      res,
      200,
      "Cập nhật trạng thái batch thành công",
      result,
    );
  };
}

module.exports = new CourseVoucherController();
