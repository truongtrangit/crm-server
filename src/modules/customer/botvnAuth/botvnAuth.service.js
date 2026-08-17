const Customer = require('../customer/customer.model');
const BotvnUserSession = require('./botvnUserSession.model');
const {
  verifyPassword,
  createSessionTokens,
  hashPassword,
  hashToken,
} = require('../../../core/utils/auth');
const { generateMonotonicId, ID_PREFIXES } = require('../../../core/utils/id');
const {
  CUSTOMER_MAIN_TYPES,
  QR_SESSION_STATUS,
  AUTH_ERROR_CODES,
} = require('../../../core/constants/appData');
const BotvnConfig = require('../../course/courseConfig/botvnConfig.model');
const env = require('../../../core/config/env');
const CacheService = require('../../../core/services/CacheService');
const crypto = require('crypto');
const logger = require('../../../core/utils/logger');
const { OAuth2Client } = require('google-auth-library');

const OTP_CACHE_PREFIX = 'botvn_otp';
const PWD_RESET_OTP_PREFIX = 'botvn_pwd_reset';
const PWD_RESET_TOKEN_PREFIX = 'botvn_pwd_reset_token';
const OTP_MAX_VERIFY_ATTEMPTS = 5;
const PWD_RESET_TOKEN_TTL_SECONDS = 600; // 10 phút

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
      error.code = AUTH_ERROR_CODES.VALIDATION_ERROR;
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
      error.code = AUTH_ERROR_CODES.INVALID_CREDENTIALS;
      error.context = { email };
      throw error;
    }

    if (customer.isActive === false) {
      const error = new Error(
        'Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.',
      );
      error.status = 403;
      error.code = AUTH_ERROR_CODES.ACCOUNT_INACTIVE;
      error.context = { email, customerId: customer.id };
      throw error;
    }

    const config = await BotvnConfig.findOne();

    if (config?.login?.emailPassword === false) {
      const error = new Error('Tính năng đăng nhập bằng email đang bị khóa.');
      error.status = 403;
      error.code = AUTH_ERROR_CODES.LOGIN_METHOD_DISABLED;
      throw error;
    }

    if (config && config.maintenance && config.maintenance.isActive) {
      const allowedRoles = config.maintenance.allowedRoles || [];
      if (!customer.botvnRole || !allowedRoles.includes(customer.botvnRole)) {
        const error = new Error(
          'Hệ thống đang bảo trì. Tài khoản của bạn không có quyền truy cập lúc này.',
        );
        error.status = 503;
        error.code = AUTH_ERROR_CODES.MAINTENANCE_MODE;
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
    const hasPassword = !!customer.botvnPassword;
    customer.botvnPassword = undefined;

    return { customer, tokens, hasPassword };
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
      error.code = AUTH_ERROR_CODES.REGISTRATION_DISABLED;
      throw error;
    }

    const existingCustomer = await Customer.findOne({
      email,
      mainType: CUSTOMER_MAIN_TYPES.USER,
    });

    if (existingCustomer) {
      const error = new Error('Email này đã được đăng ký.');
      error.status = 409;
      error.code = AUTH_ERROR_CODES.EMAIL_EXISTS;
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
      isActive: false, // Default is inactive, sẽ active sau khi verify OTP
      registeredAt: new Date().toISOString(),
    });

    await newCustomer.save();

    // Auto gửi OTP sau khi đăng ký
    const otpResult = await this.sendOtp(email);

    return { customer: newCustomer, otpExpiresIn: otpResult.expiresIn };
  }

  // ==========================================
  // OTP VERIFICATION
  // ==========================================

  /**
   * Generate mã OTP 6 chữ số ngẫu nhiên bảo mật bằng crypto
   */
  _generateOtp() {
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Gửi OTP qua API bên thứ 3.
   * Nếu chưa config API URL → chỉ log ra console để dev test.
   * API contract linh hoạt: POST JSON body, Bearer token auth.
   */
  async _sendOtpToThirdParty(email, otp, ttlSeconds, additionalParams = {}) {
    const apiUrl = env.botvnOtpApiUrl;
    const apiKey = env.botvnOtpApiKey;

    if (!apiUrl) {
      logger.info(
        `[BotVN OTP] No OTP API configured. OTP for ${email}: ${otp} (expires in ${ttlSeconds}s)`,
        additionalParams
      );
      return;
    }

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          email,
          otp,
          expiresInSeconds: ttlSeconds,
          ...additionalParams,
        }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        logger.error('[BotVN OTP] Third-party API error', {
          status: response.status,
          body: text,
          email,
        });
      } else {
        logger.info(`[BotVN OTP] OTP sent successfully for ${email}`);
      }
    } catch (err) {
      logger.error('[BotVN OTP] Failed to call third-party API', {
        error: err.message,
        email,
      });
      // Không throw — OTP đã lưu cache, user có thể resend
    }
  }

  /**
   * Generate OTP, lưu cache (hash), và gửi qua API bên thứ 3
   */
  async sendOtp(email) {
    const normalizedEmail = this._normalizeEmail(email);
    const ttl = env.botvnOtpTtlSeconds;

    // Kiểm tra customer tồn tại và chưa active
    const customer = await Customer.findOne({
      email: normalizedEmail,
      mainType: CUSTOMER_MAIN_TYPES.USER,
    });

    if (!customer) {
      const error = new Error('Email không tồn tại trong hệ thống.');
      error.status = 404;
      error.code = AUTH_ERROR_CODES.VALIDATION_ERROR;
      throw error;
    }

    if (customer.isActive === true) {
      const error = new Error('Tài khoản đã được kích hoạt.');
      error.status = 400;
      error.code = AUTH_ERROR_CODES.VALIDATION_ERROR;
      throw error;
    }

    const otp = this._generateOtp();
    const otpHash = hashToken(otp);

    // Lưu OTP hash vào cache, KHÔNG lưu OTP plaintext
    await CacheService.set(
      `${OTP_CACHE_PREFIX}:${normalizedEmail}`,
      {
        otpHash,
        attempts: 0,
        createdAt: Date.now(),
      },
      ttl,
    );

    // Gửi OTP plaintext qua API bên thứ 3
    await this._sendOtpToThirdParty(normalizedEmail, otp, ttl);

    return { expiresIn: ttl };
  }

  /**
   * Xác thực OTP, kích hoạt tài khoản và tự động đăng nhập
   */
  async verifyOtp(payload, req) {
    const email = this._normalizeEmail(payload?.email);
    const otp = typeof payload?.otp === 'string' ? payload.otp.trim() : '';
    const cacheKey = `${OTP_CACHE_PREFIX}:${email}`;

    // Lấy dữ liệu OTP từ cache
    const cached = await CacheService.get(cacheKey);
    if (!cached) {
      const error = new Error(
        'Mã OTP đã hết hạn hoặc chưa được gửi. Vui lòng yêu cầu gửi lại.',
      );
      error.status = 400;
      error.code = AUTH_ERROR_CODES.OTP_EXPIRED;
      throw error;
    }

    // Kiểm tra số lần thử
    if (cached.attempts >= OTP_MAX_VERIFY_ATTEMPTS) {
      await CacheService.del(cacheKey);
      const error = new Error(
        'Bạn đã nhập sai quá nhiều lần. Vui lòng yêu cầu gửi lại mã OTP mới.',
      );
      error.status = 429;
      error.code = AUTH_ERROR_CODES.OTP_MAX_ATTEMPTS;
      throw error;
    }

    // So sánh hash OTP
    const inputHash = hashToken(otp);
    if (inputHash !== cached.otpHash) {
      // Tăng số lần thử, giữ nguyên TTL còn lại
      cached.attempts += 1;
      const remainingTtl = Math.max(
        1,
        Math.ceil(
          (cached.createdAt + env.botvnOtpTtlSeconds * 1000 - Date.now()) /
            1000,
        ),
      );
      await CacheService.set(cacheKey, cached, remainingTtl);

      const error = new Error(
        `Mã OTP không chính xác. Bạn còn ${OTP_MAX_VERIFY_ATTEMPTS - cached.attempts} lần thử.`,
      );
      error.status = 400;
      error.code = AUTH_ERROR_CODES.OTP_INVALID;
      error.context = {
        attemptsRemaining: OTP_MAX_VERIFY_ATTEMPTS - cached.attempts,
      };
      throw error;
    }

    // OTP đúng — Xóa cache và kích hoạt tài khoản
    await CacheService.del(cacheKey);

    const customer = await Customer.findOne({
      email,
      mainType: CUSTOMER_MAIN_TYPES.USER,
    }).select('+botvnPassword');

    if (!customer) {
      const error = new Error('Tài khoản không tồn tại.');
      error.status = 404;
      error.code = AUTH_ERROR_CODES.VALIDATION_ERROR;
      throw error;
    }

    // Kích hoạt tài khoản
    customer.isActive = true;
    customer.lastLoginAt = new Date().toISOString();
    await customer.save();

    // Auto login: tạo session tokens
    const tokens = createSessionTokens(req);
    const now = Date.now();
    const botvnAccessTtlMs = env.botvnAccessTokenTtlMinutes * 1000;
    const botvnRefreshTtlMs =
      env.botvnRefreshTokenTtlDays * 24 * 60 * 60 * 1000;

    tokens.session.accessTokenExpiresAt = new Date(now + botvnAccessTtlMs);
    tokens.session.refreshTokenExpiresAt = new Date(now + botvnRefreshTtlMs);

    // Xóa session cũ (nếu có) và tạo mới
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

    // Ẩn password trong response
    const hasPassword = !!customer.botvnPassword;
    customer.botvnPassword = undefined;

    return { customer, tokens, hasPassword };
  }

  // ==========================================
  // GOOGLE LOGIN
  // ==========================================

  /**
   * Google Login / Auto-register.
   * Supports two credential types:
   * 1. idToken — from FedCM / One Tap prompt (primary)
   * 2. accessToken — from OAuth2 popup fallback (when FedCM is disabled)
   *
   * Flow:
   * 1. Verify Google credential (ID token via audience check, or access token via userinfo API)
   * 2. Tìm Customer bằng googleId → returning user
   * 3. Tìm bằng email → link googleId vào account cũ
   * 4. Không tìm → tạo Customer mới (auto-register, auto-active)
   * 5. Tạo session tokens
   */
  async googleLogin(credential, req) {
    if (!env.botvnGoogleClientId) {
      const error = new Error('Google login is not configured.');
      error.status = 500;
      throw error;
    }

    const { idToken, accessToken } = credential;

    // --- Config check ---
    const config = await BotvnConfig.findOne().lean();
    if (config?.login?.google === false) {
      const error = new Error('Tính năng đăng nhập bằng Google đang bị khóa.');
      error.status = 403;
      error.code = AUTH_ERROR_CODES.LOGIN_METHOD_DISABLED;
      throw error;
    }

    // --- Verify credential ---
    let payload;

    if (idToken) {
      // Path 1: Verify ID token (from FedCM / One Tap)
      const googleClient = new OAuth2Client(env.botvnGoogleClientId);
      try {
        const ticket = await googleClient.verifyIdToken({
          idToken,
          audience: env.botvnGoogleClientId,
        });
        payload = ticket.getPayload();
      } catch (err) {
        logger.warn('Google ID token verification failed', { error: err.message });
        const error = new Error('Google token không hợp lệ hoặc đã hết hạn.');
        error.status = 401;
        error.code = AUTH_ERROR_CODES.INVALID_CREDENTIALS;
        throw error;
      }
    } else if (accessToken) {
      // Path 2: Verify access token via Google userinfo API (from OAuth2 popup fallback)
      try {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) {
          throw new Error(`Google userinfo returned ${res.status}`);
        }
        payload = await res.json();
        // userinfo returns: { sub, email, email_verified, name, picture, ... }
        // Same fields as ID token payload — no mapping needed
      } catch (err) {
        logger.warn('Google access token verification failed', { error: err.message });
        const error = new Error('Google token không hợp lệ hoặc đã hết hạn.');
        error.status = 401;
        error.code = AUTH_ERROR_CODES.INVALID_CREDENTIALS;
        throw error;
      }
    } else {
      const error = new Error('No Google credential provided.');
      error.status = 400;
      throw error;
    }

    if (!payload.email_verified) {
      const error = new Error('Email Google chưa được xác thực.');
      error.status = 401;
      error.code = AUTH_ERROR_CODES.INVALID_CREDENTIALS;
      throw error;
    }

    const googleId = payload.sub;
    const email = this._normalizeEmail(payload.email);
    const name = payload.name || email.split('@')[0];
    const avatar = payload.picture || '';

    // --- Find or create customer ---
    let customer = await Customer.findOne({ googleId }).select('+botvnPassword');

    if (!customer) {
      // Try to find existing customer by email (account linking)
      customer = await Customer.findOne({
        email,
        mainType: CUSTOMER_MAIN_TYPES.USER,
      }).select('+botvnPassword');

      if (customer) {
        // Link Google ID to existing account
        customer.googleId = googleId;
        if (!customer.avatar && avatar) customer.avatar = avatar;
        if (!customer.platforms) customer.platforms = ['Botvn'];
        if (!customer.platforms.includes('Google')) customer.platforms.push('Google');
      } else {
        // Auto-register new customer
        const id = await generateMonotonicId(ID_PREFIXES.CUSTOMER);
        customer = new Customer({
          id,
          name,
          email,
          avatar,
          googleId,
          mainType: CUSTOMER_MAIN_TYPES.USER,
          type: 'Bot.vn user',
          platforms: ['Botvn', 'Google'],
          isActive: true, // Google đã verify email → auto-active
          registeredAt: new Date().toISOString(),
        });
      }
    }

    // --- Check account status ---
    if (customer.isActive === false) {
      const error = new Error(
        'Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.',
      );
      error.status = 403;
      error.code = AUTH_ERROR_CODES.ACCOUNT_INACTIVE;
      throw error;
    }

    // --- Maintenance check ---
    if (config && config.maintenance && config.maintenance.isActive) {
      const allowedRoles = config.maintenance.allowedRoles || [];
      if (!customer.botvnRole || !allowedRoles.includes(customer.botvnRole)) {
        const error = new Error(
          'Hệ thống đang bảo trì. Tài khoản của bạn không có quyền truy cập lúc này.',
        );
        error.status = 503;
        error.code = AUTH_ERROR_CODES.MAINTENANCE_MODE;
        error.context = {
          type: config.maintenance.type,
          title: config.maintenance.title,
          reason: config.maintenance.reason,
          time: config.maintenance.time,
        };
        throw error;
      }
    }

    // --- Session tokens ---
    const tokens = createSessionTokens(req);
    const now = Date.now();
    tokens.session.accessTokenExpiresAt = new Date(
      now + env.botvnAccessTokenTtlMinutes * 1000,
    );
    tokens.session.refreshTokenExpiresAt = new Date(
      now + env.botvnRefreshTokenTtlDays * 24 * 60 * 60 * 1000,
    );

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

    const hasPassword = !!customer.botvnPassword;
    customer.botvnPassword = undefined;

    return { customer, tokens, hasPassword };
  }

  // ==========================================
  // UPDATE PROFILE
  // ==========================================
  
  async updateProfile(customerId, payload) {
    const customer = await Customer.findOne({
      id: customerId,
      isActive: true,
      mainType: CUSTOMER_MAIN_TYPES.USER,
    });

    if (!customer) {
      const error = new Error('Tài khoản không tồn tại hoặc đã bị khóa.');
      error.status = 404;
      throw error;
    }

    if (payload.name !== undefined) customer.name = payload.name;
    if (payload.phone !== undefined) customer.phone = payload.phone;
    if (payload.bio !== undefined) customer.bio = payload.bio;
    if (payload.jobTitle !== undefined) customer.jobTitle = payload.jobTitle;

    await customer.save();

    return customer;
  }

  // ==========================================
  // CHANGE PASSWORD & DELETE ACCOUNT
  // ==========================================

  async changePassword(customerId, payload) {
    const customer = await Customer.findOne({
      id: customerId,
      isActive: true,
      mainType: CUSTOMER_MAIN_TYPES.USER,
    }).select('+botvnPassword');

    if (!customer) {
      const error = new Error('Tài khoản không tồn tại hoặc đã bị khóa.');
      error.status = 404;
      throw error;
    }

    const hasPassword = !!customer.botvnPassword;
    
    if (hasPassword) {
      if (!payload.oldPassword) {
        const error = new Error('Vui lòng nhập mật khẩu hiện tại.');
        error.status = 400;
        throw error;
      }
      
      const isValidPassword = await verifyPassword(payload.oldPassword, customer.botvnPassword);
      if (!isValidPassword) {
        const error = new Error('Mật khẩu hiện tại không chính xác.');
        error.status = 401;
        throw error;
      }
    }

    const hashedBotvnPassword = await hashPassword(payload.newPassword);
    customer.botvnPassword = hashedBotvnPassword;
    await customer.save();

    // Revoke all existing sessions so they have to login again
    await BotvnUserSession.deleteMany({ customerId: customer._id });

    return { message: 'Đổi mật khẩu thành công' };
  }

  async deleteAccount(customerId, payload) {
    const customer = await Customer.findOne({
      id: customerId,
      isActive: true,
      mainType: CUSTOMER_MAIN_TYPES.USER,
    }).select('+botvnPassword');

    if (!customer) {
      const error = new Error('Tài khoản không tồn tại hoặc đã bị khóa.');
      error.status = 404;
      throw error;
    }

    const hasPassword = !!customer.botvnPassword;
    
    if (hasPassword) {
      if (!payload.password) {
        const error = new Error('Vui lòng nhập mật khẩu để xác nhận.');
        error.status = 400;
        throw error;
      }
      
      const isValidPassword = await verifyPassword(payload.password, customer.botvnPassword);
      if (!isValidPassword) {
        const error = new Error('Mật khẩu không chính xác.');
        error.status = 401;
        throw error;
      }
    }

    customer.isActive = false;
    await customer.save();
    
    if (typeof customer.delete === 'function') {
      await customer.delete();
    }

    await BotvnUserSession.deleteMany({ customerId: customer._id });

    return { message: 'Tài khoản đã được xóa' };
  }

  // ==========================================
  // ZALO QR LOGIN FLOW
  // ==========================================

  /**
   * Bước 1: Client web gọi API để sinh mã QR
   * Tạo 1 UUID và lưu vào Redis với trạng thái PENDING cùng thông tin thiết bị tạo mã.
   */
  async generateQrToken(req) {
    const config = await BotvnConfig.findOne().lean();
    if (config?.login?.qrCode === false) {
      const error = new Error('Tính năng đăng nhập bằng QR Code đang bị khóa.');
      error.status = 403;
      error.code = AUTH_ERROR_CODES.LOGIN_METHOD_DISABLED;
      throw error;
    }

    const qrToken = crypto.randomUUID();

    // Lưu vào cache cùng thông tin IP và Trình duyệt của Web Client
    await CacheService.set(
      `botvn_qr:${qrToken}`,
      {
        status: QR_SESSION_STATUS.PENDING,
        ip: req?.ip || 'unknown',
        userAgent: req?.headers ? req.headers['user-agent'] : 'unknown',
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
   * Bước 1.5 (Tuỳ chọn): Zalo Mini App gọi để lấy thông tin thiết bị Web và cảnh báo User
   */
  async scanQrToken(qrToken) {
    const session = await CacheService.get(`botvn_qr:${qrToken}`);
    if (!session) {
      const error = new Error('Mã QR đã hết hạn hoặc không tồn tại.');
      error.status = 404;
      error.code = AUTH_ERROR_CODES.QR_EXPIRED;
      throw error;
    }

    if (session.status === QR_SESSION_STATUS.AUTHENTICATED) {
      const error = new Error('Mã QR này đã được sử dụng.');
      error.status = 400;
      error.code = AUTH_ERROR_CODES.QR_ALREADY_USED;
      throw error;
    }

    // Luôn chuyển trạng thái sang SCANNED để Frontend cập nhật giao diện
    session.status = QR_SESSION_STATUS.SCANNED;
    await CacheService.set(
      `botvn_qr:${qrToken}`,
      session,
      env.botvnQrTokenTtlSeconds,
    );

    return {
      ip: session.ip,
      userAgent: session.userAgent,
      status: session.status,
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
      error.code = AUTH_ERROR_CODES.QR_EXPIRED;
      throw error;
    }

    // Nếu đã đăng nhập thành công, xóa khỏi cache để token chỉ dùng 1 lần
    if (session.status === QR_SESSION_STATUS.AUTHENTICATED) {
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
      error.code = AUTH_ERROR_CODES.QR_EXPIRED;
      throw error;
    }

    // Zalo Mini App PHẢI gọi API /qr/scan trước khi gọi /qr/verify
    if (session.status !== QR_SESSION_STATUS.SCANNED) {
      const error = new Error(
        'Thiết bị chưa xác nhận ngữ cảnh quét (Context Confirm). Vui lòng gọi API /qr/scan trước.',
      );
      error.status = 403;
      error.code = AUTH_ERROR_CODES.QR_CONTEXT_NOT_CONFIRMED;
      throw error;
    }

    if (
      session.status !== QR_SESSION_STATUS.PENDING &&
      session.status !== QR_SESSION_STATUS.SCANNED
    ) {
      const error = new Error('Mã QR này đã được sử dụng hoặc không hợp lệ.');
      error.status = 400;
      error.code = AUTH_ERROR_CODES.QR_ALREADY_USED;
      throw error;
    }

    const { id: zaloId, name, phone, email, avatar } = zaloProfile;
    if (!zaloId) {
      const error = new Error('zaloProfile thiếu trường zaloId bắt buộc.');
      error.status = 400;
      error.code = AUTH_ERROR_CODES.VALIDATION_ERROR;
      throw error;
    }

    // 2. Tìm Customer có zaloId này
    let customer = await Customer.findOne({
      zaloId,
      mainType: CUSTOMER_MAIN_TYPES.USER,
    }).select('+botvnPassword');

    if (!customer) {
      // Auto-register (Đăng ký nhanh) do email không còn bắt buộc
      // Kiểm tra xem số điện thoại có bị trùng không
      if (phone) {
        const existingPhone = await Customer.findOne({
          phone,
          mainType: CUSTOMER_MAIN_TYPES.USER,
        }).select('+botvnPassword');
        if (existingPhone) {
          // Gắn zaloId vào tài khoản hiện tại nếu muốn, hoặc báo lỗi. Ở đây ta ưu tiên gắn zaloId vào tk có cùng phone.
          customer = existingPhone;
          customer.zaloId = zaloId;
          if (name && customer.name !== name) customer.name = name;
          if (avatar && customer.avatar !== avatar) customer.avatar = avatar;
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
    } else {
      // Đồng bộ thông tin profile mới nhất từ Zalo
      let changed = false;
      if (name && customer.name !== name) {
        customer.name = name;
        changed = true;
      }
      if (avatar && customer.avatar !== avatar) {
        customer.avatar = avatar;
        changed = true;
      }
      if (changed) {
        await customer.save();
      }
    }

    // 3. Tài khoản bị khoá
    if (customer.isActive === false) {
      await CacheService.set(
        `botvn_qr:${qrToken}`,
        {
          status: QR_SESSION_STATUS.ACCOUNT_INACTIVE,
        },
        env.botvnQrTokenTtlSeconds,
      );

      const error = new Error('Tài khoản đã bị vô hiệu hóa.');
      error.status = 403;
      error.code = AUTH_ERROR_CODES.ACCOUNT_INACTIVE;
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
      userAgent: session.userAgent || 'Zalo Mini App / Web QR', // Ưu tiên dùng User-Agent của máy tính tạo mã
      ipAddress: session.ip || req.ip, // Ưu tiên dùng IP của máy tính tạo mã
      lastUsedAt: tokens.session.lastUsedAt,
    });

    customer.lastLoginAt = new Date().toISOString();
    await customer.save();

    // Prevent leaking the botvnPassword in the response
    const hasPassword = !!customer.botvnPassword;
    customer.botvnPassword = undefined;

    // 5. Cập nhật trạng thái session QR thành công
    await CacheService.set(
      `botvn_qr:${qrToken}`,
      {
        status: QR_SESSION_STATUS.AUTHENTICATED,
        tokens,
        customer,
        hasPassword,
      },
      env.botvnQrTokenTtlSeconds,
    );

    return { message: 'Xác thực thành công' };
  }

  // ==========================================
  // FORGOT PASSWORD (OTP-based)
  // ==========================================

  /**
   * Step 1: Gửi OTP cho user đã active khi quên mật khẩu
   */
  async forgotPassword(email) {
    const normalizedEmail = this._normalizeEmail(email);
    const ttl = env.botvnOtpTtlSeconds;

    const customer = await Customer.findOne({
      email: normalizedEmail,
      mainType: CUSTOMER_MAIN_TYPES.USER,
    });

    if (!customer) {
      const error = new Error('Email không tồn tại trong hệ thống.');
      error.status = 404;
      error.code = AUTH_ERROR_CODES.VALIDATION_ERROR;
      throw error;
    }

    if (customer.isActive === false) {
      const error = new Error(
        'Tài khoản chưa được kích hoạt. Vui lòng kích hoạt tài khoản trước.',
      );
      error.status = 403;
      error.code = AUTH_ERROR_CODES.ACCOUNT_INACTIVE;
      throw error;
    }

    const otp = this._generateOtp();
    const otpHash = hashToken(otp);

    await CacheService.set(
      `${PWD_RESET_OTP_PREFIX}:${normalizedEmail}`,
      {
        otpHash,
        attempts: 0,
        createdAt: Date.now(),
      },
      ttl,
    );

    await this._sendOtpToThirdParty(normalizedEmail, otp, ttl);

    return { expiresIn: ttl };
  }

  /**
   * Step 2: Verify OTP quên mật khẩu → trả về reset token
   */
  async forgotPasswordVerifyOtp(payload) {
    const email = this._normalizeEmail(payload?.email);
    const otp = typeof payload?.otp === 'string' ? payload.otp.trim() : '';
    const cacheKey = `${PWD_RESET_OTP_PREFIX}:${email}`;

    const cached = await CacheService.get(cacheKey);
    if (!cached) {
      const error = new Error(
        'Mã OTP đã hết hạn hoặc chưa được gửi. Vui lòng yêu cầu gửi lại.',
      );
      error.status = 400;
      error.code = AUTH_ERROR_CODES.OTP_EXPIRED;
      throw error;
    }

    if (cached.attempts >= OTP_MAX_VERIFY_ATTEMPTS) {
      await CacheService.del(cacheKey);
      const error = new Error(
        'Bạn đã nhập sai quá nhiều lần. Vui lòng yêu cầu gửi lại mã OTP mới.',
      );
      error.status = 429;
      error.code = AUTH_ERROR_CODES.OTP_MAX_ATTEMPTS;
      throw error;
    }

    const inputHash = hashToken(otp);
    if (inputHash !== cached.otpHash) {
      cached.attempts += 1;
      const remainingTtl = Math.max(
        1,
        Math.ceil(
          (cached.createdAt + env.botvnOtpTtlSeconds * 1000 - Date.now()) /
            1000,
        ),
      );
      await CacheService.set(cacheKey, cached, remainingTtl);

      const error = new Error(
        `Mã OTP không chính xác. Bạn còn ${OTP_MAX_VERIFY_ATTEMPTS - cached.attempts} lần thử.`,
      );
      error.status = 400;
      error.code = AUTH_ERROR_CODES.OTP_INVALID;
      error.context = {
        attemptsRemaining: OTP_MAX_VERIFY_ATTEMPTS - cached.attempts,
      };
      throw error;
    }

    // OTP đúng → xóa OTP cache, tạo reset token
    await CacheService.del(cacheKey);

    const resetToken = crypto.randomBytes(48).toString('base64url');
    const resetTokenHash = hashToken(resetToken);

    await CacheService.set(
      `${PWD_RESET_TOKEN_PREFIX}:${email}`,
      { resetTokenHash, createdAt: Date.now() },
      PWD_RESET_TOKEN_TTL_SECONDS,
    );

    return { resetToken };
  }

  /**
   * Step 3: Đổi mật khẩu bằng reset token
   */
  async resetPassword(payload) {
    const email = this._normalizeEmail(payload?.email);
    const resetToken =
      typeof payload?.resetToken === 'string'
        ? payload.resetToken.trim()
        : '';
    const newPassword =
      typeof payload?.newPassword === 'string' ? payload.newPassword : '';
    const cacheKey = `${PWD_RESET_TOKEN_PREFIX}:${email}`;

    const cached = await CacheService.get(cacheKey);
    if (!cached || !cached.resetTokenHash) {
      const error = new Error(
        'Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.',
      );
      error.status = 400;
      error.code = AUTH_ERROR_CODES.VALIDATION_ERROR;
      throw error;
    }

    if (hashToken(resetToken) !== cached.resetTokenHash) {
      // Token sai → xóa luôn để chống brute-force
      await CacheService.del(cacheKey);
      const error = new Error(
        'Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.',
      );
      error.status = 400;
      error.code = AUTH_ERROR_CODES.VALIDATION_ERROR;
      throw error;
    }

    // Token hợp lệ → xóa cache
    await CacheService.del(cacheKey);

    const customer = await Customer.findOne({
      email,
      mainType: CUSTOMER_MAIN_TYPES.USER,
    }).select('+botvnPassword');

    if (!customer) {
      const error = new Error('Tài khoản không tồn tại.');
      error.status = 404;
      error.code = AUTH_ERROR_CODES.VALIDATION_ERROR;
      throw error;
    }

    // Đổi mật khẩu
    customer.botvnPassword = await hashPassword(newPassword);
    await customer.save();

    // Force re-login: xóa toàn bộ sessions cũ
    await BotvnUserSession.deleteMany({ customerId: customer._id });

    return { message: 'Đổi mật khẩu thành công.' };
  }
}

module.exports = new BotvnAuthService();
