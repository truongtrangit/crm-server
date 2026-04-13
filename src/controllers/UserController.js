const {
  createUserAccount,
  deleteUserAccount,
  getUserForStaffApi,
  listUsers,
  updateUserAccount,
} = require("../services/UserService");
const { sendSuccess } = require("../utils/http");

class UserController {
  async listUsers(req, res) {
    const staff = await listUsers(req.user, req.query || {});
    return sendSuccess(res, 200, "Get staff list success", staff);
  }

  async createUser(req, res) {
    const staff = await createUserAccount(req.user, req.body || {});
    return sendSuccess(res, 201, "Create staff success", staff);
  }

  async updateUser(req, res) {
    const user = await getUserForStaffApi(req.user, req.params.id);
    const staff = await updateUserAccount(req.user, user, req.body || {});
    return sendSuccess(res, 200, "Update staff success", staff);
  }

  async deleteUser(req, res) {
    const user = await getUserForStaffApi(req.user, req.params.id);
    await deleteUserAccount(req.user, user);
    return sendSuccess(res, 200, "Delete staff success", null);
  }
}

module.exports = new UserController();
