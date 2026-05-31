const express = require("express");
const router = express.Router();
const FinanceController = require("../../controllers/FinanceController");
const { requirePermission } = require("../../middleware/auth");
const { PERMISSIONS } = require("../../constants/rbac");

router.get("/dashboard", requirePermission(PERMISSIONS.FINANCE_READ), FinanceController.getDashboard);

module.exports = router;
