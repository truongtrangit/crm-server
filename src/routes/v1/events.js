const express = require("express");
const { requirePermission } = require("../../middleware/auth");
const { requireResourceAccess } = require("../../middleware/resourceAccess");
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
  getResource: (req) => Event.findOne({ id: req.params.id }),
  getAssigneeIds: (event) => (event.assignees || []).map((a) => a.userId),
  getCreatorId: (event) => event.createdBy,
  allowUnassigned: true,
  allowManager: true,
});

router.get(
  "/",
  requirePermission(PERMISSIONS.EVENTS_READ),
  validate(listEventsQuerySchema, "query"),
  EventController.getEvents
);

router.get(
  "/stats",
  requirePermission(PERMISSIONS.EVENTS_READ),
  EventController.getEventStats
);

router.get(
  "/:id",
  requirePermission(PERMISSIONS.EVENTS_READ),
  eventResourceAccess,
  EventController.getEventById
);

router.post(
  "/",
  requirePermission(PERMISSIONS.EVENTS_CREATE),
  validate(createEventSchema),
  EventController.createEvent
);

router.put(
  "/:id",
  requirePermission(PERMISSIONS.EVENTS_UPDATE),
  eventResourceAccess,
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
  EventController.deleteEventTimeline
);

router.delete(
  "/:id",
  requirePermission(PERMISSIONS.EVENTS_DELETE),
  EventController.deleteEvent
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
  EventController.selfAssignEvent
);

// Unassign người phụ trách
router.delete(
  "/:id/assignee",
  requirePermission(PERMISSIONS.EVENTS_UPDATE),
  EventController.unassignEvent
);

module.exports = router;
