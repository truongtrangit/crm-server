/**
 * Task Action Chains — chuỗi hành động trong tác vụ (standalone).
 * Reuses EventActionChainController by mounting the same handlers
 * on /tasks/:taskId/chains routes.
 * The controller detects taskId vs eventId via req.params.
 */
const express = require("express");
const { requirePermission } = require('../../core/middleware/auth');

const validate = require('../../core/middleware/validate');
const { PERMISSIONS } = require('../../core/constants/rbac');
const TaskActionChainController = require('../../modules/job/taskActionChain/taskActionChain.controller');

const {
  addChainToEventSchema,
  saveStepSchema,
  injectStepSchema,
  updateStepDelaySchema,
  updateStepNoteSchema,
  upsertStepBranchSchema,
} = require('../../modules/event/event/eventActionChain.validation');

const router = express.Router({ mergeParams: true });

const { taskResourceAccess } = require('../../core/middleware/taskAccess');

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
  taskResourceAccess,
  validate(addChainToEventSchema),
  TaskActionChainController.addChain,
);

// ─── POST /api/tasks/:taskId/chains/:chainId/steps ───
router.post(
  "/:chainId/steps",
  requirePermission(PERMISSIONS.TASK_CHAINS_UPDATE),
  taskResourceAccess,
  validate(injectStepSchema),
  TaskActionChainController.injectStep,
);

// ─── PUT /api/tasks/:taskId/chains/:chainId/steps/current ───
router.put(
  "/:chainId/steps/current",
  requirePermission(PERMISSIONS.TASK_CHAINS_UPDATE),
  taskResourceAccess,
  validate(saveStepSchema),
  TaskActionChainController.saveCurrentStep,
);

// ─── PATCH /api/tasks/:taskId/chains/:chainId/steps/current/delay ───
router.patch(
  "/:chainId/steps/current/delay",
  requirePermission(PERMISSIONS.TASK_CHAINS_UPDATE),
  taskResourceAccess,
  validate(updateStepDelaySchema),
  TaskActionChainController.updateCurrentStepDelay,
);

// ─── PATCH /api/tasks/:taskId/chains/:chainId/steps/:stepOrder/note ───
router.patch(
  "/:chainId/steps/:stepOrder/note",
  requirePermission(PERMISSIONS.TASK_CHAINS_UPDATE),
  taskResourceAccess,
  validate(updateStepNoteSchema),
  TaskActionChainController.updateStepNote,
);

// ─── PUT /api/tasks/:taskId/chains/:chainId/steps/:stepOrder/branches ───
router.put(
  "/:chainId/steps/:stepOrder/branches",
  requirePermission(PERMISSIONS.TASK_CHAINS_UPDATE),
  taskResourceAccess,
  validate(upsertStepBranchSchema),
  TaskActionChainController.upsertStepBranch,
);

// ─── DELETE /api/tasks/:taskId/chains/:chainId/steps/:stepOrder/branches/:resultId ───
router.delete(
  "/:chainId/steps/:stepOrder/branches/:resultId",
  requirePermission(PERMISSIONS.TASK_CHAINS_UPDATE),
  taskResourceAccess,
  TaskActionChainController.deleteStepBranch,
);

// ─── PUT /api/tasks/:taskId/chains/:chainId/close ───
router.put(
  "/:chainId/close",
  requirePermission(PERMISSIONS.TASK_CHAINS_CLOSE),
  taskResourceAccess,
  TaskActionChainController.closeChain,
);

// ─── POST /api/tasks/:taskId/chains/:chainId/execute-block-automation ───
router.post(
  "/:chainId/execute-block-automation",
  requirePermission(PERMISSIONS.TASK_CHAINS_UPDATE),
  taskResourceAccess,
  TaskActionChainController.executeBlockAutomationStep,
);

// ─── DELETE /api/tasks/:taskId/chains/:chainId ───
router.delete(
  "/:chainId",
  requirePermission(PERMISSIONS.TASK_CHAINS_DELETE),
  taskResourceAccess,
  TaskActionChainController.deleteChain,
);

module.exports = router;
