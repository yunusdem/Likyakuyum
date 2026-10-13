import { BelgeSqlRepository } from "../../models/belgeSql.repository.js";
import { belgeKlasoruGorseli } from "./belgeMotor.js";
import { etkinSablon } from "./sablonDeposu.js";
import { BelgeGorselService } from "./belgeGorsel.service.js";
import { turBul } from "./belgeTurleri.js";
import { dovizFisVerisi, firmaKimlikOku, perakendeFisVerisi, sarrafFisVerisi, } from "./fisCiktiVeri.js";
const MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg" };
/** Şablondaki resim öğelerinin dosyalarını data URL olarak toplar (yazıcı HTML'i tek parça gider). */
export function sablonGorselleri(sablon) {
    const sonuc = {};
    for (const o of sablon.ogeler) {
        if (o.tip !== "resim" || sonuc[o.dosya])
            continue;
        const bayt = belgeKlasoruGorseli(o.dosya);
        const uzanti = String(o.dosya).split(".").pop()?.toLowerCase() || "";
        if (bayt && MIME[uzanti])
            sonuc[o.dosya] = `data:${MIME[uzanti]};base64,${bayt.toString("base64")}`;
    }
    return sonuc;
}
export class FisCiktiService {
    /** Belge türünün etkin şablonu: firmanın kendi şablonu (geçerliyse), yoksa varsayılan. */
    static async sablon(tur, ctx) {
        return (await etkinSablon(tur, ctx)).sablon;
    }
    static async paketle(tur, veri, ctx) {
        const sablon = await this.sablon(tur, ctx);
        return { tur, sablon, veri, gorseller: { ...sablonGorselleri(sablon), ...(await BelgeGorselService.harita(sablon, ctx)) } };
    }
    /** Döviz fişi: ekran görüntüsü + firma kimliği + (kayıtlıysa) belge no / ETTN. */
    static async doviz(girdi, ctx) {
        const [firmaSatiri, kayit] = await Promise.all([
            BelgeSqlRepository.firmaKimlikSatiri(ctx),
            girdi.fisId ? BelgeSqlRepository.dovizFisKimligi(Number(girdi.fisId), ctx) : Promise.resolve(null),
        ]);
        return this.paketle("DOVIZ_FIS", dovizFisVerisi(girdi, firmaKimlikOku(firmaSatiri), kayit || {}), ctx);
    }
    /** Sarraf fişi: ekran görüntüsü + firma kimliği; kâğıt 80 mm veya A4. */
    static async sarraf(girdi, bicim, ctx) {
        const firma = firmaKimlikOku(await BelgeSqlRepository.firmaKimlikSatiri(ctx));
        return this.paketle(turBul("SARRAF", bicim), sarrafFisVerisi(girdi, firma), ctx);
    }
    /** Perakende fişi / fatura: kayıtlı fatura veya kayıt yükü + firma kimliği; kâğıt 80 mm veya A4. */
    static async perakende(girdi, bicim, ctx) {
        const firma = firmaKimlikOku(await BelgeSqlRepository.firmaKimlikSatiri(ctx));
        return this.paketle(turBul("PERAKENDE", bicim), perakendeFisVerisi(girdi, firma), ctx);
    }
}
