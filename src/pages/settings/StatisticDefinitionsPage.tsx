import React, { useState, useEffect } from "react";
import { Alert, Spinner, Modal, Button } from "react-bootstrap";
import {
  IconChartBar,
  IconCheck,
  IconAlertCircle,
  IconTrash,
  IconPlus,
} from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import { printReportTable } from "../../utils/printReport";
import {
  StatisticService,
  StatisticItem,
  StatisticFormData,
} from "../../services/statisticService";

interface StatisticRowState {
  clientId: string;
  id?: number;
  kod: string;
  aciklama: string;
  fisTipi: number;
  komisyonOrani: number | string;
  bmvOrani: number | string;
  kmvOrani: number | string;
  komisyonYetkisi: boolean;
  fisDizaynTipi: number;
  belgeNoUretmeSekli: number;
  ciktiSatirSayisi: number | string;
  f1Tusu: number | string;
  odemeSekliVar: boolean;
  odemeSekli: number | null;
  muhHesapId: number | string | null;
  efektifDepoHesapId: number | string | null;
  efektifVaziyetHesapId: number | string | null;
  isNew?: boolean;
  isDirty?: boolean;
}

export const StatisticDefinitionsPage: React.FC = () => {
  const [rows, setRows] = useState<StatisticRowState[]>([]);
  const [activeCell, setActiveCell] = useState<{ clientId: string; col: string } | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [alertSuccess, setAlertSuccess] = useState<string | null>(null);
  const [alertError, setAlertError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<StatisticRowState | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setAlertError(null);

      const list = await StatisticService.getStatistics();
      const mapped: StatisticRowState[] = (list || []).map((s) => ({
        clientId: `db_${s.id}`,
        id: s.id,
        kod: s.kod || "",
        aciklama: s.aciklama || "",
        fisTipi: s.fisTipi ?? 1,
        komisyonOrani: s.komisyonOrani ?? 0,
        bmvOrani: s.bmvOrani ?? 0,
        kmvOrani: s.kmvOrani ?? 0,
        komisyonYetkisi: s.komisyonYetkisi !== false,
        fisDizaynTipi: s.fisDizaynTipi ?? 0,
        belgeNoUretmeSekli: s.belgeNoUretmeSekli ?? 0,
        ciktiSatirSayisi: s.ciktiSatirSayisi ?? 1,
        f1Tusu: s.f1Tusu ?? 0,
        odemeSekliVar: s.odemeSekliVar === true,
        odemeSekli: s.odemeSekli ?? null,
        muhHesapId: s.muhHesapId ?? "",
        efektifDepoHesapId: s.efektifDepoHesapId ?? "",
        efektifVaziyetHesapId: s.efektifVaziyetHesapId ?? "",
        isNew: false,
        isDirty: false,
      }));

      setRows(mapped);
    } catch (err: any) {
      setAlertError(err?.message || "İstatistik tanımları yüklenirken bir hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddNewRow = () => {
    const newRow: StatisticRowState = {
      clientId: `new_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      kod: "",
      aciklama: "",
      fisTipi: 1,
      komisyonOrani: 0,
      bmvOrani: 0,
      kmvOrani: 0,
      komisyonYetkisi: true,
      fisDizaynTipi: 0,
      belgeNoUretmeSekli: 0,
      ciktiSatirSayisi: 1,
      f1Tusu: 0,
      odemeSekliVar: false,
      odemeSekli: null,
      muhHesapId: "",
      efektifDepoHesapId: "",
      efektifVaziyetHesapId: "",
      isNew: true,
      isDirty: true,
    };
    setRows((prev) => [...prev, newRow]);
  };

  const handleFieldChange = (clientId: string, field: keyof StatisticRowState, val: any) => {
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

  const handleDeleteClick = (row: StatisticRowState) => {
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
      await StatisticService.deleteStatistic(deleteTarget.id);
      setRows((prev) => prev.filter((r) => r.clientId !== deleteTarget.clientId));
      setShowDeleteModal(false);
      setAlertSuccess(`"${deleteTarget.aciklama || deleteTarget.kod}" istatistik tanımı başarıyla silindi.`);
      setDeleteTarget(null);
      setTimeout(() => setAlertSuccess(null), 3500);
    } catch (err: any) {
      setAlertError(`Silme hatası: ${err?.message || "İstatistik tanımı silinemedi."}`);
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
      const cleanAciklama = (r.aciklama || "").trim();

      if (!cleanKod) {
        setAlertError(`⚠️ Satır #${rowNum}: İstatistik kodu boş bırakılamaz.`);
        return;
      }
      if (cleanKod.length > 20) {
        setAlertError(`⚠️ Satır #${rowNum}: İstatistik kodu en fazla 20 karakter olabilir (${cleanKod}).`);
        return;
      }
      if (!cleanAciklama) {
        setAlertError(`⚠️ Satır #${rowNum}: İstatistik açıklaması boş bırakılamaz.`);
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
        const payload: StatisticFormData = {
          kod: (row.kod || "").trim().slice(0, 20),
          aciklama: (row.aciklama || "").trim(),
          fisTipi: parseInt(String(row.fisTipi), 10) || 1,
          komisyonOrani: parseFloat(String(row.komisyonOrani)) || 0,
          bmvOrani: parseFloat(String(row.bmvOrani)) || 0,
          kmvOrani: parseFloat(String(row.kmvOrani)) || 0,
          komisyonYetkisi: row.komisyonYetkisi !== false,
          fisDizaynTipi: parseInt(String(row.fisDizaynTipi), 10) || 0,
          belgeNoUretmeSekli: parseInt(String(row.belgeNoUretmeSekli), 10) || 0,
          ciktiSatirSayisi: Math.max(1, parseInt(String(row.ciktiSatirSayisi), 10) || 1),
          f1Tusu: parseInt(String(row.f1Tusu), 10) || 0,
          odemeSekliVar: !!row.odemeSekliVar,
          odemeSekli:
            row.odemeSekliVar && row.odemeSekli !== null && row.odemeSekli !== undefined && String(row.odemeSekli) !== ""
              ? parseInt(String(row.odemeSekli), 10)
              : null,
          muhHesapId:
            row.muhHesapId !== null && row.muhHesapId !== undefined && String(row.muhHesapId).trim() !== ""
              ? parseInt(String(row.muhHesapId), 10)
              : null,
          efektifDepoHesapId:
            row.efektifDepoHesapId !== null &&
            row.efektifDepoHesapId !== undefined &&
            String(row.efektifDepoHesapId).trim() !== ""
              ? parseInt(String(row.efektifDepoHesapId), 10)
              : null,
          efektifVaziyetHesapId:
            row.efektifVaziyetHesapId !== null &&
            row.efektifVaziyetHesapId !== undefined &&
            String(row.efektifVaziyetHesapId).trim() !== ""
              ? parseInt(String(row.efektifVaziyetHesapId), 10)
              : null,
        };

        if (row.isNew || !row.id) {
          await StatisticService.createStatistic(payload);
          createdCount++;
        } else {
          await StatisticService.updateStatistic(row.id, payload);
          updatedCount++;
        }
      }

      setAlertSuccess(`✅ İstatistik tanımları başarıyla kaydedildi (${createdCount} yeni, ${updatedCount} güncellendi).`);
      await loadData();
      setTimeout(() => setAlertSuccess(null), 4000);
    } catch (err: any) {
      setAlertError(`❌ Kaydetme hatası: ${err?.message || "İstatistik tanımları kaydedilemedi."}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    printReportTable<StatisticRowState>({
      title: "İstatistik Tanımları Listesi Raporu",
      subtitle: `Aktif İstatistik ve İşlem Kodları Dökümü (${rows.length} Kayıt)`,
      data: rows,
      columns: [
        { header: "İstatistik Kodu", key: "kod", width: "16%" },
        { header: "Açıklama", key: "aciklama", width: "34%" },
        {
          header: "Fiş Tipi",
          render: (item) =>
            item.fisTipi === 1
              ? "1 - ALIŞ"
              : item.fisTipi === 2
              ? "2 - SATIŞ"
              : item.fisTipi === 3
              ? "3 - ALIŞ-SATIŞ"
              : `${item.fisTipi}`,
          width: "20%",
        },
        {
          header: "Komisyon",
          render: (item) => (item.komisyonOrani ? `%${item.komisyonOrani}` : "-"),
          width: "15%",
          align: "right",
        },
      ],
      summaryInfo: `Toplam İstatistik Tanımı Sayısı: ${rows.length}`,
    });
  };

  const dirtyCount = rows.filter((r) => r.isDirty).length;

  return (
    <div className="p-1 p-md-2" style={{ fontFamily: "Tahoma, 'Segoe UI', Arial, sans-serif" }}>
      {/* 1. Üst ERP Toolbar */}
      <ERPToolbar
        pageTitle="İstatistik Tanımları"
        pageIcon={<IconChartBar size={20} />}
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
              <span style={{ fontSize: "13px" }}>İstatistik tanımları yükleniyor...</span>
            </div>
          ) : (
            <table
              className="w-100"
              style={{
                borderCollapse: "collapse",
                tableLayout: "auto",
                fontSize: "13px",
                color: "#000000",
                minWidth: "1680px",
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
                      width: "95px",
                      padding: "3px 6px",
                      borderRight: "1px solid #8ab8ee",
                      borderBottom: "1px solid #8ab8ee",
                      textAlign: "center",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    İstatistik Kodu
                  </th>
                  <th
                    style={{
                      width: "220px",
                      minWidth: "160px",
                      padding: "3px 8px",
                      borderRight: "1px solid #8ab8ee",
                      borderBottom: "1px solid #8ab8ee",
                      textAlign: "center",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Açıklama
                  </th>
                  <th
                    style={{
                      width: "135px",
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
                      width: "125px",
                      padding: "3px 6px",
                      borderRight: "1px solid #8ab8ee",
                      borderBottom: "1px solid #8ab8ee",
                      textAlign: "center",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Fiş Dizayn
                  </th>
                  <th
                    style={{
                      width: "135px",
                      padding: "3px 6px",
                      borderRight: "1px solid #8ab8ee",
                      borderBottom: "1px solid #8ab8ee",
                      textAlign: "center",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Belge No Üretme
                  </th>
                  <th
                    style={{
                      width: "75px",
                      padding: "3px 6px",
                      borderRight: "1px solid #8ab8ee",
                      borderBottom: "1px solid #8ab8ee",
                      textAlign: "center",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Çıktı Satır
                  </th>
                  <th
                    style={{
                      width: "65px",
                      padding: "3px 6px",
                      borderRight: "1px solid #8ab8ee",
                      borderBottom: "1px solid #8ab8ee",
                      textAlign: "center",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    F1 Tuşu
                  </th>
                  <th
                    style={{
                      width: "80px",
                      padding: "3px 6px",
                      borderRight: "1px solid #8ab8ee",
                      borderBottom: "1px solid #8ab8ee",
                      textAlign: "center",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Komisyon %
                  </th>
                  <th
                    style={{
                      width: "75px",
                      padding: "3px 6px",
                      borderRight: "1px solid #8ab8ee",
                      borderBottom: "1px solid #8ab8ee",
                      textAlign: "center",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    BMV %
                  </th>
                  <th
                    style={{
                      width: "75px",
                      padding: "3px 6px",
                      borderRight: "1px solid #8ab8ee",
                      borderBottom: "1px solid #8ab8ee",
                      textAlign: "center",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    KMV %
                  </th>
                  <th
                    style={{
                      width: "75px",
                      padding: "3px 4px",
                      borderRight: "1px solid #8ab8ee",
                      borderBottom: "1px solid #8ab8ee",
                      textAlign: "center",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                    title="Komisyon Yetkisi Aktif"
                  >
                    Kom. Yetkisi
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
                    title="Ödeme Şekli Tanımlı"
                  >
                    Ödeme Şekli?
                  </th>
                  <th
                    style={{
                      width: "135px",
                      padding: "3px 6px",
                      borderRight: "1px solid #8ab8ee",
                      borderBottom: "1px solid #8ab8ee",
                      textAlign: "center",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Ödeme Şekli
                  </th>
                  <th
                    style={{
                      width: "90px",
                      padding: "3px 6px",
                      borderRight: "1px solid #8ab8ee",
                      borderBottom: "1px solid #8ab8ee",
                      textAlign: "center",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Muh. Hesap
                  </th>
                  <th
                    style={{
                      width: "90px",
                      padding: "3px 6px",
                      borderRight: "1px solid #8ab8ee",
                      borderBottom: "1px solid #8ab8ee",
                      textAlign: "center",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Depo Hesap
                  </th>
                  <th
                    style={{
                      width: "90px",
                      padding: "3px 6px",
                      borderRight: "1px solid #8ab8ee",
                      borderBottom: "1px solid #8ab8ee",
                      textAlign: "center",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Vaziyet Hesap
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

                      {/* İstatistik Kodu */}
                      <td
                        style={{
                          padding: 0,
                          borderRight: "1px solid #e0e0e0",
                        }}
                      >
                        <input
                          type="text"
                          maxLength={20}
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

                      {/* Açıklama */}
                      <td
                        style={{
                          padding: 0,
                          borderRight: "1px solid #e0e0e0",
                        }}
                      >
                        <input
                          type="text"
                          value={row.aciklama}
                          placeholder="İstatistik Açıklaması giriniz..."
                          onChange={(e) => handleFieldChange(row.clientId, "aciklama", e.target.value)}
                          onFocus={() => setActiveCell({ clientId: row.clientId, col: "aciklama" })}
                          onBlur={() => setActiveCell(null)}
                          style={{
                            width: "100%",
                            height: "23px",
                            border:
                              activeCell?.clientId === row.clientId && activeCell?.col === "aciklama"
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
                          <option value={1}>1 - ALIŞ</option>
                          <option value={2}>2 - SATIŞ</option>
                          <option value={3}>3 - ALIŞ-SATIŞ</option>
                        </select>
                      </td>

                      {/* Fiş Dizayn Tipi */}
                      <td
                        style={{
                          padding: 0,
                          borderRight: "1px solid #e0e0e0",
                        }}
                      >
                        <select
                          value={row.fisDizaynTipi}
                          onChange={(e) =>
                            handleFieldChange(row.clientId, "fisDizaynTipi", parseInt(e.target.value, 10))
                          }
                          onFocus={() => setActiveCell({ clientId: row.clientId, col: "fisDizaynTipi" })}
                          onBlur={() => setActiveCell(null)}
                          style={{
                            width: "100%",
                            height: "23px",
                            border:
                              activeCell?.clientId === row.clientId && activeCell?.col === "fisDizaynTipi"
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
                          <option value={0}>0</option>
                          <option value={1}>1</option>
                          <option value={2}>2</option>
                          <option value={3}>3</option>
                        </select>
                      </td>

                      {/* Belge No Üretme Şekli */}
                      <td
                        style={{
                          padding: 0,
                          borderRight: "1px solid #e0e0e0",
                        }}
                      >
                        <select
                          value={row.belgeNoUretmeSekli}
                          onChange={(e) =>
                            handleFieldChange(row.clientId, "belgeNoUretmeSekli", parseInt(e.target.value, 10))
                          }
                          onFocus={() => setActiveCell({ clientId: row.clientId, col: "belgeNoUretmeSekli" })}
                          onBlur={() => setActiveCell(null)}
                          style={{
                            width: "100%",
                            height: "23px",
                            border:
                              activeCell?.clientId === row.clientId &&
                              activeCell?.col === "belgeNoUretmeSekli"
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
                          <option value={0}>0 - Manuel</option>
                          <option value={1}>1 - Otomatik</option>
                        </select>
                      </td>

                      {/* Çıktı Satır Sayısı */}
                      <td
                        style={{
                          padding: 0,
                          borderRight: "1px solid #e0e0e0",
                        }}
                      >
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={row.ciktiSatirSayisi}
                          onChange={(e) =>
                            handleFieldChange(row.clientId, "ciktiSatirSayisi", e.target.value)
                          }
                          onFocus={() => setActiveCell({ clientId: row.clientId, col: "ciktiSatirSayisi" })}
                          onBlur={() => setActiveCell(null)}
                          style={{
                            width: "100%",
                            height: "23px",
                            border:
                              activeCell?.clientId === row.clientId && activeCell?.col === "ciktiSatirSayisi"
                                ? "1px dotted #000000"
                                : "none",
                            outline: "none",
                            backgroundColor: "transparent",
                            padding: "0 6px",
                            fontSize: "13px",
                            textAlign: "right",
                            color: "#000000",
                          }}
                        />
                      </td>

                      {/* F1 Kısayol Tuşu */}
                      <td
                        style={{
                          padding: 0,
                          borderRight: "1px solid #e0e0e0",
                        }}
                      >
                        <input
                          type="number"
                          value={row.f1Tusu}
                          onChange={(e) => handleFieldChange(row.clientId, "f1Tusu", e.target.value)}
                          onFocus={() => setActiveCell({ clientId: row.clientId, col: "f1Tusu" })}
                          onBlur={() => setActiveCell(null)}
                          style={{
                            width: "100%",
                            height: "23px",
                            border:
                              activeCell?.clientId === row.clientId && activeCell?.col === "f1Tusu"
                                ? "1px dotted #000000"
                                : "none",
                            outline: "none",
                            backgroundColor: "transparent",
                            padding: "0 6px",
                            fontSize: "13px",
                            textAlign: "right",
                            color: "#000000",
                          }}
                        />
                      </td>

                      {/* Komisyon % */}
                      <td
                        style={{
                          padding: 0,
                          borderRight: "1px solid #e0e0e0",
                        }}
                      >
                        <input
                          type="number"
                          step="any"
                          value={row.komisyonOrani}
                          onChange={(e) =>
                            handleFieldChange(row.clientId, "komisyonOrani", e.target.value)
                          }
                          onFocus={() => setActiveCell({ clientId: row.clientId, col: "komisyonOrani" })}
                          onBlur={() => setActiveCell(null)}
                          style={{
                            width: "100%",
                            height: "23px",
                            border:
                              activeCell?.clientId === row.clientId && activeCell?.col === "komisyonOrani"
                                ? "1px dotted #000000"
                                : "none",
                            outline: "none",
                            backgroundColor: "transparent",
                            padding: "0 6px",
                            fontSize: "13px",
                            textAlign: "right",
                            color: "#000000",
                          }}
                        />
                      </td>

                      {/* BMV % */}
                      <td
                        style={{
                          padding: 0,
                          borderRight: "1px solid #e0e0e0",
                        }}
                      >
                        <input
                          type="number"
                          step="any"
                          value={row.bmvOrani}
                          onChange={(e) =>
                            handleFieldChange(row.clientId, "bmvOrani", e.target.value)
                          }
                          onFocus={() => setActiveCell({ clientId: row.clientId, col: "bmvOrani" })}
                          onBlur={() => setActiveCell(null)}
                          style={{
                            width: "100%",
                            height: "23px",
                            border:
                              activeCell?.clientId === row.clientId && activeCell?.col === "bmvOrani"
                                ? "1px dotted #000000"
                                : "none",
                            outline: "none",
                            backgroundColor: "transparent",
                            padding: "0 6px",
                            fontSize: "13px",
                            textAlign: "right",
                            color: "#000000",
                          }}
                        />
                      </td>

                      {/* KMV % */}
                      <td
                        style={{
                          padding: 0,
                          borderRight: "1px solid #e0e0e0",
                        }}
                      >
                        <input
                          type="number"
                          step="any"
                          value={row.kmvOrani}
                          onChange={(e) =>
                            handleFieldChange(row.clientId, "kmvOrani", e.target.value)
                          }
                          onFocus={() => setActiveCell({ clientId: row.clientId, col: "kmvOrani" })}
                          onBlur={() => setActiveCell(null)}
                          style={{
                            width: "100%",
                            height: "23px",
                            border:
                              activeCell?.clientId === row.clientId && activeCell?.col === "kmvOrani"
                                ? "1px dotted #000000"
                                : "none",
                            outline: "none",
                            backgroundColor: "transparent",
                            padding: "0 6px",
                            fontSize: "13px",
                            textAlign: "right",
                            color: "#000000",
                          }}
                        />
                      </td>

                      {/* Komisyon Yetkisi Checkbox */}
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
                          checked={row.komisyonYetkisi}
                          onChange={(e) =>
                            handleFieldChange(row.clientId, "komisyonYetkisi", e.target.checked)
                          }
                          style={{
                            cursor: "pointer",
                            width: "14px",
                            height: "14px",
                            margin: "0 auto",
                            display: "block",
                            accentColor: "#0f172a",
                          }}
                          title="Komisyon Yetkisi Aktif"
                        />
                      </td>

                      {/* Ödeme Şekli Var Checkbox */}
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
                          checked={row.odemeSekliVar}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            handleFieldChange(row.clientId, "odemeSekliVar", checked);
                            if (!checked) {
                              handleFieldChange(row.clientId, "odemeSekli", null);
                            } else if (row.odemeSekli === null) {
                              handleFieldChange(row.clientId, "odemeSekli", 0);
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
                          title="Ödeme Şekli Tanımlı"
                        />
                      </td>

                      {/* Ödeme Şekli Select */}
                      <td
                        style={{
                          padding: 0,
                          borderRight: "1px solid #e0e0e0",
                        }}
                      >
                        <select
                          value={row.odemeSekli ?? ""}
                          disabled={!row.odemeSekliVar}
                          onChange={(e) =>
                            handleFieldChange(
                              row.clientId,
                              "odemeSekli",
                              e.target.value !== "" ? parseInt(e.target.value, 10) : null
                            )
                          }
                          onFocus={() => setActiveCell({ clientId: row.clientId, col: "odemeSekli" })}
                          onBlur={() => setActiveCell(null)}
                          style={{
                            width: "100%",
                            height: "23px",
                            border:
                              activeCell?.clientId === row.clientId && activeCell?.col === "odemeSekli"
                                ? "1px dotted #000000"
                                : "none",
                            outline: "none",
                            backgroundColor: "transparent",
                            padding: "0 4px",
                            fontSize: "12px",
                            color: row.odemeSekliVar ? "#000000" : "#94a3b8",
                            cursor: row.odemeSekliVar ? "pointer" : "not-allowed",
                          }}
                        >
                          <option value="">(Seçilmedi)</option>
                          <option value={0}>0 - Nakit</option>
                          <option value={1}>1 - Kredi Kartı / POS</option>
                          <option value={2}>2 - Havale / EFT</option>
                          <option value={3}>3 - Çek / Senet</option>
                        </select>
                      </td>

                      {/* Muhasebe Hesap ID */}
                      <td
                        style={{
                          padding: 0,
                          borderRight: "1px solid #e0e0e0",
                        }}
                      >
                        <input
                          type="number"
                          value={row.muhHesapId ?? ""}
                          placeholder="Hesap ID"
                          onChange={(e) =>
                            handleFieldChange(row.clientId, "muhHesapId", e.target.value)
                          }
                          onFocus={() => setActiveCell({ clientId: row.clientId, col: "muhHesapId" })}
                          onBlur={() => setActiveCell(null)}
                          style={{
                            width: "100%",
                            height: "23px",
                            border:
                              activeCell?.clientId === row.clientId && activeCell?.col === "muhHesapId"
                                ? "1px dotted #000000"
                                : "none",
                            outline: "none",
                            backgroundColor: "transparent",
                            padding: "0 6px",
                            fontSize: "13px",
                            textAlign: "right",
                            color: "#000000",
                          }}
                        />
                      </td>

                      {/* Depo Hesap ID */}
                      <td
                        style={{
                          padding: 0,
                          borderRight: "1px solid #e0e0e0",
                        }}
                      >
                        <input
                          type="number"
                          value={row.efektifDepoHesapId ?? ""}
                          placeholder="Depo ID"
                          onChange={(e) =>
                            handleFieldChange(row.clientId, "efektifDepoHesapId", e.target.value)
                          }
                          onFocus={() => setActiveCell({ clientId: row.clientId, col: "efektifDepoHesapId" })}
                          onBlur={() => setActiveCell(null)}
                          style={{
                            width: "100%",
                            height: "23px",
                            border:
                              activeCell?.clientId === row.clientId &&
                              activeCell?.col === "efektifDepoHesapId"
                                ? "1px dotted #000000"
                                : "none",
                            outline: "none",
                            backgroundColor: "transparent",
                            padding: "0 6px",
                            fontSize: "13px",
                            textAlign: "right",
                            color: "#000000",
                          }}
                        />
                      </td>

                      {/* Vaziyet Hesap ID */}
                      <td
                        style={{
                          padding: 0,
                          borderRight: "1px solid #e0e0e0",
                        }}
                      >
                        <input
                          type="number"
                          value={row.efektifVaziyetHesapId ?? ""}
                          placeholder="Vaziyet ID"
                          onChange={(e) =>
                            handleFieldChange(row.clientId, "efektifVaziyetHesapId", e.target.value)
                          }
                          onFocus={() => setActiveCell({ clientId: row.clientId, col: "efektifVaziyetHesapId" })}
                          onBlur={() => setActiveCell(null)}
                          style={{
                            width: "100%",
                            height: "23px",
                            border:
                              activeCell?.clientId === row.clientId &&
                              activeCell?.col === "efektifVaziyetHesapId"
                                ? "1px dotted #000000"
                                : "none",
                            outline: "none",
                            backgroundColor: "transparent",
                            padding: "0 6px",
                            fontSize: "13px",
                            textAlign: "right",
                            color: "#000000",
                          }}
                        />
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
                          title="Bu istatistik tanımını sil"
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
                      colSpan={18}
                      className="text-center py-4 text-muted"
                      style={{ fontSize: "13px" }}
                    >
                      Henüz tanımlanmış bir istatistik kaydı bulunmuyor. Aşağıdaki butondan yeni bir istatistik tanımı ekleyebilirsiniz.
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
              <IconPlus size={14} /> Yeni İstatistik Ekle (+)
            </button>

            {dirtyCount > 0 && (
              <span className="badge bg-warning text-dark px-2 py-1">
                {dirtyCount} satırda kaydedilmemiş değişiklik var
              </span>
            )}
          </div>

          <div className="text-secondary fw-semibold">
            Toplam İstatistik: <span className="text-dark">{rows.length}</span>
          </div>
        </div>
      </div>

      {/* Silme Onay Modalı */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered size="sm">
        <Modal.Header closeButton className="py-2">
          <Modal.Title className="fs-6 text-danger d-flex align-items-center gap-1.5">
            <IconTrash size={18} /> İstatistik Silme Onayı
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="py-3">
          <p className="mb-2" style={{ fontSize: "13px" }}>
            <strong>[{deleteTarget?.kod}] {deleteTarget?.aciklama}</strong> istatistik tanımını kalıcı olarak silmek istediğinize emin misiniz?
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

export default StatisticDefinitionsPage;
