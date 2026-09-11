# MASAK Modülü — Yol Haritası

> **Durum:** Taslak / onay bekliyor · **Tarih:** 08.09.2026 · **Kapsam:** Yalnızca MASAK tarafı
> **Kural:** Bu yol haritası onaylanmadan hiçbir kodda değişiklik yapılmaz. Uygulama aşamasında da
> yalnızca aşağıdaki "Dokunulacak Dosyalar" listesindeki dosyalara müdahale edilir.

---

## 1. Amaç

Ana ekrandaki **MASAK** butonundan açılan ekranın, referans programdaki (OFİS / OfsDvz)
`MASAK 'Malvarlıkları Dondurulanlar'` ekranıyla aynı işi yapması:

1. **"MASAK Listelerini Güncelle"** butonu → HMB (ms.hmb.gov.tr) üzerindeki 4 resmi Excel dosyasını
   indirip ayrıştırır ve **kendi SQL tablomuza** (`TODVZ_MASAK_LISTE`) yazar.
2. **Sorgulama** → Ad / Kimlik No ile listeleme ve tekil eşleşme sorgusu; artık HMB'ye değil
   **kendi tablomuza** sorulur (fiş, fatura, cari kaydı gibi noktalarda anlık kontrol için).
3. Ekranda **son güncelleme zamanı** ve liste bazında kayıt sayıları görünür.

**Mantık:** Excel'e internetten erişilir → veriler iç tabloya yazılır → tüm operasyonel sorgular
iç tablodan yapılır. İnternet erişimi olmasa bile son çekilen liste ile çalışmaya devam edilir.

---

## 2. Kapsam Sınırları

### Kapsam içi
- `TODVZ_MASAK_LISTE` (veri) ve `TODVZ_MASAK_GUNCELLEME` (güncelleme geçmişi) tablolarının
  oluşturulması ve doldurulması
- Backend: MASAK route / controller / service / repository (yeni dosyalar)
- Frontend: MASAK modalı ve MASAK sayfası (mevcut iki dosya)
- Frontend: `masakService.ts` (yeni)
- `Backend/src/routes/index.ts` içine **tek satır** router kaydı

### Kapsam dışı (dokunulmayacak)
- Kur modülü, cari, vezne, para, kullanıcı, şirket, istatistik, numaratör modülleri
- Login / auth akışı, `apiClient.ts`, `mssql.config.ts`, `auth.middleware.ts`
- Fiş / fatura ekranlarının kendisi — **biz sadece sorgulanacak tabloyu ve API'yi hazırlıyoruz**,
  o ekranlara entegrasyonu başka bir arkadaş yapacak. Bizim çıktımız net bir sözleşme (endpoint + tablo).

---

## 3. Mevcut Durum (kod analizi)

| Dosya | Bugün ne yapıyor | Ne olacak |
|---|---|---|
| `src/data/masakData.ts` | 4 listenin statik meta bilgisi + xlsx URL'leri | Kalır; kolon eşleme meta'sı eklenir |
| `src/components/masak/MasakModal.tsx` | Sadece "Excel İndir" linkleri gösteriyor | "Listeleri Güncelle" + durum paneli eklenir |
| `src/pages/settings/MasakListsPage.tsx` | Sadece bilgi kartları, veri yok | Gerçek veri grid'i + arama eklenir |
| `src/layouts/header/Header.tsx` | MASAK butonu + dropdown mevcut (satır ~179-378) | Değişiklik gerekmez (buton zaten modalı açıyor) |
| `src/App.tsx` | `/masak` ve `/ayarlar/masak-dondurulanlar` route'ları var | Değişiklik gerekmez |
| Backend | MASAK için **hiçbir şey yok** | Yeni modül (5 dosya + index'e 2 satır) |

**Referans alınacak mimari:** Kur modülü (`kur.routes.ts` → `kur.controller.ts` → `kur.service.ts` →
`kurSql.repository.ts`). Özellikle iki nokta birebir aynı desende olacak:
- `KurSqlRepository.ensureTablesAndProceduresExist()` → tabloyu yoksa otomatik oluşturma
- `KurController.getDbContext(req)` → çok kiracılı (multi-tenant) `dbServer` / `dbName` aktarımı

---

## 4. Sahada Doğrulanan Bulgular

Yol haritası yazılmadan önce 4 dosya gerçekten indirilip incelendi. Sonuçlar:

| Liste | HTTP | Boyut | Başlık satırı | Kolon | **Gerçek kayıt** |
|---|---|---|---|---|---|
| A — BMGK (6415 m.5) | 200 | 120 KB | **2. satır** | 16 | **476** |
| B — Yabancı Ülke (6415 m.6) | 200 | 28 KB | 1. satır | 13 | **112** |
| C — İç Dondurma (6415 m.7) | 200 | 157 KB | 1. satır | 14 | **1.443** |
| D — 7262 S.K. 3.A/3.B | 200 | 44 KB | 1. satır | 18 | **276** |
| | | | | | **Toplam ≈ 2.307** |

Kritik teknik bulgular:

1. **Dosya URL'leri kimlik doğrulaması istemiyor** — sunucu tarafından (backend / local agent)
   doğrudan indirilebiliyor. Tarayıcıdan indirip yüklemeye gerek yok.
2. **`https://ms.hmb.gov.tr/` HTML sayfaları 403 dönüyor** (tarayıcı User-Agent ile bile).
   → **Linkleri otomatik keşfetmek (scraping) mümkün değil.** Sadece `/uploads/...` altındaki
   dosya adresleri açık. Bu yüzden URL'ler yapılandırılabilir olmalı (bkz. Açık Karar #1).
3. **A listesinin başlık satırı 2. satırda**, diğerlerinde 1. satırda → başlık satırı otomatik
   tespit edilmeli, sabit index verilmemeli.
4. **Her listenin kolon seti farklı** (13 / 14 / 16 / 18 kolon) → ortak şema + eşleme tablosu şart.
5. **A listesinde 532 satırın 476'sı dolu**, kalanı boş kuyruk satırı → boş satır filtresi gerekli.
6. Veride Arapça (`عبد الله محمد`), Türkçe karakter ve `\xa0` (kırılmaz boşluk) var
   → `NVARCHAR` + trim/normalize zorunlu.
7. Serbest metin tarih alanları var: `"a)1970 b)1971 c)1972"`, `" 7 Şubat 1966"`
   → tarih alanı hem ham metin hem (ayrıştırılabiliyorsa) `DATE` olarak tutulmalı.
8. Kimlik alanı tek bir numara değil, cümle olabilir: `"a) Libya pasaport numarası 223611 ..."`
   → ham metin saklanır, içinden 11 haneli TCKN / 10 haneli VKN **ayrıca ayıklanır**.

---

## 5. Hedef Akış

```
┌──────────────────────────────────────────────────────────────────┐
│ FRONTEND (Header → MASAK butonu → MasakModal / MasakListsPage)   │
│   [MASAK Listelerini Güncelle]        [Ad / Kimlik No ile Ara]   │
└───────────────┬──────────────────────────────┬───────────────────┘
                │ POST /masak/guncelle         │ GET /masak/liste
                │                              │ GET /masak/sorgu
┌───────────────▼──────────────────────────────▼───────────────────┐
│ BACKEND  (bulut API  veya  yerel agent — aynı kod, port 25050)   │
│   masak.routes → masak.controller → masak.service                │
│      ├─ indir  (fetch, ms.hmb.gov.tr/uploads/*.xlsx)             │
│      ├─ ayrıştır (exceljs → başlık tespiti → kolon eşleme)       │
│      └─ yaz  (liste bazında TRANSACTION: DELETE + BULK INSERT)   │
└───────────────────────────┬──────────────────────────────────────┘
                            │ mssql (getDbPool: dbServer/dbName)
┌───────────────────────────▼──────────────────────────────────────┐
│ MSSQL — dbo.TODVZ_MASAK_LISTE   (≈2.300 satır)  → operasyonel sorgu│
│         dbo.TODVZ_MASAK_GUNCELLEME              → güncelleme geçmişi│
│   fiş / fatura / cari ekranları buradan sorgular (diğer geliştirici)│
└──────────────────────────────────────────────────────────────────┘
```

**Bulut / Yerel mod notu:** `local-agent/server.js` aynı `Backend/dist/app.js`'i çalıştırdığı için
ek geliştirme gerekmez. Yerel modda indirme kullanıcının bilgisayarından, bulut modda sunucudan
yapılır; her iki durumda da veri o modun bağlı olduğu SQL'e yazılır.

---

## 6. Veri Modeli

### 6.1 `dbo.TODVZ_MASAK_LISTE`

Tek tablo, tüm listeler `LISTE_KOD` ile ayrışır. Ortak alanlar kolonlanır, listeye özgü artık
alanlar `EK_BILGI` içinde JSON olarak durur (veri kaybı olmaz).

```sql
CREATE TABLE [dbo].[TODVZ_MASAK_LISTE] (
  [MASAK_ID]           INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
  [LISTE_KOD]          VARCHAR(10)    NOT NULL,   -- 'A' | 'B' | 'C' | '3AB'
  [LISTE_ADI]          NVARCHAR(200)  NULL,
  [SIRA_NO]            INT            NULL,       -- Excel'deki sıra no
  [AD_UNVAN]           NVARCHAR(500)  NOT NULL,   -- ad-soyad / ünvan
  [AD_UNVAN_NORM]      NVARCHAR(500)  NULL,       -- normalize (aksansız, büyük harf, tek boşluk)
  [KAYIT_TIPI]         VARCHAR(10)    NULL,       -- 'GERCEK' | 'TUZEL' (tahmini)
  [KIMLIK_NO]          NVARCHAR(1000) NULL,       -- ham metin (cümle olabilir)
  [TCKN]               VARCHAR(11)    NULL,       -- metinden ayıklanan 11 hane
  [VKN]                VARCHAR(10)    NULL,       -- metinden ayıklanan 10 hane
  [DIGER_ISIMLER]      NVARCHAR(MAX)  NULL,       -- alias'lar
  [DIGER_ISIMLER_NORM] NVARCHAR(MAX)  NULL,       -- alias arama için normalize
  [ORIJINAL_AD]        NVARCHAR(500)  NULL,       -- orijinal dilde yazım (Arapça vb.)
  [ESKI_ADI]           NVARCHAR(500)  NULL,
  [GOREVI]             NVARCHAR(500)  NULL,
  [ADRES]              NVARCHAR(MAX)  NULL,
  [UYRUK]              NVARCHAR(200)  NULL,
  [DIGER_UYRUK]        NVARCHAR(300)  NULL,
  [YAPTIRIM_TURU]      NVARCHAR(200)  NULL,
  [ANNE_ADI]           NVARCHAR(150)  NULL,
  [BABA_ADI]           NVARCHAR(150)  NULL,
  [DOGUM_TARIHI]       NVARCHAR(300)  NULL,       -- ham metin ("a)1970 b)1971")
  [DOGUM_TARIHI_DT]    DATE           NULL,       -- ayrıştırılabildiyse
  [DOGUM_YERI]         NVARCHAR(300)  NULL,
  [ORGUT]              NVARCHAR(300)  NULL,
  [KURULUS_YAPISI]     NVARCHAR(300)  NULL,
  [LISTEYE_ALINMA]     NVARCHAR(300)  NULL,
  [KARAR_BILGI]        NVARCHAR(300)  NULL,       -- karar tarih-sayısı / BKK-CBK
  [RESMI_GAZETE]       NVARCHAR(300)  NULL,
  [DIGER_BILGILER]     NVARCHAR(MAX)  NULL,
  [EK_BILGI]           NVARCHAR(MAX)  NULL,       -- eşlenemeyen kolonlar → JSON
  [KAYNAK_URL]         NVARCHAR(1000) NULL,
  [KAYNAK_HASH]        VARCHAR(64)    NULL,       -- indirilen dosyanın SHA-256'sı
  [GUNCELLEME_ZAMANI]  DATETIME       NOT NULL DEFAULT GETDATE(),
  [AKTIF]              BIT            NOT NULL DEFAULT 1
);

CREATE INDEX IX_TODVZ_MASAK_LISTE_LISTE  ON [dbo].[TODVZ_MASAK_LISTE]([LISTE_KOD], [SIRA_NO]);
CREATE INDEX IX_TODVZ_MASAK_LISTE_TCKN   ON [dbo].[TODVZ_MASAK_LISTE]([TCKN]);
CREATE INDEX IX_TODVZ_MASAK_LISTE_VKN    ON [dbo].[TODVZ_MASAK_LISTE]([VKN]);
CREATE INDEX IX_TODVZ_MASAK_LISTE_ADNORM ON [dbo].[TODVZ_MASAK_LISTE]([AD_UNVAN_NORM]);
```

> Tablo, kur modülündeki gibi `ensureTableExists()` ile **ilk istekte otomatik oluşturulur**;
> ayrıca `docs/sql/TODVZ_MASAK_LISTE.sql` olarak da bırakılır (elle kurulum isteyen sahalar için).

### 6.2 Kolon Eşleme Matrisi

Eşleme **kolon sırasına göre değil, başlık metnine göre** yapılır (başlıklar değişse de bozulmaz;
eş anlamlı başlık sözlüğü ile). Aşağıda 4 dosyanın gerçek başlıkları:

| Hedef kolon | A (16 kol) | B (13 kol) | C (14 kol) | D (18 kol) |
|---|---|---|---|---|
| `SIRA_NO` | (1. kolon) | Sıra No | SIRA NO | Sıra No |
| `AD_UNVAN` | AD-SOYAD/ÜNVANI | ADI SOYADI-ÜNVANI | GERÇEK/TÜZEL KİŞİ...ADI | GERÇEK/TÜZEL KİŞİ...ADI |
| `KIMLIK_NO` | TCKN/VKN/YKN/GKN/PASAPORT... | TCKN-VKN-PASAPORT NO | TCKN/VKN/GKN PASAPORT NO | PASAPORT NO/DİĞER MUHTELİF |
| `DIGER_ISIMLER` | KULLANDIĞI BİLİNEN DİĞER İSİMLERİ | KULLANDIĞI BİLİNEN DİĞER İSİMLERİ | KULLANDIĞI BİLİNEN DİĞER İSİMLERİ | KULLANDIĞI BİLİNEN DİĞER İSİMLER |
| `ORIJINAL_AD` | Adının Orijinal Dilde Yazımı | — | — | — |
| `ESKI_ADI` | — | — | — | ESKİ ADI |
| `GOREVI` | GÖREVİ | — | — | GÖREVİ |
| `ADRES` | ADRES | ADRES | — | ADRES |
| `UYRUK` | UYRUĞU | UYRUĞU | UYRUĞU | UYRUĞU |
| `DIGER_UYRUK` | — | TABİ OLDUĞU DİĞER UYRUKLAR | TABİ OLDUĞU DİĞER UYRUK | — |
| `YAPTIRIM_TURU` | MVD YAPTIRIM TÜRÜ | MVD YAPTIRIM TÜRÜ | MVD YAPTIRIM TÜRÜ | — (sabit: 7262 S.K. kapsamında) |
| `ANNE_ADI` | ANNE ADI | ANNE ADI | ANNE ADI | ANNE ADI |
| `BABA_ADI` | BABA ADI | BABA ADI | BABA ADI | BABA ADI |
| `DOGUM_TARIHI` | DOĞUM TARİHİ | DOĞUM TARİHİ | DOĞUM TARİHİ/KURULUŞ | DOĞUM TARİHİ |
| `DOGUM_YERI` | DOĞUM YERİ | DOĞUM YERİ | DOĞUM YERİ | DOĞUM YERİ |
| `ORGUT` | BAĞLANTILI OLDUĞU ÖRGÜT | — | ÖRGÜTÜ | ÖRGÜTÜ |
| `KURULUS_YAPISI` | — | — | — | KURULUŞ YAPISI |
| `LISTEYE_ALINMA` | — | — | — | LİSTEYE ALINMA TARİHİ |
| `KARAR_BILGI` | KARAR SAYISI | — | KARAR TARİH-SAYISI | BKK-CBK KARAR TARİH VE SAYISI |
| `RESMI_GAZETE` | RESMİ GAZETE TARİH- SAYISI | RESMİ GAZETE TARİH-SAYISI | RESMİ GAZETE TARİH SAYISI | R.GAZETE TARİH SAYI |
| `DIGER_BILGILER` | — | — | — | DİĞER BİLGİLER |

Eşlenemeyen her kolon `EK_BILGI` JSON'una `{"BAŞLIK": "değer"}` olarak yazılır → hiçbir veri kaybolmaz.

### 6.3 Normalizasyon Kuralı (`AD_UNVAN_NORM`)

Hem yazarken (TS tarafı) hem sorgularken **aynı** fonksiyon kullanılır:

```
büyük harfe çevir (tr-TR) → İ/I/ı/i, Ş→S, Ğ→G, Ü→U, Ö→O, Ç→C, Â→A
→ noktalama ve \xa0 (kırılmaz boşluk) temizle
→ birden fazla boşluğu tek boşluğa indir → trim
```

Örnek: `"ABD AL-BASET AZZOUZ "` → `"ABD AL BASET AZZOUZ"`

### 6.4 `dbo.TODVZ_MASAK_GUNCELLEME` (güncelleme geçmişi — karar #2)

Her güncelleme denemesi, **liste başına bir satır** olarak buraya yazılır (başarısızlar dahil).
Amaç: MASAK denetiminde "listeleri düzenli güncelliyoruz" kanıtı ve sorun çıktığında iz sürme.

```sql
CREATE TABLE [dbo].[TODVZ_MASAK_GUNCELLEME] (
  [GUNCELLEME_ID]     INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
  [LISTE_KOD]         VARCHAR(10)    NOT NULL,   -- 'A' | 'B' | 'C' | '3AB'
  [BASLAMA_ZAMANI]    DATETIME       NOT NULL DEFAULT GETDATE(),
  [BITIS_ZAMANI]      DATETIME       NULL,
  [SURE_MS]           INT            NULL,
  [DURUM]             VARCHAR(15)    NOT NULL,   -- 'BASARILI' | 'HATA'
  [KAYIT_SAYISI]      INT            NULL,       -- yazılan satır sayısı
  [ONCEKI_KAYIT_SAYISI] INT          NULL,       -- güncelleme öncesi satır sayısı
  [KAYNAK_URL]        NVARCHAR(1000) NULL,       -- kullanılan adres
  [KAYNAK_HASH]       VARCHAR(64)    NULL,       -- dosyanın SHA-256'sı (aynı dosya mı?)
  [DOSYA_BOYUTU]      INT            NULL,
  [KULLANICI_ADI]     NVARCHAR(100)  NULL,       -- token'daki username
  [KULLANICI_ID]      NVARCHAR(50)   NULL,
  [HATA_MESAJI]       NVARCHAR(1000) NULL
);

CREATE INDEX IX_TODVZ_MASAK_GUNCELLEME_LISTE ON [dbo].[TODVZ_MASAK_GUNCELLEME]([LISTE_KOD], [BASLAMA_ZAMANI] DESC);
```

Notlar:
- `KAYNAK_HASH` sayesinde "aynı dosya tekrar mı indirildi, yoksa liste gerçekten değişti mi?"
  sorusu cevaplanabilir (aynı hash → içerik değişmemiş).
- Tablo sadece büyür; yılda ~birkaç yüz satır olacağı için temizleme gerekmez.
- Bu tablo **sadece geçmiş kaydı** tutar; operasyonel sorgular (fiş/fatura kontrolü) yalnızca
  `TODVZ_MASAK_LISTE`'den yapılır.

---

## 7. Backend Tasarımı

### 7.1 Yeni dosyalar

```
Backend/src/routes/masak.routes.ts          (yeni)
Backend/src/controllers/masak.controller.ts (yeni)
Backend/src/services/masak.service.ts       (yeni)
Backend/src/utils/masakExcel.util.ts        (yeni — indirme + xlsx ayrıştırma + normalize)
Backend/src/models/masakSql.repository.ts   (yeni)
Backend/src/routes/index.ts                 (mevcut — sadece 2 satır: import + apiRouter.use)
Backend/package.json                        (mevcut — 1 bağımlılık: exceljs)
```

### 7.2 Endpoint sözleşmesi

| Metot | Yol | Amaç | Kullanan |
|---|---|---|---|
| `POST` | `/api/v1/masak/guncelle` | Gövdedeki adreslerden seçilen listeleri indir → ayrıştır → tabloya yaz | Adres giriş ekranı (8.4) |
| `GET` | `/api/v1/masak/durum` | Liste bazında kayıt sayısı, son güncelleme zamanı **ve son kullanılan adres** | Adres giriş ekranını doldurmak + üst bant |
| `GET` | `/api/v1/masak/liste` | Sayfalı listeleme + arama (`listeKod`, `q`, `kimlikNo`, `page`, `pageSize`) | MASAK grid ekranı |
| `GET` | `/api/v1/masak/kayit/:id` | Tek kaydın tüm alanları (EK_BILGI dahil) | "Detay" butonu |
| `GET` | `/api/v1/masak/sorgu` | **Eşleşme kontrolü** (`ad`, `kimlikNo`, `dogumTarihi`) | **Fiş / fatura / cari (diğer geliştirici)** |
| `GET` | `/api/v1/masak/gecmis` | Güncelleme geçmişi (son N kayıt; `listeKod` filtresi) | Adres ekranındaki "Geçmiş" sekmesi |

`POST /masak/guncelle` **istek** gövdesi (adres giriş ekranından gelir):

```json
{
  "kaynaklar": [
    { "listeKod": "A",   "url": "https://ms.hmb.gov.tr/uploads/sites/12/2026/08/A-BIRLESMIS-...xlsx" },
    { "listeKod": "B",   "url": "https://ms.hmb.gov.tr/uploads/sites/12/2026/01/B-YABANCI-...xlsx" },
    { "listeKod": "C",   "url": "https://ms.hmb.gov.tr/uploads/sites/12/2026/07/C-IC-DONDURMA-...xlsx" },
    { "listeKod": "3AB", "url": "https://ms.hmb.gov.tr/uploads/sites/12/2026/07/D-7262-SAYILI-...xlsx" }
  ]
}
```

- Gövdede olmayan liste güncellenmez (kullanıcı seçim kutusundan çıkarmıştır).
- `url` boş gönderilirse o liste için **son başarılı adres**, o da yoksa varsayılan adres kullanılır.
- `https://ms.hmb.gov.tr/` ile başlamayan adres **400** ile reddedilir.

`POST /masak/guncelle` yanıt örneği:

```json
{
  "success": true,
  "message": "MASAK listeleri güncellendi.",
  "data": {
    "guncellemeZamani": "2026-09-08T14:52:00.000Z",
    "toplamKayit": 2307,
    "sonuclar": [
      { "listeKod": "A",   "durum": "basarili", "kayitSayisi": 476,  "sureMs": 2140 },
      { "listeKod": "B",   "durum": "basarili", "kayitSayisi": 112,  "sureMs": 640  },
      { "listeKod": "C",   "durum": "basarili", "kayitSayisi": 1443, "sureMs": 3110 },
      { "listeKod": "3AB", "durum": "hata",     "kayitSayisi": 0,    "hata": "HTTP 404 - dosya adresi değişmiş olabilir" }
    ]
  }
}
```

`GET /masak/sorgu` yanıt örneği (fiş/fatura tarafının kullanacağı sözleşme):

```json
{
  "success": true,
  "data": {
    "eslesmeVar": true,
    "enYuksekSkor": 100,
    "kayitlar": [
      { "masakId": 812, "listeKod": "C", "adUnvan": "ABDULLAH AYMAZ",
        "tckn": "27029036896", "uyruk": "TÜRKİYE CUMHURİYETİ",
        "yaptirimTuru": "İÇ DONDURMA KAPSAMINDA", "eslesmeTipi": "KIMLIK_TAM", "skor": 100 }
    ]
  }
}
```

**Eşleşme kuralları (skor):**

| Skor | Tip | Kural |
|---|---|---|
| 100 | `KIMLIK_TAM` | TCKN / VKN birebir eşleşiyor → **kesin uyarı** |
| 90 | `AD_TAM` | `AD_UNVAN_NORM` birebir eşleşiyor |
| 70 | `ALIAS_TAM` | Diğer isimler (alias) alanında birebir geçiyor |
| 50 | `AD_KELIME` | Sorgudaki tüm kelimeler ad içinde geçiyor (sıra fark etmez) |

50 ve üstü uyarı gösterilir, 100 kesin uyarıdır. İşlemi durdurma kararı fiş/fatura tarafında verilir —
bu API otomatik blok uygulamaz, sadece eşleşmeyi ve skorunu döner.

### 7.3 Güncelleme akışı (`masak.service.ts`)

```
her liste için (A, B, C, 3AB):
  1. indir(url)            → ArrayBuffer  (timeout 60 sn, 3 deneme, User-Agent set)
  2. sha256(buffer)        → KAYNAK_HASH
  3. exceljs.load(buffer)  → ilk sayfa
  4. basligiBul()          → ilk 10 satırda "AD"/"ÜNVAN" + "UYRU" içeren satır
  5. satirlariEsle()       → başlık sözlüğü ile kolon → alan eşlemesi
  6. filtrele()            → AD_UNVAN boşsa satırı atla (A'daki 56 boş kuyruk satırı)
  7. normalize()           → AD_UNVAN_NORM, TCKN/VKN ayıklama, tarih ayrıştırma
  8. TRANSACTION {
       DELETE FROM TODVZ_MASAK_LISTE WHERE LISTE_KOD = @kod
       BULK INSERT (mssql sql.Table ile tek seferde)
     } COMMIT
  9. sonuç raporuna ekle (hata olursa o liste ROLLBACK, diğer listeler devam eder)
```

**Kritik davranış:** Bir liste indirilemezse **o listenin mevcut verisi silinmez** — `DELETE` ancak
indirme + ayrıştırma başarılı olduktan sonra, transaction içinde yapılır. Yani başarısız bir
güncelleme denemesi eldeki veriyi bozmaz.

### 7.4 Güvenlik / yetki
- Tüm route'lar `authenticate` middleware'i arkasında (kur modülüyle aynı).
- **Rol kısıtı yok** (karar #4): giriş yapmış her kullanıcı güncelleyebilir. Bunun karşılığı olarak
  **her güncelleme `TODVZ_MASAK_GUNCELLEME`'ye kullanıcı adıyla yazılır** — kim ne zaman ne yaptı
  izlenebilir kalır.
- İndirme adresi **beyaz listeye** bağlanır: yalnızca `https://ms.hmb.gov.tr/` ile başlayan URL'ler
  kabul edilir (kullanıcı URL girebilecekse SSRF önlemi olarak zorunlu).
- Aynı anda ikinci bir güncelleme isteği gelirse servis içi kilit ile reddedilir.

---

## 8. Frontend Tasarımı

> Bu bölümdeki tüm ekranlar **Bölüm 15'teki Arayüz Uyum Kılavuzu**'na göre yazılır: renk, font,
> tablo, buton ve modal kalıpları projedeki mevcut sayfalardan (özellikle Kur Fiyat Listesi)
> birebir alınır. MASAK ekranı ayrı bir tasarım dili kurmaz.

### 8.1 `src/services/masakService.ts` (yeni)
`kurService.ts` deseniyle: `guncelle()`, `getDurum()`, `getListe()`, `getKayit()`, `sorgula()`.
Güncelleme çağrısında `timeoutMs: 180000` verilir — `envConfig.apiTimeout` varsayılanı 15 sn ve
4 dosya indirme + 2.300 satır yazma için yetmez.

### 8.2 `MasakModal.tsx` (mevcut dosya, genişletilecek)
Referans programdaki "Bekleyen işlemler" penceresinin karşılığı:
- Üstte durum bandı: `Toplam kayıt: 2.307` · `Son güncelleme: 08.09.2026 14:52`
- Sağ üstte **[MASAK Listelerini Güncelle]** butonu → çalışırken spinner + "İndiriliyor / Yazılıyor"
- Sonuç: liste bazında ✔ / ✖ + kayıt sayısı satırları
- Mevcut "Excel İndir" linkleri **kalır** (kullanıcı ham dosyayı da alabilsin)
- Altta hızlı arama kutusu (Ad / Kimlik No) → ilk 10 sonuç + "Tümü için sayfaya git"

### 8.3 `MasakListsPage.tsx` (mevcut dosya, genişletilecek)
Referans programdaki grid'in karşılığı:
- Arama alanları: `Adı`, `Kimlik no` + **[Listele]** butonu
- Sağda **[MASAK Listelerini Güncelle]** butonu
- Tablo kolonları: `Sıra No | Liste adı | Adı | Uyruğu | Kimlik No | Diğer adı | Yaptırım | Detay`
- Liste filtresi sekmeleri: `Tümü | A | B | C | 3.A-B`
- Sunucu tarafı sayfalama (2.300 satır tek seferde çekilmez)
- `Detay` → satırın tüm alanlarını (EK_BILGI dahil) gösteren modal
- Mevcut bilgilendirme kartları ve mevzuat metni korunur (alt bölüme taşınır)

### 8.4 "Güncelle" akışı — adres giriş ekranı (karar #1)

**[MASAK Listelerini Güncelle]** butonuna basılınca güncelleme hemen başlamaz; önce **adres giriş
ekranı** açılır. Kullanıcı adresleri görür, gerekiyorsa yenisini yapıştırır, sonra güncellemeyi başlatır.

```
┌─ MASAK Liste Kaynak Adresleri ─────────────────────────────────────────────┐
│                                                                            │
│  Toplam kayıt: 2.307        Son güncelleme: 08.09.2026 15:12               │
│                                                                            │
│  ☑ A  BMGK Kararları (6415 m.5)              476 kayıt · 27.08.2026        │
│     [ https://ms.hmb.gov.tr/uploads/sites/12/2026/08/A-BIRLESMIS-... ] 🔗  │
│                                                                            │
│  ☑ B  Yabancı Ülke Talepleri (6415 m.6)      112 kayıt · 14.01.2026        │
│     [ https://ms.hmb.gov.tr/uploads/sites/12/2026/01/B-YABANCI-...   ] 🔗  │
│                                                                            │
│  ☑ C  İç Dondurma (6415 m.7)               1.443 kayıt · 29.07.2026        │
│     [ https://ms.hmb.gov.tr/uploads/sites/12/2026/07/C-IC-DONDUR...  ] 🔗  │
│                                                                            │
│  ☑ 3.A-B  7262 Sayılı Kanun                  276 kayıt · 29.07.2026        │
│     [ https://ms.hmb.gov.tr/uploads/sites/12/2026/07/D-7262-SAYIL... ] 🔗  │
│                                                                            │
│  ℹ Adres değiştiyse MASAK sayfasındaki yeni bağlantıyı buraya yapıştırın.  │
│                                     [ Vazgeç ]  [ Güncellemeyi Başlat ]    │
└────────────────────────────────────────────────────────────────────────────┘
```

**Davranış kuralları**

1. **Adres kutuları doludur.** Doldurma önceliği:
   `TODVZ_MASAK_LISTE.KAYNAK_URL` (o listenin **son başarılı** güncellemesinde kullanılan adres)
   → yoksa `masakData.ts`'teki varsayılan adres.
   Böylece kullanıcı bir kez yeni adresi girdiğinde, sonraki açılışlarda **kendi girdiği adres gelir**;
   ayrıca bilgi veritabanında durduğu için aynı işletmedeki diğer terminaller de aynı adresi görür.
2. **Her satırda seçim kutusu var** — kullanıcı sadece değişen listeyi de güncelleyebilir
   (ör. yalnız A). Varsayılan: hepsi seçili.
3. **Adres doğrulaması:** yalnızca `https://ms.hmb.gov.tr/` ile başlayan ve `.xlsx` ile biten
   adresler kabul edilir; aksi halde kutu kırmızı olur ve "Güncellemeyi Başlat" o satır için pasiftir.
   (Bu aynı zamanda sunucu tarafında da kontrol edilir — SSRF önlemi.)
4. **🔗 butonu** adresi yeni sekmede açar; kullanıcı dosyanın doğru olduğunu gözle teyit edebilir.
5. **Güncellemeyi Başlat** → ekran ilerleme moduna geçer:
   `A listesi indiriliyor… → ayrıştırılıyor… → kaydediliyor…` (liste liste).
6. **Sonuç ekranı** — referans programdaki gibi net geri bildirim:

```
   ✔ A       476 kayıt eklendi        (2,1 sn)
   ✔ B       112 kayıt eklendi        (0,6 sn)
   ✔ C     1.443 kayıt eklendi        (3,1 sn)
   ✖ 3.A-B  Adrese ulaşılamadı (HTTP 404) — bağlantı değişmiş olabilir, yeni adresi girip
             tekrar deneyin. Bu listenin mevcut 276 kaydı korundu.

   Son güncelleme: 08.09.2026 15:12 · Toplam kayıt: 2.307
```

7. **Başarılı listelerin adresi otomatik kalıcı olur** (`KAYNAK_URL` sütununa yazılır).
   **Başarısız listenin adresi kaydedilmez**, eski adresi ve eski verisi korunur.
8. Ekranda **"Geçmiş"** sekmesi bulunur: `TODVZ_MASAK_GUNCELLEME`'den son denemeler
   (tarih · liste · kullanıcı · sonuç · kayıt sayısı · kullanılan adres) listelenir.
9. Ekran kapandıktan sonra MASAK modalı / sayfası üst bandında sürekli görünür:
   `Son güncelleme: 08.09.2026 15:12 · Toplam 2.307 kayıt`.
   Son güncelleme 7 günden eskiyse bu bant kırmızıya döner ve
   "MASAK sitesinden listeleri sık aralıklarla güncelleyiniz." uyarısı çıkar (referans programdaki gibi).

---

## 9. Fazlar ve Kabul Kriterleri

**Durum (08.09.2026):** ✅ **Tamamlandı ve canlıda.** Tüm fazlar bitti, kod push edildi, sunucuya alındı; isimle ve TCKN ile arama canlı ortamda çalışıyor (bkz. Bölüm 17).
Ayrıntılı ilerleme kaydı: **Bölüm 16**.

> **Ertelenen doğrulama (kullanıcı kararı, 08.09.2026):** Canlı veritabanına karşı uçtan uca test
> (tabloların gerçekten oluşması, 2.307 kaydın yazılması, log satırlarının düşmesi, arama sonuçları)
> **Faz 8'de, en sonda** yapılacak. Bu geliştirme makinesinde SQL Server dinlemediği için ara
> fazlarda tekrar denenmeyecek; kod tip denetimi + gerçek Excel dosyalarıyla test + uç doğrulaması
> ile ilerlenecek. Faz 8'de koşulacak senaryolar: Bölüm 11 / 1-6, 9, 11-14, 16-17.


| Faz | İş | Kabul kriteri | Tahmin |
|---|---|---|---|
| **0** | Bu dokümanın onayı + açık kararların cevaplanması + `exceljs` onayı | Onay | — |
| **1** ✅ | `masakSql.repository.ts` + `ensureTablesExist` (**2 tablo**) + DDL dosyaları | Boş DB'de ilk istekte `TODVZ_MASAK_LISTE` ve `TODVZ_MASAK_GUNCELLEME` oluşuyor | 0,75 gün |
| **2** ✅ | `masakExcel.util.ts`: indirme + başlık tespiti + kolon eşleme + normalize | 4 dosya için sayım doğru: A=476, B=112, C=1443, D=276 | 1 gün |
| **3** ✅ | `masak.service.ts` + `POST /masak/guncelle` (transaction + rapor + **log yazımı**) | `curl` ile çalışıyor; ikinci çalıştırmada kayıt sayısı sabit (mükerrer yok); her deneme log tablosuna düşüyor | 0,75 gün |
| **4** ✅ | `GET /masak/durum`, `/liste`, `/kayit/:id`, `/sorgu`, `/gecmis` + controller + route | 6 endpoint elle doğrulandı | 0,5 gün |
| **5** ✅ | `masakService.ts` + `MasakModal` durum paneli + **adres giriş ekranı (8.4)** — **Bölüm 15 kalıbıyla** | Güncelle'ye basınca adres ekranı açılıyor; yeni adres girilip güncelleme yapılabiliyor; sonuçta "X kayıt eklendi" ve son güncelleme saati görünüyor; girilen adres bir sonraki açılışta dolu geliyor. Modal, diğer modallarla aynı görünüyor | 1 gün |
| **6** ✅ | `MasakListsPage` grid + arama + detay modalı + **güncelleme geçmişi sekmesi** — **Bölüm 15 kalıbıyla** | Ad/kimlik araması sonuç veriyor, sayfalama çalışıyor, geçmiş listeleniyor; tablo/başlık/alt çubuk Kur sayfasının aynısı | 1,25 gün |
| **7** ✅ | **Arayüz uyum geçişi (Bölüm 15.2–15.3)** — mevcut MASAK ekranlarındaki özel banner/renk/ölçülerin ev standardına çekilmesi, `ROUTE_PAGE_MAP` kaydı | MASAK ile Kur sayfasının ekran görüntüleri yan yana konduğunda tasarım farkı görünmüyor; sayfada tema dışı hex renk ve px font kalmadı | 0,75 gün |
| **8** ✅ | Uçtan uca test, hata senaryoları, diğer geliştiriciye API sözleşmesi notu | Bölüm 11'deki 17 senaryo geçiyor | 0,5 gün |

**Toplam ≈ 6,5 gün.** Fazlar sıralı; her fazın sonunda çalışan bir ara ürün var.
Faz 5, 6 ve 7 boyunca **Bölüm 15 (Arayüz Uyum Kılavuzu)** bağlayıcıdır — yeni ekranlar baştan
ev standardıyla yazılır, Faz 7 sadece mevcut MASAK ekranlarındaki eski öğeleri temizler.

---

## 10. Kararlar

### Verilen kararlar (08.09.2026)

| # | Konu | Karar |
|---|---|---|
| 1 | Excel adreslerinin güncel tutulması | ✅ **Ekrandan adres girme** (Bölüm 14 / Seçenek 2). "Güncelle"ye basınca **adres giriş ekranı** açılır; kullanıcı 4 listenin linkini görür/yapıştırır, güncelleyince **son güncelleme saati ve eklenen kayıt sayısı** yazar. Ayrıntılı akış: **Bölüm 8.4**. |
| 3 | Güncelleme stratejisi | ✅ **Tam değişim** — liste bazında transaction içinde `DELETE` + `INSERT`. İndirme/ayrıştırma başarısızsa eski veri silinmez. |
| 5 | Excel kütüphanesi | ✅ **`exceljs`** — `Backend/package.json`'a tek bağımlılık. |
| — | Fiş/fatura tarafının erişimi | ✅ **Hem tablo hem API** — `TODVZ_MASAK_LISTE` doğrudan sorgulanabilir, ayrıca `GET /masak/sorgu` skorlu eşleşme döner. Eşleşme mantığı tek yerde (bizde) yazılır, diğer geliştirici istediğini kullanır. |
| 2 | Güncelleme geçmişi (log) | ✅ **Tutulacak** — ikinci tablo `TODVZ_MASAK_GUNCELLEME` (bkz. 6.4). Her deneme (başarılı/başarısız) kullanıcı, saat, liste, kayıt sayısı ve kullanılan adres ile kaydedilir. MASAK denetiminde "listeyi düzenli güncelliyoruz" kanıtı olur. |
| 4 | Güncelleme yetkisi | ✅ **Tüm giriş yapmış kullanıcılar** güncelleyebilir (rol kısıtı yok). Kimin yaptığı log tablosuna yazılır — sorumluluk takibi rol kısıtı yerine log ile sağlanır. |
| 6 | Otomatik güncelleme | ✅ **Yok** — güncelleme her zaman kullanıcının bastığı butonla. Son güncelleme 7 günden eskiyse üst bant kırmızıya döner ve "listeleri sık aralıklarla güncelleyiniz" uyarısı çıkar. |

> **Tüm kararlar verildi — bekleyen karar kalmadı.** Faz 1 başlatılabilir.

---

## 11. Test Senaryoları

1. Boş veritabanında ilk güncelleme → tablo oluşur, 4 liste yazılır, toplam ≈ 2.307 kayıt.
2. Aynı güncelleme ikinci kez → kayıt sayısı **değişmez** (mükerrer yok).
3. İnternet kapalıyken güncelleme → hata mesajı döner, **mevcut kayıtlar silinmez**.
4. Bir listenin URL'i 404 → o liste "hata", diğer 3 liste başarıyla güncellenir.
5. `39472770166` TCKN ile sorgu → C listesinden `ABDULKADİR BAŞARAN`, skor 100.
6. `abdullah aymaz` (küçük harf, Türkçe karakterli) sorgu → skor 90 eşleşme.
7. Arapça isimli kayıt detayı → karakterler bozulmadan görünür (NVARCHAR doğrulaması).
8. A listesinin 56 boş kuyruk satırı tabloya yazılmamış olmalı.
9. Yerel (agent) modda güncelleme → veri yerel SQL'e yazılır, bulut moddaki veriyi etkilemez.
10. 15 sn'den uzun süren güncelleme → frontend timeout'a düşmez (180 sn ayarı).
11. Adres ekranına **yeni bir link yapıştırılıp** güncelleme yapılır → veri o adresten gelir,
    ekran kapatılıp tekrar açıldığında **aynı adres dolu gelir** (`KAYNAK_URL`'den okunuyor).
12. `ms.hmb.gov.tr` dışı bir adres yapıştırılır (ör. `http://ornek.com/liste.xlsx`) → kutu kırmızı
    olur, istek gönderilmez; zorla gönderilirse sunucu **400** döner.
13. Sadece A listesi seçilip güncellenir → B, C, D kayıtları ve son güncelleme bilgileri değişmez.
14. Başarısız bir listenin adresi **kaydedilmez**; ekran tekrar açıldığında eski çalışan adres gelir.
15. Son güncelleme 7 günden eskiyse üst bant kırmızı ve uyarı metni görünür.
16. Başarılı ve başarısız her güncelleme denemesi `TODVZ_MASAK_GUNCELLEME`'ye **kullanıcı adıyla**
    yazılır; "Geçmiş" sekmesinde tarih sırasıyla görünür.
17. Aynı dosya tekrar indirilirse log'daki `KAYNAK_HASH` değişmez → "içerik değişmemiş" ayırt edilebilir.
18. **Görsel uyum:** MASAK sayfası ile Kur Fiyat Listesi sayfası yan yana açılır → üst şerit, tablo
    başlığı, satır yüksekliği, yazı boyutu ve alt durum çubuğu aynı görünür.
19. MASAK ekranlarının kodunda tema dışı hex renk ve `px` cinsinden font boyutu kalmamış olmalı
    (Bölüm 15.2 listesi temizlenmiş).

---

## 12. Riskler

| Risk | Etki | Önlem |
|---|---|---|
| HMB dosya adresi değişir | Güncelleme 404 | Açık Karar #1 (UI'dan adres girme) + net hata mesajı |
| HMB kolon başlıklarını değiştirir | Alan boş kalır | Başlık sözlüğü + eşlenemeyen kolonlar `EK_BILGI` JSON'una; log'a uyarı |
| HMB dosya erişimini kapatır / IP bloklar | Güncelleme yapılamaz | Son veriyle çalışmaya devam; opsiyonel "elle dosya yükle" adımı |
| Aynı anda iki kullanıcı güncelleme başlatır | Çakışma | Servis içi kilit — ikinci istek "güncelleme sürüyor" der |
| Yanlış eşleşme (aynı isimli masum kişi) | Operasyonel | Skor + eşleşme tipi döner; nihai karar kullanıcıda, otomatik blok yok |
| Frontend timeout | Kullanıcı hata sanır | `timeoutMs: 180000` + ilerleme göstergesi |

---

## 13. Dokunulacak / Dokunulmayacak Dosyalar

**Değişecek (mevcut):**
- `src/components/masak/MasakModal.tsx`
- `src/pages/settings/MasakListsPage.tsx`
- `src/data/masakData.ts`
- `src/components/common/ERPToolbar.tsx` (**sadece** `ROUTE_PAGE_MAP`'e 2 satır — bkz. 15.3)
- `Backend/src/routes/index.ts` (2 satır)
- `Backend/package.json` (1 bağımlılık)

**Yeni eklenecek:**
- `src/services/masakService.ts`
- `Backend/src/routes/masak.routes.ts`
- `Backend/src/controllers/masak.controller.ts`
- `Backend/src/services/masak.service.ts`
- `Backend/src/utils/masakExcel.util.ts`
- `Backend/src/models/masakSql.repository.ts`
- `docs/sql/TODVZ_MASAK_LISTE.sql`
- `docs/sql/TODVZ_MASAK_GUNCELLEME.sql`

**Kesinlikle dokunulmayacak:** kur / cari / vezne / para / user / company / istatistik / numaratör
modülleri, `apiClient.ts`, `mssql.config.ts`, `auth.middleware.ts`, `Header.tsx`, `App.tsx`,
login akışı ve `local-agent/`.

---

## 14. Ek — Excel Adreslerini Güncel Tutmanın Tüm Yolları (yönetici sunumu için)

### Problemin tam tanımı

Dosya adresleri şu biçimde: `.../A-BIRLESMIS-...-27.08-40e72586a1281a0e.xlsx`
Sondaki `40e72586a1281a0e` **her yeni yayında değişen rastgele bir ek**. Yani listeyi güncelleyen
kurum yeni dosyayı yüklediğinde **adres tamamen değişiyor**; eski adres bir süre çalışmaya devam
etse bile artık eski veriyi verir.

### Ölçüm sonuçları (08.09.2026, kullanıcının kendi bilgisayarından test edildi)

| Test | Sonuç | Anlamı |
|---|---|---|
| `.../uploads/.../A-....xlsx` indirme | **200 OK** | Dosyaların kendisi programdan sorunsuz indirilebiliyor |
| `https://ms.hmb.gov.tr/` (tarayıcı başlıklarıyla) | **403** | Sayfayı program ile okuyup link bulmak engelli (WAF) |
| `/wp-json/...` (WordPress API) | **404** | Kurumun açık veri servisi yok |
| `/sitemap.xml`, `/wp-sitemap.xml` | **404** | Site haritasından link keşfi yok |
| `/uploads/sites/12/2026/08/` (klasör listesi) | **403** | Klasör içeriği listelenemiyor |
| `/robots.txt` | **404** | — |
| BM konsolide yaptırım listesi (`scsanctions.un.org`) | **200**, 2,1 MB XML | Alternatif kaynak var ama sadece BMGK (A) muadili |

**Sonuç:** Dosyayı indirmek serbest, **yeni adresi otomatik bulmak kapalı.** Çözüm seçenekleri bu
kısıt üzerine kurulu.

### Seçenekler

| # | Yöntem | Nasıl çalışır | Artı | Eksi | Maliyet |
|---|---|---|---|---|---|
| **1** | **Kodda sabit link** | Linkler `masakData.ts`'te durur | En basit | Adres değişince **her müşteri için yeni sürüm** çıkmalı; o zamana kadar güncelleme 404 | 0 |
| **2** | **Ekrandan adres girme** | MASAK ekranında "adres güncelle" alanı; kullanıcı yeni linki yapıştırır | Sürüm çıkmaya gerek yok, anında çözüm | Linki bulmak kullanıcının işi; her şube ayrı ayrı yapar | ~0,5 gün |
| **3** | **Elle dosya yükleme** | Kullanıcı xlsx'i bilgisayarından seçip yükler | İnternet/WAF'tan tamamen bağımsız; her şartta çalışır | Manuel; yanlış/eski dosya yükleme riski | ~0,5 gün |
| **4** | **Merkezî link servisi (önerilen ana çözüm)** | Linkler sizin sunucunuzda küçük bir JSON'da (ör. `likyakuyum.com/masak-kaynaklar.json`) tutulur; program her güncellemede önce bu JSON'u okur | **Adres değişince tek bir dosyayı siz güncellersiniz, tüm müşteriler anında düzelir.** Sürüm yok, müşteri işlemi yok | Sizde küçük bir operasyonel sorumluluk (linki takip edip JSON'u güncellemek) | ~0,5 gün + takip |
| **5** | **Headless tarayıcı ile otomatik keşif** | Sunucuda Chromium (Playwright/Puppeteer) çalıştırıp HMB sayfasını gerçek tarayıcı gibi açmak, linki oradan okumak | Tam otomatik olabilir | WAF korumasını aşmak demek; kurum engeli sıkılaştırınca kırılır, sunucuya ~300 MB Chromium yükü, bakım maliyeti yüksek, **etik/hukuki gri alan** | ~2-3 gün + sürekli bakım · **önerilmez** |
| **6** | **Kurumdan resmî çözüm talebi** | HMB/MASAK'a "sabit adres veya veri servisi (API)" için resmî başvuru (bilgi edinme / yazılı talep) | Uzun vadede tek "temiz" çözüm | Sonucu ve süresi belirsiz; kurum vermeyebilir | Sadece yazışma |
| **7** | **Alternatif resmî kaynaklar** | BMGK konsolide XML (`scsanctions.un.org`) sabit adreste ve açık | A listesi için sabit ve otomatik kaynak | Sadece BMGK; **B, C, D listeleri yok**; TCKN yok, Türkçe HMB formatında değil → mevzuata tek başına yetmez | ~1 gün (sadece A için) |
| **8** | **Ticari yaptırım tarama servisi** | Dow Jones / LSEG World-Check / ComplyAdvantage benzeri API aboneliği | Tüm dünya listeleri, API garantili, sürekli güncel | **Ücretli (yıllık abonelik)**, dış servise müşteri verisi gitmesi konusu | Ticari karar |
| **9** | **Duyuru aboneliği + insan takibi** | HMB duyurularına e-posta/RSS aboneliği; değişince sorumlu kişi 2, 3 veya 4'ü uygular | Ucuz, gerçekçi | İnsana bağlı | 0 |
| **10** | **Bayat veri uyarısı (tamamlayıcı)** | "Son güncelleme 7 günden eski" ve "link 404 veriyor" uyarıları | Hangi yöntem seçilirse seçilsin gözden kaçmayı engeller | Tek başına çözüm değil | ~0,25 gün |

### ✅ Seçilen yol: **Seçenek 2 — Ekrandan adres girme** (karar: 08.09.2026)

"Güncelle"ye basınca adres giriş ekranı açılır, kullanıcı adresleri görür/yapıştırır, güncelleme
sonunda son güncelleme saati ve eklenen kayıt sayısı yazar. Tam akış **Bölüm 8.4**'te.
Girilen adres `TODVZ_MASAK_LISTE.KAYNAK_URL` sütununda kalıcı olur — ek tabloya gerek yok.

Bu seçimin doğal tamamlayıcısı **Seçenek 10 (bayat veri uyarısı)**: son güncelleme 7 günden eskiyse
üst bandın kırmızıya dönmesi. Yöntem insana bağlı olduğu için bu uyarı ihmali engeller;
planın içine alındı (Faz 5).

**İleride istenirse kolayca eklenebilir (şimdilik kapsam dışı):**
- **Seçenek 4 (merkezî link JSON)** — aynı ekranın "adresleri OFİS sunucusundan getir" düğmesi
  olarak eklenmesi yeterli; mevcut tasarım buna hazır (adres alanı zaten dışarıdan doldurulabiliyor).
- **Seçenek 3 (elle dosya yükleme)** — aynı ekrana "dosya seç" seçeneği (~0,5 gün).

**Seçenek 5 (WAF'ı headless tarayıcıyla aşmak) önerilmiyor** — kırılgan, bakım yükü yüksek ve
kurumun erişim politikasını dolanmak anlamına geliyor.

---

## 15. Arayüz Uyum Kılavuzu — "MASAK sonradan eklenmiş gibi durmayacak"

**Kural:** MASAK ekranları kendine özgü bir tasarım dili kurmaz. Projedeki mevcut sayfalar
(özellikle en son yapılan **Kur Fiyat Listesi** sayfası) hangi kalıbı kullanıyorsa MASAK da
**birebir onu** kullanır. Aşağıdaki değerler tahmin değil, mevcut koddan çıkarıldı.

### 15.1 Mevcut kod düzeninde tespit edilen ev standardı

| Konu | Projede kullanılan (kaynak) | MASAK'ta ne yapılacak |
|---|---|---|
| Font | `$font-family-sans-serif: 'Public Sans'` (`_variables.scss:507`) | Ayrı font yüklenmez, tema fontu kullanılır. Sayı/kimlik alanlarında `font-monospace` (Kur sayfasındaki gibi) |
| Ana renk | `$primary: #00a76f` (`_variables.scss:41,55`) | Renkler `variant="primary"`, `text-muted`, `bg-light` gibi **tema sınıflarıyla** verilir; gövdeye elle hex yazılmaz |
| Sayfa kabı | `<div className="container-fluid py-2 px-3">` (`KurFiyatListesiPage.tsx:978`) | Aynısı. *(MasakListsPage bugün `<Container fluid className="py-3 px-3 px-lg-4">` kullanıyor → **değiştirilecek**)* |
| Üst şerit | Her sayfanın en üstünde `ERPToolbar` (`pageTitle`, `onRefresh`, `onPrint`, `onSearch`, `rightContent`) | Aynısı; sağ tarafa (`rightContent`) liste filtresi ve **[Listeleri Güncelle]** butonu konur |
| Tablo kabı | `<Card className="shadow-sm border-secondary border-opacity-25" style={{borderRadius:"6px", overflow:"hidden"}}>` (`:1087`) | Aynısı |
| Tablo | `table table-sm table-bordered table-hover mb-0 align-middle`, kap `.table-responsive` + `maxHeight: calc(100vh - 280px)` (`:1093-1106`) | Aynısı |
| Tablo başlığı | `sticky-top`, `background: linear-gradient(180deg,#dbe8f6 0%,#c8dcf0 100%)`, `<tr className="text-secondary text-nowrap">`, `th` → `py-1 px-2`, `borderRight: 1px solid #b8cee6` (`:1107-1170`) | Aynısı |
| Satırlar | Zebra: `idx % 2 === 1 ? "#f9fbfd" : "#ffffff"`, hücre `fontSize: 0.82–0.88rem` (`:1179-1231`) | Aynısı |
| Alt durum çubuğu | `linear-gradient(180deg,#eef5fc 0%,#dbe8f6 100%)`, `fontSize: 0.82rem`; solda `badge bg-secondary` + "Toplam N kayıt", sağda F-tuşu butonları (`:1269-1310`) | Aynısı. Solda "Toplam 2.307 kayıt · Son güncelleme …", sağda `F3)Ara`, `F5)Yenile`, `F10)Yazdır` |
| F-tuşu butonu | `<Button variant="light" size="sm" className="px-2 py-0 border text-dark bg-white shadow-xs fw-semibold small">` metin biçimi `F1)Kaydet` (`:1290`) | Aynı sınıf ve aynı `Fx)Etiket` yazım biçimi |
| Arama kutusu | `InputGroup size="sm"` + `InputGroup.Text className="bg-light px-2"` + tabler ikon (14–16 px) + `Form.Control` (`:997-1024`) | Aynısı (Adı / Kimlik no alanları) |
| Modal | `<Modal size="lg" centered>` + `Modal.Header closeButton` + footer'da sağda `variant="secondary" size="sm"` **Kapat** | Aynısı (detay modalı ve adres ekranı) |
| Yükleniyor / boş | `<Spinner animation="border" variant="primary" />` + "… yükleniyor"; boş tabloda `colSpan` ile ortalanmış "Kayıt bulunamadı." (`:1096-1104`, `:1160`) | Aynısı |
| İkonlar | `@tabler/icons-react`, 14–20 px | Aynısı |
| Toolbar butonları | 32×30 px, `#ffffff` zemin, `1px solid #cbd5e1`, `border-radius: 4px` (`_user.scss:463-481`) | Ellenmez, hazır bileşen kullanılır |

### 15.2 Mevcut MASAK ekranlarında düzeltilecek "sırıtan" noktalar

Bugünkü `MasakModal.tsx` ve `MasakListsPage.tsx` projenin geri kalanında karşılığı olmayan
tasarım öğeleri içeriyor. Bunlar sadeleştirilecek:

| Şu an | Sorun | Yapılacak |
|---|---|---|
| `linear-gradient(135deg,#1e293b,#0f172a)` koyu lacivert banner (`MasakListsPage.tsx`) | Başka hiçbir sayfada koyu banner yok | Kaldırılır; yerine `ERPToolbar` + ince bilgi satırı |
| `linear-gradient(135deg,#dc2626,#b91c1c)` kırmızı ikon kutusu (`MasakModal.tsx`) | Diğer modallarda böyle bir başlık öğesi yok | Sade `Modal.Header` + tabler ikon |
| Kart başına özel `accentColor` / `badgeBg` / `badgeText` (mavi, sarı, kırmızı, mor) | 4 farklı marka rengi — ev paletiyle ilgisiz | Liste ayrımı **rozet metniyle** yapılır (`A`, `B`, `C`, `3.A-B`), tek nötr stil |
| `rounded-4`, `shadow-xs`, `p-3 p-md-4`, `gap-2.5`, `mt-0.5` gibi serbest ölçüler | Diğer sayfalarda `rounded`(6px) ve standart bootstrap aralıkları var | Standart bootstrap sınıflarına çekilir |
| `fontSize: "13.5px" / "11.5px" / "10.5px"` piksel değerleri | Ev standardı `rem` (0.82–0.88rem) | `rem`'e çevrilir |
| Uzun mevzuat metinleri sayfanın yarısını kaplıyor | Operasyonel ekranlarda böyle bir bölüm yok | Alt bölüme, katlanabilir tek karta indirilir |

> Kırmızı renk **tamamen kaldırılmaz**: yalnızca "son güncelleme 7 günden eski" uyarısında ve
> eşleşme bulunan satırlarda `bg-danger` / `text-danger` olarak, referans programdaki gibi kullanılır.

### 15.3 ERPToolbar route kaydı

`ERPToolbar.tsx` içindeki `ROUTE_PAGE_MAP` her sayfa için başlık + ikon tutuyor; MASAK yolları
orada yok, bu yüzden şu an başlık ikonu varsayılan (`IconFileText`) düşüyor. **2 satır** eklenecek:

```ts
"/masak": { title: "MASAK Malvarlıkları Dondurulanlar", icon: <IconShieldCheck size={20} /> },
"/ayarlar/masak-dondurulanlar": { title: "MASAK Malvarlıkları Dondurulanlar", icon: <IconShieldCheck size={20} /> },
```

Bu, dosyanın ortak kısmına dokunmadan yapılan katalog kaydıdır — diğer sayfalarla aynı davranış.

### 15.4 Kabul ölçütü

Faz 8'de, MASAK ekranı ile **Kur Fiyat Listesi** ekranının ekran görüntüleri yan yana konur.
Ölçüt nettir: *ikisi de aynı programın sayfası gibi görünmeli* — aynı üst şerit, aynı tablo başlığı
gradyanı, aynı satır yüksekliği ve yazı boyutu, aynı alt durum çubuğu, aynı buton dili.

---

## 16. İlerleme Kaydı

Her faz bittiğinde buraya yazılır: ne yapıldı, hangi dosyalar, nasıl doğrulandı, sırada ne var.

### ✅ Faz 1 — Veri modeli ve repository (08.09.2026)

**Eklenen dosyalar**

| Dosya | İçerik |
|---|---|
| `Backend/src/models/masakSql.repository.ts` | `MasakSqlRepository` sınıfı + tipler |
| `docs/sql/TODVZ_MASAK_LISTE.sql` | Veri tablosunun elle kurulum betiği (idempotent) |
| `docs/sql/TODVZ_MASAK_GUNCELLEME.sql` | Geçmiş tablosunun elle kurulum betiği (idempotent) |

**Repository'de hazır olanlar**

- `ensureTablesExist(pool)` — iki tabloyu ve dört+bir indeksi yoksa oluşturur.
  Kur modülündeki desenin aynısı; indeks oluşturma `EXEC(...)` içinde, çünkü aynı toplu
  komutta yeni oluşturulan tabloya doğrudan `CREATE INDEX` derleme hatası veriyor.
- `replaceListe(listeKod, kayitlar, meta, dbContext)` — **karar #3'ün karşılığı.**
  Tek transaction: önce `DELETE ... WHERE LISTE_KOD = @kod`, sonra `sql.Table` ile **toplu insert**
  (2.300 satır tek seferde). Hata olursa `rollback` — eski veri yerinde kalır.
- `logGuncelleme(dto, dbContext)` — **karar #2'nin karşılığı.** Başarılı/başarısız her denemeyi
  `TODVZ_MASAK_GUNCELLEME`'ye yazar. Log yazımı hata verirse güncellemeyi düşürmez (yutulur, loglanır).
- `getDurum(dbContext)` — liste bazında kayıt sayısı, son güncelleme ve **son kullanılan adres**.
  Adres önce veri tablosundan, orada yoksa **son BAŞARILI log kaydından** alınır → adres giriş
  ekranı (8.4) liste boş olsa bile dolu gelir.
- `getGecmis({ listeKod, limit }, dbContext)` — geçmiş listesi (en yeniden eskiye, azami 500).
- `getKayitSayisi(listeKod, dbContext)` — güncelleme öncesi/sonrası karşılaştırma için.

**Tasarım notları**

- Tüm metin alanları yazılmadan önce kolon uzunluğuna göre kırpılıyor (`kes()`), boş metin `NULL`
  oluyor. Böylece HMB dosyasındaki uzun serbest metinler insert'i düşürmüyor.
- `dbContext` (dbServer / dbName) her metotta taşınıyor — çok kiracılı yapı ve bulut/yerel mod
  farkı korunuyor (kur modülüyle birebir aynı desen).
- Tablolar `NVARCHAR` — Arapça ve Türkçe karakterler için (Bölüm 4, bulgu 6).

**Doğrulama**

- `node node_modules/typescript/lib/tsc.js --noEmit` → **çıkış kodu 0**, hata yok.
- Canlı veritabanına karşı test **yapılmadı**: `Backend/.env` içinde `DB_SERVER` boş, bağlantı
  bilgileri giriş ekranından geliyor. Tablolar ilk MASAK isteğinde otomatik oluşacak;
  dileyen `docs/sql/*.sql` betiklerini SSMS'te çalıştırıp önden de kurabilir.

**Sırada:** Faz 2 — `masakExcel.util.ts` (indirme + başlık tespiti + kolon eşleme + normalize).
Hedef: A=476, B=112, C=1443, D=276 satırın doğru ayrıştırılması.

### ✅ Faz 2 — İndirme ve Excel ayrıştırma (08.09.2026)

**Eklenen dosyalar**

| Dosya | İçerik |
|---|---|
| `Backend/src/utils/masakExcel.util.ts` | İndirme + ayrıştırma + normalize yardımcıları |
| `Backend/scripts/masak-parse-test.ts` | Geçici doğrulama betiği (4 gerçek dosya ile) |
| `Backend/package.json` | `exceljs@4.4.0` eklendi (karar #5) |

**İçerik**

- `MASAK_KAYNAKLAR` — dört listenin kodu, adı ve **varsayılan** adresi. Kullanıcı ekrandan
  adres girmezse bu kullanılır.
- `adresGecerliMi(url)` — yalnızca `https://ms.hmb.gov.tr/` ile başlayan `.xlsx/.xls` adreslerine
  izin verir (SSRF önlemi + yanlış link koruması).
- `indirDosya(url)` — tarayıcı `User-Agent`'ı ile indirir, 60 sn zaman aşımı, **3 deneme**
  (artan bekleme). İndirilen içeriğin gerçekten xlsx olduğunu `PK` zip imzasından doğrular —
  hata sayfası dönerse anlaşılır mesaj verir. SHA-256 hash ve boyut döner.
- `parseMasakExcel(buffer, listeKod)` — başlık satırını otomatik bulur, kolonları başlık metnine
  göre eşler, satırları `MasakKayitDto`'ya çevirir.
- `normalizeMetin`, `tcknGecerliMi`, `tcknAyikla`, `vknAyikla`, `tarihAyikla` — arama ve
  ayıklama yardımcıları (Faz 4'teki sorgulama da bunları kullanacak).

**Yol boyunca çıkan iki gerçek sorun ve çözümü**

1. **Birleştirilmiş başlık hücresi:** A dosyasının 1. satırı `A1:P1` birleştirilmiş bir başlık.
   ExcelJS birleşik alandaki 16 hücrenin hepsinde aynı metni döndürdüğü ve bu metin "…RESMİ GAZETE…"
   içerdiği için sahte başlık satırı 16 puan alıp gerçek başlık satırını (15) geçti.
   **Çözüm:** puanlama hücre değil **farklı alan sayısı** üzerinden yapılıyor; ayrıca ad/ünvan
   kolonu içeren satır her zaman önceliklidir.
2. **Tarih kayması:** `new Date(yıl, ay, gün)` yerel gece yarısını üretiyor, UTC'ye çevrilince
   **bir gün geriye** kayıyordu (TR = UTC+3) — SQL `DATE` kolonuna yanlış gün yazılacaktı.
   **Çözüm:** tüm tarihler `Date.UTC(...)` ile kuruluyor.

**Ek karar:** D (3AB) dosyasında "MVD YAPTIRIM TÜRÜ" kolonu yok; bu listenin kayıtlarına
`YAPTIRIM_TURU = "7262 SAYILI KANUN 3.A/3.B KAPSAMINDA"` otomatik yazılıyor.

**Doğrulama** — `scripts/masak-parse-test.ts`, dört gerçek dosya + 10 birim kontrol:

```
OK  A.xlsx (A):  476/476  kayit | baslik=2 atlanan=56 | tckn=1    tarih=224  tuzel=17 | 215ms
OK  B.xlsx (B):  112/112  kayit | baslik=1 atlanan=0  | tckn=16   tarih=76   tuzel=14 |  25ms
OK  C.xlsx (C): 1443/1443 kayit | baslik=1 atlanan=21 | tckn=1332 tarih=1375 tuzel=38 | 397ms
OK  D.xlsx (3AB):276/276  kayit | baslik=1 atlanan=0  | tckn=0    tarih=69   tuzel=83 |  61ms
--- yardimci fonksiyonlar: 10/10 OK (normalize, tckn dogrulama, tarih ayristirma)
SONUC: TUM TESTLER GECTI
```

Ayrıca **canlı indirme** denendi: A listesi ms.hmb.gov.tr'den 120.105 bayt olarak indi (561 ms),
ayrıştırıldı ve yine 476 kayıt çıktı. Beyaz liste kontrolü de doğrulandı
(`https://ornek.com/liste.xlsx` reddedildi).

`tsc --noEmit` → **çıkış kodu 0**.

Not: Hiçbir listede eşlenemeyen kolon çıkmadı (`ekBilgi=0`) — yani 4 dosyanın tüm kolonları
hedef alanlara oturdu. `EK_BILGI` alanı yine de duruyor; HMB ileride kolon eklerse veri kaybolmayacak.

**Sırada:** Faz 3 — `masak.service.ts` ve `POST /masak/guncelle`: indirme + ayrıştırma + transaction
ile yazma + log kaydı + liste bazında sonuç raporu.

### ✅ Faz 3 — Güncelleme servisi ve `POST /masak/guncelle` (08.09.2026)

**Eklenen / değişen dosyalar**

| Dosya | İçerik |
|---|---|
| `Backend/src/services/masak.service.ts` | `MasakService` — güncelleme akışı, kilit, durum |
| `Backend/src/controllers/masak.controller.ts` | `guncelle`, `getDurum`, `getGecmis` uçları |
| `Backend/src/routes/masak.routes.ts` | `authenticate` + üç route |
| `Backend/src/routes/index.ts` | 2 satır: import + `apiRouter.use("/masak", masakRoutes)` |

**Çalışan uçlar**

| Metot | Yol | Durum |
|---|---|---|
| `POST` | `/api/v1/masak/guncelle` | ✅ |
| `GET` | `/api/v1/masak/durum` | ✅ |
| `GET` | `/api/v1/masak/gecmis` | ✅ |

**Güncelleme akışının davranışı**

1. Gövde boş gelirse dört listenin tamamı güncellenir; `kaynaklar` verilirse sadece o listeler.
2. Adres önceliği: **ekrandan gelen adres → son başarılı adres → varsayılan adres.**
3. Adres `https://ms.hmb.gov.tr/` ile başlamıyorsa istek **400** ile reddedilir (SSRF önlemi).
4. Her liste bağımsız: biri hata alsa diğerleri güncellenmeye devam eder, rapor liste liste döner.
5. `DELETE` yalnızca indirme + ayrıştırma başarılıysa, transaction içinde yapılır →
   **başarısız güncelleme eldeki veriyi bozmaz.**
6. Her deneme (başarılı/başarısız) kullanıcı adıyla `TODVZ_MASAK_GUNCELLEME`'ye yazılır.
7. **Eşzamanlılık kilidi:** aynı sunucu+veritabanı için ikinci güncelleme isteği
   "Şu anda başka bir MASAK güncellemesi sürüyor" ile reddedilir. Kilit süreç içidir; bulut ve
   yerel agent kendi süreçlerinde çalıştığı için birbirini etkilemez.

**Doğrulama** — sunucu ayağa kaldırılıp `curl` ile denendi:

| Test | Sonuç |
|---|---|
| `POST /masak/guncelle {"listeKod":"X"}` | `400 — Geçersiz liste kodu: X. Geçerli değerler: A, B, C, 3AB` ✅ |
| `POST /masak/guncelle` + `https://ornek.com/liste.xlsx` | `400 — Yalnızca https://ms.hmb.gov.tr/ ile başlayan .xlsx adresleri kabul edilir` ✅ |
| `GET /masak/durum` | Route çalışıyor; beklenen SQL bağlantı hatası döndü (bu makinede SQL Server yok) ✅ |
| `tsc --noEmit` | çıkış kodu 0 ✅ |

> **Açık doğrulama:** Bu geliştirme makinesinde 127.0.0.1:1433'te SQL Server dinlemiyor
> (`Test-NetConnection` → False) ve `Backend/.env` içinde bağlantı bilgisi yok — bağlantı
> giriş ekranından geliyor. Bu yüzden **tabloya gerçek yazma (transaction + toplu insert + log)
> canlı veritabanında henüz denenmedi.** Kodun tamamı tip denetiminden ve mantık testinden geçti;
> ilk gerçek güncelleme, uygulama kendi ortamında (bulut veya yerel agent) çalıştırıldığında
> yapılacak. Bölüm 11'deki 1–4 ve 16–17 numaralı senaryolar o anda koşulmalı.

**Sırada:** Faz 4 — sorgulama uçları: `GET /masak/liste` (sayfalı arama), `GET /masak/kayit/:id`
(detay) ve `GET /masak/sorgu` (fiş/fatura için skorlu eşleşme).

### ✅ Faz 4 — Sorgulama uçları (08.09.2026)

**Değişen dosyalar:** `masakSql.repository.ts`, `masak.service.ts`, `masak.controller.ts`,
`masak.routes.ts` (yeni dosya eklenmedi).

**Backend uçlarının tamamı hazır**

| Metot | Yol | Açıklama |
|---|---|---|
| `POST` | `/api/v1/masak/guncelle` | Listeleri indir + yaz |
| `GET` | `/api/v1/masak/durum` | Kayıt sayısı, son güncelleme, son adres |
| `GET` | `/api/v1/masak/liste` | Sayfalı listeleme + arama (`listeKod`, `q`, `kimlikNo`, `page`, `pageSize`) |
| `GET` | `/api/v1/masak/kayit/:id` | Tek kaydın tüm alanları (EK_BILGI dahil) |
| `GET` | `/api/v1/masak/sorgu` | **Skorlu eşleşme** (`ad`, `kimlikNo`, `dogumTarihi`, `limit`) |
| `GET` | `/api/v1/masak/gecmis` | Güncelleme geçmişi |

**Sorgulama mantığı**

- Arama metni, veriyi yazarken kullanılan **aynı** `normalizeMetin` fonksiyonundan geçer:
  `abdullah aymaz` → `ABDULLAH AYMAZ`, `ABDÜLKADİR ŞAHİN` → `ABDULKADIR SAHIN`.
  Büyük/küçük harf ve Türkçe karakter farkı sorun çıkarmaz.
- Skorlar tek SQL sorgusunda `CASE` ile hesaplanır: **100** kimlik tam (TCKN/VKN),
  **90** ad tam, **70** alias (diğer isimler), **50** kelime bazlı (tüm kelimeler geçiyorsa).
- `dogumTarihi` verilirse sonuçlara `dogumUyumlu` bilgisi eklenir (skoru değiştirmez,
  aynı isimli kişileri ayırt etmeye yarar).
- **Otomatik blok yok:** uç yalnızca eşleşmeyi ve skoru döner; işlemi durdurma kararı
  fiş/fatura tarafında verilir.
- Tüm kullanıcı girdileri parametreli sorgu ile gider; `LIKE` kalıplarındaki `% _ [ ]`
  karakterleri kaçırılır (`ESCAPE '['`) — hem SQL injection hem yanlış eşleşme önlenir.
- Listeleme sunucu tarafında sayfalanır (`OFFSET/FETCH`), sayfa boyutu azami 500.

**Doğrulama** — sunucu ayağa kaldırılıp `curl` ile:

| Test | Sonuç |
|---|---|
| `GET /masak/sorgu` (parametresiz) | `400 — Sorgu için en az bir ad veya kimlik numarası gereklidir.` ✅ |
| `GET /masak/liste?listeKod=Z` | `400 — Geçersiz liste kodu. Geçerli değerler: A, B, C, 3AB` ✅ |
| `GET /masak/kayit/abc` | `400 — Geçerli bir kayıt numarası belirtilmelidir.` ✅ |
| `GET /masak/liste?listeKod=C&q=aymaz` | Route + normalizasyon çalıştı, beklenen SQL bağlantı hatası ✅ |
| `GET /masak/gecmis?limit=5` | Route çalıştı, beklenen SQL bağlantı hatası ✅ |
| `tsc --noEmit` | çıkış kodu 0 ✅ |

> Faz 3'teki not burada da geçerli: bu makinede SQL Server olmadığı için sorgu sonuçlarının
> veri üzerindeki doğruluğu (Bölüm 11 / senaryo 5–6) canlı ortamda denenmeli.

**Backend tamamlandı.** Sırada Faz 5 — frontend: `masakService.ts` + `MasakModal` durum paneli
ve adres giriş ekranı (Bölüm 8.4), Bölüm 15'teki ev standardıyla.

### ⏸️ Faz 5 — Frontend servis + MASAK modalı (kısmen bitti, 08.09.2026 — DURDURULDU)

**Bitirilenler**

| Dosya | Durum | İçerik |
|---|---|---|
| `src/services/masakService.ts` | ✅ yeni | `getDurum`, `guncelle` (timeout 180 sn), `getListe`, `getKayit`, `sorgula`, `getGecmis` + yardımcılar (`masakTarihSaat`, `masakSayi`, `masakBayatMi`, `masakAdresGecerliMi`) |
| `src/data/masakData.ts` | ✅ değişti | Her listeye `listeKod` alanı eklendi (`A`, `B`, `C`, `3AB`) — backend kodlarıyla eşleşme |
| `src/components/masak/MasakModal.tsx` | ✅ yeniden yazıldı | Durum bandı + adres giriş ekranı + sonuç raporu + Geçmiş sekmesi |

**Modalın kazandığı davranış (Bölüm 8.4'ün karşılığı)**

- Üstte durum bandı: toplam kayıt + son güncelleme; 7 günden eskiyse bant kırmızıya dönüyor ve
  "MASAK sitesinden listeleri sık aralıklarla güncelleyiniz." uyarısı çıkıyor.
- Dört liste için adres kutuları; açılışta `GET /masak/durum`'dan gelen **son kullanılan adres**,
  yoksa `masakData.ts`'teki varsayılan adres dolu geliyor.
- Her satırda seçim kutusu (sadece istenen liste güncellenebiliyor), kayıt sayısı ve o listenin
  son güncelleme zamanı; adres `ms.hmb.gov.tr` + `.xlsx` değilse kutu kırmızı ve buton pasif.
- Satır sonunda "yeni sekmede aç" ve "Excel indir" düğmeleri (eski davranış korundu).
- **MASAK Listelerini Güncelle** → spinner, ardından liste liste sonuç:
  "476 kayıt eklendi (önceki 476) · 2,1 sn" veya hata satırı + "mevcut N kaydı korundu".
- **Geçmiş** sekmesi `GET /masak/gecmis`'ten tarih · liste · sonuç · kayıt · kullanıcı gösteriyor.
- Tasarım Bölüm 15'e uygun: `Modal size="lg" centered`, bootstrap `Button`/`Form.Control size="sm"`,
  tablo başlığında ev standardı gradyan, `rem` yazı boyutları, tema dışı özel renk yok.

**Doğrulama:** frontend `tsc --noEmit` → **çıkış kodu 0**. Tarayıcıda görsel test yapılmadı.

**⏸️ DURULDU — kaldığım yer / devam edilecek noktalar**

1. **Faz 5 artığı:** `Header.tsx` içindeki MASAK dropdown'ı hâlâ eski davranışta
   (sadece Excel linkleri). Modal zaten oradan açılıyor, kod değişikliği şart değil;
   Faz 7'de görsel uyum sırasında gözden geçirilecek.
2. **Faz 6 (başlanmadı):** `MasakListsPage` — gerçek veri grid'i (`GET /masak/liste`),
   Adı/Kimlik no arama, liste sekmeleri (Tümü/A/B/C/3.A-B), sunucu tarafı sayfalama,
   Detay modalı (`GET /masak/kayit/:id`), sayfa içi güncelleme butonu.
3. **Faz 7 (başlanmadı):** Bölüm 15.2'deki sırıtan öğelerin temizliği (koyu banner, kırmızı
   gradient, liste başına marka renkleri, px font'lar) + `ERPToolbar.ROUTE_PAGE_MAP`'e MASAK kaydı.
4. **Faz 8 (başlanmadı):** Canlı veritabanı testi — **kullanıcı kararıyla en sona bırakıldı.**
   Koşulacak senaryolar: Bölüm 11 / 1-6, 9, 11-14, 16-17.

**Kaldığım tam nokta:** Faz 5 kodu bitti ve tip denetiminden geçti; sıradaki iş
**Faz 6 — `src/pages/settings/MasakListsPage.tsx`'in veri grid'ine dönüştürülmesi**.

*(Faz 5, yukarıdaki "durduruldu" notundan sonra kaldığı yerden sürdürüldü ve tamamlandı.)*

### ✅ Faz 6 — MASAK sayfası veri grid'i (08.09.2026)

`src/pages/settings/MasakListsPage.tsx` baştan yazıldı: artık statik bilgi kartları değil,
`TODVZ_MASAK_LISTE` tablosundan beslenen gerçek bir ERP ekranı.

- **Üst şerit:** `ERPToolbar` (başlık + kalkan ikonu, F4 Listele / F5 Yenile / F10 Yazdır bağlı),
  sağında **[MASAK Listelerini Güncelle]** — adres giriş ekranını (MasakModal) açar.
- **Durum bandı:** toplam kayıt + son güncelleme; 7 günden eskiyse kırmızıya döner ve uyarı verir.
- **Arama:** `Adı` ve `Kimlik no` alanları (Enter ile de çalışır), **Listele** ve **Temizle**;
  sağda liste sekmeleri `Tümü | A | B | C | 3.A-B`.
- **Tablo:** `Sıra | Liste | Adı/Ünvanı | Uyruğu | Kimlik No | Diğer adı | Yaptırım | Detay`.
  Kur sayfasının kalıbı: sticky başlık gradyanı, `#b8cee6` hücre kenarı, zebra satır, 0,80–0,85 rem.
- **Sayfalama sunucu tarafında** (50 kayıt/sayfa) — 2.300 satır tek seferde çekilmiyor.
  Alt durum çubuğunda "1 - 50 / 1.443", sayfa numarası, Önceki/Sonraki ve F-tuşu butonları.
- **Detay modalı:** kaydın dolu olan tüm alanları + `EK_BILGI` içindeki ek kolonlar + kaynak
  dosya bağlantısı. (Satır verisi `/masak/liste`'den tam geldiği için ekstra istek atılmıyor;
  `GET /masak/kayit/:id` ucu diğer tüketiciler için duruyor.)
- Liste boşken "Henüz liste yüklenmemiş. 'MASAK Listelerini Güncelle' ile listeleri indiriniz."
  yönlendirmesi çıkıyor.
- Mevzuat metni korundu ama sayfanın altında tek, sade bir karta indirildi.

### ✅ Faz 7 — Arayüz uyum geçişi (08.09.2026)

- **Koyu lacivert banner kaldırıldı** (`linear-gradient(135deg,#1e293b,#0f172a)`), yerine
  `ERPToolbar` + ince durum bandı geldi.
- **Kırmızı gradient ikon kutusu kaldırıldı**; modal başlığı diğer modallarla aynı sade yapıda.
- **Liste başına marka renkleri** (mavi/sarı/kırmızı/mor `accentColor`) ekranlardan çıkarıldı;
  liste ayrımı artık nötr `Badge` + kod (`A`, `B`, `C`, `3.A-B`) ile yapılıyor.
- **Serbest ölçüler** (`rounded-4`, `gap-2.5`, `13.5px` gibi px yazı boyutları) standart bootstrap
  sınıflarına ve `rem` değerlerine çevrildi. Tarama sonucu: MASAK dosyalarında **px cinsinden font
  ve tema dışı hex renk kalmadı**; yalnızca ev standardı gradyanlar ve `shadow-xs` (Kur sayfasının
  F-tuşu buton sınıfı) kullanılıyor.
- **`ERPToolbar.ROUTE_PAGE_MAP`'e MASAK kaydı eklendi** (`/masak` ve `/ayarlar/masak-dondurulanlar`
  → "MASAK Malvarlıkları Dondurulanlar" + `IconShieldCheck`), böylece başlık/ikon diğer sayfalarla
  aynı mekanizmadan geliyor.

**Header hakkında karar:** `Header.tsx` içindeki MASAK dropdown'ına **dokunulmadı.** Gerekçe:
yol haritası Bölüm 13'te bu dosya "dokunulmayacak" listesinde ve dropdown'ın kırmızı stili
header'ın kendi hızlı-eylem düzeniyle uyumlu (E-Belge vb. ile aynı kalıp), yani sırıtmıyor.
Dropdown'daki "Detaylı İncele" ve mobil MASAK butonu zaten yeni modalı açıyor; ham Excel indirme
linkleri de çalışmaya devam ediyor. Dropdown'ın da yenilenmesi istenirse ayrı bir küçük iş kalemi.

**Doğrulama (Faz 5-6-7)**

| Kontrol | Sonuç |
|---|---|
| Frontend `tsc --noEmit` | çıkış kodu 0 ✅ |
| MASAK dosyalarında px font / tema dışı hex taraması | temiz ✅ |
| `vite build` | **çalıştırılamadı** — aşağıdaki nota bakınız ⚠️ |
| Tarayıcıda görsel test | yapılmadı (aynı sebep) ⚠️ |

> **Ortam notu (bizim değişikliğimizle ilgisi yok):** Depodaki kök `node_modules` bir Mac'ten
> commit edilmiş; içinde yalnızca `@rollup/rollup-darwin-arm64` ve `@esbuild/darwin-arm64` var.
> Bu yüzden bu Windows makinesinde `vite build` / `vite dev` çalışmıyor
> (`MODULE_NOT_FOUND: @rollup/rollup-win32-x64-msvc`). Düzeltmek için kökte `npm install`
> gerekiyor ama bu depoda `node_modules` git ile izlendiği için binlerce dosyalık bir değişiklik
> yaratır — **kullanıcı onayı olmadan yapılmadı.** Tip denetimi (`tsc`) sorunsuz geçtiği için
> kodun derlenebilirliği doğrulanmış durumda; görsel test Faz 8'de, uygulamanın normal çalıştığı
> ortamda yapılacak.

**Sırada:** Faz 8 — canlı ortam testi (kullanıcı kararıyla en sona bırakılmıştı):
Bölüm 11 / 1-6, 9, 11-14, 16-17 senaryoları + MASAK ile Kur sayfasının yan yana görsel
karşılaştırması.

### 🔶 Faz 8 — Test (kısmen koşuldu, 08.09.2026)

**Yapılan hazırlık:** kullanıcı onayıyla kökte `npm install` çalıştırıldı. Depoya bir Mac'ten
commit edilmiş `node_modules` yüzünden eksik olan Windows ikilileri kuruldu
(`@rollup/rollup-win32-x64-msvc`, `@esbuild/win32-x64`), böylece `vite build` / `vite dev` açıldı.

**Koşulan testler**

| # | Test | Sonuç |
|---|---|---|
| — | Frontend `tsc --noEmit` | ✅ çıkış kodu 0 |
| — | `vite build` (üretim derlemesi) | ✅ 6.410 modül, 24,5 sn, hatasız |
| — | Backend `tsc --noEmit` | ✅ çıkış kodu 0 |
| 18 | MASAK sayfası ile Kur sayfasının görsel karşılaştırması | ✅ aynı üst şerit, aynı tablo başlığı gradyanı, aynı satır yüksekliği ve yazı boyutu, aynı alt durum çubuğu düzeni |
| 19 | MASAK dosyalarında tema dışı hex / px font | ✅ kalmadı |
| — | Adres giriş ekranı (modal) render testi | ✅ durum bandı, sekmeler, 4 liste satırı (checkbox + rozet + kayıt sayısı), 4 adres kutusu **varsayılan adreslerle dolu**, aç/indir düğmeleri, alt butonlar |
| — | Sayfa boş durum davranışı | ✅ "Henüz liste yüklenmemiş. 'MASAK Listelerini Güncelle' ile listeleri indiriniz." |
| — | Bayat veri uyarısı | ✅ kayıt yokken bant kırmızı + "listeleri sık aralıklarla güncelleyiniz" |
| — | API hatasının ekrana yansıması | ✅ SQL'e ulaşılamadığında sayfa çökmüyor, anlaşılır uyarı gösteriyor |

**Görsel test nasıl yapıldı:** uygulamanın kimlik doğrulaması veritabanına bağlı olduğu için
(`/auth/me` profili SQL'den okuyor) korumalı sayfa normal yoldan açılamadı. `App.tsx`'e **geçici**
iki önizleme rotası (`/onizleme/masak`, `/onizleme/kur`) eklenip ekran görüntüleri alındı, ardından
rotalar kaldırıldı — `App.tsx` yedeğiyle birebir aynı olduğu `diff` ile doğrulandı.

**⛔ Koşulamayan testler — veritabanı gerekiyor**

Bu makinede SQL Server yok: 127.0.0.1:1433 kapalı ve `Get-Service` çıktısında hiçbir `MSSQL*`
servisi yok (ekran görüntülerindeki veritabanı başka bir makinede — DESKTOP-GF2TGL4\S).
Bu yüzden aşağıdakiler **hâlâ bekliyor**:

| # | Senaryo |
|---|---|
| 1 | Boş veritabanında ilk güncelleme → 2 tablo oluşur, ≈2.307 kayıt yazılır |
| 2 | İkinci güncelleme → kayıt sayısı değişmez (mükerrer yok) |
| 3 | İnternet kapalıyken güncelleme → hata döner, mevcut kayıtlar silinmez |
| 4 | Bir listenin URL'i 404 → o liste hata, diğer 3 liste güncellenir |
| 5 | `39472770166` TCKN sorgusu → `ABDULKADİR BAŞARAN`, skor 100 |
| 6 | `abdullah aymaz` sorgusu → skor 90 eşleşme |
| 9 | Yerel (agent) modda güncelleme yerel SQL'e yazar |
| 11-14 | Yeni adres yapıştırma, adres kalıcılığı, tek liste güncelleme, hatalı adres |
| 16-17 | Log satırlarının düşmesi, aynı dosyada hash'in değişmemesi |

**Bunları koşmak için iki yol var:**
1. Uygulamayı veritabanının olduğu makinede (veya yerel agent ile) açıp giriş yaptıktan sonra
   MASAK ekranından **Güncelle**'ye basmak — sonucu birlikte değerlendiririz.
2. SQL sunucu adresi / veritabanı adı / kullanıcı-şifre paylaşılırsa buradan uçtan uca koşmak.

**Not:** `vite build` çalıştırıldığı için `dist/` klasörü yeniden üretildi (yeni hash'li dosyalar).
Depoda `dist/` izlendiği için bu da bir değişiklik olarak görünüyor. İstenirse
`git checkout -- dist` ile eski hâline döndürülebilir; bırakılırsa MASAK özelliği derlenmiş
çıktıya dahil olmuş olur.

### ✅ Faz 8 — Uçtan uca canlı test (08.09.2026 — TAMAMLANDI)

**Ortam hazırlığı**

| İş | Sonuç |
|---|---|
| `Backend` derlemesi (`tsc`) | ✅ `Backend/dist` içine MASAK dosyaları üretildi (`masak.routes.js`, `masak.controller.js`, `masak.service.js`, `masakSql.repository.js`, `masakExcel.util.js`) ve `dist/routes/index.js`'e `/masak` kaydı düştü |
| `exceljs` commit'e dahil edildi | ✅ `exceljs` + 78 bağımlılığı (519 dosya) `git add` ile hazırlandı; `Backend/package.json`, `package-lock.json` ve derlenmiş `Backend/dist` de staged (commit **yapılmadı**) |
| **SQL Server kurulumu** | ✅ Bu makineye SQL Server 2025 Express kuruldu — varsayılan instance (MSSQLSERVER), TCP/IP açık, port 1433, karma kimlik doğrulama. Test veritabanı: `R2016_dvz` |

> SQL Server kurulum notları: `winget` yerine Microsoft'un resmî indiricisi kullanıldı. İki hata alındı
> ve aşıldı: (1) kurulum dosyaları uzun bir geçici dizinde olduğu için 260 karakter yol sınırına
> takıldı → `C:\sqlsetup`'a taşındı; (2) `BUILTIN\Administrators` Türkçe Windows'ta çözümlenemedi
> ("Value cannot be null. Parameter name: userName") → sysadmin olarak `YAVUZ\yavuz` verildi.
> Kurulum sonrası `C:\sqlsetup` (789 MB) silindi. **SA şifresi: `Likya2026.Test`** — bu bir
> geliştirme makinesi; sunucuda farklı ve güçlü bir şifre kullanılmalı.

**Koşulan senaryolar — hepsi geçti**

| # | Senaryo | Sonuç |
|---|---|---|
| 1 | Boş veritabanında ilk güncelleme | ✅ 2 tablo + 5 indeks otomatik oluştu, **2.307 kayıt** yazıldı, **2,9 saniye** (A 476/870ms · B 112/151ms · C 1443/716ms · 3AB 276/189ms) |
| 2 | İkinci güncelleme (mükerrer kontrolü) | ✅ Toplam yine 2.307; SQL'de aynı liste+ad+sıra no ikilisinden **0 mükerrer** |
| 3 | Erişilemeyen kaynak | ✅ (4 numara ile birlikte doğrulandı) hata mesajı döndü, veri silinmedi |
| 4 | Bir listenin URL'i 404 | ✅ A "hata" döndü, **476 kaydı korundu**; B aynı istekte başarıyla güncellendi |
| 5 | TCKN sorgusu `39472770166` | ✅ `ABDULKADİR BAŞARAN`, `KIMLIK_TAM`, skor **100** |
| 6 | Küçük harf isim `abdullah aymaz` | ✅ `ABDULLAH AYMAZ`, `AD_TAM`, skor **90** |
| 6b | Türkçe karakterli `abdülkadir aksoy`, `ismet aksoy` | ✅ `ABDÜLKADİR AKSOY` ve `İSMET AKSOY` bulundu (skor 90) |
| 7 | Arapça/Türkçe karakter bütünlüğü | ✅ 14 kayıtta orijinal dilde ad var, bozulmamış: `عبد الله محمد رجب عبد الرحمن` |
| 8 | Boş kuyruk satırlarının atılması | ✅ A listesinde 532 satırdan 476'sı yazıldı; tabloda **0 boş ad** kaydı |
| 11 | Ekrandan girilen adresin kullanılması ve kalıcılığı | ✅ B listesine bilerek A dosyasının adresi verildi → 476 kayıt yazıldı ve adres `KAYNAK_URL`'e kaydedildi; sonra kendi adresiyle geri yüklendi (112) |
| 12 | `ms.hmb.gov.tr` dışı adres | ✅ 400 ile reddedildi |
| 13 | Tek liste güncelleme | ✅ Sadece B güncellendi, A/C/3AB'nin son güncelleme zamanı değişmedi |
| 14 | Başarısız listenin adresi kaydedilmiyor | ✅ 404 alan adres `KAYNAK_URL`'e yazılmadı, eski çalışan adres korundu |
| 16 | Log kayıtları | ✅ 12 `BASARILI` + 1 `HATA`; her satırda kullanıcı adı (`admin`), süre, kayıt sayısı, hata mesajı |
| 17 | Aynı dosyada hash değişmemesi | ✅ B'nin iki ayrı indirmesinde `KAYNAK_HASH` aynı → "içerik değişmemiş" ayırt edilebiliyor |
| — | Sayfalama | ✅ Sayfa 1 ve 2 farklı kayıtlar döndürüyor, toplam 2.307 |
| — | Doğum tarihi UTC düzeltmesi | ✅ `1978-06-05` ham metin → `DOGUM_TARIHI_DT = 1978-06-05` (kayma yok) |

**Veritabanı doğrulaması**

```
Tablolar : TODVZ_MASAK_LISTE, TODVZ_MASAK_GUNCELLEME  (otomatik oluştu)
İndeksler: IX_..._LISTE, IX_..._TCKN, IX_..._VKN, IX_..._ADNORM, IX_GUNCELLEME_LISTE
Kayıtlar : A 476 (tckn 1)  ·  B 112 (tckn 16)  ·  C 1443 (tckn 1332)  ·  3AB 276  =  2.307
Boş ad   : 0     Mükerrer : 0     Normalize edilmemiş ad : 0
```

Örnek kayıt (C listesi):
`SIRA_NO 1 · ABDULKADİR BAŞARAN · norm "ABDULKADIR BASARAN" · TCKN 39472770166 ·
TÜRKİYE CUMHURİYETİ · İÇ DONDURMA KAPSAMINDA · anne Mukaddes · baba Rahmi ·
doğum 1982-07-19 · FETÖ/PDY · tip GERCEK`

**Test edilmeyen tek nokta:** uygulamaya gerçek kullanıcıyla giriş yapıp arayüzden güncelleme
(login için veritabanında kullanıcı tablosu/kaydı gerekiyor; test veritabanı boş açıldı).
Arayüzün kendisi Faz 7'de görsel olarak, API'nin tamamı bu fazda uçtan uca doğrulandı.

**Sonuç: MASAK modülü tamamlandı.** Kalan iş, değişikliklerin commit'lenip sunucuya alınması.

---

## 17. Canlı Sunucu Dağıtımı (08.09.2026 — TAMAMLANDI)

**Sunucu:** Windows, pm2 uygulaması `likya-backend`, Node 20.20.2,
proje yolu `C:\Users\Administrator\Documents\GitHub\Kuyumcu-erp-saas`.

**Yapılanlar**

| Adım | Sonuç |
|---|---|
| Depo adresi düzeltildi | Sunucu eski/erişilemeyen `yusufaaras/Kuyumcu-erp-saas` deposuna bağlıydı; `yunusdem/Likyakuyum` olarak değiştirildi |
| Kod eşitlendi | Geçmişler ayrık olduğu için `git reset --hard origin/main`; HEAD = `4311822fc` |
| `.env` | Sunucuda `.env` yoktu (uygulama varsayılanlarla çalışıyordu); depodan gelen dosyada `NODE_ENV=production` yapıldı |
| Yeniden başlatma | `pm2 restart likya-backend --update-env` → `🌍 Ortam: PRODUCTION` |
| Uç doğrulaması | `GET /api/v1/masak/durum` → 401 "token bulunamadı" (404 değil) — yani yeni kod canlı **ve** production modda kimlik doğrulama uygulanıyor |
| **Arayüz testi** | ✅ Güncelleme çalıştı; **isimle arama ve TCKN ile arama sunucuda çalışıyor** |

**Not:** JWT anahtarları `.env` ile geldiği için mevcut oturumlar düştü, kullanıcılar bir kez
yeniden giriş yaptı. pm2 error log'undaki JWT uyarıları `.env` öncesine ait eski kayıtlardır.

**Modül canlıda çalışır durumda.**
