import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";
import { decryptSecret, encryptSecret, isEncryptionConfigured } from "../utils/crypto.utils.js";
/**
 * e-Belge (ICE entegratör) veritabanı erişim katmanı.
 *
 * Tablolar yoksa otomatik oluşturulur — ev standardı
 * (bkz. banknotSql.repository.ts / kurSql.repository.ts).
 */
export class EbelgeSqlRepository {
    static ensuredKeys = new Set();
    static async ensureTablesExist(pool) {
        const cfg = pool.config || {};
        const key = `${cfg.server ?? ""}:${cfg.database ?? ""}`.toLowerCase();
        if (this.ensuredKeys.has(key))
            return;
        const script = `
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TODVZ_EBELGE_AYAR')
      BEGIN
        CREATE TABLE [dbo].[TODVZ_EBELGE_AYAR] (
          [ID] INT IDENTITY(1,1) NOT NULL,
          [ORTAM] VARCHAR(10) NOT NULL DEFAULT 'CANLI',
          [SERVIS_URL] VARCHAR(300) NOT NULL DEFAULT '',
          [KULLANICI_ADI] NVARCHAR(100) NOT NULL DEFAULT '',
          [SIFRE_SIFRELI] VARBINARY(MAX) NULL,
          [SIFRE_IV] VARBINARY(32) NULL,
          [SIFRE_TAG] VARBINARY(32) NULL,
          [UYGULAMA_ADI] VARCHAR(50) NOT NULL DEFAULT 'LikyaKuyumERP',
          [UYGULAMA_SURUM] VARCHAR(50) NOT NULL DEFAULT '1.0',
          [FIRMA_VKN] VARCHAR(11) NOT NULL DEFAULT '',
          [FIRMA_ALIAS] NVARCHAR(150) NOT NULL DEFAULT '',
          [FIRMA_IL] NVARCHAR(50) NOT NULL DEFAULT '',
          [FIRMA_ILCE] NVARCHAR(50) NOT NULL DEFAULT '',
          [AKTIF] BIT NOT NULL DEFAULT 0,
          [GUNCELLEYEN] NVARCHAR(50) NULL,
          [GUNCELLEME_TARIHI] DATETIME NULL,
          CONSTRAINT [PK_TODVZ_EBELGE_AYAR] PRIMARY KEY CLUSTERED ([ID] ASC)
        );
      END

      -- Sonradan eklenen kolonlar: UBL-TR'de adreste il/ilce zorunludur.
      IF COL_LENGTH('dbo.TODVZ_EBELGE_AYAR', 'FIRMA_IL') IS NULL
        ALTER TABLE [dbo].[TODVZ_EBELGE_AYAR] ADD [FIRMA_IL] NVARCHAR(50) NOT NULL DEFAULT '';
      IF COL_LENGTH('dbo.TODVZ_EBELGE_AYAR', 'FIRMA_ILCE') IS NULL
        ALTER TABLE [dbo].[TODVZ_EBELGE_AYAR] ADD [FIRMA_ILCE] NVARCHAR(50) NOT NULL DEFAULT '';

      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TODVZ_EBELGE_GELEN')
      BEGIN
        CREATE TABLE [dbo].[TODVZ_EBELGE_GELEN] (
          [UUID] VARCHAR(60) NOT NULL,
          [BELGE_NO] VARCHAR(40) NULL,
          [BELGE_TURU] VARCHAR(20) NOT NULL DEFAULT 'EFATURA',
          [PROFIL] VARCHAR(40) NULL,
          [SENDER] NVARCHAR(150) NULL,
          [RECEIVER] NVARCHAR(150) NULL,
          [SUPPLIER] NVARCHAR(300) NULL,
          [CUSTOMER] NVARCHAR(300) NULL,
          [DUZENLEME_TARIHI] DATETIME NULL,
          [TUTAR] FLOAT NULL,
          [PARA_BIRIMI] VARCHAR(10) NULL,
          [FATURA_TIPI] VARCHAR(30) NULL,
          [GIB_STATU_KODU] INT NULL,
          [GIB_STATU_ACIKLAMA] NVARCHAR(500) NULL,
          [STATU] NVARCHAR(100) NULL,
          [STATU_ACIKLAMA] NVARCHAR(500) NULL,
          [OKUNDU_MU] BIT NOT NULL DEFAULT 0,
          [ISLENDI_MI] BIT NOT NULL DEFAULT 0,
          [RED_KABUL] VARCHAR(10) NULL,
          [RED_KABUL_ACIKLAMA] NVARCHAR(1000) NULL,
          [RED_KABUL_TARIHI] DATETIME NULL,
          [RED_KABUL_KULLANICI] NVARCHAR(50) NULL,
          [ZARF_ID] VARCHAR(60) NULL,
          [HASH] VARCHAR(120) NULL,
          [XML_ICERIK] NVARCHAR(MAX) NULL,
          [CEKILME_TARIHI] DATETIME NOT NULL DEFAULT GETDATE(),
          CONSTRAINT [PK_TODVZ_EBELGE_GELEN] PRIMARY KEY CLUSTERED ([UUID] ASC)
        );
        CREATE INDEX [IX_TODVZ_EBELGE_GELEN_TARIH] ON [dbo].[TODVZ_EBELGE_GELEN] ([DUZENLEME_TARIHI] DESC);
        CREATE INDEX [IX_TODVZ_EBELGE_GELEN_REDKABUL] ON [dbo].[TODVZ_EBELGE_GELEN] ([RED_KABUL]);
        CREATE INDEX [IX_TODVZ_EBELGE_GELEN_SENDER] ON [dbo].[TODVZ_EBELGE_GELEN] ([SENDER]);
      END

      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TODVZ_EBELGE_GIDEN')
      BEGIN
        CREATE TABLE [dbo].[TODVZ_EBELGE_GIDEN] (
          [UUID] VARCHAR(60) NOT NULL,
          [BELGE_NO] VARCHAR(40) NOT NULL,
          [BELGE_TURU] VARCHAR(20) NOT NULL DEFAULT 'EFatura',
          [PROFIL] VARCHAR(40) NULL,
          [FATURA_TIPI] VARCHAR(30) NULL,
          [TASLAK_MI] BIT NOT NULL DEFAULT 1,
          [ALICI_VKN] VARCHAR(11) NULL,
          [ALICI_ALIAS] NVARCHAR(150) NULL,
          [ALICI_UNVAN] NVARCHAR(300) NULL,
          [DUZENLEME_TARIHI] DATETIME NULL,
          [TUTAR] FLOAT NULL,
          [PARA_BIRIMI] VARCHAR(10) NULL,
          [GONDERIM_DURUMU] VARCHAR(20) NOT NULL DEFAULT 'HAZIRLANDI',
          [SEMA_GECERLI] BIT NULL,
          [SCHEMATRON_GECERLI] BIT NULL,
          [ICE_RESPONSE_CODE] VARCHAR(20) NULL,
          [ICE_RESPONSE_MESAJ] NVARCHAR(1000) NULL,
          [GIB_STATU_KODU] INT NULL,
          [GIB_STATU_ACIKLAMA] NVARCHAR(500) NULL,
          [KAYNAK_FIS_ID] VARCHAR(60) NULL,
          [XML_ICERIK] NVARCHAR(MAX) NULL,
          [OLUSTURAN] NVARCHAR(50) NULL,
          [OLUSTURMA_TARIHI] DATETIME NOT NULL DEFAULT GETDATE(),
          [GONDEREN] NVARCHAR(50) NULL,
          [GONDERIM_TARIHI] DATETIME NULL,
          [IPTAL_TARIHI] DATETIME NULL,
          [IPTAL_EDEN] NVARCHAR(50) NULL,
          CONSTRAINT [PK_TODVZ_EBELGE_GIDEN] PRIMARY KEY CLUSTERED ([UUID] ASC)
        );
        -- Eski indeks korunur; aşağıdaki tek kolonlu indeks asıl numara kilididir.
        CREATE UNIQUE INDEX [UX_TODVZ_EBELGE_GIDEN_BELGENO]
          ON [dbo].[TODVZ_EBELGE_GIDEN] ([BELGE_NO], [DUZENLEME_TARIHI]);
        CREATE INDEX [IX_TODVZ_EBELGE_GIDEN_TARIH]
          ON [dbo].[TODVZ_EBELGE_GIDEN] ([OLUSTURMA_TARIHI] DESC);
      END

      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_TODVZ_EBELGE_GIDEN_NUMARA'
                     AND object_id = OBJECT_ID('dbo.TODVZ_EBELGE_GIDEN'))
      BEGIN
        IF EXISTS (SELECT [BELGE_NO] FROM [dbo].[TODVZ_EBELGE_GIDEN]
                   GROUP BY [BELGE_NO] HAVING COUNT(*) > 1)
          THROW 50001, 'e-Belge: tekrar eden belge numaraları var. ICE kayıtlarıyla mutabakat yapılmadan numara kilidi oluşturulamaz.', 1;
        CREATE UNIQUE INDEX [UX_TODVZ_EBELGE_GIDEN_NUMARA]
          ON [dbo].[TODVZ_EBELGE_GIDEN] ([BELGE_NO]);
      END

      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TODVZ_EBELGE_LOG')
      BEGIN
        CREATE TABLE [dbo].[TODVZ_EBELGE_LOG] (
          [ID] BIGINT IDENTITY(1,1) NOT NULL,
          [TARIH] DATETIME NOT NULL DEFAULT GETDATE(),
          [METOD] VARCHAR(80) NOT NULL,
          [YON] VARCHAR(10) NOT NULL,
          [ISTEK_OZET] NVARCHAR(MAX) NULL,
          [CEVAP_OZET] NVARCHAR(MAX) NULL,
          [BASARILI] BIT NOT NULL DEFAULT 0,
          [FAULT_KODU] VARCHAR(40) NULL,
          [HATA_MESAJI] NVARCHAR(1000) NULL,
          [SURE_MS] INT NULL,
          [KULLANICI] NVARCHAR(50) NULL,
          [ILGILI_UUID] VARCHAR(60) NULL,
          CONSTRAINT [PK_TODVZ_EBELGE_LOG] PRIMARY KEY CLUSTERED ([ID] ASC)
        );
        CREATE INDEX [IX_TODVZ_EBELGE_LOG_TARIH] ON [dbo].[TODVZ_EBELGE_LOG] ([TARIH] DESC);
      END
      IF OBJECT_ID('dbo.TODVZ_EBELGE_ARSIV', 'U') IS NULL
      BEGIN
        CREATE TABLE [dbo].[TODVZ_EBELGE_ARSIV] (
          [UUID] VARCHAR(60) NOT NULL PRIMARY KEY, [BELGE_NO] VARCHAR(40) NOT NULL,
          [ALICI_VKN] VARCHAR(11) NULL, [ALICI_UNVAN] NVARCHAR(300) NULL,
          [GONDERICI_VKN] VARCHAR(11) NULL, [GONDERICI_UNVAN] NVARCHAR(300) NULL,
          [TARIH] DATETIME NOT NULL, [TUTAR] DECIMAL(19,2) NULL, [PARA_BIRIMI] VARCHAR(10) NULL,
          [PROFIL] VARCHAR(40) NULL, [ICE_STATU_KODU] VARCHAR(30) NULL,
          [ICE_STATU_ACIKLAMA] NVARCHAR(1000) NULL, [ISARET] NVARCHAR(20) NULL,
          [ISARET_KULLANICI] NVARCHAR(50) NULL, [ISARET_TARIHI] DATETIME NULL,
          [CEKILME_TARIHI] DATETIME NOT NULL DEFAULT GETDATE()
        );
        CREATE INDEX [IX_TODVZ_EBELGE_ARSIV_TARIH] ON [dbo].[TODVZ_EBELGE_ARSIV] ([TARIH] DESC);
      END
    `;
        try {
            await pool.request().batch(script);
            this.ensuredKeys.add(key);
        }
        catch (err) {
            logger.warn("EbelgeSqlRepository.ensureTablesExist uyarısı:", err);
            // Numara indeksi kurulamadıysa gönderim güvenliği sağlanamaz.
            throw err;
        }
    }
    static async getPool(dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await this.ensureTablesExist(pool);
        return pool;
    }
    /**
     * Tek ayar kaydını getirir (kayıt yoksa null).
     */
    static async getAyar(dbContext) {
        const pool = await this.getPool(dbContext);
        const res = await pool.request().query(`
      SELECT TOP 1
        [ID] as id,
        LTRIM(RTRIM(ISNULL([ORTAM], 'CANLI'))) as ortam,
        LTRIM(RTRIM(ISNULL([SERVIS_URL], ''))) as servisUrl,
        LTRIM(RTRIM(ISNULL([KULLANICI_ADI], ''))) as kullaniciAdi,
        [SIFRE_SIFRELI] as sifreSifreli,
        [SIFRE_IV] as sifreIv,
        [SIFRE_TAG] as sifreTag,
        LTRIM(RTRIM(ISNULL([UYGULAMA_ADI], 'LikyaKuyumERP'))) as uygulamaAdi,
        LTRIM(RTRIM(ISNULL([UYGULAMA_SURUM], '1.0'))) as uygulamaSurum,
        LTRIM(RTRIM(ISNULL([FIRMA_VKN], ''))) as firmaVkn,
        LTRIM(RTRIM(ISNULL([FIRMA_ALIAS], ''))) as firmaAlias,
        LTRIM(RTRIM(ISNULL([FIRMA_IL], ''))) as firmaIl,
        LTRIM(RTRIM(ISNULL([FIRMA_ILCE], ''))) as firmaIlce,
        ISNULL([AKTIF], 0) as aktif,
        [GUNCELLEYEN] as guncelleyen,
        [GUNCELLEME_TARIHI] as guncellemeTarihi
      FROM [dbo].[TODVZ_EBELGE_AYAR]
      ORDER BY [ID] ASC
    `);
        const row = res.recordset[0];
        if (!row)
            return null;
        return {
            ...row,
            ortam: (row.ortam === "TEST" ? "TEST" : "CANLI"),
            aktif: Boolean(row.aktif),
        };
    }
    /**
     * Firmanın vergi kimlik numarasını TODVZ_TANIM'dan okur (varsayılan doldurma için).
     */
    static async getFirmaVknFromTanim(dbContext) {
        const pool = await this.getPool(dbContext);
        try {
            const res = await pool.request().query(`
        SELECT TOP 1 LTRIM(RTRIM(ISNULL([VERGI_KIMLIK_NO], ''))) as vkn
        FROM [dbo].[TODVZ_TANIM]
      `);
            return res.recordset[0]?.vkn || "";
        }
        catch (err) {
            logger.warn("EbelgeSqlRepository.getFirmaVknFromTanim uyarısı:", err);
            return "";
        }
    }
    /**
     * Gönderici (firma) bilgilerini TODVZ_TANIM'dan okur — UBL üreteci için.
     * Vergi dairesi adı bu tabloda kimlik (ID) olarak tutulduğundan burada okunmaz;
     * gerekiyorsa istek gövdesinden verilir.
     */
    static async getFirmaBilgisi(dbContext) {
        const pool = await this.getPool(dbContext);
        try {
            const res = await pool.request().query(`
        SELECT TOP 1
          LTRIM(RTRIM(ISNULL([VERGI_KIMLIK_NO], ''))) as vkn,
          LTRIM(RTRIM(ISNULL([FIRMA_ADI], ''))) as unvan,
          LTRIM(RTRIM(ISNULL([ADRES], ''))) as adres,
          LTRIM(RTRIM(ISNULL([TELEFON], ''))) as telefon
        FROM [dbo].[TODVZ_TANIM]
      `);
            const row = res.recordset[0];
            return {
                vkn: row?.vkn || "",
                unvan: row?.unvan || "",
                adres: row?.adres || "",
                telefon: row?.telefon || "",
            };
        }
        catch (err) {
            logger.warn("EbelgeSqlRepository.getFirmaBilgisi uyarısı:", err);
            return { vkn: "", unvan: "", adres: "", telefon: "" };
        }
    }
    /**
     * Ayar kaydını API'ye uygun, şifresi maskelenmiş biçimde döndürür.
     */
    static toAyarView(kayit) {
        return {
            id: kayit.id,
            ortam: kayit.ortam,
            servisUrl: kayit.servisUrl,
            kullaniciAdi: kayit.kullaniciAdi,
            sifreTanimli: Boolean(kayit.sifreSifreli && kayit.sifreIv && kayit.sifreTag),
            uygulamaAdi: kayit.uygulamaAdi,
            uygulamaSurum: kayit.uygulamaSurum,
            firmaVkn: kayit.firmaVkn,
            firmaAlias: kayit.firmaAlias,
            firmaIl: kayit.firmaIl,
            firmaIlce: kayit.firmaIlce,
            aktif: kayit.aktif,
            guncelleyen: kayit.guncelleyen,
            guncellemeTarihi: kayit.guncellemeTarihi,
        };
    }
    /**
     * Ayarı kaydeder. Şifre boş bırakılırsa mevcut şifre korunur.
     */
    static async saveAyar(dto, kullanici, dbContext) {
        const pool = await this.getPool(dbContext);
        const mevcut = await this.getAyar(dbContext);
        let sifreSifreli = mevcut?.sifreSifreli ?? null;
        let sifreIv = mevcut?.sifreIv ?? null;
        let sifreTag = mevcut?.sifreTag ?? null;
        if (dto.sifre && dto.sifre.trim() !== "") {
            if (!isEncryptionConfigured()) {
                throw ApiError.internal("EBELGE_ENC_KEY ortam değişkeni tanımlı değil. Şifre düz metin olarak saklanamayacağı için kayıt iptal edildi.");
            }
            const sifreli = encryptSecret(dto.sifre);
            sifreSifreli = sifreli.cipher;
            sifreIv = sifreli.iv;
            sifreTag = sifreli.tag;
        }
        const request = pool
            .request()
            .input("ortam", sql.VarChar(10), dto.ortam)
            .input("servisUrl", sql.VarChar(300), dto.servisUrl)
            .input("kullaniciAdi", sql.NVarChar(100), dto.kullaniciAdi)
            .input("sifreSifreli", sql.VarBinary(sql.MAX), sifreSifreli)
            .input("sifreIv", sql.VarBinary(32), sifreIv)
            .input("sifreTag", sql.VarBinary(32), sifreTag)
            .input("uygulamaAdi", sql.VarChar(50), dto.uygulamaAdi)
            .input("uygulamaSurum", sql.VarChar(50), dto.uygulamaSurum)
            .input("firmaVkn", sql.VarChar(11), dto.firmaVkn)
            .input("firmaAlias", sql.NVarChar(150), dto.firmaAlias)
            .input("firmaIl", sql.NVarChar(50), dto.firmaIl)
            .input("firmaIlce", sql.NVarChar(50), dto.firmaIlce)
            .input("aktif", sql.Bit, dto.aktif)
            .input("guncelleyen", sql.NVarChar(50), kullanici);
        if (mevcut) {
            request.input("id", sql.Int, mevcut.id);
            await request.query(`
        UPDATE [dbo].[TODVZ_EBELGE_AYAR]
        SET [ORTAM] = @ortam,
            [SERVIS_URL] = @servisUrl,
            [KULLANICI_ADI] = @kullaniciAdi,
            [SIFRE_SIFRELI] = @sifreSifreli,
            [SIFRE_IV] = @sifreIv,
            [SIFRE_TAG] = @sifreTag,
            [UYGULAMA_ADI] = @uygulamaAdi,
            [UYGULAMA_SURUM] = @uygulamaSurum,
            [FIRMA_VKN] = @firmaVkn,
            [FIRMA_ALIAS] = @firmaAlias,
            [FIRMA_IL] = @firmaIl,
            [FIRMA_ILCE] = @firmaIlce,
            [AKTIF] = @aktif,
            [GUNCELLEYEN] = @guncelleyen,
            [GUNCELLEME_TARIHI] = GETDATE()
        WHERE [ID] = @id
      `);
        }
        else {
            await request.query(`
        INSERT INTO [dbo].[TODVZ_EBELGE_AYAR]
          ([ORTAM], [SERVIS_URL], [KULLANICI_ADI], [SIFRE_SIFRELI], [SIFRE_IV], [SIFRE_TAG],
           [UYGULAMA_ADI], [UYGULAMA_SURUM], [FIRMA_VKN], [FIRMA_ALIAS], [FIRMA_IL], [FIRMA_ILCE], [AKTIF],
           [GUNCELLEYEN], [GUNCELLEME_TARIHI])
        VALUES
          (@ortam, @servisUrl, @kullaniciAdi, @sifreSifreli, @sifreIv, @sifreTag,
           @uygulamaAdi, @uygulamaSurum, @firmaVkn, @firmaAlias, @firmaIl, @firmaIlce, @aktif,
           @guncelleyen, GETDATE())
      `);
        }
        const kaydedilen = await this.getAyar(dbContext);
        if (!kaydedilen) {
            throw ApiError.internal("Ayar kaydedildi ancak geri okunamadı.");
        }
        return this.toAyarView(kaydedilen);
    }
    /**
     * ICE çağrıları için çözülmüş bağlantı yapılandırmasını üretir.
     * Şifre yalnızca burada çözülür ve dışarı sızdırılmaz.
     */
    static async getConnectionConfig(dbContext) {
        const kayit = await this.getAyar(dbContext);
        if (!kayit || !kayit.servisUrl || !kayit.kullaniciAdi) {
            throw ApiError.badRequest("e-Belge entegratör ayarları tanımlı değil. Ayarlar ekranından servis adresi ve kullanıcı bilgilerini giriniz.");
        }
        if (!kayit.aktif) {
            throw ApiError.badRequest("e-Belge entegratör bağlantısı pasif durumda. Ayarlar ekranından etkinleştiriniz.");
        }
        if (!kayit.sifreSifreli || !kayit.sifreIv || !kayit.sifreTag) {
            throw ApiError.badRequest("e-Belge entegratör şifresi tanımlı değil. Ayarlar ekranından şifreyi giriniz.");
        }
        return {
            servisUrl: kayit.servisUrl,
            kullaniciAdi: kayit.kullaniciAdi,
            sifre: decryptSecret(kayit.sifreSifreli, kayit.sifreIv, kayit.sifreTag),
            uygulamaAdi: kayit.uygulamaAdi,
            uygulamaSurum: kayit.uygulamaSurum,
            dbServer: dbContext?.dbServer,
            dbName: dbContext?.dbName,
        };
    }
    /**
     * SOAP çağrı denetim kaydı. Hassas alanlar çağıran tarafından maskelenmiş gelir.
     * Log yazımı asıl işlemi bozmaz — hata yalnızca uyarı olarak geçilir.
     */
    static async writeLog(kayit, dbContext) {
        try {
            const pool = await this.getPool(dbContext);
            await pool
                .request()
                .input("metod", sql.VarChar(80), kayit.metod)
                .input("yon", sql.VarChar(10), kayit.yon)
                .input("istekOzet", sql.NVarChar(sql.MAX), kayit.istekOzet ?? null)
                .input("cevapOzet", sql.NVarChar(sql.MAX), kayit.cevapOzet ?? null)
                .input("basarili", sql.Bit, kayit.basarili)
                .input("faultKodu", sql.VarChar(40), kayit.faultKodu ?? null)
                .input("hataMesaji", sql.NVarChar(1000), kayit.hataMesaji ?? null)
                .input("sureMs", sql.Int, kayit.sureMs ?? null)
                .input("kullanici", sql.NVarChar(50), kayit.kullanici ?? null)
                .input("ilgiliUuid", sql.VarChar(60), kayit.ilgiliUuid ?? null)
                .query(`
          INSERT INTO [dbo].[TODVZ_EBELGE_LOG]
            ([METOD], [YON], [ISTEK_OZET], [CEVAP_OZET], [BASARILI],
             [FAULT_KODU], [HATA_MESAJI], [SURE_MS], [KULLANICI], [ILGILI_UUID])
          VALUES
            (@metod, @yon, @istekOzet, @cevapOzet, @basarili,
             @faultKodu, @hataMesaji, @sureMs, @kullanici, @ilgiliUuid)
        `);
        }
        catch (err) {
            logger.warn("EbelgeSqlRepository.writeLog uyarısı:", err);
        }
    }
    /* ========================================================================
       Gelen belgeler (Faz 3)
       ======================================================================== */
    /**
     * ICE'den çekilen belge başlığını yerel aynaya yazar.
     * Var olan kayıt güncellenir; kullanıcının verdiği red/kabul cevabı KORUNUR.
     */
    static async upsertGelen(kayit, dbContext) {
        const pool = await this.getPool(dbContext);
        await pool
            .request()
            .input("uuid", sql.VarChar(60), kayit.uuid)
            .input("belgeNo", sql.VarChar(40), kayit.belgeNo ?? null)
            .input("belgeTuru", sql.VarChar(20), kayit.belgeTuru ?? "EFATURA")
            .input("profil", sql.VarChar(40), kayit.profil ?? null)
            .input("sender", sql.NVarChar(150), kayit.sender ?? null)
            .input("receiver", sql.NVarChar(150), kayit.receiver ?? null)
            .input("supplier", sql.NVarChar(300), kayit.supplier ?? null)
            .input("customer", sql.NVarChar(300), kayit.customer ?? null)
            .input("duzenlemeTarihi", sql.DateTime, kayit.duzenlemeTarihi ?? null)
            .input("tutar", sql.Float, kayit.tutar ?? null)
            .input("paraBirimi", sql.VarChar(10), kayit.paraBirimi ?? null)
            .input("faturaTipi", sql.VarChar(30), kayit.faturaTipi ?? null)
            .input("gibStatuKodu", sql.Int, kayit.gibStatuKodu ?? null)
            .input("gibStatuAciklama", sql.NVarChar(500), kayit.gibStatuAciklama ?? null)
            .input("statu", sql.NVarChar(100), kayit.statu ?? null)
            .input("statuAciklama", sql.NVarChar(500), kayit.statuAciklama ?? null)
            .input("zarfId", sql.VarChar(60), kayit.zarfId ?? null)
            .input("hash", sql.VarChar(120), kayit.hash ?? null)
            .query(`
        MERGE [dbo].[TODVZ_EBELGE_GELEN] AS hedef
        USING (SELECT @uuid AS UUID) AS kaynak
        ON hedef.[UUID] = kaynak.UUID
        WHEN MATCHED THEN UPDATE SET
          [BELGE_NO] = @belgeNo,
          [BELGE_TURU] = @belgeTuru,
          [PROFIL] = @profil,
          [SENDER] = @sender,
          [RECEIVER] = @receiver,
          [SUPPLIER] = @supplier,
          [CUSTOMER] = @customer,
          [DUZENLEME_TARIHI] = @duzenlemeTarihi,
          [TUTAR] = @tutar,
          [PARA_BIRIMI] = @paraBirimi,
          [FATURA_TIPI] = @faturaTipi,
          [GIB_STATU_KODU] = @gibStatuKodu,
          [GIB_STATU_ACIKLAMA] = @gibStatuAciklama,
          [STATU] = @statu,
          [STATU_ACIKLAMA] = @statuAciklama,
          [ZARF_ID] = @zarfId,
          [HASH] = @hash,
          [CEKILME_TARIHI] = GETDATE()
        WHEN NOT MATCHED THEN INSERT
          ([UUID], [BELGE_NO], [BELGE_TURU], [PROFIL], [SENDER], [RECEIVER], [SUPPLIER], [CUSTOMER],
           [DUZENLEME_TARIHI], [TUTAR], [PARA_BIRIMI], [FATURA_TIPI], [GIB_STATU_KODU],
           [GIB_STATU_ACIKLAMA], [STATU], [STATU_ACIKLAMA], [ZARF_ID], [HASH], [CEKILME_TARIHI])
        VALUES
          (@uuid, @belgeNo, @belgeTuru, @profil, @sender, @receiver, @supplier, @customer,
           @duzenlemeTarihi, @tutar, @paraBirimi, @faturaTipi, @gibStatuKodu,
           @gibStatuAciklama, @statu, @statuAciklama, @zarfId, @hash, GETDATE());
      `);
    }
    /**
     * Yerel aynadan sayfalı gelen belge listesi.
     */
    static async listGelen(filtre, dbContext) {
        const pool = await this.getPool(dbContext);
        const sayfa = Math.max(filtre.sayfa || 1, 1);
        const boyut = Math.min(Math.max(filtre.boyut || 50, 1), 500);
        const kosullar = [];
        const request = pool.request();
        if (filtre.baslangicTarihi) {
            kosullar.push("[DUZENLEME_TARIHI] >= @baslangic");
            request.input("baslangic", sql.DateTime, new Date(filtre.baslangicTarihi));
        }
        if (filtre.bitisTarihi) {
            kosullar.push("[DUZENLEME_TARIHI] <= @bitis");
            request.input("bitis", sql.DateTime, new Date(filtre.bitisTarihi));
        }
        if (filtre.arama) {
            kosullar.push("([BELGE_NO] LIKE @arama OR [SUPPLIER] LIKE @arama OR [SENDER] LIKE @arama OR [UUID] LIKE @arama)");
            request.input("arama", sql.NVarChar(200), `%${filtre.arama}%`);
        }
        if (filtre.redKabul === "BEKLEYEN") {
            kosullar.push("[RED_KABUL] IS NULL");
        }
        else if (filtre.redKabul === "Kabul" || filtre.redKabul === "Red") {
            kosullar.push("[RED_KABUL] = @redKabul");
            request.input("redKabul", sql.VarChar(10), filtre.redKabul);
        }
        const where = kosullar.length ? `WHERE ${kosullar.join(" AND ")}` : "";
        const sayimRes = await request.query(`SELECT COUNT(*) AS toplam FROM [dbo].[TODVZ_EBELGE_GELEN] ${where}`);
        const toplam = Number(sayimRes.recordset[0]?.toplam || 0);
        request.input("atla", sql.Int, (sayfa - 1) * boyut).input("al", sql.Int, boyut);
        const res = await request.query(`
      SELECT
        [UUID] as uuid, [BELGE_NO] as belgeNo, [BELGE_TURU] as belgeTuru, [PROFIL] as profil,
        [SENDER] as sender, [RECEIVER] as receiver, [SUPPLIER] as supplier, [CUSTOMER] as customer,
        [DUZENLEME_TARIHI] as duzenlemeTarihi, [TUTAR] as tutar, [PARA_BIRIMI] as paraBirimi,
        [FATURA_TIPI] as faturaTipi, [GIB_STATU_KODU] as gibStatuKodu,
        [GIB_STATU_ACIKLAMA] as gibStatuAciklama, [STATU] as statu, [STATU_ACIKLAMA] as statuAciklama,
        [OKUNDU_MU] as okunduMu, [ISLENDI_MI] as islendiMi,
        [RED_KABUL] as redKabul, [RED_KABUL_ACIKLAMA] as redKabulAciklama,
        [RED_KABUL_TARIHI] as redKabulTarihi, [RED_KABUL_KULLANICI] as redKabulKullanici,
        [ZARF_ID] as zarfId, [HASH] as hash, [CEKILME_TARIHI] as cekilmeTarihi
      FROM [dbo].[TODVZ_EBELGE_GELEN]
      ${where}
      ORDER BY ISNULL([DUZENLEME_TARIHI], [CEKILME_TARIHI]) DESC, [UUID] ASC
      OFFSET @atla ROWS FETCH NEXT @al ROWS ONLY
    `);
        return {
            toplam,
            kayitlar: res.recordset.map((r) => ({
                ...r,
                okunduMu: Boolean(r.okunduMu),
                islendiMi: Boolean(r.islendiMi),
            })),
        };
    }
    /** Tek gelen belge kaydı */
    static async getGelen(uuid, dbContext) {
        const pool = await this.getPool(dbContext);
        const res = await pool.request().input("uuid", sql.VarChar(60), uuid).query(`
      SELECT TOP 1
        [UUID] as uuid, [BELGE_NO] as belgeNo, [BELGE_TURU] as belgeTuru, [PROFIL] as profil,
        [SENDER] as sender, [RECEIVER] as receiver, [SUPPLIER] as supplier, [CUSTOMER] as customer,
        [DUZENLEME_TARIHI] as duzenlemeTarihi, [TUTAR] as tutar, [PARA_BIRIMI] as paraBirimi,
        [FATURA_TIPI] as faturaTipi, [GIB_STATU_KODU] as gibStatuKodu,
        [GIB_STATU_ACIKLAMA] as gibStatuAciklama, [STATU] as statu, [STATU_ACIKLAMA] as statuAciklama,
        [OKUNDU_MU] as okunduMu, [ISLENDI_MI] as islendiMi,
        [RED_KABUL] as redKabul, [RED_KABUL_ACIKLAMA] as redKabulAciklama,
        [RED_KABUL_TARIHI] as redKabulTarihi, [RED_KABUL_KULLANICI] as redKabulKullanici,
        [ZARF_ID] as zarfId, [HASH] as hash, [CEKILME_TARIHI] as cekilmeTarihi
      FROM [dbo].[TODVZ_EBELGE_GELEN]
      WHERE [UUID] = @uuid
    `);
        const row = res.recordset[0];
        if (!row)
            return null;
        return { ...row, okunduMu: Boolean(row.okunduMu), islendiMi: Boolean(row.islendiMi) };
    }
    /**
     * Kabul/red cevabını kaydeder.
     *
     * Yalnızca **henüz cevaplanmamış** kaydı günceller (`RED_KABUL IS NULL`).
     * Etkilenen satır 0 ise ya kayıt yok ya da zaten cevaplanmış demektir —
     * çift cevap gönderimini veritabanı seviyesinde de engeller (§11.1 S8/S9).
     */
    static async setGelenRedKabul(uuid, redKabul, aciklama, kullanici, dbContext) {
        const pool = await this.getPool(dbContext);
        const res = await pool
            .request()
            .input("uuid", sql.VarChar(60), uuid)
            .input("redKabul", sql.VarChar(10), redKabul)
            .input("aciklama", sql.NVarChar(1000), aciklama || null)
            .input("kullanici", sql.NVarChar(50), kullanici)
            .query(`
        UPDATE [dbo].[TODVZ_EBELGE_GELEN]
        SET [RED_KABUL] = @redKabul,
            [RED_KABUL_ACIKLAMA] = @aciklama,
            [RED_KABUL_TARIHI] = GETDATE(),
            [RED_KABUL_KULLANICI] = @kullanici
        WHERE [UUID] = @uuid AND [RED_KABUL] IS NULL
      `);
        return (res.rowsAffected?.[0] ?? 0) > 0;
    }
    /**
     * Kabul/red kaydını geri alır.
     * Yalnızca ICE çağrısı BAŞARISIZ olduğunda, yerelde tutulan "yer tutma" kaydını
     * temizlemek için kullanılır — böylece kullanıcı işlemi tekrar deneyebilir.
     */
    static async clearGelenRedKabul(uuid, dbContext) {
        const pool = await this.getPool(dbContext);
        await pool.request().input("uuid", sql.VarChar(60), uuid).query(`
      UPDATE [dbo].[TODVZ_EBELGE_GELEN]
      SET [RED_KABUL] = NULL,
          [RED_KABUL_ACIKLAMA] = NULL,
          [RED_KABUL_TARIHI] = NULL,
          [RED_KABUL_KULLANICI] = NULL
      WHERE [UUID] = @uuid
    `);
    }
    /** Okundu / işlendi bayraklarını günceller (Set_Invoice_Status sonrası) */
    static async setGelenOkunmaDurumu(uuid, durum, dbContext) {
        const pool = await this.getPool(dbContext);
        await pool
            .request()
            .input("uuid", sql.VarChar(60), uuid)
            .input("okunduMu", sql.Bit, durum.okunduMu ?? null)
            .input("islendiMi", sql.Bit, durum.islendiMi ?? null)
            .query(`
        UPDATE [dbo].[TODVZ_EBELGE_GELEN]
        SET [OKUNDU_MU] = ISNULL(@okunduMu, [OKUNDU_MU]),
            [ISLENDI_MI] = ISNULL(@islendiMi, [ISLENDI_MI])
        WHERE [UUID] = @uuid
      `);
    }
    /** Belgenin GİB statüsünü günceller (Get_Invoice_Status_Detail sonrası) */
    static async updateGelenStatu(uuid, statu, dbContext) {
        const pool = await this.getPool(dbContext);
        await pool
            .request()
            .input("uuid", sql.VarChar(60), uuid)
            .input("statu", sql.NVarChar(100), statu.statu ?? null)
            .input("statuAciklama", sql.NVarChar(500), statu.statuAciklama ?? null)
            .input("gibStatuKodu", sql.Int, statu.gibStatuKodu ?? null)
            .query(`
        UPDATE [dbo].[TODVZ_EBELGE_GELEN]
        SET [STATU] = ISNULL(@statu, [STATU]),
            [STATU_ACIKLAMA] = ISNULL(@statuAciklama, [STATU_ACIKLAMA]),
            [GIB_STATU_KODU] = ISNULL(@gibStatuKodu, [GIB_STATU_KODU])
        WHERE [UUID] = @uuid
      `);
    }
    /* ========================================================================
       Giden belgeler (Faz 6)
       ======================================================================== */
    /**
     * Giden belgeyi kaydeder.
     *
     * `BELGE_NO + DUZENLEME_TARIHI` üzerinde benzersiz indeks var; aynı fatura
     * numarası ikinci kez yazılmak istenirse SQL hata verir ve bu 409'a çevrilir
     * (çift gönderim koruması — §11.1 S8).
     */
    static async insertGiden(kayit, dbContext) {
        const pool = await this.getPool(dbContext);
        try {
            await pool
                .request()
                .input("uuid", sql.VarChar(60), kayit.uuid)
                .input("belgeNo", sql.VarChar(40), kayit.belgeNo)
                .input("belgeTuru", sql.VarChar(20), kayit.belgeTuru || "EFatura")
                .input("profil", sql.VarChar(40), kayit.profil ?? null)
                .input("faturaTipi", sql.VarChar(30), kayit.faturaTipi ?? null)
                .input("taslakMi", sql.Bit, kayit.taslakMi ?? true)
                .input("aliciVkn", sql.VarChar(11), kayit.aliciVkn ?? null)
                .input("aliciAlias", sql.NVarChar(150), kayit.aliciAlias ?? null)
                .input("aliciUnvan", sql.NVarChar(300), kayit.aliciUnvan ?? null)
                .input("duzenlemeTarihi", sql.DateTime, kayit.duzenlemeTarihi ?? null)
                .input("tutar", sql.Float, kayit.tutar ?? null)
                .input("paraBirimi", sql.VarChar(10), kayit.paraBirimi ?? null)
                .input("gonderimDurumu", sql.VarChar(20), kayit.gonderimDurumu)
                .input("semaGecerli", sql.Bit, kayit.semaGecerli ?? null)
                .input("schematronGecerli", sql.Bit, kayit.schematronGecerli ?? null)
                .input("iceResponseCode", sql.VarChar(20), kayit.iceResponseCode ?? null)
                .input("iceResponseMesaj", sql.NVarChar(1000), kayit.iceResponseMesaj ?? null)
                .input("kaynakFisId", sql.VarChar(60), kayit.kaynakFisId ?? null)
                .input("xmlIcerik", sql.NVarChar(sql.MAX), kayit.xmlIcerik ?? null)
                .input("olusturan", sql.NVarChar(50), kayit.olusturan ?? null)
                .input("gonderen", sql.NVarChar(50), kayit.gonderen ?? null)
                .input("gonderimTarihi", sql.DateTime, kayit.gonderimTarihi ?? null)
                .query(`
          INSERT INTO [dbo].[TODVZ_EBELGE_GIDEN]
            ([UUID], [BELGE_NO], [BELGE_TURU], [PROFIL], [FATURA_TIPI], [TASLAK_MI],
             [ALICI_VKN], [ALICI_ALIAS], [ALICI_UNVAN], [DUZENLEME_TARIHI], [TUTAR], [PARA_BIRIMI],
             [GONDERIM_DURUMU], [SEMA_GECERLI], [SCHEMATRON_GECERLI],
             [ICE_RESPONSE_CODE], [ICE_RESPONSE_MESAJ], [KAYNAK_FIS_ID], [XML_ICERIK],
             [OLUSTURAN], [OLUSTURMA_TARIHI], [GONDEREN], [GONDERIM_TARIHI])
          VALUES
            (@uuid, @belgeNo, @belgeTuru, @profil, @faturaTipi, @taslakMi,
             @aliciVkn, @aliciAlias, @aliciUnvan, @duzenlemeTarihi, @tutar, @paraBirimi,
             @gonderimDurumu, @semaGecerli, @schematronGecerli,
             @iceResponseCode, @iceResponseMesaj, @kaynakFisId, @xmlIcerik,
             @olusturan, GETDATE(), @gonderen, @gonderimTarihi)
        `);
        }
        catch (err) {
            // 2601/2627: benzersiz indeks ihlali → aynı fatura numarası zaten var
            if (err?.number === 2601 || err?.number === 2627) {
                throw ApiError.conflict(`${kayit.belgeNo} numaralı belge bu tarihte zaten oluşturulmuş. Aynı numara ikinci kez gönderilemez.`);
            }
            throw err;
        }
    }
    /** Arşiv aynası gönderim kayıtlarına yazmaz; ICE durum kodu GİB kodu olarak yorumlanmaz. */
    static async upsertEarsivArsiv(r, dbContext) {
        const pool = await this.getPool(dbContext);
        await pool.request()
            .input("uuid", sql.VarChar(60), r.uuid).input("no", sql.VarChar(40), r.belgeNo)
            .input("alici", sql.VarChar(11), r.aliciVkn).input("aliciUnvan", sql.NVarChar(300), r.aliciUnvan)
            .input("gonderici", sql.VarChar(11), r.gondericiVkn).input("gondericiUnvan", sql.NVarChar(300), r.gondericiUnvan)
            .input("tarih", sql.DateTime, r.tarih).input("tutar", sql.Decimal(19, 2), r.tutar)
            .input("para", sql.VarChar(10), r.paraBirimi).input("profil", sql.VarChar(40), r.profil)
            .input("kod", sql.VarChar(30), r.iceStatuKodu).input("aciklama", sql.NVarChar(1000), r.iceStatuAciklama)
            .query(`MERGE [dbo].[TODVZ_EBELGE_ARSIV] WITH (HOLDLOCK) AS t
        USING (SELECT @uuid AS UUID) AS s ON t.UUID = s.UUID
        WHEN MATCHED THEN UPDATE SET BELGE_NO=@no, ALICI_VKN=@alici, ALICI_UNVAN=@aliciUnvan,
          GONDERICI_VKN=@gonderici, GONDERICI_UNVAN=@gondericiUnvan, TARIH=@tarih, TUTAR=@tutar,
          PARA_BIRIMI=@para, PROFIL=@profil, ICE_STATU_KODU=@kod, ICE_STATU_ACIKLAMA=@aciklama, CEKILME_TARIHI=GETDATE()
        WHEN NOT MATCHED THEN INSERT
          (UUID,BELGE_NO,ALICI_VKN,ALICI_UNVAN,GONDERICI_VKN,GONDERICI_UNVAN,TARIH,TUTAR,PARA_BIRIMI,PROFIL,ICE_STATU_KODU,ICE_STATU_ACIKLAMA)
          VALUES (@uuid,@no,@alici,@aliciUnvan,@gonderici,@gondericiUnvan,@tarih,@tutar,@para,@profil,@kod,@aciklama);`);
    }
    static async listEarsivArsiv(sayfa, arama, dbContext) {
        const pool = await this.getPool(dbContext);
        const result = await pool.request().input("atla", sql.Int, (sayfa - 1) * 50)
            .input("ara", sql.NVarChar(202), `%${arama}%`).query(`
        SELECT COUNT(*) AS toplam FROM [dbo].[TODVZ_EBELGE_ARSIV]
          WHERE BELGE_NO LIKE @ara OR UUID LIKE @ara OR ALICI_UNVAN LIKE @ara OR GONDERICI_UNVAN LIKE @ara;
        SELECT UUID AS uuid, BELGE_NO AS belgeNo, ALICI_VKN AS aliciVkn, ALICI_UNVAN AS aliciUnvan,
          GONDERICI_VKN AS gondericiVkn, GONDERICI_UNVAN AS gondericiUnvan, TARIH AS tarih,
          TUTAR AS tutar, PARA_BIRIMI AS paraBirimi, ICE_STATU_KODU AS iceStatuKodu,
          ICE_STATU_ACIKLAMA AS iceStatuAciklama, ISARET AS isaret, CEKILME_TARIHI AS cekilmeTarihi
        FROM [dbo].[TODVZ_EBELGE_ARSIV]
          WHERE BELGE_NO LIKE @ara OR UUID LIKE @ara OR ALICI_UNVAN LIKE @ara OR GONDERICI_UNVAN LIKE @ara
        ORDER BY TARIH DESC, UUID OFFSET @atla ROWS FETCH NEXT 50 ROWS ONLY;
      `);
        const sets = result.recordsets;
        return { toplam: Number(sets[0][0].toplam), kayitlar: sets[1] };
    }
    static async earsivArsivVarMi(uuid, dbContext) {
        const pool = await this.getPool(dbContext);
        const r = await pool.request().input("uuid", sql.VarChar(60), uuid)
            .query("SELECT UUID FROM [dbo].[TODVZ_EBELGE_ARSIV] WHERE UUID=@uuid");
        return r.recordset.length === 1;
    }
    static async setEarsivArsivIsaret(uuid, statu, kullanici, dbContext) {
        const pool = await this.getPool(dbContext);
        await pool.request().input("uuid", sql.VarChar(60), uuid).input("statu", sql.NVarChar(20), statu)
            .input("kullanici", sql.NVarChar(50), kullanici).query(`UPDATE [dbo].[TODVZ_EBELGE_ARSIV]
        SET ISARET=@statu, ISARET_KULLANICI=@kullanici, ISARET_TARIHI=GETDATE() WHERE UUID=@uuid`);
    }
    /** Atomik durum geçişi: çoklu sunucuda da yalnızca bir istek yer tutabilir. */
    static async earsivDurumGecir(uuid, beklenen, durum, sonuc = {}, dbContext) {
        const pool = await this.getPool(dbContext);
        const res = await pool.request()
            .input("uuid", sql.VarChar(60), uuid)
            .input("beklenen", sql.VarChar(20), beklenen)
            .input("durum", sql.VarChar(20), durum)
            .input("mesaj", sql.NVarChar(1000), sonuc.mesaj?.slice(0, 1000) ?? null)
            .input("kod", sql.VarChar(20), sonuc.kod?.slice(0, 20) ?? null)
            .input("kullanici", sql.NVarChar(50), sonuc.kullanici ?? null)
            .input("iptalTarihi", sql.DateTime, sonuc.iptalTarihi ?? null)
            .query(`
        UPDATE [dbo].[TODVZ_EBELGE_GIDEN]
        SET [GONDERIM_DURUMU] = @durum, [ICE_RESPONSE_MESAJ] = @mesaj,
            [ICE_RESPONSE_CODE] = @kod,
            [IPTAL_TARIHI] = CASE WHEN @durum = 'IPTAL' THEN @iptalTarihi ELSE [IPTAL_TARIHI] END,
            [IPTAL_EDEN] = CASE WHEN @durum = 'IPTAL' THEN @kullanici ELSE [IPTAL_EDEN] END
        WHERE [UUID] = @uuid AND [BELGE_TURU] = 'EArsiv' AND [GONDERIM_DURUMU] = @beklenen
      `);
        if ((res.rowsAffected?.[0] ?? 0) !== 1) {
            throw ApiError.conflict("Belgenin durumu değişti veya işlem zaten sürüyor. Giden kutusunu yenileyiniz.");
        }
    }
    /** Aynı belge numarası daha önce kullanılmış mı? (gönderim öncesi ön kontrol) */
    static async gidenBelgeNoVarMi(belgeNo, dbContext) {
        const pool = await this.getPool(dbContext);
        const res = await pool
            .request()
            .input("belgeNo", sql.VarChar(40), belgeNo)
            .query(`SELECT TOP 1 1 AS v FROM [dbo].[TODVZ_EBELGE_GIDEN] WHERE [BELGE_NO] = @belgeNo`);
        return res.recordset.length > 0;
    }
    /** Giden belge listesi */
    static async listGiden(filtre, dbContext) {
        const pool = await this.getPool(dbContext);
        const sayfa = Math.max(filtre.sayfa || 1, 1);
        const boyut = Math.min(Math.max(filtre.boyut || 50, 1), 500);
        const kosullar = [];
        const request = pool.request();
        if (filtre.arama) {
            kosullar.push("([BELGE_NO] LIKE @arama OR [ALICI_UNVAN] LIKE @arama OR [UUID] LIKE @arama)");
            request.input("arama", sql.NVarChar(200), `%${filtre.arama}%`);
        }
        if (filtre.durum && filtre.durum !== "TUMU") {
            kosullar.push("[GONDERIM_DURUMU] = @durum");
            request.input("durum", sql.VarChar(20), filtre.durum);
        }
        const where = kosullar.length ? `WHERE ${kosullar.join(" AND ")}` : "";
        const sayim = await request.query(`SELECT COUNT(*) AS toplam FROM [dbo].[TODVZ_EBELGE_GIDEN] ${where}`);
        const toplam = Number(sayim.recordset[0]?.toplam || 0);
        request.input("atla", sql.Int, (sayfa - 1) * boyut).input("al", sql.Int, boyut);
        const res = await request.query(`
      SELECT
        [UUID] as uuid, [BELGE_NO] as belgeNo, [BELGE_TURU] as belgeTuru, [PROFIL] as profil,
        [FATURA_TIPI] as faturaTipi, [TASLAK_MI] as taslakMi,
        [ALICI_VKN] as aliciVkn, [ALICI_ALIAS] as aliciAlias, [ALICI_UNVAN] as aliciUnvan,
        [DUZENLEME_TARIHI] as duzenlemeTarihi, [TUTAR] as tutar, [PARA_BIRIMI] as paraBirimi,
        [GONDERIM_DURUMU] as gonderimDurumu, [SEMA_GECERLI] as semaGecerli,
        [SCHEMATRON_GECERLI] as schematronGecerli, [ICE_RESPONSE_MESAJ] as iceResponseMesaj,
        [GIB_STATU_KODU] as gibStatuKodu, [GIB_STATU_ACIKLAMA] as gibStatuAciklama,
        [OLUSTURAN] as olusturan, [OLUSTURMA_TARIHI] as olusturmaTarihi,
        [GONDEREN] as gonderen, [GONDERIM_TARIHI] as gonderimTarihi,
        [IPTAL_TARIHI] as iptalTarihi, [IPTAL_EDEN] as iptalEden
      FROM [dbo].[TODVZ_EBELGE_GIDEN]
      ${where}
      ORDER BY [OLUSTURMA_TARIHI] DESC
      OFFSET @atla ROWS FETCH NEXT @al ROWS ONLY
    `);
        return {
            toplam,
            kayitlar: res.recordset.map((r) => ({
                ...r,
                taslakMi: Boolean(r.taslakMi),
                semaGecerli: r.semaGecerli === null ? null : Boolean(r.semaGecerli),
                schematronGecerli: r.schematronGecerli === null ? null : Boolean(r.schematronGecerli),
            })),
        };
    }
    /** Tek giden belge */
    static async getGiden(uuid, dbContext) {
        const pool = await this.getPool(dbContext);
        const res = await pool.request().input("uuid", sql.VarChar(60), uuid).query(`
      SELECT TOP 1 *, [UUID] as uuid, [BELGE_NO] as belgeNo, [GONDERIM_DURUMU] as gonderimDurumu,
        [TASLAK_MI] as taslakMi, [BELGE_TURU] as belgeTuru
      FROM [dbo].[TODVZ_EBELGE_GIDEN] WHERE [UUID] = @uuid
    `);
        const row = res.recordset[0];
        if (!row)
            return null;
        return { ...row, taslakMi: Boolean(row.taslakMi) };
    }
    /** Taslağın iptal edildiğini işaretler */
    static async setGidenIptal(uuid, kullanici, dbContext) {
        const pool = await this.getPool(dbContext);
        const res = await pool
            .request()
            .input("uuid", sql.VarChar(60), uuid)
            .input("kullanici", sql.NVarChar(50), kullanici)
            .query(`
        UPDATE [dbo].[TODVZ_EBELGE_GIDEN]
        SET [GONDERIM_DURUMU] = 'IPTAL',
            [IPTAL_TARIHI] = GETDATE(),
            [IPTAL_EDEN] = @kullanici
        WHERE [UUID] = @uuid AND [GONDERIM_DURUMU] = 'TASLAK'
      `);
        return (res.rowsAffected?.[0] ?? 0) > 0;
    }
    /** e-Arşiv iptal bildirimini işaretler (gönderilmiş belge için) */
    static async setGidenEarsivIptal(uuid, kullanici, dbContext) {
        const pool = await this.getPool(dbContext);
        const res = await pool
            .request()
            .input("uuid", sql.VarChar(60), uuid)
            .input("kullanici", sql.NVarChar(50), kullanici)
            .query(`
        UPDATE [dbo].[TODVZ_EBELGE_GIDEN]
        SET [GONDERIM_DURUMU] = 'IPTAL',
            [IPTAL_TARIHI] = GETDATE(),
            [IPTAL_EDEN] = @kullanici
        WHERE [UUID] = @uuid AND [GONDERIM_DURUMU] = 'GONDERILDI'
      `);
        return (res.rowsAffected?.[0] ?? 0) > 0;
    }
    /**
     * Son denetim kayıtlarını getirir (ayar ekranındaki "son işlemler" listesi).
     */
    static async getLogs(limit = 50, dbContext) {
        const pool = await this.getPool(dbContext);
        const res = await pool.request().input("limit", sql.Int, Math.min(Math.max(limit, 1), 500)).query(`
      SELECT TOP (@limit)
        [ID] as id, [TARIH] as tarih, [METOD] as metod, [YON] as yon,
        [BASARILI] as basarili, [FAULT_KODU] as faultKodu,
        [HATA_MESAJI] as hataMesaji, [SURE_MS] as sureMs,
        [KULLANICI] as kullanici, [ILGILI_UUID] as ilgiliUuid
      FROM [dbo].[TODVZ_EBELGE_LOG]
      ORDER BY [ID] DESC
    `);
        return res.recordset.map((r) => ({ ...r, basarili: Boolean(r.basarili) }));
    }
}
