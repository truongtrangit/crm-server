const express = require("express");
const { requirePermission } = require("../../middleware/auth");
const validate = require("../../middleware/validate");
const { PERMISSIONS } = require("../../constants/rbac");
const OrganizationController = require("../../controllers/OrganizationController");
const {
  createDepartmentSchema,
  createGroupSchema,
} = require("../../validations/organization");

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
