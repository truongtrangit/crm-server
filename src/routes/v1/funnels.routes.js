const { Router } = require("express");
const FunnelController = require('../../modules/lead/funnel/funnel.controller');
const { requirePermission } = require('../../core/middleware/auth');
const { PERMISSIONS } = require('../../core/constants/rbac');

const router = Router();

// Thư mục
router.get("/folders", requirePermission(PERMISSIONS.LEADS_CFG_MANAGE), FunnelController.getFolders);
router.post("/folders", requirePermission(PERMISSIONS.LEADS_CFG_MANAGE), FunnelController.createFolder);
router.put("/folders/:id", requirePermission(PERMISSIONS.LEADS_CFG_MANAGE), FunnelController.updateFolder);
router.delete("/folders/:id", requirePermission(PERMISSIONS.LEADS_CFG_MANAGE), FunnelController.deleteFolder);

// Nhóm phễu
router.get("/groups", requirePermission(PERMISSIONS.LEADS_CFG_MANAGE), FunnelController.getGroups);
router.post("/groups", requirePermission(PERMISSIONS.LEADS_CFG_MANAGE), FunnelController.createGroup);
router.put("/groups/:id", requirePermission(PERMISSIONS.LEADS_CFG_MANAGE), FunnelController.updateGroup);
router.delete("/groups/:id", requirePermission(PERMISSIONS.LEADS_CFG_MANAGE), FunnelController.deleteGroup);

// Phễu
router.get("/", requirePermission(PERMISSIONS.LEADS_CFG_MANAGE), FunnelController.getFunnels);
router.post("/", requirePermission(PERMISSIONS.LEADS_CFG_MANAGE), FunnelController.createFunnel);
router.put("/:id", requirePermission(PERMISSIONS.LEADS_CFG_MANAGE), FunnelController.updateFunnel);
router.delete("/:id", requirePermission(PERMISSIONS.LEADS_CFG_MANAGE), FunnelController.deleteFunnel);

module.exports = router;
