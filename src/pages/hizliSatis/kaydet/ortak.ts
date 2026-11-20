import { PrinterService, YaziciItem } from "../../../services/printerService";
import { resolveEffectivePrinter } from "../../../utils/printerResolver";
import { fisiYazdir } from "../../../utils/belgeSablon/yazdir";
import type { FisHtml } from "../../../utils/belgeSablon/fisCikti";
import type { SepetOdemesi } from "../../../../Backend/src/services/hizliSatis/hizliSatisHesap";
import type { KaydetBaglami } from "./tipler";

/** Hızlı satış kaydedicilerinin ortak parçaları (docs/HIZLI_SATIS_YOL_HARITASI.md, U3–U7) */

const iki = (n: number) => String(n).padStart(2, "0");
/** Fiş ekranları gibi yerel saat: "YYYY-MM-DD", "HH:mm" */
export const simdi = (d = new Date()) => ({
  tarih: `${d.getFullYear()}-${iki(d.getMonth() + 1)}-${iki(d.getDate())}`,
  saat: `${iki(d.getHours())}:${iki(d.getMinutes())}`,
});

export const TL_PARA_KODLARI = ["TL", "TRY", "TRL", "YTL"];

/** Ödeme listesi boşsa tamamı nakit TL (fiş ekranlarındaki varsayılan) */
export const odemeVeyaNakit = (b: KaydetBaglami): SepetOdemesi[] =>
  b.odemeler.length ? b.odemeler : [{ anahtar: "nakit", tur: 0, tutar: b.toplam.genelToplam }];

/** POS satırlarının cihaz isteği (PerakendeFisiPage posIstegi ile aynı yapı) */
export const pesinOdemeler = (o: SepetOdemesi[]) =>
  o.filter((x) => x.tur !== 2 && x.tutar > 0).map((x) => ({ tur: x.tur === 1 ? ("cari" as const) : x.tur === 3 ? ("havale" as const) : ("nakit" as const), tutar: x.tutar }));
export const posSatirlari = (o: SepetOdemesi[]) =>
  o.filter((x) => x.tur === 2).map((x) => ({ kimlik: x.anahtar, tutar: x.tutar, posCihaziId: x.posCihaziId ?? null }));

let yaziciOnbellek: YaziciItem[] | null = null;

/**
 * Kayıttan sonra otomatik baskı (H18). Fiş kaydedilmiştir: baskı hatası kaydı geri almaz, uyarı döner.
 * Fiş ekranlarıyla aynı yol (fisiYazdir): her belge nolu fiş 1 kopya, birden çok fiş (döviz satır başına) sırayla
 * (ortak alan denetimi 19.11.2026, #40 / #41).
 */
export async function fisiBas(b: KaydetBaglami, pageType: "sarraf" | "doviz" | "perakende", html: (bicim: "80" | "A4") => Promise<FisHtml | FisHtml[]>, baslik: string): Promise<string | null> {
  try {
    if (!yaziciOnbellek) yaziciOnbellek = await PrinterService.getYazicilar().catch(() => []);
    const r = resolveEffectivePrinter({ pageType, tip: b.tip, vezne: b.veri.vezne, user: b.kullanici.nesne, printers: yaziciOnbellek || [] });
    const pos = r.recommendedPrintType === "POS";
    const c = await html(pos ? "80" : "A4");
    // Tek fişte iş başlığı eskisi gibi; çok fişte her fişin kendi başlığı (belge no) kalır
    const fisler = Array.isArray(c) ? c.map((f) => ({ ...f, baslik: f.baslik || baslik })) : { ...c, baslik };
    const s = await fisiYazdir(fisler, { printerName: r.printer?.cihazAdi || r.printer?.ad || null, copies: 1, isPos: pos });
    return s.success ? null : `Fiş kaydedildi ancak yazdırılamadı: ${s.message}`;
  } catch (e: any) {
    return `Fiş kaydedildi ancak yazdırılamadı: ${e?.message || "bilinmeyen hata"}`;
  }
}
