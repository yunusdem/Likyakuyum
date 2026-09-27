@echo off
chcp 65001 > nul
title Likya Kuyumcu ERP - Sessiz Yazdırma Servisi (Port 5050)
cd /d "%~dp0"

echo ============================================================
echo   LİKYA KUYUMCU ERP - YEREL SESSİZ YAZDIRMA SERVİSİ
echo ============================================================
echo.
echo Servis Port: http://localhost:5050
echo.

if not exist "local-print-service\node_modules\express" (
  echo [BİLGİ] Gerekli bağımlılıklar kuruluyor, lütfen bekleyiniz...
  cd local-print-service
  call npm install --no-audit --no-fund
  cd ..
)

node local-print-service\server.js
pause
