const { createHttpError } = require("../utils/http");
const JobConfigStatus = require("../models/JobConfigStatus");
const JobConfigTaskType = require("../models/JobConfigTaskType");
const JobConfigTaskTypeGroup = require("../models/JobConfigTaskTypeGroup");
const JobConfigChannel = require("../models/JobConfigChannel");
const JobConfigRepeatRule = require("../models/JobConfigRepeatRule");
const JobTask = require("../models/JobTask");
const JobRecurringTaskService = require("./JobRecurringTaskService");
const { ID_PREFIXES, generateMonotonicId } = require("../utils/id");

class JobConfigService {
  // ==========================================
  // STATUS CONFIG
  // ==========================================
  async getStatuses() {
    return JobConfigStatus.find().sort({ order: 1, createdAt: 1 }).lean();
  }

  async createStatus(data) {
    const id = await generateMonotonicId(ID_PREFIXES.JOB_STATUS_CONFIG);
    const maxStatus = await JobConfigStatus.findOne().sort({ order: -1 }).lean();
    const nextOrder = maxStatus && maxStatus.order !== undefined ? maxStatus.order + 1 : 1;

    const status = new JobConfigStatus({ ...data, id, order: nextOrder });
    await status.save();
    return status;
  }

  async updateStatus(id, data) {
    const status = await JobConfigStatus.findOne({ id });
    if (!status) throw createHttpError(404, "Không tìm thấy trạng thái");
    Object.assign(status, data);
    await status.save();
    return status;
  }

  async deleteStatus(id, force = false) {
    const status = await JobConfigStatus.findOne({ id });
    if (!status) throw createHttpError(404, "Không tìm thấy trạng thái");

    const taskCount = await JobTask.countDocuments({ statusId: id });

    if (taskCount > 0 && !force) {
      throw createHttpError(400, `Trạng thái này đang được sử dụng bởi ${taskCount} công việc. Bắt buộc xóa sẽ gỡ bỏ trạng thái của các công việc này.`, {
        code: "STATUS_IN_USE",
        details: { taskCount },
      });
    }

    if (taskCount > 0 && force) {
      await JobTask.updateMany({ statusId: id }, { $set: { statusId: null } });
    }

    await JobConfigStatus.deleteOne({ id });
    return { success: true };
  }

  async reorderStatuses(orderedIds) {
    if (!orderedIds || orderedIds.length === 0) return true;

    // 1. Kiểm tra tồn tại
    const existingStatuses = await JobConfigStatus.find({ id: { $in: orderedIds } });
    if (existingStatuses.length !== orderedIds.length) {
      throw Object.assign(new Error("Danh sách ID không hợp lệ hoặc chứa trạng thái không tồn tại"), { status: 400 });
    }

    // 2. Kiểm tra đủ số lượng
    const totalInDb = await JobConfigStatus.countDocuments();
    if (totalInDb !== orderedIds.length) {
      throw Object.assign(new Error("Vui lòng gửi đầy đủ danh sách trạng thái để sắp xếp"), { status: 400 });
    }

    const promises = orderedIds.map((id, index) =>
      JobConfigStatus.findOneAndUpdate({ id }, { order: index + 1 })
    );
    await Promise.all(promises);
    return true;
  }

  // ==========================================
  // TASK TYPE GROUP CONFIG
  // ==========================================
  async getTaskTypeGroups() {
    return JobConfigTaskTypeGroup.find().sort({ createdAt: -1 }).lean();
  }

  async createTaskTypeGroup(data) {
    const id = await generateMonotonicId(ID_PREFIXES.JOB_TASK_TYPE_GROUP);
    const group = new JobConfigTaskTypeGroup({ ...data, id });
    await group.save();
    return group;
  }

  async updateTaskTypeGroup(id, data) {
    const group = await JobConfigTaskTypeGroup.findOne({ id });
    if (!group) throw createHttpError(404, "Không tìm thấy nhóm loại công việc");
    Object.assign(group, data);
    await group.save();
    return group;
  }

  async deleteTaskTypeGroup(id) {
    const group = await JobConfigTaskTypeGroup.findOne({ id });
    if (!group) throw createHttpError(404, "Không tìm thấy nhóm loại công việc");

    const taskTypeCount = await JobConfigTaskType.countDocuments({ groupId: id });
    if (taskTypeCount > 0) {
      throw createHttpError(400, "Không thể xoá nhóm đang chứa loại công việc. Vui lòng chuyển loại công việc sang nhóm khác hoặc xoá chúng trước.");
    }

    await JobConfigTaskTypeGroup.deleteOne({ id });
    return { success: true };
  }

  // ==========================================
  // TASK TYPE CONFIG
  // ==========================================
  async getTaskTypes() {
    return JobConfigTaskType.find().sort({ createdAt: -1 }).lean();
  }

  async createTaskType(data) {
    const group = await JobConfigTaskTypeGroup.findOne({ id: data.groupId });
    if (!group) throw createHttpError(404, "Nhóm loại công việc không tồn tại");

    const id = await generateMonotonicId(ID_PREFIXES.JOB_TASK_TYPE);
    const taskType = new JobConfigTaskType({ ...data, id });
    await taskType.save();
    return taskType;
  }

  async updateTaskType(id, data) {
    const taskType = await JobConfigTaskType.findOne({ id });
    if (!taskType) throw createHttpError(404, "Không tìm thấy loại công việc");

    if (data.groupId && data.groupId !== taskType.groupId) {
      const group = await JobConfigTaskTypeGroup.findOne({ id: data.groupId });
      if (!group) throw createHttpError(404, "Nhóm loại công việc không tồn tại");
    }

    Object.assign(taskType, data);
    await taskType.save();
    return taskType;
  }

  async deleteTaskType(id) {
    const taskType = await JobConfigTaskType.findOne({ id });
    if (!taskType) throw createHttpError(404, "Không tìm thấy loại công việc");
    if (taskType.isSystem) {
      throw createHttpError(400, "Không thể xoá loại công việc mặc định của hệ thống");
    }
    await JobConfigTaskType.deleteOne({ id });
    return { success: true };
  }

  // ==========================================
  // CHANNEL CONFIG
  // ==========================================
  async getChannels() {
    return JobConfigChannel.find().sort({ createdAt: -1 }).lean();
  }

  async createChannel(data) {
    const id = await generateMonotonicId(ID_PREFIXES.JOB_CHANNEL);
    const channel = new JobConfigChannel({ ...data, id });
    await channel.save();
    return channel;
  }

  async updateChannel(id, data) {
    const channel = await JobConfigChannel.findOne({ id });
    if (!channel) throw createHttpError(404, "Không tìm thấy kênh triển khai");
    Object.assign(channel, data);
    await channel.save();
    return channel;
  }

  async deleteChannel(id) {
    const channel = await JobConfigChannel.findOne({ id });
    if (!channel) throw createHttpError(404, "Không tìm thấy kênh triển khai");
    // Check if channel has children
    const hasChildren = await JobConfigChannel.exists({ parentId: id });
    if (hasChildren) {
      throw createHttpError(400, "Không thể xoá kênh đang chứa kênh con. Vui lòng xoá kênh con trước.");
    }
    // Check if channel is used by repeat rules
    const usedByRules = await JobConfigRepeatRule.exists({
      $or: [
        { channelId: id },
        { channelIds: id }
      ]
    });
    if (usedByRules) {
      throw createHttpError(400, "Kênh đang được sử dụng bởi Quy tắc lặp lại. Không thể xoá.");
    }
    await JobConfigChannel.deleteOne({ id });
    return { success: true };
  }

  // ==========================================
  // REPEAT RULE CONFIG
  // ==========================================
  async getRepeatRules() {
    return JobConfigRepeatRule.find().sort({ createdAt: -1 }).lean();
  }

  async getRepeatRuleById(id) {
    const rule = await JobConfigRepeatRule.findOne({ id }).lean();
    if (!rule) throw createHttpError(404, "Không tìm thấy quy tắc lặp lại");
    return rule;
  }

  async createRepeatRule(data, currentUser) {
    // Validate channels
    if (data.channelIds && data.channelIds.length > 0) {
      const channels = await JobConfigChannel.find({ id: { $in: data.channelIds } });
      if (channels.length !== data.channelIds.length) {
        throw createHttpError(404, "Một hoặc nhiều kênh triển khai không tồn tại");
      }
    } else if (data.channelId) {
      const channel = await JobConfigChannel.findOne({ id: data.channelId });
      if (!channel) throw createHttpError(404, "Kênh triển khai không tồn tại");
    }

    const id = await generateMonotonicId(ID_PREFIXES.JOB_REPEAT_RULE);
    const rule = new JobConfigRepeatRule({ ...data, id });
    await rule.save();

    // Trigger Task Sync
    await JobRecurringTaskService.syncTasksForUpdatedRule(rule, currentUser).catch(err => {
      console.error("[JobRecurringTask] Failed to sync tasks for new rule", err);
    });

    return rule;
  }

  async updateRepeatRule(id, data, currentUser) {
    const rule = await JobConfigRepeatRule.findOne({ id });
    if (!rule) throw createHttpError(404, "Không tìm thấy quy tắc lặp lại");

    if (data.channelIds && data.channelIds.length > 0) {
      const channels = await JobConfigChannel.find({ id: { $in: data.channelIds } });
      if (channels.length !== data.channelIds.length) {
        throw createHttpError(404, "Một hoặc nhiều kênh triển khai không tồn tại");
      }
    } else if (data.channelId && data.channelId !== rule.channelId) {
      const channel = await JobConfigChannel.findOne({ id: data.channelId });
      if (!channel) throw createHttpError(404, "Kênh triển khai không tồn tại");
    }

    Object.assign(rule, data);
    await rule.save();

    // Trigger Task Sync
    const JobRecurringTaskService = require("./JobRecurringTaskService");
    await JobRecurringTaskService.syncTasksForUpdatedRule(rule, currentUser).catch(err => {
      console.error("[JobRecurringTask] Failed to sync tasks for updated rule", err);
    });

    return rule;
  }

  async deleteRepeatRule(id, currentUser) {
    const rule = await JobConfigRepeatRule.findOne({ id });
    if (!rule) throw createHttpError(404, "Không tìm thấy quy tắc lặp lại");

    // Trigger Task Cleanup
    const JobRecurringTaskService = require("./JobRecurringTaskService");
    await JobRecurringTaskService.syncTasksForDeletedRule(rule.id, currentUser).catch(err => {
      console.error("[JobRecurringTask] Failed to cleanup tasks for deleted rule", err);
    });

    await JobConfigRepeatRule.deleteOne({ id });
    return { success: true };
  }
}

module.exports = new JobConfigService();
