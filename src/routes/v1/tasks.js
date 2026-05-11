const express = require("express");
const { requirePermission } = require("../../middleware/auth");
const validate = require("../../middleware/validate");
const { PERMISSIONS } = require("../../constants/rbac");
const TaskController = require("../../controllers/TaskController");
const {
  createTaskSchema,
  updateTaskSchema,
  linkEventSchema,
  linkLeadSchema,
  listTasksQuerySchema,
} = require("../../validations/tasks");

const router = express.Router();

// ─── GET /api/tasks ───
router.get(
  "/",
  requirePermission(PERMISSIONS.TASKS_READ),
  TaskController.getTasks,
);

// ─── POST /api/tasks ───
router.post(
  "/",
  requirePermission(PERMISSIONS.TASKS_CREATE),
  validate(createTaskSchema),
  TaskController.createTask,
);

// ─── Search Events / Leads (for linking) ───
router.get(
  "/search-events",
  requirePermission(PERMISSIONS.TASKS_READ),
  TaskController.searchEvents,
);

router.get(
  "/search-leads",
  requirePermission(PERMISSIONS.TASKS_READ),
  TaskController.searchLeads,
);

// ─── Tasks by Event / Lead (for tab display) ───
router.get(
  "/by-event/:eventId",
  requirePermission(PERMISSIONS.TASKS_READ),
  TaskController.getTasksByEvent,
);

router.get(
  "/by-lead/:leadId",
  requirePermission(PERMISSIONS.TASKS_READ),
  TaskController.getTasksByLead,
);

// ─── GET /api/tasks/:id ───
router.get(
  "/:id",
  requirePermission(PERMISSIONS.TASKS_READ),
  TaskController.getTask,
);

// ─── PUT /api/tasks/:id ───
router.put(
  "/:id",
  requirePermission(PERMISSIONS.TASKS_UPDATE),
  validate(updateTaskSchema),
  TaskController.updateTask,
);

// ─── PUT /api/tasks/:id/close ───
router.put(
  "/:id/close",
  requirePermission(PERMISSIONS.TASKS_UPDATE),
  TaskController.closeTask,
);

// ─── PUT /api/tasks/:id/archive ───
router.put(
  "/:id/archive",
  requirePermission(PERMISSIONS.TASKS_UPDATE),
  TaskController.archiveTask,
);

// ─── PUT /api/tasks/:id/unarchive ───
router.put(
  "/:id/unarchive",
  requirePermission(PERMISSIONS.TASKS_UPDATE),
  TaskController.unarchiveTask,
);

// ─── DELETE /api/tasks/:id ───
router.delete(
  "/:id",
  requirePermission(PERMISSIONS.TASKS_DELETE),
  TaskController.deleteTask,
);

// ─── Link / Unlink Event ───
router.post(
  "/:id/link-event",
  requirePermission(PERMISSIONS.TASKS_UPDATE),
  validate(linkEventSchema),
  TaskController.linkEvent,
);

router.delete(
  "/:id/unlink-event/:eventId",
  requirePermission(PERMISSIONS.TASKS_UPDATE),
  TaskController.unlinkEvent,
);

// ─── Link / Unlink Lead ───
router.post(
  "/:id/link-lead",
  requirePermission(PERMISSIONS.TASKS_UPDATE),
  validate(linkLeadSchema),
  TaskController.linkLead,
);

router.delete(
  "/:id/unlink-lead/:leadId",
  requirePermission(PERMISSIONS.TASKS_UPDATE),
  TaskController.unlinkLead,
);

module.exports = router;
