const express = require("express");
const {
  createUserAccount,
  deleteUserAccount,
  getUserForStaffApi,
  listUsers,
  updateUserAccount,
} = require("../services/userManagement");
const {
  authenticateRequest,
  requirePermission,
} = require("../middleware/auth");
const { PERMISSIONS } = require("../constants/rbac");
const { sendSuccess } = require("../utils/http");

const router = express.Router();

/**
 * GET /api/users
 * List all users - requires users read permission
 */
router.get("/", requirePermission(PERMISSIONS.USERS_READ), async (req, res) => {
  const staff = await listUsers(req.user, req.query || {});
  return sendSuccess(res, 200, "Get staff list success", staff);
});

/**
 * POST /api/users
 * Create new user - requires users create permission
 */
router.post(
  "/",
  requirePermission(PERMISSIONS.USERS_CREATE),
  async (req, res) => {
    const staff = await createUserAccount(req.user, req.body || {});
    return sendSuccess(res, 201, "Create staff success", staff);
  },
);

/**
 * PUT /api/users/:id
 * Update user - requires users update permission
 */
router.put(
  "/:id",
  requirePermission(PERMISSIONS.USERS_UPDATE),
  async (req, res) => {
    const user = await getUserForStaffApi(req.user, req.params.id);
    const staff = await updateUserAccount(req.user, user, req.body || {});
    return sendSuccess(res, 200, "Update staff success", staff);
  },
);

/**
 * DELETE /api/users/:id
 * Delete user - requires users delete permission
 */
router.delete(
  "/:id",
  requirePermission(PERMISSIONS.USERS_DELETE),
  async (req, res) => {
    const user = await getUserForStaffApi(req.user, req.params.id);
    await deleteUserAccount(req.user, user);

    return sendSuccess(res, 200, "Delete staff success", null);
  },
);

module.exports = router;
