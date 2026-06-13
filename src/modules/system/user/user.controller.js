const {
  createUserAccount,
  deleteUserAccount,
  listUsers,
  permanentDeleteUserAccount,
  restoreUserAccount,
  updateUserAccount,
  getOrgOptions,
} = require('./user.service');
const User = require('./user.model');
const CacheService = require('../../../core/services/CacheService');
const { sendSuccess } = require('../../../core/utils/http');
const SystemLogService = require('../log/systemLog.service');
const { RESOURCES } = require('../../../core/constants/rbac');
const { pickFields } = require('../../../core/utils/object');
const { formatChangesText } = require('../../../core/utils/diff');

const USER_FIELD_LABELS = {
  name: "Tên",
  email: "Email",
  avatar: "Ảnh đại diện",
  companies: "Công ty",
  phone: "Số điện thoại",
  roleId: "Vai trò",
  isActive: "Trạng thái hoạt động",
  functionalGroups: "Khối chức năng",
  functions: "Chức năng",
  departments: "Phòng ban",
  groups: "Nhóm",
  moduleAccess: "Quyền truy cập module",
};

class UserController {
  async listUsers(req, res) {
    const result = await listUsers(
      req.user,
      req.scopedUserIds,
      req.query || {},
    );

    if (req.scopedFields && result && Array.isArray(result.items)) {
      result.items = result.items.map((u) => pickFields(u, req.scopedFields));
    }

    return sendSuccess(res, 200, "Get staff list success", result);
  }

  async createUser(req, res) {
    const staff = await createUserAccount(req.user, req.body || {});
    SystemLogService.log({
      action: "create",
      resource: RESOURCES.USERS,
      resourceId: staff.id,
      resourceName: staff.name,
      description: `Tạo nhân viên "${staff.name}"`,
      metadata: { newItem: staff },
      req,
    });
    return sendSuccess(res, 201, "Create staff success", staff);
  }

  async updateUser(req, res) {
    const { user: staff, changes } = await updateUserAccount(
      req.user,
      req.resource,
      req.body || {},
    );
    const changesText = formatChangesText(changes, USER_FIELD_LABELS);
    SystemLogService.log({
      action: "update",
      resource: RESOURCES.USERS,
      resourceId: req.params.id,
      resourceName: staff.name,
      description: `Cập nhật nhân viên "${staff.name}"${changesText}`,
      metadata: { changes },
      req,
    });
    return sendSuccess(res, 200, "Update staff success", staff);
  }

  async deleteUser(req, res) {
    const force = req.query.force === "true";
    const deletedUser = await deleteUserAccount(req.user, req.resource, {
      force,
    });
    SystemLogService.log({
      action: force ? "force_delete" : "delete",
      resource: RESOURCES.USERS,
      resourceId: req.params.id,
      resourceName: deletedUser.name,
      description: `${force ? "Xóa vĩnh viễn" : "Xóa"} nhân viên "${deletedUser.name}"`,
      metadata: { deletedItem: deletedUser },
      req,
    });
    return sendSuccess(res, 200, "Delete staff success", null);
  }

  async restoreUser(req, res) {
    const user = await restoreUserAccount(req.user, req.params.id);
    SystemLogService.log({
      action: "restore",
      resource: RESOURCES.USERS,
      resourceId: req.params.id,
      resourceName: user.name,
      description: `Khôi phục nhân viên "${user.name}"`,
      req,
    });
    return sendSuccess(res, 200, "Restore staff success", user);
  }

  async permanentDeleteUser(req, res) {
    const deletedUser = await permanentDeleteUserAccount(
      req.user,
      req.params.id,
    );
    SystemLogService.log({
      action: "force_delete",
      resource: RESOURCES.USERS,
      resourceId: req.params.id,
      resourceName: deletedUser.name,
      description: `Xóa vĩnh viễn nhân viên "${deletedUser.name}"`,
      metadata: { deletedItem: deletedUser },
      req,
    });
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
