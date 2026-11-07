import sql from "mssql";
import { ApiError } from "../../../utils/ApiError.js";
import { RAPOR_UST_SINIR } from "../raporTanim.js";
import { FIS_USD_KOLON_SQL, adetOzeti, usdKuruCozucu, aralikOzeti, filtreler, idFiltre, ozetEk, sinirla } from "../raporOrtak.js";
import { BOLUM_ADI, fisKaynagi } from "../fisKaynak.js";
const YAS_ARALIKLARI = [[0, 17, "0 – 17"], [18, 25, "18 – 25"], [26, 35, "26 – 35"], [36, 50, "36 – 50"], [51, 65, "51 – 65"], [66, 200, "66 ve üzeri"]];
/** İşlem tarihindeki yaş (doğum günü henüz gelmediyse bir eksik) ve yaş aralığı. Saf fonksiyon. */
export function yasAraligi(dogum, islem) {
    const d = dogum ? new Date(dogum) : null, i = new Date(islem);
    if (!d || Number.isNaN(d.getTime()) || Number.isNaN(i.getTime()) || d > i)
        return { yas: null, aralik: "Doğum tarihi yok", sira: 99 };
    let yas = i.getFullYear() - d.getFullYear();
    if (i.getMonth() < d.getMonth() || (i.getMonth() === d.getMonth() && i.getDate() < d.getDate()))
        yas--;
    const k = YAS_ARALIKLARI.findIndex(([a, b]) => yas >= a && yas <= b);
    return { yas, aralik: k >= 0 ? YAS_ARALIKLARI[k][2] : "Doğum tarihi yok", sira: k >= 0 ? k : 99 };
}
/**
 * Fiş kontrolü — şüpheli işlem bildirimi öncesi gözden geçirilecek fişler ve nedenleri. Saf fonksiyon.
 *  1) fiş MASAK listesinde eşleşme işaretli; 2) tutar ≥ eşik ama kimlik no / doğum tarihi / meslek eksik;
 *  3) aynı kimlikle aynı gün en az `n` fiş, her biri eşiğin altında ama toplamı eşiği aşıyor (parçalı işlem).
 */
export function masakKontrol(fisler, esik, n) {
    const neden = new Map();
    const ekle = (id, m) => { if (!neden.has(id))
        neden.set(id, []); neden.get(id).push(m); };
    const gunluk = new Map();
    for (const f of fisler) {
        if (f.masakListesinde)
            ekle(f.fisId, "MASAK listesinde eşleşme");
        if (esik > 0 && f.tutar >= esik) {
            const eksik = [!f.kimlikNo ? "kimlik no" : "", !f.dogumTarihi ? "doğum tarihi" : "", !f.meslekId ? "meslek" : ""].filter(Boolean);
            if (eksik.length)
                ekle(f.fisId, `Eşik üstü, eksik bilgi: ${eksik.join(", ")}`);
        }
        if (f.kimlikNo) {
            const k = `${f.kimlikNo}|${f.gun}`;
            if (!gunluk.has(k))
                gunluk.set(k, []);
            gunluk.get(k).push(f);
        }
    }
    if (esik > 0)
        for (const grup of gunluk.values()) {
            const alti = grup.filter(f => f.tutar < esik), toplam = alti.reduce((a, f) => a + f.tutar, 0);
            if (alti.length >= n && toplam >= esik)
                for (const f of alti)
                    ekle(f.fisId, `Parçalı işlem: aynı gün ${alti.length} fiş, toplam ${toplam.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL`);
        }
    return neden;
}
/** Grup özeti (alt rapor karşılığı): grup, fiş adedi, tutar, pay %. Saf fonksiyon. */
export function grupOzeti(satirlar) {
    const m = new Map();
    for (const s of satirlar) {
        if (!m.has(s.grupBaslik))
            m.set(s.grupBaslik, { grup: s.grupBaslik, adet: 0, tutar: 0, usdKarsiligi: 0 });
        const o = m.get(s.grupBaslik);
        o.adet++;
        o.tutar += s.tutar;
        o.usdKarsiligi += s.usdKarsiligi;
    }
    const genel = [...m.values()].reduce((a, o) => a + o.tutar, 0);
    return [...m.values()].map(o => ({ ...o, pay: genel ? (o.tutar / genel) * 100 : 0 }));
}
/**
 * Ortak sorgu: tarih aralığı + fiş tipi + vezne (+ ek koşul). Satır = fiş satırı (eski MASAK raporlarının alt listeleri gibi: miktar, para, kur, satır tutarı).
 * `tutar` satır tutarı (TL), `fisTutar` fişin TL toplamı; USD karşılığı = satır tutarı ÷ fişin USD kuru, USD satırında miktarın kendisi (`FIS_USD_KOLON_SQL` + `usdKuruCozucu`).
 */
async function masakSatirlari(pool, p, ek = () => "", secenek = {}) {
    if (!p.baslangic || !p.bitis)
        throw ApiError.badRequest("Tarih aralığı zorunludur.");
    // Sektör bölümleri (B22): dört fiş türü lisansa göre; F / S kolon adları TODVZ_FIS / TODVZ_FIS_SATIRI ile aynı, FIS_ID kaynaklar arası tekil
    const k = await fisKaynagi(pool, p);
    const req = pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis).input("tip", sql.Int, p.fisTipi === 0 || p.fisTipi === 1 ? p.fisTipi : null);
    const f = filtreler(req, p, { vezne: "V" }) + ek(req);
    // Şüpheli işlem bildirim formu (eski VODVZR_FIS_MASAK_SUPELI_ISLEMLER.BILDIRIM_FORMU_VAR; yalnız döviz fişi); tablo bu veritabanında yoksa 0
    const var_ = (await pool.request().query(`SELECT CASE WHEN OBJECT_ID('dbo.TODVZ_MASAK_ISLEM_BILDIRIMI','U') IS NULL THEN 0 ELSE 1 END bildirim, CASE WHEN OBJECT_ID('dbo.TODVZ_ULKE','U') IS NULL THEN 0 ELSE 1 END ulke,
    CASE WHEN COL_LENGTH('dbo.TODVZ_ISTATISTIK','ACIKLAMA') IS NULL THEN 0 ELSE 1 END istatistik`)).recordset[0] || {};
    const bildirimSql = var_.bildirim ? "CASE WHEN F.BOLUM=1 AND EXISTS (SELECT 1 FROM dbo.TODVZ_MASAK_ISLEM_BILDIRIMI B WHERE B.FIS_ID=F.FIS_ID) THEN 1 ELSE 0 END" : "0";
    const res = await req.query(`
    SELECT F.FIS_ID fisId, F.BOLUM bolum, S.SATIR_NO satirNo, F.TARIH zaman, ISNULL(F.ZAMAN,F.TARIH) saatZaman, CONVERT(varchar(10), F.TARIH, 120) gun, RTRIM(ISNULL(F.BELGE_NO,'')) belgeNo, RTRIM(ISNULL(F.SERI_NO,'')) seriNo,
      RTRIM(ISNULL(F.UNVAN,'')) unvan, COALESCE(NULLIF(RTRIM(F.VERGI_KIMLIK_NO),''), NULLIF(RTRIM(F.PASAPORT_NO),''), '') kimlikNo, RTRIM(ISNULL(F.VERGI_KIMLIK_NO,'')) vergiKimlikNo, F.TIP tipKod,
      ISNULL(F.TOPLAM_TUTAR,0) fisTutar, ISNULL(S.TUTAR,0) tutar, ISNULL(S.MIKTAR,0) miktar, ISNULL(S.KUR,0) kur, RTRIM(ISNULL(P.KOD,'')) paraKod, ${FIS_USD_KOLON_SQL},
      RTRIM(ISNULL(F.PASAPORT_NO,'')) pasaportNo, RTRIM(ISNULL(F.BABA_ADI,'')) babaAdi, RTRIM(ISNULL(F.ANNE_ADI,'')) anneAdi, RTRIM(ISNULL(F.KIMLIK_SERI_NO,'')) kimlikSeriNo,
      RTRIM(ISNULL(F.ADRES,'')) adres, ${bildirimSql} bildirimFormu, RTRIM(ISNULL(VD.AD,'')) vergiDairesi, ${var_.ulke ? "RTRIM(ISNULL(UY.AD,''))" : "''"} uyruk,
      ISNULL(F.MESLEK_ID,0) meslekId, RTRIM(ISNULL(M.AD,'')) meslek, RTRIM(ISNULL(SK.AD,'')) sektor, F.DOGUM_TARIHI dogumTarihi,
      ISNULL(F.MASAK_LISTESINDE_VAR,0) masakListesinde, RTRIM(ISNULL(SY.AD,'')) supheliYetkili, RTRIM(ISNULL(U.AD,'')) kaydeden, RTRIM(ISNULL(V.KOD,'')) vezneKod,
      ISNULL(F.IPTAL,0) iptal, F.IPTAL_TARIHI iptalTarihi, ${var_.istatistik ? "RTRIM(ISNULL(IST.ACIKLAMA,''))" : "''"} belgeTipi
    FROM ${k.F} JOIN ${k.S} ON S.FIS_ID=F.FIS_ID LEFT JOIN dbo.TODVZ_PARA P ON P.PARA_ID=S.PARA_ID
      LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=F.VEZNE_ID LEFT JOIN dbo.TODVZ_CARI_KART C ON C.CARI_KART_ID=F.CARI_KART_ID
      LEFT JOIN dbo.TODVZ_TABLO_MADDESI M ON M.TABLO_MADDESI_ID=F.MESLEK_ID LEFT JOIN dbo.TODVZ_TABLO_MADDESI SK ON SK.TABLO_MADDESI_ID=C.SEKTOR_ID
      LEFT JOIN dbo.TODVZ_TABLO_MADDESI VD ON VD.TABLO_MADDESI_ID=F.VERGI_DAIRESI_ID AND VD.TUR=0 ${var_.ulke ? "LEFT JOIN dbo.TODVZ_ULKE UY ON UY.ULKE_ID=F.UYRUK_ID" : ""}
      ${var_.istatistik ? "LEFT JOIN dbo.TODVZ_ISTATISTIK IST ON IST.ISTATISTIK_ID=F.ISTATISTIK_ID" : ""}
      LEFT JOIN dbo.TODVZ_KULLANICI U ON U.KULLANICI_ID=F.EKLEYEN_ID LEFT JOIN dbo.TODVZ_KULLANICI SY ON SY.KULLANICI_ID=F.SUPHELI_ISLEMLER_YETKILI_ID
    WHERE ${secenek.iptalDahil ? "1=1" : "ISNULL(F.IPTAL,0)=0"} AND CAST(F.TARIH AS date) BETWEEN @bas AND @bit AND (@tip IS NULL OR F.TIP=@tip) ${f}
    ORDER BY F.BOLUM, CAST(F.TARIH AS date), ISNULL(F.ZAMAN,F.TARIH), F.FIS_ID, S.SATIR_NO;`);
    const usdKuruBul = await usdKuruCozucu(pool, res.recordset);
    const paralar = fisParalari(res.recordset);
    return res.recordset.map((r) => {
        const tutar = Number(r.tutar) || 0, miktar = Number(r.miktar) || 0, usdKuru = Number(usdKuruBul(r)) || 0, bolum = Number(r.bolum) || 1;
        return { ...r, bolum, bolumAd: k.bolumAd(bolum), saat: r.saatZaman, tip: Number(r.tipKod) === 1 ? "Satış" : "Alış", tutar, fisTutar: Number(r.fisTutar) || 0, miktar, kur: Number(r.kur) || 0,
            usdKarsiligi: String(r.paraKod).toUpperCase() === "USD" ? miktar : usdKuru > 0 ? tutar / usdKuru : 0, paralar: paralar.get(Number(r.fisId)) || "", iptal: !!r.iptal,
            meslekId: Number(r.meslekId) || 0, masakListesinde: !!r.masakListesinde, masakListesindeMetin: r.masakListesinde ? "EVET" : "", bildirimFormuMetin: r.bildirimFormu ? "VAR" : "" };
    });
}
/** Fişin işlem gördüğü paralar ("EUR, USD"): fişin satırlarındaki farklı para kodları, kod sırasıyla. Saf fonksiyon. */
export function fisParalari(satirlar) {
    const m = new Map();
    for (const s of satirlar) {
        const id = Number(s.fisId);
        if (!m.has(id))
            m.set(id, new Set());
        if (s.paraKod)
            m.get(id).add(String(s.paraKod));
    }
    return new Map([...m].map(([id, kodlar]) => [id, [...kodlar].sort((a, b) => a.localeCompare(b, "tr")).join(", ")]));
}
/** Satırlardan fiş listesi: tutar = fişin TL toplamı, USD karşılığı = satır karşılıklarının toplamı (kural ve eşik değerlendirmeleri fiş bazındadır). */
function fislereIndir(satirlar) {
    const m = new Map();
    for (const s of satirlar) {
        if (!m.has(s.fisId))
            m.set(s.fisId, { ...s, tutar: s.fisTutar, usdKarsiligi: 0 });
        m.get(s.fisId).usdKarsiligi += s.usdKarsiligi;
    }
    return [...m.values()];
}
/** Nihai tüketici yer tutucu kimlik numarası mı (11111111111, 2222222222 … — tek rakamın tekrarı). Saf fonksiyon. */
export const yerTutucuKimlik = (k) => /^(\d)\1*$/.test(String(k ?? "").replace(/\s/g, ""));
/** Müşteriyi ayırt eden kimlik: yer tutucu numara kimlik sayılmaz ("") */
export const gercekKimlik = (k) => { const x = String(k ?? "").trim(); return yerTutucuKimlik(x) ? "" : x; };
/** Ünvan karşılaştırma biçimi: kırpılmış, Türkçe büyük harf ("İsim beyan edilmemiştir" = "İSİM BEYAN EDİLMEMİŞTİR") */
export const unvanAnahtari = (u) => String(u ?? "").trim().toLocaleUpperCase("tr");
/** Müşteri anahtarı: gerçek kimlik no (yoksa ünvan, büyük harfle); ikisi de yoksa fiş tek başına müşteri sayılır. Saf fonksiyon. */
export const musteriAnahtari = (s) => { const k = gercekKimlik(s.kimlikNo), u = unvanAnahtari(s.unvan); return k || (u ? `~${u}` : `#${s.fisId}`); };
/** Meslek / sektör grup adı; boşsa "… belirtilmemiş" (sektör cari karttan, carisiz fişte boş). Saf fonksiyon. */
export const meslekGrubu = (s) => s.meslek || "Meslek belirtilmemiş";
export const sektorGrubu = (s) => s.sektor || "Sektör belirtilmemiş";
/** Müşteri satırının altındaki iç tablonun (eski alt rapor) satırı: fiş satırı */
const altSatir = (s) => ({ fisId: s.fisId, satirNo: s.satirNo, zaman: s.zaman, saat: s.saat ?? s.zaman, seriNo: s.seriNo, belgeNo: s.belgeNo, tip: s.tip, unvan: s.unvan,
    miktar: s.miktar, paraKod: s.paraKod, kur: s.kur, tutar: s.tutar, usdKarsiligi: s.usdKarsiligi, vezneKod: s.vezneKod, kaydeden: s.kaydeden });
/**
 * Eski meslek / sektör / yaş / yüksek tutar raporlarının yapısı (B20): ana satır = müşteri (ünvan, kimlik, işlem sayısı, tutar [+ doğum tarihi / yaş / meslek / sektör]),
 * müşterinin fiş satırları satırın `_alt` dizisinde (alt rapor: Tarih, Belge no, Ünvan, Miktar, Para, Kur, Tutar + TOPLAM).
 * Müşteri = sektör bölümü × üst grup × kimlik (yoksa ünvan): her bölüm (Döviz / Sarraf / Perakende / Ticari fiş) kendi içinde değerlendirilir, böylece Döviz fişi
 * bölümünün listesi tek bölümlü rapordakiyle aynıdır. İşlem sayısı = fiş adedi, tutar = fişlerin TL toplamı, USD karşılığı = satır karşılıklarının toplamı.
 * `ustGrup` (meslek, sektör, yaş aralığı) grup anahtarıdır ve sıralamayı belirler; `sec` müşteri düzeyinde süzer (işlem sayısı / tutar alt limiti, yaş sınırı, eşik).
 * Özet (üst grup bazında): müşteri sayısı, işlem sayısı, tutar, USD karşılığı, pay % — bölümlerin toplamı. Saf fonksiyon.
 */
export function musteriSatirlari(satirlar, ustGrup, sec = () => true) {
    const m = new Map();
    for (const s of satirlar) {
        const bolum = Number(s.bolum) || 1, ust = ustGrup(s), anahtar = musteriAnahtari(s), k = `${bolum}|${ust}|${anahtar}`;
        if (!m.has(k))
            m.set(k, { bolum, ust, anahtar, ilk: s, fisler: new Map(), usd: 0, satirlar: [] });
        const o = m.get(k);
        o.fisler.set(s.fisId, s.fisTutar);
        o.usd += s.usdKarsiligi;
        o.satirlar.push(s);
    }
    const musteriler = [...m.values()].map(o => ({ ...o, islemSayisi: o.fisler.size, tutar: [...o.fisler.values()].reduce((a, b) => a + b, 0) }))
        .filter(o => sec({ islemSayisi: o.islemSayisi, tutar: o.tutar, ilk: o.ilk }))
        .sort((a, b) => a.bolum - b.bolum || a.ust.localeCompare(b.ust, "tr") || (a.ilk.unvan || "").localeCompare(b.ilk.unvan || "", "tr"));
    const cikti = musteriler.map(o => ({ bolum: o.bolum, bolumAd: BOLUM_ADI[o.bolum] || "", ustGrup: o.ust, unvan: o.ilk.unvan, kimlikNo: o.ilk.kimlikNo,
        vergiKimlikNo: o.ilk.vergiKimlikNo ?? "", pasaportNo: o.ilk.pasaportNo ?? "", meslek: o.ilk.meslek, sektor: o.ilk.sektor, dogumTarihi: o.ilk.dogumTarihi, yas: (o.ilk.yas ?? null),
        islemSayisi: o.islemSayisi, tutar: o.tutar, usdKarsiligi: o.usd, _alt: o.satirlar.map(altSatir) }));
    // Üst grup özeti (meslek / sektör / yaş): müşteri sayısı, işlem (fiş) sayısı, tutar, USD karşılığı, pay % — bölümler birlikte
    const oz = new Map();
    for (const o of musteriler) {
        const g = oz.get(o.ust) || { grup: o.ust || "Tümü", kisiler: new Set(), adet: 0, tutar: 0, usdKarsiligi: 0 };
        g.kisiler.add(o.anahtar);
        g.adet += o.islemSayisi;
        g.tutar += o.tutar;
        g.usdKarsiligi += o.usd;
        oz.set(o.ust, g);
    }
    const gruplar = [...oz.entries()].sort(([a], [b]) => a.localeCompare(b, "tr")).map(([, g]) => g);
    const genel = gruplar.reduce((a, g) => a + g.tutar, 0);
    const ozet = gruplar.map(g => ({ grup: g.grup, musteri: g.kisiler.size, adet: g.adet, tutar: g.tutar, usdKarsiligi: g.usdKarsiligi, pay: genel ? (g.tutar / genel) * 100 : 0 }));
    if (ozet.length > 1)
        ozet.push({ grup: "GENEL TOPLAM", musteri: ozet.reduce((a, g) => a + g.musteri, 0), adet: ozet.reduce((a, g) => a + g.adet, 0), tutar: genel, usdKarsiligi: ozet.reduce((a, g) => a + g.usdKarsiligi, 0), pay: genel ? 100 : 0 });
    return { satirlar: cikti, ozet, fisSatiri: musteriler.reduce((a, o) => a + o.satirlar.length, 0) };
}
/** Müşteri satırlı raporun sonucu: üst sınır eskisi gibi fiş satırı sayısına göre denetlenir (ana satır müşteri olsa da çıktıyı alt tablolar büyütür). */
function musteriSonucu(g, t, filtreOzeti) {
    if (g.fisSatiri > (t.ustSinir || RAPOR_UST_SINIR))
        return { satirlar: [], filtreOzeti, sinirAsildi: true, toplamKayit: g.fisSatiri };
    return sinirla(g.satirlar, t, filtreOzeti, undefined, g.ozet);
}
/** İşlem sayısı / tutar alt limiti (eski @Gecerli formülü): girilen limitlerin hepsi sağlanmalı; girilmeyen (ya da 0) limit uygulanmaz. Saf fonksiyon. */
export const masakLimitleri = (p) => (m) => (!(p.adet > 0) || m.islemSayisi >= p.adet) && (!(p.esik > 0) || m.tutar >= p.esik);
const limitler = masakLimitleri;
const limitOzeti = (p) => `${p.adet > 0 ? ` · İşlem sayısı alt limiti: ${Math.round(p.adet)}` : ""}${p.esik > 0 ? ` · Tutar alt limiti: ${tl(p.esik)} TL` : ""}`;
/** Yaş sınırı (eski "Yaşından küçük / Yaşından büyük"): yaş ≤ küçük sınır VEYA yaş ≥ büyük sınır; sınır girilmemişse herkes, sınır varken yaşı bilinmeyen dışarıda. Saf fonksiyon. */
export const yasUygunMu = (yas, kucuk, buyuk) => (!kucuk && !buyuk) || (yas !== null && yas !== undefined && ((kucuk > 0 && yas <= kucuk) || (buyuk > 0 && yas >= buyuk)));
/**
 * Yüksek tutarda işlemler: `esik` 0 ise sınır yok (eski rapordaki "0 = tümü") → bütün müşteriler. Değilse kipe göre: "donem" müşterinin dönem toplamı ≥ eşik (eski rapor),
 * "gunluk" aynı müşterinin (aynı bölümde; kimlik, yoksa ünvan) günlük fiş toplamı ≥ eşik olan günlerin fişleri, "fis" tek başına eşiği aşan fişler. Saf fonksiyon.
 */
export function yuksekTutar(tum, esik, kip) {
    if (!(esik > 0))
        return musteriSatirlari(tum, () => "");
    let secili = tum;
    if (kip !== "donem") { // fiş ya da kimlik × gün toplamı eşiği aşan fişlerin satırları
        const fisler = fislereIndir(tum), gecen = new Set();
        if (kip === "fis")
            fisler.filter(f => f.tutar >= esik).forEach(f => gecen.add(f.fisId));
        else {
            const m = new Map();
            for (const f of fisler) {
                const k = `${Number(f.bolum) || 1}|${musteriAnahtari(f)}|${f.gun}`;
                m.set(k, [...(m.get(k) || []), f]);
            }
            for (const gr of m.values())
                if (gr.reduce((a, f) => a + f.tutar, 0) >= esik)
                    gr.forEach(f => gecen.add(f.fisId));
        }
        secili = tum.filter(x => gecen.has(x.fisId));
    }
    return musteriSatirlari(secili, () => "", m => kip !== "donem" || m.tutar >= esik);
}
/**
 * Fiş Kontrol Listesi nedenleri: iptal olmayan fişler birlikte değerlendirilir (parçalı işlem dahil; iptal fiş parçalı işlem toplamına girmez),
 * iptal fişler tek başına (MASAK listesi eşleşmesi, eşik üstü eksik bilgi). Saf fonksiyon.
 */
export function kontrolNedenleri(fisler, esik, n) {
    const neden = masakKontrol(fisler.filter(f => !f.iptal), esik, n);
    for (const f of fisler)
        if (f.iptal)
            for (const [id, m] of masakKontrol([f], esik, Math.max(2, n)))
                neden.set(id, m);
    return neden;
}
/** Fiş Kontrol Listesi filtre özeti (kısa; başlık çubuğunu ikiye kırmasın): "Eşik 240.000 TL · Parça ≥ 2". Saf fonksiyon. */
export function kontrolOzeti(esik, kapsam, n) {
    return `Eşik ${esik > 0 ? tl(esik) + " TL" : "yok"} · ${kapsam === "kural" ? `Parça ≥ ${n}` : kapsam === "sinirUstu" ? "Sınır üstü" : "Tümü"}`;
}
/** Fiş Kontrol Listesi sırası (eski rapor): bölüm, tarih (gün), seri no; eşitlikte geliş sırası (zaman, fiş, satır) korunur. Saf fonksiyon. */
export function kontrolSirasi(satirlar) {
    return satirlar.map((s, i) => ({ s, i })).sort((a, b) => (Number(a.s.bolum) || 1) - (Number(b.s.bolum) || 1) || a.s.gun.localeCompare(b.s.gun) || a.s.seriNo.localeCompare(b.s.seriNo, "tr") || a.i - b.i).map(x => x.s);
}
/** Varsayılan yüksek tutar eşiği: firma tanımındaki TL vergi sınırı (yoksa 0 → kullanıcı girmeli) */
async function varsayilanEsik(pool) {
    try {
        return Number((await pool.request().query(`SELECT TOP 1 ISNULL(TL_VERGI_SINIRI,0) e FROM dbo.TODVZ_TANIM`)).recordset[0]?.e) || 0;
    }
    catch {
        return 0;
    }
}
const tipOzeti = (p) => (p.fisTipi === 0 ? " · Alış" : p.fisTipi === 1 ? " · Satış" : "");
const tl = (n) => n.toLocaleString("tr-TR", { maximumFractionDigits: 0 });
/** Gruplu rapor: gruba göre (sıra, ad) dizer, grup içinde zaman sırası korunur */
const grupla = (fisler, grupAdi, grupSirasi = grupAdi) => fisler.map(f => ({ ...f, grupBaslik: grupAdi(f), _s: grupSirasi(f) })).sort((a, b) => (typeof a._s === "number" && typeof b._s === "number" ? a._s - b._s : String(a._s).localeCompare(String(b._s), "tr")));
/** KNSK özeti: toplam / başarılı / başarısız / kara listede çıkan sorgu sayıları (eski rapordaki alt kutuların karşılığı). Saf fonksiyon. */
export function knskOzeti(satirlar) {
    const say = (f) => satirlar.filter(f).length;
    return [{ olcu: "Toplam sorgu", adet: satirlar.length }, { olcu: "Başarılı sorgu", adet: say(s => s.basarili) },
        { olcu: "Başarısız sorgu", adet: say(s => !s.basarili) }, { olcu: "Kara listede çıkan", adet: say(s => s.karaListede) }];
}
/** KNSK "Kara listede" kolonu: eşleşme varsa EVET, yoksa HAYIR. Saf fonksiyon. */
export const karaListeMetni = (v) => (v ? "EVET" : "HAYIR");
/** SORGULANAN_KISILIK_TURU kodları — eski rapordaki @CariTipi formülüyle birebir; tanımsız kod boş basılır. */
const KNSK_CARI_TIPI = { 0: "Şahıs", 1: "Şahıs firması", 2: "Tüzel kişi", 3: "Yetkili Müessese", 4: "Banka" };
/** 19.09.2026 öncesi bizim sorgu ekranı tüzel kişiyi 2 yerine 1 koduyla logladı; o kayıtlar ekranın sabit açıklama ifadelerinden tanınır ve "Tüzel kişi" basılır. */
const BIZIM_ESKI_KNSK_LOGU = /Eşleşme yok|olası eşleşme|MASAK liste ekranı araması|tamamlanamadı/;
export const MASAK_SORGULARI = {
    /**
     * KNSK sorgulama log listesi — müşterinin ad + doğum tarihi + kişilik türüyle yapılan kara liste sorgularının logu.
     * Kaynak: TODVZ_LOG_KNSK_SORGULAMA (canlıda doğrulandı 17.09.2026; kolonlar: ZAMAN, KULLANICI_ID, SORGULANAN_ADI, SORGULANAN_DOGUM_TARIHI,
     * SORGULANAN_KISILIK_TURU, SORGULAMA_BASARILI, KARA_LISTEDE, KARA_LISTE_ADI, ACIKLAMA). Eski rapor görünümü VODVZR_KNSK_SORGULAMA_LOG_LISTESI
     * aynı tabloya kullanıcı adı ve kullanıcının veznesini ekler; burada da öyle. Tablo yoksa boş rapor döner.
     */
    async KNSKLOG1(pool, p, t) {
        if (!p.baslangic || !p.bitis)
            throw ApiError.badRequest("Tarih aralığı zorunludur.");
        const durumAd = { basarili: "Başarılı sorgular", basarisiz: "Başarısız sorgular", karaliste: "Kara listede çıkanlar" };
        const ozet = `${aralikOzeti(p)}${ozetEk(p)}${adetOzeti(p.kullaniciIdler, "personel")}${durumAd[p.durum || ""] ? ` · ${durumAd[p.durum]}` : ""}${p.arama?.trim() ? ` · Arama: "${p.arama.trim()}"` : ""}`;
        const var_ = (await pool.request().query(`SELECT CASE WHEN OBJECT_ID('dbo.TODVZ_LOG_KNSK_SORGULAMA','U') IS NULL THEN 0 ELSE 1 END v`)).recordset[0]?.v;
        if (!var_)
            return sinirla([], t, ozet, "Bu veritabanında KNSK sorgulama log tablosu (TODVZ_LOG_KNSK_SORGULAMA) bulunmuyor.");
        const req = pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis).input("arama", sql.NVarChar(100), p.arama?.trim() ? `%${p.arama.trim()}%` : null);
        const f = filtreler(req, p, { vezne: "V" }) + idFiltre(req, p.kullaniciIdler, "L.KULLANICI_ID", "ku")
            + (p.durum === "basarili" ? " AND ISNULL(L.SORGULAMA_BASARILI,0)=1" : p.durum === "basarisiz" ? " AND ISNULL(L.SORGULAMA_BASARILI,0)=0" : p.durum === "karaliste" ? " AND ISNULL(L.KARA_LISTEDE,0)=1" : "");
        const res = await req.query(`
      SELECT L.ZAMAN zaman, RTRIM(ISNULL(U.AD,'')) kullanici, RTRIM(ISNULL(V.KOD,'')) vezneKod, RTRIM(ISNULL(L.SORGULANAN_ADI,'')) sorgulananAd, L.SORGULANAN_DOGUM_TARIHI dogumTarihi,
        L.SORGULANAN_KISILIK_TURU kisilikKod, ISNULL(L.SORGULAMA_BASARILI,0) basarili, ISNULL(L.KARA_LISTEDE,0) karaListede, RTRIM(ISNULL(L.KARA_LISTE_ADI,'')) karaListeAdi, RTRIM(ISNULL(L.ACIKLAMA,'')) aciklama
      FROM dbo.TODVZ_LOG_KNSK_SORGULAMA L LEFT JOIN dbo.TODVZ_KULLANICI U ON U.KULLANICI_ID=L.KULLANICI_ID LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=U.VEZNE_ID
      WHERE CAST(L.ZAMAN AS date) BETWEEN @bas AND @bit AND (@arama IS NULL OR L.SORGULANAN_ADI LIKE @arama OR L.KARA_LISTE_ADI LIKE @arama) ${f}
      ORDER BY L.ZAMAN;`);
        const satirlar = res.recordset.map((r) => ({ ...r, saat: r.zaman, basarili: !!r.basarili, karaListede: !!r.karaListede, kisilik: Number(r.kisilikKod) === 1 && BIZIM_ESKI_KNSK_LOGU.test(r.aciklama) ? KNSK_CARI_TIPI[2] : KNSK_CARI_TIPI[Number(r.kisilikKod)] ?? "",
            sonuc: r.basarili ? "Başarılı" : "BAŞARISIZ", karaListe: karaListeMetni(r.karaListede) }));
        return sinirla(satirlar, t, ozet, undefined, knskOzeti(satirlar));
    },
    /** Meslek bazında işlem listesi — meslek grubu, müşteri satırı (işlem sayısı + tutar), altında fişleri; işlem sayısı / tutar alt limiti (eski rapordaki gibi) */
    async MSKMES1(pool, p, t) {
        const s = await masakSatirlari(pool, p, req => idFiltre(req, p.meslekIdler, "F.MESLEK_ID", "ms"));
        const g = musteriSatirlari(s, meslekGrubu, limitler(p));
        return musteriSonucu(g, t, `${aralikOzeti(p)}${tipOzeti(p)}${ozetEk(p)}${adetOzeti(p.meslekIdler, "meslek")}${limitOzeti(p)}`);
    },
    /** Sektör bazında işlem listesi — sektör cari kartından; yapı meslek raporuyla aynı */
    async MSKSEK1(pool, p, t) {
        const s = await masakSatirlari(pool, p, req => idFiltre(req, p.sektorIdler, "C.SEKTOR_ID", "sk"));
        const g = musteriSatirlari(s, sektorGrubu, limitler(p));
        return musteriSonucu(g, t, `${aralikOzeti(p)}${tipOzeti(p)}${ozetEk(p)}${adetOzeti(p.sektorIdler, "sektör")}${limitOzeti(p)}`);
    },
    /**
     * Yaş bazında işlem listesi — yaş işlem tarihine göre; müşteri satırında doğum tarihi, yaş ve meslek. Eski rapordaki "Yaşından küçük / Yaşından büyük" sınırları
     * (eski @Gecerli: yaş ≤ küçük sınır VEYA yaş ≥ büyük sınır) ve işlem sayısı / tutar alt limitleri; sınır girilmezse tüm müşteriler yaş aralığına göre listelenir.
     */
    async MSKYAS1(pool, p, t) {
        const s = (await masakSatirlari(pool, p)).map(x => { const y = yasAraligi(x.dogumTarihi, x.zaman); return { ...x, yas: y.yas, yasAraligi: y.aralik, yasSira: y.sira }; });
        const kucuk = p.yasKucuk > 0 ? p.yasKucuk : 0, buyuk = p.yasBuyuk > 0 ? p.yasBuyuk : 0, lim = limitler(p);
        const g = musteriSatirlari(s, x => `${String(x.yasSira).padStart(2, "0")}|${x.yasSira === 99 ? x.yasAraligi : `${x.yasAraligi} yaş`}`, m => lim(m) && yasUygunMu(m.ilk.yas, kucuk, buyuk));
        const temiz = (x) => x.replace(/^\d\d\|/, "");
        return musteriSonucu({ ...g, satirlar: g.satirlar.map(x => ({ ...x, ustGrup: temiz(x.ustGrup) })), ozet: g.ozet.map(o => ({ ...o, grup: temiz(o.grup) })) }, t, `${aralikOzeti(p)}${tipOzeti(p)}${ozetEk(p)}${kucuk ? ` · ${kucuk} yaşından küçük` : ""}${buyuk ? ` · ${buyuk} yaşından büyük` : ""}${limitOzeti(p)}`);
    },
    /**
     * Yüksek tutarda işlem listesi — eşik değerlendirmesi: "donem" (varsayılan, eski rapordaki gibi müşterinin dönem toplamı ≥ eşik), "gunluk" (aynı kimliğin günlük toplamı)
     * veya "fis" (tek fiş). Eşik boşsa firma tanımındaki TL vergi sınırı; 0 girilirse sınır yok (eski rapordaki "0 = tümü"). Müşteri satırında yaş, sektör ve meslek; altında fişleri.
     */
    async MSKYUK1(pool, p, t) {
        const tumu = p.esik === 0;
        const esik = tumu ? 0 : p.esik ?? await varsayilanEsik(pool);
        if (!tumu && !(esik > 0))
            throw ApiError.badRequest("Eşik tutarı girilmelidir (firma tanımında TL vergi sınırı tanımlı değil).");
        const tum = (await masakSatirlari(pool, p)).map(x => ({ ...x, yas: yasAraligi(x.dogumTarihi, x.zaman).yas }));
        const kip = p.birlestir === "gunluk" ? "gunluk" : p.birlestir === "fis" ? "fis" : "donem";
        const kipAdi = { donem: "müşterinin dönem toplamı", gunluk: "müşterinin günlük toplamı", fis: "fiş bazında" }[kip];
        return musteriSonucu(yuksekTutar(tum, esik, kip), t, `${aralikOzeti(p)}${tipOzeti(p)}${ozetEk(p)}${tumu ? " · Tutar alt limiti yok" : ` · Tutar alt limiti ${tl(esik)} TL · ${kipAdi}`}`);
    },
    /** Şüpheli işlem listesi — şüpheli işlemler yetkilisince işaretlenmiş fişlerin satırları (eski rapordaki gibi satır bazında miktar + para, uyruk) */
    async MSKSUP1(pool, p, t) {
        const s = await masakSatirlari(pool, p, () => " AND F.SUPHELI_ISLEMLER_YETKILI_ID IS NOT NULL");
        const gorulen = new Set();
        const satirlar = s.map(x => { const ilk = !gorulen.has(x.fisId); gorulen.add(x.fisId); return { ...x, fisTutar: ilk ? x.fisTutar : 0 }; });
        return sinirla(satirlar, t, `${aralikOzeti(p)}${tipOzeti(p)}${ozetEk(p)} · ${gorulen.size} fiş, ${satirlar.length} satır`);
    },
    /**
     * Şüpheli işlemler fiş kontrol listesi. Kapsam (`durum`): "kural" (varsayılan) otomatik kontrol kurallarına takılan fişler; "sinirUstu" eski rapordaki
     * "TL vergi sınırını dikkate al" (satır tutarı > TL vergi sınırı); "tumu" tarih aralığındaki tüm fiş satırları (eski raporda kutu işaretsizken). Satır = fiş satırı.
     * Eski görünümdeki gibi iptal fişler de iptal tarihiyle listelenir; sıra tarih + seri no.
     */
    async MSKKON1(pool, p, t) {
        const esik = p.esik ?? await varsayilanEsik(pool), n = Math.max(2, Math.round(p.adet ?? 2));
        const s = await masakSatirlari(pool, p, undefined, { iptalDahil: true });
        const neden = kontrolNedenleri(fislereIndir(s), esik, n);
        const kapsam = p.durum === "tumu" ? "tumu" : p.durum === "sinirUstu" ? "sinirUstu" : "kural";
        const satirlar = kontrolSirasi(s.filter(x => kapsam === "tumu" || (kapsam === "sinirUstu" ? esik > 0 && x.tutar > esik : neden.has(x.fisId))))
            .map(x => ({ ...x, neden: (neden.get(x.fisId) || []).join("; "), isaretli: x.supheliYetkili ? "EVET" : "" }));
        return sinirla(satirlar, t, `${aralikOzeti(p)}${tipOzeti(p)}${ozetEk(p)} · ${kontrolOzeti(esik, kapsam, n)}`, esik > 0 ? undefined : "Eşik tutarı girilmediği ve firma tanımında TL vergi sınırı olmadığı için yalnızca MASAK listesi eşleşmeleri kontrol edildi.");
    },
};
