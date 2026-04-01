const express = require("express");
const Customer = require("../models/Customer");
const { generateSequentialId } = require("../utils/id");
const { buildSearchRegex } = require("../utils/query");

const router = express.Router();

router.get("/", async (req, res) => {
  const { search = "", type, group, platform } = req.query;
  const searchRegex = buildSearchRegex(search);
  const query = {};

  if (searchRegex) {
    query.$or = [
      { name: searchRegex },
      { email: searchRegex },
      { phone: searchRegex },
    ];
  }

  if (type && type !== "All") {
    query.type = type;
  }

  if (group) {
    query.group = group;
  }

  if (platform) {
    query.platforms = platform;
  }

  const customers = await Customer.find(query).sort({ createdAt: -1 });
  res.json(customers);
});

router.get("/:id", async (req, res) => {
  const customer = await Customer.findOne({ id: req.params.id });

  if (!customer) {
    return res.status(404).json({ message: "Customer not found" });
  }

  return res.json(customer);
});

router.post("/", async (req, res) => {
  const payload = req.body || {};

  if (!payload.name || !payload.email) {
    return res.status(400).json({ message: "name and email are required" });
  }

  const customer = await Customer.create({
    id: await generateSequentialId(Customer, "CUST"),
    name: payload.name,
    avatar:
      payload.avatar ||
      `https://i.pravatar.cc/150?u=${encodeURIComponent(payload.email)}`,
    type: payload.type || "Standard Customer",
    email: payload.email,
    phone: payload.phone || "",
    biz: Array.isArray(payload.biz) ? payload.biz.filter(Boolean) : [],
    platforms: Array.isArray(payload.platforms)
      ? payload.platforms.filter(Boolean)
      : [],
    group: payload.group || "",
    registeredAt:
      payload.registeredAt || new Date().toLocaleDateString("vi-VN"),
    lastLoginAt: payload.lastLoginAt || new Date().toLocaleDateString("vi-VN"),
    tags: Array.isArray(payload.tags) ? payload.tags.filter(Boolean) : [],
  });

  return res.status(201).json(customer);
});

router.put("/:id", async (req, res) => {
  const existing = await Customer.findOne({ id: req.params.id });

  if (!existing) {
    return res.status(404).json({ message: "Customer not found" });
  }

  Object.assign(existing, {
    name: req.body.name ?? existing.name,
    avatar: req.body.avatar ?? existing.avatar,
    type: req.body.type ?? existing.type,
    email: req.body.email ?? existing.email,
    phone: req.body.phone ?? existing.phone,
    biz: Array.isArray(req.body.biz) ? req.body.biz : existing.biz,
    platforms: Array.isArray(req.body.platforms)
      ? req.body.platforms
      : existing.platforms,
    group: req.body.group ?? existing.group,
    registeredAt: req.body.registeredAt ?? existing.registeredAt,
    lastLoginAt: req.body.lastLoginAt ?? existing.lastLoginAt,
    tags: Array.isArray(req.body.tags) ? req.body.tags : existing.tags,
  });

  await existing.save();
  return res.json(existing);
});

router.delete("/:id", async (req, res) => {
  const deleted = await Customer.findOneAndDelete({ id: req.params.id });

  if (!deleted) {
    return res.status(404).json({ message: "Customer not found" });
  }

  return res.status(204).send();
});

module.exports = router;
