const Task = require("../models/Task");
const Event = require("../models/Event");
const Lead = require("../models/Lead");
const User = require("../models/User");
const StaffFunction = require("../models/StaffFunction");
const EventActionChain = require("../models/EventActionChain");
const { generateMonotonicId } = require("../utils/id");
const { buildSearchRegex } = require("../utils/query");
const { createHttpError } = require("../utils/http");

class TaskService {
  /**
   * List tasks with pagination + search.
   */
  async getTasks(queryParams = {}) {
    const { search = "", status, assignees, page: rawPage = 1, limit: rawLimit = 20 } = queryParams;
    const page = Math.max(parseInt(rawPage, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(rawLimit, 10) || 20, 1), 100);
    const skip = (page - 1) * limit;
    const searchRegex = buildSearchRegex(search);

    const query = {};
    if (status) query.status = status;

    if (assignees) {
      const ids = assignees.split(",").map(id => id.trim()).filter(Boolean);
      if (ids.length > 0) {
        query["assignees.userId"] = { $in: ids };
      }
    }

    if (searchRegex) {
      query.$or = [
        { name: searchRegex },
        { id: searchRegex },
        { "assignees.userName": searchRegex },
        { tags: searchRegex },
      ];
    }

    const [items, totalItems] = await Promise.all([
      Task.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Task.countDocuments(query),
    ]);

    const taskIds = items.map(t => t.id);
    const chains = await EventActionChain.find({ taskId: { $in: taskIds }, status: "active" }).lean();

    const chainsByTaskId = {};
    for (const chain of chains) {
      if (!chainsByTaskId[chain.taskId]) chainsByTaskId[chain.taskId] = [];
      chainsByTaskId[chain.taskId].push(chain);
    }

    const itemsWithChains = items.map(task => ({
      ...task,
      activeChains: chainsByTaskId[task.id] || []
    }));

    const totalPages = Math.ceil(totalItems / limit);

    return {
      items: itemsWithChains,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async getTaskById(id) {
    const task = await Task.findOne({ id });
    if (!task) {
      throw createHttpError(404, "Tác vụ không tồn tại", { code: "TASK_NOT_FOUND" });
    }
    return task;
  }

  /**
   * Tạo tác vụ mới.
   */
  async createTask(data, currentUser) {
    const id = await generateMonotonicId("TASK");

    // Resolve assignees — enrich userName, userAvatar, functionTitle
    const assignees = await this._resolveAssignees(data.assignees || []);

    const task = await Task.create({
      id,
      name: data.name,
      status: "active",
      assignees,
      tags: data.tags || [],
      note: data.note || "",
      linkedEvents: [],
      linkedLeads: [],
    });

    task.logs.push({
      action: "create",
      description: `Tạo mới tác vụ`,
      user: {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
      },
    });

    await task.save();

    return task;
  }

  /**
   * Cập nhật tác vụ.
   */
  async updateTask(id, updates, currentUser) {
    const task = await this.getTaskById(id);

    // Resolve assignees nếu có gửi lên
    if (updates.assignees) {
      updates.assignees = await this._resolveAssignees(updates.assignees);
    }

    const allowedFields = ["name", "status", "assignees", "tags", "note"];
    const changes = {};

    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        // Deep compare arrays/objects to prevent false positives
        const oldVal = JSON.stringify(task[key]);
        const newVal = JSON.stringify(updates[key]);
        if (oldVal !== newVal) {
          changes[key] = { old: task[key], new: updates[key] };
          task[key] = updates[key];
        }
      }
    }

    if (Object.keys(changes).length > 0) {
      task.logs.push({
        action: "update",
        description: `Cập nhật thông tin tác vụ`,
        metadata: { changes },
        user: {
          id: currentUser.id,
          name: currentUser.name,
          email: currentUser.email,
        },
      });
    }

    await task.save();

    return task;
  }

  /**
   * Đóng tác vụ.
   */
  async closeTask(id, currentUser) {
    const task = await this.getTaskById(id);
    if (task.status === "closed") {
      throw createHttpError(400, "Tác vụ đã đóng");
    }
    task.status = "closed";
    task.logs.push({
      action: "update",
      description: `Đóng tác vụ`,
      user: {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
      },
    });

    await task.save();

    return task;
  }

  /**
   * Xóa tác vụ (soft delete).
   */
  async deleteTask(id, currentUser) {
    const task = await this.getTaskById(id);
    await task.softDelete();

    task.logs.push({
      action: "delete",
      description: `Xóa tác vụ`,
      user: {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
      },
    });

    await task.save();

    return task;
  }

  /**
   * Liên kết Event vào Task.
   */
  async linkEvent(taskId, eventId, currentUser) {
    const task = await this.getTaskById(taskId);
    const event = await Event.findOne({ id: eventId });
    if (!event) throw createHttpError(404, "Event không tồn tại");

    const alreadyLinked = task.linkedEvents.some((e) => e.eventId === eventId);
    if (alreadyLinked) throw createHttpError(409, "Event đã được liên kết");

    task.linkedEvents.push({
      eventId: event.id,
      eventName: event.name,
    });

    task.logs.push({
      action: "link",
      description: `Liên kết Sự kiện: ${event.name}`,
      user: {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
      },
    });
    await task.save();

    return task;
  }

  /**
   * Gỡ liên kết Event.
   */
  async unlinkEvent(taskId, eventId, currentUser) {
    const task = await this.getTaskById(taskId);
    task.linkedEvents = task.linkedEvents.filter((e) => e.eventId !== eventId);

    task.logs.push({
      action: "unlink",
      description: `Gỡ liên kết Sự kiện (ID: ${eventId})`,
      user: {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
      },
    });
    await task.save();
    return task;
  }

  /**
   * Liên kết Lead vào Task.
   */
  async linkLead(taskId, leadId, currentUser) {
    const task = await this.getTaskById(taskId);
    const lead = await Lead.findOne({ id: leadId });
    if (!lead) throw createHttpError(404, "Lead không tồn tại");

    const alreadyLinked = task.linkedLeads.some((l) => l.leadId === leadId);
    if (alreadyLinked) throw createHttpError(409, "Lead đã được liên kết");

    task.linkedLeads.push({
      leadId: lead.id,
      leadName: lead.name,
    });

    task.logs.push({
      action: "link",
      description: `Liên kết Lead: ${lead.name}`,
      user: {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
      },
    });
    await task.save();

    return task;
  }

  /**
   * Gỡ liên kết Lead.
   */
  async unlinkLead(taskId, leadId, currentUser) {
    const task = await this.getTaskById(taskId);
    task.linkedLeads = task.linkedLeads.filter((l) => l.leadId !== leadId);

    task.logs.push({
      action: "unlink",
      description: `Gỡ liên kết Lead (ID: ${leadId})`,
      user: {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
      },
    });
    await task.save();
    return task;
  }

  async checkTaskOwnership(id, currentUser) {
    const roleId = (currentUser?.roleId || '').toUpperCase();
    const ELEVATED_ROLES = ['OWNER', 'ADMIN', 'MANAGER'];
    if (ELEVATED_ROLES.includes(roleId)) return true;

    const task = await Task.findOne({ id });
    if (!task) throw createHttpError(404, "Task không tồn tại");
    if (task.assignees.some(a => a.userId === currentUser.id)) return true;
    throw createHttpError(403, "Bạn không có quyền cập nhật tác vụ này");
  }

  /**
   * Lấy tất cả tasks liên kết với 1 event.
   */
  async getTasksByEventId(eventId) {
    return Task.find({ "linkedEvents.eventId": eventId }).sort({ createdAt: -1 });
  }

  /**
   * Lấy tất cả tasks liên kết với 1 lead.
   */
  async getTasksByLeadId(leadId) {
    return Task.find({ "linkedLeads.leadId": leadId }).sort({ createdAt: -1 });
  }

  /**
   * Search events for linking (autocomplete).
   */
  async searchEvents(query) {
    const regex = new RegExp(query, "i");
    return Event.find({
      $or: [{ name: regex }, { id: regex }, { "customer.name": regex }],
    })
      .select("id name customer.name group")
      .limit(20);
  }

  /**
   * Search leads for linking (autocomplete).
   */
  async searchLeads(query) {
    const regex = new RegExp(query, "i");
    return Lead.find({
      $or: [{ name: regex }, { id: regex }, { email: regex }, { phone: regex }],
    })
      .select("id name email phone stage")
      .limit(20);
  }

  // ─── Private Helpers ───

  /**
   * Resolve raw assignees [{ userId, functionId }] → enrich from DB.
   */
  async _resolveAssignees(rawAssignees) {
    if (!rawAssignees || rawAssignees.length === 0) return [];

    const userIds = rawAssignees.map((a) => a.userId).filter(Boolean);
    const funcIds = rawAssignees.map((a) => a.functionId).filter(Boolean);

    const [users, funcs] = await Promise.all([
      userIds.length > 0
        ? User.find({ id: { $in: userIds }, isActive: { $ne: false } }).select("id name avatar")
        : [],
      funcIds.length > 0
        ? StaffFunction.find({ id: { $in: funcIds } }).select("id title")
        : [],
    ]);

    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
    const funcMap = Object.fromEntries(funcs.map((f) => [f.id, f]));

    rawAssignees.forEach((a) => {
      if (!userMap[a.userId]) {
        throw createHttpError(400, "User not found or inactive", {
          code: "USER_NOT_FOUND",
        });
      }
    });

    return rawAssignees
      .filter((a) => a.userId && userMap[a.userId])
      .map((a) => ({
        userId: a.userId,
        userName: userMap[a.userId]?.name || "",
        userAvatar: userMap[a.userId]?.avatar || "",
        functionId: a.functionId || null,
        functionTitle: a.functionId ? funcMap[a.functionId]?.title || "" : "",
      }));
  }
}

module.exports = new TaskService();
