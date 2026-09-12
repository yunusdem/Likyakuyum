import { BelgeSqlRepository } from "../../models/belgeSql.repository.js";
import { EbelgeSqlRepository } from "../../models/ebelgeSql.repository.js";
import { EbelgeKaynakService } from "../ebelgeKaynak.service.js";
import { belgeCiz, sablonOku } from "./belgeMotor.js";
import { fisBelgeVerisi } from "./belgeVeri.js";
import { arsivYolu, arsivle } from "./belgeArsiv.js";
import { ApiError } from "../../utils/ApiError.js";
import { logger } from "../../utils/logger.js";
export class BelgeService {
    static sablonlar(tur, ctx) { return BelgeSqlRepository.sablonlar(tur, ctx); }
    static fisler(f, ctx) { return BelgeSqlRepository.fisler(f, ctx); }
    /**
     * Fişin belge PDF'i.
     * - Fiş ICE'ye gönderilip kabul edilmişse (ETTN + GONDERILDI) resmî PDF ICE'den alınır (karar G2).
     * - Aksi hâlde şablonla üretilir; "ÖNİZLEME" filigranı basılır.
     * `kod` verilmezse fiş tipine göre varsayılan şablon (ALFIS1 / STFIS1) seçilir.
     */
    static async pdf(istek, kullanici, ctx) {
        const b = await BelgeSqlRepository.fisDetay({ fisId: istek.fisId, belgeNo: istek.belgeNo }, ctx);
        const fisTipi = Number(b.FIS_TIPI) === 1 ? 1 : 0;
        const sablon = istek.kod ? await BelgeSqlRepository.sablonBul(istek.kod, ctx) : await BelgeSqlRepository.varsayilanSablon(fisTipi, ctx);
        if (sablon.tur !== "BELGE")
            throw ApiError.badRequest(`${sablon.kod} bir belge şablonu değil.`);
        if (sablon.fisTipi !== null && sablon.fisTipi !== fisTipi) {
            throw ApiError.badRequest(`${sablon.kod} şablonu ${sablon.fisTipi === 1 ? "satış" : "alış"} fişi içindir; bu bir ${fisTipi === 1 ? "satış" : "alış"} fişi.`);
        }
        const belgeNo = String(b.BELGE_NO || "").trim().toUpperCase();
        const ettn = String(b.ETTN || "").trim();
        const tarih = b.TARIH ? new Date(b.TARIH).toISOString() : new Date().toISOString();
        const giden = ettn ? await EbelgeSqlRepository.getGiden(ettn, ctx).catch(() => null) : null;
        const gonderildi = String(giden?.gonderimDurumu || "") === "GONDERILDI";
        if (gonderildi) {
            try {
                const pdf = await EbelgeKaynakService.dovizPdf(ettn, kullanici, ctx);
                return { pdf, belgeNo, sablon, kaynak: "ICE", onizleme: false, tarih };
            }
            catch (e) {
                logger.warn(`Belge: ICE PDF alınamadı (${belgeNo}), şablonla üretiliyor. ${e?.message || e}`);
            }
        }
        const [ayar, firma] = await Promise.all([
            EbelgeSqlRepository.getAyar(ctx).catch(() => null),
            EbelgeSqlRepository.getFirmaBilgisi(ctx).catch(() => ({ dosyaNo: "" })),
        ]);
        const veri = fisBelgeVerisi(b, sablon.kod, { hesapVkn: ayar?.firmaVkn, dosyaNo: firma?.dosyaNo, onizleme: !gonderildi });
        const pdf = await belgeCiz(sablonOku(sablon.duzenDosyasi), veri, `${belgeNo} - ${sablon.ad}`);
        return { pdf, belgeNo, sablon, kaynak: "SABLON", onizleme: !gonderildi, tarih };
    }
    /** PDF'i üretir ve sunucu arşivine yazar (üzerine yazar). */
    static async arsivle(istek, kullanici, ctx) {
        const s = await this.pdf(istek, kullanici, ctx);
        const kok = s.sablon.arsivDizini || (await BelgeSqlRepository.firmaBelgeDizini(ctx));
        const yol = arsivYolu({ kokDizin: kok, dbName: ctx?.dbName, tarih: s.tarih, belgeNo: s.belgeNo });
        const sonuc = arsivle(s.pdf, yol);
        logger.info(`Belge arşivlendi: ${s.belgeNo} → ${yol} (${sonuc.boyut} bayt, ${s.kaynak}${s.onizleme ? ", önizleme" : ""}) [${kullanici}]`);
        return { belgeNo: s.belgeNo, sablon: s.sablon.kod, kaynak: s.kaynak, onizleme: s.onizleme, yol, boyut: sonuc.boyut };
    }
}
