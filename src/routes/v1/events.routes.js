const express = require("express");
const { requirePermission, requireRole } = require('../../core/middleware/auth');

const validate = require('../../core/middleware/validate');
const { PERMISSIONS } = require('../../core/constants/rbac');
const EventController = require('../../modules/event/event/event.controller');

const {
  createEventSchema,
  updateEventSchema,
  listEventsQuerySchema,
  addTimelineSchema,
} = require('../../modules/event/event/event.validation');

const router = express.Router();

const { eventResourceAccess, eventAssignmentRules, eventUnassignmentRules, eventScopeList } = require('../../core/middleware/eventAccess');

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
  eventResourceAccess.with({
    allowUnassigned: true
  }),
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
