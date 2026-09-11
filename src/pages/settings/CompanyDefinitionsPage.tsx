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
  IconBinoculars,
  IconX,
} from "@tabler/icons-react";

import ERPToolbar from "components/common/ERPToolbar";
import { printReportTable } from "../../utils/printReport";
import { CompanyService, TodvzTanimDto, defaultCompanyTanim } from "../../services/companyService";
import LookupModal, { LookupColumn } from "../../components/common/LookupModal";
import { CariService, CariLookups, LookupItem, CariKartItem } from "../../services/cariService";

export const CompanyDefinitionsPage: React.FC = () => {
  const activeDb = localStorage.getItem("kuyumcu_erp_active_db") || "R2016_dvz";
  const activeServer = localStorage.getItem("kuyumcu_erp_active_server") || "localhost";

const emptyCompanyData: TodvzTanimDto = {
  SURUM: "2016",
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

  const [lookups, setLookups] = useState<CariLookups>({
    vergiDairesiList: [],
    ilList: [],
    ilceList: [],
    postaKoduList: [],
    hukukiYapiList: [],
    sektorList: [],
    meslekList: [],
    ulkeList: [],
    paraList: [],
    istatistikList: [],
  });
  const [cariKartlar, setCariKartlar] = useState<CariKartItem[]>([]);
  const [lookupModalConfig, setLookupModalConfig] = useState<{
    show: boolean;
    title: string;
    items: any[];
    columns: LookupColumn<any>[];
    filterFn: (item: any, term: string) => boolean;
    onSelect: (item: any) => void;
  }>({
    show: false,
    title: "",
    items: [],
    columns: [],
    filterFn: () => true,
    onSelect: () => {},
  });

  const loadLookups = async () => {
    try {
      const data = await CariService.getLookups();
      if (data) setLookups(data);
    } catch (err) {
      console.error("Lookups yüklenirken hata:", err);
    }
  };

  const ensureCariKartlar = async (): Promise<CariKartItem[]> => {
    if (cariKartlar.length === 0) {
      try {
        const list = await CariService.getCariKartlar();
        setCariKartlar(list || []);
        return list || [];
      } catch (err) {
        console.error("Cari kartlar yüklenirken hata:", err);
        return [];
      }
    }
    return cariKartlar;
  };

  // Resolve Names for IDs
  const getVergiDairesiName = (id?: number | null) => {
    if (!id) return "";
    const it = lookups.vergiDairesiList.find((x) => x.id === id);
    return it ? it.ad : "";
  };

  const getIlName = (id?: number | null) => {
    if (!id) return "";
    const it = lookups.ilList.find((x) => x.id === id);
    return it ? it.ad : "";
  };

  const getIlceName = (id?: number | null) => {
    if (!id) return "";
    const it = lookups.ilceList.find((x) => x.id === id);
    return it ? it.ad : "";
  };

  const getPostaKoduName = (id?: number | null) => {
    if (!id) return "";
    const it = lookups.postaKoduList.find((x) => x.id === id || x.kod === String(id));
    return it ? `${it.kod || it.id} - ${it.ad || ""}` : "";
  };

  const getUlkeName = (id?: number | null) => {
    if (!id) return "";
    const it = lookups.ulkeList.find((x) => x.id === id);
    return it ? it.ad : "";
  };

  const getParaName = (id?: number | null) => {
    if (!id) return "";
    const it = lookups.paraList.find((x) => x.id === id);
    return it ? `${it.kod || ""} - ${it.ad || ""}`.trim() : "";
  };

  const getIstatistikName = (id?: number | null) => {
    if (!id) return "";
    const it = lookups.istatistikList.find((x) => x.id === id);
    return it ? `${it.kod || ""} - ${it.ad || ""}`.trim() : "";
  };

  const getCariName = (id?: number | null) => {
    if (!id) return "";
    const it = cariKartlar.find((x) => x.id === id);
    return it ? `${it.kod || ""} - ${it.ad || ""}`.trim() : "";
  };

  // Lookup Modals
  const openVergiDairesiLookup = () => {
    setLookupModalConfig({
      show: true,
      title: "Vergi Dairesi Seçimi",
      items: lookups.vergiDairesiList,
      columns: [
        { header: "ID", render: (it) => <span className="font-monospace fw-semibold">{it.id}</span>, width: "90px" },
        { header: "Vergi Dairesi Adı", render: (it) => <span className="fw-medium">{it.ad}</span> },
      ],
      filterFn: (it, term) => {
        const t = term.toLowerCase();
        return (it.ad && it.ad.toLowerCase().includes(t)) || String(it.id).includes(t);
      },
      onSelect: (it) => {
        handleChange("VERGI_DAIRESI_ID", it.id);
        setLookupModalConfig((prev) => ({ ...prev, show: false }));
      },
    });
  };

  const openIlLookup = () => {
    setLookupModalConfig({
      show: true,
      title: "İl Seçimi",
      items: lookups.ilList,
      columns: [
        { header: "Plaka / ID", render: (it) => <span className="font-monospace fw-semibold">{it.id}</span>, width: "100px" },
        { header: "İl Adı", render: (it) => <span className="fw-medium">{it.ad}</span> },
      ],
      filterFn: (it, term) => {
        const t = term.toLowerCase();
        return (it.ad && it.ad.toLowerCase().includes(t)) || String(it.id).includes(t);
      },
      onSelect: (it) => {
        handleChange("IL_ID", it.id);
        setLookupModalConfig((prev) => ({ ...prev, show: false }));
      },
    });
  };

  const openIlceLookup = () => {
    const list = formData.IL_ID 
      ? lookups.ilceList.filter((x: any) => x.ustId === formData.IL_ID || !x.ustId) 
      : lookups.ilceList;
    setLookupModalConfig({
      show: true,
      title: formData.IL_ID ? `İlçe Seçimi (${getIlName(formData.IL_ID)})` : "İlçe Seçimi",
      items: list,
      columns: [
        { header: "ID", render: (it) => <span className="font-monospace fw-semibold">{it.id}</span>, width: "90px" },
        { header: "İlçe Adı", render: (it) => <span className="fw-medium">{it.ad}</span> },
        { header: "Bağlı İl", render: (it) => <span className="text-muted">{it.ilAdi || it.ustId || "-"}</span>, width: "140px" },
      ],
      filterFn: (it, term) => {
        const t = term.toLowerCase();
        return (it.ad && it.ad.toLowerCase().includes(t)) || String(it.id).includes(t);
      },
      onSelect: (it) => {
        handleChange("ILCE_ID", it.id);
        setLookupModalConfig((prev) => ({ ...prev, show: false }));
      },
    });
  };

  const openPostaKoduLookup = () => {
    setLookupModalConfig({
      show: true,
      title: "Posta Kodu Seçimi",
      items: lookups.postaKoduList,
      columns: [
        { header: "Posta Kodu", render: (it) => <Badge bg="primary" className="font-monospace">{it.kod || it.id}</Badge>, width: "120px" },
        { header: "Bölge / Mahalle", render: (it) => <span className="fw-medium">{it.ad}</span> },
        { header: "İl / İlçe", render: (it) => <span className="text-muted">{`${it.il || ""} ${it.ilce || ""}`.trim() || "-"}</span>, width: "160px" },
      ],
      filterFn: (it, term) => {
        const t = term.toLowerCase();
        return (it.kod && String(it.kod).includes(t)) || (it.ad && it.ad.toLowerCase().includes(t)) || (it.il && it.il.toLowerCase().includes(t));
      },
      onSelect: (it) => {
        handleChange("POSTA_KODU_ID", it.id || Number(it.kod));
        setLookupModalConfig((prev) => ({ ...prev, show: false }));
      },
    });
  };

  const openUlkeLookup = () => {
    setLookupModalConfig({
      show: true,
      title: "Ülke Seçimi",
      items: lookups.ulkeList,
      columns: [
        { header: "ID", render: (it) => <span className="font-monospace fw-semibold">{it.id}</span>, width: "90px" },
        { header: "Kod", render: (it) => <span className="badge bg-light text-dark border font-monospace">{it.kod || "-"}</span>, width: "90px" },
        { header: "Ülke Adı", render: (it) => <span className="fw-medium">{it.ad}</span> },
      ],
      filterFn: (it, term) => {
        const t = term.toLowerCase();
        return (it.ad && it.ad.toLowerCase().includes(t)) || (it.kod && it.kod.toLowerCase().includes(t)) || String(it.id).includes(t);
      },
      onSelect: (it) => {
        handleChange("ULKE_ID", it.id);
        setLookupModalConfig((prev) => ({ ...prev, show: false }));
      },
    });
  };

  const openParaLookup = (field: keyof TodvzTanimDto, title: string) => {
    setLookupModalConfig({
      show: true,
      title,
      items: lookups.paraList,
      columns: [
        { header: "ID", render: (it) => <span className="font-monospace fw-semibold">{it.id}</span>, width: "80px" },
        { header: "Döviz Kodu", render: (it) => <Badge bg="success" className="font-monospace px-2 py-1">{it.kod}</Badge>, width: "110px" },
        { header: "Para Tanımı", render: (it) => <span className="fw-medium">{it.ad}</span> },
      ],
      filterFn: (it, term) => {
        const t = term.toLowerCase();
        return (it.kod && it.kod.toLowerCase().includes(t)) || (it.ad && it.ad.toLowerCase().includes(t)) || String(it.id).includes(t);
      },
      onSelect: (it) => {
        handleChange(field, it.id);
        setLookupModalConfig((prev) => ({ ...prev, show: false }));
      },
    });
  };

  const openIstatistikLookup = (field: keyof TodvzTanimDto, title: string) => {
    setLookupModalConfig({
      show: true,
      title,
      items: lookups.istatistikList,
      columns: [
        { header: "ID", render: (it) => <span className="font-monospace fw-semibold">{it.id}</span>, width: "80px" },
        { header: "Kod", render: (it) => <Badge bg="secondary" className="font-monospace">{it.kod}</Badge>, width: "120px" },
        { header: "Açıklama", render: (it) => <span className="fw-medium">{it.ad}</span> },
      ],
      filterFn: (it, term) => {
        const t = term.toLowerCase();
        return (it.kod && it.kod.toLowerCase().includes(t)) || (it.ad && it.ad.toLowerCase().includes(t)) || String(it.id).includes(t);
      },
      onSelect: (it) => {
        handleChange(field, it.id);
        setLookupModalConfig((prev) => ({ ...prev, show: false }));
      },
    });
  };

  const openSermayeHesabiLookup = async () => {
    const list = await ensureCariKartlar();
    setLookupModalConfig({
      show: true,
      title: "Sermaye Hesabı (Cari Kart) Seçimi",
      items: list,
      columns: [
        { header: "Cari Kodu", render: (it) => <Badge bg="info" className="font-monospace">{it.kod}</Badge>, width: "140px" },
        { header: "Cari Ünvanı", render: (it) => <span className="fw-medium">{it.ad}</span> },
        { header: "Vergi No", render: (it) => <span className="font-monospace small text-muted">{it.vergiKimlikNo || "-"}</span>, width: "130px" },
      ],
      filterFn: (it, term) => {
        const t = term.toLowerCase();
        return (it.kod && it.kod.toLowerCase().includes(t)) || (it.ad && it.ad.toLowerCase().includes(t)) || (it.vergiKimlikNo && it.vergiKimlikNo.includes(t));
      },
      onSelect: (it) => {
        handleChange("SERMAYE_HESABI_ID", it.id);
        setLookupModalConfig((prev) => ({ ...prev, show: false }));
      },
    });
  };

  // Load Company Definitions from Active MSSQL DB
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
    loadDefinitions(true);
    loadLookups();
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
          <Card.Header className="bg-light-subtle p-2.5 border-bottom">
            <div className="d-flex flex-column gap-2">
              {/* 1. Satır: Tab 1, 2, 3, 4 */}
              <Nav variant="pills" className="d-flex flex-wrap gap-2 border-0">
                <Nav.Item>
                  <Nav.Link eventKey="genel" className="d-flex align-items-center gap-1.5 py-2 px-3 fw-semibold rounded-2 border bg-white shadow-xs">
                    <IconBuildingStore size={17} className="text-primary me-1" />
                    <span>1. Genel & Firma Bilgileri</span>
                  </Nav.Link>
                </Nav.Item>

                <Nav.Item>
                  <Nav.Link eventKey="para" className="d-flex align-items-center gap-1.5 py-2 px-3 fw-semibold rounded-2 border bg-white shadow-xs">
                    <IconCoin size={17} className="text-warning me-1" />
                    <span>2. Para & Kuruş & Oranlar</span>
                  </Nav.Link>
                </Nav.Item>

                <Nav.Item>
                  <Nav.Link eventKey="muhasebe" className="d-flex align-items-center gap-1.5 py-2 px-3 fw-semibold rounded-2 border bg-white shadow-xs">
                    <IconReceipt2 size={17} className="text-success me-1" />
                    <span>3. Muhasebe & Hesap Planı</span>
                  </Nav.Link>
                </Nav.Item>

                <Nav.Item>
                  <Nav.Link eventKey="limitler" className="d-flex align-items-center gap-1.5 py-2 px-3 fw-semibold rounded-2 border bg-white shadow-xs">
                    <IconScale size={17} className="text-info me-1" />
                    <span>4. Limitler & Vergi & Tolerans</span>
                  </Nav.Link>
                </Nav.Item>
              </Nav>

              {/* 2. Satır (Alt Satır): Tab 5, 6 - Yana kaymaz */}
              <Nav variant="pills" className="d-flex flex-wrap gap-2 border-0">
                <Nav.Item>
                  <Nav.Link eventKey="ebelge" className="d-flex align-items-center gap-1.5 py-2 px-3 fw-semibold rounded-2 border bg-white shadow-xs">
                    <IconFileCertificate size={17} className="text-danger me-1" />
                    <span>5. E-Belge, E-Fatura & Server</span>
                  </Nav.Link>
                </Nav.Item>

                <Nav.Item>
                  <Nav.Link eventKey="sistem" className="d-flex align-items-center gap-1.5 py-2 px-3 fw-semibold rounded-2 border bg-white shadow-xs">
                    <IconAdjustments size={17} className="text-secondary me-1" />
                    <span>6. Fiş, Cari & Sistem</span>
                  </Nav.Link>
                </Nav.Item>
              </Nav>
            </div>
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
                        <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Vergi Dairesi:</Form.Label>
                        <Col sm={8}>
                          <InputGroup size="sm">
                            <Form.Control
                              type="number"
                              value={formData.VERGI_DAIRESI_ID ?? ""}
                              onChange={(e) => handleChange("VERGI_DAIRESI_ID", e.target.value === "" ? null : Number(e.target.value))}
                              className="bg-white border font-monospace"
                              style={{ maxWidth: "80px" }}
                              placeholder="ID"
                            />
                            <div className="form-control form-control-sm bg-light text-truncate text-secondary" style={{ fontSize: "0.82rem" }} title={getVergiDairesiName(formData.VERGI_DAIRESI_ID)}>
                              {getVergiDairesiName(formData.VERGI_DAIRESI_ID) || "Vergi dairesi seçilmedi"}
                            </div>
                            <Button
                              variant="outline-primary"
                              onClick={openVergiDairesiLookup}
                              title="Listeden Seç (Dürbün)"
                              className="d-flex align-items-center px-2.5"
                            >
                              <IconBinoculars size={16} />
                            </Button>
                            {formData.VERGI_DAIRESI_ID && (
                              <Button
                                variant="outline-secondary"
                                onClick={() => handleChange("VERGI_DAIRESI_ID", null)}
                                title="Temizle"
                                className="px-2"
                              >
                                <IconX size={14} />
                              </Button>
                            )}
                          </InputGroup>
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
                        <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Posta Kodu:</Form.Label>
                        <Col sm={8}>
                          <InputGroup size="sm">
                            <Form.Control
                              type="number"
                              value={formData.POSTA_KODU_ID ?? ""}
                              onChange={(e) => handleChange("POSTA_KODU_ID", e.target.value === "" ? null : Number(e.target.value))}
                              className="bg-white border font-monospace"
                              style={{ maxWidth: "90px" }}
                              placeholder="PK ID"
                            />
                            <div className="form-control form-control-sm bg-light text-truncate text-secondary" style={{ fontSize: "0.82rem" }} title={getPostaKoduName(formData.POSTA_KODU_ID)}>
                              {getPostaKoduName(formData.POSTA_KODU_ID) || "Posta kodu seçilmedi"}
                            </div>
                            <Button
                              variant="outline-primary"
                              onClick={openPostaKoduLookup}
                              title="Listeden Seç (Dürbün)"
                              className="d-flex align-items-center px-2.5"
                            >
                              <IconBinoculars size={16} />
                            </Button>
                            {formData.POSTA_KODU_ID && (
                              <Button
                                variant="outline-secondary"
                                onClick={() => handleChange("POSTA_KODU_ID", null)}
                                title="Temizle"
                                className="px-2"
                              >
                                <IconX size={14} />
                              </Button>
                            )}
                          </InputGroup>
                        </Col>
                      </Form.Group>
                    </Col>

                    <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
                        <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">İlçe:</Form.Label>
                        <Col sm={8}>
                          <InputGroup size="sm">
                            <Form.Control
                              type="number"
                              value={formData.ILCE_ID ?? ""}
                              onChange={(e) => handleChange("ILCE_ID", e.target.value === "" ? null : Number(e.target.value))}
                              className="bg-white border font-monospace"
                              style={{ maxWidth: "80px" }}
                              placeholder="ID"
                            />
                            <div className="form-control form-control-sm bg-light text-truncate text-secondary" style={{ fontSize: "0.82rem" }} title={getIlceName(formData.ILCE_ID)}>
                              {getIlceName(formData.ILCE_ID) || "İlçe seçilmedi"}
                            </div>
                            <Button
                              variant="outline-primary"
                              onClick={openIlceLookup}
                              title="Listeden Seç (Dürbün)"
                              className="d-flex align-items-center px-2.5"
                            >
                              <IconBinoculars size={16} />
                            </Button>
                            {formData.ILCE_ID && (
                              <Button
                                variant="outline-secondary"
                                onClick={() => handleChange("ILCE_ID", null)}
                                title="Temizle"
                                className="px-2"
                              >
                                <IconX size={14} />
                              </Button>
                            )}
                          </InputGroup>
                        </Col>
                      </Form.Group>
                    </Col>

                    <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
                        <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">İl:</Form.Label>
                        <Col sm={8}>
                          <InputGroup size="sm">
                            <Form.Control
                              type="number"
                              value={formData.IL_ID ?? ""}
                              onChange={(e) => handleChange("IL_ID", e.target.value === "" ? null : Number(e.target.value))}
                              className="bg-white border font-monospace"
                              style={{ maxWidth: "80px" }}
                              placeholder="Plaka/ID"
                            />
                            <div className="form-control form-control-sm bg-light text-truncate text-secondary" style={{ fontSize: "0.82rem" }} title={getIlName(formData.IL_ID)}>
                              {getIlName(formData.IL_ID) || "İl seçilmedi"}
                            </div>
                            <Button
                              variant="outline-primary"
                              onClick={openIlLookup}
                              title="Listeden Seç (Dürbün)"
                              className="d-flex align-items-center px-2.5"
                            >
                              <IconBinoculars size={16} />
                            </Button>
                            {formData.IL_ID && (
                              <Button
                                variant="outline-secondary"
                                onClick={() => handleChange("IL_ID", null)}
                                title="Temizle"
                                className="px-2"
                              >
                                <IconX size={14} />
                              </Button>
                            )}
                          </InputGroup>
                        </Col>
                      </Form.Group>
                    </Col>

                    <Col xs={12} md={6}>
                      <Form.Group as={Row} className="mb-2 align-items-center">
                        <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Ülke:</Form.Label>
                        <Col sm={8}>
                          <InputGroup size="sm">
                            <Form.Control
                              type="number"
                              value={formData.ULKE_ID ?? ""}
                              onChange={(e) => handleChange("ULKE_ID", e.target.value === "" ? null : Number(e.target.value))}
                              className="bg-white border font-monospace"
                              style={{ maxWidth: "80px" }}
                              placeholder="ID"
                            />
                            <div className="form-control form-control-sm bg-light text-truncate text-secondary" style={{ fontSize: "0.82rem" }} title={getUlkeName(formData.ULKE_ID)}>
                              {getUlkeName(formData.ULKE_ID) || "Ülke seçilmedi"}
                            </div>
                            <Button
                              variant="outline-primary"
                              onClick={openUlkeLookup}
                              title="Listeden Seç (Dürbün)"
                              className="d-flex align-items-center px-2.5"
                            >
                              <IconBinoculars size={16} />
                            </Button>
                            {formData.ULKE_ID && (
                              <Button
                                variant="outline-secondary"
                                onClick={() => handleChange("ULKE_ID", null)}
                                title="Temizle"
                                className="px-2"
                              >
                                <IconX size={14} />
                              </Button>
                            )}
                          </InputGroup>
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
                              <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">USD Para:</Form.Label>
                              <Col sm={8}>
                                <InputGroup size="sm">
                                  <Form.Control
                                    type="number"
                                    value={formData.USD_PARA_ID ?? 2}
                                    onChange={(e) => handleChange("USD_PARA_ID", Number(e.target.value))}
                                    className="bg-white border font-monospace"
                                    style={{ maxWidth: "75px" }}
                                    placeholder="ID"
                                  />
                                  <div className="form-control form-control-sm bg-light text-truncate text-secondary" style={{ fontSize: "0.82rem" }} title={getParaName(formData.USD_PARA_ID)}>
                                    {getParaName(formData.USD_PARA_ID) || "USD"}
                                  </div>
                                  <Button
                                    variant="outline-primary"
                                    onClick={() => openParaLookup("USD_PARA_ID", "USD Para Birimi Seçimi")}
                                    title="Listeden Seç (Dürbün)"
                                    className="d-flex align-items-center px-2.5"
                                  >
                                    <IconBinoculars size={16} />
                                  </Button>
                                </InputGroup>
                              </Col>
                            </Form.Group>
                          </Col>
                          <Col xs={12} md={6}>
                            <Form.Group as={Row} className="mb-2 align-items-center">
                              <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">EUR Para:</Form.Label>
                              <Col sm={8}>
                                <InputGroup size="sm">
                                  <Form.Control
                                    type="number"
                                    value={formData.EUR_PARA_ID ?? 3}
                                    onChange={(e) => handleChange("EUR_PARA_ID", Number(e.target.value))}
                                    className="bg-white border font-monospace"
                                    style={{ maxWidth: "75px" }}
                                    placeholder="ID"
                                  />
                                  <div className="form-control form-control-sm bg-light text-truncate text-secondary" style={{ fontSize: "0.82rem" }} title={getParaName(formData.EUR_PARA_ID)}>
                                    {getParaName(formData.EUR_PARA_ID) || "EUR"}
                                  </div>
                                  <Button
                                    variant="outline-primary"
                                    onClick={() => openParaLookup("EUR_PARA_ID", "EUR Para Birimi Seçimi")}
                                    title="Listeden Seç (Dürbün)"
                                    className="d-flex align-items-center px-2.5"
                                  >
                                    <IconBinoculars size={16} />
                                  </Button>
                                </InputGroup>
                              </Col>
                            </Form.Group>
                          </Col>
                          <Col xs={12} md={6}>
                            <Form.Group as={Row} className="mb-2 align-items-center">
                              <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Rapor Para:</Form.Label>
                              <Col sm={8}>
                                <InputGroup size="sm">
                                  <Form.Control
                                    type="number"
                                    value={formData.RAPOR_PARA_ID ?? 2}
                                    onChange={(e) => handleChange("RAPOR_PARA_ID", Number(e.target.value))}
                                    className="bg-white border font-monospace"
                                    style={{ maxWidth: "75px" }}
                                    placeholder="ID"
                                  />
                                  <div className="form-control form-control-sm bg-light text-truncate text-secondary" style={{ fontSize: "0.82rem" }} title={getParaName(formData.RAPOR_PARA_ID)}>
                                    {getParaName(formData.RAPOR_PARA_ID) || "USD"}
                                  </div>
                                  <Button
                                    variant="outline-primary"
                                    onClick={() => openParaLookup("RAPOR_PARA_ID", "Rapor Para Birimi Seçimi")}
                                    title="Listeden Seç (Dürbün)"
                                    className="d-flex align-items-center px-2.5"
                                  >
                                    <IconBinoculars size={16} />
                                  </Button>
                                </InputGroup>
                              </Col>
                            </Form.Group>
                          </Col>
                          <Col xs={12} md={6}>
                            <Form.Group as={Row} className="mb-2 align-items-center">
                              <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Favori Para:</Form.Label>
                              <Col sm={8}>
                                <InputGroup size="sm">
                                  <Form.Control
                                    type="number"
                                    value={formData.FAVORI_PARA_ID ?? 2}
                                    onChange={(e) => handleChange("FAVORI_PARA_ID", e.target.value === "" ? null : Number(e.target.value))}
                                    className="bg-white border font-monospace"
                                    style={{ maxWidth: "75px" }}
                                    placeholder="ID"
                                  />
                                  <div className="form-control form-control-sm bg-light text-truncate text-secondary" style={{ fontSize: "0.82rem" }} title={getParaName(formData.FAVORI_PARA_ID)}>
                                    {getParaName(formData.FAVORI_PARA_ID) || "Seçilmedi"}
                                  </div>
                                  <Button
                                    variant="outline-primary"
                                    onClick={() => openParaLookup("FAVORI_PARA_ID", "Favori Para Birimi Seçimi")}
                                    title="Listeden Seç (Dürbün)"
                                    className="d-flex align-items-center px-2.5"
                                  >
                                    <IconBinoculars size={16} />
                                  </Button>
                                </InputGroup>
                              </Col>
                            </Form.Group>
                          </Col>
                          <Col xs={12} md={6}>
                            <Form.Group as={Row} className="mb-2 align-items-center">
                              <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Has Altın Para:</Form.Label>
                              <Col sm={8}>
                                <InputGroup size="sm">
                                  <Form.Control
                                    type="number"
                                    value={formData.HAS_ALTIN_PARA_ID ?? ""}
                                    onChange={(e) => handleChange("HAS_ALTIN_PARA_ID", e.target.value === "" ? null : Number(e.target.value))}
                                    className="bg-white border font-monospace"
                                    style={{ maxWidth: "75px" }}
                                    placeholder="ID"
                                  />
                                  <div className="form-control form-control-sm bg-light text-truncate text-secondary" style={{ fontSize: "0.82rem" }} title={getParaName(formData.HAS_ALTIN_PARA_ID)}>
                                    {getParaName(formData.HAS_ALTIN_PARA_ID) || "Has Altın"}
                                  </div>
                                  <Button
                                    variant="outline-primary"
                                    onClick={() => openParaLookup("HAS_ALTIN_PARA_ID", "Has Altın Para Birimi Seçimi")}
                                    title="Listeden Seç (Dürbün)"
                                    className="d-flex align-items-center px-2.5"
                                  >
                                    <IconBinoculars size={16} />
                                  </Button>
                                </InputGroup>
                              </Col>
                            </Form.Group>
                          </Col>
                          <Col xs={12} md={6}>
                            <Form.Group as={Row} className="mb-2 align-items-center">
                              <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Has Gümüş Para:</Form.Label>
                              <Col sm={8}>
                                <InputGroup size="sm">
                                  <Form.Control
                                    type="number"
                                    value={formData.HAS_GUMUS_PARA_ID ?? ""}
                                    onChange={(e) => handleChange("HAS_GUMUS_PARA_ID", e.target.value === "" ? null : Number(e.target.value))}
                                    className="bg-white border font-monospace"
                                    style={{ maxWidth: "75px" }}
                                    placeholder="ID"
                                  />
                                  <div className="form-control form-control-sm bg-light text-truncate text-secondary" style={{ fontSize: "0.82rem" }} title={getParaName(formData.HAS_GUMUS_PARA_ID)}>
                                    {getParaName(formData.HAS_GUMUS_PARA_ID) || "Has Gümüş"}
                                  </div>
                                  <Button
                                    variant="outline-primary"
                                    onClick={() => openParaLookup("HAS_GUMUS_PARA_ID", "Has Gümüş Para Birimi Seçimi")}
                                    title="Listeden Seç (Dürbün)"
                                    className="d-flex align-items-center px-2.5"
                                  >
                                    <IconBinoculars size={16} />
                                  </Button>
                                </InputGroup>
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
                                <InputGroup size="sm">
                                  <Form.Control
                                    type="number"
                                    value={formData.ALIS_ISTATISTIK_ID ?? 2}
                                    onChange={(e) => handleChange("ALIS_ISTATISTIK_ID", Number(e.target.value))}
                                    className="bg-white border font-monospace"
                                    style={{ maxWidth: "75px" }}
                                    placeholder="ID"
                                  />
                                  <div className="form-control form-control-sm bg-light text-truncate text-secondary" style={{ fontSize: "0.82rem" }} title={getIstatistikName(formData.ALIS_ISTATISTIK_ID)}>
                                    {getIstatistikName(formData.ALIS_ISTATISTIK_ID) || "Alış"}
                                  </div>
                                  <Button
                                    variant="outline-primary"
                                    onClick={() => openIstatistikLookup("ALIS_ISTATISTIK_ID", "Alış İstatistik Grubu Seçimi")}
                                    title="Listeden Seç (Dürbün)"
                                    className="d-flex align-items-center px-2.5"
                                  >
                                    <IconBinoculars size={16} />
                                  </Button>
                                </InputGroup>
                              </Col>
                            </Form.Group>
                          </Col>

                          <Col xs={12} md={6}>
                            <Form.Group as={Row} className="mb-2 align-items-center">
                              <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Satış İstatistik:</Form.Label>
                              <Col sm={8}>
                                <InputGroup size="sm">
                                  <Form.Control
                                    type="number"
                                    value={formData.SATIS_ISTATISTIK_ID ?? 3}
                                    onChange={(e) => handleChange("SATIS_ISTATISTIK_ID", Number(e.target.value))}
                                    className="bg-white border font-monospace"
                                    style={{ maxWidth: "75px" }}
                                    placeholder="ID"
                                  />
                                  <div className="form-control form-control-sm bg-light text-truncate text-secondary" style={{ fontSize: "0.82rem" }} title={getIstatistikName(formData.SATIS_ISTATISTIK_ID)}>
                                    {getIstatistikName(formData.SATIS_ISTATISTIK_ID) || "Satış"}
                                  </div>
                                  <Button
                                    variant="outline-primary"
                                    onClick={() => openIstatistikLookup("SATIS_ISTATISTIK_ID", "Satış İstatistik Grubu Seçimi")}
                                    title="Listeden Seç (Dürbün)"
                                    className="d-flex align-items-center px-2.5"
                                  >
                                    <IconBinoculars size={16} />
                                  </Button>
                                </InputGroup>
                              </Col>
                            </Form.Group>
                          </Col>

                          <Col xs={12} md={6}>
                            <Form.Group as={Row} className="mb-2 align-items-center">
                              <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Arbitraj Alış:</Form.Label>
                              <Col sm={8}>
                                <InputGroup size="sm">
                                  <Form.Control
                                    type="number"
                                    value={formData.ARBITRAJ_ALIS_ISTATISTIK_ID ?? 2}
                                    onChange={(e) => handleChange("ARBITRAJ_ALIS_ISTATISTIK_ID", Number(e.target.value))}
                                    className="bg-white border font-monospace"
                                    style={{ maxWidth: "75px" }}
                                    placeholder="ID"
                                  />
                                  <div className="form-control form-control-sm bg-light text-truncate text-secondary" style={{ fontSize: "0.82rem" }} title={getIstatistikName(formData.ARBITRAJ_ALIS_ISTATISTIK_ID)}>
                                    {getIstatistikName(formData.ARBITRAJ_ALIS_ISTATISTIK_ID) || "Arbitraj Alış"}
                                  </div>
                                  <Button
                                    variant="outline-primary"
                                    onClick={() => openIstatistikLookup("ARBITRAJ_ALIS_ISTATISTIK_ID", "Arbitraj Alış İstatistik Seçimi")}
                                    title="Listeden Seç (Dürbün)"
                                    className="d-flex align-items-center px-2.5"
                                  >
                                    <IconBinoculars size={16} />
                                  </Button>
                                </InputGroup>
                              </Col>
                            </Form.Group>
                          </Col>

                          <Col xs={12} md={6}>
                            <Form.Group as={Row} className="mb-2 align-items-center">
                              <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Arbitraj Satış:</Form.Label>
                              <Col sm={8}>
                                <InputGroup size="sm">
                                  <Form.Control
                                    type="number"
                                    value={formData.ARBITRAJ_SATIS_ISTATISTIK_ID ?? 3}
                                    onChange={(e) => handleChange("ARBITRAJ_SATIS_ISTATISTIK_ID", Number(e.target.value))}
                                    className="bg-white border font-monospace"
                                    style={{ maxWidth: "75px" }}
                                    placeholder="ID"
                                  />
                                  <div className="form-control form-control-sm bg-light text-truncate text-secondary" style={{ fontSize: "0.82rem" }} title={getIstatistikName(formData.ARBITRAJ_SATIS_ISTATISTIK_ID)}>
                                    {getIstatistikName(formData.ARBITRAJ_SATIS_ISTATISTIK_ID) || "Arbitraj Satış"}
                                  </div>
                                  <Button
                                    variant="outline-primary"
                                    onClick={() => openIstatistikLookup("ARBITRAJ_SATIS_ISTATISTIK_ID", "Arbitraj Satış İstatistik Seçimi")}
                                    title="Listeden Seç (Dürbün)"
                                    className="d-flex align-items-center px-2.5"
                                  >
                                    <IconBinoculars size={16} />
                                  </Button>
                                </InputGroup>
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
                              <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Sermaye Hesabı:</Form.Label>
                              <Col sm={8}>
                                <InputGroup size="sm">
                                  <Form.Control
                                    type="number"
                                    value={formData.SERMAYE_HESABI_ID ?? ""}
                                    onChange={(e) => handleChange("SERMAYE_HESABI_ID", e.target.value === "" ? null : Number(e.target.value))}
                                    className="bg-white border font-monospace"
                                    style={{ maxWidth: "75px" }}
                                    placeholder="ID"
                                  />
                                  <div className="form-control form-control-sm bg-light text-truncate text-secondary" style={{ fontSize: "0.82rem" }} title={getCariName(formData.SERMAYE_HESABI_ID)}>
                                    {getCariName(formData.SERMAYE_HESABI_ID) || "Sermaye Cari/Hesap"}
                                  </div>
                                  <Button
                                    variant="outline-primary"
                                    onClick={openSermayeHesabiLookup}
                                    title="Listeden Seç (Dürbün)"
                                    className="d-flex align-items-center px-2.5"
                                  >
                                    <IconBinoculars size={16} />
                                  </Button>
                                  {formData.SERMAYE_HESABI_ID && (
                                    <Button
                                      variant="outline-secondary"
                                      onClick={() => handleChange("SERMAYE_HESABI_ID", null)}
                                      title="Temizle"
                                      className="px-2"
                                    >
                                      <IconX size={14} />
                                    </Button>
                                  )}
                                </InputGroup>
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
                              <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Döviz Sınır Para:</Form.Label>
                              <Col sm={8}>
                                <InputGroup size="sm">
                                  <Form.Control
                                    type="number"
                                    value={formData.DOVIZ_VERGI_SINIRI_PARA_ID ?? 2}
                                    onChange={(e) => handleChange("DOVIZ_VERGI_SINIRI_PARA_ID", e.target.value === "" ? null : Number(e.target.value))}
                                    className="bg-white border font-monospace"
                                    style={{ maxWidth: "75px" }}
                                    placeholder="ID"
                                  />
                                  <div className="form-control form-control-sm bg-light text-truncate text-secondary" style={{ fontSize: "0.82rem" }} title={getParaName(formData.DOVIZ_VERGI_SINIRI_PARA_ID)}>
                                    {getParaName(formData.DOVIZ_VERGI_SINIRI_PARA_ID) || "USD"}
                                  </div>
                                  <Button
                                    variant="outline-primary"
                                    onClick={() => openParaLookup("DOVIZ_VERGI_SINIRI_PARA_ID", "Döviz Sınır Para Birimi Seçimi")}
                                    title="Listeden Seç (Dürbün)"
                                    className="d-flex align-items-center px-2.5"
                                  >
                                    <IconBinoculars size={16} />
                                  </Button>
                                </InputGroup>
                              </Col>
                            </Form.Group>
                          </Col>

                          <Col xs={12} md={6}>
                            <Form.Group as={Row} className="mb-2 align-items-center">
                              <Form.Label column sm={4} className="small fw-semibold text-secondary text-sm-end pe-2 mb-0">Altın Sınır Para:</Form.Label>
                              <Col sm={8}>
                                <InputGroup size="sm">
                                  <Form.Control
                                    type="number"
                                    value={formData.ALTIN_VERGI_SINIRI_PARA_ID ?? 2}
                                    onChange={(e) => handleChange("ALTIN_VERGI_SINIRI_PARA_ID", e.target.value === "" ? null : Number(e.target.value))}
                                    className="bg-white border font-monospace"
                                    style={{ maxWidth: "75px" }}
                                    placeholder="ID"
                                  />
                                  <div className="form-control form-control-sm bg-light text-truncate text-secondary" style={{ fontSize: "0.82rem" }} title={getParaName(formData.ALTIN_VERGI_SINIRI_PARA_ID)}>
                                    {getParaName(formData.ALTIN_VERGI_SINIRI_PARA_ID) || "USD"}
                                  </div>
                                  <Button
                                    variant="outline-primary"
                                    onClick={() => openParaLookup("ALTIN_VERGI_SINIRI_PARA_ID", "Altın Sınır Para Birimi Seçimi")}
                                    title="Listeden Seç (Dürbün)"
                                    className="d-flex align-items-center px-2.5"
                                  >
                                    <IconBinoculars size={16} />
                                  </Button>
                                </InputGroup>
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

      {/* Reusable Lookup Modal for all Dürbün selections */}
      <LookupModal
        show={lookupModalConfig.show}
        onHide={() => setLookupModalConfig((prev) => ({ ...prev, show: false }))}
        title={lookupModalConfig.title}
        items={lookupModalConfig.items}
        columns={lookupModalConfig.columns}
        filterFn={lookupModalConfig.filterFn}
        onSelect={lookupModalConfig.onSelect}
      />
    </div>
  );
};

export default CompanyDefinitionsPage;
