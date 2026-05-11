const Organization = require("../models/Organization");
const Role = require("../models/Role");
const CacheService = require("./CacheService");
const env = require("../config/env");
const { CACHE_TTL } = require("../constants/cache");
const { PLATFORMS, CUSTOMER_GROUPS, CUSTOMER_TYPES } = require("../constants/appData");
const { buildOrganizationDirectory } = require("../utils/organization");

class MetadataService {
  _formatRoleLabel(roleName) {
    return String(roleName || "")
      .toLowerCase()
      .split(/[_\s]+/)
      .filter(Boolean)
      .map((item) => item.charAt(0).toUpperCase() + item.slice(1))
      .join(" ");
  }

  _formatRoleMetadata(role) {
    return {
      id: role.id,
      value: role.name,
      label: this._formatRoleLabel(role.name),
      name: role.name,
      description: role.description || "",
      level: role.level || 0,
      isSystem: Boolean(role.isSystem),
    };
  }

  _formatOrganizationMetadata(departments) {
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

    const activityGroups = departmentOptions.flatMap((department) => department.groups);

    return {
      departments: departmentOptions.map((item) => item.label),
      departmentOptions,
      departmentGroups: departmentOptions,
      activityGroups,
    };
  }

  async getDerivedMetadata() {
    return CacheService.withVersionedCache("metadata", { derived: true }, CACHE_TTL.LONG, async () => {
      const roles = await Role.find(
        {},
        { id: 1, name: 1, description: 1, level: 1, isSystem: 1 },
      )
        .sort({ level: -1, name: 1 })
        .lean();
      const departments = await Organization.find()
        .sort({ createdAt: 1, id: 1 })
        .lean();
      const roleOptions = roles.map((role) => this._formatRoleMetadata(role));
      const organizationMetadata = this._formatOrganizationMetadata(departments);

      return {
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
    }, { swr: true, maxTtl: 86400 });
  }
}

module.exports = new MetadataService();
