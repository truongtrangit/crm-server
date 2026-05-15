const MetaConfig = require("../models/MetaConfig");
const MetaProgram = require("../models/MetaProgram");
const User = require("../models/User");
const { generateMonotonicId, ID_PREFIXES } = require("../utils/id");
const { buildSearchRegex } = require("../utils/query");
const {
  resolvePagination,
  buildPaginatedResponse,
  resolveSort,
} = require("../utils/pagination");
const { createHttpError } = require("../utils/http");
const { computeChanges } = require("../utils/diff");


class MetaService {
  // ─── Config CRUD ────────────────────────────────────────────────────────────

  async getConfigs() {
    return MetaConfig.find().sort({ order: 1, createdAt: 1 }).lean();
  }

  async createConfig(payload) {
    const config = await MetaConfig.create({
      id: await generateMonotonicId(ID_PREFIXES.META_CONFIG),
      name: payload.name,
      badgeColor: payload.badgeColor || "#0668e1",
      icon: payload.icon || "Target",
      kpiType: payload.kpiType || "metric",
      metrics: payload.kpiType === "task" ? [] : payload.metrics || [],
      description: payload.description || "",
      order: payload.order ?? 0,
    });
    return config;
  }

  async updateConfig(id, payload) {
    const config = await MetaConfig.findOne({ id });
    if (!config) {
      throw createHttpError(404, "Loại chương trình không tồn tại", {
        code: "META_CONFIG_NOT_FOUND",
      });
    }

    const oldState = config.toObject();

    if (payload.name !== undefined) config.name = payload.name;
    if (payload.badgeColor !== undefined) config.badgeColor = payload.badgeColor;
    if (payload.icon !== undefined) config.icon = payload.icon;
    if (payload.kpiType !== undefined) {
      config.kpiType = payload.kpiType;
      // Clear metrics if switching to task mode
      if (payload.kpiType === "task") {
        config.metrics = [];
      }
    }
    if (payload.metrics !== undefined && config.kpiType === "metric") {
      config.metrics = payload.metrics;
    }
    if (payload.description !== undefined) config.description = payload.description;
    if (payload.order !== undefined) config.order = payload.order;

    await config.save();
    
    const newState = config.toObject();
    const changes = computeChanges(oldState, newState, ["name", "badgeColor", "icon", "kpiType", "metrics", "description", "order"]);
    
    return { config, changes };
  }

  async deleteConfig(id) {
    const config = await MetaConfig.findOne({ id });
    if (!config) {
      throw createHttpError(404, "Loại chương trình không tồn tại", {
        code: "META_CONFIG_NOT_FOUND",
      });
    }

    // Check if any program references this config
    const programCount = await MetaProgram.countDocuments({ typeId: id });
    if (programCount > 0) {
      throw createHttpError(
        409,
        `Không thể xóa vì có ${programCount} chương trình đang sử dụng loại này`,
        { code: "META_CONFIG_IN_USE" },
      );
    }

    await MetaConfig.deleteOne({ id });
    return config;
  }

  // ─── Program CRUD ──────────────────────────────────────────────────────────

  async getPrograms(queryParams, scopeFilter = {}) {
    const { search = "", type, time } = queryParams;
    const searchRegex = buildSearchRegex(search);
    const { page, limit, skip } = resolvePagination(queryParams);

    const query = {};

    // ── RBAC Scoping — STAFF/MANAGER chỉ thấy program mình là PIC/creator ──
    if (scopeFilter.$or) {
      query.$and = [scopeFilter];
    }

    if (searchRegex) {
      query.$or = [{ name: searchRegex }];
    }

    if (type) {
      query.typeId = type;
    }

    // Time filter: e.g. "H1-2025" → Jan–Jun 2025; "H2-2025" → Jul–Dec 2025
    if (time && time !== "all") {
      const match = time.match(/^H([12])-(\d{4})$/);
      if (match) {
        const half = parseInt(match[1], 10);
        const year = parseInt(match[2], 10);
        const rangeStart =
          half === 1 ? new Date(year, 0, 1) : new Date(year, 6, 1);
        const rangeEnd =
          half === 1 ? new Date(year, 6, 1) : new Date(year + 1, 0, 1);
        query.$and = query.$and || [];
        query.$and.push({
          startDate: { $lt: rangeEnd },
          endDate: { $gte: rangeStart },
        });
      }
    }

    const sortObj = resolveSort(queryParams, [
      "createdAt",
      "name",
      "updatedAt",
      "startDate",
      "endDate",
      "progressPercent",
    ]);

    const [programs, totalItems] = await Promise.all([
      MetaProgram.find(query).sort(sortObj).skip(skip).limit(limit).lean(),
      MetaProgram.countDocuments(query),
    ]);

    return buildPaginatedResponse(programs, totalItems, page, limit);
  }

  async getProgramById(id) {
    const program = await MetaProgram.findOne({ id });
    if (!program) {
      throw createHttpError(404, "Chương trình không tồn tại", {
        code: "META_PROGRAM_NOT_FOUND",
      });
    }
    return program;
  }

  async createProgram(payload, currentUser) {
    // Validate typeId exists
    const config = await MetaConfig.findOne({ id: payload.typeId });
    if (!config) {
      throw createHttpError(400, "Loại chương trình không tồn tại", {
        code: "META_CONFIG_NOT_FOUND",
      });
    }

    // Validate picIds
    if (payload.picIds && payload.picIds.length > 0) {
      const usersCount = await User.countDocuments({ id: { $in: payload.picIds } });
      if (usersCount !== payload.picIds.length) {
        throw createHttpError(400, "Một hoặc nhiều người phụ trách không tồn tại", {
          code: "INVALID_PICS",
        });
      }
    }

    const program = await MetaProgram.create({
      id: await generateMonotonicId(ID_PREFIXES.META_PROGRAM),
      name: payload.name,
      typeId: payload.typeId,
      budgetType: payload.budgetType || "fixed",
      budget: payload.budget || 0,
      budgetMin: payload.budgetMin || 0,
      budgetMax: payload.budgetMax || 0,
      startDate: payload.startDate,
      endDate: payload.endDate,
      picIds: payload.picIds || [],
      description: payload.description || "",
      descriptionHtml: payload.descriptionHtml || "",
      kpiTargets: config.kpiType === 'task' ? [] : (payload.kpiTargets || []),
      progressPercent: 0,
    });
    return program;
  }

  async updateProgram(id, payload, currentUser) {
    const program = await MetaProgram.findOne({ id });
    if (!program) {
      throw createHttpError(404, "Chương trình không tồn tại", {
        code: "META_PROGRAM_NOT_FOUND",
      });
    }

    if (payload.picIds && payload.picIds.length > 0) {
      const usersCount = await User.countDocuments({ id: { $in: payload.picIds } });
      if (usersCount !== payload.picIds.length) {
        throw createHttpError(400, "Một hoặc nhiều người phụ trách không tồn tại", {
          code: "INVALID_PICS",
        });
      }
    }

    const oldState = program.toObject();

    const fields = [
      "name",
      "typeId",
      "budgetType",
      "budget",
      "budgetMin",
      "budgetMax",
      "approvedBudget",
      "startDate",
      "endDate",
      "picIds",
      "description",
      "descriptionHtml",
    ];
    for (const f of fields) {
      if (payload[f] !== undefined) {
        program[f] = payload[f];
      }
    }

    const targetConfig = await MetaConfig.findOne({ id: payload.typeId || program.typeId });

    if (payload.kpiTargets !== undefined) {
      program.kpiTargets = targetConfig?.kpiType === 'task' ? [] : payload.kpiTargets;
    } else if (targetConfig?.kpiType === 'task' && program.kpiTargets.length > 0) {
      program.kpiTargets = [];
    }

    // Recalculate progress
    await this._recalculateProgress(program);
    await program.save();

    const newState = program.toObject();
    const changes = computeChanges(oldState, newState, [...fields, "kpiTargets"]);
    
    return { program, changes };
  }

  async selfAssignProgram(id, currentUser) {
    const program = await MetaProgram.findOne({ id });
    if (!program) {
      throw createHttpError(404, "Chương trình không tồn tại", {
        code: "META_PROGRAM_NOT_FOUND",
      });
    }

    if (program.picIds && program.picIds.includes(currentUser.id)) {
      return { program, changes: [] };
    }

    const oldState = program.toObject();
    program.picIds = program.picIds || [];
    program.picIds.push(currentUser.id);
    await program.save();

    const newState = program.toObject();
    const changes = computeChanges(oldState, newState, ["picIds"]);

    return { program, changes };
  }

  async deleteProgram(id, currentUser) {
    const program = await MetaProgram.findOne({ id });
    if (!program) {
      throw createHttpError(404, "Chương trình không tồn tại", {
        code: "META_PROGRAM_NOT_FOUND",
      });
    }

    await program.softDelete();
    return program;
  }

  // ─── Milestones ────────────────────────────────────────────────────────────

  async addMilestone(programId, payload, currentUser) {
    const program = await MetaProgram.findOne({ id: programId });
    if (!program) {
      throw createHttpError(404, "Chương trình không tồn tại", {
        code: "META_PROGRAM_NOT_FOUND",
      });
    }

    const config = await MetaConfig.findOne({ id: program.typeId });
    if (config?.kpiType === 'task') {
      throw createHttpError(400, "Chương trình theo công việc không thể thêm KPI/Tiến độ", {
        code: "META_INVALID_ACTION",
      });
    }

    // Find the matching KPI target and update its current value
    const target = program.kpiTargets.find(
      (t) => t.metricName === payload.metricName,
    );
    if (!target) {
      throw createHttpError(400, `Chỉ số "${payload.metricName}" không tồn tại trong chương trình`, {
        code: "META_METRIC_NOT_FOUND",
      });
    }

    target.current = (target.current || 0) + payload.valueAdded;

    program.milestones.unshift({
      name: payload.name || "",
      metricName: payload.metricName,
      valueAdded: payload.valueAdded,
      totalCurrent: target.current,
      date: payload.date || new Date(),
      note: payload.note || "",
      createdBy: currentUser?.name || "",
    });

    this._recalculateProgress(program);
    await program.save();
    return program;
  }

  /**
   * Batch-update milestones for ALL KPI metrics in a single operation.
   * @param {string} programId
   * @param {{ name?: string, date?: string, note?: string, updates: Array<{ metricName: string, newCurrent: number }> }} payload
   * @param {object} currentUser
   * @returns {Promise<object>} updated program
   */
  async addBatchMilestones(programId, payload, currentUser) {
    const program = await MetaProgram.findOne({ id: programId });
    if (!program) {
      throw createHttpError(404, "Chương trình không tồn tại", {
        code: "META_PROGRAM_NOT_FOUND",
      });
    }

    const config = await MetaConfig.findOne({ id: program.typeId });
    if (config?.kpiType === "task") {
      throw createHttpError(400, "Chương trình theo công việc không thể thêm KPI/Tiến độ", {
        code: "META_INVALID_ACTION",
      });
    }

    const milestoneDate = payload.date || new Date();
    const milestoneName = payload.name || "";
    const milestoneNote = payload.note || "";
    const createdBy = currentUser?.name || "";

    for (const update of payload.updates) {
      const target = program.kpiTargets.find(
        (t) => t.metricName === update.metricName,
      );
      if (!target) {
        throw createHttpError(
          400,
          `Chỉ số "${update.metricName}" không tồn tại trong chương trình`,
          { code: "META_METRIC_NOT_FOUND" },
        );
      }

      const oldCurrent = target.current || 0;
      const valueAdded = update.newCurrent - oldCurrent;

      // Skip metrics that haven't changed
      if (valueAdded === 0) continue;

      target.current = update.newCurrent;

      program.milestones.unshift({
        name: milestoneName,
        metricName: update.metricName,
        valueAdded,
        totalCurrent: update.newCurrent,
        date: milestoneDate,
        note: milestoneNote,
        createdBy,
      });
    }

    this._recalculateProgress(program);
    await program.save();
    return program;
  }

  async updateMilestone(programId, milestoneId, payload, currentUser) {
    const program = await MetaProgram.findOne({ id: programId });
    if (!program) throw createHttpError(404, "Chương trình không tồn tại", { code: "META_PROGRAM_NOT_FOUND" });

    const milestone = program.milestones.id(milestoneId);
    if (!milestone) throw createHttpError(404, "Cột mốc không tồn tại", { code: "META_MILESTONE_NOT_FOUND" });

    const oldState = milestone.toObject();

    const fields = ["name", "date", "note", "totalCurrent", "valueAdded"];
    for (const f of fields) {
      if (payload[f] !== undefined) {
        milestone[f] = payload[f];
      }
    }

    const target = program.kpiTargets.find(t => t.metricName === milestone.metricName);
    if (target) {
      const sortedMilestones = program.milestones
        .filter(m => m.metricName === milestone.metricName)
        .sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());
      
      if (sortedMilestones.length > 0) {
        target.current = sortedMilestones[0].totalCurrent;
      } else {
        target.current = 0;
      }
    }

    this._recalculateProgress(program);
    await program.save();

    const newState = program.milestones.id(milestoneId).toObject();
    const changes = computeChanges(oldState, newState, fields);

    return { program, changes };
  }

  async deleteMilestone(programId, milestoneId, currentUser) {
    const program = await MetaProgram.findOne({ id: programId });
    if (!program) throw createHttpError(404, "Chương trình không tồn tại", { code: "META_PROGRAM_NOT_FOUND" });

    const milestone = program.milestones.id(milestoneId);
    if (!milestone) throw createHttpError(404, "Cột mốc không tồn tại", { code: "META_MILESTONE_NOT_FOUND" });

    const metricName = milestone.metricName;
    program.milestones.pull({ _id: milestoneId });

    const target = program.kpiTargets.find(t => t.metricName === metricName);
    if (target) {
      const sortedMilestones = program.milestones
        .filter(m => m.metricName === metricName)
        .sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());
      
      if (sortedMilestones.length > 0) {
        target.current = sortedMilestones[0].totalCurrent;
      } else {
        target.current = 0;
      }
    }

    this._recalculateProgress(program);
    await program.save();
    return program;
  }

  // ─── Tasks ──────────────────────────────────────────────────────────────────

  async addTask(programId, payload, currentUser) {
    const program = await MetaProgram.findOne({ id: programId });
    if (!program) {
      throw createHttpError(404, "Chương trình không tồn tại", {
        code: "META_PROGRAM_NOT_FOUND",
      });
    }

    program.tasks.push({
      title: payload.title,
      picIds: payload.picIds || [],
      description: payload.description || "",
      deadline: payload.deadline || null,
      isCompleted: false,
    });

    this._recalculateProgress(program);
    await program.save();
    return program;
  }

  async updateTask(programId, taskId, payload, currentUser) {
    const program = await MetaProgram.findOne({ id: programId });
    if (!program) {
      throw createHttpError(404, "Chương trình không tồn tại", {
        code: "META_PROGRAM_NOT_FOUND",
      });
    }

    const task = program.tasks.id(taskId);
    if (!task) {
      throw createHttpError(404, "Công việc không tồn tại", {
        code: "META_TASK_NOT_FOUND",
      });
    }

    const oldState = task.toObject();
    
    const fields = ["title", "picIds", "description", "deadline", "isCompleted"];
    for (const f of fields) {
      if (payload[f] !== undefined) {
        task[f] = payload[f];
      }
    }
    
    if (payload.isCompleted !== undefined) {
      task.completedAt = payload.isCompleted ? new Date() : null;
    }

    this._recalculateProgress(program);
    await program.save();
    
    const newState = program.tasks.id(taskId).toObject();
    const changes = computeChanges(oldState, newState, fields);

    return { program, changes };
  }

  async deleteTask(programId, taskId, currentUser) {
    const program = await MetaProgram.findOne({ id: programId });
    if (!program) {
      throw createHttpError(404, "Chương trình không tồn tại", {
        code: "META_PROGRAM_NOT_FOUND",
      });
    }

    const task = program.tasks.id(taskId);
    if (!task) {
      throw createHttpError(404, "Công việc không tồn tại", {
        code: "META_TASK_NOT_FOUND",
      });
    }

    program.tasks.pull(taskId);
    this._recalculateProgress(program);
    await program.save();
    return program;
  }

  // ─── Attachments ───────────────────────────────────────────────────────────

  async addAttachment(programId, payload, currentUser) {
    const program = await MetaProgram.findOne({ id: programId });
    if (!program) {
      throw createHttpError(404, "Chương trình không tồn tại", {
        code: "META_PROGRAM_NOT_FOUND",
      });
    }

    program.attachments.push({
      fileName: payload.fileName,
      url: payload.url,
      createdBy: currentUser?.name || "",
    });

    await program.save();
    return program;
  }

  async deleteAttachment(programId, attachmentId, currentUser) {
    const program = await MetaProgram.findOne({ id: programId });
    if (!program) {
      throw createHttpError(404, "Chương trình không tồn tại", {
        code: "META_PROGRAM_NOT_FOUND",
      });
    }

    const att = program.attachments.id(attachmentId);
    if (!att) {
      throw createHttpError(404, "Tài liệu không tồn tại", {
        code: "META_ATTACHMENT_NOT_FOUND",
      });
    }

    program.attachments.pull(attachmentId);
    await program.save();
    return program;
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  async _recalculateProgress(program) {
    // We need the config to know kpiType
    const config = await MetaConfig.findOne({ id: program.typeId });
    const kpiType = config?.kpiType || "metric";

    if (kpiType === "metric") {
      if (program.kpiTargets.length === 0) {
        program.progressPercent = 0;
        return;
      }
      const total = program.kpiTargets.reduce((sum, t) => {
        if (t.target <= 0) return sum;
        return sum + (t.current / t.target) * 100;
      }, 0);
      program.progressPercent = Math.round(
        total / program.kpiTargets.length,
      );
    } else {
      // task mode
      if (program.tasks.length === 0) {
        program.progressPercent = 0;
        return;
      }
      const completed = program.tasks.filter((t) => t.isCompleted).length;
      program.progressPercent = Math.round(
        (completed / program.tasks.length) * 100,
      );
    }
  }
  // ─── Comments ────────────────────────────────────────────────────────────────

  async addComment(programId, payload, currentUser) {
    const program = await MetaProgram.findOne({ id: programId });
    if (!program) {
      throw createHttpError(404, "Chương trình không tồn tại", {
        code: "META_PROGRAM_NOT_FOUND",
      });
    }

    program.comments.push({
      content: payload.content,
      userId: currentUser.id || "",
      displayName: currentUser.displayName || currentUser.name || "",
    });

    await program.save();
    return program;
  }

  async deleteComment(programId, commentId, currentUser) {
    const program = await MetaProgram.findOne({ id: programId });
    if (!program) {
      throw createHttpError(404, "Chương trình không tồn tại", {
        code: "META_PROGRAM_NOT_FOUND",
      });
    }

    const role = (currentUser.roleId || "").toUpperCase();
    const comment = program.comments.id(commentId);
    if (!comment) {
      throw createHttpError(404, "Bình luận không tồn tại", {
        code: "META_COMMENT_NOT_FOUND",
      });
    }

    // Only Owner/Admin or the comment author can delete
    if (!["OWNER", "ADMIN"].includes(role) && comment.userId !== currentUser.id) {
      throw createHttpError(403, "Bạn không có quyền xóa bình luận này", {
        code: "META_FORBIDDEN",
      });
    }

    comment.deleteOne();
    await program.save();
    return program;
  }
}

module.exports = new MetaService();
