import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  Alert,
  Spinner,
  Badge,
  Row,
  Col,
} from "react-bootstrap";
import {
  IconCheck,
  IconSettings,
  IconRefresh,
  IconPrinter,
  IconChartLine,
  IconListDetails,
  IconCash,
  IconBuildingBank,
  IconX,
  IconClock,
  IconCalendar,
} from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import {
  VezneIzlemeService,
  VezneIzlemeSettings,
  VezneIzlemeColumn,
  VezneIzlemeRow,
} from "../../services/vezneIzlemeService";
import { VezneBakiyeModal } from "./VezneBakiyeModal";
import { KurService, KurRowItem } from "../../services/kurService";

export const VezneIzlemePage: React.FC = () => {
  // Data state
  const [columns, setColumns] = useState<VezneIzlemeColumn[]>([]);
  const [rows, setRows] = useState<VezneIzlemeRow[]>([]);
  const [settings, setSettings] = useState<VezneIzlemeSettings>({
    tazelemeSuresi: 5,
    ekrandakiVezneSayisi: 8,
    toplamdaParaKodu: true,
    firmaDurumuRaporu: false,
  });

  // UI / Navigation state
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [notification, setNotification] = useState<{
    type: "success" | "danger" | "warning" | "info";
    message: string;
  } | null>(null);

  // Pagination / Page index for vezneler (F12 Vezne Gerisi)
  const [pageOffset, setPageOffset] = useState<number>(0);

  // Live date & time state for top-right header
  const [currentDateTime, setCurrentDateTime] = useState<string>(() => {
    const now = new Date();
    const dateStr = now.toLocaleDateString("tr-TR");
    const timeStr = now.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    return `${dateStr}  ${timeStr}`;
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const dateStr = now.toLocaleDateString("tr-TR");
      const timeStr = now.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      setCurrentDateTime(`${dateStr}  ${timeStr}`);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Selected cell / row for details
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(0);
  const [selectedColIndex, setSelectedColIndex] = useState<number>(0);

  // Modals
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [editSettings, setEditSettings] = useState<VezneIzlemeSettings>({
    tazelemeSuresi: 5,
    ekrandakiVezneSayisi: 8,
    toplamdaParaKodu: true,
    firmaDurumuRaporu: false,
  });
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);

  // F4 Kur Modal
  const [showKurModal, setShowKurModal] = useState<boolean>(false);
  const [kurList, setKurList] = useState<KurRowItem[]>([]);
  const [isLoadingKur, setIsLoadingKur] = useState<boolean>(false);

  // F5 Detay Modal
  const [showDetayModal, setShowDetayModal] = useState<boolean>(false);

  // F8 Vezne Bakiye Modal
  const [showVezneBakiyeModal, setShowVezneBakiyeModal] = useState<boolean>(false);

  // F9 Firma Durumu Modal
  const [showFirmaDurumuModal, setShowFirmaDurumuModal] = useState<boolean>(false);

  // Check if any modal is currently open
  const isAnyModalOpen =
    showSettingsModal ||
    showKurModal ||
    showDetayModal ||
    showVezneBakiyeModal ||
    showFirmaDurumuModal;

  // Fetch izleme data from backend
  const fetchData = useCallback(async (silent: boolean = false) => {
    if (!silent) setIsLoading(true);
    try {
      const data = await VezneIzlemeService.getIzlemeData();
      if (data) {
        setSettings(data.settings);
        setColumns(data.columns);
        setRows(data.rows);
        setLastRefreshed(new Date());
      }
    } catch (err: any) {
      console.error("Vezne izleme verisi yükleme hatası:", err);
      if (!silent) {
        setNotification({
          type: "danger",
          message: err?.message || "Vezne izleme verileri yüklenemedi.",
        });
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchData(false);
  }, [fetchData]);

  // Auto-refresh timer based on TAZELEME_SURESI
  useEffect(() => {
    const sec = settings.tazelemeSuresi;
    if (sec <= 0) return;

    const interval = setInterval(() => {
      // Do not auto-refresh if a modal is open to avoid interrupting the user
      if (!isAnyModalOpen) {
        fetchData(true);
      }
    }, sec * 1000);

    return () => clearInterval(interval);
  }, [settings.tazelemeSuresi, isAnyModalOpen, fetchData]);

  // Handle Save Settings (SODVZ_VEZNE_IZLEME_TANIMI_KAYDET)
  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      const saved = await VezneIzlemeService.saveSettings(editSettings);
      setSettings(saved);
      setShowSettingsModal(false);
      setNotification({
        type: "success",
        message: "Vezne izleme tanımı başarıyla kaydedildi.",
      });
      fetchData(false);
    } catch (err: any) {
      setNotification({
        type: "danger",
        message: err?.message || "Ayar kaydedilemedi.",
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Open settings modal
  const handleOpenSettings = () => {
    setEditSettings({ ...settings });
    setShowSettingsModal(true);
  };

  // F4) Open Kur Modal
  const handleOpenKur = async () => {
    setShowKurModal(true);
    setIsLoadingKur(true);
    try {
      const res = await KurService.getKurTablosu({ tur: 0 });
      if (res && res.satirlar) {
        setKurList(res.satirlar);
      }
    } catch (e) {
      console.error("Kur yükleme hatası:", e);
    } finally {
      setIsLoadingKur(false);
    }
  };

  // F5) Open Detay Modal
  const handleOpenDetay = () => {
    setShowDetayModal(true);
  };

  // F8) Open Vezne Bakiye Modal
  const handleOpenVezneBakiye = () => {
    setShowVezneBakiyeModal(true);
  };

  // F9) Open Firma Durumu Modal
  const handleOpenFirmaDurumu = () => {
    setShowFirmaDurumuModal(true);
  };

  // F12) Vezne Gerisi / Pagination across vezne columns
  const visibleVezneCount = Math.max(1, settings.ekrandakiVezneSayisi || 8);
  const totalVezneler = columns.length;

  const handleNextVezneBatch = useCallback(() => {
    if (totalVezneler <= visibleVezneCount) {
      setNotification({
        type: "info",
        message: "Tüm vezneler ekranda görüntülenmektedir.",
      });
      return;
    }
    setPageOffset((prev) => {
      const next = prev + visibleVezneCount;
      if (next >= totalVezneler) {
        return 0; // wrap around to beginning
      }
      return next;
    });
  }, [totalVezneler, visibleVezneCount]);

  // Sliced columns to display based on pageOffset and ekrandakiVezneSayisi
  const displayedVezneCols = columns.slice(pageOffset, pageOffset + visibleVezneCount);

  // Filler empty columns to complete ekrandakiVezneSayisi (matches screenshot layout)
  const fillerCount = Math.max(0, visibleVezneCount - displayedVezneCols.length);
  const fillerColumns = Array.from({ length: fillerCount }, (_, i) => i);

  const visibleColumns = displayedVezneCols;

  // Ref for auto-scrolling active row into view
  const selectedRowRef = useRef<HTMLTableRowElement | null>(null);

  // Cell input refs for direct keyboard entry across grid
  const cellInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Synchronous state refs to prevent any closure staleness during saves
  const rowsRef = useRef<VezneIzlemeRow[]>(rows);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const columnsRef = useRef<VezneIzlemeColumn[]>(columns);
  useEffect(() => {
    columnsRef.current = columns;
  }, [columns]);

  const [isSavingTable, setIsSavingTable] = useState<boolean>(false);

  // Active editing state for smooth number entry
  const [editingCellKey, setEditingCellKey] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>("");

  useEffect(() => {
    if (selectedRowRef.current) {
      selectedRowRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedRowIndex]);

  // Helper to focus specific cell input
  const focusCell = useCallback((rIdx: number, cIdx: number) => {
    const targetR = Math.max(0, Math.min(rows.length - 1, rIdx));
    const targetC = Math.max(0, Math.min(visibleColumns.length - 1, cIdx));
    setSelectedRowIndex(targetR);
    setSelectedColIndex(targetC);
    setTimeout(() => {
      const input = cellInputRefs.current[`${targetR}-${targetC}`];
      if (input) {
        input.focus();
        input.select();
      }
    }, 15);
  }, [rows.length, visibleColumns.length]);

  // Save current table state to database without opening any modal
  const handleSaveTable = useCallback(async () => {
    try {
      setIsSavingTable(true);
      const currentRows = rowsRef.current;
      const currentColumns = columnsRef.current;
      const items: { vezneId: number; paraId: number; miktar: number }[] = [];

      for (const r of currentRows) {
        for (const col of currentColumns) {
          const m = r.bakiyeler[col.vezneId] ?? 0;
          items.push({
            vezneId: col.vezneId,
            paraId: r.paraId,
            miktar: m,
          });
        }
      }

      await VezneIzlemeService.saveAllBakiyeler(items);
      setNotification({
        type: "success",
        message: "Tablo verileri başarıyla kaydedildi.",
      });
    } catch (err: any) {
      console.error("Tablo kaydetme hatası:", err);
      setNotification({
        type: "danger",
        message: err?.message || "Tablo verileri kaydedilemedi.",
      });
    } finally {
      setIsSavingTable(false);
    }
  }, []);

  // Commit updated value to local state and backend (auto-save on entry)
  const handleCommitValue = useCallback((rIdx: number, cIdx: number, rawVal: string) => {
    const row = rowsRef.current[rIdx];
    const col = visibleColumns[cIdx];
    if (!row || !col) return;

    const cleanStr = rawVal.trim().replace(/,/g, ".");
    const numVal = cleanStr === "" ? 0 : parseFloat(cleanStr) || 0;
    const oldVal = row.bakiyeler[col.vezneId] || 0;

    if (numVal === oldVal) return;

    // Update local rows immediately
    const next = [...rowsRef.current];
    const targetRow = { ...next[rIdx] };
    const nextBakiyeler = { ...targetRow.bakiyeler, [col.vezneId]: numVal };
    targetRow.bakiyeler = nextBakiyeler;
    targetRow.toplam = Object.values(nextBakiyeler).reduce((sum, v) => sum + (Number(v) || 0), 0);
    next[rIdx] = targetRow;
    rowsRef.current = next;
    setRows(next);

    // Auto-save to database immediately on data entry
    VezneIzlemeService.updateBakiye(col.vezneId, row.paraId, numVal).catch((err) => {
      console.error("Otomatik bakiye kayıt hatası:", err);
    });
  }, [visibleColumns]);

  // Keyboard navigation inside cell inputs
  const handleCellKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    rIdx: number,
    cIdx: number
  ) => {
    const el = e.currentTarget;
    const len = el.value.length;
    const selStart = el.selectionStart ?? 0;
    const selEnd = el.selectionEnd ?? 0;
    const isAtStart = selStart === 0 && selEnd === 0;
    const isAtEnd = selStart === len && selEnd === len;

    if (e.key === "Enter") {
      e.preventDefault();
      handleCommitValue(rIdx, cIdx, el.value);
      setEditingCellKey(null);

      if (e.shiftKey) {
        focusCell(rIdx > 0 ? rIdx - 1 : rows.length - 1, cIdx);
      } else {
        focusCell(rIdx < rows.length - 1 ? rIdx + 1 : 0, cIdx);
      }
    } else if (e.key === "F1") {
      e.preventDefault();
      handleCommitValue(rIdx, cIdx, el.value);
      setEditingCellKey(null);
      handleSaveTable();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      handleCommitValue(rIdx, cIdx, el.value);
      setEditingCellKey(null);
      focusCell(Math.min(rows.length - 1, rIdx + 1), cIdx);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      handleCommitValue(rIdx, cIdx, el.value);
      setEditingCellKey(null);
      focusCell(Math.max(0, rIdx - 1), cIdx);
    } else if (e.key === "ArrowRight") {
      if (isAtEnd) {
        e.preventDefault();
        handleCommitValue(rIdx, cIdx, el.value);
        setEditingCellKey(null);
        focusCell(rIdx, Math.min(visibleColumns.length - 1, cIdx + 1));
      }
    } else if (e.key === "ArrowLeft") {
      if (isAtStart) {
        e.preventDefault();
        handleCommitValue(rIdx, cIdx, el.value);
        setEditingCellKey(null);
        focusCell(rIdx, Math.max(0, cIdx - 1));
      }
    } else if (e.key === "F2") {
      e.preventDefault();
      handleCommitValue(rIdx, cIdx, el.value);
      setEditingCellKey(null);
      fetchData(false);
    } else if (e.key === "F4") {
      e.preventDefault();
      handleCommitValue(rIdx, cIdx, el.value);
      handleOpenKur();
    } else if (e.key === "F5") {
      e.preventDefault();
      handleCommitValue(rIdx, cIdx, el.value);
      handleOpenDetay();
    } else if (e.key === "F8") {
      e.preventDefault();
      handleCommitValue(rIdx, cIdx, el.value);
      handleOpenVezneBakiye();
    } else if (e.key === "F9") {
      e.preventDefault();
      handleCommitValue(rIdx, cIdx, el.value);
      handleOpenFirmaDurumu();
    } else if (e.key === "F12") {
      e.preventDefault();
      handleCommitValue(rIdx, cIdx, el.value);
      handleNextVezneBatch();
    }
  };

  // Global Keyboard shortcuts: F1, ENTER, F4, F5, F8, F9, F12, Arrows (when outside input)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isAnyModalOpen) return;
      if (document.activeElement?.tagName === "INPUT") return;

      if (e.key === "F1") {
        e.preventDefault();
        handleSaveTable();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (e.ctrlKey || e.altKey) {
          fetchData(false);
        } else if (e.shiftKey) {
          focusCell(selectedRowIndex > 0 ? selectedRowIndex - 1 : rows.length - 1, selectedColIndex);
        } else {
          focusCell(selectedRowIndex < rows.length - 1 ? selectedRowIndex + 1 : 0, selectedColIndex);
        }
      } else if (e.key === "F2") {
        e.preventDefault();
        fetchData(false);
      } else if (e.key === "F4") {
        e.preventDefault();
        handleOpenKur();
      } else if (e.key === "F5") {
        e.preventDefault();
        handleOpenDetay();
      } else if (e.key === "F8") {
        e.preventDefault();
        handleOpenVezneBakiye();
      } else if (e.key === "F9") {
        e.preventDefault();
        handleOpenFirmaDurumu();
      } else if (e.key === "F12") {
        e.preventDefault();
        handleNextVezneBatch();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        focusCell(Math.min(rows.length - 1, selectedRowIndex + 1), selectedColIndex);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        focusCell(Math.max(0, selectedRowIndex - 1), selectedColIndex);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        focusCell(selectedRowIndex, Math.min(visibleColumns.length - 1, selectedColIndex + 1));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        focusCell(selectedRowIndex, Math.max(0, selectedColIndex - 1));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isAnyModalOpen,
    fetchData,
    handleSaveTable,
    handleNextVezneBatch,
    rows.length,
    visibleColumns.length,
    selectedRowIndex,
    selectedColIndex,
    focusCell,
  ]);


  // Determine active vezne for Vezne Bakiye Modal
  const activeCol = visibleColumns[selectedColIndex] || columns[0] || {
    vezneId: 0,
    kod: "01",
    ad: "Ana kasa",
    isAnaKasa: true,
  };

  const activeVezneBakiyeler = rows
    .filter((r) => (r.bakiyeler[activeCol.vezneId] || 0) !== 0)
    .map((r) => ({
      paraId: r.paraId,
      kod: r.paraKodu,
      ad: r.paraAdi,
      paraKodu: r.paraKodu,
      paraAdi: r.paraAdi,
      miktar: r.bakiyeler[activeCol.vezneId] || 0,
    }));

  // Selected row for Detay modal
  const selectedRow = rows[selectedRowIndex] || rows[0];

  // Number formatting helper
  const formatNumber = (num: number): string => {
    if (num === 0 || isNaN(num)) return "";
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: num % 1 !== 0 ? 2 : 0,
      maximumFractionDigits: 4,
    }).format(num);
  };

  // Format Toplam column: always shows currency unit at the end (e.g. "2,506,034.32 TL", "81,366 USD", "JPY")
  const renderToplam = (row: VezneIzlemeRow): string => {
    const total = row.toplam;
    if (total === 0 || isNaN(total)) {
      return row.paraKodu;
    }
    const formattedVal = formatNumber(total);
    return `${formattedVal} ${row.paraKodu}`;
  };

  return (
    <div className="d-flex flex-column h-100 bg-light" style={{ minHeight: "calc(100vh - 56px)" }}>
      {/* Top ERP Toolbar */}
      <ERPToolbar
        onRefresh={() => fetchData(false)}
        onSave={handleSaveTable}
        onPrint={() => window.print()}
        pageTitle="L- Vezne İzleme"
        hideDelete
        hideSearch
        rightContent={
          <div
            className="d-flex align-items-center gap-2 px-2.5 py-1 rounded border shadow-2xs font-monospace text-nowrap"
            style={{
              backgroundColor: "#f8fafc",
              fontSize: "12.5px",
              color: "#1e293b",
              fontWeight: 600,
            }}
          >
            <IconClock size={15} className="text-primary" />
            <span>{currentDateTime}</span>
          </div>
        }
      />

      {/* Notifications */}
      {notification && (
        <Alert
          variant={notification.type}
          dismissible
          onClose={() => setNotification(null)}
          className="m-2 py-1 px-2.5 d-flex align-items-center justify-content-between shadow-2xs small"
        >
          <span>{notification.message}</span>
        </Alert>
      )}

      {/* Main Monitoring Grid Table */}
      <div className="flex-grow-1 bg-white border mx-2 mt-1 mb-2 rounded shadow-2xs overflow-hidden d-flex flex-column">
        {isLoading ? (
          <div className="d-flex flex-column align-items-center justify-content-center flex-grow-1 py-5">
            <Spinner animation="border" variant="primary" />
            <span className="text-muted small mt-2">Vezne bakiyeleri yükleniyor...</span>
          </div>
        ) : (
          <div className="table-responsive flex-grow-1 overflow-auto" style={{ maxHeight: "calc(100vh - 170px)" }}>
            <Table bordered hover size="sm" className="mb-0 text-nowrap" style={{ fontSize: "12.5px" }}>
              {/* Table Header matching screenshot light blue */}
              <thead
                style={{
                  backgroundColor: "#bfdbfe",
                  color: "#1e3a8a",
                  position: "sticky",
                  top: 0,
                  zIndex: 3,
                  userSelect: "none",
                }}
              >
                <tr>
                  {/* First corner cell */}
                  <th
                    style={{
                      width: "65px",
                      minWidth: "65px",
                      backgroundColor: "#bfdbfe",
                      borderColor: "#93c5fd",
                      padding: "5px 8px",
                      textAlign: "center",
                    }}
                  ></th>

                  {/* Cash Desk Headers */}
                  {displayedVezneCols.map((col, idx) => (
                    <th
                      key={col.vezneId}
                      onClick={() => setSelectedColIndex(idx)}
                      style={{
                        minWidth: col.isAnaKasa ? "130px" : "110px",
                        backgroundColor: "#bfdbfe",
                        borderColor: "#93c5fd",
                        padding: "5px 10px",
                        textAlign: "center",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                      title={`${col.kod} - ${col.ad}`}
                    >
                      {col.isAnaKasa ? (col.ad || "Ana kasa") : (col.kod || col.ad)}
                    </th>
                  ))}

                  {/* Empty Filler Column Headers */}
                  {fillerColumns.map((fi) => (
                    <th
                      key={`filler-head-${fi}`}
                      style={{
                        minWidth: "110px",
                        backgroundColor: "#bfdbfe",
                        borderColor: "#93c5fd",
                        padding: "5px 8px",
                      }}
                    ></th>
                  ))}

                  {/* Toplam Column Header */}
                  <th
                    style={{
                      minWidth: "155px",
                      backgroundColor: "#bfdbfe",
                      borderColor: "#93c5fd",
                      padding: "5px 10px",
                      textAlign: "center",
                      fontWeight: 700,
                      position: "sticky",
                      right: 0,
                      zIndex: 4,
                    }}
                  >
                    Toplam
                  </th>
                </tr>
              </thead>

              {/* Table Body */}
              <tbody>
                {rows.map((row, rIdx) => {
                  const isRowSelected = rIdx === selectedRowIndex;

                  return (
                    <tr
                      key={row.paraId}
                      ref={isRowSelected ? selectedRowRef : undefined}
                      onClick={() => setSelectedRowIndex(rIdx)}
                      style={{
                        outline: isRowSelected ? "1.5px dotted #1d4ed8" : undefined,
                        outlineOffset: "-1px",
                        backgroundColor: isRowSelected ? "#eff6ff" : undefined,
                        cursor: "pointer",
                      }}
                    >
                      {/* Currency Code Cell */}
                      <td
                        style={{
                          backgroundColor: "#f8fafc",
                          fontWeight: 700,
                          textAlign: "center",
                          color: "#1e293b",
                          padding: "3px 8px",
                          borderColor: "#cbd5e1",
                        }}
                      >
                        {row.paraKodu}
                      </td>

                      {/* Cash Desk Balance Cells with Direct Value Entry */}
                      {displayedVezneCols.map((col, cIdx) => {
                        const miktar = row.bakiyeler[col.vezneId];
                        const isCellSelected = isRowSelected && cIdx === selectedColIndex;
                        const cellKey = `${row.paraId}-${col.vezneId}`;
                        const isEditing = editingCellKey === cellKey;

                        return (
                          <td
                            key={cellKey}
                            onClick={() => {
                              setSelectedRowIndex(rIdx);
                              setSelectedColIndex(cIdx);
                              focusCell(rIdx, cIdx);
                            }}
                            className="p-0 font-monospace text-end position-relative"
                            style={{
                              backgroundColor: isCellSelected
                                ? "#dbeafe"
                                : col.isAnaKasa
                                ? "#f1f5f9"
                                : "#ffffff",
                              borderColor: "#cbd5e1",
                            }}
                          >
                            <input
                              ref={(el) => {
                                cellInputRefs.current[`${rIdx}-${cIdx}`] = el;
                              }}
                              type="text"
                              inputMode="decimal"
                              value={
                                isEditing
                                  ? editingValue
                                  : miktar !== undefined && miktar !== 0
                                  ? formatNumber(miktar)
                                  : ""
                              }
                              onFocus={(e) => {
                                setSelectedRowIndex(rIdx);
                                setSelectedColIndex(cIdx);
                                setEditingCellKey(cellKey);
                                setEditingValue(
                                  miktar !== undefined && miktar !== 0 ? String(miktar) : ""
                                );
                                e.target.select();
                              }}
                              onBlur={() => {
                                if (editingCellKey === cellKey) {
                                  handleCommitValue(rIdx, cIdx, editingValue);
                                  setEditingCellKey(null);
                                }
                              }}
                              onChange={(e) => {
                                setEditingValue(e.target.value.replace(/,/g, "."));
                              }}
                              onKeyDown={(e) => handleCellKeyDown(e, rIdx, cIdx)}
                              className="form-control form-control-sm border-0 bg-transparent text-end font-monospace shadow-none px-2 py-0"
                              style={{
                                height: "26px",
                                fontSize: "12.5px",
                                fontWeight: miktar && miktar !== 0 ? 600 : 400,
                                color: "#0f172a",
                                outline: isCellSelected ? "1.5px dotted #1d4ed8" : "none",
                                outlineOffset: "-1px",
                              }}
                            />
                          </td>
                        );
                      })}

                      {/* Empty Filler Cells */}
                      {fillerColumns.map((fi) => (
                        <td
                          key={`filler-${row.paraId}-${fi}`}
                          style={{
                            padding: "3px 8px",
                            borderColor: "#cbd5e1",
                            backgroundColor: "#ffffff",
                          }}
                        ></td>
                      ))}

                      {/* Toplam Cell (Light blue background matching screenshot) */}
                      <td
                        className="font-monospace text-end"
                        style={{
                          backgroundColor: isRowSelected ? "#bfdbfe" : "#dbeafe",
                          padding: "3px 10px",
                          borderColor: "#93c5fd",
                          fontWeight: 600,
                          color: "#1e3a8a",
                          position: "sticky",
                          right: 0,
                          zIndex: 2,
                        }}
                      >
                        {renderToplam(row)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        )}

        {/* Bottom Action Bar with Green Checkmark Buttons (Matches screenshot exactly) */}
        <div
          className="d-flex align-items-center justify-content-start flex-wrap gap-2 px-3 py-1.5"
          style={{
            userSelect: "none",
            backgroundColor: "#ebebeb",
            borderTop: "1px solid #c8c8c8",
          }}
        >
          {/* ENTER)Yeni değerler */}
          <button
            type="button"
            onClick={() => fetchData(false)}
            className="btn btn-sm d-inline-flex align-items-center"
            style={{
              backgroundColor: "#f4f4f4",
              border: "1px solid #a8a8a8",
              borderRadius: "2px",
              padding: "2px 12px",
              height: "28px",
              fontSize: "12px",
              fontWeight: 500,
              color: "#000000",
              boxShadow: "0 1px 1px rgba(0,0,0,0.05)",
            }}
            title="Verileri Yenile (Enter / Ctrl+Enter / F2)"
          >
            <span style={{ color: "#16a34a", fontWeight: "bold", fontSize: "13px", marginRight: "7px" }}>✔</span>
            <span>ENTER)Yeni değerler</span>
          </button>

          {/* F4) Kur */}
          <button
            type="button"
            onClick={handleOpenKur}
            className="btn btn-sm d-inline-flex align-items-center"
            style={{
              backgroundColor: "#f4f4f4",
              border: "1px solid #a8a8a8",
              borderRadius: "2px",
              padding: "2px 12px",
              height: "28px",
              fontSize: "12px",
              fontWeight: 500,
              color: "#000000",
              boxShadow: "0 1px 1px rgba(0,0,0,0.05)",
            }}
            title="Anlık Kurları Görüntüle (F4)"
          >
            <span style={{ color: "#16a34a", fontWeight: "bold", fontSize: "13px", marginRight: "7px" }}>✔</span>
            <span>F4) Kur</span>
          </button>

          {/* F5) Detay */}
          <button
            type="button"
            onClick={handleOpenDetay}
            className="btn btn-sm d-inline-flex align-items-center"
            style={{
              backgroundColor: "#f4f4f4",
              border: "1px solid #a8a8a8",
              borderRadius: "2px",
              padding: "2px 12px",
              height: "28px",
              fontSize: "12px",
              fontWeight: 500,
              color: "#000000",
              boxShadow: "0 1px 1px rgba(0,0,0,0.05)",
            }}
            title="Seçili Para / Vezne Detayını Görüntüle (F5)"
          >
            <span style={{ color: "#16a34a", fontWeight: "bold", fontSize: "13px", marginRight: "7px" }}>✔</span>
            <span>F5) Detay</span>
          </button>

          {/* F8) Vezne bakiye */}
          <button
            type="button"
            onClick={handleOpenVezneBakiye}
            className="btn btn-sm d-inline-flex align-items-center"
            style={{
              backgroundColor: "#f4f4f4",
              border: "1px solid #a8a8a8",
              borderRadius: "2px",
              padding: "2px 12px",
              height: "28px",
              fontSize: "12px",
              fontWeight: 500,
              color: "#000000",
              boxShadow: "0 1px 1px rgba(0,0,0,0.05)",
            }}
            title="Vezne Bakiye Döküm Penceresini Aç (F8)"
          >
            <span style={{ color: "#16a34a", fontWeight: "bold", fontSize: "13px", marginRight: "7px" }}>✔</span>
            <span>F8) Vezne bakiye</span>
          </button>

          {/* F9) Firma durumu */}
          <button
            type="button"
            onClick={handleOpenFirmaDurumu}
            className="btn btn-sm d-inline-flex align-items-center"
            style={{
              backgroundColor: "#f4f4f4",
              border: "1px solid #a8a8a8",
              borderRadius: "2px",
              padding: "2px 12px",
              height: "28px",
              fontSize: "12px",
              fontWeight: 500,
              color: "#000000",
              boxShadow: "0 1px 1px rgba(0,0,0,0.05)",
            }}
            title="Firma Durumu Özetini Görüntüle (F9)"
          >
            <span style={{ color: "#16a34a", fontWeight: "bold", fontSize: "13px", marginRight: "7px" }}>✔</span>
            <span>F9) Firma durumu</span>
          </button>

          {/* F12)Vezne gerisi */}
          <button
            type="button"
            onClick={handleNextVezneBatch}
            className="btn btn-sm d-inline-flex align-items-center"
            style={{
              backgroundColor: "#f4f4f4",
              border: "1px solid #a8a8a8",
              borderRadius: "2px",
              padding: "2px 12px",
              height: "28px",
              fontSize: "12px",
              fontWeight: 500,
              color: "#000000",
              boxShadow: "0 1px 1px rgba(0,0,0,0.05)",
            }}
            title="Sonraki Vezne Kolon Grubunu Göster (F12)"
          >
            <span style={{ color: "#16a34a", fontWeight: "bold", fontSize: "13px", marginRight: "7px" }}>✔</span>
            <span>F12)Vezne gerisi</span>
          </button>

          {/* Page indicator info */}
          {totalVezneler > visibleVezneCount && (
            <span className="ms-auto small text-muted font-monospace">
              Vezneler: {pageOffset + 1} - {Math.min(pageOffset + visibleVezneCount, totalVezneler)} / {totalVezneler}
            </span>
          )}
        </div>
      </div>

      {/* ─── MODAL 1: Vezne İzleme Tanımı (SODVZ_VEZNE_IZLEME_TANIMI_KAYDET) ─── */}
      <Modal
        show={showSettingsModal}
        onHide={() => setShowSettingsModal(false)}
        centered
        backdrop="static"
      >
        <Modal.Header closeButton className="bg-light py-2 px-3">
          <Modal.Title className="fs-6 fw-bold text-primary d-flex align-items-center gap-2">
            <IconSettings size={18} />
            Vezne İzleme Tanımı
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3">
          <Form>
            {/* Tazeleme Süresi */}
            <Form.Group as={Row} className="mb-3 align-items-center">
              <Form.Label column sm={5} className="small fw-semibold text-secondary">
                Tazeleme Süresi (Sn):
              </Form.Label>
              <Col sm={7}>
                <Form.Control
                  type="number"
                  size="sm"
                  min={1}
                  max={300}
                  value={editSettings.tazelemeSuresi}
                  onChange={(e) =>
                    setEditSettings((prev) => ({
                      ...prev,
                      tazelemeSuresi: Math.max(1, Number(e.target.value) || 5),
                    }))
                  }
                  className="font-monospace"
                />
                <Form.Text className="text-muted" style={{ fontSize: "11px" }}>
                  Ekranın otomatik yenilenme periyodu (saniye).
                </Form.Text>
              </Col>
            </Form.Group>

            {/* Ekrandaki Vezne Sayısı */}
            <Form.Group as={Row} className="mb-3 align-items-center">
              <Form.Label column sm={5} className="small fw-semibold text-secondary">
                Ekrandaki Vezne Sayısı:
              </Form.Label>
              <Col sm={7}>
                <Form.Control
                  type="number"
                  size="sm"
                  min={1}
                  max={20}
                  value={editSettings.ekrandakiVezneSayisi}
                  onChange={(e) =>
                    setEditSettings((prev) => ({
                      ...prev,
                      ekrandakiVezneSayisi: Math.max(1, Number(e.target.value) || 8),
                    }))
                  }
                  className="font-monospace"
                />
                <Form.Text className="text-muted" style={{ fontSize: "11px" }}>
                  Aynı anda ekranda gösterilecek vezne sütunu sayısı.
                </Form.Text>
              </Col>
            </Form.Group>

            {/* Checkboxes */}
            <div className="p-2.5 bg-light rounded border mb-2">
              <Form.Check
                type="checkbox"
                id="modal_toplamda_para_kodu"
                label="Toplamlarda Para Kodunu Göster"
                checked={editSettings.toplamdaParaKodu}
                onChange={(e) =>
                  setEditSettings((prev) => ({
                    ...prev,
                    toplamdaParaKodu: e.target.checked,
                  }))
                }
                className="small fw-medium mb-2"
              />
              <Form.Check
                type="checkbox"
                id="modal_firma_durumu_raporu"
                label="Firma Durumu Raporu Aktif"
                checked={editSettings.firmaDurumuRaporu}
                onChange={(e) =>
                  setEditSettings((prev) => ({
                    ...prev,
                    firmaDurumuRaporu: e.target.checked,
                  }))
                }
                className="small fw-medium"
              />
            </div>
          </Form>
        </Modal.Body>
        <Modal.Footer className="bg-light py-2 px-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowSettingsModal(false)}
            disabled={isSavingSettings}
          >
            İptal
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSaveSettings}
            disabled={isSavingSettings}
            className="d-flex align-items-center gap-1.5"
          >
            {isSavingSettings ? (
              <>
                <Spinner size="sm" animation="border" />
                <span>Kaydediliyor...</span>
              </>
            ) : (
              <>
                <IconCheck size={16} />
                <span>Kaydet (F1)</span>
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ─── MODAL 2: F4 Kur Tablosu Modalı ─── */}
      <Modal
        show={showKurModal}
        onHide={() => setShowKurModal(false)}
        size="lg"
        centered
      >
        <Modal.Header closeButton className="bg-light py-2 px-3">
          <Modal.Title className="fs-6 fw-bold text-primary d-flex align-items-center gap-2">
            <IconChartLine size={18} />
            F4) Anlık Kurlar
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-0">
          {isLoadingKur ? (
            <div className="d-flex justify-content-center py-4">
              <Spinner animation="border" size="sm" />
            </div>
          ) : (
            <div className="table-responsive" style={{ maxHeight: "400px" }}>
              <Table bordered hover size="sm" className="mb-0 text-nowrap" style={{ fontSize: "12px" }}>
                <thead style={{ backgroundColor: "#bfdbfe", color: "#1e3a8a", position: "sticky", top: 0 }}>
                  <tr>
                    <th>Kod</th>
                    <th>Para Adı</th>
                    <th className="text-end">Döviz Alış</th>
                    <th className="text-end">Döviz Satış</th>
                    <th className="text-end">Efektif Alış</th>
                    <th className="text-end">Efektif Satış</th>
                  </tr>
                </thead>
                <tbody>
                  {kurList.map((k) => (
                    <tr key={k.paraId}>
                      <td className="fw-bold">{k.kod}</td>
                      <td>{k.ad}</td>
                      <td className="text-end font-monospace">{k.dovizAlis ?? "-"}</td>
                      <td className="text-end font-monospace">{k.dovizSatis ?? "-"}</td>
                      <td className="text-end font-monospace">{k.efektifAlis ?? "-"}</td>
                      <td className="text-end font-monospace">{k.efektifSatis ?? "-"}</td>
                    </tr>
                  ))}
                  {kurList.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center text-muted py-3">
                        Tanımlı kur kaydı bulunamadı.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="bg-light py-1.5 px-3">
          <Button variant="secondary" size="sm" onClick={() => setShowKurModal(false)}>
            Kapat (ESC)
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ─── MODAL 3: F5 Detay Modalı ─── */}
      <Modal
        show={showDetayModal}
        onHide={() => setShowDetayModal(false)}
        centered
      >
        <Modal.Header closeButton className="bg-light py-2 px-3">
          <Modal.Title className="fs-6 fw-bold text-primary d-flex align-items-center gap-2">
            <IconListDetails size={18} />
            F5) Detay Dağılımı ({selectedRow ? `${selectedRow.paraKodu} - ${selectedRow.paraAdi}` : ""})
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3">
          {selectedRow ? (
            <div className="table-responsive">
              <Table bordered hover size="sm" className="mb-0" style={{ fontSize: "12.5px" }}>
                <thead style={{ backgroundColor: "#bfdbfe", color: "#1e3a8a" }}>
                  <tr>
                    <th>Vezne Kodu</th>
                    <th>Vezne Adı</th>
                    <th className="text-end">Bakiye ({selectedRow.paraKodu})</th>
                  </tr>
                </thead>
                <tbody>
                  {columns.map((col) => {
                    const bakiye = selectedRow.bakiyeler[col.vezneId] || 0;
                    return (
                      <tr key={col.vezneId} style={{ backgroundColor: bakiye > 0 ? "#f0fdf4" : undefined }}>
                        <td className="fw-semibold">{col.kod}</td>
                        <td>{col.ad}</td>
                        <td className="text-end font-monospace fw-bold text-primary">
                          {formatNumber(bakiye) || "0"}
                        </td>
                      </tr>
                    );
                  })}
                  <tr style={{ backgroundColor: "#dbeafe" }}>
                    <td colSpan={2} className="fw-bold text-end">
                      Genel Toplam:
                    </td>
                    <td className="text-end font-monospace fw-bold text-primary">
                      {formatNumber(selectedRow.toplam) || "0"} {selectedRow.paraKodu}
                    </td>
                  </tr>
                </tbody>
              </Table>
            </div>
          ) : (
            <div className="text-center text-muted py-3">Seçili para kaydı yok.</div>
          )}
        </Modal.Body>
        <Modal.Footer className="bg-light py-1.5 px-3">
          <Button variant="secondary" size="sm" onClick={() => setShowDetayModal(false)}>
            Kapat (ESC)
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ─── MODAL 4: F8 Vezne Bakiye Modalı ─── */}
      <VezneBakiyeModal
        show={showVezneBakiyeModal}
        onClose={() => setShowVezneBakiyeModal(false)}
        vezneAd={activeCol.ad}
        vezneKod={activeCol.kod}
        bakiyeler={activeVezneBakiyeler}
      />

      {/* ─── MODAL 5: F9 Firma Durumu Modalı ─── */}
      <Modal
        show={showFirmaDurumuModal}
        onHide={() => setShowFirmaDurumuModal(false)}
        size="lg"
        centered
      >
        <Modal.Header closeButton className="bg-light py-2 px-3">
          <Modal.Title className="fs-6 fw-bold text-primary d-flex align-items-center gap-2">
            <IconBuildingBank size={18} />
            F9) Firma Durumu / Varlık Özeti
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3">
          <div className="table-responsive">
            <Table bordered hover size="sm" className="mb-0" style={{ fontSize: "12.5px" }}>
              <thead style={{ backgroundColor: "#bfdbfe", color: "#1e3a8a" }}>
                <tr>
                  <th>Para Kodu</th>
                  <th>Para Adı</th>
                  <th className="text-end">Toplam Kasa Bakiyesi</th>
                </tr>
              </thead>
              <tbody>
                {rows
                  .filter((r) => r.toplam !== 0)
                  .map((r) => (
                    <tr key={r.paraId}>
                      <td className="fw-bold">{r.paraKodu}</td>
                      <td>{r.paraAdi}</td>
                      <td className="text-end font-monospace fw-bold text-primary">
                        {formatNumber(r.toplam)} {r.paraKodu}
                      </td>
                    </tr>
                  ))}
                {rows.filter((r) => r.toplam !== 0).length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-center text-muted py-3">
                      Tüm kasalarda pozitif bakiye bulunmamaktadır.
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
        </Modal.Body>
        <Modal.Footer className="bg-light py-1.5 px-3">
          <Button variant="secondary" size="sm" onClick={() => setShowFirmaDurumuModal(false)}>
            Kapat (ESC)
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default VezneIzlemePage;
