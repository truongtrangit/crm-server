# Webhook Integration Guide

Hướng dẫn tích hợp webhook để gửi sự kiện (event) vào hệ thống CRM.

---

## Mục lục

- [1. Tổng quan](#1-tổng-quan)
- [2. Thông tin xác thực](#2-thông-tin-xác-thực)
- [3. Các API Webhook](#3-các-api-webhook)
- [4. Headers](#4-headers)
- [5. Payload mẫu cho từng API](#5-payload-mẫu-cho-từng-api)
- [6. Response](#6-response)
- [7. Xử lý lỗi](#7-xử-lý-lỗi)
- [8. Code mẫu](#8-code-mẫu)
- [9. FAQ](#9-faq)

---

## 1. Tổng quan

Hệ thống CRM cung cấp **1 API riêng cho mỗi loại sự kiện**. Bên thứ 3 chỉ cần:

1. Gọi đúng **URL** tương ứng với loại event
2. Kèm **Bearer token** trong header để xác thực
3. Gửi **payload** trực tiếp trong body

> Không cần gửi `eventType` trong body — CRM xác định loại event từ URL.

---

## 2. Thông tin xác thực

CRM sẽ cung cấp cho bạn:

| Key | Mô tả | Ví dụ |
|-----|--------|-------|
| `WEBHOOK_SECRET` | Bearer token để xác thực request | `whsec_abc123...` |

> ⚠️ **Bảo mật:** Giữ bí mật token. Không commit vào source code. Lưu trong environment variables hoặc secret manager.

---

## 3. Các API Webhook

Base URL: `{CRM_BASE_URL}/api/v1/webhooks`

| API | Method | Mô tả |
|-----|--------|--------|
| `/api/v1/webhooks/new-registration` | `POST` | Có khách hàng đăng ký mới |
| `/api/v1/webhooks/new-business` | `POST` | Khách hàng tạo business mới |
| `/api/v1/webhooks/expiring-subscription` | `POST` | Business sắp hết hạn, cần gia hạn |
| `/api/v1/webhooks/upgrade-required` | `POST` | Business cần nâng cấp gói |

**Thông số chung:**

| Thuộc tính | Giá trị |
|-----------|---------|
| Content-Type | `application/json` |
| Rate Limit | 100 requests / phút / IP |

---

## 4. Headers

### 4.1. Authorization (Bắt buộc)

```
Authorization: Bearer <WEBHOOK_SECRET>
```

### 4.2. X-Webhook-Delivery-Id (Tùy chọn)

ID duy nhất cho mỗi lần gửi — dùng để chống trùng lặp (idempotency).

```
X-Webhook-Delivery-Id: 550e8400-e29b-41d4-a716-446655440000
```

- Nếu gửi: CRM sẽ kiểm tra trùng lặp, cùng 1 ID sẽ chỉ xử lý 1 lần
- Nếu không gửi: CRM tự sinh UUID, không kiểm tra trùng lặp

> **Khuyến nghị:** Nếu bạn có cơ chế retry, hãy gửi delivery ID để tránh tạo event trùng.

---

## 5. Payload mẫu cho từng API

Body gửi trực tiếp là data — **không cần wrap** trong object nào.

### 5.1. POST `/webhooks/new-registration` — Khách hàng đăng ký mới

```json
{
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
}
```

> **Lưu ý:** CRM sẽ tự động **tạo Customer mới** nếu chưa tồn tại (dựa trên email/phone).

### 5.2. POST `/webhooks/new-business` — Tạo Business mới

```json
{
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
  }
}
```

### 5.3. POST `/webhooks/expiring-subscription` — Sắp hết hạn

```json
{
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
  }
}
```

### 5.4. POST `/webhooks/upgrade-required` — Cần nâng cấp

```json
{
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
}
```

---

## 6. Response

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

## 7. Xử lý lỗi

| HTTP Status | Code | Nguyên nhân | Xử lý |
|-------------|------|-------------|--------|
| `401` | `WEBHOOK_AUTH_REQUIRED` | Thiếu header `Authorization` | Thêm `Bearer <token>` |
| `401` | `WEBHOOK_INVALID_TOKEN` | Token sai | Kiểm tra lại `WEBHOOK_SECRET` |
| `403` | `WEBHOOK_IP_FORBIDDEN` | IP không nằm trong whitelist | Liên hệ CRM admin |
| `404` | — | URL không đúng | Kiểm tra lại endpoint |
| `409` | `WEBHOOK_DUPLICATE_DELIVERY` | `X-Webhook-Delivery-Id` đã được xử lý | Không cần retry |
| `429` | `TOO_MANY_REQUESTS` | Vượt quá rate limit (100 req/phút) | Chờ và retry |

### Chiến lược Retry

- **Nên retry:** `429`, `500`, `502`, `503`
- **Không nên retry:** `401`, `403`, `409`
- **Khuyến nghị:** Exponential backoff (1s → 2s → 4s → 8s → ...), tối đa 5 lần

---

## 8. Code mẫu

### Node.js

```js
const CRM_URL = 'https://crm.example.com/api/v1/webhooks';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

async function sendWebhook(eventPath, payload) {
  const res = await fetch(`${CRM_URL}/${eventPath}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${WEBHOOK_SECRET}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  console.log(`[${res.status}]`, data);
  return data;
}

// Ví dụ: Gửi event "khách hàng mới"
sendWebhook('new-registration', {
  customer: {
    name: 'Nguyễn Văn A',
    email: 'nguyenvana@example.com',
    phone: '0901 234 567',
  },
});

// Ví dụ: Gửi event "tạo business mới"
sendWebhook('new-business', {
  customer: { email: 'nguyenvana@example.com' },
  biz: { id: 'BIZ-12345', tags: ['ecommerce'] },
});
```

### Python

```python
import requests

CRM_URL = 'https://crm.example.com/api/v1/webhooks'
WEBHOOK_SECRET = 'whsec_...'

def send_webhook(event_path: str, payload: dict):
    resp = requests.post(
        f'{CRM_URL}/{event_path}',
        json=payload,
        headers={
            'Authorization': f'Bearer {WEBHOOK_SECRET}',
        },
    )
    print(f'[{resp.status_code}] {resp.json()}')
    return resp.json()

# Ví dụ
send_webhook('new-registration', {
    'customer': {
        'name': 'Nguyễn Văn A',
        'email': 'nguyenvana@example.com',
    }
})
```

### cURL

```bash
curl -X POST https://crm.example.com/api/v1/webhooks/new-registration \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $WEBHOOK_SECRET" \
  -d '{"customer":{"name":"Nguyễn Văn A","email":"nguyenvana@example.com"}}'
```

---

## 9. FAQ

### Body gửi như thế nào?

**Gửi data trực tiếp** — không cần wrap. CRM xác định loại event từ URL.

```
POST /api/v1/webhooks/new-registration
Body: { "customer": { ... } }
```

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

Gửi 1 trong các cách sau trong body:

```json
// Cách 1: Gửi ID trực tiếp
{ "assigneeId": "USER001" }

// Cách 2: Gửi thông tin nested — CRM sẽ tự lookup
{ "assignee": { "email": "staff@company.com" } }
{ "assignee": { "name": "Nguyễn Văn B" } }
{ "assignee": { "phone": "0987654321" } }
```

CRM sẽ tìm nhân viên theo thứ tự ưu tiên: `id → email → name → phone`. Nếu không tìm thấy, event vẫn được tạo nhưng assignee sẽ không được liên kết.

### Rate limit bao nhiêu?

**100 requests / phút / IP.** Nếu vượt quá, bạn sẽ nhận `429 TOO_MANY_REQUESTS`.

---

## Checklist tích hợp

- [ ] Nhận `WEBHOOK_SECRET` từ CRM team
- [ ] Test với API `new-registration` trên môi trường staging
- [ ] Xác nhận response `201` và event xuất hiện trong CRM
