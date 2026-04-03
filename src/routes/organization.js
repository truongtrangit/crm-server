const express = require("express");
const Organization = require("../models/Organization");
const { sendError, sendSuccess } = require("../utils/http");
const {
  buildPaginatedResponse,
  resolvePagination,
} = require("../utils/pagination");

const router = express.Router();

router.get("/", async (req, res) => {
  const { page, limit, skip } = resolvePagination(req.query || {});
  const [organization, totalItems] = await Promise.all([
    Organization.find().sort({ createdAt: 1, id: 1 }).skip(skip).limit(limit),
    Organization.countDocuments(),
  ]);

  return sendSuccess(
    res,
    200,
    "Get organization list success",
    buildPaginatedResponse(organization, totalItems, page, limit),
  );
});

router.post("/departments", async (req, res) => {
  const { name, desc = "" } = req.body || {};

  if (!name) {
    return sendError(res, 400, "name is required", {
      code: "VALIDATION_ERROR",
    });
  }

  const nextId = String((await Organization.countDocuments()) + 1);
  const department = await Organization.create({
    id: nextId,
    parent: name,
    children: [],
  });

  return sendSuccess(res, 201, "Create department success", department);
});

router.post("/groups", async (req, res) => {
  const { name, desc = "", parentId } = req.body || {};

  if (!name || !parentId) {
    return sendError(res, 400, "name and parentId are required", {
      code: "VALIDATION_ERROR",
    });
  }

  const department = await Organization.findOne({ id: parentId });

  if (!department) {
    return sendError(res, 404, "Department not found", {
      code: "DEPARTMENT_NOT_FOUND",
    });
  }

  department.children.push({ name, desc });
  await department.save();

  return sendSuccess(res, 201, "Create group success", {
    name,
    desc,
    parentId,
  });
});

module.exports = router;
