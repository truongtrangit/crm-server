const express = require("express");
const { requirePermission } = require('../../core/middleware/auth');
const validate = require('../../core/middleware/validate');
const { PERMISSIONS } = require('../../core/constants/rbac');
const StaffController = require('../../modules/hr/staff/staff.controller');
const { addSalaryConfigSchema } = require('../../modules/hr/staff/staffs.validation');

const router = express.Router();

router.post(
  "/",
  requirePermission(PERMISSIONS.SALARY_CONFIGS_MANAGE),
  validate(addSalaryConfigSchema),
  StaffController.addSalaryConfig
);

module.exports = router;
