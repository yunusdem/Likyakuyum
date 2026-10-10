import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Card,
  Row,
  Col,
  Form,
  Button,
  Badge,
  Alert,
  Spinner,
  Modal,
  InputGroup,
} from "react-bootstrap";
import {
  IconChartLine,
  IconSearch,
  IconClock,
  IconCalendar,
  IconCheck,
  IconAlertCircle,
  IconFilter,
  IconX,
  IconCopy,
  IconArrowBackUp,
  IconExternalLink,
  IconArchive,
  IconDeviceFloppy,
  IconRefresh,
  IconCalculator,
  IconSparkles,
  IconPrinter,
} from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import LookupModal from "../../components/common/LookupModal";
import {
  KurService,
  KurTablosuItem,
  KurRowItem,
  StoredKurDateItem,
} from "../../services/kurService";
import { CompanyService, TodvzTanimDto } from "../../services/companyService";
import { printReportTable } from "../../utils/printReport";
import { onlyDecimal, blockNonNumericKeys } from "../../utils/numericInput";

export type KurPageType = "anlik" | "saklanan";

interface KurFiyatListesiPageProps {
  pageType?: KurPageType;
}

const EDITABLE_COLS = [
  "dovizAlis",
  "dovizSatis",
  "efektifAlis",
  "efektifSatis",
] as const;

type EditableCol = (typeof EDITABLE_COLS)[number];

const DEFAULT_COL_WIDTHS = {
  num: 40,
  kod: 65,
  ad: 175,
  dovizAlis: 115,
  dovizSatis: 115,
  efektifAlis: 118,
  efektifSatis: 118,
  parite: 95,
};
type ColKey = keyof typeof DEFAULT_COL_WIDTHS;

// Satırlardaki en uzun yazı veya sayısal veriye göre optimum sütun genişliğini otomatik hesaplar
export const calculateAutoFitWidths = (
  rowsList: KurRowItem[],
  decimals = 6
): Record<ColKey, number> => {
  if (!rowsList || rowsList.length === 0) return DEFAULT_COL_WIDTHS;

  let maxKodChars = 3; // "Kod"
  let maxAdChars = 2; // "Ad"
  let maxDovizAlisChars = 11; // "Döviz alış"
  let maxDovizSatisChars = 11; // "Döviz satış"
  let maxEfektifAlisChars = 13; // "Efektif alış"
  let maxEfektifSatisChars = 13; // "Efektif satış"
  let maxPariteChars = 6; // "Parite"

  rowsList.forEach((r) => {
    if (r.kod && r.kod.length > maxKodChars) maxKodChars = r.kod.length;
    if (r.ad && r.ad.length > maxAdChars) maxAdChars = r.ad.length;

    const daStr = r.dovizAlis !== null && r.dovizAlis !== undefined ? r.dovizAlis.toFixed(decimals) : "";
    if (daStr.length > maxDovizAlisChars) maxDovizAlisChars = daStr.length;

    const dsStr = r.dovizSatis !== null && r.dovizSatis !== undefined ? r.dovizSatis.toFixed(decimals) : "";
    if (dsStr.length > maxDovizSatisChars) maxDovizSatisChars = dsStr.length;

    const eaStr = r.efektifAlis !== null && r.efektifAlis !== undefined ? r.efektifAlis.toFixed(decimals) : "";
    if (eaStr.length > maxEfektifAlisChars) maxEfektifAlisChars = eaStr.length;

    const esStr = r.efektifSatis !== null && r.efektifSatis !== undefined ? r.efektifSatis.toFixed(decimals) : "";
    if (esStr.length > maxEfektifSatisChars) maxEfektifSatisChars = esStr.length;

    const pStr = r.parite !== null && r.parite !== undefined ? r.parite.toFixed(decimals) : "";
    if (pStr.length > maxPariteChars) maxPariteChars = pStr.length;
  });

  return {
    num: 40,
    kod: Math.max(60, maxKodChars * 11 + 22),
    ad: Math.max(145, Math.min(350, maxAdChars * 8.5 + 26)),
    dovizAlis: Math.max(110, maxDovizAlisChars * 9.5 + 22),
    dovizSatis: Math.max(110, maxDovizSatisChars * 9.5 + 22),
    efektifAlis: Math.max(115, maxEfektifAlisChars * 9.5 + 22),
    efektifSatis: Math.max(115, maxEfektifSatisChars * 9.5 + 22),
    parite: Math.max(90, maxPariteChars * 9.5 + 22),
  };
};

// TL / TRY para birimi kur işlemlerinde hiç gözükmez, yerel para birimi olduğu için sabittir
export const isTlCurrency = (code?: string, name?: string) => {
  const c = (code || "").trim().toUpperCase();
  const n = (name || "").trim().toUpperCase();
  return (
    c === "TL" ||
    c === "TRY" ||
    c === "YTL" ||
    c === "TL." ||
    c === "TRL" ||
    c.startsWith("TL") ||
    n.includes("TÜRK LİRASI") ||
    n.includes("TURK LIRASI") ||
    n.includes("TÜRK LIRA") ||
    n.includes("TURK LIRA") ||
    n.includes("YEREL") ||
    n === "TL" ||
    n === "TRY" ||
    n === "LİRA" ||
    n === "LIRA"
  );
};

export const sortKurRows = (items?: KurRowItem[]): KurRowItem[] => {
  if (!items) return [];
  // TL / TRY para birimi kur listelerinde (Anlık ve Saklanan Fiyat Listesi) kesinlikle gözükmez
  return [...items]
    .filter((r) => !isTlCurrency(r.kod, r.ad))
    .sort((a, b) => (Number(a.paraId) || 0) - (Number(b.paraId) || 0));
};

export const KurFiyatListesiPage: React.FC<KurFiyatListesiPageProps> = ({
  pageType: propPageType,
}) => {
  const location = useLocation();
  const navigate = useNavigate();

  // Determine effective page type from prop or current URL path: anlik veya saklanan
  const effectivePageType: KurPageType =
    propPageType === "saklanan" || location.pathname.includes("saklanan")
      ? "saklanan"
      : "anlik";

  // TUR:
  // - A: Anlık Fiyat Listesi (Gişe Kuru) -> TUR = 0
  // - B: Saklanan Fiyat Listesi (Tarihsel Kur Arşivi) -> TUR = 2
  const tur = effectivePageType === "anlik" ? 0 : 2;

  // Window / Page titles
  const pageTitle =
    effectivePageType === "anlik"
      ? "A- Anlık Fiyat Listesi"
      : "B- Saklanan Fiyat Listesi";

  const windowTitle =
    effectivePageType === "anlik"
      ? "Gişe kuru"
      : "Saklanan Fiyat Listesi";

  // Date & Time helpers for current moment
  const getCurrentDateStr = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const getCurrentTimeStr = () => {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");
    return `${h}:${min}`;
  };

  // Real-time live clock for Anlık Fiyat Listesi
  const [currentClock, setCurrentClock] = useState<Date>(new Date());

  useEffect(() => {
    if (effectivePageType === "anlik") {
      const timer = setInterval(() => {
        const now = new Date();
        setCurrentClock(now);
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, "0");
        const d = String(now.getDate()).padStart(2, "0");
        setTarih(`${y}-${m}-${d}`);
        const h = String(now.getHours()).padStart(2, "0");
        const min = String(now.getMinutes()).padStart(2, "0");
        setSaat(`${h}:${min}`);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [effectivePageType]);

  const liveDateStr = currentClock.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const liveTimeStr = currentClock.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  // Data states
  const [tabloId, setTabloId] = useState<number>(0);
  const [kapanisKurTablosuId, setKapanisKurTablosuId] = useState<number | null>(null);
  const [tarih, setTarih] = useState<string>(getCurrentDateStr);
  const [saat, setSaat] = useState<string>(getCurrentTimeStr);
  const [rows, setRows] = useState<KurRowItem[]>([]);
  const [rawInputs, setRawInputs] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [lastSavedZaman, setLastSavedZaman] = useState<string>("");

  // Firma Tanımları ve Basamak Sayıları
  const [companyDefinitions, setCompanyDefinitions] = useState<TodvzTanimDto | null>(null);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(0);

  // Firma Tanımlarından Kur Kuruş / Ondalık Basamak Sayısını Yükleme
  useEffect(() => {
    CompanyService.getDefinitions()
      .then((res) => {
        if (res) setCompanyDefinitions(res);
      })
      .catch((err) => console.error("Firma tanımları yüklenemedi:", err));
  }, []);

  const kurDecimals =
    companyDefinitions?.KUR_KURUS_SAYISI !== undefined &&
    companyDefinitions?.KUR_KURUS_SAYISI !== null
      ? Number(companyDefinitions.KUR_KURUS_SAYISI)
      : 6;

  const formatKurNumber = useCallback(
    (val: number | null | undefined): string => {
      if (val === null || val === undefined || isNaN(val) || val === 0) return "";
      return new Intl.NumberFormat("tr-TR", {
        minimumFractionDigits: kurDecimals,
        maximumFractionDigits: kurDecimals,
      }).format(val);
    },
    [kurDecimals]
  );

  // Navigation for Saklanan & Günlük
  const [storedDates, setStoredDates] = useState<StoredKurDateItem[]>([]);
  const [selectedDateIdx, setSelectedDateIdx] = useState<number>(-1);

  // Copy to another date modal for Saklanan
  const [showCopyDateModal, setShowCopyDateModal] = useState<boolean>(false);
  const [copyTargetDate, setCopyTargetDate] = useState<string>(getCurrentDateStr);

  // UI status
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isArchiving, setIsArchiving] = useState<boolean>(false);
  const [isTcmbLoading, setIsTcmbLoading] = useState<boolean>(false);
  const [statusText, setStatusText] = useState<string>("Son kayıt");
  const [alertSuccess, setAlertSuccess] = useState<string | null>(null);
  const [alertError, setAlertError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [showSearchModal, setShowSearchModal] = useState<boolean>(false);

  // Active cell tracking
  const [activeCell, setActiveCell] = useState<{ row: number; col: EditableCol } | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Column Widths with local persistence
  const [colWidths, setColWidths] = useState<Record<ColKey, number>>(() => {
    try {
      const saved = localStorage.getItem("kur_fiyat_listesi_col_widths_v2");
      if (saved) return { ...DEFAULT_COL_WIDTHS, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_COL_WIDTHS;
  });

  // Sağ tık Context Menu
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    rowIndex?: number;
    colKey?: EditableCol;
  } | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent, rowIdx?: number, col?: EditableCol) => {
    e.preventDefault();
    e.stopPropagation();
    if (rowIdx !== undefined) {
      setSelectedRowIndex(rowIdx);
      if (col) setActiveCell({ row: rowIdx, col });
    }
    const menuWidth = 240;
    const menuHeight = 290;
    const x = e.clientX + menuWidth > window.innerWidth ? window.innerWidth - menuWidth - 10 : e.clientX;
    const y = e.clientY + menuHeight > window.innerHeight ? window.innerHeight - menuHeight - 10 : e.clientY;
    setContextMenu({
      visible: true,
      x: Math.max(10, x),
      y: Math.max(10, y),
      rowIndex: rowIdx,
      colKey: col,
    });
  }, []);

  useEffect(() => {
    const closeMenu = () => {
      if (contextMenu?.visible) setContextMenu(null);
    };
    window.addEventListener("click", closeMenu);
    window.addEventListener("contextmenu", closeMenu);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("contextmenu", closeMenu);
    };
  }, [contextMenu]);

  const resizingRef = useRef<{
    colKey: ColKey;
    startX: number;
    startWidth: number;
  } | null>(null);

  const handleResizeStart = (e: React.MouseEvent, colKey: ColKey) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = {
      colKey,
      startX: e.clientX,
      startWidth: colWidths[colKey] || DEFAULT_COL_WIDTHS[colKey],
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const activeResize = resizingRef.current;
      if (!activeResize) return;
      const targetKey = activeResize.colKey;
      const diff = moveEvent.clientX - activeResize.startX;
      const newWidth = Math.max(35, activeResize.startWidth + diff);
      setColWidths((prev) => {
        const updated = { ...prev, [targetKey]: newWidth };
        try {
          localStorage.setItem("kur_fiyat_listesi_col_widths_v2", JSON.stringify(updated));
        } catch {}
        return updated;
      });
    };

    const handleMouseUp = () => {
      resizingRef.current = null;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const scrollRowIntoView = (rIdx: number) => {
    setTimeout(() => {
      const el = document.getElementById(`kur-grid-row-${rIdx}`);
      if (el) {
        el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }, 10);
  };

  const formatDisplayNumber = (val: number | null | undefined, decimals = 6): string => {
    if (val === null || val === undefined || isNaN(val) || val === 0) return "";
    return val.toFixed(decimals);
  };

  const formatDisplayDateTime = (isoStr?: string | null): string => {
    if (!isoStr) return "";
    try {
      const dt = new Date(isoStr);
      const d = String(dt.getDate()).padStart(2, "0");
      const m = String(dt.getMonth() + 1).padStart(2, "0");
      const y = dt.getFullYear();
      const h = String(dt.getHours()).padStart(2, "0");
      const min = String(dt.getMinutes()).padStart(2, "0");
      const s = String(dt.getSeconds()).padStart(2, "0");
      return `${d}.${m}.${y} ${h}:${min}:${s}`;
    } catch {
      return isoStr;
    }
  };

  const formatDisplayDateOnly = (dateStr?: string | null): string => {
    if (!dateStr) return "";
    try {
      const parts = dateStr.split("T")[0].split("-");
      if (parts.length === 3) {
        return `${parts[2]}.${parts[1]}.${parts[0]}`;
      }
      const dt = new Date(dateStr);
      const d = String(dt.getDate()).padStart(2, "0");
      const m = String(dt.getMonth() + 1).padStart(2, "0");
      const y = dt.getFullYear();
      return `${d}.${m}.${y}`;
    } catch {
      return dateStr;
    }
  };

  const formatDisplayTimeOnly = (isoStr?: string | null): string => {
    if (!isoStr) return "";
    try {
      const dt = new Date(isoStr);
      const h = String(dt.getHours()).padStart(2, "0");
      const min = String(dt.getMinutes()).padStart(2, "0");
      const s = String(dt.getSeconds()).padStart(2, "0");
      return `${h}:${min}:${s}`;
    } catch {
      return isoStr;
    }
  };

  const getCellKey = (rowIndex: number, col: string) => `${rowIndex}_${col}`;

  // Load kur tablosu from API
  const loadTabloData = useCallback(
    async (params?: { tarih?: string; id?: number }) => {
      try {
        setIsLoading(true);
        setAlertError(null);

        if (effectivePageType === "anlik") {
          // A- Anlık Fiyat Listesi: TUR = 0
          const tablo = await KurService.getKurTablosu({ tur: 0 });
          if (tablo) {
            setTabloId(tablo.id);
            setKapanisKurTablosuId(tablo.kapanisKurTablosuId ?? null);
            // Tarih ve saat otomatik olarak şu anki tarih ve saat olacak
            setTarih(getCurrentDateStr());
            setSaat(getCurrentTimeStr());
            const sortedRows = sortKurRows(tablo.satirlar);
            setRows(sortedRows);

            // Kullanıcı özel genişlik kaydetmediyse verinin uzunluğuna göre sütunları otomatik boyutlandır
            if (!localStorage.getItem("kur_fiyat_listesi_col_widths_v2")) {
              setColWidths(calculateAutoFitWidths(sortedRows, kurDecimals));
            }

            // Verisi bulunmayan satırlar / hücreler boş olarak gelecek
            const initialInputs: Record<string, string> = {};
            sortedRows.forEach((r, idx) => {
              EDITABLE_COLS.forEach((col) => {
                const num = r[col];
                initialInputs[getCellKey(idx, col)] =
                  num !== null && num !== undefined && !isNaN(num) && num !== 0 ? num.toFixed(6) : "";
              });
            });
            setRawInputs(initialInputs);
            setLastSavedZaman(tablo.zaman);
            setIsDirty(false);
            setStatusText(tablo.id ? "Son kayıt" : "Yeni Kayıt");
          }
        } else {
          // B- Saklanan Fiyat Listesi: TUR = 2
          // "saklanan fiyatlarda bugünkü son kur gelir"
          const todayStr = getCurrentDateStr();
          const datesList = await KurService.getStoredDates(2);
          setStoredDates(datesList);

          let targetId = params?.id;
          let targetTarih = params?.tarih;

          // İlk açılışta veya parametre belirtilmediğinde: bugünkü son kur gelir
          if (!targetId && !targetTarih) {
            const todayItem = datesList.find((d) => d.tarih === todayStr);
            if (todayItem) {
              targetId = todayItem.id;
              targetTarih = todayItem.tarih;
              const idx = datesList.findIndex((d) => d.id === targetId);
              setSelectedDateIdx(idx >= 0 ? idx : datesList.length - 1);
            } else if (datesList.length > 0) {
              // Bugüne ait özel kapanış yoksa arşivdeki en son güne git
              const latest = datesList[datesList.length - 1];
              targetId = latest.id;
              targetTarih = latest.tarih;
              setSelectedDateIdx(datesList.length - 1);
            } else {
              targetTarih = todayStr;
            }
          } else if (targetId) {
            const idx = datesList.findIndex((d) => d.id === targetId);
            setSelectedDateIdx(idx >= 0 ? idx : -1);
          } else if (targetTarih) {
            const matched = datesList.find((d) => d.tarih === targetTarih);
            if (matched) {
              targetId = matched.id;
              const idx = datesList.findIndex((d) => d.id === targetId);
              setSelectedDateIdx(idx >= 0 ? idx : -1);
            }
          }

          let tablo = await KurService.getKurTablosu({
            tur: 2,
            tarih: targetTarih,
            id: targetId,
          });

          // Eğer bugünkü arşiv tablosu henüz açılmamışsa veya boşsa, bugünkü son kuru canlı gişe kurundan (TUR=0) getir
          if (
            targetTarih === todayStr &&
            (!tablo || !tablo.id || !tablo.satirlar || tablo.satirlar.every((s) => !s.dovizAlis && !s.dovizSatis))
          ) {
            const anlikTablo = await KurService.getKurTablosu({ tur: 0 });
            if (anlikTablo && anlikTablo.satirlar && anlikTablo.satirlar.length > 0) {
              tablo = {
                ...anlikTablo,
                id: 0,
                tur: 2,
                tarih: todayStr,
                zaman: anlikTablo.zaman || new Date().toISOString(),
              };
            }
          }

          if (tablo) {
            setTabloId(tablo.id);
            setTarih(tablo.tarih);
            const zDt = new Date(tablo.zaman);
            setSaat(
              `${String(zDt.getHours()).padStart(2, "0")}:${String(zDt.getMinutes()).padStart(2, "0")}`
            );
            const sortedRows = sortKurRows(tablo.satirlar);
            setRows(sortedRows);

            if (!localStorage.getItem("kur_fiyat_listesi_col_widths_v2")) {
              setColWidths(calculateAutoFitWidths(sortedRows, kurDecimals));
            }

            const initialInputs: Record<string, string> = {};
            sortedRows.forEach((r, idx) => {
              EDITABLE_COLS.forEach((col) => {
                const num = r[col];
                initialInputs[getCellKey(idx, col)] =
                  num !== null && num !== undefined && !isNaN(num) && num !== 0 ? num.toFixed(6) : "";
              });
            });
            setRawInputs(initialInputs);
            setStatusText(tablo.id ? `Saklanan Kayıt (ID: ${tablo.id})` : "Bugünkü Son Kur");
          }
        }
      } catch (err: any) {
        console.error("Kur tablosu yüklenirken hata:", err);
        setAlertError(err?.message || "Kur tablosu yüklenemedi.");
      } finally {
        setIsLoading(false);
      }
    },
    [effectivePageType]
  );

  useEffect(() => {
    loadTabloData();
  }, [loadTabloData]);

  // Handle cell input change
  const handleCellChange = (rowIndex: number, col: EditableCol, val: string) => {
    const cleanVal = onlyDecimal(val);
    const key = getCellKey(rowIndex, col);
    setRawInputs((prev) => ({ ...prev, [key]: cleanVal }));
    setIsDirty(true);

    const dotVal = cleanVal.replace(",", ".");
    const numVal = dotVal === "" ? null : parseFloat(dotVal);

    setRows((prev) => {
      const updated = [...prev];
      const targetRow = { ...updated[rowIndex], [col]: isNaN(numVal as number) ? null : numVal };
      updated[rowIndex] = targetRow;

      // Auto Parite Calculation if Efektif or Doviz rate changes
      const usdRow = updated.find((r) => r.kod.trim().toUpperCase() === "USD");
      const usdRate = usdRow ? usdRow.efektifAlis || usdRow.dovizAlis : null;

      if (col === "efektifAlis" || col === "dovizAlis" || col === "efektifSatis" || col === "dovizSatis") {
        if (targetRow.kod.trim().toUpperCase() === "USD") {
          targetRow.parite = 1.0;
          setRawInputs((p) => ({ ...p, [getCellKey(rowIndex, "parite")]: "1.000000" }));

          // USD değiştiğinde listedeki tüm diğer dövizlerin paritelerini yeniden hesapla
          const newUsdRate = targetRow.efektifAlis || targetRow.dovizAlis;
          if (newUsdRate && newUsdRate > 0) {
            updated.forEach((otherRow, otherIdx) => {
              if (otherRow.kod.trim().toUpperCase() !== "USD") {
                const otherRate = otherRow.efektifAlis || otherRow.dovizAlis;
                if (otherRate && otherRate > 0) {
                  const calculated = otherRate / newUsdRate;
                  otherRow.parite = calculated;
                  setRawInputs((p) => ({
                    ...p,
                    [getCellKey(otherIdx, "parite")]: calculated.toFixed(6),
                  }));
                }
              }
            });
          }
        } else if (usdRate && usdRate > 0) {
          const rowRate = targetRow.efektifAlis || targetRow.dovizAlis;
          if (rowRate && rowRate > 0) {
            const calculatedParite = rowRate / usdRate;
            targetRow.parite = calculatedParite;
            setRawInputs((p) => ({
              ...p,
              [getCellKey(rowIndex, "parite")]: calculatedParite.toFixed(6),
            }));
          }
        }
      }

      return updated;
    });

    setStatusText("Düzenleniyor...");
  };

  // Helper to focus and select cell
  const focusCell = (rIdx: number, targetCol: EditableCol) => {
    const key = getCellKey(rIdx, targetCol);
    const target = inputRefs.current[key];
    if (target) {
      target.focus();
      target.select();
      setActiveCell({ row: rIdx, col: targetCol });
      setSelectedRowIndex(rIdx);
      scrollRowIntoView(rIdx);
    }
  };

  // Sağa / ileriye git (Döviz Alış -> Döviz Satış -> Efektif Alış -> Efektif Satış -> Sonraki satır Döviz Alış)
  const moveToNextCell = (rIdx: number, cIdx: number) => {
    if (cIdx < EDITABLE_COLS.length - 1) {
      focusCell(rIdx, EDITABLE_COLS[cIdx + 1]);
    } else if (rIdx < rows.length - 1) {
      // En sona gelince entera basınca alt satırdaki Döviz Alış'a in
      focusCell(rIdx + 1, "dovizAlis");
    } else {
      // En son satırın son hücresindeyse ilk satırın Döviz Alış'ına dön
      focusCell(0, "dovizAlis");
    }
  };

  // Sola / geriye git
  const moveToPrevCell = (rIdx: number, cIdx: number) => {
    if (cIdx > 0) {
      focusCell(rIdx, EDITABLE_COLS[cIdx - 1]);
    } else if (rIdx > 0) {
      focusCell(rIdx - 1, EDITABLE_COLS[EDITABLE_COLS.length - 1]);
    }
  };

  // Keyboard Navigation inside the Data Grid
  const handleCellKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    col: EditableCol
  ) => {
    const colIndex = EDITABLE_COLS.indexOf(col);
    blockNonNumericKeys(e, true);

    if (e.key === "F12") {
      e.preventDefault();
      if (effectivePageType === "anlik") {
        handleAutoCalculateGoldRates();
      }
      return;
    }

    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      if (e.shiftKey) {
        moveToPrevCell(rowIndex, colIndex);
      } else {
        moveToNextCell(rowIndex, colIndex);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (rowIndex < rows.length - 1) {
        focusCell(rowIndex + 1, col);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (rowIndex > 0) {
        focusCell(rowIndex - 1, col);
      }
    } else if (e.key === "ArrowRight") {
      // "ilk sağa basınca yazı varsa sonuna birdaha basınca sağdaki ilgili gridie kayacak şekilde olacak."
      const input = e.currentTarget;
      const valLength = input.value.length;
      const start = input.selectionStart ?? 0;
      const end = input.selectionEnd ?? 0;

      // Hücre boşsa doğrudan sağdaki hücreye geç
      if (valLength === 0) {
        e.preventDefault();
        moveToNextCell(rowIndex, colIndex);
        return;
      }

      // Yazı var ama tümü seçiliyse veya imleç henüz sonda değilse:
      // İlk sağa basınca imleci yazının sonuna getir
      if (start !== valLength || end !== valLength) {
        e.preventDefault();
        input.setSelectionRange(valLength, valLength);
        return;
      }

      // İmleç zaten yazının en sonundaysa: bir daha basılınca sağdaki hücreye geç
      e.preventDefault();
      moveToNextCell(rowIndex, colIndex);
    } else if (e.key === "ArrowLeft") {
      const input = e.currentTarget;
      const valLength = input.value.length;
      const start = input.selectionStart ?? 0;
      const end = input.selectionEnd ?? 0;

      // Hücre boşsa doğrudan soldaki hücreye geç
      if (valLength === 0) {
        e.preventDefault();
        moveToPrevCell(rowIndex, colIndex);
        return;
      }

      // Yazı var ama tümü seçiliyse veya imleç henüz en başta değilse:
      // İlk sola basınca imleci yazının en başına getir
      if (start !== 0 || end !== 0) {
        e.preventDefault();
        input.setSelectionRange(0, 0);
        return;
      }

      // İmleç zaten yazının en başındaysa: bir daha basılınca soldaki hücreye geç
      e.preventDefault();
      moveToPrevCell(rowIndex, colIndex);
    }
  };

  // Save Kur Tablosu (F1 Kaydet / Sol Üst Kaydet Butonu)
  // Save Kur Tablosu (F1 Kaydet / Sol Üst Kaydet Butonu)
  const handleSave = async () => {
    try {
      setIsSaving(true);
      setAlertError(null);
      setAlertSuccess(null);

      // 1. Tarih & Saat Kontrolü
      if (!tarih || tarih.trim() === "") {
        setAlertError("Lütfen geçerli bir tarih seçiniz.");
        setIsSaving(false);
        return;
      }
      if (!saat || saat.trim() === "") {
        setAlertError("Lütfen geçerli bir saat giriniz (örn: 14:30).");
        setIsSaving(false);
        return;
      }

      // 2. Eksik veya yarım girilen kur alanları kontrolü
      const eksikAlanlar: string[] = [];
      let herhangiBirKurGirilmisMi = false;

      for (const r of rows) {
        const hasDovizAlis = r.dovizAlis !== null && r.dovizAlis !== undefined && Number(r.dovizAlis) > 0;
        const hasDovizSatis = r.dovizSatis !== null && r.dovizSatis !== undefined && Number(r.dovizSatis) > 0;
        const hasEfektifAlis = r.efektifAlis !== null && r.efektifAlis !== undefined && Number(r.efektifAlis) > 0;
        const hasEfektifSatis = r.efektifSatis !== null && r.efektifSatis !== undefined && Number(r.efektifSatis) > 0;
        const hasParite = r.parite !== null && r.parite !== undefined && Number(r.parite) > 0;

        if (hasDovizAlis || hasDovizSatis || hasEfektifAlis || hasEfektifSatis || hasParite) {
          herhangiBirKurGirilmisMi = true;
        }

        const label = `${r.kod}${r.ad ? ` (${r.ad})` : ""}`;

        // Alış girilip Satış boş bırakılmışsa veya tam tersi
        if (hasDovizAlis && !hasDovizSatis) {
          eksikAlanlar.push(`• [${label}]: 'Döviz Alış' girilmiş fakat 'Döviz Satış' boş bırakılmış.`);
        } else if (hasDovizSatis && !hasDovizAlis) {
          eksikAlanlar.push(`• [${label}]: 'Döviz Satış' girilmiş fakat 'Döviz Alış' boş bırakılmış.`);
        }

        if (hasEfektifAlis && !hasEfektifSatis) {
          eksikAlanlar.push(`• [${label}]: 'Efektif Alış' girilmiş fakat 'Efektif Satış' boş bırakılmış.`);
        } else if (hasEfektifSatis && !hasEfektifAlis) {
          eksikAlanlar.push(`• [${label}]: 'Efektif Satış' girilmiş fakat 'Efektif Alış' boş bırakılmış.`);
        }
      }

      if (eksikAlanlar.length > 0) {
        setAlertError(
          `Kayıt tamamlanamadı. Aşağıdaki alanlar eksik veya boş bırakılmış:\n${eksikAlanlar.join("\n")}`
        );
        setIsSaving(false);
        return;
      }

      if (!herhangiBirKurGirilmisMi) {
        setAlertError("Kayıt için en az bir para birimine ait kur fiyatı (Alış ve Satış) girilmelidir.");
        setIsSaving(false);
        return;
      }

      let combinedDateTime: Date;
      if (effectivePageType === "anlik") {
        combinedDateTime = new Date();
      } else {
        const [hours, minutes] = saat.split(":").map(Number);
        combinedDateTime = new Date(tarih);
        combinedDateTime.setHours(hours || 12, minutes || 0, 0, 0);
      }

      // Veritabanı NOT NULL kısıtlamalarına tam uyum için boş alanları 0 olarak hazırlıyoruz
      const satirlarPayload = rows.map((r) => ({
        paraId: r.paraId,
        dovizAlis: r.dovizAlis !== null && r.dovizAlis !== undefined && !isNaN(Number(r.dovizAlis)) ? Number(r.dovizAlis) : 0,
        dovizSatis: r.dovizSatis !== null && r.dovizSatis !== undefined && !isNaN(Number(r.dovizSatis)) ? Number(r.dovizSatis) : 0,
        efektifAlis: r.efektifAlis !== null && r.efektifAlis !== undefined && !isNaN(Number(r.efektifAlis)) ? Number(r.efektifAlis) : 0,
        efektifSatis: r.efektifSatis !== null && r.efektifSatis !== undefined && !isNaN(Number(r.efektifSatis)) ? Number(r.efektifSatis) : 0,
        parite: r.parite !== null && r.parite !== undefined && !isNaN(Number(r.parite)) ? Number(r.parite) : 0,
      }));

      const result = await KurService.saveKurTablosu({
        id: tabloId > 0 ? tabloId : null,
        tur,
        zaman: combinedDateTime.toISOString(),
        satirlar: satirlarPayload,
      });

      setTabloId(result.id);
      setKapanisKurTablosuId(result.kapanisKurTablosuId ?? null);
      const sortedResultRows = sortKurRows(result.satirlar);
      setRows(sortedResultRows);

      // Hücre girdilerini kaydedilen güncel değerlerle senkronize et
      const updatedInputs: Record<string, string> = {};
      sortedResultRows.forEach((r, idx) => {
        EDITABLE_COLS.forEach((col) => {
          const num = r[col];
          updatedInputs[getCellKey(idx, col)] =
            num !== null && num !== undefined && !isNaN(num) && num !== 0 ? num.toFixed(6) : "";
        });
      });
      setRawInputs(updatedInputs);

      setLastSavedZaman(result.zaman);
      setIsDirty(false);
      setStatusText(effectivePageType === "anlik" ? "Son kayıt" : `Saklanan Kayıt (ID: ${result.id})`);
      const savedTimeDisplay =
        effectivePageType === "anlik"
          ? new Date(result.zaman).toLocaleTimeString("tr-TR")
          : saat;
      setAlertSuccess(
        effectivePageType === "anlik"
          ? `Gişede o an işlem gören canlı kurlar ve saati (${savedTimeDisplay}) başarıyla kaydedildi.`
          : "Kur tablosu başarıyla kaydedildi."
      );
      setTimeout(() => setAlertSuccess(null), 3500);

      if (effectivePageType === "saklanan") {
        const updatedDates = await KurService.getStoredDates(2);
        setStoredDates(updatedDates);
      }
    } catch (err: any) {
      console.error("Kaydetme hatası:", err);
      let errMsg = err?.message || "Kur tablosu kaydedilemedi.";
      if (errMsg.includes("DOVIZ_SATIS") && errMsg.includes("NULL")) {
        errMsg = "Döviz Satış kuru boş bırakılamaz. Lütfen ilgili para birimlerinin satış kurlarını doldurunuz.";
      } else if (errMsg.includes("DOVIZ_ALIS") && errMsg.includes("NULL")) {
        errMsg = "Döviz Alış kuru boş bırakılamaz. Lütfen ilgili para birimlerinin alış kurlarını doldurunuz.";
      } else if (errMsg.includes("Cannot insert the value NULL")) {
        errMsg = "Kur satırlarında zorunlu alanlar boş geçilemez. Lütfen girilen kur fiyatlarını kontrol ediniz.";
      } else if (errMsg.includes("Kur tablosu sistemde kayıtlı")) {
        errMsg = "Bu tarih ve türe ait bir kur tablosu sistemde zaten kayıtlı.";
      } else if (errMsg.includes("Kur tablosu güncellenemedi")) {
        errMsg = "Kur tablosu güncellenemedi. Lütfen bağlantınızı kontrol edip tekrar deneyiniz.";
      }
      setAlertError(errMsg);
    } finally {
      setIsSaving(false);
    }
  };

  // Hesap makinesinden "Kaydet" tetiklendiğinde otomatik kaydetme
  useEffect(() => {
    const handleCalculatorSave = () => {
      setTimeout(() => {
        handleSave();
      }, 120);
    };
    window.addEventListener("calculator-save-requested", handleCalculatorSave);
    return () => window.removeEventListener("calculator-save-requested", handleCalculatorSave);
  }, [rows, tarih, saat]);

  // Kapanış Kur Tablosunu Anlık Kurlardan Oluştur / Sakla (TUR = 2, @KAYNAK_KUR_TABLOSU_ID = anlikTabloId)
  const handleCreateGunlukKapanisFromAnlik = async () => {
    try {
      setIsArchiving(true);
      setAlertError(null);
      setAlertSuccess(null);

      // 1. Get live active spot table (TUR = 0)
      const anlikTablo = await KurService.getKurTablosu({ tur: 0 });
      if (!anlikTablo || !anlikTablo.id) {
        setAlertError("Aktif Anlık Fiyat Listesi bulunamadı.");
        return;
      }

      // 2. Call SODVZ_KUR_TABLOSU_KAYDET with @TUR = 2 and @KAYNAK_KUR_TABLOSU_ID = anlikTablo.id
      const todayStr = new Date().toISOString();
      const kapanisTablo = await KurService.sakla({
        kaynakKurTablosuId: anlikTablo.id,
        targetTur: 2,
        zaman: todayStr,
      });

      setTabloId(kapanisTablo.id);
      setRows(sortKurRows(kapanisTablo.satirlar));
      setAlertSuccess(
        `Günün resmi kapanış kur tablosu anlık kurlardan başarıyla oluşturuldu! (ID: ${kapanisTablo.id})`
      );
      setStatusText(`Kapanış Oluşturuldu (ID: ${kapanisTablo.id})`);
      setTimeout(() => setAlertSuccess(null), 4000);
    } catch (err: any) {
      console.error("Kapanış oluşturma hatası:", err);
      setAlertError(err?.message || "Günün kapanış tablosu oluşturulamadı.");
    } finally {
      setIsArchiving(false);
    }
  };

  // C- Ekranı: Seçili Arşiv Kurunu Canlı / Anlık Listeye Geri Yükle (@TUR = 0, @KAYNAK_KUR_TABLOSU_ID = tabloId)
  const handleRestoreToAnlik = async () => {
    if (!tabloId) {
      setAlertError("Lütfen önce arşivden geçerli bir kur kaydı seçiniz.");
      return;
    }

    if (
      !window.confirm(
        `Seçili tarihteki (${tarih}) kurları aktif canlı ANLIK FİYAT LİSTESİ'ne kopyalayarak geri yüklemek istediğinize emin misiniz?`
      )
    ) {
      return;
    }

    try {
      setIsArchiving(true);
      setAlertError(null);
      setAlertSuccess(null);

      await KurService.sakla({
        kaynakKurTablosuId: tabloId,
        targetTur: 0,
      });

      setAlertSuccess(
        `Seçili ${tarih} tarihli kurlar canlı Anlık Fiyat Listesine başarıyla aktarıldı!`
      );
      setTimeout(() => setAlertSuccess(null), 4000);
    } catch (err: any) {
      console.error("Geri yükleme hatası:", err);
      setAlertError(err?.message || "Kurlar anlık listeye aktarılamadı.");
    } finally {
      setIsArchiving(false);
    }
  };

  // C- Ekranı: Seçili Arşiv Kurunu Başka Bir Güne Kopyala (@TUR = 2, @KAYNAK_KUR_TABLOSU_ID = tabloId, @ZAMAN = copyTargetDate)
  const handleCopyArchiveToTargetDate = async () => {
    if (!tabloId) {
      setAlertError("Lütfen arşivden kaynak bir kur kaydı seçiniz.");
      return;
    }
    if (!copyTargetDate) {
      setAlertError("Lütfen hedef bir tarih seçiniz.");
      return;
    }

    try {
      setIsArchiving(true);
      setAlertError(null);

      const targetCombinedDate = new Date(copyTargetDate);
      targetCombinedDate.setHours(12, 0, 0, 0);

      const copied = await KurService.sakla({
        kaynakKurTablosuId: tabloId,
        targetTur: 2,
        zaman: targetCombinedDate.toISOString(),
      });

      setShowCopyDateModal(false);
      setAlertSuccess(
        `Kurlar başarıyla ${copyTargetDate} tarihine kopyalandı! (Yeni Tablo ID: ${copied.id})`
      );
      setTimeout(() => setAlertSuccess(null), 4000);

      // Refresh dates list and load newly created date
      const updatedDates = await KurService.getStoredDates(2);
      setStoredDates(updatedDates);
      loadTabloData({ id: copied.id, tarih: copyTargetDate });
    } catch (err: any) {
      console.error("Tarihe kopyalama hatası:", err);
      setAlertError(err?.message || "Kurlar hedef tarihe kopyalanamadı.");
    } finally {
      setIsArchiving(false);
    }
  };

  // Delete / Reset (F2 Sil)
  const handleDelete = async () => {
    if (effectivePageType === "saklanan" && tabloId > 0) {
      if (window.confirm("Bu saklanan kur tablosunu silmek istediğinize emin misiniz?")) {
        try {
          setIsSaving(true);
          await KurService.deleteKurTablosu(tabloId);
          setAlertSuccess("Saklanan kur tablosu silindi.");
          setTimeout(() => setAlertSuccess(null), 3000);
          loadTabloData();
        } catch (err: any) {
          setAlertError(err?.message || "Kayıt silinemedi.");
        } finally {
          setIsSaving(false);
        }
      }
    } else {
      // Reset editable inputs on spot screen
      setRows((prev) =>
        prev.map((r, idx) => {
          EDITABLE_COLS.forEach((col) => {
            setRawInputs((p) => ({ ...p, [getCellKey(idx, col)]: "" }));
          });
          return {
            ...r,
            dovizAlis: null,
            dovizSatis: null,
            efektifAlis: null,
            efektifSatis: null,
            parite: r.kod.trim().toUpperCase() === "USD" ? 1.0 : null,
          };
        })
      );
      setStatusText("Kurlar temizlendi");
    }
  };

  // Focus Cell (F3 Hücre)
  const handleFocusCell = () => {
    const firstKey = getCellKey(0, EDITABLE_COLS[0]);
    inputRefs.current[firstKey]?.focus();
    inputRefs.current[firstKey]?.select();
  };

  // Jump to Efektif column (F5 Kolon)
  const handleJumpEfektif = () => {
    const firstEfKey = getCellKey(0, "efektifAlis");
    inputRefs.current[firstEfKey]?.focus();
    inputRefs.current[firstEfKey]?.select();
  };

  // Fetch TCMB Rates (F8 Merkez Bankası)
  const handleFetchTcmb = async () => {
    try {
      setIsTcmbLoading(true);
      setAlertError(null);

      const tcmbData = await KurService.fetchTcmb();
      if (!tcmbData || Object.keys(tcmbData).length === 0) {
        setAlertError("Merkez Bankası kurları alınamadı.");
        return;
      }

      setRows((prev) => {
        const updated = prev.map((r, idx) => {
          const code = r.kod.trim().toUpperCase();
          const tcmbRate = tcmbData[code];
          if (!tcmbRate) return r;

          const dovizAlis = tcmbRate.forexBuying ?? r.dovizAlis;
          const dovizSatis = tcmbRate.forexSelling ?? r.dovizSatis;
          const efektifAlis = tcmbRate.banknoteBuying ?? dovizAlis ?? r.efektifAlis;
          const efektifSatis = tcmbRate.banknoteSelling ?? dovizSatis ?? r.efektifSatis;

          setRawInputs((p) => ({
            ...p,
            [getCellKey(idx, "dovizAlis")]: dovizAlis !== null && dovizAlis !== undefined ? dovizAlis.toFixed(6) : "",
            [getCellKey(idx, "dovizSatis")]: dovizSatis !== null && dovizSatis !== undefined ? dovizSatis.toFixed(6) : "",
            [getCellKey(idx, "efektifAlis")]: efektifAlis !== null && efektifAlis !== undefined ? efektifAlis.toFixed(6) : "",
            [getCellKey(idx, "efektifSatis")]: efektifSatis !== null && efektifSatis !== undefined ? efektifSatis.toFixed(6) : "",
          }));

          return {
            ...r,
            dovizAlis,
            dovizSatis,
            efektifAlis,
            efektifSatis,
          };
        });

        // Recalculate parities based on USD
        const usdRow = updated.find((r) => r.kod.trim().toUpperCase() === "USD");
        const usdRate = usdRow ? usdRow.efektifAlis || usdRow.dovizAlis : null;

        if (usdRate && usdRate > 0) {
          updated.forEach((r, idx) => {
            if (r.kod.trim().toUpperCase() === "USD") {
              r.parite = 1.0;
              setRawInputs((p) => ({ ...p, [getCellKey(idx, "parite")]: "1.000000" }));
            } else {
              const rowRate = r.efektifAlis || r.dovizAlis;
              if (rowRate && rowRate > 0) {
                const par = rowRate / usdRate;
                r.parite = par;
                setRawInputs((p) => ({ ...p, [getCellKey(idx, "parite")]: par.toFixed(6) }));
              }
            }
          });
        }

        return updated;
      });

      setStatusText("Merkez Bankası kurları uygulandı");
      setAlertSuccess("TCMB güncel kurları başarıyla aktarıldı.");
      setTimeout(() => setAlertSuccess(null), 3000);
    } catch (err: any) {
      console.error("TCMB çekme hatası:", err);
      setAlertError(err?.message || "Merkez Bankası verisi alınamadı.");
    } finally {
      setIsTcmbLoading(false);
    }
  };

  // HAS Altın Fiyatına Göre Diğer Altın Kurlarını Otomatik Hesaplama
  const handleAutoCalculateGoldRates = () => {
    try {
      setAlertError(null);
      setAlertSuccess(null);

      // 1. Listedeki HAS altın satırını bul (kod === 'HAS' veya adı HAS ALTIN)
      let hasRowIdx = rows.findIndex((r) => r.kod?.trim().toUpperCase() === "HAS");
      if (hasRowIdx === -1) {
        hasRowIdx = rows.findIndex(
          (r) =>
            r.ad?.trim().toUpperCase() === "HAS ALTIN" ||
            r.ad?.trim().toUpperCase() === "HAS" ||
            r.kod?.trim().toUpperCase().startsWith("HAS")
        );
      }
      if (hasRowIdx === -1) {
        hasRowIdx = rows.findIndex(
          (r) =>
            r.kod?.trim().toUpperCase().includes("HAS") ||
            r.ad?.trim().toUpperCase().includes("HAS")
        );
      }

      if (hasRowIdx === -1) {
        setAlertError("Listede HAS altın (kod: HAS) bulunamadı. Lütfen ürün tanımlarını kontrol ediniz.");
        return;
      }

      // 2. HAS Fiyatlarını al (rawInputs veya row nesnesinden)
      const getVal = (rowIdx: number, col: EditableCol, fallback?: number | null): number | null => {
        const raw = rawInputs[getCellKey(rowIdx, col)];
        if (raw !== undefined && raw !== null && raw.trim() !== "") {
          const p = parseFloat(raw.replace(",", "."));
          if (!isNaN(p) && p > 0) return p;
        }
        if (fallback !== undefined && fallback !== null && !isNaN(fallback) && fallback > 0) {
          return fallback;
        }
        return null;
      };

      const hasRow = rows[hasRowIdx];
      const hasEfektifAlis = getVal(hasRowIdx, "efektifAlis", hasRow.efektifAlis);
      const hasEfektifSatis = getVal(hasRowIdx, "efektifSatis", hasRow.efektifSatis);
      const hasDovizAlis = getVal(hasRowIdx, "dovizAlis", hasRow.dovizAlis);
      const hasDovizSatis = getVal(hasRowIdx, "dovizSatis", hasRow.dovizSatis);

      const baseAlisEfektif = hasEfektifAlis ?? hasDovizAlis;
      const baseSatisEfektif = hasEfektifSatis ?? hasDovizSatis;
      const baseAlisDoviz = hasDovizAlis ?? hasEfektifAlis;
      const baseSatisDoviz = hasDovizSatis ?? hasEfektifSatis;

      if (!baseAlisEfektif && !baseSatisEfektif && !baseAlisDoviz && !baseSatisDoviz) {
        setAlertError("Lütfen önce Kayıtlı HAS altın için Alış veya Satış fiyatı giriniz.");
        return;
      }

      // Çarpan / Katsayı dönüştürücü:
      // Değer 10'dan büyükse (ör: 916, 585, 995, 1000) -> 1000'e bölünür (0.916, 0.585)
      // Değer 10 veya altındaysa (ör: 1.605, 0.916) -> doğrudan katsayı olarak kullanılır
      const getMultiplier = (val: number | null | undefined): number | null => {
        if (val === null || val === undefined || isNaN(val) || val <= 0) return null;
        return val > 10 ? val / 1000 : val;
      };

      const updatedRows = [...rows];
      const updatedRawInputs = { ...rawInputs };

      // HAS satırını güncel girilen fiyatlarla güncelle
      const currentHasRow = { ...hasRow };
      if (hasEfektifAlis) currentHasRow.efektifAlis = hasEfektifAlis;
      if (hasEfektifSatis) currentHasRow.efektifSatis = hasEfektifSatis;
      if (hasDovizAlis) currentHasRow.dovizAlis = hasDovizAlis;
      if (hasDovizSatis) currentHasRow.dovizSatis = hasDovizSatis;
      updatedRows[hasRowIdx] = currentHasRow;

      const usdRow = updatedRows.find((r) => r.kod.trim().toUpperCase() === "USD");
      const usdRate = usdRow ? usdRow.efektifAlis || usdRow.dovizAlis : null;

      const effAlisBase = baseAlisEfektif || (baseSatisEfektif ? baseSatisEfektif * 0.985 : 0);
      const effSatisBase = baseSatisEfektif || (baseAlisEfektif ? baseSatisEfektif * 1.015 : 0);
      const dovAlisBase = baseAlisDoviz || effAlisBase;
      const dovSatisBase = baseSatisDoviz || effSatisBase;

      let calculatedCount = 0;

      updatedRows.forEach((r, idx) => {
        // HAS altın satırının kendisini atla
        if (idx === hasRowIdx) return;

        // Sadece Ürün Tipi Altın (1) ve Ziynet (3) olan ürünler hesaplanır
        const rawUrunTipi = r.urunTipi !== undefined && r.urunTipi !== null ? r.urunTipi : (r as any).URUN_TIPI;
        const isAltin = rawUrunTipi !== undefined && rawUrunTipi !== null && (Number(rawUrunTipi) === 1 || Number(rawUrunTipi) === 3);

        if (!isAltin) {
          return;
        }

        // 1. Alış Has ve Satış Has değerleri kontrolü
        const rawAlis =
          r.hasAlisKatsayisi !== null && r.hasAlisKatsayisi !== undefined && Number(r.hasAlisKatsayisi) > 0
            ? Number(r.hasAlisKatsayisi)
            : (r as any).HAS_ALIS_KATSAYISI !== null && (r as any).HAS_ALIS_KATSAYISI !== undefined && Number((r as any).HAS_ALIS_KATSAYISI) > 0
            ? Number((r as any).HAS_ALIS_KATSAYISI)
            : (r as any).alisMilyem !== null && (r as any).alisMilyem !== undefined && Number((r as any).alisMilyem) > 0
            ? Number((r as any).alisMilyem)
            : (r as any).ALIS_MILYEM !== null && (r as any).ALIS_MILYEM !== undefined && Number((r as any).ALIS_MILYEM) > 0
            ? Number((r as any).ALIS_MILYEM)
            : r.hasOrani !== null && r.hasOrani !== undefined && Number(r.hasOrani) > 0
            ? Number(r.hasOrani)
            : (r as any).HAS_ORANI !== null && (r as any).HAS_ORANI !== undefined && Number((r as any).HAS_ORANI) > 0
            ? Number((r as any).HAS_ORANI)
            : (r as any).milyem !== null && (r as any).milyem !== undefined && Number((r as any).milyem) > 0
            ? Number((r as any).milyem)
            : null;

        const rawSatis =
          r.hasSatisKatsayisi !== null && r.hasSatisKatsayisi !== undefined && Number(r.hasSatisKatsayisi) > 0
            ? Number(r.hasSatisKatsayisi)
            : (r as any).HAS_SATIS_KATSAYISI !== null && (r as any).HAS_SATIS_KATSAYISI !== undefined && Number((r as any).HAS_SATIS_KATSAYISI) > 0
            ? Number((r as any).HAS_SATIS_KATSAYISI)
            : (r as any).satisMilyem !== null && (r as any).satisMilyem !== undefined && Number((r as any).satisMilyem) > 0
            ? Number((r as any).satisMilyem)
            : (r as any).SATIS_MILYEM !== null && (r as any).SATIS_MILYEM !== undefined && Number((r as any).SATIS_MILYEM) > 0
            ? Number((r as any).SATIS_MILYEM)
            : r.hasOrani !== null && r.hasOrani !== undefined && Number(r.hasOrani) > 0
            ? Number(r.hasOrani)
            : (r as any).HAS_ORANI !== null && (r as any).HAS_ORANI !== undefined && Number((r as any).HAS_ORANI) > 0
            ? Number((r as any).HAS_ORANI)
            : (r as any).milyem !== null && (r as any).milyem !== undefined && Number((r as any).milyem) > 0
            ? Number((r as any).milyem)
            : null;

        let alisMult = getMultiplier(rawAlis);
        let satisMult = getMultiplier(rawSatis);

        if (alisMult === null && satisMult !== null) alisMult = satisMult;
        if (satisMult === null && alisMult !== null) satisMult = alisMult;

        // Otomatik altın katsayısı tespiti (Hiçbir altın boş geçilmez)
        if (alisMult === null || satisMult === null) {
          const norm = ((r.kod || "") + " " + (r.ad || ""))
            .toUpperCase()
            .replace(/İ/g, "I")
            .replace(/ı/g, "i")
            .replace(/Ç/g, "C")
            .replace(/ç/g, "c")
            .replace(/Ş/g, "S")
            .replace(/ş/g, "s")
            .replace(/Ğ/g, "G")
            .replace(/ğ/g, "g")
            .replace(/Ü/g, "U")
            .replace(/ü/g, "u")
            .replace(/Ö/g, "O")
            .replace(/ö/g, "o");

          let defMult = 0.916; // Standart 22 ayar
          if (
            norm.includes("24") ||
            norm.includes("995") ||
            norm.includes("999") ||
            norm.includes("KULCE") ||
            norm.includes("HAS")
          ) {
            defMult = 1.0;
          } else if (
            norm.includes("22") ||
            norm.includes("916") ||
            norm.includes("BILEZIK") ||
            norm.includes("BURMA") ||
            norm.includes("KORDON")
          ) {
            defMult = 0.916;
          } else if (norm.includes("18") || norm.includes("750")) {
            defMult = 0.75;
          } else if (norm.includes("14") || norm.includes("585")) {
            defMult = 0.585;
          } else if (norm.includes("8") || norm.includes("333")) {
            defMult = 0.333;
          } else if (norm.includes("ATA 5") || norm.includes("BESLI") || norm.includes("5LI")) {
            defMult = 33.08;
          } else if (norm.includes("ATA 2.5") || norm.includes("IKIBUCUK") || norm.includes("2.5")) {
            defMult = norm.includes("GREMSE") ? 16.05 : 16.54;
          } else if (norm.includes("GREMSE")) {
            defMult = 16.05;
          } else if (norm.includes("ATA") || norm.includes("CUMHURIYET") || norm.includes("ATA LIRA")) {
            defMult = 6.615;
          } else if (norm.includes("CEYREK")) {
            defMult = 1.605;
          } else if (norm.includes("YARIM")) {
            defMult = 3.21;
          } else if (
            norm.includes("TAM") ||
            norm.includes("TEKLIK") ||
            norm.includes("LIRA") ||
            norm.includes("ZIYNET")
          ) {
            defMult = 6.42;
          } else if (norm.includes("RESAT") || norm.includes("HAMIT") || norm.includes("AZIZ")) {
            defMult = 6.615;
          } else if (norm.includes("HURDA")) {
            defMult = norm.includes("14")
              ? 0.585
              : norm.includes("18")
              ? 0.75
              : norm.includes("8")
              ? 0.333
              : 0.916;
          } else if (norm.includes("GUMUS") || norm.includes("SILVER") || norm.includes("925")) {
            defMult = 0.015;
          }

          if (alisMult === null) alisMult = defMult;
          if (satisMult === null) satisMult = defMult;
        }

        const newRow = { ...r };
        let isRowUpdated = false;

        // Sadece Efektif Alış ve Efektif Satış hesaplanır (Döviz Alış ve Döviz Satış kesinlikle hesaplanmaz / değiştirilmez)
        if (alisMult !== null && alisMult > 0) {
          if (effAlisBase > 0) {
            newRow.efektifAlis = Number((effAlisBase * alisMult).toFixed(kurDecimals));
            updatedRawInputs[getCellKey(idx, "efektifAlis")] = newRow.efektifAlis.toFixed(kurDecimals);
            isRowUpdated = true;
          }
        }

        // Satış hesaplama: (Satış Has / 1000) * HAS Efektif Satış
        if (satisMult !== null && satisMult > 0) {
          if (effSatisBase > 0) {
            newRow.efektifSatis = Number((effSatisBase * satisMult).toFixed(kurDecimals));
            updatedRawInputs[getCellKey(idx, "efektifSatis")] = newRow.efektifSatis.toFixed(kurDecimals);
            isRowUpdated = true;
          }
        }

        // Parite hesaplama (USD varsa)
        if (usdRate && usdRate > 0) {
          const rowRate = newRow.efektifAlis || newRow.efektifSatis || newRow.dovizAlis || newRow.dovizSatis;
          if (rowRate && rowRate > 0) {
            newRow.parite = Number((rowRate / usdRate).toFixed(6));
            updatedRawInputs[getCellKey(idx, "parite")] = newRow.parite.toFixed(6);
          }
        }

        if (isRowUpdated) {
          updatedRows[idx] = newRow;
          calculatedCount++;
        }
      });

      if (calculatedCount === 0) {
        setAlertError("Hesaplanacak altın ürünü bulunamadı.");
        return;
      }

      setRows(updatedRows);
      setRawInputs(updatedRawInputs);
      setIsDirty(true);
      setStatusText("Altın kurları hesaplandı (Kaydedilmedi)");
    } catch (err: any) {
      console.error("Altın kurları hesaplama hatası:", err);
      setAlertError("Altın kurları hesaplanırken bir hata oluştu: " + (err?.message || ""));
    }
  };

  // Copy to Clipboard (F9 Pano)
  const handleCopyPano = () => {
    const summary = rows
      .map(
        (r) =>
          `${r.kod}: Alış=${formatKurNumber(r.efektifAlis || r.dovizAlis) || "-"} Satış=${
            formatKurNumber(r.efektifSatis || r.dovizSatis) || "-"
          }`
      )
      .join("\n");
    navigator.clipboard.writeText(summary);
    setAlertSuccess("Kurlar panoya kopyalandı!");
    setTimeout(() => setAlertSuccess(null), 2500);
  };

  // Print Rate Sheet (F10 Yazıcı)
  const handlePrint = () => {
    printReportTable({
      title: `${pageTitle} (${tarih} ${saat})`,
      subtitle: `Kur Türü: ${windowTitle}`,
      data: rows,
      columns: [
        { header: "#", render: (_, i) => i + 1, width: "35px", align: "center" },
        { header: "Kod", key: "kod", width: "70px", align: "left" },
        { header: "Ad", key: "ad", width: "160px", align: "left" },
        {
          header: "Döviz Alış",
          render: (item) => formatKurNumber(item.dovizAlis),
          align: "right",
        },
        {
          header: "Döviz Satış",
          render: (item) => formatKurNumber(item.dovizSatis),
          align: "right",
        },
        {
          header: "Efektif Alış",
          render: (item) => formatKurNumber(item.efektifAlis),
          align: "right",
        },
        {
          header: "Efektif Satış",
          render: (item) => formatKurNumber(item.efektifSatis),
          align: "right",
        },
        {
          header: "Parite",
          render: (item) => formatKurNumber(item.parite),
          align: "right",
        },
      ],
    });
  };

  // Navigation handlers (|<<, <, >, >>|) for Saklanan
  const handleFirstDate = () => {
    if (storedDates.length === 0) return;
    const first = storedDates[0];
    setSelectedDateIdx(0);
    loadTabloData({ id: first.id, tarih: first.tarih });
  };

  const handlePrevDate = () => {
    if (storedDates.length === 0 || selectedDateIdx <= 0) return;
    const nextIdx = selectedDateIdx - 1;
    const target = storedDates[nextIdx];
    setSelectedDateIdx(nextIdx);
    loadTabloData({ id: target.id, tarih: target.tarih });
  };

  const handleNextDate = () => {
    if (storedDates.length === 0 || selectedDateIdx >= storedDates.length - 1) return;
    const nextIdx = selectedDateIdx + 1;
    const target = storedDates[nextIdx];
    setSelectedDateIdx(nextIdx);
    loadTabloData({ id: target.id, tarih: target.tarih });
  };

  const handleLastDate = () => {
    if (storedDates.length === 0) return;
    const lastIdx = storedDates.length - 1;
    const last = storedDates[lastIdx];
    setSelectedDateIdx(lastIdx);
    loadTabloData({ id: last.id, tarih: last.tarih });
  };

  // Search Modal açma handler'ı (Saklanan modunda güncel tarih listesini de çeker)
  const handleOpenSearchModal = async () => {
    if (effectivePageType === "saklanan") {
      try {
        const datesList = await KurService.getStoredDates(2);
        setStoredDates(datesList);
      } catch (e) {
        console.error("Saklanan tarihler yüklenemedi:", e);
      }
    }
    setShowSearchModal(true);
  };

  // Global Keyboard shortcuts listener (F1 - F10 & Arrow keys)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (showSearchModal || showCopyDateModal) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedRowIndex((prev) => (prev === null ? 0 : Math.min(prev + 1, rows.length - 1)));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedRowIndex((prev) => (prev === null ? 0 : Math.max(prev - 1, 0)));
      } else if (e.key === "F4") {
        e.preventDefault();
        handleOpenSearchModal();
      } else if (e.key === "F7") {
        e.preventDefault();
        if (effectivePageType === "anlik") {
          handleCreateGunlukKapanisFromAnlik();
        } else if (effectivePageType === "saklanan") {
          handleRestoreToAnlik();
        }
      } else if (e.key === "F8") {
        e.preventDefault();
        handleFetchTcmb();
      } else if (e.key === "F9") {
        e.preventDefault();
        handleCopyPano();
      } else if (e.key === "F10") {
        e.preventDefault();
        handlePrint();
      } else if (e.key === "F12") {
        e.preventDefault();
        if (effectivePageType === "anlik") {
          handleAutoCalculateGoldRates();
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [rows.length, showSearchModal, showCopyDateModal, effectivePageType, handleAutoCalculateGoldRates]);

  return (
    <div className="kuyumcu-kur-container w-100 pb-3" style={{ overflowX: "hidden" }}>
      {/* 1. Sol Üst Standart ERP Toolbar (Anlık Fiyat Listesi'nde Kaydetme Butonu Aktif, Saklanan'da Gezinme Aktif) */}
      <ERPToolbar
        hideNew={true}
        hideSave={effectivePageType !== "anlik"}
        hideDelete={true}
        hideNavigation={effectivePageType !== "saklanan"}
        onFirst={handleFirstDate}
        onPrev={handlePrevDate}
        onNext={handleNextDate}
        onLast={handleLastDate}
        onSave={handleSave}
        onSearch={handleOpenSearchModal}
        onPrint={handlePrint}
        onRefresh={() => loadTabloData({ id: tabloId, tarih })}
        disabled={isLoading || isSaving}
        pageTitle={pageTitle}
        rightContent={
          effectivePageType === "anlik" ? (
            <div className="d-flex align-items-center gap-2">
              <span className="fw-bold text-dark small">Zaman:</span>
              <div
                className="d-flex align-items-center gap-2 px-2.5 py-1 bg-white border rounded shadow-sm font-monospace text-dark fw-bold"
                style={{ fontSize: "0.85rem", letterSpacing: "0.5px" }}
                title="Anlık Sistem Zamanı"
              >
                <div className="d-flex align-items-center gap-1 text-dark">
                  <IconCalendar size={15} className="text-dark" />
                  <span className="text-dark">{liveDateStr}</span>
                </div>
                <span className="text-secondary opacity-50">|</span>
                <div className="d-flex align-items-center gap-1 text-dark">
                  <IconClock size={15} className="text-dark" />
                  <span className="text-dark">{liveTimeStr}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="d-flex align-items-center gap-2">
              <span className="fw-bold text-secondary small">Zaman:</span>

              {/* Date Input */}
              <InputGroup size="sm" style={{ width: "140px" }}>
                <InputGroup.Text className="bg-light px-2">
                  <IconCalendar size={14} className="text-primary" />
                </InputGroup.Text>
                <Form.Control
                  type="date"
                  value={tarih}
                  onChange={(e) => {
                    setTarih(e.target.value);
                    loadTabloData({ tarih: e.target.value });
                  }}
                  className="font-monospace text-center px-1"
                />
              </InputGroup>

              {/* Time Input */}
              <InputGroup size="sm" style={{ width: "105px" }}>
                <InputGroup.Text className="bg-light px-2">
                  <IconClock size={14} className="text-primary" />
                </InputGroup.Text>
                <Form.Control
                  type="time"
                  value={saat}
                  onChange={(e) => setSaat(e.target.value)}
                  className="font-monospace text-center px-1"
                  title="İşlem Saati"
                />
              </InputGroup>
            </div>
          )
        }
      />

      {/* Sayfa Ortası Popup Bildirimler (ERP Toast) */}
      {(alertSuccess || alertError) && (
        <div className="erp-toast-container">
          {alertSuccess && (
            <Alert
              variant="success"
              dismissible
              onClose={() => setAlertSuccess(null)}
              className="erp-toast-item d-flex align-items-center mb-0 shadow py-2 px-3 border-0"
            >
              <IconCheck size={18} className="me-2 text-success flex-shrink-0" />
              <span style={{ fontSize: "13px" }}>{alertSuccess}</span>
            </Alert>
          )}
          {alertError && (
            <Alert
              variant="danger"
              dismissible
              onClose={() => setAlertError(null)}
              className="erp-toast-item d-flex align-items-start mb-0 shadow py-2 px-3 border-0"
            >
              <IconAlertCircle size={18} className="me-2 mt-0.5 text-danger flex-shrink-0" />
              <span style={{ fontSize: "13px", whiteSpace: "pre-line" }}>{alertError}</span>
            </Alert>
          )}
        </div>
      )}

      {/* Saklanan Fiyat Listesi Eylemleri: Anlık Listeye Aktar & Başka Güne Kopyala */}
      {effectivePageType === "saklanan" && (
        <div className="d-flex align-items-center justify-content-between bg-white border p-2 rounded mb-2 shadow-2xs gap-2">
          <div className="d-flex align-items-center gap-2">
            <IconArchive size={18} className="text-primary" />
            <span className="small text-secondary fw-semibold">
              Saklanan Kur Kaydı: {tarih} {saat} {tabloId ? `(Kayıt No: ${tabloId})` : "(Bugünkü Son Kur)"}
            </span>
          </div>

          <div className="d-flex align-items-center gap-2">
            <Button
              variant="outline-primary"
              size="sm"
              className="d-flex align-items-center gap-1 shadow-xs"
              onClick={handleRestoreToAnlik}
              disabled={!tabloId || isArchiving}
              title="Seçili arşiv kurlarını canlı Anlık Listeye kopyalar"
            >
              <IconArrowBackUp size={16} />
              <span>Seçili Kurları Anlık Listeye Aktar</span>
            </Button>

            <Button
              variant="outline-success"
              size="sm"
              className="d-flex align-items-center gap-1 shadow-xs"
              onClick={() => setShowCopyDateModal(true)}
              disabled={!tabloId || isArchiving}
              title="Seçili kurları başka bir günün kapanışına kopyalar"
            >
              <IconCopy size={16} />
              <span>Başka Güne Kopyala...</span>
            </Button>
          </div>
        </div>
      )}

      {/* Main ERP Window Card */}
      <Card
        className="shadow-sm border-secondary border-opacity-25"
        style={{ borderRadius: "6px", overflow: "hidden" }}
      >
        {/* Scoped selection and hover styles for Kur table */}
        <style>{`
          .kuyumcu-kur-table tbody tr.kur-row-selected,
          .kuyumcu-kur-table tbody tr.kur-row-selected > td,
          .kuyumcu-kur-table tbody tr.kur-row-selected > th,
          .kuyumcu-kur-table tbody tr.kur-row-selected:hover,
          .kuyumcu-kur-table tbody tr.kur-row-selected:hover > td,
          .kuyumcu-kur-table tbody tr.kur-row-selected:hover > th {
            background-color: #bae6fd !important;
            --bs-table-bg: #bae6fd !important;
            --bs-table-accent-bg: #bae6fd !important;
            box-shadow: inset 0 0 0 9999px #bae6fd !important;
            color: #0c4a6e !important;
          }
          .kuyumcu-kur-table tbody tr.kur-row-selected td.kur-row-num,
          .kuyumcu-kur-table tbody tr.kur-row-selected:hover td.kur-row-num {
            background-color: #7dd3fc !important;
            --bs-table-bg: #7dd3fc !important;
            --bs-table-accent-bg: #7dd3fc !important;
            box-shadow: inset 0 0 0 9999px #7dd3fc !important;
            color: #0369a1 !important;
          }
          .kuyumcu-kur-table tbody tr:not(.kur-row-selected):hover > td,
          .kuyumcu-kur-table tbody tr:not(.kur-row-selected):hover > th {
            background-color: #f1f5f9 !important;
            --bs-table-bg: #f1f5f9 !important;
            --bs-table-accent-bg: #f1f5f9 !important;
          }
          .column-resizer {
            position: absolute;
            top: 0;
            right: 0;
            width: 6px;
            bottom: 0;
            cursor: col-resize;
            user-select: none;
            z-index: 10;
          }
          .column-resizer:hover, .column-resizer:active {
            background-color: #0284c7;
          }
        `}</style>

        {/* Table Content - Max height set for ~20 rows with smooth scrolling */}
        <div
          className="flex-grow-1 overflow-auto bg-white"
          style={{
            maxHeight: "calc(100vh - 280px)",
            minHeight: "450px",
          }}
        >
          {isLoading ? (
            <div className="d-flex flex-column align-items-center justify-content-center py-5 text-muted">
              <Spinner animation="border" variant="primary" className="mb-2" />
              <span>Kurlar yükleniyor...</span>
            </div>
          ) : (
            <table
              className="table table-sm table-bordered mb-0 align-middle kuyumcu-kur-table"
              style={{ tableLayout: "fixed", width: "max-content", minWidth: "100%" }}
              onContextMenu={(e) => handleContextMenu(e)}
            >
              <thead
                className="sticky-top"
                style={{
                  zIndex: 2,
                  background: "linear-gradient(180deg, #dbe8f6 0%, #c8dcf0 100%)",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                }}
              >
                <tr className="text-secondary text-nowrap">
                  <th
                    style={{
                      width: `${colWidths.num}px`,
                      minWidth: `${colWidths.num}px`,
                      maxWidth: `${colWidths.num}px`,
                      textAlign: "center",
                      borderRight: "1px solid #b8cee6",
                      position: "relative",
                    }}
                    className="py-1"
                  >
                    #
                    <div
                      className="column-resizer"
                      onMouseDown={(e) => handleResizeStart(e, "num")}
                      title="Sütun genişliğini ayarlayın"
                    />
                  </th>
                  <th
                    style={{
                      width: `${colWidths.kod}px`,
                      minWidth: `${colWidths.kod}px`,
                      maxWidth: `${colWidths.kod}px`,
                      borderRight: "1px solid #b8cee6",
                      position: "relative",
                    }}
                    className="py-1 px-2"
                  >
                    Kod
                    <div
                      className="column-resizer"
                      onMouseDown={(e) => handleResizeStart(e, "kod")}
                      title="Sütun genişliğini ayarlayın"
                    />
                  </th>
                  <th
                    style={{
                      width: `${colWidths.ad}px`,
                      minWidth: `${colWidths.ad}px`,
                      maxWidth: `${colWidths.ad}px`,
                      borderRight: "1px solid #b8cee6",
                      position: "relative",
                    }}
                    className="py-1 px-2"
                  >
                    Ad
                    <div
                      className="column-resizer"
                      onMouseDown={(e) => handleResizeStart(e, "ad")}
                      title="Sütun genişliğini ayarlayın"
                    />
                  </th>
                  <th
                    style={{
                      width: `${colWidths.dovizAlis}px`,
                      minWidth: `${colWidths.dovizAlis}px`,
                      maxWidth: `${colWidths.dovizAlis}px`,
                      textAlign: "right",
                      borderRight: "1px solid #b8cee6",
                      position: "relative",
                    }}
                    className="py-1 px-2"
                  >
                    Döviz alış
                    <div
                      className="column-resizer"
                      onMouseDown={(e) => handleResizeStart(e, "dovizAlis")}
                      title="Sütun genişliğini ayarlayın"
                    />
                  </th>
                  <th
                    style={{
                      width: `${colWidths.dovizSatis}px`,
                      minWidth: `${colWidths.dovizSatis}px`,
                      maxWidth: `${colWidths.dovizSatis}px`,
                      textAlign: "right",
                      borderRight: "1px solid #b8cee6",
                      position: "relative",
                    }}
                    className="py-1 px-2"
                  >
                    Döviz satış
                    <div
                      className="column-resizer"
                      onMouseDown={(e) => handleResizeStart(e, "dovizSatis")}
                      title="Sütun genişliğini ayarlayın"
                    />
                  </th>
                  <th
                    style={{
                      width: `${colWidths.efektifAlis}px`,
                      minWidth: `${colWidths.efektifAlis}px`,
                      maxWidth: `${colWidths.efektifAlis}px`,
                      textAlign: "right",
                      borderRight: "1px solid #b8cee6",
                      position: "relative",
                    }}
                    className="py-1 px-2"
                  >
                    Efektif alış
                    <div
                      className="column-resizer"
                      onMouseDown={(e) => handleResizeStart(e, "efektifAlis")}
                      title="Sütun genişliğini ayarlayın"
                    />
                  </th>
                  <th
                    style={{
                      width: `${colWidths.efektifSatis}px`,
                      minWidth: `${colWidths.efektifSatis}px`,
                      maxWidth: `${colWidths.efektifSatis}px`,
                      textAlign: "right",
                      borderRight: "1px solid #b8cee6",
                      position: "relative",
                    }}
                    className="py-1 px-2"
                  >
                    Efektif satış
                    <div
                      className="column-resizer"
                      onMouseDown={(e) => handleResizeStart(e, "efektifSatis")}
                      title="Sütun genişliğini ayarlayın"
                    />
                  </th>
                  <th
                    style={{
                      width: `${colWidths.parite}px`,
                      minWidth: `${colWidths.parite}px`,
                      maxWidth: `${colWidths.parite}px`,
                      textAlign: "right",
                      position: "relative",
                    }}
                    className="py-1 px-2"
                  >
                    Parite
                    <div
                      className="column-resizer"
                      onMouseDown={(e) => handleResizeStart(e, "parite")}
                      title="Sütun genişliğini ayarlayın"
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-4 text-muted">
                      Kayıtlı kur veya ürün bulunamadı.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, idx) => {
                    const isRowSelected = selectedRowIndex === idx;
                    const baseRowBg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
                    const isLastRow = idx === rows.length - 1;
                    const cellBg = isRowSelected ? "#bae6fd" : baseRowBg;

                    return (
                      <tr
                        key={row.paraId}
                        id={`kur-grid-row-${idx}`}
                        onClick={() => setSelectedRowIndex(idx)}
                        onContextMenu={(e) => handleContextMenu(e, idx)}
                        className={isRowSelected ? "kur-row-selected" : ""}
                        style={{
                          backgroundColor: cellBg,
                          cursor: "pointer",
                        }}
                      >
                        {/* # Row Number */}
                        <td
                          className={`text-center font-monospace py-1 ${isRowSelected ? "kur-row-num" : ""}`}
                          style={{
                            fontSize: "0.88rem",
                            width: `${colWidths.num}px`,
                            minWidth: `${colWidths.num}px`,
                            maxWidth: `${colWidths.num}px`,
                            backgroundColor: isRowSelected ? "#7dd3fc" : baseRowBg,
                            boxShadow: isRowSelected ? "inset 0 0 0 9999px #7dd3fc" : "none",
                            color: isRowSelected ? "#0369a1" : "#64748b",
                            fontWeight: isRowSelected ? 700 : 500,
                            borderLeft: isRowSelected ? "2px solid #0284c7" : "1px solid #cbd5e1",
                            borderRight: isRowSelected ? "2px solid #0284c7" : "1px solid #b8cee6",
                            borderTop: isRowSelected ? "1px solid #7dd3fc" : "1px solid #cbd5e1",
                            borderBottom: isRowSelected
                              ? isLastRow
                                ? "2px solid #0284c7"
                                : "1px solid #7dd3fc"
                              : "1px solid #cbd5e1",
                            userSelect: "none",
                          }}
                        >
                          {idx + 1}
                        </td>

                        {/* Kod */}
                        <td
                          className="py-1 px-2 font-monospace"
                          style={{
                            width: `${colWidths.kod}px`,
                            minWidth: `${colWidths.kod}px`,
                            maxWidth: `${colWidths.kod}px`,
                            fontSize: "0.92rem",
                            backgroundColor: cellBg,
                            boxShadow: isRowSelected ? "inset 0 0 0 9999px #bae6fd" : "none",
                            fontWeight: isRowSelected ? 800 : 700,
                            color: isRowSelected ? "#0c4a6e" : "#0f172a",
                            borderRight: isRowSelected ? "2px solid #0284c7" : "1px solid #b8cee6",
                            borderTop: isRowSelected ? "1px solid #7dd3fc" : "1px solid #cbd5e1",
                            borderBottom: isRowSelected
                              ? isLastRow
                                ? "2px solid #0284c7"
                                : "1px solid #7dd3fc"
                              : "1px solid #cbd5e1",
                            userSelect: "none",
                          }}
                        >
                          {row.kod}
                        </td>

                        {/* Ad */}
                        <td
                          className="py-1 px-2 text-truncate"
                          style={{
                            width: `${colWidths.ad}px`,
                            minWidth: `${colWidths.ad}px`,
                            maxWidth: `${colWidths.ad}px`,
                            fontSize: "0.90rem",
                            backgroundColor: cellBg,
                            boxShadow: isRowSelected ? "inset 0 0 0 9999px #bae6fd" : "none",
                            fontWeight: isRowSelected ? 700 : 500,
                            color: isRowSelected ? "#0c4a6e" : "#334155",
                            borderRight: isRowSelected ? "2px solid #0284c7" : "1px solid #b8cee6",
                            borderTop: isRowSelected ? "1px solid #7dd3fc" : "1px solid #cbd5e1",
                            borderBottom: isRowSelected
                              ? isLastRow
                                ? "2px solid #0284c7"
                                : "1px solid #7dd3fc"
                              : "1px solid #cbd5e1",
                            userSelect: "none",
                          }}
                          title={row.ad}
                        >
                          {row.ad}
                        </td>

                        {/* Editable Columns: Döviz alış, Döviz satış, Efektif alış, Efektif satış */}
                        {EDITABLE_COLS.map((col) => {
                          const val = row[col];
                          const formattedVal = formatKurNumber(val);
                          const cellKey = getCellKey(idx, col);
                          const isCellActive = activeCell?.row === idx && activeCell?.col === col;
                          const widthPx = colWidths[col];

                          return (
                            <td
                              key={col}
                              className="font-monospace text-end p-0"
                              style={{
                                width: `${widthPx}px`,
                                minWidth: `${widthPx}px`,
                                maxWidth: `${widthPx}px`,
                                backgroundColor: cellBg,
                                boxShadow: isRowSelected ? `inset 0 0 0 9999px #bae6fd` : "none",
                                borderLeft: isRowSelected ? "1px solid #7dd3fc" : "1px solid #cbd5e1",
                                borderRight: isRowSelected
                                  ? "1px solid #7dd3fc"
                                  : "1px solid #b8cee6",
                                borderTop: isRowSelected ? "1px solid #7dd3fc" : "1px solid #cbd5e1",
                                borderBottom: isRowSelected
                                  ? isLastRow
                                    ? "2px solid #0284c7"
                                    : "1px solid #7dd3fc"
                                  : "1px solid #cbd5e1",
                                cursor: "pointer",
                                transition: "background-color 0.15s ease",
                              }}
                            >
                              {effectivePageType === "anlik" ? (
                                <input
                                  ref={(el) => {
                                    inputRefs.current[cellKey] = el;
                                  }}
                                  type="text"
                                  inputMode="decimal"
                                  data-decimal="true"
                                  className="w-100 text-end font-monospace border-0 bg-transparent px-2 py-1"
                                  style={{
                                    outline: "none",
                                    height: "30px",
                                    fontSize: "0.98rem",
                                    fontWeight: isRowSelected ? 800 : val && val !== 0 ? 700 : 500,
                                    letterSpacing: "-0.01em",
                                    color: isRowSelected
                                      ? "#0c4a6e"
                                      : val && val !== 0
                                      ? "#0f172a"
                                      : "#64748b",
                                    boxShadow: isCellActive ? "inset 0 0 0 2px #0284c7" : "none",
                                    backgroundColor: "transparent",
                                  }}
                                  value={
                                    isCellActive
                                      ? rawInputs[cellKey] ?? (val !== null && val !== undefined ? String(val) : "")
                                      : formattedVal
                                  }
                                  onFocus={() => {
                                    setActiveCell({ row: idx, col });
                                    setSelectedRowIndex(idx);
                                    scrollRowIntoView(idx);
                                  }}
                                  onBlur={() => {
                                    if (activeCell?.row === idx && activeCell?.col === col) {
                                      setActiveCell(null);
                                    }
                                  }}
                                  onChange={(e) => handleCellChange(idx, col, e.target.value)}
                                  onKeyDown={(e) => handleCellKeyDown(e, idx, col)}
                                  onContextMenu={(e) => handleContextMenu(e, idx, col)}
                                />
                              ) : (
                                <div
                                  className="px-2 py-1 text-truncate text-end font-monospace"
                                  style={{
                                    minHeight: "30px",
                                    lineHeight: "28px",
                                    fontSize: "0.98rem",
                                    fontWeight: isRowSelected ? 800 : val && val !== 0 ? 700 : 500,
                                    letterSpacing: "-0.01em",
                                    color: isRowSelected
                                      ? "#0c4a6e"
                                      : val && val !== 0
                                      ? "#0f172a"
                                      : "#94a3b8",
                                    userSelect: "none",
                                  }}
                                  onContextMenu={(e) => handleContextMenu(e, idx, col)}
                                >
                                  {formattedVal}
                                </div>
                              )}
                            </td>
                          );
                        })}

                        {/* Parite Column (Pasif / Değiştirilmez) */}
                        <td
                          className="font-monospace text-end p-0"
                          style={{
                            width: `${colWidths.parite}px`,
                            minWidth: `${colWidths.parite}px`,
                            maxWidth: `${colWidths.parite}px`,
                            backgroundColor: isRowSelected ? "#bae6fd" : "#f1f5f9",
                            boxShadow: isRowSelected ? "inset 0 0 0 9999px #bae6fd" : "none",
                            borderLeft: isRowSelected ? "1px solid #7dd3fc" : "1px solid #cbd5e1",
                            borderRight: isRowSelected ? "2px solid #0284c7" : "none",
                            borderTop: isRowSelected ? "1px solid #7dd3fc" : "1px solid #cbd5e1",
                            borderBottom: isRowSelected
                              ? isLastRow
                                ? "2px solid #0284c7"
                                : "1px solid #7dd3fc"
                              : "1px solid #cbd5e1",
                            cursor: "default",
                            userSelect: "none",
                          }}
                        >
                          <div
                            className="px-2 py-1 text-truncate text-end font-monospace"
                            style={{
                              minHeight: "30px",
                              lineHeight: "28px",
                              fontSize: "0.98rem",
                              fontWeight: isRowSelected ? 700 : row.parite && row.parite !== 0 ? 600 : 400,
                              letterSpacing: "-0.01em",
                              color: isRowSelected
                                ? "#0c4a6e"
                                : row.parite && row.parite !== 0
                                ? "#334155"
                                : "#94a3b8",
                            }}
                            title="Parite (Otomatik hesaplanır, değiştirilemez)"
                          >
                            {row.kod.trim().toUpperCase() === "USD"
                              ? (1.0).toFixed(kurDecimals)
                              : formatKurNumber(row.parite)}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Desktop ERP Function Keys Status Bar */}
        <div
          className="d-flex flex-wrap align-items-center justify-content-between px-3 py-2 border-top bg-light text-dark"
          style={{
            background: "linear-gradient(180deg, #eef5fc 0%, #dbe8f6 100%)",
            borderBottomLeftRadius: "6px",
            borderBottomRightRadius: "6px",
            fontSize: "0.82rem",
          }}
        >
          {/* Status Text on Left */}
          <div className="d-flex align-items-center gap-2">
            <span className="badge bg-secondary text-light px-2 py-1 fw-normal">
              {statusText}
            </span>
            <span className="text-muted small">
              Toplam {rows.length} para birimi
            </span>
          </div>

          {/* Hotkey Buttons on Right */}
          <div className="d-flex flex-wrap align-items-center gap-1">
            {effectivePageType === "anlik" && (
              <Button
                variant="warning"
                size="sm"
                className="px-2.5 py-0 border text-dark fw-bold small d-inline-flex align-items-center gap-1 shadow-xs"
                style={{
                  backgroundColor: "#fef08a",
                  borderColor: "#eab308",
                  color: "#713f12",
                }}
                onClick={handleAutoCalculateGoldRates}
                title="F12: HAS altın fiyatına göre Efektif Alış ve Efektif Satış altın kurlarını otomatik hesaplar"
              >
                <IconCalculator size={14} className="text-warning-emphasis" />
                <span>F12)Altın Hesapla</span>
              </Button>
            )}

            <Button
              variant="light"
              size="sm"
              className="px-2 py-0 border text-dark bg-white shadow-xs fw-semibold small d-none d-md-inline-block"
              onClick={() => setShowSearchModal(true)}
              title="F4: Genel arama ve filtreleme penceresi"
            >
              F4)Genel
            </Button>

            {/* F7: Ekrana göre Kapanış Oluştur veya Kopyala */}
            <Button
              variant="light"
              size="sm"
              className="px-2 py-0 border text-dark bg-white shadow-xs fw-semibold small"
              onClick={() => {
                if (effectivePageType === "anlik") {
                  handleCreateGunlukKapanisFromAnlik();
                } else if (effectivePageType === "saklanan") {
                  handleRestoreToAnlik();
                } else {
                  handleCreateGunlukKapanisFromAnlik();
                }
              }}
              disabled={isArchiving}
              title={
                effectivePageType === "anlik"
                  ? "F7: Anlık kurlardan günün kapanışını oluşturur"
                  : effectivePageType === "saklanan"
                  ? "F7: Seçili kurları anlık listeye aktarır"
                  : "F7: Anlık kurlardan kapanışı yeniler"
              }
            >
              {isArchiving ? (
                <Spinner size="sm" />
              ) : effectivePageType === "saklanan" ? (
                "F7)Geri Yükle"
              ) : (
                "F7)Sakla"
              )}
            </Button>

            <Button
              variant="light"
              size="sm"
              className="px-2 py-0 border text-dark bg-white shadow-xs fw-semibold small"
              onClick={handleFetchTcmb}
              disabled={isTcmbLoading}
              title="F8: TCMB Merkez Bankası güncel kurlarını çeker"
            >
              {isTcmbLoading ? <Spinner size="sm" /> : "F8)Merkez Bankası"}
            </Button>

            <Button
              variant="light"
              size="sm"
              className="px-2 py-0 border text-dark bg-white shadow-xs fw-semibold small d-none d-md-inline-block"
              onClick={handleCopyPano}
              title="F9: Kurları panoya kopyalar"
            >
              F9)Pano
            </Button>

            <Button
              variant="light"
              size="sm"
              className="px-2 py-0 border text-dark bg-white shadow-xs fw-semibold small"
              onClick={handlePrint}
              title="F10: Kur dökümünü yazdırır"
            >
              F10)Yazıcı
            </Button>
          </div>
        </div>
      </Card>

      {/* Copy To Another Date Modal for Saklanan (Screen C) */}
      <Modal
        show={showCopyDateModal}
        onHide={() => setShowCopyDateModal(false)}
        centered
        size="sm"
      >
        <Modal.Header closeButton className="py-2 bg-light">
          <Modal.Title className="fs-6 d-flex align-items-center gap-2">
            <IconCopy size={18} className="text-success" />
            <span>Kurları Başka Güne Kopyala</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3">
          <div className="small text-muted mb-2">
            Kaynak: <strong>{tarih}</strong> tarihli kurlar
          </div>
          <Form.Group className="mb-3">
            <Form.Label className="small fw-semibold">Hedef Kapanış Tarihi:</Form.Label>
            <Form.Control
              type="date"
              value={copyTargetDate}
              onChange={(e) => setCopyTargetDate(e.target.value)}
            />
          </Form.Group>
          <div className="text-muted" style={{ fontSize: "0.8rem" }}>
            Bu işlem hedef tarihte yeni bir kur kapanış tablosu açarak seçili kurları aktaracaktır.
          </div>
        </Modal.Body>
        <Modal.Footer className="py-2">
          <Button variant="secondary" size="sm" onClick={() => setShowCopyDateModal(false)}>
            İptal
          </Button>
          <Button
            variant="success"
            size="sm"
            onClick={handleCopyArchiveToTargetDate}
            disabled={isArchiving}
          >
            {isArchiving ? <Spinner size="sm" /> : "Kopyala ve Oluştur"}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Lookup / Search Modal */}
      {effectivePageType === "saklanan" ? (
        <LookupModal<StoredKurDateItem>
          show={showSearchModal}
          onHide={() => setShowSearchModal(false)}
          title="Saklanan Fiyat Listesi - Kayıtlı Kur Tarihleri Arama (Dürbün)"
          searchPlaceholder="Tarih, saat veya kayıt no arayınız (örn: 07.10.2026, 2026-10)..."
          items={[...storedDates].reverse()}
          isLoading={isLoading}
          filterFn={(item, term) => {
            const t = term.toLowerCase().trim();
            const displayDate = formatDisplayDateOnly(item.tarih).toLowerCase();
            const rawDate = (item.tarih || "").toLowerCase();
            const timeStr = formatDisplayTimeOnly(item.zaman).toLowerCase();
            const idStr = String(item.id);
            return (
              displayDate.includes(t) ||
              rawDate.includes(t) ||
              timeStr.includes(t) ||
              idStr.includes(t)
            );
          }}
          columns={[
            {
              header: "Kayıt No",
              width: "100px",
              align: "center",
              render: (item) => (
                <span className="badge bg-light text-primary border font-monospace fw-bold">
                  #{item.id}
                </span>
              ),
            },
            {
              header: "Tarih",
              width: "140px",
              render: (item) => (
                <div className="d-flex align-items-center gap-2">
                  <IconCalendar size={15} className="text-secondary" />
                  <span className="fw-bold text-dark font-monospace">
                    {formatDisplayDateOnly(item.tarih)}
                  </span>
                </div>
              ),
            },
            {
              header: "Saat / Zaman",
              width: "140px",
              render: (item) => (
                <div className="d-flex align-items-center gap-2">
                  <IconClock size={15} className="text-muted" />
                  <span className="font-monospace text-muted">
                    {formatDisplayTimeOnly(item.zaman)}
                  </span>
                </div>
              ),
            },
            {
              header: "Durum",
              render: (item) => {
                const isCurrent = item.id === tabloId;
                return isCurrent ? (
                  <Badge bg="success">Ekranda Seçili Kur</Badge>
                ) : (
                  <span className="text-muted small">Kayıtlı Arşiv Kuru</span>
                );
              },
            },
          ]}
          onSelect={(item) => {
            const idx = storedDates.findIndex((d) => d.id === item.id);
            if (idx >= 0) setSelectedDateIdx(idx);
            loadTabloData({ id: item.id, tarih: item.tarih });
            setShowSearchModal(false);
          }}
        />
      ) : (
        <LookupModal<KurRowItem>
          show={showSearchModal}
          onHide={() => setShowSearchModal(false)}
          title="Para Birimi / Kur Arama (Dürbün)"
          searchPlaceholder="Kod veya para birimi adı yazınız..."
          items={rows}
          isLoading={isLoading}
          filterFn={(r, term) => {
            const t = term.toLowerCase();
            return r.kod.toLowerCase().includes(t) || r.ad.toLowerCase().includes(t);
          }}
          columns={[
            {
              header: "Kod",
              width: "80px",
              align: "center",
              render: (r) => <span className="badge bg-light text-dark border font-monospace fw-bold">{r.kod}</span>,
            },
            {
              header: "Para Birimi Adı",
              render: (r) => <span className="fw-semibold text-dark">{r.ad}</span>,
            },
            {
              header: "Efektif Alış",
              width: "120px",
              align: "right",
              render: (r) => <span className="font-monospace text-danger fw-bold">{formatDisplayNumber(r.efektifAlis, 4)}</span>,
            },
            {
              header: "Efektif Satış",
              width: "120px",
              align: "right",
              render: (r) => <span className="font-monospace text-success fw-bold">{formatDisplayNumber(r.efektifSatis, 4)}</span>,
            },
            {
              header: "Döviz Alış",
              width: "120px",
              align: "right",
              render: (r) => <span className="font-monospace text-muted">{formatDisplayNumber(r.dovizAlis, 4)}</span>,
            },
            {
              header: "Döviz Satış",
              width: "120px",
              align: "right",
              render: (r) => <span className="font-monospace text-muted">{formatDisplayNumber(r.dovizSatis, 4)}</span>,
            },
            {
              header: "Parite",
              width: "100px",
              align: "right",
              render: (r) => <span className="font-monospace">{formatDisplayNumber(r.parite, 6)}</span>,
            },
          ]}
          onSelect={(r) => {
            const originalIdx = rows.findIndex((item) => item.paraId === r.paraId);
            if (originalIdx >= 0) {
              const cellKey = getCellKey(originalIdx, "dovizAlis");
              setTimeout(() => {
                inputRefs.current[cellKey]?.focus();
                inputRefs.current[cellKey]?.select();
              }, 100);
            }
          }}
        />
      )}

      {/* Desktop ERP Sağ Tık Context Menu */}
      {contextMenu?.visible && (
        <div
          className="shadow-lg border rounded-2 bg-white py-1"
          style={{
            position: "fixed",
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 9999,
            minWidth: "235px",
            fontSize: "12px",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.15)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {effectivePageType === "anlik" && (
            <button
              type="button"
              className="dropdown-item d-flex align-items-center justify-content-between px-3 py-1.5 text-dark"
              style={{ cursor: "pointer" }}
              onClick={() => {
                setContextMenu(null);
                handleAutoCalculateGoldRates();
              }}
            >
              <div className="d-flex align-items-center gap-2">
                <IconSparkles size={15} className="text-warning" />
                <span>Altın Kurlarını Hesapla</span>
              </div>
              <span className="text-muted font-monospace" style={{ fontSize: "10px" }}>F12</span>
            </button>
          )}

          <button
            type="button"
            className="dropdown-item d-flex align-items-center justify-content-between px-3 py-1.5 text-dark"
            style={{ cursor: "pointer" }}
            onClick={() => {
              setContextMenu(null);
              if (effectivePageType === "anlik") {
                handleCreateGunlukKapanisFromAnlik();
              } else if (effectivePageType === "saklanan") {
                handleRestoreToAnlik();
              } else {
                handleCreateGunlukKapanisFromAnlik();
              }
            }}
          >
            <div className="d-flex align-items-center gap-2">
              <IconDeviceFloppy size={15} className="text-primary" />
              <span>{effectivePageType === "saklanan" ? "Geri Yükle" : "Kapanış Oluştur / Sakla"}</span>
            </div>
            <span className="text-muted font-monospace" style={{ fontSize: "10px" }}>F7</span>
          </button>

          <button
            type="button"
            className="dropdown-item d-flex align-items-center justify-content-between px-3 py-1.5 text-dark"
            style={{ cursor: "pointer" }}
            onClick={() => {
              setContextMenu(null);
              handleFetchTcmb();
            }}
          >
            <div className="d-flex align-items-center gap-2">
              <IconRefresh size={15} className="text-info" />
              <span>TCMB Merkez Bankası</span>
            </div>
            <span className="text-muted font-monospace" style={{ fontSize: "10px" }}>F8</span>
          </button>

          <button
            type="button"
            className="dropdown-item d-flex align-items-center justify-content-between px-3 py-1.5 text-dark"
            style={{ cursor: "pointer" }}
            onClick={() => {
              setContextMenu(null);
              handleCopyPano();
            }}
          >
            <div className="d-flex align-items-center gap-2">
              <IconCopy size={15} className="text-secondary" />
              <span>Panoya Kopyala</span>
            </div>
            <span className="text-muted font-monospace" style={{ fontSize: "10px" }}>F9</span>
          </button>

          <button
            type="button"
            className="dropdown-item d-flex align-items-center justify-content-between px-3 py-1.5 text-dark"
            style={{ cursor: "pointer" }}
            onClick={() => {
              setContextMenu(null);
              handlePrint();
            }}
          >
            <div className="d-flex align-items-center gap-2">
              <IconPrinter size={15} className="text-secondary" />
              <span>Yazdır</span>
            </div>
            <span className="text-muted font-monospace" style={{ fontSize: "10px" }}>F10</span>
          </button>

          <button
            type="button"
            className="dropdown-item d-flex align-items-center justify-content-between px-3 py-1.5 text-dark"
            style={{ cursor: "pointer" }}
            onClick={() => {
              setContextMenu(null);
              setShowSearchModal(true);
            }}
          >
            <div className="d-flex align-items-center gap-2">
              <IconSearch size={15} className="text-secondary" />
              <span>Genel Arama / Dürbün</span>
            </div>
            <span className="text-muted font-monospace" style={{ fontSize: "10px" }}>F4</span>
          </button>

          <div className="dropdown-divider my-1 border-top" style={{ borderColor: "#e2e8f0" }}></div>

          {/* En altta: Hesap Makinesi */}
          <button
            type="button"
            className="dropdown-item d-flex align-items-center justify-content-between px-3 py-1.5 text-dark fw-medium"
            style={{ cursor: "pointer", backgroundColor: "#f0fdf4" }}
            onClick={() => {
              const rIdx = contextMenu.rowIndex;
              const cCol = contextMenu.colKey;
              let val: any = undefined;
              let targetInput: HTMLInputElement | null = null;
              if (rIdx !== undefined && rIdx >= 0) {
                if (cCol) {
                  val = rows[rIdx]?.[cCol];
                  targetInput = inputRefs.current[getCellKey(rIdx, cCol)] || null;
                } else {
                  val = rows[rIdx]?.efektifSatis || rows[rIdx]?.dovizSatis || rows[rIdx]?.efektifAlis || 0;
                  targetInput = inputRefs.current[getCellKey(rIdx, "efektifSatis")] || null;
                }
              }
              setContextMenu(null);
              window.dispatchEvent(
                new CustomEvent("open-global-calculator", {
                  detail: { value: val, target: targetInput },
                })
              );
            }}
          >
            <div className="d-flex align-items-center gap-2 text-success">
              <IconCalculator size={16} className="text-success" />
              <span className="fw-bold">Hesap Makinesi</span>
            </div>
            <span className="badge bg-success-subtle text-success border border-success-subtle font-monospace" style={{ fontSize: "10px" }}>F11</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default KurFiyatListesiPage;
