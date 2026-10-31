/**
 * Hızlı Satış hesapları (docs/HIZLI_SATIS_YOL_HARITASI.md, U4–U7). Saf işlevler; ön yüz de içe aktarır. Her modülün hesabı o
 * modülün kendi fiş ekranındaki/sunucusundaki hesapla AYNI tutulur ki ekranda görünen toplam kaydedilen toplamla eşleşsin.
 */
import { ticariFisHesapla, yuvarla2 } from "../ticari/ticariHesap.js";
export { yuvarla2 };
export const yuvarla4 = (n) => Math.round((n + Number.EPSILON) * 10000) / 10000;
/** Ziynet / döviz adetle, diğerleri gramla satılır */
export const adetliMi = (urunTipi) => Number(urunTipi) === 0 || Number(urunTipi) === 3;
/** Milyem 0,916 / 916 / 91,6 biçimlerinden orana (Sarraf fişindeki gibi) */
export const milyemOrani = (m) => {
    const v = Number(m) || 0;
    const r = v > 1 ? (v <= 100 ? v / 100 : v / 1000) : v;
    return Math.round(r * 1e6) / 1e6;
};
export const perakendeSatir = (s) => {
    const k = Number(s.kdvOrani) || 0;
    const haricFiyat = k > 0 ? yuvarla4(s.birimFiyat / (1 + k / 100)) : s.birimFiyat;
    const tutar = yuvarla2((Number(s.miktar) || 0) * haricFiyat);
    const kdvTutari = yuvarla2(tutar * (k / 100));
    return { haricFiyat, tutar, kdvTutari, toplam: yuvarla2(tutar + kdvTutari) };
};
export const sarrafSatir = (s) => {
    const kur = Number(s.birimFiyat) || 0;
    const m = Number(s.miktar) || 0;
    if (adetliMi(s.urunTipi))
        return { hasGram: 0, iscilikHasGram: 0, tutar: yuvarla2(m * kur) };
    const oran = milyemOrani(s.ek?.milyem);
    const hasGram = oran > 0 ? yuvarla4(m * oran) : m;
    const iscilikHasGram = (Number(s.ek?.iscilik) || 0) > 0 ? yuvarla4(m * Number(s.ek?.iscilik)) : 0;
    return { hasGram, iscilikHasGram, tutar: yuvarla2((hasGram + iscilikHasGram) * kur) };
};
export const dovizSatir = (s, tip, kmvSekli) => {
    const brut = (Number(s.miktar) || 0) > 0 ? yuvarla2(Number(s.miktar) * (Number(s.birimFiyat) || 0)) : 0;
    const kom = Number(s.ek?.komisyonOrani) || 0;
    const komisyon = kom > 0 && brut > 0 ? yuvarla2(brut * (kom / 100)) : 0;
    if (tip === 0)
        return { tutar: brut, bmv: 0, kmv: 0, komisyon };
    const bmvO = Number(s.ek?.bmvOrani) || 0;
    const kmvO = Number(s.ek?.kmvOrani) || 0;
    const bmv = bmvO > 0 && brut > 0 ? yuvarla2(brut * (bmvO / 100)) : 0;
    const carpan = kmvO >= 1 && kmvO <= 10 ? kmvO / 1000 : kmvO / 100;
    const kmv = kmvSekli !== 1 && kmvO > 0 && brut > 0 ? yuvarla2(brut * carpan) : 0;
    return { tutar: brut, bmv, kmv, komisyon };
};
/**
 * Döviz satırına istatistikten oran (DovizFisiPage handleSelectCurrency ile aynı): satışta KMV istatistikte 0 ise BMV oranı,
 * o da yoksa binde 2; bu durumda BMV temizlenir. Alışta yalnız komisyon.
 */
export const dovizOranlari = (ist, tip, kmvSekli) => {
    let bmv = Number(ist?.bmvOrani) > 0 ? Number(ist?.bmvOrani) : 0;
    const hamKmv = Number(ist?.kmvOrani) > 0 ? Number(ist?.kmvOrani) : 0;
    let kmv = kmvSekli !== 1 ? (hamKmv > 0 ? hamKmv : tip === 1 ? (bmv > 0 ? bmv : 0.2) : 0) : 0;
    if (tip === 1 && kmvSekli !== 1 && hamKmv === 0 && bmv > 0)
        bmv = 0;
    if (tip === 0) {
        bmv = 0;
        kmv = 0;
    }
    const komisyon = Number(ist?.komisyonOrani) > 0 ? Number(ist?.komisyonOrani) : 0;
    return { bmvOrani: bmv, kmvOrani: kmv, komisyonOrani: komisyon };
};
/** Fiş iskontosu tutarı: yüzde ya da tutar, tanımın en çok / en az sınırlarıyla; toplamı aşamaz */
export function indirimTutari(brut, ind) {
    if (!ind || !(ind.deger > 0) || !(brut > 0))
        return 0;
    if ((Number(ind.enAz) || 0) > 0 && brut < Number(ind.enAz))
        return 0;
    let t = ind.turu === 1 ? yuvarla2(brut * (Math.min(ind.deger, 100) / 100)) : yuvarla2(ind.deger);
    if ((Number(ind.azami) || 0) > 0)
        t = Math.min(t, yuvarla2(Number(ind.azami)));
    return Math.min(t, brut);
}
/** Sunucuya gidecek iskonto: sınır devreye girdiyse yüzde yerine tutar (Ticari ticariFisHesapla yalnız tür + değer bilir) */
export function etkinIndirim(brut, ind) {
    const t = indirimTutari(brut, ind);
    if (!ind || !(t > 0))
        return null;
    if (ind.turu === 1 && yuvarla2(brut * (Math.min(ind.deger, 100) / 100)) === t)
        return { turu: 1, deger: ind.deger };
    return { turu: 2, deger: t };
}
export function sepetHesapla(modul, satirlar, secenek = {}) {
    const tip = secenek.tip ?? 1;
    const bos = { satirTutarlari: [], araToplam: 0, kdv: 0, indirim: 0, masraf: 0, genelToplam: 0, hasToplam: 0 };
    if (!satirlar.length)
        return bos;
    if (modul === "perakende") {
        const r = satirlar.map(perakendeSatir);
        const ara = yuvarla2(r.reduce((a, x) => a + x.tutar, 0));
        const kdv = yuvarla2(r.reduce((a, x) => a + x.kdvTutari, 0));
        const brut = yuvarla2(ara + kdv);
        const indirim = indirimTutari(brut, secenek.indirim);
        return { ...bos, satirTutarlari: r.map((x) => x.toplam), araToplam: ara, kdv, indirim, genelToplam: Math.max(0, yuvarla2(brut - indirim)) };
    }
    if (modul === "ticari") {
        const girdi = satirlar.map((s) => ({ miktar: s.miktar, kdvDahilFiyat: s.birimFiyat, kdvOrani: s.kdvOrani, iskontoTuru: (s.ek?.kampanya?.turu ?? 0), iskontoDegeri: s.ek?.kampanya?.deger ?? null }));
        const brut = ticariFisHesapla(girdi, null).genelToplam;
        const h = ticariFisHesapla(girdi, etkinIndirim(brut, secenek.indirim));
        return {
            ...bos,
            // Satır tutarı Satış Fişi'ndeki gibi matrah + KDV (kampanya / satır iskontosu düşülmüş); satırların toplamı genel toplama eşittir
            satirTutarlari: h.satirlar.map((x) => x.toplamTutar),
            araToplam: h.araToplam,
            kdv: h.toplamKdv,
            indirim: h.baslikIskontoDahil,
            genelToplam: h.genelToplam,
        };
    }
    if (modul === "sarraf") {
        const r = satirlar.map(sarrafSatir);
        const toplam = yuvarla2(r.reduce((a, x) => a + x.tutar, 0));
        // Sarraf iskontosu fişte ödeme satırıdır (SarrafFisiPage): fiş tutarı aynı kalır, müşterinin ödeyeceği azalır
        const indirim = tip === 1 ? indirimTutari(toplam, secenek.indirim) : 0;
        return { ...bos, satirTutarlari: r.map((x) => x.tutar), araToplam: toplam, indirim, genelToplam: yuvarla2(toplam - indirim), hasToplam: yuvarla4(r.reduce((a, x) => a + x.hasGram + x.iscilikHasGram, 0)) };
    }
    // döviz
    const sekil = secenek.kmvSekli ?? 3;
    const r = satirlar.map((s) => dovizSatir(s, tip, sekil));
    const toplam = yuvarla2(r.reduce((a, x) => a + x.tutar, 0));
    const masraf = tip === 0
        ? yuvarla2(r.reduce((a, x) => a + x.komisyon, 0))
        : yuvarla2(r.reduce((a, x) => a + x.bmv + (sekil === 3 ? x.kmv : 0) + x.komisyon, 0));
    return { ...bos, satirTutarlari: r.map((x) => x.tutar), araToplam: toplam, masraf, genelToplam: tip === 0 ? yuvarla2(toplam - masraf) : yuvarla2(toplam + masraf) };
}
export const ODEME_ADI = { 0: "Nakit", 1: "Cari", 2: "POS", 3: "Banka" };
/** Döviz fişinde ödeme modeli yok: yalnız nakit ya da banka (U7) */
export const MODUL_ODEMELERI = {
    perakende: [0, 2, 1, 3],
    ticari: [0, 2, 1, 3],
    sarraf: [0, 2, 1, 3],
    doviz: [0, 3],
};
/**
 * Para üstü yalnız nakitten verilir: nakit dışı ödemeler toplamı aşamaz. Kalan ≤ 0,01 ise satış tamamlanabilir.
 */
export function odemeDurumu(genelToplam, odemeler) {
    const odenen = yuvarla2(odemeler.reduce((a, o) => a + (Number(o.tutar) || 0), 0));
    const nakitDisi = yuvarla2(odemeler.filter((o) => o.tur !== 0).reduce((a, o) => a + (Number(o.tutar) || 0), 0));
    const fark = yuvarla2(genelToplam - odenen);
    return {
        odenen,
        kalan: fark > 0 ? fark : 0,
        paraUstu: fark < 0 ? yuvarla2(-fark) : 0,
        fazlaOdeme: nakitDisi - genelToplam > 0.01,
    };
}
/**
 * Kayda giden ödemeler: para üstü nakitten düşülür (nakit satırları sondan kısılır), sıfırlananlar atılır.
 * Böylece kaydedilen ödeme toplamı fiş toplamına eşit olur.
 */
export function kayitOdemeleri(genelToplam, odemeler) {
    let fazla = yuvarla2(odemeler.reduce((a, o) => a + (Number(o.tutar) || 0), 0) - genelToplam);
    const sonuc = odemeler.map((o) => ({ ...o, tutar: yuvarla2(Number(o.tutar) || 0) }));
    for (let i = sonuc.length - 1; i >= 0 && fazla > 0.004; i--) {
        if (sonuc[i].tur !== 0)
            continue;
        const d = Math.min(sonuc[i].tutar, fazla);
        sonuc[i].tutar = yuvarla2(sonuc[i].tutar - d);
        fazla = yuvarla2(fazla - d);
    }
    return sonuc.filter((o) => o.tutar > 0);
}
/** Günlük tablo üstüne anlık tablo: anlıkta pozitif değer varsa o geçerli (fiş ekranları gibi) */
export function kurlariBirlestir(gunluk, anlik) {
    const anahtar = (k) => (k.kod || "").trim().toLocaleUpperCase("tr-TR") || `ID_${k.paraId}`;
    const m = new Map();
    for (const k of gunluk)
        m.set(anahtar(k), { ...k });
    for (const k of anlik) {
        const o = m.get(anahtar(k));
        if (!o) {
            m.set(anahtar(k), { ...k });
            continue;
        }
        const sec = (a, b) => (Number(a) > 0 ? a : b);
        m.set(anahtar(k), { ...o, dovizAlis: sec(k.dovizAlis, o.dovizAlis), dovizSatis: sec(k.dovizSatis, o.dovizSatis), efektifAlis: sec(k.efektifAlis, o.efektifAlis), efektifSatis: sec(k.efektifSatis, o.efektifSatis) });
    }
    return [...m.values()];
}
const oran = (k, tip) => {
    if (!k)
        return 0;
    const v = tip === 1
        ? (Number(k.efektifSatis) > 0 ? k.efektifSatis : Number(k.dovizSatis) > 0 ? k.dovizSatis : 0)
        : (Number(k.efektifAlis) > 0 ? k.efektifAlis : Number(k.dovizAlis) > 0 ? k.dovizAlis : 0);
    return Number(v) || 0;
};
const HAS_KODLARI = ["HAS", "ALTIN", "HAS ALTIN", "HASALTIN"];
const GUMUS_KODLARI = ["GUMUS", "GÜMÜŞ", "HAS GÜMÜŞ", "HAS GUMUS", "GMS"];
/**
 * Ürünün birim kuru. tip 1 satış (efektif satış → döviz satış), 0 alış. Kendi kur satırı yoksa: altın → HAS kuru,
 * gümüş → gümüş kuru, ziynet / döviz → 0 (fiyat bilinmiyor; ekran sorar).
 */
export function urunKuru(kurlar, urun, tip) {
    const kod = String(urun.kod ?? "").trim().toLocaleUpperCase("tr-TR");
    if (["TL", "TRY", "TRL"].includes(kod))
        return 1;
    const kendi = kurlar.find((k) => (urun.paraId && k.paraId === urun.paraId) || (kod && (k.kod || "").trim().toLocaleUpperCase("tr-TR") === kod));
    const r = oran(kendi, tip);
    if (r > 0)
        return r;
    const t = Number(urun.urunTipi);
    const bul = (liste) => kurlar.find((k) => liste.includes((k.kod || "").trim().toLocaleUpperCase("tr-TR")));
    if (t === 1)
        return oran(bul(HAS_KODLARI), tip);
    if (t === 2)
        return oran(bul(GUMUS_KODLARI), tip);
    return 0;
}
// ───────────── MASAK sınırı (fiş ekranlarındaki isMasakLimitExceeded ile aynı, H14) ─────────────
export const MASAK_TL_SINIRI = 185000;
export const MASAK_USD_SINIRI = 5000;
/**
 * Perakende: genel toplam ≥ 185.000 TL. Sarraf: toplam ya da has × has kuru ≥ 185.000 TL ya da tek USD satırı ≥ 5.000.
 * Döviz: tek USD satırı ≥ 5.000, USD karşılığı toplamı ≥ 5.000 ya da TL toplamı ≥ 185.000. Ticari: yok.
 * Gayri resmi istatistikte (fisDizaynTipi 1) hiç uygulanmaz.
 */
export function masakGerekli(modul, sepet, toplam, o = {}) {
    if (o.gayriResmi || modul === "ticari")
        return false;
    const tlLimit = o.tlSiniri && o.tlSiniri > 0 ? o.tlSiniri : MASAK_TL_SINIRI;
    const dovizLimit = o.dovizSiniri && o.dovizSiniri > 0 ? o.dovizSiniri : MASAK_USD_SINIRI;
    const altinLimit = o.altinSiniri && o.altinSiniri > 0 ? o.altinSiniri : tlLimit;
    const isGoldRow = (kod) => {
        const u = (kod || "").trim().toUpperCase();
        return ["HAS", "CEYREK", "YARIM", "TAM", "ATA", "GREMSE", "22AYAR", "14AYAR", "18AYAR", "24AYAR", "ALTIN", "ZIYNET"].includes(u) || u.includes("ALTIN");
    };
    const isDovizRow = (kod) => {
        const u = (kod || "").trim().toUpperCase();
        return ["USD", "$", "EUR", "€", "GBP", "£", "CHF"].includes(u);
    };
    const hasGold = toplam.hasToplam > 0 || sepet.some((s) => isGoldRow(String(s.kod ?? "")));
    const hasDoviz = sepet.some((s) => isDovizRow(String(s.kod ?? "")));
    if (modul === "sarraf") {
        const altinTl = toplam.hasToplam > 0 ? (Number(o.hasKuru) || 0) * toplam.hasToplam : toplam.genelToplam;
        const altinAsti = hasGold && altinTl >= altinLimit;
        const dovizAsti = hasDoviz && sepet.some((s) => isDovizRow(String(s.kod ?? "")) && Number(s.miktar) >= dovizLimit);
        const tlAsti = !hasGold && !hasDoviz && (toplam.genelToplam >= tlLimit || toplam.araToplam >= tlLimit);
        return altinAsti || dovizAsti || tlAsti;
    }
    if (modul === "perakende") {
        const altinTl = toplam.hasToplam > 0 ? (Number(o.hasKuru) || 0) * toplam.hasToplam : (hasGold ? toplam.genelToplam : 0);
        const altinAsti = hasGold && altinTl >= altinLimit;
        const dovizAsti = hasDoviz && sepet.some((s) => isDovizRow(String(s.kod ?? "")) && Number(s.miktar) >= dovizLimit);
        const tlAsti = !hasGold && !hasDoviz && (toplam.genelToplam >= tlLimit || toplam.araToplam >= tlLimit);
        return altinAsti || dovizAsti || tlAsti;
    }
    // Döviz modülü
    const dovizDirect = sepet.some((s) => isDovizRow(String(s.kod ?? "")) && Number(s.miktar) >= dovizLimit);
    const usdKuru = Number(o.usdKuru) || 0;
    const usdKarsiligi = (!hasGold && usdKuru > 0) ? toplam.araToplam / usdKuru : 0;
    const dovizAsti = hasDoviz && (dovizDirect || usdKarsiligi >= dovizLimit);
    const altinTl = hasGold ? ((Number(o.hasKuru) || 0) * (toplam.hasToplam || 0) || toplam.genelToplam) : 0;
    const altinAsti = hasGold && altinTl >= altinLimit;
    const tlAsti = !hasGold && !hasDoviz && (toplam.genelToplam >= tlLimit || toplam.araToplam >= tlLimit);
    return altinAsti || dovizAsti || tlAsti;
}
