function normalizeOrganizationKey(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function buildDepartmentAlias(name) {
  return normalizeOrganizationKey(name);
}

function buildGroupAlias(departmentAlias, groupName) {
  const groupAlias = normalizeOrganizationKey(groupName);

  if (!departmentAlias) {
    return groupAlias;
  }

  return `${departmentAlias}__${groupAlias}`;
}

function mapOrganizationDocument(organization) {
  const departmentAlias =
    organization.alias || buildDepartmentAlias(organization.parent);

  return {
    id: String(organization._id || organization.id || departmentAlias),
    code: organization.id || null,
    alias: departmentAlias,
    name: organization.parent,
    description: organization.desc || "",
    groups: Array.isArray(organization.children)
      ? organization.children.map((child) => ({
          id: String(
            child._id ||
              child.id ||
              buildGroupAlias(departmentAlias, child.name),
          ),
          code: child.id || null,
          alias: child.alias || buildGroupAlias(departmentAlias, child.name),
          name: child.name,
          description: child.desc || "",
          departmentId: String(
            organization._id || organization.id || departmentAlias,
          ),
          departmentCode: organization.id || null,
          departmentAlias,
          departmentName: organization.parent,
        }))
      : [],
  };
}

function buildOrganizationDirectory(organizations = []) {
  const departments = organizations.map(mapOrganizationDocument);
  const departmentById = new Map();
  const departmentByAlias = new Map();
  const departmentByName = new Map();
  const groupById = new Map();
  const groupByAlias = new Map();
  const groupByName = new Map();

  departments.forEach((department) => {
    departmentById.set(String(department.id), department);
    departmentByAlias.set(department.alias, department);
    departmentByName.set(department.name, department);

    department.groups.forEach((group) => {
      groupById.set(String(group.id), group);
      groupByAlias.set(group.alias, group);

      if (!groupByName.has(group.name)) {
        groupByName.set(group.name, group);
      }
    });
  });

  return {
    departments,
    activityGroups: departments.flatMap((department) => department.groups),
    departmentById,
    departmentByAlias,
    departmentByName,
    groupById,
    groupByAlias,
    groupByName,
  };
}

function resolveDepartmentReference(directory, reference) {
  const value = String(reference || "").trim();

  if (!value) {
    return null;
  }

  return (
    directory.departmentById.get(value) ||
    directory.departmentByAlias.get(value) ||
    directory.departmentByName.get(value) ||
    directory.departmentByAlias.get(buildDepartmentAlias(value)) ||
    null
  );
}

function resolveGroupReference(directory, reference) {
  const value = String(reference || "").trim();

  if (!value) {
    return null;
  }

  return (
    directory.groupById.get(value) ||
    directory.groupByAlias.get(value) ||
    directory.groupByName.get(value) ||
    directory.groupByAlias.get(normalizeOrganizationKey(value)) ||
    null
  );
}

module.exports = {
  buildDepartmentAlias,
  buildGroupAlias,
  buildOrganizationDirectory,
  normalizeOrganizationKey,
  resolveDepartmentReference,
  resolveGroupReference,
};
