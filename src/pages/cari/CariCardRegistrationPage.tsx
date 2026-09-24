import React, { useState, useEffect, useMemo } from "react";
import { useLocation, useSearchParams, useNavigate } from "react-router-dom";
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
  InputGroup,
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
  IconDownload,
} from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import CodeLookupInput from "../../components/common/CodeLookupInput";
import useERPAutoFocus from "../../hooks/useERPAutoFocus";
import { GibKullanici, gibAliasToEposta, gibKullanicilariTekillestir } from "../../utils/gibKullanici";
import LookupModal from "../../components/common/LookupModal";
import { printReportTable } from "../../utils/printReport";
import {
  CariService,
  CariKartItem,
  CariKartFormData,
  CariLookups,
} from "../../services/cariService";
import { ebelgeService } from "../../services/ebelgeService";
import { KnskCariAlani } from "../ebelge/EBelgeKnsk";
import { Country, State, City } from "country-state-city";
import CountryStateCitySelect, { GeoLocationValue } from "../../components/common/CountryStateCitySelect";

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

const labelColStyle: React.CSSProperties = {
  width: "135px",
  flex: "0 0 135px",
  maxWidth: "135px",
};

const labelColStylePersonal: React.CSSProperties = {
  width: "155px",
  flex: "0 0 155px",
  maxWidth: "155px",
};

const labelColStyleCorporate: React.CSSProperties = {
  width: "160px",
  flex: "0 0 160px",
  maxWidth: "160px",
};

const labelColStyleSettings: React.CSSProperties = {
  width: "175px",
  flex: "0 0 175px",
  maxWidth: "175px",
};

const normalizeTr = (str: string): string => {
  return (str || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/[\s\-_]/g, "")
    .trim();
};

export const CariCardRegistrationPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isEditPage = location.pathname.includes("kart-duzeltme");
  const pageTitleText = isEditPage ? "B- Cari Kart Düzeltme" : "A- Cari Kart Kayıt";

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

  useERPAutoFocus({ dependencies: [isNewRecord, selectedIndex] });
  const [alertSuccess, setAlertSuccess] = useState<string | null>(null);
  const [alertError, setAlertError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [showLookupModal, setShowLookupModal] = useState<boolean>(false);
  const [isGibSorgulaniyor, setIsGibSorgulaniyor] = useState<boolean>(false);
  /** GİB birden fazla posta kutusu döndürdüğünde kullanıcıya seçtirilecek liste. */
  const [gibSecimListesi, setGibSecimListesi] = useState<GibKullanici[]>([]);
  const [postaKoduInput, setPostaKoduInput] = useState<string>("");

  // Dinamik İl & İlçe Eşleme Durumları
  const [selectedStateCode, setSelectedStateCode] = useState<string>("");
  const [selectedProvinceName, setSelectedProvinceName] = useState<string>("");
  const [selectedDistrictName, setSelectedDistrictName] = useState<string>("");

  // Posta Kodu alanı ID değil, doğrudan yazılan posta kodu metnine göre çalışır;
  // seçili kaydın gerçek POSTA_KODU_ID'sine karşılık gelen metni burada senkronlar.
  useEffect(() => {
    if (!formData.postaKoduId) {
      setPostaKoduInput("");
      return;
    }
    const match = lookups.postaKoduList.find((pk) => pk.id === formData.postaKoduId);
    setPostaKoduInput(match ? String(match.kod || match.ad || "") : "");
  }, [formData.postaKoduId, lookups.postaKoduList]);

  // Seçili Ülkenin ISO kodu (TR, US, DE vb. - country-state-city kütüphanesi için)
  const selectedCountryIso = useMemo(() => {
    if (!formData.ulkeId) return "TR";
    const selectedUlke = lookups.ulkeList.find((u) => u.id === formData.ulkeId);
    if (!selectedUlke) return "TR";
    if (selectedUlke.kod && selectedUlke.kod.trim().length === 2) {
      return selectedUlke.kod.trim().toUpperCase();
    }
    const norm = normalizeTr(selectedUlke.ad);
    if (norm.includes("turk") || norm === "tr") return "TR";
    const match = Country.getAllCountries().find(
      (c) => normalizeTr(c.name) === norm
    );
    return match ? match.isoCode : "TR";
  }, [formData.ulkeId, lookups.ulkeList]);

  // Seçili ülkeye ait tüm il / eyalet listesi (country-state-city kütüphanesinden dinamik)
  const availableStates = useMemo(() => {
    return State.getStatesOfCountry(selectedCountryIso);
  }, [selectedCountryIso]);

  // İl ve İlçe adlarını formData veya lookup değiştikçe senkronize et
  useEffect(() => {
    if (!formData.ilId) {
      setSelectedStateCode("");
      setSelectedProvinceName("");
      return;
    }
    const foundIl = lookups.ilList.find((x) => x.id === formData.ilId);
    if (foundIl) {
      const match = availableStates.find((s) => normalizeTr(s.name) === normalizeTr(foundIl.ad));
      if (match) {
        setSelectedStateCode(match.isoCode);
        setSelectedProvinceName(match.name);
      } else {
        setSelectedStateCode(String(foundIl.id).padStart(2, "0"));
        setSelectedProvinceName(foundIl.ad);
      }
    } else {
      const match = availableStates.find((s) => parseInt(s.isoCode, 10) === formData.ilId);
      if (match) {
        setSelectedStateCode(match.isoCode);
        setSelectedProvinceName(match.name);
      }
    }
  }, [formData.ilId, lookups.ilList, availableStates]);

  useEffect(() => {
    if (!formData.ilceId) {
      setSelectedDistrictName("");
      return;
    }
    const foundIlce = lookups.ilceList.find((x) => x.id === formData.ilceId);
    if (foundIlce) {
      setSelectedDistrictName(foundIlce.ad);
    }
  }, [formData.ilceId, lookups.ilceList]);

  // Aktif seçili eyalet / il nesnesi
  const activeStateObj = useMemo(() => {
    if (!selectedProvinceName) return null;
    return (
      availableStates.find(
        (s) =>
          normalizeTr(s.name) === normalizeTr(selectedProvinceName) ||
          s.isoCode === selectedProvinceName
      ) || null
    );
  }, [selectedProvinceName, availableStates]);

  // Tüm ülkelerin alfabetik listesi (Türkiye en başta)
  const allCountries = useMemo(() => {
    const all = Country.getAllCountries();
    const tr = all.find((c) => c.isoCode === "TR");
    const others = all.filter((c) => c.isoCode !== "TR").sort((a, b) => a.name.localeCompare(b.name));
    return tr ? [tr, ...others] : all;
  }, []);

  // Seçili Uyruğun ISO Kodu (Ülke ile senkronize başlar, istendiğinde bağımsız değiştirilebilir)
  const selectedUyrukIso = useMemo(() => {
    if (!formData.uyrukId) return selectedCountryIso;
    const selectedUlke = lookups.ulkeList.find((u) => u.id === formData.uyrukId);
    if (!selectedUlke) return selectedCountryIso;
    if (selectedUlke.kod && selectedUlke.kod.trim().length === 2) {
      return selectedUlke.kod.trim().toUpperCase();
    }
    const norm = normalizeTr(selectedUlke.ad);
    if (norm.includes("turk") || norm === "tr") return "TR";
    const match = Country.getAllCountries().find(
      (c) => normalizeTr(c.name) === norm
    );
    return match ? match.isoCode : selectedCountryIso;
  }, [formData.uyrukId, lookups.ulkeList, selectedCountryIso]);

  // country-state-city kütüphanesinden gelen cascading seçim yönetimi
  const handleLocationChange = (loc: GeoLocationValue) => {
    console.log("[CariCardRegistrationPage] handleLocationChange tetiklendi:", loc);

    // 1. Ülke Değişikliği (Ülke değişince otomatik uyruk gelir, il ve ilçe sıfırlanır)
    if (loc.countryCode !== selectedCountryIso) {
      const match = lookups.ulkeList.find((u) => {
        if (u.kod && u.kod.trim().toUpperCase() === loc.countryCode) return true;
        const n1 = normalizeTr(u.ad);
        const n2 = normalizeTr(loc.countryName);
        return n1 === n2 || (loc.countryCode === "TR" && n1.includes("turk"));
      });
      const resolvedUlkeId = match ? match.id : (loc.countryCode === "TR" ? 218 : null);
      handleInputChange("ulkeId", resolvedUlkeId);
      // Ülke seçilince otomatik uyruk gelecek
      handleInputChange("uyrukId", resolvedUlkeId);
      setSelectedStateCode("");
      setSelectedProvinceName("");
      setSelectedDistrictName("");
      handleInputChange("ilId", null);
      handleInputChange("ilceId", null);
      return;
    }

    // 2. İl Değişikliği (İl değişince ilçe sıfırlanır)
    if (loc.stateCode !== selectedStateCode || loc.stateName !== selectedProvinceName) {
      setSelectedStateCode(loc.stateCode);
      setSelectedProvinceName(loc.stateName);
      setSelectedDistrictName("");
      handleInputChange("ilceId", null);

      if (!loc.stateCode && !loc.stateName) {
        handleInputChange("ilId", null);
      } else {
        const matchIl = lookups.ilList.find(
          (il) =>
            normalizeTr(il.ad) === normalizeTr(loc.stateName) ||
            il.id === parseInt(loc.stateCode, 10)
        );
        if (matchIl) {
          handleInputChange("ilId", matchIl.id);
        } else if (loc.stateCode && !isNaN(parseInt(loc.stateCode, 10))) {
          handleInputChange("ilId", parseInt(loc.stateCode, 10));
        } else {
          handleInputChange("ilId", null);
        }
      }
    }

    // 3. İlçe Değişikliği
    if (loc.cityName !== selectedDistrictName) {
      setSelectedDistrictName(loc.cityName);
      if (!loc.cityName) {
        handleInputChange("ilceId", null);
      } else {
        const matchIlce = lookups.ilceList.find(
          (ilc) => normalizeTr(ilc.ad) === normalizeTr(loc.cityName)
        );
        if (matchIlce) {
          handleInputChange("ilceId", matchIlce.id);
        } else {
          handleInputChange("ilceId", null);
        }
      }
    }
  };

  // Bildirimler belli bir süre sonra kendiliğinden kapanır (sayfada yer kaplamaz, sabit/taşan bildirim)
  useEffect(() => {
    if (!alertSuccess) return;
    const t = setTimeout(() => setAlertSuccess(null), 4500);
    return () => clearTimeout(t);
  }, [alertSuccess]);

  useEffect(() => {
    if (!alertError) return;
    const t = setTimeout(() => setAlertError(null), 6000);
    return () => clearTimeout(t);
  }, [alertError]);

  // Yeni kayıtta Varsayılan Alış/Satış İstatistiği alanlarını FIS_TIPI'ye göre otomatik doldur
  // (FIS_TIPI = 1 => Satış, diğer her şey Alış; TODVZ_BELGE_SABLON'daki aynı kural).
  useEffect(() => {
    if (!isNewRecord) return;
    const list = lookups.istatistikList || [];
    if (list.length === 0) return;
    setFormData((prev) => {
      let next = prev;
      if (next.alisIstatistikId === null) {
        const alis = list.find((i) => Number(i.fisTipi) === 0 || Number(i.fisTipi) === 2);
        if (alis) next = { ...next, alisIstatistikId: alis.id };
      }
      if (next.satisIstatistikId === null) {
        const satis = list.find((i) => Number(i.fisTipi) === 1 || Number(i.fisTipi) === 2);
        if (satis) next = { ...next, satisIstatistikId: satis.id };
      }
      return next;
    });
  }, [lookups.istatistikList, isNewRecord]);

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

  const handleNavigate = (direction: "first" | "prev" | "next" | "last") => {
    if (cariList.length === 0) return;
    let nextIdx = selectedIndex;
    if (direction === "first") nextIdx = 0;
    else if (direction === "prev") nextIdx = Math.max(0, selectedIndex - 1);
    else if (direction === "next") nextIdx = Math.min(cariList.length - 1, selectedIndex + 1);
    else if (direction === "last") nextIdx = cariList.length - 1;

    setSelectedIndex(nextIdx);
    handleSelectCari(cariList[nextIdx], nextIdx);
  };

  const handleClear = () => {
    setSelectedCari(null);
    setIsNewRecord(true);
    setFormData({
      ...initialFormState,
      kod: "",
    });
    setSelectedStateCode("");
    setSelectedProvinceName("");
    setSelectedDistrictName("");
    setFieldErrors({});
    setAlertError(null);
  };

  const handleNewCari = () => {
    // Düzeltme sayfasındayken "Yeni Kayıt" tıklanınca ayrı Cari Kart Kayıt sayfasına geçilir.
    if (isEditPage) {
      navigate("/cari/kart-kayit");
      return;
    }
    handleClear();
  };

  const validateField = (field: string, value: any): string => {
    if (field === "kod") {
      // Boş bırakılırsa SODVZ_CARI_KART_KAYDET prosedürü numaratörden otomatik kod üretir (NULL gider).
      if (value && String(value).trim().length > 20) return "Cari Kodu en fazla 20 karakter olabilir.";
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

  /** Seçilen GİB kaydını forma işler: posta kutuları + (boşsa) unvan ve e-posta. */
  const gibKaydiniUygula = (k: GibKullanici) => {
    const alias = k.Alias || k.Identifier || "";
    const eposta = gibAliasToEposta(alias);
    const unvan = (k.Title || "").trim();
    const doldurulan: string[] = [`posta kutusu: ${alias}`];
    setFormData((prev) => {
      const sonraki = { ...prev, eFaturaPostaKutusu: alias, eIrsaliyePostaKutusu: alias };
      if (unvan && !(prev.ad || "").trim()) { sonraki.ad = unvan; doldurulan.push(`unvan: ${unvan}`); }
      if (eposta && !(prev.eposta || "").trim()) { sonraki.eposta = eposta; doldurulan.push(`e-posta: ${eposta}`); }
      return sonraki;
    });
    setGibSecimListesi([]);
    // GİB e-posta alanı döndürmez; posta kutusu etiketi e-posta biçiminde değilse açıkça "yok" denir.
    const epostaNotu = eposta ? "" : " · GİB kaydında e-posta yok";
    setAlertSuccess(`✅ GİB bilgileri dolduruldu — ${doldurulan.join(" · ")}${epostaNotu}`);
  };

  const handleGibtenGetir = async () => {
    // Alanda boşluk/tire gibi biçimlendirme karakterleri kalmış olsa bile önce rakam dışını temizle.
    const vkn = (formData.vergiKimlikNo || "").replace(/\D/g, "");
    if (vkn.length !== 10 && vkn.length !== 11) {
      setAlertError("GİB'ten posta kutusu getirmek için önce geçerli bir 10 haneli VKN veya 11 haneli TCKN giriniz.");
      return;
    }
    try {
      setIsGibSorgulaniyor(true);
      setAlertError(null);
      const sonuc = await ebelgeService.mukellefSorgula(vkn);
      if (!sonuc.mukellefMi || !sonuc.kullanicilar || sonuc.kullanicilar.length === 0) {
        setAlertError("Bu VKN/TCKN için GİB'de kayıtlı bir e-Fatura posta kutusu bulunamadı (mükellef değil).");
        return;
      }
      const liste = gibKullanicilariTekillestir(sonuc.kullanicilar);
      // Tek kayıt: doğrudan doldur. Birden fazla posta kutusu: kullanıcı seçsin.
      if (liste.length === 1) gibKaydiniUygula(liste[0]);
      else setGibSecimListesi(liste);
    } catch (err: any) {
      setAlertError(`❌ GİB sorgusu başarısız: ${err.message || "Bilinmeyen hata"}`);
    } finally {
      setIsGibSorgulaniyor(false);
    }
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
      ilceAdi: selectedDistrictName || (lookups.ilceList.find((x) => x.id === formData.ilceId)?.ad) || null,
      ilId:
        formData.ilId !== null &&
          formData.ilId !== undefined &&
          String(formData.ilId) !== ""
          ? parseInt(String(formData.ilId), 10)
          : null,
      ilAdi: selectedProvinceName || (lookups.ilList.find((x) => x.id === formData.ilId)?.ad) || null,
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
    <div className="w-100 pb-3">
      {/* 1. Sol Üst Klasik ERP Toolbar */}
      <ERPToolbar
        pageTitle={pageTitleText}
        modeText={
          !isNewRecord ? (
            <span className="d-flex align-items-center gap-1">
              <span>{`Düzenleme: [${formData.kod}] ${formData.ad}`}</span>
              {formData.karaListede && (
                <span className="badge bg-danger ms-1 text-white">Kara Listede</span>
              )}
            </span>
          ) : (
            "Yeni Kayıt Modu"
          )
        }
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
        onFirst={() => handleNavigate("first")}
        onPrev={() => handleNavigate("prev")}
        onNext={() => handleNavigate("next")}
        onLast={() => handleNavigate("last")}
        hideNavigation={!isEditPage}
        hidePrint={!isEditPage}
        onPrint={handlePrint}
        onRefresh={() => loadData(isEditPage ? selectedIndex : undefined)}
        onClear={handleClear}
        disabled={isLoading || isSaving}
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
            {[
              {
                key: "general",
                label: "Temel",
                icon: <IconBuildingStore size={15} />,
                hasError: !!(fieldErrors.kod || fieldErrors.ad || fieldErrors.vergiKimlikNo || fieldErrors.cariBakiyeSiniri),
              },
              {
                key: "contact",
                label: "İletişim",
                icon: <IconMapPin size={15} />,
                hasError: !!(fieldErrors.telefon || fieldErrors.eposta),
              },
              {
                key: "personal",
                label: "Nüfus",
                icon: <IconIdBadge2 size={15} />,
                hasError: false,
              },
              {
                key: "corporate",
                label: "E-MASAK",
                icon: <IconFileCertificate size={15} />,
                hasError: !!fieldErrors.yetkiliKimlikNo,
              },
              {
                key: "settings",
                label: "Fiş",
                icon: <IconReceipt2 size={15} />,
                hasError: !!fieldErrors.vekilKimlikNo,
              },
            ].map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`btn btn-sm btn-link text-decoration-none px-2 py-1 d-flex align-items-center gap-1 flex-nowrap text-nowrap transition-all ${
                    isActive ? "text-primary fw-bold" : "text-secondary fw-semibold"
                  }`}
                  style={{
                    border: "none",
                    borderRadius: 0,
                    borderBottom: isActive ? "2.5px solid var(--bs-primary, #0d6efd)" : "2.5px solid transparent",
                    fontSize: "13px",
                    lineHeight: "1.3",
                    cursor: "pointer",
                    paddingBottom: "3px",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  {tab.hasError && <span className="badge bg-danger p-1" style={{ fontSize: "9px" }}>!</span>}
                </button>
              );
            })}
          </div>
        }
      />

      {/* Bildirimler: sayfa dışı, sağ altta sabit konumlu, yer kaplamaz; çarpıya basınca veya bir süre sonra kapanır */}
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

      {/* 2. Main Container Card (Tam Genişlik, Liste Kaldırıldı, Yatay Inputlar) */}
      <Card className="border shadow-sm rounded-3 mb-4 w-100 bg-white">
        <Card.Body className="p-3 p-md-4">
          <div className="w-100">
            <Tab.Container activeKey={activeTab} onSelect={(k) => setActiveTab(k || "general")}>
              <Form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                <Tab.Content>
                  {/* TAB 1: Temel & Kimlik */}
                  <Tab.Pane eventKey="general">
                    <div style={{ maxWidth: "390px" }}>
                      <Form.Group as={Row} className="mb-2.5 align-items-center gx-2">
                        <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap">
                          Cari Kodu
                        </Form.Label>
                        <Col>
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
                            lookupTitle={isEditPage ? "Cari Kart Seç (Oklu Dürbün)" : "Yeni Kayıt"}
                          />
                          {fieldErrors.kod && (
                            <div className="text-danger small mt-1">{fieldErrors.kod}</div>
                          )}
                        </Col>
                      </Form.Group>

                    <Form.Group as={Row} className="mb-2.5 align-items-center gx-2">
                      <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap">
                        Cari Ünvan / Ad <span className="text-danger">*</span>
                      </Form.Label>
                      <Col>
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

                    <Form.Group as={Row} className="mb-2.5 align-items-center gx-2">
                      <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap">
                        Kişilik Tipi
                      </Form.Label>
                      <Col>
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

                    <Form.Group as={Row} className="mb-2.5 align-items-center gx-2">
                      <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap">
                        VKN / TCKN
                      </Form.Label>
                      <Col>
                        <Form.Control
                          type="text"
                          inputMode="numeric"
                          maxLength={11}
                          value={formData.vergiKimlikNo || ""}
                          isInvalid={!!fieldErrors.vergiKimlikNo}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleInputChange("vergiKimlikNo", e.target.value.replace(/\D/g, "").slice(0, 11))}
                          className="font-monospace text-end"
                        />
                        {fieldErrors.vergiKimlikNo && (
                          <div className="text-danger small mt-1">{fieldErrors.vergiKimlikNo}</div>
                        )}
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-2.5 align-items-center gx-2">
                      <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap">
                        Vergi Dairesi
                      </Form.Label>
                      <Col>
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

                    <Form.Group as={Row} className="mb-2.5 align-items-center gx-2">
                      <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap">
                        Yetkili Kişi
                      </Form.Label>
                      <Col>
                        <Form.Control
                          type="text"
                          maxLength={200}
                          value={formData.yetkiliKisi || ""}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleInputChange("yetkiliKisi", e.target.value)}
                        />
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-2.5 align-items-center gx-2">
                      <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap">
                        Hukuki Yapı
                      </Form.Label>
                      <Col>
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

                    <Form.Group as={Row} className="mb-2.5 align-items-center gx-2">
                      <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap">
                        Cari Bakiye Sınırı
                      </Form.Label>
                      <Col>
                        <Form.Control
                          type="text"
                          inputMode="decimal"
                          value={formData.cariBakiyeSiniri !== null && formData.cariBakiyeSiniri !== undefined ? formData.cariBakiyeSiniri : ""}
                          isInvalid={!!fieldErrors.cariBakiyeSiniri}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const cleaned = e.target.value.replace(/[^0-9.,]/g, "").replace(",", ".");
                            handleInputChange("cariBakiyeSiniri", cleaned === "" ? null : parseFloat(cleaned) || 0);
                          }}
                          className="font-monospace text-end"
                        />
                        {fieldErrors.cariBakiyeSiniri && (
                          <div className="text-danger small mt-1">{fieldErrors.cariBakiyeSiniri}</div>
                        )}
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-2.5 align-items-center gx-2">
                      <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap">
                        Özel Filtre
                      </Form.Label>
                      <Col>
                        <Form.Control
                          type="text"
                          maxLength={200}
                          value={formData.filtre || ""}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleInputChange("filtre", e.target.value)}
                        />
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-2.5 align-items-center gx-2">
                      <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap">
                        Kara Liste
                      </Form.Label>
                      <Col>
                        <Form.Check
                          type="switch"
                          id="kara-listede-switch"
                          label={<span className="small fw-bold text-danger">⚠️ Kara Listede</span>}
                          checked={formData.karaListede}
                          onChange={(e) => handleInputChange("karaListede", e.target.checked)}
                        />
                      </Col>
                    </Form.Group>

                    {/* KNSK (kamu nüfuzuna sahip kişi): e-Belge'nin kendi tablosunda, VKN/TCKN'ye bağlı tutulur — docs/ebelge-revizyon.md K9 */}
                    <Form.Group as={Row} className="mb-2.5 align-items-center gx-2">
                      <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap">
                        KNSK
                      </Form.Label>
                      <Col>
                        <KnskCariAlani vknTckn={formData.vergiKimlikNo || ""} ad={formData.ad} />
                      </Col>
                    </Form.Group>
                    </div>
                  </Tab.Pane>

                  {/* TAB 2: İletişim & Adres */}
                  <Tab.Pane eventKey="contact">
                    <div style={{ maxWidth: "390px" }}>
                    {/* Cascading Ülke -> İl -> İlçe Seçimi (country-state-city kütüphanesi) & Otomatik Uyruk */}
                    <CountryStateCitySelect
                      countryCode={selectedCountryIso}
                      stateCode={selectedStateCode || (activeStateObj ? activeStateObj.isoCode : selectedProvinceName)}
                      cityName={selectedDistrictName}
                      labelColStyle={labelColStyle}
                      onLocationChange={handleLocationChange}
                      renderAfterCountry={
                        <Form.Group as={Row} className="mb-2.5 align-items-center gx-2">
                          <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap">
                            Uyruk
                          </Form.Label>
                          <Col>
                            <Form.Select
                              value={selectedUyrukIso}
                              onChange={(e) => {
                                const chosenIso = e.target.value;
                                const chosenCountry = Country.getCountryByCode(chosenIso);
                                const match = lookups.ulkeList.find((u) => {
                                  if (u.kod && u.kod.trim().toUpperCase() === chosenIso) return true;
                                  const n1 = normalizeTr(u.ad);
                                  const n2 = normalizeTr(chosenCountry?.name || "");
                                  return n1 === n2 || (chosenIso === "TR" && n1.includes("turk"));
                                });
                                handleInputChange("uyrukId", match ? match.id : (chosenIso === "TR" ? 218 : null));
                              }}
                            >
                              <option value="">Uyruk Seçiniz</option>
                              {allCountries.map((c) => (
                                <option key={c.isoCode} value={c.isoCode}>
                                  {c.flag} {c.name} ({c.isoCode})
                                </option>
                              ))}
                            </Form.Select>
                          </Col>
                        </Form.Group>
                      }
                    />

                    {/* 5. Posta Kodu */}
                    <Form.Group as={Row} className="mb-2.5 align-items-center gx-2">
                      <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap">
                        Posta Kodu
                      </Form.Label>
                      <Col>
                        <Form.Control
                          type="text"
                          inputMode="numeric"
                          maxLength={10}
                          list="posta-kodu-onerileri"
                          value={postaKoduInput}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const typed = e.target.value.replace(/\D/g, "").slice(0, 10);
                            setPostaKoduInput(typed);
                            const match = lookups.postaKoduList.find(
                              (pk) => String(pk.kod ?? "").trim() === typed.trim()
                            );
                            handleInputChange("postaKoduId", match ? match.id : null);
                          }}
                          className="font-monospace text-end"
                        />
                        <datalist id="posta-kodu-onerileri">
                          {lookups.postaKoduList.map((pk) => (
                            <option key={pk.id} value={pk.kod ?? ""}>
                              {pk.ad}
                            </option>
                          ))}
                        </datalist>
                      </Col>
                    </Form.Group>

                    {/* 6. Açık Adres */}
                    <Form.Group as={Row} className="mb-2.5 align-items-center gx-2">
                      <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap">
                        Açık Adres
                      </Form.Label>
                      <Col>
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

                    {/* 7. Telefon */}
                    <Form.Group as={Row} className="mb-2.5 align-items-center gx-2">
                      <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap">
                        <IconPhone size={14} className="me-1" /> Telefon
                      </Form.Label>
                      <Col>
                        <Form.Control
                          type="text"
                          inputMode="tel"
                          maxLength={15}
                          value={formData.telefon || ""}
                          isInvalid={!!fieldErrors.telefon}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleInputChange("telefon", e.target.value.replace(/\D/g, "").slice(0, 15))}
                          className="font-monospace text-end"
                        />
                        {fieldErrors.telefon && (
                          <div className="text-danger small mt-1">{fieldErrors.telefon}</div>
                        )}
                      </Col>
                    </Form.Group>

                    {/* 8. WhatsApp Adı */}
                    <Form.Group as={Row} className="mb-2.5 align-items-center gx-2">
                      <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap">
                        <IconBrandWhatsapp size={14} className="text-success me-1" /> WhatsApp Adı
                      </Form.Label>
                      <Col>
                        <Form.Control
                          type="text"
                          maxLength={100}
                          value={formData.whatsappAdi || ""}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleInputChange("whatsappAdi", e.target.value)}
                        />
                      </Col>
                    </Form.Group>

                    {/* 9. E-Posta */}
                    <Form.Group as={Row} className="mb-2.5 align-items-center gx-2">
                      <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap">
                        <IconMail size={14} className="me-1" /> E-Posta
                      </Form.Label>
                      <Col>
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
                    </div>
                  </Tab.Pane>

                  {/* TAB 3: Nüfus & Şahıs */}
                  <Tab.Pane eventKey="personal">
                    <div style={{ maxWidth: "410px" }}>
                    <Form.Group as={Row} className="mb-2.5 align-items-center gx-2">
                      <Form.Label column style={labelColStylePersonal} className="small fw-semibold text-secondary text-start text-nowrap">
                        Baba Adı
                      </Form.Label>
                      <Col>
                        <Form.Control
                          type="text"
                          maxLength={200}
                          value={formData.babaAdi || ""}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleInputChange("babaAdi", e.target.value)}
                        />
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-2.5 align-items-center gx-2">
                      <Form.Label column style={labelColStylePersonal} className="small fw-semibold text-secondary text-start text-nowrap">
                        Anne Adı
                      </Form.Label>
                      <Col>
                        <Form.Control
                          type="text"
                          maxLength={200}
                          value={formData.anneAdi || ""}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleInputChange("anneAdi", e.target.value)}
                        />
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-2.5 align-items-center gx-2">
                      <Form.Label column style={labelColStylePersonal} className="small fw-semibold text-secondary text-start text-nowrap">
                        Doğum Yeri
                      </Form.Label>
                      <Col>
                        <Form.Control
                          type="text"
                          maxLength={100}
                          value={formData.dogumYeri || ""}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleInputChange("dogumYeri", e.target.value)}
                        />
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-2.5 align-items-center gx-2">
                      <Form.Label column style={labelColStylePersonal} className="small fw-semibold text-secondary text-start text-nowrap">
                        Doğum Tarihi
                      </Form.Label>
                      <Col>
                        <Form.Control
                          type="date"
                          value={formData.dogumTarihi || ""}
                          onChange={(e) => handleInputChange("dogumTarihi", e.target.value)}
                        />
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-2.5 align-items-center gx-2">
                      <Form.Label column style={labelColStylePersonal} className="small fw-semibold text-secondary text-start text-nowrap">
                        Kimlik Seri No
                      </Form.Label>
                      <Col>
                        <Form.Control
                          type="text"
                          maxLength={20}
                          value={formData.kimlikSeriNo || ""}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleInputChange("kimlikSeriNo", e.target.value)}
                          className="font-monospace"
                        />
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-2.5 align-items-center gx-2">
                      <Form.Label column style={labelColStylePersonal} className="small fw-semibold text-secondary text-start text-nowrap">
                        Pasaport No
                      </Form.Label>
                      <Col>
                        <Form.Control
                          type="text"
                          maxLength={20}
                          value={formData.pasaportNo || ""}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleInputChange("pasaportNo", e.target.value)}
                          className="font-monospace"
                        />
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-2.5 align-items-center gx-2">
                      <Form.Label column style={labelColStylePersonal} className="small fw-semibold text-secondary text-start text-nowrap">
                        Meslek
                      </Form.Label>
                      <Col>
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

                    <Form.Group as={Row} className="mb-2.5 align-items-center gx-2">
                      <Form.Label column style={labelColStylePersonal} className="small fw-semibold text-secondary text-start text-nowrap">
                        Sektör
                      </Form.Label>
                      <Col>
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

                    <Form.Group as={Row} className="mb-2.5 align-items-center gx-2">
                      <Form.Label column style={labelColStylePersonal} className="small fw-semibold text-secondary text-start text-nowrap">
                        Kimlik Geçerlilik Tarihi
                      </Form.Label>
                      <Col>
                        <Form.Control
                          type="date"
                          value={formData.kimlikGecerlilikTarihi || ""}
                          onChange={(e) => handleInputChange("kimlikGecerlilikTarihi", e.target.value)}
                        />
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-2.5 align-items-center gx-2">
                      <Form.Label column style={labelColStylePersonal} className="small fw-semibold text-secondary text-start text-nowrap">
                        Kimlik Belge Türü
                      </Form.Label>
                      <Col>
                        <Form.Select
                          value={formData.kimlikBelgeTuru ?? ""}
                          onChange={(e) => handleInputChange("kimlikBelgeTuru", e.target.value !== "" ? parseInt(e.target.value, 10) : null)}
                        >
                          <option value="">Seçilmedi</option>
                          <option value={0}>T.C. Kimlik</option>
                          <option value={1}>Pasaport</option>
                          <option value={2}>Ehliyet</option>
                        </Form.Select>
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-2.5 align-items-center gx-2">
                      <Form.Label column style={labelColStylePersonal} className="small fw-semibold text-secondary text-start text-nowrap">
                        Dernek / Vakıf Amacı
                      </Form.Label>
                      <Col>
                        <Form.Control
                          type="text"
                          maxLength={200}
                          value={formData.dernekAmaci || ""}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleInputChange("dernekAmaci", e.target.value)}
                        />
                      </Col>
                    </Form.Group>
                    </div>
                  </Tab.Pane>

                  {/* TAB 4: E-Dönüşüm & MASAK */}
                  <Tab.Pane eventKey="corporate">
                    <div style={{ maxWidth: "420px" }}>
                    <Form.Group as={Row} className="mb-2.5 align-items-center gx-2">
                      <Form.Label column style={labelColStyleCorporate} className="small fw-semibold text-secondary text-start text-nowrap">
                        E-Fatura Posta Kutusu
                      </Form.Label>
                      <Col>
                        <InputGroup>
                          <Form.Control
                            type="text"
                            maxLength={200}
                            value={formData.eFaturaPostaKutusu || ""}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleInputChange("eFaturaPostaKutusu", e.target.value)}
                            className="font-monospace"
                          />
                          <Button
                            variant="outline-primary"
                            onClick={handleGibtenGetir}
                            disabled={isGibSorgulaniyor}
                            title="VKN/TCKN üzerinden GİB'den e-Fatura posta kutusunu getir"
                          >
                            {isGibSorgulaniyor ? (
                              <Spinner size="sm" animation="border" />
                            ) : (
                              <IconDownload size={16} />
                            )}
                            <span className="ms-1">GİB'ten Getir</span>
                          </Button>
                        </InputGroup>
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-2.5 align-items-center gx-2">
                      <Form.Label column style={labelColStyleCorporate} className="small fw-semibold text-secondary text-start text-nowrap">
                        E-İrsaliye Posta Kutusu
                      </Form.Label>
                      <Col>
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

                    <Form.Group as={Row} className="mb-2.5 align-items-center gx-2">
                      <Form.Label column style={labelColStyleCorporate} className="small fw-semibold text-secondary text-start text-nowrap">
                        Şirket Türü
                      </Form.Label>
                      <Col>
                        <Form.Select
                          value={formData.sirketTuru ?? ""}
                          onChange={(e) => handleInputChange("sirketTuru", e.target.value !== "" ? parseInt(e.target.value, 10) : null)}
                        >
                          <option value="">Seçilmedi</option>
                          <option value={1}>1 - Şahıs</option>
                          <option value={2}>2 - Limited Şirket</option>
                          <option value={3}>3 - Anonim Şirket</option>
                          <option value={4}>4 - Kolektif Şirket</option>
                          <option value={5}>5 - Komandit Şirket</option>
                          <option value={6}>6 - Kooperatif</option>
                          <option value={7}>7 - Diğer</option>
                        </Form.Select>
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-2.5 align-items-center gx-2">
                      <Form.Label column style={labelColStyleCorporate} className="small fw-semibold text-secondary text-start text-nowrap">
                        Yetkili Kimlik No
                      </Form.Label>
                      <Col>
                        <Form.Control
                          type="text"
                          inputMode="numeric"
                          maxLength={11}
                          value={formData.yetkiliKimlikNo || ""}
                          isInvalid={!!fieldErrors.yetkiliKimlikNo}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleInputChange("yetkiliKimlikNo", e.target.value.replace(/\D/g, "").slice(0, 11))}
                          className="font-monospace text-end"
                        />
                        {fieldErrors.yetkiliKimlikNo && (
                          <div className="text-danger small mt-1">{fieldErrors.yetkiliKimlikNo}</div>
                        )}
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-2.5 align-items-center gx-2">
                      <Form.Label column style={labelColStyleCorporate} className="small fw-semibold text-secondary text-start text-nowrap">
                        Yetkili Kimlik Geçerlilik
                      </Form.Label>
                      <Col>
                        <Form.Control
                          type="date"
                          value={formData.yetkiliKmlkGecerlikTarih || ""}
                          onChange={(e) => handleInputChange("yetkiliKmlkGecerlikTarih", e.target.value)}
                        />
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-2.5 align-items-center gx-2">
                      <Form.Label column style={labelColStyleCorporate} className="small fw-semibold text-secondary text-start text-nowrap">
                        Faaliyet Belgesi
                      </Form.Label>
                      <Col>
                        <Form.Check
                          type="switch"
                          id="faaliyet-belgesi-switch"
                          label="Faaliyet Belgesi Alındı"
                          checked={formData.faaliyetBelgesiAlindi}
                          onChange={(e) => handleInputChange("faaliyetBelgesiAlindi", e.target.checked)}
                        />
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-2.5 align-items-center gx-2">
                      <Form.Label column style={labelColStyleCorporate} className="small fw-semibold text-secondary text-start text-nowrap">
                        Vergi Levhası
                      </Form.Label>
                      <Col>
                        <Form.Check
                          type="switch"
                          id="vergi-levhasi-switch"
                          label="Vergi Levhası Alındı"
                          checked={formData.vergiLevhasiAlindi}
                          onChange={(e) => handleInputChange("vergiLevhasiAlindi", e.target.checked)}
                        />
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-2.5 align-items-center gx-2">
                      <Form.Label column style={labelColStyleCorporate} className="small fw-semibold text-secondary text-start text-nowrap">
                        İmza Sirküleri
                      </Form.Label>
                      <Col>
                        <Form.Check
                          type="switch"
                          id="imza-sirkuleri-switch"
                          label="İmza Sirküleri Alındı"
                          checked={formData.imzaSirkuleriAlindi}
                          onChange={(e) => handleInputChange("imzaSirkuleriAlindi", e.target.checked)}
                        />
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-2.5 align-items-center gx-2">
                      <Form.Label column style={labelColStyleCorporate} className="small fw-semibold text-secondary text-start text-nowrap">
                        İmza Sirküleri Geçerlilik
                      </Form.Label>
                      <Col>
                        <Form.Control
                          type="date"
                          value={formData.imzaSirkuGecerlilikTarihi || ""}
                          onChange={(e) => handleInputChange("imzaSirkuGecerlilikTarihi", e.target.value)}
                        />
                      </Col>
                    </Form.Group>
                    </div>
                  </Tab.Pane>

                  {/* TAB 5: Fiş & İstatistik & Vekil Eşleştirmeleri */}
                  <Tab.Pane eventKey="settings">
                    <div style={{ maxWidth: "435px" }}>
                    <Form.Group as={Row} className="mb-2.5 align-items-center gx-2">
                      <Form.Label column style={labelColStyleSettings} className="small fw-semibold text-secondary text-start text-nowrap">
                        Varsayılan Alış İstatistiği
                      </Form.Label>
                      <Col>
                        <Form.Select
                          value={formData.alisIstatistikId ?? ""}
                          onChange={(e) => handleInputChange("alisIstatistikId", e.target.value !== "" ? parseInt(e.target.value, 10) : null)}
                        >
                          <option value="">Seçilmedi</option>
                          {lookups.istatistikList.filter((ist) => Number(ist.fisTipi) === 0 || Number(ist.fisTipi) === 2).map((ist) => (
                            <option key={ist.id} value={ist.id}>
                              [{ist.kod}] {ist.ad}
                            </option>
                          ))}
                        </Form.Select>
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-2.5 align-items-center gx-2">
                      <Form.Label column style={labelColStyleSettings} className="small fw-semibold text-secondary text-start text-nowrap">
                        Varsayılan Satış İstatistiği
                      </Form.Label>
                      <Col>
                        <Form.Select
                          value={formData.satisIstatistikId ?? ""}
                          onChange={(e) => handleInputChange("satisIstatistikId", e.target.value !== "" ? parseInt(e.target.value, 10) : null)}
                        >
                          <option value="">Seçilmedi</option>
                          {lookups.istatistikList.filter((ist) => Number(ist.fisTipi) === 1 || Number(ist.fisTipi) === 2).map((ist) => (
                            <option key={ist.id} value={ist.id}>
                              [{ist.kod}] {ist.ad}
                            </option>
                          ))}
                        </Form.Select>
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-2.5 align-items-center gx-2">
                      <Form.Label column style={labelColStyleSettings} className="small fw-semibold text-secondary text-start text-nowrap">
                        Arbitraj Alış İstatistiği
                      </Form.Label>
                      <Col>
                        <Form.Select
                          value={formData.arbitrajAlisIstatistikId ?? ""}
                          onChange={(e) => handleInputChange("arbitrajAlisIstatistikId", e.target.value !== "" ? parseInt(e.target.value, 10) : null)}
                        >
                          <option value="">Seçilmedi</option>
                          {lookups.istatistikList.filter((ist) => Number(ist.fisTipi) === 0 || Number(ist.fisTipi) === 2).map((ist) => (
                            <option key={ist.id} value={ist.id}>
                              [{ist.kod}] {ist.ad}
                            </option>
                          ))}
                        </Form.Select>
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-2.5 align-items-center gx-2">
                      <Form.Label column style={labelColStyleSettings} className="small fw-semibold text-secondary text-start text-nowrap">
                        Arbitraj Satış İstatistiği
                      </Form.Label>
                      <Col>
                        <Form.Select
                          value={formData.arbitrajSatisIstatistikId ?? ""}
                          onChange={(e) => handleInputChange("arbitrajSatisIstatistikId", e.target.value !== "" ? parseInt(e.target.value, 10) : null)}
                        >
                          <option value="">Seçilmedi</option>
                          {lookups.istatistikList.filter((ist) => Number(ist.fisTipi) === 1 || Number(ist.fisTipi) === 2).map((ist) => (
                            <option key={ist.id} value={ist.id}>
                              [{ist.kod}] {ist.ad}
                            </option>
                          ))}
                        </Form.Select>
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-2.5 align-items-center gx-2">
                      <Form.Label column style={labelColStyleSettings} className="small fw-semibold text-secondary text-start text-nowrap">
                        Favori Para Birimi
                      </Form.Label>
                      <Col>
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

                    <Form.Group as={Row} className="mb-2.5 align-items-center gx-2">
                      <Form.Label column style={labelColStyleSettings} className="small fw-semibold text-secondary text-start text-nowrap">
                        Bağlı Banka Hesabı Cari ID
                      </Form.Label>
                      <Col>
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

                    <Form.Group as={Row} className="mb-2.5 align-items-center gx-2">
                      <Form.Label column style={labelColStyleSettings} className="small fw-semibold text-secondary text-start text-nowrap">
                        Yetkili Kişi Cari ID
                      </Form.Label>
                      <Col>
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

                    <Form.Group as={Row} className="mb-2.5 align-items-center gx-2">
                      <Form.Label column style={labelColStyleSettings} className="small fw-semibold text-secondary text-start text-nowrap">
                        Vekil Adı
                      </Form.Label>
                      <Col>
                        <Form.Control
                          type="text"
                          maxLength={200}
                          value={formData.vekilAdi || ""}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleInputChange("vekilAdi", e.target.value)}
                        />
                      </Col>
                    </Form.Group>

                    <Form.Group as={Row} className="mb-2.5 align-items-center gx-2">
                      <Form.Label column style={labelColStyleSettings} className="small fw-semibold text-secondary text-start text-nowrap">
                        Vekil Kimlik No
                      </Form.Label>
                      <Col>
                        <Form.Control
                          type="text"
                          inputMode="numeric"
                          maxLength={11}
                          value={formData.vekilKimlikNo || ""}
                          isInvalid={!!fieldErrors.vekilKimlikNo}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleInputChange("vekilKimlikNo", e.target.value.replace(/\D/g, "").slice(0, 11))}
                          className="font-monospace text-end"
                        />
                        {fieldErrors.vekilKimlikNo && (
                          <div className="text-danger small mt-1">{fieldErrors.vekilKimlikNo}</div>
                        )}
                      </Col>
                    </Form.Group>
                    </div>
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
      {/* GİB birden fazla posta kutusu döndürdüyse seçim */}
      <Modal show={gibSecimListesi.length > 0} onHide={() => setGibSecimListesi([])} centered>
        <Modal.Header closeButton>
          <Modal.Title className="fs-6 fw-semibold d-flex align-items-center gap-2">
            <IconDownload size={18} /> GİB'de birden fazla posta kutusu bulundu
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-2">
          <div className="small text-secondary mb-2 px-1">Karta işlenecek posta kutusunu seçin; unvan ve e-posta boşsa seçilen kayıttan doldurulur.</div>
          <div className="list-group">
            {gibSecimListesi.map((k, i) => {
              const alias = k.Alias || k.Identifier || "";
              const eposta = gibAliasToEposta(alias);
              return (
                <button type="button" key={`${alias}-${i}`} className="list-group-item list-group-item-action py-2"
                  onClick={() => gibKaydiniUygula(k)}>
                  <div className="font-monospace small">{alias}</div>
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
