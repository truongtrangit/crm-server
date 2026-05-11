const FunnelFolder = require("../models/FunnelFolder");
const FunnelGroup = require("../models/FunnelGroup");
const Funnel = require("../models/Funnel");
const { generateMonotonicId, ID_PREFIXES } = require("../utils/id");
const { createHttpError } = require("../utils/http");
const { isSystemEntity, SYSTEM_IDS } = require("../constants/systemFunnel");
const CacheService = require("./CacheService");
const { CACHE_TTL } = require("../constants/cache");

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
    const updated = await FunnelFolder.findOneAndUpdate({ id }, data, { new: true });
    if (!updated) throw createHttpError(404, "Không tìm thấy thư mục");
    await CacheService.bumpNamespaceVersion("funnels:folders");
    return updated;
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
    if (data.folderId === SYSTEM_IDS.FOLDER) {
      throw createHttpError(400, "Không thể thêm nhóm phễu vào thư mục hệ thống.");
    }
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
    const updated = await FunnelGroup.findOneAndUpdate({ id }, data, { new: true });
    if (!updated) throw createHttpError(404, "Không tìm thấy nhóm phễu");
    await CacheService.bumpNamespaceVersion("funnels:groups");
    return updated;
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
    if (data.groupId === SYSTEM_IDS.GROUP) {
      throw createHttpError(400, "Không thể thêm phễu vào nhóm phễu hệ thống.");
    }
    const newFunnel = new Funnel({
      ...data,
      id: await generateMonotonicId(ID_PREFIXES.FUNNEL),
    });
    await newFunnel.save();
    await CacheService.bumpNamespaceVersion("funnels:funnels");
    return newFunnel;
  }

  async updateFunnel(id, data) {
    if (isSystemEntity(id)) throw createHttpError(400, "Không thể sửa phễu hệ thống.");
    const updated = await Funnel.findOneAndUpdate({ id }, data, { new: true });
    if (!updated) throw createHttpError(404, "Không tìm thấy phễu");
    await CacheService.bumpNamespaceVersion("funnels:funnels");
    return updated;
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
