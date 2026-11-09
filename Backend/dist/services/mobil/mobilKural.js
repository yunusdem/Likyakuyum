import { trZaman } from "../../utils/zaman.utils.js";
/**
 * Mobil cari erişimi — saf kurallar (docs/MOBIL_CARI_YOL_HARITASI.md). Veritabanına dokunmaz; sunucu, firma ekranları
 * ve testler aynı kuralı kullanır.
 */
export const MOBIL_MODUL = "mobil";
/** Soldaki kısa ad (K2, V1): elle yazılan varsa o, yoksa ünvanın ilk sözcüğü ("Vizyon Döviz Ltd." → "Vizyon"). */
export const kisaAdUret = (unvan, elle) => {
    const e = String(elle ?? "").trim();
    if (e)
        return e.slice(0, 40);
    const ilk = String(unvan ?? "")
        .trim()
        .split(/\s+/)[0]
        ?.replace(/[.,;:]+$/, "");
    if (!ilk)
        return "Likya";
    // Ünvan küçük ya da büyük harfle yazılmış olabilir: ilk harf büyük, gerisi küçük (Türkçe kurallarıyla)
    const ad = ilk.charAt(0).toLocaleUpperCase("tr-TR") + ilk.slice(1).toLocaleLowerCase("tr-TR");
    return ad.slice(0, 40);
};
/** Firma başına mobil kullanıcı sınırı (K7, K26): yeni erişim açılabilir mi. */
export const limitHatasi = (limit, kullanilan, eklenecek = 1) => {
    if (limit <= 0)
        return "Bu firmaya mobil kullanıcı tanımlama izni verilmemiş. Hizmet sağlayıcınıza başvurun.";
    if (kullanilan + eklenecek > limit)
        return `Mobil kullanıcı sınırı dolu (${kullanilan} / ${limit}). Ek kullanıcı için hizmet sağlayıcınıza başvurun.`;
    return null;
};
/** Panelde sınır düşürülürken: kullanılandan aşağı inemez. */
export const limitDusurmeHatasi = (yeniLimit, kullanilan) => yeniLimit < kullanilan ? `Firmada ${kullanilan} mobil kullanıcı var; sınır bundan küçük olamaz.` : null;
// ------------------------------------------------------------------ Faz 2: tanımlar ---
/** Mobil kullanıcı adı: küçük harf, a-z 0-9 . _ - (3–50). Türkçe harfler çevrilir, boşluk atılır. */
const TR_HARF = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", Ç: "c", Ğ: "g", İ: "i", I: "i", Ö: "o", Ş: "s", Ü: "u" };
export const kullaniciAdiTemizle = (v) => String(v ?? "")
    .trim()
    .replace(/[çğıöşüÇĞİIÖŞÜ]/g, (h) => TR_HARF[h])
    .toLowerCase()
    .replace(/\s+/g, "");
export const kullaniciAdiHatasi = (ad) => {
    if (ad.length < 3 || ad.length > 50)
        return "Kullanıcı adı 3–50 karakter olmalıdır.";
    if (!/^[a-z0-9][a-z0-9._-]*$/.test(ad))
        return "Kullanıcı adında yalnız harf, rakam, nokta, alt çizgi ve tire olabilir.";
    return null;
};
/** Cari koddan önerilen kullanıcı adı (ad + kod: "Ahmet Yılmaz", "001" → "ahmet001") */
export const kullaniciAdiOner = (cariKod, cariAd) => {
    const kod = kullaniciAdiTemizle(cariKod).replace(/[^a-z0-9._-]/g, "");
    const ad = kullaniciAdiTemizle(String(cariAd ?? "").trim().split(/\s+/)[0]).replace(/[^a-z0-9]/g, "");
    const aday = ad && kod ? `${ad}${kod}` : ad || kod || "cari";
    return (aday.length < 3 ? `${aday}000`.slice(0, 3) : aday).slice(0, 50);
};
const EPOSTA_DESENI = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
export const epostaGecerliMi = (v) => EPOSTA_DESENI.test(v) && v.length <= 200;
/** "a@x.com; b@y.com" → ["a@x.com", "b@y.com"]; geçersiz adres varsa hata */
export const epostaListesi = (v) => {
    const parcalar = (Array.isArray(v) ? v : String(v ?? "").split(/[,;\s]+/)).map((x) => String(x).trim()).filter(Boolean);
    const liste = [...new Set(parcalar.map((x) => x.toLowerCase()))];
    const yanlis = liste.find((x) => !epostaGecerliMi(x));
    if (yanlis)
        return { liste, hata: `Geçersiz e-posta adresi: ${yanlis}` };
    if (liste.join(",").length > 500)
        return { liste, hata: "E-posta adresleri en fazla 500 karakter olabilir." };
    return { liste, hata: null };
};
export const saatGecerliMi = (v) => !!v && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
export const ODEME_TERCIHLERI = ["BAKIYE", "TESLIM", "HAVALE", "POS"];
export const TERCIH_ADLARI = {
    BAKIYE: "Cari hesabımdan",
    TESLIM: "Mağazada öderim / teslim alırım",
    HAVALE: "Havale / EFT",
    POS: "Kartla (POS)",
};
export const VARSAYILAN_AYAR = {
    emirAcik: false,
    vezneId: null,
    kullaniciId: null,
    bildirimEposta: [],
    fiyatGecerlilikSn: 300,
    calismaBaslangic: null,
    calismaBitis: null,
    calismaGunleri: "1111110",
    islemEnAzTl: null,
    islemEnCokTl: null,
    gunlukLimitTl: null,
    bakiyeSiniriUygula: false,
    tercihler: [...ODEME_TERCIHLERI],
};
export const BOS_CARI_AYAR = {
    emirAcik: null,
    islemEnAzTl: null,
    islemEnCokTl: null,
    gunlukLimitTl: null,
    bakiyeSiniriUygula: null,
    calismaBaslangic: null,
    calismaBitis: null,
    fiyatGecerlilikSn: null,
};
const tutar = (v) => {
    if (v === null || v === undefined || v === "")
        return null;
    const n = Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
};
/** Sınır alanlarının ortak denetimi (firma ve cari ayarında) */
const sinirHatalari = (a) => {
    const h = [];
    const tutarlar = [
        ["İşlem başına en az", a.islemEnAzTl],
        ["İşlem başına en çok", a.islemEnCokTl],
        ["Günlük limit", a.gunlukLimitTl],
    ];
    for (const [ad, v] of tutarlar) {
        if (v !== null && (Number.isNaN(v) || v < 0 || v > 1e12))
            h.push(`${ad} tutarı geçersiz.`);
    }
    if (a.islemEnAzTl !== null && a.islemEnCokTl !== null && a.islemEnAzTl > a.islemEnCokTl)
        h.push("İşlem başına en az tutar en çoktan büyük olamaz.");
    if (a.islemEnCokTl !== null && a.gunlukLimitTl !== null && a.islemEnCokTl > a.gunlukLimitTl)
        h.push("İşlem başına en çok tutar günlük limitten büyük olamaz.");
    const b = a.calismaBaslangic;
    const s = a.calismaBitis;
    if ((b && !saatGecerliMi(b)) || (s && !saatGecerliMi(s)))
        h.push("Çalışma saati SS:DD biçiminde olmalıdır.");
    if (!!b !== !!s)
        h.push("Çalışma saatinin başlangıcı ve bitişi birlikte girilmelidir.");
    if (b && s && saatGecerliMi(b) && saatGecerliMi(s) && b >= s)
        h.push("Çalışma saatinin bitişi başlangıçtan sonra olmalıdır.");
    if (a.fiyatGecerlilikSn !== null && (!Number.isInteger(a.fiyatGecerlilikSn) || a.fiyatGecerlilikSn < 30 || a.fiyatGecerlilikSn > 3600))
        h.push("Fiyat geçerlilik süresi 30–3600 saniye olmalıdır.");
    return h;
};
const bosIseNull = (v) => {
    const s = String(v ?? "").trim();
    return s ? s : null;
};
const kimlikNo = (v) => (v === null || v === undefined || v === "" ? null : Number(v));
/** Firma mobil ayarı: girdiyi düzenler ve denetler */
export const ayarDuzenle = (g) => {
    const ep = epostaListesi(g?.bildirimEposta);
    const ham = (Array.isArray(g?.tercihler) ? g.tercihler : VARSAYILAN_AYAR.tercihler).map((x) => String(x).toUpperCase());
    const gecerliTercih = (x) => ODEME_TERCIHLERI.includes(x);
    const sureHam = g?.fiyatGecerlilikSn;
    const ayar = {
        emirAcik: !!g?.emirAcik,
        vezneId: kimlikNo(g?.vezneId),
        kullaniciId: kimlikNo(g?.kullaniciId),
        bildirimEposta: ep.liste,
        fiyatGecerlilikSn: sureHam === undefined || sureHam === null || sureHam === "" ? VARSAYILAN_AYAR.fiyatGecerlilikSn : Number(sureHam),
        calismaBaslangic: bosIseNull(g?.calismaBaslangic),
        calismaBitis: bosIseNull(g?.calismaBitis),
        calismaGunleri: String(g?.calismaGunleri ?? VARSAYILAN_AYAR.calismaGunleri),
        islemEnAzTl: tutar(g?.islemEnAzTl),
        islemEnCokTl: tutar(g?.islemEnCokTl),
        gunlukLimitTl: tutar(g?.gunlukLimitTl),
        bakiyeSiniriUygula: !!g?.bakiyeSiniriUygula,
        tercihler: [...new Set(ham)].filter(gecerliTercih),
    };
    const hatalar = [];
    if (ep.hata)
        hatalar.push(ep.hata);
    if (ham.some((x) => !gecerliTercih(x)))
        hatalar.push("Bilinmeyen ödeme tercihi.");
    if (ayar.tercihler.length === 0)
        hatalar.push("En az bir ödeme / teslim tercihi açık olmalıdır.");
    if (!/^[01]{7}$/.test(ayar.calismaGunleri) || ayar.calismaGunleri === "0000000")
        hatalar.push("Çalışma günlerinden en az biri seçilmelidir.");
    if (ayar.vezneId !== null && (!Number.isInteger(ayar.vezneId) || ayar.vezneId <= 0))
        hatalar.push("Vezne seçimi geçersiz.");
    if (ayar.kullaniciId !== null && (!Number.isInteger(ayar.kullaniciId) || ayar.kullaniciId <= 0))
        hatalar.push("Kullanıcı seçimi geçersiz.");
    if (ayar.emirAcik && (ayar.vezneId === null || ayar.kullaniciId === null))
        hatalar.push("Emir almak için mobil vezne ve mobil kullanıcı seçilmelidir.");
    hatalar.push(...sinirHatalari(ayar));
    return { ayar, hatalar };
};
/** Cari mobil ayarı: girdiyi düzenler ve denetler (boş = firma varsayılanı) */
export const cariAyarDuzenle = (g) => {
    const ucDurum = (v) => v === null || v === undefined || v === "" ? null : v === true || v === "true" || v === 1 || v === "1";
    const sureHam = g?.fiyatGecerlilikSn;
    const ayar = {
        emirAcik: ucDurum(g?.emirAcik),
        islemEnAzTl: tutar(g?.islemEnAzTl),
        islemEnCokTl: tutar(g?.islemEnCokTl),
        gunlukLimitTl: tutar(g?.gunlukLimitTl),
        bakiyeSiniriUygula: ucDurum(g?.bakiyeSiniriUygula),
        calismaBaslangic: bosIseNull(g?.calismaBaslangic),
        calismaBitis: bosIseNull(g?.calismaBitis),
        fiyatGecerlilikSn: sureHam === undefined || sureHam === null || sureHam === "" ? null : Number(sureHam),
    };
    return { ayar, hatalar: sinirHatalari(ayar) };
};
export const BOS_MAKAS = { alisTip: "Y", alisDeger: 0, satisTip: "Y", satisDeger: 0 };
const yuvarla = (v, ondalik) => {
    const c = 10 ** Math.max(0, Math.min(8, ondalik));
    return Math.round(v * c) / c;
};
/**
 * Listedeki fiyata cariye özel makası uygular. Sonuç 0 ya da altına düşerse o taraf gösterilmez (null).
 * Liste fiyatı yoksa (0 / null) o taraf yine null.
 */
export const makasUygula = (liste, m, ondalik = 6) => {
    const mk = m || BOS_MAKAS;
    const fark = (fiyat, tip, deger) => (tip === "Y" ? (fiyat * deger) / 100 : deger);
    const a = liste.alis && liste.alis > 0 ? liste.alis + fark(liste.alis, mk.alisTip, Number(mk.alisDeger) || 0) : null;
    const s = liste.satis && liste.satis > 0 ? liste.satis - fark(liste.satis, mk.satisTip, Number(mk.satisDeger) || 0) : null;
    return { alis: a !== null && a > 0 ? yuvarla(a, ondalik) : null, satis: s !== null && s > 0 ? yuvarla(s, ondalik) : null };
};
/** Makas girdisini denetler; yüzde ±50'yi aşamaz, tutar listedeki fiyatı aşamaz (kontrol çağıranda) */
export const makasDuzenle = (g) => {
    const tip = (v) => (String(v).toUpperCase() === "T" ? "T" : "Y");
    const sayi = (v) => {
        if (v === null || v === undefined || v === "")
            return 0;
        const n = Number(String(v).replace(",", "."));
        return Number.isFinite(n) ? n : NaN;
    };
    const makas = { alisTip: tip(g?.alisTip), alisDeger: sayi(g?.alisDeger), satisTip: tip(g?.satisTip), satisDeger: sayi(g?.satisDeger) };
    if (Number.isNaN(makas.alisDeger) || Number.isNaN(makas.satisDeger))
        return { makas, hata: "Makas değeri sayı olmalıdır." };
    for (const [t, d] of [[makas.alisTip, makas.alisDeger], [makas.satisTip, makas.satisDeger]]) {
        if (t === "Y" && Math.abs(d) >= 50)
            return { makas, hata: "Yüzde makas -50 ile 50 arasında olmalıdır." };
        if (Math.abs(d) > 1e9)
            return { makas, hata: "Makas tutarı çok büyük." };
    }
    return { makas, hata: null };
};
export const makasBosMu = (m) => !m.alisDeger && !m.satisDeger;
/** Ürün birimi: altın / gümüş gram, ziynet adet, döviz kodu */
export const birimAdi = (urunTipi, birim, kod) => {
    if (urunTipi === 1 || urunTipi === 2)
        return birim === 0 ? "adet" : "gr";
    if (urunTipi === 3)
        return birim === 1 ? "gr" : "adet";
    return kod.trim();
};
export const fiyatGrubu = (urunTipi, kod, ad) => {
    if (urunTipi === 1)
        return "altin";
    if (urunTipi === 2)
        return "gumus";
    if (urunTipi === 3)
        return "ziynet";
    const metin = `${kod} ${ad}`.toLocaleUpperCase("tr");
    if (/G[ÜU]M[ÜU][ŞS]/.test(metin))
        return "gumus";
    if (/[ÇC]EYREK|YARIM|Z[İI]YNET|CUMHUR|RE[ŞS]AT|GREMSE|\bATA\b/.test(metin))
        return "ziynet";
    if (/ALTIN|AYAR/.test(metin) || kod.trim().toLocaleUpperCase("tr") === "HAS")
        return "altin";
    return "doviz";
};
export const etkinKurallar = (f, c) => {
    const saatCifti = c.calismaBaslangic && c.calismaBitis ? [c.calismaBaslangic, c.calismaBitis] : [f.calismaBaslangic, f.calismaBitis];
    return {
        emirAcik: c.emirAcik ?? f.emirAcik,
        firmaHazir: f.vezneId !== null && f.kullaniciId !== null,
        islemEnAzTl: c.islemEnAzTl ?? f.islemEnAzTl,
        islemEnCokTl: c.islemEnCokTl ?? f.islemEnCokTl,
        gunlukLimitTl: c.gunlukLimitTl ?? f.gunlukLimitTl,
        bakiyeSiniriUygula: c.bakiyeSiniriUygula ?? f.bakiyeSiniriUygula,
        calismaBaslangic: saatCifti[0],
        calismaBitis: saatCifti[1],
        calismaGunleri: f.calismaGunleri,
        fiyatGecerlilikSn: c.fiyatGecerlilikSn ?? f.fiyatGecerlilikSn,
        tercihler: f.tercihler,
    };
};
const GUN_ADLARI = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
/** Şu an çalışma gün / saati içinde mi — Türkiye saatiyle (sunucunun saat dilimi farklı olabilir). Değilse açıklama. */
export const calismaDisi = (k, simdi) => {
    const z = trZaman(simdi);
    const gun = (z.haftaGunu + 6) % 7; // Pazartesi 0
    if (k.calismaGunleri[gun] !== "1") {
        const acik = GUN_ADLARI.filter((_, i) => k.calismaGunleri[i] === "1").join(", ");
        return `${GUN_ADLARI[gun]} günleri emir alınmıyor${acik ? ` (açık günler: ${acik})` : ""}.`;
    }
    if (k.calismaBaslangic && k.calismaBitis) {
        const s = `${String(z.saat).padStart(2, "0")}:${String(z.dakika).padStart(2, "0")}`;
        if (s < k.calismaBaslangic || s >= k.calismaBitis)
            return `Emirler ${k.calismaBaslangic}–${k.calismaBitis} arasında alınır.`;
    }
    return null;
};
/** Miktar: adet birimde tam sayı, gram / döviz en çok 3 ondalık; sıfırdan büyük ve makul */
export const miktarHatasi = (miktar, birim) => {
    if (!Number.isFinite(miktar) || miktar <= 0)
        return "Miktar sıfırdan büyük olmalıdır.";
    if (miktar > 1e9)
        return "Miktar çok büyük.";
    if (birim.toLocaleLowerCase("tr-TR") === "adet" && !Number.isInteger(miktar))
        return "Adet tam sayı olmalıdır.";
    if (Math.round(miktar * 1000) / 1000 !== miktar)
        return "Miktar en çok 3 ondalık olabilir.";
    return null;
};
export const tutarHesapla = (miktar, birimFiyat) => Math.round(miktar * birimFiyat * 100) / 100;
/**
 * Emrin kurallara uygunluğu (K20, K30): açık mı, çalışma saati, işlem başına en az / en çok, günlük limit, bakiye sınırı.
 * bugunToplam: bugün verilmiş bekleyen + onaylanmış emirlerin toplamı. bakiyeBorcTl: carinin şu anki TL borcu (alacaklıysa 0),
 * bekleyenAlisTl: onay bekleyen alış emirleri. bakiyeSiniri: cari kartındaki sınır (0 / null = sınır yok).
 */
export const emirHatasi = (k, e, d) => {
    if (!k.emirAcik)
        return "Mobil emir şu an kapalı. Firmanızla görüşün.";
    if (!k.firmaHazir)
        return "Firma mobil emir ayarlarını henüz tamamlamamış.";
    const saat = calismaDisi(k, d.simdi);
    if (saat)
        return saat;
    if (e.tercih && !k.tercihler.includes(e.tercih))
        return "Seçilen ödeme / teslim tercihi kullanılamıyor.";
    if (k.islemEnAzTl !== null && e.tutar < k.islemEnAzTl)
        return `İşlem tutarı en az ${k.islemEnAzTl.toLocaleString("tr-TR")} TL olmalıdır.`;
    if (k.islemEnCokTl !== null && e.tutar > k.islemEnCokTl)
        return `İşlem tutarı en çok ${k.islemEnCokTl.toLocaleString("tr-TR")} TL olabilir.`;
    if (k.gunlukLimitTl !== null && d.bugunToplam + e.tutar > k.gunlukLimitTl) {
        const kalan = Math.max(0, k.gunlukLimitTl - d.bugunToplam);
        return `Günlük işlem limitiniz aşılıyor (kalan ${kalan.toLocaleString("tr-TR")} TL).`;
    }
    if (k.bakiyeSiniriUygula && e.yon === "AL" && d.bakiyeSiniri && d.bakiyeSiniri > 0 && d.bakiyeBorcTl + d.bekleyenAlisTl + e.tutar > d.bakiyeSiniri)
        return "Bu işlem bakiye sınırınızı aşıyor. Firmanızla görüşün.";
    return null;
};
export const EMIR_DURUM_ADLARI = {
    BEKLIYOR: "Onay bekliyor",
    ISLENIYOR: "İşleniyor",
    ONAYLANDI: "Onaylandı",
    REDDEDILDI: "Reddedildi",
    SURESI_DOLDU: "Süresi doldu",
    IPTAL: "İptal edildi",
};
/** Firmanın açık tercih listesi (cariye gösterilecek ad ile) */
export const tercihSecenekleri = (k) => k.tercihler.map((t) => ({ kod: t, ad: TERCIH_ADLARI[t] }));
/** Firmaya özel giriş bağlantısı (K3) */
export const girisBaglantisi = (kok, musteriNo, kullaniciAdi) => {
    const q = new URLSearchParams({ m: musteriNo, ...(kullaniciAdi ? { u: kullaniciAdi } : {}) });
    return `${kok.replace(/\/+$/, "")}/?${q.toString()}`;
};
/** Cariye gönderilecek paylaşım metni (V2) */
export const paylasimMetni = (v) => [
    `${v.kisaAd} mobil giriş`,
    `Adres: ${v.baglanti}`,
    `Kullanıcı adı: ${v.kullaniciAdi}`,
    `İlk şifre: ${v.geciciSifre}`,
    "İlk girişte şifrenizi değiştirmeniz istenecek.",
].join("\n");
// ───────────── Ticari katalog (Faz 8) ─────────────
/**
 * Mobil katalogda stok kartının fiyatı (KDV dahil, kuruşa yuvarlı): carinin fiyat listesindeki fiyat, yoksa kartın satış
 * fiyatı; kart fiyatı KDV hariç girilmişse KDV eklenir (Ticari Satış Fişi ile aynı kural). Fiyatı olmayan kart satılmaz (null).
 */
export const stokFiyati = (k) => {
    const ham = k.listeFiyati !== null && k.listeFiyati !== undefined ? Number(k.listeFiyati) : Number(k.satisFiyati);
    if (!Number.isFinite(ham) || ham <= 0)
        return null;
    const dahil = k.fiyatKdvDahil ? ham : ham * (1 + (Number(k.kdvOrani) || 0) / 100);
    return Math.round(dahil * 100) / 100;
};
export const SIPARIS_EN_COK_SATIR = 50;
/** Sepet girdisini okur: en az bir, en çok 50 satır; aynı ürün iki kez olmaz; miktar sayıya çevrilir (virgül ondalık) */
export const siparisSatirlari = (g) => {
    const ham = Array.isArray(g) ? g : [];
    if (!ham.length)
        return { satirlar: [], hata: "Sepet boş." };
    if (ham.length > SIPARIS_EN_COK_SATIR)
        return { satirlar: [], hata: `Bir siparişte en çok ${SIPARIS_EN_COK_SATIR} ürün olabilir.` };
    const satirlar = ham.map((x) => ({
        stokKartId: Number(x?.stokKartId),
        miktar: Number(String(x?.miktar ?? "").replace(",", ".")),
        ...(x?.gorulenFiyat !== undefined && x?.gorulenFiyat !== null ? { gorulenFiyat: Number(x.gorulenFiyat) } : {}),
    }));
    if (satirlar.some((s) => !Number.isInteger(s.stokKartId) || s.stokKartId <= 0))
        return { satirlar: [], hata: "Sepette geçersiz ürün var." };
    if (new Set(satirlar.map((s) => s.stokKartId)).size !== satirlar.length)
        return { satirlar: [], hata: "Aynı ürün sepette iki kez var." };
    return { satirlar, hata: null };
};
