const express = require("express");
const { requirePermission } = require('../../core/middleware/auth');
const { PERMISSIONS } = require('../../core/constants/rbac');
const MetadataController = require('../../modules/system/metadata/metadata.controller');

const router = express.Router();

// Metadata is shared for all authenticated users to populate dropdowns

router.get("/", requirePermission(PERMISSIONS.METADATA_READ), MetadataController.getMetadata);
router.get("/roles", requirePermission(PERMISSIONS.METADATA_READ), MetadataController.getRoles);
router.get("/departments", requirePermission(PERMISSIONS.METADATA_READ), MetadataController.getDepartments);
router.get("/department-groups", requirePermission(PERMISSIONS.METADATA_READ), MetadataController.getDepartmentGroups);
router.get("/activity-groups", requirePermission(PERMISSIONS.METADATA_READ), MetadataController.getActivityGroups);
router.get("/customer-groups", requirePermission(PERMISSIONS.METADATA_READ), MetadataController.getCustomerGroups);

module.exports = router;
