const express = require("express");
const { requirePermission } = require("../../middleware/auth");
const validate = require("../../middleware/validate");
const { PERMISSIONS } = require("../../constants/rbac");
const { createFunctionSchema } = require("../../validations/functions");
const FunctionController = require("../../controllers/FunctionController");

const router = express.Router();

router.get(
  "/",
  requirePermission(PERMISSIONS.FUNCTIONS_READ),
  FunctionController.getFunctions
);

router.post(
  "/",
  requirePermission(PERMISSIONS.FUNCTIONS_CREATE),
  validate(createFunctionSchema),
  FunctionController.createFunction
);

module.exports = router;
