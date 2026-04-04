const express = require("express");
const Role = require("../models/Role");
const Permission = require("../models/Permission");
const {
  authenticateRequest,
  requirePermission,
} = require("../middleware/auth");
const { PERMISSIONS } = require("../constants/rbac");
const { sendSuccess, sendError } = require("../utils/http");

const router = express.Router();

// All routes require authentication
router.use(authenticateRequest);

// ==================== PERMISSIONS ROUTES ====================

/**
 * GET /api/permissions
 * Get all permissions (requires PERMISSIONS_READ or OWNER)
 */
router.get(
  "/",
  requirePermission(PERMISSIONS.PERMISSIONS_READ),
  async (req, res) => {
    try {
      const permissions = await Permission.find().select("-createdBy");
      return sendSuccess(res, 200, "Get permissions success", permissions);
    } catch (error) {
      console.error("Error fetching permissions:", error);
      return sendError(res, 500, "Internal server error", {
        code: "INTERNAL_SERVER_ERROR",
      });
    }
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
    try {
      const permission = await Permission.findOne({ id: req.params.id });

      if (!permission) {
        return sendError(res, 404, "Permission not found", {
          code: "PERMISSION_NOT_FOUND",
        });
      }

      return sendSuccess(res, 200, "Get permission success", permission);
    } catch (error) {
      console.error("Error fetching permission:", error);
      return sendError(res, 500, "Internal server error", {
        code: "INTERNAL_SERVER_ERROR",
      });
    }
  },
);

// ==================== ROLES ROUTES ====================

/**
 * GET /api/rbac/roles
 * Get all roles (requires ROLES_READ or ownership)
 */
router.get(
  "/roles",
  requirePermission(PERMISSIONS.ROLES_READ),
  async (req, res) => {
    try {
      const roles = await Role.find();
      return sendSuccess(res, 200, "Get roles success", roles);
    } catch (error) {
      console.error("Error fetching roles:", error);
      return sendError(res, 500, "Internal server error", {
        code: "INTERNAL_SERVER_ERROR",
      });
    }
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
    try {
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
    } catch (error) {
      console.error("Error fetching role:", error);
      return sendError(res, 500, "Internal server error", {
        code: "INTERNAL_SERVER_ERROR",
      });
    }
  },
);

/**
 * POST /api/rbac/roles
 * Create new role (requires ROLES_MANAGE)
 */
router.post(
  "/roles",
  requirePermission(PERMISSIONS.ROLES_MANAGE),
  async (req, res) => {
    try {
      const { id, name, description, permissions, level } = req.body;

      if (!id || !name) {
        return sendError(res, 400, "id and name are required", {
          code: "VALIDATION_ERROR",
        });
      }

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
      return sendSuccess(res, 201, "Create role success", role);
    } catch (error) {
      console.error("Error creating role:", error);
      return sendError(res, 500, "Internal server error", {
        code: "INTERNAL_SERVER_ERROR",
      });
    }
  },
);

/**
 * PUT /api/rbac/roles/:id
 * Update role (requires ROLES_MANAGE)
 */
router.put(
  "/roles/:id",
  requirePermission(PERMISSIONS.ROLES_MANAGE),
  async (req, res) => {
    try {
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
      return sendSuccess(res, 200, "Update role success", role);
    } catch (error) {
      console.error("Error updating role:", error);
      return sendError(res, 500, "Internal server error", {
        code: "INTERNAL_SERVER_ERROR",
      });
    }
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
    try {
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
      return sendSuccess(res, 200, "Delete role success", null);
    } catch (error) {
      console.error("Error deleting role:", error);
      return sendError(res, 500, "Internal server error", {
        code: "INTERNAL_SERVER_ERROR",
      });
    }
  },
);

module.exports = router;
