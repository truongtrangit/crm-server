const express = require("express");
const { requirePermission } = require('../../core/middleware/auth');
const { PERMISSIONS } = require('../../core/constants/rbac');
const MetadataController = require('../../modules/system/metadata/metadata.controller');

const router = express.Router();

// Metadata is shared for all authenticated users to populate dropdowns

router.get("/", MetadataController.getMetadata);
router.get("/roles", MetadataController.getRoles);
router.get("/departments", MetadataController.getDepartments);
router.get("/department-groups", MetadataController.getDepartmentGroups);
router.get("/activity-groups", MetadataController.getActivityGroups);
router.get("/customer-groups", MetadataController.getCustomerGroups);

module.exports = router;
