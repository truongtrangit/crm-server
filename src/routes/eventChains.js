const express = require("express");
const { requirePermission } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { PERMISSIONS } = require("../constants/rbac");
const asyncHandler = require("../utils/asyncHandler");
const EventActionChainController = require("../controllers/EventActionChainController");
const {
  addChainToEventSchema,
  saveStepSchema,
  injectStepSchema,
  updateStepDelaySchema,
  updateStepNoteSchema,
  upsertStepBranchSchema,
} = require("../validations/eventActionChain");

const router = express.Router({ mergeParams: true });

// ─── GET /api/events/:eventId/chains ───
router.get(
  "/",
  requirePermission(PERMISSIONS.EVENT_CHAINS_READ),
  asyncHandler(EventActionChainController.getChains)
);

// ─── POST /api/events/:eventId/chains ───
router.post(
  "/",
  requirePermission(PERMISSIONS.EVENT_CHAINS_CREATE),
  validate(addChainToEventSchema),
  asyncHandler(EventActionChainController.addChain)
);

// ─── POST /api/events/:eventId/chains/:chainId/steps ───
// Thêm mới một step vào chain (inject sau step hiện tại)
router.post(
  "/:chainId/steps",
  requirePermission(PERMISSIONS.EVENT_CHAINS_UPDATE),
  validate(injectStepSchema),
  asyncHandler(EventActionChainController.injectStep)
);

// ─── PUT /api/events/:eventId/chains/:chainId/steps/current ───
// Lưu kết quả step hiện tại → unlock step tiếp theo
router.put(
  "/:chainId/steps/current",
  requirePermission(PERMISSIONS.EVENT_CHAINS_UPDATE),
  validate(saveStepSchema),
  asyncHandler(EventActionChainController.saveCurrentStep)
);

// ─── PATCH /api/events/:eventId/chains/:chainId/steps/current/delay ───
// Chỉnh delay step đang active
router.patch(
  "/:chainId/steps/current/delay",
  requirePermission(PERMISSIONS.EVENT_CHAINS_UPDATE),
  validate(updateStepDelaySchema),
  asyncHandler(EventActionChainController.updateCurrentStepDelay)
);

// ─── PATCH /api/events/:eventId/chains/:chainId/steps/:stepOrder/note ───
// Chỉnh note (bất kỳ step, kể cả đã lock)
router.patch(
  "/:chainId/steps/:stepOrder/note",
  requirePermission(PERMISSIONS.EVENT_CHAINS_UPDATE),
  validate(updateStepNoteSchema),
  asyncHandler(EventActionChainController.updateStepNote)
);

// ─── PUT /api/events/:eventId/chains/:chainId/steps/:stepOrder/branches ───
// Thêm / cập nhật branch (kết quả → bước tiếp theo) cho một step
router.put(
  "/:chainId/steps/:stepOrder/branches",
  requirePermission(PERMISSIONS.EVENT_CHAINS_UPDATE),
  validate(upsertStepBranchSchema),
  asyncHandler(EventActionChainController.upsertStepBranch)
);

// ─── DELETE /api/events/:eventId/chains/:chainId/steps/:stepOrder/branches/:resultId ───
// Xóa một branch khỏi step
router.delete(
  "/:chainId/steps/:stepOrder/branches/:resultId",
  requirePermission(PERMISSIONS.EVENT_CHAINS_UPDATE),
  asyncHandler(EventActionChainController.deleteStepBranch)
);

// ─── PUT /api/events/:eventId/chains/:chainId/close ───
router.put(
  "/:chainId/close",
  requirePermission(PERMISSIONS.EVENT_CHAINS_CLOSE),
  asyncHandler(EventActionChainController.closeChain)
);

// ─── DELETE /api/events/:eventId/chains/:chainId ───
router.delete(
  "/:chainId",
  requirePermission(PERMISSIONS.EVENT_CHAINS_DELETE),
  asyncHandler(EventActionChainController.deleteChain)
);

module.exports = router;
