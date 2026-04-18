# CRM Server — API Reference v1

> **Base URL:** `http://localhost:3001/api/v1`  
> **Latest version:** `v1`  
> **Last updated:** 2026-04-18

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Rate Limiting](#rate-limiting)
4. [Response Format](#response-format)
5. [Error Codes](#error-codes)
6. [Resources](#resources)
   - [Auth](#auth)
   - [Customers](#customers)
   - [Users](#users)
   - [Leads](#leads)
   - [Tasks](#tasks)
   - [Events](#events)
   - [Event Action Chains](#event-action-chains)
   - [Event Chains Queue (Task Queue)](#event-chains-queue)
   - [Action Config — Results](#action-config--results)
   - [Action Config — Reasons](#action-config--reasons)
   - [Action Config — Actions](#action-config--actions)
   - [Action Config — Chains](#action-config--chains)
   - [Organization](#organization)
   - [Metadata](#metadata)
   - [Functions](#functions)
   - [RBAC — Permissions](#rbac--permissions)
   - [RBAC — Roles](#rbac--roles)

---

## Overview

The CRM API follows REST conventions. All endpoints return JSON. Protected endpoints require a **Bearer token** in the `Authorization` header.

```
GET /health          → Server health check (public)
GET /api             → API version discovery (public)
GET /api/v1          → v1 resource index (public)
```

---

## Authentication

### Session-based with JWT + HTTP-only Cookie

| Element | Description |
|---|---|
| **Access Token** | Short-lived JWT. Sent in `Authorization: Bearer <token>` header. |
| **Refresh Token** | Long-lived. Stored in `crm_refresh_token` HTTP-only cookie. |
| **Session ID** | UUID stored in `crm_session_id` HTTP-only cookie. |

To authenticate protected requests:
```
Authorization: Bearer <accessToken>
```

> **Note:** `/register` is **not** a self-service endpoint. Only OWNER/ADMIN can create user accounts via `POST /auth/register` (requires `USERS_CREATE` permission).

---

## Rate Limiting

| Scope | Window | Max Requests | Applied To |
|---|---|---|---|
| Auth routes | 60 s | **50** req/IP | `/api/v1/auth/*` |
| General API | 60 s | **500** req/IP | `/api/v1/*` |

Exceeded limit response:
```json
{ "success": false, "message": "Too many requests from this IP, please try again after 15 seconds.", "code": "TOO_MANY_REQUESTS" }
```

---

## Response Format

### Success
```json
{
  "success": true,
  "message": "Human-readable message",
  "data": { ... }
}
```

### Paginated Success
```json
{
  "success": true,
  "message": "...",
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "totalItems": 100,
      "totalPages": 5,
      "hasNextPage": true,
      "hasPreviousPage": false
    }
  }
}
```

### Error
```json
{
  "success": false,
  "message": "Human-readable error",
  "code": "ERROR_CODE",
  "details": { ... }
}
```

---

## Error Codes

| Code | HTTP | Description |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Request body/query failed Joi validation |
| `INVALID_JSON_PAYLOAD` | 400 | Malformed JSON body |
| `INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `INVALID_SESSION` | 401 | Session not found or expired |
| `INVALID_REFRESH_TOKEN` | 401 | Refresh token invalid or expired |
| `INVALID_RESET_TOKEN` | 400 | Password reset token invalid or expired |
| `INVALID_CURRENT_PASSWORD` | 401 | Wrong current password on change-password |
| `UNAUTHORIZED` | 401 | Missing or invalid access token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `CORS_ORIGIN_FORBIDDEN` | 403 | Request origin not allowed |
| `TOO_MANY_REQUESTS` | 429 | Rate limit exceeded |
| `NOT_FOUND` | 404 | Resource not found |
| `ROUTE_NOT_FOUND` | 404 | No matching route |
| `DUPLICATE_VALUE` | 409 | Unique constraint violation |
| `ROLE_ALREADY_EXISTS` | 409 | Role ID collision |
| `DEPARTMENT_ALREADY_EXISTS` | 409 | Duplicate department |
| `GROUP_ALREADY_EXISTS` | 409 | Duplicate group within department |
| `INTERNAL_ERROR` | 500 | Unhandled server error |

---

## Resources

---

## Auth

> **Base path:** `/api/v1/auth`
> **Rate limit:** 50 req / 60 s per IP

### `POST /auth/login`
Authenticate with email + password. Returns access token + sets refresh cookies.

**Auth required:** No

**Body:**
```json
{
  "email": "admin@example.com",
  "password": "MySecret123"
}
```

**Response 200:**
```json
{
  "success": true,
  "message": "Login success",
  "data": {
    "user": { "id": "USER001", "email": "...", "name": "...", "roleId": "OWNER" },
    "accessToken": "<jwt>",
    "expiresAt": "2026-04-18T18:00:00.000Z"
  }
}
```

**Errors:** `400 VALIDATION_ERROR`, `401 INVALID_CREDENTIALS`

---

### `POST /auth/refresh`
Rotate access + refresh tokens using the session cookie pair.

**Auth required:** No (uses cookies `crm_session_id` + `crm_refresh_token`)

**Body:** _(empty)_

**Response 200:** Same shape as `/login`

**Errors:** `400 VALIDATION_ERROR`, `401 INVALID_SESSION`, `401 INVALID_REFRESH_TOKEN`

---

### `POST /auth/forgot-password`
Request a password reset token.

**Auth required:** No

**Body:**
```json
{ "email": "user@example.com" }
```

**Response 200:**
```json
{
  "data": {
    "email": "user@example.com",
    "resetToken": "<raw-token>",
    "resetTokenExpiresAt": "2026-04-18T19:00:00.000Z"
  }
}
```

> Always returns 200 even for non-existent emails (prevents email enumeration).

---

### `POST /auth/reset-password`
Reset password using the token from forgot-password flow.

**Auth required:** No

**Body:**
```json
{
  "email": "user@example.com",
  "resetToken": "<raw-token>",
  "newPassword": "NewPassword123"
}
```

**Errors:** `400 INVALID_RESET_TOKEN`, `400 VALIDATION_ERROR` (same as current password)

---

### `POST /auth/logout`
Invalidate the current session. Clears cookies.

**Auth required:** Optional (works with either access token or cookie session)

---

### `GET /auth/me`
Get the current authenticated user profile.

**Auth required:** Yes

---

### `PUT /auth/me`
Update own profile.

**Auth required:** Yes

**Body (all optional):**
```json
{
  "name": "New Name",
  "phone": "0901234567",
  "department": "Sales",
  "group": "Team A",
  "avatar": "https://..."
}
```

---

### `POST /auth/change-password`
Change own password. Invalidates all sessions.

**Auth required:** Yes

**Body:**
```json
{
  "currentPassword": "OldPassword123",
  "newPassword": "NewPassword456"
}
```

**Errors:** `401 INVALID_CURRENT_PASSWORD`, `400 VALIDATION_ERROR`

---

### `POST /auth/register`
Create a new staff account. **Not self-service.** Caller must have `USERS_CREATE` permission.

**Auth required:** Yes — `USERS_CREATE`

**Body:**
```json
{
  "name": "Nguyen Van A",
  "email": "nva@company.com",
  "password": "TempPass123",
  "roleId": "STAFF",
  "department": "Sales",
  "group": "Team B",
  "phone": "0901234567"
}
```

**Response:** `201`

---

## Customers

> **Base path:** `/api/v1/customers`

### `GET /customers`
**Permission:** `CUSTOMERS_READ`

**Query:** `search`, `group`, `type`, `assignee`, `page`, `limit`

---

### `GET /customers/meta/assignment-roles`
**Permission:** `CUSTOMERS_READ`

---

### `GET /customers/:id`
**Permission:** `CUSTOMERS_READ`

---

### `POST /customers`
**Permission:** `CUSTOMERS_CREATE`

**Body:**
```json
{
  "name": "Tran Thi B",
  "email": "ttb@email.com",
  "phone": "0912345678",
  "group": "Khách hàng mới",
  "type": "Individual",
  "address": "123 Le Loi, HCM"
}
```

---

### `PUT /customers/:id`
**Permission:** `CUSTOMERS_UPDATE` — Body same as POST, all fields optional.

---

### `DELETE /customers/:id`
**Permission:** `CUSTOMERS_DELETE` OR `CUSTOMERS_READ`

---

### `POST /customers/:id/assignees`
**Permission:** `CUSTOMERS_UPDATE` OR `CUSTOMERS_READ`

**Body:** `{ "userId": "USER002", "role": "primary" }`

---

### `DELETE /customers/:id/assignees/:userId`
**Permission:** `CUSTOMERS_UPDATE` OR `CUSTOMERS_READ`

---

## Users

> **Base path:** `/api/v1/users`

### `GET /users/org-options`
Get distinct departments and groups for dropdowns. Auth only (no special permission).

**Response:** `{ "departments": [...], "groups": [...] }`

---

### `GET /users`
**Permission:** `USERS_READ`

**Query:** `search`, `department`, `group`, `roleId`, `page`, `limit`

---

### `POST /users`
**Permission:** `USERS_CREATE`

**Body:**
```json
{
  "name": "Le Van C",
  "email": "lvc@company.com",
  "password": "TempPass123",
  "roleId": "STAFF",
  "department": "Support",
  "group": "Team A"
}
```

---

### `PUT /users/:id`
**Permission:** `USERS_UPDATE`

**Body (optional fields):** `name`, `email`, `roleId`, `department`, `group`, `phone`, `avatar`, `managerId`

---

### `DELETE /users/:id`
**Permission:** `USERS_DELETE`

---

## Leads

> **Base path:** `/api/v1/leads`

### `GET /leads`
**Permission:** `LEADS_READ` — Query: `search`, `status`, `assignee`, `page`, `limit`

### `POST /leads`
**Permission:** `LEADS_CREATE`

**Body:**
```json
{
  "name": "Prospect Corp",
  "tags": ["B2B", "Hot"],
  "status": "Biz tạo mới",
  "email": "info@prospect.com",
  "phone": "0900000000",
  "source": "Facebook",
  "address": "HCM",
  "assignee": { "name": "Staff A", "avatar": "" }
}
```

### `PUT /leads/:id`
**Permission:** `LEADS_UPDATE` — Same fields as POST, all optional.

### `PATCH /leads/:id/status`
**Permission:** `LEADS_UPDATE` — Body: `{ "status": "Đang tiếp cận" }`

### `DELETE /leads/:id`
**Permission:** `LEADS_DELETE`

---

## Tasks

> **Base path:** `/api/v1/tasks`

### `GET /tasks`
**Permission:** `TASKS_READ` — Query: `search`, `platform`, `assignee`, `status`, `page`, `limit`

### `POST /tasks`
**Permission:** `TASKS_CREATE`

**Body:**
```json
{
  "action": "Gọi điện tư vấn",
  "time": "09:00 20/04",
  "timeType": "future",
  "customer": { "name": "KH A", "email": "kha@mail.com", "phone": "0901234567" },
  "platform": "SmaxAi",
  "assignee": { "name": "Staff B", "avatar": "" },
  "status": "Đang thực hiện"
}
```

### `PUT /tasks/:id`
**Permission:** `TASKS_UPDATE`

### `DELETE /tasks/:id`
**Permission:** `TASKS_DELETE`

---

## Events

> **Base path:** `/api/v1/events`

### `GET /events`
**Permission:** `EVENTS_READ`

**Query params:**

| Param | Type | Description |
|---|---|---|
| `search` | string | Search by name, customer name |
| `group` | string | `user_moi` / `biz_moi` / `can_nang_cap` / `sap_het_han` / `chuyen_khoan` |
| `stage` | string | Sales stage |
| `assignee` | string | Assignee user ID |
| `page` | number | Default: 1 |
| `limit` | number | Default: 20 |

### `GET /events/stats`
**Permission:** `EVENTS_READ`

**Response:**
```json
{ "data": { "all": 150, "user_moi": 30, "biz_moi": 45, "can_nang_cap": 20, "sap_het_han": 15, "chuyen_khoan": 40 } }
```

### `GET /events/:id`
**Permission:** `EVENTS_READ`

### `POST /events`
**Permission:** `EVENTS_CREATE`

**Body:**
```json
{
  "name": "Tư vấn nâng cấp gói Pro",
  "group": "can_nang_cap",
  "stage": "Tiếp cận",
  "customer": { "name": "KH A", "email": "...", "phone": "..." },
  "assigneeId": "USER002",
  "plan": "2026-05-01"
}
```

### `PUT /events/:id`
**Permission:** `EVENTS_UPDATE`

### `POST /events/:id/timeline`
**Permission:** `EVENTS_UPDATE`

**Body:**
```json
{
  "type": "call",
  "title": "Gọi lần 1",
  "time": "2026-04-18T10:00:00Z",
  "content": "Không bắt máy",
  "duration": "5p"
}
```

### `DELETE /events/:id`
**Permission:** `EVENTS_DELETE`

### `POST /events/:id/sync-customer`
**Permission:** `EVENTS_UPDATE` — Sync customer data snapshot into the event.

### `POST /events/:id/self-assign`
**Permission:** `EVENTS_UPDATE` — Assign current user to an unassigned event.

### `DELETE /events/:id/assignee`
**Permission:** `EVENTS_UPDATE` — Remove assigned staff.

---

## Event Action Chains

> **Base path:** `/api/v1/events/:eventId/chains`

### `GET /events/:eventId/chains`
**Permission:** `EVENT_CHAINS_READ` — Get all chains for an event.

### `POST /events/:eventId/chains`
**Permission:** `EVENT_CHAINS_CREATE` — Attach a chain template to an event.

**Body:** `{ "chainId": "CHAIN001" }`

**Errors:** `404` not found, `422` chain inactive, `409` already added

---

### `POST /events/:eventId/chains/:chainId/steps`
Inject new step after current step.

**Permission:** `EVENT_CHAINS_UPDATE`

**Body:**
```json
{
  "actionId": "ACT003",
  "delayUnit": "hour",
  "delayValue": 2,
  "insertAfterOrder": 1
}
```

**Errors:** `409` action already in chain

---

### `PUT /events/:eventId/chains/:chainId/steps/current`
Save result of current step. Activates next step based on branch logic.

**Permission:** `EVENT_CHAINS_UPDATE`

**Body:**
```json
{
  "selectedResultId": "RES001",
  "selectedReasonId": "RSN002",
  "note": "KH hẹn gọi lại",
  "nextStepDelay": {
    "delayUnit": "hour",
    "delayValue": 3,
    "editNote": "Delay reason"
  },
  "nextStepOverride": {
    "targetStepOrder": 3,
    "delayUnit": "hour",
    "delayValue": 1
  }
}
```

> `nextStepOverride` takes priority over branch logic when confirmed.

**Errors:** `400` step locked, `400` missing selectedResultId when branches configured

---

### `PATCH /events/:eventId/chains/:chainId/steps/current/delay`
Update scheduled delay of active step. `scheduledAt` recalculated from **now**.

**Permission:** `EVENT_CHAINS_UPDATE`

**Body:**
```json
{ "delayUnit": "hour", "delayValue": 4, "editNote": "KH bận" }
```

---

### `PATCH /events/:eventId/chains/:chainId/steps/:stepOrder/note`
Update note on any step (including locked).

**Permission:** `EVENT_CHAINS_UPDATE`

**Body:** `{ "note": "Updated note" }`

---

### `PUT /events/:eventId/chains/:chainId/steps/:stepOrder/branches`
Add or update a branch rule on a step.

**Permission:** `EVENT_CHAINS_UPDATE`

**Body:**
```json
{
  "resultId": "RES001",
  "nextStepType": "next_in_chain",
  "nextActionId": "ACT002",
  "closeOutcome": null,
  "delayUnit": "hour",
  "delayValue": 3
}
```

**`nextStepType` values:**

| Value | Description | Required extra field |
|---|---|---|
| `next_in_chain` | Go to specific action in chain | `nextActionId` (**required**) |
| `close_task` | Close task | `closeOutcome`: `success` \| `failure` |
| `close_chain` | Close the chain | — |
| `create_order` | Trigger order flow | — |
| `call_block_automation` | Trigger block automation | — |
| `close_chain_clone_task` | Close chain + clone task | — |
| `add_from_other_chain` | Add from another chain | — |

> **Validation rule:** `nextStepType: next_in_chain` REQUIRES `nextActionId`. Enforced on both frontend and backend (HTTP 422 if missing).

**Errors:** `422` next_in_chain without nextActionId, `400` step locked

---

### `DELETE /events/:eventId/chains/:chainId/steps/:stepOrder/branches/:resultId`
Remove a branch from a step.

**Permission:** `EVENT_CHAINS_UPDATE`

**Errors:** `404` branch not found, `400` step locked

---

### `PUT /events/:eventId/chains/:chainId/close`
Close the entire chain.

**Permission:** `EVENT_CHAINS_CLOSE`

---

### `DELETE /events/:eventId/chains/:chainId`
Delete a chain. Cannot delete closed chains in production.

**Permission:** `EVENT_CHAINS_DELETE`

---

## Event Chains Queue

> **`GET /api/v1/event-chains/queue`**
> Cross-event task queue with RBAC filtering.

**Permission:** `EVENT_CHAINS_READ`

**Query params:**

| Param | Type | Description |
|---|---|---|
| `eventId` | string | Filter by specific event |
| `overdueOnly` | `"true"` | Only overdue steps |
| `limit` | number | Max results (default: 200) |
| `department` | string | Comma-separated department names |
| `group` | string | Comma-separated group names |
| `eventGroup` | string | Comma-separated event group IDs |
| `search` | string | Search customer/staff/event name |

**RBAC:**
- `OWNER`/`ADMIN` → all events
- `MANAGER` → own + subordinates' events
- `STAFF` → own events only

**Response:**
```json
{
  "data": {
    "items": [{
      "chainId": "EAC-EVT001-CHAIN001-...",
      "chainName": "Chuỗi Gọi Điện Mới",
      "eventId": "EVT001",
      "event": { "id": "EVT001", "name": "...", "customer": {...}, "assignee": {...} },
      "step": {
        "order": 1, "actionId": "ACT001", "actionName": "Gọi điện lần 1",
        "actionType": "call", "actionCategory": "primary",
        "scheduledAt": "2026-04-18T16:00:00.000Z",
        "activatedAt": "2026-04-18T13:00:00.000Z",
        "delayUnit": "hour", "delayValue": 3, "isOverdue": false
      }
    }],
    "total": 1
  }
}
```

---

## Action Config — Results

> **Base path:** `/api/v1/action-config/results`

| Method | Endpoint | Permission |
|---|---|---|
| `GET` | `/results` | `ACTIONS_CFG_READ` |
| `POST` | `/results` | `ACTIONS_CFG_CREATE` |
| `PUT` | `/results/:id` | `ACTIONS_CFG_UPDATE` |
| `DELETE` | `/results/:id` | `ACTIONS_CFG_DELETE` |

**Body:** `{ "name": "Không bắt máy", "type": "incomplete", "description": "..." }`

**`type`:** `success` | `failure` | `neutral` | `incomplete` | `skip`

---

## Action Config — Reasons

> **Base path:** `/api/v1/action-config/reasons`

| Method | Endpoint | Permission |
|---|---|---|
| `GET` | `/reasons` | `ACTIONS_CFG_READ` |
| `POST` | `/reasons` | `ACTIONS_CFG_CREATE` |
| `PUT` | `/reasons/:id` | `ACTIONS_CFG_UPDATE` |
| `DELETE` | `/reasons/:id` | `ACTIONS_CFG_DELETE` |

**Body:** `{ "name": "Bận họp", "description": "..." }`

---

## Action Config — Actions

> **Base path:** `/api/v1/action-config/actions`

| Method | Endpoint | Permission |
|---|---|---|
| `GET` | `/actions` | `ACTIONS_CFG_READ` |
| `POST` | `/actions` | `ACTIONS_CFG_CREATE` |
| `PUT` | `/actions/:id` | `ACTIONS_CFG_UPDATE` |
| `DELETE` | `/actions/:id` | `ACTIONS_CFG_DELETE` |

**Body:**
```json
{
  "name": "Gọi điện lần 1",
  "type": "call",
  "category": "primary",
  "reasonIds": ["RSN001", "RSN002"],
  "description": "Cuộc gọi tiếp cận đầu tiên"
}
```

**`type`:** `call` | `send_block_automation` | `other` | `review` | `manual_order` | `create_booking`
**`category`:** `primary` | `secondary`

---

## Action Config — Chains

> **Base path:** `/api/v1/action-config/chains`

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| `GET` | `/chains` | `ACTIONS_CFG_READ` | List all chains |
| `GET` | `/chains/:id` | `ACTIONS_CFG_READ` | Get chain detail |
| `POST` | `/chains` | `ACTIONS_CFG_CREATE` | Create chain |
| `PUT` | `/chains/:id` | `ACTIONS_CFG_UPDATE` | Update chain metadata |
| `DELETE` | `/chains/:id` | `ACTIONS_CFG_DELETE` | Delete chain |
| `PUT` | `/chains/:id/rule` | `ACTIONS_CFG_UPDATE` | Save full step+branch config |

**Create body:**
```json
{
  "name": "Chuỗi Gọi Điện Mới",
  "description": "3 lần gọi KH mới",
  "delayUnit": "hour",
  "delayValue": 3,
  "active": true
}
```

**Rule body (`PUT /chains/:id/rule`):**
```json
{
  "active": true,
  "steps": [
    {
      "order": 1,
      "actionId": "ACT001",
      "branches": [
        {
          "resultId": "RES001",
          "nextStepType": "next_in_chain",
          "nextActionId": "ACT002",
          "delayUnit": "hour",
          "delayValue": 3
        },
        {
          "resultId": "RES002",
          "nextStepType": "close_task",
          "closeOutcome": "success"
        }
      ]
    },
    { "order": 2, "actionId": "ACT002", "branches": [] }
  ]
}
```

> **Rule:** `next_in_chain` requires `nextActionId` — enforced by Joi schema AND runtime check.

**`delayUnit`:** `immediate` | `minute` | `hour` | `day` | `week`

---

## Organization

> **Base path:** `/api/v1/organization`

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| `GET` | `/organization` | `ORGANIZATION_READ` | List departments + groups |
| `POST` | `/organization/departments` | `ORGANIZATION_UPDATE` | Create department |
| `POST` | `/organization/groups` | `ORGANIZATION_UPDATE` | Create group in department |

**Department body:** `{ "name": "Phòng Kinh Doanh", "alias": "sales" }`

**Group body:**
```json
{ "name": "Team A", "desc": "Nhóm A", "parentId": "1", "parentAlias": "sales" }
```

---

## Metadata

> **Base path:** `/api/v1/metadata`
> **Permission:** `METADATA_READ` — all endpoints

| Endpoint | Description |
|---|---|
| `GET /metadata` | Full metadata bundle |
| `GET /metadata/roles` | All system roles |
| `GET /metadata/departments` | Department names |
| `GET /metadata/department-groups` | Departments with nested groups |
| `GET /metadata/activity-groups` | Flat group list |
| `GET /metadata/customer-groups` | Customer group labels |

---

## Functions

> **Base path:** `/api/v1/functions`

| Method | Endpoint | Permission |
|---|---|---|
| `GET` | `/functions` | `FUNCTIONS_READ` |
| `POST` | `/functions` | `FUNCTIONS_CREATE` |

**Body:** `{ "title": "Backend Developer", "desc": "...", "type": "tech" }`

---

## RBAC — Permissions

> **Base path:** `/api/v1/rbac`

| Method | Endpoint | Permission |
|---|---|---|
| `GET` | `/rbac` | `PERMISSIONS_READ` |
| `GET` | `/rbac/:id` | `PERMISSIONS_READ` |

---

## RBAC — Roles

> **Base path:** `/api/v1/rbac/roles`

| Method | Endpoint | Permission | Notes |
|---|---|---|---|
| `GET` | `/rbac/roles` | `ROLES_READ` | List all roles |
| `GET` | `/rbac/roles/:id` | `ROLES_READ` | With permissions detail |
| `POST` | `/rbac/roles` | `ROLES_MANAGE` | Create role |
| `PUT` | `/rbac/roles/:id` | `ROLES_MANAGE` | Cannot modify system roles |
| `DELETE` | `/rbac/roles/:id` | `ROLES_MANAGE` | Cannot delete system roles |

**Create body:**
```json
{
  "id": "TEAM_LEAD",
  "name": "Team Lead",
  "description": "Manages a small team",
  "permissions": ["CUSTOMERS_READ", "EVENTS_READ"],
  "level": 2
}
```

---

## Utility Endpoints

| Endpoint | Auth | Description |
|---|---|---|
| `GET /health` | No | Server health check |
| `GET /api` | No | API version discovery |
| `GET /api/v1` | No | v1 resource index |

---

*Generated 2026-04-18. Source of truth: `/src/routes/v1/`*
