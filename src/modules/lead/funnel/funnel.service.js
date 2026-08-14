const FunnelFolder = require('./funnelFolder.model');
const FunnelGroup = require('./funnelGroup.model');
const Funnel = require('./funnel.model');
const ActionChain = require('../../event/eventActionChain/actionChain.model');
const { generateMonotonicId, ID_PREFIXES } = require('../../../core/utils/id');
const { createHttpError } = require('../../../core/utils/http');
const { isSystemEntity, SYSTEM_IDS } = require('../../../core/constants/systemFunnel');
const CacheService = require('../../../core/services/CacheService');
const { CACHE_TTL } = require('../../../core/constants/cache');
const { computeChanges } = require('../../../core/utils/diff');

class FunnelService {
  async _validateActionChains(chainIds) {
    if (!chainIds || chainIds.length === 0) return;
    const existing = await ActionChain.find({ id: { $in: chainIds }, active: true }).select('id').lean();
    const existingSet = new Set(existing.map(c => c.id));
    const missing = chainIds.filter(id => !existingSet.has(id));
    if (missing.length > 0) {
      throw createHttpError(400, `Chuỗi hành động "${missing.join(', ')}" không tồn tại hoặc đã bị tắt.`);
    }
  }

  async getFolders() {
    return CacheService.withVersionedCache("funnels:folders", {}, CACHE_TTL.LONG, async () => {
      return await FunnelFolder.find().sort({ createdAt: 1 }).lean();
    }, { swr: true, maxTtl: CACHE_TTL.LONG });
  }

  async createFolder(data) {
    const newFolder = new FunnelFolder({
      ...data,
      id: await generateMonotonicId(ID_PREFIXES.FUNNEL_FOLDER),
    });
    await newFolder.save();
    await CacheService.bumpNamespaceVersion("funnels:folders");
    return newFolder;
  }

  async updateFolder(id, data) {
    if (isSystemEntity(id)) throw createHttpError(400, "Không thể sửa thư mục hệ thống.");
    const folder = await FunnelFolder.findOne({ id });
    if (!folder) throw createHttpError(404, "Không tìm thấy thư mục");
    const oldState = folder.toObject();
    Object.assign(folder, data);
    await folder.save();
    const newState = folder.toObject();
    const changes = computeChanges(oldState, newState);
    await CacheService.bumpNamespaceVersion("funnels:folders");
    return { folder, changes };
  }

  async deleteFolder(id) {
    if (isSystemEntity(id)) throw createHttpError(400, "Không thể xoá thư mục hệ thống.");

    const hasGroups = await FunnelGroup.findOne({ folderId: id });
    if (hasGroups) throw createHttpError(400, "Thư mục đang chứa nhóm phễu.");

    const hasFunnels = await Funnel.findOne({ folderId: id });
    if (hasFunnels) throw createHttpError(400, "Thư mục đang chứa phễu.");

    const deleted = await FunnelFolder.findOneAndDelete({ id });
    if (!deleted) throw createHttpError(404, "Không tìm thấy thư mục");
    await CacheService.bumpNamespaceVersion("funnels:folders");
    return deleted;
  }

  async getGroups() {
    return CacheService.withVersionedCache("funnels:groups", {}, CACHE_TTL.LONG, async () => {
      return await FunnelGroup.find().sort({ createdAt: 1 }).lean();
    }, { swr: true, maxTtl: CACHE_TTL.LONG });
  }

  async createGroup(data) {
    const newGroup = new FunnelGroup({
      ...data,
      id: await generateMonotonicId(ID_PREFIXES.FUNNEL_GROUP),
    });
    await newGroup.save();
    await CacheService.bumpNamespaceVersion("funnels:groups");
    return newGroup;
  }

  async updateGroup(id, data) {
    if (isSystemEntity(id)) throw createHttpError(400, "Không thể sửa nhóm phễu hệ thống.");
    const group = await FunnelGroup.findOne({ id });
    if (!group) throw createHttpError(404, "Không tìm thấy nhóm phễu");
    const oldState = group.toObject();
    Object.assign(group, data);
    await group.save();
    const newState = group.toObject();
    const changes = computeChanges(oldState, newState);
    await CacheService.bumpNamespaceVersion("funnels:groups");
    return { group, changes };
  }

  async deleteGroup(id) {
    if (isSystemEntity(id)) throw createHttpError(400, "Không thể xoá nhóm phễu hệ thống.");

    const hasFunnels = await Funnel.findOne({ groupId: id });
    if (hasFunnels) throw createHttpError(400, "Nhóm phễu đang chứa phễu.");

    const deleted = await FunnelGroup.findOneAndDelete({ id });
    if (!deleted) throw createHttpError(404, "Không tìm thấy nhóm phễu");
    await CacheService.bumpNamespaceVersion("funnels:groups");
    return deleted;
  }

  async getFunnels() {
    return CacheService.withVersionedCache("funnels:funnels", {}, CACHE_TTL.LONG, async () => {
      return await Funnel.find().sort({ createdAt: 1 }).lean();
    }, { swr: true, maxTtl: CACHE_TTL.LONG });
  }

  async _prepareFunnelPayload(data) {
    const cleaned = { ...data };
    if (!cleaned.groupId || cleaned.groupId === "") cleaned.groupId = null;
    if (!cleaned.folderId || cleaned.folderId === "") cleaned.folderId = null;

    if (cleaned.groupId && cleaned.folderId) {
      throw createHttpError(400, "Phễu không thể vừa thuộc thư mục vừa thuộc nhóm phễu.");
    }
    if (!cleaned.groupId && !cleaned.folderId) {
      throw createHttpError(400, "Phễu phải thuộc thư mục hoặc nhóm phễu.");
    }

    // Chuẩn hóa Action Chains
    const rawChainIds = cleaned.autoCreateChain && Array.isArray(cleaned.actionChainIds)
      ? cleaned.actionChainIds
      : [];

    cleaned.actionChainIds = [...new Set(rawChainIds.filter(Boolean))];

    if (cleaned.actionChainIds.length > 0) {
      await this._validateActionChains(cleaned.actionChainIds);
    }

    return cleaned;
  }

  async createFunnel(data) {
    const cleaned = await this._prepareFunnelPayload(data);

    const newFunnel = new Funnel({
      ...cleaned,
      id: await generateMonotonicId(ID_PREFIXES.FUNNEL),
    });
    await newFunnel.save();
    await CacheService.bumpNamespaceVersion("funnels:funnels");
    return newFunnel;
  }

  async updateFunnel(id, data) {
    if (isSystemEntity(id)) throw createHttpError(400, "Không thể sửa phễu hệ thống.");

    const cleaned = await this._prepareFunnelPayload(data);

    const funnel = await Funnel.findOne({ id });
    if (!funnel) throw createHttpError(404, "Không tìm thấy phễu");
    const oldState = funnel.toObject();
    Object.assign(funnel, cleaned);
    await funnel.save();
    const newState = funnel.toObject();
    const changes = computeChanges(oldState, newState);
    await CacheService.bumpNamespaceVersion("funnels:funnels");
    return { funnel, changes };
  }

  async deleteFunnel(id) {
    if (isSystemEntity(id)) throw createHttpError(400, "Không thể xoá phễu hệ thống.");

    const deleted = await Funnel.findOneAndDelete({ id });
    if (!deleted) throw createHttpError(404, "Không tìm thấy phễu");
    await CacheService.bumpNamespaceVersion("funnels:funnels");
    return deleted;
  }
}

module.exports = new FunnelService();
