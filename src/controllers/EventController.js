const EventService = require("../services/EventService");
const Event = require("../models/Event");
const { sendSuccess, sendError } = require("../utils/http");
const SystemLogService = require("../services/SystemLogService");
const { RESOURCES } = require("../constants/rbac");

// Ownership check is now handled in EventService

class EventController {
  async getEvents(req, res) {
    const result = await EventService.getEvents(req.query, req.resourceScopeFilter);
    return sendSuccess(res, 200, "Get event list success", result);
  }

  async getEventStats(req, res) {
    const stats = await EventService.getEventStats(req.resourceScopeFilter);
    return sendSuccess(res, 200, "Get event stats success", stats);
  }

  async getEventById(req, res) {
    const event = await EventService.getEventById(req.params.id);
    return sendSuccess(res, 200, "Get event detail success", event);
  }

  async createEvent(req, res) {
    const event = await EventService.createEvent(req.body || {}, req.user);
    SystemLogService.log({ action: "create", resource: RESOURCES.EVENTS, resourceId: event.id, resourceName: event.name, description: `Tạo sự kiện "${event.name}"`, metadata: { newItem: event }, req });
    return sendSuccess(res, 201, "Create event success", event);
  }

  async updateEvent(req, res) {
    const { event, changes } = await EventService.updateEvent(req.params.id, req.body || {});
    SystemLogService.log({ 
      action: "update", 
      resource: RESOURCES.EVENTS, 
      resourceId: req.params.id, 
      resourceName: event.name, 
      description: `Cập nhật sự kiện "${event.name}"`, 
      metadata: { changes },
      req 
    });
    return sendSuccess(res, 200, "Update event success", event);
  }

  async addEventTimeline(req, res) {
    const payload = req.body || {};
    const event = await EventService.addEventTimeline(req.params.id, payload, req.user);
    
    const typeLabel = payload.type === 'note' ? 'ghi chú' : payload.type === 'email' ? 'email' : payload.type === 'phone' ? 'cuộc gọi' : 'mục lịch sử';
    SystemLogService.log({ action: "create", resource: RESOURCES.EVENTS, resourceId: event.id, resourceName: event.name, description: `Thêm ${typeLabel} "${payload.title}" vào sự kiện "${event.name}"`, metadata: { newItem: event }, req });

    return sendSuccess(res, 201, "Add timeline entry success", event);
  }
  async deleteEventTimeline(req, res) {
    const roleId = (req.user?.roleId || '').toUpperCase();
    if (roleId !== 'OWNER' && roleId !== 'ADMIN') {
      return sendError(res, 403, "Chỉ Owner và Admin mới có quyền xoá bình luận/lịch sử");
    }

    const { id, timelineId } = req.params;
    const { event, timelineEntry } = await EventService.deleteEventTimeline(id, timelineId);

    const title = timelineEntry?.title ? `"${timelineEntry.title}"` : "mục lịch sử";
    const content = timelineEntry?.content ? ` (Nội dung: "${timelineEntry.content.substring(0, 50)}${timelineEntry.content.length > 50 ? '...' : ''}")` : '';

    SystemLogService.log({ 
      action: "delete", 
      resource: RESOURCES.EVENTS, 
      resourceId: event.id, 
      resourceName: event.name, 
      description: `Xoá ${title}${content} khỏi sự kiện "${event.name}"`, 
      metadata: { deletedTimeline: timelineEntry },
      req 
    });

    return sendSuccess(res, 200, "Xoá bình luận thành công", event);
  }


  async unassignEvent(req, res) {
    const targetUserId = req.body?.userId || null;
    const event = await EventService.unassignEvent(req.params.id, req.user, targetUserId);
    SystemLogService.log({ action: "unassign", resource: RESOURCES.EVENTS, resourceId: event.id, resourceName: event.name, description: `Bỏ phân công khỏi sự kiện "${event.name}"`, req });
    return sendSuccess(res, 200, 'Unassign thành công', event);
  }

  /**
   * Tự gán bản thân vào event (multi-assignee).
   * Cho phép nhiều người cùng assign vào 1 event.
   */
  async selfAssignEvent(req, res) {
    const event = await EventService.selfAssignEvent(req.params.id, req.body.functionId, req.user);
    SystemLogService.log({ action: "assign", resource: RESOURCES.EVENTS, resourceId: event.id, resourceName: event.name, description: `Tự nhận sự kiện "${event.name}"`, req });
    return sendSuccess(res, 200, 'Tự nhận sự kiện thành công', event);
  }

  async deleteEvent(req, res) {
    const event = await Event.findOne({ id: req.params.id });
    const name = event ? event.name : req.params.id;
    await EventService.deleteEvent(req.params.id, req.user);
    SystemLogService.log({ action: "delete", resource: RESOURCES.EVENTS, resourceId: req.params.id, resourceName: name, description: `Xóa sự kiện "${name}"`, metadata: { deletedItem: event }, req });
    return sendSuccess(res, 200, "Delete event success", null);
  }

  async archiveEvent(req, res) {
    const event = await EventService.archiveEvent(req.params.id, req.user);
    SystemLogService.log({ action: "update", resource: RESOURCES.EVENTS, resourceId: event.id, resourceName: event.name, description: `Lưu trữ sự kiện "${event.name}"`, req });
    return sendSuccess(res, 200, "Archive event success", event);
  }

  async unarchiveEvent(req, res) {
    const event = await EventService.unarchiveEvent(req.params.id, req.user);
    SystemLogService.log({ action: "update", resource: RESOURCES.EVENTS, resourceId: event.id, resourceName: event.name, description: `Khôi phục sự kiện "${event.name}" từ lưu trữ`, req });
    return sendSuccess(res, 200, "Unarchive event success", event);
  }

  async syncCustomer(req, res) {
    const event = await EventService.syncCustomer(req.params.id);
    return sendSuccess(res, 200, "Sync customer success", event);
  }
}

module.exports = new EventController();
