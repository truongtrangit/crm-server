const express = require("express");
const { requirePermission } = require('../../core/middleware/auth');
const validate = require('../../core/middleware/validate');
const { PERMISSIONS } = require('../../core/constants/rbac');
const ctrl = require('../../modules/event/actionConfig/actionConfig.controller');
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
  createBlockAutomationSchema,
  updateBlockAutomationSchema,
  listQuerySchema,
} = require('../../modules/event/actionConfig/actions.validation');

const router = express.Router();

// ─── Results ───
router.get(
  "/results",
  requirePermission(PERMISSIONS.ACTIONS_CFG_READ),
  validate(listQuerySchema, "query"),
  ctrl.listResults,
);
router.post(
  "/results",
  requirePermission(PERMISSIONS.ACTIONS_CFG_CREATE),
  validate(createResultSchema),
  ctrl.createResult,
);
router.put(
  "/results/:id",
  requirePermission(PERMISSIONS.ACTIONS_CFG_UPDATE),
  validate(updateResultSchema),
  ctrl.updateResult,
);
router.delete(
  "/results/:id",
  requirePermission(PERMISSIONS.ACTIONS_CFG_DELETE),
  ctrl.deleteResult,
);

// ─── Reasons ───
router.get(
  "/reasons",
  requirePermission(PERMISSIONS.ACTIONS_CFG_READ),
  validate(listQuerySchema, "query"),
  ctrl.listReasons,
);
router.post(
  "/reasons",
  requirePermission(PERMISSIONS.ACTIONS_CFG_CREATE),
  validate(createReasonSchema),
  ctrl.createReason,
);
router.put(
  "/reasons/:id",
  requirePermission(PERMISSIONS.ACTIONS_CFG_UPDATE),
  validate(updateReasonSchema),
  ctrl.updateReason,
);
router.delete(
  "/reasons/:id",
  requirePermission(PERMISSIONS.ACTIONS_CFG_DELETE),
  ctrl.deleteReason,
);

// ─── Actions ───
router.get(
  "/actions",
  requirePermission(PERMISSIONS.ACTIONS_CFG_READ),
  validate(listQuerySchema, "query"),
  ctrl.listActions,
);
router.post(
  "/actions",
  requirePermission(PERMISSIONS.ACTIONS_CFG_CREATE),
  validate(createActionSchema),
  ctrl.createAction,
);
router.put(
  "/actions/:id",
  requirePermission(PERMISSIONS.ACTIONS_CFG_UPDATE),
  validate(updateActionSchema),
  ctrl.updateAction,
);
router.delete(
  "/actions/:id",
  requirePermission(PERMISSIONS.ACTIONS_CFG_DELETE),
  ctrl.deleteAction,
);

// ─── Action Chains ───
router.get(
  "/chains",
  requirePermission(PERMISSIONS.ACTIONS_CFG_READ),
  validate(listQuerySchema, "query"),
  ctrl.listActionChains,
);
router.get(
  "/chains/:id",
  requirePermission(PERMISSIONS.ACTIONS_CFG_READ),
  ctrl.getActionChain,
);
router.post(
  "/chains",
  requirePermission(PERMISSIONS.ACTIONS_CFG_CREATE),
  validate(createActionChainSchema),
  ctrl.createActionChain,
);
router.put(
  "/chains/:id",
  requirePermission(PERMISSIONS.ACTIONS_CFG_UPDATE),
  validate(updateActionChainSchema),
  ctrl.updateActionChain,
);
router.delete(
  "/chains/:id",
  requirePermission(PERMISSIONS.ACTIONS_CFG_DELETE),
  ctrl.deleteActionChain,
);

// ─── Chain Rule Configuration ─── (PUT /chains/:id/rule)
router.put(
  "/chains/:id/rule",
  requirePermission(PERMISSIONS.ACTIONS_CFG_UPDATE),
  validate(saveChainRuleSchema),
  ctrl.saveChainRule,
);

// ─── Block Automations ───
// Only owner/admin can create, update, delete (ACTIONS_CFG_MANAGE)
router.get(
  "/block-automations",
  requirePermission(PERMISSIONS.ACTIONS_CFG_READ),
  validate(listQuerySchema, "query"),
  ctrl.listBlockAutomations,
);
router.get(
  "/block-automations/:id",
  requirePermission(PERMISSIONS.ACTIONS_CFG_READ),
  ctrl.getBlockAutomation,
);
router.post(
  "/block-automations",
  requirePermission(PERMISSIONS.ACTIONS_CFG_MANAGE),
  validate(createBlockAutomationSchema),
  ctrl.createBlockAutomation,
);
router.put(
  "/block-automations/:id",
  requirePermission([PERMISSIONS.ACTIONS_CFG_MANAGE, PERMISSIONS.ACTIONS_CFG_CREATE], "any"),
  validate(updateBlockAutomationSchema),
  ctrl.updateBlockAutomation,
);
router.delete(
  "/block-automations/:id",
  requirePermission(PERMISSIONS.ACTIONS_CFG_MANAGE),
  ctrl.deleteBlockAutomation,
);

// ─── Event Schema Fields (for field mapping picker) ───
router.get(
  "/event-schema-fields",
  requirePermission(PERMISSIONS.ACTIONS_CFG_READ),
  ctrl.getEventSchemaFields,
);

// ─── Lead Schema Fields (for field mapping picker) ───
router.get(
  "/lead-schema-fields",
  requirePermission(PERMISSIONS.ACTIONS_CFG_READ),
  ctrl.getLeadSchemaFields,
);

module.exports = router;
