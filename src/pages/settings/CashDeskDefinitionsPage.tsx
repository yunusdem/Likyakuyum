import React, { useState, useEffect } from "react";
import { Alert, Spinner, Modal, Button } from "react-bootstrap";
import {
  IconBuildingStore,
  IconCheck,
  IconAlertCircle,
  IconTrash,
  IconPlus,
} from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import { printReportTable } from "../../utils/printReport";
import {
  CashDeskService,
  VezneItem,
  VezneFormData,
  LookupPrinter,
  LookupCurrency,
} from "../../services/cashDeskService";

interface CashDeskRowState {
  clientId: string;
  id?: number;
  kod: string;
  ad: string;
  fisTipi: number;
  paraId: number | null;
  alisFisiYaziciId: number | null;
  satisFisiYaziciId: number | null;
  altinAlisFisiYaziciId: number | null;
  altinSatisFisiYaziciId: number | null;
  alisSatisIzniVar: boolean;
  musteriTaniFormuYaziciId: number | null;
  musteriTaniFormuYaziciVar: boolean;
  isNew?: boolean;
  isDirty?: boolean;
}

export const CashDeskDefinitionsPage: React.FC = () => {
  const [rows, setRows] = useState<CashDeskRowState[]>([]);
  const [printers, setPrinters] = useState<LookupPrinter[]>([]);
  const [currencies, setCurrencies] = useState<LookupCurrency[]>([]);
  const [activeCell, setActiveCell] = useState<{ clientId: string; col: string } | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [alertSuccess, setAlertSuccess] = useState<string | null>(null);
  const [alertError, setAlertError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<CashDeskRowState | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setAlertError(null);

      const [vezneList, printerList, currencyList] = await Promise.all([
        CashDeskService.getVezneler(),
        CashDeskService.getPrinters(),
        CashDeskService.getCurrencies(),
      ]);

      setPrinters(printerList || []);
      setCurrencies(currencyList || []);

      const mapped: CashDeskRowState[] = (vezneList || []).map((v) => ({
        clientId: `db_${v.id}`,
        id: v.id,
        kod: v.kod || "",
        ad: v.ad || "",
        fisTipi: v.fisTipi ?? 2,
        paraId: v.paraId ?? null,
        alisFisiYaziciId: v.alisFisiYaziciId ?? null,
        satisFisiYaziciId: v.satisFisiYaziciId ?? null,
        altinAlisFisiYaziciId: v.altinAlisFisiYaziciId ?? null,
        altinSatisFisiYaziciId: v.altinSatisFisiYaziciId ?? null,
        alisSatisIzniVar: v.alisSatisIzniVar !== false,
        musteriTaniFormuYaziciId: v.musteriTaniFormuYaziciId ?? null,
        musteriTaniFormuYaziciVar: v.musteriTaniFormuYaziciVar === true,
        isNew: false,
        isDirty: false,
      }));

      setRows(mapped);
    } catch (err: any) {
      setAlertError(err?.message || "Vezne tanımları yüklenirken bir hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddNewRow = () => {
    const defaultCurrencyId = currencies.length > 0 ? currencies[0].id : null;
    const newRow: CashDeskRowState = {
      clientId: `new_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      kod: "",
      ad: "",
      fisTipi: 2,
      paraId: defaultCurrencyId,
      alisFisiYaziciId: null,
      satisFisiYaziciId: null,
      altinAlisFisiYaziciId: null,
      altinSatisFisiYaziciId: null,
      alisSatisIzniVar: true,
      musteriTaniFormuYaziciId: null,
      musteriTaniFormuYaziciVar: false,
      isNew: true,
      isDirty: true,
    };
    setRows((prev) => [...prev, newRow]);
  };

  const handleFieldChange = (clientId: string, field: keyof CashDeskRowState, val: any) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.clientId !== clientId) return r;
        return {
          ...r,
          [field]: val,
          isDirty: true,
        };
      })
    );
  };

  const handleDeleteClick = (row: CashDeskRowState) => {
    if (row.isNew) {
      setRows((prev) => prev.filter((r) => r.clientId !== row.clientId));
      return;
    }
    setDeleteTarget(row);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || !deleteTarget.id) return;
    try {
      setIsSaving(true);
      await CashDeskService.deleteVezne(deleteTarget.id);
      setRows((prev) => prev.filter((r) => r.clientId !== deleteTarget.clientId));
      setShowDeleteModal(false);
      setAlertSuccess(`"${deleteTarget.ad || deleteTarget.kod}" veznesi başarıyla silindi.`);
      setDeleteTarget(null);
      setTimeout(() => setAlertSuccess(null), 3500);
    } catch (err: any) {
      setAlertError(`Silme hatası: ${err?.message || "Vezne silinemedi."}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAll = async () => {
    setAlertError(null);
    setAlertSuccess(null);

    // Validation
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowNum = i + 1;
      const cleanKod = (r.kod || "").trim();
      const cleanAd = (r.ad || "").trim();

      if (!cleanKod) {
        setAlertError(`⚠️ Satır #${rowNum}: Vezne kodu boş bırakılamaz.`);
        return;
      }
      if (cleanKod.length > 5) {
        setAlertError(`⚠️ Satır #${rowNum}: Vezne kodu en fazla 5 karakter olabilir (${cleanKod}).`);
        return;
      }
      if (!cleanAd) {
        setAlertError(`⚠️ Satır #${rowNum}: Vezne adı boş bırakılamaz.`);
        return;
      }
    }

    const dirtyRows = rows.filter((r) => r.isDirty);
    if (dirtyRows.length === 0) {
      setAlertSuccess("Herhangi bir değişiklik bulunmamaktadır.");
      setTimeout(() => setAlertSuccess(null), 2500);
      return;
    }

    try {
      setIsSaving(true);
      let createdCount = 0;
      let updatedCount = 0;

      for (const row of dirtyRows) {
        const payload: VezneFormData = {
          kod: (row.kod || "").trim().slice(0, 5),
          ad: (row.ad || "").trim(),
          fisTipi: parseInt(String(row.fisTipi), 10) || 2,
          paraId: row.paraId ? parseInt(String(row.paraId), 10) : null,
          alisFisiYaziciId: row.alisFisiYaziciId ? parseInt(String(row.alisFisiYaziciId), 10) : null,
          satisFisiYaziciId: row.satisFisiYaziciId ? parseInt(String(row.satisFisiYaziciId), 10) : null,
          altinAlisFisiYaziciId: row.altinAlisFisiYaziciId ? parseInt(String(row.altinAlisFisiYaziciId), 10) : null,
          altinSatisFisiYaziciId: row.altinSatisFisiYaziciId ? parseInt(String(row.altinSatisFisiYaziciId), 10) : null,
          alisSatisIzniVar: row.alisSatisIzniVar !== false,
          musteriTaniFormuYaziciId:
            row.musteriTaniFormuYaziciVar && row.musteriTaniFormuYaziciId
              ? parseInt(String(row.musteriTaniFormuYaziciId), 10)
              : null,
          musteriTaniFormuYaziciVar: !!row.musteriTaniFormuYaziciVar,
        };

        if (row.isNew || !row.id) {
          await CashDeskService.createVezne(payload);
          createdCount++;
        } else {
          await CashDeskService.updateVezne(row.id, payload);
          updatedCount++;
        }
      }

      setAlertSuccess(`✅ Vezne tanımları başarıyla kaydedildi (${createdCount} yeni, ${updatedCount} güncellendi).`);
      await loadData();
      setTimeout(() => setAlertSuccess(null), 4000);
    } catch (err: any) {
      setAlertError(`❌ Kaydetme hatası: ${err?.message || "Vezneler kaydedilemedi."}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    printReportTable<CashDeskRowState>({
      title: "Vezne Tanımları Listesi Raporu",
      subtitle: `Aktif Vezneler Dökümü (${rows.length} Kayıt)`,
      data: rows,
      columns: [
        { header: "Vezne Kodu", key: "kod", width: "16%" },
        { header: "Vezne Adı", key: "ad", width: "32%" },
        {
          header: "Para Birimi",
          render: (item) => currencies.find((c) => c.id === item.paraId)?.code || "-",
          width: "16%",
          align: "center",
        },
        {
          header: "Fiş Tipi",
          render: (item) =>
            item.fisTipi === 1 ? "1 - Genel Sarraf" : item.fisTipi === 2 ? "2 - Standart" : "3 - Özel / Perakende",
          width: "20%",
        },
        {
          header: "Alış/Satış İzni",
          render: (item) => (item.alisSatisIzniVar ? "İzinli" : "Kısıtlı"),
          width: "16%",
          align: "center",
        },
      ],
      summaryInfo: `Toplam Vezne Sayısı: ${rows.length}`,
    });
  };

  const dirtyCount = rows.filter((r) => r.isDirty).length;

  return (
    <div className="p-1 p-md-2" style={{ fontFamily: "Tahoma, 'Segoe UI', Arial, sans-serif" }}>
      {/* 1. Üst ERP Toolbar */}
      <ERPToolbar
        pageTitle="Vezne Tanımları"
        pageIcon={<IconBuildingStore size={20} />}
        onNew={handleAddNewRow}
        onSave={handleSaveAll}
        onRefresh={loadData}
        onPrint={handlePrint}
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

      {/* 2. Masaüstü ERP Grid Tablosu */}
      <div
        className="w-100 bg-white shadow-2xs overflow-hidden"
        style={{
          border: "1px solid #8ab8ee",
          borderRadius: "4px",
        }}
      >
        <div
          style={{
            maxHeight: "calc(100vh - 120px)",
            minHeight: "480px",
            overflowX: "auto",
            overflowY: "auto",
            backgroundColor: "#ffffff",
          }}
        >
          {isLoading ? (
            <div className="d-flex align-items-center justify-content-center p-5 text-secondary">
              <Spinner animation="border" size="sm" className="me-2" />
              <span style={{ fontSize: "13px" }}>Vezne tanımları yükleniyor...</span>
            </div>
          ) : (
            <table
              className="w-100"
              style={{
                borderCollapse: "collapse",
                tableLayout: "auto",
                fontSize: "13px",
                color: "#000000",
                minWidth: "1280px",
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
                      width: "36px",
                      padding: "3px 4px",
                      borderRight: "1px solid #8ab8ee",
                      borderBottom: "1px solid #8ab8ee",
                      textAlign: "center",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    #
                  </th>
                  <th
                    style={{
                      width: "85px",
                      padding: "3px 6px",
                      borderRight: "1px solid #8ab8ee",
                      borderBottom: "1px solid #8ab8ee",
                      textAlign: "center",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Vezne Kodu
                  </th>
                  <th
                    style={{
                      width: "200px",
                      minWidth: "160px",
                      padding: "3px 8px",
                      borderRight: "1px solid #8ab8ee",
                      borderBottom: "1px solid #8ab8ee",
                      textAlign: "center",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Vezne Adı / Tanımı
                  </th>
                  <th
                    style={{
                      width: "140px",
                      padding: "3px 6px",
                      borderRight: "1px solid #8ab8ee",
                      borderBottom: "1px solid #8ab8ee",
                      textAlign: "center",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Fiş Tipi
                  </th>
                  <th
                    style={{
                      width: "110px",
                      padding: "3px 6px",
                      borderRight: "1px solid #8ab8ee",
                      borderBottom: "1px solid #8ab8ee",
                      textAlign: "center",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Para Birimi
                  </th>
                  <th
                    style={{
                      width: "145px",
                      padding: "3px 6px",
                      borderRight: "1px solid #8ab8ee",
                      borderBottom: "1px solid #8ab8ee",
                      textAlign: "center",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Alış Fişi Yazıcısı
                  </th>
                  <th
                    style={{
                      width: "145px",
                      padding: "3px 6px",
                      borderRight: "1px solid #8ab8ee",
                      borderBottom: "1px solid #8ab8ee",
                      textAlign: "center",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Satış Fişi Yazıcısı
                  </th>
                  <th
                    style={{
                      width: "145px",
                      padding: "3px 6px",
                      borderRight: "1px solid #8ab8ee",
                      borderBottom: "1px solid #8ab8ee",
                      textAlign: "center",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Altın Alış Yazıcısı
                  </th>
                  <th
                    style={{
                      width: "145px",
                      padding: "3px 6px",
                      borderRight: "1px solid #8ab8ee",
                      borderBottom: "1px solid #8ab8ee",
                      textAlign: "center",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Altın Satış Yazıcısı
                  </th>
                  <th
                    style={{
                      width: "80px",
                      padding: "3px 4px",
                      borderRight: "1px solid #8ab8ee",
                      borderBottom: "1px solid #8ab8ee",
                      textAlign: "center",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                    title="Alış ve Satış İşlem İzni"
                  >
                    Alış/Satış
                  </th>
                  <th
                    style={{
                      width: "80px",
                      padding: "3px 4px",
                      borderRight: "1px solid #8ab8ee",
                      borderBottom: "1px solid #8ab8ee",
                      textAlign: "center",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                    title="Müşteri Tanı Formu Yazdırılsın mı?"
                  >
                    Müşteri Tanı
                  </th>
                  <th
                    style={{
                      width: "145px",
                      padding: "3px 6px",
                      borderRight: "1px solid #8ab8ee",
                      borderBottom: "1px solid #8ab8ee",
                      textAlign: "center",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Müşteri Tanı Yazıcısı
                  </th>
                  <th
                    style={{
                      width: "42px",
                      padding: "3px 4px",
                      borderBottom: "1px solid #8ab8ee",
                      textAlign: "center",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Sil
                  </th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row, idx) => {
                  const isDirty = row.isDirty;
                  return (
                    <tr
                      key={row.clientId}
                      style={{
                        height: "26px",
                        backgroundColor: isDirty ? "#fffde7" : idx % 2 === 1 ? "#fafcff" : "#ffffff",
                        borderBottom: "1px solid #e0e0e0",
                      }}
                    >
                      {/* Sıra No */}
                      <td
                        style={{
                          padding: "2px 4px",
                          textAlign: "center",
                          borderRight: "1px solid #e0e0e0",
                          color: "#64748b",
                          fontSize: "11px",
                          userSelect: "none",
                        }}
                      >
                        {idx + 1}
                      </td>

                      {/* Vezne Kodu */}
                      <td
                        style={{
                          padding: 0,
                          borderRight: "1px solid #e0e0e0",
                        }}
                      >
                        <input
                          type="text"
                          maxLength={5}
                          value={row.kod}
                          placeholder="KOD"
                          onChange={(e) =>
                            handleFieldChange(row.clientId, "kod", e.target.value.toUpperCase())
                          }
                          onFocus={() => setActiveCell({ clientId: row.clientId, col: "kod" })}
                          onBlur={() => setActiveCell(null)}
                          style={{
                            width: "100%",
                            height: "23px",
                            border:
                              activeCell?.clientId === row.clientId && activeCell?.col === "kod"
                                ? "1px dotted #000000"
                                : "none",
                            outline: "none",
                            backgroundColor: "transparent",
                            padding: "0 6px",
                            fontSize: "13px",
                            fontWeight: 600,
                            textAlign: "center",
                            color: "#0f3e74",
                          }}
                        />
                      </td>

                      {/* Vezne Adı */}
                      <td
                        style={{
                          padding: 0,
                          borderRight: "1px solid #e0e0e0",
                        }}
                      >
                        <input
                          type="text"
                          value={row.ad}
                          placeholder="Vezne Adı / Tanımı giriniz..."
                          onChange={(e) => handleFieldChange(row.clientId, "ad", e.target.value)}
                          onFocus={() => setActiveCell({ clientId: row.clientId, col: "ad" })}
                          onBlur={() => setActiveCell(null)}
                          style={{
                            width: "100%",
                            height: "23px",
                            border:
                              activeCell?.clientId === row.clientId && activeCell?.col === "ad"
                                ? "1px dotted #000000"
                                : "none",
                            outline: "none",
                            backgroundColor: "transparent",
                            padding: "0 8px",
                            fontSize: "13px",
                            color: "#000000",
                          }}
                        />
                      </td>

                      {/* Fiş Tipi */}
                      <td
                        style={{
                          padding: 0,
                          borderRight: "1px solid #e0e0e0",
                        }}
                      >
                        <select
                          value={row.fisTipi}
                          onChange={(e) =>
                            handleFieldChange(row.clientId, "fisTipi", parseInt(e.target.value, 10))
                          }
                          onFocus={() => setActiveCell({ clientId: row.clientId, col: "fisTipi" })}
                          onBlur={() => setActiveCell(null)}
                          style={{
                            width: "100%",
                            height: "23px",
                            border:
                              activeCell?.clientId === row.clientId && activeCell?.col === "fisTipi"
                                ? "1px dotted #000000"
                                : "none",
                            outline: "none",
                            backgroundColor: "transparent",
                            padding: "0 4px",
                            fontSize: "12px",
                            color: "#000000",
                            cursor: "pointer",
                          }}
                        >
                          <option value={1}>1 - Genel Sarraf Fişi</option>
                          <option value={2}>2 - Standart Vezne</option>
                          <option value={3}>3 - Özel / Perakende</option>
                        </select>
                      </td>

                      {/* Para Birimi */}
                      <td
                        style={{
                          padding: 0,
                          borderRight: "1px solid #e0e0e0",
                        }}
                      >
                        <select
                          value={row.paraId ?? ""}
                          onChange={(e) =>
                            handleFieldChange(
                              row.clientId,
                              "paraId",
                              e.target.value ? parseInt(e.target.value, 10) : null
                            )
                          }
                          onFocus={() => setActiveCell({ clientId: row.clientId, col: "paraId" })}
                          onBlur={() => setActiveCell(null)}
                          style={{
                            width: "100%",
                            height: "23px",
                            border:
                              activeCell?.clientId === row.clientId && activeCell?.col === "paraId"
                                ? "1px dotted #000000"
                                : "none",
                            outline: "none",
                            backgroundColor: "transparent",
                            padding: "0 4px",
                            fontSize: "12px",
                            color: "#000000",
                            cursor: "pointer",
                          }}
                        >
                          <option value="">(Seçiniz)</option>
                          {currencies.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.code} - {c.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Alış Fişi Yazıcısı */}
                      <td
                        style={{
                          padding: 0,
                          borderRight: "1px solid #e0e0e0",
                        }}
                      >
                        <select
                          value={row.alisFisiYaziciId ?? ""}
                          onChange={(e) =>
                            handleFieldChange(
                              row.clientId,
                              "alisFisiYaziciId",
                              e.target.value ? parseInt(e.target.value, 10) : null
                            )
                          }
                          onFocus={() => setActiveCell({ clientId: row.clientId, col: "alisFisiYaziciId" })}
                          onBlur={() => setActiveCell(null)}
                          style={{
                            width: "100%",
                            height: "23px",
                            border:
                              activeCell?.clientId === row.clientId &&
                              activeCell?.col === "alisFisiYaziciId"
                                ? "1px dotted #000000"
                                : "none",
                            outline: "none",
                            backgroundColor: "transparent",
                            padding: "0 4px",
                            fontSize: "12px",
                            color: "#000000",
                            cursor: "pointer",
                          }}
                        >
                          <option value="">(Tanımsız)</option>
                          {printers.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Satış Fişi Yazıcısı */}
                      <td
                        style={{
                          padding: 0,
                          borderRight: "1px solid #e0e0e0",
                        }}
                      >
                        <select
                          value={row.satisFisiYaziciId ?? ""}
                          onChange={(e) =>
                            handleFieldChange(
                              row.clientId,
                              "satisFisiYaziciId",
                              e.target.value ? parseInt(e.target.value, 10) : null
                            )
                          }
                          onFocus={() => setActiveCell({ clientId: row.clientId, col: "satisFisiYaziciId" })}
                          onBlur={() => setActiveCell(null)}
                          style={{
                            width: "100%",
                            height: "23px",
                            border:
                              activeCell?.clientId === row.clientId &&
                              activeCell?.col === "satisFisiYaziciId"
                                ? "1px dotted #000000"
                                : "none",
                            outline: "none",
                            backgroundColor: "transparent",
                            padding: "0 4px",
                            fontSize: "12px",
                            color: "#000000",
                            cursor: "pointer",
                          }}
                        >
                          <option value="">(Tanımsız)</option>
                          {printers.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Altın Alış Yazıcısı */}
                      <td
                        style={{
                          padding: 0,
                          borderRight: "1px solid #e0e0e0",
                        }}
                      >
                        <select
                          value={row.altinAlisFisiYaziciId ?? ""}
                          onChange={(e) =>
                            handleFieldChange(
                              row.clientId,
                              "altinAlisFisiYaziciId",
                              e.target.value ? parseInt(e.target.value, 10) : null
                            )
                          }
                          onFocus={() => setActiveCell({ clientId: row.clientId, col: "altinAlisFisiYaziciId" })}
                          onBlur={() => setActiveCell(null)}
                          style={{
                            width: "100%",
                            height: "23px",
                            border:
                              activeCell?.clientId === row.clientId &&
                              activeCell?.col === "altinAlisFisiYaziciId"
                                ? "1px dotted #000000"
                                : "none",
                            outline: "none",
                            backgroundColor: "transparent",
                            padding: "0 4px",
                            fontSize: "12px",
                            color: "#000000",
                            cursor: "pointer",
                          }}
                        >
                          <option value="">(Tanımsız)</option>
                          {printers.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Altın Satış Yazıcısı */}
                      <td
                        style={{
                          padding: 0,
                          borderRight: "1px solid #e0e0e0",
                        }}
                      >
                        <select
                          value={row.altinSatisFisiYaziciId ?? ""}
                          onChange={(e) =>
                            handleFieldChange(
                              row.clientId,
                              "altinSatisFisiYaziciId",
                              e.target.value ? parseInt(e.target.value, 10) : null
                            )
                          }
                          onFocus={() => setActiveCell({ clientId: row.clientId, col: "altinSatisFisiYaziciId" })}
                          onBlur={() => setActiveCell(null)}
                          style={{
                            width: "100%",
                            height: "23px",
                            border:
                              activeCell?.clientId === row.clientId &&
                              activeCell?.col === "altinSatisFisiYaziciId"
                                ? "1px dotted #000000"
                                : "none",
                            outline: "none",
                            backgroundColor: "transparent",
                            padding: "0 4px",
                            fontSize: "12px",
                            color: "#000000",
                            cursor: "pointer",
                          }}
                        >
                          <option value="">(Tanımsız)</option>
                          {printers.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Alış / Satış İzni Checkbox */}
                      <td
                        style={{
                          padding: 0,
                          textAlign: "center",
                          verticalAlign: "middle",
                          borderRight: "1px solid #e0e0e0",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={row.alisSatisIzniVar}
                          onChange={(e) =>
                            handleFieldChange(row.clientId, "alisSatisIzniVar", e.target.checked)
                          }
                          style={{
                            cursor: "pointer",
                            width: "14px",
                            height: "14px",
                            margin: "0 auto",
                            display: "block",
                            accentColor: "#0f172a",
                          }}
                          title="Alış ve Satış İşlem İzni"
                        />
                      </td>

                      {/* Müşteri Tanı Formu Checkbox */}
                      <td
                        style={{
                          padding: 0,
                          textAlign: "center",
                          verticalAlign: "middle",
                          borderRight: "1px solid #e0e0e0",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={row.musteriTaniFormuYaziciVar}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            handleFieldChange(row.clientId, "musteriTaniFormuYaziciVar", checked);
                            if (!checked) {
                              handleFieldChange(row.clientId, "musteriTaniFormuYaziciId", null);
                            }
                          }}
                          style={{
                            cursor: "pointer",
                            width: "14px",
                            height: "14px",
                            margin: "0 auto",
                            display: "block",
                            accentColor: "#0f172a",
                          }}
                          title="Müşteri Tanı Formu Yazdırılsın mı?"
                        />
                      </td>

                      {/* Müşteri Tanı Yazıcısı */}
                      <td
                        style={{
                          padding: 0,
                          borderRight: "1px solid #e0e0e0",
                        }}
                      >
                        <select
                          value={row.musteriTaniFormuYaziciId ?? ""}
                          disabled={!row.musteriTaniFormuYaziciVar}
                          onChange={(e) =>
                            handleFieldChange(
                              row.clientId,
                              "musteriTaniFormuYaziciId",
                              e.target.value ? parseInt(e.target.value, 10) : null
                            )
                          }
                          onFocus={() => setActiveCell({ clientId: row.clientId, col: "musteriTaniFormuYaziciId" })}
                          onBlur={() => setActiveCell(null)}
                          style={{
                            width: "100%",
                            height: "23px",
                            border:
                              activeCell?.clientId === row.clientId &&
                              activeCell?.col === "musteriTaniFormuYaziciId"
                                ? "1px dotted #000000"
                                : "none",
                            outline: "none",
                            backgroundColor: "transparent",
                            padding: "0 4px",
                            fontSize: "12px",
                            color: row.musteriTaniFormuYaziciVar ? "#000000" : "#94a3b8",
                            cursor: row.musteriTaniFormuYaziciVar ? "pointer" : "not-allowed",
                          }}
                        >
                          <option value="">(Tanımsız)</option>
                          {printers.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Sil Butonu */}
                      <td
                        style={{
                          padding: 0,
                          textAlign: "center",
                          verticalAlign: "middle",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => handleDeleteClick(row)}
                          title="Bu vezne tanımını sil"
                          style={{
                            border: "none",
                            background: "transparent",
                            color: "#dc2626",
                            cursor: "pointer",
                            padding: "2px 4px",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <IconTrash size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={13}
                      className="text-center py-4 text-muted"
                      style={{ fontSize: "13px" }}
                    >
                      Henüz tanımlanmış bir vezne kaydı bulunmuyor. Aşağıdaki butondan yeni bir vezne ekleyebilirsiniz.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Tablo Alt Bilgi & Hızlı Ekleme Çubuğu */}
        <div
          className="d-flex align-items-center justify-content-between px-3 py-1.5 bg-light"
          style={{
            borderTop: "1px solid #8ab8ee",
            fontSize: "12px",
          }}
        >
          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1 py-0.5 px-2"
              onClick={handleAddNewRow}
              style={{ fontSize: "12px", fontWeight: 600 }}
              disabled={isLoading || isSaving}
            >
              <IconPlus size={14} /> Yeni Vezne Ekle (+)
            </button>

            {dirtyCount > 0 && (
              <span className="badge bg-warning text-dark px-2 py-1">
                {dirtyCount} satırda kaydedilmemiş değişiklik var
              </span>
            )}
          </div>

          <div className="text-secondary fw-semibold">
            Toplam Vezne: <span className="text-dark">{rows.length}</span>
          </div>
        </div>
      </div>

      {/* Silme Onay Modalı */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered size="sm">
        <Modal.Header closeButton className="py-2">
          <Modal.Title className="fs-6 text-danger d-flex align-items-center gap-1.5">
            <IconTrash size={18} /> Vezne Silme Onayı
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="py-3">
          <p className="mb-2" style={{ fontSize: "13px" }}>
            <strong>[{deleteTarget?.kod}] {deleteTarget?.ad}</strong> veznesini kalıcı olarak silmek istediğinize emin misiniz?
          </p>
          <small className="text-danger">⚠️ Bu işlem geri alınamaz.</small>
        </Modal.Body>
        <Modal.Footer className="py-1.5">
          <Button variant="secondary" size="sm" onClick={() => setShowDeleteModal(false)}>
            Vazgeç
          </Button>
          <Button variant="danger" size="sm" onClick={handleConfirmDelete} disabled={isSaving}>
            {isSaving ? "Siliniyor..." : "Evet, Sil"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default CashDeskDefinitionsPage;
