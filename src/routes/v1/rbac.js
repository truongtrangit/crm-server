const express = require("express");
const {
  requirePermission,
} = require("../../middleware/auth");
const validate = require("../../middleware/validate");
const { PERMISSIONS } = require("../../constants/rbac");
const { createRoleSchema, updateRoleSchema } = require("../../validations/rbac");
const RbacController = require("../../controllers/RbacController");

const router = express.Router();

// ==================== ROLES ROUTES ====================

/**
 * GET /api/rbac/roles
 * Get all roles (requires ROLES_READ or ownership)
 */
router.get(
  "/roles",
  requirePermission(PERMISSIONS.ROLES_READ),
  RbacController.getRoles
);

router.get(
  "/roles/:id",
  requirePermission(PERMISSIONS.ROLES_READ),
  RbacController.getRoleById
);

router.get(
  "/",
  requirePermission(PERMISSIONS.PERMISSIONS_READ),
  RbacController.getPermissions
);

router.get(
  "/:id",
  requirePermission(PERMISSIONS.PERMISSIONS_READ),
  RbacController.getPermissionById
);

router.post(
  "/roles",
  requirePermission(PERMISSIONS.ROLES_MANAGE),
  validate(createRoleSchema),
  RbacController.createRole
);

router.put(
  "/roles/:id",
  requirePermission(PERMISSIONS.ROLES_MANAGE),
  validate(updateRoleSchema),
  RbacController.updateRole
);

router.delete(
  "/roles/:id",
  requirePermission(PERMISSIONS.ROLES_MANAGE),
  RbacController.deleteRole
);

module.exports = router;
