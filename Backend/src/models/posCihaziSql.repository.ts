import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";
import { POS_HAREKET_KOLONLARI, belgeTablolari, posHareketleriSql } from "../services/rapor/kaynak.js";
import { TL_PARA_SQL } from "../services/rapor/raporOrtak.js";

export interface PosCihaziModel {
  posCihaziId: number;
  cariKartId?: number | null;
  cariKodu?: string | null;
  cariUnvan?: string | null;
  kod: string;
  ad: string;
  devir: number;
  bakiye?: number;
  aktif?: boolean;
}

export interface SavePosCihaziDto {
  posCihaziId?: number | null;
  cariKartId?: number | null;
  kod: string;
  ad: string;
  devir?: number;
  aktif?: boolean;
}

export class PosCihaziSqlRepository {
  private static async ensureTables(pool: sql.ConnectionPool): Promise<void> {
    try {
      const ddl = `
        IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.TODVZ_POS_CIHAZI') AND type in (N'U'))
        BEGIN
          CREATE TABLE dbo.TODVZ_POS_CIHAZI (
            POS_CIHAZI_ID INT IDENTITY(1,1) PRIMARY KEY,
            CARI_KART_ID INT NULL,
            KOD VARCHAR(50) NOT NULL,
            AD VARCHAR(150) NOT NULL,
            DEVIR FLOAT NOT NULL DEFAULT 0
          );
        END;
      `;
      await pool.request().batch(ddl);
    } catch (err: any) {
      logger.warn(`[PosCihaziSqlRepository.ensureTables] Warning: ${err.message}`);
    }
  }

  public static async getAll(dbContext?: { dbServer?: string; dbName?: string }): Promise<PosCihaziModel[]> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureTables(pool);

    const query = `
      SELECT 
        p.POS_CIHAZI_ID AS posCihaziId,
        p.CARI_KART_ID AS cariKartId,
        COALESCE(b.HESAP_NO, c.KOD) AS cariKodu,
        COALESCE(b.HESAP_ADI, c.AD) AS cariUnvan,
        p.KOD AS kod,
        p.AD AS ad,
        ISNULL(p.DEVIR, 0) AS devir
      FROM dbo.TODVZ_POS_CIHAZI p
      LEFT JOIN dbo.TODVZ_BANKA b ON b.BANKA_ID = p.CARI_KART_ID
      LEFT JOIN dbo.TODVZ_CARI_KART c ON c.CARI_KART_ID = p.CARI_KART_ID
      ORDER BY p.KOD ASC
    `;

    const res = await pool.request().query(query);
    const list: PosCihaziModel[] = res.recordset || [];

    // Her cihaz için bakiye al
    for (const item of list) {
      item.bakiye = await this.getBakiye(item.posCihaziId, dbContext);
    }

    return list;
  }

  public static async getById(
    posCihaziId: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<PosCihaziModel | null> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureTables(pool);

    const query = `
      SELECT 
        p.POS_CIHAZI_ID AS posCihaziId,
        p.CARI_KART_ID AS cariKartId,
        COALESCE(b.HESAP_NO, c.KOD) AS cariKodu,
        COALESCE(b.HESAP_ADI, c.AD) AS cariUnvan,
        p.KOD AS kod,
        p.AD AS ad,
        ISNULL(p.DEVIR, 0) AS devir
      FROM dbo.TODVZ_POS_CIHAZI p
      LEFT JOIN dbo.TODVZ_BANKA b ON b.BANKA_ID = p.CARI_KART_ID
      LEFT JOIN dbo.TODVZ_CARI_KART c ON c.CARI_KART_ID = p.CARI_KART_ID
      WHERE p.POS_CIHAZI_ID = @POS_CIHAZI_ID
    `;

    const res = await pool.request().input("POS_CIHAZI_ID", sql.Int, posCihaziId).query(query);
    const item = res.recordset?.[0] || null;
    if (item) {
      item.bakiye = await this.getBakiye(item.posCihaziId, dbContext);
    }
    return item;
  }

  public static async getBakiye(
    posCihaziId: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<number> {
    try {
      const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
      await this.ensureTables(pool);

      // Bakiye kaynağı POS Ekstresi raporuyla (POSEKS1) aynıdır — services/rapor/kaynak.ts posHareketleriSql (eski VODVZR_POS_EKSTRESI kapsamı): cihaz devri,
      // POS'lu cari hareketler (tahsilat borç, bankaya aktarım alacak), sarraf fişinin kartlı tahsilatı, perakende fişinin kartlı tahsilatı / iadesi.
      // Önceden ekran POS'lu cari hareketleri hiç almıyordu ve sarrafta başka kolona bakıyordu; ekran rapordan farklı bakiye gösteriyordu (denetim 24.11.2026).
      // Ekran TL bakiyesidir (POS tahsilatı TL'dir; rapor para bazında ayırır).
      const query = `
        ;WITH X (${POS_HAREKET_KOLONLARI}) AS (${posHareketleriSql(await belgeTablolari(pool))})
        SELECT ISNULL(SUM(ISNULL(X.borc, 0) - ISNULL(X.alacak, 0)), 0) AS BAKIYE
        FROM X WHERE X.posCihaziId = @POS_CIHAZI_ID AND X.paraId = ${TL_PARA_SQL};
      `;

      const req = pool.request();
      req.input("POS_CIHAZI_ID", sql.Int, posCihaziId);
      const res = await req.query(query);
      return Number(res.recordset?.[0]?.BAKIYE || 0);
    } catch (err) {
      logger.error("[PosCihaziSqlRepository.getBakiye] Error:", err);
      return 0;
    }
  }

  public static async getNextPosKod(dbContext?: { dbServer?: string; dbName?: string }): Promise<string> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureTables(pool);

    const res = await pool.request().query("SELECT KOD FROM dbo.TODVZ_POS_CIHAZI WHERE KOD IS NOT NULL AND KOD <> ''");
    const records = res.recordset || [];
    let maxNum = 0;
    for (const r of records) {
      const match = String(r.KOD || "").match(/(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    }
    const nextNum = maxNum > 0 ? maxNum + 1 : records.length + 1;
    return `POS.${String(nextNum).padStart(2, "0")}`;
  }

  public static async save(
    dto: SavePosCihaziDto,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<PosCihaziModel> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureTables(pool);

    let kodVal = (dto.kod || "").trim();
    if (!kodVal) {
      kodVal = await this.getNextPosKod(dbContext);
    }

    const targetId = dto.posCihaziId && Number(dto.posCihaziId) > 0 ? Number(dto.posCihaziId) : null;
    const req = pool.request();
    req.output("POS_CIHAZI_ID", sql.Int, targetId);
    req.input("CARI_KART_ID", sql.Int, dto.cariKartId ? Number(dto.cariKartId) : null);
    req.input("KOD", sql.VarChar(50), kodVal);
    req.input("AD", sql.VarChar(150), (dto.ad || "").trim());
    req.input("DEVIR", sql.Float, Number(dto.devir || 0));

    try {
      const result = await req.execute("dbo.SODVZ_POS_CIHAZI_KAYDET");
      const savedId = Number(result.output?.POS_CIHAZI_ID) || targetId;
      if (!savedId) {
        throw new Error("POS cihazı kaydedildi ancak ID alınamadı.");
      }

      const saved = await this.getById(savedId, dbContext);
      if (!saved) throw new Error("POS cihazı kaydedildi ancak okunamadı.");
      return saved;
    } catch (err: any) {
      logger.error("[PosCihaziSqlRepository.save] Error:", err);
      const rawMsg = err.originalError?.message || err.message || "";
      throw ApiError.badRequest(rawMsg || "POS cihazı kaydedilemedi.");
    }
  }

  public static async delete(
    posCihaziId: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<boolean> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureTables(pool);

    const res = await pool.request()
      .input("POS_CIHAZI_ID", sql.Int, posCihaziId)
      .query("DELETE FROM dbo.TODVZ_POS_CIHAZI WHERE POS_CIHAZI_ID = @POS_CIHAZI_ID");

    return (res.rowsAffected?.[0] || 0) > 0;
  }
}
