const { Router } = require("express");
const courseVoucherController = require("../../modules/course/courseConfig/courseVoucher.controller");
const validate = require("../../core/middleware/validate");
const courseVoucherValidation = require("../../modules/course/courseConfig/courseVoucher.validation");

const courseVouchersRouter = Router();

// /api/v1/courses/vouchers
courseVouchersRouter.get(
  "/",
  validate(courseVoucherValidation.getVouchers, "query"),
  courseVoucherController.getVouchers,
);
courseVouchersRouter.post(
  "/",
  validate(courseVoucherValidation.createVoucher, "body"),
  courseVoucherController.createVoucher,
);
courseVouchersRouter.post(
  "/bulk",
  validate(courseVoucherValidation.bulkCreateVouchers, "body"),
  courseVoucherController.bulkCreateVouchers,
);
courseVouchersRouter.delete(
  "/batch",
  validate(courseVoucherValidation.deleteVouchersByBatch, "query"),
  courseVoucherController.deleteVouchersByBatch,
);
courseVouchersRouter.delete("/:id", courseVoucherController.deleteVoucher);
courseVouchersRouter.patch(
  "/:id/status",
  validate(courseVoucherValidation.updateVoucherStatus, "body"),
  courseVoucherController.updateVoucherStatus,
);

module.exports = courseVouchersRouter;
