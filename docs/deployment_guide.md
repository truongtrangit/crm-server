# CRM Server — Hướng Dẫn Triển Khai UAT & PROD

> **Phiên bản:** 1.0 | **Cập nhật:** 2026-05-02  
> **Scope:** `crm-server` (Node.js / Express / MongoDB)

---

## Tổng quan chiến lược Seed DB

| Môi trường | Lệnh seed          | Dữ liệu được tạo                                       |
| ---------- | ------------------ | ------------------------------------------------------ |
| **DEV**    | `npm run db:reset` | Toàn bộ dữ liệu mẫu (8 users, 8 customers, 16 events…) |
| **UAT**    | `npm run db:init`  | **Chỉ:** Owner + Admin + RBAC + StaffFunctions         |
| **PROD**   | `npm run db:init`  | **Chỉ:** Owner + Admin + RBAC + StaffFunctions         |

> [!IMPORTANT]
> `db:init` là **idempotent** (an toàn khi chạy lại) và **KHÔNG xoá** dữ liệu hiện có.  
> `db:reset` xoá toàn bộ data — **CHỈ dùng ở DEV.**

---

## Checklist trước khi deploy

- [ ] Code đã merge vào nhánh `main` / release tag
- [ ] Tất cả tests pass: `npm test`
- [ ] File `.env` đã cấu hình đủ cho môi trường target (xem bảng bên dưới)
- [ ] MongoDB đã chạy và reachable từ server
- [ ] (UAT) Đã thông báo cho team QA về deploy window
- [ ] (PROD) Đã thông báo stakeholder và chuẩn bị rollback plan

---

## Biến môi trường bắt buộc

Tạo file `.env` từ `.env.example`:

```bash
cp .env.example .env
```

| Biến                               | UAT                         | PROD                  | Ghi chú                    |
| ---------------------------------- | --------------------------- | --------------------- | -------------------------- |
| `PORT`                             | `4000`                      | `4000`                | Có thể đổi theo infra      |
| `MONGO_URI`                        | `mongodb://...`             | `mongodb://...`       | **Bắt buộc**               |
| `CLIENT_URL`                       | URL frontend UAT            | URL frontend PROD     | CORS whitelist             |
| `ACCESS_TOKEN_TTL_MINUTES`         | `15`                        | `15`                  |                            |
| `REFRESH_TOKEN_TTL_DAYS`           | `30`                        | `30`                  |                            |
| `PASSWORD_RESET_TOKEN_TTL_MINUTES` | `30`                        | `30`                  |                            |
| `WEBHOOK_SECRET`                   | `whsec_uat_...`             | `whsec_prod_...`      | **Phải khác DEV**          |
| `WEBHOOK_ALLOWED_IPS`              | IP SmaxAi staging           | IP SmaxAi prod        | Để trống = cho phép tất cả |
| `OWNER_EMAIL`                      | `owner@company.vn`          | `owner@company.vn`    | Dùng cho `db:init`         |
| `OWNER_PASSWORD`                   | **đặt mật khẩu mạnh**       | **đặt mật khẩu mạnh** | **Bắt buộc**               |
| `OWNER_NAME`                       | `Chủ hệ thống CRM`          | `Chủ hệ thống CRM`    | Tuỳ chọn                   |
| `ADMIN_EMAIL`                      | `admin@company.vn`          | `admin@company.vn`    | Dùng cho `db:init`         |
| `ADMIN_PASSWORD`                   | **đặt mật khẩu mạnh**       | **đặt mật khẩu mạnh** | **Bắt buộc**               |
| `ADMIN_NAME`                       | `Quản trị CRM`              | `Quản trị CRM`        | Tuỳ chọn                   |
| `ENABLE_REDIS`                     | `false` (nếu chưa có Redis) | `true`                |                            |
| `REDIS_URL`                        | —                           | `redis://...`         | Nếu `ENABLE_REDIS=true`    |

> [!CAUTION]
> **KHÔNG commit file `.env` vào Git.** File `.gitignore` đã loại trừ `.env` — kiểm tra lại trước khi push.

---

## Quy trình triển khai từng bước

### Bước 1 — Lấy code mới nhất

```bash
# Trên server UAT/PROD
git pull origin main       # hoặc checkout release tag cụ thể
# Ví dụ: git checkout v1.2.0
```

### Bước 2 — Cài dependencies

```bash
npm install --omit=dev
```

> `--omit=dev` bỏ qua Jest, Supertest… không cần trên production.

### Bước 3 — Kiểm tra cú pháp (optional nhưng khuyến nghị)

```bash
npm run check
```

> Phát hiện lỗi syntax trước khi chạy thực tế.

### Bước 4 — Cấu hình `.env`

```bash
# Chỉnh sửa file .env với giá trị đúng cho môi trường
nano .env
# Kiểm tra nhanh các biến bắt buộc
grep -E "MONGO_URI|OWNER_PASSWORD|ADMIN_PASSWORD" .env
```

> [!WARNING]
> `OWNER_PASSWORD` và `ADMIN_PASSWORD` phải có trong `.env` trước Bước 5.  
> Script sẽ **từ chối chạy** nếu thiếu hai biến này.

### Bước 5 — Khởi tạo DB (lần đầu tiên hoặc môi trường mới)

```bash
npm run db:init
```

Kết quả mong đợi:

```
🔌  Kết nối MongoDB...
   Connected: 127.0.0.1

🌱  Khởi tạo dữ liệu tối thiểu (UAT/PROD)...

📋  [1/5] Đồng bộ RBAC Permissions & Roles...
✓ Synced XX permissions
✓ Synced 5 system roles
📋  [2/5] Khởi tạo StaffFunctions...
   ✓ StaffFunctions: 4 tạo mới, 0 đã tồn tại
🔢  [3/5] Khởi tạo Counters...
   ✓ Counters: 10 tạo mới, 0 đã tồn tại
👑  [4/5] Khởi tạo tài khoản Owner...
   ✓ Owner tạo thành công: owner@company.vn
🛡   [5/5] Khởi tạo tài khoản Admin...
   ✓ Admin tạo thành công: admin@company.vn

✅  Khởi tạo UAT/PROD hoàn tất!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  QUAN TRỌNG: Hãy đổi mật khẩu Owner & Admin
   ngay sau khi đăng nhập lần đầu tiên!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

> **Nếu DB đã có sẵn dữ liệu** (deploy lần sau): chỉ cần chạy lại `db:init` — script sẽ bỏ qua những gì đã tồn tại và chỉ thêm thiếu.

### Bước 6 — Khởi động server

**Cách 1 — PM2 (Khuyến nghị cho production):**

```bash
# Cài PM2 nếu chưa có
npm install -g pm2

# Khởi động
pm2 start src/server.js --name crm-server

# Đặt auto-restart khi server reboot
pm2 startup
pm2 save

# Kiểm tra log
pm2 logs crm-server
pm2 status
```

**Cách 2 — systemd (nếu dùng Linux server):**

```bash
# /etc/systemd/system/crm-server.service
[Unit]
Description=CRM Server
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/path/to/crm-server
ExecStart=/usr/bin/node src/server.js
Restart=on-failure
EnvironmentFile=/path/to/crm-server/.env

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable crm-server
sudo systemctl start crm-server
sudo systemctl status crm-server
```

**Cách 3 — Chạy thủ công (UAT / debug):**

```bash
npm start
# hoặc: node src/server.js
```

### Bước 7 — Smoke Test sau deploy

Thay `BASE_URL` bằng URL thực của server:

```bash
BASE_URL=http://localhost:4000

# 1. Health check
curl -s $BASE_URL/api/v1/health | jq .

# 2. Login Owner
curl -s -X POST $BASE_URL/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@company.vn","password":"<OWNER_PASSWORD>"}' | jq .

# 3. Login Admin
curl -s -X POST $BASE_URL/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@company.vn","password":"<ADMIN_PASSWORD>"}' | jq .
```

Kết quả mong đợi: cả hai login trả về `200 OK` với `accessToken`.

---

## Deploy lần sau (update code)

Khi code thay đổi nhưng DB đã có dữ liệu:

```bash
git pull origin main
npm install --omit=dev

# Nếu có thay đổi RBAC/permissions: chạy lại db:init (an toàn)
npm run db:init

# Restart server
pm2 restart crm-server
# hoặc: sudo systemctl restart crm-server
```

> [!NOTE]
> Không cần chạy `db:init` nếu chỉ sửa logic code và không thay đổi schema RBAC / StaffFunctions.

---

## Rollback

### Rollback code:

```bash
# Quay về commit/tag trước
git checkout v1.1.0    # hoặc git revert HEAD
npm install --omit=dev
pm2 restart crm-server
```

### Rollback DB (nếu có migration gây lỗi):

> [!CAUTION]
> Không có auto-rollback cho DB changes. Phải restore từ backup.

```bash
# Restore từ MongoDB backup
mongorestore --uri="$MONGO_URI" --drop ./backup/crm-server-YYYYMMDD/
```

---

## Backup DB định kỳ (khuyến nghị)

```bash
# Backup thủ công
mongodump --uri="$MONGO_URI" --out=./backup/crm-server-$(date +%Y%m%d)/

# Cron job hàng ngày lúc 2:00 AM
0 2 * * * mongodump --uri="mongodb://..." --out="/backups/crm-$(date +\%Y\%m\%d)" --gzip
```

---

## Tóm tắt lệnh nhanh

| Tình huống        | Lệnh                                                                              |
| ----------------- | --------------------------------------------------------------------------------- |
| Lần đầu deploy    | `npm install --omit=dev && npm run db:init && npm start`                          |
| Deploy cập nhật   | `git pull && npm install --omit=dev && npm run db:init && pm2 restart crm-server` |
| Chỉ restart       | `pm2 restart crm-server`                                                          |
| Xem log           | `pm2 logs crm-server`                                                             |
| Smoke test health | `curl http://localhost:4000/api/v1/health`                                        |
| **DEV reset**     | `npm run db:reset` ← **CHỈ dùng ở DEV**                                           |
