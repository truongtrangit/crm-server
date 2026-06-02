const express = require("express");
const { requirePermission } = require("../../middleware/auth");
const validate = require("../../middleware/validate");
const { PERMISSIONS } = require("../../constants/rbac");
const { createFunctionSchema, updateFunctionSchema } = require("../../validations/functions");
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

router.put(
  "/:id",
  requirePermission(PERMISSIONS.FUNCTIONS_UPDATE),
  validate(updateFunctionSchema),
  FunctionController.updateFunction
);

router.delete(
  "/:id",
  requirePermission(PERMISSIONS.FUNCTIONS_DELETE),
  FunctionController.deleteFunction
);

module.exports = router;
