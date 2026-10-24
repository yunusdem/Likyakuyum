/* =============================================================================
   TEST ORTAMI — LIKYA_ADMIN ve tüm firma veritabanlarının _TEST kopyaları
   (docs/CANLI_TEST_AYRIMI_YOL_HARITASI.md §7B.3, karar: A = her firma kendi kopyasıyla)

   SSMS'te master üzerinde çalıştırılır. İki kipte:
     @UYGULA = 0  (varsayılan)  YALNIZ RAPOR: boyutlar, boş disk, sunucuda olmayan firmalar ve başka veritabanına
                                 erişen nesneler. Hiçbir şey değiştirmez.
     @UYGULA = 1               KOPYALAR: her kaynak için COPY_ONLY yedek + <ad>_TEST adıyla geri yükleme, yetim
                                 kullanıcıları bağlama, kopyada BAŞKA VERİTABANINA YAZAN TETİKLEYİCİLERİ KAPATMA,
                                 LIKYA_ADMIN_TEST'te firmaları kopyalara yönlendirme, kopyası olmayan firmaları kapatma.
   Canlı veritabanlarına dokunmaz (yalnız COPY_ONLY yedek alır; canlı yedek zincirini bozmaz).
   Tekrar çalıştırılabilir: var olan _TEST kopyası atlanır; @TAZELE = 1 ise silinip canlıdan yeniden alınır.
   ============================================================================= */
USE master;
SET NOCOUNT ON;

DECLARE @UYGULA bit = 0;   -- 1 yapınca kopyalar
DECLARE @TAZELE bit = 0;   -- 1: var olan _TEST kopyalarını silip canlıdan yeniden alır
DECLARE @YEDEK  nvarchar(260) = N'C:\LikyaYedek\TestKopya\';

DECLARE @DATA nvarchar(260) = CAST(SERVERPROPERTY('InstanceDefaultDataPath') AS nvarchar(260));
DECLARE @LOGY nvarchar(260) = CAST(SERVERPROPERTY('InstanceDefaultLogPath') AS nvarchar(260));
IF RIGHT(@DATA, 1) <> N'\' SET @DATA += N'\';
IF RIGHT(@LOGY, 1) <> N'\' SET @LOGY += N'\';

-- 1) Kopyalanacaklar: yönetim veritabanı + sunucuda VAR OLAN firma veritabanları
IF OBJECT_ID('tempdb..#liste') IS NOT NULL DROP TABLE #liste;
CREATE TABLE #liste (kaynak sysname NOT NULL PRIMARY KEY, hedef sysname NOT NULL, mb decimal(12, 1) NULL);
INSERT INTO #liste (kaynak, hedef) VALUES (N'LIKYA_ADMIN', N'LIKYA_ADMIN_TEST');
INSERT INTO #liste (kaynak, hedef)
SELECT DISTINCT f.DB_NAME, f.DB_NAME + N'_TEST'
  FROM LIKYA_ADMIN.dbo.ADM_FIRMA f
 WHERE f.DB_NAME IS NOT NULL AND DB_ID(f.DB_NAME) IS NOT NULL
   AND f.DB_NAME NOT IN (N'LIKYA_ADMIN', N'LIKYA_ADMIN_TEST') AND f.DB_NAME NOT LIKE N'%[_]TEST';
UPDATE l SET mb = (SELECT CAST(SUM(mf.size) * 8 / 1024.0 AS decimal(12, 1)) FROM sys.master_files mf WHERE mf.database_id = DB_ID(l.kaynak))
  FROM #liste l;

PRINT N'=== Kopyalanacak veritabanları ===';
SELECT kaynak AS Kaynak, hedef AS Kopya, mb AS BoyutMB,
       CASE WHEN DB_ID(hedef) IS NULL THEN N'yok' ELSE N'VAR' END AS KopyaSunucuda
  FROM #liste ORDER BY kaynak;
SELECT CAST(SUM(mb) / 1024.0 AS decimal(12, 2)) AS ToplamGB_Kopyalar,
       CAST(SUM(mb) / 1024.0 AS decimal(12, 2)) AS AyricaGeciciYedekGB_EnFazla
  FROM #liste;
PRINT N'=== Disklerdeki boş alan (MB) ===';
EXEC master.sys.xp_fixeddrives;

PRINT N'=== Sunucuda veritabanı OLMAYAN firmalar (testte kapatılacak) ===';
SELECT FIRMA_KODU, UNVAN, BAGLANTI_MODU, DB_NAME
  FROM LIKYA_ADMIN.dbo.ADM_FIRMA
 WHERE DB_NAME IS NULL OR DB_ID(DB_NAME) IS NULL
 ORDER BY FIRMA_KODU;

-- 2) Başka veritabanına erişen nesneler (şifreli tetikleyici/yordamlar dahil; bağımlılık kaydından)
IF OBJECT_ID('tempdb..#capraz') IS NOT NULL DROP TABLE #capraz;
CREATE TABLE #capraz (kaynak sysname, nesne nvarchar(300), tur nvarchar(60), tablo nvarchar(300) NULL, hedefDb sysname);
DECLARE @k sysname, @h sysname, @sql nvarchar(max);
DECLARE c CURSOR LOCAL FAST_FORWARD FOR SELECT kaynak FROM #liste;
OPEN c; FETCH NEXT FROM c INTO @k;
WHILE @@FETCH_STATUS = 0
BEGIN
  SET @sql = N'USE ' + QUOTENAME(@k) + N';
    SELECT DISTINCT DB_NAME(), OBJECT_SCHEMA_NAME(d.referencing_id) + N''.'' + OBJECT_NAME(d.referencing_id), o.type_desc,
           CASE WHEN t.parent_id IS NOT NULL THEN OBJECT_SCHEMA_NAME(t.parent_id) + N''.'' + OBJECT_NAME(t.parent_id) END,
           d.referenced_database_name
      FROM sys.sql_expression_dependencies d
      JOIN sys.objects o ON o.object_id = d.referencing_id
      LEFT JOIN sys.triggers t ON t.object_id = d.referencing_id AND t.parent_class = 1
     WHERE d.referenced_database_name IS NOT NULL AND d.referenced_database_name <> DB_NAME();';
  INSERT INTO #capraz EXEC (@sql);
  FETCH NEXT FROM c INTO @k;
END
CLOSE c; DEALLOCATE c;
PRINT N'=== Başka veritabanına erişen nesneler (özet) ===';
SELECT hedefDb AS ErisilenVeritabani, tur AS Tur, COUNT(*) AS Adet, COUNT(DISTINCT kaynak) AS KacFirmada
  FROM #capraz GROUP BY hedefDb, tur ORDER BY hedefDb, tur;

IF @UYGULA = 0
BEGIN
  PRINT N'';
  PRINT N'RAPOR BİTTİ. Hiçbir şey değiştirilmedi. Disk yeterliyse @UYGULA = 1 yapıp yeniden çalıştırın.';
  RETURN;
END

-- 3) Kopyalama
EXEC master.sys.xp_create_subdir @YEDEK;
DECLARE @bak nvarchar(400), @move nvarchar(max), @adet int;
DECLARE k CURSOR LOCAL FAST_FORWARD FOR SELECT kaynak, hedef FROM #liste ORDER BY CASE WHEN kaynak = N'LIKYA_ADMIN' THEN 0 ELSE 1 END, kaynak;
OPEN k; FETCH NEXT FROM k INTO @k, @h;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF DB_ID(@h) IS NOT NULL AND @TAZELE = 1
  BEGIN
    PRINT N'Siliniyor (tazele): ' + @h;
    SET @sql = N'ALTER DATABASE ' + QUOTENAME(@h) + N' SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE ' + QUOTENAME(@h) + N';';
    EXEC (@sql);
  END
  IF DB_ID(@h) IS NOT NULL
    PRINT N'Atlandı (kopya zaten var): ' + @h;
  ELSE
  BEGIN
    SET @bak = @YEDEK + @k + N'.bak';
    PRINT CONVERT(nvarchar(19), GETDATE(), 120) + N'  Yedek: ' + @k;
    BACKUP DATABASE @k TO DISK = @bak WITH COPY_ONLY, INIT, FORMAT, CHECKSUM;

    SELECT @move = STRING_AGG(CAST(N'MOVE N''' + REPLACE(mf.name, N'''', N'''''') + N''' TO N''' +
             CASE WHEN mf.type = 1 THEN @LOGY ELSE @DATA END + @h + N'_' + CAST(mf.file_id AS nvarchar(10)) +
             CASE WHEN mf.type = 1 THEN N'.ldf' WHEN mf.file_id = 1 THEN N'.mdf' ELSE N'.ndf' END + N'''' AS nvarchar(max)), N', ')
      FROM sys.master_files mf WHERE mf.database_id = DB_ID(@k);
    PRINT CONVERT(nvarchar(19), GETDATE(), 120) + N'  Geri yükleme: ' + @h;
    SET @sql = N'RESTORE DATABASE ' + QUOTENAME(@h) + N' FROM DISK = N''' + @bak + N''' WITH ' + @move + N', RECOVERY;';
    EXEC (@sql);
    SET @sql = N'ALTER DATABASE ' + QUOTENAME(@h) + N' SET RECOVERY SIMPLE;';
    EXEC (@sql);

    -- Yetim SQL kullanıcılarını aynı adlı sunucu girişine bağla (uygulama ve klon hesabı)
    SET @sql = N'USE ' + QUOTENAME(@h) + N';
      DECLARE @s nvarchar(max);
      SELECT @s = STRING_AGG(CAST(N''ALTER USER '' + QUOTENAME(dp.name) + N'' WITH LOGIN = '' + QUOTENAME(sp.name) + N'';'' AS nvarchar(max)), N'' '')
        FROM sys.database_principals dp JOIN sys.server_principals sp ON sp.name COLLATE DATABASE_DEFAULT = dp.name COLLATE DATABASE_DEFAULT AND sp.type = ''S''
       WHERE dp.type = ''S'' AND dp.sid <> sp.sid;
      IF @s IS NOT NULL EXEC (@s);';
    EXEC (@sql);

    -- Başka veritabanına erişen tetikleyicileri kopyada kapat (ör. merkezdeki ortak K2016_dvz'ye yazanlar):
    -- test kopyası gerçek ortak veritabanına hiçbir şey yazmasın
    SET @sql = N'USE ' + QUOTENAME(@h) + N';
      DECLARE @s nvarchar(max), @n int;
      SELECT @n = COUNT(*), @s = STRING_AGG(CAST(N''DISABLE TRIGGER '' + QUOTENAME(OBJECT_SCHEMA_NAME(t.object_id)) + N''.'' + QUOTENAME(t.name) +
               N'' ON '' + QUOTENAME(OBJECT_SCHEMA_NAME(t.parent_id)) + N''.'' + QUOTENAME(OBJECT_NAME(t.parent_id)) + N'';'' AS nvarchar(max)), N'' '')
        FROM sys.triggers t
       WHERE t.parent_class = 1 AND t.is_disabled = 0
         AND EXISTS (SELECT 1 FROM sys.sql_expression_dependencies d
                      WHERE d.referencing_id = t.object_id AND d.referenced_database_name IS NOT NULL
                        AND d.referenced_database_name <> DB_NAME());
      IF @s IS NOT NULL EXEC (@s);
      PRINT N''  Kapatılan tetikleyici: '' + CAST(ISNULL(@n, 0) AS nvarchar(10));';
    EXEC (@sql);
    PRINT CONVERT(nvarchar(19), GETDATE(), 120) + N'  Tamam: ' + @h;
  END
  FETCH NEXT FROM k INTO @k, @h;
END
CLOSE k; DEALLOCATE k;

-- 4) LIKYA_ADMIN_TEST: firmaları kopyalara yönlendir; kopyası olmayanları kapat (gerçek veriye hiçbir yoldan ulaşılmasın)
IF DB_ID(N'LIKYA_ADMIN_TEST') IS NULL
BEGIN
  RAISERROR(N'LIKYA_ADMIN_TEST oluşmadı; firmalar yönlendirilemedi.', 16, 1);
  RETURN;
END
UPDATE LIKYA_ADMIN_TEST.dbo.ADM_FIRMA
   SET DB_NAME = DB_NAME + N'_TEST'
 WHERE DB_NAME NOT LIKE N'%[_]TEST' AND DB_NAME NOT LIKE N'TESTTE[_]YOK[_]%' AND DB_ID(DB_NAME + N'_TEST') IS NOT NULL;
UPDATE LIKYA_ADMIN_TEST.dbo.ADM_FIRMA
   SET DURUM = 'PASIF', DB_NAME = N'TESTTE_YOK_' + ISNULL(DB_NAME, N'')
 WHERE ISNULL(DB_NAME, N'') NOT LIKE N'%[_]TEST' AND ISNULL(DB_NAME, N'') NOT LIKE N'TESTTE[_]YOK[_]%';

PRINT N'=== LIKYA_ADMIN_TEST firmaları (kontrol: hepsi _TEST ya da TESTTE_YOK olmalı) ===';
SELECT FIRMA_KODU, UNVAN, DURUM, BAGLANTI_MODU, DB_NAME,
       CASE WHEN DB_NAME LIKE N'%[_]TEST' AND DB_ID(DB_NAME) IS NOT NULL THEN N'kopyaya bağlı'
            WHEN DB_NAME LIKE N'TESTTE[_]YOK[_]%' THEN N'testte kapalı'
            ELSE N'!!! GERÇEK VERİTABANI — DURUN' END AS Durum
  FROM LIKYA_ADMIN_TEST.dbo.ADM_FIRMA ORDER BY FIRMA_KODU;
PRINT N'';
PRINT N'BİTTİ. Geçici yedekler ' + @YEDEK + N' klasöründe; test backend açıldıktan sonra silinebilir.';
