const Result = require("../models/Result");
const Reason = require("../models/Reason");
const Action = require("../models/Action");
const ActionChain = require("../models/ActionChain");
const { generateSequentialId } = require("../utils/id");
const { buildSearchRegex } = require("../utils/query");
const { resolvePagination } = require("../utils/pagination");
const { createHttpError } = require("../utils/http");

class ActionConfigService {
  // ─── Result CRUD ───

  async listResults(queryParams) {
    const { search = "" } = queryParams;
    const searchRegex = buildSearchRegex(search);
    const { page, limit, skip } = resolvePagination(queryParams);
    const query = {};

    if (searchRegex) {
      query.$or = [{ name: searchRegex }, { id: searchRegex }];
    }

    const [items, totalItems] = await Promise.all([
      Result.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Result.countDocuments(query),
    ]);

    return { items, totalItems, page, limit };
  }

  async createResult(body) {
    const id = await generateSequentialId(Result, "RES");
    return Result.create({ ...body, id });
  }

  async updateResult(id, body) {
    const item = await Result.findOneAndUpdate({ id }, body, { new: true });
    if (!item) throw createHttpError(404, "Result not found", { code: "RESULT_NOT_FOUND" });
    return item;
  }

  async deleteResult(id) {
    const deleted = await Result.findOneAndDelete({ id });
    if (!deleted) throw createHttpError(404, "Result not found", { code: "RESULT_NOT_FOUND" });
  }

  // ─── Reason CRUD ───

  async listReasons(queryParams) {
    const { search = "" } = queryParams;
    const searchRegex = buildSearchRegex(search);
    const { page, limit, skip } = resolvePagination(queryParams);
    const query = {};

    if (searchRegex) {
      query.$or = [{ name: searchRegex }, { id: searchRegex }];
    }

    const [items, totalItems] = await Promise.all([
      Reason.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Reason.countDocuments(query),
    ]);

    return { items, totalItems, page, limit };
  }

  async createReason(body) {
    const id = await generateSequentialId(Reason, "RSN");
    return Reason.create({ ...body, id });
  }

  async updateReason(id, body) {
    const item = await Reason.findOneAndUpdate({ id }, body, { new: true });
    if (!item) throw createHttpError(404, "Reason not found", { code: "REASON_NOT_FOUND" });
    return item;
  }

  async deleteReason(id) {
    const deleted = await Reason.findOneAndDelete({ id });
    if (!deleted) throw createHttpError(404, "Reason not found", { code: "REASON_NOT_FOUND" });
  }

  // ─── Action CRUD ───

  async listActions(queryParams) {
    const { search = "" } = queryParams;
    const searchRegex = buildSearchRegex(search);
    const { page, limit, skip } = resolvePagination(queryParams);
    const query = {};

    if (searchRegex) {
      query.$or = [{ name: searchRegex }, { id: searchRegex }];
    }

    const [items, totalItems] = await Promise.all([
      Action.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Action.countDocuments(query),
    ]);

    return { items, totalItems, page, limit };
  }

  async createAction(body) {
    const id = await generateSequentialId(Action, "ACT");
    return Action.create({ ...body, id });
  }

  async updateAction(id, body) {
    const item = await Action.findOneAndUpdate({ id }, body, { new: true });
    if (!item) throw createHttpError(404, "Action not found", { code: "ACTION_NOT_FOUND" });
    return item;
  }

  async deleteAction(id) {
    const deleted = await Action.findOneAndDelete({ id });
    if (!deleted) throw createHttpError(404, "Action not found", { code: "ACTION_NOT_FOUND" });
  }

  // ─── ActionChain CRUD ───

  async listActionChains(queryParams) {
    const { search = "" } = queryParams;
    const searchRegex = buildSearchRegex(search);
    const { page, limit, skip } = resolvePagination(queryParams);
    const query = {};

    if (searchRegex) {
      query.$or = [{ name: searchRegex }, { id: searchRegex }];
    }

    const [items, totalItems] = await Promise.all([
      ActionChain.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ActionChain.countDocuments(query),
    ]);

    return { items, totalItems, page, limit };
  }

  async getActionChain(id) {
    const item = await ActionChain.findOne({ id }).lean();
    if (!item) throw createHttpError(404, "ActionChain not found", { code: "CHAIN_NOT_FOUND" });
    return item;
  }

  async createActionChain(body) {
    const id = await generateSequentialId(ActionChain, "CHN");
    return ActionChain.create({ ...body, id });
  }

  async updateActionChain(id, body) {
    const item = await ActionChain.findOneAndUpdate({ id }, body, { new: true });
    if (!item) throw createHttpError(404, "ActionChain not found", { code: "CHAIN_NOT_FOUND" });
    return item;
  }

  async deleteActionChain(id) {
    const deleted = await ActionChain.findOneAndDelete({ id });
    if (!deleted) throw createHttpError(404, "ActionChain not found", { code: "CHAIN_NOT_FOUND" });
  }

  /**
   * Save rule configuration for a chain:
   * Updates steps (with branches) in-place.
   * Preserves name, description, delay.
   */
  async saveChainRule(id, { steps }) {
    const chain = await ActionChain.findOne({ id });
    if (!chain) throw createHttpError(404, "ActionChain not found", { code: "CHAIN_NOT_FOUND" });
    chain.steps = steps;
    await chain.save();
    return chain;
  }
}

module.exports = new ActionConfigService();

