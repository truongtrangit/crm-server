const Permission = require("../models/Permission");
const Role = require("../models/Role");
const User = require("../models/User");
const {
  PERMISSIONS,
  ROLE_DEFINITIONS,
  RESOURCES,
  ACTIONS,
} = require("../constants/rbac");


/**
 * Seed permissions and roles into database
 */
async function seedRbac() {
  try {
    console.log("Starting RBAC seed...");

    const permissionDocs = Object.entries(PERMISSIONS).map(([key, value]) => {
      const [resource, action] = value.split("_");
      return {
        id: value,
        name: key,
        description: `${action} permission for ${resource} resource`,
        resource,
        action,
        createdBy: "SYSTEM",
      };
    });

    if (permissionDocs.length > 0) {
      await Permission.bulkWrite(
        permissionDocs.map((permission) => ({
          updateOne: {
            filter: { id: permission.id },
            update: { $set: permission },
            upsert: true,
          },
        })),
      );
    }

    console.log(`✓ Synced ${permissionDocs.length} permissions`);

    const roleDocs = Object.values(ROLE_DEFINITIONS).map((roleConfig) => ({
      id: roleConfig.name.toLowerCase(),
      name: roleConfig.name,
      description: roleConfig.description,
      level: roleConfig.level,
      permissions: roleConfig.permissions,
      isSystem: true,
      createdBy: "SYSTEM",
    }));

    if (roleDocs.length > 0) {
      await Role.bulkWrite(
        roleDocs.map((role) => ({
          updateOne: {
            filter: { id: role.id },
            update: { $set: role },
            upsert: true,
          },
        })),
      );
    }

    console.log(`✓ Synced ${roleDocs.length} system roles`);

    console.log("✓ RBAC seed completed successfully");
    return true;
  } catch (error) {
    console.error("Error seeding RBAC:", error);
    throw error;
  }
}

/**
 * Migrate existing users to use RBAC
 * Maps old role field to new roleId field
 */
async function migrateUsersToRbac() {
  try {
    console.log("Starting user migration to RBAC...");

    const roles = await Role.find({}, { id: 1, name: 1 }).lean();
    const rolesById = new Map(roles.map((role) => [role.id, role]));
    const staffRole = roles.find((r) => r.name === "STAFF") || null;

    // Only migrate users that don't have a valid roleId yet
    const users = await User.find({ $or: [{ roleId: null }, { roleId: { $exists: false } }] });
    let migrated = 0;

    for (const user of users) {
      const role = rolesById.get(user.roleId) || staffRole;
      if (!role) continue;

      user.roleId = role.id;
      await user.save();
      migrated++;
    }

    console.log(`✓ Migrated ${migrated} users to RBAC`);
    return migrated;
  } catch (error) {
    console.error("Error migrating users to RBAC:", error);
    throw error;
  }
}

module.exports = {
  seedRbac,
  migrateUsersToRbac,
};
