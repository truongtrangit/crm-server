const express = require("express");
const { requirePermission } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { PERMISSIONS } = require("../constants/rbac");
const asyncHandler = require("../utils/asyncHandler");
const UserController = require("../controllers/UserController");
const {
  createUserSchema,
  updateUserSchema,
  listUsersQuerySchema,
} = require("../validations/users");

const router = express.Router();

router.get(
  "/",
  requirePermission(PERMISSIONS.USERS_READ),
  validate(listUsersQuerySchema, "query"),
  asyncHandler(UserController.listUsers),
);

router.post(
  "/",
  requirePermission(PERMISSIONS.USERS_CREATE),
  validate(createUserSchema),
  asyncHandler(UserController.createUser),
);

router.put(
  "/:id",
  requirePermission(PERMISSIONS.USERS_UPDATE),
  validate(updateUserSchema),
  asyncHandler(UserController.updateUser),
);

router.delete(
  "/:id",
  requirePermission(PERMISSIONS.USERS_DELETE),
  asyncHandler(UserController.deleteUser),
);

module.exports = router;
