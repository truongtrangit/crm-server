const express = require("express");
const router = express.Router();
const LeadConfigController = require("../../controllers/LeadConfigController");
const { authenticateRequest, requirePermission } = require("../../middleware/auth");
const { PERMISSIONS } = require("../../constants/rbac");

router.use(authenticateRequest);
router.use(requirePermission(PERMISSIONS.LEADS_CFG_MANAGE));

// Lead Statuses
router.get("/statuses", LeadConfigController.getStatuses);
router.post("/statuses", LeadConfigController.createStatus);
router.put("/statuses/:id", LeadConfigController.updateStatus);
router.delete("/statuses/:id", LeadConfigController.deleteStatus);

// Lead Status Groups
router.get("/groups", LeadConfigController.getGroups);
router.post("/groups", LeadConfigController.createGroup);
router.put("/groups/:id", LeadConfigController.updateGroup);
router.delete("/groups/:id", LeadConfigController.deleteGroup);

module.exports = router;
