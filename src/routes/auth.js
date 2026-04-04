const express = require("express");
const User = require("../models/User");
const {
  authenticateRequest,
  requirePermission,
} = require("../middleware/auth");
const { sendError, sendSuccess } = require("../utils/http");
const {
  buildAuthResponse,
  clearRefreshCookies,
  createPasswordResetToken,
  createSessionTokens,
  getRefreshContext,
  hashPassword,
  hashToken,
  readBearerToken,
  rotateSessionTokens,
  setRefreshCookies,
  verifyPassword,
} = require("../utils/auth");
const {
  createUserAccount,
  serializeUser,
} = require("../services/userManagement");
const { PERMISSIONS } = require("../constants/rbac");
const { DEFAULT_PASSWORD_STRENGTH } = require("../constants/appData");

const router = express.Router();

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function ensureStrongPassword(password) {
  if (
    typeof password !== "string" ||
    password.length < DEFAULT_PASSWORD_STRENGTH
  ) {
    return `password must be at least ${DEFAULT_PASSWORD_STRENGTH} characters`;
  }

  return null;
}

function clearSensitiveUserState(user) {
  user.sessions = [];
  user.passwordReset = {
    tokenHash: null,
    expiresAt: null,
    requestedAt: null,
  };
}

router.post("/login", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password =
    typeof req.body?.password === "string" ? req.body.password : "";

  if (!email || !password) {
    return sendError(res, 400, "email and password are required", {
      code: "VALIDATION_ERROR",
    });
  }

  const user = await User.findOne({ email });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return sendError(res, 401, "Invalid email or password", {
      code: "INVALID_CREDENTIALS",
    });
  }

  user.sessions = user.sessions.filter(
    (session) => new Date(session.refreshTokenExpiresAt).getTime() > Date.now(),
  );

  const tokens = createSessionTokens(req);
  user.sessions.push(tokens.session);
  user.lastLoginAt = new Date();
  await user.save();

  setRefreshCookies(res, tokens);
  return sendSuccess(
    res,
    200,
    "Login success",
    buildAuthResponse(user, tokens, serializeUser),
  );
});

router.post("/refresh", async (req, res) => {
  const { sessionId, refreshToken } = getRefreshContext(req);

  if (!sessionId || !refreshToken) {
    return sendError(res, 400, "sessionId and refreshToken are required", {
      code: "VALIDATION_ERROR",
    });
  }

  const user = await User.findOne({ "sessions.sessionId": sessionId });

  if (!user) {
    clearRefreshCookies(res);
    return sendError(res, 401, "Invalid session", {
      code: "INVALID_SESSION",
    });
  }

  const session = user.sessions.find((item) => item.sessionId === sessionId);

  if (!session) {
    clearRefreshCookies(res);
    return sendError(res, 401, "Invalid session", {
      code: "INVALID_SESSION",
    });
  }

  if (
    session.refreshTokenHash !== hashToken(refreshToken) ||
    new Date(session.refreshTokenExpiresAt).getTime() <= Date.now()
  ) {
    user.sessions = user.sessions.filter(
      (item) => item.sessionId !== sessionId,
    );
    await user.save();
    clearRefreshCookies(res);

    return sendError(res, 401, "Refresh token is invalid or expired", {
      code: "INVALID_REFRESH_TOKEN",
    });
  }

  const tokens = rotateSessionTokens(session, req);
  await user.save();

  setRefreshCookies(res, tokens);
  return sendSuccess(
    res,
    200,
    "Refresh token success",
    buildAuthResponse(user, tokens, serializeUser),
  );
});

router.post("/forgot-password", async (req, res) => {
  const email = normalizeEmail(req.body?.email);

  if (!email) {
    return sendError(res, 400, "email is required", {
      code: "VALIDATION_ERROR",
    });
  }

  const passwordReset = createPasswordResetToken();
  const user = await User.findOne({ email });

  if (user) {
    user.passwordReset = {
      tokenHash: passwordReset.tokenHash,
      expiresAt: passwordReset.expiresAt,
      requestedAt: new Date(),
    };
    await user.save();
  }

  return sendSuccess(res, 200, "Forgot password request success", {
    email,
    resetToken: passwordReset.token,
    resetTokenExpiresAt: passwordReset.expiresAt,
  });
});

router.post("/reset-password", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const resetToken =
    typeof req.body?.resetToken === "string" ? req.body.resetToken.trim() : "";
  const newPassword =
    typeof req.body?.newPassword === "string" ? req.body.newPassword : "";

  if (!email || !resetToken || !newPassword) {
    return sendError(
      res,
      400,
      "email, resetToken and newPassword are required",
      {
        code: "VALIDATION_ERROR",
      },
    );
  }

  const passwordError = ensureStrongPassword(newPassword);

  if (passwordError) {
    return sendError(res, 400, passwordError, {
      code: "VALIDATION_ERROR",
    });
  }

  const user = await User.findOne({ email });
  const passwordReset = user?.passwordReset || {};

  if (
    !user ||
    !passwordReset.tokenHash ||
    passwordReset.tokenHash !== hashToken(resetToken) ||
    !passwordReset.expiresAt ||
    new Date(passwordReset.expiresAt).getTime() <= Date.now()
  ) {
    return sendError(res, 400, "resetToken is invalid or expired", {
      code: "INVALID_RESET_TOKEN",
    });
  }

  if (await verifyPassword(newPassword, user.passwordHash)) {
    return sendError(
      res,
      400,
      "newPassword must be different from current password",
      {
        code: "VALIDATION_ERROR",
      },
    );
  }

  user.passwordHash = await hashPassword(newPassword);
  clearSensitiveUserState(user);
  await user.save();
  clearRefreshCookies(res);

  return sendSuccess(res, 200, "Reset password success", null);
});

router.post("/logout", async (req, res) => {
  const accessToken = readBearerToken(req);
  const refreshContext = getRefreshContext(req);
  let user = null;
  let sessionId = null;

  if (accessToken) {
    user = await User.findOne({
      "sessions.accessTokenHash": hashToken(accessToken),
    });

    if (user) {
      const session = user.sessions.find(
        (item) => item.accessTokenHash === hashToken(accessToken),
      );
      sessionId = session?.sessionId || null;
    }
  }

  if (!user && refreshContext.sessionId && refreshContext.refreshToken) {
    user = await User.findOne({
      "sessions.sessionId": refreshContext.sessionId,
    });

    if (user) {
      const session = user.sessions.find(
        (item) =>
          item.sessionId === refreshContext.sessionId &&
          item.refreshTokenHash === hashToken(refreshContext.refreshToken),
      );

      sessionId = session?.sessionId || null;
    }
  }

  if (user && sessionId) {
    user.sessions = user.sessions.filter(
      (item) => item.sessionId !== sessionId,
    );
    await user.save();
  }

  clearRefreshCookies(res);
  return sendSuccess(res, 200, "Logout success", null);
});

router.get("/me", authenticateRequest, async (req, res) => {
  return sendSuccess(res, 200, "Get current user success", {
    user: serializeUser(req.user),
  });
});

router.post("/change-password", authenticateRequest, async (req, res) => {
  const currentPassword =
    typeof req.body?.currentPassword === "string"
      ? req.body.currentPassword
      : "";
  const newPassword =
    typeof req.body?.newPassword === "string" ? req.body.newPassword : "";

  if (!currentPassword || !newPassword) {
    return sendError(res, 400, "currentPassword and newPassword are required", {
      code: "VALIDATION_ERROR",
    });
  }

  const passwordError = ensureStrongPassword(newPassword);

  if (passwordError) {
    return sendError(res, 400, passwordError, {
      code: "VALIDATION_ERROR",
    });
  }

  if (!(await verifyPassword(currentPassword, req.user.passwordHash))) {
    return sendError(res, 401, "Current password is incorrect", {
      code: "INVALID_CURRENT_PASSWORD",
    });
  }

  if (await verifyPassword(newPassword, req.user.passwordHash)) {
    return sendError(
      res,
      400,
      "newPassword must be different from current password",
      {
        code: "VALIDATION_ERROR",
      },
    );
  }

  req.user.passwordHash = await hashPassword(newPassword);
  clearSensitiveUserState(req.user);
  await req.user.save();
  clearRefreshCookies(res);

  return sendSuccess(res, 200, "Change password success", null);
});

router.post(
  "/register",
  authenticateRequest,
  requirePermission(PERMISSIONS.USERS_CREATE),
  async (req, res) => {
    const user = await createUserAccount(req.user, req.body || {});
    return sendSuccess(res, 201, "Register user success", user);
  },
);

module.exports = router;
