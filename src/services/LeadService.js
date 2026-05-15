const Lead = require("../models/Lead");
const Customer = require("../models/Customer");
const User = require("../models/User");
const StaffFunction = require("../models/StaffFunction");
const Task = require("../models/Task");
const TaskService = require("./TaskService");
const { generateMonotonicId, ID_PREFIXES } = require("../utils/id");
const { buildSearchRegex } = require("../utils/query");
const { resolveSort } = require("../utils/pagination");
const { createHttpError } = require("../utils/http");
const { computeChanges } = require("../utils/diff");
const { LEAD_STAGE_MAP, getNextStage } = require("../constants/leadStages");


class LeadService {
  /**
   * List leads with RBAC scoping + lazy load (cursor-based or offset).
   * - STAFF: chỉ thấy lead assign cho mình + lead chưa assign
   * - MANAGER: thấy thêm lead của nhân viên dưới cấp
   * - ADMIN/OWNER: thấy tất cả
   *
   * Supports:  ?stage=lead_moi  (filter by stage)
   *            ?lastId=LEAD0050 (cursor for lazy load)
   *            ?limit=20
   */
  async getLeads(queryParams, scopeFilter = {}) {
    const { search = "", stage, lastId, limit: rawLimit = 20 } = queryParams;
    const limit = Math.min(Math.max(parseInt(rawLimit, 10) || 20, 1), 100);
    const searchRegex = buildSearchRegex(search);

    const andClauses = [];

    // ── RBAC Scoping ─ STAFF/MANAGER chỉ thấy lead assigned/created + unassigned ──
    if (scopeFilter.$or) {
      andClauses.push(scopeFilter);
    }

    // ── Search ──
    if (searchRegex) {
      andClauses.push({
        $or: [
          { name: searchRegex },
          { email: searchRegex },
          { phone: searchRegex },
          { id: searchRegex },
          { "assignees.userName": searchRegex },
        ],
      });
    }

    const query = andClauses.length > 0 ? { $and: andClauses } : {};

    if (stage) query.stage = stage;

    // ── Cursor-based lazy load ──
    if (lastId) {
      const lastDoc = await Lead.findOne({ id: lastId }).select("createdAt");
      if (lastDoc) {
        query.createdAt = { $lt: lastDoc.createdAt };
      }
    }

    const leads = await Lead.find(query)
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = leads.length > limit;
    const items = hasMore ? leads.slice(0, limit) : leads;

    // Attach active tasks info
    if (items.length > 0) {
      const leadIds = items.map(l => l.id);
      const activeTasks = await Task.find({
        "linkedLeads.leadId": { $in: leadIds },
        status: "active"
      }).select("name linkedLeads").lean();

      for (const lead of items) {
        const tasksForLead = activeTasks.filter(t => t.linkedLeads.some(ll => ll.leadId === lead.id));
        lead.activeTaskCount = tasksForLead.length;
        if (tasksForLead.length > 0) {
          // Just grab the first active task's name for quick display
          lead.activeTaskName = tasksForLead[0].name;
        }
      }
    }

    return {
      items,
      hasMore,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  /**
   * Get lead counts per stage — cho Kanban header.
   */
  async getStageCounts(scopeFilter = {}) {
    // RBAC Scoping — đồng bộ với getLeads
    const counts = await Lead.aggregate([
      { $match: scopeFilter },
      { $group: { _id: "$stage", count: { $sum: 1 } } },
    ]);

    return Object.fromEntries(counts.map((c) => [c._id, c.count]));
  }

  async getLeadById(id) {
    const lead = await Lead.findOne({ id });
    if (!lead) {
      throw createHttpError(404, "Lead not found", { code: "LEAD_NOT_FOUND" });
    }
    return lead;
  }

  /**
   * Tạo lead mới — auto-map customer, resolve assignees.
   */
  async createLead(data, currentUser) {
    const id = await generateMonotonicId(ID_PREFIXES.LEAD);

    // Auto-map customer nếu email/phone khớp
    let customerId = null;
    if (data.email || data.phone) {
      const matchConditions = [];
      if (data.email) matchConditions.push({ email: data.email.toLowerCase() });
      if (data.phone) matchConditions.push({ phone: data.phone });
      const customer = await Customer.findOne({ $or: matchConditions }).select(
        "id",
      );
      if (customer) customerId = customer.id;
    }

    // Resolve assignees — enrich userName, userAvatar, functionTitle
    const assignees = await this._resolveAssignees(data.assignees || []);

    const lead = await Lead.create({
      id,
      name: data.name,
      avatar: data.avatar || "",
      email: data.email || "",
      phone: data.phone || "",
      stage: data.stage || "lead_moi",
      funnelId: data.funnelId || null,
      statusId: data.statusId || null,
      customerId,
      assignees,
      address: data.address || {},
      street: data.street || "",
      source: data.source || "CRM",
      createdBy: currentUser?.id || null,
      tags: data.tags || [],
      note: data.note || "",
      activityLogs: [
        {
          action: "create",
          description: `Tạo lead "${data.name}"`,
          performedBy: this._extractPerformer(currentUser),
        },
      ],
    });

    return lead;
  }

  /**
   * Cập nhật lead — ownership check + changelog + activity log.
   */
  async updateLead(id, updates, currentUser) {
    const lead = await this.getLeadById(id);
    // Ownership check đã được xử lý bởi requireResourceAccess middleware

    const before = lead.toObject();

    // Resolve assignees nếu có gửi lên
    if (updates.assignees) {
      updates.assignees = await this._resolveAssignees(updates.assignees);
    }

    // Auto-map customer nếu email/phone thay đổi
    const email = updates.email || lead.email;
    const phone = updates.phone || lead.phone;
    if (updates.email || updates.phone) {
      const matchConditions = [];
      if (email) matchConditions.push({ email: email.toLowerCase() });
      if (phone) matchConditions.push({ phone });
      if (matchConditions.length > 0) {
        const customer = await Customer.findOne({
          $or: matchConditions,
        }).select("id");
        if (customer) updates.customerId = customer.id;
      }
    }

    // Whitelist updatable fields
    const allowedFields = [
      "name",
      "avatar",
      "email",
      "phone",
      "stage",
      "funnelId",
      "statusId",
      "address",
      "street",
      "source",
      "tags",
      "note",
      "customerId",
      "assignees",
    ];
    const $set = {};
    for (const key of allowedFields) {
      if (updates[key] !== undefined) $set[key] = updates[key];
    }

    Object.assign(lead, $set);

    const updatedKeys = Object.keys($set);
    let desc = `Cập nhật lead "${lead.name}"`;
    if (updatedKeys.length > 0) {
      const fieldNames = {
        name: "tên",
        avatar: "ảnh đại diện",
        email: "email",
        phone: "SĐT",
        stage: "trạng thái",
        assignees: "người phụ trách",
        address: "khu vực",
        street: "địa chỉ",
        source: "nguồn",
        tags: "tags",
        note: "ghi chú",
        customerId: "khách hàng",
      };
      const names = updatedKeys.map((k) => fieldNames[k] || k);
      desc = `Cập nhật ${names.join(", ")}`;
    }

    const changes = computeChanges(before, lead.toObject());

    // Push activity log
    const performer = this._extractPerformer(currentUser);
    lead.activityLogs.push({
      action: "update",
      description: desc,
      performedBy: performer,
      metadata: { updatedFields: updatedKeys, changes },
    });

    await lead.save();

    return { lead, changes };
  }

  /**
   * Confirm stage hiện tại → chuyển sang stage tiếp theo.
   */
  async confirmStage(id, currentUser) {
    const lead = await this.getLeadById(id);
    // Ownership check đã được xử lý bởi requireResourceAccess middleware

    const nextStage = getNextStage(lead.stage);
    if (!nextStage) {
      throw createHttpError(
        400,
        "Lead đã ở giai đoạn cuối, không thể chuyển tiếp.",
        {
          code: "ALREADY_FINAL_STAGE",
        },
      );
    }

    const before = lead.toObject();
    const previousStageLabel = LEAD_STAGE_MAP[lead.stage]?.label || lead.stage;
    lead.stage = nextStage.id;

    // Auto-add timeline entry
    lead.timeline.push({
      type: "event",
      title: `Chuyển sang: ${nextStage.label}`,
      createdBy: currentUser?.name || currentUser?.id || "",
    });

    // Push activity log
    const performer = this._extractPerformer(currentUser);
    lead.activityLogs.push({
      action: "stage_change",
      description: `Chuyển từ "${previousStageLabel}" sang "${nextStage.label}"`,
      performedBy: performer,
      metadata: { from: before.stage, to: nextStage.id },
    });

    await lead.save();

    const changes = computeChanges(before, lead.toObject());
    return {
      lead,
      changes,
      previousStage: before.stage,
      newStage: nextStage.id,
    };
  }

  /**
   * Xóa lead (soft delete).
   */
  async deleteLead(id, currentUser) {
    const lead = await this.getLeadById(id);
    // Ownership check đã được xử lý bởi requireResourceAccess middleware

    // Push activity log before soft delete
    const performer = this._extractPerformer(currentUser);
    lead.activityLogs.push({
      action: "delete",
      description: `Xóa lead "${lead.name}"`,
      performedBy: performer,
    });
    await lead.save();

    await lead.softDelete();

    // ━ Cascade: close all active Tasks linked to this Lead
    try {
      const activeTasks = await Task.find({
        "linkedLeads.leadId": id,
        status: { $ne: "closed" }
      });
      for (const task of activeTasks) {
        const performer = currentUser || { id: "system", name: "System", email: "" };
        await TaskService.closeTask(task.id, performer).catch(err => {
          console.error(`Failed to close task ${task.id} cascading from lead ${id}`, err);
        });
      }
    } catch (err) {
      console.error("Error during cascading task close for lead", err);
    }

    return lead;
  }

  /**
   * Thêm timeline entry cho lead.
   */
  async addLeadTimeline(id, entryData, currentUser) {
    const lead = await this.getLeadById(id);
    lead.timeline.push({
      ...entryData,
      createdBy: currentUser?.name || currentUser?.id || "",
    });

    // Push activity log
    const performer = this._extractPerformer(currentUser);
    lead.activityLogs.push({
      action: "add_timeline",
      description: `Thêm ${entryData.type === "phone" ? "cuộc gọi" : entryData.type === "email" ? "email" : "ghi chú"}: "${entryData.title}"`,
      performedBy: performer,
    });

    await lead.save();
    return lead;
  }

  // ─── Discussion (Thảo luận) ───

  /**
   * Thêm bình luận/thảo luận vào lead.
   * RBAC: Chỉ staff được assign, hoặc manager/admin/owner mới được bình luận.
   */
  async addDiscussion(id, content, currentUser) {
    const lead = await this.getLeadById(id);
    // Discussion permission đã được xử lý bởi requireResourceAccess middleware

    const performer = this._extractPerformer(currentUser);

    lead.discussions.push({
      content: content.trim(),
      createdBy: performer,
    });

    await lead.save();
    return lead;
  }

  async selfAssignLead(id, currentUser) {
    const lead = await this.getLeadById(id);

    const isAssigned = lead.assignees && lead.assignees.some(a => a.userId === currentUser.id);
    if (isAssigned) {
      return lead;
    }

    const before = lead.toObject();
    
    // Resolve assignee format
    const newAssignees = [...(lead.assignees || []), currentUser.id];
    lead.assignees = await this._resolveAssignees(newAssignees);

    const changes = computeChanges(before, lead.toObject());

    const performer = this._extractPerformer(currentUser);
    lead.activityLogs.push({
      action: "assign",
      description: `Tự nhận phụ trách lead "${lead.name}"`,
      performedBy: performer,
      metadata: { changes },
    });

    await lead.save();
    return lead;
  }

  /**
   * Lấy lịch sử thao tác của lead (paginated, newest first).
   */
  async getActivityLogs(id, queryParams = {}) {
    const lead = await this.getLeadById(id);
    const { limit: rawLimit = 50, skip: rawSkip = 0 } = queryParams;
    const limit = Math.min(Math.max(parseInt(rawLimit, 10) || 50, 1), 200);
    const skip = Math.max(parseInt(rawSkip, 10) || 0, 0);

    // Sort newest first
    const logs = [...(lead.activityLogs || [])]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(skip, skip + limit);

    return {
      items: logs,
      total: (lead.activityLogs || []).length,
    };
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
        ? User.find({ id: { $in: userIds }, isActive: { $ne: false } }).select(
          "id name avatar",
        ).lean()
        : [],
      funcIds.length > 0
        ? StaffFunction.find({ id: { $in: funcIds } }).select("id title").lean()
        : [],
    ]);

    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
    const funcMap = Object.fromEntries(funcs.map((f) => [f.id, f]));

    // If user is inactive, return error
    rawAssignees.forEach((a) => {
      if (!userMap[a.userId]) {
        throw createHttpError(400, "User not found or inactive", {
          code: "USER_NOT_FOUND",
        });
      }
    });

    return rawAssignees
      .filter((a) => a.userId && userMap[a.userId]) // chỉ lấy user hợp lệ + active
      .map((a) => ({
        userId: a.userId,
        userName: userMap[a.userId]?.name || "",
        userAvatar: userMap[a.userId]?.avatar || "",
        functionId: a.functionId || null,
        functionTitle: a.functionId ? funcMap[a.functionId]?.title || "" : "",
      }));
  }


  /**
   * Extract performer info from currentUser.
   */
  _extractPerformer(currentUser) {
    if (!currentUser) {
      return { userId: null, userName: "System", userAvatar: "" };
    }
    return {
      userId: currentUser.id || null,
      userName: currentUser.name || "Unknown",
      userAvatar: currentUser.avatar || "",
    };
  }
}

module.exports = new LeadService();
