const LeadService = require("../services/LeadService");
const { sendSuccess } = require("../utils/http");

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
    const lead = await LeadService.createLead(req.body, req.user);
    return sendSuccess(res, 201, "Create lead success", lead);
  }

  async updateLead(req, res) {
    const { lead } = await LeadService.updateLead(
      req.params.id,
      req.body,
      req.user,
    );
    return sendSuccess(res, 200, "Update lead success", lead);
  }

  async confirmStage(req, res) {
    const { lead } = await LeadService.confirmStage(req.params.id, req.user);
    return sendSuccess(res, 200, "Confirm stage success", lead);
  }

  async deleteLead(req, res) {
    const lead = await LeadService.deleteLead(req.params.id, req.user);
    return sendSuccess(res, 200, "Delete lead success", { id: lead.id });
  }

  async addLeadTimeline(req, res) {
    const lead = await LeadService.addLeadTimeline(
      req.params.id,
      req.body,
      req.user,
    );
    return sendSuccess(res, 200, "Add timeline success", lead);
  }

  // ─── Discussion ───

  async addDiscussion(req, res) {
    const lead = await LeadService.addDiscussion(
      req.params.id,
      req.body.content,
      req.user,
    );
    return sendSuccess(res, 200, "Add discussion success", lead);
  }

  // ─── Activity Logs ───

  async getActivityLogs(req, res) {
    const result = await LeadService.getActivityLogs(
      req.params.id,
      req.query,
    );
    return sendSuccess(res, 200, "Get activity logs success", result);
  }
}

module.exports = new LeadController();
