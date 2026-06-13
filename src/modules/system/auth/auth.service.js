const User = require('../user/user.model');
const {
  createPasswordResetToken,
  createSessionTokens,
  hashPassword,
  hashToken,
  rotateSessionTokens,
  verifyPassword,
} = require('../../../core/utils/auth');

class AuthService {
  _normalizeEmail(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
  }

  _clearSensitiveUserState(user) {
    user.sessions = [];
    user.passwordReset = {
      tokenHash: null,
      expiresAt: null,
      requestedAt: null,
    };
  }

  async login(payload, req) {
    const email = this._normalizeEmail(payload?.email);
    const password = typeof payload?.password === "string" ? payload.password : "";

    if (!email || !password) {
      const error = new Error("email and password are required");
      error.status = 400;
      error.code = "VALIDATION_ERROR";
      throw error;
    }

    const user = await User.findOne({ email });

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      const error = new Error("Invalid email or password");
      error.status = 401;
      error.code = "INVALID_CREDENTIALS";
      error.context = { email };
      throw error;
    }

    if (user.isActive === false) {
      const error = new Error("Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.");
      error.status = 403;
      error.code = "ACCOUNT_INACTIVE";
      error.context = { email, userId: user.id };
      throw error;
    }

    user.sessions = user.sessions.filter(
      (session) => new Date(session.refreshTokenExpiresAt).getTime() > Date.now(),
    );

    const tokens = createSessionTokens(req);
    user.sessions.push(tokens.session);
    user.lastLoginAt = new Date();
    await user.save();

    return { user, tokens };
  }

  async refresh(sessionId, refreshToken, req) {
    if (!sessionId || !refreshToken) {
      const error = new Error("sessionId and refreshToken are required");
      error.status = 400;
      error.code = "VALIDATION_ERROR";
      throw error;
    }

    const user = await User.findOne({ "sessions.sessionId": sessionId });

    if (!user) {
      const error = new Error("Invalid session");
      error.status = 401;
      error.code = "INVALID_SESSION";
      throw error;
    }

    const session = user.sessions.find((item) => item.sessionId === sessionId);

    if (!session) {
      const error = new Error("Invalid session");
      error.status = 401;
      error.code = "INVALID_SESSION";
      throw error;
    }

    if (
      session.refreshTokenHash !== hashToken(refreshToken) ||
      new Date(session.refreshTokenExpiresAt).getTime() <= Date.now()
    ) {
      user.sessions = user.sessions.filter(
        (item) => item.sessionId !== sessionId,
      );
      await user.save();

      const error = new Error("Refresh token is invalid or expired");
      error.status = 401;
      error.code = "INVALID_REFRESH_TOKEN";
      error.context = { userId: user.id, sessionId };
      throw error;
    }

    const tokens = rotateSessionTokens(session, req);
    await user.save();

    return { user, tokens };
  }

  async forgotPassword(payload) {
    const email = this._normalizeEmail(payload?.email);

    if (!email) {
      const error = new Error("email is required");
      error.status = 400;
      error.code = "VALIDATION_ERROR";
      throw error;
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
      return { user, email, passwordReset };
    }

    return { user: null, email, passwordReset };
  }

  async resetPassword(payload) {
    const email = this._normalizeEmail(payload?.email);
    const resetToken = typeof payload?.resetToken === "string" ? payload.resetToken.trim() : "";
    const newPassword = typeof payload?.newPassword === "string" ? payload.newPassword : "";

    if (!email || !resetToken || !newPassword) {
      const error = new Error("email, resetToken and newPassword are required");
      error.status = 400;
      error.code = "VALIDATION_ERROR";
      throw error;
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
      const error = new Error("resetToken is invalid or expired");
      error.status = 400;
      error.code = "INVALID_RESET_TOKEN";
      error.context = { email };
      throw error;
    }

    if (await verifyPassword(newPassword, user.passwordHash)) {
      const error = new Error("newPassword must be different from current password");
      error.status = 400;
      error.code = "VALIDATION_ERROR";
      throw error;
    }

    user.passwordHash = await hashPassword(newPassword);
    this._clearSensitiveUserState(user);
    await user.save();

    return user;
  }

  async logout(accessToken, refreshContext) {
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

    return { user, sessionId };
  }

  async changePassword(user, payload) {
    const currentPassword = typeof payload?.currentPassword === "string" ? payload.currentPassword : "";
    const newPassword = typeof payload?.newPassword === "string" ? payload.newPassword : "";

    if (!currentPassword || !newPassword) {
      const error = new Error("currentPassword and newPassword are required");
      error.status = 400;
      error.code = "VALIDATION_ERROR";
      throw error;
    }

    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      const error = new Error("Current password is incorrect");
      error.status = 401;
      error.code = "INVALID_CURRENT_PASSWORD";
      error.context = { userId: user.id };
      throw error;
    }

    if (await verifyPassword(newPassword, user.passwordHash)) {
      const error = new Error("newPassword must be different from current password");
      error.status = 400;
      error.code = "VALIDATION_ERROR";
      throw error;
    }

    user.passwordHash = await hashPassword(newPassword);
    this._clearSensitiveUserState(user);
    await user.save();

    return user;
  }
}

module.exports = new AuthService();
