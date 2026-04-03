const express = require("express");
const {
  createUserAccount,
  deleteUserAccount,
  getUserForStaffApi,
  listUsers,
  updateUserAccount,
} = require("../services/userManagement");
const { authenticateRequest, authorizeRoles } = require("../middleware/auth");
const { USER_ROLE_VALUES } = require("../constants/appData");
const { sendSuccess } = require("../utils/http");

const router = express.Router();

router.use(authenticateRequest);
router.use(
  authorizeRoles(
    USER_ROLE_VALUES.OWNER,
    USER_ROLE_VALUES.ADMIN,
    USER_ROLE_VALUES.MANAGER,
  ),
);

router.get("/", async (req, res) => {
  const staff = await listUsers(req.user, req.query || {});
  return sendSuccess(res, 200, "Get staff list success", staff);
});

router.post("/", async (req, res) => {
  const staff = await createUserAccount(req.user, req.body || {});
  return sendSuccess(res, 201, "Create staff success", staff);
});

router.put("/:id", async (req, res) => {
  const user = await getUserForStaffApi(req.user, req.params.id);
  const staff = await updateUserAccount(req.user, user, req.body || {});
  return sendSuccess(res, 200, "Update staff success", staff);
});

router.delete("/:id", async (req, res) => {
  const user = await getUserForStaffApi(req.user, req.params.id);
  await deleteUserAccount(req.user, user);

  return sendSuccess(res, 200, "Delete staff success", null);
});

module.exports = router;
