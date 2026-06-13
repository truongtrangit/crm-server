const express = require("express");
const router = express.Router();
const FinanceController = require('../../modules/finance/finance/finance.controller');
const { requirePermission } = require('../../core/middleware/auth');
const { PERMISSIONS } = require('../../core/constants/rbac');

router.get("/dashboard", requirePermission(PERMISSIONS.FINANCE_READ), FinanceController.getDashboard);

module.exports = router;
