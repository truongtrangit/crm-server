const User = require("../models/User");
const Organization = require("../models/Organization");
const Role = require("../models/Role");
const { generateSequentialId } = require("../utils/id");
const { buildSearchRegex } = require("../utils/query");
const { hashPassword } = require("../utils/auth");
const { createHttpError } = require("../utils/http");
const {
  buildPaginatedResponse,
  resolvePagination,
} = require("../utils/pagination");
const {
  isWithinManagerScope,
  normalizeUserRole,
} = require("../utils/userRoles");
const {
  hasPermission,
  hasAnyPermission,
  getUserRoleName,
  getUserRoleWithPermissions,
} = require("../utils/rbac");
const { PERMISSIONS } = require("../constants/rbac");
const { DEFAULT_PASSWORD_STRENGTH } = require("../constants/appData");
const env = require("../config/env");
const {
  buildOrganizationDirectory,
  resolveDepartmentReference,
  resolveGroupReference,
} = require("../utils/organization");

const DEFAULT_ROLE_NAME = "STAFF";
const OWNER_ROLE_NAME = "OWNER";
const ADMIN_ROLE_NAME = "ADMIN";
const MANAGER_ROLE_NAME = "MANAGER";
const STAFF_ROLE_NAME = "STAFF";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(value.map((item) => normalizeString(item)).filter(Boolean)),
  ];
}

function ensurePasswordStrength(password) {
  if (
    typeof password !== "string" ||
    password.length < DEFAULT_PASSWORD_STRENGTH
  ) {
    throw createHttpError(
      400,
      `password must be at least ${DEFAULT_PASSWORD_STRENGTH} characters`,
    );
  }
}

function ensureDepartmentByRole(role, department) {
  if (
    [MANAGER_ROLE_NAME, STAFF_ROLE_NAME].includes(role) &&
    department.length === 0
  ) {
    throw createHttpError(400, "department must contain at least one item");
  }
}

async function validateOrganizationAssignments(payload = {}) {
  const normalizedDepartments = normalizeStringList(payload.departments);
  const normalizedGroups = normalizeStringList(payload.groups);
  const normalizedDepartmentAliases = normalizeStringList(
    payload.departmentAliases,
  );
  const normalizedGroupAliases = normalizeStringList(payload.groupAliases);
  const normalizedDepartmentIds = normalizeStringList(payload.departmentIds);
  const normalizedGroupIds = normalizeStringList(payload.groupIds);

  if (normalizedDepartments.length === 0 && normalizedGroups.length === 0) {
    if (
      normalizedDepartmentAliases.length === 0 &&
      normalizedGroupAliases.length === 0 &&
      normalizedDepartmentIds.length === 0 &&
      normalizedGroupIds.length === 0
    ) {
      return {
        departments: normalizedDepartments,
        groups: normalizedGroups,
        departmentAliases: [],
        groupAliases: [],
      };
    }
  }

  const organizations = await Organization.find(
    {},
    { id: 1, alias: 1, parent: 1, children: 1 },
  )
    .sort({ createdAt: 1, id: 1 })
    .lean();
  const directory = buildOrganizationDirectory(organizations);
  const resolvedDepartments = [];
  const resolvedGroups = [];
  const departmentReferences = [
    ...normalizedDepartments,
    ...normalizedDepartmentAliases,
    ...normalizedDepartmentIds,
  ];
  const groupReferences = [
    ...normalizedGroups,
    ...normalizedGroupAliases,
    ...normalizedGroupIds,
  ];

  for (const reference of departmentReferences) {
    const department = resolveDepartmentReference(directory, reference);

    if (!department) {
      throw createHttpError(400, `department is invalid: ${reference}`);
    }

    resolvedDepartments.push(department);
  }

  for (const reference of groupReferences) {
    const group = resolveGroupReference(directory, reference);

    if (!group) {
      throw createHttpError(400, `group is invalid: ${reference}`);
    }

    resolvedGroups.push(group);
  }

  const departmentAliasSet = new Set(
    resolvedDepartments.map((item) => item.alias),
  );
  const missingDepartments = resolvedGroups
    .map((item) => item.departmentAlias)
    .filter((item) => !departmentAliasSet.has(item));

  if (missingDepartments.length > 0) {
    throw createHttpError(
      400,
      `department must include group parent department: ${[
        ...new Set(
          missingDepartments.map(
            (alias) => directory.departmentByAlias.get(alias)?.name || alias,
          ),
        ),
      ].join(", ")}`,
    );
  }

  return {
    departments: [...new Set(resolvedDepartments.map((item) => item.name))],
    groups: [...new Set(resolvedGroups.map((item) => item.name))],
    departmentAliases: [
      ...new Set(resolvedDepartments.map((item) => item.alias)),
    ],
    groupAliases: [...new Set(resolvedGroups.map((item) => item.alias))],
  };
}

function formatRoleLabel(roleName) {
  return String(roleName || "")
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((item) => item.charAt(0).toUpperCase() + item.slice(1))
    .join(" ");
}

async function resolveRoleDocument(rawValue, fallbackRoleName = null) {
  const directValue = normalizeString(rawValue);
  const fallbackValue = normalizeString(fallbackRoleName);
  const normalizedValue = normalizeUserRole(directValue, null);
  const normalizedFallback = normalizeUserRole(fallbackValue, null);
  const candidates = [
    directValue ? { id: directValue.toLowerCase() } : null,
    directValue ? { name: directValue.toUpperCase() } : null,
    normalizedValue ? { id: normalizedValue.toLowerCase() } : null,
    normalizedValue ? { name: normalizedValue } : null,
    fallbackValue ? { id: fallbackValue.toLowerCase() } : null,
    fallbackValue ? { name: fallbackValue.toUpperCase() } : null,
    normalizedFallback ? { id: normalizedFallback.toLowerCase() } : null,
    normalizedFallback ? { name: normalizedFallback } : null,
  ].filter(Boolean);

  if (candidates.length === 0) {
    return null;
  }

  return Role.findOne({ $or: candidates });
}

function canAssignRole(actorRole, targetRole) {
  if (!actorRole || !targetRole) {
    return false;
  }

  if (actorRole.name === OWNER_ROLE_NAME) {
    return true;
  }

  if (targetRole.name === OWNER_ROLE_NAME) {
    return false;
  }

  return (actorRole.level || 0) > (targetRole.level || 0);
}

function canManageUserByRole(actor, actorRole, targetUser, targetRole) {
  if (!actor || !actorRole || !targetUser || !targetRole) {
    return false;
  }

  if (actor.id === targetUser.id) {
    return false;
  }

  if (actorRole.name === OWNER_ROLE_NAME) {
    return targetRole.name !== OWNER_ROLE_NAME;
  }

  if ((actorRole.level || 0) <= (targetRole.level || 0)) {
    return false;
  }

  if (actorRole.name === MANAGER_ROLE_NAME) {
    const managerDeptAliases = Array.isArray(actor.departmentAliases)
      ? actor.departmentAliases
      : Array.isArray(actor.department)
        ? actor.department
        : [];
    const targetDeptAliases = Array.isArray(targetUser.departmentAliases)
      ? targetUser.departmentAliases
      : Array.isArray(targetUser.department)
        ? targetUser.department
        : [];

    return targetDeptAliases.some((alias) =>
      managerDeptAliases.includes(alias),
    );
  }

  return true;
}

async function ensureManagerExists(
  managerId,
  department,
  group,
  departmentAliases = [],
  groupAliases = [],
) {
  if (!managerId) {
    return null;
  }

  const manager = await User.findOne({ id: managerId }).lean();

  const managerRoleName = await getUserRoleName(manager);

  if (!manager || managerRoleName !== MANAGER_ROLE_NAME) {
    throw createHttpError(400, "managerId must reference a manager user");
  }

  if (
    !isWithinManagerScope(manager, {
      department,
      group,
      departmentAliases,
      groupAliases,
    })
  ) {
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
  delete item.passwordReset;
  delete item.sessions;

  return {
    ...item,
    roleLabel: formatRoleLabel(item.role),
    departmentAliases: item.departmentAliases || [],
    groupAliases: item.groupAliases || [],
  };
}

async function buildUserListQuery(actor, filters = {}) {
  if (
    !(await hasAnyPermission(actor, [
      PERMISSIONS.USERS_READ,
      PERMISSIONS.USERS_MANAGE,
      PERMISSIONS.USERS_CREATE,
      PERMISSIONS.USERS_UPDATE,
      PERMISSIONS.USERS_DELETE,
    ]))
  ) {
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
    const organizations = await Organization.find(
      {},
      { id: 1, alias: 1, parent: 1, children: 1 },
    ).lean();
    const directory = buildOrganizationDirectory(organizations);
    const resolvedDepartment = resolveDepartmentReference(
      directory,
      normalizeString(department),
    );

    if (!resolvedDepartment) {
      throw createHttpError(400, "department is invalid");
    }

    query.$and = [
      ...(query.$and || []),
      {
        $or: [
          { department: resolvedDepartment.name },
          { departmentAliases: resolvedDepartment.alias },
        ],
      },
    ];
  }

  if (role) {
    const resolvedRole = await resolveRoleDocument(role);

    if (!resolvedRole) {
      throw createHttpError(400, "role is invalid");
    }

    query.roleId = resolvedRole.id;
  }

  const actorRoleName = await getUserRoleName(actor);

  if (actorRoleName === MANAGER_ROLE_NAME) {
    const managerDeptAliases = Array.isArray(actor.departmentAliases)
      ? actor.departmentAliases
      : Array.isArray(actor.department)
        ? actor.department
        : [];

    if (managerDeptAliases.length > 0) {
      query.$and = [
        ...(query.$and || []),
        {
          $or: [
            { departmentAliases: { $in: managerDeptAliases } },
            { department: { $in: managerDeptAliases } },
          ],
        },
      ];
    } else {
      // Manager has no departments assigned — return nothing
      query._id = null;
    }
  } else if (managerId) {
    query.managerId = normalizeString(managerId);
  }

  return query;
}

async function listUsers(actor, filters) {
  const query = await buildUserListQuery(actor, filters);
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
  if (
    !(await hasAnyPermission(actor, [
      PERMISSIONS.USERS_CREATE,
      PERMISSIONS.USERS_MANAGE,
      PERMISSIONS.ROLES_MANAGE,
    ]))
  ) {
    throw createHttpError(403, "You do not have permission to create users");
  }

  const name = normalizeString(payload.name);
  const email = normalizeString(payload.email).toLowerCase();
  const password =
    typeof payload.password === "string"
      ? payload.password
      : env.defaultUserPassword;
  const targetRole = await resolveRoleDocument(
    payload.roleId ?? payload.role,
    DEFAULT_ROLE_NAME,
  );
  const organizationAssignments = await validateOrganizationAssignments({
    departments: payload.department,
    groups: payload.group,
    departmentAliases: payload.departmentAliases,
    groupAliases: payload.groupAliases,
    departmentIds: payload.departmentIds,
    groupIds: payload.groupIds,
  });
  const department = organizationAssignments.departments;
  const group = organizationAssignments.groups;
  const actorRole = await getUserRoleWithPermissions(actor);
  const actorRoleName = actorRole?.name || null;

  if (!name || !email) {
    throw createHttpError(400, "name and email are required");
  }

  // If email already exists, return error to prevent creating multiple accounts with same email
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw createHttpError(400, "Email already exists");
  }

  ensurePasswordStrength(password);

  if (!targetRole) {
    throw createHttpError(400, "role is invalid");
  }

  const canManageRoles = await hasPermission(actor, PERMISSIONS.ROLES_MANAGE);
  const canManageUsers = await hasPermission(actor, PERMISSIONS.USERS_MANAGE);

  if (!canManageRoles && !canManageUsers) {
    if (
      !(await hasPermission(actor, PERMISSIONS.USERS_CREATE)) ||
      targetRole.name !== STAFF_ROLE_NAME
    ) {
      throw createHttpError(
        403,
        "You do not have permission to assign this role",
      );
    }
  } else if (!canAssignRole(actorRole, targetRole)) {
    throw createHttpError(
      403,
      "You do not have permission to assign this role",
    );
  }

  ensureDepartmentByRole(targetRole.name, department);

  if (
    actorRoleName === MANAGER_ROLE_NAME &&
    !isWithinManagerScope(actor, {
      department,
      group,
      departmentAliases: organizationAssignments.departmentAliases,
      groupAliases: organizationAssignments.groupAliases,
    })
  ) {
    throw createHttpError(
      403,
      "Manager can only create staff inside their department/group scope",
    );
  }

  let managerId = normalizeString(payload.managerId) || null;

  if (targetRole.name !== STAFF_ROLE_NAME) {
    managerId = null;
  } else if (actorRoleName === MANAGER_ROLE_NAME) {
    managerId = actor.id;
  }

  await ensureManagerExists(
    managerId,
    department,
    group,
    organizationAssignments.departmentAliases,
    organizationAssignments.groupAliases,
  );

  const user = await User.create({
    id: await generateSequentialId(User, "USER"),
    name,
    email,
    passwordHash: await hashPassword(password),
    avatar:
      normalizeString(payload.avatar) ||
      `https://i.pravatar.cc/150?u=${encodeURIComponent(email)}`,
    department,
    departmentAliases: organizationAssignments.departmentAliases,
    group,
    groupAliases: organizationAssignments.groupAliases,
    phone: normalizeString(payload.phone),
    role: targetRole.name,
    roleId: targetRole.id,
    managerId,
    createdBy: actor.id,
  });

  return serializeUser(user);
}

async function getUserForStaffApi(actor, userId) {
  if (
    !(await hasAnyPermission(actor, [
      PERMISSIONS.USERS_READ,
      PERMISSIONS.USERS_MANAGE,
      PERMISSIONS.USERS_CREATE,
      PERMISSIONS.USERS_UPDATE,
      PERMISSIONS.USERS_DELETE,
    ]))
  ) {
    throw createHttpError(
      403,
      "You do not have permission to access staff APIs",
    );
  }

  const user = await User.findOne({ id: userId });

  if (!user) {
    throw createHttpError(404, "User not found");
  }

  const actorRoleName2 = await getUserRoleName(actor);
  if (actorRoleName2 === MANAGER_ROLE_NAME) {
    const managerDeptAliases = Array.isArray(actor.departmentAliases)
      ? actor.departmentAliases
      : Array.isArray(actor.department)
        ? actor.department
        : [];
    const userDeptAliases = Array.isArray(user.departmentAliases)
      ? user.departmentAliases
      : Array.isArray(user.department)
        ? user.department
        : [];
    const hasOverlap = userDeptAliases.some((alias) =>
      managerDeptAliases.includes(alias),
    );

    if (!hasOverlap) {
      throw createHttpError(404, "User not found");
    }
  }

  return user;
}

async function updateUserAccount(actor, targetUser, payload = {}) {
  const actorRole = await getUserRoleWithPermissions(actor);
  const targetCurrentRole = await getUserRoleWithPermissions(targetUser);
  const actorRoleName = actorRole?.name || null;
  const targetRoleName = targetCurrentRole?.name || null;

  if (targetRoleName === OWNER_ROLE_NAME && actorRoleName !== OWNER_ROLE_NAME) {
    throw createHttpError(
      403,
      "You do not have permission to update this user",
    );
  }

  if (
    !(await hasPermission(actor, PERMISSIONS.USERS_MANAGE)) &&
    !(
      (await hasPermission(actor, PERMISSIONS.USERS_UPDATE)) &&
      canManageUserByRole(actor, actorRole, targetUser, targetCurrentRole)
    )
  ) {
    throw createHttpError(
      403,
      "You do not have permission to update this user",
    );
  }

  const nextRole =
    payload.role !== undefined || payload.roleId !== undefined
      ? await resolveRoleDocument(payload.roleId ?? payload.role)
      : targetCurrentRole;

  if (!nextRole) {
    throw createHttpError(400, "role is invalid");
  }

  if (
    !(await hasPermission(actor, PERMISSIONS.USERS_MANAGE)) &&
    nextRole.name !== STAFF_ROLE_NAME
  ) {
    throw createHttpError(
      403,
      "You do not have permission to assign this role",
    );
  }

  if (
    (await hasPermission(actor, PERMISSIONS.USERS_MANAGE)) &&
    !canAssignRole(actorRole, nextRole)
  ) {
    throw createHttpError(
      403,
      "You do not have permission to assign this role",
    );
  }

  // Treat department-related fields as a package: if any one is provided,
  // don't fall back to targetUser for the others (to avoid re-adding removed items).
  const hasDeptPayload =
    payload.department !== undefined ||
    payload.departmentAliases !== undefined ||
    payload.departmentIds !== undefined;
  const department = hasDeptPayload
    ? normalizeStringList(payload.department)
    : targetUser.department;
  const departmentAliases = hasDeptPayload
    ? normalizeStringList(payload.departmentAliases)
    : targetUser.departmentAliases;

  // Same for group-related fields.
  const hasGroupPayload =
    payload.group !== undefined ||
    payload.groupAliases !== undefined ||
    payload.groupIds !== undefined;
  const group = hasGroupPayload
    ? normalizeStringList(payload.group)
    : targetUser.group;
  const groupAliases = hasGroupPayload
    ? normalizeStringList(payload.groupAliases)
    : targetUser.groupAliases;

  const organizationAssignments = await validateOrganizationAssignments({
    departments: department,
    groups: group,
    departmentAliases,
    groupAliases,
    departmentIds: hasDeptPayload
      ? normalizeStringList(payload.departmentIds)
      : [],
    groupIds: hasGroupPayload ? normalizeStringList(payload.groupIds) : [],
  });

  ensureDepartmentByRole(nextRole.name, organizationAssignments.departments);

  const actorRoleName4 = await getUserRoleName(actor);
  if (
    actorRoleName4 === MANAGER_ROLE_NAME &&
    !isWithinManagerScope(actor, {
      department: organizationAssignments.departments,
      group: organizationAssignments.groups,
      departmentAliases: organizationAssignments.departmentAliases,
      groupAliases: organizationAssignments.groupAliases,
    })
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
  targetUser.department = organizationAssignments.departments;
  targetUser.departmentAliases = organizationAssignments.departmentAliases;
  targetUser.group = organizationAssignments.groups;
  targetUser.groupAliases = organizationAssignments.groupAliases;
  targetUser.phone =
    payload.phone !== undefined
      ? normalizeString(payload.phone)
      : targetUser.phone;
  targetUser.role = nextRole.name;
  targetUser.roleId = nextRole.id;

  if (nextRole.name !== STAFF_ROLE_NAME) {
    targetUser.managerId = null;
  } else if ((await getUserRoleName(actor)) === MANAGER_ROLE_NAME) {
    targetUser.managerId = actor.id;
  } else if (payload.managerId !== undefined) {
    const managerId = normalizeString(payload.managerId) || null;
    await ensureManagerExists(
      managerId,
      organizationAssignments.departments,
      organizationAssignments.groups,
      organizationAssignments.departmentAliases,
      organizationAssignments.groupAliases,
    );
    targetUser.managerId = managerId;
  }

  await targetUser.save();
  return serializeUser(targetUser);
}

async function updateOwnProfile(actor, payload = {}) {
  const actorRoleName = await getUserRoleName(actor);
  const safePayload = { ...payload };
  delete safePayload.role;
  delete safePayload.roleId;
  delete safePayload.managerId;

  if (safePayload.password !== undefined) {
    ensurePasswordStrength(safePayload.password);
    actor.passwordHash = await hashPassword(safePayload.password);
  }

  actor.name =
    safePayload.name !== undefined
      ? normalizeString(safePayload.name) || actor.name
      : actor.name;
  actor.email =
    safePayload.email !== undefined
      ? normalizeString(safePayload.email).toLowerCase() || actor.email
      : actor.email;
  actor.avatar =
    safePayload.avatar !== undefined
      ? normalizeString(safePayload.avatar)
      : actor.avatar;
  actor.phone =
    safePayload.phone !== undefined
      ? normalizeString(safePayload.phone)
      : actor.phone;

  if ([OWNER_ROLE_NAME, ADMIN_ROLE_NAME].includes(actorRoleName)) {
    const hasDeptPayload =
      safePayload.department !== undefined ||
      safePayload.departmentAliases !== undefined ||
      safePayload.departmentIds !== undefined;
    const hasGroupPayload =
      safePayload.group !== undefined ||
      safePayload.groupAliases !== undefined ||
      safePayload.groupIds !== undefined;

    if (hasDeptPayload || hasGroupPayload) {
      const organizationAssignments = await validateOrganizationAssignments({
        departments:
          safePayload.department !== undefined
            ? normalizeStringList(safePayload.department)
            : actor.department,
        groups:
          safePayload.group !== undefined
            ? normalizeStringList(safePayload.group)
            : actor.group,
        departmentAliases:
          safePayload.departmentAliases !== undefined
            ? normalizeStringList(safePayload.departmentAliases)
            : actor.departmentAliases,
        groupAliases:
          safePayload.groupAliases !== undefined
            ? normalizeStringList(safePayload.groupAliases)
            : actor.groupAliases,
        departmentIds:
          safePayload.departmentIds !== undefined
            ? normalizeStringList(safePayload.departmentIds)
            : [],
        groupIds:
          safePayload.groupIds !== undefined
            ? normalizeStringList(safePayload.groupIds)
            : [],
      });

      actor.department = organizationAssignments.departments;
      actor.departmentAliases = organizationAssignments.departmentAliases;
      actor.group = organizationAssignments.groups;
      actor.groupAliases = organizationAssignments.groupAliases;
    }
  } else if (actorRoleName === MANAGER_ROLE_NAME) {
    const requestedDepartment = normalizeStringList(safePayload.department);
    const requestedGroup = normalizeStringList(safePayload.group);
    const hasDeptPayload =
      safePayload.department !== undefined ||
      safePayload.departmentAliases !== undefined ||
      safePayload.departmentIds !== undefined;
    const hasGroupPayload =
      safePayload.group !== undefined ||
      safePayload.groupAliases !== undefined ||
      safePayload.groupIds !== undefined;

    if (hasDeptPayload || hasGroupPayload) {
      const requestedAssignments = await validateOrganizationAssignments({
        departments: requestedDepartment.length
          ? requestedDepartment
          : actor.department,
        groups: requestedGroup.length ? requestedGroup : actor.group,
        departmentAliases:
          safePayload.departmentAliases !== undefined
            ? normalizeStringList(safePayload.departmentAliases)
            : actor.departmentAliases,
        groupAliases:
          safePayload.groupAliases !== undefined
            ? normalizeStringList(safePayload.groupAliases)
            : actor.groupAliases,
        departmentIds:
          safePayload.departmentIds !== undefined
            ? normalizeStringList(safePayload.departmentIds)
            : [],
        groupIds:
          safePayload.groupIds !== undefined
            ? normalizeStringList(safePayload.groupIds)
            : [],
      });

      if (
        !isWithinManagerScope(actor, {
          department: requestedAssignments.departments,
          group: requestedAssignments.groups,
          departmentAliases: requestedAssignments.departmentAliases,
          groupAliases: requestedAssignments.groupAliases,
        })
      ) {
        throw createHttpError(
          403,
          "Manager can only update profile within assigned department/group scope",
        );
      }

      actor.department = requestedAssignments.departments;
      actor.departmentAliases = requestedAssignments.departmentAliases;
      actor.group = requestedAssignments.groups;
      actor.groupAliases = requestedAssignments.groupAliases;
    }
  }

  await actor.save();
  return serializeUser(actor);
}

async function deleteUserAccount(actor, targetUser) {
  const actorRole = await getUserRoleWithPermissions(actor);
  const targetRole = await getUserRoleWithPermissions(targetUser);
  const actorRoleName = actorRole?.name || null;
  const targetRoleName = targetRole?.name || null;

  if (targetRoleName === OWNER_ROLE_NAME && actorRoleName !== OWNER_ROLE_NAME) {
    throw createHttpError(
      403,
      "You do not have permission to delete this user",
    );
  }

  if (
    !(await hasPermission(actor, PERMISSIONS.USERS_MANAGE)) &&
    !canManageUserByRole(actor, actorRole, targetUser, targetRole)
  ) {
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
  updateOwnProfile,
};
