const { readBearerToken, hashToken } = require("../utils/auth");
const BotvnUserSession = require("../../modules/customer/botvnAuth/botvnUserSession.model");
const Customer = require("../../modules/customer/customer/customer.model");
const env = require("../config/env");
const { sendError } = require("../utils/http");

function requireExternalApiKey(req, res, next) {
  const apiKey = req.header("X-API-Key");
  if (!apiKey || apiKey !== env.externalApiKey) {
    return sendError(res, 401, "Invalid or missing X-API-Key", {
      code: "INVALID_API_KEY",
    });
  }
  return next();
}

async function botvnAuthenticateRequest(req, res, next) {
  try {
    const accessToken = readBearerToken(req);

    if (!accessToken) {
      return sendError(res, 401, "Authentication required", {
        code: "AUTHENTICATION_REQUIRED",
      });
    }

    const session = await BotvnUserSession.findOne({
      accessTokenHash: hashToken(accessToken),
    });

    if (!session) {
      return sendError(res, 401, "Invalid or expired access token", {
        code: "INVALID_ACCESS_TOKEN",
      });
    }

    if (new Date(session.accessTokenExpiresAt).getTime() <= Date.now()) {
      await BotvnUserSession.deleteOne({ _id: session._id });
      return sendError(res, 401, "Access token has expired", {
        code: "ACCESS_TOKEN_EXPIRED",
      });
    }

    const customer = await Customer.findById(session.customerId);
    if (!customer) {
      return sendError(res, 401, "User not found", {
        code: "USER_NOT_FOUND",
      });
    }

    // Attach to request
    req.user = customer;
    req.session = session;

    return next();
  } catch (error) {
    return sendError(res, 500, "Authentication error", {
      code: "AUTH_ERROR",
      details: error.message,
    });
  }
}

module.exports = {
  requireExternalApiKey,
  botvnAuthenticateRequest,
};
