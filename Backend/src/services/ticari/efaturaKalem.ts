import { XMLParser } from "fast-xml-parser";
import { adNormal, birimCarpani } from "./efaturaBirim.js";
import { gecerliGun } from "./ticariHesap.js";

export { adNormal, birimCarpani };

/**
 * Gelen e-Faturadan stok girişi (docs/TICARI_ADISYON_YOL_HARITASI.md, TA14) — saf fonksiyonlar:
 * UBL-TR faturasını okur (başlık + kalemler), kalemi stok kartıyla eşleştirir (hatırlanan → barkod → kod → ad), UBL birim
 * kodunu kartın birimine çevirir (çarpan) ve giriş satırını (ana birim miktarı, KDV hariç net birim fiyat, KDV) hesaplar.
 */

export interface UblKalem {
  sira: number;
  ad: string;
  saticiKodu: string | null;
  aliciKodu: string | null;
  /** StandardItemIdentification (GTIN / barkod) */
  barkod: string | null;
  miktar: number;
  birimKodu: string;
  /** İskonto öncesi birim fiyat (KDV hariç) */
  birimFiyat: number;
  iskonto: number;
  /** LineExtensionAmount: iskontolu satır tutarı (KDV hariç) */
  netTutar: number;
  kdvOrani: number;
  kdvTutari: number;
  /** Item/ItemInstance/LotIdentification: son kullanma tarihi (YYYY-AA-GG) ve parti no — satıcı yazdıysa (TA16) */
  skt: string | null;
  partiNo: string | null;
}

export interface UblFatura {
  ettn: string;
  faturaNo: string;
  tarih: string;
  faturaTipi: string;
  paraBirimi: string;
  saticiVkn: string;
  saticiUnvan: string;
  kalemler: UblKalem[];
  /** LegalMonetaryTotal */
  matrah: number;
  odenecek: number;
}

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@", removeNSPrefix: true, parseTagValue: false, trimValues: true, processEntities: true });
const dizi = <T,>(v: T | T[] | undefined | null): T[] => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);
const metin = (v: any): string => (v === undefined || v === null ? "" : typeof v === "object" ? String(v["#text"] ?? "") : String(v)).trim();
const sayi = (v: any): number => { const n = Number(metin(v).replace(",", ".")); return Number.isFinite(n) ? n : 0; };
const y2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const y4 = (n: number) => Math.round(n * 10000) / 10000;
const y6 = (n: number) => Math.round(n * 1_000_000) / 1_000_000;

/** Taraf (AccountingSupplierParty) kimlik numarası: VKN ya da TCKN şeması */
const tarafNo = (taraf: any): string => {
  const p = taraf?.Party;
  for (const id of dizi(p?.PartyIdentification)) {
    const sema = String(id?.ID?.["@schemeID"] || "").toUpperCase();
    if (sema === "VKN" || sema === "TCKN") return metin(id.ID).replace(/\D/g, "");
  }
  return "";
};
const tarafAdi = (taraf: any): string => {
  const p = taraf?.Party;
  const ad = metin(p?.PartyName?.Name);
  if (ad) return ad;
  const k = p?.Person;
  return [metin(k?.FirstName), metin(k?.FamilyName)].filter(Boolean).join(" ");
};

/** UBL-TR fatura XML'i → başlık + kalemler. Fatura değilse hata. */
export function ublFaturaOku(xml: string): UblFatura {
  const kok = parser.parse(xml);
  const f = kok?.Invoice;
  if (!f) throw new Error("Belge bir UBL faturası değil.");
  const kalemler: UblKalem[] = dizi(f.InvoiceLine).map((l: any, i: number) => {
    const item = l?.Item || {};
    const miktar = sayi(l?.InvoicedQuantity);
    const birimKodu = String(l?.InvoicedQuantity?.["@unitCode"] || "C62").toUpperCase();
    const iskonto = dizi(l?.AllowanceCharge).filter((a: any) => metin(a?.ChargeIndicator).toLowerCase() === "false").reduce((t: number, a: any) => t + sayi(a?.Amount), 0);
    const kdv = dizi(l?.TaxTotal?.TaxSubtotal).find((t: any) => metin(t?.TaxCategory?.TaxScheme?.TaxTypeCode) === "0015") || dizi(l?.TaxTotal?.TaxSubtotal)[0];
    // SKT: LotIdentification/ExpiryDate; yoksa ItemInstance/BestBeforeDate (tavsiye edilen tüketim tarihi)
    const ornek = dizi(item?.ItemInstance);
    const lot = ornek.map((x: any) => x?.LotIdentification).find((x: any) => x) || null;
    const sktHam = (metin(lot?.ExpiryDate) || metin(ornek.find((x: any) => x?.BestBeforeDate)?.BestBeforeDate)).slice(0, 10);
    return {
      sira: sayi(l?.ID) || i + 1,
      ad: metin(item?.Name) || metin(item?.Description) || `Kalem ${i + 1}`,
      saticiKodu: metin(item?.SellersItemIdentification?.ID) || null,
      aliciKodu: metin(item?.BuyersItemIdentification?.ID) || null,
      barkod: metin(item?.StandardItemIdentification?.ID) || metin(item?.ManufacturersItemIdentification?.ID) || null,
      miktar,
      birimKodu,
      birimFiyat: sayi(l?.Price?.PriceAmount),
      iskonto: y2(iskonto),
      netTutar: y2(sayi(l?.LineExtensionAmount)),
      kdvOrani: kdv ? sayi(kdv?.Percent) : 0,
      kdvTutari: kdv ? y2(sayi(kdv?.TaxAmount)) : 0,
      skt: gecerliGun(sktHam) ? sktHam : null,
      partiNo: metin(lot?.LotNumberID).slice(0, 40) || null,
    };
  });
  return {
    ettn: metin(f.UUID).toLowerCase(),
    faturaNo: metin(f.ID),
    tarih: metin(f.IssueDate),
    faturaTipi: metin(f.InvoiceTypeCode).toUpperCase() || "SATIS",
    paraBirimi: metin(f.DocumentCurrencyCode).toUpperCase() || "TRY",
    saticiVkn: tarafNo(f.AccountingSupplierParty),
    saticiUnvan: tarafAdi(f.AccountingSupplierParty),
    kalemler,
    matrah: y2(sayi(f.LegalMonetaryTotal?.LineExtensionAmount)),
    odenecek: y2(sayi(f.LegalMonetaryTotal?.PayableAmount)),
  };
}

export interface EslesmeAdaylari {
  /** Hatırlanan: `K:<satıcı kodu>` ya da `A:<ad normal>` → kart + çarpan */
  hatirlanan: Map<string, { stokKartId: number; carpan: number }>;
  /** Barkod → kart (ana birim barkodu; koli barkodunda çarpan) */
  barkod: Map<string, { stokKartId: number; carpan: number }>;
  /** Kart kodu → kart */
  kod: Map<string, number>;
  /** Ad normal → kart (tekse) */
  ad: Map<string, number>;
  /** Kart birimleri */
  birim: Map<number, string>;
}

export type EslesmeKaynagi = "hatirlanan" | "barkod" | "kod" | "ad" | null;

/** Hatırlama anahtarları (satıcı ürün kodu, yoksa normal ad): birimli (yeni) ve birimsiz (eski) biçim */
export function eslesmeAnahtarlari(k: Pick<UblKalem, "ad" | "saticiKodu" | "birimKodu">): { birimli: string; birimsiz: string }[] {
  const birim = String(k.birimKodu || "").trim().toUpperCase();
  const tabanlar = [...(k.saticiKodu ? [`K:${k.saticiKodu}`] : []), `A:${adNormal(k.ad)}`];
  return tabanlar.map((t) => ({ birimli: `${t}#${birim}`.slice(0, 260), birimsiz: t.slice(0, 260) }));
}

/** Kalemi karta eşler; çarpan: hatırlanan / koli barkodu ya da birim çevirisi (bilinmiyorsa null) */
export function kalemEslestir(k: Pick<UblKalem, "ad" | "saticiKodu" | "aliciKodu" | "barkod" | "birimKodu">, a: EslesmeAdaylari): { stokKartId: number | null; kaynak: EslesmeKaynagi; carpan: number | null } {
  const birimli = (id: number, kaynak: EslesmeKaynagi) => ({ stokKartId: id, kaynak, carpan: birimCarpani(k.birimKodu, a.birim.get(id) || "") });
  // Hatırlanan çarpan faturadaki birime bağlıdır (T6, 26.11.2026 denetimi): aynı ürün bir faturada KOLI, ötekinde ADET gelebilir.
  // Birimli anahtar yoksa birimsiz (eski) anahtardan yalnız kart alınır; çarpan birim çevirisinden (bilinmiyorsa sorulur).
  for (const anahtar of eslesmeAnahtarlari(k)) {
    const h = a.hatirlanan.get(anahtar.birimli);
    if (h) return { stokKartId: h.stokKartId, kaynak: "hatirlanan", carpan: h.carpan };
    // Aynı ürünün başka birimle (ör. KOLI) hatırlanmış kaydı ya da birimsiz eski kayıt: kart alınır, çarpan bu birimin çevirisinden
    let e = a.hatirlanan.get(anahtar.birimsiz);
    if (!e) for (const [x, v] of a.hatirlanan) if (x.startsWith(`${anahtar.birimsiz}#`)) { e = v; break; }
    if (e) return { stokKartId: e.stokKartId, kaynak: "hatirlanan", carpan: birimCarpani(k.birimKodu, a.birim.get(e.stokKartId) || "") };
  }
  for (const kod of [k.barkod, k.saticiKodu, k.aliciKodu]) {
    const b = kod ? a.barkod.get(kod) : undefined;
    if (b) return { stokKartId: b.stokKartId, kaynak: "barkod", carpan: b.carpan !== 1 ? b.carpan : birimCarpani(k.birimKodu, a.birim.get(b.stokKartId) || "") };
  }
  for (const kod of [k.aliciKodu, k.saticiKodu]) {
    const id = kod ? a.kod.get(kod.toLocaleUpperCase("tr-TR")) : undefined;
    if (id) return birimli(id, "kod");
  }
  const id = a.ad.get(adNormal(k.ad));
  if (id) return birimli(id, "ad");
  return { stokKartId: null, kaynak: null, carpan: null };
}

/** Giriş satırı: ana birim miktarı = miktar × çarpan; KDV hariç net birim fiyat = net tutar ÷ ana birim miktarı (6 hane) */
export function efaturaGirisSatiri(k: Pick<UblKalem, "miktar" | "netTutar" | "kdvOrani">, carpan: number): { miktar: number; birimFiyat: number; kdvOrani: number } {
  if (!(carpan > 0)) throw new Error("Birim çarpanı sıfırdan büyük olmalı.");
  const miktar = y4(k.miktar * carpan);
  if (!(miktar > 0)) throw new Error("Kalem miktarı sıfır.");
  return { miktar, birimFiyat: y6(k.netTutar / miktar), kdvOrani: k.kdvOrani };
}
