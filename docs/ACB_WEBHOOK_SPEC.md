# ACB Bank Webhook — Tài Liệu Tích Hợp (Integration Spec)

> **Version:** 3.0 (SHA256 Checksum)
> **Prod Base URL:** `https://final.vn/api/v1/webhooks/acb`
> **Dev Base URL:** `https://crm-server-rvzz.onrender.com/api/v1/webhooks/acb`
> **Content-Type:** `application/json`

---

## Tổng Quan

API webhook cho ACB gửi thông báo biến động giao dịch (Credit / Debit) sang CRM Server (VIK). ACB gọi endpoint này mỗi khi có giao dịch mới phát sinh trên tài khoản đã đăng ký.

### Luồng Tích Hợp

```text
┌──────────────┐     ┌──────────────┐
│ ACB Server   │     │ VIK Server   │
│ (Bank)       │     │ (Webhook)    │
└──────┬───────┘     └──────┬───────┘
       │                    │
       │  1. POST           │
       │  /transaction      │
       │  Headers:          │
       │    X-API-Key       │
       │    signature       │
       │  Body:             │
       │    { masterMeta,   │
       │      requests[] }  │
       │───────────────────>│
       │                    │  2. Verify:
       │                    │     - Content-Type
       │                    │     - IP Allowlist (CIDR)
       │                    │     - Brute-force check
       │                    │     - API Key (timing-safe)
       │                    │     - SHA256 Checksum
       │                    │     - clientRequestId dedup
       │                    │
       │  3. Response       │
       │  200 OK            │
       │  { timestamp,      │
       │    responseCode,   │
       │    message,        │
       │    responseBody }  │
       │<───────────────────│
       │                    │
```

### Security Pipeline (Thứ Tự Xác Thực)

```text
Request → enforceJsonContentType  (415)
        → checkAcbIpAllowlist     (403) — CIDR support
        → checkAcbBruteForce      (403)
        → verifyAcbApiKey         (401) — X-API-Key
        → verifyAcbChecksum       (401) — SHA256(body + secretKey + bankKey)
        → checkAcbRequestIdDedup  (200) — idempotent dedup
        → Controller/Service
```

Mỗi layer reject sẽ dừng pipeline ngay — request không qua được layer nào thì không chạy layer sau.

---

## Thông Tin Cần Chuẩn Bị

### VIK Cung Cấp Cho ACB

| # | Thông tin | Giá trị | Ghi chú |
|---|-----------|---------|---------|
| 1 | **Callback URL** | `https://final.vn/api/v1/webhooks/acb/transaction` | Endpoint nhận thông báo giao dịch |
| 2 | **IP tĩnh** | *(VIK cung cấp IP tĩnh của server)* | ACB cần để cấu hình |
| 3 | **Phương thức xác thực** | **API Key** | |
| 4 | **Tên Header API Key** | `X-API-Key` | |
| 5 | **Giá trị API Key** | *(Sinh production key)* | Chia sẻ qua kênh bảo mật |
| 6 | **Secret Key** | *(Sinh bằng script)* | VIK tạo & cung cấp cho ACB (ACB gọi là `secret_key`) |
| 7 | **Thuật toán Checksum** | `SHA256` | |

### ACB Cung Cấp Cho VIK

| # | Thông tin | Ghi chú |
|---|-----------|---------|
| 1 | **Bank Key** | ACB tạo & cung cấp cho VIK (ACB gọi là `server_key`) |
| 2 | **Danh sách IP callback** | Đã nhận — 14 IP/CIDR ranges |

### Sinh Keys

```bash
# Sinh API Key + Secret Key cho ACB
node src/scripts/generateAcbWebhookKeys.js
```

---

## Authentication

### 1. API Key

Mọi request từ ACB phải gửi kèm header `X-API-Key`:

```
X-API-Key: <api_key_do_VIK_cấp>
```

Server so sánh API key bằng **timing-safe comparison** (`crypto.timingSafeEqual`) để ngăn timing attack.

### 2. SHA256 Checksum

ACB gửi checksum trong header `signature` để đảm bảo tính toàn vẹn dữ liệu.

#### Cấu hình Checksum

```json
{
  "encrypt_config": {
    "secret_key": "<Secret Key — VIK tạo & cung cấp cho ACB>",
    "server_key": "<Bank Key — ACB tạo & cung cấp cho VIK>",
    "header_key": "signature",
    "algorithm": "SHA256"
  }
}
```

#### Cách Tính Checksum

```text
Bước 1: Lấy raw JSON body (nguyên bytes, chưa parse, chưa format lại)
        → Ví dụ: {"masterMeta":{"clientId":"abc","clientRequestId":"123","checksum":"xxx"},...}

Bước 2: Nối chuỗi: RequestBody + SecretKey + BankKey
        → data = rawBody + "acb_secret_key_xxx" + "acb_bank_key_yyy"

Bước 3: Hash bằng SHA256
        → checksum = SHA256(data).toLowerCase()

Bước 4: Gửi trong header:
        → signature: <checksum_value>
```

#### Ví Dụ Tính Checksum (Node.js)

```javascript
const crypto = require('crypto');

const rawBody = '{"masterMeta":{"clientId":"abc","clientRequestId":"123","checksum":"xxx"},...}';
const secretKey = 'acb_secret_key_xxx'; // VIK tạo & cung cấp cho ACB
const bankKey = 'acb_bank_key_yyy'; // ACB tạo & cung cấp cho VIK

const checksum = crypto
  .createHash('sha256')
  .update(rawBody + secretKey + bankKey)
  .digest('hex');

console.log(checksum);
// → "a1b2c3d4e5f6..." (64 ký tự hex)
```

### 3. Content-Type (Bắt Buộc)

```
Content-Type: application/json
```

### 4. IP Allowlist

VIK đã cấu hình whitelist các IP/CIDR sau từ ACB:

```
123.30.82.230/32, 123.30.83.216/29, 123.30.82.230/30,
118.69.221.86/32, 118.69.223.64/27, 118.69.221.86/30,
182.237.20.246/32, 182.237.22.176/28, 103.136.114.154/30,
14.238.112.16/29, 120.72.112.202/30, 171.224.107.24/29,
202.59.252.168, 202.59.252.169
```

---

## Rate Limiting & Brute-force Protection

### Rate Limiting

| Thông số | Giá trị |
|----------|---------|
| Window | 1 phút |
| Max requests | 300 request/min/IP |
| Headers trả về | `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` |

### Brute-force Auto-block

| Thông số | Giá trị |
|----------|---------|
| Ngưỡng | 5 lần auth fail (sai API key hoặc checksum) |
| Trong | 10 phút |
| Hậu quả | IP bị block **30 phút**, mọi request trả 403 |

---

## Endpoint

### `POST /transaction` — Gửi Thông Báo Giao Dịch

#### Request

```http
POST /api/v1/webhooks/acb/transaction
Content-Type: application/json
X-API-Key: <api_key_do_VIK_cấp>
signature: <checksum_SHA256>
```

#### Request Body — Credit (Ghi Có)

```json
{
    "masterMeta": {
        "clientId": "e1c935ed-2476-45d2-a2e3-e54254055f35",
        "clientRequestId": "83104a68-9ad7-46fa-be2f-6f93159202ea",
        "checksum": "bae69aa2de0238f2521f041f23445913"
    },
    "requests": [
        {
            "requestMeta": {
                "requestType": "NOTIFICATION",
                "requestCode": "TRANSACTION_UPDATE"
            },
            "requestParams": {
                "transactions": [
                    {
                        "transactionStatus": "COMPLETED",
                        "transactionChannel": "MAPP",
                        "transactionCode": 4056,
                        "accountNumber": 3309219,
                        "transactionDate": "2025-11-26T11:27:45.000Z",
                        "effectiveDate": "2025-11-27T00:00:00.000Z",
                        "debitOrCredit": "credit",
                        "virtualAccountInfo": null,
                        "amount": 500000000,
                        "transactionEntityAttribute": {
                            "issuerBankName": "ACB - NH TMCP A CHAU",
                            "receiverBankName": "ACB - NH TMCP A CHAU",
                            "remitterName": "QUOC 272933 NGUYEN HAI",
                            "remitterAccountNumber": "9267919"
                        },
                        "transactionContent": "Nạp tiền"
                    }
                ],
                "pagination": {
                    "page": 1,
                    "pageSize": 1,
                    "totalPage": 1
                }
            }
        }
    ]
}
```

#### Request Body — Debit (Ghi Nợ)

```json
{
    "masterMeta": {
        "clientId": "e1c935ed-2476-45d2-a2e3-e54254055f35",
        "clientRequestId": "e0377f18-c223-4541-853f-71c1a7acabc5",
        "checksum": "9ff53a8961e5c7e33f40b897628a651c"
    },
    "requests": [
        {
            "requestMeta": {
                "requestType": "NOTIFICATION",
                "requestCode": "TRANSACTION_UPDATE"
            },
            "requestParams": {
                "transactions": [
                    {
                        "transactionStatus": "COMPLETED",
                        "transactionChannel": "MAPP",
                        "transactionCode": 4064,
                        "accountNumber": 3309219,
                        "transactionDate": "2025-11-26T11:33:52.000Z",
                        "effectiveDate": "2025-11-27T00:00:00.000Z",
                        "debitOrCredit": "debit",
                        "virtualAccountInfo": null,
                        "amount": 10000,
                        "transactionEntityAttribute": {
                            "issuerBankName": "ACB - NH TMCP A CHAU",
                            "receiverBankName": "ACB - NH TMCP A CHAU",
                            "remitterName": "ADAM 10045",
                            "remitterAccountNumber": "3309219"
                        },
                        "transactionContent": "Rút tiền"
                    }
                ],
                "pagination": {
                    "page": 1,
                    "pageSize": 1,
                    "totalPage": 1
                }
            }
        }
    ]
}
```

#### Mô Tả Các Trường

##### `masterMeta`

| Trường | Type | Required | Mô tả | Example / Pattern |
|--------|------|----------|-------|-------------------|
| `clientId` | string | ✅ | Mã định danh khách hàng do ACB cấp | `ec0553c7-a9ca-40a9-82d3-b5d7011fdd16` |
| `clientRequestId` | string | ✅ | Mã định danh duy nhất cho mỗi request do ACB tạo ra | `a01a68ab-39c7-425c-99eb-2763ccfa1dd9` |
| `checksum` | string | ✅ | Mã hash kiểm tra tính chính xác của giao dịch | `e0ee0e988c7c6911eb57c6c9190ca540` |

##### `requests[].requestMeta`

| Trường | Type | Required | Giá trị cho phép | Mô tả |
|--------|------|----------|-------------------|-------|
| `requestType` | string | ✅ | `NOTIFICATION` | Loại dịch vụ yêu cầu |
| `requestCode` | string | ✅ | `TRANSACTION_UPDATE`, `TRANSACTION_HISTORY` | `TRANSACTION_UPDATE`: thông báo nợ/có tức thì<br>`TRANSACTION_HISTORY`: thông báo nợ/có cuối ngày |

##### `requests[].requestParams.transactions[]`

| Trường | Type | Required | Giá trị / Chi tiết | Mô tả |
|--------|------|----------|---------------------|-------|
| `transactionStatus` | string | ✅ | `COMPLETED`, `ERRORCORRECTED` | `COMPLETED`: giao dịch thành công<br>`ERRORCORRECTED`: giao dịch bị hủy |
| `transactionChannel` | string | ✅ | `MAPP`, `IBFT`, `ATM`, `API`, ... | Kênh thực hiện giao dịch (BAT, VRU, WWW, ATM, ONLI, ACH, FSC, CCM, API, MG, SECU, MAPP, SMS, ACHS, CCAT, AAP, IBFT, CLMS, REMI, TB, SOBA, BIZ) |
| `transactionCode` | string/number | ✅ | e.g. `56327`, `4056` | Mã giao dịch do ACB tạo ra khi hoàn tất |
| `accountNumber` | number/string | ✅ | e.g. `887988`, `3309219` | Số tài khoản nhận thông báo ghi có/nợ |
| `transactionDate` | string (ISO) | ✅ | e.g. `2025-11-26T11:27:45.000Z` | Thời gian thực hiện giao dịch |
| `effectiveDate` | string (ISO) | ✅ | e.g. `2025-11-27T00:00:00.000Z` | Thời gian hiệu lực giao dịch |
| `debitOrCredit` | string | ✅ | `credit`, `debit` | `credit`: báo có (tiền vào)<br>`debit`: báo nợ (tiền ra) |
| `virtualAccountInfo` | object | ❌ | `{ vaPrefixCd, vaNbr }` | Thông tin tài khoản ảo (khi nộp vào TK ảo) |
| `virtualAccount` | string | ❌ | e.g. `HU1` | Tài khoản ảo |
| `referenceNumber` | string | ❌ | e.g. `1234567890` | Mã tham chiếu do hệ thống KH tạo ra |
| `partnerCustomerCode` | string | ❌ | e.g. `236789876` | Mã định danh người dùng hệ thống KH |
| `partnerCustomerName` | string | ❌ | e.g. `HA BAC NINH` | Tên người dùng hệ thống KH |
| `partnerCustomerType` | string | ❌ | e.g. `ORG` | Phân loại KH (KHCN, KHDN,...) |
| `amount` | number | ✅ | ≥ 0 | Số tiền giao dịch |
| `transactionEntityAttribute` | object | ❌ | Xem chi tiết bên dưới | Thông tin thuộc tính khác của giao dịch |
| `transactionContent` | string | ✅ | e.g. `Nạp tiền` | Nội dung chuyển khoản/giao dịch |
| `custom1` .. `custom10` | string | ❌ | Thông tin mở rộng | Các trường dữ liệu mở rộng tùy chọn |

##### `virtualAccountInfo`

| Trường | Type | Mô tả |
|--------|------|-------|
| `vaPrefixCd` | string | Đầu số tài khoản ảo (ví dụ: `HU1`) |
| `vaNbr` | string | Số tài khoản ảo do ACB cấp cho khách hàng |

##### `transactionEntityAttribute`

| Trường | Type | Mô tả |
|--------|------|-------|
| `traceNumber` | string | Mã giao dịch |
| `beneficiaryName` | string | Tên khách hàng thụ hưởng |
| `beneficiaryAccountNumber` | string | Số tài khoản khách hàng thụ hưởng |
| `receiverBankName` | string | Tên ngân hàng thụ hưởng (ví dụ: `ACB`) |
| `remitterName` | string | Tên khách hàng chuyển tiền |
| `remitterAccountNumber` | string | Số tài khoản khách hàng chuyển tiền |
| `issuerBankName` | string | Tên ngân hàng chuyển tiền (ví dụ: `ACB`) |

##### `requests[].requestParams.pagination`

| Trường | Type | Required | Điều kiện | Mô tả |
|--------|------|----------|-----------|-------|
| `page` | number | ✅ | ≥ 1 | Số trang hiện tại |
| `pageSize` | number | ✅ | 1 .. 1000 | Số dòng dữ liệu trong 1 trang |
| `totalPage` | number | ✅ | ≥ 1 | Tổng số trang |

---

### Responses

#### ✅ 200 — Tiếp nhận thành công

```json
{
  "timestamp": "2025-11-26T18:33:52.556595123",
  "responseCode": "00000000",
  "message": "Success",
  "responseBody": {
    "referenceCode": "83104a68-9ad7-46fa-be2f-6f93159202ea",
    "index": 1
  }
}
```

| Trường | Type | Mô tả |
|--------|------|-------|
| `timestamp` | string (ISO) | Thời điểm VIK xử lý |
| `responseCode` | string | `00000000` = thành công |
| `message` | string | `Success` |
| `responseBody.referenceCode` | string | `clientRequestId` từ ACB |
| `responseBody.index` | number | Số giao dịch đã xử lý |

#### ❌ 400 — Lỗi Validation

```json
{
  "timestamp": "2025-11-26T18:33:52.556595123",
  "responseCode": "99999999",
  "message": "masterMeta.clientRequestId là bắt buộc",
  "responseBody": null
}
```

#### ❌ 401 — API Key không hợp lệ

```json
{
  "statusCode": 401,
  "code": "ACB_INVALID_API_KEY",
  "message": "Invalid or missing X-API-Key"
}
```

#### ❌ 401 — Checksum không hợp lệ

```json
{
  "statusCode": 401,
  "code": "ACB_INVALID_CHECKSUM",
  "message": "Invalid checksum signature"
}
```

#### ❌ 401 — Thiếu Checksum header

```json
{
  "statusCode": 401,
  "code": "ACB_MISSING_CHECKSUM",
  "message": "Missing checksum signature"
}
```

#### ❌ 403 — IP không được phép

```json
{
  "statusCode": 403,
  "code": "ACB_IP_FORBIDDEN",
  "message": "IP address not allowed"
}
```

#### ❌ 403 — IP bị block (Brute-force)

```json
{
  "statusCode": 403,
  "code": "ACB_IP_BLOCKED",
  "message": "Too many failed attempts. Try again later."
}
```

#### ❌ 415 — Content-Type không hợp lệ

```json
{
  "statusCode": 415,
  "code": "ACB_INVALID_CONTENT_TYPE",
  "message": "Content-Type must be application/json"
}
```

#### ❌ 429 — Quá nhiều request

```json
{
  "success": false,
  "message": "Too many webhook requests. Please try again after 1 minute.",
  "code": "ACB_TOO_MANY_REQUESTS"
}
```

---

## Retry & Timeout

### ACB Retry Policy

- ACB retry tối đa **3 lần** khi VIK không phản hồi hoặc trả lỗi.
- Nếu sau 3 lần vẫn thất bại, VIK sử dụng API tra cứu lịch sử giao dịch để đối soát.

### Timeout

- VIK endpoint phải phản hồi trong **17 giây**.
- Sau 17 giây, ACB coi là timeout và thực hiện retry.

### ACB Xác Nhận Thành Công Khi

- HTTP Status Code = **200 OK**
- Response body đúng format: `{ timestamp, responseCode: "00000000", message: "Success", responseBody: { referenceCode, index } }`

---

## Cấu Hình .env

```bash
# ─── ACB Bank Webhook (SHA256 Checksum) ─────────────────────────────────────

# API Key xác thực (VIK cung cấp cho ACB, truyền qua header X-API-Key)
ACB_WEBHOOK_API_KEY=<production_api_key>

# Secret Key — VIK tạo & cung cấp cho ACB (ACB gọi là "secret_key")
ACB_WEBHOOK_SECRET_KEY=<production_secret_key>

# Bank Key — ACB tạo & cung cấp cho VIK (ACB gọi là "server_key")
ACB_WEBHOOK_BANK_KEY=<giá_trị_ACB_cung_cấp>

# Tên header chứa checksum (mặc định: signature)
ACB_WEBHOOK_CHECKSUM_HEADER=signature

# Thuật toán băm (mặc định: SHA256)
ACB_WEBHOOK_CHECKSUM_ALGORITHM=SHA256

# IP allowlist (CIDR support, phân cách bằng dấu phẩy)
ACB_WEBHOOK_ALLOWED_IPS=123.30.82.230/32,123.30.83.216/29,123.30.82.230/30,118.69.221.86/32,118.69.223.64/27,118.69.221.86/30,182.237.20.246/32,182.237.22.176/28,103.136.114.154/30,14.238.112.16/29,120.72.112.202/30,171.224.107.24/29,202.59.252.168,202.59.252.169
```

---

## Code Sample — cURL Test

```bash
#!/bin/bash

# ─── Variables ───
API_KEY="<api_key_do_VIK_cấp>"
SECRET_KEY="<secret_key_do_VIK_cấp>"
BANK_KEY="<bank_key_do_ACB_cấp>"
BASE_URL="https://final.vn/api/v1/webhooks/acb"

# ─── Build JSON body ───
CLIENT_REQUEST_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
BODY="{\"masterMeta\":{\"clientId\":\"e1c935ed-2476-45d2-a2e3-e54254055f35\",\"clientRequestId\":\"${CLIENT_REQUEST_ID}\",\"checksum\":\"test\"},\"requests\":[{\"requestMeta\":{\"requestType\":\"NOTIFICATION\",\"requestCode\":\"TRANSACTION_UPDATE\"},\"requestParams\":{\"transactions\":[{\"transactionStatus\":\"COMPLETED\",\"transactionChannel\":\"MAPP\",\"transactionCode\":4056,\"accountNumber\":3309219,\"transactionDate\":\"2025-11-26T11:27:45.000Z\",\"effectiveDate\":\"2025-11-27T00:00:00.000Z\",\"debitOrCredit\":\"credit\",\"virtualAccountInfo\":null,\"amount\":500000000,\"transactionEntityAttribute\":{\"issuerBankName\":\"ACB\",\"receiverBankName\":\"ACB\",\"remitterName\":\"NGUYEN VAN A\",\"remitterAccountNumber\":\"9267919\"},\"transactionContent\":\"Nap tien\"}],\"pagination\":{\"page\":1,\"pageSize\":1,\"totalPage\":1}}}]}"

# ─── Compute SHA256 checksum ───
CHECKSUM=$(printf '%s' "${BODY}${SECRET_KEY}${BANK_KEY}" | shasum -a 256 | awk '{print $1}')

# ─── Send request ───
echo "📤 Sending ACB webhook..."
echo "   clientRequestId: ${CLIENT_REQUEST_ID}"
echo "   checksum: ${CHECKSUM}"

curl -s -w "\nHTTP Status: %{http_code}\n" \
  -X POST "${BASE_URL}/transaction" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -H "signature: ${CHECKSUM}" \
  -d "${BODY}"
```

---

## Code Sample — Node.js

```javascript
const crypto = require('crypto');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const API_BASE = 'https://final.vn/api/v1/webhooks/acb';
const API_KEY = '<api_key_do_VIK_cấp>';
const SECRET_KEY = '<secret_key_do_VIK_cấp>'; // VIK tạo & cung cấp cho ACB
const BANK_KEY = '<bank_key_do_ACB_cấp>'; // ACB tạo & cung cấp cho VIK

async function sendTransaction() {
  const body = {
    masterMeta: {
      clientId: 'e1c935ed-2476-45d2-a2e3-e54254055f35',
      clientRequestId: uuidv4(),
      checksum: 'will-be-computed',
    },
    requests: [{
      requestMeta: {
        requestType: 'NOTIFICATION',
        requestCode: 'TRANSACTION_UPDATE',
      },
      requestParams: {
        transactions: [{
          transactionStatus: 'COMPLETED',
          transactionChannel: 'MAPP',
          transactionCode: 4056,
          accountNumber: 3309219,
          transactionDate: new Date().toISOString(),
          effectiveDate: new Date().toISOString(),
          debitOrCredit: 'credit',
          virtualAccountInfo: null,
          amount: 500000000,
          transactionEntityAttribute: {
            issuerBankName: 'ACB - NH TMCP A CHAU',
            receiverBankName: 'ACB - NH TMCP A CHAU',
            remitterName: 'NGUYEN VAN A',
            remitterAccountNumber: '9267919',
          },
          transactionContent: 'Nap tien',
        }],
        pagination: { page: 1, pageSize: 1, totalPage: 1 },
      },
    }],
  };

  const bodyRaw = JSON.stringify(body);

  // Compute SHA256 checksum
  const checksum = crypto
    .createHash('sha256')
    .update(bodyRaw + SECRET_KEY + BANK_KEY)
    .digest('hex');

  try {
    const response = await axios.post(
      `${API_BASE}/transaction`,
      bodyRaw,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
          'signature': checksum,
        },
        timeout: 17000, // ACB timeout: 17 giây
      },
    );

    console.log('✅ Response:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    throw error;
  }
}

sendTransaction();
```

---

## Error Codes — Tổng Hợp

| HTTP | Code | Nguyên nhân | ACB nên retry? |
|------|------|-------------|----------------|
| 200 | `00000000` | Thành công | — |
| 200 | `00000000` | Duplicate clientRequestId (idempotent) | ❌ Đã nhận |
| 400 | `99999999` | Payload thiếu/sai field | ❌ Sửa payload |
| 401 | `ACB_INVALID_API_KEY` | API key sai hoặc thiếu | ❌ Kiểm tra key |
| 401 | `ACB_MISSING_CHECKSUM` | Thiếu header signature | ❌ Sửa code |
| 401 | `ACB_INVALID_CHECKSUM` | Checksum không khớp | ❌ Kiểm tra keys |
| 403 | `ACB_IP_FORBIDDEN` | IP không trong whitelist | ❌ Liên hệ VIK |
| 403 | `ACB_IP_BLOCKED` | IP bị auto-block (brute-force) | ❌ Đợi 30 phút |
| 415 | `ACB_INVALID_CONTENT_TYPE` | Content-Type không phải JSON | ❌ Sửa header |
| 429 | `ACB_TOO_MANY_REQUESTS` | Vượt 300 req/min | ✅ Đợi 1 phút |
| 500 | `ACB_INTERNAL_ERROR` | Lỗi server VIK | ✅ Retry (max 3 lần) |

---

## Quy Trình Kiểm Thử Tích Hợp

1. **VIK cung cấp** cho ACB:
   - Callback URL: `https://final.vn/api/v1/webhooks/acb/transaction`
   - IP tĩnh server VIK
   - API Key (header `X-API-Key`)
   - Secret Key cho checksum (ACB gọi là `secret_key`)
   - Thuật toán checksum: SHA256

2. **ACB cung cấp** cho VIK:
   - Bank Key cho checksum (ACB gọi là `server_key`)
   - Danh sách IP callback ✅ (đã nhận)

3. **ACB cấu hình** endpoint + policy trên môi trường kiểm thử

4. **ACB tạo giao dịch** kiểm thử → gửi webhook đến Callback URL

5. **VIK kiểm tra** tiếp nhận và xử lý giao dịch

6. **Đối soát** kết quả hai bên

> Nếu webhook không nhận thành công, VIK có thể sử dụng API tra cứu lịch sử giao dịch của ACB để đối soát.

---

## Liên Hệ Hỗ Trợ

- Sinh API Key + Client Key: `node src/scripts/generateAcbWebhookKeys.js`
- Chia sẻ keys qua kênh bảo mật (không qua email/chat)
- Cung cấp IP tĩnh server VIK cho ACB
- Liên hệ admin VIK khi gặp lỗi không xác định
