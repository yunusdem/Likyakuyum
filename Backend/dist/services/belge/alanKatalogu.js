import { dovizFisVerisi, firmaKimlikOku, perakendeFisVerisi, sarrafFisVerisi, ticariFisVerisi } from "./fisCiktiVeri.js";
import { fisBelgeVerisi } from "./belgeVeri.js";
/**
 * Şablonda kullanılabilecek `{{alan}}` adları — her belge türü için örnek veriden türetilir (veri yordamıyla
 * birebir; elle liste tutulmaz). Denetim (yüklenen şablon) ve kılavuz (alan tablosu) bunu kullanır.
 */
export const ORNEK_FIRMA = firmaKimlikOku({
    FIRMA_ADI: "ÖRNEK KUYUMCULUK VE DÖVİZ A.Ş.", SUBE_ADI: "Merkez", ADRES: "ATATÜRK CAD. NO: 1", ILCE_ADI: "MERKEZ", IL_ADI: "MUĞLA",
    TELEFON: "0252 000 00 00", WEB_ADRESI: "www.ornek.com.tr", EPOSTA: "info@ornek.com.tr", VERGI_DAIRESI_ADI: "MERKEZ", VERGI_KIMLIK_NO: "1234567890",
    MERSIS_NO: "0123456789000010", TICARET_SICIL_NO: "1234", SUBE_KODU: "1", DOSYA_NO: "284", SATISIN_DAYANAGI: "32 SAYILI KARAR GEREĞİ",
});
/** Belge türü için örnek veri (önizleme, kılavuz ve alan kataloğu). Firma verilirse onunla. */
export function ornekVeri(tur, firma = ORNEK_FIRMA, satim = true) {
    if (tur === "DOVIZ_FIS") {
        return dovizFisVerisi({
            fisId: 1, tip: satim ? 1 : 0, tarih: "2026-10-12", saat: "14:30", belgeNo: satim ? "DIS2026000000001" : "DIA2026000000001",
            unvan: "AHMET YILMAZ", vergiKimlikNo: "11111111111", detayIl: "Muğla", detayIlce: "Fethiye", detayUyruk: "TR", vezneKod: "01", istatistikKodu: "9249",
            detayMeslek: "SERBEST", detayPasaportNo: "", guid: "FD5AA22A-A68D-4B2E-87CF-E958E380439F",
            lines: [{ paraKodu: "EUR", miktar: 1000, kur: 48.1234, tutar: 48123.4 }], komisyonTutari: 0, giseUsdKuru: 41.5,
        }, firma);
    }
    if (tur.startsWith("EDOVIZ_PDF_")) {
        // PDF verisi e-Döviz görünüm satırından kurulur (belgeVeri.ts); firma bilgisi satırın Supplier kolonlarına yazılır
        const satis = tur.includes("SATIS");
        return fisBelgeVerisi({
            BELGE_ID: 1, FIS_TIPI: satis ? 1 : 0, BELGE_NO: satis ? "DIS2026000000001" : "DIA2026000000001", ETTN: "FD5AA22A-A68D-4B2E-87CF-E958E380439F",
            TARIH: "2026-10-12T11:30:00Z", Supplier_PartyName: firma.unvan, Supplier_StreetName: firma.adres, Supplier_CitySubdivisionName: firma.ilce,
            Supplier_CityName: firma.sehir, Supplier_Telephone: firma.telefon, Supplier_EMail: firma.eposta, Supplier_TaxSchemeName: firma.vergiDairesi,
            Supplier_PartyIdentification: firma.vkn, TICARET_SICIL_NO: firma.ticaretSicilNo,
            Customer_PartyName: "AHMET YILMAZ", Customer_StreetName: "Cumhuriyet Mah. No: 1", Customer_CitySubdivisionName: "Fethiye", Customer_CityName: "Muğla",
            Customer_PartyIdentification_ID: "11111111111", Customer_CountryName: "Türkiye", Customer_Telephone: "0532 000 00 00",
            MIKTAR: 1000, PARA_KODU: "EUR", TL_KARSILIK_KURU: 48.1234, DOLAR_KARSILIK_KURU: 1.08, LineExtensionAmount: 48123.4,
            TaxInclusiveAmount: satis ? 48219.65 : 48123.4, TaxAmount: satis ? 96.25 : 0, ISTATISTIK_NO: "9249", VEZNE_KODU: "01",
        }, satis ? "STFIS1" : "ALFIS1", { hesapVkn: firma.vkn, dosyaNo: firma.dosyaNo, onizleme: false });
    }
    if (tur === "SARRAF_FIS_80" || tur === "SARRAF_FIS_A4") {
        return sarrafFisVerisi({
            fisId: 1, tip: satim ? 1 : 0, tarih: "2026-10-12", saat: "14:30", seriNo: "S", belgeNo: "000001", unvan: "AHMET YILMAZ", vergiKimlikNo: "11111111111",
            detayTelefonNo: "0532 000 00 00", detayAdres: "Cumhuriyet Mah. No: 1", detayIl: "Muğla", detayIlce: "Fethiye", detayPasaportNo: "U1234567",
            vezneKod: "01", kullaniciAdi: "Kasiyer",
            satirlar: [{ urunKodu: "B22", urunAdi: "22 Ayar Bilezik", miktar: 12.5, milyem: 916, hasGram: 11.45, kur: 3950, tutar: 45230.5, aciklama: "Burgu model" }],
            odemeSatirlari: [{ paraKodu: "TL", miktar: 45230.5, tutar: 45230.5 }],
            toplamTutar: 45230.5, toplamHas: 11.45, odenenTutar: 45000, kalanTutar: 230.5,
        }, firma);
    }
    if (tur === "TICARI_FIS_80" || tur === "TICARI_FIS_A4") {
        return ticariFisVerisi({
            faturaId: 1, faturaNo: "EAR2026000000001", ettn: "0F3C2B1A-9D8E-4C7B-A6F5-E4D3C2B1A098", tarih: "2026-10-12T11:30:00Z", senaryo: "EARSIVFATURA", vezneKod: "01",
            aliciVknTckn: "11111111111", aliciUnvan: "AHMET YILMAZ", adres: "Cumhuriyet Mah. No: 1", ilce: "Fethiye", il: "Muğla", vergiDairesi: "Fethiye", telefon: "0532 000 00 00", eposta: "ahmet@ornek.com",
            iskontoTuru: 2, iskontoDegeri: 5,
            satirlar: [
                { satirNo: 1, kod: "KLM001", barkod: "8690000000011", urunAdi: "Tükenmez Kalem Mavi", miktar: 3, birim: "Adet", kdvDahilFiyat: 25, kdvOrani: 20, iskontoTuru: 1, iskontoDegeri: 10 },
                { satirNo: 2, kod: "DFT004", barkod: "8690000000035", urunAdi: "Defter A4 Kareli", miktar: 2, birim: "Adet", kdvDahilFiyat: 45, kdvOrani: 10 },
            ],
            odemeler: [{ odemeAraciTuru: 0, paraKodu: "TL", tutar: 100 }, { odemeAraciTuru: 2, paraKodu: "TL", tutar: 52.5 }],
        }, firma);
    }
    return perakendeFisVerisi({
        faturaId: 1, faturaNo: "PRK2026000000001", ettn: "0F3C2B1A-9D8E-4C7B-A6F5-E4D3C2B1A098", tarih: "2026-10-12T11:30:00Z", faturaTipi: 1, senaryo: "EARSIVFATURA",
        aliciVknTckn: "11111111111", aliciUnvan: "AHMET YILMAZ", adres: "Cumhuriyet Mah. No: 1", ilce: "Fethiye", il: "Muğla", vergiDairesi: "Fethiye", telefon: "0532 000 00 00", eposta: "ahmet@ornek.com",
        paraKodu: "TL", araToplam: 15000, toplamKdv: 3000, iskontoOrani: 5, iskontoTutari: 900, genelToplam: 17100,
        satirlar: [{ satirNo: 1, barkod: "8690000000011", urunAdi: "14 Ayar Kolye", ayar: "14K", miktar: 1, birim: "ADET", gram: 7.25, hasGram: 4.235, birimFiyat: 15000, kdvOrani: 20, kdvTutari: 3000, toplamTutar: 18000 }],
    }, firma);
}
function yaprakYollar(v, onek, alanlar, listeler) {
    for (const [k, d] of Object.entries(v ?? {})) {
        const yol = onek ? `${onek}.${k}` : k;
        if (Array.isArray(d)) {
            const ic = [];
            for (const kayit of d.slice(0, 1))
                yaprakYollar(kayit, "s", ic, {});
            listeler[yol] = ic;
        }
        else if (d && typeof d === "object")
            yaprakYollar(d, yol, alanlar, listeler);
        else
            alanlar.push(yol);
    }
}
const onbellek = new Map();
export function alanKatalogu(tur) {
    const var_ = onbellek.get(tur);
    if (var_)
        return var_;
    const ornek = ornekVeri(tur);
    const alanlar = [], listeler = {};
    yaprakYollar(ornek, "", alanlar, listeler);
    const k = { alanlar, listeler, ornek };
    onbellek.set(tur, k);
    return k;
}
/** Alanların açıklaması (kılavuzdaki alan tablosu ve editördeki alan listesi). Liste alanları `s.` ile. */
export const ALAN_ACIKLAMALARI = {
    "firma.unvan": "Firma ünvanı (Firma Tanımları)", "firma.adres": "Firma adresi", "firma.ilce": "Firma ilçesi", "firma.sehir": "Firma ili",
    "firma.telefon": "Firma telefonu", "firma.web": "Web adresi", "firma.eposta": "E-posta", "firma.vergiDairesi": "Vergi dairesi",
    "firma.vkn": "Vergi kimlik no", "firma.mersis": "MERSİS no", "firma.ticaretSicilNo": "Ticaret sicil no", "firma.subeKodu": "Şube kodu",
    "firma.subeAdi": "Şube adı", "firma.dosyaNo": "Yetkili müessese dosya no", "firma.satisDayanagi": "Satışın dayanağı (Firma Tanımları)",
    "firma.vdVkn": "\"Vergi dairesi / VKN\" birleşik", "firma.mersisSicil": "\"MERSİS / Sicil no\" birleşik", "firma.kimlikEtiketi": "VKN ya da TCKN etiketi",
    "basamak.doviz": "Döviz kuruş hanesi (firma ayarı)", "basamak.kur": "Kur kuruş hanesi", "basamak.tl": "TL kuruş hanesi",
    "firma.basamak.doviz": "Döviz kuruş hanesi (firma ayarı)", "firma.basamak.kur": "Kur kuruş hanesi (firma ayarı)", "firma.basamak.tl": "TL kuruş hanesi (firma ayarı)",
    "firma.adSoyad": "(kullanılmaz)", "firma.ulke": "Firmanın ülkesi", "firma.kimlikNo": "Firma VKN", "firma.pasaportNo": "(kullanılmaz)", "firma.musteriTuru": "(kullanılmaz)",
    subeKodu: "Şube kodu", faturaId: "Fatura numarası (iç)",
    belgeNo: "Belge numarası", ettn: "ETTN (gönderilmiş belgede)", tarih: "Tarih", saat: "Saat", seri: "Seri (EDOVIZBELGE)",
    subeNo: "\"Şube - dosya no\"", istatistikNo: "İstatistik kodu", vezne: "Vezne kodu", tipAdi: "ALIM / SATIM ya da ALIŞ / SATIŞ",
    satim: "Satış fişinde dolu (koşulda kullanılır: {{satim}} / !{{satim}})", fisTipi: "0 alış, 1 satış", qr: "Karekod içeriği",
    erisimAdresi: "e-Döviz erişim adresi (ETTN varsa)", onizleme: "Önizlemede dolu (filigran koşulu)", iptal: "İptal fişte dolu",
    geldigiUlke: "Geldiği ülke", satisDayanagi: "Satışın dayanağı", fisId: "Fiş numarası (iç)", belgeTuru: "Belge türü kodu",
    "musteri.unvan": "Müşteri ünvanı / adı", "musteri.kimlikNo": "TCKN / VKN", "musteri.uyruk": "Uyruk", "musteri.ilceSehir": "\"İLÇE/İL\"",
    "musteri.pasaportNo": "Pasaport no", "musteri.musteriTuru": "GERCEKKISI / TUZELKISI", "musteri.meslek": "Meslek", "musteri.vergiDairesi": "Vergi dairesi",
    "musteri.ulkeKodu": "Ülke kodu", "musteri.telefon": "Telefon", "musteri.adres": "Adres", "musteri.eposta": "E-posta", "musteri.il": "İl",
    "musteri.ilce": "İlçe", "musteri.ilceIl": "\"İlçe / İl\"", "musteri.adSoyad": "Ad soyad (ünvandan farklıysa)", "musteri.ulke": "Ülke",
    "musteri.sehir": "İl", "musteri.kimlikEtiketi": "VKN ya da TCKN etiketi", "musteri.vkn": "VKN / TCKN", "musteri.ticaretSicilNo": "Ticaret sicil no",
    "toplam.genel": "Genel toplam", "toplam.tl": "TL karşılığı toplamı", "toplam.bsmv": "BSMV", "toplam.bsmvVar": "BSMV varsa dolu (koşul)",
    "toplam.komisyon": "Komisyon", "toplam.yaziyla": "Toplamın yazıyla hâli", "toplam.tutar": "Genel toplam", "toplam.has": "Toplam has gram",
    "toplam.hasVar": "Has gram varsa dolu", "toplam.odenen": "Ödenen / alınan", "toplam.odenenVar": "Ödeme varsa dolu", "toplam.kalan": "Kalan bakiye",
    "toplam.kalanVar": "Kalan varsa dolu", "toplam.ara": "Mal hizmet toplamı", "toplam.kdv": "Hesaplanan KDV", "toplam.iskonto": "İskonto tutarı",
    "toplam.iskontoVar": "İskonto varsa dolu", "toplam.iskontoOrani": "İskonto oranı (%)", "toplam.iskontoEtiket": "\"İskonto (%5)\"", "toplam.gram": "Toplam gram",
    baslik: "Fiş başlığı (ör. SARRAF SATIŞ FİŞİ)", fisNo: "Fiş no (seri-no)", kasiyer: "Fişi kesen kullanıcı", odemeVar: "Ödeme satırı varsa dolu",
    faturaNo: "Fatura no", senaryo: "Senaryo (EARSIVFATURA …)", iade: "İade faturasında dolu", faturaTipiAdi: "SATIS / İADE", paraKodu: "Para birimi",
    "tutar.miktar": "Döviz / maden miktarı", "tutar.kod": "Döviz / maden cinsi", "tutar.kur": "Uygulanan kur", "tutar.usdKarsiligi": "ABD doları karşılığı",
    "tutar.usdKuru": "ABD doları kuru", "tutar.tl": "TL karşılığı", "tutar.bsmv": "BSMV", "tutar.net": "Net tutar", "tutar.yaziyla": "Net tutarın yazıyla hâli",
    islemEtiketi: "SATILAN / SATIN ALINAN", urunEtiketi: "\"Satılan Ürün\" / \"Satın Alınan Ürün\"", dosyaNo: "Yetkili müessese dosya no",
    qrBuyuk: "Büyük karekod içeriği", qrKucuk: "Erişim karekodu içeriği", hesapVkn: "ICE hesap VKN", kod: "Şablon kodu",
    sira: "Listede satır sırası (1, 2, …)",
    "s.kod": "Para / ürün kodu", "s.ad": "Ürün / para adı", "s.miktar": "Miktar", "s.kur": "Kur / birim fiyat", "s.tl": "TL karşılığı", "s.usd": "ABD doları karşılığı",
    "s.usdVar": "USD karşılığı varsa dolu", "s.sira": "Satır no", "s.aciklama": "Açıklama", "s.adet": "Adet", "s.milyem": "Milyem", "s.has": "Has gram",
    "s.tutar": "Tutar", "s.hasVar": "Has gram varsa dolu", "s.miktarYazi": "\"12,50 gr\" / \"2 ad\"", "s.ayarKur": "Milyem ya da kur", "s.adetYazi": "Adet (yoksa -)",
    "s.miktarGr": "Gram (yoksa -)", "s.milyemYazi": "Milyem (yoksa -)", "s.hasYazi": "Has gram (yoksa -)", "s.kurYazi": "Birim fiyat (yoksa -)",
    "s.barkod": "Barkod", "s.ayar": "Ayar", "s.birim": "Birim", "s.gram": "Gram", "s.birimFiyat": "Birim fiyat", "s.kdvOrani": "KDV oranı", "s.kdvTutari": "KDV tutarı",
    "s.toplam": "Satır toplamı", "s.barkodAyar": "\"barkod | ayar\"", "s.gramYazi": "\"7,25g\"",
    // Ticari satış fişi (docs/TICARI_ISLEMLER_YOL_HARITASI.md, T17)
    kdvDokumu: "KDV oranlarına göre döküm (liste)", "s.oran": "KDV oranı", "s.matrah": "KDV hariç tutar (iskontolar düşülmüş)", "s.kdv": "KDV tutarı",
    "s.kdvDahilFiyat": "KDV dahil birim fiyat", "s.brut": "Miktar × fiyat (KDV dahil)", "s.iskontoYazi": "Satır iskontosu (\"%10\" / \"5,00 TL\")",
    "s.iskontoVar": "Satır iskontosu varsa dolu", "s.satirIskonto": "Satır iskontosu tutarı (KDV dahil)", "s.kodBarkod": "\"kod | barkod\"",
    "s.fiyatYazi": "\"3 x 25,00\"", "s.tur": "Ödeme türü (Nakit, Kredi kartı …)",
    "toplam.kalem": "Kalem sayısı", "toplam.miktar": "Toplam miktar", "toplam.brut": "Brüt toplam (KDV dahil, iskontosuz)", "toplam.satirIskonto": "Satır iskontoları toplamı",
    "toplam.fisIskonto": "Fiş iskontosu", "toplam.fisIskontoVar": "Fiş iskontosu varsa dolu", "toplam.paraUstu": "Para üstü", "toplam.paraUstuVar": "Para üstü varsa dolu",
};
