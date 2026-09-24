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
  Modal,
} from "react-bootstrap";
import {
  IconBuildingStore,
  IconCoin,
  IconReceipt2,
  IconScale,
  IconAdjustments,
  IconFileCertificate,
  IconCheck,
  IconAlertCircle,
  IconRefresh,
  IconBinoculars,
  IconDownload,
} from "@tabler/icons-react";

import ERPToolbar from "components/common/ERPToolbar";
import { printReportTable } from "../../utils/printReport";
import { CompanyService, TodvzTanimDto, defaultCompanyTanim } from "../../services/companyService";
import LookupModal, { LookupColumn } from "../../components/common/LookupModal";
import useERPAutoFocus from "../../hooks/useERPAutoFocus";
import { CariService, CariLookups, LookupItem, CariKartItem, DEFAULT_POSTA_KODLARI } from "../../services/cariService";
import { KasaService, HesapItem } from "../../services/kasaService";
import { IskontoService, IskontoItem } from "../../services/iskontoService";
import { onlyDecimal, onlyDigits, blockNonNumericKeys } from "../../utils/numericInput";
import { ebelgeService } from "../../services/ebelgeService";
import { GibKullanici, gibAliasToEposta, gibKullanicilariTekillestir } from "../../utils/gibKullanici";

export const CompanyDefinitionsPage: React.FC = () => {
  useERPAutoFocus();
  const labelColStyle = { width: "160px", flex: "0 0 160px", maxWidth: "160px" };
  const labelColStyleIletisim = { width: "95px", flex: "0 0 95px", maxWidth: "95px" };
  const labelColStyleParaId = { width: "105px", flex: "0 0 105px", maxWidth: "105px" };
  const labelColStyleBasamak = { width: "135px", flex: "0 0 135px", maxWidth: "135px" };
  const labelColStyleOran = { width: "125px", flex: "0 0 125px", maxWidth: "125px" };
  const labelColStyleIstatistik = { width: "105px", flex: "0 0 105px", maxWidth: "105px" };
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
    URETIM_HESABI_ID: null,
    URETIM_HESABI: "",
    ISKONTO_ID: null,
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
  const [activeTab, setActiveTab] = useState<string>("genel");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [alertSuccess, setAlertSuccess] = useState<string | null>(null);
  const [alertError, setAlertError] = useState<string | null>(null);
  const [isGibSorgulaniyor, setIsGibSorgulaniyor] = useState<boolean>(false);
  const [targetGibField, setTargetGibField] = useState<"E_FATURA_POSTA_KUTUSU" | "E_IRSALIYE_POSTA_KUTUSU">("E_FATURA_POSTA_KUTUSU");
  const [gibSecimListesi, setGibSecimListesi] = useState<GibKullanici[]>([]);

  const gibKaydiniUygula = (k: GibKullanici, field: "E_FATURA_POSTA_KUTUSU" | "E_IRSALIYE_POSTA_KUTUSU") => {
    const alias = k.Alias || k.Identifier || "";
    setFormData((prev) => ({
      ...prev,
      [field]: alias,
    }));
    setGibSecimListesi([]);
    setAlertSuccess(`✅ GİB posta kutusu dolduruldu: ${alias}`);
  };

  const handleGibtenGetir = async (field: "E_FATURA_POSTA_KUTUSU" | "E_IRSALIYE_POSTA_KUTUSU") => {
    const vkn = (formData.VERGI_KIMLIK_NO || "").replace(/\D/g, "");
    if (vkn.length !== 10 && vkn.length !== 11) {
      setAlertError("GİB'ten posta kutusu getirmek için önce Genel sekmesinde geçerli bir 10 haneli VKN veya 11 haneli TCKN giriniz.");
      return;
    }
    setTargetGibField(field);
    try {
      setIsGibSorgulaniyor(true);
      setAlertError(null);
      const sonuc = await ebelgeService.mukellefSorgula(vkn);
      if (!sonuc.mukellefMi || !sonuc.kullanicilar || sonuc.kullanicilar.length === 0) {
        setAlertError("Bu VKN/TCKN için GİB'de kayıtlı bir e-Belge posta kutusu bulunamadı (mükellef değil).");
        return;
      }
      const liste = gibKullanicilariTekillestir(sonuc.kullanicilar);
      if (liste.length === 1) {
        gibKaydiniUygula(liste[0], field);
      } else {
        setGibSecimListesi(liste);
      }
    } catch (err: any) {
      setAlertError(`❌ GİB sorgusu başarısız: ${err.message || "Bilinmeyen hata"}`);
    } finally {
      setIsGibSorgulaniyor(false);
    }
  };

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
  const [hesapList, setHesapList] = useState<HesapItem[]>([]);
  const [iskontoList, setIskontoList] = useState<IskontoItem[]>([]);
  const [lookupModalConfig, setLookupModalConfig] = useState<{
    show: boolean;
    title: string;
    items: any[];
    selectedId?: any;
    initialSearchTerm?: string;
    columns: LookupColumn<any>[];
    filterFn: (item: any, term: string) => boolean;
    onSelect: (item: any) => void;
  }>({
    show: false,
    title: "",
    items: [],
    selectedId: null,
    initialSearchTerm: "",
    columns: [],
    filterFn: () => true,
    onSelect: () => { },
  });

  const ensureLookups = async (): Promise<CariLookups> => {
    if (
      lookups.vergiDairesiList.length > 0 ||
      lookups.ilList.length > 0 ||
      lookups.paraList.length > 0
    ) {
      return lookups;
    }
    try {
      const data = await CariService.getLookups().catch(() => null);
      if (data) {
        setLookups(data);
        return data;
      }
    } catch (err) {
      console.error("Lookups yüklenemedi:", err);
    }
    return lookups;
  };

  const ensureHesaplar = async (): Promise<HesapItem[]> => {
    if (hesapList.length > 0) return hesapList;
    try {
      const data = await KasaService.getHesaplar().catch(() => []);
      if (data && data.length > 0) {
        setHesapList(data);
        return data;
      }
    } catch (err) {
      console.error("Hesaplar yüklenemedi:", err);
    }
    return hesapList;
  };

  const ensureIskontolar = async (): Promise<IskontoItem[]> => {
    if (iskontoList.length > 0) return iskontoList;
    try {
      const data = await IskontoService.getIskontolar().catch(() => []);
      if (data && data.length > 0) {
        setIskontoList(data);
        return data;
      }
    } catch (err) {
      console.error("İskontolar yüklenemedi:", err);
    }
    return iskontoList;
  };

  const loadLookups = async () => {
    try {
      const [data, hesaplar, iskontolar] = await Promise.all([
        CariService.getLookups().catch(() => null),
        KasaService.getHesaplar().catch(() => []),
        IskontoService.getIskontolar().catch(() => []),
      ]);
      if (data) setLookups(data);
      if (hesaplar) setHesapList(hesaplar);
      if (iskontolar) setIskontoList(iskontolar);
    } catch (err) {
      console.error("Lookups yüklenirken hata:", err);
    }
  };

  const ensureCariKartlar = async (): Promise<CariKartItem[]> => {
    if (cariKartlar.length === 0) {
      try {
        const list = await CariService.getCariKartlar().catch(() => []);
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
  const getHesapName = (id?: number | null) => {
    if (!id) return "";
    const it = hesapList.find((x) => x.hesapId === id || Number(x.hesapId) === Number(id));
    return it ? `${it.kod || ""} - ${it.ad || ""}`.trim() : "";
  };

  const getVergiDairesiName = (id?: number | null) => {
    if (!id) return "";
    const it = lookups.vergiDairesiList.find((x) => x.id === id || Number(x.id) === Number(id));
    return it ? it.ad : "";
  };

  const getIlName = (id?: number | null) => {
    if (!id) return "";
    const it = lookups.ilList.find((x) => x.id === id || Number(x.id) === Number(id));
    return it ? it.ad : "";
  };

  const getIlceName = (id?: number | null) => {
    if (!id) return "";
    const it = lookups.ilceList.find((x) => x.id === id || Number(x.id) === Number(id));
    return it ? it.ad : "";
  };

  const getPostaKoduName = (id?: number | null) => {
    if (!id) return "";
    const list = lookups.postaKoduList && lookups.postaKoduList.length > 0 ? lookups.postaKoduList : DEFAULT_POSTA_KODLARI;
    const it = list.find((x) => x.id === id || Number(x.id) === Number(id) || x.kod === String(id));
    return it ? it.ad : "";
  };

  const getUlkeName = (id?: number | null) => {
    if (!id) return "";
    const it = lookups.ulkeList.find((x) => x.id === id || Number(x.id) === Number(id));
    return it ? it.ad : "";
  };

  const getParaName = (id?: number | null) => {
    if (!id) return "";
    const it = lookups.paraList.find((x) => x.id === id || Number(x.id) === Number(id));
    return it ? `${it.kod || ""} - ${it.ad || ""}`.trim() : "";
  };

  const getIstatistikName = (id?: number | null) => {
    if (!id) return "";
    const it = lookups.istatistikList.find((x) => x.id === id || Number(x.id) === Number(id));
    return it ? `${it.kod || ""} - ${it.ad || ""}`.trim() : "";
  };

  const getCariName = (id?: number | null) => {
    if (!id) return "";
    const it = cariKartlar.find((x) => x.id === id || Number(x.id) === Number(id));
    return it ? `${it.kod || ""} - ${it.ad || ""}`.trim() : "";
  };

  const getIskontoName = (id?: number | null) => {
    if (!id) return "";
    const found = iskontoList.find((x) => x.iskontoId === id || Number(x.iskontoId) === Number(id));
    if (!found) return `ID: ${id}`;
    return `${found.kod ? `[${found.kod}] ` : ""}${found.tanim}`;
  };

  // Lookup Modals
  const openVergiDairesiLookup = async () => {
    const lk = await ensureLookups();
    setLookupModalConfig({
      show: true,
      title: "Vergi Dairesi Seçimi",
      items: lk.vergiDairesiList || [],
      selectedId: formData.VERGI_DAIRESI_ID,
      columns: [
        { header: "ID", render: (it) => <span className="font-monospace fw-semibold">{it.id}</span>, width: "80px" },
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

  const openIlLookup = async () => {
    const lk = await ensureLookups();
    setLookupModalConfig({
      show: true,
      title: "İl Seçimi (Plaka / Şehir)",
      items: lk.ilList || [],
      selectedId: formData.IL_ID,
      columns: [
        { header: "Plaka", render: (it) => <Badge bg="primary" className="font-monospace">{it.kod || it.id}</Badge>, width: "90px" },
        { header: "İl Adı", render: (it) => <span className="fw-medium">{it.ad}</span> },
      ],
      filterFn: (it, term) => {
        const t = term.toLowerCase();
        return (it.ad && it.ad.toLowerCase().includes(t)) || (it.kod && String(it.kod).includes(t)) || String(it.id).includes(t);
      },
      onSelect: (it) => {
        handleChange("IL_ID", it.id);
        setLookupModalConfig((prev) => ({ ...prev, show: false }));
      },
    });
  };

  const openIlceLookup = async () => {
    const lk = await ensureLookups();
    const list = formData.IL_ID
      ? (lk.ilceList || []).filter((x: any) => !x.ustId || x.ustId === formData.IL_ID || Number(x.ustId) === Number(formData.IL_ID))
      : lk.ilceList || [];
    setLookupModalConfig({
      show: true,
      title: "İlçe Seçimi",
      items: list.length > 0 ? list : lk.ilceList || [],
      selectedId: formData.ILCE_ID,
      columns: [
        { header: "ID", render: (it) => <span className="font-monospace fw-semibold">{it.id}</span>, width: "80px" },
        { header: "İlçe Adı", render: (it) => <span className="fw-medium">{it.ad}</span> },
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

  const openPostaKoduLookup = async () => {
    const lk = await ensureLookups();
    const list = lk.postaKoduList && lk.postaKoduList.length > 0 ? lk.postaKoduList : DEFAULT_POSTA_KODLARI;
    setLookupModalConfig({
      show: true,
      title: "Posta Kodu Seçimi",
      items: list,
      selectedId: formData.POSTA_KODU_ID,
      columns: [
        { header: "Posta Kodu", render: (it) => <Badge bg="primary" className="font-monospace">{it.kod || it.id}</Badge>, width: "120px" },
        { header: "Bölge / Mahalle", render: (it) => <span className="fw-medium">{it.ad}</span> },
        { header: "İl / İlçe", render: (it) => <span className="text-muted">{`${it.il || ""} ${it.ilce || ""}`.trim() || "-"}</span>, width: "160px" },
      ],
      filterFn: (it, term) => {
        const t = term.toLowerCase();
        return (
          (it.kod && String(it.kod).includes(t)) ||
          (it.ad && it.ad.toLowerCase().includes(t)) ||
          (it.il && it.il.toLowerCase().includes(t)) ||
          (it.ilce && it.ilce.toLowerCase().includes(t))
        );
      },
      onSelect: (it) => {
        handleChange("POSTA_KODU_ID", it.id || Number(it.kod));
        setLookupModalConfig((prev) => ({ ...prev, show: false }));
      },
    });
  };

  const openUlkeLookup = async () => {
    const lk = await ensureLookups();
    setLookupModalConfig({
      show: true,
      title: "Ülke Seçimi",
      items: lk.ulkeList || [],
      selectedId: formData.ULKE_ID,
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

  const openParaLookup = async (field: keyof TodvzTanimDto, title: string) => {
    const lk = await ensureLookups();
    setLookupModalConfig({
      show: true,
      title,
      items: lk.paraList || [],
      selectedId: formData[field],
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

  const openIstatistikLookup = async (field: keyof TodvzTanimDto, title: string, searchPrefix?: string) => {
    const lk = await ensureLookups();
    const isAlis = field === "ALIS_ISTATISTIK_ID" || field === "ARBITRAJ_ALIS_ISTATISTIK_ID";
    const isSatis = field === "SATIS_ISTATISTIK_ID" || field === "ARBITRAJ_SATIS_ISTATISTIK_ID";
    const filteredList = (lk.istatistikList || []).filter((it: any) => {
      const ft = Number(it.fisTipi);
      if (isAlis) return ft === 0 || ft === 2;
      if (isSatis) return ft === 1 || ft === 2;
      return true;
    });

    setLookupModalConfig({
      show: true,
      title,
      items: filteredList,
      selectedId: formData[field],
      initialSearchTerm: searchPrefix || "",
      columns: [
        { header: "ID", render: (it) => <span className="font-monospace fw-semibold">{it.id}</span>, width: "80px" },
        { header: "Kod", render: (it) => <Badge bg="secondary" className="font-monospace">{it.kod}</Badge>, width: "120px" },
        {
          header: "Fiş Tipi",
          render: (it: any) => {
            const ft = Number(it.fisTipi);
            const label = ft === 0 ? "0 - ALIŞ" : ft === 1 ? "1 - SATIŞ" : ft === 2 ? "2 - ALIŞ-SATIŞ" : `${ft}`;
            const badgeVariant = ft === 0 ? "primary" : ft === 1 ? "success" : "info";
            return <Badge bg={badgeVariant} className="px-2 py-1">{label}</Badge>;
          },
          width: "120px",
          align: "center",
        },
        { header: "Açıklama", render: (it) => <span className="fw-medium">{it.ad}</span> },
      ],
      filterFn: (it, term) => {
        const t = (term || "").toLowerCase().trim();
        if (!t) return true;
        return (it.kod && it.kod.toLowerCase().includes(t)) || (it.ad && it.ad.toLowerCase().includes(t)) || String(it.id).includes(t);
      },
      onSelect: (it) => {
        handleChange(field, it.id);
        setLookupModalConfig((prev) => ({ ...prev, show: false }));
      },
    });
  };

  const openSermayeHesabiLookup = async () => {
    try {
      const list = await ensureHesaplar();
      setLookupModalConfig({
        show: true,
        title: "Sermaye Hesabı (Hesap Kartı - A- Hesap Kayıt) Seçimi",
        items: list,
        selectedId: formData.SERMAYE_HESABI_ID,
        columns: [
          { header: "ID", render: (it) => <span className="font-monospace fw-semibold">{it.hesapId}</span>, width: "70px" },
          { header: "Hesap Kodu", render: (it) => <Badge bg="primary" className="font-monospace">{it.kod}</Badge>, width: "120px" },
          { header: "Hesap Tanımı / Adı", render: (it) => <span className="fw-medium">{it.ad}</span> },
          { header: "KDV %", render: (it) => <span className="font-monospace">{it.kdvOrani ?? 0}%</span>, width: "80px", align: "right" },
        ],
        filterFn: (it, term) => {
          const t = term.toLowerCase();
          return (it.kod && it.kod.toLowerCase().includes(t)) || (it.ad && it.ad.toLowerCase().includes(t)) || String(it.hesapId).includes(t);
        },
        onSelect: (it) => {
          handleChange("SERMAYE_HESABI_ID", it.hesapId);
          setLookupModalConfig((prev) => ({ ...prev, show: false }));
        },
      });
    } catch (err) {
      console.error("Sermaye hesabı lookup hatası:", err);
    }
  };

  const openUretimHesabiLookup = async () => {
    try {
      const list = await ensureHesaplar();
      setLookupModalConfig({
        show: true,
        title: "Üretim Hesabı (Hesap Kartı) Seçimi",
        items: list,
        selectedId: formData.URETIM_HESABI_ID,
        columns: [
          { header: "ID", render: (it) => <span className="font-monospace fw-semibold">{it.hesapId}</span>, width: "70px" },
          { header: "Hesap Kodu", render: (it) => <Badge bg="primary" className="font-monospace">{it.kod}</Badge>, width: "120px" },
          { header: "Hesap Tanımı / Adı", render: (it) => <span className="fw-medium">{it.ad}</span> },
          { header: "KDV %", render: (it) => <span className="font-monospace">{it.kdvOrani ?? 0}%</span>, width: "80px", align: "right" },
        ],
        filterFn: (it, term) => {
          const t = term.toLowerCase();
          return (it.kod && it.kod.toLowerCase().includes(t)) || (it.ad && it.ad.toLowerCase().includes(t)) || String(it.hesapId).includes(t);
        },
        onSelect: (it) => {
          handleChange("URETIM_HESABI_ID", it.hesapId);
          handleChange("URETIM_HESABI", it.kod || it.ad);
          localStorage.setItem("kuyumcu_erp_uretim_hesabi_id", String(it.hesapId));
          setLookupModalConfig((prev) => ({ ...prev, show: false }));
        },
      });
    } catch (err) {
      console.error("Üretim hesabı lookup hatası:", err);
    }
  };

  const openIskontoLookup = async () => {
    try {
      const list = await ensureIskontolar();
      setLookupModalConfig({
        show: true,
        title: "İskonto Tanımı Seçimi",
        items: list,
        selectedId: formData.ISKONTO_ID,
        columns: [
          { header: "ID", render: (it) => <span className="font-monospace fw-semibold">{it.iskontoId}</span>, width: "60px" },
          { header: "İskonto Kodu", render: (it) => <Badge bg="secondary" className="font-monospace">{it.kod || "-"}</Badge>, width: "110px" },
          { header: "İskonto Tanımı", render: (it) => <span className="fw-medium">{it.tanim}</span> },
          {
            header: "Tip",
            render: (it) => {
              if (it.iskontoTipi === 1) return <Badge bg="info" className="text-dark">Yüzde (%)</Badge>;
              if (it.iskontoTipi === 2) return <Badge bg="primary">Sabit Tutar</Badge>;
              if (it.iskontoTipi === 3) return <Badge bg="warning" className="text-dark">Has Gram</Badge>;
              return <Badge bg="light" className="text-dark">-</Badge>;
            },
            width: "100px",
          },
          {
            header: "Değer",
            render: (it) => {
              if (it.iskontoTipi === 1) return <span className="font-monospace fw-bold text-primary">%{it.oran}</span>;
              if (it.iskontoTipi === 2) return <span className="font-monospace fw-bold text-success">{it.tutar?.toLocaleString("tr-TR")} ₺</span>;
              if (it.iskontoTipi === 3) return <span className="font-monospace fw-bold text-warning">{it.hasTutar} Gr Has</span>;
              return "-";
            },
            width: "110px",
            align: "right",
          },
        ],
        filterFn: (it, term) => {
          const t = term.toLowerCase();
          return (it.kod && it.kod.toLowerCase().includes(t)) || (it.tanim && it.tanim.toLowerCase().includes(t)) || String(it.iskontoId).includes(t);
        },
        onSelect: (it) => {
          handleChange("ISKONTO_ID", it.iskontoId);
          setLookupModalConfig((prev) => ({ ...prev, show: false }));
        },
      });
    } catch (err) {
      console.error("İskonto lookup hatası:", err);
    }
  };

  const sanitizeData = (data: any): any => {
    if (!data) return data;
    const cleaned = { ...data };
    for (const key of Object.keys(cleaned)) {
      if (typeof cleaned[key] === "string") {
        cleaned[key] = cleaned[key].trim();
      }
    }
    return cleaned;
  };

  const placeCursorAtEnd = (el: HTMLInputElement | HTMLTextAreaElement) => {
    if (!el) return;
    // Kullanıcı metin seçimi (drag selection) yapıyorsa seçimi bozma
    try {
      if (el.selectionStart !== null && el.selectionEnd !== null && el.selectionStart !== el.selectionEnd) {
        return;
      }
    } catch {
      // type="number" may throw on selectionStart in some environments
    }

    const val = el.value ?? "";
    const len = typeof val === "string" ? val.length : String(val).length;

    if (el instanceof HTMLInputElement && el.type === "number") {
      try {
        (el as any).type = "text";
        el.setSelectionRange(len, len);
        (el as any).type = "number";
      } catch {
        // fallback
      }
    } else if (typeof el.setSelectionRange === "function") {
      try {
        el.setSelectionRange(len, len);
      } catch {
        // fallback
      }
    }
  };

  // Load Company Definitions from Active MSSQL DB
  const loadDefinitions = async (forceLoad: boolean = true) => {
    try {
      setIsLoading(true);
      setAlertError(null);
      if (forceLoad) {
        const data = await CompanyService.getDefinitions();
        if (data) {
          const sanitized = sanitizeData(data);
          const storedUretim = localStorage.getItem("kuyumcu_erp_uretim_hesabi_id");
          if (storedUretim && !sanitized.URETIM_HESABI_ID) {
            sanitized.URETIM_HESABI_ID = Number(storedUretim);
          }
          setFormData(sanitized || emptyCompanyData);
        }
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

    // Inputa tıklanınca veya odaklanınca imleci en sağa / verinin sonuna taşı
    const handleInputClickOrFocus = (e: MouseEvent | FocusEvent) => {
      const target = e.target as HTMLElement;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement
      ) {
        if (
          target.type === "checkbox" ||
          target.type === "radio" ||
          target.type === "button" ||
          target.type === "submit" ||
          target.type === "file" ||
          target.readOnly ||
          target.disabled
        ) {
          return;
        }

        setTimeout(() => {
          placeCursorAtEnd(target);
        }, 0);
      }
    };

    document.addEventListener("mouseup", handleInputClickOrFocus);
    document.addEventListener("focusin", handleInputClickOrFocus);

    return () => {
      document.removeEventListener("mouseup", handleInputClickOrFocus);
      document.removeEventListener("focusin", handleInputClickOrFocus);
    };
  }, []);

  const handleChange = (field: keyof TodvzTanimDto, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Sayısal alanlar için: silinince 0 olmasın, null (boş) kalsın ve harf/geçersiz karakter engellensin
  const handleNumericInput = (field: keyof TodvzTanimDto, value: string) => {
    if (value === "" || value === undefined || value === null) {
      handleChange(field, null);
      return;
    }
    const parsed = Number(value);
    handleChange(field, isNaN(parsed) ? null : parsed);
  };

  const blockNonNumericKeys = (e: React.KeyboardEvent<any>, allowDecimal = false) => {
    const blocked = allowDecimal ? ["e", "E", "+"] : ["e", "E", "+", "-", "."];
    if (blocked.includes(e.key)) {
      e.preventDefault();
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      setIsSaving(true);
      setAlertError(null);
      if (formData.URETIM_HESABI_ID) {
        localStorage.setItem("kuyumcu_erp_uretim_hesabi_id", String(formData.URETIM_HESABI_ID));
      } else {
        localStorage.removeItem("kuyumcu_erp_uretim_hesabi_id");
      }
      const cleanData = sanitizeData(formData);
      const updated = await CompanyService.updateDefinitions(cleanData);
      setFormData(sanitizeData(updated) || cleanData);
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



  const companyTabs = [
    { key: "genel", label: "Genel", icon: <IconBuildingStore size={14} className="me-1 flex-shrink-0" />, color: "#0d6efd" },
    { key: "para", label: "Para", icon: <IconCoin size={14} className="me-1 flex-shrink-0" />, color: "#e67e22" },
    { key: "muhasebe", label: "Muhasebe", icon: <IconReceipt2 size={14} className="me-1 flex-shrink-0" />, color: "#198754" },
    { key: "limitler", label: "Limit", icon: <IconScale size={14} className="me-1 flex-shrink-0" />, color: "#0891b2" },
    { key: "ebelge", label: "E-Server", icon: <IconFileCertificate size={14} className="me-1 flex-shrink-0" />, color: "#dc3545" },
    { key: "sistem", label: "Sistem", icon: <IconAdjustments size={14} className="me-1 flex-shrink-0" />, color: "#495057" },
  ];

  return (
    <Tab.Container activeKey={activeTab} onSelect={(k) => setActiveTab(k || "genel")}>
      <div className="company-definitions-container w-100 pb-3" style={{ overflowX: "hidden" }}>
        <style>{`
          /* Firma Tanımları: Alt alta satırlar arasındaki boşlukları minimuma indir */
          .company-definitions-container .row {
            --bs-gutter-y: 0px !important;
            margin-top: 0 !important;
            margin-bottom: 0 !important;
          }
          .company-definitions-container .row > * {
            margin-top: 0 !important;
            padding-top: 1px !important;
            padding-bottom: 1px !important;
          }
          .company-definitions-container .form-group,
          .company-definitions-container .mb-2 {
            margin-bottom: 3px !important;
            margin-top: 0 !important;
          }
          .company-definitions-container .form-label,
          .company-definitions-container .col-form-label {
            padding-top: 0 !important;
            padding-bottom: 0 !important;
            margin-bottom: 0 !important;
            font-size: 13px !important;
            line-height: 28px !important;
          }
          .company-definitions-container .form-control,
          .company-definitions-container .form-select,
          .company-definitions-container .input-group-text {
            height: 28px !important;
            min-height: 28px !important;
            padding: 2px 8px !important;
            font-size: 13px !important;
            line-height: 22px !important;
          }
          .company-definitions-container textarea.form-control {
            height: auto !important;
            min-height: 48px !important;
          }
          .company-definitions-container .input-group .btn {
            height: 28px !important;
            padding: 2px 8px !important;
            display: flex !important;
            align-items: center !important;
          }
          .company-definitions-container .input-group .form-control {
            height: 28px !important;
            min-height: 28px !important;
            line-height: 22px !important;
          }
          .company-definitions-container .form-check {
            margin-bottom: 4px !important;
            min-height: auto !important;
          }
          .company-definitions-container .form-check-input {
            margin-top: 4px !important;
          }
        `}</style>

        {/* 1. Üst ERP Aksiyon Şeridi (Ribbon Toolbar) */}
        <ERPToolbar
          pageTitle="Firma Tanımları"
          pageIcon={<IconBuildingStore size={20} />}
          centerContent={
            <div
              className="d-flex align-items-center gap-1 ms-sm-1 border-start ps-2 overflow-x-auto flex-nowrap erp-toolbar-tab-list"
              style={{
                maxWidth: "100%",
                WebkitOverflowScrolling: "touch",
                scrollbarWidth: "none",
                msOverflowStyle: "none",
              }}
            >
              {companyTabs.map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`btn btn-sm btn-link text-decoration-none px-2 py-1 d-flex align-items-center gap-1 flex-nowrap text-nowrap transition-all ${
                      isActive ? "text-dark fw-bold" : "text-secondary fw-semibold"
                    }`}
                    style={{
                      border: "none",
                      borderRadius: 0,
                      borderBottom: isActive ? `2.5px solid ${tab.color}` : "2.5px solid transparent",
                      color: isActive ? "#212529" : "#6c757d",
                      fontSize: "13px",
                      lineHeight: "1.3",
                      cursor: "pointer",
                      paddingBottom: "4px",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    <span style={{ color: tab.color }}>{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          }
          onSave={() => handleSave()}
          onRefresh={() => loadDefinitions()}
          onPrint={handlePrint}
          disabled={isLoading || isSaving}
          hideNavigation={true}
          hideSearch={true}
          hideDelete={true}
        />

        {/* Alert Messages: Sağ altta toast */}
        {(alertSuccess || alertError) && (
          <div className="erp-toast-container">
            {alertSuccess && (
              <Alert
                variant="success"
                dismissible
                onClose={() => setAlertSuccess(null)}
                className="erp-toast-item d-flex align-items-center gap-2 py-2 px-3 mb-0 shadow border-0"
              >
                <IconCheck size={20} className="text-success flex-shrink-0" />
                <span className="fw-medium" style={{ fontSize: "13px" }}>{alertSuccess}</span>
              </Alert>
            )}

            {alertError && (
              <Alert
                variant="danger"
                dismissible
                onClose={() => setAlertError(null)}
                className="erp-toast-item d-flex align-items-center gap-2 py-2 px-3 mb-0 shadow border-0"
              >
                <IconAlertCircle size={20} className="text-danger flex-shrink-0" />
                <span className="fw-medium" style={{ fontSize: "13px" }}>{alertError}</span>
              </Alert>
            )}
          </div>
        )}

        {/* Main Content Card */}
        <Card className="border shadow-sm rounded-3 bg-white overflow-hidden mt-1">
          <Card.Body className="p-3 p-md-4">
            {isLoading ? (
              <div className="text-center py-5">
                <Spinner animation="border" variant="primary" />
                <div className="text-muted small mt-2">Firma tanımları SQL sunucusundan yükleniyor...</div>
              </div>
            ) : (
              <Tab.Content style={{ maxWidth: "760px" }}>
                {/* ─── TAB 1: GENEL & FİRMA BİLGİLERİ ─── */}
                <Tab.Pane eventKey="genel">
                  <Row className="g-3">
                    {/* Sol Sütun: Temel Firma ve Resmi Bilgiler */}
                    <Col xs={12} lg={6}>
                      <div className="p-3 bg-light rounded-3 border h-100">
                        <Row className="g-2">
                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">Firma Ticari Unvanı:</Form.Label>
                              <Col>
                                <Form.Control
                                  autoFocus
                                  type="text"
                                  value={formData.FIRMA_ADI || ""}
                                  onChange={(e) => handleChange("FIRMA_ADI", e.target.value)}
                                  className="bg-white border fw-medium"
                                />
                              </Col>
                            </Form.Group>
                          </Col>

                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">Şube Kodu:</Form.Label>
                              <Col>
                                <Form.Control
                                  type="text"
                                  value={formData.SUBE_KODU || ""}
                                  onChange={(e) => handleChange("SUBE_KODU", e.target.value)}
                                  className="bg-white border font-monospace text-end"
                                  style={{ maxWidth: "110px" }}
                                />
                              </Col>
                            </Form.Group>
                          </Col>

                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">Şube Adı:</Form.Label>
                              <Col>
                                <Form.Control
                                  type="text"
                                  value={formData.SUBE_ADI || ""}
                                  onChange={(e) => handleChange("SUBE_ADI", e.target.value)}
                                  className="bg-white border"
                                />
                              </Col>
                            </Form.Group>
                          </Col>

                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">Vergi Dairesi:</Form.Label>
                              <Col>
                                <InputGroup size="sm" className="flex-nowrap">
                                  <div className="form-control form-control-sm bg-white text-truncate text-secondary" style={{ fontSize: "0.82rem" }} title={getVergiDairesiName(formData.VERGI_DAIRESI_ID)}>
                                    {getVergiDairesiName(formData.VERGI_DAIRESI_ID) || "Seçilmedi"}
                                  </div>
                                  <Button
                                    variant="outline-primary"
                                    onClick={openVergiDairesiLookup}
                                    title="Listeden Seç (Dürbün)"
                                    className="d-flex align-items-center px-2 flex-shrink-0"
                                  >
                                    <IconBinoculars size={16} />
                                  </Button>
                                </InputGroup>
                              </Col>
                            </Form.Group>
                          </Col>

                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">Vergi Kimlik No:</Form.Label>
                              <Col>
                                <Form.Control
                                  type="text"
                                  inputMode="numeric"
                                  data-numeric="true"
                                  maxLength={11}
                                  value={formData.VERGI_KIMLIK_NO || ""}
                                  onChange={(e) => handleChange("VERGI_KIMLIK_NO", onlyDigits(e.target.value, 11))}
                                  className="bg-white border font-monospace text-end"
                                  style={{ maxWidth: "110px" }}
                                />
                              </Col>
                            </Form.Group>
                          </Col>

                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">Ticaret Sicil No:</Form.Label>
                              <Col>
                                <Form.Control
                                  type="text"
                                  value={formData.TICARET_SICIL_NO || ""}
                                  onChange={(e) => handleChange("TICARET_SICIL_NO", e.target.value)}
                                  className="bg-white border font-monospace text-end"
                                  style={{ maxWidth: "110px" }}
                                />
                              </Col>
                            </Form.Group>
                          </Col>

                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">MERSİS No:</Form.Label>
                              <Col>
                                <Form.Control
                                  type="text"
                                  inputMode="numeric"
                                  data-numeric="true"
                                  maxLength={16}
                                  value={formData.MERSIS_NO || ""}
                                  onChange={(e) => handleChange("MERSIS_NO", onlyDigits(e.target.value, 16))}
                                  className="bg-white border font-monospace text-end"
                                  style={{ maxWidth: "110px" }}
                                />
                              </Col>
                            </Form.Group>
                          </Col>

                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">Yetkili Müessese Tipi:</Form.Label>
                              <Col>
                                <Form.Select
                                  value={formData.YETKILI_MUESSESE_TIPI ?? 0}
                                  onChange={(e) => handleChange("YETKILI_MUESSESE_TIPI", Number(e.target.value))}
                                  className="bg-white border"
                                >
                                  <option value={0}>0 - A Grubu Yetkili Müessese</option>
                                  <option value={1}>1 - B Grubu Sınırlı Yetkili Müessese</option>
                                  <option value={2}>2 - Kuyumcu / Sarraf</option>
                                </Form.Select>
                              </Col>
                            </Form.Group>
                          </Col>
                        </Row>
                      </div>
                    </Col>

                    {/* Sağ Sütun: Telefon, Adres ve İletişim Bilgileri */}
                    <Col xs={12} lg={6}>
                      <div className="p-3 bg-light rounded-3 border h-100">
                        <Row className="g-2">
                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyleIletisim} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">Telefon:</Form.Label>
                              <Col>
                                <Form.Control
                                  type="text"
                                  value={formData.TELEFON || ""}
                                  onChange={(e) => handleChange("TELEFON", e.target.value)}
                                  className="bg-white border"
                                />
                              </Col>
                            </Form.Group>
                          </Col>

                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyleIletisim} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">Açık Adres:</Form.Label>
                              <Col>
                                <Form.Control
                                  type="text"
                                  value={formData.ADRES || ""}
                                  onChange={(e) => handleChange("ADRES", e.target.value)}
                                  className="bg-white border"
                                />
                              </Col>
                            </Form.Group>
                          </Col>

                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyleIletisim} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">Posta Kodu:</Form.Label>
                              <Col>
                                <InputGroup size="sm" className="flex-nowrap">
                                  <div className="form-control form-control-sm bg-white text-truncate text-secondary" style={{ fontSize: "0.82rem" }} title={getPostaKoduName(formData.POSTA_KODU_ID)}>
                                    {getPostaKoduName(formData.POSTA_KODU_ID) || "Seçilmedi"}
                                  </div>
                                  <Button
                                    variant="outline-primary"
                                    onClick={openPostaKoduLookup}
                                    title="Listeden Seç (Dürbün)"
                                    className="d-flex align-items-center px-2 flex-shrink-0"
                                  >
                                    <IconBinoculars size={16} />
                                  </Button>
                                </InputGroup>
                              </Col>
                            </Form.Group>
                          </Col>

                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyleIletisim} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">İlçe:</Form.Label>
                              <Col>
                                <InputGroup size="sm" className="flex-nowrap">
                                  <div className="form-control form-control-sm bg-white text-truncate text-secondary" style={{ fontSize: "0.82rem" }} title={getIlceName(formData.ILCE_ID)}>
                                    {getIlceName(formData.ILCE_ID) || "Seçilmedi"}
                                  </div>
                                  <Button
                                    variant="outline-primary"
                                    onClick={openIlceLookup}
                                    title="Listeden Seç (Dürbün)"
                                    className="d-flex align-items-center px-2 flex-shrink-0"
                                  >
                                    <IconBinoculars size={16} />
                                  </Button>
                                </InputGroup>
                              </Col>
                            </Form.Group>
                          </Col>

                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyleIletisim} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">İl:</Form.Label>
                              <Col>
                                <InputGroup size="sm" className="flex-nowrap">
                                  <div className="form-control form-control-sm bg-white text-truncate text-secondary" style={{ fontSize: "0.82rem" }} title={getIlName(formData.IL_ID)}>
                                    {getIlName(formData.IL_ID) || "Seçilmedi"}
                                  </div>
                                  <Button
                                    variant="outline-primary"
                                    onClick={openIlLookup}
                                    title="Listeden Seç (Dürbün)"
                                    className="d-flex align-items-center px-2 flex-shrink-0"
                                  >
                                    <IconBinoculars size={16} />
                                  </Button>
                                </InputGroup>
                              </Col>
                            </Form.Group>
                          </Col>

                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyleIletisim} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">Ülke:</Form.Label>
                              <Col>
                                <InputGroup size="sm" className="flex-nowrap">
                                  <div className="form-control form-control-sm bg-white text-truncate text-secondary" style={{ fontSize: "0.82rem" }} title={getUlkeName(formData.ULKE_ID)}>
                                    {getUlkeName(formData.ULKE_ID) || "Seçilmedi"}
                                  </div>
                                  <Button
                                    variant="outline-primary"
                                    onClick={openUlkeLookup}
                                    title="Listeden Seç (Dürbün)"
                                    className="d-flex align-items-center px-2 flex-shrink-0"
                                  >
                                    <IconBinoculars size={16} />
                                  </Button>
                                </InputGroup>
                              </Col>
                            </Form.Group>
                          </Col>

                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyleIletisim} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">E-Posta:</Form.Label>
                              <Col>
                                <Form.Control
                                  type="email"
                                  value={formData.EPOSTA || ""}
                                  onChange={(e) => handleChange("EPOSTA", e.target.value)}
                                  className="bg-white border"
                                />
                              </Col>
                            </Form.Group>
                          </Col>

                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyleIletisim} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">Web Sitesi:</Form.Label>
                              <Col>
                                <Form.Control
                                  type="text"
                                  value={formData.WEB_ADRESI || ""}
                                  onChange={(e) => handleChange("WEB_ADRESI", e.target.value)}
                                  className="bg-white border"
                                />
                              </Col>
                            </Form.Group>
                          </Col>

                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyleIletisim} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">Dosya No:</Form.Label>
                              <Col>
                                <Form.Control
                                  type="text"
                                  value={formData.DOSYA_NO || ""}
                                  onChange={(e) => handleChange("DOSYA_NO", e.target.value)}
                                  className="bg-white border font-monospace text-end"
                                  style={{ maxWidth: "110px" }}
                                />
                              </Col>
                            </Form.Group>
                          </Col>
                        </Row>
                      </div>
                    </Col>
                  </Row>
                </Tab.Pane>

                {/* ─── TAB 2: PARA, KURUŞ & ORAN PARAMETRELERİ ─── */}
                <Tab.Pane eventKey="para">
                  <Row className="g-3">
                    <Col xs={12} md={6}>
                      <div className="p-3 bg-light rounded-3 border h-100">
                        <Row className="g-2">
                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyleParaId} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">USD Para:</Form.Label>
                              <Col>
                                <InputGroup size="sm" className="flex-nowrap">
                                  <div className="form-control form-control-sm bg-white text-truncate text-secondary" style={{ fontSize: "0.82rem" }} title={getParaName(formData.USD_PARA_ID)}>
                                    {getParaName(formData.USD_PARA_ID) || "USD"}
                                  </div>
                                  <Button
                                    variant="outline-primary"
                                    onClick={() => openParaLookup("USD_PARA_ID", "USD Para Birimi Seçimi")}
                                    title="Listeden Seç (Dürbün)"
                                    className="d-flex align-items-center px-2 flex-shrink-0"
                                  >
                                    <IconBinoculars size={16} />
                                  </Button>
                                </InputGroup>
                              </Col>
                            </Form.Group>
                          </Col>
                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyleParaId} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">EUR Para:</Form.Label>
                              <Col>
                                <InputGroup size="sm" className="flex-nowrap">
                                  <div className="form-control form-control-sm bg-white text-truncate text-secondary" style={{ fontSize: "0.82rem" }} title={getParaName(formData.EUR_PARA_ID)}>
                                    {getParaName(formData.EUR_PARA_ID) || "EUR"}
                                  </div>
                                  <Button
                                    variant="outline-primary"
                                    onClick={() => openParaLookup("EUR_PARA_ID", "EUR Para Birimi Seçimi")}
                                    title="Listeden Seç (Dürbün)"
                                    className="d-flex align-items-center px-2 flex-shrink-0"
                                  >
                                    <IconBinoculars size={16} />
                                  </Button>
                                </InputGroup>
                              </Col>
                            </Form.Group>
                          </Col>
                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyleParaId} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">Rapor Para:</Form.Label>
                              <Col>
                                <InputGroup size="sm" className="flex-nowrap">
                                  <div className="form-control form-control-sm bg-white text-truncate text-secondary" style={{ fontSize: "0.82rem" }} title={getParaName(formData.RAPOR_PARA_ID)}>
                                    {getParaName(formData.RAPOR_PARA_ID) || "USD"}
                                  </div>
                                  <Button
                                    variant="outline-primary"
                                    onClick={() => openParaLookup("RAPOR_PARA_ID", "Rapor Para Birimi Seçimi")}
                                    title="Listeden Seç (Dürbün)"
                                    className="d-flex align-items-center px-2 flex-shrink-0"
                                  >
                                    <IconBinoculars size={16} />
                                  </Button>
                                </InputGroup>
                              </Col>
                            </Form.Group>
                          </Col>
                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyleParaId} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">Favori Para:</Form.Label>
                              <Col>
                                <InputGroup size="sm" className="flex-nowrap">
                                  <div className="form-control form-control-sm bg-white text-truncate text-secondary" style={{ fontSize: "0.82rem" }} title={getParaName(formData.FAVORI_PARA_ID)}>
                                    {getParaName(formData.FAVORI_PARA_ID) || "Seçilmedi"}
                                  </div>
                                  <Button
                                    variant="outline-primary"
                                    onClick={() => openParaLookup("FAVORI_PARA_ID", "Favori Para Birimi Seçimi")}
                                    title="Listeden Seç (Dürbün)"
                                    className="d-flex align-items-center px-2 flex-shrink-0"
                                  >
                                    <IconBinoculars size={16} />
                                  </Button>
                                </InputGroup>
                              </Col>
                            </Form.Group>
                          </Col>
                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyleParaId} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">Has Altın Para:</Form.Label>
                              <Col>
                                <InputGroup size="sm" className="flex-nowrap">
                                  <div className="form-control form-control-sm bg-white text-truncate text-secondary" style={{ fontSize: "0.82rem" }} title={getParaName(formData.HAS_ALTIN_PARA_ID)}>
                                    {getParaName(formData.HAS_ALTIN_PARA_ID) || "Has Altın"}
                                  </div>
                                  <Button
                                    variant="outline-primary"
                                    onClick={() => openParaLookup("HAS_ALTIN_PARA_ID", "Has Altın Para Birimi Seçimi")}
                                    title="Listeden Seç (Dürbün)"
                                    className="d-flex align-items-center px-2 flex-shrink-0"
                                  >
                                    <IconBinoculars size={16} />
                                  </Button>
                                </InputGroup>
                              </Col>
                            </Form.Group>
                          </Col>
                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyleParaId} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">Has Gümüş Para:</Form.Label>
                              <Col>
                                <InputGroup size="sm" className="flex-nowrap">
                                  <div className="form-control form-control-sm bg-white text-truncate text-secondary" style={{ fontSize: "0.82rem" }} title={getParaName(formData.HAS_GUMUS_PARA_ID)}>
                                    {getParaName(formData.HAS_GUMUS_PARA_ID) || "Has Gümüş"}
                                  </div>
                                  <Button
                                    variant="outline-primary"
                                    onClick={() => openParaLookup("HAS_GUMUS_PARA_ID", "Has Gümüş Para Birimi Seçimi")}
                                    title="Listeden Seç (Dürbün)"
                                    className="d-flex align-items-center px-2 flex-shrink-0"
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
                        <Row className="g-2">
                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyleBasamak} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">TL Kuruş Sayısı:</Form.Label>
                              <Col>
                                <Form.Control
                                  type="number"
                                  value={formData.TL_KURUS_SAYISI ?? ""}
                                  onChange={(e) => handleNumericInput("TL_KURUS_SAYISI", e.target.value)}
                                  onKeyDown={(e) => blockNonNumericKeys(e)}
                                  className="bg-white border font-monospace text-end"
                                  style={{ maxWidth: "80px" }}
                                />
                              </Col>
                            </Form.Group>
                          </Col>
                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyleBasamak} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">Döviz Kuruş Sayısı:</Form.Label>
                              <Col>
                                <Form.Control
                                  type="number"
                                  value={formData.DOVIZ_KURUS_SAYISI ?? ""}
                                  onChange={(e) => handleNumericInput("DOVIZ_KURUS_SAYISI", e.target.value)}
                                  onKeyDown={(e) => blockNonNumericKeys(e)}
                                  className="bg-white border font-monospace text-end"
                                  style={{ maxWidth: "80px" }}
                                />
                              </Col>
                            </Form.Group>
                          </Col>
                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyleBasamak} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">Kur Kuruş Sayısı:</Form.Label>
                              <Col>
                                <Form.Control
                                  type="number"
                                  value={formData.KUR_KURUS_SAYISI ?? ""}
                                  onChange={(e) => handleNumericInput("KUR_KURUS_SAYISI", e.target.value)}
                                  onKeyDown={(e) => blockNonNumericKeys(e)}
                                  className="bg-white border font-monospace text-end"
                                  style={{ maxWidth: "80px" }}
                                />
                              </Col>
                            </Form.Group>
                          </Col>
                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyleBasamak} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">Gram Ondalık Sayısı:</Form.Label>
                              <Col>
                                <Form.Control
                                  type="number"
                                  value={formData.GRAM_ONDALIK_SAYISI ?? ""}
                                  onChange={(e) => handleNumericInput("GRAM_ONDALIK_SAYISI", e.target.value)}
                                  onKeyDown={(e) => blockNonNumericKeys(e)}
                                  className="bg-white border font-monospace text-end"
                                  style={{ maxWidth: "80px" }}
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
                        <Row className="g-2">
                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyleOran} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">Dvz Alış / Satış:</Form.Label>
                              <Col>
                                <Form.Control
                                  type="number"
                                  step="0.0001"
                                  value={formData.DOVIZ_ALIS_DVZ_SATIS_ORANI ?? ""}
                                  onChange={(e) => handleNumericInput("DOVIZ_ALIS_DVZ_SATIS_ORANI", e.target.value)}
                                  onKeyDown={(e) => blockNonNumericKeys(e, true)}
                                  className="bg-white border font-monospace text-end"
                                  style={{ maxWidth: "90px" }}
                                />
                              </Col>
                            </Form.Group>
                          </Col>
                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyleOran} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">Efektif Alış / Satış:</Form.Label>
                              <Col>
                                <Form.Control
                                  type="number"
                                  step="0.0001"
                                  value={formData.EFEKTIF_ALIS_DVZ_SATIS_ORANI ?? ""}
                                  onChange={(e) => handleNumericInput("EFEKTIF_ALIS_DVZ_SATIS_ORANI", e.target.value)}
                                  onKeyDown={(e) => blockNonNumericKeys(e, true)}
                                  className="bg-white border font-monospace text-end"
                                  style={{ maxWidth: "90px" }}
                                />
                              </Col>
                            </Form.Group>
                          </Col>
                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyleOran} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">Efektif Satış / Satış:</Form.Label>
                              <Col>
                                <Form.Control
                                  type="number"
                                  step="0.0001"
                                  value={formData.EFEKTIF_SATIS_DVZ_SATIS_ORANI ?? ""}
                                  onChange={(e) => handleNumericInput("EFEKTIF_SATIS_DVZ_SATIS_ORANI", e.target.value)}
                                  onKeyDown={(e) => blockNonNumericKeys(e, true)}
                                  className="bg-white border font-monospace text-end"
                                  style={{ maxWidth: "90px" }}
                                />
                              </Col>
                            </Form.Group>
                          </Col>
                          <Col xs={12} className="mt-2 pt-2 border-top">
                            <div className="d-flex flex-column gap-2">
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

                    <Col xs={12} md={6}>
                      <div className="p-3 bg-light rounded-3 border h-100">
                        <Row className="g-2">
                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyleIstatistik} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">Alış İstatistik:</Form.Label>
                              <Col>
                                <InputGroup size="sm" className="flex-nowrap">
                                  <Form.Control
                                    size="sm"
                                    type="text"
                                    className="bg-white border"
                                    style={{ fontSize: "0.82rem" }}
                                    value={getIstatistikName(formData.ALIS_ISTATISTIK_ID)}
                                    placeholder="Seçiniz veya arayın..."
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (!val.trim()) {
                                        handleChange("ALIS_ISTATISTIK_ID", null);
                                      } else {
                                        const match = (lookups.istatistikList || []).find(
                                          (x: any) =>
                                            (x.kod && x.kod.trim().toLowerCase() === val.trim().toLowerCase()) ||
                                            String(x.id) === val.trim()
                                        );
                                        if (match) handleChange("ALIS_ISTATISTIK_ID", match.id);
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        openIstatistikLookup("ALIS_ISTATISTIK_ID", "Alış İstatistik Grubu Seçimi", (e.target as HTMLInputElement).value);
                                      }
                                    }}
                                    title={getIstatistikName(formData.ALIS_ISTATISTIK_ID) || "Alış İstatistik"}
                                  />
                                  <Button
                                    variant="outline-primary"
                                    onClick={() => openIstatistikLookup("ALIS_ISTATISTIK_ID", "Alış İstatistik Grubu Seçimi", getIstatistikName(formData.ALIS_ISTATISTIK_ID))}
                                    title="Listeden Seç (Dürbün / Enter)"
                                    className="d-flex align-items-center px-2 flex-shrink-0"
                                  >
                                    <IconBinoculars size={16} />
                                  </Button>
                                </InputGroup>
                              </Col>
                            </Form.Group>
                          </Col>

                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyleIstatistik} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">Satış İstatistik:</Form.Label>
                              <Col>
                                <InputGroup size="sm" className="flex-nowrap">
                                  <Form.Control
                                    size="sm"
                                    type="text"
                                    className="bg-white border"
                                    style={{ fontSize: "0.82rem" }}
                                    value={getIstatistikName(formData.SATIS_ISTATISTIK_ID)}
                                    placeholder="Seçiniz veya arayın..."
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (!val.trim()) {
                                        handleChange("SATIS_ISTATISTIK_ID", null);
                                      } else {
                                        const match = (lookups.istatistikList || []).find(
                                          (x: any) =>
                                            (x.kod && x.kod.trim().toLowerCase() === val.trim().toLowerCase()) ||
                                            String(x.id) === val.trim()
                                        );
                                        if (match) handleChange("SATIS_ISTATISTIK_ID", match.id);
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        openIstatistikLookup("SATIS_ISTATISTIK_ID", "Satış İstatistik Grubu Seçimi", (e.target as HTMLInputElement).value);
                                      }
                                    }}
                                    title={getIstatistikName(formData.SATIS_ISTATISTIK_ID) || "Satış İstatistik"}
                                  />
                                  <Button
                                    variant="outline-primary"
                                    onClick={() => openIstatistikLookup("SATIS_ISTATISTIK_ID", "Satış İstatistik Grubu Seçimi", getIstatistikName(formData.SATIS_ISTATISTIK_ID))}
                                    title="Listeden Seç (Dürbün / Enter)"
                                    className="d-flex align-items-center px-2 flex-shrink-0"
                                  >
                                    <IconBinoculars size={16} />
                                  </Button>
                                </InputGroup>
                              </Col>
                            </Form.Group>
                          </Col>

                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyleIstatistik} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">Arbitraj Alış:</Form.Label>
                              <Col>
                                <InputGroup size="sm" className="flex-nowrap">
                                  <Form.Control
                                    size="sm"
                                    type="text"
                                    className="bg-white border"
                                    style={{ fontSize: "0.82rem" }}
                                    value={getIstatistikName(formData.ARBITRAJ_ALIS_ISTATISTIK_ID)}
                                    placeholder="Seçiniz veya arayın..."
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (!val.trim()) {
                                        handleChange("ARBITRAJ_ALIS_ISTATISTIK_ID", null);
                                      } else {
                                        const match = (lookups.istatistikList || []).find(
                                          (x: any) =>
                                            (x.kod && x.kod.trim().toLowerCase() === val.trim().toLowerCase()) ||
                                            String(x.id) === val.trim()
                                        );
                                        if (match) handleChange("ARBITRAJ_ALIS_ISTATISTIK_ID", match.id);
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        openIstatistikLookup("ARBITRAJ_ALIS_ISTATISTIK_ID", "Arbitraj Alış İstatistik Seçimi", (e.target as HTMLInputElement).value);
                                      }
                                    }}
                                    title={getIstatistikName(formData.ARBITRAJ_ALIS_ISTATISTIK_ID) || "Arbitraj Alış"}
                                  />
                                  <Button
                                    variant="outline-primary"
                                    onClick={() => openIstatistikLookup("ARBITRAJ_ALIS_ISTATISTIK_ID", "Arbitraj Alış İstatistik Seçimi", getIstatistikName(formData.ARBITRAJ_ALIS_ISTATISTIK_ID))}
                                    title="Listeden Seç (Dürbün / Enter)"
                                    className="d-flex align-items-center px-2 flex-shrink-0"
                                  >
                                    <IconBinoculars size={16} />
                                  </Button>
                                </InputGroup>
                              </Col>
                            </Form.Group>
                          </Col>

                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyleIstatistik} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">Arbitraj Satış:</Form.Label>
                              <Col>
                                <InputGroup size="sm" className="flex-nowrap">
                                  <Form.Control
                                    size="sm"
                                    type="text"
                                    className="bg-white border"
                                    style={{ fontSize: "0.82rem" }}
                                    value={getIstatistikName(formData.ARBITRAJ_SATIS_ISTATISTIK_ID)}
                                    placeholder="Seçiniz veya arayın..."
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (!val.trim()) {
                                        handleChange("ARBITRAJ_SATIS_ISTATISTIK_ID", null);
                                      } else {
                                        const match = (lookups.istatistikList || []).find(
                                          (x: any) =>
                                            (x.kod && x.kod.trim().toLowerCase() === val.trim().toLowerCase()) ||
                                            String(x.id) === val.trim()
                                        );
                                        if (match) handleChange("ARBITRAJ_SATIS_ISTATISTIK_ID", match.id);
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        openIstatistikLookup("ARBITRAJ_SATIS_ISTATISTIK_ID", "Arbitraj Satış İstatistik Seçimi", (e.target as HTMLInputElement).value);
                                      }
                                    }}
                                    title={getIstatistikName(formData.ARBITRAJ_SATIS_ISTATISTIK_ID) || "Arbitraj Satış"}
                                  />
                                  <Button
                                    variant="outline-primary"
                                    onClick={() => openIstatistikLookup("ARBITRAJ_SATIS_ISTATISTIK_ID", "Arbitraj Satış İstatistik Seçimi", getIstatistikName(formData.ARBITRAJ_SATIS_ISTATISTIK_ID))}
                                    title="Listeden Seç (Dürbün / Enter)"
                                    className="d-flex align-items-center px-2 flex-shrink-0"
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
                  </Row>
                </Tab.Pane>

                {/* ─── TAB 3: MUHASEBE & HESAP PLANI ─── */}
                <Tab.Pane eventKey="muhasebe">
                  <Row className="g-3">
                    <Col xs={12} md={6}>
                      <div className="p-3 bg-light rounded-3 border h-100">
                        <Row className="g-2">
                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">Kasa Hesabı:</Form.Label>
                              <Col>
                                <Form.Control
                                  type="text"
                                  value={formData.KASA_HESABI || ""}
                                  onChange={(e) => handleChange("KASA_HESABI", e.target.value)}
                                  className="bg-white border font-monospace text-start"
                                  style={{ maxWidth: "110px" }}
                                />
                              </Col>
                            </Form.Group>
                          </Col>

                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">Komisyon Hesabı:</Form.Label>
                              <Col>
                                <Form.Control
                                  type="text"
                                  value={formData.KOMISYON_HESABI || ""}
                                  onChange={(e) => handleChange("KOMISYON_HESABI", e.target.value)}
                                  className="bg-white border font-monospace text-start"
                                  style={{ maxWidth: "110px" }}
                                />
                              </Col>
                            </Form.Group>
                          </Col>

                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">BMV Hesabı:</Form.Label>
                              <Col>
                                <Form.Control
                                  type="text"
                                  value={formData.BMV_HESABI || ""}
                                  onChange={(e) => handleChange("BMV_HESABI", e.target.value)}
                                  className="bg-white border font-monospace text-start"
                                  style={{ maxWidth: "110px" }}
                                />
                              </Col>
                            </Form.Group>
                          </Col>

                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">KMV Hesabı:</Form.Label>
                              <Col>
                                <Form.Control
                                  type="text"
                                  value={formData.KMV_HESABI || ""}
                                  onChange={(e) => handleChange("KMV_HESABI", e.target.value)}
                                  className="bg-white border font-monospace text-start"
                                  style={{ maxWidth: "110px" }}
                                />
                              </Col>
                            </Form.Group>
                          </Col>

                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">KMV Gider Hesabı:</Form.Label>
                              <Col>
                                <Form.Control
                                  type="text"
                                  value={formData.KMV_GIDER_HESABI || ""}
                                  onChange={(e) => handleChange("KMV_GIDER_HESABI", e.target.value)}
                                  className="bg-white border font-monospace text-start"
                                  style={{ maxWidth: "110px" }}
                                />
                              </Col>
                            </Form.Group>
                          </Col>

                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">Üretim Hesabı:</Form.Label>
                              <Col>
                                <InputGroup size="sm" className="flex-nowrap">
                                  <div
                                    className="form-control form-control-sm bg-white text-truncate text-secondary flex-grow-1 text-start"
                                    style={{ fontSize: "0.82rem", minWidth: 0, cursor: "pointer" }}
                                    onClick={openUretimHesabiLookup}
                                    title={getHesapName(formData.URETIM_HESABI_ID)}
                                  >
                                    {getHesapName(formData.URETIM_HESABI_ID) || (formData.URETIM_HESABI ? formData.URETIM_HESABI : "Üretim Hesabı Seçiniz (A- Hesap Kayıt)")}
                                  </div>
                                  <Button
                                    variant="outline-primary"
                                    onClick={openUretimHesabiLookup}
                                    title="Listeden Seç (Dürbün - A- Hesap Kayıt)"
                                    className="d-flex align-items-center px-2 flex-shrink-0"
                                  >
                                    <IconBinoculars size={16} />
                                  </Button>
                                </InputGroup>
                              </Col>
                            </Form.Group>
                          </Col>

                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">İskonto :</Form.Label>
                              <Col>
                                <InputGroup size="sm" className="flex-nowrap">
                                  <div
                                    className="form-control form-control-sm bg-white text-truncate text-secondary flex-grow-1 text-start"
                                    style={{ fontSize: "0.82rem", minWidth: 0, cursor: "pointer" }}
                                    onClick={openIskontoLookup}
                                    title={getIskontoName(formData.ISKONTO_ID)}
                                  >
                                    {getIskontoName(formData.ISKONTO_ID) || "İskonto Seçiniz"}
                                  </div>
                                  <Button
                                    variant="outline-primary"
                                    onClick={openIskontoLookup}
                                    title="Listeden Seç (Dürbün - İskonto Tanımları)"
                                    className="d-flex align-items-center px-2 flex-shrink-0"
                                  >
                                    <IconBinoculars size={16} />
                                  </Button>
                                </InputGroup>
                              </Col>
                            </Form.Group>
                          </Col>

                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">Kambiyo Kar Hesabı:</Form.Label>
                              <Col>
                                <Form.Control
                                  type="text"
                                  value={formData.KAMBIYO_KAR_HESABI || ""}
                                  onChange={(e) => handleChange("KAMBIYO_KAR_HESABI", e.target.value)}
                                  className="bg-white border font-monospace text-start"
                                  style={{ maxWidth: "110px" }}
                                />
                              </Col>
                            </Form.Group>
                          </Col>

                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">Kambiyo Zarar Hesabı:</Form.Label>
                              <Col>
                                <Form.Control
                                  type="text"
                                  value={formData.KAMBIYO_ZARAR_HESABI || ""}
                                  onChange={(e) => handleChange("KAMBIYO_ZARAR_HESABI", e.target.value)}
                                  className="bg-white border font-monospace text-start"
                                  style={{ maxWidth: "110px" }}
                                />
                              </Col>
                            </Form.Group>
                          </Col>
                        </Row>
                      </div>
                    </Col>

                    <Col xs={12} md={6}>
                      <div className="p-3 bg-light rounded-3 border h-100">
                        <Row className="g-2">
                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">Sermaye Hesabı:</Form.Label>
                              <Col>
                                <InputGroup size="sm" className="flex-nowrap" style={{ maxWidth: "160px" }}>
                                  <div
                                    className="form-control form-control-sm bg-white text-truncate text-secondary text-start"
                                    style={{ fontSize: "0.82rem" }}
                                    title={getHesapName(formData.SERMAYE_HESABI_ID)}
                                  >
                                    {getHesapName(formData.SERMAYE_HESABI_ID) || "Hesap Seçiniz"}
                                  </div>
                                  <Button
                                    variant="outline-primary"
                                    onClick={openSermayeHesabiLookup}
                                    title="Listeden Seç (Dürbün - A- Hesap Kayıt)"
                                    className="d-flex align-items-center px-2 flex-shrink-0"
                                  >
                                    <IconBinoculars size={16} />
                                  </Button>
                                </InputGroup>
                              </Col>
                            </Form.Group>
                          </Col>

                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">İşçilik Hesabı:</Form.Label>
                              <Col>
                                <Form.Control
                                  type="text"
                                  value={formData.ISCILIK_HESABI || ""}
                                  onChange={(e) => handleChange("ISCILIK_HESABI", e.target.value)}
                                  className="bg-white border font-monospace text-start"
                                  style={{ maxWidth: "110px" }}
                                />
                              </Col>
                            </Form.Group>
                          </Col>

                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">KMV Uygulama Şekli:</Form.Label>
                              <Col>
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

                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">KDV Gelir Hesabı:</Form.Label>
                              <Col>
                                <Form.Control
                                  type="text"
                                  value={formData.KDV_GELIR_HESABI || ""}
                                  onChange={(e) => handleChange("KDV_GELIR_HESABI", e.target.value)}
                                  className="bg-white border font-monospace text-start"
                                  style={{ maxWidth: "110px" }}
                                />
                              </Col>
                            </Form.Group>
                          </Col>

                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">KDV Gider Hesabı:</Form.Label>
                              <Col>
                                <Form.Control
                                  type="text"
                                  value={formData.KDV_GIDER_HESABI || ""}
                                  onChange={(e) => handleChange("KDV_GIDER_HESABI", e.target.value)}
                                  className="bg-white border font-monospace text-start"
                                  style={{ maxWidth: "110px" }}
                                />
                              </Col>
                            </Form.Group>
                          </Col>

                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">Hesap Yılı:</Form.Label>
                              <Col>
                                <Form.Control
                                  type="number"
                                  value={formData.HESAP_YILI ?? ""}
                                  onChange={(e) => handleNumericInput("HESAP_YILI", e.target.value)}
                                  onKeyDown={(e) => blockNonNumericKeys(e)}
                                  className="bg-white border font-monospace text-end"
                                  style={{ maxWidth: "80px" }}
                                />
                              </Col>
                            </Form.Group>
                          </Col>

                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">İşçilik Giriş Şekli:</Form.Label>
                              <Col>
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
                        <Row className="g-2">
                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">TL Vergi Sınırı:</Form.Label>
                              <Col>
                                <Form.Control
                                  type="number"
                                  value={formData.TL_VERGI_SINIRI ?? ""}
                                  onChange={(e) => handleNumericInput("TL_VERGI_SINIRI", e.target.value)}
                                  onKeyDown={(e) => blockNonNumericKeys(e)}
                                  className="bg-white border font-monospace text-end"
                                  style={{ maxWidth: "100px" }}
                                />
                              </Col>
                            </Form.Group>
                          </Col>

                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">Döviz Vergi Sınırı:</Form.Label>
                              <Col>
                                <Form.Control
                                  type="number"
                                  value={formData.DOVIZ_VERGI_SINIRI ?? ""}
                                  onChange={(e) => handleNumericInput("DOVIZ_VERGI_SINIRI", e.target.value)}
                                  onKeyDown={(e) => blockNonNumericKeys(e)}
                                  className="bg-white border font-monospace text-end"
                                  style={{ maxWidth: "100px" }}
                                />
                              </Col>
                            </Form.Group>
                          </Col>

                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">Altın Vergi Sınırı:</Form.Label>
                              <Col>
                                <Form.Control
                                  type="number"
                                  value={formData.ALTIN_VERGI_SINIRI ?? ""}
                                  onChange={(e) => handleNumericInput("ALTIN_VERGI_SINIRI", e.target.value)}
                                  onKeyDown={(e) => blockNonNumericKeys(e)}
                                  className="bg-white border font-monospace text-end"
                                  style={{ maxWidth: "100px" }}
                                />
                              </Col>
                            </Form.Group>
                          </Col>

                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">Sarrafiye Kimlik Sınırı:</Form.Label>
                              <Col>
                                <Form.Control
                                  type="number"
                                  value={formData.SAR_KIMLIK_KONTROL_SINIRI ?? ""}
                                  onChange={(e) => handleNumericInput("SAR_KIMLIK_KONTROL_SINIRI", e.target.value)}
                                  onKeyDown={(e) => blockNonNumericKeys(e)}
                                  className="bg-white border font-monospace text-end"
                                  style={{ maxWidth: "100px" }}
                                />
                              </Col>
                            </Form.Group>
                          </Col>

                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">Döviz Sınır Para:</Form.Label>
                              <Col>
                                <InputGroup size="sm" className="flex-nowrap">
                                  <div className="form-control form-control-sm bg-white text-truncate text-secondary" style={{ fontSize: "0.82rem" }} title={getParaName(formData.DOVIZ_VERGI_SINIRI_PARA_ID)}>
                                    {getParaName(formData.DOVIZ_VERGI_SINIRI_PARA_ID) || "USD"}
                                  </div>
                                  <Button
                                    variant="outline-primary"
                                    onClick={() => openParaLookup("DOVIZ_VERGI_SINIRI_PARA_ID", "Döviz Sınır Para Birimi Seçimi")}
                                    title="Listeden Seç (Dürbün)"
                                    className="d-flex align-items-center px-2 flex-shrink-0"
                                  >
                                    <IconBinoculars size={16} />
                                  </Button>
                                </InputGroup>
                              </Col>
                            </Form.Group>
                          </Col>

                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">Altın Sınır Para:</Form.Label>
                              <Col>
                                <InputGroup size="sm" className="flex-nowrap">
                                  <div className="form-control form-control-sm bg-white text-truncate text-secondary" style={{ fontSize: "0.82rem" }} title={getParaName(formData.ALTIN_VERGI_SINIRI_PARA_ID)}>
                                    {getParaName(formData.ALTIN_VERGI_SINIRI_PARA_ID) || "USD"}
                                  </div>
                                  <Button
                                    variant="outline-primary"
                                    onClick={() => openParaLookup("ALTIN_VERGI_SINIRI_PARA_ID", "Altın Sınır Para Birimi Seçimi")}
                                    title="Listeden Seç (Dürbün)"
                                    className="d-flex align-items-center px-2 flex-shrink-0"
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
                        <Row className="g-2">
                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">Cari TL Toleransı:</Form.Label>
                              <Col>
                                <Form.Control
                                  type="number"
                                  step="0.01"
                                  value={formData.CARI_TL_TOLERANSI ?? ""}
                                  onChange={(e) => handleNumericInput("CARI_TL_TOLERANSI", e.target.value)}
                                  onKeyDown={(e) => blockNonNumericKeys(e, true)}
                                  className="bg-white border font-monospace text-end"
                                  style={{ maxWidth: "90px" }}
                                />
                              </Col>
                            </Form.Group>
                          </Col>

                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">Cari USD Toleransı:</Form.Label>
                              <Col>
                                <Form.Control
                                  type="number"
                                  step="0.01"
                                  value={formData.CARI_USD_TOLERANSI ?? ""}
                                  onChange={(e) => handleNumericInput("CARI_USD_TOLERANSI", e.target.value)}
                                  onKeyDown={(e) => blockNonNumericKeys(e, true)}
                                  className="bg-white border font-monospace text-end"
                                  style={{ maxWidth: "90px" }}
                                />
                              </Col>
                            </Form.Group>
                          </Col>

                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">TL Yuvarlama Aralığı:</Form.Label>
                              <Col>
                                <Form.Control
                                  type="number"
                                  step="0.01"
                                  value={formData.TL_YUVARLAMA_ARALIGI ?? ""}
                                  onChange={(e) => handleNumericInput("TL_YUVARLAMA_ARALIGI", e.target.value)}
                                  onKeyDown={(e) => blockNonNumericKeys(e, true)}
                                  className="bg-white border font-monospace text-end"
                                  style={{ maxWidth: "90px" }}
                                />
                              </Col>
                            </Form.Group>
                          </Col>

                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">TL Yuvarlama Eşiği:</Form.Label>
                              <Col>
                                <Form.Control
                                  type="number"
                                  step="0.01"
                                  value={formData.TL_YUVARLAMA_ESIGI ?? ""}
                                  onChange={(e) => handleNumericInput("TL_YUVARLAMA_ESIGI", e.target.value)}
                                  onKeyDown={(e) => blockNonNumericKeys(e, true)}
                                  className="bg-white border font-monospace text-end"
                                  style={{ maxWidth: "90px" }}
                                />
                              </Col>
                            </Form.Group>
                          </Col>

                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">Satışın Dayanağı :</Form.Label>
                              <Col>
                                <Form.Control
                                  type="text"
                                  value={formData.SATISIN_DAYANAGI || ""}
                                  onChange={(e) => handleChange("SATISIN_DAYANAGI", e.target.value)}
                                  className="bg-white border"
                                />
                              </Col>
                            </Form.Group>
                          </Col>

                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">Vergi No Sorgulama:</Form.Label>
                              <Col>
                                <Form.Control
                                  type="number"
                                  value={formData.VERGI_NO_SORGULAMA_YONTEMI ?? ""}
                                  onChange={(e) => handleNumericInput("VERGI_NO_SORGULAMA_YONTEMI", e.target.value)}
                                  onKeyDown={(e) => blockNonNumericKeys(e)}
                                  className="bg-white border font-monospace text-end"
                                  style={{ maxWidth: "90px" }}
                                />
                              </Col>
                            </Form.Group>
                          </Col>

                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">Sorgulayan TC No:</Form.Label>
                              <Col>
                                <Form.Control
                                  type="text"
                                  value={formData.VERGI_SORGULAYAN_TC_NO || ""}
                                  onChange={(e) => handleChange("VERGI_SORGULAYAN_TC_NO", e.target.value)}
                                  className="bg-white border font-monospace text-end"
                                  style={{ maxWidth: "110px" }}
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
                        <Row className="g-2">
                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">E-Belge Server IP:</Form.Label>
                              <Col>
                                <Form.Control
                                  type="text"
                                  value={formData.E_BELGE_SERVER_IP || ""}
                                  onChange={(e) => handleChange("E_BELGE_SERVER_IP", e.target.value)}
                                  className="bg-white border font-monospace"
                                />
                              </Col>
                            </Form.Group>
                          </Col>

                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">Server Portu:</Form.Label>
                              <Col>
                                <Form.Control
                                  type="number"
                                  value={formData.E_BELGE_SERVER_PORTU ?? ""}
                                  onChange={(e) => handleNumericInput("E_BELGE_SERVER_PORTU", e.target.value)}
                                  onKeyDown={(e) => blockNonNumericKeys(e)}
                                  className="bg-white border font-monospace text-end"
                                  style={{ maxWidth: "90px" }}
                                />
                              </Col>
                            </Form.Group>
                          </Col>

                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">Entegratör Yanıt Süresi:</Form.Label>
                              <Col>
                                <Form.Control
                                  type="number"
                                  value={formData.ENTEGRATOR_YANIT_VERME_SURESI ?? ""}
                                  onChange={(e) => handleNumericInput("ENTEGRATOR_YANIT_VERME_SURESI", e.target.value)}
                                  onKeyDown={(e) => blockNonNumericKeys(e)}
                                  className="bg-white border font-monospace text-end"
                                  style={{ maxWidth: "90px" }}
                                />
                              </Col>
                            </Form.Group>
                          </Col>

                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">TÜRMOB Şifresi:</Form.Label>
                              <Col>
                                <Form.Control
                                  type="password"
                                  name="musavir_turmob_pwd_cfg"
                                  autoComplete="new-password"
                                  data-lpignore="true"
                                  data-1p-ignore="true"
                                  data-form-type="other"
                                  spellCheck={false}
                                  value={formData.MUSAVIR_TURMOB_SIFRESI || ""}
                                  onChange={(e) => handleChange("MUSAVIR_TURMOB_SIFRESI", e.target.value)}
                                  className="bg-white border"
                                />
                              </Col>
                            </Form.Group>
                          </Col>

                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">E-Fatura Portal Adresi:</Form.Label>
                              <Col>
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
                            </div>
                          </Col>
                        </Row>
                      </div>
                    </Col>

                    <Col xs={12} md={6}>
                      <div className="p-3 bg-light rounded-3 border h-100">
                        <Row className="g-2">
                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">E-Fatura Posta Kutusu:</Form.Label>
                              <Col>
                                <InputGroup size="sm">
                                  <Form.Control
                                    type="text"
                                    value={formData.E_FATURA_POSTA_KUTUSU || ""}
                                    onChange={(e) => handleChange("E_FATURA_POSTA_KUTUSU", e.target.value)}
                                    className="bg-white border font-monospace"
                                  />
                                  <Button
                                    variant="outline-primary"
                                    onClick={() => handleGibtenGetir("E_FATURA_POSTA_KUTUSU")}
                                    disabled={isGibSorgulaniyor}
                                    title="VKN/TCKN üzerinden GİB'den e-Fatura posta kutusunu getir"
                                    className="d-flex align-items-center px-2 flex-shrink-0"
                                  >
                                    {isGibSorgulaniyor && targetGibField === "E_FATURA_POSTA_KUTUSU" ? (
                                      <Spinner size="sm" animation="border" />
                                    ) : (
                                      <IconDownload size={15} />
                                    )}
                                    <span className="ms-1" style={{ fontSize: "0.8rem" }}>GİB'ten Getir</span>
                                  </Button>
                                </InputGroup>
                              </Col>
                            </Form.Group>
                          </Col>

                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">E-İrsaliye Posta Kutusu:</Form.Label>
                              <Col>
                                <InputGroup size="sm">
                                  <Form.Control
                                    type="text"
                                    value={formData.E_IRSALIYE_POSTA_KUTUSU || ""}
                                    onChange={(e) => handleChange("E_IRSALIYE_POSTA_KUTUSU", e.target.value)}
                                    className="bg-white border font-monospace"
                                  />
                                  <Button
                                    variant="outline-primary"
                                    onClick={() => handleGibtenGetir("E_IRSALIYE_POSTA_KUTUSU")}
                                    disabled={isGibSorgulaniyor}
                                    title="VKN/TCKN üzerinden GİB'den e-İrsaliye posta kutusunu getir"
                                    className="d-flex align-items-center px-2 flex-shrink-0"
                                  >
                                    {isGibSorgulaniyor && targetGibField === "E_IRSALIYE_POSTA_KUTUSU" ? (
                                      <Spinner size="sm" animation="border" />
                                    ) : (
                                      <IconDownload size={15} />
                                    )}
                                    <span className="ms-1" style={{ fontSize: "0.8rem" }}>GİB'ten Getir</span>
                                  </Button>
                                </InputGroup>
                              </Col>
                            </Form.Group>
                          </Col>

                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">KDV Muafiyet Kodu:</Form.Label>
                              <Col>
                                <Form.Control
                                  type="text"
                                  value={formData.E_FATURA_KDV_MUAFIYET_KODU || ""}
                                  onChange={(e) => handleChange("E_FATURA_KDV_MUAFIYET_KODU", e.target.value)}
                                  className="bg-white border font-monospace"
                                />
                              </Col>
                            </Form.Group>
                          </Col>

                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">KDV Muafiyet Adı:</Form.Label>
                              <Col>
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
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">Belge Dizini:</Form.Label>
                              <Col>
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
                        <Row className="g-2">
                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">Tazeleme Süresi (Sn):</Form.Label>
                              <Col>
                                <Form.Control
                                  type="number"
                                  value={formData.TAZELEME_SURESI ?? ""}
                                  onChange={(e) => handleNumericInput("TAZELEME_SURESI", e.target.value)}
                                  onKeyDown={(e) => blockNonNumericKeys(e)}
                                  className="bg-white border font-monospace text-end"
                                  style={{ maxWidth: "90px" }}
                                />
                              </Col>
                            </Form.Group>
                          </Col>

                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">Değişiklik Takip Şifresi:</Form.Label>
                              <Col>
                                <Form.Control
                                  type="password"
                                  name="degisiklik_takip_pwd_cfg"
                                  autoComplete="new-password"
                                  data-lpignore="true"
                                  data-1p-ignore="true"
                                  data-form-type="other"
                                  spellCheck={false}
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
                        <Row className="g-2">
                          <Col xs={12}>
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">Yedek Klasörü (1. Yol):</Form.Label>
                              <Col>
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
                            <Form.Group as={Row} className="mb-2 align-items-center g-2">
                              <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0">İkinci Yedek Klasörü:</Form.Label>
                              <Col>
                                <Form.Control
                                  type="text"
                                  value={formData.IKINCI_YEDEK_KLASORU || ""}
                                  onChange={(e) => handleChange("IKINCI_YEDEK_KLASORU", e.target.value)}
                                  className="bg-white border font-monospace"
                                />
                              </Col>
                            </Form.Group>
                          </Col>

                          <Col xs={12} className="mt-3">
                            <div className="d-flex flex-column gap-2">
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

        {/* GİB Çoklu Posta Kutusu Seçim Modalı */}
        <Modal show={gibSecimListesi.length > 0} onHide={() => setGibSecimListesi([])} centered>
          <Modal.Header closeButton>
            <Modal.Title className="fs-6 fw-semibold d-flex align-items-center gap-2">
              <IconDownload size={18} /> GİB'de birden fazla posta kutusu bulundu
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="p-2">
            <div className="small text-secondary mb-2 px-1">Firma tanımına işlenecek posta kutusunu seçiniz:</div>
            <div className="list-group">
              {gibSecimListesi.map((k, i) => {
                const alias = k.Alias || k.Identifier || "";
                const eposta = gibAliasToEposta(alias);
                return (
                  <button
                    type="button"
                    key={`${alias}-${i}`}
                    className="list-group-item list-group-item-action py-2"
                    onClick={() => gibKaydiniUygula(k, targetGibField)}
                  >
                    <div className="font-monospace small fw-bold">{alias}</div>
                    <div className="small text-secondary">
                      {k.Title || "—"}{eposta ? ` · ${eposta}` : ""}{k.Type ? ` · ${k.Type}` : ""}
                    </div>
                  </button>
                );
              })}
            </div>
          </Modal.Body>
          <Modal.Footer className="py-2">
            <Button variant="secondary" size="sm" onClick={() => setGibSecimListesi([])}>Vazgeç</Button>
          </Modal.Footer>
        </Modal>

        {/* Reusable Lookup Modal for all Dürbün selections */}
        <LookupModal
          show={lookupModalConfig.show}
          onHide={() => setLookupModalConfig((prev) => ({ ...prev, show: false }))}
          title={lookupModalConfig.title}
          items={lookupModalConfig.items}
          selectedId={lookupModalConfig.selectedId}
          initialSearchTerm={lookupModalConfig.initialSearchTerm}
          columns={lookupModalConfig.columns}
          filterFn={lookupModalConfig.filterFn}
          onSelect={lookupModalConfig.onSelect}
        />
      </div>
    </Tab.Container>
  );
};

export default CompanyDefinitionsPage;
