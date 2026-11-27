import sql from "mssql";
import { ApiError } from "../utils/ApiError.js";
import { TicariStokSqlRepository } from "./ticariStokSql.repository.js";
import { adisyonSemaHazirla } from "../services/adisyon/adisyonSema.js";
import { firmaDbAnahtari } from "../services/admin/firmaBaglanti.service.js";
import { FirmaSqlRepository } from "./admin/firmaSql.repository.js";
import { LisansSqlRepository } from "./admin/lisansSql.repository.js";
import { logger } from "../utils/logger.js";
/**
 * Adisyon tanımları (docs/TICARI_ADISYON_YOL_HARITASI.md, D1–D2): ayarlar; bölge / masa, hazırlık yeri, seçenek / porsiyon, garson
 * tanımları D2'de bu depoya eklenir. Ürünler Ticari stok kartlarıdır (TA20): havuz önce Ticari şemasını kurar.
 */
const temiz = (v) => String(v ?? "").trim();
const VARSAYILAN = { kdvVarsayilan: 10, servisAcik: false, servisOrani: 10, stokTakibi: true, birimKodu: "AD", vezneId: null, posCihaziId: null, misafirSiparis: false };
const GECERLI_KDV = [0, 1, 10, 20];
export class AdisyonTanimSqlRepository {
    /** Firma veritabanı: Ticari (stok kartı, satış fişi) + Adisyon şeması */
    static async havuz(ctx) {
        const pool = await TicariStokSqlRepository.havuz(ctx);
        await adisyonSemaHazirla(pool);
        return pool;
    }
    static async ayarlar(ctx, havuz) {
        const pool = havuz ?? (await this.havuz(ctx));
        const r = await new sql.Request(pool).query(`SELECT ANAHTAR, DEGER FROM dbo.TODVZ_ADISYON_AYAR`);
        const m = new Map(r.recordset.map((x) => [temiz(x.ANAHTAR), temiz(x.DEGER)]));
        const sayi = (k, v) => { const t = m.get(k); if (t === undefined)
            return v; if (t === "")
            return null; const n = Number(t); return Number.isFinite(n) ? n : v; };
        const evet = (k, v) => { const t = m.get(k); return t === undefined ? v : t.toUpperCase() === "EVET"; };
        return {
            kdvVarsayilan: sayi("KDV_VARSAYILAN", VARSAYILAN.kdvVarsayilan),
            servisAcik: evet("SERVIS_ACIK", VARSAYILAN.servisAcik),
            servisOrani: sayi("SERVIS_ORANI", VARSAYILAN.servisOrani) ?? VARSAYILAN.servisOrani,
            stokTakibi: evet("STOK_TAKIBI", VARSAYILAN.stokTakibi),
            birimKodu: m.get("BIRIM_KODU") || VARSAYILAN.birimKodu,
            vezneId: sayi("VEZNE_ID", VARSAYILAN.vezneId),
            posCihaziId: sayi("POS_CIHAZI_ID", VARSAYILAN.posCihaziId),
            misafirSiparis: evet("MISAFIR_SIPARIS", VARSAYILAN.misafirSiparis),
        };
    }
    static async ayarKaydet(g, ctx) {
        const yaz = [];
        if (g.kdvVarsayilan !== undefined) {
            if (g.kdvVarsayilan !== null && !GECERLI_KDV.includes(Number(g.kdvVarsayilan)))
                throw ApiError.badRequest(`KDV varsayılanı ${GECERLI_KDV.map((x) => `%${x}`).join(", ")} ya da boş olmalı.`);
            yaz.push(["KDV_VARSAYILAN", g.kdvVarsayilan === null ? "" : String(Number(g.kdvVarsayilan))]);
        }
        if (g.servisAcik !== undefined)
            yaz.push(["SERVIS_ACIK", g.servisAcik ? "EVET" : "HAYIR"]);
        if (g.servisOrani !== undefined) {
            const o = Number(g.servisOrani);
            if (!Number.isFinite(o) || o < 0 || o > 30 || Math.round(o * 100) !== o * 100)
                throw ApiError.badRequest("Servis ücreti oranı 0 ile 30 arasında, en çok 2 ondalık olmalı.");
            yaz.push(["SERVIS_ORANI", String(o)]);
        }
        if (g.stokTakibi !== undefined)
            yaz.push(["STOK_TAKIBI", g.stokTakibi ? "EVET" : "HAYIR"]);
        if (g.misafirSiparis !== undefined)
            yaz.push(["MISAFIR_SIPARIS", g.misafirSiparis ? "EVET" : "HAYIR"]);
        if (g.birimKodu !== undefined) {
            const b = temiz(g.birimKodu).toUpperCase();
            if (!/^[A-Z0-9]{1,3}$/.test(b))
                throw ApiError.badRequest("Birim kodu 1–3 büyük harf ya da rakam olmalı (adisyon numarasının ön eki).");
            yaz.push(["BIRIM_KODU", b]);
        }
        if (g.vezneId !== undefined) {
            const v = g.vezneId === null || String(g.vezneId) === "" ? null : Number(g.vezneId);
            if (v !== null && (!Number.isInteger(v) || v <= 0))
                throw ApiError.badRequest("Tahsilat veznesi geçersiz.");
            yaz.push(["VEZNE_ID", v === null ? "" : String(v)]);
        }
        const pool = await this.havuz(ctx);
        if (g.posCihaziId !== undefined) {
            const v = g.posCihaziId === null || String(g.posCihaziId) === "" ? null : Number(g.posCihaziId);
            if (v !== null) {
                if (!Number.isInteger(v) || v <= 0)
                    throw ApiError.badRequest("Varsayılan POS hesabı geçersiz.");
                const r = await pool.request().input("P", sql.Int, v).query(`IF OBJECT_ID('dbo.TODVZ_POS_CIHAZI', 'U') IS NULL SELECT 0 AS V ELSE SELECT COUNT(*) AS V FROM dbo.TODVZ_POS_CIHAZI WHERE POS_CIHAZI_ID = @P`);
                if (!Number(r.recordset[0]?.V))
                    throw ApiError.badRequest("Seçilen POS hesabı bulunamadı.");
            }
            yaz.push(["POS_CIHAZI_ID", v === null ? "" : String(v)]);
        }
        const tx = new sql.Transaction(pool);
        await tx.begin();
        try {
            for (const [k, v] of yaz) {
                await new sql.Request(tx).input("K", sql.VarChar(50), k).input("D", sql.NVarChar(400), v).query(`
          IF EXISTS (SELECT 1 FROM dbo.TODVZ_ADISYON_AYAR WITH (UPDLOCK, HOLDLOCK) WHERE ANAHTAR = @K) UPDATE dbo.TODVZ_ADISYON_AYAR SET DEGER = @D WHERE ANAHTAR = @K
          ELSE INSERT INTO dbo.TODVZ_ADISYON_AYAR (ANAHTAR, DEGER) VALUES (@K, @D);`);
            }
            await tx.commit();
        }
        catch (e) {
            await tx.rollback().catch(() => undefined);
            throw e;
        }
        return this.ayarlar(ctx);
    }
    /**
     * Lisanstaki garson sınırı (TA24): firma merkezde kayıtlı değilse ya da sınır boşsa null (sınırsız). Merkeze ulaşılamazsa
     * kayıt engellenmez (uyarı loglanır): yerel kurulumda merkez bağlantısı olmayabilir.
     */
    static async garsonLimiti(ctx) {
        try {
            if (!ctx?.dbServer || !ctx?.dbName)
                return null;
            const firma = await FirmaSqlRepository.anahtarIleBul(firmaDbAnahtari(ctx.dbServer, ctx.dbName).anahtar);
            if (!firma)
                return null;
            return await LisansSqlRepository.aktifGarsonLimiti(firma.firmaId);
        }
        catch (e) {
            logger.warn(`[Adisyon] Garson sınırı okunamadı: ${e?.message || e}`);
            return null;
        }
    }
}
