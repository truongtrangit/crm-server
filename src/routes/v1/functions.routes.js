const express = require("express");
const { requirePermission } = require('../../core/middleware/auth');
const validate = require('../../core/middleware/validate');
const { PERMISSIONS } = require('../../core/constants/rbac');
const { createFunctionSchema, updateFunctionSchema } = require('../../modules/hr/function/function.validation');
const FunctionController = require('../../modules/hr/function/function.controller');

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
