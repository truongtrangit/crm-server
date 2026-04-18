const EventService = require("../services/EventService");
const Event = require("../models/Event");
const { sendSuccess, sendError } = require("../utils/http");
const { buildPaginatedResponse } = require("../utils/pagination");
const { ROLE_DEFINITIONS } = require("../constants/rbac");

// Roles that bypass ownership check (can update any event)
const ELEVATED_ROLES = ['OWNER', 'ADMIN', 'MANAGER'];

/**
 * Check if the current user is a STAFF and the event is NOT assigned to them.
 * Returns the event doc so it can be reused. Throws/returns null on not-found.
 */
async function checkEventOwnership(req, res) {
  const roleId = (req.user?.roleId || '').toUpperCase();
  if (ELEVATED_ROLES.includes(roleId)) return true; // bypass

  // STAFF: phải là người được assign
  const event = await Event.findOne({ id: req.params.id });
  if (!event) {
    sendError(res, 404, "Event not found");
    return false;
  }
  if (event.assigneeId !== req.user.id) {
    sendError(res, 403, "Bạn chỉ có thể cập nhật sự kiện được giao cho bạn");
    return false;
  }
  return true;
}

class EventController {
  async getEvents(req, res) {
    const { events, totalItems, page, limit } = await EventService.getEvents(req.query, req.user);
    return sendSuccess(
      res,
      200,
      "Get event list success",
      buildPaginatedResponse(events, totalItems, page, limit)
    );
  }

  async getEventStats(req, res) {
    const stats = await EventService.getEventStats(req.user);
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
    const allowed = await checkEventOwnership(req, res);
    if (!allowed) return;
    const event = await EventService.updateEvent(req.params.id, req.body || {});
    return sendSuccess(res, 200, "Update event success", event);
  }

  async addEventTimeline(req, res) {
    const allowed = await checkEventOwnership(req, res);
    if (!allowed) return;
    const event = await EventService.addEventTimeline(req.params.id, req.body || {}, req.user);
    return sendSuccess(res, 201, "Add timeline entry success", event);
  }

  /**
   * Unassign người phụ trách khỏi event.
   * - OWNER / ADMIN : unassign bất kỳ ai
   * - MANAGER       : unassign chính mình hoặc staff trực thuộc
   * - STAFF         : chỉ unassign chính mình (event.assigneeId === req.user.id)
   */
  async unassignEvent(req, res) {
    const actorRole = (req.user?.roleId || '').toUpperCase();

    const event = await Event.findOne({ id: req.params.id });
    if (!event) return sendError(res, 404, 'Event not found');

    if (!event.assigneeId) {
      return sendError(res, 400, 'Sự kiện này chưa có người phụ trách');
    }

    // STAFF: chỉ được bỏ chính mình
    if (actorRole === 'STAFF') {
      if (event.assigneeId !== req.user.id) {
        return sendError(res, 403, 'Bạn chỉ có thể bỏ nhận sự kiện của chính mình');
      }
    }

    // MANAGER: chỉ bỏ được chính mình hoặc staff trực thuộc
    if (actorRole === 'MANAGER') {
      const isSelf = event.assigneeId === req.user.id;
      if (!isSelf) {
        const User = require('../models/User');
        const assigneeUser = await User.findOne({ id: event.assigneeId });
        const isDirectStaff = assigneeUser?.managerId === req.user.id;
        if (!isDirectStaff) {
          return sendError(res, 403, 'Bạn chỉ có thể bỏ phân công của chính bạn hoặc nhân viên trực thuộc');
        }
      }
    }

    // Thực hiện unassign
    event.assigneeId = null;
    event.assignee = { name: '', avatar: '', role: '', department: [], group: [] };
    await event.save();
    return sendSuccess(res, 200, 'Unassign thành công', event);
  }

  /**
   * Tự gán bản thân vào event chưa có người phụ trách.
   * - Bất kỳ role nào có EVENTS_UPDATE đều có thể tự nhận
   * - Chỉ cho phép khi event.assigneeId === null
   */
  async selfAssignEvent(req, res) {
    const event = await Event.findOne({ id: req.params.id });
    if (!event) return sendError(res, 404, 'Event not found');

    if (event.assigneeId) {
      return sendError(res, 409, 'Sự kiện này đã có người phụ trách');
    }

    const actor = req.user;
    event.assigneeId = actor.id;
    event.assignee = {
      name: actor.name || '',
      avatar: actor.avatar || '',
      role: actor.roleId || '',
      department: actor.department || [],
      group: actor.group || [],
    };
    await event.save();
    return sendSuccess(res, 200, 'Tự nhận sự kiện thành công', event);
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
