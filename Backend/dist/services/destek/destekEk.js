import fs from "fs";
import path from "path";
import { DestekSqlRepository } from "../../models/admin/destekSql.repository.js";
import { EK_AZAMI_ADET, EK_AZAMI_BAYT, EK_MIME } from "../../types/destek.types.js";
import { ApiError } from "../../utils/ApiError.js";
import { logger } from "../../utils/logger.js";
/**
 * Görsel ekler (K6): JSON içinde base64 gelir, sunucu diskine yazılır (statik sunulmaz; yalnız yetkili uçtan akar).
 * Talep kapanınca dosyalar silinir, satır "silindi" kalır.
 */
export const ekKlasoru = () => process.env.DESTEK_EK_KLASORU || path.resolve(process.cwd(), "destek-ekler");
export class DestekEkService {
    /** Boyut, tür ve adet denetimi; base64 çözümü. Hatalı girişte 400. */
    static dogrula(ekler) {
        if (!ekler || ekler.length === 0)
            return [];
        if (ekler.length > EK_AZAMI_ADET)
            throw ApiError.badRequest(`Bir mesaja en çok ${EK_AZAMI_ADET} görsel eklenebilir.`);
        return ekler.map((e) => {
            const mime = String(e.mime || "").toLowerCase();
            const uzanti = EK_MIME[mime];
            if (!uzanti)
                throw ApiError.badRequest("Yalnız PNG, JPG ve WEBP görselleri eklenebilir.");
            const ham = String(e.veri || "").replace(/^data:[^,]*,/, "");
            const veri = Buffer.from(ham, "base64");
            if (veri.length === 0)
                throw ApiError.badRequest("Görsel verisi boş.");
            if (veri.length > EK_AZAMI_BAYT)
                throw ApiError.badRequest("Görsel en çok 3 MB olabilir.");
            const dosyaAdi = String(e.dosyaAdi || `gorsel.${uzanti}`).replace(/[\\/:*?"<>|]/g, "_").slice(0, 200);
            return { dosyaAdi, mime, uzanti, veri };
        });
    }
    /** Mesaja bağlı ekleri kaydeder (önce satır, sonra dosya; dosya yazılamazsa satır yolsuz kalır ve "silindi" görünür). */
    static async kaydet(konuId, mesajId, ekler) {
        for (const e of ekler) {
            const ekId = await DestekSqlRepository.ekEkle({ konuId, mesajId, dosyaAdi: e.dosyaAdi, mime: e.mime, boyut: e.veri.length });
            try {
                const klasor = path.join(ekKlasoru(), String(konuId));
                fs.mkdirSync(klasor, { recursive: true });
                const yol = path.join(klasor, `${ekId}.${e.uzanti}`);
                fs.writeFileSync(yol, e.veri);
                await DestekSqlRepository.ekYoluYaz(ekId, yol);
            }
            catch (err) {
                logger.error(`[DESTEK] Ek yazılamadı (konu ${konuId}, ek ${ekId}): ${err?.message}`);
            }
        }
    }
    /** Konunun tüm ek dosyalarını siler (talep kapanınca). */
    static async konuEkleriniSil(konuId) {
        const yollar = await DestekSqlRepository.ekleriSilindiYap(konuId);
        for (const yol of yollar) {
            try {
                fs.rmSync(yol, { force: true });
            }
            catch (err) {
                logger.warn(`[DESTEK] Ek silinemedi (${yol}): ${err?.message}`);
            }
        }
        try {
            const klasor = path.join(ekKlasoru(), String(konuId));
            if (fs.existsSync(klasor) && fs.readdirSync(klasor).length === 0)
                fs.rmdirSync(klasor);
        }
        catch {
            /* klasör kalabilir */
        }
    }
    /** Okunacak dosya; silinmiş ya da diskte yoksa 404. */
    static async dosya(ekId) {
        const ek = await DestekSqlRepository.ekGetir(ekId);
        if (!ek || ek.silindi || !ek.yol || !fs.existsSync(ek.yol))
            throw ApiError.notFound("Görsel bulunamadı ya da silinmiş.");
        return { yol: ek.yol, mime: ek.mime, dosyaAdi: ek.dosyaAdi, konuId: ek.konuId };
    }
}
