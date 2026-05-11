const StaffFunction = require("../models/StaffFunction");
const { generateMonotonicId, ID_PREFIXES } = require("../utils/id");
const { buildPaginatedResponse, resolvePagination } = require("../utils/pagination");
const CacheService = require("./CacheService");
const { CACHE_TTL } = require("../constants/cache");

class FunctionService {
  async getFunctions(query) {
    const { page, limit, skip } = resolvePagination(query || {});
    
    return CacheService.withVersionedCache("functions", query || {}, CACHE_TTL.LONG, async () => {
      const [items, totalItems] = await Promise.all([
        StaffFunction.find()
          .sort({ createdAt: 1, id: 1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        StaffFunction.countDocuments(),
      ]);
      return buildPaginatedResponse(items, totalItems, page, limit);
    }, { swr: true, maxTtl: CACHE_TTL.LONG });
  }

  async createFunction(data) {
    const { title, desc = "", type = "tech" } = data || {};

    const item = await StaffFunction.create({
      id: await generateMonotonicId(ID_PREFIXES.FUNCTION),
      title,
      desc,
      type,
    });

    await CacheService.bumpNamespaceVersion("functions");
    return item;
  }
}

module.exports = new FunctionService();
