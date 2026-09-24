import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";

export interface TabloMaddesiModel {
  id: number;
  tur: number;
  ad: string;
  kod?: string | null;
}

export interface SaveTabloMaddesiDto {
  id?: number | null;
  tur: number;
  ad: string;
  kod?: string | null;
}

export class TabloMaddesiSqlRepository {
  public static async listByTur(
    tur: number,
    search?: string,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<TabloMaddesiModel[]> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    let query = `
      SELECT 
        [TABLO_MADDESI_ID] as id,
        [TUR] as tur,
        [AD] as ad,
        [KOD] as kod
      FROM [dbo].[TODVZ_TABLO_MADDESI]
      WHERE [TUR] = @tur
    `;
    const req = pool.request();
    req.input("tur", sql.Int, tur);

    if (search && search.trim()) {
      query += ` AND ([AD] LIKE @search OR [KOD] LIKE @search)`;
      req.input("search", sql.NVarChar, `%${search.trim()}%`);
    }

    query += ` ORDER BY [AD] ASC`;

    const result = await req.query(query);
    return result.recordset || [];
  }

  public static async save(
    dto: SaveTabloMaddesiDto,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<TabloMaddesiModel> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    const { id, tur, ad, kod } = dto;

    if (!ad || !ad.trim()) {
      throw ApiError.badRequest("Tanım adı (AD) zorunludur.");
    }

    try {
      // Stored procedure SODVZ_TABLO_MADDESI_KAYDET çağrısı
      const req = pool.request();
      req.output("TABLO_MADDESI_ID", sql.Int, id || null);
      req.input("TUR", sql.Int, tur);
      req.input("AD", sql.NVarChar(255), ad.trim());
      req.input("KOD", sql.NVarChar(50), kod ? kod.trim() : null);

      const spRes = await req.execute("SODVZ_TABLO_MADDESI_KAYDET");
      const savedId = spRes.output?.TABLO_MADDESI_ID || id;
      return {
        id: Number(savedId),
        tur,
        ad: ad.trim(),
        kod: kod ? kod.trim() : null,
      };
    } catch (spErr: any) {
      logger.warn(`[TabloMaddesiSqlRepository.save] SP execution failed, falling back to direct query: ${spErr.message}`);
      if (!id) {
        const insertRes = await pool.request()
          .input("tur", sql.Int, tur)
          .input("ad", sql.NVarChar(255), ad.trim())
          .input("kod", sql.NVarChar(50), kod ? kod.trim() : null)
          .query(`
            INSERT INTO [dbo].[TODVZ_TABLO_MADDESI] ([TUR], [AD], [KOD])
            VALUES (@tur, @ad, @kod);
            SELECT SCOPE_IDENTITY() as newId;
          `);
        const newId = insertRes.recordset[0]?.newId;
        return {
          id: Number(newId),
          tur,
          ad: ad.trim(),
          kod: kod ? kod.trim() : null,
        };
      } else {
        await pool.request()
          .input("id", sql.Int, id)
          .input("tur", sql.Int, tur)
          .input("ad", sql.NVarChar(255), ad.trim())
          .input("kod", sql.NVarChar(50), kod ? kod.trim() : null)
          .query(`
            UPDATE [dbo].[TODVZ_TABLO_MADDESI]
            SET [TUR] = @tur, [AD] = @ad, [KOD] = @kod
            WHERE [TABLO_MADDESI_ID] = @id
          `);
        return {
          id,
          tur,
          ad: ad.trim(),
          kod: kod ? kod.trim() : null,
        };
      }
    }
  }

  public static async delete(
    id: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<boolean> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await pool.request()
      .input("id", sql.Int, id)
      .query(`DELETE FROM [dbo].[TODVZ_TABLO_MADDESI] WHERE [TABLO_MADDESI_ID] = @id`);
    return true;
  }
}
