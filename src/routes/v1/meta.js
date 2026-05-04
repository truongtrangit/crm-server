const express = require("express");
const { requirePermission } = require("../../middleware/auth");
const validate = require("../../middleware/validate");
const { PERMISSIONS } = require("../../constants/rbac");
const asyncHandler = require("../../utils/asyncHandler");
const MetaController = require("../../controllers/MetaController");
const {
  createMetaConfigSchema,
  updateMetaConfigSchema,
  createMetaProgramSchema,
  updateMetaProgramSchema,
  listMetaProgramsQuerySchema,
  addMilestoneSchema,
  updateMilestoneSchema,
  createTaskSchema,
  updateTaskSchema,
  addAttachmentSchema,
} = require("../../validations/meta");

const router = express.Router();

// ─── Config routes ────────────────────────────────────────────────────────────

router.get(
  "/config",
  requirePermission(PERMISSIONS.META_READ),
  asyncHandler(MetaController.getConfigs),
);

router.post(
  "/config",
  requirePermission(PERMISSIONS.META_MANAGE),
  validate(createMetaConfigSchema),
  asyncHandler(MetaController.createConfig),
);

router.put(
  "/config/:id",
  requirePermission(PERMISSIONS.META_MANAGE),
  validate(updateMetaConfigSchema),
  asyncHandler(MetaController.updateConfig),
);

router.delete(
  "/config/:id",
  requirePermission(PERMISSIONS.META_MANAGE),
  asyncHandler(MetaController.deleteConfig),
);

// ─── Program routes ──────────────────────────────────────────────────────────

router.get(
  "/programs",
  requirePermission(PERMISSIONS.META_READ),
  validate(listMetaProgramsQuerySchema, "query"),
  asyncHandler(MetaController.getPrograms),
);

router.get(
  "/programs/:id",
  requirePermission(PERMISSIONS.META_READ),
  asyncHandler(MetaController.getProgramById),
);

router.post(
  "/programs",
  requirePermission(PERMISSIONS.META_CREATE),
  validate(createMetaProgramSchema),
  asyncHandler(MetaController.createProgram),
);

router.put(
  "/programs/:id",
  requirePermission(PERMISSIONS.META_UPDATE),
  validate(updateMetaProgramSchema),
  asyncHandler(MetaController.updateProgram),
);

router.delete(
  "/programs/:id",
  requirePermission(PERMISSIONS.META_DELETE),
  asyncHandler(MetaController.deleteProgram),
);

// ─── Milestone routes ────────────────────────────────────────────────────────

router.post(
  "/programs/:id/milestones",
  requirePermission(PERMISSIONS.META_UPDATE),
  validate(addMilestoneSchema),
  asyncHandler(MetaController.addMilestone),
);

router.put(
  "/programs/:id/milestones/:milestoneId",
  requirePermission(PERMISSIONS.META_UPDATE),
  validate(updateMilestoneSchema),
  asyncHandler(MetaController.updateMilestone),
);

router.delete(
  "/programs/:id/milestones/:milestoneId",
  requirePermission(PERMISSIONS.META_UPDATE),
  asyncHandler(MetaController.deleteMilestone),
);

// ─── Task routes ─────────────────────────────────────────────────────────────

router.post(
  "/programs/:id/tasks",
  requirePermission(PERMISSIONS.META_UPDATE),
  validate(createTaskSchema),
  asyncHandler(MetaController.addTask),
);

router.put(
  "/programs/:id/tasks/:taskId",
  requirePermission(PERMISSIONS.META_UPDATE),
  validate(updateTaskSchema),
  asyncHandler(MetaController.updateTask),
);

router.delete(
  "/programs/:id/tasks/:taskId",
  requirePermission(PERMISSIONS.META_UPDATE),
  asyncHandler(MetaController.deleteTask),
);

// ─── Attachment routes ───────────────────────────────────────────────────────

router.post(
  "/programs/:id/attachments",
  requirePermission(PERMISSIONS.META_UPDATE),
  validate(addAttachmentSchema),
  asyncHandler(MetaController.addAttachment),
);

router.delete(
  "/programs/:id/attachments/:attachmentId",
  requirePermission(PERMISSIONS.META_UPDATE),
  asyncHandler(MetaController.deleteAttachment),
);

module.exports = router;
