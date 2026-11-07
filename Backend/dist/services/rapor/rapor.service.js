import { RaporSqlRepository } from "../../models/raporSql.repository.js";
import { VezneBakiyeDuzeltmeSqlRepository } from "../../models/vezneBakiyeDuzeltmeSql.repository.js";
import { logger } from "../../utils/logger.js";
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
    /** Ekrana giden tanım: `secenekKaynagi` olan seçim parametrelerinin seçenekleri veritabanından doldurulur (ilk seçenek "Tümü") */
    static async tanimSecenekli(kod, ctx, acikModuller) {
        const t = lisansSecenekleri(this.tanim(kod), acikModuller);
        if (!t.parametreler.some(p => p.secenekKaynagi))
            return t;
        const parametreler = await Promise.all(t.parametreler.map(async (p) => {
            if (!p.secenekKaynagi)
                return p;
            const degerler = await RaporSqlRepository.secenekListesi(p.secenekKaynagi, ctx).catch(() => []);
            return { ...p, secenekler: [{ deger: "", ad: "Tümü" }, ...degerler.map(d => ({ deger: d, ad: d }))] };
        }));
        return { ...t, parametreler };
    }
    static async veri(kod, p, ctx) {
        const tanim = this.tanim(kod);
        const pool = await RaporSqlRepository.pool(ctx);
        // Vezne bakiye düzeltme tablosu ilk raporda kurulur ve açılış farkı bir kez yazılır (anlık bakiye = belgeler); hata raporu durdurmaz
        await VezneBakiyeDuzeltmeSqlRepository.ensure(pool, `${ctx?.dbServer || ""}|${ctx?.dbName || ""}`)
            .catch((e) => logger.warn("Vezne bakiye düzeltme tablosu kurulamadı:", e?.message || e));
        p = ekVarsayilanlari(tanim, p);
        const sonuc = await RAPOR_SORGULARI[tanim.kod](pool, p, tanim);
        return { ...sonuc, tanim: sorguDuzeltmesi(kosulUygula(kmtUygula(tanim, p.kmt), p), sonuc) };
    }
    /** Tanımdaki ek parametre adları (sabit şemada olmayanlar denetleyicide `p.ek`e alınır): aralık tipleri iki ad üretir */
    static ekParametreAdlari(kod) {
        const adlar = [];
        for (const prm of this.tanim(kod).parametreler) {
            if (prm.tip === "metinAralik")
                adlar.push(`${prm.ad}Ilk`, `${prm.ad}Son`);
            else if (prm.tip === "sayiAralik")
                adlar.push(`${prm.ad}Alt`, `${prm.ad}Ust`);
            else if (["onay", "secim", "metin", "sayi", "tarih"].includes(prm.tip))
                adlar.push(prm.ad);
        }
        return adlar;
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
        return { pdf: await raporPdf({ tanim: v.tanim, satirlar: v.satirlar, filtreOzeti: v.filtreOzeti, firma, kullanici, ekDipnot: v.ekDipnot, ozetSatirlar: v.ozetSatirlar,
                gruplar: v.gruplar, grupAltSatirlar: v.grupAltSatirlar }), tanim: v.tanim };
    }
    static async excel(kod, p, kullanici, ctx) {
        const v = await this.veri(kod, p, ctx);
        if (v.sinirAsildi)
            throw ApiError.badRequest(`Rapor ${v.toplamKayit} satır üretiyor; üst sınır ${v.tanim.ustSinir || 5000}. Tarih aralığını daraltın.`);
        const firma = await this.firma(ctx);
        return { xlsx: await raporExcel({ tanim: v.tanim, satirlar: v.satirlar, filtreOzeti: v.filtreOzeti, firma, kullanici, ekDipnot: v.ekDipnot, ozetSatirlar: v.ozetSatirlar,
                gruplar: v.gruplar, grupAltSatirlar: v.grupAltSatirlar }), tanim: v.tanim };
    }
}
function guvenliTanim(kod) { try {
    return raporTanimOku(kod);
}
catch {
    return null;
} }
/** Lisansa göre seçenekler: `modul` taşıyan seçenek yalnız o modül açıksa kalır (null = kısıt yok). "ticari" = ticari modüllerinden biri. */
export function lisansSecenekleri(tanim, moduller) {
    if (moduller == null || !tanim.parametreler.some(p => p.secenekler?.some(o => o.modul)))
        return tanim;
    const acik = (m) => (m === "ticari" ? moduller.some(x => x === "ticari" || x.startsWith("ticari:")) : moduller.includes(m));
    return { ...tanim, parametreler: tanim.parametreler.map(p => (p.secenekler?.some(o => o.modul) ? { ...p, secenekler: p.secenekler.filter(o => !o.modul || acik(o.modul)) } : p)) };
}
/** Parametrenin geçerli değeri (metin): ek parametre → sabit parametre → tanımdaki varsayılan (seçimde ilk seçenek) */
export function parametreDegeri(tanim, p, ad) {
    const v = p.ek?.[ad] ?? p[ad];
    if (v !== undefined && v !== null && v !== "")
        return String(v);
    const prm = tanim.parametreler.find(x => x.ad === ad);
    return String(prm?.varsayilan ?? (prm?.tip === "secim" ? prm.secenekler?.[0]?.deger ?? "" : ""));
}
/**
 * Koşul sağlanıyor mu: "kurIkisi" → Kur alanı "Alış + Satış"; "kip:<d>" → `birlestir` = d; "p:<ad>=<d1>|<d2>" / "p:<ad>!=<d>" → parametre değeri listede (değil).
 * Onay kutusu için işaretsiz değer "" → "p:saatGizle!=1" işaretsizken sağlanır.
 */
export function kosulSaglandi(kosul, tanim, p) {
    if (!kosul)
        return true;
    if (kosul === "kurIkisi")
        return p.kurAlani === "ikisi";
    if (kosul.startsWith("kip:"))
        return parametreDegeri(tanim, p, "birlestir") === kosul.slice(4);
    const m = /^p:(\w+)(!=|=)(.*)$/.exec(kosul);
    if (!m)
        return true;
    const icinde = m[3].split("|").includes(parametreDegeri(tanim, p, m[1]));
    return m[2] === "=" ? icinde : !icinde;
}
/** Koşullu kolonlar, gruplar ve alt tablolar (ana tablo + özet): koşulu sağlanmayanlar tanımdan düşer */
function kosulUygula(tanim, p) {
    const ok = (k) => kosulSaglandi(k, tanim, p);
    return { ...tanim,
        kolonlar: tanim.kolonlar.filter(k => ok(k.kosul)),
        grup: tanim.grup && ok(tanim.grup.kosul) ? tanim.grup : undefined,
        ...(tanim.gruplar ? { gruplar: tanim.gruplar.filter(x => ok(x.kosul)) } : {}),
        altTablo: tanim.altTablo && ok(tanim.altTablo.kosul) ? { ...tanim.altTablo, kolonlar: tanim.altTablo.kolonlar.filter(k => ok(k.kosul)) } : undefined,
        grupAltTablo: tanim.grupAltTablo && ok(tanim.grupAltTablo.kosul) ? { ...tanim.grupAltTablo, kolonlar: tanim.grupAltTablo.kolonlar.filter(k => ok(k.kosul)) } : undefined,
        ...(tanim.ozet ? { ozet: { ...tanim.ozet, kolonlar: tanim.ozet.kolonlar.filter(k => ok(k.kosul)) } } : {}) };
}
/** Ek parametrelerin tanımdaki varsayılanları (istekte hiç gelmediyse): ekranın başlangıç değerleriyle aynı kural */
function ekVarsayilanlari(tanim, p) {
    const ekler = { ...(p.ek || {}) };
    for (const prm of tanim.parametreler) {
        if (!["onay", "secim", "metin", "sayi"].includes(prm.tip) || ekler[prm.ad] !== undefined || p[prm.ad] !== undefined)
            continue;
        const v = prm.varsayilan ?? (prm.tip === "secim" ? prm.secenekler?.[0]?.deger : undefined);
        if (v !== undefined && v !== null && v !== "")
            ekler[prm.ad] = String(v);
    }
    return { ...p, ek: ekler };
}
/** Sorgunun çalıştırmaya göre bildirdiği kolon başlıkları ve kaldırılan kolonlar (ana tablo + özet): karşılık parası seçimi gibi */
function sorguDuzeltmesi(tanim, s) {
    if (!s.kolonBasliklari && !s.kolonCikar?.length)
        return tanim;
    const cikar = new Set(s.kolonCikar || []);
    const duzelt = (ks) => ks.filter(k => !cikar.has(k.anahtar)).map(k => (s.kolonBasliklari?.[k.anahtar] ? { ...k, baslik: s.kolonBasliklari[k.anahtar] } : k));
    return { ...tanim, kolonlar: duzelt(tanim.kolonlar), ...(tanim.ozet ? { ozet: { ...tanim.ozet, kolonlar: duzelt(tanim.ozet.kolonlar) } } : {}) };
}
/** KMT (Kur / Miktar / TL) gösterimi: seçilince yalnızca o gruba ait ve etiketsiz kolonlar kalır (kâr-zarar, .rpt parametresi). */
function kmtUygula(tanim, kmt) {
    const secim = (kmt || "").toUpperCase();
    if (!["K", "M", "T"].includes(secim) || !tanim.kolonlar.some(k => k.kmt))
        return tanim;
    return { ...tanim, kolonlar: tanim.kolonlar.filter(k => !k.kmt || k.kmt === secim) };
}
