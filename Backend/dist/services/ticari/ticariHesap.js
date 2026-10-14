/**
 * Ticari İşlemler saf hesapları (docs/TICARI_ISLEMLER_YOL_HARITASI.md, T5, T12). Veritabanına dokunmaz;
 * sunucu kaydı ve ön yüz aynı fonksiyonu kullanır, saf mantık testiyle sınanır.
 *
 * Satış fişinde fiyat KDV dahil girilir. e-Belge satırı ise KDV hariç birim fiyat (2 hane), tutar = miktar × birim fiyat
 * ve iskonto ister; KDV, iskontodan sonraki matrahtan hesaplanır. Bu yüzden satır şöyle çözülür:
 *   brüt (dahil) = miktar × fiyat · satır iskontosu (% ya da tutar, dahil) · başlık iskontosu satırlara dağıtılır
 *   matrah = net dahil ÷ (1 + oran) · birim fiyat = fiyat ÷ (1 + oran) (2 hane)
 *   tutar = miktar × birim fiyat; matrahtan küçük kalırsa birim fiyat kuruş yukarı alınır (iskonto eksiye düşmesin)
 *   iskonto (hariç) = tutar − matrah · KDV = matrah × oran · toplam = matrah + KDV
 */
export const yuvarla2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const yukari2 = (n) => Math.ceil(yuvarla(n * 100, 6)) / 100;
const yuvarla = (n, hane) => {
    const k = 10 ** hane;
    return Math.round((n + Number.EPSILON) * k) / k;
};
const sayi = (v) => {
    // "1.234,5" Türkçe biçim; virgülsüz metin olduğu gibi okunur ("12.5" = 12,5)
    const n = typeof v === "string" ? Number(v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v) : Number(v);
    return Number.isFinite(n) ? n : 0;
};
/** İskonto tutarını tutar oranında dağıtır; kuruş artığı son satıra yazılır. */
export const oranlaDagit = (tutarlar, toplam) => {
    const t = yuvarla2(Math.max(0, toplam));
    const genel = tutarlar.reduce((a, x) => a + x, 0);
    if (!t || genel <= 0)
        return tutarlar.map(() => 0);
    const paylar = tutarlar.map((x) => yuvarla2((t * x) / genel));
    const fark = yuvarla2(t - paylar.reduce((a, x) => a + x, 0));
    if (fark) {
        // Artığı en büyük satıra yaz (eksiye düşmesin)
        let i = 0;
        tutarlar.forEach((x, j) => { if (x > tutarlar[i])
            i = j; });
        paylar[i] = yuvarla2(paylar[i] + fark);
    }
    return paylar;
};
const satirIskontosu = (brut, tur, deger) => {
    if (tur === 1)
        return yuvarla2((brut * Math.min(Math.max(deger, 0), 100)) / 100);
    if (tur === 2)
        return yuvarla2(Math.min(Math.max(deger, 0), brut));
    return 0;
};
/** Net dahil tutardan e-Belge satırını çözer. */
export const satirCoz = (miktar, kdvDahilFiyat, kdvOrani, netDahil) => {
    const bolen = 1 + kdvOrani / 100;
    const matrah = yuvarla2(netDahil / bolen);
    let birimFiyat = yuvarla2(kdvDahilFiyat / bolen);
    let tutar = yuvarla2(miktar * birimFiyat);
    if (tutar + 0.0001 < matrah) {
        birimFiyat = yukari2(matrah / miktar);
        tutar = yuvarla2(miktar * birimFiyat);
    }
    const iskontoTutari = yuvarla2(Math.max(0, tutar - matrah));
    const kdvTutari = yuvarla2((matrah * kdvOrani) / 100);
    return { birimFiyat, tutar, iskontoTutari, matrah, kdvTutari, toplamTutar: yuvarla2(matrah + kdvTutari) };
};
export const GECERLI_KDV_ORANLARI = [0, 1, 8, 10, 18, 20];
/**
 * Fiş hesabı. Başlık iskontosu: tür 1 yüzde, 2 tutar (KDV dahil); satır iskontolarından sonra kalan tutar üzerinden.
 * Hata durumunda (miktar ≤ 0, fiyat < 0, oran geçersiz) Error fırlatır; mesaj kullanıcıya gösterilir.
 */
export function ticariFisHesapla(girdiler, baslik) {
    const ara = girdiler.map((g, i) => {
        const miktar = yuvarla(sayi(g.miktar), 4);
        const kdvDahilFiyat = yuvarla(sayi(g.kdvDahilFiyat), 4);
        const kdvOrani = sayi(g.kdvOrani);
        const iskontoTuru = (Number(g.iskontoTuru) === 1 || Number(g.iskontoTuru) === 2 ? Number(g.iskontoTuru) : 0);
        const iskontoDegeri = iskontoTuru ? sayi(g.iskontoDegeri) : 0;
        if (!(miktar > 0))
            throw new Error(`${i + 1}. satırda miktar sıfırdan büyük olmalı.`);
        if (kdvDahilFiyat < 0)
            throw new Error(`${i + 1}. satırda fiyat eksi olamaz.`);
        if (kdvOrani < 0 || kdvOrani > 100)
            throw new Error(`${i + 1}. satırda KDV oranı geçersiz.`);
        if (iskontoTuru === 1 && (iskontoDegeri < 0 || iskontoDegeri > 100))
            throw new Error(`${i + 1}. satırda iskonto yüzdesi 0 ile 100 arasında olmalı.`);
        if (iskontoTuru === 2 && iskontoDegeri < 0)
            throw new Error(`${i + 1}. satırda iskonto tutarı eksi olamaz.`);
        const brutDahil = yuvarla2(miktar * kdvDahilFiyat);
        const satirIskontoDahil = satirIskontosu(brutDahil, iskontoTuru, iskontoDegeri);
        return { miktar, kdvDahilFiyat, kdvOrani, iskontoTuru, iskontoDegeri, brutDahil, satirIskontoDahil, net1: yuvarla2(brutDahil - satirIskontoDahil) };
    });
    const net1Toplam = yuvarla2(ara.reduce((a, s) => a + s.net1, 0));
    const bTur = (Number(baslik?.turu) === 1 || Number(baslik?.turu) === 2 ? Number(baslik?.turu) : 0);
    const bDeger = sayi(baslik?.deger);
    if (bTur === 1 && (bDeger < 0 || bDeger > 100))
        throw new Error("Fiş iskontosu yüzdesi 0 ile 100 arasında olmalı.");
    if (bTur === 2 && bDeger < 0)
        throw new Error("Fiş iskontosu eksi olamaz.");
    const baslikIskontoDahil = satirIskontosu(net1Toplam, bTur, bDeger);
    const paylar = oranlaDagit(ara.map((s) => s.net1), baslikIskontoDahil);
    const satirlar = ara.map((s, i) => {
        const netDahil = yuvarla2(s.net1 - paylar[i]);
        const c = satirCoz(s.miktar, s.kdvDahilFiyat, s.kdvOrani, netDahil);
        return {
            miktar: s.miktar,
            kdvDahilFiyat: s.kdvDahilFiyat,
            kdvOrani: s.kdvOrani,
            iskontoTuru: s.iskontoTuru,
            iskontoDegeri: s.iskontoDegeri,
            brutDahil: s.brutDahil,
            satirIskontoDahil: s.satirIskontoDahil,
            baslikPayiDahil: paylar[i],
            netDahil,
            ...c,
        };
    });
    const topla = (f) => yuvarla2(satirlar.reduce((a, s) => a + f(s), 0));
    return {
        satirlar,
        baslikIskontoDahil,
        brutDahil: topla((s) => s.brutDahil),
        toplamIskontoDahil: topla((s) => s.satirIskontoDahil + s.baslikPayiDahil),
        araToplam: topla((s) => s.tutar),
        toplamIskonto: topla((s) => s.iskontoTutari),
        matrah: topla((s) => s.matrah),
        toplamKdv: topla((s) => s.kdvTutari),
        genelToplam: topla((s) => s.toplamTutar),
    };
}
/** Kart fiyatı → KDV dahil satış fiyatı (kart KDV hariçse oran eklenir) */
export const kartDahilFiyat = (satisFiyati, kdvOrani, fiyatKdvDahil) => {
    const f = sayi(satisFiyati);
    return fiyatKdvDahil ? f : yuvarla(f * (1 + sayi(kdvOrani) / 100), 4);
};
/** Stok giriş satırı: KDV hariç alış fiyatı */
export const girisSatirHesapla = (miktar, birimFiyat, kdvOrani) => {
    const tutar = yuvarla2(sayi(miktar) * sayi(birimFiyat));
    const kdvTutari = yuvarla2((tutar * sayi(kdvOrani)) / 100);
    return { tutar, kdvTutari, toplamTutar: yuvarla2(tutar + kdvTutari) };
};
/** Birim adı → e-Belge (UN/ECE) kodu */
export const BIRIMLER = [
    { ad: "Adet", kod: "C62" },
    { ad: "Kg", kod: "KGM" },
    { ad: "Gr", kod: "GRM" },
    { ad: "Lt", kod: "LTR" },
    { ad: "Metre", kod: "MTR" },
    { ad: "Paket", kod: "PA" },
    { ad: "Kutu", kod: "BX" },
];
export const birimAdiDuzelt = (v) => {
    const t = String(v ?? "").trim().toLocaleLowerCase("tr-TR");
    if (!t)
        return null;
    const esler = {
        adet: "Adet", ad: "Adet", adt: "Adet", c62: "Adet",
        kg: "Kg", kilo: "Kg", kilogram: "Kg", kgm: "Kg",
        gr: "Gr", g: "Gr", gram: "Gr", grm: "Gr",
        lt: "Lt", l: "Lt", litre: "Lt", ltr: "Lt",
        metre: "Metre", m: "Metre", mt: "Metre", mtr: "Metre",
        paket: "Paket", pk: "Paket", pa: "Paket",
        kutu: "Kutu", kt: "Kutu", bx: "Kutu",
    };
    return esler[t] ?? null;
};
export const birimKoduTicari = (birim) => {
    const ad = birimAdiDuzelt(birim);
    return BIRIMLER.find((b) => b.ad === ad)?.kod ?? "C62";
};
