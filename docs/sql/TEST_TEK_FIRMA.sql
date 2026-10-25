/* =============================================================================
   TEST ORTAMI — tek firma (developer.likyakuyum.com; docs/CANLI_TEST_AYRIMI_YOL_HARITASI.md §9)

   LIKYA_ADMIN_TEST'te yalnız @KOD firması (varsayılan LIKYA01, veritabanı R2016_dvz_TEST) açık kalır ve BÜTÜN modülleri
   açılır; diğer firmalar testte PASIF + veritabanı adı TESTTE_YOK_ yapılır (testten hiçbir yoldan erişilmez).
   @SIL_KOPYALAR = 1 ise diğer firmaların _TEST kopya veritabanları da silinir (yalnız _TEST ile biten kopyalar; canlı
   veritabanlarına ve LIKYA_ADMIN_TEST'e dokunulmaz; gerekirse TEST_ORTAMI_KOPYALA.sql ile yeniden alınır).

   Önkoşul: TEST_ORTAMI_KOPYALA.sql çalışmış olmalı. SSMS'te çalıştırılır. Tekrar çalıştırılabilir.
   ============================================================================= */
USE LIKYA_ADMIN_TEST;
SET NOCOUNT ON;

DECLARE @KOD varchar(50) = 'LIKYA01';   -- testte kalacak firma
DECLARE @SIL_KOPYALAR bit = 0;           -- 1: diğer firmaların _TEST kopyalarını siler

IF DB_NAME() <> N'LIKYA_ADMIN_TEST'
BEGIN
  RAISERROR(N'Bu betik yalnız LIKYA_ADMIN_TEST üzerinde çalışır.', 16, 1);
  RETURN;
END

DECLARE @fid int, @db sysname;
SELECT @fid = FIRMA_ID, @db = DB_NAME FROM dbo.ADM_FIRMA WHERE FIRMA_KODU = @KOD;
IF @fid IS NULL OR @db NOT LIKE N'%[_]TEST' OR DB_ID(@db) IS NULL
BEGIN
  RAISERROR(N'%s firması yok ya da veritabanı bir _TEST kopyası değil (%s). Önce TEST_ORTAMI_KOPYALA.sql çalıştırılmalı.', 16, 1, @KOD, @db);
  RETURN;
END

-- 1) Test firmasının bütün modülleri açık (menü, API koruması ve kısayollar ADM_FIRMA_MODUL'den okunur)
MERGE dbo.ADM_FIRMA_MODUL AS t
USING (SELECT MODUL_KODU FROM dbo.ADM_MODUL) AS s
   ON t.FIRMA_ID = @fid AND t.MODUL_KODU = s.MODUL_KODU
 WHEN MATCHED AND t.ACIK = 0 THEN UPDATE SET ACIK = 1, DEGISTIRME_TARIHI = GETDATE()
 WHEN NOT MATCHED THEN INSERT (FIRMA_ID, MODUL_KODU, ACIK) VALUES (@fid, s.MODUL_KODU, 1);
UPDATE dbo.ADM_FIRMA SET DURUM = 'AKTIF' WHERE FIRMA_ID = @fid;

-- 2) Diğer firmalar testte kapalı; silinecek kopyaların adları önce alınır
DECLARE @kopyalar TABLE (ad sysname PRIMARY KEY);
-- Betik daha önce çalıştıysa adlar "TESTTE_YOK_" önekiyle durur; kopya adı önek atılarak bulunur
INSERT INTO @kopyalar (ad)
SELECT DISTINCT x.ad
  FROM dbo.ADM_FIRMA f
 CROSS APPLY (SELECT CASE WHEN f.DB_NAME LIKE N'TESTTE[_]YOK[_]%' THEN SUBSTRING(f.DB_NAME, 12, 200) ELSE f.DB_NAME END AS ad) x
 WHERE f.FIRMA_ID <> @fid AND x.ad LIKE N'%[_]TEST' AND x.ad <> @db AND x.ad <> N'LIKYA_ADMIN_TEST' AND DB_ID(x.ad) IS NOT NULL;
UPDATE dbo.ADM_FIRMA
   SET DURUM = 'PASIF', DB_NAME = CASE WHEN DB_NAME LIKE N'TESTTE[_]YOK[_]%' THEN DB_NAME ELSE N'TESTTE_YOK_' + ISNULL(DB_NAME, N'') END
 WHERE FIRMA_ID <> @fid AND (DURUM <> 'PASIF' OR DB_NAME NOT LIKE N'TESTTE[_]YOK[_]%');

-- 3) İstenirse diğer _TEST kopyaları silinir
IF @SIL_KOPYALAR = 1
BEGIN
  DECLARE @ad sysname, @sql nvarchar(max);
  DECLARE k CURSOR LOCAL FAST_FORWARD FOR SELECT ad FROM @kopyalar;
  OPEN k; FETCH NEXT FROM k INTO @ad;
  WHILE @@FETCH_STATUS = 0
  BEGIN
    IF @ad LIKE N'%[_]TEST' AND @ad <> @db AND @ad <> N'LIKYA_ADMIN_TEST'
    BEGIN
      SET @sql = N'ALTER DATABASE ' + QUOTENAME(@ad) + N' SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE ' + QUOTENAME(@ad) + N';';
      EXEC (@sql);
      PRINT N'Silindi: ' + @ad;
    END
    FETCH NEXT FROM k INTO @ad;
  END
  CLOSE k; DEALLOCATE k;
END

-- 4) Kontrol
PRINT N'=== Test firmaları ===';
SELECT FIRMA_KODU, UNVAN, DURUM, DB_NAME,
       CASE WHEN FIRMA_ID = @fid THEN N'TEST FİRMASI (açık)'
            WHEN DB_NAME LIKE N'TESTTE[_]YOK[_]%' THEN N'testte kapalı'
            ELSE N'!!! KONTROL EDİN' END AS Durum
  FROM dbo.ADM_FIRMA ORDER BY CASE WHEN FIRMA_ID = @fid THEN 0 ELSE 1 END, FIRMA_KODU;
SELECT (SELECT COUNT(*) FROM dbo.ADM_MODUL) AS KatalogModul,
       (SELECT COUNT(*) FROM dbo.ADM_FIRMA_MODUL WHERE FIRMA_ID = @fid AND ACIK = 1) AS TestFirmasindaAcik;
SELECT name AS KalanTestKopyasi FROM sys.databases WHERE name LIKE N'%[_]TEST' ORDER BY name;
