const EventService = require("../services/EventService");
const { sendSuccess } = require("../utils/http");
const { buildPaginatedResponse } = require("../utils/pagination");

class EventController {
  async getEvents(req, res) {
    const { events, totalItems, page, limit } = await EventService.getEvents(req.query);
    return sendSuccess(
      res,
      200,
      "Get event list success",
      buildPaginatedResponse(events, totalItems, page, limit)
    );
  }

  async getEventStats(req, res) {
    const stats = await EventService.getEventStats();
    return sendSuccess(res, 200, "Get event stats success", stats);
  }

  async getEventById(req, res) {
    const event = await EventService.getEventById(req.params.id);
    return sendSuccess(res, 200, "Get event detail success", event);
  }

  async createEvent(req, res) {
    const event = await EventService.createEvent(req.body || {}, req.user);
    return sendSuccess(res, 201, "Create event success", event);
  }

  async updateEvent(req, res) {
    const event = await EventService.updateEvent(req.params.id, req.body || {});
    return sendSuccess(res, 200, "Update event success", event);
  }

  async addEventTimeline(req, res) {
    const event = await EventService.addEventTimeline(req.params.id, req.body || {}, req.user);
    return sendSuccess(res, 201, "Add timeline entry success", event);
  }

  async deleteEvent(req, res) {
    await EventService.deleteEvent(req.params.id);
    return sendSuccess(res, 200, "Delete event success", null);
  }

  async syncCustomer(req, res) {
    const event = await EventService.syncCustomer(req.params.id);
    return sendSuccess(res, 200, "Sync customer success", event);
  }
}

module.exports = new EventController();
