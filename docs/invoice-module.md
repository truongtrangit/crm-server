# Module Hoá Đơn Điện Tử (eInvoice)

## Tổng quan

Module quản lý hoá đơn điện tử (HĐĐT) cho CRM. Hỗ trợ tích hợp nhiều nhà cung cấp HĐĐT thông qua
kiến trúc **adapter pattern** (provider-agnostic).

### Nhà cung cấp được hỗ trợ

| Provider | Giao thức | Trạng thái |
|----------|-----------|------------|
| **BKAV eHoaDon** | SOAP WebService + AES-256 | ✅ Phase 2 |
| **SePay eInvoice** | REST API + Bearer Token | 🔜 Phase 3 |

---

## Cấu hình môi trường (.env)

Thay đổi giữa **dev** và **prod** chỉ cần đổi giá trị trong file `.env`:

```env
# Dev/Demo
BKAV_INVOICE_ENDPOINT=https://wsdemo.ehoadon.vn/WSPublicEHoaDon.asmx

# Production
# BKAV_INVOICE_ENDPOINT=https://ws.ehoadon.vn/WSPublicEHoaDon.asmx

BKAV_INVOICE_PARTNER_GUID=<your-guid>
BKAV_INVOICE_PARTNER_TOKEN=<your-key:iv-token>
BKAV_INVOICE_CMD_TYPE=111
BKAV_INVOICE_SERIAL=MAA
```

> **Lưu ý**: PartnerGUID và PartnerToken còn được lưu trong `InvoiceProvider` model (DB).
> Env config là **fallback default** khi tạo provider mới.

---

## API Endpoints

Base: `GET /api/v1/invoices`

### Hoá đơn

| Method | Path | Permission | Mô tả |
|--------|------|------------|-------|
| GET | `/stats` | `invoices_read` | Thống kê tổng quan |
| GET | `/` | `invoices_read` | Danh sách HĐ (filter, search, paginate) |
| GET | `/:id` | `invoices_read` | Chi tiết HĐ |
| POST | `/` | `invoices_create` | Tạo HĐ (nháp hoặc phát hành) |
| PUT | `/:id` | `invoices_update` | Cập nhật HĐ nháp |
| DELETE | `/:id` | `invoices_delete` | Xoá HĐ nháp |
| POST | `/:id/issue` | `invoices_update` | Phát hành HĐ lên CQT |
| POST | `/:id/cancel` | `invoices_update` | Huỷ bỏ HĐ |
| POST | `/:id/retry` | `invoices_update` | Retry HĐ bị lỗi |
| POST | `/:id/replace` | `invoices_update` | Thay thế HĐ |
| POST | `/:id/adjust` | `invoices_update` | Điều chỉnh HĐ |
| POST | `/:id/sign-hsm` | `invoices_update` | Ký HSM 1 HĐ |
| POST | `/batch-sign-hsm` | `invoices_update` | Ký HSM nhiều HĐ |
| POST | `/:id/explain-cqt` | `invoices_update` | Giải trình CQT (HĐ sai sót) |
| POST | `/:id/explain-replaced-cqt` | `invoices_update` | Giải trình CQT (HĐ bị TT/ĐC) |

### Nhà cung cấp (Provider)

| Method | Path | Permission | Mô tả |
|--------|------|------------|-------|
| GET | `/providers` | `invoice_providers_config` | Danh sách NCC |
| GET | `/providers/:id` | `invoice_providers_config` | Chi tiết NCC |
| POST | `/providers` | `invoice_providers_config` | Tạo NCC |
| PUT | `/providers/:id` | `invoice_providers_config` | Cập nhật NCC |
| DELETE | `/providers/:id` | `invoice_providers_config` | Xoá NCC |
| POST | `/providers/:id/test` | `invoice_providers_config` | Test kết nối |

---

## Data Models

### Invoice

Trạng thái hoá đơn:

```
draft → pending → issued
  │        │
  │        └─→ error → (retry) → pending
  │
  └─→ (delete)

issued → cancelled / replaced / adjusted
```

### InvoiceProvider

Mỗi provider tương ứng 1 tài khoản BKAV/SePay. Hỗ trợ:
- `isDefault`: Provider mặc định
- `isActive`: Bật/tắt provider
- `emailNotification.enabled`: Admin config tự gửi email tra cứu HĐ từ CRM

---

## BKAV eHoaDon Integration

### Ký hiệu Hoá đơn

Khách hàng đã đăng ký ký hiệu: **MAA** và **MVK**

### CmdType

Sử dụng **CmdType 111**: PMKT quản lý Mẫu số + Ký hiệu + Số HĐ.
Hoá đơn tạo ra có trạng thái "Hoá đơn chờ" (đã được cấp số).

| CmdType | Mục đích |
|---------|----------|
| 111 | Tạo HĐ mới (PMKT quản lý mẫu/ký hiệu) |
| 123 | Thay thế HĐ (PMKT quản lý) |
| 121 | Điều chỉnh HĐ (PMKT quản lý) |
| 201 | Huỷ HĐ đã phát hành (bằng InvoiceGUID) |
| 205 | Ký 1 HĐ bằng HSM |
| 206 | Ký nhiều HĐ bằng HSM |
| 300 | Giải trình CQT (HĐ sai sót) |
| 304 | Giải trình CQT (HĐ bị TT/ĐC) |
| 800 | Lấy thông tin HĐ |

### HSM (Chữ ký số)

- CmdType **205**: Ký 1 hoá đơn bằng HSM
- CmdType **206**: Ký nhiều hoá đơn bằng HSM
- API: `POST /:id/sign-hsm` và `POST /batch-sign-hsm`
- Yêu cầu BKAV cấu hình chữ ký số HSM cho tài khoản

### Giải trình CQT

- CmdType **300**: Giải trình HĐ sai sót (không cần thay thế/điều chỉnh)
- CmdType **304**: Giải trình HĐ bị thay thế / bị điều chỉnh
- API: `POST /:id/explain-cqt` và `POST /:id/explain-replaced-cqt`

---

## File Structure

```
src/modules/invoice/
├── adapters/                    # Phase 2
│   ├── BaseInvoiceAdapter.js
│   ├── BkavAdapter.js
│   ├── SepayAdapter.js
│   └── AdapterFactory.js
├── invoice.controller.js
├── invoice.service.js
├── invoice.validation.js
├── invoice.model.js
└── invoiceProvider.model.js

src/routes/v1/
└── invoices.routes.js

src/core/constants/
└── invoice.js

Modified:
├── src/core/constants/rbac.js      (+ INVOICES, INVOICE_PROVIDERS)
├── src/core/config/env.js          (+ BKAV config)
├── src/core/utils/id.js            (+ INV, INVP prefixes)
├── src/routes/v1/index.js          (+ invoices route)
└── .env.example                    (+ BKAV section)
```

---

## Future Enhancements

- [ ] Liên kết Revenue / BankLog
- [ ] SePay eInvoice adapter
- [ ] Email template cho thông báo tra cứu HĐ
- [ ] Quota / hạn mức kiểm tra
- [ ] CmdType 502/503 — Đính kèm file sau khi tạo HĐ
- [ ] CmdType 810 — Lấy danh sách HĐ theo khoảng số
