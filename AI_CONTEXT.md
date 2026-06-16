# Bản đồ Kiến trúc & Logic Backend (AI_CONTEXT.md)

> **QUAN TRỌNG (AI WORKFLOW INSTRUCTION):** 
> 1. Trợ lý AI **BẮT BUỘC** phải đọc qua file `AI_CONTEXT.md` này trước khi implement bất kỳ tính năng nào để hiểu rõ cấu trúc source code, quy tắc (rules), và conventions. Sau đó mới tiến hành code.
> 2. Sau khi thực thi xong, nếu có phát sinh logic mới, component mới hoặc convention mới, **BẮT BUỘC** phải ghi chép lại/cập nhật vào file `AI_CONTEXT.md` này để giữ đồng bộ kiến thức cho các phiên làm việc tiếp theo.
> 3. Sau khi implement tính năng hoặc sửa bug, **BẮT BUỘC** phải kiểm tra cú pháp (syntax/linter) và đảm bảo server BE khởi động thành công, không bị crash trước khi kết thúc công việc.
---

## 1. Kiến trúc luồng xử lý (Data Flow)
Mô hình xử lý chuẩn 1 chiều: `Client Request` -> `Route (v1)` -> `Middleware (Auth, RBAC, Validate)` -> `Controller` -> `Service (Business Logic)` -> `Model (MongoDB/Redis)` -> `Response (JSON)`.

### 1.1 Luồng Middleware (Người gác cổng)
- **`auth.js`**: Xác thực `Bearer token` qua mã băm, update throttle `lastUsedAt` (5 phút/lần) giảm tải DB.
- **`resourceAccess.js`**: **Lõi bảo mật Data (Resource-Level Access Control - RLAC)**.
  - Áp dụng triệt để Mô hình Phân quyền 3 Lớp: Route Permission -> Resource Access -> Business Logic.
  - Quy tắc động: OWNER/ADMIN qua hết; MANAGER chỉ được can thiệp vào data của cấp dưới; STAFF chỉ được tương tác data do mình tạo (`createdBy`) hoặc phụ trách (`assignees`).
  - Chặn việc gán việc/nhận việc bừa bãi (`enforceAssignmentRules`): STAFF chỉ được tự nhận, MANAGER được giao cho lính. Tự động build câu query lọc data (`scopeResourceList`) gắn vào request (`req.resourceScopeFilter`).
- **`validate.js`**: Validate input payload bằng Joi Schema, tự động loại bỏ rác (`stripUnknown`).
- **`webhookAuth.js`**: Chặn và xác thực riêng các payload đẩy về từ dịch vụ ngoài thông qua 3 bước: `checkIpAllowlist` (Whitelist IP), `verifyWebhookToken` (Bearer Token dùng `crypto.timingSafeEqual`), và `checkIdempotency` (Chống trùng lặp event bằng header `X-Webhook-Delivery-Id`).

---

## 2. Cấu trúc thư mục (`/src`)
Cấu trúc BE đã được cấu trúc hóa theo dạng Domain-Driven Design (Modular).

- `/core`: Chứa các module cốt lõi dùng chung (Shared Core):
  - `/core/config`: Cấu hình hệ thống DB, Redis, Môi trường.
  - `/core/middleware`: Chứa nhóm lõi bảo mật phân quyền (Auth, RLAC).
  - `/core/constants`: Hằng số dùng chung toàn hệ thống.
  - `/core/utils`: Các hàm tiện ích dùng chung (`sendSuccess`, v.v.).
- `/modules`: **Nơi chứa toàn bộ Logic nghiệp vụ cốt lõi**, phân tách theo từng Domain (VD: `customer`, `lead`, `event`, `finance`, `hr`, `job`, `course`...). Mỗi module tự đóng gói `Controller`, `Service`, `Model`, `Validation` của riêng nó.
- `/routes`: Endpoint APIs tập trung định tuyến.
  - `/routes/v1`: APIs cho nội bộ CRM Client.
  - `/routes/external/v1`: APIs công khai cho các Client ngoài (VD: `botvn`).
- `/scripts`: Script chạy migration, reset DB, mock data tự động.

---

## 3. Bản đồ Nghiệp vụ Chi tiết (Feature Logic Map)

### 3.1 Khách hàng & Phễu (Customers, Leads, Funnels)
- **Logic**:
  - `CustomerService`: Phân tách rạch ròi Khách Doanh nghiệp (BIZ) và Cá nhân (USER). Với BIZ, tự động nối thông tin gói `Subscription` và `members`. Xóa phải check referential integrity (nếu còn gắn Event thì chặn xóa).
  - **Chỉ mục độc bản (Unique Indexes)**:
    - Để hỗ trợ một khách hàng cá nhân (`mainType: 'user'`) có thể tạo hoặc sở hữu nhiều doanh nghiệp (`mainType: 'biz'`) dùng chung email/phone cá nhân, các chỉ mục độc bản (`unique: true`) trên `email` và `phone` là **Chỉ mục bán phần (Partial Indexes)** chỉ áp dụng cho tài khoản có `mainType === 'user'`.
    - Đối với tài khoản doanh nghiệp (`mainType: 'biz'`), hệ thống áp dụng chỉ mục độc bản bán phần trên trường `alias` để đảm bảo định danh của mỗi Biz luôn luôn là duy nhất.
  - `LeadService`: Khi tạo Lead, tự dò (auto-map) `customerId` nếu email/phone trùng khớp. Hệ thống tự log chi tiết mọi hành vi cập nhật qua `computeChanges()`. Khi archive lead, bắt buộc phải ở trạng thái cuối của phễu.
  - `FunnelService`: Khởi tạo và vận hành phễu chăm sóc khách hàng (Stage mapping).

### 3.2 Sự kiện, Tự động hóa & Webhook (Events, Automations)
Đây là module mạnh mẽ nhất hệ thống:
- **Logic**:
  - **Events**: Quản lý các lịch trình, meeting liên kết với Khách hàng / Lead.
  - **EventChains & ActionConfig**: Trình tự động hóa (Automations). Khi một sự kiện xảy ra (VD: Đổi trạng thái Lead), kích hoạt một chuỗi các thao tác: Cập nhật biến số, gửi Email, tạo Task, bắn Notification. Có lưu log vào `AutomationLog`.
  - **Webhooks & Meta Integration**: Cổng nhận dữ liệu tự động từ các nền tảng (VD: Facebook Webhooks) qua thư mục route `/api/v1/webhooks`.
    - Các API đã kiểm chứng (Verified): `new-login`, `new-registration`, `new-business`, `expiring-subscription`, `order-create`, `order-active`, `upgrade-required`.
    - Payload gửi lên không cần wrapper dư thừa, CRM tự định tuyến logic dựa trên URL Endpoint. Toàn bộ data sẽ tự động chuyển hóa thành Customer/Lead/Event và kích hoạt chuỗi Automation tương ứng.

### 3.3 Tổ chức, Nhân sự & Công việc (Organization, Users, Tasks)
- **Logic**:
  - `TaskService`: Giao việc, chuyển trạng thái. Đặc biệt: Tự động `close` hàng loạt Task nếu như Lead liên kết với Task đó bị xóa mềm hoặc lưu trữ.
  - RBAC cấp phát linh hoạt, kết hợp kiểm soát đa phiên (multi-session) với access token và refresh token ở `AuthService`.
  - `OrganizationService`: Duy trì và cấp phát dạng cây phòng ban, phân quyền quản lý (Manager).
  - `FunctionalGroupService`: Quản lý các Khối chức năng (BOD, Sale, Kỹ thuật...). ID được cấp phát tuần tự với tiền tố `FNG`. Các khối này đóng vai trò phân nhóm cấp cao cho hệ thống tổ chức. Việc quản lý (CRUD) bị giới hạn chặt chẽ (hiện tại do giao diện ràng buộc chỉ cấp cho `OWNER` và `ADMIN`, bảo vệ qua RBAC bằng module `staff.organization`).
  - `StaffService`: Quản lý hồ sơ nhân sự và cấu hình lương. Nhân sự (Staff) được liên kết với `userId` (tuỳ chọn) nhưng tổ chức lưu trữ hoàn toàn tách biệt với User đăng nhập. Chứa danh sách các cấu hình lương (`salaryConfigs`) chia tỉ lệ chi trả theo công ty (companyProportions). Dữ liệu này hiển thị dưới dạng Kanban tại màn hình Tài chính (Finance).
  - **Quy tắc phân quyền phòng ban & nhóm (Lead/Member Rules)**:
    - *Chỉ OWNER/ADMIN* mới được phép thay đổi danh sách phòng ban hoặc cập nhật vai trò Lead của phòng ban. Tuy nhiên, *Trưởng phòng ban (Lead)* được quyền thêm hoặc gỡ nhân viên khác vào phòng ban do họ quản lý với vai trò là `member` (bao gồm cả khi tạo nhân viên mới hoặc chỉnh sửa nhân viên cũ).
    - *Chỉ Trưởng phòng ban (Lead của phòng ban đó)* mới được phép thay đổi nhóm con hoặc cập nhật vai trò Lead/Member của nhóm thuộc phòng ban đó cho nhân sự.
    - *Trưởng phòng ban không được phép* thay đổi/gán/gỡ thông tin của Trưởng phòng ban khác thuộc cùng phòng ban.
    - *Trưởng nhóm không được phép* thay đổi/gán/gỡ thông tin của Trưởng nhóm khác thuộc cùng nhóm.
    - **Quy tắc lấy danh sách nhân viên của Trưởng phòng (Manager list query)**:
      - Khi Trưởng phòng ban (MANAGER) truy cập danh sách nhân viên, hệ thống chỉ hiển thị các nhân sự thuộc phòng ban hoặc nhóm mà Manager đó làm Trưởng phòng (Lead), đồng thời luôn hiển thị chính tài khoản Manager đó.
      - Nếu Manager chưa được gán bất kỳ vai trò `lead` cụ thể nào trong cấu trúc `departments` hoặc `groups`, hệ thống sẽ tự động đối chiếu ngược (fallback) để gán quyền quản lý của các phòng ban họ đang thuộc về làm phạm vi hiển thị, đảm bảo không bị rỗng danh sách.
      - **Manager KHÔNG bao gồm các Lead khác cùng cấp**: Nghĩa là Lead của phòng Sale không có quyền quản lý một Lead khác cũng thuộc phòng Sale, và Lead của nhóm A không có quyền quản lý Lead khác của nhóm A. Tuy nhiên, Lead của phòng thì toàn quyền với tất cả các nhóm con bên trong (nghĩa là quản lý được cả Lead của nhóm con đó).
    - **Quy tắc phân công công việc (Assignment Rules)**:
      - **"Chung vai trò và dưới quyền quản lý"**: Một user (kể cả Manager hay Staff) chỉ được phép phân công (assign) Task/Event/Lead cho người khác nếu thỏa mãn đồng thời 2 điều kiện:
        1. Người được giao phải có **chung ít nhất một vai trò (function)** với người giao.
        2. Người được giao phải nằm **dưới quyền quản lý** của người giao (thuộc danh sách Subordinates đã loại bỏ Lead cùng cấp ở trên).
      - Mọi thao tác gán không hợp lệ sẽ bị Backend chặn (Lỗi 403) qua middleware `enforceAssignmentRules` (sử dụng cờ `allowSameFunctionAssignment: true`). Trên Frontend, các dropdown chọn "Vai trò" (Function) chỉ hiển thị các vai trò mà chính user đang sở hữu (ngăn việc User A chọn một vai trò mà mình không có để gán cho người khác).
    - **Quy tắc phân quyền Module trực tiếp (Module Access Rules)**:
      - *Chỉ OWNER/ADMIN* mới được phép cấu hình, thay đổi hoặc gán quyền hạn trực tiếp (`moduleAccess`) cho nhân sự ở cả Backend và Frontend.
      - Ẩn hoàn toàn bảng cấu hình Module Access (`ModuleAccessPanel`) trên giao diện người dùng nếu tài khoản đang đăng nhập không phải là OWNER hoặc ADMIN.
    - **Quy tắc phân quyền phân hệ Logs (Logs Permission & Tab access)**:
      - Phân hệ Logs được phân rã thành 3 module con độc lập: `logs.system` (System Logs), `logs.webhook` (Webhook Logs) và `logs.blockautomation` (Block Automation Logs).
      - Backend gán 3 quyền tương ứng là `logs_system_read`, `logs_webhook_read`, và `logs_automation_read`, bảo vệ chặt chẽ độc lập các đầu API `/api/v1/logs/*`.
      - Giao diện UI (`LogsPage.tsx`) chỉ hiển thị đúng các tab được cấp quyền trong `moduleAccess` của tài khoản, tự động chọn tab khả dụng đầu tiên làm mặc định khi truy cập.
      - **Tương tự với phân hệ Tài chính (Finance)**: Tính năng Báo cáo Dashboard Tài chính thuộc `FINANCE_READ` (route `finance.dashboard`), bảo vệ API `/api/v1/finance/dashboard`. Các tính năng khác của finance bảo vệ riêng rẽ (`REVENUES_READ`, `EXPENSES_READ`, v.v.). Giao diện `FinancePage.tsx` dựa vào MLAC để hiển thị các tab.

### 3.4 Quản lý Lương & Tài chính (Finance & Salary)
- **Logic Doanh thu (Revenue)**:
  - `RevenueService`: Quản lý danh mục doanh thu (`RevenueCategory`) và các khoản thu (`Revenue`).
  - **Tự động sinh ID**: Danh mục sẽ tự động cấp ID dạng `RVCxxx`. Các khoản thu tự động cấp mã đơn (orderId) dạng `[PREFIX]-[YYMM]-[STT]`, trong đó `PREFIX` được nội suy (extract) từ các chữ cái đầu của tên danh mục (Ví dụ: "Gói cước CRM" -> `GCC`).
  - **Thống kê (Stats)**: Tính toán tổng doanh thu theo tháng/năm, và gom nhóm (group) theo từng danh mục. Tự động loại bỏ các khoản thu có trạng thái `Đã hủy` khỏi biểu đồ KPI tổng.
- **Logic Tính lương (Salary)**:
  - `SalaryService`: Chịu trách nhiệm sinh bảng lương (`generateSalaryForMonth`). Tự động đối chiếu `onboardDate` và `resignationDate` để loại trừ các nhân sự chưa vào hoặc đã nghỉ việc trước tháng tính lương.
  - Tự động lấy `basicSalary` (Lương cơ bản) dựa trên lịch sử `salaryConfigs` của nhân sự, chọn bản ghi có `effectiveDate` phù hợp nhất tính tới cuối tháng đó.
  - Lương cơ bản mặc định được lấy từ cấu hình, tuy nhiên hệ thống cho phép **sửa trực tiếp** Lương cơ bản trong bảng lương tháng đó qua `batchUpdateSalaries`.
  - **Công thức tính toán (Đã Fix Fixes)**:
    - `total` (Thực nhận) = `basicSalary` (Lương cơ bản) + `allowance` (Phụ cấp) + `bonus` (Thưởng) - `penalty` (Phạt) + `ot` (OT).
    - `finalReceivedAmount` (Về tay) = `total` (Thực nhận) - `deduction` (Khấu trừ).
  - Khi thanh toán lương (`paySalary`), hệ thống tự động lưu trữ thông tin **Người duyệt chi** (`paidBy`) bằng `req.user._id`.

---

## 4. Quy tắc & Ràng buộc (Conventions) thực tế đang áp dụng
1. **Tương tác Database**: Phần lớn hệ thống định tuyến logic xử lý Database vào tầng Service. Tuy nhiên, một số Controller đặc thù (ví dụ: `EventActionChainController`, `TaskActionChainController`) vẫn đang trực tiếp tương tác với DB (gọi `findOne`, `save`, v.v.). Mục tiêu dài hạn là tách hoàn toàn logic DB khỏi Controller.
2. **Quy tắc Xóa dữ liệu (Delete)**: Hiện tại, codebase đang kết hợp cả Soft Delete và Hard Delete:
   - Các Model cốt lõi (`Event`, `Task`, `Lead`, `EventActionChain`...) sử dụng plugin Soft Delete (`isDeleted=true` hoặc `isArchived=true`) để bảo toàn dữ liệu tham chiếu (Analytics).
   - Tuy nhiên, các cấu hình, meta, và danh mục (`ActionConfig`, `Funnel`, `RevenueCategory`, `LeadStatus`, v.v.) vẫn đang thực thi Hard Delete (`deleteOne`, `findOneAndDelete`). 
   - **Xóa danh mục đang sử dụng (Force Delete)**: Khi một danh mục (ví dụ `RevenueCategory`) đang được sử dụng (có records liên kết), thao tác xóa mặc định sẽ bị chặn và trả về lỗi `RESOURCE_IN_USE`. Nếu User chọn "Force Delete" (gửi `?force=true`), backend sẽ tự động cập nhật tất cả records liên quan thành trạng thái `null` (Chưa phân loại/Empty) trước khi thực hiện Hard Delete danh mục đó.
3. **Xử lý Lỗi (Error Handling)**: Express 5 tự động hứng async errors để chuyển sang Global Error Handler. Chuẩn mong muốn là Controller không chứa `try/catch`, chỉ gọi hàm service, ném `throw createHttpError(...)` từ Service và return `sendSuccess`. Trên thực tế, một số Controller (`AuthController`, `OrganizationController`, `RbacController`) vẫn đang sử dụng cấu trúc `try/catch`.
4. **Primary Key (Định danh ID)**: Codebase sử dụng một trường custom tên là `id` dạng chuỗi (String) với logic sinh mã riêng (`generateMonotonicId` với các prefix như `EAC-`, `TAC-`, `RVC...`) làm định danh chính để tương tác API thay cho `_id` mặc định (ObjectId) của MongoDB. 
   - **Quy tắc quan trọng (ID Generation Rule)**: Việc khởi tạo `id` mới thông qua hàm `generateMonotonicId` **BẮT BUỘC** phải được thực hiện ở tầng **Service** (ví dụ bên trong hàm `createXxx()`) trước khi truyền vào payload tạo document. **TUYỆT ĐỐI KHÔNG** được nhúng logic sinh ID này vào bên trong Mongoose Model (như dùng hook `pre('save')`), để đảm bảo tính minh bạch, tách biệt Database Layer với Business Logic, và tránh lỗi phát sinh khi bulk insert hoặc query nội bộ.
5. **Chuẩn hóa Response**: Toàn bộ kết quả trả về API được wrapper lại thông qua các hàm tiện ích `sendSuccess` và `sendError` (từ thư mục `utils/http`).
6. **Naming convention**: Variable/Function là `camelCase`, Model/Schema là `PascalCase`.
7. **Quy tắc phân quyền cấu hình (RBAC Config)**: Các API liên quan đến thao tác cài đặt, cấu hình của một phân hệ (ví dụ Cấu hình loại doanh thu, doanh thu dự kiến) sẽ sử dụng quyền có hậu tố `_CONFIG` (ví dụ `REVENUES_CONFIG`) thay vì các quyền Read/Create/Update/Delete cụ thể. Điều này giúp tách biệt rạch ròi quyền "Quản trị hệ thống/cấu hình" khỏi quyền "Tương tác dữ liệu hằng ngày".
8. **Đường dẫn thư mục (Directory Pathing)**: Thư mục chứa middleware có tên là `src/middleware` (số ít, KHÔNG có chữ 's' ở cuối). Chú ý khi import `validate` (VD: `const validate = require("../../middleware/validate");`).
9. **Import Phân quyền**: Middleware `requirePermission` được đặt trong file `auth.js`. Do đó, khi cần check quyền ở các routes, bắt buộc import từ `middleware/auth` (VD: `const { requirePermission } = require("../../middleware/auth");`), KHÔNG phải từ `middleware/rbac.js`.
10. **Syntax Checking Rule**: Mỗi khi generate feature mới, BẮT BUỘC recheck lại full syntax bằng lệnh `node -c <file>` ở BE để kiểm chứng.
11. **Backend Controller & Service Convention**: 
    - Các file Controller phải có đuôi `.controller.js` và file Service phải có đuôi `.service.js` (ví dụ: `courseOnline.controller.js`, `courseOnline.service.js`).
    - Việc phản hồi HTTP (sử dụng hàm `sendSuccess`, `sendError` từ thư mục `core/utils/http`) và trích xuất tham số từ `req`/`res` **BẮT BUỘC** chỉ được thực hiện ở tầng Controller.
    - Tầng Service chỉ tập trung xử lý Business Logic và trả về dữ liệu thô (raw data object) hoặc ném lỗi (throw error), tuyệt đối không nhận/trả đối tượng `req`/`res`.
    - Các hàm trong file controller KHÔNG dùng khối `try/catch`. Hệ thống sẽ tự động handle các promise rejection. Các controller hiện có nếu dùng `try/catch` cần được gỡ bỏ để thống nhất convention.
12. **RBAC API Pre-fetching Rule (Module Data Filtering)**: Bất cứ khi nào Front-end (FE) thêm một Module/Tab mới có gọi API pre-fetch dữ liệu tham chiếu, BẮT BUỘC rà soát lại `MODULE_TO_PERMISSIONS_MAP` trong `src/constants/rbac.js`. Nếu user được cấp quyền đọc đối tượng do hưởng "ké" từ module khác, trong Controller API `GET` ở BE, phải sử dụng hàm `hasModuleAccess(req.user, 'moduleId')` để kiểm tra và CHỈ ĐƯỢC TRẢ VỀ CÁC FIELD CƠ BẢN (VD: id, name, email, phone, avatar) nhằm bảo vệ dữ liệu nhạy cảm.
13. **RBAC Resource Mutation Rule (Row-Level Security cho Thao tác Thay đổi)**:
    - BẮT BUỘC có logic kiểm tra quyền (RLS) trước khi mutate data (chưa đủ nếu chỉ dựa vào Role Permissions). Các controller API bắt buộc truyền `req.user` xuống Service layer.
    - Thêm helper bảo mật ẩn ở level service (VD: `_checkAccess(item, user, action)`) tuân thủ quy tắc:
      - **Tạo mới (Create)**: Entity Database Schema bắt buộc lưu `createdBy`. Khi tạo mới luôn gán `createdBy = currentUser.id`. Nếu có mảng `assignees`, tự động gán `currentUser.id` vào mảng này (đối với non-admin) để người tạo không bị mất quyền.
      - **Quyền Xoá / Sắp xếp (Delete / Reorder)**: Giới hạn hoàn toàn chỉ cho phép thao tác nếu User thoả 1 trong 3 điều kiện: (1) **Admin/Owner**, (2) **Người trực tiếp tạo ra tài nguyên đó** (`createdBy === user.id`), hoặc (3) **Quản lý (Manager/Lead) của người tạo** (Sử dụng hàm `getManagerSubordinateIds` có sẵn để check `isManagerOfCreator`).
      - **Quyền Cập nhật (Update)**: Cho phép thao tác nếu User thoả mãn quyền Delete ở trên, HOẶC là **Người được phân công (Assignee)** của tài nguyên đó.
    - Các hành động `update`, `delete`, `reorder` cần được định nghĩa dưới dạng constant (tạo trong thư mục constants) và tái sử dụng.
14. **Decoupling Resource Access Middleware Rule**:
    - Mọi định nghĩa cấu hình middleware liên quan đến phân quyền cấp row-level (RLS/MLAC) sử dụng các factory functions như `requireResourceAccess`, `enforceAssignmentRules`, `enforceUnassignmentRules`, `scopeResourceList`, v.v. **TUYỆT ĐỐI KHÔNG** được khai báo trực tiếp (inline) trong các file định tuyến `src/routes/v1/*.js`.
    - BẮT BUỘC phải tách (extract) các cấu hình này ra thành các file riêng biệt đặt trong thư mục `src/middleware/` với quy tắc đặt tên là `[module]Access.js` (ví dụ: `taskAccess.js`, `eventAccess.js`, `leadAccess.js`, `userAccess.js`).
    - Các file trong `routes/v1/` chỉ đơn thuần import các hằng số phân quyền từ file `[module]Access.js` và cắm vào router chain, đảm bảo file route ngắn gọn, minh bạch. Xoá triệt để các lệnh import Mongoose Models dư thừa trong file routes.
15. **Quy tắc ghi nhật ký hệ thống (System Audit Logging Convention)**:
    - Bất kỳ thao tác ghi (write mutations) quan trọng nào bao gồm tạo mới (`create`), cập nhật (`update`), xóa (`delete`/`force_delete`), khôi phục (`restore`), đăng nhập (`login`), và đăng xuất (`logout`) đều **BẮT BUỘC** phải được ghi nhận lịch sử vào cơ sở dữ liệu `SystemLog` tập trung.
    - Việc ghi log thực hiện ở tầng **Controller** thông qua `SystemLogService.log` dưới dạng bất đồng bộ (fire-and-forget), truyền `req` để tự động bóc tách địa chỉ IP và người thực hiện tác vụ (`req.user`).
    - Cấu trúc chuẩn của một lệnh ghi log hệ thống:
      ```javascript
      SystemLogService.log({
        action: "create" | "update" | "delete" | "login" | "logout" | "restore",
        resource: RESOURCES.X, // import từ constants/rbac
        resourceId: target.id || target._id?.toString(),
        resourceName: target.name || target.orderId,
        description: `Mô tả chi tiết hành động bằng tiếng Việt (Ví dụ: Tạo doanh thu thực tế: "${revenue.orderId}" cho "${revenue.customerName}")`,
        metadata: { newItem: target } | { changes } | { deletedItem: target }, // optional extra context
        req,
      });
      ```
    - Trong trường hợp hành động thực hiện bởi người dùng chưa đăng nhập (như `login`, `resetPassword`), bắt buộc truyền tham số `performedBy: { userId: user.id, userName: user.name, userAvatar: user.avatar || "" }` thủ công, kết hợp với truyền `req` để tự động lưu vết IP.
16. **Backend Router Convention**:
    - Các file định tuyến trong thư mục `routes/v1/` và `routes/external/v1/` **BẮT BUỘC** đặt tên theo chuẩn `<resource>.routes.js` (ví dụ: `courseConfigs.routes.js`, `customers.routes.js`). Bỏ convention cũ dùng `<resource>.js` trơn.
    - Các file Route **chỉ được phép định tuyến** (routing) tới Controller, **TUYỆT ĐỐI KHÔNG** viết inline logic xử lý request hoặc gọi `sendSuccess` trực tiếp bên trong file Route. Mọi logic tiền xử lý phải viết thành middleware hoặc đưa vào Controller.
    - **KHÔNG sử dụng `catchAsync`** (hay bất kỳ wrapper async catch nào) tại file route. Việc bọc catchAsync ở route là dư thừa và sai chuẩn của module.
    - Phân quyền (RBAC) cơ bản được khai báo trực tiếp trên từng route sử dụng middleware `requirePermission(PERMISSIONS.XXX)` lấy từ `src/core/middleware/auth.js`. **KHÔNG** tạo thêm các file middleware mới (như `[module]Access.js`) chỉ với mục đích bọc lại `requirePermission`. Việc tạo file `[module]Access.js` chỉ áp dụng theo rule 14 (dành cho Row-Level Security/Assignment rules phức tạp).

