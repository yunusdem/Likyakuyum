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
  Nav,
  Tab,
} from "react-bootstrap";
import {
  IconCoins,
  IconSearch,
  IconCheck,
  IconAlertCircle,
  IconTrash,
  IconAdjustments,
  IconChevronUp,
  IconChevronDown,
  IconReceipt2,
  IconReportMoney,
  IconCalculator,
} from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import CodeLookupInput from "../../components/common/CodeLookupInput";
import LookupModal from "../../components/common/LookupModal";
import { printReportTable } from "../../utils/printReport";
import {
  ProductDefinitionService,
  ProductItem,
  ProductFormData,
} from "../../services/productDefinitionService";


const initialFormState: ProductFormData = {
  kod: "",
  ad: "",
  pariteIslemi: 0,
  siraNo: "" as any,
  bagliParaKodu: null,
  gramaj: "" as any,
  hasOrani: "" as any,
  iscilik: "" as any,
  dovizAlisHucreOrani: "" as any,
  dovizSatisHucreOrani: "" as any,
  efektifAlisHucreOrani: "" as any,
  efektifSatisHucreOrani: "" as any,
  efektifAlimHesabi: null,
  efektifSatimHesabi: null,
  efektifDepoHesabi: null,
  efektifVaziyetHesabi: null,
  dovizAlimHesabi: null,
  dovizSatimHesabi: null,
  dovizDepoHesabi: null,
  dovizVaziyetHesabi: null,
  alimSatimKurFarki: "" as any,
  xmlParaKodu: null,
  muhasebeSiraNo: null,
  hasAlisKatsayisi: "" as any,
  hasSatisKatsayisi: "" as any,
  birim: 0,
  urunTipi: 0,
};

export const ProductDefinitionsPage: React.FC = () => {
  // Data states
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [formData, setFormData] = useState<ProductFormData>(initialFormState);
  const [isNewRecord, setIsNewRecord] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>("general");

  // UI / Status states
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("all");
  const [alertSuccess, setAlertSuccess] = useState<string | null>(null);
  const [alertError, setAlertError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [showLookupModal, setShowLookupModal] = useState<boolean>(false);

  // Load all products
  const loadData = async (targetIndex?: number) => {
    try {
      setIsLoading(true);
      setAlertError(null);

      const list = await ProductDefinitionService.getProducts();
      setProducts(list || []);

      if (list && list.length > 0 && targetIndex !== undefined) {
        const idx = targetIndex >= 0 && targetIndex < list.length
          ? targetIndex
          : 0;
        setSelectedIndex(idx);
        handleSelectProduct(list[idx], idx);
      } else {
        handleClear(false);
      }
    } catch (err: any) {
      setAlertError(err.message || "Ürün tanımları yüklenirken bir hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectProduct = (item: ProductItem, idx?: number) => {
    setSelectedProduct(item);
    if (idx !== undefined) {
      setSelectedIndex(idx);
    } else {
      const foundIdx = products.findIndex((p) => p.id === item.id);
      if (foundIdx !== -1) setSelectedIndex(foundIdx);
    }
    setIsNewRecord(false);
    setFormData({
      kod: item.kod,
      ad: item.ad,
      pariteIslemi: item.pariteIslemi,
      siraNo: item.siraNo,
      bagliParaKodu: item.bagliParaKodu || "",
      gramaj: item.gramaj,
      hasOrani: item.hasOrani,
      iscilik: item.iscilik,
      dovizAlisHucreOrani: item.dovizAlisHucreOrani,
      dovizSatisHucreOrani: item.dovizSatisHucreOrani,
      efektifAlisHucreOrani: item.efektifAlisHucreOrani,
      efektifSatisHucreOrani: item.efektifSatisHucreOrani,
      efektifAlimHesabi: item.efektifAlimHesabi || "",
      efektifSatimHesabi: item.efektifSatimHesabi || "",
      efektifDepoHesabi: item.efektifDepoHesabi || "",
      efektifVaziyetHesabi: item.efektifVaziyetHesabi || "",
      dovizAlimHesabi: item.dovizAlimHesabi || "",
      dovizSatimHesabi: item.dovizSatimHesabi || "",
      dovizDepoHesabi: item.dovizDepoHesabi || "",
      dovizVaziyetHesabi: item.dovizVaziyetHesabi || "",
      alimSatimKurFarki: item.alimSatimKurFarki,
      xmlParaKodu: item.xmlParaKodu || "",
      muhasebeSiraNo: item.muhasebeSiraNo,
      hasAlisKatsayisi: item.hasAlisKatsayisi,
      hasSatisKatsayisi: item.hasSatisKatsayisi,
      birim: item.birim,
      urunTipi: item.urunTipi,
    });
    setAlertError(null);
  };

  const handleClear = (showAlert: boolean = true) => {
    setSelectedProduct(null);
    setIsNewRecord(true);
    setFormData({
      ...initialFormState,
      kod: "",
      ad: "",
      siraNo: "" as any,
    });
    if (showAlert) {
      setAlertSuccess("Form alanları temizlendi. Yeni bilgileri girip sol üstteki 'Kaydet' (💾) butonuna basınız.");
      setTimeout(() => setAlertSuccess(null), 3500);
    }
    setAlertError(null);
  };

  const handleNewProduct = () => {
    handleClear();
  };

  const handleNavigate = (direction: "first" | "prev" | "next" | "last") => {
    if (products.length === 0) return;
    let newIdx = selectedIndex;
    if (direction === "first") newIdx = 0;
    else if (direction === "prev") newIdx = Math.max(0, selectedIndex - 1);
    else if (direction === "next") newIdx = Math.min(products.length - 1, selectedIndex + 1);
    else if (direction === "last") newIdx = products.length - 1;

    setSelectedIndex(newIdx);
    handleSelectProduct(products[newIdx], newIdx);
  };

  const handleInputChange = (field: keyof ProductFormData, value: any) => {
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
      setAlertError("⚠️ Zorunlu Alan Eksik: Lütfen Ürün / Para Kodunu giriniz (Maksimum 5 karakter).");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (formData.kod.trim().length > 5) {
      setAlertError("⚠️ Geçersiz Giriş: Ürün kodu en fazla 5 karakter olabilir.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (!formData.ad || !formData.ad.trim()) {
      setAlertError("⚠️ Zorunlu Alan Eksik: Lütfen Ürün / Para Tanım Adını giriniz.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const cleanSiraNo = parseInt(String(formData.siraNo), 10) || 0;
    const cleanMuhasebeSiraNo = formData.muhasebeSiraNo !== null && formData.muhasebeSiraNo !== undefined && String(formData.muhasebeSiraNo) !== ""
      ? parseInt(String(formData.muhasebeSiraNo), 10)
      : null;

    const payload: ProductFormData = {
      ...formData,
      kod: formData.kod.trim(),
      ad: formData.ad.trim(),
      siraNo: cleanSiraNo,
      gramaj: parseFloat(String(formData.gramaj)) || 0,
      hasOrani: parseFloat(String(formData.hasOrani)) || 0,
      iscilik: parseFloat(String(formData.iscilik)) || 0,
      dovizAlisHucreOrani: parseFloat(String(formData.dovizAlisHucreOrani)) || 1,
      dovizSatisHucreOrani: parseFloat(String(formData.dovizSatisHucreOrani)) || 1,
      efektifAlisHucreOrani: parseFloat(String(formData.efektifAlisHucreOrani)) || 1,
      efektifSatisHucreOrani: parseFloat(String(formData.efektifSatisHucreOrani)) || 1,
      hasAlisKatsayisi: parseFloat(String(formData.hasAlisKatsayisi)) || 0,
      hasSatisKatsayisi: parseFloat(String(formData.hasSatisKatsayisi)) || 0,
      alimSatimKurFarki: parseFloat(String(formData.alimSatimKurFarki)) || 0,
      muhasebeSiraNo: cleanMuhasebeSiraNo,
    };

    try {
      setIsSaving(true);
      setAlertError(null);

      if (isNewRecord || !selectedProduct) {
        const created = await ProductDefinitionService.createProduct(payload);
        setAlertSuccess(`✅ "${created.ad}" [${created.kod}] veritabanına başarıyla eklendi.`);
        await loadData(products.length);
        setIsNewRecord(false);
      } else {
        const updated = await ProductDefinitionService.updateProduct(selectedProduct.id, payload);
        setAlertSuccess(`✅ "${updated.ad}" [${updated.kod}] ürün bilgileri başarıyla güncellendi.`);
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
    if (!selectedProduct || isNewRecord) return;
    try {
      setIsSaving(true);
      setShowDeleteModal(false);
      await ProductDefinitionService.deleteProduct(selectedProduct.id);
      setAlertSuccess(`✅ "${selectedProduct.ad}" [${selectedProduct.kod}] ürünü başarıyla silindi.`);
      await loadData(Math.max(0, selectedIndex - 1));
      setTimeout(() => setAlertSuccess(null), 4000);
    } catch (err: any) {
      setAlertError(`❌ Silme Başarısız: ${err.message || "Ürün silinirken bir hata oluştu."}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Filtered products list
  const filteredProducts = products.filter((p) => {
    const s = searchTerm.toLowerCase();
    const matchesSearch =
      p.kod.toLowerCase().includes(s) ||
      p.ad.toLowerCase().includes(s) ||
      (p.xmlParaKodu && p.xmlParaKodu.toLowerCase().includes(s));

    if (!matchesSearch) return false;
    if (selectedTypeFilter === "all") return true;
    return p.urunTipi === parseInt(selectedTypeFilter, 10);
  });

  const handlePrint = () => {
    printReportTable<ProductItem>({
      title: "Ürün Tanımları Listesi Raporu",
      subtitle: `Aktif Ürün ve Para Tanımları Dökümü (${filteredProducts.length} Kayıt)`,
      data: filteredProducts,
      columns: [
        { header: "Sıra", key: "siraNo", width: "8%", align: "center" },
        { header: "Ürün Kodu", key: "kod", width: "14%" },
        { header: "Ürün Adı", key: "ad", width: "30%" },
        {
          header: "Gramaj",
          render: (item) => (item.gramaj ? `${item.gramaj} gr` : "-"),
          align: "right",
          width: "12%",
        },
        {
          header: "Milyem / Has Oranı",
          render: (item) => (item.hasOrani ? item.hasOrani.toFixed(4) : "-"),
          align: "right",
          width: "14%",
        },
        {
          header: "İşçilik",
          render: (item) => (item.iscilik ? item.iscilik.toFixed(2) : "-"),
          align: "right",
          width: "12%",
        },
      ],
      summaryInfo: `Toplam Ürün Sayısı: ${filteredProducts.length}`,
    });
  };

  return (
    <div className="p-2 p-md-3">
      {/* 1. Sol Üst Klasik ERP Toolbar */}
      <ERPToolbar
        pageTitle="Ürün Tanımları"
        pageIcon={<IconCoins size={20} />}
        onNew={handleNewProduct}
        onSave={handleSave}
        onSearch={() => setShowLookupModal(true)}
        onDelete={() => {
          if (selectedProduct && !isNewRecord) {
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
              {isNewRecord ? "Yeni Kayıt Modu" : `Düzenleme: [${formData.kod}] ${formData.ad}`}
            </Badge>
          </div>

          <div style={{ maxWidth: "850px" }}>
            {/* Form Tabs */}
            <Tab.Container activeKey={activeTab} onSelect={(k) => setActiveTab(k || "general")}>
              <Nav variant="pills" className="mb-4 p-1 bg-light rounded-3 gap-1">
                <Nav.Item>
                  <Nav.Link eventKey="general" className="py-1.5 px-3 small d-flex align-items-center gap-1.5">
                    <IconCoins size={16} /> Temel Bilgiler
                  </Nav.Link>
                </Nav.Item>
                <Nav.Item>
                  <Nav.Link eventKey="gold" className="py-1.5 px-3 small d-flex align-items-center gap-1.5">
                    <IconReceipt2 size={16} /> Altın & Has Parametreleri
                  </Nav.Link>
                </Nav.Item>
                <Nav.Item>
                  <Nav.Link eventKey="rates" className="py-1.5 px-3 small d-flex align-items-center gap-1.5">
                    <IconCalculator size={16} /> Hücre & Parite Oranları
                  </Nav.Link>
                </Nav.Item>
                <Nav.Item>
                  <Nav.Link eventKey="accounting" className="py-1.5 px-3 small d-flex align-items-center gap-1.5">
                    <IconReportMoney size={16} /> Muhasebe Hesap Kodları
                  </Nav.Link>
                </Nav.Item>
              </Nav>

              <Form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                <Tab.Content>
                  {/* Tab 1: General Info */}
                  <Tab.Pane eventKey="general">
                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Ürün Kodu <span className="text-danger">*</span>
                      </Form.Label>
                      <Col sm={9}>
                        <CodeLookupInput
                          value={formData.kod}
                          maxLength={5}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleInputChange("kod", e.target.value.toUpperCase())}
                          onLookupClick={() => setShowLookupModal(true)}
                          required
                          lookupTitle="Ürün Tanımı Seç (Oklu Dürbün)"
                        />
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Ürün / Para Adı <span className="text-danger">*</span>
                      </Form.Label>
                      <Col sm={9}>
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

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Sıra No
                      </Form.Label>
                      <Col sm={9}>
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
                              handleInputChange("siraNo", isNaN(parsed) ? 0 : parsed);
                            }}
                            className="fw-bold"
                          />
                          <Button
                            variant="outline-secondary"
                            className="px-2"
                            onClick={() => {
                              const current = parseInt(String(formData.siraNo), 10) || 0;
                              handleInputChange("siraNo", Math.max(0, current - 1));
                            }}
                            type="button"
                          >
                            <IconChevronDown size={15} />
                          </Button>
                          <Button
                            variant="outline-secondary"
                            className="px-2"
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

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Ürün Tipi
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Select
                          value={formData.urunTipi}
                          onChange={(e) => handleInputChange("urunTipi", parseInt(e.target.value, 10))}
                          className="fw-bold text-primary"
                        >
                          <option value={0}>0 - Döviz / Efektif / Nakit</option>
                          <option value={1}>1 - Altın / Sarrafiye / Mamul</option>
                          <option value={2}>2 - Ziynet / Takı / Mücevher</option>
                          <option value={3}>3 - Hurda Altın / Diğer</option>
                        </Form.Select>
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Birim
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Select
                          value={formData.urunTipi === 0 ? "0" : formData.birim}
                          onChange={(e) => handleInputChange("birim", parseInt(e.target.value, 10))}
                          disabled={formData.urunTipi === 0 || formData.urunTipi === 3}
                        >
                          {formData.urunTipi === 0 ? (
                            <option value={0}>Döviz / Nakit (Birim Yok)</option>
                          ) : formData.urunTipi === 3 ? (
                            <option value={0}>0 - Adet (Hurda)</option>
                          ) : (
                            <>
                              <option value={0}>0 - Adet</option>
                              <option value={1}>1 - Gram</option>
                            </>
                          )}
                        </Form.Select>
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Bağlı Para Kodu
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Control
                          type="text"
                          maxLength={5}
                          value={formData.bagliParaKodu || ""}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleInputChange("bagliParaKodu", e.target.value.toUpperCase())}
                        />
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Parite İşlemi
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Select
                          value={formData.pariteIslemi}
                          onChange={(e) => handleInputChange("pariteIslemi", parseInt(e.target.value, 10))}
                        >
                          <option value={0}>0 - Çarpma İşlemi (Standart)</option>
                          <option value={1}>1 - Bölme İşlemi (Örn: EUR/USD Parite)</option>
                        </Form.Select>
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        XML / Entegrasyon Kodu
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Control
                          type="text"
                          maxLength={20}
                          value={formData.xmlParaKodu || ""}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleInputChange("xmlParaKodu", e.target.value)}
                        />
                      </Col>
                    </Form.Group>
                  </Tab.Pane>

                  {/* Tab 2: Gold & Has Parameters */}
                  <Tab.Pane eventKey="gold">
                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Gramaj
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Control
                          type="number"
                          step="any"
                          value={formData.gramaj || ""}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleInputChange("gramaj", e.target.value)}
                        />
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Has Oranı / Milyem
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Control
                          type="number"
                          step="any"
                          value={formData.hasOrani || ""}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleInputChange("hasOrani", e.target.value)}
                        />
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        İşçilik
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Control
                          type="number"
                          step="any"
                          value={formData.iscilik || ""}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleInputChange("iscilik", e.target.value)}
                        />
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Has Alış Katsayısı
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Control
                          type="number"
                          step="any"
                          value={formData.hasAlisKatsayisi || ""}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleInputChange("hasAlisKatsayisi", e.target.value)}
                        />
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Has Satış Katsayısı
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Control
                          type="number"
                          step="any"
                          value={formData.hasSatisKatsayisi || ""}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleInputChange("hasSatisKatsayisi", e.target.value)}
                        />
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Alım Satım Kur Farkı
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Control
                          type="number"
                          step="any"
                          value={formData.alimSatimKurFarki || ""}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleInputChange("alimSatimKurFarki", e.target.value)}
                        />
                      </Col>
                    </Form.Group>
                  </Tab.Pane>

                  {/* Tab 3: Rates & Cell Ratios */}
                  <Tab.Pane eventKey="rates">
                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Döviz Alış Hücre Oranı
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Control
                          type="number"
                          step="any"
                          value={formData.dovizAlisHucreOrani || ""}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleInputChange("dovizAlisHucreOrani", e.target.value)}
                        />
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Döviz Satış Hücre Oranı
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Control
                          type="number"
                          step="any"
                          value={formData.dovizSatisHucreOrani || ""}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleInputChange("dovizSatisHucreOrani", e.target.value)}
                        />
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Efektif Alış Hücre Oranı
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Control
                          type="number"
                          step="any"
                          value={formData.efektifAlisHucreOrani || ""}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleInputChange("efektifAlisHucreOrani", e.target.value)}
                        />
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Efektif Satış Hücre Oranı
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Control
                          type="number"
                          step="any"
                          value={formData.efektifSatisHucreOrani || ""}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleInputChange("efektifSatisHucreOrani", e.target.value)}
                        />
                      </Col>
                    </Form.Group>
                  </Tab.Pane>

                  {/* Tab 4: Accounting Codes */}
                  <Tab.Pane eventKey="accounting">
                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Efektif Alım Hesabı
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Control
                          type="text"
                          maxLength={20}
                          value={formData.efektifAlimHesabi || ""}
                          onChange={(e) => handleInputChange("efektifAlimHesabi", e.target.value)}
                        />
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Efektif Satım Hesabı
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Control
                          type="text"
                          maxLength={20}
                          value={formData.efektifSatimHesabi || ""}
                          onChange={(e) => handleInputChange("efektifSatimHesabi", e.target.value)}
                        />
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Efektif Depo Hesabı
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Control
                          type="text"
                          maxLength={20}
                          value={formData.efektifDepoHesabi || ""}
                          onChange={(e) => handleInputChange("efektifDepoHesabi", e.target.value)}
                        />
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Efektif Vaziyet Hesabı
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Control
                          type="text"
                          maxLength={20}
                          value={formData.efektifVaziyetHesabi || ""}
                          onChange={(e) => handleInputChange("efektifVaziyetHesabi", e.target.value)}
                        />
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Döviz Alım Hesabı
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Control
                          type="text"
                          maxLength={20}
                          value={formData.dovizAlimHesabi || ""}
                          onChange={(e) => handleInputChange("dovizAlimHesabi", e.target.value)}
                        />
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Döviz Satım Hesabı
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Control
                          type="text"
                          maxLength={20}
                          value={formData.dovizSatimHesabi || ""}
                          onChange={(e) => handleInputChange("dovizSatimHesabi", e.target.value)}
                        />
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Döviz Depo Hesabı
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Control
                          type="text"
                          maxLength={20}
                          value={formData.dovizDepoHesabi || ""}
                          onChange={(e) => handleInputChange("dovizDepoHesabi", e.target.value)}
                        />
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Döviz Vaziyet Hesabı
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Control
                          type="text"
                          maxLength={20}
                          value={formData.dovizVaziyetHesabi || ""}
                          onChange={(e) => handleInputChange("dovizVaziyetHesabi", e.target.value)}
                        />
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Muhasebe Sıra No
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Control
                          type="number"
                          value={formData.muhasebeSiraNo ?? ""}
                          onChange={(e) => handleInputChange("muhasebeSiraNo", e.target.value ? parseInt(e.target.value, 10) : null)}
                        />
                      </Col>
                    </Form.Group>
                  </Tab.Pane>
                </Tab.Content>

                {/* Form Alt Butonları */}
                <div className="d-flex justify-content-end gap-2 pt-3 border-top mt-4">
                  <Button variant="primary" size="sm" type="submit" disabled={isSaving}>
                    {isSaving ? "Kaydediliyor..." : isNewRecord ? "Yeni Ürün Kaydet" : "Değişiklikleri Güncelle"}
                  </Button>
                </div>
              </Form>
            </Tab.Container>
          </div>
        </Card.Body>
      </Card>

      {/* Oklu Dürbün - Arama & Seçim Modalı */}
      <LookupModal<ProductItem>
        show={showLookupModal}
        onHide={() => setShowLookupModal(false)}
        title="Ürün Tanımı Seç"
        items={products}
        searchPlaceholder="Ürün kodu veya adı ile ara..."
        filterFn={(item, term) =>
          item.kod.toLowerCase().includes(term.toLowerCase()) ||
          item.ad.toLowerCase().includes(term.toLowerCase()) ||
          (item.xmlParaKodu ? item.xmlParaKodu.toLowerCase().includes(term.toLowerCase()) : false)
        }
        columns={[
          {
            header: "Kod",
            render: (item) => <strong className="text-primary font-monospace">{item.kod}</strong>,
          },
          {
            header: "Ürün Adı",
            render: (item) => item.ad,
          },
          {
            header: "Tip",
            render: (item) => (
              <Badge
                bg={
                  item.urunTipi === 1
                    ? "warning"
                    : item.urunTipi === 0
                    ? "info"
                    : "secondary"
                }
              >
                {item.urunTipi === 0
                  ? "Döviz"
                  : item.urunTipi === 1
                  ? "Altın"
                  : item.urunTipi === 2
                  ? "Ziynet"
                  : "Hurda"}
              </Badge>
            ),
          },
          {
            header: "Milyem / Has",
            render: (item) => (item.hasOrani > 0 ? item.hasOrani.toFixed(4) : "-"),
            align: "right",
          },
          {
            header: "Gramaj",
            render: (item) => (item.gramaj > 0 ? `${item.gramaj} gr` : "-"),
            align: "right",
          },
        ]}
        onSelect={(item) => {
          handleSelectProduct(item);
        }}
      />

      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="fs-5 text-danger d-flex align-items-center gap-2">
            <IconTrash size={20} /> Ürün Silme Onayı
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-2">
            <strong>[{selectedProduct?.kod}] {selectedProduct?.ad}</strong> ürününü veritabanından kalıcı olarak silmek istediğinize emin misiniz?
          </p>
          <p className="small text-danger mb-0">
            ⚠️ Bu işlem geri alınamaz. Eğer bu ürüne ait vezne tanımları veya banknotlar varsa silme işlemi engellenecektir.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" size="sm" onClick={() => setShowDeleteModal(false)}>
            İptal
          </Button>
          <Button variant="danger" size="sm" onClick={handleDelete} disabled={isSaving}>
            {isSaving ? "Siliniyor..." : "Evet, Ürünü Sil"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ProductDefinitionsPage;
