USE [master];
GO
/* =============================================================================
   LIKYA_SABLON — boş firma veritabanı şablonu
   docs/BULUT_VE_EXE_LISANS_YOL_HARITASI.md, bölüm 5

   CANLI VERİ GÜVENLİĞİ
   - Canlı R2016_dvz'ye HİÇBİR yazma yapılmaz. Ona yapılan tek işlem COPY_ONLY
     yedektir (okuma). COPY_ONLY mevcut yedek zincirini bozmaz.
   - Kopya yeni dosya adlarıyla (LIKYA_SABLON_*.mdf/.ldf) geri yüklenir. REPLACE
     kullanılmaz; aynı adda dosya/veritabanı varsa SQL Server işlemi reddeder.
   - Silme bölümü yalnızca LIKYA_SABLON içinde çalışır; çalışmadan önce bağlı olunan
     veritabanının adı ve bu oturumda 1. bölümün başarıyla bittiği kontrol edilir.
     Bir kontrol tutmazsa sonraki bölümler hiç çalışmaz (SET NOEXEC ON).
   - Alınan kopya (C:\LikyaYedek\Sablon\R2016_dvz_kaynak_<tarih>.bak) silinmez;
     aynı zamanda canlının güncel bir tam yedeğidir.

   KULLANIM (sunucuda, SSMS'te sysadmin ile, betiğin TAMAMI seçilerek):
     1) @UYGULA = 0 bırakıp çalıştırın. Hiçbir şey değişmez; tabloların KALACAK /
        BOŞALTILACAK listesi, veritabanı boyutu ve disk boşluğu gösterilir.
     2) Liste doğruysa @UYGULA = 1 yapıp tekrar çalıştırın (birkaç dakika sürer).
     3) Messages sekmesindeki çıktının tamamını geliştiriciye iletin.

   Yeniden oluşturmak gerekirse önce yalnızca şablonu silin:
     IF DB_ID(N'LIKYA_SABLON') IS NOT NULL DROP DATABASE [LIKYA_SABLON];
   ============================================================================= */

USE [master];
GO
SET NOEXEC OFF;
GO

/* ------------------------- 1. BÖLÜM: kontrol + kopya ------------------------ */
SET NOCOUNT ON;

-- Aşağıdaki satırda YALNIZCA rakamı değiştirin:  0 = yalnız listele,  1 = oluştur

DECLARE @UYGULA bit = 0;

DECLARE @kaynak sysname       = N'R2016_dvz';
DECLARE @hedef  sysname       = N'LIKYA_SABLON';
DECLARE @klasor nvarchar(260) = N'C:\LikyaYedek\Sablon\';

-- Verisi KALACAK tablolar. Burada olmayan her tablo şablonda boşaltılır.
IF OBJECT_ID('tempdb..#kalir') IS NOT NULL DROP TABLE #kalir;
CREATE TABLE #kalir (ad sysname COLLATE DATABASE_DEFAULT PRIMARY KEY);
INSERT #kalir (ad) VALUES
  (N'TODVZ_ALTIN_URUN'), (N'TODVZ_AYAR'), (N'TODVZ_BANKNOT'), (N'TODVZ_BANKO'),
  (N'TODVZ_BELGE_SABLON'), (N'TODVZ_DEVIR_AYARLARI'), (N'TODVZ_EBANKA_BANKA'),
  (N'TODVZ_EBANKA_HAREKET_TIPI'), (N'TODVZ_EBELGE_KOD'), (N'TODVZ_EKRAN_RAPORU'),
  (N'TODVZ_ETIKET_GRUP_NO'), (N'TODVZ_ETIKET_SABLON'), (N'TODVZ_FOREKS_PARA_KODU'),
  (N'TODVZ_GRID'), (N'TODVZ_HESAP'), (N'TODVZ_ISKONTO'), (N'TODVZ_ISTATISTIK'),
  (N'TODVZ_MUH_HESAP'), (N'TODVZ_NUMERATOR'), (N'TODVZ_PANO'), (N'TODVZ_PANO_SATIRI'),
  (N'TODVZ_PARA'), (N'TODVZ_TABLO_MADDESI'), (N'TODVZ_TANIM'),
  (N'TODVZ_TANIM_VERGI_SINIRI'), (N'TODVZ_ULKE'), (N'TODVZ_URUN_GRUP'),
  (N'TODVZ_VEZNE'),
  (N'TODVZ_YAZICI');   -- TODVZ_VEZNE ve TODVZ_NUMERATOR yabancı anahtarla buna bağlı

-- Güvenlik kontrolleri
IF DB_ID(@kaynak) IS NULL
BEGIN RAISERROR(N'DURDU: kaynak veritabanı bulunamadı: %s', 16, 1, @kaynak); SET NOEXEC ON; RETURN; END;
IF @hedef = @kaynak
BEGIN RAISERROR(N'DURDU: hedef ile kaynak aynı olamaz.', 16, 1); SET NOEXEC ON; RETURN; END;
IF EXISTS (SELECT 1 FROM sys.master_files WHERE database_id = DB_ID(@kaynak) AND type NOT IN (0, 1))
BEGIN RAISERROR(N'DURDU: kaynakta FILESTREAM/tam metin dosyası var; betik bunu desteklemiyor.', 16, 1); SET NOEXEC ON; RETURN; END;

-- Önizleme (yalnız okuma)
IF OBJECT_ID('tempdb..#liste') IS NOT NULL DROP TABLE #liste;
CREATE TABLE #liste (sema sysname COLLATE DATABASE_DEFAULT, tablo sysname COLLATE DATABASE_DEFAULT, satir bigint);
DECLARE @q nvarchar(max) = N'
  SELECT s.name, t.name, SUM(p.rows)
  FROM ' + QUOTENAME(@kaynak) + N'.sys.tables t
  JOIN ' + QUOTENAME(@kaynak) + N'.sys.schemas s ON s.schema_id = t.schema_id
  JOIN ' + QUOTENAME(@kaynak) + N'.sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0, 1)
  WHERE t.is_ms_shipped = 0
  GROUP BY s.name, t.name';
INSERT #liste EXEC sp_executesql @q;

SELECT l.tablo, l.satir,
       CASE WHEN k.ad IS NULL THEN N'BOŞALTILACAK' ELSE N'KALACAK' END AS islem
FROM #liste l LEFT JOIN #kalir k ON k.ad = l.tablo
ORDER BY CASE WHEN k.ad IS NULL THEN 1 ELSE 0 END, l.tablo;

SELECT k.ad AS [kalir_listesinde_ama_kaynakta_yok] FROM #kalir k
WHERE NOT EXISTS (SELECT 1 FROM #liste l WHERE l.tablo = k.ad);

SELECT CAST(SUM(CAST(size AS bigint)) * 8 / 1024 AS int) AS [kaynak_boyutu_MB]
FROM sys.master_files WHERE database_id = DB_ID(@kaynak);
EXEC master.sys.xp_fixeddrives;   -- sürücülerdeki boş alan (MB); kaynak boyutunun en az 2 katı boş olmalı

IF @UYGULA = 0
BEGIN
  PRINT N'ÖNİZLEME: hiçbir şey değiştirilmedi. Liste doğruysa @UYGULA = 1 yapıp tekrar çalıştırın.';
  SET NOEXEC ON; RETURN;
END;

IF DB_ID(@hedef) IS NOT NULL
BEGIN
  RAISERROR(N'DURDU: %s zaten var. Yeniden oluşturmak için önce yalnız onu silin (betiğin başındaki not).', 16, 1, @hedef);
  SET NOEXEC ON; RETURN;
END;

-- Canlının COPY_ONLY yedeği (okuma)
DECLARE @kopya nvarchar(400) = @klasor + @kaynak + N'_kaynak_' + FORMAT(GETDATE(), 'yyyyMMdd_HHmm') + N'.bak';
PRINT N'Kaynak yedeği alınıyor: ' + @kopya;
BEGIN TRY
  BACKUP DATABASE @kaynak TO DISK = @kopya WITH COPY_ONLY, INIT, CHECKSUM, STATS = 20;
END TRY
BEGIN CATCH
  DECLARE @h1 nvarchar(2048) = ERROR_MESSAGE();
  RAISERROR(N'DURDU: kaynak yedeği alınamadı: %s', 16, 1, @h1); SET NOEXEC ON; RETURN;
END CATCH;

-- Yeni dosya adlarıyla geri yükleme
DECLARE @veriYolu nvarchar(260) = CAST(SERVERPROPERTY('InstanceDefaultDataPath') AS nvarchar(260));
DECLARE @logYolu  nvarchar(260) = CAST(SERVERPROPERTY('InstanceDefaultLogPath')  AS nvarchar(260));
DECLARE @move nvarchar(max) = N'';
SELECT @move += N', MOVE N''' + REPLACE(name, '''', '''''') + N''' TO N'''
              + REPLACE(CASE WHEN type = 1 THEN @logYolu ELSE @veriYolu END + @hedef + N'_' + CAST(file_id AS nvarchar(10))
                        + CASE WHEN type = 1 THEN N'.ldf' WHEN file_id = 1 THEN N'.mdf' ELSE N'.ndf' END, '''', '''''') + N''''
FROM sys.master_files WHERE database_id = DB_ID(@kaynak);

DECLARE @restore nvarchar(max) = N'RESTORE DATABASE ' + QUOTENAME(@hedef)
  + N' FROM DISK = N''' + REPLACE(@kopya, '''', '''''') + N''' WITH RECOVERY, CHECKSUM, STATS = 20' + @move;
PRINT N'Şablon olarak geri yükleniyor: ' + @hedef;
BEGIN TRY
  EXEC (@restore);
END TRY
BEGIN CATCH
  DECLARE @h2 nvarchar(2048) = ERROR_MESSAGE();
  RAISERROR(N'DURDU: geri yükleme başarısız: %s', 16, 1, @h2); SET NOEXEC ON; RETURN;
END CATCH;

-- Kopya kaynakla aynı dosyaları kullanmıyor olmalı
IF DB_ID(@hedef) IS NULL
   OR EXISTS (SELECT 1 FROM sys.master_files h JOIN sys.master_files k ON k.physical_name = h.physical_name
              WHERE h.database_id = DB_ID(@hedef) AND k.database_id = DB_ID(@kaynak))
BEGIN RAISERROR(N'DURDU: şablon doğrulanamadı.', 16, 1); SET NOEXEC ON; RETURN; END;

DECLARE @sahip sysname = SUSER_SNAME(0x01);   -- sa (adı değiştirilmiş olsa da)
EXEC (N'ALTER DATABASE ' + N'[LIKYA_SABLON]' + N' SET RECOVERY SIMPLE;');
EXEC (N'ALTER AUTHORIZATION ON DATABASE::[LIKYA_SABLON] TO ' + N'[' + @sahip + N'];');

-- 2. bölümün yalnız bu oturumda, 1. bölüm başarıyla bittikten sonra çalışması için işaret
IF OBJECT_ID('tempdb..#sablon_onay') IS NOT NULL DROP TABLE #sablon_onay;
CREATE TABLE #sablon_onay (db_id int NOT NULL, bosaltildi bit NOT NULL DEFAULT 0);
INSERT #sablon_onay (db_id) VALUES (DB_ID(@hedef));
PRINT N'1. bölüm tamam: kopya oluştu, canlıya dokunulmadı.';
GO

/* --------------------- 2. BÖLÜM: şablonu boşalt (yalnız LIKYA_SABLON) --------------------- */
USE [LIKYA_SABLON];
GO
SET NOCOUNT ON;
IF DB_NAME() <> N'LIKYA_SABLON'
   OR OBJECT_ID('tempdb..#sablon_onay') IS NULL
   OR NOT EXISTS (SELECT 1 FROM #sablon_onay WHERE db_id = DB_ID())
BEGIN RAISERROR(N'DURDU: bağlı olunan veritabanı LIKYA_SABLON değil veya 1. bölüm bu oturumda çalışmadı.', 16, 1); SET NOEXEC ON; RETURN; END;

DECLARE @sql nvarchar(max), @uyari nvarchar(max) = N'';

BEGIN TRY
  /* a) Kaynaktan gelen veritabanı kullanıcılarını kaldır: canlı firmanın SQL hesabı yeni firmalara erişemesin */
  SET @sql = N'';
  SELECT @sql += N'ALTER AUTHORIZATION ON SCHEMA::' + QUOTENAME(s.name) + N' TO [dbo];'
  FROM sys.schemas s JOIN sys.database_principals p ON p.principal_id = s.principal_id
  WHERE p.type IN ('S', 'U', 'G', 'E', 'X', 'C', 'K') AND p.name NOT IN (N'dbo', N'guest', N'INFORMATION_SCHEMA', N'sys');
  SELECT @sql += N'ALTER AUTHORIZATION ON ROLE::' + QUOTENAME(r.name) + N' TO [dbo];'
  FROM sys.database_principals r JOIN sys.database_principals p ON p.principal_id = r.owning_principal_id
  WHERE r.type = 'R' AND p.type IN ('S', 'U', 'G', 'E', 'X', 'C', 'K') AND p.name NOT IN (N'dbo', N'guest', N'INFORMATION_SCHEMA', N'sys');
  SELECT @sql += N'DROP USER ' + QUOTENAME(name) + N';'
  FROM sys.database_principals
  WHERE type IN ('S', 'U', 'G', 'E', 'X', 'C', 'K') AND name NOT IN (N'dbo', N'guest', N'INFORMATION_SCHEMA', N'sys');
  IF LEN(@sql) > 0 EXEC (@sql);
  PRINT N'Veritabanı kullanıcıları kaldırıldı.';

  /* b) Açık tetikleri ve yabancı anahtarları geçici kapat (önceki hallerini hatırla) */
  IF OBJECT_ID('tempdb..#tetik') IS NOT NULL DROP TABLE #tetik;
  SELECT QUOTENAME(OBJECT_SCHEMA_NAME(parent_id)) + N'.' + QUOTENAME(OBJECT_NAME(parent_id)) AS tablo,
         QUOTENAME(OBJECT_SCHEMA_NAME(object_id)) + N'.' + QUOTENAME(name) AS ad
  INTO #tetik FROM sys.triggers WHERE parent_class = 1 AND is_disabled = 0;

  IF OBJECT_ID('tempdb..#fk') IS NOT NULL DROP TABLE #fk;
  SELECT QUOTENAME(OBJECT_SCHEMA_NAME(parent_object_id)) + N'.' + QUOTENAME(OBJECT_NAME(parent_object_id)) AS tablo,
         QUOTENAME(name) AS ad, is_not_trusted
  INTO #fk FROM sys.foreign_keys WHERE is_disabled = 0;

  SET @sql = N'';
  SELECT @sql += N'DISABLE TRIGGER ' + ad + N' ON ' + tablo + N';' FROM #tetik;
  SELECT @sql += N'ALTER TABLE ' + tablo + N' NOCHECK CONSTRAINT ' + ad + N';' FROM #fk;
  IF LEN(@sql) > 0 EXEC (@sql);

  /* c) Kalır listesinde olmayan tabloları boşalt. Başka tablo ona bağlı değilse TRUNCATE (hızlı), değilse DELETE. */
  DECLARE @tablo nvarchar(300), @oid int, @bagli bit, @tohum nvarchar(50);
  DECLARE t CURSOR LOCAL FAST_FORWARD FOR
    SELECT QUOTENAME(SCHEMA_NAME(tb.schema_id)) + N'.' + QUOTENAME(tb.name), tb.object_id,
           CASE WHEN EXISTS (SELECT 1 FROM sys.foreign_keys f WHERE f.referenced_object_id = tb.object_id) THEN 1 ELSE 0 END
    FROM sys.tables tb
    WHERE tb.is_ms_shipped = 0 AND NOT EXISTS (SELECT 1 FROM #kalir k WHERE k.ad = tb.name COLLATE DATABASE_DEFAULT)   -- sunucu ve şablon harf düzeni farklı olabilir
    ORDER BY tb.name;
  OPEN t;
  FETCH NEXT FROM t INTO @tablo, @oid, @bagli;
  WHILE @@FETCH_STATUS = 0
  BEGIN
    IF @bagli = 0
    BEGIN
      BEGIN TRY
        EXEC (N'TRUNCATE TABLE ' + @tablo + N';');
      END TRY
      BEGIN CATCH
        SET @bagli = 1;
      END CATCH;
    END;
    IF @bagli = 1
    BEGIN
      EXEC (N'DELETE FROM ' + @tablo + N';');
      IF EXISTS (SELECT 1 FROM sys.identity_columns WHERE object_id = @oid AND last_value IS NOT NULL)
      BEGIN
        SET @tohum = CONVERT(nvarchar(50), CAST(IDENT_SEED(@tablo) - IDENT_INCR(@tablo) AS decimal(38, 0)));
        EXEC (N'DBCC CHECKIDENT (''' + @tablo + N''', RESEED, ' + @tohum + N') WITH NO_INFOMSGS;');
      END;
    END;
    FETCH NEXT FROM t INTO @tablo, @oid, @bagli;
  END;
  CLOSE t; DEALLOCATE t;
  PRINT N'Hareket ve log tabloları boşaltıldı.';

  /* d) TODVZ_TANIM: firmaya özel metinleri temizle (yeni firma oluşturulurken uygulama yazar). Kimlik (_ID) kolonlarına dokunulmaz. */
  IF OBJECT_ID(N'dbo.TODVZ_TANIM') IS NOT NULL
  BEGIN
    SET @sql = N'';
    SELECT @sql += N', ' + QUOTENAME(c.name) + N' = ' + CASE WHEN ty.name IN ('int', 'smallint', 'tinyint', 'bigint') THEN N'0' ELSE N'''''' END
    FROM sys.columns c JOIN sys.types ty ON ty.user_type_id = c.user_type_id
    WHERE c.object_id = OBJECT_ID(N'dbo.TODVZ_TANIM')
      AND c.name IN (N'FIRMA_ADI', N'SUBE_ADI', N'VERGI_KIMLIK_NO', N'ADRES', N'TELEFON', N'WEB_ADRESI', N'EPOSTA',
                     N'MERSIS_NO', N'TICARET_SICIL_NO', N'DOSYA_NO', N'VERGI_SORGULAYAN_TC_NO', N'MUSAVIR_TURMOB_SIFRESI',
                     N'DEGISIKLIK_TAKIP_SIFRESI', N'E_FATURA_POSTA_KUTUSU', N'E_IRSALIYE_POSTA_KUTUSU',
                     N'E_BELGE_SERVER_IP', N'E_FATURA_PORTAL_ADRESI', N'CARI_KOD_SIRA_NO');
    IF LEN(@sql) > 0
    BEGIN
      SET @sql = N'UPDATE [dbo].[TODVZ_TANIM] SET ' + STUFF(@sql, 1, 2, N'') + N';';
      EXEC (@sql);
    END;
    PRINT N'TODVZ_TANIM firma bilgileri temizlendi.';
  END;

  /* e) Yabancı anahtarları ve tetikleri eski haline getir. Güvenilir olan anahtar yeniden DOĞRULANARAK açılır;
        doğrulama tutmazsa (kalan bir tablo boşaltılan bir tabloya bağlı) uyarı yazılır. */
  DECLARE @ad nvarchar(300), @guvensiz bit;
  DECLARE f CURSOR LOCAL FAST_FORWARD FOR SELECT tablo, ad, is_not_trusted FROM #fk;
  OPEN f;
  FETCH NEXT FROM f INTO @tablo, @ad, @guvensiz;
  WHILE @@FETCH_STATUS = 0
  BEGIN
    BEGIN TRY
      IF @guvensiz = 0 EXEC (N'ALTER TABLE ' + @tablo + N' WITH CHECK CHECK CONSTRAINT ' + @ad + N';');
      ELSE EXEC (N'ALTER TABLE ' + @tablo + N' CHECK CONSTRAINT ' + @ad + N';');
    END TRY
    BEGIN CATCH
      SET @uyari += NCHAR(13) + NCHAR(10) + N'  ' + @tablo + N' ' + @ad + N': ' + ERROR_MESSAGE();
      EXEC (N'ALTER TABLE ' + @tablo + N' CHECK CONSTRAINT ' + @ad + N';');
    END CATCH;
    FETCH NEXT FROM f INTO @tablo, @ad, @guvensiz;
  END;
  CLOSE f; DEALLOCATE f;

  SET @sql = N'';
  SELECT @sql += N'ENABLE TRIGGER ' + ad + N' ON ' + tablo + N';' FROM #tetik;
  IF LEN(@sql) > 0 EXEC (@sql);
  PRINT N'Yabancı anahtarlar ve tetikler eski haline getirildi.';
END TRY
BEGIN CATCH
  DECLARE @h3 nvarchar(2048) = ERROR_MESSAGE();
  RAISERROR(N'DURDU (yalnız şablon etkilendi, canlıya dokunulmadı): %s', 16, 1, @h3); SET NOEXEC ON; RETURN;
END CATCH;

-- Şablonda verisi kalan tablolar (kontrol için)
SELECT t.name AS tablo, SUM(p.rows) AS satir
FROM sys.tables t JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0, 1)
WHERE t.is_ms_shipped = 0
GROUP BY t.name HAVING SUM(p.rows) > 0
ORDER BY t.name;

IF LEN(@uyari) > 0
BEGIN
  RAISERROR(N'DURDU: şu yabancı anahtarlar doğrulanamadı (kalan tablo boşaltılan tabloya bağlı). Şablon yedeği ALINMADI. Bu çıktıyı geliştiriciye iletin:%s', 16, 1, @uyari);
  SET NOEXEC ON; RETURN;
END;
UPDATE #sablon_onay SET bosaltildi = 1;   -- 3. bölüm yalnız bu işaret varsa çalışır
PRINT N'2. bölüm tamam.';
GO

/* ------------------------- 3. BÖLÜM: küçült + şablon yedeği ------------------------- */
USE [master];
GO
IF OBJECT_ID('tempdb..#sablon_onay') IS NULL OR DB_ID(N'LIKYA_SABLON') IS NULL
   OR NOT EXISTS (SELECT 1 FROM #sablon_onay WHERE db_id = DB_ID(N'LIKYA_SABLON') AND bosaltildi = 1)
BEGIN RAISERROR(N'DURDU: 2. bölüm (boşaltma) başarıyla bitmedi; şablon yedeği alınmadı.', 16, 1); SET NOEXEC ON; RETURN; END;

DBCC SHRINKDATABASE (N'LIKYA_SABLON') WITH NO_INFOMSGS;
-- likya_klon varsa şablonun sahibi o olur: şablondan açılan veritabanlarına bu hesap girebilsin (SABLON_SAHIPLIGI.sql)
IF SUSER_ID(N'likya_klon') IS NOT NULL
BEGIN
  EXEC (N'USE [LIKYA_SABLON]; IF USER_ID(N''likya_klon'') IS NOT NULL DROP USER [likya_klon];');
  ALTER AUTHORIZATION ON DATABASE::[LIKYA_SABLON] TO [likya_klon];
END;
BACKUP DATABASE [LIKYA_SABLON] TO DISK = N'C:\LikyaYedek\Sablon\sablon.bak' WITH INIT, CHECKSUM, STATS = 20;
RESTORE VERIFYONLY FROM DISK = N'C:\LikyaYedek\Sablon\sablon.bak' WITH CHECKSUM;

SELECT CAST(SUM(CAST(size AS bigint)) * 8 / 1024 AS int) AS [sablon_boyutu_MB]
FROM sys.master_files WHERE database_id = DB_ID(N'LIKYA_SABLON');
PRINT N'TAMAM: LIKYA_SABLON hazır, yedeği C:\LikyaYedek\Sablon\sablon.bak. Canlı R2016_dvz değişmedi.';

DROP TABLE #sablon_onay;
DROP TABLE #kalir;
GO

SET NOEXEC OFF;
GO
