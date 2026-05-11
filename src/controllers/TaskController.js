const TaskService = require("../services/TaskService");
const { sendSuccess } = require("../utils/http");

class TaskController {
  async getTasks(req, res) {
    const result = await TaskService.getTasks(req.query);
    return sendSuccess(res, 200, "Get tasks success", result);
  }

  async getTask(req, res) {
    const task = await TaskService.getTaskById(req.params.id);
    return sendSuccess(res, 200, "Get task success", task);
  }

  async createTask(req, res) {
    const task = await TaskService.createTask(req.body, req.user);
    return sendSuccess(res, 201, "Create task success", task);
  }

  async updateTask(req, res) {
    const task = await TaskService.updateTask(req.params.id, req.body, req.user);
    return sendSuccess(res, 200, "Update task success", task);
  }

  async closeTask(req, res) {
    const task = await TaskService.closeTask(req.params.id, req.user);
    return sendSuccess(res, 200, "Close task success", task);
  }

  async deleteTask(req, res) {
    await TaskService.deleteTask(req.params.id, req.user);
    return sendSuccess(res, 200, "Delete task success", null);
  }

  async archiveTask(req, res) {
    const task = await TaskService.archiveTask(req.params.id, req.user);
    return sendSuccess(res, 200, "Archive task success", task);
  }

  async unarchiveTask(req, res) {
    const task = await TaskService.unarchiveTask(req.params.id, req.user);
    return sendSuccess(res, 200, "Unarchive task success", task);
  }

  // ─── Link / Unlink Event ───

  async linkEvent(req, res) {
    const task = await TaskService.linkEvent(req.params.id, req.body.eventId, req.user);
    return sendSuccess(res, 200, "Link event success", task);
  }

  async unlinkEvent(req, res) {
    const task = await TaskService.unlinkEvent(req.params.id, req.params.eventId, req.user);
    return sendSuccess(res, 200, "Unlink event success", task);
  }

  // ─── Link / Unlink Lead ───

  async linkLead(req, res) {
    const task = await TaskService.linkLead(req.params.id, req.body.leadId, req.user);
    return sendSuccess(res, 200, "Link lead success", task);
  }

  async unlinkLead(req, res) {
    const task = await TaskService.unlinkLead(req.params.id, req.params.leadId, req.user);
    return sendSuccess(res, 200, "Unlink lead success", task);
  }

  // ─── Tasks by Event/Lead ───

  async getTasksByEvent(req, res) {
    const tasks = await TaskService.getTasksByEventId(req.params.eventId, req.query);
    return sendSuccess(res, 200, "Get tasks by event success", tasks);
  }

  async getTasksByLead(req, res) {
    const tasks = await TaskService.getTasksByLeadId(req.params.leadId, req.query);
    return sendSuccess(res, 200, "Get tasks by lead success", tasks);
  }

  // ─── Search for linking ───

  async searchEvents(req, res) {
    const results = await TaskService.searchEvents(req.query.q || "");
    return sendSuccess(res, 200, "Search events success", results);
  }

  async searchLeads(req, res) {
    const results = await TaskService.searchLeads(req.query.q || "");
    return sendSuccess(res, 200, "Search leads success", results);
  }
}

module.exports = new TaskController();
