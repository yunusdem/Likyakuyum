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
  IconChevronDown,
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
import {
  VezneIzlemeService,
  VezneIzlemeRow,
} from "../../services/vezneIzlemeService";
import { ParaSaymaModal, ParaSaymaCurrencyItem } from "./ParaSaymaModal";
import { useAuth } from "../../context/AuthContext";
import { onlyDecimal, blockNonNumericKeys } from "../../utils/numericInput";
import useERPAutoFocus from "../../hooks/useERPAutoFocus";

interface VezneBakiyeDropdownProps {
  vezneId: number;
  vezneAd?: string;
  bakiyeler: { paraId: number; paraKodu: string; paraAdi: string; miktar: number }[];
  align?: "left" | "right";
}

// Vezne Bakiyelerini Açılır Tablo ile Gösteren Komponent
const VezneBakiyeDropdown: React.FC<VezneBakiyeDropdownProps> = ({
  vezneId,
  vezneAd,
  bakiyeler,
  align = "left",
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  if (!vezneId || vezneId <= 0) return null;

  // Sadece kayıtlı (sıfırdan farklı) bakiyeleri göster
  const activeBakiyeler = (bakiyeler || []).filter((b) => Number(b.miktar) !== 0);

  return (
    <div className="position-relative d-inline-block ms-1" ref={dropdownRef} style={{ zIndex: 1050 }}>
      <button
        type="button"
        className="btn btn-sm py-0 px-1.5 d-inline-flex align-items-center justify-content-center border rounded shadow-2xs bg-white text-secondary"
        style={{
          width: "30px",
          height: "30px",
          borderColor: "#cbd5e1",
        }}
        onClick={() => setIsOpen((prev) => !prev)}
        title={`${vezneAd || "Vezne"} bakiye tablosunu görüntülemek için tıklayınız`}
      >
        <IconChevronDown
          size={16}
          style={{
            transform: isOpen ? "rotate(180deg)" : "none",
            transition: "transform 0.15s ease",
            color: "#475569",
          }}
        />
      </button>

      {isOpen && (
        <div
          className="position-absolute shadow-lg border rounded bg-white overflow-hidden"
          style={{
            top: "calc(100% + 4px)",
            ...(align === "right" ? { right: 0, left: "auto" } : { left: 0, right: "auto" }),
            zIndex: 1060,
            width: "320px",
            borderColor: "#cbd5e1",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
          }}
        >
          {activeBakiyeler.length === 0 ? (
            <div className="p-3 text-center text-muted small" style={{ fontSize: "12px" }}>
              Kayıtlı bakiye bulunamadı.
            </div>
          ) : (
            <div style={{ maxHeight: "360px", overflowY: "auto" }}>
              <Table hover size="sm" className="mb-0 align-middle" style={{ fontSize: "11.5px" }}>
                <thead
                  style={{
                    backgroundColor: "#bae6fd",
                    color: "#0369a1",
                    position: "sticky",
                    top: 0,
                    zIndex: 2,
                  }}
                >
                  <tr>
                    <th className="py-1.5 px-2.5 fw-bold border-bottom" style={{ backgroundColor: "#bae6fd", color: "#0369a1" }}>Kod</th>
                    <th className="py-1.5 px-2.5 fw-bold text-end border-bottom" style={{ backgroundColor: "#bae6fd", color: "#0369a1" }}>Borç bakiye</th>
                    <th className="py-1.5 px-2.5 fw-bold text-end border-bottom" style={{ backgroundColor: "#bae6fd", color: "#0369a1" }}>Alacak bakiye</th>
                  </tr>
                </thead>
                <tbody>
                  {activeBakiyeler.map((row) => {
                    const borc = Number(row.miktar) > 0 ? Number(row.miktar) : 0;
                    const alacak = Number(row.miktar) < 0 ? Math.abs(Number(row.miktar)) : 0;
                    return (
                      <tr key={row.paraId}>
                        <td className="py-1.5 px-2.5 font-monospace fw-bold text-dark">
                          {row.paraKodu}
                        </td>
                        <td className="py-1.5 px-2.5 text-end font-monospace">
                          {borc > 0 ? (
                            <span className="fw-bold text-danger">
                              {new Intl.NumberFormat("tr-TR", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }).format(borc)}
                            </span>
                          ) : (
                            <span className="text-muted opacity-40">-</span>
                          )}
                        </td>
                        <td className="py-1.5 px-2.5 text-end font-monospace">
                          {alacak > 0 ? (
                            <span className="fw-bold text-success">
                              {new Intl.NumberFormat("tr-TR", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }).format(alacak)}
                            </span>
                          ) : (
                            <span className="text-muted opacity-40">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

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
  const [alanVezneBakiyeler, setAlanVezneBakiyeler] = useState<
    { paraId: number; paraKodu: string; paraAdi: string; miktar: number }[]
  >([]);
  const [verenVezneId, setVerenVezneId] = useState<number>(0);
  const [verenVezneKod, setVerenVezneKod] = useState<string>("");
  const [verenVezneAd, setVerenVezneAd] = useState<string>("");
  const [verenVezneBakiyeler, setVerenVezneBakiyeler] = useState<
    { paraId: number; paraKodu: string; paraAdi: string; miktar: number }[]
  >([]);
  const [izlemeRows, setIzlemeRows] = useState<VezneIzlemeRow[]>([]);
  const [aciklama, setAciklama] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useERPAutoFocus({ dependencies: [transferId] });

  // Alan Vezne bakiyelerini otomatik yükleme (Vezne İzleme verileri ile uyumlu)
  useEffect(() => {
    let active = true;
    if (alanVezneId && alanVezneId > 0) {
      if (izlemeRows.length > 0) {
        const bList = izlemeRows
          .map((r) => ({
            paraId: r.paraId,
            paraKodu: r.paraKodu,
            paraAdi: r.paraAdi,
            miktar: r.bakiyeler[alanVezneId] ?? 0,
          }))
          .filter((b) => b.miktar !== 0);
        setAlanVezneBakiyeler(bList);
      } else {
        VezneTransferiService.getVezneBakiyeler(alanVezneId)
          .then((b) => {
            if (active) setAlanVezneBakiyeler(b || []);
          })
          .catch(() => {
            if (active) setAlanVezneBakiyeler([]);
          });
      }
    } else {
      setAlanVezneBakiyeler([]);
    }
    return () => {
      active = false;
    };
  }, [alanVezneId, izlemeRows]);

  // Veren Vezne bakiyelerini otomatik yükleme (Vezne İzleme verileri ile uyumlu)
  useEffect(() => {
    let active = true;
    if (verenVezneId && verenVezneId > 0) {
      if (izlemeRows.length > 0) {
        const bList = izlemeRows
          .map((r) => ({
            paraId: r.paraId,
            paraKodu: r.paraKodu,
            paraAdi: r.paraAdi,
            miktar: r.bakiyeler[verenVezneId] ?? 0,
          }))
          .filter((b) => b.miktar !== 0);
        setVerenVezneBakiyeler(bList);
      } else {
        VezneTransferiService.getVezneBakiyeler(verenVezneId)
          .then((b) => {
            if (active) setVerenVezneBakiyeler(b || []);
          })
          .catch(() => {
            if (active) setVerenVezneBakiyeler([]);
          });
      }
    } else {
      setVerenVezneBakiyeler([]);
    }
    return () => {
      active = false;
    };
  }, [verenVezneId, izlemeRows]);

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
  const verenVezneInputRef = useRef<HTMLInputElement | null>(null);

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

  // Load lookups (Vezne İzleme sayfasındaki canlı veriler ile yükle)
  const fetchIzlemeData = useCallback(async () => {
    setIsLoadingLookups(true);
    try {
      const izlemeRes = await VezneIzlemeService.getIzlemeData().catch(() => null);
      if (izlemeRes && izlemeRes.columns && izlemeRes.columns.length > 0) {
        const vCols: VezneItem[] = izlemeRes.columns.map((c) => ({
          id: c.vezneId,
          kod: c.kod,
          ad: c.ad,
        }));
        const pRows: { id: number; kod: string; ad: string }[] = (izlemeRes.rows || []).map((r) => ({
          id: r.paraId,
          kod: r.paraKodu,
          ad: r.paraAdi,
        }));
        setVezneList(vCols);
        setParaList(pRows);
        setIzlemeRows(izlemeRes.rows || []);

        if (!queryId) {
          const uv = getUserVezne(vCols);
          if (uv) {
            setAlanVezneId(uv.id);
            setAlanVezneKod(uv.kod);
            setAlanVezneAd(uv.ad);
          }
        }
        return izlemeRes;
      } else {
        const [vezneler, paralar] = await Promise.all([
          CashDeskService.getVezneler().catch(() => []),
          ProductDefinitionService.getProducts().catch(async () => {
            const fallbackCurrencies = await CashDeskService.getCurrencies().catch(() => []);
            return fallbackCurrencies.map((c) => ({ id: c.id, kod: c.code, ad: c.name } as ProductItem));
          }),
        ]);
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
        return null;
      }
    } catch (err) {
      console.error("Vezne izleme verisi yükleme hatası:", err);
      return null;
    } finally {
      setIsLoadingLookups(false);
    }
  }, [queryId, getUserVezne]);

  useEffect(() => {
    fetchIzlemeData();
  }, [fetchIzlemeData]);

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

  // Sayfa ilk açılınca imleç doğrudan Veren vezne inputuna fokuslanır
  useEffect(() => {
    if (!isLoadingLookups) {
      const timer = setTimeout(() => {
        verenVezneInputRef.current?.focus();
        verenVezneInputRef.current?.select();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isLoadingLookups]);

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

    setTimeout(() => {
      verenVezneInputRef.current?.focus();
      verenVezneInputRef.current?.select();
    }, 100);

    if (queryId) {
      navigate(location.pathname, { replace: true });
    }
  }, [getUserVezne, vezneList, queryId, navigate, location.pathname]);

  const handleRefresh = useCallback(async () => {
    setIsLoadingLookups(true);
    try {
      await fetchIzlemeData();
      if (transferId) {
        await loadTransferById(transferId);
      } else if (!isDuzeltmeMode) {
        resetForm();
      }
    } catch (err) {
      console.error("Yenileme hatası:", err);
    } finally {
      setIsLoadingLookups(false);
    }
  }, [fetchIzlemeData, transferId, isDuzeltmeMode, loadTransferById, resetForm]);

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
        target.miktar = onlyDecimal(value);
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
    const len = el?.value?.length ?? 0;
    const selStart = el?.selectionStart ?? 0;
    const selEnd = el?.selectionEnd ?? 0;
    const isAtStart = selStart === 0 && selEnd === 0;
    const isAtEnd = selStart === len && selEnd === len;

    // ESC altındaki " tuşuna basınca üst satırdaki hücre değerini kopyala (Sadece tablolarda geçerli)
    if (e.key === '"' || e.key === '“' || e.key === '”' || e.key === '„' || e.key === '«' || e.key === '»' || e.key === 'é' || e.key === 'É' || e.key === '`' || e.key === '´' || e.key === '§' || e.code === "Backquote" || (e.code === "Digit2" && e.shiftKey) || e.keyCode === 222 || e.keyCode === 192) {
      e.preventDefault();
      e.stopPropagation();
      if (idx > 0) {
        const prevRow = lines[idx - 1];
        if (field === "kod") {
          const prevKod = (prevRow.paraKodu || "").trim();
          handleLineChange(idx, "paraKodu", prevKod);
        } else if (field === "miktar") {
          handleLineChange(idx, "miktar", prevRow.miktar ?? "");
        }
        setTimeout(() => {
          const input = rowInputRefs.current[`${field}-${idx}`];
          if (input) {
            input.focus();
            input.select();
          }
        }, 20);
      }
      return;
    }

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
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  // Sağ tık menüsü eylemleri (Satırı Sil & Yeni Satır Ekle)
  useEffect(() => {
    const handleGridDelete = (e: any) => {
      const rowId = e.detail?.rowId;
      if (rowId !== undefined) {
        const foundIdx = lines.findIndex((l) => l.id === rowId);
        if (foundIdx !== -1) {
          handleRemoveLine(foundIdx);
        } else if (!isNaN(Number(rowId))) {
          handleRemoveLine(Number(rowId));
        }
      }
    };
    const handleGridAdd = () => {
      setLines((prev) => [...prev, createEmptyRow(prev.length + 1)]);
    };
    window.addEventListener("erp-grid-row-delete", handleGridDelete);
    window.addEventListener("erp-grid-row-add", handleGridAdd);
    return () => {
      window.removeEventListener("erp-grid-row-delete", handleGridDelete);
      window.removeEventListener("erp-grid-row-add", handleGridAdd);
    };
  }, [lines]);

  // Bildirimlerin otomatik kapanması (1.75 sn)
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 1750);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Toplu Transfer (F5): Veren veznenin Vezne İzleme'deki canlı bakiyelerini transfer satırlarına yükler
  const handleTopluTransfer = useCallback(async () => {
    if (!verenVezneId || verenVezneId <= 0) {
      setNotification({
        type: "warning",
        message: "Lütfen önce Veren Vezneyi seçiniz.",
      });
      setShowVerenVezneModal(true);
      return;
    }

    try {
      let bakiyeler: { paraId: number; paraKodu: string; paraAdi: string; miktar: number }[] = [];
      const izlemeRes = await VezneIzlemeService.getIzlemeData().catch(() => null);
      if (izlemeRes && izlemeRes.rows && izlemeRes.rows.length > 0) {
        setIzlemeRows(izlemeRes.rows);
        bakiyeler = izlemeRes.rows
          .map((r) => ({
            paraId: r.paraId,
            paraKodu: r.paraKodu,
            paraAdi: r.paraAdi,
            miktar: r.bakiyeler[verenVezneId] ?? 0,
          }))
          .filter((b) => b.miktar !== 0);
      } else {
        bakiyeler = await VezneTransferiService.getVezneBakiyeler(verenVezneId);
      }

      if (!bakiyeler || bakiyeler.length === 0) {
        setNotification({
          type: "warning",
          message: `${verenVezneAd || "Veren veznede"} aktarılacak bakiye bulunamadı.`,
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
        message: `${verenVezneAd} veznesindeki ${bakiyeler.length} adet bakiye transfer satırlarına yüklendi.`,
      });

      setTimeout(() => {
        const firstMiktarInput = rowInputRefs.current["miktar-0"] || rowInputRefs.current["kod-0"];
        firstMiktarInput?.focus();
        firstMiktarInput?.select();
      }, 100);
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

    const validLines = lines.filter(
      (l) => l.paraId > 0 && l.miktar !== "" && !isNaN(Number(l.miktar)) && Number(l.miktar) !== 0
    );
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
      setVerenVezneBakiyeler([]);
      if (uv) {
        VezneTransferiService.getVezneBakiyeler(uv.id)
          .then((b) => setAlanVezneBakiyeler(b || []))
          .catch(() => {});
      }
      await fetchIzlemeData();
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

  // Search Past Transfers Modal (En eski kayıt ilk satırda, en yeni kayıt en altta - SQL sırasına göre ASC)
  const handleOpenSearchModal = async () => {
    setShowSearchModal(true);
    setIsLoadingTransferList(true);
    try {
      const list = await VezneTransferiService.getTransfers({ limit: 500 });
      const sorted = [...(list || [])].sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));
      setTransferList(sorted);
    } catch (e) {
      console.error("Transfer listesi getirme hatası:", e);
    } finally {
      setIsLoadingTransferList(false);
    }
  };

  // Keyboard shortcuts F1, F4, F5, F9, F10
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showVerenVezneModal || showParaModal || showSearchModal || showParaSayModal || showPrintModal || showDeleteConfirmModal) {
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
    <div className="vezne-transferi-container w-100 pb-2">
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
        onRefresh={handleRefresh}
        pageTitle={isDuzeltmeMode ? "H- Vezne Transferi Düzeltme" : "G- Vezne Transferi Kayıt"}
        pageIcon={<IconCash size={20} className="text-primary" />}
        hideSearch={!isDuzeltmeMode}
        hideDelete={!isDuzeltmeMode}
        rightContent={
          <div className="d-flex align-items-center gap-2">
            <div className="d-flex align-items-center gap-1.5">
              <label className="small fw-semibold mb-0 text-secondary" style={{ fontSize: "12px" }}>
                Tarih:
              </label>
              <Form.Control
                type="date"
                size="sm"
                value={tarih}
                onChange={(e) => setTarih(e.target.value)}
                style={{ width: "128px", height: "28px", fontSize: "12px", borderColor: "#cbd5e1" }}
              />
            </div>
            {transferId ? (
              <Badge bg="secondary" className="px-2 py-1 fs-8">
                #{transferId}
              </Badge>
            ) : null}
          </div>
        }
      />

      {/* Notification banner: Sağ altta beliren ve 3.5 sn sonra yok olan toast */}
      {notification && (
        <div className="erp-toast-container">
          <Alert
            variant={notification.type}
            dismissible
            onClose={() => setNotification(null)}
            className="erp-toast-item py-2 px-3 mb-0 border-0 shadow d-flex align-items-center justify-content-between small"
          >
            <span>{notification.message}</span>
          </Alert>
        </div>
      )}

      {/* 1. Üst Parametreler: Alan, Veren, Ref no, Açıklama alt alta */}
      <div
        className="border rounded-2 bg-white shadow-2xs mb-2.5 mt-1 w-100"
        style={{ borderColor: "#cbd5e1", padding: "12px 18px" }}
      >
        <div className="d-flex flex-column gap-2" style={{ maxWidth: "540px" }}>
          {/* Alan vezne */}
          <div className="d-flex align-items-center gap-2">
            <label
              className="small fw-semibold mb-0 text-nowrap"
              style={{ width: "95px", minWidth: "95px", fontSize: "12.5px", color: "#334155" }}
            >
              Alan vezne:
            </label>
            <div className="d-flex align-items-center gap-1.5 flex-grow-1">
              <Form.Control
                type="text"
                size="sm"
                readOnly
                disabled
                value={alanVezneKod}
                style={{
                  width: "90px",
                  backgroundColor: "#f1f5f9",
                  color: "#1e293b",
                  height: "28px",
                  fontSize: "12px",
                  fontWeight: 600,
                  borderColor: "#cbd5e1",
                  cursor: "not-allowed",
                }}
                title="Alan vezne giriş yapan kullanıcının veznesidir (Değiştirilemez)"
              />
              {alanVezneAd && (
                <span
                  className="text-dark small fw-semibold text-truncate"
                  style={{ maxWidth: "200px", fontSize: "12.5px" }}
                  title={alanVezneAd}
                >
                  ({alanVezneAd})
                </span>
              )}
              <VezneBakiyeDropdown
                vezneId={alanVezneId}
                vezneAd={alanVezneAd}
                bakiyeler={alanVezneBakiyeler}
                align="left"
              />
            </div>
          </div>

          {/* Veren vezne */}
          <div className="d-flex align-items-center gap-2">
            <label
              className="small fw-semibold mb-0 text-nowrap"
              style={{ width: "95px", minWidth: "95px", fontSize: "12.5px", color: "#334155" }}
            >
              Veren vezne:
            </label>
            <div className="d-flex align-items-center gap-1.5 flex-grow-1">
              <InputGroup size="sm" style={{ width: "120px", flexShrink: 0 }}>
                <Form.Control
                  ref={verenVezneInputRef}
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
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (!verenVezneId) {
                        setShowVerenVezneModal(true);
                      } else {
                        const firstRowParaInput = rowInputRefs.current["kod-0"];
                        firstRowParaInput?.focus();
                        firstRowParaInput?.select();
                      }
                    } else if (e.key === "F8" || e.key === "F12") {
                      e.preventDefault();
                      setShowVerenVezneModal(true);
                    }
                  }}
                  placeholder=""
                  style={{
                    backgroundColor: "#ffffff",
                    height: "28px",
                    fontSize: "12px",
                    fontWeight: 600,
                    borderColor: "#cbd5e1",
                  }}
                />
                <Button
                  variant="outline-secondary"
                  className="px-2 py-0 d-flex align-items-center justify-content-center"
                  style={{ height: "28px", borderColor: "#cbd5e1" }}
                  onClick={() => setShowVerenVezneModal(true)}
                  title="Veren Vezne Seç (Dürbün - F8 / F12)"
                >
                  <IconBinoculars size={14} />
                </Button>
              </InputGroup>
              {verenVezneAd && (
                <span
                  className="text-dark small fw-semibold text-truncate"
                  style={{ maxWidth: "200px", fontSize: "12.5px" }}
                  title={verenVezneAd}
                >
                  ({verenVezneAd})
                </span>
              )}
              <VezneBakiyeDropdown
                vezneId={verenVezneId}
                vezneAd={verenVezneAd}
                bakiyeler={verenVezneBakiyeler}
                align="left"
              />
            </div>
          </div>

          {/* Ref no */}
          <div className="d-flex align-items-center gap-2">
            <label
              className="small fw-semibold mb-0 text-nowrap"
              style={{ width: "95px", minWidth: "95px", fontSize: "12.5px", color: "#334155" }}
            >
              Ref no:
            </label>
            <Form.Control
              type="text"
              size="sm"
              value={refNo}
              onChange={(e) => setRefNo(e.target.value)}
              placeholder=""
              style={{ width: "160px", height: "28px", fontSize: "12px", borderColor: "#cbd5e1" }}
            />
          </div>

          {/* Açıklama */}
          <div className="d-flex align-items-center gap-2">
            <label
              className="small fw-semibold mb-0 text-nowrap"
              style={{ width: "95px", minWidth: "95px", fontSize: "12.5px", color: "#334155" }}
            >
              Açıklama:
            </label>
            <Form.Control
              type="text"
              size="sm"
              value={aciklama}
              onChange={(e) => setAciklama(e.target.value)}
              placeholder="Transfer açıklaması..."
              style={{ width: "320px", height: "28px", fontSize: "12px", borderColor: "#cbd5e1" }}
            />
          </div>
        </div>
      </div>

      {/* 2. Transfer Kalemleri Tablosu (Üst Alandan Ayrılmış ve Daha Kısa/Kompakt) */}
      <div
        className="border rounded-2 bg-white shadow-2xs overflow-hidden mt-3"
        style={{ borderColor: "#cbd5e1", maxWidth: "650px" }}
      >
        <div className="table-responsive" style={{ minHeight: "150px", maxHeight: "300px", overflowY: "auto", backgroundColor: "#ffffff" }}>
          <Table bordered hover size="sm" className="mb-0 text-nowrap" style={{ fontSize: "12.5px" }}>
            <thead
              style={{
                backgroundColor: "#bae6fd",
                color: "#0369a1",
                position: "sticky",
                top: 0,
                zIndex: 2,
              }}
            >
              <tr>
                <th style={{ width: "130px", padding: "6px 8px", backgroundColor: "#bae6fd", color: "#0369a1" }}>Kod</th>
                <th style={{ padding: "6px 8px", backgroundColor: "#bae6fd", color: "#0369a1" }}>Para adı</th>
                <th style={{ width: "180px", padding: "6px 8px", backgroundColor: "#bae6fd", color: "#0369a1" }} className="text-end">
                  Miktar
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
                <tr
                  key={line.id}
                  data-row-id={line.id}
                  className={activeRowIndex === idx ? "table-active" : ""}
                  onClick={() => setActiveRowIndex(idx)}
                  onContextMenu={() => setActiveRowIndex(idx)}
                >
                  {/* Kod with quick search button */}
                  <td style={{ width: "130px", padding: "3px 4px" }}>
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
                  <td style={{ width: "180px", padding: "3px 4px" }}>
                    <Form.Control
                      ref={(el) => {
                        rowInputRefs.current[`miktar-${idx}`] = el;
                      }}
                      type="text"
                      inputMode="decimal"
                      data-decimal="true"
                      className="text-end fw-bold p-1"
                      style={{ height: "26px", fontSize: "13px" }}
                      value={line.miktar}
                      onChange={(e) => handleLineChange(idx, "miktar", e.target.value)}
                      onKeyDown={(e) => {
                        blockNonNumericKeys(e, true);
                        handleGridKeyDown(e, idx, "miktar");
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>

        {/* F1, F5, F9, F10 Alt Kısayol Bilgilendirme Şeridi */}
        <div
          className="d-flex align-items-center justify-content-center gap-4 py-1.5 px-3 border-top user-select-none"
          style={{
            backgroundColor: "#f8fafc",
            color: "#475569",
            fontSize: "12.5px",
            fontWeight: 600,
          }}
        >
          <span
            onClick={handleSave}
            className="cursor-pointer hover-opacity text-decoration-none d-inline-flex align-items-center gap-1 text-primary"
            role="button"
            title="Transferi Kaydet (F1)"
          >
            F1) Kayıt
          </span>
          <span
            onClick={handleTopluTransfer}
            className="cursor-pointer hover-opacity text-decoration-none d-inline-flex align-items-center gap-1 text-success"
            role="button"
            title="Veren Veznedeki Tüm Bakiyeleri Aktar (F5)"
          >
            F5) Toplu Transfer
          </span>
          <span
            onClick={handleOpenParaSay}
            className="cursor-pointer hover-opacity text-decoration-none d-inline-flex align-items-center gap-1 text-secondary"
            role="button"
            title="Banknot Sayımı Yap (F9)"
          >
            F9) Say
          </span>
          <span
            onClick={() => setShowPrintModal(true)}
            className="cursor-pointer hover-opacity text-decoration-none d-inline-flex align-items-center gap-1 text-dark"
            role="button"
            title="Transfer Makbuzunu Yazdır / Kes (F10)"
          >
            F10) Kes
          </span>
        </div>
      </div>



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
                  .filter((l) => l.paraId > 0 && Number(l.miktar) !== 0)
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

      {/* Kayıt / İşlem Sırasında Yüklenme Spinner Rozeti & Katmanı */}
      {isSaving && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(3px)",
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
          }}
        >
          <div className="spinner-border text-success mb-3" style={{ width: "3.5rem", height: "3.5rem" }} role="status">
            <span className="visually-hidden">Yükleniyor...</span>
          </div>
          <h5 className="fw-bold tracking-wide text-white mb-1">Vezne Transferi Kaydediliyor...</h5>
          <p className="small text-white-50 mb-0">Bakiyeler vezneler arasında aktarılıyor, lütfen bekleyiniz.</p>
        </div>
      )}
    </div>
  );
};

export default VezneTransferiPage;
