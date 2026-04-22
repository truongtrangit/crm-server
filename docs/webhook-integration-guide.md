# Webhook Integration Guide

Hướng dẫn tích hợp webhook để gửi sự kiện (event) vào hệ thống CRM.

---

## Mục lục

- [1. Tổng quan](#1-tổng-quan)
- [2. Thông tin xác thực](#2-thông-tin-xác-thực)
- [3. Endpoint](#3-endpoint)
- [4. Security Headers](#4-security-headers)
- [5. Request Body](#5-request-body)
- [6. Các loại Event](#6-các-loại-event)
- [7. Payload mẫu cho từng Event](#7-payload-mẫu-cho-từng-event)
- [8. Response](#8-response)
- [9. Xử lý lỗi](#9-xử-lý-lỗi)
- [10. Code mẫu](#10-code-mẫu)
- [11. FAQ](#11-faq)

---

## 1. Tổng quan

Hệ thống CRM cung cấp một webhook endpoint để nhận các sự kiện từ hệ thống bên ngoài. Khi bên thứ 3 gửi event, CRM sẽ tự động:

- Tạo **Event** trong hệ thống
- Tạo hoặc liên kết **Customer** (khách hàng)
- Gán **Assignee** (người phụ trách) nếu có
- Ghi log lại toàn bộ quá trình

---

## 2. Thông tin xác thực

CRM sẽ cung cấp cho bạn 2 key:

| Key | Mô tả | Ví dụ |
|-----|--------|-------|
| `WEBHOOK_SECRET` | Bearer token để xác thực request | `whsec_abc123...` |
| `WEBHOOK_SIGNING_KEY` | HMAC key để ký payload | `whsk_xyz789...` |

> ⚠️ **Bảo mật:** Giữ bí mật cả 2 key. Không commit vào source code. Lưu trong environment variables hoặc secret manager.

---

## 3. Endpoint

```
POST {CRM_BASE_URL}/api/v1/webhooks/ingest
```

| Thuộc tính | Giá trị |
|-----------|---------|
| Method | `POST` |
| Content-Type | `application/json` |
| Rate Limit | 100 requests / phút / IP |

---

## 4. Security Headers

Mỗi request **bắt buộc** phải có 3 headers:

### 4.1. Authorization (Bắt buộc)

```
Authorization: Bearer <WEBHOOK_SECRET>
```

### 4.2. X-Webhook-Signature (Bắt buộc)

HMAC-SHA256 signature của request body, format: `sha256=<hex>`.

**Cách tính:**
```
HMAC-SHA256(key = WEBHOOK_SIGNING_KEY, data = raw_request_body)
```

Ví dụ (Node.js):
```js
const crypto = require('crypto');

const body = JSON.stringify(payload);
const hmac = crypto.createHmac('sha256', WEBHOOK_SIGNING_KEY)
                   .update(body)
                   .digest('hex');
const signature = `sha256=${hmac}`;
```

Ví dụ (Python):
```python
import hmac, hashlib, json

body = json.dumps(payload, separators=(',', ':'))
sig = hmac.new(WEBHOOK_SIGNING_KEY.encode(), body.encode(), hashlib.sha256).hexdigest()
signature = f"sha256={sig}"
```

### 4.3. X-Webhook-Delivery-Id (Khuyến nghị)

ID duy nhất cho mỗi lần gửi — dùng để chống trùng lặp (idempotency).

```
X-Webhook-Delivery-Id: 550e8400-e29b-41d4-a716-446655440000
```

> Nếu không gửi header này, CRM sẽ tự tạo. Tuy nhiên, **khuyến nghị luôn gửi** để:
> - Tránh xử lý trùng khi retry
> - Dễ trace/debug giữa 2 hệ thống

---

## 5. Request Body

```json
{
  "eventType": "user_moi",
  "payload": { ... },
  "source": "ten-he-thong",
  "timestamp": "2026-04-22T09:00:00.000Z"
}
```

| Field | Type | Bắt buộc | Mô tả |
|-------|------|----------|--------|
| `eventType` | `string` | ✅ | Loại sự kiện (xem [mục 6](#6-các-loại-event)) |
| `payload` | `object` | ✅ | Dữ liệu sự kiện (cấu trúc tùy theo eventType) |
| `source` | `string` | ❌ | Tên hệ thống nguồn, mặc định `"external"` |
| `timestamp` | `string` | ❌ | ISO 8601 timestamp |

---

## 6. Các loại Event

| eventType | Mô tả | Event Group trong CRM |
|-----------|--------|-----------------------|
| `user_moi` | Có khách hàng đăng ký mới | User mới |
| `biz_moi` | Khách hàng tạo business mới | Biz Mới |
| `sap_het_han` | Business sắp hết hạn, cần gia hạn | Sắp hết hạn |
| `can_nang_cap` | Business cần nâng cấp gói | Cần nâng cấp |

---

## 7. Payload mẫu cho từng Event

### 7.1. `user_moi` — Khách hàng đăng ký mới

```json
{
  "eventType": "user_moi",
  "payload": {
    "customer": {
      "name": "Nguyễn Văn A",
      "email": "nguyenvana@example.com",
      "phone": "0901 234 567",
      "source": "Website",
      "address": "Hà Nội"
    },
    "assignee": {
      "email": "staff@company.com"
    },
    "tags": ["#trial", "#web"]
  },
  "source": "user-service"
}
```

> **Lưu ý:** Với `user_moi`, CRM sẽ tự động **tạo Customer mới** nếu chưa tồn tại (dựa trên email/phone).

### 7.2. `biz_moi` — Tạo Business mới

```json
{
  "eventType": "biz_moi",
  "payload": {
    "customer": {
      "name": "Nguyễn Văn A",
      "email": "nguyenvana@example.com",
      "phone": "0901 234 567"
    },
    "biz": {
      "id": "BIZ-12345",
      "tags": ["ecommerce", "saas"]
    },
    "plan": {
      "name": "TRIAL",
      "cycle": "Thanh toán theo tháng",
      "price": "0 đ",
      "daysLeft": 14,
      "expiryDate": "2026-05-06"
    },
    "assigneeId": "USER001"
  },
  "source": "biz-service"
}
```

### 7.3. `sap_het_han` — Sắp hết hạn

```json
{
  "eventType": "sap_het_han",
  "payload": {
    "customer": {
      "email": "nguyenvana@example.com"
    },
    "biz": {
      "id": "BIZ-12345",
      "tags": ["ecommerce"]
    },
    "plan": {
      "name": "PRO",
      "daysLeft": 3,
      "expiryDate": "2026-04-25"
    },
    "assignee": {
      "phone": "0987654321"
    }
  },
  "source": "billing-service"
}
```

### 7.4. `can_nang_cap` — Cần nâng cấp

```json
{
  "eventType": "can_nang_cap",
  "payload": {
    "customer": {
      "email": "nguyenvana@example.com",
      "name": "Nguyễn Văn A"
    },
    "biz": {
      "id": "BIZ-12345"
    },
    "plan": {
      "name": "BASIC",
      "cycle": "Thanh toán theo năm",
      "price": "500.000 đ"
    },
    "quotas": [
      { "name": "Users", "used": 48, "total": 50, "color": "red" },
      { "name": "Storage", "used": 9.5, "total": 10, "color": "orange" }
    ]
  },
  "source": "billing-service"
}
```

---

## 8. Response

### Thành công (201)

```json
{
  "statusCode": 201,
  "message": "Webhook processed successfully",
  "data": {
    "deliveryId": "550e8400-e29b-41d4-a716-446655440000",
    "eventType": "user_moi",
    "status": "processed",
    "eventId": "EVT042"
  }
}
```

### Lỗi

```json
{
  "statusCode": 401,
  "code": "WEBHOOK_INVALID_TOKEN",
  "message": "Invalid webhook token"
}
```

---

## 9. Xử lý lỗi

| HTTP Status | Code | Nguyên nhân | Xử lý |
|-------------|------|-------------|--------|
| `400` | `VALIDATION_ERROR` | `eventType` không hợp lệ hoặc thiếu `payload` | Kiểm tra lại body |
| `401` | `WEBHOOK_AUTH_REQUIRED` | Thiếu header `Authorization` | Thêm `Bearer <token>` |
| `401` | `WEBHOOK_INVALID_TOKEN` | Token sai | Kiểm tra lại `WEBHOOK_SECRET` |
| `401` | `WEBHOOK_SIGNATURE_REQUIRED` | Thiếu header `X-Webhook-Signature` | Thêm HMAC signature |
| `401` | `WEBHOOK_INVALID_SIGNATURE` | Signature không khớp | Kiểm tra `WEBHOOK_SIGNING_KEY` và cách tính HMAC |
| `403` | `WEBHOOK_IP_FORBIDDEN` | IP không nằm trong whitelist | Liên hệ CRM admin |
| `409` | `WEBHOOK_DUPLICATE_DELIVERY` | `X-Webhook-Delivery-Id` đã được xử lý | Không cần retry |
| `429` | `TOO_MANY_REQUESTS` | Vượt quá rate limit (100 req/phút) | Chờ và retry |

### Chiến lược Retry

- **Nên retry:** `429`, `500`, `502`, `503`
- **Không nên retry:** `400`, `401`, `403`, `409`
- **Khuyến nghị:** Exponential backoff (1s → 2s → 4s → 8s → ...), tối đa 5 lần

---

## 10. Code mẫu

### Node.js

```js
const crypto = require('crypto');
const https = require('https');

const CRM_URL = 'https://crm.example.com/api/v1/webhooks/ingest';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const WEBHOOK_SIGNING_KEY = process.env.WEBHOOK_SIGNING_KEY;

async function sendWebhook(eventType, payload) {
  const body = JSON.stringify({ eventType, payload, source: 'my-service' });
  const deliveryId = crypto.randomUUID();

  // Tính HMAC signature
  const hmac = crypto.createHmac('sha256', WEBHOOK_SIGNING_KEY)
                     .update(body)
                     .digest('hex');

  const res = await fetch(CRM_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${WEBHOOK_SECRET}`,
      'X-Webhook-Signature': `sha256=${hmac}`,
      'X-Webhook-Delivery-Id': deliveryId,
    },
    body,
  });

  const data = await res.json();
  console.log(`[${res.status}] Delivery ${deliveryId}:`, data);
  return data;
}

// Ví dụ: Gửi event "user mới"
sendWebhook('user_moi', {
  customer: {
    name: 'Nguyễn Văn A',
    email: 'nguyenvana@example.com',
    phone: '0901 234 567',
  },
});
```

### Python

```python
import hashlib, hmac, json, uuid, requests

CRM_URL = 'https://crm.example.com/api/v1/webhooks/ingest'
WEBHOOK_SECRET = 'whsec_...'
WEBHOOK_SIGNING_KEY = 'whsk_...'

def send_webhook(event_type: str, payload: dict):
    body = json.dumps({
        'eventType': event_type,
        'payload': payload,
        'source': 'my-service',
    }, separators=(',', ':'))

    delivery_id = str(uuid.uuid4())

    # Tính HMAC signature
    sig = hmac.new(
        WEBHOOK_SIGNING_KEY.encode(),
        body.encode(),
        hashlib.sha256
    ).hexdigest()

    resp = requests.post(CRM_URL, data=body, headers={
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {WEBHOOK_SECRET}',
        'X-Webhook-Signature': f'sha256={sig}',
        'X-Webhook-Delivery-Id': delivery_id,
    })

    print(f'[{resp.status_code}] Delivery {delivery_id}: {resp.json()}')
    return resp.json()

# Ví dụ
send_webhook('user_moi', {
    'customer': {
        'name': 'Nguyễn Văn A',
        'email': 'nguyenvana@example.com',
        'phone': '0901 234 567',
    }
})
```

### cURL

```bash
# 1. Tạo body
BODY='{"eventType":"user_moi","payload":{"customer":{"name":"Nguyễn Văn A","email":"nguyenvana@example.com"}},"source":"curl-test"}'

# 2. Tính HMAC
SIGNATURE="sha256=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$WEBHOOK_SIGNING_KEY" | awk '{print $2}')"

# 3. Gửi request
curl -X POST https://crm.example.com/api/v1/webhooks/ingest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $WEBHOOK_SECRET" \
  -H "X-Webhook-Signature: $SIGNATURE" \
  -H "X-Webhook-Delivery-Id: $(uuidgen)" \
  -d "$BODY"
```

---

## 11. FAQ

### Payload có phải theo đúng cấu trúc không?

**Không bắt buộc.** `payload` chấp nhận bất kỳ cấu trúc JSON nào. Tuy nhiên, để CRM xử lý tốt nhất, khuyến nghị gửi theo cấu trúc trong [mục 7](#7-payload-mẫu-cho-từng-event).

### Trường `customer` hỗ trợ những format nào?

CRM hỗ trợ 3 format:

```json
// Format 1: Nested (khuyến nghị)
{ "customer": { "name": "...", "email": "...", "phone": "..." } }

// Format 2: Flat với prefix
{ "customerName": "...", "customerEmail": "...", "customerPhone": "..." }

// Format 3: Direct (fallback)
{ "name": "...", "email": "...", "phone": "..." }
```

### Làm sao để gán người phụ trách (assignee)?

Gửi 1 trong các cách sau trong `payload`:

```json
// Cách 1: Gửi ID trực tiếp
{ "assigneeId": "USER001" }

// Cách 2: Gửi thông tin nested — CRM sẽ tự lookup
{ "assignee": { "email": "staff@company.com" } }
{ "assignee": { "name": "Nguyễn Văn B" } }
{ "assignee": { "phone": "0987654321" } }
```

CRM sẽ tìm nhân viên trong hệ thống theo thứ tự ưu tiên: `id → email → name → phone`. Nếu không tìm thấy, event vẫn được tạo nhưng assignee sẽ không được liên kết.

### Gửi trùng deliveryId có sao không?

CRM sẽ trả về `409 WEBHOOK_DUPLICATE_DELIVERY` và **không xử lý lại**. Đây là cơ chế an toàn để tránh tạo event trùng khi retry.

### Rate limit bao nhiêu?

**100 requests / phút / IP.** Nếu vượt quá, bạn sẽ nhận `429 TOO_MANY_REQUESTS`. Hãy implement exponential backoff khi retry.

---

## Checklist tích hợp

- [ ] Nhận `WEBHOOK_SECRET` và `WEBHOOK_SIGNING_KEY` từ CRM team
- [ ] Implement HMAC-SHA256 signature
- [ ] Gửi `X-Webhook-Delivery-Id` với UUID unique cho mỗi request
- [ ] Implement retry logic với exponential backoff
- [ ] Test với event `user_moi` trên môi trường staging
- [ ] Xác nhận response `201` và event xuất hiện trong CRM
