import React, { useState, useEffect, useRef } from "react";
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
  IconBinoculars,
  IconX,
  IconRefresh,
} from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import CodeLookupInput from "../../components/common/CodeLookupInput";
import LookupModal from "../../components/common/LookupModal";
import useERPAutoFocus from "../../hooks/useERPAutoFocus";
import { printReportTable } from "../../utils/printReport";
import {
  ProductDefinitionService,
  ProductItem,
  ProductFormData,
} from "../../services/productDefinitionService";
import { onProductChanged } from "../../services/productSyncService";
import { CariService, LookupItem } from "../../services/cariService";
import { KurService, KurRowItem } from "../../services/kurService";

export const getAnlikKurHasValues = (
  item: { id?: number; kod?: string; ad?: string; urunTipi?: number; hasOrani?: number; hasAlisKatsayisi?: number; hasSatisKatsayisi?: number },
  currentKurSatirlar: KurRowItem[] = []
): { alisHas: number | ""; satisHas: number | "" } => {
  const code = (item.kod || "").trim().toUpperCase();
  const name = (item.ad || "").trim().toUpperCase();

  // Döviz / TL ise has katsayısı geçerli değildir
  const isCurrency = item.urunTipi === 0 || ["TL", "TRY", "USD", "EUR", "GBP", "CHF", "SAR", "AUD", "CAD"].includes(code);
  if (isCurrency) {
    return { alisHas: "", satisHas: "" };
  }

  // 1. Eğer ürün kartında daha önce manuel girilmiş veya kaydedilmiş pozitif katsayı varsa onu koru
  const hasSavedAlis = item.hasAlisKatsayisi !== undefined && item.hasAlisKatsayisi !== null && Number(item.hasAlisKatsayisi) > 0;
  const hasSavedSatis = item.hasSatisKatsayisi !== undefined && item.hasSatisKatsayisi !== null && Number(item.hasSatisKatsayisi) > 0;

  let alisVal: number | "" = hasSavedAlis ? Number(item.hasAlisKatsayisi) : "";
  let satisVal: number | "" = hasSavedSatis ? Number(item.hasSatisKatsayisi) : "";

  if (hasSavedAlis && hasSavedSatis) {
    return { alisHas: alisVal, satisHas: satisVal };
  }

  // 2. Anlık Fiyat Listesinden (TUR 0) eşleşen satırı bul
  const kurRow = currentKurSatirlar.find(
    (k) =>
      (item.id && k.paraId === item.id) ||
      (k.kod && code && k.kod.trim().toUpperCase() === code) ||
      (k.ad && name && k.ad.trim().toUpperCase() === name)
  );

  const isGumus = item.urunTipi === 2 || code.includes("GUMUS") || code.includes("GÜMÜŞ") || name.includes("GÜMÜŞ") || name.includes("GUMUS");

  // HAS altın satırını bul
  const hasRow =
    currentKurSatirlar.find((k) => k.kod?.trim().toUpperCase() === "HAS") ||
    currentKurSatirlar.find(
      (k) =>
        k.ad?.trim().toUpperCase() === "HAS ALTIN" ||
        k.ad?.trim().toUpperCase() === "HAS" ||
        k.kod?.trim().toUpperCase().startsWith("HAS")
    ) ||
    currentKurSatirlar.find(
      (k) =>
        k.kod?.trim().toUpperCase().includes("HAS") ||
        k.ad?.trim().toUpperCase().includes("HAS")
    );

  const hasAltinAlis = hasRow
    ? (hasRow.efektifAlis && Number(hasRow.efektifAlis) > 0
        ? Number(hasRow.efektifAlis)
        : (hasRow.dovizAlis && Number(hasRow.dovizAlis) > 0 ? Number(hasRow.dovizAlis) : 0))
    : 0;

  const hasAltinSatis = hasRow
    ? (hasRow.efektifSatis && Number(hasRow.efektifSatis) > 0
        ? Number(hasRow.efektifSatis)
        : (hasRow.dovizSatis && Number(hasRow.dovizSatis) > 0 ? Number(hasRow.dovizSatis) : 0))
    : 0;

  // HAS gümüş satırını bul
  const hasGumusRow =
    currentKurSatirlar.find((k) =>
      ["GUMUS", "GÜMÜŞ", "HAS GÜMÜŞ", "HAS GUMUS"].includes((k.kod || "").toUpperCase().trim()) ||
      (k.ad && ["HAS GÜMÜŞ", "GÜMÜŞ", "GUMUS"].includes(k.ad.toUpperCase().trim()))
    );

  const hasGumusAlis = hasGumusRow
    ? (hasGumusRow.efektifAlis && Number(hasGumusRow.efektifAlis) > 0
        ? Number(hasGumusRow.efektifAlis)
        : (hasGumusRow.dovizAlis && Number(hasGumusRow.dovizAlis) > 0 ? Number(hasGumusRow.dovizAlis) : 0))
    : 0;

  const hasGumusSatis = hasGumusRow
    ? (hasGumusRow.efektifSatis && Number(hasGumusRow.efektifSatis) > 0
        ? Number(hasGumusRow.efektifSatis)
        : (hasGumusRow.dovizSatis && Number(hasGumusRow.dovizSatis) > 0 ? Number(hasGumusRow.dovizSatis) : 0))
    : 0;

  const rowEfektifAlis = kurRow && kurRow.efektifAlis && Number(kurRow.efektifAlis) > 0
    ? Number(kurRow.efektifAlis)
    : (kurRow && kurRow.dovizAlis && Number(kurRow.dovizAlis) > 0 ? Number(kurRow.dovizAlis) : 0);

  const rowEfektifSatis = kurRow && kurRow.efektifSatis && Number(kurRow.efektifSatis) > 0
    ? Number(kurRow.efektifSatis)
    : (kurRow && kurRow.dovizSatis && Number(kurRow.dovizSatis) > 0 ? Number(kurRow.dovizSatis) : 0);

  // Anlık kur tablosunda doğrudan HAS_ALIS_KATSAYISI / HAS_SATIS_KATSAYISI tanımlıysa
  if (!hasSavedAlis && kurRow?.hasAlisKatsayisi && Number(kurRow.hasAlisKatsayisi) > 0) {
    alisVal = Number(kurRow.hasAlisKatsayisi);
  }
  if (!hasSavedSatis && kurRow?.hasSatisKatsayisi && Number(kurRow.hasSatisKatsayisi) > 0) {
    satisVal = Number(kurRow.hasSatisKatsayisi);
  }

  // Efektif Alış / Satış ve HAS (Altın veya Gümüş) fiyatından türetme:
  // Örn Altın: 22 Ayar Alış (5496) / Has Alış (6000) = 0.9160
  // Örn Gümüş: 925 Gümüş Alış (28) / Has Gümüş Alış (30) = 0.9333
  const baseHasAlis = isGumus ? hasGumusAlis : hasAltinAlis;
  const baseHasSatis = isGumus ? hasGumusSatis : hasAltinSatis;

  if (alisVal === "" && rowEfektifAlis > 0 && baseHasAlis > 0) {
    alisVal = parseFloat((rowEfektifAlis / baseHasAlis).toFixed(4));
  }
  if (satisVal === "" && rowEfektifSatis > 0 && baseHasSatis > 0) {
    satisVal = parseFloat((rowEfektifSatis / baseHasSatis).toFixed(4));
  }

  // 3. Bulunamadıysa: HAS oranı veya Anlık Fiyat Listesi standart altın çarpan tablosundan doldur
  if (alisVal === "" || satisVal === "") {
    const rawHasOrani = item.hasOrani !== undefined && item.hasOrani !== null && Number(item.hasOrani) > 0
      ? Number(item.hasOrani)
      : (kurRow?.hasOrani && Number(kurRow.hasOrani) > 0 ? Number(kurRow.hasOrani) : null);

    let baseRatio: number | null = null;
    if (rawHasOrani !== null && rawHasOrani > 0) {
      baseRatio = rawHasOrani > 10 ? rawHasOrani / 1000 : rawHasOrani;
    }

    if (baseRatio === null) {
      const norm = (code + " " + name)
        .replace(/İ/g, "I")
        .replace(/ı/g, "i")
        .replace(/Ç/g, "C")
        .replace(/ç/g, "c")
        .replace(/Ş/g, "S")
        .replace(/ş/g, "s")
        .replace(/Ğ/g, "G")
        .replace(/ğ/g, "g")
        .replace(/Ü/g, "U")
        .replace(/ü/g, "u")
        .replace(/Ö/g, "O")
        .replace(/ö/g, "o");

      if (norm.includes("24") || norm.includes("995") || norm.includes("999") || norm.includes("KULCE") || norm.includes("HAS")) {
        baseRatio = 1.0;
      } else if (norm.includes("22") || norm.includes("916") || norm.includes("BILEZIK") || norm.includes("BURMA") || norm.includes("KORDON")) {
        baseRatio = 0.916;
      } else if (norm.includes("18") || norm.includes("750")) {
        baseRatio = 0.75;
      } else if (norm.includes("14") || norm.includes("585")) {
        baseRatio = 0.585;
      } else if (norm.includes("8") || norm.includes("333")) {
        baseRatio = 0.333;
      } else if (norm.includes("ATA 5") || norm.includes("BESLI") || norm.includes("5LI")) {
        baseRatio = 33.08;
      } else if (norm.includes("ATA 2.5") || norm.includes("IKIBUCUK") || norm.includes("2.5")) {
        baseRatio = norm.includes("GREMSE") ? 16.05 : 16.54;
      } else if (norm.includes("GREMSE")) {
        baseRatio = 16.05;
      } else if (norm.includes("ATA") || norm.includes("CUMHURIYET") || norm.includes("ATA LIRA")) {
        baseRatio = 6.615;
      } else if (norm.includes("CEYREK")) {
        baseRatio = 1.605;
      } else if (norm.includes("YARIM")) {
        baseRatio = 3.21;
      } else if (norm.includes("TAM") || norm.includes("TEKLIK") || norm.includes("LIRA") || norm.includes("ZIYNET")) {
        baseRatio = 6.42;
      } else if (norm.includes("RESAT") || norm.includes("HAMIT") || norm.includes("AZIZ")) {
        baseRatio = 6.615;
      } else if (norm.includes("HURDA")) {
        baseRatio = norm.includes("14") ? 0.585 : norm.includes("18") ? 0.75 : norm.includes("8") ? 0.333 : 0.916;
      } else if (norm.includes("GUMUS") || norm.includes("SILVER") || norm.includes("925")) {
        baseRatio = 0.015;
      }
    }

    if (baseRatio !== null) {
      if (alisVal === "") alisVal = baseRatio;
      if (satisVal === "") satisVal = baseRatio;
    }
  }

  return { alisHas: alisVal, satisHas: satisVal };
};


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

export interface ProductDefinitionsPageProps {
  isModal?: boolean;
  onSuccess?: (createdProduct?: ProductItem) => void;
  onCancel?: () => void;
  initialCode?: string;
}

export const ProductDefinitionsPage: React.FC<ProductDefinitionsPageProps> = ({
  isModal = false,
  onSuccess,
  onCancel,
  initialCode,
}) => {
  // Data states
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [formData, setFormData] = useState<ProductFormData>(() => ({
    ...initialFormState,
    kod: initialCode || "",
  }));
  const [isNewRecord, setIsNewRecord] = useState<boolean>(isModal || false);
  const [activeTab, setActiveTab] = useState<string>("general");

  // UI / Status states
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useERPAutoFocus({ dependencies: [isNewRecord, selectedIndex] });
  const labelColStyle = { width: "165px", flex: "0 0 165px", maxWidth: "165px" };
  const labelColStyleTab1 = { width: "125px", flex: "0 0 125px", maxWidth: "125px" };
  const labelColStyleTab2 = { width: "135px", flex: "0 0 135px", maxWidth: "135px" };
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("all");
  const [alertSuccess, setAlertSuccess] = useState<string | null>(null);
  const [alertError, setAlertError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [showLookupModal, setShowLookupModal] = useState<boolean>(false);
  const [showParaLookupModal, setShowParaLookupModal] = useState<boolean>(false);
  const [paraList, setParaList] = useState<LookupItem[]>([]);
  const [kurSatirlar, setKurSatirlar] = useState<KurRowItem[]>([]);
  const kurSatirlarRef = useRef<KurRowItem[]>([]);

  // Load anlık kur listesi (TUR: 0)
  const loadKurSatirlar = async (): Promise<KurRowItem[]> => {
    try {
      const tablo = await KurService.getKurTablosu({ tur: 0 });
      if (tablo?.satirlar) {
        setKurSatirlar(tablo.satirlar);
        kurSatirlarRef.current = tablo.satirlar;
        return tablo.satirlar;
      }
    } catch (e) {
      console.warn("Anlık kur tablosu çekilemedi:", e);
    }
    return [];
  };

  // Load para list
  const loadParaList = async () => {
    try {
      const lookups = await CariService.getLookups();
      if (lookups?.paraList && lookups.paraList.length > 0) {
        setParaList(lookups.paraList);
      }
    } catch (err) {
      console.error("Para listesi yüklenirken hata:", err);
    }
  };

  // Load all products
  const loadData = async (targetIndex?: number) => {
    try {
      setIsLoading(true);
      setAlertError(null);

      const [list, fetchedKurSatirlar] = await Promise.all([
        ProductDefinitionService.getProducts(),
        loadKurSatirlar(),
      ]);
      setProducts(list || []);

      if (list && list.length > 0 && targetIndex !== undefined) {
        const idx = targetIndex >= 0 && targetIndex < list.length
          ? targetIndex
          : 0;
        setSelectedIndex(idx);
        handleSelectProduct(list[idx], idx, fetchedKurSatirlar);
      } else {
        handleClear(false, list || []);
      }
    } catch (err: any) {
      setAlertError(err.message || "Ürün tanımları yüklenirken bir hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    loadParaList();
  }, []);

  // Canlı senkronizasyon (başka sekme veya pencereden ürün güncellendiğinde liste yenilenir)
  useEffect(() => {
    const unsub = onProductChanged((event) => {
      if (event.type === "all" || event.type === "para") {
        ProductDefinitionService.getProducts().then((list) => {
          if (list) {
            setProducts(list);
          }
        }).catch(() => {});
      }
    });
    return unsub;
  }, []);

  const handleSelectProduct = (item: ProductItem, idx?: number, customKurList?: KurRowItem[]) => {
    setSelectedProduct(item);
    if (idx !== undefined) {
      setSelectedIndex(idx);
    } else {
      const foundIdx = products.findIndex((p) => p.id === item.id);
      if (foundIdx !== -1) setSelectedIndex(foundIdx);
    }
    setIsNewRecord(false);

    const effectiveKurList = customKurList || kurSatirlarRef.current || kurSatirlar;
    const anlikHas = getAnlikKurHasValues(item, effectiveKurList);
    const resolvedAlisHas = (item.hasAlisKatsayisi !== undefined && item.hasAlisKatsayisi !== null && Number(item.hasAlisKatsayisi) > 0)
      ? item.hasAlisKatsayisi
      : (anlikHas.alisHas !== "" ? anlikHas.alisHas : "");
    const resolvedSatisHas = (item.hasSatisKatsayisi !== undefined && item.hasSatisKatsayisi !== null && Number(item.hasSatisKatsayisi) > 0)
      ? item.hasSatisKatsayisi
      : (anlikHas.satisHas !== "" ? anlikHas.satisHas : "");

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
      hasAlisKatsayisi: resolvedAlisHas as any,
      hasSatisKatsayisi: resolvedSatisHas as any,
      birim: item.birim,
      urunTipi: item.urunTipi,
    });
    setAlertError(null);
  };

  const getMaxSiraNo = (currentList: ProductItem[] = products) => {
    const listToUse = currentList && currentList.length > 0 ? currentList : products;
    if (!listToUse || listToUse.length === 0) return 1;
    const maxVal = Math.max(...listToUse.map((p) => p.siraNo || 0));
    return maxVal > 0 ? maxVal + 1 : listToUse.length + 1;
  };

  const handleClear = (showAlert: boolean = true, currentList?: ProductItem[]) => {
    setSelectedProduct(null);
    setIsNewRecord(true);
    const listToUse = currentList && currentList.length > 0 ? currentList : products;
    const nextSiraNo = getMaxSiraNo(listToUse);
    setFormData({
      ...initialFormState,
      kod: "",
      ad: "",
      siraNo: nextSiraNo as any,
    });
    if (showAlert) {
      setAlertSuccess(`Yeni ürün formu hazırlandı. Sıra No otomatik olarak en sona (${nextSiraNo}) atandı.`);
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
    setFormData((prev) => {
      const updated = {
        ...prev,
        [field]: value,
      };

      // Eğer yeni kayıt ise veya Alış/Satış Has henüz manuel girilmediyse, kod veya ad yazıldığında Anlık Fiyat Listesinden otomatik doldur
      if ((field === "kod" || field === "ad" || field === "urunTipi") && (!prev.hasAlisKatsayisi || !prev.hasSatisKatsayisi)) {
        const itemToCheck = {
          kod: field === "kod" ? value : prev.kod,
          ad: field === "ad" ? value : prev.ad,
          urunTipi: field === "urunTipi" ? Number(value) : prev.urunTipi,
          hasOrani: prev.hasOrani,
        };
        const anlikHas = getAnlikKurHasValues(itemToCheck, kurSatirlarRef.current || kurSatirlar);
        if ((!prev.hasAlisKatsayisi || Number(prev.hasAlisKatsayisi) === 0) && anlikHas.alisHas !== "") {
          updated.hasAlisKatsayisi = anlikHas.alisHas as any;
        }
        if ((!prev.hasSatisKatsayisi || Number(prev.hasSatisKatsayisi) === 0) && anlikHas.satisHas !== "") {
          updated.hasSatisKatsayisi = anlikHas.satisHas as any;
        }
      }

      return updated;
    });
  };

  const handlePullFromAnlikKur = () => {
    const anlikHas = getAnlikKurHasValues(
      { kod: formData.kod, ad: formData.ad, urunTipi: formData.urunTipi, hasOrani: formData.hasOrani },
      kurSatirlarRef.current || kurSatirlar
    );
    if (anlikHas.alisHas !== "" || anlikHas.satisHas !== "") {
      setFormData((prev) => ({
        ...prev,
        hasAlisKatsayisi: anlikHas.alisHas !== "" ? anlikHas.alisHas as any : prev.hasAlisKatsayisi,
        hasSatisKatsayisi: anlikHas.satisHas !== "" ? anlikHas.satisHas as any : prev.hasSatisKatsayisi,
      }));
      setAlertSuccess("Anlık Fiyat Listesindeki değerler Alış Has ve Satış Has alanlarına aktarıldı.");
      setTimeout(() => setAlertSuccess(null), 3000);
    } else {
      setAlertError("Anlık Fiyat Listesinde bu ürüne ait has katsayısı bulunamadı.");
      setTimeout(() => setAlertError(null), 3000);
    }
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

    let cleanSiraNo = parseInt(String(formData.siraNo), 10) || 0;
    if (isNewRecord || !selectedProduct) {
      if (cleanSiraNo <= 0) {
        cleanSiraNo = getMaxSiraNo();
      }
    }

    const cleanMuhasebeSiraNo = formData.muhasebeSiraNo !== null && formData.muhasebeSiraNo !== undefined && String(formData.muhasebeSiraNo) !== ""
      ? parseInt(String(formData.muhasebeSiraNo), 10)
      : null;

    const alisHas = parseFloat(String(formData.hasAlisKatsayisi)) || 0;
    const satisHas = parseFloat(String(formData.hasSatisKatsayisi)) || 0;
    const effectiveHasOrani = alisHas > 0 ? alisHas : (satisHas > 0 ? satisHas : (parseFloat(String(formData.hasOrani)) || 0));

    const payload: ProductFormData = {
      ...formData,
      kod: formData.kod.trim(),
      ad: formData.ad.trim(),
      siraNo: cleanSiraNo,
      gramaj: parseFloat(String(formData.gramaj)) || 0,
      hasOrani: effectiveHasOrani,
      iscilik: parseFloat(String(formData.iscilik)) || 0,
      dovizAlisHucreOrani: parseFloat(String(formData.dovizAlisHucreOrani)) || 1,
      dovizSatisHucreOrani: parseFloat(String(formData.dovizSatisHucreOrani)) || 1,
      efektifAlisHucreOrani: parseFloat(String(formData.efektifAlisHucreOrani)) || 1,
      efektifSatisHucreOrani: parseFloat(String(formData.efektifSatisHucreOrani)) || 1,
      hasAlisKatsayisi: alisHas,
      hasSatisKatsayisi: satisHas,
      alimSatimKurFarki: parseFloat(String(formData.alimSatimKurFarki)) || 0,
      muhasebeSiraNo: cleanMuhasebeSiraNo,
    };

    try {
      setIsSaving(true);
      setAlertError(null);

      if (isNewRecord || !selectedProduct) {
        const created = await ProductDefinitionService.createProduct(payload);
        setAlertSuccess(`✅ "${created.ad}" [${created.kod}] veritabanına başarıyla eklendi.`);
        const updatedList = await ProductDefinitionService.getProducts();
        setProducts(updatedList || []);
        const targetIdx = updatedList && updatedList.length > 0 ? updatedList.length - 1 : 0;
        setSelectedIndex(targetIdx);
        if (updatedList && updatedList[targetIdx]) {
          handleSelectProduct(updatedList[targetIdx], targetIdx);
        }
        if (isModal && onSuccess) {
          onSuccess(created);
          return;
        }
        setIsNewRecord(false);
      } else {
        const updated = await ProductDefinitionService.updateProduct(selectedProduct.id, payload);
        setAlertSuccess(`✅ "${updated.ad}" [${updated.kod}] ürün bilgileri başarıyla güncellendi.`);
        if (isModal && onSuccess) {
          onSuccess(updated);
          return;
        }
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
          header: "Alış Has",
          render: (item) => {
            const h = item.hasAlisKatsayisi > 0 ? item.hasAlisKatsayisi : getAnlikKurHasValues(item, kurSatirlarRef.current || kurSatirlar).alisHas;
            return h !== "" && Number(h) > 0 ? Number(h).toFixed(4) : (item.hasOrani ? item.hasOrani.toFixed(4) : "-");
          },
          align: "right",
          width: "12%",
        },
        {
          header: "Satış Has",
          render: (item) => {
            const h = item.hasSatisKatsayisi > 0 ? item.hasSatisKatsayisi : getAnlikKurHasValues(item, kurSatirlarRef.current || kurSatirlar).satisHas;
            return h !== "" && Number(h) > 0 ? Number(h).toFixed(4) : (item.hasOrani ? item.hasOrani.toFixed(4) : "-");
          },
          align: "right",
          width: "12%",
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
    <div className="product-definitions-container w-100 pb-3" style={{ overflowX: "hidden" }}>
      <style>{`
        /* Ürün Tanımları: Alt alta satırlar arasındaki boşlukları minimuma indir ve inputları kompakt yap */
        .product-definitions-container .row {
          --bs-gutter-y: 0px !important;
          margin-top: 0 !important;
          margin-bottom: 0 !important;
        }
        .product-definitions-container .row > * {
          margin-top: 0 !important;
          padding-top: 1px !important;
          padding-bottom: 1px !important;
        }
        .product-definitions-container .form-group,
        .product-definitions-container .mb-2 {
          margin-bottom: 3px !important;
          margin-top: 0 !important;
        }
        .product-definitions-container .form-label,
        .product-definitions-container .col-form-label {
          padding-top: 0 !important;
          padding-bottom: 0 !important;
          margin-bottom: 0 !important;
          font-size: 13px !important;
          line-height: 28px !important;
        }
        .product-definitions-container .form-control,
        .product-definitions-container .form-select,
        .product-definitions-container .input-group-text {
          height: 28px !important;
          min-height: 28px !important;
          padding: 2px 8px !important;
          font-size: 13px !important;
          line-height: 22px !important;
        }
        .product-definitions-container .input-group .btn {
          height: 28px !important;
          padding: 2px 8px !important;
          display: flex !important;
          align-items: center !important;
        }
        .product-definitions-container .input-group .form-control {
          height: 28px !important;
          min-height: 28px !important;
        }
      `}</style>

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
        modeText={isNewRecord ? "Yeni Kayıt Modu" : `Düzenleme: [${formData.kod}] ${formData.ad}`}
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

      {/* 2. Main Container Card (Tam Genişlik, Liste Kaldırıldı, Yatay Inputlar) */}
      <Card className="border-0 shadow-sm rounded-3 mb-4 bg-white">
        <Card.Body className="p-3 p-md-4">
          <div className="w-100">
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
                    <IconReceipt2 size={16} /> Altın / Has
                  </Nav.Link>
                </Nav.Item>
                <Nav.Item>
                  <Nav.Link eventKey="rates" className="py-1.5 px-3 small d-flex align-items-center gap-1.5">
                    <IconCalculator size={16} /> Hücre / Parite
                  </Nav.Link>
                </Nav.Item>
                <Nav.Item>
                  <Nav.Link eventKey="accounting" className="py-1.5 px-3 small d-flex align-items-center gap-1.5">
                    <IconReportMoney size={16} /> Muhasebe Kodları
                  </Nav.Link>
                </Nav.Item>
              </Nav>

              <Form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                <div style={{ maxWidth: "420px" }}>
                  <Tab.Content>
                    {/* Tab 1: General Info */}
                    <Tab.Pane eventKey="general">
                      <Form.Group as={Row} className="mb-2 align-items-center g-2">
                        <Form.Label column style={labelColStyleTab1} className="small fw-semibold text-secondary text-start text-nowrap mb-0">
                          Ürün Kodu <span className="text-danger">*</span>
                        </Form.Label>
                        <Col>
                          <div style={{ maxWidth: "110px" }}>
                            <CodeLookupInput
                              autoFocus
                              value={formData.kod}
                              maxLength={5}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => handleInputChange("kod", e.target.value.toUpperCase())}
                              onLookupClick={() => setShowLookupModal(true)}
                              required
                              lookupTitle="Ürün Tanımı Seç (Oklu Dürbün)"
                            />
                          </div>
                        </Col>
                      </Form.Group>

                      <Form.Group as={Row} className="mb-2 align-items-center g-2">
                        <Form.Label column style={labelColStyleTab1} className="small fw-semibold text-secondary text-start text-nowrap mb-0">
                          Ürün / Para Adı <span className="text-danger">*</span>
                        </Form.Label>
                        <Col>
                          <Form.Control
                            type="text"
                            maxLength={200}
                            value={formData.ad}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleInputChange("ad", e.target.value)}
                            style={{ maxWidth: "200px" }}
                            required
                          />
                        </Col>
                      </Form.Group>

                      <Form.Group as={Row} className="mb-2 align-items-center g-2">
                        <Form.Label column style={labelColStyleTab1} className="small fw-semibold text-secondary text-start text-nowrap mb-0">
                          Sıra No
                        </Form.Label>
                        <Col>
                          <InputGroup style={{ width: "135px" }} className="flex-nowrap">
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
                              className="fw-bold text-end font-monospace"
                              style={{ width: "65px", minWidth: "55px" }}
                            />
                            <Button
                              variant="outline-secondary"
                              className="px-2 d-flex align-items-center justify-content-center"
                              tabIndex={-1}
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
                              className="px-2 d-flex align-items-center justify-content-center"
                              tabIndex={-1}
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

                      <Form.Group as={Row} className="mb-2 align-items-center g-2">
                        <Form.Label column style={labelColStyleTab1} className="small fw-semibold text-secondary text-start text-nowrap mb-0">
                          Ürün Tipi
                        </Form.Label>
                        <Col>
                          <Form.Select
                            value={formData.urunTipi}
                            onChange={(e) => handleInputChange("urunTipi", parseInt(e.target.value, 10))}
                            className="fw-bold text-primary"
                            style={{ maxWidth: "120px" }}
                          >
                            <option value={0}>0 - Döviz</option>
                            <option value={1}>1 - Altın</option>
                            <option value={2}>2 - Gümüş</option>
                            <option value={3}>3 - Ziynet</option>
                          </Form.Select>
                        </Col>
                      </Form.Group>

                      <Form.Group as={Row} className="mb-2 align-items-center g-2">
                        <Form.Label column style={labelColStyleTab1} className="small fw-semibold text-secondary text-start text-nowrap mb-0">
                          Birim
                        </Form.Label>
                        <Col>
                          <Form.Select
                            value={formData.birim ?? 0}
                            onChange={(e) => handleInputChange("birim", parseInt(e.target.value, 10))}
                            style={{ maxWidth: "110px" }}
                          >
                            <option value={0}>0 - Adet</option>
                            <option value={1}>1 - Gram</option>
                          </Form.Select>
                        </Col>
                      </Form.Group>

                      <Form.Group as={Row} className="mb-2 align-items-center g-2">
                        <Form.Label column style={labelColStyleTab1} className="small fw-semibold text-secondary text-start text-nowrap mb-0">
                          Bağlı Para Kodu
                        </Form.Label>
                        <Col>
                          <InputGroup size="sm" className="flex-nowrap" style={{ maxWidth: "110px" }}>
                            <Form.Control
                              type="text"
                              maxLength={10}
                              value={formData.bagliParaKodu || ""}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => handleInputChange("bagliParaKodu", e.target.value.toUpperCase())}
                              className="font-monospace"
                            />
                            <Button
                              variant="outline-primary"
                              tabIndex={-1}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => setShowParaLookupModal(true)}
                              title="Para Birimi Seç (Dürbün)"
                              className="d-flex align-items-center px-2 flex-shrink-0"
                            >
                              <IconBinoculars size={16} />
                            </Button>
                            {formData.bagliParaKodu && (
                              <Button
                                variant="outline-secondary"
                                tabIndex={-1}
                                onClick={() => handleInputChange("bagliParaKodu", "")}
                                title="Temizle"
                                className="px-2 flex-shrink-0"
                              >
                                <IconX size={14} />
                              </Button>
                            )}
                          </InputGroup>
                        </Col>
                      </Form.Group>

                      <Form.Group as={Row} className="mb-2 align-items-center g-2">
                        <Form.Label column style={labelColStyleTab1} className="small fw-semibold text-secondary text-start text-nowrap mb-0">
                          Parite İşlemi
                        </Form.Label>
                        <Col>
                          <Form.Select
                            value={formData.pariteIslemi}
                            onChange={(e) => handleInputChange("pariteIslemi", parseInt(e.target.value, 10))}
                            style={{ maxWidth: "160px" }}
                          >
                            <option value={0}>0 - Çarpma İşlemi (Standart)</option>
                            <option value={1}>1 - Bölme İşlemi (Örn: EUR/USD Parite)</option>
                          </Form.Select>
                        </Col>
                      </Form.Group>

                      <Form.Group as={Row} className="mb-2 align-items-center g-2">
                        <Form.Label column style={labelColStyleTab1} className="small fw-semibold text-secondary text-start text-nowrap mb-0">
                          XML Kodu
                        </Form.Label>
                        <Col>
                          <Form.Control
                            type="text"
                            maxLength={20}
                            value={formData.xmlParaKodu || ""}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleInputChange("xmlParaKodu", e.target.value)}
                            className="font-monospace"
                            style={{ maxWidth: "110px" }}
                          />
                        </Col>
                      </Form.Group>
                    </Tab.Pane>

                    {/* Tab 2: Gold & Has Parameters */}
                    <Tab.Pane eventKey="gold">
                      <Form.Group as={Row} className="mb-2 align-items-center g-2">
                        <Form.Label column style={labelColStyleTab2} className="small fw-semibold text-secondary text-start text-nowrap mb-0">
                          Gramaj
                        </Form.Label>
                        <Col>
                          <Form.Control
                            type="number"
                            step="any"
                            value={formData.gramaj || ""}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleInputChange("gramaj", e.target.value)}
                            className="font-monospace text-end"
                            style={{ maxWidth: "90px" }}
                          />
                        </Col>
                      </Form.Group>

                      <div className="d-flex justify-content-between align-items-center mb-2 pb-1 border-bottom">
                        <span className="small fw-bold text-primary">Has Katsayıları & Milyem</span>
                        <Button
                          variant="outline-primary"
                          size="sm"
                          style={{ fontSize: "11px", padding: "2px 8px" }}
                          onClick={handlePullFromAnlikKur}
                          title="Anlık Fiyat Listesindeki güncel kur veya çarpanlardan Alış/Satış Has değerlerini doldur"
                        >
                          <IconRefresh size={13} className="me-1" />
                          Anlık Fiyat Listesinden Has Değerlerini Getir
                        </Button>
                      </div>

                      <Form.Group as={Row} className="mb-2 align-items-center g-2">
                        <Form.Label column style={labelColStyleTab2} className="small fw-semibold text-secondary text-start text-nowrap mb-0">
                          Alış Has
                        </Form.Label>
                        <Col>
                          <Form.Control
                            type="number"
                            step="any"
                            value={formData.hasAlisKatsayisi || ""}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleInputChange("hasAlisKatsayisi", e.target.value)}
                            className="font-monospace text-end text-dark"
                            style={{ maxWidth: "90px", color: "#000" }}
                            placeholder="0.0000"
                            title="Anlık Fiyat Listesindeki Alış Has katsayısı / milyemi"
                          />
                        </Col>
                      </Form.Group>

                      <Form.Group as={Row} className="mb-2 align-items-center g-2">
                        <Form.Label column style={labelColStyleTab2} className="small fw-semibold text-secondary text-start text-nowrap mb-0">
                          Satış Has
                        </Form.Label>
                        <Col>
                          <Form.Control
                            type="number"
                            step="any"
                            value={formData.hasSatisKatsayisi || ""}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleInputChange("hasSatisKatsayisi", e.target.value)}
                            className="font-monospace text-end text-dark"
                            style={{ maxWidth: "90px", color: "#000" }}
                            placeholder="0.0000"
                            title="Anlık Fiyat Listesindeki Satış Has katsayısı / milyemi"
                          />
                        </Col>
                      </Form.Group>

                      <Form.Group as={Row} className="mb-2 align-items-center g-2">
                        <Form.Label column style={labelColStyleTab2} className="small fw-semibold text-secondary text-start text-nowrap mb-0">
                          İşçilik
                        </Form.Label>
                        <Col>
                          <Form.Control
                            type="number"
                            step="any"
                            value={formData.iscilik || ""}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleInputChange("iscilik", e.target.value)}
                            className="font-monospace text-end"
                            style={{ maxWidth: "90px" }}
                          />
                        </Col>
                      </Form.Group>

                      <Form.Group as={Row} className="mb-2 align-items-center g-2">
                        <Form.Label column style={labelColStyleTab2} className="small fw-semibold text-secondary text-start text-nowrap mb-0">
                          Alım Satım Kur Farkı
                        </Form.Label>
                        <Col>
                          <Form.Control
                            type="number"
                            step="any"
                            value={formData.alimSatimKurFarki || ""}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleInputChange("alimSatimKurFarki", e.target.value)}
                            className="font-monospace text-end"
                            style={{ maxWidth: "90px" }}
                          />
                        </Col>
                      </Form.Group>
                    </Tab.Pane>

                    {/* Tab 3: Rates & Cell Ratios */}
                    <Tab.Pane eventKey="rates">
                      <Form.Group as={Row} className="mb-2 align-items-center g-2">
                        <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap mb-0">
                          Döviz Alış Hücre Oranı
                        </Form.Label>
                        <Col>
                          <Form.Control
                            type="number"
                            step="any"
                            value={formData.dovizAlisHucreOrani || ""}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleInputChange("dovizAlisHucreOrani", e.target.value)}
                            className="font-monospace text-end"
                            style={{ maxWidth: "90px" }}
                          />
                        </Col>
                      </Form.Group>

                      <Form.Group as={Row} className="mb-2 align-items-center g-2">
                        <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap mb-0">
                          Döviz Satış Hücre Oranı
                        </Form.Label>
                        <Col>
                          <Form.Control
                            type="number"
                            step="any"
                            value={formData.dovizSatisHucreOrani || ""}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleInputChange("dovizSatisHucreOrani", e.target.value)}
                            className="font-monospace text-end"
                            style={{ maxWidth: "90px" }}
                          />
                        </Col>
                      </Form.Group>

                      <Form.Group as={Row} className="mb-2 align-items-center g-2">
                        <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap mb-0">
                          Efektif Alış Hücre Oranı
                        </Form.Label>
                        <Col>
                          <Form.Control
                            type="number"
                            step="any"
                            value={formData.efektifAlisHucreOrani || ""}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleInputChange("efektifAlisHucreOrani", e.target.value)}
                            className="font-monospace text-end"
                            style={{ maxWidth: "90px" }}
                          />
                        </Col>
                      </Form.Group>

                      <Form.Group as={Row} className="mb-2 align-items-center g-2">
                        <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap mb-0">
                          Efektif Satış Hücre Oranı
                        </Form.Label>
                        <Col>
                          <Form.Control
                            type="number"
                            step="any"
                            value={formData.efektifSatisHucreOrani || ""}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleInputChange("efektifSatisHucreOrani", e.target.value)}
                            className="font-monospace text-end"
                            style={{ maxWidth: "90px" }}
                          />
                        </Col>
                      </Form.Group>
                    </Tab.Pane>

                    {/* Tab 4: Accounting Codes */}
                    <Tab.Pane eventKey="accounting">
                      <Form.Group as={Row} className="mb-2 align-items-center g-2">
                        <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap mb-0">
                          Efektif Alım Hesabı
                        </Form.Label>
                        <Col>
                          <Form.Control
                            type="text"
                            maxLength={20}
                            value={formData.efektifAlimHesabi || ""}
                            onChange={(e) => handleInputChange("efektifAlimHesabi", e.target.value)}
                            className="font-monospace"
                            style={{ maxWidth: "130px" }}
                          />
                        </Col>
                      </Form.Group>

                      <Form.Group as={Row} className="mb-2 align-items-center g-2">
                        <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap mb-0">
                          Efektif Satım Hesabı
                        </Form.Label>
                        <Col>
                          <Form.Control
                            type="text"
                            maxLength={20}
                            value={formData.efektifSatimHesabi || ""}
                            onChange={(e) => handleInputChange("efektifSatimHesabi", e.target.value)}
                            className="font-monospace"
                            style={{ maxWidth: "130px" }}
                          />
                        </Col>
                      </Form.Group>

                      <Form.Group as={Row} className="mb-2 align-items-center g-2">
                        <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap mb-0">
                          Efektif Depo Hesabı
                        </Form.Label>
                        <Col>
                          <Form.Control
                            type="text"
                            maxLength={20}
                            value={formData.efektifDepoHesabi || ""}
                            onChange={(e) => handleInputChange("efektifDepoHesabi", e.target.value)}
                            className="font-monospace"
                            style={{ maxWidth: "130px" }}
                          />
                        </Col>
                      </Form.Group>

                      <Form.Group as={Row} className="mb-2 align-items-center g-2">
                        <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap mb-0">
                          Efektif Vaziyet Hesabı
                        </Form.Label>
                        <Col>
                          <Form.Control
                            type="text"
                            maxLength={20}
                            value={formData.efektifVaziyetHesabi || ""}
                            onChange={(e) => handleInputChange("efektifVaziyetHesabi", e.target.value)}
                            className="font-monospace"
                            style={{ maxWidth: "130px" }}
                          />
                        </Col>
                      </Form.Group>

                      <Form.Group as={Row} className="mb-2 align-items-center g-2">
                        <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap mb-0">
                          Döviz Alım Hesabı
                        </Form.Label>
                        <Col>
                          <Form.Control
                            type="text"
                            maxLength={20}
                            value={formData.dovizAlimHesabi || ""}
                            onChange={(e) => handleInputChange("dovizAlimHesabi", e.target.value)}
                            className="font-monospace"
                            style={{ maxWidth: "130px" }}
                          />
                        </Col>
                      </Form.Group>

                      <Form.Group as={Row} className="mb-2 align-items-center g-2">
                        <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap mb-0">
                          Döviz Satım Hesabı
                        </Form.Label>
                        <Col>
                          <Form.Control
                            type="text"
                            maxLength={20}
                            value={formData.dovizSatimHesabi || ""}
                            onChange={(e) => handleInputChange("dovizSatimHesabi", e.target.value)}
                            className="font-monospace"
                            style={{ maxWidth: "130px" }}
                          />
                        </Col>
                      </Form.Group>

                      <Form.Group as={Row} className="mb-2 align-items-center g-2">
                        <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap mb-0">
                          Döviz Depo Hesabı
                        </Form.Label>
                        <Col>
                          <Form.Control
                            type="text"
                            maxLength={20}
                            value={formData.dovizDepoHesabi || ""}
                            onChange={(e) => handleInputChange("dovizDepoHesabi", e.target.value)}
                            className="font-monospace"
                            style={{ maxWidth: "130px" }}
                          />
                        </Col>
                      </Form.Group>

                      <Form.Group as={Row} className="mb-2 align-items-center g-2">
                        <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap mb-0">
                          Döviz Vaziyet Hesabı
                        </Form.Label>
                        <Col>
                          <Form.Control
                            type="text"
                            maxLength={20}
                            value={formData.dovizVaziyetHesabi || ""}
                            onChange={(e) => handleInputChange("dovizVaziyetHesabi", e.target.value)}
                            className="font-monospace"
                            style={{ maxWidth: "130px" }}
                          />
                        </Col>
                      </Form.Group>

                      <Form.Group as={Row} className="mb-2 align-items-center g-2">
                        <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap mb-0">
                          Muhasebe Sıra No
                        </Form.Label>
                        <Col>
                          <Form.Control
                            type="number"
                            value={formData.muhasebeSiraNo ?? ""}
                            onChange={(e) => handleInputChange("muhasebeSiraNo", e.target.value ? parseInt(e.target.value, 10) : null)}
                            className="font-monospace text-end"
                            style={{ maxWidth: "80px" }}
                          />
                        </Col>
                      </Form.Group>
                    </Tab.Pane>
                  </Tab.Content>
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
                    : item.urunTipi === 3
                      ? "danger"
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
                      ? "Gümüş"
                      : item.urunTipi === 3
                        ? "Ziynet"
                        : "Diğer"}
              </Badge>
            ),
          },
          {
            header: "Alış Has",
            render: (item) => {
              const h = item.hasAlisKatsayisi > 0 ? item.hasAlisKatsayisi : getAnlikKurHasValues(item, kurSatirlarRef.current || kurSatirlar).alisHas;
              return h !== "" && Number(h) > 0 ? Number(h).toFixed(4) : (item.hasOrani > 0 ? Number(item.hasOrani).toFixed(4) : "-");
            },
            align: "right",
          },
          {
            header: "Satış Has",
            render: (item) => {
              const h = item.hasSatisKatsayisi > 0 ? item.hasSatisKatsayisi : getAnlikKurHasValues(item, kurSatirlarRef.current || kurSatirlar).satisHas;
              return h !== "" && Number(h) > 0 ? Number(h).toFixed(4) : (item.hasOrani > 0 ? Number(item.hasOrani).toFixed(4) : "-");
            },
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

      {/* Bağlı Para Kodu - Para Birimi Seçim Modalı */}
      <LookupModal<LookupItem>
        show={showParaLookupModal}
        onHide={() => setShowParaLookupModal(false)}
        title="Bağlı Para Birimi Seç (Dürbün)"
        items={
          paraList.length > 0
            ? paraList
            : products.map((p) => ({ id: p.id, kod: p.kod, ad: p.ad }))
        }
        searchPlaceholder="Para kodu veya tanımı ile ara..."
        filterFn={(item, term) => {
          const t = term.toLowerCase();
          return (
            (item.kod && item.kod.toLowerCase().includes(t)) ||
            (item.ad && item.ad.toLowerCase().includes(t)) ||
            String(item.id).includes(t)
          );
        }}
        columns={[
          {
            header: "ID",
            render: (item) => <span className="font-monospace fw-semibold">{item.id}</span>,
            width: "80px",
          },
          {
            header: "Para / Döviz Kodu",
            render: (item) => (
              <Badge bg="success" className="font-monospace px-2 py-1">
                {item.kod}
              </Badge>
            ),
            width: "140px",
          },
          {
            header: "Para Tanımı / Açıklama",
            render: (item) => <span className="fw-medium">{item.ad}</span>,
          },
        ]}
        onSelect={(item) => {
          handleInputChange("bagliParaKodu", item.kod);
          setShowParaLookupModal(false);
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
