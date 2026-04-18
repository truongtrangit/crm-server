const express = require("express");
const Role = require("../../models/Role");
const Permission = require("../../models/Permission");
const {
  authenticateRequest,
  requirePermission,
} = require("../../middleware/auth");
const validate = require("../../middleware/validate");
const { PERMISSIONS } = require("../../constants/rbac");
const { sendSuccess, sendError } = require("../../utils/http");
const logger = require("../../utils/logger");
const { createRoleSchema, updateRoleSchema } = require("../../validations/rbac");

const router = express.Router();

// ==================== ROLES ROUTES ====================

/**
 * GET /api/rbac/roles
 * Get all roles (requires ROLES_READ or ownership)
 */
router.get(
  "/roles",
  requirePermission(PERMISSIONS.ROLES_READ),
  async (req, res) => {
    const roles = await Role.find();
    return sendSuccess(res, 200, "Get roles success", roles);
  },
);

/**
 * GET /api/rbac/roles/:id
 * Get role by ID with permissions
 */
router.get(
  "/roles/:id",
  requirePermission(PERMISSIONS.ROLES_READ),
  async (req, res) => {
    const role = await Role.findOne({ id: req.params.id });

    if (!role) {
      return sendError(res, 404, "Role not found", {
        code: "ROLE_NOT_FOUND",
      });
    }

    // Populate permissions
    const permissions = await Permission.find({
      id: { $in: role.permissions },
    });
    const roleWithPermissions = {
      ...role.toObject(),
      permissionsDetails: permissions,
    };

    return sendSuccess(res, 200, "Get role success", roleWithPermissions);
  },
);

// ==================== PERMISSIONS ROUTES ====================

/**
 * GET /api/permissions
 * Get all permissions (requires PERMISSIONS_READ or OWNER)
 */
router.get(
  "/",
  requirePermission(PERMISSIONS.PERMISSIONS_READ),
  async (req, res) => {
    const permissions = await Permission.find().select("-createdBy");
    return sendSuccess(res, 200, "Get permissions success", permissions);
  },
);

/**
 * GET /api/permissions/:id
 * Get permission by ID
 */
router.get(
  "/:id",
  requirePermission(PERMISSIONS.PERMISSIONS_READ),
  async (req, res) => {
    const permission = await Permission.findOne({ id: req.params.id });

    if (!permission) {
      return sendError(res, 404, "Permission not found", {
        code: "PERMISSION_NOT_FOUND",
      });
    }

    return sendSuccess(res, 200, "Get permission success", permission);
  },
);

/**
 * POST /api/rbac/roles
 * Create new role (requires ROLES_MANAGE)
 */
router.post(
  "/roles",
  requirePermission(PERMISSIONS.ROLES_MANAGE),
  validate(createRoleSchema),
  async (req, res) => {
    const { id, name, description, permissions, level } = req.body;

    const existingRole = await Role.findOne({ id });
    if (existingRole) {
      return sendError(res, 409, "Role already exists", {
        code: "ROLE_ALREADY_EXISTS",
      });
    }

    const role = new Role({
      id,
      name,
      description: description || "",
      permissions: permissions || [],
      level: level || 0,
      createdBy: req.user.id,
    });

    await role.save();
    logger.info("Role created", { roleId: id, roleName: name, createdBy: req.user.id });
    return sendSuccess(res, 201, "Create role success", role);
  },
);

/**
 * PUT /api/rbac/roles/:id
 * Update role (requires ROLES_MANAGE)
 */
router.put(
  "/roles/:id",
  requirePermission(PERMISSIONS.ROLES_MANAGE),
  validate(updateRoleSchema),
  async (req, res) => {
    const role = await Role.findOne({ id: req.params.id });

    if (!role) {
      return sendError(res, 404, "Role not found", {
        code: "ROLE_NOT_FOUND",
      });
    }

    if (role.isSystem) {
      return sendError(res, 403, "System roles cannot be modified", {
        code: "FORBIDDEN",
      });
    }

    const { name, description, permissions, level } = req.body;

    if (name) role.name = name;
    if (description !== undefined) role.description = description;
    if (Array.isArray(permissions)) role.permissions = permissions;
    if (level !== undefined) role.level = level;

    await role.save();
    logger.info("Role updated", { roleId: req.params.id, updatedBy: req.user.id });
    return sendSuccess(res, 200, "Update role success", role);
  },
);

/**
 * DELETE /api/rbac/roles/:id
 * Delete role (requires ROLES_MANAGE)
 */
router.delete(
  "/roles/:id",
  requirePermission(PERMISSIONS.ROLES_MANAGE),
  async (req, res) => {
    const role = await Role.findOne({ id: req.params.id });

    if (!role) {
      return sendError(res, 404, "Role not found", {
        code: "ROLE_NOT_FOUND",
      });
    }

    if (role.isSystem) {
      return sendError(res, 403, "System roles cannot be deleted", {
        code: "FORBIDDEN",
      });
    }

    await Role.deleteOne({ id: req.params.id });
    logger.info("Role deleted", { roleId: req.params.id, deletedBy: req.user.id });
    return sendSuccess(res, 200, "Delete role success", null);
  },
);

module.exports = router;
