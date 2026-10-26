import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";
/**
 * Cari Kimlik / Pasaport / Vergi Levhası Belge Türleri ve URUN_TIPI eşlemesi:
 * Belge Türü 0 (Kimlik)        -> URUN_TIPI 20
 * Belge Türü 1 (Pasaport)      -> URUN_TIPI 21
 * Belge Türü 2 (Vergi Levhası) -> URUN_TIPI 22
 * Belge Türü 3 (Diğer/Ehliyet) -> URUN_TIPI 23
 */
export const CARI_BELGE_URUN_TIPI_BASE = 20;
export const belgeTuruToUrunTipi = (belgeTuru) => {
    if (belgeTuru === 1)
        return 21; // Pasaport
    if (belgeTuru === 2)
        return 22; // Vergi Levhası
    if (belgeTuru === 3)
        return 23; // Diğer
    return 20; // 0 veya varsayılan: T.C. Kimlik
};
export const urunTipiToBelgeTuru = (urunTipi) => {
    if (urunTipi === 21)
        return 1;
    if (urunTipi === 22)
        return 2;
    if (urunTipi === 23)
        return 3;
    return 0;
};
export class CariFotografSqlRepository {
    /**
     * Cari karta ait fotoğrafı veritabanından çeker
     */
    static async getByCariKartId(cariKartId, dbContext) {
        const id = parseInt(String(cariKartId), 10);
        if (!id || isNaN(id))
            return null;
        try {
            const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
            const req = pool.request();
            req.input("CARI_KART_ID", sql.Int, id);
            // CARI_KART_ID kolonu, URUN_ID (URUN_TIPI 20..23) veya TODVZ_CARI_KART.FOTOGRAF_ID üzerinden eşleşir
            const query = `
        SELECT TOP 1
          F.[FOTOGRAF_ID],
          F.[URUN_TIPI],
          ISNULL(F.[CARI_KART_ID], F.[URUN_ID]) AS [CARI_KART_ID],
          F.[DOSYA_ADI],
          F.[MIME_TIPI],
          F.[FOTOGRAF_DATA],
          F.[EKLEME_ZAMANI]
        FROM [dbo].[TODVZ_FOTOGRAF] F WITH (NOLOCK)
        WHERE (F.[CARI_KART_ID] = @CARI_KART_ID)
           OR (F.[URUN_TIPI] IN (20, 21, 22, 23) AND F.[URUN_ID] = @CARI_KART_ID)
           OR (F.[FOTOGRAF_ID] = (SELECT [FOTOGRAF_ID] FROM [dbo].[TODVZ_CARI_KART] WHERE [CARI_KART_ID] = @CARI_KART_ID))
        ORDER BY F.[FOTOGRAF_ID] DESC;
      `;
            const result = await req.query(query);
            if (!result.recordset || result.recordset.length === 0) {
                return null;
            }
            const row = result.recordset[0];
            let dataUrl = "";
            if (row.FOTOGRAF_DATA) {
                const mime = row.MIME_TIPI || "image/jpeg";
                const base64 = Buffer.isBuffer(row.FOTOGRAF_DATA)
                    ? row.FOTOGRAF_DATA.toString("base64")
                    : Buffer.from(row.FOTOGRAF_DATA).toString("base64");
                dataUrl = `data:${mime};base64,${base64}`;
            }
            return {
                fotografId: row.FOTOGRAF_ID,
                cariKartId: id,
                belgeTuru: urunTipiToBelgeTuru(row.URUN_TIPI),
                dosyaAdi: row.DOSYA_ADI || "kimlik.jpg",
                mimeTipi: row.MIME_TIPI || "image/jpeg",
                dataUrl,
                eklemeZamani: row.EKLEME_ZAMANI ? new Date(row.EKLEME_ZAMANI).toISOString() : null,
            };
        }
        catch (error) {
            logger.error(`[CariFotografSqlRepository.getByCariKartId] Error for cari ${id}:`, error);
            return null;
        }
    }
    /**
     * Cari karta ait kimlik/pasaport/vergi levhası fotoğrafını doğrudan SQL Server'a kaydeder.
     * Kesinlikle SODVZ_FOTOGRAF_KAYDET prosedürünü öncelikli olarak kullanır.
     */
    static async saveFotograf(data, kullaniciId, dbContext) {
        if (!data.base64) {
            throw ApiError.badRequest("Fotoğraf verisi (base64) zorunludur.");
        }
        const cariKartId = parseInt(String(data.cariKartId), 10);
        if (!cariKartId || isNaN(cariKartId)) {
            throw ApiError.badRequest("Geçerli bir cari kart kimliği (cariKartId) gereklidir.");
        }
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        // Mime ve base64 ayıklama
        let mime = data.mimeTipi || "image/jpeg";
        let base64Clean = data.base64;
        const match = data.base64.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
            mime = match[1];
            base64Clean = match[2];
        }
        const buffer = Buffer.from(base64Clean, "base64");
        const belgeTuru = data.belgeTuru !== undefined && data.belgeTuru !== null ? Number(data.belgeTuru) : 0;
        const urunTipi = belgeTuruToUrunTipi(belgeTuru);
        const dosyaAdi = data.dosyaAdi || (belgeTuru === 1 ? "pasaport.jpg" : belgeTuru === 2 ? "vergi_levhasi.jpg" : "kimlik.jpg");
        let finalFotografId = null;
        try {
            // 1. SODVZ_FOTOGRAF_KAYDET saklı yordamını çağır
            const req = pool.request();
            req.output("FOTOGRAF_ID", sql.Int);
            req.input("URUN_TIPI", sql.TinyInt, urunTipi);
            req.input("URUN_ID", sql.Int, cariKartId);
            req.input("FOTOGRAF_DATA", sql.VarBinary(sql.MAX), buffer);
            req.input("DOSYA_ADI", sql.VarChar(255), dosyaAdi);
            req.input("MIME_TIPI", sql.VarChar(50), mime);
            req.input("VARSAYILAN", sql.Bit, 1);
            req.input("KULLANICI_ID", sql.Int, kullaniciId || 1);
            const spResult = await req.execute("dbo.SODVZ_FOTOGRAF_KAYDET");
            finalFotografId = spResult.output.FOTOGRAF_ID || spResult.recordset?.[0]?.FOTOGRAF_ID;
        }
        catch (spErr) {
            logger.warn(`[CariFotografSqlRepository.saveFotograf] SP error, falling back to direct SQL: ${spErr.message}`);
            // Fallback: Doğrudan SQL INSERT/UPDATE
            const fallbackReq = pool.request();
            fallbackReq.input("URUN_TIPI", sql.TinyInt, urunTipi);
            fallbackReq.input("URUN_ID", sql.Int, cariKartId);
            fallbackReq.input("CARI_KART_ID", sql.Int, cariKartId);
            fallbackReq.input("FOTOGRAF_DATA", sql.VarBinary(sql.MAX), buffer);
            fallbackReq.input("DOSYA_ADI", sql.VarChar(255), dosyaAdi);
            fallbackReq.input("MIME_TIPI", sql.VarChar(50), mime);
            fallbackReq.input("VARSAYILAN", sql.Bit, 1);
            fallbackReq.input("KULLANICI_ID", sql.Int, kullaniciId || 1);
            const insResult = await fallbackReq.query(`
        INSERT INTO [dbo].[TODVZ_FOTOGRAF] (
          [URUN_TIPI], [URUN_ID], [CARI_KART_ID], [FOTOGRAF_DATA], [DOSYA_ADI], [MIME_TIPI], [VARSAYILAN], [EKLEYEN_ID], [EKLEME_ZAMANI]
        )
        OUTPUT INSERTED.FOTOGRAF_ID
        VALUES (
          @URUN_TIPI, @URUN_ID, @CARI_KART_ID, @FOTOGRAF_DATA, @DOSYA_ADI, @MIME_TIPI, @VARSAYILAN, @KULLANICI_ID, GETDATE()
        );
      `);
            finalFotografId = insResult.recordset?.[0]?.FOTOGRAF_ID;
        }
        if (!finalFotografId) {
            throw ApiError.internal("Fotoğraf kaydedildi fakat kimlik numarası alınamadı.");
        }
        // 2. TODVZ_FOTOGRAF tablosunda CARI_KART_ID ve TODVZ_CARI_KART tablosunda FOTOGRAF_ID / KIMLIK_BELGE_TURU güncelle
        try {
            const syncReq = pool.request();
            syncReq.input("FOTOGRAF_ID", sql.Int, finalFotografId);
            syncReq.input("CARI_KART_ID", sql.Int, cariKartId);
            syncReq.input("KIMLIK_BELGE_TURU", sql.TinyInt, belgeTuru);
            await syncReq.batch(`
        IF COL_LENGTH('dbo.TODVZ_FOTOGRAF', 'CARI_KART_ID') IS NOT NULL
        BEGIN
          UPDATE [dbo].[TODVZ_FOTOGRAF]
          SET [CARI_KART_ID] = @CARI_KART_ID
          WHERE [FOTOGRAF_ID] = @FOTOGRAF_ID;
        END;

        IF COL_LENGTH('dbo.TODVZ_CARI_KART', 'FOTOGRAF_ID') IS NOT NULL
        BEGIN
          UPDATE [dbo].[TODVZ_CARI_KART]
          SET [FOTOGRAF_ID] = @FOTOGRAF_ID,
              [KIMLIK_BELGE_TURU] = @KIMLIK_BELGE_TURU
          WHERE [CARI_KART_ID] = @CARI_KART_ID;
        END;
      `);
        }
        catch (syncErr) {
            logger.warn(`[CariFotografSqlRepository.saveFotograf] Cari sync warning: ${syncErr.message}`);
        }
        return {
            fotografId: Number(finalFotografId),
            cariKartId,
            belgeTuru,
            dosyaAdi,
            mimeTipi: mime,
            dataUrl: `data:${mime};base64,${base64Clean}`,
            eklemeZamani: new Date().toISOString(),
        };
    }
    /**
     * Cari karta ait fotoğrafı siler. SODVZ_FOTOGRAF_SIL prosedürünü kullanır.
     */
    static async deleteFotograf(cariKartId, dbContext) {
        const id = parseInt(String(cariKartId), 10);
        if (!id || isNaN(id))
            return false;
        const existing = await this.getByCariKartId(id, dbContext);
        if (!existing)
            return true;
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        try {
            // 1. SODVZ_FOTOGRAF_SIL çağrısı
            const req = pool.request();
            req.input("FOTOGRAF_ID", sql.Int, existing.fotografId);
            req.input("URUN_TIPI", sql.TinyInt, belgeTuruToUrunTipi(existing.belgeTuru));
            req.input("URUN_ID", sql.Int, id);
            await req.execute("dbo.SODVZ_FOTOGRAF_SIL");
        }
        catch (spErr) {
            logger.warn(`[CariFotografSqlRepository.deleteFotograf] SP error, fallback to DELETE: ${spErr.message}`);
            const delReq = pool.request();
            delReq.input("FOTOGRAF_ID", sql.Int, existing.fotografId);
            await delReq.query("DELETE FROM [dbo].[TODVZ_FOTOGRAF] WHERE [FOTOGRAF_ID] = @FOTOGRAF_ID");
        }
        // 2. TODVZ_CARI_KART.FOTOGRAF_ID sıfırlama
        try {
            const clearReq = pool.request();
            clearReq.input("CARI_KART_ID", sql.Int, id);
            await clearReq.query(`
        IF COL_LENGTH('dbo.TODVZ_CARI_KART', 'FOTOGRAF_ID') IS NOT NULL
        BEGIN
          UPDATE [dbo].[TODVZ_CARI_KART] SET [FOTOGRAF_ID] = NULL WHERE [CARI_KART_ID] = @CARI_KART_ID;
        END
      `);
        }
        catch (clearErr) {
            logger.warn(`[CariFotografSqlRepository.deleteFotograf] Clear ref warning: ${clearErr.message}`);
        }
        return true;
    }
}
