# ZCode External API — Tài Liệu Tích Hợp (Integration Spec)

> **Version:** 1.0  
> **Base URL:** `https://final.vn/api/external/v1/zcodes`  
> **Content-Type:** `application/json`

---

## Tổng Quan

ZCode External API cho phép hệ thống Thirdparty (Hệ thống B) gọi để **nạp mã ZCode** (redeem) khi người dùng cuối sử dụng mã trên hệ thống B.

### Luồng Tích Hợp

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Người dùng  │     │ Hệ thống B   │     │ CRM Server   │
│  (End User)  │     │ (Thirdparty) │     │ (ZCode API)  │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       │  1. Nhập mã ZCode  │                    │
       │  VD: F3YP-R8MJ     │                    │
       │───────────────────>│                    │
       │                    │                    │
       │                    │  2. POST /redeem   │
       │                    │  sku: ZB5000       │
       │                    │  partialCode:      │
       │                    │  F3YP-R8MJ         │
       │                    │───────────────────>│
       │                    │                    │
       │                    │  3. Response       │
       │                    │  partA: K9DV       │
       │                    │<───────────────────│
       │                    │                    │
       │  4. Xác nhận nạp   │                    │
       │  thành công        │                    │
       │<───────────────────│                    │
       │                    │                    │
```

### Quy Ước Mã ZCode

Mỗi mã ZCode có cấu trúc `PartA-PartB-PartC`, ví dụ: `K9DV-F3YP-R8MJ`.

| Phần | Ví dụ | Mô tả |
|------|-------|-------|
| **PartA** | `K9DV` | Phần bí mật — chỉ CRM Server biết, trả về sau khi redeem thành công |
| **PartB-PartC** | `F3YP-R8MJ` | Phần công khai — người dùng nhập trên Hệ thống B, gọi là `partialCode` |

---

## Authentication

### API Key

Mọi request phải gửi kèm header `X-API-Key` chứa API key do CRM cấp.

```
X-API-Key: <your_api_key>
```

> ⚠️ API key bị lộ sẽ bị thu hồi ngay lập tức. Không bao giờ lưu API key trong source code công khai.

### IP Whitelist

Server chỉ chấp nhận request từ các IP đã được đăng ký trước. Vui lòng cung cấp IP tĩnh (static IP) của server Hệ thống B để được thêm vào whitelist.

---

## Rate Limiting

| Thông số | Giá trị |
|----------|---------|
| Window | 1 phút |
| Max requests | 30 request/IP |
| Headers trả về | `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` |

Khi vượt quá limit, API trả về HTTP `429 Too Many Requests`.

---

## Idempotency (Tùy Chọn)

Để tránh nạp mã 2 lần trong trường hợp timeout hoặc retry, Hệ thống B có thể gửi header:

```
X-Idempotency-Key: <unique_request_id>
```

| Đặc tính | Chi tiết |
|----------|----------|
| Format | Chuỗi bất kỳ, tối đa 128 ký tự (VD: UUID v4, transaction ID) |
| TTL | 24 giờ — sau 24h, key hết hạn và có thể tái sử dụng |
| Hành vi | Nếu key đã xử lý → trả lại kết quả cũ kèm `"idempotent": true` |

---

## Endpoint

### `POST /redeem` — Nạp Mã ZCode

Gọi API này khi người dùng nhập mã ZCode trên Hệ thống B để đổi thưởng.

#### Request

```http
POST /api/external/v1/zcodes/redeem
Content-Type: application/json
X-API-Key: your_api_key_here
X-Idempotency-Key: txn_20260725_001 (tùy chọn)
```

**Body:**

| Field | Type | Required | Mô tả |
|-------|------|----------|-------|
| `sku` | string | ✅ | Gói mã. Các giá trị hợp lệ: `ZB5000`, `ZB10000`, `ZC10GB`, `ZC100GB`, `ZC500GB`, `ZC1T` |
| `partialCode` | string | ✅ | Phần PartB-PartC của mã ZCode. Format: `XXXX-XXXX` |

```json
{
  "sku": "ZB5000",
  "partialCode": "F3YP-R8MJ"
}
```

---

#### Responses

##### ✅ 200 — Nạp mã thành công

```json
{
  "success": true,
  "message": "Redeem successful",
  "data": {
    "partA": "K9DV",
    "sku": "ZB5000"
  }
}
```

| Field | Mô tả |
|-------|-------|
| `data.partA` | Phần bí mật của mã ZCode. Ghép với partialCode → mã đầy đủ: `K9DV-F3YP-R8MJ` |
| `data.sku` | Gói mã đã nạp |

##### ✅ 200 — Idempotent (request trùng lặp)

Nếu gửi lại cùng `X-Idempotency-Key` đã xử lý trước đó:

```json
{
  "success": true,
  "message": "Redeem successful",
  "data": {
    "partA": "K9DV",
    "sku": "ZB5000"
  },
  "idempotent": true
}
```

##### ❌ 400 — Lỗi Validation

```json
{
  "success": false,
  "message": "SKU không được để trống"
}
```

##### ❌ 400 — Mã Trùng Lặp (Duplicate Code)

Khi có nhiều mã cùng PartB-PartC trong hệ thống. Đây là lỗi dữ liệu phía CRM, không phải lỗi của Hệ thống B.

```json
{
  "success": false,
  "message": "Duplicate codes detected – matching codes have been marked as error",
  "code": "ZCODE_DUPLICATE_CODE"
}
```

##### ❌ 401 — API Key Không Hợp Lệ

```json
{
  "success": false,
  "message": "Invalid or missing X-API-Key",
  "code": "ZCODE_INVALID_API_KEY"
}
```

##### ❌ 403 — IP Không Được Phép

```json
{
  "success": false,
  "message": "IP address not allowed",
  "code": "ZCODE_IP_FORBIDDEN"
}
```

##### ❌ 403 — Mã Không Khả Dụng / Bị Khoá

```json
{
  "success": false,
  "message": "Code is unavailable",
  "code": "ZCODE_UNAVAILABLE"
}
```

##### ❌ 404 — Mã Không Tồn Tại

```json
{
  "success": false,
  "message": "Code not found",
  "code": "ZCODE_NOT_FOUND"
}
```

##### ❌ 409 — Mã Đã Được Sử Dụng

```json
{
  "success": false,
  "message": "Code already redeemed",
  "code": "ZCODE_ALREADY_REDEEMED"
}
```

##### ❌ 422 — Mã Bị Lỗi (Error State)

```json
{
  "success": false,
  "message": "Code is in error state",
  "code": "ZCODE_ERROR_STATE"
}
```

##### ❌ 429 — Quá Nhiều Request

```json
{
  "success": false,
  "message": "Too many redeem requests. Please try again after 1 minute."
}
```

---

## Ví Dụ Tích Hợp (Code Samples)

### Node.js (axios)

```javascript
const axios = require('axios');

const API_BASE = 'https://final.vn/api/external/v1/zcodes';
const API_KEY = 'your_api_key_here';

async function redeemZCode(sku, partialCode, requestId) {
  try {
    const response = await axios.post(
      `${API_BASE}/redeem`,
      { sku, partialCode },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
          'X-Idempotency-Key': requestId, // Tùy chọn
        },
        timeout: 10000, // 10 giây
      },
    );

    const { partA, sku: redeemedSku } = response.data.data;
    console.log(`✅ Nạp thành công! Mã đầy đủ: ${partA}-${partialCode}`);
    return { success: true, partA, sku: redeemedSku };
  } catch (error) {
    const data = error.response?.data;
    console.error(`❌ Lỗi: ${data?.message || error.message}`);
    
    // Xử lý theo mã lỗi
    switch (data?.code) {
      case 'ZCODE_NOT_FOUND':
        return { success: false, reason: 'Mã không tồn tại' };
      case 'ZCODE_ALREADY_REDEEMED':
        return { success: false, reason: 'Mã đã được sử dụng' };
      case 'ZCODE_UNAVAILABLE':
        return { success: false, reason: 'Mã đang bị khoá hoặc chưa kích hoạt' };
      case 'ZCODE_ERROR_STATE':
        return { success: false, reason: 'Mã bị lỗi trạng thái, vui lòng liên hệ admin' };
      case 'ZCODE_DUPLICATE_CODE':
        return { success: false, reason: 'Mã bị trùng lặp trong hệ thống, vui lòng liên hệ admin' };
      default:
        return { success: false, reason: data?.message || 'Lỗi không xác định' };
    }
  }
}

// Sử dụng
redeemZCode('ZB5000', 'F3YP-R8MJ', 'txn_20260725_001');
```

### cURL

```bash
curl -X POST https://final.vn/api/external/v1/zcodes/redeem \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key_here" \
  -H "X-Idempotency-Key: txn_20260725_001" \
  -d '{"sku":"ZB5000","partialCode":"F3YP-R8MJ"}'
```

---

## Khuyến Nghị Tích Hợp

1. **Luôn gửi `X-Idempotency-Key`** cho mỗi giao dịch nạp mã để tránh nạp 2 lần khi có timeout/retry.
2. **Set timeout ≤ 10 giây** cho mỗi request.
3. **Retry tối đa 3 lần** với backoff (1s → 2s → 4s) khi gặp lỗi mạng hoặc HTTP 5xx.
4. **Không retry** khi gặp HTTP 400, 401, 403, 404, 409, 422 — đây là lỗi logic, retry không giải quyết được.
5. **Lưu log** mọi response từ API để đối chiếu khi cần.

---

## Liên Hệ Hỗ Trợ

- Cung cấp IP tĩnh của server để được thêm vào whitelist
- Nhận API key qua kênh bảo mật (không gửi qua email không mã hóa)
- Liên hệ admin CRM khi gặp lỗi `ZCODE_DUPLICATE_CODE`
