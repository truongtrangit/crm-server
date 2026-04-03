const {
  DEFAULT_USER_ROLE,
  USER_ROLES,
  USER_ROLE_VALUES,
} = require("../constants/appData");

const ROLE_RANK = {
  [USER_ROLE_VALUES.STAFF]: 1,
  [USER_ROLE_VALUES.MANAGER]: 2,
  [USER_ROLE_VALUES.ADMIN]: 3,
  [USER_ROLE_VALUES.OWNER]: 4,
};

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

function getUserRoleLabel(role) {
  return USER_ROLES.find((item) => item.value === role)?.label || role;
}

function getUserRoleRank(role) {
  return ROLE_RANK[role] || 0;
}

function canAccessStaffApi(role) {
  return role !== USER_ROLE_VALUES.STAFF;
}

function canCreateRole(actorRole, targetRole) {
  if (actorRole === USER_ROLE_VALUES.OWNER) {
    return [
      USER_ROLE_VALUES.ADMIN,
      USER_ROLE_VALUES.MANAGER,
      USER_ROLE_VALUES.STAFF,
    ].includes(targetRole);
  }

  if (actorRole === USER_ROLE_VALUES.ADMIN) {
    return [USER_ROLE_VALUES.MANAGER, USER_ROLE_VALUES.STAFF].includes(
      targetRole,
    );
  }

  if (actorRole === USER_ROLE_VALUES.MANAGER) {
    return targetRole === USER_ROLE_VALUES.STAFF;
  }

  return false;
}

function canManageUser(actor, target, action = "update") {
  if (!actor || !target || actor.id === target.id) {
    return action === "view-self";
  }

  if (actor.role === USER_ROLE_VALUES.OWNER) {
    return target.role !== USER_ROLE_VALUES.OWNER;
  }

  if (actor.role === USER_ROLE_VALUES.ADMIN) {
    return [USER_ROLE_VALUES.MANAGER, USER_ROLE_VALUES.STAFF].includes(
      target.role,
    );
  }

  if (actor.role === USER_ROLE_VALUES.MANAGER) {
    return (
      target.role === USER_ROLE_VALUES.STAFF && target.managerId === actor.id
    );
  }

  return false;
}

function isWithinManagerScope(manager, payload) {
  const departments = Array.isArray(payload.department)
    ? payload.department
    : [];
  const groups = Array.isArray(payload.group) ? payload.group : [];
  const managerDepartments = Array.isArray(manager.department)
    ? manager.department
    : [];
  const managerGroups = Array.isArray(manager.group) ? manager.group : [];

  const isDepartmentAllowed = departments.every((item) =>
    managerDepartments.includes(item),
  );
  const isGroupAllowed = groups.every((item) => managerGroups.includes(item));

  return isDepartmentAllowed && isGroupAllowed;
}

module.exports = {
  DEFAULT_USER_ROLE,
  USER_ROLE_VALUES,
  canAccessStaffApi,
  canCreateRole,
  canManageUser,
  getUserRoleLabel,
  getUserRoleRank,
  isWithinManagerScope,
  normalizeUserRole,
};
