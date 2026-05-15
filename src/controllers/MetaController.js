const MetaService = require("../services/MetaService");
const { sendSuccess } = require("../utils/http");
const SystemLogService = require("../services/SystemLogService");

const { RESOURCES } = require('../constants/rbac')

class MetaController {
  // ─── Config ─────────────────────────────────────────────────────────────────

  async getConfigs(_req, res) {
    const configs = await MetaService.getConfigs();
    return sendSuccess(res, 200, "Lấy danh sách cấu hình thành công", configs);
  }

  async createConfig(req, res) {
    const config = await MetaService.createConfig(req.body);
    SystemLogService.log({
      action: "create",
      resource: RESOURCES.META,
      resourceId: config.id,
      resourceName: config.name,
      description: `Tạo loại chương trình "${config.name}"`,
      metadata: { newItem: config },
      req,
    });
    return sendSuccess(res, 201, "Tạo cấu hình thành công", config);
  }

  async updateConfig(req, res) {
    const { config, changes } = await MetaService.updateConfig(req.params.id, req.body);
    SystemLogService.log({
      action: "update",
      resource: RESOURCES.META,
      resourceId: config.id,
      resourceName: config.name,
      description: `Cập nhật loại chương trình "${config.name}"`,
      metadata: { changes },
      req,
    });
    return sendSuccess(res, 200, "Cập nhật cấu hình thành công", config);
  }

  async deleteConfig(req, res) {
    const config = await MetaService.deleteConfig(req.params.id);
    const name = config ? config.name : req.params.id;
    SystemLogService.log({
      action: "delete",
      resource: RESOURCES.META,
      resourceId: req.params.id,
      resourceName: name,
      description: `Xóa loại chương trình "${name}"`,
      metadata: { deletedItem: config },
      req,
    });
    return sendSuccess(res, 200, "Xóa cấu hình thành công", null);
  }

  // ─── Programs ──────────────────────────────────────────────────────────────

  async getPrograms(req, res) {
    const result = await MetaService.getPrograms(req.query, req.resourceScopeFilter);
    return sendSuccess(res, 200, "Lấy danh sách chương trình thành công", result);
  }

  async getProgramById(req, res) {
    const program = await MetaService.getProgramById(req.params.id);
    return sendSuccess(res, 200, "Lấy chi tiết chương trình thành công", program);
  }

  async createProgram(req, res) {
    const program = await MetaService.createProgram(req.body, req.user);
    SystemLogService.log({
      action: "create",
      resource: RESOURCES.META,
      resourceId: program.id,
      resourceName: program.name,
      description: `Tạo chương trình "${program.name}"`,
      metadata: { newItem: program },
      req,
    });
    return sendSuccess(res, 201, "Tạo chương trình thành công", program);
  }

  async updateProgram(req, res) {
    const { program, changes } = await MetaService.updateProgram(req.params.id, req.body, req.user);
    SystemLogService.log({
      action: "update",
      resource: RESOURCES.META,
      resourceId: program.id,
      resourceName: program.name,
      description: `Cập nhật chương trình "${program.name}"`,
      metadata: { changes },
      req,
    });
    return sendSuccess(res, 200, "Cập nhật chương trình thành công", program);
  }

  async deleteProgram(req, res) {
    const program = await MetaService.deleteProgram(req.params.id, req.user);
    const name = program ? program.name : req.params.id;
    SystemLogService.log({
      action: "delete",
      resource: RESOURCES.META,
      resourceId: req.params.id,
      resourceName: name,
      description: `Xóa chương trình "${name}"`,
      metadata: { deletedItem: program },
      req,
    });
    return sendSuccess(res, 200, "Xóa chương trình thành công", null);
  }

  // ─── Milestones ─────────────────────────────────────────────────────────────

  async addMilestone(req, res) {
    const program = await MetaService.addMilestone(
      req.params.id,
      req.body,
      req.user,
    );
    SystemLogService.log({
      action: "create",
      resource: RESOURCES.META,
      resourceId: req.params.id,
      resourceName: req.params.id,
      description: `Thêm tiến độ "${req.params.id}"`,
      req,
    });
    return sendSuccess(res, 201, "Cập nhật tiến độ thành công", program);
  }

  async addBatchMilestones(req, res) {
    const program = await MetaService.addBatchMilestones(
      req.params.id,
      req.body,
      req.user,
    );
    const updatedMetrics = (req.body.updates || []).map((u) => u.metricName).join(", ");
    SystemLogService.log({
      action: "create",
      resource: RESOURCES.META,
      resourceId: req.params.id,
      resourceName: req.params.id,
      description: `Cập nhật hàng loạt tiến độ "${req.params.id}" — [${updatedMetrics}]`,
      metadata: { updates: req.body.updates },
      req,
    });
    return sendSuccess(res, 201, "Cập nhật tiến độ hàng loạt thành công", program);
  }

  async updateMilestone(req, res) {
    const { program, changes } = await MetaService.updateMilestone(req.params.id, req.params.milestoneId, req.body, req.user);
    SystemLogService.log({
      action: "update",
      resource: RESOURCES.META,
      resourceId: req.params.id,
      resourceName: req.params.id,
      description: `Cập nhật tiến độ "${req.params.id}"`,
      metadata: { changes },
      req,
    });
    return sendSuccess(res, 200, "Cập nhật tiến độ thành công", program);
  }

  async deleteMilestone(req, res) {
    const program = await MetaService.deleteMilestone(req.params.id, req.params.milestoneId, req.user);
    SystemLogService.log({
      action: "delete",
      resource: RESOURCES.META,
      resourceId: req.params.id,
      resourceName: req.params.id,
      description: `Xóa tiến độ "${req.params.id}"`,
      req,
    });
    return sendSuccess(res, 200, "Xóa tiến độ thành công", program);
  }

  // ─── Tasks ──────────────────────────────────────────────────────────────────

  async addTask(req, res) {
    const program = await MetaService.addTask(req.params.id, req.body, req.user);
    SystemLogService.log({
      action: "create",
      resource: RESOURCES.META,
      resourceId: req.params.id,
      resourceName: req.params.id,
      description: `Thêm công việc "${req.params.id}"`,
      req,
    });
    return sendSuccess(res, 201, "Thêm công việc thành công", program);
  }

  async updateTask(req, res) {
    const { program, changes } = await MetaService.updateTask(
      req.params.id,
      req.params.taskId,
      req.body,
      req.user
    );
    SystemLogService.log({
      action: "update",
      resource: RESOURCES.META,
      resourceId: req.params.id,
      resourceName: req.params.id,
      description: `Cập nhật công việc "${req.params.id}"`,
      metadata: { changes },
      req,
    });
    return sendSuccess(res, 200, "Cập nhật công việc thành công", program);
  }

  async deleteTask(req, res) {
    const program = await MetaService.deleteTask(
      req.params.id,
      req.params.taskId,
      req.user
    );
    SystemLogService.log({
      action: "delete",
      resource: RESOURCES.META,
      resourceId: req.params.id,
      resourceName: req.params.id,
      description: `Xóa công việc "${req.params.id}"`,
      req,
    });
    return sendSuccess(res, 200, "Xóa công việc thành công", program);
  }

  // ─── Attachments ────────────────────────────────────────────────────────────

  async addAttachment(req, res) {
    const program = await MetaService.addAttachment(
      req.params.id,
      req.body,
      req.user,
    );
    SystemLogService.log({
      action: "create",
      resource: RESOURCES.META,
      resourceId: req.params.id,
      resourceName: req.params.id,
      description: `Thêm tài liệu "${req.params.id}"`,
      req,
    });
    return sendSuccess(res, 201, "Thêm tài liệu thành công", program);
  }

  async deleteAttachment(req, res) {
    const program = await MetaService.deleteAttachment(
      req.params.id,
      req.params.attachmentId,
      req.user
    );
    SystemLogService.log({
      action: "delete",
      resource: RESOURCES.META,
      resourceId: req.params.id,
      resourceName: req.params.id,
      description: `Xóa tài liệu "${req.params.id}"`,
      req,
    });
    return sendSuccess(res, 200, "Xóa tài liệu thành công", program);
  }

  // ─── Comments ──────────────────────────────────────────────────────────────

  async addComment(req, res) {
    const program = await MetaService.addComment(
      req.params.id,
      req.body,
      req.user,
    );
    SystemLogService.log({
      action: "create",
      resource: RESOURCES.META,
      resourceId: req.params.id,
      resourceName: req.params.id,
      description: `Thêm bình luận vào chương trình "${req.params.id}"`,
      req,
    });
    return sendSuccess(res, 201, "Thêm bình luận thành công", program);
  }

  async deleteComment(req, res) {
    const program = await MetaService.deleteComment(
      req.params.id,
      req.params.commentId,
      req.user,
    );
    SystemLogService.log({
      action: "delete",
      resource: RESOURCES.META,
      resourceId: req.params.id,
      resourceName: req.params.id,
      description: `Xóa bình luận khỏi chương trình "${req.params.id}"`,
      req,
    });
    return sendSuccess(res, 200, "Xóa bình luận thành công", program);
  }
}

module.exports = new MetaController();
