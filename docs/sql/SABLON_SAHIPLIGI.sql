USE [master];
GO
/* =============================================================================
   LIKYA_SABLON sahipliğini likya_klon'a ver ve şablon yedeğini yeniden al
   docs/BULUT_VE_EXE_LISANS_YOL_HARITASI.md, K2

   NEDEN: Şablondan geri yüklenen her veritabanı, şablonun içindeki sahip (dbo)
   bilgisini taşır. Sahip sa kalırsa likya_klon yeni açtığı veritabanına giremez
   ve gerektiğinde silemez. Sahip likya_klon olunca her yeni firma veritabanının
   sahibi de likya_klon olur.

   Canlı firma veritabanlarına DOKUNMAZ; yalnız LIKYA_SABLON ve sablon.bak değişir.
   KLON_HESABI.sql'den SONRA, sunucuda SSMS'te sysadmin ile, betiğin TAMAMI F5.
   Tekrar çalıştırılabilir.
   ============================================================================= */
SET NOCOUNT ON;

IF DB_ID(N'LIKYA_SABLON') IS NULL
BEGIN RAISERROR(N'DURDU: LIKYA_SABLON bulunamadı.', 16, 1); SET NOEXEC ON; RETURN; END;
IF SUSER_ID(N'likya_klon') IS NULL
BEGIN RAISERROR(N'DURDU: likya_klon girişi yok; önce KLON_HESABI.sql çalıştırılmalı.', 16, 1); SET NOEXEC ON; RETURN; END;

-- likya_klon şablonda ayrı bir kullanıcıysa önce kaldırılır (sahip olacak hesap aynı zamanda kullanıcı olamaz)
EXEC (N'USE [LIKYA_SABLON]; IF USER_ID(N''likya_klon'') IS NOT NULL DROP USER [likya_klon];');
ALTER AUTHORIZATION ON DATABASE::[LIKYA_SABLON] TO [likya_klon];
DECLARE @sahip sysname = (SELECT SUSER_SNAME(owner_sid) FROM sys.databases WHERE name = N'LIKYA_SABLON');
PRINT N'LIKYA_SABLON sahibi: ' + @sahip;

BACKUP DATABASE [LIKYA_SABLON] TO DISK = N'C:\LikyaYedek\Sablon\sablon.bak' WITH INIT, CHECKSUM;
RESTORE VERIFYONLY FROM DISK = N'C:\LikyaYedek\Sablon\sablon.bak' WITH CHECKSUM;
PRINT N'TAMAM: şablon sahibi likya_klon, sablon.bak yeniden alındı.';
GO
SET NOEXEC OFF;
GO
