import sql from "mssql";
import crypto from "crypto";
import { getDbPool } from "../config/mssql.config.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";

export interface CariDekontSatiriEntity {
  CARI_DEKONT_ID: number;
  TIP: number;
  SATIR_NO: number;
  PARA_ID: number;
  MEBLAG: number;
  KUR: number;
  GISE_KURU: number;
  // Joined fields
  PARA_KOD?: string;
  PARA_AD?: string;
  HAS_ORANI?: number;
}

export interface CariDekontEntity {
  CARI_DEKONT_ID: number;
  TIP: number;
  TARIH: Date;
  ACIKLAMA: string | null;
  KUR_CINSI: number;
  BORCLU_ID: number;
  ALACAKLI_ID: number;
  EKLEYEN_ID: number;
  GUNCELLEYEN_ID: number;
  EKLEME_ZAMANI: Date;
  GUNCELLEME_ZAMANI: Date;
  VEZNE_ID: number;
  SATIR_DURUMU: number;
  EVRAK_TURU: number;
  VADE: Date | null;
  IPTAL_TARIHI: Date | null;
  ONCEKI_ID: number | null;
  // Joined fields
  BORCLU_KOD?: string;
  BORCLU_AD?: string;
  ALACAKLI_KOD?: string;
  ALACAKLI_AD?: string;
  VEZNE_KOD?: string;
  VEZNE_AD?: string;
  EKLEYEN_KOD?: string;
  EKLEYEN_AD?: string;
}

export interface CariDekontSatiriModel {
  satirNo: number;
  tip: number;
  paraId: number;
  paraKodu: string;
  paraAdi: string;
  hasOrani: number;
  meblag: number;
  hasMiktar: number;
  kur: number;
  giseKuru: number;
  tutar: number;
  aciklama?: string;
}

export interface CariDekontModel {
  cariDekontId: number;
  dekontNo: string;
  tip: number; // 0: Emanet Alma (Giriş), 1: Emanet Verme (Çıkış)
  tipLabel: string;
  tarih: string;
  aciklama: string;
  kurCinsi: number;
  borcluId: number;
  borcluKod: string;
  borcluAd: string;
  borcluTelefon?: string;
  alacakliId: number;
  alacakliKod: string;
  alacakliAd: string;
  alacakliTelefon?: string;
  telefon?: string;
  kullaniciId: number;
  ekleyenAd: string;
  vezneId: number;
  vezneKod: string;
  vezneAd: string;
  satirDurumu: number;
  evrakTuru: number;
  vade: string | null;
  iptalTarihi: string | null;
  oncekiId: number | null;
  eklemeZamani: string;
  guncellemeZamani: string;
  toplamMiktar: number;
  toplamHas: number;
  toplamTutar: number;
  satirlar: CariDekontSatiriModel[];
}

export interface SaveCariDekontSatiriDto {
  satirNo?: number;
  tip?: number;
  paraId: number;
  meblag: number;
  kur?: number;
  giseKuru?: number;
  aciklama?: string;
}

export interface SaveCariDekontDto {
  cariDekontId?: number | null;
  tip: number; // 0: Emanet Alma, 1: Emanet Verme
  tarih: string | Date;
  aciklama?: string | null;
  kurCinsi?: number;
  borcluId: number;
  alacakliId: number;
  telefon?: string;
  borcluTelefon?: string;
  alacakliTelefon?: string;
  kullaniciId?: number;
  vezneId: number;
  degisiklikTakipVar?: boolean | number;
  satirDurumu?: number;
  evrakTuru?: number;
  vade?: string | Date | null;
  iptalTarihi?: string | Date | null;
  oncekiId?: number | null;
  satirlar: SaveCariDekontSatiriDto[];
}

export class CariDekontSqlRepository {
  /**
   * Ensures necessary tables and stored procedures exist in the current database
   */
  public static async ensureTablesAndProceduresExist(pool: sql.ConnectionPool): Promise<void> {
    try {
      // 1. TODVZ_CARI_DEKONT table
      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TODVZ_CARI_DEKONT')
        BEGIN
          CREATE TABLE [dbo].[TODVZ_CARI_DEKONT] (
            [CARI_DEKONT_ID] INT IDENTITY(1,1) NOT NULL PRIMARY KEY CLUSTERED,
            [TIP] TINYINT NOT NULL DEFAULT 0,
            [TARIH] DATETIME NOT NULL DEFAULT GETDATE(),
            [ACIKLAMA] VARCHAR(100) NULL,
            [KUR_CINSI] TINYINT NOT NULL DEFAULT 0,
            [BORCLU_ID] INT NOT NULL DEFAULT 0,
            [ALACAKLI_ID] INT NOT NULL DEFAULT 0,
            [EKLEYEN_ID] INT NOT NULL DEFAULT 1,
            [GUNCELLEYEN_ID] INT NOT NULL DEFAULT 1,
            [EKLEME_ZAMANI] DATETIME NOT NULL DEFAULT GETDATE(),
            [GUNCELLEME_ZAMANI] DATETIME NOT NULL DEFAULT GETDATE(),
            [VEZNE_ID] INT NOT NULL DEFAULT 1,
            [SATIR_DURUMU] TINYINT NOT NULL DEFAULT 0,
            [EVRAK_TURU] TINYINT NOT NULL DEFAULT 0,
            [VADE] DATETIME NULL,
            [IPTAL_TARIHI] DATETIME NULL,
            [ONCEKI_ID] INT NULL
          );
        END
      `);

      // 2. TODVZ_CARI_DEKONT_SATIRI table
      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TODVZ_CARI_DEKONT_SATIRI')
        BEGIN
          CREATE TABLE [dbo].[TODVZ_CARI_DEKONT_SATIRI] (
            [CARI_DEKONT_ID] INT NOT NULL,
            [TIP] TINYINT NOT NULL DEFAULT 0,
            [SATIR_NO] INT NOT NULL DEFAULT 1,
            [PARA_ID] INT NOT NULL DEFAULT 0,
            [MEBLAG] FLOAT NOT NULL DEFAULT 0,
            [KUR] FLOAT NOT NULL DEFAULT 1.0,
            [GISE_KURU] FLOAT NOT NULL DEFAULT 1.0,
            [ACIKLAMA] VARCHAR(250) NULL
          );
          CREATE INDEX [IX_TODVZ_CARI_DEKONT_SATIRI_ID] ON [dbo].[TODVZ_CARI_DEKONT_SATIRI] ([CARI_DEKONT_ID]);
        END
        ELSE
        BEGIN
          IF NOT EXISTS (
            SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'TODVZ_CARI_DEKONT_SATIRI' AND COLUMN_NAME = 'ACIKLAMA'
          )
          BEGIN
            ALTER TABLE [dbo].[TODVZ_CARI_DEKONT_SATIRI] ADD [ACIKLAMA] VARCHAR(250) NULL;
          END
        END
      `);

      // 3. Staging table TODVZ_ISKELE_CARI_DEKONT_SATIR
      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TODVZ_ISKELE_CARI_DEKONT_SATIR')
        BEGIN
          CREATE TABLE [dbo].[TODVZ_ISKELE_CARI_DEKONT_SATIR] (
            [GUID] VARCHAR(50) NOT NULL,
            [TIP] TINYINT NOT NULL DEFAULT 0,
            [SATIR_NO] INT NOT NULL DEFAULT 1,
            [PARA_ID] INT NOT NULL DEFAULT 0,
            [MEBLAG] FLOAT NOT NULL DEFAULT 0,
            [KUR] FLOAT NOT NULL DEFAULT 1.0,
            [GISE_KURU] FLOAT NOT NULL DEFAULT 1.0
          );
          CREATE INDEX [IX_TODVZ_ISKELE_GUID] ON [dbo].[TODVZ_ISKELE_CARI_DEKONT_SATIR] ([GUID]);
        END
      `);

      // 4. Stored Procedure SODVZ_CARI_DEKONT_SIL
      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sys.procedures WHERE name = 'SODVZ_CARI_DEKONT_SIL')
        BEGIN
          EXEC('
            CREATE PROCEDURE [dbo].[SODVZ_CARI_DEKONT_SIL]
              @CARI_DEKONT_ID INT,
              @KULLANICI_ID INT = 1,
              @DEGISIKLIK_TAKIP_VAR BIT = 1
            AS
            BEGIN
              SET NOCOUNT ON;
              DECLARE @HATA_MESAJI VARCHAR(250)
              BEGIN TRAN
              BEGIN TRY
                DELETE FROM TODVZ_CARI_DEKONT_SATIRI WHERE CARI_DEKONT_ID = @CARI_DEKONT_ID
                DELETE FROM TODVZ_CARI_DEKONT WHERE CARI_DEKONT_ID = @CARI_DEKONT_ID
                COMMIT TRAN
                RETURN 0
              END TRY
              BEGIN CATCH
                ROLLBACK TRAN
                SET @HATA_MESAJI = ERROR_MESSAGE()
                RAISERROR(@HATA_MESAJI, 16, 1)
                RETURN 1
              END CATCH
            END
          ')
        END
      `);

      // 5. Stored Procedure SODVZ_CARI_DEKONT_KAYDET
      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sys.procedures WHERE name = 'SODVZ_CARI_DEKONT_KAYDET')
        BEGIN
          EXEC('
            CREATE PROCEDURE [dbo].[SODVZ_CARI_DEKONT_KAYDET]
              @CARI_DEKONT_ID INT OUTPUT,
              @TIP TINYINT,
              @TARIH DATETIME,
              @ACIKLAMA VARCHAR(100) = NULL,
              @KUR_CINSI TINYINT = 0,
              @BORCLU_ID INT,
              @ALACAKLI_ID INT,
              @KULLANICI_ID INT = 1,
              @VEZNE_ID INT = 1,
              @DEGISIKLIK_TAKIP_VAR BIT = 1,
              @SATIR_DURUMU TINYINT = 0,
              @EVRAK_TURU TINYINT = 0,
              @VADE DATETIME = NULL,
              @IPTAL_TARIHI DATETIME = NULL,
              @ONCEKI_ID INT = NULL,
              @GUID VARCHAR(50)
            AS
            BEGIN
              SET NOCOUNT ON;
              DECLARE @ZAMAN DATETIME = GETDATE();
              BEGIN TRAN
              BEGIN TRY
                IF @CARI_DEKONT_ID IS NULL OR @CARI_DEKONT_ID = 0
                BEGIN
                  INSERT INTO TODVZ_CARI_DEKONT(
                    TIP, TARIH, ACIKLAMA, KUR_CINSI, BORCLU_ID, ALACAKLI_ID,
                    SATIR_DURUMU, EVRAK_TURU, VADE, IPTAL_TARIHI,
                    EKLEYEN_ID, EKLEME_ZAMANI, GUNCELLEYEN_ID, GUNCELLEME_ZAMANI,
                    VEZNE_ID, ONCEKI_ID
                  )
                  VALUES(
                    @TIP, @TARIH, @ACIKLAMA, @KUR_CINSI, @BORCLU_ID, @ALACAKLI_ID,
                    @SATIR_DURUMU, @EVRAK_TURU, @VADE, @IPTAL_TARIHI,
                    @KULLANICI_ID, @ZAMAN, @KULLANICI_ID, @ZAMAN,
                    @VEZNE_ID, @ONCEKI_ID
                  );
                  SELECT @CARI_DEKONT_ID = SCOPE_IDENTITY();
                END
                ELSE
                BEGIN
                  UPDATE TODVZ_CARI_DEKONT
                  SET TIP = @TIP,
                      TARIH = @TARIH,
                      ACIKLAMA = @ACIKLAMA,
                      KUR_CINSI = @KUR_CINSI,
                      BORCLU_ID = @BORCLU_ID,
                      ALACAKLI_ID = @ALACAKLI_ID,
                      SATIR_DURUMU = @SATIR_DURUMU,
                      EVRAK_TURU = @EVRAK_TURU,
                      VADE = @VADE,
                      IPTAL_TARIHI = @IPTAL_TARIHI,
                      GUNCELLEYEN_ID = @KULLANICI_ID,
                      GUNCELLEME_ZAMANI = @ZAMAN,
                      VEZNE_ID = @VEZNE_ID
                  WHERE CARI_DEKONT_ID = @CARI_DEKONT_ID;
                END

                DELETE FROM TODVZ_CARI_DEKONT_SATIRI WHERE CARI_DEKONT_ID = @CARI_DEKONT_ID;

                INSERT INTO TODVZ_CARI_DEKONT_SATIRI(CARI_DEKONT_ID, TIP, SATIR_NO, PARA_ID, MEBLAG, KUR, GISE_KURU)
                SELECT @CARI_DEKONT_ID, TIP, SATIR_NO, PARA_ID, MEBLAG, KUR, GISE_KURU
                FROM TODVZ_ISKELE_CARI_DEKONT_SATIR
                WHERE GUID = @GUID;

                DELETE FROM TODVZ_ISKELE_CARI_DEKONT_SATIR WHERE GUID = @GUID;

                COMMIT TRAN;
                RETURN 0;
              END TRY
              BEGIN CATCH
                ROLLBACK TRAN;
                DELETE FROM TODVZ_ISKELE_CARI_DEKONT_SATIR WHERE GUID = @GUID;
                DECLARE @ERR VARCHAR(250) = ERROR_MESSAGE();
                RAISERROR(@ERR, 16, 1);
                RETURN 1;
              END CATCH
            END
          ')
        END
      `);
    } catch (err) {
      logger.warn("CariDekontSqlRepository.ensureTablesAndProceduresExist warning:", err);
    }
  }

  /**
   * Save or Update Cari Dekont via Stored Procedure SODVZ_CARI_DEKONT_KAYDET
   */
  public static async saveViaProcedure(
    dto: SaveCariDekontDto,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<CariDekontModel> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await CariDekontSqlRepository.ensureTablesAndProceduresExist(pool);

    const isUpdate = dto.cariDekontId !== undefined && dto.cariDekontId !== null && Number(dto.cariDekontId) > 0;
    const targetDekontId = isUpdate ? Number(dto.cariDekontId) : null;
    const guid = crypto.randomUUID();

    const tip = dto.tip === 1 ? 1 : 0;
    const parseDate = (d: any, label: string = "Tarih"): Date | null => {
      if (!d) return null;
      const dt = new Date(d);
      if (isNaN(dt.getTime())) {
        throw ApiError.badRequest(`${label} alanında geçersiz bir tarih formatı girildi: '${d}'. Lütfen GG.AA.YYYY formatında giriniz.`);
      }
      const y = dt.getFullYear();
      if (y < 1900 || y > 2099) {
        throw ApiError.badRequest(
          `${label} yılı (${y}) geçersizdir. Takvim standartları gereği yıl 1900 ile 2099 arasında 4 haneli olmalıdır (Örn: 2026 veya 2028).`
        );
      }
      return dt;
    };

    const tarihDate = parseDate(dto.tarih, "İşlem Tarihi") || new Date();
    const vadeDate = parseDate(dto.vade, "Vade Tarihi");
    const iptalTarihiDate = parseDate(dto.iptalTarihi, "İptal Tarihi");

    // 1. Borclu / Alacakli Cari Kontrolü
    const targetCari = dto.alacakliId || dto.borcluId;
    if (!targetCari || targetCari <= 0) {
      throw ApiError.badRequest("Lütfen geçerli bir Cari Hesap seçiniz.");
    }
    const cariCheck = await pool
      .request()
      .input("cid", sql.Int, targetCari)
      .query(`SELECT TOP 1 [CARI_KART_ID] FROM [dbo].[TODVZ_CARI_KART] WHERE [CARI_KART_ID] = @cid`);
    if (cariCheck.recordset.length === 0) {
      throw ApiError.badRequest(
        `Seçilen Cari Kart (ID: ${targetCari}) veritabanında bulunamadı. Lütfen arama butonundan geçerli bir Cari Hesap seçiniz.`
      );
    }

    const finalBorcluId = dto.borcluId && dto.borcluId > 0 ? dto.borcluId : targetCari;
    const finalAlacakliId = dto.alacakliId && dto.alacakliId > 0 ? dto.alacakliId : targetCari;

    // Telefon bilgisini Cari Karta senkronize et (formda girildiyse)
    if (dto.telefon && dto.telefon.trim() && targetCari) {
      try {
        await pool
          .request()
          .input("cid", sql.Int, targetCari)
          .input("tel", sql.VarChar(50), dto.telefon.trim())
          .query(
            `UPDATE [dbo].[TODVZ_CARI_KART] SET [TELEFON] = @tel WHERE [CARI_KART_ID] = @cid AND (ISNULL([TELEFON],'') <> @tel)`
          );
      } catch (telErr) {
        logger.warn("Cari telefon güncelleme uyarısı:", telErr);
      }
    }

    // 2. Vezne Kontrolü ve Fallback
    let finalVezneId = dto.vezneId || 1;
    const vezneCheck = await pool
      .request()
      .input("vid", sql.Int, finalVezneId)
      .query(`SELECT TOP 1 [VEZNE_ID] FROM [dbo].[TODVZ_VEZNE] WHERE [VEZNE_ID] = @vid`);
    if (vezneCheck.recordset.length === 0) {
      const fallbackVezne = await pool
        .request()
        .query(`SELECT TOP 1 [VEZNE_ID] FROM [dbo].[TODVZ_VEZNE] ORDER BY [VEZNE_ID] ASC`);
      if (fallbackVezne.recordset.length > 0) {
        finalVezneId = fallbackVezne.recordset[0].VEZNE_ID;
      }
    }

    // 3. Kullanıcı Kontrolü ve Fallback
    let finalKullaniciId = dto.kullaniciId || 1;
    const userCheck = await pool
      .request()
      .input("uid", sql.Int, finalKullaniciId)
      .query(`SELECT TOP 1 [KULLANICI_ID] FROM [dbo].[TODVZ_KULLANICI] WHERE [KULLANICI_ID] = @uid`);
    if (userCheck.recordset.length === 0) {
      const fallbackUser = await pool
        .request()
        .query(`SELECT TOP 1 [KULLANICI_ID] FROM [dbo].[TODVZ_KULLANICI] ORDER BY [KULLANICI_ID] ASC`);
      if (fallbackUser.recordset.length > 0) {
        finalKullaniciId = fallbackUser.recordset[0].KULLANICI_ID;
      }
    }

    // 4. Önceki Belge Kontrolü (Foreign Key ihlalini engellemek için)
    let finalOncekiId: number | null = null;
    if (dto.oncekiId !== null && dto.oncekiId !== undefined && Number(dto.oncekiId) > 0) {
      const oncekiCheck = await pool
        .request()
        .input("oid", sql.Int, Number(dto.oncekiId))
        .query(`SELECT TOP 1 [CARI_DEKONT_ID] FROM [dbo].[TODVZ_CARI_DEKONT] WHERE [CARI_DEKONT_ID] = @oid`);
      if (oncekiCheck.recordset.length > 0) {
        finalOncekiId = Number(dto.oncekiId);
      } else {
        throw ApiError.badRequest(
          `Girdiğiniz 'Önceki Belge' numarası (${dto.oncekiId}) sistemde kayıtlı bir dekont ile eşleşmiyor. Lütfen geçerli bir önceki dekont numarası giriniz veya bu alanı boş bırakınız.`
        );
      }
    }

    // Filter valid lines
    const validLines = (dto.satirlar || []).filter((l) => l.paraId > 0 && Number(l.meblag) > 0);
    if (validLines.length === 0) {
      throw ApiError.badRequest("Lütfen en az bir geçerli para birimi ve miktar içeren dekont satırı giriniz.");
    }

    // Step 1: Insert rows into staging table TODVZ_ISKELE_CARI_DEKONT_SATIR
    try {
      for (let i = 0; i < validLines.length; i++) {
        const line = validLines[i];
        const lineSeq = line.satirNo !== undefined && line.satirNo > 0 ? line.satirNo : i + 1;
        const lineTip = line.tip !== undefined ? Number(line.tip) : tip;
        const meblag = Number(line.meblag) || 0;
        const kur = Number(line.kur) || 1.0;
        const giseKuru = Number(line.giseKuru) || 1.0;

        await pool
          .request()
          .input("guid", sql.VarChar(50), guid)
          .input("tip", sql.TinyInt, lineTip)
          .input("satirNo", sql.Int, lineSeq)
          .input("paraId", sql.Int, line.paraId)
          .input("meblag", sql.Float, meblag)
          .input("kur", sql.Float, kur)
          .input("giseKuru", sql.Float, giseKuru)
          .query(`
            INSERT INTO [dbo].[TODVZ_ISKELE_CARI_DEKONT_SATIR] (GUID, TIP, SATIR_NO, PARA_ID, MEBLAG, KUR, GISE_KURU)
            VALUES (@guid, @tip, @satirNo, @paraId, @meblag, @kur, @giseKuru)
          `);
      }
    } catch (insertErr: any) {
      await pool.request().input("guid", sql.VarChar(50), guid).query("DELETE FROM [dbo].[TODVZ_ISKELE_CARI_DEKONT_SATIR] WHERE GUID = @guid");
      throw ApiError.badRequest("Dekont satırları iskeleye eklenemedi: " + (insertErr?.message || insertErr));
    }

    // Step 2: Execute Stored Procedure SODVZ_CARI_DEKONT_KAYDET
    // If targetDekontId is NULL (new record), pre-allocate in TODVZ_CARI_DEKONT using SCOPE_IDENTITY()
    // to guarantee @OUT_ID is NEVER null (protects against trigger-wiped @@IDENTITY in legacy DBs).
    const execQuery = `
      DECLARE @OUT_ID INT = @targetDekontId;

      IF @OUT_ID IS NULL OR @OUT_ID = 0
      BEGIN
        INSERT INTO [dbo].[TODVZ_CARI_DEKONT] (
          TIP, TARIH, ACIKLAMA, KUR_CINSI, BORCLU_ID, ALACAKLI_ID,
          SATIR_DURUMU, EVRAK_TURU, VADE, IPTAL_TARIHI,
          EKLEYEN_ID, EKLEME_ZAMANI, GUNCELLEYEN_ID, GUNCELLEME_ZAMANI,
          VEZNE_ID, ONCEKI_ID
        )
        VALUES (
          @tip, @tarih, @aciklama, @kurCinsi, @borcluId, @alacakliId,
          @satirDurumu, @evrakTuru, @vade, @iptalTarihi,
          @kullaniciId, GETDATE(), @kullaniciId, GETDATE(),
          @vezneId, @oncekiId
        );
        SELECT @OUT_ID = SCOPE_IDENTITY();
        IF @OUT_ID IS NULL OR @OUT_ID = 0
          SELECT @OUT_ID = IDENT_CURRENT('TODVZ_CARI_DEKONT');
        IF @OUT_ID IS NULL OR @OUT_ID = 0
          SELECT @OUT_ID = MAX(CARI_DEKONT_ID) FROM [dbo].[TODVZ_CARI_DEKONT];
      END

      EXEC [dbo].[SODVZ_CARI_DEKONT_KAYDET]
        @CARI_DEKONT_ID = @OUT_ID OUTPUT,
        @TIP = @tip,
        @TARIH = @tarih,
        @ACIKLAMA = @aciklama,
        @KUR_CINSI = @kurCinsi,
        @BORCLU_ID = @borcluId,
        @ALACAKLI_ID = @alacakliId,
        @KULLANICI_ID = @kullaniciId,
        @VEZNE_ID = @vezneId,
        @DEGISIKLIK_TAKIP_VAR = @degisiklikTakipVar,
        @SATIR_DURUMU = @satirDurumu,
        @EVRAK_TURU = @evrakTuru,
        @VADE = @vade,
        @IPTAL_TARIHI = @iptalTarihi,
        @ONCEKI_ID = @oncekiId,
        @GUID = @guid;

      SELECT @OUT_ID AS [CARI_DEKONT_ID];
    `;

    const procReq = pool.request();
    procReq.input("targetDekontId", sql.Int, targetDekontId);
    procReq.input("tip", sql.TinyInt, tip);
    procReq.input("tarih", sql.DateTime, tarihDate);
    procReq.input("aciklama", sql.VarChar(100), (dto.aciklama || "").substring(0, 100));
    procReq.input("kurCinsi", sql.TinyInt, dto.kurCinsi ?? 0);
    procReq.input("borcluId", sql.Int, finalBorcluId);
    procReq.input("alacakliId", sql.Int, finalAlacakliId);
    procReq.input("kullaniciId", sql.Int, finalKullaniciId);
    procReq.input("vezneId", sql.Int, finalVezneId);
    procReq.input("degisiklikTakipVar", sql.Bit, dto.degisiklikTakipVar !== undefined ? (dto.degisiklikTakipVar ? 1 : 0) : 1);
    procReq.input("satirDurumu", sql.TinyInt, dto.satirDurumu ?? 0);
    procReq.input("evrakTuru", sql.TinyInt, dto.evrakTuru ?? 0);
    procReq.input("vade", sql.DateTime, vadeDate);
    procReq.input("iptalTarihi", sql.DateTime, iptalTarihiDate);
    procReq.input("oncekiId", sql.Int, finalOncekiId);
    procReq.input("guid", sql.VarChar(50), guid);

    let savedDekontId: number = targetDekontId || 0;

    try {
      const execRes = await procReq.query<{ CARI_DEKONT_ID: number }>(execQuery);
      if (execRes.recordset.length > 0 && execRes.recordset[0].CARI_DEKONT_ID > 0) {
        savedDekontId = execRes.recordset[0].CARI_DEKONT_ID;
      }
    } catch (procErr: any) {
      // Clean up staging on error if procedure rollback missed it
      try {
        await pool.request().input("guid", sql.VarChar(50), guid).query("DELETE FROM [dbo].[TODVZ_ISKELE_CARI_DEKONT_SATIR] WHERE GUID = @guid");
      } catch {}
      const rawMsg = procErr?.originalError?.message || procErr?.message || String(procErr);
      
      let userFriendlyMsg = rawMsg;
      if (rawMsg.includes("60238")) {
        userFriendlyMsg = "Kayıt işlemi veritabanı kuralları gereği geri alındı. Lütfen seçilen cari hesabın risk/bakiye limitini, vezne yetkisini ve işlem tarihinin onaylı hesap döneminde olup olmadığını kontrol ediniz.";
      } else if (rawMsg.includes("Onaylanmış hesap dönemine")) {
        userFriendlyMsg = "Onaylanmış hesap dönemine ait işlem yapılamaz. Lütfen 'İşlem Tarihi' alanına güncel döneme ait bir tarih giriniz.";
      } else if (rawMsg.includes("Cari bakiye sınırı aşıldı")) {
        userFriendlyMsg = "Cari bakiye sınırı aşıldı: Seçilen cari hesabın borç/alacak bakiye limiti dolduğu için işlem kaydedilemiyor. Lütfen cari kart tanımından bakiye limitini kontrol ediniz.";
      } else if (rawMsg.includes("out-of-range") || rawMsg.includes("converting date")) {
        userFriendlyMsg = "Tarih alanlarından birinde geçersiz bir değer (örn: 20028 gibi aşırı büyük bir yıl) girildi. Lütfen tarihleri 1900-2099 aralığında 4 haneli olarak kontrol ediniz.";
      } else if (rawMsg.includes("FOREIGN KEY")) {
        if (rawMsg.includes("ONCEKI_ID") || rawMsg.includes("TODVZ_CARI_DEKONT_TODVZ_CARI_DEKONT")) {
          userFriendlyMsg = "Girdiğiniz 'Önceki Belge' numarası sistemde kayıtlı bir dekont ile eşleşmiyor. Lütfen geçerli bir önceki dekont numarası giriniz veya bu alanı boş bırakınız.";
        } else if (rawMsg.includes("VEZNE")) {
          userFriendlyMsg = "Seçilen Vezne veritabanında bulunamadı. Lütfen kullanıcınızın veznesini kontrol ediniz.";
        } else if (rawMsg.includes("KULLANICI")) {
          userFriendlyMsg = "İşlemi yapan kullanıcı veritabanında bulunamadı.";
        } else if (rawMsg.includes("PARA")) {
          userFriendlyMsg = "Tabloda seçilen para birimi veritabanında bulunamadı.";
        } else if (rawMsg.includes("CARI_KART") || rawMsg.includes("BORCLU") || rawMsg.includes("ALACAKLI")) {
          userFriendlyMsg = "Seçilen Cari Hesap veritabanında bulunamadı. Lütfen arama butonundan geçerli bir Cari Hesap seçiniz.";
        } else {
          userFriendlyMsg = `İlişkisel Veri (Foreign Key) Hatası: ${rawMsg}`;
        }
      } else if (rawMsg.includes("Tarihli cari dekonta donüşmüş")) {
        userFriendlyMsg = rawMsg;
      }

      logger.error("SODVZ_CARI_DEKONT_KAYDET execution error:", { raw: rawMsg, friendly: userFriendlyMsg });
      throw ApiError.badRequest(userFriendlyMsg);
    }

    if (!savedDekontId) {
      // Fallback query for newly inserted ID
      const fallbackRes = await pool.request().query<{ ID: number }>(`
        SELECT TOP 1 [CARI_DEKONT_ID] AS [ID] FROM [dbo].[TODVZ_CARI_DEKONT] ORDER BY [CARI_DEKONT_ID] DESC
      `);
      if (fallbackRes.recordset.length > 0 && fallbackRes.recordset[0].ID > 0) {
        savedDekontId = fallbackRes.recordset[0].ID;
      }
    }

    // 5. Satır Açıklamalarını TODVZ_CARI_DEKONT_SATIRI tablosuna kaydet
    for (let i = 0; i < validLines.length; i++) {
      const line = validLines[i];
      const seq = line.satirNo !== undefined && line.satirNo > 0 ? line.satirNo : i + 1;
      const rowAciklama = (line.aciklama || "").trim();
      if (rowAciklama) {
        try {
          await pool
            .request()
            .input("dekontId", sql.Int, savedDekontId)
            .input("satirNo", sql.Int, seq)
            .input("aciklama", sql.VarChar(250), rowAciklama.substring(0, 250))
            .query(`
              UPDATE [dbo].[TODVZ_CARI_DEKONT_SATIRI]
              SET [ACIKLAMA] = @aciklama
              WHERE [CARI_DEKONT_ID] = @dekontId AND [SATIR_NO] = @satirNo
            `);
        } catch (lineErr) {
          logger.warn("Satır açıklaması güncellenirken uyarı:", lineErr);
        }
      }
    }

    const result = await CariDekontSqlRepository.findById(savedDekontId, dbContext);
    if (!result) {
      throw ApiError.internal("Cari dekont kaydedildi ancak okunamadı.");
    }
    return result;
  }

  /**
   * Delete Cari Dekont via Stored Procedure SODVZ_CARI_DEKONT_SIL
   */
  public static async deleteViaProcedure(
    id: number,
    kullaniciId: number = 1,
    degisiklikTakipVar: boolean = true,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<void> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await CariDekontSqlRepository.ensureTablesAndProceduresExist(pool);

    const checkRes = await pool
      .request()
      .input("id", sql.Int, id)
      .query("SELECT CARI_DEKONT_ID FROM [dbo].[TODVZ_CARI_DEKONT] WHERE CARI_DEKONT_ID = @id");

    if (checkRes.recordset.length === 0) {
      throw ApiError.notFound("Silinmek istenen dekont bulunamadı.");
    }

    await pool
      .request()
      .input("id", sql.Int, id)
      .input("kullaniciId", sql.Int, kullaniciId)
      .input("degisiklikTakipVar", sql.Bit, degisiklikTakipVar ? 1 : 0)
      .execute("SODVZ_CARI_DEKONT_SIL");
  }

  /**
   * Find single Cari Dekont by ID with lines
   */
  public static async findById(
    id: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<CariDekontModel | null> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await CariDekontSqlRepository.ensureTablesAndProceduresExist(pool);

    const headerRes = await pool
      .request()
      .input("id", sql.Int, id)
      .query<CariDekontEntity>(`
        SELECT 
          D.*,
          ISNULL(CB.KOD, '') AS [BORCLU_KOD],
          ISNULL(CB.AD, '') AS [BORCLU_AD],
          ISNULL(CB.TELEFON, '') AS [BORCLU_TELEFON],
          ISNULL(CA.KOD, '') AS [ALACAKLI_KOD],
          ISNULL(CA.AD, '') AS [ALACAKLI_AD],
          ISNULL(CA.TELEFON, '') AS [ALACAKLI_TELEFON],
          ISNULL(V.KOD, '') AS [VEZNE_KOD],
          ISNULL(V.AD, '') AS [VEZNE_AD]
        FROM [dbo].[TODVZ_CARI_DEKONT] D
        LEFT JOIN [dbo].[TODVZ_CARI_KART] CB ON D.BORCLU_ID = CB.CARI_KART_ID
        LEFT JOIN [dbo].[TODVZ_CARI_KART] CA ON D.ALACAKLI_ID = CA.CARI_KART_ID
        LEFT JOIN [dbo].[TODVZ_VEZNE] V ON D.VEZNE_ID = V.VEZNE_ID
        WHERE D.CARI_DEKONT_ID = @id
      `);

    if (headerRes.recordset.length === 0) return null;
    const h = headerRes.recordset[0];

    const linesRes = await pool
      .request()
      .input("dekontId", sql.Int, id)
      .query<CariDekontSatiriEntity>(`
        SELECT 
          S.*,
          ISNULL(P.KOD, '') AS [PARA_KOD],
          ISNULL(P.AD, '') AS [PARA_AD],
          ISNULL(P.HAS_ORANI, 1.0) AS [HAS_ORANI],
          ISNULL(S.ACIKLAMA, '') AS [SATIR_ACIKLAMA]
        FROM [dbo].[TODVZ_CARI_DEKONT_SATIRI] S
        LEFT JOIN [dbo].[TODVZ_PARA] P ON S.PARA_ID = P.PARA_ID
        WHERE S.CARI_DEKONT_ID = @dekontId
        ORDER BY S.SATIR_NO ASC
      `);

    let toplamMiktar = 0;
    let toplamHas = 0;
    let toplamTutar = 0;

    const satirlar: CariDekontSatiriModel[] = linesRes.recordset.map((line) => {
      const miktar = line.MEBLAG ?? 0;
      const hasOrani = Number(line.HAS_ORANI) || 1.0;
      const hasMiktar = Number((miktar * hasOrani).toFixed(3));
      const kur = line.KUR ?? 1.0;
      const giseKuru = line.GISE_KURU ?? 1.0;
      const tutar = Number((hasMiktar * kur).toFixed(2));

      toplamMiktar += miktar;
      toplamHas += hasMiktar;
      toplamTutar += tutar;

      return {
        satirNo: line.SATIR_NO,
        tip: line.TIP,
        paraId: line.PARA_ID,
        paraKodu: line.PARA_KOD || "",
        paraAdi: line.PARA_AD || "",
        hasOrani,
        meblag: miktar,
        hasMiktar,
        kur,
        giseKuru,
        tutar,
        aciklama: (line as any).SATIR_ACIKLAMA || "",
      };
    });

    const borcluTelefon = (h as any).BORCLU_TELEFON || "";
    const alacakliTelefon = (h as any).ALACAKLI_TELEFON || "";
    const telefon = (h.TIP === 0 ? alacakliTelefon : borcluTelefon) || alacakliTelefon || borcluTelefon || "";

    return {
      cariDekontId: h.CARI_DEKONT_ID,
      dekontNo: `DK-${String(h.CARI_DEKONT_ID).padStart(6, "0")}`,
      tip: h.TIP,
      tipLabel: h.TIP === 0 ? "Emanet Alma (Giriş)" : "Emanet Verme (Çıkış)",
      tarih: h.TARIH ? new Date(h.TARIH).toISOString().split("T")[0] : "",
      aciklama: h.ACIKLAMA || "",
      kurCinsi: h.KUR_CINSI ?? 0,
      borcluId: h.BORCLU_ID,
      borcluKod: h.BORCLU_KOD || "",
      borcluAd: h.BORCLU_AD || "",
      borcluTelefon,
      alacakliId: h.ALACAKLI_ID,
      alacakliKod: h.ALACAKLI_KOD || "",
      alacakliAd: h.ALACAKLI_AD || "",
      alacakliTelefon,
      telefon,
      kullaniciId: h.EKLEYEN_ID,
      ekleyenAd: h.EKLEYEN_AD || "",
      vezneId: h.VEZNE_ID,
      vezneKod: h.VEZNE_KOD || "",
      vezneAd: h.VEZNE_AD || "",
      satirDurumu: h.SATIR_DURUMU ?? 0,
      evrakTuru: h.EVRAK_TURU ?? 0,
      vade: h.VADE ? new Date(h.VADE).toISOString().split("T")[0] : null,
      iptalTarihi: h.IPTAL_TARIHI ? new Date(h.IPTAL_TARIHI).toISOString().split("T")[0] : null,
      oncekiId: h.ONCEKI_ID ?? null,
      eklemeZamani: h.EKLEME_ZAMANI ? new Date(h.EKLEME_ZAMANI).toISOString() : "",
      guncellemeZamani: h.GUNCELLEME_ZAMANI ? new Date(h.GUNCELLEME_ZAMANI).toISOString() : "",
      toplamMiktar: Number(toplamMiktar.toFixed(2)),
      toplamHas: Number(toplamHas.toFixed(3)),
      toplamTutar: Number(toplamTutar.toFixed(2)),
      satirlar,
    };
  }

  /**
   * Search / List Cari Dekonts for Dürbün lookup modal
   */
  public static async findAll(
    filter?: {
      search?: string;
      tip?: number;
      vezneId?: number;
      limit?: number;
    },
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<
    Array<{
      cariDekontId: number;
      dekontNo: string;
      tip: number;
      tipLabel: string;
      tarih: string;
      cariKod: string;
      cariAd: string;
      vezneKod: string;
      vezneAd: string;
      aciklama: string;
      kalemSayisi: number;
      toplamMiktar: number;
    }>
  > {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await CariDekontSqlRepository.ensureTablesAndProceduresExist(pool);

    const limit = Math.min(Number(filter?.limit) || 100, 250);
    const req = pool.request();
    req.input("limit", sql.Int, limit);

    let whereClauses: string[] = [];

    if (filter?.tip !== undefined && filter?.tip !== null && filter.tip >= 0) {
      req.input("tip", sql.TinyInt, filter.tip);
      whereClauses.push("D.TIP = @tip");
    }

    if (filter?.vezneId) {
      req.input("vezneId", sql.Int, filter.vezneId);
      whereClauses.push("D.VEZNE_ID = @vezneId");
    }

    if (filter?.search && filter.search.trim()) {
      req.input("search", sql.VarChar(100), `%${filter.search.trim()}%`);
      whereClauses.push(`(
        CAST(D.CARI_DEKONT_ID AS VARCHAR) LIKE @search OR
        D.ACIKLAMA LIKE @search OR
        ISNULL(CB.KOD, '') LIKE @search OR
        ISNULL(CB.AD, '') LIKE @search OR
        ISNULL(CA.KOD, '') LIKE @search OR
        ISNULL(CA.AD, '') LIKE @search
      )`);
    }

    const whereSql = whereClauses.length > 0 ? "WHERE " + whereClauses.join(" AND ") : "";

    const query = `
      SELECT TOP (@limit)
        D.CARI_DEKONT_ID,
        D.TIP,
        D.TARIH,
        ISNULL(D.ACIKLAMA, '') AS [ACIKLAMA],
        D.VEZNE_ID,
        CASE WHEN D.TIP = 0 THEN ISNULL(CA.KOD, ISNULL(CB.KOD, '')) ELSE ISNULL(CB.KOD, ISNULL(CA.KOD, '')) END AS [CARI_KOD],
        CASE WHEN D.TIP = 0 THEN ISNULL(CA.AD, ISNULL(CB.AD, '')) ELSE ISNULL(CB.AD, ISNULL(CA.AD, '')) END AS [CARI_AD],
        ISNULL(V.KOD, '') AS [VEZNE_KOD],
        ISNULL(V.AD, '') AS [VEZNE_AD],
        ISNULL(SUM_SATIR.KALEM_SAYISI, 0) AS [KALEM_SAYISI],
        ISNULL(SUM_SATIR.TOPLAM_MIKTAR, 0) AS [TOPLAM_MIKTAR]
      FROM [dbo].[TODVZ_CARI_DEKONT] D
      LEFT JOIN [dbo].[TODVZ_CARI_KART] CB ON D.BORCLU_ID = CB.CARI_KART_ID
      LEFT JOIN [dbo].[TODVZ_CARI_KART] CA ON D.ALACAKLI_ID = CA.CARI_KART_ID
      LEFT JOIN [dbo].[TODVZ_VEZNE] V ON D.VEZNE_ID = V.VEZNE_ID
      LEFT JOIN (
        SELECT 
          CARI_DEKONT_ID,
          COUNT(*) AS [KALEM_SAYISI],
          SUM(MEBLAG) AS [TOPLAM_MIKTAR]
        FROM [dbo].[TODVZ_CARI_DEKONT_SATIRI]
        GROUP BY CARI_DEKONT_ID
      ) SUM_SATIR ON D.CARI_DEKONT_ID = SUM_SATIR.CARI_DEKONT_ID
      ${whereSql}
      ORDER BY D.CARI_DEKONT_ID DESC
    `;

    const res = await req.query(query);

    return res.recordset.map((r: any) => ({
      cariDekontId: r.CARI_DEKONT_ID,
      dekontNo: `DK-${String(r.CARI_DEKONT_ID).padStart(6, "0")}`,
      tip: r.TIP,
      tipLabel: r.TIP === 0 ? "Emanet Alma (Giriş)" : "Emanet Verme (Çıkış)",
      tarih: r.TARIH ? new Date(r.TARIH).toISOString().split("T")[0] : "",
      cariKod: r.CARI_KOD || "",
      cariAd: r.CARI_AD || "",
      vezneKod: r.VEZNE_KOD || "",
      vezneAd: r.VEZNE_AD || "",
      aciklama: r.ACIKLAMA || "",
      kalemSayisi: r.KALEM_SAYISI || 0,
      toplamMiktar: Number((r.TOPLAM_MIKTAR || 0).toFixed(2)),
    }));
  }
}
