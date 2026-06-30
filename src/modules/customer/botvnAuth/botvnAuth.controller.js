const BotvnAuthService = require("./botvnAuth.service");
const { sendSuccess } = require("../../../core/utils/http");
const SystemLogService = require("../../system/log/systemLog.service");
const { RESOURCES } = require("../../../core/constants/rbac");

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
      },
    };

    return sendSuccess(res, 201, "Registration success", payload);
  }
}

module.exports = new BotvnAuthController();
