const RbacService = require("../services/RbacService");
const { sendSuccess, sendError } = require("../utils/http");
const logger = require("../utils/logger");
const SystemLogService = require("../services/SystemLogService");
const { RESOURCES } = require("../constants/rbac");

class RbacController {
  async getRoles(req, res) {
    try {
      const roles = await RbacService.getRoles();
      return sendSuccess(res, 200, "Get roles success", roles);
    } catch (error) {
      return sendError(res, error.status || 500, error.message, { code: error.code });
    }
  }

  async getRoleById(req, res) {
    try {
      const role = await RbacService.getRoleById(req.params.id);
      return sendSuccess(res, 200, "Get role success", role);
    } catch (error) {
      return sendError(res, error.status || 500, error.message, { code: error.code });
    }
  }

  async getPermissions(req, res) {
    try {
      const permissions = await RbacService.getPermissions();
      return sendSuccess(res, 200, "Get permissions success", permissions);
    } catch (error) {
      return sendError(res, error.status || 500, error.message, { code: error.code });
    }
  }

  async getPermissionById(req, res) {
    try {
      const permission = await RbacService.getPermissionById(req.params.id);
      return sendSuccess(res, 200, "Get permission success", permission);
    } catch (error) {
      return sendError(res, error.status || 500, error.message, { code: error.code });
    }
  }

  async createRole(req, res) {
    try {
      const role = await RbacService.createRole(req.body, req.user);
      logger.info("Role created", { roleId: role.id, roleName: role.name, createdBy: req.user.id });
      SystemLogService.log({ action: "create", resource: RESOURCES.ROLES, resourceId: role.id, resourceName: role.name, description: `Tạo vai trò "${role.name}"`, req });
      return sendSuccess(res, 201, "Create role success", role);
    } catch (error) {
      return sendError(res, error.status || 500, error.message, { code: error.code });
    }
  }

  async updateRole(req, res) {
    try {
      const { role, changes } = await RbacService.updateRole(req.params.id, req.body);
      logger.info("Role updated", { roleId: req.params.id, updatedBy: req.user.id });
      SystemLogService.log({ action: "update", resource: RESOURCES.ROLES, resourceId: req.params.id, resourceName: role.name, description: `Cập nhật vai trò "${role.name}"`, metadata: { changes }, req });
      return sendSuccess(res, 200, "Update role success", role);
    } catch (error) {
      return sendError(res, error.status || 500, error.message, { code: error.code });
    }
  }

  async deleteRole(req, res) {
    try {
      const force = req.query.force === 'true';
      await RbacService.deleteRole(req.params.id, force);
      logger.info("Role deleted", { roleId: req.params.id, deletedBy: req.user.id });
      SystemLogService.log({ action: "delete", resource: RESOURCES.ROLES, resourceId: req.params.id, description: `Xóa vai trò ${req.params.id}`, req });
      return sendSuccess(res, 200, "Delete role success", null);
    } catch (error) {
      return sendError(res, error.status || 500, error.message, {
        code: error.code,
        references: error.references,
      });
    }
  }
}

module.exports = new RbacController();
