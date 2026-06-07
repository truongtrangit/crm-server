const express = require("express");
const { requirePermission, requireRole } = require("../../middleware/auth");

const validate = require("../../middleware/validate");
const { PERMISSIONS } = require("../../constants/rbac");
const LeadController = require("../../controllers/LeadController");

const {
  createLeadSchema,
  updateLeadSchema,
  listLeadsQuerySchema,
} = require("../../validations/leads");
const { addTimelineSchema } = require("../../validations/events");

const router = express.Router();

const { leadResourceAccess, leadAssignmentRules, leadUnassignmentRules, leadScopeList } = require("../../middleware/leadAccess");

// List leads (lazy load) — scoping handled in LeadService
router.get(
  "/",
  requirePermission(PERMISSIONS.LEADS_READ),
  validate(listLeadsQuerySchema, "query"),
  leadScopeList,
  LeadController.getLeads,
);

// Get stage counts cho Kanban — scoping handled in LeadService
router.get(
  "/stage-counts",
  requirePermission(PERMISSIONS.LEADS_READ),
  leadScopeList,
  LeadController.getStageCounts,
);

// Get single lead
router.get(
  "/:id",
  requirePermission(PERMISSIONS.LEADS_READ),
  leadResourceAccess.with({ allowUnassigned: true }),
  LeadController.getLead,
);

// Create lead
router.post(
  "/",
  requirePermission(PERMISSIONS.LEADS_CREATE),
  leadAssignmentRules,
  validate(createLeadSchema),
  LeadController.createLead,
);

// Update lead
router.put(
  "/:id",
  requirePermission(PERMISSIONS.LEADS_UPDATE),
  leadResourceAccess,
  leadAssignmentRules,
  leadUnassignmentRules,
  validate(updateLeadSchema),
  LeadController.updateLead,
);

// Tự nhận lead chưa có người phụ trách
router.post(
  "/:id/self-assign",
  requirePermission(PERMISSIONS.LEADS_UPDATE),
  leadAssignmentRules,
  leadResourceAccess.with({ allowUnassigned: true }),
  LeadController.selfAssignLead,
);

// Confirm stage → chuyển sang stage tiếp theo
router.post(
  "/:id/confirm-stage",
  requirePermission(PERMISSIONS.LEADS_UPDATE),
  leadResourceAccess,
  LeadController.confirmStage,
);

// Delete lead
router.delete(
  "/:id",
  requirePermission(PERMISSIONS.LEADS_DELETE),
  leadResourceAccess,
  LeadController.deleteLead,
);

// Archive / Unarchive lead
router.post(
  "/:id/archive",
  requireRole(['OWNER', 'ADMIN']),
  requirePermission(PERMISSIONS.LEADS_UPDATE),
  LeadController.archiveLead,
);

router.post(
  "/:id/unarchive",
  requireRole(['OWNER', 'ADMIN']),
  requirePermission(PERMISSIONS.LEADS_UPDATE),
  LeadController.unarchiveLead,
);

// Timeline
router.post(
  "/:id/timeline",
  requirePermission(PERMISSIONS.LEADS_UPDATE),
  leadResourceAccess,
  validate(addTimelineSchema),
  LeadController.addLeadTimeline,
);

// Discussion (Thảo luận) — cho phép assignee + manager
router.post(
  "/:id/discussions",
  requirePermission(PERMISSIONS.LEADS_READ),
  leadResourceAccess,
  LeadController.addDiscussion,
);

// Activity Logs (Lịch sử thao tác) — cũng cần resource access
router.get(
  "/:id/activity-logs",
  requirePermission(PERMISSIONS.LEADS_READ),
  leadResourceAccess.with({ allowUnassigned: true }),
  LeadController.getActivityLogs,
);

module.exports = router;
