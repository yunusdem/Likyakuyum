/* =============================================================================
   LIKYA_ADMIN — e-Gider Pusulası ayrı lisans seçeneği (docs/E_GIDER_YOL_HARITASI.md K15, K18, K21)

   Yeni kod:
     ebelge:e-belge/gider   (e-Belge › e-Gider Pusulası — menüde madde yok, panelde e-Belge'nin altında seçenek)

   Eskiden e-Gider ekranı e-Belge açık her firmada açıktı (Döviz, Ticari, Connector dahil). Artık kendi kodu var:
   Kuyum paketinde ve ERP'de açık, diğer paketlerde kapalı (panelden firma / paket bazında açılabilir).
   Modül ayarı yapılmış firmaların listesinde bu kod olmadığı için deploy sonrası e-Gider kartı görünmezdi. Bu betik:
     1) ADM_MODUL'e kaydı ekler (panel sekmesi açılınca katalog zaten eşitlenir, sıra / başlık orada düzelir)
     2) İçeriği yüklenmiş Kuyum paketine ekler (ERP "hepsi"dir, satır gerekmez)
     3) Modül ayarı yapılmış firmalarda Sarraf ya da Perakende fişi AÇIK ise (Kuyum ürünü) e-Gider'i de açar

   Kurulum: deploy ile birlikte SSMS'te, ÖNCE canlıda LIKYA_ADMIN, sonra testte LIKYA_ADMIN_TEST seçiliyken (üstteki
   veritabanı listesinden) birer kez çalıştırın. Tekrar çalıştırılabilir; ikinci çalıştırmada panelden kapatılmış kodu
   yeniden AÇMAZ (yalnız eksik satır ekler). Kurulum (exe) firmalarında yeni lisans kodu üretilince görünür.
   ============================================================================= */

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

-- 0) Doğru veritabanı mı? (LIKYA_ADMIN ya da LIKYA_ADMIN_TEST)
IF OBJECT_ID('dbo.ADM_MODUL') IS NULL OR OBJECT_ID('dbo.ADM_FIRMA_MODUL') IS NULL
BEGIN
  RAISERROR(N'Bu veritabanında ADM_MODUL / ADM_FIRMA_MODUL yok. Üstten LIKYA_ADMIN (canlı) ya da LIKYA_ADMIN_TEST (test) seçip yeniden çalıştırın.', 16, 1);
  SET NOEXEC ON;
END
GO

PRINT N'Çalışılan veritabanı: ' + DB_NAME();
GO

-- 1) Katalog
INSERT INTO dbo.ADM_MODUL (MODUL_KODU, UST_KODU, BASLIK, TUR, SIRA)
SELECT 'ebelge:e-belge/gider', 'ebelge', N'e-Gider Pusulası', 'ALT', (SELECT ISNULL(MAX(SIRA), 0) + 1 FROM dbo.ADM_MODUL)
WHERE NOT EXISTS (SELECT 1 FROM dbo.ADM_MODUL WHERE MODUL_KODU = 'ebelge:e-belge/gider');
GO

-- 2) Ürün paketi: Kuyum (içeriği yüklenmişse; yoksa panel ilk içeriği urunPaketleri.ts'ten doldurur)
IF OBJECT_ID('dbo.ADM_PAKET_MODUL') IS NOT NULL AND OBJECT_ID('dbo.ADM_PAKET') IS NOT NULL
BEGIN
  INSERT INTO dbo.ADM_PAKET_MODUL (PAKET_KODU, MODUL_KODU)
  SELECT p.PAKET_KODU, 'ebelge:e-belge/gider'
  FROM dbo.ADM_PAKET p
  WHERE p.PAKET_KODU = 'kuyum' AND p.ILK_ICERIK = 1
    AND NOT EXISTS (SELECT 1 FROM dbo.ADM_PAKET_MODUL y WHERE y.PAKET_KODU = p.PAKET_KODU AND y.MODUL_KODU = 'ebelge:e-belge/gider');
END
GO

-- 3) Modül ayarı yapılmış firmalar: Sarraf ya da Perakende fişi açıksa (Kuyum ürünü) e-Gider de açık
INSERT INTO dbo.ADM_FIRMA_MODUL (FIRMA_ID, MODUL_KODU, ACIK)
SELECT DISTINCT f.FIRMA_ID, 'ebelge:e-belge/gider', 1
FROM dbo.ADM_FIRMA_MODUL f
WHERE f.ACIK = 1
  AND f.MODUL_KODU IN ('vezne:vezne/sarraf-fisi-kayit', 'vezne:vezne/sarraf-fisi-duzeltme', 'ust:sarraf',
                       'vezne:vezne/perakende-fisi-kayit', 'vezne:vezne/perakende-fisi-duzeltme', 'ust:perakende', 'perakende')
  AND NOT EXISTS (SELECT 1 FROM dbo.ADM_FIRMA_MODUL x WHERE x.FIRMA_ID = f.FIRMA_ID AND x.MODUL_KODU = 'ebelge:e-belge/gider');
GO

-- Kontrol: e-Gider açık / kapalı firma sayısı ve Kuyum paketinde olup olmadığı
SELECT ACIK, COUNT(*) AS FIRMA_SAYISI
FROM dbo.ADM_FIRMA_MODUL
WHERE MODUL_KODU = 'ebelge:e-belge/gider'
GROUP BY ACIK;

IF OBJECT_ID('dbo.ADM_PAKET_MODUL') IS NOT NULL
  SELECT PAKET_KODU, MODUL_KODU FROM dbo.ADM_PAKET_MODUL WHERE MODUL_KODU = 'ebelge:e-belge/gider';
GO

SET NOEXEC OFF;
GO
