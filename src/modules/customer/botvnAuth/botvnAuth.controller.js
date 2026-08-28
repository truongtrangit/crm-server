const BotvnAuthService = require('./botvnAuth.service');
const { sendSuccess } = require('../../../core/utils/http');
const SystemLogService = require('../../system/log/systemLog.service');
const { RESOURCES } = require('../../../core/constants/rbac');
const { QR_SESSION_STATUS } = require('../../../core/constants/appData');
const { getClientIp } = require('../../../core/utils/request');

class BotvnAuthController {
  /**
   * EXTERNAL LOGIC: Handle login specifically for Botvn users.
   * - Validates and authenticates using BotvnAuthService.
   * - Returns sanitized customer data and separated session tokens.
   * - No system log is recorded here to optimize performance and keep separation.
   */
  async login(req, res) {
    const { customer, tokens, hasPassword } = await BotvnAuthService.login(
      req.body,
      req,
    );

    const payload = {
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        avatar: customer.avatar,
        bio: customer.bio,
        jobTitle: customer.jobTitle,
        isActive: customer.isActive,
        botvnRole: customer.botvnRole,
        rewardCredit: customer.rewardCredit || 0,
        mainCredit: customer.mainCredit || 0,
        eduCredit: customer.eduCredit || 0,
        isEduAccount: customer.isEduAccount || false,
        platforms: customer.platforms || [],
        hasPassword,
      },
      sessionId: tokens.sessionId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accessTokenExpiresAt: tokens.session.accessTokenExpiresAt,
      refreshTokenExpiresAt: tokens.session.refreshTokenExpiresAt,
    };

    return sendSuccess(res, 200, 'Login success', payload);
  }

  async logout(req, res) {
    const sessionId = req.session?.sessionId || req.body?.sessionId;
    if (sessionId) {
      await BotvnAuthService.logout({ sessionId });
    }
    return sendSuccess(res, 200, 'Logout success', null);
  }

  async zaloMiniAppLogin(req, res) {
    const { customer, tokens, hasPassword } =
      await BotvnAuthService.zaloMiniAppLogin(req.body, req);

    SystemLogService.log({
      action: 'login',
      resource: RESOURCES.CUSTOMERS,
      resourceId: customer.id,
      resourceName: customer.name,
      description: 'Bot.vn user login via Zalo Mini App',
      performedBy: {
        userId: customer.id,
        userName: customer.name,
        userAvatar: customer.avatar || '',
      },
      status: 'success',
      ipAddress: getClientIp(req) || 'unknown',
    });

    const payload = {
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        avatar: customer.avatar,
        bio: customer.bio,
        jobTitle: customer.jobTitle,
        isActive: customer.isActive,
        botvnRole: customer.botvnRole,
        rewardCredit: customer.rewardCredit || 0,
        mainCredit: customer.mainCredit || 0,
        eduCredit: customer.eduCredit || 0,
        isEduAccount: customer.isEduAccount || false,
        platforms: customer.platforms || [],
        hasPassword,
      },
      sessionId: tokens.sessionId,
      accessToken: tokens.accessToken,
      accessTokenExpiresAt: tokens.session.accessTokenExpiresAt,
    };

    return sendSuccess(res, 200, 'Zalo Mini App login success', payload);
  }

  async register(req, res) {
    const { customer, otpExpiresIn } = await BotvnAuthService.register(
      req.body,
      req,
    );

    SystemLogService.log({
      action: 'create',
      resource: RESOURCES.CUSTOMERS,
      resourceId: customer.id,
      resourceName: customer.name,
      description: 'Bot.vn user registration',
      performedBy: {
        userId: null,
        userName: customer.name,
        userAvatar: '',
      },
      status: 'success',
      ipAddress: getClientIp(req) || 'unknown',
    });

    // Trigger internal Webhook integration
    const CrmEventEmitter = require('../../../core/services/CrmEventEmitter');
    const {
      SYSTEM_SOURCES,
      SYSTEM_EVENT_TYPES,
    } = require('../../../core/constants/integrationConfig');
    CrmEventEmitter.emit(
      SYSTEM_SOURCES.BOTVN,
      SYSTEM_EVENT_TYPES.BOTVN_DANG_KY,
      {
        ...(customer.toJSON?.() || customer), // Pass customer object as payload
        registrationIp: getClientIp(req),
        registeredAt: new Date().toISOString(),
      },
    );

    const payload = {
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        isActive: customer.isActive,
        rewardCredit: customer.rewardCredit || 0,
        mainCredit: customer.mainCredit || 0,
        eduCredit: customer.eduCredit || 0,
        isEduAccount: customer.isEduAccount || false,
        platforms: customer.platforms || [],
      },
      otpSent: true,
      otpExpiresIn,
    };

    return sendSuccess(res, 201, 'Registration success', payload);
  }

  // ==========================================
  // OTP VERIFICATION
  // ==========================================

  async verifyOtp(req, res) {
    const { customer, tokens, hasPassword } = await BotvnAuthService.verifyOtp(
      req.body,
      req,
    );

    SystemLogService.log({
      action: 'login',
      resource: RESOURCES.CUSTOMERS,
      resourceId: customer.id,
      resourceName: customer.name,
      description: 'Bot.vn user activated via OTP verification',
      performedBy: {
        userId: customer.id,
        userName: customer.name,
        userAvatar: customer.avatar || '',
      },
      status: 'success',
      ipAddress: getClientIp(req) || 'unknown',
    });

    const payload = {
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        avatar: customer.avatar,
        bio: customer.bio,
        jobTitle: customer.jobTitle,
        isActive: customer.isActive,
        botvnRole: customer.botvnRole,
        rewardCredit: customer.rewardCredit || 0,
        mainCredit: customer.mainCredit || 0,
        eduCredit: customer.eduCredit || 0,
        isEduAccount: customer.isEduAccount || false,
        platforms: customer.platforms || [],
        hasPassword,
      },
      sessionId: tokens.sessionId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accessTokenExpiresAt: tokens.session.accessTokenExpiresAt,
      refreshTokenExpiresAt: tokens.session.refreshTokenExpiresAt,
    };

    return sendSuccess(res, 200, 'OTP verified, account activated', payload);
  }

  async resendOtp(req, res) {
    const result = await BotvnAuthService.sendOtp(req.body.email);
    return sendSuccess(res, 200, 'OTP resent', result);
  }

  // ==========================================
  // FORGOT PASSWORD
  // ==========================================

  async forgotPassword(req, res) {
    const result = await BotvnAuthService.forgotPassword(req.body.email);
    return sendSuccess(res, 200, 'OTP sent for password reset', result);
  }

  async forgotPasswordVerifyOtp(req, res) {
    const result = await BotvnAuthService.forgotPasswordVerifyOtp(req.body);
    return sendSuccess(res, 200, 'OTP verified', result);
  }

  async resetPassword(req, res) {
    const result = await BotvnAuthService.resetPassword(req.body);
    return sendSuccess(res, 200, result.message);
  }

  // ==========================================
  // GOOGLE LOGIN
  // ==========================================

  async googleLogin(req, res) {
    const { idToken, accessToken } = req.body;
    const { customer, tokens, hasPassword } =
      await BotvnAuthService.googleLogin({ idToken, accessToken }, req);
    const payload = {
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        avatar: customer.avatar,
        bio: customer.bio,
        jobTitle: customer.jobTitle,
        isActive: customer.isActive,
        botvnRole: customer.botvnRole,
        rewardCredit: customer.rewardCredit || 0,
        mainCredit: customer.mainCredit || 0,
        eduCredit: customer.eduCredit || 0,
        isEduAccount: customer.isEduAccount || false,
        platforms: customer.platforms || [],
        hasPassword,
      },
      sessionId: tokens.sessionId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accessTokenExpiresAt: tokens.session.accessTokenExpiresAt,
      refreshTokenExpiresAt: tokens.session.refreshTokenExpiresAt,
    };

    return sendSuccess(res, 200, 'Google login successful', payload);
  }

  // ==========================================
  // UPDATE PROFILE
  // ==========================================

  async updateProfile(req, res) {
    const customerId = req.user.id; // From botvnAuthenticateRequest middleware
    const updatedCustomer = await BotvnAuthService.updateProfile(
      customerId,
      req.body,
    );

    const payload = {
      id: updatedCustomer.id,
      name: updatedCustomer.name,
      email: updatedCustomer.email,
      phone: updatedCustomer.phone,
      avatar: updatedCustomer.avatar,
      bio: updatedCustomer.bio,
      jobTitle: updatedCustomer.jobTitle,
      isActive: updatedCustomer.isActive,
      botvnRole: updatedCustomer.botvnRole,
      rewardCredit: updatedCustomer.rewardCredit || 0,
      mainCredit: updatedCustomer.mainCredit || 0,
      eduCredit: updatedCustomer.eduCredit || 0,
      isEduAccount: updatedCustomer.isEduAccount || false,
    };

    return sendSuccess(res, 200, 'Cập nhật hồ sơ thành công', payload);
  }

  // ==========================================
  // CHANGE PASSWORD & DELETE ACCOUNT
  // ==========================================

  async changePassword(req, res) {
    const customerId = req.user.id;
    const result = await BotvnAuthService.changePassword(customerId, req.body);

    SystemLogService.log({
      action: 'update',
      resource: RESOURCES.CUSTOMERS,
      resourceId: customerId,
      resourceName: req.user.name || customerId,
      description: 'Bot.vn user changed password',
      req,
    });

    return sendSuccess(res, 200, result.message);
  }

  async deleteAccount(req, res) {
    const customerId = req.user.id;
    const result = await BotvnAuthService.deleteAccount(customerId, req.body);

    SystemLogService.log({
      action: 'delete',
      resource: RESOURCES.CUSTOMERS,
      resourceId: customerId,
      resourceName: req.user.name || customerId,
      description: 'Bot.vn user deleted account',
      req,
    });

    return sendSuccess(res, 200, result.message);
  }

  // ==========================================
  // ZALO QR ENDPOINTS
  // ==========================================

  async generateQr(req, res) {
    const result = await BotvnAuthService.generateQrToken(req);
    return sendSuccess(res, 200, 'QR Code generated', result);
  }

  async scanQr(req, res) {
    const { token } = req.params;
    const result = await BotvnAuthService.scanQrToken(token);
    return sendSuccess(res, 200, 'QR Scanned', result);
  }

  async getQrStatus(req, res) {
    const { token } = req.params;
    const MAX_WAIT_MS = 20000; // 20 giây tối đa
    const INTERVAL_MS = 1500; // Quét Redis mỗi 1.5 giây
    let elapsed = 0;
    let isClientClosed = false;

    // Lắng nghe sự kiện trình duyệt huỷ kết nối (đóng tab, modal)
    req.on('close', () => {
      isClientClosed = true;
    });

    // Lấy current_status từ query (mặc định là PENDING nếu client không gửi)
    const currentClientStatus =
      req.query.current_status || QR_SESSION_STATUS.PENDING;

    while (elapsed < MAX_WAIT_MS && !isClientClosed) {
      const session = await BotvnAuthService.getQrStatus(token);

      // Nếu trạng thái trong Cache khác với trạng thái hiện tại của Client, lập tức trả về!
      // Điều này giúp:
      // 1. Từ PENDING -> SCANNED: báo ngay cho Client biết để mờ UI.
      // 2. Client gọi lại với current_status=SCANNED -> Server tiếp tục hold.
      // 3. Từ SCANNED -> AUTHENTICATED: báo ngay cho Client biết để login.
      if (session.status !== currentClientStatus) {
        // Nếu AUTHENTICATED, format payload trả về kèm user info để client tự login
        if (session.status === QR_SESSION_STATUS.AUTHENTICATED) {
          const { customer, tokens, hasPassword } = session;
          const payload = {
            status: session.status,
            customer: {
              id: customer.id,
              name: customer.name,
              email: customer.email,
              phone: customer.phone,
              avatar: customer.avatar,
              bio: customer.bio,
              jobTitle: customer.jobTitle,
              isActive: customer.isActive,
              botvnRole: customer.botvnRole,
              rewardCredit: customer.rewardCredit || 0,
              mainCredit: customer.mainCredit || 0,
              eduCredit: customer.eduCredit || 0,
              isEduAccount: customer.isEduAccount || false,
              platforms: customer.platforms || [],
              hasPassword,
            },
            sessionId: tokens.sessionId,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            accessTokenExpiresAt: tokens.session.accessTokenExpiresAt,
            refreshTokenExpiresAt: tokens.session.refreshTokenExpiresAt,
          };

          SystemLogService.log({
            action: 'login',
            resource: RESOURCES.CUSTOMERS,
            resourceId: customer.id,
            resourceName: customer.name,
            description: 'Bot.vn user login via Zalo QR',
            performedBy: {
              userId: customer.id,
              userName: customer.name,
              userAvatar: customer.avatar,
            },
            status: 'success',
            ipAddress: getClientIp(req) || 'unknown',
          });

          return sendSuccess(res, 200, 'QR Authenticated', payload);
        }

        // Nếu trạng thái khác (SCANNED, NEEDS_REGISTRATION, v.v.), trả về trực tiếp
        return sendSuccess(res, 200, 'QR Status', {
          status: session.status,
          zaloProfile: session.zaloProfile,
        });
      }

      // Đợi 1 nhịp trước khi quét lại
      await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
      elapsed += INTERVAL_MS;
    }

    // Nếu vòng lặp kết thúc do client đóng kết nối, không trả HTTP response
    if (isClientClosed) return;

    // Hết 20s mà vẫn PENDING, trả về PENDING để Client tự nối lại
    return sendSuccess(res, 200, 'QR Status Timeout', {
      status: QR_SESSION_STATUS.PENDING,
    });
  }

  async verifyQr(req, res) {
    const { qrToken, zaloProfile } = req.body;

    if (!qrToken || !zaloProfile) {
      return sendSuccess(res, 400, 'Thiếu qrToken hoặc zaloProfile', null);
    }

    const result = await BotvnAuthService.verifyQrToken(
      qrToken,
      zaloProfile,
      req,
    );
    return sendSuccess(res, 200, 'Verify QR success', result);
  }
}

module.exports = new BotvnAuthController();
