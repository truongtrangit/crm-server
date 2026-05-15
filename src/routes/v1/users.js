const express = require("express");
const { requirePermission, requireRole } = require("../../middleware/auth");
const { requireResourceAccess, scopeAssignmentList } = require("../../middleware/resourceAccess");
const User = require("../../models/User");
const validate = require("../../middleware/validate");
const { PERMISSIONS } = require("../../constants/rbac");
const UserController = require("../../controllers/UserController");
const {
  createUserSchema,
  updateUserSchema,
  listUsersQuerySchema,
} = require("../../validations/users");

const router = express.Router();

// ─── Shared resource access for User management ─────────────────────────────
// Manager chỉ có toàn quyền trên nhân viên cùng phòng ban (department-based)
// VD: Phòng CSKH có 2 Manager → cả 2 đều quản lý được tất cả STAFF phòng CSKH
const userResourceAccess = requireResourceAccess({
  // Helpers
  getResource: (req) => User.findOne({ id: req.params.id }),
  getCreatorId: (targetUser) => targetUser.createdBy,
  getTargetUserId: (targetUser) => targetUser.id, // Check: target user IS subordinate?

  // Hành vi (Behaviors)
  allowCreator: true,
  allowManagerSubordinateCreator: true,
  allowManagerSubordinateTarget: true,
  allowUnassigned: false,
});

router.get(
  "/org-options",
  UserController.getOrgOptions,
);

router.get(
  "/",
  validate(listUsersQuerySchema, "query"),
  scopeAssignmentList({
    // Hành vi: Cho phép Manager nhìn thấy nhân viên cấp dưới
    allowManagerSubordinateScope: true,
  }),
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
  requireRole(['OWNER', 'ADMIN']),
  requirePermission(PERMISSIONS.USER_RESTORE),
  UserController.restoreUser,
);

router.delete(
  "/:id/permanent",
  requireRole(['OWNER', 'ADMIN']),
  requirePermission(PERMISSIONS.PERMANENT_DELETE),
  UserController.permanentDeleteUser,
);

module.exports = router;
