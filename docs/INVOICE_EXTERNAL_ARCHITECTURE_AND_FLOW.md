# Kiến Trúc & Luồng Xử Lý Chi Tiết: External Invoice API (Tài Liệu Nội Bộ CRM)

> **Mục đích:** Tài liệu lưu trữ nội bộ giúp đội ngũ Backend / Tech Lead đọc hiểu nhanh toàn bộ kiến trúc, cơ chế bảo mật đa đối tác, chống trùng lặp (Idempotency), phân giải hàng hoá 2 nhánh, tối ưu Batch Array và giao tiếp BKAV eHoaDon của module Hoá đơn.  
> **Các tài liệu liên quan:**
> - Hướng dẫn gửi cho Dev Đối tác (Đơn giản, dễ hiểu): `docs/INVOICE_PARTNER_QUICKSTART.md`
> - Đặc tả API đầy đủ (Reference): `docs/INVOICE_EXTERNAL_API_SPEC.md`
> - Quy trình Onboard đối tác mới (Ops/DevOps): `docs/INVOICE_EXTERNAL_PARTNER_ONBOARDING.md`
> - Postman Collection cho đối tác: `docs/Invoice_External_API.postman_collection.json`

---

## 1. Sơ Đồ Tổng Quan Luồng Đi Của 1 Request

```text
[Đối tác 3rd-Party (Key.vn / Partner X)]
       │
       │  HTTP Request (Headers: X-API-Key, X-Partner-Id, X-Idempotency-Key)
       ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ TẦNG 1: ROUTE & MIDDLEWARE PIPELINE (src/routes/external/v1/invoices.routes.js)
│  1.1. externalInvoiceLimiter       → Giới hạn 60 req/phút/IP thật          │
│  1.2. externalApiLogger            → Bắt đầu đo thời gian & ghi Audit Log  │
│  1.3. authenticateExternalPartner  → Xác thực API Key + IP Whitelist riêng │
│  1.4. verifyExternalIdempotency    → Chống trùng lặp Lớp 1 (Atomic Lock)   │
└───────────────────────────────────────┬────────────────────────────────────┘
                                        │ (Gắn req.externalCaller, req.externalPartner)
                                        ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ TẦNG 2: PHÂN LUỒNG ĐƠN LẺ vs. MẢNG HÀNG LOẠT (src/modules/invoice/invoice.service.js)
│  • Nếu gửi 1 Object {...}          → Chế độ Single (lỗi thì throw 400 ngay)│
│  • Nếu gửi Array [{...}, {...}]    → Chế độ Batch (tối đa 30 HĐ/request):  │
│      - Prefetch toàn bộ Product 1 lần ($in) + Singleflight Provider Cache  │
│      - Chạy song song 4 worker (Bounded Concurrency = 4)                   │
│      - Cô lập lỗi: Đơn nào lỗi chỉ đánh dấu lỗi đơn đó, đơn khác vẫn xuất │
└───────────────────────────────────────┬────────────────────────────────────┘
                                        │
                                        ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ TẦNG 3: XỬ LÝ TỪNG HOÁ ĐƠN (_createSingleExternalInvoice)                  │
│  3.1. Ép cứng sourceModule = caller (chống giả mạo đối tác)                │
│  3.2. In-flight Mutex Lock theo (sourceModule + sourceId/billCode)         │
│  3.3. Chống trùng lặp Lớp 2: Kiểm tra DB xem đơn hàng đã xuất HĐ chưa      │
│  3.4. Chọn Nhà cung cấp HĐĐT (theo providerId hoặc NCC Mặc định)           │
│  3.5. Phân giải Hàng hoá 2 Nhánh (_resolveItems):                          │
│       ├─ Nhánh 1 (Có productId/id/itemCode/productCode): Lấy 100% từ DB    │
│       └─ Nhánh 2 (Không có mã SP): Validate đủ field theo từng loại dòng   │
│  3.6. Tính toán Tổng tiền hàng, Chiết khấu, Tiền thuế VAT (_calculateTotals)│
│  3.7. Lưu bản ghi Invoice vào MongoDB (INV-YYYYMMDD-XXXX)                  │
└───────────────────────────────────────┬────────────────────────────────────┘
                                        │
                    ┌───────────────────┴───────────────────┐
              isDraft = true                          isDraft = false (Mặc định)
                    │                                       │
                    ▼                                       ▼
      [Trả về HĐ trạng thái "draft"]        ┌────────────────────────────────┐
      (Chưa gọi sang BKAV)                  │ TẦNG 4: PHÁT HÀNH SANG BKAV    │
                                            │  4.1. GZip + AES-256-CBC +POST │
                                            │       CmdType 112 (Cấp số HĐ)  │
                                            │  4.2. Nếu NCC bật autoSign:    │
                                            │       Gọi tiếp CmdType 205     │
                                            │       (Ký số HSM tự động)      │
                                            │  4.3. Ghi providerCallLogs     │
                                            └───────────────┬────────────────┘
                                                            │
                                                            ▼
                                     [Cập nhật trạng thái: "issued" / "pending_sign" / "error"]
                                     [Lưu kết quả vào Idempotency Cache + Ghi SystemLog & ExternalApiLog]
```

---

## 2. Chi Tiết Từng Tầng Xử Lý & Vị Trí Source Code

### Tầng 1: Bảo mật, Định danh Đa Đối tác & Chống Trùng Lặp Cấp Request

- **Files liên quan:**
  - `src/routes/external/v1/invoices.routes.js`
  - `src/core/config/env.js` (`buildInvoiceExternalPartners`)
  - `src/core/middleware/externalInvoiceAuth.js`
  - `src/core/middleware/rateLimiter.js` (`externalInvoiceLimiter`)
  - `src/core/middleware/externalApiLogger.js`

1. **Rate Limiting (`externalInvoiceLimiter`):**
   - Sử dụng `keyGenerator: (req) => getClientIp(req) || req.ip` để lấy đúng IP thật của đối tác sau Cloudflare/Reverse Proxy (`CF-Connecting-IP` → `X-Forwarded-For` → `req.ip`).
   - Giới hạn **60 requests / phút / IP**. Khi vượt ngưỡng, trả về `429 INVOICE_EXTERNAL_RATE_LIMITED`.

2. **Định danh & Xác thực Đa Đối tác (`authenticateExternalInvoicePartner`):**
   - **Cơ chế nạp cấu hình đối tác (`buildInvoiceExternalPartners` trong `env.js`):**
     - Mặc định nạp đối tác `keyvn` (dùng `KEYVN_API_KEY || ZCODE_API_KEY` và `KEYVN_ALLOWED_IPS || ZCODE_ALLOWED_IPS`, gắn `sourceModule: "zcode"`, `system: "ZCODE"`).
     - **Auto-Discovery:** Tự động quét mọi cặp biến môi trường `INVOICE_PARTNER_<NAME>_API_KEY` và `INVOICE_PARTNER_<NAME>_ALLOWED_IPS` (kèm tuỳ chọn `_SOURCE_MODULE`, `_SYSTEM`), hoặc JSON `INVOICE_EXTERNAL_PARTNERS`. Khi có đối tác mới, chỉ cần thêm biến môi trường và restart server, không cần sửa code.
   - **Kiểm tra `X-API-Key` & `X-Partner-Id`:**
     - Nếu request có header `X-Partner-Id` (vd: `keyvn`), hệ thống tra cứu đúng đối tác đó và so sánh `X-API-Key` bằng `crypto.timingSafeEqual` (chống timing attack). Nếu dùng key của đối tác A nhưng gửi `X-Partner-Id` của đối tác B → trả `401 INVOICE_EXTERNAL_INVALID_API_KEY`.
     - Nếu không gửi `X-Partner-Id`, hệ thống dò `X-API-Key` qua danh sách đối tác đã cấu hình.
   - **Kiểm tra IP Allowlist riêng từng đối tác (`isIpAllowedForPartner`):**
     - Tự động chuẩn hoá IPv4-mapped IPv6 (`::ffff:103.1.2.3` → `103.1.2.3`) và hỗ trợ cả IP đơn lẻ lẫn dải mạng **CIDR** (vd: `103.112.10.0/24`).
     - Nếu IP gọi sang không nằm trong `allowedIps` của đối tác khớp key → chặn ngay với `403 <SYSTEM>_IP_FORBIDDEN`.
   - Sau khi xác thực thành công: gắn `req.externalPartner = matchedPartner` và `req.externalCaller = matchedPartner.sourceModule`.

3. **Chống trùng lặp Lớp 1 — Cấp HTTP Request (`verifyExternalInvoiceIdempotency`):**
   - Nếu đối tác gửi header `X-Idempotency-Key: <key>`, CRM ghép namespace theo từng đối tác: `inv_ext:<partnerId>:<key>` (lưu trong collection `ZCodeIdempotencyKey`, tự xoá sau **24 giờ** qua TTL index).
   - **Atomic Lock chống Race Condition (TOCTOU):**
     - Ngay khi bắt đầu xử lý, middleware gọi `ZCodeIdempotencyKey.create({ key, status: 'processing' })` **trước khi** gọi BKAV.
     - Nếu 1 request thứ 2 trùng `X-Idempotency-Key` gửi đến **trong lúc** request đầu tiên đang chờ BKAV (1–5 giây), MongoDB sẽ ném lỗi trùng unique key (`11000`) với `status === 'processing'` → trả ngay `409 INVOICE_EXTERNAL_IN_PROGRESS`, ngăn chặn tuyệt đối việc xuất trùng 2 hoá đơn lên BKAV.
     - Khi request đầu tiên hoàn tất, controller gọi `saveExternalInvoiceIdempotency` để cập nhật `status: 'completed'`, `responseStatus`, `responseBody`. Mọi lần retry tiếp theo trong 24h sẽ nhận lại đúng response đã cache kèm cờ `"idempotent": true`.
     - Nếu request đầu tiên bị lỗi bất ngờ trước khi lưu kết quả hoàn tất, hook `res.on('finish')` tự động xoá bản ghi `processing` (`releaseExternalInvoiceIdempotency`) để đối tác có thể retry lại bình thường.

---

### Tầng 2: Phân Luồng Đơn Lẻ (Single) vs. Mảng Hàng Loạt (Batch Array)

- **File xử lý:** `src/modules/invoice/invoice.service.js` (`createExternalInvoices`)

1. **Chế độ Đơn lẻ (Single Object):**
   - Khi `req.body` là 1 JSON Object `{ ... }`:
     - Validate qua `externalCreateInvoiceSchema`. Nếu có lỗi → trả `400 Bad Request` ngay.
     - Gọi `_createSingleExternalInvoice` → Trả HTTP `201 Created` (hoặc `200 OK` nếu trùng `sourceId` đã tồn tại).

2. **Chế độ Hàng loạt (Batch Array):**
   - Khi `req.body` là **1 JSON Array `[ {...}, {...} ]`** (hoặc `{ "invoices": [ {...}, {...} ] }`):
     - Giới hạn tối đa **30 hoá đơn / request** (`BKAV_MAX_INVOICES_PER_REQUEST = 30`).
     - **Mỗi phần tử trong mảng sẽ xuất ra 1 hoá đơn điện tử riêng biệt.**
     - **3 kỹ thuật tối ưu hiệu năng trong Batch Mode:**
       1. **Batch Prefetch Sản phẩm (`_prefetchActiveProducts`):** Gom toàn bộ `productId` và `itemCode` của tất cả 30 hoá đơn để truy vấn MongoDB **đúng 1 lần duy nhất** bằng toán tử `$in`, đưa vào `productCache`.
       2. **Singleflight Provider Cache (`resolveDefaultProvider`):** Lưu Promise truy vấn `InvoiceProvider` vào `providerCache` Map để các worker chạy song song không gây cache stampede và chỉ truy vấn DB **đúng 1 lần**.
       3. **Bounded Concurrency (`BATCH_CONCURRENCY = 4`):** Chạy 4 worker song song gọi sang BKAV và ghi kết quả vào đúng vị trí `results[index]`, giúp giảm thời gian xử lý 30 hoá đơn từ ~50 giây xuống còn **~10–12 giây** (tránh bị Cloudflare/Render cắt kết nối do HTTP Gateway Timeout).
     - **Cô lập lỗi từng phần tử (Partial-Failure Isolation):** Lỗi validation hoặc lỗi BKAV ở phần tử thứ `i` được bắt riêng và ghi vào `results[i].error`, không làm ảnh hưởng đến các phần tử còn lại trong mảng.

---

### Tầng 3: Xử Lý Nghiệp Vụ Từng Hoá Đơn (`_createSingleExternalInvoice`)

- **Files liên quan:**
  - `src/modules/invoice/invoice.service.js` (`_createSingleExternalInvoice`, `_resolveItems`, `_calculateTotals`)
  - `src/modules/invoice/invoice.validation.js` (`externalInvoiceItemSchema`, `externalCreateInvoiceSchema`)

1. **Ép cứng `sourceModule` & Chống دسترسی chéo (IDOR):**
   - Luôn gán `const sourceModule = caller;` từ API Key đã xác thực (bỏ qua mọi giá trị `sourceModule` truyền từ body).
   - Khi đối tác gọi `GET /api/external/v1/invoices/:id` (`getExternalInvoiceByRef`), hệ thống luôn kèm điều kiện `sourceModule: caller` trong câu query MongoDB — đối tác nào chỉ được phép xem hoá đơn của chính đối tác đó.

2. **In-Flight Mutex & Chống trùng lặp Lớp 2 theo `(sourceModule, sourceId/billCode)`:**
   - Dùng Map `_inFlightExternalKeys` khoá theo khoá `${sourceModule}:${sourceId || billCode}` để tuần tự hoá 2 request trùng mã đơn hàng đến cùng lúc.
   - Kiểm tra bảng `Invoice` với index `{ sourceModule: 1, sourceId: 1 }` / `{ sourceModule: 1, billCode: 1 }` (chỉ xét các hoá đơn chưa bị huỷ/thay thế `status ∉ ['cancelled', 'replaced']`).
   - Nếu đã tồn tại → trả về ngay hoá đơn hiện có với `"duplicate": true`, không tạo mới.

3. **Phân giải Hàng hoá (`items[]`) theo 2 Nhánh Độc Lập:**

   - **Nhánh 1 — Có gửi ID hoặc Mã SKU Sản phẩm (`productId`, `id`, `itemCode`, hoặc `productCode`):**
     - Tra cứu sản phẩm trong bảng `InvoiceProduct` (`isActive: true, isDeleted: { $ne: true }`).
     - Nếu không tìm thấy hoặc sản phẩm đã bị tắt → ném lỗi `400 Bad Request`.
     - Nếu tìm thấy → **lấy 100% thông tin cấu hình sẵn của sản phẩm trong DB** (`productId`, `itemCode`, `itemName`, `unitName`, `unitPrice`, `taxRate`, `taxRateId`, `itemTypeId`, `userDefineDetails`) kết hợp với `quantity` (mặc định `1`, phải `> 0`) để tính thành tiền và tiền thuế.

   - **Nhánh 2 — Không gửi ID / Mã Sản phẩm (Tự định nghĩa theo Template):**
     - Kiểm tra chặt chẽ toàn bộ các trường bắt buộc theo từng loại dòng (`itemType` / `itemTypeId`). Nếu thiếu bất kỳ trường bắt buộc nào → trả lỗi `400` liệt kê rõ các trường thiếu:
       - `"goods"` (`0` — Hàng hoá/dịch vụ thường): bắt buộc đủ 5 trường `itemName`, `unitName`, `quantity (> 0)`, `unitPrice (>= 0)`, `taxRate` (`0, 5, 8, 10, -1, -2, -4`).
       - `"vehicle"` (`21` — Xe ô tô/mô tô): đủ 5 trường của `"goods"` **+** `userDefineDetails` (chứa số khung, số máy).
       - `"promotion"` (`15` — Hàng khuyến mãi): bắt buộc `itemName`, `unitName`, `quantity (> 0)`; tự động ép `unitPrice = 0, amount = 0, taxRate = 0, taxRateId = 1, taxAmount = 0`.
       - `"discount"` (`30` — Chiết khấu thương mại): bắt buộc `itemName` **+** (`amount > 0` hoặc `quantity > 0 & unitPrice > 0`); tự động ép `isDiscount = true, taxRate = 0, taxRateId = 1, taxAmount = 0`, trừ vào tổng tiền trước thuế.
       - `"note"` (`4` — Dòng ghi chú): bắt buộc `itemName`; tự động ép `quantity = 0, unitPrice = 0, amount = 0, taxAmount = 0`.

4. **Chuẩn hoá Người mua (`buyer`) & Tính Tổng (`_calculateTotals`):**
   - Nếu cả `buyer.name` và `buyer.unitName` đều trống → tự gán `buyer.name = "Khách lẻ"`.
   - Tính chính xác `totalDiscountAmount`, `totalAmountBeforeTax`, `totalTaxAmount`, `totalAmount`, sinh mã `INV-YYYYMMDD-XXXX` và lưu bản ghi `Invoice`.

---

### Tầng 4: Giao Tiếp BKAV eHoaDon & Ký Số HSM Tự Động

- **Files liên quan:**
  - `src/modules/invoice/invoice.service.js` (`_issueViaProvider`)
  - `src/modules/invoice/adapters/BkavAdapter.js` (`issue`, `signWithHSM`, `_execCommand`)

1. Nếu `isDraft: true`: Giữ trạng thái `"draft"` trên CRM, không gọi BKAV.
2. Nếu `isDraft: false` (mặc định):
   - **Bước 1 — Tạo & cấp số hoá đơn trên BKAV (`adapter.issue`, `CmdType 112`):**
     - Nén payload bằng `gzipAsync` (bất đồng bộ, không chặn event loop) → Mã hoá `AES-256-CBC` bằng `PartnerToken (Key:IV)` → Base64 → Gửi `POST /ExecCommand` qua `https.Agent({ keepAlive: true })`.
     - Giải mã kết quả và lưu `providerInvoiceGUID`, `invoiceNo` (Số HĐ), `lookupCode` (Mã tra cứu MTC) cùng lịch sử `providerCallLogs`.
   - **Bước 2 — Ký số HSM tự động (nếu NCC bật `bkav.autoSign = true`):**
     - Tự động gọi tiếp `adapter.signWithHSM` (`CmdType 205`) với `providerInvoiceGUID` vừa nhận:
       - Nếu ký thành công → `status = "issued"`, ghi nhận `issuedAt`.
       - Nếu ký HSM lỗi tạm thời → vẫn giữ Số HĐ & `InvoiceGUID` đã cấp, chuyển về `status = "pending_sign"` kèm thông báo lỗi để kế toán bấm **Ký HSM** lại trên CRM mà không bị mất số hoá đơn.
   - Nếu NCC tắt `autoSign` (`autoSign = false`) → Hoá đơn sau khi cấp số ở trạng thái `status = "pending_sign"` chờ ký USB Token.
   - Nếu bước tạo ban đầu bị BKAV từ chối → `status = "error"`, lưu lỗi vào `providerErrorMessage` & `providerCallLogs`.

---

### Tầng 5: Lưu Cache Idempotency, Ghi Audit Log & Trả Kết Quả

- Lưu kết quả cuối cùng vào `ZCodeIdempotencyKey` (`status: 'completed'`).
- Ghi `SystemLog` (hiển thị trên tab **Nhật ký hệ thống**) và `ExternalApiLog` (hiển thị trên tab **External Logs** với đúng nhãn `system` của từng đối tác, vd `ZCODE`).
- Trả JSON đã chuẩn hoá qua `_formatExternalInvoiceSummary` (không lộ cấu hình/token nội bộ của NCC).
