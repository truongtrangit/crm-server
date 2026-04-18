const express = require("express");
const Task = require("../../models/Task");
const { generateTaskId } = require("../../utils/id");
const { buildSearchRegex } = require("../../utils/query");
const { sendError, sendSuccess } = require("../../utils/http");
const {
  buildPaginatedResponse,
  resolvePagination,
} = require("../../utils/pagination");
const { requirePermission } = require("../../middleware/auth");
const validate = require("../../middleware/validate");
const { PERMISSIONS } = require("../../constants/rbac");
const {
  createTaskSchema,
  updateTaskSchema,
  listTasksQuerySchema,
} = require("../../validations/tasks");

const router = express.Router();

router.get(
  "/",
  requirePermission(PERMISSIONS.TASKS_READ),
  validate(listTasksQuerySchema, "query"),
  async (req, res) => {
    const { search = "", platform, assignee, status } = req.query;
    const searchRegex = buildSearchRegex(search);
    const { page, limit, skip } = resolvePagination(req.query || {});
    const query = {};

    if (searchRegex) {
      query.$or = [
        { action: searchRegex },
        { id: searchRegex },
        { "customer.name": searchRegex },
        { "customer.email": searchRegex },
        { "customer.phone": searchRegex },
      ];
    }

    if (platform) {
      query.platform = platform;
    }

    if (assignee) {
      query["assignee.name"] = assignee;
    }

    if (status) {
      query.status = status;
    }

    const [tasks, totalItems] = await Promise.all([
      Task.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Task.countDocuments(query),
    ]);

    return sendSuccess(
      res,
      200,
      "Get task list success",
      buildPaginatedResponse(tasks, totalItems, page, limit),
    );
  },
);

router.post(
  "/",
  requirePermission(PERMISSIONS.TASKS_CREATE),
  validate(createTaskSchema),
  async (req, res) => {
    const payload = req.body || {};
    const action = payload.action || payload.name;

    const task = await Task.create({
      id: await generateTaskId(Task),
      action,
      time: payload.time || "Sắp tới",
      timeType: payload.timeType || "future",
      customer: {
        name: payload.customer.name,
        avatar:
          payload.customer.avatar ||
          `https://i.pravatar.cc/150?u=${encodeURIComponent(payload.customer.email || payload.customer.name)}`,
        email: payload.customer.email || "",
        phone: payload.customer.phone || "",
      },
      platform: payload.platform || "SmaxAi",
      assignee: payload.assignee || { name: "", avatar: "" },
      status: payload.status || "Đang thực hiện",
    });

    return sendSuccess(res, 201, "Create task success", task);
  },
);

router.put(
  "/:id",
  requirePermission(PERMISSIONS.TASKS_UPDATE),
  validate(updateTaskSchema),
  async (req, res) => {
    const task = await Task.findOne({ id: req.params.id });

    if (!task) {
      return sendError(res, 404, "Task not found", {
        code: "TASK_NOT_FOUND",
      });
    }

    Object.assign(task, {
      action: req.body.action ?? req.body.name ?? task.action,
      time: req.body.time ?? task.time,
      timeType: req.body.timeType ?? task.timeType,
      customer: req.body.customer
        ? {
            name: req.body.customer.name ?? task.customer.name,
            avatar: req.body.customer.avatar ?? task.customer.avatar,
            email: req.body.customer.email ?? task.customer.email,
            phone: req.body.customer.phone ?? task.customer.phone,
          }
        : task.customer,
      platform: req.body.platform ?? task.platform,
      assignee: req.body.assignee ?? task.assignee,
      status: req.body.status ?? task.status,
    });

    await task.save();
    return sendSuccess(res, 200, "Update task success", task);
  },
);

router.delete(
  "/:id",
  requirePermission(PERMISSIONS.TASKS_DELETE),
  async (req, res) => {
    const deleted = await Task.findOneAndDelete({ id: req.params.id });

    if (!deleted) {
      return sendError(res, 404, "Task not found", {
        code: "TASK_NOT_FOUND",
      });
    }

    return sendSuccess(res, 200, "Delete task success", null);
  },
);

module.exports = router;
