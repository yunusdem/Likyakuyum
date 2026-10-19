import crypto from "crypto";
import { ApiError } from "./ApiError.js";
import { logger } from "./logger.js";
import { normalizeMetin, tarihAyikla } from "./masakExcel.util.js";
/**
 * MASAK internet sitesindeki BMGK duyurularının çekilmesi ve ayrıştırılması.
 *
 * MASAK Genel Tebliği (Sıra No: 34, RG 23.09.2026) gereği BM Güvenlik Konseyi'nin listeleme
 * kararlarına konu kişi/kuruluşlar MASAK'ın internet sitesinde duyurulur. Site bir React
 * uygulamasıdır; içerik `https://masak.hmb.gov.tr/portal/v2/posts` (WordPress REST vekili)
 * üzerinden JSON olarak gelir ve kimlik doğrulaması istemez.
 *
 * Her duyuru tek bir kişi ya da organizasyon için "alan adı | önceki hali | sonraki hali"
 * biçiminde bir HTML tablo içerir. Buradan `TODVZ_MASAK_LISTE` satırı üretilir; böylece
 * mevcut sorgu uçları ve fiş ekranlarındaki kontrol, Excel listesi güncellenmeden önce de
 * duyurudaki kişiyi yakalar.
 */
/** Duyuru kaynağının izinli tek adres öneki (SSRF önlemi) */
export const MASAK_PORTAL_ONEK = "https://masak.hmb.gov.tr/portal/v2/";
/** Varsayılan kaynak adresi (liste kaydında KAYNAK_URL olarak da bu yazılır) */
export const MASAK_PORTAL_POSTS_URL = "https://masak.hmb.gov.tr/portal/v2/posts";
/** Duyuru sayfasının kullanıcıya gösterilecek adresi */
const MASAK_DUYURU_SAYFA_ONEK = "https://masak.hmb.gov.tr/duyuru/";
export const portalAdresiGecerliMi = (url) => {
    if (!url)
        return false;
    return url.trim().toLowerCase().startsWith(MASAK_PORTAL_ONEK);
};
const KULLANICI_AJANI = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
/** Başlık BMGK yaptırım listesi duyurusu mu? ("BMGK Tarafından, Yaptırım Listesinde Yer Alan ...") */
export const bmgkDuyurusuMu = (baslik) => {
    const b = normalizeMetin(entityCoz(baslik));
    return b.includes("BMGK") && b.includes("YAPTIRIM LISTESI");
};
/**
 * Duyuruları sayfa sayfa indirir (arama: BMGK). Yalnızca BMGK yaptırım listesi duyuruları döner.
 * Başarısızlıkta 3 kez dener.
 */
export const bmgkDuyurulariniIndir = async (url = MASAK_PORTAL_POSTS_URL, opts = {}) => {
    if (!portalAdresiGecerliMi(url)) {
        throw ApiError.badRequest(`Geçersiz duyuru adresi. Yalnızca ${MASAK_PORTAL_ONEK} ile başlayan adresler kabul edilir.`);
    }
    const timeoutMs = opts.timeoutMs ?? 60000;
    const toplamDeneme = opts.deneme ?? 3;
    const sayfaBoyutu = opts.sayfaBoyutu ?? 100;
    const taban = url.trim().replace(/\/+$/, "");
    const sayfaCek = async (sayfa) => {
        let sonHata = null;
        for (let deneme = 1; deneme <= toplamDeneme; deneme++) {
            try {
                const adres = `${taban}?search=BMGK&per_page=${sayfaBoyutu}&page=${sayfa}`;
                const response = await fetch(adres, {
                    headers: { "User-Agent": KULLANICI_AJANI, Accept: "application/json" },
                    signal: AbortSignal.timeout(timeoutMs),
                });
                if (!response.ok) {
                    throw new Error(`MASAK duyuruları alınamadı (HTTP ${response.status}).`);
                }
                const metin = await response.text();
                const toplamSayfa = Number(response.headers.get("x-wp-totalpages") || "1") || 1;
                return { metin, toplamSayfa };
            }
            catch (error) {
                sonHata = error;
                logger.warn(`MASAK duyuru indirme denemesi ${deneme}/${toplamDeneme} (sayfa ${sayfa}) başarısız: ${error?.message || error}`);
                if (deneme < toplamDeneme)
                    await new Promise((r) => setTimeout(r, 1000 * deneme));
            }
        }
        const mesaj = sonHata?.name === "TimeoutError"
            ? "MASAK sitesine bağlantı zaman aşımına uğradı. İnternet bağlantınızı kontrol ediniz."
            : sonHata?.message || "MASAK duyuruları alınamadı.";
        throw ApiError.badRequest(mesaj);
    };
    const yazilar = [];
    let boyut = 0;
    let sayfa = 1;
    let toplamSayfa = 1;
    do {
        const { metin, toplamSayfa: ts } = await sayfaCek(sayfa);
        boyut += Buffer.byteLength(metin, "utf8");
        toplamSayfa = ts;
        let dizi;
        try {
            dizi = JSON.parse(metin);
        }
        catch {
            throw ApiError.badRequest("MASAK sitesinden beklenen JSON yerine başka bir içerik döndü.");
        }
        if (!Array.isArray(dizi)) {
            throw ApiError.badRequest("MASAK duyuru listesi beklenen biçimde değil.");
        }
        for (const y of dizi) {
            if (y &&
                typeof y.id === "number" &&
                typeof y.slug === "string" &&
                typeof y?.title?.rendered === "string" &&
                typeof y?.content?.rendered === "string" &&
                bmgkDuyurusuMu(y.title.rendered)) {
                yazilar.push({
                    id: y.id,
                    date: String(y.date || ""),
                    modified: y.modified ? String(y.modified) : undefined,
                    slug: y.slug,
                    title: { rendered: y.title.rendered },
                    content: { rendered: y.content.rendered },
                });
            }
        }
        sayfa++;
    } while (sayfa <= toplamSayfa && sayfa <= 20);
    // Yeniden eskiye gelir; eskiden yeniye sıralayalım (sıra no kronolojik olsun)
    yazilar.sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
    const hash = crypto
        .createHash("sha256")
        .update(yazilar.map((y) => `${y.id}:${y.modified || y.date}`).join("|"))
        .digest("hex");
    return { yazilar, hash, boyut };
};
/* ============================================================================
   HTML yardımcıları (bağımlılıksız, yalnız bu basit tablo için)
   ========================================================================== */
const ENTITY_SOZLUGU = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
    ndash: "–",
    mdash: "—",
    rsquo: "’",
    lsquo: "‘",
    rdquo: "”",
    ldquo: "“",
    hellip: "…",
};
export const entityCoz = (s) => s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (m, ad) => ENTITY_SOZLUGU[ad.toLowerCase()] ?? m);
/** Etiketleri atar, satır sonlarını korur, boşlukları sadeleştirir */
const duzMetin = (html) => {
    const s = html
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n")
        .replace(/<[^>]+>/g, " ");
    return entityCoz(s)
        .replace(/ /g, " ")
        .replace(/[ \t]+/g, " ")
        .replace(/\s*\n\s*/g, "\n")
        .trim();
};
/** Tablo → hücre metin matrisi */
const tabloyuOku = (html) => {
    const tabloEs = html.match(/<table[\s\S]*?<\/table>/i);
    if (!tabloEs)
        return [];
    const satirlar = [];
    const trler = tabloEs[0].match(/<tr[\s\S]*?<\/tr>/gi) || [];
    for (const tr of trler) {
        const hucreler = [];
        const tdler = tr.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) || [];
        for (const td of tdler) {
            hucreler.push(duzMetin(td.replace(/^<t[dh][^>]*>/i, "").replace(/<\/t[dh]>$/i, "")));
        }
        satirlar.push(hucreler);
    }
    return satirlar;
};
/** ": –", "-", "–", boş → null; baştaki ":" ayracı atılır */
const degerTemizle = (s) => {
    if (!s)
        return null;
    let v = s.replace(/^\s*:\s*/, "").trim();
    v = v.replace(/^[:\s]+/, "").trim();
    if (!v || /^[–—-]+$/.test(v))
        return null;
    return v;
};
/**
 * "1: MOUNIR 2: EL MOTASSADEQ\n3: – 4: –" → "MOUNIR EL MOTASSADEQ"
 * Numarasız ad (organizasyon) olduğu gibi döner.
 */
export const adParcalariniBirlestir = (ham) => {
    if (!ham)
        return null;
    if (!/\b1\s*:/.test(ham))
        return ham.replace(/\s+/g, " ").trim() || null;
    const parcalar = ham
        .split(/\s*\d\s*:\s*/)
        .map((p) => p.trim())
        .filter((p) => p && !/^[–—-]+$/.test(p));
    const ad = parcalar.join(" ").replace(/\s+/g, " ").trim();
    return ad || null;
};
/** Sıra önemlidir: daha özel kalıp önce */
const ALAN_ESLEME = [
    { alan: "orijinalAd", kalip: (b) => b.includes("ORIJINAL") || b.includes("ORJINAL") },
    { alan: "eskiAdi", kalip: (b) => b.includes("ESKI AD") },
    { alan: "digerIsimler", kalip: (b) => b.includes("DIGER AD") || b.includes("DIGER ISIM") },
    { alan: "adUnvan", kalip: (b) => b === "ADI" || b.startsWith("ADI SOYADI") || b === "AD SOYAD" || b === "UNVANI ADI" },
    { alan: "unvan", kalip: (b) => b.startsWith("UNVAN") },
    { alan: "gorevi", kalip: (b) => b.startsWith("GOREV") },
    { alan: "dogumTarihi", kalip: (b) => b.includes("DOGUM TARIH") || b.includes("KURULUS TARIH") },
    { alan: "dogumYeri", kalip: (b) => b.includes("DOGUM YER") },
    { alan: "uyruk", kalip: (b) => b.startsWith("UYRU") },
    { alan: "pasaport", kalip: (b) => b.includes("PASAPORT") },
    { alan: "kimlik", kalip: (b) => b.includes("KIMLIK") },
    { alan: "adres", kalip: (b) => b.startsWith("ADRES") },
    { alan: "kurulusYapisi", kalip: (b) => b.includes("KURULUS YAPI") },
    { alan: "orgut", kalip: (b) => b.includes("ORGUT") },
];
const alanBul = (etiket) => {
    const n = normalizeMetin(etiket);
    if (!n)
        return null;
    for (const e of ALAN_ESLEME)
        if (e.kalip(n))
            return e.alan;
    return null;
};
/**
 * Tek bir duyuruyu `TODVZ_MASAK_LISTE` satırına çevirir.
 * Tabloda "Önceki / Sonraki hali" iki kolonu varsa SON kolon (güncel hal) esas alınır;
 * tek kolonlu tabloda o kolon okunur. Ad bulunamazsa null döner (çağıran ayrıca kaydeder).
 */
export const duyuruyuAyristir = (yazi, listeKod, listeAdi, siraNo) => {
    const baslik = entityCoz(yazi.title.rendered).replace(/\s+/g, " ").trim();
    const icerik = yazi.content.rendered;
    const paragraf = duzMetin(icerik.replace(/<table[\s\S]*?<\/table>/gi, " "));
    const satirlar = tabloyuOku(icerik);
    const alanlar = {};
    const eslenmeyen = {};
    for (const hucreler of satirlar) {
        if (hucreler.length < 2)
            continue;
        const etiket = hucreler[0];
        const etiketN = normalizeMetin(etiket);
        // Başlık satırı ("" | Önceki Hali | Sonraki Hali)
        if (!etiketN || etiketN.includes("GUNCELLEMEDEN"))
            continue;
        const deger = degerTemizle(hucreler[hucreler.length - 1]);
        const alan = alanBul(etiket);
        if (alan) {
            if (alanlar[alan]) {
                if (deger)
                    alanlar[alan] = `${alanlar[alan]}\n${deger}`;
            }
            else {
                alanlar[alan] = deger;
            }
        }
        else if (deger) {
            eslenmeyen[etiket] = deger;
        }
    }
    const adUnvan = adParcalariniBirlestir(alanlar.adUnvan ?? null);
    if (!adUnvan)
        return null;
    const baslikN = normalizeMetin(baslik);
    const kayitTipi = baslikN.includes("KISIYE")
        ? "GERCEK"
        : baslikN.includes("ORGANIZASYON") || baslikN.includes("KURULUS")
            ? "TUZEL"
            : null;
    const islem = baslikN.includes("CIKAR")
        ? "LISTEDEN CIKARMA"
        : baslikN.includes("GUNCELLE")
            ? "BILGI GUNCELLEME"
            : baslikN.includes("EKLEN") || baslikN.includes("ALIN")
                ? "LISTEYE EKLEME"
                : null;
    // "15.10.2026 tarih ve SC/16480 sayılı basın bildirisi"
    const bmEs = paragraf.match(/(\d{2}\.\d{2}\.\d{4})\s+tarih\s+ve\s+(SC\/\d+)/i);
    const bmUrlEs = paragraf.match(/https?:\/\/press\.un\.org\/\S+/i);
    const kararEs = paragraf.match(/(\d{3,4})\s*\((\d{4})\)\s*sayılı\s*Karar/i);
    const disisleriEs = paragraf.match(/(\d{2}\.\d{2}\.\d{4})\s+tarih\s+ve\s+(\d+)\s+sayılı\s+yazı/i);
    const kimlikParcalari = [alanlar.pasaport, alanlar.kimlik].filter((x) => !!x);
    const kimlikNo = kimlikParcalari.length ? kimlikParcalari.join("\n") : null;
    const duyuruUrl = `${MASAK_DUYURU_SAYFA_ONEK}${yazi.slug}`;
    const yayinTarihi = (yazi.date || "").slice(0, 10);
    const ekBilgi = {
        duyuruId: yazi.id,
        duyuruUrl,
        duyuruBasligi: baslik,
        yayinTarihi: yazi.date,
        degisiklikTarihi: yazi.modified ?? null,
        islem,
        unvan: alanlar.unvan ?? null,
        bmBildiriUrl: bmUrlEs?.[0] ?? null,
        disisleriYazisi: disisleriEs ? `${disisleriEs[1]} - ${disisleriEs[2]}` : null,
        ...(Object.keys(eslenmeyen).length ? { eslenmeyen } : {}),
    };
    const digerIsimler = alanlar.digerIsimler ?? null;
    return {
        listeKod,
        listeAdi: listeAdi ?? null,
        siraNo,
        adUnvan,
        adUnvanNorm: normalizeMetin(adUnvan),
        kayitTipi,
        kimlikNo,
        tckn: null,
        vkn: null,
        digerIsimler,
        digerIsimlerNorm: digerIsimler ? normalizeMetin(digerIsimler) : null,
        orijinalAd: alanlar.orijinalAd ?? null,
        eskiAdi: alanlar.eskiAdi ?? null,
        gorevi: alanlar.gorevi ?? null,
        adres: alanlar.adres ?? null,
        uyruk: alanlar.uyruk ?? null,
        digerUyruk: null,
        yaptirimTuru: "Malvarlığının dondurulması (BMGK)",
        anneAdi: null,
        babaAdi: null,
        dogumTarihi: alanlar.dogumTarihi ?? null,
        dogumTarihiDt: alanlar.dogumTarihi ? tarihAyikla(alanlar.dogumTarihi) : null,
        dogumYeri: alanlar.dogumYeri ?? null,
        orgut: alanlar.orgut ??
            (kararEs ? `BMGK ${kararEs[1]} (${kararEs[2]}) sayılı Karar yaptırım listesi` : null),
        kurulusYapisi: alanlar.kurulusYapisi ?? null,
        listeyeAlinma: yayinTarihi ? `MASAK duyurusu ${yayinTarihi.split("-").reverse().join(".")}` : null,
        kararBilgi: bmEs ? `BMGK ${bmEs[2]} - ${bmEs[1]}` : null,
        resmiGazete: null,
        digerBilgiler: `${baslik}\n${duyuruUrl}`,
        ekBilgi: JSON.stringify(ekBilgi),
    };
};
/** Tüm duyuruları ayrıştırır; adı okunamayanlar `ayristirilamayan` listesine düşer. */
export const parseBmgkDuyurulari = (yazilar, listeKod, listeAdi) => {
    const kayitlar = [];
    const ayristirilamayan = [];
    let sira = 0;
    for (const yazi of yazilar) {
        const kayit = duyuruyuAyristir(yazi, listeKod, listeAdi, sira + 1);
        if (kayit) {
            kayitlar.push(kayit);
            sira++;
        }
        else {
            ayristirilamayan.push(yazi.slug);
        }
    }
    return { kayitlar, ayristirilamayan };
};
