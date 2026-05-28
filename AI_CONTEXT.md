# Bản đồ Kiến trúc & Logic Backend (AI_CONTEXT.md)

> **QUAN TRỌNG:** File này chứa TOÀN BỘ kiến trúc, luồng xử lý, và chi tiết nghiệp vụ sau khi gộp (merge) tính năng. Phải chủ động cập nhật mỗi khi thay đổi cấu trúc hoặc logic cốt lõi.

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
- `/config`: Cấu hình hệ thống DB, Redis, Môi trường.
- `/controllers`: Điều hướng Request, không viết logic dài dòng tại đây.
- `/middleware`: Chứa nhóm lõi bảo mật phân quyền kể trên.
- `/models`: Các Mongoose Schemas (Customer, Lead, Event, Task, Funnel, MetaProgram, WebhookLog, AutomationLog, v.v.).
- `/routes/v1`: Endpoint APIs (`customers`, `leads`, `events`, `webhooks`, `meta`, `funnels`, `logs`...).
- `/services`: **Nơi chứa toàn bộ Logic nghiệp vụ cốt lõi**. Toàn bộ controller giao tiếp qua lớp này.
- `/validations`: Chứa schema Joi để check input.
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
3. **Xử lý Lỗi (Error Handling)**: Express 5 tự động hứng async errors để chuyển sang Global Error Handler. Chuẩn mong muốn là Controller không chứa `try/catch`, chỉ gọi hàm service, ném `throw createHttpError(...)` từ Service và return `sendSuccess`. Trên thực tế, một số Controller (`AuthController`, `OrganizationController`, `RbacController`) vẫn đang sử dụng cấu trúc `try/catch`.
4. **Primary Key (Định danh ID)**: Codebase sử dụng một trường custom tên là `id` dạng chuỗi (String) với logic sinh mã riêng (`generateMonotonicId` với các prefix như `EAC-`, `TAC-`, `RVC...`) làm định danh chính để tương tác API thay cho `_id` mặc định (ObjectId) của MongoDB.
5. **Chuẩn hóa Response**: Toàn bộ kết quả trả về API được wrapper lại thông qua các hàm tiện ích `sendSuccess` và `sendError` (từ thư mục `utils/http`).
6. **Naming convention**: Variable/Function là `camelCase`, Model/Schema là `PascalCase`.
