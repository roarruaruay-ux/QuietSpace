@echo off
chcp 65001 >nul
echo === QuietSpace: ดีพลอยขึ้น Cloudflare ===
where node >nul 2>nul || (echo ยังไม่ได้ติดตั้ง Node.js ให้โหลดที่ https://nodejs.org แล้วเปิดไฟล์นี้ใหม่ & pause & exit /b 1)
call npm install || (echo ติดตั้งไม่สำเร็จ & pause & exit /b 1)
echo.
echo ขั้นต่อไปจะเปิดเบราว์เซอร์ให้ล็อกอิน Cloudflare กด Allow
call npx wrangler login
call npx wrangler deploy
echo.
echo ถ้าขึ้นลิงก์ https://quietspace....workers.dev ด้านบน แปลว่าเสร็จแล้ว เปิดลิงก์นั้นได้เลย
pause
