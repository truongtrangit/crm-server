const BotvnAuthService = require('./botvnAuth.service');
const { sendSuccess } = require('../../../core/utils/http');

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
      },
      sessionId: tokens.sessionId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accessTokenExpiresAt: tokens.session.accessTokenExpiresAt,
      refreshTokenExpiresAt: tokens.session.refreshTokenExpiresAt,
    };

    return sendSuccess(res, 200, "Login success", payload);
  }
}

module.exports = new BotvnAuthController();
