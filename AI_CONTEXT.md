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
  - **Quy tắc phân quyền phòng ban & nhóm (Lead/Member Rules)**:
    - *Chỉ OWNER/ADMIN* mới được phép thay đổi danh sách phòng ban hoặc cập nhật vai trò Lead của phòng ban. Tuy nhiên, *Trưởng phòng ban (Lead)* được quyền thêm hoặc gỡ nhân viên khác vào phòng ban do họ quản lý với vai trò là `member` (bao gồm cả khi tạo nhân viên mới hoặc chỉnh sửa nhân viên cũ).
    - *Chỉ Trưởng phòng ban (Lead của phòng ban đó)* mới được phép thay đổi nhóm con hoặc cập nhật vai trò Lead/Member của nhóm thuộc phòng ban đó cho nhân sự.
    - *Trưởng phòng ban không được phép* thay đổi/gán/gỡ thông tin của Trưởng phòng ban khác thuộc cùng phòng ban.
    - *Trưởng nhóm không được phép* thay đổi/gán/gỡ thông tin của Trưởng nhóm khác thuộc cùng nhóm.
    - **Quy tắc lấy danh sách nhân viên của Trưởng phòng (Manager list query)**:
      - Khi Trưởng phòng ban (MANAGER) truy cập danh sách nhân viên, hệ thống chỉ hiển thị các nhân sự thuộc phòng ban hoặc nhóm mà Manager đó làm Trưởng phòng (Lead), đồng thời luôn hiển thị chính tài khoản Manager đó.
      - Nếu Manager chưa được gán bất kỳ vai trò `lead` cụ thể nào trong cấu trúc `departments` hoặc `groups`, hệ thống sẽ tự động đối chiếu ngược (fallback) để gán quyền quản lý của các phòng ban họ đang thuộc về làm phạm vi hiển thị, đảm bảo không bị rỗng danh sách.
    - **Quy tắc phân quyền Module trực tiếp (Module Access Rules)**:
      - *Chỉ OWNER/ADMIN* mới được phép cấu hình, thay đổi hoặc gán quyền hạn trực tiếp (`moduleAccess`) cho nhân sự ở cả Backend và Frontend.
      - Ẩn hoàn toàn bảng cấu hình Module Access (`ModuleAccessPanel`) trên giao diện người dùng nếu tài khoản đang đăng nhập không phải là OWNER hoặc ADMIN.
    - **Quy tắc phân quyền phân hệ Logs (Logs Permission & Tab access)**:
      - Phân hệ Logs được phân rã thành 3 module con độc lập: `logs.system` (System Logs), `logs.webhook` (Webhook Logs) và `logs.blockautomation` (Block Automation Logs).
      - Backend gán 3 quyền tương ứng là `logs_system_read`, `logs_webhook_read`, và `logs_automation_read`, bảo vệ chặt chẽ độc lập các đầu API `/api/v1/logs/*`.
      - Giao diện UI (`LogsPage.tsx`) chỉ hiển thị đúng các tab được cấp quyền trong `moduleAccess` của tài khoản, tự động chọn tab khả dụng đầu tiên làm mặc định khi truy cập.

---

## 4. Quy tắc & Ràng buộc (Conventions)
1. **Tuyệt đối không** tương tác với Database trực tiếp tại Controller.
2. 100% sử dụng **Soft Delete** (`isDeleted=true` hoặc `isArchived=true`), không được xóa dữ liệu thật để bảo toàn dữ liệu tham chiếu (Analytics).
3. Luôn bọc logic Controller/Service bằng `try/catch` và ném lỗi qua `createHttpError()` để error handler tổng hứng.
4. Naming convention: Variable/Function là `camelCase`, Model/Schema là `PascalCase`.
