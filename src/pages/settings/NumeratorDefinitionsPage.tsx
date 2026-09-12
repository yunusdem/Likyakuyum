import React, { useState, useEffect, useMemo } from "react";
import { Alert, Spinner, Button } from "react-bootstrap";
import { IconCheck, IconAlertCircle, IconNumbers, IconBinoculars, IconX } from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import { NumeratorService, NumeratorItem } from "../../services/numeratorService";
import { PrinterService, YaziciItem } from "../../services/printerService";
import { LookupModal, LookupColumn } from "../../components/common/LookupModal";

interface StandardNumeratorDef {
  tur: number;
  ad: string;
  defaultUzunluk: number;
}

const STANDARD_NUMERATORS: StandardNumeratorDef[] = [
  { tur: 0, ad: "Alış seri no #1", defaultUzunluk: 10 },
  { tur: 1, ad: "Alış seri no #2", defaultUzunluk: 10 },
  { tur: 2, ad: "Alış seri no #3", defaultUzunluk: 10 },
  { tur: 3, ad: "Alış seri no #4", defaultUzunluk: 10 },
  { tur: 4, ad: "Satış seri no #1", defaultUzunluk: 10 },
  { tur: 5, ad: "Satış seri no #2", defaultUzunluk: 10 },
  { tur: 6, ad: "Satış seri no #3", defaultUzunluk: 10 },
  { tur: 7, ad: "Satış seri no #4", defaultUzunluk: 10 },
  { tur: 8, ad: "Alış belge no", defaultUzunluk: 10 },
  { tur: 9, ad: "Satış belge no", defaultUzunluk: 10 },
  { tur: 10, ad: "Transfer fişi", defaultUzunluk: 10 },
  { tur: 11, ad: "Cari kart kodu", defaultUzunluk: 10 },
  { tur: 12, ad: "Muhasebe fiş no", defaultUzunluk: 10 },
  { tur: 13, ad: "Muhasebe yevmiye no", defaultUzunluk: 10 },
  { tur: 14, ad: "e-Alış fişi belge no #1", defaultUzunluk: 16 },
  { tur: 15, ad: "e-Alış fişi belge no #2", defaultUzunluk: 16 },
  { tur: 16, ad: "e-Alış fişi belge no #3", defaultUzunluk: 16 },
  { tur: 17, ad: "e-Alış fişi belge no #4", defaultUzunluk: 16 },
  { tur: 18, ad: "e-Satış fişi belge no #1", defaultUzunluk: 16 },
  { tur: 19, ad: "e-Satış fişi belge no #2", defaultUzunluk: 16 },
  { tur: 20, ad: "e-Satış fişi belge no #3", defaultUzunluk: 16 },
  { tur: 21, ad: "e-Satış fişi belge no #4", defaultUzunluk: 16 },
  { tur: 22, ad: "e-İrsaliye belge no #1", defaultUzunluk: 16 },
  { tur: 23, ad: "e-İrsaliye belge no #2", defaultUzunluk: 16 },
  { tur: 24, ad: "e-Müstahsil makbuzu #1", defaultUzunluk: 16 },
  { tur: 25, ad: "e-Serbest meslek makbuzu #1", defaultUzunluk: 16 },
];

interface NumeratorRowState {
  tur: number;
  ad: string;
  isActive: boolean;
  yaziciId: number | null;
  yaziciAdi?: string | null;
  onek: string;
  baslangic: number | string;
  bitis: number | string;
  uzunluk: number | string;
  onuneSifirKoy: boolean;
  existingId: string | null;
  isDirty?: boolean;
}

export const NumeratorDefinitionsPage: React.FC = () => {
  const [rows, setRows] = useState<NumeratorRowState[]>([]);
  const [yazicilar, setYazicilar] = useState<YaziciItem[]>([]);
  const [showYaziciModal, setShowYaziciModal] = useState<boolean>(false);
  const [selectedTurForYazici, setSelectedTurForYazici] = useState<number | null>(null);

  const [activeCell, setActiveCell] = useState<{ tur: number; col: string } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [alertSuccess, setAlertSuccess] = useState<string | null>(null);
  const [alertError, setAlertError] = useState<string | null>(null);

  const yaziciColumns: LookupColumn<YaziciItem>[] = [
    {
      header: "Sıra No",
      width: "80px",
      align: "center",
      render: (item) => item.siraNo ?? item.id,
    },
    {
      header: "Yazıcı Adı",
      width: "220px",
      align: "left",
      render: (item) => <strong>{item.ad}</strong>,
    },
    {
      header: "Cihaz Adı",
      width: "200px",
      align: "left",
      render: (item) => item.cihazAdi || <span className="text-muted">-</span>,
    },
    {
      header: "Bağlantı Noktası",
      width: "150px",
      align: "left",
      render: (item) => item.baglantiNoktasi || <span className="text-muted">-</span>,
    },
  ];

  const yaziciFilterFn = (item: YaziciItem, term: string): boolean => {
    const t = term.toLowerCase().trim();
    if (!t) return true;
    return (
      (item.ad || "").toLowerCase().includes(t) ||
      (item.cihazAdi || "").toLowerCase().includes(t) ||
      (item.baglantiNoktasi || "").toLowerCase().includes(t) ||
      String(item.siraNo || "").includes(t) ||
      String(item.id || "").includes(t)
    );
  };

  const loadData = async () => {
    try {
      setIsLoading(true);
      setAlertError(null);

      const [dbList, yaziciList] = await Promise.all([
        NumeratorService.getNumerators().catch(() => []),
        PrinterService.getYazicilar().catch(() => []),
      ]);
      setYazicilar(yaziciList);

      const dbMap = new Map<number, NumeratorItem>();
      (dbList || []).forEach((item) => {
        dbMap.set(Number(item.tur), item);
      });

      const initialRows: NumeratorRowState[] = STANDARD_NUMERATORS.map((std) => {
        const found = dbMap.get(std.tur);
        if (found) {
          return {
            tur: std.tur,
            ad: std.ad,
            isActive: true,
            yaziciId: found.yaziciId ?? null,
            yaziciAdi: found.yaziciAdi ?? null,
            onek: found.onek || "",
            baslangic: found.baslangic ?? 0,
            bitis: found.bitis && found.bitis > 0 ? found.bitis : "",
            uzunluk: found.uzunluk ?? std.defaultUzunluk,
            onuneSifirKoy: found.onuneSifirKoy !== false,
            existingId: found.id,
            isDirty: false,
          };
        } else {
          return {
            tur: std.tur,
            ad: std.ad,
            isActive: false,
            yaziciId: null,
            yaziciAdi: null,
            onek: "",
            baslangic: "",
            bitis: "",
            uzunluk: "",
            onuneSifirKoy: false,
            existingId: null,
            isDirty: false,
          };
        }
      });

      // Include any non-standard numerators existing in DB
      (dbList || []).forEach((item) => {
        if (!STANDARD_NUMERATORS.some((s) => s.tur === Number(item.tur))) {
          initialRows.push({
            tur: Number(item.tur),
            ad: `Numaratör #${item.tur}`,
            isActive: true,
            yaziciId: item.yaziciId ?? null,
            yaziciAdi: item.yaziciAdi ?? null,
            onek: item.onek || "",
            baslangic: item.baslangic ?? 0,
            bitis: item.bitis && item.bitis > 0 ? item.bitis : "",
            uzunluk: item.uzunluk ?? 10,
            onuneSifirKoy: item.onuneSifirKoy !== false,
            existingId: item.id,
            isDirty: false,
          });
        }
      });

      setRows(initialRows);
    } catch (err: any) {
      setAlertError(err?.message || "Numaratör verileri yüklenirken bir hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleActive = (tur: number) => {
    const currentRow = rows.find((r) => r.tur === tur);
    const willBeActive = !currentRow?.isActive;

    if (!willBeActive) {
      // Unchecked tick: immediately delete from DB so no old record remains
      NumeratorService.deleteNumerator(`${tur}_null`).catch(() => {});
    }

    setRows((prev) =>
      prev.map((r) => {
        if (r.tur !== tur) return r;
        const std = STANDARD_NUMERATORS.find((s) => s.tur === tur);
        const defUzunluk = std ? std.defaultUzunluk : 10;

        return {
          ...r,
          isActive: willBeActive,
          yaziciId: willBeActive ? r.yaziciId : null,
          yaziciAdi: willBeActive ? r.yaziciAdi : null,
          onek: willBeActive ? r.onek : "",
          baslangic: willBeActive ? (r.baslangic !== "" ? r.baslangic : 1) : "",
          bitis: willBeActive ? r.bitis : "",
          uzunluk: willBeActive ? (r.uzunluk !== "" ? r.uzunluk : defUzunluk) : "",
          onuneSifirKoy: willBeActive ? true : false,
          isDirty: true,
          existingId: willBeActive ? r.existingId : null,
        };
      })
    );
  };

  const handleFieldChange = (
    tur: number,
    field: "onek" | "baslangic" | "bitis" | "uzunluk" | "onuneSifirKoy" | "yaziciId" | "yaziciAdi",
    val: any
  ) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.tur !== tur) return r;
        return {
          ...r,
          [field]: val,
          isDirty: true,
        };
      })
    );
  };

  const handleSelectYazici = (yazici: YaziciItem) => {
    if (selectedTurForYazici !== null) {
      handleFieldChange(selectedTurForYazici, "yaziciId", yazici.id);
      handleFieldChange(selectedTurForYazici, "yaziciAdi", yazici.ad);
      setShowYaziciModal(false);
      setSelectedTurForYazici(null);
    }
  };

  const handleClearYazici = (tur: number) => {
    handleFieldChange(tur, "yaziciId", null);
    handleFieldChange(tur, "yaziciAdi", null);
  };

  const handleSaveAll = async () => {
    try {
      setIsSaving(true);
      setAlertError(null);
      setAlertSuccess(null);

      let savedCount = 0;
      let deletedCount = 0;

      for (const row of rows) {
        if (row.isActive) {
          const MAX_INT = 2147483647;
          const cleanOnek = (String(row.onek || "")).trim().slice(0, 50);
          const rawBaslangic = parseInt(String(row.baslangic).replace(/[^0-9]/g, ""), 10) || 0;
          const rawBitis = parseInt(String(row.bitis).replace(/[^0-9]/g, ""), 10) || 0;
          const rawUzunluk = parseInt(String(row.uzunluk).replace(/[^0-9]/g, ""), 10) || 10;

          const cleanBaslangic = Math.min(MAX_INT, Math.max(0, rawBaslangic));
          const cleanBitis = Math.min(MAX_INT, Math.max(0, rawBitis));
          const cleanUzunluk = Math.min(50, Math.max(1, rawUzunluk));

          await NumeratorService.saveNumerator({
            tur: row.tur,
            yaziciId: row.yaziciId ?? null,
            yaziciOrtakAlan: row.yaziciId === null || row.yaziciId === undefined,
            onek: cleanOnek,
            baslangic: cleanBaslangic,
            bitis: cleanBitis,
            uzunluk: cleanUzunluk,
            onuneSifirKoy: row.onuneSifirKoy,
          });
          savedCount++;
        } else {
          // If inactive, ensure it is deleted cleanly
          await NumeratorService.deleteNumerator(`${row.tur}_null`).catch(() => {});
          deletedCount++;
        }
      }

      setAlertSuccess(`✅ Numaratör tanımları başarıyla kaydedildi.`);
      await loadData();
      setTimeout(() => setAlertSuccess(null), 4000);
    } catch (err: any) {
      setAlertError(`❌ Kaydetme hatası: ${err?.message || "Numaratörler kaydedilemedi."}`);
    } finally {
      setIsSaving(false);
    }
  };

  const formatNumberDisplay = (val: number | string | undefined | null): string => {
    if (val === "" || val === null || val === undefined) return "";
    const cleanNum = parseInt(String(val).replace(/[^0-9]/g, ""), 10);
    if (isNaN(cleanNum)) return "";
    return cleanNum.toLocaleString("en-US");
  };

  return (
    <div className="p-1 p-md-2" style={{ fontFamily: "Tahoma, 'Segoe UI', Arial, sans-serif" }}>
      {/* 1. Üst ERP Toolbar (Kaydet butonu F1 dahil bu araç çubuğundadır) */}
      <ERPToolbar
        pageTitle="Numaratör Tanımları"
        pageIcon={<IconNumbers size={20} />}
        onSave={handleSaveAll}
        onRefresh={loadData}
        onPrint={() => window.print()}
        disabled={isLoading || isSaving}
      />

      {/* Bildirim Alanı */}
      {alertSuccess && (
        <Alert
          variant="success"
          className="d-flex align-items-center gap-2 py-1.5 px-3 mb-2 small shadow-2xs border-0"
          dismissible
          onClose={() => setAlertSuccess(null)}
        >
          <IconCheck size={16} />
          <span>{alertSuccess}</span>
        </Alert>
      )}

      {alertError && (
        <Alert
          variant="danger"
          className="d-flex align-items-center gap-2 py-1.5 px-3 mb-2 small shadow-2xs border-0"
          dismissible
          onClose={() => setAlertError(null)}
        >
          <IconAlertCircle size={16} />
          <span>{alertError}</span>
        </Alert>
      )}

      {/* 2. Sayfaya Oturan Birebir Numaratörler Tablosu */}
      <div
        className="w-100 bg-white shadow-2xs overflow-hidden"
        style={{
          border: "1px solid #8ab8ee",
          borderRadius: "4px",
        }}
      >
        {/* Tablo Alanı */}
        <div
          style={{
            maxHeight: "calc(100vh - 110px)",
            minHeight: "480px",
            overflowY: "auto",
            backgroundColor: "#ffffff",
          }}
        >
          {isLoading ? (
            <div className="d-flex align-items-center justify-content-center p-5 text-secondary">
              <Spinner animation="border" size="sm" className="me-2" />
              <span style={{ fontSize: "13px" }}>Numaratörler yükleniyor...</span>
            </div>
          ) : (
            <table
              className="w-100"
              style={{
                borderCollapse: "collapse",
                tableLayout: "fixed",
                fontSize: "13px",
                color: "#000000",
              }}
            >
              <thead>
                <tr
                  style={{
                    backgroundColor: "#b8d7fe",
                    height: "28px",
                    color: "#0f3e74",
                    fontWeight: 600,
                    textAlign: "center",
                    position: "sticky",
                    top: 0,
                    zIndex: 2,
                    boxShadow: "0 1px 0 #8ab8ee",
                  }}
                >
                  <th
                    style={{
                      width: "auto",
                      minWidth: "200px",
                      padding: "3px 10px",
                      borderRight: "1px solid #8ab8ee",
                      borderBottom: "1px solid #8ab8ee",
                      textAlign: "center",
                      fontWeight: 600,
                    }}
                  >
                    Numaratör adı
                  </th>
                  <th
                    style={{
                      width: "36px",
                      padding: 0,
                      borderRight: "1px solid #8ab8ee",
                      borderBottom: "1px solid #8ab8ee",
                    }}
                  />
                  <th
                    style={{
                      width: "160px",
                      padding: "3px 6px",
                      borderRight: "1px solid #8ab8ee",
                      borderBottom: "1px solid #8ab8ee",
                      textAlign: "center",
                      fontWeight: 600,
                    }}
                  >
                    Yazıcı
                  </th>
                  <th
                    style={{
                      width: "100px",
                      padding: "3px 6px",
                      borderRight: "1px solid #8ab8ee",
                      borderBottom: "1px solid #8ab8ee",
                      textAlign: "center",
                      fontWeight: 600,
                    }}
                  >
                    Önek
                  </th>
                  <th
                    style={{
                      width: "130px",
                      padding: "3px 8px",
                      borderRight: "1px solid #8ab8ee",
                      borderBottom: "1px solid #8ab8ee",
                      textAlign: "center",
                      fontWeight: 600,
                    }}
                  >
                    Başlangıç
                  </th>
                  <th
                    style={{
                      width: "130px",
                      padding: "3px 8px",
                      borderRight: "1px solid #8ab8ee",
                      borderBottom: "1px solid #8ab8ee",
                      textAlign: "center",
                      fontWeight: 600,
                    }}
                  >
                    Bitiş
                  </th>
                  <th
                    style={{
                      width: "80px",
                      padding: "3px 6px",
                      borderRight: "1px solid #8ab8ee",
                      borderBottom: "1px solid #8ab8ee",
                      textAlign: "center",
                      fontWeight: 600,
                    }}
                  >
                    Uzunluk
                  </th>
                  <th
                    style={{
                      width: "100px",
                      padding: "3px 6px",
                      borderBottom: "1px solid #8ab8ee",
                      textAlign: "center",
                      fontWeight: 600,
                    }}
                  >
                    Önünde sıfır
                  </th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row) => {
                  const isRowActive = row.isActive;
                  return (
                    <tr
                      key={row.tur}
                      style={{
                        height: "25px",
                        backgroundColor: "#ffffff",
                        borderBottom: "1px solid #e0e0e0",
                      }}
                    >
                      {/* 1. Numaratör Adı */}
                      <td
                        style={{
                          padding: "2px 8px",
                          borderRight: "1px solid #e0e0e0",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          color: "#1e293b",
                        }}
                      >
                        {row.ad}
                      </td>

                      {/* 2. Aktif / Kullanımda Onay Kutusu */}
                      <td
                        style={{
                          padding: 0,
                          textAlign: "center",
                          verticalAlign: "middle",
                          borderRight: "1px solid #e0e0e0",
                          backgroundColor: "#ffffff",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isRowActive}
                          onChange={() => handleToggleActive(row.tur)}
                          style={{
                            cursor: "pointer",
                            width: "14px",
                            height: "14px",
                            margin: "0 auto",
                            display: "block",
                            accentColor: "#0f172a",
                          }}
                          title={isRowActive ? "Numaratörü Devre Dışı Bırak" : "Numaratörü Aktifleştir"}
                        />
                      </td>

                      {/* 3. Yazıcı Seçimi (Dürbünlü) */}
                      <td
                        style={{
                          padding: "0 4px",
                          borderRight: "1px solid #e0e0e0",
                          backgroundColor: "#ffffff",
                        }}
                      >
                        <div className="d-flex align-items-center justify-content-between" style={{ height: "23px" }}>
                          <span
                            style={{
                              fontSize: "12px",
                              color: row.yaziciId ? "#0f172a" : "#64748b",
                              fontWeight: row.yaziciId ? 600 : 400,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              flex: 1,
                              paddingLeft: "4px",
                            }}
                            title={row.yaziciAdi ? `Yazıcı: ${row.yaziciAdi}` : ""}
                          >
                            {row.yaziciAdi || ""}
                          </span>
                          <div className="d-flex align-items-center gap-1">
                            {row.yaziciId && isRowActive && (
                              <button
                                type="button"
                                className="btn btn-sm p-0 text-danger"
                                style={{ border: "none", background: "transparent", lineHeight: 1 }}
                                title="Yazıcı seçimini kaldır"
                                onClick={() => handleClearYazici(row.tur)}
                              >
                                <IconX size={13} />
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-secondary p-0 d-flex align-items-center justify-content-center"
                              style={{
                                width: "20px",
                                height: "20px",
                                border: "1px solid #cbd5e1",
                                backgroundColor: isRowActive ? "#f8fafc" : "#f1f5f9",
                                cursor: isRowActive ? "pointer" : "default",
                                borderRadius: "3px",
                              }}
                              disabled={!isRowActive}
                              title="Yazıcı Seç (Dürbün)"
                              onClick={() => {
                                setSelectedTurForYazici(row.tur);
                                setShowYaziciModal(true);
                              }}
                            >
                              <IconBinoculars size={13} color={isRowActive ? "#2563eb" : "#94a3b8"} />
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* 4. Önek */}
                      <td
                        style={{
                          padding: 0,
                          borderRight: "1px solid #e0e0e0",
                        }}
                      >
                        <input
                          type="text"
                          value={row.onek}
                          disabled={!isRowActive}
                          onChange={(e) => handleFieldChange(row.tur, "onek", e.target.value)}
                          onFocus={() => setActiveCell({ tur: row.tur, col: "onek" })}
                          onBlur={() => setActiveCell(null)}
                          style={{
                            width: "100%",
                            height: "23px",
                            border:
                              activeCell?.tur === row.tur && activeCell?.col === "onek"
                                ? "1px dotted #000000"
                                : "none",
                            outline: "none",
                            backgroundColor: "transparent",
                            padding: "0 6px",
                            fontSize: "13px",
                            color: "#000000",
                          }}
                        />
                      </td>

                      {/* 5. Başlangıç No */}
                      <td
                        style={{
                          padding: 0,
                          borderRight: "1px solid #e0e0e0",
                        }}
                      >
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={10}
                          value={
                            activeCell?.tur === row.tur && activeCell?.col === "baslangic"
                              ? row.baslangic
                              : formatNumberDisplay(row.baslangic)
                          }
                          disabled={!isRowActive}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^0-9]/g, "").slice(0, 10);
                            handleFieldChange(row.tur, "baslangic", raw);
                          }}
                          onFocus={() => setActiveCell({ tur: row.tur, col: "baslangic" })}
                          onBlur={() => {
                            setActiveCell(null);
                            const parsed = parseInt(String(row.baslangic).replace(/[^0-9]/g, ""), 10);
                            const safe = isNaN(parsed) ? "" : Math.min(2147483647, Math.max(0, parsed));
                            handleFieldChange(row.tur, "baslangic", safe);
                          }}
                          style={{
                            width: "100%",
                            height: "23px",
                            border:
                              activeCell?.tur === row.tur && activeCell?.col === "baslangic"
                                ? "1px dotted #000000"
                                : "none",
                            outline: "none",
                            backgroundColor: "transparent",
                            padding: "0 8px",
                            fontSize: "13px",
                            textAlign: "right",
                            color: "#000000",
                          }}
                        />
                      </td>

                      {/* 6. Bitiş No */}
                      <td
                        style={{
                          padding: 0,
                          borderRight: "1px solid #e0e0e0",
                        }}
                      >
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={10}
                          value={
                            activeCell?.tur === row.tur && activeCell?.col === "bitis"
                              ? row.bitis
                              : formatNumberDisplay(row.bitis)
                          }
                          disabled={!isRowActive}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^0-9]/g, "").slice(0, 10);
                            handleFieldChange(row.tur, "bitis", raw);
                          }}
                          onFocus={() => setActiveCell({ tur: row.tur, col: "bitis" })}
                          onBlur={() => {
                            setActiveCell(null);
                            const parsed = parseInt(String(row.bitis).replace(/[^0-9]/g, ""), 10);
                            const safe = isNaN(parsed) || parsed === 0 ? "" : Math.min(2147483647, Math.max(0, parsed));
                            handleFieldChange(row.tur, "bitis", safe);
                          }}
                          style={{
                            width: "100%",
                            height: "23px",
                            border:
                              activeCell?.tur === row.tur && activeCell?.col === "bitis"
                                ? "1px dotted #000000"
                                : "none",
                            outline: "none",
                            backgroundColor: "transparent",
                            padding: "0 8px",
                            fontSize: "13px",
                            textAlign: "right",
                            color: "#000000",
                          }}
                        />
                      </td>

                      {/* 7. Hane Uzunluğu */}
                      <td
                        style={{
                          padding: 0,
                          borderRight: "1px solid #e0e0e0",
                        }}
                      >
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={2}
                          value={row.uzunluk}
                          disabled={!isRowActive}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^0-9]/g, "").slice(0, 2);
                            handleFieldChange(row.tur, "uzunluk", raw);
                          }}
                          onFocus={() => setActiveCell({ tur: row.tur, col: "uzunluk" })}
                          onBlur={() => {
                            setActiveCell(null);
                            const parsed = parseInt(String(row.uzunluk).replace(/[^0-9]/g, ""), 10);
                            const safe = isNaN(parsed) || parsed === 0 ? "" : Math.min(50, Math.max(1, parsed));
                            handleFieldChange(row.tur, "uzunluk", safe);
                          }}
                          style={{
                            width: "100%",
                            height: "23px",
                            border:
                              activeCell?.tur === row.tur && activeCell?.col === "uzunluk"
                                ? "1px dotted #000000"
                                : "none",
                            outline: "none",
                            backgroundColor: "transparent",
                            padding: "0 8px",
                            fontSize: "13px",
                            textAlign: "right",
                            color: "#000000",
                          }}
                        />
                      </td>

                      {/* 8. Önünde Sıfır */}
                      <td
                        style={{
                          padding: 0,
                          textAlign: "center",
                          verticalAlign: "middle",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={row.onuneSifirKoy}
                          disabled={!isRowActive}
                          onChange={(e) => handleFieldChange(row.tur, "onuneSifirKoy", e.target.checked)}
                          style={{
                            cursor: isRowActive ? "pointer" : "default",
                            width: "14px",
                            height: "14px",
                            margin: "0 auto",
                            display: "block",
                            accentColor: "#0f172a",
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Alt Bilgi Çubuğu */}
        <div
          className="d-flex justify-content-between align-items-center px-3 py-1 bg-light border-top"
          style={{ fontSize: "12px", color: "#475569" }}
        >
          <div>
            Toplam: <strong>{rows.length}</strong> tanım | Aktif Numaratör:{" "}
            <strong>{rows.filter((r) => r.isActive).length}</strong>
          </div>
          <div>
            <span className="text-muted">
              Yazıcı seçmek için <IconBinoculars size={13} className="text-primary mx-1" /> ikonunu kullanabilirsiniz.
            </span>
          </div>
        </div>
      </div>

      {/* Yazıcı Seçim Modal'ı (Dürbün) */}
      <LookupModal<YaziciItem>
        show={showYaziciModal}
        onHide={() => {
          setShowYaziciModal(false);
          setSelectedTurForYazici(null);
        }}
        title="Yazıcı Seçimi"
        searchPlaceholder="Yazıcı adı, cihaz adı veya bağlantı noktası ile arayın..."
        items={yazicilar}
        columns={yaziciColumns}
        filterFn={yaziciFilterFn}
        onSelect={handleSelectYazici}
      />
    </div>
  );
};

export default NumeratorDefinitionsPage;
