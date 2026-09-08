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
} from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import LookupModal from "../../components/common/LookupModal";
import {
  KurService,
  KurTablosuItem,
  KurRowItem,
  StoredKurDateItem,
} from "../../services/kurService";
import { printReportTable } from "../../utils/printReport";

export type KurPageType = "anlik" | "saklanan";

interface KurFiyatListesiPageProps {
  pageType?: KurPageType;
}

const EDITABLE_COLS = [
  "dovizAlis",
  "dovizSatis",
  "efektifAlis",
  "efektifSatis",
  "parite",
] as const;

type EditableCol = (typeof EDITABLE_COLS)[number];

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

export const filterOutTl = (items?: KurRowItem[]): KurRowItem[] => {
  if (!items) return [];
  return items.filter((r) => !isTlCurrency(r.kod, r.ad));
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

  // Data states
  const [tabloId, setTabloId] = useState<number>(0);
  const [kapanisKurTablosuId, setKapanisKurTablosuId] = useState<number | null>(null);
  const [tarih, setTarih] = useState<string>(getCurrentDateStr);
  const [saat, setSaat] = useState<string>(getCurrentTimeStr);
  const [rows, setRows] = useState<KurRowItem[]>([]);
  const [rawInputs, setRawInputs] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [lastSavedZaman, setLastSavedZaman] = useState<string>("");

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

  const getCellKey = (rowIndex: number, col: EditableCol) => `${rowIndex}_${col}`;

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
            const filteredRows = filterOutTl(tablo.satirlar);
            setRows(filteredRows);

            // Verisi bulunmayan satırlar / hücreler boş olarak gelecek
            const initialInputs: Record<string, string> = {};
            filteredRows.forEach((r, idx) => {
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
            const filteredRows = filterOutTl(tablo.satirlar);
            setRows(filteredRows);

            const initialInputs: Record<string, string> = {};
            filteredRows.forEach((r, idx) => {
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
    const key = getCellKey(rowIndex, col);
    setRawInputs((prev) => ({ ...prev, [key]: val }));
    setIsDirty(true);

    const cleanVal = val.replace(",", ".");
    const numVal = cleanVal === "" ? null : parseFloat(cleanVal);

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
    }
  };

  // Sağa / ileriye git (Döviz Alış -> Döviz Satış -> Efektif Alış -> Efektif Satış -> Parite -> Sonraki satır Döviz Alış)
  const moveToNextCell = (rIdx: number, cIdx: number) => {
    if (cIdx < EDITABLE_COLS.length - 1) {
      focusCell(rIdx, EDITABLE_COLS[cIdx + 1]);
    } else if (rIdx < rows.length - 1) {
      // En sona gelince entera basınca alt satırdaki Döviz Alış'a in
      focusCell(rIdx + 1, "dovizAlis");
    } else {
      // En son satırın Parite hücresindeyse ilk satırın Döviz Alış'ına dön
      focusCell(0, "dovizAlis");
    }
  };

  // Sola / geriye git
  const moveToPrevCell = (rIdx: number, cIdx: number) => {
    if (cIdx > 0) {
      focusCell(rIdx, EDITABLE_COLS[cIdx - 1]);
    } else if (rIdx > 0) {
      focusCell(rIdx - 1, "parite");
    }
  };

  // Keyboard Navigation inside the Data Grid
  const handleCellKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    col: EditableCol
  ) => {
    const colIndex = EDITABLE_COLS.indexOf(col);

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

      const [hours, minutes] = saat.split(":").map(Number);
      const combinedDateTime = new Date(tarih);
      combinedDateTime.setHours(hours || 12, minutes || 0, 0, 0);

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
      setRows(filterOutTl(result.satirlar));
      setLastSavedZaman(result.zaman);
      setIsDirty(false);
      setStatusText("Son kayıt");
      setAlertSuccess(
        effectivePageType === "anlik"
          ? `Gişede o an işlem gören canlı kurlar ve saati (${saat}) başarıyla kaydedildi.`
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
      setRows(filterOutTl(kapanisTablo.satirlar));
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

  // Copy to Clipboard (F9 Pano)
  const handleCopyPano = () => {
    const summary = rows
      .map(
        (r) =>
          `${r.kod}: Alış=${r.efektifAlis || r.dovizAlis || "-"} Satış=${
            r.efektifSatis || r.dovizSatis || "-"
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
          render: (item) => formatDisplayNumber(item.dovizAlis, 4),
          align: "right",
        },
        {
          header: "Döviz Satış",
          render: (item) => formatDisplayNumber(item.dovizSatis, 4),
          align: "right",
        },
        {
          header: "Efektif Alış",
          render: (item) => formatDisplayNumber(item.efektifAlis, 4),
          align: "right",
        },
        {
          header: "Efektif Satış",
          render: (item) => formatDisplayNumber(item.efektifSatis, 4),
          align: "right",
        },
        {
          header: "Parite",
          render: (item) => formatDisplayNumber(item.parite, 6),
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

  // Global Keyboard shortcuts listener (F1 - F10)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (showSearchModal || showCopyDateModal) return;

      if (e.key === "F1") {
        e.preventDefault();
        handleSave();
      } else if (e.key === "F2") {
        e.preventDefault();
        handleDelete();
      } else if (e.key === "F3") {
        e.preventDefault();
        handleFocusCell();
      } else if (e.key === "F4") {
        e.preventDefault();
        setShowSearchModal(true);
      } else if (e.key === "F5") {
        e.preventDefault();
        handleJumpEfektif();
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
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  });



  return (
    <div className="container-fluid py-2 px-3 kuyumcu-kur-container">
      {/* 1. Sol Üst Standart ERP Toolbar (Diğer Sayfalar Gibi) */}
      <ERPToolbar
        onSave={handleSave}
        onDelete={handleDelete}
        onSearch={() => setShowSearchModal(true)}
        onFirst={handleFirstDate}
        onPrev={handlePrevDate}
        onNext={handleNextDate}
        onLast={handleLastDate}
        onPrint={handlePrint}
        onRefresh={() => loadTabloData({ id: tabloId, tarih })}
        disabled={isLoading || isSaving}
        pageTitle={pageTitle}
        rightContent={
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
        }
      />

      {/* Alert Notifications */}
      {alertSuccess && (
        <Alert variant="success" className="d-flex align-items-center py-2 px-3 mb-2 shadow-sm">
          <IconCheck size={18} className="me-2 flex-shrink-0 text-success" />
          <span>{alertSuccess}</span>
        </Alert>
      )}
      {alertError && (
        <Alert
          variant="danger"
          dismissible
          onClose={() => setAlertError(null)}
          className="d-flex align-items-start py-2 px-3 mb-2 shadow-sm"
        >
          <IconAlertCircle size={20} className="me-2 mt-1 flex-shrink-0 text-danger" />
          <div style={{ whiteSpace: "pre-line", lineHeight: "1.5" }}>{alertError}</div>
        </Alert>
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
        {/* Data Grid Table Container */}
        <div
          className="table-responsive"
          style={{
            maxHeight: "calc(100vh - 280px)",
            minHeight: "440px",
            backgroundColor: "#fff",
          }}
        >
          {isLoading ? (
            <div className="d-flex flex-column align-items-center justify-content-center py-5 text-muted">
              <Spinner animation="border" variant="primary" className="mb-2" />
              <span>Kurlar yükleniyor...</span>
            </div>
          ) : (
            <table className="table table-sm table-bordered table-hover mb-0 align-middle kuyumcu-kur-table">
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
                    style={{ width: "45px", textAlign: "center", borderRight: "1px solid #b8cee6" }}
                    className="py-1"
                  >
                    #
                  </th>
                  <th
                    style={{ width: "75px", borderRight: "1px solid #b8cee6" }}
                    className="py-1 px-2"
                  >
                    Kod
                  </th>
                  <th
                    style={{ width: "220px", borderRight: "1px solid #b8cee6" }}
                    className="py-1 px-2"
                  >
                    Ad
                  </th>
                  <th
                    style={{ width: "135px", textAlign: "right", borderRight: "1px solid #b8cee6" }}
                    className="py-1 px-2"
                  >
                    Döviz alış
                  </th>
                  <th
                    style={{ width: "135px", textAlign: "right", borderRight: "1px solid #b8cee6" }}
                    className="py-1 px-2"
                  >
                    Döviz satış
                  </th>
                  <th
                    style={{ width: "135px", textAlign: "right", borderRight: "1px solid #b8cee6" }}
                    className="py-1 px-2"
                  >
                    Efektif alış
                  </th>
                  <th
                    style={{ width: "135px", textAlign: "right", borderRight: "1px solid #b8cee6" }}
                    className="py-1 px-2"
                  >
                    Efektif satış
                  </th>
                  <th style={{ width: "135px", textAlign: "right" }} className="py-1 px-2">
                    Parite
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
                    const isUsd = row.kod.trim().toUpperCase() === "USD";
                    const isEur = row.kod.trim().toUpperCase() === "EUR";

                    return (
                      <tr
                        key={row.paraId}
                        style={{
                          backgroundColor: idx % 2 === 1 ? "#f9fbfd" : "#ffffff",
                        }}
                      >
                        {/* # Row Number */}
                        <td
                          className="text-center text-muted font-monospace py-1"
                          style={{ fontSize: "0.82rem", width: "45px" }}
                        >
                          {idx + 1}
                        </td>

                        {/* Kod */}
                        <td className="py-1 px-2 fw-bold text-dark font-monospace" style={{ width: "75px" }}>
                          {row.kod}
                        </td>

                        {/* Ad */}
                        <td
                          className="py-1 px-2 text-secondary text-truncate"
                          style={{ maxWidth: "220px", fontSize: "0.85rem" }}
                          title={row.ad}
                        >
                          {row.ad}
                        </td>

                        {/* Editable Columns: Döviz alış, Döviz satış, Efektif alış, Efektif satış, Parite */}
                        {EDITABLE_COLS.map((col) => {
                          const cellKey = getCellKey(idx, col);
                          const isCellFocused =
                            activeCell?.row === idx && activeCell?.col === col;

                          return (
                            <td
                              key={col}
                              className="p-0"
                              style={{
                                width: "135px",
                                backgroundColor: isCellFocused ? "#e8f0fe" : undefined,
                              }}
                            >
                              <input
                                ref={(el) => {
                                  inputRefs.current[cellKey] = el;
                                }}
                                type="text"
                                data-custom-enter="true"
                                className="form-control form-control-sm border-0 rounded-0 text-end font-monospace py-1 px-2"
                                style={{
                                  boxShadow: isCellFocused
                                    ? "inset 0 0 0 1.5px #1a73e8"
                                    : "none",
                                  backgroundColor: "transparent",
                                  fontSize: "0.88rem",
                                  fontWeight: isUsd || isEur ? 600 : 400,
                                }}
                                value={
                                  rawInputs[cellKey] !== undefined
                                    ? rawInputs[cellKey]
                                    : row[col] !== null && row[col] !== undefined && !isNaN(row[col]!) && row[col] !== 0
                                    ? row[col]!.toFixed(6)
                                    : ""
                                }
                                onChange={(e) => handleCellChange(idx, col, e.target.value)}
                                onFocus={(e) => {
                                  setActiveCell({ row: idx, col });
                                  e.target.select();
                                }}
                                onBlur={() => {
                                  const num = row[col];
                                  if (num !== null && num !== undefined && !isNaN(num) && num !== 0) {
                                    setRawInputs((p) => ({ ...p, [cellKey]: num.toFixed(6) }));
                                  } else {
                                    setRawInputs((p) => ({ ...p, [cellKey]: "" }));
                                  }
                                }}
                                onKeyDown={(e) => handleCellKeyDown(e, idx, col)}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Desktop ERP Function Keys Status Bar (Image 2 Style) */}
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

          {/* Hotkey Buttons on Right (Matching Image 2 F1-F10 buttons) */}
          <div className="d-flex flex-wrap align-items-center gap-1">
            <Button
              variant="light"
              size="sm"
              className="px-2 py-0 border text-dark bg-white shadow-xs fw-semibold small"
              onClick={handleSave}
              disabled={isSaving}
              title="F1: Kur tablosunu veritabanına kaydeder"
            >
              F1)Kaydet
            </Button>

            <Button
              variant="light"
              size="sm"
              className="px-2 py-0 border text-dark bg-white shadow-xs fw-semibold small"
              onClick={handleDelete}
              title="F2: Kaydı siler veya sıfırlar"
            >
              F2)Sil
            </Button>

            <Button
              variant="light"
              size="sm"
              className="px-2 py-0 border text-dark bg-white shadow-xs fw-semibold small d-none d-md-inline-block"
              onClick={handleFocusCell}
              title="F3: Hücreye odaklanır"
            >
              F3)Hücre
            </Button>

            <Button
              variant="light"
              size="sm"
              className="px-2 py-0 border text-dark bg-white shadow-xs fw-semibold small d-none d-md-inline-block"
              onClick={() => setShowSearchModal(true)}
              title="F4: Genel arama ve filtreleme penceresi"
            >
              F4)Genel
            </Button>

            <Button
              variant="light"
              size="sm"
              className="px-2 py-0 border text-dark bg-white shadow-xs fw-semibold small d-none d-md-inline-block"
              onClick={handleJumpEfektif}
              title="F5: Efektif kolonuna geç"
            >
              F5)Kolon
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

      {/* Lookup / Search Modal (Dürbün ile Seçim - D- Vezne Tanımları gibi) */}
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
    </div>
  );
};

export default KurFiyatListesiPage;
