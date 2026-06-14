const env = require('../config/env');
const { sendError } = require('../utils/http');

function requireExternalApiKey(req, res, next) {
  const apiKey = req.header("X-API-Key");
  
  if (!apiKey || apiKey !== env.externalApiKey) {
    return sendError(res, 401, "Invalid or missing X-API-Key", {
      code: "INVALID_API_KEY",
    });
  }
  
  return next();
}

module.exports = {
  requireExternalApiKey,
};
