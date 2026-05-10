const LeadStatus = require("../models/LeadStatus");
const LeadStatusGroup = require("../models/LeadStatusGroup");
const { generateMonotonicId, ID_PREFIXES } = require("../utils/id");
const { createHttpError } = require("../utils/http");
const { isSystemEntity } = require("../constants/systemFunnel");

class LeadConfigService {
  async getStatuses() {
    return await LeadStatus.find().sort({ createdAt: 1 });
  }

  async createStatus(data) {
    const newStatus = new LeadStatus({
      ...data,
      id: await generateMonotonicId(ID_PREFIXES.LEAD_STATUS),
    });
    await newStatus.save();
    return newStatus;
  }

  async updateStatus(id, data) {
    if (isSystemEntity(id)) throw createHttpError(400, "Không thể sửa trạng thái hệ thống.");
    const updatedStatus = await LeadStatus.findOneAndUpdate({ id }, data, { new: true });
    if (!updatedStatus) {
      throw createHttpError(404, "Không tìm thấy trạng thái");
    }
    return updatedStatus;
  }

  async deleteStatus(id) {
    if (isSystemEntity(id)) throw createHttpError(400, "Không thể xoá trạng thái hệ thống.");

    const usedInGroup = await LeadStatusGroup.findOne({ statusIds: id });
    if (usedInGroup) {
      throw createHttpError(400, "Không thể xóa trạng thái đang được sử dụng trong nhóm.");
    }

    const deletedStatus = await LeadStatus.findOneAndDelete({ id });
    if (!deletedStatus) {
      throw createHttpError(404, "Không tìm thấy trạng thái");
    }
    return deletedStatus;
  }

  async getGroups() {
    return await LeadStatusGroup.find().sort({ createdAt: 1 });
  }

  async createGroup(data) {
    const newGroup = new LeadStatusGroup({
      ...data,
      id: await generateMonotonicId(ID_PREFIXES.LEAD_STATUS_GROUP),
    });
    await newGroup.save();
    return newGroup;
  }

  async updateGroup(id, data) {
    if (isSystemEntity(id)) throw createHttpError(400, "Không thể sửa nhóm trạng thái hệ thống.");
    const updatedGroup = await LeadStatusGroup.findOneAndUpdate({ id }, data, { new: true });
    if (!updatedGroup) {
      throw createHttpError(404, "Không tìm thấy nhóm trạng thái");
    }
    return updatedGroup;
  }

  async deleteGroup(id) {
    if (isSystemEntity(id)) throw createHttpError(400, "Không thể xoá nhóm trạng thái hệ thống.");

    const deletedGroup = await LeadStatusGroup.findOneAndDelete({ id });
    if (!deletedGroup) {
      throw createHttpError(404, "Không tìm thấy nhóm trạng thái");
    }
    return deletedGroup;
  }
}

module.exports = new LeadConfigService();
