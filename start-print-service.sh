#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "============================================================"
echo "  LİKYA KUYUMCU ERP - YEREL SESSİZ YAZDIRMA SERVİSİ"
echo "============================================================"
echo "Servis Port: http://localhost:5050"
echo ""

if [ ! -d "local-print-service/node_modules/express" ]; then
  echo "[BİLGİ] Gerekli bağımlılıklar kuruluyor..."
  cd local-print-service
  npm install --no-audit --no-fund
  cd ..
fi

node local-print-service/server.js
