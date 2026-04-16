const EventActionChain = require("../models/EventActionChain");
const ActionChain = require("../models/ActionChain");
const Action = require("../models/Action");
const { createHttpError, sendSuccess } = require("../utils/http");
const { ACTION_TYPE_CATEGORY_MAP } = require("../constants/actionConfig");

// ─── Helpers ───

function calcScheduledAt(activatedAt, delayUnit, delayValue) {
  if (!activatedAt || !delayUnit || delayUnit === "immediate" || !delayValue) {
    return activatedAt || new Date();
  }
  const d = new Date(activatedAt);
  switch (delayUnit) {
    case "minute": d.setTime(d.getTime() + delayValue * 60 * 1000); break;
    case "hour":   d.setTime(d.getTime() + delayValue * 60 * 60 * 1000); break;
    case "day":    d.setTime(d.getTime() + delayValue * 24 * 60 * 60 * 1000); break;
    case "week":   d.setTime(d.getTime() + delayValue * 7 * 24 * 60 * 60 * 1000); break;
    default: break;
  }
  return d;
}

async function buildStepSnapshot(templateStep, actionMap) {
  const action = actionMap[templateStep.actionId];
  return {
    order:           templateStep.order,
    actionId:        templateStep.actionId,
    actionName:      action?.name || "",
    actionType:      action?.type || "",
    actionCategory:  action?.category || ACTION_TYPE_CATEGORY_MAP?.[action?.type] || "primary",
    actionReasonIds: action?.reasonIds || [],
    branches:        templateStep.branches.map(b => ({ ...b.toObject?.() || b })),
    selectedResultId:  null,
    selectedReasonId:  null,
    note:            "",
    delayUnit:       null,
    delayValue:      null,
    activatedAt:     null,
    scheduledAt:     null,
    completedAt:     null,
    delayEditNote:   "",
    status:          "pending",
    isLocked:        false,
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

    const template = await ActionChain.findOne({ id: chainId });
    if (!template) throw createHttpError(404, "ActionChain không tồn tại");

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
      steps[0].status = "active";
      steps[0].activatedAt = now;
      steps[0].scheduledAt = now;
    }

    const chainCount = await EventActionChain.countDocuments({ eventId });
    const id = `EAC-${eventId}-${chainId}-${Date.now()}`;

    const chain = new EventActionChain({
      id, eventId, chainId,
      name:    template.name,
      status:  "active",
      order:   chainCount + 1,
      currentStepIndex: 0,
      steps,
    });

    await chain.save();
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
        const delayUnit  = nextStepOverride.delayUnit  ?? null;
        const delayValue = nextStepOverride.delayValue ?? null;
        const step = chain.steps[overrideIdx];
        step.status      = "active";
        step.activatedAt = now;
        step.scheduledAt = calcScheduledAt(now, delayUnit, delayValue);
        step.delayUnit   = delayUnit;
        step.delayValue  = delayValue;
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
        const delayUnit  = nextStepDelay?.delayUnit  ?? matchedBranch?.delayUnit  ?? null;
        const delayValue = nextStepDelay?.delayValue ?? matchedBranch?.delayValue ?? null;
        const editNote   = nextStepDelay?.editNote   ?? "";

        chain.steps[nextIdx].status        = "active";
        chain.steps[nextIdx].activatedAt   = now;
        chain.steps[nextIdx].scheduledAt   = calcScheduledAt(now, delayUnit, delayValue);
        chain.steps[nextIdx].delayUnit     = delayUnit;
        chain.steps[nextIdx].delayValue    = delayValue;
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
        const delayUnit  = nextStepDelay?.delayUnit  ?? null;
        const delayValue = nextStepDelay?.delayValue ?? null;
        chain.steps[nextIdx].status      = "active";
        chain.steps[nextIdx].activatedAt = now;
        chain.steps[nextIdx].scheduledAt = calcScheduledAt(now, delayUnit, delayValue);
        chain.steps[nextIdx].delayUnit   = delayUnit;
        chain.steps[nextIdx].delayValue  = delayValue;
        chain.currentStepIndex = nextIdx;
        currentStep.activatedNextStepOrder = chain.steps[nextIdx].order;
      }
      // Nếu không còn step → chain vẫn active cho user tự đóng
    }

    chain.markModified("steps");
    await chain.save();
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
      order:           newOrder,
      actionId:        action.id,
      actionName:      action.name || "",
      actionType:      action.type || "",
      actionCategory:  action.category || "primary",
      actionReasonIds: action.reasonIds || [],
      branches:        [],
      selectedResultId:  null,
      selectedReasonId:  null,
      note:            "",
      delayUnit:       delayUnit || null,
      delayValue:      delayValue || null,
      activatedAt:     null,
      scheduledAt:     null,
      completedAt:     null,
      delayEditNote:   "",
      status:          "pending",
      isLocked:        false,
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

    step.delayUnit    = delayUnit ?? step.delayUnit;
    step.delayValue   = delayValue ?? step.delayValue;
    step.delayEditNote= editNote || step.delayEditNote;
    step.scheduledAt  = calcScheduledAt(step.activatedAt, step.delayUnit, step.delayValue);

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
    return sendSuccess(res, 200, "Xóa chuỗi hành động thành công", null);
  }

  // ─── GET /api/event-chains/queue ───
  async getTaskQueue(req, res) {
    const { eventId, limit = 50, overdueOnly } = req.query;
    const now = new Date();

    const matchFilter = { status: "active", "steps.status": "active" };
    if (eventId) matchFilter.eventId = eventId;

    const chains = await EventActionChain.find(matchFilter)
      .sort({ "steps.scheduledAt": 1 })
      .limit(Number(limit));

    const queue = [];
    for (const chain of chains) {
      const activeStep = chain.steps.find(s => s.status === "active");
      if (!activeStep) continue;
      if (overdueOnly === "true" && activeStep.scheduledAt > now) continue;

      queue.push({
        chainId:   chain.id,
        chainName: chain.name,
        eventId:   chain.eventId,
        step: {
          order:          activeStep.order,
          actionId:       activeStep.actionId,
          actionName:     activeStep.actionName,
          actionType:     activeStep.actionType,
          actionCategory: activeStep.actionCategory,
          scheduledAt:    activeStep.scheduledAt,
          activatedAt:    activeStep.activatedAt,
          delayUnit:      activeStep.delayUnit,
          delayValue:     activeStep.delayValue,
          isOverdue:      activeStep.scheduledAt && activeStep.scheduledAt < now,
        },
      });
    }

    queue.sort((a, b) => new Date(a.step.scheduledAt) - new Date(b.step.scheduledAt));
    return sendSuccess(res, 200, "Get task queue success", { items: queue, total: queue.length });
  }
}

module.exports = new EventActionChainController();
