@echo off
title Likya ERP - Yerel Yazici Servisi (printercekmeApp)
color 0A
echo ================================================================
echo   LIKYA ERP - YEREL YAZICI KOPRUSU (PRINTERCEKME APP)
echo   Port: 9100 dinleniyor...
echo ================================================================
echo.

cd /d "%~dp0"

if not exist node_modules (
  echo Bagimliliklar yukleniyor, lutfen bekleyiniz...
  npm install --production
)

node index.js
pause
