# Hướng dẫn chạy bot Caro 24/7 trên VPS Việt Nam

Gói này chứa bản build sẵn (đã bundle) của bot Telegram Caro. Bạn không cần cài
pnpm/monorepo gì cả — chỉ cần Node.js.

## 1. Thuê VPS

Chọn một nhà cung cấp VPS Việt Nam, thanh toán bằng chuyển khoản/MoMo, ví dụ:
Vietnix, TinoHost, BizFly Cloud, VNG Cloud, iNET Hosting... Cấu hình tối thiểu:
1 vCPU / 1GB RAM, hệ điều hành **Ubuntu 22.04**, giá thường 50–100k/tháng.

## 2. Cài Node.js trên VPS

SSH vào VPS rồi chạy:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get install -y nodejs
node -v   # kiểm tra đã cài, nên >= 20
```

## 3. Upload gói này lên VPS

Từ máy tính của bạn (dùng `scp`, WinSCP, hoặc FileZilla):

```bash
scp -r deploy-package root@<IP_VPS>:/root/caro-bot
```

## 4. Khai báo biến môi trường

SSH vào VPS, vào thư mục `/root/caro-bot`:

```bash
cd /root/caro-bot
cp .env.example .env
nano .env   # điền TELEGRAM_BOT_TOKEN và DATABASE_URL
```

- `TELEGRAM_BOT_TOKEN`: lấy từ BotFather (đã dùng token này trên Replit trước đó).
- `DATABASE_URL`: copy nguyên chuỗi kết nối Postgres đang dùng trên Replit
  (mở tab Secrets trong Replit để xem giá trị `DATABASE_URL`), để giữ nguyên
  toàn bộ dữ liệu (lịch sử thắng, danh sách nhóm được duyệt...). Database này
  vẫn nằm trên hạ tầng của Replit và có thể truy cập từ Internet, không cần
  chuyển dữ liệu đi đâu cả.

Ứng dụng đọc biến môi trường từ file `.env` thông qua PM2 (bước dưới), nên
đảm bảo file `.env` nằm cùng thư mục với `ecosystem.config.cjs`.

## 5. Cài PM2 và chạy bot nền 24/7

PM2 giữ cho bot luôn chạy, tự khởi động lại nếu crash hoặc khi VPS reboot.

```bash
sudo npm install -g pm2

# nạp biến môi trường từ .env rồi khởi động bot qua PM2
export $(grep -v '^#' .env | xargs) && pm2 start ecosystem.config.cjs

# lưu danh sách tiến trình để PM2 tự chạy lại sau khi VPS khởi động lại
pm2 save
pm2 startup   # copy lệnh nó in ra và chạy lại (thường phải sudo)
```

## 6. Kiểm tra

```bash
pm2 status          # xem bot có đang "online" không
pm2 logs caro-bot    # xem log trực tiếp, Ctrl+C để thoát
```

Nếu log hiện `Telegram bot started (polling)` thì bot đã chạy được. Vào group
Telegram gõ `/join` để thử.

## 7. Các lệnh PM2 hữu ích

```bash
pm2 restart caro-bot   # khởi động lại bot (sau khi sửa .env chẳng hạn)
pm2 stop caro-bot       # dừng bot
pm2 logs caro-bot --lines 100   # xem 100 dòng log gần nhất
```

## Lưu ý quan trọng

- **Không chạy 2 bản bot cùng lúc với cùng 1 token** (ví dụ vừa chạy trên
  Replit vừa chạy trên VPS) — Telegram sẽ báo lỗi conflict vì cả hai đều
  polling cùng một bot. Sau khi xác nhận bot chạy ổn trên VPS, hãy dừng
  workflow "API Server" trên Replit lại.
- Nếu sau này bạn sửa code bot, sửa trực tiếp trên Replit rồi export lại gói
  này (build lại `dist/`) và upload đè lên VPS.
