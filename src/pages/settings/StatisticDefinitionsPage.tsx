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
  IconChartBar,
  IconSearch,
  IconCheck,
  IconAlertCircle,
  IconTrash,
  IconAdjustments,
  IconChevronUp,
  IconChevronDown,
  IconReceipt2,
  IconReportMoney,
  IconCreditCard,
} from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import CodeLookupInput from "../../components/common/CodeLookupInput";
import LookupModal from "../../components/common/LookupModal";
import { printReportTable } from "../../utils/printReport";
import {
  StatisticService,
  StatisticItem,
  StatisticFormData,
} from "../../services/statisticService";

const initialFormState: StatisticFormData = {
  kod: "",
  aciklama: "",
  fisTipi: 0,
  komisyonOrani: "" as any,
  bmvOrani: "" as any,
  fisDizaynTipi: 0,
  belgeNoUretmeSekli: 0,
  ciktiSatirSayisi: "" as any,
  f1Tusu: "" as any,
  odemeSekliVar: false,
  odemeSekli: null,
  muhHesapId: null,
  efektifDepoHesapId: null,
  efektifVaziyetHesapId: null,
  kmvOrani: "" as any,
  komisyonYetkisi: true,
};

export const StatisticDefinitionsPage: React.FC = () => {
  const activeDb = localStorage.getItem("kuyumcu_erp_active_db") || "R2016_dvz";
  const activeServer = localStorage.getItem("kuyumcu_erp_active_server") || "localhost";

  // Data states
  const [statistics, setStatistics] = useState<StatisticItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [selectedStatistic, setSelectedStatistic] = useState<StatisticItem | null>(null);
  const [formData, setFormData] = useState<StatisticFormData>(initialFormState);
  const [isNewRecord, setIsNewRecord] = useState<boolean>(false);

  // UI / Status states
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedFisTipiFilter, setSelectedFisTipiFilter] = useState<string>("all");
  const [alertSuccess, setAlertSuccess] = useState<string | null>(null);
  const [alertError, setAlertError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [showLookupModal, setShowLookupModal] = useState<boolean>(false);

  // Load all statistics
  const loadData = async (targetIndex?: number) => {
    try {
      setIsLoading(true);
      setAlertError(null);

      const list = await StatisticService.getStatistics();
      setStatistics(list || []);

      if (list && list.length > 0 && targetIndex !== undefined) {
        const idx = targetIndex >= 0 && targetIndex < list.length
          ? targetIndex
          : 0;
        setSelectedIndex(idx);
        handleSelectStatistic(list[idx], idx);
      } else {
        handleClear(false);
      }
    } catch (err: any) {
      setAlertError(err.message || "İstatistik tanımları yüklenirken bir hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectStatistic = (item: StatisticItem, idx?: number) => {
    setSelectedStatistic(item);
    if (idx !== undefined) {
      setSelectedIndex(idx);
    } else {
      const foundIdx = statistics.findIndex((s) => s.id === item.id);
      if (foundIdx !== -1) setSelectedIndex(foundIdx);
    }
    setIsNewRecord(false);
    setFormData({
      kod: item.kod,
      aciklama: item.aciklama,
      fisTipi: item.fisTipi,
      komisyonOrani: item.komisyonOrani,
      bmvOrani: item.bmvOrani,
      fisDizaynTipi: item.fisDizaynTipi,
      belgeNoUretmeSekli: item.belgeNoUretmeSekli,
      ciktiSatirSayisi: item.ciktiSatirSayisi,
      f1Tusu: item.f1Tusu,
      odemeSekliVar: item.odemeSekliVar,
      odemeSekli: item.odemeSekli,
      muhHesapId: item.muhHesapId,
      efektifDepoHesapId: item.efektifDepoHesapId,
      efektifVaziyetHesapId: item.efektifVaziyetHesapId,
      kmvOrani: item.kmvOrani,
      komisyonYetkisi: item.komisyonYetkisi,
    });
    setAlertError(null);
  };

  const handleClear = (showAlert: boolean = true) => {
    setSelectedStatistic(null);
    setIsNewRecord(true);
    setFormData({
      ...initialFormState,
      kod: "",
      aciklama: "",
    });
    if (showAlert) {
      setAlertSuccess("Form alanları temizlendi. Yeni bilgileri girip sol üstteki 'Kaydet' (💾) butonuna basınız.");
      setTimeout(() => setAlertSuccess(null), 3500);
    }
    setAlertError(null);
  };

  const handleNewStatistic = () => {
    handleClear();
  };

  const handleNavigate = (direction: "first" | "prev" | "next" | "last") => {
    if (statistics.length === 0) return;
    let newIdx = selectedIndex;
    if (direction === "first") newIdx = 0;
    else if (direction === "prev") newIdx = Math.max(0, selectedIndex - 1);
    else if (direction === "next") newIdx = Math.min(statistics.length - 1, selectedIndex + 1);
    else if (direction === "last") newIdx = statistics.length - 1;

    setSelectedIndex(newIdx);
    handleSelectStatistic(statistics[newIdx], newIdx);
  };

  const handleInputChange = (field: keyof StatisticFormData, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Unified save handler for creating new and updating existing records
  const handleSave = async () => {
    setAlertError(null);

    // 1. Türkçe Zorunlu Alan Doğrulamaları
    if (!formData.kod || !formData.kod.trim()) {
      setAlertError("⚠️ Zorunlu Alan Eksik: Lütfen İstatistik Kodunu giriniz (Maksimum 20 karakter).");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (formData.kod.trim().length > 20) {
      setAlertError("⚠️ Geçersiz Giriş: İstatistik kodu en fazla 20 karakter olabilir.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (!formData.aciklama || !formData.aciklama.trim()) {
      setAlertError("⚠️ Zorunlu Alan Eksik: Lütfen İstatistik Açıklamasını giriniz.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const payload: StatisticFormData = {
      ...formData,
      kod: formData.kod.trim(),
      aciklama: formData.aciklama.trim(),
      fisTipi: parseInt(String(formData.fisTipi), 10) || 0,
      komisyonOrani: parseFloat(String(formData.komisyonOrani)) || 0,
      bmvOrani: parseFloat(String(formData.bmvOrani)) || 0,
      fisDizaynTipi: parseInt(String(formData.fisDizaynTipi), 10) || 0,
      belgeNoUretmeSekli: parseInt(String(formData.belgeNoUretmeSekli), 10) || 0,
      ciktiSatirSayisi: Math.max(1, parseInt(String(formData.ciktiSatirSayisi), 10) || 1),
      f1Tusu: parseInt(String(formData.f1Tusu), 10) || 0,
      odemeSekliVar: !!formData.odemeSekliVar,
      odemeSekli: formData.odemeSekliVar && formData.odemeSekli !== null ? parseInt(String(formData.odemeSekli), 10) : null,
      muhHesapId: formData.muhHesapId !== null && formData.muhHesapId !== undefined && String(formData.muhHesapId) !== "" ? parseInt(String(formData.muhHesapId), 10) : null,
      efektifDepoHesapId: formData.efektifDepoHesapId !== null && formData.efektifDepoHesapId !== undefined && String(formData.efektifDepoHesapId) !== "" ? parseInt(String(formData.efektifDepoHesapId), 10) : null,
      efektifVaziyetHesapId: formData.efektifVaziyetHesapId !== null && formData.efektifVaziyetHesapId !== undefined && String(formData.efektifVaziyetHesapId) !== "" ? parseInt(String(formData.efektifVaziyetHesapId), 10) : null,
      kmvOrani: parseFloat(String(formData.kmvOrani)) || 0,
      komisyonYetkisi: formData.komisyonYetkisi !== false,
    };

    try {
      setIsSaving(true);
      setAlertError(null);

      if (isNewRecord || !selectedStatistic) {
        const created = await StatisticService.createStatistic(payload);
        setAlertSuccess(`✅ "${created.aciklama}" [${created.kod}] istatistik tanımı başarıyla eklendi.`);
        await loadData(statistics.length);
        setIsNewRecord(false);
      } else {
        const updated = await StatisticService.updateStatistic(selectedStatistic.id, payload);
        setAlertSuccess(`✅ "${updated.aciklama}" [${updated.kod}] istatistik bilgileri başarıyla güncellendi.`);
        await loadData(selectedIndex);
      }

      setTimeout(() => setAlertSuccess(null), 4500);
    } catch (err: any) {
      setAlertError(`❌ Kaydetme Başarısız: ${err.message || "İşlem sırasında bir hata oluştu."}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedStatistic || isNewRecord) return;
    try {
      setIsSaving(true);
      setShowDeleteModal(false);
      await StatisticService.deleteStatistic(selectedStatistic.id);
      setAlertSuccess(`✅ "${selectedStatistic.aciklama}" [${selectedStatistic.kod}] istatistik tanımı başarıyla silindi.`);
      await loadData(Math.max(0, selectedIndex - 1));
      setTimeout(() => setAlertSuccess(null), 4000);
    } catch (err: any) {
      setAlertError(`❌ Silme Başarısız: ${err.message || "İstatistik tanımı silinirken bir hata oluştu."}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Filtered statistics list
  const filteredStatistics = statistics.filter((s) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      s.kod.toLowerCase().includes(term) ||
      s.aciklama.toLowerCase().includes(term);

    if (!matchesSearch) return false;
    if (selectedFisTipiFilter === "all") return true;
    return s.fisTipi === parseInt(selectedFisTipiFilter, 10);
  });

  const handlePrint = () => {
    printReportTable<StatisticItem>({
      title: "İstatistik Tanımları Listesi Raporu",
      subtitle: `Aktif İstatistik ve İşlem Kodları Dökümü (${filteredStatistics.length} Kayıt)`,
      data: filteredStatistics,
      columns: [
        { header: "İstatistik Kodu", key: "kod", width: "16%" },
        { header: "Açıklama", key: "aciklama", width: "34%" },
        {
          header: "Fiş Tipi",
          render: (item) => (item.fisTipi === 1 ? "1 - Sarraf Fişi" : item.fisTipi === 2 ? "2 - Perakende Fişi" : "0 - Genel"),
          width: "20%",
        },
        {
          header: "Komisyon",
          render: (item) => (item.komisyonOrani ? `%${item.komisyonOrani}` : "-"),
          width: "20%",
          align: "right",
        },
      ],
      summaryInfo: `Toplam İstatistik Tanımı Sayısı: ${filteredStatistics.length}`,
    });
  };


  return (
    <div className="p-2 p-md-3">
      {/* 1. Sol Üst Klasik ERP Toolbar */}
      <ERPToolbar
        pageTitle="İstatistik Tanımları"
        pageIcon={<IconChartBar size={20} />}
        onNew={handleNewStatistic}
        onSave={handleSave}
        onSearch={() => setShowLookupModal(true)}
        onDelete={() => {
          if (selectedStatistic && !isNewRecord) {
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
              {isNewRecord ? "Yeni Kayıt Modu" : `Düzenleme: [${formData.kod}] ${formData.aciklama}`}
            </Badge>
          </div>

          <div style={{ maxWidth: "850px" }}>
            <Form onSubmit={handleSave}>
              {/* 1. Temel Tanımlar */}
              <div className="mb-4 pb-3 border-bottom">
                <h6 className="fw-bold text-primary mb-3 d-flex align-items-center gap-1.5 small text-uppercase">
                  <IconAdjustments size={16} /> Temel Bilgiler
                </h6>

                <Form.Group as={Row} className="mb-3 align-items-center">
                  <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                    İstatistik Kodu <span className="text-danger">*</span>
                  </Form.Label>
                  <Col sm={9}>
                    <CodeLookupInput
                      value={formData.kod}
                      onChange={(e) => handleInputChange("kod", e.target.value.toUpperCase())}
                      onLookupClick={() => setShowLookupModal(true)}
                      required
                      lookupTitle="İstatistik Tanımı Seç (Oklu Dürbün)"
                    />
                  </Col>
                </Form.Group>

                <Form.Group as={Row} className="mb-3 align-items-center">
                  <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                    Açıklama <span className="text-danger">*</span>
                  </Form.Label>
                  <Col sm={9}>
                    <Form.Control
                      type="text"
                      value={formData.aciklama}
                      onChange={(e) => handleInputChange("aciklama", e.target.value)}
                      required
                    />
                  </Col>
                </Form.Group>

                <Form.Group as={Row} className="mb-3 align-items-center">
                  <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                    Fiş Tipi
                  </Form.Label>
                  <Col sm={9}>
                    <Form.Select
                      value={formData.fisTipi}
                      onChange={(e) => handleInputChange("fisTipi", parseInt(e.target.value, 10))}
                    >
                      <option value={0}>0 - Tahsilat Fişi</option>
                      <option value={1}>1 - Tediye Fişi</option>
                      <option value={2}>2 - Giriş Fişi</option>
                      <option value={3}>3 - Çıkış Fişi</option>
                      <option value={4}>4 - Virman Fişi</option>
                      <option value={5}>5 - Açılış Fişi</option>
                    </Form.Select>
                  </Col>
                </Form.Group>

                <Form.Group as={Row} className="mb-3 align-items-center">
                  <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                    Fiş Dizayn Tipi
                  </Form.Label>
                  <Col sm={9}>
                    <Form.Select
                      value={formData.fisDizaynTipi}
                      onChange={(e) => handleInputChange("fisDizaynTipi", parseInt(e.target.value, 10))}
                    >
                      <option value={0}>0 - Standart Dizayn</option>
                      <option value={1}>1 - Özel Dizayn 1</option>
                      <option value={2}>2 - Özel Dizayn 2</option>
                    </Form.Select>
                  </Col>
                </Form.Group>

                <Form.Group as={Row} className="mb-3 align-items-center">
                  <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                    Belge No Üretme Şekli
                  </Form.Label>
                  <Col sm={9}>
                    <Form.Select
                      value={formData.belgeNoUretmeSekli}
                      onChange={(e) => handleInputChange("belgeNoUretmeSekli", parseInt(e.target.value, 10))}
                    >
                      <option value={0}>0 - Otomatik Artan</option>
                      <option value={1}>1 - Manuel Giriş</option>
                      <option value={2}>2 - Şablondan Üret</option>
                    </Form.Select>
                  </Col>
                </Form.Group>

                <Form.Group as={Row} className="mb-3 align-items-center">
                  <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                    Çıktı Satır Sayısı
                  </Form.Label>
                  <Col sm={9}>
                    <Form.Control
                      type="number"
                      value={formData.ciktiSatirSayisi || ""}
                      onChange={(e) => handleInputChange("ciktiSatirSayisi", parseInt(e.target.value, 10) || 1)}
                      min={1}
                      max={100}
                    />
                  </Col>
                </Form.Group>

                <Form.Group as={Row} className="mb-3 align-items-center">
                  <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                    F1 Kısayol Tuşu
                  </Form.Label>
                  <Col sm={9}>
                    <Form.Control
                      type="number"
                      value={formData.f1Tusu}
                      onChange={(e) => handleInputChange("f1Tusu", parseInt(e.target.value, 10) || 0)}
                    />
                  </Col>
                </Form.Group>
              </div>

              {/* 2. Finansal & Vergisel Parametreler */}
              <div className="mb-4 pb-3 border-bottom">
                <h6 className="fw-bold text-primary mb-3 d-flex align-items-center gap-1.5 small text-uppercase">
                  <IconReportMoney size={16} /> Finansal & Vergisel Parametreler
                </h6>

                <Form.Group as={Row} className="mb-3 align-items-center">
                  <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                    Komisyon Oranı (%)
                  </Form.Label>
                  <Col sm={9}>
                    <Form.Control
                      type="number"
                      step="any"
                      value={formData.komisyonOrani || ""}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleInputChange("komisyonOrani", e.target.value)}
                    />
                  </Col>
                </Form.Group>

                <Form.Group as={Row} className="mb-3 align-items-center">
                  <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                    BMV Oranı (%)
                  </Form.Label>
                  <Col sm={9}>
                    <Form.Control
                      type="number"
                      step="any"
                      value={formData.bmvOrani || ""}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleInputChange("bmvOrani", e.target.value)}
                    />
                  </Col>
                </Form.Group>

                <Form.Group as={Row} className="mb-3 align-items-center">
                  <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                    KMV Oranı (%)
                  </Form.Label>
                  <Col sm={9}>
                    <Form.Control
                      type="number"
                      step="any"
                      value={formData.kmvOrani || ""}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleInputChange("kmvOrani", e.target.value)}
                    />
                  </Col>
                </Form.Group>

                <Form.Group as={Row} className="mb-3 align-items-center">
                  <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                    Komisyon Yetkisi
                  </Form.Label>
                  <Col sm={9}>
                    <Form.Check
                      type="switch"
                      id="komisyon-yetkisi-switch"
                      label="Komisyon yetkisi aktif"
                      checked={formData.komisyonYetkisi}
                      onChange={(e) => handleInputChange("komisyonYetkisi", e.target.checked)}
                    />
                  </Col>
                </Form.Group>
              </div>

              {/* 3. Ödeme & Muhasebe Yapılandırması */}
              <div className="mb-4">
                <h6 className="fw-bold text-primary mb-3 d-flex align-items-center gap-1.5 small text-uppercase">
                  <IconCreditCard size={16} /> Ödeme Şekli & Muhasebe Bağlantıları
                </h6>

                <Form.Group as={Row} className="mb-3 align-items-center">
                  <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                    Ödeme Şekli Tanımlı
                  </Form.Label>
                  <Col sm={9}>
                    <Form.Check
                      type="switch"
                      id="odeme-sekli-var-switch"
                      label="Ödeme Şekli Tanımlı"
                      checked={formData.odemeSekliVar}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        handleInputChange("odemeSekliVar", checked);
                        if (!checked) handleInputChange("odemeSekli", null);
                        else if (formData.odemeSekli === null) handleInputChange("odemeSekli", 0);
                      }}
                    />
                  </Col>
                </Form.Group>

                <Form.Group as={Row} className="mb-3 align-items-center">
                  <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                    Ödeme Şekli
                  </Form.Label>
                  <Col sm={9}>
                    <Form.Select
                      value={formData.odemeSekli ?? ""}
                      onChange={(e) => handleInputChange("odemeSekli", e.target.value !== "" ? parseInt(e.target.value, 10) : null)}
                      disabled={!formData.odemeSekliVar}
                    >
                      <option value="">Seçilmedi</option>
                      <option value={0}>0 - Nakit</option>
                      <option value={1}>1 - Kredi Kartı / POS</option>
                      <option value={2}>2 - Havale / EFT</option>
                      <option value={3}>3 - Çek / Senet</option>
                    </Form.Select>
                  </Col>
                </Form.Group>

                <Form.Group as={Row} className="mb-3 align-items-center">
                  <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                    Muhasebe Hesap ID
                  </Form.Label>
                  <Col sm={9}>
                    <Form.Control
                      type="number"
                      value={formData.muhHesapId ?? ""}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleInputChange("muhHesapId", e.target.value ? parseInt(e.target.value, 10) : null)}
                    />
                  </Col>
                </Form.Group>

                <Form.Group as={Row} className="mb-3 align-items-center">
                  <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                    Efektif Depo Hesap ID
                  </Form.Label>
                  <Col sm={9}>
                    <Form.Control
                      type="number"
                      value={formData.efektifDepoHesapId ?? ""}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleInputChange("efektifDepoHesapId", e.target.value ? parseInt(e.target.value, 10) : null)}
                    />
                  </Col>
                </Form.Group>

                <Form.Group as={Row} className="mb-3 align-items-center">
                  <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                    Efektif Vaziyet Hesap ID
                  </Form.Label>
                  <Col sm={9}>
                    <Form.Control
                      type="number"
                      value={formData.efektifVaziyetHesapId ?? ""}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleInputChange("efektifVaziyetHesapId", e.target.value ? parseInt(e.target.value, 10) : null)}
                    />
                  </Col>
                </Form.Group>
              </div>

              {/* Form Alt Butonları */}
              <div className="d-flex justify-content-end gap-2 pt-3 border-top">
                <Button variant="primary" size="sm" type="submit" disabled={isSaving}>
                  {isSaving ? "Kaydediliyor..." : isNewRecord ? "Yeni Tanım Kaydet" : "Değişiklikleri Güncelle"}
                </Button>
              </div>
            </Form>
          </div>
        </Card.Body>
      </Card>

      {/* Oklu Dürbün - Arama & Seçim Modalı */}
      <LookupModal<StatisticItem>
        show={showLookupModal}
        onHide={() => setShowLookupModal(false)}
        title="İstatistik Tanımı Seç"
        items={statistics}
        searchPlaceholder="İstatistik kodu veya açıklama ile ara..."
        filterFn={(item, term) =>
          item.kod.toLowerCase().includes(term.toLowerCase()) ||
          item.aciklama.toLowerCase().includes(term.toLowerCase())
        }
        columns={[
          {
            header: "İstatistik Kodu",
            render: (item) => <strong className="text-primary font-monospace">{item.kod}</strong>,
          },
          {
            header: "Açıklama",
            render: (item) => item.aciklama,
          },
          {
            header: "Fiş Tipi",
            render: (item) => <Badge bg="light" className="text-dark border">{item.fisTipi}</Badge>,
          },
        ]}
        onSelect={(item) => {
          handleSelectStatistic(item);
        }}
      />

      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="fs-5 text-danger d-flex align-items-center gap-2">
            <IconTrash size={20} /> İstatistik Tanımı Silme Onayı
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-2">
            <strong>[{selectedStatistic?.kod}] {selectedStatistic?.aciklama}</strong> istatistik tanımını veritabanından kalıcı olarak silmek istediğinize emin misiniz?
          </p>
          <p className="small text-danger mb-0">
            ⚠️ Bu işlem geri alınamaz.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" size="sm" onClick={() => setShowDeleteModal(false)}>
            İptal
          </Button>
          <Button variant="danger" size="sm" onClick={handleDelete} disabled={isSaving}>
            {isSaving ? "Siliniyor..." : "Evet, Tanımı Sil"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default StatisticDefinitionsPage;
