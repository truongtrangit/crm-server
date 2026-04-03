const User = require("../models/User");
const { generateSequentialId } = require("../utils/id");
const { buildSearchRegex } = require("../utils/query");
const { hashPassword } = require("../utils/auth");
const { createHttpError } = require("../utils/http");
const {
  buildPaginatedResponse,
  resolvePagination,
} = require("../utils/pagination");
const {
  DEFAULT_USER_ROLE,
  USER_ROLE_VALUES,
  canAccessStaffApi,
  canCreateRole,
  canManageUser,
  getUserRoleLabel,
  isWithinManagerScope,
  normalizeUserRole,
} = require("../utils/userRoles");

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => normalizeString(item)).filter(Boolean);
}

function ensurePasswordStrength(password) {
  if (typeof password !== "string" || password.length < 8) {
    throw createHttpError(400, "password must be at least 8 characters");
  }
}

function ensureDepartmentByRole(role, department) {
  if (
    [USER_ROLE_VALUES.MANAGER, USER_ROLE_VALUES.STAFF].includes(role) &&
    department.length === 0
  ) {
    throw createHttpError(400, "department must contain at least one item");
  }
}

async function ensureManagerExists(managerId, department, group) {
  if (!managerId) {
    return null;
  }

  const manager = await User.findOne({ id: managerId }).lean();

  if (!manager || manager.role !== USER_ROLE_VALUES.MANAGER) {
    throw createHttpError(400, "managerId must reference a manager user");
  }

  if (!isWithinManagerScope(manager, { department, group })) {
    throw createHttpError(
      400,
      "department/group must belong to the assigned manager scope",
    );
  }

  return manager;
}

function serializeUser(user) {
  const item =
    typeof user.toObject === "function" ? user.toObject() : { ...user };

  delete item.passwordHash;
  delete item.sessions;

  return {
    ...item,
    roleLabel: getUserRoleLabel(item.role),
  };
}

function buildUserListQuery(actor, filters = {}) {
  if (!canAccessStaffApi(actor.role)) {
    throw createHttpError(
      403,
      "You do not have permission to access staff APIs",
    );
  }

  const { search = "", department, role, managerId } = filters;
  const searchRegex = buildSearchRegex(search);
  const query = {};

  if (searchRegex) {
    query.$or = [
      { name: searchRegex },
      { email: searchRegex },
      { phone: searchRegex },
    ];
  }

  if (department) {
    query.department = normalizeString(department);
  }

  if (role) {
    const normalizedRole = normalizeUserRole(role);

    if (!normalizedRole) {
      throw createHttpError(400, "role is invalid");
    }

    query.role = normalizedRole;
  }

  if (actor.role === USER_ROLE_VALUES.MANAGER) {
    query.managerId = actor.id;
  } else if (managerId) {
    query.managerId = normalizeString(managerId);
  }

  return query;
}

async function listUsers(actor, filters) {
  const query = buildUserListQuery(actor, filters);
  const { page, limit, skip } = resolvePagination(filters);
  const [users, totalItems] = await Promise.all([
    User.find(query).sort({ createdAt: -1, id: 1 }).skip(skip).limit(limit),
    User.countDocuments(query),
  ]);

  return buildPaginatedResponse(
    users.map(serializeUser),
    totalItems,
    page,
    limit,
  );
}

async function createUserAccount(actor, payload = {}) {
  if (!canAccessStaffApi(actor.role)) {
    throw createHttpError(403, "You do not have permission to create users");
  }

  const name = normalizeString(payload.name);
  const email = normalizeString(payload.email).toLowerCase();
  const password = typeof payload.password === "string" ? payload.password : "";
  const role = normalizeUserRole(payload.role, DEFAULT_USER_ROLE);
  const department = normalizeStringList(payload.department);
  const group = normalizeStringList(payload.group);

  if (!name || !email) {
    throw createHttpError(400, "name and email are required");
  }

  ensurePasswordStrength(password);

  if (!role) {
    throw createHttpError(400, "role is invalid");
  }

  if (!canCreateRole(actor.role, role)) {
    throw createHttpError(
      403,
      "You do not have permission to assign this role",
    );
  }

  ensureDepartmentByRole(role, department);

  if (
    actor.role === USER_ROLE_VALUES.MANAGER &&
    !isWithinManagerScope(actor, { department, group })
  ) {
    throw createHttpError(
      403,
      "Manager can only create staff inside their department/group scope",
    );
  }

  let managerId = normalizeString(payload.managerId) || null;

  if (role !== USER_ROLE_VALUES.STAFF) {
    managerId = null;
  } else if (actor.role === USER_ROLE_VALUES.MANAGER) {
    managerId = actor.id;
  }

  await ensureManagerExists(managerId, department, group);

  const user = await User.create({
    id: await generateSequentialId(User, "USER"),
    name,
    email,
    passwordHash: await hashPassword(password),
    avatar:
      normalizeString(payload.avatar) ||
      `https://i.pravatar.cc/150?u=${encodeURIComponent(email)}`,
    department,
    group,
    phone: normalizeString(payload.phone),
    role,
    managerId,
    createdBy: actor.id,
  });

  return serializeUser(user);
}

async function getUserForStaffApi(actor, userId) {
  if (!canAccessStaffApi(actor.role)) {
    throw createHttpError(
      403,
      "You do not have permission to access staff APIs",
    );
  }

  const user = await User.findOne({ id: userId });

  if (!user) {
    throw createHttpError(404, "User not found");
  }

  if (actor.role === USER_ROLE_VALUES.MANAGER && user.managerId !== actor.id) {
    throw createHttpError(404, "User not found");
  }

  return user;
}

async function updateUserAccount(actor, targetUser, payload = {}) {
  if (!canManageUser(actor, targetUser)) {
    throw createHttpError(
      403,
      "You do not have permission to update this user",
    );
  }

  const nextRole =
    payload.role !== undefined
      ? normalizeUserRole(payload.role)
      : targetUser.role;

  if (!nextRole) {
    throw createHttpError(400, "role is invalid");
  }

  if (
    actor.role === USER_ROLE_VALUES.ADMIN &&
    nextRole === USER_ROLE_VALUES.ADMIN
  ) {
    throw createHttpError(403, "Admin cannot assign admin role");
  }

  if (
    actor.role === USER_ROLE_VALUES.MANAGER &&
    nextRole !== USER_ROLE_VALUES.STAFF
  ) {
    throw createHttpError(403, "Manager can only manage staff role");
  }

  if (
    actor.role !== USER_ROLE_VALUES.OWNER &&
    nextRole === USER_ROLE_VALUES.OWNER
  ) {
    throw createHttpError(403, "Only owner can assign owner role");
  }

  const department =
    payload.department !== undefined
      ? normalizeStringList(payload.department)
      : targetUser.department;
  const group =
    payload.group !== undefined
      ? normalizeStringList(payload.group)
      : targetUser.group;

  ensureDepartmentByRole(nextRole, department);

  if (
    actor.role === USER_ROLE_VALUES.MANAGER &&
    !isWithinManagerScope(actor, { department, group })
  ) {
    throw createHttpError(
      403,
      "Manager can only update staff inside their department/group scope",
    );
  }

  if (payload.password !== undefined) {
    ensurePasswordStrength(payload.password);
    targetUser.passwordHash = await hashPassword(payload.password);
  }

  targetUser.name =
    payload.name !== undefined
      ? normalizeString(payload.name) || targetUser.name
      : targetUser.name;
  targetUser.email =
    payload.email !== undefined
      ? normalizeString(payload.email).toLowerCase() || targetUser.email
      : targetUser.email;
  targetUser.avatar =
    payload.avatar !== undefined
      ? normalizeString(payload.avatar)
      : targetUser.avatar;
  targetUser.department = department;
  targetUser.group = group;
  targetUser.phone =
    payload.phone !== undefined
      ? normalizeString(payload.phone)
      : targetUser.phone;
  targetUser.role = nextRole;

  if (nextRole !== USER_ROLE_VALUES.STAFF) {
    targetUser.managerId = null;
  } else if (actor.role === USER_ROLE_VALUES.MANAGER) {
    targetUser.managerId = actor.id;
  } else if (payload.managerId !== undefined) {
    const managerId = normalizeString(payload.managerId) || null;
    await ensureManagerExists(managerId, department, group);
    targetUser.managerId = managerId;
  }

  await targetUser.save();
  return serializeUser(targetUser);
}

async function deleteUserAccount(actor, targetUser) {
  if (!canManageUser(actor, targetUser, "delete")) {
    throw createHttpError(
      403,
      "You do not have permission to delete this user",
    );
  }

  if (targetUser.id === actor.id) {
    throw createHttpError(400, "You cannot delete your own account");
  }

  await targetUser.deleteOne();
}

module.exports = {
  createHttpError,
  createUserAccount,
  deleteUserAccount,
  getUserForStaffApi,
  listUsers,
  serializeUser,
  updateUserAccount,
};
