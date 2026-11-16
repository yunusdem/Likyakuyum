import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";
import { ParaSqlRepository } from "./paraSql.repository.js";

export interface BanknotItem {
  paraId: number;
  banknotId: number;
  miktar: number;
}

export interface BanknotCurrencyItem {
  id: number;
  kod: string;
  ad: string;
  siraNo: number;
  banknotSayisi: number;
}

export interface SaveBanknotDto {
  banknotId: number;
  miktar: number;
}

export class BanknotSqlRepository {
  /**
   * Ensures TODVZ_BANKNOT table exists in the database
   */
  public static async ensureTableExists(pool: sql.ConnectionPool): Promise<void> {
    const script = `
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TODVZ_BANKNOT')
      BEGIN
        CREATE TABLE [dbo].[TODVZ_BANKNOT] (
          [PARA_ID] INT NOT NULL,
          [BANKNOT_ID] INT NOT NULL,
          [MIKTAR] FLOAT NOT NULL DEFAULT 0,
          CONSTRAINT [PK_TODVZ_BANKNOT] PRIMARY KEY CLUSTERED ([PARA_ID] ASC, [BANKNOT_ID] ASC)
        );
      END
    `;
    try {
      await pool.request().batch(script);
    } catch (err) {
      logger.warn("BanknotSqlRepository.ensureTableExists warning:", err);
    }
  }

  /**
   * Eski masaüstü şemasında TODVZ_BANKNOT üzerinde merkeze (K2016_dvz) yazan
   * TIODVZ/TUODVZ/TDODVZ_BANKNOT tetikleyicileri var. Merkezde tablo yoksa ya da
   * BANKNOT_ID başka firmanınkiyle çakışıyorsa tetikleyici hata verir ve SQL Server
   * tüm işlemi (transaction) geri alır. PARA/VEZNE/YAZICI tetikleyicileri gibi
   * bunlar da kalıcı olarak pasife alınır (bkz. mssql.config.ts havuz açılışı).
   */
  public static async disableSyncTriggers(pool: sql.ConnectionPool): Promise<void> {
    try {
      await pool.request().batch(`
        IF EXISTS (SELECT 1 FROM sys.triggers WHERE name = 'TIODVZ_BANKNOT' AND parent_id = OBJECT_ID('dbo.TODVZ_BANKNOT') AND is_disabled = 0)
          DISABLE TRIGGER [TIODVZ_BANKNOT] ON [dbo].[TODVZ_BANKNOT];
        IF EXISTS (SELECT 1 FROM sys.triggers WHERE name = 'TUODVZ_BANKNOT' AND parent_id = OBJECT_ID('dbo.TODVZ_BANKNOT') AND is_disabled = 0)
          DISABLE TRIGGER [TUODVZ_BANKNOT] ON [dbo].[TODVZ_BANKNOT];
        IF EXISTS (SELECT 1 FROM sys.triggers WHERE name = 'TDODVZ_BANKNOT' AND parent_id = OBJECT_ID('dbo.TODVZ_BANKNOT') AND is_disabled = 0)
          DISABLE TRIGGER [TDODVZ_BANKNOT] ON [dbo].[TODVZ_BANKNOT];
      `);
    } catch (err) {
      logger.warn("BanknotSqlRepository.disableSyncTriggers warning:", err);
    }
  }

  /** Transaction sunucuda zaten geri alınmışsa rollback() ikinci bir hata atar; asıl hatayı gizlememesi için yutulur. */
  private static async safeRollback(transaction: sql.Transaction): Promise<void> {
    try {
      await transaction.rollback();
    } catch (rbErr) {
      logger.warn("BanknotSqlRepository rollback warning:", rbErr);
    }
  }

  /** Eski masaüstünün son para sayımı (TODVZ_SAYILAN_PARA) BANKNOT_ID'ye bağlı; silinen kupürün sayım satırı da silinir. */
  private static readonly SAYILAN_PARA_SIL = `
    IF OBJECT_ID('dbo.TODVZ_SAYILAN_PARA', 'U') IS NOT NULL
      DELETE SP FROM [dbo].[TODVZ_SAYILAN_PARA] SP
       INNER JOIN [dbo].[TODVZ_BANKNOT] B ON B.[BANKNOT_ID] = SP.[BANKNOT_ID]
       WHERE B.[PARA_ID] = @paraId`;

  /**
   * Default banknot denominations for common currencies if none are configured yet
   */
  private static getDefaultDenominations(code: string): number[] {
    const clean = code.trim().toUpperCase();
    if (["TL", "TRY", "TRL", "YTL", "TURK LIRASI", "TÜRK LİRASI"].includes(clean)) {
      return [200, 100, 50, 20, 10, 5, 1];
    }
    if (["USD", "DOLAR"].includes(clean)) {
      return [100, 50, 20, 10, 5, 2, 1];
    }
    if (["EUR", "EURO"].includes(clean)) {
      return [500, 200, 100, 50, 20, 10, 5];
    }
    if (["GBP", "STERLIN"].includes(clean)) {
      return [50, 20, 10, 5];
    }
    if (["CHF"].includes(clean)) {
      return [1000, 200, 100, 50, 20, 10];
    }
    if (["CAD", "AUD"].includes(clean)) {
      return [100, 50, 20, 10, 5];
    }
    if (["SAR"].includes(clean)) {
      return [500, 100, 50, 20, 10, 5, 1];
    }
    return [100, 50, 20, 10, 5, 1];
  }

  /**
   * Retrieves all currencies with their current banknot count
   */
  public static async getCurrencies(dbContext?: { dbServer?: string; dbName?: string }): Promise<BanknotCurrencyItem[]> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureTableExists(pool);

    const query = `
      SELECT 
        P.[PARA_ID] as id,
        LTRIM(RTRIM(ISNULL(P.[KOD], ''))) as kod,
        LTRIM(RTRIM(ISNULL(P.[AD], ''))) as ad,
        ISNULL(P.[SIRA_NO], 999) as siraNo,
        COUNT(B.[BANKNOT_ID]) as banknotSayisi
      FROM [dbo].[TODVZ_PARA] P
      LEFT JOIN [dbo].[TODVZ_BANKNOT] B ON P.[PARA_ID] = B.[PARA_ID]
      GROUP BY P.[PARA_ID], P.[KOD], P.[AD], P.[SIRA_NO]
      ORDER BY P.[PARA_ID] ASC
    `;

    const res = await pool.request().query<BanknotCurrencyItem>(query);
    return res.recordset.map((r) => ({
      id: r.id,
      kod: r.kod || "",
      ad: r.ad || r.kod || "",
      siraNo: r.siraNo,
      banknotSayisi: Number(r.banknotSayisi) || 0,
    }));
  }

  /**
   * Adds or finds a currency in TODVZ_PARA
   */
  public static async createCurrency(
    kod: string,
    ad: string,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<BanknotCurrencyItem> {
    const cleanKod = (kod || "").trim().toUpperCase().slice(0, 5);
    const cleanAd = (ad || "").trim().slice(0, 200);

    if (!cleanKod || !cleanAd) {
      throw ApiError.badRequest("Para kodu ve adı gereklidir.");
    }

    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);

    // 1. Check if currency already exists in TODVZ_PARA
    const existing = await pool
      .request()
      .input("kod", sql.VarChar(5), cleanKod)
      .query<{ id: number; kod: string; ad: string; siraNo: number }>(`
        SELECT TOP 1 [PARA_ID] as id, [KOD] as kod, [AD] as ad, ISNULL([SIRA_NO], 999) as siraNo
        FROM [dbo].[TODVZ_PARA]
        WHERE UPPER(LTRIM(RTRIM([KOD]))) = @kod
      `);

    if (existing.recordset.length > 0) {
      const existingId = existing.recordset[0].id;
      // If the currency already exists with this code, update its name so it reflects the user's input instead of an old name
      if (existing.recordset[0].ad !== cleanAd) {
        await pool
          .request()
          .input("id", sql.Int, existingId)
          .input("ad", sql.VarChar(200), cleanAd)
          .query("UPDATE [dbo].[TODVZ_PARA] SET [AD] = @ad WHERE [PARA_ID] = @id");
      }

      return {
        id: existingId,
        kod: existing.recordset[0].kod,
        ad: cleanAd,
        siraNo: existing.recordset[0].siraNo ?? 999,
        banknotSayisi: 0,
      };
    }

    // 2. Get next sira no
    const siraRes = await pool.request().query<{ nextSira: number }>(`
      SELECT ISNULL(MAX([SIRA_NO]), 0) + 1 AS nextSira FROM [dbo].[TODVZ_PARA]
    `);
    const nextSira = siraRes.recordset[0]?.nextSira || 1;

    // 3. Create using official ParaSqlRepository to guarantee compliance with all SQL Server constraints (CKODVZ_PARA, etc.)
    const created = await ParaSqlRepository.create(
      {
        kod: cleanKod,
        ad: cleanAd,
        urunTipi: 0,
        pariteIslemi: 0,
        siraNo: nextSira,
        dovizAlisHucreOrani: 1,
        dovizSatisHucreOrani: 1,
        efektifAlisHucreOrani: 1,
        efektifSatisHucreOrani: 1,
      },
      dbContext
    );

    return {
      id: created.id,
      kod: created.kod,
      ad: created.ad,
      siraNo: created.siraNo,
      banknotSayisi: 0,
    };
  }

  /**
   * Retrieves all banknotes for a specific currency (PARA_ID)
   */
  public static async getBanknotlarByParaId(
    paraId: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<BanknotItem[]> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureTableExists(pool);

    const query = `
      SELECT 
        [PARA_ID] as paraId,
        [BANKNOT_ID] as banknotId,
        [MIKTAR] as miktar
      FROM [dbo].[TODVZ_BANKNOT]
      WHERE [PARA_ID] = @paraId
      ORDER BY [MIKTAR] DESC, [BANKNOT_ID] ASC
    `;

    const res = await pool.request().input("paraId", sql.Int, paraId).query<BanknotItem>(query);

    // If records exist in DB, return them
    if (res.recordset.length > 0) {
      return res.recordset.map((r) => ({
        paraId: r.paraId,
        banknotId: r.banknotId,
        miktar: Number(r.miktar) || 0,
      }));
    }

    // If no banknot records exist yet, generate default suggestions based on currency code
    const paraRes = await pool
      .request()
      .input("paraId", sql.Int, paraId)
      .query<{ KOD: string; AD: string }>("SELECT [KOD], [AD] FROM [dbo].[TODVZ_PARA] WHERE [PARA_ID] = @paraId");

    const currencyCode = paraRes.recordset[0]?.KOD || "";
    const defaults = this.getDefaultDenominations(currencyCode);

    return defaults.map((amount, idx) => ({
      paraId,
      banknotId: idx + 1,
      miktar: amount,
    }));
  }

  /**
   * Atomically saves or updates all banknotes for a specific currency (PARA_ID)
   */
  public static async saveBanknotlar(
    paraId: number,
    banknotlar: SaveBanknotDto[],
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<BanknotItem[]> {
    if (!paraId || paraId <= 0) {
      throw ApiError.badRequest("Geçerli bir Para Birimi (PARA_ID) seçilmelidir.");
    }

    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureTableExists(pool);

    // Sanitize and filter out zero/negative values, sort descending by denomination
    const desired = (banknotlar || [])
      .filter((b) => b && Number(b.miktar) > 0)
      .map((b) => Number(b.miktar) || 0)
      .sort((a, b) => b - a);

    await this.disableSyncTriggers(pool);

    // Detect if BANKNOT_ID is an identity column in TODVZ_BANKNOT
    let isIdentity = false;
    try {
      const colCheck = await pool.request().query<{ is_identity: boolean }>(`
        SELECT is_identity 
        FROM sys.columns 
        WHERE object_id = OBJECT_ID('[dbo].[TODVZ_BANKNOT]') AND name = 'BANKNOT_ID'
      `);
      if (colCheck.recordset.length > 0) {
        isIdentity = Boolean(colCheck.recordset[0].is_identity);
      }
    } catch (e) {
      logger.warn("Could not check is_identity on TODVZ_BANKNOT:", e);
    }

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // 1. Mevcut kupürler: tutarı aynı kalanlar BANKNOT_ID'lerini korur (eski sayım kayıtları bağlı kalır),
      //    listeden çıkanlar silinir, yeni tutarlar eklenir. Hepsini silip yeniden yazmak
      //    TODVZ_SAYILAN_PARA yabancı anahtarına takılıyordu.
      const existingRes = await new sql.Request(transaction)
        .input("paraId", sql.Int, paraId)
        .query<{ banknotId: number; miktar: number }>(`
          SELECT [BANKNOT_ID] AS banknotId, [MIKTAR] AS miktar
          FROM [dbo].[TODVZ_BANKNOT] WITH (UPDLOCK, HOLDLOCK)
          WHERE [PARA_ID] = @paraId
          ORDER BY [BANKNOT_ID] ASC
        `);
      const unused = existingRes.recordset.map((r) => ({ banknotId: r.banknotId, miktar: Number(r.miktar) || 0 }));

      const result: BanknotItem[] = [];
      const toInsert: BanknotItem[] = [];
      for (const miktar of desired) {
        const idx = unused.findIndex((u) => Math.abs(u.miktar - miktar) < 0.000001);
        if (idx >= 0) {
          result.push({ paraId, banknotId: unused[idx].banknotId, miktar });
          unused.splice(idx, 1);
        } else {
          const item = { paraId, banknotId: 0, miktar };
          result.push(item);
          toInsert.push(item);
        }
      }

      // 2. Listeden çıkarılan kupürleri (ve onlara bağlı eski sayım satırlarını) sil
      for (const removed of unused) {
        await new sql.Request(transaction)
          .input("banknotId", sql.Int, removed.banknotId)
          .query(`
            IF OBJECT_ID('dbo.TODVZ_SAYILAN_PARA', 'U') IS NOT NULL
              DELETE FROM [dbo].[TODVZ_SAYILAN_PARA] WHERE [BANKNOT_ID] = @banknotId;
            DELETE FROM [dbo].[TODVZ_BANKNOT] WHERE [BANKNOT_ID] = @banknotId AND [PARA_ID] = ${Number(paraId)};
          `);
      }

      // 3. Yeni kupürleri ekle (IDENTITY ise numarayı SQL verir, değilse en büyük numara + 1)
      for (const item of toInsert) {
        const insertReq = new sql.Request(transaction);
        insertReq.input("paraId", sql.Int, paraId);
        insertReq.input("miktar", sql.Float, item.miktar);

        if (isIdentity) {
          // OUTPUT INSERTED... tabloda açık tetikleyici varken SQL hatası verir; SCOPE_IDENTITY tetikleyiciden etkilenmez.
          const inserted = await insertReq.query<{ banknotId: number }>(`
            INSERT INTO [dbo].[TODVZ_BANKNOT] ([PARA_ID], [MIKTAR])
            VALUES (@paraId, @miktar);
            SELECT CAST(SCOPE_IDENTITY() AS INT) AS banknotId;
          `);
          item.banknotId = inserted.recordset[0]?.banknotId || 0;
        } else {
          const inserted = await insertReq.query<{ banknotId: number }>(`
            DECLARE @yeniId INT = (SELECT ISNULL(MAX([BANKNOT_ID]), 0) + 1 FROM [dbo].[TODVZ_BANKNOT] WITH (UPDLOCK, HOLDLOCK));
            INSERT INTO [dbo].[TODVZ_BANKNOT] ([PARA_ID], [BANKNOT_ID], [MIKTAR])
            VALUES (@paraId, @yeniId, @miktar);
            SELECT @yeniId AS banknotId;
          `);
          item.banknotId = inserted.recordset[0]?.banknotId || 0;
        }
      }

      await transaction.commit();
      return result;
    } catch (err) {
      await this.safeRollback(transaction);
      logger.error(`BanknotSqlRepository.saveBanknotlar(${paraId}) error:`, err);
      throw err;
    }
  }

  /**
   * Deletes all banknotes for a currency (PARA_ID)
   */
  public static async deleteBanknotlar(
    paraId: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<boolean> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureTableExists(pool);
    await this.disableSyncTriggers(pool);

    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      await new sql.Request(transaction).input("paraId", sql.Int, paraId).query(this.SAYILAN_PARA_SIL);
      await new sql.Request(transaction)
        .input("paraId", sql.Int, paraId)
        .query("DELETE FROM [dbo].[TODVZ_BANKNOT] WHERE [PARA_ID] = @paraId");
      await transaction.commit();
      return true;
    } catch (err) {
      await this.safeRollback(transaction);
      logger.error(`BanknotSqlRepository.deleteBanknotlar(${paraId}) error:`, err);
      throw err;
    }
  }

  /**
   * Deletes a currency completely (both TODVZ_BANKNOT and TODVZ_PARA, along with TODVZ_KUR)
   */
  /**
   * Checks where a currency is currently used (pano, vezne, bakiye, fiş)
   */
  public static async getCurrencyUsage(
    paraId: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<{
    hasPano: boolean;
    panoCount: number;
    panoNames: string[];
    hasVezne: boolean;
    vezneNames: string[];
    hasBakiye: boolean;
    totalBakiye: number;
    bakiyeDetails: { vezneKod: string; vezneAd: string; miktar: number }[];
    banknotCount: number;
    kurCount: number;
    hasFis: boolean;
    fisCount: number;
  }> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);

    // 1. Pano satırları
    let panoCount = 0;
    let panoNames: string[] = [];
    try {
      const pRes = await pool
        .request()
        .input("paraId", sql.Int, paraId)
        .query<{ PANO_NO: string }>(`
          SELECT DISTINCT LTRIM(RTRIM(ISNULL(P.[PANO_NO], CAST(PS.[PANO_ID] AS VARCHAR)))) as PANO_NO 
          FROM [dbo].[TODVZ_PANO_SATIRI] PS
          LEFT JOIN [dbo].[TODVZ_PANO] P ON P.[PANO_ID] = PS.[PANO_ID]
          WHERE PS.[PARA_ID] = @paraId
        `);
      panoNames = pRes.recordset.map((r) => r.PANO_NO || "Pano");
      panoCount = panoNames.length;
    } catch {}

    // 2. Vezne tanımları
    let vezneNames: string[] = [];
    try {
      const vRes = await pool
        .request()
        .input("paraId", sql.Int, paraId)
        .query<{ AD: string; KOD: string }>("SELECT KOD, AD FROM [dbo].[TODVZ_VEZNE] WHERE [PARA_ID] = @paraId");
      vezneNames = vRes.recordset.map((v) => `${v.KOD} - ${v.AD}`);
    } catch {}

    // 3. Vezne bakiyeleri
    let totalBakiye = 0;
    let hasBakiye = false;
    let bakiyeDetails: { vezneKod: string; vezneAd: string; miktar: number }[] = [];
    try {
      const bRes = await pool
        .request()
        .input("paraId", sql.Int, paraId)
        .query<{ VEZNE_KOD: string; VEZNE_AD: string; MIKTAR: number }>(`
          SELECT 
            LTRIM(RTRIM(ISNULL(V.[KOD], ''))) as VEZNE_KOD, 
            LTRIM(RTRIM(ISNULL(V.[AD], ''))) as VEZNE_AD, 
            VB.[MIKTAR] 
          FROM [dbo].[TODVZ_VEZNE_BAKIYE] VB
          INNER JOIN [dbo].[TODVZ_VEZNE] V ON V.[VEZNE_ID] = VB.[VEZNE_ID]
          WHERE VB.[PARA_ID] = @paraId AND ABS(ISNULL(VB.[MIKTAR], 0)) > 0.00001
        `);
      bakiyeDetails = bRes.recordset.map((r) => ({
        vezneKod: r.VEZNE_KOD,
        vezneAd: r.VEZNE_AD,
        miktar: Number(r.MIKTAR || 0),
      }));
      totalBakiye = bakiyeDetails.reduce((acc, cur) => acc + cur.miktar, 0);
      hasBakiye = bakiyeDetails.length > 0;
    } catch {}

    // 4. Banknot sayısı
    let banknotCount = 0;
    try {
      const bnRes = await pool
        .request()
        .input("paraId", sql.Int, paraId)
        .query<{ C: number }>("SELECT COUNT(*) as C FROM [dbo].[TODVZ_BANKNOT] WHERE [PARA_ID] = @paraId");
      banknotCount = bnRes.recordset[0]?.C || 0;
    } catch {}

    // 5. Kur sayısı
    let kurCount = 0;
    try {
      const kRes = await pool
        .request()
        .input("paraId", sql.Int, paraId)
        .query<{ C: number }>("SELECT COUNT(*) as C FROM [dbo].[TODVZ_KUR] WHERE [PARA_ID] = @paraId");
      kurCount = kRes.recordset[0]?.C || 0;
    } catch {}

    // 6. Fiş kayıtları
    let fisCount = 0;
    try {
      const fRes = await pool
        .request()
        .input("paraId", sql.Int, paraId)
        .query<{ C: number }>("SELECT COUNT(*) as C FROM [dbo].[TODVZ_SARRAF_FISI_SATIRI] WHERE [URUN_ID] = @paraId");
      fisCount = fRes.recordset[0]?.C || 0;
    } catch {}

    return {
      hasPano: panoCount > 0,
      panoCount,
      panoNames,
      hasVezne: vezneNames.length > 0,
      vezneNames,
      hasBakiye,
      totalBakiye,
      bakiyeDetails,
      banknotCount,
      kurCount,
      hasFis: fisCount > 0,
      fisCount,
    };
  }

  /**
   * Deletes a currency completely (TODVZ_BANKNOT, TODVZ_KUR, TODVZ_PANO_SATIRI, TODVZ_VEZNE_BAKIYE, TODVZ_VEZNE, TODVZ_PARA)
   */
  public static async deleteCurrency(
    paraId: number,
    options?: { force?: boolean },
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<boolean> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureTableExists(pool);

    const isForce = options?.force === true;
    await this.disableSyncTriggers(pool);

    // 1. If NOT force, check vezne definition assignment
    if (!isForce) {
      try {
        const vezneCheck = await pool
          .request()
          .input("paraId", sql.Int, paraId)
          .query<{ COUNT: number }>("SELECT COUNT(*) as COUNT FROM [dbo].[TODVZ_VEZNE] WHERE [PARA_ID] = @paraId");

        if (vezneCheck.recordset[0]?.COUNT > 0) {
          throw ApiError.badRequest(
            "Bu para birimine bağlı vezne tanımları bulunmaktadır. 'Yine de Sil' seçeneği ile veznelerden de temizleyebilirsiniz."
          );
        }
      } catch (e: any) {
        if (e?.statusCode) throw e;
      }
    }

    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      // 2. If assigned to any Vezne (TODVZ_VEZNE), reset them to TL (PARA_ID = 1) or NULL
      await new sql.Request(transaction)
        .input("paraId", sql.Int, paraId)
        .query(`
          UPDATE [dbo].[TODVZ_VEZNE] 
          SET [PARA_ID] = 1 
          WHERE [PARA_ID] = @paraId;
        `);

      // 3. Delete all balance records from TODVZ_VEZNE_BAKIYE for this currency
      await new sql.Request(transaction)
        .input("paraId", sql.Int, paraId)
        .query("DELETE FROM [dbo].[TODVZ_VEZNE_BAKIYE] WHERE [PARA_ID] = @paraId");

      // 4. Delete from TODVZ_VEZNE_TRANSFERI_SATIRI if exists
      try {
        await new sql.Request(transaction)
          .input("paraId", sql.Int, paraId)
          .query(`
            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'TODVZ_VEZNE_TRANSFERI_SATIRI')
            BEGIN
              DELETE FROM [dbo].[TODVZ_VEZNE_TRANSFERI_SATIRI] WHERE [PARA_ID] = @paraId;
            END
          `);
      } catch (e) {
        logger.warn("Transfer satiri cleanup:", e);
      }

      // 5. Delete display rows from TODVZ_PANO_SATIRI so price boards do not block currency deletion
      try {
        await new sql.Request(transaction)
          .input("paraId", sql.Int, paraId)
          .query(`
            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'TODVZ_PANO_SATIRI')
            BEGIN
              DELETE FROM [dbo].[TODVZ_PANO_SATIRI] WHERE [PARA_ID] = @paraId;
            END
          `);
      } catch (panoDelErr) {
        logger.warn(`Could not delete from TODVZ_PANO_SATIRI for paraId ${paraId}:`, panoDelErr);
      }

      // 6. Delete all banknotes from TODVZ_BANKNOT for this currency (önce eski sayım satırları)
      await new sql.Request(transaction).input("paraId", sql.Int, paraId).query(this.SAYILAN_PARA_SIL);
      await new sql.Request(transaction)
        .input("paraId", sql.Int, paraId)
        .query("DELETE FROM [dbo].[TODVZ_BANKNOT] WHERE [PARA_ID] = @paraId");

      // 7. Delete rates from TODVZ_KUR for this currency.
      //    TDODVZ_KUR merkezdeki K2016_dvz.dbo.TODVZ_KUR'dan da siler; merkez tablo yoksa tetikleyici
      //    hata verip transaction'ı düşürür. O durumda tetikleyici yalnız bu silme için kapatılıp açılır.
      await new sql.Request(transaction)
        .input("paraId", sql.Int, paraId)
        .query(`
          DECLARE @kurTetikKapat BIT = 0;
          IF OBJECT_ID('K2016_dvz.dbo.TODVZ_KUR') IS NULL
             AND EXISTS (SELECT 1 FROM sys.triggers WHERE name = 'TDODVZ_KUR' AND parent_id = OBJECT_ID('dbo.TODVZ_KUR') AND is_disabled = 0)
          BEGIN
            SET @kurTetikKapat = 1;
            EXEC('DISABLE TRIGGER [TDODVZ_KUR] ON [dbo].[TODVZ_KUR]');
          END
          DELETE FROM [dbo].[TODVZ_KUR] WHERE [PARA_ID] = @paraId;
          IF @kurTetikKapat = 1
            EXEC('ENABLE TRIGGER [TDODVZ_KUR] ON [dbo].[TODVZ_KUR]');
        `);

      // 8. Reset FAVORI_PARA_ID references in TODVZ_SARRAF_FISI and TODVZ_CARI_KART to 1 (TL)
      try {
        await new sql.Request(transaction)
          .input("paraId", sql.Int, paraId)
          .query(`
            UPDATE [dbo].[TODVZ_SARRAF_FISI] SET [FAVORI_PARA_ID] = 1 WHERE [FAVORI_PARA_ID] = @paraId;
            UPDATE [dbo].[TODVZ_CARI_KART] SET [FAVORI_PARA_ID] = 1 WHERE [FAVORI_PARA_ID] = @paraId;
          `);
      } catch (favErr) {
        logger.warn("Favori para reset warning:", favErr);
      }

      // 9. If force, clean up receipts or test transactions tied to this currency
      if (isForce) {
        try {
          await new sql.Request(transaction)
            .input("paraId", sql.Int, paraId)
            .query(`
              DELETE FROM [dbo].[TODVZ_SARRAF_FISI_SATIRI] WHERE [URUN_ID] = @paraId;
              DELETE FROM [dbo].[TODVZ_CARI_DEKONT_SATIRI] WHERE [PARA_ID] = @paraId;
              DELETE FROM [dbo].[TODVZ_ODEME_SATIRI] WHERE [PARA_ID] = @paraId;
              DELETE FROM [dbo].[TODVZ_BANKA_HAREKET_SATIRI] WHERE [PARA_ID] = @paraId;
            `);
        } catch (forceErr) {
          logger.warn("Force clean receipts warning:", forceErr);
        }
      }

      // 10. Delete the currency from TODVZ_PARA
      const delRes = await new sql.Request(transaction)
        .input("paraId", sql.Int, paraId)
        .query("DELETE FROM [dbo].[TODVZ_PARA] WHERE [PARA_ID] = @paraId");

      await transaction.commit();
      return (delRes.rowsAffected[0] || 0) > 0;
    } catch (err: any) {
      await this.safeRollback(transaction);
      logger.error(`BanknotSqlRepository.deleteCurrency(${paraId}) error:`, err);

      if (err instanceof ApiError) throw err;

      const msg = err?.message || "";
      if (err?.number === 547 || msg.includes("REFERENCE constraint") || msg.includes("FOREIGN KEY")) {
        if (msg.includes("TODVZ_FIS") || msg.includes("FIS_SATIRI") || msg.includes("TODVZ_SARRAF_FISI")) {
          throw ApiError.badRequest("Bu para birimi ile yapılmış döviz veya altın alış/satış fişleri bulunmaktadır. Geçmiş fiş hareketi olan para birimleri silinemez.");
        }
        if (msg.includes("TODVZ_CARI")) {
          throw ApiError.badRequest("Bu para birimi ile yapılmış cari hesap hareketleri bulunmaktadır. Geçmiş hareketi olan para birimleri silinemez.");
        }
        if (msg.includes("TODVZ_HESAP")) {
          throw ApiError.badRequest("Bu para birimine ait kasa veya hesap hareketleri bulunmaktadır. Geçmiş hareketi olan para birimleri silinemez.");
        }
        if (msg.includes("TODVZ_BANKA")) {
          throw ApiError.badRequest("Bu para birimine bağlı banka hareketleri veya hesapları bulunmaktadır. Geçmiş hareketi olan para birimleri silinemez.");
        }
        if (msg.includes("TODVZ_VEZNE")) {
          throw ApiError.badRequest("Bu para birimine bağlı vezne tanımları bulunmaktadır. Önce 'Vezne Tanımları' sayfasından ilgili veznelerdeki para birimini değiştiriniz.");
        }
        if (msg.includes("TODVZ_TANIM")) {
          throw ApiError.badRequest("Bu para birimi şirket genel ayarlarında (varsayılan döviz, rapor para birimi vb.) tanımlıdır. Önce 'Firma Tanımları' sayfasından bu ayarı değiştiriniz.");
        }
        if (msg.includes("TODVZ_PANO")) {
          throw ApiError.badRequest("Bu para birimi fiyat panosunda yer almaktadır. Önce 'Pano Tanımı' sayfasından ilgili satırı çıkarınız.");
        }
        throw ApiError.badRequest("Bu para birimine bağlı geçmiş işlem, fiş veya hesap hareketleri bulunduğu için silinemez.");
      }

      throw ApiError.badRequest(`Para birimi silinemedi: ${msg}`);
    }
  }
}
