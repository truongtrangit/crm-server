# Hướng dẫn cấu hình Google OAuth2 (Google Sign-In)

Để tính năng "Đăng nhập bằng Google" hoạt động cho cả Frontend (React) và Backend (Node.js), bạn cần tạo một Project trên Google Cloud Console và lấy `Client ID`.

Dưới đây là các bước chi tiết:

## Bước 1: Tạo Project trên Google Cloud
1. Truy cập vào [Google Cloud Console](https://console.cloud.google.com/).
2. Đăng nhập bằng tài khoản Google của bạn (tài khoản admin của dự án).
3. Ở góc trên cùng bên trái, click vào dropdown chọn Project, sau đó bấm **"New Project"**.
4. Nhập **Project Name** (ví dụ: `BotVN CRM`) và bấm **"Create"**.
5. Đợi Google tạo xong, sau đó chọn Project vừa tạo để bắt đầu làm việc.

## Bước 2: Cấu hình màn hình Xin phép (OAuth Consent Screen)
Trước khi có thể tạo Credentials (thông tin xác thực), bạn cần cấu hình màn hình hiển thị cho người dùng khi họ bấm Đăng nhập.

1. Trong menu bên trái, tìm đến **APIs & Services** > **OAuth consent screen**.
2. Chọn **User Type** là **External** (nếu app dành cho người dùng ngoài tổ chức) và bấm **Create**.
3. Điền các thông tin bắt buộc:
   - **App name**: Tên app sẽ hiển thị cho user (VD: BotVN).
   - **User support email**: Email hỗ trợ của bạn.
   - **Developer contact information**: Email của dev.
   - Các thông tin Logo, App domain có thể điền sau.
4. Bấm **Save and Continue**.
5. Ở bước **Scopes**: Google mặc định đã chọn sẵn 3 scope cơ bản là `.../auth/userinfo.email`, `.../auth/userinfo.profile`, và `openid`. Bạn không cần thêm gì cả, kéo xuống bấm **Save and Continue**.
6. Ở bước **Test users**: Trong quá trình app đang ở trạng thái "Testing", bạn phải thêm email của các tài khoản Google dùng để test đăng nhập vào đây. (Khi nào release app ra Production thì ai cũng đăng nhập được).
7. Bấm **Save and Continue** và hoàn tất.

## Bước 3: Tạo Google Client ID
1. Tiếp tục ở menu bên trái, chọn **APIs & Services** > **Credentials**.
2. Bấm nút **+ CREATE CREDENTIALS** ở trên cùng, chọn **OAuth client ID**.
3. Ở mục **Application type**, chọn **Web application**.
4. Đặt tên (Name) để dễ nhớ, ví dụ: `BotVN Web Client`.
5. **ĐẶC BIỆT LƯU Ý - Cấu hình nguồn cho phép (Authorized JavaScript origins & Redirect URIs):**
   Bạn cần thêm chính xác domain của Frontend vào đây để Google cho phép popup đăng nhập hoạt động.
   - **Authorized JavaScript origins**:
     - Thêm URL của môi trường Dev (VD: `http://localhost:3000`)
     - Thêm URL của môi trường Prod (VD: `https://botvn.com`)
   - **Authorized redirect URIs**: (Thường với flow `@react-oauth/google` popup thì không cần URL redirect, nhưng cứ add domain frontend vào cho chắc).
     - `http://localhost:3000`
     - `https://botvn.com`
6. Bấm **Create**.
7. Một bảng popup hiện ra chứa **Client ID** (định dạng `xxxxxx.apps.googleusercontent.com`) và **Client Secret**. (Với luồng React popup ID Token, chúng ta chỉ cần dùng **Client ID**, không cần dùng Secret).

## Bước 4: Cập nhật biến môi trường (.env)

Sau khi có `Client ID`, bạn copy đoạn mã đó và dán vào file `.env` của cả 2 source:

**1. Ở Frontend (botvn)**:
Mở file `.env` (hoặc `.env.local`) và thêm:
```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=nhập_client_id_của_bạn_vào_đây
```

**2. Ở Backend (crm-server)**:
Mở file `.env` và cập nhật biến:
```env
BOTVN_GOOGLE_CLIENT_ID=nhập_client_id_của_bạn_vào_đây
```

## Bước 5: Chuyển App sang chế độ Production (Tùy chọn)
Mặc định app vừa tạo sẽ nằm ở trạng thái **Testing** (chỉ các user email được add vào danh sách Test Users mới login được). 
Khi bạn public web ra ngoài cho tất cả mọi người dùng:
1. Vào **OAuth consent screen**.
2. Bấm nút **PUBLISH APP**.
3. (Lưu ý: Nếu bạn yêu cầu quá nhiều quyền nhạy cảm, Google sẽ bắt review, nhưng với quyền email và profile cơ bản thì thường không cần review hoặc review rất nhanh).

---

> 💡 **Tip:** Đừng bao giờ push file `.env` lên Git, hãy chỉ push file `.env.example` với giá trị rỗng để dev khác tự setup.
