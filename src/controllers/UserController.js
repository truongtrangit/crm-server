const {
  createUserAccount,
  deleteUserAccount,
  getUserForStaffApi,
  listUsers,
  permanentDeleteUserAccount,
  restoreUserAccount,
  updateUserAccount,
  getOrgOptions,
} = require("../services/UserService");
const User = require("../models/User");
const { sendSuccess } = require("../utils/http");
const SystemLogService = require("../services/SystemLogService");
const { RESOURCES } = require("../constants/rbac");

class UserController {
  async listUsers(req, res) {
    const staff = await listUsers(req.user, req.query || {});
    return sendSuccess(res, 200, "Get staff list success", staff);
  }

  async createUser(req, res) {
    const staff = await createUserAccount(req.user, req.body || {});
    SystemLogService.log({ action: "create", resource: RESOURCES.USERS, resourceId: staff.id, resourceName: staff.name, description: `Tạo nhân viên "${staff.name}"`, req });
    return sendSuccess(res, 201, "Create staff success", staff);
  }

  async updateUser(req, res) {
    const user = await getUserForStaffApi(req.user, req.params.id);
    const { user: staff, changes } = await updateUserAccount(req.user, user, req.body || {});
    SystemLogService.log({ action: "update", resource: RESOURCES.USERS, resourceId: req.params.id, resourceName: staff.name, description: `Cập nhật nhân viên "${staff.name}"`, metadata: { changes }, req });
    return sendSuccess(res, 200, "Update staff success", staff);
  }

  async deleteUser(req, res) {
    const user = await getUserForStaffApi(req.user, req.params.id);
    const force = req.query.force === 'true';
    const deletedUser = await deleteUserAccount(req.user, user, { force });
    SystemLogService.log({ action: force ? "force_delete" : "delete", resource: RESOURCES.USERS, resourceId: req.params.id, resourceName: deletedUser.name, description: `${force ? 'Xóa vĩnh viễn' : 'Xóa'} nhân viên "${deletedUser.name}"`, metadata: { deletedItem: deletedUser }, req });
    return sendSuccess(res, 200, "Delete staff success", null);
  }

  async restoreUser(req, res) {
    const user = await restoreUserAccount(req.user, req.params.id);
    SystemLogService.log({ action: "restore", resource: RESOURCES.USERS, resourceId: req.params.id, resourceName: user.name, description: `Khôi phục nhân viên "${user.name}"`, req });
    return sendSuccess(res, 200, "Restore staff success", user);
  }

  async permanentDeleteUser(req, res) {
    const deletedUser = await permanentDeleteUserAccount(req.user, req.params.id);
    SystemLogService.log({ action: "force_delete", resource: RESOURCES.USERS, resourceId: req.params.id, resourceName: deletedUser.name, description: `Xóa vĩnh viễn nhân viên "${deletedUser.name}"`, metadata: { deletedItem: deletedUser }, req });
    return sendSuccess(res, 200, "Permanent delete staff success", null);
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
    const options = await getOrgOptions(req.user);
    return sendSuccess(res, 200, "Org options", options);
  }
}

module.exports = new UserController();
