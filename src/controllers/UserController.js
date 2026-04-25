const {
  createUserAccount,
  deleteUserAccount,
  getUserForStaffApi,
  listUsers,
  restoreUserAccount,
  updateUserAccount,
} = require("../services/UserService");
const User = require("../models/User");
const Organization = require("../models/Organization");
const { getUserRoleName } = require("../utils/rbac");
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
    const force = req.query.force === 'true';
    await deleteUserAccount(req.user, user, { force });
    return sendSuccess(res, 200, "Delete staff success", null);
  }

  async restoreUser(req, res) {
    const user = await restoreUserAccount(req.user, req.params.id);
    return sendSuccess(res, 200, "Restore staff success", user);
  }

  /**
   * GET /api/v1/users/org-options
   * Trả về danh sách phòng ban + nhóm từ Organization collection.
   *
   *   Owner/Admin → toàn bộ org (tất cả phòng ban + nhóm trong DB)
   *   Manager     → chỉ phòng ban/nhóm mà bản thân thuộc vào (từ User.department/group)
   *   Staff       → trả về [] (không có quyền filter theo org)
   *
   * Organization schema: { parent: "Phòng Sale", children: [{ name: "Nhóm Sale HN" }] }
   */
  async getOrgOptions(req, res) {
    const roleName = await getUserRoleName(req.user);
    const isAdminOrOwner = ["OWNER", "ADMIN"].includes(roleName);
    const isManager = roleName === "MANAGER";

    if (!isAdminOrOwner && !isManager) {
      return sendSuccess(res, 200, "Org options", { departments: [], groups: [] });
    }

    if (isAdminOrOwner) {
      // Lấy toàn bộ org structure từ DB
      const orgs = await Organization.find({}).select("parent children");
      const departments = orgs.map((o) => o.parent).sort();
      const groups = orgs.flatMap((o) => o.children.map((c) => c.name)).sort();
      return sendSuccess(res, 200, "Org options", { departments, groups });
    }

    // Manager: chỉ trả về phòng ban/nhóm mà họ thực sự thuộc vào
    const self = await User.findOne({ id: req.user.id }).select("department group");
    const departments = (self?.department || []).sort();
    const groups = (self?.group || []).sort();
    return sendSuccess(res, 200, "Org options", { departments, groups });
  }
}

module.exports = new UserController();
