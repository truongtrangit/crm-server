const LeadStatus = require('./leadStatus.model');
const LeadStatusGroup = require('./leadStatusGroup.model');
const { generateMonotonicId, ID_PREFIXES } = require('../../../core/utils/id');
const { createHttpError } = require('../../../core/utils/http');
const { isSystemEntity } = require('../../../core/constants/systemFunnel');
const CacheService = require('../../../core/services/CacheService');
const { CACHE_TTL } = require('../../../core/constants/cache');
const { computeChanges } = require('../../../core/utils/diff');

class LeadConfigService {
  async getStatuses() {
    return CacheService.withVersionedCache(
      "lead_configs:statuses",
      {},
      CACHE_TTL.LONG,
      async () => {
        return await LeadStatus.find().sort({ createdAt: 1 }).lean();
      },
      { swr: true, maxTtl: CACHE_TTL.LONG },
    );
  }

  async createStatus(data) {
    const newStatus = new LeadStatus({
      ...data,
      id: await generateMonotonicId(ID_PREFIXES.LEAD_STATUS),
    });
    await newStatus.save();
    await CacheService.bumpNamespaceVersion("metadata");
    return newStatus;
  }

  async updateStatus(id, data) {
    if (isSystemEntity(id))
      throw createHttpError(400, "Không thể sửa trạng thái hệ thống.");
    const status = await LeadStatus.findOne({ id });
    if (!status) {
      throw createHttpError(404, "Không tìm thấy trạng thái");
    }
    const oldState = status.toObject();
    Object.assign(status, data);
    await status.save();
    const newState = status.toObject();
    const changes = computeChanges(oldState, newState);
    await CacheService.bumpNamespaceVersion("metadata");
    return { status, changes };
  }

  async deleteStatus(id) {
    if (isSystemEntity(id))
      throw createHttpError(400, "Không thể xoá trạng thái hệ thống.");

    const usedInGroup = await LeadStatusGroup.findOne({ statusIds: id });
    if (usedInGroup) {
      throw createHttpError(
        400,
        "Không thể xóa trạng thái đang được sử dụng trong nhóm.",
      );
    }

    const deletedStatus = await LeadStatus.findOneAndDelete({ id });
    if (!deletedStatus) {
      throw createHttpError(404, "Không tìm thấy trạng thái");
    }
    await CacheService.bumpNamespaceVersion("metadata");
    return deletedStatus;
  }

  async getGroups() {
    return CacheService.withVersionedCache(
      "lead_configs:groups",
      {},
      CACHE_TTL.LONG,
      async () => {
        return await LeadStatusGroup.find().sort({ createdAt: 1 }).lean();
      },
      { swr: true, maxTtl: CACHE_TTL.LONG },
    );
  }

  async createGroup(data) {
    const newGroup = new LeadStatusGroup({
      ...data,
      id: await generateMonotonicId(ID_PREFIXES.LEAD_STATUS_GROUP),
    });
    await newGroup.save();
    await CacheService.bumpNamespaceVersion("metadata");
    return newGroup;
  }

  async updateGroup(id, data) {
    if (isSystemEntity(id))
      throw createHttpError(400, "Không thể sửa nhóm trạng thái hệ thống.");
    const group = await LeadStatusGroup.findOne({ id });
    if (!group) {
      throw createHttpError(404, "Không tìm thấy nhóm trạng thái");
    }
    const oldState = group.toObject();
    Object.assign(group, data);
    await group.save();
    const newState = group.toObject();
    const changes = computeChanges(oldState, newState);
    await CacheService.bumpNamespaceVersion("metadata");
    return { group, changes };
  }

  async deleteGroup(id) {
    if (isSystemEntity(id))
      throw createHttpError(400, "Không thể xoá nhóm trạng thái hệ thống.");

    const deletedGroup = await LeadStatusGroup.findOneAndDelete({ id });
    if (!deletedGroup) {
      throw createHttpError(404, "Không tìm thấy nhóm trạng thái");
    }
    await CacheService.bumpNamespaceVersion("metadata");
    return deletedGroup;
  }
}

module.exports = new LeadConfigService();
