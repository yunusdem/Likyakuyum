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
  InputGroup,
} from "react-bootstrap";
import {
  IconPrinter,
  IconSearch,
  IconCheck,
  IconAlertCircle,
  IconTrash,
  IconAdjustments,
  IconChevronUp,
  IconChevronDown,
} from "@tabler/icons-react";

import ERPToolbar from "../../components/common/ERPToolbar";
import CodeLookupInput from "../../components/common/CodeLookupInput";
import LookupModal from "../../components/common/LookupModal";
import { printReportTable } from "../../utils/printReport";
import {
  PrinterService,
  YaziciItem,
  YaziciFormData,
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

  // UI / Status states
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [alertSuccess, setAlertSuccess] = useState<string | null>(null);
  const [alertError, setAlertError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
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

    const cleanSiraNo = parseInt(String(formData.siraNo), 10) || 1;
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
        await loadData(yazicilar.length);
        setIsNewRecord(false);
      } else {
        const updated = await PrinterService.updateYazici(selectedYazici.id, payload);
        setAlertSuccess(`✅ "${updated.ad}" yazıcı bilgileri başarıyla güncellendi.`);
        await loadData(selectedIndex);
      }

      setTimeout(() => setAlertSuccess(null), 4500);
    } catch (err: any) {
      setAlertError(`❌ Kaydetme Başarısız: ${err.message || "İşlem sırasında beklenmeyen bir hata oluştu."}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setIsSaving(false);
    }
  };


  const handleDelete = async () => {
    if (!selectedYazici || isNewRecord) return;
    try {
      setIsSaving(true);
      setShowDeleteModal(false);
      await PrinterService.deleteYazici(selectedYazici.id);
      setAlertSuccess(`✅ "${selectedYazici.ad}" yazıcısı başarıyla silindi.`);
      await loadData(Math.max(0, selectedIndex - 1));
      setTimeout(() => setAlertSuccess(null), 4000);
    } catch (err: any) {
      setAlertError(`❌ Silme Başarısız: ${err.message || "Yazıcı silinirken bir hata oluştu."}`);
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
    <div className="p-2 p-md-3">
      {/* 1. Sol Üst Klasik ERP Toolbar */}
      <ERPToolbar
        pageTitle="Yazıcı Tanımları"
        pageIcon={<IconPrinter size={20} />}
        onNew={handleNewYazici}
        onSave={handleSave}
        onSearch={() => setShowLookupModal(true)}
        onDelete={() => {
          if (selectedYazici && !isNewRecord) {
            setShowDeleteModal(true);
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
      />


      {/* Notifications */}
      {alertSuccess && (
        <Alert variant="success" className="d-flex align-items-center gap-2 py-2 mb-3 shadow-sm border-0" dismissible onClose={() => setAlertSuccess(null)}>
          <IconCheck size={18} />
          <span>{alertSuccess}</span>
        </Alert>
      )}

      {alertError && (
        <Alert variant="danger" className="d-flex align-items-center gap-2 py-2 mb-3 shadow-sm border-0" dismissible onClose={() => setAlertError(null)}>
          <IconAlertCircle size={18} />
          <span>{alertError}</span>
        </Alert>
      )}

      {/* 2. Main Container Card (Tam Genişlik, Liste Kaldırıldı, Yatay Inputlar) */}
      <Card className="border-0 shadow-sm rounded-3 mb-4 bg-white">
        <Card.Body className="p-3 p-md-4">
          <div className="mb-3 pb-2 border-bottom d-flex align-items-center justify-content-end flex-wrap gap-2">
            <Badge bg={isNewRecord ? "warning" : "primary"} className="px-2.5 py-1.5 fs-7">
              {isNewRecord ? "Yeni Kayıt Modu" : `Düzenleme: [${formData.siraNo}] ${formData.ad}`}
            </Badge>
          </div>

          <div className="mx-auto" style={{ maxWidth: "850px" }}>
            <Form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
              <div className="border rounded-3 p-3 p-md-4 bg-white shadow-2xs mb-3">
                {/* Sıra No */}
                <Form.Group as={Row} className="mb-3 align-items-center">
                  <Form.Label column sm={4} md={3} className="text-secondary fw-semibold text-sm-end pe-3 mb-0">
                    Sıra No <span className="text-danger">*</span> :
                  </Form.Label>
                  <Col sm={8} md={9}>
                    <InputGroup>
                      <Form.Control
                        type="text"
                        inputMode="numeric"
                        value={formData.siraNo || ""}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, "");
                          handleInputChange("siraNo", val === "" ? "" : parseInt(val, 10));
                        }}
                        onBlur={() => {
                          const parsed = parseInt(String(formData.siraNo), 10);
                          handleInputChange("siraNo", isNaN(parsed) || parsed < 1 ? 1 : parsed);
                        }}
                        className="fw-bold font-monospace"
                        required
                      />
                      <Button
                        variant="outline-secondary"
                        className="px-2.5"
                        onClick={() => {
                          const current = parseInt(String(formData.siraNo), 10) || 1;
                          handleInputChange("siraNo", Math.max(1, current - 1));
                        }}
                        type="button"
                      >
                        <IconChevronDown size={15} />
                      </Button>
                      <Button
                        variant="outline-secondary"
                        className="px-2.5"
                        onClick={() => {
                          const current = parseInt(String(formData.siraNo), 10) || 0;
                          handleInputChange("siraNo", current + 1);
                        }}
                        type="button"
                      >
                        <IconChevronUp size={15} />
                      </Button>
                    </InputGroup>
                  </Col>
                </Form.Group>

                {/* Yazıcı Tanım / Paylaşım Adı - Oklu Dürbünlü Kod/Kayıt Seçici */}
                <Form.Group as={Row} className="mb-3 align-items-center">
                  <Form.Label column sm={4} md={3} className="text-secondary fw-semibold text-sm-end pe-3 mb-0">
                    Yazıcı Tanımı / Adı <span className="text-danger">*</span> :
                  </Form.Label>
                  <Col sm={8} md={9}>
                    <CodeLookupInput
                      value={formData.ad}
                      maxLength={200}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleInputChange("ad", e.target.value)}
                      required
                      onLookupClick={() => setShowLookupModal(true)}
                      lookupTitle="Tanımlı Yazıcılardan Seç (Oklu Dürbün)"
                    />
                  </Col>
                </Form.Group>

                {/* Cihaz / Aygıt Adı */}
                <Form.Group as={Row} className="mb-3 align-items-center">
                  <Form.Label column sm={4} md={3} className="text-secondary fw-semibold text-sm-end pe-3 mb-0">
                    Cihaz / Aygıt Adı :
                  </Form.Label>
                  <Col sm={8} md={9}>
                    <Form.Control
                      type="text"
                      maxLength={200}
                      value={formData.cihazAdi || ""}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleInputChange("cihazAdi", e.target.value)}
                    />
                  </Col>
                </Form.Group>

                {/* Bağlantı Noktası */}
                <Form.Group as={Row} className="mb-3 align-items-center">
                  <Form.Label column sm={4} md={3} className="text-secondary fw-semibold text-sm-end pe-3 mb-0">
                    Bağlantı Noktası :
                  </Form.Label>
                  <Col sm={8} md={9}>
                    <Form.Control
                      type="text"
                      maxLength={200}
                      value={formData.baglantiNoktasi || ""}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleInputChange("baglantiNoktasi", e.target.value)}
                    />
                  </Col>
                </Form.Group>

                {/* Belge Yazıcı Modu */}
                <Form.Group as={Row} className="mb-3 align-items-center">
                  <Form.Label column sm={4} md={3} className="text-secondary fw-semibold text-sm-end pe-3 mb-0">
                    Yazıcı Modu <span className="text-danger">*</span> :
                  </Form.Label>
                  <Col sm={8} md={9}>
                    <Form.Select
                      value={formData.belgeYaziciModu}
                      onChange={(e) => handleInputChange("belgeYaziciModu", parseInt(e.target.value, 10))}
                      className="fw-bold text-primary"
                    >
                      <option value={0}>0 - Standart Windows Sürücüsü (A4 / A5 Fatura)</option>
                      <option value={1}>1 - ESC/POS Direkt Termal (USB/Seri Port)</option>
                      <option value={2}>2 - Ağ Paylaşımı / Raw (IP / LAN Fiş Yazıcısı)</option>
                      <option value={3}>3 - Dosyaya Yazdır / Arşiv (Klasöre Kaydetme)</option>
                    </Form.Select>
                  </Col>
                </Form.Group>

                {/* Varsayılan Kopya Sayısı */}
                <Form.Group as={Row} className="mb-3 align-items-center">
                  <Form.Label column sm={4} md={3} className="text-secondary fw-semibold text-sm-end pe-3 mb-0">
                    Kopya Sayısı :
                  </Form.Label>
                  <Col sm={8} md={9}>
                    <InputGroup>
                      <Form.Control
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
                        className="fw-bold font-monospace"
                      />
                      <Button
                        variant="outline-secondary"
                        className="px-2.5"
                        onClick={() => {
                          const current = parseInt(String(formData.kopyaSayisi), 10) || 1;
                          handleInputChange("kopyaSayisi", Math.max(1, current - 1));
                        }}
                        type="button"
                      >
                        <IconChevronDown size={15} />
                      </Button>
                      <Button
                        variant="outline-secondary"
                        className="px-2.5"
                        onClick={() => {
                          const current = parseInt(String(formData.kopyaSayisi), 10) || 0;
                          handleInputChange("kopyaSayisi", Math.min(99, current + 1));
                        }}
                        type="button"
                      >
                        <IconChevronUp size={15} />
                      </Button>
                    </InputGroup>
                  </Col>
                </Form.Group>

                {/* Belge Yazıcı Dizini */}
                <Form.Group as={Row} className="mb-2 align-items-center">
                  <Form.Label column sm={4} md={3} className="text-secondary fw-semibold text-sm-end pe-3 mb-0">
                    Çıktı / Arşiv Dizini :
                  </Form.Label>
                  <Col sm={8} md={9}>
                    <Form.Control
                      type="text"
                      maxLength={100}
                      value={formData.belgeYaziciDizini || ""}
                      onChange={(e) => handleInputChange("belgeYaziciDizini", e.target.value)}
                    />
                  </Col>
                </Form.Group>
              </div>
            </Form>
          </div>
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

      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="fs-5 text-danger d-flex align-items-center gap-2">
            <IconTrash size={20} /> Yazıcı Silme Onayı
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-2">
            <strong>[{selectedYazici?.siraNo}] {selectedYazici?.ad}</strong> yazıcısını veritabanından kalıcı olarak silmek istediğinize emin misiniz?
          </p>
          <p className="small text-danger mb-0">
            ⚠️ Bu işlem geri alınamaz. Eğer bu yazıcı herhangi bir Vezneye veya Kullanıcıya atanmışsa silme işlemi engellenecektir.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" size="sm" onClick={() => setShowDeleteModal(false)}>
            İptal
          </Button>
          <Button variant="danger" size="sm" onClick={handleDelete} disabled={isSaving}>
            {isSaving ? "Siliniyor..." : "Evet, Yazıcıyı Sil"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default PrinterDefinitionsPage;
