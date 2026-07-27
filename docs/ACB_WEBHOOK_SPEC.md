# ACB Bank Webhook — Tài Liệu Tích Hợp (Integration Spec)

> **Version:** 2.0 (Ed25519 Asymmetric Signing)
> **Prod Base URL:** `https://final.vn/api/v1/webhooks/acb`
> **Dev Base URL:** `https://crm-server-rvzz.onrender.com/api/v1/webhooks/acb`
> **Content-Type:** `application/json`

---

## Tổng Quan

API webhook cho ACB gửi thông tin giao dịch ngân hàng sang CRM Server. ACB gọi endpoint này mỗi khi có giao dịch mới.

### Luồng Tích Hợp

```text
┌──────────────┐     ┌──────────────┐
│ ACB Server   │     │ CRM Server   │
│ (Bank)       │     │ (Webhook)    │
└──────┬───────┘     └──────┬───────┘
       │                    │
       │  1. POST           │
       │  /transaction      │
       │  Headers:          │
       │    X-API-Key       │
       │    X-Webhook-      │
       │    Signature       │
       │    X-Webhook-      │
       │    Timestamp       │
       │───────────────────>│
       │                    │  2. Verify:
       │                    │     - Content-Type
       │                    │     - IP Allowlist
       │                    │     - Brute-force check
       │                    │     - API Key (timing-safe)
       │                    │     - Ed25519 Signature
       │                    │     - Timestamp ±5 min
       │                    │     - Replay nonce
       │                    │
       │  3. Response       │
       │  200 OK            │
       │<───────────────────│
       │                    │
```

### Security Pipeline (Thứ Tự Xác Thực)

```text
Request → enforceJsonContentType (415)
        → checkAcbIpAllowlist    (403)
        → checkAcbBruteForce     (403)
        → verifyAcbApiKey        (401)
        → verifyAcbWebhookSignature (401)
        → Controller/Service
```

Mỗi layer reject sẽ dừng pipeline ngay — request không qua được layer nào thì không chạy layer sau.

---

## Authentication

### Bước 1: API Key

Mọi request phải gửi kèm header `X-API-Key`:

```
X-API-Key: <api_key_do_CRM_cấp>
```

Server so sánh API key bằng **timing-safe comparison** (`crypto.timingSafeEqual`) để ngăn timing attack.

### Bước 2: Webhook Signature (Ed25519 Asymmetric Signing)

Mỗi request phải được **ký bằng Ed25519 Private Key** (phía ACB giữ) để đảm bảo:
- **Non-repudiation:** Request thực sự đến từ ACB (chống chối bỏ)
- **Integrity:** Payload chưa bị chỉnh sửa trên đường truyền
- **Zero-trust:** CRM Server chỉ lưu **Public Key** — ngay cả khi leak cấu hình server, attacker không thể giả mạo signature

#### Quy Tắc

| Đặc tính | Chi tiết |
|----------|---------|
| Algorithm | **Ed25519** (PureEd25519 / Curve25519) |
| Private Key Format | PKCS8 PEM — Do ACB lưu trữ bí mật dùng để **KÝ** |
| Public Key Format | SPKI PEM — Do CRM Server lưu trữ trong `ACB_WEBHOOK_PUBLIC_KEY` dùng để **XÁC MINH** |
| Signature Header | `X-Webhook-Signature: ed25519=<hex_digest>` |
| Signature Length | 128 ký tự hex (= 64 bytes raw) |
| Timestamp Header | `X-Webhook-Timestamp: <unix_seconds>` |
| Timestamp Tolerance | ±5 phút — request cũ hơn 5 phút sẽ bị reject |
| Replay Protection | Mỗi signature chỉ dùng được **1 lần** — gửi lại cùng signature sẽ bị reject |

#### Cách Tính Signature — Từng Bước

```text
Bước 1: Lấy timestamp hiện tại (Unix seconds)
        → timestamp = Math.floor(Date.now() / 1000)
        → Ví dụ: 1753612800

Bước 2: Lấy raw JSON body (CHƯA parse, CHƯA format lại, giữ nguyên bytes)
        → Ví dụ: {"txId":"ACB20260727001234","amount":5000000}

Bước 3: Ghép payload bằng dấu chấm "."
        → signed_payload = "<timestamp>.<raw_body>"
        → Ví dụ: "1753612800.{"txId":"ACB20260727001234","amount":5000000}"

Bước 4: Ký payload bằng Ed25519 Private Key
        → signature_bytes = Ed25519_Sign(private_key, signed_payload_bytes)

Bước 5: Chuyển signature sang hex string
        → signature_hex = signature_bytes.toString('hex')
        → Ví dụ: "a1b2c3d4e5f6....(128 ký tự hex)"

Bước 6: Gửi 2 header:
        → X-Webhook-Timestamp: 1753612800
        → X-Webhook-Signature: ed25519=a1b2c3d4e5f6....(128 ký tự hex)
```

> ⚠️ **Quan trọng:** `signed_payload` phải là Buffer concatenation: `Buffer.concat([Buffer.from(timestamp + '.'), rawBodyBuffer])` — KHÔNG phải string concatenation đơn thuần. Điều này đảm bảo raw body giữ nguyên byte encoding.

### Bước 3: Content-Type (Bắt Buộc)

Mọi request **bắt buộc** gửi header:

```
Content-Type: application/json
```

Request với Content-Type khác (XML, form-data, text/plain, ...) sẽ bị reject `415 Unsupported Media Type`.

### Bước 4: IP Allowlist (Tùy Chọn)

Nếu ACB cung cấp được danh sách IP tĩnh, CRM sẽ cấu hình whitelist. Các request từ IP ngoài whitelist sẽ bị reject 403.

---

## Rate Limiting & Brute-force Protection

### Rate Limiting

| Thông số | Giá trị |
|----------|---------|
| Window | 1 phút |
| Max requests | 300 request/min/IP |
| Headers trả về | `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` |

Khi vượt quá limit, API trả về HTTP `429 Too Many Requests`.

### Brute-force Auto-block

| Thông số | Giá trị |
|----------|---------|
| Ngưỡng | 5 lần auth fail (sai API key hoặc signature) |
| Trong | 10 phút |
| Hậu quả | IP bị block **30 phút**, mọi request trả 403 |

> ⚠️ **Lưu ý quan trọng:** Nếu đang tích hợp và gặp lỗi 403 liên tục, có thể IP đã bị auto-block. Hãy đợi 30 phút hoặc liên hệ admin CRM để unblock.

---

## Endpoint

### `POST /transaction` — Gửi Giao Dịch

#### Request

```http
POST /api/v1/webhooks/acb/transaction
Content-Type: application/json
X-API-Key: acb_webhook_key_change_in_production
X-Webhook-Signature: ed25519=a1b2c3d4e5f6...(128 hex chars)
X-Webhook-Timestamp: 1753612800
```

**Body:**

| Field | Type | Required | Mô tả |
|-------|------|----------|-------|
| `txId` | string | ✅ | Mã giao dịch duy nhất từ ACB |
| `amount` | number | ✅ | Số tiền giao dịch (≥ 0) |
| `sender` | string | ❌ | Tên người gửi |
| `content` | string | ❌ | Nội dung chuyển khoản |
| `transactionDate` | date | ❌ | Ngày giờ giao dịch (ISO 8601) |

```json
{
  "txId": "ACB20260727001234",
  "amount": 5000000,
  "sender": "NGUYEN VAN A",
  "content": "Thanh toan don hang DH001",
  "transactionDate": "2026-07-27T10:30:00.000Z"
}
```

> ℹ️ `txId` phải là duy nhất. Nếu gửi lại cùng `txId`, hệ thống trả về HTTP 200 với status `DUPLICATE` (idempotent — không gây lỗi 500).

---

#### Responses

##### ✅ 200 — Tiếp nhận thành công

```json
{
  "statusCode": 200,
  "message": "Transaction received",
  "data": {
    "id": "BLT-20260727-0001",
    "txId": "ACB20260727001234",
    "status": "pending"
  }
}
```

##### ✅ 200 — Giao dịch trùng (Idempotent)

```json
{
  "statusCode": 200,
  "message": "Transaction already received (duplicate)",
  "data": {
    "txId": "ACB20260727001234",
    "status": "DUPLICATE"
  }
}
```

##### ❌ 400 — Lỗi Validation

```json
{
  "statusCode": 400,
  "code": "BAD_REQUEST",
  "message": "Transaction ID không được để trống"
}
```

##### ❌ 401 — API Key không hợp lệ

```json
{
  "statusCode": 401,
  "code": "ACB_INVALID_API_KEY",
  "message": "Invalid or missing X-API-Key"
}
```

##### ❌ 401 — Thiếu Signature/Timestamp headers

```json
{
  "statusCode": 401,
  "code": "ACB_MISSING_SIGNATURE",
  "message": "Missing webhook signature"
}
```

##### ❌ 401 — Signature không hợp lệ

```json
{
  "statusCode": 401,
  "code": "ACB_INVALID_SIGNATURE",
  "message": "Invalid webhook signature"
}
```

##### ❌ 401 — Timestamp hết hạn

```json
{
  "statusCode": 401,
  "code": "ACB_TIMESTAMP_EXPIRED",
  "message": "Webhook timestamp expired"
}
```

##### ❌ 401 — Signature đã được sử dụng (Replay)

```json
{
  "statusCode": 401,
  "code": "ACB_REPLAY_DETECTED",
  "message": "Webhook signature already used"
}
```

> Mỗi signature chỉ dùng được 1 lần. Nếu cần gửi lại cùng payload, phải tạo timestamp mới và ký lại signature.

##### ❌ 403 — IP không được phép

```json
{
  "statusCode": 403,
  "code": "ACB_IP_FORBIDDEN",
  "message": "IP address not allowed"
}
```

##### ❌ 403 — IP bị block (Brute-force)

```json
{
  "statusCode": 403,
  "code": "ACB_IP_BLOCKED",
  "message": "Too many failed attempts. Try again later."
}
```

> IP bị auto-block 30 phút sau 5 lần auth fail. Không retry — hãy đợi hết thời gian block.

##### ❌ 415 — Content-Type không hợp lệ

```json
{
  "statusCode": 415,
  "code": "ACB_INVALID_CONTENT_TYPE",
  "message": "Content-Type must be application/json"
}
```

##### ❌ 429 — Quá nhiều request

```json
{
  "success": false,
  "message": "Too many webhook requests. Please try again after 1 minute.",
  "code": "ACB_TOO_MANY_REQUESTS"
}
```

---

## Hướng Dẫn Generate Ed25519 Keypair

### Dùng Script Có Sẵn (Node.js)

```bash
node src/scripts/generateEd25519Keys.js
```

Output:

```text
=== ACB WEBHOOK ED25519 KEYPAIR GENERATED ===

🔐 PRIVATE KEY (Provide to ACB Bank / Client for Signing):
-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIFmH1zibkgDF3UKSB88db1kkYCfCZpeZkRjmBheH/8bE
-----END PRIVATE KEY-----

🔓 PUBLIC KEY (Configure in CRM Server .env as ACB_WEBHOOK_PUBLIC_KEY):
-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAaUNy72LCX+ZLQv3PjVTNDDh1Qzih6o3XKxXLyWMF9hU=
-----END PUBLIC KEY-----
```

### Cách Cấu Hình .env

```bash
# Public Key (server dùng để VERIFY) — dùng \n thay xuống dòng
ACB_WEBHOOK_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAaUNy72LCX+ZLQv3PjVTNDDh1Qzih6o3XKxXLyWMF9hU=\n-----END PUBLIC KEY-----"
```

> ⚠️ Private Key **KHÔNG BAO GIỜ** lưu trên CRM Server. Chỉ giao cho ACB/Client qua kênh bảo mật.

---

## Hướng Dẫn Test Bằng Postman

### Yêu Cầu

- **Postman Desktop App** (không phải Postman Web) — cần `require('crypto')` trong Pre-request Script.
- Hoặc dùng **Newman CLI** để chạy qua terminal.

### 1. Import Collection & Environment Files

1. Mở **Postman Desktop**.
2. Chọn **Import** → Kéo thả file Collection: `docs/ACB_Webhook_Postman_Collection.json`.
3. Kéo thả các file Environment tương ứng với 3 môi trường:
   - 🏠 **Local**: `docs/CRM_Local.postman_environment.json`
   - 🧪 **Dev / Staging**: `docs/CRM_Dev.postman_environment.json`
   - 🚀 **Production**: `docs/CRM_Prod.postman_environment.json`

### 2. Cấu Hình 3 Môi Trường (3 Environments)

Chọn môi trường trong dropdown ở góc trên bên phải Postman:

| Môi trường | File Config | `host` / Base URL | `acbApiKey` | `acbEd25519PrivateKey` |
|------------|-------------|-------------------|-------------|------------------------|
| **Local** | `CRM_Local` | `http://localhost:4000` | `acb_webhook_key_change_in_production` | Local Ed25519 Private Key PEM |
| **Dev / Staging** | `CRM_Dev` | `https://crm-server-rvzz.onrender.com` | `acb_webhook_key_change_in_production` | Dev Ed25519 Private Key PEM |
| **Production** | `CRM_Prod` | `https://final.vn` | `<Production API Key>` | `<Production Private Key PEM>` |

> 💡 **Cơ chế ưu tiên:** Pre-request Script trong Collection sẽ ưu tiên lấy `acbApiKey` và `acbEd25519PrivateKey` từ **Environment active** (`pm.environment.get`). Nếu không chọn Environment nào, hệ thống tự động fallback về **Collection Variables** chuẩn Local.

### 3. Cơ Chế Tự Động Ký Ed25519 Trong Postman

Mọi test case đều tích hợp **Pre-request Script** tự động:

```javascript
// Pre-request Script trong Postman (chạy trước mỗi request):
const crypto = require('crypto');

// 1. Tạo body JSON
const bodyObj = { txId: 'ACB' + Date.now(), amount: 5000000 };
const bodyRaw = JSON.stringify(bodyObj);
pm.request.body.update({ mode: 'raw', raw: bodyRaw });

// 2. Lấy Private Key từ Environment (ưu tiên) hoặc Collection Variable (fallback)
const privateKeyPem = pm.environment.get('acbEd25519PrivateKey') || pm.collectionVariables.get('acbEd25519PrivateKey');
const timestamp = Math.floor(Date.now() / 1000).toString();

// 3. Tạo signed payload = "timestamp.rawBody"
const signedPayload = Buffer.concat([
  Buffer.from(timestamp + '.'),
  Buffer.from(bodyRaw)
]);

// 4. Ký Ed25519 → hex string
const signatureHex = crypto.sign(null, signedPayload, privateKeyPem).toString('hex');

// 5. Set headers
pm.request.headers.upsert({ key: 'X-Webhook-Timestamp', value: timestamp });
pm.request.headers.upsert({ key: 'X-Webhook-Signature', value: 'ed25519=' + signatureHex });
```

### 3. Danh Sách Test Cases

#### ✅ Success Cases

| # | Request Name | HTTP Expected | Mô tả |
|---|--------------|---------------|-------|
| 1.1 | Webhook Transaction - Success | `200 OK` | Gửi webhook hợp lệ. Tự động sinh `txId` mới + ký Ed25519. |
| 1.2 | Duplicate TxId | `200 OK (DUPLICATE)` | Gửi trùng `txId` cố định. Nhấn 2 lần: lần 1 tạo mới, lần 2 trả DUPLICATE. |

#### ❌ Security & Error Cases

| # | Request Name | HTTP Expected | Mô tả |
|---|--------------|---------------|-------|
| 2.1 | Invalid Content-Type | `415` | Gửi `Content-Type: text/plain`. |
| 2.2 | Invalid API Key | `401` | API key sai, signature đúng. |
| 2.3 | Invalid Ed25519 Signature | `401` | Gửi 128 hex chars giả (không phải Ed25519 hợp lệ). |
| 2.4 | Expired Timestamp | `401` | Timestamp 10 phút trước (quá hạn 5 phút). Signature đúng. |
| 2.5 | Missing Signature Headers | `401` | Thiếu cả `X-Webhook-Signature` và `X-Webhook-Timestamp`. |
| 2.6 | Replay Attack | `401` | Nhấn Send 2 lần liên tiếp. Lần 2 bị `ACB_REPLAY_DETECTED`. |

#### ❌ Validation Cases

| # | Request Name | HTTP Expected | Mô tả |
|---|--------------|---------------|-------|
| 3.1 | Missing txId | `400` | Body thiếu trường `txId`. |
| 3.2 | Missing amount | `400` | Body thiếu trường `amount`. |

---

## Code Samples

### Node.js (axios + Ed25519)

```javascript
const crypto = require('crypto');
const axios = require('axios');

const API_BASE = 'https://crm-server-rvzz.onrender.com/api/v1/webhooks/acb';
const API_KEY = 'your_api_key';

// Ed25519 Private Key (PKCS8 PEM) — do ACB giữ bí mật
const PRIVATE_KEY_PEM = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIFmH1zibkgDF3UKSB88db1kkYCfCZpeZkRjmBheH/8bE
-----END PRIVATE KEY-----`;

async function sendTransaction(transaction) {
  const bodyRaw = JSON.stringify(transaction);
  const timestamp = Math.floor(Date.now() / 1000);

  // Tạo signed payload: "<timestamp>.<rawBody>"
  const signedPayload = Buffer.concat([
    Buffer.from(`${timestamp}.`),
    Buffer.from(bodyRaw),
  ]);

  // Ký Ed25519
  const signatureHex = crypto.sign(null, signedPayload, PRIVATE_KEY_PEM).toString('hex');

  try {
    const response = await axios.post(
      `${API_BASE}/transaction`,
      bodyRaw, // Gửi raw string, KHÔNG phải object
      {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
          'X-Webhook-Signature': `ed25519=${signatureHex}`,
          'X-Webhook-Timestamp': String(timestamp),
        },
        timeout: 10000,
      },
    );

    console.log('✅ Transaction sent:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    throw error;
  }
}

// Usage
sendTransaction({
  txId: 'ACB20260727001234',
  amount: 5000000,
  sender: 'NGUYEN VAN A',
  content: 'Thanh toan don hang DH001',
  transactionDate: new Date().toISOString(),
});
```

### Python (Ed25519)

```python
import json
import time
import requests
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import (
    load_pem_private_key,
    Encoding,
    PrivateFormat,
    NoEncryption,
)

API_BASE = "https://crm-server-rvzz.onrender.com/api/v1/webhooks/acb"
API_KEY = "your_api_key"

# Ed25519 Private Key (PKCS8 PEM) — do ACB giữ bí mật
PRIVATE_KEY_PEM = b"""-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIFmH1zibkgDF3UKSB88db1kkYCfCZpeZkRjmBheH/8bE
-----END PRIVATE KEY-----"""

private_key = load_pem_private_key(PRIVATE_KEY_PEM, password=None)

def send_transaction(transaction: dict) -> dict:
    # 1. Serialize body (compact, no spaces)
    body_raw = json.dumps(transaction, separators=(",", ":"))
    timestamp = str(int(time.time()))

    # 2. Tạo signed payload: "<timestamp>.<rawBody>"
    signed_payload = f"{timestamp}.{body_raw}".encode("utf-8")

    # 3. Ký Ed25519
    signature_bytes = private_key.sign(signed_payload)
    signature_hex = signature_bytes.hex()

    # 4. Gửi request
    response = requests.post(
        f"{API_BASE}/transaction",
        data=body_raw,  # Gửi raw string, KHÔNG phải json=transaction
        headers={
            "Content-Type": "application/json",
            "X-API-Key": API_KEY,
            "X-Webhook-Signature": f"ed25519={signature_hex}",
            "X-Webhook-Timestamp": timestamp,
        },
        timeout=10,
    )

    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
    return response.json()


# Usage
send_transaction({
    "txId": "ACB20260727001234",
    "amount": 5000000,
    "sender": "NGUYEN VAN A",
    "content": "Thanh toan don hang DH001",
    "transactionDate": "2026-07-27T10:30:00.000Z",
})
```

### cURL (Dùng openssl cho Ed25519)

```bash
#!/bin/bash

# ─── Variables ───
API_KEY="acb_webhook_key_change_in_production"
BASE_URL="http://localhost:4000/api/v1/webhooks/acb"

# Private Key file (lưu PEM vào file)
PRIVATE_KEY_FILE="/tmp/acb_ed25519_private.pem"
cat > "$PRIVATE_KEY_FILE" << 'EOF'
-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIFmH1zibkgDF3UKSB88db1kkYCfCZpeZkRjmBheH/8bE
-----END PRIVATE KEY-----
EOF

# ─── Build JSON body ───
TX_ID="ACB$(date +%s)$(shuf -i 10000-99999 -n 1)"
BODY="{\"txId\":\"${TX_ID}\",\"amount\":5000000,\"sender\":\"NGUYEN VAN A\",\"content\":\"Thanh toan test\"}"
TIMESTAMP=$(date +%s)

# ─── Sign payload with Ed25519 ───
SIGNED_PAYLOAD="${TIMESTAMP}.${BODY}"
SIGNATURE=$(printf '%s' "$SIGNED_PAYLOAD" | openssl pkeyutl -sign -inkey "$PRIVATE_KEY_FILE" | xxd -p -c 256)

# ─── Send request ───
echo "📤 Sending transaction: ${TX_ID}"
curl -s -w "\nHTTP Status: %{http_code}\n" \
  -X POST "${BASE_URL}/transaction" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -H "X-Webhook-Signature: ed25519=${SIGNATURE}" \
  -H "X-Webhook-Timestamp: ${TIMESTAMP}" \
  -d "${BODY}"

# Cleanup
rm -f "$PRIVATE_KEY_FILE"
```

> ⚠️ **Lưu ý cURL:** `openssl pkeyutl -sign` yêu cầu OpenSSL ≥ 1.1.1 với hỗ trợ Ed25519. macOS mặc định có thể dùng LibreSSL — cần cài OpenSSL qua Homebrew: `brew install openssl`.

---

## Khuyến Nghị Tích Hợp

1. **Luôn gửi đủ 4 headers**: `Content-Type`, `X-API-Key`, `X-Webhook-Signature`, `X-Webhook-Timestamp`
2. **Ký signature từ raw body bytes** — không format lại JSON sau khi stringify
3. **Mỗi request phải có timestamp MỚI** — signature cũ không thể tái sử dụng (replay protection)
4. **Set timeout ≤ 10 giây** cho mỗi request
5. **Retry tối đa 3 lần** với backoff (1s → 2s → 4s) khi gặp lỗi mạng hoặc HTTP 5xx
6. **Không retry** khi gặp HTTP 400, 401, 403, 415 — đây là lỗi logic
7. **Đặc biệt không retry khi gặp 403 `ACB_IP_BLOCKED`** — IP đang bị block, retry sẽ chỉ kéo dài thời gian block
8. **Đảm bảo `txId` duy nhất** cho mỗi giao dịch — trùng txId sẽ nhận response DUPLICATE
9. **Lưu log** mọi response từ API để đối chiếu khi cần
10. **Private Key phải được bảo mật tuyệt đối** — không commit vào git, không log, không share qua email/chat

---

## Error Codes — Tổng Hợp

| HTTP | Code | Nguyên nhân | Nên retry? |
|------|------|-------------|------------|
| 200 | — | Thành công | — |
| 200 | `DUPLICATE` | txId đã tồn tại (idempotent) | ❌ Giao dịch đã nhận |
| 400 | `BAD_REQUEST` | Payload thiếu/sai field | ❌ Sửa payload |
| 401 | `ACB_INVALID_API_KEY` | API key sai hoặc thiếu | ❌ Kiểm tra key |
| 401 | `ACB_MISSING_SIGNATURE` | Thiếu header signature/timestamp | ❌ Sửa code |
| 401 | `ACB_INVALID_SIGNATURE` | Ed25519 signature không hợp lệ | ❌ Kiểm tra private key |
| 401 | `ACB_TIMESTAMP_EXPIRED` | Timestamp cách > 5 phút | ❌ Đồng bộ clock |
| 401 | `ACB_REPLAY_DETECTED` | Signature đã dùng rồi | ❌ Tạo timestamp mới |
| 403 | `ACB_IP_FORBIDDEN` | IP không trong whitelist | ❌ Liên hệ admin |
| 403 | `ACB_IP_BLOCKED` | IP bị auto-block (brute-force) | ❌ Đợi 30 phút |
| 415 | `ACB_INVALID_CONTENT_TYPE` | Content-Type không phải JSON | ❌ Sửa header |
| 429 | `ACB_TOO_MANY_REQUESTS` | Vượt 300 req/min | ✅ Đợi 1 phút |
| 500 | `ACB_INTERNAL_ERROR` | Lỗi server CRM | ✅ Retry với backoff |

---

## Liên Hệ Hỗ Trợ

- Nhận API key qua kênh bảo mật
- Tạo Ed25519 keypair bằng script: `node src/scripts/generateEd25519Keys.js`
- Giao Private Key cho ACB qua kênh bảo mật (encrypted email, vault, ...)
- Cấu hình Public Key trong `.env` của CRM Server
- Cung cấp IP tĩnh của server ACB (nếu có) để được thêm vào whitelist
- Liên hệ admin CRM khi gặp lỗi không xác định
