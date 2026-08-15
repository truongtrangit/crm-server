const EventGroup = require("./eventGroup.model");
const Event = require("../event/event.model");
const { createHttpError } = require("../../../core/utils/http");
const CacheService = require("../../../core/services/CacheService");
const { CACHE_TTL } = require("../../../core/constants/cache");

class EventGroupService {
  /**
   * Trả về tất cả event groups (cached).
   * Dùng cho dropdown FE, stats, validation.
   */
  async listGroups(queryParams = {}) {
    const { source } = queryParams;
    const cacheKey = source ? `event_groups:${source}` : "event_groups:all";

    return CacheService.withVersionedCache(
      cacheKey,
      {},
      CACHE_TTL.LONG,
      async () => {
        const filter = { isActive: true };
        if (source) filter.source = source;
        return EventGroup.find(filter).sort({ createdAt: 1 }).lean();
      },
      { swr: true, maxTtl: CACHE_TTL.LONG },
    );
  }

  /**
   * Mảng id — dùng cho validation khi tạo Event.
   */
  async getActiveGroupIds() {
    const groups = await this.listGroups();
    return groups.map((g) => g.id);
  }

  /**
   * Trả về danh sách unique sources từ tất cả groups.
   */
  async getSources() {
    return EventGroup.distinct("source", { isActive: true });
  }

  async createGroup(data) {
    // Check duplicate id
    const existing = await EventGroup.findOne({ id: data.id });
    if (existing) {
      throw createHttpError(409, "Event Group ID đã tồn tại.", {
        code: "EVENT_GROUP_DUPLICATE",
      });
    }

    const group = await EventGroup.create({
      id: data.id,
      label: data.label,
      color: data.color || "#3b82f6",
      bg: data.bg || "#eff6ff",
      source: data.source || "",
      isSystem: false,
      isActive: true,
    });

    await CacheService.bumpNamespaceVersion("metadata");
    return group;
  }

  async updateGroup(id, data) {
    const group = await EventGroup.findOne({ id });
    if (!group) {
      throw createHttpError(404, "Không tìm thấy Event Group.", {
        code: "EVENT_GROUP_NOT_FOUND",
      });
    }

    if (data.label !== undefined) group.label = data.label;
    if (data.color !== undefined) group.color = data.color;
    if (data.bg !== undefined) group.bg = data.bg;
    if (data.source !== undefined) group.source = data.source;
    if (data.isActive !== undefined) group.isActive = data.isActive;

    await group.save();
    await CacheService.bumpNamespaceVersion("metadata");
    return group;
  }

  async deleteGroup(id) {
    const group = await EventGroup.findOne({ id });
    if (!group) {
      throw createHttpError(404, "Không tìm thấy Event Group.", {
        code: "EVENT_GROUP_NOT_FOUND",
      });
    }

    if (group.isSystem) {
      throw createHttpError(
        400,
        "Không thể xoá Event Group hệ thống.",
        { code: "EVENT_GROUP_SYSTEM_PROTECTED" },
      );
    }

    // Check nếu có Event đang dùng group này
    const eventCount = await Event.countDocuments({ group: id });
    if (eventCount > 0) {
      throw createHttpError(
        400,
        `Không thể xoá: đang có ${eventCount} event sử dụng group này.`,
        { code: "RESOURCE_IN_USE" },
      );
    }

    await EventGroup.deleteOne({ id });
    await CacheService.bumpNamespaceVersion("metadata");
    return group;
  }
}

module.exports = new EventGroupService();
