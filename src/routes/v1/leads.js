const express = require("express");
const { requirePermission } = require("../../middleware/auth");
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

// List leads (lazy load)
router.get(
  "/",
  requirePermission(PERMISSIONS.LEADS_READ),
  validate(listLeadsQuerySchema, "query"),
  LeadController.getLeads,
);

// Get stage counts cho Kanban
router.get(
  "/stage-counts",
  requirePermission(PERMISSIONS.LEADS_READ),
  LeadController.getStageCounts,
);

// Get single lead
router.get(
  "/:id",
  requirePermission(PERMISSIONS.LEADS_READ),
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
  validate(updateLeadSchema),
  LeadController.updateLead,
);

// Confirm stage → chuyển sang stage tiếp theo
router.post(
  "/:id/confirm-stage",
  requirePermission(PERMISSIONS.LEADS_UPDATE),
  LeadController.confirmStage,
);

// Delete lead
router.delete(
  "/:id",
  requirePermission(PERMISSIONS.LEADS_DELETE),
  LeadController.deleteLead,
);

// Timeline
router.post(
  "/:id/timeline",
  requirePermission(PERMISSIONS.LEADS_UPDATE),
  validate(addTimelineSchema),
  LeadController.addLeadTimeline,
);

module.exports = router;
