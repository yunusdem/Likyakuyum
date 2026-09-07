# 💎 Kuyumcu ERP SaaS - Node.js & Express TypeScript Backend

Bu proje; kurumsal standartlarda, ölçeklenebilir, tip güvenli (type-safe) ve katmanlı mimariye (Layered Architecture) sahip bir RESTful API sunucusudur.

---

## 🏗️ 1. Mimari & Klasör Yapısı

```
backend/
├── src/
│   ├── config/             # Veritabanı, CORS ve Zod ile doğrulanmış .env ayarları
│   │   ├── cors.config.ts
│   │   ├── database.config.ts
│   │   └── env.config.ts
│   ├── constants/          # Sabitler, HTTP durum kodları, roller ve mesajlar
│   │   ├── httpStatusCodes.ts
│   │   ├── responseMessages.ts
│   │   └── roles.ts
│   ├── controllers/        # İstekleri karşılayıp servisleri çağıran katman
│   │   ├── auth.controller.ts
│   │   ├── health.controller.ts
│   │   └── user.controller.ts
│   ├── middlewares/        # Auth, Role, Validation, Rate Limiter, Error handling
│   │   ├── auth.middleware.ts
│   │   ├── error.middleware.ts
│   │   ├── rateLimiter.middleware.ts
│   │   ├── requestLogger.middleware.ts
│   │   └── validate.middleware.ts
│   ├── models/             # Tip güvenli veri modelleri ve Repository sınıfları
│   │   └── user.model.ts
│   ├── routes/             # Modüler Express API rotaları
│   │   ├── auth.routes.ts
│   │   ├── health.routes.ts
│   │   ├── index.ts
│   │   └── user.routes.ts
│   ├── schemas/            # Zod DTO ve request doğrulama şemaları
│   │   ├── auth.schema.ts
│   │   └── user.schema.ts
│   ├── services/           # İş mantığının (Business Logic) çalıştığı servis katmanı
│   │   ├── auth.service.ts
│   │   └── user.service.ts
│   ├── types/              # TypeScript tipleri, DTO'lar ve Express genişletmeleri
│   │   ├── api.types.ts
│   │   ├── auth.types.ts
│   │   ├── express.d.ts
│   │   └── user.types.ts
│   ├── utils/              # ApiResponse, ApiError, asyncHandler, logger, token üreticileri
│   │   ├── ApiError.ts
│   │   ├── ApiResponse.ts
│   │   ├── asyncHandler.ts
│   │   ├── logger.ts
│   │   ├── password.utils.ts
│   │   └── token.utils.ts
│   ├── app.ts              # Express uygulamasının middleware'lerle kurulduğu dosya
│   └── server.ts           # Port dinleme, DB bağlantısı ve process hata yakalama
├── .env.example
├── .env
├── package.json
└── tsconfig.json
```

---

## 🚀 2. Kurulum ve Çalıştırma

### Bağımlılıkları Yükleme
```bash
cd backend
npm install
```

### Geliştirme Modunda Çalıştırma (Hot Reload)
```bash
npm run dev
```

### Üretim (Production) Derlemesi ve Çalıştırma
```bash
npm run build
npm start
```

---

## 📡 3. API Rota Listesi (`/api/v1`)

### 🩺 Sistem Sağlığı
- `GET /api/v1/health` - API durumu, uptime ve ortam bilgisi

### 🔐 Kimlik Doğrulama (`/api/v1/auth`)
- `POST /api/v1/auth/login` - Kullanıcı adı ve şifre ile giriş (Access & Refresh token döner)
- `POST /api/v1/auth/register` - Yeni kullanıcı kaydı
- `POST /api/v1/auth/refresh-token` - Access token yenileme
- `POST /api/v1/auth/logout` - Çıkış yapma (Token iptali)
- `GET /api/v1/auth/me` - Oturum açmış kullanıcının profil detayları *(Bearer Token Gerekir)*

### 👥 Kullanıcı Yönetimi (`/api/v1/users`)
- `GET /api/v1/users` - Kullanıcıları filtreleme ve sayfalama ile listele *(Admin/Manager)*
- `POST /api/v1/users` - Yeni kullanıcı oluştur *(Admin)*
- `GET /api/v1/users/:id` - ID ile kullanıcı detayı getir
- `PUT /api/v1/users/:id` - Kullanıcı bilgilerini ve yetkilerini güncelle *(Admin)*
- `DELETE /api/v1/users/:id` - Kullanıcıyı sil *(Admin)*

---

## 🔒 4. Standart Yanıt Formatları

### Başarılı Yanıt (Success Response - 200/201):
```json
{
  "success": true,
  "message": "Giriş işlemi başarılı.",
  "data": { ... },
  "meta": { "page": 1, "limit": 20, "total": 100 }
}
```

### Hata Yanıtı (Error Response - 4xx/5xx):
```json
{
  "success": false,
  "message": "Doğrulama hatası (Validation Failed)",
  "errors": [
    { "field": "body.username", "message": "Kullanıcı adı en az 3 karakter olmalıdır" }
  ]
}
```

---

## 👤 5. Varsayılan Demo Giriş Bilgileri

- **Admin Kullanıcı:**
  - Kullanıcı Adı: `admin`
  - Şifre: `admin123`
  - Rol: `admin`

- **Veznedar Kullanıcı:**
  - Kullanıcı Adı: `vezne01`
  - Şifre: `123456`
  - Rol: `cashier`
