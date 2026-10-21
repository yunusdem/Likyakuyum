import { BelgeService, type FisCiktisi } from "../../services/belgeService";
import { sablonHtml, type SablonHtmlSonucu } from "./htmlCiz";

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
 * Döviz fişleri: Fiş içindeki tüm döviz satırlarını tek fişte toplar ve döner.
 * F10 ve F9'da tek fişte tüm döviz satırları gözükür.
 */
export async function dovizFisleriHtml(girdi: Record<string, any>): Promise<FisHtml[]> {
  const tek = await dovizFisHtml(girdi);
  return [tek];
}

/** Sarraf fişi: ekranın yazdırma anındaki görüntüsü (SarrafFisiPrintModal'ın aldığı alanlar). */
export async function sarrafFisHtml(girdi: Record<string, any>, bicim: FisBicimi): Promise<FisHtml> {
  const c = await BelgeService.sarrafCikti(girdi, bicim);
  return ciz(c, `${c.veri?.baslik || "Sarraf Fişi"}${c.veri?.fisNo ? ` - ${c.veri.fisNo}` : ""}`);
}

/**
 * Sarraf fişleri: Fiş içindeki tüm ürün/hareket satırlarını tek fişte toplar ve döner.
 * F10 ve F9'da tek fişte tüm ürünler gözükür.
 */
export async function sarrafFisleriHtml(girdi: Record<string, any>, bicim: FisBicimi): Promise<FisHtml[]> {
  const tek = await sarrafFisHtml(girdi, bicim);
  return [tek];
}

/** Perakende fişi / fatura: kayıtlı fatura ya da kayıt yükü. */
export async function perakendeFisHtml(fatura: Record<string, any>, bicim: FisBicimi): Promise<FisHtml> {
  const c = await BelgeService.perakendeCikti(fatura, bicim);
  return ciz(c, `${bicim === "80" ? "Perakende Bilgi Fişi" : "e-Arşiv Fatura"}${c.veri?.faturaNo ? ` - ${c.veri.faturaNo}` : ""}`);
}

/**
 * Perakende fişleri: Fiş içindeki tüm ürün satırlarını tek fişte toplar ve döner.
 * F10 ve F9'da tek fişte tüm ürünler gözükür.
 */
export async function perakendeFisleriHtml(fatura: Record<string, any>, bicim: FisBicimi): Promise<FisHtml[]> {
  const tek = await perakendeFisHtml(fatura, bicim);
  return [tek];
}

/** Ticari satış fişi: kayıtlı fiş ya da ekrandaki fiş (docs/TICARI_ISLEMLER_YOL_HARITASI.md, T17). */
export async function ticariFisHtml(fatura: Record<string, any>, bicim: FisBicimi): Promise<FisHtml> {
  const c = await BelgeService.ticariCikti(fatura, bicim);
  return ciz(c, `${bicim === "80" ? "Satış Bilgi Fişi" : "Satış Faturası"}${c.veri?.faturaNo ? ` - ${c.veri.faturaNo}` : ""}`);
}
