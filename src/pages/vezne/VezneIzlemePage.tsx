import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  IconAlertCircle,
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
import { CompanyService, TodvzTanimDto } from "../../services/companyService";

export const sortVezneRows = (rowsList?: VezneIzlemeRow[]): VezneIzlemeRow[] => {
  if (!rowsList || rowsList.length === 0) return [];
  return [...rowsList].sort((a, b) => {
    const seqA = Number(a.siraNo) > 0 ? Number(a.siraNo) : 9999999;
    const seqB = Number(b.siraNo) > 0 ? Number(b.siraNo) : 9999999;
    if (seqA !== seqB) {
      return seqA - seqB;
    }
    return (Number(a.paraId) || 0) - (Number(b.paraId) || 0);
  });
};

export const VezneIzlemePage: React.FC = () => {
  // Data state
  const [columns, setColumns] = useState<VezneIzlemeColumn[]>([]);
  const [rows, setRows] = useState<VezneIzlemeRow[]>([]);
  const [companyDefinitions, setCompanyDefinitions] = useState<TodvzTanimDto | null>(null);
  const [settings, setSettings] = useState<VezneIzlemeSettings>({
    tazelemeSuresi: 5,
    ekrandakiVezneSayisi: 8,
    toplamdaParaKodu: true,
    firmaDurumuRaporu: false,
  });

  // UI / Selection state (Read-only monitoring, clicking selects the kasa/vezne)
  const [selectedVezneId, setSelectedVezneId] = useState<number | null>(null);
  const [selectedParaId, setSelectedParaId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [notification, setNotification] = useState<{
    type: "success" | "danger" | "warning" | "info";
    message: string;
  } | null>(null);

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

  // Load company definitions for decimal formatting
  useEffect(() => {
    CompanyService.getDefinitions()
      .then((res) => {
        if (res) setCompanyDefinitions(res);
      })
      .catch((err) => console.error("Firma tanımları yüklenemedi:", err));
  }, []);

  // Decimal formatting according to Firma Tanımları basamak sayıları
  const getDecimalsForPara = useCallback(
    (paraKodu: string): number => {
      const code = (paraKodu || "").trim().toUpperCase();
      if (code === "TL" || code === "TRY") {
        return companyDefinitions?.TL_KURUS_SAYISI !== undefined && companyDefinitions?.TL_KURUS_SAYISI !== null
          ? Number(companyDefinitions.TL_KURUS_SAYISI)
          : 2;
      }
      if (
        code === "HAS" ||
        code === "GAU" ||
        code === "GR" ||
        code === "GLD" ||
        code === "KULCE" ||
        code.includes("ALTIN") ||
        code.includes("AYAR")
      ) {
        return companyDefinitions?.GRAM_ONDALIK_SAYISI !== undefined && companyDefinitions?.GRAM_ONDALIK_SAYISI !== null
          ? Number(companyDefinitions.GRAM_ONDALIK_SAYISI)
          : 2;
      }
      // Döviz Kuruş / Ondalık Basamak Sayısı
      return companyDefinitions?.DOVIZ_KURUS_SAYISI !== undefined && companyDefinitions?.DOVIZ_KURUS_SAYISI !== null
        ? Number(companyDefinitions.DOVIZ_KURUS_SAYISI)
        : 2;
    },
    [companyDefinitions]
  );

  const formatNumber = useCallback(
    (num: number, paraKodu?: string): string => {
      if (num === 0 || isNaN(num) || num === undefined || num === null) return "";
      const decimals = paraKodu ? getDecimalsForPara(paraKodu) : (num % 1 !== 0 ? 2 : 0);
      return new Intl.NumberFormat("tr-TR", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(num);
    },
    [getDecimalsForPara]
  );

  // Fetch izleme data from backend
  const fetchData = useCallback(async (silent: boolean = false) => {
    if (!silent) setIsLoading(true);
    try {
      const data = await VezneIzlemeService.getIzlemeData();
      if (data) {
        const sortedRows = sortVezneRows(data.rows);
        setSettings(data.settings);
        setColumns(data.columns);
        setRows(sortedRows);
        setLastRefreshed(new Date());

        // Select first vezne and first row if not already selected
        if (data.columns && data.columns.length > 0) {
          setSelectedVezneId((prev) => (prev !== null && data.columns.some((c) => c.vezneId === prev) ? prev : data.columns[0].vezneId));
        }
        if (sortedRows && sortedRows.length > 0) {
          setSelectedParaId((prev) => (prev !== null && sortedRows.some((r) => r.paraId === prev) ? prev : sortedRows[0].paraId));
        }
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

  // F4) Open Kur Modal
  const handleOpenKur = useCallback(async () => {
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
  }, []);

  // F5) Open Detay Modal
  const handleOpenDetay = useCallback(() => {
    setShowDetayModal(true);
  }, []);

  // F8) Open Vezne Bakiye Modal
  const handleOpenVezneBakiye = useCallback(() => {
    setShowVezneBakiyeModal(true);
  }, []);

  // F9) Open Firma Durumu Modal
  const handleOpenFirmaDurumu = useCallback(() => {
    setShowFirmaDurumuModal(true);
  }, []);

  // 8'li bloklara bölme (Her tabloda tam 8 vezne sütunu, 8'den fazlası alt alta yeni tabloda gösterilir, yatay kaydırma olmaz)
  const CHUNK_SIZE = 8;
  const vezneChunks = useMemo(() => {
    if (!columns || columns.length === 0) return [];
    const chunks: VezneIzlemeColumn[][] = [];
    for (let i = 0; i < columns.length; i += CHUNK_SIZE) {
      chunks.push(columns.slice(i, i + CHUNK_SIZE));
    }
    return chunks;
  }, [columns]);

  // Active selected vezne object
  const activeCol = useMemo(() => {
    if (selectedVezneId !== null) {
      const found = columns.find((c) => c.vezneId === selectedVezneId);
      if (found) return found;
    }
    return columns[0] || {
      vezneId: 0,
      kod: "01",
      ad: "Ana kasa",
      isAnaKasa: true,
    };
  }, [columns, selectedVezneId]);

  const activeVezneBakiyeler = useMemo(() => {
    return rows
      .filter((r) => (r.bakiyeler[activeCol.vezneId] || 0) !== 0)
      .map((r) => ({
        paraId: r.paraId,
        kod: r.paraKodu,
        ad: r.paraAdi,
        paraKodu: r.paraKodu,
        paraAdi: r.paraAdi,
        miktar: r.bakiyeler[activeCol.vezneId] || 0,
      }));
  }, [rows, activeCol.vezneId]);

  // Selected row for Detay modal
  const selectedRow = useMemo(() => {
    if (selectedParaId !== null) {
      const found = rows.find((r) => r.paraId === selectedParaId);
      if (found) return found;
    }
    return rows[0] || null;
  }, [rows, selectedParaId]);

  // Global Keyboard listener for F-keys and Arrow navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isAnyModalOpen) return;

      if (e.key === "Enter" || e.key === "F2") {
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
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (columns.length > 0) {
          const currIdx = columns.findIndex((c) => c.vezneId === selectedVezneId);
          if (currIdx >= 0 && currIdx < columns.length - 1) {
            setSelectedVezneId(columns[currIdx + 1].vezneId);
          } else if (currIdx === -1) {
            setSelectedVezneId(columns[0].vezneId);
          }
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (columns.length > 0) {
          const currIdx = columns.findIndex((c) => c.vezneId === selectedVezneId);
          if (currIdx > 0) {
            setSelectedVezneId(columns[currIdx - 1].vezneId);
          }
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (rows.length > 0) {
          const currIdx = rows.findIndex((r) => r.paraId === selectedParaId);
          if (currIdx >= 0 && currIdx < rows.length - 1) {
            setSelectedParaId(rows[currIdx + 1].paraId);
          } else if (currIdx === -1) {
            setSelectedParaId(rows[0].paraId);
          }
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (rows.length > 0) {
          const currIdx = rows.findIndex((r) => r.paraId === selectedParaId);
          if (currIdx > 0) {
            setSelectedParaId(rows[currIdx - 1].paraId);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isAnyModalOpen,
    fetchData,
    columns,
    rows,
    selectedVezneId,
    selectedParaId,
    handleOpenKur,
    handleOpenDetay,
    handleOpenVezneBakiye,
    handleOpenFirmaDurumu,
  ]);

  // Format Toplam column: always shows currency unit at the end
  const renderToplam = (row: VezneIzlemeRow): string => {
    const total = row.toplam;
    if (total === 0 || isNaN(total)) {
      return row.paraKodu;
    }
    const formattedVal = formatNumber(total, row.paraKodu);
    return `${formattedVal} ${row.paraKodu}`;
  };

  return (
    <div className="w-100 pb-3 d-flex flex-column h-100" style={{ minHeight: "calc(100vh - 56px)" }}>
      {/* Top ERP Toolbar */}
      <ERPToolbar
        onRefresh={() => fetchData(false)}
        onPrint={() => window.print()}
        pageTitle="L- Vezne İzleme"
        hideDelete
        hideSearch
        hideNavigation
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

      {/* Sayfa Ortası Popup Bildirimler (ERP Toast) */}
      {notification && (
        <div className="erp-toast-container">
          <Alert
            variant={notification.type}
            dismissible
            onClose={() => setNotification(null)}
            className="erp-toast-item d-flex align-items-center mb-0 shadow py-2 px-3 border-0"
          >
            {notification.type === "success" ? (
              <IconCheck size={18} className="me-2 text-success flex-shrink-0" />
            ) : (
              <IconAlertCircle size={18} className="me-2 text-danger flex-shrink-0" />
            )}
            <span style={{ fontSize: "13px" }}>{notification.message}</span>
          </Alert>
        </div>
      )}

      {/* Main Monitoring Content - 8'li Tablolar Alt Alta (Sağa kaydırmasız) */}
      <div className="flex-grow-1 bg-white border mt-1 mb-2 rounded shadow-2xs overflow-hidden d-flex flex-column">
        {isLoading ? (
          <div className="d-flex flex-column align-items-center justify-content-center flex-grow-1 py-5">
            <Spinner animation="border" variant="primary" />
            <span className="text-muted small mt-2">Vezne bakiyeleri yükleniyor...</span>
          </div>
        ) : (
          <div className="flex-grow-1 p-2" style={{ overflowY: "auto", overflowX: "hidden" }}>
            {vezneChunks.map((chunk, chunkIdx) => {
              const fillerCount = Math.max(0, 8 - chunk.length);
              const fillerArray = Array.from({ length: fillerCount }, (_, i) => i);
              const isMultiChunk = vezneChunks.length > 1;

              return (
                <div key={`vezne-chunk-${chunkIdx}`} className="mb-3">
                  {/* Çoklu Tablo Varsa Bölüm Başlığı */}
                  {isMultiChunk && (
                    <div className="d-flex align-items-center justify-content-between bg-light px-2.5 py-1 border rounded-top border-bottom-0">
                      <span className="small fw-bold text-primary">
                        📊 Vezneler ({chunkIdx * 8 + 1} - {chunkIdx * 8 + chunk.length})
                      </span>
                      <span className="badge bg-secondary-subtle text-secondary small">
                        Toplam {columns.length} Vezne
                      </span>
                    </div>
                  )}

                  <div className={`table-responsive border ${isMultiChunk ? "rounded-bottom" : "rounded"}`}>
                    <Table
                      bordered
                      hover
                      size="sm"
                      className="mb-0 text-nowrap align-middle"
                      style={{
                        fontSize: "12px",
                        tableLayout: "fixed",
                        width: "100%",
                      }}
                    >
                      {/* Header (8 Vezne Kolonu + Kod + Toplam) */}
                      <thead
                        style={{
                          backgroundColor: "#bfdbfe",
                          color: "#1e3a8a",
                          userSelect: "none",
                        }}
                      >
                        <tr>
                          {/* Para Kodu Sütun Başlığı */}
                          <th
                            style={{
                              width: "70px",
                              backgroundColor: "#bfdbfe",
                              borderColor: "#93c5fd",
                              padding: "6px 8px",
                              textAlign: "center",
                              fontWeight: 700,
                            }}
                          >
                            SMB
                          </th>

                          {/* 8 Vezne Kolon Başlıkları */}
                          {chunk.map((col) => {
                            const isSelected = selectedVezneId !== null && Number(col.vezneId) === Number(selectedVezneId);

                            return (
                              <th
                                key={col.vezneId}
                                onClick={() => setSelectedVezneId(Number(col.vezneId))}
                                style={{
                                  backgroundColor: isSelected ? "#38bdf8" : "#e2e8f0",
                                  boxShadow: isSelected
                                    ? "inset 0 0 0 9999px #38bdf8"
                                    : "inset 0 0 0 9999px #e2e8f0",
                                  color: isSelected ? "#082f49" : "#334155",
                                  borderLeft: isSelected ? "2px solid #0284c7" : "1px solid #cbd5e1",
                                  borderRight: isSelected ? "2px solid #0284c7" : "1px solid #cbd5e1",
                                  borderTop: isSelected ? "2px solid #0284c7" : "1px solid #cbd5e1",
                                  borderBottom: isSelected ? "2px solid #0284c7" : "1px solid #cbd5e1",
                                  padding: "6px 6px",
                                  textAlign: "center",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  transition: "all 0.15s ease",
                                }}
                                title={`${col.kod} - ${col.ad} (Seçmek için tıklayın)`}
                              >
                                <div className="d-flex align-items-center justify-content-center gap-1 text-truncate">
                                  <span>{col.isAnaKasa ? (col.ad || "Ana Kasa") : (col.kod || col.ad)}</span>
                                  {isSelected && (
                                    <span
                                      className="badge bg-primary text-white px-1 py-0 rounded"
                                      style={{ fontSize: "9px" }}
                                    >
                                      ✓
                                    </span>
                                  )}
                                </div>
                              </th>
                            );
                          })}

                          {/* Eksik Kolonları Dolduran Boş Hücreler (Toplam 8'e tamamlama) */}
                          {fillerArray.map((fi) => (
                            <th
                              key={`filler-head-${fi}`}
                              style={{
                                backgroundColor: "#e2e8f0",
                                boxShadow: "inset 0 0 0 9999px #e2e8f0",
                                borderColor: "#cbd5e1",
                                padding: "6px 8px",
                              }}
                            ></th>
                          ))}

                          {/* Toplam Sütun Başlığı */}
                          <th
                            style={{
                              width: "140px",
                              backgroundColor: "#e2e8f0",
                              boxShadow: "inset 0 0 0 9999px #e2e8f0",
                              borderColor: "#cbd5e1",
                              color: "#334155",
                              padding: "6px 8px",
                              textAlign: "center",
                              fontWeight: 700,
                            }}
                          >
                            Toplam
                          </th>
                        </tr>
                      </thead>

                      {/* Body (Read-only values, Click selects Kasa) */}
                      <tbody>
                        {rows.map((row, rIdx) => {
                          const isRowActive = row.paraId === selectedParaId;
                          const baseRowBg = rIdx % 2 === 0 ? "#ffffff" : "#f8fafc";
                          const isLastRow = rIdx === rows.length - 1;

                          return (
                            <tr
                              key={row.paraId}
                              onClick={() => setSelectedParaId(row.paraId)}
                              style={{
                                backgroundColor: baseRowBg,
                              }}
                            >
                              {/* Para Kodu */}
                              <td
                                style={{
                                  backgroundColor: isRowActive
                                    ? "#e0f2fe"
                                    : rIdx % 2 === 0
                                    ? "#f1f5f9"
                                    : "#e2e8f0",
                                  boxShadow: isRowActive
                                    ? "inset 0 0 0 9999px #e0f2fe"
                                    : undefined,
                                  fontWeight: 700,
                                  textAlign: "center",
                                  color: isRowActive ? "#0369a1" : "#1e293b",
                                  padding: "4px 6px",
                                  borderColor: "#cbd5e1",
                                  cursor: "pointer",
                                }}
                              >
                                {row.paraKodu}
                              </td>

                              {/* 8 Vezne Değerleri (Salt Okunur / Input Yok) */}
                              {chunk.map((col) => {
                                const miktar = row.bakiyeler[col.vezneId];
                                const isColSelected = selectedVezneId !== null && Number(col.vezneId) === Number(selectedVezneId);
                                const isIntersect = isColSelected && isRowActive;
                                const formattedVal = formatNumber(miktar, row.paraKodu);

                                const cellBg = isIntersect ? "#7dd3fc" : isColSelected ? "#bae6fd" : baseRowBg;

                                return (
                                  <td
                                    key={`${row.paraId}-${col.vezneId}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedVezneId(Number(col.vezneId));
                                      setSelectedParaId(row.paraId);
                                    }}
                                    className="font-monospace text-end p-0"
                                    style={{
                                      backgroundColor: cellBg,
                                      boxShadow: `inset 0 0 0 9999px ${cellBg}`,
                                      borderLeft: isColSelected ? "2px solid #0284c7" : "1px solid #cbd5e1",
                                      borderRight: isColSelected ? "2px solid #0284c7" : "1px solid #cbd5e1",
                                      borderTop: isColSelected ? "1px solid #7dd3fc" : "1px solid #cbd5e1",
                                      borderBottom: isColSelected
                                        ? isLastRow
                                          ? "2px solid #0284c7"
                                          : "1px solid #7dd3fc"
                                        : "1px solid #cbd5e1",
                                      cursor: "pointer",
                                      userSelect: "none",
                                      transition: "background-color 0.15s ease",
                                    }}
                                    title={`Vezne: ${col.kod} (${col.ad}) | ${row.paraKodu}: ${formattedVal || "0"}`}
                                  >
                                    <div
                                      className="px-2 py-1 text-truncate text-end"
                                      style={{
                                        minHeight: "26px",
                                        lineHeight: "24px",
                                        fontWeight: isColSelected ? 700 : miktar && miktar !== 0 ? 600 : 400,
                                        color: isColSelected ? "#0c4a6e" : miktar && miktar !== 0 ? "#0f172a" : "#94a3b8",
                                      }}
                                    >
                                      {formattedVal}
                                    </div>
                                  </td>
                                );
                              })}

                              {/* Boş Tamamlama Hücreleri */}
                              {fillerArray.map((fi) => (
                                <td
                                  key={`filler-cell-${row.paraId}-${fi}`}
                                  style={{
                                    borderColor: "#cbd5e1",
                                    backgroundColor: baseRowBg,
                                    boxShadow: `inset 0 0 0 9999px ${baseRowBg}`,
                                    padding: "4px 8px",
                                  }}
                                ></td>
                              ))}

                              {/* Toplam Hücresi */}
                              <td
                                className="font-monospace text-end px-2 py-1"
                                style={{
                                  backgroundColor: isRowActive ? "#e0f2fe" : rIdx % 2 === 0 ? "#f8fafc" : "#f1f5f9",
                                  boxShadow: isRowActive ? "inset 0 0 0 9999px #e0f2fe" : undefined,
                                  borderColor: "#cbd5e1",
                                  fontWeight: 700,
                                  color: "#1e293b",
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
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom Action Bar with Green Checkmark Buttons (Matches screenshot exactly) */}
        <div
          className="d-flex align-items-center justify-content-between flex-wrap gap-2 px-3 py-1.5"
          style={{
            userSelect: "none",
            backgroundColor: "#ebebeb",
            borderTop: "1px solid #c8c8c8",
          }}
        >
          <div className="d-flex align-items-center flex-wrap gap-2">
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
              title="Verileri Yenile (Enter / F2)"
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
              title="Seçili Veznenin Bakiye Döküm Penceresini Aç (F8)"
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
          </div>

          {/* Aktif Seçili Kasa Göstergesi */}
          {activeCol && (
            <div className="d-flex align-items-center gap-1.5 font-monospace text-nowrap">
              <span className="small text-muted">Aktif Kasa:</span>
              <span className="badge bg-primary px-2.5 py-1 fw-bold fs-7 shadow-2xs">
                [{activeCol.kod}] {activeCol.ad}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ─── MODAL 1: Vezne İzleme Tanımı ─── */}
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
                    const isSelectedCol = col.vezneId === selectedVezneId;

                    return (
                      <tr
                        key={col.vezneId}
                        style={{
                          backgroundColor: isSelectedCol ? "#bae6fd" : bakiye > 0 ? "#f0fdf4" : undefined,
                          fontWeight: isSelectedCol ? 700 : undefined,
                        }}
                      >
                        <td className="fw-semibold">
                          {col.kod} {isSelectedCol && <span className="badge bg-primary ms-1">Seçili</span>}
                        </td>
                        <td>{col.ad}</td>
                        <td className="text-end font-monospace fw-bold text-primary">
                          {formatNumber(bakiye, selectedRow.paraKodu) || "0"}
                        </td>
                      </tr>
                    );
                  })}
                  <tr style={{ backgroundColor: "#dbeafe" }}>
                    <td colSpan={2} className="fw-bold text-end">
                      Genel Toplam:
                    </td>
                    <td className="text-end font-monospace fw-bold text-primary">
                      {formatNumber(selectedRow.toplam, selectedRow.paraKodu) || "0"} {selectedRow.paraKodu}
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
                        {formatNumber(r.toplam, r.paraKodu)} {r.paraKodu}
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
