# Hướng dẫn Kiểm thử (Testing Guide)

Hệ thống CRM sử dụng Jest và Supertest cho việc chạy Integration Tests. Đôi khi, hệ thống in ra quá nhiều log (`logger.info`, `console.log`) khiến bạn khó khăn trong việc tìm ra test nào đang bị lỗi (fail).

Dưới đây là các phương pháp hữu ích để chạy và kiểm tra lỗi test hiệu quả:

## 1. Ẩn toàn bộ log thừa (Khuyên dùng)

Sử dụng cờ `--silent` để yêu cầu Jest ẩn đi toàn bộ các câu lệnh in log. Lúc này, màn hình Terminal sẽ vô cùng sạch sẽ và chỉ hiện ra kết quả của các test cùng với chi tiết của các test bị lỗi:

```bash
npm test -- --silent
```

## 2. Dừng ngay khi gặp lỗi đầu tiên (Bail out)

Nếu bạn có quá nhiều test bị lỗi và bạn chỉ muốn tập trung sửa từng lỗi một, hãy sử dụng cờ `--bail`. Jest sẽ dừng tiến trình kiểm thử ngay khi phát hiện ra một test bị fail:

```bash
npm test -- --bail
```

## 3. Chỉ hiển thị tóm tắt (Summary Reporter)

Nếu bạn chỉ quan tâm xem file nào đang chứa test lỗi thay vì in ra quá chi tiết từng test con, bạn có thể truyền thêm custom reporters:

```bash
npm test -- --reporters="default" --reporters="summary"
```

## 4. Xuất kết quả test ra file log

Đôi khi việc xem trên Terminal không tiện lợi bằng việc mở file ra đọc. Bạn có thể chuyển hướng kết quả log ra một file text (ví dụ: `test-output.log`), sau đó mở file lên và sử dụng tính năng tìm kiếm (Ctrl+F / Cmd+F) từ khóa `FAIL`:

```bash
npm test > test-output.log 2>&1
```

> **Mẹo nhỏ:**
> Mặc định, Jest luôn in phần mô tả lỗi chi tiết (kèm stack trace chỉ ra dòng code gây lỗi) của các test bị fail ở **ngay phía trên** bảng tổng kết "Test Suites / Tests" cuối cùng. Chỉ cần bạn cuộn màn hình ngược lên một chút từ dòng chữ cuối cùng, bạn sẽ thấy tên của test bị fail được bôi màu đỏ cực kỳ rõ ràng.
