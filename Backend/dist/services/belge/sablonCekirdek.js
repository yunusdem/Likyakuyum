/**
 * Belge şablon çekirdeği — saf mantık, hiçbir modül içe aktarmaz.
 *
 * Aynı dosya hem sunucuda (PDF: `belgeMotor.ts`) hem tarayıcıda (termal yazıcı HTML'i:
 * `src/utils/belgeSablon/htmlCiz.ts`) kullanılır; böylece yazıcı, önizleme ve PDF aynı
 * yerleşimi çizer (docs/FIS_TASARIM_YOL_HARITASI.md, 4.1).
 *
 * Akış: şablon + veri → `sahneKur` → düz çizim listesi (metin, çizgi, kutu, resim, qr, filigran).
 * Koordinatlar punto (pt), kenar boşluğu sonrası sol-üst köşeden.
 *
 * Kayma kuralı (Crystal'daki "büyüyebilir" gibi): içeriğe göre uzayan öğe (liste, tablo, satırlar)
 * kendi altındaki öğeleri aşağı iter, onu içine alan kutuyu uzatır. Kısalma (gizli satır, koşulu
 * tutmayan öğe) yalnızca öğede `daralt: true` varsa yukarı çeker; yan yana düzenlerde üst üste
 * binme olmasın diye varsayılan kapalıdır.
 */
/** Firma görselinin çizimdeki anahtarı (görsel haritası / çözücü bu anahtarla arar). */
export const firmaGorselAnahtari = (ad) => `firma:${ad}`;
/** Bu genişlikten dar kâğıt termal rulodur (firma görselleri siyah-beyaz basılır). */
export const RULO_SINIRI = 300;
/** Satır yüksekliği = yazı boyutu × bu oran (Arial’in PDF satır yüksekliği; HTML de aynı değeri kullanır). */
export const SATIR_ORANI = 1.15;
export const KAGITLAR = { A4: [595.28, 841.89], A5: [419.53, 595.28] };
/** 80 mm termal rulo genişliği (punto). */
export const RULO_80 = 226.77;
// ── Yer tutucular ───────────────────────────────────────────────────────────
const trSayi = (n, basamak, enAz = basamak) => Number(n || 0).toLocaleString("tr-TR", { minimumFractionDigits: enAz, maximumFractionDigits: basamak });
export function alanOku(veri, yol) {
    return yol.split(".").reduce((o, k) => (o == null ? undefined : o[k]), veri);
}
const basamak = (veri, ad, varsayilan) => {
    const n = Number(alanOku(veri, `basamak.${ad}`));
    return Number.isInteger(n) && n >= 0 && n <= 8 ? n : varsayilan;
};
/**
 * `{{yol.alt|bicim}}` yer tutucularını veriden doldurur.
 * Biçimler: sayi (2 hane), sayi4, sayi:N, kur (2–5 hane), buyuk,
 * doviz / kurb / tl (firma kuruş ayarı: `basamak.doviz|kur|tl`).
 */
function bicimle(deger, veri, bicim, hane) {
    switch (bicim) {
        case "sayi": return trSayi(Number(deger), hane !== undefined ? Number(hane) : 2);
        case "sayi4": return trSayi(Number(deger), 4);
        // Kur: ICE çıktısındaki gibi en az 2, en çok 5 hane (0,02062).
        case "kur": return trSayi(Number(deger), 5, 2);
        case "doviz": return trSayi(Number(deger), basamak(veri, "doviz", 2));
        case "kurb": return trSayi(Number(deger), basamak(veri, "kur", 4));
        case "tl": return trSayi(Number(deger), basamak(veri, "tl", 2));
        case "buyuk": return String(deger).toLocaleUpperCase("tr-TR");
        default: return String(deger);
    }
}
/** Hesap terimi: alan yolu ya da sayı ("0.20", "0,20", "-5") */
export const HESAP_TERIMI = /^(-?\d+(?:[.,]\d+)?|[A-Za-z_][\w.]*)$/;
export const HESAP_ISLEMLERI = ["+", "-", "*", "/"];
/** `{{= a işlem b | biçim}}` — iki terimli hesap (bölüm 11, K13). */
export const HESAP_DESENI = /\{\{\s*=\s*([^\s|}+*/]+|-\d[^\s|}+*/]*)\s*([+\-*/])\s*([^\s|}+*/]+|-\d[^\s|}+*/]*)\s*(?:\|\s*(\w+)(?::(\d))?)?\s*\}\}/g;
function terimDegeri(t, veri) {
    if (/^-?\d+(?:[.,]\d+)?$/.test(t))
        return Number(t.replace(",", "."));
    const v = Number(alanOku(veri, t));
    return Number.isFinite(v) ? v : null;
}
/** Hesabın sayısal sonucu; terim okunamazsa ya da sıfıra bölmede null. */
export function hesapla(a, islem, b, veri) {
    const x = terimDegeri(a, veri), y = terimDegeri(b, veri);
    if (x === null || y === null)
        return null;
    switch (islem) {
        case "+": return x + y;
        case "-": return x - y;
        case "*": return x * y;
        case "/": return y === 0 ? null : x / y;
        default: return null;
    }
}
/**
 * `{{yol.alt|bicim}}` yer tutucularını veriden doldurur; `{{= a işlem b | biçim}}` hesabı yapılır.
 * Biçimler: sayi (2 hane), sayi4, sayi:N, kur (2–5 hane), buyuk,
 * doviz / kurb / tl (firma kuruş ayarı: `basamak.doviz|kur|tl`). Hesapta biçim yoksa 2 haneli sayı.
 */
export function doldur(metin, veri) {
    return String(metin ?? "")
        .replace(HESAP_DESENI, (_m, a, islem, b, bicim, hane) => {
        const sonuc = hesapla(a, islem, b, veri);
        return sonuc === null ? "" : bicimle(sonuc, veri, bicim || "sayi", hane);
    })
        .replace(/\{\{\s*([\w.]+)\s*(?:\|\s*(\w+)(?::(\d))?)?\s*\}\}/g, (_m, yol, bicim, hane) => {
        const deger = alanOku(veri, yol);
        if (deger === undefined || deger === null || deger === false)
            return "";
        return bicimle(deger, veri, bicim, hane);
    });
}
export const yerTutucuVar = (m) => /\{\{[^}]+\}\}/.test(m);
/**
 * Satırın değerindeki bir yer tutucu veride açıkça `null` ise satır "yok" sayılır ve basılmaz (koşul yazılmasa bile).
 * Veri katmanı bunu, belgede anlamı olmayan bilgi için kullanır: ör. alış fişinde `toplam.kmv` null'dur, firma şablonunda
 * koşulsuz bir KMV satırı olsa da alışta çıkmaz. Olmayan (undefined) alan yine boş basılır, satır gizlenmez.
 */
export function satirYok(deger, veri) {
    let yok = false;
    String(deger ?? "").replace(/\{\{\s*([\w.]+)\s*(?:\|[^}]*)?\}\}/g, (m, yol) => { if (alanOku(veri, yol) === null)
        yok = true; return m; });
    return yok;
}
/** Koşul: doldurulunca boş, "0", "false" ise tutmaz; `!` ile başlarsa tersi. */
export function kosulGecti(kosul, veri) {
    if (!kosul || !String(kosul).trim())
        return true;
    const k = String(kosul).trim();
    const ters = k.startsWith("!");
    const d = doldur(ters ? k.slice(1) : k, veri).trim();
    const dolu = d !== "" && d !== "0" && d !== "false";
    return ters ? !dolu : dolu;
}
/** İsteğe bağlı satır (`?` ile başlar): içindeki yer tutucuların hepsi boşsa basılmaz. */
export function istegeBagliSatir(ham, veri) {
    if (!ham.startsWith("?"))
        return doldur(ham, veri);
    const kaynak = ham.slice(1);
    const dolu = doldur(kaynak, veri);
    if (yerTutucuVar(kaynak) && dolu.replace(/\*\*/g, "").trim() === kaynak.replace(/\{\{[^}]+\}\}/g, "").replace(/\*\*/g, "").trim())
        return null;
    return dolu;
}
export function satirAc(s) {
    if (Array.isArray(s))
        return { etiket: String(s[0] ?? ""), deger: String(s[1] ?? ""), kalin: !!s[2] };
    return { etiket: String(s?.etiket ?? ""), deger: String(s?.deger ?? ""), kalin: !!s?.kalin, kosul: s?.kosul };
}
// ── Yerleşim ────────────────────────────────────────────────────────────────
export function kagitOlcusu(sablon) {
    const k = sablon.kagit;
    if (Array.isArray(k))
        return [Number(k[0]) || RULO_80, Number(k[1]) || 0];
    return [...(KAGITLAR[k === "A5" ? "A5" : "A4"])];
}
/** Öğenin şablondaki üst kenarı ve tam içerikli (nominal) yüksekliği. */
export function ogeKutusu(o, varsayilanBoyut) {
    const boyut = o.boyut ?? varsayilanBoyut;
    switch (o.tip) {
        case "metin": return { ust: o.y, h: boyut * SATIR_ORANI };
        case "satirlar": return { ust: o.y, h: o.satirlar.length * (boyut * SATIR_ORANI + (o.aralik ?? 2)) };
        case "tablo": return { ust: o.y, h: o.satirlar.length * (o.satirH ?? 15) };
        case "liste": return { ust: o.y, h: Array.isArray(o.sutunlar) && o.sutunlar.length
                ? (o.baslikSatiri ? 2 : 1) * (o.satirH ?? 15)
                : Math.max(1, (o.satirlar || []).length) * (o.satirH ?? 15) };
        case "kutu": return { ust: o.y, h: o.h };
        case "cizgi": return { ust: Math.min(o.y1, o.y2), h: Math.abs(o.y2 - o.y1) };
        case "resim":
        case "logo":
        case "imza": return { ust: o.y, h: o.h ?? 60 };
        case "qr": return { ust: o.y, h: o.boyut };
        default: return { ust: 0, h: 0 };
    }
}
/**
 * Harf genişlikleri (1/1000 em): Arial = Helvetica ölçüleri (normal / kalın), ASCII 32–126. Türkçe harfler eşdeğerinden.
 * Taşan metnin satır sayısını iki çizici (PDF / HTML) aynı hesaplasın diye; yazı tipi dosyası gerektirmez.
 */
const HELV = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
const HELV_K = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584];
const TR_ESDEGER = { "Ç": "C", "Ğ": "G", "İ": "I", "Ö": "O", "Ş": "S", "Ü": "U", "ç": "c", "ğ": "g", "ı": "i", "ö": "o", "ş": "s", "ü": "u", "Â": "A", "â": "a", "Î": "I", "î": "i", "Û": "U", "û": "u" };
function harfGenisligi(h, kalin) {
    const k = (TR_ESDEGER[h] ?? h).charCodeAt(0);
    if (h === "ı")
        return 278; // Arial noktasız ı, i'den geniştir
    return k >= 32 && k <= 126 ? (kalin ? HELV_K : HELV)[k - 32] : 556;
}
/** Metnin punto cinsinden genişliği (`**kalın**` parçaları kalın ölçülür). Eş aralıklı yazıda her harf 0,6 em. */
/**
 * Seçilebilen yazı tipleri (bölüm 11, K14). `oran`: Arial'e göre ortalama genişlik (satır kırma tahmini);
 * eş aralıklı yazıda her harf 0,6 em. PDF'te Windows yazı tipi dosyaları, tarayıcıda CSS ailesi kullanılır.
 */
export const YAZI_TIPLERI = {
    "Arial": { css: "Arial, Helvetica, sans-serif", oran: 1 },
    "Courier New": { css: "'Courier New', Courier, monospace", oran: 1, mono: true },
    "Times New Roman": { css: "'Times New Roman', Times, serif", oran: 0.92 },
    "Verdana": { css: "Verdana, Geneva, sans-serif", oran: 1.18 },
    "Tahoma": { css: "Tahoma, Geneva, sans-serif", oran: 1.04 },
    "Georgia": { css: "Georgia, 'Times New Roman', serif", oran: 1.1 },
};
/** Öğenin yazı tipi: kendi seçimi, yoksa şablonun ("mono" → Courier New, değilse Arial). */
export const fontAdi = (font, yt) => typeof font === "string" && YAZI_TIPLERI[font] ? font : yt === "mono" ? "Courier New" : "Arial";
/** `yaziTipi`: "sans" / "mono" ya da YAZI_TIPLERI'ndeki bir ad. */
export function metinGenisligi(metin, boyut, yaziTipi = "sans", kalin = false) {
    const yt = YAZI_TIPLERI[yaziTipi];
    const mono = yaziTipi === "mono" || !!yt?.mono;
    const oran = yt?.oran ?? 1;
    let t = 0;
    for (const p of kalinParcala(metin))
        for (const h of p.metin)
            t += mono ? 600 : harfGenisligi(h, kalin || p.kalin) * oran;
    return (t * boyut) / 1000;
}
/**
 * Metnin `g` genişliğinde kaç satıra kırılacağı: kelime kelime (açgözlü) kırma, sığmayan uzun kelime harf harf bölünür
 * — PDF (pdfkit) ve tarayıcı (overflow-wrap) ile aynı yöntem. İki çizici aynı sonucu kullanır.
 */
export function tahminiSatir(metin, boyut, g, yaziTipi = "sans", kalin = false) {
    if (!g || g <= 0)
        return 1;
    const sinir = g + 0.01;
    let satir = 1, x = 0;
    const bosluk = metinGenisligi(" ", boyut, yaziTipi, kalin);
    for (const parca of kalinParcala(metin)) {
        const kelimeler = parca.metin.split(" ");
        kelimeler.forEach((kelime, i) => {
            if (i > 0) {
                if (x > 0)
                    x += bosluk;
            }
            const w = metinGenisligi(kelime, boyut, yaziTipi, kalin || parca.kalin);
            if (x > 0 && x + w > sinir) {
                satir++;
                x = 0;
            }
            if (w > sinir) {
                // Tek başına sığmayan kelime: harf harf
                for (const h of kelime) {
                    const hw = metinGenisligi(h, boyut, yaziTipi, kalin || parca.kalin);
                    if (x > 0 && x + hw > sinir) {
                        satir++;
                        x = 0;
                    }
                    x += hw;
                }
            }
            else
                x += w;
        });
    }
    return satir;
}
/** Tablo / liste satırlarını göreli y'ye (0'dan) çizer; yükseklik döner. */
function tabloSatirlari(o, satirlar, y0, varsayilanBoyut, cizimler, yt = "sans") {
    const boyut = o.boyut ?? varsayilanBoyut;
    const satirH = o.satirH ?? 15;
    const hucre = (o.cerceve ?? "hucre") === "hucre";
    const ic = hucre ? 3 : 0;
    let y = y0;
    for (const s of satirlar) {
        const etiketW = (s.deger === "" && !hucre) ? Math.max(10, o.g - 2 * ic) : Math.max(10, o.etiketG - 2 * ic);
        const degerW = Math.max(10, o.g - o.etiketG - 2 * ic);
        const etiketSatir = tahminiSatir(s.etiket, boyut, etiketW, yt, s.kalin);
        const degerSatir = s.deger ? tahminiSatir(s.deger, boyut, degerW, yt, s.kalin || !!o.kalinDeger) : 1;
        const satirAdet = Math.max(1, etiketSatir, s.deger ? degerSatir : 1);
        const ustBosluk = Math.max(0, (satirH - boyut * SATIR_ORANI) / 2);
        const gercekSatirH = Math.max(satirH, 2 * ustBosluk + satirAdet * boyut * SATIR_ORANI);
        if (hucre) {
            cizimler.push({ tip: "kutu", x: o.x, y, g: o.g, h: gercekSatirH, kalinlik: 0.5 });
            cizimler.push({ tip: "cizgi", x1: o.x + o.etiketG, y1: y, x2: o.x + o.etiketG, y2: y + gercekSatirH, kalinlik: 0.5, kesikli: false });
        }
        const ty = y + ustBosluk;
        if (s.deger === "" && !hucre) {
            // Değersiz satır (ör. "Satılan Ürün" başlığı) tüm genişliği kullanır.
            cizimler.push({ tip: "metin", x: o.x + ic, y: ty, g: etiketW, metin: s.etiket, boyut, kalin: s.kalin, hiza: "left", renk: "#000", altCizgi: false, tekSatir: etiketSatir <= 1 });
        }
        else {
            cizimler.push({ tip: "metin", x: o.x + ic, y: ty, g: etiketW, metin: s.etiket, boyut, kalin: s.kalin, hiza: "left", renk: "#000", altCizgi: false, tekSatir: etiketSatir <= 1 });
            cizimler.push({ tip: "metin", x: o.x + o.etiketG + ic, y: ty, g: degerW, metin: s.deger, boyut, kalin: s.kalin || !!o.kalinDeger, hiza: o.hizaDeger || "right", renk: "#000", altCizgi: false, tekSatir: degerSatir <= 1 });
        }
        y += gercekSatirH;
    }
    return y - y0;
}
/** Yalnızca #rgb / #rrggbb biçimli renk geçerlidir (HTML'e sızma olmasın). */
export const renkGecerli = (r) => typeof r === "string" && /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(r);
/** Çok sütunlu liste: başlık satırı + kayıt başına bir satır (+ sütun altı ek satırlar); yükseklik döner. */
function sutunluListe(o, dizi, veri, varsayilanBoyut, yt, c) {
    const boyut = o.boyut ?? varsayilanBoyut;
    const satirH = o.satirH ?? 15;
    const hucre = (o.cerceve ?? "yok") === "hucre";
    const ic = hucre ? 2 : 1;
    const sutunlar = o.sutunlar.map(s => ({ ...s, g: Math.max(1, Number(s.g) || 1) }));
    const xler = [];
    sutunlar.reduce((x, s) => { xler.push(x); return x + s.g; }, o.x);
    const toplamG = sutunlar.reduce((t, s) => t + s.g, 0);
    const metinY = (y, h, b) => y + (h - b * SATIR_ORANI) / 2;
    let y = o.y;
    if (o.baslikSatiri) {
        const bb = o.baslikBoyut ?? boyut;
        if (renkGecerli(o.baslikZemin))
            c.push({ tip: "kutu", x: o.x, y, g: toplamG, h: satirH, kalinlik: 0, zemin: o.baslikZemin });
        sutunlar.forEach((s, i) => {
            if (hucre)
                c.push({ tip: "kutu", x: xler[i], y, g: s.g, h: satirH, kalinlik: 0.5 });
            c.push({ tip: "metin", x: xler[i] + ic, y: metinY(y, satirH, bb), g: s.g - 2 * ic, metin: doldur(s.baslik || "", veri), boyut: bb, kalin: true, hiza: s.hiza || "left", renk: "#000", altCizgi: false, tekSatir: true });
        });
        if (!hucre)
            c.push({ tip: "cizgi", x1: o.x, y1: y + satirH, x2: o.x + toplamG, y2: y + satirH, kalinlik: 0.6, kesikli: false });
        y += satirH;
    }
    if (dizi.length === 0 && o.bosMetin) {
        c.push({ tip: "metin", x: o.x, y: metinY(y, satirH, boyut), g: toplamG, metin: doldur(o.bosMetin, veri), boyut, kalin: false, hiza: "center", renk: "#000", altCizgi: false, tekSatir: true });
        return y + satirH - o.y;
    }
    const altBoyut = (a) => a.boyut ?? boyut * 0.85;
    const altH = (a) => altBoyut(a) * SATIR_ORANI + 0.5;
    dizi.forEach((kayit, k) => {
        const bag = { ...veri, s: kayit, sira: k + 1 };
        if (k > 0) {
            const aralik = o.aralik ?? 0;
            // Kayıtlar arası ayraç: aralığın ortasına, liste genişliğinde
            if (o.satirAyraci && !hucre) {
                const ay = y + aralik / 2;
                c.push({ tip: "cizgi", x1: o.x, y1: ay, x2: o.x + toplamG, y2: ay, kalinlik: 0.5, kesikli: o.satirAyraci === "kesikli", ...(o.satirAyraci === "noktali" ? { noktali: true } : {}) });
            }
            y += aralik;
        }
        // Ana satır: çok satırlı sütun varsa satır uzar
        const hucreler = sutunlar.map((s, i) => {
            const metin = doldur(s.deger, bag);
            const tahmini = tahminiSatir(metin, boyut, s.g - 2 * ic, yt, !!s.kalin);
            const satir = s.cokSatir || tahmini > 1 ? tahmini : 1;
            return { s, i, metin, satir, tahmini };
        });
        const enCok = Math.max(1, ...hucreler.map(h => h.satir));
        const ustBosluk = Math.max(0, (satirH - boyut * SATIR_ORANI) / 2);
        const anaH = Math.max(satirH, 2 * ustBosluk + enCok * boyut * SATIR_ORANI);
        // Sütun altı ek satırlar (her sütunun kendi altında üst üste)
        const altlar = (o.altSatirlar || []).filter(a => kosulGecti(a.kosul, bag))
            .map(a => ({ ...a, sutun: Math.min(Math.max(0, Number(a.sutun) || 0), sutunlar.length - 1), metin: doldur(a.metin, bag) }));
        const sutunAltlari = sutunlar.map((_, i) => altlar.filter(a => a.sutun === i));
        const altToplam = Math.max(0, ...sutunAltlari.map(l => l.reduce((t, a) => {
            const at = tahminiSatir(a.metin, altBoyut(a), o.g, yt, !!a.kalin);
            return t + altH(a) + (at > 1 ? (at - 1) * altBoyut(a) * SATIR_ORANI : 0);
        }, 0)));
        const satirToplam = anaH + (altToplam ? altToplam + 1 : 0);
        for (const h of hucreler) {
            if (hucre)
                c.push({ tip: "kutu", x: xler[h.i], y, g: h.s.g, h: satirToplam, kalinlik: 0.5 });
            c.push({ tip: "metin", x: xler[h.i] + ic, y: y + ustBosluk, g: h.s.g - 2 * ic, metin: h.metin, boyut, kalin: !!h.s.kalin, hiza: h.s.hiza || "left", renk: "#000", altCizgi: false, tekSatir: h.tahmini <= 1 });
        }
        sutunAltlari.forEach((liste, i) => {
            let ay = y + anaH;
            // Çerçevesiz listede sola hizalı ek satır, kendi ek satırı olmayan sağdaki sütunların altına da yayılır.
            let sonSutun = i;
            if (!hucre && (sutunlar[i].hiza || "left") === "left")
                while (sonSutun + 1 < sutunlar.length && sutunAltlari[sonSutun + 1].length === 0)
                    sonSutun++;
            const altG = xler[sonSutun] + sutunlar[sonSutun].g - xler[i] - 2 * ic;
            for (const a of liste) {
                const altTahmini = tahminiSatir(a.metin, altBoyut(a), altG, yt, !!a.kalin);
                c.push({ tip: "metin", x: xler[i] + ic, y: ay, g: altG, metin: a.metin, boyut: altBoyut(a), kalin: !!a.kalin, hiza: sutunlar[i].hiza || "left", renk: "#000", altCizgi: false, tekSatir: altTahmini <= 1 });
                ay += altH(a) + (altTahmini > 1 ? (altTahmini - 1) * altBoyut(a) * SATIR_ORANI : 0);
            }
        });
        y += satirToplam;
    });
    return y - o.y;
}
function ogeyiHazirla(o, veri, varsayilanBoyut, icG, yt, rulo) {
    const { ust, h: nomH } = ogeKutusu(o, varsayilanBoyut);
    const gorunur = kosulGecti(o.kosul, veri);
    const ogeFont = fontAdi(o.font, yt);
    const [xs, xe] = yatayAralik(o, icG);
    const h = { o, gorunur, ust, nomH, etkinH: nomH, delta: 0, xs, xe, cizimler: [], dy: 0 };
    if (!gorunur) {
        if (o.daralt) {
            h.delta = -nomH;
            h.etkinH = 0;
        }
        return h;
    }
    const c = h.cizimler;
    const boyut = o.boyut ?? varsayilanBoyut;
    let gercekH = nomH;
    switch (o.tip) {
        case "filigran":
            c.push({ tip: "filigran", metin: doldur(o.metin, veri), renk: o.renk || "#9a9a9a" });
            break;
        case "metin": {
            const g = o.g || Math.max(10, icG - o.x);
            const metin = doldur(o.metin, veri);
            const tahmini = tahminiSatir(metin, boyut, g, ogeFont, !!o.kalin);
            const cokSatir = !!o.cokSatir || tahmini > 1;
            c.push({ tip: "metin", x: o.x, y: o.y, g, metin, boyut, kalin: !!o.kalin, hiza: o.hiza || "left", renk: o.renk || "#000", altCizgi: !!o.altCizgi, tekSatir: !cokSatir });
            gercekH = tahmini * boyut * SATIR_ORANI;
            break;
        }
        case "satirlar": {
            const adim = boyut * SATIR_ORANI + (o.aralik ?? 2);
            let y = o.y;
            for (const ham of o.satirlar) {
                const dolu = istegeBagliSatir(String(ham ?? ""), veri);
                if (dolu === null)
                    continue;
                const tahmini = tahminiSatir(dolu, boyut, o.g, ogeFont, !!o.kalin);
                c.push({ tip: "metin", x: o.x, y, g: o.g, metin: dolu, boyut, kalin: !!o.kalin, hiza: o.hiza || "left", renk: "#000", altCizgi: false, tekSatir: tahmini <= 1 });
                y += adim + (tahmini - 1) * boyut * SATIR_ORANI;
            }
            gercekH = y - o.y;
            break;
        }
        case "tablo": {
            const satirlar = o.satirlar.map(satirAc).filter(s => kosulGecti(s.kosul, veri) && !satirYok(s.deger, veri))
                .map(s => ({ etiket: doldur(s.etiket, veri), deger: doldur(s.deger, veri), kalin: s.kalin }));
            gercekH = tabloSatirlari(o, satirlar, o.y, varsayilanBoyut, c, ogeFont);
            break;
        }
        case "liste": {
            const kayitlar = alanOku(veri, o.kaynak);
            const dizi = Array.isArray(kayitlar) ? kayitlar : [];
            if (Array.isArray(o.sutunlar) && o.sutunlar.length) {
                gercekH = sutunluListe(o, dizi, veri, varsayilanBoyut, ogeFont, c);
                break;
            }
            const etiketli = { ...o, etiketG: o.etiketG ?? o.g * 0.55 };
            let y = o.y;
            if (dizi.length === 0) {
                if (o.bosMetin) {
                    const satirH = o.satirH ?? 15;
                    c.push({ tip: "metin", x: o.x, y: y + (satirH - boyut * SATIR_ORANI) / 2, g: o.g, metin: doldur(o.bosMetin, veri), boyut, kalin: false, hiza: "center", renk: "#000", altCizgi: false, tekSatir: true });
                    y += satirH;
                }
            }
            dizi.forEach((kayit, i) => {
                const bag = { ...veri, s: kayit, sira: i + 1 };
                const satirlar = (o.satirlar || []).map(satirAc).filter(s => kosulGecti(s.kosul, bag) && !satirYok(s.deger, bag))
                    .map(s => ({ etiket: doldur(s.etiket, bag), deger: doldur(s.deger, bag), kalin: s.kalin }));
                if (i > 0)
                    y += o.aralik ?? 0;
                y += tabloSatirlari(etiketli, satirlar, y, varsayilanBoyut, c, ogeFont);
            });
            gercekH = y - o.y;
            break;
        }
        case "kutu":
            c.push({ tip: "kutu", x: o.x, y: o.y, g: o.g, h: o.h, kalinlik: o.kalinlik ?? 0.6, ...(renkGecerli(o.zemin) ? { zemin: o.zemin } : {}) });
            break;
        case "cizgi":
            c.push({ tip: "cizgi", x1: o.x1, y1: o.y1, x2: o.x2, y2: o.y2, kalinlik: o.kalinlik ?? 0.8, kesikli: !!o.kesikli, ...(o.noktali ? { noktali: true } : {}) });
            break;
        case "resim":
            c.push({ tip: "resim", dosya: o.dosya, x: o.x, y: o.y, g: o.g ?? 60, h: o.h ?? 60 });
            break;
        case "logo":
        case "imza":
            if (o.gorsel)
                c.push({ tip: "resim", dosya: firmaGorselAnahtari(String(o.gorsel)), x: o.x, y: o.y, g: o.g ?? 60, h: o.h ?? 60, siyahBeyaz: rulo });
            break;
        case "qr": {
            const icerik = doldur(o.icerik, veri).trim();
            if (icerik)
                c.push({ tip: "qr", x: o.x, y: o.y, boyut: o.boyut, icerik });
            break;
        }
    }
    // Öğenin yazı tipi ve italiği, ürettiği bütün yazılara
    for (const z of c)
        if (z.tip === "metin") {
            z.font = ogeFont;
            if (o.italik)
                z.italik = true;
        }
    // Uzama her zaman alttakileri iter; kısalma yalnızca `daralt` ile yukarı çeker (yoksa boşluk kalır).
    h.etkinH = gercekH >= nomH || o.daralt ? gercekH : nomH;
    h.delta = o.daralt && gercekH < nomH ? gercekH - nomH : 0;
    return h;
}
function yatayAralik(o, icG) {
    let xs = 0, xe = icG;
    switch (o.tip) {
        case "metin":
            xs = o.x;
            xe = o.x + (o.g || Math.max(10, icG - o.x));
            break;
        case "satirlar":
        case "tablo":
        case "liste":
        case "kutu":
            xs = o.x;
            xe = o.x + o.g;
            break;
        case "cizgi":
            xs = Math.min(o.x1, o.x2);
            xe = Math.max(o.x1, o.x2);
            break;
        case "resim":
        case "logo":
        case "imza":
            xs = o.x;
            xe = o.x + (o.g ?? 60);
            break;
        case "qr":
            xs = o.x;
            xe = o.x + o.boyut;
            break;
    }
    return [xs, Math.max(xe, xs + 1)];
}
function kaydir(c, dy) {
    if (!dy)
        return c;
    switch (c.tip) {
        case "cizgi": return { ...c, y1: c.y1 + dy, y2: c.y2 + dy };
        case "filigran": return c;
        default: return { ...c, y: c.y + dy };
    }
}
const PAY = 0.5;
/** Uzayan öğe ile altındaki arasında korunacak en çok boşluk (pt); fazlası boşluk olarak tüketilir. */
const KORUNAN_ARALIK = 8;
const ustunde = (a, b) => a !== b && a.ust < b.ust && a.ust + a.nomH <= b.ust + PAY;
const yatayKesisir = (a, b) => a.xs < b.xe - PAY && b.xs < a.xe - PAY;
const icinde = (a, k) => a !== k && a.o.tip !== "filigran" && a.ust >= k.ust - PAY && a.ust + a.nomH <= k.ust + k.nomH + PAY
    && a.xs >= k.xs - PAY && a.xe <= k.xe + PAY;
/** Kutunun yeni alt kenarı: içindeki en alttaki öğelerin kayması kadar uzar / kısalır, uzayan sütunları da içine alır. */
function kutuAlti(k, hepsi) {
    const ic = hepsi.filter(a => icinde(a, k));
    const nomAlt = k.ust + k.nomH;
    if (ic.length === 0)
        return nomAlt + k.dy;
    const enAltNom = Math.max(...ic.map(a => a.ust + a.nomH));
    const kayma = Math.max(...ic.filter(a => a.ust + a.nomH >= enAltNom - PAY).map(a => a.dy + a.etkinH - a.nomH));
    let alt = nomAlt + kayma;
    for (const a of ic)
        alt = Math.max(alt, a.ust + a.dy + a.etkinH + Math.min(Math.max(0, nomAlt - (a.ust + a.nomH)), KORUNAN_ARALIK));
    return Math.max(alt, k.ust + k.dy);
}
function altKenar(a, hepsi) {
    return a.o.tip === "kutu" && a.gorunur ? kutuAlti(a, hepsi) : a.ust + a.dy + a.etkinH;
}
/**
 * Şablonu veriyle çözer: koşullar, yer tutucular, liste satırları, kayma ve kutu uzaması.
 * Sonuç her iki çizici (PDF / HTML) için aynıdır.
 *
 * Kayma: öğe, üstündeki ve yatayda çakıştığı öğelerin yeni alt kenarına (arada en çok 8 pt boşlukla)
 * çarpıyorsa o kadar aşağı iner — yani aradaki boş yer önce tüketilir. `daralt` öğenin kısalması alttakileri
 * aynı miktar yukarı çeker.
 */
export function sahneKur(sablon, veri) {
    const kenar = sablon.kenar ?? 28;
    const varsayilanBoyut = sablon.yaziBoyutu ?? 8;
    const [kg, kh] = kagitOlcusu(sablon);
    const icG = kg - 2 * kenar;
    const yt = sablon.yaziTipi === "mono" ? "mono" : "sans";
    const rulo = kg < RULO_SINIRI;
    const hazir = (Array.isArray(sablon.ogeler) ? sablon.ogeler : []).map(o => ogeyiHazirla(o, veri, varsayilanBoyut, icG, yt, rulo));
    const yerlesen = hazir.filter(h => h.o.tip !== "filigran");
    const sira = yerlesen.map((h, i) => ({ h, i })).sort((a, b) => a.h.ust - b.h.ust || a.i - b.i).map(x => x.h);
    for (const b of sira) {
        const ustler = sira.filter(a => ustunde(a, b) && yatayKesisir(a, b));
        // Yukarı çekme: üstteki öğe (kendi kaymasıyla birlikte) ne kadar yukarı kaydıysa; çakışma varsa itme geri iter.
        const cekme = Math.min(0, ...ustler.map(a => a.dy + a.delta));
        let itme = 0;
        for (const a of ustler) {
            const yeniAlt = altKenar(a, sira), nomAlt = a.ust + a.nomH;
            // Üstteki uzadıysa / aşağı indiyse ya da yukarı çekilen öğe ona çarpıyorsa aradaki asıl boşluk (en çok 8 pt)
            // korunur; çarpmıyorsa yerinde kalır (gizlenen öğenin boşluğu kapanır).
            const carpar = b.ust + cekme < yeniAlt - PAY;
            // İkisinin arasında gizlenip daraltılan öğelerin yeri boşluk sayılmaz: üstteki aşağı itilmişken de o yer kapanır
            // (ör. BSMV gizliyken KMV satırı döviz satırlarının hemen altına gelir; yoksa 8 pt'lik sahte boşluk kalıyordu).
            const kapanan = ustler.reduce((t, c) => (c !== a && !c.gorunur && c.o.daralt && c.ust >= nomAlt - PAY && c.ust + c.nomH <= b.ust + PAY ? t + c.nomH : t), 0);
            const aralik = yeniAlt > nomAlt + PAY || carpar ? Math.min(Math.max(0, b.ust - nomAlt - kapanan), KORUNAN_ARALIK) : 0;
            itme = Math.max(itme, yeniAlt + aralik - (b.ust + cekme));
        }
        b.dy = cekme + itme;
    }
    const cizimler = [];
    const ogeKutulari = [];
    let enAlt = 0;
    hazir.forEach((h, i) => {
        if (h.o.tip === "filigran") {
            ogeKutulari.push({ i, x: 0, y: 0, g: icG, h: 0, gorunur: h.gorunur });
            return;
        }
        const ust = h.ust + h.dy;
        const yukseklik = h.o.tip === "kutu" && h.gorunur ? kutuAlti(h, sira) - ust : h.gorunur ? h.etkinH : h.nomH;
        ogeKutulari.push({ i, x: h.xs, y: ust, g: h.xe - h.xs, h: Math.max(1, yukseklik), gorunur: h.gorunur });
    });
    const cizimOgesi = [];
    hazir.forEach((h, i) => {
        if (h.o.tip === "filigran") {
            for (const c of h.cizimler) {
                cizimler.push(c);
                cizimOgesi.push(i);
            }
            return;
        }
        const yeniKutuH = h.o.tip === "kutu" && h.gorunur ? kutuAlti(h, sira) - (h.ust + h.dy) : null;
        for (const c of h.cizimler) {
            const k = kaydir(c, h.dy);
            cizimler.push(k.tip === "kutu" && yeniKutuH !== null ? { ...k, h: Math.max(0, yeniKutuH) } : k);
            cizimOgesi.push(i);
        }
        if (h.gorunur)
            enAlt = Math.max(enAlt, altKenar(h, sira));
    });
    const yukseklik = kh > 0 ? kh : Math.ceil(enAlt + 2 * kenar + 4);
    return { genislik: kg, yukseklik, kenar, yaziTipi: yt, cizimler, ogeKutulari, cizimOgesi };
}
/**
 * Üst üste binen öğe çiftleri (bölüm 11, K17): farklı öğelerin basılan içerikleri (yazının gerçek genişliği,
 * görsel, karekod) 1 pt'den fazla kesişiyorsa. Kutu, çizgi ve filigran zemin sayılır, denetlenmez.
 * Kaydı engellemez; editör kırmızıyla gösterir.
 */
export function ustUsteBinenler(sahne) {
    const alanlar = [];
    sahne.cizimler.forEach((c, n) => {
        const i = sahne.cizimOgesi[n];
        if (c.tip === "metin") {
            const duz = c.metin.replace(/\*\*/g, "");
            if (!duz.trim())
                return;
            const w = Math.min(c.g, metinGenisligi(c.metin, c.boyut, c.font ?? sahne.yaziTipi, c.kalin));
            const satir = c.tekSatir ? 1 : tahminiSatir(c.metin, c.boyut, c.g, c.font ?? sahne.yaziTipi, c.kalin);
            const x1 = c.hiza === "right" ? c.x + c.g - w : c.hiza === "center" ? c.x + (c.g - w) / 2 : c.x;
            // Yazının görünen yüksekliği: satır aralığının alt boşluğu sayılmaz
            alanlar.push({ i, x1, y1: c.y, x2: x1 + w, y2: c.y + (satir - 1) * c.boyut * SATIR_ORANI + c.boyut });
        }
        else if (c.tip === "resim")
            alanlar.push({ i, x1: c.x, y1: c.y, x2: c.x + c.g, y2: c.y + c.h });
        else if (c.tip === "qr")
            alanlar.push({ i, x1: c.x, y1: c.y, x2: c.x + c.boyut, y2: c.y + c.boyut });
    });
    const ciftler = new Map();
    for (let a = 0; a < alanlar.length; a++)
        for (let b = a + 1; b < alanlar.length; b++) {
            const p = alanlar[a], q = alanlar[b];
            if (p.i === q.i)
                continue;
            if (Math.min(p.x2, q.x2) - Math.max(p.x1, q.x1) > 1 && Math.min(p.y2, q.y2) - Math.max(p.y1, q.y1) > 1) {
                const c = p.i < q.i ? [p.i, q.i] : [q.i, p.i];
                ciftler.set(c.join(","), c);
            }
        }
    return [...ciftler.values()];
}
/** `**kalın**` işaretli metni parçalara ayırır. */
export function kalinParcala(metin) {
    return String(metin ?? "").split(/(\*\*[^*]+\*\*)/g).filter(Boolean)
        .map(p => (p.startsWith("**") && p.endsWith("**") && p.length > 4 ? { metin: p.slice(2, -2), kalin: true } : { metin: p, kalin: false }));
}
