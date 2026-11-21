# Hướng Dẫn Onboarding Đối Tác Bên Thứ 3 Mới Cho Module Hoá Đơn (External Invoice API)

> **Đối tượng đọc:** Backend Engineer, DevOps / Ops, Tech Lead nội bộ CRM  
> **Phạm vi:** Quy trình chuẩn khi có bất kỳ hệ thống bên thứ 3 mới nào (ví dụ minh hoạ: `cdp.vn`, `smax.ai`, `pos`, `partner_b`...) cần gọi API sang CRM để tự động tạo & phát hành Hoá đơn Điện tử (`/api/external/v1/invoices`).  
> **Tài liệu liên quan:**
> - Đặc tả API gửi cho dev đối tác: `docs/INVOICE_EXTERNAL_API_SPEC.md`
> - Bộ Postman test cho dev đối tác: `docs/Invoice_External_API.postman_collection.json`
> - Source code quản lý đối tác: `src/core/config/env.js` (`buildInvoiceExternalPartners`) và `src/core/middleware/externalInvoiceAuth.js` (`authenticateExternalInvoicePartner`)

---

## 1. Tổng Quan Kiến Trúc Cô Lập Đa Đối Tác (Multi-Partner Isolation)

Hệ thống External Invoice API **không sử dụng** 1 API Key hay 1 IP Allowlist dùng chung cho tất cả các bên. Thay vào đó, mỗi đối tác được đăng ký trong `env.invoiceExternalPartners` và được **cô lập hoàn toàn ở 5 lớp**:

| Lớp cô lập | Cơ chế hoạt động | Ý nghĩa bảo mật & vận hành |
| --- | --- | --- |
| **1. API Key riêng (`apiKey`)** | Mỗi đối tác có secret key độc lập, so sánh bằng `crypto.timingSafeEqual`. Khi đối tác gửi kèm header `X-Partner-Id`, key bắt buộc phải khớp đúng đối tác đó. | Lộ hoặc thu hồi key của đối tác A **không ảnh hưởng** đến Key.vn hay đối tác B. |
| **2. IP Allowlist riêng (`allowedIps`)** | Middleware kiểm tra IP gọi sang đối chiếu với danh sách `allowedIps` của **chính đối tác khớp với API Key**. | IP máy chủ của Key.vn không thể dùng API Key của đối tác mới (và ngược lại) — bị chặn ngay `403 <SYSTEM>_IP_FORBIDDEN`. |
| **3. Nguồn Hoá đơn riêng (`sourceModule`)** | Tự động gán `invoice.sourceModule = partner.sourceModule` và `createdBy = "external:<sourceModule>"`. | Dễ dàng thống kê, lọc hoá đơn theo từng đối tác; tránh xung đột `sourceId` (chống trùng lặp Lớp 2 theo cặp `(sourceModule, sourceId)`). |
| **4. Nhật ký External Log riêng (`system`)** | `externalApiLogger` tự động ghi `system = req.externalPartner.system` vào bảng `ExternalApiLog`. | Truy vết request/response/lỗi riêng biệt theo từng hệ thống gọi sang. |
| **5. Namespace Idempotency riêng** | Header `X-Idempotency-Key` được lưu theo khoá `inv_ext:<partnerId>:<key>` (TTL 24h). | Hai đối tác gửi trùng chuỗi `X-Idempotency-Key` (vd: `"order-001"`) không bao giờ ghi đè hoặc nhận nhầm kết quả của nhau. |

> **Tin vui:** Hiện tại hệ thống đã tích hợp cơ chế **Auto-Discovery từ biến môi trường (`INVOICE_PARTNER_<NAME>_*`)**. Trong **90% trường hợp**, khi có đối tác mới, bạn **KHÔNG CẦN SỬA CODE & KHÔNG CẦN BUILD LẠI ỨNG DỤNG** — chỉ cần thêm biến môi trường và restart server!

---

## 2. Quy Trình 6 Bước Khi Có Đối Tác Mới Tích Hợp

Giả sử có một hệ thống đối tác mới (ví dụ minh hoạ tên là **`PARTNER_X`**, ví dụ sau này là `CDP`, `SMAX`, `POS`, v.v.) muốn gọi sang CRM để xuất hoá đơn. Thực hiện tuần tự 6 bước sau:

---

### Bước 1 — Thống nhất Định danh đối tác (`<NAME>`) & Sinh API Key bảo mật

1. **Chọn mã định danh `<NAME>`** ngắn gọn, viết hoa, chỉ gồm chữ cái/chữ số/gạch dưới (không chứa dấu chấm `.` hay dấu gạch ngang `-`), ví dụ: `CDP`, `SMAX`, `POS`, `SHOP_A`.
   - Khi khai báo `<NAME>`, hệ thống tự động tạo:
     - `id`: `<name>` (viết thường, vd: `cdp`)
     - `aliases`: `["<name>", "<name>.vn"]` (đối tác gửi `X-Partner-Id: cdp` hay `X-Partner-Id: cdp.vn` đều khớp)
     - `sourceModule`: `<name>` (mặc định viết thường, có thể ghi đè qua biến `_SOURCE_MODULE`)
     - `system`: `<NAME>` (mặc định viết hoa, có thể ghi đè qua biến `_SYSTEM`)
2. **Sinh API Key ngẫu nhiên tối thiểu 32 bytes (64 ký tự hex)** — tuyệt đối không đặt key đơn giản dễ đoán:

```bash
# Chạy trên terminal để sinh 1 API Key ngẫu nhiên an toàn cho đối tác (ví dụ prefix theo tên đối tác):
node -e "console.log('inv_<name>_' + require('crypto').randomBytes(32).toString('hex'))"
```

> **Lưu ý:** Sinh **2 key khác nhau** cho môi trường **Dev/Staging** và môi trường **Production**. Không bao giờ dùng chung 1 key giữa Dev và Prod.

---

### Bước 2 — Thu thập danh sách IP tĩnh (Static Outbound IP) của đối tác

Yêu cầu bộ phận kỹ thuật của đối tác cung cấp danh sách **IP outbound tĩnh** mà server họ sẽ dùng để gọi sang CRM:
- **Môi trường Production:** **Bắt buộc** điền chính xác danh sách IP tĩnh hoặc dải mạng CIDR (ngăn cách bởi dấu phẩy, vd: `103.112.10.20,103.112.10.0/24`; hệ thống tự động chuẩn hoá `::ffff:` IPv4-mapped IPv6). **Không** để trống hoặc đặt `0.0.0.0` trên Production trừ khi có phê duyệt bảo mật đặc biệt.
- **Môi trường Dev / Staging:** Có thể đặt `0.0.0.0` tạm thời trong giai đoạn dev tích hợp nếu đối tác gọi từ máy cá nhân / IP động, nhưng phải siết lại IP tĩnh trước khi Go-Live.

---

### Bước 3 — Cấu hình Biến Môi Trường trên CRM Server (Không cần sửa code)

Bạn có **2 cách** khai báo trên file `.env` (hoặc dashboard Environment Variables của Render / Docker / K8s):

#### Cách 1 (Khuyến nghị — Đơn giản, dễ quản lý): Dùng quy ước `INVOICE_PARTNER_<NAME>_*`

Thêm cặp biến sau vào `.env` của CRM Server (thay `<NAME>` bằng mã đối tác đã chọn ở Bước 1):

```dotenv
# Ví dụ minh hoạ khi sau này thêm đối tác mới (thay <NAME> bằng tên đối tác, vd: CDP, SMAX, POS...)
INVOICE_PARTNER_<NAME>_API_KEY=inv_<name>_<64_ky_tu_hex_ngau_nhien>
INVOICE_PARTNER_<NAME>_ALLOWED_IPS=103.112.10.20,103.112.10.21

# (Tuỳ chọn — chỉ khai báo nếu muốn đổi khác giá trị mặc định)
# INVOICE_PARTNER_<NAME>_SOURCE_MODULE=<ten_source_module_tuy_chinh>
# INVOICE_PARTNER_<NAME>_SYSTEM=<TEN_SYSTEM_GHI_LOG_TUY_CHINH>
```

**Ví dụ cụ thể minh hoạ** (nếu sau này tích hợp hệ thống `cdp.vn`):
```dotenv
INVOICE_PARTNER_CDP_API_KEY=inv_cdp_9f8e7d6c5b4a3210...
INVOICE_PARTNER_CDP_ALLOWED_IPS=203.113.50.10,203.113.50.11
```
Chỉ với 2 dòng trên, `src/core/config/env.js` tự động đăng ký đối tác:
- `id`: `"cdp"`
- `aliases`: `["cdp", "cdp.vn"]`
- `sourceModule`: `"cdp"`
- `system`: `"CDP"`
- `apiKey`: `"inv_cdp_9f8e7d6c5b4a3210..."`
- `allowedIps`: `"203.113.50.10,203.113.50.11"`

#### Cách 2 (Nâng cao): Dùng biến JSON `INVOICE_EXTERNAL_PARTNERS`

Dùng khi cần khai báo thêm nhiều `aliases` đặc biệt (vd: tên miền `.com`, `.io`, hoặc nhiều tên gọi khác nhau) hoặc đặt `name` hiển thị chi tiết:

```dotenv
INVOICE_EXTERNAL_PARTNERS='{"partnerx":{"name":"Partner X Platform","aliases":["partnerx","partner-x.io"],"sourceModule":"partner_x","system":"PARTNER_X","apiKey":"inv_partnerx_...","allowedIps":["203.113.50.10","203.113.50.11"]}}'
```

> **Thứ tự ưu tiên merge cấu hình trong `buildInvoiceExternalPartners()`:**
> 1. Đối tác mặc định hiện hữu (`keyvn` dùng `KEYVN_API_KEY` || `ZCODE_API_KEY`)
> 2. Các đối tác tự động nhận diện từ `INVOICE_PARTNER_<NAME>_API_KEY`
> 3. Override cuối cùng từ JSON `INVOICE_EXTERNAL_PARTNERS` (nếu có)

**Sau khi cập nhật `.env`:**
- **Restart** CRM Server để `env.js` nạp lại cấu hình mới.
- Kiểm tra console khởi động (hoặc kiểm tra nhanh bằng cURL ở Bước 5) để chắc chắn đối tác mới đã được nạp.

---

### Bước 4 — Chuẩn bị Dữ liệu Nghiệp vụ trên Giao diện CRM

Trước khi đối tác gọi API tạo hoá đơn, kiểm tra 2 mục trong module **Hoá đơn** trên CRM:

1. **Nhà cung cấp HĐĐT mặc định (`Hoá đơn → Cấu hình NCC`)**:
   - Đảm bảo có đúng **1 Nhà cung cấp** được bật `isActive = true` và đánh dấu `isDefault = true` (nếu đối tác không truyền `providerId` trong payload, hệ thống sẽ tự động lấy NCC mặc định này).
   - Xác nhận cấu hình `autoSign` (tự động ký số HSM ngay khi phát hành) hay ký thủ công bằng USB Token (`pending_sign`) theo đúng quy trình kế toán.
   - Nếu đối tác mới cần xuất trên **một pháp nhân / ký hiệu hoá đơn / NCC BKAV khác** với mặc định → cấp thêm `providerId` (vd: `IPR-20261110-0002`) cho dev đối tác truyền vào field `providerId` của request.
2. **Danh mục Sản phẩm (`Hoá đơn → Sản phẩm`)**:
   - **Nếu đối tác dùng Nhánh 1 (gọi theo ID/SKU có sẵn):** Tạo sẵn toàn bộ sản phẩm (Mã SKU `code`, Tên, ĐVT, Đơn giá, Thuế suất VAT, `isActive = true`) trong tab **Sản phẩm** trên CRM.
   - **Nếu đối tác dùng Nhánh 2 (gửi Template tự định nghĩa):** Không cần tạo SKU trước; đối tác gửi trực tiếp đầy đủ các trường (`itemName`, `unitName`, `quantity`, `unitPrice`, `taxRate`, `itemType`...).

---

### Bước 5 — Bàn giao Tài liệu & Thực hiện Kiểm thử Tích hợp (UAT Checklist)

#### 5.1. Gói thông tin bàn giao cho Dev Đối tác

Gửi cho phía đối tác (qua kênh bảo mật — **không gửi API Key cùng email với tài liệu** hoặc dùng 1Password/Vault):
1. **Base URL:**
   - Dev: `https://crm-server-rvzz.onrender.com/api/external/v1/invoices`
   - Prod: `https://final.vn/api/external/v1/invoices`
2. **Thông tin định danh:**
   - `X-Partner-Id`: `<name>` (vd: `cdp` hoặc `cdp.vn`)
   - `X-API-Key`: `<key_cua_doi_tac>`
   - `providerId` *(chỉ gửi nếu đối tác không dùng NCC mặc định)*
3. **2 file tài liệu kỹ thuật:**
   - `docs/INVOICE_EXTERNAL_API_SPEC.md`
   - `docs/Invoice_External_API.postman_collection.json`

#### 5.2. Checklist 7 Test Case Bắt Buộc Trước Khi Go-Live

Chạy kiểm tra đầy đủ 7 kịch bản sau trên môi trường Dev/Staging trước khi cấp key Production:

- [ ] **TC1 — Verify Auth thành công (`GET /template`)**:
  ```bash
  curl -i -X GET "<BASE_URL>/template" \
    -H "X-Partner-Id: <name>" \
    -H "X-API-Key: <PARTNER_API_KEY>"
  ```
  → Kỳ vọng: HTTP `200 OK`.

- [ ] **TC2 — Verify cô lập API Key (Cross-Partner Rejection)**:
  Gửi `X-Partner-Id: <name>` nhưng dùng `X-API-Key` của `keyvn` (hoặc key sai).
  → Kỳ vọng: HTTP `401 Unauthorized` (`INVOICE_EXTERNAL_INVALID_API_KEY`).

- [ ] **TC3 — Verify cô lập IP Allowlist**:
  Gọi từ một IP **không nằm trong** `INVOICE_PARTNER_<NAME>_ALLOWED_IPS` nhưng dùng đúng `<PARTNER_API_KEY>`.
  → Kỳ vọng: HTTP `403 Forbidden` (`<NAME>_IP_FORBIDDEN`).

- [ ] **TC4 — Tạo Hoá đơn Nháp (`isDraft: true`) để test format không tốn số HĐ BKAV**:
  ```bash
  curl -i -X POST "<BASE_URL>" \
    -H "Content-Type: application/json" \
    -H "X-Partner-Id: <name>" \
    -H "X-API-Key: <PARTNER_API_KEY>" \
    -H "X-Idempotency-Key: uat-<name>-draft-001" \
    -d '{
      "sourceId": "UAT-DRAFT-001",
      "isDraft": true,
      "buyer": { "type": "personal", "name": "Khách test UAT" },
      "items": [
        {
          "itemType": "goods",
          "itemName": "Sản phẩm kiểm thử UAT",
          "unitName": "Gói",
          "quantity": 1,
          "unitPrice": 100000,
          "taxRate": 10
        }
      ]
    }'
  ```
  → Kỳ vọng: HTTP `201 Created`, `data.status = "draft"`, `data.sourceModule = "<name>"`.

- [ ] **TC5 — Verify Idempotency Lớp 1 (`X-Idempotency-Key`) & Lớp 2 (`sourceId`)**:
  Gọi lại đúng request TC4 → Kỳ vọng HTTP `201` (cache từ lần 1) kèm `"idempotent": true` ở root. Đổi sang `X-Idempotency-Key` mới nhưng giữ nguyên `sourceId: "UAT-DRAFT-001"` → Kỳ vọng HTTP `200` kèm `data.duplicate: true`.

- [ ] **TC6 — Tạo Hoá đơn thật trên BKAV Demo (`isDraft: false`) & Batch Array (`[ {...}, {...} ]`)**:
  Kiểm tra hoá đơn lên BKAV Demo đúng thông tin người mua, hàng hoá, thuế suất, và tra cứu lại thành công qua `GET /:sourceId`.

- [ ] **TC7 — Verify Audit Log trên CRM**:
  Mở trang **Nhật ký hệ thống → External Logs** kiểm tra request đã được ghi log với đúng `system = "<NAME>"`, `callerIp`, `responseStatus`, và trên trang **Hoá đơn** hoá đơn có đúng `sourceModule = "<name>"`.

---

### Bước 6 — Các Tuỳ Chọn Mở Rộng Code (Chỉ Làm Khi Có Yêu Cầu Nghiệp Vụ / UI Riêng)

Mặc định **Bước 1 → Bước 5 là đủ để chạy Production**. Bạn **chỉ cần sửa code** trong các tình huống sau:

| Khi nào cần sửa code? | File cần cập nhật | Việc cần làm |
| --- | --- | --- |
| Muốn có mục chọn lọc đối tác mới trong dropdown **"System"** ở trang **External Logs** trên giao diện CRM | `crm-client/src/features/logs/components/ExternalLogsTab.tsx` | Thêm `<option value="<NAME>"><NAME></option>` vào thẻ `<select value={filterSystem}>` |
| Muốn khai báo constant chính thức cho `sourceModule` (để lọc/hiển thị badge tên tiếng Việt trên bảng Hoá đơn) | `src/core/constants/invoice.js` & `crm-client/src/config/constants.ts` | Thêm `<NAME>: '<name>'` vào `INVOICE_SOURCE_MODULES` |
| Muốn khai báo constant chính thức cho `EXTERNAL_SYSTEMS` (nếu đối tác mới còn có webhook/replay hoặc tích hợp module khác ngoài Hoá đơn) | `src/core/constants/externalSystems.js` | Thêm `<NAME>: '<NAME>'` vào `EXTERNAL_SYSTEMS` |
| Đối tác có lưu lượng gọi cao hơn giới hạn mặc định (**60 req/phút/IP**) | `src/core/middleware/rateLimiter.js` | Điều chỉnh hoặc tách `externalInvoiceLimiter` keyGenerator theo `partnerId + ip` |
| Cần gửi Webhook callback ngược về cho đối tác khi kế toán bấm ký số USB Token / huỷ / điều chỉnh hoá đơn | `src/modules/invoice/invoice.service.js` | Bổ sung webhook dispatcher theo `partner.webhookUrl` |

---

## 3. Vận Hành & Xử Lý Sự Cố Sau Go-Live (Runbook)

### 3.1. Xoay vòng API Key (Key Rotation)
1. Sinh key mới bằng lệnh ở Bước 1.
2. Thống nhất thời điểm chuyển đổi (maintenance window) với đối tác — hoặc nếu cần zero-downtime tạm thời, tạo thêm 1 alias tạm qua `INVOICE_EXTERNAL_PARTNERS` rồi gỡ key cũ sau khi đối tác chuyển xong.
3. Cập nhật `INVOICE_PARTNER_<NAME>_API_KEY` trên CRM Server → restart server → đối tác cập nhật key mới → kiểm tra log không còn lỗi `401`.

### 3.2. Bổ sung / Thay đổi IP máy chủ đối tác
- Cập nhật biến `INVOICE_PARTNER_<NAME>_ALLOWED_IPS` bằng cách thêm IP mới (ngăn cách bằng dấu phẩy, vd: `ip_cu,ip_moi`), restart server.
- Sau khi đối tác ngưng dùng IP cũ, xoá `ip_cu` khỏi danh sách và restart lại.

### 3.3. Thu hồi quyền truy cập khẩn cấp (Emergency Revoke)
Khi nghi ngờ đối tác bị lộ API Key hoặc gửi spam bất thường:
1. **Xoá giá trị** biến `INVOICE_PARTNER_<NAME>_API_KEY=` (để trống) hoặc xoá hẳn biến đó khỏi `.env`.
2. Restart CRM Server ngay lập tức.
3. Toàn bộ request từ đối tác đó sẽ lập tức bị chặn với `401 Unauthorized`, trong khi **Key.vn và tất cả đối tác khác vẫn hoạt động bình thường 100%**.

### 3.4. Bảng Tra Cứu Nhanh Khi Debug Sự Cố

| Triệu chứng | Nơi kiểm tra | Nguyên nhân phổ biến & Cách xử lý |
| --- | --- | --- |
| Đối tác nhận `401 INVOICE_EXTERNAL_INVALID_API_KEY` | `ExternalApiLog` (`apiKeyValid: false`) | Sai key, thiếu header `X-API-Key`, dính khoảng trắng thừa khi copy-paste, hoặc gửi `X-Partner-Id` không khớp với `id`/`aliases` của key đó. |
| Đối tác nhận `403 <NAME>_IP_FORBIDDEN` | `ExternalApiLog` (xem cột `callerIp`) | IP thực tế server đối tác gọi sang (qua Cloudflare `CF-Connecting-IP` / `X-Forwarded-For`) chưa có trong `INVOICE_PARTNER_<NAME>_ALLOWED_IPS`. Lấy đúng `callerIp` từ log để đối chiếu và bổ sung. |
| Đối tác nhận `400 Không tìm thấy sản phẩm đang hoạt động...` | Tab **Hoá đơn → Sản phẩm** | Đối tác gửi `itemCode`/`productId` (Nhánh 1) nhưng sản phẩm chưa tạo hoặc đang tắt `isActive = false`. |
| Đối tác nhận `400 Dòng hàng hoá tự định nghĩa thiếu hoặc không hợp lệ...` | Payload request trong `ExternalApiLog` | Đối tác gửi Nhánh 2 (không có `productId`/`itemCode`) nhưng thiếu 1 trong các trường bắt buộc (`itemName`, `unitName`, `quantity`, `unitPrice`, `taxRate`). |
| Đối tác nhận `429 INVOICE_EXTERNAL_RATE_LIMITED` | Rate limit headers | Vượt quá 60 request / phút / IP. Khuyến nghị đối tác gom tối đa 30 hoá đơn vào 1 Batch Array request thay vì bắn lẻ từng request. |
| Hoá đơn tạo được trên CRM nhưng `status = "error"` | Tab **Hoá đơn → Chi tiết → Lịch sử gọi API NCC (`callLogs`)** | Lỗi nghiệp vụ trả về từ BKAV (vd: sai MST, hết hạn mức số hoá đơn, lỗi chữ ký số HSM). Xem chi tiết `providerErrorMessage` và `callLogs` để xử lý rồi bấm **Retry**. |
