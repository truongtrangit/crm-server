# ACB Bank Webhook — Tài Liệu Tích Hợp (Integration Specification)

> **Version:** 3.1
> **Cập nhật:** 2026-07-28
> **Prod Callback URL:** `https://final.vn/api/v1/webhooks/acb/transaction`
> **Dev Callback URL:** `https://crm-server-rvzz.onrender.com/api/v1/webhooks/acb/transaction`
> **HTTP Method:** `POST`
> **Content-Type:** `application/json`

---

## 1. Tổng Quan

API webhook cho ACB gửi thông báo biến động giao dịch (Credit / Debit) sang VIK Server. ACB gọi endpoint này mỗi khi có giao dịch mới phát sinh trên tài khoản đã đăng ký nhận thông báo.

### 1.1. Sơ Đồ Luồng Tích Hợp

```
┌──────────────────┐                              ┌──────────────────┐
│    ACB Server    │                              │   VIK Server     │
│    (Ngân hàng)   │                              │   (Webhook)      │
└────────┬─────────┘                              └────────┬─────────┘
         │                                                 │
         │  ① Có giao dịch mới phát sinh                   │
         │                                                 │
         │  ② POST /api/v1/webhooks/acb/transaction        │
         │     Headers:                                    │
         │       Content-Type: application/json            │
         │       X-API-Key: <api_key>                      │
         │       signature: <sha256_checksum>              │
         │     Body:                                       │
         │       { masterMeta, requests[] }                │
         │────────────────────────────────────────────────►│
         │                                                 │
         │                                                 │  ③ Xác thực (8 layers):
         │                                                 │     1. Content-Type check
         │                                                 │     2. IP Allowlist (CIDR)
         │                                                 │     3. Brute-force check
         │                                                 │     4. API Key (timing-safe)
         │                                                 │     5. SHA256 Checksum
         │                                                 │     6. clientRequestId dedup
         │                                                 │     7. Rate Limit (300/min)
         │                                                 │     8. Audit log
         │                                                 │
         │                                                 │  ④ Validate payload → Lưu DB
         │                                                 │
         │  ⑤ Response 200 OK                              │
         │  {                                              │
         │    "timestamp": "...",                           │
         │    "responseCode": "00000000",                   │
         │    "message": "Success",                         │
         │    "responseBody": {                             │
         │      "referenceCode": "<clientRequestId>",       │
         │      "index": <số_giao_dịch>                     │
         │    }                                             │
         │  }                                              │
         │◄────────────────────────────────────────────────│
         │                                                 │
```

### 1.2. ACB Xác Nhận Callback Thành Công Khi

| Điều kiện | Giá trị |
|-----------|---------|
| HTTP Status Code | `200` |
| `responseCode` | `"00000000"` |

Nếu **một trong hai** điều kiện không thỏa mãn → ACB coi là lỗi và thực hiện retry.

---

## 2. Thông Tin Trao Đổi Giữa Hai Bên

### 2.1. VIK Cung Cấp Cho ACB

| # | Thông tin | Header / Config | Giá trị mẫu | Ghi chú |
|---|-----------|-----------------|-------------|---------|
| 1 | Callback URL | — | `https://final.vn/api/v1/webhooks/acb/transaction` | Endpoint nhận thông báo giao dịch |
| 2 | IP tĩnh server | — | *(VIK cung cấp)* | Để ACB cấu hình |
| 3 | API Key | `X-API-Key` | *(Sinh bằng script, chia sẻ qua kênh bảo mật)* | Xác thực request |
| 4 | Secret Key | encrypt_config.`secret_key` | *(Sinh bằng script)* | Dùng để tính checksum. ACB gọi là `secret_key` |
| 5 | Thuật toán Checksum | encrypt_config.`algorithm` | `SHA256` | |
| 6 | Tên header checksum | encrypt_config.`header_key` | `signature` | |

### 2.2. ACB Cung Cấp Cho VIK

| # | Thông tin | Config | Ghi chú |
|---|-----------|--------|---------|
| 1 | Bank Key (Server Key) | encrypt_config.`server_key` | ACB tạo & cung cấp cho VIK. ACB gọi là `server_key` |
| 2 | Danh sách IP callback | — | Để VIK cấu hình IP Allowlist |
| 3 | Client ID | `masterMeta.clientId` | Mã định danh do ACB cấp cho VIK |

### 2.3. Sinh Keys

```bash
# Sinh API Key + Secret Key cho ACB
node src/scripts/generateAcbWebhookKeys.js
```

Output:

```
=== ACB WEBHOOK KEYS GENERATED ===

🔑 SECRET KEY — VIK tạo & cung cấp cho ACB (ACB gọi là "secret_key"):
a1b2c3d4e5f6...

📋 Cấu hình trong .env:
ACB_WEBHOOK_SECRET_KEY=a1b2c3d4e5f6...

📋 Cấu hình API Key:
ACB_WEBHOOK_API_KEY=x9y8z7w6...
```

### 2.4. Cấu Hình encrypt_config Trên Phía ACB

```json
{
  "encrypt_config": {
    "secret_key": "<Secret Key — VIK cung cấp>",
    "server_key": "<Bank Key — ACB tạo>",
    "header_key": "signature",
    "algorithm": "SHA256"
  }
}
```

---

## 3. Authentication & Security

### 3.1. API Key (`X-API-Key`)

Mọi request từ ACB **bắt buộc** gửi kèm header:

```
X-API-Key: <api_key_do_VIK_cấp>
```

- So sánh bằng **timing-safe comparison** (`crypto.timingSafeEqual`).
- Nếu sai hoặc thiếu → trả `401` + record auth failure.

### 3.2. SHA256 Checksum (`signature`)

ACB gửi checksum trong header `signature` để đảm bảo **tính toàn vẹn dữ liệu** (body không bị sửa đổi trên đường truyền).

#### Công Thức

```
checksum = SHA256( RequestBody + SecretKey + BankKey )
```

Trong đó:

| Thành phần | Nguồn | Mô tả |
|------------|-------|-------|
| `RequestBody` | ACB | Raw JSON body gốc (nguyên bytes, **chưa parse**, chưa format lại) |
| `SecretKey` | VIK cung cấp | ACB gọi là `secret_key` |
| `BankKey` | ACB cung cấp | ACB gọi là `server_key` |

#### Ví Dụ Tính Checksum

**Bước 1:** Chuẩn bị body JSON:

```json
{"masterMeta":{"clientId":"e1c935ed-2476-45d2-a2e3-e54254055f35","clientRequestId":"83104a68-9ad7-46fa-be2f-6f93159202ea","checksum":"test"},"requests":[{"requestMeta":{"requestType":"NOTIFICATION","requestCode":"TRANSACTION_UPDATE"},"requestParams":{"transactions":[{"transactionStatus":"COMPLETED","transactionChannel":"MAPP","transactionCode":4056,"accountNumber":3309219,"transactionDate":"2025-11-26T11:27:45.000Z","effectiveDate":"2025-11-27T00:00:00.000Z","debitOrCredit":"credit","virtualAccountInfo":null,"amount":500000000,"transactionEntityAttribute":{"issuerBankName":"ACB","receiverBankName":"ACB","remitterName":"NGUYEN VAN A","remitterAccountNumber":"9267919"},"transactionContent":"Nap tien"}],"pagination":{"page":1,"pageSize":1,"totalPage":1}}}]}
```

**Bước 2:** Nối chuỗi:

```
data = <rawBody> + <secretKey> + <bankKey>
```

**Bước 3:** Hash SHA256:

```
checksum = SHA256(data).toHex().toLowerCase()
```

→ Kết quả: chuỗi hex 64 ký tự, ví dụ: `"a1b2c3d4e5f67890..."`

**Bước 4:** Gửi trong header:

```
signature: a1b2c3d4e5f67890...
```

#### ⚠️ Lưu Ý Quan Trọng Về Checksum

1. **Raw body phải nguyên bản** — không được parse rồi stringify lại (thứ tự key, spacing có thể thay đổi → checksum sẽ sai).
2. **Nối chuỗi theo đúng thứ tự**: body + secretKey + bankKey (không có separator).
3. **Kết quả là hex lowercase** (không phải base64).
4. **So sánh timing-safe** — VIK sử dụng `crypto.timingSafeEqual` để ngăn timing attack.

### 3.3. Content-Type (Bắt Buộc)

```
Content-Type: application/json
```

Request không phải JSON → bị reject ngay với `415`.

### 3.4. IP Allowlist (CIDR Support)

VIK cấu hình whitelist các IP/CIDR từ ACB. Request từ IP không nằm trong danh sách → bị reject với `403`.

Hỗ trợ cả IP đơn lẻ và CIDR notation:

```
123.30.82.230/32, 123.30.83.216/29, 118.69.221.86/30, ...
```

### 3.5. Brute-force Auto-block

| Thông số | Giá trị |
|----------|---------|
| Ngưỡng | 5 lần auth fail (sai API Key hoặc Checksum) |
| Trong | 10 phút |
| Hậu quả | IP bị block **30 phút**, mọi request trả `403` |

### 3.6. Rate Limiting

| Thông số | Giá trị |
|----------|---------|
| Window | 1 phút |
| Max requests | 300 request/min/IP |
| Response headers | `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` |

### 3.7. Replay Protection (clientRequestId Dedup)

VIK lưu `masterMeta.clientRequestId` trong 1 giờ. Nếu ACB gửi lại cùng `clientRequestId`:

- VIK trả `200 OK` + `responseCode: "00000000"` (idempotent — không xử lý lại, không phải lỗi).
- ACB **không cần retry** khi nhận response này.

---

## 4. Endpoint — `POST /transaction`

### 4.1. Request

```http
POST /api/v1/webhooks/acb/transaction HTTP/1.1
Host: final.vn
Content-Type: application/json
X-API-Key: <api_key_do_VIK_cấp>
signature: <sha256_checksum>
```

### 4.2. Request Body

#### Cấu Trúc Tổng Quan

```json
{
  "masterMeta": {
    "clientId": "string (UUID)",
    "clientRequestId": "string (UUID)",
    "checksum": "string"
  },
  "requests": [
    {
      "requestMeta": {
        "requestType": "NOTIFICATION",
        "requestCode": "TRANSACTION_UPDATE | TRANSACTION_HISTORY"
      },
      "requestParams": {
        "transactions": [ ... ],
        "pagination": {
          "page": 1,
          "pageSize": 10,
          "totalPage": 1
        }
      }
    }
  ]
}
```

### 4.3. Mô Tả Các Trường

#### `masterMeta` — Thông tin định danh request

| Trường | Type | Required | Mô tả | Ví dụ |
|--------|------|----------|-------|-------|
| `clientId` | string | ✅ | Mã định danh khách hàng do ACB cấp cho VIK | `"e1c935ed-2476-45d2-a2e3-e54254055f35"` |
| `clientRequestId` | string | ✅ | Mã duy nhất cho mỗi request, do ACB tạo (UUID). Dùng để dedup & truy vết | `"83104a68-9ad7-46fa-be2f-6f93159202ea"` |
| `checksum` | string | ✅ | Mã hash kiểm tra tính chính xác của giao dịch | `"bae69aa2de0238f2521f041f23445913"` |

#### `requests[].requestMeta` — Loại yêu cầu

| Trường | Type | Required | Giá trị cho phép | Mô tả |
|--------|------|----------|-------------------|-------|
| `requestType` | string | ✅ | `"NOTIFICATION"` | Loại dịch vụ — hiện chỉ có NOTIFICATION |
| `requestCode` | string | ✅ | `"TRANSACTION_UPDATE"`, `"TRANSACTION_HISTORY"` | `TRANSACTION_UPDATE`: thông báo nợ/có tức thì · `TRANSACTION_HISTORY`: thông báo nợ/có cuối ngày |

#### `requests[].requestParams.transactions[]` — Chi tiết giao dịch

| Trường | Type | Required | Giá trị / Chi tiết | Mô tả |
|--------|------|----------|---------------------|-------|
| `transactionStatus` | string | ✅ | `"COMPLETED"`, `"ERRORCORRECTED"` | `COMPLETED`: giao dịch thành công · `ERRORCORRECTED`: giao dịch bị hủy/đảo |
| `transactionChannel` | string | ✅ | Xem danh sách bên dưới | Kênh thực hiện giao dịch |
| `transactionCode` | string/number | ✅ | VD: `56327`, `4056` | Mã giao dịch do ACB tạo khi hoàn tất |
| `accountNumber` | string/number | ✅ | VD: `887988`, `3309219` | Số tài khoản nhận thông báo |
| `transactionDate` | string (ISO 8601) | ✅ | VD: `"2025-11-26T11:27:45.000Z"` | Thời gian thực hiện giao dịch |
| `effectiveDate` | string (ISO 8601) | ❌ | VD: `"2025-11-27T00:00:00.000Z"` | Thời gian hiệu lực |
| `debitOrCredit` | string | ✅ | `"credit"`, `"debit"` | `credit`: tiền vào (báo có) · `debit`: tiền ra (báo nợ) |
| `amount` | number | ✅ | ≥ 0, VD: `500000000` | Số tiền giao dịch (VND) |
| `transactionContent` | string | ❌ | VD: `"Nạp tiền"` | Nội dung chuyển khoản |
| `virtualAccountInfo` | object | ❌ | `{ vaPrefixCd, vaNbr }` | Thông tin tài khoản ảo |
| `virtualAccount` | string | ❌ | VD: `"HU1"` | Tài khoản ảo |
| `referenceNumber` | string | ❌ | | Mã tham chiếu do hệ thống KH tạo |
| `partnerCustomerCode` | string | ❌ | | Mã định danh KH trên hệ thống KH |
| `partnerCustomerName` | string | ❌ | | Tên KH trên hệ thống KH |
| `partnerCustomerType` | string | ❌ | VD: `"KHCN"`, `"KHDN"`, `"ORG"` | Phân loại KH |
| `transactionEntityAttribute` | object | ❌ | Xem bảng bên dưới | Thông tin thuộc tính khác |
| `custom1` .. `custom10` | string | ❌ | | Trường mở rộng tùy chọn |

#### Danh sách `transactionChannel` (22 kênh)

| Code | Mô tả | Code | Mô tả |
|------|-------|------|-------|
| `BAT` | Batch | `VRU` | Voice Response Unit |
| `WWW` | Web | `ATM` | ATM |
| `ONLI` | Online | `ACH` | Automated Clearing House |
| `FSC` | Financial Service Center | `CCM` | Credit Card Management |
| `API` | API | `MG` | MoneyGram |
| `SECU` | Securities | `MAPP` | Mobile App |
| `SMS` | SMS Banking | `ACHS` | ACH Settlement |
| `CCAT` | Credit Card Transaction | `AAP` | Auto Approval |
| `IBFT` | Internet Banking Fund Transfer | `CLMS` | Claims |
| `REMI` | Remittance | `TB` | Teller Banking |
| `SOBA` | Standing Order/Batch | `BIZ` | Business Banking |

#### `transactionEntityAttribute` — Thông tin bên gửi/nhận

| Trường | Type | Mô tả |
|--------|------|-------|
| `traceNumber` | string | Mã giao dịch (trace) |
| `beneficiaryName` | string | Tên KH thụ hưởng |
| `beneficiaryAccountNumber` | string | Số TK KH thụ hưởng |
| `receiverBankName` | string | Tên ngân hàng thụ hưởng |
| `remitterName` | string | Tên KH chuyển tiền |
| `remitterAccountNumber` | string | Số TK KH chuyển tiền |
| `issuerBankName` | string | Tên ngân hàng chuyển tiền |

#### `requests[].requestParams.pagination`

| Trường | Type | Mô tả |
|--------|------|-------|
| `page` | number | Số trang hiện tại (≥ 1) |
| `pageSize` | number | Số dòng dữ liệu trong 1 trang (1..1000) |
| `totalPage` | number | Tổng số trang (≥ 1) |

---

## 5. Responses

> **Tất cả** response (cả success lẫn error) đều theo format thống nhất:
>
> ```json
> {
>   "timestamp": "<ISO 8601>",
>   "responseCode": "<mã_phản_hồi>",
>   "message": "<thông_báo>",
>   "responseBody": <object | null>
> }
> ```

### 5.1. ✅ 200 — Tiếp Nhận Thành Công

```json
{
  "timestamp": "2025-11-26T18:33:52.556Z",
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
| `timestamp` | string (ISO 8601) | Thời điểm VIK xử lý |
| `responseCode` | string | `"00000000"` = thành công |
| `message` | string | `"Success"` |
| `responseBody.referenceCode` | string | Chính là `clientRequestId` từ ACB |
| `responseBody.index` | number | Số giao dịch đã xử lý |

### 5.2. ✅ 200 — Duplicate (Idempotent)

Khi `clientRequestId` đã được xử lý trước đó:

```json
{
  "timestamp": "2025-11-26T18:35:00.123Z",
  "responseCode": "00000000",
  "message": "Success",
  "responseBody": {
    "referenceCode": "83104a68-9ad7-46fa-be2f-6f93159202ea",
    "index": 1
  }
}
```

ACB nhận `200` + `responseCode: "00000000"` → coi là thành công, **không cần retry**.

### 5.3. ❌ 400 — Lỗi Validation (Payload Sai/Thiếu Field)

```json
{
  "timestamp": "2025-11-26T18:33:52.556Z",
  "responseCode": "40000001",
  "message": "masterMeta.clientRequestId là bắt buộc",
  "responseBody": null
}
```

### 5.4. ❌ 401 — API Key Không Hợp Lệ

```json
{
  "timestamp": "2025-11-26T18:33:52.556Z",
  "responseCode": "40100001",
  "message": "Invalid or missing X-API-Key",
  "responseBody": null
}
```

### 5.5. ❌ 401 — Thiếu Checksum Header

```json
{
  "timestamp": "2025-11-26T18:33:52.556Z",
  "responseCode": "40100003",
  "message": "Missing checksum signature",
  "responseBody": null
}
```

### 5.6. ❌ 401 — Checksum Không Khớp

```json
{
  "timestamp": "2025-11-26T18:33:52.556Z",
  "responseCode": "40100002",
  "message": "Invalid checksum signature",
  "responseBody": null
}
```

### 5.7. ❌ 403 — IP Không Được Phép

```json
{
  "timestamp": "2025-11-26T18:33:52.556Z",
  "responseCode": "40300001",
  "message": "IP address not allowed",
  "responseBody": null
}
```

### 5.8. ❌ 403 — IP Bị Block (Brute-force)

```json
{
  "timestamp": "2025-11-26T18:33:52.556Z",
  "responseCode": "40300002",
  "message": "Too many failed attempts. Try again later.",
  "responseBody": null
}
```

### 5.9. ❌ 415 — Content-Type Không Hợp Lệ

```json
{
  "timestamp": "2025-11-26T18:33:52.556Z",
  "responseCode": "40000002",
  "message": "Content-Type must be application/json",
  "responseBody": null
}
```

### 5.10. ❌ 429 — Quá Nhiều Request (Rate Limit)

```json
{
  "success": false,
  "message": "Too many webhook requests. Please try again after 1 minute.",
  "code": "ACB_TOO_MANY_REQUESTS"
}
```

### 5.11. ❌ 500 — Lỗi Server VIK

```json
{
  "timestamp": "2025-11-26T18:33:52.556Z",
  "responseCode": "50000001",
  "message": "Internal server error",
  "responseBody": null
}
```

---

## 6. Error Codes — Tổng Hợp

| HTTP | responseCode | Nguyên nhân | ACB nên retry? |
|------|-------------|-------------|----------------|
| 200 | `00000000` | Tiếp nhận thành công | — |
| 200 | `00000000` | Duplicate `clientRequestId` (idempotent) | ❌ Đã nhận |
| 400 | `40000001` | Payload thiếu/sai field | ❌ Sửa payload |
| 401 | `40100001` | API Key sai hoặc thiếu | ❌ Kiểm tra key |
| 401 | `40100002` | Checksum không khớp | ❌ Kiểm tra keys + body |
| 401 | `40100003` | Thiếu header `signature` | ❌ Sửa code |
| 403 | `40300001` | IP không trong allowlist | ❌ Liên hệ VIK |
| 403 | `40300002` | IP bị auto-block (brute-force) | ❌ Đợi 30 phút |
| 415 | `40000002` | Content-Type không phải `application/json` | ❌ Sửa header |
| 429 | — | Vượt 300 req/min | ✅ Đợi 1 phút |
| 500 | `50000001` | Lỗi server VIK | ✅ Retry (max 3 lần) |

---

## 7. Retry & Timeout

### ACB Retry Policy

- ACB retry tối đa **3 lần** khi VIK không phản hồi hoặc trả lỗi.
- Nếu sau 3 lần vẫn thất bại → VIK sử dụng API tra cứu lịch sử giao dịch để đối soát.

### Timeout

- VIK endpoint phải phản hồi trong **17 giây**.
- Sau 17 giây → ACB coi là timeout → thực hiện retry.

---

## 8. Ví Dụ Hoàn Chỉnh

### 8.1. Request Body Mẫu — Giao Dịch Credit (Báo Có — Tiền VÀO)

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

### 8.2. Request Body Mẫu — Giao Dịch Debit (Báo Nợ — Tiền RA)

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

### 8.3. Request Body Mẫu — Nhiều Giao Dịch (Batch)

```json
{
    "masterMeta": {
        "clientId": "e1c935ed-2476-45d2-a2e3-e54254055f35",
        "clientRequestId": "b3f4a28c-1234-4abc-9def-567890abcdef",
        "checksum": "abc123"
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
                        "transactionChannel": "IBFT",
                        "transactionCode": 5001,
                        "accountNumber": 3309219,
                        "transactionDate": "2025-11-26T09:00:00.000Z",
                        "effectiveDate": "2025-11-26T00:00:00.000Z",
                        "debitOrCredit": "credit",
                        "virtualAccountInfo": null,
                        "amount": 1000000,
                        "transactionEntityAttribute": {
                            "issuerBankName": "Vietcombank",
                            "receiverBankName": "ACB - NH TMCP A CHAU",
                            "remitterName": "LE THI B",
                            "remitterAccountNumber": "0011234567"
                        },
                        "transactionContent": "Thanh toan don hang DH001"
                    },
                    {
                        "transactionStatus": "COMPLETED",
                        "transactionChannel": "MAPP",
                        "transactionCode": 5002,
                        "accountNumber": 3309219,
                        "transactionDate": "2025-11-26T10:30:00.000Z",
                        "effectiveDate": "2025-11-26T00:00:00.000Z",
                        "debitOrCredit": "credit",
                        "virtualAccountInfo": null,
                        "amount": 2500000,
                        "transactionEntityAttribute": {
                            "issuerBankName": "Techcombank",
                            "receiverBankName": "ACB - NH TMCP A CHAU",
                            "remitterName": "TRAN VAN C",
                            "remitterAccountNumber": "19022345678"
                        },
                        "transactionContent": "Chuyen tien mua hang"
                    }
                ],
                "pagination": {
                    "page": 1,
                    "pageSize": 2,
                    "totalPage": 1
                }
            }
        }
    ]
}
```

---

## 9. Code Samples — Kiểm Thử

### 9.1. cURL (Bash)

```bash
#!/bin/bash

# ─── Cấu hình ───────────────────────────────────────────────────────────────
API_KEY="<api_key_do_VIK_cấp>"
SECRET_KEY="<secret_key_do_VIK_cấp>"       # VIK tạo → cung cấp cho ACB
BANK_KEY="<bank_key_do_ACB_cấp>"           # ACB tạo → cung cấp cho VIK
BASE_URL="https://final.vn/api/v1/webhooks/acb"

# ─── Tạo body JSON ──────────────────────────────────────────────────────────
CLIENT_REQUEST_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
TX_DATE=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

BODY=$(cat <<EOF
{"masterMeta":{"clientId":"e1c935ed-2476-45d2-a2e3-e54254055f35","clientRequestId":"${CLIENT_REQUEST_ID}","checksum":"test"},"requests":[{"requestMeta":{"requestType":"NOTIFICATION","requestCode":"TRANSACTION_UPDATE"},"requestParams":{"transactions":[{"transactionStatus":"COMPLETED","transactionChannel":"MAPP","transactionCode":4056,"accountNumber":3309219,"transactionDate":"${TX_DATE}","effectiveDate":"${TX_DATE}","debitOrCredit":"credit","virtualAccountInfo":null,"amount":500000000,"transactionEntityAttribute":{"issuerBankName":"ACB","receiverBankName":"ACB","remitterName":"NGUYEN VAN A","remitterAccountNumber":"9267919"},"transactionContent":"Nap tien"}],"pagination":{"page":1,"pageSize":1,"totalPage":1}}}]}
EOF
)

# ─── Tính SHA256 checksum ────────────────────────────────────────────────────
# checksum = SHA256(body + secretKey + bankKey)
CHECKSUM=$(printf '%s' "${BODY}${SECRET_KEY}${BANK_KEY}" | shasum -a 256 | awk '{print $1}')

# ─── Gửi request ────────────────────────────────────────────────────────────
echo "📤 Sending ACB webhook..."
echo "   clientRequestId: ${CLIENT_REQUEST_ID}"
echo "   checksum: ${CHECKSUM}"
echo ""

curl -s -w "\n\n📊 HTTP Status: %{http_code}\n" \
  -X POST "${BASE_URL}/transaction" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -H "signature: ${CHECKSUM}" \
  -d "${BODY}" | jq .
```

### 9.2. Node.js

```javascript
const crypto = require('crypto');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// ─── Cấu hình ───────────────────────────────────────────────────────────────
const API_BASE = 'https://final.vn/api/v1/webhooks/acb';
const API_KEY  = '<api_key_do_VIK_cấp>';
const SECRET_KEY = '<secret_key_do_VIK_cấp>'; // VIK tạo → cung cấp cho ACB
const BANK_KEY   = '<bank_key_do_ACB_cấp>';   // ACB tạo → cung cấp cho VIK

async function sendAcbWebhook() {
  // ─── Bước 1: Tạo payload ──────────────────────────────────────────────────
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

  // ─── Bước 2: Stringify body (giữ nguyên, không format lại) ────────────────
  const rawBody = JSON.stringify(body);

  // ─── Bước 3: Tính SHA256 checksum ─────────────────────────────────────────
  // checksum = SHA256(rawBody + secretKey + bankKey)
  const checksum = crypto
    .createHash('sha256')
    .update(rawBody + SECRET_KEY + BANK_KEY)
    .digest('hex');

  console.log('📤 Sending ACB webhook...');
  console.log('   clientRequestId:', body.masterMeta.clientRequestId);
  console.log('   checksum:', checksum);

  // ─── Bước 4: Gửi request ─────────────────────────────────────────────────
  // ⚠️ QUAN TRỌNG: Gửi rawBody (string), KHÔNG gửi object.
  //    Nếu gửi object, axios sẽ tự stringify → thứ tự key có thể khác → checksum sẽ sai.
  try {
    const response = await axios.post(
      `${API_BASE}/transaction`,
      rawBody,  // ← gửi string, không gửi object
      {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
          'signature': checksum,
        },
        timeout: 17000, // ACB timeout: 17 giây
      },
    );

    console.log('✅ Response:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('❌ Error:', error.response?.status, error.response?.data || error.message);
    throw error;
  }
}

sendAcbWebhook();
```

### 9.3. Python

```python
import hashlib
import json
import uuid
from datetime import datetime, timezone

import requests

# ─── Cấu hình ───────────────────────────────────────────────────────────────
API_BASE   = "https://final.vn/api/v1/webhooks/acb"
API_KEY    = "<api_key_do_VIK_cấp>"
SECRET_KEY = "<secret_key_do_VIK_cấp>"  # VIK tạo → cung cấp cho ACB
BANK_KEY   = "<bank_key_do_ACB_cấp>"    # ACB tạo → cung cấp cho VIK

def send_acb_webhook():
    # Bước 1: Tạo payload
    body = {
        "masterMeta": {
            "clientId": "e1c935ed-2476-45d2-a2e3-e54254055f35",
            "clientRequestId": str(uuid.uuid4()),
            "checksum": "will-be-computed",
        },
        "requests": [{
            "requestMeta": {
                "requestType": "NOTIFICATION",
                "requestCode": "TRANSACTION_UPDATE",
            },
            "requestParams": {
                "transactions": [{
                    "transactionStatus": "COMPLETED",
                    "transactionChannel": "MAPP",
                    "transactionCode": 4056,
                    "accountNumber": 3309219,
                    "transactionDate": datetime.now(timezone.utc).isoformat(),
                    "effectiveDate": datetime.now(timezone.utc).isoformat(),
                    "debitOrCredit": "credit",
                    "virtualAccountInfo": None,
                    "amount": 500000000,
                    "transactionEntityAttribute": {
                        "issuerBankName": "ACB - NH TMCP A CHAU",
                        "receiverBankName": "ACB - NH TMCP A CHAU",
                        "remitterName": "NGUYEN VAN A",
                        "remitterAccountNumber": "9267919",
                    },
                    "transactionContent": "Nap tien",
                }],
                "pagination": {"page": 1, "pageSize": 1, "totalPage": 1},
            },
        }],
    }

    # Bước 2: Stringify body (dùng separators để không có space thừa)
    raw_body = json.dumps(body, separators=(",", ":"), ensure_ascii=False)

    # Bước 3: Tính SHA256 checksum
    data_to_hash = raw_body + SECRET_KEY + BANK_KEY
    checksum = hashlib.sha256(data_to_hash.encode("utf-8")).hexdigest()

    print(f"📤 Sending ACB webhook...")
    print(f"   clientRequestId: {body['masterMeta']['clientRequestId']}")
    print(f"   checksum: {checksum}")

    # Bước 4: Gửi request
    # ⚠️ QUAN TRỌNG: Gửi raw_body (string), KHÔNG dùng json= parameter
    response = requests.post(
        f"{API_BASE}/transaction",
        data=raw_body,  # ← gửi string, không dùng json=body
        headers={
            "Content-Type": "application/json",
            "X-API-Key": API_KEY,
            "signature": checksum,
        },
        timeout=17,
    )

    print(f"\n📊 HTTP Status: {response.status_code}")
    print(f"✅ Response: {json.dumps(response.json(), indent=2)}")
    return response.json()


if __name__ == "__main__":
    send_acb_webhook()
```

### 9.4. Java

```java
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

public class AcbWebhookTest {
    
    static final String API_BASE   = "https://final.vn/api/v1/webhooks/acb";
    static final String API_KEY    = "<api_key_do_VIK_cấp>";
    static final String SECRET_KEY = "<secret_key_do_VIK_cấp>";  // VIK tạo → cung cấp cho ACB
    static final String BANK_KEY   = "<bank_key_do_ACB_cấp>";    // ACB tạo → cung cấp cho VIK

    public static void main(String[] args) throws Exception {
        String clientRequestId = UUID.randomUUID().toString();
        String txDate = Instant.now().toString();

        // Bước 1: Tạo body JSON
        String rawBody = String.format(
            "{\"masterMeta\":{\"clientId\":\"e1c935ed-2476-45d2-a2e3-e54254055f35\","
            + "\"clientRequestId\":\"%s\",\"checksum\":\"test\"},"
            + "\"requests\":[{\"requestMeta\":{\"requestType\":\"NOTIFICATION\","
            + "\"requestCode\":\"TRANSACTION_UPDATE\"},\"requestParams\":{\"transactions\":"
            + "[{\"transactionStatus\":\"COMPLETED\",\"transactionChannel\":\"MAPP\","
            + "\"transactionCode\":4056,\"accountNumber\":3309219,"
            + "\"transactionDate\":\"%s\",\"effectiveDate\":\"%s\","
            + "\"debitOrCredit\":\"credit\",\"virtualAccountInfo\":null,"
            + "\"amount\":500000000,\"transactionEntityAttribute\":"
            + "{\"issuerBankName\":\"ACB\",\"receiverBankName\":\"ACB\","
            + "\"remitterName\":\"NGUYEN VAN A\",\"remitterAccountNumber\":\"9267919\"},"
            + "\"transactionContent\":\"Nap tien\"}],"
            + "\"pagination\":{\"page\":1,\"pageSize\":1,\"totalPage\":1}}}]}",
            clientRequestId, txDate, txDate
        );

        // Bước 2: Tính SHA256 checksum
        String dataToHash = rawBody + SECRET_KEY + BANK_KEY;
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] hashBytes = digest.digest(dataToHash.getBytes(StandardCharsets.UTF_8));
        StringBuilder checksum = new StringBuilder();
        for (byte b : hashBytes) {
            checksum.append(String.format("%02x", b));
        }

        System.out.println("📤 Sending ACB webhook...");
        System.out.println("   clientRequestId: " + clientRequestId);
        System.out.println("   checksum: " + checksum);

        // Bước 3: Gửi request
        HttpClient client = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(API_BASE + "/transaction"))
            .timeout(Duration.ofSeconds(17))
            .header("Content-Type", "application/json")
            .header("X-API-Key", API_KEY)
            .header("signature", checksum.toString())
            .POST(HttpRequest.BodyPublishers.ofString(rawBody))
            .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

        System.out.println("\n📊 HTTP Status: " + response.statusCode());
        System.out.println("✅ Response: " + response.body());
    }
}
```

---

## 10. Cấu Hình .env (VIK Server)

```bash
# ─── ACB Bank Webhook ─────────────────────────────────────────────────────────

# API Key xác thực (VIK sinh → cung cấp cho ACB, truyền qua header X-API-Key)
ACB_WEBHOOK_API_KEY=<production_api_key>

# Secret Key — VIK sinh → cung cấp cho ACB (ACB gọi là "secret_key")
ACB_WEBHOOK_SECRET_KEY=<production_secret_key>

# Bank Key — ACB sinh → cung cấp cho VIK (ACB gọi là "server_key")
ACB_WEBHOOK_BANK_KEY=<giá_trị_ACB_cung_cấp>

# Tên header chứa checksum (mặc định: signature)
ACB_WEBHOOK_CHECKSUM_HEADER=signature

# Thuật toán băm (mặc định: SHA256)
ACB_WEBHOOK_CHECKSUM_ALGORITHM=SHA256

# IP allowlist — CIDR support, phân cách bằng dấu phẩy
# Đặt 0.0.0.0 để allow all (chỉ dùng khi dev/test)
# Để trống = block tất cả (secure by default)
ACB_WEBHOOK_ALLOWED_IPS=123.30.82.230/32,123.30.83.216/29,123.30.82.230/30,118.69.221.86/32,118.69.223.64/27,118.69.221.86/30,182.237.20.246/32,182.237.22.176/28,103.136.114.154/30,14.238.112.16/29,120.72.112.202/30,171.224.107.24/29,202.59.252.168,202.59.252.169
```

---

## 11. Quy Trình Kiểm Thử Tích Hợp

### Bước 1 — Trao Đổi Thông Tin

| VIK cung cấp cho ACB | ACB cung cấp cho VIK |
|----------------------|----------------------|
| ✅ Callback URL | ✅ Bank Key (`server_key`) |
| ✅ IP tĩnh server VIK | ✅ Danh sách IP callback |
| ✅ API Key (`X-API-Key`) | ✅ Client ID (`masterMeta.clientId`) |
| ✅ Secret Key (`secret_key`) | |
| ✅ Thuật toán checksum: `SHA256` | |
| ✅ Tên header checksum: `signature` | |

### Bước 2 — ACB Cấu Hình

ACB cấu hình endpoint + encrypt_config trên môi trường kiểm thử:

```json
{
  "callback_url": "https://final.vn/api/v1/webhooks/acb/transaction",
  "method": "POST",
  "auth": {
    "type": "API_KEY",
    "header": "X-API-Key",
    "value": "<api_key_do_VIK_cấp>"
  },
  "encrypt_config": {
    "secret_key": "<secret_key_do_VIK_cấp>",
    "server_key": "<bank_key_do_ACB_tạo>",
    "header_key": "signature",
    "algorithm": "SHA256"
  }
}
```

### Bước 3 — Kiểm Thử

1. ACB tạo giao dịch kiểm thử → gửi webhook đến Callback URL.
2. VIK kiểm tra log tiếp nhận.
3. Kiểm tra các case:
   - ✅ Giao dịch credit (tiền vào)
   - ✅ Giao dịch debit (tiền ra)
   - ✅ Batch nhiều giao dịch
   - ✅ Duplicate `clientRequestId` (idempotent)
   - ✅ Sai API Key → nhận 401
   - ✅ Sai Checksum → nhận 401
   - ✅ Thiếu field bắt buộc → nhận 400

### Bước 4 — Đối Soát

So sánh số lượng giao dịch giữa hai bên.

> Nếu webhook không nhận thành công, VIK có thể sử dụng API tra cứu lịch sử giao dịch của ACB để đối soát.

---

## 12. Checklist Kiểm Thử — Dùng Nội Bộ

### Trước Khi Gửi Cho ACB

- [ ] Chạy `node src/scripts/generateAcbWebhookKeys.js` → sinh API Key + Secret Key
- [ ] Cấu hình `.env` đầy đủ
- [ ] Test cURL với dev URL (IP allowlist = `0.0.0.0` cho dev)
- [ ] Xác nhận response đúng format `{ timestamp, responseCode: "00000000", message, responseBody }`
- [ ] Test duplicate `clientRequestId` → nhận 200 idempotent
- [ ] Test sai API Key → nhận 401
- [ ] Test thiếu signature header → nhận 401
- [ ] Test sai checksum → nhận 401
- [ ] Test payload thiếu field → nhận 400
- [ ] Test sai Content-Type → nhận 415

### Sau Khi Gửi Cho ACB

- [ ] ACB xác nhận đã nhận đủ thông tin (URL, API Key, Secret Key, thuật toán)
- [ ] ACB cung cấp Bank Key (`server_key`) → cập nhật `.env`
- [ ] ACB cung cấp danh sách IP callback → cập nhật `ACB_WEBHOOK_ALLOWED_IPS`
- [ ] Chuyển IP allowlist từ `0.0.0.0` sang danh sách IP thực
- [ ] ACB gửi test webhook → xác nhận nhận được
- [ ] Đối soát giao dịch test hai bên

---

## 13. Liên Hệ Hỗ Trợ

- **Sinh keys:** `node src/scripts/generateAcbWebhookKeys.js`
- **Chia sẻ keys:** qua kênh bảo mật (không qua email/chat không mã hóa)
- **Postman collection:** `docs/ACB_Webhook_Postman_Collection.json`
- **Liên hệ admin VIK** khi gặp lỗi không xác định
