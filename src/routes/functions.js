const express = require("express");
const StaffFunction = require("../models/StaffFunction");
const { generateSequentialId } = require("../utils/id");
const { sendSuccess } = require("../utils/http");
const {
  buildPaginatedResponse,
  resolvePagination,
} = require("../utils/pagination");
const { requirePermission } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { PERMISSIONS } = require("../constants/rbac");
const { createFunctionSchema } = require("../validations/functions");

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
  validate(createFunctionSchema),
  async (req, res) => {
    const { title, desc = "", type = "tech" } = req.body || {};

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
