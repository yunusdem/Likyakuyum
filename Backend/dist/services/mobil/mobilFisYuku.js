import { adetliMi, dovizOranlari, dovizSatir, sepetHesapla, yuvarla2, yuvarla4 } from "../hizliSatis/hizliSatisHesap.js";
import { ticariFisHesapla } from "../ticari/ticariHesap.js";
export const ODEME_SEKLI_ADLARI = { NAKIT: "Nakit (mobil vezne)", CARI: "Cari hesap", HAVALE: "Havale / EFT", POS: "POS (kart)" };
/**
 * Emirden kesilen döviz fişinin GUID'i — emir numarasından sabit ("MOBILEMR" + emir no): yarım kalan kayıt yeniden denenince
 * döviz kayıt yordamı aynı GUID'li fişi günceller, ikinci fiş açmaz; emre bağlanamamış fiş de birebir bulunur.
 */
export const mobilEmirGuid = (emirId) => `4d4f4249-4c45-4d52-8000-${Math.trunc(emirId).toString(16).padStart(12, "0")}`;
export const fisTuruBul = (urunler) => {
    const doviz = urunler.map((u) => Number(u.urunTipi) === 0 || u.urunTipi === null);
    return doviz.every(Boolean) ? "DOVIZ" : doviz.some(Boolean) ? "KARISIK" : "SARRAF";
};
/** Sarraf satırında has katsayısı */
export const hasKatsayisi = (u, tip) => {
    const sec = (...d) => d.map((x) => Number(x) || 0).find((x) => x > 0) ?? 0;
    const k = tip === 1 ? sec(u.hasSatisKatsayisi, u.hasOrani) : sec(u.hasAlisKatsayisi, u.hasOrani);
    const oran = k > 1 ? (k <= 100 ? k / 100 : k / 1000) : k;
    return oran > 0 ? Math.round(oran * 1e6) / 1e6 : 1;
};
const anonimDegil = (c) => ({
    unvan: c.ad,
    kisilikTipi: c.kisilikTipi ?? 1,
    vergiKimlikNo: c.vergiKimlikNo || null,
    adres: c.adres || null,
    telefonNo: c.telefon || null,
    eposta: c.eposta || null,
});
export function sarrafFisYuku(e, urunler, c, o, odeme) {
    const tip = e.yon === "AL" ? 1 : 0;
    const harita = new Map(urunler.map((u) => [u.urunId, u]));
    const satirlar = e.satirlar.map((s, i) => {
        const u = harita.get(s.urunId);
        const adetli = adetliMi(u.urunTipi);
        const oran = adetli ? 0 : hasKatsayisi(u, tip);
        const hasGram = adetli ? 0 : yuvarla4(s.miktar * oran);
        return {
            satirNo: i + 1,
            urunId: s.urunId,
            miktar: s.miktar,
            milyem: adetli ? 0 : Math.round(oran * 1000),
            hasGram,
            adet: adetli ? s.miktar : 0,
            iscilikiMiktari: 0,
            iscilikHasGram: 0,
            iscilikHesaplamaSekli: 0,
            aciklama: `Mobil emir #${e.emirId}`,
            kur: adetli ? s.birimFiyat : hasGram > 0 ? yuvarla4(s.tutar / hasGram) : s.birimFiyat,
            tutar: yuvarla2(s.tutar),
            urunTipi: Number(u.urunTipi) || 0,
            karat: null,
        };
    });
    const toplam = yuvarla2(satirlar.reduce((a, s) => a + s.tutar, 0));
    const hasToplam = yuvarla4(satirlar.reduce((a, s) => a + s.hasGram, 0));
    const tlOrtak = { satirNo: 1, adet: toplam, miktar: toplam, milyem: 0, hasGram: 0, kur: 1, tutar: toplam, paraKodu: "TL" };
    let odemeSatiri;
    if (odeme.sekil === "CARI") {
        // Hızlı Satış H10: cari ödemesi has olarak cariye; satırların hepsi gramsa has toplamı birebir, değilse tutar ÷ has kuru
        if (!(o.hasKuru > 0))
            throw new Error("Has altın kuru yok; cari ödemesi has olarak yazılamaz.");
        const tamHas = satirlar.every((s) => s.adet === 0);
        const hasGram = tamHas ? hasToplam : yuvarla4(toplam / o.hasKuru);
        odemeSatiri = {
            satirNo: 1, islemeYeri: 1, odemeAraciTuru: 1, cariKartId: c.cariKartId, cariKod: c.kod, cariUnvan: c.ad,
            paraId: o.has?.paraId ?? null, paraKodu: "HAS", paraAdi: o.has?.ad ?? "HAS ALTIN",
            adet: 0, miktar: hasGram, milyem: 0, hasGram, kur: o.hasKuru, tutar: tamHas ? yuvarla2(hasGram * o.hasKuru) : toplam,
        };
    }
    else if (odeme.sekil === "HAVALE") {
        if (!odeme.bankaId)
            throw new Error("Banka hesabı seçilmedi.");
        odemeSatiri = { ...tlOrtak, islemeYeri: 2, odemeAraciTuru: 3, bankaId: odeme.bankaId, cariKartId: null, cariKod: null, paraAdi: odeme.bankaAdi || "BANKA" };
    }
    else if (odeme.sekil === "POS") {
        if (tip === 0)
            throw new Error("Alışta POS ile ödeme yapılamaz.");
        if (!odeme.posCihaziId)
            throw new Error("POS cihazı seçilmedi.");
        odemeSatiri = { ...tlOrtak, islemeYeri: 3, odemeAraciTuru: 2, posCihaziId: odeme.posCihaziId, bankaId: odeme.posCihaziId, cariKartId: null, cariKod: null, paraAdi: odeme.posAdi || "POS" };
    }
    else {
        odemeSatiri = { ...tlOrtak, islemeYeri: 0, odemeAraciTuru: 0, paraId: o.tl?.paraId ?? null, paraAdi: o.tl?.ad ?? "TÜRK LİRASI" };
    }
    return {
        sarrafFisiId: null,
        vezneId: o.vezneId,
        cariKartId: c.cariKartId,
        tarih: o.tarih,
        saat: `${o.tarih}T${o.saat}:00`,
        fisNo: null,
        seriNo: null,
        belgeNo: null,
        irsaliyeNo: null,
        tip,
        altinHasKuru: o.hasKuru,
        gumusHasKuru: 0,
        alisKuru: 0,
        satisKuru: 0,
        kdvOrani: null,
        kdv: 0,
        istatistikId: null,
        istatistikKodu: null,
        ...anonimDegil(c),
        vergiDairesiId: c.vergiDairesiId,
        ilId: c.ilId,
        ilceId: c.ilceId,
        hukukiYapiId: c.hukukiYapiId,
        belgeTuru: c.eFaturaPosta ? 1 : 0,
        eFaturaPosta: c.eFaturaPosta || null,
        masakListesindeVar: false,
        yazdirilanBelgeTipi: 0,
        kullaniciId: o.kullaniciId,
        satirlar,
        odemeSatirlari: [odemeSatiri],
        _ozet: { toplam, odenecek: toplam, masraf: 0, hasToplam },
    };
}
export function dovizFisYuku(e, urunler, c, o, odeme) {
    const tip = e.yon === "AL" ? 1 : 0;
    if (!o.istatistik)
        throw new Error(`${tip === 1 ? "Satış" : "Alış"} için istatistik tanımı bulunamadı (Ayarlar › İstatistik Tanımları / Firma Tanımları).`);
    if (odeme.sekil === "POS")
        throw new Error("Döviz fişinde POS ödemesi kullanılamaz.");
    if (odeme.sekil === "HAVALE" && !odeme.bankaId)
        throw new Error("Banka hesabı seçilmedi.");
    const oranlar = dovizOranlari(o.istatistik, tip, o.kmvSekli);
    const harita = new Map(urunler.map((u) => [u.urunId, u]));
    const sepet = e.satirlar.map((s) => ({
        anahtar: String(s.urunId),
        ad: harita.get(s.urunId)?.ad || "",
        tur: "para",
        urunId: s.urunId,
        urunTipi: 0,
        miktar: s.miktar,
        birim: "",
        birimFiyat: s.birimFiyat,
        kdvOrani: 0,
        ek: { bmvOrani: oranlar.bmvOrani, kmvOrani: oranlar.kmvOrani, komisyonOrani: oranlar.komisyonOrani },
    }));
    const toplam = sepetHesapla("doviz", sepet, { tip, kmvSekli: o.kmvSekli });
    const satirlar = sepet.map((s, i) => {
        const h = dovizSatir(s, tip, o.kmvSekli);
        const u = harita.get(s.urunId);
        return {
            satirNo: i,
            paraId: s.urunId,
            paraKodu: u.kod,
            paraAdi: u.ad,
            miktar: s.miktar,
            kur: s.birimFiyat,
            iscilik: 0,
            giseKuru: s.birimFiyat,
            tutar: h.tutar,
            komisyonOrani: oranlar.komisyonOrani,
            komisyon: h.komisyon,
            bmvOrani: tip === 0 ? 0 : oranlar.bmvOrani,
            bmv: h.bmv,
            kmvOrani: tip === 0 ? 0 : oranlar.kmvOrani,
            kmv: h.kmv,
            kdvOrani: 0,
            kdv: 0,
        };
    });
    // Döviz fişinde ödeme başlıktadır: banka hesabı = bir cari kart (bankanın ya da carinin kendisi). Cari hesap → carinin kendi
    // kartı (TL tutar cariye yazılır: satışta borç, alışta alacak — Cari Ekstre ile aynı kural); nakit → vezne.
    const bankaHesabiId = odeme.sekil === "CARI" ? c.cariKartId : odeme.sekil === "HAVALE" ? odeme.bankaId ?? null : null;
    return {
        vezneId: o.vezneId,
        tip,
        tarih: o.tarih,
        zaman: o.saat,
        kurTuru: 0,
        istatistikId: o.istatistik.id,
        istatistikKodu: o.istatistik.kod,
        cariKartId: c.cariKartId,
        ...anonimDegil(c),
        vergiKimlikNo: c.vergiKimlikNo || undefined,
        hukukiYapiId: (c.kisilikTipi ?? 1) === 1 ? c.hukukiYapiId ?? 1 : null,
        toplamTutar: toplam.araToplam,
        yuvarlama: 0,
        odemeTutari: toplam.genelToplam,
        bankaHesabiId,
        kmvUygulamaSekli: o.kmvSekli,
        guid: mobilEmirGuid(e.emirId),
        masakListesindeVar: false,
        kullaniciId: o.kullaniciId,
        satirlar,
        _ozet: { toplam: toplam.araToplam, odenecek: toplam.genelToplam, masraf: toplam.masraf, hasToplam: 0 },
    };
}
export function ticariFisYuku(e, kartlar, c, o, odeme) {
    const harita = new Map(kartlar.map((k) => [k.stokKartId, k]));
    const eksik = e.satirlar.find((s) => !harita.has(s.urunId));
    if (eksik)
        throw new Error("Siparişteki bir stok kartı bulunamadı.");
    const satirlar = e.satirlar.map((s) => ({ stokKartId: s.urunId, miktar: s.miktar, kdvDahilFiyat: s.birimFiyat }));
    const hesap = ticariFisHesapla(satirlar.map((s) => ({ miktar: s.miktar, kdvDahilFiyat: s.kdvDahilFiyat, kdvOrani: harita.get(s.stokKartId).kdvOrani })));
    const tutar = hesap.genelToplam;
    let odemeSatiri;
    if (odeme.sekil === "CARI")
        odemeSatiri = { odemeAraciTuru: 1, cariKartId: c.cariKartId, cariKod: c.kod, cariUnvan: c.ad, paraKodu: "TL", tutar };
    else if (odeme.sekil === "POS") {
        if (!odeme.posCihaziId)
            throw new Error("POS cihazı seçilmedi.");
        odemeSatiri = { odemeAraciTuru: 2, posCihaziId: odeme.posCihaziId, cariKod: null, cariUnvan: odeme.posAdi || null, paraKodu: "TL", tutar };
    }
    else if (odeme.sekil === "HAVALE") {
        if (!odeme.bankaId)
            throw new Error("Banka hesabı seçilmedi.");
        odemeSatiri = { odemeAraciTuru: 3, cariKartId: odeme.bankaId, cariUnvan: odeme.bankaAdi || null, paraKodu: "TL", tutar };
    }
    else
        odemeSatiri = { odemeAraciTuru: 0, paraKodu: "TL", tutar };
    const efatura = !!(c.eFaturaPosta && String(c.eFaturaPosta).trim());
    // Eksi stok: sipariş miktarı stok bakiyesini aşan kartlar (personele önizlemede gösterilir)
    const stokEksigi = e.satirlar
        .map((s) => ({ k: harita.get(s.urunId), miktar: s.miktar }))
        .filter((x) => x.miktar > x.k.bakiye + 0.00001)
        .map((x) => ({ stokKartId: x.k.stokKartId, kod: x.k.kod, ad: x.k.ad, birim: x.k.birim, bakiye: x.k.bakiye, miktar: x.miktar }));
    return {
        vezneId: o.vezneId,
        // Türkiye saati (sabit +03:00): Ticari Satış Fişi ekranının gönderdiği anla aynı
        tarih: `${o.tarih}T${o.saat}:00+03:00`,
        senaryo: efatura ? "TICARIFATURA" : "EARSIVFATURA",
        cariKartId: c.cariKartId,
        aliciVknTckn: (c.vergiKimlikNo || "").replace(/\D/g, "") || null,
        aliciUnvan: c.ad,
        adres: c.adres || null,
        ilce: c.ilce || null,
        il: c.il || null,
        vergiDairesi: c.vergiDairesiAdi || null,
        eposta: efatura ? c.eFaturaPosta : c.eposta || null,
        telefon: c.telefon || null,
        satirlar,
        odemeler: [odemeSatiri],
        eksiStokOnay: true,
        _ozet: { toplam: hesap.brutDahil, odenecek: tutar, masraf: 0, hasToplam: 0, kdv: hesap.toplamKdv, matrah: hesap.matrah },
        _stokEksigi: stokEksigi,
    };
}
