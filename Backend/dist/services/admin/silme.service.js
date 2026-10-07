import fs from "fs";
import path from "path";
import sql from "mssql";
import { env } from "../../config/env.config.js";
import { getAdminPool } from "../../config/adminDb.config.js";
import { veritabaniHavuzlariniKapat } from "../../config/mssql.config.js";
import { BulutSqlRepository } from "../../models/admin/bulutSql.repository.js";
import { AdminLogSqlRepository } from "../../models/admin/adminLogSql.repository.js";
import { IzlemeSqlRepository } from "../../models/admin/izlemeSql.repository.js";
import { ApiError } from "../../utils/ApiError.js";
import { logger } from "../../utils/logger.js";
import { trZaman } from "../../utils/zaman.utils.js";
import { OturumService } from "../oturum.service.js";
import { MerkezGirisService } from "../merkezGiris.service.js";
import { FirmaService } from "./firma.service.js";
import { kd, klonIle, klonYapilandirildiMi, nm } from "./klon.service.js";
import { veritabaniniYedekle, yedekKlasorleri } from "./yedek.service.js";
/**
 * Bulut firma silme (docs/BULUT_VE_EXE_LISANS_YOL_HARITASI.md, K5 ve 6.2):
 * "Sil" → firma SILINECEK olur, girişler kapanır, 30 gün içinde "Geri Al" ile aynen döner.
 * Süre dolunca (gece zamanlayıcısı): son yedek Silinen klasörüne alınır → veritabanı ve SQL girişi silinir →
 * firma SILINDI. Son yedek 90 gün saklanıp silinir.
 * Yalnız likya_klon'un açtığı (sahibi olduğu) veritabanları panelden silinebilir; diğerlerine bu hesabın yetkisi yoktur.
 */
export const SILME_BEKLEME_GUN = 30;
export const SILINEN_YEDEK_SAKLAMA_GUN = 90;
const KORUNAN_GIRISLER = ["sa", "likya_klon", "likya_admin_app"];
/** Veritabanının sunucudaki sahibi (yoksa null). */
const veritabaniSahibi = async (dbName) => klonIle("master", async (pool) => {
    const res = await pool
        .request()
        .input("db", sql.NVarChar(128), dbName)
        .query(`SELECT SUSER_SNAME(owner_sid) AS SAHIP FROM sys.databases WHERE name = @db`);
    return res.recordset[0]?.SAHIP ?? null;
});
/** Aynı sunucuda bu SQL girişini kullanan başka (silinmemiş) firma var mı. */
const girisBaskaFirmadaMi = async (firmaId, dbServer, dbUser) => {
    const pool = await getAdminPool();
    const res = await pool
        .request()
        .input("id", sql.Int, firmaId)
        .input("sunucu", sql.NVarChar(200), dbServer)
        .input("kullanici", sql.NVarChar(128), dbUser)
        .query(`SELECT COUNT(*) AS N FROM dbo.ADM_FIRMA
            WHERE FIRMA_ID <> @id AND DURUM <> 'SILINDI' AND DB_SERVER = @sunucu AND DB_USER = @kullanici`);
    return res.recordset[0].N > 0;
};
const tarihEki = () => trZaman().gun.replace(/-/g, "");
export class SilmeService {
    /** Panelden silinemiyorsa nedeni; silinebiliyorsa null. */
    static async silinemezNedeni(firma) {
        if (firma.baglantiModu !== "cloud")
            return "Yalnız sunucumuzdaki (bulut) firmalar panelden silinebilir.";
        if (firma.durum === "SILINECEK")
            return "Firma zaten silinmek üzere bekliyor.";
        if (firma.durum === "SILINDI")
            return "Firma zaten silinmiş.";
        if (!klonYapilandirildiMi())
            return "Bu sunucuda veritabanı silme kapalı (klonlama hesabı tanımlı değil).";
        let sahip;
        try {
            sahip = await veritabaniSahibi(firma.dbName);
        }
        catch (err) {
            return `Veritabanı denetlenemedi: ${String(err?.message || err).slice(0, 200)}`;
        }
        if (!sahip)
            return `${firma.dbName} veritabanı sunucuda bulunamadı.`;
        if (sahip.toLowerCase() !== env.KLON_DB_USER.toLowerCase()) {
            return "Bu firmanın veritabanı panelden açılmamış; panelden silinemez (gerekirse SSMS ile elle).";
        }
        return null;
    }
    static async silmeIste(yapan, firmaId, onayKodu) {
        const firma = await FirmaService.getir(firmaId);
        if ((onayKodu || "").trim().toUpperCase() !== firma.firmaKodu.toUpperCase()) {
            throw ApiError.badRequest("Onay için firma kodunu aynen yazın.");
        }
        const neden = await this.silinemezNedeni(firma);
        if (neden)
            throw ApiError.badRequest(neden);
        if (!(await BulutSqlRepository.silmePlanla(firmaId, SILME_BEKLEME_GUN, yapan.adminId))) {
            throw ApiError.conflict("Firmanın durumu değişmiş; sayfayı yenileyip tekrar deneyin.");
        }
        const kapananOturum = await IzlemeSqlRepository.oturumlariIptalEt({ firmaId }, yapan.adminId);
        OturumService.onbellegiTemizle();
        await AdminLogSqlRepository.islemLogu({
            adminId: yapan.adminId,
            islem: "FIRMA_SILME_PLANLANDI",
            hedefTur: "FIRMA",
            hedefId: firmaId,
            eski: { durum: firma.durum },
            yeni: { durum: "SILINECEK", beklemeGun: SILME_BEKLEME_GUN, kapananOturum, dbName: firma.dbName },
        });
        return FirmaService.getir(firmaId);
    }
    static async geriAl(yapan, firmaId) {
        const firma = await FirmaService.getir(firmaId);
        if (firma.durum !== "SILINECEK")
            throw ApiError.badRequest("Firma silinmek üzere beklemiyor.");
        if (!(await BulutSqlRepository.silmeGeriAl(firmaId))) {
            throw ApiError.conflict("Firma bu arada kalıcı olarak silinmiş olabilir; sayfayı yenileyin.");
        }
        OturumService.onbellegiTemizle();
        await AdminLogSqlRepository.islemLogu({
            adminId: yapan.adminId,
            islem: "FIRMA_SILME_GERI_ALINDI",
            hedefTur: "FIRMA",
            hedefId: firmaId,
            eski: { durum: "SILINECEK", silinmePlani: firma.silinmePlani },
            yeni: { durum: "AKTIF" },
        });
        return FirmaService.getir(firmaId);
    }
    /**
     * Bekleme süresi dolmuş firmayı kalıcı siler. Son yedek alınamazsa HİÇBİR ŞEY silinmez (ertesi gece tekrar denenir).
     */
    static async kaliciSil(f) {
        const { silinen, firmalar } = await yedekKlasorleri();
        const sonYedek = path.win32.join(silinen, `${f.firmaKodu}_${tarihEki()}.bak`);
        const adimlar = { dbName: f.dbName };
        try {
            const sahip = await veritabaniSahibi(f.dbName);
            if (sahip && sahip.toLowerCase() !== env.KLON_DB_USER.toLowerCase()) {
                throw new Error(`Veritabanının sahibi ${sahip}; panelden silinemez.`);
            }
            let boyut = null;
            if (sahip) {
                boyut = await veritabaniniYedekle(f.dbName, sonYedek);
                adimlar.sonYedek = sonYedek;
                adimlar.boyut = boyut;
                await veritabaniHavuzlariniKapat(f.dbServer, f.dbName);
                MerkezGirisService.baglantiOnbelleginiTemizle(f.firmaId);
                await klonIle("master", (pool) => pool
                    .request()
                    .batch(`IF DB_ID(${nm(f.dbName)}) IS NOT NULL BEGIN ALTER DATABASE ${kd(f.dbName)} SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE ${kd(f.dbName)}; END`));
                adimlar.veritabaniSilindi = true;
            }
            else {
                adimlar.veritabaniZatenYok = true;
            }
            if (f.dbUser && !KORUNAN_GIRISLER.includes(f.dbUser.toLowerCase())) {
                if (await girisBaskaFirmadaMi(f.firmaId, f.dbServer, f.dbUser)) {
                    adimlar.girisKorundu = "başka firmada kullanılıyor";
                }
                else {
                    await klonIle("master", (pool) => pool.request().batch(`IF SUSER_ID(${nm(f.dbUser)}) IS NOT NULL DROP LOGIN ${kd(f.dbUser)};`));
                    adimlar.girisSilindi = true;
                }
            }
            // Haftalık yedek dosyası artık gereksiz: son yedek Silinen klasöründe
            const haftalik = path.win32.join(firmalar, `${f.firmaKodu}.bak`);
            try {
                fs.unlinkSync(haftalik);
                adimlar.haftalikYedekSilindi = true;
            }
            catch (err) {
                if (err?.code !== "ENOENT")
                    adimlar.haftalikYedekSilinemedi = err?.code || String(err);
            }
            await BulutSqlRepository.silindiIsaretle(f.firmaId, sahip ? sonYedek : null, boyut, SILINEN_YEDEK_SAKLAMA_GUN);
            await AdminLogSqlRepository.islemLogu({ adminId: null, islem: "FIRMA_DB_SILINDI", hedefTur: "FIRMA", hedefId: f.firmaId, yeni: adimlar });
        }
        catch (err) {
            logger.error(`[SILME] ${f.firmaKodu} silinemedi: ${err?.message}`);
            await AdminLogSqlRepository.islemLogu({
                adminId: null,
                islem: "FIRMA_DB_SILINEMEDI",
                hedefTur: "FIRMA",
                hedefId: f.firmaId,
                yeni: { ...adimlar, hata: String(err?.message || err).slice(0, 500) },
            });
            throw err;
        }
    }
    /** Saklama süresi dolan silinmiş firma yedeklerini diskten kaldırır. */
    static async eskiYedekleriTemizle() {
        let adet = 0;
        for (const y of await BulutSqlRepository.suresiDolanYedekler()) {
            try {
                fs.unlinkSync(y.yedekDosya);
            }
            catch (err) {
                if (err?.code !== "ENOENT") {
                    logger.error(`[SILME] ${y.firmaKodu} eski yedeği silinemedi: ${err?.message}`);
                    continue;
                }
            }
            await BulutSqlRepository.yedekKaydiniTemizle(y.firmaId);
            await AdminLogSqlRepository.islemLogu({
                adminId: null,
                islem: "SILINEN_YEDEK_TEMIZLENDI",
                hedefTur: "FIRMA",
                hedefId: y.firmaId,
                yeni: { dosya: y.yedekDosya },
            });
            adet++;
        }
        return adet;
    }
    /** Gece zamanlayıcısının silme işi: süresi dolanları sil, eski yedekleri temizle. Bir firmadaki hata diğerlerini durdurmaz. */
    static async gunlukIs() {
        let silinenAdet = 0;
        let hatali = 0;
        for (const f of await BulutSqlRepository.suresiDolanSilmeler()) {
            try {
                await this.kaliciSil(f);
                silinenAdet++;
            }
            catch {
                hatali++;
            }
        }
        return { silinen: silinenAdet, hatali, temizlenenYedek: await this.eskiYedekleriTemizle() };
    }
}
