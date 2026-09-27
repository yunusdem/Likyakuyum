import { YaziciItem } from "../services/printerService";
import { VezneItem } from "../services/cashDeskService";
import { UserProfileDto } from "../services/userService";

export interface ResolvePrinterOptions {
  pageType: "sarraf" | "doviz" | "perakende";
  tip: number; // 0: Alış, 1: Satış
  vezne?: any;
  user?: UserProfileDto | { printerId?: string } | null;
  printers: YaziciItem[];
}

export interface ResolvedPrinterResult {
  printer: YaziciItem | null;
  printerId: number | null;
  printerName: string;
  source:
    | "vezne_altin_alis"
    | "vezne_altin_satis"
    | "vezne_alis"
    | "vezne_satis"
    | "kullanici"
    | "varsayilan"
    | "yok";
  sourceLabel: string;
  kopyaSayisi: number;
  recommendedPrintType: "A4" | "POS";
}

/**
 * Resolves the active printer based on business rules:
 * - Perakende Fişi: Kullanıcı Tanımlarındaki (currentUser.printerId) yazıcı.
 * - Sarraf Fişi (Alış): Vezne Tanımlarındaki Altın Alış Yazıcısı veya Alış Yazıcısı.
 * - Sarraf Fişi (Satış): Vezne Tanımlarındaki Altın Satış Yazıcısı veya Satış Yazıcısı.
 * - Döviz Fişi (Alış): Vezne Tanımlarındaki Alış Yazıcısı.
 * - Döviz Fişi (Satış): Vezne Tanımlarındaki Satış Yazıcısı.
 */
export function resolveEffectivePrinter(options: ResolvePrinterOptions): ResolvedPrinterResult {
  const { pageType, tip, vezne, user, printers } = options;
  const isSatis = Number(tip) === 1;
  const isAlis = Number(tip) === 0;

  let targetId: number | null = null;
  let source: ResolvedPrinterResult["source"] = "yok";
  let sourceLabel = "Tanımlı Yazıcı Yok";

  if (pageType === "perakende") {
    // Perakende Fişi: Doğrudan kullanıcı tanımlarındaki yazıcıyı kullanır
    if (user?.printerId) {
      const parsed = parseInt(String(user.printerId), 10);
      if (!isNaN(parsed) && parsed > 0) {
        targetId = parsed;
        source = "kullanici";
        sourceLabel = "Kullanıcı Tanımı Yazıcısı";
      }
    }
  } else if (pageType === "sarraf") {
    // Sarraf Fişi: Alışta vezne altın alış/alış yazıcısı, satışta vezne altın satış/satış yazıcısı
    if (isAlis) {
      if (vezne?.altinAlisFisiYaziciId) {
        targetId = Number(vezne.altinAlisFisiYaziciId);
        source = "vezne_altin_alis";
        sourceLabel = "Vezne Altın Alış Yazıcısı";
      } else if (vezne?.alisFisiYaziciId) {
        targetId = Number(vezne.alisFisiYaziciId);
        source = "vezne_alis";
        sourceLabel = "Vezne Alış Yazıcısı";
      }
    } else if (isSatis) {
      if (vezne?.altinSatisFisiYaziciId) {
        targetId = Number(vezne.altinSatisFisiYaziciId);
        source = "vezne_altin_satis";
        sourceLabel = "Vezne Altın Satış Yazıcısı";
      } else if (vezne?.satisFisiYaziciId) {
        targetId = Number(vezne.satisFisiYaziciId);
        source = "vezne_satis";
        sourceLabel = "Vezne Satış Yazıcısı";
      }
    }
    // Veznede belirtilmemişse kullanıcı yazıcısına fallback
    if (!targetId && user?.printerId) {
      const parsed = parseInt(String(user.printerId), 10);
      if (!isNaN(parsed) && parsed > 0) {
        targetId = parsed;
        source = "kullanici";
        sourceLabel = "Kullanıcı Tanımı Yazıcısı";
      }
    }
  } else if (pageType === "doviz") {
    // Döviz Fişi: Alışta vezne alış yazıcısı, satışta vezne satış yazıcısı
    if (isAlis && vezne?.alisFisiYaziciId) {
      targetId = Number(vezne.alisFisiYaziciId);
      source = "vezne_alis";
      sourceLabel = "Vezne Döviz Alış Yazıcısı";
    } else if (isSatis && vezne?.satisFisiYaziciId) {
      targetId = Number(vezne.satisFisiYaziciId);
      source = "vezne_satis";
      sourceLabel = "Vezne Döviz Satış Yazıcısı";
    }
    // Veznede belirtilmemişse kullanıcı yazıcısına fallback
    if (!targetId && user?.printerId) {
      const parsed = parseInt(String(user.printerId), 10);
      if (!isNaN(parsed) && parsed > 0) {
        targetId = parsed;
        source = "kullanici";
        sourceLabel = "Kullanıcı Tanımı Yazıcısı";
      }
    }
  }

  // Match targetId with printers list
  let matched: YaziciItem | null = null;
  if (targetId && printers.length > 0) {
    matched = printers.find((p) => p.id === targetId || p.siraNo === targetId) || null;
  }

  if (!matched && printers.length > 0) {
    matched = printers.find((p) => p.siraNo === 1 || p.id === 1) || printers[0];
    if (matched && source === "yok") {
      source = "varsayilan";
      sourceLabel = "Varsayılan Sistem Yazıcısı";
    }
  }

  const kopyaSayisi =
    matched?.kopyaSayisi && Number(matched.kopyaSayisi) > 0 ? Number(matched.kopyaSayisi) : 1;

  // Mod 0 = Windows Sürücüsü (A4/A5), Mod 1/2 = ESC/POS & Ağ Termal Fiş
  const recommendedPrintType: "A4" | "POS" =
    matched?.belgeYaziciModu === 0 ? "A4" : "POS";

  return {
    printer: matched,
    printerId: matched?.id ?? targetId,
    printerName: matched?.ad || (targetId ? `Yazıcı #${targetId}` : "Varsayılan Yazıcı"),
    source,
    sourceLabel,
    kopyaSayisi,
    recommendedPrintType,
  };
}
