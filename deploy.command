#!/bin/bash
cd "$(dirname "$0")"
echo "=== QuietSpace: ดีพลอยขึ้น Cloudflare ==="
command -v node >/dev/null || { echo "ยังไม่ได้ติดตั้ง Node.js โหลดที่ https://nodejs.org"; read -p "กด Enter"; exit 1; }
npm install && npx wrangler login && npx wrangler deploy
echo "ถ้าขึ้นลิงก์ workers.dev ด้านบน แปลว่าเสร็จแล้ว"
read -p "กด Enter เพื่อปิด"
