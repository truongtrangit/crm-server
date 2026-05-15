const User = require("../models/User");
const CacheService = require("../services/CacheService");
const { CACHE_TTL } = require("../constants/cache");

/**
 * Lấy danh sách phòng ban (departmentAliases) của user.
 * Fallback về department nếu departmentAliases rỗng.
 */
function getUserDepartments(user) {
  if (Array.isArray(user.departmentAliases) && user.departmentAliases.length > 0) {
    return user.departmentAliases;
  }
  return Array.isArray(user.department) ? user.department : [];
}

/**
 * Lấy danh sách subordinate IDs của một Manager.
 *
 * Logic — hoàn toàn dựa trên department:
 *   Tất cả user cùng phòng ban (departmentAliases overlap) VÀ có role STAFF
 *   → Phòng CSKH có 2 Manager A và B, cả 2 đều có quyền trên tất cả STAFF phòng CSKH
 *
 * Lưu ý: MANAGER cùng phòng KHÔNG bị coi là subordinate (filter roleId: "staff").
 *
 * Trả về: string[] — mảng user.id (đã deduplicate)
 *
 * @param {Object} manager - User document của Manager
 * @returns {Promise<string[]>}
 */
async function getManagerSubordinateIds(manager) {
  if (!manager || !manager.id) return [];

  const managerDepts = getUserDepartments(manager);

  if (managerDepts.length === 0) {
    // Manager chưa gán phòng ban → không có subordinate
    return [];
  }

  return await CacheService.withVersionedCache(
    "users",
    { op: "manager_subordinate_ids", managerId: manager.id, managerDepts },
    CACHE_TTL.MEDIUM, // tự động bị vô hiệu khi namespace 'users' bumped (ví dụ khi có thay đổi user)
    async () => {
      const subordinates = await User.find({
        $and: [
          {
            $or: [
              { departmentAliases: { $in: managerDepts } },
              { department: { $in: managerDepts } },
            ],
          },
          { roleId: "staff" }, // Chỉ STAFF — không bao gồm MANAGER cùng phòng
          { id: { $ne: manager.id } }, // Loại trừ chính mình
        ],
      })
        .select("id")
        .lean();

      return subordinates.map((u) => u.id);
    }
  );
}

module.exports = { getManagerSubordinateIds, getUserDepartments };
