const LeadConfigService = require('./leadConfig.service');
const { sendSuccess } = require('../../../core/utils/http');
const SystemLogService = require('../../system/log/systemLog.service');
const { RESOURCES } = require('../../../core/constants/rbac');

class LeadConfigController {
  async getStatuses(req, res) {
    const statuses = await LeadConfigService.getStatuses();
    return sendSuccess(res, 200, "Success", statuses);
  }

  async createStatus(req, res) {
    const newStatus = await LeadConfigService.createStatus(req.body);
    SystemLogService.log({
      action: "create",
      resource: RESOURCES.LEADS_CFG,
      resourceId: newStatus.id,
      resourceName: newStatus.name,
      description: `Tạo trạng thái lead "${newStatus.name}"`,
      metadata: { newItem: newStatus },
      req,
    });
    return sendSuccess(res, 201, "Tạo trạng thái thành công", newStatus);
  }

  async updateStatus(req, res) {
    const { id } = req.params;
    const { status, changes } = await LeadConfigService.updateStatus(
      id,
      req.body,
    );
    SystemLogService.log({
      action: "update",
      resource: RESOURCES.LEADS_CFG,
      resourceId: status.id,
      resourceName: status.name,
      description: `Cập nhật trạng thái lead "${status.name}"`,
      metadata: { changes },
      req,
    });
    return sendSuccess(res, 200, "Cập nhật trạng thái thành công", status);
  }

  async deleteStatus(req, res) {
    const { id } = req.params;
    const deletedStatus = await LeadConfigService.deleteStatus(id);
    SystemLogService.log({
      action: "delete",
      resource: RESOURCES.LEADS_CFG,
      resourceId: id,
      resourceName: deletedStatus.name,
      description: `Xóa trạng thái lead "${deletedStatus.name}"`,
      metadata: { deletedItem: deletedStatus },
      req,
    });
    return sendSuccess(res, 200, "Xóa trạng thái thành công", { id });
  }

  async getGroups(req, res) {
    const groups = await LeadConfigService.getGroups();
    return sendSuccess(res, 200, "Success", groups);
  }

  async createGroup(req, res) {
    const newGroup = await LeadConfigService.createGroup(req.body);
    SystemLogService.log({
      action: "create",
      resource: RESOURCES.LEADS_CFG,
      resourceId: newGroup.id,
      resourceName: newGroup.name,
      description: `Tạo nhóm trạng thái lead "${newGroup.name}"`,
      metadata: { newItem: newGroup },
      req,
    });
    return sendSuccess(res, 201, "Tạo nhóm trạng thái thành công", newGroup);
  }

  async updateGroup(req, res) {
    const { id } = req.params;
    const { group, changes } = await LeadConfigService.updateGroup(
      id,
      req.body,
    );
    SystemLogService.log({
      action: "update",
      resource: RESOURCES.LEADS_CFG,
      resourceId: group.id,
      resourceName: group.name,
      description: `Cập nhật nhóm trạng thái lead "${group.name}"`,
      metadata: { changes },
      req,
    });
    return sendSuccess(res, 200, "Cập nhật nhóm trạng thái thành công", group);
  }

  async deleteGroup(req, res) {
    const { id } = req.params;
    const deletedGroup = await LeadConfigService.deleteGroup(id);
    SystemLogService.log({
      action: "delete",
      resource: RESOURCES.LEADS_CFG,
      resourceId: id,
      resourceName: deletedGroup.name,
      description: `Xóa nhóm trạng thái lead "${deletedGroup.name}"`,
      metadata: { deletedItem: deletedGroup },
      req,
    });
    return sendSuccess(res, 200, "Xóa nhóm trạng thái thành công", { id });
  }
}

module.exports = new LeadConfigController();
