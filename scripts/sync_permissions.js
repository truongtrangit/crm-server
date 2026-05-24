const mongoose = require("mongoose");
const User = require("../src/models/User");
const { ROLE_DEFINITIONS, MODULE_TO_PERMISSIONS_MAP } = require("../src/constants/rbac");
require("dotenv").config();

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
      if (entry.customPermissions !== null && Array.isArray(entry.customPermissions)) {
        for (const action of entry.customPermissions) {
          if (actionMap[action]) {
            actionMap[action].forEach((p) => permissions.add(p));
          }
        }
      } else {
        if (role && Array.isArray(role.permissions)) {
          for (const action of Object.keys(actionMap)) {
            const requiredPerms = actionMap[action];
            const hasAllPerms = requiredPerms.every(p => role.permissions.includes(p));
            if (hasAllPerms) {
              requiredPerms.forEach(p => permissions.add(p));
            }
          }
        }
      }
    }
  }

  return Array.from(permissions);
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const users = await User.find({});
  let count = 0;
  for (const user of users) {
    if (user.moduleAccess && user.moduleAccess.length > 0) {
      const newPerms = computePermissionsFromModuleAccess(user.moduleAccess, user.roleId);
      user.permissions = newPerms;
      await user.save();
      count++;
    }
  }
  console.log(`Updated permissions for ${count} users.`);
  process.exit(0);
}

run();
