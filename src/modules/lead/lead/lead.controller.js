const LeadService = require('./lead.service');
const { sendSuccess } = require('../../../core/utils/http');
const SystemLogService = require('../../system/log/systemLog.service');
const { RESOURCES } = require('../../../core/constants/rbac');

class LeadController {
  async getLeads(req, res) {
    const result = await LeadService.getLeads(
      req.query,
      req.resourceScopeFilter,
    );
    return sendSuccess(res, 200, "Get leads success", result);
  }

  async getStageCounts(req, res) {
    const counts = await LeadService.getStageCounts(req.resourceScopeFilter);
    return sendSuccess(res, 200, "Get stage counts success", counts);
  }

  async getLead(req, res) {
    const lead = await LeadService.getLeadById(req.params.id);
    return sendSuccess(res, 200, "Get lead success", lead);
  }

  async createLead(req, res) {
    const lead = await LeadService.createLead(req.body, req.user);
    SystemLogService.log({
      action: "create",
      resource: RESOURCES.LEADS,
      resourceId: lead.id,
      resourceName: lead.name,
      description: `Tạo lead mới: "${lead.name}"`,
      metadata: { newItem: lead },
      req,
    });
    return sendSuccess(res, 201, "Create lead success", lead);
  }

  async updateLead(req, res) {
    const { lead, changes } = await LeadService.updateLead(
      req.params.id,
      req.body,
      req.user,
    );
    SystemLogService.log({
      action: "update",
      resource: RESOURCES.LEADS,
      resourceId: req.params.id,
      resourceName: lead.name,
      description: `Cập nhật lead: "${lead.name}"`,
      metadata: { changes },
      req,
    });
    return sendSuccess(res, 200, "Update lead success", lead);
  }

  async selfAssignLead(req, res) {
    const { lead, changes } = await LeadService.selfAssignLead(
      req.params.id,
      req.body.functionId,
      req.user,
    );
    SystemLogService.log({
      action: "update",
      resource: RESOURCES.LEADS,
      resourceId: req.params.id,
      resourceName: lead.name,
      description: `Tự nhận phụ trách lead: "${lead.name}"`,
      metadata: { changes },
      req,
    });
    return sendSuccess(res, 200, "Self assign success", lead);
  }

  async confirmStage(req, res) {
    const { lead, changes } = await LeadService.confirmStage(
      req.params.id,
      req.user,
    );
    SystemLogService.log({
      action: "update",
      resource: RESOURCES.LEADS,
      resourceId: req.params.id,
      resourceName: lead.name,
      description: `Chuyển giai đoạn lead: "${lead.name}" sang "${lead.stage}"`,
      metadata: { changes },
      req,
    });
    return sendSuccess(res, 200, "Confirm stage success", lead);
  }

  async deleteLead(req, res) {
    const lead = await LeadService.deleteLead(req.params.id, req.user);
    SystemLogService.log({
      action: "delete",
      resource: RESOURCES.LEADS,
      resourceId: req.params.id,
      resourceName: lead.name,
      description: `Xóa lead: "${lead.name}"`,
      metadata: { deletedItem: lead },
      req,
    });
    return sendSuccess(res, 200, "Delete lead success", { id: lead.id });
  }

  async archiveLead(req, res) {
    const lead = await LeadService.archiveLead(req.params.id, req.user);
    SystemLogService.log({
      action: "update",
      resource: RESOURCES.LEADS,
      resourceId: req.params.id,
      resourceName: lead.name,
      description: `Lưu trữ lead: "${lead.name}"`,
      req,
    });
    return sendSuccess(res, 200, "Archive lead success", lead);
  }

  async unarchiveLead(req, res) {
    const lead = await LeadService.unarchiveLead(req.params.id, req.user);
    SystemLogService.log({
      action: "update",
      resource: RESOURCES.LEADS,
      resourceId: req.params.id,
      resourceName: lead.name,
      description: `Khôi phục lead từ lưu trữ: "${lead.name}"`,
      req,
    });
    return sendSuccess(res, 200, "Unarchive lead success", lead);
  }

  async addLeadTimeline(req, res) {
    const lead = await LeadService.addLeadTimeline(
      req.params.id,
      req.body,
      req.user,
    );
    SystemLogService.log({
      action: "update",
      resource: RESOURCES.LEADS,
      resourceId: req.params.id,
      resourceName: lead.name,
      description: `Thêm timeline cho lead "${lead.name}": "${req.body.title}"`,
      req,
    });
    return sendSuccess(res, 200, "Add timeline success", lead);
  }

  // ─── Discussion ───

  async addDiscussion(req, res) {
    const lead = await LeadService.addDiscussion(
      req.params.id,
      req.body.content,
      req.user,
    );
    SystemLogService.log({
      action: "update",
      resource: RESOURCES.LEADS,
      resourceId: req.params.id,
      resourceName: lead.name,
      description: `Thêm bình luận cho lead: "${lead.name}"`,
      req,
    });
    return sendSuccess(res, 200, "Add discussion success", lead);
  }

  // ─── Activity Logs ───

  async getActivityLogs(req, res) {
    const result = await LeadService.getActivityLogs(req.params.id, req.query);
    return sendSuccess(res, 200, "Get activity logs success", result);
  }
}

module.exports = new LeadController();
