const express = require("express");
const Lead = require("../models/Lead");
const { generateSequentialId } = require("../utils/id");
const { buildSearchRegex } = require("../utils/query");
const { sendError, sendSuccess } = require("../utils/http");
const {
  buildPaginatedResponse,
  resolvePagination,
} = require("../utils/pagination");

const router = express.Router();

router.get("/", async (req, res) => {
  const { search = "", status, assignee } = req.query;
  const searchRegex = buildSearchRegex(search);
  const { page, limit, skip } = resolvePagination(req.query || {});
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

  const [leads, totalItems] = await Promise.all([
    Lead.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Lead.countDocuments(query),
  ]);

  return sendSuccess(
    res,
    200,
    "Get lead list success",
    buildPaginatedResponse(leads, totalItems, page, limit),
  );
});

router.post("/", async (req, res) => {
  const payload = req.body || {};

  if (!payload.name) {
    return sendError(res, 400, "name is required", {
      code: "VALIDATION_ERROR",
    });
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

  return sendSuccess(res, 201, "Create lead success", lead);
});

router.put("/:id", async (req, res) => {
  const lead = await Lead.findOne({ id: req.params.id });

  if (!lead) {
    return sendError(res, 404, "Lead not found", {
      code: "LEAD_NOT_FOUND",
    });
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
  return sendSuccess(res, 200, "Update lead success", lead);
});

router.patch("/:id/status", async (req, res) => {
  const lead = await Lead.findOne({ id: req.params.id });

  if (!lead) {
    return sendError(res, 404, "Lead not found", {
      code: "LEAD_NOT_FOUND",
    });
  }

  if (!req.body.status) {
    return sendError(res, 400, "status is required", {
      code: "VALIDATION_ERROR",
    });
  }

  lead.status = req.body.status;
  await lead.save();

  return sendSuccess(res, 200, "Update lead status success", lead);
});

router.delete("/:id", async (req, res) => {
  const deleted = await Lead.findOneAndDelete({ id: req.params.id });

  if (!deleted) {
    return sendError(res, 404, "Lead not found", {
      code: "LEAD_NOT_FOUND",
    });
  }

  return sendSuccess(res, 200, "Delete lead success", null);
});

module.exports = router;
