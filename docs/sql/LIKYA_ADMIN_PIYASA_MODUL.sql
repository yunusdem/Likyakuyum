/* =============================================================================
   LIKYA_ADMIN — Piyasa (üst çubuk canlı fiyat panosu) modül kataloğuna eklendi: ust:piyasa

   Eskiden Piyasa herkese açıktı ve katalogda yoktu. Artık yönetim panelinden firma
   bazında kapatılabilir. Modül ayarı yapılmış firmaların listesinde bu kod olmadığı
   için deploy sonrası Piyasa düğmesi kaybolurdu; bu betik onu herkeste AÇIK başlatır:
     1) ADM_MODUL'e ust:piyasa kaydı (panel sekmesi açılınca katalog zaten eşitlenir,
        sıra/başlık orada düzelir)
     2) İçeriği yüklenmiş ürün paketlerine (Döviz, Gümüş, Kuyum, Ticari, Connector)
     3) Modül ayarı yapılmış her firmaya ACIK=1 (ayarı olmayan firma zaten kısıtsızdır)

   Kurulum (sunucuda, SSMS'te, deploy ile birlikte bir kez). Tekrar çalıştırılabilir;
   ikinci çalıştırmada panelden kapatılmış firmaları yeniden AÇMAZ (yalnız eksik satır ekler).
   ============================================================================= */

USE [LIKYA_ADMIN];
GO

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

-- 1) Katalog
IF NOT EXISTS (SELECT 1 FROM dbo.ADM_MODUL WHERE MODUL_KODU = 'ust:piyasa')
  INSERT INTO dbo.ADM_MODUL (MODUL_KODU, UST_KODU, BASLIK, TUR, SIRA)
  SELECT 'ust:piyasa', 'ust', N'Piyasa', 'UST_KISAYOL', ISNULL(MAX(SIRA), 0) + 1 FROM dbo.ADM_MODUL;
GO

-- 2) Ürün paketleri (tablolar yoksa atlanır; içeriği henüz yüklenmemiş paketi panel menüden doldurur)
IF OBJECT_ID('dbo.ADM_PAKET_MODUL') IS NOT NULL
BEGIN
  INSERT INTO dbo.ADM_PAKET_MODUL (PAKET_KODU, MODUL_KODU)
  SELECT p.PAKET_KODU, k.MODUL_KODU
  FROM dbo.ADM_PAKET p
  CROSS JOIN (VALUES ('ust'), ('ust:piyasa')) AS k (MODUL_KODU)
  WHERE p.PAKET_KODU IN ('doviz', 'gumus', 'kuyum', 'ticari', 'connector')
    AND p.ILK_ICERIK = 1
    AND NOT EXISTS (SELECT 1 FROM dbo.ADM_PAKET_MODUL x WHERE x.PAKET_KODU = p.PAKET_KODU AND x.MODUL_KODU = k.MODUL_KODU);
END
GO

-- 3) Modül ayarı yapılmış firmalar: Piyasa ve üst kısayol grubu açık
INSERT INTO dbo.ADM_FIRMA_MODUL (FIRMA_ID, MODUL_KODU, ACIK)
SELECT f.FIRMA_ID, 'ust:piyasa', 1
FROM (SELECT DISTINCT FIRMA_ID FROM dbo.ADM_FIRMA_MODUL) f
WHERE NOT EXISTS (SELECT 1 FROM dbo.ADM_FIRMA_MODUL x WHERE x.FIRMA_ID = f.FIRMA_ID AND x.MODUL_KODU = 'ust:piyasa');

-- Grup kapalıysa ağaç kuralı (modulAgaci.ts) çocukları da kapalı sayar; ust:piyasa'yı yeni eklediğimiz firmalarda grubu aç
UPDATE g SET ACIK = 1, DEGISTIRME_TARIHI = GETDATE()
FROM dbo.ADM_FIRMA_MODUL g
JOIN dbo.ADM_FIRMA_MODUL p ON p.FIRMA_ID = g.FIRMA_ID AND p.MODUL_KODU = 'ust:piyasa' AND p.ACIK = 1
WHERE g.MODUL_KODU = 'ust' AND g.ACIK = 0;

INSERT INTO dbo.ADM_FIRMA_MODUL (FIRMA_ID, MODUL_KODU, ACIK)
SELECT DISTINCT p.FIRMA_ID, 'ust', 1
FROM dbo.ADM_FIRMA_MODUL p
WHERE p.MODUL_KODU = 'ust:piyasa' AND p.ACIK = 1
  AND NOT EXISTS (SELECT 1 FROM dbo.ADM_FIRMA_MODUL x WHERE x.FIRMA_ID = p.FIRMA_ID AND x.MODUL_KODU = 'ust');
GO

-- Kontrol: ayarlı firma sayısı ile Piyasa'sı açık firma sayısı aynı olmalı
SELECT
  (SELECT COUNT(DISTINCT FIRMA_ID) FROM dbo.ADM_FIRMA_MODUL) AS AYARLI_FIRMA,
  (SELECT COUNT(*) FROM dbo.ADM_FIRMA_MODUL WHERE MODUL_KODU = 'ust:piyasa' AND ACIK = 1) AS PIYASA_ACIK;
GO
