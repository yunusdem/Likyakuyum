/* =============================================================================
   LIKYA_ADMIN — Ticari Fiyat Gör + Etiket modül kataloğuna eklendi (docs/TICARI_GERI_BILDIRIM_YOL_HARITASI.md İş 2, G3–G5)

   Yeni kodlar:
     ticari:ticari/fiyat-gor   (Ticari İşlemler › L- Fiyat Gör)
     ticari:ticari/etiket      (Ticari İşlemler › M- Etiket)
     ust:ticari-fiyat          (üst çubuk kısayolu "T. Fiyat")

   Modül ayarı yapılmış firmaların listesinde bu kodlar olmadığı için deploy sonrası menüde görünmezlerdi.
   Bu betik: 1) ADM_MODUL'e ekler, 2) içeriği yüklenmiş Kuyum ve Ticari paketlerine ekler,
   3) Ticari İşlemler menüsü AÇIK firmalarda üçünü de açar (üst grup 'ust' kapalıysa açar).
   Kurulum: sunucuda SSMS'te, deploy ile birlikte bir kez. Tekrar çalıştırılabilir; panelden kapatılmış kodu yeniden AÇMAZ.
   ============================================================================= */

USE [LIKYA_ADMIN];
GO
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

-- 1) Katalog
DECLARE @k TABLE (KOD varchar(200), UST varchar(200), BASLIK nvarchar(200), TUR varchar(20));
INSERT @k VALUES
  ('ticari:ticari/fiyat-gor', 'ticari', N'L- Fiyat Gör', 'ALT'),
  ('ticari:ticari/etiket', 'ticari', N'M- Etiket', 'ALT'),
  ('ust:ticari-fiyat', 'ust', N'T. Fiyat', 'UST_KISAYOL');

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
    ('kuyum', 'ticari:ticari/fiyat-gor'), ('ticari', 'ticari:ticari/fiyat-gor'),
    ('kuyum', 'ticari:ticari/etiket'), ('ticari', 'ticari:ticari/etiket'),
    ('kuyum', 'ust:ticari-fiyat'), ('ticari', 'ust:ticari-fiyat')
  ) AS x (PAKET, KOD)
  JOIN dbo.ADM_PAKET p ON p.PAKET_KODU = x.PAKET AND p.ILK_ICERIK = 1
  WHERE NOT EXISTS (SELECT 1 FROM dbo.ADM_PAKET_MODUL y WHERE y.PAKET_KODU = x.PAKET AND y.MODUL_KODU = x.KOD);
END
GO

-- 3) Ticari İşlemler açık firmalarda üç kodu da aç
INSERT INTO dbo.ADM_FIRMA_MODUL (FIRMA_ID, MODUL_KODU, ACIK)
SELECT DISTINCT f.FIRMA_ID, k.KOD, 1
FROM dbo.ADM_FIRMA_MODUL f
CROSS JOIN (VALUES ('ticari:ticari/fiyat-gor'), ('ticari:ticari/etiket'), ('ust:ticari-fiyat'), ('ust')) AS k (KOD)
WHERE f.MODUL_KODU = 'ticari' AND f.ACIK = 1
  AND NOT EXISTS (SELECT 1 FROM dbo.ADM_FIRMA_MODUL x WHERE x.FIRMA_ID = f.FIRMA_ID AND x.MODUL_KODU = k.KOD);

UPDATE g SET ACIK = 1, DEGISTIRME_TARIHI = GETDATE()
FROM dbo.ADM_FIRMA_MODUL g
WHERE g.MODUL_KODU = 'ust' AND g.ACIK = 0
  AND EXISTS (SELECT 1 FROM dbo.ADM_FIRMA_MODUL p WHERE p.FIRMA_ID = g.FIRMA_ID AND p.ACIK = 1 AND p.MODUL_KODU = 'ust:ticari-fiyat');
GO

-- Kontrol
SELECT MODUL_KODU, COUNT(*) AS ACIK_FIRMA FROM dbo.ADM_FIRMA_MODUL
WHERE ACIK = 1 AND MODUL_KODU IN ('ticari:ticari/fiyat-gor', 'ticari:ticari/etiket', 'ust:ticari-fiyat')
GROUP BY MODUL_KODU;
GO
