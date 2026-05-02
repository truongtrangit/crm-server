const Result = require("../models/Result");
const Reason = require("../models/Reason");
const Action = require("../models/Action");
const ActionChain = require("../models/ActionChain");
const EventActionChain = require("../models/EventActionChain");
const BlockAutomation = require("../models/BlockAutomation");
const Event = require("../models/Event");
const { generateMonotonicId } = require("../utils/id");
const { buildSearchRegex } = require("../utils/query");
const { resolvePagination, buildPaginatedResponse } = require("../utils/pagination");
const { createHttpError } = require("../utils/http");
const { computeChanges } = require("../utils/diff");

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

    return buildPaginatedResponse(items, totalItems, page, limit);
  }

  async createResult(body) {
    const id = await generateMonotonicId("RES");
    return Result.create({ ...body, id });
  }

  async updateResult(id, body) {
    const oldItem = await Result.findOne({ id }).lean();
    if (!oldItem) throw createHttpError(404, "Result not found", { code: "RESULT_NOT_FOUND" });
    const item = await Result.findOneAndUpdate({ id }, body, { returnDocument: "after" });
    const changes = computeChanges(oldItem, item, Object.keys(body));
    return { result: item, changes };
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
    return deleted;
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

    return buildPaginatedResponse(items, totalItems, page, limit);
  }

  async createReason(body) {
    const id = await generateMonotonicId("RSN");
    return Reason.create({ ...body, id });
  }

  async updateReason(id, body) {
    const oldItem = await Reason.findOne({ id }).lean();
    if (!oldItem) throw createHttpError(404, "Reason not found", { code: "REASON_NOT_FOUND" });
    const item = await Reason.findOneAndUpdate({ id }, body, { returnDocument: "after" });
    const changes = computeChanges(oldItem, item, Object.keys(body));
    return { reason: item, changes };
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
    return deleted;
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

    return buildPaginatedResponse(items, totalItems, page, limit);
  }

  async createAction(body) {
    const id = await generateMonotonicId("ACT");
    return Action.create({ ...body, id });
  }

  async updateAction(id, body) {
    const oldItem = await Action.findOne({ id }).lean();
    if (!oldItem) throw createHttpError(404, "Action not found", { code: "ACTION_NOT_FOUND" });
    const item = await Action.findOneAndUpdate({ id }, body, { returnDocument: "after" });
    const changes = computeChanges(oldItem, item, Object.keys(body));
    return { action: item, changes };
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
    return deleted;
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

    return buildPaginatedResponse(items, totalItems, page, limit);
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
    const oldItem = await ActionChain.findOne({ id }).lean();
    if (!oldItem) throw createHttpError(404, "ActionChain not found", { code: "CHAIN_NOT_FOUND" });
    const item = await ActionChain.findOneAndUpdate({ id }, body, { returnDocument: "after" });
    const changes = computeChanges(oldItem, item, Object.keys(body));
    return { actionChain: item, changes };
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
    return deleted;
  }

  /**
   * Save rule configuration for a chain:
   * Updates steps (with branches) in-place.
   * Preserves name, description, delay.
   */
  async saveChainRule(id, { steps }) {
    const chain = await ActionChain.findOne({ id });
    if (!chain) throw createHttpError(404, "ActionChain not found", { code: "CHAIN_NOT_FOUND" });
    const oldItem = chain.toObject();
    chain.steps = steps;
    await chain.save();
    const changes = computeChanges(oldItem, chain, ['steps']);
    return { actionChain: chain, changes };
  }

  // ─── Block Automation CRUD ───

  async listBlockAutomations(queryParams) {
    const { search = "" } = queryParams;
    const searchRegex = buildSearchRegex(search);
    const { page, limit, skip } = resolvePagination(queryParams);
    const query = {};

    if (searchRegex) {
      query.$or = [{ name: searchRegex }, { id: searchRegex }, { url: searchRegex }];
    }

    const [items, totalItems] = await Promise.all([
      BlockAutomation.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      BlockAutomation.countDocuments(query),
    ]);

    return buildPaginatedResponse(items, totalItems, page, limit);
  }

  async getBlockAutomation(id) {
    const item = await BlockAutomation.findOne({ id }).lean();
    if (!item) throw createHttpError(404, "Block automation not found", { code: "BLOCK_AUTOMATION_NOT_FOUND" });
    return item;
  }

  async createBlockAutomation(body) {
    const id = await generateMonotonicId("BLK");
    return BlockAutomation.create({ ...body, id });
  }

  async updateBlockAutomation(id, body) {
    const oldItem = await BlockAutomation.findOne({ id }).lean();
    if (!oldItem) throw createHttpError(404, "Block automation not found", { code: "BLOCK_AUTOMATION_NOT_FOUND" });
    const item = await BlockAutomation.findOneAndUpdate({ id }, body, { returnDocument: "after" });
    const changes = computeChanges(oldItem, item, Object.keys(body));
    return { blockAutomation: item, changes };
  }

  async deleteBlockAutomation(id) {
    const deleted = await BlockAutomation.findOneAndDelete({ id });
    if (!deleted) throw createHttpError(404, "Block automation not found", { code: "BLOCK_AUTOMATION_NOT_FOUND" });
    return deleted;
  }

  /**
   * Introspect the Event Mongoose schema and return a flat list of field paths.
   * This helps the frontend render a picker so users can map Event fields
   * to third-party payload fields.
   */
  getEventSchemaFields() {
    const paths = Event.schema.paths;
    const fields = [];

    for (const [path, schemaType] of Object.entries(paths)) {
      // Skip internal Mongoose/Mongo fields
      if (["_id", "__v", "deleted", "deletedAt"].includes(path)) continue;

      // Skip the `timeline` embedded subdocument array (too complex for mapping)
      if (path.startsWith("timeline")) continue;

      let type = schemaType.instance; // String, Number, Boolean, Array, ...

      // For arrays, try to get the caster type
      if (type === "Array" && schemaType.caster) {
        type = `Array<${schemaType.caster.instance || "Mixed"}>`;
      }

      fields.push({
        path,
        type,
        required: !!schemaType.isRequired,
      });
    }

    return fields;
  }
}

module.exports = new ActionConfigService();

