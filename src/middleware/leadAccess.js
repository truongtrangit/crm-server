const Lead = require("../models/Lead");
const {
  requireResourceAccess,
  enforceAssignmentRules,
  enforceUnassignmentRules,
  scopeResourceList,
} = require("./resourceAccess");

const leadResourceAccess = requireResourceAccess({
  getResource: (req) => Lead.findOne({ id: req.params.id }),
  getAssigneeIds: (lead) => (lead.assignees || []).map((a) => a.userId),
  getCreatorId: (lead) => lead.createdBy,
  allowCreator: true,
  allowAssignee: true,
  allowUnassigned: true,
  allowManagerSubordinateCreator: true,
  allowManagerSubordinateAssignee: true,
});

const leadAssignmentRules = enforceAssignmentRules({
  getNewAssigneeIds: (req) =>
    req.body.assignees
      ? req.body.assignees.map((a) => (typeof a === "string" ? a : a.userId))
      : null,
  getCurrentAssigneeIds: (lead) => (lead.assignees || []).map((a) => a.userId),
  allowSelfAssignment: true,
  allowManagerSubordinateAssignment: true,
  allowSameFunctionAssignment: true,
});

const leadUnassignmentRules = enforceUnassignmentRules({
  getNewAssigneeIds: (req) =>
    req.body.assignees
      ? req.body.assignees.map((a) => (typeof a === "string" ? a : a.userId))
      : null,
  getCurrentAssigneeIds: (lead) => (lead.assignees || []).map((a) => a.userId),
  allowSelfUnassignment: true,
  allowManagerSubordinateUnassignment: true,
});

const leadScopeList = scopeResourceList({
  assigneeField: "assignees.userId",
  creatorField: "createdBy",
  assigneesArrayField: "assignees",
  includeUnassigned: true,
});

module.exports = {
  leadResourceAccess,
  leadAssignmentRules,
  leadUnassignmentRules,
  leadScopeList,
};
