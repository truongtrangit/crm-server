const express = require("express");
const { requirePermission } = require('../../core/middleware/auth');
const validate = require('../../core/middleware/validate');
const { PERMISSIONS } = require('../../core/constants/rbac');
const StaffController = require('../../modules/hr/staff/staff.controller');
const {
  createStaffSchema,
  updateStaffSchema,
  getStaffsQuerySchema,
} = require('../../modules/hr/staff/staffs.validation');

const router = express.Router();

router.get(
  "/",
  requirePermission(PERMISSIONS.STAFFS_READ),
  validate(getStaffsQuerySchema, "query"),
  StaffController.getStaffs
);

router.post(
  "/",
  requirePermission(PERMISSIONS.STAFFS_CREATE),
  validate(createStaffSchema),
  StaffController.createStaff
);

router.get(
  "/:staffId",
  requirePermission(PERMISSIONS.STAFFS_READ),
  StaffController.getStaff
);

router.put(
  "/:staffId",
  requirePermission(PERMISSIONS.STAFFS_UPDATE),
  validate(updateStaffSchema),
  StaffController.updateStaff
);

router.delete(
  "/:staffId",
  requirePermission(PERMISSIONS.STAFFS_DELETE),
  StaffController.deleteStaff
);


module.exports = router;
