/**
 * Task Action Chains — chuỗi hành động trong tác vụ (standalone).
 * Reuses EventActionChainController by mounting the same handlers
 * on /tasks/:taskId/chains routes.
 * The controller detects taskId vs eventId via req.params.
 */
const express = require("express");
const { requirePermission } = require("../../middleware/auth");
const validate = require("../../middleware/validate");
const { PERMISSIONS } = require("../../constants/rbac");
const TaskActionChainController = require("../../controllers/TaskActionChainController");
const {
  addChainToEventSchema,
  saveStepSchema,
  injectStepSchema,
  updateStepDelaySchema,
  updateStepNoteSchema,
  upsertStepBranchSchema,
} = require("../../validations/eventActionChain");

const router = express.Router({ mergeParams: true });

// ─── GET /api/tasks/:taskId/chains ───
router.get(
  "/",
  requirePermission(PERMISSIONS.TASK_CHAINS_READ),
  TaskActionChainController.getChains,
);

// ─── POST /api/tasks/:taskId/chains ───
router.post(
  "/",
  requirePermission(PERMISSIONS.TASK_CHAINS_CREATE),
  validate(addChainToEventSchema),
  TaskActionChainController.addChain,
);

// ─── POST /api/tasks/:taskId/chains/:chainId/steps ───
router.post(
  "/:chainId/steps",
  requirePermission(PERMISSIONS.TASK_CHAINS_UPDATE),
  validate(injectStepSchema),
  TaskActionChainController.injectStep,
);

// ─── PUT /api/tasks/:taskId/chains/:chainId/steps/current ───
router.put(
  "/:chainId/steps/current",
  requirePermission(PERMISSIONS.TASK_CHAINS_UPDATE),
  validate(saveStepSchema),
  TaskActionChainController.saveCurrentStep,
);

// ─── PATCH /api/tasks/:taskId/chains/:chainId/steps/current/delay ───
router.patch(
  "/:chainId/steps/current/delay",
  requirePermission(PERMISSIONS.TASK_CHAINS_UPDATE),
  validate(updateStepDelaySchema),
  TaskActionChainController.updateCurrentStepDelay,
);

// ─── PATCH /api/tasks/:taskId/chains/:chainId/steps/:stepOrder/note ───
router.patch(
  "/:chainId/steps/:stepOrder/note",
  requirePermission(PERMISSIONS.TASK_CHAINS_UPDATE),
  validate(updateStepNoteSchema),
  TaskActionChainController.updateStepNote,
);

// ─── PUT /api/tasks/:taskId/chains/:chainId/steps/:stepOrder/branches ───
router.put(
  "/:chainId/steps/:stepOrder/branches",
  requirePermission(PERMISSIONS.TASK_CHAINS_UPDATE),
  validate(upsertStepBranchSchema),
  TaskActionChainController.upsertStepBranch,
);

// ─── DELETE /api/tasks/:taskId/chains/:chainId/steps/:stepOrder/branches/:resultId ───
router.delete(
  "/:chainId/steps/:stepOrder/branches/:resultId",
  requirePermission(PERMISSIONS.TASK_CHAINS_UPDATE),
  TaskActionChainController.deleteStepBranch,
);

// ─── PUT /api/tasks/:taskId/chains/:chainId/close ───
router.put(
  "/:chainId/close",
  requirePermission(PERMISSIONS.TASK_CHAINS_CLOSE),
  TaskActionChainController.closeChain,
);

// ─── POST /api/tasks/:taskId/chains/:chainId/execute-block-automation ───
router.post(
  "/:chainId/execute-block-automation",
  requirePermission(PERMISSIONS.TASK_CHAINS_UPDATE),
  TaskActionChainController.executeBlockAutomationStep,
);

// ─── DELETE /api/tasks/:taskId/chains/:chainId ───
router.delete(
  "/:chainId",
  requirePermission(PERMISSIONS.TASK_CHAINS_DELETE),
  TaskActionChainController.deleteChain,
);

module.exports = router;
