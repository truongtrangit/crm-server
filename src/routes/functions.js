const express = require("express");
const StaffFunction = require("../models/StaffFunction");
const { generateSequentialId } = require("../utils/id");
const { sendError, sendSuccess } = require("../utils/http");
const {
  buildPaginatedResponse,
  resolvePagination,
} = require("../utils/pagination");
const { requirePermission } = require("../middleware/auth");
const { PERMISSIONS } = require("../constants/rbac");

const router = express.Router();

router.get(
  "/",
  requirePermission(PERMISSIONS.FUNCTIONS_READ),
  async (req, res) => {
    const { page, limit, skip } = resolvePagination(req.query || {});
    const [items, totalItems] = await Promise.all([
      StaffFunction.find()
        .sort({ createdAt: 1, id: 1 })
        .skip(skip)
        .limit(limit),
      StaffFunction.countDocuments(),
    ]);

    return sendSuccess(
      res,
      200,
      "Get functions success",
      buildPaginatedResponse(items, totalItems, page, limit),
    );
  },
);

router.post(
  "/",
  requirePermission(PERMISSIONS.FUNCTIONS_CREATE),
  async (req, res) => {
    const { title, desc = "", type = "tech" } = req.body || {};

    if (!title) {
      return sendError(res, 400, "title is required", {
        code: "VALIDATION_ERROR",
      });
    }

    const item = await StaffFunction.create({
      id: await generateSequentialId(StaffFunction, "FUNC"),
      title,
      desc,
      type,
    });

    return sendSuccess(res, 201, "Create function success", item);
  },
);

module.exports = router;
