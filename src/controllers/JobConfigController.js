const JobConfigService = require("../services/JobConfigService");
const { sendSuccess } = require("../utils/http");

class JobConfigController {
  // ==========================================
  // STATUS CONFIG
  // ==========================================
  async getStatuses(req, res) {
    const statuses = await JobConfigService.getStatuses();
    return sendSuccess(res, statuses);
  }

  async createStatus(req, res) {
    const status = await JobConfigService.createStatus(req.body);
    return sendSuccess(res, status, 201);
  }

  async updateStatus(req, res) {
    const status = await JobConfigService.updateStatus(req.params.id, req.body);
    return sendSuccess(res, status);
  }

  async deleteStatus(req, res) {
    await JobConfigService.deleteStatus(req.params.id);
    return sendSuccess(res, { message: "Xóa thành công" });
  }

  async reorderStatuses(req, res) {
    await JobConfigService.reorderStatuses(req.body.orderedIds);
    return sendSuccess(res, { message: "Cập nhật thứ tự thành công" });
  }

  // ==========================================
  // TASK TYPE CONFIG
  // ==========================================
  async getTaskTypes(req, res) {
    const types = await JobConfigService.getTaskTypes();
    return sendSuccess(res, types);
  }

  async createTaskType(req, res) {
    const type = await JobConfigService.createTaskType(req.body);
    return sendSuccess(res, type, 201);
  }

  async updateTaskType(req, res) {
    const type = await JobConfigService.updateTaskType(req.params.id, req.body);
    return sendSuccess(res, type);
  }

  async deleteTaskType(req, res) {
    await JobConfigService.deleteTaskType(req.params.id);
    return sendSuccess(res, { message: "Xóa thành công" });
  }

  // ==========================================
  // CHANNEL CONFIG
  // ==========================================
  async getChannels(req, res) {
    const channels = await JobConfigService.getChannels();
    return sendSuccess(res, channels);
  }

  async createChannel(req, res) {
    const channel = await JobConfigService.createChannel(req.body);
    return sendSuccess(res, channel, 201);
  }

  async updateChannel(req, res) {
    const channel = await JobConfigService.updateChannel(req.params.id, req.body);
    return sendSuccess(res, channel);
  }

  async deleteChannel(req, res) {
    await JobConfigService.deleteChannel(req.params.id);
    return sendSuccess(res, { message: "Xóa thành công" });
  }

  // ==========================================
  // REPEAT RULE CONFIG
  // ==========================================
  async getRepeatRules(req, res) {
    const rules = await JobConfigService.getRepeatRules();
    return sendSuccess(res, rules);
  }

  async getRepeatRuleById(req, res) {
    const rule = await JobConfigService.getRepeatRuleById(req.params.id);
    return sendSuccess(res, rule);
  }

  async createRepeatRule(req, res) {
    const rule = await JobConfigService.createRepeatRule(req.body, req.user);
    return sendSuccess(res, rule, 201);
  }

  async updateRepeatRule(req, res) {
    const rule = await JobConfigService.updateRepeatRule(req.params.id, req.body, req.user);
    return sendSuccess(res, rule);
  }

  async deleteRepeatRule(req, res) {
    await JobConfigService.deleteRepeatRule(req.params.id, req.user);
    return sendSuccess(res, { message: "Xóa thành công" });
  }
}

module.exports = new JobConfigController();
