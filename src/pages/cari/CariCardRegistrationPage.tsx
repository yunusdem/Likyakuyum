import React, { useState, useEffect } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
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
  Tab,
  Nav,
} from "react-bootstrap";
import {
  IconUsers,
  IconCheck,
  IconAlertCircle,
  IconTrash,
  IconBuildingStore,
  IconMapPin,
  IconIdBadge2,
  IconFileCertificate,
  IconReceipt2,
  IconPhone,
  IconMail,
  IconBrandWhatsapp,
  IconDeviceFloppy,
  IconArrowLeft,
  IconArrowRight,
  IconPlus,
  IconRefresh,
  IconPrinter,
  IconSearch,
} from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import CodeLookupInput from "../../components/common/CodeLookupInput";
import LookupModal from "../../components/common/LookupModal";
import { printReportTable } from "../../utils/printReport";
import {
  CariService,
  CariKartItem,
  CariKartFormData,
  CariLookups,
} from "../../services/cariService";

const initialFormState: CariKartFormData = {
  kod: "",
  ad: "",
  kisilikTipi: 2, // 2: Tüzel Kişi (Default)
  yetkiliKisi: "",
  vergiDairesiId: null,
  vergiKimlikNo: "",
  babaAdi: "",
  adres: "",
  postaKoduId: null,
  ilceId: null,
  ilId: null,
  telefon: "",
  uyrukId: 218, // 218: Türkiye
  ulkeId: 218,
  hukukiYapiId: null,
  vekilTuru: 0,
  vekilKisilikTipi: null,
  vekilAdi: "",
  vekilKimlikNo: "",
  pasaportNo: "",
  alisIstatistikId: null,
  satisIstatistikId: null,
  arbitrajAlisIstatistikId: null,
  arbitrajSatisIstatistikId: null,
  eposta: "",
  bankaHesabiId: null,
  anneAdi: "",
  kimlikSeriNo: "",
  dogumTarihi: "",
  dogumYeri: "",
  karaListede: false,
  sektorId: null,
  meslekId: null,
  kimlikGecerlilikTarihi: "",
  faaliyetBelgesiAlindi: false,
  vergiLevhasiAlindi: false,
  imzaSirkuleriAlindi: false,
  imzaSirkuGecerlilikTarihi: "",
  yetkiliKimlikNo: "",
  yetkiliKmlkGecerlikTarih: "",
  filtre: "",
  cariBakiyeSiniri: null,
  sirketTuru: null,
  kimlikBelgeTuru: null,
  dernekAmaci: "",
  yetkiliKisiId: null,
  favoriParaId: null,
  whatsappAdi: "",
  eFaturaPostaKutusu: "",
  eIrsaliyePostaKutusu: "",
};

const KISILIK_TIPI_OPTIONS: Record<number, string> = {
  1: "1 - Gerçek Kişi (Şahıs)",
  2: "2 - Tüzel Kişi (Şirket)",
  3: "3 - Yabancı Gerçek Kişi",
  4: "4 - Yabancı Tüzel Kişi",
};

export const CariCardRegistrationPage: React.FC = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isEditPage = location.pathname.includes("kart-duzeltme");
  const pageTitle = isEditPage ? "B- Cari Kart Düzeltme" : "A- Cari Kart Kayıt";

  // Data states
  const [cariList, setCariList] = useState<CariKartItem[]>([]);
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
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [selectedCari, setSelectedCari] = useState<CariKartItem | null>(null);
  const [formData, setFormData] = useState<CariKartFormData>(initialFormState);
  const [isNewRecord, setIsNewRecord] = useState<boolean>(!isEditPage);
  const [activeTab, setActiveTab] = useState<string>("general");

  // Field validation errors
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});

  // UI / Status states
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [alertSuccess, setAlertSuccess] = useState<string | null>(null);
  const [alertError, setAlertError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [showLookupModal, setShowLookupModal] = useState<boolean>(false);

  // Load all cari cards and lookups
  const loadData = async (targetIndex?: number, explicitTargetId?: number | string) => {
    try {
      setIsLoading(true);
      setAlertError(null);

      const [list, lk] = await Promise.all([
        CariService.getCariKartlar(),
        CariService.getLookups().catch(() => ({
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
        })),
      ]);

      const items = list || [];
      setCariList(items);
      setLookups(lk);

      // Hedef ID'yi parametre, URL query (?id=) veya location.state üzerinden belirle
      const queryId =
        explicitTargetId !== undefined && explicitTargetId !== null
          ? String(explicitTargetId)
          : searchParams.get("id") ||
            (location.state as any)?.id ||
            (location.state as any)?.item?.id;

      if (items.length > 0) {
        if (queryId) {
          const foundIdx = items.findIndex((c) => String(c.id) === String(queryId));
          if (foundIdx !== -1) {
            setSelectedIndex(foundIdx);
            handleSelectCari(items[foundIdx], foundIdx);
            return;
          }
        }

        if (isEditPage) {
          const idx =
            targetIndex !== undefined && targetIndex >= 0 && targetIndex < items.length
              ? targetIndex
              : 0;
          setSelectedIndex(idx);
          handleSelectCari(items[idx], idx);
        } else {
          handleClear();
        }
      } else {
        handleClear();
      }
    } catch (err: any) {
      setAlertError(err.message || "Cari kartlar yüklenirken bir hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [location.pathname, location.search, location.state]);

  const handleSelectCari = (item: CariKartItem, idx?: number) => {
    setSelectedCari(item);
    if (idx !== undefined) {
      setSelectedIndex(idx);
    } else {
      const foundIdx = cariList.findIndex((c) => c.id === item.id);
      if (foundIdx !== -1) setSelectedIndex(foundIdx);
    }
    setIsNewRecord(false);
    setFormData({
      kod: item.kod,
      ad: item.ad,
      kisilikTipi: item.kisilikTipi,
      yetkiliKisi: item.yetkiliKisi || "",
      vergiDairesiId: item.vergiDairesiId,
      vergiKimlikNo: item.vergiKimlikNo || "",
      babaAdi: item.babaAdi || "",
      adres: item.adres || "",
      postaKoduId: item.postaKoduId,
      ilceId: item.ilceId,
      ilId: item.ilId,
      telefon: item.telefon || "",
      uyrukId: item.uyrukId || 218,
      ulkeId: item.ulkeId || 218,
      hukukiYapiId: item.hukukiYapiId,
      vekilTuru: item.vekilTuru || 0,
      vekilKisilikTipi: item.vekilKisilikTipi,
      vekilAdi: item.vekilAdi || "",
      vekilKimlikNo: item.vekilKimlikNo || "",
      pasaportNo: item.pasaportNo || "",
      alisIstatistikId: item.alisIstatistikId,
      satisIstatistikId: item.satisIstatistikId,
      arbitrajAlisIstatistikId: item.arbitrajAlisIstatistikId,
      arbitrajSatisIstatistikId: item.arbitrajSatisIstatistikId,
      eposta: item.eposta || "",
      bankaHesabiId: item.bankaHesabiId,
      anneAdi: item.anneAdi || "",
      kimlikSeriNo: item.kimlikSeriNo || "",
      dogumTarihi: item.dogumTarihi || "",
      dogumYeri: item.dogumYeri || "",
      karaListede: item.karaListede,
      sektorId: item.sektorId,
      meslekId: item.meslekId,
      kimlikGecerlilikTarihi: item.kimlikGecerlilikTarihi || "",
      faaliyetBelgesiAlindi: item.faaliyetBelgesiAlindi,
      vergiLevhasiAlindi: item.vergiLevhasiAlindi,
      imzaSirkuleriAlindi: item.imzaSirkuleriAlindi,
      imzaSirkuGecerlilikTarihi: item.imzaSirkuGecerlilikTarihi || "",
      yetkiliKimlikNo: item.yetkiliKimlikNo || "",
      yetkiliKmlkGecerlikTarih: item.yetkiliKmlkGecerlikTarih || "",
      filtre: item.filtre || "",
      cariBakiyeSiniri: item.cariBakiyeSiniri,
      sirketTuru: item.sirketTuru,
      kimlikBelgeTuru: item.kimlikBelgeTuru,
      dernekAmaci: item.dernekAmaci || "",
      yetkiliKisiId: item.yetkiliKisiId,
      favoriParaId: item.favoriParaId,
      whatsappAdi: item.whatsappAdi || "",
      eFaturaPostaKutusu: item.eFaturaPostaKutusu || "",
      eIrsaliyePostaKutusu: item.eIrsaliyePostaKutusu || "",
    });
    setFieldErrors({});
    setAlertError(null);
  };

  const handleClear = () => {
    setSelectedCari(null);
    setIsNewRecord(true);
    setFormData({
      ...initialFormState,
      kod: "",
    });
    setFieldErrors({});
    setAlertError(null);
  };

  const handleNewCari = () => {
    handleClear();
  };

  const validateField = (field: string, value: any): string => {
    if (field === "kod") {
      if (!value || String(value).trim() === "") return "Cari Kodu zorunludur.";
      if (String(value).trim().length > 20) return "Cari Kodu en fazla 20 karakter olabilir.";
    }
    if (field === "ad") {
      if (!value || String(value).trim() === "") return "Cari Ünvan / Adı zorunludur.";
    }
    if (field === "vergiKimlikNo" && value) {
      const clean = String(value).replace(/\s/g, "");
      if (clean.length > 0 && !/^\d{10}$|^\d{11}$/.test(clean)) {
        return "Vergi / TC Kimlik No 10 haneli (VKN) veya 11 haneli (TCKN) rakamlardan oluşmalıdır.";
      }
    }
    if (field === "telefon" && value) {
      const clean = String(value).replace(/[\s()+-]/g, "");
      if (clean.length > 0 && clean.length < 7) {
        return "Geçersiz telefon numarası.";
      }
    }
    if (field === "eposta" && value) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) {
        return "Geçersiz e-posta formatı.";
      }
    }
    if (field === "cariBakiyeSiniri" && value !== null && value !== undefined && value !== "") {
      const num = parseFloat(value);
      if (isNaN(num) || num < 0) {
        return "Bakiye sınırı 0 veya pozitif bir sayı olmalıdır.";
      }
    }
    if (field === "yetkiliKimlikNo" && value) {
      const clean = String(value).replace(/\s/g, "");
      if (clean.length > 0 && clean.length !== 11) {
        return "Yetkili Kimlik No 11 haneli olmalıdır.";
      }
    }
    if (field === "vekilKimlikNo" && value) {
      const clean = String(value).replace(/\s/g, "");
      if (clean.length > 0 && clean.length !== 11) {
        return "Vekil Kimlik No 11 haneli olmalıdır.";
      }
    }
    return "";
  };

  const handleInputChange = (field: keyof CariKartFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    const err = validateField(field as string, value);
    setFieldErrors((prev) => {
      const copy = { ...prev };
      if (err) copy[field as string] = err;
      else delete copy[field as string];
      return copy;
    });
  };

  const handleNavigate = (direction: "first" | "prev" | "next" | "last") => {
    if (cariList.length === 0) return;
    let newIndex = selectedIndex;
    if (direction === "first") newIndex = 0;
    else if (direction === "prev") newIndex = Math.max(0, selectedIndex - 1);
    else if (direction === "next") newIndex = Math.min(cariList.length - 1, selectedIndex + 1);
    else if (direction === "last") newIndex = cariList.length - 1;

    setSelectedIndex(newIndex);
    handleSelectCari(cariList[newIndex], newIndex);
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const errors: { [key: string]: string } = {};
    const kodErr = validateField("kod", formData.kod);
    if (kodErr) errors.kod = kodErr;
    const adErr = validateField("ad", formData.ad);
    if (adErr) errors.ad = adErr;
    const vknErr = validateField("vergiKimlikNo", formData.vergiKimlikNo);
    if (vknErr) errors.vergiKimlikNo = vknErr;
    const telErr = validateField("telefon", formData.telefon);
    if (telErr) errors.telefon = telErr;
    const mailErr = validateField("eposta", formData.eposta);
    if (mailErr) errors.eposta = mailErr;
    const bakiyeErr = validateField("cariBakiyeSiniri", formData.cariBakiyeSiniri);
    if (bakiyeErr) errors.cariBakiyeSiniri = bakiyeErr;

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setAlertError("Lütfen formdaki kırmızı renkli zorunlu/hatalı alanları düzeltin.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const payload: CariKartFormData = {
      kod: formData.kod.trim().toUpperCase(),
      ad: formData.ad.trim(),
      kisilikTipi: parseInt(String(formData.kisilikTipi), 10) || 2,
      yetkiliKisi: formData.yetkiliKisi ? formData.yetkiliKisi.trim() : null,
      vergiDairesiId:
        formData.vergiDairesiId !== null &&
        formData.vergiDairesiId !== undefined &&
        String(formData.vergiDairesiId) !== ""
          ? parseInt(String(formData.vergiDairesiId), 10)
          : null,
      vergiKimlikNo: formData.vergiKimlikNo ? formData.vergiKimlikNo.trim() : null,
      babaAdi: formData.babaAdi ? formData.babaAdi.trim() : null,
      adres: formData.adres ? formData.adres.trim() : null,
      postaKoduId:
        formData.postaKoduId !== null &&
        formData.postaKoduId !== undefined &&
        String(formData.postaKoduId) !== ""
          ? parseInt(String(formData.postaKoduId), 10)
          : null,
      ilceId:
        formData.ilceId !== null &&
        formData.ilceId !== undefined &&
        String(formData.ilceId) !== ""
          ? parseInt(String(formData.ilceId), 10)
          : null,
      ilId:
        formData.ilId !== null &&
        formData.ilId !== undefined &&
        String(formData.ilId) !== ""
          ? parseInt(String(formData.ilId), 10)
          : null,
      telefon: formData.telefon ? formData.telefon.trim() : null,
      uyrukId:
        formData.uyrukId !== null &&
        formData.uyrukId !== undefined &&
        String(formData.uyrukId) !== ""
          ? parseInt(String(formData.uyrukId), 10)
          : 218,
      ulkeId:
        formData.ulkeId !== null &&
        formData.ulkeId !== undefined &&
        String(formData.ulkeId) !== ""
          ? parseInt(String(formData.ulkeId), 10)
          : 218,
      hukukiYapiId:
        formData.hukukiYapiId !== null &&
        formData.hukukiYapiId !== undefined &&
        String(formData.hukukiYapiId) !== ""
          ? parseInt(String(formData.hukukiYapiId), 10)
          : null,
      vekilTuru: parseInt(String(formData.vekilTuru), 10) || 0,
      vekilKisilikTipi:
        formData.vekilKisilikTipi !== null &&
        formData.vekilKisilikTipi !== undefined &&
        String(formData.vekilKisilikTipi) !== ""
          ? parseInt(String(formData.vekilKisilikTipi), 10)
          : null,
      vekilAdi: formData.vekilAdi ? formData.vekilAdi.trim() : null,
      vekilKimlikNo: formData.vekilKimlikNo ? formData.vekilKimlikNo.trim() : null,
      pasaportNo: formData.pasaportNo ? formData.pasaportNo.trim() : null,
      alisIstatistikId:
        formData.alisIstatistikId !== null &&
        formData.alisIstatistikId !== undefined &&
        String(formData.alisIstatistikId) !== ""
          ? parseInt(String(formData.alisIstatistikId), 10)
          : null,
      satisIstatistikId:
        formData.satisIstatistikId !== null &&
        formData.satisIstatistikId !== undefined &&
        String(formData.satisIstatistikId) !== ""
          ? parseInt(String(formData.satisIstatistikId), 10)
          : null,
      arbitrajAlisIstatistikId:
        formData.arbitrajAlisIstatistikId !== null &&
        formData.arbitrajAlisIstatistikId !== undefined &&
        String(formData.arbitrajAlisIstatistikId) !== ""
          ? parseInt(String(formData.arbitrajAlisIstatistikId), 10)
          : null,
      arbitrajSatisIstatistikId:
        formData.arbitrajSatisIstatistikId !== null &&
        formData.arbitrajSatisIstatistikId !== undefined &&
        String(formData.arbitrajSatisIstatistikId) !== ""
          ? parseInt(String(formData.arbitrajSatisIstatistikId), 10)
          : null,
      eposta: formData.eposta ? formData.eposta.trim() : null,
      bankaHesabiId:
        formData.bankaHesabiId !== null &&
        formData.bankaHesabiId !== undefined &&
        String(formData.bankaHesabiId) !== ""
          ? parseInt(String(formData.bankaHesabiId), 10)
          : null,
      anneAdi: formData.anneAdi ? formData.anneAdi.trim() : null,
      kimlikSeriNo: formData.kimlikSeriNo ? formData.kimlikSeriNo.trim() : null,
      dogumTarihi: formData.dogumTarihi || null,
      dogumYeri: formData.dogumYeri ? formData.dogumYeri.trim() : null,
      karaListede: !!formData.karaListede,
      sektorId:
        formData.sektorId !== null &&
        formData.sektorId !== undefined &&
        String(formData.sektorId) !== ""
          ? parseInt(String(formData.sektorId), 10)
          : null,
      meslekId:
        formData.meslekId !== null &&
        formData.meslekId !== undefined &&
        String(formData.meslekId) !== ""
          ? parseInt(String(formData.meslekId), 10)
          : null,
      kimlikGecerlilikTarihi: formData.kimlikGecerlilikTarihi || null,
      faaliyetBelgesiAlindi: !!formData.faaliyetBelgesiAlindi,
      vergiLevhasiAlindi: !!formData.vergiLevhasiAlindi,
      imzaSirkuleriAlindi: !!formData.imzaSirkuleriAlindi,
      imzaSirkuGecerlilikTarihi: formData.imzaSirkuGecerlilikTarihi || null,
      yetkiliKimlikNo: formData.yetkiliKimlikNo ? formData.yetkiliKimlikNo.trim() : null,
      yetkiliKmlkGecerlikTarih: formData.yetkiliKmlkGecerlikTarih || null,
      filtre: formData.filtre ? formData.filtre.trim() : null,
      cariBakiyeSiniri:
        formData.cariBakiyeSiniri !== null &&
        formData.cariBakiyeSiniri !== undefined &&
        String(formData.cariBakiyeSiniri) !== ""
          ? parseFloat(String(formData.cariBakiyeSiniri))
          : null,
      sirketTuru:
        formData.sirketTuru !== null &&
        formData.sirketTuru !== undefined &&
        String(formData.sirketTuru) !== ""
          ? parseInt(String(formData.sirketTuru), 10)
          : null,
      kimlikBelgeTuru:
        formData.kimlikBelgeTuru !== null &&
        formData.kimlikBelgeTuru !== undefined &&
        String(formData.kimlikBelgeTuru) !== ""
          ? parseInt(String(formData.kimlikBelgeTuru), 10)
          : null,
      dernekAmaci: formData.dernekAmaci ? formData.dernekAmaci.trim() : null,
      yetkiliKisiId:
        formData.yetkiliKisiId !== null &&
        formData.yetkiliKisiId !== undefined &&
        String(formData.yetkiliKisiId) !== ""
          ? parseInt(String(formData.yetkiliKisiId), 10)
          : null,
      favoriParaId:
        formData.favoriParaId !== null &&
        formData.favoriParaId !== undefined &&
        String(formData.favoriParaId) !== ""
          ? parseInt(String(formData.favoriParaId), 10)
          : null,
      whatsappAdi: formData.whatsappAdi ? formData.whatsappAdi.trim() : null,
      eFaturaPostaKutusu: formData.eFaturaPostaKutusu ? formData.eFaturaPostaKutusu.trim() : null,
      eIrsaliyePostaKutusu: formData.eIrsaliyePostaKutusu ? formData.eIrsaliyePostaKutusu.trim() : null,
    };

    try {
      setIsSaving(true);
      setAlertError(null);

      if (isNewRecord || !selectedCari) {
        const created = await CariService.createCariKart(payload);
        setAlertSuccess(`✅ "${created.ad}" [${created.kod}] cari kartı başarıyla eklendi.`);
        await loadData(isEditPage ? cariList.length : undefined);
      } else {
        const updated = await CariService.updateCariKart(selectedCari.id, payload);
        setAlertSuccess(`✅ "${updated.ad}" [${updated.kod}] cari kart bilgileri başarıyla güncellendi.`);
        await loadData(selectedIndex);
      }

      setTimeout(() => setAlertSuccess(null), 4500);
    } catch (err: any) {
      const rawMsg = err.message || "İşlem sırasında bir hata oluştu.";
      setAlertError(`❌ Kayıt Başarısız: ${rawMsg}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCari || isNewRecord) return;
    try {
      setIsSaving(true);
      setShowDeleteModal(false);
      await CariService.deleteCariKart(selectedCari.id);
      setAlertSuccess(`✅ "${selectedCari.ad}" [${selectedCari.kod}] cari kartı başarıyla silindi.`);
      await loadData(Math.max(0, selectedIndex - 1));
      setTimeout(() => setAlertSuccess(null), 4000);
    } catch (err: any) {
      setAlertError(`❌ Silme Başarısız: ${err.message || "Cari kart silinirken bir hata oluştu."}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    printReportTable<CariKartItem>({
      title: "Cari Kart Listesi Raporu",
      subtitle: `Aktif Cari Kartlar Dökümü (${cariList.length} Kayıt)`,
      data: cariList,
      columns: [
        { header: "Cari Kodu", key: "kod", width: "12%" },
        { header: "Cari Ünvan / Adı", key: "ad", width: "26%" },
        {
          header: "Kişilik Tipi",
          render: (item) => (item.kisilikTipi === 2 ? "Tüzel Kişi (Şirket)" : "Gerçek Kişi (Şahıs)"),
          width: "14%",
        },
        { header: "VKN / TCKN", key: "vergiKimlikNo", width: "14%" },
        { header: "Telefon", key: "telefon", width: "14%" },
        { header: "E-Posta", key: "eposta", width: "12%" },
        {
          header: "Kara Liste",
          render: (item) => (item.karaListede ? "KARA LİSTEDE" : "Normal"),
          align: "center",
          width: "8%",
        },
      ],
      summaryInfo: `Listelenen Cari Kart Sayısı: ${cariList.length}`,
    });
  };

  return (
    <div className="p-2 p-md-3">
      {/* 1. Sol Üst Klasik ERP Toolbar */}
      <ERPToolbar
        pageTitle={pageTitle}
        pageIcon={<IconUsers size={20} />}
        onNew={handleNewCari}
        onSave={handleSave}
        onSearch={
          isEditPage
            ? () => {
                setShowLookupModal(true);
              }
            : undefined
        }
        onDelete={
          isEditPage && selectedCari && !isNewRecord
            ? () => {
                setShowDeleteModal(true);
              }
            : undefined
        }
        hideSearch={!isEditPage}
        hideDelete={!isEditPage}
        onFirst={() => isEditPage && handleNavigate("first")}
        onPrev={() => isEditPage && handleNavigate("prev")}
        onNext={() => isEditPage && handleNavigate("next")}
        onLast={() => isEditPage && handleNavigate("last")}
        onPrint={handlePrint}
        onRefresh={() => loadData(isEditPage ? selectedIndex : undefined)}
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
            {formData.karaListede && (
              <Badge bg="danger" className="d-flex align-items-center gap-1">
                <IconAlertCircle size={12} /> Kara Listede
              </Badge>
            )}
          </div>

          <div style={{ maxWidth: "850px" }}>
            <Tab.Container activeKey={activeTab} onSelect={(k) => setActiveTab(k || "general")}>
              <Nav variant="pills" className="mb-4 gap-1 bg-light p-1.5 rounded-3 border">
                <Nav.Item>
                  <Nav.Link eventKey="general" className="py-1.5 px-3 small d-flex align-items-center gap-1.5">
                    <IconBuildingStore size={15} /> 1. Temel & Kimlik
                    {(fieldErrors.kod || fieldErrors.ad || fieldErrors.vergiKimlikNo || fieldErrors.cariBakiyeSiniri) && (
                      <span className="badge bg-danger ms-1 p-1">!</span>
                    )}
                  </Nav.Link>
                </Nav.Item>
                <Nav.Item>
                  <Nav.Link eventKey="contact" className="py-1.5 px-3 small d-flex align-items-center gap-1.5">
                    <IconMapPin size={15} /> 2. İletişim & Adres
                    {(fieldErrors.telefon || fieldErrors.eposta) && (
                      <span className="badge bg-danger ms-1 p-1">!</span>
                    )}
                  </Nav.Link>
                </Nav.Item>
                <Nav.Item>
                  <Nav.Link eventKey="personal" className="py-1.5 px-3 small d-flex align-items-center gap-1.5">
                    <IconIdBadge2 size={15} /> 3. Nüfus & Şahıs
                  </Nav.Link>
                </Nav.Item>
                <Nav.Item>
                  <Nav.Link eventKey="corporate" className="py-1.5 px-3 small d-flex align-items-center gap-1.5">
                    <IconFileCertificate size={15} /> 4. E-Dönüşüm & MASAK
                    {fieldErrors.yetkiliKimlikNo && <span className="badge bg-danger ms-1 p-1">!</span>}
                  </Nav.Link>
                </Nav.Item>
                <Nav.Item>
                  <Nav.Link eventKey="settings" className="py-1.5 px-3 small d-flex align-items-center gap-1.5">
                    <IconReceipt2 size={15} /> 5. Fiş & İstatistik
                    {fieldErrors.vekilKimlikNo && <span className="badge bg-danger ms-1 p-1">!</span>}
                  </Nav.Link>
                </Nav.Item>
              </Nav>

              <Form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                <Tab.Content>
                  {/* TAB 1: Temel & Kimlik */}
                  <Tab.Pane eventKey="general">
                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Cari Kodu <span className="text-danger">*</span>
                      </Form.Label>
                      <Col sm={9}>
                        <CodeLookupInput
                          value={formData.kod}
                          maxLength={20}
                          isInvalid={!!fieldErrors.kod}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleInputChange("kod", e.target.value.toUpperCase())}
                          onLookupClick={() => {
                            if (isEditPage) {
                              setShowLookupModal(true);
                            }
                          }}
                          canLookup={isEditPage}
                          required
                          lookupTitle={isEditPage ? "Cari Kart Seç (Oklu Dürbün)" : "Yeni Kayıt Modu"}
                        />
                        {fieldErrors.kod && (
                          <div className="text-danger small mt-1">{fieldErrors.kod}</div>
                        )}
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Cari Ünvan / Ad <span className="text-danger">*</span>
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Control
                          type="text"
                          maxLength={200}
                          value={formData.ad}
                          isInvalid={!!fieldErrors.ad}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleInputChange("ad", e.target.value)}
                          className="fw-bold"
                          required
                        />
                        {fieldErrors.ad && (
                          <div className="text-danger small mt-1">{fieldErrors.ad}</div>
                        )}
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Kişilik Tipi
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Select
                          value={formData.kisilikTipi}
                          onChange={(e) => handleInputChange("kisilikTipi", parseInt(e.target.value, 10))}
                          className="fw-bold text-primary"
                        >
                          {Object.entries(KISILIK_TIPI_OPTIONS).map(([val, label]) => (
                            <option key={val} value={val}>
                              {label}
                            </option>
                          ))}
                        </Form.Select>
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        VKN / TCKN
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Control
                          type="text"
                          maxLength={20}
                          value={formData.vergiKimlikNo || ""}
                          isInvalid={!!fieldErrors.vergiKimlikNo}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleInputChange("vergiKimlikNo", e.target.value)}
                          className="font-monospace"
                        />
                        {fieldErrors.vergiKimlikNo && (
                          <div className="text-danger small mt-1">{fieldErrors.vergiKimlikNo}</div>
                        )}
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Vergi Dairesi
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Select
                          value={formData.vergiDairesiId ?? ""}
                          onChange={(e) => handleInputChange("vergiDairesiId", e.target.value !== "" ? parseInt(e.target.value, 10) : null)}
                        >
                          <option value="">Seçilmedi</option>
                          {lookups.vergiDairesiList.map((vd) => (
                            <option key={vd.id} value={vd.id}>
                              {vd.ad}
                            </option>
                          ))}
                        </Form.Select>
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Yetkili Kişi
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Control
                          type="text"
                          maxLength={200}
                          value={formData.yetkiliKisi || ""}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleInputChange("yetkiliKisi", e.target.value)}
                        />
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Hukuki Yapı
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Select
                          value={formData.hukukiYapiId ?? ""}
                          onChange={(e) => handleInputChange("hukukiYapiId", e.target.value !== "" ? parseInt(e.target.value, 10) : null)}
                        >
                          <option value="">Seçilmedi</option>
                          {lookups.hukukiYapiList.map((hy) => (
                            <option key={hy.id} value={hy.id}>
                              {hy.ad}
                            </option>
                          ))}
                        </Form.Select>
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Cari Bakiye Sınırı
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Control
                          type="number"
                          step="any"
                          value={formData.cariBakiyeSiniri ?? ""}
                          isInvalid={!!fieldErrors.cariBakiyeSiniri}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleInputChange("cariBakiyeSiniri", e.target.value ? parseFloat(e.target.value) : null)}
                        />
                        {fieldErrors.cariBakiyeSiniri && (
                          <div className="text-danger small mt-1">{fieldErrors.cariBakiyeSiniri}</div>
                        )}
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Özel Filtre
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Control
                          type="text"
                          maxLength={200}
                          value={formData.filtre || ""}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleInputChange("filtre", e.target.value)}
                        />
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Kara Liste
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Check
                          type="switch"
                          id="kara-listede-switch"
                          label={<span className="small fw-bold text-danger">⚠️ Kara Listede</span>}
                          checked={formData.karaListede}
                          onChange={(e) => handleInputChange("karaListede", e.target.checked)}
                        />
                      </Col>
                    </Form.Group>
                  </Tab.Pane>

                  {/* TAB 2: İletişim & Adres */}
                  <Tab.Pane eventKey="contact">
                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        <IconPhone size={14} className="me-1" /> Telefon
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Control
                          type="text"
                          maxLength={20}
                          value={formData.telefon || ""}
                          isInvalid={!!fieldErrors.telefon}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleInputChange("telefon", e.target.value)}
                        />
                        {fieldErrors.telefon && (
                          <div className="text-danger small mt-1">{fieldErrors.telefon}</div>
                        )}
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        <IconBrandWhatsapp size={14} className="text-success me-1" /> WhatsApp Adı
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Control
                          type="text"
                          maxLength={100}
                          value={formData.whatsappAdi || ""}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleInputChange("whatsappAdi", e.target.value)}
                        />
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        <IconMail size={14} className="me-1" /> E-Posta
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Control
                          type="email"
                          maxLength={100}
                          value={formData.eposta || ""}
                          isInvalid={!!fieldErrors.eposta}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleInputChange("eposta", e.target.value)}
                        />
                        {fieldErrors.eposta && (
                          <div className="text-danger small mt-1">{fieldErrors.eposta}</div>
                        )}
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Açık Adres
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Control
                          as="textarea"
                          rows={2}
                          maxLength={100}
                          value={formData.adres || ""}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleInputChange("adres", e.target.value)}
                        />
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        İl
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Select
                          value={formData.ilId ?? ""}
                          onChange={(e) => handleInputChange("ilId", e.target.value !== "" ? parseInt(e.target.value, 10) : null)}
                        >
                          <option value="">Seçilmedi</option>
                          {lookups.ilList.map((il) => (
                            <option key={il.id} value={il.id}>
                              {il.ad}
                            </option>
                          ))}
                        </Form.Select>
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        İlçe
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Select
                          value={formData.ilceId ?? ""}
                          onChange={(e) => handleInputChange("ilceId", e.target.value !== "" ? parseInt(e.target.value, 10) : null)}
                        >
                          <option value="">Seçilmedi</option>
                          {lookups.ilceList.map((ilc) => (
                            <option key={ilc.id} value={ilc.id}>
                              {ilc.ad}
                            </option>
                          ))}
                        </Form.Select>
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Posta Kodu ID
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Control
                          type="number"
                          value={formData.postaKoduId ?? ""}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleInputChange("postaKoduId", e.target.value ? parseInt(e.target.value, 10) : null)}
                        />
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Ülke
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Select
                          value={formData.ulkeId ?? 218}
                          onChange={(e) => handleInputChange("ulkeId", e.target.value !== "" ? parseInt(e.target.value, 10) : null)}
                        >
                          {lookups.ulkeList.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.ad}
                            </option>
                          ))}
                        </Form.Select>
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Uyruk
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Select
                          value={formData.uyrukId ?? 218}
                          onChange={(e) => handleInputChange("uyrukId", e.target.value !== "" ? parseInt(e.target.value, 10) : null)}
                        >
                          {lookups.ulkeList.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.ad}
                            </option>
                          ))}
                        </Form.Select>
                      </Col>
                    </Form.Group>
                  </Tab.Pane>

                  {/* TAB 3: Nüfus & Şahıs */}
                  <Tab.Pane eventKey="personal">
                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Baba Adı
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Control
                          type="text"
                          maxLength={200}
                          value={formData.babaAdi || ""}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleInputChange("babaAdi", e.target.value)}
                        />
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Anne Adı
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Control
                          type="text"
                          maxLength={200}
                          value={formData.anneAdi || ""}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleInputChange("anneAdi", e.target.value)}
                        />
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Doğum Yeri
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Control
                          type="text"
                          maxLength={100}
                          value={formData.dogumYeri || ""}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleInputChange("dogumYeri", e.target.value)}
                        />
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Doğum Tarihi
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Control
                          type="date"
                          value={formData.dogumTarihi || ""}
                          onChange={(e) => handleInputChange("dogumTarihi", e.target.value)}
                        />
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Kimlik Seri No
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Control
                          type="text"
                          maxLength={20}
                          value={formData.kimlikSeriNo || ""}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleInputChange("kimlikSeriNo", e.target.value)}
                        />
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Pasaport No
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Control
                          type="text"
                          maxLength={20}
                          value={formData.pasaportNo || ""}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleInputChange("pasaportNo", e.target.value)}
                        />
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Meslek
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Select
                          value={formData.meslekId ?? ""}
                          onChange={(e) => handleInputChange("meslekId", e.target.value !== "" ? parseInt(e.target.value, 10) : null)}
                        >
                          <option value="">Seçilmedi</option>
                          {lookups.meslekList.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.ad}
                            </option>
                          ))}
                        </Form.Select>
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Sektör
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Select
                          value={formData.sektorId ?? ""}
                          onChange={(e) => handleInputChange("sektorId", e.target.value !== "" ? parseInt(e.target.value, 10) : null)}
                        >
                          <option value="">Seçilmedi</option>
                          {lookups.sektorList.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.ad}
                            </option>
                          ))}
                        </Form.Select>
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Kimlik Geçerlilik Tarihi
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Control
                          type="date"
                          value={formData.kimlikGecerlilikTarihi || ""}
                          onChange={(e) => handleInputChange("kimlikGecerlilikTarihi", e.target.value)}
                        />
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Kimlik Belge Türü
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Control
                          type="number"
                          value={formData.kimlikBelgeTuru ?? ""}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleInputChange("kimlikBelgeTuru", e.target.value ? parseInt(e.target.value, 10) : null)}
                        />
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Dernek / Vakıf Amacı
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Control
                          type="text"
                          maxLength={200}
                          value={formData.dernekAmaci || ""}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleInputChange("dernekAmaci", e.target.value)}
                        />
                      </Col>
                    </Form.Group>
                  </Tab.Pane>

                  {/* TAB 4: E-Dönüşüm & MASAK */}
                  <Tab.Pane eventKey="corporate">
                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        E-Fatura Posta Kutusu
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Control
                          type="text"
                          maxLength={200}
                          value={formData.eFaturaPostaKutusu || ""}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleInputChange("eFaturaPostaKutusu", e.target.value)}
                          className="font-monospace"
                        />
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        E-İrsaliye Posta Kutusu
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Control
                          type="text"
                          maxLength={200}
                          value={formData.eIrsaliyePostaKutusu || ""}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleInputChange("eIrsaliyePostaKutusu", e.target.value)}
                          className="font-monospace"
                        />
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Şirket Türü
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Control
                          type="number"
                          value={formData.sirketTuru ?? ""}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleInputChange("sirketTuru", e.target.value ? parseInt(e.target.value, 10) : null)}
                        />
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Yetkili Kimlik No
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Control
                          type="text"
                          maxLength={20}
                          value={formData.yetkiliKimlikNo || ""}
                          isInvalid={!!fieldErrors.yetkiliKimlikNo}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleInputChange("yetkiliKimlikNo", e.target.value)}
                          className="font-monospace"
                        />
                        {fieldErrors.yetkiliKimlikNo && (
                          <div className="text-danger small mt-1">{fieldErrors.yetkiliKimlikNo}</div>
                        )}
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Yetkili Kimlik Geçerlilik
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Control
                          type="date"
                          value={formData.yetkiliKmlkGecerlikTarih || ""}
                          onChange={(e) => handleInputChange("yetkiliKmlkGecerlikTarih", e.target.value)}
                        />
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Faaliyet Belgesi
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Check
                          type="switch"
                          id="faaliyet-belgesi-switch"
                          label="Faaliyet Belgesi Alındı"
                          checked={formData.faaliyetBelgesiAlindi}
                          onChange={(e) => handleInputChange("faaliyetBelgesiAlindi", e.target.checked)}
                        />
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Vergi Levhası
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Check
                          type="switch"
                          id="vergi-levhasi-switch"
                          label="Vergi Levhası Alındı"
                          checked={formData.vergiLevhasiAlindi}
                          onChange={(e) => handleInputChange("vergiLevhasiAlindi", e.target.checked)}
                        />
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        İmza Sirküleri
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Check
                          type="switch"
                          id="imza-sirkuleri-switch"
                          label="İmza Sirküleri Alındı"
                          checked={formData.imzaSirkuleriAlindi}
                          onChange={(e) => handleInputChange("imzaSirkuleriAlindi", e.target.checked)}
                        />
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        İmza Sirküleri Geçerlilik
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Control
                          type="date"
                          value={formData.imzaSirkuGecerlilikTarihi || ""}
                          onChange={(e) => handleInputChange("imzaSirkuGecerlilikTarihi", e.target.value)}
                        />
                      </Col>
                    </Form.Group>
                  </Tab.Pane>

                  {/* TAB 5: Fiş & İstatistik & Vekil Eşleştirmeleri */}
                  <Tab.Pane eventKey="settings">
                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Varsayılan Alış İstatistiği
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Select
                          value={formData.alisIstatistikId ?? ""}
                          onChange={(e) => handleInputChange("alisIstatistikId", e.target.value !== "" ? parseInt(e.target.value, 10) : null)}
                        >
                          <option value="">Seçilmedi</option>
                          {lookups.istatistikList.map((ist) => (
                            <option key={ist.id} value={ist.id}>
                              [{ist.kod}] {ist.ad}
                            </option>
                          ))}
                        </Form.Select>
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Varsayılan Satış İstatistiği
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Select
                          value={formData.satisIstatistikId ?? ""}
                          onChange={(e) => handleInputChange("satisIstatistikId", e.target.value !== "" ? parseInt(e.target.value, 10) : null)}
                        >
                          <option value="">Seçilmedi</option>
                          {lookups.istatistikList.map((ist) => (
                            <option key={ist.id} value={ist.id}>
                              [{ist.kod}] {ist.ad}
                            </option>
                          ))}
                        </Form.Select>
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Arbitraj Alış İstatistiği
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Select
                          value={formData.arbitrajAlisIstatistikId ?? ""}
                          onChange={(e) => handleInputChange("arbitrajAlisIstatistikId", e.target.value !== "" ? parseInt(e.target.value, 10) : null)}
                        >
                          <option value="">Seçilmedi</option>
                          {lookups.istatistikList.map((ist) => (
                            <option key={ist.id} value={ist.id}>
                              [{ist.kod}] {ist.ad}
                            </option>
                          ))}
                        </Form.Select>
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Arbitraj Satış İstatistiği
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Select
                          value={formData.arbitrajSatisIstatistikId ?? ""}
                          onChange={(e) => handleInputChange("arbitrajSatisIstatistikId", e.target.value !== "" ? parseInt(e.target.value, 10) : null)}
                        >
                          <option value="">Seçilmedi</option>
                          {lookups.istatistikList.map((ist) => (
                            <option key={ist.id} value={ist.id}>
                              [{ist.kod}] {ist.ad}
                            </option>
                          ))}
                        </Form.Select>
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Favori Para Birimi
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Select
                          value={formData.favoriParaId ?? ""}
                          onChange={(e) => handleInputChange("favoriParaId", e.target.value !== "" ? parseInt(e.target.value, 10) : null)}
                        >
                          <option value="">Seçilmedi</option>
                          {lookups.paraList.map((p) => (
                            <option key={p.id} value={p.id}>
                              [{p.kod}] {p.ad}
                            </option>
                          ))}
                        </Form.Select>
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Bağlı Banka Hesabı Cari ID
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Select
                          value={formData.bankaHesabiId ?? ""}
                          onChange={(e) => handleInputChange("bankaHesabiId", e.target.value !== "" ? parseInt(e.target.value, 10) : null)}
                        >
                          <option value="">Seçilmedi</option>
                          {cariList.slice(0, 50).map((c) => (
                            <option key={c.id} value={c.id}>
                              [{c.kod}] {c.ad}
                            </option>
                          ))}
                        </Form.Select>
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Yetkili Kişi Cari ID
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Select
                          value={formData.yetkiliKisiId ?? ""}
                          onChange={(e) => handleInputChange("yetkiliKisiId", e.target.value !== "" ? parseInt(e.target.value, 10) : null)}
                        >
                          <option value="">Seçilmedi</option>
                          {cariList.slice(0, 50).map((c) => (
                            <option key={c.id} value={c.id}>
                              [{c.kod}] {c.ad}
                            </option>
                          ))}
                        </Form.Select>
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Vekil Adı
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Control
                          type="text"
                          maxLength={200}
                          value={formData.vekilAdi || ""}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleInputChange("vekilAdi", e.target.value)}
                        />
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Vekil Kimlik No
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Control
                          type="text"
                          maxLength={20}
                          value={formData.vekilKimlikNo || ""}
                          isInvalid={!!fieldErrors.vekilKimlikNo}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleInputChange("vekilKimlikNo", e.target.value)}
                          className="font-monospace"
                        />
                        {fieldErrors.vekilKimlikNo && (
                          <div className="text-danger small mt-1">{fieldErrors.vekilKimlikNo}</div>
                        )}
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Vekil Türü
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Control
                          type="number"
                          value={formData.vekilTuru ?? 0}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleInputChange("vekilTuru", e.target.value ? parseInt(e.target.value, 10) : 0)}
                        />
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-3 align-items-center">
                      <Form.Label column sm={3} className="small fw-semibold text-secondary text-sm-end">
                        Vekil Kişilik Tipi
                      </Form.Label>
                      <Col sm={9}>
                        <Form.Control
                          type="number"
                          value={formData.vekilKisilikTipi ?? ""}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleInputChange("vekilKisilikTipi", e.target.value ? parseInt(e.target.value, 10) : null)}
                        />
                      </Col>
                    </Form.Group>
                  </Tab.Pane>
                </Tab.Content>
              </Form>
            </Tab.Container>
          </div>
        </Card.Body>
      </Card>

      {/* Oklu Dürbün - Arama & Seçim Modalı */}
      <LookupModal<CariKartItem>
        show={showLookupModal}
        onHide={() => setShowLookupModal(false)}
        title="Cari Kart Seç"
        items={cariList}
        searchPlaceholder="Cari kodu, adı veya VKN ile ara..."
        filterFn={(item, term) =>
          item.kod.toLowerCase().includes(term.toLowerCase()) ||
          item.ad.toLowerCase().includes(term.toLowerCase()) ||
          (item.vergiKimlikNo ? item.vergiKimlikNo.toLowerCase().includes(term.toLowerCase()) : false)
        }
        columns={[
          {
            header: "Cari Kodu",
            render: (item) => <strong className="text-primary font-monospace">{item.kod}</strong>,
          },
          {
            header: "Cari Ünvanı / Adı",
            render: (item) => item.ad,
          },
          {
            header: "Kişilik Tipi",
            render: (item) => (
              <Badge bg="light" className="text-dark border">
                {item.kisilikTipi === 2 ? "Tüzel Kişi" : "Gerçek Kişi"}
              </Badge>
            ),
          },
          {
            header: "VKN / TCKN",
            render: (item) => item.vergiKimlikNo || "-",
          },
          {
            header: "Telefon",
            render: (item) => item.telefon || "-",
          },
        ]}
        onSelect={(item) => {
          handleSelectCari(item);
        }}
      />

      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="fs-5 text-danger d-flex align-items-center gap-2">
            <IconTrash size={20} /> Cari Kart Silme Onayı
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-2">
            <strong>[{selectedCari?.kod}] {selectedCari?.ad}</strong> cari kartını veritabanından kalıcı olarak silmek istediğinize emin misiniz?
          </p>
          <p className="small text-danger mb-0">
            ⚠️ Bu işlem geri alınamaz. İlgili cariye ait hareketler varsa silme işlemi engellenebilir.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" size="sm" onClick={() => setShowDeleteModal(false)}>
            İptal
          </Button>
          <Button variant="danger" size="sm" onClick={handleDelete} disabled={isSaving}>
            {isSaving ? "Siliniyor..." : "Evet, Cari Kartı Sil"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default CariCardRegistrationPage;
