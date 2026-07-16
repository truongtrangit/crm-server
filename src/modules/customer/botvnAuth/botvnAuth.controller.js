const BotvnAuthService = require("./botvnAuth.service");
const { sendSuccess } = require("../../../core/utils/http");
const SystemLogService = require("../../system/log/systemLog.service");
const { RESOURCES } = require("../../../core/constants/rbac");
const { QR_SESSION_STATUS } = require("../../../core/constants/appData");

class BotvnAuthController {
  /**
   * EXTERNAL LOGIC: Handle login specifically for Botvn users.
   * - Validates and authenticates using BotvnAuthService.
   * - Returns sanitized customer data and separated session tokens.
   * - No system log is recorded here to optimize performance and keep separation.
   */
  async login(req, res) {
    const { customer, tokens } = await BotvnAuthService.login(req.body, req);

    const payload = {
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        avatar: customer.avatar,
        isActive: customer.isActive,
        botvnRole: customer.botvnRole,
        rewardCredit: customer.rewardCredit || 0,
        mainCredit: customer.mainCredit || 0,
        eduCredit: customer.eduCredit || 0,
        isEduAccount: customer.isEduAccount || false,
      },
      sessionId: tokens.sessionId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accessTokenExpiresAt: tokens.session.accessTokenExpiresAt,
      refreshTokenExpiresAt: tokens.session.refreshTokenExpiresAt,
    };

    return sendSuccess(res, 200, "Login success", payload);
  }

  async logout(req, res) {
    await BotvnAuthService.logout(req.body);
    return sendSuccess(res, 200, "Logout success", null);
  }

  async register(req, res) {
    const customer = await BotvnAuthService.register(req.body, req);

    SystemLogService.log({
      action: "create",
      resource: RESOURCES.CUSTOMERS,
      resourceId: customer.id,
      resourceName: customer.name,
      description: "Bot.vn user registration",
      performedBy: {
        userId: null,
        userName: customer.name,
        userAvatar: "",
      },
      status: "success",
      ipAddress: req.ip || "unknown",
    });

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
      },
    };

    return sendSuccess(res, 201, "Registration success", payload);
  }

  // ==========================================
  // ZALO QR ENDPOINTS
  // ==========================================

  async generateQr(req, res) {
    const result = await BotvnAuthService.generateQrToken(req);
    return sendSuccess(res, 200, "QR Code generated", result);
  }

  async scanQr(req, res) {
    const { token } = req.params;
    const result = await BotvnAuthService.scanQrToken(token);
    return sendSuccess(res, 200, "QR Scanned", result);
  }

  async getQrStatus(req, res) {
    const { token } = req.params;
    const MAX_WAIT_MS = 20000; // 20 giây tối đa
    const INTERVAL_MS = 1500;  // Quét Redis mỗi 1.5 giây
    let elapsed = 0;
    let isClientClosed = false;

    // Lắng nghe sự kiện trình duyệt huỷ kết nối (đóng tab, modal)
    req.on("close", () => {
      isClientClosed = true;
    });

    while (elapsed < MAX_WAIT_MS && !isClientClosed) {
      const session = await BotvnAuthService.getQrStatus(token);
      
      // Nếu trạng thái đã thay đổi khỏi PENDING, lập tức trả về kết quả
      if (session.status !== QR_SESSION_STATUS.PENDING) {
        // Nếu AUTHENTICATED, format payload trả về kèm user info để client tự login
        if (session.status === QR_SESSION_STATUS.AUTHENTICATED) {
          const { customer, tokens } = session;
          const payload = {
            status: session.status,
            customer: {
              id: customer.id,
              name: customer.name,
              email: customer.email,
              phone: customer.phone,
              avatar: customer.avatar,
              isActive: customer.isActive,
              botvnRole: customer.botvnRole,
              rewardCredit: customer.rewardCredit || 0,
              mainCredit: customer.mainCredit || 0,
              eduCredit: customer.eduCredit || 0,
              isEduAccount: customer.isEduAccount || false,
            },
            sessionId: tokens.sessionId,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            accessTokenExpiresAt: tokens.session.accessTokenExpiresAt,
            refreshTokenExpiresAt: tokens.session.refreshTokenExpiresAt,
          };
          
          SystemLogService.log({
            action: "login",
            resource: RESOURCES.CUSTOMERS,
            resourceId: customer.id,
            resourceName: customer.name,
            description: "Bot.vn user login via Zalo QR",
            performedBy: {
              userId: customer.id,
              userName: customer.name,
              userAvatar: customer.avatar,
            },
            status: "success",
            ipAddress: req.ip || "unknown",
          });

          return sendSuccess(res, 200, "QR Authenticated", payload);
        }
        
        // Nếu trạng thái khác (SCANNED, NEEDS_REGISTRATION, v.v.), trả về trực tiếp
        return sendSuccess(res, 200, "QR Status", { status: session.status, zaloProfile: session.zaloProfile });
      }

      // Đợi 1 nhịp trước khi quét lại
      await new Promise(resolve => setTimeout(resolve, INTERVAL_MS));
      elapsed += INTERVAL_MS;
    }

    // Nếu vòng lặp kết thúc do client đóng kết nối, không trả HTTP response
    if (isClientClosed) return;

    // Hết 20s mà vẫn PENDING, trả về PENDING để Client tự nối lại
    return sendSuccess(res, 200, "QR Status Timeout", { status: QR_SESSION_STATUS.PENDING });
  }

  async verifyQr(req, res) {
    const { qrToken, zaloProfile } = req.body;
    
    if (!qrToken || !zaloProfile) {
      return sendSuccess(res, 400, "Thiếu qrToken hoặc zaloProfile", null);
    }

    const result = await BotvnAuthService.verifyQrToken(qrToken, zaloProfile, req);
    return sendSuccess(res, 200, "Verify QR success", result);
  }
}

module.exports = new BotvnAuthController();
