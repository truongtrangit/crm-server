const LeadService = require("../services/LeadService");
const SystemLogService = require("../services/SystemLogService");
const { sendSuccess } = require("../utils/http");
const { RESOURCES } = require("../constants/rbac");

class LeadController {
  async getLeads(req, res) {
    const result = await LeadService.getLeads(req.query, req.user);
    return sendSuccess(res, 200, "Get leads success", result);
  }

  async getStageCounts(req, res) {
    const counts = await LeadService.getStageCounts(req.user);
    return sendSuccess(res, 200, "Get stage counts success", counts);
  }

  async getLead(req, res) {
    const lead = await LeadService.getLeadById(req.params.id);
    return sendSuccess(res, 200, "Get lead success", lead);
  }

  async createLead(req, res) {
    const lead = await LeadService.createLead(req.body);

    SystemLogService.log({
      action: "create",
      resource: RESOURCES.LEADS,
      resourceId: lead.id,
      resourceName: lead.name,
      description: `Tạo lead "${lead.name}"`,
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
      resourceId: lead.id,
      resourceName: lead.name,
      description: `Cập nhật lead "${lead.name}"`,
      metadata: { changes },
      req,
    });

    return sendSuccess(res, 200, "Update lead success", lead);
  }

  async confirmStage(req, res) {
    const { lead, changes, previousStage, newStage } =
      await LeadService.confirmStage(req.params.id, req.user);

    SystemLogService.log({
      action: "update",
      resource: RESOURCES.LEADS,
      resourceId: lead.id,
      resourceName: lead.name,
      description: `Chuyển lead "${lead.name}" từ "${previousStage}" sang "${newStage}"`,
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
      resourceId: lead.id,
      resourceName: lead.name,
      description: `Xóa lead "${lead.name}"`,
      req,
    });

    return sendSuccess(res, 200, "Delete lead success", { id: lead.id });
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
      resourceId: lead.id,
      resourceName: lead.name,
      description: `Thêm timeline cho lead "${lead.name}"`,
      req,
    });

    return sendSuccess(res, 200, "Add timeline success", lead);
  }
}

module.exports = new LeadController();
