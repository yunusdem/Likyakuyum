import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";
export class SayimSqlRepository {
    static async getNextFisNo() {
        return this.generateNextFisNo();
    }
    /**
     * Çakışmayan, sıralı ve güncel bir sonraki sayım fiş numarasını üretir (Örn: SYM-20260920-0001)
     */
    static async generateNextFisNo() {
        const pool = await getDbPool();
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, "0");
        const d = String(today.getDate()).padStart(2, "0");
        const prefix = `SYM-${y}${m}${d}-`;
        try {
            const req = pool.request();
            req.input("PREFIX", sql.VarChar(30), `${prefix}%`);
            const res = await req.query(`
        SELECT FIS_NO
        FROM dbo.TODVZ_SAYIM_FISI
        WHERE FIS_NO LIKE @PREFIX
      `);
            let maxNum = 0;
            if (res.recordset && res.recordset.length > 0) {
                for (const row of res.recordset) {
                    const fn = String(row.FIS_NO || "");
                    const numPart = fn.replace(prefix, "").trim();
                    const parsed = parseInt(numPart, 10);
                    if (!isNaN(parsed) && parsed > maxNum) {
                        maxNum = parsed;
                    }
                }
            }
            let nextNum = maxNum + 1;
            let candidate = `${prefix}${String(nextNum).padStart(4, "0")}`;
            // Çakışma kontrolü ve benzersizlik garantisi
            let attempts = 0;
            while (attempts < 25) {
                const checkReq = pool.request();
                checkReq.input("cand", sql.VarChar(50), candidate);
                const checkRes = await checkReq.query(`SELECT 1 AS ex FROM dbo.TODVZ_SAYIM_FISI WHERE FIS_NO = @cand;`);
                if (!checkRes.recordset || checkRes.recordset.length === 0) {
                    return candidate;
                }
                nextNum++;
                candidate = `${prefix}${String(nextNum).padStart(4, "0")}`;
                attempts++;
            }
            return `${prefix}${Date.now().toString().slice(-4)}`;
        }
        catch {
            const rand = Math.floor(1000 + Math.random() * 9000);
            return `${prefix}${rand}`;
        }
    }
    /**
     * Sayım fişini ve tüm satırlarını SODVZ_SAYIM_FISI_KAYDET ve SODVZ_SAYIM_SATIR_EKLE prosedürleri ile kaydeder
     */
    static async saveSayimFisi(payload) {
        const pool = await getDbPool();
        // Tarih ve saat formatlama
        const today = new Date();
        const tarihVal = payload.tarih ? payload.tarih.slice(0, 10) : today.toISOString().slice(0, 10);
        const saatVal = payload.saat
            ? (payload.saat.length === 5 ? `${payload.saat}:00` : payload.saat.slice(0, 8))
            : today.toTimeString().slice(0, 8);
        try {
            let effectiveSayimFisiId = payload.sayimFisiId ? Number(payload.sayimFisiId) : null;
            let effectiveFisNo = payload.fisNo ? payload.fisNo.trim() : "";
            // 1. Eğer sayimFisiId belirtilmemiş ama bir fisNo gönderilmişse, bu fiş veritabanında var mı kontrol et
            if (!effectiveSayimFisiId && effectiveFisNo) {
                const checkReq = pool.request();
                checkReq.input("checkFisNo", sql.VarChar(50), effectiveFisNo);
                const checkRes = await checkReq.query(`SELECT TOP 1 SAYIM_FISI_ID FROM dbo.TODVZ_SAYIM_FISI WHERE FIS_NO = @checkFisNo;`);
                if (checkRes.recordset && checkRes.recordset.length > 0) {
                    effectiveSayimFisiId = Number(checkRes.recordset[0].SAYIM_FISI_ID);
                }
            }
            // 2. Eğer yeni bir fiş ise (effectiveSayimFisiId yok):
            //    Eğer fisNo boş ise veya gönderilen fisNo zaten başka bir fişte kullanılmışsa -> otomatik yeni fiş numarası ata
            if (!effectiveSayimFisiId) {
                if (!effectiveFisNo) {
                    effectiveFisNo = await SayimSqlRepository.generateNextFisNo();
                }
                else {
                    const dupReq = pool.request();
                    dupReq.input("dupFisNo", sql.VarChar(50), effectiveFisNo);
                    const dupRes = await dupReq.query(`SELECT TOP 1 SAYIM_FISI_ID FROM dbo.TODVZ_SAYIM_FISI WHERE FIS_NO = @dupFisNo;`);
                    if (dupRes.recordset && dupRes.recordset.length > 0) {
                        effectiveFisNo = await SayimSqlRepository.generateNextFisNo();
                    }
                }
            }
            // 3. Ana Fiş Kaydı (SODVZ_SAYIM_FISI_KAYDET)
            const headerReq = pool.request();
            headerReq.output("SAYIM_FISI_ID", sql.Int, effectiveSayimFisiId || null);
            headerReq.input("FIS_NO", sql.VarChar(50), effectiveFisNo);
            headerReq.input("TARIH", sql.Date, tarihVal);
            headerReq.input("SAAT", sql.VarChar(8), saatVal);
            headerReq.input("SISTEM_ADET", sql.Float, Number(payload.sistemAdet || 0));
            headerReq.input("SISTEM_GRAM", sql.Float, Number(payload.sistemGram || 0));
            headerReq.input("SAYILAN_ADET", sql.Float, Number(payload.sayilanAdet || 0));
            headerReq.input("SAYILAN_GRAM", sql.Float, Number(payload.sayilanGram || 0));
            headerReq.input("FARK_ADET", sql.Float, Number(payload.farkAdet || 0));
            headerReq.input("FARK_GRAM", sql.Float, Number(payload.farkGram || 0));
            headerReq.input("UYUMLU_SAYISI", sql.Int, Number(payload.uyumluSayisi || 0));
            headerReq.input("FARKLI_SAYISI", sql.Int, Number(payload.farkliSayisi || 0));
            headerReq.input("TOPLAM_KALEM", sql.Int, Number(payload.toplamKalem || (payload.satirlar ? payload.satirlar.length : 0)));
            headerReq.input("DURUM", sql.TinyInt, payload.durum ?? 1);
            headerReq.input("ACIKLAMA", sql.VarChar(250), payload.aciklama || null);
            headerReq.input("KULLANICI_ID", sql.Int, payload.kullaniciId || null);
            const headerRes = await headerReq.execute("dbo.SODVZ_SAYIM_FISI_KAYDET");
            const sayimFisiId = headerRes.output.SAYIM_FISI_ID || effectiveSayimFisiId;
            if (!sayimFisiId) {
                throw new ApiError(500, "Sayım fişi ID üretilemedi.");
            }
            // 4. Satırların Eklenmesi (SODVZ_SAYIM_SATIR_EKLE)
            if (Array.isArray(payload.satirlar) && payload.satirlar.length > 0) {
                // Yeniden kaydetme/güncelleme durumunda eski satırları temizle
                try {
                    const delReq = pool.request();
                    delReq.input("SAYIM_FISI_ID", sql.Int, sayimFisiId);
                    await delReq.query(`DELETE FROM dbo.TODVZ_SAYIM_FISI_SATIRI WHERE SAYIM_FISI_ID = @SAYIM_FISI_ID;`);
                }
                catch { }
                for (let i = 0; i < payload.satirlar.length; i++) {
                    const s = payload.satirlar[i];
                    const satirReq = pool.request();
                    satirReq.input("SAYIM_FISI_ID", sql.Int, sayimFisiId);
                    satirReq.input("SATIR_NO", sql.Int, s.satirNo || i + 1);
                    satirReq.input("ALTIN_URUN_ID", sql.Int, s.altinUrunId || null);
                    satirReq.input("BARKOD", sql.VarChar(50), s.barkod || "");
                    satirReq.input("URUN_BILGISI", sql.VarChar(200), s.urunBilgisi || "-");
                    satirReq.input("AYAR", sql.VarChar(50), s.ayar || null);
                    satirReq.input("BANKO", sql.VarChar(50), s.banko || null);
                    satirReq.input("SISTEM_ADET", sql.Float, Number(s.sistemAdet || 0));
                    satirReq.input("SISTEM_GRAM", sql.Float, Number(s.sistemGram || 0));
                    satirReq.input("SAYILAN_ADET", sql.Float, s.sayilanAdet !== null && s.sayilanAdet !== undefined ? Number(s.sayilanAdet) : null);
                    satirReq.input("SAYILAN_GRAM", sql.Float, s.sayilanGram !== null && s.sayilanGram !== undefined ? Number(s.sayilanGram) : null);
                    satirReq.input("BIRIM_FIYAT", sql.Float, Number(s.birimFiyat || 0));
                    await satirReq.execute("dbo.SODVZ_SAYIM_SATIR_EKLE");
                }
            }
            logger.info(`Sayım Fişi Kaydedildi: ID=${sayimFisiId}, FişNo=${effectiveFisNo}, Kalem=${payload.satirlar?.length || 0}`);
            return { sayimFisiId, fisNo: effectiveFisNo };
        }
        catch (err) {
            logger.error("Sayım Fişi Kayıt Hatası:", err);
            throw new ApiError(400, err?.message || "Sayım fişi kaydedilemedi.");
        }
    }
    /**
     * Sayım fişini ve bağlı satırlarını siler (SODVZ_SAYIM_FISI_SIL)
     */
    static async deleteSayimFisi(sayimFisiId) {
        const pool = await getDbPool();
        try {
            const req = pool.request();
            req.input("SAYIM_FISI_ID", sql.Int, sayimFisiId);
            await req.execute("dbo.SODVZ_SAYIM_FISI_SIL");
            logger.info(`Sayım Fişi Silindi: ID=${sayimFisiId}`);
            return true;
        }
        catch (err) {
            logger.error(`Sayım Fişi Silme Hatası (ID=${sayimFisiId}):`, err);
            throw new ApiError(400, err?.message || "Sayım fişi silinemedi.");
        }
    }
    /**
     * Tüm kayıtlı sayım fişlerini listeler
     */
    static async listSayimFisleri(limit = 100) {
        const pool = await getDbPool();
        try {
            const req = pool.request();
            req.input("LIMIT", sql.Int, limit);
            const query = `
        SELECT TOP (@LIMIT)
          f.SAYIM_FISI_ID AS sayimFisiId,
          f.FIS_NO AS fisNo,
          CONVERT(VARCHAR(10), f.TARIH, 120) AS tarih,
          CONVERT(VARCHAR(8), f.SAAT, 108) AS saat,
          f.SISTEM_ADET AS sistemAdet,
          f.SISTEM_GRAM AS sistemGram,
          f.SAYILAN_ADET AS sayilanAdet,
          f.SAYILAN_GRAM AS sayilanGram,
          f.FARK_ADET AS farkAdet,
          f.FARK_GRAM AS farkGram,
          f.UYUMLU_SAYISI AS uyumluSayisi,
          f.FARKLI_SAYISI AS farkliSayisi,
          f.TOPLAM_KALEM AS toplamKalem,
          f.DURUM AS durum,
          f.ACIKLAMA AS aciklama,
          f.EKLEME_ZAMANI AS eklemeZamani,
          f.GUNCELLEME_ZAMANI AS guncellemeZamani
        FROM dbo.TODVZ_SAYIM_FISI f
        ORDER BY f.SAYIM_FISI_ID DESC;
      `;
            const res = await req.query(query);
            return res.recordset || [];
        }
        catch (err) {
            logger.error("Sayım Fişleri Listeleme Hatası:", err);
            return [];
        }
    }
    /**
     * Fiş numarasına veya ID'ye göre fiş ve satır detaylarını getirir
     */
    static async getSayimFisiById(idOrFisNo) {
        const pool = await getDbPool();
        try {
            const isPureNumber = typeof idOrFisNo === "number" || (/^\d+$/.test(String(idOrFisNo)) && !String(idOrFisNo).startsWith("SYM-"));
            const numId = isPureNumber ? parseInt(String(idOrFisNo), 10) : null;
            const strNo = String(idOrFisNo);
            const headerReq = pool.request();
            headerReq.input("NUM_ID", sql.Int, numId);
            headerReq.input("STR_NO", sql.VarChar(50), strNo);
            const headerRes = await headerReq.query(`
        SELECT
          f.SAYIM_FISI_ID AS sayimFisiId,
          f.FIS_NO AS fisNo,
          CONVERT(VARCHAR(10), f.TARIH, 120) AS tarih,
          CONVERT(VARCHAR(8), f.SAAT, 108) AS saat,
          f.SISTEM_ADET AS sistemAdet,
          f.SISTEM_GRAM AS sistemGram,
          f.SAYILAN_ADET AS sayilanAdet,
          f.SAYILAN_GRAM AS sayilanGram,
          f.FARK_ADET AS farkAdet,
          f.FARK_GRAM AS farkGram,
          f.UYUMLU_SAYISI AS uyumluSayisi,
          f.FARKLI_SAYISI AS farkliSayisi,
          f.TOPLAM_KALEM AS toplamKalem,
          f.DURUM AS durum,
          f.ACIKLAMA AS aciklama
        FROM dbo.TODVZ_SAYIM_FISI f
        WHERE (@NUM_ID IS NOT NULL AND f.SAYIM_FISI_ID = @NUM_ID)
           OR f.FIS_NO = @STR_NO;
      `);
            if (!headerRes.recordset || headerRes.recordset.length === 0) {
                return null;
            }
            const header = headerRes.recordset[0];
            const actualId = header.sayimFisiId;
            // Satırları getir
            const satirlarReq = pool.request();
            satirlarReq.input("ID", sql.Int, actualId);
            const satirlarRes = await satirlarReq.query(`
        SELECT *
        FROM dbo.TODVZ_SAYIM_FISI_SATIRI s
        WHERE s.SAYIM_FISI_ID = @ID
        ORDER BY s.SATIR_NO ASC;
      `);
            const mappedSatirlar = (satirlarRes.recordset || []).map((s) => ({
                satirId: s.SATIR_ID || s.SAYIM_SATIR_ID || s.ID || s.SATIR_NO || s.SAYIM_FISI_SATIRI_ID,
                sayimFisiId: s.SAYIM_FISI_ID,
                satirNo: s.SATIR_NO,
                altinUrunId: s.ALTIN_URUN_ID,
                barkod: s.BARKOD,
                urunBilgisi: s.URUN_BILGISI,
                urunAdi: s.URUN_BILGISI || s.URUN_ADI || "-",
                ayar: s.AYAR,
                banko: s.BANKO,
                sistemAdet: s.SISTEM_ADET,
                sistemGram: s.SISTEM_GRAM,
                sayilanAdet: s.SAYILAN_ADET,
                sayilanGram: s.SAYILAN_GRAM,
                adetFarki: s.ADET_FARKI,
                gramFarki: s.GRAM_FARKI,
                durum: s.DURUM,
                birimFiyat: s.BIRIM_FIYAT,
            }));
            return {
                ...header,
                satirlar: mappedSatirlar,
            };
        }
        catch (err) {
            logger.error(`Sayım Fişi Getirme Hatası (ID=${idOrFisNo}):`, err);
            return null;
        }
    }
}
