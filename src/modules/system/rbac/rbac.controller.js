const RbacService = require('./rbac.service');
const { sendSuccess, sendError } = require('../../../core/utils/http');
const logger = require('../../../core/utils/logger');
const SystemLogService = require('../log/systemLog.service');
const { RESOURCES } = require('../../../core/constants/rbac');

class RbacController {
  async getRoles(req, res) {
    const roles = await RbacService.getRoles();
    return sendSuccess(res, 200, "Get roles success", roles);
  }

  async getRoleById(req, res) {
    const role = await RbacService.getRoleById(req.params.id);
    return sendSuccess(res, 200, "Get role success", role);
  }

  async getPermissions(req, res) {
    const permissions = await RbacService.getPermissions();
    return sendSuccess(res, 200, "Get permissions success", permissions);
  }

  async getPermissionById(req, res) {
    const permission = await RbacService.getPermissionById(req.params.id);
    return sendSuccess(res, 200, "Get permission success", permission);
  }

  async createRole(req, res) {
    const role = await RbacService.createRole(req.body, req.user);
    logger.info("Role created", { roleId: role.id, roleName: role.name, createdBy: req.user.id });
    SystemLogService.log({ action: "create", resource: RESOURCES.ROLES, resourceId: role.id, resourceName: role.name, description: `Tạo vai trò "${role.name}"`, metadata: { newItem: role }, req });
    return sendSuccess(res, 201, "Create role success", role);
  }

  async updateRole(req, res) {
    const { role, changes } = await RbacService.updateRole(req.params.id, req.body);
    logger.info("Role updated", { roleId: req.params.id, updatedBy: req.user.id });
    SystemLogService.log({ action: "update", resource: RESOURCES.ROLES, resourceId: req.params.id, resourceName: role.name, description: `Cập nhật vai trò "${role.name}"`, metadata: { changes }, req });
    return sendSuccess(res, 200, "Update role success", role);
  }

  async deleteRole(req, res) {
    const force = req.query.force === 'true';
    const deletedRole = await RbacService.deleteRole(req.params.id, force);
    logger.info("Role deleted", { roleId: req.params.id, deletedBy: req.user.id });
    SystemLogService.log({ action: "delete", resource: RESOURCES.ROLES, resourceId: req.params.id, description: `Xóa vai trò ${req.params.id}`, metadata: { deletedItem: deletedRole }, req });
    return sendSuccess(res, 200, "Delete role success", null);
  }
}

module.exports = new RbacController();
