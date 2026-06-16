const Customer = require("../customer/customer.model");
const BotvnUserSession = require("./botvnUserSession.model");
const { verifyPassword, createSessionTokens } = require("../../../core/utils/auth");

class BotvnAuthService {
  _normalizeEmail(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
  }

  /**
   * EXTERNAL LOGIC: Handle login specifically for Botvn users.
   * - Uses Customer model instead of User model.
   * - Stores sessions in BotvnUserSession collection to separate from CRM internal sessions.
   * - Ensures high performance by keeping Customer documents small (no bloated sessions array).
   */
  async login(payload, req) {
    const email = this._normalizeEmail(payload?.email);
    const password = typeof payload?.password === "string" ? payload.password : "";

    if (!email || !password) {
      const error = new Error("email and password are required");
      error.status = 400;
      error.code = "VALIDATION_ERROR";
      throw error;
    }

    // INTERNAL LOGIC NOTE: Find customer with select('+botvnPassword') because it's hidden by default
    const customer = await Customer.findOne({ email }).select("+botvnPassword");

    if (!customer || !customer.botvnPassword || !(await verifyPassword(password, customer.botvnPassword))) {
      const error = new Error("Invalid email or password");
      error.status = 401;
      error.code = "INVALID_CREDENTIALS";
      error.context = { email };
      throw error;
    }

    if (customer.isActive === false) {
      const error = new Error("Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.");
      error.status = 403;
      error.code = "ACCOUNT_INACTIVE";
      error.context = { email, customerId: customer.id };
      throw error;
    }

    // EXTERNAL LOGIC: Create a new session token tailored for the botvn user
    // We reuse the existing token generation algorithm but store it externally in BotvnUserSession
    const tokens = createSessionTokens(req);
    
    // Override the default CRM token TTL for botvn users to keep them separate
    const now = Date.now();
    const botvnAccessTtlMs = (Number(process.env.BOTVN_ACCESS_TOKEN_TTL_MINUTES) || 60 * 24 * 30) * 60 * 1000; // default 30 days
    const botvnRefreshTtlMs = (Number(process.env.BOTVN_REFRESH_TOKEN_TTL_DAYS) || 90) * 24 * 60 * 60 * 1000; // default 90 days

    tokens.session.accessTokenExpiresAt = new Date(now + botvnAccessTtlMs);
    tokens.session.refreshTokenExpiresAt = new Date(now + botvnRefreshTtlMs);
    
    // Ensure only 1 active session by deleting any existing sessions for this customer
    await BotvnUserSession.deleteMany({ customerId: customer._id });

    await BotvnUserSession.create({
      customerId: customer._id,
      sessionId: tokens.session.sessionId,
      accessTokenHash: tokens.session.accessTokenHash,
      refreshTokenHash: tokens.session.refreshTokenHash,
      accessTokenExpiresAt: tokens.session.accessTokenExpiresAt,
      refreshTokenExpiresAt: tokens.session.refreshTokenExpiresAt,
      userAgent: tokens.session.userAgent,
      ipAddress: tokens.session.ipAddress,
      lastUsedAt: tokens.session.lastUsedAt,
    });

    customer.lastLoginAt = new Date().toISOString();
    await customer.save();

    // Prevent leaking the botvnPassword in the response
    customer.botvnPassword = undefined;

    return { customer, tokens };
  }

  async logout(payload) {
    const { sessionId } = payload;
    if (sessionId) {
      await BotvnUserSession.deleteOne({ sessionId });
    }
  }
}

module.exports = new BotvnAuthService();
