const JobConfigService = require('./jobConfig.service');
const { sendSuccess } = require('../../../core/utils/http');
const SystemLogService = require('../../system/log/systemLog.service');
const { RESOURCES } = require('../../../routes/v1/rbac');

class JobConfigController {
  // ==========================================
  // STATUS CONFIG
  // ==========================================
  async getStatuses(req, res) {
    const statuses = await JobConfigService.getStatuses();
    return sendSuccess(res, 200, "Thành công", statuses);
  }

  async createStatus(req, res) {
    const status = await JobConfigService.createStatus(req.body);
    SystemLogService.log({
      action: "create",
      resource: RESOURCES.JOBHUB,
      resourceId: status.id,
      resourceName: status.name,
      description: `Tạo trạng thái công việc JobHub mới: "${status.name}"`,
      metadata: { newItem: status },
      req,
    });
    return sendSuccess(res, 201, "Tạo thành công", status);
  }

  async updateStatus(req, res) {
    const { status, changes } = await JobConfigService.updateStatus(req.params.id, req.body);
    SystemLogService.log({
      action: "update",
      resource: RESOURCES.JOBHUB,
      resourceId: req.params.id,
      resourceName: status.name,
      description: `Cập nhật trạng thái công việc JobHub: "${status.name}"`,
      metadata: { changes },
      req,
    });
    return sendSuccess(res, 200, "Cập nhật thành công", status);
  }

  async deleteStatus(req, res) {
    const force = req.query.force === 'true';
    const status = await JobConfigService.deleteStatus(req.params.id, force);
    SystemLogService.log({
      action: force ? "force_delete" : "delete",
      resource: RESOURCES.JOBHUB,
      resourceId: req.params.id,
      resourceName: status ? status.name : req.params.id,
      description: `${force ? "Xóa vĩnh viễn" : "Xóa"} trạng thái công việc JobHub: "${status ? status.name : req.params.id}"`,
      metadata: { deletedItem: status },
      req,
    });
    return sendSuccess(res, 200, "Xóa thành công");
  }

  async reorderStatuses(req, res) {
    await JobConfigService.reorderStatuses(req.body.orderedIds);
    SystemLogService.log({
      action: "update",
      resource: RESOURCES.JOBHUB,
      description: `Sắp xếp lại thứ tự các trạng thái công việc JobHub`,
      metadata: { orderedIds: req.body.orderedIds },
      req,
    });
    return sendSuccess(res, 200, "Cập nhật thứ tự thành công");
  }

  // ==========================================
  // TASK TYPE GROUP CONFIG
  // ==========================================
  async getTaskTypeGroups(req, res) {
    const groups = await JobConfigService.getTaskTypeGroups();
    return sendSuccess(res, 200, "Thành công", groups);
  }

  async createTaskTypeGroup(req, res) {
    const group = await JobConfigService.createTaskTypeGroup(req.body);
    SystemLogService.log({
      action: "create",
      resource: RESOURCES.JOBHUB,
      resourceId: group.id,
      resourceName: group.name,
      description: `Tạo nhóm loại công việc JobHub: "${group.name}"`,
      metadata: { newItem: group },
      req,
    });
    return sendSuccess(res, 201, "Tạo thành công", group);
  }

  async updateTaskTypeGroup(req, res) {
    const { group, changes } = await JobConfigService.updateTaskTypeGroup(req.params.id, req.body);
    SystemLogService.log({
      action: "update",
      resource: RESOURCES.JOBHUB,
      resourceId: req.params.id,
      resourceName: group.name,
      description: `Cập nhật nhóm loại công việc JobHub: "${group.name}"`,
      metadata: { changes },
      req,
    });
    return sendSuccess(res, 200, "Cập nhật thành công", group);
  }

  async deleteTaskTypeGroup(req, res) {
    const group = await JobConfigService.deleteTaskTypeGroup(req.params.id);
    SystemLogService.log({
      action: "delete",
      resource: RESOURCES.JOBHUB,
      resourceId: req.params.id,
      resourceName: group ? group.name : req.params.id,
      description: `Xóa nhóm loại công việc JobHub: "${group ? group.name : req.params.id}"`,
      metadata: { deletedItem: group },
      req,
    });
    return sendSuccess(res, 200, "Xóa thành công");
  }

  // ==========================================
  // TASK TYPE CONFIG
  // ==========================================
  async getTaskTypes(req, res) {
    const types = await JobConfigService.getTaskTypes();
    return sendSuccess(res, 200, "Thành công", types);
  }

  async createTaskType(req, res) {
    const type = await JobConfigService.createTaskType(req.body);
    SystemLogService.log({
      action: "create",
      resource: RESOURCES.JOBHUB,
      resourceId: type.id,
      resourceName: type.name,
      description: `Tạo loại công việc JobHub: "${type.name}"`,
      metadata: { newItem: type },
      req,
    });
    return sendSuccess(res, 201, "Tạo thành công", type);
  }

  async updateTaskType(req, res) {
    const { taskType, changes } = await JobConfigService.updateTaskType(req.params.id, req.body);
    SystemLogService.log({
      action: "update",
      resource: RESOURCES.JOBHUB,
      resourceId: req.params.id,
      resourceName: taskType.name,
      description: `Cập nhật loại công việc JobHub: "${taskType.name}"`,
      metadata: { changes },
      req,
    });
    return sendSuccess(res, 200, "Cập nhật thành công", taskType);
  }

  async deleteTaskType(req, res) {
    const type = await JobConfigService.deleteTaskType(req.params.id);
    SystemLogService.log({
      action: "delete",
      resource: RESOURCES.JOBHUB,
      resourceId: req.params.id,
      resourceName: type ? type.name : req.params.id,
      description: `Xóa loại công việc JobHub: "${type ? type.name : req.params.id}"`,
      metadata: { deletedItem: type },
      req,
    });
    return sendSuccess(res, 200, "Xóa thành công");
  }

  // ==========================================
  // CHANNEL CONFIG
  // ==========================================
  async getChannels(req, res) {
    const channels = await JobConfigService.getChannels();
    return sendSuccess(res, 200, "Thành công", channels);
  }

  async createChannel(req, res) {
    const channel = await JobConfigService.createChannel(req.body);
    SystemLogService.log({
      action: "create",
      resource: RESOURCES.JOBHUB,
      resourceId: channel.id,
      resourceName: channel.name,
      description: `Tạo kênh triển khai JobHub mới: "${channel.name}"`,
      metadata: { newItem: channel },
      req,
    });
    return sendSuccess(res, 201, "Tạo thành công", channel);
  }

  async updateChannel(req, res) {
    const { channel, changes } = await JobConfigService.updateChannel(req.params.id, req.body);
    SystemLogService.log({
      action: "update",
      resource: RESOURCES.JOBHUB,
      resourceId: req.params.id,
      resourceName: channel.name,
      description: `Cập nhật kênh triển khai JobHub: "${channel.name}"`,
      metadata: { changes },
      req,
    });
    return sendSuccess(res, 200, "Cập nhật thành công", channel);
  }

  async deleteChannel(req, res) {
    const channel = await JobConfigService.deleteChannel(req.params.id);
    SystemLogService.log({
      action: "delete",
      resource: RESOURCES.JOBHUB,
      resourceId: req.params.id,
      resourceName: channel ? channel.name : req.params.id,
      description: `Xóa kênh triển khai JobHub: "${channel ? channel.name : req.params.id}"`,
      metadata: { deletedItem: channel },
      req,
    });
    return sendSuccess(res, 200, "Xóa thành công");
  }

  // ==========================================
  // REPEAT RULE CONFIG
  // ==========================================
  async getRepeatRules(req, res) {
    const rules = await JobConfigService.getRepeatRules();
    return sendSuccess(res, 200, "Thành công", rules);
  }

  async getRepeatRuleById(req, res) {
    const rule = await JobConfigService.getRepeatRuleById(req.params.id);
    return sendSuccess(res, 200, "Thành công", rule);
  }

  async createRepeatRule(req, res) {
    const rule = await JobConfigService.createRepeatRule(req.body, req.user);
    SystemLogService.log({
      action: "create",
      resource: RESOURCES.JOBHUB,
      resourceId: rule.id,
      resourceName: rule.name,
      description: `Tạo quy tắc lặp lại JobHub mới: "${rule.name}"`,
      metadata: { newItem: rule },
      req,
    });
    return sendSuccess(res, 201, "Tạo thành công", rule);
  }

  async updateRepeatRule(req, res) {
    const { rule, changes } = await JobConfigService.updateRepeatRule(req.params.id, req.body, req.user);
    SystemLogService.log({
      action: "update",
      resource: RESOURCES.JOBHUB,
      resourceId: req.params.id,
      resourceName: rule.name,
      description: `Cập nhật quy tắc lặp lại JobHub: "${rule.name}"`,
      metadata: { changes },
      req,
    });
    return sendSuccess(res, 200, "Cập nhật thành công", rule);
  }

  async deleteRepeatRule(req, res) {
    const rule = await JobConfigService.deleteRepeatRule(req.params.id, req.user);
    SystemLogService.log({
      action: "delete",
      resource: RESOURCES.JOBHUB,
      resourceId: req.params.id,
      resourceName: rule ? rule.name : req.params.id,
      description: `Xóa quy tắc lặp lại JobHub: "${rule ? rule.name : req.params.id}"`,
      metadata: { deletedItem: rule },
      req,
    });
    return sendSuccess(res, 200, "Xóa thành công");
  }
}

module.exports = new JobConfigController();
