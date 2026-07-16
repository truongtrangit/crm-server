const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 4000,
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  accessTokenTtlMinutes: Number(process.env.ACCESS_TOKEN_TTL_MINUTES) || 15,
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS) || 30,
  passwordResetTokenTtlMinutes:
    Number(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES) || 30,
  defaultUserPassword: process.env.DEFAULT_USER_PASSWORD || 'crm123456',
  enableRedis: process.env.ENABLE_REDIS === 'true',
  redisUri: process.env.REDIS_URI || 'redis://127.0.0.1:6379',
  redisUsername: process.env.REDIS_USERNAME || 'dev_user',
  redisPassword: process.env.REDIS_PASSWORD || 'dev_password',
  cacheRoleTtlSeconds: Number(process.env.CACHE_ROLE_TTL_SECONDS) || 86400, // Mặc định 24h
  cacheMetadataTtlSeconds:
    Number(process.env.CACHE_METADATA_TTL_SECONDS) || 14400, // Mặc định 4h

  // ─── Webhook ─────────────────────────────────────────────────────────────────
  webhookSecret:
    process.env.WEBHOOK_SECRET || 'whsec_dev_secret_key_change_in_production',
  botvnQrLoginWebhookSecret:
    process.env.BOTVN_QR_LOGIN_WEBHOOK_SECRET || 'botvn_whsec_dev_secret_key',
  webhookAllowedIps: process.env.WEBHOOK_ALLOWED_IPS || '', // comma-separated, empty = allow all

  // ─── External API ────────────────────────────────────────────────────────────
  externalApiKey: process.env.EXTERNAL_API_KEY || 'botvn_key_123',

  // ─── BotVN Auth ────────────────────────────────────────────────────────────
  botvnAccessTokenTtlMinutes:
    Number(process.env.BOTVN_ACCESS_TOKEN_TTL_MINUTES || 60 * 24) * 60 * 1000, // 1 day
  botvnRefreshTokenTtlDays:
    Number(process.env.BOTVN_REFRESH_TOKEN_TTL_DAYS) || 15, // 15 days
  botvnQrTokenTtlSeconds: Number(process.env.BOTVN_QR_TOKEN_TTL_SECONDS) || 180, // Default 3 minutes
  botvnQrRequireContextConfirm: process.env.BOTVN_QR_REQUIRE_CONTEXT_CONFIRM === 'true',

  // ─── Feature Flags ───────────────────────────────────────────────────────────
  enableCloneUpdate: process.env.ENABLE_CLONE_UPDATE === 'true',
  enableHttpRetry: process.env.ENABLE_HTTP_RETRY === 'true',

  // ─── Smax Ai ─────────────────────────────────────────────────────────────────
  smaxCreditValidationUrl:
    process.env.SMAX_CREDIT_VALIDATION_URL ||
    'https://dev.smax.ai/api/backdoors/botvn/billing',
  smaxCreditValidationToken: process.env.SMAX_CREDIT_VALIDATION_TOKEN || '',
};

Object.freeze(env);
console.log('🚀 ~ env:', JSON.stringify(env, null, 2));

module.exports = env;
