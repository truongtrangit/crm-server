const { USER_ROLE_VALUES } = require("../constants/appData");

const ROLE_ALIASES = {
  owner: USER_ROLE_VALUES.OWNER,
  admin: USER_ROLE_VALUES.ADMIN,
  manager: USER_ROLE_VALUES.MANAGER,
  staff: USER_ROLE_VALUES.STAFF,
  director: USER_ROLE_VALUES.OWNER,
  ceo: USER_ROLE_VALUES.OWNER,
  "giam doc": USER_ROLE_VALUES.OWNER,
  "giám đốc": USER_ROLE_VALUES.OWNER,
  "truong phong": USER_ROLE_VALUES.MANAGER,
  "trưởng phòng": USER_ROLE_VALUES.MANAGER,
  "nhan vien": USER_ROLE_VALUES.STAFF,
  "nhân viên": USER_ROLE_VALUES.STAFF,
};

function normalizeRoleKey(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizeUserRole(value, fallback = null) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (Object.values(USER_ROLE_VALUES).includes(value)) {
    return value;
  }

  return ROLE_ALIASES[normalizeRoleKey(value)] || null;
}

function isWithinManagerScope(manager, payload) {
  let targetDeptAliases = [];
  let targetGroupAliases = [];

  if (Array.isArray(payload)) {
    targetDeptAliases = payload.map(a => a.deptAlias || a).filter(Boolean);
    targetGroupAliases = payload.flatMap(a => a.groups?.map(g => g.groupAlias || g) || []).filter(Boolean);
  } else if (payload) {
    targetDeptAliases = Array.isArray(payload.departmentAliases)
      ? payload.departmentAliases
      : Array.isArray(payload.departments)
      ? payload.departments.map(d => d.deptAlias || d)
      : [];
    targetGroupAliases = Array.isArray(payload.groupAliases)
      ? payload.groupAliases
      : Array.isArray(payload.groups)
      ? payload.groups.map(g => g.groupAlias || g)
      : [];
  }

  let managerDeptAliases = [];
  if (Array.isArray(manager.departments)) {
    const managerLeadDepts = manager.departments.filter(d => d.role === "lead").map(d => d.deptAlias);
    managerDeptAliases = managerLeadDepts.length > 0
      ? managerLeadDepts
      : manager.departments.map(d => d.deptAlias);
  }

  const isDepartmentAllowed = targetDeptAliases.every((item) =>
    managerDeptAliases.includes(item),
  );

  const isGroupAllowed = targetGroupAliases.every((groupAlias) =>
    managerDeptAliases.some(
      (deptAlias) =>
        groupAlias === deptAlias || groupAlias.startsWith(deptAlias + "__"),
    ),
  );

  return isDepartmentAllowed && isGroupAllowed;
}

function isOwnerOrAdmin(userOrRole) {
  if (!userOrRole) return false;
  
  let roleStr = "";
  if (typeof userOrRole === "string") {
    roleStr = userOrRole;
  } else if (userOrRole.roleId) {
    roleStr = userOrRole.roleId;
  } else if (userOrRole.role?.name) {
    roleStr = userOrRole.role.name;
  }
  
  return [USER_ROLE_VALUES.OWNER, USER_ROLE_VALUES.ADMIN].includes(roleStr.toUpperCase());
}

module.exports = {
  isWithinManagerScope,
  normalizeUserRole,
  isOwnerOrAdmin,
};
