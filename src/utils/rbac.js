const Role = require("../models/Role");

function getPermissionVariants(permission) {
  if (!permission || typeof permission !== "string") {
    return [];
  }

  const [resource, action] = permission.split("_");

  if (!resource || !action) {
    return [permission];
  }

  if (action === "manage") {
    return [permission];
  }

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
  if (!user) {
    return null;
  }

  if (user.roleId) {
    const roleById = await Role.findOne({ id: user.roleId });

    if (roleById) {
      return roleById;
    }
  }

  if (user.role) {
    return Role.findOne({ name: String(user.role).trim().toUpperCase() });
  }

  return null;
}

/**
 * Check if user has a specific permission
 */
async function hasPermission(user, permission) {
  if (!user || !permission) {
    return false;
  }

  // If user has the permission directly
  if (permissionListIncludes(user.permissions || [], permission)) {
    return true;
  }

  // Check if user's role has the permission
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
  const permissions = new Set(user.permissions || []);

  const role = await resolveUserRole(user);

  if (role && role.permissions) {
    role.permissions.forEach((p) => permissions.add(p));
  }

  return Array.from(permissions);
}

module.exports = {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  getUserRoleWithPermissions,
  getUserPermissions,
  getUserRoleName,
  getUserRoleLevel,
};
