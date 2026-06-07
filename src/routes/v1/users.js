const express = require("express");
const { requirePermission, requireRole } = require("../../middleware/auth");
const { scopeAssignmentList } = require("../../middleware/resourceAccess");
const { scopeFieldAccess } = require("../../middleware/fieldAccess");

const validate = require("../../middleware/validate");
const { PERMISSIONS } = require("../../constants/rbac");
const UserController = require("../../controllers/UserController");
const {
  createUserSchema,
  updateUserSchema,
  listUsersQuerySchema,
} = require("../../validations/users");

const router = express.Router();

const { userResourceAccess } = require("../../middleware/userAccess");

router.get("/org-options", UserController.getOrgOptions);

router.get(
  "/",
  // requirePermission(PERMISSIONS.USERS_READ),
  validate(listUsersQuerySchema, "query"),
  scopeAssignmentList({
    // Hành vi: Cho phép Manager nhìn thấy nhân viên cấp dưới
    allowManagerSubordinateScope: true,
  }),
  scopeFieldAccess("staff", [
    "id",
    "name",
    "avatar",
    "isActive",
    "roleId",
    "departments",
    "groups",
  ]),
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
  userResourceAccess,
  validate(updateUserSchema),
  UserController.updateUser,
);

router.delete(
  "/:id",
  requirePermission(PERMISSIONS.USERS_DELETE),
  userResourceAccess,
  UserController.deleteUser,
);

router.put(
  "/:id/restore",
  requireRole(["OWNER", "ADMIN"]),
  requirePermission(PERMISSIONS.USER_RESTORE),
  UserController.restoreUser,
);

router.delete(
  "/:id/permanent",
  requireRole(["OWNER", "ADMIN"]),
  requirePermission(PERMISSIONS.USERS_PERMANENT_DELETE),
  UserController.permanentDeleteUser,
);

module.exports = router;
