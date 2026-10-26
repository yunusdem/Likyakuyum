import { BelgeService, type FisCiktisi } from "../../services/belgeService";
import { sablonHtml, type SablonHtmlSonucu } from "./htmlCiz";
import { parseDecimal, parseKur } from "../numericInput";

/**
 * Yazıcıya giden fişin HTML'i — firmanın şablonuyla (docs/FIS_TASARIM_YOL_HARITASI.md).
 * Önizleme penceresi (F9) ve kaydet-yazdır (F10) aynı yolu kullanır; böylece fiş her yerde aynı basılır.
 */
export interface FisHtml extends SablonHtmlSonucu { baslik: string; veri: Record<string, any>; tur: string }
export type FisBicimi = "80" | "A4";

async function ciz(c: FisCiktisi, baslik: string): Promise<FisHtml> {
  const sonuc = await sablonHtml(c.sablon, c.veri, c.gorseller);
  return { ...sonuc, veri: c.veri, tur: c.tur, baslik };
}

/** Döviz fişi: ekranın yazdırma anındaki görüntüsü (DovizFisiPrintModal'ın aldığı alanlar). */
export async function dovizFisHtml(girdi: Record<string, any>): Promise<FisHtml> {
  const c = await BelgeService.dovizCikti(girdi);
  const no = c.veri?.belgeNo || girdi.seriNo || girdi.belgeNo || girdi.fisId || "";
  return ciz(c, `e-Döviz Fişi${no ? ` - ${no}` : ""}`);
}

/**
 * Belge numarasını (veya seri noyu) sondaki sayısal basamakları artırarak ardışık üretir.
 * Örn: EDA2026000000001 -> EDA2026000000002, A000000010 -> A000000011
 */
export function incrementDocNo(docNo: string, offset: number): string {
  if (!docNo || offset === 0) return docNo || "";
  let lastNonDigit = -1;
  for (let i = docNo.length - 1; i >= 0; i--) {
    const ch = docNo[i];
    if (ch < "0" || ch > "9") {
      lastNonDigit = i;
      break;
    }
  }
  if (lastNonDigit === docNo.length - 1) {
    return docNo;
  }
  const prefix = docNo.slice(0, lastNonDigit + 1);
  const digits = docNo.slice(lastNonDigit + 1);
  const num = parseInt(digits, 10);
  if (isNaN(num)) return docNo;
  const nextNum = num + offset;
  const nextDigits = String(nextNum).padStart(digits.length, "0");
  return prefix + nextDigits;
}

/**
 * Döviz fişleri: Fiş içindeki her bir döviz satırı için ayrı bir fiş üretir.
 * Çoklu ürün/satır olduğunda her bir ürün ayrı bir fişte çıkar.
 */
export async function dovizFisleriHtml(girdi: Record<string, any>): Promise<FisHtml[]> {
  const lines = Array.isArray(girdi.lines) ? girdi.lines : [];
  if (lines.length === 0) {
    const tek = await dovizFisHtml(girdi);
    return [tek];
  }

  const baseSeri = String(girdi.seriNo || "");
  const baseBelge = String(girdi.belgeNo || "");

  const fisler: FisHtml[] = [];
  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const miktar = parseDecimal(line.miktar);
    const kur = parseKur(line.kur);
    const tutar = line.tutar !== undefined && line.tutar !== null ? parseDecimal(line.tutar) : miktar * kur;
    const bmv = parseDecimal(line.bmv);
    const kmv = parseDecimal(line.kmv);
    const komisyon = parseDecimal(line.komisyon);

    // Satıra ait seriNo ve belgeNo varsa onları kullan; yoksa ana fişinkinden sırayla türet
    const satirSeriNo = (line.seriNo && line.seriNo !== baseSeri) ? line.seriNo : (baseSeri ? incrementDocNo(baseSeri, idx) : "");
    const satirBelgeNo = (line.belgeNo && line.belgeNo !== baseBelge) ? line.belgeNo : (baseBelge ? incrementDocNo(baseBelge, idx) : "");
    const satirGuid = line.ettn || line.guid || girdi.guid;

    const tekilGirdi = {
      ...girdi,
      seriNo: satirSeriNo,
      belgeNo: satirBelgeNo,
      guid: satirGuid,
      ettn: satirGuid,
      lines: [{ ...line, miktar, kur, tutar, seriNo: satirSeriNo, belgeNo: satirBelgeNo }],
      toplamTutar: tutar,
      // Masraf ve son toplamı sunucu kurar: KMV firma ayarına göre (kurdan hariç) eklenir ya da (kura dahil) eklenmez.
      totalMasraf: undefined,
      sonToplam: undefined,
      odemeTutari: undefined,
      bsmvTutari: bmv,
      kmvTutari: kmv,
      komisyonTutari: komisyon,
    };

    const tek = await dovizFisHtml(tekilGirdi);
    fisler.push(tek);
  }
  return fisler;
}

/**
 * Sarraf fişi: ekranın yazdırma anındaki görüntüsü (SarrafFisiPrintModal'ın aldığı alanlar).
 * Fiş tek kayıttır (tek fiş no): bütün ürünler aynı fişte alt alta basılır, fiş satır sayısı kadar uzar.
 */
export async function sarrafFisHtml(girdi: Record<string, any>, bicim: FisBicimi): Promise<FisHtml> {
  const c = await BelgeService.sarrafCikti(girdi, bicim);
  return ciz(c, `${c.veri?.baslik || "Sarraf Fişi"}${c.veri?.fisNo ? ` - ${c.veri.fisNo}` : ""}`);
}

/** Perakende fişi / fatura: kayıtlı fatura ya da kayıt yükü. */
export async function perakendeFisHtml(fatura: Record<string, any>, bicim: FisBicimi): Promise<FisHtml> {
  const c = await BelgeService.perakendeCikti(fatura, bicim);
  return ciz(c, `${bicim === "80" ? "Perakende Bilgi Fişi" : "e-Arşiv Fatura"}${c.veri?.faturaNo ? ` - ${c.veri.faturaNo}` : ""}`);
}

/**
 * Perakende fişleri: Fiş içindeki her bir ürün satırı için ayrı bir fiş üretir.
 * Çoklu ürün/satır olduğunda her bir ürün ayrı bir fişte çıkar.
 */
export async function perakendeFisleriHtml(fatura: Record<string, any>, bicim: FisBicimi): Promise<FisHtml[]> {
  const satirlar = Array.isArray(fatura.satirlar) ? fatura.satirlar : [];
  if (satirlar.length <= 1) {
    const tek = await perakendeFisHtml(fatura, bicim);
    return [tek];
  }

  const baseFaturaNo = String(fatura.faturaNo || "");

  const fisler: FisHtml[] = [];
  for (let idx = 0; idx < satirlar.length; idx++) {
    const s = satirlar[idx];
    const tutar = parseDecimal(s.toplamTutar) || parseDecimal(s.tutar) || (parseDecimal(s.miktar || 1) * parseDecimal(s.birimFiyat || 0));
    const kdv = parseDecimal(s.kdvTutari);
    const araToplam = tutar - kdv;

    const satirFaturaNo = s.faturaNo || (baseFaturaNo ? incrementDocNo(baseFaturaNo, idx) : "");

    const tekilFatura = {
      ...fatura,
      faturaNo: satirFaturaNo,
      satirlar: [s],
      araToplam: araToplam > 0 ? araToplam : tutar,
      toplamKdv: kdv,
      genelToplam: tutar,
    };

    const tek = await perakendeFisHtml(tekilFatura, bicim);
    fisler.push(tek);
  }
  return fisler;
}

/** Ticari satış fişi: kayıtlı fiş ya da ekrandaki fiş (docs/TICARI_ISLEMLER_YOL_HARITASI.md, T17). */
export async function ticariFisHtml(fatura: Record<string, any>, bicim: FisBicimi): Promise<FisHtml> {
  const c = await BelgeService.ticariCikti(fatura, bicim);
  return ciz(c, `${bicim === "80" ? "Satış Bilgi Fişi" : "Satış Faturası"}${c.veri?.faturaNo ? ` - ${c.veri.faturaNo}` : ""}`);
}
