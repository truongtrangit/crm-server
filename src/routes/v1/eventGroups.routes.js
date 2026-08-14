const express = require("express");
const { requirePermission } = require("../../core/middleware/auth");
const { PERMISSIONS } = require("../../core/constants/rbac");
const validate = require("../../core/middleware/validate");
const EventGroupController = require("../../modules/event/eventGroup/eventGroup.controller");
const {
  createEventGroupSchema,
  updateEventGroupSchema,
} = require("../../modules/event/eventGroup/eventGroup.validation");

const router = express.Router();

// GET /api/v1/event-groups — Danh sách groups (cho dropdown, stats)
router.get(
  "/",
  requirePermission(PERMISSIONS.EVENTS_READ),
  EventGroupController.listGroups,
);

// POST /api/v1/event-groups — Tạo group mới
router.post(
  "/",
  requirePermission(PERMISSIONS.INTEGRATION_CONFIG),
  validate(createEventGroupSchema),
  EventGroupController.createGroup,
);

// PUT /api/v1/event-groups/:id — Cập nhật group
router.put(
  "/:id",
  requirePermission(PERMISSIONS.INTEGRATION_CONFIG),
  validate(updateEventGroupSchema),
  EventGroupController.updateGroup,
);

// DELETE /api/v1/event-groups/:id — Xoá group
router.delete(
  "/:id",
  requirePermission(PERMISSIONS.INTEGRATION_CONFIG),
  EventGroupController.deleteGroup,
);

module.exports = router;
