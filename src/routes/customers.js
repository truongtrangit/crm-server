const express = require("express");
const Customer = require("../models/Customer");
const { generateSequentialId } = require("../utils/id");
const { buildSearchRegex } = require("../utils/query");
const { sendError, sendSuccess } = require("../utils/http");
const {
  buildPaginatedResponse,
  resolvePagination,
} = require("../utils/pagination");

const router = express.Router();

router.get("/", async (req, res) => {
  const { search = "", type, group, platform } = req.query;
  const searchRegex = buildSearchRegex(search);
  const { page, limit, skip } = resolvePagination(req.query || {});
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

  const [customers, totalItems] = await Promise.all([
    Customer.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Customer.countDocuments(query),
  ]);

  return sendSuccess(
    res,
    200,
    "Get customer list success",
    buildPaginatedResponse(customers, totalItems, page, limit),
  );
});

router.get("/:id", async (req, res) => {
  const customer = await Customer.findOne({ id: req.params.id });

  if (!customer) {
    return sendError(res, 404, "Customer not found", {
      code: "CUSTOMER_NOT_FOUND",
    });
  }

  return sendSuccess(res, 200, "Get customer detail success", customer);
});

router.post("/", async (req, res) => {
  const payload = req.body || {};

  if (!payload.name || !payload.email) {
    return sendError(res, 400, "name and email are required", {
      code: "VALIDATION_ERROR",
    });
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

  return sendSuccess(res, 201, "Create customer success", customer);
});

router.put("/:id", async (req, res) => {
  const existing = await Customer.findOne({ id: req.params.id });

  if (!existing) {
    return sendError(res, 404, "Customer not found", {
      code: "CUSTOMER_NOT_FOUND",
    });
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
  return sendSuccess(res, 200, "Update customer success", existing);
});

router.delete("/:id", async (req, res) => {
  const deleted = await Customer.findOneAndDelete({ id: req.params.id });

  if (!deleted) {
    return sendError(res, 404, "Customer not found", {
      code: "CUSTOMER_NOT_FOUND",
    });
  }

  return sendSuccess(res, 200, "Delete customer success", null);
});

module.exports = router;
