USE [master];
GO
/* =============================================================================
   likya_klon — bulut firma veritabanlarını açan / yedekleyen / silen SQL hesabı
   docs/BULUT_VE_EXE_LISANS_YOL_HARITASI.md, K2 ve K20

   YETKİLER (bilerek dar tutuldu):
   - CREATE ANY DATABASE : şablondan yeni veritabanı açar. Açtığı veritabanının
                           SAHİBİ olur; yalnız onları yedekleyip silebilir.
   - ALTER ANY LOGIN     : yeni firmaya SQL girişi açar, silinen firmanınkini kaldırır.
   - LIKYA_SABLON'un SAHİBİ olur: şema güncellemelerini şablona uygular ve şablondan
                           açılan her veritabanının sahibi de kendisi olur (aksi halde
                           yeni veritabanına giremez). Şablon yedeği bu yüzden yeniden alınır.
   - Mevcut bulut firmalarında (aşağıdaki liste) yedek + şema güncelleme +
     okuma/yazma; db_owner DEĞİL. Bu yüzden bu hesap mevcut firmaları SİLEMEZ.
   - sysadmin / dbcreator DEĞİL: LIKYA_ADMIN'i veya canlı firmaları düşüremez.

   KULLANIM (sunucuda, SSMS'te sysadmin ile):
     1) Aşağıdaki @sifre satırına en az 16 karakterli güçlü bir şifre yazın
        (yalnız tırnak içini değiştirin).
     2) @firmalar satırında sunucudaki mevcut bulut firma veritabanları virgülle
        yazılı; eksik varsa ekleyin.
     3) Betiğin tamamını F5 ile çalıştırın.
     4) Aynı şifreyi sunucuda Backend\.env.local dosyasına yazın:
          KLON_DB_USER=likya_klon
          KLON_DB_PASSWORD=<şifre>
        (Bu satırlar Faz 1 kodu gelene kadar kullanılmaz; şimdiden yazmak zararsız.)

   Tekrar çalıştırılabilir. Hesap zaten varsa şifresi DEĞİŞTİRİLMEZ, yalnız
   eksik yetkiler tamamlanır.
   ============================================================================= */
SET NOCOUNT ON;

DECLARE @sifre    nvarchar(128) = N'BURAYA_GUCLU_SIFRE';
DECLARE @firmalar nvarchar(max) = N'R2016_dvz,a2016_dvz';

IF @sifre = N'BURAYA_GUCLU_SIFRE' OR LEN(@sifre) < 16
BEGIN RAISERROR(N'DURDU: @sifre satırına en az 16 karakterli bir şifre yazın.', 16, 1); RETURN; END;

/* 1) Giriş hesabı */
IF SUSER_ID(N'likya_klon') IS NULL
BEGIN
  DECLARE @l nvarchar(max) = N'CREATE LOGIN [likya_klon] WITH PASSWORD = N''' + REPLACE(@sifre, '''', '''''')
    + N''', CHECK_POLICY = ON, CHECK_EXPIRATION = OFF, DEFAULT_DATABASE = [master];';
  EXEC (@l);
  PRINT N'likya_klon girişi oluşturuldu.';
END
ELSE PRINT N'likya_klon zaten var; şifresi değiştirilmedi.';

/* 2) Sunucu yetkileri */
GRANT CREATE ANY DATABASE TO [likya_klon];
GRANT ALTER ANY LOGIN TO [likya_klon];
PRINT N'Sunucu yetkileri verildi: CREATE ANY DATABASE, ALTER ANY LOGIN.';

/* 3) Şablonun sahibi likya_klon + şablon yedeğini yeniden al (docs/sql/SABLON_SAHIPLIGI.sql ile aynı iş) */
IF DB_ID(N'LIKYA_SABLON') IS NULL
  PRINT N'UYARI: LIKYA_SABLON bulunamadı; önce LIKYA_SABLON_OLUSTUR.sql, sonra SABLON_SAHIPLIGI.sql çalıştırılmalı.';
ELSE
BEGIN
  EXEC (N'USE [LIKYA_SABLON]; IF USER_ID(N''likya_klon'') IS NOT NULL DROP USER [likya_klon];');
  ALTER AUTHORIZATION ON DATABASE::[LIKYA_SABLON] TO [likya_klon];
  BACKUP DATABASE [LIKYA_SABLON] TO DISK = N'C:\LikyaYedek\Sablon\sablon.bak' WITH INIT, CHECKSUM;
  PRINT N'LIKYA_SABLON: sahibi likya_klon, sablon.bak yeniden alındı.';
END;

/* 4) Mevcut bulut firmaları: yedek + şema güncelleme + okuma/yazma (silme YOK) */
DECLARE @db sysname, @k nvarchar(max);
DECLARE f CURSOR LOCAL FAST_FORWARD FOR
  SELECT LTRIM(RTRIM(value)) FROM STRING_SPLIT(@firmalar, N',') WHERE LTRIM(RTRIM(value)) <> N'';
OPEN f;
FETCH NEXT FROM f INTO @db;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF DB_ID(@db) IS NULL
    PRINT N'Atlandı (sunucuda yok): ' + @db;
  ELSE
  BEGIN
    SET @k = N'USE ' + QUOTENAME(@db) + N';
      IF USER_ID(N''likya_klon'') IS NULL CREATE USER [likya_klon] FOR LOGIN [likya_klon];
      ALTER ROLE [db_backupoperator] ADD MEMBER [likya_klon];
      ALTER ROLE [db_ddladmin]       ADD MEMBER [likya_klon];
      ALTER ROLE [db_datareader]     ADD MEMBER [likya_klon];
      ALTER ROLE [db_datawriter]     ADD MEMBER [likya_klon];';
    EXEC (@k);
    PRINT @db + N': yedek + şema güncelleme + okuma/yazma.';
  END;
  FETCH NEXT FROM f INTO @db;
END;
CLOSE f; DEALLOCATE f;

PRINT N'TAMAM: likya_klon hazır. Şifreyi Backend\.env.local dosyasına KLON_DB_PASSWORD olarak yazın.';
GO
