const LeadConfigService = require("../services/LeadConfigService");
const { sendSuccess } = require("../utils/http");
const SystemLogService = require("../services/SystemLogService");
const { RESOURCES } = require("../constants/rbac");

class LeadConfigController {
  async getStatuses(req, res) {
    const statuses = await LeadConfigService.getStatuses();
    return sendSuccess(res, 200, "Success", statuses);
  }

  async createStatus(req, res) {
    const newStatus = await LeadConfigService.createStatus(req.body);
    SystemLogService.log({ action: "create", resource: RESOURCES.LEADS_CFG, resourceId: newStatus.id, resourceName: newStatus.name, description: `Tạo trạng thái lead "${newStatus.name}"`, metadata: { newItem: newStatus }, req });
    return sendSuccess(res, 201, "Tạo trạng thái thành công", newStatus);
  }

  async updateStatus(req, res) {
    const { id } = req.params;
    const updatedStatus = await LeadConfigService.updateStatus(id, req.body);
    SystemLogService.log({ action: "update", resource: RESOURCES.LEADS_CFG, resourceId: updatedStatus.id, resourceName: updatedStatus.name, description: `Cập nhật trạng thái lead "${updatedStatus.name}"`, metadata: { updatedItem: updatedStatus }, req });
    return sendSuccess(res, 200, "Cập nhật trạng thái thành công", updatedStatus);
  }

  async deleteStatus(req, res) {
    const { id } = req.params;
    const deletedStatus = await LeadConfigService.deleteStatus(id);
    SystemLogService.log({ action: "delete", resource: RESOURCES.LEADS_CFG, resourceId: id, resourceName: deletedStatus.name, description: `Xóa trạng thái lead "${deletedStatus.name}"`, metadata: { deletedItem: deletedStatus }, req });
    return sendSuccess(res, 200, "Xóa trạng thái thành công", { id });
  }

  async getGroups(req, res) {
    const groups = await LeadConfigService.getGroups();
    return sendSuccess(res, 200, "Success", groups);
  }

  async createGroup(req, res) {
    const newGroup = await LeadConfigService.createGroup(req.body);
    SystemLogService.log({ action: "create", resource: RESOURCES.LEADS_CFG, resourceId: newGroup.id, resourceName: newGroup.name, description: `Tạo nhóm trạng thái lead "${newGroup.name}"`, metadata: { newItem: newGroup }, req });
    return sendSuccess(res, 201, "Tạo nhóm trạng thái thành công", newGroup);
  }

  async updateGroup(req, res) {
    const { id } = req.params;
    const updatedGroup = await LeadConfigService.updateGroup(id, req.body);
    SystemLogService.log({ action: "update", resource: RESOURCES.LEADS_CFG, resourceId: updatedGroup.id, resourceName: updatedGroup.name, description: `Cập nhật nhóm trạng thái lead "${updatedGroup.name}"`, metadata: { updatedItem: updatedGroup }, req });
    return sendSuccess(res, 200, "Cập nhật nhóm trạng thái thành công", updatedGroup);
  }

  async deleteGroup(req, res) {
    const { id } = req.params;
    const deletedGroup = await LeadConfigService.deleteGroup(id);
    SystemLogService.log({ action: "delete", resource: RESOURCES.LEADS_CFG, resourceId: id, resourceName: deletedGroup.name, description: `Xóa nhóm trạng thái lead "${deletedGroup.name}"`, metadata: { deletedItem: deletedGroup }, req });
    return sendSuccess(res, 200, "Xóa nhóm trạng thái thành công", { id });
  }
}

module.exports = new LeadConfigController();
