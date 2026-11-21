function normalizeBaseUrl(raw) {
  const trimmed = String(raw || '').trim().replace(/\/+$/, '');
  if (!trimmed || trimmed === '*' || !/^https?:\/\/.+/i.test(trimmed)) {
    return '';
  }
  return trimmed;
}

function resolvePublicAppUrl(rawEnv = process.env) {
  const configured = normalizeBaseUrl(rawEnv.PUBLIC_APP_URL);
  if (configured) return configured;
  return rawEnv.NODE_ENV === 'production' ? '' : 'http://localhost:3001';
}

function resolveInvoicePublicBaseUrl(rawEnv = process.env) {
  return (
    normalizeBaseUrl(rawEnv.INVOICE_PUBLIC_URL) ||
    resolvePublicAppUrl(rawEnv)
  );
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 4000,
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3001', // CORS allowlist only (comma-separated origins or '*')
  publicAppUrl: resolvePublicAppUrl(process.env), // Canonical public web URL for customer-facing links
  invoicePublicUrl: normalizeBaseUrl(process.env.INVOICE_PUBLIC_URL), // Optional dedicated domain override for invoice lookup portal
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
  botvnZaloMiniAppApiKey:
    process.env.BOTVN_ZALO_MINI_APP_API_KEY || 'botvn_zalo_mini_app_secret_key',
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

  // ─── Google OAuth ──────────────────────────────────────────────────────────
  botvnGoogleClientId: process.env.BOTVN_GOOGLE_CLIENT_ID || '',

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
  enableAutoApproveTopup: process.env.ENABLE_AUTO_APPROVE_TOPUP === 'true',

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

  // ─── Multi-Partner External Invoice Registry (Key.vn & 3rd-party Partners) ──
  // Mỗi đối tác có cấu hình apiKey & allowedIps hoàn toàn tách biệt.
  // - Đối tác hiện tại: keyvn (KEYVN_API_KEY / ZCODE_API_KEY & KEYVN_ALLOWED_IPS / ZCODE_ALLOWED_IPS)
  // - Thêm đối tác mới (không cần sửa code), xem docs/INVOICE_EXTERNAL_PARTNER_ONBOARDING.md:
  //   INVOICE_PARTNER_<NAME>_API_KEY=...
  //   INVOICE_PARTNER_<NAME>_ALLOWED_IPS=...
  //   (tuỳ chọn) INVOICE_PARTNER_<NAME>_SOURCE_MODULE=...
  //   (tuỳ chọn) INVOICE_PARTNER_<NAME>_SYSTEM=...
  // hoặc JSON: INVOICE_EXTERNAL_PARTNERS='{"partnerX":{"apiKey":"...","allowedIps":"1.2.3.4"}}'
  invoiceExternalPartners: buildInvoiceExternalPartners(process.env),
};

function buildInvoiceExternalPartners(rawEnv = process.env) {
  const partners = {
    keyvn: {
      id: 'keyvn',
      name: 'Key.vn (ZCode)',
      aliases: ['keyvn', 'key.vn', 'zcode'],
      sourceModule: 'zcode',
      system: 'ZCODE',
      apiKey:
        rawEnv.KEYVN_API_KEY ||
        rawEnv.ZCODE_API_KEY ||
        'zcode_secret_key_change_in_production',
      allowedIps: rawEnv.KEYVN_ALLOWED_IPS || rawEnv.ZCODE_ALLOWED_IPS || '',
    },
  };

  // Auto-discover INVOICE_PARTNER_<NAME>_API_KEY & INVOICE_PARTNER_<NAME>_ALLOWED_IPS
  const prefix = 'INVOICE_PARTNER_';
  const apiKeySuffix = '_API_KEY';
  for (const [envKey, envVal] of Object.entries(rawEnv)) {
    if (envKey.startsWith(prefix) && envKey.endsWith(apiKeySuffix) && envVal) {
      const rawName = envKey.slice(prefix.length, -apiKeySuffix.length);
      const id = rawName.toLowerCase();
      if (!id) continue;
      const allowedIpsKey = `${prefix}${rawName}_ALLOWED_IPS`;
      const sourceModuleKey = `${prefix}${rawName}_SOURCE_MODULE`;
      const systemKey = `${prefix}${rawName}_SYSTEM`;
      const existing = partners[id] || {};
      partners[id] = {
        id,
        name: existing.name || rawName,
        aliases: Array.from(
          new Set([...(existing.aliases || []), id, `${id}.vn`]),
        ),
        sourceModule:
          (rawEnv[sourceModuleKey] && String(rawEnv[sourceModuleKey]).trim()) ||
          existing.sourceModule ||
          id,
        system:
          (rawEnv[systemKey] &&
            String(rawEnv[systemKey]).trim().toUpperCase()) ||
          existing.system ||
          rawName.toUpperCase(),
        apiKey: String(envVal).trim(),
        allowedIps:
          rawEnv[allowedIpsKey] !== undefined
            ? String(rawEnv[allowedIpsKey]).trim()
            : existing.allowedIps || '',
      };
    }
  }

  // Optional JSON override: INVOICE_EXTERNAL_PARTNERS
  if (rawEnv.INVOICE_EXTERNAL_PARTNERS) {
    try {
      const parsed = JSON.parse(rawEnv.INVOICE_EXTERNAL_PARTNERS);
      if (parsed && typeof parsed === 'object') {
        for (const [rawId, cfg] of Object.entries(parsed)) {
          if (!cfg || typeof cfg !== 'object') continue;
          const id = rawId.toLowerCase().replace(/\.vn$/, '');
          const existing = partners[id] || {};
          partners[id] = {
            id,
            name: cfg.name || existing.name || rawId,
            aliases: Array.from(
              new Set([
                ...(existing.aliases || []),
                ...(Array.isArray(cfg.aliases) ? cfg.aliases : []),
                id,
                rawId.toLowerCase(),
                `${id}.vn`,
              ]),
            ),
            sourceModule: cfg.sourceModule || existing.sourceModule || id,
            system: cfg.system || existing.system || id.toUpperCase(),
            apiKey:
              cfg.apiKey !== undefined
                ? String(cfg.apiKey).trim()
                : existing.apiKey || '',
            allowedIps:
              cfg.allowedIps !== undefined
                ? Array.isArray(cfg.allowedIps)
                  ? cfg.allowedIps.join(',')
                  : String(cfg.allowedIps).trim()
                : existing.allowedIps || '',
          };
        }
      }
    } catch {
      // Ignore malformed JSON in env
    }
  }

  return partners;
}

function maskEnvForLog(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((v) => maskEnvForLog(v));
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (
      /(key|secret|token|password|uri)/i.test(k) &&
      typeof v === 'string' &&
      v
    ) {
      out[k] = '***';
    } else if (v && typeof v === 'object') {
      out[k] = maskEnvForLog(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

Object.defineProperty(env, 'buildInvoiceExternalPartners', {
  value: buildInvoiceExternalPartners,
  enumerable: false,
});
Object.defineProperty(env, 'resolveInvoicePublicBaseUrl', {
  value: resolveInvoicePublicBaseUrl,
  enumerable: false,
});

Object.freeze(env);
if (env.nodeEnv !== 'test') {
  console.log('🚀 ~ env:', JSON.stringify(maskEnvForLog(env), null, 2));
}

module.exports = env;
