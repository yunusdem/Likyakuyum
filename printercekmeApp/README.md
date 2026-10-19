# printercekmeApp - Yerel Yazıcı Köprüsü (Local Printer Bridge)

Likya ERP için istemci bilgisayardaki gerçek yazıcıları (Windows Denetim Masası / macOS CUPS) tarayıcıya güvenle aktaran hafif yerel ajan.

## Kurulum ve Çalıştırma

### 1. Çalıştırma
```bash
cd printercekmeApp
npm install
npm start
```
Windows için `baslat.bat` dosyasına çift tıklayarak da başlatabilirsiniz.

### 2. Tek Tıkla Çalışan (.exe) Paketleme
Windows kullanıcıları için Node.js kurulumu dahi gerektirmeyen tek bir `.exe` dosyası üretmek için:
```bash
npm run build:exe
```
Oluşan `dist/PrinterAgent.exe` dosyasını herhangi bir bilgisayarda doğrudan çift tıklayarak çalıştırabilirsiniz.

## Port ve Protokoller
- **Port:** `9100` (127.0.0.1)
- **HTTP GET:** `http://127.0.0.1:9100/api/printers`
- **WebSocket:** `ws://127.0.0.1:9100`
- **CORS & Private Network Access:** Canlı HTTPS ortamlarından yerel ağ engeline takılmadan çalışacak şekilde yapılandırılmıştır.

## Çıktı Formatı
```json
[
  { "name": "POS-80C", "isDefault": true, "status": "Hazır" },
  { "name": "Argox OS-214plus", "isDefault": false, "status": "Hazır" }
]
```
