const ActionConfigService = require("../services/ActionConfigService");
const { sendSuccess } = require("../utils/http");
const SystemLogService = require("../services/SystemLogService");
const { RESOURCES } = require("../constants/rbac");

class ActionConfigController {
  // ─── Results ───
  async listResults(req, res) {
    const result = await ActionConfigService.listResults(req.query);
    return sendSuccess(res, 200, "Get results success", result);
  }

  async createResult(req, res) {
    const item = await ActionConfigService.createResult(req.body);
    SystemLogService.log({ action: "create", resource: RESOURCES.ACTIONS_CFG, resourceId: item.id, resourceName: item.name, description: `Tạo kết quả "${item.name}"`, req });
    return sendSuccess(res, 201, "Create result success", item);
  }

  async updateResult(req, res) {
    const { result: item, changes } = await ActionConfigService.updateResult(req.params.id, req.body);
    SystemLogService.log({ action: "update", resource: RESOURCES.ACTIONS_CFG, resourceId: item.id, resourceName: item.name, description: `Cập nhật kết quả "${item.name}"`, metadata: { changes }, req });
    return sendSuccess(res, 200, "Update result success", item);
  }

  async deleteResult(req, res) {
    const force = req.query.force === 'true';
    const deleted = await ActionConfigService.deleteResult(req.params.id, { force });
    SystemLogService.log({ action: "delete", resource: RESOURCES.ACTIONS_CFG, resourceId: req.params.id, resourceName: deleted.name, description: `Xóa kết quả "${deleted.name}"`, metadata: { deletedItem: deleted }, req });
    return sendSuccess(res, 200, "Delete result success", null);
  }

  // ─── Reasons ───
  async listReasons(req, res) {
    const result = await ActionConfigService.listReasons(req.query);
    return sendSuccess(res, 200, "Get reasons success", result);
  }

  async createReason(req, res) {
    const item = await ActionConfigService.createReason(req.body);
    SystemLogService.log({ action: "create", resource: RESOURCES.ACTIONS_CFG, resourceId: item.id, resourceName: item.name, description: `Tạo lý do "${item.name}"`, req });
    return sendSuccess(res, 201, "Create reason success", item);
  }

  async updateReason(req, res) {
    const { reason: item, changes } = await ActionConfigService.updateReason(req.params.id, req.body);
    SystemLogService.log({ action: "update", resource: RESOURCES.ACTIONS_CFG, resourceId: item.id, resourceName: item.name, description: `Cập nhật lý do "${item.name}"`, metadata: { changes }, req });
    return sendSuccess(res, 200, "Update reason success", item);
  }

  async deleteReason(req, res) {
    const force = req.query.force === 'true';
    const deleted = await ActionConfigService.deleteReason(req.params.id, { force });
    SystemLogService.log({ action: "delete", resource: RESOURCES.ACTIONS_CFG, resourceId: req.params.id, resourceName: deleted.name, description: `Xóa lý do "${deleted.name}"`, metadata: { deletedItem: deleted }, req });
    return sendSuccess(res, 200, "Delete reason success", null);
  }

  // ─── Actions ───
  async listActions(req, res) {
    const result = await ActionConfigService.listActions(req.query);
    return sendSuccess(res, 200, "Get actions success", result);
  }

  async createAction(req, res) {
    const item = await ActionConfigService.createAction(req.body);
    SystemLogService.log({ action: "create", resource: RESOURCES.ACTIONS_CFG, resourceId: item.id, resourceName: item.name, description: `Tạo hành động "${item.name}"`, req });
    return sendSuccess(res, 201, "Create action success", item);
  }

  async updateAction(req, res) {
    const { action: item, changes } = await ActionConfigService.updateAction(req.params.id, req.body);
    SystemLogService.log({ action: "update", resource: RESOURCES.ACTIONS_CFG, resourceId: item.id, resourceName: item.name, description: `Cập nhật hành động "${item.name}"`, metadata: { changes }, req });
    return sendSuccess(res, 200, "Update action success", item);
  }

  async deleteAction(req, res) {
    const force = req.query.force === 'true';
    const deleted = await ActionConfigService.deleteAction(req.params.id, { force });
    SystemLogService.log({ action: "delete", resource: RESOURCES.ACTIONS_CFG, resourceId: req.params.id, resourceName: deleted.name, description: `Xóa hành động "${deleted.name}"`, metadata: { deletedItem: deleted }, req });
    return sendSuccess(res, 200, "Delete action success", null);
  }

  // ─── Action Chains ───
  async listActionChains(req, res) {
    const result = await ActionConfigService.listActionChains(req.query);
    return sendSuccess(res, 200, "Get action chains success", result);
  }

  async getActionChain(req, res) {
    const item = await ActionConfigService.getActionChain(req.params.id);
    return sendSuccess(res, 200, "Get action chain detail success", item);
  }

  async createActionChain(req, res) {
    const item = await ActionConfigService.createActionChain(req.body);
    SystemLogService.log({ action: "create", resource: RESOURCES.ACTIONS_CFG, resourceId: item.id, resourceName: item.name, description: `Tạo chuỗi hành động "${item.name}"`, req });
    return sendSuccess(res, 201, "Create action chain success", item);
  }

  async updateActionChain(req, res) {
    const { actionChain: item, changes } = await ActionConfigService.updateActionChain(req.params.id, req.body);
    SystemLogService.log({ action: "update", resource: RESOURCES.ACTIONS_CFG, resourceId: item.id, resourceName: item.name, description: `Cập nhật chuỗi hành động "${item.name}"`, metadata: { changes }, req });
    return sendSuccess(res, 200, "Update action chain success", item);
  }

  async deleteActionChain(req, res) {
    const force = req.query.force === 'true';
    const deleted = await ActionConfigService.deleteActionChain(req.params.id, { force });
    SystemLogService.log({ action: "delete", resource: RESOURCES.ACTIONS_CFG, resourceId: req.params.id, resourceName: deleted.name, description: `Xóa chuỗi hành động "${deleted.name}"`, metadata: { deletedItem: deleted }, req });
    return sendSuccess(res, 200, "Delete action chain success", null);
  }

  /**
   * PUT /chains/:id/rule — Save rule configuration (steps + branches) for a chain.
   */
  async saveChainRule(req, res) {
    const { actionChain: chain, changes } = await ActionConfigService.saveChainRule(req.params.id, req.body);
    SystemLogService.log({ action: "update", resource: RESOURCES.ACTIONS_CFG, resourceId: chain.id, resourceName: chain.name, description: `Cập nhật cấu hình rule chuỗi "${chain.name}"`, metadata: { changes }, req });
    return sendSuccess(res, 200, "Save chain rule success", chain);
  }

  // ─── Block Automations ───
  async listBlockAutomations(req, res) {
    const result = await ActionConfigService.listBlockAutomations(req.query);
    return sendSuccess(res, 200, "Get block automations success", result);
  }

  async getBlockAutomation(req, res) {
    const item = await ActionConfigService.getBlockAutomation(req.params.id);
    return sendSuccess(res, 200, "Get block automation detail success", item);
  }

  async createBlockAutomation(req, res) {
    const item = await ActionConfigService.createBlockAutomation(req.body);
    SystemLogService.log({ action: "create", resource: RESOURCES.ACTIONS_CFG, resourceId: item.id, resourceName: item.name, description: `Tạo Block Automation "${item.name}"`, req });
    return sendSuccess(res, 201, "Create block automation success", item);
  }

  async updateBlockAutomation(req, res) {
    const { blockAutomation: item, changes } = await ActionConfigService.updateBlockAutomation(req.params.id, req.body);
    SystemLogService.log({ action: "update", resource: RESOURCES.ACTIONS_CFG, resourceId: item.id, resourceName: item.name, description: `Cập nhật Block Automation "${item.name}"`, metadata: { changes }, req });
    return sendSuccess(res, 200, "Update block automation success", item);
  }

  async deleteBlockAutomation(req, res) {
    const deleted = await ActionConfigService.deleteBlockAutomation(req.params.id);
    SystemLogService.log({ action: "delete", resource: RESOURCES.ACTIONS_CFG, resourceId: req.params.id, resourceName: deleted.name, description: `Xóa Block Automation "${deleted.name}"`, metadata: { deletedItem: deleted }, req });
    return sendSuccess(res, 200, "Delete block automation success", null);
  }

  // ─── Event Schema Fields (for field mapping) ───
  async getEventSchemaFields(_req, res) {
    const fields = ActionConfigService.getEventSchemaFields();
    return sendSuccess(res, 200, "Get event schema fields success", fields);
  }
}

module.exports = new ActionConfigController();
