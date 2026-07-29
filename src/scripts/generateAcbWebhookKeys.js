const crypto = require('crypto');

/**
 * Utility script to generate random keys for ACB Webhook checksum.
 *
 * Secret Key: VIK tạo & cung cấp cho ACB (ACB gọi là "secret_key").
 *             Cấu hình trong .env: ACB_WEBHOOK_SECRET_KEY
 * Bank Key:   ACB tạo & cung cấp cho VIK (ACB gọi là "server_key").
 *             Cấu hình trong .env: ACB_WEBHOOK_BANK_KEY
 *
 * Checksum = SHA256(RequestBody + SecretKey + BankKey)
 */
function generateAcbWebhookKeys() {
  const secretKey = crypto.randomBytes(32).toString('hex');

  console.log('=== ACB WEBHOOK KEYS GENERATED ===\n');
  console.log('🔑 SECRET KEY — VIK tạo & cung cấp cho ACB (ACB gọi là "secret_key"):');
  console.log(secretKey);
  console.log();
  console.log('📋 Cấu hình trong .env:');
  console.log(`ACB_WEBHOOK_SECRET_KEY=${secretKey}`);
  console.log();
  console.log('⚠️  BANK KEY — ACB tạo & cung cấp cho VIK (ACB gọi là "server_key").');
  console.log('   Khi nhận được từ ACB, cấu hình trong .env:');
  console.log('   ACB_WEBHOOK_BANK_KEY=<giá_trị_ACB_cung_cấp>');
  console.log();
  console.log('📋 Cấu hình API Key:');
  const apiKey = crypto.randomBytes(32).toString('hex');
  console.log(`ACB_WEBHOOK_API_KEY=${apiKey}`);
  console.log();
  console.log('🔒 Checksum formula: SHA256(RequestBody + SecretKey + BankKey)');
  console.log('   Header: signature');

  return { secretKey, apiKey };
}

if (require.main === module) {
  generateAcbWebhookKeys();
}

module.exports = generateAcbWebhookKeys;
