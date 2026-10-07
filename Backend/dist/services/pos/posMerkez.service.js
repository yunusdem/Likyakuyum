import crypto from "crypto";
import { adminYapilandirildiMi } from "../../config/adminDb.config.js";
import { env } from "../../config/env.config.js";
import { FirmaSqlRepository } from "../../models/admin/firmaSql.repository.js";
import { PosAdminSqlRepository } from "../../models/admin/posAdminSql.repository.js";
import { logger } from "../../utils/logger.js";
import { firmaDbAnahtari } from "../admin/firmaBaglanti.service.js";
const ONBELLEK_MS = 30_000;
const modOnbellegi = new Map();
const imzaAnahtari = () => crypto.createHash("sha256").update(`pos-donus:${env.ADMIN_DB_ENC_KEY}`, "utf8").digest();
export class PosMerkezService {
    /**
     * Firmanın POS modu ve merkezdeki kimliği (K25). Admin veritabanı yapılandırılmamışsa POS_MOD_YEDEK,
     * firma merkezde kayıtlı değilse ya da POS tabloları kurulmamışsa kapalı.
     */
    static async firma(oturum) {
        if (!adminYapilandirildiMi())
            return { mod: env.POS_MOD_YEDEK, firmaId: null };
        const anahtar = oturum.firmaId ? `id:${oturum.firmaId}` : oturum.dbServer && oturum.dbName ? firmaDbAnahtari(oturum.dbServer, oturum.dbName).anahtar : "";
        if (!anahtar)
            return { mod: "kapali", firmaId: null };
        const kayit = modOnbellegi.get(anahtar);
        if (kayit && Date.now() - kayit.zaman < ONBELLEK_MS)
            return { mod: kayit.mod, firmaId: kayit.firmaId };
        let sonuc = { mod: "kapali", firmaId: null };
        try {
            const firmaId = oturum.firmaId ?? (await FirmaSqlRepository.anahtarIleBul(anahtar))?.firmaId ?? null;
            if (firmaId)
                sonuc = { mod: (await PosAdminSqlRepository.firmaModu(firmaId)) ?? "kapali", firmaId };
        }
        catch (err) {
            logger.warn(`[POS] Firma modu okunamadı, kapalı sayıldı: ${err?.message}`);
        }
        modOnbellegi.set(anahtar, { ...sonuc, zaman: Date.now() });
        return sonuc;
    }
    static onbellegiTemizle() {
        modOnbellegi.clear();
    }
    static ayar() {
        return PosAdminSqlRepository.ayarGetir();
    }
    /** Cihaz sonucunun bildirileceği adresin imzası: adres tahmin edilerek başka firmanın işlemi değiştirilemesin. */
    static donusImzasi(firmaId, posIslemId) {
        return crypto.createHmac("sha256", imzaAnahtari()).update(`${firmaId}.${posIslemId}`).digest("hex").slice(0, 40);
    }
    static donusImzasiGecerli(firmaId, posIslemId, imza) {
        const beklenen = Buffer.from(this.donusImzasi(firmaId, posIslemId));
        const gelen = Buffer.from(String(imza || ""));
        return beklenen.length === gelen.length && crypto.timingSafeEqual(beklenen, gelen);
    }
    /** Merkezde dış adres tanımlı değilse ya da firma bilinmiyorsa null (sürücü sonucu yalnızca sorgulayarak öğrenir). */
    static donusAdresi(donusKok, saglayici, firmaId, posIslemId) {
        const kok = (donusKok || "").trim().replace(/\/+$/, "");
        if (!kok || !firmaId)
            return null;
        return `${kok}${env.API_PREFIX}/pos-donus/${saglayici}/${firmaId}/${posIslemId}/${this.donusImzasi(firmaId, posIslemId)}`;
    }
}
