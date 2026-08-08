const CacheService = require('../services/CacheService');
const Role = require('../../modules/system/rbac/role.model');
const env = require('../config/env');
const { isOwnerOrAdmin } = require('./userRoles');
const { USER_ROLE_VALUES } = require('../constants/appData');

// Constants for default module access
const MANAGER_EXCLUDED_MODULES = ["logs"];
const STAFF_ALLOWED_MODULES = ["customers", "operations", "meta"];

function getPermissionVariants(permission) {
  if (!permission || typeof permission !== "string") {
    return [];
  }

  // Tách theo dấu _ CUỐI CÙNG để xử lý đúng các permission
  // có nhiều segment như "actions_cfg_read", "event_chains_read"
  const lastUnderscore = permission.lastIndexOf("_");
  if (lastUnderscore === -1) {
    return [permission];
  }

  const resource = permission.slice(0, lastUnderscore); // "actions_cfg"
  const action = permission.slice(lastUnderscore + 1); // "read"

  if (action === "manage") {
    return [permission];
  }

  // Nếu có _manage thì cũng được coi là đủ quyền
  return [permission, `${resource}_manage`];
}

function permissionListIncludes(permissionList, permission) {
  const permissionSet =
    permissionList instanceof Set
      ? permissionList
      : new Set(permissionList || []);

  return getPermissionVariants(permission).some((item) =>
    permissionSet.has(item),
  );
}

async function resolveUserRole(user) {
  if (!user || !user.roleId) {
    return null;
  }

  const cacheKey = `rbac:role:${user.roleId}`;

  // 1. Đọc từ Redis Cache
  let role = await CacheService.get(cacheKey);

  if (role) {
    return role;
  }

  // 2. Cache miss -> Lấy từ MongoDB
  role = await Role.findOne({ id: user.roleId }).lean();

  if (!role) {
    const { ROLE_DEFINITIONS } = require('../constants/rbac');
    const roleKey = String(user.roleId).toUpperCase();
    if (ROLE_DEFINITIONS[roleKey]) {
      role = ROLE_DEFINITIONS[roleKey];
    }
  }

  if (role) {
    await CacheService.set(cacheKey, role, env.cacheRoleTtlSeconds);
  }

  return role;
}

/**
 * Check if user has a specific permission
 */
async function hasPermission(user, permission) {
  if (!user || !permission) {
    return false;
  }

  // OWNER luôn có tất cả quyền mà không phụ thuộc DB/Cache
  if (user.roleId && String(user.roleId).toUpperCase() === 'OWNER') {
    return true;
  }

  // 1. Kiểm tra custom permissions gán riêng cho user (nếu có)
  if (Array.isArray(user.permissions) && user.permissions.length > 0) {
    if (permissionListIncludes(user.permissions, permission)) {
      return true;
    }
  }

  // 2. Check permissions thuộc Role của user
  const role = await resolveUserRole(user);

  if (role && permissionListIncludes(role.permissions || [], permission)) {
    return true;
  }

  return false;
}

/**
 * Check if user has ANY of the provided permissions
 */
async function hasAnyPermission(user, permissionsList) {
  if (!user || !permissionsList || permissionsList.length === 0) {
    return false;
  }

  for (const permission of permissionsList) {
    if (await hasPermission(user, permission)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if user has ALL of the provided permissions
 */
async function hasAllPermissions(user, permissionsList) {
  if (!user || !permissionsList || permissionsList.length === 0) {
    return false;
  }

  for (const permission of permissionsList) {
    if (!(await hasPermission(user, permission))) {
      return false;
    }
  }

  return true;
}

/**
 * Get user role with permissions
 */
async function getUserRoleWithPermissions(user) {
  return resolveUserRole(user);
}

async function getUserRoleName(user) {
  const role = await getUserRoleWithPermissions(user);
  return role ? role.name : null;
}

async function getUserRoleLevel(user) {
  const role = await getUserRoleWithPermissions(user);
  return role ? role.level || 0 : 0;
}

/**
 * Get all permissions of a user
 */
async function getUserPermissions(user) {
  if (Array.isArray(user.permissions) && user.permissions.length > 0) {
    return user.permissions;
  }

  const permissions = new Set();
  const role = await resolveUserRole(user);

  if (role && role.permissions) {
    role.permissions.forEach((p) => permissions.add(p));
  }

  return Array.from(permissions);
}

/**
 * Kiểm tra xem user có quyền truy cập vào một module cụ thể hay không.
 * Nếu không cấu hình rõ (moduleAccess rỗng), dùng cấu hình mặc định:
 * OWNER, ADMIN -> true
 * MANAGER -> true trừ logs
 * STAFF -> true cho customers, operations, meta
 */
async function hasModuleAccess(user, moduleId) {
  if (!user) return false;

  if (isOwnerOrAdmin(user)) return true;

  const role = await getUserRoleName(user);
  const roleUpper = (role || "").toUpperCase();

  const rootModule = moduleId.split(".")[0];
  let defaultAllowed = false;

  switch (roleUpper) {
    case USER_ROLE_VALUES.MANAGER:
      defaultAllowed = !MANAGER_EXCLUDED_MODULES.includes(rootModule);
      break;
    case USER_ROLE_VALUES.STAFF:
      defaultAllowed = STAFF_ALLOWED_MODULES.includes(rootModule);
      break;
  }

  const entries = user.moduleAccess || [];
  if (entries.length === 0) {
    return defaultAllowed;
  }

  // Check explicit settings
  return entries.some(
    (e) =>
      e.isEnabled &&
      (e.moduleId === moduleId || e.moduleId.startsWith(moduleId + ".")),
  );
}

module.exports = {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  getUserRoleWithPermissions,
  getUserPermissions,
  getUserRoleName,
  getUserRoleLevel,
  hasModuleAccess,
};
