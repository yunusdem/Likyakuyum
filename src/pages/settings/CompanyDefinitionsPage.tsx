import React, { useState, useEffect } from "react";
import {
  Card,
  Row,
  Col,
  Nav,
  Tab,
  Form,
  Button,
  Badge,
  Alert,
  InputGroup,
  Spinner,
} from "react-bootstrap";
import {
  IconBuilding,
  IconCheck,
  IconBuildingStore,
  IconCoin,
  IconReceipt2,
  IconScale,
  IconShieldLock,
  IconAdjustments,
  IconDatabase,
  IconServer,
  IconAlertCircle,
  IconRefresh,
  IconDeviceFloppy,
  IconFileCertificate,
  IconCode,
} from "@tabler/icons-react";

import ERPToolbar from "components/common/ERPToolbar";
import { printReportTable } from "../../utils/printReport";
import { CompanyService, TodvzTanimDto, defaultCompanyTanim } from "../../services/companyService";

export const CompanyDefinitionsPage: React.FC = () => {
  const activeDb = localStorage.getItem("kuyumcu_erp_active_db") || "R2016_dvz";
  const activeServer = localStorage.getItem("kuyumcu_erp_active_server") || "localhost";

const emptyCompanyData: TodvzTanimDto = {
  FIRMA_ADI: "",
  SUBE_KODU: "",
  SUBE_ADI: "",
  VERGI_DAIRESI_ID: null,
  VERGI_KIMLIK_NO: "",
  TICARET_SICIL_NO: "",
  MERSIS_NO: "",
  ADRES: "",
  POSTA_KODU_ID: null,
  ILCE_ID: null,
  IL_ID: null,
  ULKE_ID: null,
  TELEFON: "",
  EPOSTA: "",
  WEB_ADRESI: "",
  DOSYA_NO: "",
  USD_PARA_ID: undefined,
  EUR_PARA_ID: undefined,
  RAPOR_PARA_ID: undefined,
  TL_KURUS_SAYISI: undefined,
  DOVIZ_KURUS_SAYISI: undefined,
  KUR_KURUS_SAYISI: undefined,
  GRAM_ONDALIK_SAYISI: undefined,
  CARI_TL_TOLERANSI: null,
  CARI_USD_TOLERANSI: null,
  DOVIZ_VERGI_SINIRI: null,
  DOVIZ_VERGI_SINIRI_PARA_ID: null,
  ALTIN_VERGI_SINIRI: null,
  ALTIN_VERGI_SINIRI_PARA_ID: null,
  TL_VERGI_SINIRI: null,
  SERMAYE_HESABI_ID: null,
  BELGE_DIZINI: "",
  CARI_KOD_SIRA_NO: null,
  CARI_KOD_BASINA_SIFIR: false,
  FIS_NO_BASINA_SIFIR: false,
  DOVIZ_ALIS_DVZ_SATIS_ORANI: undefined,
  EFEKTIF_ALIS_DVZ_SATIS_ORANI: undefined,
  EFEKTIF_SATIS_DVZ_SATIS_ORANI: undefined,
  ALIS_ISTATISTIK_ID: null,
  SATIS_ISTATISTIK_ID: null,
  ARBITRAJ_ALIS_ISTATISTIK_ID: null,
  ARBITRAJ_SATIS_ISTATISTIK_ID: null,
  SATISIN_DAYANAGI: "",
  FISTE_COKLU_SATIR: false,
  TL_YUVARLAMA_ARALIGI: null,
  TL_YUVARLAMA_ESIGI: null,
  TAZELEME_SURESI: undefined,
  EKRANDAKI_VEZNE_SAYISI: undefined,
  KASA_HESABI: "",
  KOMISYON_HESABI: "",
  BMV_HESABI: "",
  KMV_HESABI: "",
  KMV_GIDER_HESABI: "",
  KAMBIYO_KAR_HESABI: "",
  KAMBIYO_ZARAR_HESABI: "",
  BELGE_YAZICI_MODU: null,
  KUR_TEXT_DOSYASI: "",
  HESAP_YILI: undefined,
  CARI_DEKONT_ISLEM_CINSI: null,
  DIGER_VERITABANI_ADI: "",
  ORTAK_ALAN: false,
  FISLERI_AKTARILACAK_ALAN: false,
  CARI_KAYIT_BILGI_SILME: false,
  FAVORI_PARA_ID: null,
  TOPLAMDA_PARA_KODU: false,
  DEVIR_ALANI: "",
  FISTE_SAAT_CIKMASIN: false,
  DEVIR_ALANI2: "",
  IKINCI_PANO_DZG: "",
  DONEM_ONAY_TARIHI: null,
  DONEM_ONAY_GUN_SAYISI: null,
  ISCILIK_GIRIS_SEKLI: null,
  YEDEK_KLASORU: "",
  E_DEFTER_MUKELLEFI: false,
  DIG_CSV_DIZINI: "",
  DEGISIKLIK_TAKIP_SIFRESI: "",
  DEFAULT_KUR_KAYNAGI: null,
  VERGI_SINIRI_ASILINCA_YASAKLA: false,
  VADELI_ISLEM_CINSI: null,
  HAS_ALTIN_PARA_ID: null,
  ISCILIK_FIYATA_DAHIL: false,
  ISCILIK_HESABI: "",
  KDV_GELIR_HESABI: "",
  KDV_GIDER_HESABI: "",
  MERKEZ_BANKASI_KURUNU_AL: false,
  FISDE_KUR_TURU_DEGISEBILIR: false,
  FOREKS_KUR_DOSYA_ADI: "",
  FOREKS_KUR_VEZNE_ID: null,
  FOREKS_KUR_YENILEME_SURESI: null,
  FOREKS_KUR_BASAMAK_SAYISI: null,
  ENTEGRATOR_YANIT_VERME_SURESI: null,
  E_BELGE_SERVER_IP: "",
  E_BELGE_SERVER_PORTU: null,
  XSLT_DOSYALARI_KOPYALANSIN: false,
  RPT_DOSYALARI_KOPYALANSIN: false,
  E_DOVIZ_FIS_BASILSIN: false,
  CARI_DEKONT_KUR_CINSI: null,
  XSLT_DIZINI: "",
};

  const [formData, setFormData] = useState<TodvzTanimDto>(emptyCompanyData);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [alertSuccess, setAlertSuccess] = useState<string | null>(null);
  const [alertError, setAlertError] = useState<string | null>(null);

  // Load Company Definitions from Active MSSQL DB (Yenile butonuna tıklandığında yükler)
  const loadDefinitions = async (forceLoad: boolean = true) => {
    try {
      setIsLoading(true);
      setAlertError(null);
      if (forceLoad) {
        const data = await CompanyService.getDefinitions();
        setFormData(data || emptyCompanyData);
      } else {
        setFormData(emptyCompanyData);
      }
    } catch (err: any) {
      setAlertError(err.message || "Firma tanımları yüklenirken bir hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Sayfa ilk açıldığında bomboş
    setFormData(emptyCompanyData);
    setIsLoading(false);
  }, []);

  const handleChange = (field: keyof TodvzTanimDto, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      setIsSaving(true);
      setAlertError(null);
      const updated = await CompanyService.updateDefinitions(formData);
      setFormData(updated || formData);
      setAlertSuccess("Firma tanımları ve genel parametreler başarıyla kaydedildi.");
      setTimeout(() => setAlertSuccess(null), 4000);
    } catch (err: any) {
      setAlertError(err.message || "Firma tanımları kaydedilirken bir hata oluştu.");
      setTimeout(() => setAlertError(null), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    printReportTable({
      title: "Firma ve Sistem Tanımları Raporu",
      subtitle: `${formData.FIRMA_ADI || "Firma Bilgileri"} Sistem Ayarları`,
      data: [
        { alan: "Firma Adı", deger: formData.FIRMA_ADI || "-" },
        { alan: "Şube Adı / Kodu", deger: `${formData.SUBE_ADI || "-"} (${formData.SUBE_KODU || "-"})` },
        { alan: "Vergi Dairesi ID / VKN", deger: `${formData.VERGI_DAIRESI_ID || "-"} / ${formData.VERGI_KIMLIK_NO || "-"}` },
        { alan: "Telefon", deger: formData.TELEFON || "-" },
        { alan: "Adres", deger: formData.ADRES || "-" },
        { alan: "Belge Dizini", deger: formData.BELGE_DIZINI || "-" },
        { alan: "Sistem Sürümü", deger: formData.SURUM || "-" },
      ],
      columns: [
        { header: "Tanım / Parametre Alanı", key: "alan", width: "40%" },
        { header: "Kayıtlı Sistem Değeri", key: "deger", width: "60%" },
      ],
      summaryInfo: "Firma Genel Yapılandırma Bilgileri",
    });
  };



  return (
    <div className="company-definitions-container pb-5">
      {/* 1. Üst ERP Aksiyon Şeridi (Ribbon Toolbar) */}
      <ERPToolbar
        onSave={() => handleSave()}
        onRefresh={() => loadDefinitions()}
        onPrint={handlePrint}
        disabled={isLoading || isSaving}
      />


      {/* Alert Messages */}
      {alertSuccess && (
        <Alert
          variant="success"
          dismissible
          onClose={() => setAlertSuccess(null)}
          className="d-flex align-items-center gap-2 py-2 shadow-sm rounded-3 mb-3"
        >
          <IconCheck size={20} className="text-success" />
          <span className="fw-medium">{alertSuccess}</span>
        </Alert>
      )}

      {alertError && (
        <Alert
          variant="danger"
          dismissible
          onClose={() => setAlertError(null)}
          className="d-flex align-items-center gap-2 py-2 shadow-sm rounded-3 mb-3"
        >
          <IconAlertCircle size={20} className="text-danger" />
          <span className="fw-medium">{alertError}</span>
        </Alert>
      )}



      {/* Main Tabs Container */}
      <Tab.Container defaultActiveKey="genel">
        <Card className="border shadow-sm rounded-3 bg-white overflow-hidden">
          <Card.Header className="bg-light-subtle p-0 border-bottom">
            <Nav variant="tabs" className="px-3 pt-2 border-0 flex-nowrap overflow-x-auto text-nowrap">
              <Nav.Item>
                <Nav.Link eventKey="genel" className="d-flex align-items-center gap-2 py-2.5 px-3 fw-semibold">
                  <IconBuildingStore size={17} className="text-primary" />
                  <span>1. Genel & Firma Bilgileri</span>
                </Nav.Link>
              </Nav.Item>

              <Nav.Item>
                <Nav.Link eventKey="para" className="d-flex align-items-center gap-2 py-2.5 px-3 fw-semibold">
                  <IconCoin size={17} className="text-warning" />
                  <span>2. Para & Kuruş & Oranlar</span>
                </Nav.Link>
              </Nav.Item>

              <Nav.Item>
                <Nav.Link eventKey="muhasebe" className="d-flex align-items-center gap-2 py-2.5 px-3 fw-semibold">
                  <IconReceipt2 size={17} className="text-success" />
                  <span>3. Muhasebe & Hesap Planı</span>
                </Nav.Link>
              </Nav.Item>

              <Nav.Item>
                <Nav.Link eventKey="limitler" className="d-flex align-items-center gap-2 py-2.5 px-3 fw-semibold">
                  <IconScale size={17} className="text-info" />
                  <span>4. Limitler & Vergi & Tolerans</span>
                </Nav.Link>
              </Nav.Item>

              <Nav.Item>
                <Nav.Link eventKey="ebelge" className="d-flex align-items-center gap-2 py-2.5 px-3 fw-semibold">
                  <IconFileCertificate size={17} className="text-danger" />
                  <span>5. E-Belge, E-Fatura & Server</span>
                </Nav.Link>
              </Nav.Item>

              <Nav.Item>
                <Nav.Link eventKey="sistem" className="d-flex align-items-center gap-2 py-2.5 px-3 fw-semibold">
                  <IconAdjustments size={17} className="text-secondary" />
                  <span>6. Fiş, Cari & Sistem</span>
                </Nav.Link>
              </Nav.Item>
            </Nav>
          </Card.Header>

          <Card.Body className="p-3 p-md-4">
            {isLoading ? (
              <div className="text-center py-5">
                <Spinner animation="border" variant="primary" />
                <div className="text-muted small mt-2">Firma tanımları SQL sunucusundan yükleniyor...</div>
              </div>
            ) : (
              <Tab.Content>
                {/* ─── TAB 1: GENEL & FİRMA BİLGİLERİ ─── */}
                <Tab.Pane eventKey="genel">
                  <Row className="g-3">
                    <Col xs={12}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={3} md={2} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Firma Ticari Unvanı:</Form.Label>
  <Col sm={9} md={10}>
    <Form.Control
                          type="text"
                          value={formData.FIRMA_ADI || ""}
                          onChange={(e) => handleChange("FIRMA_ADI", e.target.value)}
                          className="bg-light border fw-medium"
                        />
  </Col>
</Form.Group>
                    </Col>

                    <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Şube Kodu:</Form.Label>
  <Col sm={8}>
    <Form.Control
                          type="text"
                          value={formData.SUBE_KODU || ""}
                          onChange={(e) => handleChange("SUBE_KODU", e.target.value)}
                          className="bg-light border"
                        />
  </Col>
</Form.Group>
                    </Col>

                    <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Şube Adı:</Form.Label>
  <Col sm={8}>
    <Form.Control
                          type="text"
                          value={formData.SUBE_ADI || ""}
                          onChange={(e) => handleChange("SUBE_ADI", e.target.value)}
                          className="bg-light border"
                        />
  </Col>
</Form.Group>
                    </Col>

                    <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Vergi Dairesi ID:</Form.Label>
  <Col sm={8}>
    <Form.Control
                          type="number"
                          value={formData.VERGI_DAIRESI_ID ?? ""}
                          onChange={(e) => handleChange("VERGI_DAIRESI_ID", e.target.value === "" ? null : Number(e.target.value))}
                          className="bg-light border font-monospace"
                        />
  </Col>
</Form.Group>
                    </Col>

                    <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Vergi Kimlik No:</Form.Label>
  <Col sm={8}>
    <Form.Control
                          type="text"
                          value={formData.VERGI_KIMLIK_NO || ""}
                          onChange={(e) => handleChange("VERGI_KIMLIK_NO", e.target.value)}
                          className="bg-light border font-monospace"
                        />
  </Col>
</Form.Group>
                    </Col>

                    <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Ticaret Sicil No:</Form.Label>
  <Col sm={8}>
    <Form.Control
                          type="text"
                          value={formData.TICARET_SICIL_NO || ""}
                          onChange={(e) => handleChange("TICARET_SICIL_NO", e.target.value)}
                          className="bg-light border font-monospace"
                        />
  </Col>
</Form.Group>
                    </Col>

                    <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">MERSİS No:</Form.Label>
  <Col sm={8}>
    <Form.Control
                          type="text"
                          value={formData.MERSIS_NO || ""}
                          onChange={(e) => handleChange("MERSIS_NO", e.target.value)}
                          className="bg-light border font-monospace"
                        />
  </Col>
</Form.Group>
                    </Col>

                    <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Yetkili Müessese Tipi:</Form.Label>
  <Col sm={8}>
    <Form.Select
                          value={formData.YETKILI_MUESSESE_TIPI ?? 0}
                          onChange={(e) => handleChange("YETKILI_MUESSESE_TIPI", Number(e.target.value))}
                          className="bg-light border"
                        >
                          <option value={0}>0 - A Grubu Yetkili Müessese</option>
                          <option value={1}>1 - B Grubu Sınırlı Yetkili Müessese</option>
                          <option value={2}>2 - Kuyumcu / Sarraf</option>
                        </Form.Select>
  </Col>
</Form.Group>
                    </Col>

                    <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Telefon:</Form.Label>
  <Col sm={8}>
    <Form.Control
                          type="text"
                          value={formData.TELEFON || ""}
                          onChange={(e) => handleChange("TELEFON", e.target.value)}
                          className="bg-light border"
                        />
  </Col>
</Form.Group>
                    </Col>

                    <Col xs={12}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={3} md={2} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Açık Adres:</Form.Label>
  <Col sm={9} md={10}>
    <Form.Control
                          type="text"
                          value={formData.ADRES || ""}
                          onChange={(e) => handleChange("ADRES", e.target.value)}
                          className="bg-light border"
                        />
  </Col>
</Form.Group>
                    </Col>

                    <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Posta Kodu ID:</Form.Label>
  <Col sm={8}>
    <Form.Control
                          type="number"
                          value={formData.POSTA_KODU_ID ?? ""}
                          onChange={(e) => handleChange("POSTA_KODU_ID", e.target.value === "" ? null : Number(e.target.value))}
                          className="bg-light border font-monospace"
                        />
  </Col>
</Form.Group>
                    </Col>

                    <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">İlçe ID:</Form.Label>
  <Col sm={8}>
    <Form.Control
                          type="number"
                          value={formData.ILCE_ID ?? ""}
                          onChange={(e) => handleChange("ILCE_ID", e.target.value === "" ? null : Number(e.target.value))}
                          className="bg-light border font-monospace"
                        />
  </Col>
</Form.Group>
                    </Col>

                    <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">İl ID:</Form.Label>
  <Col sm={8}>
    <Form.Control
                          type="number"
                          value={formData.IL_ID ?? ""}
                          onChange={(e) => handleChange("IL_ID", e.target.value === "" ? null : Number(e.target.value))}
                          className="bg-light border font-monospace"
                        />
  </Col>
</Form.Group>
                    </Col>

                    <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Ülke ID:</Form.Label>
  <Col sm={8}>
    <Form.Control
                          type="number"
                          value={formData.ULKE_ID ?? ""}
                          onChange={(e) => handleChange("ULKE_ID", e.target.value === "" ? null : Number(e.target.value))}
                          className="bg-light border font-monospace"
                        />
  </Col>
</Form.Group>
                    </Col>

                    <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">E-Posta:</Form.Label>
  <Col sm={8}>
    <Form.Control
                          type="email"
                          value={formData.EPOSTA || ""}
                          onChange={(e) => handleChange("EPOSTA", e.target.value)}
                          className="bg-light border"
                        />
  </Col>
</Form.Group>
                    </Col>

                    <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Web Sitesi:</Form.Label>
  <Col sm={8}>
    <Form.Control
                          type="text"
                          value={formData.WEB_ADRESI || ""}
                          onChange={(e) => handleChange("WEB_ADRESI", e.target.value)}
                          className="bg-light border"
                        />
  </Col>
</Form.Group>
                    </Col>

                    <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Dosya No:</Form.Label>
  <Col sm={8}>
    <Form.Control
                          type="text"
                          value={formData.DOSYA_NO || ""}
                          onChange={(e) => handleChange("DOSYA_NO", e.target.value)}
                          className="bg-light border"
                        />
  </Col>
</Form.Group>
                    </Col>
                  </Row>
                </Tab.Pane>

                {/* ─── TAB 2: PARA, KURUŞ & ORAN PARAMETRELERİ ─── */}
                <Tab.Pane eventKey="para">
                  <Row className="g-3">
                    <Col xs={12} md={6}>
                      <div className="p-3 bg-light rounded-3 border h-100">
                        <h6 className="fw-bold text-dark border-bottom pb-2 mb-3 d-flex align-items-center gap-1.5">
                          <IconCoin size={17} className="text-warning" /> Para Tanımlayıcıları (Para ID)
                        </h6>
                        <Row className="g-2">
                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">USD Para ID:</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="number"
                                value={formData.USD_PARA_ID ?? 2}
                                onChange={(e) => handleChange("USD_PARA_ID", Number(e.target.value))}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>
                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">EUR Para ID:</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="number"
                                value={formData.EUR_PARA_ID ?? 3}
                                onChange={(e) => handleChange("EUR_PARA_ID", Number(e.target.value))}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>
                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Rapor Para ID:</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="number"
                                value={formData.RAPOR_PARA_ID ?? 2}
                                onChange={(e) => handleChange("RAPOR_PARA_ID", Number(e.target.value))}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>
                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Favori Para ID:</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="number"
                                value={formData.FAVORI_PARA_ID ?? 2}
                                onChange={(e) => handleChange("FAVORI_PARA_ID", e.target.value === "" ? null : Number(e.target.value))}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>
                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Has Altın Para ID:</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="number"
                                value={formData.HAS_ALTIN_PARA_ID ?? ""}
                                onChange={(e) => handleChange("HAS_ALTIN_PARA_ID", e.target.value === "" ? null : Number(e.target.value))}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>
                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Has Gümüş Para ID:</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="number"
                                value={formData.HAS_GUMUS_PARA_ID ?? ""}
                                onChange={(e) => handleChange("HAS_GUMUS_PARA_ID", e.target.value === "" ? null : Number(e.target.value))}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>
                        </Row>
                      </div>
                    </Col>

                    <Col xs={12} md={6}>
                      <div className="p-3 bg-light rounded-3 border h-100">
                        <h6 className="fw-bold text-dark border-bottom pb-2 mb-3">
                          Kuruş & Ondalık Basamak Sayıları
                        </h6>
                        <Row className="g-2">
                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">TL Kuruş Sayısı:</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="number"
                                value={formData.TL_KURUS_SAYISI ?? 2}
                                onChange={(e) => handleChange("TL_KURUS_SAYISI", Number(e.target.value))}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>
                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Döviz Kuruş Sayısı:</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="number"
                                value={formData.DOVIZ_KURUS_SAYISI ?? 0}
                                onChange={(e) => handleChange("DOVIZ_KURUS_SAYISI", Number(e.target.value))}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>
                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Kur Kuruş Sayısı:</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="number"
                                value={formData.KUR_KURUS_SAYISI ?? 6}
                                onChange={(e) => handleChange("KUR_KURUS_SAYISI", Number(e.target.value))}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>
                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Gram Ondalık Sayısı:</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="number"
                                value={formData.GRAM_ONDALIK_SAYISI ?? 2}
                                onChange={(e) => handleChange("GRAM_ONDALIK_SAYISI", Number(e.target.value))}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>
                        </Row>
                      </div>
                    </Col>

                    {/* Oranlar & İstatistikler */}
                    <Col xs={12} md={6}>
                      <div className="p-3 bg-light rounded-3 border h-100">
                        <h6 className="fw-bold text-dark border-bottom pb-2 mb-3">Döviz & Efektif Alış/Satış Oranları</h6>
                        <Row className="g-2">
                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Dvz Alış / Satış:</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="number"
                                step="0.0001"
                                value={formData.DOVIZ_ALIS_DVZ_SATIS_ORANI ?? 1}
                                onChange={(e) => handleChange("DOVIZ_ALIS_DVZ_SATIS_ORANI", Number(e.target.value))}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>
                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Efektif Alış / Satış:</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="number"
                                step="0.0001"
                                value={formData.EFEKTIF_ALIS_DVZ_SATIS_ORANI ?? 1}
                                onChange={(e) => handleChange("EFEKTIF_ALIS_DVZ_SATIS_ORANI", Number(e.target.value))}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>
                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Efektif Satış / Satış:</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="number"
                                step="0.0001"
                                value={formData.EFEKTIF_SATIS_DVZ_SATIS_ORANI ?? 1}
                                onChange={(e) => handleChange("EFEKTIF_SATIS_DVZ_SATIS_ORANI", Number(e.target.value))}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>
                        </Row>
                      </div>
                    </Col>

                    <Col xs={12} md={6}>
                      <div className="p-3 bg-light rounded-3 border h-100">
                        <h6 className="fw-bold text-dark border-bottom pb-2 mb-3">İstatistik ID Eşleştirmeleri</h6>
                        <Row className="g-2">
                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Alış İstatistik:</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="number"
                                value={formData.ALIS_ISTATISTIK_ID ?? 2}
                                onChange={(e) => handleChange("ALIS_ISTATISTIK_ID", Number(e.target.value))}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>
                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Satış İstatistik:</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="number"
                                value={formData.SATIS_ISTATISTIK_ID ?? 3}
                                onChange={(e) => handleChange("SATIS_ISTATISTIK_ID", Number(e.target.value))}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>
                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Arbitraj Alış:</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="number"
                                value={formData.ARBITRAJ_ALIS_ISTATISTIK_ID ?? 2}
                                onChange={(e) => handleChange("ARBITRAJ_ALIS_ISTATISTIK_ID", Number(e.target.value))}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>
                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Arbitraj Satış:</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="number"
                                value={formData.ARBITRAJ_SATIS_ISTATISTIK_ID ?? 3}
                                onChange={(e) => handleChange("ARBITRAJ_SATIS_ISTATISTIK_ID", Number(e.target.value))}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>
                        </Row>
                      </div>
                    </Col>

                    {/* Kur Entegrasyonu & Foreks */}
                    <Col xs={12}>
                      <div className="p-3 bg-light rounded-3 border">
                        <h6 className="fw-bold text-dark border-bottom pb-2 mb-3">Kur Entegrasyonu & Foreks Parametreleri</h6>
                        <Row className="g-2">
                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Default Kur Kaynağı:</Form.Label>
  <Col sm={8}>
    <Form.Select
                                value={formData.DEFAULT_KUR_KAYNAGI ?? 0}
                                onChange={(e) => handleChange("DEFAULT_KUR_KAYNAGI", Number(e.target.value))}
                                className="bg-white border"
                              >
                                <option value={0}>0 - Manuel / ERP</option>
                                <option value={1}>1 - Merkez Bankası</option>
                                <option value={2}>2 - Foreks / Canlı Veri</option>
                              </Form.Select>
  </Col>
</Form.Group>
                          </Col>

                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Kur Text Dosyası:</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="text"
                                value={formData.KUR_TEXT_DOSYASI || ""}
                                onChange={(e) => handleChange("KUR_TEXT_DOSYASI", e.target.value)}
                                className="bg-white border"
                              />
  </Col>
</Form.Group>
                          </Col>

                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Foreks Kur Dosyası:</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="text"
                                value={formData.FOREKS_KUR_DOSYA_ADI || ""}
                                onChange={(e) => handleChange("FOREKS_KUR_DOSYA_ADI", e.target.value)}
                                className="bg-white border"
                              />
  </Col>
</Form.Group>
                          </Col>

                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Foreks Vezne ID:</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="number"
                                value={formData.FOREKS_KUR_VEZNE_ID ?? ""}
                                onChange={(e) => handleChange("FOREKS_KUR_VEZNE_ID", e.target.value === "" ? null : Number(e.target.value))}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>

                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Yenileme (Sn):</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="number"
                                value={formData.FOREKS_KUR_YENILEME_SURESI ?? ""}
                                onChange={(e) => handleChange("FOREKS_KUR_YENILEME_SURESI", e.target.value === "" ? null : Number(e.target.value))}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>

                          <Col xs={12} className="mt-2">
                            <div className="d-flex gap-4 flex-wrap">
                              <Form.Check
                                type="checkbox"
                                id="MERKEZ_BANKASI_KURUNU_AL"
                                label="Merkez Bankası Kurunu Otomatik Al"
                                checked={formData.MERKEZ_BANKASI_KURUNU_AL ?? false}
                                onChange={(e) => handleChange("MERKEZ_BANKASI_KURUNU_AL", e.target.checked)}
                              />
                              <Form.Check
                                type="checkbox"
                                id="FISDE_KUR_TURU_DEGISEBILIR"
                                label="Fişte Kur Türü Değiştirilebilir"
                                checked={formData.FISDE_KUR_TURU_DEGISEBILIR ?? false}
                                onChange={(e) => handleChange("FISDE_KUR_TURU_DEGISEBILIR", e.target.checked)}
                              />
                            </div>
                          </Col>
                        </Row>
                      </div>
                    </Col>
                  </Row>
                </Tab.Pane>

                {/* ─── TAB 3: MUHASEBE & HESAP PLANI ─── */}
                <Tab.Pane eventKey="muhasebe">
                  <Row className="g-3">
                    <Col xs={12} md={6}>
                      <div className="p-3 bg-light rounded-3 border h-100">
                        <h6 className="fw-bold text-dark border-bottom pb-2 mb-3">Tek Düzen Muhasebe Hesap Kodları</h6>
                        <Row className="g-2">
                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Kasa Hesabı:</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="text"
                                value={formData.KASA_HESABI || ""}
                                onChange={(e) => handleChange("KASA_HESABI", e.target.value)}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>

                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Komisyon Hesabı:</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="text"
                                value={formData.KOMISYON_HESABI || ""}
                                onChange={(e) => handleChange("KOMISYON_HESABI", e.target.value)}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>

                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">BMV Hesabı:</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="text"
                                value={formData.BMV_HESABI || ""}
                                onChange={(e) => handleChange("BMV_HESABI", e.target.value)}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>

                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">KMV Hesabı:</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="text"
                                value={formData.KMV_HESABI || ""}
                                onChange={(e) => handleChange("KMV_HESABI", e.target.value)}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>

                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">KMV Gider Hesabı:</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="text"
                                value={formData.KMV_GIDER_HESABI || ""}
                                onChange={(e) => handleChange("KMV_GIDER_HESABI", e.target.value)}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>

                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Sermaye Hesabı ID:</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="number"
                                value={formData.SERMAYE_HESABI_ID ?? 1}
                                onChange={(e) => handleChange("SERMAYE_HESABI_ID", e.target.value === "" ? null : Number(e.target.value))}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>

                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Kambiyo Kar Hesabı:</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="text"
                                value={formData.KAMBIYO_KAR_HESABI || ""}
                                onChange={(e) => handleChange("KAMBIYO_KAR_HESABI", e.target.value)}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>

                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Kambiyo Zarar Hesabı:</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="text"
                                value={formData.KAMBIYO_ZARAR_HESABI || ""}
                                onChange={(e) => handleChange("KAMBIYO_ZARAR_HESABI", e.target.value)}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>
                        </Row>
                      </div>
                    </Col>

                    <Col xs={12} md={6}>
                      <div className="p-3 bg-light rounded-3 border h-100">
                        <h6 className="fw-bold text-dark border-bottom pb-2 mb-3">KDV, İşçilik & Dönem Parametreleri</h6>
                        <Row className="g-2">
                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">İşçilik Hesabı:</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="text"
                                value={formData.ISCILIK_HESABI || ""}
                                onChange={(e) => handleChange("ISCILIK_HESABI", e.target.value)}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>

                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">KMV Uygulama Şekli:</Form.Label>
  <Col sm={8}>
    <Form.Select
                                value={formData.KMV_UYGULAMA_SEKLI ?? 1}
                                onChange={(e) => handleChange("KMV_UYGULAMA_SEKLI", Number(e.target.value))}
                                className="bg-white border"
                              >
                                <option value={0}>0 - Uygulanmasın</option>
                                <option value={1}>1 - Binde 1</option>
                                <option value={2}>2 - Binde 2</option>
                              </Form.Select>
  </Col>
</Form.Group>
                          </Col>

                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">KDV Gelir Hesabı:</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="text"
                                value={formData.KDV_GELIR_HESABI || ""}
                                onChange={(e) => handleChange("KDV_GELIR_HESABI", e.target.value)}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>

                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">KDV Gider Hesabı:</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="text"
                                value={formData.KDV_GIDER_HESABI || ""}
                                onChange={(e) => handleChange("KDV_GIDER_HESABI", e.target.value)}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>

                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Hesap Yılı:</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="number"
                                value={formData.HESAP_YILI ?? 2026}
                                onChange={(e) => handleChange("HESAP_YILI", Number(e.target.value))}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>

                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">İşçilik Giriş Şekli:</Form.Label>
  <Col sm={8}>
    <Form.Select
                                value={formData.ISCILIK_GIRIS_SEKLI ?? ""}
                                onChange={(e) => handleChange("ISCILIK_GIRIS_SEKLI", e.target.value === "" ? null : Number(e.target.value))}
                                className="bg-white border"
                              >
                                <option value="">Seçiniz</option>
                                <option value={0}>0 - Gram Başına</option>
                                <option value={1}>1 - Toplam Tutar</option>
                              </Form.Select>
  </Col>
</Form.Group>
                          </Col>

                          <Col xs={12} className="mt-3">
                            <div className="d-flex gap-4 flex-wrap">
                              <Form.Check
                                type="checkbox"
                                id="ISCILIK_FIYATA_DAHIL"
                                label="İşçilik Fiyata Dahil"
                                checked={formData.ISCILIK_FIYATA_DAHIL ?? false}
                                onChange={(e) => handleChange("ISCILIK_FIYATA_DAHIL", e.target.checked)}
                              />
                              <Form.Check
                                type="checkbox"
                                id="E_DEFTER_MUKELLEFI"
                                label="E-Defter Mükellefi"
                                checked={formData.E_DEFTER_MUKELLEFI ?? false}
                                onChange={(e) => handleChange("E_DEFTER_MUKELLEFI", e.target.checked)}
                              />
                            </div>
                          </Col>
                        </Row>
                      </div>
                    </Col>
                  </Row>
                </Tab.Pane>

                {/* ─── TAB 4: LİMİTLER, VERGİ & TOLERANS ─── */}
                <Tab.Pane eventKey="limitler">
                  <Row className="g-3">
                    <Col xs={12} md={6}>
                      <div className="p-3 bg-light rounded-3 border h-100">
                        <h6 className="fw-bold text-dark border-bottom pb-2 mb-3">MASAK & Vergi Sınırları</h6>
                        <Row className="g-2">
                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">TL Vergi Sınırı:</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="number"
                                value={formData.TL_VERGI_SINIRI ?? 185000}
                                onChange={(e) => handleChange("TL_VERGI_SINIRI", Number(e.target.value))}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>

                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Döviz Vergi Sınırı:</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="number"
                                value={formData.DOVIZ_VERGI_SINIRI ?? 5000}
                                onChange={(e) => handleChange("DOVIZ_VERGI_SINIRI", Number(e.target.value))}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>

                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Altın Vergi Sınırı:</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="number"
                                value={formData.ALTIN_VERGI_SINIRI ?? 5000}
                                onChange={(e) => handleChange("ALTIN_VERGI_SINIRI", Number(e.target.value))}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>

                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Sarrafiye Kimlik Kontrol Sınırı:</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="number"
                                value={formData.SAR_KIMLIK_KONTROL_SINIRI ?? 0}
                                onChange={(e) => handleChange("SAR_KIMLIK_KONTROL_SINIRI", Number(e.target.value))}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>

                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Döviz Sınır Para ID:</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="number"
                                value={formData.DOVIZ_VERGI_SINIRI_PARA_ID ?? 2}
                                onChange={(e) => handleChange("DOVIZ_VERGI_SINIRI_PARA_ID", e.target.value === "" ? null : Number(e.target.value))}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>

                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Altın Sınır Para ID:</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="number"
                                value={formData.ALTIN_VERGI_SINIRI_PARA_ID ?? 2}
                                onChange={(e) => handleChange("ALTIN_VERGI_SINIRI_PARA_ID", e.target.value === "" ? null : Number(e.target.value))}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>

                          <Col xs={12} className="mt-2">
                            <Form.Check
                              type="checkbox"
                              id="VERGI_SINIRI_ASILINCA_YASAKLA"
                              label="Vergi Sınırı Aşılınca İşlemi Yasakla (Bloke Et)"
                              checked={formData.VERGI_SINIRI_ASILINCA_YASAKLA ?? false}
                              onChange={(e) => handleChange("VERGI_SINIRI_ASILINCA_YASAKLA", e.target.checked)}
                            />
                          </Col>
                        </Row>
                      </div>
                    </Col>

                    <Col xs={12} md={6}>
                      <div className="p-3 bg-light rounded-3 border h-100">
                        <h6 className="fw-bold text-dark border-bottom pb-2 mb-3">Tolerans & Yuvarlama Ayarları</h6>
                        <Row className="g-2">
                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Cari TL Toleransı:</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="number"
                                step="0.01"
                                value={formData.CARI_TL_TOLERANSI ?? 0}
                                onChange={(e) => handleChange("CARI_TL_TOLERANSI", Number(e.target.value))}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>

                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Cari USD Toleransı:</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="number"
                                step="0.01"
                                value={formData.CARI_USD_TOLERANSI ?? 0}
                                onChange={(e) => handleChange("CARI_USD_TOLERANSI", Number(e.target.value))}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>

                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">TL Yuvarlama Aralığı:</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="number"
                                step="0.01"
                                value={formData.TL_YUVARLAMA_ARALIGI ?? 0}
                                onChange={(e) => handleChange("TL_YUVARLAMA_ARALIGI", Number(e.target.value))}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>

                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">TL Yuvarlama Eşiği:</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="number"
                                step="0.01"
                                value={formData.TL_YUVARLAMA_ESIGI ?? 0}
                                onChange={(e) => handleChange("TL_YUVARLAMA_ESIGI", Number(e.target.value))}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>

                          <Col xs={12}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={3} md={2} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Satışın Dayanağı (Mevzuat Açıklaması):</Form.Label>
  <Col sm={9} md={10}>
    <Form.Control
                                type="text"
                                value={formData.SATISIN_DAYANAGI || ""}
                                onChange={(e) => handleChange("SATISIN_DAYANAGI", e.target.value)}
                                className="bg-white border"
                              />
  </Col>
</Form.Group>
                          </Col>

                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Vergi No Sorgulama Yöntemi:</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="number"
                                value={formData.VERGI_NO_SORGULAMA_YONTEMI ?? ""}
                                onChange={(e) => handleChange("VERGI_NO_SORGULAMA_YONTEMI", e.target.value === "" ? null : Number(e.target.value))}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>

                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Sorgulayan TC No:</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="text"
                                value={formData.VERGI_SORGULAYAN_TC_NO || ""}
                                onChange={(e) => handleChange("VERGI_SORGULAYAN_TC_NO", e.target.value)}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>
                        </Row>
                      </div>
                    </Col>
                  </Row>
                </Tab.Pane>

                {/* ─── TAB 5: E-BELGE, E-FATURA & SERVER ─── */}
                <Tab.Pane eventKey="ebelge">
                  <Row className="g-3">
                    <Col xs={12} md={6}>
                      <div className="p-3 bg-light rounded-3 border h-100">
                        <h6 className="fw-bold text-dark border-bottom pb-2 mb-3">E-Belge Sunucu & Entegratör Bağlantısı</h6>
                        <Row className="g-2">
                          <Col xs={12}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={3} md={2} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">E-Belge Server IP:</Form.Label>
  <Col sm={9} md={10}>
    <Form.Control
                                type="text"
                                value={formData.E_BELGE_SERVER_IP || ""}
                                onChange={(e) => handleChange("E_BELGE_SERVER_IP", e.target.value)}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>

                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Server Portu:</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="number"
                                value={formData.E_BELGE_SERVER_PORTU ?? 53462}
                                onChange={(e) => handleChange("E_BELGE_SERVER_PORTU", Number(e.target.value))}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>

                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Entegratör Yanıt Süresi (Sn):</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="number"
                                value={formData.ENTEGRATOR_YANIT_VERME_SURESI ?? 30}
                                onChange={(e) => handleChange("ENTEGRATOR_YANIT_VERME_SURESI", Number(e.target.value))}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>

                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Müşavir TÜRMOB Şifresi:</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="password"
                                value={formData.MUSAVIR_TURMOB_SIFRESI || ""}
                                onChange={(e) => handleChange("MUSAVIR_TURMOB_SIFRESI", e.target.value)}
                                className="bg-white border"
                              />
  </Col>
</Form.Group>
                          </Col>

                          <Col xs={12}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={3} md={2} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">E-Fatura Portal Adresi:</Form.Label>
  <Col sm={9} md={10}>
    <Form.Control
                                type="text"
                                value={formData.E_FATURA_PORTAL_ADRESI || ""}
                                onChange={(e) => handleChange("E_FATURA_PORTAL_ADRESI", e.target.value)}
                                className="bg-white border"
                              />
  </Col>
</Form.Group>
                          </Col>

                          <Col xs={12} className="mt-2">
                            <div className="d-flex flex-column gap-2">
                              <Form.Check
                                type="checkbox"
                                id="E_DOVIZ_FIS_BASILSIN"
                                label="E-Döviz Fişi Basılsın"
                                checked={formData.E_DOVIZ_FIS_BASILSIN ?? true}
                                onChange={(e) => handleChange("E_DOVIZ_FIS_BASILSIN", e.target.checked)}
                              />
                              <Form.Check
                                type="checkbox"
                                id="ENTEGRATORE_ANLIK_GONDERILSIN"
                                label="Entegratöre Anlık Olarak Gönderilsin"
                                checked={formData.ENTEGRATORE_ANLIK_GONDERILSIN ?? false}
                                onChange={(e) => handleChange("ENTEGRATORE_ANLIK_GONDERILSIN", e.target.checked)}
                              />
                              <Form.Check
                                type="checkbox"
                                id="XSLT_DOSYALARI_KOPYALANSIN"
                                label="XSLT Dosyaları Otomatik Kopyalansın"
                                checked={formData.XSLT_DOSYALARI_KOPYALANSIN ?? false}
                                onChange={(e) => handleChange("XSLT_DOSYALARI_KOPYALANSIN", e.target.checked)}
                              />
                              <Form.Check
                                type="checkbox"
                                id="RPT_DOSYALARI_KOPYALANSIN"
                                label="RPT Rapor Dosyaları Kopyalansın"
                                checked={formData.RPT_DOSYALARI_KOPYALANSIN ?? false}
                                onChange={(e) => handleChange("RPT_DOSYALARI_KOPYALANSIN", e.target.checked)}
                              />
                            </div>
                          </Col>
                        </Row>
                      </div>
                    </Col>

                    <Col xs={12} md={6}>
                      <div className="p-3 bg-light rounded-3 border h-100">
                        <h6 className="fw-bold text-dark border-bottom pb-2 mb-3">Posta Kutusu & KDV Muafiyet Kodları</h6>
                        <Row className="g-2">
                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">E-Fatura Posta Kutusu:</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="text"
                                value={formData.E_FATURA_POSTA_KUTUSU || ""}
                                onChange={(e) => handleChange("E_FATURA_POSTA_KUTUSU", e.target.value)}
                                className="bg-white border"
                              />
  </Col>
</Form.Group>
                          </Col>

                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">E-İrsaliye Posta Kutusu:</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="text"
                                value={formData.E_IRSALIYE_POSTA_KUTUSU || ""}
                                onChange={(e) => handleChange("E_IRSALIYE_POSTA_KUTUSU", e.target.value)}
                                className="bg-white border"
                              />
  </Col>
</Form.Group>
                          </Col>

                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">KDV Muafiyet Kodu:</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="text"
                                value={formData.E_FATURA_KDV_MUAFIYET_KODU || ""}
                                onChange={(e) => handleChange("E_FATURA_KDV_MUAFIYET_KODU", e.target.value)}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>

                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">KDV Muafiyet Adı:</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="text"
                                value={formData.E_FATURA_KDV_MUAFIYET_ADI || ""}
                                onChange={(e) => handleChange("E_FATURA_KDV_MUAFIYET_ADI", e.target.value)}
                                className="bg-white border"
                              />
  </Col>
</Form.Group>
                          </Col>

                          <Col xs={12}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={3} md={2} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">XSLT Dizini (Tasarım Yolu):</Form.Label>
  <Col sm={9} md={10}>
    <Form.Control
                                type="text"
                                value={formData.XSLT_DIZINI || ""}
                                onChange={(e) => handleChange("XSLT_DIZINI", e.target.value)}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>

                          <Col xs={12}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={3} md={2} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Belge Dizini:</Form.Label>
  <Col sm={9} md={10}>
    <Form.Control
                                type="text"
                                value={formData.BELGE_DIZINI || ""}
                                onChange={(e) => handleChange("BELGE_DIZINI", e.target.value)}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>
                        </Row>
                      </div>
                    </Col>
                  </Row>
                </Tab.Pane>

                {/* ─── TAB 6: FİŞ, CARİ & SİSTEM ─── */}
                <Tab.Pane eventKey="sistem">
                  <Row className="g-3">
                    <Col xs={12} md={6}>
                      <div className="p-3 bg-light rounded-3 border h-100">
                        <h6 className="fw-bold text-dark border-bottom pb-2 mb-3">Fiş & Cari Davranış Parametreleri</h6>
                        <Row className="g-2">
                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Ekrandaki Vezne Sayısı:</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="number"
                                value={formData.EKRANDAKI_VEZNE_SAYISI ?? 0}
                                onChange={(e) => handleChange("EKRANDAKI_VEZNE_SAYISI", Number(e.target.value))}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>

                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Tazeleme Süresi (Sn):</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="number"
                                value={formData.TAZELEME_SURESI ?? 5}
                                onChange={(e) => handleChange("TAZELEME_SURESI", Number(e.target.value))}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>

                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Belge Yazıcı Modu:</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="number"
                                value={formData.BELGE_YAZICI_MODU ?? 2}
                                onChange={(e) => handleChange("BELGE_YAZICI_MODU", e.target.value === "" ? null : Number(e.target.value))}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>

                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Değişiklik Takip Şifresi:</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="password"
                                value={formData.DEGISIKLIK_TAKIP_SIFRESI || ""}
                                onChange={(e) => handleChange("DEGISIKLIK_TAKIP_SIFRESI", e.target.value)}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>

                          <Col xs={12} className="mt-3">
                            <div className="d-flex flex-column gap-2">
                              <Form.Check
                                type="checkbox"
                                id="FIS_MASAK_KONTROLU_VAR"
                                label="Fişte MASAK Kontrolü Yapılsın"
                                checked={formData.FIS_MASAK_KONTROLU_VAR ?? true}
                                onChange={(e) => handleChange("FIS_MASAK_KONTROLU_VAR", e.target.checked)}
                              />
                              <Form.Check
                                type="checkbox"
                                id="FISTE_COKLU_SATIR"
                                label="Fişte Çoklu Satır Girişine İzin Ver"
                                checked={formData.FISTE_COKLU_SATIR ?? false}
                                onChange={(e) => handleChange("FISTE_COKLU_SATIR", e.target.checked)}
                              />
                              <Form.Check
                                type="checkbox"
                                id="FISTE_SAAT_CIKMASIN"
                                label="Fişte Saat Çıkmasın"
                                checked={formData.FISTE_SAAT_CIKMASIN ?? false}
                                onChange={(e) => handleChange("FISTE_SAAT_CIKMASIN", e.target.checked)}
                              />
                              <Form.Check
                                type="checkbox"
                                id="FIS_NO_BASINA_SIFIR"
                                label="Fiş Numarası Başına Sıfır Ekle"
                                checked={formData.FIS_NO_BASINA_SIFIR ?? false}
                                onChange={(e) => handleChange("FIS_NO_BASINA_SIFIR", e.target.checked)}
                              />
                              <Form.Check
                                type="checkbox"
                                id="CARI_KOD_BASINA_SIFIR"
                                label="Cari Kod Başına Sıfır Ekle"
                                checked={formData.CARI_KOD_BASINA_SIFIR ?? false}
                                onChange={(e) => handleChange("CARI_KOD_BASINA_SIFIR", e.target.checked)}
                              />
                              <Form.Check
                                type="checkbox"
                                id="FIS_CARI_ISLEME_SORULSUN"
                                label="Fiş Kaydında Cari İşleme Sorulsun"
                                checked={formData.FIS_CARI_ISLEME_SORULSUN ?? false}
                                onChange={(e) => handleChange("FIS_CARI_ISLEME_SORULSUN", e.target.checked)}
                              />
                            </div>
                          </Col>
                        </Row>
                      </div>
                    </Col>

                    <Col xs={12} md={6}>
                      <div className="p-3 bg-light rounded-3 border h-100">
                        <h6 className="fw-bold text-dark border-bottom pb-2 mb-3">Yedekleme & Çoklu Veritabanı Alanları</h6>
                        <Row className="g-2">
                          <Col xs={12}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={3} md={2} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Yedek Klasörü (1. Yedek Yolu):</Form.Label>
  <Col sm={9} md={10}>
    <Form.Control
                                type="text"
                                value={formData.YEDEK_KLASORU || ""}
                                onChange={(e) => handleChange("YEDEK_KLASORU", e.target.value)}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>

                          <Col xs={12}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={3} md={2} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">İkinci Yedek Klasörü:</Form.Label>
  <Col sm={9} md={10}>
    <Form.Control
                                type="text"
                                value={formData.IKINCI_YEDEK_KLASORU || ""}
                                onChange={(e) => handleChange("IKINCI_YEDEK_KLASORU", e.target.value)}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>

                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Diğer Veritabanı Adı:</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="text"
                                value={formData.DIGER_VERITABANI_ADI || ""}
                                onChange={(e) => handleChange("DIGER_VERITABANI_ADI", e.target.value)}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>

                          <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
  <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Devir Alanı 2:</Form.Label>
  <Col sm={8}>
    <Form.Control
                                type="text"
                                value={formData.DEVIR_ALANI2 || ""}
                                onChange={(e) => handleChange("DEVIR_ALANI2", e.target.value)}
                                className="bg-white border font-monospace"
                              />
  </Col>
</Form.Group>
                          </Col>

                          <Col xs={12} className="mt-3">
                            <div className="d-flex flex-column gap-2">
                              <Form.Check
                                type="checkbox"
                                id="ORTAK_ALAN"
                                label="Ortak Alan (Şubeler Arası Ortak Veritabanı)"
                                checked={formData.ORTAK_ALAN ?? true}
                                onChange={(e) => handleChange("ORTAK_ALAN", e.target.checked)}
                              />
                              <Form.Check
                                type="checkbox"
                                id="TOPLAMDA_PARA_KODU"
                                label="Toplamlarda Para Kodunu Göster"
                                checked={formData.TOPLAMDA_PARA_KODU ?? true}
                                onChange={(e) => handleChange("TOPLAMDA_PARA_KODU", e.target.checked)}
                              />
                              <Form.Check
                                type="checkbox"
                                id="FIRMA_DURUMU_RAPORU"
                                label="Firma Durumu Raporu Aktif"
                                checked={formData.FIRMA_DURUMU_RAPORU ?? false}
                                onChange={(e) => handleChange("FIRMA_DURUMU_RAPORU", e.target.checked)}
                              />
                            </div>
                          </Col>
                        </Row>
                      </div>
                    </Col>
                  </Row>
                </Tab.Pane>
              </Tab.Content>
            )}
          </Card.Body>
        </Card>
      </Tab.Container>
    </div>
  );
};

export default CompanyDefinitionsPage;
