#!/bin/bash
echo "============================================================"
echo "  LIKYA KUYUMCU ERP - YEREL SQL KOPRUSU BASLATILIYOR...     "
echo "============================================================"

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

if ! command -v node &> /dev/null; then
    echo "[HATA] Node.js bulunamadı! Lütfen https://nodejs.org adresinden kurunuz."
    exit 1
fi

node local-agent/server.js
