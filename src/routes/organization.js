const express = require("express");
const Organization = require("../models/Organization");

const router = express.Router();

router.get("/", async (_req, res) => {
  const organization = await Organization.find().sort({ createdAt: 1, id: 1 });
  res.json(organization);
});

router.post("/departments", async (req, res) => {
  const { name, desc = "" } = req.body || {};

  if (!name) {
    return res.status(400).json({ message: "name is required" });
  }

  const nextId = String((await Organization.countDocuments()) + 1);
  const department = await Organization.create({
    id: nextId,
    parent: name,
    children: [],
  });

  return res.status(201).json(department);
});

router.post("/groups", async (req, res) => {
  const { name, desc = "", parentId } = req.body || {};

  if (!name || !parentId) {
    return res.status(400).json({ message: "name and parentId are required" });
  }

  const department = await Organization.findOne({ id: parentId });

  if (!department) {
    return res.status(404).json({ message: "Department not found" });
  }

  department.children.push({ name, desc });
  await department.save();

  return res.status(201).json({
    name,
    desc,
    parentId,
  });
});

module.exports = router;
