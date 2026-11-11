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
  const tipAdi = c.veri?.tipAdi === "SATIM" ? "Satış" : "Alış";
  const baslikEk = c.veri?.isArbitraj ? `Arbitraj ${tipAdi}` : `Döviz ${tipAdi}`;
  return ciz(c, `${baslikEk}${no ? ` - ${no}` : ""}`);
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
  const rawLines = Array.isArray(girdi.lines) ? girdi.lines : [];
  if (rawLines.length === 0) {
    const tek = await dovizFisHtml(girdi);
    return [tek];
  }

  // Yalnızca geçerli (para kodu ve miktar/tutar > 0 olan) satırları dikkate al
  const validLines = rawLines.filter((l: any) => {
    const hasKod = (l.paraKodu || l.kod) && String(l.paraKodu || l.kod).trim() !== "";
    const m = parseDecimal(l.miktar);
    const t = parseDecimal(l.tutar);
    return hasKod && (m > 0 || t > 0);
  });

  const sourceLines = validLines.length > 0 ? validLines : rawLines;

  // Arbitraj işleminde en fazla 1 Döviz fişi satırı (isArbitraj: false) ve en fazla 1 Arbitraj fişi satırı (isArbitraj: true) basılır
  let lines: any[] = sourceLines;
  if (girdi.isArbitraj && sourceLines.length > 0) {
    const nonArbLines = sourceLines.filter((l: any) => l.isArbitraj === false);
    const arbLines = sourceLines.filter((l: any) => l.isArbitraj === true);

    const finalArbLines: any[] = [];
    if (nonArbLines.length > 0) {
      finalArbLines.push({ ...nonArbLines[0], isArbitraj: false });
    }
    if (arbLines.length > 0) {
      finalArbLines.push({ ...arbLines[0], isArbitraj: true });
    } else if (finalArbLines.length === 1 && sourceLines.length > 1) {
      // 2. satır arbitraj bacağı
      finalArbLines.push({ ...sourceLines[1], isArbitraj: true });
    } else if (finalArbLines.length === 0) {
      // Yalnızca tek satır var ise ve arbitraj ise tek arbitraj satırı
      finalArbLines.push({ ...sourceLines[0], isArbitraj: true });
    }
    lines = finalArbLines;
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

    let satirTip = Number(girdi.tip ?? 0);
    if (line.tip !== undefined && line.tip !== null) {
      satirTip = Number(line.tip);
    } else if (line.islemYonu) {
      satirTip = (String(line.islemYonu).toLowerCase() === "satis" || Number(line.islemYonu) === 1) ? 1 : 0;
    } else if (girdi.isArbitraj) {
      // Arbitraj işleminde satır yönü belirtilmemişse: 1. bacak ana fiş yönü, 2. bacak ters yön
      satirTip = idx === 0 ? Number(girdi.tip ?? 0) : (Number(girdi.tip ?? 0) === 0 ? 1 : 0);
    }

    const isLineArbitraj = line.isArbitraj !== undefined
      ? Boolean(line.isArbitraj)
      : Boolean(girdi.isArbitraj && idx > 0);

    const tekilGirdi = {
      ...girdi,
      fisId: girdi.fisId,
      tip: satirTip,
      isArbitraj: isLineArbitraj,
      seriNo: satirSeriNo,
      belgeNo: satirBelgeNo,
      guid: satirGuid,
      ettn: satirGuid,
      lines: [{ ...line, tip: satirTip, islemYonu: satirTip === 1 ? "satis" : "alis", isArbitraj: isLineArbitraj, miktar, kur, tutar, seriNo: satirSeriNo, belgeNo: satirBelgeNo }],
      toplamTutar: tutar,
      // Masraf ve son toplamı sunucu kurar: KMV firma ayarına göre (kurdan hariç) eklenir ya da (kura dahil) eklenmez.
      totalMasraf: undefined,
      sonToplam: undefined,
      odemeTutari: undefined,
      bsmvTutari: satirTip === 1 ? (bmv || undefined) : 0,
      kmvTutari: satirTip === 1 ? (kmv || undefined) : 0,
      komisyonTutari: komisyon || undefined,
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

/** Perakende fişi / fatura: kayıtlı fatura ya da kayıt yükü; bütün ürünler tek fişte. */
export async function perakendeFisHtml(fatura: Record<string, any>, bicim: FisBicimi): Promise<FisHtml> {
  const c = await BelgeService.perakendeCikti(fatura, bicim);
  return ciz(c, `${bicim === "80" ? "Perakende Bilgi Fişi" : "e-Arşiv Fatura"}${c.veri?.faturaNo ? ` - ${c.veri.faturaNo}` : ""}`);
}

/** Ticari satış fişi: kayıtlı fiş ya da ekrandaki fiş (docs/TICARI_ISLEMLER_YOL_HARITASI.md, T17). */
export async function ticariFisHtml(fatura: Record<string, any>, bicim: FisBicimi): Promise<FisHtml> {
  const c = await BelgeService.ticariCikti(fatura, bicim);
  return ciz(c, `${bicim === "80" ? "Satış Bilgi Fişi" : "Satış Faturası"}${c.veri?.faturaNo ? ` - ${c.veri.faturaNo}` : ""}`);
}
