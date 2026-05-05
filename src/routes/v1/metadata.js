const express = require("express");
const { requirePermission } = require("../../middleware/auth");
const { PERMISSIONS } = require("../../constants/rbac");
const MetadataController = require("../../controllers/MetadataController");

const router = express.Router();

router.use(requirePermission(PERMISSIONS.METADATA_READ));

router.get("/", MetadataController.getMetadata);
router.get("/roles", MetadataController.getRoles);
router.get("/departments", MetadataController.getDepartments);
router.get("/department-groups", MetadataController.getDepartmentGroups);
router.get("/activity-groups", MetadataController.getActivityGroups);
router.get("/customer-groups", MetadataController.getCustomerGroups);

module.exports = router;
