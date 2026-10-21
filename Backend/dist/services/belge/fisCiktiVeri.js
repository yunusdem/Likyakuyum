/**
 * Yazıcıya giden fişlerin (termal / A4) şablon verisi — saf mantık, veritabanına dokunmaz.
 *
 * Fiş ekranı kaydedilmemiş fişi de basabildiği için (F9) tutarlar ekrandan gelir; firma bilgisi,
 * kuruş ayarları ve kayıtlı fişin ETTN'si sunucuda tamamlanır (docs/FIS_TASARIM_YOL_HARITASI.md).
 * Alan adları şablondaki `{{...}}` yer tutucularıdır; kılavuzdaki alan listesi buradan üretilir.
 */
import { ticariFisHesapla, yuvarla2 } from "../ticari/ticariHesap.js";
const yazi = (v) => (v === null || v === undefined ? "" : String(v).trim());
export const sayiOku = (v) => {
    if (v === null || v === undefined || v === "")
        return 0;
    if (typeof v === "number")
        return Number.isFinite(v) ? v : 0;
    const str = String(v).trim().replace(/\s/g, "");
    if (!str)
        return 0;
    // 1. Hem nokta hem virgül içeriyorsa
    if (str.includes(",") && str.includes(".")) {
        const lastComma = str.lastIndexOf(",");
        const lastDot = str.lastIndexOf(".");
        if (lastComma > lastDot) {
            // Türkçe: "500.000,50" -> noktalar binlik, virgül ondalık
            const clean = str.replace(/\./g, "").replace(",", ".");
            const num = parseFloat(clean);
            return Number.isFinite(num) ? num : 0;
        }
        else {
            // İngilizce: "500,000.50" -> virgüller binlik, nokta ondalık
            const clean = str.replace(/,/g, "");
            const num = parseFloat(clean);
            return Number.isFinite(num) ? num : 0;
        }
    }
    // 2. Sadece virgül içeriyorsa ("5000,50" veya "9,00")
    if (str.includes(",")) {
        const parts = str.split(",");
        if (parts.length > 2) {
            const clean = str.replace(/,/g, "");
            const num = parseFloat(clean);
            return Number.isFinite(num) ? num : 0;
        }
        const clean = str.replace(",", ".");
        const num = parseFloat(clean);
        return Number.isFinite(num) ? num : 0;
    }
    // 3. Sadece nokta içeriyorsa ("9.000", "50.000", "1.000.000")
    if (str.includes(".")) {
        const dotParts = str.split(".");
        // Birden fazla nokta varsa ("1.000.000") kesinlikle binlik ayracıdır
        if (dotParts.length > 2) {
            const clean = str.replace(/\./g, "");
            const num = parseFloat(clean);
            return Number.isFinite(num) ? num : 0;
        }
        // Tek nokta: 1-3 basamak . 3 basamak ise ("9.000", "50.000", "500.000") ve başı 0 değilse binlik ayracıdır!
        if (dotParts[0].length >= 1 && dotParts[0].length <= 3 && dotParts[0] !== "0" && dotParts[1].length === 3) {
            const clean = str.replace(/\./g, "");
            const num = parseFloat(clean);
            return Number.isFinite(num) ? num : 0;
        }
        const num = parseFloat(str);
        return Number.isFinite(num) ? num : 0;
    }
    const n = parseFloat(str);
    return Number.isFinite(n) ? n : 0;
};
const buyuk = (s) => s.toLocaleUpperCase("tr-TR");
/** Kod / numara (belge no, ETTN, para kodu): Türkçe "i → İ" dönüşümü olmadan. */
const kodBuyuk = (s) => s.toUpperCase();
const kurusAyari = (v, varsayilan) => {
    const n = Number(v);
    return v !== null && v !== undefined && v !== "" && Number.isInteger(n) && n >= 0 && n <= 8 ? n : varsayilan;
};
const yuvarla = (n, hane = 2) => Math.round(n * 10 ** hane) / 10 ** hane;
/**
 * Tutarın yazıyla hâli, fiş ekranındaki biçimde: "OnBirBin ÜçYüzİki TL ElliAltı Krş".
 * 1.000 → "Bin" (BirBin değil).
 */
export function fisYaziyla(tutar) {
    const birler = ["", "Bir", "İki", "Üç", "Dört", "Beş", "Altı", "Yedi", "Sekiz", "Dokuz"];
    const onlar = ["", "On", "Yirmi", "Otuz", "Kırk", "Elli", "Altmış", "Yetmiş", "Seksen", "Doksan"];
    const gruplar = ["", "Bin", "Milyon", "Milyar", "Trilyon"];
    const uclu = (n, grup) => {
        const y = Math.floor(n / 100), o = Math.floor((n % 100) / 10), b = n % 10;
        return (y ? (y === 1 ? "Yüz" : birler[y] + "Yüz") : "") + onlar[o] + (grup === 1 && n === 1 ? "" : birler[b]);
    };
    const deger = Math.abs(Number(tutar) || 0);
    let lira = Math.floor(deger);
    let kurus = Math.round((deger - lira) * 100);
    if (kurus === 100) {
        lira += 1;
        kurus = 0;
    }
    const parcalar = [];
    for (let n = lira, i = 0; n > 0 && i < gruplar.length; n = Math.floor(n / 1000), i++) {
        const k = n % 1000;
        if (k)
            parcalar.unshift(uclu(k, i) + gruplar[i]);
    }
    const tam = parcalar.length ? parcalar.join(" ") : "Sıfır";
    return `${tam} TL${kurus ? ` ${onlar[Math.floor(kurus / 10)]}${birler[kurus % 10]} Krş` : ""}`;
}
/** "PAMUKKALE/DENİZLİ" — ikisi de boşsa boş. */
const ilceSehir = (ilce, il) => (ilce || il ? `${buyuk(ilce)}/${buyuk(il)}` : "");
/** ICE'nin e-Döviz erişim adresi (belgeVeri.ts ile aynı). */
export const erisimAdresiYap = (vkn, ettn) => (ettn && vkn ? `http://ebelge.iceteknoloji.com.tr/edoviz/ettn/${vkn}/${ettn}` : "");
/**
 * Döviz fişinin termal çıktı verisi. Hesaplar DovizFisiPrintModal'daki ile aynıdır:
 * geçerli satır = miktar > 0 ve kur > 0; satışta BSMV verilmemişse binde 2; genel toplam satışta TL + BSMV,
 * alışta ödeme tutarı; USD dışı dövizde ABD doları karşılığı gişe USD kuruyla.
 * Kayıtlı fişin numarası / ETTN'si `kayit` ile gelir (ekrandakinden önceliklidir).
 */
export function dovizFisVerisi(g, firma, kayit = {}) {
    const satim = Number(g.tip) === 1;
    const basamak = {
        doviz: kurusAyari(g.dovizKurusSayisi, firma.basamak.doviz),
        kur: kurusAyari(g.kurKurusSayisi, firma.basamak.kur),
        tl: kurusAyari(g.tlKurusSayisi, firma.basamak.tl),
    };
    const usdKuru = sayiOku(g.giseUsdKuru);
    const satirlar = (Array.isArray(g.lines) ? g.lines : [])
        .map(l => {
        const miktar = sayiOku(l.miktar), kur = sayiOku(l.kur);
        const tl = l.tutar === undefined || l.tutar === null || l.tutar === "" ? miktar * kur : sayiOku(l.tutar);
        const kod = kodBuyuk(yazi(l.paraKodu) || "USD");
        const usdVar = kod !== "USD" && kod !== "TL" && kod !== "TRY" && usdKuru > 0;
        return { kod, ad: yazi(l.paraAdi), miktar, kur, tl, usd: usdVar ? yuvarla(tl / usdKuru) : 0, usdVar };
    })
        .filter(s => s.miktar > 0 && s.kur > 0);
    const tl = satirlar.reduce((t, s) => t + s.tl, 0);
    const tutar = g.toplamTutar !== undefined && g.toplamTutar !== null ? sayiOku(g.toplamTutar) : tl;
    const bsmv = satim ? (g.bsmvTutari !== undefined && g.bsmvTutari !== null ? sayiOku(g.bsmvTutari) : yuvarla(tl * 0.002)) : 0;
    const komisyon = sayiOku(g.komisyonTutari);
    const kmv = sayiOku(g.kmvTutari);
    const masraf = g.totalMasraf !== undefined && g.totalMasraf !== null
        ? sayiOku(g.totalMasraf)
        : yuvarla(bsmv + komisyon + kmv);
    const sonToplam = g.sonToplam !== undefined && g.sonToplam !== null
        ? sayiOku(g.sonToplam)
        : (g.odemeTutari !== undefined && g.odemeTutari !== null
            ? sayiOku(g.odemeTutari)
            : (satim ? yuvarla(tutar + masraf) : yuvarla(tutar - masraf)));
    const genel = sonToplam;
    const belgeNo = kodBuyuk(yazi(kayit.belgeNo) || yazi(g.belgeNo) || yazi(g.seriNo));
    const ettn = kodBuyuk(yazi(kayit.ettn) || yazi(g.guid));
    const tarihHam = yazi(g.tarih);
    const tarih = /^\d{4}-\d{2}-\d{2}/.test(tarihHam) ? tarihHam.slice(0, 10).split("-").reverse().join("/") : tarihHam;
    const saat = yazi(g.saat).slice(0, 5);
    const tipAdi = satim ? "SATIM" : "ALIM";
    const kimlik = yazi(g.vergiKimlikNo) || "11111111111";
    const musteri = {
        unvan: yazi(g.unvan) || "İsim beyan edilmemiştir",
        ilceSehir: ilceSehir(yazi(g.detayIlce), yazi(g.detayIl)),
        uyruk: buyuk(yazi(g.detayUyruk) || "TR"),
        ulkeKodu: "TR",
        pasaportNo: yazi(g.detayPasaportNo),
        kimlikNo: kimlik,
        vergiDairesi: "",
        musteriTuru: g.detayCariTipi === "Firma" ? "TUZELKISI" : "GERCEKKISI",
        meslek: yazi(g.detayMeslek),
    };
    const erisimAdresi = erisimAdresiYap(firma.vkn, ettn);
    const qr = erisimAdresi || JSON.stringify({ belgeNo, tip: tipAdi, tarih, vkn: firma.vkn, musteri: kimlik, tutar: yuvarla(genel), ettn: ettn || null });
    const subeKodu = firma.subeKodu || "1";
    return {
        belgeTuru: "DOVIZ_FIS", fisId: Number(g.fisId) || 0, satim, fisTipi: satim ? 1 : 0, tipAdi,
        belgeNo, ettn, tarih, saat, seri: "EDOVIZBELGE",
        subeKodu, dosyaNo: firma.dosyaNo, subeNo: firma.dosyaNo ? `${subeKodu} - ${firma.dosyaNo}` : subeKodu,
        istatistikNo: yazi(g.istatistikKodu), vezne: yazi(g.vezneKod) || "01",
        geldigiUlke: "Türkiye", satisDayanagi: firma.satisDayanagi || "32 SAYILI KARAR GEREĞİ",
        firma: {
            ...firma,
            vdVkn: [firma.vergiDairesi, firma.vkn].filter(Boolean).join(" / "),
            mersisSicil: [firma.mersis, firma.ticaretSicilNo].filter(Boolean).join(" / "),
        },
        musteri, satirlar,
        toplam: { tl: tutar, tutar, bsmv, bsmvVar: satim && bsmv > 0, komisyon, kmv, masraf, sonToplam, genel, yaziyla: fisYaziyla(sonToplam) },
        basamak, qr, erisimAdresi, onizleme: false, iptal: false,
    };
}
/** Boş firma (veritabanı okunamazsa); kuruş varsayılanları DovizFisiPrintModal ile aynı. */
export const bosFirma = () => ({
    unvan: "", adres: "", ilce: "", sehir: "", telefon: "", web: "", eposta: "", vergiDairesi: "", vkn: "",
    mersis: "", ticaretSicilNo: "", subeKodu: "", subeAdi: "", dosyaNo: "", satisDayanagi: "", basamak: { doviz: 2, kur: 4, tl: 2 },
});
/** TODVZ_TANIM satırından (ad sütunları birleştirilmiş) firma kimliği. */
export function firmaKimlikOku(r) {
    if (!r)
        return bosFirma();
    return {
        unvan: yazi(r.FIRMA_ADI), adres: yazi(r.ADRES), ilce: yazi(r.ILCE_ADI), sehir: yazi(r.IL_ADI), telefon: yazi(r.TELEFON),
        web: yazi(r.WEB_ADRESI), eposta: yazi(r.EPOSTA), vergiDairesi: yazi(r.VERGI_DAIRESI_ADI), vkn: yazi(r.VERGI_KIMLIK_NO),
        mersis: yazi(r.MERSIS_NO), ticaretSicilNo: yazi(r.TICARET_SICIL_NO), subeKodu: yazi(r.SUBE_KODU), subeAdi: yazi(r.SUBE_ADI), dosyaNo: yazi(r.DOSYA_NO),
        satisDayanagi: yazi(r.SATISIN_DAYANAGI),
        basamak: { doviz: kurusAyari(r.DOVIZ_KURUS_SAYISI, 2), kur: kurusAyari(r.KUR_KURUS_SAYISI, 4), tl: kurusAyari(r.TL_KURUS_SAYISI, 2) },
    };
}
const tr = (n, hane = 2) => Number(n || 0).toLocaleString("tr-TR", { minimumFractionDigits: hane, maximumFractionDigits: hane });
/** "2026-10-12" / ISO → "12.10.2026"; tanınmazsa olduğu gibi. */
function tarihNokta(v) {
    const h = yazi(v);
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(h);
    if (m)
        return `${m[3]}.${m[2]}.${m[1]}`;
    const d = h ? new Date(h) : null;
    return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" }) : h;
}
function saatYaz(v) {
    const d = v ? new Date(yazi(v)) : null;
    return d && !Number.isNaN(d.getTime()) ? d.toLocaleTimeString("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit" }) : "";
}
export function sarrafFisVerisi(g, firma) {
    const satim = Number(g.tip) === 1;
    const fisNo = (yazi(g.seriNo) ? `${yazi(g.seriNo)}-` : "") + (yazi(g.belgeNo) || (g.fisId ? String(g.fisId) : ""));
    const satirlar = (Array.isArray(g.satirlar) ? g.satirlar : [])
        .filter(l => sayiOku(l.miktar) > 0 || sayiOku(l.tutar) > 0 || sayiOku(l.adet) > 0 || yazi(l.urunAdi) !== "")
        .map((l, i) => {
        const miktar = sayiOku(l.miktar), adet = sayiOku(l.adet), milyem = sayiOku(l.milyem), has = sayiOku(l.hasGram), kur = sayiOku(l.kur), tutar = sayiOku(l.tutar);
        return {
            sira: i + 1, kod: yazi(l.urunKodu), ad: yazi(l.urunAdi) || yazi(l.urunKodu) || `Satır ${i + 1}`, aciklama: yazi(l.aciklama),
            adet, miktar, milyem, has, kur, tutar, hasVar: has > 0,
            miktarYazi: miktar > 0 ? `${tr(miktar)} gr` : adet > 0 ? `${adet} ad` : "-",
            ayarKur: milyem > 0 ? String(milyem) : kur > 0 ? tr(kur) : "-",
            adetYazi: adet > 0 ? String(adet) : "-", miktarGr: miktar > 0 ? tr(miktar) : "-", milyemYazi: milyem > 0 ? String(milyem) : "-",
            hasYazi: has > 0 ? tr(has, 4) : "-", kurYazi: kur > 0 ? tr(kur) : "-",
        };
    });
    const odemeler = (Array.isArray(g.odemeSatirlari) ? g.odemeSatirlari : [])
        .filter(o => sayiOku(o.miktar) > 0 || sayiOku(o.tutar) > 0 || sayiOku(o.adet) > 0 || yazi(o.paraKodu) !== "")
        .map((o, i) => {
        const miktar = sayiOku(o.miktar) || sayiOku(o.adet);
        return { sira: i + 1, ad: yazi(o.paraKodu) || yazi(o.paraAdi) || "Nakit TL", miktar, miktarYazi: miktar > 0 ? tr(miktar) : "", tutar: sayiOku(o.tutar) };
    });
    const tutar = sayiOku(g.toplamTutar), has = sayiOku(g.toplamHas), odenen = sayiOku(g.odenenTutar), kalan = sayiOku(g.kalanTutar);
    const tarih = tarihNokta(g.tarih);
    const saat = yazi(g.saat).slice(0, 5);
    return {
        belgeTuru: "SARRAF_FIS", fisId: Number(g.fisId) || 0, satim, tipAdi: satim ? "SATIŞ" : "ALIŞ",
        baslik: satim ? "SARRAF SATIŞ FİŞİ" : "SARRAF ALIŞ FİŞİ",
        fisNo, tarih, saat, vezne: yazi(g.vezneKod), kasiyer: yazi(g.kullaniciAdi),
        firma,
        musteri: {
            unvan: yazi(g.unvan) || "PERAKENDE MÜŞTERİ", kimlikNo: yazi(g.vergiKimlikNo), telefon: yazi(g.detayTelefonNo), adres: yazi(g.detayAdres),
            ilce: yazi(g.detayIlce), il: yazi(g.detayIl), ilceIl: [yazi(g.detayIlce), yazi(g.detayIl)].filter(Boolean).join(" / "), pasaportNo: yazi(g.detayPasaportNo),
        },
        satirlar, odemeler, odemeVar: odemeler.length > 0,
        toplam: { tutar, has, hasVar: has > 0, odenen, odenenVar: odenen > 0, kalan: Math.abs(kalan), kalanVar: kalan !== 0, yaziyla: fisYaziyla(tutar) },
        qr: `VKN:${firma.vkn}|NO:${fisNo}|TAR:${yazi(g.tarih)}|TOP:${tutar.toFixed(2)}|HAS:${has.toFixed(4)}`,
        onizleme: false, iptal: false,
    };
}
export function perakendeFisVerisi(g, firma) {
    const satirlar = (Array.isArray(g.satirlar) ? g.satirlar : []).map((s, i) => {
        const gram = sayiOku(s.gram), has = sayiOku(s.hasGram), birimFiyat = sayiOku(s.birimFiyat);
        return {
            sira: sayiOku(s.satirNo) || i + 1, barkod: yazi(s.barkod), ad: yazi(s.urunAdi), ayar: yazi(s.ayar), miktar: sayiOku(s.miktar), birim: yazi(s.birim),
            gram, has, birimFiyat, kdvOrani: sayiOku(s.kdvOrani), kdvTutari: sayiOku(s.kdvTutari), toplam: sayiOku(s.toplamTutar),
            barkodAyar: [yazi(s.barkod), yazi(s.ayar)].join(" | "), gramYazi: `${tr(gram)}g`,
        };
    });
    const iskonto = sayiOku(g.iskontoTutari), iskontoOrani = sayiOku(g.iskontoOrani), genel = sayiOku(g.genelToplam);
    const faturaNo = yazi(g.faturaNo), ettn = yazi(g.ettn), kimlik = yazi(g.aliciVknTckn) || "11111111111";
    const iade = Number(g.faturaTipi) === 2;
    return {
        belgeTuru: "PERAKENDE_FIS", faturaId: Number(g.faturaId) || 0, faturaNo, ettn, senaryo: yazi(g.senaryo) || "EARSIVFATURA",
        iade, faturaTipiAdi: iade ? "İADE" : "SATIS", baslik: iade ? "PERAKENDE İADE BİLGİ FİŞİ" : "PERAKENDE SATIŞ BİLGİ FİŞİ", tarih: tarihNokta(g.tarih), saat: saatYaz(g.tarih), paraKodu: yazi(g.paraKodu) || "TL",
        firma,
        musteri: {
            unvan: yazi(g.aliciUnvan) || "NİHAİ TÜKETİCİ", kimlikNo: kimlik, vergiDairesi: yazi(g.vergiDairesi), adres: yazi(g.adres) || "-",
            ilce: yazi(g.ilce) || "-", il: yazi(g.il) || "-", telefon: yazi(g.telefon), eposta: yazi(g.eposta),
        },
        satirlar,
        toplam: {
            gram: satirlar.reduce((t, s) => t + s.gram, 0), has: satirlar.reduce((t, s) => t + s.has, 0),
            ara: sayiOku(g.araToplam), kdv: sayiOku(g.toplamKdv), iskonto, iskontoVar: iskonto > 0, iskontoOrani,
            iskontoEtiket: iskontoOrani > 0 ? `İskonto (%${iskontoOrani})` : "İskonto", genel, yaziyla: fisYaziyla(genel),
        },
        qr: `VKN:${firma.vkn}|AVKN:${kimlik}|NO:${faturaNo}|ETTN:${ettn}|TAR:${yazi(g.tarih)}|TOP:${genel.toFixed(2)}`,
        onizleme: false, iptal: false,
    };
}
const ODEME_TURU_ADI = { 0: "Nakit", 1: "Cari (veresiye)", 2: "Kredi kartı", 3: "Havale / EFT" };
export function ticariFisVerisi(g, firma) {
    const ham = Array.isArray(g.satirlar) ? g.satirlar : [];
    const hesap = ticariFisHesapla(ham.map((s) => ({ miktar: sayiOku(s.miktar) || 0.0001, kdvDahilFiyat: sayiOku(s.kdvDahilFiyat), kdvOrani: sayiOku(s.kdvOrani),
        iskontoTuru: (Number(s.iskontoTuru) || 0), iskontoDegeri: sayiOku(s.iskontoDegeri) })), { turu: (Number(g.iskontoTuru) || 0), deger: sayiOku(g.iskontoDegeri) });
    const satirlar = hesap.satirlar.map((h, i) => {
        const s = ham[i];
        const tur = Number(s.iskontoTuru) || 0;
        const iskontoYazi = tur === 1 ? `%${tr(sayiOku(s.iskontoDegeri), 0)}` : tur === 2 ? `${tr(sayiOku(s.iskontoDegeri))} TL` : "";
        return {
            sira: sayiOku(s.satirNo) || i + 1, kod: yazi(s.kod), barkod: yazi(s.barkod), ad: yazi(s.urunAdi), miktar: h.miktar, miktarYazi: `${tr(h.miktar, Number.isInteger(h.miktar) ? 0 : 3)} ${yazi(s.birim)}`.trim(),
            birim: yazi(s.birim), kdvDahilFiyat: h.kdvDahilFiyat, birimFiyat: h.birimFiyat, kdvOrani: h.kdvOrani, kdvTutari: h.kdvTutari,
            brut: h.brutDahil, iskontoYazi, iskontoVar: h.satirIskontoDahil > 0, satirIskonto: h.satirIskontoDahil, matrah: h.matrah, toplam: h.toplamTutar,
            kodBarkod: [yazi(s.kod), yazi(s.barkod)].filter(Boolean).join(" | "), fiyatYazi: `${tr(h.miktar, Number.isInteger(h.miktar) ? 0 : 3)} x ${tr(h.kdvDahilFiyat)}`,
            // Perakende şablonundan gelen alanlar boş kalmasın
            ayar: "", gram: 0, has: 0, barkodAyar: yazi(s.barkod), gramYazi: `${tr(h.miktar, Number.isInteger(h.miktar) ? 0 : 3)} ${yazi(s.birim)}`.trim(),
        };
    });
    const kdvOranlari = [...new Set(hesap.satirlar.map((s) => s.kdvOrani))].sort((a, b) => a - b);
    const kdvDokumu = kdvOranlari.map((oran) => {
        const ss = hesap.satirlar.filter((s) => s.kdvOrani === oran);
        return { oran, matrah: yuvarla2(ss.reduce((t, s) => t + s.matrah, 0)), kdv: yuvarla2(ss.reduce((t, s) => t + s.kdvTutari, 0)) };
    });
    const odemeler = (Array.isArray(g.odemeler) ? g.odemeler : []).filter((o) => sayiOku(o.tutar) > 0).map((o, i) => {
        const tur = Number(o.odemeAraciTuru) || 0;
        const kod = yazi(o.paraKodu) || "TL";
        return { sira: i + 1, tur: ODEME_TURU_ADI[tur] || "Nakit", ad: tur === 1 ? yazi(o.cariUnvan) || "Cari" : tur === 0 && !["TL", "TRY"].includes(kod) ? `${kod} ${tr(sayiOku(o.miktar))}` : ODEME_TURU_ADI[tur] || "Nakit", tutar: sayiOku(o.tutar) };
    });
    const odenen = yuvarla2(odemeler.reduce((t, o) => t + o.tutar, 0));
    const satirIskonto = yuvarla2(hesap.satirlar.reduce((t, s) => t + s.satirIskontoDahil, 0));
    const iskonto = yuvarla2(satirIskonto + hesap.baslikIskontoDahil);
    const faturaNo = yazi(g.faturaNo), ettn = yazi(g.ettn), kimlik = yazi(g.aliciVknTckn) || "11111111111";
    const iskontoOrani = Number(g.iskontoTuru) === 1 ? sayiOku(g.iskontoDegeri) : 0;
    return {
        belgeTuru: "TICARI_FIS", faturaId: Number(g.faturaId) || 0, faturaNo, ettn, senaryo: yazi(g.senaryo) || "EARSIVFATURA",
        iade: false, faturaTipiAdi: "SATIS", baslik: "SATIŞ BİLGİ FİŞİ", tarih: tarihNokta(g.tarih), saat: saatYaz(g.tarih), paraKodu: "TL", vezne: yazi(g.vezneKod),
        firma,
        musteri: {
            unvan: yazi(g.aliciUnvan) || "NİHAİ TÜKETİCİ", kimlikNo: kimlik, vergiDairesi: yazi(g.vergiDairesi), adres: yazi(g.adres) || "-",
            ilce: yazi(g.ilce) || "-", il: yazi(g.il) || "-", telefon: yazi(g.telefon), eposta: yazi(g.eposta),
        },
        satirlar,
        kdvDokumu,
        odemeler, odemeVar: odemeler.length > 0,
        toplam: {
            kalem: satirlar.length, miktar: yuvarla2(satirlar.reduce((t, s) => t + s.miktar, 0)),
            brut: hesap.brutDahil, satirIskonto, fisIskonto: hesap.baslikIskontoDahil, fisIskontoVar: hesap.baslikIskontoDahil > 0,
            iskonto, iskontoVar: iskonto > 0, iskontoOrani, iskontoEtiket: iskontoOrani > 0 ? `İskonto (%${tr(iskontoOrani, 0)})` : "İskonto",
            ara: hesap.matrah, kdv: hesap.toplamKdv, genel: hesap.genelToplam, yaziyla: fisYaziyla(hesap.genelToplam),
            odenen, paraUstu: yuvarla2(Math.max(0, odenen - hesap.genelToplam)), paraUstuVar: odenen - hesap.genelToplam > 0.004,
            gram: 0, has: 0,
        },
        qr: `VKN:${firma.vkn}|AVKN:${kimlik}|NO:${faturaNo}|ETTN:${ettn}|TAR:${yazi(g.tarih)}|TOP:${hesap.genelToplam.toFixed(2)}`,
        onizleme: false, iptal: false,
    };
}
