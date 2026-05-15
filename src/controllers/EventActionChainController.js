const EventActionChain = require("../models/EventActionChain");
const ActionChain = require("../models/ActionChain");
const Action = require("../models/Action");
const Event = require("../models/Event");
const User = require("../models/User");
const Lead = require("../models/Lead");
const { createHttpError, sendSuccess } = require("../utils/http");
const { normalizeOrganizationKey } = require("../utils/organization");
const { ACTION_TYPE_CATEGORY_MAP } = require("../constants/actionConfig");
const { executeBlockAutomation } = require("../services/BlockAutomationExecutor");
const SystemLogService = require("../services/SystemLogService");
const AutomationLogService = require("../services/AutomationLogService");
const { RESOURCES } = require("../constants/rbac");

const EventService = require("../services/EventService");

// Ownership check is now handled by requireResourceAccess middleware

// ─── Helpers ───

function calcScheduledAt(activatedAt, delayUnit, delayValue) {
  if (!activatedAt || !delayUnit || delayUnit === "immediate" || !delayValue) {
    return activatedAt || new Date();
  }
  const d = new Date(activatedAt);
  switch (delayUnit) {
    case "minute": d.setTime(d.getTime() + delayValue * 60 * 1000); break;
    case "hour": d.setTime(d.getTime() + delayValue * 60 * 60 * 1000); break;
    case "day": d.setTime(d.getTime() + delayValue * 24 * 60 * 60 * 1000); break;
    case "week": d.setTime(d.getTime() + delayValue * 7 * 24 * 60 * 60 * 1000); break;
    default: break;
  }
  return d;
}


async function buildStepSnapshot(templateStep, actionMap) {
  const action = actionMap[templateStep.actionId];
  return {
    order: templateStep.order,
    actionId: templateStep.actionId,
    actionName: action?.name || "",
    actionType: action?.type || "",
    actionCategory: action?.category || ACTION_TYPE_CATEGORY_MAP?.[action?.type] || "primary",
    actionReasonIds: action?.reasonIds || [],
    branches: templateStep.branches.map(b => ({ ...b })),
    selectedResultId: null,
    selectedReasonId: null,
    note: "",
    delayUnit: null,
    delayValue: null,
    activatedAt: null,
    scheduledAt: null,
    completedAt: null,
    delayEditNote: "",
    status: "pending",
    isLocked: false,
  };
}

class EventActionChainController {

  // ─── GET /api/events/:eventId/chains ───
  async getChains(req, res) {
    const { eventId } = req.params;
    const chains = await EventActionChain.find({ eventId }).sort({ order: 1 });
    return sendSuccess(res, 200, "Get event action chains success", chains);
  }

  // ─── POST /api/events/:eventId/chains ───
  async addChain(req, res) {
    const { eventId } = req.params;

    const { chainId } = req.body;

    const template = await ActionChain.findOne({ id: chainId }).lean();
    if (!template) throw createHttpError(404, "ActionChain không tồn tại");
    if (!template.active) throw createHttpError(422, "Chỉ có thể thêm chuỗi hành động đang kích hoạt (active) vào sự kiện");

    const exists = await EventActionChain.findOne({ eventId, chainId });
    if (exists) throw createHttpError(409, "Chuỗi hành động này đã được thêm vào sự kiện");

    const actionIds = template.steps.map(s => s.actionId);
    const actions = await Action.find({ id: { $in: actionIds } });
    const actionMap = Object.fromEntries(actions.map(a => [a.id, a]));

    const steps = await Promise.all(
      template.steps
        .sort((a, b) => a.order - b.order)
        .map(step => buildStepSnapshot(step, actionMap))
    );

    if (steps.length > 0) {
      const now = new Date();
      // Apply the chain-level delay to the FIRST step's scheduled time.
      // This is the delay from the moment the chain is added to the event.
      const chainDelayUnit = template.delayUnit || "immediate";
      const chainDelayValue = template.delayValue || null;
      const scheduledAt = calcScheduledAt(now, chainDelayUnit, chainDelayValue);

      steps[0].status = "active";
      steps[0].activatedAt = now;
      steps[0].scheduledAt = scheduledAt;
      // Store the chain delay on the step for display / audit trail
      if (chainDelayUnit && chainDelayUnit !== "immediate") {
        steps[0].delayUnit = chainDelayUnit;
        steps[0].delayValue = chainDelayValue;
      }
    }

    const chainCount = await EventActionChain.countDocuments({ eventId });
    const id = `EAC-${eventId}-${chainId}-${Date.now()}`;

    const chain = new EventActionChain({
      id, eventId, chainId,
      name: template.name,
      status: "active",
      order: chainCount + 1,
      currentStepIndex: 0,
      steps,
    });

    await chain.save();
    SystemLogService.log({ action: "create", resource: RESOURCES.EVENT_CHAINS, resourceId: chain.id, resourceName: chain.name, description: `Thêm chuỗi hành động "${chain.name}" vào sự kiện ${eventId}`, metadata: { newItem: chain }, req });
    return sendSuccess(res, 201, "Thêm chuỗi hành động thành công", chain);
  }

  // ─── PUT /api/events/:eventId/chains/:chainId/steps/current ───
  async saveCurrentStep(req, res) {
    const { eventId, chainId } = req.params;

    const {
      selectedResultId, selectedReasonId, note,
      nextStepDelay,
      /**
       * nextStepOverride: user chủ động chọn action tiếp theo thay vì follow branch
       * { targetStepOrder: number }  → activate step có order đó
       */
      nextStepOverride,
    } = req.body;

    const chain = await EventActionChain.findOne({ id: chainId, eventId });
    if (!chain) throw createHttpError(404, "Chuỗi hành động không tồn tại");
    if (chain.status === "closed") throw createHttpError(400, "Chuỗi đã đóng");

    const currentIdx = chain.currentStepIndex;
    const currentStep = chain.steps[currentIdx];
    if (!currentStep) throw createHttpError(400, "Không có step nào đang active");
    if (currentStep.isLocked) throw createHttpError(400, "Step này đã được lưu");

    // Safety: nếu step có cấu hình branches mà chưa chọn kết quả → không cho lưu
    if (currentStep.branches.length > 0 && !selectedResultId) {
      throw createHttpError(400, "Vui lòng chọn kết quả trước khi lưu bước này");
    }

    const now = new Date();

    currentStep.selectedResultId = selectedResultId || null;
    currentStep.selectedReasonId = selectedReasonId || null;
    currentStep.note = note || "";
    currentStep.status = "done";
    currentStep.isLocked = true;
    currentStep.completedAt = now;

    // Xác định next step
    const matchedBranch = selectedResultId
      ? currentStep.branches.find(b => b.resultId === selectedResultId)
      : null;

    const nextStepType = matchedBranch?.nextStepType || null;

    // Nếu user override next step (đã Xác nhận trong UI)
    if (nextStepOverride?.targetStepOrder != null) {
      const overrideIdx = chain.steps.findIndex(s => s.order === nextStepOverride.targetStepOrder);
      if (overrideIdx !== -1) {
        const delayUnit = nextStepOverride.delayUnit ?? null;
        const delayValue = nextStepOverride.delayValue ?? null;
        const step = chain.steps[overrideIdx];
        step.status = "active";
        step.activatedAt = now;
        step.scheduledAt = calcScheduledAt(now, delayUnit, delayValue);
        step.delayUnit = delayUnit;
        step.delayValue = delayValue;
        chain.currentStepIndex = overrideIdx;
        // Ghi lại step thực tế được activate tiếp theo
        currentStep.activatedNextStepOrder = step.order;
        chain.markModified("steps");
        await chain.save();
        return sendSuccess(res, 200, "Lưu bước thành công", chain);
      }
    }

    // ─── Follow branch logic ───
    // Chỉ đóng chain khi: close_task, close_chain, close_chain_clone_task
    const CLOSE_TYPES = ["close_task", "close_chain", "close_chain_clone_task"];

    if (nextStepType && CLOSE_TYPES.includes(nextStepType)) {
      // Đóng chuỗi
      chain.status = "closed";
      currentStep.activatedNextStepOrder = null;
    } else if (nextStepType === "next_in_chain") {
      // Tìm step tiếp theo theo nextActionId (trong branch) hoặc index kế tiếp
      const nextActionId = matchedBranch?.nextActionId;
      let nextIdx = nextActionId
        ? chain.steps.findIndex(s => s.actionId === nextActionId && s.status === "pending")
        : -1;
      // Fallback: step kế tiếp theo index
      if (nextIdx === -1) nextIdx = currentIdx + 1;

      if (nextIdx !== -1 && nextIdx < chain.steps.length) {
        const delayUnit = nextStepDelay?.delayUnit ?? matchedBranch?.delayUnit ?? null;
        const delayValue = nextStepDelay?.delayValue ?? matchedBranch?.delayValue ?? null;
        const editNote = nextStepDelay?.editNote ?? "";

        chain.steps[nextIdx].status = "active";
        chain.steps[nextIdx].activatedAt = now;
        chain.steps[nextIdx].scheduledAt = calcScheduledAt(now, delayUnit, delayValue);
        chain.steps[nextIdx].delayUnit = delayUnit;
        chain.steps[nextIdx].delayValue = delayValue;
        chain.steps[nextIdx].delayEditNote = editNote;
        chain.currentStepIndex = nextIdx;
        // Ghi lại step thực tế được activate
        currentStep.activatedNextStepOrder = chain.steps[nextIdx].order;
      }
      // Nếu không có next step → chain vẫn active (user phải tự đóng)
    } else {
      // create_order, call_block_automation, add_from_other_chain, etc.
      // Advance sang step kế tiếp theo index nếu có
      const nextIdx = currentIdx + 1;
      if (nextIdx < chain.steps.length) {
        const delayUnit = nextStepDelay?.delayUnit ?? null;
        const delayValue = nextStepDelay?.delayValue ?? null;
        chain.steps[nextIdx].status = "active";
        chain.steps[nextIdx].activatedAt = now;
        chain.steps[nextIdx].scheduledAt = calcScheduledAt(now, delayUnit, delayValue);
        chain.steps[nextIdx].delayUnit = delayUnit;
        chain.steps[nextIdx].delayValue = delayValue;
        chain.currentStepIndex = nextIdx;
        currentStep.activatedNextStepOrder = chain.steps[nextIdx].order;
      }
      // Nếu không còn step → chain vẫn active cho user tự đóng
    }

    chain.markModified("steps");
    await chain.save();

    try {
      const lead = await Lead.findOne({ id: eventId });
      if (lead) {
        lead.activityLogs.push({
          action: "update",
          description: `Hoàn thành bước "${currentStep.actionName || currentStep.actionId}" trong chuỗi "${chain.name}"`,
          performedBy: {
            userId: req.user.id,
            userName: req.user.name,
            userAvatar: req.user.avatar || ""
          },
          metadata: {
            chainId: chain.id,
            stepOrder: currentStep.order,
            resultId: selectedResultId,
            reasonId: selectedReasonId,
            note: note,
            changes: {}
          }
        });
        await lead.save();
      }
    } catch (err) {
      console.error("Error logging action step to lead", err);
    }

    return sendSuccess(res, 200, "Lưu bước thành công", chain);
  }

  // ─── POST /api/events/:eventId/chains/:chainId/steps ───
  // Thêm mới một step vào chain (sau step hiện tại)
  async injectStep(req, res) {
    const { eventId, chainId } = req.params;

    const { actionId, delayUnit, delayValue, insertAfterOrder } = req.body;

    if (!actionId) throw createHttpError(400, "actionId là bắt buộc");

    const chain = await EventActionChain.findOne({ id: chainId, eventId });
    if (!chain) throw createHttpError(404, "Chuỗi hành động không tồn tại");
    if (chain.status === "closed") throw createHttpError(400, "Chuỗi đã đóng");

    // Load action info để snapshot
    const action = await Action.findOne({ id: actionId });
    if (!action) throw createHttpError(404, "Action không tồn tại");

    // ─── Duplicate check: mỗi action chỉ được xuất hiện 1 lần trong chuỗi ───
    const alreadyUsed = chain.steps.some(s => s.actionId === actionId);
    if (alreadyUsed) {
      throw createHttpError(409, `Hành động "${action.name}" đã tồn tại trong chuỗi này. Mỗi hành động chỉ được thêm một lần.`);
    }

    // Xác định vị trí insert: sau insertAfterOrder hoặc sau currentStepIndex
    const insertAfter = insertAfterOrder != null
      ? chain.steps.findIndex(s => s.order === insertAfterOrder)
      : chain.currentStepIndex;

    const insertIdx = insertAfter + 1;

    // Tính order cho step mới (giữa insertAfter và insertAfter+1)
    // Đơn giản: max(order) + 1 để tránh conflict
    const maxOrder = Math.max(...chain.steps.map(s => s.order), 0);
    const newOrder = maxOrder + 1;

    const newStep = {
      order: newOrder,
      actionId: action.id,
      actionName: action.name || "",
      actionType: action.type || "",
      actionCategory: action.category || "primary",
      actionReasonIds: action.reasonIds || [],
      branches: [],
      selectedResultId: null,
      selectedReasonId: null,
      note: "",
      delayUnit: delayUnit || null,
      delayValue: delayValue || null,
      activatedAt: null,
      scheduledAt: null,
      completedAt: null,
      delayEditNote: "",
      status: "pending",
      isLocked: false,
    };

    // Insert vào đúng vị trí trong mảng steps
    chain.steps.splice(insertIdx, 0, newStep);
    chain.markModified("steps");
    await chain.save();
    return sendSuccess(res, 201, "Thêm hành động thành công", chain);
  }

  // ─── PATCH /api/events/:eventId/chains/:chainId/steps/current/delay ───
  async updateCurrentStepDelay(req, res) {
    const { eventId, chainId } = req.params;

    const { delayUnit, delayValue, editNote } = req.body;

    const chain = await EventActionChain.findOne({ id: chainId, eventId });
    if (!chain) throw createHttpError(404, "Chuỗi hành động không tồn tại");
    if (chain.status === "closed") throw createHttpError(400, "Chuỗi đã đóng");

    const step = chain.steps[chain.currentStepIndex];
    if (!step) throw createHttpError(400, "Không có step active");
    if (step.isLocked) throw createHttpError(400, "Step đã lock");

    step.delayUnit = delayUnit ?? step.delayUnit;
    step.delayValue = delayValue ?? step.delayValue;
    step.delayEditNote = editNote || step.delayEditNote;

    // ── Bug fix: tính scheduledAt từ NOW (thời điểm user cập nhật),
    // không phải từ activatedAt (đã là quá khứ).
    // Nếu dùng activatedAt: delay 5p nhưng step đã active 2p → chỉ còn 3p.
    step.scheduledAt = calcScheduledAt(new Date(), step.delayUnit, step.delayValue);

    chain.markModified("steps");
    await chain.save();
    return sendSuccess(res, 200, "Cập nhật độ trễ thành công", chain);
  }

  // ─── PATCH /api/events/:eventId/chains/:chainId/steps/:stepOrder/note ───
  async updateStepNote(req, res) {
    const { eventId, chainId, stepOrder } = req.params;

    const { note } = req.body;

    const chain = await EventActionChain.findOne({ id: chainId, eventId });
    if (!chain) throw createHttpError(404, "Chuỗi hành động không tồn tại");

    const step = chain.steps.find(s => s.order === Number(stepOrder));
    if (!step) throw createHttpError(404, "Step không tồn tại");

    step.note = note ?? "";
    chain.markModified("steps");
    await chain.save();
    return sendSuccess(res, 200, "Cập nhật ghi chú thành công", chain);
  }

  // ─── PUT /api/events/:eventId/chains/:chainId/close ───
  async closeChain(req, res) {
    const { eventId, chainId } = req.params;

    const chain = await EventActionChain.findOne({ id: chainId, eventId });
    if (!chain) throw createHttpError(404, "Chuỗi hành động không tồn tại");
    if (chain.status === "closed") throw createHttpError(400, "Chuỗi đã đóng rồi");

    chain.status = "closed";
    const current = chain.steps[chain.currentStepIndex];
    if (current && !current.isLocked) current.status = "skipped";
    chain.markModified("steps");
    await chain.save();
    SystemLogService.log({ action: "update", resource: RESOURCES.EVENT_CHAINS, resourceId: chain.id, resourceName: chain.name, description: `Đóng chuỗi hành động "${chain.name}"`, metadata: { changes: { status: { from: "open", to: "closed" } } }, req });
    return sendSuccess(res, 200, "Đóng chuỗi hành động thành công", chain);
  }

  // ─── DELETE /api/events/:eventId/chains/:chainId ───
  async deleteChain(req, res) {
    const { eventId, chainId } = req.params;

    const chain = await EventActionChain.findOne({ id: chainId, eventId });
    if (!chain) throw createHttpError(404, "Chuỗi hành động không tồn tại");

    // Không cho xóa chuỗi đã đóng (trừ khi đang dev)
    const nodeEnv = process.env.NODE_ENV || "";
    const isDev = nodeEnv === "development" || nodeEnv === "developer" || nodeEnv === "dev";
    if (chain.status === "closed" && !isDev) {
      throw createHttpError(403, "Không thể xóa chuỗi đã đóng");
    }

    await EventActionChain.deleteOne({ id: chainId, eventId });
    SystemLogService.log({ action: "delete", resource: RESOURCES.EVENT_CHAINS, resourceId: chainId, resourceName: chain.name, description: `Xóa chuỗi hành động "${chain.name}" khỏi sự kiện ${eventId}`, metadata: { deletedItem: chain }, req });
    return sendSuccess(res, 200, "Xóa chuỗi hành động thành công", null);
  }

  // ─── GET /api/event-chains/queue ───
  // Returns active event-chains with their active step, enriched with event info.
  // Filtered by role (RBAC) + optional query params.
  // Sorted by scheduledAt ASC (most urgent first); null scheduledAt goes last.
  async getTaskQueue(req, res) {
    const { getUserRoleName } = require("../utils/rbac");

    const {
      eventId,
      overdueOnly,
      limit = 200,
      // Filters
      department,  // phòng ban
      group,       // nhóm trong phòng ban
      eventGroup,  // nhóm sự kiện (Event.group: user_moi, biz_moi, ...)
      search,      // tìm theo tên KH / NV / sự kiện
      assignee,    // nhân viên được phân công
    } = req.query;

    const now = new Date();
    const roleName = await getUserRoleName(req.user);
    const isAdminOrOwner = ["OWNER", "ADMIN"].includes(roleName);
    const isManager = roleName === "MANAGER";

    // ── 1. Xác định tập Event được phép xem (RBAC) ──────────────────────────
    const scopeFilter = req.resourceScopeFilter || {};

    let allowedEventIds = null; // null = không giới hạn (owner/admin)
    if (scopeFilter.$or) {
      const allowedEvents = await Event.find(scopeFilter).select("id");
      allowedEventIds = allowedEvents.map((e) => e.id);
    }

    // ── 2. Lọc EventActionChain theo eventId whitelist ───────────────────────
    const chainFilter = { status: "active", "steps.status": "active" };
    if (eventId) chainFilter.eventId = eventId;
    if (allowedEventIds !== null) chainFilter.eventId = { $in: allowedEventIds };

    // Nếu vừa có eventId vừa có whitelist → giao nhau
    if (eventId && allowedEventIds !== null) {
      chainFilter.eventId = allowedEventIds.includes(eventId) ? eventId : "__none__";
    }

    const chains = await EventActionChain.find(chainFilter)
      .sort({ "steps.scheduledAt": 1 })
      .limit(Number(limit));

    if (chains.length === 0) {
      return sendSuccess(res, 200, "Get task queue success", { items: [], total: 0 });
    }

    // ── 3. Batch-load events ─────────────────────────────────────────────────
    const rawEventIds = [...new Set(chains.map((c) => c.eventId))];
    const eventQuery = { id: { $in: rawEventIds } };

    // Filter eventGroup (nhóm sự kiện)
    if (eventGroup) {
      const groups = typeof eventGroup === "string" ? eventGroup.split(',').map(s => s.trim()).filter(Boolean) : eventGroup;
      eventQuery.group = { $in: Array.isArray(groups) ? groups : [groups] };
    }

    // Filter department (chỉ cho phép owner/admin/manager)
    if (department && !isAdminOrOwner && !isManager) {
      // staff không được filter dept → bỏ qua
    } else if (department) {
      const depts = typeof department === "string" ? department.split(',').map(s => s.trim()).filter(Boolean) : department;
      const deptsArray = Array.isArray(depts) ? depts : [depts];
      const deptAliases = deptsArray.map(normalizeOrganizationKey);

      const deptUsers = await User.find({
        $or: [
          { department: { $in: deptsArray } },
          { departmentAliases: { $in: deptAliases } }
        ]
      }).select("id");
      const deptUserIds = deptUsers.map((u) => u.id);
      eventQuery.assigneeId = { $in: deptUserIds };
    }

    // Filter group (nhóm trong phòng ban — chỉ owner/admin/manager)
    if (group && (isAdminOrOwner || isManager)) {
      const grps = typeof group === "string" ? group.split(',').map(s => s.trim()).filter(Boolean) : group;
      const grpsArray = Array.isArray(grps) ? grps : [grps];
      const grpAliasesRegex = grpsArray.map(g => new RegExp(normalizeOrganizationKey(g) + "$", "i"));

      const groupUsers = await User.find({
        $or: [
          { group: { $in: grpsArray } },
          { groupAliases: { $in: grpAliasesRegex } }
        ]
      }).select("id");
      const groupUserIds = groupUsers.map((u) => u.id);
      // Nếu đã filter dept, giao nhau với assigneeId.$in
      if (eventQuery.assigneeId && eventQuery.assigneeId.$in) {
        eventQuery.assigneeId.$in = eventQuery.assigneeId.$in.filter((id) =>
          groupUserIds.includes(id)
        );
      } else {
        eventQuery.assigneeId = { $in: groupUserIds };
      }
    }

    // Filter assignee
    if (assignee) {
      const assignees = typeof assignee === "string" ? assignee.split(',').map(s => s.trim()).filter(Boolean) : assignee;
      const assigneeIds = Array.isArray(assignees) ? assignees : [assignees];
      if (eventQuery.assigneeId && eventQuery.assigneeId.$in) {
        eventQuery.assigneeId.$in = eventQuery.assigneeId.$in.filter((id) =>
          assigneeIds.includes(id)
        );
      } else {
        eventQuery.assigneeId = { $in: assigneeIds };
      }
    }

    // Search (tên KH, tên NV, tên sự kiện)
    if (search && search.trim()) {
      const s = search.trim();
      const regex = new RegExp(s, "i");
      eventQuery.$or = [
        { name: regex },
        { "customer.name": regex },
        { "assignee.name": regex },
      ];
    }

    const events = await Event.find(eventQuery)
      .select("id name sub group stage customer assignee plan assigneeId");
    const eventMap = Object.fromEntries(events.map((e) => [e.id, e]));

    // ── 4. Build queue ───────────────────────────────────────────────────────
    const queue = [];
    for (const chain of chains) {
      const activeStep = chain.steps.find((s) => s.status === "active");
      if (!activeStep) continue;
      if (overdueOnly === "true" && activeStep.scheduledAt && activeStep.scheduledAt > now) continue;

      const evt = eventMap[chain.eventId];
      if (!evt) continue; // orphan hoặc bị lọc ra bởi eventQuery

      queue.push({
        chainId: chain.id,
        chainName: chain.name,
        eventId: chain.eventId,
        event: {
          id: evt.id,
          name: evt.name,
          sub: evt.sub,
          group: evt.group,
          stage: evt.stage,
          customer: evt.customer,
          assignee: evt.assignee,
          plan: evt.plan,
        },
        step: {
          order: activeStep.order,
          actionId: activeStep.actionId,
          actionName: activeStep.actionName,
          actionType: activeStep.actionType,
          actionCategory: activeStep.actionCategory,
          scheduledAt: activeStep.scheduledAt,
          activatedAt: activeStep.activatedAt,
          delayUnit: activeStep.delayUnit,
          delayValue: activeStep.delayValue,
          isOverdue: !!activeStep.scheduledAt && activeStep.scheduledAt < now,
        },
      });
    }

    // Sort: overdue first, then scheduledAt asc, null last
    queue.sort((a, b) => {
      const sa = a.step.scheduledAt ? new Date(a.step.scheduledAt).getTime() : Infinity;
      const sb = b.step.scheduledAt ? new Date(b.step.scheduledAt).getTime() : Infinity;
      return sa - sb;
    });

    return sendSuccess(res, 200, "Get task queue success", { items: queue, total: queue.length });
  }
  /**
   * PUT /api/events/:eventId/chains/:chainId/steps/:stepOrder/branches
   *
   * Adds or updates a branch on a specific step of an EventActionChain.
   * Branches are stored directly on the event-chain step → template is NEVER touched.
   * Works for both template-originated steps and manually-injected steps.
   */
  async upsertStepBranch(req, res) {
    const { eventId, chainId, stepOrder } = req.params;

    const {
      resultId, nextStepType, nextActionId = null,
      closeOutcome = null, delayUnit = null, delayValue = null,
    } = req.body;

    const chain = await EventActionChain.findOne({ id: chainId, eventId });
    if (!chain) throw createHttpError(404, "Chuỗi hành động không tồn tại");
    if (chain.status === "closed") throw createHttpError(400, "Chuỗi đã đóng");

    const step = chain.steps.find(s => s.order === Number(stepOrder));
    if (!step) throw createHttpError(404, `Không tìm thấy step order=${stepOrder}`);
    if (step.isLocked) throw createHttpError(400, "Step đã lock, không thể chỉnh sửa cấu hình");

    // Validate: next_in_chain bắt buộc phải chỉ định nextActionId
    if (nextStepType === "next_in_chain" && !nextActionId) {
      throw createHttpError(422, "Khi chọn loại 'Hành động tiếp theo trong chuỗi', phải chỉ định hành động cụ thể (nextActionId)");
    }

    // Upsert: nếu đã có branch với resultId đó thì cập nhật, ngược lại thêm mới
    const existingIdx = step.branches.findIndex(b => b.resultId === resultId);
    const branchData = {
      resultId,
      order: existingIdx >= 0 ? step.branches[existingIdx].order : step.branches.length,
      nextStepType,
      nextActionId: nextStepType === "next_in_chain" ? nextActionId : null,
      closeOutcome: nextStepType === "close_task" ? closeOutcome : null,
      delayUnit,
      delayValue,
    };

    if (existingIdx >= 0) {
      step.branches[existingIdx] = branchData;
    } else {
      step.branches.push(branchData);
    }

    chain.markModified("steps");
    await chain.save();
    return sendSuccess(res, 200, "Cập nhật cấu hình kết quả thành công", chain);
  }

  /**
   * DELETE /api/events/:eventId/chains/:chainId/steps/:stepOrder/branches/:resultId
   *
   * Removes a branch from a specific EventActionChain step.
   */
  async deleteStepBranch(req, res) {
    const { eventId, chainId, stepOrder, resultId } = req.params;


    const chain = await EventActionChain.findOne({ id: chainId, eventId });
    if (!chain) throw createHttpError(404, "Chuỗi hành động không tồn tại");
    if (chain.status === "closed") throw createHttpError(400, "Chuỗi đã đóng");

    const step = chain.steps.find(s => s.order === Number(stepOrder));
    if (!step) throw createHttpError(404, `Không tìm thấy step order=${stepOrder}`);
    if (step.isLocked) throw createHttpError(400, "Step đã lock, không thể chỉnh sửa cấu hình");

    const before = step.branches.length;
    step.branches = step.branches.filter(b => b.resultId !== resultId);
    if (step.branches.length === before) throw createHttpError(404, "Branch không tồn tại");

    // Nếu đang select kết quả vừa xóa → reset
    if (step.selectedResultId === resultId) step.selectedResultId = null;

    chain.markModified("steps");
    await chain.save();
    return sendSuccess(res, 200, "Xóa kết quả khỏi bước thành công", chain);
  }

  /**
   * POST /api/events/:eventId/chains/:chainId/steps/current/execute-block-automation
   *
   * Executes the block automation linked to the active step's action:
   * 1. Loads the step's Action → blockAutomationId
   * 2. Loads BlockAutomation config (URL, token, payloadTemplate)
   * 3. Loads Event data and resolves {{placeholders}} in the template
   * 4. Sends HTTP request to the third-party API
   * 5. Returns the result (success/error, response data, resolved payload)
   */
  async executeBlockAutomationStep(req, res) {
    const { eventId, chainId } = req.params;

    const chain = await EventActionChain.findOne({ id: chainId, eventId });
    if (!chain) throw createHttpError(404, "Chuỗi hành động không tồn tại");
    if (chain.status === "closed") throw createHttpError(400, "Chuỗi đã đóng");

    const currentStep = chain.steps[chain.currentStepIndex];
    if (!currentStep) throw createHttpError(400, "Không có step nào đang active");
    if (currentStep.actionType !== "send_block_automation") {
      throw createHttpError(400, "Step hiện tại không phải loại Block Automation");
    }

    // Load event + block automation names for logging context
    const event = await Event.findOne({ id: eventId }).select("name").lean();

    const startTime = Date.now();
    const result = await executeBlockAutomation(eventId, currentStep.actionId);
    const duration = Date.now() - startTime;

    // Persist result on the step
    const prevAttempts = currentStep.blockAutomationResult?.attempts || 0;
    currentStep.blockAutomationResult = {
      success: result.success,
      status: result.status,
      message: result.success
        ? `Thành công — HTTP ${result.status}`
        : (result.error || `Thất bại — HTTP ${result.status}`),
      attempts: prevAttempts + 1,
      lastExecutedAt: new Date(),
      // Store truncated response for audit (avoid storing huge payloads)
      responseData: result.responseData
        ? JSON.parse(JSON.stringify(result.responseData).substring(0, 2000))
        : null,
    };

    chain.markModified("steps");
    await chain.save();

    // Log automation execution
    AutomationLogService.log({
      eventId,
      eventName: event?.name || "",
      chainId,
      chainName: chain.name,
      actionId: currentStep.actionId,
      actionName: currentStep.actionName,
      blockAutomationId: result.blockAutomationName ? undefined : null,
      blockAutomationName: result.blockAutomationName || "",
      url: result.url || "",
      method: result.method || "POST",
      resolvedPayload: result.resolvedPayload,
      responseStatus: result.status,
      responseStatusText: result.statusText,
      responseData: result.responseData,
      status: result.success ? "success" : "failed",
      error: result.error,
      duration,
      attemptCount: currentStep.blockAutomationResult.attempts,
      req,
    });

    // Also log as system activity
    SystemLogService.log({
      action: "other",
      resource: RESOURCES.EVENT_CHAINS,
      resourceId: chainId,
      resourceName: chain.name,
      description: `Thực thi Block Automation "${result.blockAutomationName || ''}" cho sự kiện "${event?.name || eventId}" — ${result.success ? 'Thành công' : 'Thất bại'}`,
      req,
      status: result.success ? "success" : "failed",
      error: result.error,
    });

    return sendSuccess(res, 200, "Thực thi Block Automation hoàn tất", result);
  }

}

module.exports = new EventActionChainController();
