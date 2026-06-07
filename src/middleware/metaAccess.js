const MetaProgram = require("../models/MetaProgram");
const {
  requireResourceAccess,
  enforceAssignmentRules,
  enforceUnassignmentRules,
  scopeResourceList,
} = require("./resourceAccess");

const metaProgramAccess = requireResourceAccess({
  getResource: (req) => MetaProgram.findOne({ id: req.params.id }),
  getAssigneeIds: (program) => program.picIds || [],
  getCreatorId: (program) => program.createdBy,
  allowCreator: true,
  allowAssignee: true,
  allowUnassigned: false,
  allowManagerSubordinateCreator: true,
  allowManagerSubordinateAssignee: true,
});

const metaAssignmentRules = enforceAssignmentRules({
  getNewAssigneeIds: (req) => req.body.picIds || null,
  getCurrentAssigneeIds: (program) => program.picIds || [],
  allowSelfAssignment: true,
  allowManagerSubordinateAssignment: true,
  allowStaffReassignment: false,
});

const metaUnassignmentRules = enforceUnassignmentRules({
  getNewAssigneeIds: (req) => req.body.picIds || null,
  getCurrentAssigneeIds: (program) => program.picIds || [],
  allowSelfUnassignment: true,
  allowManagerSubordinateUnassignment: true,
});

const metaScopeList = scopeResourceList({
  assigneeField: "picIds",
  creatorField: "createdBy",
  assigneesArrayField: "picIds",
  includeUnassigned: true,
});

module.exports = {
  metaProgramAccess,
  metaAssignmentRules,
  metaUnassignmentRules,
  metaScopeList,
};
