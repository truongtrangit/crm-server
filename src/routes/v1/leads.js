const express = require("express");
const { requirePermission } = require("../../middleware/auth");
const { requireResourceAccess } = require("../../middleware/resourceAccess");
const validate = require("../../middleware/validate");
const { PERMISSIONS } = require("../../constants/rbac");
const LeadController = require("../../controllers/LeadController");
const Lead = require("../../models/Lead");
const {
  createLeadSchema,
  updateLeadSchema,
  listLeadsQuerySchema,
} = require("../../validations/leads");
const { addTimelineSchema } = require("../../validations/events");

const router = express.Router();

// ─── Shared resource access config for Lead ──────────────────────────────────
const leadResourceAccess = requireResourceAccess({
  getResource: (req) => Lead.findOne({ id: req.params.id }),
  getAssigneeIds: (lead) => (lead.assignees || []).map((a) => a.userId),
  getCreatorId: (lead) => lead.createdBy,
  allowUnassigned: true,
  allowManager: true,
});

// List leads (lazy load) — scoping handled in LeadService
router.get(
  "/",
  requirePermission(PERMISSIONS.LEADS_READ),
  validate(listLeadsQuerySchema, "query"),
  LeadController.getLeads,
);

// Get stage counts cho Kanban — scoping handled in LeadService
router.get(
  "/stage-counts",
  requirePermission(PERMISSIONS.LEADS_READ),
  LeadController.getStageCounts,
);

// Get single lead
router.get(
  "/:id",
  requirePermission(PERMISSIONS.LEADS_READ),
  leadResourceAccess,
  LeadController.getLead,
);

// Create lead
router.post(
  "/",
  requirePermission(PERMISSIONS.LEADS_CREATE),
  validate(createLeadSchema),
  LeadController.createLead,
);

// Update lead
router.put(
  "/:id",
  requirePermission(PERMISSIONS.LEADS_UPDATE),
  leadResourceAccess,
  validate(updateLeadSchema),
  LeadController.updateLead,
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
  leadResourceAccess,
  LeadController.getActivityLogs,
);

module.exports = router;
