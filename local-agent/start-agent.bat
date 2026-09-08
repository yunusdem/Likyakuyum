@echo off
title Likya Kuyumcu - Yerel SQL Koprusu
color 0A
chcp 65001 >nul

echo ============================================================
echo   LIKYA KUYUMCU ERP - YEREL SQL KOPRUSU BASLATILIYOR...
echo ============================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [HATA] Node.js sisteminizde bulunamadi!
    echo Lutfen https://nodejs.org adresinden Node.js indirip kurunuz.
    echo.
    pause
    exit /b 1
)

cd /d "%~dp0"
node server.js

if %errorlevel% neq 0 (
    echo.
    echo Agent beklenmedik bir sekilde sonlandi.
    pause
)
