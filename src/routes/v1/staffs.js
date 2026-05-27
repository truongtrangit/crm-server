const express = require("express");
const { requirePermission } = require("../../middleware/auth");
const validate = require("../../middleware/validate");
const { PERMISSIONS } = require("../../constants/rbac");
const StaffController = require("../../controllers/StaffController");
const {
  createStaffSchema,
  updateStaffSchema,
  getStaffsQuerySchema,
  salaryConfigSchema,
} = require("../../validations/staffs");

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

router.post(
  "/:staffId/salary-config",
  requirePermission(PERMISSIONS.STAFFS_MANAGE),
  validate(salaryConfigSchema),
  StaffController.addSalaryConfig
);

module.exports = router;
