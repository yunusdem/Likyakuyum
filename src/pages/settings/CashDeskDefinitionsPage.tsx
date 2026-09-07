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
  IconBuildingStore,
  IconSearch,
  IconPrinter,
  IconCheck,
  IconAlertCircle,
  IconShieldLock,
  IconTrash,
} from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import CodeLookupInput from "../../components/common/CodeLookupInput";
import LookupModal from "../../components/common/LookupModal";
import { printReportTable } from "../../utils/printReport";
import {
  CashDeskService,
  VezneItem,
  VezneFormData,
  LookupPrinter,
  LookupCurrency,
} from "../../services/cashDeskService";

const initialFormState: VezneFormData = {
  kod: "",
  ad: "",
  fisTipi: 2,
  paraId: null,
  alisFisiYaziciId: null,
  satisFisiYaziciId: null,
  altinAlisFisiYaziciId: null,
  altinSatisFisiYaziciId: null,
  alisSatisIzniVar: true,
  musteriTaniFormuYaziciId: null,
  musteriTaniFormuYaziciVar: false,
};

export const CashDeskDefinitionsPage: React.FC = () => {
  const activeDb = localStorage.getItem("kuyumcu_erp_active_db") || "R2016_dvz";
  const activeServer = localStorage.getItem("kuyumcu_erp_active_server") || "localhost";

  // Data states
  const [vezneler, setVezneler] = useState<VezneItem[]>([]);
  const [printers, setPrinters] = useState<LookupPrinter[]>([]);
  const [currencies, setCurrencies] = useState<LookupCurrency[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [selectedVezne, setSelectedVezne] = useState<VezneItem | null>(null);
  const [formData, setFormData] = useState<VezneFormData>(initialFormState);
  const [isNewRecord, setIsNewRecord] = useState<boolean>(false);

  // UI / Status states
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [alertSuccess, setAlertSuccess] = useState<string | null>(null);
  const [alertError, setAlertError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [showLookupModal, setShowLookupModal] = useState<boolean>(false);

  // Load all initial data
  const loadData = async (targetIndex?: number) => {
    try {
      setIsLoading(true);
      setAlertError(null);

      const [vezneList, printerList, currencyList] = await Promise.all([
        CashDeskService.getVezneler(),
        CashDeskService.getPrinters(),
        CashDeskService.getCurrencies(),
      ]);

      setVezneler(vezneList || []);
      setPrinters(printerList || []);
      setCurrencies(currencyList || []);

      if (vezneList && vezneList.length > 0 && targetIndex !== undefined) {
        const idx = targetIndex >= 0 && targetIndex < vezneList.length
          ? targetIndex
          : 0;
        setSelectedIndex(idx);
        handleSelectVezne(vezneList[idx], idx);
      } else {
        handleClear(false);
      }
    } catch (err: any) {
      setAlertError(err.message || "Vezne tanımları yüklenirken bir hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectVezne = (vezne: VezneItem, idx?: number) => {
    setSelectedVezne(vezne);
    if (idx !== undefined) {
      setSelectedIndex(idx);
    } else {
      const foundIdx = vezneler.findIndex((v) => v.id === vezne.id);
      if (foundIdx !== -1) setSelectedIndex(foundIdx);
    }
    setIsNewRecord(false);
    setFormData({
      kod: vezne.kod,
      ad: vezne.ad,
      fisTipi: vezne.fisTipi,
      paraId: vezne.paraId,
      alisFisiYaziciId: vezne.alisFisiYaziciId,
      satisFisiYaziciId: vezne.satisFisiYaziciId,
      altinAlisFisiYaziciId: vezne.altinAlisFisiYaziciId,
      altinSatisFisiYaziciId: vezne.altinSatisFisiYaziciId,
      alisSatisIzniVar: vezne.alisSatisIzniVar,
      musteriTaniFormuYaziciId: vezne.musteriTaniFormuYaziciId,
      musteriTaniFormuYaziciVar: vezne.musteriTaniFormuYaziciVar,
    });
    setAlertError(null);
  };

  const handleClear = (showAlert: boolean = true) => {
    setSelectedVezne(null);
    setIsNewRecord(true);
    setFormData({
      ...initialFormState,
      kod: "",
      ad: "",
      fisTipi: 2,
      paraId: null,
    });
    if (showAlert) {
      setAlertSuccess("Form alanları temizlendi. Yeni bilgileri girip sol üstteki 'Kaydet' (💾) butonuna basınız.");
      setTimeout(() => setAlertSuccess(null), 3500);
    }
    setAlertError(null);
  };

  const handleNewVezne = () => {
    handleClear();
  };


  const handleNavigate = (direction: "first" | "prev" | "next" | "last") => {
    if (vezneler.length === 0) return;
    let newIdx = selectedIndex;
    if (direction === "first") newIdx = 0;
    else if (direction === "prev") newIdx = Math.max(0, selectedIndex - 1);
    else if (direction === "next") newIdx = Math.min(vezneler.length - 1, selectedIndex + 1);
    else if (direction === "last") newIdx = vezneler.length - 1;

    setSelectedIndex(newIdx);
    handleSelectVezne(vezneler[newIdx], newIdx);
  };

  const handleInputChange = (field: keyof VezneFormData, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Single handleSave handles BOTH updating existing record and inserting new record
  const handleSave = async () => {
    setAlertError(null);

    // 1. Zorunlu Alan Kontrolleri (Türkçe Uyarılar)
    if (!formData.kod || !formData.kod.trim()) {
      setAlertError("⚠️ Zorunlu Alan Eksik: Lütfen Vezne Kodunu giriniz (Maksimum 5 karakter).");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (formData.kod.trim().length > 5) {
      setAlertError("⚠️ Geçersiz Giriş: Vezne kodu en fazla 5 karakter olabilir.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (!formData.ad || !formData.ad.trim()) {
      setAlertError("⚠️ Zorunlu Alan Eksik: Lütfen Vezne Adını / Tanımını giriniz.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (!formData.fisTipi || isNaN(formData.fisTipi)) {
      setAlertError("⚠️ Zorunlu Seçim: Lütfen geçerli bir Fiş Tipi seçiniz.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    try {
      setIsSaving(true);
      setAlertError(null);

      if (isNewRecord || !selectedVezne) {
        const created = await CashDeskService.createVezne(formData);
        setAlertSuccess(`✅ "${created.ad}" [${created.kod}] veznesi veritabanına başarıyla kaydedildi.`);
        await loadData(vezneler.length);
        setIsNewRecord(false);
      } else {
        const updated = await CashDeskService.updateVezne(selectedVezne.id, formData);
        setAlertSuccess(`✅ "${updated.ad}" [${updated.kod}] vezne bilgileri başarıyla güncellendi.`);
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
    if (!selectedVezne || isNewRecord) return;
    try {
      setIsSaving(true);
      setShowDeleteModal(false);
      await CashDeskService.deleteVezne(selectedVezne.id);
      setAlertSuccess(`"${selectedVezne.ad}" veznesi başarıyla silindi.`);
      await loadData(Math.max(0, selectedIndex - 1));
      setTimeout(() => setAlertSuccess(null), 4000);
    } catch (err: any) {
      setAlertError(err.message || "Vezne silinirken bir hata oluştu.");
    } finally {
      setIsSaving(false);
    }
  };

  // Filtered vezneler list
  const filteredVezneler = vezneler.filter((v) => {
    const s = searchTerm.toLowerCase();
    return (
      v.kod.toLowerCase().includes(s) ||
      v.ad.toLowerCase().includes(s) ||
      (v.paraKodu && v.paraKodu.toLowerCase().includes(s))
    );
  });

  const handlePrint = () => {
    printReportTable<VezneItem>({
      title: "Vezne Tanımları Listesi Raporu",
      subtitle: `Aktif Vezneler Dökümü (${filteredVezneler.length} Kayıt)`,
      data: filteredVezneler,
      columns: [
        { header: "Vezne Kodu", key: "kod", width: "16%" },
        { header: "Vezne Adı", key: "ad", width: "32%" },
        { header: "Varsayılan Para", key: "paraKodu", width: "16%", align: "center" },
        {
          header: "Fiş Tipi",
          render: (item) => (item.fisTipi === 1 ? "1 - Genel Sarraf Fişi" : item.fisTipi === 2 ? "2 - Standart Vezne" : "3 - Özel Fiş"),
          width: "20%",
        },
        {
          header: "Alış/Satış İzni",
          render: (item) => (item.alisSatisIzniVar ? "İzinli" : "Kısıtlı"),
          width: "16%",
          align: "center",
        },
      ],
      summaryInfo: `Toplam Vezne Sayısı: ${filteredVezneler.length}`,
    });
  };

  return (
    <div className="p-2 p-md-3">
      {/* 1. Classic Sol Üst ERP Toolbar */}
      <ERPToolbar
        pageTitle="Vezne Tanımları"
        pageIcon={<IconBuildingStore size={20} />}
        onNew={handleNewVezne}
        onSave={handleSave}
        onSearch={() => setShowLookupModal(true)}
        onDelete={() => {
          if (selectedVezne && !isNewRecord) {
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

      {/* 2. Main Container Card */}
      <Card className="border-0 shadow-sm rounded-3 mb-4 bg-white">
        <Card.Body className="p-3 p-md-4">
          <div className="mb-3 pb-2 border-bottom d-flex align-items-center justify-content-end flex-wrap gap-2">
            <Badge bg={isNewRecord ? "warning" : "primary"} className="px-2.5 py-1.5 fs-7">
              {isNewRecord ? "Yeni Kayıt Modu" : `Düzenleme: [${formData.kod}] ${formData.ad}`}
            </Badge>
          </div>

          <div className="mx-auto" style={{ maxWidth: "850px" }}>
            <Form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
              <div className="border rounded-3 p-3 p-md-4 bg-white shadow-2xs mb-3">
                {/* Vezne Kodu - Oklu Dürbünlü Kod/Kayıt Seçici */}
                <Form.Group as={Row} className="mb-3 align-items-center">
                  <Form.Label column sm={4} md={3} className="text-secondary fw-semibold text-sm-end pe-3 mb-0">
                    Vezne Kodu <span className="text-danger">*</span> :
                  </Form.Label>
                  <Col sm={8} md={9}>
                    <CodeLookupInput
                      value={formData.kod}
                      maxLength={5}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleInputChange("kod", e.target.value)}
                      required
                      onLookupClick={() => setShowLookupModal(true)}
                      lookupTitle="Tanımlı Veznelerden Seç (Oklu Dürbün)"
                    />
                  </Col>
                </Form.Group>

                {/* Vezne Adı / Açıklaması */}
                <Form.Group as={Row} className="mb-3 align-items-center">
                  <Form.Label column sm={4} md={3} className="text-secondary fw-semibold text-sm-end pe-3 mb-0">
                    Vezne Adı <span className="text-danger">*</span> :
                  </Form.Label>
                  <Col sm={8} md={9}>
                    <Form.Control
                      type="text"
                      maxLength={200}
                      value={formData.ad}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleInputChange("ad", e.target.value)}
                      required
                    />
                  </Col>
                </Form.Group>

                {/* Fiş Tipi */}
                <Form.Group as={Row} className="mb-3 align-items-center">
                  <Form.Label column sm={4} md={3} className="text-secondary fw-semibold text-sm-end pe-3 mb-0">
                    Fiş Tipi :
                  </Form.Label>
                  <Col sm={8} md={9}>
                    <Form.Select
                      value={formData.fisTipi}
                      onChange={(e) => handleInputChange("fisTipi", parseInt(e.target.value, 10))}
                      className="fw-bold text-primary"
                    >
                      <option value={1}>1 - Standart Fiş</option>
                      <option value={2}>2 - Genel Sarraf Fişi (Varsayılan)</option>
                      <option value={3}>3 - Perakende / Tediye Fişi</option>
                    </Form.Select>
                  </Col>
                </Form.Group>

                {/* Bağlı Para Birimi */}
                <Form.Group as={Row} className="mb-3 align-items-center">
                  <Form.Label column sm={4} md={3} className="text-secondary fw-semibold text-sm-end pe-3 mb-0">
                    Para Birimi :
                  </Form.Label>
                  <Col sm={8} md={9}>
                    <Form.Select
                      value={formData.paraId || ""}
                      onChange={(e) =>
                        handleInputChange(
                          "paraId",
                          e.target.value ? parseInt(e.target.value, 10) : null
                        )
                      }
                    >
                      <option value="">Tüm Para Birimleri (Genel Vezne)</option>
                      {currencies.map((curr) => (
                        <option key={curr.id} value={curr.id}>
                          {curr.code} - {curr.name} (ID: {curr.id})
                        </option>
                      ))}
                    </Form.Select>
                  </Col>
                </Form.Group>

                {/* Alış Fişi Yazıcısı */}
                <Form.Group as={Row} className="mb-3 align-items-center">
                  <Form.Label column sm={4} md={3} className="text-secondary fw-semibold text-sm-end pe-3 mb-0">
                    Alış Fişi Yazıcısı :
                  </Form.Label>
                  <Col sm={8} md={9}>
                    <Form.Select
                      value={formData.alisFisiYaziciId || ""}
                      onChange={(e) =>
                        handleInputChange(
                          "alisFisiYaziciId",
                          e.target.value ? parseInt(e.target.value, 10) : null
                        )
                      }
                    >
                      <option value="">Tanımlı Yazıcı Yok</option>
                      {printers.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.deviceName ? `(${p.deviceName})` : ""}
                        </option>
                      ))}
                    </Form.Select>
                  </Col>
                </Form.Group>

                {/* Satış Fişi Yazıcısı */}
                <Form.Group as={Row} className="mb-3 align-items-center">
                  <Form.Label column sm={4} md={3} className="text-secondary fw-semibold text-sm-end pe-3 mb-0">
                    Satış Fişi Yazıcısı :
                  </Form.Label>
                  <Col sm={8} md={9}>
                    <Form.Select
                      value={formData.satisFisiYaziciId || ""}
                      onChange={(e) =>
                        handleInputChange(
                          "satisFisiYaziciId",
                          e.target.value ? parseInt(e.target.value, 10) : null
                        )
                      }
                    >
                      <option value="">Tanımlı Yazıcı Yok</option>
                      {printers.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.deviceName ? `(${p.deviceName})` : ""}
                        </option>
                      ))}
                    </Form.Select>
                  </Col>
                </Form.Group>

                {/* Altın Alış Fişi Yazıcısı */}
                <Form.Group as={Row} className="mb-3 align-items-center">
                  <Form.Label column sm={4} md={3} className="text-secondary fw-semibold text-sm-end pe-3 mb-0">
                    Altın Alış Yazıcısı :
                  </Form.Label>
                  <Col sm={8} md={9}>
                    <Form.Select
                      value={formData.altinAlisFisiYaziciId || ""}
                      onChange={(e) =>
                        handleInputChange(
                          "altinAlisFisiYaziciId",
                          e.target.value ? parseInt(e.target.value, 10) : null
                        )
                      }
                    >
                      <option value="">Tanımlı Yazıcı Yok</option>
                      {printers.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.deviceName ? `(${p.deviceName})` : ""}
                        </option>
                      ))}
                    </Form.Select>
                  </Col>
                </Form.Group>

                {/* Altın Satış Fişi Yazıcısı */}
                <Form.Group as={Row} className="mb-3 align-items-center">
                  <Form.Label column sm={4} md={3} className="text-secondary fw-semibold text-sm-end pe-3 mb-0">
                    Altın Satış Yazıcısı :
                  </Form.Label>
                  <Col sm={8} md={9}>
                    <Form.Select
                      value={formData.altinSatisFisiYaziciId || ""}
                      onChange={(e) =>
                        handleInputChange(
                          "altinSatisFisiYaziciId",
                          e.target.value ? parseInt(e.target.value, 10) : null
                        )
                      }
                    >
                      <option value="">Tanımlı Yazıcı Yok</option>
                      {printers.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.deviceName ? `(${p.deviceName})` : ""}
                        </option>
                      ))}
                    </Form.Select>
                  </Col>
                </Form.Group>

                {/* Alış ve Satış İşlem İzni Switch */}
                <Form.Group as={Row} className="mb-3 align-items-center">
                  <Form.Label column sm={4} md={3} className="text-secondary fw-semibold text-sm-end pe-3 mb-0">
                    Alış / Satış İzni :
                  </Form.Label>
                  <Col sm={8} md={9}>
                    <Form.Check
                      type="switch"
                      id="alisSatisIzniVar"
                      label={<span className="small text-muted">Bu vezne üzerinden fiş düzenlenebilir</span>}
                      checked={formData.alisSatisIzniVar}
                      onChange={(e) => handleInputChange("alisSatisIzniVar", e.target.checked)}
                    />
                  </Col>
                </Form.Group>

                {/* Müşteri Tanı Formu Switch */}
                <Form.Group as={Row} className="mb-2 align-items-center">
                  <Form.Label column sm={4} md={3} className="text-secondary fw-semibold text-sm-end pe-3 mb-0">
                    Müşteri Tanı Formu :
                  </Form.Label>
                  <Col sm={8} md={9}>
                    <Form.Check
                      type="switch"
                      id="musteriTaniFormuYaziciVar"
                      label={<span className="small text-muted">MASAK uyumluluğu kapsamında form çıktısı otomatik alınır</span>}
                      checked={formData.musteriTaniFormuYaziciVar}
                      onChange={(e) => handleInputChange("musteriTaniFormuYaziciVar", e.target.checked)}
                    />
                  </Col>
                </Form.Group>
              </div>
            </Form>
          </div>
        </Card.Body>
      </Card>

      {/* Dürbün Vezne Arama & Seçme Modalı (Liste Verisi Yoksa Bomboş) */}
      <LookupModal<VezneItem>
        show={showLookupModal}
        onHide={() => setShowLookupModal(false)}
        title="Vezne Tanımı Seçimi"
        searchPlaceholder="Vezne kodu veya adı ile ara..."
        items={vezneler}
        isLoading={isLoading}
        filterFn={(item, term) => {
          const t = term.toLowerCase();
          return (
            item.kod.toLowerCase().includes(t) ||
            item.ad.toLowerCase().includes(t)
          );
        }}
        columns={[
          {
            header: "Kod",
            width: "80px",
            align: "center",
            render: (v) => <span className="badge bg-light text-dark border font-monospace fw-bold">{v.kod}</span>,
          },
          {
            header: "Vezne Adı",
            render: (v) => <span className="fw-semibold text-dark">{v.ad}</span>,
          },
          {
            header: "Fiş Tipi",
            render: (v) => (v.fisTipi === 2 ? "Genel Sarraf Fişi" : v.fisTipi === 1 ? "Standart Fiş" : `Tip ${v.fisTipi}`),
          },
          {
            header: "Para Birimi",
            width: "120px",
            render: (v) => v.paraKodu || "Genel",
          },
        ]}
        onSelect={(v) => {
          const foundIdx = vezneler.findIndex((item) => item.id === v.id);
          handleSelectVezne(v, foundIdx !== -1 ? foundIdx : 0);
        }}
      />

      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="fs-5 text-danger d-flex align-items-center gap-2">
            <IconTrash size={20} /> Vezne Silme Onayı
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-2">
            <strong>[{selectedVezne?.kod}] {selectedVezne?.ad}</strong> veznesini veritabanından kalıcı olarak silmek istediğinize emin misiniz?
          </p>
          <p className="small text-danger mb-0">
            ⚠️ Bu işlem geri alınamaz. Eğer bu vezneye atanmış kullanıcılar varsa silme engellenecektir.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" size="sm" onClick={() => setShowDeleteModal(false)}>
            İptal
          </Button>
          <Button variant="danger" size="sm" onClick={handleDelete} disabled={isSaving}>
            {isSaving ? "Siliniyor..." : "Evet, Vezneyi Sil"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default CashDeskDefinitionsPage;
