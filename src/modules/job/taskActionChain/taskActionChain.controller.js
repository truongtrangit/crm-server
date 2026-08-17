/**
 * TaskActionChainController — Chuỗi hành động trong Tác vụ (standalone).
 *
 * Tương tự EventActionChainController nhưng dùng taskId thay vì eventId.
 * Không cần ownership check phức tạp vì tác vụ không gắn event.
 */
const { sendSuccess } = require('../../../core/utils/http');
const TaskActionChainService = require('./taskActionChain.service');

class TaskActionChainController {

  // ─── GET /api/tasks/:taskId/chains ───
  async getChains(req, res) {
    const { taskId } = req.params;
    const chains = await TaskActionChainService.getChains(taskId);
    return sendSuccess(res, 200, "Get task action chains success", chains);
  }

  // ─── POST /api/tasks/:taskId/chains ───
  async addChain(req, res) {
    const { taskId } = req.params;
    const { chainId } = req.body;
    const chain = await TaskActionChainService.addChainToTask(taskId, chainId, req.user);
    return sendSuccess(res, 201, "Thêm chuỗi hành động thành công", chain);
  }

  // ─── PUT /api/tasks/:taskId/chains/:chainId/steps/current ───
  async saveCurrentStep(req, res) {
    const { taskId, chainId } = req.params;
    const chain = await TaskActionChainService.saveCurrentStep(taskId, chainId, req.body, req.user);
    return sendSuccess(res, 200, "Lưu bước thành công", chain);
  }

  // ─── POST /api/tasks/:taskId/chains/:chainId/steps ───
  async injectStep(req, res) {
    const { taskId, chainId } = req.params;
    const chain = await TaskActionChainService.injectStep(taskId, chainId, req.body);
    return sendSuccess(res, 201, "Thêm hành động thành công", chain);
  }

  // ─── PATCH delay ───
  async updateCurrentStepDelay(req, res) {
    const { taskId, chainId } = req.params;
    const chain = await TaskActionChainService.updateCurrentStepDelay(taskId, chainId, req.body);
    return sendSuccess(res, 200, "Cập nhật độ trễ thành công", chain);
  }

  // ─── PATCH note ───
  async updateStepNote(req, res) {
    const { taskId, chainId, stepOrder } = req.params;
    const { note } = req.body;
    const chain = await TaskActionChainService.updateStepNote(taskId, chainId, stepOrder, note);
    return sendSuccess(res, 200, "Cập nhật ghi chú thành công", chain);
  }

  // ─── PUT close ───
  async closeChain(req, res) {
    const { taskId, chainId } = req.params;
    const chain = await TaskActionChainService.closeChain(taskId, chainId);
    return sendSuccess(res, 200, "Đóng chuỗi hành động thành công", chain);
  }

  // ─── DELETE ───
  async deleteChain(req, res) {
    const { taskId, chainId } = req.params;
    await TaskActionChainService.deleteChain(taskId, chainId);
    return sendSuccess(res, 200, "Xóa chuỗi hành động thành công", null);
  }

  // ─── PUT branches ───
  async upsertStepBranch(req, res) {
    const { taskId, chainId, stepOrder } = req.params;
    const chain = await TaskActionChainService.upsertStepBranch(taskId, chainId, stepOrder, req.body);
    return sendSuccess(res, 200, "Cập nhật cấu hình kết quả thành công", chain);
  }

  // ─── DELETE branch ───
  async deleteStepBranch(req, res) {
    const { taskId, chainId, stepOrder, resultId } = req.params;
    const chain = await TaskActionChainService.deleteStepBranch(taskId, chainId, stepOrder, resultId);
    return sendSuccess(res, 200, "Xóa kết quả khỏi bước thành công", chain);
  }

  // ─── Execute Block Automation ───
  async executeBlockAutomationStep(req, res) {
    const { taskId, chainId } = req.params;
    const result = await TaskActionChainService.executeBlockAutomationStep(taskId, chainId, req);
    return sendSuccess(res, 200, "Thực thi Block Automation hoàn tất", result);
  }
}

module.exports = new TaskActionChainController();
