const express = require("express");
const { requirePermission } = require("../../middleware/auth");
const validate = require("../../middleware/validate");
const { PERMISSIONS } = require("../../constants/rbac");
const UserController = require("../../controllers/UserController");
const {
  createUserSchema,
  updateUserSchema,
  listUsersQuerySchema,
} = require("../../validations/users");

const router = express.Router();

router.get(
  "/org-options",
  UserController.getOrgOptions,
);

router.get(
  "/",
  validate(listUsersQuerySchema, "query"),
  UserController.listUsers,
);

router.post(
  "/",
  requirePermission(PERMISSIONS.USERS_CREATE),
  validate(createUserSchema),
  UserController.createUser,
);

router.put(
  "/:id",
  requirePermission(PERMISSIONS.USERS_UPDATE),
  validate(updateUserSchema),
  UserController.updateUser,
);

router.delete(
  "/:id",
  requirePermission(PERMISSIONS.USERS_DELETE),
  UserController.deleteUser,
);

router.put(
  "/:id/restore",
  requirePermission(PERMISSIONS.USERS_DELETE),
  UserController.restoreUser,
);

router.delete(
  "/:id/permanent",
  requirePermission(PERMISSIONS.USERS_DELETE),
  UserController.permanentDeleteUser,
);

module.exports = router;
