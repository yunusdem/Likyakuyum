import crypto from "node:crypto";
import { ApiError } from "../../utils/ApiError.js";
import { HttpStatus } from "../../constants/httpStatusCodes.js";
import { comparePassword } from "../../utils/password.utils.js";
import { sahteSifreDogrula, sifreDogrula } from "../../utils/sifre.utils.js";
import { KullaniciSqlRepository } from "../../models/admin/kullaniciSql.repository.js";
import { ESKI_SIFRE_ISARETI } from "../../types/admin.types.js";
import { MerkezGirisService } from "../merkezGiris.service.js";
const parmak = (v) => crypto.createHash("sha256").update(v).digest("hex").slice(0, 16);
/** Merkez açık mı (kurulumda hiçbir zaman) — testte değiştirilebilsin diye işlev */
export const merkezAcik = () => MerkezGirisService.aktifMi();
export const GarsonSifre = {
    /**
     * Şifre doğru mu; doğruysa jetona yazılacak "şifre sürümü" (şifre değişince eski garson oturumları düşsün). firmaId 0 = kurulum.
     * Kullanıcı bulunamasa da aynı sürede yanıt verilir (sahte bcrypt), ad tahmini yapılamasın.
     */
    async denetle(firmaId, k, sifre) {
        const s = String(sifre ?? "");
        if (!k || !s) {
            await sahteSifreDogrula(s);
            return { dogru: false };
        }
        if (merkezAcik() && firmaId > 0) {
            const m = await KullaniciSqlRepository.adIleBul(firmaId, k.ad);
            if (!m) {
                await sahteSifreDogrula(s);
                return { dogru: false };
            }
            const dogru = m.sifreHash === ESKI_SIFRE_ISARETI ? (await sahteSifreDogrula(s), !!k.sifre && (await comparePassword(s, k.sifre))) : await sifreDogrula(s, m.sifreHash);
            await KullaniciSqlRepository.girisSonucuYaz(m.kullaniciId, dogru).catch(() => undefined);
            if (!dogru)
                return { dogru: false };
            if (m.durum !== "AKTIF")
                return { dogru: false, hata: new ApiError(HttpStatus.FORBIDDEN, "Kullanıcı hesabınız pasif. Yöneticinizle görüşün.", { kod: "PASIF" }) };
            if (m.sifreDegismeli)
                return { dogru: false, hata: new ApiError(HttpStatus.FORBIDDEN, "Şifreniz geçici. Önce programa normal girişten bir kez girip şifrenizi değiştirin, sonra garson ekranından girin.", { kod: "SIFRE_DEGISMELI" }) };
            return { dogru: true, surum: this.surum(k, m.sifreHash) };
        }
        // Firma veritabanı şifresi: karşılaştırma hızlı (HMAC) — var olan / olmayan kullanıcı aynı sürede yanıtlansın diye sahte bcrypt de çalışır
        await sahteSifreDogrula(s);
        if (!k.sifre || !(await comparePassword(s, k.sifre)))
            return { dogru: false };
        return { dogru: true, surum: this.surum(k, k.sifre) };
    },
    /** Her istekte: kullanıcının güncel şifre sürümü (merkezde hesap yok / pasifse null → oturum düşer) */
    async guncelSurum(firmaId, k) {
        if (merkezAcik() && firmaId > 0) {
            const m = await KullaniciSqlRepository.adIleBul(firmaId, k.ad);
            if (!m || m.durum !== "AKTIF")
                return null;
            return this.surum(k, m.sifreHash);
        }
        return k.sifre ? this.surum(k, k.sifre) : null;
    },
    surum: (k, ozet) => parmak(`${k.kullaniciId}|${k.ad.toLocaleLowerCase("tr-TR")}|${ozet}`),
};
