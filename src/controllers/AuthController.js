const AuthService = require("../services/AuthService");
const { sendError, sendSuccess } = require("../utils/http");
const logger = require("../utils/logger");
const {
  buildAuthResponse,
  clearRefreshCookies,
  getRefreshContext,
  readBearerToken,
  setRefreshCookies,
} = require("../utils/auth");
const {
  createUserAccount,
  serializeUser,
  updateOwnProfile,
  ensureOrgDirectoryCache,
} = require("../services/UserService");

class AuthController {
  login = async (req, res) => {
    try {
      await ensureOrgDirectoryCache();
      const { user, tokens } = await AuthService.login(req.body, req);
      logger.info("Login success", { userId: user.id, email: user.email });

      setRefreshCookies(res, tokens);
      return sendSuccess(
        res,
        200,
        "Login success",
        buildAuthResponse(user, tokens, serializeUser),
      );
    } catch (error) {
      if (error.context) {
        logger.warn(error.message, error.context);
      }
      return sendError(res, error.status || 500, error.message, { code: error.code });
    }
  };

  refresh = async (req, res) => {
    const { sessionId, refreshToken } = getRefreshContext(req);

    try {
      await ensureOrgDirectoryCache();
      const { user, tokens } = await AuthService.refresh(sessionId, refreshToken, req);
      setRefreshCookies(res, tokens);
      return sendSuccess(
        res,
        200,
        "Refresh token success",
        buildAuthResponse(user, tokens, serializeUser),
      );
    } catch (error) {
      clearRefreshCookies(res);
      if (error.context) {
        logger.warn(error.message, error.context);
      }
      return sendError(res, error.status || 500, error.message, { code: error.code });
    }
  };

  forgotPassword = async (req, res) => {
    try {
      const { user, email, passwordReset } = await AuthService.forgotPassword(req.body);
      if (user) {
        logger.info("Password reset requested", { userId: user.id, email });
      } else {
        logger.warn("Password reset requested for non-existent email", { email });
      }

      return sendSuccess(res, 200, "Forgot password request success", {
        email,
        resetToken: passwordReset.token,
        resetTokenExpiresAt: passwordReset.expiresAt,
      });
    } catch (error) {
      return sendError(res, error.status || 500, error.message, { code: error.code });
    }
  };

  resetPassword = async (req, res) => {
    try {
      const user = await AuthService.resetPassword(req.body);
      clearRefreshCookies(res);
      logger.info("Password reset success", { userId: user.id, email: user.email });
      return sendSuccess(res, 200, "Reset password success", null);
    } catch (error) {
      if (error.context) {
        logger.warn(error.message, error.context);
      }
      return sendError(res, error.status || 500, error.message, { code: error.code });
    }
  };

  logout = async (req, res) => {
    const accessToken = readBearerToken(req);
    const refreshContext = getRefreshContext(req);

    try {
      const { user, sessionId } = await AuthService.logout(accessToken, refreshContext);
      if (user && sessionId) {
        logger.info("Logout success", { userId: user.id, sessionId });
      }

      clearRefreshCookies(res);
      return sendSuccess(res, 200, "Logout success", null);
    } catch (error) {
      clearRefreshCookies(res);
      return sendError(res, error.status || 500, error.message, { code: error.code });
    }
  };

  getMe = async (req, res) => {
    await ensureOrgDirectoryCache();
    return sendSuccess(res, 200, "Get current user success", {
      user: serializeUser(req.user),
    });
  };

  updateMe = async (req, res) => {
    try {
      const user = await updateOwnProfile(req.user, req.body || {});
      return sendSuccess(res, 200, "Update current user success", {
        user,
      });
    } catch (error) {
      return sendError(res, error.status || 500, error.message, { code: error.code });
    }
  };

  changePassword = async (req, res) => {
    try {
      const user = await AuthService.changePassword(req.user, req.body);
      clearRefreshCookies(res);
      logger.info("Change password success", { userId: user.id });
      return sendSuccess(res, 200, "Change password success", null);
    } catch (error) {
      if (error.context) {
        logger.warn(error.message, error.context);
      }
      return sendError(res, error.status || 500, error.message, { code: error.code });
    }
  };

  register = async (req, res) => {
    try {
      const user = await createUserAccount(req.user, req.body || {});
      logger.info("Register user success", { userId: user.id, createdBy: req.user.id });
      return sendSuccess(res, 201, "Register user success", user);
    } catch (error) {
      return sendError(res, error.status || 500, error.message, { code: error.code });
    }
  };
}

module.exports = new AuthController();
