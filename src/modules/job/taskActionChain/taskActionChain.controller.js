/**
 * TaskActionChainController — Chuỗi hành động trong Tác vụ (standalone).
 *
 * Tương tự EventActionChainController nhưng dùng taskId thay vì eventId.
 * Không cần ownership check phức tạp vì tác vụ không gắn event.
 */
const EventActionChain = require('../../event/eventActionChain/eventActionChain.model');
const ActionChain = require('../../event/eventActionChain/actionChain.model');
const Action = require('../../event/actionConfig/action.model');
const Task = require('../task/task.model');
const TaskService = require('../task/task.service');
const { createHttpError, sendSuccess } = require('../../../core/utils/http');
const { ACTION_TYPE_CATEGORY_MAP } = require('../../../core/constants/actionConfig');
const { executeBlockAutomation } = require('../../event/eventActionChain/blockAutomationExecutor');
const SystemLogService = require('../../system/log/systemLog.service');
const AutomationLogService = require('../../system/log/automationLog.service');
const env = require('../../../core/config/env');

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

class TaskActionChainController {

  // ─── GET /api/tasks/:taskId/chains ───
  async getChains(req, res) {
    const { taskId } = req.params;
    const chains = await EventActionChain.find({ taskId }).sort({ order: 1 });
    return sendSuccess(res, 200, "Get task action chains success", chains);
  }

  // ─── POST /api/tasks/:taskId/chains ───
  async addChain(req, res) {
    const { taskId } = req.params;
    const { chainId } = req.body;

    // Verify task exists, isn't closed, and user has ownership/access


    const template = await ActionChain.findOne({ id: chainId }).lean();
    if (!template) throw createHttpError(404, "ActionChain không tồn tại");
    if (!template.active) throw createHttpError(422, "Chỉ có thể thêm chuỗi hành động đang kích hoạt (active) vào tác vụ");

    const exists = await EventActionChain.findOne({ taskId, chainId });
    if (exists) throw createHttpError(409, "Chuỗi hành động này đã được thêm vào tác vụ");

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

    const chainCount = await EventActionChain.countDocuments({ taskId });
    const id = `TAC-${taskId}-${chainId}-${Date.now()}`;

    const chain = new EventActionChain({
      id,
      taskId,
      eventId: null,
      chainId,
      name: template.name,
      status: "active",
      order: chainCount + 1,
      currentStepIndex: 0,
      steps,
    });

    await chain.save();
    await Task.updateOne(
      { id: taskId },
      {
        $push: {
          logs: {
            action: "add_chain",
            description: `Thêm chuỗi hành động "${chain.name}"`,
            user: { id: req.user.id, name: req.user.name, email: req.user.email },
          }
        }
      }
    );
    return sendSuccess(res, 201, "Thêm chuỗi hành động thành công", chain);
  }

  // ─── PUT /api/tasks/:taskId/chains/:chainId/steps/current ───
  async saveCurrentStep(req, res) {
    const { taskId, chainId } = req.params;

    const {
      selectedResultId, selectedReasonId, note,
      nextStepDelay,
      /**
 * nextStepOverride: user chủ động chọn action tiếp theo thay vì follow branch
 * { targetStepOrder: number }  → activate step có order đó
 */
      nextStepOverride,
    } = req.body;

    const chain = await EventActionChain.findOne({ id: chainId, taskId });
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
    switch (nextStepType) {
      case "close_task":
      case "close_chain":
      case "close_chain_clone_task":
        // Đóng chuỗi
        chain.status = "closed";
        currentStep.activatedNextStepOrder = null;
        break;

      case "next_in_chain": {
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
        break;
      }

      default: {
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
        break;
      }
    }

    chain.markModified("steps");
    await chain.save();

    if (nextStepType === "close_task") {
      await TaskService.closeTask(taskId, req.user);
    }

    return sendSuccess(res, 200, "Lưu bước thành công", chain);
  }

  // ─── POST /api/tasks/:taskId/chains/:chainId/steps ───
  // Thêm mới một step vào chain (sau step hiện tại)
  async injectStep(req, res) {
    const { taskId, chainId } = req.params;

    const { actionId, delayUnit, delayValue, insertAfterOrder } = req.body;

    if (!actionId) throw createHttpError(400, "actionId là bắt buộc");

    const chain = await EventActionChain.findOne({ id: chainId, taskId });
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

  // ─── PATCH delay ───
  async updateCurrentStepDelay(req, res) {
    const { taskId, chainId } = req.params;

    const { delayUnit, delayValue, editNote } = req.body;

    const chain = await EventActionChain.findOne({ id: chainId, taskId });
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

  // ─── PATCH note ───
  async updateStepNote(req, res) {
    const { taskId, chainId, stepOrder } = req.params;

    const { note } = req.body;

    const chain = await EventActionChain.findOne({ id: chainId, taskId });
    if (!chain) throw createHttpError(404, "Chuỗi hành động không tồn tại");

    const step = chain.steps.find(s => s.order === Number(stepOrder));
    if (!step) throw createHttpError(404, "Step không tồn tại");

    step.note = note ?? "";
    chain.markModified("steps");
    await chain.save();
    return sendSuccess(res, 200, "Cập nhật ghi chú thành công", chain);
  }

  // ─── PUT close ───
  async closeChain(req, res) {
    const { taskId, chainId } = req.params;

    const chain = await EventActionChain.findOne({ id: chainId, taskId });
    if (!chain) throw createHttpError(404, "Chuỗi hành động không tồn tại");
    if (chain.status === "closed") throw createHttpError(400, "Chuỗi đã đóng rồi");

    chain.status = "closed";
    const current = chain.steps[chain.currentStepIndex];
    if (current && !current.isLocked) current.status = "skipped";
    chain.markModified("steps");
    await chain.save();
    return sendSuccess(res, 200, "Đóng chuỗi hành động thành công", chain);
  }

  // ─── DELETE ───
  async deleteChain(req, res) {
    const { taskId, chainId } = req.params;

    const chain = await EventActionChain.findOne({ id: chainId, taskId });
    if (!chain) throw createHttpError(404, "Chuỗi hành động không tồn tại");

    // Không cho xóa chuỗi đã đóng (trừ khi đang dev)
    const nodeEnv = env.nodeEnv || "";
    const isDev = nodeEnv === "development" || nodeEnv === "developer" || nodeEnv === "dev";
    if (chain.status === "closed" && !isDev) {
      throw createHttpError(403, "Không thể xóa chuỗi đã đóng");
    }
    await EventActionChain.deleteOne({ id: chainId, taskId });
    return sendSuccess(res, 200, "Xóa chuỗi hành động thành công", null);
  }

  // ─── PUT branches ───
  async upsertStepBranch(req, res) {
    const { taskId, chainId, stepOrder } = req.params;

    const {
      resultId, nextStepType, nextActionId = null,
      closeOutcome = null, delayUnit = null, delayValue = null,
    } = req.body;

    const chain = await EventActionChain.findOne({ id: chainId, taskId });
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

  // ─── DELETE branch ───
  // Removes a branch from a specific EventActionChain step.
  async deleteStepBranch(req, res) {
    const { taskId, chainId, stepOrder, resultId } = req.params;


    const chain = await EventActionChain.findOne({ id: chainId, taskId });
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

  // ─── Execute Block Automation ───
  /**
   * Executes the block automation linked to the active step's action:
   * 1. Loads the step's Action → blockAutomationId
   * 2. Loads BlockAutomation config (URL, token, payloadTemplate)
   * 3. Loads Event data and resolves {{placeholders}} in the template
   * 4. Sends HTTP request to the third-party API
   * 5. Returns the result (success/error, response data, resolved payload)
   */
  async executeBlockAutomationStep(req, res) {
    const { taskId, chainId } = req.params;

    const chain = await EventActionChain.findOne({ id: chainId, taskId });
    if (!chain) throw createHttpError(404, "Chuỗi hành động không tồn tại");
    if (chain.status === "closed") throw createHttpError(400, "Chuỗi đã đóng");
    const currentStep = chain.steps[chain.currentStepIndex];
    if (!currentStep) throw createHttpError(400, "Không có step nào đang active");
    if (currentStep.actionType !== "send_block_automation") {
      throw createHttpError(400, "Step hiện tại không phải loại Block Automation");
    }

    // Load event + block automation names for logging context
    const task = await Task.findOne({ id: taskId }).select("name").lean();
    const startTime = Date.now();
    const result = await executeBlockAutomation(taskId, currentStep.actionId, "task");
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
      eventId: taskId,
      eventName: task?.name || "",
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

    return sendSuccess(res, 200, "Thực thi Block Automation hoàn tất", result);
  }
}

module.exports = new TaskActionChainController();
