const express = require("express");
const { requirePermission, requireRole } = require("../../middleware/auth");
const { requireResourceAccess, enforceAssignmentRules, enforceUnassignmentRules, scopeResourceList } = require("../../middleware/resourceAccess");
const validate = require("../../middleware/validate");
const { PERMISSIONS } = require("../../constants/rbac");
const EventController = require("../../controllers/EventController");
const Event = require("../../models/Event");
const {
  createEventSchema,
  updateEventSchema,
  listEventsQuerySchema,
  addTimelineSchema,
} = require("../../validations/events");

const router = express.Router();

// ─── Shared resource access config for Event ─────────────────────────────────
const eventResourceAccess = requireResourceAccess({
  // Helpers
  getResource: (req) => Event.findOne({ id: req.params.id }),
  getAssigneeIds: (event) => (event.assignees || []).map((a) => a.userId),
  getCreatorId: (event) => event.createdBy,

  // Hành vi (Behaviors)
  allowCreator: true,
  allowAssignee: true,
  allowUnassigned: false,
  allowManagerSubordinateCreator: true,
  allowManagerSubordinateAssignee: true,
});

const eventAssignmentRules = enforceAssignmentRules({
  // Helpers
  getNewAssigneeIds: (req) => req.body.assignees ? req.body.assignees.map(a => typeof a === 'string' ? a : a.userId) : null,
  getCurrentAssigneeIds: (event) => (event.assignees || []).map((a) => a.userId),

  // Hành vi (Behaviors)
  allowSelfAssignment: true,
  allowManagerSubordinateAssignment: true,
  allowStaffReassignment: false,
});

const eventUnassignmentRules = enforceUnassignmentRules({
  // Helpers
  getNewAssigneeIds: (req) => req.body.assignees ? req.body.assignees.map(a => typeof a === 'string' ? a : a.userId) : null,
  getCurrentAssigneeIds: (event) => (event.assignees || []).map((a) => a.userId),
  getTargetUserId: (req) => req.body.userId, // Dùng cho DELETE /:id/assignee

  // Hành vi (Behaviors)
  allowSelfUnassignment: true,
  allowManagerSubordinateUnassignment: true,
});

const eventScopeList = scopeResourceList({
  // Helpers — cấu trúc DB
  assigneeField: "assignees.userId",
  creatorField: "createdBy",
  assigneesArrayField: "assignees",

  // Hành vi (Behaviors)
  includeUnassigned: true,
});

router.get(
  "/",
  requirePermission(PERMISSIONS.EVENTS_READ),
  validate(listEventsQuerySchema, "query"),
  eventScopeList,
  EventController.getEvents
);

router.get(
  "/stats",
  requirePermission(PERMISSIONS.EVENTS_READ),
  eventScopeList,
  EventController.getEventStats
);

router.get(
  "/:id",
  requirePermission(PERMISSIONS.EVENTS_READ),
  eventResourceAccess.with({ allowUnassigned: true }),
  EventController.getEventById
);

router.post(
  "/",
  requirePermission(PERMISSIONS.EVENTS_CREATE),
  eventAssignmentRules,
  validate(createEventSchema),
  EventController.createEvent
);

router.put(
  "/:id",
  requirePermission(PERMISSIONS.EVENTS_UPDATE),
  eventResourceAccess,
  eventAssignmentRules,
  eventUnassignmentRules,
  validate(updateEventSchema),
  EventController.updateEvent
);

router.post(
  "/:id/timeline",
  requirePermission(PERMISSIONS.EVENTS_UPDATE),
  eventResourceAccess,
  validate(addTimelineSchema),
  EventController.addEventTimeline
);

router.delete(
  "/:id/timeline/:timelineId",
  requirePermission(PERMISSIONS.EVENTS_UPDATE), // UPDATE vì permission xóa comment nằm trong thao tác chỉnh sửa event (với RBAC check riêng ở controller)
  eventResourceAccess,
  EventController.deleteEventTimeline
);

router.delete(
  "/:id",
  requirePermission(PERMISSIONS.EVENTS_DELETE),
  eventResourceAccess,
  EventController.deleteEvent
);

router.post(
  "/:id/archive",
  requireRole(['OWNER', 'ADMIN']),
  requirePermission(PERMISSIONS.EVENTS_UPDATE),
  eventResourceAccess,
  EventController.archiveEvent
);

router.post(
  "/:id/unarchive",
  requireRole(['OWNER', 'ADMIN']),
  requirePermission(PERMISSIONS.EVENTS_UPDATE),
  eventResourceAccess,
  EventController.unarchiveEvent
);

router.post(
  "/:id/sync-customer",
  requirePermission(PERMISSIONS.EVENTS_UPDATE),
  eventResourceAccess,
  EventController.syncCustomer
);

// Tự gán bản thân vào event chưa có người phụ trách
router.post(
  "/:id/self-assign",
  requirePermission(PERMISSIONS.EVENTS_UPDATE),
  eventResourceAccess.with({ allowUnassigned: true }),
  EventController.selfAssignEvent
);

// Unassign người phụ trách
router.delete(
  "/:id/assignee",
  requirePermission(PERMISSIONS.EVENTS_UPDATE),
  eventResourceAccess,
  eventUnassignmentRules,
  EventController.unassignEvent
);

module.exports = router;
