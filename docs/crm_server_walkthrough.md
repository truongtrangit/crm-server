# CRM Server — Toàn cảnh hệ thống

> Tài liệu này giải thích **toàn bộ** cấu trúc, schema, logic và flow của từng tính năng trong CRM Server.

---

## 1. Kiến trúc tổng thể

```
Client (React) ──HTTP──▶ Express App (port 4000)
                              │
                    ┌─────────┼──────────────┐
                    │         │              │
               Middleware  Routes        MongoDB
               (Auth, Log,  /api/v1/*   (Mongoose)
               Validate)
```

### Cấu trúc thư mục

```
src/
├── app.js              ← Khởi tạo Express, middleware, routes
├── server.js           ← Lắng nghe port, kết nối DB, seed data
├── config/             ← env.js, database.js
├── constants/          ← Hằng số chia sẻ (rbac, actionConfig, ...)
├── middleware/         ← auth.js, validate.js, requestLogger.js
├── models/             ← Mongoose schemas (14 collection)
├── routes/v1/          ← Định nghĩa endpoints
├── controllers/        ← Nhận request → gọi service → trả response
├── services/           ← Business logic (UserService, EventService...)
├── utils/              ← Helpers: auth, rbac, pagination, ...
├── validations/        ← Joi schemas kiểm tra input
└── scripts/            ← resetAndSeed.js (dev tool)
```

---

## 2. Request Lifecycle — Một request đi qua đâu?

```
Request
  │
  ▼
app.use(helmet)          ← Đặt security headers
app.use(cors)            ← Cho phép origin từ CLIENT_URL
app.use(rateLimit)       ← Giới hạn 500 req/phút (auth: 50 req/phút)
app.use(express.json)    ← Parse body JSON
app.use(requestLogger)   ← Log mọi request/response
  │
  ▼
Route matching (/api/v1/...)
  │
  ▼
authenticateRequest      ← Xác thực token (trừ /auth/login, /auth/refresh...)
  │
  ▼
requirePermission(...)   ← Kiểm tra quyền RBAC
  │
  ▼
validate(joiSchema)      ← Validate body/query bằng Joi
  │
  ▼
asyncHandler(controller) ← Thực thi business logic
  │
  ▼
sendSuccess / sendError  ← Trả JSON chuẩn
```

---

## 3. Database Schemas (MongoDB / Mongoose)

### 3.1 User — Nhân viên

```js
{
  id: String (unique, "USER-001")
  name: String
  email: String (unique, lowercase)
  passwordHash: String           // scrypt hash, KHÔNG lưu raw password
  avatar: String
  department: [String]           // ["Phòng Sale"]
  departmentAliases: [String]    // ["sale"] — slug dùng để compare
  group: [String]                // ["Nhóm Sale HN"]
  groupAliases: [String]         // ["sale__nhom-sale-hn"]
  phone: String
  roleId: String                 // ref → Role.id ("staff", "manager"...)
  permissions: [String]          // Quyền bổ sung (hiếm dùng)
  managerId: String              // ref → User.id (quản lý trực tiếp)
  createdBy: String              // ref → User.id
  lastLoginAt: Date
  sessions: [{                   // Danh sách phiên đăng nhập
    sessionId: String
    accessTokenHash: String
    refreshTokenHash: String
    accessTokenExpiresAt: Date
    refreshTokenExpiresAt: Date
    userAgent, ipAddress, lastUsedAt
  }]
  passwordReset: {
    tokenHash, expiresAt, requestedAt
  }
}
```

### 3.2 Role & Permission — Phân quyền

```js
// Role
{
  id: String ("staff", "admin"...)
  name: String ("STAFF", "ADMIN"...)
  description: String
  level: Number (1=Staff, 2=Manager, 3=Admin, 4=Owner)
  permissions: [String]          // Mảng permission id
  isSystem: Boolean
}

// Permission
{
  id: String ("users_read", "events_create"...)
  name: String ("USERS_READ")
  resource: String ("users")
  action: String ("read")
}
```

### 3.3 Organization — Cơ cấu tổ chức

```js
{
  id: String
  alias: String ("sale")         // slug của phòng ban
  parent: String ("Phòng Sale")  // tên phòng ban
  children: [{                   // các nhóm trong phòng
    name: String ("Nhóm Sale HN")
    alias: String ("sale__nhom-sale-hn")
    desc: String
  }]
}
```

### 3.4 Customer — Khách hàng

```js
{
  id: String ("CUST-001")
  name, avatar, email, phone
  type: "Standard Customer"|"VIP Customer"|"Partner"...
  group: String                  // Nhóm KH (Mới, VIP, Rời bỏ...)
  platforms: [String]            // ["SmaxAi", "Botvn"]
  biz: [String]                  // Mã doanh nghiệp liên quan
  tags: [String]
  registeredAt, lastLoginAt: String
  assignees: [{                  // Nhân viên phụ trách
    userId, userName, userAvatar
    role: "sale"|"marketing"|"tuvan"|"kythuat"|"cskh"
    assignedAt, assignedBy
  }]
}
```

### 3.5 Lead, Task — Tiềm năng & Công việc

```js
// Lead
{ id, name, avatar, tags, status, email, phone, source, address,
  assignee: { name, avatar }, actionNeeded, actionType, timeAgo }

// Task
{ id, title, description,
  status: "todo"|"in_progress"|"done"|"cancelled",
  priority: "low"|"medium"|"high",
  dueDate, assignee: { id, name, avatar }, customerId, tags }
```

### 3.6 Event — Sự kiện bán hàng

```js
{
  id: String ("EVT-001")
  name, sub
  group: "user_moi"|"biz_moi"|"can_nang_cap"|"sap_het_han"|"chuyen_khoan"
  customerId: String             // ref Customer (nullable)
  customer: { name, avatar, role, email, phone, source, address } // snapshot
  assigneeId: String             // ref User (nullable)
  assignee: { name, avatar, role, department, group }             // snapshot
  biz: { id, tags }
  stage, source, tags
  plan: { name, cycle, price, daysLeft, expiryDate }
  services: [{ name, active }]
  quotas: [{ name, used, total, color }]
  timeline: [{                   // Lịch sử hoạt động
    type: "phone"|"email"|"event"|"note"
    title, time, content, duration, createdBy
  }]
}
```

### 3.7 ActionChain — Template chuỗi hành động

```js
{
  id: String ("CHN-001")
  name, description
  delayUnit: "immediate"|"minute"|"hour"|"day"|"week"
  delayValue: Number             // null nếu immediate
  active: Boolean                // Chỉ chain active mới add được vào event
  steps: [{
    order: Number (1, 2, 3...)
    actionId: String             // ref → Action
    branches: [{
      resultId: String           // Kết quả nào → đi đâu tiếp
      nextStepType: "next_in_chain"|"close_task"|"close_chain"|...
      nextActionId: String       // Chỉ dùng khi next_in_chain
      closeOutcome: "success"|"failure"  // Chỉ khi close_task
      delayUnit, delayValue      // Delay cho step tiếp theo
      order: Number
    }]
  }]
}
```

### 3.8 EventActionChain — Chuỗi đang chạy trong sự kiện

```js
{
  id: String ("EAC-EVT001-CHN001-timestamp")
  eventId, chainId (template gốc)
  name, status: "active"|"closed"
  order, currentStepIndex
  steps: [{
    order, actionId, actionName, actionType, actionCategory, actionReasonIds
    branches: [...]              // Clone từ template
    // User điền vào khi làm việc:
    selectedResultId, selectedReasonId, note
    // Scheduling:
    delayUnit, delayValue, activatedAt, scheduledAt, completedAt
    delayEditNote
    // Trạng thái:
    status: "pending"|"active"|"done"|"skipped"
    isLocked: Boolean            // true sau khi Save
    activatedNextStepOrder: Number
  }]
}
```

### 3.9 Action, Result, Reason — Config tham chiếu

```js
// Action — Hành động (Gọi điện, Review, ...)
{ id, name, type: "call"|"review"|"other"..., category: "primary"|"secondary", reasonIds: [...] }

// Result — Kết quả (Đồng ý, Từ chối, ...)
{ id, name, type: "success"|"failure"|"neutral"|"skip" }

// Reason — Lý do (Bận, Không nghe máy, ...)
{ id, name, description }
```

---

## 4. Authentication — Đăng nhập / Token

### Flow đăng nhập

```
POST /api/v1/auth/login { email, password }
  │
  ├─ Tìm User theo email
  ├─ Verify password (scrypt timing-safe compare)
  ├─ Tạo session mới: { sessionId, accessTokenHash, refreshTokenHash, ... }
  ├─ Lưu session vào User.sessions[]
  ├─ Set cookie: crm_refresh_token, crm_session_id (httpOnly, sameSite)
  └─ Trả về: { accessToken, refreshToken, sessionId, user, ... }
```

### Token lifecycle

```
AccessToken   → 60 phút (config trong .env)  → gửi qua Authorization: Bearer xxx
RefreshToken  → 30 ngày                       → gửi qua cookie hoặc body

Khi AccessToken hết hạn:
  POST /api/v1/auth/refresh
    → Dùng refreshToken + sessionId → xin cặp token mới
    → Cả 2 token đều rotate (tạo mới, xóa cũ)

Đăng xuất:
  POST /api/v1/auth/logout
    → Xóa session khỏi User.sessions[]
    → Clear cookie (crm_refresh_token, crm_session_id)
```

### Xác thực mỗi request (middleware)

```
authenticateRequest:
  1. Đọc Bearer token từ header Authorization
  2. Hash token → tìm User có session.accessTokenHash match
  3. Kiểm tra token chưa hết hạn
  4. Cập nhật session.lastUsedAt
  5. Gán req.user = user → dùng cho middleware/controller tiếp theo
```

---

## 5. RBAC — Phân quyền

### 4 role mặc định

```
OWNER   (level 4) → Toàn quyền
ADMIN   (level 3) → Quản trị users, customers, events, config
MANAGER (level 2) → Tạo STAFF, quản lý team, xem báo cáo team
STAFF   (level 1) → CRUD cơ bản trong phạm vi được assign
```

### Permission format

```
"{resource}_{action}"
Ví dụ: "users_create", "events_read", "actions_cfg_update"

"manage" bao gồm mọi action của resource đó:
  users_manage ⊇ { users_read, users_create, users_update, users_delete }

Khi check requirePermission("users_read"):
  → Cũng chấp nhận user có "users_manage"

Nguồn permission:
  user.permissions[]    (quyền bổ sung trực tiếp, hiếm dùng)
  + role.permissions[]  (quyền từ role được assign)
```

---

## 6. User Management

### Quy tắc phân cấp

```
OWNER   → Quản lý mọi user trừ OWNER khác (không ai gán được OWNER)
ADMIN   → Quản lý MANAGER và STAFF
MANAGER → Chỉ quản lý STAFF trong phòng ban của mình
STAFF   → Không quản lý ai
```

### Tạo user — canAssignRole logic

```
1. Không ai được gán OWNER role
2. Actor phải có level > targetRole.level (ADMIN mới tạo được MANAGER)
3. MANAGER chỉ tạo STAFF trong phòng ban/nhóm của mình
```

---

## 7. Event Management

### Quyền xem Event

```
OWNER/ADMIN → xem tất cả events
MANAGER     → xem events của mình + staff trực thuộc + unassigned
STAFF       → xem events của mình + unassigned
```

### Event snapshot pattern

> Event lưu `customer` và `assignee` dưới dạng **embedded copy** (không FK join).
> Khi Customer/User thay đổi → Event KHÔNG tự cập nhật.
> Dùng `POST /:id/sync-customer` để đồng bộ thủ công.

---

## 8. Action Config Workflow

```
Result  → Kết quả hành động ("Đồng ý", "Từ chối", "Bận rộn"...)
Reason  → Lý do kèm theo     ("Không nghe máy", "Đang họp"...)
Action  → Hành động cụ thể   ("Gọi điện tư vấn", "Gửi email"...)
ActionChain → Template chuỗi nhiều Action + quy tắc rẽ nhánh
```

### Ví dụ Chain "Chăm sóc User Mới"

```
delay: 1 hour (bắt đầu sau 1h khi add vào Event)

Step 1: Action "Gọi điện tư vấn"
  Kết quả "Đồng ý"  → next_in_chain → Step 2 (gửi email)
  Kết quả "Từ chối" → close_task (failure)
  Kết quả "Bận rộn" → next_in_chain → Step 3 (gọi lại, delay 1 ngày)

Step 2: Action "Gửi email giới thiệu"
  Kết quả "Đọc email"     → close_task (success)
  Kết quả "Không phản hồi"→ close_chain
```

---

## 9. Event Action Chain — Flow chi tiết

### Thêm chain vào event

```
POST /events/:eventId/chains  { chainId }
  → Clone toàn bộ steps + branches từ template
  → Step 1: status="active", scheduledAt = now + chainDelay
  → Các step còn lại: status="pending"
```

### Nhân viên save 1 step

```
PUT /events/:eventId/chains/:chainId/steps/current
  body: { selectedResultId, selectedReasonId, note }
  │
  ├─ Mark step hiện tại: status="done", isLocked=true
  ├─ Tìm branch khớp selectedResultId
  │
  ├─ nextStepType = "close_task"/"close_chain"
  │    → chain.status = "closed"  (kết thúc)
  │
  ├─ nextStepType = "next_in_chain"
  │    → Tìm step tiếp theo theo nextActionId
  │    → Set status="active", tính scheduledAt = now + delay
  │
  └─ nextStepType khác (create_order, ...)
       → Advance sang step liền kề tiếp theo
```

### Step status machine

```
pending ──(step trước done)──▶ active ──(user Save)──▶ done
                                  │
                            (chain đóng trước)──▶ skipped
```

### Task Queue

```
GET /api/v1/event-chains/queue
  → Tất cả chain "active" có step đang "active"
  → Kèm thông tin Event (customer, assignee, plan...)
  → Sắp xếp theo scheduledAt ASC (sắp đến hạn lên đầu)

Filter: eventId, overdueOnly, department, group, eventGroup, search
RBAC: OWNER/ADMIN thấy tất cả | MANAGER thấy team | STAFF thấy mình
```

---

## 10. Seed & Boot Sequence

```
server.js khởi động:
  1. Kết nối MongoDB
  2. seedDatabase():
      ├─ Seed Organization → sync aliases
      ├─ Seed Users (skip nếu đã tồn tại email/id)
      ├─ Sync user departmentAliases/groupAliases
      ├─ Seed Customers, Leads, Tasks, Events, StaffFunctions
      ├─ Seed Reasons, Results, Actions, ActionChains
      ├─ seedRbac(): Upsert 52 Permissions + 4 System Roles
      └─ migrateUsersToRbac(): Gán roleId cho user thiếu
  3. Lắng nghe port 4000
```

---

## 11. Response Format chuẩn

```json
// Success đơn
{ "statusCode": 200, "message": "...", "data": { ... } }

// Danh sách có phân trang
{ "statusCode": 200, "message": "...",
  "data": { "items": [...], "totalItems": 100, "page": 1, "limit": 20, "totalPages": 5 } }

// Lỗi
{ "statusCode": 403, "message": "Insufficient permissions",
  "error": { "code": "INSUFFICIENT_PERMISSION", "requiredPermissions": ["events_create"] } }
```

---

## 12. Sơ đồ quan hệ

```
Organization ──────────────────── User
                                    │  (managerId → User)
                         ┌──────────┼──────────────┐
                         │          │               │
                      Customer    Event           Lead / Task
                    (assignees)    │
                                   │ (1 event → nhiều chain)
                          EventActionChain ──── ActionChain (Template)
                                   │                    │
                               [steps]              [steps]
                                   └──── Action, Result, Reason
```

---

## 13. Security Summary

| Cơ chế | Chi tiết |
|---|---|
| **Password** | scrypt + salt ngẫu nhiên, so sánh timing-safe |
| **Token** | Opaque 64-byte random, lưu SHA256 hash trong DB |
| **Session** | Multi-session, mỗi device 1 session, tự expire |
| **Rate limit** | 500 req/phút toàn API, 50 req/phút /auth |
| **CORS** | Chỉ nhận request từ CLIENT_URL |
| **Helmet** | Security headers tự động |
| **RBAC** | Permission-based, _manage bao gồm tất cả action con |
