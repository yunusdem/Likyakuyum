import React, { useState, useEffect, useMemo } from "react";
import { Alert, Spinner } from "react-bootstrap";
import { IconCheck, IconAlertCircle, IconNumbers } from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import { NumeratorService, NumeratorItem } from "../../services/numeratorService";

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
  const [activeCell, setActiveCell] = useState<{ tur: number; col: string } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [alertSuccess, setAlertSuccess] = useState<string | null>(null);
  const [alertError, setAlertError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setAlertError(null);

      const dbList = await NumeratorService.getNumerators().catch(() => []);
      const dbMap = new Map<number, NumeratorItem>();
      (dbList || []).forEach((item) => {
        if (item.yaziciId === null || item.yaziciId === undefined) {
          dbMap.set(Number(item.tur), item);
        }
      });

      const initialRows: NumeratorRowState[] = STANDARD_NUMERATORS.map((std) => {
        const found = dbMap.get(std.tur);
        if (found) {
          return {
            tur: std.tur,
            ad: std.ad,
            isActive: true,
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
        if (
          (item.yaziciId === null || item.yaziciId === undefined) &&
          !STANDARD_NUMERATORS.some((s) => s.tur === Number(item.tur))
        ) {
          initialRows.push({
            tur: Number(item.tur),
            ad: `Numaratör #${item.tur}`,
            isActive: true,
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
    setRows((prev) =>
      prev.map((r) => {
        if (r.tur !== tur) return r;
        const willBeActive = !r.isActive;
        const std = STANDARD_NUMERATORS.find((s) => s.tur === tur);
        const defUzunluk = std ? std.defaultUzunluk : 10;

        return {
          ...r,
          isActive: willBeActive,
          onek: willBeActive ? r.onek : "",
          baslangic: willBeActive ? (r.baslangic !== "" ? r.baslangic : 1) : "",
          bitis: willBeActive ? r.bitis : "",
          uzunluk: willBeActive ? (r.uzunluk !== "" ? r.uzunluk : defUzunluk) : "",
          onuneSifirKoy: willBeActive ? true : false,
          isDirty: true,
        };
      })
    );
  };

  const handleFieldChange = (
    tur: number,
    field: "onek" | "baslangic" | "bitis" | "uzunluk" | "onuneSifirKoy",
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

  const handleSaveAll = async () => {
    try {
      setIsSaving(true);
      setAlertError(null);
      setAlertSuccess(null);

      let savedCount = 0;
      let deletedCount = 0;

      for (const row of rows) {
        if (row.isActive) {
          const cleanOnek = (String(row.onek || "")).trim().slice(0, 50);
          const cleanBaslangic = parseInt(String(row.baslangic).replace(/[^0-9]/g, ""), 10) || 0;
          const cleanBitis = parseInt(String(row.bitis).replace(/[^0-9]/g, ""), 10) || 0;
          const cleanUzunluk = Math.max(1, parseInt(String(row.uzunluk).replace(/[^0-9]/g, ""), 10) || 10);

          await NumeratorService.saveNumerator({
            tur: row.tur,
            yaziciId: null,
            yaziciOrtakAlan: true,
            onek: cleanOnek,
            baslangic: cleanBaslangic,
            bitis: cleanBitis,
            uzunluk: cleanUzunluk,
            onuneSifirKoy: row.onuneSifirKoy,
          });
          savedCount++;
        } else if (!row.isActive && row.existingId) {
          await NumeratorService.deleteNumerator(row.existingId).catch(() => {});
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
                      minWidth: "220px",
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
                      width: "110px",
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
                      width: "150px",
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
                      width: "150px",
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
                      width: "90px",
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
                      width: "120px",
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

                      {/* 3. Önek */}
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

                      {/* 4. Başlangıç No */}
                      <td
                        style={{
                          padding: 0,
                          borderRight: "1px solid #e0e0e0",
                        }}
                      >
                        <input
                          type="text"
                          inputMode="numeric"
                          value={
                            activeCell?.tur === row.tur && activeCell?.col === "baslangic"
                              ? row.baslangic
                              : formatNumberDisplay(row.baslangic)
                          }
                          disabled={!isRowActive}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^0-9]/g, "");
                            handleFieldChange(row.tur, "baslangic", raw);
                          }}
                          onFocus={() => setActiveCell({ tur: row.tur, col: "baslangic" })}
                          onBlur={() => {
                            setActiveCell(null);
                            const parsed = parseInt(String(row.baslangic).replace(/[^0-9]/g, ""), 10);
                            handleFieldChange(row.tur, "baslangic", isNaN(parsed) ? "" : parsed);
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

                      {/* 5. Bitiş No */}
                      <td
                        style={{
                          padding: 0,
                          borderRight: "1px solid #e0e0e0",
                        }}
                      >
                        <input
                          type="text"
                          inputMode="numeric"
                          value={
                            activeCell?.tur === row.tur && activeCell?.col === "bitis"
                              ? row.bitis
                              : formatNumberDisplay(row.bitis)
                          }
                          disabled={!isRowActive}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^0-9]/g, "");
                            handleFieldChange(row.tur, "bitis", raw);
                          }}
                          onFocus={() => setActiveCell({ tur: row.tur, col: "bitis" })}
                          onBlur={() => {
                            setActiveCell(null);
                            const parsed = parseInt(String(row.bitis).replace(/[^0-9]/g, ""), 10);
                            handleFieldChange(row.tur, "bitis", isNaN(parsed) || parsed === 0 ? "" : parsed);
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

                      {/* 6. Hane Uzunluğu */}
                      <td
                        style={{
                          padding: 0,
                          borderRight: "1px solid #e0e0e0",
                        }}
                      >
                        <input
                          type="text"
                          inputMode="numeric"
                          value={row.uzunluk}
                          disabled={!isRowActive}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^0-9]/g, "");
                            handleFieldChange(row.tur, "uzunluk", raw);
                          }}
                          onFocus={() => setActiveCell({ tur: row.tur, col: "uzunluk" })}
                          onBlur={() => {
                            setActiveCell(null);
                            const parsed = parseInt(String(row.uzunluk).replace(/[^0-9]/g, ""), 10);
                            handleFieldChange(row.tur, "uzunluk", isNaN(parsed) ? "" : parsed);
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

                      {/* 7. Önünde Sıfır */}
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
      </div>
    </div>
  );
};

export default NumeratorDefinitionsPage;
