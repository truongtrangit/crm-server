# Tài Liệu Tích Hợp Nhanh (Quickstart) — API Xuất Hoá Đơn Điện Tử Tự Động

> **Dành cho:** Đội ngũ Lập trình viên Đối tác tích hợp (Key.vn & các đối tác bên thứ 3)  
> **File Postman đi kèm:** `docs/Invoice_External_API.postman_collection.json` (Import trực tiếp vào Postman để chạy thử ngay)

---

## 1. Thông Tin Kết Nối Cơ Bản

| Môi trường | Base URL |
| --- | --- |
| **Production** | `https://final.vn/api/external/v1/invoices` |
| **Dev / Staging** | `https://crm-server-rvzz.onrender.com/api/external/v1/invoices` |

### Headers gửi kèm trong mọi Request

```http
Content-Type: application/json
X-Partner-Id: <ma_doi_tac_do_crm_cap>        # Ví dụ: keyvn
X-API-Key: <api_key_rieng_do_crm_cap>        # Bắt buộc
X-Idempotency-Key: <ma_duy_nhat_moi_request> # Khuyến nghị khi gọi POST (chống tạo trùng khi retry mạng)
```

> **Lưu ý bảo mật:** Máy chủ gọi API của bạn cần được đăng ký **IP tĩnh (IP Whitelist)** với đội vận hành CRM. Nếu gọi từ IP chưa đăng ký, API sẽ trả về lỗi `403`.

---

## 2. Tóm Tắt 4 API Cần Dùng

| STT | Method & Endpoint | Khi nào sử dụng? |
| --- | --- | --- |
| 1 | `GET /products` | Lấy danh sách mã Sản phẩm (`code` / `id`) đã được cấu hình sẵn trên CRM |
| 2 | `GET /template` | Xem nhanh cấu trúc JSON mẫu và bảng mã Thuế suất / Loại hàng hoá |
| 3 | `POST /` | **Tạo & phát hành hoá đơn** (Gửi 1 Object để xuất 1 hoá đơn, hoặc gửi 1 Array để xuất nhiều hoá đơn cùng lúc) |
| 4 | `GET /:id` | Tra cứu lại trạng thái, Số hoá đơn, Mã tra cứu BKAV (MTC) theo mã đơn hàng `sourceId` của bạn |

---

## 3. Hai Cách Gửi Hàng Hoá Khi Tạo Hoá Đơn (`items[]`)

Khi gọi `POST /api/external/v1/invoices`, hệ thống hỗ trợ **2 cách truyền danh sách hàng hoá (`items[]`)** cực kỳ rõ ràng:

### Cách 1 — Dùng Sản phẩm đã cấu hình sẵn trên CRM *(Khuyên dùng cho Key.vn)*
- Bạn **chỉ cần gửi `itemCode` (mã SKU) hoặc `productId`** kèm số lượng `quantity`.
- Hệ thống CRM sẽ **tự động lấy 100% thông tin sản phẩm có sẵn** (Tên hàng hoá, Đơn vị tính, Đơn giá, Thuế suất VAT) để xuất hoá đơn.
- Nếu mã sản phẩm không tồn tại hoặc đang tạm ngưng trên CRM, API sẽ báo lỗi `400` ngay.

```json
"items": [
  {
    "itemCode": "ZB5000",
    "quantity": 2
  }
]
```

### Cách 2 — Tự truyền đầy đủ thông tin hàng hoá *(Khi không dùng mã Sản phẩm có sẵn)*
- Nếu bạn **không truyền** `itemCode` / `productId`, bạn **bắt buộc truyền đầy đủ các trường hợp lệ** theo loại dòng hàng hoá (`itemType`):
  - **Hàng hoá / dịch vụ thường (`"itemType": "goods"`):** Bắt buộc đủ 5 trường: `itemName` (tên hàng), `unitName` (đơn vị tính), `quantity` (`> 0`), `unitPrice` (`>= 0`), `taxRate` (thuế suất: `10`, `8`, `5`, `0`, `-1` [Không chịu thuế], `-2` [Không kê khai]).
  - **Hàng khuyến mãi (`"itemType": "promotion"`):** Bắt buộc `itemName`, `unitName`, `quantity` (`> 0`). Hệ thống tự tính đơn giá & tiền thuế = `0`.
  - **Chiết khấu thương mại (`"itemType": "discount"`):** Bắt buộc `itemName` và `amount` (`> 0`, số tiền cần giảm trừ trước thuế).
  - **Dòng ghi chú (`"itemType": "note"`):** Chỉ cần `itemName` (nội dung ghi chú hiển thị trên hoá đơn).

```json
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
    "itemName": "Thanh toán theo đơn hàng #ORD-001"
  }
]
```

---

## 4. Ví Dụ Copy-Paste Chạy Ngay

### 4.1. Xuất 1 Hoá đơn theo Mã Sản phẩm (SKU)

```bash
curl -X POST "https://final.vn/api/external/v1/invoices" \
  -H "Content-Type: application/json" \
  -H "X-Partner-Id: keyvn" \
  -H "X-API-Key: <YOUR_API_KEY>" \
  -H "X-Idempotency-Key: ord-20261120-001" \
  -d '{
    "sourceId": "ORD-20261120-001",
    "paymentMethod": "CK",
    "buyer": {
      "type": "company",
      "name": "Nguyễn Văn A",
      "unitName": "CÔNG TY TNHH GIẢI PHÁP SỐ ABC",
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

**Kết quả trả về (`201 Created`):**
```json
{
  "statusCode": 201,
  "message": "Tạo hoá đơn thành công",
  "data": {
    "id": "INV-20261120-0001",
    "status": "pending_sign",
    "invoiceForm": "1",
    "invoiceSerial": "C26MVK",
    "invoiceNo": 15,
    "lookupCode": "UBOXN28UY9",
    "lookupUrl": "https://final.vn/tra-cuu-hoa-don/UBOXN28UY9",
    "maCuaCQT": "",
    "billCode": "ORD-20261120-001",
    "sourceModule": "zcode",
    "sourceId": "ORD-20261120-001",
    "totalAmountBeforeTax": 1000000,
    "totalDiscountAmount": 0,
    "totalTaxAmount": 100000,
    "totalAmount": 1100000,
    "currency": "VND",
    "duplicate": false
  }
}
```

> **Link gửi trực tiếp cho Khách hàng cuối (`data.lookupUrl`):**  
> Khi hoá đơn được BKAV cấp Mã tra cứu (`lookupCode`), response sẽ trả về luôn trường **`data.lookupUrl`** (ví dụ: `https://final.vn/tra-cuu-hoa-don/UBOXN28UY9`). Bạn có thể gửi trực tiếp đường link này qua Email/Zalo/SMS hoặc gắn vào trang Đơn hàng cho khách hàng bấm vào xem & tải PDF/XML ngay trên giao diện sạch sẽ của CRM (không cần đăng nhập, không dính banner quảng cáo của BKAV).

> **Mẹo khi đang test tích hợp (UAT):** Bạn có thể truyền thêm `"isDraft": true` trong JSON body để CRM kiểm tra dữ liệu và tạo **hoá đơn nháp (`status: "draft"`)** mà chưa đẩy sang BKAV (không làm tốn số hoá đơn thật). Khi lên Production, bỏ `"isDraft"` (hoặc để `"isDraft": false`) để phát hành thẳng sang BKAV.

---

### 4.2. Gửi 1 Mảng để Xuất Nhiều Hoá đơn Riêng Biệt (Tối đa 30 hoá đơn / lần)

Nếu cần xuất nhiều đơn hàng cùng lúc, gửi trực tiếp **một mảng JSON `[ {...}, {...} ]`**. **Mỗi phần tử trong mảng sẽ xuất ra 1 hoá đơn riêng biệt** (đơn nào lỗi chỉ báo lỗi đơn đó, các đơn còn lại vẫn xuất bình thường):

```bash
curl -X POST "https://final.vn/api/external/v1/invoices" \
  -H "Content-Type: application/json" \
  -H "X-Partner-Id: keyvn" \
  -H "X-API-Key: <YOUR_API_KEY>" \
  -H "X-Idempotency-Key: batch-20261120-01" \
  -d '[
    {
      "sourceId": "ORD-101",
      "buyer": { "type": "personal", "name": "Khách lẻ 101", "email": "kh101@gmail.com" },
      "items": [{ "itemCode": "ZB5000", "quantity": 1 }]
    },
    {
      "sourceId": "ORD-102",
      "buyer": {
        "type": "company",
        "name": "Trần Văn B",
        "unitName": "CÔNG TY XYZ",
        "taxCode": "0309999999",
        "address": "Quận 1, TP.HCM",
        "email": "ketoan@xyz.vn"
      },
      "items": [
        {
          "itemType": "goods",
          "itemName": "Dịch vụ triển khai",
          "unitName": "Gói",
          "quantity": 1,
          "unitPrice": 1500000,
          "taxRate": 10
        }
      ]
    }
  ]'
```

---

### 4.3. Tra cứu lại Hoá đơn theo Mã đơn hàng (`sourceId`)

```bash
curl -X GET "https://final.vn/api/external/v1/invoices/ORD-20261120-001" \
  -H "X-Partner-Id: keyvn" \
  -H "X-API-Key: <YOUR_API_KEY>"
```

---

## 5. Giải Thích Nhanh Trạng Thái Hoá Đơn (`data.status`) & Mã Lỗi

### Trạng thái Hoá đơn (`data.status`)
- `"issued"`: Đã phát hành & ký số thành công trên BKAV.
- `"pending_sign"`: Đã tạo và được BKAV cấp số hoá đơn (`invoiceNo`) + mã tra cứu (`lookupCode`), đang chờ kế toán ký số.
- `"draft"`: Đang lưu nháp trên CRM (khi bạn truyền `"isDraft": true`).
- `"error"`: BKAV từ chối phát hành (xem nguyên nhân chi tiết trong trường `data.providerErrorMessage`).

### Các Mã Lỗi HTTP Thường Gặp
- **`400 Bad Request`**:
  - Gửi `itemCode`/`productId` (Cách 1) nhưng mã sản phẩm chưa tồn tại hoặc đang bị tắt trên CRM → kiểm tra danh sách qua `GET /products`.
  - Gửi hàng hoá tự định nghĩa (Cách 2) nhưng thiếu trường bắt buộc (`itemName`, `unitName`, `quantity`, `unitPrice`, `taxRate`) → đọc `message` trả về để biết chính xác trường nào đang thiếu.
  - Gửi mảng vượt quá 30 hoá đơn / request → chia nhỏ mỗi lần gửi tối đa 30 phần tử.
- **`401 Unauthorized`**: Thiếu header `X-API-Key`, sai key, hoặc `X-API-Key` không khớp với `X-Partner-Id`.
- **`403 Forbidden`**: IP máy chủ của bạn chưa được đưa vào danh sách IP Whitelist của đối tác trên CRM.
- **`404 Not Found`**: Không tìm thấy hoá đơn với mã tra cứu đã truyền (hoặc hoá đơn không thuộc đối tác của bạn).
- **`409 Conflict`**: Bạn đang gửi 2 request trùng `X-Idempotency-Key` cùng một lúc khi request đầu tiên vẫn đang chờ BKAV xử lý — hãy đợi vài giây rồi gọi lại.
- **`429 Too Many Requests`**: Vượt quá giới hạn 60 request / phút / IP (khuyến nghị gom nhiều đơn vào mảng Batch Array để tối ưu số lần gọi).
