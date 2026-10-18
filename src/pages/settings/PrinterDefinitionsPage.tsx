import React, { useState, useEffect } from "react";
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
} from "react-bootstrap";
import {
  IconPrinter,
  IconSearch,
  IconCheck,
  IconAlertCircle,
  IconTrash,
  IconAdjustments,
} from "@tabler/icons-react";

import ERPToolbar from "../../components/common/ERPToolbar";
import CodeLookupInput from "../../components/common/CodeLookupInput";
import LookupModal from "../../components/common/LookupModal";
import useERPAutoFocus from "../../hooks/useERPAutoFocus";
import { printReportTable } from "../../utils/printReport";
import {
  PrinterService,
  YaziciItem,
  YaziciFormData,
  YaziciUsageInfo,
} from "../../services/printerService";


const initialFormState: YaziciFormData = {
  siraNo: "" as any,
  ad: "",
  cihazAdi: "",
  baglantiNoktasi: "",
  belgeYaziciModu: 2,
  belgeYaziciDizini: "",
  kopyaSayisi: "" as any,
};

export const PrinterDefinitionsPage: React.FC = () => {
  const activeDb = localStorage.getItem("kuyumcu_erp_active_db") || "R2016_dvz";
  const activeServer = localStorage.getItem("kuyumcu_erp_active_server") || "localhost";

  // Data states
  const [yazicilar, setYazicilar] = useState<YaziciItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [selectedYazici, setSelectedYazici] = useState<YaziciItem | null>(null);
  const [formData, setFormData] = useState<YaziciFormData>(initialFormState);
  const [isNewRecord, setIsNewRecord] = useState<boolean>(false);

  useERPAutoFocus({ dependencies: [isNewRecord, selectedIndex] });

  // UI / Status states
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [alertSuccess, setAlertSuccess] = useState<string | null>(null);
  const [alertError, setAlertError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    yazici: YaziciItem;
    loadingUsage?: boolean;
    usage?: YaziciUsageInfo;
  } | null>(null);
  const [showLookupModal, setShowLookupModal] = useState<boolean>(false);

  // Load all printers
  const loadData = async (targetIndex?: number) => {
    try {
      setIsLoading(true);
      setAlertError(null);

      const list = await PrinterService.getYazicilar();
      setYazicilar(list || []);

      if (list && list.length > 0 && targetIndex !== undefined) {
        const idx = targetIndex >= 0 && targetIndex < list.length
          ? targetIndex
          : 0;
        setSelectedIndex(idx);
        handleSelectYazici(list[idx], idx);
      } else {
        handleClear(false);
      }
    } catch (err: any) {
      setAlertError(err.message || "Yazıcı tanımları yüklenirken bir hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectYazici = (yazici: YaziciItem, idx?: number) => {
    setSelectedYazici(yazici);
    if (idx !== undefined) {
      setSelectedIndex(idx);
    } else {
      const foundIdx = yazicilar.findIndex((y) => y.id === yazici.id);
      if (foundIdx !== -1) setSelectedIndex(foundIdx);
    }
    setIsNewRecord(false);
    setFormData({
      siraNo: yazici.siraNo,
      ad: yazici.ad,
      cihazAdi: yazici.cihazAdi || "",
      baglantiNoktasi: yazici.baglantiNoktasi || "",
      belgeYaziciModu: yazici.belgeYaziciModu,
      belgeYaziciDizini: yazici.belgeYaziciDizini || "",
      kopyaSayisi: yazici.kopyaSayisi,
    });
    setAlertError(null);
  };

  const handleClear = (showAlert: boolean = true) => {
    setSelectedYazici(null);
    setIsNewRecord(true);
    setFormData({
      ...initialFormState,
      siraNo: "" as any,
      ad: "",
      cihazAdi: "",
      baglantiNoktasi: "",
      belgeYaziciModu: 2,
      belgeYaziciDizini: "",
      kopyaSayisi: "" as any,
    });
    if (showAlert) {
      setAlertSuccess("Form alanları temizlendi. Yeni bilgileri girip sol üstteki 'Kaydet' (💾) butonuna basınız.");
      setTimeout(() => setAlertSuccess(null), 3500);
    }
    setAlertError(null);
  };

  const handleNewYazici = () => {
    handleClear();
  };


  const handleNavigate = (direction: "first" | "prev" | "next" | "last") => {
    if (yazicilar.length === 0) return;
    let newIdx = selectedIndex;
    if (direction === "first") newIdx = 0;
    else if (direction === "prev") newIdx = Math.max(0, selectedIndex - 1);
    else if (direction === "next") newIdx = Math.min(yazicilar.length - 1, selectedIndex + 1);
    else if (direction === "last") newIdx = yazicilar.length - 1;

    setSelectedIndex(newIdx);
    handleSelectYazici(yazicilar[newIdx], newIdx);
  };

  const handleInputChange = (field: keyof YaziciFormData, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Unified save handler for creating new and updating existing printer records
  const handleSave = async () => {
    setAlertError(null);

    // 1. Türkçe Zorunlu Alan Doğrulamaları
    if (!formData.ad || !formData.ad.trim()) {
      setAlertError("⚠️ Zorunlu Alan Eksik: Lütfen Yazıcı Tanım Adını (Paylaşım Adı) giriniz.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (formData.ad.trim().length > 200) {
      setAlertError("⚠️ Geçersiz Giriş: Yazıcı adı en fazla 200 karakter olabilir.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    let cleanSiraNo = parseInt(String(formData.siraNo), 10);
    if (isNaN(cleanSiraNo) || cleanSiraNo <= 0) {
      const maxSira = yazicilar.reduce((max, y) => {
        const s = Number(y.siraNo);
        return !isNaN(s) && s > max ? s : max;
      }, 0);
      cleanSiraNo = Math.max(maxSira + 1, yazicilar.length + 1);
    }
    const cleanKopyaSayisi = parseInt(String(formData.kopyaSayisi), 10) || 1;

    const payload: YaziciFormData = {
      ...formData,
      siraNo: cleanSiraNo,
      kopyaSayisi: cleanKopyaSayisi,
    };

    try {
      setIsSaving(true);
      setAlertError(null);

      if (isNewRecord || !selectedYazici) {
        const created = await PrinterService.createYazici(payload);
        setAlertSuccess(`✅ "${created.ad}" yazıcısı veritabanına başarıyla eklendi.`);
        await loadData();
        handleClear(false);
      } else {
        const updated = await PrinterService.updateYazici(selectedYazici.id, payload);
        setAlertSuccess(`✅ "${updated.ad}" yazıcı bilgileri başarıyla güncellendi.`);
        await loadData();
        handleClear(false);
      }

      setTimeout(() => setAlertSuccess(null), 4500);
    } catch (err: any) {
      setAlertError(`❌ Kaydetme Başarısız: ${err.message || "İşlem sırasında beklenmeyen bir hata oluştu."}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setIsSaving(false);
    }
  };


  const handleOpenDeleteConfirm = (yazici: YaziciItem) => {
    setDeleteConfirm({
      yazici,
      loadingUsage: true,
    });

    PrinterService.getYaziciUsage(yazici.id)
      .then((usage) => {
        setDeleteConfirm((prev) =>
          prev && prev.yazici.id === yazici.id
            ? { ...prev, loadingUsage: false, usage }
            : prev
        );
      })
      .catch(() => {
        setDeleteConfirm((prev) =>
          prev && prev.yazici.id === yazici.id
            ? { ...prev, loadingUsage: false }
            : prev
        );
      });
  };

  const handleExecuteDelete = async (
    yazici: YaziciItem,
    usage?: YaziciUsageInfo
  ) => {
    setDeleteConfirm(null);
    try {
      setIsSaving(true);
      await PrinterService.deleteYazici(yazici.id, { force: true });

      const cleanedParts: string[] = [];
      if (usage?.hasVezne) cleanedParts.push("vezne tanımlarından");
      if (usage?.hasKullanici) cleanedParts.push("kullanıcı atamalarından");
      if (usage?.hasNumerator) cleanedParts.push("numaratör serilerinden");
      cleanedParts.push("yazıcı tanımlarından ve sistemden");

      setAlertSuccess(
        `✅ "${yazici.ad}" yazıcısı; ${cleanedParts.join(", ")} başarıyla silindi ve temizlendi.`
      );
      await loadData(Math.max(0, selectedIndex - 1));
      setTimeout(() => setAlertSuccess(null), 5000);
    } catch (err: any) {
      setAlertError(
        `❌ Silme Başarısız: ${err.message || "Yazıcı silinirken bir hata oluştu."}`
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Filtered printers list
  const filteredYazicilar = yazicilar.filter((y) => {
    const s = searchTerm.toLowerCase();
    return (
      y.ad.toLowerCase().includes(s) ||
      (y.cihazAdi && y.cihazAdi.toLowerCase().includes(s)) ||
      (y.baglantiNoktasi && y.baglantiNoktasi.toLowerCase().includes(s))
    );
  });

  const handlePrint = () => {
    printReportTable<YaziciItem>({
      title: "Yazıcı Tanımları Listesi Raporu",
      subtitle: `Aktif Tanımlı Yazıcılar Dökümü (${filteredYazicilar.length} Kayıt)`,
      data: filteredYazicilar,
      columns: [
        { header: "Sıra", key: "siraNo", width: "8%", align: "center" },
        { header: "Yazıcı Adı / Tanım", key: "ad", width: "32%" },
        { header: "Sistem Aygıtı / Cihaz Adı", key: "cihazAdi", width: "32%" },
        { header: "Bağlantı Noktası (Port)", key: "baglantiNoktasi", width: "16%" },
        { header: "Kopya", key: "kopyaSayisi", width: "12%", align: "center" },
      ],
      summaryInfo: `Toplam Tanımlı Yazıcı: ${filteredYazicilar.length}`,
    });
  };

  return (
    <div className="w-100 pb-3">
      {/* 1. Sol Üst Klasik ERP Toolbar */}
      <ERPToolbar
        pageTitle="Yazıcı Tanımları"
        pageIcon={<IconPrinter size={20} />}
        onNew={handleNewYazici}
        onSave={handleSave}
        onSearch={() => setShowLookupModal(true)}
        onDelete={() => {
          if (selectedYazici && !isNewRecord) {
            handleOpenDeleteConfirm(selectedYazici);
          }
        }}
        onFirst={() => handleNavigate("first")}
        onPrev={() => handleNavigate("prev")}
        onNext={() => handleNavigate("next")}
        onLast={() => handleNavigate("last")}
        onPrint={handlePrint}
        onRefresh={() => loadData(selectedIndex)}
        onClear={handleClear}
        disabled={isLoading || isSaving}
        modeText={isNewRecord ? "Yeni Kayıt Modu" : `Düzenleme: [${formData.siraNo}] ${formData.ad}`}
      />


      {/* Notifications: Sağ altta beliren ve otomatik kaybolan toast */}
      {(alertSuccess || alertError) && (
        <div className="erp-toast-container">
          {alertSuccess && (
            <Alert variant="success" className="erp-toast-item d-flex align-items-center gap-2 py-2 mb-0 shadow border-0" dismissible onClose={() => setAlertSuccess(null)}>
              <IconCheck size={18} />
              <span>{alertSuccess}</span>
            </Alert>
          )}

          {alertError && (
            <Alert variant="danger" className="erp-toast-item d-flex align-items-center gap-2 py-2 mb-0 shadow border-0" dismissible onClose={() => setAlertError(null)}>
              <IconAlertCircle size={18} />
              <span>{alertError}</span>
            </Alert>
          )}
        </div>
      )}

      {/* 2. Main Container Card (Tam Sayfa Dış Kenarlık) */}
      <Card className="border shadow-sm mb-3 w-100 bg-white">
        <Card.Body className="p-3 p-md-4">
          <Row>
            <Col lg={7} md={12}>
              {(() => {
                const labelColStyle = { width: "155px", flex: "0 0 155px", maxWidth: "155px" };
                return (
                  <Form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                    {/* Sıra No */}
                    <Form.Group as={Row} className="mb-2 align-items-center g-2">
                      <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap mb-0">
                        Sıra No :
                      </Form.Label>
                      <Col>
                        <div style={{ maxWidth: "130px" }}>
                          <Form.Control
                            autoFocus
                            size="sm"
                            type="text"
                            inputMode="numeric"
                            placeholder="Otomatik"
                            value={formData.siraNo !== undefined && formData.siraNo !== null ? formData.siraNo : ""}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9]/g, "");
                              handleInputChange("siraNo", val === "" ? "" : parseInt(val, 10));
                            }}
                            className="font-monospace text-dark"
                          />
                        </div>
                      </Col>
                    </Form.Group>

                    {/* Yazıcı Tanım / Paylaşım Adı - Oklu Dürbünlü Kod/Kayıt Seçici */}
                    <Form.Group as={Row} className="mb-2 align-items-center g-2">
                      <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap mb-0">
                        Yazıcı Tanımı / Adı <span className="text-danger">*</span> :
                      </Form.Label>
                      <Col>
                        <div style={{ maxWidth: "280px" }}>
                          <CodeLookupInput
                            value={formData.ad}
                            maxLength={200}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleInputChange("ad", e.target.value)}
                            required
                            onLookupClick={() => setShowLookupModal(true)}
                            lookupTitle="Tanımlı Yazıcılardan Seç (Oklu Dürbün)"
                          />
                        </div>
                      </Col>
                    </Form.Group>

                    {/* Cihaz / Aygıt Adı */}
                    <Form.Group as={Row} className="mb-2 align-items-center g-2">
                      <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap mb-0">
                        Cihaz / Aygıt Adı :
                      </Form.Label>
                      <Col>
                        <div style={{ maxWidth: "280px" }}>
                          <Form.Control
                            type="text"
                            size="sm"
                            maxLength={200}
                            value={formData.cihazAdi || ""}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleInputChange("cihazAdi", e.target.value)}
                          />
                        </div>
                      </Col>
                    </Form.Group>

                    {/* Bağlantı Noktası */}
                    <Form.Group as={Row} className="mb-2 align-items-center g-2">
                      <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap mb-0">
                        Bağlantı Noktası :
                      </Form.Label>
                      <Col>
                        <div style={{ maxWidth: "240px" }}>
                          <Form.Control
                            type="text"
                            size="sm"
                            maxLength={200}
                            value={formData.baglantiNoktasi || ""}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleInputChange("baglantiNoktasi", e.target.value)}
                          />
                        </div>
                      </Col>
                    </Form.Group>

                    {/* Belge Yazıcı Modu */}
                    <Form.Group as={Row} className="mb-2 align-items-center g-2">
                      <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap mb-0">
                        Yazıcı Modu <span className="text-danger">*</span> :
                      </Form.Label>
                      <Col>
                        <div style={{ maxWidth: "340px" }}>
                          <Form.Select
                            size="sm"
                            value={formData.belgeYaziciModu}
                            onChange={(e) => handleInputChange("belgeYaziciModu", parseInt(e.target.value, 10))}
                            className="fw-semibold text-dark"
                          >
                            <option value={0}>0 - Standart Windows Sürücüsü (A4 / A5 Fatura)</option>
                            <option value={1}>1 - ESC/POS Direkt Termal (USB/Seri Port)</option>
                            <option value={2}>2 - Ağ Paylaşımı / Raw (IP / LAN Fiş Yazıcısı)</option>
                            <option value={3}>3 - Dosyaya Yazdır / Arşiv (Klasöre Kaydetme)</option>
                          </Form.Select>
                        </div>
                      </Col>
                    </Form.Group>

                    {/* Varsayılan Kopya Sayısı */}
                    <Form.Group as={Row} className="mb-2 align-items-center g-2">
                      <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap mb-0">
                        Kopya Sayısı :
                      </Form.Label>
                      <Col>
                        <div style={{ maxWidth: "130px" }}>
                          <Form.Control
                            size="sm"
                            type="text"
                            inputMode="numeric"
                            value={formData.kopyaSayisi || ""}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9]/g, "");
                              handleInputChange("kopyaSayisi", val === "" ? "" : parseInt(val, 10));
                            }}
                            onBlur={() => {
                              const parsed = parseInt(String(formData.kopyaSayisi), 10);
                              handleInputChange("kopyaSayisi", isNaN(parsed) || parsed < 1 ? 1 : Math.min(parsed, 99));
                            }}
                            className="font-monospace text-dark"
                          />
                        </div>
                      </Col>
                    </Form.Group>

                    {/* Belge Yazıcı Dizini */}
                    <Form.Group as={Row} className="mb-2 align-items-center g-2">
                      <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap mb-0">
                        Klasöre Yazdır :
                      </Form.Label>
                      <Col>
                        <div style={{ maxWidth: "340px" }}>
                          <Form.Control
                            type="text"
                            size="sm"
                            maxLength={60}
                            placeholder="Alt klasör adı (firma klasörü › Yazdirma)"
                            value={formData.belgeYaziciDizini || ""}
                            onChange={(e) => handleInputChange("belgeYaziciDizini", e.target.value)}
                          />
                        </div>
                      </Col>
                    </Form.Group>
                  </Form>
                );
              })()}
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Dürbün Yazıcı Arama & Seçme Modalı (Liste Verisi Yoksa Bomboş) */}
      <LookupModal<YaziciItem>
        show={showLookupModal}
        onHide={() => setShowLookupModal(false)}
        title="Yazıcı Tanımı Seçimi"
        searchPlaceholder="Yazıcı adı, cihaz veya port ile ara..."
        items={yazicilar}
        isLoading={isLoading}
        filterFn={(item, term) => {
          const t = term.toLowerCase();
          return (
            item.ad.toLowerCase().includes(t) ||
            (item.cihazAdi && item.cihazAdi.toLowerCase().includes(t)) ||
            (item.baglantiNoktasi && item.baglantiNoktasi.toLowerCase().includes(t)) ||
            String(item.siraNo).includes(t)
          );
        }}
        columns={[
          {
            header: "Sıra",
            width: "70px",
            align: "center",
            render: (y) => <span className="badge bg-light text-dark border font-monospace fw-bold">{y.siraNo}</span>,
          },
          {
            header: "Yazıcı Tanım Adı",
            render: (y) => <span className="fw-semibold text-dark">{y.ad}</span>,
          },
          {
            header: "Cihaz / Aygıt",
            render: (y) => y.cihazAdi || "-",
          },
          {
            header: "Bağlantı Portu",
            width: "120px",
            render: (y) => <span className="font-monospace text-secondary small">{y.baglantiNoktasi || "-"}</span>,
          },
        ]}
        onSelect={(y) => {
          const foundIdx = yazicilar.findIndex((item) => item.id === y.id);
          handleSelectYazici(y, foundIdx !== -1 ? foundIdx : 0);
        }}
      />

      {/* Yazıcı Silme Onay Popup'ı (Sayfa ortasında, nerelerden silineceğini açıkça listeleyen popup) */}
      <Modal
        show={!!deleteConfirm}
        onHide={() => !isSaving && setDeleteConfirm(null)}
        centered
        backdrop="static"
        keyboard={!isSaving}
        size="lg"
        className="delete-confirmation-modal"
      >
        <Modal.Header closeButton={!isSaving} className="bg-light py-2.5 px-3 border-bottom">
          <Modal.Title className="fs-6 fw-bold text-dark d-flex align-items-center gap-2">
            <IconAlertCircle size={20} className="text-danger" />
            <span>Yazıcı Silme Bildirimi</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3.5">
          <div className="d-flex align-items-center gap-2 mb-3 pb-2.5 border-bottom">
            <div
              className="p-2.5 rounded-circle flex-shrink-0 d-flex align-items-center justify-content-center"
              style={{ backgroundColor: "#fee2e2", color: "#dc2626" }}
            >
              <IconTrash size={26} />
            </div>
            <div className="flex-grow-1">
              <div className="d-flex align-items-center gap-2">
                <span className="fw-bold fs-5 text-dark">{deleteConfirm?.yazici.ad}</span>
                <Badge bg="danger" className="text-uppercase px-2.5 py-1 fs-7">
                  Sıra No: {deleteConfirm?.yazici.siraNo}
                </Badge>
                {deleteConfirm?.yazici.baglantiNoktasi && (
                  <Badge bg="secondary" className="px-2 py-1 fs-7">
                    Port: {deleteConfirm.yazici.baglantiNoktasi}
                  </Badge>
                )}
              </div>
              <div className="text-secondary small mt-0.5">
                Bu yazıcının sistemdeki kullanım alanları ve silineceği yerler aşağıda listelenmiştir:
              </div>
            </div>
          </div>

          {deleteConfirm?.loadingUsage ? (
            <div className="py-4 text-center text-muted small d-flex flex-column align-items-center gap-2">
              <Spinner size="sm" animation="border" variant="danger" />
              <span>Yazıcının veritabanındaki kullanım alanları taranıyor...</span>
            </div>
          ) : (
            <div>
              <div className="fw-bold text-dark small mb-2 d-flex align-items-center gap-1.5">
                <span>Silme İşleminde Temizlenecek ve Kaldırılacak Yerler:</span>
              </div>

              <div className="d-flex flex-column gap-2 mb-3">
                {/* 1. Vezne Tanımları (Fiş ve Form Yazıcıları) */}
                {deleteConfirm?.usage?.hasVezne ? (
                  <div className="p-2.5 rounded border border-danger-subtle bg-danger-subtle bg-opacity-25 d-flex align-items-start gap-2.5">
                    <IconPrinter size={20} className="text-danger flex-shrink-0 mt-0.5" />
                    <div className="flex-grow-1">
                      <div className="d-flex align-items-center justify-content-between">
                        <strong className="text-danger small">
                          1. Vezne Tanımları ({deleteConfirm.usage.vezneCount} Adet Vezne)
                        </strong>
                        <Badge bg="danger">Yazıcı Seçimleri Sıfırlanacak</Badge>
                      </div>
                      <div className="mt-1 small">
                        <div className="text-dark mb-1">Bu yazıcının tanımlı olduğu vezneler ve fiş tipleri:</div>
                        <div className="d-flex flex-column gap-1 bg-white p-2 rounded border border-danger-subtle">
                          {deleteConfirm.usage.vezneDetails?.map((v, idx) => (
                            <div key={idx} className="d-flex justify-content-between align-items-center text-dark">
                              <span><strong>{v.vezneKod}</strong> - {v.vezneAd}</span>
                              <div className="d-flex gap-1 flex-wrap">
                                {v.roles.map((r, rIdx) => (
                                  <span key={rIdx} className="badge bg-light text-danger border border-danger-subtle fw-semibold">
                                    {r}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="text-muted small mt-1">
                        Bu veznelerdeki ilgili fiş/form yazıcı seçimleri kaldırılarak boşaltılacaktır.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-2 rounded border border-light bg-light d-flex align-items-center gap-2 text-muted small">
                    <IconCheck size={16} className="text-success" />
                    <span><strong>1. Vezne Tanımları:</strong> Hiçbir vezneye fiş veya form yazıcısı olarak atanmamış.</span>
                  </div>
                )}

                {/* 2. Kullanıcı Tanımları (Varsayılan Yazıcı) */}
                {deleteConfirm?.usage?.hasKullanici ? (
                  <div className="p-2.5 rounded border border-warning-subtle bg-warning-subtle bg-opacity-25 d-flex align-items-start gap-2.5">
                    <IconPrinter size={20} className="text-warning flex-shrink-0 mt-0.5" />
                    <div className="flex-grow-1">
                      <div className="d-flex align-items-center justify-content-between">
                        <strong className="text-warning-emphasis small">
                          2. Kullanıcı Tanımları ({deleteConfirm.usage.kullaniciCount} Kullanıcı)
                        </strong>
                        <Badge bg="warning" text="dark">Varsayılan Yazıcı Sıfırlanacak</Badge>
                      </div>
                      <div className="text-dark small mt-1">
                        Varsayılan Yazıcı Olarak Seçen Kullanıcılar:{" "}
                        <strong>{deleteConfirm.usage.kullaniciNames?.join(", ")}</strong>
                      </div>
                      <div className="text-muted small mt-0.5">
                        Bu kullanıcıların varsayılan yazıcı ataması temizlenecektir.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-2 rounded border border-light bg-light d-flex align-items-center gap-2 text-muted small">
                    <IconCheck size={16} className="text-success" />
                    <span><strong>2. Kullanıcı Tanımları:</strong> Herhangi bir kullanıcının varsayılan yazıcısı olarak seçili değil.</span>
                  </div>
                )}

                {/* 3. Numaratör / Seri No Tanımları */}
                {deleteConfirm?.usage?.hasNumerator ? (
                  <div className="p-2.5 rounded border border-danger-subtle bg-danger-subtle bg-opacity-25 d-flex align-items-start gap-2.5">
                    <IconAdjustments size={20} className="text-danger flex-shrink-0 mt-0.5" />
                    <div className="flex-grow-1">
                      <div className="d-flex align-items-center justify-content-between">
                        <strong className="text-danger small">
                          3. Numaratör Tanımları ({deleteConfirm.usage.numeratorCount} Adet Özel Seri)
                        </strong>
                        <Badge bg="danger">Silinecek</Badge>
                      </div>
                      <div className="text-dark small mt-1">
                        Bu yazıcıya bağlı özel evrak seri tanımları:{" "}
                        <strong>{deleteConfirm.usage.numeratorDetails?.map((n) => `Tür ${n.tur} (${n.onek})`).join(", ")}</strong>
                      </div>
                      <div className="text-muted small mt-0.5">
                        Yazıcıya özel numaratör serileri sistemden kaldırılacaktır (Genel numaratörler korunur).
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-2 rounded border border-light bg-light d-flex align-items-center gap-2 text-muted small">
                    <IconCheck size={16} className="text-success" />
                    <span><strong>3. Numaratör Tanımları:</strong> Bu yazıcıya özel ayrılmış numaratör serisi bulunmuyor.</span>
                  </div>
                )}

                {/* 4. Yazıcı Tanım Kartı */}
                <div className="p-2.5 rounded border border-danger-subtle bg-white d-flex align-items-start gap-2.5">
                  <IconTrash size={20} className="text-danger flex-shrink-0 mt-0.5" />
                  <div className="flex-grow-1">
                    <div className="d-flex align-items-center justify-content-between">
                      <strong className="text-danger small">4. Yazıcı Tanım Kartı</strong>
                      <Badge bg="danger">Tamamen Silinecek</Badge>
                    </div>
                    <div className="text-muted small mt-0.5">
                      <strong>[{deleteConfirm?.yazici.siraNo}] {deleteConfirm?.yazici.ad}</strong> yazıcı kartı sistemden kalıcı olarak silinecektir.
                    </div>
                  </div>
                </div>
              </div>

              <div
                className="alert alert-warning py-2.5 px-3 small mb-0 border-0 rounded-2 text-dark d-flex align-items-start gap-2 shadow-xs"
                style={{ backgroundColor: "#fef3c7" }}
              >
                <IconAlertCircle size={20} className="text-warning flex-shrink-0 mt-0.5" />
                <span>
                  <strong>"Yine de Sil"</strong> butonuna bastığınızda, bu yazıcı yukarıda listelenen tüm yerlerden (vezneler, kullanıcılar ve numaratör tanımları) otomatik olarak kaldırılacak ve sistemden silinecektir.
                </span>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="bg-light py-2 px-3 border-top d-flex justify-content-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="px-3"
            onClick={() => setDeleteConfirm(null)}
            disabled={isSaving}
          >
            Vazgeç
          </Button>
          <Button
            variant="danger"
            size="sm"
            className="px-3 fw-bold d-flex align-items-center gap-1.5 shadow-xs"
            onClick={() =>
              deleteConfirm &&
              handleExecuteDelete(deleteConfirm.yazici, deleteConfirm.usage)
            }
            disabled={isSaving || deleteConfirm?.loadingUsage}
          >
            {isSaving ? (
              <>
                <Spinner size="sm" animation="border" />
                <span>Siliniyor...</span>
              </>
            ) : (
              <>
                <IconTrash size={16} />
                <span>Yine de Sil</span>
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default PrinterDefinitionsPage;
