const express = require("express");
const router = express.Router();
const LeadConfigController = require("../../controllers/LeadConfigController");
const { requirePermission } = require("../../middleware/auth");
const { PERMISSIONS } = require("../../constants/rbac");

// GET routes: anyone with LEADS_READ can read config (needed for Kanban board rendering)
router.get("/statuses", requirePermission(PERMISSIONS.LEADS_READ), LeadConfigController.getStatuses);
router.get("/groups", requirePermission(PERMISSIONS.LEADS_READ), LeadConfigController.getGroups);

// Mutation routes: only LEADS_CFG_MANAGE (Admin/Owner)
router.post("/statuses", requirePermission(PERMISSIONS.LEADS_CFG_MANAGE), LeadConfigController.createStatus);
router.put("/statuses/:id", requirePermission(PERMISSIONS.LEADS_CFG_MANAGE), LeadConfigController.updateStatus);
router.delete("/statuses/:id", requirePermission(PERMISSIONS.LEADS_CFG_MANAGE), LeadConfigController.deleteStatus);

router.post("/groups", requirePermission(PERMISSIONS.LEADS_CFG_MANAGE), LeadConfigController.createGroup);
router.put("/groups/:id", requirePermission(PERMISSIONS.LEADS_CFG_MANAGE), LeadConfigController.updateGroup);
router.delete("/groups/:id", requirePermission(PERMISSIONS.LEADS_CFG_MANAGE), LeadConfigController.deleteGroup);

module.exports = router;
