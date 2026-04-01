const express = require("express");
const Staff = require("../models/Staff");
const { generateSequentialId } = require("../utils/id");
const { buildSearchRegex } = require("../utils/query");

const router = express.Router();

router.get("/", async (req, res) => {
  const { search = "", department, role } = req.query;
  const searchRegex = buildSearchRegex(search);
  const query = {};

  if (searchRegex) {
    query.$or = [
      { name: searchRegex },
      { email: searchRegex },
      { phone: searchRegex },
    ];
  }

  if (department) {
    query.department = department;
  }

  if (role) {
    query.role = role;
  }

  const staff = await Staff.find(query).sort({ createdAt: -1 });
  res.json(staff);
});

router.post("/", async (req, res) => {
  const payload = req.body || {};

  if (!payload.name || !payload.email) {
    return res.status(400).json({ message: "name and email are required" });
  }

  if (!Array.isArray(payload.department) || payload.department.length === 0) {
    return res
      .status(400)
      .json({ message: "department must contain at least one item" });
  }

  const staff = await Staff.create({
    id: await generateSequentialId(Staff, "STAFF"),
    name: payload.name,
    email: payload.email,
    avatar:
      payload.avatar ||
      `https://i.pravatar.cc/150?u=${encodeURIComponent(payload.email)}`,
    department: payload.department,
    group: Array.isArray(payload.group) ? payload.group : [],
    phone: payload.phone || "",
    role: payload.role || "Nhân viên",
  });

  return res.status(201).json(staff);
});

router.put("/:id", async (req, res) => {
  const staff = await Staff.findOne({ id: req.params.id });

  if (!staff) {
    return res.status(404).json({ message: "Staff not found" });
  }

  if (
    req.body.department &&
    (!Array.isArray(req.body.department) || req.body.department.length === 0)
  ) {
    return res
      .status(400)
      .json({ message: "department must contain at least one item" });
  }

  Object.assign(staff, {
    name: req.body.name ?? staff.name,
    email: req.body.email ?? staff.email,
    avatar: req.body.avatar ?? staff.avatar,
    department: Array.isArray(req.body.department)
      ? req.body.department
      : staff.department,
    group: Array.isArray(req.body.group) ? req.body.group : staff.group,
    phone: req.body.phone ?? staff.phone,
    role: req.body.role ?? staff.role,
  });

  await staff.save();
  return res.json(staff);
});

router.delete("/:id", async (req, res) => {
  const deleted = await Staff.findOneAndDelete({ id: req.params.id });

  if (!deleted) {
    return res.status(404).json({ message: "Staff not found" });
  }

  return res.status(204).send();
});

module.exports = router;
