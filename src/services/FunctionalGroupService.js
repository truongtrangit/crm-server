const FunctionalGroup = require("../models/FunctionalGroup");
const { generateMonotonicId, ID_PREFIXES } = require("../utils/id");
const { buildPaginatedResponse, resolvePagination } = require("../utils/pagination");
const CacheService = require("./CacheService");
const { CACHE_TTL } = require("../constants/cache");
const { createHttpError } = require("../utils/http");

class FunctionalGroupService {
  async getGroups(query) {
    const { page, limit, skip } = resolvePagination(query || {});
    const filter = {};

    if (query.search) {
      filter.name = { $regex: query.search, $options: "i" };
    }

    if (query.isActive !== undefined) {
      filter.isActive = query.isActive === 'true';
    }

    return CacheService.withVersionedCache("functional_groups", query || {}, CACHE_TTL.LONG, async () => {
      const [items, totalItems] = await Promise.all([
        FunctionalGroup.find(filter)
          .sort({ createdAt: -1, id: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        FunctionalGroup.countDocuments(filter),
      ]);
      return buildPaginatedResponse(items, totalItems, page, limit);
    }, { swr: true, maxTtl: CACHE_TTL.LONG });
  }

  async createGroup(data) {
    const { name, desc = "", isActive = true } = data || {};

    const item = await FunctionalGroup.create({
      id: await generateMonotonicId(ID_PREFIXES.FUNCTIONAL_GROUP),
      name,
      desc,
      isActive,
    });

    await CacheService.bumpNamespaceVersion("functional_groups");
    return item;
  }

  async updateGroup(id, data) {
    const { name, desc, isActive } = data || {};

    const item = await FunctionalGroup.findOne({ id });
    if (!item) {
      throw createHttpError(404, "Không tìm thấy khối chức năng", { code: "NOT_FOUND" });
    }

    if (name !== undefined) item.name = name;
    if (desc !== undefined) item.desc = desc;
    if (isActive !== undefined) item.isActive = isActive;

    await item.save();

    await CacheService.bumpNamespaceVersion("functional_groups");
    return item;
  }

  async deleteGroup(id) {
    const item = await FunctionalGroup.findOne({ id });
    if (!item) {
      throw createHttpError(404, "Không tìm thấy khối chức năng", { code: "NOT_FOUND" });
    }

    await item.deleteOne();
    await CacheService.bumpNamespaceVersion("functional_groups");
    return item;
  }
}

module.exports = new FunctionalGroupService();
