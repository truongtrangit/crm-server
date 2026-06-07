const Event = require("../models/Event");
const { requireResourceAccess, enforceAssignmentRules, enforceUnassignmentRules, scopeResourceList } = require("./resourceAccess");

const eventResourceAccess = requireResourceAccess({
  getResource: (req) => Event.findOne({ id: req.params.eventId || req.params.id }),
  getAssigneeIds: (event) => (event.assignees || []).map((a) => a.userId),
  getCreatorId: (event) => event.createdBy,
  allowCreator: true,
  allowAssignee: true,
  allowUnassigned: true,
  allowManagerSubordinateCreator: true,
  allowManagerSubordinateAssignee: true,
});

const eventAssignmentRules = enforceAssignmentRules({
  getNewAssigneeIds: (req) => req.body.assignees ? req.body.assignees.map(a => typeof a === 'string' ? a : a.userId) : null,
  getCurrentAssigneeIds: (event) => (event.assignees || []).map(a => a.userId),
  allowSelfAssignment: true,
  allowManagerSubordinateAssignment: true,
  allowSameFunctionAssignment: true,
});

const eventUnassignmentRules = enforceUnassignmentRules({
  getNewAssigneeIds: (req) => req.body.assignees ? req.body.assignees.map(a => typeof a === 'string' ? a : a.userId) : null,
  getCurrentAssigneeIds: (event) => (event.assignees || []).map(a => a.userId),
  getTargetUserId: (req) => req.body.userId,
  allowSelfUnassignment: true,
  allowManagerSubordinateUnassignment: true,
});

const eventScopeList = scopeResourceList({
  assigneeField: "assignees.userId",
  creatorField: "createdBy",
  assigneesArrayField: "assignees",
  includeUnassigned: true,
});

module.exports = { eventResourceAccess, eventAssignmentRules, eventUnassignmentRules, eventScopeList };
