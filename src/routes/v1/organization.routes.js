const express = require("express");
const { requirePermission } = require('../../core/middleware/auth');
const validate = require('../../core/middleware/validate');
const { PERMISSIONS } = require('../../core/constants/rbac');
const OrganizationController = require('../../modules/hr/organization/organization.controller');
const {
  createDepartmentSchema,
  createGroupSchema,
} = require('../../modules/hr/organization/organization.validation');

const router = express.Router();

router.get(
  "/",
  requirePermission(PERMISSIONS.ORGANIZATION_READ),
  OrganizationController.getOrganizations
);

router.post(
  "/departments",
  requirePermission(PERMISSIONS.ORGANIZATION_UPDATE),
  validate(createDepartmentSchema),
  OrganizationController.createDepartment
);

router.post(
  "/groups",
  requirePermission(PERMISSIONS.ORGANIZATION_UPDATE),
  validate(createGroupSchema),
  OrganizationController.createGroup
);

module.exports = router;
