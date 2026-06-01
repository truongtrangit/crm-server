# Kế Hoạch Triển Khai Module Job Hub (Hoàn thiện Cấu hình & Tab Công Việc)

Tài liệu này lưu trữ kế hoạch triển khai tính năng Job Hub bao gồm các công tác hoàn thiện module cấu hình và phát triển tính năng Công việc độc lập với Task truyền thống của hệ thống.

## 1. Thiết kế Phân quyền (RBAC & MLAC)

- **Frontend (`src/constants.ts`)**:
  Định nghĩa chi tiết quyền cho từng Subtab thuộc tab Cấu hình:
  ```typescript
  {
    key: 'jobhub',
    name: 'Job Hub',
    actions: ['read', 'manage'],
    subModules: [
      { key: 'jobhub.tasks', name: 'Quản lý Công việc Job Hub', actions: ['read', 'manage'] },
      { key: 'jobhub.config.repeatRule', name: 'Cấu hình Quy tắc lặp lại', actions: ['config'] },
      { key: 'jobhub.config.channel', name: 'Cấu hình Kênh triển khai', actions: ['config'] },
      { key: 'jobhub.config.taskType', name: 'Cấu hình Loại công việc', actions: ['config'] },
      { key: 'jobhub.config.status', name: 'Cấu hình Trạng thái', actions: ['config'] },
    ]
  }
  ```
- **Backend (`src/utils/rbac.js`)**:
  - Tương ứng với FE, thêm các actions: `JOBHUB_REPEAT_RULE_CONFIG`, `JOBHUB_CHANNEL_CONFIG`, vân vân để phân quyền chi tiết. Các API Router sẽ yêu cầu quyền tương ứng.

## 2. Thiết kế Database Models (Backend)

- **`JobTask` (MỚI)**:
  - `id`: Định dạng JBT...
  - `name`: Tên công việc.
  - `folderId`: Reference đến `JobFolder` (hoặc lưu string cho đơn giản, cần chốt trong quá trình implement `JobFolder`).
  - `jobChannelId`, `jobTaskTypeId`, `statusId` (Ref: `JobStatusConfig`).
  - `assignees`: [String] Array of User IDs.
  - `scheduledDate`, `dueDate`: Thời gian lặp/hạn chót.
  - `sourceRuleId`: Ref đến JobRepeatRule sinh ra nó (nếu có).
  - `checklists`: [{ title, assignees, isCompleted }].
  - `description`: RichText.

- **`JobFolder` (MỚI cho Thư mục công việc)**:
  - Cho phép người dùng CRUD thư mục (ví dụ: Marketing, Khác...) ở Left Sidebar của Tab Công việc. Tương tự cấu trúc `JobChannel` có hỗ trợ thư mục cha con.

- **`JobStatusConfig`**:
  - `order` sẽ được validate kỹ lưỡng cả ở Frontend và Backend (phải <= tổng số trạng thái + 1).

- **`JobChannel`**:
  - Sử dụng Component `RichTextEditor` có sẵn (`src/components/RichTextEditor.tsx`) của dự án cho field `description`.

- **`JobRepeatRule`**:
  - Bổ sung `isCompleted` vào `checklistItemSchema`.
  - Bổ sung field `shortDescription`/`details` cho mục đích lưu mô tả ngắn.

## 3. Kiến trúc Backend Controller Convention

- **`AI_CONTEXT.md`** đã được cập nhật: Controller **KHÔNG** sử dụng `try/catch`.
- Cần refactor lại `jobConfig.controller.js` (và quét các controller khác nếu cần thiết) để xoá bỏ khối `try/catch`, lợi dụng cơ chế bắt lỗi promise chung của Express framework trong dự án.

## 4. Giao diện Frontend (React)

- **Cấu hình Kênh & Quy tắc lặp lại**: Sửa đổi Modal để áp dụng `RichTextEditor` vào `description`, và bổ sung trường `shortDescription` cùng trạng thái `isCompleted` cho Checklist ở giao diện tạo quy tắc.
- **Tab Công việc (JobTasksTab)**:
  - Xây dựng Layout có 3 vùng chính: (1) Cột trái: Quản lý Thư mục (`JobFolder` tree), (2) Top bar: Filter & Nút tạo mới, (3) Vùng hiển thị: Hỗ trợ 2 chế độ xem là Kanban Board và Table View.
  - Hỗ trợ Kéo thả (Drag & Drop) card công việc qua lại giữa các cột trạng thái (Kanban).
  - Component Thống kê Nhanh (Quick Stats Panel) bên tay phải có thể thu gọn.

## 5. Kế hoạch Thực thi (Execution Plan)

1. Cập nhật Model và Refactor Controller (Xoá `try/catch`).
2. Sửa lại UI/UX Modal của Kênh và Quy tắc (Thêm `RichTextEditor`, order validate).
3. Phát triển `JobTask` và `JobFolder` CRUD API (BE).
4. Phát triển Giao diện Job Hub - Tab Công việc, tích hợp Kanban/Table.
5. Cập nhật service Cronjob `JobRecurringTaskService` để sinh task vào bảng `JobTask` mới.
