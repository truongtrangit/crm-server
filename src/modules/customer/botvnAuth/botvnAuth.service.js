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
const env = require('../../../core/config/env');
const CacheService = require('../../../core/services/CacheService');
const crypto = require('crypto');

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

    if (config?.login?.emailPassword === false) {
      const error = new Error('Tính năng đăng nhập bằng email đang bị khóa.');
      error.status = 403;
      error.code = 'LOGIN_METHOD_DISABLED';
      throw error;
    }

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
    const botvnAccessTtlMs = env.botvnAccessTokenTtlMinutes * 1000;
    const botvnRefreshTtlMs =
      env.botvnRefreshTokenTtlDays * 24 * 60 * 60 * 1000;

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

    const config = await BotvnConfig.findOne();
    if (
      config?.login?.allowRegistration === false ||
      config?.login?.emailPassword === false
    ) {
      const error = new Error(
        'Tính năng đăng ký tài khoản bằng email đang bị khóa.',
      );
      error.status = 403;
      error.code = 'REGISTRATION_DISABLED';
      throw error;
    }

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

  // ==========================================
  // ZALO QR LOGIN FLOW
  // ==========================================

  /**
   * Bước 1: Client web gọi API để sinh mã QR
   * Tạo 1 UUID và lưu vào Redis với trạng thái PENDING
   */
  async generateQrToken() {
    const config = await BotvnConfig.findOne().lean();
    if (config?.login?.qrCode === false) {
      const error = new Error('Tính năng đăng nhập bằng QR Code đang bị khóa.');
      error.status = 403;
      error.code = 'LOGIN_METHOD_DISABLED';
      throw error;
    }

    const qrToken = crypto.randomUUID();

    // Lưu vào cache
    await CacheService.set(
      `botvn_qr:${qrToken}`,
      {
        status: 'PENDING',
        createdAt: Date.now(),
      },
      env.botvnQrTokenTtlSeconds,
    );

    return {
      qrToken,
      expiresAt: Date.now() + env.botvnQrTokenTtlSeconds * 1000,
    };
  }

  /**
   * Bước 2: Client web polling để kiểm tra trạng thái
   */
  async getQrStatus(qrToken) {
    const session = await CacheService.get(`botvn_qr:${qrToken}`);
    if (!session) {
      const error = new Error('Mã QR đã hết hạn hoặc không tồn tại.');
      error.status = 404;
      error.code = 'QR_EXPIRED';
      throw error;
    }

    // Nếu đã đăng nhập thành công, xóa khỏi cache để token chỉ dùng 1 lần
    if (session.status === 'AUTHENTICATED') {
      await CacheService.del(`botvn_qr:${qrToken}`);
    }

    return session;
  }

  /**
   * Bước 3: Zalo Mini App gọi API báo đã quét thành công
   */
  async verifyQrToken(qrToken, zaloProfile, req) {
    // 1. Kiểm tra QR còn sống không
    const session = await CacheService.get(`botvn_qr:${qrToken}`);
    if (!session) {
      const error = new Error('Mã QR đã hết hạn hoặc không tồn tại.');
      error.status = 404;
      error.code = 'QR_EXPIRED';
      throw error;
    }

    if (session.status !== 'PENDING') {
      const error = new Error('Mã QR này đã được sử dụng.');
      error.status = 400;
      error.code = 'QR_ALREADY_USED';
      throw error;
    }

    const { id: zaloId, name, phone, email, avatar } = zaloProfile;
    if (!zaloId) {
      const error = new Error('zaloProfile thiếu trường zaloId bắt buộc.');
      error.status = 400;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }

    // 2. Tìm Customer có zaloId này
    let customer = await Customer.findOne({
      zaloId,
      mainType: CUSTOMER_MAIN_TYPES.USER,
    });

    if (!customer) {
      // Auto-register (Đăng ký nhanh) do email không còn bắt buộc
      const config = await BotvnConfig.findOne().lean();
      if (config?.login?.allowRegistration === false) {
        // Cập nhật session sang lỗi
        await CacheService.set(
          `botvn_qr:${qrToken}`,
          {
            status: 'REGISTRATION_DISABLED',
          },
          env.botvnQrTokenTtlSeconds,
        );

        const error = new Error('Hệ thống đang khóa đăng ký.');
        error.status = 403;
        error.code = 'REGISTRATION_DISABLED';
        throw error;
      }

      // Kiểm tra xem số điện thoại có bị trùng không
      if (phone) {
        const existingPhone = await Customer.findOne({
          phone,
          mainType: CUSTOMER_MAIN_TYPES.USER,
        });
        if (existingPhone) {
          // Gắn zaloId vào tài khoản hiện tại nếu muốn, hoặc báo lỗi. Ở đây ta ưu tiên gắn zaloId vào tk có cùng phone.
          customer = existingPhone;
          customer.zaloId = zaloId;
          await customer.save();
        }
      }

      // Nếu vẫn chưa có customer, tạo mới
      if (!customer) {
        const newId = await generateMonotonicId(ID_PREFIXES.CUSTOMER);
        customer = new Customer({
          id: newId,
          name: name || 'Người dùng Zalo',
          zaloId,
          phone,
          email: email || undefined, // undefined để không bị vướng unique sparse index rỗng
          avatar,
          mainType: CUSTOMER_MAIN_TYPES.USER,
          type: 'Bot.vn user',
          platforms: ['Botvn', 'Zalo'],
          isActive: true, // Auto active
          registeredAt: new Date().toISOString(),
        });
        await customer.save();
      }
    }

    // 3. Tài khoản bị khoá
    if (customer.isActive === false) {
      await CacheService.set(
        `botvn_qr:${qrToken}`,
        {
          status: 'ACCOUNT_INACTIVE',
        },
        env.botvnQrTokenTtlSeconds,
      );

      const error = new Error('Tài khoản đã bị vô hiệu hóa.');
      error.status = 403;
      error.code = 'ACCOUNT_INACTIVE';
      throw error;
    }

    // 4. Sinh session tokens
    // Lưu ý: req gửi từ webhook Zalo Mini App sẽ có IP của server Zalo.
    // Nếu muốn IP chuẩn xác của trình duyệt, ta phải truyền IP từ lúc generateQr,
    // hoặc tạm chấp nhận IP của webhook cho phiên tạo này.
    const tokens = createSessionTokens(req);
    const now = Date.now();
    const botvnAccessTtlMs = env.botvnAccessTokenTtlMinutes * 1000;
    const botvnRefreshTtlMs =
      env.botvnRefreshTokenTtlDays * 24 * 60 * 60 * 1000;

    tokens.session.accessTokenExpiresAt = new Date(now + botvnAccessTtlMs);
    tokens.session.refreshTokenExpiresAt = new Date(now + botvnRefreshTtlMs);

    await BotvnUserSession.deleteMany({ customerId: customer._id });

    await BotvnUserSession.create({
      customerId: customer._id,
      sessionId: tokens.session.sessionId,
      accessTokenHash: tokens.session.accessTokenHash,
      refreshTokenHash: tokens.session.refreshTokenHash,
      accessTokenExpiresAt: tokens.session.accessTokenExpiresAt,
      refreshTokenExpiresAt: tokens.session.refreshTokenExpiresAt,
      userAgent: 'Zalo Mini App / Web QR',
      ipAddress: req.ip,
      lastUsedAt: tokens.session.lastUsedAt,
    });

    customer.lastLoginAt = new Date().toISOString();
    await customer.save();

    // Prevent leaking the botvnPassword in the response
    customer.botvnPassword = undefined;

    // 5. Cập nhật trạng thái session QR thành công
    await CacheService.set(
      `botvn_qr:${qrToken}`,
      {
        status: 'AUTHENTICATED',
        tokens,
        customer,
      },
      env.botvnQrTokenTtlSeconds,
    );

    return { message: 'Xác thực thành công' };
  }
}

module.exports = new BotvnAuthService();
