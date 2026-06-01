const JobConfigService = require("../services/JobConfigService");
const { sendSuccess } = require("../utils/http");

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
    return sendSuccess(res, 201, "Tạo thành công", status);
  }

  async updateStatus(req, res) {
    const status = await JobConfigService.updateStatus(req.params.id, req.body);
    return sendSuccess(res, 200, "Cập nhật thành công", status);
  }

  async deleteStatus(req, res) {
    await JobConfigService.deleteStatus(req.params.id);
    return sendSuccess(res, 200, "Xóa thành công");
  }

  async reorderStatuses(req, res) {
    await JobConfigService.reorderStatuses(req.body.orderedIds);
    return sendSuccess(res, 200, "Cập nhật thứ tự thành công");
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
    return sendSuccess(res, 201, "Tạo thành công", type);
  }

  async updateTaskType(req, res) {
    const type = await JobConfigService.updateTaskType(req.params.id, req.body);
    return sendSuccess(res, 200, "Cập nhật thành công", type);
  }

  async deleteTaskType(req, res) {
    await JobConfigService.deleteTaskType(req.params.id);
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
    return sendSuccess(res, 201, "Tạo thành công", channel);
  }

  async updateChannel(req, res) {
    const channel = await JobConfigService.updateChannel(req.params.id, req.body);
    return sendSuccess(res, 200, "Cập nhật thành công", channel);
  }

  async deleteChannel(req, res) {
    await JobConfigService.deleteChannel(req.params.id);
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
    return sendSuccess(res, 201, "Tạo thành công", rule);
  }

  async updateRepeatRule(req, res) {
    const rule = await JobConfigService.updateRepeatRule(req.params.id, req.body, req.user);
    return sendSuccess(res, 200, "Cập nhật thành công", rule);
  }

  async deleteRepeatRule(req, res) {
    await JobConfigService.deleteRepeatRule(req.params.id, req.user);
    return sendSuccess(res, 200, "Xóa thành công");
  }
}

module.exports = new JobConfigController();
