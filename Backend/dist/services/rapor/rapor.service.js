import { RaporSqlRepository } from "../../models/raporSql.repository.js";
import { EbelgeSqlRepository } from "../../models/ebelgeSql.repository.js";
import { ApiError } from "../../utils/ApiError.js";
import { raporTanimOku, raporPdf } from "./raporMotor.js";
import { raporExcel } from "./raporExcel.js";
import { RAPOR_SORGULARI } from "./raporVeri.js";
export class RaporService {
    static async sablonlar(ctx) {
        const kayitlar = await RaporSqlRepository.sablonlar(ctx);
        return kayitlar.map(k => { const t = guvenliTanim(k.kod); return { ...k, aciklama: t?.aciklama || "", parametreler: t?.parametreler || [] }; });
    }
    static tanim(kod) {
        const t = raporTanimOku(kod.toUpperCase());
        if (!RAPOR_SORGULARI[t.kod])
            throw ApiError.notFound(`Rapor sorgusu tanımlı değil: ${t.kod}`);
        return t;
    }
    static async veri(kod, p, ctx) {
        const tanim = this.tanim(kod);
        const pool = await RaporSqlRepository.pool(ctx);
        const sonuc = await RAPOR_SORGULARI[tanim.kod](pool, p, tanim);
        return { ...sonuc, tanim: kosulUygula(kmtUygula(tanim, p.kmt), p) };
    }
    /** Kayıtlı aramalar (kullanıcı × rapor) */
    static aramalar(kullanici, kod, ctx) { return RaporSqlRepository.aramalar(kullanici, this.tanim(kod).kod, ctx); }
    static aramaKaydet(kullanici, kod, parametreler, ozet, ctx) {
        return RaporSqlRepository.aramaKaydet(kullanici, this.tanim(kod).kod, parametreler, ozet, ctx);
    }
    /** Dürbün seçim listeleri (hesap, istatistik, meslek, sektör, kullanıcı, banka) — yalnızca SELECT */
    static secimListesi(kaynak, ctx) { return RaporSqlRepository.secimListesi(kaynak, ctx); }
    static aramaSil(kullanici, kod, aramaId, ctx) { return RaporSqlRepository.aramaSil(kullanici, this.tanim(kod).kod, aramaId, ctx); }
    static async firma(ctx) {
        const f = await EbelgeSqlRepository.getFirmaBilgisi(ctx).catch(() => ({ vkn: "", unvan: "" }));
        return { ad: f?.unvan || "", vkn: f?.vkn || "" };
    }
    static async pdf(kod, p, kullanici, ctx) {
        const v = await this.veri(kod, p, ctx);
        if (v.sinirAsildi)
            throw ApiError.badRequest(`Rapor ${v.toplamKayit} satır üretiyor; üst sınır ${v.tanim.ustSinir || 5000}. Tarih aralığını daraltın.`);
        const firma = await this.firma(ctx);
        return { pdf: await raporPdf({ tanim: v.tanim, satirlar: v.satirlar, filtreOzeti: v.filtreOzeti, firma, kullanici, ekDipnot: v.ekDipnot, ozetSatirlar: v.ozetSatirlar }), tanim: v.tanim };
    }
    static async excel(kod, p, kullanici, ctx) {
        const v = await this.veri(kod, p, ctx);
        if (v.sinirAsildi)
            throw ApiError.badRequest(`Rapor ${v.toplamKayit} satır üretiyor; üst sınır ${v.tanim.ustSinir || 5000}. Tarih aralığını daraltın.`);
        const firma = await this.firma(ctx);
        return { xlsx: await raporExcel({ tanim: v.tanim, satirlar: v.satirlar, filtreOzeti: v.filtreOzeti, firma, kullanici, ekDipnot: v.ekDipnot, ozetSatirlar: v.ozetSatirlar }), tanim: v.tanim };
    }
}
function guvenliTanim(kod) { try {
    return raporTanimOku(kod);
}
catch {
    return null;
} }
/** Koşullu kolonlar: kurIkisi → yalnızca Kur alanı "Alış + Satış" iken */
function kosulUygula(tanim, p) {
    if (!tanim.kolonlar.some(k => k.kosul) && !tanim.grup?.kosul)
        return tanim;
    const kip = p.birlestir || String(tanim.parametreler.find(x => x.ad === "birlestir")?.varsayilan ?? "");
    return { ...tanim, grup: tanim.grup?.kosul && tanim.grup.kosul !== `kip:${kip}` ? undefined : tanim.grup,
        kolonlar: tanim.kolonlar.filter(k => !k.kosul || (k.kosul === "kurIkisi" ? p.kurAlani === "ikisi" : k.kosul === `kip:${kip}`)) };
}
/** KMT (Kur / Miktar / TL) gösterimi: seçilince yalnızca o gruba ait ve etiketsiz kolonlar kalır (kâr-zarar, .rpt parametresi). */
function kmtUygula(tanim, kmt) {
    const secim = (kmt || "").toUpperCase();
    if (!["K", "M", "T"].includes(secim) || !tanim.kolonlar.some(k => k.kmt))
        return tanim;
    return { ...tanim, kolonlar: tanim.kolonlar.filter(k => !k.kmt || k.kmt === secim) };
}
