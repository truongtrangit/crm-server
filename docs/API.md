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
8. [Organization — `/api/organization`](#8-organization)
9. [Metadata — `/api/metadata`](#9-metadata)
10. [Functions — `/api/functions`](#10-functions)
11. [RBAC (Roles & Permissions) — `/api/rbac`](#11-rbac)
12. [Action Config — `/api/action-config`](#12-action-config)
13. [System Routes](#13-system-routes)
14. [Enum Reference](#14-enum-reference)
15. [Error Codes](#15-error-codes)

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
      "id": "USER-001",
      "name": "Admin User",
      "email": "admin@example.com",
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
{
  "email": "user@example.com"
}
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
      "id": "USER-001",
      "name": "Admin",
      "email": "admin@example.com",
      "role": "ADMIN",
      "roleId": "role-admin",
      "avatar": "",
      "phone": "",
      "department": ["Engineering"],
      "departmentAliases": ["engineering"],
      "group": ["Backend"],
      "groupAliases": ["engineering-backend"],
      "managerId": null,
      "permissions": [],
      "lastLoginAt": "2026-04-16T13:00:00Z"
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
  "department": ["Sales"],
  "departmentAliases": ["sales"],
  "group": ["Group A"],
  "groupAliases": ["sales-group-a"]
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
  "department": ["Sales"],
  "departmentAliases": ["sales"],
  "managerId": "USER-001"
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
  "department": ["Sales"],
  "departmentAliases": ["sales"],
  "group": ["Group A"],
  "groupAliases": ["sales-group-a"],
  "managerId": "USER-001"
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
  "department": ["Engineering"],
  "group": ["Backend"]
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
  "name": "John Doe",
  "email": "john@example.com",
  "avatar": "https://example.com/avatar.jpg",
  "type": "Standard Customer",
  "phone": "0901234567",
  "biz": ["BIZ-001"],
  "platforms": ["SmaxAi"],
  "group": "Mới",
  "registeredAt": "2026-01-01",
  "lastLoginAt": "2026-04-01",
  "tags": ["VIP", "Priority"]
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
  "name": "Jane Doe",
  "email": "jane@example.com",
  "type": "VIP Customer",
  "tags": ["VIP"]
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
  "userId": "USER-002",
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
    "name": "Nguyen Van A",
    "avatar": ""
  },
  "status": "Biz tạo mới",
  "actionNeeded": "Gọi điện tư vấn",
  "actionType": "orange",
  "email": "lead@company.com",
  "phone": "0901234567",
  "source": "Facebook Ads",
  "address": "Hanoi, Vietnam"
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
{
  "status": "Đang tư vấn"
}
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
    "name": "John Doe",
    "avatar": "",
    "email": "john@example.com",
    "phone": "0901234567"
  },
  "platform": "SmaxAi",
  "assignee": {
    "name": "Nguyen Van A",
    "avatar": ""
  },
  "status": "Đang thực hiện"
}
```

> Either `action` or `name` must be provided.  
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

| Param      | Type   | Description                                                |
|------------|--------|------------------------------------------------------------|
| `search`   | string | Name or customer info                                      |
| `group`    | string | `user_moi` \| `biz_moi` \| `can_nang_cap` \| `sap_het_han` \| `chuyen_khoan` |
| `stage`    | string | Filter by stage                                            |
| `assignee` | string | Filter by assignee name                                    |
| `page`     | int    | Page number                                                |
| `limit`    | int    | Items per page (max 100)                                   |

**Response `200`:** Paginated event list.

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
    "total": 120,
    "byGroup": {
      "user_moi": 30,
      "biz_moi": 25,
      "can_nang_cap": 20,
      "sap_het_han": 15,
      "chuyen_khoan": 30
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

**Response `200`:** Full event object including `timeline`.

**Errors:** `404 EVENT_NOT_FOUND`

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
  "name": "SmaxAi Enterprise",
  "sub": "Gói doanh nghiệp",
  "group": "biz_moi",
  "customer": {
    "name": "Nguyen Van A",
    "avatar": "",
    "role": "CEO",
    "email": "ceo@company.com",
    "phone": "0901234567",
    "source": "Referral",
    "address": "Hanoi"
  },
  "biz": {
    "id": "BIZ-001",
    "tags": ["enterprise", "priority"]
  },
  "assignee": {
    "name": "Sale Staff A",
    "avatar": "",
    "role": "sale"
  },
  "customerId": "CUST-001",
  "assigneeId": "USER-002",
  "stage": "Đang tư vấn",
  "source": "CRM",
  "tags": ["hot", "Q2"],
  "plan": {
    "name": "PRO",
    "cycle": "Thanh toán theo năm",
    "price": "5,000,000 đ",
    "daysLeft": 365,
    "expiryDate": "2027-04-16"
  },
  "services": [
    { "name": "SMS Marketing", "active": true },
    { "name": "Email Automation", "active": false }
  ],
  "quotas": [
    { "name": "Tin nhắn", "used": 500, "total": 1000, "color": "blue" },
    { "name": "Email", "used": 100, "total": "unlimited", "color": "green" }
  ]
}
```

> `group`: `"user_moi"` | `"biz_moi"` | `"can_nang_cap"` | `"sap_het_han"` | `"chuyen_khoan"`

**Response `201`:** Created event object.

---

### 7.5 Update Event

```
PUT /api/events/:id
Authorization: Bearer <accessToken>
Permission: events_update
```

**Body** (at least one field required): Same fields as create, all optional.

**Response `200`:** Updated event object.

**Errors:** `400 VALIDATION_ERROR`, `404 EVENT_NOT_FOUND`

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
  "time": "14:00 16/04/2026",
  "content": "Khách đang cân nhắc...",
  "duration": "15 phút"
}
```

> `type`: `"phone"` | `"email"` | `"event"` | `"note"`

**Response `201`:** Updated event object with new timeline entry.

**Errors:** `400 VALIDATION_ERROR`, `404 EVENT_NOT_FOUND`

---

### 7.7 Delete Event

```
DELETE /api/events/:id
Authorization: Bearer <accessToken>
Permission: events_delete
```

**Response `200`:** `{ "success": true, "message": "Delete event success", "data": null }`

**Errors:** `404 EVENT_NOT_FOUND`

---

### 7.8 Sync Event Customer

```
POST /api/events/:id/sync-customer
Authorization: Bearer <accessToken>
Permission: events_update
```

> Syncs the event's embedded customer data from the linked `customerId`.

**Response `200`:** Updated event object.

**Errors:** `404 EVENT_NOT_FOUND`, `404 CUSTOMER_NOT_FOUND`

---

## 8. Organization

**Base path:** `/api/organization`  
**All routes require authentication.**

### 8.1 List Organization (Departments & Groups)

```
GET /api/organization
Authorization: Bearer <accessToken>
Permission: organization_read
```

**Response `200`:** Paginated list of organization items.

**Example item:**
```json
{
  "id": "1",
  "alias": "sales",
  "parent": "Sales",
  "children": [
    { "alias": "sales-b2b", "name": "B2B Sales", "desc": "Enterprise clients" },
    { "alias": "sales-b2c", "name": "B2C Sales", "desc": "" }
  ]
}
```

---

### 8.2 Create Department

```
POST /api/organization/departments
Authorization: Bearer <accessToken>
Permission: organization_update
```

**Body:**
```json
{
  "name": "Engineering",
  "alias": "engineering",
  "desc": "Engineering department"
}
```

> `alias` is auto-generated from `name` if not provided.

**Response `201`:** Created department object.

**Errors:** `400 VALIDATION_ERROR`, `409 DEPARTMENT_ALREADY_EXISTS`

---

### 8.3 Create Group (Sub-department)

```
POST /api/organization/groups
Authorization: Bearer <accessToken>
Permission: organization_update
```

**Body:**
```json
{
  "name": "Backend Team",
  "desc": "Node.js / Go backend developers",
  "parentId": "1",
  "parentAlias": "engineering",
  "alias": "engineering-backend"
}
```

> Either `parentId` or `parentAlias` is required.  
> `alias` is auto-generated if not provided.

**Response `201`:**
```json
{
  "success": true,
  "message": "Create group success",
  "data": {
    "alias": "engineering-backend",
    "name": "Backend Team",
    "desc": "Node.js / Go backend developers",
    "parentId": "1",
    "parentAlias": "engineering"
  }
}
```

**Errors:** `400 VALIDATION_ERROR`, `404 DEPARTMENT_NOT_FOUND`, `409 GROUP_ALREADY_EXISTS`

---

## 9. Metadata

**Base path:** `/api/metadata`  
**All routes require authentication + `metadata_read` permission.**

### 9.1 Get All Metadata

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
    "customerGroups": ["Mới", "Tiềm năng", "Thân thiết", "Rời bỏ", "VIP"],
    "customerTypes": ["Standard Customer", "VIP Customer", "Partner", "Regular", "Premium"],
    "staffRoles": [ { "id": "role-staff", "value": "STAFF", "label": "Staff", "level": 1 } ],
    "userRoles": [ ... ],
    "departments": ["Sales", "Engineering"],
    "departmentOptions": [ { "id": "1", "alias": "sales", "value": "sales", "label": "Sales", "groups": [...] } ],
    "departmentGroups": [ ... ],
    "activityGroups": [ { "alias": "sales-b2b", "label": "B2B Sales", ... } ]
  }
}
```

---

### 9.2 Get Roles Metadata

```
GET /api/metadata/roles?page=1&limit=20
Authorization: Bearer <accessToken>
```

**Response `200`:** Paginated list of role metadata objects.

---

### 9.3 Get Departments Metadata

```
GET /api/metadata/departments?page=1&limit=20
Authorization: Bearer <accessToken>
```

**Response `200`:** Paginated list of department names.

---

### 9.4 Get Department Groups

```
GET /api/metadata/department-groups
Authorization: Bearer <accessToken>
```

**Response `200`:** Full list of department objects with their groups.

---

### 9.5 Get Activity Groups

```
GET /api/metadata/activity-groups?page=1&limit=20
Authorization: Bearer <accessToken>
```

**Response `200`:** Paginated list of all leaf groups.

---

### 9.6 Get Customer Groups

```
GET /api/metadata/customer-groups?page=1&limit=20
Authorization: Bearer <accessToken>
```

**Response `200`:** Paginated list of customer group names.

---

## 10. Functions

**Base path:** `/api/functions`  
**All routes require authentication.**

### 10.1 List Functions

```
GET /api/functions?page=1&limit=20
Authorization: Bearer <accessToken>
Permission: functions_read
```

**Response `200`:** Paginated list of staff function objects.

---

### 10.2 Create Function

```
POST /api/functions
Authorization: Bearer <accessToken>
Permission: functions_create
```

**Body:**
```json
{
  "title": "Backend Developer",
  "desc": "Develops and maintains backend services",
  "type": "tech"
}
```

**Response `201`:**
```json
{
  "success": true,
  "message": "Create function success",
  "data": {
    "id": "FUNC-001",
    "title": "Backend Developer",
    "desc": "Develops and maintains backend services",
    "type": "tech"
  }
}
```

**Errors:** `400 VALIDATION_ERROR`

---

## 11. RBAC

**Base path:** `/api/rbac`  
**All routes require authentication.**

### 11.1 List All Permissions

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
      "id": "users_create",
      "name": "Create Users",
      "resource": "users",
      "action": "create",
      "description": ""
    }
  ]
}
```

---

### 11.2 Get Permission by ID

```
GET /api/rbac/:id
Authorization: Bearer <accessToken>
Permission: permissions_read
```

**Response `200`:** Single permission object.

**Errors:** `404 PERMISSION_NOT_FOUND`

---

### 11.3 List All Roles

```
GET /api/rbac/roles
Authorization: Bearer <accessToken>
Permission: roles_read
```

**Response `200`:** Array of all role objects.

---

### 11.4 Get Role by ID

```
GET /api/rbac/roles/:id
Authorization: Bearer <accessToken>
Permission: roles_read
```

**Response `200`:** Role object including `permissionsDetails` array.

**Errors:** `404 ROLE_NOT_FOUND`

---

### 11.5 Create Role

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
  "permissions": ["customers_read", "leads_read"],
  "level": 1
}
```

**Response `201`:** Created role object.

**Errors:** `400 VALIDATION_ERROR`, `409 ROLE_ALREADY_EXISTS`

---

### 11.6 Update Role

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
  "permissions": ["customers_read", "leads_read", "tasks_read"],
  "level": 2
}
```

**Response `200`:** Updated role object.

**Errors:** `400 VALIDATION_ERROR`, `403 FORBIDDEN` (system roles), `404 ROLE_NOT_FOUND`

---

### 11.7 Delete Role

```
DELETE /api/rbac/roles/:id
Authorization: Bearer <accessToken>
Permission: roles_manage
```

**Response `200`:** `{ "success": true, "message": "Delete role success", "data": null }`

**Errors:** `403 FORBIDDEN` (system roles), `404 ROLE_NOT_FOUND`

---

## 12. Action Config

**Base path:** `/api/action-config`  
**All routes require authentication.**

---

### 12.1 Results

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
  "name": "Khách quan tâm",
  "type": "success",
  "description": "Khách hàng thể hiện sự quan tâm rõ ràng"
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
  "name": "Khách rất quan tâm",
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

### 12.2 Reasons

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
  "name": "Lý do khách không quan tâm",
  "description": "Khách hàng đã có giải pháp khác"
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

### 12.3 Actions

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
  "name": "Gọi điện lần 1",
  "type": "call",
  "category": "primary",
  "reasonIds": ["reason-001", "reason-002"],
  "description": "Cuộc gọi chào hỏi đầu tiên"
}
```

> `type`: `"call"` | `"email"` | `"meeting"` | `"sms"` | `"send_block_automation"` | `"review"` | `"manual_order"` | `"other"`  
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

### 12.4 Action Chains

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

**Response `200`:** Full chain object including `steps` and `branches`.

#### Create Action Chain

```
POST /api/action-config/chains
Authorization: Bearer <accessToken>
Permission: actions_cfg_create
```

**Body:**
```json
{
  "name": "Chăm sóc khách hàng mới",
  "description": "Quy trình chăm sóc cho khách đăng ký mới",
  "delay": "immediate",
  "active": true,
  "steps": [
    {
      "order": 1,
      "actionId": "action-001",
      "branches": [
        {
          "resultId": "result-001",
          "order": 0,
          "nextStepType": "next_in_chain",
          "nextActionId": "action-002",
          "closeOutcome": null,
          "delayUnit": "day",
          "delayValue": 3
        },
        {
          "resultId": "result-002",
          "order": 1,
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

> `delay`: `"immediate"` | `"1h"` | `"4h"` | `"1d"` | `"3d"` | `"7d"`  
> `nextStepType`: `"next_in_chain"` | `"close_task"` | `"close_chain"` | `"close_chain_clone_task"` | `"create_order"` | `"call_block_automation"` | `"add_from_other_chain"`  
> `closeOutcome`: `"success"` | `"failure"` | `null`  
> `delayUnit` (branch): `"immediate"` | `"hour"` | `"day"` | `"week"` | `null`

**Response `201`:** Created chain object.

#### Update Action Chain

```
PUT /api/action-config/chains/:id
Authorization: Bearer <accessToken>
Permission: actions_cfg_update
```

**Body** (at least one field required): Same fields as create.

**Response `200`:** Updated chain object.

#### Delete Action Chain

```
DELETE /api/action-config/chains/:id
Authorization: Bearer <accessToken>
Permission: actions_cfg_delete
```

**Response `200`:** `{ "success": true, "message": "Delete action chain success", "data": null }`

---

### 12.5 Save Chain Rule Configuration

```
PUT /api/action-config/chains/:id/rule
Authorization: Bearer <accessToken>
Permission: actions_cfg_update
```

> Dedicated endpoint to save the full `steps + branches` configuration for an existing chain (replaces all steps).

**Body:**
```json
{
  "steps": [
    {
      "order": 1,
      "actionId": "action-001",
      "branches": [
        {
          "resultId": "result-001",
          "order": 0,
          "nextStepType": "next_in_chain",
          "nextActionId": "action-002",
          "closeOutcome": null,
          "delayUnit": "day",
          "delayValue": 3
        }
      ]
    },
    {
      "order": 2,
      "actionId": "action-002",
      "branches": [
        {
          "resultId": "result-003",
          "order": 0,
          "nextStepType": "close_task",
          "nextActionId": null,
          "closeOutcome": "success",
          "delayUnit": null,
          "delayValue": null
        }
      ]
    }
  ]
}
```

**Response `200`:** Updated chain object.

**Errors:** `400 VALIDATION_ERROR`, `404 CHAIN_NOT_FOUND`

---

## 13. System Routes

### Health Check

```
GET /health
```

**Response `200`:**
```json
{
  "success": true,
  "message": "Health check success",
  "data": { "status": "ok", "service": "crm-server" }
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
  "message": "CRM server API is running",
  "data": {
    "resources": ["customers", "staff", "auth", "leads", "tasks", "events", "organization", "metadata", "functions", "action-config"]
  }
}
```

---

## 14. Enum Reference

### Customer Types
`"Standard Customer"` | `"VIP Customer"` | `"Partner"` | `"Regular"` | `"Premium"`

### Platforms
`"SmaxAi"` | `"Botvn"` | `"Appvn"`

### Customer Groups (default)
`"Mới"` | `"Tiềm năng"` | `"Thân thiết"` | `"Rời bỏ"` | `"VIP"`

### Lead Action Types
`"green"` | `"orange"` | `"blue"` | `""`

### Task Time Types
`"soon"` | `"late"` | `"future"`

### Event Groups
`"user_moi"` | `"biz_moi"` | `"can_nang_cap"` | `"sap_het_han"` | `"chuyen_khoan"`

### Timeline Entry Types
`"phone"` | `"email"` | `"event"` | `"note"`

### User Roles
`"OWNER"` | `"ADMIN"` | `"MANAGER"` | `"STAFF"`

### Assignment Roles (for customers)
`"sale"` | `"marketing"` | `"tuvan"` | `"kythuat"` | `"cskh"`

### Action Types
`"call"` | `"email"` | `"meeting"` | `"sms"` | `"send_block_automation"` | `"review"` | `"manual_order"` | `"other"`

### Action Categories
`"primary"` | `"secondary"`

### Result Types
`"success"` | `"failure"` | `"neutral"` | `"incomplete"` | `"skip"`

### Chain Delays (initial delay)
`"immediate"` | `"1h"` | `"4h"` | `"1d"` | `"3d"` | `"7d"`

### Branch Next Step Types
`"next_in_chain"` | `"close_task"` | `"close_chain"` | `"close_chain_clone_task"` | `"create_order"` | `"call_block_automation"` | `"add_from_other_chain"`

### Branch Close Outcomes
`"success"` | `"failure"`

### Branch Delay Units
`"immediate"` | `"hour"` | `"day"` | `"week"`

---

## 15. Error Codes

| HTTP | Code                    | Description                                 |
|------|-------------------------|---------------------------------------------|
| 400  | `VALIDATION_ERROR`      | Request validation failed                   |
| 400  | `INVALID_JSON_PAYLOAD`  | Malformed JSON body                         |
| 400  | `INVALID_RESET_TOKEN`   | Reset token invalid or expired              |
| 401  | `UNAUTHORIZED`          | Missing or invalid access token             |
| 401  | `INVALID_CREDENTIALS`   | Wrong email or password                     |
| 401  | `INVALID_SESSION`       | Session not found                           |
| 401  | `INVALID_REFRESH_TOKEN` | Refresh token invalid or expired            |
| 401  | `INVALID_CURRENT_PASSWORD` | Current password mismatch               |
| 403  | `FORBIDDEN`             | Insufficient permissions                    |
| 403  | `CORS_ORIGIN_FORBIDDEN` | Request origin not allowed                  |
| 404  | `ROUTE_NOT_FOUND`       | Endpoint does not exist                     |
| 404  | `USER_NOT_FOUND`        | User not found                              |
| 404  | `CUSTOMER_NOT_FOUND`    | Customer not found                          |
| 404  | `LEAD_NOT_FOUND`        | Lead not found                              |
| 404  | `TASK_NOT_FOUND`        | Task not found                              |
| 404  | `EVENT_NOT_FOUND`       | Event not found                             |
| 404  | `ROLE_NOT_FOUND`        | Role not found                              |
| 404  | `PERMISSION_NOT_FOUND`  | Permission not found                        |
| 404  | `DEPARTMENT_NOT_FOUND`  | Department not found                        |
| 409  | `DUPLICATE_VALUE`       | Unique field constraint violation           |
| 409  | `DEPARTMENT_ALREADY_EXISTS` | Department alias/name already exists   |
| 409  | `GROUP_ALREADY_EXISTS`  | Group alias/name already exists             |
| 409  | `ROLE_ALREADY_EXISTS`   | Role ID already exists                      |
| 500  | `INTERNAL_SERVER_ERROR` | Unexpected server error                     |
