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

### HSM (Chữ ký số)

> ⚠️ **TODO**: Chưa xác nhận KH có HSM. Cần liên hệ BKAV để cấu hình ký tự động nếu có.

### Tài liệu tham khảo

- FAQ WebServices BKAV: `./FAQ_WebServices_Bkav.docx.pdf`
- Demo endpoint: https://wsdemo.ehoadon.vn/WSPublicEHoaDon.asmx
- Prod endpoint: https://ws.ehoadon.vn/WSPublicEHoaDon.asmx
- Tra cứu HĐ: https://tracuu.ehoadon.vn

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
- [ ] HĐ thay thế / HĐ điều chỉnh (BKAV CmdType 121/124)
- [ ] Email template cho thông báo tra cứu HĐ
- [ ] Quota / hạn mức kiểm tra
