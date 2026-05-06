const express = require("express");
const { requirePermission } = require("../../middleware/auth");
const validate = require("../../middleware/validate");
const { PERMISSIONS } = require("../../constants/rbac");
const MetaController = require("../../controllers/MetaController");
const {
  createMetaConfigSchema,
  updateMetaConfigSchema,
  createMetaProgramSchema,
  updateMetaProgramSchema,
  listMetaProgramsQuerySchema,
  addMilestoneSchema,
  addBatchMilestonesSchema,
  updateMilestoneSchema,
  createTaskSchema,
  updateTaskSchema,
  addAttachmentSchema,
  addCommentSchema,
} = require("../../validations/meta");

const router = express.Router();

// ─── Config routes ────────────────────────────────────────────────────────────

router.get(
  "/config",
  requirePermission(PERMISSIONS.META_READ),
  MetaController.getConfigs,
);

router.post(
  "/config",
  requirePermission(PERMISSIONS.META_MANAGE),
  validate(createMetaConfigSchema),
  MetaController.createConfig,
);

router.put(
  "/config/:id",
  requirePermission(PERMISSIONS.META_MANAGE),
  validate(updateMetaConfigSchema),
  MetaController.updateConfig,
);

router.delete(
  "/config/:id",
  requirePermission(PERMISSIONS.META_MANAGE),
  MetaController.deleteConfig,
);

// ─── Program routes ──────────────────────────────────────────────────────────

router.get(
  "/programs",
  requirePermission(PERMISSIONS.META_READ),
  validate(listMetaProgramsQuerySchema, "query"),
  MetaController.getPrograms,
);

router.get(
  "/programs/:id",
  requirePermission(PERMISSIONS.META_READ),
  MetaController.getProgramById,
);

router.post(
  "/programs",
  requirePermission(PERMISSIONS.META_CREATE),
  validate(createMetaProgramSchema),
  MetaController.createProgram,
);

router.put(
  "/programs/:id",
  requirePermission(PERMISSIONS.META_UPDATE),
  validate(updateMetaProgramSchema),
  MetaController.updateProgram,
);

router.delete(
  "/programs/:id",
  requirePermission(PERMISSIONS.META_DELETE),
  MetaController.deleteProgram,
);

// ─── Milestone routes ────────────────────────────────────────────────────────

router.post(
  "/programs/:id/milestones",
  requirePermission(PERMISSIONS.META_UPDATE),
  validate(addMilestoneSchema),
  MetaController.addMilestone,
);

router.post(
  "/programs/:id/milestones/batch",
  requirePermission(PERMISSIONS.META_UPDATE),
  validate(addBatchMilestonesSchema),
  MetaController.addBatchMilestones,
);

router.put(
  "/programs/:id/milestones/:milestoneId",
  requirePermission(PERMISSIONS.META_UPDATE),
  validate(updateMilestoneSchema),
  MetaController.updateMilestone,
);

router.delete(
  "/programs/:id/milestones/:milestoneId",
  requirePermission(PERMISSIONS.META_UPDATE),
  MetaController.deleteMilestone,
);

// ─── Task routes ─────────────────────────────────────────────────────────────

router.post(
  "/programs/:id/tasks",
  requirePermission(PERMISSIONS.META_UPDATE),
  validate(createTaskSchema),
  MetaController.addTask,
);

router.put(
  "/programs/:id/tasks/:taskId",
  requirePermission(PERMISSIONS.META_UPDATE),
  validate(updateTaskSchema),
  MetaController.updateTask,
);

router.delete(
  "/programs/:id/tasks/:taskId",
  requirePermission(PERMISSIONS.META_UPDATE),
  MetaController.deleteTask,
);

// ─── Attachment routes ───────────────────────────────────────────────────────

router.post(
  "/programs/:id/attachments",
  requirePermission(PERMISSIONS.META_UPDATE),
  validate(addAttachmentSchema),
  MetaController.addAttachment,
);

router.delete(
  "/programs/:id/attachments/:attachmentId",
  requirePermission(PERMISSIONS.META_UPDATE),
  MetaController.deleteAttachment,
);

// ─── Comment routes ──────────────────────────────────────────────────────────

router.post(
  "/programs/:id/comments",
  requirePermission(PERMISSIONS.META_UPDATE),
  validate(addCommentSchema),
  MetaController.addComment,
);

router.delete(
  "/programs/:id/comments/:commentId",
  requirePermission(PERMISSIONS.META_UPDATE),
  MetaController.deleteComment,
);

module.exports = router;
