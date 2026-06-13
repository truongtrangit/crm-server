const Task = require('../../modules/job/task/task.model');
const {
  requireResourceAccess,
  enforceAssignmentRules,
  enforceUnassignmentRules,
  scopeResourceList,
} = require('./resourceAccess');

const taskResourceAccess = requireResourceAccess({
  getResource: (req) =>
    Task.findOne({ id: req.params.taskId || req.params.id }),
  getAssigneeIds: (task) => (task.assignees || []).map((a) => a.userId),
  getCreatorId: (task) => task.createdBy,
  allowCreator: true,
  allowAssignee: true,
  allowUnassigned: false,
  allowManagerSubordinateCreator: true,
  allowManagerSubordinateAssignee: true,
});

const taskAssignmentRules = enforceAssignmentRules({
  getNewAssigneeIds: (req) =>
    req.body.assignees
      ? req.body.assignees.map((a) => (typeof a === "string" ? a : a.userId))
      : null,
  getCurrentAssigneeIds: (task) => (task.assignees || []).map((a) => a.userId),
  allowSelfAssignment: true,
  allowManagerSubordinateAssignment: true,
  allowSameFunctionAssignment: true,
});

const taskUnassignmentRules = enforceUnassignmentRules({
  getNewAssigneeIds: (req) =>
    req.body.assignees
      ? req.body.assignees.map((a) => (typeof a === "string" ? a : a.userId))
      : null,
  getCurrentAssigneeIds: (task) => (task.assignees || []).map((a) => a.userId),
  allowSelfUnassignment: true,
  allowManagerSubordinateUnassignment: true,
});

const taskScopeList = scopeResourceList({
  assigneeField: "assignees.userId",
  creatorField: "createdBy",
  assigneesArrayField: "assignees",
  includeUnassigned: true,
});

module.exports = {
  taskResourceAccess,
  taskAssignmentRules,
  taskUnassignmentRules,
  taskScopeList,
};
