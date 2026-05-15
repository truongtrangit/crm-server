const express = require("express");
const { requirePermission, requireRole } = require("../../middleware/auth");
const validate = require("../../middleware/validate");
const { requireResourceAccess, enforceAssignmentRules, enforceUnassignmentRules, scopeResourceList } = require("../../middleware/resourceAccess");
const MetaProgram = require("../../models/MetaProgram");
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

const metaProgramAccess = requireResourceAccess({
  // Helpers
  getResource: (req) => MetaProgram.findOne({ id: req.params.id }),
  getAssigneeIds: (program) => program.picIds || [],
  getCreatorId: (program) => program.createdBy,

  // Hành vi (Behaviors)
  allowCreator: true,
  allowAssignee: true,
  allowUnassigned: false,
  allowManagerSubordinateCreator: true,
  allowManagerSubordinateAssignee: true,
});

const metaAssignmentRules = enforceAssignmentRules({
  // Helpers
  getNewAssigneeIds: (req) => req.body.picIds || null,
  getCurrentAssigneeIds: (program) => program.picIds || [],

  // Hành vi (Behaviors)
  allowSelfAssignment: true,
  allowManagerSubordinateAssignment: true,
  allowStaffReassignment: false,
});

const metaUnassignmentRules = enforceUnassignmentRules({
  // Helpers
  getNewAssigneeIds: (req) => req.body.picIds || null,
  getCurrentAssigneeIds: (program) => program.picIds || [],

  // Hành vi (Behaviors)
  allowSelfUnassignment: true,
  allowManagerSubordinateUnassignment: true,
});

const metaScopeList = scopeResourceList({
  // Helpers — cấu trúc DB
  assigneeField: "picIds",
  creatorField: "createdBy",
  assigneesArrayField: "picIds",

  // Hành vi (Behaviors)
  includeUnassigned: true,
});

router.get(
  "/programs",
  requirePermission(PERMISSIONS.META_READ),
  validate(listMetaProgramsQuerySchema, "query"),
  metaScopeList,
  MetaController.getPrograms,
);

router.get(
  "/programs/:id",
  requirePermission(PERMISSIONS.META_READ),
  metaProgramAccess.with({ allowUnassigned: true }),
  MetaController.getProgramById,
);

router.post(
  "/programs",
  requirePermission(PERMISSIONS.META_CREATE),
  metaAssignmentRules,
  validate(createMetaProgramSchema),
  MetaController.createProgram,
);

router.put(
  "/programs/:id",
  requirePermission(PERMISSIONS.META_UPDATE),
  metaProgramAccess,
  metaAssignmentRules,
  metaUnassignmentRules,
  validate(updateMetaProgramSchema),
  MetaController.updateProgram,
);

router.post(
  "/programs/:id/self-assign",
  requirePermission(PERMISSIONS.META_UPDATE),
  metaProgramAccess.with({ allowUnassigned: true }),
  MetaController.selfAssignProgram,
);

router.delete(
  "/programs/:id",
  requirePermission(PERMISSIONS.META_DELETE),
  metaProgramAccess,
  MetaController.deleteProgram,
);

// ─── Milestone routes ────────────────────────────────────────────────────────

router.post(
  "/programs/:id/milestones",
  requirePermission(PERMISSIONS.META_UPDATE),
  metaProgramAccess,
  validate(addMilestoneSchema),
  MetaController.addMilestone,
);

router.post(
  "/programs/:id/milestones/batch",
  requirePermission(PERMISSIONS.META_UPDATE),
  metaProgramAccess,
  validate(addBatchMilestonesSchema),
  MetaController.addBatchMilestones,
);

router.put(
  "/programs/:id/milestones/:milestoneId",
  requirePermission(PERMISSIONS.META_UPDATE),
  metaProgramAccess,
  validate(updateMilestoneSchema),
  MetaController.updateMilestone,
);

router.delete(
  "/programs/:id/milestones/:milestoneId",
  requirePermission(PERMISSIONS.META_UPDATE),
  metaProgramAccess,
  MetaController.deleteMilestone,
);

// ─── Task routes ─────────────────────────────────────────────────────────────

router.post(
  "/programs/:id/tasks",
  requirePermission(PERMISSIONS.META_UPDATE),
  metaProgramAccess,
  validate(createTaskSchema),
  MetaController.addTask,
);

router.put(
  "/programs/:id/tasks/:taskId",
  requirePermission(PERMISSIONS.META_UPDATE),
  metaProgramAccess,
  validate(updateTaskSchema),
  MetaController.updateTask,
);

router.delete(
  "/programs/:id/tasks/:taskId",
  requirePermission(PERMISSIONS.META_UPDATE),
  metaProgramAccess,
  MetaController.deleteTask,
);

// ─── Attachment routes ───────────────────────────────────────────────────────

router.post(
  "/programs/:id/attachments",
  requirePermission(PERMISSIONS.META_UPDATE),
  metaProgramAccess,
  validate(addAttachmentSchema),
  MetaController.addAttachment,
);

router.delete(
  "/programs/:id/attachments/:attachmentId",
  requirePermission(PERMISSIONS.META_UPDATE),
  metaProgramAccess,
  MetaController.deleteAttachment,
);

// ─── Comment routes ──────────────────────────────────────────────────────────

router.post(
  "/programs/:id/comments",
  requirePermission(PERMISSIONS.META_UPDATE),
  metaProgramAccess,
  validate(addCommentSchema),
  MetaController.addComment,
);

router.delete(
  "/programs/:id/comments/:commentId",
  requirePermission(PERMISSIONS.META_UPDATE),
  metaProgramAccess,
  MetaController.deleteComment,
);

module.exports = router;
