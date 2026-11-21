# Invoice External API — Tài Liệu Tích Hợp Xuất Hoá Đơn Tự Động

> **Version:** 2.0 (Multi-Partner Isolation)  
> **Prod Base URL:** `https://final.vn/api/external/v1/invoices`  
> **Dev Base URL:** `https://crm-server-rvzz.onrender.com/api/external/v1/invoices`  
> **Local Base URL:** `http://localhost:4000/api/external/v1/invoices`  
> **Content-Type:** `application/json`  
> **Postman Collection:** `docs/Invoice_External_API.postman_collection.json`  
> **Hướng dẫn nội bộ thêm đối tác mới (Ops/Backend):** `docs/INVOICE_EXTERNAL_PARTNER_ONBOARDING.md`

---

## 1. Tổng Quan

**Invoice External API** cho phép **Key.vn (ZCode)** và các hệ thống đối tác bên thứ 3 được cấp quyền gọi sang CRM để **tự động tạo & phát hành Hoá đơn Điện tử (BKAV eHoaDon)** mà không cần thao tác thủ công.

### Cơ chế xử lý Hàng hoá (`items[]`) — 2 Nhánh Độc Lập

Mỗi phần tử trong `items[]` được hệ thống xử lý rõ ràng theo **2 nhánh**:

1. **Nhánh 1 — Có truyền ID / Mã liên quan đến Sản phẩm (`productId`, `id`, `itemCode`, hoặc `productCode`)**:
   - Hệ thống tra cứu sản phẩm đang hoạt động (`isActive = true`) trong tab **Hoá đơn → Sản phẩm** trên CRM.
   - Nếu không tìm thấy hoặc sản phẩm đang tạm ngưng → trả lỗi `400 Bad Request` ngay lập tức.
   - Nếu tìm thấy → **dùng toàn bộ thông tin cấu hình sẵn của sản phẩm đó trong DB** (`productId`, `itemCode`, `itemName`, `unitName`, `unitPrice`, `taxRate`, `taxRateId`, `itemTypeId`, `userDefineDetails`) kết hợp với `quantity` (mặc định `1`, phải `> 0`) để tính thành tiền và thuế GTGT.
2. **Nhánh 2 — Không truyền ID / Mã Sản phẩm (Gửi trực tiếp theo Template chuẩn)**:
   - Hệ thống **kiểm tra chặt chẽ toàn bộ các trường bắt buộc** theo từng loại dòng (`itemType` / `itemTypeId`: `"goods"`, `"vehicle"`, `"promotion"`, `"discount"`, `"note"`).
   - Nếu toàn bộ trường hợp lệ → điền đầy đủ vào từng mục của dòng hoá đơn và tự động suy ra `taxRateId` chuẩn BKAV + `amount` + `taxAmount`.
   - Nếu thiếu hoặc sai bất kỳ trường nào → trả lỗi `400 Bad Request` liệt kê rõ các trường bị thiếu/sai.

### Hỗ trợ Gửi Đơn Lẻ & Gửi Mảng Hàng Loạt (Batch Array)

- **Đơn lẻ (Single Object)**: Gửi body là 1 JSON Object `{ ... }` → Xuất 1 hoá đơn (`201 Created`, hoặc `200 OK` nếu trùng `sourceId`).
- **Hàng loạt (Batch Array)**: Gửi body là **1 JSON Array `[ {...}, {...} ]`** (hoặc `{ "invoices": [ {...}, {...} ] }`) → **Mỗi phần tử trong mảng xuất ra 1 hoá đơn riêng biệt** (tối đa **30 hoá đơn / request**). Lỗi ở một phần tử không ảnh hưởng đến các phần tử còn lại.

### Luồng Tích Hợp

```text
┌──────────────────────┐       ┌──────────────────────────┐       ┌─────────────────┐
│ Key.vn / 3rd-party   │       │ CRM Server               │       │ BKAV eHoaDon    │
└──────────┬───────────┘       └────────────┬─────────────┘       └────────┬────────┘
           │                                │                              │
           │  1. (Tuỳ chọn) GET /products   │                              │
           │     hoặc GET /template         │                              │
           │───────────────────────────────>│                              │
           │                                │                              │
           │  2. POST /api/external/v1/invoices                            │
           │     Headers: X-API-Key, X-Partner-Id, X-Idempotency-Key       │
           │     Body: { ... } hoặc [ {...}, {...} ]                       │
           │───────────────────────────────>│                              │
           │                                │  3. Auth Partner + IP Check  │
           │                                │  4. Resolve Items (2 nhánh)  │
           │                                │  5. Đẩy HĐ & ký HSM (nếu bật)│
           │                                │─────────────────────────────>│
           │                                │<─────────────────────────────│
           │  6. Trả mã HĐ, Số HĐ, MTC      │                              │
           │<───────────────────────────────┘                              │
```

---

## 2. Xác Thực Đa Đối Tác, Bảo Mật & Giới Hạn

Mỗi đối tác tích hợp được CRM cấp **API Key riêng** và **IP Allowlist riêng** (cô lập hoàn toàn giữa các đối tác).

### 2.1. Headers Bắt Buộc & Khuyến Nghị

| Header | Bắt buộc | Mô tả |
| --- | --- | --- |
| `X-API-Key` | ✅ Bắt buộc | API Key bí mật riêng của đối tác do CRM cấp (so sánh bằng `crypto.timingSafeEqual`). |
| `X-Partner-Id` | Khuyến nghị | Mã định danh đối tác do CRM cấp (vd: `keyvn` / `zcode` cho Key.vn, hoặc mã định danh của đối tác mới). Khi gửi kèm header này, server bắt buộc `X-API-Key` phải khớp đúng của đối tác đó. |
| `X-Idempotency-Key` | Khuyến nghị cho `POST` | Khoá chống trùng lặp cấp request (tối đa 128 ký tự, TTL 24 giờ, tự động cô lập namespace theo từng đối tác `inv_ext:<partnerId>:<key>`). |

### 2.2. IP Whitelist Riêng Theo Từng Đối Tác

- Mỗi đối tác có danh sách IP được phép (`allowedIps`) cấu hình riêng trên CRM Server.
- Nếu request mang `X-API-Key` của đối tác A nhưng xuất phát từ IP không nằm trong allowlist của đối tác A → server chặn ngay với HTTP `403 Forbidden` (`code: "<SYSTEM>_IP_FORBIDDEN"`).

### 2.3. Rate Limiting

| Thông số | Giá trị |
| --- | --- |
| Window | 1 phút (60 giây) |
| Max requests | 60 request / phút / IP |
| Headers trả về | `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` |
| Khi vượt giới hạn | HTTP `429 Too Many Requests` (`code: "INVOICE_EXTERNAL_RATE_LIMITED"`) |

### 2.4. Chống Trùng Lặp 2 Lớp (Idempotency) — **Rất Khuyến Nghị**

1. **Lớp 1 — Cấp HTTP Request (`X-Idempotency-Key`)**:
   - Gửi header `X-Idempotency-Key: <unique_id>` (TTL 24 giờ, namespace riêng từng đối tác).
   - Nếu gửi lại cùng key trong 24h → CRM trả lại đúng HTTP status & response cũ kèm `"idempotent": true`, **không gọi lại BKAV**.
2. **Lớp 2 — Cấp Từng Hoá Đơn (`sourceId` / `externalRef` / `billCode`)**:
   - Gửi mã đơn hàng duy nhất của bên bạn vào `sourceId` (và/hoặc `billCode`).
   - Nếu CRM đã có hoá đơn chưa bị huỷ/thay thế cho cùng `(sourceModule, sourceId/billCode)` → trả về hoá đơn hiện có kèm `"duplicate": true` thay vì tạo mới.
   - Rất an toàn cho **Batch Array**: nếu gửi 10 đơn bị timeout mạng ở đơn thứ 6, retry lại cả mảng 10 đơn sẽ bỏ qua đơn 1–5 (trả về HĐ cũ) và chỉ xuất mới đơn 6–10.

---

## 3. Danh Sách Endpoints

| STT | Method | Endpoint | Mô tả |
| --- | --- | --- | --- |
| 1 | `GET` | `/api/external/v1/invoices/template` | Lấy cấu trúc JSON mẫu, bảng Enum (`itemType`, `taxRate`, `paymentMethod`, `buyerType`) và preview danh sách SKU đang hoạt động |
| 2 | `GET` | `/api/external/v1/invoices/products` | Lấy toàn bộ danh mục Sản phẩm (SKU) đang kích hoạt (`isActive = true`) để đồng bộ |
| 3 | `POST` | `/api/external/v1/invoices` | Tạo & phát hành **1 hoá đơn** (gửi Object) hoặc **nhiều hoá đơn riêng lẻ** (gửi Array / `{ invoices: [...] }`, tối đa 30 HĐ/request) |
| 4 | `GET` | `/api/external/v1/invoices/:id` | Tra cứu trạng thái, số hoá đơn, mã tra cứu (MTC), mã CQT theo `id` CRM (`INV-...`), `sourceId`, hoặc `billCode` |

---

## 4. Đặc Tả Chi Tiết Trường Dữ Liệu & Enum

### 4.1. Cấu trúc 1 Hoá đơn (Invoice Object)

| Field | Kiểu | Bắt buộc | Mặc định | Chú thích chi tiết |
| --- | --- | --- | --- | --- |
| `sourceId` | `string` | **Khuyến nghị** | `null` | Mã đơn hàng / mã giao dịch duy nhất bên đối tác (dùng chống trùng lặp & tra cứu lại). Có thể gửi qua alias `externalRef`. |
| `externalRef` | `string` | Không | `null` | Alias của `sourceId` (dùng khi không truyền `sourceId`). |
| `billCode` | `string` | Không | `= sourceId` | Mã chứng từ hiển thị trên hoá đơn BKAV. |
| `sourceModule` | `string` | Không | Tự suy từ đối tác | Nguồn phát sinh hoá đơn (vd: `"zcode"` cho Key.vn, hoặc mã đối tác tương ứng). |
| `providerId` | `string` | Không | NCC mặc định | ID Nhà cung cấp trên CRM (vd: `"IPR-..."`). Bỏ trống để CRM tự chọn NCC mặc định đang hoạt động. |
| `isDraft` | `boolean` | Không | `false` | `false` = tạo và đẩy sang BKAV ngay (tự ký HSM nếu NCC bật `autoSign`, hoặc `pending_sign` chờ ký USB Token); `true` = chỉ lưu nháp (`draft`) trên CRM. |
| `invoiceDate` | `string (ISO 8601)` | Không | Hiện tại | Ngày lập hoá đơn (vd: `"2026-11-20T04:00:00.000Z"`). |
| `invoiceForm` | `string` | Không | Theo NCC | Mẫu số hoá đơn (chỉ truyền khi cần ghi đè cấu hình NCC). |
| `invoiceSerial` | `string` | Không | Theo NCC | Ký hiệu hoá đơn (chỉ truyền khi cần ghi đè cấu hình NCC). |
| `paymentMethod` | `string` | Không | `"TM/CK"` | Hình thức thanh toán: `"TM"` (Tiền mặt), `"CK"` (Chuyển khoản), `"TM/CK"` (Tiền mặt / Chuyển khoản). |
| `currency` | `string` | Không | `"VND"` | Loại tiền tệ (vd: `"VND"`, `"USD"`). |
| `exchangeRate` | `number` | Không | `1` | Tỷ giá quy đổi (`>= 0`). |
| `note` | `string` | Không | `""` | Ghi chú chung cấp hoá đơn. |
| `userDefine` | `string` | Không | `""` | Trường mở rộng cấp header hoá đơn gửi BKAV. |
| `buyer` | `object` | Nên có | `{ name: "Khách lẻ" }` | Thông tin người mua (xem Bảng 4.2). |
| `items` | `array<object>` | ✅ (≥ 1 dòng) | — | Danh sách dòng hàng hoá / dịch vụ (xem Bảng 4.3). |

### 4.2. Thông tin Người Mua (`buyer`)

Hệ thống tự động chuẩn hoá dữ liệu người mua gửi sang BKAV theo `buyer.type` (chuẩn Nghị định 123/2020/NĐ-CP & 70/2025/NĐ-CP):

| Field | Kiểu | Doanh nghiệp (`company`) | Cá nhân (`personal`) | Mặc định | Chú thích chi tiết |
| --- | --- | --- | --- | --- | --- |
| `type` | `string` | `"company"` | `"personal"` | `"company"` | Phân loại người mua: `"company"` (Doanh nghiệp / Tổ chức / Hộ KD) hoặc `"personal"` (Cá nhân / Khách lẻ). |
| `taxCode` | `string` | **Nên có (bắt buộc theo CQT)** | Tuỳ chọn | `""` | Mã số thuế (10 hoặc 14 số). Nếu Hộ KD/cá nhân dùng CCCD 12 số truyền vào `taxCode`, CRM tự đồng bộ sang trường `CCCD` khi gửi BKAV. |
| `unitName` | `string` | **Nên có (bắt buộc theo CQT)** | **Không cần** *(tự bỏ trống)* | `""` | Tên đơn vị / doanh nghiệp (`BuyerUnitName`). Với `personal`, CRM luôn gửi `BuyerUnitName = ""` để không in dòng Đơn vị lên hoá đơn cá nhân. Với `company`, nếu `unitName` trống nhưng có `name`, CRM fallback sang `name`. |
| `address` | `string` | **Nên có (bắt buộc theo CQT)** | Tuỳ chọn | `""` | Địa chỉ trụ sở (doanh nghiệp) hoặc địa chỉ liên hệ (cá nhân). |
| `name` | `string` | Tuỳ chọn *(người mua hàng)* | **Nên có** *(Họ và tên)* | `""` | Họ tên người mua hàng (`BuyerName`). Nếu cả `name` và `unitName` đều trống → CRM tự gán `"Khách lẻ"`. |
| `cccd` | `string` | Tuỳ chọn | Tuỳ chọn *(nên truyền nếu có)* | `""` | Số Căn cước công dân / Định danh cá nhân 12 chữ số (map sang trường `CCCD` của BKAV). |
| `email` | `string` | Tuỳ chọn *(khuyến nghị)* | Tuỳ chọn *(khuyến nghị)* | `""` | Email nhận thông báo & bản thể hiện hoá đơn điện tử (phải đúng định dạng email hợp lệ nếu truyền, hoặc `""`). |
| `phone` | `string` | Tuỳ chọn | Tuỳ chọn | `""` | Số điện thoại người mua. |
| `code` | `string` | Tuỳ chọn | Tuỳ chọn | `""` | Mã khách hàng (`BuyerCode` trên BKAV). |
| `bankAccount` | `string` | Tuỳ chọn | Tuỳ chọn | `""` | Số tài khoản ngân hàng người mua. |

> **Lưu ý quy đổi sang BKAV (`_buildBkavBuyerFields`):**
> - Khi `buyer.type = "company"`: `BuyerUnitName = unitName || name`, `BuyerName = name`, `BuyerTaxCode = taxCode`, `CCCD = cccd` (hoặc tự lấy từ `taxCode` nếu dài 12 chữ số).
> - Khi `buyer.type = "personal"`: `BuyerUnitName = ""` (luôn trống), `BuyerName = name`, mã 12 chữ số được đưa vào trường `CCCD`, MST 10/14 số đưa vào `BuyerTaxCode`.

### 4.3. Chi tiết Hàng hoá / Dịch vụ (`items[]`) — 2 Nhánh

#### Nhánh 1 — Có gửi ID / Mã Sản phẩm (`productId`, `id`, `itemCode`, hoặc `productCode`)

- Hệ thống tra cứu sản phẩm đang kích hoạt (`isActive = true`) trong danh mục **Sản phẩm** trên CRM.
- Nếu không tìm thấy hoặc sản phẩm đang tạm ngưng → trả lỗi `400 Bad Request`.
- Nếu tìm thấy → **dùng 100% thông tin cấu hình sẵn của sản phẩm trong DB** (`productId`, `itemCode`, `itemName`, `unitName`, `unitPrice`, `taxRate`, `taxRateId`, `itemTypeId`, `userDefineDetails`) kết hợp với `quantity` (mặc định `1`, phải `> 0`) để tính thành tiền và thuế.

| Field | Kiểu | Bắt buộc | Mặc định | Chú thích chi tiết |
| --- | --- | --- | --- | --- |
| `productId` (hoặc `id`) | `string` | 1 trong 2 (`productId` hoặc `itemCode`) | — | ID sản phẩm trên CRM (vd: `"IVP-20261118-0001"`). Lấy từ `GET /products`. |
| `itemCode` (hoặc `productCode`) | `string` | 1 trong 2 (`productId` hoặc `itemCode`) | — | Mã SKU sản phẩm trên CRM (vd: `"ZB5000"`). Không phân biệt hoa/thường. |
| `quantity` | `number` | Không | `1` | Số lượng (`> 0`). |
| `discountRate` | `number` | Không | `0` | Phần trăm chiết khấu trên dòng (`0`–`100`). |
| `discountAmount` | `number` | Không | Tự tính | Số tiền chiết khấu trên dòng (`>= 0`). |

#### Nhánh 2 — Không gửi ID / Mã Sản phẩm (Gửi trực tiếp theo Template)

Hệ thống kiểm tra **đầy đủ toàn bộ trường bắt buộc** theo loại dòng (`itemType` / `itemTypeId`). Thiếu hoặc sai bất kỳ trường nào sẽ trả `400 Bad Request`:

| Loại dòng (`itemType` / `itemTypeId`) | Các trường BẮT BUỘC phải truyền & hợp lệ | Các trường CRM tự tính / chuẩn hoá |
| --- | --- | --- |
| `"goods"` (`0`, mặc định) — Hàng hoá / dịch vụ | `itemName`, `unitName`, `quantity (> 0)`, `unitPrice (>= 0)`, `taxRate` (`0, 5, 8, 10, -1, -2, -4`) | `amount = round(quantity × unitPrice)`, `taxRateId` (chuẩn BKAV), `taxAmount` |
| `"vehicle"` (`21`) — Xe ô tô / mô tô | Toàn bộ 5 trường của `"goods"` **+** `userDefineDetails` (Object hoặc JSON string chứa `SKhung`, `SMay`) | Tự `JSON.stringify(userDefineDetails)` nếu gửi Object |
| `"promotion"` (`15`) — Hàng khuyến mãi | `itemName`, `unitName`, `quantity (> 0)` | Ép `unitPrice = 0`, `amount = 0`, `taxRate = 0`, `taxRateId = 1`, `taxAmount = 0` |
| `"discount"` (`30`) — Chiết khấu thương mại | `itemName` **+** (`amount > 0` hoặc cặp `quantity > 0` & `unitPrice > 0`) | Ép `isDiscount = true`, `taxRate = 0`, `taxRateId = 1`, `taxAmount = 0`; trừ vào tổng tiền trước thuế |
| `"note"` (`4`) — Dòng ghi chú | `itemName` | Ép `quantity = 0`, `unitPrice = 0`, `amount = 0`, `taxRate = 0`, `taxAmount = 0` |

### 4.4. Bảng Quy Đổi Thuế Suất (`taxRate` → `taxRateId` chuẩn BKAV)

| `taxRate` | `taxRateId` (BKAV) | Diễn giải |
| --- | --- | --- |
| `10` | `3` | Thuế suất GTGT 10% |
| `8` | `9` | Thuế suất GTGT 8% |
| `5` | `2` | Thuế suất GTGT 5% |
| `0` | `1` | Thuế suất GTGT 0% (`taxAmount = 0`) |
| `-1` | `4` | Không chịu thuế — KCT (`taxAmount = 0`) |
| `-2` | `5` | Không kê khai nộp thuế — KKK (`taxAmount = 0`) |
| `-4` | `6` | Thuế suất khác |

---

## 5. Ví Dụ Gọi API Chi Tiết

### 5.1. `GET /api/external/v1/invoices/template` — Lấy Template & Enum

```bash
curl -X GET "https://final.vn/api/external/v1/invoices/template" \
  -H "X-Partner-Id: keyvn" \
  -H "X-API-Key: <YOUR_API_KEY>"
```

### 5.2. `GET /api/external/v1/invoices/products` — Lấy Danh Sách Sản Phẩm (SKU)

```bash
curl -X GET "https://final.vn/api/external/v1/invoices/products" \
  -H "X-Partner-Id: keyvn" \
  -H "X-API-Key: <YOUR_API_KEY>"
```

**Response `200 OK`:**
```json
{
  "statusCode": 200,
  "message": "Lấy danh mục sản phẩm hoá đơn thành công",
  "data": [
    {
      "id": "IVP-20261118-0001",
      "code": "ZB5000",
      "name": "Gói ZCode ZB5000",
      "unitName": "Gói",
      "unitPrice": 500000,
      "taxRate": 10,
      "taxRateId": 3,
      "itemTypeId": 0,
      "description": "",
      "userDefineDetails": ""
    }
  ]
}
```

### 5.3. `POST /api/external/v1/invoices` — Tạo & Xuất Hoá Đơn

#### Ví dụ A — Key.vn tạo 1 hoá đơn theo mã SKU có sẵn (Nhánh 1)

```bash
curl -X POST "https://final.vn/api/external/v1/invoices" \
  -H "Content-Type: application/json" \
  -H "X-Partner-Id: keyvn" \
  -H "X-API-Key: <KEYVN_API_KEY>" \
  -H "X-Idempotency-Key: keyvn-ord-20261120-001" \
  -d '{
    "sourceId": "KEYVN-ORD-20261120-001",
    "billCode": "KEYVN-ORD-20261120-001",
    "paymentMethod": "CK",
    "buyer": {
      "type": "company",
      "name": "Nguyễn Văn A",
      "unitName": "CÔNG TY TNHH ABC",
      "taxCode": "0101234567",
      "address": "123 Cầu Giấy, Hà Nội",
      "email": "ketoan@abc.vn",
      "phone": "0901234567"
    },
    "items": [
      {
        "itemCode": "ZB5000",
        "quantity": 2
      }
    ]
  }'
```

**Response `201 Created`:**
```json
{
  "statusCode": 201,
  "message": "Tạo hoá đơn thành công",
  "data": {
    "id": "INV-20261120-0001",
    "status": "pending_sign",
    "providerId": "IPR-20261110-0001",
    "providerType": "bkav",
    "invoiceForm": "1",
    "invoiceSerial": "C26MVK",
    "invoiceNo": 15,
    "invoiceDate": "2026-11-20T05:00:00.000Z",
    "lookupCode": "UBOXN28UY9",
    "lookupUrl": "https://final.vn/tra-cuu-hoa-don/UBOXN28UY9",
    "maCuaCQT": "",
    "billCode": "KEYVN-ORD-20261120-001",
    "sourceModule": "zcode",
    "sourceId": "KEYVN-ORD-20261120-001",
    "totalAmountBeforeTax": 1000000,
    "totalDiscountAmount": 0,
    "totalTaxAmount": 100000,
    "totalAmount": 1100000,
    "currency": "VND",
    "providerErrorMessage": null,
    "duplicate": false
  }
}
```

> **Giải thích `data.status`**:
> - `"draft"`: Đã lưu nháp trên CRM (`isDraft: true` hoặc CmdType chưa cấp số).
> - `"pending_sign"`: Đã tạo & cấp số trên BKAV, đang chờ ký số (USB Token hoặc HSM retry).
> - `"issued"`: Đã ký số HSM và phát hành thành công lên CQT.
> - `"error"`: Lỗi từ nhà cung cấp BKAV (xem chi tiết tại `data.providerErrorMessage`).

#### Ví dụ B — Gửi hàng hoá tự định nghĩa theo Template (Nhánh 2: Goods + Promotion + Discount + Note)

```json
{
  "sourceId": "PARTNER-ORD-20261120-009",
  "paymentMethod": "TM/CK",
  "buyer": {
    "type": "personal",
    "name": "Trần Thị B",
    "email": "tranthib@gmail.com",
    "phone": "0988888888"
  },
  "items": [
    {
      "itemType": "goods",
      "itemName": "Gói phần mềm quản lý 12 tháng",
      "unitName": "Gói",
      "quantity": 1,
      "unitPrice": 2000000,
      "taxRate": 8
    },
    {
      "itemType": "promotion",
      "itemName": "Tặng thêm 1 tháng sử dụng",
      "unitName": "Tháng",
      "quantity": 1
    },
    {
      "itemType": "discount",
      "itemName": "Chiết khấu thanh toán sớm",
      "amount": 200000
    },
    {
      "itemType": "note",
      "itemName": "Mã đơn hàng: PARTNER-ORD-20261120-009"
    }
  ]
}
```

#### Ví dụ C — Gửi mảng (Batch Array) — Mỗi phần tử xuất 1 hoá đơn riêng (Tối đa 30 HĐ/request)

```bash
curl -X POST "https://final.vn/api/external/v1/invoices" \
  -H "Content-Type: application/json" \
  -H "X-Partner-Id: keyvn" \
  -H "X-API-Key: <KEYVN_API_KEY>" \
  -H "X-Idempotency-Key: keyvn-batch-20261120-01" \
  -d '[
    {
      "sourceId": "KEYVN-ORD-101",
      "buyer": { "type": "personal", "name": "Khách A", "email": "a@example.com" },
      "items": [{ "itemCode": "ZB5000", "quantity": 1 }]
    },
    {
      "sourceId": "KEYVN-ORD-102",
      "buyer": {
        "type": "company",
        "name": "Khách B",
        "unitName": "CÔNG TY XYZ",
        "taxCode": "0309999999",
        "address": "TP.HCM",
        "email": "b@xyz.vn"
      },
      "items": [
        {
          "itemType": "goods",
          "itemName": "Phí dịch vụ triển khai",
          "unitName": "Gói",
          "quantity": 1,
          "unitPrice": 1500000,
          "taxRate": 10
        },
        { "itemType": "note", "itemName": "Xuất tự động theo lô" }
      ]
    }
  ]'
```

### 5.4. `GET /api/external/v1/invoices/:id` — Tra Cứu Hoá Đơn

Truyền `id` CRM (`INV-...`), `sourceId`, hoặc `billCode`:

```bash
curl -X GET "https://final.vn/api/external/v1/invoices/KEYVN-ORD-20261120-001" \
  -H "X-Partner-Id: keyvn" \
  -H "X-API-Key: <KEYVN_API_KEY>"
```

---

## 6. Mã Lỗi Thường Gặp

| HTTP Status | `code` / Thông báo | Nguyên nhân & Cách xử lý |
| --- | --- | --- |
| `400` | `Không tìm thấy sản phẩm đang hoạt động với mã SKU "..."` | Truyền `itemCode`/`productId` (Nhánh 1) nhưng SKU chưa tạo hoặc đang tắt trên CRM → kiểm tra qua `GET /products` |
| `400` | `Dòng hàng hoá tự định nghĩa (không truyền productId/itemCode) thiếu hoặc không hợp lệ các trường: ...` | Truyền dòng tự định nghĩa (Nhánh 2) nhưng thiếu trường bắt buộc theo loại dòng → bổ sung đủ theo Bảng 4.3 |
| `400` | `Chỉ được gửi tối đa 30 hoá đơn mỗi request` | Chia nhỏ mảng thành các batch ≤ 30 phần tử |
| `401` | `INVOICE_EXTERNAL_INVALID_API_KEY` | Thiếu hoặc sai `X-API-Key`, hoặc `X-API-Key` không khớp với `X-Partner-Id` |
| `403` | `<SYSTEM>_IP_FORBIDDEN` *(vd: `ZCODE_IP_FORBIDDEN`)* | IP máy chủ gọi sang chưa nằm trong danh sách IP allowlist riêng của đối tác |
| `404` | `Không tìm thấy hoá đơn "..."` | Mã tra cứu không tồn tại, không thuộc đối tác đang gọi, hoặc đã bị xoá |
| `409` | `INVOICE_EXTERNAL_IN_PROGRESS` | Đang có 1 request khác cùng `X-Idempotency-Key` đang xử lý trên BKAV — chờ vài giây rồi thử lại |
| `429` | `INVOICE_EXTERNAL_RATE_LIMITED` | Vượt quá 60 request / phút / IP |

---

## 7. Cấu Hình Đối Tác Mới (Nội bộ CRM)

Để thêm bất kỳ đối tác thứ 3 mới nào (với API Key & IP Allowlist tách biệt hoàn toàn mà không cần sửa code), xem hướng dẫn chi tiết từng bước tại:

👉 **[`docs/INVOICE_EXTERNAL_PARTNER_ONBOARDING.md`](./INVOICE_EXTERNAL_PARTNER_ONBOARDING.md)**
