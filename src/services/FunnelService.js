const FunnelFolder = require("../models/FunnelFolder");
const FunnelGroup = require("../models/FunnelGroup");
const Funnel = require("../models/Funnel");
const { generateMonotonicId, ID_PREFIXES } = require("../utils/id");
const { createHttpError } = require("../utils/http");
const { isSystemEntity, SYSTEM_IDS } = require("../constants/systemFunnel");
const CacheService = require("./CacheService");
const { CACHE_TTL } = require("../constants/cache");
const { computeChanges } = require("../utils/diff");

class FunnelService {
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

  async createFunnel(data) {
    const cleaned = { ...data };
    if (!cleaned.groupId || cleaned.groupId === "") cleaned.groupId = null;
    if (!cleaned.folderId || cleaned.folderId === "") cleaned.folderId = null;

    if (cleaned.groupId && cleaned.folderId) {
      throw createHttpError(400, "Phễu không thể vừa thuộc thư mục vừa thuộc nhóm phễu.");
    }
    if (!cleaned.groupId && !cleaned.folderId) {
      throw createHttpError(400, "Phễu phải thuộc thư mục hoặc nhóm phễu.");
    }

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

    const cleaned = { ...data };
    if (!cleaned.groupId || cleaned.groupId === "") cleaned.groupId = null;
    if (!cleaned.folderId || cleaned.folderId === "") cleaned.folderId = null;

    if (cleaned.groupId && cleaned.folderId) {
      throw createHttpError(400, "Phễu không thể vừa thuộc thư mục vừa thuộc nhóm phễu.");
    }
    if (!cleaned.groupId && !cleaned.folderId) {
      throw createHttpError(400, "Phễu phải thuộc thư mục hoặc nhóm phễu.");
    }

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
