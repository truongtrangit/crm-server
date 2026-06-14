const User = require('../../modules/system/user/user.model');
const CacheService = require('../services/CacheService');
const { CACHE_TTL } = require('../constants/cache');

/**
 * Lấy danh sách phòng ban (departmentAliases) của user.
 * Fallback về department nếu departmentAliases rỗng.
 */
function getUserDepartments(user) {
  if (!user) return [];
  if (Array.isArray(user.departments) && user.departments.length > 0) {
    return [...new Set(user.departments.map(d => d.deptAlias).filter(Boolean))];
  }
  if (Array.isArray(user.departmentAliases) && user.departmentAliases.length > 0) {
    return user.departmentAliases;
  }
  return Array.isArray(user.department) ? user.department : [];
}

/**
 * Kiểm tra xem user có đóng vai trò Quản lý (Manager/Lead) hay không.
 */
function isUserManagerial(user) {
  if (!user) return false;

  if (Array.isArray(user.departments) && user.departments.length > 0) {
    const isDeptLead = user.departments.some(d => d.role === "lead");
    const isGroupLead = (user.groups || []).some(g => g.role === "lead");
    return isDeptLead || isGroupLead || (user.roleId || "").toUpperCase() === "MANAGER";
  }

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
 */
async function getManagerSubordinateIds(manager) {
  if (!manager || !manager.id) return [];

  let leadDepts = [];
  let leadGroups = [];

  if (Array.isArray(manager.departments) && manager.departments.length > 0) {
    leadDepts = manager.departments.filter(d => d.role === "lead").map(d => d.deptAlias);
    leadGroups = (manager.groups || []).filter(g => g.role === "lead").map(g => g.groupAlias);
    if (leadDepts.length === 0 && leadGroups.length === 0 && (manager.roleId || "").toUpperCase() === "MANAGER") {
      leadDepts = getUserDepartments(manager);
    }
  } else {
    const hasNewRoles = (manager.departmentRoles && Object.keys(manager.departmentRoles).length > 0) ||
      (manager.groupRoles && Object.keys(manager.groupRoles).length > 0);

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
  }

  if (leadDepts.length === 0 && leadGroups.length === 0) {
    return [];
  }

  return await CacheService.withVersionedCache(
    "users",
    { op: "manager_subordinate_ids", managerId: manager.id, leadDepts, leadGroups },
    CACHE_TTL.MEDIUM,
    async () => {
      const orConditions = [];
      if (leadDepts.length > 0) {
        orConditions.push({ "departments.deptAlias": { $in: leadDepts } });
      }
      if (leadGroups.length > 0) {
        orConditions.push({ "groups.groupAlias": { $in: leadGroups } });
      }

      const query = {
        $and: [
          { $or: orConditions },
          { id: { $ne: manager.id } },
        ]
      };

      const subordinates = await User.find(query).lean();

      const filtered = subordinates.filter(sub => {
        let isSubordinateInSomeDomain = false;

        for (const dept of leadDepts) {
          const inDept = Array.isArray(sub.departments)
            ? sub.departments.some(d => d.deptAlias === dept)
            : (sub.departmentAliases || sub.department || []).includes(dept);

          if (inDept) {
            const isLead = (Array.isArray(sub.departments) && sub.departments.some(d => d.deptAlias === dept && d.role === 'lead')) ||
              (sub.departmentRoles && sub.departmentRoles[dept] === 'lead');
            if (!isLead) {
              isSubordinateInSomeDomain = true;
              break;
            }
          }
        }

        if (!isSubordinateInSomeDomain) {
          for (const group of leadGroups) {
            const inGroup = Array.isArray(sub.groups)
              ? sub.groups.some(g => g.groupAlias === group)
              : (sub.groupAliases || []).includes(group);

            if (inGroup) {
              const isLead = (Array.isArray(sub.groups) && sub.groups.some(g => g.groupAlias === group && g.role === 'lead')) ||
                (sub.groupRoles && sub.groupRoles[group] === 'lead');
              if (!isLead) {
                isSubordinateInSomeDomain = true;
                break;
              }
            }
          }
        }

        return isSubordinateInSomeDomain;
      });
      return filtered.map((u) => u.id);
    }
  );
}

module.exports = { getUserDepartments, getManagerSubordinateIds, isUserManagerial };
