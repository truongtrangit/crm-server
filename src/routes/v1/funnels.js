const { Router } = require("express");
const FunnelController = require("../../controllers/FunnelController");
const { requirePermission } = require("../../middleware/auth");
const { PERMISSIONS } = require("../../constants/rbac");

const router = Router();

// Thư mục
router.get("/folders", FunnelController.getFolders);
router.post("/folders", FunnelController.createFolder);
router.put("/folders/:id", FunnelController.updateFolder);
router.delete("/folders/:id", FunnelController.deleteFolder);

// Nhóm phễu
router.get("/groups", FunnelController.getGroups);
router.post("/groups", FunnelController.createGroup);
router.put("/groups/:id", FunnelController.updateGroup);
router.delete("/groups/:id", FunnelController.deleteGroup);

// Phễu
router.get("/", FunnelController.getFunnels);
router.post("/", FunnelController.createFunnel);
router.put("/:id", FunnelController.updateFunnel);
router.delete("/:id", FunnelController.deleteFunnel);

module.exports = router;
