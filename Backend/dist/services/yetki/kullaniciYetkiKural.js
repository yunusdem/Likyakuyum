/**
 * Kullanıcı kartı yetkileri (TODVZ_KULLANICI, eski programla ortak) — saf kurallar; ön yüz de içe aktarır.
 * docs/YETKI_VE_VEZNE_YOL_HARITASI.md §4. Sistem yöneticisi her yetkiye sahiptir.
 */
/** Sistem yöneticisi ya da kısıtsız kullanıcı */
export const TAM_YETKI = {
    yonetici: true,
    menu: {},
    gosterimGunu: 0,
    tarihDegistirme: true,
    fisNoDegistirme: true,
    tutarDegistirme: true,
    bankaHesabiSecme: true,
    komisyonAlma: true,
    komisyonOrani: 0,
    cariBakiye: true,
    acikVadeli: true,
    supheliIslem: true,
    caprazKurKontroluYok: true,
    kurYetkisi: "Var",
    kurTolerans: 0,
    giseKuruDisinda: true,
    sapmaUyarisiYok: true,
    masakUyarisi: true,
    calismaAlani: true,
};
const evet = (v) => v === true || v === 1 || v === "1" || v === "true";
const sayi = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};
/** KUR_YETKISI kodu (0: Var, 1: Yok, 2: Esnek, 3: Yüzde) */
export const kurYetkisiKoddan = (v) => {
    const s = String(v ?? "").trim();
    if (s === "Var" || s === "Yok" || s === "Esnek" || s === "Yüzde")
        return s;
    if (s === "Limitli")
        return "Yüzde";
    if (s === "1")
        return "Yok";
    if (s === "2")
        return "Esnek";
    if (s === "3")
        return "Yüzde";
    return "Var";
};
export const kurYetkisiKoda = (v) => {
    const t = kurYetkisiKoddan(v);
    return t === "Yok" ? 1 : t === "Esnek" ? 2 : (t === "Yüzde" || t === "Limitli") ? 3 : 0;
};
/** Oturum profilindeki kullanıcı (UserProfileDto) → yetki */
export const yetkiProfilden = (u) => {
    if (!u)
        return { ...TAM_YETKI, yonetici: false };
    const isAdmin = Boolean(u.isSysAdmin || u.role === "admin");
    const base = isAdmin ? TAM_YETKI : null;
    const kurYetkisi = kurYetkisiKoddan(u.ratePermType);
    const kurTolerans = Math.max(0, sayi(u.ratePermValue));
    return {
        yonetici: isAdmin,
        menu: { ...(u.menuPerms || (base ? base.menu : {})) },
        gosterimGunu: u.displayDays !== undefined ? Math.max(0, Math.trunc(sayi(u.displayDays))) : (base ? base.gosterimGunu : 0),
        tarihDegistirme: u.hasDateChangePerm !== undefined ? evet(u.hasDateChangePerm) : (base ? base.tarihDegistirme : false),
        fisNoDegistirme: u.hasSlipNoChangePerm !== undefined ? evet(u.hasSlipNoChangePerm) : (base ? base.fisNoDegistirme : false),
        tutarDegistirme: u.hasSlipAmountChangePerm !== undefined ? evet(u.hasSlipAmountChangePerm) : (base ? base.tutarDegistirme : false),
        bankaHesabiSecme: u.hasSlipBankAccountPerm !== undefined ? evet(u.hasSlipBankAccountPerm) : (base ? base.bankaHesabiSecme : false),
        komisyonAlma: u.hasCommissionPerm !== undefined ? evet(u.hasCommissionPerm) : (base ? base.komisyonAlma : false),
        komisyonOrani: u.commissionRate !== undefined ? Math.max(0, sayi(u.commissionRate)) : 0,
        cariBakiye: u.canViewAccountBalance !== undefined ? evet(u.canViewAccountBalance) : (base ? base.cariBakiye : false),
        acikVadeli: u.canViewOpenTermTrans !== undefined ? evet(u.canViewOpenTermTrans) : (base ? base.acikVadeli : false),
        supheliIslem: u.isSuspiciousTransAuth !== undefined ? evet(u.isSuspiciousTransAuth) : (base ? base.supheliIslem : false),
        caprazKurKontroluYok: u.noCrossRateCheck !== undefined ? evet(u.noCrossRateCheck) : (base ? base.caprazKurKontroluYok : false),
        kurYetkisi,
        kurTolerans,
        giseKuruDisinda: evet(u.canBeOutsideCounterRate),
        sapmaUyarisiYok: evet(u.noDeviationWarning),
        masakUyarisi: evet(u.hasMasakWarning),
        calismaAlani: evet(u.hasWorkspacePerm),
    };
};
/** TODVZ_KULLANICI satırı → yetki (sunucu) */
export const yetkiSatirdan = (r) => {
    if (!r)
        return { ...TAM_YETKI, yonetici: false };
    const yonetici = evet(r.SISTEM_YONETICISI);
    const kurYetkisi = kurYetkisiKoddan(r.KUR_YETKISI);
    const kurTolerans = Math.max(0, sayi(r.KUR_TOLERANS_ORANI));
    return {
        yonetici,
        menu: {
            mainMenu: r.ANA_MENU_YETKISI ?? (yonetici ? "Tam Yetki" : null),
            cashier: r.VEZNE_ISLEMLERI_YETKISI ?? (yonetici ? "Tam Yetki" : null),
            safe: r.KASA_ISLEMLERI_YETKISI ?? (yonetici ? "Tam Yetki" : null),
            exchange: r.KUR_ISLEMLERI_YETKISI ?? (yonetici ? "Tam Yetki" : null),
            accounts: r.CARI_ISLEMLER_YETKISI ?? (yonetici ? "Tam Yetki" : null),
            admin: r.YONETICI_ISLEMLERI_YETKISI ?? (yonetici ? "Tam Yetki" : null),
            accounting: r.MUHASEBE_YETKISI ?? (yonetici ? "Tam Yetki" : null),
            reports: r.RAPORLAR_YETKISI ?? (yonetici ? "Tam Yetki" : null),
            consolidatedReports: r.KONSOLIDE_RAPORLAR_YETKISI ?? (yonetici ? "Tam Yetki" : null),
            techOps: r.TEKNIK_ISLEMLER_YETKISI ?? (yonetici ? "Tam Yetki" : null),
        },
        gosterimGunu: Math.max(0, Math.trunc(sayi(r.FIS_GOSTERME_GUN_SAYISI))),
        tarihDegistirme: evet(r.TARIH_DEGISTIRME_YETKISI) || yonetici,
        fisNoDegistirme: evet(r.FIS_NO_DEGISTIRME_YETKISI) || yonetici,
        tutarDegistirme: evet(r.FIS_TUTAR_DEGISTIRME_YETKISI) || yonetici,
        bankaHesabiSecme: evet(r.FIS_BANKA_HESABI_SECME_YETKISI) || yonetici,
        komisyonAlma: evet(r.KOMISYON_ALMA_YETKISI) || yonetici,
        komisyonOrani: Math.max(0, sayi(r.KOMISYON_ORANI)),
        cariBakiye: evet(r.CARI_BAKIYE_GOREBILIR) || yonetici,
        acikVadeli: evet(r.ACIK_VADELI_ISLEM_GOREBILIR) || yonetici,
        supheliIslem: evet(r.SUPHELI_ISLEMLER_YETKILISI) || yonetici,
        caprazKurKontroluYok: evet(r.CAPRAZ_KUR_KONTROLU_YOK) || yonetici,
        kurYetkisi,
        kurTolerans,
        giseKuruDisinda: evet(r.GISE_KURU_DISINDA_OLABILIR) || yonetici,
        sapmaUyarisiYok: evet(r.SAPMA_UYARISI_VERILMESIN) || yonetici,
        masakUyarisi: evet(r.MASAK_UYARISI_VERSIN),
        calismaAlani: evet(r.ALAN_ISLEMLERI_YETKISI) || yonetici,
    };
};
// ───────────────────────────── Menü yetkileri (harf listesi) ─────────────────────────────
/** Bir menü kolonunun yazabildiği en çok harf (varchar(16)) */
export const MENU_HARF_SINIRI = 16;
export const MENU_HARFLERI = "ABCDEFGHIJKLMNOP";
/** Eski programın "hepsi" listesi: bu harflerin hepsi varsa menüde tam yetki (K6) */
const ESKI_HEPSI = "ABCDEFGHIJKLMN";
/** Hiçbir madde açık değil */
export const HIC_YETKI = "-";
/** Yeni ekranın yazdığı kısıtlı listenin sonundaki işaret: katı okunur (K6 kuralı uygulanmaz); eski program harf saymaz */
export const KATI_ISARET = "*";
/**
 * Harf listesi çözümü: null = tam yetki, boş küme = hiçbiri. İşaretsiz liste eski programındır: A–N'nin hepsi varsa
 * tam sayılır (K6, N sonrası maddeler lisansta açıksa açık). "*" ile biten liste yeni ekranındır, yalnız harfleri açar.
 */
export const harfListesi = (deger) => {
    if (deger === null || deger === undefined)
        return null;
    const s = String(deger).trim();
    if (!s)
        return null;
    if (s === HIC_YETKI || s.toLocaleLowerCase("tr-TR") === "yetki yok")
        return new Set();
    // Harf listesi değilse (yeni ekranın eskiden yazdığı "Tam Yetki", "Kısıtlı"…) kısıtsız sayılır
    const m = /^([A-Z]+)(\*?)$/.exec(s);
    if (!m)
        return null;
    const kume = new Set(m[1].split(""));
    if (!m[2] && [...ESKI_HEPSI].every((h) => kume.has(h)))
        return null;
    return kume;
};
/**
 * Kullanıcı kartına yazılacak menü yetkisi değeri (eski programın okuyabileceği biçim): harf listesi olduğu gibi;
 * boş (kartta NULL'dı) → NULL kalır; "Yetki Yok" → "-"; harf dışı metin ("Tam Yetki", "Kısıtlı"…) → A–P. Yeni ekran
 * eskiden bu metinleri yazıyordu, eski program onları harf sanıp kullanıcıyı yetkisiz bırakıyordu.
 */
export const menuDegeriYaz = (v) => {
    const s = String(v ?? "").trim();
    if (!s)
        return null;
    if (s === HIC_YETKI || /^[A-Z]+\*?$/.test(s))
        return s.slice(0, MENU_HARF_SINIRI);
    if (s.toLocaleLowerCase("tr-TR") === "yetki yok")
        return HIC_YETKI;
    return MENU_HARFLERI;
};
export const harfAcik = (deger, harf) => {
    const l = harfListesi(deger);
    return l === null || l.has(harf);
};
/** Ana menü (DashboardRoute key) → özgün harfi ve madde kolonu (null: yalnız ana menü harfiyle) */
export const ANA_MENULER = {
    vezne: { harf: "A", alan: "cashier" },
    kasa: { harf: "B", alan: "safe" },
    kur: { harf: "C", alan: "exchange" },
    cari: { harf: "D", alan: "accounts" },
    yonetici: { harf: "E", alan: "admin" },
    banka: { harf: "F", alan: null },
    raporlar: { harf: "G", alan: "reports" },
    ebelge: { harf: "H", alan: null },
    etiket: { harf: "I", alan: null },
    perakende: { harf: "J", alan: null },
    ticari: { harf: "K", alan: null },
    ayarlar: { harf: "L", alan: "techOps" },
};
/** Kolonun sığmadığı maddeler (16 harf sonrası) bağlı oldukları maddenin yetkisini alır */
export const BAGLI_MADDELER = {
    vezne: { Q: "A", R: "E" },
};
/** Ana menü açık mı (ANA_MENU_YETKISI) */
export const anaMenuAcik = (y, anaKey) => {
    if (y.yonetici)
        return true;
    const a = ANA_MENULER[anaKey];
    return !a || harfAcik(y.menu.mainMenu, a.harf);
};
/** Ana menünün maddesi açık mı. harf: maddenin özgün harfi (gruplarda grubun harfi). */
export const menuMaddesiAcik = (y, anaKey, harf) => {
    if (y.yonetici)
        return true;
    if (!anaMenuAcik(y, anaKey))
        return false;
    const a = ANA_MENULER[anaKey];
    if (!a?.alan || !harf)
        return true;
    const h = BAGLI_MADDELER[anaKey]?.[harf] ?? harf;
    if (MENU_HARFLERI.indexOf(h) < 0)
        return true;
    return harfAcik(y.menu[a.alan], h);
};
/** Menü adındaki harf: "A- Sarraf Fişi Kayıt" → "A" */
export const maddeHarfi = (ad) => {
    const m = /^\s*([A-Z])\s*-/.exec(String(ad ?? ""));
    return m ? m[1] : null;
};
/**
 * Ekrandaki madde kutularından kolon değeri: işaretli harfler; menüde olmayan harfler (eski programın bizde bulunmayan
 * maddeleri) eski değerden korunur. Hepsi işaretliyse A–P (eski program da tam okur). Hiçbiri: "-" (eski program da
 * hiçbir harf bulmaz).
 */
export const harfListesiYaz = (eski, menuHarfleri, secili) => {
    const bizim = new Set(menuHarfleri.filter((h) => MENU_HARFLERI.includes(h)));
    const sec = new Set(secili.filter((h) => bizim.has(h)));
    const eskiL = harfListesi(eski);
    const harfler = [...MENU_HARFLERI].filter((h) => (bizim.has(h) ? sec.has(h) : eskiL === null || eskiL.has(h)));
    if (harfler.length === MENU_HARFLERI.length)
        return MENU_HARFLERI;
    return harfler.length ? harfler.join("") + KATI_ISARET : HIC_YETKI;
};
// ───────────────────────────── Gün sınırı, tarih ─────────────────────────────
/** "YYYY-MM-DD" (Türkiye saatiyle bugün ya da verilen an) */
export const trGunu = (an = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(an);
/** Herhangi bir tarih değerinin gün kısmı ("2026-10-15", "2026-10-15T17:09", Date) */
export const gunKismi = (v) => {
    if (v === null || v === undefined || v === "")
        return null;
    if (v instanceof Date)
        return Number.isNaN(v.getTime()) ? null : trGunu(v);
    const s = String(v).trim();
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (m && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(s.slice(10)))
        return `${m[1]}-${m[2]}-${m[3]}`;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : trGunu(d);
};
/** Gösterim sınırının ilk günü ("YYYY-MM-DD"); sınır yoksa null. N gün = bugün dahil son N gün. */
export const gosterimBaslangici = (y, bugun = trGunu()) => {
    if (y.yonetici || !y.gosterimGunu)
        return null;
    const [Y, M, D] = bugun.split("-").map(Number);
    const t = new Date(Date.UTC(Y, M - 1, D - (y.gosterimGunu - 1)));
    return t.toISOString().slice(0, 10);
};
/** Kayıt tarihi gösterim sınırının içinde mi */
export const gosterimIcinde = (y, kayitTarihi, bugun) => {
    const bas = gosterimBaslangici(y, bugun);
    if (!bas)
        return true;
    const g = gunKismi(kayitTarihi);
    return !g || g >= bas;
};
const yuzde = (n) => n.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
/**
 * Girilen kur, kullanıcının kur yetkisine ve gişe kuruna göre geçerli mi. Gişe kuru bilinmiyorsa denetlenmez.
 * pay: sunucuda, ekranın yüklediği kur ile kayıt anındaki kur arasındaki canlı güncelleme farkı için yüzde pay.
 */
export const kurDenetle = (y, gise, girilen, etiket = "Kur", pay = 0) => {
    const ref = Number(gise?.kur) || 0;
    const k = Number(girilen) || 0;
    if (!(ref > 0) || !(k > 0))
        return { hata: null, sapma: 0, uyari: null };
    const sapma = ((k - ref) / ref) * 100;
    const fark = Math.abs(sapma) > 1e-9;
    if (!fark)
        return { hata: null, sapma, uyari: null };
    // 1. Yok: Kuru değiştiremez
    if (y.kurYetkisi === "Yok") {
        if (Math.abs(sapma) > pay + 1e-9) {
            return { hata: `${etiket} değiştirme yetkiniz yok (gişe kuru: ${ref}).`, sapma, uyari: null };
        }
        return { hata: null, sapma: 0, uyari: null };
    }
    // 2. Var: İstediğini yazar
    if (y.kurYetkisi === "Var") {
        return { hata: null, sapma, uyari: y.sapmaUyarisiYok ? null : `${etiket} gişe kurundan %${yuzde(sapma)} farklı (gişe ${ref}).` };
    }
    // 3. Esnek: Yalnızca alış ile satış kuru arasında değerler yazabilir
    if (y.kurYetkisi === "Esnek") {
        const alis = Number(gise?.alis) || 0;
        const satis = Number(gise?.satis) || 0;
        const minKur = Math.min(alis > 0 ? alis : ref, satis > 0 ? satis : ref);
        const maxKur = Math.max(alis > 0 ? alis : ref, satis > 0 ? satis : ref);
        if (minKur > 0 && maxKur > 0) {
            const alt = minKur * (1 - pay / 100);
            const ust = maxKur * (1 + pay / 100);
            if (k < alt - 1e-9 || k > ust + 1e-9) {
                return {
                    hata: `${etiket} yalnızca alış–satış kuru arasında (${minKur} – ${maxKur}) olabilir (girilen: ${k}).`,
                    sapma,
                    uyari: null,
                };
            }
        }
        return { hata: null, sapma, uyari: y.sapmaUyarisiYok ? null : `${etiket} gişe kurundan %${yuzde(sapma)} farklı (gişe ${ref}).` };
    }
    // 4. Yüzde: Kuru maksimum bu yüzde kadar değiştirebilir (örn: yüzde 1, kur 100 ise 99–101)
    if (y.kurYetkisi === "Yüzde" || y.kurYetkisi === "Limitli") {
        if (Math.abs(sapma) > y.kurTolerans + pay + 1e-9) {
            const alt = parseFloat((ref * (1 - y.kurTolerans / 100)).toFixed(4));
            const ust = parseFloat((ref * (1 + y.kurTolerans / 100)).toFixed(4));
            return {
                hata: `${etiket} gişe kurundan en çok %${yuzde(y.kurTolerans)} farklı olabilir (İzin verilen aralık: ${alt} – ${ust}, gişe: ${ref}, girilen: ${k}).`,
                sapma,
                uyari: null,
            };
        }
        return { hata: null, sapma, uyari: y.sapmaUyarisiYok ? null : `${etiket} gişe kurundan %${yuzde(sapma)} farklı (gişe ${ref}).` };
    }
    return { hata: null, sapma, uyari: null };
};
/**
 * Kullanıcı yetkisine göre girilen kur değerini denetler ve sınırlandırır (clamp):
 * - "Yok": gişe kurunu döner (değiştirilemez)
 * - "Var": girilen değeri olduğu gibi döner (serbest)
 * - "Esnek": [min(alis, satis), max(alis, satis)] aralığı dışındaysa sınıra çeker
 * - "Yüzde": Gişe kuru ± tolerans% aralığı dışındaysa sınıra çeker (örn: %1, ref 100 => 102 yazarsa 101, 50 yazarsa 99)
 */
export const kurDegeriniSinirla = (y, gise, girilen, basamak = 4) => {
    const k = Number(girilen) || 0;
    if (k <= 0)
        return { kur: k, degisti: false };
    // 1. Yok: Kuru değiştiremez
    if (y.kurYetkisi === "Yok") {
        const ref = Number(gise?.kur) || k;
        return {
            kur: ref,
            degisti: Math.abs(ref - k) > 1e-9,
            mesaj: "Kur değiştirme yetkiniz yok.",
        };
    }
    // 2. Var: İstediğini yazar
    if (y.kurYetkisi === "Var") {
        return { kur: k, degisti: false };
    }
    // 3. Esnek: Yalnızca alış–satış kuru arasında değerler yazabilir
    if (y.kurYetkisi === "Esnek") {
        const alis = Number(gise?.alis) || 0;
        const satis = Number(gise?.satis) || 0;
        const ref = Number(gise?.kur) || 0;
        const minKur = Math.min(alis > 0 ? alis : (ref > 0 ? ref : 0), satis > 0 ? satis : (ref > 0 ? ref : 0));
        const maxKur = Math.max(alis > 0 ? alis : (ref > 0 ? ref : 0), satis > 0 ? satis : (ref > 0 ? ref : 0));
        if (minKur > 0 && maxKur > 0) {
            if (k < minKur) {
                return {
                    kur: Number(minKur.toFixed(basamak)),
                    degisti: true,
                    mesaj: `Esnek kur aralığı (${minKur} - ${maxKur}). Kur alt sınıra getirildi.`,
                };
            }
            if (k > maxKur) {
                return {
                    kur: Number(maxKur.toFixed(basamak)),
                    degisti: true,
                    mesaj: `Esnek kur aralığı (${minKur} - ${maxKur}). Kur üst sınıra getirildi.`,
                };
            }
        }
        return { kur: k, degisti: false };
    }
    // 4. Yüzde: Gişe kurundan en çok tolerans % kadar farklı olabilir
    if (y.kurYetkisi === "Yüzde" || y.kurYetkisi === "Limitli") {
        const ref = Number(gise?.kur) || Number(gise?.alis) || Number(gise?.satis) || 0;
        const tolerans = Number(y.kurTolerans) || 0;
        if (ref > 0 && tolerans > 0) {
            const alt = Number((ref * (1 - tolerans / 100)).toFixed(basamak));
            const ust = Number((ref * (1 + tolerans / 100)).toFixed(basamak));
            if (k < alt) {
                return {
                    kur: alt,
                    degisti: true,
                    mesaj: `Kur %${tolerans} toleransının altında. Alt sınıra (${alt}) getirildi.`,
                };
            }
            if (k > ust) {
                return {
                    kur: ust,
                    degisti: true,
                    mesaj: `Kur %${tolerans} toleransının üzerinde. Üst sınıra (${ust}) getirildi.`,
                };
            }
        }
        return { kur: k, degisti: false };
    }
    return { kur: k, degisti: false };
};
/** Kur alanı ekranda değiştirilebilir mi */
export const kurDegistirilebilir = (y) => y.kurYetkisi !== "Yok";
/** Menü harfine ek olarak bir yetki kutusu isteyen sayfalar (adres, baştaki "/" olmadan) */
export const SAYFA_YETKI_KUTULARI = {
    "raporlar/cari-ekstre": "cariBakiye",
    "raporlar/cari-bakiye": "cariBakiye",
    "raporlar/pos-ekstre": "cariBakiye",
    "raporlar/cari-hareket-listesi": "cariBakiye",
    "raporlar/vadeli-islem-listesi": "acikVadeli",
    "raporlar/masak-supheli": "supheliIslem",
    "raporlar/masak-fis-kontrol": "supheliIslem",
    "ayarlar/devir-islemi": "calismaAlani",
    "ayarlar/servis-islemleri": "calismaAlani",
};
/** Aynı kural rapor koduyla (sunucu) */
export const RAPOR_YETKI_KUTULARI = {
    CAREKS1: "cariBakiye",
    CARBAK1: "cariBakiye",
    POSEKS1: "cariBakiye",
    CARHAR1: "cariBakiye",
    VADISL1: "acikVadeli",
    MSKSUP1: "supheliIslem",
    MSKKON1: "supheliIslem",
};
export const YETKI_KUTUSU_ADI = {
    cariBakiye: "Cari bakiye görebilir",
    acikVadeli: "Açık vadeli işlemleri görebilir",
    supheliIslem: "Şüpheli işlemler yetkilisi",
    calismaAlani: "Çalışma alanı işlemleri yetkisi",
};
/** Sayfa (adres) yetki kutusunun izin verdiği bir sayfa mı */
export const sayfaKutusuAcik = (y, yol) => {
    const k = SAYFA_YETKI_KUTULARI[String(yol).replace(/^\/+|\/+$/g, "").toLowerCase()];
    return !k || y.yonetici || !!y[k];
};
const pozitifKur = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
};
/**
 * Döviz fişi gişe kuru (DovizFisiPage resolveCurrencyRate ile aynı): kurTuru 0 efektif, 1 döviz; tip 0 alış, 1 satış.
 * Seçilen türde değer yoksa öbür tür. Aralık (alış–satış) aynı türden.
 */
export const dovizGiseKuru = (k, tip, kurTuru) => {
    if (!k)
        return null;
    const ea = pozitifKur(k.efektifAlis), es = pozitifKur(k.efektifSatis), da = pozitifKur(k.dovizAlis), ds = pozitifKur(k.dovizSatis);
    const efektif = Number(kurTuru) === 0;
    const alis = efektif ? ea || da : da || ea;
    const satis = efektif ? es || ds : ds || es;
    const kur = Number(tip) === 0 ? alis : satis;
    return kur > 0 ? { kur, alis: alis || null, satis: satis || null } : null;
};
const buyuk = (s) => String(s ?? "").toLocaleUpperCase("tr-TR").trim();
const HAS_KODLARI = ["HAS", "ALTIN", "HAS ALTIN", "HASALTIN"];
// GMS: Hızlı Satış'ın gümüş kodu (hizliSatisHesap) — Hızlı Satış Sarraf satırları da bu uçtan kaydedilir
const GUMUS_KODLARI = ["GUMUS", "GÜMÜŞ", "HAS GÜMÜŞ", "HAS GUMUS", "GMS"];
/**
 * Sarraf satırı gişe kuru (SarrafFisiPage getKurForProduct ile aynı): ürünün kendi kur satırı (efektif, yoksa döviz);
 * yoksa ziynette bilinmez, gümüşte gümüş has kuru, diğerlerinde altın has kuru.
 */
export const sarrafGiseKuru = (kurlar, urun, tip) => {
    if (!urun)
        return null;
    const kod = buyuk(urun.kod);
    if (kod === "TL" || kod === "TRY" || kod === "TRL")
        return null;
    const satir = (k) => {
        if (!k)
            return null;
        const alis = pozitifKur(k.efektifAlis) || pozitifKur(k.dovizAlis);
        const satis = pozitifKur(k.efektifSatis) || pozitifKur(k.dovizSatis);
        const kur = Number(tip) === 0 ? alis : satis;
        return kur > 0 ? { kur, alis: alis || null, satis: satis || null } : null;
    };
    const kendi = satir(kurlar.find((k) => (urun.paraId && k.paraId === urun.paraId) || (kod && buyuk(k.kod) === kod)));
    if (kendi)
        return kendi;
    if (Number(urun.urunTipi) === 3)
        return null;
    const gumus = Number(urun.urunTipi) === 2 || kod.includes("GUMUS") || kod.includes("GÜMÜŞ") || buyuk(urun.ad).includes("GÜMÜŞ");
    const liste = gumus ? GUMUS_KODLARI : HAS_KODLARI;
    return satir(kurlar.find((k) => liste.includes(buyuk(k.kod))));
};
/**
 * Farklı dövizli (çapraz) emanet dekontta iki tarafın karşılığı (miktar × satır kuru) firma toleransı içinde eşit olmalı;
 * "Cari dekontta çapraz kur kontrolü yok" işaretli kullanıcıda ve has mutabakatında (kurCinsi 1) denetlenmez.
 * Hata metni ya da null döner.
 */
export const caprazKurDenetle = (y, satirlar, kurCinsi, tolerans) => {
    if (y.yonetici || y.caprazKurKontroluYok || Number(kurCinsi) === 1)
        return null;
    const say = (v) => {
        const n = Number(String(v ?? "").replace(",", "."));
        return Number.isFinite(n) ? n : 0;
    };
    const dolu = (satirlar || []).filter((s) => say(s.meblag) > 0);
    const sol = dolu.filter((s) => Number(s.tip) === 1);
    const sag = dolu.filter((s) => Number(s.tip) !== 1);
    if (!sol.length || !sag.length)
        return null;
    const paralar = (l) => [...new Set(l.map((s) => Number(s.paraId)))].sort().join(",");
    if (paralar(sol) === paralar(sag))
        return null;
    const toplam = (l) => l.reduce((a, s) => a + say(s.meblag) * (say(s.kur) || 1), 0);
    const fark = Math.abs(toplam(sol) - toplam(sag));
    const sinir = Math.max(Number(tolerans) || 0, 0.01);
    if (fark <= sinir + 1e-9)
        return null;
    return `Çapraz kur kontrolü: iki tarafın karşılığı eşit değil (fark ${fark.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}, tolerans ${sinir.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}).`;
};
