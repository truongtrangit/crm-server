const Lead = require("../models/Lead");
const Customer = require("../models/Customer");
const User = require("../models/User");
const StaffFunction = require("../models/StaffFunction");
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
  async getLeads(queryParams, currentUser) {
    const { search = "", stage, lastId, limit: rawLimit = 20 } = queryParams;
    const limit = Math.min(Math.max(parseInt(rawLimit, 10) || 20, 1), 100);
    const searchRegex = buildSearchRegex(search);

    const andClauses = [];

    // ── RBAC Scoping ──
    // Staff can see all leads, so no restriction on read.

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
      .limit(limit + 1); // +1 to detect hasMore

    const hasMore = leads.length > limit;
    const items = hasMore ? leads.slice(0, limit) : leads;

    return {
      items,
      hasMore,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  /**
   * Get lead counts per stage — cho Kanban header.
   */
  async getStageCounts(currentUser) {
    // Staff can see all leads, so no restriction on read.
    const matchStage = {};

    const counts = await Lead.aggregate([
      { $match: matchStage },
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
    this._checkOwnership(lead, currentUser);

    const before = lead.toObject();

    // Resolve assignees nếu có gửi lên
    if (updates.assignees) {
      const role = (currentUser?.roleId || "").toUpperCase();
      if (!["OWNER", "ADMIN", "MANAGER"].includes(role)) {
        throw createHttpError(
          403,
          "Chỉ Manager, Admin hoặc Owner mới có quyền phân công lead.",
          {
            code: "ASSIGN_LEAD_FORBIDDEN",
          },
        );
      }
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
    this._checkOwnership(lead, currentUser);

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
    this._checkOwnership(lead, currentUser);

    // Push activity log before soft delete
    const performer = this._extractPerformer(currentUser);
    lead.activityLogs.push({
      action: "delete",
      description: `Xóa lead "${lead.name}"`,
      performedBy: performer,
    });
    await lead.save();

    await lead.softDelete();
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
    this._checkDiscussionPermission(lead, currentUser);

    const performer = this._extractPerformer(currentUser);

    lead.discussions.push({
      content: content.trim(),
      createdBy: performer,
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
        )
        : [],
      funcIds.length > 0
        ? StaffFunction.find({ id: { $in: funcIds } }).select("id title")
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
   * Ownership check — ADMIN/OWNER luôn qua.
   * STAFF/MANAGER chỉ sửa lead mà họ là assignee.
   * MANAGER có thể sửa lead mà họ là manager của assignee đó.
   */
  _checkOwnership(lead, currentUser) {
    const role = (currentUser?.roleId || "").toUpperCase();
    if (["OWNER", "ADMIN"].includes(role)) return;

    const isAssignee = lead.assignees.some((a) => a.userId === currentUser?.id);

    if (["MANAGER"].includes(role) && !isAssignee) {
      const isManagerOfAssignee = lead.assignees.some(
        (a) => a.userId === currentUser?.managerId,
      );
      if (isManagerOfAssignee) return;
    }

    if (!isAssignee) {
      throw createHttpError(403, "Bạn không có quyền thao tác lead này.", {
        code: "LEAD_FORBIDDEN",
      });
    }
  }

  /**
   * Discussion permission check:
   * - ADMIN/OWNER: always allowed
   * - MANAGER: always allowed
   * - STAFF: only if assigned to this lead
   */
  _checkDiscussionPermission(lead, currentUser) {
    const role = (currentUser?.roleId || "").toUpperCase();
    if (["OWNER", "ADMIN", "MANAGER"].includes(role)) return;

    const isAssignee = lead.assignees.some((a) => a.userId === currentUser?.id);
    if (!isAssignee) {
      throw createHttpError(403, "Chỉ nhân sự được gán mới có thể bình luận.", {
        code: "LEAD_DISCUSSION_FORBIDDEN",
      });
    }
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
