const express = require("express");
const StaffFunction = require("../models/StaffFunction");
const { generateSequentialId } = require("../utils/id");

const router = express.Router();

router.get("/", async (_req, res) => {
  const items = await StaffFunction.find().sort({ createdAt: 1, id: 1 });
  res.json(items);
});

router.post("/", async (req, res) => {
  const { title, desc = "", type = "tech" } = req.body || {};

  if (!title) {
    return res.status(400).json({ message: "title is required" });
  }

  const item = await StaffFunction.create({
    id: await generateSequentialId(StaffFunction, "FUNC"),
    title,
    desc,
    type,
  });

  return res.status(201).json(item);
});

module.exports = router;
