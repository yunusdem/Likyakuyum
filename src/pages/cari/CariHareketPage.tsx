import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  Card,
  Row,
  Col,
  Form,
  Button,
  Table,
  Badge,
  Alert,
  Spinner,
  Modal,
  ButtonGroup,
} from "react-bootstrap";
import {
  IconPlus,
  IconTrash,
  IconCheck,
  IconCash,
  IconBinoculars,
  IconSearch,
  IconPrinter,
  IconCalendar,
  IconNotes,
  IconCoins,
  IconAlertCircle,
  IconArrowRight,
  IconRefresh,
} from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import CodeLookupInput from "../../components/common/CodeLookupInput";
import LookupModal from "../../components/common/LookupModal";
import { printReportTable } from "../../utils/printReport";
import {
  CariHareketService,
  CariHareketItem,
  CariHareketFormData,
  CariBakiyeSummary,
  NavigationResult,
} from "../../services/cariHareketService";
import { CariService, CariKartItem, CariLookups } from "../../services/cariService";
import { apiClient } from "../../services/apiClient";
import { useAuth } from "../../context/AuthContext";

interface VezneItem {
  id: number;
  kod: string;
  ad: string;
}

interface ParaItem {
  id: number;
  kod: string;
  ad: string;
  hasOrani?: number;
}

interface GridLine {
  id: string; // internal client ID for key
  paraId: number;
  paraKodu: string;
  meblag: number | string;
}

const HAREKET_TIPI_OPTIONS = [
  { value: 0, label: "Nakit" },
  { value: 1, label: "Banka / Havale" },
  { value: 2, label: "POS / Kredi Kartı" },
  { value: 3, label: "Dekont" },
  { value: 4, label: "Virman" },
  { value: 5, label: "Devir" },
];

export const CariHareketPage: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const isEditMode = location.pathname.includes("hareket-duzeltme");
  const queryId = searchParams.get("id");

  // General lookups
  const [cariList, setCariList] = useState<CariKartItem[]>([]);
  const [vezneList, setVezneList] = useState<VezneItem[]>([]);
  const [paraList, setParaList] = useState<ParaItem[]>([]);
  const [isLoadingLookups, setIsLoadingLookups] = useState<boolean>(true);

  // Active record state
  const [currentHareketId, setCurrentHareketId] = useState<number | null>(null);
  const [navInfo, setNavInfo] = useState<NavigationResult>({
    firstId: null,
    prevId: null,
    nextId: null,
    lastId: null,
    currentIndex: -1,
    total: 0,
  });

  // Form Fields - initially completely empty for new record mode
  const [vezneId, setVezneId] = useState<number>(0);
  const [vezneKod, setVezneKod] = useState<string>("");
  const [vezneAd, setVezneAd] = useState<string>("");

  const [cariKartId, setCariKartId] = useState<number | null>(null);
  const [cariKod, setCariKod] = useState<string>("");
  const [cariAd, setCariAd] = useState<string>("");

  const [tarih, setTarih] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [hareketTipi, setHareketTipi] = useState<number>(0); // 0: Nakit (varsayılan)
  const [aciklama, setAciklama] = useState<string>("");
  const [cariTipi, setCariTipi] = useState<number | null>(0); // 0: Borç (varsayılan)

  // Helper to find and apply user's cashier / vezne
  const applyUserVezne = useCallback(
    (list: VezneItem[]) => {
      if (!list || list.length === 0) return;
      const target = String(user?.cashierCode || "").trim().toLowerCase();

      let matched: VezneItem | undefined;
      if (target) {
        // 1. Check exact match on id or kod
        matched = list.find(
          (v) =>
            String(v.id).toLowerCase() === target ||
            v.kod.toLowerCase() === target
        );

        // 2. Check if numeric comparison matches (e.g. "01" vs 1)
        if (!matched && !isNaN(Number(target))) {
          const targetNum = Number(target);
          matched = list.find((v) => v.id === targetNum);
        }
      }

      // 3. Fallback: if no match found, pick the first one
      if (!matched && list.length > 0) {
        matched = list[0];
      }

      if (matched) {
        setVezneId(matched.id);
        setVezneKod(matched.kod);
        setVezneAd(matched.ad);
      }
    },
    [user]
  );

  // Sub-Grid Lines - completely empty for new record mode
  const [lines, setLines] = useState<GridLine[]>([
    { id: "line-1", paraId: 0, paraKodu: "", meblag: "" },
  ]);

  // SMB Autocomplete suggestion state
  const [activeSmbSuggestIdx, setActiveSmbSuggestIdx] = useState<number | null>(null);
  const [smbSuggestItems, setSmbSuggestItems] = useState<ParaItem[]>([]);
  const [selectedSuggestIdx, setSelectedSuggestIdx] = useState<number>(0);

  // Cari Kod Autocomplete suggestion state
  const [cariSuggestItems, setCariSuggestItems] = useState<CariKartItem[]>([]);
  const [showCariSuggest, setShowCariSuggest] = useState<boolean>(false);
  const [selectedCariSuggestIdx, setSelectedCariSuggestIdx] = useState<number>(0);

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Focus navigation refs
  const smbInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});
  const miktarInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});

  // Balance status
  const [bakiyeSummary, setBakiyeSummary] = useState<CariBakiyeSummary | null>(null);
  const [isLoadingBakiye, setIsLoadingBakiye] = useState<boolean>(false);

  // UI state
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals
  const [showCariModal, setShowCariModal] = useState<boolean>(false);
  const [showParaModal, setShowParaModal] = useState<boolean>(false);
  const [activeParaLineIndex, setActiveParaLineIndex] = useState<number | null>(null);
  const [activeGridRowIdx, setActiveGridRowIdx] = useState<number | null>(0);

  // Transaction Search Modal (for F3 / Düzeltme)
  const [showSearchModal, setShowSearchModal] = useState<boolean>(false);
  const [allHareketler, setAllHareketler] = useState<CariHareketItem[]>([]);
  const [isLoadingSearch, setIsLoadingSearch] = useState<boolean>(false);

  // Delete Confirm Modal
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);

  // Load initial lookups (Cariler, Vezneler, Paralar)
  useEffect(() => {
    const fetchInitialLookups = async () => {
      try {
        setIsLoadingLookups(true);
        const [cariler, vezneRes, paraRes] = await Promise.all([
          CariService.getCariKartlar().catch(() => []),
          apiClient.get<any[]>("/vezne").catch(() => ({ data: [] })),
          apiClient.get<any[]>("/para").catch(() => ({ data: [] })),
        ]);

        setCariList(cariler || []);

        const vezneler: VezneItem[] = (vezneRes.data || []).map((v) => ({
          id: v.id || v.VEZNE_ID,
          kod: (v.kod || v.KOD || "").trim(),
          ad: (v.ad || v.AD || "").trim(),
        }));
        setVezneList(vezneler);

        const paralar: ParaItem[] = (paraRes.data || []).map((p) => ({
          id: p.id || p.PARA_ID,
          kod: (p.kod || p.KOD || "").trim(),
          ad: (p.ad || p.AD || "").trim(),
          hasOrani: p.hasOrani || p.HAS_ORANI,
        }));
        setParaList(paralar);

        if (!queryId && !isEditMode) {
          applyUserVezne(vezneler);
        }
      } catch (err: any) {
        console.error("Lookups fetch error:", err);
      } finally {
        setIsLoadingLookups(false);
      }
    };

    fetchInitialLookups();
  }, []); // Run once on mount!

  // Load record if queryId present or edit mode
  useEffect(() => {
    if (queryId) {
      loadRecordById(Number(queryId));
    } else if (isEditMode) {
      // In edit mode without id, load last record or open navigation
      loadLastRecord();
    }
  }, [queryId, isEditMode]);

  // Load balance whenever cariKartId changes
  const loadCariBakiye = async (cId: number) => {
    try {
      setIsLoadingBakiye(true);
      const res = await CariHareketService.getCariBakiye(cId);
      setBakiyeSummary(res);
    } catch (err) {
      console.error("Bakiye yükleme hatası:", err);
      setBakiyeSummary(null);
    } finally {
      setIsLoadingBakiye(false);
    }
  };

  const loadRecordById = async (id: number) => {
    try {
      setError(null);
      const item = await CariHareketService.getById(id);
      if (item) {
        setCurrentHareketId(item.id);
        setCariKartId(item.cariKartId);
        setCariKod(item.cariKod);
        setCariAd(item.cariAd);
        setVezneId(item.vezneId);
        setVezneKod(item.vezneKod);
        setVezneAd(item.vezneAd);
        setTarih(item.tarih ? item.tarih.split("T")[0] : new Date().toISOString().split("T")[0]);
        setHareketTipi(item.hareketTipi);
        setAciklama(item.aciklama || "");
        setCariTipi(item.tip);

        if (item.satirlar && item.satirlar.length > 0) {
          const loaded: GridLine[] = item.satirlar.map((s, idx) => ({
            id: `line-${idx + 1}-${Date.now()}`,
            paraId: s.paraId,
            paraKodu: s.paraKodu,
            meblag: s.meblag,
          }));
          setLines(loaded);
        } else {
          setLines([{ id: "line-1", paraId: 0, paraKodu: "", meblag: "" }]);
        }

        // Fetch balance
        loadCariBakiye(item.cariKartId);

        // Fetch navigation info
        const nav = await CariHareketService.getNavigation(item.id);
        setNavInfo(nav);
      }
    } catch (err: any) {
      setError(err.message || "Kayıt yüklenirken hata oluştu.");
    }
  };

  const loadLastRecord = async () => {
    try {
      const nav = await CariHareketService.getNavigation();
      if (nav.lastId) {
        loadRecordById(nav.lastId);
      }
    } catch (err) {
      console.error("Son kayıt yüklenemedi:", err);
    }
  };

  // Reset form to brand new record (F4)
  const handleNewRecord = () => {
    setCurrentHareketId(null);
    applyUserVezne(vezneList);
    setCariKartId(null);
    setCariKod("");
    setCariAd("");
    setTarih(new Date().toISOString().split("T")[0]);
    setHareketTipi(0);
    setAciklama("");
    setCariTipi(0); // Borç varsayılan
    setBakiyeSummary(null);
    setError(null);
    setSuccessMsg(null);

    setLines([{ id: `line-${Date.now()}`, paraId: 0, paraKodu: "", meblag: "" }]);
    setActiveGridRowIdx(0);

    if (isEditMode) {
      navigate("/cari/hareket-kayit");
    }
  };

  // Save Record (F2)
  const handleSave = async () => {
    try {
      setError(null);
      setSuccessMsg(null);

      if (!cariKartId) {
        setError("Lütfen bir Cari Kart seçiniz.");
        return;
      }

      if (!vezneId) {
        setError("Giriş yapan kullanıcıya ait geçerli bir vezne bulunamadı.");
        return;
      }

      if (cariTipi === null) {
        setError("Lütfen işlem türünü (Borç veya Alacak) seçiniz.");
        return;
      }

      const validLines = lines
        .map((l) => {
          let pId = l.paraId;
          if (!pId && l.paraKodu) {
            const matched = paraList.find((p) => p.kod.toUpperCase() === l.paraKodu.trim().toUpperCase());
            if (matched) pId = matched.id;
          }
          return {
            paraId: pId,
            meblag: Number(l.meblag) || 0,
          };
        })
        .filter((l) => l.paraId > 0 && l.meblag > 0);

      if (validLines.length === 0) {
        setError("En az bir geçerli para birimi ve pozitif meblağ girmelisiniz.");
        return;
      }

      setIsSaving(true);

      const payload: CariHareketFormData = {
        cariKartId,
        vezneId,
        tarih,
        hareketTipi,
        aciklama,
        tip: cariTipi,
        satirlar: validLines,
      };

      let saved: CariHareketItem;
      if (currentHareketId) {
        saved = await CariHareketService.update(currentHareketId, payload);
        setSuccessMsg(`Cari hareket #${saved.id} başarıyla güncellendi.`);
      } else {
        saved = await CariHareketService.create(payload);
        setSuccessMsg(`Cari hareket #${saved.id} başarıyla kaydedildi.`);
      }

      // Kayıttan sonra üst kısımlar (Cari Kart, Vezne, Tarih, Hareket Tipi, Borç/Alacak vb.) AYNI kalsın,
      // SADECE Açıklama satırı ve Grid satırları boşalsın:
      setAciklama("");
      setLines([{ id: `line-${Date.now()}`, paraId: 0, paraKodu: "", meblag: "" }]);
      setCurrentHareketId(null);
      setActiveGridRowIdx(0);

      // Refresh balance and navigation
      loadCariBakiye(cariKartId);
      const nav = await CariHareketService.getNavigation(saved.id);
      setNavInfo(nav);

      // Hemen sonraki hareket girişi için griddeki ilk SMB satırına odaklan
      setTimeout(() => {
        smbInputRefs.current[0]?.focus();
      }, 100);
    } catch (err: any) {
      setError(err.message || "Kaydetme sırasında bir hata oluştu.");
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Record
  const handleDeleteConfirm = async () => {
    if (!currentHareketId) return;
    try {
      setIsSaving(true);
      await CariHareketService.delete(currentHareketId);
      setShowDeleteModal(false);
      setSuccessMsg(`Cari hareket #${currentHareketId} başarıyla silindi.`);
      // Load next or previous record if exists
      if (navInfo.nextId) {
        loadRecordById(navInfo.nextId);
      } else if (navInfo.prevId) {
        loadRecordById(navInfo.prevId);
      } else {
        handleNewRecord();
      }
    } catch (err: any) {
      setError(err.message || "Kayıt silinirken hata oluştu.");
    } finally {
      setIsSaving(false);
    }
  };

  // Navigation handlers
  const handleNavFirst = () => navInfo.firstId && loadRecordById(navInfo.firstId);
  const handleNavPrev = () => navInfo.prevId && loadRecordById(navInfo.prevId);
  const handleNavNext = () => navInfo.nextId && loadRecordById(navInfo.nextId);
  const handleNavLast = () => navInfo.lastId && loadRecordById(navInfo.lastId);

  // Open Search Modal (F3)
  const handleOpenSearchModal = async () => {
    setShowSearchModal(true);
    try {
      setIsLoadingSearch(true);
      const list = await CariHareketService.list();
      setAllHareketler(list || []);
    } catch (err) {
      console.error("Hareket listesi arama hatası:", err);
    } finally {
      setIsLoadingSearch(false);
    }
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 1) {
      // Clear line instead of removing if it's the only one
      setLines([{ id: `line-${Date.now()}`, paraId: 0, paraKodu: "", meblag: "" }]);
      return;
    }
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSelectSuggestPara = (index: number, p: ParaItem) => {
    setLines((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        paraId: p.id,
        paraKodu: p.kod,
      };
      return updated;
    });
    setActiveSmbSuggestIdx(null);
    setSmbSuggestItems([]);

    // Focus Miktar field of current row
    setTimeout(() => {
      miktarInputRefs.current[index]?.focus();
      miktarInputRefs.current[index]?.select();
    }, 50);
  };

  const handleLineSmbTextChange = (index: number, val: string) => {
    const upper = val.toUpperCase();
    const matched = paraList.find((p) => p.kod.toUpperCase() === upper.trim());

    setLines((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        paraKodu: val,
        paraId: matched ? matched.id : 0,
      };
      return updated;
    });

    // Show suggestions from the first letter typed
    if (val.trim().length > 0) {
      const term = val.trim().toLowerCase();
      const filtered = paraList.filter(
        (p) =>
          p.kod.toLowerCase().includes(term) ||
          p.ad.toLowerCase().includes(term)
      );
      setSmbSuggestItems(filtered);
      setActiveSmbSuggestIdx(index);
      setSelectedSuggestIdx(0);
    } else {
      setSmbSuggestItems([]);
      setActiveSmbSuggestIdx(null);
    }
  };

  const handleLineMeblagChange = (index: number, val: string) => {
    setLines((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], meblag: val };
      return updated;
    });
  };

  // Cari Kod Input & Suggestions (do NOT auto-fill Ad immediately, show dropdown)
  const handleCariKodChange = (val: string) => {
    setCariKod(val);
    if (val.trim().length > 0) {
      const term = val.trim().toLowerCase();
      const matched = cariList.filter(
        (c) =>
          c.kod.toLowerCase().includes(term) ||
          c.ad.toLowerCase().includes(term)
      );
      setCariSuggestItems(matched.slice(0, 10));
      setShowCariSuggest(matched.length > 0);
      setSelectedCariSuggestIdx(0);
    } else {
      setCariSuggestItems([]);
      setShowCariSuggest(false);
      setCariKartId(null);
      setCariAd("");
      setBakiyeSummary(null);
    }
  };

  const handleSelectCariSuggest = (c: CariKartItem) => {
    setCariKod(c.kod);
    setCariAd(c.ad); // Seçilince Ad alanını doldur
    setCariKartId(c.id);
    loadCariBakiye(c.id);
    setShowCariSuggest(false);
    setCariSuggestItems([]);
  };

  const handleCariKodKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showCariSuggest && cariSuggestItems.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedCariSuggestIdx((prev) => Math.min(cariSuggestItems.length - 1, prev + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedCariSuggestIdx((prev) => Math.max(0, prev - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = cariSuggestItems[selectedCariSuggestIdx] || cariSuggestItems[0];
        if (item) {
          handleSelectCariSuggest(item);
        }
      } else if (e.key === "Escape") {
        setShowCariSuggest(false);
      }
    }
  };

  // Selection from modals
  const handleSelectCari = (c: CariKartItem) => {
    setCariKartId(c.id);
    setCariKod(c.kod);
    setCariAd(c.ad);
    loadCariBakiye(c.id);
    setShowCariSuggest(false);
  };

  const handleSelectParaForLine = (p: ParaItem) => {
    if (activeParaLineIndex !== null && activeParaLineIndex >= 0 && activeParaLineIndex < lines.length) {
      const idx = activeParaLineIndex;
      setLines((prev) => {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], paraId: p.id, paraKodu: p.kod };
        return updated;
      });

      // Focus the Miktar input for this row (do not open new row until amount is entered)
      setTimeout(() => {
        miktarInputRefs.current[idx]?.focus();
        miktarInputRefs.current[idx]?.select();
      }, 50);
    }
    setActiveParaLineIndex(null);
  };

  // Keyboard navigation
  const handleSmbKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    // If suggestions dropdown is visible
    if (activeSmbSuggestIdx === idx && smbSuggestItems.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedSuggestIdx((prev) => (prev + 1) % smbSuggestItems.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedSuggestIdx((prev) => (prev - 1 + smbSuggestItems.length) % smbSuggestItems.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const itemToSelect = smbSuggestItems[selectedSuggestIdx] || smbSuggestItems[0];
        if (itemToSelect) {
          handleSelectSuggestPara(idx, itemToSelect);
          return;
        }
      }
      if (e.key === "Escape") {
        setActiveSmbSuggestIdx(null);
        return;
      }
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const val = lines[idx].paraKodu.trim().toUpperCase();
      const matched = paraList.find((p) => p.kod.toUpperCase() === val);
      if (matched) {
        handleSelectSuggestPara(idx, matched);
      } else if (smbSuggestItems.length > 0) {
        handleSelectSuggestPara(idx, smbSuggestItems[0]);
      } else {
        // Move to Miktar
        miktarInputRefs.current[idx]?.focus();
        miktarInputRefs.current[idx]?.select();
      }
      setActiveSmbSuggestIdx(null);
    } else if (e.key === "Backspace" && !lines[idx].paraKodu && lines.length > 1) {
      // Empty row backspace: delete line and focus previous row's Miktar
      e.preventDefault();
      handleRemoveLine(idx);
      const prevIdx = Math.max(0, idx - 1);
      setTimeout(() => {
        miktarInputRefs.current[prevIdx]?.focus();
      }, 50);
    }
  };

  const handleMiktarKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const currentMeblag = String(lines[idx].meblag).trim();
      const hasValidAmount = currentMeblag !== "" && !isNaN(Number(currentMeblag)) && Number(currentMeblag) > 0;

      // Rule: Do NOT open new line unless amount is entered
      if (!hasValidAmount) {
        return;
      }

      if (idx === lines.length - 1) {
        // Last row with valid amount: open new line and focus its SMB field
        setLines((prev) => [
          ...prev,
          {
            id: `line-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            paraId: 0,
            paraKodu: "",
            meblag: "",
          },
        ]);
        setTimeout(() => {
          smbInputRefs.current[idx + 1]?.focus();
        }, 50);
      } else {
        // Move to existing next row's SMB field
        smbInputRefs.current[idx + 1]?.focus();
      }
    } else if (e.key === "Backspace" && !lines[idx].meblag) {
      // If Miktar is empty and backspace pressed, return focus to SMB
      smbInputRefs.current[idx]?.focus();
    }
  };

  // Drag and Drop handlers for row reordering
  const handleDragStart = (e: React.DragEvent<HTMLTableRowElement>, idx: number) => {
    setDraggedIndex(idx);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", `${idx}`);
  };

  const handleDragOver = (e: React.DragEvent<HTMLTableRowElement>, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIndex !== idx) {
      setDragOverIndex(idx);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLTableRowElement>, targetIdx: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== targetIdx) {
      setLines((prev) => {
        const next = [...prev];
        const [moved] = next.splice(draggedIndex, 1);
        next.splice(targetIdx, 0, moved);
        return next;
      });
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };



  // Print voucher
  const handlePrint = () => {
    if (!cariKartId) return;
    printReportTable({
      title: "Cari Hareket Makbuzu",
      subtitle: `${cariKod} - ${cariAd} | Tarih: ${tarih} | Vezne: ${vezneKod} | ${cariTipi === 0 ? "BORÇ" : "ALACAK"}`,
      data: lines
        .filter((l) => Number(l.meblag) > 0)
        .map((l, i) => ({
          satir: i + 1,
          paraKodu: l.paraKodu,
          meblag: new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2 }).format(Number(l.meblag)),
          islemTipi: cariTipi === 0 ? "Borç" : "Alacak",
          aciklama: aciklama || "-",
        })),
      columns: [
        { header: "#", key: "satir", width: "10%" },
        { header: "Para / SMB", key: "paraKodu", width: "25%" },
        { header: "Miktar / Meblağ", key: "meblag", width: "30%" },
        { header: "İşlem", key: "islemTipi", width: "15%" },
        { header: "Açıklama", key: "aciklama", width: "20%" },
      ],
    });
  };

  const pageTitle = isEditMode
    ? `D- Cari Hareket Düzeltme ${currentHareketId ? `(#${currentHareketId})` : ""}`
    : `C- Cari Hareket Kayıt ${currentHareketId ? `(#${currentHareketId})` : ""}`;

  return (
    <div className="cari-hareket-container pb-5">
      {/* 1. ERP Toolbar */}
      <ERPToolbar
        pageTitle={pageTitle}
        onNew={handleNewRecord}
        onSave={handleSave}
        onSearch={isEditMode ? handleOpenSearchModal : undefined}
        onDelete={isEditMode && currentHareketId ? () => setShowDeleteModal(true) : undefined}
        hideSearch={!isEditMode}
        hideDelete={!isEditMode}
        onFirst={navInfo.firstId ? handleNavFirst : undefined}
        onPrev={navInfo.prevId ? handleNavPrev : undefined}
        onNext={navInfo.nextId ? handleNavNext : undefined}
        onLast={navInfo.lastId ? handleNavLast : undefined}
        onPrint={handlePrint}
        onRefresh={() => {
          if (cariKartId) loadCariBakiye(cariKartId);
          if (currentHareketId) loadRecordById(currentHareketId);
        }}
        onClear={handleNewRecord}
        disabled={isSaving}
      />

      {/* 2. Feedback Alerts */}
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)} className="py-2 px-3 mb-3 shadow-sm">
          <div className="d-flex align-items-center gap-2">
            <IconAlertCircle size={18} className="text-danger flex-shrink-0" />
            <span>{error}</span>
          </div>
        </Alert>
      )}

      {successMsg && (
        <Alert variant="success" dismissible onClose={() => setSuccessMsg(null)} className="py-2 px-3 mb-3 shadow-sm">
          <div className="d-flex align-items-center gap-2">
            <IconCheck size={18} className="text-success flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        </Alert>
      )}

      {/* 3. Main Form & Balance Dual Panel */}
      <Row className="g-3">
        {/* SOL PANEL: Form & Satır Gridi */}
        <Col xs={12} lg={7} xl={7}>
          <Card className="border shadow-sm h-100 bg-white">
            <Card.Header className="bg-light py-2.5 px-3 border-bottom d-flex align-items-center justify-content-between">
              <span className="fw-bold text-dark d-flex align-items-center gap-2 fs-6">
                <IconCash size={18} className="text-primary" />
                Cari Hareket Bilgileri
              </span>
              {currentHareketId && (
                <Badge bg="primary" className="font-monospace fs-7">
                  Fiş No: #{currentHareketId}
                </Badge>
              )}
            </Card.Header>

            <Card.Body className="p-3">
              {/* Row 1: Vezne */}
              <div className="mb-2.5 row g-2 align-items-center">
                <label className="col-sm-3 col-form-label fw-semibold text-secondary small">Vezne</label>
                <div className="col-sm-9">
                  <div className="d-flex gap-2">
                    <div style={{ width: "170px", minWidth: "150px", flexShrink: 0 }}>
                      <Form.Control
                        type="text"
                        readOnly
                        disabled
                        value={vezneKod}
                        title="Vezne otomatik olarak atanır ve değiştirilemez."
                        className="bg-light text-secondary fw-semibold font-monospace small"
                      />
                    </div>
                    <Form.Control
                      type="text"
                      readOnly
                      disabled
                      value={vezneAd}
                      className="bg-light text-muted small"
                    />
                  </div>
                </div>
              </div>

              {/* Row 2: Cari Kod */}
              <div className="mb-2.5 row g-2 align-items-center">
                <label className="col-sm-3 col-form-label fw-semibold text-secondary small">Kod</label>
                <div className="col-sm-9">
                  <div style={{ maxWidth: "260px", position: "relative" }}>
                    <CodeLookupInput
                      value={cariKod}
                      onChange={(e) => handleCariKodChange(e.target.value)}
                      onKeyDown={handleCariKodKeyDown}
                      onBlur={() => setTimeout(() => setShowCariSuggest(false), 250)}
                      onLookupClick={() => setShowCariModal(true)}
                      placeholder=""
                      data-custom-enter={showCariSuggest && cariSuggestItems.length > 0 ? "true" : undefined}
                    />

                    {/* Cari Kod Autocomplete Dropdown */}
                    {showCariSuggest && cariSuggestItems.length > 0 && (
                      <div
                        style={{
                          position: "absolute",
                          top: "100%",
                          left: 0,
                          width: "320px",
                          zIndex: 1050,
                          maxHeight: "220px",
                          overflowY: "auto",
                          backgroundColor: "#ffffff",
                          border: "1px solid #7f9db9",
                          borderRadius: "4px",
                          boxShadow: "0 6px 16px rgba(0,0,0,0.18)",
                        }}
                      >
                        <div
                          style={{
                            padding: "4px 8px",
                            fontSize: "11px",
                            fontWeight: "bold",
                            backgroundColor: "#f8fafc",
                            borderBottom: "1px solid #e2e8f0",
                            color: "#64748b",
                            display: "flex",
                            justifyContent: "space-between",
                          }}
                        >
                          <span>Eşleşen Cari Kartlar ({cariSuggestItems.length})</span>
                          <span style={{ fontSize: "10px", fontWeight: "normal" }}>Seçmek için tıklayın</span>
                        </div>
                        {cariSuggestItems.map((c, cIdx) => {
                          const isSelected = cIdx === selectedCariSuggestIdx;
                          return (
                            <div
                              key={c.id}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleSelectCariSuggest(c);
                              }}
                              style={{
                                padding: "6px 10px",
                                cursor: "pointer",
                                backgroundColor: isSelected ? "#bae6fd" : "#ffffff",
                                color: isSelected ? "#0369a1" : "#1e293b",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                borderBottom: "1px solid #f1f5f9",
                                gap: "8px",
                              }}
                              onMouseEnter={() => setSelectedCariSuggestIdx(cIdx)}
                            >
                              <span style={{ fontFamily: "monospace", fontWeight: "bold", fontSize: "12px", minWidth: "65px" }}>
                                {c.kod}
                              </span>
                              <span style={{ fontSize: "12px", flexGrow: 1, textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {c.ad}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Row 3: Cari Ad */}
              <div className="mb-2.5 row g-2 align-items-center">
                <label className="col-sm-3 col-form-label fw-semibold text-secondary small">Ad</label>
                <div className="col-sm-9">
                  <div className="input-group">
                    <Form.Control
                      type="text"
                      value={cariAd}
                      onChange={(e) => {
                        setCariAd(e.target.value);
                      }}
                    />
                    <Button
                      variant="outline-secondary"
                      type="button"
                      onClick={() => setShowCariModal(true)}
                      title="Cari Kart Seçimi"
                      className="bg-light border-start-0 text-primary"
                    >
                      <IconBinoculars size={17} />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Row 4: Tarih */}
              <div className="mb-2.5 row g-2 align-items-center">
                <label className="col-sm-3 col-form-label fw-semibold text-secondary small">Tarih</label>
                <div className="col-sm-9">
                  <div style={{ maxWidth: "220px" }}>
                    <Form.Control
                      type="date"
                      value={tarih}
                      onChange={(e) => setTarih(e.target.value)}
                      className="small"
                    />
                  </div>
                </div>
              </div>

              {/* Row 5: Hareket Tipi */}
              <div className="mb-2.5 row g-2 align-items-center">
                <label className="col-sm-3 col-form-label fw-semibold text-secondary small">Hareket tipi</label>
                <div className="col-sm-9">
                  <div style={{ maxWidth: "220px" }}>
                    <Form.Select
                      value={hareketTipi}
                      onChange={(e) => setHareketTipi(Number(e.target.value))}
                      className="small"
                    >
                      {HAREKET_TIPI_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </Form.Select>
                  </div>
                </div>
              </div>

              {/* Row 6: Açıklama */}
              <div className="mb-3 row g-2 align-items-center">
                <label className="col-sm-3 col-form-label fw-semibold text-secondary small">Açıklama</label>
                <div className="col-sm-9">
                  <Form.Control
                    type="text"
                    value={aciklama}
                    onChange={(e) => setAciklama(e.target.value)}
                    maxLength={100}
                  />
                </div>
              </div>

              <hr className="my-3 text-secondary opacity-25" />

              {/* Row 7: Sub-Grid (Satırlar Gridi) */}
              <div className="mb-3 row g-2 align-items-start">
                <div className="col-sm-3"></div>
                <div className="col-sm-9">
                  <div
                    style={{
                      maxWidth: "340px",
                      border: "1px solid #99b4d1",
                      backgroundColor: "#ffffff",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                    }}
                  >
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        tableLayout: "fixed",
                      }}
                    >
                      <thead>
                        <tr style={{ backgroundColor: "#b9dcfe" }}>
                          <th
                            style={{
                              width: "48%",
                              backgroundColor: "#b9dcfe",
                              color: "#000000",
                              fontSize: "13px",
                              fontWeight: "normal",
                              textAlign: "center",
                              padding: "4px 8px",
                              borderRight: "1px solid #99b4d1",
                              borderBottom: "1px solid #99b4d1",
                              userSelect: "none",
                            }}
                          >
                            SMB
                          </th>
                          <th
                            style={{
                              width: "52%",
                              backgroundColor: "#b9dcfe",
                              color: "#000000",
                              fontSize: "13px",
                              fontWeight: "normal",
                              textAlign: "center",
                              padding: "4px 8px",
                              borderBottom: "1px solid #99b4d1",
                              userSelect: "none",
                            }}
                          >
                            Miktar
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((line, idx) => {
                          const isDragged = draggedIndex === idx;
                          const isDragOver = dragOverIndex === idx && draggedIndex !== idx;
                          const isActiveRow = activeGridRowIdx === idx;
                          const rowBgColor = isDragOver ? "#e0f2fe" : (isActiveRow ? "#bae6fd" : "#ffffff");

                          return (
                            <tr
                              key={line.id}
                              draggable={true}
                              onClick={() => setActiveGridRowIdx(idx)}
                              onDragStart={(e) => handleDragStart(e, idx)}
                              onDragOver={(e) => handleDragOver(e, idx)}
                              onDragEnd={handleDragEnd}
                              onDrop={(e) => handleDrop(e, idx)}
                              onContextMenu={(e) => {
                                if (lines.length > 1) {
                                  e.preventDefault();
                                  handleRemoveLine(idx);
                                }
                              }}
                              style={{
                                opacity: isDragged ? 0.35 : 1,
                                backgroundColor: rowBgColor,
                                borderTop: isDragOver ? "2px solid #2563eb" : undefined,
                                cursor: "grab",
                              }}
                              title="Sürükleyerek sırasını değiştirebilirsiniz (Sağ tık: Satırı sil)"
                            >
                              {/* SMB Sütunu */}
                              <td
                                style={{
                                  padding: 0,
                                  borderRight: "1px solid #99b4d1",
                                  borderBottom: "1px solid #99b4d1",
                                  position: "relative",
                                  backgroundColor: rowBgColor,
                                  height: "26px",
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    height: "100%",
                                    width: "100%",
                                  }}
                                >
                                  <input
                                    ref={(el) => {
                                      smbInputRefs.current[idx] = el;
                                    }}
                                    type="text"
                                    data-custom-enter="true"
                                    value={line.paraKodu}
                                    onFocus={() => setActiveGridRowIdx(idx)}
                                    onChange={(e) => handleLineSmbTextChange(idx, e.target.value)}
                                    onKeyDown={(e) => handleSmbKeyDown(e, idx)}
                                    onBlur={() => setTimeout(() => setActiveSmbSuggestIdx(null), 250)}
                                    placeholder=""
                                    style={{
                                      border: "none",
                                      outline: "none",
                                      width: "100%",
                                      height: "100%",
                                      padding: "2px 4px",
                                      fontSize: "13px",
                                      fontFamily: "monospace, sans-serif",
                                      fontWeight: "600",
                                      color: "#000000",
                                      backgroundColor: "transparent",
                                      cursor: "text",
                                    }}
                                  />
                                  <button
                                    type="button"
                                    tabIndex={-1}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setActiveGridRowIdx(idx);
                                      setActiveParaLineIndex(idx);
                                      setShowParaModal(true);
                                    }}
                                    title="Para Birimi Seç"
                                    style={{
                                      width: "22px",
                                      height: "22px",
                                      minWidth: "22px",
                                      marginRight: "2px",
                                      padding: 0,
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      backgroundColor: "#ece9d8",
                                      border: "1px solid #7f9db9",
                                      borderRadius: "1px",
                                      cursor: "pointer",
                                      boxShadow: "inset 1px 1px 0px #ffffff, inset -1px -1px 0px #b0ada6",
                                    }}
                                  >
                                    <div
                                      style={{
                                        position: "relative",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                      }}
                                    >
                                      <IconBinoculars size={13} color="#1e3a8a" />
                                      <svg
                                        width="8"
                                        height="8"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="#2563eb"
                                        strokeWidth="3.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        style={{
                                          position: "absolute",
                                          top: "-4px",
                                          right: "-3px",
                                        }}
                                      >
                                        <polyline points="9 14 4 9 9 4" />
                                        <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
                                      </svg>
                                    </div>
                                  </button>

                                  {/* SMB Autocomplete Dropdown */}
                                  {activeSmbSuggestIdx === idx && smbSuggestItems.length > 0 && (
                                    <div
                                      style={{
                                        position: "absolute",
                                        top: "100%",
                                        left: 0,
                                        width: "260px",
                                        zIndex: 1050,
                                        maxHeight: "190px",
                                        overflowY: "auto",
                                        backgroundColor: "#ffffff",
                                        border: "1px solid #7f9db9",
                                        borderRadius: "3px",
                                        boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
                                      }}
                                    >
                                      <div
                                        style={{
                                          padding: "3px 8px",
                                          fontSize: "10px",
                                          fontWeight: "bold",
                                          backgroundColor: "#f8fafc",
                                          borderBottom: "1px solid #e2e8f0",
                                          color: "#64748b",
                                        }}
                                      >
                                        Kayıtlı Para Birimleri ({smbSuggestItems.length})
                                      </div>
                                      {smbSuggestItems.map((p, pIdx) => {
                                        const isSelected = pIdx === selectedSuggestIdx;
                                        return (
                                          <div
                                            key={p.id}
                                            onMouseDown={(e) => {
                                              e.preventDefault();
                                              handleSelectSuggestPara(idx, p);
                                            }}
                                            style={{
                                              padding: "5px 10px",
                                              fontSize: "12px",
                                              cursor: "pointer",
                                              backgroundColor: isSelected ? "#e0f2fe" : "#ffffff",
                                              color: isSelected ? "#0369a1" : "#1e293b",
                                              display: "flex",
                                              alignItems: "center",
                                              justifyContent: "space-between",
                                              borderBottom: "1px solid #f1f5f9",
                                            }}
                                            onMouseEnter={() => setSelectedSuggestIdx(pIdx)}
                                          >
                                            <span style={{ fontFamily: "monospace", fontWeight: "bold" }}>
                                              {p.kod}
                                            </span>
                                            <span style={{ fontSize: "11px", color: "#64748b" }}>
                                              {p.ad}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </td>

                              {/* Miktar Sütunu */}
                              <td
                                style={{
                                  padding: 0,
                                  borderBottom: "1px solid #99b4d1",
                                  backgroundColor: rowBgColor,
                                  height: "26px",
                                }}
                              >
                                <input
                                  ref={(el) => {
                                    miktarInputRefs.current[idx] = el;
                                  }}
                                  type="number"
                                  step="any"
                                  data-custom-enter="true"
                                  value={line.meblag}
                                  onFocus={() => setActiveGridRowIdx(idx)}
                                  onChange={(e) => handleLineMeblagChange(idx, e.target.value)}
                                  onKeyDown={(e) => handleMiktarKeyDown(e, idx)}
                                  style={{
                                    border: "none",
                                    outline: "none",
                                    width: "100%",
                                    height: "100%",
                                    padding: "2px 6px",
                                    fontSize: "13px",
                                    fontFamily: "monospace, sans-serif",
                                    fontWeight: "600",
                                    textAlign: "right",
                                    color: "#000000",
                                    backgroundColor: "transparent",
                                    cursor: "text",
                                  }}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Row 8: Cari Tipi (Borç / Alacak) */}
              <div className="mb-4 row g-2 align-items-center">
                <label className="col-sm-3 col-form-label fw-semibold text-secondary small">Cari tipi</label>
                <div className="col-sm-9">
                  <ButtonGroup className="w-100" style={{ maxWidth: "260px" }}>
                    <Button
                      type="button"
                      variant={cariTipi === 0 ? "danger" : "outline-secondary"}
                      onClick={() => setCariTipi(0)}
                      className="py-1.5 fw-bold"
                    >
                      Borç
                    </Button>
                    <Button
                      type="button"
                      variant={cariTipi === 1 ? "success" : "outline-secondary"}
                      onClick={() => setCariTipi(1)}
                      className="py-1.5 fw-bold"
                    >
                      Alacak
                    </Button>
                  </ButtonGroup>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* SAĞ PANEL: Cari Bakiye Durumu */}
        <Col xs={12} lg={5} xl={5}>
          <Card className="border shadow-sm h-100 bg-white">
            {/* Header: HAS / Net Bakiye Özeti */}
            <div
              className="py-3 px-3 border-bottom text-center text-dark"
              style={{
                background: "linear-gradient(135deg, #f8fafc 0%, #edf2f7 100%)",
              }}
            >
              <div className="text-muted small fw-semibold text-uppercase tracking-wider mb-1">
                Net Cari Durumu
              </div>
              <h3 className="mb-0 fw-bold font-monospace" style={{ letterSpacing: "-0.5px" }}>
                {bakiyeSummary?.headerLabel || "HAS 0.00"}
              </h3>
              {cariKartId && (
                <div className="mt-1 small text-secondary">
                  <strong>{cariKod}</strong> - {cariAd}
                </div>
              )}
            </div>

            <Card.Body className="p-0">
              {isLoadingBakiye ? (
                <div className="p-5 text-center text-muted">
                  <Spinner animation="border" size="sm" className="me-2 text-primary" />
                  Bakiye hesaplanıyor...
                </div>
              ) : !cariKartId ? (
                <div className="p-5 text-center text-muted">
                  <IconCoins size={36} className="text-secondary opacity-50 mb-2" />
                  <p className="mb-1 fw-semibold text-dark">Henüz Cari Seçilmedi</p>
                  <p className="small text-muted mb-0">
                    Bakiye durumunu anlık görüntülemek için soldan cari kart seçiniz.
                  </p>
                </div>
              ) : !bakiyeSummary || bakiyeSummary.satirlar.length === 0 ? (
                <div className="p-4 text-center text-muted">
                  <p className="mb-0 small">Bu cariye ait henüz kayıtlı hareket veya bakiye bulunmuyor.</p>
                </div>
              ) : (
                <div className="table-responsive" style={{ maxHeight: "440px" }}>
                  <Table hover size="sm" className="mb-0 align-middle">
                    <thead
                      style={{
                        backgroundColor: "#bae6fd",
                        color: "#0369a1",
                        position: "sticky",
                        top: 0,
                        zIndex: 1,
                      }}
                    >
                      <tr>
                        <th className="py-2 px-3 fw-bold">Kod</th>
                        <th className="py-2 px-3 fw-bold text-end">Borç bakiye</th>
                        <th className="py-2 px-3 fw-bold text-end">Alacak bakiye</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bakiyeSummary.satirlar.map((row) => (
                        <tr key={row.paraId}>
                          <td className="py-2 px-3 font-monospace fw-bold text-dark">
                            {row.kod}
                          </td>
                          <td className="py-2 px-3 text-end font-monospace">
                            {row.borcBakiye > 0 ? (
                              <span className="fw-bold text-danger">
                                {new Intl.NumberFormat("tr-TR", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                }).format(row.borcBakiye)}
                              </span>
                            ) : (
                              <span className="text-muted opacity-40">-</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-end font-monospace">
                            {row.alacakBakiye > 0 ? (
                              <span className="fw-bold text-success">
                                {new Intl.NumberFormat("tr-TR", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                }).format(row.alacakBakiye)}
                              </span>
                            ) : (
                              <span className="text-muted opacity-40">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </Card.Body>

            {/* Bakiye Card Footer */}
            {cariKartId && (
              <Card.Footer className="bg-light py-2 px-3 d-flex align-items-center justify-content-between">
                <span className="small text-muted">
                  Toplam <strong>{bakiyeSummary?.satirlar.length || 0}</strong> aktif para birimi
                </span>
                <Button
                  size="sm"
                  variant="link"
                  className="p-0 text-decoration-none small d-flex align-items-center gap-1"
                  onClick={() => loadCariBakiye(cariKartId)}
                >
                  <IconRefresh size={14} />
                  Yenile
                </Button>
              </Card.Footer>
            )}
          </Card>
        </Col>
      </Row>

      {/* 4. MODALS */}

      {/* Cari Kart Lookup Modal */}
      <LookupModal<CariKartItem>
        show={showCariModal}
        onHide={() => setShowCariModal(false)}
        title="Cari Kart Seçimi"
        items={cariList}
        isLoading={isLoadingLookups}
        searchPlaceholder="Cari kodu, ünvan, telefon veya vergi no ile arayın..."
        columns={[
          { header: "Kod", width: "120px", render: (c) => <span className="font-monospace fw-bold">{c.kod}</span> },
          { header: "Ünvan / Ad", render: (c) => <span>{c.ad}</span> },
          { header: "Telefon", width: "130px", render: (c) => <span>{c.telefon || "-"}</span> },
          { header: "Vergi No", width: "120px", render: (c) => <span>{c.vergiKimlikNo || "-"}</span> },
        ]}
        filterFn={(c, term) => {
          const t = term.toLowerCase();
          return (
            c.kod.toLowerCase().includes(t) ||
            c.ad.toLowerCase().includes(t) ||
            (c.telefon && c.telefon.includes(t)) ||
            (c.vergiKimlikNo && c.vergiKimlikNo.includes(t))
          );
        }}
        onSelect={handleSelectCari}
      />

      {/* Para Birimi Lookup Modal (Grid Line SMB) */}
      <LookupModal<ParaItem>
        show={showParaModal}
        onHide={() => {
          setShowParaModal(false);
          setActiveParaLineIndex(null);
        }}
        title="Para Birimi / SMB Seçimi"
        items={paraList}
        isLoading={isLoadingLookups}
        searchPlaceholder="Para kodu veya adı ile arayın..."
        columns={[
          { header: "Kod / SMB", width: "120px", render: (p) => <span className="font-monospace fw-bold">{p.kod}</span> },
          { header: "Açıklama", render: (p) => <span>{p.ad}</span> },
          { header: "Has Oranı", width: "100px", align: "right", render: (p) => <span className="font-monospace">{p.hasOrani ?? 1}</span> },
        ]}
        filterFn={(p, term) => {
          const t = term.toLowerCase();
          return p.kod.toLowerCase().includes(t) || p.ad.toLowerCase().includes(t);
        }}
        onSelect={handleSelectParaForLine}
      />

      {/* Cari Hareket Arama / Fiş Seçimi Modalı (F3) */}
      <LookupModal<CariHareketItem>
        show={showSearchModal}
        onHide={() => setShowSearchModal(false)}
        title="Kayıtlı Cari Hareket Fişleri (Arama & Seçim)"
        items={allHareketler}
        isLoading={isLoadingSearch}
        searchPlaceholder="Fiş no, cari adı, açıklama veya vezne ile arayın..."
        columns={[
          {
            header: "Tarih",
            width: "100px",
            render: (h) => (
              <span className="small">
                {h.tarih ? new Date(h.tarih).toLocaleDateString("tr-TR") : "-"}
              </span>
            ),
          },
          { header: "Fiş No", width: "80px", render: (h) => <span className="font-monospace fw-bold">#{h.id}</span> },
          {
            header: "Cari",
            render: (h) => (
              <div>
                <div className="fw-semibold">{h.cariAd}</div>
                <div className="small text-muted font-monospace">{h.cariKod}</div>
              </div>
            ),
          },
          {
            header: "İşlem",
            width: "90px",
            align: "center",
            render: (h) => (
              <Badge bg={h.tip === 0 ? "danger" : "success"}>
                {h.tip === 0 ? "Borç" : "Alacak"}
              </Badge>
            ),
          },
          {
            header: "Satırlar Özeti",
            render: (h) => <span className="small text-secondary font-monospace">{h.satirlarOzet || "-"}</span>,
          },
        ]}
        filterFn={(h, term) => {
          const t = term.toLowerCase();
          return (
            String(h.id).includes(t) ||
            h.cariKod.toLowerCase().includes(t) ||
            h.cariAd.toLowerCase().includes(t) ||
            h.aciklama.toLowerCase().includes(t) ||
            h.vezneKod.toLowerCase().includes(t) ||
            (h.satirlarOzet && h.satirlarOzet.toLowerCase().includes(t))
          );
        }}
        onSelect={(h) => {
          loadRecordById(h.id);
        }}
      />

      {/* Silme Onay Modalı */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered size="sm">
        <Modal.Header closeButton className="py-2.5 bg-light">
          <Modal.Title className="fs-6 fw-bold text-danger d-flex align-items-center gap-2">
            <IconTrash size={18} />
            Kaydı Sil
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="py-3 text-center">
          <p className="mb-1">
            <strong>#{currentHareketId}</strong> numaralı cari hareket kaydını silmek istediğinize emin misiniz?
          </p>
          <small className="text-muted">Bu işlem geri alınamaz.</small>
        </Modal.Body>
        <Modal.Footer className="py-2 bg-light d-flex justify-content-between">
          <Button variant="secondary" size="sm" onClick={() => setShowDeleteModal(false)}>
            İptal
          </Button>
          <Button variant="danger" size="sm" onClick={handleDeleteConfirm} disabled={isSaving}>
            Evet, Sil
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default CariHareketPage;
