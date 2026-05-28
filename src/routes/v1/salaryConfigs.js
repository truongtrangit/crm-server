const express = require("express");
const { requirePermission } = require("../../middleware/auth");
const validate = require("../../middleware/validate");
const { PERMISSIONS } = require("../../constants/rbac");
const StaffController = require("../../controllers/StaffController");
const { addSalaryConfigSchema } = require("../../validations/staffs");

const router = express.Router();

router.post(
  "/",
  requirePermission(PERMISSIONS.SALARY_CONFIGS_MANAGE),
  validate(addSalaryConfigSchema),
  StaffController.addSalaryConfig
);

module.exports = router;
