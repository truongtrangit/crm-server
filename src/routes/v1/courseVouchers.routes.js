const { Router } = require("express");
const courseVoucherController = require("../../modules/course/courseConfig/courseVoucher.controller");
const validate = require("../../core/middleware/validate");
const courseVoucherValidation = require("../../modules/course/courseConfig/courseVoucher.validation");
const { requirePermission } = require("../../core/middleware/auth");
const { PERMISSIONS } = require("../../core/constants/rbac");

const courseVouchersRouter = Router();

// /api/v1/courses/vouchers
courseVouchersRouter.get(
  "/",
  requirePermission(PERMISSIONS.COURSE_CONFIG_READ),
  validate(courseVoucherValidation.getVouchers, "query"),
  courseVoucherController.getVouchers,
);
courseVouchersRouter.get(
  "/batches",
  requirePermission(PERMISSIONS.COURSE_CONFIG_READ),
  courseVoucherController.getVoucherBatches,
);
courseVouchersRouter.post(
  "/",
  requirePermission(PERMISSIONS.COURSE_CONFIG_CREATE),
  validate(courseVoucherValidation.createVoucher, "body"),
  courseVoucherController.createVoucher,
);
courseVouchersRouter.post(
  "/bulk",
  requirePermission(PERMISSIONS.COURSE_CONFIG_CREATE),
  validate(courseVoucherValidation.bulkCreateVouchers, "body"),
  courseVoucherController.bulkCreateVouchers,
);
courseVouchersRouter.delete(
  "/batch",
  requirePermission(PERMISSIONS.COURSE_CONFIG_DELETE),
  validate(courseVoucherValidation.deleteVouchersByBatch, "query"),
  courseVoucherController.deleteVouchersByBatch,
);
courseVouchersRouter.delete(
  "/:id",
  requirePermission(PERMISSIONS.COURSE_CONFIG_DELETE),
  courseVoucherController.deleteVoucher,
);
courseVouchersRouter.patch(
  "/batch/status",
  requirePermission(PERMISSIONS.COURSE_CONFIG_UPDATE),
  validate(courseVoucherValidation.updateBatchStatus, "body"),
  courseVoucherController.updateBatchStatus,
);
courseVouchersRouter.patch(
  "/:id/status",
  requirePermission(PERMISSIONS.COURSE_CONFIG_UPDATE),
  validate(courseVoucherValidation.updateVoucherStatus, "body"),
  courseVoucherController.updateVoucherStatus,
);

module.exports = courseVouchersRouter;
