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
  const departments = Array.isArray(payload.departmentAliases)
    ? payload.departmentAliases
    : Array.isArray(payload.department)
      ? payload.department
      : [];
  const groups = Array.isArray(payload.groupAliases)
    ? payload.groupAliases
    : Array.isArray(payload.group)
      ? payload.group
      : [];
  const managerDepartments = Array.isArray(manager.departmentAliases)
    ? manager.departmentAliases
    : Array.isArray(manager.department)
      ? manager.department
      : [];
  const managerGroups = Array.isArray(manager.groupAliases)
    ? manager.groupAliases
    : Array.isArray(manager.group)
      ? manager.group
      : [];

  const isDepartmentAllowed = departments.every((item) =>
    managerDepartments.includes(item),
  );
  const isGroupAllowed = groups.every((item) => managerGroups.includes(item));

  return isDepartmentAllowed && isGroupAllowed;
}

module.exports = {
  isWithinManagerScope,
  normalizeUserRole,
};
