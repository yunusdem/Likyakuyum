/* =============================================================================
   LIKYA_ADMIN — Adisyon ürünü (Likya.Adisyon) ve menü kodları (docs/TICARI_ADISYON_YOL_HARITASI.md, TA19–TA24, D1)

   1) Lisansa "en çok garson" alanı (ADM_LISANS.GARSON_LIMITI; NULL = sınırsız). Uygulama da açılışta ekler (adminDb.config.ts).
   2) Yeni ürün paketi 'adisyon' (ADM_PAKET). İLK_İÇERİK 0 ile eklenir: yönetim paneli Paket Tanımları açılınca ilk içeriği
      kullanıcı uygulamasının menüsünden (src/config/urunPaketleri.ts) bir kez gönderir.
   3) Menü kodları (ADM_MODUL): panel kataloğu menüden eşitler; burada da eklenir ki panel açılmadan önce de görünsün.
      Kodlar fazlar ilerledikçe bu listeye eklenir:
        adisyon                           (L- Adisyon, ANA)
        adisyon:adisyon/masalar           (Adisyon › Masalar, D3)
        adisyon:adisyon/tanimlar          (Adisyon › Tanımlar, D2)
        adisyon:adisyon/ayarlar           (Adisyon › Ayarlar, D1)
        adisyon:adisyon/mutfak            (Adisyon › Mutfak Ekranı, D5)
        adisyon:adisyon/raporlar          (Adisyon › Raporlar / gün sonu, D10)
        ust:adisyon                       (üst çubuk "Masalar" kısayolu, D3)
   26.11.2026 (kararlar R1–R4): ürün adı Likya.Restorant (paket kodu "adisyon" aynı), üçüncü paket "ticari_restorant"
   (Likya.Ticari + Restorant), ADM_LISANS.RESTORAN_ADI (firmaya özel başlık adı), Restorant menüsünün stok / kasa maddeleri
   (adisyon:ticari/...). Uygulama da açılışta RESTORAN_ADI kolonunu ve ticari_restorant satırını ekler (adminDb.config.ts).
   Kurulum: sunucuda SSMS'te, deploy ile birlikte bir kez (canlı için LIKYA_ADMIN, test için LIKYA_ADMIN_TEST). Tekrar çalıştırılabilir.
   Firma veritabanlarında göç 050 (Adisyon tabloları) ilk kullanımda kendiliğinden uygulanır.
   ============================================================================= */

USE [LIKYA_ADMIN];
GO
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

-- 1) Garson sınırı
IF COL_LENGTH('dbo.ADM_LISANS', 'GARSON_LIMITI') IS NULL
  ALTER TABLE dbo.ADM_LISANS ADD GARSON_LIMITI INT NULL;
GO

-- 1b) Restorant başlık adı (R4)
IF COL_LENGTH('dbo.ADM_LISANS', 'RESTORAN_ADI') IS NULL
  ALTER TABLE dbo.ADM_LISANS ADD RESTORAN_ADI NVARCHAR(40) NULL;
GO

-- 2) Ürün paketi
IF OBJECT_ID('dbo.ADM_PAKET', 'U') IS NOT NULL
  MERGE dbo.ADM_PAKET AS h
  USING (VALUES ('adisyon', N'Likya.Restorant', 7, 0, 0), ('ticari_restorant', N'Likya.Ticari + Restorant', 8, 0, 0)) AS k (PAKET_KODU, AD, SIRA, CEKIRDEK, HEPSI) ON h.PAKET_KODU = k.PAKET_KODU
  -- Ad yalnız eski varsayılansa güncellenir (panelden değiştirilmiş ad korunur)
  WHEN MATCHED AND h.AD = N'Likya.Adisyon' THEN UPDATE SET AD = k.AD
  WHEN NOT MATCHED BY TARGET THEN
    INSERT (PAKET_KODU, AD, SIRA, CEKIRDEK, HEPSI, ILK_ICERIK) VALUES (k.PAKET_KODU, k.AD, k.SIRA, k.CEKIRDEK, k.HEPSI, 0);
GO

-- 3) Katalog
DECLARE @k TABLE (KOD varchar(200), UST varchar(200), BASLIK nvarchar(200), TUR varchar(20));
INSERT @k VALUES
  ('adisyon', NULL, N'L- Restorant', 'ANA'),
  ('adisyon:adisyon/masalar', 'adisyon', N'A- Masalar', 'ALT'),
  ('adisyon:adisyon/tanimlar', 'adisyon', N'B- Tanımlar', 'ALT'),
  ('adisyon:adisyon/ayarlar', 'adisyon', N'C- Ayarlar', 'ALT'),
  ('adisyon:adisyon/mutfak', 'adisyon', N'D- Mutfak Ekranı', 'ALT'),
  ('adisyon:adisyon/raporlar', 'adisyon', N'E- Raporlar', 'ALT'),
  ('adisyon:ticari/stok-kartlari', 'adisyon', N'F- Stok Kartları', 'ALT'),
  ('adisyon:ticari/urun-gruplari', 'adisyon', N'G- Ürün Grupları', 'ALT'),
  ('adisyon:ticari/fiyat-listeleri', 'adisyon', N'H- Fiyat Listeleri', 'ALT'),
  ('adisyon:ticari/stok-giris-fisi', 'adisyon', N'I- Stok Giriş Fişi', 'ALT'),
  ('adisyon:ticari/stok-giris-listesi', 'adisyon', N'J- Stok Giriş Listesi', 'ALT'),
  ('adisyon:ticari/sayim-fisi', 'adisyon', N'K- Sayım Fişi', 'ALT'),
  ('adisyon:ticari/fire-fisi', 'adisyon', N'L- Fire / Zayi Fişi', 'ALT'),
  ('adisyon:ticari/iade-fisi', 'adisyon', N'M- Satış İadesi', 'ALT'),
  ('adisyon:ticari/vardiya', 'adisyon', N'N- Vardiya (Kasa Açılış / Kapanış)', 'ALT'),
  ('adisyon:ticari/gun-sonu', 'adisyon', N'O- Gün Sonu Raporu', 'ALT'),
  ('adisyon:ticari/kar-raporu', 'adisyon', N'P- Kâr Raporu', 'ALT'),
  ('ust:adisyon', 'ust', N'Masalar', 'UST_KISAYOL');

INSERT INTO dbo.ADM_MODUL (MODUL_KODU, UST_KODU, BASLIK, TUR, SIRA)
SELECT k.KOD, k.UST, k.BASLIK, k.TUR, (SELECT ISNULL(MAX(SIRA), 0) FROM dbo.ADM_MODUL) + ROW_NUMBER() OVER (ORDER BY CASE WHEN k.UST IS NULL THEN 0 ELSE 1 END, k.KOD)
FROM @k k
WHERE NOT EXISTS (SELECT 1 FROM dbo.ADM_MODUL m WHERE m.MODUL_KODU = k.KOD);
GO
UPDATE dbo.ADM_MODUL SET BASLIK = N'L- Restorant' WHERE MODUL_KODU = 'adisyon' AND BASLIK = N'L- Adisyon';
GO

-- 4) İçeriği daha önce yüklenmiş "adisyon" paketi (R1): Restorant menüsünün yeni maddeleri pakete eklenir; Ticari'nin kendi kodları
--    (ticari:ticari/stok-kartlari …) Restorant paketinden çıkar — yalnız Restorant lisanslı firmada Ticari başlığı görünmez.
--    Firmaların modül ağacı lisans ürünleri yeniden uygulanınca (panel › Firma › Modüller › "Paketlere dön") güncellenir.
IF OBJECT_ID('dbo.ADM_PAKET_MODUL', 'U') IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.ADM_PAKET WHERE PAKET_KODU = 'adisyon' AND ILK_ICERIK = 1)
BEGIN
  INSERT INTO dbo.ADM_PAKET_MODUL (PAKET_KODU, MODUL_KODU)
  SELECT 'adisyon', m.MODUL_KODU FROM dbo.ADM_MODUL m
  WHERE m.MODUL_KODU LIKE 'adisyon:ticari/%' AND NOT EXISTS (SELECT 1 FROM dbo.ADM_PAKET_MODUL x WHERE x.PAKET_KODU = 'adisyon' AND x.MODUL_KODU = m.MODUL_KODU);
  DELETE FROM dbo.ADM_PAKET_MODUL WHERE PAKET_KODU = 'adisyon' AND MODUL_KODU IN ('ticari:ticari/stok-kartlari', 'ticari:ticari/urun-gruplari', 'ticari:ticari/fiyat-listeleri');
  IF NOT EXISTS (SELECT 1 FROM dbo.ADM_PAKET_MODUL WHERE PAKET_KODU = 'adisyon' AND MODUL_KODU LIKE 'ticari:%')
    DELETE FROM dbo.ADM_PAKET_MODUL WHERE PAKET_KODU = 'adisyon' AND MODUL_KODU = 'ticari';
END
GO

-- Kontrol
SELECT PAKET_KODU, AD, ILK_ICERIK FROM dbo.ADM_PAKET WHERE PAKET_KODU IN ('adisyon', 'ticari_restorant');
SELECT MODUL_KODU, BASLIK, TUR FROM dbo.ADM_MODUL WHERE MODUL_KODU LIKE 'adisyon%' OR MODUL_KODU = 'ust:adisyon';
GO
