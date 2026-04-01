const express = require("express");
const Task = require("../models/Task");
const { generateTaskId } = require("../utils/id");
const { buildSearchRegex } = require("../utils/query");

const router = express.Router();

router.get("/", async (req, res) => {
  const { search = "", platform, assignee, status } = req.query;
  const searchRegex = buildSearchRegex(search);
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

  const tasks = await Task.find(query).sort({ createdAt: -1 });
  res.json(tasks);
});

router.post("/", async (req, res) => {
  const payload = req.body || {};
  const action = payload.action || payload.name;

  if (!action || !payload.customer?.name) {
    return res
      .status(400)
      .json({ message: "action/name and customer.name are required" });
  }

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

  return res.status(201).json(task);
});

router.put("/:id", async (req, res) => {
  const task = await Task.findOne({ id: req.params.id });

  if (!task) {
    return res.status(404).json({ message: "Task not found" });
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
  return res.json(task);
});

router.delete("/:id", async (req, res) => {
  const deleted = await Task.findOneAndDelete({ id: req.params.id });

  if (!deleted) {
    return res.status(404).json({ message: "Task not found" });
  }

  return res.status(204).send();
});

module.exports = router;
