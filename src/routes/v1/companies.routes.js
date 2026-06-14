const express = require("express");
const router = express.Router();
const companyController = require('../../modules/hr/company/company.controller');
const { requirePermission } = require('../../core/middleware/auth');
const { PERMISSIONS } = require('../../core/constants/rbac');

// Các endpoints được bảo vệ bởi authenticateRequest ở router gốc

router.get(
  "/",
  requirePermission(PERMISSIONS.COMPANIES_READ),
  companyController.getCompanies.bind(companyController)
);

router.get(
  "/:id",
  requirePermission(PERMISSIONS.COMPANIES_READ),
  companyController.getCompanyById.bind(companyController)
);

router.post(
  "/",
  requirePermission(PERMISSIONS.COMPANIES_CREATE),
  companyController.createCompany.bind(companyController)
);

router.put(
  "/:id",
  requirePermission(PERMISSIONS.COMPANIES_UPDATE),
  companyController.updateCompany.bind(companyController)
);

router.delete(
  "/:id",
  requirePermission(PERMISSIONS.COMPANIES_DELETE),
  companyController.deleteCompany.bind(companyController)
);

module.exports = router;
