@echo off
chcp 65001 > nul
title Likya Kuyumcu ERP - Yerel Sessiz Yazdırma Servisi (Port 5050)
cd /d "%~dp0"

echo ============================================================
echo   LİKYA KUYUMCU ERP - YEREL SESSİZ YAZDIRMA SERVİSİ
echo ============================================================
echo.
echo Port: http://127.0.0.1:5050
echo.

where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  if exist "local-print-service\node_modules\express" (
    echo [BİLGİ] Node.js üzerinden servis başlatılıyor...
    node local-print-service\server.js
    goto bitir
  )
)

echo [BİLGİ] Yerel Windows PowerShell servisi başlatılıyor...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0local-print-service\service-runner.ps1"

:bitir
pause
