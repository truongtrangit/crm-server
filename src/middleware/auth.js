const User = require("../models/User");
const { hashToken, readBearerToken } = require("../utils/auth");
const { sendError } = require("../utils/http");
const {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
} = require("../utils/rbac");

async function authenticateRequest(req, res, next) {
  const accessToken = readBearerToken(req);

  if (!accessToken) {
    return sendError(res, 401, "Authentication required", {
      code: "AUTHENTICATION_REQUIRED",
    });
  }

  const user = await User.findOne({
    "sessions.accessTokenHash": hashToken(accessToken),
  });

  if (!user) {
    return sendError(res, 401, "Invalid or expired access token", {
      code: "INVALID_ACCESS_TOKEN",
    });
  }

  const session = user.sessions.find(
    (item) => item.accessTokenHash === hashToken(accessToken),
  );

  if (!session) {
    return sendError(res, 401, "Invalid or expired access token", {
      code: "INVALID_ACCESS_TOKEN",
    });
  }

  if (new Date(session.accessTokenExpiresAt).getTime() <= Date.now()) {
    user.sessions = user.sessions.filter(
      (item) => item.sessionId !== session.sessionId,
    );
    await user.save();

    return sendError(res, 401, "Access token has expired", {
      code: "ACCESS_TOKEN_EXPIRED",
    });
  }

  const now = new Date();
  const lastUsed = session.lastUsedAt ? new Date(session.lastUsedAt).getTime() : 0;

  // Throttle DB updates to once every 5 minutes (300,000 ms) per session
  if (now.getTime() - lastUsed > 5 * 60 * 1000) {
    session.lastUsedAt = now;
    await user.save();
  }

  req.auth = { user, session };
  req.user = user;

  return next();
}

/**
 * Middleware to check if user has specific permission(s)
 * Usage: requirePermission(PERMISSIONS.USERS_MANAGE)
 *        requirePermission([PERMISSIONS.USERS_READ, PERMISSIONS.USERS_CREATE], 'any')
 */
function requirePermission(...permissionsOrOptions) {
  return async (req, res, next) => {
    if (!req.user) {
      return sendError(res, 401, "Bạn cần đăng nhập để thực hiện hành động này", {
        code: "AUTHENTICATION_REQUIRED",
      });
    }

    let permissions = [];
    let checkType = "all"; // 'all' or 'any'

    // Parse arguments
    if (Array.isArray(permissionsOrOptions[0])) {
      permissions = permissionsOrOptions[0];
      checkType = permissionsOrOptions[1] || "all";
    } else {
      permissions = permissionsOrOptions;
      checkType = "all";
    }

    let authorized = false;

    if (checkType === "any") {
      authorized = await hasAnyPermission(req.user, permissions);
    } else {
      if (permissions.length > 1) {
        authorized = await hasAllPermissions(req.user, permissions);
      } else if (permissions.length === 1) {
        authorized = await hasPermission(req.user, permissions[0]);
      }
    }

    if (!authorized) {
      return sendError(res, 403, "Bạn không có quyền thực hiện hành động này", {
        code: "INSUFFICIENT_PERMISSION",
        requiredPermissions: permissions,
      });
    }

    return next();
  };
}

/**
 * Middleware to check if user has specific role(s)
 * Usage: requireRole(["OWNER", "ADMIN"])
 */
function requireRole(allowedRoles) {
  return async (req, res, next) => {
    if (!req.user) {
      return sendError(res, 401, "Bạn cần đăng nhập để thực hiện hành động này", {
        code: "AUTHENTICATION_REQUIRED",
      });
    }

    const roleName = (req.user.roleId || "").toUpperCase();
    
    if (!allowedRoles.includes(roleName)) {
      return sendError(res, 403, "Bạn không có quyền thực hiện hành động này", {
        code: "INSUFFICIENT_ROLE",
        requiredRoles: allowedRoles,
      });
    }

    return next();
  };
}

/**
 * Module-Level Access Control (MLAC) middleware.
 *
 * Checks if the user has access to a specific module and (optionally) a specific
 * action within that module. If the user has `customPermissions` set for the module,
 * those take precedence. Otherwise, the request passes through and falls back to
 * the existing RBAC/RLAC middleware downstream.
 *
 * Usage:
 *   requireModuleAccess("meta")                // Check module access only
 *   requireModuleAccess("meta", "create")       // Check module + action
 *   requireModuleAccess("operations.events", "edit")
 */
function requireModuleAccess(moduleId, action) {
  return (req, res, next) => {
    const user = req.user;
    if (!user) {
      return sendError(res, 401, "Bạn cần đăng nhập để thực hiện hành động này", {
        code: "AUTHENTICATION_REQUIRED",
      });
    }

    // OWNER always bypasses module access checks
    const roleName = (user.roleId || "").toUpperCase();
    if (roleName === "OWNER") return next();

    // If user has no moduleAccess config at all -> backward compat, allow everything
    const moduleAccessList = user.moduleAccess || [];
    if (moduleAccessList.length === 0) return next();

    // For sub-modules (e.g. "operations.events"), also check parent module
    const parts = moduleId.split(".");
    if (parts.length > 1) {
      const parentModuleId = parts[0];
      const parentConf = moduleAccessList.find((m) => m.moduleId === parentModuleId);
      if (parentConf && !parentConf.isEnabled) {
        return sendError(res, 403, "Bạn không có quyền truy cập module này.", {
          code: "MODULE_ACCESS_DENIED",
          moduleId: parentModuleId,
        });
      }
    }

    const moduleConf = moduleAccessList.find((m) => m.moduleId === moduleId);

    // Module not in user's configured list → DENIED
    // (admin configured MLAC but didn't include this module)
    if (!moduleConf) {
      return sendError(res, 403, "Bạn không có quyền truy cập module này.", {
        code: "MODULE_ACCESS_DENIED",
        moduleId,
      });
    }

    // Module is explicitly disabled
    if (!moduleConf.isEnabled) {
      return sendError(res, 403, "Bạn không có quyền truy cập module này.", {
        code: "MODULE_ACCESS_DENIED",
        moduleId,
      });
    }

    // If no action check requested, module-level access is sufficient
    if (!action) return next();

    // If customPermissions is null -> fallback to RBAC (let downstream middleware handle)
    if (moduleConf.customPermissions === null || moduleConf.customPermissions === undefined) {
      return next();
    }

    // Custom permissions exist -> check if the specific action is allowed
    if (Array.isArray(moduleConf.customPermissions) && moduleConf.customPermissions.includes(action)) {
      return next();
    }

    return sendError(res, 403, "Bạn không có quyền thực hiện hành động này trong module.", {
      code: "MODULE_ACTION_DENIED",
      moduleId,
      action,
    });
  };
}

module.exports = {
  authenticateRequest,
  requirePermission,
  requireRole,
  requireModuleAccess,
};
