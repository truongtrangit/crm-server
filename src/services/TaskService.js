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
  async getTasks(queryParams = {}, scopeFilter = {}) {
    const {
      search = "",
      status,
      assignees,
      isArchived,
      page: rawPage = 1,
      limit: rawLimit = 20,
    } = queryParams;
    const page = Math.max(parseInt(rawPage, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(rawLimit, 10) || 20, 1), 100);
    const skip = (page - 1) * limit;
    const searchRegex = buildSearchRegex(search);

    const query = {};

    // ── RBAC Scoping — STAFF/MANAGER chỉ thấy task assigned/created ──
    if (scopeFilter.$or) {
      query.$and = [scopeFilter];
    }

    if (status) query.status = status;
    if (isArchived === "true") {
      query.isArchived = true;
    } else {
      query.isArchived = { $ne: true };
    }

    if (assignees) {
      const ids = assignees
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
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

    const pipeline = [
      { $match: query },
      {
        $lookup: {
          from: "eventactionchains",
          let: { taskId: "$id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$taskId", "$$taskId"] },
                    { $eq: ["$status", "active"] },
                  ],
                },
              },
            },
          ],
          as: "activeChains",
        },
      },
      {
        $addFields: {
          earliestScheduledAt: {
            $min: {
              $reduce: {
                input: {
                  $map: {
                    input: "$activeChains",
                    as: "chain",
                    in: {
                      $map: {
                        input: {
                          $filter: {
                            input: "$$chain.steps",
                            as: "step",
                            cond: { $eq: ["$$step.status", "active"] },
                          },
                        },
                        as: "activeStep",
                        in: "$$activeStep.scheduledAt",
                      },
                    },
                  },
                },
                initialValue: [],
                in: { $concatArrays: ["$$value", "$$this"] },
              },
            },
          },
        },
      },
      {
        $addFields: {
          sortScheduledAt: {
            $ifNull: ["$earliestScheduledAt", new Date("2099-12-31T23:59:59Z")],
          },
        },
      },
      {
        $sort: { sortScheduledAt: 1, createdAt: -1 },
      },
      {
        $project: {
          sortScheduledAt: 0,
          earliestScheduledAt: 0,
        },
      },
      { $skip: skip },
      { $limit: limit },
    ];

    const [itemsWithChains, totalItems] = await Promise.all([
      Task.aggregate(pipeline),
      Task.countDocuments(query),
    ]);

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
      throw createHttpError(404, "Tác vụ không tồn tại", {
        code: "TASK_NOT_FOUND",
      });
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

    let linkedEvents = [];
    if (data.linkedEvents && Array.isArray(data.linkedEvents)) {
      const eventIds = data.linkedEvents.map((e) => e.eventId).filter(Boolean);
      if (eventIds.length > 0) {
        const events = await Event.find({ id: { $in: eventIds } })
          .select("id name")
          .lean();
        linkedEvents = events.map((e) => ({
          eventId: e.id,
          eventName: e.name,
        }));
      }
    }
    if (data.eventId && !linkedEvents.some((e) => e.eventId === data.eventId)) {
      const event = await Event.findOne({ id: data.eventId })
        .select("id name")
        .lean();
      if (event)
        linkedEvents.push({ eventId: event.id, eventName: event.name });
    }

    let linkedLeads = [];
    if (data.linkedLeads && Array.isArray(data.linkedLeads)) {
      const leadIds = data.linkedLeads.map((l) => l.leadId).filter(Boolean);
      if (leadIds.length > 0) {
        const leads = await Lead.find({ id: { $in: leadIds } })
          .select("id name")
          .lean();
        linkedLeads = leads.map((l) => ({ leadId: l.id, leadName: l.name }));
      }
    }
    if (data.leadId && !linkedLeads.some((l) => l.leadId === data.leadId)) {
      const lead = await Lead.findOne({ id: data.leadId })
        .select("id name")
        .lean();
      if (lead) linkedLeads.push({ leadId: lead.id, leadName: lead.name });
    }

    const task = await Task.create({
      id,
      name: data.name,
      status: "active",
      createdBy: currentUser?.id || null,
      assignees,
      tags: data.tags || [],
      note: data.note || "",
      linkedEvents,
      linkedLeads,
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

    if (linkedEvents.length > 0) {
      linkedEvents.forEach((e) => {
        task.logs.push({
          action: "link",
          description: `Liên kết Sự kiện: ${e.eventName}`,
          user: {
            id: currentUser.id,
            name: currentUser.name,
            email: currentUser.email,
          },
        });
      });
    }

    if (linkedLeads.length > 0) {
      linkedLeads.forEach((l) => {
        task.logs.push({
          action: "link",
          description: `Liên kết Lead: ${l.leadName}`,
          user: {
            id: currentUser.id,
            name: currentUser.name,
            email: currentUser.email,
          },
        });
      });
    }

    await task.save();

    return task;
  }

  /**
   * Cập nhật tác vụ.
   */
  async updateTask(id, updates, currentUser) {
    const task = await this.getTaskById(id);

    if (task.status === "closed") {
      throw createHttpError(400, "Tác vụ đã đóng, không thể chỉnh sửa");
    }

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

    return { task, changes };
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

    // Close all action chains associated with this task
    const activeChains = await EventActionChain.find({
      taskId: id,
      status: "active",
    });
    for (const chain of activeChains) {
      chain.status = "closed";
      const current = chain.steps[chain.currentStepIndex];
      if (current && !current.isLocked) {
        current.status = "skipped";
      }
      chain.markModified("steps");
    }
    await Promise.all(activeChains.map((chain) => chain.save()));

    return task;
  }

  /**
   * Lưu trữ tác vụ.
   */
  async archiveTask(id, currentUser) {
    const task = await this.getTaskById(id);
    if (task.status !== "closed") {
      throw createHttpError(400, "Chỉ có thể lưu trữ tác vụ đã đóng");
    }
    task.isArchived = true;
    task.logs.push({
      action: "update",
      description: `Lưu trữ tác vụ`,
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
   * Khôi phục tác vụ.
   */
  async unarchiveTask(id, currentUser) {
    const task = await this.getTaskById(id);
    task.isArchived = false;
    task.logs.push({
      action: "update",
      description: `Khôi phục tác vụ`,
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
    if (task.status === "closed")
      throw createHttpError(400, "Tác vụ đã đóng, không thể chỉnh sửa");
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
    if (task.status === "closed")
      throw createHttpError(400, "Tác vụ đã đóng, không thể chỉnh sửa");
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
    if (task.status === "closed")
      throw createHttpError(400, "Tác vụ đã đóng, không thể chỉnh sửa");
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
    if (task.status === "closed")
      throw createHttpError(400, "Tác vụ đã đóng, không thể chỉnh sửa");
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

  /**
   * Lấy tất cả tasks liên kết với 1 event.
   */
  async getTasksByEventId(eventId, queryParams = {}) {
    const query = { "linkedEvents.eventId": eventId };
    if (queryParams.isArchived === "true") {
      query.isArchived = true;
    } else {
      query.isArchived = { $ne: true };
    }
    return Task.find(query).sort({ createdAt: -1 });
  }

  /**
   * Lấy tất cả tasks liên kết với 1 lead.
   */
  async getTasksByLeadId(leadId, queryParams = {}) {
    const query = { "linkedLeads.leadId": leadId };
    if (queryParams.isArchived === "true") {
      query.isArchived = true;
    } else {
      query.isArchived = { $ne: true };
    }
    return Task.find(query).sort({ createdAt: -1 });
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
        ? User.find({ id: { $in: userIds }, isActive: { $ne: false } })
            .select("id name avatar")
            .lean()
        : [],
      funcIds.length > 0
        ? StaffFunction.find({ id: { $in: funcIds } })
            .select("id title")
            .lean()
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
