const User = require("../models/User");
const { hashToken, readBearerToken } = require("../utils/auth");
const { sendError } = require("../utils/http");

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

  session.lastUsedAt = new Date();
  await user.save();

  req.auth = { user, session };
  req.user = user;

  return next();
}

function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return sendError(res, 403, "Forbidden", {
        code: "FORBIDDEN",
      });
    }

    return next();
  };
}

module.exports = {
  authenticateRequest,
  authorizeRoles,
};
