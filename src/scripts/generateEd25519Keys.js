const { generateKeyPairSync } = require('crypto');

/**
 * Utility script to generate Ed25519 Key Pair for ACB Webhook signing.
 *
 * Private Key (PKCS8 PEM): Used by ACB Bank / Client to SIGN webhooks.
 * Public Key  (SPKI PEM):  Configured in CRM Server env (ACB_WEBHOOK_PUBLIC_KEY) to VERIFY webhooks.
 */
function generateEd25519Keys() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  console.log('=== ACB WEBHOOK ED25519 KEYPAIR GENERATED ===\n');
  console.log('🔐 PRIVATE KEY (Provide to ACB Bank / Client for Signing):');
  console.log(privateKey);
  console.log('🔓 PUBLIC KEY (Configure in CRM Server .env as ACB_WEBHOOK_PUBLIC_KEY):');
  console.log(publicKey);

  return { publicKey, privateKey };
}

if (require.main === module) {
  generateEd25519Keys();
}

module.exports = generateEd25519Keys;
