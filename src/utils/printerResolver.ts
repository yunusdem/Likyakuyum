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
    // Perakende Fişi: Vezne Tanımlarındaki Alış / Satış Yazıcısı, yoksa Kullanıcı Tanımı
    if (isAlis) {
      if (vezne?.alisFisiYaziciId) {
        targetId = Number(vezne.alisFisiYaziciId);
        source = "vezne_alis";
        sourceLabel = "Vezne Perakende Alış Yazıcısı";
      } else if (vezne?.altinAlisFisiYaziciId) {
        targetId = Number(vezne.altinAlisFisiYaziciId);
        source = "vezne_altin_alis";
        sourceLabel = "Vezne Alış Yazıcısı";
      }
    } else {
      // Satış (varsayılan)
      if (vezne?.satisFisiYaziciId) {
        targetId = Number(vezne.satisFisiYaziciId);
        source = "vezne_satis";
        sourceLabel = "Vezne Perakende Satış Yazıcısı";
      } else if (vezne?.altinSatisFisiYaziciId) {
        targetId = Number(vezne.altinSatisFisiYaziciId);
        source = "vezne_altin_satis";
        sourceLabel = "Vezne Satış Yazıcısı";
      }
    }

    if (!targetId && user?.printerId) {
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
    // Veznede o yöne ait yazıcı bulunmadıysa, veznede tanımlı diğer yazıcıları kontrol et
    if (!targetId && vezne) {
      if (vezne.altinAlisFisiYaziciId) {
        targetId = Number(vezne.altinAlisFisiYaziciId);
        source = "vezne_altin_alis";
        sourceLabel = "Vezne Altın Alış Yazıcısı";
      } else if (vezne.altinSatisFisiYaziciId) {
        targetId = Number(vezne.altinSatisFisiYaziciId);
        source = "vezne_altin_satis";
        sourceLabel = "Vezne Altın Satış Yazıcısı";
      } else if (vezne.alisFisiYaziciId) {
        targetId = Number(vezne.alisFisiYaziciId);
        source = "vezne_alis";
        sourceLabel = "Vezne Alış Yazıcısı";
      } else if (vezne.satisFisiYaziciId) {
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
    if (!targetId && vezne) {
      if (vezne.alisFisiYaziciId) {
        targetId = Number(vezne.alisFisiYaziciId);
        source = "vezne_alis";
        sourceLabel = "Vezne Alış Yazıcısı";
      } else if (vezne.satisFisiYaziciId) {
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
  }

  // Vezne nesnesinde doğrudan gelen yazıcı veya aygıt adını tespit et
  const directVezneName =
    (isAlis ? (vezne?.altinAlisFisiCihazAdi || vezne?.altinAlisFisiYaziciAdi || vezne?.alisFisiCihazAdi || vezne?.alisFisiYaziciAdi) : null) ||
    (isSatis ? (vezne?.altinSatisFisiCihazAdi || vezne?.altinSatisFisiYaziciAdi || vezne?.satisFisiCihazAdi || vezne?.satisFisiYaziciAdi) : null) ||
    vezne?.altinAlisFisiCihazAdi || vezne?.altinAlisFisiYaziciAdi ||
    vezne?.altinSatisFisiCihazAdi || vezne?.altinSatisFisiYaziciAdi ||
    vezne?.alisFisiCihazAdi || vezne?.alisFisiYaziciAdi ||
    vezne?.satisFisiCihazAdi || vezne?.satisFisiYaziciAdi || null;

  // Match targetId with printers list
  let matched: YaziciItem | null = null;
  if (targetId && printers.length > 0) {
    matched =
      printers.find(
        (p) =>
          Number(p.id) === Number(targetId) ||
          Number(p.siraNo) === Number(targetId) ||
          (directVezneName && p.ad?.toLowerCase() === directVezneName.toLowerCase()) ||
          (directVezneName && p.cihazAdi?.toLowerCase() === directVezneName.toLowerCase()) ||
          String(p.cihazAdi || "").toLowerCase() === String(targetId).toLowerCase()
      ) || null;
  }

  // Veznede kayıtlı yazıcı adı doğrudan mevcutsa onu kullan
  if (!matched && directVezneName) {
    matched = {
      id: targetId || 1,
      siraNo: targetId || 1,
      ad: directVezneName,
      cihazAdi: directVezneName,
      baglantiNoktasi: null,
      belgeYaziciModu: 1, // POS Termal
      belgeYaziciDizini: null,
      kopyaSayisi: 1,
    };
    if (source === "yok") {
      source = isAlis ? "vezne_altin_alis" : "vezne_altin_satis";
      sourceLabel = `Vezne Tanımlı Yazıcı (${directVezneName})`;
    }
  }

  if (!matched && printers.length > 0) {
    matched = printers.find((p) => Number(p.siraNo) === 1 || Number(p.id) === 1) || printers[0];
    if (matched && source === "yok") {
      source = "varsayilan";
      sourceLabel = "Varsayılan Sistem Yazıcısı";
    }
  }

  // Vezne tanımlarında yazıcı olsa bile veritabanı eşleşmesi yoksa veya liste boşsa, bu bilgisayara ait kayıtlı yazıcıyı al
  if (!matched && typeof localStorage !== "undefined") {
    const localLast =
      localStorage.getItem("likya_terminal_last_printer") ||
      localStorage.getItem("likya_last_selected_printer") ||
      "POS-80C";
    if (localLast) {
      matched = {
        id: targetId ? Number(targetId) : 1,
        siraNo: targetId ? Number(targetId) : 1,
        ad: localLast,
        cihazAdi: localLast,
        baglantiNoktasi: null,
        belgeYaziciModu: 1,
        belgeYaziciDizini: null,
        kopyaSayisi: 1,
      };
      if (source === "yok") {
        source = "varsayilan";
        sourceLabel = "Bu Bilgisayarın Tanımlı Yazıcısı";
      }
    }
  }

  const kopyaSayisi =
    matched?.kopyaSayisi && Number(matched.kopyaSayisi) > 0 ? Number(matched.kopyaSayisi) : 1;

  // Mod 0 = Windows Sürücüsü (A4/A5), Mod 1/2 = ESC/POS & Ağ Termal Fiş
  const recommendedPrintType: "A4" | "POS" =
    matched?.belgeYaziciModu === 0 ? "A4" : "POS";

  const finalName =
    matched?.cihazAdi ||
    matched?.ad ||
    directVezneName ||
    (targetId ? `Yazıcı #${targetId}` : "POS-80C");

  return {
    printer: matched,
    printerId: matched?.id ?? targetId,
    printerName: finalName,
    source,
    sourceLabel,
    kopyaSayisi,
    recommendedPrintType,
  };
}
