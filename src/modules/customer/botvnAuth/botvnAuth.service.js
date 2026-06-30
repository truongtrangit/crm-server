const Customer = require('../customer/customer.model');
const BotvnUserSession = require('./botvnUserSession.model');
const {
  verifyPassword,
  createSessionTokens,
  hashPassword,
} = require('../../../core/utils/auth');
const { generateMonotonicId, ID_PREFIXES } = require('../../../core/utils/id');
const { CUSTOMER_MAIN_TYPES } = require('../../../core/constants/appData');
const BotvnConfig = require('../../course/courseConfig/botvnConfig.model');

class BotvnAuthService {
  _normalizeEmail(value) {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
  }

  /**
   * EXTERNAL LOGIC: Handle login specifically for Botvn users.
   * - Uses Customer model instead of User model.
   * - Stores sessions in BotvnUserSession collection to separate from CRM internal sessions.
   * - Ensures high performance by keeping Customer documents small (no bloated sessions array).
   */
  async login(payload, req) {
    const email = this._normalizeEmail(payload?.email);
    const password =
      typeof payload?.password === 'string' ? payload.password : '';

    if (!email || !password) {
      const error = new Error('email and password are required');
      error.status = 400;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }

    // INTERNAL LOGIC NOTE: Find customer with select('+botvnPassword') because it's hidden by default
    const customer = await Customer.findOne({ email }).select('+botvnPassword');

    if (
      !customer ||
      !customer.botvnPassword ||
      !(await verifyPassword(password, customer.botvnPassword))
    ) {
      const error = new Error('Invalid email or password');
      error.status = 401;
      error.code = 'INVALID_CREDENTIALS';
      error.context = { email };
      throw error;
    }

    if (customer.isActive === false) {
      const error = new Error(
        'Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.',
      );
      error.status = 403;
      error.code = 'ACCOUNT_INACTIVE';
      error.context = { email, customerId: customer.id };
      throw error;
    }

    const config = await BotvnConfig.findOne();
    if (config && config.maintenance && config.maintenance.isActive) {
      const allowedRoles = config.maintenance.allowedRoles || [];
      if (!customer.botvnRole || !allowedRoles.includes(customer.botvnRole)) {
        const error = new Error(
          'Hệ thống đang bảo trì. Tài khoản của bạn không có quyền truy cập lúc này.',
        );
        error.status = 503;
        error.code = 'MAINTENANCE_MODE';
        error.context = {
          type: config.maintenance.type,
          title: config.maintenance.title,
          reason: config.maintenance.reason,
          time: config.maintenance.time,
        };
        throw error;
      }
    }

    // EXTERNAL LOGIC: Create a new session token tailored for the botvn user
    // We reuse the existing token generation algorithm but store it externally in BotvnUserSession
    const tokens = createSessionTokens(req);

    // Override the default CRM token TTL for botvn users to keep them separate
    const now = Date.now();
    const botvnAccessTtlMs =
      (Number(process.env.BOTVN_ACCESS_TOKEN_TTL_MINUTES) || 60 * 24 * 30) *
      60 *
      1000; // default 30 days
    const botvnRefreshTtlMs =
      (Number(process.env.BOTVN_REFRESH_TOKEN_TTL_DAYS) || 90) *
      24 *
      60 *
      60 *
      1000; // default 90 days

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

  /**
   * EXTERNAL LOGIC: Handle registration specifically for Botvn users.
   */
  async register(payload, req) {
    const email = this._normalizeEmail(payload?.email);
    const password = payload?.password || '';
    const name = typeof payload?.name === 'string' ? payload.name.trim() : '';

    const existingCustomer = await Customer.findOne({
      email,
      mainType: CUSTOMER_MAIN_TYPES.USER,
    });

    if (existingCustomer) {
      const error = new Error('Email này đã được đăng ký.');
      error.status = 409;
      error.code = 'EMAIL_EXISTS';
      throw error;
    }

    const id = await generateMonotonicId(ID_PREFIXES.CUSTOMER);
    const hashedBotvnPassword = await hashPassword(password);

    const newCustomer = new Customer({
      id,
      name,
      email,
      botvnPassword: hashedBotvnPassword,
      mainType: CUSTOMER_MAIN_TYPES.USER,
      type: 'Bot.vn user',
      platforms: ['Botvn'],
      isActive: false, // Default is inactive
      registeredAt: new Date().toISOString(),
    });

    await newCustomer.save();

    return newCustomer;
  }
}

module.exports = new BotvnAuthService();
