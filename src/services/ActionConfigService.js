const Result = require("../models/Result");
const Reason = require("../models/Reason");
const Action = require("../models/Action");
const ActionChain = require("../models/ActionChain");
const EventActionChain = require("../models/EventActionChain");
const { generateMonotonicId } = require("../utils/id");
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
    const id = await generateMonotonicId("RES");
    return Result.create({ ...body, id });
  }

  async updateResult(id, body) {
    const item = await Result.findOneAndUpdate({ id }, body, { returnDocument: "after" });
    if (!item) throw createHttpError(404, "Result not found", { code: "RESULT_NOT_FOUND" });
    return item;
  }

  async deleteResult(id, { force = false } = {}) {
    if (!force) {
      const usedInChains = await ActionChain.find({ "steps.branches.resultId": id }, { id: 1, name: 1 }).lean();
      if (usedInChains.length > 0) {
        throw createHttpError(409, `Kết quả đang được sử dụng trong ${usedInChains.length} chuỗi hành động`, {
          code: "RESOURCE_IN_USE",
          references: usedInChains.map(c => ({ type: "ActionChain", id: c.id, name: c.name })),
        });
      }
    } else {
      // Force delete: remove branches referencing this result from ActionChain steps
      await ActionChain.updateMany(
        { "steps.branches.resultId": id },
        { $pull: { "steps.$[].branches": { resultId: id } } },
      );
    }
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
    const id = await generateMonotonicId("RSN");
    return Reason.create({ ...body, id });
  }

  async updateReason(id, body) {
    const item = await Reason.findOneAndUpdate({ id }, body, { returnDocument: "after" });
    if (!item) throw createHttpError(404, "Reason not found", { code: "REASON_NOT_FOUND" });
    return item;
  }

  async deleteReason(id, { force = false } = {}) {
    if (!force) {
      const usedInActions = await Action.find({ reasonIds: id }, { id: 1, name: 1 }).lean();
      if (usedInActions.length > 0) {
        throw createHttpError(409, `Nguyên nhân đang được sử dụng trong ${usedInActions.length} hành động`, {
          code: "RESOURCE_IN_USE",
          references: usedInActions.map(a => ({ type: "Action", id: a.id, name: a.name })),
        });
      }
    } else {
      // Force delete: remove this reason from Action.reasonIds
      await Action.updateMany(
        { reasonIds: id },
        { $pull: { reasonIds: id } },
      );
    }
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
    const id = await generateMonotonicId("ACT");
    return Action.create({ ...body, id });
  }

  async updateAction(id, body) {
    const item = await Action.findOneAndUpdate({ id }, body, { returnDocument: "after" });
    if (!item) throw createHttpError(404, "Action not found", { code: "ACTION_NOT_FOUND" });
    return item;
  }

  async deleteAction(id, { force = false } = {}) {
    if (!force) {
      const usedInChains = await ActionChain.find({
        $or: [
          { "steps.actionId": id },
          { "steps.branches.nextActionId": id },
        ],
      }, { id: 1, name: 1 }).lean();
      if (usedInChains.length > 0) {
        throw createHttpError(409, `Hành động đang được sử dụng trong ${usedInChains.length} chuỗi hành động`, {
          code: "RESOURCE_IN_USE",
          references: usedInChains.map(c => ({ type: "ActionChain", id: c.id, name: c.name })),
        });
      }
    } else {
      // Force delete: remove steps using this action, nullify nextActionId in branches
      await ActionChain.updateMany(
        { "steps.actionId": id },
        { $pull: { steps: { actionId: id } } },
      );
      await ActionChain.updateMany(
        { "steps.branches.nextActionId": id },
        { $set: { "steps.$[].branches.$[br].nextActionId": null } },
        { arrayFilters: [{ "br.nextActionId": id }] },
      );
    }
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
    const id = await generateMonotonicId("CHN");
    return ActionChain.create({ ...body, id });
  }

  async updateActionChain(id, body) {
    const item = await ActionChain.findOneAndUpdate({ id }, body, { returnDocument: "after" });
    if (!item) throw createHttpError(404, "ActionChain not found", { code: "CHAIN_NOT_FOUND" });
    return item;
  }

  async deleteActionChain(id, { force = false } = {}) {
    if (!force) {
      const usedInEvents = await EventActionChain.find({ chainId: id }, { eventId: 1 }).lean();
      if (usedInEvents.length > 0) {
        throw createHttpError(409, `Chuỗi hành động đang được sử dụng trong ${usedInEvents.length} sự kiện`, {
          code: "RESOURCE_IN_USE",
          references: usedInEvents.map(e => ({ type: "Event", id: e.eventId, name: `Sự kiện ${e.eventId}` })),
        });
      }
    } else {
      // Force delete: remove EventActionChains referencing this chain
      await EventActionChain.deleteMany({ chainId: id });
    }
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

