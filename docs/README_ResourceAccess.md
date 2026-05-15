# Hướng dẫn sử dụng Resource Access Middleware

File này chứa tài liệu hướng dẫn và quy tắc sử dụng bộ Middleware phân quyền cấp độ tài nguyên (Resource-Level Access Control) nằm tại `src/middleware/resourceAccess.js`.

---

## 1. Kiến trúc chung (Thiết kế hướng Hành vi - Behavioral Flags)
Các middleware trong hệ thống được thiết kế theo dạng **Factory + Override Method**. 
Điều này có nghĩa là bạn khai báo cấu hình cốt lõi (Base Policy) một lần ở đầu file, sau đó khi gắn vào từng Route, bạn có thể gọi hàm `.with({ flags })` để bật/tắt (override) các luật kiểm tra cụ thể cho riêng route đó.

---

## 2. Các Middleware chính

### A. `requireResourceAccess`
Kiểm tra xem người dùng có quyền **truy cập/tương tác** với một bản ghi dữ liệu cụ thể (Lead, Customer, Event, Task...) hay không.

#### Các tham số cấu hình (Options):
| Cờ (Flag) | Mặc định | Ý nghĩa |
| :--- | :---: | :--- |
| `getResource` | **(Bắt buộc)** | Hàm `async (req) => Document`. Dùng để fetch dữ liệu từ Database. |
| `getAssigneeIds` | `undefined` | Hàm `(resource) => string[]`. Trích xuất mảng ID những người phụ trách. |
| `getCreatorId` | `undefined` | Hàm `(resource) => string`. Trích xuất ID người tạo. |
| `getTargetUserId` | `undefined` | Hàm `(resource) => string`. Trích xuất ID user (nếu resource chính là User). |
| `bypassRoles` | `['OWNER', 'ADMIN']` | Danh sách Role được đi qua tất cả các luật. |
| `allowCreator` | `true` | Người tạo ra tài nguyên có quyền tương tác không? |
| `allowAssignee` | `true` | Người phụ trách tài nguyên có quyền tương tác không? |
| `allowUnassigned` | `true` | Nếu tài nguyên CHƯA có ai phụ trách, ai cũng được tương tác? |
| `allowManagerSubordinateCreator` | `true` | Quản lý có quyền nếu nhân viên cấp dưới tạo ra nó? |
| `allowManagerSubordinateAssignee`| `true` | Quản lý có quyền nếu nhân viên cấp dưới đang phụ trách nó? |
| `allowManagerSubordinateTarget` | `true` | Quản lý có quyền thao tác trực tiếp lên profile của cấp dưới? |

#### Ví dụ sử dụng cơ bản (Base Policy):
Định nghĩa ở đầu file `src/routes/v1/customers.js`:
```javascript
const { requireResourceAccess } = require("../../middleware/resourceAccess");

const customerResourceAccess = requireResourceAccess({
  // Cách lấy dữ liệu từ DB
  getResource: (req) => Customer.findOne({ id: req.params.id }),
  // Xác định ai là người tạo
  getCreatorId: (customer) => customer.createdBy,
  
  // Hành vi phân quyền (Behavioral Flags)
  allowCreator: true,
  allowAssignee: true,
  allowManagerSubordinateCreator: true,
  allowManagerSubordinateAssignee: true,
  allowUnassigned: false, // Cấm thao tác nếu không rõ người tạo
});
```

#### Ví dụ sử dụng tùy biến ở từng Route (Override với `.with`):
```javascript
// Route 1: API Xóa mềm (Mọi thứ tuân theo luật chung)
router.delete(
  "/:id",
  requirePermission(PERMISSIONS.CUSTOMERS_DELETE),
  customerResourceAccess, // Sử dụng nguyên Base Policy
  CustomerController.deleteCustomer
);

// Route 2: API Xóa vĩnh viễn (Chỉ người tạo mới được xóa, cấm Manager của người tạo)
router.delete(
  "/:id/force-delete",
  requirePermission(PERMISSIONS.CUSTOMERS_DELETE),
  customerResourceAccess.with({
    allowManagerSubordinateCreator: false, // Override: Chặn Manager
  }),
  CustomerController.forceDeleteCustomer
);
```

---

### B. `enforceAssignmentRules`
Kiểm tra tính hợp lệ khi một người dùng cố gắng gán (assign) tài nguyên cho bản thân hoặc người khác. Thường dùng trong API Create và Update.

#### Các tham số cấu hình (Options):
| Cờ (Flag) | Mặc định | Ý nghĩa |
| :--- | :---: | :--- |
| `getNewAssigneeIds` | **(Bắt buộc)** | Hàm `(req) => string[]`. Trích xuất danh sách ID muốn gán từ body. |
| `getCurrentAssigneeIds` | `undefined` | Hàm `(resource) => string[]`. Dùng để biết tài nguyên đã có ai chưa. |
| `allowSelfAssignment` | `true` | User có được tự gán cho chính mình không? |
| `allowManagerSubordinateAssignment` | `true` | Manager có được gán cho nhân viên của mình không? |
| `allowStaffReassignment` | `false` | Nếu tài nguyên đã có người phụ trách, Staff có được đổi người không? |

#### Ví dụ sử dụng:
```javascript
const assignRules = enforceAssignmentRules({
  // Lấy danh sách ID muốn gán từ req.body
  getNewAssigneeIds: (req) => req.body.assigneeIds || [],
  // Lấy danh sách ID hiện tại
  getCurrentAssigneeIds: (resource) => resource.assignees || [],

  // Hành vi phân quyền (Behavioral Flags)
  allowSelfAssignment: true,
  allowManagerSubordinateAssignment: true,
  allowStaffReassignment: false, // Staff không được phép cướp dự án nếu đã có người nhận
});

// API chuyển giao Task nhưng không cho Staff nhận bừa
router.put(
  "/:id/transfer",
  assignRules.with({
    allowSelfAssignment: false // Cấm Staff tự gán cho bản thân, bắt buộc Manager gán
  }),
  TaskController.transferTask
);
```

---

### C. `enforceUnassignmentRules`
Kiểm tra tính hợp lệ khi muốn gỡ bỏ (unassign) một ai đó khỏi tài nguyên.

#### Các tham số cấu hình (Options):
| Cờ (Flag) | Mặc định | Ý nghĩa |
| :--- | :---: | :--- |
| `getTargetUserId` | **(Bắt buộc)** | Hàm `(req) => string`. ID của user đang bị xóa khỏi tài nguyên. |
| `allowSelfUnassignment` | `true` | Tự nguyện rút lui khỏi dự án có được không? |
| `allowManagerSubordinateUnassignment`| `true` | Quản lý có được "đá" nhân viên khỏi dự án không? |

#### Ví dụ sử dụng:
```javascript
const unassignRules = enforceUnassignmentRules({
  getTargetUserId: (req) => req.body.userIdToKick,

  // Hành vi phân quyền (Behavioral Flags)
  allowSelfUnassignment: true,
  allowManagerSubordinateUnassignment: true,
});

// API gỡ Staff khỏi Event
router.post(
  "/:id/kick",
  unassignRules.with({
    allowSelfUnassignment: false // Staff không được tự ý rút lui, bắt buộc Manager duyệt
  }),
  EventController.kickUser
);
```

---

### D. `scopeAssignmentList`
Dùng cho các API GET danh sách User. Nếu Frontend truyền lên `?assignmentScope=true`, Middleware này sẽ tự động thu hẹp truy vấn để trả về đúng những người mà user hiện tại có quyền nhìn thấy.

#### Các tham số cấu hình (Options):
| Cờ (Flag) | Mặc định | Ý nghĩa |
| :--- | :---: | :--- |
| `allowManagerSubordinateScope` | `true` | Manager có nhìn thấy toàn bộ nhân viên không? (Nếu false, Manager chỉ thấy mỗi mình). |

#### Ví dụ sử dụng:
Gọi trực tiếp ở Route:
```javascript
router.get(
  "/users",
  scopeAssignmentList({
    allowManagerSubordinateScope: true // Manager sẽ thấy bản thân + cấp dưới
  }),
  UserController.listUsers
);
```
*(Trong Controller, bạn chỉ cần lấy `req.query.scopedUserIds` ra và truyền vào query `_id: { $in: req.query.scopedUserIds }` của MongoDB).*
