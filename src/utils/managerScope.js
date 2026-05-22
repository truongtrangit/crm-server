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
 * Kiểm tra xem user có đóng vai trò Quản lý (Manager/Lead) hay không.
 * Nếu dùng cơ chế mới (departmentRoles/groupRoles), user phải là "lead" của ít nhất 1 phòng ban/nhóm.
 * Nếu không, fallback về kiểm tra roleId === "MANAGER".
 */
function isUserManagerial(user) {
  if (!user) return false;

  const hasNewRoles = (user.departmentRoles && Object.keys(user.departmentRoles).length > 0) ||
    (user.groupRoles && Object.keys(user.groupRoles).length > 0);

  if (hasNewRoles) {
    const isDeptLead = Object.values(user.departmentRoles || {}).includes("lead");
    const isGroupLead = Object.values(user.groupRoles || {}).includes("lead");
    return isDeptLead || isGroupLead;
  }

  return (user.roleId || "").toUpperCase() === "MANAGER";
}

/**
 * Lấy danh sách subordinate IDs của một Quản lý (Manager/Lead).
 *
 * Logic mới:
 *   - Lấy tất cả phòng ban và nhóm mà user làm "lead".
 *   - Tìm các user có department/group tương ứng.
 * 
 * Logic cũ (fallback):
 *   - Tìm các user có roleId="staff" và nằm trong department của Manager.
 *
 * @param {Object} manager - User document của Quản lý
 * @returns {Promise<string[]>}
 */
async function getManagerSubordinateIds(manager) {
  if (!manager || !manager.id) return [];

  const hasNewRoles = (manager.departmentRoles && Object.keys(manager.departmentRoles).length > 0) ||
    (manager.groupRoles && Object.keys(manager.groupRoles).length > 0);

  let leadDepts = [];
  let leadGroups = [];

  if (hasNewRoles) {
    if (manager.departmentRoles) {
      leadDepts = Object.keys(manager.departmentRoles).filter(dept => manager.departmentRoles[dept] === "lead");
    }
    if (manager.groupRoles) {
      leadGroups = Object.keys(manager.groupRoles).filter(group => manager.groupRoles[group] === "lead");
    }
  } else {
    if ((manager.roleId || "").toUpperCase() === "MANAGER") {
      leadDepts = getUserDepartments(manager);
    }
  }

  if (leadDepts.length === 0 && leadGroups.length === 0) {
    return [];
  }

  return await CacheService.withVersionedCache(
    "users",
    { op: "manager_subordinate_ids", managerId: manager.id, leadDepts, leadGroups, fallback: !hasNewRoles },
    CACHE_TTL.MEDIUM,
    async () => {
      const orConditions = [];
      if (leadDepts.length > 0) {
        orConditions.push({ departmentAliases: { $in: leadDepts } });
        orConditions.push({ department: { $in: leadDepts } });
      }
      if (leadGroups.length > 0) {
        orConditions.push({ groupAliases: { $in: leadGroups } });
        orConditions.push({ group: { $in: leadGroups } });
      }

      const query = {
        $and: [
          { $or: orConditions },
          { id: { $ne: manager.id } },
        ]
      };

      if (!hasNewRoles) {
        query.$and.push({ roleId: "staff" }); // Tương thích ngược: chỉ lấy nhân viên STAFF
      }

      const subordinates = await User.find(query).select("id").lean();
      return subordinates.map((u) => u.id);
    }
  );
}

module.exports = { getUserDepartments, getManagerSubordinateIds, isUserManagerial };
