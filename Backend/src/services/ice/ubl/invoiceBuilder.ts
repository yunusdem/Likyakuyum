import { randomUUID } from "crypto";
import { escapeXml } from "../ice.client.js";
import { ApiError } from "../../../utils/ApiError.js";

/**
 * UBL-TR 1.2 e-Fatura / e-Arşiv XML üreteci.
 *
 * Referans: ICE_INTAGRATION örnek istemcisi (`Forms/E-Fatura/FaturaOlustur.cs`) —
 * `CustomizationID = TR1.2.1`, `schemeID = VKN|TCKN`, KDV için `TaxTypeCode = 0015`.
 *
 * İki tasarım kuralı:
 *  1. **Tutarlar burada hesaplanır.** İstemciden gelen toplamlara güvenilmez; satırlardan
 *     yeniden hesaplanır. Aksi halde ekranda 100 TL görünen fatura GİB'e 1.000 TL gidebilir.
 *  2. **İmza üretilmez.** Mali mührü ICE atıyor (karar #11); `cac:Signature` bloğu yok.
 */

/* ==========================================================================
   Tipler
   ========================================================================== */

export type FaturaSenaryo =
  | "TEMELFATURA" | "TICARIFATURA" | "EARSIVFATURA"
  | "YATIRIMTESVIK" | "KAMU";
export type FaturaTipi =
  | "SATIS" | "IADE" | "TEVKIFAT" | "ISTISNA" | "OZELMATRAH" | "IHRACKAYITLI"
  | "TEKNOLOJIDESTEK";

export interface UblTaraf {
  /** 10 haneli VKN veya 11 haneli TCKN */
  vknTckn: string;
  unvan?: string;
  /** Gerçek kişi ise ad/soyad; tüzel kişide boş bırakılır */
  ad?: string;
  soyad?: string;
  vergiDairesi?: string;
  adres?: string;
  ilce?: string;
  il?: string;
  ulke?: string;
  telefon?: string;
  eposta?: string;
  webAdresi?: string;
}

export interface UblFaturaSatiri {
  /** Mal / hizmet adı */
  ad: string;
  aciklama?: string;
  miktar: number;
  /** UN/ECE birim kodu — adet için C62, gram için GRM, kilogram için KGM */
  birimKodu?: string;
  birimFiyat: number;
  /** Yüzde olarak iskonto oranı (0-100) */
  iskontoOrani?: number;
  /** KDV oranı, yüzde (0, 1, 8, 10, 18, 20 …) */
  kdvOrani: number;
  /**
   * KDV istisnası. `kdvOrani = 0` ile birlikte kullanılır.
   * Kod, GİB'in "KDV İstisna Kodları" listesinden gelir (ör. külçe altın teslimi).
   * Kod listesi uygulamada sabitlenmez — mali müşavir hangi kodu söylerse o yazılır.
   */
  istisnaKodu?: string;
  istisnaGerekcesi?: string;
  /**
   * KDV tevkifatı. Oran, **KDV tutarı üzerinden** uygulanır (ör. 5/10 → 50).
   * `tevkifatKodu` GİB'in tevkifat kodu listesinden gelir.
   */
  tevkifatKodu?: string;
  tevkifatOrani?: number;
}

export interface UblFaturaGirdi {
  belgeNo: string;
  /** Verilmezse üretilir */
  uuid?: string;
  /** ISO tarih (YYYY-MM-DD). Verilmezse bugün */
  tarih?: string;
  /** HH:mm:ss. Verilmezse şu an */
  saat?: string;
  senaryo: FaturaSenaryo;
  faturaTipi: FaturaTipi;
  paraBirimi?: string;
  notlar?: string[];
  gonderici: UblTaraf;
  alici: UblTaraf;
  satirlar: UblFaturaSatiri[];
  /**
   * İade faturasında, iade edilen asıl faturalar (`cac:BillingReference`).
   * `faturaTipi === "IADE"` ise en az bir kayıt zorunludur.
   */
  iadeFaturalar?: { belgeNo: string; tarih: string }[];
  /**
   * Belge TRY dışında düzenlendiğinde TL karşılığı kur (`cac:PricingExchangeRate`).
   * UBL-TR'de dövizli belgelerde kur bildirimi beklenir.
   */
  dovizKuru?: { kur: number; tarih?: string };
}

export interface UblSatirHesap {
  siraNo: number;
  matrah: number;
  iskonto: number;
  kdvTutari: number;
  kdvOrani: number;
  /** KDV tutarından kesilen tevkifat */
  tevkifatTutari: number;
}

export interface UblHesapOzeti {
  satirlar: UblSatirHesap[];
  /** İskonto düşülmüş mal/hizmet toplamı */
  malHizmetToplam: number;
  iskontoToplam: number;
  kdvToplam: number;
  vergiHaricToplam: number;
  odenecekTutar: number;
  /** Toplam tevkifat — ödenecek tutardan düşülür */
  tevkifatToplam: number;
  /** KDV oranı bazında gruplanmış matrah/vergi */
  kdvGruplari: {
    oran: number;
    matrah: number;
    vergi: number;
    istisnaKodu?: string;
    istisnaGerekcesi?: string;
  }[];
  /** Tevkifat kodu bazında gruplanmış matrah/vergi */
  tevkifatGruplari: { kod: string; oran: number; matrah: number; vergi: number }[];
}

/* ==========================================================================
   Yardımcılar
   ========================================================================== */

/** Para alanları için 2 haneli, nokta ayraçlı biçim (UBL zorunluluğu) */
const tutar = (n: number): string => (Math.round(n * 100) / 100).toFixed(2);

/** Miktar alanları daha hassas olabilir */
const miktar = (n: number): string => String(Math.round(n * 100000) / 100000);

const bugun = (): string => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
const simdi = (): string => new Date().toLocaleTimeString("en-GB", { timeZone: "Europe/Istanbul", hour12: false });

const etiket = (ad: string, deger: unknown, oznitelik = ""): string => {
  if (deger === undefined || deger === null || String(deger).trim() === "") return "";
  return `<${ad}${oznitelik}>${escapeXml(deger)}</${ad}>`;
};

/** VKN mi TCKN mi? UBL'de schemeID olarak gider. */
export const kimlikSemasi = (vknTckn: string): "VKN" | "TCKN" => (vknTckn.length === 11 ? "TCKN" : "VKN");

/* ==========================================================================
   Doğrulama ve hesaplama
   ========================================================================== */

export const dogrulaGirdi = (girdi: UblFaturaGirdi): void => {
  if (!girdi.belgeNo?.trim()) throw ApiError.badRequest("Fatura numarası zorunludur.");
  if (!/^[A-Z0-9]{3}\d{13}$/.test(girdi.belgeNo.trim())) {
    throw ApiError.badRequest(
      "Fatura numarası 3 karakter seri + 13 hane (yıl + sıra) biçiminde olmalıdır. Örnek: ABC2026000000001"
    );
  }
  if (!girdi.gonderici?.vknTckn?.trim()) throw ApiError.badRequest("Gönderici VKN/TCKN zorunludur.");
  if (!girdi.alici?.vknTckn?.trim()) throw ApiError.badRequest("Alıcı VKN/TCKN zorunludur.");
  const tarih = girdi.tarih || bugun();
  const d = new Date(tarih);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tarih) || !Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== tarih) {
    throw ApiError.badRequest("Geçerli bir düzenleme tarihi giriniz (GG.AA.YYYY).");
  }
  const belgeYili = girdi.belgeNo.trim().slice(3, 7);
  if (belgeYili !== tarih.slice(0, 4)) {
    // Sık yapılan hata: seri numarası elle yazılırken yıl bloğu atlanıyor.
    throw ApiError.badRequest(
      `Belge numarasındaki yıl (${belgeYili}) düzenleme tarihinin yılıyla (${tarih.slice(0, 4)}) uyuşmuyor. ` +
        `Fatura numarası 3 karakter seri + yıl + 9 haneli sıra olmalıdır. Örnek: ${girdi.belgeNo.trim().slice(0, 3)}${tarih.slice(0, 4)}000000001`
    );
  }
  if (!/^[A-Z]{3}$/.test((girdi.paraBirimi || "TRY").toUpperCase())) {
    throw ApiError.badRequest("Para birimi üç harfli kod olmalıdır.");
  }

  for (const [ad, taraf] of [
    ["Gönderici", girdi.gonderici],
    ["Alıcı", girdi.alici],
  ] as const) {
    const kimlik = taraf.vknTckn.trim();
    if (!/^\d{10}$|^\d{11}$/.test(kimlik)) {
      throw ApiError.badRequest(`${ad} VKN/TCKN 10 veya 11 haneli rakam olmalıdır.`);
    }
    if (kimlik.length === 11 && !(taraf.ad?.trim() && taraf.soyad?.trim())) {
      throw ApiError.badRequest(`${ad} TCKN ile tanımlandığında ad ve soyad zorunludur.`);
    }
    if (!taraf.unvan?.trim() && !(taraf.ad?.trim() && taraf.soyad?.trim())) {
      throw ApiError.badRequest(`${ad} için unvan ya da ad+soyad girilmelidir.`);
    }
    // UBL-TR AddressType'ta CitySubdivisionName (ilçe) ve CityName (il) zorunludur;
    // eksikse ICE şema doğrulaması "PostalAddress ... geçersiz Country alt öğesi" der.
    if (!taraf.ilce?.trim() || !taraf.il?.trim()) {
      throw ApiError.badRequest(
        `${ad} adresinde il ve ilçe zorunludur (UBL-TR kuralı).` +
          (ad === "Gönderici" ? " E-Belge → Bağlantı Ayarları ekranından firma il/ilçe bilgisini giriniz." : "")
      );
    }
  }

  if (!girdi.satirlar?.length) throw ApiError.badRequest("Faturada en az bir satır bulunmalıdır.");

  girdi.satirlar.forEach((satir, i) => {
    const no = i + 1;
    if (![satir.miktar, satir.birimFiyat, satir.kdvOrani, satir.iskontoOrani ?? 0].every(Number.isFinite)) {
      throw ApiError.badRequest(`${no}. satırdaki sayısal değerler sonlu olmalıdır.`);
    }
    if (!satir.ad?.trim()) throw ApiError.badRequest(`${no}. satırda mal/hizmet adı zorunludur.`);
    if (!(satir.miktar > 0)) throw ApiError.badRequest(`${no}. satırda miktar sıfırdan büyük olmalıdır.`);
    if (satir.birimFiyat < 0) throw ApiError.badRequest(`${no}. satırda birim fiyat negatif olamaz.`);
    if (satir.kdvOrani < 0 || satir.kdvOrani > 100) {
      throw ApiError.badRequest(`${no}. satırda KDV oranı 0-100 aralığında olmalıdır.`);
    }
    if (satir.iskontoOrani != null && (satir.iskontoOrani < 0 || satir.iskontoOrani >= 100)) {
      throw ApiError.badRequest(`${no}. satırda iskonto oranı 0-100 aralığında olmalıdır.`);
    }

    const istisnaKodu = satir.istisnaKodu?.trim();
    // 14.09.2026 kuralı: 555 sıfır KDV ile kullanılamaz; diğer istisnalar sıfır KDV ister.
    if (istisnaKodu === "555" && satir.kdvOrani === 0) {
      throw ApiError.badRequest(`${no}. satırda 555 vergi muafiyet kodu KDV 0 ile kullanılamaz.`);
    }
    if (istisnaKodu === "555" && (girdi.senaryo === "YATIRIMTESVIK" || girdi.senaryo === "KAMU")) {
      throw ApiError.badRequest(`${no}. satırda 555 vergi muafiyet kodu özel senaryolu faturada kullanılamaz.`);
    }
    if (istisnaKodu && istisnaKodu !== "555" && satir.kdvOrani !== 0) {
      throw ApiError.badRequest(
        `${no}. satırda KDV istisnası bildirilmiş ancak KDV oranı ${satir.kdvOrani}. İstisnalı satırda oran 0 olmalıdır.`
      );
    }
    if (satir.kdvOrani === 0 && !istisnaKodu) {
      throw ApiError.badRequest(
        `${no}. satırda KDV oranı 0 ancak istisna kodu yok. Sıfır oranlı satış için GİB istisna kodu zorunludur.`
      );
    }
    if ((istisnaKodu === "308" || istisnaKodu === "339") && girdi.senaryo !== "YATIRIMTESVIK") {
      throw ApiError.badRequest(`${no}. satırda ${istisnaKodu} kodu yalnızca YATIRIMTESVIK profilinde kullanılabilir.`);
    }

    // Tevkifat: kod ve oran birlikte verilmelidir
    const tevkifatKod = satir.tevkifatKodu?.trim();
    const tevkifatOran = satir.tevkifatOrani;
    if (Boolean(tevkifatKod) !== Boolean(tevkifatOran)) {
      throw ApiError.badRequest(`${no}. satırda tevkifat kodu ve oranı birlikte verilmelidir.`);
    }
    if (tevkifatOran != null) {
      if (!Number.isFinite(tevkifatOran) || tevkifatOran <= 0 || tevkifatOran > 100) {
        throw ApiError.badRequest(`${no}. satırda tevkifat oranı 0-100 aralığında olmalıdır.`);
      }
      if (satir.kdvOrani === 0) {
        throw ApiError.badRequest(
          `${no}. satırda KDV yokken tevkifat uygulanamaz; tevkifat KDV tutarı üzerinden hesaplanır.`
        );
      }
      if (girdi.faturaTipi !== "TEVKIFAT") {
        throw ApiError.badRequest(
          "Tevkifatlı satır bulunan faturanın tipi TEVKIFAT olmalıdır."
        );
      }
    }
  });

  // Tevkifat tipinde en az bir tevkifatlı satır aranır
  if (girdi.faturaTipi === "TEVKIFAT" && !girdi.satirlar.some((x) => x.tevkifatKodu?.trim())) {
    throw ApiError.badRequest("TEVKIFAT tipi faturada en az bir satırda tevkifat bilgisi olmalıdır.");
  }

  // İade faturasında dayanak fatura zorunlu
  if (girdi.faturaTipi === "IADE") {
    const iadeProfilleri: FaturaSenaryo[] = ["TEMELFATURA", "EARSIVFATURA", "YATIRIMTESVIK", "KAMU"];
    if (!iadeProfilleri.includes(girdi.senaryo)) {
      throw ApiError.badRequest(`IADE fatura tipi ${girdi.senaryo} profilinde kullanılamaz.`);
    }
    if (!girdi.iadeFaturalar?.length) {
      throw ApiError.badRequest("İade faturasında iade edilen fatura bilgisi zorunludur.");
    }
    girdi.iadeFaturalar.forEach((ref, i) => {
      if (!ref.belgeNo?.trim()) {
        throw ApiError.badRequest(`${i + 1}. iade referansında fatura numarası zorunludur.`);
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ref.tarih || "")) {
        throw ApiError.badRequest(`${i + 1}. iade referansının tarihi YYYY-AA-GG biçiminde olmalıdır.`);
      }
    });
  }
  if (girdi.faturaTipi === "TEKNOLOJIDESTEK" && girdi.senaryo !== "EARSIVFATURA") {
    throw ApiError.badRequest("TEKNOLOJIDESTEK fatura tipi yalnızca EARSIVFATURA profilinde kullanılabilir.");
  }
  if (girdi.faturaTipi !== "IADE" && girdi.iadeFaturalar?.length) {
    throw ApiError.badRequest("İade referansı yalnızca IADE tipi faturada kullanılabilir.");
  }

  // Dövizli belgede kur zorunlu
  const pb = (girdi.paraBirimi || "TRY").toUpperCase();
  if (pb !== "TRY") {
    const kur = girdi.dovizKuru?.kur;
    if (kur == null || !Number.isFinite(kur) || kur <= 0) {
      throw ApiError.badRequest(
        `${pb} cinsinden belgede TL karşılığı kur bilgisi zorunludur.`
      );
    }
  }

  // Özel matrah henüz desteklenmiyor — doğrulanmış örnek olmadan üretilmez
  if (girdi.faturaTipi === "OZELMATRAH") {
    throw ApiError.unprocessable(
      "Özel matrah faturası bu üreteçte henüz desteklenmiyor. Yapısı doğrulanmış bir GİB/ICE örneğiyle eklenecektir."
    );
  }
};

/**
 * Tutarları satırlardan yeniden hesaplar.
 * İstemciden gelen toplamlar **kullanılmaz**.
 */
export const hesapla = (satirlar: UblFaturaSatiri[]): UblHesapOzeti => {
  const yuvarla = (n: number) => Math.round(n * 100) / 100;

  const satirHesaplari: UblSatirHesap[] = satirlar.map((satir, i) => {
    const brut = yuvarla(satir.miktar * satir.birimFiyat);
    const iskonto = yuvarla((brut * (satir.iskontoOrani || 0)) / 100);
    const matrah = yuvarla(brut - iskonto);
    const kdvTutari = yuvarla((matrah * satir.kdvOrani) / 100);
    // Tevkifat KDV tutarı üzerinden hesaplanır, matrah üzerinden değil
    const tevkifatTutari = yuvarla((kdvTutari * (satir.tevkifatOrani || 0)) / 100);
    return { siraNo: i + 1, matrah, iskonto, kdvTutari, kdvOrani: satir.kdvOrani, tevkifatTutari };
  });

  const malHizmetToplam = yuvarla(satirHesaplari.reduce((t, s) => t + s.matrah, 0));
  const iskontoToplam = yuvarla(satirHesaplari.reduce((t, s) => t + s.iskonto, 0));
  const kdvToplam = yuvarla(satirHesaplari.reduce((t, s) => t + s.kdvTutari, 0));

  const tevkifatToplam = yuvarla(satirHesaplari.reduce((t, s) => t + s.tevkifatTutari, 0));

  // KDV grupları — istisna bilgisi oranla birlikte taşınır
  const gruplar = new Map<
    string,
    { oran: number; matrah: number; vergi: number; istisnaKodu?: string; istisnaGerekcesi?: string }
  >();
  satirHesaplari.forEach((h, i) => {
    const kaynak = satirlar[i];
    const anahtar = `${h.kdvOrani}|${kaynak.istisnaKodu || ""}`;
    const mevcut = gruplar.get(anahtar) || {
      oran: h.kdvOrani,
      matrah: 0,
      vergi: 0,
      istisnaKodu: kaynak.istisnaKodu,
      istisnaGerekcesi: kaynak.istisnaGerekcesi,
    };
    gruplar.set(anahtar, {
      ...mevcut,
      matrah: yuvarla(mevcut.matrah + h.matrah),
      vergi: yuvarla(mevcut.vergi + h.kdvTutari),
    });
  });

  // Tevkifat grupları — kod bazında
  const tevkifatMap = new Map<string, { kod: string; oran: number; matrah: number; vergi: number }>();
  satirHesaplari.forEach((h, i) => {
    const kaynak = satirlar[i];
    if (!kaynak.tevkifatKodu || !kaynak.tevkifatOrani) return;
    const anahtar = `${kaynak.tevkifatKodu}|${kaynak.tevkifatOrani}`;
    const mevcut = tevkifatMap.get(anahtar) || {
      kod: kaynak.tevkifatKodu,
      oran: kaynak.tevkifatOrani,
      matrah: 0,
      vergi: 0,
    };
    tevkifatMap.set(anahtar, {
      ...mevcut,
      // Tevkifatın matrahı KDV tutarıdır
      matrah: yuvarla(mevcut.matrah + h.kdvTutari),
      vergi: yuvarla(mevcut.vergi + h.tevkifatTutari),
    });
  });

  return {
    satirlar: satirHesaplari,
    malHizmetToplam,
    iskontoToplam,
    kdvToplam,
    vergiHaricToplam: malHizmetToplam,
    // Tevkifat KDV'den kesilir; ödenecek tutar bu kadar azalır
    odenecekTutar: yuvarla(malHizmetToplam + kdvToplam - tevkifatToplam),
    tevkifatToplam,
    kdvGruplari: [...gruplar.values()].sort((a, b) => a.oran - b.oran),
    tevkifatGruplari: [...tevkifatMap.values()].sort((a, b) => a.kod.localeCompare(b.kod)),
  };
};

/* ==========================================================================
   XML parçaları
   ========================================================================== */

const partyXml = (taraf: UblTaraf, varsayilanUlke = "Türkiye"): string => {
  const kimlik = taraf.vknTckn.trim();
  const sema = kimlikSemasi(kimlik);

  const kisiAdi = [taraf.ad?.trim(), taraf.soyad?.trim()].filter(Boolean).join(" ");
  const gosterilecekUnvan = taraf.unvan?.trim() || kisiAdi;

  return (
    `<cac:Party>` +
    etiket("cbc:WebsiteURI", taraf.webAdresi) +
    `<cac:PartyIdentification><cbc:ID schemeID="${sema}">${escapeXml(kimlik)}</cbc:ID></cac:PartyIdentification>` +
    (gosterilecekUnvan ? `<cac:PartyName><cbc:Name>${escapeXml(gosterilecekUnvan)}</cbc:Name></cac:PartyName>` : "") +
    `<cac:PostalAddress>` +
    etiket("cbc:StreetName", taraf.adres) +
    etiket("cbc:CitySubdivisionName", taraf.ilce) +
    etiket("cbc:CityName", taraf.il) +
    `<cac:Country><cbc:Name>${escapeXml(taraf.ulke || varsayilanUlke)}</cbc:Name></cac:Country>` +
    `</cac:PostalAddress>` +
    (taraf.vergiDairesi?.trim()
      ? `<cac:PartyTaxScheme><cac:TaxScheme><cbc:Name>${escapeXml(taraf.vergiDairesi)}</cbc:Name></cac:TaxScheme></cac:PartyTaxScheme>`
      : "") +
    (taraf.telefon?.trim() || taraf.eposta?.trim()
      ? `<cac:Contact>` +
        etiket("cbc:Telephone", taraf.telefon) +
        etiket("cbc:ElectronicMail", taraf.eposta) +
        `</cac:Contact>`
      : "") +
    // Gerçek kişide ad/soyad ayrıca cac:Person içinde de bildirilir
    (sema === "TCKN" && taraf.ad?.trim() && taraf.soyad?.trim()
      ? `<cac:Person><cbc:FirstName>${escapeXml(taraf.ad)}</cbc:FirstName>` +
        `<cbc:FamilyName>${escapeXml(taraf.soyad)}</cbc:FamilyName></cac:Person>`
      : "") +
    `</cac:Party>`
  );
};

/**
 * KDV alt toplamı. İstisna verilirse `cac:TaxCategory` içine
 * `TaxExemptionReasonCode` + `TaxExemptionReason` eklenir.
 *
 * Alan sırası UBL-TR `TaxCategoryType` sequence'ı ile aynıdır:
 * `Name` → `TaxExemptionReasonCode` → `TaxExemptionReason` → `TaxScheme`
 * (kaynak: ICE paketindeki `UBL/UBLTR-Invoice-2_1.cs`).
 */
const kdvTaxSubtotalXml = (
  matrahTutari: number,
  vergiTutari: number,
  oran: number,
  paraBirimi: string,
  istisna?: { kod?: string; gerekce?: string }
): string =>
  `<cac:TaxSubtotal>` +
  `<cbc:TaxableAmount currencyID="${paraBirimi}">${tutar(matrahTutari)}</cbc:TaxableAmount>` +
  `<cbc:TaxAmount currencyID="${paraBirimi}">${tutar(vergiTutari)}</cbc:TaxAmount>` +
  `<cbc:Percent>${oran}</cbc:Percent>` +
  `<cac:TaxCategory>` +
  `<cbc:Name>KDV</cbc:Name>` +
  (istisna?.kod?.trim()
    ? `<cbc:TaxExemptionReasonCode>${escapeXml(istisna.kod)}</cbc:TaxExemptionReasonCode>`
    : "") +
  (istisna?.gerekce?.trim()
    ? `<cbc:TaxExemptionReason>${escapeXml(istisna.gerekce)}</cbc:TaxExemptionReason>`
    : "") +
  `<cac:TaxScheme>` +
  `<cbc:TaxTypeCode>0015</cbc:TaxTypeCode>` +
  `</cac:TaxScheme></cac:TaxCategory>` +
  `</cac:TaxSubtotal>`;

/** Tevkifat alt toplamı — vergi kodu tevkifat listesinden gelir */
const tevkifatSubtotalXml = (
  matrahTutari: number,
  vergiTutari: number,
  oran: number,
  kod: string,
  paraBirimi: string
): string =>
  `<cac:TaxSubtotal>` +
  `<cbc:TaxableAmount currencyID="${paraBirimi}">${tutar(matrahTutari)}</cbc:TaxableAmount>` +
  `<cbc:TaxAmount currencyID="${paraBirimi}">${tutar(vergiTutari)}</cbc:TaxAmount>` +
  `<cbc:Percent>${oran}</cbc:Percent>` +
  `<cac:TaxCategory><cac:TaxScheme>` +
  `<cbc:TaxTypeCode>${escapeXml(kod)}</cbc:TaxTypeCode>` +
  `</cac:TaxScheme></cac:TaxCategory>` +
  `</cac:TaxSubtotal>`;

const invoiceLineXml = (
  satir: UblFaturaSatiri,
  hesap: UblSatirHesap,
  paraBirimi: string
): string =>
  `<cac:InvoiceLine>` +
  `<cbc:ID>${hesap.siraNo}</cbc:ID>` +
  `<cbc:InvoicedQuantity unitCode="${escapeXml(satir.birimKodu || "C62")}">${miktar(satir.miktar)}</cbc:InvoicedQuantity>` +
  `<cbc:LineExtensionAmount currencyID="${paraBirimi}">${tutar(hesap.matrah)}</cbc:LineExtensionAmount>` +
  (hesap.iskonto > 0
    ? `<cac:AllowanceCharge>` +
      `<cbc:ChargeIndicator>false</cbc:ChargeIndicator>` +
      `<cbc:MultiplierFactorNumeric>${(satir.iskontoOrani || 0) / 100}</cbc:MultiplierFactorNumeric>` +
      `<cbc:Amount currencyID="${paraBirimi}">${tutar(hesap.iskonto)}</cbc:Amount>` +
      `<cbc:BaseAmount currencyID="${paraBirimi}">${tutar(hesap.matrah + hesap.iskonto)}</cbc:BaseAmount>` +
      `</cac:AllowanceCharge>`
    : "") +
  `<cac:TaxTotal>` +
  `<cbc:TaxAmount currencyID="${paraBirimi}">${tutar(hesap.kdvTutari)}</cbc:TaxAmount>` +
  kdvTaxSubtotalXml(hesap.matrah, hesap.kdvTutari, hesap.kdvOrani, paraBirimi, {
    kod: satir.istisnaKodu,
    gerekce: satir.istisnaGerekcesi,
  }) +
  `</cac:TaxTotal>` +
  (hesap.tevkifatTutari > 0 && satir.tevkifatKodu
    ? `<cac:WithholdingTaxTotal>` +
      `<cbc:TaxAmount currencyID="${paraBirimi}">${tutar(hesap.tevkifatTutari)}</cbc:TaxAmount>` +
      tevkifatSubtotalXml(
        hesap.kdvTutari,
        hesap.tevkifatTutari,
        satir.tevkifatOrani || 0,
        satir.tevkifatKodu,
        paraBirimi
      ) +
      `</cac:WithholdingTaxTotal>`
    : "") +
  `<cac:Item>` +
  etiket("cbc:Description", satir.aciklama) +
  `<cbc:Name>${escapeXml(satir.ad)}</cbc:Name>` +
  `</cac:Item>` +
  `<cac:Price><cbc:PriceAmount currencyID="${paraBirimi}">${tutar(satir.birimFiyat)}</cbc:PriceAmount></cac:Price>` +
  `</cac:InvoiceLine>`;

/* ==========================================================================
   Ana üreteç
   ========================================================================== */

export interface UblUretimSonucu {
  xml: string;
  uuid: string;
  ozet: UblHesapOzeti;
}

export const buildInvoiceXml = (girdi: UblFaturaGirdi): UblUretimSonucu => {
  dogrulaGirdi(girdi);

  const ozet = hesapla(girdi.satirlar);
  const uuid = girdi.uuid?.trim() || randomUUID();
  const paraBirimi = (girdi.paraBirimi || "TRY").toUpperCase();
  const tarih = girdi.tarih?.trim() || bugun();
  const saat = girdi.saat?.trim() || simdi();

  const notlarXml = (girdi.notlar || [])
    .filter((n) => n && n.trim())
    .map((n) => `<cbc:Note>${escapeXml(n)}</cbc:Note>`)
    .join("");

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"` +
    ` xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"` +
    ` xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">` +
    // ICE serileştiricisi imza icin ext:UBLExtensions ekliyor; onek burada bildirilmezse
    // "prefix ext is not bound" hatasi aliniyor. UBL-TR-de bu eleman ilk cocuk olmali.
    `<ext:UBLExtensions><ext:UBLExtension><ext:ExtensionContent/></ext:UBLExtension></ext:UBLExtensions>` +
    `<cbc:UBLVersionID>2.1</cbc:UBLVersionID>` +
    `<cbc:CustomizationID>TR1.2</cbc:CustomizationID>` +
    `<cbc:ProfileID>${escapeXml(girdi.senaryo)}</cbc:ProfileID>` +
    `<cbc:ID>${escapeXml(girdi.belgeNo.trim())}</cbc:ID>` +
    `<cbc:CopyIndicator>false</cbc:CopyIndicator>` +
    `<cbc:UUID>${escapeXml(uuid)}</cbc:UUID>` +
    `<cbc:IssueDate>${escapeXml(tarih)}</cbc:IssueDate>` +
    `<cbc:IssueTime>${escapeXml(saat)}</cbc:IssueTime>` +
    `<cbc:InvoiceTypeCode>${escapeXml(girdi.faturaTipi)}</cbc:InvoiceTypeCode>` +
    notlarXml +
    `<cbc:DocumentCurrencyCode>${escapeXml(paraBirimi)}</cbc:DocumentCurrencyCode>` +
    `<cbc:LineCountNumeric>${girdi.satirlar.length}</cbc:LineCountNumeric>` +
    // UBL-TR sequence: LineCountNumeric → InvoicePeriod → OrderReference → BillingReference
    (girdi.iadeFaturalar || [])
      .map(
        (ref) =>
          `<cac:BillingReference><cac:InvoiceDocumentReference>` +
          `<cbc:ID>${escapeXml(ref.belgeNo.trim())}</cbc:ID>` +
          `<cbc:IssueDate>${escapeXml(ref.tarih)}</cbc:IssueDate>` +
          `</cac:InvoiceDocumentReference></cac:BillingReference>`
      )
      .join("") +
    `<cac:AccountingSupplierParty>${partyXml(girdi.gonderici)}</cac:AccountingSupplierParty>` +
    `<cac:AccountingCustomerParty>${partyXml(girdi.alici)}</cac:AccountingCustomerParty>` +
    // UBL-TR sequence: AllowanceCharge → TaxExchangeRate → PricingExchangeRate → TaxTotal
    (paraBirimi !== "TRY" && girdi.dovizKuru
      ? `<cac:PricingExchangeRate>` +
        `<cbc:SourceCurrencyCode>${escapeXml(paraBirimi)}</cbc:SourceCurrencyCode>` +
        `<cbc:TargetCurrencyCode>TRY</cbc:TargetCurrencyCode>` +
        `<cbc:CalculationRate>${girdi.dovizKuru.kur}</cbc:CalculationRate>` +
        (girdi.dovizKuru.tarih ? `<cbc:Date>${escapeXml(girdi.dovizKuru.tarih)}</cbc:Date>` : "") +
        `</cac:PricingExchangeRate>`
      : "") +
    `<cac:TaxTotal>` +
    `<cbc:TaxAmount currencyID="${paraBirimi}">${tutar(ozet.kdvToplam)}</cbc:TaxAmount>` +
    ozet.kdvGruplari
      .map((g) =>
        kdvTaxSubtotalXml(g.matrah, g.vergi, g.oran, paraBirimi, {
          kod: g.istisnaKodu,
          gerekce: g.istisnaGerekcesi,
        })
      )
      .join("") +
    `</cac:TaxTotal>` +
    // UBL-TR sequence: TaxTotal → WithholdingTaxTotal → LegalMonetaryTotal
    (ozet.tevkifatGruplari.length
      ? `<cac:WithholdingTaxTotal>` +
        `<cbc:TaxAmount currencyID="${paraBirimi}">${tutar(ozet.tevkifatToplam)}</cbc:TaxAmount>` +
        ozet.tevkifatGruplari
          .map((g) => tevkifatSubtotalXml(g.matrah, g.vergi, g.oran, g.kod, paraBirimi))
          .join("") +
        `</cac:WithholdingTaxTotal>`
      : "") +
    `<cac:LegalMonetaryTotal>` +
    `<cbc:LineExtensionAmount currencyID="${paraBirimi}">${tutar(ozet.malHizmetToplam)}</cbc:LineExtensionAmount>` +
    `<cbc:TaxExclusiveAmount currencyID="${paraBirimi}">${tutar(ozet.vergiHaricToplam)}</cbc:TaxExclusiveAmount>` +
    // KDV dahil toplam tevkifattan ÖNCEKİ tutardır; tevkifat yalnızca ödenecekten düşer
    `<cbc:TaxInclusiveAmount currencyID="${paraBirimi}">${tutar(
      ozet.malHizmetToplam + ozet.kdvToplam
    )}</cbc:TaxInclusiveAmount>` +
    `<cbc:AllowanceTotalAmount currencyID="${paraBirimi}">${tutar(ozet.iskontoToplam)}</cbc:AllowanceTotalAmount>` +
    `<cbc:PayableAmount currencyID="${paraBirimi}">${tutar(ozet.odenecekTutar)}</cbc:PayableAmount>` +
    `</cac:LegalMonetaryTotal>` +
    girdi.satirlar
      .map((satir, i) => invoiceLineXml(satir, ozet.satirlar[i], paraBirimi))
      .join("") +
    `</Invoice>`;

  return { xml, uuid, ozet };
};

/** Üretilen XML'i ICE'nin beklediği base64 biçimine çevirir */
export const toBase64 = (xml: string): string => Buffer.from(xml, "utf8").toString("base64");
