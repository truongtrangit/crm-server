const express = require("express");
const Organization = require("../../models/Organization");
const Role = require("../../models/Role");
const CacheService = require("../../services/CacheService");
const env = require("../../config/env");
const { paginateArray } = require("../../utils/pagination");
const { sendSuccess } = require("../../utils/http");
const { requirePermission } = require("../../middleware/auth");
const {
  PLATFORMS,
  CUSTOMER_GROUPS,
  CUSTOMER_TYPES,
} = require("../../constants/appData");
const { PERMISSIONS } = require("../../constants/rbac");
const { buildOrganizationDirectory } = require("../../utils/organization");

const router = express.Router();

function formatRoleLabel(roleName) {
  return String(roleName || "")
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((item) => item.charAt(0).toUpperCase() + item.slice(1))
    .join(" ");
}

function formatRoleMetadata(role) {
  return {
    id: role.id,
    value: role.name,
    label: formatRoleLabel(role.name),
    name: role.name,
    description: role.description || "",
    level: role.level || 0,
    isSystem: Boolean(role.isSystem),
  };
}

function formatOrganizationMetadata(departments) {
  const directory = buildOrganizationDirectory(departments);
  const departmentOptions = directory.departments.map((item) => ({
    id: item.id,
    code: item.code,
    alias: item.alias,
    value: item.alias,
    label: item.name,
    name: item.name,
    groups: item.groups.map((child) => ({
      id: child.id,
      code: child.code,
      alias: child.alias,
      value: child.alias,
      label: child.name,
      name: child.name,
      description: child.description || "",
      departmentId: child.departmentId,
      departmentCode: child.departmentCode,
      departmentAlias: child.departmentAlias,
      departmentName: child.departmentName,
    })),
  }));

  const activityGroups = departmentOptions.flatMap(
    (department) => department.groups,
  );

  return {
    departments: departmentOptions.map((item) => item.label),
    departmentOptions,
    departmentGroups: departmentOptions,
    activityGroups,
  };
}

async function getDerivedMetadata() {
  const cacheKey = "system:metadata";
  let metadata = await CacheService.get(cacheKey);

  if (metadata) {
    return metadata;
  }

  const roles = await Role.find(
    {},
    { id: 1, name: 1, description: 1, level: 1, isSystem: 1 },
  )
    .sort({ level: -1, name: 1 })
    .lean();
  const departments = await Organization.find()
    .sort({ createdAt: 1, id: 1 })
    .lean();
  const roleOptions = roles.map(formatRoleMetadata);
  const organizationMetadata = formatOrganizationMetadata(departments);

  metadata = {
    platforms: PLATFORMS,
    customerGroups:
      organizationMetadata.activityGroups.length > 0
        ? organizationMetadata.activityGroups.map((item) => item.label)
        : CUSTOMER_GROUPS,
    customerTypes: CUSTOMER_TYPES,
    staffRoles: roleOptions,
    userRoles: roleOptions,
    departments: organizationMetadata.departments,
    departmentOptions: organizationMetadata.departmentOptions,
    departmentGroups: organizationMetadata.departmentGroups,
    activityGroups: organizationMetadata.activityGroups,
  };

  await CacheService.set(cacheKey, metadata, env.cacheMetadataTtlSeconds); 
  return metadata;
}

router.use(requirePermission(PERMISSIONS.METADATA_READ));

router.get("/", async (_req, res) => {
  const metadata = await getDerivedMetadata();
  return sendSuccess(res, 200, "Get metadata success", metadata);
});

router.get("/roles", async (req, res) => {
  const metadata = await getDerivedMetadata();

  return sendSuccess(
    res,
    200,
    "Get roles success",
    paginateArray(metadata.userRoles, req.query || {}),
  );
});

router.get("/departments", async (req, res) => {
  const metadata = await getDerivedMetadata();
  return sendSuccess(
    res,
    200,
    "Get departments success",
    paginateArray(metadata.departments, req.query || {}),
  );
});

router.get("/department-groups", async (_req, res) => {
  const metadata = await getDerivedMetadata();
  return sendSuccess(
    res,
    200,
    "Get department groups success",
    metadata.departmentGroups,
  );
});

router.get("/activity-groups", async (req, res) => {
  const metadata = await getDerivedMetadata();
  return sendSuccess(
    res,
    200,
    "Get activity groups success",
    paginateArray(metadata.activityGroups, req.query || {}),
  );
});

router.get("/customer-groups", async (req, res) => {
  const metadata = await getDerivedMetadata();
  return sendSuccess(
    res,
    200,
    "Get customer groups success",
    paginateArray(metadata.customerGroups, req.query || {}),
  );
});

module.exports = router;
