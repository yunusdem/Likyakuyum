USE [master];
GO
/* =============================================================================
   Veri Aktar (eski programdan yedek) — geçici veritabanının sahipliği
   docs/VERITABANI_TASIMA_YOL_HARITASI.md, K20

   NEDEN: Müşterinin yedeği kendi bilgisayarındaki sahip (dbo) bilgisini taşır.
   likya_klon (sysadmin DEĞİL) yedeği LKY_AKTARIM_<no> adıyla geri yükleyebilir ama
   içine giremez, sahipliğini alamaz, silemez:
     "The server principal likya_klon is not able to access the database
      LKY_AKTARIM_... under the current security context." (Msg 916)

   ÇÖZÜM: master'da sertifikayla imzalı TEK bir yordam. Yalnız şunu yapar:
   adı LKY_AKTARIM_ ile başlayan VE çağıran hesabın kendisinin geri yüklediği
   (sys.databases sahibi çağıran olan) veritabanının sahipliğini çağırana verir.
   Başka hiçbir veritabanına dokunamaz. likya_klon'a yeni sunucu yetkisi verilmez,
   yalnız bu yordamı çalıştırma izni. İmzadan sonra sertifikanın özel anahtarı
   silinir: bu sertifikayla başka kod imzalanamaz.

   KULLANIM: sunucuda SSMS'te sysadmin ile, KLON_HESABI.sql'den SONRA, betiğin
   TAMAMI F5. Tekrar çalıştırılabilir. Canlı firma veritabanlarına DOKUNMAZ.
   ============================================================================= */
SET NOCOUNT ON;

DECLARE @klon sysname = N'likya_klon';

IF SUSER_ID(@klon) IS NULL
BEGIN RAISERROR(N'DURDU: %s girişi yok; önce KLON_HESABI.sql çalıştırılmalı.', 16, 1, @klon); RETURN; END;

/* 1) Eskisi varsa kaldır */
IF OBJECT_ID(N'dbo.LKY_AKTARIM_SAHIPLIK', N'P') IS NOT NULL DROP PROCEDURE dbo.LKY_AKTARIM_SAHIPLIK;
IF SUSER_ID(N'LKY_AKTARIM_IMZA') IS NOT NULL DROP LOGIN [LKY_AKTARIM_IMZA];
IF CERT_ID(N'LKY_AKTARIM_IMZA') IS NOT NULL DROP CERTIFICATE [LKY_AKTARIM_IMZA];

/* 2) Yordam */
EXEC (N'CREATE PROCEDURE dbo.LKY_AKTARIM_SAHIPLIK @db sysname
AS
BEGIN
  SET NOCOUNT ON;
  IF @db IS NULL OR LEN(@db) > 100 OR @db NOT LIKE N''LKY[_]AKTARIM[_]%''
     OR @db COLLATE Latin1_General_BIN LIKE N''%[^A-Za-z0-9_]%''
  BEGIN RAISERROR(N''Yalnız LKY_AKTARIM_ ile başlayan geçici veritabanları.'', 16, 1); RETURN; END;
  DECLARE @sahip varbinary(85) = (SELECT owner_sid FROM sys.databases WHERE name = @db);
  IF @sahip IS NULL BEGIN RAISERROR(N''Geçici veritabanı bulunamadı: %s'', 16, 1, @db); RETURN; END;
  IF @sahip <> SUSER_SID(ORIGINAL_LOGIN())
  BEGIN RAISERROR(N''Bu geçici veritabanını siz açmadınız: %s'', 16, 1, @db); RETURN; END;
  DECLARE @k nvarchar(400) = N''ALTER AUTHORIZATION ON DATABASE::'' + QUOTENAME(@db) + N'' TO '' + QUOTENAME(ORIGINAL_LOGIN()) + N'';'';
  EXEC (@k);
END');

/* 3) İmza: rastgele şifreli sertifika; imzadan sonra özel anahtar silinir */
DECLARE @s nvarchar(100) = CONVERT(nvarchar(36), NEWID()) + N'aA1!' + CONVERT(nvarchar(36), NEWID());
DECLARE @k nvarchar(max) = N'CREATE CERTIFICATE [LKY_AKTARIM_IMZA] ENCRYPTION BY PASSWORD = ' + QUOTENAME(@s, '''')
  + N' WITH SUBJECT = N''Likya veri aktarimi - gecici veritabani sahipligi'', EXPIRY_DATE = ''20991231'';';
EXEC (@k);
SET @k = N'ADD SIGNATURE TO dbo.LKY_AKTARIM_SAHIPLIK BY CERTIFICATE [LKY_AKTARIM_IMZA] WITH PASSWORD = ' + QUOTENAME(@s, '''') + N';';
EXEC (@k);
ALTER CERTIFICATE [LKY_AKTARIM_IMZA] REMOVE PRIVATE KEY;
CREATE LOGIN [LKY_AKTARIM_IMZA] FROM CERTIFICATE [LKY_AKTARIM_IMZA];
GRANT CONTROL SERVER TO [LKY_AKTARIM_IMZA]; -- yalnız imzalı yordamın içinde geçerli (bu girişle oturum açılamaz)

/* 4) likya_klon yalnız bu yordamı çalıştırabilir */
IF USER_ID(@klon) IS NULL BEGIN SET @k = N'CREATE USER ' + QUOTENAME(@klon) + N' FOR LOGIN ' + QUOTENAME(@klon) + N';'; EXEC (@k); END;
SET @k = N'GRANT EXECUTE ON dbo.LKY_AKTARIM_SAHIPLIK TO ' + QUOTENAME(@klon) + N';';
EXEC (@k);

PRINT N'TAMAM: dbo.LKY_AKTARIM_SAHIPLIK kuruldu, ' + @klon + N' çalıştırabilir.';
GO
