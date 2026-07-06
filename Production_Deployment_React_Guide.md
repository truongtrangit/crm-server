# Production Deployment Guide (React + VPS + GitHub Actions)

## 1. Chuẩn bị VPS

-   Tạo user deploy:

``` bash
sudo adduser deploy
sudo usermod -aG sudo deploy
```

-   Tạo SSH key trên máy local:

``` bash
ssh-keygen -t ed25519 -C "GitHub Actions"
```

-   Copy public key vào: `/home/deploy/.ssh/authorized_keys`
-   Kiểm tra quyền:

``` bash
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

-   Test SSH bằng key.

## 2. Cấu trúc thư mục

``` text
/var/www/crm-fe/
├── current -> releases/<release>
└── releases/
    ├── initial/
    ├── 20260705_050819/
    └── ...
```

Đảm bảo `deploy` sở hữu thư mục:

``` bash
sudo chown -R deploy:deploy /var/www/crm-fe
```

## 3. Nginx

-   Root trỏ tới symlink:

``` nginx
root /var/www/crm-fe/current;
location / {
    try_files $uri /index.html;
}
```

-   Kiểm tra:

``` bash
sudo nginx -t
sudo systemctl reload nginx
```

## 4. GitHub Secrets

-   VPS_HOST
-   VPS_USER
-   VPS_SSH_KEY
-   DEPLOY_PATH (nếu dùng)
-   VITE_API_BASE_URL

## 5. GitHub Actions

Pipeline: 1. Checkout 2. Setup Node 3. npm ci 4. Build 5. SSH agent 6.
ssh-keyscan 7. Tạo release tạm 8. rsync dist 9. Verify 10. Đổi tên
`.tmp` -\> release 11. Đổi symlink `current` 12. Xóa release cũ (giữ 10
bản) 13. Cleanup nếu lỗi

## 6. Rollback

-   Có 2 script:
    -   rollback.sh (local launcher)
    -   rollback.remote.sh (chạy trên VPS)
-   Rollback chỉ đổi symlink `current`.

## 7. Branch Protection

-   Require Pull Request
-   Block force push
-   Block delete
-   Conversation resolution
-   Sau khi có CI: Require status checks.

## 8. CI/CD

Tách: - ci.yml: lint/test/build - deploy.yml: deploy production khi
merge vào main.

## 9. Khuyến nghị

-   Health check sau deploy.
-   Environment `production`.
-   Fail2Ban.
-   UFW (chỉ mở 22,80,443).
-   Theo dõi SSL renewal.
-   Monitoring (UptimeRobot...).
-   Dependabot.
-   CodeQL.

## 10. Quy trình

``` text
Feature
  ↓
Pull Request
  ↓
CI
  ↓
Merge main
  ↓
GitHub Actions
  ↓
Deploy
  ↓
Health Check
  ↓
Rollback nếu cần
```
