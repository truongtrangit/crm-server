const LeadStatus = require("../models/LeadStatus");
const LeadStatusGroup = require("../models/LeadStatusGroup");
const crypto = require("crypto");
const { createHttpError } = require("../utils/http");

function generateId() {
  return "ls_" + crypto.randomBytes(6).toString("hex");
}
function generateGroupId() {
  return "lsg_" + crypto.randomBytes(6).toString("hex");
}

class LeadConfigService {
  async getStatuses() {
    return await LeadStatus.find().sort({ createdAt: 1 });
  }

  async createStatus(data) {
    const newStatus = new LeadStatus({
      ...data,
      id: generateId(),
    });
    await newStatus.save();
    return newStatus;
  }

  async updateStatus(id, data) {
    const updatedStatus = await LeadStatus.findOneAndUpdate({ id }, data, { new: true });
    if (!updatedStatus) {
      throw createHttpError(404, "Không tìm thấy trạng thái");
    }
    return updatedStatus;
  }

  async deleteStatus(id) {
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
      id: generateGroupId(),
    });
    await newGroup.save();
    return newGroup;
  }

  async updateGroup(id, data) {
    const updatedGroup = await LeadStatusGroup.findOneAndUpdate({ id }, data, { new: true });
    if (!updatedGroup) {
      throw createHttpError(404, "Không tìm thấy nhóm trạng thái");
    }
    return updatedGroup;
  }

  async deleteGroup(id) {
    const deletedGroup = await LeadStatusGroup.findOneAndDelete({ id });
    if (!deletedGroup) {
      throw createHttpError(404, "Không tìm thấy nhóm trạng thái");
    }
    return deletedGroup;
  }
}

module.exports = new LeadConfigService();
