const express = require("express");
const { requirePermission } = require('../../core/middleware/auth');
const { scopeResourceList } = require('../../core/middleware/resourceAccess');
const { PERMISSIONS } = require('../../core/constants/rbac');
const EventActionChainController = require('../../modules/event/eventActionChain/eventActionChain.controller');

const router = express.Router();

// Task Queue: lấy tất cả steps cần làm (cross-event)
router.get(
  "/queue",
  requirePermission(PERMISSIONS.EVENT_CHAINS_READ),
  scopeResourceList({
    // Helpers — cấu trúc DB
    assigneeField: "assignees.userId",
    creatorField: "createdBy",
    assigneesArrayField: "assignees",

    // Hành vi (Behaviors)
    includeUnassigned: true,
  }),
  EventActionChainController.getTaskQueue
);

module.exports = router;
