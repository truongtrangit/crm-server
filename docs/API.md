# CRM Server — Full API Reference

**Base URL:** `http://localhost:4000`  
**Authentication:** Bearer token via `Authorization: Bearer <accessToken>` header (all protected routes).  
**Content-Type:** `application/json`

---

## Table of Contents

1. [General Conventions](#1-general-conventions)
2. [Authentication — `/api/auth`](#2-authentication)
3. [Users (Staff) — `/api/users`](#3-users-staff)
4. [Customers — `/api/customers`](#4-customers)
5. [Leads — `/api/leads`](#5-leads)
6. [Tasks — `/api/tasks`](#6-tasks)
7. [Events — `/api/events`](#7-events)
8. [Event Action Chains — `/api/events/:eventId/chains`](#8-event-action-chains)
9. [Organization — `/api/organization`](#9-organization)
10. [Metadata — `/api/metadata`](#10-metadata)
11. [Functions — `/api/functions`](#11-functions)
12. [RBAC (Roles & Permissions) — `/api/rbac`](#12-rbac)
13. [Action Config — `/api/action-config`](#13-action-config)
14. [System Routes](#14-system-routes)
15. [Enum Reference](#15-enum-reference)
16. [Error Codes](#16-error-codes)
17. [Seed Data Overview](#17-seed-data-overview)

---

## 1. General Conventions

### Response Envelope

All responses share a common envelope shape:

```json
{
  "success": true,
  "message": "Human-readable message",
  "data": { ... }
}
```

### Paginated Response Shape

```json
{
  "items": [...],
  "totalItems": 42,
  "page": 1,
  "limit": 20,
  "totalPages": 3
}
```

### Common Query Parameters (paginated lists)

| Param   | Type    | Default | Description         |
|---------|---------|---------|---------------------|
| `page`  | integer | 1       | Page number (≥ 1)   |
| `limit` | integer | 20      | Items per page (max 100 or 200 for action-config) |

### Authentication

- Access tokens (JWT) expire after 15 minutes by default.
- Use `POST /api/auth/refresh` to get a new access token using the refresh token (sent as `httpOnly` cookie or request body).
- Public routes (no token needed): `/api/auth/login`, `/api/auth/refresh`, `/api/auth/forgot-password`, `/api/auth/reset-password`, `/api/auth/logout`, `/health`, `/api`.

---

## 2. Authentication

**Base path:** `/api/auth`

### 2.1 Login

```
POST /api/auth/login
```

**Body:**
```json
{
  "email": "admin@example.com",
  "password": "password123"
}
```

**Response `200`:**
```json
{
  "success": true,
  "message": "Login success",
  "data": {
    "accessToken": "<jwt>",
    "user": {
      "id": "USER001",
      "name": "Admin User",
      "email": "admin@crm.vn",
      "role": "ADMIN",
      "avatar": "",
      "phone": "",
      "department": [],
      "group": []
    }
  }
}
```

> Sets `httpOnly` cookies: `refreshToken`, `sessionId`.

**Errors:** `400 VALIDATION_ERROR`, `401 INVALID_CREDENTIALS`

---

### 2.2 Refresh Token

```
POST /api/auth/refresh
```

> Reads `refreshToken` and `sessionId` from cookies (or request body).

**Response `200`:**
```json
{
  "success": true,
  "message": "Refresh token success",
  "data": {
    "accessToken": "<new-jwt>",
    "user": { ... }
  }
}
```

**Errors:** `400 VALIDATION_ERROR`, `401 INVALID_SESSION`, `401 INVALID_REFRESH_TOKEN`

---

### 2.3 Forgot Password

```
POST /api/auth/forgot-password
```

**Body:**
```json
{ "email": "user@example.com" }
```

**Response `200`:**
```json
{
  "success": true,
  "message": "Forgot password request success",
  "data": {
    "email": "user@example.com",
    "resetToken": "<plain-token>",
    "resetTokenExpiresAt": "2026-04-16T14:00:00Z"
  }
}
```

> Always returns 200 to avoid user-enumeration attacks (even if email doesn't exist).

---

### 2.4 Reset Password

```
POST /api/auth/reset-password
```

**Body:**
```json
{
  "email": "user@example.com",
  "resetToken": "<token-from-forgot-password>",
  "newPassword": "newSecure123"
}
```

**Response `200`:** `{ "success": true, "message": "Reset password success", "data": null }`

**Errors:** `400 VALIDATION_ERROR`, `400 INVALID_RESET_TOKEN`

---

### 2.5 Logout

```
POST /api/auth/logout
```

> Reads access token from `Authorization` header or cookies. Clears session and cookies.

**Response `200`:** `{ "success": true, "message": "Logout success", "data": null }`

---

### 2.6 Get Current User *(requires auth)*

```
GET /api/auth/me
Authorization: Bearer <accessToken>
```

**Response `200`:**
```json
{
  "success": true,
  "message": "Get current user success",
  "data": {
    "user": {
      "id": "USER001",
      "name": "Admin",
      "email": "admin@crm.vn",
      "role": "ADMIN",
      "roleId": "role-admin",
      "avatar": "",
      "phone": "",
      "department": ["Phòng Kỹ Thuật"],
      "departmentAliases": ["phong-ky-thuat"],
      "group": ["Nhóm Backend"],
      "groupAliases": ["phong-ky-thuat-nhom-backend"],
      "managerId": null,
      "permissions": ["users_read", "events_read", ...],
      "lastLoginAt": "2026-04-18T06:00:00Z"
    }
  }
}
```

---

### 2.7 Update My Profile *(requires auth)*

```
PUT /api/auth/me
Authorization: Bearer <accessToken>
```

**Body** (at least one field required):
```json
{
  "name": "New Name",
  "email": "new@example.com",
  "avatar": "https://example.com/avatar.jpg",
  "phone": "0901234567",
  "department": ["Phòng Sale"],
  "departmentAliases": ["phong-sale"],
  "group": ["Nhóm Sale Hà Nội"],
  "groupAliases": ["phong-sale-nhom-sale-ha-noi"]
}
```

**Response `200`:** `{ "success": true, "message": "Update current user success", "data": { "user": { ... } } }`

**Errors:** `400 VALIDATION_ERROR`

---

### 2.8 Change Password *(requires auth)*

```
POST /api/auth/change-password
Authorization: Bearer <accessToken>
```

**Body:**
```json
{
  "currentPassword": "oldSecure123",
  "newPassword": "newSecure456"
}
```

**Response `200`:** `{ "success": true, "message": "Change password success", "data": null }`

**Errors:** `400 VALIDATION_ERROR`, `401 INVALID_CURRENT_PASSWORD`

---

### 2.9 Register New User *(requires auth + `users_create` permission)*

```
POST /api/auth/register
Authorization: Bearer <accessToken>
```

**Body:**
```json
{
  "name": "New Staff",
  "email": "staff@example.com",
  "password": "crm123456",
  "role": "STAFF",
  "roleId": "role-staff",
  "avatar": "",
  "phone": "0901234567",
  "department": ["Phòng Sale"],
  "departmentAliases": ["phong-sale"],
  "managerId": "USER003"
}
```

**Response `201`:** Returns the newly created user object.

**Errors:** `400 VALIDATION_ERROR`, `403 FORBIDDEN`, `409 DUPLICATE_VALUE`

---

## 3. Users (Staff)

**Base path:** `/api/users`  
**All routes require authentication.**

### 3.1 List Users

```
GET /api/users
Authorization: Bearer <accessToken>
Permission: users_read
```

**Query Parameters:**

| Param        | Type   | Description                  |
|--------------|--------|------------------------------|
| `search`     | string | Name, email, or ID           |
| `department` | string | Filter by department name    |
| `role`       | string | Filter by role (STAFF, etc.) |
| `managerId`  | string | Filter by manager ID         |
| `page`       | int    | Page number                  |
| `limit`      | int    | Items per page (max 100)     |

**Response `200`:** Paginated list of user objects.

---

### 3.2 Create User

```
POST /api/users
Authorization: Bearer <accessToken>
Permission: users_create
```

**Body:**
```json
{
  "name": "New Staff",
  "email": "staff@example.com",
  "password": "crm123456",
  "role": "STAFF",
  "roleId": "role-staff",
  "avatar": "",
  "phone": "0901234567",
  "department": ["Phòng Sale"],
  "departmentAliases": ["phong-sale"],
  "group": ["Nhóm Sale Hà Nội"],
  "groupAliases": ["phong-sale-nhom-sale-ha-noi"],
  "managerId": "USER003"
}
```

**Response `201`:** Created user object.

**Errors:** `400 VALIDATION_ERROR`, `403 FORBIDDEN`, `409 DUPLICATE_VALUE`

---

### 3.3 Update User

```
PUT /api/users/:id
Authorization: Bearer <accessToken>
Permission: users_update
```

**Body** (at least one field required):
```json
{
  "name": "Updated Name",
  "email": "updated@example.com",
  "role": "MANAGER",
  "roleId": "role-manager",
  "phone": "0901234567",
  "department": ["Phòng Sale"],
  "group": ["Nhóm Sale HCM"]
}
```

**Response `200`:** Updated user object.

**Errors:** `400 VALIDATION_ERROR`, `403 FORBIDDEN`, `404 USER_NOT_FOUND`

---

### 3.4 Delete User

```
DELETE /api/users/:id
Authorization: Bearer <accessToken>
Permission: users_delete
```

**Response `200`:** `{ "success": true, "message": "Delete staff success", "data": null }`

**Errors:** `403 FORBIDDEN`, `404 USER_NOT_FOUND`

---

## 4. Customers

**Base path:** `/api/customers`  
**All routes require authentication.**

### 4.1 List Customers

```
GET /api/customers
Authorization: Bearer <accessToken>
Permission: customers_read
```

**Query Parameters:**

| Param      | Type   | Description                  |
|------------|--------|------------------------------|
| `search`   | string | Name, email, ID, or phone    |
| `type`     | string | Filter by customer type      |
| `group`    | string | Filter by group              |
| `platform` | string | Filter by platform           |
| `page`     | int    | Page number                  |
| `limit`    | int    | Items per page (max 100)     |

**Response `200`:** Paginated customer list.

---

### 4.2 Get Assignment Roles

```
GET /api/customers/meta/assignment-roles
Authorization: Bearer <accessToken>
Permission: customers_read
```

**Response `200`:**
```json
{
  "success": true,
  "message": "Get assignment roles success",
  "data": {
    "items": [
      { "value": "sale", "label": "Sale" },
      { "value": "marketing", "label": "Marketing" },
      { "value": "tuvan", "label": "Tư vấn" },
      { "value": "kythuat", "label": "Kỹ thuật" },
      { "value": "cskh", "label": "CSKH" }
    ]
  }
}
```

---

### 4.3 Get Customer by ID

```
GET /api/customers/:id
Authorization: Bearer <accessToken>
Permission: customers_read
```

**Response `200`:** Customer detail object.

**Errors:** `404 CUSTOMER_NOT_FOUND`

---

### 4.4 Create Customer

```
POST /api/customers
Authorization: Bearer <accessToken>
Permission: customers_create
```

**Body:**
```json
{
  "name": "Nguyễn Văn An",
  "email": "an@example.com",
  "avatar": "https://example.com/avatar.jpg",
  "type": "Standard Customer",
  "phone": "0901234567",
  "biz": ["BIZ-001"],
  "platforms": ["SmaxAi"],
  "group": "Nhóm Sale Hà Nội",
  "registeredAt": "2026-01-01",
  "lastLoginAt": "2026-04-01",
  "tags": ["#VIP", "#Priority"]
}
```

**Response `201`:** Created customer object.

**Errors:** `400 VALIDATION_ERROR`, `409 DUPLICATE_VALUE`

---

### 4.5 Update Customer

```
PUT /api/customers/:id
Authorization: Bearer <accessToken>
Permission: customers_update
```

**Body** (at least one field required):
```json
{
  "name": "Nguyễn Văn An (Updated)",
  "email": "an.updated@example.com",
  "type": "VIP Customer",
  "tags": ["#VIP"]
}
```

**Response `200`:** Updated customer object.

**Errors:** `400 VALIDATION_ERROR`, `404 CUSTOMER_NOT_FOUND`

---

### 4.6 Delete Customer

```
DELETE /api/customers/:id
Authorization: Bearer <accessToken>
Permission: customers_delete OR customers_read
```

**Response `200`:** `{ "success": true, "message": "Delete customer success", "data": null }`

**Errors:** `403 FORBIDDEN`, `404 CUSTOMER_NOT_FOUND`

---

### 4.7 Assign Staff to Customer

```
POST /api/customers/:id/assignees
Authorization: Bearer <accessToken>
Permission: customers_update OR customers_read
```

**Body:**
```json
{
  "userId": "USER004",
  "role": "sale"
}
```

> `role` must be one of: `sale`, `marketing`, `tuvan`, `kythuat`, `cskh`

**Response `200`:** Updated customer object with new assignee.

**Errors:** `400 VALIDATION_ERROR`, `404 CUSTOMER_NOT_FOUND`, `404 USER_NOT_FOUND`

---

### 4.8 Remove Staff Assignment

```
DELETE /api/customers/:id/assignees/:userId?role=sale
Authorization: Bearer <accessToken>
Permission: customers_update OR customers_read
```

**Query Parameters:**

| Param  | Type   | Required | Description                                         |
|--------|--------|----------|-----------------------------------------------------|
| `role` | string | ✅        | Assignment role (`sale`, `marketing`, `tuvan`, etc.) |

**Response `200`:** Updated customer object.

**Errors:** `400 VALIDATION_ERROR`, `404 CUSTOMER_NOT_FOUND`

---

## 5. Leads

**Base path:** `/api/leads`  
**All routes require authentication.**

### 5.1 List Leads

```
GET /api/leads
Authorization: Bearer <accessToken>
Permission: leads_read
```

**Query Parameters:**

| Param      | Type   | Description             |
|------------|--------|-------------------------|
| `search`   | string | Name, ID, or tags       |
| `status`   | string | Filter by status        |
| `assignee` | string | Filter by assignee name |
| `page`     | int    | Page number             |
| `limit`    | int    | Items per page (max 100)|

**Response `200`:** Paginated lead list.

---

### 5.2 Create Lead

```
POST /api/leads
Authorization: Bearer <accessToken>
Permission: leads_create
```

**Body:**
```json
{
  "name": "Potential Client",
  "avatar": "",
  "timeAgo": "Vừa xong",
  "tags": ["B2B", "Enterprise"],
  "assignee": {
    "name": "Vũ Thu Phương",
    "avatar": "https://i.pravatar.cc/100?img=25"
  },
  "status": "Biz tạo mới",
  "actionNeeded": "Gọi điện tư vấn",
  "actionType": "orange",
  "email": "lead@company.com",
  "phone": "0901234567",
  "source": "Facebook Ads",
  "address": "Hà Nội, Việt Nam"
}
```

> `actionType`: `"green"` | `"orange"` | `"blue"` | `""`

**Response `201`:** Created lead object.

---

### 5.3 Update Lead

```
PUT /api/leads/:id
Authorization: Bearer <accessToken>
Permission: leads_update
```

**Body** (at least one field required): Same fields as create.

**Response `200`:** Updated lead object.

**Errors:** `400 VALIDATION_ERROR`, `404 LEAD_NOT_FOUND`

---

### 5.4 Update Lead Status

```
PATCH /api/leads/:id/status
Authorization: Bearer <accessToken>
Permission: leads_update
```

**Body:**
```json
{ "status": "Đang tư vấn" }
```

**Response `200`:** Updated lead object.

**Errors:** `400 VALIDATION_ERROR`, `404 LEAD_NOT_FOUND`

---

### 5.5 Delete Lead

```
DELETE /api/leads/:id
Authorization: Bearer <accessToken>
Permission: leads_delete
```

**Response `200`:** `{ "success": true, "message": "Delete lead success", "data": null }`

**Errors:** `404 LEAD_NOT_FOUND`

---

## 6. Tasks

**Base path:** `/api/tasks`  
**All routes require authentication.**

### 6.1 List Tasks

```
GET /api/tasks
Authorization: Bearer <accessToken>
Permission: tasks_read
```

**Query Parameters:**

| Param      | Type   | Description                  |
|------------|--------|------------------------------|
| `search`   | string | Action, ID, customer name/email/phone |
| `platform` | string | Filter by platform           |
| `assignee` | string | Filter by assignee name      |
| `status`   | string | Filter by status             |
| `page`     | int    | Page number                  |
| `limit`    | int    | Items per page (max 100)     |

**Response `200`:** Paginated task list.

---

### 6.2 Create Task

```
POST /api/tasks
Authorization: Bearer <accessToken>
Permission: tasks_create
```

**Body:**
```json
{
  "action": "Gọi điện tư vấn khách hàng",
  "time": "10:00 16/04/2026",
  "timeType": "future",
  "customer": {
    "name": "Phạm Tường Vy",
    "avatar": "https://i.pravatar.cc/100?img=15",
    "email": "vy.pham@example.com",
    "phone": "0912 345 678"
  },
  "platform": "SmaxAi",
  "assignee": {
    "name": "Vũ Thu Phương",
    "avatar": "https://i.pravatar.cc/100?img=25"
  },
  "status": "Đang thực hiện"
}
```

> `timeType`: `"soon"` | `"late"` | `"future"`  
> `platform`: `"SmaxAi"` | `"Botvn"` | `"Appvn"`

**Response `201`:** Created task object.

---

### 6.3 Update Task

```
PUT /api/tasks/:id
Authorization: Bearer <accessToken>
Permission: tasks_update
```

**Body** (at least one field required): Same fields as create.

**Response `200`:** Updated task object.

**Errors:** `400 VALIDATION_ERROR`, `404 TASK_NOT_FOUND`

---

### 6.4 Delete Task

```
DELETE /api/tasks/:id
Authorization: Bearer <accessToken>
Permission: tasks_delete
```

**Response `200`:** `{ "success": true, "message": "Delete task success", "data": null }`

**Errors:** `404 TASK_NOT_FOUND`

---

## 7. Events

**Base path:** `/api/events`  
**All routes require authentication.**

### 7.1 List Events

```
GET /api/events
Authorization: Bearer <accessToken>
Permission: events_read
```

**Query Parameters:**

| Param        | Type   | Description                                                          |
|--------------|--------|----------------------------------------------------------------------|
| `search`     | string | Event name or customer info                                          |
| `group`      | string | `user_moi` \| `biz_moi` \| `can_nang_cap` \| `sap_het_han` \| `chuyen_khoan` |
| `stage`      | string | Filter by stage text                                                 |
| `assignee`   | string | Filter by assignee name                                              |
| `unassigned` | bool   | `true` → return only unassigned events (`assigneeId = null`)        |
| `unsynced`   | bool   | `true` → return only events where `customerId = null`               |
| `page`       | int    | Page number                                                          |
| `limit`      | int    | Items per page (max 100)                                             |

**Response `200`:**
```json
{
  "success": true,
  "message": "Get events success",
  "data": {
    "items": [
      {
        "id": "EVT001",
        "name": "Đăng ký tài khoản mới",
        "sub": "Hệ thống tự động",
        "group": "user_moi",
        "customerId": "CUST001",
        "customer": {
          "name": "Phạm Tường Vy",
          "avatar": "https://i.pravatar.cc/100?img=15",
          "role": "Giám đốc",
          "email": "vy.pham@example.com",
          "phone": "0912 345 678",
          "source": "Facebook Ads",
          "address": "TP. HCM"
        },
        "assigneeId": "USER004",
        "assignee": {
          "name": "Vũ Thu Phương",
          "avatar": "https://i.pravatar.cc/100?img=25",
          "role": "Nhân viên Sales"
        },
        "biz": { "id": "#BIZ001", "tags": ["Trial", "SmaxAi"] },
        "stage": "Đăng ký thành công",
        "source": "CRM",
        "tags": ["#UserMoi", "#Trial"],
        "plan": {
          "name": "TRIAL",
          "cycle": "Dùng thử",
          "price": "0 đ",
          "daysLeft": 14,
          "expiryDate": "02/05/2026"
        },
        "services": [],
        "quotas": [{ "name": "Truy cập User", "used": 1, "total": 3, "color": "blue" }],
        "timeline": [],
        "createdAt": "2026-04-18T04:00:00Z",
        "updatedAt": "2026-04-18T04:00:00Z"
      }
    ],
    "totalItems": 17,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

> **RBAC scoping:** OWNER/ADMIN/MANAGER see all events. STAFF sees only events assigned to themselves OR unassigned events.

---

### 7.2 Get Event Stats

```
GET /api/events/stats
Authorization: Bearer <accessToken>
Permission: events_read
```

**Response `200`:**
```json
{
  "success": true,
  "message": "Get event stats success",
  "data": {
    "total": 17,
    "unassigned": 5,
    "unsynced": 2,
    "byGroup": {
      "user_moi": 4,
      "biz_moi": 3,
      "can_nang_cap": 3,
      "sap_het_han": 3,
      "chuyen_khoan": 4
    }
  }
}
```

---

### 7.3 Get Event by ID

```
GET /api/events/:id
Authorization: Bearer <accessToken>
Permission: events_read
```

**Response `200`:** Full event object including `timeline` array.

**Errors:** `403 FORBIDDEN` (STAFF accessing event not theirs), `404 EVENT_NOT_FOUND`

---

### 7.4 Create Event

```
POST /api/events
Authorization: Bearer <accessToken>
Permission: events_create
```

**Body:**
```json
{
  "name": "Đăng ký doanh nghiệp mới",
  "sub": "Hệ thống tự động",
  "group": "biz_moi",
  "customer": {
    "name": "Nguyễn Văn An",
    "avatar": "",
    "role": "CEO",
    "email": "an@company.com",
    "phone": "0901234567",
    "source": "Facebook Ads",
    "address": "Hà Nội"
  },
  "customerId": "CUST001",
  "biz": {
    "id": "#BIZ010",
    "tags": ["Trial", "SmaxAi"]
  },
  "assigneeId": "USER004",
  "assignee": {
    "name": "Vũ Thu Phương",
    "avatar": "https://i.pravatar.cc/100?img=25",
    "role": "Nhân viên Sales"
  },
  "stage": "Chờ xử lý",
  "source": "CRM",
  "tags": ["#BizMoi"],
  "plan": {
    "name": "TRIAL",
    "cycle": "Dùng thử",
    "price": "0 đ",
    "daysLeft": 14,
    "expiryDate": "02/05/2026"
  },
  "services": [
    { "name": "Zalo OA Integration", "active": true }
  ],
  "quotas": [
    { "name": "Truy cập User", "used": 1, "total": 5, "color": "blue" }
  ]
}
```

> `group` must be one of: `user_moi`, `biz_moi`, `can_nang_cap`, `sap_het_han`, `chuyen_khoan`  
> `assigneeId` and `customerId` are optional (can be null for unassigned/unsynced events)

**Response `201`:** Created event object.

**Errors:** `400 VALIDATION_ERROR`, `409 DUPLICATE_VALUE`

---

### 7.5 Update Event

```
PUT /api/events/:id
Authorization: Bearer <accessToken>
Permission: events_update
```

**Body** (at least one field required): Same fields as create, all optional.

**Response `200`:** Updated event object.

**Errors:** `400 VALIDATION_ERROR`, `403 FORBIDDEN`, `404 EVENT_NOT_FOUND`

---

### 7.6 Add Timeline Entry

```
POST /api/events/:id/timeline
Authorization: Bearer <accessToken>
Permission: events_update
```

**Body:**
```json
{
  "type": "phone",
  "title": "Cuộc gọi tư vấn lần 2",
  "time": "14:00 18/04/2026",
  "content": "Khách đang cân nhắc nâng cấp lên gói Premium",
  "duration": "8 phút"
}
```

> `type`: `"phone"` | `"email"` | `"event"` | `"note"`

**Response `201`:** Updated event object with new timeline entry appended.

**Errors:** `400 VALIDATION_ERROR`, `404 EVENT_NOT_FOUND`

---

### 7.7 Delete Event

```
DELETE /api/events/:id
Authorization: Bearer <accessToken>
Permission: events_delete
```

**Response `200`:** `{ "success": true, "message": "Delete event success", "data": null }`

**Errors:** `403 FORBIDDEN`, `404 EVENT_NOT_FOUND`

---

### 7.8 Sync Event Customer

```
POST /api/events/:id/sync-customer
Authorization: Bearer <accessToken>
Permission: events_update
```

> Syncs the event's embedded `customer` object from the linked `customerId` in the Customer collection. Used for events where `customerId` was null or the customer data changed.

**Response `200`:**
```json
{
  "success": true,
  "message": "Sync customer success",
  "data": { "event": { ... } }
}
```

**Errors:** `404 EVENT_NOT_FOUND`, `404 CUSTOMER_NOT_FOUND`

---

### 7.9 Self-Assign Event

```
POST /api/events/:id/self-assign
Authorization: Bearer <accessToken>
Permission: events_update
```

> Allows a STAFF user to assign themselves to an **unassigned** event (`assigneeId = null`). MANAGER/ADMIN/OWNER can assign any user. Returns error if event already has an assignee.

**Response `200`:**
```json
{
  "success": true,
  "message": "Self-assign event success",
  "data": { "event": { ... } }
}
```

**Errors:** `403 FORBIDDEN` (event already assigned to someone else), `404 EVENT_NOT_FOUND`

---

### 7.10 Unassign Event

```
DELETE /api/events/:id/assignee
Authorization: Bearer <accessToken>
Permission: events_update
```

> Removes the assignee from the event. STAFF can only unassign themselves. MANAGER/ADMIN/OWNER can unassign anyone.

**Response `200`:**
```json
{
  "success": true,
  "message": "Unassign event success",
  "data": { "event": { ... } }
}
```

**Errors:** `403 FORBIDDEN`, `404 EVENT_NOT_FOUND`

---

## 8. Event Action Chains

**Base path:** `/api/events/:eventId/chains`  
**All routes require authentication.**

> Event Action Chains represent workflow execution instances cloned from `ActionChain` templates. Each chain belongs to one event and has an ordered list of steps. Steps unlock sequentially — the next step activates only after the current one is saved.

---

### 8.1 List Chains for Event

```
GET /api/events/:eventId/chains
Authorization: Bearer <accessToken>
Permission: event_chains_read
```

**Response `200`:**
```json
{
  "success": true,
  "message": "Get event chains success",
  "data": {
    "items": [
      {
        "id": "EAC-001",
        "eventId": "EVT001",
        "chainId": "CHAIN001",
        "name": "Chăm sóc khách hàng mới",
        "status": "active",
        "order": 1,
        "currentStepIndex": 1,
        "steps": [
          {
            "order": 1,
            "actionId": "ACT004",
            "actionName": "Gửi email giới thiệu tự động",
            "actionType": "send_block_automation",
            "actionCategory": "primary",
            "branches": [ ... ],
            "selectedResultId": "RES005",
            "selectedReasonId": null,
            "note": "",
            "delayUnit": "hour",
            "delayValue": 2,
            "activatedAt": "2026-04-18T04:00:00Z",
            "scheduledAt": "2026-04-18T06:00:00Z",
            "completedAt": "2026-04-18T04:05:00Z",
            "status": "done",
            "isLocked": true
          },
          {
            "order": 2,
            "actionId": "ACT001",
            "actionName": "Gọi điện lần 1",
            "actionType": "call",
            "status": "active",
            "isLocked": false,
            ...
          }
        ]
      }
    ]
  }
}
```

---

### 8.2 Add Chain to Event

```
POST /api/events/:eventId/chains
Authorization: Bearer <accessToken>
Permission: event_chains_create
```

**Body:**
```json
{
  "chainId": "CHAIN001"
}
```

> Clones the template `ActionChain` (including all steps and branches) into an `EventActionChain` for this event. Only one instance per `chainId` per event is allowed.

**Response `201`:** Created EventActionChain object.

**Errors:** `400 VALIDATION_ERROR`, `404 ACTION_CHAIN_NOT_FOUND`, `409 CHAIN_ALREADY_EXISTS`

---

### 8.3 Save Current Step

```
PUT /api/events/:eventId/chains/:chainId/steps/current
Authorization: Bearer <accessToken>
Permission: event_chains_update
```

> Saves the result for the currently active step and unlocks the next step based on branch logic. If the selected branch has `nextStepType: "close_task"`, the chain closes.

**Body:**
```json
{
  "selectedResultId": "RES001",
  "selectedReasonId": null,
  "note": "Khách hàng rất quan tâm, muốn demo ngay tuần này"
}
```

**Response `200`:** Updated EventActionChain.

**Errors:** `400 VALIDATION_ERROR`, `404 EVENT_NOT_FOUND`, `404 CHAIN_NOT_FOUND`

---

### 8.4 Inject Step

```
POST /api/events/:eventId/chains/:chainId/steps
Authorization: Bearer <accessToken>
Permission: event_chains_update
```

> Inserts a new step after the current active step. Useful for ad-hoc actions not in the original template.

**Body:**
```json
{
  "actionId": "ACT007",
  "insertAfterOrder": 2
}
```

**Response `200`:** Updated EventActionChain with new step inserted.

**Errors:** `400 VALIDATION_ERROR`, `404 CHAIN_NOT_FOUND`

---

### 8.5 Update Current Step Delay

```
PATCH /api/events/:eventId/chains/:chainId/steps/current/delay
Authorization: Bearer <accessToken>
Permission: event_chains_update
```

> Adjusts the delay of the currently active step (overrides the branch default). Recalculates `scheduledAt`.

**Body:**
```json
{
  "delayUnit": "day",
  "delayValue": 2,
  "delayEditNote": "Khách hẹn gọi lại thứ Hai"
}
```

**Response `200`:** Updated EventActionChain.

**Errors:** `400 VALIDATION_ERROR`, `404 CHAIN_NOT_FOUND`

---

### 8.6 Update Step Note

```
PATCH /api/events/:eventId/chains/:chainId/steps/:stepOrder/note
Authorization: Bearer <accessToken>
Permission: event_chains_update
```

> Updates note for any step (including done/locked steps).

**Body:**
```json
{
  "note": "Cập nhật: khách xác nhận sẽ thanh toán thứ Sáu"
}
```

**Response `200`:** Updated EventActionChain.

**Errors:** `400 VALIDATION_ERROR`, `404 CHAIN_NOT_FOUND`

---

### 8.7 Upsert Step Branch

```
PUT /api/events/:eventId/chains/:chainId/steps/:stepOrder/branches
Authorization: Bearer <accessToken>
Permission: event_chains_update
```

> Adds or updates a branch for a specific step.

**Body:**
```json
{
  "resultId": "RES009",
  "order": 2,
  "nextStepType": "next_in_chain",
  "nextActionId": "ACT013",
  "closeOutcome": null,
  "delayUnit": "day",
  "delayValue": 1
}
```

**Response `200`:** Updated EventActionChain.

**Errors:** `400 VALIDATION_ERROR`, `404 CHAIN_NOT_FOUND`

---

### 8.8 Delete Step Branch

```
DELETE /api/events/:eventId/chains/:chainId/steps/:stepOrder/branches/:resultId
Authorization: Bearer <accessToken>
Permission: event_chains_update
```

**Response `200`:** Updated EventActionChain.

**Errors:** `404 CHAIN_NOT_FOUND`, `404 BRANCH_NOT_FOUND`

---

### 8.9 Close Chain

```
PUT /api/events/:eventId/chains/:chainId/close
Authorization: Bearer <accessToken>
Permission: event_chains_close
```

> Marks the chain as `closed`. All remaining pending steps are marked as `skipped`.

**Response `200`:**
```json
{
  "success": true,
  "message": "Close chain success",
  "data": { "chain": { "status": "closed", ... } }
}
```

**Errors:** `404 CHAIN_NOT_FOUND`

---

### 8.10 Delete Chain

```
DELETE /api/events/:eventId/chains/:chainId
Authorization: Bearer <accessToken>
Permission: event_chains_delete
```

**Response `200`:** `{ "success": true, "message": "Delete chain success", "data": null }`

**Errors:** `404 CHAIN_NOT_FOUND`

---

## 9. Organization

**Base path:** `/api/organization`  
**All routes require authentication.**

### 9.1 List Organization (Departments & Groups)

```
GET /api/organization
Authorization: Bearer <accessToken>
Permission: organization_read
```

**Response `200`:** Paginated list of organization items.

**Example item:**
```json
{
  "id": "2",
  "alias": "phong-sale",
  "parent": "Phòng Sale",
  "children": [
    { "alias": "phong-sale-nhom-sale-ha-noi", "name": "Nhóm Sale Hà Nội", "desc": "Telesale & chốt đơn khu vực miền Bắc" },
    { "alias": "phong-sale-nhom-sale-hcm",    "name": "Nhóm Sale HCM",    "desc": "Telesale & chốt đơn khu vực miền Nam" }
  ]
}
```

---

### 9.2 Create Department

```
POST /api/organization/departments
Authorization: Bearer <accessToken>
Permission: organization_update
```

**Body:**
```json
{
  "name": "Phòng Kinh Doanh",
  "alias": "phong-kinh-doanh",
  "desc": "Phòng kinh doanh tổng hợp"
}
```

> `alias` is auto-generated from `name` if not provided.

**Response `201`:** Created department object.

**Errors:** `400 VALIDATION_ERROR`, `409 DEPARTMENT_ALREADY_EXISTS`

---

### 9.3 Create Group (Sub-department)

```
POST /api/organization/groups
Authorization: Bearer <accessToken>
Permission: organization_update
```

**Body:**
```json
{
  "name": "Nhóm Sale Miền Trung",
  "desc": "Telesale khu vực Đà Nẵng",
  "parentId": "2",
  "parentAlias": "phong-sale",
  "alias": "phong-sale-nhom-sale-mien-trung"
}
```

> Either `parentId` or `parentAlias` is required.  
> `alias` is auto-generated if not provided.

**Response `201`:** Created group object.

**Errors:** `400 VALIDATION_ERROR`, `404 DEPARTMENT_NOT_FOUND`, `409 GROUP_ALREADY_EXISTS`

---

## 10. Metadata

**Base path:** `/api/metadata`  
**All routes require authentication + `metadata_read` permission.**

### 10.1 Get All Metadata

```
GET /api/metadata
Authorization: Bearer <accessToken>
```

**Response `200`:**
```json
{
  "success": true,
  "message": "Get metadata success",
  "data": {
    "platforms": ["SmaxAi", "Botvn", "Appvn"],
    "customerGroups": ["Nhóm Sale Hà Nội", "Nhóm Sale HCM", ...],
    "customerTypes": ["Standard Customer", "VIP Customer", "Premium", "Enterprise", "Trial"],
    "staffRoles": [
      { "id": "role-staff", "value": "STAFF", "label": "Nhân viên", "level": 1 }
    ],
    "departments": ["Phòng Marketing", "Phòng Sale", "Phòng Kỹ Thuật", "Phòng CSKH"],
    "departmentOptions": [
      {
        "id": "2",
        "alias": "phong-sale",
        "value": "phong-sale",
        "label": "Phòng Sale",
        "groups": [
          { "alias": "phong-sale-nhom-sale-ha-noi", "label": "Nhóm Sale Hà Nội" }
        ]
      }
    ]
  }
}
```

---

### 10.2 Get Roles Metadata

```
GET /api/metadata/roles?page=1&limit=20
```

**Response `200`:** Paginated list of role metadata objects.

---

### 10.3 Get Departments Metadata

```
GET /api/metadata/departments?page=1&limit=20
```

**Response `200`:** Paginated list of department names.

---

### 10.4 Get Department Groups

```
GET /api/metadata/department-groups
```

**Response `200`:** Full list of department objects with their groups.

---

### 10.5 Get Activity Groups

```
GET /api/metadata/activity-groups?page=1&limit=20
```

**Response `200`:** Paginated list of all leaf groups.

---

### 10.6 Get Customer Groups

```
GET /api/metadata/customer-groups?page=1&limit=20
```

**Response `200`:** Paginated list of customer group names.

---

## 11. Functions

**Base path:** `/api/functions`  
**All routes require authentication.**

### 11.1 List Functions

```
GET /api/functions?page=1&limit=20
Authorization: Bearer <accessToken>
Permission: functions_read
```

**Response `200`:** Paginated list of staff function objects.

---

### 11.2 Create Function

```
POST /api/functions
Authorization: Bearer <accessToken>
Permission: functions_create
```

**Body:**
```json
{
  "title": "CSKH",
  "desc": "Chăm sóc và hỗ trợ sau bán hàng",
  "type": "cskh"
}
```

**Response `201`:**
```json
{
  "success": true,
  "message": "Create function success",
  "data": {
    "id": "FUNC005",
    "title": "CSKH",
    "desc": "Chăm sóc và hỗ trợ sau bán hàng",
    "type": "cskh"
  }
}
```

**Errors:** `400 VALIDATION_ERROR`

---

## 12. RBAC

**Base path:** `/api/rbac`  
**All routes require authentication.**

### 12.1 List All Permissions

```
GET /api/rbac
Authorization: Bearer <accessToken>
Permission: permissions_read
```

**Response `200`:**
```json
{
  "success": true,
  "message": "Get permissions success",
  "data": [
    {
      "id": "events_read",
      "name": "Read Events",
      "resource": "events",
      "action": "read",
      "description": "View events list and details"
    }
  ]
}
```

---

### 12.2 Get Permission by ID

```
GET /api/rbac/:id
Authorization: Bearer <accessToken>
Permission: permissions_read
```

**Response `200`:** Single permission object.

**Errors:** `404 PERMISSION_NOT_FOUND`

---

### 12.3 List All Roles

```
GET /api/rbac/roles
Authorization: Bearer <accessToken>
Permission: roles_read
```

**Response `200`:** Array of all role objects.

---

### 12.4 Get Role by ID

```
GET /api/rbac/roles/:id
Authorization: Bearer <accessToken>
Permission: roles_read
```

**Response `200`:** Role object including `permissionsDetails` array.

**Errors:** `404 ROLE_NOT_FOUND`

---

### 12.5 Create Role

```
POST /api/rbac/roles
Authorization: Bearer <accessToken>
Permission: roles_manage
```

**Body:**
```json
{
  "id": "role-custom",
  "name": "CUSTOM_ROLE",
  "description": "A custom role for specific use",
  "permissions": ["customers_read", "leads_read", "events_read"],
  "level": 1
}
```

**Response `201`:** Created role object.

**Errors:** `400 VALIDATION_ERROR`, `409 ROLE_ALREADY_EXISTS`

---

### 12.6 Update Role

```
PUT /api/rbac/roles/:id
Authorization: Bearer <accessToken>
Permission: roles_manage
```

**Body** (at least one field required):
```json
{
  "name": "UPDATED_ROLE",
  "description": "Updated description",
  "permissions": ["customers_read", "events_read", "events_update"],
  "level": 2
}
```

**Response `200`:** Updated role object.

**Errors:** `400 VALIDATION_ERROR`, `403 FORBIDDEN` (system roles), `404 ROLE_NOT_FOUND`

---

### 12.7 Delete Role

```
DELETE /api/rbac/roles/:id
Authorization: Bearer <accessToken>
Permission: roles_manage
```

**Response `200`:** `{ "success": true, "message": "Delete role success", "data": null }`

**Errors:** `403 FORBIDDEN` (system roles), `404 ROLE_NOT_FOUND`

---

## 13. Action Config

**Base path:** `/api/action-config`  
**All routes require authentication.**

### 13.1 Results

#### List Results

```
GET /api/action-config/results?search=&page=1&limit=200
Authorization: Bearer <accessToken>
Permission: actions_cfg_read
```

#### Create Result

```
POST /api/action-config/results
Authorization: Bearer <accessToken>
Permission: actions_cfg_create
```

**Body:**
```json
{
  "name": "Đã demo thành công",
  "type": "success",
  "description": "Buổi demo được khách hàng đánh giá tốt"
}
```

> `type`: `"success"` | `"failure"` | `"neutral"` | `"incomplete"` | `"skip"`

#### Update Result

```
PUT /api/action-config/results/:id
Authorization: Bearer <accessToken>
Permission: actions_cfg_update
```

**Body** (at least one field required):
```json
{
  "name": "Đã demo rất thành công",
  "type": "success"
}
```

#### Delete Result

```
DELETE /api/action-config/results/:id
Authorization: Bearer <accessToken>
Permission: actions_cfg_delete
```

---

### 13.2 Reasons

#### List Reasons

```
GET /api/action-config/reasons?search=&page=1&limit=200
Authorization: Bearer <accessToken>
Permission: actions_cfg_read
```

#### Create Reason

```
POST /api/action-config/reasons
Authorization: Bearer <accessToken>
Permission: actions_cfg_create
```

**Body:**
```json
{
  "name": "Cần duyệt nội bộ",
  "description": "Phải chờ cấp trên duyệt ngân sách/hợp đồng"
}
```

#### Update Reason

```
PUT /api/action-config/reasons/:id
Authorization: Bearer <accessToken>
Permission: actions_cfg_update
```

#### Delete Reason

```
DELETE /api/action-config/reasons/:id
Authorization: Bearer <accessToken>
Permission: actions_cfg_delete
```

---

### 13.3 Actions

#### List Actions

```
GET /api/action-config/actions?search=&page=1&limit=200
Authorization: Bearer <accessToken>
Permission: actions_cfg_read
```

#### Create Action

```
POST /api/action-config/actions
Authorization: Bearer <accessToken>
Permission: actions_cfg_create
```

**Body:**
```json
{
  "name": "Gọi demo sản phẩm",
  "type": "call",
  "category": "primary",
  "reasonIds": ["REAS007", "REAS010", "REAS011"],
  "description": "Gọi để giới thiệu demo trực tiếp với khách hàng"
}
```

> `type`: `"call"` | `"send_block_automation"` | `"other"` | `"review"` | `"manual_order"` | `"create_booking"`  
> `category`: `"primary"` | `"secondary"` (auto-derived from `type` if omitted)

#### Update Action

```
PUT /api/action-config/actions/:id
Authorization: Bearer <accessToken>
Permission: actions_cfg_update
```

**Body** (at least one field required): Same fields as create.

#### Delete Action

```
DELETE /api/action-config/actions/:id
Authorization: Bearer <accessToken>
Permission: actions_cfg_delete
```

---

### 13.4 Action Chains

#### List Action Chains

```
GET /api/action-config/chains?search=&page=1&limit=200
Authorization: Bearer <accessToken>
Permission: actions_cfg_read
```

#### Get Action Chain by ID

```
GET /api/action-config/chains/:id
Authorization: Bearer <accessToken>
Permission: actions_cfg_read
```

**Response `200`:** Full chain object including `steps` and nested `branches`.

#### Create Action Chain

```
POST /api/action-config/chains
Authorization: Bearer <accessToken>
Permission: actions_cfg_create
```

**Body:**
```json
{
  "name": "Chuỗi theo dõi sau demo",
  "description": "Theo dõi khách hàng sau buổi demo: gọi → gửi proposal → chốt",
  "delayUnit": "day",
  "delayValue": 1,
  "active": true,
  "steps": [
    {
      "order": 1,
      "actionId": "ACT001",
      "branches": [
        {
          "resultId": "RES001",
          "order": 1,
          "nextStepType": "next_in_chain",
          "nextActionId": "ACT008",
          "closeOutcome": null,
          "delayUnit": "day",
          "delayValue": 1
        },
        {
          "resultId": "RES004",
          "order": 2,
          "nextStepType": "close_task",
          "nextActionId": null,
          "closeOutcome": "failure",
          "delayUnit": null,
          "delayValue": null
        }
      ]
    },
    {
      "order": 2,
      "actionId": "ACT008",
      "branches": [
        {
          "resultId": "RES010",
          "order": 1,
          "nextStepType": "next_in_chain",
          "nextActionId": "ACT010",
          "closeOutcome": null,
          "delayUnit": "day",
          "delayValue": 2
        }
      ]
    },
    {
      "order": 3,
      "actionId": "ACT010",
      "branches": [
        {
          "resultId": "RES006",
          "order": 1,
          "nextStepType": "close_task",
          "nextActionId": null,
          "closeOutcome": "success",
          "delayUnit": null,
          "delayValue": null
        },
        {
          "resultId": "RES004",
          "order": 2,
          "nextStepType": "close_task",
          "nextActionId": null,
          "closeOutcome": "failure",
          "delayUnit": null,
          "delayValue": null
        }
      ]
    }
  ]
}
```

> `delayUnit`: `"immediate"` | `"minute"` | `"hour"` | `"day"` | `"week"`  
> `nextStepType`: `"next_in_chain"` | `"close_task"` | `"close_chain"` | `"close_chain_clone_task"` | `"create_order"` | `"call_block_automation"` | `"add_from_other_chain"`  
> `closeOutcome`: `"success"` | `"failure"` (required when `nextStepType === "close_task"`)

**Response `201`:** Created action chain object.

#### Update Action Chain

```
PUT /api/action-config/chains/:id
Authorization: Bearer <accessToken>
Permission: actions_cfg_update
```

**Body** (at least one field required): Same fields as create, all optional.

**Response `200`:** Updated action chain object.

#### Delete Action Chain

```
DELETE /api/action-config/chains/:id
Authorization: Bearer <accessToken>
Permission: actions_cfg_delete
```

**Response `200`:** `{ "success": true, "message": "Delete chain success", "data": null }`

---

## 14. System Routes

### Health Check

```
GET /health
```

**Response `200`:**
```json
{
  "status": "ok",
  "timestamp": "2026-04-18T06:00:00Z",
  "uptime": 3600
}
```

### API Info

```
GET /api
```

**Response `200`:**
```json
{
  "success": true,
  "message": "CRM API v1",
  "data": {
    "version": "1.0.0",
    "environment": "development"
  }
}
```

---

## 15. Enum Reference

### Event Groups

| ID              | Label          | Color     |
|-----------------|----------------|-----------|
| `user_moi`      | User mới       | `#3b82f6` |
| `biz_moi`       | Biz Mới        | `#9333ea` |
| `can_nang_cap`  | Cần nâng cấp   | `#22c55e` |
| `sap_het_han`   | Sắp hết hạn    | `#f97316` |
| `chuyen_khoan`  | Chuyển khoản   | `#eab308` |

### Action Types

| Value                  | Category    | Description              |
|------------------------|-------------|--------------------------|
| `call`                 | primary     | Gọi điện                 |
| `send_block_automation`| primary     | Gửi automation block     |
| `other`                | primary     | Hành động khác           |
| `review`               | secondary   | Review/kiểm tra          |
| `manual_order`         | secondary   | Tạo đơn thủ công         |
| `create_booking`       | secondary   | Tạo booking demo         |

### Result Types

| Value        | Description                        |
|--------------|------------------------------------|
| `success`    | Kết quả thành công                 |
| `failure`    | Kết quả thất bại                   |
| `neutral`    | Hoàn thành (không phân loại)       |
| `incomplete` | Chưa hoàn thành                    |
| `skip`       | Bỏ qua                             |

### Next Step Types (Branch)

| Value                    | Description                          |
|--------------------------|--------------------------------------|
| `next_in_chain`          | Sang hành động tiếp theo trong chuỗi |
| `close_task`             | Đóng tác vụ (chọn success/failure)   |
| `close_chain`            | Đóng chuỗi hành động                 |
| `close_chain_clone_task` | Đóng chuỗi và tạo bản sao tác vụ    |
| `create_order`           | Tạo đơn hàng                         |
| `call_block_automation`  | Gọi Block Automation                 |
| `add_from_other_chain`   | Thêm HĐ từ chuỗi khác               |

### Delay Units

| Value       | Description |
|-------------|-------------|
| `immediate` | Ngay lập tức|
| `minute`    | Phút        |
| `hour`      | Giờ         |
| `day`       | Ngày        |
| `week`      | Tuần        |

### Close Outcomes

| Value     | Description  |
|-----------|--------------|
| `success` | Thành công   |
| `failure` | Thất bại     |

### Timeline Types

| Value   | Description         |
|---------|---------------------|
| `phone` | Cuộc gọi điện thoại |
| `email` | Email               |
| `event` | Sự kiện hệ thống    |
| `note`  | Ghi chú nội bộ      |

### Roles

| Role      | Level | Description               |
|-----------|-------|---------------------------|
| `OWNER`   | 4     | Chủ hệ thống              |
| `ADMIN`   | 3     | Quản trị viên             |
| `MANAGER` | 2     | Quản lý nhóm              |
| `STAFF`   | 1     | Nhân viên                 |

---

## 16. Error Codes

| HTTP | Code                      | Description                              |
|------|---------------------------|------------------------------------------|
| 400  | `VALIDATION_ERROR`        | Request body/query validation failed     |
| 401  | `UNAUTHORIZED`            | Missing or invalid access token          |
| 401  | `INVALID_CREDENTIALS`     | Wrong email or password                  |
| 401  | `INVALID_SESSION`         | Session not found or expired             |
| 401  | `INVALID_REFRESH_TOKEN`   | Refresh token invalid or expired         |
| 401  | `INVALID_CURRENT_PASSWORD`| Current password incorrect               |
| 401  | `INVALID_RESET_TOKEN`     | Password reset token invalid/expired     |
| 403  | `FORBIDDEN`               | Insufficient permissions                 |
| 404  | `USER_NOT_FOUND`          | User not found                           |
| 404  | `CUSTOMER_NOT_FOUND`      | Customer not found                       |
| 404  | `LEAD_NOT_FOUND`          | Lead not found                           |
| 404  | `TASK_NOT_FOUND`          | Task not found                           |
| 404  | `EVENT_NOT_FOUND`         | Event not found                          |
| 404  | `CHAIN_NOT_FOUND`         | Action chain not found                   |
| 404  | `ACTION_CHAIN_NOT_FOUND`  | Template action chain not found          |
| 404  | `BRANCH_NOT_FOUND`        | Branch not found on step                 |
| 404  | `PERMISSION_NOT_FOUND`    | Permission not found                     |
| 404  | `ROLE_NOT_FOUND`          | Role not found                           |
| 404  | `DEPARTMENT_NOT_FOUND`    | Department not found                     |
| 409  | `DUPLICATE_VALUE`         | Resource already exists (unique conflict)|
| 409  | `CHAIN_ALREADY_EXISTS`    | Chain already linked to this event       |
| 409  | `DEPARTMENT_ALREADY_EXISTS`| Department name already exists          |
| 409  | `GROUP_ALREADY_EXISTS`    | Group name already exists in department  |
| 409  | `ROLE_ALREADY_EXISTS`     | Role ID already exists                   |
| 429  | `RATE_LIMIT_EXCEEDED`     | Too many requests                        |
| 500  | `INTERNAL_SERVER_ERROR`   | Unexpected server error                  |

---

## 17. Seed Data Overview

The seed script (`node src/scripts/resetAndSeed.js`) populates the following data:

### Users (8 total)

| ID       | Name               | Role    | Email                    | Password      |
|----------|--------------------|---------|--------------------------|---------------|
| USER001  | Chủ hệ thống CRM   | OWNER   | owner@crm.vn             | Owner@123     |
| USER002  | Quản trị CRM       | ADMIN   | admin@crm.vn             | Admin@123     |
| USER003  | Phạm Thanh Sơn     | MANAGER | manager.sale@crm.vn      | Manager@123   |
| USER006  | Nguyễn Thị Mai     | MANAGER | manager.cskh@crm.vn      | Manager@123   |
| USER004  | Vũ Thu Phương      | STAFF   | staff1@crm.vn            | Staff@123     |
| USER005  | Lê Văn Hùng        | STAFF   | staff2@crm.vn            | Staff@123     |
| USER007  | Trần Đức Anh       | STAFF   | staff3@crm.vn            | Staff@123     |
| USER008  | Hoàng Diệu Linh    | STAFF   | staff4@crm.vn            | Staff@123     |

### Events (17 total)

Events cover all 5 groups with diverse states:

| ID      | Group          | Assignee Status | Customer Sync | Scenario                           |
|---------|----------------|-----------------|---------------|------------------------------------|
| EVT001  | user_moi       | Assigned        | Synced        | Đăng ký tài khoản mới             |
| EVT002  | user_moi       | Assigned        | Synced        | Hoàn tất hồ sơ cá nhân            |
| EVT003  | user_moi       | **Unassigned**  | Synced        | Người dùng mới từ Google Ads      |
| EVT004  | user_moi       | **Unassigned**  | **Unsynced**  | Đăng ký qua landing page          |
| EVT005  | biz_moi        | Assigned        | Synced        | Tạo doanh nghiệp thành công       |
| EVT006  | biz_moi        | Assigned        | Synced        | Kết nối kênh chat (Enterprise)    |
| EVT007  | biz_moi        | **Unassigned**  | Synced        | Doanh nghiệp mới từ website       |
| EVT008  | can_nang_cap   | Assigned        | Synced        | Dung lượng sắp đầy                |
| EVT009  | can_nang_cap   | Assigned        | Synced        | Trial hết hạn                     |
| EVT010  | can_nang_cap   | **Unassigned**  | Synced        | Vượt giới hạn user                |
| EVT011  | sap_het_han    | Assigned        | Synced        | Còn 7 ngày (Enterprise)           |
| EVT012  | sap_het_han    | Assigned        | Synced        | Còn 2 ngày (Khẩn cấp)            |
| EVT013  | sap_het_han    | **Unassigned**  | Synced        | Còn 14 ngày (VIP KH)             |
| EVT014  | chuyen_khoan   | Assigned        | Synced        | Xác nhận thanh toán thành công    |
| EVT015  | chuyen_khoan   | Assigned        | Synced        | Chờ xác nhận chuyển khoản         |
| EVT016  | chuyen_khoan   | **Unassigned**  | Synced        | CK không có đơn hàng khớp        |
| EVT017  | chuyen_khoan   | **Unassigned**  | **Unsynced**  | KH chưa trong hệ thống CK tiền    |

### Action Chains (6 total)

| ID       | Name                        | Steps | Active | Đặc điểm                      |
|----------|-----------------------------|-------|--------|-------------------------------|
| CHAIN001 | Chăm sóc khách hàng mới     | 3     | ✅     | Email → Gọi 1 → Gọi 2         |
| CHAIN002 | Xử lý chuyển khoản          | 1     | ✅     | Xác nhận thanh toán            |
| CHAIN003 | Nhắc gia hạn gói cước       | 3     | ✅     | Email → Tư vấn → Gọi khẩn     |
| CHAIN004 | Chuyển đổi Trial → Trả phí  | 5     | ✅     | Chuỗi đầy đủ 5 bước + demo    |
| CHAIN005 | Hỗ trợ doanh nghiệp mới     | 3     | ✅     | SMS → Hỗ trợ KT → Demo book   |
| CHAIN006 | Nâng cấp Enterprise         | 5     | ❌     | Inactive — đang review         |

### Results (16), Reasons (12), Actions (16)

See respective API endpoints for full lists.
