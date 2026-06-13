const Role = require('./role.model');
const User = require('../user/user.model');
const Permission = require('./permission.model');
const CacheService = require('../../../core/services/CacheService');
const { computeChanges } = require('../../../core/utils/diff');

class RbacService {
  async getRoles() {
    return Role.find();
  }

  async getRoleById(id) {
    const role = await Role.findOne({ id });

    if (!role) {
      const error = new Error("Role not found");
      error.status = 404;
      error.code = "ROLE_NOT_FOUND";
      throw error;
    }

    const permissions = await Permission.find({
      id: { $in: role.permissions },
    });
    return {
      ...role.toObject(),
      permissionsDetails: permissions,
    };
  }

  async getPermissions() {
    return Permission.find().select("-createdBy");
  }

  async getPermissionById(id) {
    const permission = await Permission.findOne({ id });

    if (!permission) {
      const error = new Error("Permission not found");
      error.status = 404;
      error.code = "PERMISSION_NOT_FOUND";
      throw error;
    }

    return permission;
  }

  async createRole(payload, user) {
    const { id, name, description, permissions, level } = payload;

    const existingRole = await Role.findOne({ id });
    if (existingRole) {
      const error = new Error("Role already exists");
      error.status = 409;
      error.code = "ROLE_ALREADY_EXISTS";
      throw error;
    }

    const role = new Role({
      id,
      name,
      description: description || "",
      permissions: permissions || [],
      level: level || 0,
      createdBy: user.id,
    });

    await role.save();
    await CacheService.del("system:metadata");
    return role;
  }

  async updateRole(id, payload) {
    const role = await Role.findOne({ id });

    if (!role) {
      const error = new Error("Role not found");
      error.status = 404;
      error.code = "ROLE_NOT_FOUND";
      throw error;
    }

    if (role.isSystem) {
      const error = new Error("System roles cannot be modified");
      error.status = 403;
      error.code = "FORBIDDEN";
      throw error;
    }

    const oldState = role.toObject();
    const { name, description, permissions, level } = payload;

    if (name) role.name = name;
    if (description !== undefined) role.description = description;
    if (Array.isArray(permissions)) role.permissions = permissions;
    if (level !== undefined) role.level = level;

    await role.save();
    const newState = role.toObject();
    const changes = computeChanges(oldState, newState, ["name", "description", "permissions", "level"]);

    await CacheService.del(`rbac:role:${id}`);
    await CacheService.del("system:metadata");

    return { role, changes };
  }

  async deleteRole(id, force) {
    const role = await Role.findOne({ id });

    if (!role) {
      const error = new Error("Role not found");
      error.status = 404;
      error.code = "ROLE_NOT_FOUND";
      throw error;
    }

    if (role.isSystem) {
      const error = new Error("System roles cannot be deleted");
      error.status = 403;
      error.code = "FORBIDDEN";
      throw error;
    }

    if (!force) {
      const usersWithRole = await User.find({ roleId: id }, { id: 1, name: 1 }).lean();
      if (usersWithRole.length > 0) {
        const error = new Error(`Vai trò đang được gán cho ${usersWithRole.length} người dùng`);
        error.status = 409;
        error.code = "RESOURCE_IN_USE";
        error.references = usersWithRole.map(u => ({ type: "User", id: u.id, name: u.name }));
        throw error;
      }
    } else {
      await User.updateMany(
        { roleId: id },
        { $set: { roleId: null } },
      );
    }

    await Role.deleteOne({ id });
    await CacheService.del(`rbac:role:${id}`);
    await CacheService.del("system:metadata");
    return role;
  }
}

module.exports = new RbacService();
