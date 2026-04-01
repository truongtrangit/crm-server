const express = require("express");
const Lead = require("../models/Lead");
const { generateSequentialId } = require("../utils/id");
const { buildSearchRegex } = require("../utils/query");

const router = express.Router();

router.get("/", async (req, res) => {
  const { search = "", status, assignee } = req.query;
  const searchRegex = buildSearchRegex(search);
  const query = {};

  if (searchRegex) {
    query.$or = [
      { name: searchRegex },
      { id: searchRegex },
      { tags: searchRegex },
    ];
  }

  if (status) {
    query.status = status;
  }

  if (assignee) {
    query["assignee.name"] = assignee;
  }

  const leads = await Lead.find(query).sort({ createdAt: -1 });
  res.json(leads);
});

router.post("/", async (req, res) => {
  const payload = req.body || {};

  if (!payload.name) {
    return res.status(400).json({ message: "name is required" });
  }

  const lead = await Lead.create({
    id: await generateSequentialId(Lead, "LEAD"),
    name: payload.name,
    avatar:
      payload.avatar ||
      `https://i.pravatar.cc/150?u=${encodeURIComponent(payload.name)}`,
    timeAgo: payload.timeAgo || "Vừa xong",
    tags: Array.isArray(payload.tags) ? payload.tags : [],
    assignee: payload.assignee || { name: "", avatar: "" },
    status: payload.status || "Biz tạo mới",
    actionNeeded: payload.actionNeeded || "",
    actionType: payload.actionType || "",
    email: payload.email || "",
    phone: payload.phone || "",
    source: payload.source || "",
    address: payload.address || "",
  });

  return res.status(201).json(lead);
});

router.put("/:id", async (req, res) => {
  const lead = await Lead.findOne({ id: req.params.id });

  if (!lead) {
    return res.status(404).json({ message: "Lead not found" });
  }

  Object.assign(lead, {
    name: req.body.name ?? lead.name,
    avatar: req.body.avatar ?? lead.avatar,
    timeAgo: req.body.timeAgo ?? lead.timeAgo,
    tags: Array.isArray(req.body.tags) ? req.body.tags : lead.tags,
    assignee: req.body.assignee ?? lead.assignee,
    status: req.body.status ?? lead.status,
    actionNeeded: req.body.actionNeeded ?? lead.actionNeeded,
    actionType: req.body.actionType ?? lead.actionType,
    email: req.body.email ?? lead.email,
    phone: req.body.phone ?? lead.phone,
    source: req.body.source ?? lead.source,
    address: req.body.address ?? lead.address,
  });

  await lead.save();
  return res.json(lead);
});

router.patch("/:id/status", async (req, res) => {
  const lead = await Lead.findOne({ id: req.params.id });

  if (!lead) {
    return res.status(404).json({ message: "Lead not found" });
  }

  if (!req.body.status) {
    return res.status(400).json({ message: "status is required" });
  }

  lead.status = req.body.status;
  await lead.save();

  return res.json(lead);
});

router.delete("/:id", async (req, res) => {
  const deleted = await Lead.findOneAndDelete({ id: req.params.id });

  if (!deleted) {
    return res.status(404).json({ message: "Lead not found" });
  }

  return res.status(204).send();
});

module.exports = router;
