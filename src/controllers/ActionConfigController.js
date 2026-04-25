const ActionConfigService = require("../services/ActionConfigService");
const { sendSuccess } = require("../utils/http");

class ActionConfigController {
  // ─── Results ───
  async listResults(req, res) {
    const result = await ActionConfigService.listResults(req.query);
    return sendSuccess(res, 200, "Get results success", result);
  }

  async createResult(req, res) {
    const item = await ActionConfigService.createResult(req.body);
    return sendSuccess(res, 201, "Create result success", item);
  }

  async updateResult(req, res) {
    const item = await ActionConfigService.updateResult(req.params.id, req.body);
    return sendSuccess(res, 200, "Update result success", item);
  }

  async deleteResult(req, res) {
    const force = req.query.force === 'true';
    await ActionConfigService.deleteResult(req.params.id, { force });
    return sendSuccess(res, 200, "Delete result success", null);
  }

  // ─── Reasons ───
  async listReasons(req, res) {
    const result = await ActionConfigService.listReasons(req.query);
    return sendSuccess(res, 200, "Get reasons success", result);
  }

  async createReason(req, res) {
    const item = await ActionConfigService.createReason(req.body);
    return sendSuccess(res, 201, "Create reason success", item);
  }

  async updateReason(req, res) {
    const item = await ActionConfigService.updateReason(req.params.id, req.body);
    return sendSuccess(res, 200, "Update reason success", item);
  }

  async deleteReason(req, res) {
    const force = req.query.force === 'true';
    await ActionConfigService.deleteReason(req.params.id, { force });
    return sendSuccess(res, 200, "Delete reason success", null);
  }

  // ─── Actions ───
  async listActions(req, res) {
    const result = await ActionConfigService.listActions(req.query);
    return sendSuccess(res, 200, "Get actions success", result);
  }

  async createAction(req, res) {
    const item = await ActionConfigService.createAction(req.body);
    return sendSuccess(res, 201, "Create action success", item);
  }

  async updateAction(req, res) {
    const item = await ActionConfigService.updateAction(req.params.id, req.body);
    return sendSuccess(res, 200, "Update action success", item);
  }

  async deleteAction(req, res) {
    const force = req.query.force === 'true';
    await ActionConfigService.deleteAction(req.params.id, { force });
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
    return sendSuccess(res, 201, "Create action chain success", item);
  }

  async updateActionChain(req, res) {
    const item = await ActionConfigService.updateActionChain(req.params.id, req.body);
    return sendSuccess(res, 200, "Update action chain success", item);
  }

  async deleteActionChain(req, res) {
    const force = req.query.force === 'true';
    await ActionConfigService.deleteActionChain(req.params.id, { force });
    return sendSuccess(res, 200, "Delete action chain success", null);
  }

  /**
   * PUT /chains/:id/rule — Save rule configuration (steps + branches) for a chain.
   */
  async saveChainRule(req, res) {
    const chain = await ActionConfigService.saveChainRule(req.params.id, req.body);
    return sendSuccess(res, 200, "Save chain rule success", chain);
  }
}

module.exports = new ActionConfigController();
