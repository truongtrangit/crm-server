# Tài liệu Rà soát & Kế hoạch Hoàn thiện Module Hoá đơn Điện tử (BKAV eHoaDon)

> **Ngày cập nhật**: 2026-11-05  
> **Phạm vi**: Backend (`crm-server`) & Frontend (`crm-client`)  
> **Tài liệu chuẩn đối chiếu**:
> - `documents/invoice/eHoaDon_WebService_Interface.docx` (Tài liệu đặc tả kỹ thuật WebService BKAV eHoaDon)
> - `documents/invoice/DemoWSeHoaDon_Bkav/App_Code/Bkav_eHoadon_Layer.cs` (Định nghĩa hằng số & cấu trúc dữ liệu chuẩn BKAV)
> - `documents/invoice/DemoWSeHoaDon_Bkav/Default.aspx.cs` (Code mẫu tích hợp các `CmdType` của BKAV)
> - `documents/invoice/DemoWSeHoaDon_Bkav/Help/Invoice-Schema.xsd` (Schema ràng buộc dữ liệu đầu vào của BKAV)

---

## Mục lục
1. [Phần 1: Đối chiếu Sai lệch so với Tài liệu chuẩn BKAV](#phần-1-đối-chiếu-sai-lệch-so-với-tài-liệu-chuẩn-bkav)
2. [Phần 2: Các Tính năng Thừa, Chồng chéo hoặc Làm dở dang](#phần-2-các-tính-năng-thừa-chồng-chéo-hoặc-làm-dở-dang)
3. [Phần 3: Các Lỗi Logic Nghiệp vụ (Bugs) trong Code hiện tại](#phần-3-các-lỗi-logic-nghiệp-vụ-bugs-trong-code-hiện-tại)
4. [Phần 4: Kế hoạch Hành động (Master Plan - 4 Phases)](#phần-4-kế-hoạch-hành-động-master-plan---4-phases)
5. [Phần 5: Các Điểm Cần Thảo Luận / Chốt trước khi Code](#phần-5-các-điểm-cần-thảo-luận--chốt-trước-khi-code)

---

## Phần 1: Đối chiếu Sai lệch so với Tài liệu chuẩn BKAV

### 1.1. Sai bảng mã Thuế suất (`TaxRateID` vs `TaxRate`) ở cả BE và FE
- **Theo chuẩn BKAV** (`Bkav_eHoadon_Layer.cs` dòng 13–21 & `Invoice-Schema.xsd` dòng 198–213):
  - `TaxRateID` là mã định danh mức thuế (kiểu `unsignedByte`, chỉ nhận số nguyên dương `1..6`, hoặc `9` cho mức 8% theo TT78).
  - `TaxRate` là phần trăm thuế suất tương ứng:

| Mức thuế | `TaxRateID` chuẩn BKAV | `TaxRate` chuẩn BKAV | Code hiện tại (`constants/invoice.js` & FE) | Hậu quả hiện tại |
| :--- | :---: | :---: | :---: | :--- |
| **0%** | `1` | `0` | `taxRateId: 1, taxRate: 0` | Đúng |
| **5%** | `2` | `5` | `taxRateId: 2, taxRate: 5` | Đúng |
| **10%** | `3` | `10` | `taxRateId: 3, taxRate: 10` | Đúng (nhưng `ReplaceAdjustModal.tsx` dòng 24 đang để `taxRateId: 5`) |
| **8% (TT78)** | `9` | `8` | `taxRateId: 9, taxRate: 8` | Đúng |
| **Không chịu thuế (KCT)** | **`4`** | **`-1`** | `taxRateId: -1, taxRate: -1` (FE) / `taxRateId: 1, taxRate: -1` (`fromTopup`) | **LỖI**: FE gửi `taxRateId: -1` bị Joi (`min(0)`) chặn ngay lập tức; `fromTopup` gửi `taxRateId: 1` (0%) lệch với `taxRate: -1` |
| **Không kê khai nộp thuế (KKKNT)** | **`5`** | **`-2`** | `taxRateId: -2, taxRate: -2` | **LỖI**: FE gửi `taxRateId: -2` bị Joi (`min(0)`) chặn và sai chuẩn XSD của BKAV |
| **Thuế suất khác** | **`6`** | **`-4`** | Chưa định nghĩa đúng | Sai chuẩn BKAV |

- **Các file đang bị ảnh hưởng**:
  - `crm-server/src/core/constants/invoice.js` (dòng 97–108)
  - `crm-server/src/modules/invoice/adapters/BkavAdapter.js` (dòng 1003–1018)
  - `crm-client/src/features/invoice/components/InvoiceFormModal.tsx` (dòng 520)
  - `crm-client/src/features/invoice/components/ReplaceAdjustModal.tsx` (dòng 24, 277)
  - `crm-client/src/features/invoice/routes/InvoicePage.tsx` (dòng 207–208)

---

### 1.2. Hiểu sai và cấu hình sai `CmdType` (`111` vs `112`, và `120..124`)
- **Theo chuẩn BKAV** (`eHoaDon_WebService_Interface.docx` & `Bkav_eHoadon_Layer.cs` dòng 33–49):

| `CmdType` | Ý nghĩa chuẩn trong tài liệu BKAV | Mẫu số & Ký hiệu (`InvoiceForm`, `InvoiceSerial`) | Số hoá đơn (`InvoiceNo`) |
| :---: | :--- | :--- | :--- |
| **`100`** | Tạo HĐ mới (Mới tạo) | BKAV tự cấp | `InvoiceNo = 0` (chưa cấp số) |
| **`101`** | Tạo HĐ mới (HĐ Trống / Chờ ký) | BKAV tự cấp | **BKAV tự cấp số** |
| **`110`** | Tạo HĐ mới (Mới tạo) | **CRM chỉ định** | `InvoiceNo = 0` (chưa cấp số) |
| **`111`** | Tạo HĐ mới | **CRM chỉ định** | **CRM tự truyền `InvoiceNo >= 1`** (dành cho ERP tự quản lý dãy số) |
| **`112`** | Tạo HĐ mới (HĐ Trống / Chờ ký) | **CRM chỉ định** | **BKAV tự cấp số** |
| **`120`** | Tạo HĐ Thay thế | **CRM chỉ định** | `InvoiceNo = 0` (chưa cấp số) |
| **`121`** | Tạo HĐ Điều chỉnh | **CRM chỉ định** | `InvoiceNo = 0` (chưa cấp số) |
| **`123`** | Tạo HĐ Thay thế | **CRM chỉ định** | **BKAV tự cấp số** |
| **`124`** | Tạo HĐ Điều chỉnh | **CRM chỉ định** | **BKAV tự cấp số** |

- **Sai lệch trong code hiện tại**:
  1. **Mặc định `cmdType = 111` trong khi CRM luôn gửi `InvoiceNo = 0`**:
     - CRM không tự sinh số thứ tự hoá đơn mà luôn gửi `InvoiceNo: 0` để BKAV cấp số.
     - Tuy nhiên `invoiceProvider.model.js` (dòng 30), `invoice.validation.js` (dòng 106) và `ProviderFormModal.tsx` (dòng 44) lại đặt mặc định là `111`. Với mô hình CRM chỉ định Mẫu số + Ký hiệu (VD: `1` / `C25MAA`) và BKAV tự cấp số HĐ, `CmdType` chuẩn phải là **`112`**.
  2. **Hàm `_determineCmdType` trong `BkavAdapter.js` (dòng 873–889) bị ngược logic**:
     - Code đang chú thích sai rằng `120/124` là "BKAV quản lý mẫu/ký hiệu" và `123/121` là "PMKT quản lý mẫu/ký hiệu".
     - Hậu quả: Khi tạo hoá đơn **Điều chỉnh (`adjustment`)**, code dùng `121` (`InvoiceNo = 0`) thay vì **`124`** (BKAV cấp số ngay), dẫn đến lệch hành vi so với hoá đơn Thay thế (`123`).

---

### 1.3. Sai mã loại hàng hoá (`ItemTypeID`) và cách xử lý Chiết khấu / Ghi chú / Xe chuyên dùng
- **Theo chuẩn BKAV** (`Bkav_eHoadon_Layer.cs` dòng 22–31 & Phụ lục tài liệu BKAV):
  - `ItemTypeID` chỉ nhận các giá trị:
    - `0`: Hàng hoá dịch vụ thông thường
    - `1`: Thuế khác
    - `2`: Phí khác
    - `3`: Phí dịch vụ (Phí phục vụ)
    - `4`: Ghi chú / diễn giải (không tính tiền)
    - `10`: Tiền đất được giảm trừ
  - **Dòng chiết khấu**: Dùng `ItemTypeID = 0` kết hợp cờ `IsDiscount = true` (giá trị `Amount` để số dương, hệ thống BKAV tự động trừ khi hiển thị).
  - **Xe chuyên dùng (ô tô/xe máy)**: Dùng `ItemTypeID = 0` và đặt thông tin Số khung, Số máy vào `UserDefineDetails`.
- **Sai lệch trong code hiện tại**:
  - `InvoiceFormModal.tsx` (dòng 477–481) tạo ra `itemTypeId = 15` (Khuyến mại) và `itemTypeId = 21` (Xe ô tô/mô tô) không tồn tại trong chuẩn BKAV.
  - `InvoiceFormModal.tsx` (dòng 122, 148, 451) quy ước `itemTypeId === 3` là "Chiết khấu", trong khi trên BKAV `ItemTypeID = 3` là **Phí dịch vụ**!
  - Nút `+ Xe chuyên dùng` (`InvoiceFormModal.tsx` dòng 105) gán `itemTypeId: 0`, nhưng nút bấm mở popup nhập Số khung/Số máy (dòng 488) lại chỉ hiển thị khi `itemTypeId === 21` $\rightarrow$ **User bấm `+ Xe chuyên dùng` nhưng không bao giờ thấy nút nhập Số khung/Số máy**.
  - `BkavAdapter._buildDetailsList` (dòng 1040) kiểm tra `if (invoice.totalDiscount > 0)` nhưng trường trong DB là `totalDiscountAmount`, dẫn đến đoạn code này không bao giờ chạy.

---

### 1.4. Chưa tận dụng API Tải PDF / XML chuẩn của BKAV (`CmdType 804, 808, 809, 811, 813`)
- Trong `BkavAdapter.download` (dòng 449), comment ghi *"BKAV không có API download riêng qua ExecCommand"*.
- Thực tế trong tài liệu `eHoaDon_WebService_Interface.docx` (Mục 1.7.7 – 1.7.12), BKAV hỗ trợ đầy đủ:
  - `CmdType 804`: Lấy link download file PDF in chuyển đổi.
  - `CmdType 808` / `809`: Lấy chuỗi Base64 của file PDF / XML theo `PartnerInvoiceStringID`.
  - `CmdType 811` / `813`: Lấy chuỗi Base64 của file PDF / XML theo Mã tra cứu (`MTC`).

---

## Phần 2: Các Tính năng Thừa, Chồng chéo hoặc Làm dở dang

| STT | Tính năng / Thành phần | Hiện trạng | Đề xuất xử lý |
| :---: | :--- | :--- | :--- |
| **1** | **Hai nút phát hành hàng loạt chồng chéo trên UI**: `"Phát hành tất cả"` (`batch-issue`) và `"Ký HSM"` (`batch-sign-hsm`) | - Trên `InvoicePage.tsx` (dòng 652–667) hiện cùng lúc 2 nút khi tick chọn hoá đơn.<br>- Nhưng checkbox ở bảng (dòng 685, 717) chỉ cho tick HĐ `draft` hoặc `error` (không cho tick `pending_sign`).<br>- Nếu tick HĐ `draft` rồi bấm `"Ký HSM"`, BE báo lỗi 400 `"Không có hoá đơn nào có InvoiceGUID từ BKAV"`. | **Gộp thành 1 nút duy nhất `"Phát hành (N)"`**:<br>- Cho phép tick chọn cả `draft`, `error`, `pending_sign`.<br>- Khi bấm Phát hành: HĐ nào chưa đẩy lên BKAV thì tạo mới (+ tự ký HSM nếu `autoSign=true`); HĐ nào đang `pending_sign` (đã có `providerInvoiceGUID`) thì gọi thẳng ký HSM (`205`). |
| **2** | **`syncTaxStatus` (`POST /:id/sync-tax-status` - CmdType 850)** | - Có trong route, controller, service (`invoice.service.js` dòng 1185) và `InvoicePage.tsx` (dòng 240).<br>- **Không được gắn vào bất kỳ nút nào trên UI**.<br>- **Chưa được cài đặt trong `BkavAdapter.js`** (gọi sẽ lỗi).<br>- Chức năng trùng lặp với `syncFromProvider` (`CmdType 800`). | **Loại bỏ** `syncTaxStatus` ở cả FE và BE, chỉ giữ lại 1 luồng đồng bộ chuẩn là `syncFromProvider` (`CmdType 800/801`). |
| **3** | **`resendEmail` (`POST /:id/resend-email` - CmdType 901)** & toggle **`emailNotification.enabled`** | - Có trong route, service (`invoice.service.js` dòng 1239) và `InvoicePage.tsx` (dòng 253) nhưng **không gắn vào nút nào trên UI** và **không có trong `BkavAdapter.js`**.<br>- `CmdType 901` không có trong tài liệu chuẩn BKAV (BKAV tự gửi email theo `ReceiveTypeID` khi phát hành).<br>- Toggle `"Gửi email (CRM gửi HĐ qua email)"` trên `ProviderFormModal.tsx` không có logic xử lý ở BE. | **Loại bỏ** dead code `resendEmail` và ẩn toggle `"Gửi email"` trên `ProviderFormModal.tsx` để tránh gây hiểu nhầm. |
| **4** | **Giải trình CQT (`ExplainCQTModal` - CmdType 300/304)** | - Có nút trên bảng `InvoicePage.tsx` (dòng 812–820).<br>- Tài liệu WebService chuẩn của BKAV không có `CmdType 304`, còn `CmdType 300` trong bảng phụ lục có ghi chú trùng với Cập nhật/Huỷ. Nghiệp vụ thông báo sai sót Mẫu 04/SS-HĐĐT thực tế thực hiện trên cổng eHoaDon hoặc qua Huỷ/Thay thế/Điều chỉnh. | **Ẩn nút Giải trình CQT** trên bảng chính, thay thế bằng nút **Huỷ hoá đơn (`Cancel` - CmdType 201/202)** đang bị thiếu. |
| **5** | **Nhà cung cấp `SePay` (`sepay`)** | - UI `ProviderFormModal.tsx` cho phép chọn tạo NCC `SePay`, nhưng BE chưa có `SepayAdapter.js` (`AdapterFactory.js` chỉ hỗ trợ `bkav`). | **Disable / Ẩn lựa chọn `SePay`** trên UI (hoặc gắn nhãn *"Sắp hỗ trợ"*) để user chỉ tập trung cấu hình BKAV. |

---

## Phần 3: Các Lỗi Logic Nghiệp vụ (Bugs) trong Code hiện tại

### Bug 1: Hoá đơn Thay thế / Điều chỉnh bị XOÁ MẤT trên BKAV khi `autoSign = false`
- **File**: `crm-server/src/modules/invoice/invoice.service.js` (`replaceInvoice` dòng 600–619, `adjustInvoice` dòng 685–704).
- **Mô tả**:
  - Khi `provider.bkav.autoSign = false`, `BkavAdapter.replace` / `adjust` tạo hoá đơn trên BKAV thành công và trả về `{ success: true, status: 'pending_sign', providerInvoiceGUID: '...' }`.
  - Tuy nhiên `replaceInvoice` và `adjustInvoice` lại kiểm tra cứng:
    ```js
    if (result.success && result.status === INVOICE_STATUS.ISSUED) { ... }
    else {
      // Gọi adapter.delete(replacement) xoá luôn hoá đơn trên BKAV và đổi status thành ERROR!
    }
    ```
  - **Hậu quả**: Nếu cấu hình không ký tự động (`autoSign = false`), hoá đơn thay thế/điều chỉnh vừa tạo thành công trên BKAV bị chính CRM gọi lệnh xoá ngay lập tức và báo lỗi!

### Bug 2: Hoá đơn ở trạng thái `PENDING_SIGN` bị chặn không cho phát hành tiếp
- **File**: `crm-server/src/modules/invoice/invoice.service.js` (`issueInvoice` dòng 475–483).
- **Mô tả**:
  - `issueInvoice` chỉ cho phép `status` thuộc `[DRAFT, ERROR]`.
  - Dù hàm `_issueViaProvider` bên dưới (dòng 754) đã viết sẵn logic: nếu có `invoice.providerInvoiceGUID` thì chỉ gọi `adapter.signWithHSM()`, nhưng nếu hoá đơn đang ở `PENDING_SIGN` thì bị chặn ngay ở đầu hàm `issueInvoice`.

### Bug 3: Ghi đè làm mất Mã tra cứu (`lookupCode` / `MTC`) sau khi ký HSM (`CmdType 205`)
- **File**: `crm-server/src/modules/invoice/adapters/BkavAdapter.js` (`signWithHSM` dòng 500–508).
- **Mô tả**:
  - Khi tạo hoá đơn (`CmdType 100..112`), BKAV trả về `MTC` (Mã tra cứu) và CRM đã lưu vào `invoice.lookupCode`.
  - Khi gọi `signWithHSM` (`CmdType 205`), dòng 504 viết:
    `lookupCode: resultData?.MTC || resultData?.PartnerInvoiceID || ''`
  - Nếu response của `205` không trả lại `MTC` mà có `PartnerInvoiceID`, `lookupCode` của hoá đơn bị ghi đè thành `PartnerInvoiceID` (hoặc số `0`)!

### Bug 4: `batchSignWithHSM` không cập nhật kết quả vào Database
- **File**: `crm-server/src/modules/invoice/invoice.service.js` (dòng 1125–1153).
- **Mô tả**: Hàm gọi `adapter.batchSignWithHSM(guids)` xong trả thẳng kết quả về client mà không cập nhật `status: 'issued'`, `issuedAt`, `providerLog` vào MongoDB.

### Bug 5: Thiếu API và UI cho nghiệp vụ **Huỷ hoá đơn (`Cancel`)**
- **File**: `BkavAdapter.js` đã có hàm `cancel()` (dòng 350–384), nhưng:
  - Chưa có hàm `cancelInvoice` trong `invoice.service.js` & `invoice.controller.js`.
  - Chưa có route `POST /api/v1/invoices/:id/cancel` trong `invoices.routes.js`.
  - Chưa có nút **Huỷ hoá đơn** trên `InvoicePage.tsx` và `InvoiceDetailModal.tsx`.
  - Cấu trúc `CommandObject` trong `BkavAdapter.cancel` cần chuẩn hoá lại theo đúng `Default.aspx.cs` (dòng 168–185).

### Bug 6: Thiếu trường trong Mongoose Schema (`invoice.model.js`)
- **File**: `crm-server/src/modules/invoice/invoice.model.js`.
- **Mô tả**: Các trường sau đã có ở UI / Validation / Adapter nhưng thiếu trong Schema nên bị Mongoose tự động cắt bỏ khi lưu:
  1. `maCuaCQT` (Mã của Cơ quan thuế cấp)
  2. `buyer.code` (Mã khách hàng — `BuyerCode`)
  3. `items[].itemCode` (Mã hàng hoá — `ItemCode`)
  4. `attachFiles` (Danh sách file đính kèm)

### Bug 7: Tạo trùng nhiều Hoá đơn cho cùng 1 Phiếu nạp tiền (`TopupRequest`) & Lỗi `SystemLog`
- **File**: `crm-server/src/modules/invoice/invoice.service.js`.
- **Mô tả**:
  - Trong `createInvoice` (dòng 121–129): Không kiểm tra xem `topupRequestId` có tồn tại thật không, và không chặn khi `topupRequestId` đó đã được xuất hoá đơn (chưa bị xoá/huỷ).
  - Trong `_writeSystemLog`: truyền `action: 'sync'` và `'email'` không có trong enum `SYSTEM_LOG_ACTIONS` của `systemLog.model.js` $\rightarrow$ gây `ValidationError` ngầm mọi lần gọi.
  - Các hàm `getInvoiceById`, `updateInvoice`, `deleteInvoice`, `issueInvoice`, `getQuota`, `deleteProvider` dùng `findById(id)` mà thiếu điều kiện `isDeleted: { $ne: true }`.

---

## Phần 4: Kế hoạch Hành động (Master Plan - 4 Phases)

### Phase 1: Chuẩn hoá Tích hợp BKAV theo đúng Tài liệu (`documents/invoice`)
- [ ] **1.1. Sửa bảng mã `TaxRateID` & `TaxRate`**:
  - Cập nhật `BKAV_TAX_RATE_IDS` trong `src/core/constants/invoice.js`: `TAX_0: 1`, `TAX_5: 2`, `TAX_10: 3`, `TAX_KCT: 4`, `TAX_KKK: 5`, `TAX_KHAC: 6`, `TAX_8: 9`.
  - Viết hàm helper `resolveBkavTaxRate(item)` trong `BkavAdapter.js` đảm bảo mọi dòng hàng gửi sang BKAV đều có cặp `{ TaxRateID, TaxRate }` hợp lệ theo `Invoice-Schema.xsd`.
  - Sửa `rateIdMap` ở `InvoiceFormModal.tsx`, `ReplaceAdjustModal.tsx` và prefill `fromTopup` ở `InvoicePage.tsx`.
- [ ] **1.2. Chuẩn hoá `CmdType` (`100..112` & `120..124`)**:
  - Đổi mặc định `cmdType` từ `111` sang **`112`** tại `invoiceProvider.model.js`, `invoice.validation.js` và `ProviderFormModal.tsx`.
  - Sửa `BkavAdapter._determineCmdType`:
    - Hoá đơn thường: nếu cấu hình `111` nhưng `invoiceNo === 0` thì tự chuyển sang `112`.
    - Hoá đơn thay thế (`replacement`): dùng `123` (BKAV cấp số) hoặc `120` (chưa cấp số).
    - Hoá đơn điều chỉnh (`adjustment`): dùng `124` (BKAV cấp số) hoặc `121` (chưa cấp số).
- [ ] **1.3. Chuẩn hoá `ItemTypeID` & Dòng hàng đặc biệt (`IsDiscount`, Ghi chú, Xe chuyên dùng)**:
  - Sửa `BkavAdapter._buildDetailsList`: chỉ gửi `ItemTypeID` hợp lệ (`0, 1, 2, 3, 4, 10`), sửa `invoice.totalDiscount` thành `invoice.totalDiscountAmount` (tránh nhân đôi nếu đã có dòng `isDiscount: true`).
  - Sửa dropdown loại hàng hoá và nút `+ Xe chuyên dùng`, `+ Chiết khấu`, `+ Ghi chú` trên `InvoiceFormModal.tsx`.
- [ ] **1.4. Chuẩn hoá API Huỷ (`CmdType 201/202`) & Tải PDF/XML (`CmdType 808/809`)**:
  - Sửa `BkavAdapter.cancel` gửi đúng payload `InvoiceDataWS`.
  - Cập nhật `BkavAdapter.download` hỗ trợ lấy dữ liệu PDF/XML (`CmdType 808/809`) kèm link tra cứu.

### Phase 2: Sửa Lỗi Logic Nghiệp vụ ở Backend (`crm-server`)
- [ ] **2.1. Cập nhật Schema `invoice.model.js`**:
  - Bổ sung `maCuaCQT`, `buyer.code`, `items[].itemCode`, `attachFiles`.
- [ ] **2.2. Hợp nhất và sửa luồng Phát hành & Ký HSM (`invoice.service.js`)**:
  - Cho phép `issueInvoice` xử lý cả trạng thái `DRAFT`, `ERROR`, và `PENDING_SIGN`.
  - Khi `status === 'pending_sign'` và đã có `providerInvoiceGUID`, `issueInvoice` gọi thẳng `signWithHSM`.
  - Sửa `BkavAdapter.signWithHSM` không ghi đè `PartnerInvoiceID` vào `lookupCode`.
  - Sửa `batchSignWithHSM` lưu đầy đủ trạng thái vào DB.
- [ ] **2.3. Sửa luồng Thay thế (`replaceInvoice`) & Điều chỉnh (`adjustInvoice`)**:
  - Chấp nhận trạng thái `PENDING_SIGN` là thành công (khi `autoSign = false`), **không gọi `adapter.delete()`** xoá nhầm hoá đơn vừa tạo trên BKAV.
  - Cập nhật hoá đơn gốc sang `REPLACED` / `ADJUSTED` đúng thời điểm.
- [ ] **2.4. Bổ sung API Huỷ hoá đơn (`POST /api/v1/invoices/:id/cancel`)**:
  - Thêm validation, controller, service `cancelInvoice(id, reason, userId)`.
- [ ] **2.5. Ràng buộc an toàn dữ liệu**:
  - Kiểm tra tồn tại `TopupRequest` và chặn tạo trùng hoá đơn cho cùng 1 `topupRequestId` (trừ khi HĐ cũ đã `cancelled` hoặc xoá).
  - Bổ sung `isDeleted: { $ne: true }` vào toàn bộ câu query trong `invoice.service.js`.
  - Sửa `action` trong `_writeSystemLog` khớp với `SYSTEM_LOG_ACTIONS`.
  - Xoá bỏ 2 route/service dư thừa `syncTaxStatus` và `resendEmail`.

### Phase 3: Tinh gọn & Hoàn thiện Giao diện Frontend (`crm-client`)
- [ ] **3.1. Tinh gọn thanh công cụ & bảng danh sách (`InvoicePage.tsx`)**:
  - Gộp 2 nút `"Phát hành tất cả"` và `"Ký HSM"` thành 1 nút **"Phát hành (N)"**; cho phép tick chọn cả `draft`, `error`, `pending_sign`.
  - Thay nút `"Giải trình CQT"` bằng nút **"Huỷ hoá đơn"** (mở modal xác nhận + nhập lý do huỷ).
  - Xoá các hàm dead code `handleSyncTaxStatus`, `handleResendEmail`.
- [ ] **3.2. Hoàn thiện `InvoiceDetailModal.tsx`**:
  - Hiển thị đầy đủ `Mã CQT` (`maCuaCQT`), `Mã tra cứu` (`lookupCode`), lý do huỷ/thay thế/điều chỉnh.
  - Bổ sung nút **Tải PDF** và **Huỷ hoá đơn**.
- [ ] **3.3. Hoàn thiện `ProviderFormModal.tsx`**:
  - Đặt mặc định `CmdType = 112` (mô tả rõ từng `CmdType` theo đúng tài liệu BKAV).
  - Ẩn toggle `"Gửi email (CRM gửi HĐ qua email)"` và ẩn/disable nhà cung cấp `SePay` chưa sử dụng.

### Phase 4: Kiểm thử End-to-End & Nghiệm thu (Verification)
- [ ] **4.1. Kiểm tra Typecheck & Build**:
  - Chạy `tsc --noEmit` trên `crm-client` và kiểm tra khởi động `crm-server`.
- [ ] **4.2. Kiểm thử toàn bộ kịch bản nghiệp vụ**:
  - Cấu hình Provider BKAV Demo $\rightarrow$ Test kết nối (`904`) $\rightarrow$ Xem hạn mức (`904`).
  - Tạo HĐ từ `TopupRequest` (thuế KCT: `TaxRateID = 4, TaxRate = -1`) & tạo HĐ trực tiếp $\rightarrow$ Sửa nháp $\rightarrow$ Phát hành (`112` + `205`).
  - Đồng bộ trạng thái từ BKAV (`800`) $\rightarrow$ Tải PDF/XML (`808/809`).
  - Thay thế HĐ (`123`) $\rightarrow$ Điều chỉnh HĐ (`124`) $\rightarrow$ Huỷ HĐ (`201/202`).

---

## Phần 5: Các Điểm Cần Thảo Luận / Chốt trước khi Code

Để việc triển khai khớp 100% với nhu cầu vận hành thực tế của bạn, chúng ta có thể chốt nhanh 4 câu hỏi sau:

1. **Chế độ ký số mặc định (`autoSign`)**:
   - Bên bạn dùng **HSM (Chữ ký số tập trung trên server BKAV)** để khi bấm "Phát hành" là tự động tạo + ký số luôn (`autoSign = true`), hay kế toán chỉ đẩy nháp lên BKAV rồi vào cổng web `ehoadon.vn` cắm USB Token để ký (`autoSign = false`)?
   - *(Lưu ý: Plan hiện tại hỗ trợ mượt cả 2 chế độ nhờ việc sửa lỗi trạng thái `PENDING_SIGN`).*
2. **Mức thuế mặc định khi tạo hoá đơn từ Phiếu nạp tiền (`fromTopup`)**:
   - Hiện tại code đang để **Không chịu thuế** (`TaxRate = -1`, `TaxRateID = 4`). Bạn muốn giữ mặc định là **Không chịu thuế (KCT)** hay đổi sang **8% / 10%**?
3. **Tính năng Giải trình CQT (`ExplainCQTModal`)**:
   - Bạn đồng ý **ẩn nút Giải trình CQT** trên bảng và thay bằng nút **Huỷ hoá đơn (`Cancel`)** (kèm Thay thế / Điều chỉnh là đủ bộ 3 nghiệp vụ xử lý hoá đơn sai sót) chứ?
4. **Nhà cung cấp `SePay`**:
   - Hiện tại chưa có `SepayAdapter` ở Backend, bạn có đồng ý tạm ẩn tuỳ chọn `SePay` trên form cấu hình NCC để tránh user chọn nhầm bị lỗi không?

