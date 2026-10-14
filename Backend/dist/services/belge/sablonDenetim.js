import { HESAP_TERIMI, YAZI_TIPLERI, kagitOlcusu, renkGecerli } from "./sablonCekirdek.js";
import { alanKatalogu } from "./alanKatalogu.js";
export const SABLON_AZAMI_BAYT = 300 * 1024;
const OGE_AZAMI = 400;
const METIN_AZAMI = 2000;
const TIPLER = ["metin", "satirlar", "tablo", "liste", "kutu", "cizgi", "resim", "logo", "imza", "qr", "filigran"];
const BICIMLER = ["sayi", "sayi4", "kur", "doviz", "kurb", "tl", "buyuk"];
const HIZALAR = ["left", "center", "right"];
const sayiMi = (v) => typeof v === "number" && Number.isFinite(v);
const yerTutuculari = (m) => [...String(m ?? "").matchAll(/\{\{\s*([^}|]*?)\s*(?:\|\s*([^}:]*?)(?::([^}]*))?\s*)?\}\}/g)].map(x => ({ yol: x[1], bicim: x[2], hane: x[3] }));
/** Öğenin içindeki metin alanları (yer tutucu taraması için); `kosullarla` false ise yalnızca basılan içerik. */
function ogeMetinleri(o, kosullarla = true) {
    const m = [];
    const ekle = (v) => { if (typeof v === "string")
        m.push(v); };
    const kosul = (v) => { if (kosullarla)
        ekle(v); };
    kosul(o.kosul);
    ekle(o.metin);
    ekle(o.icerik);
    ekle(o.bosMetin);
    for (const s of Array.isArray(o.satirlar) ? o.satirlar : []) {
        if (typeof s === "string")
            ekle(s);
        else if (Array.isArray(s)) {
            ekle(s[0]);
            ekle(s[1]);
        }
        else if (s && typeof s === "object") {
            ekle(s.etiket);
            ekle(s.deger);
            kosul(s.kosul);
        }
    }
    for (const s of Array.isArray(o.sutunlar) ? o.sutunlar : []) {
        ekle(s?.baslik);
        ekle(s?.deger);
    }
    for (const a of Array.isArray(o.altSatirlar) ? o.altSatirlar : []) {
        ekle(a?.metin);
        kosul(a?.kosul);
    }
    return m;
}
/**
 * @param gorselAdlari firmanın yüklediği logo / imza görsellerinin adları; verilirse şablondaki görsel adları bunlarda
 *   olmalıdır (yükleme / kayıt). Verilmezse (etkin şablonu okurken) görsel adı denetlenmez, eksik görsel boş basılır.
 */
export function sablonDenetle(ham, tur, varsayilan, gorselAdlari) {
    const hatalar = [];
    const hata = (mesaj, oge, alan) => { if (hatalar.length < 200)
        hatalar.push({ oge, alan, mesaj }); };
    let sablon = ham;
    if (typeof ham === "string") {
        if (Buffer.byteLength(ham, "utf8") > SABLON_AZAMI_BAYT)
            return { gecerli: false, hatalar: [{ mesaj: `Dosya çok büyük (en çok ${SABLON_AZAMI_BAYT / 1024} KB).` }] };
        if (!ham.trim())
            return { gecerli: false, hatalar: [{ mesaj: "Dosya boş." }] };
        try {
            sablon = JSON.parse(ham.replace(/^﻿/, ""));
        }
        catch (e) {
            return { gecerli: false, hatalar: [{ mesaj: `Dosya JSON biçiminde değil: ${e?.message || e}` }] };
        }
    }
    else if (Buffer.byteLength(JSON.stringify(ham ?? null), "utf8") > SABLON_AZAMI_BAYT) {
        return { gecerli: false, hatalar: [{ mesaj: `Şablon çok büyük (en çok ${SABLON_AZAMI_BAYT / 1024} KB).` }] };
    }
    if (!sablon || typeof sablon !== "object" || Array.isArray(sablon))
        return { gecerli: false, hatalar: [{ mesaj: "Şablon bir nesne olmalı: { \"kagit\", \"ogeler\": [...] }." }] };
    if (!Array.isArray(sablon.ogeler))
        return { gecerli: false, hatalar: [{ mesaj: "\"ogeler\" listesi yok." }] };
    if (sablon.ogeler.length > OGE_AZAMI)
        hata(`En çok ${OGE_AZAMI} öğe olabilir (${sablon.ogeler.length}).`);
    // Kâğıt: varsayılanla aynı genişlikte olmalı (80 mm şablon A4'e çevrilemez)
    const [vg] = kagitOlcusu(varsayilan);
    if (sablon.kagit !== undefined && !(sablon.kagit === "A4" || sablon.kagit === "A5" ||
        (Array.isArray(sablon.kagit) && sablon.kagit.length === 2 && sayiMi(sablon.kagit[0]) && sayiMi(sablon.kagit[1]) && sablon.kagit[1] >= 0 && sablon.kagit[1] <= 5000))) {
        hata("\"kagit\" geçersiz: \"A4\", \"A5\" ya da [genişlik, yükseklik] olmalı.", undefined, "kagit");
    }
    const [kg, kh] = kagitOlcusu(sablon);
    if (Math.abs(kg - vg) > 1)
        hata(`Kâğıt genişliği bu belge türü için ${Math.round(vg)} pt olmalı (gelen ${Math.round(kg)} pt).`, undefined, "kagit");
    if (sablon.kenar !== undefined && !(sayiMi(sablon.kenar) && sablon.kenar >= 0 && sablon.kenar <= 100))
        hata("\"kenar\" 0–100 arası sayı olmalı.", undefined, "kenar");
    if (sablon.yaziBoyutu !== undefined && !(sayiMi(sablon.yaziBoyutu) && sablon.yaziBoyutu >= 3 && sablon.yaziBoyutu <= 72))
        hata("\"yaziBoyutu\" 3–72 arası olmalı.", undefined, "yaziBoyutu");
    if (sablon.yaziTipi !== undefined && !["sans", "mono"].includes(sablon.yaziTipi))
        hata("\"yaziTipi\" \"sans\" ya da \"mono\" olmalı.", undefined, "yaziTipi");
    const kenar = sayiMi(sablon.kenar) ? sablon.kenar : 28;
    const icG = kg - 2 * kenar;
    const icH = kh > 0 ? kh - 2 * kenar : Infinity;
    const katalog = alanKatalogu(tur);
    const genel = new Set(katalog.alanlar);
    const idler = new Set();
    sablon.ogeler.forEach((o, i) => {
        const ad = o && typeof o === "object" && typeof o.id === "string" && o.id ? o.id : `${i + 1}. öğe`;
        if (!o || typeof o !== "object" || Array.isArray(o)) {
            hata("Öğe bir nesne olmalı.", ad);
            return;
        }
        if (!TIPLER.includes(o.tip)) {
            hata(`Bilinmeyen öğe türü "${o.tip}". Geçerli türler: ${TIPLER.join(", ")}.`, ad, "tip");
            return;
        }
        if (o.id !== undefined) {
            if (typeof o.id !== "string" || !/^[A-Za-z0-9_-]{1,40}$/.test(o.id))
                hata("\"id\" harf, rakam, - ve _ ile en çok 40 karakter olmalı.", ad, "id");
            else if (idler.has(o.id))
                hata(`"${o.id}" kimliği iki kez kullanılmış.`, ad, "id");
            else
                idler.add(o.id);
        }
        // Sayısal alanlar
        const sayisal = (alan, enAz, enCok, zorunlu = false) => {
            const v = o[alan];
            if (v === undefined) {
                if (zorunlu)
                    hata(`"${alan}" eksik.`, ad, alan);
                return;
            }
            if (!sayiMi(v))
                hata(`"${alan}" sayı olmalı.`, ad, alan);
            else if (v < enAz || v > enCok)
                hata(`"${alan}" ${enAz}–${enCok} arası olmalı (${v}).`, ad, alan);
        };
        const konumlu = o.tip !== "cizgi" && o.tip !== "filigran";
        if (konumlu) {
            sayisal("x", -0.5, icG, true);
            sayisal("y", -0.5, Math.min(icH, 5000), true);
        }
        sayisal("boyut", o.tip === "qr" ? 10 : 3, o.tip === "qr" ? 400 : 72, o.tip === "qr");
        sayisal("satirH", 3, 200);
        sayisal("aralik", 0, 100);
        sayisal("kalinlik", 0, 10);
        sayisal("baslikBoyut", 3, 72);
        if (["satirlar", "tablo", "liste", "kutu"].includes(o.tip))
            sayisal("g", 1, icG + 0.5, true);
        else
            sayisal("g", 1, icG + 0.5);
        if (o.tip === "kutu")
            sayisal("h", 0, 5000, true);
        else
            sayisal("h", 1, 5000);
        if (o.tip === "tablo" || (o.tip === "liste" && !o.sutunlar))
            sayisal("etiketG", 0, sayiMi(o.g) ? o.g : icG, o.tip === "tablo");
        if (o.tip === "cizgi")
            for (const a of ["x1", "x2"])
                sayisal(a, -0.5, icG + 0.5, true);
        if (o.tip === "cizgi")
            for (const a of ["y1", "y2"])
                sayisal(a, -0.5, Math.min(icH, 5000), true);
        // Kâğıttan taşma
        if (sayiMi(o.x)) {
            const genislik = o.tip === "qr" ? o.boyut : o.tip === "resim" ? (o.g ?? 60) : o.g;
            if (sayiMi(genislik) && o.x + genislik > icG + 0.5)
                hata(`Öğe kâğıdın sağından taşıyor (x + genişlik = ${Math.round(o.x + genislik)} > ${Math.round(icG)}).`, ad, "x");
        }
        for (const r of ["renk", "zemin", "baslikZemin"])
            if (o[r] !== undefined && !renkGecerli(o[r]))
                hata(`"${r}" #rgb ya da #rrggbb biçiminde renk olmalı.`, ad, r);
        if (o.font !== undefined && !(typeof o.font === "string" && YAZI_TIPLERI[o.font]))
            hata(`"font" şunlardan biri olmalı: ${Object.keys(YAZI_TIPLERI).join(", ")}.`, ad, "font");
        if (o.italik !== undefined && typeof o.italik !== "boolean")
            hata(`"italik" true ya da false olmalı.`, ad, "italik");
        for (const h of ["hiza", "hizaDeger"])
            if (o[h] !== undefined && !HIZALAR.includes(o[h]))
                hata(`"${h}" left, center ya da right olmalı.`, ad, h);
        if (o.cerceve !== undefined && !["hucre", "yok"].includes(o.cerceve))
            hata("\"cerceve\" hucre ya da yok olmalı.", ad, "cerceve");
        for (const b of ["kalin", "altCizgi", "kesikli", "daralt", "zorunlu", "kalinDeger", "baslikSatiri"])
            if (o[b] !== undefined && typeof o[b] !== "boolean")
                hata(`"${b}" true ya da false olmalı.`, ad, b);
        // Metin alanları ve türe özel yapı
        const metin = (alan, gerekli = false) => {
            const v = o[alan];
            if (v === undefined) {
                if (gerekli)
                    hata(`"${alan}" eksik.`, ad, alan);
                return;
            }
            if (typeof v !== "string")
                hata(`"${alan}" metin olmalı.`, ad, alan);
            else if (v.length > METIN_AZAMI)
                hata(`"${alan}" çok uzun (en çok ${METIN_AZAMI} karakter).`, ad, alan);
        };
        metin("kosul");
        metin("ad");
        if (o.tip === "metin" || o.tip === "filigran")
            metin("metin", true);
        if (o.tip === "qr")
            metin("icerik", true);
        if (o.tip === "logo" || o.tip === "imza") {
            if (typeof o.gorsel !== "string" || !/^[\p{L}\p{N}][\p{L}\p{N} _.-]{0,39}$/u.test(o.gorsel.trim()))
                hata("\"gorsel\" görselin adı olmalı (1–40 karakter).", ad, "gorsel");
            else if (gorselAdlari && !gorselAdlari.some(g => g.toLocaleLowerCase("tr-TR") === o.gorsel.trim().toLocaleLowerCase("tr-TR")))
                hata(`"${o.gorsel}" adında bir ${o.tip === "logo" ? "logo" : "imza / kaşe"} görseli yok. Önce "Logolar ve İmzalar" bölümünden yükleyin.`, ad, "gorsel");
        }
        if (o.tip === "resim") {
            if (typeof o.dosya !== "string" || !/^[A-Za-z0-9_.-]{1,80}\.(png|jpe?g)$/i.test(o.dosya) || o.dosya.includes(".."))
                hata("\"dosya\" yalnızca png / jpg dosya adı olabilir (klasör yolu olmadan).", ad, "dosya");
        }
        if (o.tip === "satirlar") {
            if (!Array.isArray(o.satirlar) || o.satirlar.some((s) => typeof s !== "string" || s.length > METIN_AZAMI))
                hata("\"satirlar\" metin listesi olmalı.", ad, "satirlar");
            else if (o.satirlar.length > 100)
                hata("En çok 100 satır olabilir.", ad, "satirlar");
        }
        const satirListesi = (liste) => {
            if (!Array.isArray(liste)) {
                hata("\"satirlar\" listesi olmalı.", ad, "satirlar");
                return;
            }
            if (liste.length > 100)
                hata("En çok 100 satır olabilir.", ad, "satirlar");
            for (const s of liste) {
                const tamam = (Array.isArray(s) && s.length >= 2 && s.length <= 3 && typeof s[0] === "string" && typeof s[1] === "string" && (s[2] === undefined || typeof s[2] === "boolean"))
                    || (s && typeof s === "object" && !Array.isArray(s) && typeof s.etiket === "string" && typeof s.deger === "string");
                if (!tamam) {
                    hata("Tablo satırı [\"Etiket\", \"Değer\"] ya da { \"etiket\", \"deger\" } olmalı.", ad, "satirlar");
                    break;
                }
            }
        };
        if (o.tip === "tablo")
            satirListesi(o.satirlar);
        if (o.tip === "liste") {
            if (typeof o.kaynak !== "string" || !katalog.listeler[o.kaynak])
                hata(`"kaynak" bu belgede bir liste olmalı: ${Object.keys(katalog.listeler).join(", ") || "(liste yok)"}.`, ad, "kaynak");
            if (o.sutunlar !== undefined) {
                if (!Array.isArray(o.sutunlar) || o.sutunlar.length === 0 || o.sutunlar.length > 20)
                    hata("\"sutunlar\" 1–20 sütunluk liste olmalı.", ad, "sutunlar");
                else {
                    let toplam = 0;
                    for (const s of o.sutunlar) {
                        if (!s || typeof s !== "object" || typeof s.deger !== "string" || !sayiMi(s.g) || s.g <= 0) {
                            hata("Sütun { \"deger\", \"g\" } içermeli; g sıfırdan büyük sayı.", ad, "sutunlar");
                            break;
                        }
                        if (s.hiza !== undefined && !HIZALAR.includes(s.hiza))
                            hata("Sütun \"hiza\" left, center ya da right olmalı.", ad, "sutunlar");
                        toplam += s.g;
                    }
                    if (sayiMi(o.x) && o.x + toplam > icG + 0.5)
                        hata(`Sütunların toplam genişliği kâğıttan taşıyor (${Math.round(o.x + toplam)} > ${Math.round(icG)}).`, ad, "sutunlar");
                }
                if (o.altSatirlar !== undefined && (!Array.isArray(o.altSatirlar) || o.altSatirlar.length > 10 || o.altSatirlar.some((a) => !a || typeof a.metin !== "string")))
                    hata("\"altSatirlar\" en çok 10 { \"metin\" } öğesi olmalı.", ad, "altSatirlar");
            }
            else
                satirListesi(o.satirlar);
        }
        // Yer tutucular: alan adı ve biçim
        const izinli = new Set(genel);
        if (o.tip === "liste" && typeof o.kaynak === "string" && katalog.listeler[o.kaynak]) {
            for (const a of katalog.listeler[o.kaynak])
                izinli.add(a);
            izinli.add("sira");
        }
        for (const t of ogeMetinleri(o))
            for (const y of yerTutuculari(t)) {
                // Hesap: {{= a işlem b | biçim}} — iki terim alan ya da sayı, işlem + − × ÷ (bölüm 11, K13)
                if (y.yol.startsWith("=")) {
                    const m = /^=\s*(\S+)\s*([+\-*/])\s*(\S+)$/.exec(y.yol);
                    if (!m) {
                        hata(`Hesap anlaşılamadı: {{${y.yol}}}. Biçim: alan ya da sayı, işlem (+ − × ÷), alan ya da sayı.`, ad);
                        continue;
                    }
                    for (const terim of [m[1], m[3]]) {
                        if (!HESAP_TERIMI.test(terim))
                            hata(`Hesapta geçersiz terim "${terim}".`, ad);
                        else if (!/^-?\d/.test(terim) && !izinli.has(terim))
                            hata(`Hesapta bilinmeyen alan {{${terim}}}.`, ad);
                    }
                }
                else if (!izinli.has(y.yol))
                    hata(`Bilinmeyen alan {{${y.yol}}}. Kullanılabilir alanlar "Nasıl yapılır?" penceresindeki tabloda.`, ad);
                if (y.bicim !== undefined && !BICIMLER.includes(y.bicim))
                    hata(`Bilinmeyen biçim |${y.bicim}. Geçerli: ${BICIMLER.join(", ")}, sayi:N.`, ad);
                if (y.hane !== undefined && !(y.bicim === "sayi" && /^\d$/.test(y.hane)))
                    hata(`"|${y.bicim}:${y.hane}" geçersiz; yalnızca sayi:0–9 kullanılabilir.`, ad);
            }
    });
    if (hatalar.length)
        return { gecerli: false, hatalar };
    // Temiz kopya: kod varsayılandan, kimliksiz öğelere kimlik; "zorunlu" işareti artık kullanılmaz (K12)
    let sayac = 1;
    const yeniId = () => { let id; do
        id = `oge-${sayac++}`;
    while (idler.has(id)); idler.add(id); return id; };
    const ogeler = sablon.ogeler.map((o) => {
        const k = { ...o, id: o.id || yeniId() };
        delete k.zorunlu;
        return k;
    });
    const temiz = {
        kod: varsayilan.kod, ad: typeof sablon.ad === "string" && sablon.ad.trim() ? sablon.ad.trim().slice(0, 120) : varsayilan.ad,
        kagit: sablon.kagit ?? varsayilan.kagit, kenar, yaziBoyutu: sablon.yaziBoyutu ?? varsayilan.yaziBoyutu, yaziTipi: sablon.yaziTipi ?? varsayilan.yaziTipi,
        ogeler,
    };
    return { gecerli: true, hatalar: [], sablon: temiz };
}
