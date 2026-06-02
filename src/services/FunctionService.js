const StaffFunction = require("../models/StaffFunction");
const { generateMonotonicId, ID_PREFIXES } = require("../utils/id");
const { buildPaginatedResponse, resolvePagination } = require("../utils/pagination");
const CacheService = require("./CacheService");
const User = require("../models/User");
const { createHttpError } = require("../utils/http");
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
    const { title, desc = "", type = "tech", icon = "Zap", color = "#3b82f6" } = data || {};

    const item = await StaffFunction.create({
      id: await generateMonotonicId(ID_PREFIXES.FUNCTION),
      title,
      desc,
      type,
      icon,
      color,
    });

    await CacheService.bumpNamespaceVersion("metadata");
    return item;
  }

  async updateFunction(id, data) {
    const item = await StaffFunction.findOne({ id });
    if (!item) {
      throw createHttpError(404, "Function not found");
    }

    if (data.title !== undefined) item.title = data.title;
    if (data.desc !== undefined) item.desc = data.desc;
    if (data.type !== undefined) item.type = data.type;
    if (data.icon !== undefined) item.icon = data.icon;
    if (data.color !== undefined) item.color = data.color;

    await item.save();
    await CacheService.bumpNamespaceVersion("metadata");
    return item;
  }

  async deleteFunction(id) {
    const item = await StaffFunction.findOne({ id });
    if (!item) {
      throw createHttpError(404, "Function not found");
    }

    // Checking if in use by users
    const userCount = await User.countDocuments({ functions: id });
    if (userCount > 0) {
      throw createHttpError(409, "RESOURCE_IN_USE", [
        { field: "functions", message: `Vai trò này đang được gán cho ${userCount} nhân sự, không thể xóa.` }
      ]);
    }

    await StaffFunction.deleteOne({ id });
    await CacheService.bumpNamespaceVersion("metadata");
  }
}

module.exports = new FunctionService();
