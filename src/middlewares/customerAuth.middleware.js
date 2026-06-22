const { sendError } = require("../core/utils/http");
const { hashToken, readBearerToken } = require("../core/utils/auth");
const BotvnUserSession = require("../modules/customer/botvnAuth/botvnUserSession.model");
const Customer = require("../modules/customer/customer/customer.model");

async function verifyCustomerAuth(req, res, next) {
  try {
    const accessToken = readBearerToken(req);

    if (!accessToken) {
      return sendError(res, 401, "Yêu cầu đăng nhập", {
        code: "AUTHENTICATION_REQUIRED",
      });
    }

    const session = await BotvnUserSession.findOne({
      accessTokenHash: hashToken(accessToken),
    });

    if (!session) {
      return sendError(res, 401, "Phiên đăng nhập không hợp lệ hoặc đã hết hạn", {
        code: "INVALID_ACCESS_TOKEN",
      });
    }

    if (new Date(session.accessTokenExpiresAt).getTime() <= Date.now()) {
      await BotvnUserSession.deleteOne({ _id: session._id });
      return sendError(res, 401, "Phiên đăng nhập đã hết hạn", {
        code: "ACCESS_TOKEN_EXPIRED",
      });
    }

    const customer = await Customer.findById(session.customerId);
    if (!customer) {
      return sendError(res, 401, "Tài khoản không tồn tại", {
        code: "USER_NOT_FOUND",
      });
    }

    if (customer.isActive === false) {
      return sendError(res, 403, "Tài khoản đã bị khóa", {
        code: "ACCOUNT_INACTIVE",
      });
    }

    const now = new Date();
    const lastUsed = session.lastUsedAt ? new Date(session.lastUsedAt).getTime() : 0;
    
    // Throttle updates
    if (now.getTime() - lastUsed > 5 * 60 * 1000) {
      session.lastUsedAt = now;
      await session.save();
    }

    req.customer = customer;
    req.customerSession = session;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  verifyCustomerAuth,
};
