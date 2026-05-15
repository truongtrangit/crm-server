/**
 * Task Action Chains — chuỗi hành động trong tác vụ (standalone).
 * Reuses EventActionChainController by mounting the same handlers
 * on /tasks/:taskId/chains routes.
 * The controller detects taskId vs eventId via req.params.
 */
const express = require("express");
const { requirePermission } = require("../../middleware/auth");
const { requireResourceAccess } = require("../../middleware/resourceAccess");
const validate = require("../../middleware/validate");
const { PERMISSIONS } = require("../../constants/rbac");
const TaskActionChainController = require("../../controllers/TaskActionChainController");
const Task = require("../../models/Task");
const {
  addChainToEventSchema,
  saveStepSchema,
  injectStepSchema,
  updateStepDelaySchema,
  updateStepNoteSchema,
  upsertStepBranchSchema,
} = require("../../validations/eventActionChain");

const router = express.Router({ mergeParams: true });

// ─── Shared: task ownership check for all chain mutations ────────────────────
const taskResourceAccess = requireResourceAccess({
  // Helpers
  getResource: (req) => Task.findOne({ id: req.params.taskId }),
  getAssigneeIds: (task) => (task.assignees || []).map((a) => a.userId),
  getCreatorId: (task) => task.createdBy,

  // Hành vi (Behaviors)
  allowCreator: true,
  allowAssignee: true,
  allowUnassigned: false,
  allowManagerSubordinateCreator: true,
  allowManagerSubordinateAssignee: true,
});

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
