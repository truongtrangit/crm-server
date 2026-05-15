const express = require("express");
const { requirePermission, requireRole } = require("../../middleware/auth");
const { requireResourceAccess, scopeResourceList, enforceAssignmentRules, enforceUnassignmentRules } = require("../../middleware/resourceAccess");
const validate = require("../../middleware/validate");
const { PERMISSIONS } = require("../../constants/rbac");
const TaskController = require("../../controllers/TaskController");
const Task = require("../../models/Task");
const {
  createTaskSchema,
  updateTaskSchema,
  linkEventSchema,
  linkLeadSchema,
  listTasksQuerySchema,
} = require("../../validations/tasks");

const router = express.Router();

// ─── Shared resource access config for Task ──────────────────────────────────
const taskResourceAccess = requireResourceAccess({
  // Helpers
  getResource: (req) => Task.findOne({ id: req.params.id }),
  getAssigneeIds: (task) => (task.assignees || []).map((a) => a.userId),
  getCreatorId: (task) => task.createdBy,

  // Hành vi (Behaviors)
  allowCreator: true,
  allowAssignee: true,
  allowUnassigned: false, // Task phải có người phụ trách
  allowManagerSubordinateCreator: true,
  allowManagerSubordinateAssignee: true,
});

const taskAssignmentRules = enforceAssignmentRules({
  // Helpers
  getNewAssigneeIds: (req) => req.body.assignees ? req.body.assignees.map(a => typeof a === 'string' ? a : a.userId) : null,
  getCurrentAssigneeIds: (task) => (task.assignees || []).map(a => a.userId),

  // Hành vi (Behaviors)
  allowSelfAssignment: true,
  allowManagerSubordinateAssignment: true,
  allowStaffReassignment: false,
});

const taskUnassignmentRules = enforceUnassignmentRules({
  // Helpers
  getNewAssigneeIds: (req) => req.body.assignees ? req.body.assignees.map(a => typeof a === 'string' ? a : a.userId) : null,
  getCurrentAssigneeIds: (task) => (task.assignees || []).map(a => a.userId),

  // Hành vi (Behaviors)
  allowSelfUnassignment: true,
  allowManagerSubordinateUnassignment: true,
});

const taskScopeList = scopeResourceList({
  // Helpers — cấu trúc DB
  assigneeField: "assignees.userId",
  creatorField: "createdBy",
  assigneesArrayField: "assignees",

  // Hành vi (Behaviors)
  includeUnassigned: true,
});


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
  taskResourceAccess,
  TaskController.getTask,
);

// ─── PUT /api/tasks/:id ───
router.put(
  "/:id",
  requirePermission(PERMISSIONS.TASKS_UPDATE),
  taskResourceAccess,
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
