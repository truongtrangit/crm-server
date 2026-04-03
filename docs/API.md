# CRM Server API Documentation

Tài liệu này mô tả contract API hiện tại để team FE tích hợp web/mobile.

## 1. Tổng quan

- Base URL local: `http://localhost:4000/api`
- Format body: `application/json`
- Auth chính: Bearer access token
- Các API get list hỗ trợ phân trang bằng `page` và `limit`
- Auth refresh cho web và mobile:
  - Web: dùng cookie httpOnly tự set từ server
  - Mobile: dùng `sessionId` + `refreshToken` trong body hoặc header
- Hầu hết business API yêu cầu đăng nhập

## 1.1. Pagination convention

Query params chung cho list API:

- `page`: số trang, bắt đầu từ `1`, mặc định `1`
- `limit`: số phần tử mỗi trang, mặc định `10`, tối đa `100`

Nếu `page` hoặc `limit` không phải số nguyên dương, API trả về:

```json
{
  "statusCode": 400,
  "code": "INVALID_PAGINATION",
  "message": "page and limit must be positive integers"
}
```

Response chuẩn của list API:

```json
{
  "statusCode": 200,
  "message": "Get list success",
  "data": {
    "items": [],
    "pagination": {
      "page": 1,
      "limit": 10,
      "totalItems": 0,
      "totalPages": 0,
      "hasNextPage": false,
      "hasPreviousPage": false
    }
  }
}
```

## 1.2. Success response convention

Tất cả success response hiện được chuẩn hóa theo format:

```json
{
  "statusCode": 200,
  "message": "Get customer detail success",
  "data": {}
}
```

Ghi chú khi đọc tài liệu bên dưới:

- Nếu tài liệu ghi `Response 200: Customer` thì payload thực tế là:
  - `statusCode: 200`
  - `message: ...success`
  - `data: Customer`
- Nếu tài liệu ghi `Response 200: Customer[]` hoặc list response thì danh sách nằm trong `data`
- Các API delete/logout không còn trả `204`, mà trả `200` với `data: null`

## 2. Authentication

### 2.1. Access token

Gửi header:

- `Authorization: Bearer <accessToken>`

Nếu thiếu token:

- `401 { "message": "Authentication required" }`

Nếu token sai/hết hạn:

- `401 { "message": "Invalid or expired access token" }`
- hoặc `401 { "message": "Access token has expired" }`

### 2.2. Refresh token

Server hỗ trợ 3 cách truyền refresh token:

1. Cookie cho web
2. Body JSON:
   - `sessionId`
   - `refreshToken`
3. Header:
   - `x-session-id`
   - `x-refresh-token`

## 3. Role & phân quyền

Các role hiện tại:

- `OWNER`
- `ADMIN`
- `MANAGER`
- `STAFF`

Label hiển thị từ API metadata:

- `Owner`
- `Admin`
- `Manager (Trưởng phòng)`
- `Staff (Nhân viên)`

### 3.1. Quyền staff API

| Role    | GET /staff               | POST /staff                 | PUT /staff/:id             | DELETE /staff/:id          | POST /auth/register         |
| ------- | ------------------------ | --------------------------- | -------------------------- | -------------------------- | --------------------------- |
| OWNER   | Yes                      | Yes                         | Yes                        | Yes                        | Yes                         |
| ADMIN   | Yes                      | Yes                         | Yes                        | Yes                        | Yes                         |
| MANAGER | Chỉ nhân viên dưới quyền | Chỉ tạo `STAFF` trong scope | Chỉ sửa `STAFF` dưới quyền | Chỉ xóa `STAFF` dưới quyền | Chỉ tạo `STAFF` trong scope |
| STAFF   | No                       | No                          | No                         | No                         | No                          |

### 3.2. Rule chi tiết

- `OWNER`: toàn quyền, trừ user role `OWNER` khác không thể bị quản lý/xóa qua logic hiện tại.
- `ADMIN`: quản lý được `MANAGER` và `STAFF`.
- `MANAGER`: chỉ quản lý `STAFF` có `managerId` là chính mình.
- `STAFF`: bị chặn với staff API, trả `403 { "message": "Forbidden" }`.

## 4. Common error responses

## 4.1. HTTP status code conventions

Các mã response phổ biến đang dùng trong API này:

| Status | Ý nghĩa               | Khi nào dùng                                                                   |
| ------ | --------------------- | ------------------------------------------------------------------------------ |
| `200`  | OK                    | Lấy dữ liệu thành công, update thành công, login/refresh/logout/xóa thành công |
| `201`  | Created               | Tạo mới thành công                                                             |
| `400`  | Bad Request           | Thiếu field bắt buộc, sai format payload, validation fail                      |
| `401`  | Unauthorized          | Chưa đăng nhập, token sai, token hết hạn                                       |
| `403`  | Forbidden             | Đã đăng nhập nhưng không đủ quyền                                              |
| `404`  | Not Found             | Không tìm thấy resource theo `id` hoặc route không tồn tại                     |
| `409`  | Conflict              | Dữ liệu bị trùng, thường là unique field như `email`, `id`                     |
| `500`  | Internal Server Error | Lỗi ngoài ý muốn ở server                                                      |

## 4.2. Error body format

Từ bản API hiện tại, các response lỗi có format chuẩn:

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "name is required"
}
```

Có thể có thêm `details` khi cần, ví dụ lỗi duplicate:

```json
{
  "statusCode": 409,
  "code": "DUPLICATE_VALUE",
  "message": "Duplicate value detected",
  "details": {
    "email": "admin@crm.vn"
  }
}
```

### 400 Bad Request

Ví dụ:

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "name is required"
}
```

### 401 Unauthorized

```json
{
  "statusCode": 401,
  "code": "AUTHENTICATION_REQUIRED",
  "message": "Authentication required"
}
```

### 403 Forbidden

```json
{
  "statusCode": 403,
  "code": "FORBIDDEN",
  "message": "Forbidden"
}
```

Hoặc message theo business rule, ví dụ:

```json
{
  "statusCode": 403,
  "code": "FORBIDDEN",
  "message": "You do not have permission to assign this role"
}
```

### 404 Not Found

```json
{
  "statusCode": 404,
  "code": "CUSTOMER_NOT_FOUND",
  "message": "Customer not found"
}
```

### 409 Conflict

```json
{
  "statusCode": 409,
  "code": "DUPLICATE_VALUE",
  "message": "Duplicate value detected",
  "details": {
    "email": "admin@crm.vn"
  }
}
```

### 500 Internal Server Error

```json
{
  "statusCode": 500,
  "code": "INTERNAL_SERVER_ERROR",
  "message": "Internal server error"
}
```

---

## 5. Health & API info

### GET /health

Auth: No

Status codes:

- `200` health check thành công

Response 200:

```json
{
  "statusCode": 200,
  "message": "Health check success",
  "data": {
    "status": "ok",
    "service": "crm-server"
  }
}
```

### GET /

Thực tế là `GET /api`

Auth: No

Status codes:

- `200` lấy thông tin tổng quan API thành công

Response 200:

```json
{
  "statusCode": 200,
  "message": "CRM server API is running",
  "data": {
    "resources": [
      "customers",
      "staff",
      "auth",
      "leads",
      "tasks",
      "organization",
      "metadata",
      "functions"
    ]
  }
}
```

---

## 6. Auth API

Base path: `/auth`

### 6.1. POST /auth/login

Auth: No

Status codes:

- `200` login thành công
- `400` thiếu `email` hoặc `password`
- `401` sai tài khoản hoặc mật khẩu
- `500` lỗi server

Body:

```json
{
  "email": "owner@crm.vn",
  "password": "Owner@123"
}
```

Validation:

- `email` bắt buộc
- `password` bắt buộc

Response 200:

```json
{
  "statusCode": 200,
  "message": "Login success",
  "data": {
    "user": {
      "_id": "69ce7fcfbb315d25863910ae",
      "id": "USER001",
      "name": "Chủ hệ thống CRM",
      "email": "owner@crm.vn",
      "avatar": "https://i.pravatar.cc/100?img=33",
      "department": [],
      "group": [],
      "phone": "0901 000 001",
      "role": "OWNER",
      "managerId": null,
      "createdBy": null,
      "lastLoginAt": "2026-04-02T14:40:44.201Z",
      "createdAt": "2026-04-02T14:40:15.294Z",
      "updatedAt": "2026-04-02T14:40:44.201Z",
      "roleLabel": "Owner"
    },
    "sessionId": "f99352cf-4451-41a7-a7c4-3f377e042e6a",
    "accessToken": "...",
    "refreshToken": "...",
    "accessTokenExpiresAt": "2026-04-02T14:55:44.200Z",
    "refreshTokenExpiresAt": "2026-05-02T14:40:44.200Z"
  }
}
```

Error:

- `400 { "statusCode": 400, "code": "VALIDATION_ERROR", "message": "email and password are required" }`
- `401 { "statusCode": 401, "code": "INVALID_CREDENTIALS", "message": "Invalid email or password" }`

### 6.2. POST /auth/refresh

Auth: No bearer required

Status codes:

- `200` refresh token thành công
- `400` thiếu `sessionId` hoặc `refreshToken`
- `401` session/refresh token không hợp lệ hoặc đã hết hạn
- `500` lỗi server

Body option:

```json
{
  "sessionId": "f99352cf-4451-41a7-a7c4-3f377e042e6a",
  "refreshToken": "..."
}
```

Header option:

- `x-session-id: <sessionId>`
- `x-refresh-token: <refreshToken>`

Cookie option:

- `crm_session_id`
- `crm_refresh_token`

Response 200: giống `POST /auth/login`, nhưng `message` là `Refresh token success`

Error:

- `400 { "statusCode": 400, "code": "VALIDATION_ERROR", "message": "sessionId and refreshToken are required" }`
- `401 { "statusCode": 401, "code": "INVALID_SESSION", "message": "Invalid session" }`
- `401 { "statusCode": 401, "code": "INVALID_REFRESH_TOKEN", "message": "Refresh token is invalid or expired" }`

### 6.3. POST /auth/logout

Auth:

- Có thể logout bằng access token
- Hoặc bằng `sessionId` + `refreshToken`

Status codes:

- `200` logout thành công
- `500` lỗi server

Body option:

```json
{
  "sessionId": "...",
  "refreshToken": "..."
}
```

Response:

- `200` với body:

```json
{
  "statusCode": 200,
  "message": "Logout success",
  "data": null
}
```

### 6.4. GET /auth/me

Auth: Bearer token

Status codes:

- `200` lấy thông tin user hiện tại thành công
- `401` thiếu token hoặc token không hợp lệ/hết hạn
- `500` lỗi server

Response 200:

```json
{
  "statusCode": 200,
  "message": "Get current user success",
  "data": {
    "user": {
      "_id": "69ce7fcfbb315d25863910ae",
      "id": "USER001",
      "name": "Chủ hệ thống CRM",
      "email": "owner@crm.vn",
      "avatar": "https://i.pravatar.cc/100?img=33",
      "department": [],
      "group": [],
      "phone": "0901 000 001",
      "role": "OWNER",
      "managerId": null,
      "createdBy": null,
      "lastLoginAt": "2026-04-02T14:40:44.201Z",
      "createdAt": "2026-04-02T14:40:15.294Z",
      "updatedAt": "2026-04-02T14:40:44.201Z",
      "roleLabel": "Owner"
    }
  }
}
```

### 6.5. POST /auth/register

Ý nghĩa nghiệp vụ: tạo user/staff mới.

Auth: Bearer token

Status codes:

- `201` tạo user thành công
- `400` payload không hợp lệ
- `401` chưa đăng nhập
- `403` không đủ quyền tạo user hoặc assign role
- `409` trùng `email` hoặc `id`
- `500` lỗi server

Role:

- `OWNER`, `ADMIN`, `MANAGER`

Body:

```json
{
  "name": "Nhân viên mới",
  "email": "new.staff@crm.vn",
  "password": "Staff@123",
  "avatar": "https://...",
  "department": ["Phòng Sale"],
  "group": ["Nhóm Sale Hà Nội"],
  "phone": "0909 111 222",
  "role": "STAFF",
  "managerId": "USER003"
}
```

Field rules:

- `name`: bắt buộc
- `email`: bắt buộc
- `password`: bắt buộc, tối thiểu 8 ký tự
- `role`: optional, default `STAFF`
- `department`: bắt buộc nếu role là `MANAGER` hoặc `STAFF`
- `group`: optional array string
- `managerId`:
  - chỉ dùng cho `STAFF`
  - nếu actor là `MANAGER` thì server tự gán `managerId = actor.id`
- `avatar`: optional, nếu thiếu server tự generate

Permission rules:

- `OWNER` tạo được `ADMIN`, `MANAGER`, `STAFF`
- `ADMIN` tạo được `MANAGER`, `STAFF`
- `MANAGER` chỉ tạo được `STAFF` trong scope `department/group` của mình

Response 201:

```json
{
  "statusCode": 201,
  "message": "Register user success",
  "data": {
    "id": "USER006",
    "name": "Nhân viên mới",
    "email": "new.staff@crm.vn",
    "avatar": "https://i.pravatar.cc/150?u=new.staff%40crm.vn",
    "department": ["Phòng Sale"],
    "group": ["Nhóm Sale Hà Nội"],
    "phone": "",
    "role": "STAFF",
    "managerId": "USER003",
    "createdBy": "USER003",
    "lastLoginAt": null,
    "_id": "69ce8031bb315d25863910ce",
    "createdAt": "2026-04-02T14:41:53.925Z",
    "updatedAt": "2026-04-02T14:41:53.925Z",
    "roleLabel": "Staff (Nhân viên)"
  }
}
```

---

## 7. Staff API

Base path: `/staff`

Lưu ý:

- API tên là `staff` để FE dễ hiểu theo nghiệp vụ.
- Dữ liệu thực tế backend lưu ở model `User`.

### 7.1. User response shape

```json
{
  "_id": "69ce7fcfbb315d25863910b1",
  "id": "USER004",
  "name": "Vũ Thu Phương",
  "email": "staff1@crm.vn",
  "avatar": "https://i.pravatar.cc/100?img=25",
  "department": ["Phòng Sale"],
  "group": ["Nhóm Sale Hà Nội"],
  "phone": "0901 000 004",
  "role": "STAFF",
  "managerId": "USER003",
  "createdBy": null,
  "lastLoginAt": null,
  "createdAt": "2026-04-02T14:40:15.294Z",
  "updatedAt": "2026-04-02T14:40:15.294Z",
  "roleLabel": "Staff (Nhân viên)"
}
```

### 7.2. GET /staff

Auth: Bearer token

Status codes:

- `200` lấy danh sách staff thành công
- `400` query không hợp lệ, ví dụ `role` sai
- `401` chưa đăng nhập
- `403` không đủ quyền
- `500` lỗi server

Role:

- `OWNER`, `ADMIN`, `MANAGER`

Query params:

- `search`: search theo `name`, `email`, `phone`
- `department`: filter theo department
- `role`: filter theo role (`OWNER`, `ADMIN`, `MANAGER`, `STAFF`) hoặc alias tiếng Việt/Anh
- `managerId`: chỉ hiệu lực với `OWNER`/`ADMIN`
- `page`: số trang, mặc định `1`
- `limit`: số phần tử mỗi trang, mặc định `10`, tối đa `100`

Rule:

- `MANAGER` luôn chỉ nhìn thấy staff có `managerId = currentUser.id`

Response 200:

```json
{
  "statusCode": 200,
  "message": "Get staff list success",
  "data": {
    "items": [
      {
        "_id": "69ce7fcfbb315d25863910b1",
        "id": "USER004",
        "name": "Vũ Thu Phương",
        "email": "staff1@crm.vn",
        "avatar": "https://i.pravatar.cc/100?img=25",
        "department": ["Phòng Sale"],
        "group": ["Nhóm Sale Hà Nội"],
        "phone": "0901 000 004",
        "role": "STAFF",
        "managerId": "USER003",
        "createdBy": null,
        "lastLoginAt": null,
        "createdAt": "2026-04-02T14:40:15.294Z",
        "updatedAt": "2026-04-02T14:40:15.294Z",
        "roleLabel": "Staff (Nhân viên)"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "totalItems": 2,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPreviousPage": false
    }
  }
}
```

### 7.3. POST /staff

Tương đương `POST /auth/register`.

Auth: Bearer token

Role: `OWNER`, `ADMIN`, `MANAGER`

Status codes:

- `201` tạo staff thành công
- `400` payload không hợp lệ
- `401` chưa đăng nhập
- `403` không đủ quyền
- `409` trùng dữ liệu unique
- `500` lỗi server

Body: giống `POST /auth/register`

Response 201: `{ statusCode, message: "Create staff success", data: User }`

### 7.4. PUT /staff/:id

Auth: Bearer token

Status codes:

- `200` cập nhật staff thành công
- `400` payload không hợp lệ
- `401` chưa đăng nhập
- `403` không đủ quyền update
- `404` không tìm thấy user trong scope
- `409` trùng dữ liệu unique
- `500` lỗi server

Role: `OWNER`, `ADMIN`, `MANAGER`

Path params:

- `id`: `USERxxx` hoặc legacy migrated id nếu tồn tại

Body: partial update

```json
{
  "name": "Tên mới",
  "email": "updated@crm.vn",
  "password": "NewPass@123",
  "avatar": "https://...",
  "department": ["Phòng Sale"],
  "group": ["Nhóm Sale Hà Nội"],
  "phone": "0909 999 999",
  "role": "STAFF",
  "managerId": "USER003"
}
```

Rule:

- `password` nếu truyền phải >= 8 ký tự
- `ADMIN` không assign được `ADMIN`
- `OWNER` mới assign được `OWNER`
- `MANAGER` chỉ sửa được `STAFF` dưới quyền và role phải vẫn là `STAFF`

Response 200: `{ statusCode, message: "Update staff success", data: User }`

### 7.5. DELETE /staff/:id

Auth: Bearer token

Status codes:

- `200` xóa staff thành công
- `400` request không hợp lệ, ví dụ tự xóa chính mình
- `401` chưa đăng nhập
- `403` không đủ quyền xóa
- `404` không tìm thấy user trong scope
- `500` lỗi server

Role: `OWNER`, `ADMIN`, `MANAGER`

Path params:

- `id`: user id

Rule:

- Không được xóa chính mình
- `MANAGER` chỉ xóa `STAFF` dưới quyền
- `ADMIN` không xóa được `ADMIN` hay `OWNER`
- `OWNER` xóa được `ADMIN`

Response:

- `200` với body:

```json
{
  "statusCode": 200,
  "message": "Delete staff success",
  "data": null
}
```

---

## 8. Customer API

Base path: `/customers`

Auth: Bearer token

### 8.1. Customer response shape

```json
{
  "_id": "...",
  "id": "CUST001",
  "name": "Phạm Tường Vy",
  "avatar": "https://i.pravatar.cc/100?img=15",
  "type": "VIP Customer",
  "email": "vy.pham@example.com",
  "phone": "0912 345 678",
  "biz": ["Torano", "Biluxury"],
  "platforms": ["SmaxAi", "Botvn"],
  "group": "Nhóm Sale Hà Nội",
  "registeredAt": "10/10/2022",
  "lastLoginAt": "30/03/2026",
  "tags": ["#KHTiemNang"],
  "createdAt": "...",
  "updatedAt": "..."
}
```

### 8.2. GET /customers

Status codes:

- `200` lấy danh sách customer thành công
- `400` pagination không hợp lệ
- `401` chưa đăng nhập
- `500` lỗi server

Query params:

- `search`: search theo `name`, `email`, `phone`
- `type`: filter theo `type`, nếu `All` thì bỏ qua filter
- `group`: filter theo `group`
- `platform`: filter theo phần tử trong `platforms`
- `page`: số trang, mặc định `1`
- `limit`: số phần tử mỗi trang, mặc định `10`, tối đa `100`

Response 200:

```json
{
  "statusCode": 200,
  "message": "Get customer list success",
  "data": {
    "items": [
      {
        "_id": "...",
        "id": "CUST001",
        "name": "Phạm Tường Vy",
        "avatar": "https://i.pravatar.cc/100?img=15",
        "type": "VIP Customer",
        "email": "vy.pham@example.com",
        "phone": "0912 345 678",
        "biz": ["Torano", "Biluxury"],
        "platforms": ["SmaxAi", "Botvn"],
        "group": "Nhóm Sale Hà Nội",
        "registeredAt": "10/10/2022",
        "lastLoginAt": "30/03/2026",
        "tags": ["#KHTiemNang"],
        "createdAt": "...",
        "updatedAt": "..."
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "totalItems": 25,
      "totalPages": 3,
      "hasNextPage": true,
      "hasPreviousPage": false
    }
  }
}
```

### 8.3. GET /customers/:id

Status codes:

- `200` lấy customer thành công
- `401` chưa đăng nhập
- `404` không tìm thấy customer
- `500` lỗi server

Path params:

- `id`: customer id, ví dụ `CUST001`

Response 200: `{ statusCode, message: "Get customer detail success", data: Customer }`

Error:

- `404 { "statusCode": 404, "code": "CUSTOMER_NOT_FOUND", "message": "Customer not found" }`

### 8.4. POST /customers

Status codes:

- `201` tạo customer thành công
- `400` thiếu field bắt buộc
- `401` chưa đăng nhập
- `409` trùng dữ liệu unique
- `500` lỗi server

Body:

```json
{
  "name": "Khách hàng A",
  "avatar": "https://...",
  "type": "Standard Customer",
  "email": "customer@example.com",
  "phone": "0909 111 222",
  "biz": ["Biz A", "Biz B"],
  "platforms": ["SmaxAi"],
  "group": "Nhóm Sale Hà Nội",
  "registeredAt": "02/04/2026",
  "lastLoginAt": "02/04/2026",
  "tags": ["#NewUser"]
}
```

Validation:

- `name` bắt buộc
- `email` bắt buộc

Default:

- `id`: auto `CUSTxxx`
- `avatar`: auto generate nếu thiếu
- `type`: `Standard Customer`
- `biz`: `[]`
- `platforms`: `[]`
- `group`: `""`
- `registeredAt`: ngày hiện tại format `vi-VN`
- `lastLoginAt`: ngày hiện tại format `vi-VN`
- `tags`: `[]`

Response 201: `{ statusCode, message: "Create customer success", data: Customer }`

### 8.5. PUT /customers/:id

Status codes:

- `200` cập nhật customer thành công
- `401` chưa đăng nhập
- `404` không tìm thấy customer
- `409` trùng dữ liệu unique
- `500` lỗi server

Body: partial update toàn bộ field customer

Response 200: `{ statusCode, message: "Update customer success", data: Customer }`

### 8.6. DELETE /customers/:id

Status codes:

- `200` xóa customer thành công
- `401` chưa đăng nhập
- `404` không tìm thấy customer
- `500` lỗi server

Response:

- `200` với body:

```json
{
  "statusCode": 200,
  "message": "Delete customer success",
  "data": null
}
```

---

## 9. Lead API

Base path: `/leads`

Auth: Bearer token

### 9.1. Lead response shape

```json
{
  "_id": "...",
  "id": "LEAD001",
  "name": "Nguyễn Văn Minh",
  "avatar": "https://i.pravatar.cc/100?img=1",
  "timeAgo": "10 phút trước",
  "tags": ["Trial", "Vitamin"],
  "assignee": {
    "name": "Lê Văn A",
    "avatar": "https://i.pravatar.cc/100?img=10"
  },
  "status": "Biz tạo mới",
  "actionNeeded": "Còn 2h",
  "actionType": "green",
  "email": "",
  "phone": "",
  "source": "",
  "address": "",
  "createdAt": "...",
  "updatedAt": "..."
}
```

### 9.2. GET /leads

Status codes:

- `200` lấy danh sách lead thành công
- `400` pagination không hợp lệ
- `401` chưa đăng nhập
- `500` lỗi server

Query params:

- `search`: search theo `name`, `id`, `tags`
- `status`: filter exact match
- `assignee`: filter theo `assignee.name`
- `page`: số trang, mặc định `1`
- `limit`: số phần tử mỗi trang, mặc định `10`, tối đa `100`

Response 200:

```json
{
  "statusCode": 200,
  "message": "Get lead list success",
  "data": {
    "items": [
      {
        "_id": "...",
        "id": "LEAD001",
        "name": "Nguyễn Văn Minh",
        "avatar": "https://i.pravatar.cc/100?img=1",
        "timeAgo": "10 phút trước",
        "tags": ["Trial", "Vitamin"],
        "assignee": {
          "name": "Lê Văn A",
          "avatar": "https://i.pravatar.cc/100?img=10"
        },
        "status": "Biz tạo mới",
        "actionNeeded": "",
        "actionType": "",
        "email": "",
        "phone": "",
        "source": "",
        "address": "",
        "createdAt": "...",
        "updatedAt": "..."
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "totalItems": 6,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPreviousPage": false
    }
  }
}
```

### 9.3. POST /leads

Status codes:

- `201` tạo lead thành công
- `400` thiếu `name`
- `401` chưa đăng nhập
- `409` trùng dữ liệu unique
- `500` lỗi server

Body:

```json
{
  "name": "Lead mới",
  "avatar": "https://...",
  "timeAgo": "Vừa xong",
  "tags": ["HOT"],
  "assignee": {
    "name": "Lê Văn A",
    "avatar": "https://..."
  },
  "status": "Biz tạo mới",
  "actionNeeded": "Còn 2h",
  "actionType": "green",
  "email": "lead@example.com",
  "phone": "0909 111 222",
  "source": "Facebook",
  "address": "Hà Nội"
}
```

Validation:

- `name` bắt buộc

Default:

- `id`: auto `LEADxxx`
- `avatar`: auto generate từ `name`
- `timeAgo`: `Vừa xong`
- `tags`: `[]`
- `assignee`: `{ name: "", avatar: "" }`
- `status`: `Biz tạo mới`
- `actionNeeded`: `""`
- `actionType`: `""`
- `email`, `phone`, `source`, `address`: `""`

Response 201: `{ statusCode, message: "Create lead success", data: Lead }`

### 9.4. PUT /leads/:id

Status codes:

- `200` cập nhật lead thành công
- `401` chưa đăng nhập
- `404` không tìm thấy lead
- `409` trùng dữ liệu unique
- `500` lỗi server

Body: partial update toàn bộ field lead

Response 200: `{ statusCode, message: "Update lead success", data: Lead }`

### 9.5. PATCH /leads/:id/status

Status codes:

- `200` cập nhật status lead thành công
- `400` thiếu `status`
- `401` chưa đăng nhập
- `404` không tìm thấy lead
- `500` lỗi server

Body:

```json
{
  "status": "Biz đã kết nối channel"
}
```

Validation:

- `status` bắt buộc

Response 200: `{ statusCode, message: "Update lead status success", data: Lead }`

### 9.6. DELETE /leads/:id

Status codes:

- `200` xóa lead thành công
- `401` chưa đăng nhập
- `404` không tìm thấy lead
- `500` lỗi server

Response:

- `200` với body:

```json
{
  "statusCode": 200,
  "message": "Delete lead success",
  "data": null
}
```

---

## 10. Task API

Base path: `/tasks`

Auth: Bearer token

### 10.1. Task response shape

```json
{
  "_id": "...",
  "id": "#09382",
  "action": "Nhắc gia hạn gói cước",
  "time": "15 phút nữa",
  "timeType": "soon",
  "customer": {
    "name": "Phạm Tường Vy",
    "avatar": "https://i.pravatar.cc/100?img=15",
    "email": "vy.pham@example.com",
    "phone": "0912 345 678"
  },
  "platform": "SmaxAi",
  "assignee": {
    "name": "Hải Anh",
    "avatar": "https://i.pravatar.cc/100?img=11"
  },
  "status": "Đang thực hiện",
  "createdAt": "...",
  "updatedAt": "..."
}
```

### 10.2. GET /tasks

Status codes:

- `200` lấy danh sách task thành công
- `400` pagination không hợp lệ
- `401` chưa đăng nhập
- `500` lỗi server

Query params:

- `search`: search theo `action`, `id`, `customer.name`, `customer.email`, `customer.phone`
- `platform`: filter exact match
- `assignee`: filter theo `assignee.name`
- `status`: filter exact match
- `page`: số trang, mặc định `1`
- `limit`: số phần tử mỗi trang, mặc định `10`, tối đa `100`

Response 200:

```json
{
  "statusCode": 200,
  "message": "Get task list success",
  "data": {
    "items": [
      {
        "_id": "...",
        "id": "#09382",
        "action": "Nhắc gia hạn gói cước",
        "time": "15 phút nữa",
        "timeType": "soon",
        "customer": {
          "name": "Phạm Tường Vy",
          "avatar": "https://i.pravatar.cc/100?img=15",
          "email": "vy.pham@example.com",
          "phone": "0912 345 678"
        },
        "platform": "SmaxAi",
        "assignee": {
          "name": "Hải Anh",
          "avatar": "https://i.pravatar.cc/100?img=11"
        },
        "status": "Đang thực hiện",
        "createdAt": "...",
        "updatedAt": "..."
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "totalItems": 3,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPreviousPage": false
    }
  }
}
```

### 10.3. POST /tasks

Status codes:

- `201` tạo task thành công
- `400` thiếu `action`/`name` hoặc `customer.name`
- `401` chưa đăng nhập
- `409` trùng dữ liệu unique
- `500` lỗi server

Body:

```json
{
  "action": "Gọi điện tư vấn",
  "time": "15 phút nữa",
  "timeType": "soon",
  "customer": {
    "name": "Nguyễn Văn An",
    "avatar": "https://...",
    "email": "an.nguyen@example.com",
    "phone": "0988 765 432"
  },
  "platform": "SmaxAi",
  "assignee": {
    "name": "Hải Anh",
    "avatar": "https://..."
  },
  "status": "Đang thực hiện"
}
```

Hoặc có thể dùng `name` thay cho `action`.

Validation:

- `action` hoặc `name` bắt buộc
- `customer.name` bắt buộc

Default:

- `id`: auto dạng `#00001`
- `time`: `Sắp tới`
- `timeType`: `future`
- `platform`: `SmaxAi`
- `assignee`: `{ name: "", avatar: "" }`
- `status`: `Đang thực hiện`

Response 201: `{ statusCode, message: "Create task success", data: Task }`

### 10.4. PUT /tasks/:id

Status codes:

- `200` cập nhật task thành công
- `401` chưa đăng nhập
- `404` không tìm thấy task
- `409` trùng dữ liệu unique
- `500` lỗi server

Body: partial update

```json
{
  "action": "Cập nhật action",
  "time": "1 giờ nữa",
  "timeType": "future",
  "customer": {
    "name": "Khách hàng mới",
    "avatar": "https://...",
    "email": "new@example.com",
    "phone": "0909 111 222"
  },
  "platform": "Botvn",
  "assignee": {
    "name": "Hải Anh",
    "avatar": "https://..."
  },
  "status": "Hoàn thành"
}
```

Response 200: `{ statusCode, message: "Update task success", data: Task }`

### 10.5. DELETE /tasks/:id

Status codes:

- `200` xóa task thành công
- `401` chưa đăng nhập
- `404` không tìm thấy task
- `500` lỗi server

Response:

- `200` với body:

```json
{
  "statusCode": 200,
  "message": "Delete task success",
  "data": null
}
```

---

## 11. Organization API

Base path: `/organization`

Auth: Bearer token

### 11.1. Organization response shape

```json
{
  "_id": "...",
  "id": "1",
  "parent": "Phòng Marketing",
  "children": [
    {
      "name": "Nhóm Facebook Ads",
      "desc": "Chạy quảng cáo đa nền tảng"
    }
  ],
  "createdAt": "...",
  "updatedAt": "..."
}
```

### 11.2. GET /organization

Status codes:

- `200` lấy organization thành công
- `400` pagination không hợp lệ
- `401` chưa đăng nhập
- `500` lỗi server

Query params:

- `page`: số trang, mặc định `1`
- `limit`: số phần tử mỗi trang, mặc định `10`, tối đa `100`

Response 200:

```json
{
  "statusCode": 200,
  "message": "Get organization list success",
  "data": {
    "items": [
      {
        "_id": "...",
        "id": "1",
        "parent": "Phòng Marketing",
        "children": [
          {
            "name": "Nhóm Facebook Ads",
            "desc": "Chạy quảng cáo đa nền tảng"
          }
        ],
        "createdAt": "...",
        "updatedAt": "..."
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "totalItems": 4,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPreviousPage": false
    }
  }
}
```

### 11.3. POST /organization/departments

Status codes:

- `201` tạo department thành công
- `400` thiếu `name`
- `401` chưa đăng nhập
- `409` trùng dữ liệu unique
- `500` lỗi server

Body:

```json
{
  "name": "Phòng Vận Hành",
  "desc": "Mô tả nếu cần"
}
```

Validation:

- `name` bắt buộc

Note:

- `desc` hiện tại không được lưu ở department root
- `id` được tạo bằng `countDocuments + 1`

Response 201:

```json
{
  "statusCode": 201,
  "message": "Create department success",
  "data": {
    "_id": "...",
    "id": "5",
    "parent": "Phòng Vận Hành",
    "children": [],
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

### 11.4. POST /organization/groups

Status codes:

- `201` tạo group thành công
- `400` thiếu `name` hoặc `parentId`
- `401` chưa đăng nhập
- `404` không tìm thấy department
- `500` lỗi server

Body:

```json
{
  "name": "Nhóm CSKH",
  "desc": "Chăm sóc khách hàng",
  "parentId": "1"
}
```

Validation:

- `name` bắt buộc
- `parentId` bắt buộc

Response 201:

```json
{
  "statusCode": 201,
  "message": "Create group success",
  "data": {
    "name": "Nhóm CSKH",
    "desc": "Chăm sóc khách hàng",
    "parentId": "1"
  }
}
```

Error:

- `404 { "message": "Department not found" }`

---

## 12. Metadata API

Base path: `/metadata`

Auth: Bearer token

### 12.1. GET /metadata

Status codes:

- `200` lấy metadata thành công
- `401` chưa đăng nhập
- `500` lỗi server

Response 200:

```json
{
  "statusCode": 200,
  "message": "Get metadata success",
  "data": {
    "platforms": ["SmaxAi", "Botvn", "Appvn"],
    "customerGroups": ["Nhóm Facebook Ads", "Nhóm Content"],
    "customerTypes": [
      "Standard Customer",
      "VIP Customer",
      "Partner",
      "Regular",
      "Premium"
    ],
    "staffRoles": [
      { "value": "OWNER", "label": "Owner" },
      { "value": "ADMIN", "label": "Admin" },
      { "value": "MANAGER", "label": "Manager (Trưởng phòng)" },
      { "value": "STAFF", "label": "Staff (Nhân viên)" }
    ],
    "userRoles": [
      { "value": "OWNER", "label": "Owner" },
      { "value": "ADMIN", "label": "Admin" },
      { "value": "MANAGER", "label": "Manager (Trưởng phòng)" },
      { "value": "STAFF", "label": "Staff (Nhân viên)" }
    ],
    "departments": ["Phòng Marketing", "Phòng Sale", "Phòng Kỹ Thuật"]
  }
}
```

### 12.2. GET /metadata/roles

Query params:

- `page`: số trang, mặc định `1`
- `limit`: số phần tử mỗi trang, mặc định `10`, tối đa `100`

Status codes:

- `200` lấy danh sách role thành công
- `400` pagination không hợp lệ
- `401` chưa đăng nhập
- `500` lỗi server

Response 200:

```json
{
  "statusCode": 200,
  "message": "Get roles success",
  "data": {
    "items": [
      { "value": "OWNER", "label": "Owner" },
      { "value": "ADMIN", "label": "Admin" },
      { "value": "MANAGER", "label": "Manager (Trưởng phòng)" },
      { "value": "STAFF", "label": "Staff (Nhân viên)" }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "totalItems": 4,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPreviousPage": false
    }
  }
}
```

### 12.3. GET /metadata/departments

Query params:

- `page`: số trang, mặc định `1`
- `limit`: số phần tử mỗi trang, mặc định `10`, tối đa `100`

Status codes:

- `200` lấy danh sách department thành công
- `400` pagination không hợp lệ
- `401` chưa đăng nhập
- `500` lỗi server

Response 200:

```json
{
  "statusCode": 200,
  "message": "Get departments success",
  "data": {
    "items": [
      "Phòng Marketing",
      "Phòng Sale",
      "Phòng Kỹ Thuật",
      "Phòng Nhân Sự"
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "totalItems": 4,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPreviousPage": false
    }
  }
}
```

### 12.4. GET /metadata/customer-groups

Query params:

- `page`: số trang, mặc định `1`
- `limit`: số phần tử mỗi trang, mặc định `10`, tối đa `100`

Status codes:

- `200` lấy danh sách customer group thành công
- `400` pagination không hợp lệ
- `401` chưa đăng nhập
- `500` lỗi server

Response 200:

```json
{
  "statusCode": 200,
  "message": "Get customer groups success",
  "data": {
    "items": ["Nhóm Facebook Ads", "Nhóm Content", "Nhóm Design"],
    "pagination": {
      "page": 1,
      "limit": 10,
      "totalItems": 11,
      "totalPages": 2,
      "hasNextPage": true,
      "hasPreviousPage": false
    }
  }
}
```

---

## 13. Functions API

Base path: `/functions`

Auth: Bearer token

### 13.1. Function response shape

```json
{
  "_id": "...",
  "id": "FUNC001",
  "title": "Marketing",
  "desc": "Quản lý các chiến dịch quảng cáo...",
  "type": "marketing",
  "createdAt": "...",
  "updatedAt": "..."
}
```

### 13.2. GET /functions

Query params:

- `page`: số trang, mặc định `1`
- `limit`: số phần tử mỗi trang, mặc định `10`, tối đa `100`

Status codes:

- `200` lấy danh sách functions thành công
- `400` pagination không hợp lệ
- `401` chưa đăng nhập
- `500` lỗi server

Response 200:

```json
{
  "statusCode": 200,
  "message": "Get functions success",
  "data": {
    "items": [
      {
        "_id": "...",
        "id": "FUNC001",
        "title": "Marketing",
        "desc": "Quản lý các chiến dịch quảng cáo...",
        "type": "marketing",
        "createdAt": "...",
        "updatedAt": "..."
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "totalItems": 3,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPreviousPage": false
    }
  }
}
```

### 13.3. POST /functions

Status codes:

- `201` tạo function thành công
- `400` thiếu `title`
- `401` chưa đăng nhập
- `409` trùng dữ liệu unique
- `500` lỗi server

Body:

```json
{
  "title": "Customer Success",
  "desc": "Theo dõi trải nghiệm khách hàng",
  "type": "operation"
}
```

Validation:

- `title` bắt buộc

Default:

- `desc`: `""`
- `type`: `tech`
- `id`: auto `FUNCxxx`

Response 201: `{ statusCode, message: "Create function success", data: Function }`

---

## 14. Demo accounts

- Owner: `owner@crm.vn` / `Owner@123`
- Admin: `admin@crm.vn` / `Admin@123`
- Manager: `manager.sale@crm.vn` / `Manager@123`
- Staff: `staff1@crm.vn` / `Staff@123`

## 15. FE integration notes

### 15.1. Web flow

1. Call `POST /auth/login`
2. Lưu `accessToken` ở memory/state management
3. Refresh token đã được server set cookie httpOnly
4. Khi access token hết hạn, call `POST /auth/refresh`
5. Update lại `accessToken`
6. Khi logout, call `POST /auth/logout`

### 15.2. Mobile flow

1. Call `POST /auth/login`
2. Lưu:
   - `accessToken`
   - `refreshToken`
   - `sessionId`
3. Khi access token hết hạn, call `POST /auth/refresh` với body:

```json
{
  "sessionId": "...",
  "refreshToken": "..."
}
```

4. Khi logout, call `POST /auth/logout` với bearer token hoặc cặp `sessionId` + `refreshToken`

### 15.3. Chưa có trong API hiện tại

Các phần sau hiện chưa được implement:

- Sorting qua query param
- Batch APIs
- Upload file/avatar riêng
- Force reset password
- Forgot password / change password endpoint
- OpenAPI / Swagger JSON

Nếu cần, có thể generate tiếp 1 bản Swagger/OpenAPI 3.0 từ tài liệu này.
