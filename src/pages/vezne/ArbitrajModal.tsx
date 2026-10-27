import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Modal, Row, Col, Card, Form, Button, Badge, Table, Alert, InputGroup } from "react-bootstrap";
import {
  IconArrowsExchange,
  IconCheck,
  IconX,
  IconBinoculars,
  IconPlus,
  IconTrash,
  IconDeviceFloppy,
  IconSearch,
  IconScale,
  IconUser,
  IconFileText,
  IconPrinter,
} from "@tabler/icons-react";
import { KurRowItem } from "../../services/kurService";
import { CariKartItem, CariService } from "../../services/cariService";
import { StatisticItem, StatisticService } from "../../services/statisticService";
import { TodvzTanimDto } from "../../services/companyService";
import { DovizFisService, DovizFisListItem } from "../../services/dovizFisService";
import LookupModal, { LookupColumn } from "../../components/common/LookupModal";

export interface ArbitrajCurrencyItem {
  id: number;
  kod: string;
  ad: string;
  isMaden?: boolean;
  milyem?: number;
  dovizAlis?: number;
  dovizSatis?: number;
  efektifAlis?: number;
  efektifSatis?: number;
  parite?: number;
}

export interface ArbitrajDetayModel {
  cariTipi?: string;
  yetkiliKisi?: string;
  yetkiliKisiId?: number;
  sirketTuru?: string | number;
  dernekAmaci?: string;
  pasaportNo?: string;
  gecerlilikTarihi?: string;
  dogumTarihi?: string;
  dogumYeri?: string;
  kimlikKaynagi?: string;
  kimlikSeriNo?: string;
  babaAdi?: string;
  anneAdi?: string;
  vergiDairesi?: string;
  vergiDairesiId?: number | null;
  adres?: string;
  eposta?: string;
  telefon?: string;
  vekil?: string;
  vekilTipi?: string;
  vekilAdi?: string;
  vekilKimlikNo?: string;
  meslek?: string;
  meslekId?: number | null;
  ulke?: string;
  uyruk?: string;
  hukukiYapi?: string;
  il?: string;
  ilce?: string;
  postaKodu?: string;
}

export interface ArbitrajApplyResult {
  islemYonu: "alis" | "satis";
  toplamTl?: number;
  girisPara?: ArbitrajCurrencyItem;
  girisMiktar?: number;
  girisKur?: number;
  cikisPara?: ArbitrajCurrencyItem;
  cikisMiktar?: number;
  cikisKur?: number;
  parite?: number;
  pariteYonu?: "carp" | "bol";
  aciklama?: string;
  gelisNedeni?: string;
  cariId: number | null;
  cariUnvan: string;
  cariKodu?: string;
  vknTckn?: string;
  istatistikKodu?: string;
  seriNo?: string;
  belgeNo?: string;
  lines?: any[];
  allLines?: ArbitrajModalLine[];
  detay?: ArbitrajDetayModel;
}

export interface ArbitrajModalLine {
  id: string;
  satirNo: number;
  paraId: number;
  kod: string;
  ad: string;
  miktar: number | string;
  kur: number | string;
  tutar: number | string;
  komisyonOrani?: number | string;
  komisyon?: number | string;
  bmvOrani?: number | string;
  bmv?: number | string;
  kmvOrani?: number | string;
  kmv?: number | string;
  isMaden?: boolean;
  milyem?: number;
}

interface ArbitrajModalProps {
  show: boolean;
  onClose: () => void;
  fisTip?: number; // 0: Alış -> Modal Alış, 1: Satış -> Modal Satış (Birebir eşleşmeli)
  hedefTlTutar?: number; // Ana ekrandaki toplam TL tutarı
  paralar?: ArbitrajCurrencyItem[];
  kurSatirlar?: KurRowItem[];
  urunler?: any[];
  vezneId?: number;
  vezneKod?: string;
  vezneAd?: string;
  selectedCariId?: number | null;
  selectedUnvan?: string;
  selectedCariKod?: string;
  vknTckn?: string;
  istatistikKodu?: string;
  cariList?: CariKartItem[];
  statisticList?: StatisticItem[];
  companyDefinitions?: TodvzTanimDto | null;
  initialDetay?: ArbitrajDetayModel;
  pageType: "doviz" | "sarraf";
  currentUser?: any;
  onApplyToFis?: (result: ArbitrajApplyResult) => void;
  onSaveDirect?: (result: ArbitrajApplyResult, shouldPrint?: boolean) => Promise<boolean | void>;
  onOpenPrintModal?: (result: ArbitrajApplyResult) => void;
  kurKurusSayisi?: number;
  dovizKurusSayisi?: number;
  tlKurusSayisi?: number;
  savedArbitraj?: ArbitrajApplyResult | null;
  initialGelisNedeni?: string;
}

export const ArbitrajModal: React.FC<ArbitrajModalProps> = ({
  show,
  onClose,
  fisTip = 0,
  hedefTlTutar = 0,
  savedArbitraj = null,
  onOpenPrintModal,
  paralar = [],
  kurSatirlar = [],
  urunler = [],
  vezneId = 1,
  vezneKod = "00",
  vezneAd = "Ana Kasa",
  selectedCariId = null,
  selectedUnvan = "İSİM BEYAN EDİLMEMİŞTİR",
  selectedCariKod = "",
  vknTckn = "",
  istatistikKodu = "9249",
  cariList = [],
  statisticList = [],
  companyDefinitions = null,
  initialDetay,
  pageType,
  currentUser = null,
  onApplyToFis,
  onSaveDirect,
  kurKurusSayisi = 4,
  dovizKurusSayisi = 2,
  tlKurusSayisi = 2,
  initialGelisNedeni = "",
}) => {
  // Fişin tersi açılır: Arka alış (fisTip === 0) ise Satış ("satis"), arka satış (fisTip === 1) ise Alış ("alis") gelir
  const targetIslemYonu: "alis" | "satis" = fisTip === 0 ? "satis" : "alis";

  // Form Header State
  const [islemYonu, setIslemYonu] = useState<"alis" | "satis">(targetIslemYonu);
  const [tarih, setTarih] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [saat, setSaat] = useState<string>(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  });
  const [seriNo, setSeriNo] = useState<string>("");
  const [belgeNo, setBelgeNo] = useState<string>("");
  const [gelisNedeni, setGelisNedeni] = useState<string>(
    initialGelisNedeni && initialGelisNedeni.trim().toLowerCase() !== "arbitraj" ? initialGelisNedeni.trim() : ""
  );
  const [cariId, setCariId] = useState<number | null>(selectedCariId);
  const [cariKodu, setCariKodu] = useState<string>(selectedCariKod || "");
  const [unvan, setUnvan] = useState<string>(selectedUnvan || "İSİM BEYAN EDİLMEMİŞTİR");
  const [formVknTckn, setFormVknTckn] = useState<string>(vknTckn || "");
  const [kurTuru, setKurTuru] = useState<number>(0); // 0: Efektif, 1: Döviz
  const [istatistikKod, setIstatistikKod] = useState<string>(istatistikKodu || "9249");

  // F8 Detay Formu State
  const [showDetayModal, setShowDetayModal] = useState<boolean>(false);
  const [detayCariTipi, setDetayCariTipi] = useState<string>(initialDetay?.cariTipi || "Şahıs");
  const [detayYetkiliKisi, setDetayYetkiliKisi] = useState<string>(initialDetay?.yetkiliKisi || "");
  const [detayYetkiliKisiId, setDetayYetkiliKisiId] = useState<number | undefined>(initialDetay?.yetkiliKisiId);
  const [detaySirketTuru, setDetaySirketTuru] = useState<string | number | undefined>(initialDetay?.sirketTuru);
  const [detayDernekAmaci, setDetayDernekAmaci] = useState<string>(initialDetay?.dernekAmaci || "");
  const [detayPasaportNo, setDetayPasaportNo] = useState<string>(initialDetay?.pasaportNo || "");
  const [detayGecerlilikTarihi, setDetayGecerlilikTarihi] = useState<string>(initialDetay?.gecerlilikTarihi || "");
  const [detayDogumTarihi, setDetayDogumTarihi] = useState<string>(initialDetay?.dogumTarihi || "");
  const [detayDogumYeri, setDetayDogumYeri] = useState<string>(initialDetay?.dogumYeri || "");
  const [detayKimlikKaynagi, setDetayKimlikKaynagi] = useState<string>(initialDetay?.kimlikKaynagi || "");
  const [detayKimlikSeriNo, setDetayKimlikSeriNo] = useState<string>(initialDetay?.kimlikSeriNo || "");
  const [detayBabaAdi, setDetayBabaAdi] = useState<string>(initialDetay?.babaAdi || "");
  const [detayAnneAdi, setDetayAnneAdi] = useState<string>(initialDetay?.anneAdi || "");
  const [detayVergiDairesi, setDetayVergiDairesi] = useState<string>(initialDetay?.vergiDairesi || "");
  const [detayVergiDairesiId, setDetayVergiDairesiId] = useState<number | null>(initialDetay?.vergiDairesiId ?? null);
  const [detayAdres, setDetayAdres] = useState<string>(initialDetay?.adres || "");
  const [detayEposta, setDetayEposta] = useState<string>(initialDetay?.eposta || "");
  const [detayTelefon, setDetayTelefon] = useState<string>(initialDetay?.telefon || "");
  const [detayVekil, setDetayVekil] = useState<string>(initialDetay?.vekil || "Yok");
  const [detayVekilTipi, setDetayVekilTipi] = useState<string>(initialDetay?.vekilTipi || "Şahıs");
  const [detayVekilAdi, setDetayVekilAdi] = useState<string>(initialDetay?.vekilAdi || "");
  const [detayVekilKimlikNo, setDetayVekilKimlikNo] = useState<string>(initialDetay?.vekilKimlikNo || "");
  const [detayMeslek, setDetayMeslek] = useState<string>(initialDetay?.meslek || "");
  const [detayMeslekId, setDetayMeslekId] = useState<number | null>(initialDetay?.meslekId ?? null);
  const [detayUlke, setDetayUlke] = useState<string>(initialDetay?.ulke || "TÜRKİYE");
  const [detayUyruk, setDetayUyruk] = useState<string>(initialDetay?.uyruk || "TÜRKİYE");
  const [detayHukukiYapi, setDetayHukukiYapi] = useState<string>(initialDetay?.hukukiYapi || "");
  const [detayIl, setDetayIl] = useState<string>(initialDetay?.il || "");
  const [detayIlce, setDetayIlce] = useState<string>(initialDetay?.ilce || "");
  const [detayPostaKodu, setDetayPostaKodu] = useState<string>(initialDetay?.postaKodu || "");

  // Lookup lists state (cariler, istatistikler)
  const [localCariList, setLocalCariList] = useState<CariKartItem[]>(cariList);
  const [localStatList, setLocalStatList] = useState<StatisticItem[]>(statisticList);

  // Satırlar Grid State
  const [lines, setLines] = useState<ArbitrajModalLine[]>([]);

  // Lookup Overlay States (Cari, İstatistik, Para/Maden)
  const [lookupType, setLookupType] = useState<"cari" | "istatistik" | "currency" | null>(null);
  const [lookupSearchTerm, setLookupSearchTerm] = useState<string>("");
  const [activeLookupLineId, setActiveLookupLineId] = useState<string | null>(null);
  const activeLookupLineIndexRef = useRef<number | null>(null);

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "danger"; text: string } | null>(null);

  // Fiş Tipi Ref ve İstatistik Kodu Ref (Odaklanma Sırası İçin)
  const tipSelectRef = useRef<HTMLSelectElement | null>(null);
  const istatistikInputRef = useRef<HTMLInputElement | null>(null);
  const initialFocusDoneRef = useRef<boolean>(false);

  // Active statistic object
  const activeStat = useMemo(() => {
    const rawKod = (istatistikKod || "").trim().toLowerCase();
    if (!rawKod) return null;
    return localStatList.find((s) => (s.kod && s.kod.toLowerCase() === rawKod) || String(s.id) === rawKod) || null;
  }, [istatistikKod, localStatList]);

  // Fiş yönüne göre filtrelenmiş istatistik listesi (Döviz Fişi kuralı ile birebir):
  // Alış (alis): SADECE 0 (Alış) ve 2 (Alış-Satış)
  // Satış (satis): SADECE 1 (Satış) ve 2 (Alış-Satış)
  // Satışta alış, alışta satış istatistikleri KESİNLİKLE gözükmez!
  const filteredStatList = useMemo(() => {
    return (localStatList || []).filter((s) => {
      const fType = Number(s.fisTipi);
      return islemYonu === "alis" ? fType === 0 || fType === 2 : fType === 1 || fType === 2;
    });
  }, [localStatList, islemYonu]);

  // İstatistik Kodu Yön Validasyonu (Alışta satış, satışta alış engeli)
  const istatistikValidation = useMemo(() => {
    const val = (istatistikKod || "").trim();
    if (!val) {
      return { isValid: false, errorMessage: "İstatistik kodu boş bırakılamaz!" };
    }
    const q = val.toLowerCase();
    const found = (localStatList || []).find(
      (s) => (s.kod && s.kod.toLowerCase() === q) || String(s.id) === q
    );
    if (!found) {
      return { isValid: false, errorMessage: `Tanımsız istatistik kodu: "${val}"!` };
    }
    const fType = Number(found.fisTipi);
    const isAllowed = islemYonu === "alis" ? fType === 0 || fType === 2 : fType === 1 || fType === 2;
    if (!isAllowed) {
      const currentTypeText = islemYonu === "alis" ? "Alış" : "Satış";
      const allowedText = islemYonu === "alis" ? "Alış (0) ve Alış-Satış (2)" : "Satış (1) ve Alış-Satış (2)";
      const foundTypeText = fType === 0 ? "Alış (0)" : fType === 1 ? "Satış (1)" : "Alış-Satış (2)";
      return {
        isValid: false,
        errorMessage: `${currentTypeText} fişinde "${found.kod}" (${foundTypeText}) istatistiği kullanılamaz! Sadece ${allowedText} istatistik kodları girilebilir.`,
      };
    }
    return { isValid: true, errorMessage: null, stat: found };
  }, [istatistikKod, localStatList, islemYonu]);

  // Fiş yönüne göre (Alış ise Alış, Satış ise Satış) varsayılan istatistiği belirler
  const getDefaultIstatistik = useCallback(
    (direction: "alis" | "satis"): StatisticItem | null => {
      const targetTip = direction === "alis" ? 0 : 1;
      if (!localStatList || localStatList.length === 0) return null;

      // 1. Kullanıcı Tanımları (Öncelikli - Tip kontrolü zorunlu)
      const userStatCode = targetTip === 0 ? currentUser?.buyStatCode : currentUser?.sellStatCode;
      if (userStatCode && userStatCode.trim()) {
        const cleanUserCode = userStatCode.trim().toLowerCase();
        const foundUser = localStatList.find(
          (s) => (s.kod && s.kod.toLowerCase() === cleanUserCode) || String(s.id) === cleanUserCode
        );
        if (foundUser) {
          const fType = Number(foundUser.fisTipi);
          if (targetTip === 0 ? fType === 0 || fType === 2 : fType === 1 || fType === 2) {
            return foundUser;
          }
        }
      }

      // 2. Firma Tanımları Kontrolü (Tip kontrolü zorunlu)
      if (companyDefinitions) {
        const companyStatId =
          targetTip === 0
            ? companyDefinitions.ARBITRAJ_ALIS_ISTATISTIK_ID || companyDefinitions.ALIS_ISTATISTIK_ID
            : companyDefinitions.ARBITRAJ_SATIS_ISTATISTIK_ID || companyDefinitions.SATIS_ISTATISTIK_ID;
        if (companyStatId) {
          const cleanComp = String(companyStatId).trim().toLowerCase();
          const foundComp = localStatList.find(
            (s) => String(s.id).trim() === cleanComp || (s.kod && s.kod.trim().toLowerCase() === cleanComp)
          );
          if (foundComp) {
            const fType = Number(foundComp.fisTipi);
            if (targetTip === 0 ? fType === 0 || fType === 2 : fType === 1 || fType === 2) {
              return foundComp;
            }
          }
        }
      }

      // 3. Fiş tipine göre filtrelenmiş listedeki İLK VERİ (Alış: 0 veya 2, Satış: 1 veya 2)
      const matchingList = localStatList.filter((s) => {
        const fType = Number(s.fisTipi);
        return targetTip === 0 ? fType === 0 || fType === 2 : fType === 1 || fType === 2;
      });
      if (matchingList.length > 0) return matchingList[0];

      // 4. Fallback: sabit varsayılan kodlar (Alış→9249, Satış→10285)
      const fallbackKod = targetTip === 0 ? "9249" : "10285";
      const fallbackMatched = localStatList.find((s) => (s.kod || "").trim() === fallbackKod);
      if (fallbackMatched) return fallbackMatched;

      return null;
    },
    [currentUser, companyDefinitions, localStatList]
  );

  // Parse helper
  const parseNum = useCallback((val: number | string | undefined): number => {
    if (val === undefined || val === null || val === "") return 0;
    const clean = String(val).replace(/\s/g, "").replace(/,/g, ".");
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  }, []);

  // Yeni boş satır üretici helper - seçili istatistiğin Kom %, BMV %, KMV % oranlarını koşulsuz uygular
  const createBlankLine = useCallback(
    (satirNo: number = 1, customStat?: StatisticItem | null, customDir?: "alis" | "satis"): ArbitrajModalLine => {
      const stat = customStat !== undefined ? customStat : activeStat;
      const kmvMode = companyDefinitions?.KMV_UYGULAMA_SEKLI ?? 3;
      const bmvRate = stat?.bmvOrani !== undefined && Number(stat.bmvOrani) > 0 ? Number(stat.bmvOrani) : 0;
      const rawKmv = stat?.kmvOrani !== undefined && Number(stat.kmvOrani) > 0 ? Number(stat.kmvOrani) : 0;
      const kmvRate = kmvMode !== 1 ? rawKmv : 0;
      const komRate = stat?.komisyonOrani !== undefined && Number(stat.komisyonOrani) > 0 ? Number(stat.komisyonOrani) : 0;

      return {
        id: String(Date.now() + Math.random()),
        satirNo,
        paraId: 0,
        kod: "",
        ad: "",
        miktar: "",
        kur: "",
        tutar: "",
        komisyonOrani: komRate > 0 ? komRate.toString() : "",
        komisyon: "",
        bmvOrani: bmvRate > 0 ? bmvRate.toString() : "",
        bmv: "",
        kmvOrani: kmvRate > 0 ? kmvRate.toString() : "",
        kmv: "",
        isMaden: false,
        milyem: 1000,
      };
    },
    [activeStat, companyDefinitions]
  );

  // Tablo içi hücre odaklama helper'ı (yeni satır render gecikmelerini de çözer)
  const focusArbCell = useCallback((rowIndex: number, field: string) => {
    let attempts = 0;
    const tryFocus = () => {
      const el = document.getElementById(`arb-cell-${rowIndex}-${field}`) as HTMLInputElement | null;
      if (el) {
        el.focus();
        el.select();
      } else if (attempts < 15) {
        attempts++;
        setTimeout(tryFocus, 25);
      }
    };
    tryFocus();
  }, []);

  // Yeni boş satır ekle
  const handleAddBlankLine = useCallback(() => {
    setLines((prev) => [...prev, createBlankLine(prev.length + 1)]);
  }, [createBlankLine]);

  // Sync / Load lists
  useEffect(() => {
    if (cariList && cariList.length > 0) {
      setLocalCariList(cariList);
    } else if (show) {
      CariService.getCariKartlar()
        .then((res) => {
          if (res && res.length > 0) setLocalCariList(res);
        })
        .catch(() => {});
    }
  }, [cariList, show]);

  useEffect(() => {
    if (statisticList && statisticList.length > 0) {
      setLocalStatList(statisticList);
    } else if (show) {
      StatisticService.getStatistics()
        .then((res) => {
          if (res && res.length > 0) setLocalStatList(res);
        })
        .catch(() => {});
    }
  }, [statisticList, show]);

  // Combined currency + metal list
  const currencyList = useMemo<ArbitrajCurrencyItem[]>(() => {
    const list: ArbitrajCurrencyItem[] = [];

    // TL her zaman ilk sırada seçilebilir olarak listelenir
    const tlInParalar = (paralar || []).find((p) => {
      const kod = (p.kod || "").toUpperCase().trim();
      return kod === "TL" || kod === "TRY";
    });
    const tlInKurSatirlar = (kurSatirlar || []).find((k) => {
      const kod = (k.kod || "").toUpperCase().trim();
      return kod === "TL" || kod === "TRY";
    });

    list.push({
      id: tlInParalar?.id || tlInKurSatirlar?.paraId || 0,
      kod: "TL",
      ad: tlInParalar?.ad || tlInKurSatirlar?.ad || "TÜRK LİRASI",
      isMaden: false,
      milyem: 1000,
      dovizAlis: 1,
      dovizSatis: 1,
      efektifAlis: 1,
      efektifSatis: 1,
      parite: 1,
    });

    (paralar || []).forEach((p) => {
      const kod = (p.kod || "").toUpperCase().trim();
      if (kod && !list.some((x) => x.kod.toUpperCase() === kod)) {
        list.push({
          id: p.id,
          kod: p.kod,
          ad: p.ad || p.kod,
          isMaden: p.isMaden || false,
          milyem: p.milyem || 1000,
          dovizAlis: p.dovizAlis,
          dovizSatis: p.dovizSatis,
          efektifAlis: p.efektifAlis,
          efektifSatis: p.efektifSatis,
          parite: p.parite,
        });
      }
    });

    (kurSatirlar || []).forEach((k) => {
      const kod = (k.kod || "").toUpperCase().trim();
      if (kod && !list.some((x) => x.kod.toUpperCase() === kod)) {
        list.push({
          id: k.paraId || 1,
          kod: k.kod,
          ad: k.ad || k.kod,
          isMaden: false,
          dovizAlis: k.dovizAlis ?? undefined,
          dovizSatis: k.dovizSatis ?? undefined,
          efektifAlis: k.efektifAlis ?? undefined,
          efektifSatis: k.efektifSatis ?? undefined,
          parite: k.parite ?? undefined,
        });
      }
    });

    (urunler || []).forEach((u) => {
      const kod = (u.kod || "").toUpperCase().trim();
      if (kod && !list.some((x) => x.kod.toUpperCase() === kod)) {
        list.push({
          id: u.id || u.urunId || 999,
          kod: u.kod,
          ad: u.ad || u.kod,
          isMaden: true,
          milyem: u.hasOrani || u.alisMilyem || 1000,
          dovizAlis: u.alisFiyati,
          dovizSatis: u.satisFiyati,
        });
      }
    });

    if (!list.some((x) => x.kod.toUpperCase() === "EUR")) {
      list.push({ id: 2, kod: "EUR", ad: "EURO", isMaden: false, efektifAlis: 37.1, efektifSatis: 37.5, dovizAlis: 37.05, dovizSatis: 37.55 });
    }
    if (!list.some((x) => x.kod.toUpperCase() === "USD")) {
      list.push({ id: 1, kod: "USD", ad: "AMERİKAN DOLARI", isMaden: false, efektifAlis: 34.1, efektifSatis: 34.5, dovizAlis: 34.05, dovizSatis: 34.55 });
    }
    if (!list.some((x) => x.kod.toUpperCase() === "HAS")) {
      list.push({ id: 99, kod: "HAS", ad: "HAS ALTIN (24 AYAR)", isMaden: true, milyem: 1000, efektifAlis: 3050, efektifSatis: 3080 });
    }

    return list;
  }, [paralar, kurSatirlar, urunler]);

  // Find live rate for currency/item based on direction and kurTuru
  const getRateForItem = useCallback(
    (item: ArbitrajCurrencyItem, direction: "alis" | "satis", currentKurTuru: number = kurTuru): number => {
      const kodUpper = (item.kod || "").toUpperCase().trim();
      if (kodUpper === "TL" || kodUpper === "TRY") {
        return 1.0;
      }
      const srcKur = (kurSatirlar || []).find((k) => k.kod.toUpperCase() === item.kod.toUpperCase());
      if (direction === "satis") {
        if (currentKurTuru === 1) {
          const rate = srcKur?.dovizSatis || item.dovizSatis || srcKur?.efektifSatis || item.efektifSatis || 0;
          if (Number(rate) > 0) return Number(rate);
        } else {
          const rate = srcKur?.efektifSatis || item.efektifSatis || srcKur?.dovizSatis || item.dovizSatis || 0;
          if (Number(rate) > 0) return Number(rate);
        }
      } else {
        if (currentKurTuru === 1) {
          const rate = srcKur?.dovizAlis || item.dovizAlis || srcKur?.efektifAlis || item.efektifAlis || 0;
          if (Number(rate) > 0) return Number(rate);
        } else {
          const rate = srcKur?.efektifAlis || item.efektifAlis || srcKur?.dovizAlis || item.dovizAlis || 0;
          if (Number(rate) > 0) return Number(rate);
        }
      }
      return 1.0;
    },
    [kurSatirlar, kurTuru]
  );

  // Calculation function:
  // Seçili istatistiğin Komisyon %, BMV %, KMV % oranlarına göre tam hesaplama yapar
  const calculateRow = useCallback(
    (params: {
      miktar: number | string;
      kur: number | string;
      kod: string;
      komisyonOrani?: number | string;
      bmvOrani?: number | string;
      kmvOrani?: number | string;
      currentDirection?: "alis" | "satis";
    }) => {
      const m = parseNum(params.miktar);
      const k = parseNum(params.kur);
      const isTL = (params.kod || "").toUpperCase().trim() === "TL" || (params.kod || "").toUpperCase().trim() === "TRY";
      const brutTutar = m > 0 ? (isTL ? m : parseFloat((m * k).toFixed(tlKurusSayisi))) : 0;

      let bmvVal = "";
      let kmvVal = "";
      let komVal = "";

      const komRate = parseNum(params.komisyonOrani || "0");
      if (komRate > 0 && brutTutar > 0) {
        komVal = parseFloat((brutTutar * (komRate / 100)).toFixed(2)).toFixed(2);
      }

      const bmvRate = parseNum(params.bmvOrani || "0");
      if (bmvRate > 0 && brutTutar > 0) {
        bmvVal = parseFloat((brutTutar * (bmvRate / 100)).toFixed(2)).toFixed(2);
      }

      const kmvRate = parseNum(params.kmvOrani || "0");
      const effectiveKmvFactor = kmvRate >= 1 && kmvRate <= 10 ? kmvRate / 1000 : kmvRate / 100;
      const kmvMode =
        companyDefinitions?.KMV_UYGULAMA_SEKLI === 1 ||
        companyDefinitions?.KMV_UYGULAMA_SEKLI === 2 ||
        companyDefinitions?.KMV_UYGULAMA_SEKLI === 3
          ? companyDefinitions.KMV_UYGULAMA_SEKLI
          : 3;

      if (kmvMode !== 1 && kmvRate > 0 && brutTutar > 0) {
        const calculatedKmv = parseFloat((brutTutar * effectiveKmvFactor).toFixed(2));
        kmvVal = calculatedKmv > 0 ? calculatedKmv.toFixed(2) : "";
      }

      return {
        brutTutar,
        tutar: brutTutar > 0 ? brutTutar.toFixed(tlKurusSayisi) : "0.00",
        bmvOrani: bmvRate > 0 ? bmvRate.toString() : "",
        bmv: bmvVal,
        kmvOrani: kmvRate > 0 ? kmvRate.toString() : "",
        kmv: kmvVal,
        komisyonOrani: komRate > 0 ? komRate.toString() : "",
        komisyon: komVal,
      };
    },
    [parseNum, tlKurusSayisi, companyDefinitions]
  );

  // İstatistik oranlarını satırlara uygulama helper'ı
  const applyStatisticRatesToLines = useCallback(
    (
      stat: StatisticItem | null,
      dir: "alis" | "satis",
      targetLines: ArbitrajModalLine[]
    ): ArbitrajModalLine[] => {
      const kmvMode = companyDefinitions?.KMV_UYGULAMA_SEKLI ?? 3;
      const bmvRate = stat?.bmvOrani !== undefined && Number(stat.bmvOrani) > 0 ? Number(stat.bmvOrani) : 0;
      const rawKmv = stat?.kmvOrani !== undefined && Number(stat.kmvOrani) > 0 ? Number(stat.kmvOrani) : 0;
      const kmvRate = kmvMode !== 1 ? rawKmv : 0;
      const komRate = stat?.komisyonOrani !== undefined && Number(stat.komisyonOrani) > 0 ? Number(stat.komisyonOrani) : 0;

      return targetLines.map((row) => {
        const calc = calculateRow({
          miktar: row.miktar,
          kur: row.kur,
          kod: row.kod,
          bmvOrani: bmvRate > 0 ? bmvRate.toString() : "",
          kmvOrani: kmvRate > 0 ? kmvRate.toString() : "",
          komisyonOrani: komRate > 0 ? komRate.toString() : "",
          currentDirection: dir,
        });
        return {
          ...row,
          bmvOrani: bmvRate > 0 ? bmvRate.toString() : "",
          bmv: calc.bmv,
          kmvOrani: kmvRate > 0 ? kmvRate.toString() : "",
          kmv: calc.kmv,
          komisyonOrani: komRate > 0 ? komRate.toString() : "",
          komisyon: calc.komisyon,
          tutar: calc.tutar,
        };
      });
    },
    [calculateRow, companyDefinitions]
  );

  // Initialize modal state when modal opens or when savedArbitraj is provided / updated
  const prevShowRef = useRef(false);
  const prevSavedArbitrajRef = useRef<any>(null);

  useEffect(() => {
    const isOpening = show && !prevShowRef.current;
    const isSavedArbitrajChanged = show && savedArbitraj !== prevSavedArbitrajRef.current && Boolean(savedArbitraj);

    if (isOpening || isSavedArbitrajChanged) {
      prevSavedArbitrajRef.current = savedArbitraj;
      setSaveMessage(null);
      setIsSaving(false);
      setLookupType(null);
      setLookupSearchTerm("");
      setActiveLookupLineId(null);
      setShowDetayModal(false);

      if (
        savedArbitraj &&
        ((savedArbitraj.allLines && savedArbitraj.allLines.length > 0) ||
          (savedArbitraj.lines && savedArbitraj.lines.length > 0))
      ) {
        // Kayıtlı arbitraj verisini otomatik yükle
        const rawList =
          savedArbitraj.allLines && savedArbitraj.allLines.length > 0
            ? savedArbitraj.allLines
            : savedArbitraj.lines || [];

        const sourceLines: ArbitrajModalLine[] = rawList.map((l: any, idx: number) => {
          const miktarVal = l.miktar !== undefined && l.miktar !== null ? String(l.miktar) : "";
          const kurVal = l.kur !== undefined && l.kur !== null ? String(l.kur) : "";
          const tutarVal = l.tutar !== undefined && l.tutar !== null ? String(l.tutar) : "";
          return {
            id: String(l.id || `arb-row-${idx + 1}-${Date.now()}`),
            satirNo: idx + 1,
            paraId: Number(l.paraId) || 0,
            kod: l.kod || l.paraKodu || "",
            ad: l.ad || l.paraAdi || "",
            miktar: miktarVal,
            kur: kurVal,
            tutar: tutarVal,
            komisyonOrani: l.komisyonOrani !== undefined && l.komisyonOrani !== null ? String(l.komisyonOrani) : "",
            komisyon: l.komisyon !== undefined && l.komisyon !== null ? String(l.komisyon) : "",
            bmvOrani: l.bmvOrani !== undefined && l.bmvOrani !== null ? String(l.bmvOrani) : "",
            bmv: l.bmv !== undefined && l.bmv !== null ? String(l.bmv) : "",
            kmvOrani: l.kmvOrani !== undefined && l.kmvOrani !== null ? String(l.kmvOrani) : "",
            kmv: l.kmv !== undefined && l.kmv !== null ? String(l.kmv) : "",
            isMaden: Boolean(l.isMaden),
            milyem: Number(l.milyem) || 1000,
            seriNo: l.seriNo || "",
            belgeNo: l.belgeNo || "",
            ettn: l.ettn || "",
          };
        });
        setLines(sourceLines.length > 0 ? sourceLines : [createBlankLine(1)]);
        if (savedArbitraj.islemYonu) {
          setIslemYonu(savedArbitraj.islemYonu);
          const rawGn = String((savedArbitraj as any).gelisNedeni || initialGelisNedeni || "").trim();
          setGelisNedeni(rawGn.toLowerCase() === "arbitraj" ? "" : rawGn);
        } else {
          const dir = fisTip === 0 ? "satis" : "alis";
          setIslemYonu(dir);
          const rawGn = String(initialGelisNedeni || "").trim();
          setGelisNedeni(rawGn.toLowerCase() === "arbitraj" ? "" : rawGn);
        }
        if (savedArbitraj.seriNo) setSeriNo(savedArbitraj.seriNo);
        else setSeriNo("");
        if (savedArbitraj.belgeNo) setBelgeNo(savedArbitraj.belgeNo);
        else setBelgeNo("");
        if (savedArbitraj.cariUnvan) setUnvan(savedArbitraj.cariUnvan);
        if (savedArbitraj.vknTckn) setFormVknTckn(savedArbitraj.vknTckn);
        const resolvedStat = savedArbitraj.istatistikKodu || (savedArbitraj.islemYonu === "satis" ? "10285" : "9249");
        setIstatistikKod(resolvedStat);
        if (savedArbitraj.cariId) setCariId(savedArbitraj.cariId);
        if (savedArbitraj.cariKodu) setCariKodu(savedArbitraj.cariKodu);
        if (savedArbitraj.detay) {
          const d = savedArbitraj.detay;
          if (d.adres) setDetayAdres(d.adres);
          if (d.telefon) setDetayTelefon(d.telefon);
          if (d.eposta) setDetayEposta(d.eposta);
          if (d.babaAdi) setDetayBabaAdi(d.babaAdi);
          if (d.anneAdi) setDetayAnneAdi(d.anneAdi);
          if (d.pasaportNo) setDetayPasaportNo(d.pasaportNo);
          if (d.yetkiliKisi) setDetayYetkiliKisi(d.yetkiliKisi);
          if (d.meslek) setDetayMeslek(d.meslek);
          if (d.il) setDetayIl(d.il);
          if (d.ilce) setDetayIlce(d.ilce);
          if (d.postaKodu) setDetayPostaKodu(d.postaKodu);
        }
      } else if (isOpening) {
        // Fişin tersi açılır: Arka Alışsa Satış, Satışsa Alış
        const dir: "alis" | "satis" = fisTip === 0 ? "satis" : "alis";
        setIslemYonu(dir);
        const rawGn = String(initialGelisNedeni || "").trim();
        setGelisNedeni(rawGn.toLowerCase() === "arbitraj" ? "" : rawGn);
        setCariId(selectedCariId);
        setCariKodu(selectedCariKod || "");
        setUnvan(selectedUnvan || "İSİM BEYAN EDİLMEMİŞTİR");
        setFormVknTckn(vknTckn || "");
        setSeriNo("");
        setBelgeNo("");

        // Fiş yönüne uygun (Alış ise Alış, Satış ise Satış) varsayılan istatistiği belirle:
        const initialStatObj = getDefaultIstatistik(dir);
        const initialStatCode = initialStatObj?.kod || (dir === "alis" ? "9249" : "10285");
        setIstatistikKod(initialStatCode);

        // Satırlar ilk satır otomatik boş olarak açılır ve istatistik oranlarını alır
        const blankRow = createBlankLine(1, initialStatObj, dir);
        setLines([blankRow]);
      }
    }
    prevShowRef.current = show;
  }, [
    show,
    savedArbitraj,
    fisTip,
    hedefTlTutar,
    selectedCariId,
    selectedCariKod,
    selectedUnvan,
    vknTckn,
    istatistikKodu,
    pageType,
    currencyList,
    getRateForItem,
    dovizKurusSayisi,
    kurKurusSayisi,
    tlKurusSayisi,
    calculateRow,
    companyDefinitions,
    localStatList,
    createBlankLine,
  ]);

  // Modal açıldığında otomatik olarak Fiş Tipine (Alış / Satış) SADECE İLK AÇILIŞTA odaklan
  useEffect(() => {
    if (show) {
      if (!initialFocusDoneRef.current) {
        initialFocusDoneRef.current = true;
        const focusTip = () => {
          const el = tipSelectRef.current || (document.getElementById("arbitraj-fis-tip-select") as HTMLSelectElement | null);
          if (el && document.activeElement !== el) {
            el.focus({ preventScroll: true });
          }
        };
        focusTip();
        const t1 = setTimeout(focusTip, 50);
        const t2 = setTimeout(focusTip, 150);
        return () => {
          clearTimeout(t1);
          clearTimeout(t2);
        };
      }
    } else {
      initialFocusDoneRef.current = false;
    }
  }, [show]);

  // Recalculate rates when kurTuru changes
  const handleKurTuruChange = (newKurTuru: number) => {
    setKurTuru(newKurTuru);
    setLines((prev) =>
      prev.map((l) => {
        const item = currencyList.find((c) => c.kod.toUpperCase() === l.kod.toUpperCase());
        if (!item) return l;
        const rate = getRateForItem(item, islemYonu, newKurTuru);
        const calc = calculateRow({
          miktar: l.miktar,
          kur: rate.toFixed(kurKurusSayisi),
          kod: l.kod,
          komisyonOrani: l.komisyonOrani,
          bmvOrani: l.bmvOrani,
          kmvOrani: l.kmvOrani,
          currentDirection: islemYonu,
        });
        return {
          ...l,
          kur: rate.toFixed(kurKurusSayisi),
          tutar: calc.tutar,
          komisyon: calc.komisyon,
          bmv: calc.bmv,
          kmv: calc.kmv,
        };
      })
    );
  };

  // Switch direction (Alış <-> Satış)
  const handleToggleIslemYonu = (targetDir?: "alis" | "satis") => {
    const newDir: "alis" | "satis" = targetDir || (islemYonu === "satis" ? "alis" : "satis");
    setIslemYonu(newDir);

    // Alışta alış, satışta satış istatistiği belirle:
    const newStat = getDefaultIstatistik(newDir);
    const newStatKod = newStat?.kod || (newDir === "alis" ? "9249" : "10285");
    setIstatistikKod(newStatKod);

    setLines((prev) => {
      const updated = prev.map((l) => {
        const item = currencyList.find((c) => c.kod.toUpperCase() === l.kod.toUpperCase());
        const rate = item ? getRateForItem(item, newDir, kurTuru) : parseNum(l.kur);
        return {
          ...l,
          kur: rate > 0 ? rate.toFixed(kurKurusSayisi) : l.kur,
        };
      });
      return applyStatisticRatesToLines(newStat, newDir, updated);
    });
  };

  // Recalculate a line on field edit
  const handleUpdateLine = (
    lineId: string,
    field: "miktar" | "kur" | "tutar" | "kod" | "ad" | "komisyonOrani" | "bmvOrani" | "kmvOrani",
    value: string
  ) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;

        if (field === "kod") {
          const found = currencyList.find((c) => c.kod.toUpperCase() === value.trim().toUpperCase());
          if (found) {
            const rate = getRateForItem(found, islemYonu, kurTuru);
            const targetTl = Number(hedefTlTutar) > 0 ? Number(hedefTlTutar) : parseNum(l.tutar);
            const calcMiktar =
              rate > 0 && targetTl > 0 ? targetTl / rate : parseNum(l.miktar) > 0 ? parseNum(l.miktar) : 100;

            const stat = activeStat;
            const kmvMode = companyDefinitions?.KMV_UYGULAMA_SEKLI ?? 3;
            const bmvRate = stat?.bmvOrani !== undefined && Number(stat.bmvOrani) > 0 ? Number(stat.bmvOrani) : 0;
            const rawKmv = stat?.kmvOrani !== undefined && Number(stat.kmvOrani) > 0 ? Number(stat.kmvOrani) : 0;
            const kmvRate = kmvMode !== 1 ? rawKmv : 0;
            const komRate = stat?.komisyonOrani !== undefined && Number(stat.komisyonOrani) > 0 ? Number(stat.komisyonOrani) : 0;

            const calc = calculateRow({
              miktar: calcMiktar.toFixed(found.isMaden ? 3 : dovizKurusSayisi),
              kur: rate.toFixed(kurKurusSayisi),
              kod: found.kod,
              komisyonOrani: l.komisyonOrani || (komRate > 0 ? komRate.toString() : ""),
              bmvOrani: l.bmvOrani || (bmvRate > 0 ? bmvRate.toString() : ""),
              kmvOrani: l.kmvOrani || (kmvRate > 0 ? kmvRate.toString() : ""),
              currentDirection: islemYonu,
            });

            return {
              ...l,
              paraId: found.id,
              kod: found.kod,
              ad: found.ad,
              kur: rate.toFixed(kurKurusSayisi),
              miktar: calcMiktar.toFixed(found.isMaden ? 3 : dovizKurusSayisi),
              tutar: calc.tutar,
              komisyonOrani: calc.komisyonOrani,
              komisyon: calc.komisyon,
              bmvOrani: calc.bmvOrani,
              bmv: calc.bmv,
              kmvOrani: calc.kmvOrani,
              kmv: calc.kmv,
              isMaden: found.isMaden,
              milyem: found.milyem || 1000,
            };
          }
          return { ...l, kod: value };
        }

        if (field === "ad") {
          return { ...l, ad: value };
        }

        let newMiktar = field === "miktar" ? value : l.miktar;
        let newKur = field === "kur" ? value : l.kur;
        let newKomOrani = field === "komisyonOrani" ? value : l.komisyonOrani;
        let newBmvOrani = field === "bmvOrani" ? value : l.bmvOrani;
        let newKmvOrani = field === "kmvOrani" ? value : l.kmvOrani;

        if (field === "tutar") {
          const tNum = parseNum(value);
          const kNum = parseNum(l.kur);
          if (tNum > 0 && kNum > 0) {
            newMiktar = (tNum / kNum).toFixed(l.isMaden ? 3 : dovizKurusSayisi);
          }
        }

        const calc = calculateRow({
          miktar: newMiktar,
          kur: newKur,
          kod: l.kod,
          komisyonOrani: newKomOrani,
          bmvOrani: newBmvOrani,
          kmvOrani: newKmvOrani,
          currentDirection: islemYonu,
        });

        return {
          ...l,
          miktar: newMiktar,
          kur: newKur,
          komisyonOrani: calc.komisyonOrani,
          komisyon: calc.komisyon,
          bmvOrani: calc.bmvOrani,
          bmv: calc.bmv,
          kmvOrani: calc.kmvOrani,
          kmv: calc.kmv,
          tutar: calc.tutar,
        };
      })
    );
  };

  // Select currency from lookup for a line
  const handleSelectCurrencyForLine = (lineId: string, item: ArbitrajCurrencyItem) => {
    const rate = getRateForItem(item, islemYonu, kurTuru);
    const targetTl = Number(hedefTlTutar) > 0 ? Number(hedefTlTutar) : 0;
    const stat = activeStat;
    const kmvMode = companyDefinitions?.KMV_UYGULAMA_SEKLI ?? 3;
    const bmvRate = stat?.bmvOrani !== undefined && Number(stat.bmvOrani) > 0 ? Number(stat.bmvOrani) : 0;
    const rawKmv = stat?.kmvOrani !== undefined && Number(stat.kmvOrani) > 0 ? Number(stat.kmvOrani) : 0;
    const kmvRate = kmvMode !== 1 ? rawKmv : 0;
    const komRate = stat?.komisyonOrani !== undefined && Number(stat.komisyonOrani) > 0 ? Number(stat.komisyonOrani) : 0;

    setLines((prev) => {
      const exists = prev.some((l) => l.id === lineId);
      if (!lineId || !exists) {
        // Tablo boş veya satır bulunamadıysa yeni satır olarak ekle
        const calcMiktar = rate > 0 && targetTl > 0 ? targetTl / rate : 100;
        const calc = calculateRow({
          miktar: calcMiktar.toFixed(item.isMaden ? 3 : dovizKurusSayisi),
          kur: rate.toFixed(kurKurusSayisi),
          kod: item.kod,
          bmvOrani: bmvRate > 0 ? bmvRate.toString() : "",
          kmvOrani: kmvRate > 0 ? kmvRate.toString() : "",
          komisyonOrani: komRate > 0 ? komRate.toString() : "",
          currentDirection: islemYonu,
        });

        return [
          ...prev,
          {
            id: String(Date.now() + Math.random()),
            satirNo: prev.length + 1,
            paraId: item.id,
            kod: item.kod,
            ad: item.ad,
            miktar: calcMiktar.toFixed(item.isMaden ? 3 : dovizKurusSayisi),
            kur: rate.toFixed(kurKurusSayisi),
            tutar: calc.tutar,
            komisyonOrani: calc.komisyonOrani,
            komisyon: calc.komisyon,
            bmvOrani: calc.bmvOrani,
            bmv: calc.bmv,
            kmvOrani: calc.kmvOrani,
            kmv: calc.kmv,
            isMaden: item.isMaden,
            milyem: item.milyem || 1000,
          },
        ];
      }

      return prev.map((l) => {
        if (l.id !== lineId) return l;
        const calcMiktar =
          rate > 0 && targetTl > 0 ? targetTl / rate : parseNum(l.miktar) > 0 ? parseNum(l.miktar) : 100;

        const effectiveBmvOrani = l.bmvOrani || (bmvRate > 0 ? bmvRate.toString() : "");
        const effectiveKmvOrani = l.kmvOrani || (kmvRate > 0 ? kmvRate.toString() : "");
        const effectiveKomOrani = l.komisyonOrani || (komRate > 0 ? komRate.toString() : "");

        const calc = calculateRow({
          miktar: calcMiktar.toFixed(item.isMaden ? 3 : dovizKurusSayisi),
          kur: rate.toFixed(kurKurusSayisi),
          kod: item.kod,
          komisyonOrani: effectiveKomOrani,
          bmvOrani: effectiveBmvOrani,
          kmvOrani: effectiveKmvOrani,
          currentDirection: islemYonu,
        });

        return {
          ...l,
          paraId: item.id,
          kod: item.kod,
          ad: item.ad,
          kur: rate.toFixed(kurKurusSayisi),
          miktar: calcMiktar.toFixed(item.isMaden ? 3 : dovizKurusSayisi),
          tutar: calc.tutar,
          komisyonOrani: calc.komisyonOrani,
          komisyon: calc.komisyon,
          bmvOrani: calc.bmvOrani,
          bmv: calc.bmv,
          kmvOrani: calc.kmvOrani,
          kmv: calc.kmv,
          isMaden: item.isMaden,
          milyem: item.milyem || 1000,
        };
      });
    });
    setLookupType(null);
    setActiveLookupLineId(null);
  };

  // Cari search and select
  const handleSelectCari = (c: CariKartItem) => {
    setCariId(c.id);
    setCariKodu(c.kod || "");
    setUnvan(c.ad || "");
    setFormVknTckn(c.vergiKimlikNo || "");
    setDetayTelefon(c.telefon || "");
    setDetayAdres(c.adres || "");
    setLookupType(null);
  };

  // Add line (opens currency lookup so user can pick the currency)
  const handleAddLine = () => {
    setActiveLookupLineId(null);
    setLookupSearchTerm("");
    setLookupType("currency");
  };

  // Remove line
  const handleRemoveLine = (lineId: string) => {
    setLines((prev) => {
      const filtered = prev.filter((l) => l.id !== lineId);
      if (filtered.length === 0) {
        return [createBlankLine(1)];
      }
      return filtered.map((l, idx) => ({ ...l, satirNo: idx + 1 }));
    });
  };

  // Calculations for summary boxes:
  const totalTutar = useMemo(() => {
    return lines.reduce((acc, row) => acc + parseNum(row.tutar), 0);
  }, [lines, parseNum]);

  const totalKomisyon = useMemo(() => {
    return lines.reduce((acc, row) => acc + parseNum(row.komisyon), 0);
  }, [lines, parseNum]);

  const totalBmv = useMemo(() => {
    return lines.reduce((acc, row) => acc + parseNum(row.bmv), 0);
  }, [lines, parseNum]);

  const totalKmv = useMemo(() => {
    return lines.reduce((acc, row) => acc + parseNum(row.kmv), 0);
  }, [lines, parseNum]);

  const totalMasraf = useMemo(() => {
    const kmvMode =
      companyDefinitions?.KMV_UYGULAMA_SEKLI === 1 ||
      companyDefinitions?.KMV_UYGULAMA_SEKLI === 2 ||
      companyDefinitions?.KMV_UYGULAMA_SEKLI === 3
        ? companyDefinitions.KMV_UYGULAMA_SEKLI
        : 3;
    const effectiveKmv = kmvMode === 3 ? totalKmv : 0;
    return parseFloat((totalBmv + effectiveKmv + totalKomisyon).toFixed(2));
  }, [totalKomisyon, totalBmv, totalKmv, companyDefinitions]);

  // Son Toplam:
  // Alış fişinde: Ödenecek TL = Toplam Tutar - Toplam Masraf
  // Satış fişinde: Alınacak TL = Toplam Tutar + Toplam Masraf
  const sonToplam = useMemo(() => {
    if (islemYonu === "satis") {
      return parseFloat((totalTutar + totalMasraf).toFixed(2));
    } else {
      return parseFloat((totalTutar - totalMasraf).toFixed(2));
    }
  }, [islemYonu, totalTutar, totalMasraf]);

  // Arbitraj Farkı (Arka plandaki hedef fiş tutarı ile denge)
  const farkTl = useMemo(() => {
    const hedef = Number(hedefTlTutar) || 0;
    if (hedef <= 0) return 0;
    return parseFloat((sonToplam - hedef).toFixed(2));
  }, [sonToplam, hedefTlTutar]);

  // Arbitraj Dengesi (Arka Fiş Tutarı ile Alınıp Verilecek Net Tutar)
  const netDenge = useMemo(() => {
    const arkaTutar = Number(hedefTlTutar) || 0;
    const isArkaAlis = fisTip === 0;

    let netTutar = 0;
    let tip: "alinacak" | "verilecek" | "esit" = "esit";

    if (arkaTutar <= 0 && sonToplam <= 0) {
      return {
        arkaTutar,
        netTutar: 0,
        tip: "esit" as const,
        label: "Alınıp Verilecek Tutar:",
      };
    }

    const diff = sonToplam - arkaTutar;
    if (Math.abs(diff) < 0.01) {
      tip = "esit";
      netTutar = 0;
    } else if (isArkaAlis) {
      if (diff > 0) {
        tip = "alinacak";
        netTutar = diff;
      } else {
        tip = "verilecek";
        netTutar = Math.abs(diff);
      }
    } else {
      if (diff > 0) {
        tip = "verilecek";
        netTutar = diff;
      } else {
        tip = "alinacak";
        netTutar = Math.abs(diff);
      }
    }

    return {
      arkaTutar,
      netTutar: parseFloat(netTutar.toFixed(2)),
      tip,
      label:
        tip === "alinacak"
          ? "Müşteriden Alınacak TL:"
          : tip === "verilecek"
          ? "Müşteriye Verilecek TL:"
          : "Alınıp Verilecek Tutar:",
    };
  }, [hedefTlTutar, fisTip, sonToplam]);

  // Otomatik Dengele butonu: Arka plan hedef TL tutarını tam karşılayacak şekilde satırı dengeler
  const handleAutoBalance = () => {
    if (Number(hedefTlTutar) <= 0) return;
    const targetTl = Number(hedefTlTutar);
    if (lines.length === 0) return;

    // Hedef satır: Kuru olan ilk satır veya ilk satır
    const targetLine = lines.find((l) => parseNum(l.kur) > 0) || lines[0];
    const k = parseNum(targetLine.kur);
    if (k <= 0) return;

    // Diğer satırların son toplam katkısını hesapla
    const otherLines = lines.filter((l) => l.id !== targetLine.id);
    let otherSonToplam = 0;
    for (const ol of otherLines) {
      const olTutar = parseNum(ol.tutar);
      const olKom = parseNum(ol.komisyon);
      const olBmv = parseNum(ol.bmv);
      const olKmv = parseNum(ol.kmv);
      const olMasraf = isSatis ? olBmv + olKmv + olKom : olKom;
      otherSonToplam += isSatis ? olTutar + olMasraf : olTutar - olMasraf;
    }

    const neededSonToplam = Math.max(0, targetTl - otherSonToplam);

    const komOran = parseNum(targetLine.komisyonOrani) / 100;
    const bmvOran = isSatis ? parseNum(targetLine.bmvOrani) / 100 : 0;
    const kmvOran = isSatis ? parseNum(targetLine.kmvOrani) / 100 : 0;
    const masrafMultiplier = isSatis ? (1 + bmvOran + kmvOran + komOran) : (1 - komOran);

    const neededTutar = masrafMultiplier > 0 ? neededSonToplam / masrafMultiplier : neededSonToplam;
    const calculatedMiktar = neededTutar / k;
    const precision = targetLine.isMaden ? 3 : dovizKurusSayisi;
    const miktarStr = calculatedMiktar.toFixed(precision);

    handleUpdateLine(targetLine.id, "miktar", miktarStr);
  };

  // Save / Apply Arbitraj (shouldPrint: F10 ile basılırsa true, normal kaydet ile false)
  const handleSaveArbitraj = async (shouldPrint: boolean = true) => {
    if (!istatistikValidation.isValid) {
      setSaveMessage({ type: "danger", text: istatistikValidation.errorMessage || "Geçersiz istatistik kodu!" });
      return;
    }

    const validLines = lines.filter((l) => (l.kod && l.kod.trim() !== "") && (parseNum(l.miktar) > 0 || parseNum(l.tutar) > 0));
    if (validLines.length === 0 || totalTutar <= 0) {
      setSaveMessage({ type: "danger", text: "Lütfen geçerli bir döviz satırı ve tutar giriniz." });
      return;
    }

    const firstLine = validLines[0];
    const selectedItem = currencyList.find((c) => c.kod.toUpperCase() === firstLine.kod.toUpperCase()) || {
      id: firstLine.paraId,
      kod: firstLine.kod,
      ad: firstLine.ad,
      isMaden: firstLine.isMaden,
      milyem: firstLine.milyem,
    };

    const miktarNum = parseNum(firstLine.miktar);
    const kurNum = parseNum(firstLine.kur);

    const applyResult: ArbitrajApplyResult = {
      islemYonu,
      girisPara: islemYonu === "satis" ? { id: 0, kod: "USD", ad: "Dolar" } : selectedItem,
      girisMiktar: islemYonu === "satis" ? Number(hedefTlTutar) : miktarNum,
      girisKur: islemYonu === "satis" ? 1.0 : kurNum,
      cikisPara: islemYonu === "satis" ? selectedItem : { id: 0, kod: "USD", ad: "Dolar" },
      cikisMiktar: islemYonu === "satis" ? miktarNum : Number(hedefTlTutar),
      cikisKur: islemYonu === "satis" ? kurNum : 1.0,
      parite: kurNum,
      pariteYonu: "carp",
      aciklama: gelisNedeni.trim() ? `${gelisNedeni.trim()} - ${firstLine.kod}` : `Arbitraj - ${firstLine.kod}`,
      cariId: cariId,
      cariUnvan: unvan,
      cariKodu: cariKodu,
      vknTckn: formVknTckn,
      istatistikKodu: istatistikKod,
      seriNo: seriNo.trim() || undefined,
      belgeNo: belgeNo.trim() || undefined,
      gelisNedeni: (gelisNedeni.trim().toLowerCase() === "arbitraj" ? undefined : (gelisNedeni.trim() || undefined)),
      allLines: validLines,
      lines: validLines,
      detay: {
        cariTipi: detayCariTipi,
        yetkiliKisi: detayYetkiliKisi,
        yetkiliKisiId: detayYetkiliKisiId,
        sirketTuru: detaySirketTuru,
        dernekAmaci: detayDernekAmaci,
        pasaportNo: detayPasaportNo,
        gecerlilikTarihi: detayGecerlilikTarihi,
        dogumTarihi: detayDogumTarihi,
        dogumYeri: detayDogumYeri,
        kimlikKaynagi: detayKimlikKaynagi,
        kimlikSeriNo: detayKimlikSeriNo,
        babaAdi: detayBabaAdi,
        anneAdi: detayAnneAdi,
        vergiDairesi: detayVergiDairesi,
        vergiDairesiId: detayVergiDairesiId,
        adres: detayAdres,
        eposta: detayEposta,
        telefon: detayTelefon,
        vekil: detayVekil,
        vekilTipi: detayVekilTipi,
        vekilAdi: detayVekilAdi,
        vekilKimlikNo: detayVekilKimlikNo,
        meslek: detayMeslek,
        meslekId: detayMeslekId,
        ulke: detayUlke,
        uyruk: detayUyruk,
        hukukiYapi: detayHukukiYapi,
        il: detayIl,
        ilce: detayIlce,
        postaKodu: detayPostaKodu,
      },
    };

    setIsSaving(true);
    setSaveMessage(null);

    try {
      if (onSaveDirect) {
        await onSaveDirect(applyResult, shouldPrint);
      } else if (onApplyToFis) {
        onApplyToFis(applyResult);
      }
      setSaveMessage({
        type: "success",
        text: shouldPrint
          ? "Arbitraj fişi başarıyla kaydedildi ve yazdırıldı!"
          : "Arbitraj fişi başarıyla kaydedildi!",
      });
      setTimeout(() => {
        onClose();
      }, 350);
    } catch (err: any) {
      setSaveMessage({ type: "danger", text: err?.message || "Arbitraj kaydedilirken hata oluştu." });
    } finally {
      setIsSaving(false);
    }
  };

  // F9) Arbitraj Yazdırma Modalı Aç
  const handleOpenPrintModal = () => {
    if (!istatistikValidation.isValid) {
      setSaveMessage({ type: "danger", text: istatistikValidation.errorMessage || "Geçersiz istatistik kodu!" });
      return;
    }

    const validLines = lines.filter((l) => (l.kod && l.kod.trim() !== "") && (parseNum(l.miktar) > 0 || parseNum(l.tutar) > 0));
    if (validLines.length === 0 || totalTutar <= 0) {
      setSaveMessage({ type: "danger", text: "Lütfen yazdırmak için geçerli bir döviz satırı ve tutar giriniz." });
      return;
    }

    const firstLine = validLines[0];
    const selectedItem = currencyList.find((c) => c.kod.toUpperCase() === firstLine.kod.toUpperCase()) || {
      id: firstLine.paraId,
      kod: firstLine.kod,
      ad: firstLine.ad,
      isMaden: firstLine.isMaden,
      milyem: firstLine.milyem,
    };

    const miktarNum = parseNum(firstLine.miktar);
    const kurNum = parseNum(firstLine.kur);

    const applyResult: ArbitrajApplyResult = {
      islemYonu,
      girisPara: islemYonu === "satis" ? { id: 0, kod: "USD", ad: "Dolar" } : selectedItem,
      girisMiktar: islemYonu === "satis" ? Number(hedefTlTutar) : miktarNum,
      girisKur: islemYonu === "satis" ? 1.0 : kurNum,
      cikisPara: islemYonu === "satis" ? selectedItem : { id: 0, kod: "USD", ad: "Dolar" },
      cikisMiktar: islemYonu === "satis" ? miktarNum : Number(hedefTlTutar),
      cikisKur: islemYonu === "satis" ? kurNum : 1.0,
      parite: kurNum,
      pariteYonu: "carp",
      aciklama: gelisNedeni.trim() ? `${gelisNedeni.trim()} - ${firstLine.kod}` : `Arbitraj - ${firstLine.kod}`,
      cariId: cariId,
      cariUnvan: unvan,
      cariKodu: cariKodu,
      vknTckn: formVknTckn,
      istatistikKodu: istatistikKod,
      seriNo: seriNo.trim() || undefined,
      belgeNo: belgeNo.trim() || undefined,
      gelisNedeni: (gelisNedeni.trim().toLowerCase() === "arbitraj" ? undefined : (gelisNedeni.trim() || undefined)),
      allLines: validLines,
      lines: validLines,
      detay: {
        cariTipi: detayCariTipi,
        yetkiliKisi: detayYetkiliKisi,
        yetkiliKisiId: detayYetkiliKisiId,
        sirketTuru: detaySirketTuru,
        dernekAmaci: detayDernekAmaci,
        pasaportNo: detayPasaportNo,
        gecerlilikTarihi: detayGecerlilikTarihi,
        dogumTarihi: detayDogumTarihi,
        dogumYeri: detayDogumYeri,
        kimlikKaynagi: detayKimlikKaynagi,
        kimlikSeriNo: detayKimlikSeriNo,
        babaAdi: detayBabaAdi,
        anneAdi: detayAnneAdi,
        vergiDairesi: detayVergiDairesi,
        vergiDairesiId: detayVergiDairesiId,
        adres: detayAdres,
        eposta: detayEposta,
        telefon: detayTelefon,
        vekil: detayVekil,
        vekilTipi: detayVekilTipi,
        vekilAdi: detayVekilAdi,
        vekilKimlikNo: detayVekilKimlikNo,
        meslek: detayMeslek,
        meslekId: detayMeslekId,
        ulke: detayUlke,
        uyruk: detayUyruk,
        hukukiYapi: detayHukukiYapi,
        il: detayIl,
        ilce: detayIlce,
        postaKodu: detayPostaKodu,
      },
    };

    if (onOpenPrintModal) {
      onOpenPrintModal(applyResult);
    }
  };

  // Keyboard shortcut inside modal (ESC, F8, F9, F10)
  useEffect(() => {
    if (!show) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 1) Eğer iç modal (Döviz, Cari, İstatistik arama veya F8 Detay Modalı) açıksa ESC yalnızca iç modalı kapatır!
      if (lookupType !== null || showDetayModal) {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          if (lookupType !== null) {
            setLookupType(null);
            const rIdx = activeLookupLineIndexRef.current;
            if (rIdx !== null && rIdx !== undefined) {
              setTimeout(() => focusArbCell(rIdx, "kod"), 50);
            }
          }
          if (showDetayModal) {
            setShowDetayModal(false);
          }
        }
        return;
      }

      // 2) İç modal açık DEĞİLSE: ESC doğrudan ArbitrajModal'ı kapatır
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === "F8") {
        e.preventDefault();
        e.stopPropagation();
        setShowDetayModal(true);
      } else if (e.key === "F9") {
        e.preventDefault();
        e.stopPropagation();
        handleOpenPrintModal();
      } else if (e.key === "F1") {
        e.preventDefault();
        e.stopPropagation();
        handleSaveArbitraj(false);
      } else if (e.key === "F10") {
        e.preventDefault();
        e.stopPropagation();
        handleSaveArbitraj(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [show, lookupType, showDetayModal, onClose, handleSaveArbitraj, handleOpenPrintModal, focusArbCell]);

  // LookupModal Kolon Tanımları (Döviz / Cari / İstatistik)
  const currencyColumns: LookupColumn<ArbitrajCurrencyItem>[] = useMemo(() => [
    {
      header: "Kod",
      width: "90px",
      render: (p) => <span className="font-monospace fw-bold text-primary">{p.kod}</span>,
    },
    {
      header: "Para / Döviz Adı",
      render: (p) => <span className="fw-medium">{p.ad}</span>,
    },
    {
      header: islemYonu === "satis" ? "Satış Kuru" : "Alış Kuru",
      align: "right",
      width: "120px",
      render: (p) => {
        const rate = islemYonu === "satis"
          ? Number(p.efektifSatis || p.dovizSatis || 0)
          : Number(p.efektifAlis || p.dovizAlis || 0);
        return rate > 0
          ? rate.toLocaleString("tr-TR", { minimumFractionDigits: kurKurusSayisi })
          : "-";
      },
    },
  ], [islemYonu, kurKurusSayisi]);

  const cariColumns: LookupColumn<CariKartItem>[] = useMemo(() => [
    {
      header: "Cari Kodu",
      width: "120px",
      render: (c) => <span className="font-monospace fw-bold text-primary">{c.kod}</span>,
    },
    {
      header: "Ünvan / Ad",
      render: (c) => <span className="fw-semibold">{c.ad}</span>,
    },
    {
      header: "VKN / TCKN",
      width: "130px",
      render: (c) => <span className="font-monospace">{c.vergiKimlikNo || "-"}</span>,
    },
    {
      header: "Telefon",
      width: "120px",
      render: (c) => <span>{c.telefon || "-"}</span>,
    },
  ], []);

  const istatistikColumns: LookupColumn<StatisticItem>[] = useMemo(() => [
    {
      header: "İstatistik Kodu",
      width: "120px",
      render: (s) => <span className="font-monospace fw-bold text-primary">{s.kod}</span>,
    },
    {
      header: "Açıklama / Tanım",
      render: (s) => <span>{(s as any).aciklama || (s as any).ad || (s as any).tanim || s.kod}</span>,
    },
    {
      header: "Fiş Tipi",
      width: "100px",
      render: (s) => {
        const fType = Number(s.fisTipi);
        const label = fType === 0 ? "Alış" : fType === 1 ? "Satış" : "Alış-Satış";
        const bg = fType === 0 ? "success" : fType === 1 ? "danger" : "primary";
        return <Badge bg={bg} className="px-2 py-0.5">{label}</Badge>;
      },
    },
    {
      header: "Kom %",
      width: "75px",
      render: (s) => (
        <span className="font-monospace fw-semibold text-end d-block">
          {Number(s.komisyonOrani || 0) > 0 ? `%${s.komisyonOrani}` : "-"}
        </span>
      ),
    },
    {
      header: "BMV %",
      width: "75px",
      render: (s) => (
        <span className="font-monospace fw-semibold text-end d-block">
          {Number(s.bmvOrani || 0) > 0 ? `%${s.bmvOrani}` : "-"}
        </span>
      ),
    },
    {
      header: "KMV %",
      width: "75px",
      render: (s) => (
        <span className="font-monospace fw-semibold text-end d-block">
          {Number(s.kmvOrani || 0) > 0 ? `%${s.kmvOrani}` : "-"}
        </span>
      ),
    },
  ], []);

  // Temalandırma - DovizFisiPage ile birebir renkler:
  const isSatis = islemYonu === "satis";
  const activeFisThemeBg = isSatis ? "#fff1f2" : "#f0fdf4";
  const activeFisThemeBorder = isSatis ? "#dc2626" : "#16a34a";
  const activeFisThemeText = isSatis ? "#b91c1c" : "#15803d";
  const activeHeaderBg = isSatis
    ? "linear-gradient(135deg, #b91c1c 0%, #dc2626 100%)"
    : "linear-gradient(135deg, #15803d 0%, #16a34a 100%)";

  return (
    <>
      <Modal
        show={show}
        onHide={() => {
          if (lookupType !== null || showDetayModal) return;
          onClose();
        }}
        dialogClassName="modal-95w"
        size="xl"
        centered
        backdrop="static"
        keyboard={false}
        enforceFocus={false}
        restoreFocus={false}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Başlığı (Toolbar Center Badge & Header) */}
        <Modal.Header
          closeButton
          className="py-2 px-3 text-white border-0 shadow-sm"
          style={{ background: activeHeaderBg }}
        >
          <div className="d-flex align-items-center justify-content-between w-100 me-2">
            <div className="d-flex align-items-center gap-2">
              <IconArrowsExchange size={24} className="text-white" />
              <div>
                <Modal.Title className="fs-6 fw-bold text-white mb-0 d-flex align-items-center gap-2">
                  <span>E- {pageType === "sarraf" ? "Sarraf" : "Döviz"} Fişi Kayıt (ARBİTRAJ FİŞİ)</span>
                  <Badge bg="dark" className="text-white px-2 py-0.5 font-monospace" style={{ fontSize: "11px" }}>
                    F7
                  </Badge>
                </Modal.Title>
                <div style={{ fontSize: "11px", opacity: 0.9 }}>
                  Vezne: <strong>{vezneKod} - {vezneAd}</strong>
                </div>
              </div>
            </div>

            {/* Orta: DovizFisiPage ile Birebir Büyük Rozet */}
            <div className="d-flex align-items-center gap-2">
              <div
                style={{
                  border: isSatis ? "2px solid #dc2626" : "2px solid #16a34a",
                  backgroundColor: activeFisThemeBg,
                  color: activeFisThemeText,
                  fontWeight: 800,
                  fontSize: "13.5px",
                  letterSpacing: "3px",
                  minWidth: "180px",
                  padding: "4px 25px",
                  borderRadius: "6px",
                  height: "32px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: isSatis ? "0 1px 3px rgba(220, 38, 38, 0.2)" : "0 1px 3px rgba(22, 163, 74, 0.2)",
                  textAlign: "center",
                  textTransform: "uppercase",
                  userSelect: "none",
                }}
              >
                {isSatis ? "SATIŞ" : "ALIŞ"}
              </div>
            </div>
          </div>
        </Modal.Header>

        <Modal.Body className="p-3" style={{ fontSize: "12.5px", backgroundColor: "#f8fafc", position: "relative" }}>
          {saveMessage && (
            <Alert variant={saveMessage.type} className="py-2 px-3 mb-2.5 small d-flex align-items-center gap-2">
              {saveMessage.type === "success" ? <IconCheck size={16} /> : <IconX size={16} />}
              <span>{saveMessage.text}</span>
            </Alert>
          )}

          {/* ─── 1. ÜST FORM ALANLARI (DOVIZ FISI ILE BIREBIR 3 SUTUNLU PANEL) ──────────────── */}
          <Row className="g-2 mb-2.5">
            {/* 1. Sütun: Tarih/Saat, Geliş Nedeni, Kur Türü */}
            <Col xs={12} md={4}>
              <div
                className="border rounded-2 shadow-2xs h-100 d-flex flex-column gap-2"
                style={{
                  borderColor: "#cbd5e1",
                  padding: "12px 16px",
                  backgroundColor: activeFisThemeBg,
                }}
              >
                <div className="d-flex flex-row align-items-center gap-2">
                  <label
                    className="small fw-semibold mb-0 text-nowrap"
                    style={{ minWidth: "90px", width: "90px", flexShrink: 0, fontSize: "12.5px", color: "#334155" }}
                  >
                    Tarih / Saat
                  </label>
                  <div className="d-flex flex-grow-1 gap-1" style={{ minWidth: 0 }}>
                    <Form.Control
                      size="sm"
                      type="date"
                      value={tarih}
                      onChange={(e) => setTarih(e.target.value)}
                      className="px-2 py-1"
                      style={{ fontSize: "12.5px", borderColor: "#cbd5e1" }}
                    />
                    <Form.Control
                      size="sm"
                      type="text"
                      value={saat}
                      onChange={(e) => setSaat(e.target.value)}
                      style={{ width: "70px", fontSize: "12.5px", borderColor: "#cbd5e1" }}
                    />
                  </div>
                </div>

                <div className="d-flex flex-row align-items-center gap-2">
                  <label
                    className="small fw-semibold mb-0 text-nowrap"
                    style={{ minWidth: "90px", width: "90px", flexShrink: 0, fontSize: "12.5px", color: "#334155" }}
                  >
                    Geliş nedeni
                  </label>
                  <div className="flex-grow-1" style={{ minWidth: 0 }}>
                    <Form.Control
                      size="sm"
                      type="text"
                      value={gelisNedeni}
                      onChange={(e) => setGelisNedeni(e.target.value)}
                      className="px-2 py-1"
                      style={{ fontSize: "12.5px", borderColor: "#cbd5e1" }}
                    />
                  </div>
                </div>

                <div className="d-flex flex-row align-items-center gap-2">
                  <label
                    className="small fw-semibold mb-0 text-nowrap"
                    style={{ minWidth: "90px", width: "90px", flexShrink: 0, fontSize: "12.5px", color: "#334155" }}
                  >
                    Kur türü
                  </label>
                  <div className="flex-grow-1" style={{ minWidth: 0 }}>
                    <Form.Select
                      size="sm"
                      value={kurTuru}
                      onChange={(e) => handleKurTuruChange(Number(e.target.value))}
                      className="px-2 py-1 fw-bold"
                      style={{ fontSize: "12.5px", borderColor: "#cbd5e1" }}
                    >
                      <option value={0}>Efektif Kurları</option>
                      <option value={1}>Döviz Kurları</option>
                    </Form.Select>
                  </div>
                </div>
              </div>
            </Col>

            {/* 2. Sütun: Seri No, Cari Kodu, Müşteri Ünvanı, Fiş Tipi */}
            <Col xs={12} md={4}>
              <div
                className="border rounded-2 shadow-2xs h-100 d-flex flex-column gap-2"
                style={{
                  borderColor: "#cbd5e1",
                  padding: "12px 16px",
                  backgroundColor: activeFisThemeBg,
                }}
              >
                <div className="d-flex flex-row align-items-center gap-2">
                  <label
                    className="small fw-semibold mb-0 text-nowrap"
                    style={{ minWidth: "85px", width: "85px", flexShrink: 0, fontSize: "12.5px", color: "#334155" }}
                  >
                    Seri no
                  </label>
                  <div className="flex-grow-1" style={{ minWidth: 0 }}>
                    <Form.Control
                      size="sm"
                      type="text"
                      value={seriNo}
                      onChange={(e) => setSeriNo(e.target.value)}
                      placeholder="Seri no..."
                      className="px-2 py-1 font-monospace fw-bold"
                      style={{ fontSize: "12.5px", borderColor: "#cbd5e1" }}
                    />
                  </div>
                </div>

                <div className="d-flex flex-row align-items-center gap-2">
                  <label
                    className="small fw-semibold mb-0 text-nowrap"
                    style={{ minWidth: "85px", width: "85px", flexShrink: 0, fontSize: "12.5px", color: "#334155" }}
                  >
                    Cari kodu
                  </label>
                  <div className="flex-grow-1" style={{ minWidth: 0 }}>
                    <InputGroup size="sm">
                      <Form.Control
                        type="text"
                        value={cariKodu}
                        onChange={(e) => setCariKodu(e.target.value)}
                        onDoubleClick={() => {
                          setLookupSearchTerm(cariKodu);
                          setLookupType("cari");
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            setLookupSearchTerm(e.currentTarget.value);
                            setLookupType("cari");
                          }
                        }}
                        placeholder="Cari kodu..."
                        className="font-monospace fw-bold px-2 py-1"
                        style={{ fontSize: "12.5px", borderColor: "#cbd5e1" }}
                      />
                      <Button
                        variant="outline-secondary"
                        className="px-2 py-0 bg-white"
                        style={{ borderColor: "#cbd5e1" }}
                        onClick={() => {
                          setLookupSearchTerm(cariKodu);
                          setLookupType("cari");
                        }}
                        title="Cari Listesinden Seç (Dürbün)"
                      >
                        <IconBinoculars size={14} />
                      </Button>
                    </InputGroup>
                  </div>
                </div>

                <div className="d-flex flex-row align-items-center gap-2">
                  <label
                    className="small fw-semibold mb-0 text-nowrap"
                    style={{ minWidth: "85px", width: "85px", flexShrink: 0, fontSize: "12.5px", color: "#334155" }}
                  >
                    Müşteri
                  </label>
                  <div className="flex-grow-1" style={{ minWidth: 0 }}>
                    <InputGroup size="sm">
                      <Form.Control
                        type="text"
                        value={unvan}
                        onChange={(e) => setUnvan(e.target.value)}
                        onDoubleClick={() => {
                          setLookupSearchTerm(unvan === "İSİM BEYAN EDİLMEMİŞTİR" ? "" : unvan);
                          setLookupType("cari");
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            setLookupSearchTerm(e.currentTarget.value);
                            setLookupType("cari");
                          }
                        }}
                        placeholder="Müşteri Adı..."
                        className="fw-bold px-2 py-1"
                        style={{ fontSize: "12.5px", borderColor: "#cbd5e1" }}
                      />
                      <Button
                        variant="outline-secondary"
                        className="px-2 py-0 bg-white"
                        style={{ borderColor: "#cbd5e1" }}
                        onClick={() => {
                          setLookupSearchTerm(unvan === "İSİM BEYAN EDİLMEMİŞTİR" ? "" : unvan);
                          setLookupType("cari");
                        }}
                        title="Cari Listesinden Seç (Dürbün)"
                      >
                        <IconBinoculars size={14} />
                      </Button>
                      <Button
                        variant="outline-primary"
                        className="px-2 py-0 fw-bold d-flex align-items-center gap-1"
                        style={{ fontSize: "11px" }}
                        onClick={() => setShowDetayModal(true)}
                        title="Müşteri Detay Formu (F8)"
                      >
                        <IconUser size={13} /> F8
                      </Button>
                    </InputGroup>
                  </div>
                </div>

                <div className="d-flex flex-row align-items-center gap-2">
                  <label
                    className="small fw-semibold mb-0 text-nowrap"
                    style={{ minWidth: "85px", width: "85px", flexShrink: 0, fontSize: "12.5px", color: "#334155" }}
                  >
                    Fiş tipi
                  </label>
                  <div className="flex-grow-1" style={{ minWidth: 0 }}>
                    <Form.Select
                      id="arbitraj-fis-tip-select"
                      ref={tipSelectRef}
                      size="sm"
                      value={isSatis ? 1 : 0}
                      onChange={(e) => handleToggleIslemYonu(Number(e.target.value) === 1 ? "satis" : "alis")}
                      onKeyDown={(e) => {
                        if (e.key === " " || e.code === "Space") {
                          e.preventDefault();
                          handleToggleIslemYonu();
                        } else if (e.key === "Enter") {
                          e.preventDefault();
                          e.stopPropagation();
                          istatistikInputRef.current?.focus();
                          istatistikInputRef.current?.select();
                        }
                      }}
                      className="fw-bold text-uppercase px-2.5 py-1"
                      style={{
                        fontSize: "12.5px",
                        borderColor: activeFisThemeBorder,
                        color: activeFisThemeText,
                        backgroundColor: "#ffffff",
                      }}
                    >
                      <option value={0}>ALIŞ</option>
                      <option value={1}>SATIŞ</option>
                    </Form.Select>
                  </div>
                </div>
              </div>
            </Col>

            {/* 3. Sütun: Belge No, VKN/TCKN, İstatistik Kodu */}
            <Col xs={12} md={4}>
              <div
                className="border rounded-2 shadow-2xs h-100 d-flex flex-column gap-2"
                style={{
                  borderColor: "#cbd5e1",
                  padding: "12px 16px",
                  backgroundColor: activeFisThemeBg,
                }}
              >
                <div className="d-flex flex-row align-items-center gap-2">
                  <label
                    className="small fw-semibold mb-0 text-nowrap"
                    style={{ minWidth: "100px", width: "100px", flexShrink: 0, fontSize: "12.5px", color: "#334155" }}
                  >
                    Belge no
                  </label>
                  <div className="flex-grow-1" style={{ minWidth: 0 }}>
                    <Form.Control
                      size="sm"
                      type="text"
                      value={belgeNo}
                      onChange={(e) => setBelgeNo(e.target.value)}
                      className="px-2 py-1 font-monospace fw-bold"
                      style={{ fontSize: "12.5px", borderColor: "#cbd5e1" }}
                    />
                  </div>
                </div>

                <div className="d-flex flex-row align-items-center gap-2">
                  <label
                    className="small fw-semibold mb-0 text-nowrap"
                    style={{ minWidth: "100px", width: "100px", flexShrink: 0, fontSize: "12.5px", color: "#334155" }}
                  >
                    VKN / TCKN
                  </label>
                  <div className="flex-grow-1" style={{ minWidth: 0 }}>
                    <Form.Control
                      size="sm"
                      type="text"
                      value={formVknTckn}
                      onChange={(e) => setFormVknTckn(e.target.value)}
                      placeholder="VKN / TCKN..."
                      className="px-2 py-1 font-monospace"
                      style={{ fontSize: "12.5px", borderColor: "#cbd5e1" }}
                    />
                  </div>
                </div>

                <div className="d-flex flex-row align-items-center gap-2">
                  <label
                    className="small fw-semibold mb-0 text-nowrap"
                    style={{ minWidth: "100px", width: "100px", flexShrink: 0, fontSize: "12.5px", color: "#334155" }}
                  >
                    İstatistik kodu
                  </label>
                  <div className="flex-grow-1" style={{ minWidth: 0 }}>
                    <InputGroup size="sm">
                      <Form.Control
                        ref={istatistikInputRef}
                        id="arbitraj-istatistik-kod-input"
                        type="text"
                        value={istatistikKod}
                        isInvalid={!istatistikValidation.isValid}
                        onChange={(e) => {
                          const val = e.target.value;
                          setIstatistikKod(val);
                          const found = filteredStatList.find(
                            (s) => (s.kod || "").toLowerCase() === val.trim().toLowerCase()
                          );
                          if (found) {
                            setLines((prev) => applyStatisticRatesToLines(found, islemYonu, prev));
                          }
                        }}
                        onBlur={() => {
                          if (!istatistikValidation.isValid) {
                            setSaveMessage({
                              type: "danger",
                              text: istatistikValidation.errorMessage || "Geçersiz istatistik kodu!",
                            });
                          }
                        }}
                        onDoubleClick={() => {
                          setLookupSearchTerm(istatistikKod);
                          setLookupType("istatistik");
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            e.stopPropagation();
                            const val = e.currentTarget.value.trim();
                            const found = filteredStatList.find(
                              (s) => (s.kod || "").toLowerCase() === val.toLowerCase()
                            );
                            if (found) {
                              setLines((prev) => applyStatisticRatesToLines(found, islemYonu, prev));
                              const firstInput = document.querySelector(".arbitraj-table-code-input") as HTMLInputElement | null;
                              if (firstInput) {
                                firstInput.focus();
                                firstInput.select();
                              }
                            } else {
                              setLookupSearchTerm(val);
                              setLookupType("istatistik");
                            }
                          }
                        }}
                        placeholder="İstatistik Kodu..."
                        className="font-monospace fw-bold px-2 py-1"
                        style={{ fontSize: "12.5px", borderColor: !istatistikValidation.isValid ? "#dc2626" : "#cbd5e1" }}
                      />
                      <Button
                        variant="outline-secondary"
                        className="px-2 py-0 bg-white"
                        style={{ borderColor: !istatistikValidation.isValid ? "#dc2626" : "#cbd5e1" }}
                        onClick={() => {
                          setLookupSearchTerm(istatistikKod);
                          setLookupType("istatistik");
                        }}
                        title={`İstatistik Kodu Seç (Dürbün) - ${islemYonu === "alis" ? "Alış/Alış-Satış" : "Satış/Alış-Satış"}`}
                      >
                        <IconBinoculars size={14} />
                      </Button>
                    </InputGroup>
                    {activeStat && (
                      <div className="d-flex align-items-center gap-1.5 mt-0.5" style={{ fontSize: "11px" }}>
                        <span className="fw-semibold text-truncate text-secondary" style={{ maxWidth: "160px" }}>
                          {(activeStat as any).aciklama || (activeStat as any).ad || activeStat.kod}
                        </span>
                        {Number(activeStat.komisyonOrani || 0) > 0 && (
                          <span className="badge bg-primary-subtle text-primary border px-1 py-0" style={{ fontSize: "10px" }}>
                            Kom %{activeStat.komisyonOrani}
                          </span>
                        )}
                        {Number(activeStat.bmvOrani || 0) > 0 && (
                          <span className="badge bg-danger-subtle text-danger border px-1 py-0" style={{ fontSize: "10px" }}>
                            BMV %{activeStat.bmvOrani}
                          </span>
                        )}
                        {Number(activeStat.kmvOrani || 0) > 0 && (
                          <span className="badge bg-warning-subtle text-warning-emphasis border px-1 py-0" style={{ fontSize: "10px" }}>
                            KMV %{activeStat.kmvOrani}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Col>
          </Row>

          {/* ─── 2. SATIRLAR TABLOSU (DÖVİZ FİŞİ İLE BİREBİR KOLONLAR) ────────────────────── */}
          <Card className="mb-2.5 shadow-2xs border" style={{ borderColor: "#cbd5e1" }}>
            <Card.Header
              className="py-1.5 px-3 d-flex justify-content-between align-items-center border-bottom"
              style={{ backgroundColor: activeFisThemeBg }}
            >
              <div className="d-flex align-items-center gap-2">
                <span className="fw-bold small" style={{ color: activeFisThemeText }}>
                  {isSatis ? "Satılan Kalemler (Çıkış Bacağı)" : "Alınan Kalemler (Giriş Bacağı)"}
                </span>
                <Badge bg={isSatis ? "danger" : "success"} className="px-2 py-0.5">
                  {lines.length} Satır
                </Badge>
              </div>
            </Card.Header>
            <div className="table-responsive" style={{ maxHeight: "260px" }}>
              <Table bordered hover size="sm" className="mb-0 align-middle text-nowrap">
                <thead className="bg-light text-secondary small text-center">
                  <tr>
                    <th style={{ width: "35px" }}>#</th>
                    <th style={{ width: "130px" }}>Kod</th>
                    <th>Tanım / Adı</th>
                    <th style={{ width: "120px" }}>Miktar</th>
                    <th style={{ width: "120px" }}>{isSatis ? "Satış Kuru" : "Alış Kuru"}</th>
                    <th style={{ width: "135px" }}>Tutar (TL)</th>
                    <th style={{ width: "65px" }}>Kom %</th>
                    <th style={{ width: "90px" }}>Komisyon</th>
                    <th style={{ width: "65px" }}>BMV %</th>
                    <th style={{ width: "90px" }}>BMV</th>
                    <th style={{ width: "65px" }}>KMV %</th>
                    <th style={{ width: "90px" }}>KMV</th>
                    <th style={{ width: "40px" }}>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="text-center py-3 text-muted">
                        Arbitraj tablosu boştur.
                      </td>
                    </tr>
                  ) : (
                    lines.map((l, idx) => (
                      <tr key={l.id}>
                        <td className="text-center text-muted fw-bold small">{idx + 1}</td>
                        <td>
                          <InputGroup size="sm">
                            <Form.Control
                              id={`arb-cell-${idx}-kod`}
                              size="sm"
                              type="text"
                              value={l.kod}
                              onChange={(e) => handleUpdateLine(l.id, "kod", e.target.value.toUpperCase())}
                              onDoubleClick={() => {
                                setActiveLookupLineId(l.id);
                                activeLookupLineIndexRef.current = idx;
                                setLookupSearchTerm(l.kod);
                                setLookupType("currency");
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && (e.ctrlKey || e.altKey)) {
                                  e.preventDefault();
                                  if (idx >= lines.length - 1) {
                                    handleAddBlankLine();
                                    focusArbCell(idx + 1, "kod");
                                  } else {
                                    focusArbCell(idx + 1, "kod");
                                  }
                                  return;
                                }
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  const typed = (l.kod || e.currentTarget.value || "").trim().toUpperCase();
                                  if (!typed) {
                                    focusArbCell(idx, "miktar");
                                    return;
                                  }
                                  const matched = currencyList.filter(
                                    (c) => (c.kod || "").toUpperCase().includes(typed)
                                  );
                                  if (matched.length === 1) {
                                    handleSelectCurrencyForLine(l.id, matched[0]);
                                    focusArbCell(idx, "miktar");
                                  } else {
                                    setActiveLookupLineId(l.id);
                                    activeLookupLineIndexRef.current = idx;
                                    setLookupSearchTerm(typed);
                                    setLookupType("currency");
                                  }
                                } else if (e.key === "Tab" && !e.shiftKey) {
                                  e.preventDefault();
                                  focusArbCell(idx, "miktar");
                                } else if (e.key === "ArrowRight") {
                                  const el = e.currentTarget;
                                  if (el.selectionStart === el.value.length && el.selectionEnd === el.value.length) {
                                    e.preventDefault();
                                    focusArbCell(idx, "miktar");
                                  }
                                }
                              }}
                              placeholder="USD, EUR..."
                              className="fw-bold font-monospace text-primary arbitraj-table-code-input"
                              style={{ fontSize: "12px", height: "26px" }}
                            />
                            <Button
                              variant="outline-secondary"
                              size="sm"
                              tabIndex={-1}
                              className="px-1.5 py-0 bg-white"
                              onClick={() => {
                                setActiveLookupLineId(l.id);
                                activeLookupLineIndexRef.current = idx;
                                setLookupSearchTerm(l.kod);
                                setLookupType("currency");
                              }}
                              title="Döviz / Maden Seç (Dürbün)"
                            >
                              <IconBinoculars size={13} />
                            </Button>
                          </InputGroup>
                        </td>
                        <td className="px-2 text-dark small fw-semibold text-truncate align-middle" style={{ maxWidth: "160px" }} title={l.ad || l.kod}>
                          {l.ad || l.kod || "-"}
                        </td>
                        <td>
                          <Form.Control
                            id={`arb-cell-${idx}-miktar`}
                            size="sm"
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            className="text-end font-monospace fw-bold px-1.5"
                            style={{ fontSize: "12px", height: "26px" }}
                            value={l.miktar}
                            onChange={(e) => handleUpdateLine(l.id, "miktar", e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && (e.ctrlKey || e.altKey)) {
                                e.preventDefault();
                                if (idx >= lines.length - 1) {
                                  handleAddBlankLine();
                                  focusArbCell(idx + 1, "kod");
                                } else {
                                  focusArbCell(idx + 1, "kod");
                                }
                                return;
                              }
                              if (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) {
                                e.preventDefault();
                                focusArbCell(idx, "kur");
                              } else if (e.key === "ArrowLeft") {
                                const el = e.currentTarget;
                                if (el.selectionStart === 0 && el.selectionEnd === 0) {
                                  e.preventDefault();
                                  focusArbCell(idx, "kod");
                                }
                              } else if (e.key === "ArrowRight") {
                                const el = e.currentTarget;
                                if (el.selectionStart === el.value.length && el.selectionEnd === el.value.length) {
                                  e.preventDefault();
                                  focusArbCell(idx, "kur");
                                }
                              }
                            }}
                          />
                        </td>
                        <td>
                          <Form.Control
                            id={`arb-cell-${idx}-kur`}
                            size="sm"
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            className="text-end font-monospace fw-bold text-dark px-1.5"
                            style={{ fontSize: "12px", height: "26px" }}
                            value={l.kur}
                            onChange={(e) => handleUpdateLine(l.id, "kur", e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && (e.ctrlKey || e.altKey)) {
                                e.preventDefault();
                                if (idx >= lines.length - 1) {
                                  handleAddBlankLine();
                                  focusArbCell(idx + 1, "kod");
                                } else {
                                  focusArbCell(idx + 1, "kod");
                                }
                                return;
                              }
                              if (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) {
                                e.preventDefault();
                                focusArbCell(idx, "tutar");
                              } else if (e.key === "ArrowLeft") {
                                const el = e.currentTarget;
                                if (el.selectionStart === 0 && el.selectionEnd === 0) {
                                  e.preventDefault();
                                  focusArbCell(idx, "miktar");
                                }
                              } else if (e.key === "ArrowRight") {
                                const el = e.currentTarget;
                                if (el.selectionStart === el.value.length && el.selectionEnd === el.value.length) {
                                  e.preventDefault();
                                  focusArbCell(idx, "tutar");
                                }
                              }
                            }}
                          />
                        </td>
                        <td>
                          <Form.Control
                            id={`arb-cell-${idx}-tutar`}
                            size="sm"
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            className="text-end font-monospace fw-bold px-1.5"
                            style={{ fontSize: "12px", height: "26px", color: isSatis ? "#dc2626" : "#16a34a" }}
                            value={l.tutar}
                            onChange={(e) => handleUpdateLine(l.id, "tutar", e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && (e.ctrlKey || e.altKey)) {
                                e.preventDefault();
                                if (idx >= lines.length - 1) {
                                  handleAddBlankLine();
                                  focusArbCell(idx + 1, "kod");
                                } else {
                                  focusArbCell(idx + 1, "kod");
                                }
                                return;
                              }
                              if (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) {
                                e.preventDefault();
                                focusArbCell(idx, "komisyonOrani");
                              } else if (e.key === "ArrowLeft") {
                                const el = e.currentTarget;
                                if (el.selectionStart === 0 && el.selectionEnd === 0) {
                                  e.preventDefault();
                                  focusArbCell(idx, "kur");
                                }
                              } else if (e.key === "ArrowRight") {
                                const el = e.currentTarget;
                                if (el.selectionStart === el.value.length && el.selectionEnd === el.value.length) {
                                  e.preventDefault();
                                  focusArbCell(idx, "komisyonOrani");
                                }
                              }
                            }}
                          />
                        </td>
                        <td>
                          <Form.Control
                            id={`arb-cell-${idx}-komisyonOrani`}
                            size="sm"
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            className="text-center font-monospace px-1"
                            style={{ fontSize: "12px", height: "26px" }}
                            value={l.komisyonOrani || ""}
                            onChange={(e) => handleUpdateLine(l.id, "komisyonOrani", e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) {
                                e.preventDefault();
                                focusArbCell(idx, "bmvOrani");
                              } else if (e.key === "ArrowLeft") {
                                const el = e.currentTarget;
                                if (el.selectionStart === 0 && el.selectionEnd === 0) {
                                  e.preventDefault();
                                  focusArbCell(idx, "tutar");
                                }
                              } else if (e.key === "ArrowRight") {
                                const el = e.currentTarget;
                                if (el.selectionStart === el.value.length && el.selectionEnd === el.value.length) {
                                  e.preventDefault();
                                  focusArbCell(idx, "bmvOrani");
                                }
                              }
                            }}
                          />
                        </td>
                        <td>
                          <Form.Control
                            size="sm"
                            readOnly
                            tabIndex={-1}
                            className="text-end font-monospace px-1.5 bg-light"
                            style={{ fontSize: "12px", height: "26px" }}
                            value={l.komisyon || ""}
                          />
                        </td>
                        <td>
                          <Form.Control
                            id={`arb-cell-${idx}-bmvOrani`}
                            size="sm"
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            className="text-center font-monospace px-1"
                            style={{ fontSize: "12px", height: "26px" }}
                            value={l.bmvOrani || ""}
                            onChange={(e) => handleUpdateLine(l.id, "bmvOrani", e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) {
                                e.preventDefault();
                                focusArbCell(idx, "kmvOrani");
                              } else if (e.key === "ArrowLeft") {
                                const el = e.currentTarget;
                                if (el.selectionStart === 0 && el.selectionEnd === 0) {
                                  e.preventDefault();
                                  focusArbCell(idx, "komisyonOrani");
                                }
                              } else if (e.key === "ArrowRight") {
                                const el = e.currentTarget;
                                if (el.selectionStart === el.value.length && el.selectionEnd === el.value.length) {
                                  e.preventDefault();
                                  focusArbCell(idx, "kmvOrani");
                                }
                              }
                            }}
                          />
                        </td>
                        <td>
                          <Form.Control
                            size="sm"
                            readOnly
                            tabIndex={-1}
                            className="text-end font-monospace px-1.5 bg-light"
                            style={{ fontSize: "12px", height: "26px" }}
                            value={l.bmv || ""}
                          />
                        </td>
                        <td>
                          <Form.Control
                            id={`arb-cell-${idx}-kmvOrani`}
                            size="sm"
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            className="text-center font-monospace px-1"
                            style={{ fontSize: "12px", height: "26px" }}
                            value={l.kmvOrani || ""}
                            onChange={(e) => handleUpdateLine(l.id, "kmvOrani", e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) {
                                e.preventDefault();
                                if (idx >= lines.length - 1) {
                                  handleAddBlankLine();
                                  focusArbCell(idx + 1, "kod");
                                } else {
                                  focusArbCell(idx + 1, "kod");
                                }
                              } else if (e.key === "ArrowLeft") {
                                const el = e.currentTarget;
                                if (el.selectionStart === 0 && el.selectionEnd === 0) {
                                  e.preventDefault();
                                  focusArbCell(idx, "bmvOrani");
                                }
                              }
                            }}
                          />
                        </td>
                        <td>
                          <Form.Control
                            size="sm"
                            readOnly
                            tabIndex={-1}
                            className="text-end font-monospace px-1.5 bg-light"
                            style={{ fontSize: "12px", height: "26px" }}
                            value={l.kmv || ""}
                          />
                        </td>
                        <td className="text-center">
                          <Button
                            variant="outline-danger"
                            size="sm"
                            className="p-0.5 border-0"
                            onClick={() => handleRemoveLine(l.id)}
                            title="Satırı Sil"
                          >
                            <IconTrash size={14} />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
            </div>
          </Card>

          {/* ─── 3. ALT TOPLAM, MASRAF VE ARBİTRAJ DENGESİ ───────────────────────────────── */}
          <Card className="border shadow-2xs" style={{ borderColor: "#cbd5e1", backgroundColor: "#ffffff" }}>
            <Card.Body className="p-2.5">
              <Row className="g-2 align-items-center">
                {/* Sol Sütun: 1. Satır: Arka Fiş Tutarı & 2. Satır: Müşteriden Alınacak / Müşteriye Verilecek */}
                <Col md={6}>
                  <div className="d-flex flex-column gap-1.5 p-2 rounded bg-light border" style={{ borderColor: "#e2e8f0" }}>
                    {/* 1. Satır: Arka Fiş Tutarı */}
                    <div className="d-flex align-items-center justify-content-between">
                      <span className="small fw-bold text-secondary">
                        Arka Fiş Tutarı ({fisTip === 0 ? "Alış / Ödenecek" : "Satış / Alınacak"}):
                      </span>
                      <span className="font-monospace fw-bold text-dark" style={{ fontSize: "13px" }}>
                        {Number(hedefTlTutar || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL
                      </span>
                    </div>

                    {/* 2. Satır: Alınacak / Verilecek Tutar (Fark) ve Dengeleme */}
                    <div className="d-flex align-items-center justify-content-between pt-1 border-top" style={{ borderColor: "#cbd5e1" }}>
                      <div className="d-flex align-items-center gap-1.5">
                        <span
                          className="small fw-bold"
                          style={{
                            color:
                              netDenge.tip === "alinacak"
                                ? "#dc2626"
                                : netDenge.tip === "verilecek"
                                ? "#16a34a"
                                : "#475569",
                          }}
                        >
                          {netDenge.label}
                        </span>
                        {netDenge.tip !== "esit" && (
                          <Button
                            size="sm"
                            variant="outline-primary"
                            className="py-0 px-1.5 fw-semibold d-inline-flex align-items-center gap-1 shadow-2xs"
                            style={{ fontSize: "10.5px", height: "20px" }}
                            onClick={handleAutoBalance}
                            title="Hedef TL tutarına göre miktarı otomatik dengele (Farkı sıfırla)"
                          >
                            <IconScale size={12} /> Dengele
                          </Button>
                        )}
                      </div>
                      <div>
                        {netDenge.tip === "esit" ? (
                          <Badge bg="success" className="px-2 py-1 fw-bold d-flex align-items-center gap-1">
                            <IconCheck size={13} /> 0.00 TL (Tam Eşit)
                          </Badge>
                        ) : (
                          <span
                            className="font-monospace fw-bold"
                            style={{
                              fontSize: "13.5px",
                              color: netDenge.tip === "alinacak" ? "#dc2626" : "#16a34a",
                            }}
                          >
                            {netDenge.netTutar.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Col>

                {/* Sağ Sütun: Toplam Tutar, Toplam Masraf, Ödenecek / Alınacak TL */}
                <Col md={6}>
                  <div className="d-flex align-items-center justify-content-end gap-2 flex-wrap">
                    <div className="d-flex align-items-center gap-1">
                      <span className="small fw-bold text-secondary text-nowrap" style={{ fontSize: "11.5px" }}>Toplam Tutar:</span>
                      <Form.Control
                        size="sm"
                        readOnly
                        tabIndex={-1}
                        className="text-end font-monospace fw-bold bg-light"
                        style={{ width: "110px", fontSize: "12px" }}
                        value={`${totalTutar.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL`}
                      />
                    </div>

                    <div className="d-flex align-items-center gap-1">
                      <span className="small fw-bold text-secondary text-nowrap" style={{ fontSize: "11.5px" }}>Toplam Masraf:</span>
                      <Form.Control
                        size="sm"
                        readOnly
                        tabIndex={-1}
                        className="text-end font-monospace fw-bold bg-light text-muted"
                        style={{ width: "95px", fontSize: "12px" }}
                        value={`${totalMasraf.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL`}
                      />
                    </div>

                    <div className="d-flex align-items-center gap-1">
                      <span className="small fw-bold text-nowrap" style={{ color: activeFisThemeText, fontSize: "12px" }}>
                        {isSatis ? "Alınacak TL:" : "Ödenecek TL:"}
                      </span>
                      <Form.Control
                        size="sm"
                        readOnly
                        tabIndex={-1}
                        className="text-end font-monospace fw-bold"
                        style={{
                          width: "125px",
                          fontSize: "12.5px",
                          borderColor: activeFisThemeBorder,
                          backgroundColor: activeFisThemeBg,
                          color: activeFisThemeText,
                        }}
                        value={`${sonToplam.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL`}
                      />
                    </div>
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Modal.Body>

        {/* ─── 4. MODAL FOOTER & KISAYOL ÇUBUĞU (DOVİZ FİŞİ ILE BİREBİR) ────────────────────── */}
        <Modal.Footer className="py-2 px-3 bg-white border-top d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-3">
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={() => setShowDetayModal(true)}
              className="fw-bold px-3 d-flex align-items-center gap-1.5"
            >
              <IconUser size={15} />
              <span>[F8] Müşteri Detay</span>
            </Button>
            <span className="text-muted small">
              <kbd>F1</kbd> Kaydet | <kbd>F8</kbd> Detay | <kbd>F9</kbd> Yazdır | <kbd>F10</kbd> Kaydet & Yazdır | <kbd>ESC</kbd> Vazgeç
            </span>
          </div>

          <div className="d-flex align-items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose} className="fw-semibold px-3">
              <IconX size={15} className="me-1" /> [ESC] Vazgeç
            </Button>

            <Button
              variant="outline-secondary"
              size="sm"
              className="fw-bold px-3 shadow-2xs d-flex align-items-center gap-1.5"
              onClick={handleOpenPrintModal}
              disabled={isSaving || totalTutar <= 0}
              title="Arbitraj fişini yazdırma modalından incele ve yazdır [F9]"
            >
              <IconPrinter size={16} />
              <span>[F9] Yazdır</span>
            </Button>

            <Button
              variant="outline-primary"
              size="sm"
              className="fw-bold px-3 shadow-2xs d-flex align-items-center gap-1.5"
              onClick={() => handleSaveArbitraj(false)}
              disabled={isSaving || totalTutar <= 0}
              title="Arbitraj fişini doğrudan kaydet [F1]"
            >
              <IconDeviceFloppy size={16} />
              <span>[F1] Kaydet</span>
            </Button>

            <Button
              variant={isSatis ? "danger" : "success"}
              size="sm"
              className="fw-bold px-4 shadow-2xs d-flex align-items-center gap-1.5"
              onClick={() => handleSaveArbitraj(true)}
              disabled={isSaving || totalTutar <= 0}
              title="Arbitraj fişini kaydet ve yazdır [F10]"
            >
              <IconPrinter size={16} />
              <span>[F10] Kaydet & Yazdır</span>
            </Button>
          </div>
        </Modal.Footer>
      </Modal>

      {/* ─── F8) DETAY MODAL (MÜŞTERİ & KİMLİK FORMU) ─────────────────────────────────────── */}
      <Modal
        show={showDetayModal}
        onHide={() => setShowDetayModal(false)}
        size="lg"
        centered
        backdrop="static"
        keyboard={false}
        style={{ zIndex: 1060 }}
      >
        <Modal.Header closeButton className="py-2 px-3 bg-light border-bottom">
          <Modal.Title className="fs-6 fw-bold text-dark d-flex align-items-center gap-2">
            <IconUser size={18} className="text-primary" />
            <span>Müşteri Detay & Kimlik Formu (F8)</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3" style={{ fontSize: "12.5px" }}>
          <div className="d-flex align-items-center gap-2 mb-3 pb-2 border-bottom">
            <span className="fw-semibold text-secondary text-nowrap" style={{ minWidth: "90px" }}>
              Ünvan / Ad
            </span>
            <Form.Control
              type="text"
              size="sm"
              className="fw-bold"
              value={unvan}
              onChange={(e) => setUnvan(e.target.value)}
              placeholder="Müşteri Ünvanı / Adı..."
            />
          </div>

          <Row className="g-3">
            {/* Sol Sütun */}
            <Col md={6}>
              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "115px" }}>
                  Cari tipi
                </span>
                <Form.Select
                  size="sm"
                  value={detayCariTipi}
                  onChange={(e) => setDetayCariTipi(e.target.value)}
                >
                  <option value="Şahıs">Şahıs</option>
                  <option value="Firma">Firma / Şirket</option>
                </Form.Select>
              </div>

              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "115px" }}>
                  Yetkili kişi
                </span>
                <Form.Control
                  size="sm"
                  type="text"
                  value={detayYetkiliKisi}
                  onChange={(e) => setDetayYetkiliKisi(e.target.value)}
                  placeholder="Yetkili Kişi..."
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "115px" }}>
                  Ülke / Uyruk
                </span>
                <div className="d-flex gap-1 flex-grow-1">
                  <Form.Control
                    size="sm"
                    type="text"
                    value={detayUlke}
                    onChange={(e) => setDetayUlke(e.target.value)}
                    placeholder="Ülke"
                  />
                  <Form.Control
                    size="sm"
                    type="text"
                    value={detayUyruk}
                    onChange={(e) => setDetayUyruk(e.target.value)}
                    placeholder="Uyruk"
                  />
                </div>
              </div>

              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "115px" }}>
                  Pasaport no
                </span>
                <Form.Control
                  size="sm"
                  type="text"
                  value={detayPasaportNo}
                  onChange={(e) => setDetayPasaportNo(e.target.value)}
                  placeholder="Pasaport No..."
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "115px" }}>
                  Geçerlilik tarihi
                </span>
                <Form.Control
                  size="sm"
                  type="date"
                  value={detayGecerlilikTarihi}
                  onChange={(e) => setDetayGecerlilikTarihi(e.target.value)}
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "115px" }}>
                  Vergi dairesi
                </span>
                <Form.Control
                  size="sm"
                  type="text"
                  value={detayVergiDairesi}
                  onChange={(e) => setDetayVergiDairesi(e.target.value)}
                  placeholder="Vergi Dairesi..."
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "115px" }}>
                  Meslek
                </span>
                <Form.Control
                  size="sm"
                  type="text"
                  value={detayMeslek}
                  onChange={(e) => setDetayMeslek(e.target.value)}
                  placeholder="Meslek..."
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "115px" }}>
                  Hukuki yapı
                </span>
                <Form.Control
                  size="sm"
                  type="text"
                  value={detayHukukiYapi}
                  onChange={(e) => setDetayHukukiYapi(e.target.value)}
                  placeholder="Hukuki Yapı..."
                />
              </div>
            </Col>

            {/* Sağ Sütun */}
            <Col md={6}>
              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "115px" }}>
                  VKN / TCKN
                </span>
                <Form.Control
                  size="sm"
                  type="text"
                  className="font-monospace fw-bold"
                  value={formVknTckn}
                  onChange={(e) => setFormVknTckn(e.target.value)}
                  placeholder="TCKN veya VKN..."
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "115px" }}>
                  Kimlik seri no
                </span>
                <Form.Control
                  size="sm"
                  type="text"
                  value={detayKimlikSeriNo}
                  onChange={(e) => setDetayKimlikSeriNo(e.target.value)}
                  placeholder="Kimlik Seri No..."
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "115px" }}>
                  Doğum tarihi / yeri
                </span>
                <div className="d-flex gap-1 flex-grow-1">
                  <Form.Control
                    size="sm"
                    type="date"
                    value={detayDogumTarihi}
                    onChange={(e) => setDetayDogumTarihi(e.target.value)}
                  />
                  <Form.Control
                    size="sm"
                    type="text"
                    value={detayDogumYeri}
                    onChange={(e) => setDetayDogumYeri(e.target.value)}
                    placeholder="Doğum Yeri"
                  />
                </div>
              </div>

              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "115px" }}>
                  Baba / Anne adı
                </span>
                <div className="d-flex gap-1 flex-grow-1">
                  <Form.Control
                    size="sm"
                    type="text"
                    value={detayBabaAdi}
                    onChange={(e) => setDetayBabaAdi(e.target.value)}
                    placeholder="Baba Adı"
                  />
                  <Form.Control
                    size="sm"
                    type="text"
                    value={detayAnneAdi}
                    onChange={(e) => setDetayAnneAdi(e.target.value)}
                    placeholder="Anne Adı"
                  />
                </div>
              </div>

              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "115px" }}>
                  Telefon / E-posta
                </span>
                <div className="d-flex gap-1 flex-grow-1">
                  <Form.Control
                    size="sm"
                    type="text"
                    value={detayTelefon}
                    onChange={(e) => setDetayTelefon(e.target.value)}
                    placeholder="Telefon"
                  />
                  <Form.Control
                    size="sm"
                    type="email"
                    value={detayEposta}
                    onChange={(e) => setDetayEposta(e.target.value)}
                    placeholder="E-posta"
                  />
                </div>
              </div>

              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "115px" }}>
                  İl / İlçe
                </span>
                <div className="d-flex gap-1 flex-grow-1">
                  <Form.Control
                    size="sm"
                    type="text"
                    value={detayIl}
                    onChange={(e) => setDetayIl(e.target.value)}
                    placeholder="İl"
                  />
                  <Form.Control
                    size="sm"
                    type="text"
                    value={detayIlce}
                    onChange={(e) => setDetayIlce(e.target.value)}
                    placeholder="İlçe"
                  />
                </div>
              </div>

              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "115px" }}>
                  Adres
                </span>
                <Form.Control
                  size="sm"
                  as="textarea"
                  rows={2}
                  value={detayAdres}
                  onChange={(e) => setDetayAdres(e.target.value)}
                  placeholder="Açık Adres..."
                />
              </div>
            </Col>
          </Row>

          {/* Vekil Bilgileri */}
          <div className="mt-3 pt-2 border-top">
            <Row className="g-2 align-items-center">
              <Col md={3}>
                <div className="d-flex align-items-center">
                  <span className="text-secondary small text-nowrap me-2" style={{ width: "80px" }}>
                    Vekil durumu
                  </span>
                  <Form.Select
                    size="sm"
                    value={detayVekil}
                    onChange={(e) => setDetayVekil(e.target.value)}
                  >
                    <option value="Yok">Yok</option>
                    <option value="Var">Var (Temsilen)</option>
                  </Form.Select>
                </div>
              </Col>
              {detayVekil === "Var" && (
                <>
                  <Col md={3}>
                    <Form.Control
                      size="sm"
                      type="text"
                      value={detayVekilAdi}
                      onChange={(e) => setDetayVekilAdi(e.target.value)}
                      placeholder="Vekil / Temsilci Adı..."
                    />
                  </Col>
                  <Col md={3}>
                    <Form.Control
                      size="sm"
                      type="text"
                      className="font-monospace"
                      value={detayVekilKimlikNo}
                      onChange={(e) => setDetayVekilKimlikNo(e.target.value)}
                      placeholder="Vekil TCKN / Pasaport..."
                    />
                  </Col>
                  <Col md={3}>
                    <Form.Select
                      size="sm"
                      value={detayVekilTipi}
                      onChange={(e) => setDetayVekilTipi(e.target.value)}
                    >
                      <option value="Şahıs">Şahıs</option>
                      <option value="Firma">Firma</option>
                    </Form.Select>
                  </Col>
                </>
              )}
            </Row>
          </div>
        </Modal.Body>
        <Modal.Footer className="py-2 px-3 bg-light border-top d-flex justify-content-between">
          <Button variant="secondary" size="sm" onClick={() => setShowDetayModal(false)}>
            Vazgeç
          </Button>
          <Button
            variant="primary"
            size="sm"
            className="fw-bold px-3"
            onClick={() => setShowDetayModal(false)}
          >
            <IconCheck size={16} className="me-1" /> Detayları Uygula & Kapat
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ─── 1) DÖVİZ / PARA SEÇİM MODALI (LOOKUP MODAL) ────────────────────────────────── */}
      <LookupModal<ArbitrajCurrencyItem>
        show={lookupType === "currency"}
        onHide={() => {
          setLookupType(null);
          let rIdx = activeLookupLineIndexRef.current;
          if (rIdx === null || rIdx === undefined) {
            rIdx = lines.findIndex((l) => l.id === activeLookupLineId);
          }
          if (rIdx !== null && rIdx !== undefined && rIdx >= 0) {
            setTimeout(() => focusArbCell(rIdx, "kod"), 60);
          }
        }}
        title="Para / Döviz / Maden Seçimi"
        items={currencyList}
        columns={currencyColumns}
        initialSearchTerm={lookupSearchTerm}
        filterFn={(item, term) => {
          const t = term.toLowerCase().trim();
          if (!t) return true;
          return (
            (item.kod || "").toLowerCase().includes(t) ||
            (item.ad || "").toLowerCase().includes(t)
          );
        }}
        onSelect={(item) => {
          const lineId = activeLookupLineId;
          let rIdx = activeLookupLineIndexRef.current;
          if (rIdx === null || rIdx === undefined) {
            rIdx = lines.findIndex((l) => l.id === lineId);
            if (rIdx === -1) rIdx = 0;
          }
          if (lineId) {
            handleSelectCurrencyForLine(lineId, item);
          }
          setLookupType(null);
          if (rIdx !== null && rIdx !== undefined && rIdx >= 0) {
            setTimeout(() => focusArbCell(rIdx, "miktar"), 60);
          }
        }}
      />

      {/* ─── 2) CARİ HESAP SEÇİM MODALI (LOOKUP MODAL) ──────────────────────────────────── */}
      <LookupModal<CariKartItem>
        show={lookupType === "cari"}
        onHide={() => setLookupType(null)}
        title="Cari Hesap Seçimi"
        items={localCariList}
        columns={cariColumns}
        initialSearchTerm={lookupSearchTerm}
        filterFn={(c, term) => {
          const t = term.toLowerCase().trim();
          if (!t) return true;
          return (
            (c.kod || "").toLowerCase().includes(t) ||
            (c.ad || "").toLowerCase().includes(t) ||
            (c.vergiKimlikNo || "").toLowerCase().includes(t) ||
            (c.telefon || "").toLowerCase().includes(t)
          );
        }}
        onSelect={(c) => {
          handleSelectCari(c);
          setLookupType(null);
        }}
      />

      {/* ─── 3) İSTATİSTİK KODU SEÇİM MODALI (LOOKUP MODAL) ─────────────────────────────── */}
      <LookupModal<StatisticItem>
        show={lookupType === "istatistik"}
        onHide={() => setLookupType(null)}
        title={`İstatistik Kodu Seçimi (${islemYonu === "alis" ? "Alış Fişi - Sadece Alış ve Alış-Satış Kodları" : "Satış Fişi - Sadece Satış ve Alış-Satış Kodları"})`}
        items={filteredStatList}
        columns={istatistikColumns}
        initialSearchTerm={lookupSearchTerm}
        filterFn={(s, term) => {
          const t = term.toLowerCase().trim();
          if (!t) return true;
          return (
            (s.kod || "").toLowerCase().includes(t) ||
            ((s as any).aciklama || (s as any).ad || (s as any).tanim || "").toLowerCase().includes(t)
          );
        }}
        onSelect={(s) => {
          setIstatistikKod(s.kod);
          setLookupType(null);
          setLines((prev) => applyStatisticRatesToLines(s, islemYonu, prev));
          setTimeout(() => {
            const firstInput = document.querySelector(".arbitraj-table-code-input") as HTMLInputElement | null;
            if (firstInput) {
              firstInput.focus();
              firstInput.select();
            }
          }, 50);
        }}
      />
    </>
  );
};

export default ArbitrajModal;
