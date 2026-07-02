const express = require("express");
const { requirePermission, requireRole } = require('../../core/middleware/auth');
const { scopeAssignmentList } = require('../../core/middleware/resourceAccess');
const { scopeFieldAccess } = require('../../core/middleware/fieldAccess');

const validate = require('../../core/middleware/validate');
const { PERMISSIONS } = require('../../core/constants/rbac');
const UserController = require('../../modules/system/user/user.controller');
const {
  createUserSchema,
  updateUserSchema,
  listUsersQuerySchema,
} = require('../../modules/system/user/users.validation');

const router = express.Router();

const { userResourceAccess } = require('../../core/middleware/userAccess');

router.get("/org-options", requirePermission(PERMISSIONS.USERS_READ), UserController.getOrgOptions);

router.get(
  "/",
  requirePermission(PERMISSIONS.USERS_READ),
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
  requirePermission(PERMISSIONS.USERS_RESTORE),
  UserController.restoreUser,
);

router.delete(
  "/:id/permanent",
  requireRole(["OWNER", "ADMIN"]),
  requirePermission(PERMISSIONS.USERS_PERMANENT_DELETE),
  UserController.permanentDeleteUser,
);

module.exports = router;
