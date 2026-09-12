import React, { useState, useEffect, useCallback, useRef } from "react";
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
  InputGroup,
  Modal,
} from "react-bootstrap";
import {
  IconCash,
  IconCheck,
  IconTrash,
  IconBinoculars,
  IconArrowsExchange,
  IconPrinter,
  IconAlertTriangle,
} from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import LookupModal, { LookupColumn } from "../../components/common/LookupModal";
import { CashDeskService, VezneItem } from "../../services/cashDeskService";
import { ProductDefinitionService, ProductItem } from "../../services/productDefinitionService";
import {
  VezneTransferiService,
  VezneTransferiModel,
  VezneTransferiListItem,
} from "../../services/vezneTransferiService";
import { ParaSaymaModal, ParaSaymaCurrencyItem } from "./ParaSaymaModal";
import { useAuth } from "../../context/AuthContext";

interface TransferGridRow {
  id: string;
  satirNo: number;
  paraId: number;
  paraKodu: string;
  paraAdi: string;
  miktar: number | string;
}

export const VezneTransferiPage: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryId = searchParams.get("id") || searchParams.get("transferId");
  const isDuzeltmeMode = location.pathname.includes("duzeltme");

  // Notifications
  const [notification, setNotification] = useState<{
    type: "success" | "danger" | "warning" | "info";
    message: string;
  } | null>(null);

  // Lookups
  const [vezneList, setVezneList] = useState<VezneItem[]>([]);
  const [paraList, setParaList] = useState<{ id: number; kod: string; ad: string }[]>([]);
  const [isLoadingLookups, setIsLoadingLookups] = useState<boolean>(true);

  // Modals
  const [showAlanVezneModal, setShowAlanVezneModal] = useState<boolean>(false);
  const [showVerenVezneModal, setShowVerenVezneModal] = useState<boolean>(false);
  const [showParaModal, setShowParaModal] = useState<boolean>(false);
  const [activeRowIdForPara, setActiveRowIdForPara] = useState<string | null>(null);
  const [showSearchModal, setShowSearchModal] = useState<boolean>(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState<boolean>(false);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [showParaSayModal, setShowParaSayModal] = useState<boolean>(false);
  const [banknotCounts, setBanknotCounts] = useState<Record<string, Record<number, number>>>({});

  // Transfer list for search modal
  const [transferList, setTransferList] = useState<VezneTransferiListItem[]>([]);
  const [isLoadingTransferList, setIsLoadingTransferList] = useState<boolean>(false);

  // Active Transfer Form State - All default to EMPTY on new record
  const [transferId, setTransferId] = useState<number | null>(null);
  const [tarih, setTarih] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [refNo, setRefNo] = useState<string>("");
  const [alanVezneId, setAlanVezneId] = useState<number>(0);
  const [alanVezneKod, setAlanVezneKod] = useState<string>("");
  const [alanVezneAd, setAlanVezneAd] = useState<string>("");
  const [verenVezneId, setVerenVezneId] = useState<number>(0);
  const [verenVezneKod, setVerenVezneKod] = useState<string>("");
  const [verenVezneAd, setVerenVezneAd] = useState<string>("");
  const [aciklama, setAciklama] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Helper: create blank row
  const createEmptyRow = (satirNo: number = 1): TransferGridRow => ({
    id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    satirNo,
    paraId: 0,
    paraKodu: "",
    paraAdi: "",
    miktar: "",
  });

  const [lines, setLines] = useState<TransferGridRow[]>([createEmptyRow(1)]);
  const [activeRowIndex, setActiveRowIndex] = useState<number>(0);
  const rowInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Helper to determine the logged-in user's assigned vezne
  const getUserVezne = useCallback(
    (list: VezneItem[]): VezneItem | undefined => {
      if (!list || list.length === 0) return undefined;
      const target = String(user?.cashierCode || "").trim().toLowerCase();
      let matched: VezneItem | undefined;
      if (target) {
        matched = list.find(
          (v) =>
            String(v.id).toLowerCase() === target ||
            v.kod.toLowerCase() === target
        );
        if (!matched && !isNaN(Number(target))) {
          const targetNum = Number(target);
          matched = list.find((v) => v.id === targetNum);
        }
      }
      if (!matched && list.length > 0) {
        matched = list[0];
      }
      return matched;
    },
    [user?.cashierCode]
  );

  // Load lookups (Vezneler & Paralar)
  useEffect(() => {
    let mounted = true;
    const fetchLookups = async () => {
      setIsLoadingLookups(true);
      try {
        const [vezneler, paralar] = await Promise.all([
          CashDeskService.getVezneler().catch(() => []),
          ProductDefinitionService.getProducts().catch(async () => {
            const fallbackCurrencies = await CashDeskService.getCurrencies().catch(() => []);
            return fallbackCurrencies.map((c) => ({ id: c.id, kod: c.code, ad: c.name } as ProductItem));
          }),
        ]);

        if (mounted) {
          setVezneList(vezneler);
          setParaList(paralar.map((p) => ({ id: p.id, kod: p.kod.trim(), ad: p.ad.trim() })));

          if (!queryId) {
            const uv = getUserVezne(vezneler);
            if (uv) {
              setAlanVezneId(uv.id);
              setAlanVezneKod(uv.kod);
              setAlanVezneAd(uv.ad);
            }
          }
        }
      } catch (err) {
        console.error("Lookup yükleme hatası:", err);
      } finally {
        if (mounted) setIsLoadingLookups(false);
      }
    };

    fetchLookups();
    return () => {
      mounted = false;
    };
  }, [queryId, getUserVezne]);

  // Sync Alan Vezne with logged-in user when vezneList or user becomes available
  useEffect(() => {
    if (!queryId && transferId === null && alanVezneId === 0 && vezneList.length > 0) {
      const uv = getUserVezne(vezneList);
      if (uv) {
        setAlanVezneId(uv.id);
        setAlanVezneKod(uv.kod);
        setAlanVezneAd(uv.ad);
      }
    }
  }, [queryId, transferId, alanVezneId, vezneList, getUserVezne]);

  // Load transfer by ID if query parameter present
  const loadTransferById = useCallback(async (id: number) => {
    try {
      const data = await VezneTransferiService.getTransferById(id);
      if (data) {
        setTransferId(data.id);
        setTarih(data.tarih);
        setRefNo(data.refNo || "");
        setAlanVezneId(data.alanVezneId);
        setAlanVezneKod(data.alanVezneKod);
        setAlanVezneAd(data.alanVezneAd);
        setVerenVezneId(data.verenVezneId);
        setVerenVezneKod(data.verenVezneKod);
        setVerenVezneAd(data.verenVezneAd);
        setAciklama(data.aciklama || "");

        if (data.satirlar && data.satirlar.length > 0) {
          setLines(
            data.satirlar.map((s, idx) => ({
              id: `row-${idx}-${s.paraId}`,
              satirNo: idx + 1,
              paraId: s.paraId,
              paraKodu: s.paraKodu,
              paraAdi: s.paraAdi,
              miktar: s.miktar,
            }))
          );
        } else {
          setLines([createEmptyRow(1)]);
        }
        setNotification({
          type: "info",
          message: `${data.refNo || `#${data.id}`} numaralı vezne transfer kaydı yüklendi.`,
        });
      }
    } catch (err: any) {
      setNotification({
        type: "danger",
        message: err?.message || "Transfer kaydı yüklenemedi.",
      });
    }
  }, []);

  useEffect(() => {
    if (queryId) {
      const parsed = parseInt(queryId, 10);
      if (!isNaN(parsed) && parsed > 0) {
        loadTransferById(parsed);
      }
    }
  }, [queryId, loadTransferById]);

  // Reset / Clear form (All fields cleared, Alan Vezne reset to logged-in user's vezne)
  const resetForm = useCallback(() => {
    setTransferId(null);
    const now = new Date();
    setTarih(now.toISOString().split("T")[0]);
    setRefNo("");

    const uv = getUserVezne(vezneList);
    if (uv) {
      setAlanVezneId(uv.id);
      setAlanVezneKod(uv.kod);
      setAlanVezneAd(uv.ad);
    } else {
      setAlanVezneId(0);
      setAlanVezneKod("");
      setAlanVezneAd("");
    }

    setVerenVezneId(0);
    setVerenVezneKod("");
    setVerenVezneAd("");
    setAciklama("");
    setLines([createEmptyRow(1)]);
    setActiveRowIndex(0);
    setNotification(null);

    if (queryId) {
      navigate(location.pathname, { replace: true });
    }
  }, [getUserVezne, vezneList, queryId, navigate, location.pathname]);

  // Navigation handlers (|◀, ◀, ▶, ▶|)
  const handleNavigate = async (action: "first" | "prev" | "next" | "last") => {
    try {
      const nav = await VezneTransferiService.getNavigation(transferId);
      const targetId =
        action === "first"
          ? nav.firstId
          : action === "prev"
            ? nav.prevId
            : action === "next"
              ? nav.nextId
              : nav.lastId;

      if (targetId) {
        await loadTransferById(targetId);
      } else {
        setNotification({
          type: "warning",
          message:
            action === "prev" || action === "first"
              ? "İlk kayıttasınız."
              : "Son kayıttasınız.",
        });
      }
    } catch (e: any) {
      console.error("Gezinme hatası:", e);
    }
  };

  // Swap Alan and Veren vezne
  const handleSwapVezneler = () => {
    const tempId = alanVezneId;
    const tempKod = alanVezneKod;
    const tempAd = alanVezneAd;

    setAlanVezneId(verenVezneId);
    setAlanVezneKod(verenVezneKod);
    setAlanVezneAd(verenVezneAd);

    setVerenVezneId(tempId);
    setVerenVezneKod(tempKod);
    setVerenVezneAd(tempAd);
  };

  // Handle line input changes without auto-appending row (Enter on Miktar will append)
  const handleLineChange = (
    index: number,
    field: keyof TransferGridRow,
    value: any
  ) => {
    setLines((prev) => {
      const next = [...prev];
      const target = { ...next[index], [field]: value };

      if (field === "paraKodu") {
        const found = paraList.find(
          (p) => p.kod.toUpperCase() === String(value).trim().toUpperCase()
        );
        if (found) {
          target.paraId = found.id;
          target.paraAdi = found.ad;
        } else {
          target.paraId = 0;
          target.paraAdi = "";
        }
      }

      if (field === "miktar") {
        target.miktar = String(value).replace(/,/g, ".");
      }

      next[index] = target;
      return next;
    });
  };

  // Keyboard navigation across grid cells with Arrow keys & Enter
  const handleGridKeyDown = (
    e: React.KeyboardEvent<any>,
    idx: number,
    field: "kod" | "miktar"
  ) => {
    const el = e.currentTarget as HTMLInputElement;
    const len = el.value.length;
    const selStart = el.selectionStart ?? 0;
    const selEnd = el.selectionEnd ?? 0;
    const isAtStart = selStart === 0 && selEnd === 0;
    const isAtEnd = selStart === len && selEnd === len;

    // Right Arrow: transition to next input when cursor reaches end of text
    if (e.key === "ArrowRight") {
      if (isAtEnd) {
        if (field === "kod") {
          e.preventDefault();
          const nextInput = rowInputRefs.current[`miktar-${idx}`];
          if (nextInput) {
            nextInput.focus();
            nextInput.select();
            setActiveRowIndex(idx);
          }
        } else if (field === "miktar" && idx < lines.length - 1) {
          e.preventDefault();
          const nextInput = rowInputRefs.current[`kod-${idx + 1}`];
          if (nextInput) {
            nextInput.focus();
            nextInput.select();
            setActiveRowIndex(idx + 1);
          }
        }
      }
    }
    // Left Arrow: transition to previous input when cursor reaches start of text
    else if (e.key === "ArrowLeft") {
      if (isAtStart) {
        if (field === "miktar") {
          e.preventDefault();
          const prevInput = rowInputRefs.current[`kod-${idx}`];
          if (prevInput) {
            prevInput.focus();
            prevInput.select();
            setActiveRowIndex(idx);
          }
        } else if (field === "kod" && idx > 0) {
          e.preventDefault();
          const prevInput = rowInputRefs.current[`miktar-${idx - 1}`];
          if (prevInput) {
            prevInput.focus();
            prevInput.select();
            setActiveRowIndex(idx - 1);
          }
        }
      }
    }
    // Down Arrow: transition to row below
    else if (e.key === "ArrowDown") {
      if (idx < lines.length - 1) {
        e.preventDefault();
        const targetInput = rowInputRefs.current[`${field}-${idx + 1}`];
        if (targetInput) {
          targetInput.focus();
          targetInput.select();
          setActiveRowIndex(idx + 1);
        }
      }
    }
    // Up Arrow: transition to row above
    else if (e.key === "ArrowUp") {
      if (idx > 0) {
        e.preventDefault();
        const targetInput = rowInputRefs.current[`${field}-${idx - 1}`];
        if (targetInput) {
          targetInput.focus();
          targetInput.select();
          setActiveRowIndex(idx - 1);
        }
      }
    }
    // Enter key: jump between cells or append new row at the end of Miktar
    else if (e.key === "Enter") {
      e.preventDefault();
      if (field === "kod") {
        const nextInput = rowInputRefs.current[`miktar-${idx}`];
        if (nextInput) {
          nextInput.focus();
          nextInput.select();
          setActiveRowIndex(idx);
        }
      } else if (field === "miktar") {
        if (idx === lines.length - 1) {
          setLines((prev) => [...prev, createEmptyRow(prev.length + 1)]);
          setTimeout(() => {
            const nextKod = rowInputRefs.current[`kod-${idx + 1}`];
            if (nextKod) {
              nextKod.focus();
              nextKod.select();
              setActiveRowIndex(idx + 1);
            }
          }, 50);
        } else {
          const nextInput = rowInputRefs.current[`kod-${idx + 1}`];
          if (nextInput) {
            nextInput.focus();
            nextInput.select();
            setActiveRowIndex(idx + 1);
          }
        }
      }
    }
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 1) {
      setLines([createEmptyRow(1)]);
      return;
    }
    setLines((prev) => {
      const filtered = prev.filter((_, i) => i !== index);
      return filtered.map((r, i) => ({ ...r, satirNo: i + 1 }));
    });
  };

  // Toplu Transfer (F5): Fetches source vezne balances and populates grid
  const handleTopluTransfer = useCallback(async () => {
    if (!verenVezneId || verenVezneId <= 0) {
      setNotification({
        type: "warning",
        message: "Lütfen önce veren vezneyi seçiniz.",
      });
      return;
    }

    try {
      const bakiyeler = await VezneTransferiService.getVezneBakiyeler(verenVezneId);
      if (!bakiyeler || bakiyeler.length === 0) {
        setNotification({
          type: "warning",
          message: `${verenVezneAd || "Veren veznede"} pozitif bakiye bulunamadı.`,
        });
        return;
      }

      const newLines: TransferGridRow[] = bakiyeler.map((b, idx) => ({
        id: `bakiye-row-${idx}-${b.paraId}`,
        satirNo: idx + 1,
        paraId: b.paraId,
        paraKodu: b.paraKodu,
        paraAdi: b.paraAdi,
        miktar: b.miktar,
      }));

      setLines(newLines);
      setNotification({
        type: "success",
        message: `${verenVezneAd} kasasındaki ${bakiyeler.length} adet para bakiyesi transfer satırlarına yüklendi.`,
      });
    } catch (e: any) {
      setNotification({
        type: "danger",
        message: e?.message || "Toplu bakiye getirilemedi.",
      });
    }
  }, [verenVezneId, verenVezneAd]);

  // Para Say (F9) integration
  const paraSayCurrencies: ParaSaymaCurrencyItem[] = lines
    .filter((l) => l.paraId > 0 && l.paraKodu)
    .map((l) => ({
      paraId: l.paraId,
      kod: l.paraKodu,
      ad: l.paraAdi,
      sayilacak: Number(l.miktar) || 0,
    }));

  const handleOpenParaSay = useCallback(() => {
    setShowParaSayModal(true);
  }, []);

  const handleParaSayCountsChange = (
    newCounts: Record<string, Record<number, number>>
  ) => {
    setBanknotCounts(newCounts);
    setLines((prev) =>
      prev.map((row) => {
        const kod = row.paraKodu?.toUpperCase();
        if (kod && newCounts[kod]) {
          const total = Object.entries(newCounts[kod]).reduce(
            (sum, [kupur, adet]) => sum + Number(kupur) * Number(adet),
            0
          );
          if (total > 0) {
            return { ...row, miktar: total };
          }
        }
        return row;
      })
    );
  };

  // Save Transfer (SODVZ_VEZNE_TRANSFERI_KAYDET)
  const handleSave = useCallback(async () => {
    if (!alanVezneId || alanVezneId <= 0) {
      setNotification({ type: "warning", message: "Lütfen alan vezneyi seçiniz." });
      return;
    }
    if (!verenVezneId || verenVezneId <= 0) {
      setNotification({ type: "warning", message: "Lütfen veren vezneyi seçiniz." });
      return;
    }
    if (alanVezneId === verenVezneId) {
      setNotification({
        type: "warning",
        message: "Alan vezne ile veren vezne aynı olamaz. Lütfen farklı bir vezne seçiniz.",
      });
      return;
    }

    const validLines = lines.filter((l) => l.paraId > 0 && Number(l.miktar) > 0);
    if (validLines.length === 0) {
      setNotification({
        type: "warning",
        message: "Lütfen en az bir geçerli para birimi ve miktar giriniz.",
      });
      return;
    }

    setIsSaving(true);
    setNotification(null);

    try {
      const payload = {
        id: transferId,
        tarih,
        refNo: refNo.trim() || null,
        alanVezneId,
        verenVezneId,
        aciklama: aciklama.trim() || "",
        satirlar: validLines.map((l, idx) => ({
          satirNo: idx,
          paraId: l.paraId,
          paraKodu: l.paraKodu,
          paraAdi: l.paraAdi,
          miktar: Number(l.miktar),
        })),
      };

      const saved = await VezneTransferiService.saveTransfer(payload);
      const savedRef = saved.refNo || `#${saved.id}`;

      // Reset / Clear all input fields for the next transfer
      setTransferId(null);
      const now = new Date();
      setTarih(now.toISOString().split("T")[0]);
      setRefNo("");

      const uv = getUserVezne(vezneList);
      if (uv) {
        setAlanVezneId(uv.id);
        setAlanVezneKod(uv.kod);
        setAlanVezneAd(uv.ad);
      } else {
        setAlanVezneId(0);
        setAlanVezneKod("");
        setAlanVezneAd("");
      }

      setVerenVezneId(0);
      setVerenVezneKod("");
      setVerenVezneAd("");
      setAciklama("");
      setLines([createEmptyRow(1)]);
      setActiveRowIndex(0);

      if (queryId) {
        navigate(location.pathname, { replace: true });
      }

      setNotification({
        type: "success",
        message: `Vezne transferi başarıyla kaydedildi! (Ref No: ${savedRef})`,
      });
    } catch (err: any) {
      setNotification({
        type: "danger",
        message: err?.message || "Vezne transferi kaydedilemedi.",
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    alanVezneId,
    verenVezneId,
    lines,
    transferId,
    tarih,
    refNo,
    aciklama,
    getUserVezne,
    vezneList,
    queryId,
    navigate,
    location.pathname,
  ]);

  // Delete Transfer (SODVZ_VEZNE_TRANSFERI_SIL)
  const handleDelete = async () => {
    if (!transferId) {
      setNotification({ type: "warning", message: "Silinecek bir transfer kaydı seçili değil." });
      return;
    }

    try {
      await VezneTransferiService.deleteTransfer(transferId, true);
      setShowDeleteConfirmModal(false);
      resetForm();
      setNotification({
        type: "success",
        message: "Vezne transfer kaydı başarıyla silindi ve kasalar güncellendi.",
      });
    } catch (err: any) {
      setNotification({
        type: "danger",
        message: err?.message || "Vezne transferi silinemedi.",
      });
    }
  };

  // Search Past Transfers Modal
  const handleOpenSearchModal = async () => {
    setShowSearchModal(true);
    setIsLoadingTransferList(true);
    try {
      const list = await VezneTransferiService.getTransfers({ limit: 100 });
      setTransferList(list);
    } catch (e) {
      console.error("Transfer listesi getirme hatası:", e);
    } finally {
      setIsLoadingTransferList(false);
    }
  };

  // Keyboard shortcuts F1, F4, F5, F9, F10
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showAlanVezneModal || showVerenVezneModal || showParaModal || showSearchModal || showParaSayModal || showPrintModal || showDeleteConfirmModal) {
        return;
      }

      if (e.key === "F1") {
        e.preventDefault();
        handleSave();
      } else if (e.key === "F4") {
        e.preventDefault();
        resetForm();
      } else if (e.key === "F5") {
        e.preventDefault();
        handleTopluTransfer();
      } else if (e.key === "F9") {
        e.preventDefault();
        handleOpenParaSay();
      } else if (e.key === "F10") {
        e.preventDefault();
        setShowPrintModal(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    handleSave,
    resetForm,
    handleTopluTransfer,
    handleOpenParaSay,
    showAlanVezneModal,
    showVerenVezneModal,
    showParaModal,
    showSearchModal,
    showParaSayModal,
    showPrintModal,
    showDeleteConfirmModal,
  ]);

  // Lookup modal columns
  const vezneColumns: LookupColumn<VezneItem>[] = [
    { header: "Vezne Kodu", width: "100px", render: (item) => <strong>{item.kod}</strong> },
    { header: "Vezne Adı", render: (item) => item.ad },
  ];

  const paraColumns: LookupColumn<{ id: number; kod: string; ad: string }>[] = [
    {
      header: "Para Kodu",
      width: "100px",
      render: (item) => <Badge bg="primary">{item.kod}</Badge>,
    },
    { header: "Para Adı", render: (item) => item.ad },
  ];

  const searchColumns: LookupColumn<VezneTransferiListItem>[] = [
    {
      header: "Ref No",
      width: "110px",
      render: (item) => <strong>{item.refNo || `#${item.id}`}</strong>,
    },
    {
      header: "Tarih",
      width: "100px",
      render: (item) => new Date(item.tarih).toLocaleDateString("tr-TR"),
    },
    {
      header: "Alan Vezne",
      width: "140px",
      render: (item) => `${item.alanVezneKod} - ${item.alanVezneAd}`,
    },
    {
      header: "Veren Vezne",
      width: "140px",
      render: (item) => `${item.verenVezneKod} - ${item.verenVezneAd}`,
    },
    {
      header: "Kalem / Miktar",
      width: "120px",
      render: (item) => (
        <span className="text-end d-block">
          {item.satirSayisi} / {item.toplamMiktar.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    { header: "Açıklama", render: (item) => item.aciklama },
  ];

  return (
    <div className="vezne-transferi-container pb-2" style={{ maxWidth: "1000px", margin: "0 auto" }}>
      {/* Top ERP Toolbar */}
      <ERPToolbar
        onNew={resetForm}
        onSave={handleSave}
        onSearch={isDuzeltmeMode ? handleOpenSearchModal : undefined}
        onDelete={isDuzeltmeMode && transferId ? () => setShowDeleteConfirmModal(true) : undefined}
        onFirst={() => handleNavigate("first")}
        onPrev={() => handleNavigate("prev")}
        onNext={() => handleNavigate("next")}
        onLast={() => handleNavigate("last")}
        onPrint={() => setShowPrintModal(true)}
        onRefresh={handleTopluTransfer}
        pageTitle={isDuzeltmeMode ? "F- Vezne Transferi Düzeltme" : "E- Vezne Transferi Kayıt"}
        pageIcon={<IconCash size={20} className="text-primary" />}
        hideSearch={!isDuzeltmeMode}
        hideDelete={!isDuzeltmeMode}
        rightContent={
          <div className="d-flex align-items-center gap-1">
            {transferId && (
              <Badge bg="secondary" className="px-2 py-0.5 fs-8">
                #{transferId}
              </Badge>
            )}
            <Badge bg={isDuzeltmeMode ? "warning" : "primary"} className="px-2 py-0.5 fs-8">
              {isDuzeltmeMode ? "Düzeltme" : "Kayıt"}
            </Badge>
          </div>
        }
      />

      {/* Notification banner */}
      {notification && (
        <Alert
          variant={notification.type}
          dismissible
          onClose={() => setNotification(null)}
          className="mb-1 py-1 px-2.5 d-flex align-items-center justify-content-between shadow-2xs small"
        >
          <span>{notification.message}</span>
        </Alert>
      )}

      {/* Main Window Frame matching Desktop Screenshot */}
      <div className="bg-white border rounded shadow-2xs overflow-hidden mb-2">
        {/* Form Header Area with comfortable breathing room */}
        <div className="px-4 py-3 bg-white border-bottom">
          {/* Row 1: Tarih and Alan Vezne */}
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-2">
            {/* Tarih */}
            <div className="d-flex align-items-center gap-2">
              <span className="small text-secondary fw-semibold" style={{ width: "80px" }}>
                Tarih
              </span>
              <Form.Control
                type="date"
                size="sm"
                value={tarih}
                onChange={(e) => setTarih(e.target.value)}
                style={{ width: "160px", height: "28px", fontSize: "12.5px" }}
              />
            </div>

            {/* Alan Vezne */}
            <div className="d-flex align-items-center gap-2">
              <span className="small text-secondary fw-semibold" style={{ width: "85px" }}>
                Alan vezne
              </span>
              <InputGroup size="sm" style={{ width: "125px" }}>
                <Form.Control
                  type="text"
                  value={alanVezneKod}
                  onChange={(e) => {
                    const val = e.target.value;
                    setAlanVezneKod(val);
                    const found = vezneList.find(
                      (v) =>
                        v.kod.toLowerCase() === val.trim().toLowerCase() ||
                        String(v.id) === val.trim()
                    );
                    if (found) {
                      setAlanVezneId(found.id);
                      setAlanVezneAd(found.ad);
                    } else {
                      setAlanVezneId(0);
                      setAlanVezneAd("");
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "F8") {
                      e.preventDefault();
                      setShowAlanVezneModal(true);
                    }
                  }}
                  placeholder=""
                  style={{
                    backgroundColor: "#ffffff",
                    height: "28px",
                    fontSize: "12.5px",
                    fontWeight: 600,
                  }}
                />
                <Button
                  variant="outline-secondary"
                  className="px-2 py-0 d-flex align-items-center justify-content-center"
                  style={{ height: "28px" }}
                  onClick={() => setShowAlanVezneModal(true)}
                  title="Alan Vezne Seç (F8)"
                >
                  <IconBinoculars size={14} />
                </Button>
              </InputGroup>
              {alanVezneAd && (
                <span className="text-muted small fw-medium text-truncate ms-1" style={{ maxWidth: "180px" }}>
                  {alanVezneAd}
                </span>
              )}
            </div>
          </div>

          {/* Row 2: Ref no */}
          <div className="d-flex align-items-center gap-2 mb-2">
            <span className="small text-secondary fw-semibold" style={{ width: "80px" }}>
              Ref no
            </span>
            <Form.Control
              type="text"
              size="sm"
              value={refNo}
              onChange={(e) => setRefNo(e.target.value)}
              placeholder=""
              style={{ width: "240px", height: "28px", fontSize: "12.5px" }}
            />
          </div>

          {/* Row 3: Açıklama */}
          <div className="d-flex align-items-center gap-2 mb-2">
            <span className="small text-secondary fw-semibold" style={{ width: "80px" }}>
              Açıklama
            </span>
            <Form.Control
              type="text"
              size="sm"
              value={aciklama}
              onChange={(e) => setAciklama(e.target.value)}
              placeholder=""
              style={{ flex: 1, height: "28px", fontSize: "12.5px" }}
            />
          </div>

          {/* Row 4: Veren vezne */}
          <div className="d-flex align-items-center gap-2">
            <span className="small text-secondary fw-semibold" style={{ width: "80px" }}>
              Veren vezne
            </span>
            <InputGroup size="sm" style={{ width: "125px" }}>
              <Form.Control
                type="text"
                value={verenVezneKod}
                onChange={(e) => {
                  const val = e.target.value;
                  setVerenVezneKod(val);
                  const found = vezneList.find(
                    (v) =>
                      v.kod.toLowerCase() === val.trim().toLowerCase() ||
                      String(v.id) === val.trim()
                  );
                  if (found) {
                    setVerenVezneId(found.id);
                    setVerenVezneAd(found.ad);
                  } else {
                    setVerenVezneId(0);
                    setVerenVezneAd("");
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "F8") {
                    e.preventDefault();
                    setShowVerenVezneModal(true);
                  }
                }}
                placeholder=""
                style={{
                  backgroundColor: "#ffffff",
                  height: "28px",
                  fontSize: "12.5px",
                  fontWeight: 600,
                }}
              />
              <Button
                variant="outline-secondary"
                className="px-2 py-0 d-flex align-items-center justify-content-center"
                style={{ height: "28px" }}
                onClick={() => setShowVerenVezneModal(true)}
                title="Veren Vezne Seç (F8)"
              >
                <IconBinoculars size={14} />
              </Button>
            </InputGroup>
            {verenVezneAd && (
              <span className="text-muted small fw-medium text-truncate ms-1" style={{ maxWidth: "220px" }}>
                {verenVezneAd}
              </span>
            )}
          </div>
        </div>

        {/* Lines Grid Table - Maximum 3 rows height */}
        <div style={{ maxHeight: "128px", overflowY: "auto" }}>
          <Table bordered hover size="sm" className="mb-0 text-nowrap" style={{ fontSize: "12.5px" }}>
            <thead
              style={{
                backgroundColor: "#bfdbfe",
                color: "#1e3a8a",
                position: "sticky",
                top: 0,
                zIndex: 2,
              }}
            >
              <tr>
                <th style={{ width: "120px", padding: "4px 8px" }}>Kod</th>
                <th style={{ padding: "4px 8px" }}>Para adı</th>
                <th style={{ width: "220px", padding: "4px 8px" }} className="text-end">
                  Miktar
                </th>
                <th style={{ width: "35px", padding: "4px 4px" }} className="text-center"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
                <tr
                  key={line.id}
                  className={activeRowIndex === idx ? "table-active" : ""}
                  onClick={() => setActiveRowIndex(idx)}
                >
                  {/* Kod with quick search button */}
                  <td style={{ padding: "3px 4px" }}>
                    <InputGroup size="sm">
                      <Form.Control
                        type="text"
                        value={line.paraKodu}
                        onChange={(e) => handleLineChange(idx, "paraKodu", e.target.value)}
                        placeholder=""
                        className="fw-bold text-primary text-uppercase p-1 text-center"
                        style={{ height: "26px", fontSize: "12px" }}
                        ref={(el) => {
                          rowInputRefs.current[`kod-${idx}`] = el;
                        }}
                        onKeyDown={(e) => handleGridKeyDown(e, idx, "kod")}
                      />
                      <Button
                        variant="outline-secondary"
                        className="px-1.5 py-0 d-flex align-items-center justify-content-center"
                        style={{ height: "26px" }}
                        onClick={() => {
                          setActiveRowIdForPara(line.id);
                          setShowParaModal(true);
                        }}
                        title="Para Seç"
                      >
                        <IconBinoculars size={13} />
                      </Button>
                    </InputGroup>
                  </td>

                  {/* Para adı */}
                  <td style={{ padding: "4px 8px", verticalAlign: "middle" }}>
                    <span className="fw-medium text-dark">{line.paraAdi || ""}</span>
                  </td>

                  {/* Miktar */}
                  <td style={{ padding: "3px 4px" }}>
                    <Form.Control
                      type="text"
                      inputMode="decimal"
                      size="sm"
                      value={line.miktar}
                      onChange={(e) => handleLineChange(idx, "miktar", e.target.value)}
                      placeholder=""
                      className="text-end fw-bold p-1"
                      style={{ height: "26px", fontSize: "12.5px" }}
                      ref={(el) => {
                        rowInputRefs.current[`miktar-${idx}`] = el;
                      }}
                      onKeyDown={(e) => handleGridKeyDown(e, idx, "miktar")}
                    />
                  </td>

                  {/* Delete row action */}
                  <td style={{ padding: "2px", textAlign: "center", verticalAlign: "middle" }}>
                    {lines.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="p-0 text-muted hover-danger border-0"
                        onClick={() => handleRemoveLine(idx)}
                        title="Satırı Sil"
                      >
                        <IconTrash size={14} />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>

        {/* F1, F5, F9, F10 Bottom Bar matching reference screenshot */}
        <div
          className="d-flex align-items-center justify-content-center gap-4 py-1.5 px-3 border-top user-select-none"
          style={{
            backgroundColor: "#d1fae5", // Soft cyan/mint strip as shown in user screenshot
            color: "#065f46",
            fontSize: "13px",
            fontWeight: 600,
          }}
        >
          <span
            onClick={handleSave}
            className="cursor-pointer hover-opacity text-decoration-none d-inline-flex align-items-center gap-1"
            role="button"
            title="Transferi Kaydet (F1)"
          >
            F1) Kayıt
          </span>
          <span
            onClick={handleTopluTransfer}
            className="cursor-pointer hover-opacity text-decoration-none d-inline-flex align-items-center gap-1"
            role="button"
            title="Veren Veznedeki Tüm Bakiyeleri Aktar (F5)"
          >
            F5) Toplu Transfer
          </span>
          <span
            onClick={handleOpenParaSay}
            className="cursor-pointer hover-opacity text-decoration-none d-inline-flex align-items-center gap-1"
            role="button"
            title="Banknot Sayımı Yap (F9)"
          >
            F9) Say
          </span>
          <span
            onClick={() => setShowPrintModal(true)}
            className="cursor-pointer hover-opacity text-decoration-none d-inline-flex align-items-center gap-1"
            role="button"
            title="Transfer Makbuzunu Yazdır / Kes (F10)"
          >
            F10) Kes
          </span>
        </div>
      </div>

      {/* Alan Vezne Lookup Modal */}
      <LookupModal<VezneItem>
        show={showAlanVezneModal}
        onHide={() => setShowAlanVezneModal(false)}
        title="Alan Vezne Seçiniz"
        items={vezneList}
        columns={vezneColumns}
        searchPlaceholder="Vezne adı veya koduna göre ara..."
        filterFn={(item, term) =>
          item.kod.toLowerCase().includes(term.toLowerCase()) ||
          item.ad.toLowerCase().includes(term.toLowerCase())
        }
        onSelect={(item) => {
          setAlanVezneId(item.id);
          setAlanVezneKod(item.kod);
          setAlanVezneAd(item.ad);
          setShowAlanVezneModal(false);
        }}
      />

      {/* Veren Vezne Lookup Modal */}
      <LookupModal<VezneItem>
        show={showVerenVezneModal}
        onHide={() => setShowVerenVezneModal(false)}
        title="Veren Vezne Seçiniz"
        items={vezneList}
        columns={vezneColumns}
        searchPlaceholder="Vezne adı veya koduna göre ara..."
        filterFn={(item, term) =>
          item.kod.toLowerCase().includes(term.toLowerCase()) ||
          item.ad.toLowerCase().includes(term.toLowerCase())
        }
        onSelect={(item) => {
          setVerenVezneId(item.id);
          setVerenVezneKod(item.kod);
          setVerenVezneAd(item.ad);
          setShowVerenVezneModal(false);
        }}
      />

      {/* Para / Currency Lookup Modal */}
      <LookupModal<{ id: number; kod: string; ad: string }>
        show={showParaModal}
        onHide={() => setShowParaModal(false)}
        title="Döviz / Para Birimi Seçiniz"
        items={paraList}
        columns={paraColumns}
        searchPlaceholder="Para birimi veya koduna göre ara..."
        filterFn={(item, term) =>
          item.kod.toLowerCase().includes(term.toLowerCase()) ||
          item.ad.toLowerCase().includes(term.toLowerCase())
        }
        onSelect={(item) => {
          if (activeRowIdForPara) {
            setLines((prev) =>
              prev.map((r) =>
                r.id === activeRowIdForPara
                  ? { ...r, paraId: item.id, paraKodu: item.kod, paraAdi: item.ad }
                  : r
              )
            );
          }
          setShowParaModal(false);
        }}
      />

      {/* Search Modal for Past Transfers */}
      <LookupModal<VezneTransferiListItem>
        show={showSearchModal}
        onHide={() => setShowSearchModal(false)}
        title="Geçmiş Vezne Transferleri (Arama / Seçim)"
        items={transferList}
        isLoading={isLoadingTransferList}
        columns={searchColumns}
        searchPlaceholder="Ref no, vezne adı veya açıklamaya göre ara..."
        filterFn={(item, term) =>
          item.refNo.toLowerCase().includes(term.toLowerCase()) ||
          item.alanVezneAd.toLowerCase().includes(term.toLowerCase()) ||
          item.verenVezneAd.toLowerCase().includes(term.toLowerCase()) ||
          item.aciklama.toLowerCase().includes(term.toLowerCase())
        }
        onSelect={(item) => {
          loadTransferById(item.id);
          setShowSearchModal(false);
        }}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        show={showDeleteConfirmModal}
        onHide={() => setShowDeleteConfirmModal(false)}
        centered
      >
        <Modal.Header closeButton className="bg-danger text-white py-2 px-3">
          <Modal.Title className="fs-6 d-flex align-items-center gap-2">
            <IconAlertTriangle size={18} />
            <span>Vezne Transferi Silme Onayı</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3 small">
          <p className="mb-2 fw-semibold">
            {refNo || `#${transferId}`} numaralı vezne transfer kaydını silmek istediğinize emin misiniz?
          </p>
          <div className="alert alert-warning mb-0 py-1.5 px-2.5 small">
            <strong>Dikkat:</strong> Bu işlem veritabanında kayıtlı bakiyeleri otomatik olarak tersine çevirecek (Alan vezneden eksiltip Veren vezneye iade edecek) ve işlem geri alınamayacaktır.
          </div>
        </Modal.Body>
        <Modal.Footer className="bg-light py-1.5 px-3">
          <Button variant="secondary" size="sm" onClick={() => setShowDeleteConfirmModal(false)}>
            Vazgeç
          </Button>
          <Button variant="danger" size="sm" onClick={handleDelete} className="fw-bold">
            Evet, Kaydı Sil
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Para Sayma Modal (F9) */}
      <ParaSaymaModal
        show={showParaSayModal}
        onClose={() => setShowParaSayModal(false)}
        currencies={paraSayCurrencies.length > 0 ? paraSayCurrencies : [{ kod: "USD", ad: "Amerikan Doları", sayilacak: 0 }]}
        counts={banknotCounts}
        onCountsChange={handleParaSayCountsChange}
      />

      {/* Print Slip Preview Modal (F10) */}
      <Modal
        show={showPrintModal}
        onHide={() => setShowPrintModal(false)}
        size="lg"
        centered
      >
        <Modal.Header closeButton className="bg-light py-2 px-3">
          <Modal.Title className="fs-6 d-flex align-items-center gap-2">
            <IconPrinter size={18} className="text-primary" />
            <span>Vezne Transfer Fişi Yazdır (Kes)</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4">
          <div
            id="printable-transfer-slip"
            className="border p-4 bg-white rounded shadow-2xs font-monospace"
            style={{ fontSize: "12.5px" }}
          >
            <div className="text-center mb-3 pb-2 border-bottom">
              <h5 className="fw-bold mb-1">VEZNE TRANSFER MAKBUZU</h5>
              <div className="text-muted small">Tarih: {new Date(tarih).toLocaleDateString("tr-TR")} | Ref: {refNo || "Transfer"}</div>
            </div>

            <Row className="mb-3">
              <Col xs={6}>
                <div><strong>Veren Vezne:</strong> {verenVezneKod} - {verenVezneAd}</div>
              </Col>
              <Col xs={6}>
                <div><strong>Alan Vezne:</strong> {alanVezneKod} - {alanVezneAd}</div>
              </Col>
              <Col xs={12} className="mt-1">
                <div><strong>Açıklama:</strong> {aciklama || "-"}</div>
              </Col>
            </Row>

            <Table bordered size="sm" className="mb-3">
              <thead className="bg-light">
                <tr>
                  <th>Para Cinsi</th>
                  <th className="text-end">Miktar</th>
                </tr>
              </thead>
              <tbody>
                {lines
                  .filter((l) => l.paraId > 0 && Number(l.miktar) > 0)
                  .map((l, i) => (
                    <tr key={i}>
                      <td><strong>{l.paraKodu}</strong> - {l.paraAdi}</td>
                      <td className="text-end fw-bold">{Number(l.miktar).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
              </tbody>
            </Table>

            <div className="d-flex justify-content-between pt-4 mt-3 border-top small text-center text-muted">
              <div>
                <div>Teslim Eden (Veren Vezne)</div>
                <div className="mt-4">_______________________</div>
              </div>
              <div>
                <div>Teslim Alan (Alan Vezne)</div>
                <div className="mt-4">_______________________</div>
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer className="bg-light py-1.5 px-3">
          <Button variant="secondary" size="sm" onClick={() => setShowPrintModal(false)}>
            Kapat
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => window.print()}
            className="d-flex align-items-center gap-1 fw-bold"
          >
            <IconPrinter size={16} />
            <span>Yazıcıya Gönder (Kes)</span>
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default VezneTransferiPage;
