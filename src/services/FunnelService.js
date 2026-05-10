const FunnelFolder = require("../models/FunnelFolder");
const FunnelGroup = require("../models/FunnelGroup");
const Funnel = require("../models/Funnel");
const { generateMonotonicId, ID_PREFIXES } = require("../utils/id");
const { createHttpError } = require("../utils/http");

class FunnelService {
  async getFolders() {
    return await FunnelFolder.find().sort({ createdAt: 1 });
  }

  async createFolder(data) {
    const newFolder = new FunnelFolder({
      ...data,
      id: await generateMonotonicId(ID_PREFIXES.FUNNEL_FOLDER),
    });
    await newFolder.save();
    return newFolder;
  }

  async updateFolder(id, data) {
    const updated = await FunnelFolder.findOneAndUpdate({ id }, data, { new: true });
    if (!updated) throw createHttpError(404, "Không tìm thấy thư mục");
    return updated;
  }

  async deleteFolder(id) {
    const hasGroups = await FunnelGroup.findOne({ folderId: id });
    if (hasGroups) throw createHttpError(400, "Thư mục đang chứa nhóm phễu.");

    const hasFunnels = await Funnel.findOne({ folderId: id });
    if (hasFunnels) throw createHttpError(400, "Thư mục đang chứa phễu.");

    const deleted = await FunnelFolder.findOneAndDelete({ id });
    if (!deleted) throw createHttpError(404, "Không tìm thấy thư mục");
    return deleted;
  }

  async getGroups() {
    return await FunnelGroup.find().sort({ createdAt: 1 });
  }

  async createGroup(data) {
    const newGroup = new FunnelGroup({
      ...data,
      id: await generateMonotonicId(ID_PREFIXES.FUNNEL_GROUP),
    });
    await newGroup.save();
    return newGroup;
  }

  async updateGroup(id, data) {
    const updated = await FunnelGroup.findOneAndUpdate({ id }, data, { new: true });
    if (!updated) throw createHttpError(404, "Không tìm thấy nhóm phễu");
    return updated;
  }

  async deleteGroup(id) {
    const hasFunnels = await Funnel.findOne({ groupId: id });
    if (hasFunnels) throw createHttpError(400, "Nhóm phễu đang chứa phễu.");

    const deleted = await FunnelGroup.findOneAndDelete({ id });
    if (!deleted) throw createHttpError(404, "Không tìm thấy nhóm phễu");
    return deleted;
  }

  async getFunnels() {
    return await Funnel.find().sort({ createdAt: 1 });
  }

  async createFunnel(data) {
    const newFunnel = new Funnel({
      ...data,
      id: await generateMonotonicId(ID_PREFIXES.FUNNEL),
    });
    await newFunnel.save();
    return newFunnel;
  }

  async updateFunnel(id, data) {
    const updated = await Funnel.findOneAndUpdate({ id }, data, { new: true });
    if (!updated) throw createHttpError(404, "Không tìm thấy phễu");
    return updated;
  }

  async deleteFunnel(id) {
    const deleted = await Funnel.findOneAndDelete({ id });
    if (!deleted) throw createHttpError(404, "Không tìm thấy phễu");
    return deleted;
  }
}

module.exports = new FunnelService();
