import { randomUUID } from "crypto";
import { escapeXml } from "../ice.client.js";
import { ApiError } from "../../../utils/ApiError.js";
import { UblTaraf, kimlikSemasi } from "./invoiceBuilder.js";

/**
 * e-Gider Pusulası (UBL-TR `CreditNote`) üreteci — Faz 8d.
 *
 * ## Kaynak: tahmin değil, doğrulanmış örnek
 *
 * GİB "e-Gider Pusulası Paketi" içindeki resmî dosyalardan çıkarıldı
 * (`docs/ice/gib-faz8/gider-paketi/e-Gider Pusulası Paketi/`):
 *  - `eArsiv.xsd`                          → `iadeDetayEnum`, `ContactTypeEnum` değerleri
 *  - `GiderPusulasıSATIS.xml`              → satış (mükellef olmayandan mal/hizmet alımı)
 *  - `GiderPusulasıIADE_Belgesiz.xml`      → iade, belgesiz
 *  - `GiderPusulasıIADE_IADE_KoduYazılması.xml` → iade, e-Arşiv faturaya dayalı
 *  - `GiderPusulasıIADE_SMS_KoduYazılması.xml`  → iade, satış fişine dayalı
 *
 * ## Faturadan yapısal farkları (örneklerden birebir)
 *
 * | Fatura (`Invoice`) | Gider pusulası (`CreditNote`) |
 * |---|---|
 * | kök `Invoice`, `…Invoice-2` ad alanı | kök `CreditNote`, `…CreditNote-2` |
 * | `cbc:InvoiceTypeCode` | `cbc:CreditNoteTypeCode` |
 * | `cac:InvoiceLine` | `cac:CreditNoteLine` |
 * | `cbc:InvoicedQuantity` | `cbc:CreditedQuantity` |
 * | `ProfileID` senaryoya göre | `ProfileID` daima `GIDERPUSULASI` |
 * | `CustomizationID` `TR1.2` | `CustomizationID` `TR1.2.1` |
 *
 * ## Kuyumcudaki karşılığı
 * Vergi mükellefi olmayan kişiden (vatandaştan) **hurda altın / ikinci el ürün alımı**
 * gider pusulası ile belgelenir. Bu yüzden "alıcı" alanı bizim firmamız değil,
 * **malı satan vatandaştır**; belgeyi biz düzenleriz.
 *
 * ## Bilinçli sınır
 * `TaxTypeCode` varsayılanı, GİB örneğindeki gibi `0015`'tir. Gider pusulasında
 * uygulanacak **stopaj (GVK 94) oranı ve vergi kodu işletmeye ve mal cinsine göre
 * değişir**; bu yüzden kod ve oran dışarıdan verilir, üreteç varsayım yapmaz.
 * Hurda altın alımındaki doğru stopaj kodu canlı örnekle teyit edilmelidir.
 */

/* ==========================================================================
   Tipler
   ========================================================================== */

/** `eArsiv.xsd` → `iadeDetayEnum` */
export const IADE_BELGE_TIPLERI = ["EARSIV_FATURA", "BELGESIZ", "SATIS_FISI"] as const;
export type IadeBelgeTipi = (typeof IADE_BELGE_TIPLERI)[number];

/** `eArsiv.xsd` → `ContactTypeEnum` */
export const IADE_KANAL_TIPLERI = ["IADEKODU", "SMS"] as const;
export type IadeKanalTipi = (typeof IADE_KANAL_TIPLERI)[number];

export type GiderPusulasiTipi = "SATIS" | "IADE";

export interface GiderPusulasiSatiri {
  ad: string;
  aciklama?: string;
  miktar: number;
  birimKodu?: string;
  birimFiyat: number;
  /** Stopaj / vergi oranı, yüzde. 0 verilebilir. */
  vergiOrani: number;
}

/** İade işlemlerinde dayanak belge (`cac:BillingReference`) */
export interface IadeDayanak {
  belgeTipi: IadeBelgeTipi;
  /** `BELGESIZ` dışında zorunlu — fatura no ya da fiş no */
  belgeNo?: string;
  belgeTarihi: string;
}

/** İade işlemlerinde kargo firması (`cac:Delivery/cac:DeliveryParty`) */
export interface KargoBilgisi {
  vkn: string;
  unvan: string;
  yetkiBelgeNo?: string;
  il?: string;
  ilce?: string;
}

/** İade kanalı bilgisi (`cac:Contact/cac:OtherCommunication`) */
export interface IadeKanali {
  tip: IadeKanalTipi;
  /** Uygulama / operatör adı */
  saglayiciAdi: string;
  /** Sağlayıcının VKN bilgisi */
  saglayiciVkn: string;
  /** SMS kanalında müşteriye gönderilen kod */
  kod?: string;
  /** SMS kanalında müşteri telefonu */
  telefon?: string;
}

export interface GiderPusulasiGirdi {
  belgeNo: string;
  uuid?: string;
  tarih?: string;
  saat?: string;
  belgeTipi: GiderPusulasiTipi;
  paraBirimi?: string;
  notlar?: string[];
  /** Belgeyi düzenleyen — bizim firmamız */
  gonderici: UblTaraf;
  /** Malı satan / iadeyi yapan kişi (genelde TCKN'li gerçek kişi) */
  alici: UblTaraf;
  satirlar: GiderPusulasiSatiri[];
  /** `belgeTipi === "IADE"` ise zorunlu */
  iadeDayanak?: IadeDayanak;
  iadeKanali?: IadeKanali;
  kargo?: KargoBilgisi;
  /** Vergi türü kodu — varsayılan GİB örneğindeki gibi 0015 */
  vergiTuruKodu?: string;
}

export interface GiderPusulasiHesap {
  satirlar: { siraNo: number; matrah: number; vergiTutari: number; vergiOrani: number }[];
  malHizmetToplam: number;
  vergiToplam: number;
  odenecekTutar: number;
  vergiGruplari: { oran: number; matrah: number; vergi: number }[];
}

/* ==========================================================================
   Yardımcılar
   ========================================================================== */

const tutar = (n: number): string => (Math.round(n * 100) / 100).toFixed(2);
const miktarStr = (n: number): string => String(Math.round(n * 100000) / 100000);
const yuvarla = (n: number): number => Math.round(n * 100) / 100;

const bugun = (): string =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
const simdi = (): string =>
  new Date().toLocaleTimeString("en-GB", { timeZone: "Europe/Istanbul", hour12: false });

const etiket = (ad: string, deger: unknown): string => {
  if (deger === undefined || deger === null || String(deger).trim() === "") return "";
  return `<${ad}>${escapeXml(deger)}</${ad}>`;
};

/* ==========================================================================
   Doğrulama
   ========================================================================== */

export const dogrulaGiderPusulasi = (girdi: GiderPusulasiGirdi): void => {
  const belgeNo = girdi.belgeNo?.trim() || "";
  if (!/^[A-Z0-9]{3}\d{13}$/.test(belgeNo)) {
    throw ApiError.badRequest(
      "Gider pusulası numarası 3 karakter seri + 13 hane biçiminde olmalıdır. Örnek: GIP2026000000001"
    );
  }

  const tarih = girdi.tarih || bugun();
  const d = new Date(tarih);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(tarih) ||
    !Number.isFinite(d.getTime()) ||
    d.toISOString().slice(0, 10) !== tarih
  ) {
    throw ApiError.badRequest("Geçerli bir düzenleme tarihi giriniz.");
  }
  if (belgeNo.slice(3, 7) !== tarih.slice(0, 4)) {
    throw ApiError.badRequest("Belge numarasındaki yıl, düzenleme tarihiyle aynı olmalıdır.");
  }

  if (!/^[A-Z]{3}$/.test((girdi.paraBirimi || "TRY").toUpperCase())) {
    throw ApiError.badRequest("Para birimi üç harfli kod olmalıdır.");
  }

  for (const [ad, taraf] of [
    ["Düzenleyen", girdi.gonderici],
    ["Karşı taraf", girdi.alici],
  ] as const) {
    const kimlik = taraf?.vknTckn?.trim() || "";
    if (!/^\d{10}$|^\d{11}$/.test(kimlik)) {
      throw ApiError.badRequest(`${ad} VKN/TCKN 10 veya 11 haneli rakam olmalıdır.`);
    }
    if (kimlik.length === 11 && !(taraf.ad?.trim() && taraf.soyad?.trim())) {
      throw ApiError.badRequest(`${ad} TCKN ile tanımlandığında ad ve soyad zorunludur.`);
    }
    if (!taraf.unvan?.trim() && !(taraf.ad?.trim() && taraf.soyad?.trim())) {
      throw ApiError.badRequest(`${ad} için unvan ya da ad+soyad girilmelidir.`);
    }
  }

  if (!girdi.satirlar?.length) {
    throw ApiError.badRequest("Gider pusulasında en az bir satır bulunmalıdır.");
  }

  girdi.satirlar.forEach((satir, i) => {
    const no = i + 1;
    if (![satir.miktar, satir.birimFiyat, satir.vergiOrani].every(Number.isFinite)) {
      throw ApiError.badRequest(`${no}. satırdaki sayısal değerler sonlu olmalıdır.`);
    }
    if (!satir.ad?.trim()) throw ApiError.badRequest(`${no}. satırda mal/hizmet adı zorunludur.`);
    if (!(satir.miktar > 0)) throw ApiError.badRequest(`${no}. satırda miktar sıfırdan büyük olmalıdır.`);
    if (satir.birimFiyat < 0) throw ApiError.badRequest(`${no}. satırda birim fiyat negatif olamaz.`);
    if (satir.vergiOrani < 0 || satir.vergiOrani > 100) {
      throw ApiError.badRequest(`${no}. satırda vergi oranı 0-100 aralığında olmalıdır.`);
    }
  });

  if (girdi.belgeTipi === "IADE") {
    const dayanak = girdi.iadeDayanak;
    if (!dayanak) {
      throw ApiError.badRequest("İade gider pusulasında dayanak belge bilgisi zorunludur.");
    }
    if (!IADE_BELGE_TIPLERI.includes(dayanak.belgeTipi)) {
      throw ApiError.badRequest(
        `Dayanak belge tipi şunlardan biri olmalıdır: ${IADE_BELGE_TIPLERI.join(", ")}`
      );
    }
    if (dayanak.belgeTipi !== "BELGESIZ" && !dayanak.belgeNo?.trim()) {
      throw ApiError.badRequest(
        "Belgeli iadelerde dayanak belge numarası zorunludur (BELGESIZ dışında)."
      );
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dayanak.belgeTarihi || "")) {
      throw ApiError.badRequest("Dayanak belge tarihi YYYY-AA-GG biçiminde olmalıdır.");
    }
    // GİB örneğinde belgesiz iadede karşı taraf gerçek TCKN ile bildiriliyor
    if (dayanak.belgeTipi === "BELGESIZ" && girdi.alici.vknTckn.trim().length !== 11) {
      throw ApiError.badRequest(
        "Belgesiz iadede karşı taraf gerçek TCKN ile bildirilmelidir (GİB örneği)."
      );
    }
    if (girdi.iadeKanali && !IADE_KANAL_TIPLERI.includes(girdi.iadeKanali.tip)) {
      throw ApiError.badRequest(
        `İade kanalı şunlardan biri olmalıdır: ${IADE_KANAL_TIPLERI.join(", ")}`
      );
    }
  }
};

/* ==========================================================================
   Hesaplama — tutarlar burada üretilir, istemciden gelenlere güvenilmez
   ========================================================================== */

export const hesaplaGiderPusulasi = (satirlar: GiderPusulasiSatiri[]): GiderPusulasiHesap => {
  const satirHesaplari = satirlar.map((satir, i) => {
    const matrah = yuvarla(satir.miktar * satir.birimFiyat);
    const vergiTutari = yuvarla((matrah * satir.vergiOrani) / 100);
    return { siraNo: i + 1, matrah, vergiTutari, vergiOrani: satir.vergiOrani };
  });

  const malHizmetToplam = yuvarla(satirHesaplari.reduce((t, s) => t + s.matrah, 0));
  const vergiToplam = yuvarla(satirHesaplari.reduce((t, s) => t + s.vergiTutari, 0));

  const gruplar = new Map<number, { matrah: number; vergi: number }>();
  for (const s of satirHesaplari) {
    const mevcut = gruplar.get(s.vergiOrani) || { matrah: 0, vergi: 0 };
    gruplar.set(s.vergiOrani, {
      matrah: yuvarla(mevcut.matrah + s.matrah),
      vergi: yuvarla(mevcut.vergi + s.vergiTutari),
    });
  }

  return {
    satirlar: satirHesaplari,
    malHizmetToplam,
    vergiToplam,
    odenecekTutar: yuvarla(malHizmetToplam + vergiToplam),
    vergiGruplari: [...gruplar.entries()]
      .map(([oran, v]) => ({ oran, ...v }))
      .sort((a, b) => a.oran - b.oran),
  };
};

/* ==========================================================================
   XML parçaları
   ========================================================================== */

const partyXml = (taraf: UblTaraf): string => {
  const kimlik = taraf.vknTckn.trim();
  const sema = kimlikSemasi(kimlik);
  const kisiAdi = [taraf.ad?.trim(), taraf.soyad?.trim()].filter(Boolean).join(" ");
  const unvan = taraf.unvan?.trim() || kisiAdi;

  return (
    `<cac:Party>` +
    etiket("cbc:WebsiteURI", taraf.webAdresi) +
    `<cac:PartyIdentification><cbc:ID schemeID="${sema}">${escapeXml(kimlik)}</cbc:ID></cac:PartyIdentification>` +
    (unvan ? `<cac:PartyName><cbc:Name>${escapeXml(unvan)}</cbc:Name></cac:PartyName>` : "") +
    `<cac:PostalAddress>` +
    etiket("cbc:StreetName", taraf.adres) +
    etiket("cbc:CitySubdivisionName", taraf.ilce) +
    etiket("cbc:CityName", taraf.il) +
    `<cac:Country><cbc:Name>${escapeXml(taraf.ulke || "TÜRKİYE")}</cbc:Name></cac:Country>` +
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
    (sema === "TCKN" && taraf.ad?.trim() && taraf.soyad?.trim()
      ? `<cac:Person><cbc:FirstName>${escapeXml(taraf.ad)}</cbc:FirstName>` +
        `<cbc:FamilyName>${escapeXml(taraf.soyad)}</cbc:FamilyName></cac:Person>`
      : "") +
    `</cac:Party>`
  );
};

/** Alıcı tarafına iade kanalı bilgisini ekler (SMS kodu / iade kodu) */
const aliciPartyXml = (taraf: UblTaraf, kanal?: IadeKanali): string => {
  const temel = partyXml(taraf);
  if (!kanal) return temel;

  // GİB örneğinde SMS kanalında cac:Contact içinde ID + Name + Telephone bulunuyor
  const contactXml =
    kanal.tip === "SMS"
      ? `<cac:Contact>` +
        etiket("cbc:ID", kanal.kod) +
        `<cbc:Name>SMS</cbc:Name>` +
        etiket("cbc:Telephone", kanal.telefon) +
        `</cac:Contact>`
      : `<cac:Contact>` + etiket("cbc:ID", kanal.kod) + `<cbc:Name>IADEKODU</cbc:Name>` + `</cac:Contact>`;

  // Mevcut Contact varsa onu değiştir, yoksa Person'dan önce ekle
  if (temel.includes("<cac:Contact>")) {
    return temel.replace(/<cac:Contact>.*?<\/cac:Contact>/s, contactXml);
  }
  if (temel.includes("<cac:Person>")) {
    return temel.replace("<cac:Person>", `${contactXml}<cac:Person>`);
  }
  return temel.replace("</cac:Party>", `${contactXml}</cac:Party>`);
};

const billingReferenceXml = (dayanak: IadeDayanak): string =>
  `<cac:BillingReference><cac:InvoiceDocumentReference>` +
  (dayanak.belgeTipi === "BELGESIZ"
    ? `<cbc:ID schemeID="BELGESIZ"/>`
    : `<cbc:ID schemeID="${dayanak.belgeTipi}">${escapeXml(dayanak.belgeNo || "")}</cbc:ID>`) +
  `<cbc:IssueDate>${escapeXml(dayanak.belgeTarihi)}</cbc:IssueDate>` +
  `</cac:InvoiceDocumentReference></cac:BillingReference>`;

const deliveryXml = (kargo: KargoBilgisi): string =>
  `<cac:Delivery><cac:DeliveryParty>` +
  (kargo.yetkiBelgeNo?.trim()
    ? `<cbc:IndustryClassificationCode name="YETKIBELGENO">${escapeXml(kargo.yetkiBelgeNo)}</cbc:IndustryClassificationCode>`
    : "") +
  `<cac:PartyIdentification><cbc:ID schemeID="VKN">${escapeXml(kargo.vkn)}</cbc:ID></cac:PartyIdentification>` +
  `<cac:PartyName><cbc:Name>${escapeXml(kargo.unvan)}</cbc:Name></cac:PartyName>` +
  `<cac:PostalAddress>` +
  etiket("cbc:CitySubdivisionName", kargo.ilce) +
  etiket("cbc:CityName", kargo.il) +
  `<cac:Country><cbc:Name>TÜRKİYE</cbc:Name></cac:Country>` +
  `</cac:PostalAddress>` +
  `</cac:DeliveryParty></cac:Delivery>`;

const taxSubtotalXml = (
  matrah: number,
  vergi: number,
  oran: number,
  paraBirimi: string,
  vergiKodu: string
): string =>
  `<cac:TaxSubtotal>` +
  `<cbc:TaxableAmount currencyID="${paraBirimi}">${tutar(matrah)}</cbc:TaxableAmount>` +
  `<cbc:TaxAmount currencyID="${paraBirimi}">${tutar(vergi)}</cbc:TaxAmount>` +
  `<cbc:Percent>${oran}</cbc:Percent>` +
  `<cac:TaxCategory><cac:TaxScheme>` +
  `<cbc:TaxTypeCode>${escapeXml(vergiKodu)}</cbc:TaxTypeCode>` +
  `</cac:TaxScheme></cac:TaxCategory>` +
  `</cac:TaxSubtotal>`;

const creditNoteLineXml = (
  satir: GiderPusulasiSatiri,
  hesap: { siraNo: number; matrah: number; vergiTutari: number; vergiOrani: number },
  paraBirimi: string,
  vergiKodu: string
): string =>
  `<cac:CreditNoteLine>` +
  `<cbc:ID>${hesap.siraNo}</cbc:ID>` +
  `<cbc:CreditedQuantity unitCode="${escapeXml(satir.birimKodu || "C62")}">${miktarStr(satir.miktar)}</cbc:CreditedQuantity>` +
  `<cbc:LineExtensionAmount currencyID="${paraBirimi}">${tutar(hesap.matrah)}</cbc:LineExtensionAmount>` +
  `<cac:TaxTotal>` +
  `<cbc:TaxAmount currencyID="${paraBirimi}">${tutar(hesap.vergiTutari)}</cbc:TaxAmount>` +
  taxSubtotalXml(hesap.matrah, hesap.vergiTutari, hesap.vergiOrani, paraBirimi, vergiKodu) +
  `</cac:TaxTotal>` +
  `<cac:Item>` +
  etiket("cbc:Description", satir.aciklama) +
  `<cbc:Name>${escapeXml(satir.ad)}</cbc:Name>` +
  `</cac:Item>` +
  `<cac:Price><cbc:PriceAmount currencyID="${paraBirimi}">${tutar(satir.birimFiyat)}</cbc:PriceAmount></cac:Price>` +
  `</cac:CreditNoteLine>`;

/* ==========================================================================
   Ana üreteç
   ========================================================================== */

export interface GiderPusulasiUretimSonucu {
  xml: string;
  uuid: string;
  ozet: GiderPusulasiHesap;
}

export const buildGiderPusulasiXml = (girdi: GiderPusulasiGirdi): GiderPusulasiUretimSonucu => {
  dogrulaGiderPusulasi(girdi);

  const ozet = hesaplaGiderPusulasi(girdi.satirlar);
  const uuid = girdi.uuid?.trim() || randomUUID();
  const paraBirimi = (girdi.paraBirimi || "TRY").toUpperCase();
  const tarih = girdi.tarih?.trim() || bugun();
  const saat = girdi.saat?.trim() || simdi();
  const belgeNo = girdi.belgeNo.trim().toUpperCase();
  const vergiKodu = girdi.vergiTuruKodu?.trim() || "0015";

  const notlarXml = (girdi.notlar || [])
    .filter((n) => n && n.trim())
    .map((n) => `<cbc:Note>${escapeXml(n)}</cbc:Note>`)
    .join("");

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<CreditNote xmlns="urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2"` +
    ` xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"` +
    ` xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">` +
    // ICE serileştiricisi imza icin ext:UBLExtensions ekliyor; onek burada bildirilmezse
    // "prefix ext is not bound" hatasi aliniyor. UBL-TR-de bu eleman ilk cocuk olmali.
    `<ext:UBLExtensions><ext:UBLExtension><ext:ExtensionContent/></ext:UBLExtension></ext:UBLExtensions>` +
    `<cbc:UBLVersionID>2.1</cbc:UBLVersionID>` +
    `<cbc:CustomizationID>TR1.2.1</cbc:CustomizationID>` +
    `<cbc:ProfileID>GIDERPUSULASI</cbc:ProfileID>` +
    `<cbc:ID>${escapeXml(belgeNo)}</cbc:ID>` +
    `<cbc:CopyIndicator>false</cbc:CopyIndicator>` +
    `<cbc:UUID>${escapeXml(uuid)}</cbc:UUID>` +
    `<cbc:IssueDate>${escapeXml(tarih)}</cbc:IssueDate>` +
    `<cbc:IssueTime>${escapeXml(saat)}</cbc:IssueTime>` +
    `<cbc:CreditNoteTypeCode>${escapeXml(girdi.belgeTipi)}</cbc:CreditNoteTypeCode>` +
    notlarXml +
    `<cbc:DocumentCurrencyCode>${escapeXml(paraBirimi)}</cbc:DocumentCurrencyCode>` +
    (girdi.belgeTipi === "IADE" && girdi.iadeDayanak
      ? billingReferenceXml(girdi.iadeDayanak)
      : "") +
    `<cac:AccountingSupplierParty>${partyXml(girdi.gonderici)}</cac:AccountingSupplierParty>` +
    `<cac:AccountingCustomerParty>${aliciPartyXml(girdi.alici, girdi.iadeKanali)}</cac:AccountingCustomerParty>` +
    (girdi.belgeTipi === "IADE" && girdi.kargo ? deliveryXml(girdi.kargo) : "") +
    `<cac:TaxTotal>` +
    `<cbc:TaxAmount currencyID="${paraBirimi}">${tutar(ozet.vergiToplam)}</cbc:TaxAmount>` +
    ozet.vergiGruplari
      .map((g) => taxSubtotalXml(g.matrah, g.vergi, g.oran, paraBirimi, vergiKodu))
      .join("") +
    `</cac:TaxTotal>` +
    `<cac:LegalMonetaryTotal>` +
    `<cbc:LineExtensionAmount currencyID="${paraBirimi}">${tutar(ozet.malHizmetToplam)}</cbc:LineExtensionAmount>` +
    `<cbc:TaxExclusiveAmount currencyID="${paraBirimi}">${tutar(ozet.malHizmetToplam)}</cbc:TaxExclusiveAmount>` +
    `<cbc:TaxInclusiveAmount currencyID="${paraBirimi}">${tutar(ozet.odenecekTutar)}</cbc:TaxInclusiveAmount>` +
    `<cbc:PayableAmount currencyID="${paraBirimi}">${tutar(ozet.odenecekTutar)}</cbc:PayableAmount>` +
    `</cac:LegalMonetaryTotal>` +
    girdi.satirlar
      .map((satir, i) => creditNoteLineXml(satir, ozet.satirlar[i], paraBirimi, vergiKodu))
      .join("") +
    `</CreditNote>`;

  return { xml, uuid, ozet };
};
