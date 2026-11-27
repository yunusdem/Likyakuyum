/**
 * Adisyon saf hesapları (docs/TICARI_ADISYON_YOL_HARITASI.md, TA19–TA40). npm bağımlılığı yok: ön yüz de içe aktarır.
 */
export const ADISYON_TUR = { MASA: 1, PAKET: 2, GEL_AL: 3, TEZGAH: 4 };
export const ADISYON_DURUM = { ACIK: 0, HESAP_ISTENDI: 1, KAPANDI: 2, IPTAL: 9 };
export const KALEM_DURUM = { GONDERILMEDI: 0, HAZIRLANIYOR: 1, HAZIR: 2, SERVIS: 3 };
export const PAKET_DURUM = { HAZIRLANIYOR: 1, YOLDA: 2, TESLIM: 3 };
export const PAKET_DURUM_ADI = { 1: "Hazırlanıyor", 2: "Yolda", 3: "Teslim edildi" };
/** Yetki seviyeleri (TA25) ve seviyelerin hakları; garsona tek tek ek yetki verilebilir */
export const SEVIYE = { GARSON: 1, KASIYER: 2, YETKILI: 3 };
export const SEVIYE_ADI = { 1: "Garson", 2: "Kasiyer", 3: "Yetkili" };
export const YETKILER = ["masa-ac", "siparis", "hesap-iste", "tahsilat", "bolme", "masa-tasi", "birlestir", "ikram", "iptal", "indirim", "fiyat", "duzelt"];
export const YETKI_ADI = {
    "masa-ac": "Masa açma", siparis: "Sipariş girme", "hesap-iste": "Hesap isteme", tahsilat: "Tahsilat", bolme: "Hesap bölme", "masa-tasi": "Masa / ürün taşıma",
    birlestir: "Masa birleştirme / ayırma", ikram: "İkram", iptal: "İptal", indirim: "İndirim", fiyat: "Fiyat değiştirme", duzelt: "Kapanmış adisyonu düzeltme",
};
const SEVIYE_YETKI = {
    1: ["masa-ac", "siparis", "hesap-iste"],
    2: ["masa-ac", "siparis", "hesap-iste", "tahsilat", "bolme", "masa-tasi", "birlestir"],
    3: [...YETKILER],
};
/** Seviye + ek yetkiler (virgüllü metin ya da dizi) → yetki kümesi; bilinmeyen ek yetki yok sayılır */
export function yetkiKumesi(seviye, ek) {
    const s = new Set(SEVIYE_YETKI[seviye] || SEVIYE_YETKI[1]);
    const ekler = Array.isArray(ek) ? ek : String(ek || "").split(",");
    for (const e of ekler.map((x) => String(x).trim()).filter(Boolean))
        if (YETKILER.includes(e))
            s.add(e);
    return s;
}
export const ekYetkiMetni = (ek) => {
    const t = [...new Set((ek || []).map((x) => String(x).trim()).filter((x) => YETKILER.includes(x)))];
    return t.length ? t.join(",") : null;
};
/** PIN: 4–8 rakam; ardışık / tekrarlı zayıf PIN'ler reddedilir (1234, 0000, 4321) */
export function pinDenetle(pin) {
    const p = String(pin ?? "").trim();
    if (!/^\d{4,8}$/.test(p))
        return "PIN 4 ile 8 arasında rakam olmalı.";
    if (/^(\d)\1+$/.test(p))
        return "PIN tek rakamın tekrarı olamaz.";
    const artan = "01234567890123456789", azalan = "98765432109876543210";
    if (artan.includes(p) || azalan.includes(p))
        return "PIN ardışık rakamlardan oluşamaz.";
    return null;
}
/** Adisyon no (TA38): birim kodu (en çok 3 harf / rakam, boşsa "AD") + yıl + 9 hane */
export function adisyonNo(birimKodu, yil, sira) {
    const b = String(birimKodu || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3) || "AD";
    return `${b}${yil}${String(Math.max(1, Math.trunc(sira))).padStart(9, "0")}`;
}
/** Masada KDV oranı (TA32): kartın Adisyon KDV'si, yoksa ayardaki varsayılan, o da yoksa kartın KDV'si */
export function masaKdvOrani(kartAdisyonKdv, ayarVarsayilan, kartKdv) {
    if (kartAdisyonKdv !== null && kartAdisyonKdv !== undefined && Number.isFinite(Number(kartAdisyonKdv)))
        return Number(kartAdisyonKdv);
    if (ayarVarsayilan !== null && ayarVarsayilan !== undefined && Number.isFinite(Number(ayarVarsayilan)))
        return Number(ayarVarsayilan);
    return Number(kartKdv) || 0;
}
const y2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const y4 = (n) => Math.round(n * 10000) / 10000;
/** Porsiyon fiyatı (TA28): porsiyonun kendi fiyatı, yoksa kart fiyatı × çarpan (KDV dahil, 4 hane) */
export const porsiyonFiyati = (kartFiyati, carpan, porsiyonFiyat) => porsiyonFiyat !== null && porsiyonFiyat !== undefined && Number(porsiyonFiyat) > 0 ? y4(Number(porsiyonFiyat)) : y4(Number(kartFiyati) * (Number(carpan) || 1));
/** Kalem tutarı (KDV dahil): ikram / iptal 0 */
export const kalemTutari = (k) => (k.ikram || k.iptal ? 0 : y2(Number(k.miktar) * Number(k.birimFiyat)));
/** Adisyon toplamı: kalemler + servis ücreti (TA29, yalnız açıkken; ikram / iptal hariç, oran %) */
export function adisyonToplami(kalemler, servisOrani) {
    const ara = y2(kalemler.reduce((t, k) => t + kalemTutari(k), 0));
    const servis = servisOrani && servisOrani > 0 ? y2((ara * servisOrani) / 100) : 0;
    return { ara, servis, toplam: y2(ara + servis), ikram: y2(kalemler.filter((k) => k.ikram && !k.iptal).reduce((t, k) => t + y2(Number(k.miktar) * Number(k.birimFiyat)), 0)) };
}
/** Eşit bölme (TA35): toplam kişi sayısına; kuruş artığı ilk paylara 1'er kuruş */
export function esitBol(toplam, kisi) {
    const n = Math.trunc(kisi);
    if (!(n >= 1))
        throw new Error("Kişi sayısı en az 1 olmalı.");
    const kurus = Math.round(toplam * 100);
    const taban = Math.floor(kurus / n), artik = kurus - taban * n;
    return Array.from({ length: n }, (_, i) => (taban + (i < artik ? 1 : 0)) / 100);
}
/** Açık kalma süresi (dakika) → "1 sa 05 dk" / "45 dk" */
export function sureYaz(dakika) {
    const d = Math.max(0, Math.floor(dakika));
    return d >= 60 ? `${Math.floor(d / 60)} sa ${String(d % 60).padStart(2, "0")} dk` : `${d} dk`;
}
// ───────────── Sipariş (D3) ─────────────
/**
 * Ürünün masadaki taban fiyatı (TA31 / TA32, KDV dahil): bölgenin fiyat listesindeki fiyat, yoksa kartın fiyatı.
 * Kartta fiyat KDV dahil yazılıysa olduğu gibi (masada yalnız KDV ayrımı değişir); KDV hariç yazılıysa masa KDV'si eklenir.
 */
export function masaTabanFiyati(k, masaKdv) {
    const f = k.listeFiyati !== null && k.listeFiyati !== undefined ? Number(k.listeFiyati) : k.satisFiyati === null ? null : Number(k.satisFiyati);
    if (f === null || !Number.isFinite(f) || f <= 0)
        return null;
    return k.fiyatKdvDahil ? y4(f) : y4(f * (1 + (Number(masaKdv) || 0) / 100));
}
/**
 * Seçenek seçimi denetimi (TA28). Yalnız ürüne bağlı, etkin grup ve seçenekler; zorunlu grupta en az bir (tek seçimde tam bir),
 * tek seçim grubunda en çok bir. Etkin seçeneği kalmamış zorunlu grup sorulmaz. Dönüş: sıralı seçimler + toplam ek fiyat ya da hata.
 */
export function secimDenetle(gruplar, secilenIdler) {
    const secilen = [...new Set((secilenIdler || []).map(Number).filter((x) => Number.isInteger(x) && x > 0))];
    if (secilen.length > 20)
        return { hata: "En çok 20 seçenek seçilebilir." };
    const etkin = gruplar.filter((g) => g.aktif !== false);
    const bulunan = new Set();
    const secimler = [];
    for (const g of etkin) {
        const secenekler = g.secenekler.filter((s) => s.aktif !== false);
        const buGrup = secenekler.filter((s) => secilen.includes(s.secenekId));
        buGrup.forEach((s) => bulunan.add(s.secenekId));
        if (g.zorunlu && secenekler.length && !buGrup.length)
            return { hata: `"${g.ad}" seçilmeli.` };
        if (!g.coklu && buGrup.length > 1)
            return { hata: `"${g.ad}" için tek seçenek seçilebilir.` };
        for (const s of buGrup)
            secimler.push({ sgId: g.sgId, grup: g.ad, secenekId: s.secenekId, ad: s.ad, ekFiyat: y2(Number(s.ekFiyat) || 0) });
    }
    const yabanci = secilen.find((x) => !bulunan.has(x));
    if (yabanci !== undefined)
        return { hata: "Seçilen seçenek bu ürüne ait değil ya da pasif." };
    return { secimler, ekFiyat: y2(secimler.reduce((t, s) => t + s.ekFiyat, 0)) };
}
/** Seçimlerin mutfak / adisyon yazısı: "Pişme derecesi: Orta · Ekstralar: Ekstra kaşar (+25,00), Acı sos (+5,00)" */
export function secimMetni(secimler) {
    const gruplar = new Map();
    for (const s of secimler || []) {
        const ek = s.ekFiyat > 0 ? ` (+${s.ekFiyat.toFixed(2).replace(".", ",")})` : "";
        gruplar.set(s.grup, [...(gruplar.get(s.grup) || []), `${s.ad}${ek}`]);
    }
    return [...gruplar].map(([g, l]) => `${g}: ${l.join(", ")}`).join(" · ");
}
/** Kalemin birim fiyatı (KDV dahil): porsiyon fiyatı + seçeneklerin ek fiyatı (ek fiyat porsiyondan bağımsız, adet başına) */
export const kalemBirimFiyati = (taban, carpan, porsiyonFiyat, ekFiyat) => y4(porsiyonFiyati(taban, carpan, porsiyonFiyat) + (Number(ekFiyat) || 0));
/** Sipariş miktarı: tartılı (Kg / Gr) üründe 0'dan büyük, en çok 3 ondalık; öbür ürünlerde 1–999 tam sayı */
export function siparisMiktariDenetle(miktar, tartili) {
    const m = Number(String(miktar ?? "").replace(",", "."));
    if (!Number.isFinite(m) || m <= 0)
        return "Miktar 0'dan büyük olmalı.";
    if (tartili)
        return m > 99999 || Math.abs(m * 1000 - Math.round(m * 1000)) > 1e-6 ? "Tartılı üründe miktar en çok 3 ondalık ve 99.999'dan küçük olmalı." : null;
    return Number.isInteger(m) && m <= 999 ? null : "Adetli üründe miktar 1 ile 999 arasında tam sayı olmalı (yarım porsiyon için porsiyon seçin).";
}
export const masaGorunumu = (durum) => (durum === null || durum === undefined ? "bos" : durum === ADISYON_DURUM.HESAP_ISTENDI ? "hesap" : "dolu");
// ───────────── Masa işlemleri (D6) ─────────────
/** İptal / ikram nedenleri (TA27): listeden seçilir, "Diğer"de açıklama zorunlu; rapora düşer */
export const IPTAL_NEDENLERI = ["Müşteri vazgeçti", "Yanlış sipariş", "Ürün kalmadı", "Bekleme uzun sürdü", "Ürün beğenilmedi", "Diğer"];
export const IKRAM_NEDENLERI = ["İşletme ikramı", "Müşteri memnuniyeti", "Bekleme özrü", "Personel", "Diğer"];
/** Neden metni: listedeki seçim (+ isteğe bağlı açıklama); "Diğer"de en az 3 karakter açıklama. Dönüş: metin ya da hata */
export function nedenMetni(liste, secim, aciklama) {
    const s = String(secim ?? "").trim();
    const a = String(aciklama ?? "").trim().replace(/\s+/g, " ");
    if (!liste.includes(s))
        return { hata: "Neden listeden seçilmeli." };
    if (s === "Diğer" && a.length < 3)
        return { hata: "\"Diğer\" seçildiyse açıklama yazılmalı (en az 3 karakter)." };
    const metin = s === "Diğer" ? `Diğer: ${a}` : a ? `${s}: ${a}` : s;
    return { metin: metin.slice(0, 200) };
}
/**
 * Kalemin bir kısmına işlem (ikram / iptal / taşıma): verilmezse tamamı. Adetli üründe 1..miktar tam sayı; tartılı (Kg / Gr)
 * üründe yalnız tamamı (tartılan ürün bölünmez). Dönüş: işlem miktarı ya da hata.
 */
export function kismiMiktar(toplam, istenen, tartili) {
    if (istenen === undefined || istenen === null || String(istenen) === "")
        return { miktar: toplam, tamami: true };
    const m = Number(String(istenen).replace(",", "."));
    if (!Number.isFinite(m) || m <= 0)
        return { hata: "Miktar 0'dan büyük olmalı." };
    if (Math.abs(m - toplam) < 1e-9)
        return { miktar: toplam, tamami: true };
    if (tartili)
        return { hata: "Tartılı üründe kalemin tamamı seçilmeli." };
    if (!Number.isInteger(m))
        return { hata: "Adetli üründe miktar tam sayı olmalı." };
    if (m > toplam)
        return { hata: `Kalemde ${toplam} adet var.` };
    return { miktar: m, tamami: false };
}
// ───────────── Paket servis / gel-al (D8, TA28) ─────────────
/** Telefon: rakamlar; +90 / 0 öneki atılır, 10 hane (5XX…) saklanır. Geçersizse null */
export function telefonNormal(v) {
    let d = String(v ?? "").replace(/\D/g, "");
    if (d.startsWith("90") && d.length === 12)
        d = d.slice(2);
    if (d.startsWith("0") && d.length === 11)
        d = d.slice(1);
    return /^[2-58]\d{9}$/.test(d) ? d : null;
}
/** 5321234567 → "0532 123 45 67" */
export const telefonYaz = (t) => {
    const d = String(t ?? "");
    return /^\d{10}$/.test(d) ? `0${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8)}` : d;
};
/**
 * Paket / gel-al müşterisi: ad zorunlu (2–100); pakette telefon ve adres (5–400) zorunlu, gel-alda telefon isteğe bağlı (yazılırsa
 * geçerli olmalı), adres yok sayılır. Dönüş: temiz değerler ya da hata.
 */
export function paketMusteriDenetle(g) {
    const tur = Number(g.tur);
    if (tur !== ADISYON_TUR.PAKET && tur !== ADISYON_TUR.GEL_AL)
        return { hata: "Tür paket ya da gel-al olmalı." };
    const ad = String(g.ad ?? "").trim().replace(/\s+/g, " ");
    if (ad.length < 2)
        return { hata: "Müşteri adı yazılmalı." };
    if (ad.length > 100)
        return { hata: "Müşteri adı en çok 100 karakter." };
    const telHam = String(g.tel ?? "").trim();
    const tel = telHam ? telefonNormal(telHam) : null;
    if (telHam && !tel)
        return { hata: "Telefon numarası geçersiz (ör. 0532 123 45 67)." };
    if (tur === ADISYON_TUR.PAKET && !tel)
        return { hata: "Paket serviste telefon zorunlu." };
    const adres = tur === ADISYON_TUR.PAKET ? String(g.adres ?? "").trim().replace(/\s+/g, " ") : "";
    if (tur === ADISYON_TUR.PAKET && adres.length < 5)
        return { hata: "Paket serviste adres yazılmalı." };
    if (adres.length > 400)
        return { hata: "Adres en çok 400 karakter." };
    const not = String(g.not ?? "").trim().replace(/\s+/g, " ").slice(0, 250) || null;
    return { tur: tur, ad, tel, adres: adres || null, not };
}
/**
 * Paket durumu geçişi: paket hazırlanıyor → yolda → teslim (yoldayken geri alınabilir: hazırlanıyor); gel-al hazırlanıyor → teslim.
 * Teslim edilmiş paketin durumu değişmez. Dönüş: hata metni ya da null.
 */
export function paketDurumGecisi(tur, mevcut, yeni) {
    const y = Number(yeni), m = Number(mevcut ?? PAKET_DURUM.HAZIRLANIYOR);
    if (![1, 2, 3].includes(y))
        return "Geçersiz paket durumu.";
    if (tur !== ADISYON_TUR.PAKET && tur !== ADISYON_TUR.GEL_AL)
        return "Bu adisyon paket / gel-al değil.";
    if (m === PAKET_DURUM.TESLIM)
        return "Teslim edilmiş siparişin durumu değişmez.";
    if (y === m)
        return `Sipariş zaten "${PAKET_DURUM_ADI[y]}".`;
    if (tur === ADISYON_TUR.GEL_AL)
        return y === PAKET_DURUM.TESLIM ? null : "Gel-alda yalnız \"Teslim edildi\" seçilir.";
    if (m === PAKET_DURUM.HAZIRLANIYOR)
        return y === PAKET_DURUM.YOLDA ? null : "Paket önce yola çıkmalı.";
    return null; // yolda → teslim ya da hazırlanıyor (geri al)
}
