const OrganizationService = require("../services/OrganizationService");
const SystemLogService = require("../services/SystemLogService");
const { sendError, sendSuccess } = require("../utils/http");
const { RESOURCES } = require("../constants/rbac");

class OrganizationController {
  async getOrganizations(req, res) {
    const result = await OrganizationService.getOrganizations(req.query);
    return sendSuccess(res, 200, "Get organization list success", result);
  }

  async createDepartment(req, res) {
    const department = await OrganizationService.createDepartment(req.body || {});
    SystemLogService.log({ action: "create", resource: RESOURCES.ORGANIZATION, resourceId: department.id, resourceName: department.parent, description: `Tạo phòng ban "${department.parent}"`, metadata: { newItem: department }, req });
    return sendSuccess(res, 201, "Create department success", department);
  }

  async createGroup(req, res) {
    const group = await OrganizationService.createGroup(req.body || {});
    SystemLogService.log({ action: "create", resource: RESOURCES.ORGANIZATION, resourceId: group.alias, resourceName: group.name, description: `Tạo nhóm "${group.name}"`, metadata: { newItem: group }, req });
    return sendSuccess(res, 201, "Create group success", group);
  }
}

module.exports = new OrganizationController();
