const express = require("express");
const { requirePermission } = require("../../middleware/auth");
const validate = require("../../middleware/validate");
const { PERMISSIONS } = require("../../constants/rbac");
const asyncHandler = require("../../utils/asyncHandler");
const EventController = require("../../controllers/EventController");
const {
  createEventSchema,
  updateEventSchema,
  listEventsQuerySchema,
  addTimelineSchema,
} = require("../../validations/events");

const router = express.Router();

router.get(
  "/",
  requirePermission(PERMISSIONS.EVENTS_READ),
  validate(listEventsQuerySchema, "query"),
  asyncHandler(EventController.getEvents)
);

router.get(
  "/stats",
  requirePermission(PERMISSIONS.EVENTS_READ),
  asyncHandler(EventController.getEventStats)
);

router.get(
  "/:id",
  requirePermission(PERMISSIONS.EVENTS_READ),
  asyncHandler(EventController.getEventById)
);

router.post(
  "/",
  requirePermission(PERMISSIONS.EVENTS_CREATE),
  validate(createEventSchema),
  asyncHandler(EventController.createEvent)
);

router.put(
  "/:id",
  requirePermission(PERMISSIONS.EVENTS_UPDATE),
  validate(updateEventSchema),
  asyncHandler(EventController.updateEvent)
);

router.post(
  "/:id/timeline",
  requirePermission(PERMISSIONS.EVENTS_UPDATE),
  validate(addTimelineSchema),
  asyncHandler(EventController.addEventTimeline)
);

router.delete(
  "/:id",
  requirePermission(PERMISSIONS.EVENTS_DELETE),
  asyncHandler(EventController.deleteEvent)
);

router.post(
  "/:id/sync-customer",
  requirePermission(PERMISSIONS.EVENTS_UPDATE),
  asyncHandler(EventController.syncCustomer)
);

// Tự gán bản thân vào event chưa có người phụ trách
router.post(
  "/:id/self-assign",
  requirePermission(PERMISSIONS.EVENTS_UPDATE),
  asyncHandler(EventController.selfAssignEvent)
);

// Unassign người phụ trách
router.delete(
  "/:id/assignee",
  requirePermission(PERMISSIONS.EVENTS_UPDATE),
  asyncHandler(EventController.unassignEvent)
);

module.exports = router;
