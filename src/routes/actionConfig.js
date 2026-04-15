const express = require("express");
const { requirePermission } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { PERMISSIONS } = require("../constants/rbac");
const asyncHandler = require("../utils/asyncHandler");
const ctrl = require("../controllers/ActionConfigController");
const {
  createResultSchema,
  updateResultSchema,
  createReasonSchema,
  updateReasonSchema,
  createActionSchema,
  updateActionSchema,
  createActionChainSchema,
  updateActionChainSchema,
  saveChainRuleSchema,
  listQuerySchema,
} = require("../validations/actions");

const router = express.Router();

// ─── Results ───
router.get("/results",  requirePermission(PERMISSIONS.ACTIONS_CFG_READ),   validate(listQuerySchema, "query"), asyncHandler(ctrl.listResults));
router.post("/results", requirePermission(PERMISSIONS.ACTIONS_CFG_CREATE),  validate(createResultSchema),        asyncHandler(ctrl.createResult));
router.put("/results/:id",    requirePermission(PERMISSIONS.ACTIONS_CFG_UPDATE), validate(updateResultSchema), asyncHandler(ctrl.updateResult));
router.delete("/results/:id", requirePermission(PERMISSIONS.ACTIONS_CFG_DELETE),                               asyncHandler(ctrl.deleteResult));

// ─── Reasons ───
router.get("/reasons",  requirePermission(PERMISSIONS.ACTIONS_CFG_READ),   validate(listQuerySchema, "query"), asyncHandler(ctrl.listReasons));
router.post("/reasons", requirePermission(PERMISSIONS.ACTIONS_CFG_CREATE),  validate(createReasonSchema),        asyncHandler(ctrl.createReason));
router.put("/reasons/:id",    requirePermission(PERMISSIONS.ACTIONS_CFG_UPDATE), validate(updateReasonSchema), asyncHandler(ctrl.updateReason));
router.delete("/reasons/:id", requirePermission(PERMISSIONS.ACTIONS_CFG_DELETE),                               asyncHandler(ctrl.deleteReason));

// ─── Actions ───
router.get("/actions",  requirePermission(PERMISSIONS.ACTIONS_CFG_READ),   validate(listQuerySchema, "query"), asyncHandler(ctrl.listActions));
router.post("/actions", requirePermission(PERMISSIONS.ACTIONS_CFG_CREATE),  validate(createActionSchema),        asyncHandler(ctrl.createAction));
router.put("/actions/:id",    requirePermission(PERMISSIONS.ACTIONS_CFG_UPDATE), validate(updateActionSchema), asyncHandler(ctrl.updateAction));
router.delete("/actions/:id", requirePermission(PERMISSIONS.ACTIONS_CFG_DELETE),                               asyncHandler(ctrl.deleteAction));

// ─── Action Chains ───
router.get("/chains",     requirePermission(PERMISSIONS.ACTIONS_CFG_READ),   validate(listQuerySchema, "query"), asyncHandler(ctrl.listActionChains));
router.get("/chains/:id", requirePermission(PERMISSIONS.ACTIONS_CFG_READ),                                      asyncHandler(ctrl.getActionChain));
router.post("/chains",    requirePermission(PERMISSIONS.ACTIONS_CFG_CREATE),  validate(createActionChainSchema), asyncHandler(ctrl.createActionChain));
router.put("/chains/:id", requirePermission(PERMISSIONS.ACTIONS_CFG_UPDATE),  validate(updateActionChainSchema), asyncHandler(ctrl.updateActionChain));
router.delete("/chains/:id", requirePermission(PERMISSIONS.ACTIONS_CFG_DELETE),                                  asyncHandler(ctrl.deleteActionChain));

// ─── Chain Rule Configuration ─── (PUT /chains/:id/rule)
router.put(
  "/chains/:id/rule",
  requirePermission(PERMISSIONS.ACTIONS_CFG_UPDATE),
  validate(saveChainRuleSchema),
  asyncHandler(ctrl.saveChainRule)
);

module.exports = router;
