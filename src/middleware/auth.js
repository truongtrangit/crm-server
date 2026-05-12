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

module.exports = {
  authenticateRequest,
  requirePermission,
};
