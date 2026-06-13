const User = require('./user.model');
const Organization = require('../../hr/organization/organization.model');
const Role = require('../rbac/role.model');
const Event = require('../../event/event/event.model');
const StaffFunction = require('../../hr/function/staffFunction.model');
const Company = require('../../hr/company/company.model');
const FunctionalGroup = require('../../hr/functionalGroup/functionalGroup.model');
const { generateMonotonicId, ID_PREFIXES } = require('../../../core/utils/id');
const { buildSearchRegex } = require('../../../core/utils/query');
const { hashPassword } = require('../../../core/utils/auth');
const { createHttpError } = require('../../../core/utils/http');
const { getDefaultAvatar } = require('../../../core/utils/avatar');
const {
  buildPaginatedResponse,
  resolvePagination,
  resolveSort,
} = require('../../../core/utils/pagination');
const {
  isWithinManagerScope,
  normalizeUserRole,
  isOwnerOrAdmin,
} = require('../../../core/utils/userRoles');
const {
  hasPermission,
  hasAnyPermission,
  getUserRoleName,
  getUserRoleWithPermissions,
} = require('../../../core/utils/rbac');
const {
  PERMISSIONS,
  MODULE_TO_PERMISSIONS_MAP,
  ROLE_DEFINITIONS,
} = require('../../../core/constants/rbac');
const {
  DEFAULT_PASSWORD_STRENGTH,
  COMPANIES,
} = require('../../../core/constants/appData');
const env = require('../../../core/config/env');
const {
  buildOrganizationDirectory,
  resolveDepartmentReference,
  resolveGroupReference,
} = require('../../../core/utils/organization');
const { computeChanges } = require('../../../core/utils/diff');
const CacheService = require('../../../core/services/CacheService');
const { CACHE_TTL } = require('../../../core/constants/cache');

let orgDirectoryCache = null;

async function ensureOrgDirectoryCache(force = false) {
  if (!orgDirectoryCache || force) {
    const orgs = await Organization.find({}).lean();
    orgDirectoryCache = buildOrganizationDirectory(orgs);
  }
}

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
function getGroupNameFromAlias(alias) {
  const cleanAlias = alias.includes("__") ? alias.split("__")[1] : alias;
  return cleanAlias;
}

async function parseDecoupledAssignments(payload = {}) {
  let functions = [];
  if (Array.isArray(payload.functions)) {
    functions = payload.functions;
  }

  let departments = [];
  let groups = [];

  // Direct modern format
  if (
    Array.isArray(payload.departments) &&
    payload.departments.length > 0 &&
    typeof payload.departments[0] === "object"
  ) {
    departments = payload.departments.map((d) => ({
      deptAlias: d.deptAlias,
      role: d.role || "member",
    }));
  }
  if (
    Array.isArray(payload.groups) &&
    payload.groups.length > 0 &&
    typeof payload.groups[0] === "object"
  ) {
    groups = payload.groups.map((g) => ({
      groupAlias: g.groupAlias,
      role: g.role || "member",
    }));
  }

  return { functions, departments, groups };
}

function ensurePasswordStrength(password) {
  if (
    typeof password !== "string" ||
    password.length < DEFAULT_PASSWORD_STRENGTH
  ) {
    throw createHttpError(
      400,
      `Password must be at least ${DEFAULT_PASSWORD_STRENGTH} characters long`,
    );
  }
}

function computePermissionsFromModuleAccess(moduleAccess, roleName) {
  if (!Array.isArray(moduleAccess) || moduleAccess.length === 0) {
    return [];
  }

  const permissions = new Set();
  const role = ROLE_DEFINITIONS[roleName];

  for (const entry of moduleAccess) {
    if (!entry.isEnabled) continue;

    const moduleKey = entry.moduleId;
    const actionMap = MODULE_TO_PERMISSIONS_MAP[moduleKey];

    if (actionMap) {
      if (
        entry.customPermissions !== null &&
        Array.isArray(entry.customPermissions)
      ) {
        // Explicitly granted custom actions
        for (const action of entry.customPermissions) {
          if (actionMap[action]) {
            actionMap[action].forEach((p) => permissions.add(p));
          }
        }
      } else {
        // Fallback to role permissions for this module
        if (role && Array.isArray(role.permissions)) {
          for (const action of Object.keys(actionMap)) {
            const requiredPerms = actionMap[action];
            const hasAllPerms = requiredPerms.every((p) =>
              role.permissions.includes(p),
            );
            if (hasAllPerms) {
              requiredPerms.forEach((p) => permissions.add(p));
            }
          }
        }
      }
    }
  }

  return Array.from(permissions);
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

  if (normalizedDepartments.length === 0 && normalizedGroups.length === 0) {
    return {
      departments: normalizedDepartments,
      groups: normalizedGroups,
      departmentAliases: [],
      groupAliases: [],
    };
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
  const departmentReferences = normalizedDepartments;
  const groupReferences = normalizedGroups;

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

/**
 * Check if actorRole is allowed to assign targetRole to a user.
 * Rules:
 *  - OWNER can assign any role EXCEPT OWNER (only 1 owner philosophy; prevent OWNER duplication).
 *  - Other roles can only assign roles with strictly lower level than themselves.
 */
function canAssignRole(actorRole, targetRole) {
  if (!actorRole || !targetRole) {
    return false;
  }

  // Nobody can assign the OWNER role to others
  if (targetRole.name === OWNER_ROLE_NAME) {
    return false;
  }

  // Actor must have strictly higher level than the role they want to assign
  return (actorRole.level || 0) > (targetRole.level || 0);
}

function serializeUser(user) {
  const item =
    typeof user.toObject === "function" ? user.toObject() : { ...user };

  delete item.passwordHash;
  delete item.passwordReset;
  delete item.sessions;

  const functions = item.functions || [];

  return {
    ...item,
    roleLabel: formatRoleLabel(item.roleId),
    functions,
    preferences: item.preferences || {},
    permissions: item.permissions || [],
    moduleAccess: item.moduleAccess || [],
  };
}

async function buildUserListQuery(actor, scopedUserIds, filters = {}) {
  const hasReadPermission = await hasAnyPermission(actor, [
    PERMISSIONS.USERS_READ,
    PERMISSIONS.USERS_MANAGE,
    PERMISSIONS.USERS_CREATE,
    PERMISSIONS.USERS_UPDATE,
    PERMISSIONS.USERS_DELETE,
  ]);

  // Staff without any user-management permission can still list users,
  // but will receive only basic fields (handled in listUsers).
  // We still build the query normally so pagination works.

  const { search = "", department, role, functionId } = filters;
  const searchRegex = buildSearchRegex(search);
  const query = {};

  if (scopedUserIds) {
    query.id = Array.isArray(scopedUserIds)
      ? { $in: scopedUserIds }
      : scopedUserIds;
  }

  if (functionId) {
    query.functions = functionId;
  }

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
      { "departments.deptAlias": resolvedDepartment.alias },
    ];
  }

  if (role) {
    const resolvedRole = await resolveRoleDocument(role);

    if (!resolvedRole) {
      throw createHttpError(400, "role is invalid");
    }

    query.roleId = resolvedRole.id;
  }

  if (hasReadPermission) {
    const actorRoleName = await getUserRoleName(actor);

    if (actorRoleName === MANAGER_ROLE_NAME) {
      const managerDepts = actor.departments || [];
      const managerGroups = actor.groups || [];
      let managerDeptAliases = managerDepts
        .filter((d) => d.role === "lead")
        .map((d) => d.deptAlias);
      let managerGroupAliases = managerGroups
        .filter((g) => g.role === "lead")
        .map((g) => g.groupAlias);

      // Fallback: if MANAGER has no explicit lead departments or groups, they fall back to the departments they belong to
      if (managerDeptAliases.length === 0 && managerGroupAliases.length === 0) {
        if (managerDepts.length > 0) {
          managerDeptAliases = managerDepts
            .map((d) => d.deptAlias)
            .filter(Boolean);
        } else if (Array.isArray(actor.department)) {
          managerDeptAliases = actor.department;
        } else if (Array.isArray(actor.departmentAliases)) {
          managerDeptAliases = actor.departmentAliases;
        }
      }

      const orConditions = [{ id: actor.id }];

      if (managerDeptAliases.length > 0) {
        orConditions.push({
          "departments.deptAlias": { $in: managerDeptAliases },
        });
      }
      if (managerGroupAliases.length > 0) {
        orConditions.push({
          "groups.groupAlias": { $in: managerGroupAliases },
        });
      }

      query.$and = [...(query.$and || []), { $or: orConditions }];
    }
  }

  return { query, hasReadPermission };
}

/**
 * Serialize user to basic public fields only (id, name, avatar).
 * Used when the requesting actor doesn't have USERS_READ permission.
 */
function serializeUserBasic(user) {
  const item =
    typeof user.toObject === "function" ? user.toObject() : { ...user };
  return {
    id: item.id,
    name: item.name,
    avatar: item.avatar || "",
    functions: item.functions || [],
  };
}

async function listUsers(actor, scopedUserIds, filters) {
  return CacheService.withVersionedCache(
    "users",
    { actorId: actor.id, role: actor.roleId, scopedUserIds, ...filters },
    CACHE_TTL.SHORT,
    async () => {
      await ensureOrgDirectoryCache();
      const { query, hasReadPermission } = await buildUserListQuery(
        actor,
        scopedUserIds,
        filters,
      );
      const { page, limit, skip } = resolvePagination(filters);

      // Owner/Admin can see deleted users
      const roleName = ((await getUserRoleName(actor)) || "").toUpperCase();
      const canSeeDeleted =
        isOwnerOrAdmin(roleName) && filters.isDeleted === "true";

      const sortObj = resolveSort(filters, [
        "createdAt",
        "name",
        "updatedAt",
        "email",
        "roleId",
      ]);

      if (canSeeDeleted) {
        query.isDeleted = true;
      }

      const [users, totalItems] = await Promise.all([
        User.find(query).sort(sortObj).skip(skip).limit(limit).lean(),
        User.countDocuments(query),
      ]);

      // Staff (no USERS_READ) gets only basic info; others get full data
      const serializer = hasReadPermission ? serializeUser : serializeUserBasic;

      return buildPaginatedResponse(
        users.map(serializer),
        totalItems,
        page,
        limit,
      );
    },
  );
}

function validateDepartmentAndGroupRules(
  actor,
  actorRoleName,
  targetUser,
  parsed,
) {
  const isOwnerOrAdminUser = isOwnerOrAdmin(actorRoleName);
  if (isOwnerOrAdminUser) return;

  const currentDepts = targetUser ? targetUser.departments || [] : [];
  const nextDepts = parsed.departments || [];

  // Rule 1: Only Owner/Admin can update a staff to be a lead/member of a department.
  // EXCEPT: A Department Lead is allowed to add/remove a staff as a member in their own department.
  const getDeptChanges = () => {
    const changes = new Set();
    const currentMap = new Map(currentDepts.map((d) => [d.deptAlias, d.role]));
    const nextMap = new Map(nextDepts.map((d) => [d.deptAlias, d.role]));

    for (const [deptAlias, role] of nextMap.entries()) {
      if (!currentMap.has(deptAlias) || currentMap.get(deptAlias) !== role) {
        changes.add(deptAlias);
      }
    }
    for (const deptAlias of currentMap.keys()) {
      if (!nextMap.has(deptAlias)) {
        changes.add(deptAlias);
      }
    }
    return Array.from(changes);
  };

  const changedDeptAliases = getDeptChanges();
  const actorDepts = actor.departments || [];

  for (const deptAlias of changedDeptAliases) {
    const isActorLeadOfThisDept = actorDepts.some(
      (ad) => ad.deptAlias === deptAlias && ad.role === "lead",
    );
    if (!isActorLeadOfThisDept) {
      throw createHttpError(
        403,
        "Chỉ có Owner hoặc Admin mới có quyền cập nhật thành viên hoặc vai trò trong phòng ban",
      );
    }

    const currentRole = currentDepts.find(
      (d) => d.deptAlias === deptAlias,
    )?.role;
    const nextRole = nextDepts.find((d) => d.deptAlias === deptAlias)?.role;

    if (currentRole === "lead" || nextRole === "lead") {
      throw createHttpError(
        403,
        "Trưởng phòng ban không có quyền cập nhật, gán hoặc hủy gán Trưởng phòng ban khác trong cùng phòng ban",
      );
    }
  }

  // Rule 2: Only Lead of the department can update staff of the department to be a lead/member of a group (under that department)
  const currentGroups = targetUser ? targetUser.groups || [] : [];
  const nextGroups = parsed.groups || [];

  const getGroupChanges = () => {
    const changes = new Set();
    const currentMap = new Map(
      currentGroups.map((g) => [g.groupAlias, g.role]),
    );
    const nextMap = new Map(nextGroups.map((g) => [g.groupAlias, g.role]));

    for (const [groupAlias, role] of nextMap.entries()) {
      if (!currentMap.has(groupAlias) || currentMap.get(groupAlias) !== role) {
        changes.add(groupAlias);
      }
    }
    for (const groupAlias of currentMap.keys()) {
      if (!nextMap.has(groupAlias)) {
        changes.add(groupAlias);
      }
    }
    return Array.from(changes);
  };

  const changedGroupAliases = getGroupChanges();

  for (const groupAlias of changedGroupAliases) {
    const deptAlias = groupAlias.split("__")[0];
    const isDeptLeadOfGroupParent = actorDepts.some(
      (d) => d.deptAlias === deptAlias && d.role === "lead",
    );
    if (!isDeptLeadOfGroupParent) {
      throw createHttpError(
        403,
        `Chỉ có Trưởng phòng ban mới có quyền cập nhật, gán hoặc hủy gán thành viên/vai trò nhóm thuộc phòng ban đó`,
      );
    }
  }

  if (targetUser) {
    // Rule 3: Lead of a department does NOT have the right to update/assign/unassign another lead of that same department
    const isTargetDeptLeadOfSameDept = currentDepts.some(
      (d) =>
        d.role === "lead" &&
        actorDepts.some(
          (ad) => ad.deptAlias === d.deptAlias && ad.role === "lead",
        ),
    );
    if (isTargetDeptLeadOfSameDept) {
      throw createHttpError(
        403,
        "Trưởng phòng ban không có quyền cập nhật, gán hoặc hủy gán Trưởng phòng ban khác trong cùng phòng ban",
      );
    }

    // Rule 4: Lead of a group does NOT have the right to update/assign/unassign another lead of that same group
    const actorGroups = actor.groups || [];
    const isTargetGroupLeadOfSameGroup = currentGroups.some((g) => {
      if (g.role !== "lead") return false;
      const deptAlias = g.groupAlias.split("__")[0];
      const isActorDeptLead = actorDepts.some(
        (d) => d.deptAlias === deptAlias && d.role === "lead",
      );
      if (isActorDeptLead) return false;
      return actorGroups.some(
        (ag) => ag.groupAlias === g.groupAlias && ag.role === "lead",
      );
    });
    if (isTargetGroupLeadOfSameGroup) {
      throw createHttpError(
        403,
        "Trưởng nhóm không có quyền cập nhật, gán hoặc hủy gán Trưởng nhóm khác trong cùng nhóm",
      );
    }
  }
}

async function createUserAccount(actor, payload = {}) {
  await ensureOrgDirectoryCache();
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

  const parsed = await parseDecoupledAssignments(payload);
  const assignedDepts = parsed.departments.map((d) => d.deptAlias);

  const actorRole = await getUserRoleWithPermissions(actor);
  const actorRoleName = actorRole?.name || null;

  validateDepartmentAndGroupRules(actor, actorRoleName, null, parsed);

  if (
    payload.moduleAccess !== undefined &&
    Array.isArray(payload.moduleAccess) &&
    payload.moduleAccess.length > 0
  ) {
    if (!isOwnerOrAdmin(actorRoleName)) {
      throw createHttpError(
        403,
        "Chỉ có Owner hoặc Admin mới có quyền cấu hình phân quyền module cho nhân viên",
      );
    }
  }

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

  // Unified role assignment check:
  if (!canAssignRole(actorRole, targetRole)) {
    throw createHttpError(
      403,
      "You do not have permission to assign this role",
    );
  }

  // Additional check for actors that only have USERS_CREATE (not USERS_MANAGE):
  const hasManageUsers = await hasPermission(actor, PERMISSIONS.USERS_MANAGE);
  const hasManageRoles = await hasPermission(actor, PERMISSIONS.ROLES_MANAGE);
  if (
    !hasManageUsers &&
    !hasManageRoles &&
    targetRole.name !== STAFF_ROLE_NAME
  ) {
    throw createHttpError(
      403,
      "You do not have permission to assign this role",
    );
  }

  ensureDepartmentByRole(targetRole.name, assignedDepts);

  const scopePayload = {
    departmentAliases: parsed.departments.map((d) => d.deptAlias),
    groupAliases: parsed.groups.map((g) => g.groupAlias),
  };

  if (
    actorRoleName === MANAGER_ROLE_NAME &&
    !isWithinManagerScope(actor, scopePayload)
  ) {
    throw createHttpError(
      403,
      "Manager chỉ được tạo nhân viên trong phạm vi quản lý của mình",
    );
  }

  let validatedFunctionalGroups = [];
  if (
    Array.isArray(payload.functionalGroups) &&
    payload.functionalGroups.length > 0
  ) {
    const validGroups = await FunctionalGroup.find({
      id: { $in: payload.functionalGroups },
    })
      .select("id")
      .lean();
    if (validGroups.length !== payload.functionalGroups.length) {
      throw createHttpError(400, "One or more Functional Groups are invalid");
    }
    validatedFunctionalGroups = payload.functionalGroups;
  }

  let validatedCompanies = [];
  if (Array.isArray(payload.companies) && payload.companies.length > 0) {
    const validCompanies = await Company.find({
      id: { $in: payload.companies },
    })
      .select("id")
      .lean();
    if (validCompanies.length !== payload.companies.length) {
      throw createHttpError(400, "One or more Companies are invalid");
    }
    validatedCompanies = payload.companies;
  }

  if (Array.isArray(parsed.functions) && parsed.functions.length > 0) {
    const validFunctions = await StaffFunction.find({
      id: { $in: parsed.functions },
    })
      .select("id")
      .lean();
    if (validFunctions.length !== parsed.functions.length) {
      throw createHttpError(400, "One or more Functions are invalid");
    }
  }

  const user = await User.create({
    id: await generateMonotonicId(ID_PREFIXES.USER),
    name,
    email,
    passwordHash: await hashPassword(password),
    avatar: normalizeString(payload.avatar) || getDefaultAvatar(name || email),
    companies: validatedCompanies,
    phone: normalizeString(payload.phone),
    roleId: targetRole.id,
    functions: parsed.functions,
    functionalGroups: validatedFunctionalGroups,
    departments: parsed.departments,
    groups: parsed.groups,
    moduleAccess: Array.isArray(payload.moduleAccess)
      ? payload.moduleAccess
      : [],
    permissions: computePermissionsFromModuleAccess(
      payload.moduleAccess,
      targetRole.name,
    ),
    createdBy: actor.id,
  });

  await CacheService.bumpNamespaceVersion("users");
  return serializeUser(user);
}

async function updateUserAccount(actor, targetUser, payload = {}) {
  await ensureOrgDirectoryCache();
  const actorRole = await getUserRoleWithPermissions(actor);
  const targetCurrentRole = await getUserRoleWithPermissions(targetUser);
  const actorRoleName = actorRole?.name || null;
  const targetRoleName = targetCurrentRole?.name || null;

  // ── Guard 2: Only OWNER can manage other OWNER accounts ──────────────────
  if (targetRoleName === OWNER_ROLE_NAME && actorRoleName !== OWNER_ROLE_NAME) {
    throw createHttpError(
      403,
      "You do not have permission to update this user",
    );
  }

  // ── Determine next role ───────────────────────────────────────────────────
  const nextRole =
    payload.role !== undefined || payload.roleId !== undefined
      ? await resolveRoleDocument(payload.roleId ?? payload.role)
      : targetCurrentRole;

  if (!nextRole) {
    throw createHttpError(400, "role is invalid");
  }

  // ── Guard 4: Validate the actor is allowed to assign the requested role ───
  const isRoleBeingChanged =
    (payload.role !== undefined || payload.roleId !== undefined) &&
    nextRole.id !== targetCurrentRole?.id;

  if (isRoleBeingChanged) {
    if (actor.id === targetUser.id) {
      throw createHttpError(
        403,
        "Bạn không thể tự thay đổi quyền của chính mình",
      );
    }

    if (!canAssignRole(actorRole, nextRole)) {
      throw createHttpError(
        403,
        "You do not have permission to assign this role",
      );
    }
  }

  const hasAssignmentsPayload =
    payload.departments !== undefined ||
    payload.groups !== undefined ||
    payload.department !== undefined ||
    payload.departmentAliases !== undefined ||
    payload.departmentIds !== undefined ||
    payload.group !== undefined ||
    payload.groupAliases !== undefined ||
    payload.groupIds !== undefined ||
    payload.functions !== undefined;

  let parsed = {
    functions: targetUser.functions || [],
    departments: targetUser.departments || [],
    groups: targetUser.groups || [],
  };

  if (hasAssignmentsPayload) {
    parsed = await parseDecoupledAssignments({
      ...payload,
      functions:
        payload.functions !== undefined
          ? payload.functions
          : targetUser.functions || [],
    });
  }

  validateDepartmentAndGroupRules(actor, actorRoleName, targetUser, parsed);

  const nextDepts = parsed.departments.map((d) => d.deptAlias);
  ensureDepartmentByRole(nextRole.name, nextDepts);

  const scopePayload = {
    departmentAliases: parsed.departments.map((d) => d.deptAlias),
    groupAliases: parsed.groups.map((g) => g.groupAlias),
  };

  if (
    actorRoleName === MANAGER_ROLE_NAME &&
    !isWithinManagerScope(actor, scopePayload)
  ) {
    throw createHttpError(
      403,
      "Manager chỉ được update nhân viên trong phạm vi quản lý của mình",
    );
  }

  const oldState = targetUser.toObject();

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

  if (Array.isArray(parsed.functions) && parsed.functions.length > 0) {
    const validFunctions = await StaffFunction.find({
      id: { $in: parsed.functions },
    })
      .select("id")
      .lean();
    if (validFunctions.length !== parsed.functions.length) {
      throw createHttpError(400, "One or more Functions are invalid");
    }
  }
  targetUser.functions = parsed.functions;
  targetUser.departments = parsed.departments;
  targetUser.groups = parsed.groups;

  if (
    payload.functionalGroups !== undefined &&
    Array.isArray(payload.functionalGroups)
  ) {
    if (payload.functionalGroups.length > 0) {
      const validGroups = await FunctionalGroup.find({
        id: { $in: payload.functionalGroups },
      })
        .select("id")
        .lean();
      if (validGroups.length !== payload.functionalGroups.length) {
        throw createHttpError(400, "One or more Functional Groups are invalid");
      }
    }
    targetUser.functionalGroups = payload.functionalGroups;
  }

  if (payload.companies !== undefined && Array.isArray(payload.companies)) {
    if (payload.companies.length > 0) {
      const validCompanies = await Company.find({
        id: { $in: payload.companies },
      })
        .select("id")
        .lean();
      if (validCompanies.length !== payload.companies.length) {
        throw createHttpError(400, "One or more Companies are invalid");
      }
    }
    targetUser.companies = payload.companies;
  }
  targetUser.phone =
    payload.phone !== undefined
      ? normalizeString(payload.phone)
      : targetUser.phone;
  targetUser.roleId = nextRole.id;

  let forceLogout = false;
  if (
    payload.moduleAccess !== undefined &&
    Array.isArray(payload.moduleAccess)
  ) {
    const isChangingModuleAccess = () => {
      const currentAccess = targetUser.moduleAccess || [];
      const nextAccess = payload.moduleAccess || [];
      if (currentAccess.length !== nextAccess.length) return true;
      for (let i = 0; i < currentAccess.length; i++) {
        const c = currentAccess[i];
        const n = nextAccess.find((x) => x.moduleId === c.moduleId);
        if (!n) return true;
        if (n.isEnabled !== c.isEnabled) return true;
        const cPerms = c.customPermissions || [];
        const nPerms = n.customPermissions || [];
        if (cPerms.length !== nPerms.length) return true;
        if (cPerms.some((p, idx) => p !== nPerms[idx])) return true;
      }
      return false;
    };

    if (isChangingModuleAccess()) {
      if (!isOwnerOrAdmin(actorRoleName)) {
        throw createHttpError(
          403,
          "Chỉ có Owner hoặc Admin mới có quyền cấu hình phân quyền module cho nhân viên",
        );
      }
    }

    targetUser.moduleAccess = payload.moduleAccess;
    targetUser.permissions = computePermissionsFromModuleAccess(
      payload.moduleAccess,
      nextRole.name,
    );
    forceLogout = true;
  } else if (nextRole.id !== targetCurrentRole?.id) {
    targetUser.permissions = computePermissionsFromModuleAccess(
      targetUser.moduleAccess,
      nextRole.name,
    );
    forceLogout = true;
  }

  if (forceLogout) {
    targetUser.sessions = [];
  }

  targetUser.isActive =
    payload.isActive !== undefined ? payload.isActive : targetUser.isActive;

  await targetUser.save();

  const newState = targetUser.toObject();
  const keysToCheck = [
    "name",
    "email",
    "avatar",
    "companies",
    "phone",
    "roleId",
    "isActive",
    "functionalGroups",
    "functions",
    "departments",
    "groups",
    "moduleAccess",
  ];
  const changes = computeChanges(oldState, newState, keysToCheck);

  await CacheService.bumpNamespaceVersion("users");
  return { user: serializeUser(targetUser), changes };
}

async function updateOwnProfile(actor, payload = {}) {
  await ensureOrgDirectoryCache();
  const actorRoleName = await getUserRoleName(actor);
  const safePayload = { ...payload };
  delete safePayload.role;
  delete safePayload.roleId;

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
  actor.companies =
    safePayload.companies !== undefined && Array.isArray(safePayload.companies)
      ? safePayload.companies
      : actor.companies;
  actor.preferences =
    safePayload.preferences !== undefined
      ? safePayload.preferences
      : actor.preferences;

  if (isOwnerOrAdmin(actorRoleName)) {
    const hasAssignmentsPayload =
      safePayload.departments !== undefined ||
      safePayload.groups !== undefined ||
      safePayload.department !== undefined ||
      safePayload.departmentAliases !== undefined ||
      safePayload.departmentIds !== undefined ||
      safePayload.group !== undefined ||
      safePayload.groupAliases !== undefined ||
      safePayload.groupIds !== undefined ||
      safePayload.functions !== undefined;

    if (hasAssignmentsPayload) {
      const parsed = await parseDecoupledAssignments({
        ...safePayload,
        functions:
          safePayload.functions !== undefined
            ? safePayload.functions
            : actor.functions || [],
      });
      actor.functions = parsed.functions;
      actor.departments = parsed.departments;
      actor.groups = parsed.groups;
    }
  } else if (actorRoleName === MANAGER_ROLE_NAME) {
    const hasAssignmentsPayload =
      safePayload.departments !== undefined ||
      safePayload.groups !== undefined ||
      safePayload.department !== undefined ||
      safePayload.departmentAliases !== undefined ||
      safePayload.departmentIds !== undefined ||
      safePayload.group !== undefined ||
      safePayload.groupAliases !== undefined ||
      safePayload.groupIds !== undefined ||
      safePayload.functions !== undefined;

    if (hasAssignmentsPayload) {
      const parsed = await parseDecoupledAssignments({
        ...safePayload,
        functions:
          safePayload.functions !== undefined
            ? safePayload.functions
            : actor.functions || [],
      });

      const scopePayload = {
        departmentAliases: parsed.departments.map((d) => d.deptAlias),
        groupAliases: parsed.groups.map((g) => g.groupAlias),
      };

      if (!isWithinManagerScope(actor, scopePayload)) {
        throw createHttpError(
          403,
          "Manager can only update profile within assigned department/group scope",
        );
      }

      actor.functions = parsed.functions;
      actor.departments = parsed.departments;
      actor.groups = parsed.groups;
    }
  }

  await actor.save();
  await CacheService.bumpNamespaceVersion("users");
  return serializeUser(actor);
}

async function deleteUserAccount(actor, targetUser, { force = false } = {}) {
  const actorRole = await getUserRoleWithPermissions(actor);
  const targetRole = await getUserRoleWithPermissions(targetUser);
  const actorRoleName = actorRole?.name || null;
  const targetRoleName = targetRole?.name || null;

  // ── Guard 1: Cannot delete own account ───────────────────────────────────
  if (targetUser.id === actor.id) {
    throw createHttpError(400, "You cannot delete your own account");
  }

  // ── Guard 2: Only OWNER can delete other OWNER accounts ──────────────────
  if (targetRoleName === OWNER_ROLE_NAME && actorRoleName !== OWNER_ROLE_NAME) {
    throw createHttpError(
      403,
      "You do not have permission to delete this user",
    );
  }

  // ── Guard 3: Protect the last OWNER in the system ────────────────────────
  if (targetRoleName === OWNER_ROLE_NAME) {
    const ownerRole = await Role.findOne({ name: OWNER_ROLE_NAME }).lean();
    const ownerCount = ownerRole
      ? await User.countDocuments({ roleId: ownerRole.id })
      : 0;
    if (ownerCount <= 1) {
      throw createHttpError(
        403,
        "Cannot delete the last owner of the organization",
      );
    }
  }

  // ── Guard 5: Referential integrity — check Events assigned to this user ──
  if (!force) {
    const assignedEvents = await Event.find(
      { "assignees.userId": targetUser.id },
      { id: 1, name: 1 },
    ).lean();
    if (assignedEvents.length > 0) {
      throw createHttpError(
        409,
        `Người dùng đang được gán cho ${assignedEvents.length} sự kiện`,
        {
          code: "RESOURCE_IN_USE",
          references: assignedEvents.map((e) => ({
            type: "Event",
            id: e.id,
            name: e.name,
          })),
        },
      );
    }
  } else {
    // Force delete: nullify references in Events
    await Event.updateMany(
      { "assignees.userId": targetUser.id },
      {
        $pull: {
          assignees: { userId: targetUser.id },
        },
      },
    );
  }

  await targetUser.softDelete();
  await CacheService.bumpNamespaceVersion("users");
  return targetUser;
}

async function restoreUserAccount(actor, userId) {
  const actorRole = await getUserRoleWithPermissions(actor);
  const actorRoleName = actorRole?.name || null;

  // Only OWNER/ADMIN can restore
  if (!isOwnerOrAdmin(actorRoleName)) {
    throw createHttpError(403, "You do not have permission to restore users");
  }

  const targetUser = await User.findOneWithDeleted({ id: userId });
  if (!targetUser) {
    throw createHttpError(404, "User not found");
  }
  if (!targetUser.isDeleted) {
    throw createHttpError(400, "User is not deleted");
  }

  await targetUser.restore();
  await CacheService.bumpNamespaceVersion("users");
  return serializeUser(targetUser);
}

/**
 * Xóa vĩnh viễn user đã bị soft-delete khỏi DB.
 * Chỉ OWNER/ADMIN được phép. Chỉ hoạt động trên bản ghi có isDeleted = true.
 */
async function permanentDeleteUserAccount(actor, userId) {
  const actorRole = await getUserRoleWithPermissions(actor);
  const actorRoleName = actorRole?.name || null;

  // Only OWNER/ADMIN can permanently delete
  if (!isOwnerOrAdmin(actorRoleName)) {
    throw createHttpError(
      403,
      "You do not have permission to permanently delete users",
    );
  }

  const targetUser = await User.findOneWithDeleted({ id: userId });
  if (!targetUser) {
    throw createHttpError(404, "User not found");
  }
  if (!targetUser.isDeleted) {
    throw createHttpError(
      400,
      "Chỉ có thể xóa vĩnh viễn nhân viên đã bị xóa mềm",
    );
  }

  // Cannot permanently delete own account
  if (targetUser.id === actor.id) {
    throw createHttpError(
      400,
      "You cannot permanently delete your own account",
    );
  }

  // Cascade: nullify references in Events
  await Event.updateMany(
    { "assignees.userId": targetUser.id },
    {
      $pull: { assignees: { userId: targetUser.id } },
    },
  );

  await targetUser.deleteOne();
  await CacheService.bumpNamespaceVersion("users");
  return targetUser;
}

async function getOrgOptions(actor) {
  const roleName = await getUserRoleName(actor);
  const isAdminOrOwner = isOwnerOrAdmin(roleName);
  const isManager = roleName === MANAGER_ROLE_NAME;

  if (!isAdminOrOwner && !isManager) {
    return { departments: [], groups: [] };
  }

  if (isAdminOrOwner) {
    const orgs = await Organization.find({}).select("parent children");
    const departments = orgs.map((o) => o.parent).sort();
    const groups = orgs.flatMap((o) => o.children.map((c) => c.name)).sort();
    return { departments, groups };
  }

  const self = await User.findOne({ id: actor.id }).select("department group");
  const departments = (self?.department || []).sort();
  const groups = (self?.group || []).sort();
  return { departments, groups };
}

module.exports = {
  createUserAccount,
  deleteUserAccount,
  ensureOrgDirectoryCache,
  getOrgOptions,
  listUsers,
  permanentDeleteUserAccount,
  restoreUserAccount,
  serializeUser,
  updateUserAccount,
  updateOwnProfile,
};
