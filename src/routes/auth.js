const express = require("express");
const User = require("../models/User");
const { authenticateRequest, authorizeRoles } = require("../middleware/auth");
const { USER_ROLE_VALUES } = require("../constants/appData");
const { sendError, sendSuccess } = require("../utils/http");
const {
  buildAuthResponse,
  clearRefreshCookies,
  createSessionTokens,
  getRefreshContext,
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

const router = express.Router();

router.post("/login", async (req, res) => {
  const email =
    typeof req.body?.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";
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

router.post(
  "/register",
  authenticateRequest,
  authorizeRoles(
    USER_ROLE_VALUES.OWNER,
    USER_ROLE_VALUES.ADMIN,
    USER_ROLE_VALUES.MANAGER,
  ),
  async (req, res) => {
    const user = await createUserAccount(req.user, req.body || {});
    return sendSuccess(res, 201, "Register user success", user);
  },
);

module.exports = router;
