const dotenv = require("dotenv");

dotenv.config();

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 4000,
  mongoUri: process.env.MONGO_URI || "mongodb://127.0.0.1:27017",
  clientUrl: process.env.CLIENT_URL || "http://localhost:3000",
  accessTokenTtlMinutes: Number(process.env.ACCESS_TOKEN_TTL_MINUTES) || 15,
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS) || 30,
  passwordResetTokenTtlMinutes:
    Number(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES) || 30,
  defaultUserPassword: process.env.DEFAULT_USER_PASSWORD || "crm123456",
  enableRedis: process.env.ENABLE_REDIS === "true",
  redisUri: process.env.REDIS_URI || "redis://127.0.0.1:6379",
  redisUsername: process.env.REDIS_USERNAME || "dev_user",
  redisPassword: process.env.REDIS_PASSWORD || "dev_password",
  cacheRoleTtlSeconds: Number(process.env.CACHE_ROLE_TTL_SECONDS) || 86400, // Mặc định 24h
  cacheMetadataTtlSeconds: Number(process.env.CACHE_METADATA_TTL_SECONDS) || 14400, // Mặc định 4h

  // ─── Webhook ─────────────────────────────────────────────────────────────────
  webhookSecret: process.env.WEBHOOK_SECRET || "whsec_dev_secret_key_change_in_production",
  webhookSigningKey: process.env.WEBHOOK_SIGNING_KEY || "whsk_dev_signing_key_change_in_production",
  webhookAllowedIps: process.env.WEBHOOK_ALLOWED_IPS || "", // comma-separated, empty = allow all
};

module.exports = env;
