const express = require("express");
const { requirePermission, requireRole } = require('../../core/middleware/auth');

const validate = require('../../core/middleware/validate');
const { PERMISSIONS } = require('../../core/constants/rbac');
const TaskController = require('../../modules/job/task/task.controller');

const {
  createTaskSchema,
  updateTaskSchema,
  linkEventSchema,
  linkLeadSchema,
  listTasksQuerySchema,
} = require('../../modules/job/task/task.validation');

const router = express.Router();

const { taskResourceAccess, taskAssignmentRules, taskUnassignmentRules, taskScopeList } = require('../../core/middleware/taskAccess');


// ─── GET /api/tasks ───
router.get(
  "/",
  requirePermission(PERMISSIONS.TASKS_READ),
  taskScopeList,
  TaskController.getTasks,
);

// ─── POST /api/tasks ───
router.post(
  "/",
  requirePermission(PERMISSIONS.TASKS_CREATE),
  taskAssignmentRules,
  validate(createTaskSchema),
  TaskController.createTask,
);

// ─── Search Events / Leads (for linking) ───
router.get(
  "/search-events",
  requirePermission([PERMISSIONS.TASKS_READ, PERMISSIONS.EVENTS_READ]),
  TaskController.searchEvents,
);

router.get(
  "/search-leads",
  requirePermission([PERMISSIONS.TASKS_READ, PERMISSIONS.LEADS_READ]),
  TaskController.searchLeads,
);

// ─── Tasks by Event / Lead (for tab display) ───
router.get(
  "/by-event/:eventId",
  requirePermission([PERMISSIONS.TASKS_READ, PERMISSIONS.EVENTS_READ]),
  TaskController.getTasksByEvent,
);

router.get(
  "/by-lead/:leadId",
  requirePermission([PERMISSIONS.TASKS_READ, PERMISSIONS.LEADS_READ]),
  TaskController.getTasksByLead,
);

// ─── GET /api/tasks/:id ───
router.get(
  "/:id",
  requirePermission(PERMISSIONS.TASKS_READ),
  taskResourceAccess.with({ allowUnassigned: true }),
  TaskController.getTask,
);

// ─── PUT /api/tasks/:id ───
router.put(
  "/:id",
  requirePermission(PERMISSIONS.TASKS_UPDATE),
  taskResourceAccess.with({
    allowUnassigned: true
  }),
  taskAssignmentRules,
  taskUnassignmentRules,
  validate(updateTaskSchema),
  TaskController.updateTask,
);

// ─── PUT /api/tasks/:id/close ───
router.put(
  "/:id/close",
  requirePermission(PERMISSIONS.TASKS_UPDATE),
  taskResourceAccess,
  TaskController.closeTask,
);

// ─── PUT /api/tasks/:id/archive ───
router.put(
  "/:id/archive",
  requireRole(["OWNER", "ADMIN"]),
  requirePermission(PERMISSIONS.TASKS_UPDATE),
  TaskController.archiveTask,
);

// ─── PUT /api/tasks/:id/unarchive ───
router.put(
  "/:id/unarchive",
  requireRole(["OWNER", "ADMIN"]),
  requirePermission(PERMISSIONS.TASKS_UPDATE),
  TaskController.unarchiveTask,
);

// ─── DELETE /api/tasks/:id ───
router.delete(
  "/:id",
  requirePermission(PERMISSIONS.TASKS_DELETE),
  taskResourceAccess,
  TaskController.deleteTask,
);

// ─── Link / Unlink Event ───
router.post(
  "/:id/link-event",
  requirePermission(PERMISSIONS.TASKS_UPDATE),
  taskResourceAccess,
  validate(linkEventSchema),
  TaskController.linkEvent,
);

router.delete(
  "/:id/unlink-event/:eventId",
  requirePermission(PERMISSIONS.TASKS_UPDATE),
  taskResourceAccess,
  TaskController.unlinkEvent,
);

// ─── Link / Unlink Lead ───
router.post(
  "/:id/link-lead",
  requirePermission(PERMISSIONS.TASKS_UPDATE),
  taskResourceAccess,
  validate(linkLeadSchema),
  TaskController.linkLead,
);

router.delete(
  "/:id/unlink-lead/:leadId",
  requirePermission(PERMISSIONS.TASKS_UPDATE),
  taskResourceAccess,
  TaskController.unlinkLead,
);

module.exports = router;
