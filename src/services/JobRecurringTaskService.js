const JobTask = require("../models/JobTask");
const JobConfigRepeatRule = require("../models/JobConfigRepeatRule");
const JobConfigStatus = require("../models/JobConfigStatus");
const TaskService = require("./TaskService");
const { ID_PREFIXES, generateMonotonicId } = require("../utils/id");

class JobRecurringTaskService {
  /**
   * Tính toán các ngày cần sinh task trong khoảng [startDate, endDate]
   */
  _calculateSyncDates(rule, startDate, endDate) {
    const dates = [];
    let current = new Date(startDate);
    current.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    while (current <= end) {
      if (rule.cycleType === "weekly") {
        if (rule.cycleValues.includes(current.getDay())) {
          dates.push(new Date(current));
        }
      } else if (rule.cycleType === "monthly") {
        if (rule.cycleValues.includes(current.getDate())) {
          dates.push(new Date(current));
        }
      }
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }

  /**
   * Lấy trạng thái mặc định (có order nhỏ nhất)
   */
  async _getDefaultStatusId() {
    const defaultStatus = await JobConfigStatus.findOne().sort({ order: 1 });
    return defaultStatus ? defaultStatus.id : null;
  }

  /**
   * Sinh các task mới dựa trên rule và danh sách các ngày
   */
  async _generateTasksForDates(rule, dates, currentUser) {
    if (!rule.isActive) return;

    // Lấy trạng thái mặc định
    const defaultStatusId = await this._getDefaultStatusId();
    if (!defaultStatusId) {
      console.warn(`[JobRecurringTask] No JobConfigStatus found. Cannot generate task for rule ${rule.id}`);
      return;
    }

    // Resolve assignees
    const resolvedAssignees = rule.assignees || [];

    const tasksToInsert = [];

    for (const date of dates) {
      // Check duplicate
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const exists = await JobTask.exists({
        sourceRuleId: rule.id,
        scheduledDate: { $gte: startOfDay, $lt: endOfDay }
      });

      if (exists) continue;

      const id = await generateMonotonicId(ID_PREFIXES.JOB_TASK || "JBT");
      
      const checklists = (rule.checklists || []).map(cl => ({
        title: cl.title,
        assignees: cl.assignees || [],
        isCompleted: false
      }));

      const newTask = {
        id,
        name: `${rule.name} - ${date.toLocaleDateString("vi-VN")}`,
        statusId: defaultStatusId,
        jobTaskTypeId: rule.taskTypeId || null,
        jobChannelId: rule.channelId || null,
        createdBy: currentUser?.id || null,
        assignees: resolvedAssignees,
        details: rule.details || "",
        shortDescription: rule.shortDescription || "",
        checklists,
        sourceRuleId: rule.id,
        scheduledDate: date,
        logs: [{
          action: "create",
          description: `Hệ thống tự động sinh tác vụ từ Quy tắc lặp lại: ${rule.name}`,
          user: currentUser ? {
            id: currentUser.id,
            name: currentUser.name,
            email: currentUser.email,
          } : { id: "SYSTEM", name: "System", email: "system@crm" },
          createdAt: new Date()
        }]
      };

      tasksToInsert.push(newTask);
    }

    if (tasksToInsert.length > 0) {
      await JobTask.insertMany(tasksToInsert);
    }
  }

  /**
   * Đồng bộ khi rule được TẠO hoặc UPDATE.
   */
  async syncTasksForUpdatedRule(rule, currentUser) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const targetEnd = new Date();
    targetEnd.setDate(today.getDate() + 30); // 30 days

    // Xóa các task tương lai chưa làm (chưa update status khác default, chưa check list)
    // Tạm thời xóa các task chưa đến ngày
    const defaultStatusId = await this._getDefaultStatusId();
    await JobTask.deleteMany({
      sourceRuleId: rule.id,
      statusId: defaultStatusId,
      scheduledDate: { $gte: today }
    });

    if (rule.isActive) {
      const datesToSync = this._calculateSyncDates(rule, today, targetEnd);
      await this._generateTasksForDates(rule, datesToSync, currentUser);
    }
  }

  /**
   * Xử lý khi rule bị Xoá
   */
  async syncTasksForDeletedRule(ruleId, currentUser) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await JobTask.deleteMany({
      sourceRuleId: ruleId,
      scheduledDate: { $gte: today }
    });
  }

  /**
   * Daily Cronjob
   */
  async runDailyCron() {
    console.log("[JobRecurringTask] Running daily generation cron...");
    const rules = await JobConfigRepeatRule.find({ isActive: true });
    
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 30);
    targetDate.setHours(0, 0, 0, 0);

    for (const rule of rules) {
      try {
        const datesToSync = this._calculateSyncDates(rule, targetDate, targetDate);
        if (datesToSync.length > 0) {
          await this._generateTasksForDates(rule, datesToSync, null);
        }
      } catch (err) {
        console.error(`[JobRecurringTask] Cron failed for rule ${rule.id}`, err);
      }
    }
    console.log("[JobRecurringTask] Daily cron finished.");
  }
}

module.exports = new JobRecurringTaskService();
