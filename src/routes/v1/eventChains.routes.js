const express = require("express");
const { requirePermission } = require('../../core/middleware/auth');

const validate = require('../../core/middleware/validate');
const { PERMISSIONS } = require('../../core/constants/rbac');
const EventActionChainController = require('../../modules/event/eventActionChain/eventActionChain.controller');

const {
  addChainToEventSchema,
  saveStepSchema,
  injectStepSchema,
  updateStepDelaySchema,
  updateStepNoteSchema,
  upsertStepBranchSchema,
} = require('../../modules/event/event/eventActionChain.validation');

const router = express.Router({ mergeParams: true });

const { eventResourceAccess } = require('../../core/middleware/eventAccess');

// ─── GET /api/events/:eventId/chains ───
router.get(
  "/",
  requirePermission(PERMISSIONS.EVENT_CHAINS_READ),
  EventActionChainController.getChains,
);

// ─── POST /api/events/:eventId/chains ───
router.post(
  "/",
  requirePermission(PERMISSIONS.EVENT_CHAINS_CREATE),
  eventResourceAccess,
  validate(addChainToEventSchema),
  EventActionChainController.addChain,
);

// ─── POST /api/events/:eventId/chains/:chainId/steps ───
// Thêm mới một step vào chain (inject sau step hiện tại)
router.post(
  "/:chainId/steps",
  requirePermission(PERMISSIONS.EVENT_CHAINS_UPDATE),
  eventResourceAccess,
  validate(injectStepSchema),
  EventActionChainController.injectStep,
);

// ─── PUT /api/events/:eventId/chains/:chainId/steps/current ───
// Lưu kết quả step hiện tại → unlock step tiếp theo
router.put(
  "/:chainId/steps/current",
  requirePermission(PERMISSIONS.EVENT_CHAINS_UPDATE),
  eventResourceAccess,
  validate(saveStepSchema),
  EventActionChainController.saveCurrentStep,
);

// ─── PATCH /api/events/:eventId/chains/:chainId/steps/current/delay ───
// Chỉnh delay step đang active
router.patch(
  "/:chainId/steps/current/delay",
  requirePermission(PERMISSIONS.EVENT_CHAINS_UPDATE),
  eventResourceAccess,
  validate(updateStepDelaySchema),
  EventActionChainController.updateCurrentStepDelay,
);

// ─── PATCH /api/events/:eventId/chains/:chainId/steps/:stepOrder/note ───
// Chỉnh note (bất kỳ step, kể cả đã lock)
router.patch(
  "/:chainId/steps/:stepOrder/note",
  requirePermission(PERMISSIONS.EVENT_CHAINS_UPDATE),
  eventResourceAccess,
  validate(updateStepNoteSchema),
  EventActionChainController.updateStepNote,
);

// ─── PUT /api/events/:eventId/chains/:chainId/steps/:stepOrder/branches ───
// Thêm / cập nhật branch (kết quả → bước tiếp theo) cho một step
router.put(
  "/:chainId/steps/:stepOrder/branches",
  requirePermission(PERMISSIONS.EVENT_CHAINS_UPDATE),
  eventResourceAccess,
  validate(upsertStepBranchSchema),
  EventActionChainController.upsertStepBranch,
);

// ─── DELETE /api/events/:eventId/chains/:chainId/steps/:stepOrder/branches/:resultId ───
// Xóa một branch khỏi step
router.delete(
  "/:chainId/steps/:stepOrder/branches/:resultId",
  requirePermission(PERMISSIONS.EVENT_CHAINS_UPDATE),
  eventResourceAccess,
  EventActionChainController.deleteStepBranch,
);

// ─── POST /api/events/:eventId/chains/:chainId/steps/current/execute-block-automation ───
// Thực thi Block Automation (resolve payload template + gọi API bên thứ 3)
router.post(
  "/:chainId/steps/current/execute-block-automation",
  requirePermission(PERMISSIONS.EVENT_CHAINS_UPDATE),
  eventResourceAccess,
  EventActionChainController.executeBlockAutomationStep,
);

// ─── PUT /api/events/:eventId/chains/:chainId/close ───
router.put(
  "/:chainId/close",
  requirePermission(PERMISSIONS.EVENT_CHAINS_CLOSE),
  eventResourceAccess,
  EventActionChainController.closeChain,
);

// ─── DELETE /api/events/:eventId/chains/:chainId ───
router.delete(
  "/:chainId",
  requirePermission(PERMISSIONS.EVENT_CHAINS_DELETE),
  eventResourceAccess,
  EventActionChainController.deleteChain,
);

module.exports = router;
