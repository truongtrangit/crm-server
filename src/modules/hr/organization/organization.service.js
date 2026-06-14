const Organization = require('./organization.model');
const CacheService = require('../../../core/services/CacheService');
const { buildPaginatedResponse, resolvePagination } = require('../../../core/utils/pagination');
const { buildDepartmentAlias, buildGroupAlias } = require('../../../core/utils/organization');
const { generateMonotonicId, ID_PREFIXES } = require('../../../core/utils/id');

class OrganizationService {
  async getOrganizations(query) {
    const { page, limit, skip } = resolvePagination(query || {});
    const [organization, totalItems] = await Promise.all([
      Organization.find().sort({ createdAt: 1, id: 1 }).skip(skip).limit(limit).lean(),
      Organization.countDocuments(),
    ]);

    return buildPaginatedResponse(organization, totalItems, page, limit);
  }

  async createDepartment(payload) {
    const { name, alias: rawAlias } = payload;
    const alias = rawAlias || buildDepartmentAlias(name);

    if (!alias) {
      const error = new Error("alias is invalid");
      error.status = 400;
      error.code = "VALIDATION_ERROR";
      throw error;
    }

    const existingDepartment = await Organization.findOne({
      $or: [{ parent: name }, { alias }],
    });

    if (existingDepartment) {
      const error = new Error("Department already exists");
      error.status = 409;
      error.code = "DEPARTMENT_ALREADY_EXISTS";
      throw error;
    }

    const department = await Organization.create({
      id: await generateMonotonicId(ID_PREFIXES.ORGANIZATION),
      alias,
      parent: name,
      children: [],
    });

    await CacheService.bumpNamespaceVersion("metadata");
    return department;
  }

  async createGroup(payload) {
    const { name, desc = "", parentId, parentAlias, alias: rawAlias } = payload;

    const department = await Organization.findOne({
      $or: [{ id: parentId }, { alias: parentAlias }],
    });

    if (!department) {
      const error = new Error("Department not found");
      error.status = 404;
      error.code = "DEPARTMENT_NOT_FOUND";
      throw error;
    }

    const departmentAlias = department.alias || buildDepartmentAlias(department.parent);
    const alias = rawAlias || buildGroupAlias(departmentAlias, name);

    if (!alias) {
      const error = new Error("alias is invalid");
      error.status = 400;
      error.code = "VALIDATION_ERROR";
      throw error;
    }

    const duplicatedGroup = department.children.find(
      (item) => item.name === name || item.alias === alias,
    );

    if (duplicatedGroup) {
      const error = new Error("Group already exists");
      error.status = 409;
      error.code = "GROUP_ALREADY_EXISTS";
      throw error;
    }

    department.children.push({ name, desc, alias });
    await department.save();

    await CacheService.bumpNamespaceVersion("metadata");
    return {
      alias,
      name,
      desc,
      parentId: department.id,
      parentAlias: departmentAlias,
    };
  }
}

module.exports = new OrganizationService();
