import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";

export interface VezneTransferiSatiriModel {
  satirNo: number;
  paraId: number;
  paraKodu: string;
  paraAdi: string;
  miktar: number;
}

export interface VezneTransferiModel {
  id: number;
  tarih: string;
  refNo: string;
  alanVezneId: number;
  alanVezneKod: string;
  alanVezneAd: string;
  verenVezneId: number;
  verenVezneKod: string;
  verenVezneAd: string;
  aciklama: string;
  ekleyenId?: number;
  eklemeZamani?: string;
  guncelleyenId?: number;
  guncellemeZamani?: string;
  satirlar: VezneTransferiSatiriModel[];
}

export interface SaveVezneTransferiSatiriDto {
  satirNo?: number;
  paraId: number;
  paraKodu?: string;
  paraAdi?: string;
  miktar: number;
}

export interface SaveVezneTransferiDto {
  id?: number | null;
  tarih: string;
  refNo?: string | null;
  alanVezneId: number;
  verenVezneId: number;
  aciklama?: string | null;
  kullaniciId?: number;
  degisiklikTakipVar?: boolean;
  satirlar: SaveVezneTransferiSatiriDto[];
}

export interface VezneTransferiListItem {
  id: number;
  tarih: string;
  refNo: string;
  alanVezneId: number;
  alanVezneKod: string;
  alanVezneAd: string;
  verenVezneId: number;
  verenVezneKod: string;
  verenVezneAd: string;
  aciklama: string;
  satirSayisi: number;
  toplamMiktar: number;
  paraBirimleri: string;
  eklemeZamani?: string;
}

export class VezneTransferiSqlRepository {
  /**
   * Ensures stored procedures SODVZ_VEZNE_TRANSFERI_KAYDET and SODVZ_VEZNE_TRANSFERI_SIL exist.
   */
  private static async ensureProcedures(pool: sql.ConnectionPool): Promise<void> {
    try {
      const checkRes = await pool.request().query(`
        SELECT name FROM sys.procedures 
        WHERE name IN ('SODVZ_VEZNE_TRANSFERI_KAYDET', 'SODVZ_VEZNE_TRANSFERI_SIL')
      `);
      const existingNames = new Set((checkRes.recordset || []).map((r: any) => r.name));

      if (!existingNames.has("SODVZ_VEZNE_TRANSFERI_SIL")) {
        logger.info("[VezneTransferi] SODVZ_VEZNE_TRANSFERI_SIL prosedürü oluşturuluyor...");
        await pool.request().batch(`
          CREATE PROCEDURE SODVZ_VEZNE_TRANSFERI_SIL
            @VEZNE_TRANSFERI_ID INT,
            @KULLANICI_ID INT,
            @DEGISIKLIK_TAKIP_VAR BIT
          AS
          BEGIN
            BEGIN TRAN
            DECLARE C_SILINEN CURSOR LOCAL FOR
              SELECT T.ALAN_VEZNE_ID, T.VEREN_VEZNE_ID, S.PARA_ID, S.MIKTAR
                FROM TODVZ_VEZNE_TRANSFERI T
                  INNER JOIN TODVZ_VEZNE_TRANSFERI_SATIRI S ON S.VEZNE_TRANSFERI_ID = T.VEZNE_TRANSFERI_ID
                WHERE T.VEZNE_TRANSFERI_ID = @VEZNE_TRANSFERI_ID
            DECLARE @A_VEZNE_ID INT
            DECLARE @V_VEZNE_ID INT
            DECLARE @PARA_ID INT
            DECLARE @MIKTAR DECIMAL(18,4)
            OPEN C_SILINEN
            FETCH NEXT FROM C_SILINEN INTO @A_VEZNE_ID, @V_VEZNE_ID, @PARA_ID, @MIKTAR
            WHILE @@FETCH_STATUS = 0
            BEGIN
              UPDATE TODVZ_VEZNE_BAKIYE SET MIKTAR = MIKTAR - @MIKTAR WHERE VEZNE_ID = @A_VEZNE_ID AND PARA_ID = @PARA_ID
              UPDATE TODVZ_VEZNE_BAKIYE SET MIKTAR = MIKTAR + @MIKTAR WHERE VEZNE_ID = @V_VEZNE_ID AND PARA_ID = @PARA_ID
              FETCH NEXT FROM C_SILINEN INTO @A_VEZNE_ID, @V_VEZNE_ID, @PARA_ID, @MIKTAR
            END
            CLOSE C_SILINEN
            DEALLOCATE C_SILINEN
            IF @DEGISIKLIK_TAKIP_VAR = 1 AND OBJECT_ID('TODVZ_LOG_TRANSFER') IS NOT NULL
              INSERT INTO TODVZ_LOG_TRANSFER(
                ZAMAN,
                KULLANICI_ID,
                ISLEM,
                VEZNE_TRANSFERI_ID,
                ALAN_VEZNE_ID,
                O_REF_NO,
                O_TARIH,
                O_VEREN_VEZNE_ID,
                SATIR_NO,
                O_PARA_ID,
                O_MIKTAR)
              SELECT GETDATE(),
                @KULLANICI_ID,
                2,
                F.VEZNE_TRANSFERI_ID,
                F.ALAN_VEZNE_ID,
                F.REF_NO,
                F.TARIH,
                F.VEREN_VEZNE_ID,
                S.SATIR_NO,
                S.PARA_ID,
                S.MIKTAR
              FROM TODVZ_VEZNE_TRANSFERI_SATIRI S
                INNER JOIN TODVZ_VEZNE_TRANSFERI F ON F.VEZNE_TRANSFERI_ID = S.VEZNE_TRANSFERI_ID
              WHERE F.VEZNE_TRANSFERI_ID = @VEZNE_TRANSFERI_ID
            DELETE FROM TODVZ_VEZNE_TRANSFERI_SATIRI WHERE VEZNE_TRANSFERI_ID = @VEZNE_TRANSFERI_ID
            IF @@ERROR<>0 GOTO UNDO
            DELETE FROM TODVZ_VEZNE_TRANSFERI WHERE VEZNE_TRANSFERI_ID = @VEZNE_TRANSFERI_ID
            IF @@ERROR<>0 GOTO UNDO
            COMMIT TRAN
            RETURN 0
          UNDO:
            ROLLBACK TRAN
            RAISERROR ('Vezne transferi silinemedi',16,1)
            RETURN 1
          END
        `);
      }

      if (!existingNames.has("SODVZ_VEZNE_TRANSFERI_KAYDET")) {
        logger.info("[VezneTransferi] SODVZ_VEZNE_TRANSFERI_KAYDET prosedürü oluşturuluyor...");
        await pool.request().batch(`
          CREATE PROCEDURE SODVZ_VEZNE_TRANSFERI_KAYDET
            @VEZNE_TRANSFERI_ID INT OUT,
            @TARIH DATETIME,
            @REF_NO VARCHAR(20) OUT,
            @ALAN_VEZNE_ID INT,
            @VEREN_VEZNE_ID INT,
            @ACIKLAMA VARCHAR(250),
            @KULLANICI_ID INT,
            @DEGISIKLIK_TAKIP_VAR BIT
          AS
          BEGIN
            DECLARE @HATA_MESAJI VARCHAR(250)
            DECLARE @DONUS_KODU INT
            DECLARE @ZAMAN DATETIME
            SET @ZAMAN = GETDATE()
            IF (@REF_NO IS NULL OR LEN(@REF_NO) = 0) /* numeratör */
            BEGIN
              IF OBJECT_ID('SODVZ_NUMERATOR_URET') IS NOT NULL
              BEGIN
                EXEC @DONUS_KODU = SODVZ_NUMERATOR_URET 10, @REF_NO OUT, NULL, 1, NULL, NULL
                IF @DONUS_KODU = 1
                BEGIN
                  SET @HATA_MESAJI = 'Numeratör bitiş sayısını geçmiş'
                  GOTO UNDO
                END
              END
              ELSE
              BEGIN
                SET @REF_NO = 'VT' + CONVERT(VARCHAR(8), GETDATE(), 112) + RIGHT('0000' + CAST(ISNULL(@VEZNE_TRANSFERI_ID, 1) AS VARCHAR), 4)
              END
            END
            DECLARE @PARA_ID INT
            DECLARE @MIKTAR DECIMAL(18,4)
            IF @VEZNE_TRANSFERI_ID IS NULL
            BEGIN
              INSERT INTO TODVZ_VEZNE_TRANSFERI(
                  TARIH,
                  REF_NO,
                  ALAN_VEZNE_ID,
                  VEREN_VEZNE_ID,
                  ACIKLAMA,
                  EKLEYEN_ID,
                  EKLEME_ZAMANI,
                  GUNCELLEYEN_ID,
                  GUNCELLEME_ZAMANI)
                VALUES(
                  @TARIH,
                  @REF_NO,
                  @ALAN_VEZNE_ID,
                  @VEREN_VEZNE_ID,
                  @ACIKLAMA,
                  @KULLANICI_ID,
                  @ZAMAN,
                  @KULLANICI_ID,
                  @ZAMAN)
              SELECT @VEZNE_TRANSFERI_ID = SCOPE_IDENTITY()
              IF @@ERROR<>0 GOTO UNDO
            END
            ELSE BEGIN
              DECLARE C_SILINEN CURSOR LOCAL FOR
                SELECT T.ALAN_VEZNE_ID, T.VEREN_VEZNE_ID, S.PARA_ID, S.MIKTAR
                  FROM TODVZ_VEZNE_TRANSFERI T
                    INNER JOIN TODVZ_VEZNE_TRANSFERI_SATIRI S ON S.VEZNE_TRANSFERI_ID = T.VEZNE_TRANSFERI_ID
                  WHERE T.VEZNE_TRANSFERI_ID = @VEZNE_TRANSFERI_ID
              DECLARE @A_VEZNE_ID INT
              DECLARE @V_VEZNE_ID INT
              OPEN C_SILINEN
              FETCH NEXT FROM C_SILINEN INTO @A_VEZNE_ID, @V_VEZNE_ID, @PARA_ID, @MIKTAR
              WHILE @@FETCH_STATUS = 0
              BEGIN
                UPDATE TODVZ_VEZNE_BAKIYE SET MIKTAR = MIKTAR - @MIKTAR WHERE VEZNE_ID = @A_VEZNE_ID AND PARA_ID = @PARA_ID
                UPDATE TODVZ_VEZNE_BAKIYE SET MIKTAR = MIKTAR + @MIKTAR WHERE VEZNE_ID = @V_VEZNE_ID AND PARA_ID = @PARA_ID
                FETCH NEXT FROM C_SILINEN INTO @A_VEZNE_ID, @V_VEZNE_ID, @PARA_ID, @MIKTAR
              END
              CLOSE C_SILINEN
              DEALLOCATE C_SILINEN
              IF @DEGISIKLIK_TAKIP_VAR = 1 AND OBJECT_ID('TODVZ_LOG_TRANSFER') IS NOT NULL
              BEGIN
                DECLARE @DEGISEN_SATIR_SAYISI INT
                INSERT INTO TODVZ_LOG_TRANSFER(
                  ZAMAN,
                  KULLANICI_ID,
                  ISLEM,
                  VEZNE_TRANSFERI_ID,
                  ALAN_VEZNE_ID,
                  O_REF_NO,
                  S_REF_NO,
                  O_TARIH,
                  S_TARIH,
                  O_VEREN_VEZNE_ID,
                  S_VEREN_VEZNE_ID,
                  SATIR_NO,
                  O_PARA_ID,
                  S_PARA_ID,
                  O_MIKTAR,
                  S_MIKTAR)
                SELECT @ZAMAN,
                  @KULLANICI_ID,
                  CASE WHEN V.SATIR_NO IS NULL THEN 0 ELSE 1 END,
                  @VEZNE_TRANSFERI_ID,
                  @ALAN_VEZNE_ID,
                  V.REF_NO,
                  @REF_NO,
                  V.TARIH,
                  @TARIH,
                  V.VEREN_VEZNE_ID,
                  @VEREN_VEZNE_ID,
                  ISNULL(V.SATIR_NO, I.SATIR_NO),
                  V.PARA_ID,
                  I.PARA_ID,
                  V.MIKTAR,
                  I.MIKTAR
                FROM (SELECT F.REF_NO, F.TARIH, F.VEREN_VEZNE_ID, S.SATIR_NO, S.PARA_ID, S.MIKTAR
                    FROM TODVZ_VEZNE_TRANSFERI_SATIRI S
                      INNER JOIN TODVZ_VEZNE_TRANSFERI F ON F.VEZNE_TRANSFERI_ID = S.VEZNE_TRANSFERI_ID
                    WHERE F.VEZNE_TRANSFERI_ID = @VEZNE_TRANSFERI_ID
                  ) AS V
                  FULL OUTER JOIN #TODVZ_ISKELE_VEZNE_TRANSFERI_SATIRI I ON V.SATIR_NO = I.SATIR_NO
                WHERE ISNULL(V.PARA_ID,0) <> ISNULL(I.PARA_ID,0) OR
                  ISNULL(V.MIKTAR,0.0) <> ISNULL(I.MIKTAR, 0.0)
                SELECT @DEGISEN_SATIR_SAYISI = @@ROWCOUNT
                IF @DEGISEN_SATIR_SAYISI = 0
                  INSERT INTO TODVZ_LOG_TRANSFER(
                    ZAMAN,
                    KULLANICI_ID,
                    ISLEM,
                    VEZNE_TRANSFERI_ID,
                    ALAN_VEZNE_ID,
                    O_REF_NO,
                    S_REF_NO,
                    O_TARIH,
                    S_TARIH,
                    O_VEREN_VEZNE_ID,
                    S_VEREN_VEZNE_ID)
                  SELECT @ZAMAN,
                    @KULLANICI_ID,
                    1,
                    @VEZNE_TRANSFERI_ID,
                    @ALAN_VEZNE_ID,
                    V.REF_NO,
                    @REF_NO,
                    V.TARIH,
                    @TARIH,
                    V.VEREN_VEZNE_ID,
                    @VEREN_VEZNE_ID
                  FROM TODVZ_VEZNE_TRANSFERI V
                  WHERE V.VEZNE_TRANSFERI_ID = @VEZNE_TRANSFERI_ID AND
                    (ISNULL(V.REF_NO,'') <> ISNULL(@REF_NO,'') OR
                    V.TARIH <> @TARIH OR
                    V.VEREN_VEZNE_ID <> @VEREN_VEZNE_ID)
              END
              DELETE FROM TODVZ_VEZNE_TRANSFERI_SATIRI WHERE VEZNE_TRANSFERI_ID = @VEZNE_TRANSFERI_ID
              UPDATE TODVZ_VEZNE_TRANSFERI
                SET
                  TARIH = @TARIH,
                  REF_NO = @REF_NO,
                  ALAN_VEZNE_ID = @ALAN_VEZNE_ID,
                  VEREN_VEZNE_ID = @VEREN_VEZNE_ID,
                  ACIKLAMA = @ACIKLAMA,
                  GUNCELLEYEN_ID = @KULLANICI_ID,
                  GUNCELLEME_ZAMANI = @ZAMAN
                WHERE VEZNE_TRANSFERI_ID = @VEZNE_TRANSFERI_ID
              IF @@ERROR<>0 GOTO UNDO
            END
            INSERT INTO TODVZ_VEZNE_TRANSFERI_SATIRI(VEZNE_TRANSFERI_ID, SATIR_NO, PARA_ID, MIKTAR)
              SELECT @VEZNE_TRANSFERI_ID, SATIR_NO, PARA_ID, MIKTAR FROM #TODVZ_ISKELE_VEZNE_TRANSFERI_SATIRI
            DECLARE C_EKLENEN CURSOR LOCAL FOR
              SELECT PARA_ID, MIKTAR FROM #TODVZ_ISKELE_VEZNE_TRANSFERI_SATIRI
            OPEN C_EKLENEN
            FETCH NEXT FROM C_EKLENEN INTO @PARA_ID, @MIKTAR
            WHILE @@FETCH_STATUS = 0
            BEGIN
              UPDATE TODVZ_VEZNE_BAKIYE SET MIKTAR = MIKTAR + @MIKTAR WHERE VEZNE_ID = @ALAN_VEZNE_ID AND PARA_ID = @PARA_ID
              IF @@ROWCOUNT = 0
                INSERT INTO TODVZ_VEZNE_BAKIYE(VEZNE_ID, PARA_ID, MIKTAR) VALUES(@ALAN_VEZNE_ID, @PARA_ID, @MIKTAR)
              UPDATE TODVZ_VEZNE_BAKIYE SET MIKTAR = MIKTAR - @MIKTAR WHERE VEZNE_ID = @VEREN_VEZNE_ID AND PARA_ID = @PARA_ID
              IF @@ROWCOUNT = 0
                INSERT INTO TODVZ_VEZNE_BAKIYE(VEZNE_ID, PARA_ID, MIKTAR) VALUES(@VEREN_VEZNE_ID, @PARA_ID, -@MIKTAR)
              FETCH NEXT FROM C_EKLENEN INTO @PARA_ID, @MIKTAR
            END
            CLOSE C_EKLENEN
            DEALLOCATE C_EKLENEN
            DELETE FROM #TODVZ_ISKELE_VEZNE_TRANSFERI_SATIRI
            RETURN 0
          UNDO:
            DELETE FROM #TODVZ_ISKELE_VEZNE_TRANSFERI_SATIRI
            IF @HATA_MESAJI IS NULL SET @HATA_MESAJI = 'Vezne transferi kaydedilemedi'
            RAISERROR (@HATA_MESAJI,16,1)
            RETURN 1
          END
        `);
      }
    } catch (e) {
      logger.warn("[VezneTransferi] Procedure check/create warning:", e);
    }
  }

  /**
   * Saves a vezne transfer using the Stored Procedure SODVZ_VEZNE_TRANSFERI_KAYDET.
   */
  public static async saveViaProcedure(
    dto: SaveVezneTransferiDto,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<VezneTransferiModel> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await VezneTransferiSqlRepository.ensureProcedures(pool);

    if (!dto.alanVezneId || dto.alanVezneId <= 0) {
      throw ApiError.badRequest("Lütfen transferi alacak vezneyi seçiniz.");
    }
    if (!dto.verenVezneId || dto.verenVezneId <= 0) {
      throw ApiError.badRequest("Lütfen transferi verecek vezneyi seçiniz.");
    }
    if (dto.alanVezneId === dto.verenVezneId) {
      throw ApiError.badRequest("Alan vezne ile veren vezne aynı olamaz. Lütfen farklı vezneler seçiniz.");
    }

    const validLines = (dto.satirlar || []).filter((s) => s.paraId > 0 && Number(s.miktar) > 0);
    if (validLines.length === 0) {
      throw ApiError.badRequest("Transfer kaydı için en az bir geçerli para birimi ve miktar girilmelidir.");
    }

    const targetId = dto.id && Number(dto.id) > 0 ? Number(dto.id) : null;
    const refNo = dto.refNo && dto.refNo.trim() ? dto.refNo.trim().slice(0, 20) : null;
    const aciklama = dto.aciklama ? dto.aciklama.trim().slice(0, 250) : "";
    const kullaniciId = Number(dto.kullaniciId) || 1;
    const degisiklikTakipVar = dto.degisiklikTakipVar ? 1 : 0;

    // Build row values insert SQL into temp table #TODVZ_ISKELE_VEZNE_TRANSFERI_SATIRI
    const rowValues = validLines.map((row, idx) => {
      const satirNo = idx; // 0-based
      const paraId = Number(row.paraId);
      const miktar = Number(row.miktar) || 0;
      return `(${satirNo}, ${paraId}, ${miktar})`;
    });

    const batchQuery = `
      SET NOCOUNT ON;

      IF OBJECT_ID('tempdb..#TODVZ_ISKELE_VEZNE_TRANSFERI_SATIRI') IS NOT NULL
        DROP TABLE #TODVZ_ISKELE_VEZNE_TRANSFERI_SATIRI;

      CREATE TABLE #TODVZ_ISKELE_VEZNE_TRANSFERI_SATIRI (
        [SATIR_NO] INT NOT NULL,
        [PARA_ID] INT NOT NULL,
        [MIKTAR] DECIMAL(18, 4) NOT NULL
      );

      INSERT INTO #TODVZ_ISKELE_VEZNE_TRANSFERI_SATIRI ([SATIR_NO], [PARA_ID], [MIKTAR])
      VALUES ${rowValues.join(",\n")};

      DECLARE @OUT_ID INT = @TARGET_ID;
      DECLARE @OUT_REF VARCHAR(20) = @TARGET_REF;

      EXEC [dbo].[SODVZ_VEZNE_TRANSFERI_KAYDET]
        @VEZNE_TRANSFERI_ID = @OUT_ID OUTPUT,
        @TARIH = @TARIH,
        @REF_NO = @OUT_REF OUTPUT,
        @ALAN_VEZNE_ID = @ALAN_VEZNE_ID,
        @VEREN_VEZNE_ID = @VEREN_VEZNE_ID,
        @ACIKLAMA = @ACIKLAMA,
        @KULLANICI_ID = @KULLANICI_ID,
        @DEGISIKLIK_TAKIP_VAR = @DEGISIKLIK_TAKIP_VAR;

      SELECT @OUT_ID AS RESULT_ID, @OUT_REF AS RESULT_REF;
    `;

    try {
      const request = pool.request();
      request.input("TARGET_ID", sql.Int, targetId);
      request.input("TARGET_REF", sql.VarChar(20), refNo);
      request.input("TARIH", sql.DateTime, new Date(dto.tarih));
      request.input("ALAN_VEZNE_ID", sql.Int, dto.alanVezneId);
      request.input("VEREN_VEZNE_ID", sql.Int, dto.verenVezneId);
      request.input("ACIKLAMA", sql.VarChar(250), aciklama);
      request.input("KULLANICI_ID", sql.Int, kullaniciId);
      request.input("DEGISIKLIK_TAKIP_VAR", sql.Bit, degisiklikTakipVar);

      const result = await request.query(batchQuery);
      const savedRecord = result.recordset?.[0];
      const newId = savedRecord?.RESULT_ID || targetId;

      if (!newId) {
        throw ApiError.internal("Vezne transferi kaydedildi fakat kayıt ID bilgisi alınamadı.");
      }

      const fullTransfer = await VezneTransferiSqlRepository.findById(newId, dbContext);
      if (!fullTransfer) {
        throw ApiError.internal("Kayıt oluşturuldu fakat detayları getirilemedi.");
      }
      return fullTransfer;
    } catch (err: any) {
      logger.error("VezneTransferiSqlRepository.saveViaProcedure error:", err);
      throw ApiError.badRequest(err.message || "Vezne transferi kaydedilemedi.");
    }
  }

  /**
   * Deletes a vezne transfer using the Stored Procedure SODVZ_VEZNE_TRANSFERI_SIL.
   */
  public static async deleteViaProcedure(
    id: number,
    kullaniciId: number = 1,
    degisiklikTakipVar: boolean = false,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<boolean> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await VezneTransferiSqlRepository.ensureProcedures(pool);

    try {
      const request = pool.request();
      request.input("VEZNE_TRANSFERI_ID", sql.Int, id);
      request.input("KULLANICI_ID", sql.Int, kullaniciId);
      request.input("DEGISIKLIK_TAKIP_VAR", sql.Bit, degisiklikTakipVar ? 1 : 0);

      await request.execute("SODVZ_VEZNE_TRANSFERI_SIL");
      return true;
    } catch (err: any) {
      logger.error(`VezneTransferiSqlRepository.deleteViaProcedure(${id}) error:`, err);
      throw ApiError.badRequest(err.message || "Vezne transferi silinemedi.");
    }
  }

  /**
   * Finds a transfer by ID with all header details and line items.
   */
  public static async findById(
    id: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<VezneTransferiModel | null> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);

    try {
      const headerReq = pool.request();
      headerReq.input("id", sql.Int, id);
      const headerRes = await headerReq.query(`
        SELECT 
          t.VEZNE_TRANSFERI_ID AS id,
          CONVERT(VARCHAR(10), t.TARIH, 120) AS tarih,
          t.REF_NO AS refNo,
          t.ALAN_VEZNE_ID AS alanVezneId,
          va.KOD AS alanVezneKod,
          va.AD AS alanVezneAd,
          t.VEREN_VEZNE_ID AS verenVezneId,
          vv.KOD AS verenVezneKod,
          vv.AD AS verenVezneAd,
          ISNULL(t.ACIKLAMA, '') AS aciklama,
          t.EKLEYEN_ID AS ekleyenId,
          CONVERT(VARCHAR(19), t.EKLEME_ZAMANI, 120) AS eklemeZamani,
          t.GUNCELLEYEN_ID AS guncelleyenId,
          CONVERT(VARCHAR(19), t.GUNCELLEME_ZAMANI, 120) AS guncellemeZamani
        FROM [dbo].[TODVZ_VEZNE_TRANSFERI] t WITH (NOLOCK)
        LEFT JOIN [dbo].[TODVZ_VEZNE] va WITH (NOLOCK) ON t.ALAN_VEZNE_ID = va.VEZNE_ID
        LEFT JOIN [dbo].[TODVZ_VEZNE] vv WITH (NOLOCK) ON t.VEREN_VEZNE_ID = vv.VEZNE_ID
        WHERE t.VEZNE_TRANSFERI_ID = @id
      `);

      if (!headerRes.recordset || headerRes.recordset.length === 0) {
        return null;
      }
      const header = headerRes.recordset[0];

      const linesReq = pool.request();
      linesReq.input("id", sql.Int, id);
      const linesRes = await linesReq.query(`
        SELECT 
          s.SATIR_NO AS satirNo,
          s.PARA_ID AS paraId,
          p.KOD AS paraKodu,
          p.AD AS paraAdi,
          s.MIKTAR AS miktar
        FROM [dbo].[TODVZ_VEZNE_TRANSFERI_SATIRI] s WITH (NOLOCK)
        LEFT JOIN [dbo].[TODVZ_PARA] p WITH (NOLOCK) ON s.PARA_ID = p.PARA_ID
        WHERE s.VEZNE_TRANSFERI_ID = @id
        ORDER BY s.SATIR_NO ASC
      `);

      return {
        id: header.id,
        tarih: header.tarih,
        refNo: (header.refNo || "").trim(),
        alanVezneId: header.alanVezneId,
        alanVezneKod: (header.alanVezneKod || "").trim(),
        alanVezneAd: (header.alanVezneAd || "").trim(),
        verenVezneId: header.verenVezneId,
        verenVezneKod: (header.verenVezneKod || "").trim(),
        verenVezneAd: (header.verenVezneAd || "").trim(),
        aciklama: (header.aciklama || "").trim(),
        ekleyenId: header.ekleyenId,
        eklemeZamani: header.eklemeZamani,
        guncelleyenId: header.guncelleyenId,
        guncellemeZamani: header.guncellemeZamani,
        satirlar: (linesRes.recordset || []).map((r: any) => ({
          satirNo: r.satirNo,
          paraId: r.paraId,
          paraKodu: (r.paraKodu || "").trim(),
          paraAdi: (r.paraAdi || "").trim(),
          miktar: Number(r.miktar) || 0,
        })),
      };
    } catch (err: any) {
      logger.error(`VezneTransferiSqlRepository.findById(${id}) error:`, err);
      throw err;
    }
  }

  /**
   * Lists transfers matching search filters.
   */
  public static async findAll(
    filters: {
      search?: string;
      alanVezneId?: number;
      verenVezneId?: number;
      startDate?: string;
      endDate?: string;
      limit?: number;
    },
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<VezneTransferiListItem[]> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);

    try {
      const request = pool.request();
      let query = `
        SELECT TOP (@limit)
          t.VEZNE_TRANSFERI_ID AS id,
          CONVERT(VARCHAR(10), t.TARIH, 120) AS tarih,
          t.REF_NO AS refNo,
          t.ALAN_VEZNE_ID AS alanVezneId,
          va.KOD AS alanVezneKod,
          va.AD AS alanVezneAd,
          t.VEREN_VEZNE_ID AS verenVezneId,
          vv.KOD AS verenVezneKod,
          vv.AD AS verenVezneAd,
          ISNULL(t.ACIKLAMA, '') AS aciklama,
          CONVERT(VARCHAR(19), t.EKLEME_ZAMANI, 120) AS eklemeZamani,
          (SELECT COUNT(*) FROM [dbo].[TODVZ_VEZNE_TRANSFERI_SATIRI] s WHERE s.VEZNE_TRANSFERI_ID = t.VEZNE_TRANSFERI_ID) AS satirSayisi,
          (SELECT ISNULL(SUM(s.MIKTAR), 0) FROM [dbo].[TODVZ_VEZNE_TRANSFERI_SATIRI] s WHERE s.VEZNE_TRANSFERI_ID = t.VEZNE_TRANSFERI_ID) AS toplamMiktar
        FROM [dbo].[TODVZ_VEZNE_TRANSFERI] t WITH (NOLOCK)
        LEFT JOIN [dbo].[TODVZ_VEZNE] va WITH (NOLOCK) ON t.ALAN_VEZNE_ID = va.VEZNE_ID
        LEFT JOIN [dbo].[TODVZ_VEZNE] vv WITH (NOLOCK) ON t.VEREN_VEZNE_ID = vv.VEZNE_ID
        WHERE 1=1
      `;

      request.input("limit", sql.Int, filters.limit || 200);

      if (filters.alanVezneId) {
        request.input("alanVezneId", sql.Int, filters.alanVezneId);
        query += " AND t.ALAN_VEZNE_ID = @alanVezneId";
      }

      if (filters.verenVezneId) {
        request.input("verenVezneId", sql.Int, filters.verenVezneId);
        query += " AND t.VEREN_VEZNE_ID = @verenVezneId";
      }

      if (filters.startDate) {
        request.input("startDate", sql.DateTime, new Date(filters.startDate));
        query += " AND t.TARIH >= @startDate";
      }

      if (filters.endDate) {
        request.input("endDate", sql.DateTime, new Date(filters.endDate));
        query += " AND t.TARIH <= @endDate";
      }

      if (filters.search && filters.search.trim()) {
        request.input("search", sql.VarChar(100), `%${filters.search.trim()}%`);
        query += " AND (t.REF_NO LIKE @search OR t.ACIKLAMA LIKE @search OR va.AD LIKE @search OR vv.AD LIKE @search)";
      }

      query += " ORDER BY t.VEZNE_TRANSFERI_ID DESC";

      const res = await request.query(query);
      return (res.recordset || []).map((r: any) => ({
        id: r.id,
        tarih: r.tarih,
        refNo: (r.refNo || "").trim(),
        alanVezneId: r.alanVezneId,
        alanVezneKod: (r.alanVezneKod || "").trim(),
        alanVezneAd: (r.alanVezneAd || "").trim(),
        verenVezneId: r.verenVezneId,
        verenVezneKod: (r.verenVezneKod || "").trim(),
        verenVezneAd: (r.verenVezneAd || "").trim(),
        aciklama: (r.aciklama || "").trim(),
        satirSayisi: Number(r.satirSayisi) || 0,
        toplamMiktar: Number(r.toplamMiktar) || 0,
        paraBirimleri: "",
        eklemeZamani: r.eklemeZamani,
      }));
    } catch (err: any) {
      logger.error("VezneTransferiSqlRepository.findAll error:", err);
      throw err;
    }
  }

  /**
   * Navigation helper: returns first, prev, next, last IDs relative to current ID.
   */
  public static async getNavigation(
    currentId?: number | null,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<{ firstId: number | null; prevId: number | null; nextId: number | null; lastId: number | null }> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);

    try {
      const cur = Number(currentId) || 0;
      const req = pool.request();
      req.input("curId", sql.Int, cur);

      const navRes = await req.query(`
        SELECT
          (SELECT MIN(VEZNE_TRANSFERI_ID) FROM [dbo].[TODVZ_VEZNE_TRANSFERI]) AS firstId,
          (SELECT MAX(VEZNE_TRANSFERI_ID) FROM [dbo].[TODVZ_VEZNE_TRANSFERI] WHERE VEZNE_TRANSFERI_ID < @curId) AS prevId,
          (SELECT MIN(VEZNE_TRANSFERI_ID) FROM [dbo].[TODVZ_VEZNE_TRANSFERI] WHERE VEZNE_TRANSFERI_ID > @curId) AS nextId,
          (SELECT MAX(VEZNE_TRANSFERI_ID) FROM [dbo].[TODVZ_VEZNE_TRANSFERI]) AS lastId
      `);

      const r = navRes.recordset?.[0] || {};
      return {
        firstId: r.firstId || null,
        prevId: r.prevId || null,
        nextId: r.nextId || null,
        lastId: r.lastId || null,
      };
    } catch (err: any) {
      logger.error("VezneTransferiSqlRepository.getNavigation error:", err);
      return { firstId: null, prevId: null, nextId: null, lastId: null };
    }
  }

  /**
   * Retrieves next numerator for Vezne Transferi (TUR = 10).
   */
  public static async getNextRefNo(
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<string> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);

    try {
      const procCheck = await pool.request().query(`
        SELECT 1 FROM sys.procedures WHERE name = 'SODVZ_NUMERATOR_URET'
      `);

      if ((procCheck.recordset?.length || 0) > 0) {
        const req = pool.request();
        req.output("REF_NO", sql.VarChar(20));
        const res = await req.query(`
          DECLARE @REF VARCHAR(20);
          EXEC [dbo].[SODVZ_NUMERATOR_URET] 10, @REF OUT, NULL, 0, NULL, NULL;
          SELECT @REF AS NEXT_REF;
        `);
        const nextRef = res.recordset?.[0]?.NEXT_REF;
        if (nextRef && String(nextRef).trim()) {
          return String(nextRef).trim();
        }
      }

      // Fallback: look in TODVZ_NUMERATOR where TUR = 10
      const numRes = await pool.request().query(`
        SELECT TOP 1 ONEK, BASLANGIC, UZUNLUK, ONUNE_SIFIR_KOY 
        FROM [dbo].[TODVZ_NUMERATOR] 
        WHERE TUR = 10
      `);

      if (numRes.recordset?.length) {
        const row = numRes.recordset[0];
        const onek = (row.ONEK || "").trim();
        const baslangic = Number(row.BASLANGIC) || 1;
        const uzunluk = Number(row.UZUNLUK) || 10;
        const onuneSifirKoy = row.ONUNE_SIFIR_KOY !== false;
        const numStr = String(baslangic);
        if (!onuneSifirKoy || uzunluk <= onek.length) {
          return `${onek}${numStr}`;
        }
        const rem = Math.max(1, uzunluk - onek.length);
        return `${onek}${numStr.padStart(rem, "0")}`;
      }

      return "";
    } catch (err) {
      logger.warn("VezneTransferiSqlRepository.getNextRefNo warning:", err);
      return "";
    }
  }

  /**
   * Fetches the current balances of a specific cash desk (Vezne) for "F5) Toplu Transfer".
   */
  public static async getVezneBakiyeler(
    vezneId: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<{ paraId: number; paraKodu: string; paraAdi: string; miktar: number }[]> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);

    try {
      const req = pool.request();
      req.input("vezneId", sql.Int, vezneId);
      const res = await req.query(`
        SELECT 
          b.PARA_ID AS paraId,
          p.KOD AS paraKodu,
          p.AD AS paraAdi,
          b.MIKTAR AS miktar
        FROM [dbo].[TODVZ_VEZNE_BAKIYE] b WITH (NOLOCK)
        INNER JOIN [dbo].[TODVZ_PARA] p WITH (NOLOCK) ON b.PARA_ID = p.PARA_ID
        WHERE b.VEZNE_ID = @vezneId AND b.MIKTAR > 0
        ORDER BY p.SIRA_NO ASC, p.KOD ASC
      `);

      return (res.recordset || []).map((r: any) => ({
        paraId: r.paraId,
        paraKodu: (r.paraKodu || "").trim(),
        paraAdi: (r.paraAdi || "").trim(),
        miktar: Number(r.miktar) || 0,
      }));
    } catch (err) {
      logger.warn(`VezneTransferiSqlRepository.getVezneBakiyeler(${vezneId}) error:`, err);
      return [];
    }
  }
}
