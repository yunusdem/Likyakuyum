/* =============================================================================
   LIKYA_ADMIN — Hızlı Satış modül kataloğuna eklendi (docs/HIZLI_SATIS_YOL_HARITASI.md, H3)

   Yeni kodlar:
     vezne:hizli-satis/sarraf          (Vezne › Hızlı Satış (Sarraf))
     vezne:hizli-satis/doviz           (Vezne › Hızlı Satış (Döviz))
     perakende:hizli-satis/perakende   (Perakende › Hızlı Satış)
     ticari:hizli-satis/ticari         (Ticari › Hızlı Satış)
     ayarlar:ayarlar/hizli-satis-duzeni (Ayarlar › Hızlı Satış Düzeni)
     ust:hizli-satis                   (üst çubuk kısayolu)

   Modül ayarı yapılmış firmaların listesinde bu kodlar olmadığı için deploy sonrası menüde görünmezlerdi.
   Bu betik:
     1) ADM_MODUL'e kayıtları ekler (panel sekmesi açılınca katalog zaten eşitlenir, sıra/başlık orada düzelir)
     2) İçeriği yüklenmiş ürün paketlerine ekler (her biri kendi fişinin paketine)
     3) Modül ayarı yapılmış firmalarda, ilgili fiş ekranı AÇIK ise hızlı satışını da açar
        (Sarraf fişi açık → Sarraf hızlı satış; Döviz fişi açık → Döviz hızlı satış; Perakende / Ticari menüsü açık → kendi
        hızlı satışı). En az biri açılan firmada üst kısayol ve Hızlı Satış Düzeni de açılır.

   Kurulum: sunucuda SSMS'te, deploy ile birlikte bir kez. Tekrar çalıştırılabilir; ikinci çalıştırmada panelden
   kapatılmış kodları yeniden AÇMAZ (yalnız eksik satır ekler).
   ============================================================================= */

USE [LIKYA_ADMIN];
GO

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

-- 1) Katalog
DECLARE @k TABLE (KOD varchar(200), UST varchar(200), BASLIK nvarchar(200), TUR varchar(20));
INSERT @k VALUES
  ('vezne:hizli-satis/sarraf', 'vezne', N'Q- Hızlı Satış (Sarraf)', 'ALT'),
  ('vezne:hizli-satis/doviz', 'vezne', N'R- Hızlı Satış (Döviz)', 'ALT'),
  ('perakende:hizli-satis/perakende', 'perakende', N'G- Hızlı Satış', 'ALT'),
  ('ticari:hizli-satis/ticari', 'ticari', N'K- Hızlı Satış', 'ALT'),
  ('ayarlar:ayarlar/hizli-satis-duzeni', 'ayarlar', N'O- Hızlı Satış Düzeni', 'ALT'),
  ('ust:hizli-satis', 'ust', N'Hızlı Satış', 'UST_KISAYOL');

INSERT INTO dbo.ADM_MODUL (MODUL_KODU, UST_KODU, BASLIK, TUR, SIRA)
SELECT k.KOD, k.UST, k.BASLIK, k.TUR, (SELECT ISNULL(MAX(SIRA), 0) FROM dbo.ADM_MODUL) + ROW_NUMBER() OVER (ORDER BY k.KOD)
FROM @k k
WHERE NOT EXISTS (SELECT 1 FROM dbo.ADM_MODUL m WHERE m.MODUL_KODU = k.KOD);
GO

-- 2) Ürün paketleri (içeriği yüklenmiş paketler; yoksa panel menüden doldurur)
IF OBJECT_ID('dbo.ADM_PAKET_MODUL') IS NOT NULL
BEGIN
  INSERT INTO dbo.ADM_PAKET_MODUL (PAKET_KODU, MODUL_KODU)
  SELECT x.PAKET, x.KOD
  FROM (VALUES
    ('kuyum', 'vezne:hizli-satis/sarraf'),
    ('doviz', 'vezne:hizli-satis/doviz'), ('gumus', 'vezne:hizli-satis/doviz'),
    ('kuyum', 'perakende:hizli-satis/perakende'),
    ('kuyum', 'ticari:hizli-satis/ticari'), ('ticari', 'ticari:hizli-satis/ticari'),
    ('doviz', 'ust:hizli-satis'), ('gumus', 'ust:hizli-satis'), ('kuyum', 'ust:hizli-satis'), ('ticari', 'ust:hizli-satis'),
    ('doviz', 'ayarlar:ayarlar/hizli-satis-duzeni'), ('gumus', 'ayarlar:ayarlar/hizli-satis-duzeni'),
    ('kuyum', 'ayarlar:ayarlar/hizli-satis-duzeni'), ('ticari', 'ayarlar:ayarlar/hizli-satis-duzeni')
  ) AS x (PAKET, KOD)
  JOIN dbo.ADM_PAKET p ON p.PAKET_KODU = x.PAKET AND p.ILK_ICERIK = 1
  WHERE NOT EXISTS (SELECT 1 FROM dbo.ADM_PAKET_MODUL y WHERE y.PAKET_KODU = x.PAKET AND y.MODUL_KODU = x.KOD);
END
GO

-- 3) Modül ayarı yapılmış firmalar: ilgili fiş ekranı açıksa hızlı satışı da aç
DECLARE @eslesme TABLE (YENI varchar(200), KAYNAK varchar(200));
INSERT @eslesme VALUES
  ('vezne:hizli-satis/sarraf', 'vezne:vezne/sarraf-fisi-kayit'),
  ('vezne:hizli-satis/sarraf', 'ust:sarraf'),
  ('vezne:hizli-satis/doviz', 'vezne:vezne/doviz-fisi-kayit'),
  ('vezne:hizli-satis/doviz', 'ust:doviz'),
  ('perakende:hizli-satis/perakende', 'perakende'),
  ('ticari:hizli-satis/ticari', 'ticari');

INSERT INTO dbo.ADM_FIRMA_MODUL (FIRMA_ID, MODUL_KODU, ACIK)
SELECT DISTINCT f.FIRMA_ID, e.YENI, 1
FROM dbo.ADM_FIRMA_MODUL f
JOIN @eslesme e ON e.KAYNAK = f.MODUL_KODU AND f.ACIK = 1
WHERE NOT EXISTS (SELECT 1 FROM dbo.ADM_FIRMA_MODUL x WHERE x.FIRMA_ID = f.FIRMA_ID AND x.MODUL_KODU = e.YENI);

-- Bu firmalarda üst kısayol, düzen ekranı ve üst grup ('ust', 'ayarlar', ana menüler) açık olmalı (ağaç kuralı)
INSERT INTO dbo.ADM_FIRMA_MODUL (FIRMA_ID, MODUL_KODU, ACIK)
SELECT DISTINCT f.FIRMA_ID, k.KOD, 1
FROM dbo.ADM_FIRMA_MODUL f
CROSS JOIN (VALUES ('ust:hizli-satis'), ('ayarlar:ayarlar/hizli-satis-duzeni'), ('ust'), ('ayarlar')) AS k (KOD)
WHERE f.ACIK = 1 AND f.MODUL_KODU IN ('vezne:hizli-satis/sarraf', 'vezne:hizli-satis/doviz', 'perakende:hizli-satis/perakende', 'ticari:hizli-satis/ticari')
  AND NOT EXISTS (SELECT 1 FROM dbo.ADM_FIRMA_MODUL x WHERE x.FIRMA_ID = f.FIRMA_ID AND x.MODUL_KODU = k.KOD);

UPDATE g SET ACIK = 1, DEGISTIRME_TARIHI = GETDATE()
FROM dbo.ADM_FIRMA_MODUL g
WHERE g.MODUL_KODU IN ('ust', 'ayarlar') AND g.ACIK = 0
  AND EXISTS (SELECT 1 FROM dbo.ADM_FIRMA_MODUL p WHERE p.FIRMA_ID = g.FIRMA_ID AND p.ACIK = 1
              AND p.MODUL_KODU IN ('ust:hizli-satis', 'ayarlar:ayarlar/hizli-satis-duzeni'));
GO

-- Kontrol
SELECT MODUL_KODU, COUNT(*) AS ACIK_FIRMA
FROM dbo.ADM_FIRMA_MODUL
WHERE ACIK = 1 AND (MODUL_KODU LIKE '%hizli-satis%')
GROUP BY MODUL_KODU;
GO
