import { IKILI_TIPLER, METIN_TIPLERI, SAYI_TIPLERI, karakterUzunlugu, kolonBul, q, tabloBul, tamAd, tipTanimi, } from "./aktarimSema.js";
/**
 * Ortama göre bilerek yeniden yazılan yapılandırma kolonları: aktarımda DegerKurali ile yazılır; bağımsız doğrulamada
 * (aktarım bilgisi olmadan) karşılaştırılmaz.
 */
export const YAPILANDIRMA_KOLONLARI = [{ tablo: "TODVZ_TANIM", kolon: "DIGER_VERITABANI_ADI" }];
/**
 * Eski sürümde olup bizim şemada karşılığı olmayan kolonlar: yalnız izinli değerdeyse (varsayılan) kaybolmaz sayılır;
 * başka değer varsa aktarım durur ve kural eklenmesi istenir.
 */
export const BIRAKILABILIR_KOLONLAR = [
    { tablo: "TODVZ_SARRAF_FISI", kolon: "HESAP_ISLEYISI", izinli: (k) => `ISNULL(${k}, 0) = 0`, aciklama: "Eski hesap işleyişi yalnız varsayılan (0) iken bırakılır" },
    // Muhasebe fiş satırındaki "servis oluşturdu" işareti bizim sürümde yok; yalnız hayır (0) iken bırakılır, evet olan satır varsa aktarım durur
    { tablo: "TODVZ_MUH_FIS_SATIRI", kolon: "SERVIS_OLUSTURDU", izinli: (k) => `ISNULL(${k}, 0) = 0`, aciklama: "Eski SERVIS_OLUSTURDU yalnız hayır (0) iken bırakılır" },
];
/**
 * Eski sürümde boş bırakılabilen, bizim şemada zorunlu (NOT NULL) kolonlar için boş değerin karşılığı (19.11.2026 denetimi).
 * Burada yoksa: hedef kolonun şemadaki sabit varsayılanı yazılır; o da yoksa boş satır varken aktarım incelemede durur
 * (önceden kopyalama sırasında ham "Cannot insert the value NULL" hatasıyla geri alınıyordu).
 */
export const BOS_DEGER_KURALLARI = [
    { tablo: "TODVZ_MASAK_ISLEM_BILDIRIMI", kolon: "BIL_YENI_EK", deger: "0", aciklama: "boş işaret hayır (0)" },
    { tablo: "TODVZ_SARRAF_FISI_SATIRI", kolon: "ISCILIK_MIKTARI", deger: "0", aciklama: "boş işçilik miktarı 0" },
];
/** Hedef kolonun şemadaki varsayılanı sabit bir sayı / metin ise SQL ifadesi; fonksiyon (GETDATE, NEWID …) ya da yoksa null. */
export const sabitVarsayilan = (k) => {
    if (!k.varsayilan)
        return null;
    let v = k.varsayilan.trim();
    while (v.startsWith("(") && v.endsWith(")"))
        v = v.slice(1, -1).trim();
    return /^-?\d+(\.\d+)?$/.test(v) || /^N?'(?:[^']|'')*'$/.test(v) ? v : null;
};
const NEWID = () => "CONVERT(varchar(40), NEWID())";
const sarraf = (hedef, gereken, ifade, aciklama, ek = {}) => ({
    tablo: "TODVZ_SARRAF_FISI",
    hedef,
    gereken,
    ifade,
    aciklama,
    taslak: true,
    ...ek,
});
const sarrafSatir = (hedef, gereken, ifade, aciklama, ek = {}) => ({
    ...sarraf(hedef, gereken, ifade, aciklama, ek),
    tablo: "TODVZ_SARRAF_FISI_SATIRI",
});
const kmv = (tablo) => ({
    tablo,
    hedef: "KMV_UYGULAMA_SEKLI",
    gereken: ["KMV_KURA_DAHIL"],
    ifade: (k) => `CASE ${k("KMV_KURA_DAHIL")} WHEN 1 THEN 2 WHEN 0 THEN 3 ELSE NULL END`,
    tuketilen: ["KMV_KURA_DAHIL"],
    aciklama: "Eski firma ayarı KMV_KURA_DAHIL → KMV_UYGULAMA_SEKLI (1 → 2 kura dahil, 0 → 3 kurdan hariç)",
});
/**
 * Sürüm kuralları: eski programın 2025.01.02 sürümü ile bizim şemanın (2025.12.16) farkları. Bir tablo/kolon için
 * sıradaki ilk uygun kural kullanılır. Yeni sürüm farkı çıktığında buraya eklenir (Faz 7: kuyum / sarraf).
 */
export const KOLON_KURALLARI = [
    // FİŞ: değer eski bit ile AYNI kalır (1 = kura dahil). Yeni sürümün e-Döviz belge görünümleri (VODVZ_E_DOVIZ_BELGESI, _XSLT, _NOTE)
    // fişteki KMV_UYGULAMA_SEKLI'yi eski KMV_KURA_DAHIL gibi okur: yalnız 1 iken "K.M.V. Kura dahildir" der ve ödenecek tutara KMV eklemez;
    // diğer her değerde (0, 2, 3, boş) KMV'yi tutara ekler. Bizim e-Döviz gönderimi ve belge çıktısı tutarı bu görünümden alır
    // (ebelgeKaynak.service dovizGirdisi). 19.11.2026 denetimi: önceki kural (1 → 2) ile örnek yedekte gönderilmeyi bekleyen 611 satış
    // belgesinin 601'i KMV kadar (toplam 57.462 TL) fazla ödenecek tutarla gidecekti. Eski 0 → 3 (kurdan hariç; görünüm de hariç sayar).
    {
        tablo: "TODVZ_FIS",
        hedef: "KMV_UYGULAMA_SEKLI",
        gereken: ["KMV_KURA_DAHIL"],
        ifade: (k) => `CASE ${k("KMV_KURA_DAHIL")} WHEN 1 THEN 1 WHEN 0 THEN 3 ELSE NULL END`,
        tuketilen: ["KMV_KURA_DAHIL"],
        aciklama: "Eski fiş KMV_KURA_DAHIL → KMV_UYGULAMA_SEKLI (1 → 1 kura dahil: e-Döviz belge görünümü böyle okur; 0 → 3 kurdan hariç)",
    },
    // FİRMA TANIMI (ve günlüğü): bizim ekranların okuduğu ayar — 1 uygulanmasın, 2 kura dahil, 3 kurdan hariç (Firma Tanımları, Döviz Fişi)
    kmv("TODVZ_TANIM"),
    kmv("TODVZ_LOG_TANIM"),
    kmv("TODVZ_LOG_FIS"),
    {
        tablo: "TODVZ_TANIM",
        hedef: "GRAM_ONDALIK_SAYISI",
        gereken: ["ALTIN_GRAM_SAYISI"],
        ifade: (k) => `ISNULL(${k("ALTIN_GRAM_SAYISI")}, 2)`,
        tuketilen: ["ALTIN_GRAM_SAYISI"],
        aciklama: "Eski ALTIN_GRAM_SAYISI → GRAM_ONDALIK_SAYISI",
    },
    { tablo: "TODVZ_TANIM", hedef: "GRAM_ONDALIK_SAYISI", gereken: [], ifade: () => "2", aciklama: "GRAM_ONDALIK_SAYISI varsayılan 2" },
    {
        tablo: "TODVZ_TANIM",
        hedef: "MUSAVIR_TURMOB_SIFRESI",
        gereken: ["NOTER_MUSAVIR_SIFRESI"],
        ifade: (k) => k("NOTER_MUSAVIR_SIFRESI"),
        tuketilen: ["NOTER_MUSAVIR_SIFRESI"],
        aciklama: "Eski NOTER_MUSAVIR_SIFRESI → MUSAVIR_TURMOB_SIFRESI (mükellef sorgu şifresi)",
    },
    {
        tablo: "TODVZ_TANIM",
        hedef: "VERGI_SORGULAYAN_TC_NO",
        gereken: ["NOTER_MUSAVIR_KIMLIK_NO"],
        ifade: (k) => k("NOTER_MUSAVIR_KIMLIK_NO"),
        tuketilen: ["NOTER_MUSAVIR_KIMLIK_NO"],
        aciklama: "Eski NOTER_MUSAVIR_KIMLIK_NO → VERGI_SORGULAYAN_TC_NO",
    },
    {
        tablo: "TODVZ_PARA",
        hedef: "URUN_TIPI",
        gereken: ["KUYUM"],
        ifade: (k) => `CASE WHEN ISNULL(${k("KUYUM")}, 0) = 1 THEN CASE WHEN UPPER(ISNULL(${k("AD")}, N'')) LIKE N'%GÜMÜŞ%' OR UPPER(ISNULL(${k("AD")}, N'')) LIKE N'%GUMUS%' THEN 2 ELSE 1 END ELSE 0 END`,
        tuketilen: ["KUYUM"],
        aciklama: "Eski KUYUM işareti → URUN_TIPI (0 döviz, 1 altın, adında GÜMÜŞ geçen 2 gümüş)",
    },
    { tablo: "TODVZ_PARA", hedef: "URUN_TIPI", gereken: [], ifade: () => "0", aciklama: "URUN_TIPI varsayılan 0 (döviz)" },
    {
        tablo: "TODVZ_PARA",
        hedef: "BIRIM",
        gereken: ["KUYUM"],
        ifade: (k) => `CASE WHEN ISNULL(${k("KUYUM")}, 0) = 1 THEN 0 ELSE NULL END`,
        aciklama: "Kuyum ürününde BIRIM 0 (CKODVZ_PARA kuralı: döviz → BIRIM boş)",
    },
    { tablo: "TODVZ_FIS", hedef: "BELGE_TURU", gereken: [], ifade: () => "0", aciklama: "BELGE_TURU 0 (yeni fiş kaydıyla aynı)" },
    {
        tablo: "TODVZ_FIS",
        hedef: "E_FATURA_ETTN",
        gereken: [],
        ifade: () => "CONVERT(varchar(40), NEWID())",
        deterministik: false,
        aciklama: "E_FATURA_ETTN yeni GUID (yeni fiş kaydıyla aynı; e-Döviz ETTN'i satırdaki ETTN'dir, değişmez)",
    },
    // ---- Sarraf fişi (kuyum, K8 — TASLAK: gerçek kuyumcu yedeğiyle deneme aktarımında doğrulanacak)
    // Satır ürünü: bizim şemada satır URUN_ID = TODVZ_PARA.PARA_ID (sarrafFisSql.repository); eskide satırda PARA_ID
    sarrafSatir("URUN_ID", ["PARA_ID"], (k) => k("PARA_ID"), "Eski satır PARA_ID → URUN_ID (ürün = para cinsi)", { tuketilen: ["PARA_ID"], taslak: false }),
    sarrafSatir("HAS_GRAM", ["MUTABAKAT_MIKTARI"], (k) => k("MUTABAKAT_MIKTARI"), "Eski MUTABAKAT_MIKTARI → HAS_GRAM (has karşılığı)", { tuketilen: ["MUTABAKAT_MIKTARI"] }),
    sarrafSatir("ISCILIK_HAS_GRAM", ["ISCILIK_MUTABAKAT_MIKTARI"], (k) => k("ISCILIK_MUTABAKAT_MIKTARI"), "Eski ISCILIK_MUTABAKAT_MIKTARI → ISCILIK_HAS_GRAM", { tuketilen: ["ISCILIK_MUTABAKAT_MIKTARI"] }),
    sarrafSatir("URUN_TIPI", ["PARA_ID"], (k, kt) => `ISNULL((SELECT CASE WHEN ISNULL(P.KUYUM, 0) = 1 THEN CASE WHEN UPPER(ISNULL(P.AD, N'')) LIKE N'%GÜMÜŞ%' OR UPPER(ISNULL(P.AD, N'')) LIKE N'%GUMUS%' THEN 2 ELSE 1 END ELSE 0 END FROM ${kt("TODVZ_PARA")} P WHERE P.PARA_ID = ${k("PARA_ID")}), 0)`, "Satır ürün tipi ürünün (PARA) kuyum işaretinden"),
    sarrafSatir("KUR", [], () => "0", "KUR eski sürümde yok (0)"),
    sarrafSatir("TUTAR", [], () => "0", "TUTAR eski sürümde yok (0)"),
    // Başlık
    sarraf("FAVORI_PARA_ID", ["PARA_ID"], (k) => k("PARA_ID"), "Eski başlık PARA_ID → FAVORI_PARA_ID (fişin parası)", { tuketilen: ["PARA_ID"] }),
    sarraf("UNVAN", [], (k, kt) => `ISNULL((SELECT TOP 1 C.AD FROM ${kt("TODVZ_CARI_KART")} C WHERE C.CARI_KART_ID = ${k("CARI_KART_ID")}), N'')`, "UNVAN carinin adından"),
    sarraf("GUID", [], NEWID, "GUID yeni (yeni fiş kaydıyla aynı)", { deterministik: false, taslak: false }),
    sarraf("E_FATURA_ETTN", [], NEWID, "E_FATURA_ETTN yeni", { deterministik: false, taslak: false }),
    sarraf("E_IRSALIYE_ETTN", [], NEWID, "E_IRSALIYE_ETTN yeni", { deterministik: false, taslak: false }),
    sarraf("BELGE_TURU", [], () => "0", "BELGE_TURU 0", { taslak: false }),
    sarraf("ALIS_KURU", [], () => "0", "ALIS_KURU eski sürümde yok (0)"),
    sarraf("SATIS_KURU", [], () => "0", "SATIS_KURU eski sürümde yok (0)"),
    sarraf("ALTIN_HAS_KURU", [], () => "0", "ALTIN_HAS_KURU eski sürümde yok (0)"),
    sarraf("GUMUS_HAS_KURU", [], () => "0", "GUMUS_HAS_KURU eski sürümde yok (0)"),
];
/**
 * Şablonda verisi bırakılan tanım tabloları (docs/sql/LIKYA_SABLON_OLUSTUR.sql, #kalir). Müşteride olmayıp şablonda kalanlardan
 * yalnız bunlar, değiştirilen tanımlara (PARA, VEZNE, KULLANICI …) başvuruyorsa temizlenir; diğer tablolardaki satırlar
 * firma açıldıktan sonra bizim sistemde girilmiştir ve korunur.
 */
export const SABLON_KALIR_TABLOLARI = [
    "TODVZ_ALTIN_URUN", "TODVZ_AYAR", "TODVZ_BANKNOT", "TODVZ_BANKO", "TODVZ_BELGE_SABLON", "TODVZ_DEVIR_AYARLARI", "TODVZ_EBANKA_BANKA",
    "TODVZ_EBANKA_HAREKET_TIPI", "TODVZ_EBELGE_KOD", "TODVZ_EKRAN_RAPORU", "TODVZ_ETIKET_GRUP_NO", "TODVZ_ETIKET_SABLON", "TODVZ_FOREKS_PARA_KODU",
    "TODVZ_GRID", "TODVZ_HESAP", "TODVZ_ISKONTO", "TODVZ_ISTATISTIK", "TODVZ_MUH_HESAP", "TODVZ_NUMERATOR", "TODVZ_PANO", "TODVZ_PANO_SATIRI",
    "TODVZ_PARA", "TODVZ_TABLO_MADDESI", "TODVZ_TANIM", "TODVZ_TANIM_VERGI_SINIRI", "TODVZ_ULKE", "TODVZ_URUN_GRUP", "TODVZ_VEZNE", "TODVZ_YAZICI",
];
/** Hiçbir durumda dokunulmayan tablolar (bizim sistem tabloları) */
export const DOKUNULMAZ_TABLOLAR = ["LKY_SEMA_SURUMU", "LKY_LISANS", "LKY_DURUM"];
// ------------------------------------------------------------------ tip dönüşümleri
const TAMSAYI_ARALIK = {
    bit: ["0", "1"],
    tinyint: ["0", "255"],
    smallint: ["-32768", "32767"],
    int: ["-2147483648", "2147483647"],
    bigint: ["-9223372036854775808", "9223372036854775807"],
};
const TAMSAYI_SIRA = ["bit", "tinyint", "smallint", "int", "bigint"];
const TARIH_TIPLERI = ["date", "datetime", "datetime2", "smalldatetime", "datetimeoffset", "time"];
const ayniTip = (a, b) => a.tip === b.tip && a.uzunluk === b.uzunluk && a.hassasiyet === b.hassasiyet && a.olcek === b.olcek;
/** Kaynak kolonun hedef kolona veri kaybetmeden yazılması için ifade + kayıp denetimi; uygun değilse null. */
export const donusum = (kaynak, hedef) => {
    const K = `K.${q(kaynak.ad)}`;
    const kt = kaynak.tip;
    const ht = hedef.tip;
    if (ayniTip(kaynak, hedef))
        return { ifade: K, denetim: null };
    // metin → metin
    if (METIN_TIPLERI.includes(kt) && METIN_TIPLERI.includes(ht)) {
        const ku = karakterUzunlugu(kaynak);
        const hu = karakterUzunlugu(hedef);
        const unicodeKaybi = ["nvarchar", "nchar", "ntext"].includes(kt) && !["nvarchar", "nchar", "ntext"].includes(ht);
        const kosullar = [];
        if (hu !== null && (ku === null || ku > hu) && !["text", "ntext"].includes(ht))
            kosullar.push(`LEN(${K}) > ${hu}`);
        if (unicodeKaybi)
            kosullar.push(`CAST(CAST(${K} AS varchar(max)) AS nvarchar(max)) COLLATE Latin1_General_BIN2 <> CAST(${K} AS nvarchar(max)) COLLATE Latin1_General_BIN2`);
        return {
            ifade: ["text", "ntext"].includes(kt) ? `CAST(${K} AS ${["nvarchar", "nchar"].includes(ht) ? "nvarchar(max)" : "varchar(max)"})` : K,
            denetim: kosullar.length ? `${K} IS NOT NULL AND (${kosullar.join(" OR ")})` : null,
            denetimMesaji: `metin ${hu} karaktere sığmıyor / karakter kaybı`,
        };
    }
    // sayı → sayı
    if (SAYI_TIPLERI.includes(kt) && SAYI_TIPLERI.includes(ht)) {
        if (ht === "bit") {
            return kt === "bit" ? { ifade: K, denetim: null } : { ifade: K, denetim: `${K} IS NOT NULL AND ${K} NOT IN (0, 1)`, denetimMesaji: "0/1 dışında değer" };
        }
        if (TAMSAYI_ARALIK[ht]) {
            const [en, eb] = TAMSAYI_ARALIK[ht];
            if (TAMSAYI_ARALIK[kt] && TAMSAYI_SIRA.indexOf(kt) <= TAMSAYI_SIRA.indexOf(ht))
                return { ifade: K, denetim: null };
            const kesir = ["float", "real", "decimal", "numeric", "money", "smallmoney"].includes(kt) ? ` OR ${K} <> FLOOR(${K})` : "";
            return { ifade: K, denetim: `${K} IS NOT NULL AND (${K} < ${en} OR ${K} > ${eb}${kesir})`, denetimMesaji: `${ht} aralığı dışında ya da kesirli değer` };
        }
        if (["float", "real"].includes(ht)) {
            // float her tamsayı/ondalığı tutar (çok büyük ondalıklarda yuvarlama olabilir: ondalık → float kabul edilir)
            return { ifade: K, denetim: kt === "float" && ht === "real" ? `${K} IS NOT NULL AND CAST(CAST(${K} AS real) AS float) <> ${K}` : null };
        }
        if (["decimal", "numeric", "money", "smallmoney"].includes(ht)) {
            const p = ht === "money" ? 19 : ht === "smallmoney" ? 10 : hedef.hassasiyet;
            const s = ht === "money" || ht === "smallmoney" ? 4 : hedef.olcek;
            return {
                ifade: K,
                denetim: `${K} IS NOT NULL AND (ABS(CAST(${K} AS float)) >= POWER(CAST(10 AS float), ${p - s}) OR CAST(ROUND(CAST(${K} AS float), ${s}) AS float) <> CAST(${K} AS float))`,
                denetimMesaji: `${tipTanimi(hedef)} hassasiyetine sığmıyor`,
            };
        }
    }
    // ikili → bit (eski sürümde evet/hayır alanları 1 baytlık varbinary)
    if (["varbinary", "binary"].includes(kt) && ht === "bit") {
        return {
            ifade: `CASE WHEN ${K} IS NULL THEN NULL WHEN ${K} = 0x00 OR DATALENGTH(${K}) = 0 THEN 0 ELSE 1 END`,
            denetim: `${K} IS NOT NULL AND DATALENGTH(${K}) > 0 AND ${K} NOT IN (0x00, 0x01)`,
            denetimMesaji: "evet/hayır dışında ikili değer",
        };
    }
    // ikili → ikili
    if (IKILI_TIPLER.includes(kt) && IKILI_TIPLER.includes(ht) && !["timestamp", "rowversion"].includes(ht)) {
        const hu = karakterUzunlugu(hedef);
        return { ifade: kt === "image" ? `CAST(${K} AS varbinary(max))` : K, denetim: hu !== null ? `DATALENGTH(${K}) > ${hu}` : null, denetimMesaji: "ikili veri sığmıyor" };
    }
    // tarih → tarih
    if (TARIH_TIPLERI.includes(kt) && TARIH_TIPLERI.includes(ht)) {
        if (ht === "date" && kt !== "date")
            return { ifade: K, denetim: `${K} IS NOT NULL AND CAST(${K} AS time) <> '00:00'`, denetimMesaji: "saat bilgisi kaybolur" };
        if (ht === "smalldatetime")
            return { ifade: K, denetim: `${K} IS NOT NULL AND CAST(CAST(${K} AS smalldatetime) AS datetime2) <> CAST(${K} AS datetime2)`, denetimMesaji: "saniye kaybolur" };
        if (ht === "datetime" && kt === "datetime2")
            return { ifade: K, denetim: `${K} IS NOT NULL AND (${K} < '17530101' OR CAST(CAST(${K} AS datetime) AS datetime2(7)) <> CAST(${K} AS datetime2(7)))`, denetimMesaji: "datetime aralığı/hassasiyeti" };
        if (ht === "time" || kt === "time")
            return null;
        return { ifade: K, denetim: null };
    }
    // metin → sayı / tarih / guid: değer dönüşebiliyorsa
    if (METIN_TIPLERI.includes(kt) && (SAYI_TIPLERI.includes(ht) || TARIH_TIPLERI.includes(ht) || ht === "uniqueidentifier")) {
        return {
            ifade: `CONVERT(${tipTanimi(hedef)}, NULLIF(LTRIM(RTRIM(${K})), ''))`,
            denetim: `NULLIF(LTRIM(RTRIM(${K})), '') IS NOT NULL AND TRY_CONVERT(${tipTanimi(hedef)}, LTRIM(RTRIM(${K}))) IS NULL`,
            denetimMesaji: `${ht} tipine dönüşmeyen metin`,
        };
    }
    // sayı / guid / tarih → metin
    if (METIN_TIPLERI.includes(ht) && (SAYI_TIPLERI.includes(kt) || kt === "uniqueidentifier" || TARIH_TIPLERI.includes(kt))) {
        const hu = karakterUzunlugu(hedef);
        return { ifade: `CONVERT(${tipTanimi(hedef)}, ${K})`, denetim: hu !== null ? `LEN(CONVERT(nvarchar(4000), ${K})) > ${hu}` : null, denetimMesaji: "metne sığmıyor" };
    }
    if (kt === "uniqueidentifier" && ht === "uniqueidentifier")
        return { ifade: K, denetim: null };
    return null;
};
/** Kaynakta "dolu" sayılan değer koşulu (kayıp kolon denetimi) */
export const doluKosulu = (k) => {
    const K = `K.${q(k.ad)}`;
    if (METIN_TIPLERI.includes(k.tip))
        return `${K} IS NOT NULL AND LEN(LTRIM(RTRIM(CAST(${K} AS nvarchar(max))))) > 0`;
    if (IKILI_TIPLER.includes(k.tip))
        return `${K} IS NOT NULL AND DATALENGTH(${K}) > 0`;
    return `${K} IS NOT NULL`;
};
// ------------------------------------------------------------------ plan
/** Değiştirilen tabloların tek kolonlu birincil anahtarları: PARA_ID → TODVZ_PARA … */
const anahtarHaritasi = (hedef, kopyalananlar) => {
    const m = new Map();
    for (const t of hedef.values()) {
        if (!kopyalananlar.has(t.ad.toUpperCase()) || t.birincilAnahtar.length !== 1)
            continue;
        const pk = t.birincilAnahtar[0].toUpperCase();
        if (pk.endsWith("_ID") && !m.has(pk))
            m.set(pk, t.ad);
    }
    return m;
};
export const planOlustur = (kaynakDb, hedefDb, kaynak, hedef, secenek = {}) => {
    const plan = { kaynakDb, hedefDb, tablolar: [], engeller: [], denetimler: [], kurallar: [], bosBirakilan: [] };
    const kopyalananlar = new Set();
    // 1) Kaynaktaki her tablo
    for (const kt of [...kaynak.values()].sort((a, b) => a.ad.localeCompare(b.ad))) {
        const ht = tabloBul(hedef, kt.ad);
        if (!ht) {
            if (kt.satir > 0) {
                plan.engeller.push({ kod: "KAYIP_TABLO", seviye: "ENGEL", mesaj: `${kt.ad} tablosu (${kt.satir} satır) bizim şemada yok; veri kaybolur. Bu tablo için kural eklenmeli.` });
            }
            else {
                plan.tablolar.push({ tablo: kt.ad, islem: "ATLA", kaynakSatir: 0, hedefSatir: 0, kolonlar: [], kimlikEkle: false, anahtar: [], notlar: ["Boş tablo, bizim şemada yok; atlandı."] });
            }
            continue;
        }
        if (DOKUNULMAZ_TABLOLAR.includes(ht.ad.toUpperCase()))
            continue;
        kopyalananlar.add(ht.ad.toUpperCase());
        plan.tablolar.push(tabloPlani(plan, kt, ht, secenek));
    }
    // 2) Yalnız hedefte (şablonda) olan tablolar
    const harita = anahtarHaritasi(hedef, kopyalananlar);
    for (const ht of [...hedef.values()].sort((a, b) => a.ad.localeCompare(b.ad))) {
        const ad = ht.ad.toUpperCase();
        if (kopyalananlar.has(ad) || tabloBul(kaynak, ht.ad) || DOKUNULMAZ_TABLOLAR.includes(ad))
            continue;
        const tp = { tablo: ht.ad, islem: "SABLON_KORU", kaynakSatir: 0, hedefSatir: ht.satir, kolonlar: [], kimlikEkle: false, anahtar: [], notlar: [] };
        if (ht.satir > 0 && SABLON_KALIR_TABLOLARI.includes(ad) && !DOKUNULMAZ_TABLOLAR.includes(ad)) {
            const fkIle = ht.bagliOlduguTablolar.filter((b) => kopyalananlar.has(b.toUpperCase()));
            const adIle = ht.kolonlar
                .filter((k) => !ht.birincilAnahtar.some((p) => p.toUpperCase() === k.ad.toUpperCase()))
                .map((k) => harita.get(k.ad.toUpperCase()))
                .filter((x) => !!x);
            const bagli = [...new Set([...fkIle, ...adIle])];
            if (bagli.length) {
                tp.islem = "SABLON_TEMIZLE";
                tp.notlar.push(`Şablondan kalan ${ht.satir} satır değiştirilen tanımlara (${bagli.join(", ")}) başvuruyor; temizlenir.`);
            }
        }
        plan.tablolar.push(tp);
    }
    return plan;
};
const tabloPlani = (plan, kt, ht, secenek = {}) => {
    const tp = {
        tablo: ht.ad,
        islem: "KOPYALA",
        kaynakSatir: kt.satir,
        hedefSatir: ht.satir,
        kolonlar: [],
        kimlikEkle: false,
        anahtar: [],
        notlar: [],
    };
    const kural = (hedefKolon) => KOLON_KURALLARI.find((r) => r.tablo.toUpperCase() === ht.ad.toUpperCase() && r.hedef.toUpperCase() === hedefKolon.toUpperCase() && r.gereken.every((g) => !!kolonBul(kt, g)));
    const tuketilen = new Set();
    const taslaklar = new Set();
    const kAd = (ad) => `K.${q(kolonBul(kt, ad)?.ad ?? ad)}`;
    const ayni = (a, b) => a.toUpperCase() === b.toUpperCase();
    for (const hk of ht.kolonlar) {
        if (hk.hesaplanan || hk.tip === "timestamp" || hk.tip === "rowversion")
            continue;
        const ozel = secenek.degerKurallari?.find((d) => ayni(d.tablo, ht.ad) && ayni(d.kolon, hk.ad));
        if (ozel) {
            tp.kolonlar.push({ hedef: hk.ad, ifade: ozel.ifade(kAd, (x) => !!kolonBul(kt, x)), deterministik: true, kaynak: kolonBul(kt, hk.ad)?.ad ?? null, kural: ozel.aciklama });
            if (kt.satir > 0)
                plan.kurallar.push({ tablo: ht.ad, kolon: hk.ad, aciklama: ozel.aciklama });
            continue;
        }
        const r = kural(hk.ad);
        const kk = kolonBul(kt, hk.ad);
        if (kk && secenek.yapilandirmaKarsilastirmaDisi && YAPILANDIRMA_KOLONLARI.some((y) => ayni(y.tablo, ht.ad) && ayni(y.kolon, hk.ad))) {
            tp.kolonlar.push({ hedef: hk.ad, ifade: `K.${q(kk.ad)}`, deterministik: true, kaynak: kk.ad, kural: "Yapılandırma (ortama göre yeniden yazılır)", karsilastirmaDisi: true });
            continue;
        }
        if (r && !kk) {
            // Kural yalnız kaynakta aynı adlı kolon yoksa (eski sürüm farkı); kolon varsa kaynağın kendi değeri yazılır
            tp.kolonlar.push({ hedef: hk.ad, ifade: r.ifade(kAd, (t) => tamAd(plan.kaynakDb, t)), deterministik: r.deterministik !== false, kaynak: r.gereken[0] ?? null, kural: r.aciklama });
            for (const t of r.tuketilen ?? [])
                tuketilen.add(t.toUpperCase());
            if (kt.satir > 0)
                plan.kurallar.push({ tablo: ht.ad, kolon: hk.ad, aciklama: r.aciklama + (r.taslak ? " (taslak)" : "") });
            if (r.taslak && kt.satir > 0)
                taslaklar.add(r.aciklama);
            continue;
        }
        if (kk) {
            const d = donusum(kk, hk);
            if (!d) {
                if (kt.satir > 0) {
                    plan.engeller.push({
                        kod: "UYUMSUZ_TIP",
                        seviye: "ENGEL",
                        mesaj: `${ht.ad}.${hk.ad}: kaynak ${tipTanimi(kk)} → hedef ${tipTanimi(hk)} dönüşümü tanımlı değil; kural eklenmeli.`,
                    });
                }
                continue;
            }
            // Eski sürümde boş bırakılabilen, bizde zorunlu kolon: boş değerin karşılığı (kural → şema varsayılanı) yazılır; yoksa incelemede durur
            let ifade = d.ifade;
            if (kk.bosOlabilir && !hk.bosOlabilir) {
                const bosKural = BOS_DEGER_KURALLARI.find((b) => ayni(b.tablo, ht.ad) && ayni(b.kolon, hk.ad));
                const deger = bosKural?.deger ?? sabitVarsayilan(hk);
                const bosSorgu = `SELECT COUNT(*) AS N FROM ${tamAd(plan.kaynakDb, kt.ad)} K WHERE K.${q(kk.ad)} IS NULL`;
                if (deger !== null) {
                    ifade = `COALESCE(${d.ifade}, CAST(${deger} AS ${tipTanimi(hk)}))`;
                    if (kt.satir > 0) {
                        plan.denetimler.push({
                            kod: "BOS_ZORUNLU_VARSAYILAN",
                            tablo: ht.ad,
                            kolon: hk.ad,
                            sorgu: bosSorgu,
                            seviye: "UYARI",
                            mesaj: `${ht.ad}.${hk.ad} bizim sürümde zorunlu; eski kayıtta boş olan satırlara ${deger} yazılır (${bosKural?.aciklama ?? "şemanın varsayılanı"})`,
                        });
                    }
                }
                else if (kt.satir > 0) {
                    plan.denetimler.push({
                        kod: "BOS_ZORUNLU",
                        tablo: ht.ad,
                        kolon: hk.ad,
                        sorgu: bosSorgu,
                        seviye: "ENGEL",
                        mesaj: `${ht.ad}.${hk.ad} bizim sürümde zorunlu ve varsayılanı yok, eski kayıtta boş; kural eklenmeli.`,
                    });
                }
            }
            tp.kolonlar.push({ hedef: hk.ad, ifade, deterministik: true, kaynak: kk.ad, kural: null });
            if (d.denetim && kt.satir > 0) {
                plan.denetimler.push({
                    kod: "DONUSUM_KAYBI",
                    tablo: ht.ad,
                    kolon: hk.ad,
                    sorgu: `SELECT COUNT(*) AS N FROM ${tamAd(plan.kaynakDb, kt.ad)} K WHERE ${d.denetim}`,
                    seviye: "ENGEL",
                    mesaj: `${ht.ad}.${hk.ad}: ${tipTanimi(kk)} → ${tipTanimi(hk)} (${d.denetimMesaji || "değer kaybı"})`,
                });
            }
            continue;
        }
        // Hedefte olup kaynakta olmayan kolon
        if (!hk.bosOlabilir && hk.varsayilan === null && !hk.kimlik) {
            if (kt.satir > 0) {
                plan.engeller.push({
                    kod: "ZORUNLU_KOLON",
                    seviye: "ENGEL",
                    mesaj: `${ht.ad}.${hk.ad} zorunlu ve varsayılanı yok, eski sürümde karşılığı yok; kural eklenmeli.`,
                });
            }
            continue;
        }
        plan.bosBirakilan.push({ tablo: ht.ad, kolon: hk.ad });
    }
    // Kaynakta olup hedefte karşılığı olmayan kolonlar: doluysa engel (sessiz kayıp yok)
    for (const kk of kt.kolonlar) {
        if (kk.hesaplanan || kk.tip === "timestamp" || kk.tip === "rowversion")
            continue;
        if (kolonBul(ht, kk.ad) || tuketilen.has(kk.ad.toUpperCase()))
            continue;
        if (kt.satir > 0) {
            const birak = BIRAKILABILIR_KOLONLAR.find((b) => ayni(b.tablo, ht.ad) && ayni(b.kolon, kk.ad));
            plan.denetimler.push({
                kod: "KAYIP_KOLON",
                tablo: ht.ad,
                kolon: kk.ad,
                sorgu: `SELECT COUNT(*) AS N FROM ${tamAd(plan.kaynakDb, kt.ad)} K WHERE ${doluKosulu(kk)}${birak ? ` AND NOT (${birak.izinli(`K.${q(kk.ad)}`)})` : ""}`,
                seviye: "ENGEL",
                mesaj: `${ht.ad}.${kk.ad} eski sürümde var, bizim şemada karşılığı yok; dolu satırlar kaybolur.`,
            });
        }
    }
    if (taslaklar.size) {
        plan.engeller.push({
            kod: "TASLAK_KURAL",
            seviye: secenek.taslakOnay ? "UYARI" : "ENGEL",
            mesaj: `${ht.ad} (${kt.satir} satır) eski sürümden taslak kurallarla çevrilir: ${[...taslaklar].join("; ")}. ` +
                (secenek.taslakOnay
                    ? "Yönetici onayıyla aktarılıyor."
                    : "Önce bir deneme firmasına aktarıp fişleri eski programla karşılaştırın, sonra 'taslak kuralları onaylıyorum' ile aktarın."),
        });
    }
    tp.kimlikEkle = !!ht.kimlikKolonu && tp.kolonlar.some((k) => k.hedef.toUpperCase() === ht.kimlikKolonu.toUpperCase());
    // Doğrulama anahtarı: hedef birincil anahtarı, kaynaktan birebir (kuralsız) geliyorsa
    const pk = ht.birincilAnahtar.length ? ht.birincilAnahtar : ht.kimlikKolonu ? [ht.kimlikKolonu] : [];
    if (pk.length && pk.every((p) => tp.kolonlar.some((k) => k.hedef.toUpperCase() === p.toUpperCase() && k.kural === null && k.deterministik)))
        tp.anahtar = pk;
    else if (kt.satir > 0)
        tp.notlar.push("Birincil anahtar yok; doğrulama satır özetlerinin kümesiyle yapılır.");
    return tp;
};
/** Planın kopyalama komutu (kimlik ekleme dahil). Aynı bağlantıda, işlem içinde çalışır. */
export const kopyalamaKomutu = (plan, tp) => {
    const hedef = tamAd(plan.hedefDb, tp.tablo);
    const kaynak = tamAd(plan.kaynakDb, tp.tablo);
    const kolonlar = tp.kolonlar.map((k) => q(k.hedef)).join(", ");
    const ifadeler = tp.kolonlar.map((k) => k.ifade).join(",\n    ");
    // NOCOUNT kapalı olmalı: yazılan satır sayısı kaynakla karşılaştırılır (oturumda açık kalmış olabilir)
    const ekle = `INSERT INTO ${hedef} WITH (TABLOCK) (${kolonlar})\n  SELECT ${ifadeler}\n  FROM ${kaynak} K;`;
    return "SET NOCOUNT OFF;\n" + (tp.kimlikEkle ? `SET IDENTITY_INSERT ${hedef} ON;\n${ekle}\nSET IDENTITY_INSERT ${hedef} OFF;` : ekle);
};
