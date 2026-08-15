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
  integrationWebhookApiKey: process.env.INTEGRATION_WEBHOOK_API_KEY || '',

  // ─── Video Encryption ─────────────────────────────────────────────────────────
  // 32-byte hex key for AES-256-GCM videoId encryption.
  // Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  videoEncryptionKey:
    process.env.VIDEO_ENCRYPTION_KEY ||
    'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',

  // ─── BotVN Auth ────────────────────────────────────────────────────────────
  botvnAccessTokenTtlMinutes:
    Number(process.env.BOTVN_ACCESS_TOKEN_TTL_MINUTES || 60 * 24) * 60 * 1000, // 1 day
  botvnRefreshTokenTtlDays:
    Number(process.env.BOTVN_REFRESH_TOKEN_TTL_DAYS) || 15, // 15 days
  botvnQrTokenTtlSeconds: Number(process.env.BOTVN_QR_TOKEN_TTL_SECONDS) || 180, // Default 3 minutes

  // ─── BotVN OTP ────────────────────────────────────────────────────────────
  botvnOtpTtlSeconds: Number(process.env.BOTVN_OTP_TTL_SECONDS) || 60, // Default 1 phút
  botvnOtpApiUrl: process.env.BOTVN_OTP_API_URL || '', // URL API bên thứ 3 gửi OTP (rỗng = chỉ log console)
  botvnOtpApiKey: process.env.BOTVN_OTP_API_KEY || '', // API key xác thực bên thứ 3

  // ─── ZCode ──────────────────────────────────────────────────────────────────
  zcodeSkus:
    process.env.ZCODE_SKUS || 'ZB5000,ZB10000,ZC10GB,ZC100GB,ZC500GB,ZC1T',
  zcodeAllowedIps: process.env.ZCODE_ALLOWED_IPS || '', // comma-separated, empty = allow all
  zcodeApiKey:
    process.env.ZCODE_API_KEY || 'zcode_secret_key_change_in_production',
  zcodeEncryptionKey:
    process.env.ZCODE_ENCRYPTION_KEY ||
    'zcode_encryption_key_change_in_production',

  // ─── Feature Flags ───────────────────────────────────────────────────────────
  enableCloneUpdate: process.env.ENABLE_CLONE_UPDATE === 'true',
  enableHttpRetry: process.env.ENABLE_HTTP_RETRY === 'true',

  // ─── ACB Bank Webhook ─────────────────────────────────────────────────────────
  acbWebhookApiKey:
    process.env.ACB_WEBHOOK_API_KEY || 'acb_webhook_key_change_in_production',
  acbWebhookSecretKey:
    process.env.ACB_WEBHOOK_SECRET_KEY || 'acb_secret_key_change_in_production', // VIK tạo & cung cấp cho ACB (ACB gọi là "secret_key")
  acbWebhookBankKey:
    process.env.ACB_WEBHOOK_BANK_KEY || 'acb_bank_key_change_in_production', // ACB tạo & cung cấp cho VIK (ACB gọi là "server_key")
  acbWebhookChecksumHeader:
    process.env.ACB_WEBHOOK_CHECKSUM_HEADER || 'signature', // Tên header chứa checksum
  acbWebhookChecksumAlgorithm:
    process.env.ACB_WEBHOOK_CHECKSUM_ALGORITHM || 'SHA256', // SHA1, SHA256, SHA512, MD5
  acbWebhookAllowedIps: process.env.ACB_WEBHOOK_ALLOWED_IPS || '', // comma-separated, supports CIDR, '0.0.0.0' = allow all

  // ─── Smax Ai ─────────────────────────────────────────────────────────────────
  smaxCreditValidationUrl:
    process.env.SMAX_CREDIT_VALIDATION_URL ||
    'https://dev.smax.ai/api/backdoors/botvn/billing',
  smaxCreditValidationToken: process.env.SMAX_CREDIT_VALIDATION_TOKEN || '',

  // ─── eInvoice (BKAV eHoaDon) ──────────────────────────────────────────────
  // Endpoint WebService: Dev=wsdemo.ehoadon.vn, Prod=ws.ehoadon.vn
  bkavInvoiceEndpoint:
    process.env.BKAV_INVOICE_ENDPOINT ||
    'https://wsdemo.ehoadon.vn/WSPublicEHoaDon.asmx',
  bkavInvoicePartnerGUID: process.env.BKAV_INVOICE_PARTNER_GUID || '',
  bkavInvoicePartnerToken: process.env.BKAV_INVOICE_PARTNER_TOKEN || '',
  bkavInvoiceCmdType: Number(process.env.BKAV_INVOICE_CMD_TYPE) || 111,
  bkavInvoiceSerial: process.env.BKAV_INVOICE_SERIAL || '', // Ký hiệu HĐ: MAA, MVK
};

Object.freeze(env);
console.log('🚀 ~ env:', JSON.stringify(env, null, 2));

module.exports = env;
