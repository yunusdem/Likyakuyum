import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  Card,
  Row,
  Col,
  Form,
  Button,
  Table,
  Badge,
  Alert,
  InputGroup,
  Modal,
  Dropdown,
  Spinner,
} from "react-bootstrap";
import {
  IconFileText,
  IconCheck,
  IconTrash,
  IconUser,
  IconBinoculars,
  IconPaperclip,
  IconWorld,
  IconLock,
  IconAlertTriangle,
  IconShieldCheck,
  IconShieldExclamation,
  IconShield,
  IconSearch,
  IconAlertCircle,
  IconArrowsExchange,
} from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import LookupModal, { LookupColumn } from "../../components/common/LookupModal";
import { MasakService, MasakEslesme } from "../../services/masakService";
import { MasakSonucModal } from "../../components/masak/MasakSonucModal";
import MasakModal from "../../components/masak/MasakModal";
import { DovizFisiPrintModal } from "./DovizFisiPrintModal";
import { PrinterService, YaziciItem } from "../../services/printerService";
import { resolveEffectivePrinter } from "../../utils/printerResolver";
import { IstatistikSecimModal } from "./IstatistikSecimModal";
import { MusteriSecimModal, SelectedCustomerResult, CustomerSearchField } from "./MusteriSecimModal";
import { KurListesiModal } from "./KurListesiModal";
import { VezneBakiyeModal } from "./VezneBakiyeModal";
import { CashDeskService } from "../../services/cashDeskService";
import { FastLookupCache } from "../../services/fastLookupCache";
import { TlHesabiModal } from "./TlHesabiModal";
import { ArbitrajModal, ArbitrajApplyResult } from "./ArbitrajModal";
import { ParaSaymaModal, ParaSaymaCurrencyItem } from "./ParaSaymaModal";
import { CompanyService, TodvzTanimDto } from "../../services/companyService";
import { CariService, CariKartItem } from "../../services/cariService";
import { apiClient } from "../../services/apiClient";
import { KurService, KurRowItem } from "../../services/kurService";
import { StatisticService, StatisticItem } from "../../services/statisticService";
import {
  DovizFisService,
  DovizFisModel,
  DovizFisListItem,
  SaveDovizFisPayload,
  VezneBakiyeDetailItem,
  IstatistikSecimItem,
  KayitsizMusteriItem,
} from "../../services/dovizFisService";
import { useAuth } from "../../context/AuthContext";
import { getUrunTipiInfo } from "./SarrafFisiPage";
import { triggerSilentPrint } from "../../services/silentPrintService";
import { generateDovizReceiptHtml } from "../../utils/receiptHtmlGenerator";
import { onlyDecimal, blockNonNumericKeys, parseDecimal, formatMiktar } from "../../utils/numericInput";
import { useEBankaFisKesimi } from "../ebanka/useEBankaFisKesimi";
import { ebelgeService } from "../../services/ebelgeService";
import { triggerAdjacentBinoculars } from "../../utils/shortcutUtils";

interface VezneItem {
  id: number;
  kod: string;
  ad: string;
}

export interface ParaItem {
  id: number;
  kod: string;
  ad: string;
  parite?: number;
  dovizAlis?: number;
  dovizSatis?: number;
  efektifAlis?: number;
  efektifSatis?: number;
}

interface GridLineItem {
  id: string;
  satirNo: number;
  paraId: number;
  paraKodu: string;
  paraAdi: string;
  miktar: number | string;
  kur: number | string;
  komisyonOrani: number | string;
  komisyon: number | string;
  bmvOrani: number | string;
  bmv: number | string;
  kmvOrani: number | string;
  kmv: number | string;
  tutar: number | string;
}

const parseMiktar = (val: any): number => parseDecimal(val);
const parseKur = (val: any): number => parseDecimal(val);

const DEFAULT_POSTA_KODLARI = [
  { id: 34110, kod: "34110", ad: "Kapalıçarşı / Fatih", il: "İstanbul", ilce: "Fatih" },
  { id: 34000, kod: "34000", ad: "Merkez / Eminönü", il: "İstanbul", ilce: "Fatih" },
  { id: 34380, kod: "34380", ad: "Mecidiyeköy / Şişli", il: "İstanbul", ilce: "Şişli" },
  { id: 34710, kod: "34710", ad: "Moda / Kadıköy", il: "İstanbul", ilce: "Kadıköy" },
  { id: 34149, kod: "34149", ad: "Yeşilköy / Bakırköy", il: "İstanbul", ilce: "Bakırköy" },
  { id: 34330, kod: "34330", ad: "Levent / Beşiktaş", il: "İstanbul", ilce: "Beşiktaş" },
  { id: 34430, kod: "34430", ad: "Beyoğlu / Taksim", il: "İstanbul", ilce: "Beyoğlu" },
  { id: 34660, kod: "34660", ad: "Üsküdar Merkez", il: "İstanbul", ilce: "Üsküdar" },
  { id: 6000, kod: "06000", ad: "Ulus / Altındağ", il: "Ankara", ilce: "Altındağ" },
  { id: 6680, kod: "06680", ad: "Kızılay / Çankaya", il: "Ankara", ilce: "Çankaya" },
  { id: 6370, kod: "06370", ad: "Ostim / Yenimahalle", il: "Ankara", ilce: "Yenimahalle" },
  { id: 35000, kod: "35000", ad: "Alsancak / Konak", il: "İzmir", ilce: "Konak" },
  { id: 35100, kod: "35100", ad: "Bornova Merkez", il: "İzmir", ilce: "Bornova" },
  { id: 35530, kod: "35530", ad: "Karşıyaka Çarşı", il: "İzmir", ilce: "Karşıyaka" },
  { id: 7000, kod: "07000", ad: "Kaleiçi / Muratpaşa", il: "Antalya", ilce: "Muratpaşa" },
  { id: 7100, kod: "07100", ad: "Konyaaltı Sahil", il: "Antalya", ilce: "Konyaaltı" },
  { id: 16010, kod: "16010", ad: "Heykel / Osmangazi", il: "Bursa", ilce: "Osmangazi" },
  { id: 16130, kod: "16130", ad: "Nilüfer Merkez", il: "Bursa", ilce: "Nilüfer" },
  { id: 1000, kod: "01000", ad: "Seyhan Merkez", il: "Adana", ilce: "Seyhan" },
  { id: 27000, kod: "27000", ad: "Şahinbey Merkez", il: "Gaziantep", ilce: "Şahinbey" },
  { id: 42000, kod: "42000", ad: "Selçuklu Merkez", il: "Konya", ilce: "Selçuklu" },
  { id: 48000, kod: "48000", ad: "Menteşe / Muğla", il: "Muğla", ilce: "Menteşe" },
  { id: 48400, kod: "48400", ad: "Bodrum Merkez", il: "Muğla", ilce: "Bodrum" },
  { id: 48300, kod: "48300", ad: "Fethiye Merkez", il: "Muğla", ilce: "Fethiye" },
  { id: 61000, kod: "61000", ad: "Ortahisar Merkez", il: "Trabzon", ilce: "Ortahisar" },
];

const DEFAULT_ILCELER = [
  // İstanbul
  { id: 1001, kod: "FAT", ad: "Fatih", ilAdi: "İstanbul", ustId: 34 },
  { id: 1002, kod: "KAD", ad: "Kadıköy", ilAdi: "İstanbul", ustId: 34 },
  { id: 1003, kod: "SIS", ad: "Şişli", ilAdi: "İstanbul", ustId: 34 },
  { id: 1004, kod: "BES", ad: "Beşiktaş", ilAdi: "İstanbul", ustId: 34 },
  { id: 1005, kod: "BAK", ad: "Bakırköy", ilAdi: "İstanbul", ustId: 34 },
  { id: 1006, kod: "BEY", ad: "Beyoğlu", ilAdi: "İstanbul", ustId: 34 },
  { id: 1007, kod: "USK", ad: "Üsküdar", ilAdi: "İstanbul", ustId: 34 },
  { id: 1008, kod: "MAL", ad: "Maltepe", ilAdi: "İstanbul", ustId: 34 },
  { id: 1009, kod: "ATA", ad: "Ataşehir", ilAdi: "İstanbul", ustId: 34 },
  { id: 1010, kod: "PEN", ad: "Pendik", ilAdi: "İstanbul", ustId: 34 },
  { id: 1011, kod: "KART", ad: "Kartal", ilAdi: "İstanbul", ustId: 34 },
  { id: 1012, kod: "UMR", ad: "Ümraniye", ilAdi: "İstanbul", ustId: 34 },
  { id: 1013, kod: "SAR", ad: "Sarıyer", ilAdi: "İstanbul", ustId: 34 },
  { id: 1014, kod: "EYU", ad: "Eyüpsultan", ilAdi: "İstanbul", ustId: 34 },
  { id: 1015, kod: "ZEY", ad: "Zeytinburnu", ilAdi: "İstanbul", ustId: 34 },
  { id: 1016, kod: "BAH", ad: "Bahçelievler", ilAdi: "İstanbul", ustId: 34 },
  { id: 1017, kod: "BAGC", ad: "Bağcılar", ilAdi: "İstanbul", ustId: 34 },
  { id: 1018, kod: "KUC", ad: "Küçükçekmece", ilAdi: "İstanbul", ustId: 34 },
  { id: 1019, kod: "BUY", ad: "Büyükçekmece", ilAdi: "İstanbul", ustId: 34 },
  { id: 1020, kod: "BAS", ad: "Başakşehir", ilAdi: "İstanbul", ustId: 34 },
  { id: 1021, kod: "ESY", ad: "Esenyurt", ilAdi: "İstanbul", ustId: 34 },
  { id: 1022, kod: "BEYL", ad: "Beylikdüzü", ilAdi: "İstanbul", ustId: 34 },
  // Ankara
  { id: 2001, kod: "CAN", ad: "Çankaya", ilAdi: "Ankara", ustId: 6 },
  { id: 2002, kod: "ALT", ad: "Altındağ", ilAdi: "Ankara", ustId: 6 },
  { id: 2003, kod: "YEN", ad: "Yenimahalle", ilAdi: "Ankara", ustId: 6 },
  { id: 2004, kod: "KEC", ad: "Keçiören", ilAdi: "Ankara", ustId: 6 },
  { id: 2005, kod: "MAM", ad: "Mamak", ilAdi: "Ankara", ustId: 6 },
  { id: 2006, kod: "ETI", ad: "Etimesgut", ilAdi: "Ankara", ustId: 6 },
  { id: 2007, kod: "SIN", ad: "Sincan", ilAdi: "Ankara", ustId: 6 },
  // İzmir
  { id: 3001, kod: "KON", ad: "Konak", ilAdi: "İzmir", ustId: 35 },
  { id: 3002, kod: "BOR", ad: "Bornova", ilAdi: "İzmir", ustId: 35 },
  { id: 3003, kod: "KSY", ad: "Karşıyaka", ilAdi: "İzmir", ustId: 35 },
  { id: 3004, kod: "BUC", ad: "Buca", ilAdi: "İzmir", ustId: 35 },
  { id: 3005, kod: "BAY", ad: "Bayraklı", ilAdi: "İzmir", ustId: 35 },
  { id: 3006, kod: "CIG", ad: "Çiğli", ilAdi: "İzmir", ustId: 35 },
  { id: 3007, kod: "CES", ad: "Çeşme", ilAdi: "İzmir", ustId: 35 },
  // Bursa
  { id: 4001, kod: "OSM", ad: "Osmangazi", ilAdi: "Bursa", ustId: 16 },
  { id: 4002, kod: "NIL", ad: "Nilüfer", ilAdi: "Bursa", ustId: 16 },
  { id: 4003, kod: "YIL", ad: "Yıldırım", ilAdi: "Bursa", ustId: 16 },
  // Antalya
  { id: 5001, kod: "MUR", ad: "Muratpaşa", ilAdi: "Antalya", ustId: 7 },
  { id: 5002, kod: "KNY", ad: "Konyaaltı", ilAdi: "Antalya", ustId: 7 },
  { id: 5003, kod: "KRP", ad: "Kepez", ilAdi: "Antalya", ustId: 7 },
  { id: 5004, kod: "ALN", ad: "Alanya", ilAdi: "Antalya", ustId: 7 },
  // Adana
  { id: 6001, kod: "SEY", ad: "Seyhan", ilAdi: "Adana", ustId: 1 },
  { id: 6002, kod: "CUR", ad: "Çukurova", ilAdi: "Adana", ustId: 1 },
  { id: 6003, kod: "YUR", ad: "Yüreğir", ilAdi: "Adana", ustId: 1 },
  // Gaziantep
  { id: 7001, kod: "SHB", ad: "Şahinbey", ilAdi: "Gaziantep", ustId: 27 },
  { id: 7002, kod: "SKM", ad: "Şehitkamil", ilAdi: "Gaziantep", ustId: 27 },
  // Konya
  { id: 8001, kod: "SLC", ad: "Selçuklu", ilAdi: "Konya", ustId: 42 },
  { id: 8002, kod: "MRL", ad: "Meram", ilAdi: "Konya", ustId: 42 },
  { id: 8003, kod: "KRT", ad: "Karatay", ilAdi: "Konya", ustId: 42 },
  // Muğla
  { id: 9001, kod: "BOD", ad: "Bodrum", ilAdi: "Muğla", ustId: 48 },
  { id: 9002, kod: "FET", ad: "Fethiye", ilAdi: "Muğla", ustId: 48 },
  { id: 9003, kod: "MAR", ad: "Marmaris", ilAdi: "Muğla", ustId: 48 },
  { id: 9004, kod: "MEN", ad: "Menteşe", ilAdi: "Muğla", ustId: 48 },
  // Trabzon
  { id: 10001, kod: "ORT", ad: "Ortahisar", ilAdi: "Trabzon", ustId: 61 },
  { id: 10002, kod: "AKC", ad: "Akçaabat", ilAdi: "Trabzon", ustId: 61 },
];

const DEFAULT_BANKALAR = [
  { id: 102001, kod: "102.01.001", ad: "Garanti BBVA - Ticari TL Hesabı", unvan: "Garanti BBVA - Ticari TL Hesabı", bankaAdi: "Garanti BBVA", iban: "TR33 0006 2000 0001 2345 6789 01", hesapNo: "6200000-1" },
  { id: 102002, kod: "102.01.002", ad: "Akbank - Ana Şube Cari Hesap", unvan: "Akbank - Ana Şube Cari Hesap", bankaAdi: "Akbank", iban: "TR45 0004 6000 0002 3456 7890 12", hesapNo: "4600000-2" },
  { id: 102003, kod: "102.01.003", ad: "İş Bankası - Kapalıçarşı Ticari TL", unvan: "İş Bankası - Kapalıçarşı Ticari TL", bankaAdi: "İş Bankası", iban: "TR64 0006 4000 0003 4567 8901 23", hesapNo: "6400000-3" },
  { id: 102004, kod: "102.01.004", ad: "Yapı Kredi - Döviz & Altın Operasyon", unvan: "Yapı Kredi - Döviz & Altın Operasyon", bankaAdi: "Yapı Kredi", iban: "TR92 0006 7000 0004 5678 9012 34", hesapNo: "6700000-4" },
  { id: 102005, kod: "102.01.005", ad: "Ziraat Bankası - Kurumsal Vadesiz", unvan: "Ziraat Bankası - Kurumsal Vadesiz", bankaAdi: "Ziraat Bankası", iban: "TR10 0001 0000 0005 6789 0123 45", hesapNo: "1000000-5" },
  { id: 102006, kod: "102.01.006", ad: "VakıfBank - Merkez Şube Hesabı", unvan: "VakıfBank - Merkez Şube Hesabı", bankaAdi: "VakıfBank", iban: "TR15 0001 5000 0006 7890 1234 56", hesapNo: "1500000-6" },
  { id: 102007, kod: "102.01.007", ad: "QNB Finansbank - Kurumsal Cari", unvan: "QNB Finansbank - Kurumsal Cari", bankaAdi: "QNB Finansbank", iban: "TR88 0011 1000 0007 8901 2345 67", hesapNo: "1110000-7" },
];

const DEFAULT_ULKELER = [
  { id: 1, kod: "TR", ad: "TÜRKİYE" },
  { id: 2, kod: "DE", ad: "ALMANYA" },
  { id: 3, kod: "US", ad: "AMERİKA BİRLEŞİK DEVLETLERİ" },
  { id: 4, kod: "GB", ad: "BİRLEŞİK KRALLIK" },
  { id: 5, kod: "FR", ad: "FRANSA" },
  { id: 6, kod: "NL", ad: "HOLLANDA" },
  { id: 7, kod: "RU", ad: "RUSYA FEDERASYONU" },
  { id: 8, kod: "AZ", ad: "AZERBAYCAN" },
  { id: 9, kod: "IR", ad: "İRAN" },
  { id: 10, kod: "IQ", ad: "IRAK" },
  { id: 11, kod: "SA", ad: "SUUDİ ARABİSTAN" },
  { id: 12, kod: "AE", ad: "BİRLEŞİK ARAP EMİRLİKLERİ" },
];

const DEFAULT_HUKUKI_YAPILAR = [
  { id: 1, kod: "01", ad: "01 - Gerçek Kişi" },
  { id: 2, kod: "02", ad: "02 - Tüzel Kişi" },
];

const findTurkiyeItem = (list?: { id: number; kod?: string; ad: string }[]) => {
  if (!list || !Array.isArray(list) || list.length === 0) return null;

  // 1. Öncelik: Tanım / Açıklama (AD) birebir "TÜRKİYE" veya "TURKIYE" olan satır
  const exactName = list.find((u) => {
    const rawAd = (u.ad || "").toLocaleLowerCase("tr-TR").trim();
    const rawAdEn = (u.ad || "").toLowerCase().trim();
    return rawAd === "türkiye" || rawAdEn === "turkiye" || rawAdEn === "turkey";
  });
  if (exactName) return exactName;

  // 2. Öncelik: Tanımı "TÜRKİYE" ile başlayan (örn. "TÜRKİYE CUMHURİYETİ") satır
  const startsWithTurkiye = list.find((u) => {
    const rawAd = (u.ad || "").toLocaleLowerCase("tr-TR").trim();
    const rawAdEn = (u.ad || "").toLowerCase().trim();
    return (
      (rawAd.startsWith("türkiye") || rawAdEn.startsWith("turkiye")) &&
      !rawAd.includes("türkmen") &&
      !rawAd.includes("turkmen")
    );
  });
  if (startsWithTurkiye) return startsWithTurkiye;

  // 3. Öncelik: Tanımı içinde "TÜRKİYE" geçen satır
  const containsTurkiye = list.find((u) => {
    const rawAd = (u.ad || "").toLocaleLowerCase("tr-TR").trim();
    const rawAdEn = (u.ad || "").toLowerCase().trim();
    return (
      (rawAd.includes("türkiye") || rawAdEn.includes("turkiye")) &&
      !rawAd.includes("türkmen") &&
      !rawAd.includes("turkmen")
    );
  });
  if (containsTurkiye) return containsTurkiye;

  // 4. Öncelik: Kodu TR veya TUR olup tanımı TÜRK ile başlayan satır (Trinidad vb. hariç)
  const codeTrAndTurk = list.find((u) => {
    const rawAd = (u.ad || "").toLocaleLowerCase("tr-TR").trim();
    const rawKod = (u.kod || "").toUpperCase().trim();
    return (
      (rawKod === "TR" || rawKod === "TUR") &&
      (rawAd.startsWith("türk") || rawAd.startsWith("turk")) &&
      !rawAd.includes("türkmen") &&
      !rawAd.includes("turkmen") &&
      !rawAd.includes("trinidad") &&
      !rawAd.includes("tobago") &&
      !rawAd.includes("caicos")
    );
  });
  if (codeTrAndTurk) return codeTrAndTurk;

  return null;
};

// 9 Grid Nav Columns in sequential order
const GRID_COLUMNS = [
  "kod",
  "miktar",
  "kur",
  "komisyonOrani",
  "komisyon",
  "bmvOrani",
  "bmv",
  "kmvOrani",
  "kmv",
] as const;
type GridColumnKey = (typeof GRID_COLUMNS)[number];

export const DEFAULT_CUSTOMER_NAME = "İsim beyan edilmemiştir";

export const DovizFisiPage: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryId = searchParams.get("id") || searchParams.get("fisId");
  const isDuzeltmeMode = location.pathname.includes("duzeltme");

  // Notification state
  const [notification, setNotification] = useState<{
    type: "success" | "danger" | "warning" | "info";
    message: string;
  } | null>(null);

  // Lookups
  const [cariList, setCariList] = useState<CariKartItem[]>([]);
  const [vezneList, setVezneList] = useState<VezneItem[]>([]);
  const [paraList, setParaList] = useState<ParaItem[]>([]);
  const [statisticList, setStatisticList] = useState<StatisticItem[]>([]);
  const [selectedStatistic, setSelectedStatistic] = useState<StatisticItem | IstatistikSecimItem | null>(null);
  const [istatistikFisDizaynTipi, setIstatistikFisDizaynTipi] = useState<number | null>(null);
  const [kurSatirlar, setKurSatirlar] = useState<KurRowItem[]>([]);
  const [isLoadingLookups, setIsLoadingLookups] = useState<boolean>(true);

  // ─── Grid Kolon Görünürlük ────────────────────────────────────────────────
  // Kullanıcı bazında localStorage'a kaydedilir
  const GRID_COL_STORAGE_KEY = `doviz_fis_grid_cols_${user?.id || "default"}`;

  const defaultColVisibility = {
    komisyonOrani: true,
    komisyon: true,
    bmvOrani: true,
    bmv: true,
    kmvOrani: true,
    kmv: true,
  };

  const [colVisibility, setColVisibility] = useState<typeof defaultColVisibility>(() => {
    try {
      const stored = localStorage.getItem(GRID_COL_STORAGE_KEY);
      if (stored) return { ...defaultColVisibility, ...JSON.parse(stored) };
    } catch { }
    return defaultColVisibility;
  });

  const toggleCol = (col: keyof typeof defaultColVisibility) => {
    setColVisibility((prev) => {
      const next = { ...prev, [col]: !prev[col] };
      try { localStorage.setItem(GRID_COL_STORAGE_KEY, JSON.stringify(next)); } catch { }
      return next;
    });
  };

  // Modals
  const [showSearchModal, setShowSearchModal] = useState<boolean>(false);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [printSnapshot, setPrintSnapshot] = useState<any>(null);
  const [isPendingDirectPrint, setIsPendingDirectPrint] = useState<boolean>(false);
  const [companyDefinitions, setCompanyDefinitions] = useState<TodvzTanimDto | null>(null);
  const [printers, setPrinters] = useState<YaziciItem[]>([]);

  useEffect(() => {
    PrinterService.getYazicilar().then(setPrinters).catch(() => { });
  }, []);

  // Kuruş ve ondalık basamak sayıları (Firma Tanımlarından alınır)
  const tlKurusSayisi = useMemo(() => {
    return companyDefinitions?.TL_KURUS_SAYISI !== undefined && companyDefinitions?.TL_KURUS_SAYISI !== null
      ? Number(companyDefinitions.TL_KURUS_SAYISI)
      : 2;
  }, [companyDefinitions]);

  const dovizKurusSayisi = useMemo(() => {
    return companyDefinitions?.DOVIZ_KURUS_SAYISI !== undefined && companyDefinitions?.DOVIZ_KURUS_SAYISI !== null
      ? Number(companyDefinitions.DOVIZ_KURUS_SAYISI)
      : 2;
  }, [companyDefinitions]);

  const kurKurusSayisi = useMemo(() => {
    return companyDefinitions?.KUR_KURUS_SAYISI !== undefined && companyDefinitions?.KUR_KURUS_SAYISI !== null
      ? Number(companyDefinitions.KUR_KURUS_SAYISI)
      : 4;
  }, [companyDefinitions]);
  const [showCariModal, setShowCariModal] = useState<boolean>(false);
  const [cariSearchTerm, setCariSearchTerm] = useState<string>("");
  const [cariSearchField, setCariSearchField] = useState<CustomerSearchField>("all");
  const [showVezneModal, setShowVezneModal] = useState<boolean>(false);
  const [showParaModal, setShowParaModal] = useState<boolean>(false);
  const [paraModalRowId, setParaModalRowId] = useState<string | null>(null);
  const [paraSearchTerm, setParaSearchTerm] = useState<string>("");
  const [showDetayModal, setShowDetayModal] = useState<boolean>(false);
  const [showGumrukModal, setShowGumrukModal] = useState<boolean>(false);
  const [showArbitrajModal, setShowArbitrajModal] = useState<boolean>(false);
  const [arbitrajActiveInfo, setArbitrajActiveInfo] = useState<{ girisKod: string; cikisKod: string; parite: number; islemYonu: string } | null>(null);
  const [istatistikSearchTerm, setIstatistikSearchTerm] = useState<string>("");
  const [tcknDogrulandi, setTcknDogrulandi] = useState<boolean | null>(null);
  const tipSelectRef = useRef<HTMLSelectElement | null>(null);
  const cariKodRef = useRef<HTMLInputElement | null>(null);
  const vknRef = useRef<HTMLInputElement | null>(null);
  const unvanRef = useRef<HTMLInputElement | null>(null);
  const istatistikRef = useRef<HTMLInputElement | null>(null);

  const lastFocusedCariKodRef = useRef<string>("");
  const lastFocusedUnvanRef = useRef<string>("");
  const lastFocusedVknRef = useRef<string>("");
  const lastFocusedIstatistikKodRef = useRef<string>("");
  const hasUserSelectedStatRef = useRef<boolean>(false);
  const lastModalCallerRef = useRef<"cariKod" | "unvan" | "vkn" | "istatistik" | "paraGrid" | null>(null);
  const lastParaModalRowIndexRef = useRef<number | null>(null);

  // Common Search Lookup Modal State for Detay fields
  type DetayLookupType =
    | "ulke"
    | "uyruk"
    | "il"
    | "ilce"
    | "postaKodu"
    | "vergiDairesi"
    | "meslek"
    | "bankaHesabi"
    | "hukukiYapi"
    | "yetkiliKisi";

  const [activeLookupType, setActiveLookupType] = useState<DetayLookupType | null>(null);
  const [lookupData, setLookupData] = useState<{
    ulkeList: { id: number; kod?: string; ad: string }[];
    uyrukList: { id: number; kod?: string; ad: string }[];
    ilList: { id: number; kod?: string; ad: string }[];
    ilceList: { id: number; kod?: string; ad: string; ustId?: number; ilAdi?: string }[];
    postaKoduList: { id: number; kod?: string; ad: string; il?: string; ilce?: string }[];
    vergiDairesiList: { id: number; kod?: string; ad: string }[];
    meslekList: { id: number; kod?: string; ad: string }[];
    hukukiYapiList: { id: number; kod?: string; ad: string }[];
    bankaList: { id: number; kod?: string; ad: string; iban?: string; hesapNo?: string; bankaAdi?: string; subeAdi?: string; unvan?: string }[];
  }>({
    ulkeList: DEFAULT_ULKELER,
    uyrukList: DEFAULT_ULKELER,
    ilList: [],
    ilceList: [],
    postaKoduList: DEFAULT_POSTA_KODLARI,
    vergiDairesiList: [],
    meslekList: [],
    hukukiYapiList: DEFAULT_HUKUKI_YAPILAR,
    bankaList: DEFAULT_BANKALAR,
  });

  const lookupDataRef = useRef(lookupData);
  lookupDataRef.current = lookupData;
  const companyDefinitionsRef = useRef(companyDefinitions);
  companyDefinitionsRef.current = companyDefinitions;

  const [savedFisList, setSavedFisList] = useState<DovizFisListItem[]>([]);
  const [isLoadingFisList, setIsLoadingFisList] = useState<boolean>(false);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const detayContainerRef = useRef<HTMLDivElement | null>(null);
  const headerRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Active Doviz Fis Form State
  const [fisId, setFisId] = useState<number | null>(null);
  const [isLocked, setIsLocked] = useState<boolean>(false); // Read-only if sent to GIB
  const [isGonderildi, setIsGonderildi] = useState<boolean>(false);
  const [vezneId, setVezneId] = useState<number>(1);
  const [vezneKod, setVezneKod] = useState<string>("01");
  const [vezneAd, setVezneAd] = useState<string>("Ana Vezne");
  const [tip, setTip] = useState<number>(0); // 0: Alış, 1: Satış (Varsayılan olarak ALIŞ)

  // Alış / Satış başlığı renk teması
  const activeFisThemeBg = useMemo(() => {
    let buyBg = user?.appearance?.buyHeaderBgColor;
    let sellBg = user?.appearance?.sellHeaderBgColor;
    if (!buyBg || !sellBg) {
      try {
        const cached = localStorage.getItem("kuyumcu_active_appearance");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (!buyBg && parsed.buyHeaderBgColor) buyBg = parsed.buyHeaderBgColor;
          if (!sellBg && parsed.sellHeaderBgColor) sellBg = parsed.sellHeaderBgColor;
        }
      } catch { }
    }
    if (tip === 0) {
      return buyBg || "var(--user-buy-header-bg, #e2e8f0)";
    } else {
      return sellBg || "var(--user-sell-header-bg, #e2e8f0)";
    }
  }, [tip, user?.appearance?.buyHeaderBgColor, user?.appearance?.sellHeaderBgColor]);

  const activeFisThemeText = useMemo(() => {
    let buyText = user?.appearance?.buyHeaderTextColor;
    let sellText = user?.appearance?.sellHeaderTextColor;
    if (!buyText || !sellText) {
      try {
        const cached = localStorage.getItem("kuyumcu_active_appearance");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (!buyText && parsed.buyHeaderTextColor) buyText = parsed.buyHeaderTextColor;
          if (!sellText && parsed.sellHeaderTextColor) sellText = parsed.sellHeaderTextColor;
        }
      } catch { }
    }
    if (tip === 0) {
      return buyText || "var(--user-buy-header-text, #0f172a)";
    } else {
      return sellText || "var(--user-sell-header-text, #0f172a)";
    }
  }, [tip, user?.appearance?.buyHeaderTextColor, user?.appearance?.sellHeaderTextColor]);
  const [tarih, setTarih] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [saat, setSaat] = useState<string>(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  });

  // Empty inputs by default
  const [seriNo, setSeriNo] = useState<string>("");
  const [belgeNo, setBelgeNo] = useState<string>("");
  const [unvan, setUnvan] = useState<string>(DEFAULT_CUSTOMER_NAME);
  const [cariKod, setCariKod] = useState<string>("");
  const [cariKartId, setCariKartId] = useState<number | null>(null);
  const [kayitsizMusteriList, setKayitsizMusteriList] = useState<KayitsizMusteriItem[]>([]);
  const [vergiKimlikNo, setVergiKimlikNo] = useState<string>("");
  const [gelisNedeni, setGelisNedeni] = useState<string>("");
  const [kurTuru, setKurTuru] = useState<number>(0); // 0: Efektif, 1: Döviz
  const [istatistikId, setIstatistikId] = useState<number | null>(null);
  const [istatistikKodu, setIstatistikKodu] = useState<string>("9249");

  // MASAK Sorgulama ve Limit Takip Durumu
  const [isSearchingMasak, setIsSearchingMasak] = useState<boolean>(false);
  const [masakModalOpen, setMasakModalOpen] = useState<boolean>(false);
  const [masakManagementOpen, setMasakManagementOpen] = useState<boolean>(false);
  const [showMasakConfirmModal, setShowMasakConfirmModal] = useState<boolean>(false);
  const [showMasakCustomerWarningModal, setShowMasakCustomerWarningModal] = useState<boolean>(false);
  const [showMasakMissingModal, setShowMasakMissingModal] = useState<boolean>(false);
  const [masakMissingFields, setMasakMissingFields] = useState<string[]>([]);
  const [masakResult, setMasakResult] = useState<{
    queriedName?: string;
    queriedId?: string;
    matches: MasakEslesme[];
    searched: boolean;
  }>({ matches: [], searched: false });

  // Detailed Customer Information (Detay Modal State) with IDs - Defaults to TÜRKİYE / 01 Gerçek Kişi
  const [detayCariTipi, setDetayCariTipi] = useState<string>("Şahıs");
  const [detayYetkiliKisi, setDetayYetkiliKisi] = useState<string>("");
  const [detayYetkiliKisiId, setDetayYetkiliKisiId] = useState<number | null>(null);
  const [detaySirketTuru, setDetaySirketTuru] = useState<string>("");
  const [detayUlke, setDetayUlke] = useState<string>("TÜRKİYE");
  const [detayUlkeId, setDetayUlkeId] = useState<number | null>(1);
  const [detayUyruk, setDetayUyruk] = useState<string>("TÜRKİYE");
  const [detayUyrukId, setDetayUyrukId] = useState<number | null>(1);
  const [detayPasaportNo, setDetayPasaportNo] = useState<string>("");
  const [detayHukukiYapi, setDetayHukukiYapi] = useState<string>("01 - Gerçek Kişi");
  const [detayHukukiYapiId, setDetayHukukiYapiId] = useState<number | null>(1);
  const [detayGecerlilikTarihi, setDetayGecerlilikTarihi] = useState<string>("");
  const [detayDogumTarihi, setDetayDogumTarihi] = useState<string>("");
  const [gecerlilikFocused, setGecerlilikFocused] = useState<boolean>(false);
  const [dogumFocused, setDogumFocused] = useState<boolean>(false);
  const [detayDogumYeri, setDetayDogumYeri] = useState<string>("");
  const [detayKimlikKaynagi, setDetayKimlikKaynagi] = useState<string>("");
  const [detayKimlikSeriNo, setDetayKimlikSeriNo] = useState<string>("");
  const [detayBabaAdi, setDetayBabaAdi] = useState<string>("");
  const [detayAnneAdi, setDetayAnneAdi] = useState<string>("");
  const [detayVergiDairesi, setDetayVergiDairesi] = useState<string>("");
  const [detayVergiDairesiId, setDetayVergiDairesiId] = useState<number | null>(null);
  const [detayAdres, setDetayAdres] = useState<string>("");
  const [detayPostaKodu, setDetayPostaKodu] = useState<string>("");
  const [detayPostaKoduId, setDetayPostaKoduId] = useState<number | null>(null);
  const [detayIlce, setDetayIlce] = useState<string>("");
  const [detayIlceId, setDetayIlceId] = useState<number | null>(null);
  const [detayIl, setDetayIl] = useState<string>("");
  const [detayIlId, setDetayIlId] = useState<number | null>(null);
  const [detayEposta, setDetayEposta] = useState<string>("");
  const [detayTelefon, setDetayTelefon] = useState<string>("");
  const [detayVekil, setDetayVekil] = useState<string>("Yok");
  const [detayVekilTipi, setDetayVekilTipi] = useState<string>("Firma");
  const [detayVekilAdi, setDetayVekilAdi] = useState<string>("");
  const [detayVekilKimlikNo, setDetayVekilKimlikNo] = useState<string>("");
  const [detayMeslek, setDetayMeslek] = useState<string>("");
  const [detayMeslekId, setDetayMeslekId] = useState<number | null>(null);
  const [detayDernekAmaci, setDetayDernekAmaci] = useState<string>("");
  const [detayBankaHesabi, setDetayBankaHesabi] = useState<string>("");
  const [detayBankaHesabiId, setDetayBankaHesabiId] = useState<number | null>(null);

  // Gümrük Modal State
  const [gmBeyannameNo, setGmBeyannameNo] = useState<string>("");
  const [gmBeyannameTarih, setGmBeyannameTarih] = useState<string>("");
  const [gmDovizSayi, setGmDovizSayi] = useState<string>("");
  const [gmDovizTarih, setGmDovizTarih] = useState<string>("");
  const [gmTeyitSayi, setGmTeyitSayi] = useState<string>("");
  const [gmTeyitTarih, setGmTeyitTarih] = useState<string>("");
  const [gmFaturaNo, setGmFaturaNo] = useState<string>("");

  const getEffectiveKmvMode = (def?: TodvzTanimDto | null): number => {
    const val = def?.KMV_UYGULAMA_SEKLI;
    if (val === 1 || val === 2 || val === 3) return Number(val);
    return 3; // Varsayılan: 3 - Kurdan Hariç
  };

  // Table Lines: Starts with EXACTLY 1 row if no data
  const createEmptyRow = (satirNo: number): GridLineItem => {
    const compDef = companyDefinitionsRef?.current || companyDefinitions;
    const kmvMode = getEffectiveKmvMode(compDef);
    const statKod = (istatistikKodu || "").trim();
    const activeStat = statKod ? (selectedStatistic || statisticList.find((s) => (istatistikId && s.id === istatistikId) || (s.kod && s.kod === statKod))) : null;
    const bmvRate = activeStat?.bmvOrani !== undefined && activeStat?.bmvOrani !== null && Number(activeStat.bmvOrani) > 0
      ? Number(activeStat.bmvOrani)
      : 0;
    const kmvRate = (kmvMode !== 1 && activeStat?.kmvOrani !== undefined && activeStat?.kmvOrani !== null && Number(activeStat.kmvOrani) > 0)
      ? Number(activeStat.kmvOrani)
      : 0;
    const komRate = activeStat?.komisyonOrani !== undefined && activeStat?.komisyonOrani !== null && Number(activeStat.komisyonOrani) > 0
      ? Number(activeStat.komisyonOrani)
      : 0;

    return {
      id: `row-${Date.now()}-${Math.random()}`,
      satirNo,
      paraId: 0,
      paraKodu: "",
      paraAdi: "",
      miktar: "",
      kur: "",
      komisyonOrani: komRate > 0 ? komRate.toString() : "",
      komisyon: "",
      bmvOrani: bmvRate > 0 ? bmvRate.toString() : "",
      bmv: "",
      kmvOrani: kmvRate > 0 ? kmvRate.toString() : "",
      kmv: "",
      tutar: "",
    };
  };

  const [lines, setLines] = useState<GridLineItem[]>([createEmptyRow(1)]);
  const [activeRowIndex, setActiveRowIndex] = useState<number>(0);
  const [invalidRowIds, setInvalidRowIds] = useState<Record<string, boolean>>({});

  // Dynamic Vezne Balances fetched from backend
  const [topBalances, setTopBalances] = useState<{ tl: number; usd: number; eur: number }>({
    tl: 0,
    usd: 0,
    eur: 0,
  });
  const [vezneBakiyeler, setVezneBakiyeler] = useState<VezneBakiyeDetailItem[]>([]);

  // F3, F4, F5, F6, F9 Modalları State'leri
  const [showIstatistikModal, setShowIstatistikModal] = useState<boolean>(false);
  const [showKurListesiModal, setShowKurListesiModal] = useState<boolean>(false);
  const [showVezneBakiyeModal, setShowVezneBakiyeModal] = useState<boolean>(false);
  const [showTlHesabiModal, setShowTlHesabiModal] = useState<boolean>(false);
  const [showParaSaymaModal, setShowParaSaymaModal] = useState<boolean>(false);
  const [banknotSaymaCounts, setBanknotSaymaCounts] = useState<Record<string, Record<number, number>>>({});

  // Helper to reliably focus grid cells and set proper cursor position
  const focusCell = useCallback(
    (
      rowIdx: number,
      field: GridColumnKey,
      cursorPos: "start" | "end" | "select" = "select"
    ) => {
      let attempts = 0;
      const tryFocus = () => {
        const input = document.getElementById(`grid-input-${rowIdx}-${field}`) as HTMLInputElement | null;
        if (input) {
          input.focus();
          if (cursorPos === "select") {
            input.select();
          } else if (cursorPos === "start") {
            input.setSelectionRange(0, 0);
          } else if (cursorPos === "end") {
            const len = input.value ? input.value.length : 0;
            input.setSelectionRange(len, len);
          }
          input.scrollIntoView({ block: "nearest", behavior: "smooth" });
        } else if (attempts < 25) {
          attempts++;
          setTimeout(tryFocus, 25);
        }
      };
      tryFocus();
    },
    []
  );

  // Focus Geliş Nedeni input
  const focusGelisNedeni = useCallback(() => {
    let attempts = 0;
    const tryFocus = () => {
      const el = document.getElementById("header-input-gelis-nedeni") as HTMLInputElement | null;
      if (el) {
        el.focus();
        el.select();
      } else if (attempts < 25) {
        attempts++;
        setTimeout(tryFocus, 25);
      }
    };
    tryFocus();
  }, []);

  const linesRef = useRef(lines);
  linesRef.current = lines;
  const hasInitialFocusedRef = useRef(false);

  // Auto-focus handler: Focus on Alış / Satış selection on initial open
  const focusInitialInput = useCallback(() => {
    if (tipSelectRef.current) {
      tipSelectRef.current.focus();
    } else {
      focusGelisNedeni();
    }
  }, [focusGelisNedeni]);

  // Fetch dynamic balances for current vezne
  const fetchVezneBalances = useCallback(async (vId: number) => {
    try {
      const res = await DovizFisService.getVezneBakiye(vId);
      setTopBalances({ tl: res.tl, usd: res.usd, eur: res.eur });
      setVezneBakiyeler(res.bakiyeler || []);
    } catch (e) {
      console.error("Vezne bakiye getirme hatası:", e);
    }
  }, []);

  // Drag & drop state for row reordering
  const [draggedRowIndex, setDraggedRowIndex] = useState<number | null>(null);
  const [dragOverRowIndex, setDragOverRowIndex] = useState<number | null>(null);

  // Set default values for Customer Detail (F8 Detay Modal):
  // Ülke: "TÜRKİYE", Uyruk: "TÜRKİYE", Hukuki Yapı: "01 - Gerçek Kişi",
  // Posta Kodu, İlçe, İl from Firma Tanımları (TODVZ_TANIM)
  const applyDefaultF8Detay = useCallback(
    (lookupsParam?: typeof lookupData, compDefParam?: TodvzTanimDto | null) => {
      const lk = lookupsParam || lookupDataRef.current;
      const def = compDefParam !== undefined ? compDefParam : companyDefinitionsRef.current;

      // 1. Ülke: Türkiye
      const ulkeList = (lk?.ulkeList && lk.ulkeList.length > 0) ? lk.ulkeList : DEFAULT_ULKELER;
      const trUlke = findTurkiyeItem(ulkeList);
      if (trUlke) {
        setDetayUlke(trUlke.ad);
        setDetayUlkeId(trUlke.id);
      } else {
        setDetayUlke("TÜRKİYE");
        setDetayUlkeId(null);
      }

      // 2. Uyruk: Türkiye
      const uyrukList = (lk?.uyrukList && lk.uyrukList.length > 0) ? lk.uyrukList : (lk?.ulkeList && lk.ulkeList.length > 0 ? lk.ulkeList : DEFAULT_ULKELER);
      const trUyruk = findTurkiyeItem(uyrukList) || trUlke;
      if (trUyruk) {
        setDetayUyruk(trUyruk.ad);
        setDetayUyrukId(trUyruk.id);
      } else {
        setDetayUyruk("TÜRKİYE");
        setDetayUyrukId(null);
      }

      // 3. Hukuki Yapı: 01 Gerçek Kişi
      const hyList = (lk?.hukukiYapiList && lk.hukukiYapiList.length > 0) ? lk.hukukiYapiList : DEFAULT_HUKUKI_YAPILAR;
      const matchH = hyList.find(
        (h) =>
          String(h.kod || "").trim() === "01" ||
          String(h.kod || "").trim() === "1" ||
          (h.ad && h.ad.toLowerCase().includes("gerçek"))
      );
      if (matchH) {
        setDetayHukukiYapi(matchH.ad || "01 - Gerçek Kişi");
        setDetayHukukiYapiId(matchH.id);
      } else {
        setDetayHukukiYapi("01 - Gerçek Kişi");
        setDetayHukukiYapiId(1);
      }

      // 4. Posta Kodu, İlçe, İl -> Firma Tanımları (TODVZ_TANIM)
      if (def) {
        // İl
        if (def.IL_ID) {
          setDetayIlId(def.IL_ID);
          const matchIl = (lk?.ilList || []).find((i) => i.id === def.IL_ID || String(i.kod) === String(def.IL_ID));
          setDetayIl(matchIl ? matchIl.ad : (def as any).IL || "");
        } else if ((def as any).IL) {
          setDetayIl((def as any).IL);
          const matchIl = (lk?.ilList || []).find((i) => i.ad?.toLowerCase().trim() === (def as any).IL.toLowerCase().trim());
          setDetayIlId(matchIl ? matchIl.id : null);
        } else {
          setDetayIl("");
          setDetayIlId(null);
        }

        // İlçe
        if (def.ILCE_ID) {
          setDetayIlceId(def.ILCE_ID);
          const ilceSource = lk?.ilceList && lk.ilceList.length > 0 ? lk.ilceList : DEFAULT_ILCELER;
          const matchIlce = ilceSource.find((i) => i.id === def.ILCE_ID);
          setDetayIlce(matchIlce ? matchIlce.ad : (def as any).ILCE || "");
        } else if ((def as any).ILCE) {
          setDetayIlce((def as any).ILCE);
          const ilceSource = lk?.ilceList && lk.ilceList.length > 0 ? lk.ilceList : DEFAULT_ILCELER;
          const matchIlce = ilceSource.find((i) => i.ad?.toLowerCase().trim() === (def as any).ILCE.toLowerCase().trim());
          setDetayIlceId(matchIlce ? matchIlce.id : null);
        } else {
          setDetayIlce("");
          setDetayIlceId(null);
        }

        // Posta Kodu
        if (def.POSTA_KODU_ID) {
          setDetayPostaKoduId(def.POSTA_KODU_ID);
          const pList = lk?.postaKoduList && lk.postaKoduList.length > 0 ? lk.postaKoduList : DEFAULT_POSTA_KODLARI;
          const matchPk = pList.find(
            (p) => p.id === def.POSTA_KODU_ID || String(p.kod).trim() === String(def.POSTA_KODU_ID).trim()
          );
          setDetayPostaKodu(matchPk ? (matchPk.kod || matchPk.ad) : String(def.POSTA_KODU_ID));
        } else if ((def as any).POSTA_KODU) {
          setDetayPostaKodu(String((def as any).POSTA_KODU));
          setDetayPostaKoduId(null);
        } else {
          setDetayPostaKodu("");
          setDetayPostaKoduId(null);
        }
      } else {
        setDetayIl("");
        setDetayIlId(null);
        setDetayIlce("");
        setDetayIlceId(null);
        setDetayPostaKodu("");
        setDetayPostaKoduId(null);
      }
    },
    []
  );

  // Function to open F8 Detay Modal with guaranteed defaults (Türkiye, 01 - Gerçek Kişi, Firma Tanımları)
  const handleOpenDetayModal = useCallback(() => {
    const lk = lookupDataRef.current || lookupData;
    const def = companyDefinitionsRef.current || companyDefinitions;

    const ulkeList = (lk?.ulkeList && lk.ulkeList.length > 0) ? lk.ulkeList : DEFAULT_ULKELER;
    const trUlke = findTurkiyeItem(ulkeList);

    if (!detayUlke || !detayUlke.trim()) {
      setDetayUlke(trUlke?.ad || "TÜRKİYE");
      setDetayUlkeId(trUlke ? trUlke.id : null);
    } else if (trUlke && (!detayUlkeId || detayUlke.toLowerCase().trim() === "türkiye" || detayUlke.toLowerCase().trim() === "turkiye")) {
      setDetayUlke(trUlke.ad);
      setDetayUlkeId(trUlke.id);
    }

    const uyrukList = (lk?.uyrukList && lk.uyrukList.length > 0) ? lk.uyrukList : ulkeList;
    const trUyruk = findTurkiyeItem(uyrukList) || trUlke;
    if (!detayUyruk || !detayUyruk.trim()) {
      setDetayUyruk(trUyruk?.ad || "TÜRKİYE");
      setDetayUyrukId(trUyruk ? trUyruk.id : null);
    } else if (trUyruk && (!detayUyrukId || detayUyruk.toLowerCase().trim() === "türkiye" || detayUyruk.toLowerCase().trim() === "turkiye")) {
      setDetayUyruk(trUyruk.ad);
      setDetayUyrukId(trUyruk.id);
    }

    if (!detayHukukiYapi || !detayHukukiYapi.trim()) {
      const hyList = (lk?.hukukiYapiList && lk.hukukiYapiList.length > 0) ? lk.hukukiYapiList : DEFAULT_HUKUKI_YAPILAR;
      const matchH = hyList.find(
        (h) =>
          String(h.kod || "").trim() === "01" ||
          String(h.kod || "").trim() === "1" ||
          (h.ad && h.ad.toLowerCase().includes("gerçek"))
      );
      setDetayHukukiYapi(matchH?.ad || "01 - Gerçek Kişi");
      setDetayHukukiYapiId(matchH ? matchH.id : 1);
    }
    if (def) {
      if (!detayIl && def.IL_ID) {
        setDetayIlId(def.IL_ID);
        const matchIl = (lk?.ilList || []).find((i) => i.id === def.IL_ID || String(i.kod) === String(def.IL_ID));
        setDetayIl(matchIl ? matchIl.ad : (def as any).IL || "");
      }
      if (!detayIlce && def.ILCE_ID) {
        setDetayIlceId(def.ILCE_ID);
        const ilceSource = lk?.ilceList && lk.ilceList.length > 0 ? lk.ilceList : DEFAULT_ILCELER;
        const matchIlce = ilceSource.find((i) => i.id === def.ILCE_ID);
        setDetayIlce(matchIlce ? matchIlce.ad : (def as any).ILCE || "");
      }
      if (!detayPostaKodu && def.POSTA_KODU_ID) {
        setDetayPostaKoduId(def.POSTA_KODU_ID);
        const pList = lk?.postaKoduList && lk.postaKoduList.length > 0 ? lk.postaKoduList : DEFAULT_POSTA_KODLARI;
        const matchPk = pList.find((p) => p.id === def.POSTA_KODU_ID || String(p.kod).trim() === String(def.POSTA_KODU_ID).trim());
        setDetayPostaKodu(matchPk ? (matchPk.kod || matchPk.ad) : String(def.POSTA_KODU_ID));
      }
    }
    setShowDetayModal(true);
  }, [detayUlke, detayUyruk, detayHukukiYapi, detayIl, detayIlce, detayPostaKodu, lookupData, companyDefinitions]);

  // Clear form for fresh new entry (Registration mode)
  const resetForm = useCallback((lookupsParam?: typeof lookupData, compDefParam?: TodvzTanimDto | null) => {
    setFisId(null);
    setIsLocked(false);
    setIsGonderildi(false);
    const now = new Date();
    setTarih(now.toISOString().split("T")[0]);
    setSaat(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
    setSeriNo("");
    setBelgeNo("");
    setUnvan(DEFAULT_CUSTOMER_NAME);
    setCariKod("");
    setCariKartId(null);
    setVergiKimlikNo("");
    setGelisNedeni("");
    setTip(0);
    setKurTuru(0);
    setIstatistikId(null);
    setIstatistikKodu("");
    setSelectedStatistic(null);
    hasUserSelectedStatRef.current = false;
    lastFocusedCariKodRef.current = "";
    lastFocusedUnvanRef.current = DEFAULT_CUSTOMER_NAME;
    lastFocusedVknRef.current = "";
    setDetayCariTipi("Şahıs");
    setDetayYetkiliKisi("");
    setDetayYetkiliKisiId(null);
    setDetaySirketTuru("");
    setDetayPasaportNo("");
    setDetayGecerlilikTarihi("");
    setDetayDogumTarihi("");
    setGecerlilikFocused(false);
    setDogumFocused(false);
    setDetayDogumYeri("");
    setDetayKimlikKaynagi("");
    setDetayKimlikSeriNo("");
    setDetayBabaAdi("");
    setDetayAnneAdi("");
    setDetayVergiDairesi("");
    setDetayVergiDairesiId(null);
    setDetayAdres("");
    setDetayEposta("");
    setDetayTelefon("");
    setDetayVekil("Yok");
    setDetayVekilTipi("Firma");
    setDetayVekilAdi("");
    setDetayVekilKimlikNo("");
    setDetayMeslek("");
    setDetayMeslekId(null);
    setDetayDernekAmaci("");
    setDetayBankaHesabi("");
    setDetayBankaHesabiId(null);
    setTcknDogrulandi(null);
    setGmBeyannameNo("");
    setGmBeyannameTarih("");
    setGmDovizSayi("");
    setGmDovizTarih("");
    setGmTeyitSayi("");
    setGmTeyitTarih("");
    setGmFaturaNo("");
    setLines([createEmptyRow(1)]);
    setActiveRowIndex(0);
    setShowDetayModal(false);
    setShowGumrukModal(false);
    setShowSearchModal(false);
    setShowCariModal(false);
    setShowVezneModal(false);
    setShowParaModal(false);
    setShowKurListesiModal(false);
    setShowVezneBakiyeModal(false);
    setShowTlHesabiModal(false);
    setCurrentIndex(-1);

    // Apply default F8 Detay values
    applyDefaultF8Detay(lookupsParam, compDefParam);
  }, [applyDefaultF8Detay]);

  // Load Lookups (Instant Load with FastLookupCache)
  const loadLookupsAndList = useCallback(async () => {
    setIsLoadingLookups(true);
    try {
      const fisListPromise = isDuzeltmeMode
        ? DovizFisService.getFisList({ limit: 500 }).catch(() => [] as DovizFisListItem[])
        : Promise.resolve([] as DovizFisListItem[]);

      const [cariler, vezneler, paralar, kurTabloRes, gunlukKurTabloRes, istatistikler, fisler, cariLk, compDef, kayitsizlar] = await Promise.all([
        CariService.getCariKartlar().catch(() => [] as CariKartItem[]),
        CashDeskService.getVezneler().catch(() => [] as VezneItem[]),
        FastLookupCache.get("paralar", () => apiClient.get<ParaItem[]>("/para").then((r) => r.data || [])),
        KurService.getKurTablosu({ tur: 0 }).catch(() => null),
        KurService.getKurTablosu({ tur: 1 }).catch(() => null),
        StatisticService.getStatistics().catch(() => [] as StatisticItem[]),
        fisListPromise,
        CariService.getLookups().catch(() => null),
        CompanyService.getDefinitions().catch(() => null),
        DovizFisService.getKayitsizMusteriler().catch(() => [] as KayitsizMusteriItem[]),
      ]);

      if (kayitsizlar && kayitsizlar.length > 0) {
        setKayitsizMusteriList(kayitsizlar);
      }

      if (compDef) {
        setCompanyDefinitions(compDef);
        companyDefinitionsRef.current = compDef;
      }

      const curLookups = {
        ulkeList: cariLk?.ulkeList && cariLk.ulkeList.length > 0 ? cariLk.ulkeList : DEFAULT_ULKELER,
        uyrukList: cariLk?.ulkeList && cariLk.ulkeList.length > 0 ? cariLk.ulkeList : DEFAULT_ULKELER,
        ilList: cariLk?.ilList || [],
        ilceList: cariLk?.ilceList && cariLk.ilceList.length > 0 ? (cariLk.ilceList as any) : DEFAULT_ILCELER,
        postaKoduList:
          cariLk?.postaKoduList && cariLk.postaKoduList.length > 0
            ? (cariLk.postaKoduList as any)
            : DEFAULT_POSTA_KODLARI,
        vergiDairesiList: cariLk?.vergiDairesiList || [],
        meslekList: cariLk?.meslekList || [],
        hukukiYapiList: cariLk?.hukukiYapiList && cariLk.hukukiYapiList.length > 0 ? cariLk.hukukiYapiList : DEFAULT_HUKUKI_YAPILAR,
        bankaList:
          cariLk?.bankaList && cariLk.bankaList.length > 0
            ? cariLk.bankaList
            : DEFAULT_BANKALAR,
      };

      if (cariLk) {
        setLookupData(curLookups);
        lookupDataRef.current = curLookups;
        applyDefaultF8Detay(curLookups, compDef);
      }

      if (cariler && cariler.length > 0) {
        const trimmedCariler = cariler.map((c) => ({
          ...c,
          kod: (c.kod || "").replace(/\s+/g, " ").trim(),
          ad: (c.ad || "").replace(/\s+/g, " ").trim(),
          telefon: (c.telefon || "").trim(),
        }));
        setCariList(trimmedCariler);
      }

      let currentVezneId = 1;
      if (vezneler && vezneler.length > 0) {
        setVezneList(vezneler);
        currentVezneId = vezneler[0].id;
        setVezneId(currentVezneId);
        setVezneKod(vezneler[0].kod || "01");
        setVezneAd(vezneler[0].ad || "Ana Vezne");
      }

      setStatisticList(istatistikler);
      setSavedFisList(fisler);

      // Lazily populate search list in background in Kayıt mode
      if (!isDuzeltmeMode && fisler.length === 0) {
        DovizFisService.getFisList({ limit: 100 })
          .then((bgFisler) => {
            if (bgFisler && bgFisler.length > 0) {
              setSavedFisList(bgFisler);
            }
          })
          .catch(() => {});
      }

      fetchVezneBalances(currentVezneId).catch(() => { });

      const anlikKurSatirlari = kurTabloRes?.satirlar || [];
      const gunlukKurSatirlari = gunlukKurTabloRes?.satirlar || [];

      // Combine anlık and günlük rates (anlık takes priority, günlük fills missing rates)
      const mergedKurMap = new Map<string, KurRowItem>();
      gunlukKurSatirlari.forEach((k: KurRowItem) => {
        const cCode = (k.kod || "").toUpperCase().trim();
        if (cCode) mergedKurMap.set(cCode, k);
      });
      anlikKurSatirlari.forEach((k) => {
        const cCode = (k.kod || "").toUpperCase().trim();
        if (cCode) {
          const existing = mergedKurMap.get(cCode);
          mergedKurMap.set(cCode, {
            ...existing,
            ...k,
            efektifAlis: k.efektifAlis ?? existing?.efektifAlis ?? null,
            efektifSatis: k.efektifSatis ?? existing?.efektifSatis ?? null,
            dovizAlis: k.dovizAlis ?? existing?.dovizAlis ?? null,
            dovizSatis: k.dovizSatis ?? existing?.dovizSatis ?? null,
            parite: k.parite ?? existing?.parite ?? null,
          });
        }
      });
      const kurSatirlari = Array.from(mergedKurMap.values());
      setKurSatirlar(kurSatirlari);

      const combinedParalar: ParaItem[] = [];
      const codeSet = new Set<string>();

      paralar.forEach((p) => {
        const cCode = (p.kod || "").toUpperCase().trim();
        const kurMatch = kurSatirlari.find(
          (k) => (k.paraId && Number(k.paraId) === Number(p.id)) || (k.kod || "").toUpperCase().trim() === cCode
        );
        combinedParalar.push({
          id: p.id,
          kod: cCode,
          ad: p.ad || cCode,
          parite: parseRate(kurMatch?.parite) || parseRate(p.parite) || 1,
          dovizAlis: parseRate(kurMatch?.dovizAlis) || parseRate(p.dovizAlis) || undefined,
          dovizSatis: parseRate(kurMatch?.dovizSatis) || parseRate(p.dovizSatis) || undefined,
          efektifAlis: parseRate(kurMatch?.efektifAlis) || parseRate(p.efektifAlis) || undefined,
          efektifSatis: parseRate(kurMatch?.efektifSatis) || parseRate(p.efektifSatis) || undefined,
        });
        codeSet.add(cCode);
      });

      kurSatirlari.forEach((k) => {
        const cCode = (k.kod || "").toUpperCase().trim();
        if (!codeSet.has(cCode)) {
          combinedParalar.push({
            id: k.paraId || Math.floor(Math.random() * 1000) + 1,
            kod: cCode,
            ad: k.ad || cCode,
            parite: parseRate(k.parite) || 1,
            dovizAlis: parseRate(k.dovizAlis) || undefined,
            dovizSatis: parseRate(k.dovizSatis) || undefined,
            efektifAlis: parseRate(k.efektifAlis) || undefined,
            efektifSatis: parseRate(k.efektifSatis) || undefined,
          });
          codeSet.add(cCode);
        }
      });

      if (combinedParalar.length === 0) {
        combinedParalar.push(
          { id: 1, kod: "USD", ad: "Amerikan Doları", efektifAlis: 47.2, efektifSatis: 47.5, dovizAlis: 47.1, dovizSatis: 47.6, parite: 1 },
          { id: 2, kod: "EUR", ad: "Euro", efektifAlis: 54.7, efektifSatis: 56.4, dovizAlis: 54.5, dovizSatis: 56.6, parite: 1.08 },
          { id: 3, kod: "GBP", ad: "İngiliz Sterlini", efektifAlis: 62.1, efektifSatis: 63.8, dovizAlis: 62.0, dovizSatis: 64.0, parite: 1.25 },
          { id: 4, kod: "CHF", ad: "İsviçre Frangı", efektifAlis: 55.0, efektifSatis: 56.5, dovizAlis: 54.8, dovizSatis: 56.8, parite: 1.1 }
        );
      }
      combinedParalar.sort((a, b) => Number(a.id || 0) - Number(b.id || 0));
      setParaList(combinedParalar);

      if (isDuzeltmeMode) {
        if (queryId) {
          await loadFisById(Number(queryId));
        } else {
          // D- Döviz Fişi Düzeltme ekranı ilk açılışta boş gelir
          resetForm(curLookups, compDef);
          setCurrentIndex(-1);
        }
      } else {
        // [E- Döviz Fişi Kayıt] sayfasında temiz yeni fiş modu açılır
        resetForm(curLookups, compDef);
        applyDefaultIstatistik(tip, istatistikler, compDef, user);
      }
    } catch (err: any) {
      setNotification({
        type: "danger",
        message: "Veriler yüklenirken hata oluştu: " + (err?.message || err),
      });
    } finally {
      setIsLoadingLookups(false);
    }
  }, [fetchVezneBalances, isDuzeltmeMode, queryId]);

  useEffect(() => {
    loadLookupsAndList();
  }, [loadLookupsAndList]);

  useEffect(() => {
    hasInitialFocusedRef.current = false;
  }, [location.pathname]);

  // Auto-focus first input ONLY ONCE on screen load / route navigation
  useEffect(() => {
    if (!isLoadingLookups && !hasInitialFocusedRef.current) {
      hasInitialFocusedRef.current = true;
      const timer = setTimeout(() => {
        focusInitialInput();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isLoadingLookups, location.pathname, focusInitialInput]);

  // Load single Doviz Fis into form
  const loadFisById = async (id: number) => {
    try {
      const fis = await DovizFisService.getFisById(id);
      if (!fis) return;
      setFisId(fis.fisId);
      setIsGonderildi(true);
      setMasakResult({ matches: [], searched: false });
      setMasakModalOpen(false);

      const isGibLocked = isDuzeltmeMode ? false : Boolean((fis as any).eBelgeDurumu === 1 || (fis as any).E_BELGE_DURUMU === 1);
      setIsLocked(isGibLocked);
      if (isGibLocked) {
        setNotification({
          type: "warning",
          message: "Bu fiş GİB'e gönderilmiştir ve üzerinde değişiklik yapılamaz (Salt Okunur).",
        });
      }

      setVezneId(fis.vezneId);
      if (fis.vezneKod) setVezneKod(fis.vezneKod);
      if (fis.vezneAd) setVezneAd(fis.vezneAd);
      setTip(fis.tip);
      setTarih(fis.tarih ? fis.tarih.split("T")[0] : new Date().toISOString().split("T")[0]);
      setSaat(fis.zaman || "17:50");
      setSeriNo(fis.seriNo || "");
      setBelgeNo(fis.belgeNo || "");
      setUnvan(fis.unvan || DEFAULT_CUSTOMER_NAME);
      setCariKartId(fis.cariKartId);
      const matchedCari = (fis as any).cariKod || (cariList.find((c) => c.id === fis.cariKartId)?.kod) || "";
      setCariKod(matchedCari);
      setVergiKimlikNo(fis.vergiKimlikNo || "");
      setGelisNedeni(fis.gelisNedeni || "");
      setKurTuru(fis.kurTuru ?? 0);
      setIstatistikId(fis.istatistikId);
      setIstatistikKodu(fis.istatistikKodu || (fis.tip === 1 ? "10285" : "9249"));
      hasUserSelectedStatRef.current = true;

      lastFocusedCariKodRef.current = matchedCari;
      lastFocusedUnvanRef.current = fis.unvan || DEFAULT_CUSTOMER_NAME;
      lastFocusedVknRef.current = fis.vergiKimlikNo || "";

      if (fis.pasaportNo) setDetayPasaportNo(fis.pasaportNo);
      if (fis.babaAdi) setDetayBabaAdi(fis.babaAdi);
      if (fis.adres) setDetayAdres(fis.adres);
      if (fis.telefonNo) setDetayTelefon(fis.telefonNo);
      if ((fis as any).anneAdi) setDetayAnneAdi((fis as any).anneAdi);
      if ((fis as any).dogumTarihi) setDetayDogumTarihi((fis as any).dogumTarihi.split("T")[0]);
      if ((fis as any).dogumYeri) setDetayDogumYeri((fis as any).dogumYeri);
      if ((fis as any).kimlikSeriNo) setDetayKimlikSeriNo((fis as any).kimlikSeriNo);
      if ((fis as any).kimlikGecerlilikTarihi) setDetayGecerlilikTarihi((fis as any).kimlikGecerlilikTarihi.split("T")[0]);
      if (fis.ulkeId) {
        setDetayUlkeId(fis.ulkeId);
        const matchUlke = lookupData.ulkeList.find((u) => u.id === fis.ulkeId);
        if (matchUlke) setDetayUlke(matchUlke.ad);
        else setDetayUlke(String(fis.ulkeId));
      } else {
        const trUlke = findTurkiyeItem(lookupData.ulkeList);
        setDetayUlkeId(trUlke ? trUlke.id : null);
        setDetayUlke(trUlke?.ad || "Türkiye");
      }
      if (fis.uyrukId) {
        setDetayUyrukId(fis.uyrukId);
        const matchUyruk = lookupData.uyrukList.find((u) => u.id === fis.uyrukId);
        if (matchUyruk) setDetayUyruk(matchUyruk.ad);
        else setDetayUyruk(String(fis.uyrukId));
      } else {
        const trUyruk = findTurkiyeItem(lookupData.uyrukList);
        setDetayUyrukId(trUyruk ? trUyruk.id : null);
        setDetayUyruk(trUyruk?.ad || "Türkiye");
      }
      if ((fis as any).hukukiYapiId) {
        setDetayHukukiYapiId((fis as any).hukukiYapiId);
        const matchH = lookupData.hukukiYapiList.find((h) => h.id === (fis as any).hukukiYapiId);
        if (matchH) {
          setDetayHukukiYapi(matchH.ad || matchH.kod || String((fis as any).hukukiYapiId));
        } else {
          setDetayHukukiYapi(String((fis as any).hukukiYapiId));
        }
      } else {
        const matchH = lookupData.hukukiYapiList.find(
          (h) => String(h.kod || "").trim() === "01" || String(h.id) === "1" || (h.ad && h.ad.toLowerCase().includes("gerçek"))
        );
        setDetayHukukiYapiId(matchH ? matchH.id : 1);
        setDetayHukukiYapi(matchH?.ad || "01 - Gerçek Kişi");
      }
      if (fis.vergiDairesiId) {
        setDetayVergiDairesiId(fis.vergiDairesiId);
        const matchVd = lookupData.vergiDairesiList.find((v) => v.id === fis.vergiDairesiId);
        if (matchVd) setDetayVergiDairesi(matchVd.ad);
      } else {
        setDetayVergiDairesiId(null);
        setDetayVergiDairesi("");
      }
      if ((fis as any).ilId) {
        setDetayIlId((fis as any).ilId);
      } else {
        setDetayIlId(null);
      }
      if ((fis as any).il) {
        setDetayIl((fis as any).il);
      } else if ((fis as any).ilId) {
        const matchIl = lookupData.ilList.find((i) => i.id === (fis as any).ilId);
        if (matchIl) setDetayIl(matchIl.ad);
        else setDetayIl("");
      } else {
        setDetayIl("");
      }

      if ((fis as any).ilceId) {
        setDetayIlceId((fis as any).ilceId);
      } else {
        setDetayIlceId(null);
      }
      if ((fis as any).ilce) {
        setDetayIlce((fis as any).ilce);
      } else if ((fis as any).ilceId) {
        const ilceSource = (lookupData.ilceList && lookupData.ilceList.length > 0) ? lookupData.ilceList : DEFAULT_ILCELER;
        const matchIlce = ilceSource.find((i) => i.id === (fis as any).ilceId);
        if (matchIlce) {
          setDetayIlce(matchIlce.ad);
        } else {
          setDetayIlce("");
        }
      } else {
        setDetayIlce("");
      }

      if ((fis as any).postaKoduId) {
        setDetayPostaKoduId((fis as any).postaKoduId);
      } else {
        setDetayPostaKoduId(null);
      }
      if ((fis as any).postaKodu) {
        setDetayPostaKodu(String((fis as any).postaKodu));
      } else if ((fis as any).postaKoduId) {
        const pList = (lookupData.postaKoduList && lookupData.postaKoduList.length > 0) ? lookupData.postaKoduList : DEFAULT_POSTA_KODLARI;
        const matchPk = pList.find((p) => p.id === (fis as any).postaKoduId || String(p.kod).trim() === String((fis as any).postaKoduId).trim());
        if (matchPk) {
          setDetayPostaKodu(matchPk.kod || matchPk.ad);
        } else {
          setDetayPostaKodu(String((fis as any).postaKoduId));
        }
      } else {
        setDetayPostaKodu("");
      }
      if ((fis as any).meslekId) {
        setDetayMeslekId((fis as any).meslekId);
        const matchM = lookupData.meslekList.find((m) => m.id === (fis as any).meslekId);
        if (matchM) setDetayMeslek(matchM.ad);
      }
      if ((fis as any).bankaHesabiId) {
        setDetayBankaHesabiId((fis as any).bankaHesabiId);
        const matchB = (lookupData.bankaList && lookupData.bankaList.length > 0 ? lookupData.bankaList : cariList).find((c) => c.id === (fis as any).bankaHesabiId);
        if (matchB) setDetayBankaHesabi(matchB.ad || matchB.kod || "");
      }
      if ((fis as any).yetkiliKisi) {
        setDetayYetkiliKisi((fis as any).yetkiliKisi);
      } else if ((fis as any).yetkiliKisiId) {
        const matchC = cariList.find((c) => c.id === (fis as any).yetkiliKisiId);
        if (matchC) setDetayYetkiliKisi(matchC.yetkiliKisi || matchC.ad || "");
      }
      if ((fis as any).yetkiliKisiId) {
        setDetayYetkiliKisiId(Number((fis as any).yetkiliKisiId));
      }
      if ((fis as any).kimlikKaynagi) {
        setDetayKimlikKaynagi((fis as any).kimlikKaynagi);
      }
      if ((fis as any).sirketTuru !== undefined && (fis as any).sirketTuru !== null) {
        setDetaySirketTuru(String((fis as any).sirketTuru));
      }
      if ((fis as any).dernekAmaci) {
        setDetayDernekAmaci((fis as any).dernekAmaci);
      }
      if ((fis as any).eposta) {
        setDetayEposta((fis as any).eposta);
      }
      if ((fis as any).vekilAdi) {
        setDetayVekilAdi((fis as any).vekilAdi);
        setDetayVekil("Var");
      }
      if ((fis as any).vekilKimlikNo) {
        setDetayVekilKimlikNo((fis as any).vekilKimlikNo);
      }

      // Gümrük Beyanname Bilgileri
      setGmBeyannameNo(fis.gmBeyannameNo || (fis as any).GM_BEYANNAME_NO || "");
      setGmBeyannameTarih(
        fis.gmBeyannameTarih
          ? String(fis.gmBeyannameTarih).split("T")[0]
          : ((fis as any).GM_BEYANNAME_TARIH
            ? String((fis as any).GM_BEYANNAME_TARIH).split("T")[0]
            : "")
      );
      setGmDovizSayi(fis.gmDovizSayi || (fis as any).GM_DOVIZ_SAYI || "");
      setGmDovizTarih(
        fis.gmDovizTarih
          ? String(fis.gmDovizTarih).split("T")[0]
          : ((fis as any).GM_DOVIZ_TARIH
            ? String((fis as any).GM_DOVIZ_TARIH).split("T")[0]
            : "")
      );
      setGmTeyitSayi(fis.gmTeyitSayi || (fis as any).GM_TEYIT_SAYI || "");
      setGmTeyitTarih(
        fis.gmTeyitTarih
          ? String(fis.gmTeyitTarih).split("T")[0]
          : ((fis as any).GM_TEYIT_TARIH
            ? String((fis as any).GM_TEYIT_TARIH).split("T")[0]
            : "")
      );
      setGmFaturaNo(fis.gmFaturaNo || (fis as any).GM_FATURA_NO || "");

      if (fis.satirlar && fis.satirlar.length > 0) {
        setLines(
          fis.satirlar.map((s, idx) => {
            const rawKmvOrani = s.kmvOrani ?? (s as any).KMV_ORANI;
            const rawKmv = s.kmv ?? (s as any).KMV;
            const rawBmvOrani = s.bmvOrani ?? (s as any).BMV_ORANI;
            const rawBmv = s.bmv ?? (s as any).BMV;
            const rawKomOrani = s.komisyonOrani ?? (s as any).KOMISYON_ORANI;
            const rawKom = s.komisyon ?? (s as any).KOMISYON;
            return {
              id: `row-${idx}-${Date.now()}`,
              satirNo: s.satirNo || idx + 1,
              paraId: s.paraId,
              paraKodu: s.paraKodu || "",
              paraAdi: s.paraAdi || "",
              miktar: s.miktar != null ? formatMiktar(s.miktar) : "",
              kur: s.kur ? Number(s.kur).toFixed(kurKurusSayisi) : "",
              komisyonOrani: rawKomOrani != null && Number(rawKomOrani) > 0 ? String(rawKomOrani) : "",
              komisyon: rawKom != null && Number(rawKom) > 0 ? String(rawKom) : "",
              bmvOrani: rawBmvOrani != null && Number(rawBmvOrani) > 0 ? String(rawBmvOrani) : "",
              bmv: rawBmv != null && Number(rawBmv) > 0 ? String(rawBmv) : "",
              kmvOrani: rawKmvOrani != null && Number(rawKmvOrani) > 0 ? String(rawKmvOrani) : "",
              kmv: rawKmv != null && Number(rawKmv) > 0 ? String(rawKmv) : "",
              tutar: s.tutar != null ? Number(s.tutar).toFixed(tlKurusSayisi) : "",
            };
          })
        );
      } else {
        setLines([createEmptyRow(1)]);
      }

      await fetchVezneBalances(fis.vezneId);

      // Auto-focus initial field after loading receipt
      setTimeout(() => {
        focusInitialInput();
      }, 80);
    } catch (err: any) {
      setNotification({
        type: "danger",
        message: "Fiş detayları yüklenirken hata oluştu: " + (err?.message || err),
      });
    }
  };

  const openFisSecimModal = async () => {
    setIsLoadingFisList(true);
    setShowSearchModal(true);
    try {
      const fisler = await DovizFisService.getFisList({ limit: 100 });
      setSavedFisList(fisler);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingFisList(false);
    }
  };

  const parseRate = (val: any): number => {
    if (val === null || val === undefined) return 0;
    if (typeof val === "number") return isNaN(val) ? 0 : val;
    const num = parseFloat(String(val).replace(/,/g, "."));
    return isNaN(num) ? 0 : num;
  };

  const resolveCurrencyRate = useCallback(
    (para: ParaItem, currentTip: number, currentKurTuru: number): number => {
      // currentKurTuru: 0 => Efektif, 1 => Döviz
      // currentTip: 0 => Alış, 1 => Satış
      const efAlis = parseRate(para.efektifAlis);
      const efSatis = parseRate(para.efektifSatis);
      const dvzAlis = parseRate(para.dovizAlis);
      const dvzSatis = parseRate(para.dovizSatis);
      const parite = parseRate(para.parite) || 1;

      if (Number(currentKurTuru) === 0) {
        // Efektif seçili
        if (Number(currentTip) === 0) {
          // ALIŞ -> Efektif Alış Kuru
          if (efAlis > 0) return efAlis;
          if (dvzAlis > 0) return dvzAlis;
          return parite;
        } else {
          // SATIŞ -> Efektif Satış Kuru
          if (efSatis > 0) return efSatis;
          if (dvzSatis > 0) return dvzSatis;
          return parite;
        }
      } else {
        // Döviz seçili
        if (Number(currentTip) === 0) {
          // ALIŞ -> Döviz Alış Kuru
          if (dvzAlis > 0) return dvzAlis;
          if (efAlis > 0) return efAlis;
          return parite;
        } else {
          // SATIŞ -> Döviz Satış Kuru
          if (dvzSatis > 0) return dvzSatis;
          if (efSatis > 0) return efSatis;
          return parite;
        }
      }
    },
    []
  );

  // Satırın dolu olup olmadığını kontrol eder (Para seçilmiş, miktar > 0 ve kur > 0 olmalıdır; TL için kur aranmaz)
  const isRowFilled = useCallback((row?: GridLineItem): boolean => {
    if (!row) return false;
    const hasPara = Boolean(row.paraId || (row.paraKodu && row.paraKodu.trim() !== ""));
    const miktarNum = parseMiktar(row.miktar);
    const isTL = row.paraKodu?.trim().toUpperCase() === "TL" || row.paraKodu?.trim().toUpperCase() === "TRY" || row.paraKodu?.trim().toUpperCase() === "TRL";
    const kurNum = parseKur(row.kur);
    return hasPara && miktarNum > 0 && (isTL || kurNum > 0);
  }, []);

  // Satırın tamamen boş olup olmadığını kontrol eder
  const isRowCompletelyEmpty = useCallback((row?: GridLineItem): boolean => {
    if (!row) return true;
    const hasCode = Boolean((row.paraKodu && row.paraKodu.trim() !== "") || row.paraId || (row.paraAdi && row.paraAdi.trim() !== ""));
    const hasMiktar = Boolean(row.miktar !== "" && row.miktar !== null && row.miktar !== undefined && parseMiktar(row.miktar) > 0);
    const hasKur = Boolean(row.kur !== "" && row.kur !== null && row.kur !== undefined && parseKur(row.kur) > 0);
    const hasTutar = Boolean(row.tutar !== "" && row.tutar !== null && row.tutar !== undefined && Number(row.tutar) > 0);
    return !hasCode && !hasMiktar && !hasKur && !hasTutar;
  }, []);

  // Boş ve odakta olmayan satırları otomatik temizler (İlk satır daima korunur)
  const cleanupEmptyRows = useCallback((keepActiveIndex?: number | null) => {
    setLines((prev) => {
      if (prev.length <= 1) return prev;
      const filtered = prev.filter((r, idx) => {
        if (idx === 0) return true; // İlk satır daima korunur
        if (keepActiveIndex !== undefined && keepActiveIndex !== null && idx === keepActiveIndex) return true;
        return !isRowCompletelyEmpty(r);
      });
      if (filtered.length === prev.length) return prev;
      const finalLines = filtered.length > 0 ? filtered : [createEmptyRow(1)];
      return finalLines.map((r, i) => ({ ...r, satirNo: i + 1 }));
    });
  }, [isRowCompletelyEmpty]);

  // Dinamik sütun genişliği
  const linesMiktarColWidth = useMemo(() => {
    let maxLen = 6;
    for (const r of lines) {
      const valStr = (r.miktar != null ? String(r.miktar) : "").trim();
      const len = valStr.length;
      if (len > maxLen) {
        maxLen = len;
      }
    }
    return Math.max(120, Math.ceil(maxLen * 9.5 + 24));
  }, [lines]);

  const calculateRowTutar = useCallback((miktar: number | string, kur: number | string, paraKodu?: string): number => {
    const m = parseMiktar(miktar);
    const isTL = (paraKodu || "").toUpperCase().trim() === "TL" || (paraKodu || "").toUpperCase().trim() === "TRY" || (paraKodu || "").toUpperCase().trim() === "TRL";
    if (isTL) return m;
    const k = parseKur(kur);
    const factor = Math.pow(10, tlKurusSayisi);
    return Math.round(m * k * factor) / factor;
  }, [tlKurusSayisi]);

  const calculateRowValues = useCallback(
    (params: {
      miktar: number | string;
      kur: number | string;
      paraKodu?: string;
      kmvOrani?: number | string;
      bmvOrani?: number | string;
      komisyonOrani?: number | string;
      customTip?: number;
      customKmvMode?: number;
    }) => {
      const currentTip = params.customTip !== undefined ? params.customTip : tip;
      const compDef = companyDefinitionsRef.current || companyDefinitions;
      const kmvMode = params.customKmvMode !== undefined
        ? params.customKmvMode
        : getEffectiveKmvMode(compDef);
      const factor = Math.pow(10, tlKurusSayisi);

      const m = parseMiktar(params.miktar);
      const k = parseKur(params.kur);
      const isTL =
        (params.paraKodu || "").toUpperCase().trim() === "TL" ||
        (params.paraKodu || "").toUpperCase().trim() === "TRY" ||
        (params.paraKodu || "").toUpperCase().trim() === "TRL";

      const brutTutar = m > 0 ? (isTL ? m : Math.round(m * k * factor) / factor) : 0;

      let bmvVal = "";
      let kmvVal = "";
      let komVal = "";
      let tutarVal: number | "" = "";
      let kmvOraniVal = params.kmvOrani !== undefined && params.kmvOrani !== null ? String(params.kmvOrani) : "";

      const bmvRate = parseDecimal(params.bmvOrani || "0");
      const kmvRate = parseDecimal(kmvOraniVal || "0");
      const komRate = parseDecimal(params.komisyonOrani || "0");

      if (komRate > 0 && brutTutar > 0) {
        komVal = (Math.round(brutTutar * (komRate / 100) * factor) / factor).toFixed(tlKurusSayisi);
      }

      if (bmvRate > 0 && brutTutar > 0) {
        bmvVal = (Math.round(brutTutar * (bmvRate / 100) * factor) / factor).toFixed(tlKurusSayisi);
      }

      if (kmvMode === 1) {
        // 1 - Uygulanmasın
        tutarVal = brutTutar > 0 ? brutTutar : "";
        kmvVal = "";
      } else if (kmvMode === 2) {
        // 2 - Kura Dahil (İç Yüzde Yöntemi)
        // Müşteriden alınacak toplam = brutTutar (Miktar * Kur)
        // Satış kuru ASLA değişmez.
        if (kmvRate > 0 && brutTutar > 0) {
          const vergisizMatrah = Math.round((brutTutar / (1 + kmvRate / 100)) * factor) / factor;
          const calculatedKmv = Math.round((brutTutar - vergisizMatrah) * factor) / factor;
          tutarVal = vergisizMatrah > 0 ? vergisizMatrah : "";
          kmvVal = calculatedKmv > 0 ? calculatedKmv.toFixed(tlKurusSayisi) : "";
        } else {
          tutarVal = brutTutar > 0 ? brutTutar : "";
          kmvVal = "";
        }
      } else {
        // 3 - Kurdan Hariç (Dış Yüzde Yöntemi)
        tutarVal = brutTutar > 0 ? brutTutar : "";
        if (kmvRate > 0 && brutTutar > 0) {
          const calculatedKmv = Math.round(brutTutar * (kmvRate / 100) * factor) / factor;
          kmvVal = calculatedKmv > 0 ? calculatedKmv.toFixed(tlKurusSayisi) : "";
        } else {
          kmvVal = "";
        }
      }

      return {
        brutTutar,
        tutar: tutarVal,
        bmv: bmvVal,
        kmvOrani: kmvOraniVal,
        kmv: kmvVal,
        komisyon: komVal,
      };
    },
    [companyDefinitions, tip, tlKurusSayisi]
  );

  const handleAddRow = () => {
    if (isLocked) return;
    const lastRow = lines[lines.length - 1];
    if (!isRowFilled(lastRow)) {
      if (lastRow) {
        setInvalidRowIds((prev) => ({ ...prev, [lastRow.id]: true }));
        if (!lastRow.paraId && !lastRow.paraKodu) {
          focusCell(lines.length - 1, "kod", "select");
        } else if (!lastRow.miktar || parseMiktar(lastRow.miktar) <= 0) {
          focusCell(lines.length - 1, "miktar", "select");
        } else {
          focusCell(lines.length - 1, "kur", "select");
        }
      }
      return;
    }
    setLines((prev) => [...prev, createEmptyRow(prev.length + 1)]);
    const nextIdx = lines.length;
    setActiveRowIndex(nextIdx);
    setTimeout(() => {
      focusCell(nextIdx, "kod", "select");
    }, 50);
  };

  const handleRemoveLine = (id: string) => {
    if (isLocked) return;
    setLines((prev) => {
      const filtered = prev.filter((r) => r.id !== id);
      return filtered.length > 0
        ? filtered.map((r, i) => ({ ...r, satirNo: i + 1 }))
        : [createEmptyRow(1)];
    });
  };

  const handleDragStart = (e: React.DragEvent<HTMLTableRowElement>, index: number) => {
    if (isLocked) return;
    setDraggedRowIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", `${index}`);
  };

  const handleDragOver = (e: React.DragEvent<HTMLTableRowElement>, index: number) => {
    if (isLocked) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverRowIndex !== index) {
      setDragOverRowIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLTableRowElement>, targetIndex: number) => {
    if (isLocked) return;
    e.preventDefault();
    if (draggedRowIndex === null || draggedRowIndex === targetIndex) {
      setDraggedRowIndex(null);
      setDragOverRowIndex(null);
      return;
    }

    setLines((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(draggedRowIndex, 1);
      updated.splice(targetIndex, 0, moved);
      return updated.map((r, i) => ({ ...r, satirNo: i + 1 }));
    });

    setActiveRowIndex(targetIndex);
    setDraggedRowIndex(null);
    setDragOverRowIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedRowIndex(null);
    setDragOverRowIndex(null);
  };

  // Sağ tık menüsü eylemleri (Satırı Sil & Yeni Satır Ekle)
  useEffect(() => {
    const handleGridDelete = (e: any) => {
      if (isLocked) return;
      const rowId = e.detail?.rowId;
      if (rowId) {
        handleRemoveLine(rowId);
      }
    };
    const handleGridAdd = () => {
      if (isLocked) return;
      handleAddRow();
    };
    window.addEventListener("erp-grid-row-delete", handleGridDelete);
    window.addEventListener("erp-grid-row-add", handleGridAdd);
    return () => {
      window.removeEventListener("erp-grid-row-delete", handleGridDelete);
      window.removeEventListener("erp-grid-row-add", handleGridAdd);
    };
  }, [isLocked, handleRemoveLine, handleAddRow]);

  // Bildirimlerin belli süre sonra otomatik kaybolması
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 1750);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // e-Banka'dan fiş kesiliyorsa banka tutarı: döviz seçilince miktar boşsa kalan tutardan kurla hesaplanır (satışta BSMV dahil)
  const ebHedefRef = useRef<{ tutarTl: number; paraKodu: string; tutar: number } | null>(null);
  const ebMiktar = (rows: GridLineItem[], rowId: string, paraKodu: string, kur: number): string | null => {
    const h = ebHedefRef.current;
    if (!h || !(kur > 0)) return null;
    const hesapDovizi = h.paraKodu.toUpperCase();
    if (!["TL", "TRY"].includes(hesapDovizi) && paraKodu.toUpperCase() === hesapDovizi) return String(h.tutar);
    const carpan = tip === 1 ? 1.002 : 1;
    const kalan = h.tutarTl - rows.filter((r) => r.id !== rowId).reduce((t, r) => t + parseDecimal(r.tutar) * carpan, 0);
    return kalan > 0 ? (kalan / (kur * carpan)).toFixed(2) : null;
  };

  const handleLineFieldChange = (
    id: string,
    field: keyof GridLineItem,
    value: string
  ) => {
    if (isLocked) return;

    // Sadece geçerli pozitif sayı ve tek ondalık ayırıcı (nokta veya virgül) girişine izin ver
    if (field === "miktar") {
      value = formatMiktar(value);
    } else if (
      field === "kur" ||
      field === "komisyon" ||
      field === "komisyonOrani" ||
      field === "bmv" ||
      field === "bmvOrani" ||
      field === "kmv" ||
      field === "kmvOrani"
    ) {
      value = onlyDecimal(value);
    }

    setLines((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const updated = { ...row, [field]: value };

        if (field === "paraKodu") {
          const upper = (value || "").toUpperCase().trim();
          const matched = paraList.find((p) => p.kod.toUpperCase() === upper);
          if (matched) {
            updated.paraId = matched.id;
            updated.paraAdi = matched.ad;
            const isTL = upper === "TL" || upper === "TRY" || upper === "TRL";
            if (isTL) {
              updated.kur = "";
            } else {
              const autoKur = resolveCurrencyRate(matched, tip, kurTuru);
              if (autoKur > 0) {
                updated.kur = autoKur.toFixed(kurKurusSayisi);
              }
            }
            const em = parseMiktar(updated.miktar) > 0 ? null : ebMiktar(prev, id, matched.kod, parseKur(updated.kur));
            if (em) updated.miktar = formatMiktar(em);
          } else if (upper === "") {
            updated.paraId = 0;
            updated.paraAdi = "";
          }
        }

        const m = field === "miktar" ? value : updated.miktar;
        const k = field === "kur" ? value : updated.kur;
        const compDef = companyDefinitionsRef.current || companyDefinitions;
        const kmvMode = getEffectiveKmvMode(compDef);
        const factor = Math.pow(10, tlKurusSayisi);

        if (field === "komisyon") {
          updated.komisyon = value;
          const komVal = parseDecimal(value);
          const brut = calculateRowTutar(m, k, updated.paraKodu);
          if (brut > 0 && komVal > 0) {
            updated.komisyonOrani = (Math.round((komVal / brut) * 100 * 100) / 100).toString();
          } else if (!value) {
            updated.komisyonOrani = "";
          }
        } else if (field === "komisyonOrani") {
          updated.komisyonOrani = value;
        }

        if (field === "bmv") {
          updated.bmv = value;
        } else if (field === "bmvOrani") {
          updated.bmvOrani = value;
        }

        if (field === "kmv") {
          updated.kmv = value;
          if (tip === 1 && kmvMode === 2) {
            const brut = calculateRowTutar(m, k, updated.paraKodu);
            const userKmv = parseDecimal(value);
            const matrah = brut > userKmv ? Math.round((brut - userKmv) * factor) / factor : brut;
            updated.tutar = matrah > 0 ? matrah : "";
          }
        } else if (field === "kmvOrani") {
          updated.kmvOrani = value;
        }

        if (field !== "komisyon" && field !== "bmv" && field !== "kmv") {
          const calculated = calculateRowValues({
            miktar: m,
            kur: k,
            paraKodu: updated.paraKodu,
            kmvOrani: updated.kmvOrani,
            bmvOrani: updated.bmvOrani,
            komisyonOrani: updated.komisyonOrani,
          });
          updated.tutar = calculated.tutar;
          updated.bmv = calculated.bmv;
          updated.kmv = calculated.kmv;
          updated.kmvOrani = calculated.kmvOrani;
          updated.komisyon = calculated.komisyon;
        }

        return updated;
      })
    );
  };

  const applyStatisticToLines = useCallback((stat: StatisticItem | IstatistikSecimItem | null, currentTip: number = tip) => {
    const compDef = companyDefinitionsRef.current || companyDefinitions;
    const kmvMode = getEffectiveKmvMode(compDef);

    if (!stat) {
      setLines((prev) =>
        prev.map((row) => {
          const calculated = calculateRowValues({
            miktar: row.miktar,
            kur: row.kur,
            paraKodu: row.paraKodu,
            bmvOrani: "",
            kmvOrani: "",
            komisyonOrani: "",
            customTip: currentTip,
          });
          return {
            ...row,
            bmvOrani: "",
            bmv: "",
            kmvOrani: "",
            kmv: "",
            komisyonOrani: "",
            komisyon: "",
            tutar: calculated.tutar,
          };
        })
      );
      return;
    }

    const bmvRate = stat?.bmvOrani !== undefined && stat?.bmvOrani !== null && Number(stat.bmvOrani) > 0
      ? Number(stat.bmvOrani)
      : 0;
    const kmvRate = (kmvMode !== 1 && stat?.kmvOrani !== undefined && stat?.kmvOrani !== null && Number(stat.kmvOrani) > 0)
      ? Number(stat.kmvOrani)
      : 0;
    const komRate = stat?.komisyonOrani !== undefined && stat?.komisyonOrani !== null && Number(stat.komisyonOrani) > 0
      ? Number(stat.komisyonOrani)
      : 0;

    setLines((prev) =>
      prev.map((row) => {
        const calculated = calculateRowValues({
          miktar: row.miktar,
          kur: row.kur,
          paraKodu: row.paraKodu,
          bmvOrani: bmvRate > 0 ? bmvRate.toString() : "",
          kmvOrani: kmvRate > 0 ? kmvRate.toString() : "",
          komisyonOrani: komRate > 0 ? komRate.toString() : "",
          customTip: currentTip,
        });

        return {
          ...row,
          bmvOrani: bmvRate > 0 ? bmvRate.toString() : "",
          bmv: calculated.bmv,
          kmvOrani: kmvRate > 0 ? kmvRate.toString() : "",
          kmv: calculated.kmv,
          komisyonOrani: komRate > 0 ? komRate.toString() : "",
          komisyon: calculated.komisyon,
          tutar: calculated.tutar,
        };
      })
    );
  }, [calculateRowValues, companyDefinitions, tip]);

  const handleSelectCurrency = (rowId: string, para: ParaItem) => {
    if (isLocked) return;
    const isTL = para.kod?.toUpperCase() === "TL" || para.kod?.toUpperCase() === "TRY" || para.kod?.toUpperCase() === "TRL";
    const autoKur = isTL ? 0 : resolveCurrencyRate(para, tip, kurTuru);
    const statKod = (istatistikKodu || "").trim();
    const activeStat = statKod ? (selectedStatistic || statisticList.find((s) => (istatistikId && s.id === istatistikId) || (s.kod && s.kod === statKod))) : null;
    const compDef = companyDefinitionsRef.current || companyDefinitions;
    const kmvMode = getEffectiveKmvMode(compDef);

    const defaultBmvRate = activeStat?.bmvOrani !== undefined && activeStat?.bmvOrani !== null && Number(activeStat.bmvOrani) > 0 ? Number(activeStat.bmvOrani) : 0;
    const defaultKmvRate = (kmvMode !== 1 && activeStat?.kmvOrani !== undefined && activeStat?.kmvOrani !== null && Number(activeStat.kmvOrani) > 0) ? Number(activeStat.kmvOrani) : 0;
    const defaultKomRate = activeStat?.komisyonOrani !== undefined && activeStat?.komisyonOrani !== null && Number(activeStat.komisyonOrani) > 0 ? Number(activeStat.komisyonOrani) : 0;

    setLines((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        const m = row.miktar;
        const k = autoKur > 0 ? autoKur.toFixed(kurKurusSayisi) : "";
        const bmvOrani = defaultBmvRate > 0 ? defaultBmvRate.toString() : "";
        const kmvOrani = defaultKmvRate > 0 ? defaultKmvRate.toString() : "";
        const komOrani = defaultKomRate > 0 ? defaultKomRate.toString() : "";

        const calculated = calculateRowValues({
          miktar: m,
          kur: k,
          paraKodu: para.kod,
          bmvOrani,
          kmvOrani,
          komisyonOrani: komOrani,
        });

        return {
          ...row,
          paraId: para.id,
          paraKodu: para.kod,
          paraAdi: para.ad,
          kur: k,
          tutar: calculated.tutar,
          bmvOrani,
          bmv: calculated.bmv,
          kmvOrani,
          kmv: calculated.kmv,
          komisyonOrani: komOrani,
          komisyon: calculated.komisyon,
        };
      })
    );

    setTimeout(() => {
      const idx = lines.findIndex((r) => r.id === rowId);
      if (idx >= 0) {
        const miktarEl = document.getElementById(`grid-input-${idx}-miktar`) as HTMLInputElement | null;
        if (miktarEl) {
          miktarEl.focus();
          miktarEl.select();
        }
      }
    }, 50);
  };

  const handleSelectIstatistik = (item: IstatistikSecimItem | StatisticItem) => {
    if (isLocked) return;
    hasUserSelectedStatRef.current = true;
    setIstatistikId(item.id);
    setIstatistikKodu(item.kod);
    setSelectedStatistic(item as any);
    const dizaynTipi = Number(item.fisDizaynTipi ?? (item as any).tip ?? 0);
    setIstatistikFisDizaynTipi(dizaynTipi);
    lastFocusedIstatistikKodRef.current = item.kod;
    applyStatisticToLines(item, tip);
    setShowIstatistikModal(false);
    setTimeout(() => {
      focusCell(0, "kod");
    }, 50);
  };

  const handleSelectCustomer = (result: SelectedCustomerResult) => {
    const nextUnvan = result.unvan || DEFAULT_CUSTOMER_NAME;
    setUnvan(nextUnvan);
    const raw = result.raw as any;
    const resolvedKod = result.kod || (raw && (raw.kod || raw.cariKodu)) || "";
    setCariKod(resolvedKod);
    if (result.type === "registered") {
      setCariKartId(result.id);
    } else {
      setCariKartId(null);
    }
    const nextVkn = result.vergiKimlikNo || "";
    if (nextVkn) {
      setVergiKimlikNo(nextVkn);
    }
    if (result.adres) setDetayAdres(result.adres);
    if (result.telefon) setDetayTelefon(result.telefon);
    if (result.eposta || result.eFaturaPostaKutusu) setDetayEposta(result.eFaturaPostaKutusu || result.eposta || "");
    if (result.vergiDairesi) setDetayVergiDairesi(result.vergiDairesi);
    if (result.il) setDetayIl(result.il);
    if (result.ilce) setDetayIlce(result.ilce);

    if (raw) {
      if (raw.yetkiliKisi) setDetayYetkiliKisi(raw.yetkiliKisi);
      if (raw.yetkiliKisiId) setDetayYetkiliKisiId(Number(raw.yetkiliKisiId));
      else if (raw.id && result.type === "registered") setDetayYetkiliKisiId(Number(raw.id));

      if (raw.vergiDairesi) setDetayVergiDairesi(raw.vergiDairesi);
      if (raw.eposta) setDetayEposta(raw.eposta);
      if (raw.eFaturaPostaKutusu || raw.eFaturaPosta) setDetayEposta(raw.eFaturaPostaKutusu || raw.eFaturaPosta || raw.eposta || "");
      if (raw.telefon) setDetayTelefon(raw.telefon);
      if (raw.adres) setDetayAdres(raw.adres);
      if (raw.pasaportNo) setDetayPasaportNo(raw.pasaportNo);

      if (raw.ilId) {
        setDetayIlId(Number(raw.ilId));
        const mIl = lookupData.ilList.find((l) => l.id === Number(raw.ilId));
        if (mIl) setDetayIl(mIl.ad);
      }
      if (raw.il) setDetayIl(raw.il);

      const ilceSource = (lookupData.ilceList && lookupData.ilceList.length > 0) ? lookupData.ilceList : DEFAULT_ILCELER;
      if (raw.ilceId) {
        setDetayIlceId(Number(raw.ilceId));
        const mIlce = ilceSource.find((c) => c.id === Number(raw.ilceId));
        if (mIlce) setDetayIlce(mIlce.ad);
      }
      if (raw.ilce) setDetayIlce(raw.ilce);

      if (raw.ulkeId) {
        setDetayUlkeId(Number(raw.ulkeId));
        const mUlke = lookupData.ulkeList.find((u) => u.id === Number(raw.ulkeId));
        if (mUlke) setDetayUlke(mUlke.ad);
      } else if (raw.ulke) {
        setDetayUlke(raw.ulke);
        const mUlke = lookupData.ulkeList.find((u) => u.ad.toLowerCase() === String(raw.ulke).toLowerCase());
        if (mUlke) setDetayUlkeId(mUlke.id);
      } else if (!detayUlke || !detayUlke.trim()) {
        const trUlke = findTurkiyeItem(lookupData.ulkeList);
        setDetayUlke(trUlke?.ad || "Türkiye");
        setDetayUlkeId(trUlke ? trUlke.id : null);
      }

      if (raw.uyrukId) {
        setDetayUyrukId(Number(raw.uyrukId));
        const mUyruk = lookupData.uyrukList.find((u) => u.id === Number(raw.uyrukId));
        if (mUyruk) setDetayUyruk(mUyruk.ad);
      } else if (raw.uyruk) {
        setDetayUyruk(raw.uyruk);
        const mUyruk = lookupData.uyrukList.find((u) => u.ad.toLowerCase() === String(raw.uyruk).toLowerCase());
        if (mUyruk) setDetayUyrukId(mUyruk.id);
      } else if (!detayUyruk || !detayUyruk.trim()) {
        const trUyruk = findTurkiyeItem(lookupData.uyrukList);
        setDetayUyruk(trUyruk?.ad || "Türkiye");
        setDetayUyrukId(trUyruk ? trUyruk.id : null);
      }

      const pkSource = (lookupData.postaKoduList && lookupData.postaKoduList.length > 0) ? lookupData.postaKoduList : DEFAULT_POSTA_KODLARI;
      if (raw.postaKoduId) {
        setDetayPostaKoduId(Number(raw.postaKoduId));
        const mPk = pkSource.find((p) => p.id === Number(raw.postaKoduId));
        if (mPk) setDetayPostaKodu(mPk.kod || mPk.ad);
      }
      if (raw.postaKodu) setDetayPostaKodu(String(raw.postaKodu));
      if (raw.bankaHesabiId) setDetayBankaHesabiId(Number(raw.bankaHesabiId));
    }

    // Eğer VKN varsa ve adres/detay eksikse arka planda GİB & adres sorgula
    const cleanVknForCheck = (result.vergiKimlikNo || (raw && raw.vergiKimlikNo) || "").replace(/\D/g, "");
    if (cleanVknForCheck.length === 10 || cleanVknForCheck.length === 11) {
      ebelgeService.mukellefSorgula(cleanVknForCheck).then((mRes) => {
        if (mRes && mRes.mukellefMi) {
          const firstUser = mRes.kullanicilar?.[0];
          if (firstUser?.Alias) {
            setDetayEposta((prev) => prev || firstUser.Alias);
          }
        }
      }).catch(() => { });

      if (!result.adres && (!raw || !raw.adres)) {
        ebelgeService.aliciAdresleri(cleanVknForCheck).then((adrRes) => {
          if (Array.isArray(adrRes) && adrRes.length > 0) {
            const first = adrRes[0];
            const comb = [first.adres, first.ilce, first.il].filter(Boolean).join(" ");
            if (comb) setDetayAdres((prev) => prev || comb);
            if (first.telefon) setDetayTelefon((prev) => prev || first.telefon);
            if (first.vergiDairesi) setDetayVergiDairesi((prev) => prev || first.vergiDairesi);
            if (first.il) setDetayIl((prev) => prev || first.il);
            if (first.ilce) setDetayIlce((prev) => prev || first.ilce);
          }
        }).catch(() => { });
      }
    }

    setShowCariModal(false);

    // Müşteri seçildiğinde otomatik MASAK yaptırım / dondurulanlar kontrolü (Fiş Dizayn Tipi = 1 ise çalışmaz)
    const activeStat = selectedStatistic || statisticList.find((s) => (istatistikId && s.id === istatistikId) || (s.kod && s.kod === istatistikKodu));
    const isGayriResmi = (istatistikFisDizaynTipi === 1) || (activeStat && Number(activeStat.fisDizaynTipi) === 1);

    const selectedCustomerName = (result.unvan || "").trim();
    if (!isGayriResmi && selectedCustomerName && !selectedCustomerName.toLocaleUpperCase("tr-TR").includes("BEYAN")) {
      handleSearchMasak(selectedCustomerName, result.vergiKimlikNo || (raw && raw.vergiKimlikNo) || undefined);
    } else {
      setMasakResult({ matches: [], searched: false });
    }

    // 1. Yer: Kişi seçmede işlem tutarı MASAK sınırını (≥185.000 TL / 5.000 USD) aşıyorsa uyar (Fiş Dizayn Tipi = 1 ise uyarmaz)
    if (isMasakLimitExceeded && !isGayriResmi) {
      setShowMasakCustomerWarningModal(true);
    }
  };

  const isAnonymousCustomerName = (val?: string | null): boolean => {
    if (!val) return true;
    const s = val.trim().toLocaleUpperCase("tr-TR")
      .replace(/İ/g, "I")
      .replace(/Ğ/g, "G")
      .replace(/Ü/g, "U")
      .replace(/Ş/g, "S")
      .replace(/Ö/g, "O")
      .replace(/Ç/g, "C");
    return (
      s === "" ||
      s === "ISIM BEYAN EDILMEMISTIR" ||
      s === "ISIM BEYAN EDILMEDI" ||
      s === "NIHAI TUKETICI" ||
      s.includes("BEYAN EDILME")
    );
  };

  const findMatchingCustomers = (
    field: "kod" | "unvan" | "vkn",
    query: string
  ): { cariler: CariKartItem[]; kayitsizlar: KayitsizMusteriItem[]; totalCount: number } => {
    const q = query.toLowerCase().trim();
    if (!q) return { cariler: [], kayitsizlar: [], totalCount: 0 };

    const matchedCariler = cariList.filter((c) => {
      if (field === "kod") {
        return (c.kod || "").toLowerCase().includes(q);
      }
      if (field === "unvan") {
        return (c.ad || (c as any).unvan || "").toLowerCase().includes(q);
      }
      if (field === "vkn") {
        return (c.vergiKimlikNo || "").toLowerCase().includes(q);
      }
      return false;
    });

    const matchedKayitsizlar = kayitsizMusteriList.filter((k) => {
      if (field === "kod") return false;
      if (field === "unvan") {
        return (k.ad || k.unvan || "").toLowerCase().includes(q);
      }
      if (field === "vkn") {
        return (k.vergiKimlikNo || "").toLowerCase().includes(q);
      }
      return false;
    });

    return {
      cariler: matchedCariler,
      kayitsizlar: matchedKayitsizlar,
      totalCount: matchedCariler.length + matchedKayitsizlar.length,
    };
  };

  // TC / VKN Girişi / Değişiminde Otomatik Cari, Kayıtsız Müşteri veya GİP Sorgulama
  const handleVknLookup = useCallback(async (inputVal: string, isEnterOrBlur = false) => {
    const cleanVal = (inputVal || "").replace(/\D/g, "").slice(0, 11);
    if (!cleanVal) {
      setVergiKimlikNo("");
      setCariKod("");
      setUnvan(DEFAULT_CUSTOMER_NAME);
      setCariKartId(null);
      lastFocusedCariKodRef.current = "";
      lastFocusedUnvanRef.current = "";
      lastFocusedVknRef.current = "";
      setDetayAdres("");
      setDetayTelefon("");
      setDetayEposta("");
      setDetayBabaAdi("");
      setDetayAnneAdi("");
      return;
    }

    // 1. 10 veya 11 hane ise Birebir Eşleşme Kontrolü
    if (cleanVal.length === 10 || cleanVal.length === 11) {
      const exactCari = cariList.find((c) => (c.vergiKimlikNo || "").replace(/\D/g, "") === cleanVal);
      if (exactCari) {
        handleSelectCustomer({
          type: "registered",
          id: exactCari.id,
          kod: exactCari.kod,
          unvan: exactCari.ad || (exactCari as any).unvan || "",
          vergiKimlikNo: exactCari.vergiKimlikNo || cleanVal,
          adres: exactCari.adres || "",
          telefon: exactCari.telefon || "",
          isMukellef: Boolean((exactCari as any).eFatura || (exactCari as any).eFaturaPostaKutusu || (exactCari as any).isMukellef),
          raw: exactCari,
        });
        lastFocusedVknRef.current = cleanVal;
        return;
      }

      const exactKayitsiz = kayitsizMusteriList.find((k) => (k.vergiKimlikNo || "").replace(/\D/g, "") === cleanVal);
      if (exactKayitsiz) {
        handleSelectCustomer({
          type: "unregistered",
          id: null,
          kod: "",
          unvan: exactKayitsiz.ad || exactKayitsiz.unvan || "",
          vergiKimlikNo: exactKayitsiz.vergiKimlikNo || cleanVal,
          adres: exactKayitsiz.adres || "",
          telefon: exactKayitsiz.telefon || "",
          raw: exactKayitsiz,
        });
        lastFocusedVknRef.current = cleanVal;
        return;
      }

      // GİB / GİP Mukellef Sorgulama (10 veya 11 hane ise)
      try {
        const res = await ebelgeService.mukellefSorgula(cleanVal);
        if (res && res.mukellefMi && res.kullanicilar && res.kullanicilar.length > 0) {
          const title = (res.kullanicilar[0].Title || "").trim();
          if (title) {
            setUnvan(title);
            setCariKod("");
            setCariKartId(null);
            lastFocusedCariKodRef.current = "";
            lastFocusedUnvanRef.current = title;
            lastFocusedVknRef.current = cleanVal;
            if (res.kullanicilar[0].Alias) {
              setDetayEposta(res.kullanicilar[0].Alias);
            }
            try {
              const adrRes = await ebelgeService.aliciAdresleri(cleanVal);
              if (Array.isArray(adrRes) && adrRes.length > 0) {
                const first = adrRes[0];
                const comb = [first.adres, first.ilce, first.il].filter(Boolean).join(" ");
                if (comb) setDetayAdres(comb);
                if (first.telefon) setDetayTelefon(first.telefon);
              }
            } catch { }
            return;
          }
        }
      } catch { }

      // Hem DB'de hem GİP'te yoksa
      setCariKod("");
      setUnvan(DEFAULT_CUSTOMER_NAME);
      setCariKartId(null);
      lastFocusedCariKodRef.current = "";
      lastFocusedUnvanRef.current = "";
      lastFocusedVknRef.current = cleanVal;
      setDetayAdres("");
      setDetayTelefon("");
      setDetayEposta("");
      return;
    }

    // 2. 10 haneden kısa ise ve Enter / Blur yapılmışsa arama modalı aç
    if (isEnterOrBlur && cleanVal.length >= 2) {
      const { cariler, kayitsizlar, totalCount } = findMatchingCustomers("vkn", cleanVal);
      if (totalCount === 1) {
        if (cariler.length === 1) {
          const single = cariler[0];
          handleSelectCustomer({
            type: "registered",
            id: single.id,
            kod: single.kod,
            unvan: single.ad || (single as any).unvan || "",
            vergiKimlikNo: single.vergiKimlikNo || cleanVal,
            adres: single.adres || "",
            telefon: single.telefon || "",
            isMukellef: Boolean((single as any).eFatura || (single as any).eFaturaPostaKutusu || (single as any).isMukellef),
            raw: single,
          });
          lastFocusedVknRef.current = single.vergiKimlikNo || cleanVal;
          return;
        } else if (kayitsizlar.length === 1) {
          const singleK = kayitsizlar[0];
          handleSelectCustomer({
            type: "unregistered",
            id: null,
            kod: "",
            unvan: singleK.ad || singleK.unvan || "",
            vergiKimlikNo: singleK.vergiKimlikNo || cleanVal,
            adres: singleK.adres || "",
            telefon: singleK.telefon || "",
            raw: singleK,
          });
          lastFocusedVknRef.current = singleK.vergiKimlikNo || cleanVal;
          return;
        }
      } else if (totalCount > 1) {
        lastModalCallerRef.current = "vkn";
        setCariSearchTerm(cleanVal);
        setCariSearchField("vkn");
        setShowCariModal(true);
        return;
      }
    }

    // Kullanıcı yazmaya / silmeye devam ediyor (10 haneden az), arama yapmadan eski cariyi temizle
    setCariKod("");
    setUnvan(DEFAULT_CUSTOMER_NAME);
    setCariKartId(null);
    lastFocusedCariKodRef.current = "";
    lastFocusedUnvanRef.current = "";
  }, [cariList, kayitsizMusteriList, findMatchingCustomers, handleSelectCustomer]);

  // Cari Kodu Girişi / Değişiminde Otomatik Eşleşme veya Sıfırlama
  const handleCariKodLookup = useCallback((inputVal: string) => {
    const val = (inputVal || "").trim();
    if (!val) {
      setCariKod("");
      setUnvan(DEFAULT_CUSTOMER_NAME);
      setCariKartId(null);
      lastFocusedCariKodRef.current = "";
      return;
    }
    const { cariler, totalCount } = findMatchingCustomers("kod", val);
    if (totalCount === 1 && cariler.length === 1) {
      const single = cariler[0];
      handleSelectCustomer({
        type: "registered",
        id: single.id,
        kod: single.kod,
        unvan: single.ad || (single as any).unvan || "",
        vergiKimlikNo: single.vergiKimlikNo || "",
        adres: single.adres || "",
        telefon: single.telefon || "",
        raw: single,
      });
      lastFocusedCariKodRef.current = single.kod || "";
    } else if (totalCount === 0) {
      // Bulunamadıysa cari kodunu sıfırla / eski cariyi temizle
      setCariKod("");
      setUnvan(DEFAULT_CUSTOMER_NAME);
      setCariKartId(null);
      lastFocusedCariKodRef.current = "";
    }
  }, [findMatchingCustomers, handleSelectCustomer]);

  const handleSelectFromKurListesi = (para: ParaItem) => {
    if (isLocked) return;
    setShowKurListesiModal(false);

    let targetIdx = activeRowIndex >= 0 && activeRowIndex < lines.length ? activeRowIndex : 0;
    const currentRow = lines[targetIdx];
    const isCurrentEmpty =
      !currentRow ||
      (!currentRow.paraId &&
        (!currentRow.paraKodu || currentRow.paraKodu.trim() === "") &&
        (!currentRow.miktar || currentRow.miktar === ""));

    let rowIdToUse = currentRow?.id;
    if (!isCurrentEmpty) {
      const emptyRow = lines.find(
        (r) =>
          !r.paraId &&
          (!r.paraKodu || r.paraKodu.trim() === "") &&
          (!r.miktar || r.miktar === "")
      );
      if (emptyRow) {
        rowIdToUse = emptyRow.id;
        targetIdx = lines.findIndex((r) => r.id === emptyRow.id);
      } else {
        const newRow = createEmptyRow(lines.length + 1);
        setLines((prev) => [...prev, newRow]);
        rowIdToUse = newRow.id;
        targetIdx = lines.length;
      }
    }

    setActiveRowIndex(targetIdx);
    if (rowIdToUse) {
      handleSelectCurrency(rowIdToUse, para);
    }
  };

  const handleApplyTlHesabi = (data: {
    para: ParaItem;
    miktar: number;
    kur: number;
    tutar: number;
  }) => {
    if (isLocked) return;
    setShowTlHesabiModal(false);

    let targetIdx = activeRowIndex >= 0 && activeRowIndex < lines.length ? activeRowIndex : 0;
    const currentRow = lines[targetIdx];
    const isCurrentEmpty =
      !currentRow ||
      (!currentRow.paraId &&
        (!currentRow.paraKodu || currentRow.paraKodu.trim() === "") &&
        (!currentRow.miktar || currentRow.miktar === ""));

    const statKod = (istatistikKodu || "").trim();
    const activeStat = statKod ? (selectedStatistic || statisticList.find((s) => (istatistikId && s.id === istatistikId) || (s.kod && s.kod === statKod))) : null;
    const compDef = companyDefinitionsRef.current || companyDefinitions;
    const kmvMode = getEffectiveKmvMode(compDef);

    const bmvRate = activeStat?.bmvOrani !== undefined && activeStat?.bmvOrani !== null && Number(activeStat.bmvOrani) > 0 ? Number(activeStat.bmvOrani) : 0;
    const kmvRate = (kmvMode !== 1 && activeStat?.kmvOrani !== undefined && activeStat?.kmvOrani !== null && Number(activeStat.kmvOrani) > 0) ? Number(activeStat.kmvOrani) : 0;
    const komRate = activeStat?.komisyonOrani !== undefined && activeStat?.komisyonOrani !== null && Number(activeStat.komisyonOrani) > 0 ? Number(activeStat.komisyonOrani) : 0;

    const bmvOrani = bmvRate > 0 ? bmvRate.toString() : "";
    const kmvOrani = kmvRate > 0 ? kmvRate.toString() : "";
    const komOrani = komRate > 0 ? komRate.toString() : "";

    const calculated = calculateRowValues({
      miktar: data.miktar,
      kur: data.kur,
      paraKodu: data.para.kod,
      bmvOrani,
      kmvOrani,
      komisyonOrani: komOrani,
    });

    if (isCurrentEmpty && currentRow) {
      setLines((prev) =>
        prev.map((r, i) =>
          i === targetIdx
            ? {
              ...r,
              paraId: data.para.id,
              paraKodu: data.para.kod,
              paraAdi: data.para.ad,
              miktar: formatMiktar(data.miktar),
              kur: data.kur.toFixed(kurKurusSayisi),
              tutar: calculated.tutar,
              bmvOrani,
              bmv: calculated.bmv,
              kmvOrani: calculated.kmvOrani,
              kmv: calculated.kmv,
              komisyonOrani: komOrani,
              komisyon: calculated.komisyon,
            }
            : r
        )
      );
    } else {
      const newRow: GridLineItem = {
        ...createEmptyRow(lines.length + 1),
        paraId: data.para.id,
        paraKodu: data.para.kod,
        paraAdi: data.para.ad,
        miktar: formatMiktar(data.miktar),
        kur: data.kur.toFixed(kurKurusSayisi),
        tutar: calculated.tutar,
        bmvOrani,
        bmv: calculated.bmv,
        kmvOrani: calculated.kmvOrani,
        kmv: calculated.kmv,
        komisyonOrani: komOrani,
        komisyon: calculated.komisyon,
      };
      setLines((prev) => [...prev, newRow]);
      targetIdx = lines.length;
    }

    setActiveRowIndex(targetIdx);
    setTimeout(() => {
      const miktarEl = document.getElementById(`grid-input-${targetIdx}-miktar`) as HTMLInputElement | null;
      if (miktarEl) {
        miktarEl.focus();
        miktarEl.select();
      }
    }, 50);
  };

  // Calculations for summary boxes
  const totalTutar = useMemo(() => {
    return lines.reduce((acc, row) => {
      const t = parseDecimal(row.tutar);
      return acc + t;
    }, 0);
  }, [lines]);

  const calculatedBsmv = useMemo(() => {
    if (tip !== 1) return 0;
    return lines.reduce((acc, row) => {
      const b = parseDecimal(row.bmv);
      return acc + b;
    }, 0);
  }, [lines, tip]);

  const totalKmv = useMemo(() => {
    if (tip !== 1) return 0;
    return lines.reduce((acc, row) => {
      const k = parseDecimal(row.kmv);
      return acc + k;
    }, 0);
  }, [lines, tip]);

  const totalKomisyon = useMemo(() => {
    return lines.reduce((acc, row) => {
      const k = parseDecimal(row.komisyon);
      return acc + k;
    }, 0);
  }, [lines]);

  // Toplam Masraf: Tablodaki satırların toplam BMV, KMV ve Komisyon toplamıdır.
  const totalMasraf = useMemo(() => {
    const factor = Math.pow(10, tlKurusSayisi);
    return Math.round((calculatedBsmv + totalKmv + totalKomisyon) * factor) / factor;
  }, [calculatedBsmv, totalKmv, totalKomisyon, tlKurusSayisi]);

  // Son Toplam / Alışta: (Toplam Tutar - Masraflar), Satışta: (Toplam Tutar + Toplam KMV + Toplam BMV)
  const sonToplam = useMemo(() => {
    const factor = Math.pow(10, tlKurusSayisi);
    if (tip === 1) {
      return Math.round((totalTutar + totalKmv + calculatedBsmv) * factor) / factor;
    } else {
      return Math.round((totalTutar - totalMasraf) * factor) / factor;
    }
  }, [totalTutar, totalKmv, calculatedBsmv, totalMasraf, tip, tlKurusSayisi]);

  // 185.000 TL veya 5.000 USD MASAK Yasal Sınır Kontrolü
  const isMasakLimitExceeded = useMemo(() => {
    // İstatistik tanımlarında Fiş Dizayn Tipi = 1 (Gayriresmi/Özel) ise MASAK kontrolü ve limitleri çalışmaz
    const activeStat = selectedStatistic || statisticList.find((s) => (istatistikId && s.id === istatistikId) || (s.kod && s.kod === istatistikKodu));
    const currentDizaynTipi = istatistikFisDizaynTipi ?? (activeStat ? Number(activeStat.fisDizaynTipi) : null);
    if (currentDizaynTipi === 1) {
      return false;
    }

    // Fişteki geçerli döviz satırları
    const validLines = lines.filter((l) => {
      const m = parseMiktar(l.miktar);
      return (l.paraId || (l.paraKodu && l.paraKodu.trim() !== "")) && m > 0;
    });

    if (validLines.length === 0) return false;

    let totalUsdEquivalent = 0;
    let hasUsdLimitDirect = false;

    const usdPara = paraList.find((p) => p.kod?.toUpperCase() === "USD");
    const activeUsdRate = usdPara ? resolveCurrencyRate(usdPara, tip, kurTuru) : 0;

    validLines.forEach((l) => {
      const kod = (l.paraKodu || "").trim().toUpperCase();
      const m = parseMiktar(l.miktar);
      const k = parseKur(l.kur);

      if (kod === "USD" || kod === "$") {
        totalUsdEquivalent += m;
        if (m >= 5000) hasUsdLimitDirect = true;
      } else if (kod === "TL" || kod === "TRY" || kod === "TRL" || kod === "") {
        // TL satırı
      } else {
        // EUR, GBP gibi diğer yabancı para birimleri -> USD karşılığı
        const lineTl = m * (k > 0 ? k : 1);
        if (activeUsdRate > 0) {
          totalUsdEquivalent += lineTl / activeUsdRate;
        } else if (k > 0) {
          totalUsdEquivalent += lineTl / 35; // Fallback USD rate
        }
      }
    });

    const tlTotal = Math.abs(sonToplam);
    const tutarTotal = Number(totalTutar) || 0;

    // 185.000 TL veya 5.000 USD eşiği kontrolü
    return (
      hasUsdLimitDirect ||
      totalUsdEquivalent >= 5000 ||
      tlTotal >= 185000 ||
      tutarTotal >= 185000
    );
  }, [sonToplam, totalTutar, lines, paraList, tip, kurTuru, resolveCurrencyRate, statisticList, istatistikId, istatistikKodu]);

  // MASAK Malvarlığı Dondurulanlar Bloke Durumu
  const isMasakBlocked = Boolean(masakResult.searched && masakResult.matches && masakResult.matches.length > 0);

  // MASAK Listelerinden İsim veya TC/VKN ile Sorgulama
  const handleSearchMasak = async (explicitName?: string, explicitId?: string) => {
    const rawName = explicitName !== undefined ? explicitName : unvan;
    const rawId = explicitId !== undefined ? explicitId : vergiKimlikNo;
    const isAnon = isAnonymousCustomerName(rawName);

    const cleanName = isAnon ? "" : rawName.trim();
    const cleanId = (rawId || "").trim();

    if (!cleanName && !cleanId) {
      setNotification({
        type: "warning",
        message: "MASAK sorgusu yapabilmek için lütfen bir Müşteri Adı / Ünvan veya T.C. Kimlik / VKN giriniz.",
      });
      return;
    }

    try {
      setIsSearchingMasak(true);
      const res = await MasakService.sorgula({
        ad: cleanName || undefined,
        kimlikNo: cleanId || undefined,
        limit: 30,
      });

      const matches = res?.kayitlar || [];
      setMasakResult({
        queriedName: cleanName || cleanId,
        queriedId: cleanId,
        matches,
        searched: true,
      });

      if (matches.length > 0) {
        setMasakModalOpen(true);
        setNotification({
          type: "danger",
          message: `🚨 DİKKAT: "${cleanName || cleanId}" için MASAK listelerinde ${matches.length} eşleşme bulundu!`,
        });
      } else {
        setMasakModalOpen(false);
      }
    } catch (err: any) {
      setNotification({
        type: "danger",
        message: `MASAK sorgusu yapılamadı: ${err?.message || "Sunucu bağlantı hatası"}`,
      });
    } finally {
      setIsSearchingMasak(false);
    }
  };

  // F9) Banknot Say (Para Sayma) Açılış Kontrolü
  const handleOpenBanknotSay = useCallback(() => {
    // Fiş gridindeki geçerli döviz satırlarını kontrol et
    const validLines = lines.filter((l) => {
      const m = parseMiktar(l.miktar);
      return (l.paraId || (l.paraKodu && l.paraKodu.trim() !== "")) && m > 0;
    });

    if (validLines.length === 0) {
      alert("İşlem yapılacak döviz kalemi bulunamadı");
      return;
    }

    setShowParaSaymaModal(true);
  }, [lines]);

  // F9 Para Sayma Modalı için Fiş Özeti (Dövizler + Türk Lirası)
  const getParaSaymaCurrencies = useCallback((): ParaSaymaCurrencyItem[] => {
    const validLines = lines.filter((l) => {
      const m = parseMiktar(l.miktar);
      return (l.paraId || (l.paraKodu && l.paraKodu.trim() !== "")) && m > 0;
    });

    const map = new Map<string, ParaSaymaCurrencyItem>();

    validLines.forEach((l) => {
      const kod = (l.paraKodu || "").trim().toUpperCase();
      const miktar = parseMiktar(l.miktar);
      if (!kod || miktar <= 0) return;

      if (map.has(kod)) {
        const existing = map.get(kod)!;
        existing.sayilacak += miktar;
      } else {
        map.set(kod, {
          paraId: l.paraId,
          kod: kod,
          ad: l.paraAdi || kod,
          sayilacak: miktar,
        });
      }
    });

    const list = Array.from(map.values());

    // Türk Lirası satırı ekle (Net ödenecek / alınacak TL tutarı)
    const tlTutar = Math.abs(sonToplam);
    list.push({
      kod: "TRY",
      ad: "Türk lirası",
      sayilacak: tlTutar,
    });

    return list;
  }, [lines, sonToplam]);

  /**
   * Fiş tipine göre varsayılan istatistiği belirler:
   * 1. Firma Tanımları (Alış: ALIS_ISTATISTIK_ID, Satış: SATIS_ISTATISTIK_ID)
   * 2. Kullanıcı Tanımları (buyStatCode / sellStatCode)
   * 3. Fiş tipine uygun ilk kayıt (Alış: 0 veya 2, Satış: 1 veya 2)
   * 4. Sabit varsayılan kodlar (Alış: 9249, Satış: 10285)
   */
  const applyDefaultIstatistik = (
    fisTipi: number,
    istatistikler: StatisticItem[],
    compDef: TodvzTanimDto | null,
    currentUser: typeof user
  ) => {
    if (!istatistikler || istatistikler.length === 0) {
      const fallbackKod = fisTipi === 0 ? "9249" : "10285";
      setIstatistikId(null);
      setIstatistikKodu(fallbackKod);
      lastFocusedIstatistikKodRef.current = fallbackKod;
      applyStatisticToLines(null, fisTipi);
      return;
    }

    const setMatched = (item: StatisticItem) => {
      setIstatistikId(item.id);
      setIstatistikKodu(item.kod || "");
      setSelectedStatistic(item);
      setIstatistikFisDizaynTipi(Number(item.fisDizaynTipi ?? 0));
      lastFocusedIstatistikKodRef.current = item.kod || "";
      applyStatisticToLines(item, fisTipi);
    };

    // 1. Firma Tanımları Kontrolü (Öncelikli)
    if (compDef) {
      const companyStatId =
        fisTipi === 0 ? compDef.ALIS_ISTATISTIK_ID : compDef.SATIS_ISTATISTIK_ID;
      if (companyStatId) {
        const foundCompany = istatistikler.find(
          (s) => s.id === Number(companyStatId) || Number(s.id) === Number(companyStatId)
        );
        if (foundCompany) {
          setMatched(foundCompany);
          return;
        }
      }
    }

    // 2. Kullanıcı Tanımları Kontrolü
    const userStatCode = fisTipi === 0 ? currentUser?.buyStatCode : currentUser?.sellStatCode;
    if (userStatCode && userStatCode.trim()) {
      const cleanUserCode = userStatCode.trim().toLowerCase();
      const foundUser = istatistikler.find(
        (s) =>
          (s.kod && s.kod.toLowerCase() === cleanUserCode) ||
          String(s.id) === cleanUserCode
      );
      if (foundUser) {
        setMatched(foundUser);
        return;
      }
    }

    // 3. Fiş tipine göre filtrelenmiş listedeki İLK VERİ (Alış ise ilk alış/ortak verisi, Satış ise ilk satış/ortak verisi)
    const matchingList = istatistikler.filter((s) => {
      const fType = Number(s.fisTipi);
      if (fisTipi === 0) {
        return fType === 0 || fType === 2;
      } else {
        return fType === 1 || fType === 2;
      }
    });

    if (matchingList.length > 0) {
      setMatched(matchingList[0]);
      return;
    }

    // 4. Fallback: sabit varsayılan kodlar (Alış→9249, Satış→10285)
    const fallbackKod = fisTipi === 0 ? "9249" : "10285";
    const fallbackMatched = istatistikler.find(
      (s) => (s.kod || "").trim() === fallbackKod
    );
    if (fallbackMatched) {
      setMatched(fallbackMatched);
      return;
    }

    // 5. Hiçbiri yoksa varsayılan kodu direkt yaz
    setIstatistikId(null);
    setIstatistikKodu(fallbackKod);
    lastFocusedIstatistikKodRef.current = fallbackKod;
    applyStatisticToLines(null, fisTipi);
  };

  // Tip, İstatistik Listesi veya Firma Tanımları değiştiğinde varsayılan istatistik seç
  useEffect(() => {
    if (!isDuzeltmeMode && statisticList.length > 0 && !hasUserSelectedStatRef.current) {
      applyDefaultIstatistik(tip, statisticList, companyDefinitions, user);
    }
  }, [tip, statisticList, companyDefinitions, isDuzeltmeMode, user]);

  const handleTipChange = (newTip: number) => {
    setTip(newTip);
    hasUserSelectedStatRef.current = false;
    // Tip değişince istatistiği de güncelle — tüm güncel değerleri parametre olarak geçir
    applyDefaultIstatistik(newTip, statisticList, companyDefinitions, user);
    setLines((prev) =>
      prev.map((row) => {
        let rate = parseFloat(String(row.kur).replace(/,/g, ".")) || 0;
        if (row.paraId || (row.paraKodu && row.paraKodu.trim() !== "")) {
          const found = paraList.find(
            (p) =>
              (row.paraId && p.id === row.paraId) ||
              (row.paraKodu && p.kod.toUpperCase() === row.paraKodu.trim().toUpperCase())
          );
          if (found) {
            rate = resolveCurrencyRate(found, newTip, kurTuru);
          }
        }
        const kurStr = rate > 0 ? rate.toFixed(kurKurusSayisi) : row.kur;
        const calculated = calculateRowValues({
          miktar: row.miktar,
          kur: kurStr,
          paraKodu: row.paraKodu,
          bmvOrani: row.bmvOrani,
          kmvOrani: row.kmvOrani,
          komisyonOrani: row.komisyonOrani,
          customTip: newTip,
        });
        return {
          ...row,
          kur: kurStr,
          tutar: calculated.tutar,
          bmv: calculated.bmv,
          kmv: calculated.kmv,
          kmvOrani: calculated.kmvOrani,
          komisyon: calculated.komisyon,
        };
      })
    );
  };

  const handleKurTuruChange = (newKurTuru: number) => {
    if (isLocked) return;
    setKurTuru(newKurTuru);
    setLines((prev) =>
      prev.map((row) => {
        if (!row.paraId && (!row.paraKodu || row.paraKodu.trim() === "")) return row;
        const found = paraList.find(
          (p) =>
            (row.paraId && p.id === row.paraId) ||
            (row.paraKodu && p.kod.toUpperCase() === row.paraKodu.trim().toUpperCase())
        );
        if (!found) return row;
        const newRate = resolveCurrencyRate(found, tip, newKurTuru);
        const kurStr = newRate > 0 ? newRate.toFixed(kurKurusSayisi) : row.kur;
        const calculated = calculateRowValues({
          miktar: row.miktar,
          kur: kurStr,
          paraKodu: row.paraKodu,
          bmvOrani: row.bmvOrani,
          kmvOrani: row.kmvOrani,
          komisyonOrani: row.komisyonOrani,
        });
        return {
          ...row,
          kur: kurStr,
          tutar: calculated.tutar,
          bmv: calculated.bmv,
          kmv: calculated.kmv,
          kmvOrani: calculated.kmvOrani,
          komisyon: calculated.komisyon,
        };
      })
    );
  };

  // Keyboard navigation across all grid cells
  const handleCellKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    field: GridColumnKey
  ) => {
    // F-tuşları global key listener tarafından yönetilir
    if (["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10"].includes(e.key)) {
      return;
    }

    // ESC altındaki " tuşuna basınca üst satırdaki hücre değerini kopyala (Sadece tablolarda geçerli)
    if (e.key === '"' || e.key === '“' || e.key === '”' || e.key === '„' || e.key === '«' || e.key === '»' || e.key === 'é' || e.key === 'É' || e.key === '`' || e.key === '´' || e.key === '§' || e.code === "Backquote" || (e.code === "Digit2" && e.shiftKey) || e.keyCode === 222 || e.keyCode === 192) {
      e.preventDefault();
      e.stopPropagation();
      if (rowIndex > 0) {
        const prevRow = lines[rowIndex - 1];
        const currentRow = lines[rowIndex];
        if (field === "kod") {
          const prevCode = (prevRow.paraKodu || "").trim();
          handleLineFieldChange(currentRow.id, "paraKodu", prevCode);
        } else if (field === "miktar") {
          handleLineFieldChange(currentRow.id, "miktar", prevRow.miktar ? String(prevRow.miktar) : "");
        } else if (field === "kur") {
          handleLineFieldChange(currentRow.id, "kur", prevRow.kur ? String(prevRow.kur) : "");
        } else if (field === "komisyonOrani") {
          handleLineFieldChange(currentRow.id, "komisyonOrani", prevRow.komisyonOrani ? String(prevRow.komisyonOrani) : "");
        } else if (field === "komisyon") {
          handleLineFieldChange(currentRow.id, "komisyon", prevRow.komisyon ? String(prevRow.komisyon) : "");
        } else if (field === "kmvOrani") {
          handleLineFieldChange(currentRow.id, "kmvOrani", prevRow.kmvOrani ? String(prevRow.kmvOrani) : "");
        } else if (field === "kmv") {
          handleLineFieldChange(currentRow.id, "kmv", prevRow.kmv ? String(prevRow.kmv) : "");
        }
        setTimeout(() => focusCell(rowIndex, field, "select"), 20);
      }
      return;
    }

    if (field !== "kod") {
      blockNonNumericKeys(e, true);
    }

    const el = e.currentTarget;
    const maxRow = lines.length - 1;

    // Görünür olan navigasyon sütunlarının dinamik sırası (% BMV ve BMV salt okunur olduğundan atlanır)
    const isRowTL = lines[rowIndex]?.paraKodu?.trim().toUpperCase() === "TL" || lines[rowIndex]?.paraKodu?.trim().toUpperCase() === "TRY" || lines[rowIndex]?.paraKodu?.trim().toUpperCase() === "TRL";
    const visibleCols: GridColumnKey[] = isRowTL ? ["kod", "miktar"] : ["kod", "miktar", "kur"];
    if (colVisibility.komisyonOrani) visibleCols.push("komisyonOrani");
    if (colVisibility.komisyon) visibleCols.push("komisyon");
    if (colVisibility.kmvOrani) visibleCols.push("kmvOrani");
    if (colVisibility.kmv) visibleCols.push("kmv");

    const currentVisIdx = visibleCols.indexOf(field);
    const isLastVisibleCol = currentVisIdx === visibleCols.length - 1;

    // Ctrl+Enter veya Alt+Enter: Hangi hücrede olursa olsun satırı tamamlayıp bir alt satıra geç (veya satır doluysa yeni satır aç)
    if (e.key === "Enter" && (e.ctrlKey || e.altKey)) {
      e.preventDefault();
      if (rowIndex >= lines.length - 1) {
        handleAddRow();
      } else {
        const targetIdx = rowIndex + 1;
        cleanupEmptyRows(targetIdx);
        setActiveRowIndex(targetIdx);
        focusCell(targetIdx, "kod", "select");
      }
      return;
    }

    // 1. Enter Tuşu: Bir sonraki alana geçiş, son görünür alanda ise ancak satır DOLUYSA yeni satır açıp yeni satırın kod alanına geçiş
    if (e.key === "Enter") {
      e.preventDefault();
      if (field === "kod") {
        const currentCode = (lines[rowIndex]?.paraKodu || "").trim();
        const currentRow = lines[rowIndex];

        if (!currentCode) {
          // Boş ise dürbün açılmaz, bir sonraki alana geçilir
          focusCell(rowIndex, "miktar", "select");
          return;
        }

        const t = currentCode.toLowerCase();
        // Arama yap: Sadece Para kodu ile eşleşenler
        const matched = paraList.filter(
          (p) => (p.kod || "").toLowerCase().includes(t)
        );

        // Yazılana göre tek veri var ise doğrudan seç ve miktar alanına geç
        if (matched.length === 1) {
          lastModalCallerRef.current = null;
          lastParaModalRowIndexRef.current = null;
          handleSelectCurrency(currentRow.id, matched[0]);
          focusCell(rowIndex, "miktar", "select");
          return;
        }

        // Birden fazla veri varsa veya hiç eşleşme yoksa modalı girilen terimle aç
        lastModalCallerRef.current = "paraGrid";
        lastParaModalRowIndexRef.current = rowIndex;
        setParaModalRowId(currentRow.id);
        setParaSearchTerm(currentCode);
        setShowParaModal(true);
        return;
      }

      if (isLastVisibleCol) {
        // Satırın son alanında Enter'a basıldı:
        if (rowIndex >= lines.length - 1) {
          handleAddRow();
        } else {
          // Altında zaten satır varsa bir alt satırın kod alanına geç
          const targetIdx = rowIndex + 1;
          cleanupEmptyRows(targetIdx);
          setActiveRowIndex(targetIdx);
          focusCell(targetIdx, "kod", "select");
        }
        return;
      } else {
        // Sıradaki görünür sütuna geç (örn: kod -> miktar -> kur)
        const nextCol = visibleCols[currentVisIdx + 1];
        if (nextCol) {
          focusCell(rowIndex, nextCol, "select");
        }
        return;
      }
    }

    // Tab Tuşu: Son görünür sütunda basıldığında satır doluysa yeni satır açıp kod hücresine geçsin
    if (e.key === "Tab" && !e.shiftKey && isLastVisibleCol) {
      e.preventDefault();
      if (rowIndex >= lines.length - 1) {
        handleAddRow();
      } else {
        const targetIdx = rowIndex + 1;
        cleanupEmptyRows(targetIdx);
        setActiveRowIndex(targetIdx);
        focusCell(targetIdx, "kod", "select");
      }
      return;
    }

    // 2. Sağ Yön Oku: Yazı varsa sonuna kadar ilerler, sonundaysa bir sonraki sütuna / satıra kayar
    if (e.key === "ArrowRight") {
      const len = el.value ? el.value.length : 0;
      const isAtEnd = el.selectionStart === len && el.selectionEnd === len;
      if (!isAtEnd) {
        return;
      }

      e.preventDefault();
      if (!isLastVisibleCol) {
        const nextCol = visibleCols[currentVisIdx + 1];
        if (nextCol) focusCell(rowIndex, nextCol, "start");
        return;
      } else {
        // Satırın son sütunundayken sağa basınca bir sonraki satıra geçsin (eğer satır doluysa ve son satırsa yeni satır açsın)
        if (rowIndex < maxRow) {
          const nextIdx = rowIndex + 1;
          cleanupEmptyRows(nextIdx);
          setActiveRowIndex(nextIdx);
          focusCell(nextIdx, "kod", "start");
        } else {
          handleAddRow();
        }
        return;
      }
    }

    // 3. Sol Yön Oku: Yazı varsa başına kadar geriler, başındaysa bir önceki sütuna / satıra kayar
    if (e.key === "ArrowLeft") {
      const isAtStart = el.selectionStart === 0 && el.selectionEnd === 0;
      if (!isAtStart) {
        return;
      }

      e.preventDefault();
      if (currentVisIdx > 0) {
        const prevCol = visibleCols[currentVisIdx - 1];
        if (prevCol) focusCell(rowIndex, prevCol, "end");
        return;
      } else {
        // İlk sütunda (kod) sola basınca bir önceki satırın son görünür sütununa geçsin
        if (rowIndex > 0) {
          const prevIdx = rowIndex - 1;
          cleanupEmptyRows(prevIdx);
          const lastVisible = visibleCols[visibleCols.length - 1];
          setActiveRowIndex(prevIdx);
          focusCell(prevIdx, lastVisible, "end");
        }
        return;
      }
    }

    // 4. Aşağı Yön Oku: Aynı sütunda alt satıra geçer, son satırdaysa ancak satır DOLUYSA yeni satır açar
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (rowIndex < maxRow) {
        const targetIdx = rowIndex + 1;
        cleanupEmptyRows(targetIdx);
        setActiveRowIndex(targetIdx);
        focusCell(targetIdx, field, "select");
      } else {
        handleAddRow();
      }
      return;
    }

    // 5. Yukarı Yön Oku: Aynı sütunda üst satıra geçer
    if (e.key === "ArrowUp" && rowIndex > 0) {
      e.preventDefault();
      const targetIdx = rowIndex - 1;
      cleanupEmptyRows(targetIdx);
      setActiveRowIndex(targetIdx);
      focusCell(targetIdx, field, "select");
      return;
    }
  };

  const handleToolbarNew = () => {
    if (isDuzeltmeMode) {
      navigate("/vezne/doviz-fisi-kayit");
    } else {
      resetForm();
      setArbitrajActiveInfo(null);
      applyDefaultIstatistik(tip, statisticList, companyDefinitions, user);
    }
  };

  const handleToolbarSave = async (forceMasakApprove = false, andDirectPrint = false) => {
    // MASAK Malvarlığı Dondurulanlar Bloke Kontrolü (Kesinlikle Kayıt Yapılamaz!)
    if (isMasakBlocked) {
      setNotification({
        type: "danger",
        message: `⛔ İŞLEM ENGELLENDİ: "${masakResult.queriedName || unvan}" MASAK Malvarlığı Dondurulanlar listesindedir! Bu kişi/kuruluş için fiş kaydedilemez.`,
      });
      setMasakModalOpen(true);
      return;
    }

    if (isLocked && !isDuzeltmeMode) {
      setNotification({
        type: "warning",
        message: "GİB'e gönderilmiş olan bu fiş değiştirilemez.",
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    // 1. Header validations
    if (!tarih || !tarih.trim()) {
      setNotification({
        type: "warning",
        message: "Lütfen fiş tarihini giriniz.",
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (!saat || !saat.trim()) {
      setNotification({
        type: "warning",
        message: "Lütfen işlem saatini giriniz.",
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (!vezneId || Number(vezneId) <= 0) {
      setNotification({
        type: "warning",
        message: "Lütfen bir vezne seçiniz.",
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (!istatistikKodu || !istatistikKodu.trim()) {
      setNotification({
        type: "warning",
        message: "Fişte istatistik kodu zorunludur. Lütfen F3 kısayolu veya İstatistik Seçim modalından bir istatistik seçiniz.",
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const activeVezneId = (vezneId && Number(vezneId) > 0) ? Number(vezneId) : 1;

    // 2. Line validations
    const hasAnyInput = lines.some(
      (r) =>
        r.paraKodu.trim() !== "" ||
        r.paraAdi.trim() !== "" ||
        parseMiktar(r.miktar) > 0
    );

    const validLines = lines.filter((row) => {
      const m = parseMiktar(row.miktar);
      const k = parseKur(row.kur);
      return (row.paraId > 0 || row.paraKodu.trim() !== "") && m > 0 && k > 0;
    });

    if (!hasAnyInput || validLines.length === 0) {
      return;
    }

    for (let i = 0; i < lines.length; i++) {
      const row = lines[i];
      const hasCode = row.paraId > 0 || row.paraKodu.trim() !== "" || row.paraAdi.trim() !== "";
      const m = parseMiktar(row.miktar);
      const k = parseKur(row.kur);

      // If user typed some information in this row
      if (hasCode || m > 0 || k > 0) {
        if (!hasCode) {
          setNotification({
            type: "warning",
            message: `${i + 1}. satırda miktar veya kur girilmiş ancak döviz cinsi seçilmemiştir. Lütfen para birimini seçiniz.`,
          });
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
        if (m <= 0) {
          setNotification({
            type: "warning",
            message: `${i + 1}. satırdaki (${row.paraKodu || row.paraAdi || "Döviz"}) için miktar 0 veya boş olamaz. Lütfen geçerli bir miktar giriniz.`,
          });
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
        if (k <= 0) {
          setNotification({
            type: "warning",
            message: `${i + 1}. satırdaki (${row.paraKodu || row.paraAdi || "Döviz"}) için kur 0 veya boş olamaz. Lütfen geçerli bir kur oranı giriniz.`,
          });
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
      }
    }

    // 185.000 TL veya 5.000 USD MASAK Yasal Sınır Kontrolleri (Kaydetmede Kontrol)
    if (isMasakLimitExceeded) {
      const isAnon = isAnonymousCustomerName(unvan);

      const missingFields: string[] = [];
      if (isAnon) missingFields.push("İsim / Ünvan");
      if (!vergiKimlikNo || !vergiKimlikNo.trim()) missingFields.push("T.C. Kimlik / VKN");
      if (!detayAdres || !detayAdres.trim()) missingFields.push("Müşteri Adresi");
      if (!detayHukukiYapi && !detayHukukiYapiId) missingFields.push("Hukuki Yapı");

      if (missingFields.length > 0) {
        setMasakMissingFields(missingFields);
        setShowMasakMissingModal(true);
        return;
      }

      // Sınır aşıldığında MASAK sorgulamasını otomatik çalıştır
      try {
        const cleanName = isAnon ? "" : unvan.trim();
        const cleanId = (vergiKimlikNo || "").trim();
        if (cleanName || cleanId) {
          const res = await MasakService.sorgula({
            ad: cleanName || undefined,
            kimlikNo: cleanId || undefined,
            limit: 15,
          });
          const matches = res?.kayitlar || [];
          setMasakResult({
            queriedName: cleanName || cleanId,
            queriedId: cleanId,
            matches,
            searched: true,
          });
          if (matches.length > 0) {
            setMasakModalOpen(true);
            setNotification({
              type: "danger",
              message: `🚨 DİKKAT: "${cleanName || cleanId}" için MASAK listelerinde ${matches.length} eşleşme bulundu!`,
            });
          }
        }
      } catch (err) {
        console.error("Auto MASAK check error:", err);
      }

      // Kullanıcıdan MASAK limit onayı al
      if (!forceMasakApprove) {
        setShowMasakConfirmModal(true);
        return;
      }
    }

    try {
      let finalIlId = (detayIlId && Number(detayIlId) > 0) ? Number(detayIlId) : undefined;
      if (!finalIlId && detayIl.trim()) {
        const matchIl = lookupData.ilList.find(
          (i) => i.ad.toLowerCase().trim() === detayIl.toLowerCase().trim() ||
            String(i.kod || "").trim() === detayIl.trim() ||
            String(i.id) === detayIl.trim()
        );
        if (matchIl) finalIlId = Number(matchIl.id);
      }

      let finalIlceId = (detayIlceId && Number(detayIlceId) > 0) ? Number(detayIlceId) : undefined;
      if (!finalIlceId && detayIlce.trim()) {
        const ilceSource = (lookupData.ilceList && lookupData.ilceList.length > 0) ? lookupData.ilceList : DEFAULT_ILCELER;
        const found = ilceSource.find(
          (x) => x.ad.toLowerCase().trim() === detayIlce.toLowerCase().trim() ||
            String(x.kod || "").trim() === detayIlce.trim() ||
            String(x.id) === detayIlce.trim()
        );
        if (found) finalIlceId = Number(found.id);
      }

      let finalPostaKoduId = (detayPostaKoduId && Number(detayPostaKoduId) > 0) ? Number(detayPostaKoduId) : undefined;
      if (!finalPostaKoduId && detayPostaKodu.trim()) {
        const pList = (lookupData.postaKoduList && lookupData.postaKoduList.length > 0) ? lookupData.postaKoduList : DEFAULT_POSTA_KODLARI;
        const foundPk = pList.find(
          (x) => String(x.kod).trim() === detayPostaKodu.trim() ||
            String(x.id) === detayPostaKodu.trim() ||
            x.ad.toLowerCase().includes(detayPostaKodu.toLowerCase().trim())
        );
        if (foundPk) finalPostaKoduId = Number(foundPk.id);
      }

      let finalBankaHesabiId = (detayBankaHesabiId && Number(detayBankaHesabiId) > 0) ? Number(detayBankaHesabiId) : undefined;
      if (!finalBankaHesabiId && detayBankaHesabi.trim()) {
        const bList = (lookupData.bankaList && lookupData.bankaList.length > 0) ? lookupData.bankaList : cariList;
        const foundB = bList.find(
          (x) => String(x.kod || "").trim() === detayBankaHesabi.trim() ||
            (x.ad || "").toLowerCase().includes(detayBankaHesabi.toLowerCase().trim()) ||
            ((x as any).unvan || "").toLowerCase().includes(detayBankaHesabi.toLowerCase().trim()) ||
            String(x.id) === detayBankaHesabi.trim()
        );
        if (foundB) finalBankaHesabiId = Number(foundB.id);
      }

      let finalHukukiYapiId = (detayHukukiYapiId && Number(detayHukukiYapiId) > 0) ? Number(detayHukukiYapiId) : undefined;
      if (!finalHukukiYapiId && detayHukukiYapi.trim()) {
        const matchH = lookupData.hukukiYapiList.find(
          (h) => h.ad.toLowerCase().trim() === detayHukukiYapi.toLowerCase().trim() ||
            String(h.kod || "").trim() === detayHukukiYapi.trim() ||
            String(h.id) === detayHukukiYapi.trim()
        );
        if (matchH) finalHukukiYapiId = Number(matchH.id);
      }

      let finalYetkiliKisiId = (detayYetkiliKisiId && Number(detayYetkiliKisiId) > 0) ? Number(detayYetkiliKisiId) : undefined;
      if (!finalYetkiliKisiId && detayYetkiliKisi.trim()) {
        const foundY = cariList.find(
          (x) => (x.yetkiliKisi || "").toLowerCase().trim() === detayYetkiliKisi.toLowerCase().trim() ||
            (x.ad || "").toLowerCase().trim() === detayYetkiliKisi.toLowerCase().trim() ||
            String(x.kod || "").trim() === detayYetkiliKisi.trim()
        );
        if (foundY) finalYetkiliKisiId = Number(foundY.id);
      }

      let finalVergiDairesiId = (detayVergiDairesiId && Number(detayVergiDairesiId) > 0) ? Number(detayVergiDairesiId) : undefined;
      if (!finalVergiDairesiId && detayVergiDairesi.trim()) {
        const matchVd = lookupData.vergiDairesiList.find(
          (v) => v.ad.toLowerCase().trim() === detayVergiDairesi.toLowerCase().trim() ||
            String(v.kod || "").trim() === detayVergiDairesi.trim() ||
            String(v.id) === detayVergiDairesi.trim()
        );
        if (matchVd) finalVergiDairesiId = Number(matchVd.id);
      }

      let finalMeslekId = (detayMeslekId && Number(detayMeslekId) > 0) ? Number(detayMeslekId) : undefined;
      if (!finalMeslekId && detayMeslek.trim()) {
        const matchM = lookupData.meslekList.find(
          (m) => m.ad.toLowerCase().trim() === detayMeslek.toLowerCase().trim() ||
            String(m.kod || "").trim() === detayMeslek.trim() ||
            String(m.id) === detayMeslek.trim()
        );
        if (matchM) finalMeslekId = Number(matchM.id);
      }

      let finalUlkeId = (detayUlkeId && Number(detayUlkeId) > 0) ? Number(detayUlkeId) : undefined;
      if (!finalUlkeId && detayUlke.trim()) {
        const matchU = lookupData.ulkeList.find(
          (u) => u.ad.toLowerCase().trim() === detayUlke.toLowerCase().trim() ||
            String(u.kod || "").trim() === detayUlke.trim() ||
            String(u.id) === detayUlke.trim()
        );
        if (matchU) finalUlkeId = Number(matchU.id);
      }

      let finalUyrukId = (detayUyrukId && Number(detayUyrukId) > 0) ? Number(detayUyrukId) : undefined;
      if (!finalUyrukId && detayUyruk.trim()) {
        const matchUy = lookupData.uyrukList.find(
          (u) => u.ad.toLowerCase().trim() === detayUyruk.toLowerCase().trim() ||
            String(u.kod || "").trim() === detayUyruk.trim() ||
            String(u.id) === detayUyruk.trim()
        );
        if (matchUy) finalUyrukId = Number(matchUy.id);
      }

      const isAnonymous = isAnonymousCustomerName(unvan);

      const finalUnvan = isAnonymous ? DEFAULT_CUSTOMER_NAME : unvan.trim();

      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const liveTarih = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      const liveSaat = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
      const finalTarih = isDuzeltmeMode ? tarih : liveTarih;
      const finalZaman = isDuzeltmeMode ? saat : liveSaat;

      const payload: SaveDovizFisPayload = {
        fisId: fisId || undefined,
        vezneId: activeVezneId,
        tip,
        tarih: finalTarih,
        zaman: finalZaman,
        seriNo: seriNo.trim() || undefined,
        belgeNo: belgeNo.trim() || undefined,
        gelisNedeni: gelisNedeni.trim() || undefined,
        kurTuru,
        istatistikId: istatistikId || undefined,
        cariKartId: (cariKartId && Number(cariKartId) > 0) ? Number(cariKartId) : null,
        unvan: finalUnvan,
        kisilikTipi: isAnonymous ? 0 : (detayCariTipi === "Firma" ? 2 : 1),
        ulkeId: finalUlkeId,
        uyrukId: finalUyrukId,
        hukukiYapiId: finalHukukiYapiId,
        vergiDairesiId: finalVergiDairesiId,
        ilId: finalIlId,
        il: detayIl.trim() || undefined,
        ilceId: finalIlceId,
        ilce: detayIlce.trim() || undefined,
        postaKoduId: finalPostaKoduId,
        postaKodu: detayPostaKodu.trim() || undefined,
        meslekId: finalMeslekId,
        bankaHesabiId: finalBankaHesabiId,
        vergiKimlikNo: vergiKimlikNo.trim() || undefined,
        pasaportNo: detayPasaportNo.trim() || undefined,
        babaAdi: detayBabaAdi.trim() || undefined,
        anneAdi: detayAnneAdi.trim() || undefined,
        adres: detayAdres.trim() || undefined,
        telefonNo: detayTelefon.trim() || undefined,
        eposta: detayEposta.trim() || undefined,
        vekilTuru: detayVekil === "Var" ? 1 : 0,
        vekilKisilikTipi: detayVekilTipi === "Firma" ? 2 : 1,
        vekilAdi: detayVekilAdi.trim() || undefined,
        vekilKimlikNo: detayVekilKimlikNo.trim() || undefined,
        dogumTarihi: detayDogumTarihi.trim() || undefined,
        dogumYeri: detayDogumYeri.trim() || undefined,
        kimlikSeriNo: detayKimlikSeriNo.trim() || undefined,
        kimlikGecerlilikTarihi: detayGecerlilikTarihi.trim() || undefined,
        sirketTuru: detaySirketTuru ? Number(detaySirketTuru) || undefined : undefined,
        dernekAmaci: detayDernekAmaci.trim() || undefined,
        yetkiliKisi: detayYetkiliKisi.trim() || undefined,
        yetkiliKisiId: finalYetkiliKisiId,
        kimlikKaynagi: detayKimlikKaynagi.trim() || undefined,
        masakListesindeVar: (masakResult.matches && masakResult.matches.length > 0) ? true : false,
        gmBeyannameNo: gmBeyannameNo.trim() || undefined,
        gmBeyannameTarih: (gmBeyannameTarih.trim() && !gmBeyannameTarih.startsWith("1899") && !gmBeyannameTarih.startsWith("1900") && !gmBeyannameTarih.startsWith("0001")) ? gmBeyannameTarih.trim() : undefined,
        gmDovizSayi: gmDovizSayi.trim() || undefined,
        gmDovizTarih: (gmDovizTarih.trim() && !gmDovizTarih.startsWith("1899") && !gmDovizTarih.startsWith("1900") && !gmDovizTarih.startsWith("0001")) ? gmDovizTarih.trim() : undefined,
        gmTeyitSayi: gmTeyitSayi.trim() || undefined,
        gmTeyitTarih: (gmTeyitTarih.trim() && !gmTeyitTarih.startsWith("1899") && !gmTeyitTarih.startsWith("1900") && !gmTeyitTarih.startsWith("0001")) ? gmTeyitTarih.trim() : undefined,
        gmFaturaNo: gmFaturaNo.trim() || undefined,
        toplamTutar: totalTutar,
        odemeTutari: sonToplam,
        satirlar: validLines.map((l, idx) => {
          let pId = Number(l.paraId);
          if (!pId || pId <= 0) {
            const match = paraList.find((p) => p.kod.toUpperCase() === (l.paraKodu || "").toUpperCase());
            pId = match ? match.id : 1;
          }
          const m = parseMiktar(l.miktar);
          const k = parseKur(l.kur);
          return {
            satirNo: idx,
            paraId: pId,
            paraKodu: l.paraKodu || "",
            paraAdi: l.paraAdi || "",
            miktar: m,
            kur: k,
            iscilik: 0,
            giseKuru: k,
            tutar: parseDecimal(l.tutar || "0"),
            komisyonOrani: parseDecimal(l.komisyonOrani || "0"),
            komisyon: parseDecimal(l.komisyon || "0"),
            bmvOrani: parseDecimal(l.bmvOrani || "0"),
            bmv: parseDecimal(l.bmv || "0"),
            kmvOrani: parseDecimal(l.kmvOrani || "0"),
            kmv: parseDecimal(l.kmv || "0"),
            kdvOrani: 0,
            kdv: 0,
          };
        }),
      };

      const saved = await DovizFisService.saveFis(payload);

      await fetchVezneBalances(vezneId);
      const freshList = await DovizFisService.getFisList({ limit: 500 });
      setSavedFisList(freshList);

      const usdPara = paraList.find((p) => p.kod?.toUpperCase() === "USD");
      const currentSnapshot = {
        fisId: saved.fisId || fisId,
        tip,
        tarih: finalTarih,
        saat: finalZaman,
        seriNo: saved.seriNo || seriNo,
        belgeNo: saved.belgeNo || belgeNo,
        unvan: finalUnvan,
        vergiKimlikNo,
        detayIl,
        detayIlce,
        detayUyruk,
        detayPasaportNo,
        detayMeslek,
        detayCariTipi,
        vezneKod,
        istatistikKodu,
        lines: lines.map((l) => ({
          paraKodu: l.paraKodu,
          paraAdi: l.paraAdi,
          miktar: l.miktar,
          kur: l.kur,
          tutar: l.tutar,
          bmv: l.bmv,
          kmv: l.kmv,
          kmvOrani: l.kmvOrani,
          komisyon: l.komisyon,
        })),
        toplamTutar: totalTutar,
        odemeTutari: sonToplam,
        bsmvTutari: calculatedBsmv,
        kmvTutari: totalKmv,
        komisyonTutari: totalKomisyon,
        giseUsdKuru: usdPara ? resolveCurrencyRate(usdPara, tip, kurTuru) : 1,
      };
      setPrintSnapshot(currentSnapshot);

      if (andDirectPrint) {
        const resolved = resolveEffectivePrinter({
          pageType: "doviz",
          tip,
          vezne: vezneList.find((v) => v.id === vezneId) || (vezneList.length > 0 ? vezneList[0] : null),
          user,
          printers,
        });
        const isPos = resolved.recommendedPrintType === "POS";
        const dovizHtml = generateDovizReceiptHtml({
          fis: currentSnapshot,
          company: companyDefinitions,
        });
        await triggerSilentPrint({
          html: dovizHtml,
          printerName: resolved.printer?.cihazAdi || resolved.printer?.ad || null,
          copies: resolved.kopyaSayisi || 1,
          isPos,
          title: `Doviz_Fisi_${currentSnapshot.seriNo || currentSnapshot.belgeNo || currentSnapshot.fisId || ""}`,
        });
      }

      if (isDuzeltmeMode) {
        setNotification({
          type: "success",
          message: `Döviz Fişi (${saved.seriNo || saved.belgeNo || saved.fisId}) Başarıyla Güncellendi.${andDirectPrint ? " Yazıcıya gönderildi." : ""}`,
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
        await loadFisById(saved.fisId);
        const idx = freshList.findIndex((f) => f.fisId === saved.fisId);
        setCurrentIndex(idx >= 0 ? idx : freshList.length - 1);
      } else {
        setNotification({
          type: "success",
          message: `Döviz Fişi (${saved.seriNo || saved.belgeNo || saved.fisId}) Başarıyla Kaydedildi.${andDirectPrint ? " Yazıcıya gönderildi." : ""} Yeni fiş kaydına geçildi.`,
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
        if (await ebFis.kaydedildi(saved.fisId)) return;
        // Kayıt sonrasında otomatik yeni kayıt moduna geç ve tüm alanları temizle
        resetForm();
        applyDefaultIstatistik(tip, statisticList, companyDefinitions, user);
      }
    } catch (err: any) {
      console.error("Döviz Fişi Kaydetme Hatası:", err);
      let userFriendlyMsg = "Fiş kaydedilirken bir hata oluştu.";

      if (err?.response?.data?.message) {
        userFriendlyMsg = err.response.data.message;
      } else if (err?.message) {
        userFriendlyMsg = err.message;
      }

      // Convert any leftover technical database/code jargon to friendly messages
      if (userFriendlyMsg.includes("ISKELE") || userFriendlyMsg.includes("Invalid object name") || userFriendlyMsg.includes("TODVZ_")) {
        userFriendlyMsg = "Veritabanı kayıt işlemi sırasında bir tablo hatası oluştu. Lütfen satırları kontrol edip tekrar deneyiniz.";
      } else if (userFriendlyMsg.includes("Network Error") || userFriendlyMsg.includes("Failed to fetch") || userFriendlyMsg.includes("ECONNREFUSED")) {
        userFriendlyMsg = "Sunucu bağlantısı kurulamadı. Lütfen sunucunun ve internet bağlantınızın açık olduğunu kontrol ediniz.";
      }

      setNotification({
        type: "danger",
        message: userFriendlyMsg,
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleToolbarDelete = async () => {
    if (isLocked) {
      setNotification({
        type: "warning",
        message: "GİB'e gönderilmiş olan bu fiş silinemez.",
      });
      return;
    }
    if (!fisId) {
      setNotification({
        type: "warning",
        message: "Silinecek kayıt seçili değil.",
      });
      return;
    }
    if (!window.confirm("Bu döviz fişini silmek istediğinize emin misiniz?")) {
      return;
    }

    try {
      await DovizFisService.deleteFis(fisId);
      setNotification({
        type: "success",
        message: "Döviz fişi başarıyla silindi.",
      });
      await fetchVezneBalances(vezneId);
      const freshList = await DovizFisService.getFisList({ limit: 100 });
      setSavedFisList(freshList);
      if (freshList.length > 0) {
        await loadFisById(freshList[0].fisId);
      } else {
        resetForm();
      }
    } catch (err: any) {
      setNotification({
        type: "danger",
        message: "Fiş silinirken hata oluştu: " + (err?.message || err),
      });
    }
  };

  const handleFirst = async () => {
    try {
      const freshList = await DovizFisService.getFisList({ limit: 500 });
      if (freshList && freshList.length > 0) {
        setSavedFisList(freshList);
        const idx = 0;
        setCurrentIndex(idx);
        await loadFisById(freshList[idx].fisId);
        return;
      }
    } catch {
      // fallback
    }
    if (savedFisList.length === 0) return;
    const idx = 0;
    setCurrentIndex(idx);
    await loadFisById(savedFisList[idx].fisId);
  };

  const handlePrev = async () => {
    if (savedFisList.length === 0) return;
    const nextIdx = Math.max(0, currentIndex - 1);
    setCurrentIndex(nextIdx);
    await loadFisById(savedFisList[nextIdx].fisId);
  };

  const handleNext = async () => {
    if (savedFisList.length === 0) return;
    const nextIdx = Math.min(savedFisList.length - 1, currentIndex + 1);
    setCurrentIndex(nextIdx);
    await loadFisById(savedFisList[nextIdx].fisId);
  };

  const handleLast = async () => {
    try {
      const freshList = await DovizFisService.getFisList({ limit: 500 });
      if (freshList && freshList.length > 0) {
        setSavedFisList(freshList);
        const idx = freshList.length - 1;
        setCurrentIndex(idx);
        await loadFisById(freshList[idx].fisId);
        return;
      }
    } catch {
      // fallback
    }
    if (savedFisList.length === 0) return;
    const idx = savedFisList.length - 1;
    setCurrentIndex(idx);
    await loadFisById(savedFisList[idx].fisId);
  };

  // ─── Arbitraj Sonucunu Döviz Fişine Aktarma (F7) ──────────────────────────
  const handleApplyArbitrajToDovizFis = useCallback(
    (result: ArbitrajApplyResult) => {
      if (result.islemYonu === "alis") {
        setTip(0); // Alış
        const targetPara =
          paraList.find((p) => p.kod.toUpperCase() === result.girisPara.kod.toUpperCase()) || paraList[0];

        if (targetPara) {
          const m = result.girisMiktar;
          const liveKur = targetPara.efektifAlis || targetPara.dovizAlis || result.girisKur;
          const k = liveKur > 0 ? liveKur : (result.parite > 0 ? result.parite : 1.0);
          setLines([
            {
              id: String(Date.now()),
              satirNo: 1,
              paraId: targetPara.id,
              paraKodu: targetPara.kod,
              paraAdi: targetPara.ad,
              miktar: m,
              kur: k,
              komisyonOrani: 0,
              komisyon: 0,
              bmvOrani: 0,
              bmv: 0,
              kmvOrani: 0,
              kmv: 0,
              tutar: m * k,
            },
          ]);
        }
      } else {
        setTip(1); // Satış
        const targetPara =
          paraList.find((p) => p.kod.toUpperCase() === result.cikisPara.kod.toUpperCase()) || paraList[0];

        if (targetPara) {
          const m = result.cikisMiktar;
          const liveKur = targetPara.efektifSatis || targetPara.dovizSatis || result.cikisKur;
          const k = liveKur > 0 ? liveKur : (result.parite > 0 ? result.parite : 1.0);
          setLines([
            {
              id: String(Date.now()),
              satirNo: 1,
              paraId: targetPara.id,
              paraKodu: targetPara.kod,
              paraAdi: targetPara.ad,
              miktar: m,
              kur: k,
              komisyonOrani: 0,
              komisyon: 0,
              bmvOrani: 0,
              bmv: 0,
              kmvOrani: 0,
              kmv: 0,
              tutar: m * k,
            },
          ]);
        }
      }

      if (result.cariId !== undefined && result.cariId !== null) {
        setCariKartId(result.cariId);
      }
      if (result.cariKodu) {
        setCariKod(result.cariKodu);
      }
      if (result.cariUnvan) {
        setUnvan(result.cariUnvan);
      }
      if (result.vknTckn) {
        setVergiKimlikNo(result.vknTckn);
      }
      if (result.istatistikKodu) {
        setIstatistikKodu(result.istatistikKodu);
      }

      setArbitrajActiveInfo({
        girisKod: result.girisPara.kod,
        cikisKod: result.cikisPara.kod,
        parite: result.parite,
        islemYonu: result.islemYonu,
      });

      setNotification({
        type: "success",
        message: `Arbitraj işlemi (${result.girisPara.kod} -> ${result.cikisPara.kod}) fiş satırlarına aktarıldı.`,
      });
    },
    [paraList]
  );

  // Keyboard shortcut listener (F1..F10, ESC)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key ? e.key.toUpperCase() : "";
      const isEscape = key === "ESCAPE" || e.code === "Escape" || e.keyCode === 27;

      // Eğer ekranda açık bir modal varsa kısayolları çalıştırma (Escape hariç)
      if (document.querySelector(".modal.show")) {
        if (!isEscape) return;
      }

      const isF1 = key === "F1" || e.code === "F1" || e.keyCode === 112;
      const isF2 = key === "F2" || e.code === "F2" || e.keyCode === 113;
      const isF3 = key === "F3" || e.code === "F3" || e.keyCode === 114;
      const isF4 = key === "F4" || e.code === "F4" || e.keyCode === 115;
      const isF5 = key === "F5" || e.code === "F5" || e.keyCode === 116;
      const isF6 = key === "F6" || e.code === "F6" || e.keyCode === 117;
      const isF7 = key === "F7" || e.code === "F7" || e.keyCode === 118;
      const isF8 = key === "F8" || e.code === "F8" || e.keyCode === 119;
      const isF9 = key === "F9" || e.code === "F9" || e.keyCode === 120;
      const isF10 = key === "F10" || e.code === "F10" || e.keyCode === 121;
      const isF12 = key === "F12" || e.code === "F12" || e.keyCode === 123;

      if (isF12) {
        const activeEl = document.activeElement as HTMLElement | null;
        if (triggerAdjacentBinoculars(activeEl)) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }

      // F8 Detay Modalı açar
      if (isF8) {
        e.preventDefault();
        e.stopPropagation();
        handleOpenDetayModal();
        return;
      }

      if (isEscape) {
        if (showDetayModal) {
          e.preventDefault();
          setShowDetayModal(false);
          return;
        }
        if (activeLookupType !== null) {
          e.preventDefault();
          setActiveLookupType(null);
          return;
        }
        if (showKurListesiModal) {
          e.preventDefault();
          setShowKurListesiModal(false);
          return;
        }
        if (showVezneBakiyeModal) {
          e.preventDefault();
          setShowVezneBakiyeModal(false);
          return;
        }
        if (showTlHesabiModal) {
          e.preventDefault();
          setShowTlHesabiModal(false);
          return;
        }
        if (showParaSaymaModal) {
          e.preventDefault();
          setShowParaSaymaModal(false);
          return;
        }
        if (showIstatistikModal) {
          e.preventDefault();
          setShowIstatistikModal(false);
          return;
        }
        if (showArbitrajModal) {
          e.preventDefault();
          setShowArbitrajModal(false);
          return;
        }
        if (showGumrukModal) {
          e.preventDefault();
          setShowGumrukModal(false);
          return;
        }
        if (showPrintModal) {
          e.preventDefault();
          setShowPrintModal(false);
          return;
        }
        if (showCariModal) {
          e.preventDefault();
          setShowCariModal(false);
          return;
        }
        if (showSearchModal) {
          e.preventDefault();
          setShowSearchModal(false);
          return;
        }
        return;
      }

      const closeAllModals = () => {
        setShowKurListesiModal(false);
        setShowVezneBakiyeModal(false);
        setShowTlHesabiModal(false);
        setShowDetayModal(false);
        setShowParaSaymaModal(false);
        setShowIstatistikModal(false);
        setShowArbitrajModal(false);
        setShowSearchModal(false);
        setShowCariModal(false);
        setShowVezneModal(false);
        setShowParaModal(false);
        setShowGumrukModal(false);
        setShowPrintModal(false);
        setActiveLookupType(null);
      };

      if (isF1) {
        e.preventDefault();
        e.stopPropagation();
        closeAllModals();
        handleToolbarSave();
      } else if (isF2) {
        if (isDuzeltmeMode) {
          e.preventDefault();
          e.stopPropagation();
          closeAllModals();
          handleToolbarDelete();
        }
      } else if (isF3) {
        e.preventDefault();
        e.stopPropagation();
        closeAllModals();
        setShowIstatistikModal(true);
      } else if (isF4) {
        e.preventDefault();
        e.stopPropagation();
        closeAllModals();
        setShowKurListesiModal(true);
      } else if (isF5) {
        e.preventDefault();
        e.stopPropagation();
        closeAllModals();
        fetchVezneBalances(vezneId);
        setShowVezneBakiyeModal(true);
      } else if (isF6) {
        e.preventDefault();
        e.stopPropagation();
        closeAllModals();
        setShowTlHesabiModal(true);
      } else if (isF7) {
        e.preventDefault();
        e.stopPropagation();
        closeAllModals();
        setShowArbitrajModal(true);
      } else if (isF9) {
        e.preventDefault();
        e.stopPropagation();
        closeAllModals();
        setIsPendingDirectPrint(false);
        setShowPrintModal(true);
      } else if (isF10) {
        e.preventDefault();
        e.stopPropagation();
        closeAllModals();
        handleToolbarSave(false, true);
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [
    handleToolbarSave,
    handleToolbarDelete,
    isDuzeltmeMode,
    vezneId,
    showDetayModal,
    activeLookupType,
    showKurListesiModal,
    showVezneBakiyeModal,
    showTlHesabiModal,
    showParaSaymaModal,
    showIstatistikModal,
    showArbitrajModal,
    showPrintModal,
    showCariModal,
    showSearchModal,
    showVezneModal,
    showParaModal,
    handleOpenDetayModal,
    handleOpenBanknotSay,
    fetchVezneBalances,
  ]);

  // Detay Modal Field KeyDown Navigation (Enter, ArrowDown, ArrowUp, F4)
  const handleDetayFieldKeyDown = (
    e: React.KeyboardEvent<HTMLElement>,
    currentIdx: number,
    lookupType?: DetayLookupType
  ) => {
    if (e.key === "F4" || (e.altKey && e.key === "ArrowDown")) {
      if (lookupType) {
        e.preventDefault();
        setActiveLookupType(lookupType);
        return;
      }
    }

    if (e.key === "Enter" || e.key === "ArrowDown") {
      if (e.key === "ArrowDown" && e.currentTarget instanceof HTMLSelectElement) {
        return;
      }
      e.preventDefault();
      const nextIdx = currentIdx + 1;
      const nextEl = document.querySelector<HTMLElement>(`[data-detay-idx="${nextIdx}"]`);
      if (nextEl) {
        nextEl.focus();
        if (
          nextEl instanceof HTMLInputElement &&
          (nextEl.type === "text" || nextEl.type === "email" || nextEl.type === "number")
        ) {
          nextEl.select();
        }
      } else if (e.key === "Enter") {
        // Last field: close Detay modal
        setShowDetayModal(false);
      }
    } else if (e.key === "ArrowUp") {
      if (e.currentTarget instanceof HTMLSelectElement) {
        return;
      }
      e.preventDefault();
      const prevIdx = currentIdx - 1;
      const prevEl = document.querySelector<HTMLElement>(`[data-detay-idx="${prevIdx}"]`);
      if (prevEl) {
        prevEl.focus();
        if (
          prevEl instanceof HTMLInputElement &&
          (prevEl.type === "text" || prevEl.type === "email" || prevEl.type === "number")
        ) {
          prevEl.select();
        }
      }
    }
  };

  // Gümrük Modal Field KeyDown Navigation (Enter, ArrowDown, ArrowUp)
  const handleGumrukFieldKeyDown = (
    e: React.KeyboardEvent<HTMLElement>,
    currentIdx: number
  ) => {
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      const nextIdx = currentIdx + 1;
      const nextEl = document.querySelector<HTMLElement>(`[data-gumruk-idx="${nextIdx}"]`);
      if (nextEl) {
        nextEl.focus();
        if (
          nextEl instanceof HTMLInputElement &&
          (nextEl.type === "text" || nextEl.type === "number" || nextEl.type === "date")
        ) {
          nextEl.select();
        }
      } else if (e.key === "Enter") {
        setShowGumrukModal(false);
        setNotification({
          type: "success",
          message: "Gümrük beyanname bilgileri kaydedildi.",
        });
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prevIdx = currentIdx - 1;
      const prevEl = document.querySelector<HTMLElement>(`[data-gumruk-idx="${prevIdx}"]`);
      if (prevEl) {
        prevEl.focus();
        if (
          prevEl instanceof HTMLInputElement &&
          (prevEl.type === "text" || prevEl.type === "number" || prevEl.type === "date")
        ) {
          prevEl.select();
        }
      }
    }
  };

  // Auto-focus first field when Detay Modal opens
  useEffect(() => {
    if (showDetayModal) {
      const timer = setTimeout(() => {
        const firstInput = document.querySelector<HTMLElement>('[data-detay-idx="0"]');
        if (firstInput) {
          firstInput.focus();
          if (firstInput instanceof HTMLInputElement) firstInput.select();
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [showDetayModal]);

  // Auto-focus first field when Gümrük Modal opens
  useEffect(() => {
    if (showGumrukModal) {
      const timer = setTimeout(() => {
        const firstInput = document.querySelector<HTMLElement>('[data-gumruk-idx="0"]');
        if (firstInput) {
          firstInput.focus();
          if (firstInput instanceof HTMLInputElement) firstInput.select();
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [showGumrukModal]);

  const fisColumns: LookupColumn<DovizFisListItem>[] = [
    {
      header: "Tip",
      width: "90px",
      render: (item) => (
        <Badge bg={item.tip === 1 ? "success" : "danger"}>
          {item.tip === 1 ? "SATIŞ" : "ALIŞ"}
        </Badge>
      ),
    },
    {
      header: "Tarih",
      width: "100px",
      render: (item) => (item.tarih ? item.tarih.split("T")[0] : ""),
    },
    {
      header: "Seri No",
      width: "120px",
      render: (item) => item.seriNo || "-",
    },
    {
      header: "Belge No",
      width: "150px",
      render: (item) => item.belgeNo || "-",
    },
    {
      header: "Ünvan",
      render: (item) => item.unvan || "-",
    },
    {
      header: "Toplam Tutar",
      align: "right",
      width: "130px",
      render: (item) =>
        item.toplamTutar != null ? `${Number(item.toplamTutar).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL` : "-",
    },
  ];

  const cariColumns: LookupColumn<CariKartItem>[] = [
    { header: "Kod", width: "120px", render: (c) => c.kod },
    { header: "Ünvan / Ad", render: (c) => c.ad },
    { header: "VKN / TCKN", width: "140px", render: (c) => c.vergiKimlikNo || "-" },
  ];

  const paraColumns: LookupColumn<ParaItem>[] = [
    { header: "Kod", width: "85px", render: (p) => <span className="font-monospace fw-bold text-primary">{p.kod}</span> },
    { header: "Para / Döviz Adı", render: (p) => <span className="fw-medium">{p.ad}</span> },
    {
      header: "Tip",
      width: "80px",
      align: "center",
      render: (p) => {
        const info = getUrunTipiInfo(p as any);
        return (
          <Badge
            bg={info.bg}
            text={info.textColor as any}
            className={info.isBorder ? "border" : undefined}
            style={{ fontSize: "11px", fontWeight: 600, minWidth: "50px", display: "inline-block", textAlign: "center" }}
          >
            {info.label}
          </Badge>
        );
      },
    },
    {
      header: tip === 0 ? (kurTuru === 0 ? "Efektif Alış" : "Döviz Alış") : (kurTuru === 0 ? "Efektif Satış" : "Döviz Satış"),
      align: "right",
      width: "125px",
      render: (p) => {
        const rate = resolveCurrencyRate(p, tip, kurTuru);
        return rate > 0 ? rate.toFixed(kurKurusSayisi) : "-";
      },
    },
  ];

  const vezneColumns: LookupColumn<VezneItem>[] = [
    { header: "Kod", width: "90px", render: (v) => v.kod },
    { header: "Vezne Adı", render: (v) => v.ad },
  ];

  // e-Banka mutabakatından "Fiş kes" ile gelindiyse cari / tarih / yön dolu açılır
  // Döviz hesabından gelen parada ilk satır o dövizle dolu gelir; tip değişikliği işlendikten sonra (güncel kurla) uygulanır
  const ebDovizSatiriRef = useRef<() => void>(() => { });
  ebDovizSatiriRef.current = () => {
    const h = ebHedefRef.current;
    if (!h || ["TL", "TRY"].includes(h.paraKodu.toUpperCase())) return;
    const para = paraList.find((p) => (p.kod || "").toUpperCase() === h.paraKodu.toUpperCase());
    if (para && lines[0] && !lines[0].paraId) handleSelectCurrency(lines[0].id, para);
  };
  const ebFis = useEBankaFisKesimi("doviz", !isLoadingLookups && !isDuzeltmeMode, (b) => {
    handleTipChange(b.tip);
    if (b.musteri) handleSelectCustomer(b.musteri);
    setTarih(b.tarih);
    ebHedefRef.current = { tutarTl: b.tutarTl, paraKodu: b.paraKodu, tutar: b.tutar };
    setTimeout(() => ebDovizSatiriRef.current(), 100);
  });

  return (
    <div
      className="w-100 pb-3"
      style={{
        backgroundColor: isMasakBlocked ? "#fff5f5" : "#f8fafc",
        minHeight: "100vh",
        overflowX: "hidden",
        border: isMasakBlocked ? "4px solid #dc2626" : "none",
        boxShadow: isMasakBlocked ? "inset 0 0 16px rgba(220, 38, 38, 0.4)" : "none",
        transition: "all 0.3s ease",
        '--active-fis-theme-bg': activeFisThemeBg,
      } as React.CSSProperties}
    >
      {ebFis.bant}
      {/* Top ERP Toolbar with Refresh Icon on right and Dynamic Balances */}
      <ERPToolbar
        disableShortcuts={true}
        pageTitle={isDuzeltmeMode ? "F- Döviz Fişi Düzeltme" : "E- Döviz Fişi Kayıt"}
        onNew={handleToolbarNew}
        onSave={handleToolbarSave}
        onSearch={isDuzeltmeMode ? openFisSecimModal : undefined}
        onDelete={isDuzeltmeMode ? handleToolbarDelete : undefined}
        hideSearch={!isDuzeltmeMode}
        hideDelete={!isDuzeltmeMode}
        onFirst={handleFirst}
        onPrev={handlePrev}
        onNext={handleNext}
        onLast={handleLast}
        centerContent={
          <div className="d-flex align-items-center gap-2">
            <div
              style={{
                border: tip === 0 ? "2px solid #16a34a" : "2px solid #dc2626",
                backgroundColor: activeFisThemeBg,
                color: activeFisThemeText,
                fontWeight: 800,
                fontSize: "13.5px",
                letterSpacing: "3px",
                minWidth: "220px",
                padding: "4px 30px",
                borderRadius: "6px",
                height: "30px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: tip === 0 ? "0 1px 3px rgba(22, 163, 74, 0.15)" : "0 1px 3px rgba(220, 38, 38, 0.15)",
                textAlign: "center",
                textTransform: "uppercase",
              }}
            >
              {tip === 0 ? "ALIŞ" : "SATIŞ"}
            </div>
            {arbitrajActiveInfo && (
              <Badge bg="warning" className="text-dark fw-bold px-2 py-1 d-inline-flex align-items-center gap-1 shadow-2xs" style={{ fontSize: "11px" }}>
                <IconArrowsExchange size={14} /> ARBİTRAJ ({arbitrajActiveInfo.girisKod} ⇄ {arbitrajActiveInfo.cikisKod})
              </Badge>
            )}
          </div>
        }
        onPrint={() => {
          const usdPara = paraList.find((p) => p.kod?.toUpperCase() === "USD");
          setPrintSnapshot({
            fisId,
            tip,
            tarih,
            saat,
            seriNo,
            belgeNo,
            unvan,
            vergiKimlikNo,
            detayIl,
            detayIlce,
            detayUyruk,
            detayPasaportNo,
            detayMeslek,
            detayCariTipi,
            vezneKod,
            istatistikKodu,
            lines: lines.map((l) => ({
              paraKodu: l.paraKodu,
              paraAdi: l.paraAdi,
              miktar: l.miktar,
              kur: l.kur,
              tutar: l.tutar,
              bmv: l.bmv,
              komisyon: l.komisyon,
            })),
            toplamTutar: totalTutar,
            odemeTutari: sonToplam,
            bsmvTutari: calculatedBsmv,
            komisyonTutari: totalKomisyon,
            giseUsdKuru: usdPara ? resolveCurrencyRate(usdPara, tip, kurTuru) : 1,
          });
          setShowPrintModal(true);
        }}
        onRefresh={loadLookupsAndList}
        rightContent={
          <div className="d-flex align-items-center gap-2 px-2 py-0.5 bg-white rounded border shadow-2xs small font-monospace" style={{ fontSize: "11px" }}>
            <span className="text-muted" style={{ fontSize: "10.5px" }}>TL:</span>
            <strong className="text-dark" style={{ fontSize: "11px" }}>
              {topBalances.tl.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </strong>
            <span className="text-secondary opacity-50">|</span>
            <span className="text-muted" style={{ fontSize: "10.5px" }}>USD:</span>
            <strong className="text-dark" style={{ fontSize: "11px" }}>
              {topBalances.usd.toLocaleString("tr-TR")}
            </strong>
            <span className="text-secondary opacity-50">|</span>
            <span className="text-muted" style={{ fontSize: "10.5px" }}>EUR:</span>
            <strong className="text-dark" style={{ fontSize: "11px" }}>
              {topBalances.eur.toLocaleString("tr-TR")}
            </strong>
          </div>
        }
      />

      {/* GİB Kilit Uyarısı */}
      {isLocked && (
        <Alert variant="warning" className="d-flex align-items-center gap-2 my-1 py-1.5 px-3 shadow-2xs">
          <IconLock size={16} className="text-danger" />
          <span className="fw-bold small">GİB'e gönderilen fişler değiştirilemez. (Salt Okunur)</span>
        </Alert>
      )}

      {/* Notifications Alert: Sağ altta beliren ve 3.5 sn sonra yok olan toast */}
      {notification && (
        <div className="erp-toast-container">
          <Alert
            variant={notification.type}
            dismissible
            onClose={() => setNotification(null)}
            className="erp-toast-item d-flex align-items-center justify-content-between py-2.5 px-3 mb-0 border-0 shadow"
          >
            <span>{notification.message}</span>
          </Alert>
        </div>
      )}

      {/* MASAK Malvarlığı Dondurulanlar Kırmızı Bloke Uyarısı */}
      {isMasakBlocked && (
        <Alert variant="danger" className="d-flex align-items-center justify-content-between my-2 py-2.5 px-3 shadow border-2 border-danger bg-danger text-white">
          <div className="d-flex align-items-center gap-2">
            <IconShieldExclamation size={28} className="text-white flex-shrink-0" />
            <div>
              <div className="fw-bold fs-6">🚨 DİKKAT: BU KİŞİ / KURULUŞ MASAK MALVARLIĞI DONDURULANLAR LİSTESİNDEDİR!</div>
              <div style={{ fontSize: "12px", opacity: 0.95 }}>
                “{masakResult.queriedName}” için {masakResult.matches.length} adet yaptırım kaydı tespit edildi. Yasal mevzuat gereği <strong>KESİNLİKLE İŞLEM VE KAYIT YAPILAMAZ</strong>.
              </div>
            </div>
          </div>
          <Button
            size="sm"
            variant="light"
            className="text-danger fw-bold py-1 px-3 flex-shrink-0 ms-2 shadow-sm"
            onClick={() => setMasakModalOpen(true)}
          >
            Detayları Göster
          </Button>
        </Alert>
      )}

      {/* ─── 1. Üst Giriş Alanları Kartı (Ayrı Dış Dikdörtgen Kutu) ─── */}
      <Card
        className={`shadow-sm rounded-2 overflow-hidden mt-1 mb-2 border fis-theme-card ${isMasakBlocked ? "border-2 border-danger" : ""}`}
        data-fis-theme="active"
        style={
          isMasakBlocked
            ? { boxShadow: "0 0 0 4px rgba(220, 53, 69, 0.4)", backgroundColor: "#fff5f5" }
            : { borderColor: "#cbd5e1", backgroundColor: activeFisThemeBg }
        }
      >
        <Card.Body className="p-0 fis-theme-card-body" data-fis-theme="active">
          {/* En Üstteki 3 Alan */}
          <div className="py-2.5 px-3 fis-theme-panel" data-fis-theme="active" style={{ backgroundColor: activeFisThemeBg }}>
            <Row className="g-3">
              {/* Sol Sütun: Tarih, Saat, Geliş Nedeni / Satış Dayanağı, Kur Türü */}
              <Col xs={12} md={4}>
                <div
                  className="border rounded-2 shadow-sm h-100 d-flex flex-column gap-2 fis-theme-panel"
                  data-fis-theme="active"
                  style={{
                    borderColor: "#cbd5e1",
                    padding: "14px 18px",
                    backgroundColor: activeFisThemeBg,
                  }}
                >
                  <div className="d-flex flex-row align-items-center gap-2">
                    <label
                      className="small fw-semibold mb-0 text-nowrap"
                      style={{ minWidth: "105px", width: "105px", flexShrink: 0, fontSize: "12.5px", color: "#334155" }}
                    >
                      Tarih / Saat
                    </label>
                    <div className="d-flex align-items-center gap-1 flex-grow-1" style={{ minWidth: 0 }}>
                      <Form.Control
                        type="date"
                        size="sm"
                        disabled={!isDuzeltmeMode || isLocked}
                        value={tarih}
                        onChange={(e) => setTarih(e.target.value)}
                        className={`font-monospace px-2 py-1 ${!isDuzeltmeMode ? "bg-light text-muted" : ""}`}
                        style={{ minWidth: 0, flex: "1 1 auto", height: "30px", fontSize: "12px", borderColor: "#cbd5e1" }}
                        title={!isDuzeltmeMode ? "Kayıt anında otomatik (anlık) tarih alınır" : "Fiş Tarihi (Düzenlenebilir)"}
                      />
                      <Form.Control
                        type="text"
                        size="sm"
                        autoComplete="off"
                        disabled={!isDuzeltmeMode || isLocked}
                        value={saat}
                        onChange={(e) => setSaat(e.target.value)}
                        className={`font-monospace text-center px-1 py-1 ${!isDuzeltmeMode ? "bg-light text-muted" : ""}`}
                        style={{ minWidth: "68px", width: "68px", flex: "0 0 68px", height: "30px", fontSize: "12px", borderColor: "#cbd5e1" }}
                        title={!isDuzeltmeMode ? "Kayıt anında otomatik (anlık) saat alınır" : "İşlem Saati (SS:DD - Düzenlenebilir)"}
                      />
                    </div>
                  </div>

                  <div className="d-flex flex-row align-items-center gap-2">
                    <label
                      className="small fw-semibold mb-0 text-nowrap"
                      style={{ minWidth: "105px", width: "105px", flexShrink: 0, fontSize: "12px", color: "#334155" }}
                      title={tip === 1 ? "Satışın dayanağı" : "Geliş nedeni"}
                    >
                      {tip === 1 ? "Satış dayanağı" : "Geliş nedeni"}
                    </label>
                    <div className="flex-grow-1" style={{ minWidth: 0 }}>
                      <Form.Control
                        id="header-input-gelis-nedeni"
                        type="text"
                        size="sm"
                        autoComplete="off"
                        disabled={isLocked}
                        value={gelisNedeni}
                        maxLength={100}
                        onChange={(e) => setGelisNedeni(e.target.value.slice(0, 100))}
                        className="px-2.5 py-1"
                        style={{ minWidth: 0, width: "100%", height: "30px", fontSize: "12.5px", borderColor: "#cbd5e1" }}
                      />
                    </div>
                  </div>

                  <div className="d-flex flex-row align-items-center gap-2">
                    <label
                      className="small fw-semibold mb-0 text-nowrap"
                      style={{ minWidth: "105px", width: "105px", flexShrink: 0, fontSize: "12.5px", color: "#334155" }}
                    >
                      Kur türü
                    </label>
                    <div className="flex-grow-1" style={{ minWidth: 0 }}>
                      <Form.Select
                        size="sm"
                        disabled={isLocked}
                        value={kurTuru}
                        onChange={(e) => setKurTuru(Number(e.target.value))}
                        onKeyDown={(e) => {
                          if (e.key === " " || e.code === "Space" || e.keyCode === 32) {
                            e.preventDefault();
                            e.stopPropagation();
                            setKurTuru(kurTuru === 0 ? 1 : 0);
                          }
                        }}
                        className="fw-semibold px-2.5 py-1"
                        style={{ minWidth: 0, width: "100%", height: "30px", fontSize: "12.5px", borderColor: "#cbd5e1" }}
                      >
                        <option value={0}>Efektif Kurları</option>
                        <option value={1}>Döviz Kurları</option>
                      </Form.Select>
                    </div>
                  </div>
                </div>
              </Col>

              {/* Orta Sütun: Seri No, Cari Kodu, Ünvan, Fiş Tipi */}
              <Col xs={12} md={4}>
                <div
                  className="border rounded-2 shadow-sm h-100 d-flex flex-column gap-2 fis-theme-panel"
                  data-fis-theme="active"
                  style={{
                    borderColor: "#cbd5e1",
                    padding: "14px 18px",
                    backgroundColor: activeFisThemeBg,
                  }}
                >
                  <div className="d-flex flex-row align-items-center gap-2">
                    <label
                      className="small fw-semibold mb-0 text-nowrap"
                      style={{ minWidth: "80px", width: "80px", flexShrink: 0, fontSize: "12.5px", color: "#334155" }}
                    >
                      Seri no
                    </label>
                    <div className="flex-grow-1" style={{ minWidth: 0 }}>
                      {isDuzeltmeMode ? (
                        <InputGroup size="sm" style={{ height: "30px" }}>
                          <Form.Control
                            type="text"
                            autoComplete="off"
                            disabled={isLocked}
                            value={seriNo}
                            maxLength={20}
                            onChange={(e) => setSeriNo(e.target.value.slice(0, 20))}
                            className="font-monospace fw-bold px-2.5 py-1"
                            style={{ minWidth: 0, height: "30px", fontSize: "12.5px", borderColor: "#cbd5e1" }}
                          />
                          <Button
                            variant="outline-secondary"
                            className="px-2 py-0 d-flex align-items-center justify-content-center"
                            style={{ height: "30px", borderColor: "#cbd5e1" }}
                            onClick={() => {
                              openFisSecimModal();
                            }}
                            title="Seri No ile Fiş Ara / Seç"
                          >
                            <IconBinoculars size={14} />
                          </Button>
                        </InputGroup>
                      ) : (
                        <Form.Control
                          type="text"
                          size="sm"
                          autoComplete="off"
                          disabled={isLocked}
                          value={seriNo}
                          maxLength={20}
                          onChange={(e) => setSeriNo(e.target.value.slice(0, 20))}
                          className="font-monospace fw-bold px-2.5 py-1"
                          style={{ minWidth: 0, width: "100%", height: "30px", fontSize: "12.5px", borderColor: "#cbd5e1" }}
                          placeholder="Otomatik (Boş ise atanır)"
                          title="Fiş Seri No (Boş bırakılırsa numaradörden otomatik atanır)"
                        />
                      )}
                    </div>
                  </div>

                  {/* Cari Kodu */}
                  <div className="d-flex flex-row align-items-center gap-2">
                    <label
                      className="small fw-semibold mb-0 text-nowrap text-secondary"
                      style={{ minWidth: "80px", width: "80px", flexShrink: 0, fontSize: "12.5px", fontWeight: 600 }}
                    >
                      Cari Kodu
                    </label>
                    <div className="flex-grow-1" style={{ minWidth: 0 }}>
                      <InputGroup size="sm" style={{ height: "30px" }}>
                        <Form.Control
                          ref={cariKodRef}
                          type="text"
                          autoComplete="off"
                          disabled={isLocked}
                          value={cariKod}
                          maxLength={30}
                          onFocus={() => {
                            lastFocusedCariKodRef.current = cariKod;
                          }}
                          onChange={(e) => {
                            const v = e.target.value;
                            setCariKod(v);
                            if (!v) {
                              setUnvan(DEFAULT_CUSTOMER_NAME);
                              setCariKartId(null);
                            }
                          }}
                          onBlur={() => {
                            if (!cariKod.trim()) {
                              setCariKod("");
                              setUnvan(DEFAULT_CUSTOMER_NAME);
                              setCariKartId(null);
                            } else {
                              handleCariKodLookup(cariKod);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const val = cariKod.trim();
                              if (!val) {
                                setCariKod("");
                                setUnvan(DEFAULT_CUSTOMER_NAME);
                                setCariKartId(null);
                                unvanRef.current?.focus();
                                unvanRef.current?.select();
                                return;
                              }
                              const { cariler, totalCount } = findMatchingCustomers("kod", val);
                              if (totalCount === 1 && cariler.length === 1) {
                                const single = cariler[0];
                                handleSelectCustomer({
                                  type: "registered",
                                  id: single.id,
                                  kod: single.kod,
                                  unvan: single.ad || (single as any).unvan || "",
                                  vergiKimlikNo: single.vergiKimlikNo || "",
                                  adres: single.adres || "",
                                  telefon: single.telefon || "",
                                  raw: single,
                                });
                                lastFocusedCariKodRef.current = single.kod || "";
                                unvanRef.current?.focus();
                                unvanRef.current?.select();
                                return;
                              }
                              if (totalCount === 0) {
                                setCariKod("");
                                setUnvan(DEFAULT_CUSTOMER_NAME);
                                setCariKartId(null);
                                unvanRef.current?.focus();
                                unvanRef.current?.select();
                                return;
                              }
                              lastModalCallerRef.current = "cariKod";
                              setCariSearchTerm(val);
                              setCariSearchField("kod");
                              setShowCariModal(true);
                            }
                          }}
                          className="font-monospace px-2.5 py-1"
                          style={{ minWidth: 0, height: "30px", fontSize: "12.5px", borderColor: "#cbd5e1" }}
                          placeholder="Cari Kodu"
                        />
                        <Button
                          variant="outline-secondary"
                          className="px-2 py-0 d-flex align-items-center justify-content-center"
                          style={{ height: "30px", borderColor: "#cbd5e1" }}
                          onClick={() => {
                            const val = cariKod.trim();
                            lastModalCallerRef.current = "cariKod";
                            setCariSearchTerm(val);
                            setCariSearchField("kod");
                            setShowCariModal(true);
                          }}
                          title="Cari Seç"
                        >
                          <IconBinoculars size={14} />
                        </Button>
                      </InputGroup>
                    </div>
                  </div>

                  <div className="d-flex flex-row align-items-center gap-2">
                    <label
                      className="small fw-semibold mb-0 text-nowrap"
                      style={{ minWidth: "80px", width: "80px", flexShrink: 0, fontSize: "12.5px", color: "#334155" }}
                    >
                      Ünvan
                    </label>
                    <div className="flex-grow-1" style={{ minWidth: 0 }}>
                      <InputGroup size="sm" style={{ height: "30px" }}>
                        <Form.Control
                          ref={unvanRef}
                          type="text"
                          autoComplete="off"
                          disabled={isLocked}
                          value={unvan}
                          maxLength={100}
                          onFocus={() => {
                            lastFocusedUnvanRef.current = unvan;
                          }}
                          onChange={(e) => {
                            setUnvan(e.target.value.slice(0, 100));
                            if (cariKartId) setCariKartId(null);
                          }}
                          onBlur={() => {
                            if (!unvan || !unvan.trim() || isAnonymousCustomerName(unvan)) {
                              setUnvan(DEFAULT_CUSTOMER_NAME);
                              setCariKod("");
                              setCariKartId(null);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const raw = unvan.trim();
                              if (isAnonymousCustomerName(raw)) {
                                setUnvan(DEFAULT_CUSTOMER_NAME);
                                setCariKod("");
                                setCariKartId(null);
                                tipSelectRef.current?.focus();
                                return;
                              }
                              const val = raw;
                              const prevVal = (lastFocusedUnvanRef.current || "").trim();
                              if (val && val.toLowerCase() === prevVal.toLowerCase()) {
                                tipSelectRef.current?.focus();
                                return;
                              }
                              const { cariler, kayitsizlar, totalCount } = findMatchingCustomers("unvan", val);
                              if (totalCount === 1) {
                                if (cariler.length === 1) {
                                  const single = cariler[0];
                                  handleSelectCustomer({
                                    type: "registered",
                                    id: single.id,
                                    kod: single.kod,
                                    unvan: single.ad || (single as any).unvan || "",
                                    vergiKimlikNo: single.vergiKimlikNo || "",
                                    adres: single.adres || "",
                                    telefon: single.telefon || "",
                                    raw: single,
                                  });
                                } else if (kayitsizlar.length === 1) {
                                  const singleK = kayitsizlar[0];
                                  handleSelectCustomer({
                                    type: "unregistered",
                                    id: null,
                                    kod: "",
                                    unvan: singleK.ad || singleK.unvan || "",
                                    vergiKimlikNo: singleK.vergiKimlikNo || "",
                                    adres: singleK.adres || "",
                                    telefon: singleK.telefon || "",
                                    raw: singleK,
                                  });
                                }
                                tipSelectRef.current?.focus();
                                return;
                              }
                              lastModalCallerRef.current = "unvan";
                              setCariSearchTerm(val);
                              setCariSearchField("unvan");
                              setShowCariModal(true);
                            }
                          }}
                          className="fw-semibold px-2.5 py-1"
                          style={{ minWidth: 0, height: "30px", fontSize: "12.5px", borderColor: "#cbd5e1" }}
                          placeholder={DEFAULT_CUSTOMER_NAME}
                          title="Ünvan (Enter ile arama yapabilirsiniz)"
                        />
                        <Button
                          variant="outline-secondary"
                          className="px-2 py-0 d-flex align-items-center justify-content-center"
                          style={{ height: "30px", borderColor: "#cbd5e1" }}
                          onClick={() => {
                            const raw = unvan.trim();
                            const term = isAnonymousCustomerName(raw) ? "" : raw;
                            lastModalCallerRef.current = "unvan";
                            setCariSearchTerm(term);
                            setCariSearchField("unvan");
                            setShowCariModal(true);
                          }}
                          title="Cari / Müşteri Seç (F4)"
                        >
                          <IconBinoculars size={14} />
                        </Button>
                        <Button
                          variant="outline-danger"
                          className="px-2 py-0 d-flex align-items-center justify-content-center gap-1"
                          style={{ height: "30px", fontSize: "11px", fontWeight: 600, borderColor: "#cbd5e1" }}
                          onClick={() => handleSearchMasak()}
                          disabled={isSearchingMasak}
                          title="İsim ve TC ile MASAK Listelerinde Sorgula"
                        >
                          {isSearchingMasak ? <Spinner animation="border" size="sm" /> : <IconShieldExclamation size={14} color="#dc2626" />}
                          <span className="d-none d-xl-inline text-danger"></span>
                        </Button>
                      </InputGroup>
                    </div>
                  </div>

                  <div className="d-flex flex-row align-items-center gap-2">
                    <label
                      className="small fw-semibold mb-0 text-nowrap"
                      style={{ minWidth: "80px", width: "80px", flexShrink: 0, fontSize: "12.5px", color: "#334155" }}
                    >
                      Fiş tipi
                    </label>
                    <div className="flex-grow-1" style={{ minWidth: 0 }}>
                      <Form.Select
                        ref={tipSelectRef}
                        size="sm"
                        value={tip}
                        onChange={(e) => handleTipChange(Number(e.target.value))}
                        onKeyDown={(e) => {
                          if (e.key === " " || e.code === "Space" || e.keyCode === 32) {
                            e.preventDefault();
                            e.stopPropagation();
                            handleTipChange(tip === 0 ? 1 : 0);
                          }
                        }}
                        className="fw-bold text-uppercase px-2.5 py-1"
                        style={{ minWidth: 0, width: "100%", height: "30px", fontSize: "12.5px", borderColor: "#cbd5e1" }}
                      >
                        <option value={0}>ALIŞ</option>
                        <option value={1}>SATIŞ</option>
                      </Form.Select>
                    </div>
                  </div>
                </div>
              </Col>

              {/* Sağ Sütun: Belge No, VKN/TCKN, İstatistik Kodu */}
              <Col xs={12} md={4}>
                <div
                  className="border rounded-2 shadow-sm h-100 d-flex flex-column gap-2 fis-theme-panel"
                  data-fis-theme="active"
                  style={{
                    borderColor: "#cbd5e1",
                    padding: "14px 18px",
                    backgroundColor: activeFisThemeBg,
                  }}
                >
                  <div className="d-flex flex-row align-items-center gap-2">
                    <label
                      className="small fw-semibold mb-0 text-nowrap"
                      style={{ minWidth: "105px", width: "105px", flexShrink: 0, fontSize: "12.5px", color: "#334155" }}
                    >
                      Belge no
                    </label>
                    <div className="flex-grow-1" style={{ minWidth: 0 }}>
                      {isDuzeltmeMode ? (
                        <InputGroup size="sm" style={{ height: "30px" }}>
                          <Form.Control
                            type="text"
                            autoComplete="off"
                            disabled={isLocked}
                            value={belgeNo}
                            maxLength={30}
                            onChange={(e) => setBelgeNo(e.target.value.slice(0, 30))}
                            className="font-monospace fw-bold px-2.5 py-1"
                            style={{ minWidth: 0, height: "30px", fontSize: "12.5px", borderColor: "#cbd5e1" }}
                          />
                          <Button
                            variant="outline-secondary"
                            className="px-2 py-0 d-flex align-items-center justify-content-center"
                            style={{ height: "30px", borderColor: "#cbd5e1" }}
                            onClick={() => {
                              openFisSecimModal();
                            }}
                            title="Belge No ile Fiş Ara / Seç"
                          >
                            <IconBinoculars size={14} />
                          </Button>
                        </InputGroup>
                      ) : (
                        <Form.Control
                          type="text"
                          size="sm"
                          autoComplete="off"
                          disabled={isLocked}
                          value={belgeNo}
                          maxLength={30}
                          onChange={(e) => setBelgeNo(e.target.value.slice(0, 30))}
                          className="font-monospace fw-bold px-2.5 py-1"
                          style={{ minWidth: 0, width: "100%", height: "30px", fontSize: "12.5px", borderColor: "#cbd5e1" }}
                          placeholder="Otomatik (Boş ise atanır)"
                          title="Belge No (Boş bırakılırsa numaradörden otomatik atanır)"
                        />
                      )}
                    </div>
                  </div>

                  <div className="d-flex flex-row align-items-center gap-2">
                    <label
                      className="small fw-semibold mb-0 text-nowrap"
                      style={{ minWidth: "105px", width: "105px", flexShrink: 0, fontSize: "12.5px", color: "#334155" }}
                    >
                      VKN / TCKN
                    </label>
                    <div className="flex-grow-1" style={{ minWidth: 0 }}>
                      <InputGroup size="sm" style={{ height: "30px" }}>
                        <Form.Control
                          ref={vknRef}
                          type="text"
                          size="sm"
                          autoComplete="off"
                          disabled={isLocked}
                          value={vergiKimlikNo}
                          maxLength={11}
                          onFocus={() => {
                            lastFocusedVknRef.current = vergiKimlikNo;
                          }}
                          onChange={(e) => {
                            const v = e.target.value.replace(/\D/g, "").slice(0, 11);
                            setVergiKimlikNo(v);
                            if (!v) {
                              void handleVknLookup("", false);
                            } else if (v.length === 11 || v.length === 10) {
                              void handleVknLookup(v, false);
                            } else {
                              setCariKod("");
                              setUnvan(DEFAULT_CUSTOMER_NAME);
                              setCariKartId(null);
                              lastFocusedCariKodRef.current = "";
                              lastFocusedUnvanRef.current = "";
                            }
                          }}
                          onBlur={() => {
                            if (vergiKimlikNo.length === 10 || vergiKimlikNo.length === 11 || !vergiKimlikNo) {
                              void handleVknLookup(vergiKimlikNo, true);
                            }
                          }}
                          onKeyDown={async (e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              await handleVknLookup(vergiKimlikNo, true);
                              istatistikRef.current?.focus();
                              istatistikRef.current?.select();
                            }
                          }}
                          className="font-monospace px-2.5 py-1"
                          style={{ minWidth: 0, height: "30px", fontSize: "12.5px", borderColor: "#cbd5e1" }}
                          placeholder="TCKN / VKN (Enter ile ara)"
                        />
                        <Button
                          variant="outline-secondary"
                          className="px-2 py-0 d-flex align-items-center justify-content-center"
                          style={{ height: "30px", borderColor: "#cbd5e1" }}
                          onClick={() => {
                            const val = vergiKimlikNo.trim();
                            lastModalCallerRef.current = "vkn";
                            setCariSearchTerm(val);
                            setCariSearchField("vkn");
                            setShowCariModal(true);
                          }}
                          title="Cari / Müşteri Ara (VKN / TCKN ile)"
                        >
                          <IconBinoculars size={14} />
                        </Button>
                        <Button
                          variant="outline-danger"
                          className="px-2 py-0 d-flex align-items-center justify-content-center gap-1"
                          style={{ height: "30px", fontSize: "11px", fontWeight: 600, borderColor: "#cbd5e1" }}
                          onClick={() => handleSearchMasak()}
                          disabled={isSearchingMasak}
                          title="TC/VKN ile MASAK Listelerinde Sorgula"
                        >
                          {isSearchingMasak ? <Spinner animation="border" size="sm" /> : <IconShieldExclamation size={14} color="#dc2626" />}
                          <span className="d-none d-xl-inline text-danger"></span>
                        </Button>
                      </InputGroup>
                    </div>
                  </div>

                  <div className="d-flex flex-row align-items-center gap-2">
                    <label
                      className="small fw-semibold mb-0 text-nowrap"
                      style={{ minWidth: "105px", width: "105px", flexShrink: 0, fontSize: "12.5px", color: "#334155" }}
                    >
                      İstatistik kodu
                    </label>
                    <div className="flex-grow-1" style={{ minWidth: 0 }}>
                      <InputGroup size="sm">
                        <Form.Control
                          ref={istatistikRef}
                          type="text"
                          size="sm"
                          autoComplete="off"
                          disabled={isLocked}
                          value={istatistikKodu}
                          maxLength={20}
                          onFocus={() => {
                            lastFocusedIstatistikKodRef.current = istatistikKodu;
                          }}
                          onChange={(e) => {
                            const nextVal = e.target.value.slice(0, 20);
                            setIstatistikKodu(nextVal);
                            if (!nextVal.trim()) {
                              hasUserSelectedStatRef.current = true;
                              setIstatistikId(null);
                              setSelectedStatistic(null);
                              setIstatistikFisDizaynTipi(0);
                              lastFocusedIstatistikKodRef.current = "";
                              applyStatisticToLines(null, tip);
                            }
                          }}
                          onBlur={() => {
                            const val = (istatistikKodu || "").trim();
                            if (!val) {
                              hasUserSelectedStatRef.current = true;
                              setIstatistikId(null);
                              setSelectedStatistic(null);
                              setIstatistikFisDizaynTipi(0);
                              lastFocusedIstatistikKodRef.current = "";
                              applyStatisticToLines(null, tip);
                              return;
                            }
                            const q = val.toLowerCase();
                            const matched = statisticList.find((s) => {
                              const fType = Number(s.fisTipi);
                              const typeMatch = tip === 0 ? (fType === 0 || fType === 2) : (fType === 1 || fType === 2);
                              return typeMatch && ((s.kod || "").toLowerCase() === q || String(s.id) === q);
                            });
                            if (matched) {
                              handleSelectIstatistik(matched);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const val = (istatistikKodu || "").trim();
                              const prevVal = (lastFocusedIstatistikKodRef.current || "").trim();
                              if (val && val.toLowerCase() === prevVal.toLowerCase() && selectedStatistic) {
                                focusCell(0, "kod");
                                return;
                              }
                              if (!val) {
                                focusCell(0, "kod");
                                return;
                              }
                              const q = val.toLowerCase();
                              const matched = statisticList.filter((s) => {
                                const fType = Number(s.fisTipi);
                                const typeMatch = tip === 0 ? (fType === 0 || fType === 2) : (fType === 1 || fType === 2);
                                return typeMatch && ((s.kod || "").toLowerCase().includes(q) || (s.aciklama || "").toLowerCase().includes(q));
                              });
                              if (matched.length === 1) {
                                const single = matched[0];
                                handleSelectIstatistik(single);
                                return;
                              }
                              lastModalCallerRef.current = "istatistik";
                              setIstatistikSearchTerm(val);
                              setShowIstatistikModal(true);
                            } else if (e.key === "F3") {
                              e.preventDefault();
                              e.stopPropagation();
                              const val = (istatistikKodu || "").trim();
                              lastModalCallerRef.current = "istatistik";
                              setIstatistikSearchTerm(val);
                              setShowIstatistikModal(true);
                            }
                          }}
                          className="font-monospace text-center px-2.5 py-1"
                          title="İstatistik Kodu (Enter veya F3 ile seçebilirsiniz)"
                          style={{ minWidth: 0, height: "30px", fontSize: "12.5px", borderColor: "#cbd5e1" }}
                        />
                        <Button
                          variant="outline-secondary"
                          className="px-2 py-0 d-flex align-items-center justify-content-center"
                          style={{ height: "30px", borderColor: "#cbd5e1" }}
                          disabled={isLocked}
                          onClick={() => {
                            const val = (istatistikKodu || "").trim();
                            lastModalCallerRef.current = "istatistik";
                            setIstatistikSearchTerm(val);
                            setShowIstatistikModal(true);
                          }}
                          title="F3) İstatistik Kodu Seçimi"
                        >
                          <IconBinoculars size={14} />
                        </Button>
                      </InputGroup>
                    </div>
                  </div>
                </div>
              </Col>
            </Row>
          </div>
        </Card.Body>
      </Card>

      {/* ─── 2. Döviz Kalemleri Tablo ve Toplam Kartı (Ayrı Dış Dikdörtgen Kutu) ─── */}
      <Card className="shadow-sm rounded-2 overflow-hidden mb-2 border fis-theme-card" data-fis-theme="active" style={{ borderColor: "#cbd5e1", backgroundColor: activeFisThemeBg }}>
        <Card.Body className="p-2.5 fis-theme-card-body" data-fis-theme="active" style={{ backgroundColor: activeFisThemeBg }}>
          {/* Kolon Görünürlük Kontrol Şeridi */}
          <div className="d-flex align-items-center justify-content-end mb-1 gap-1">
            <Dropdown autoClose="outside">
              <Dropdown.Toggle
                variant="outline-secondary"
                size="sm"
                className="d-flex align-items-center gap-1 py-0 px-2"
                style={{ fontSize: "12px", height: "24px" }}
                id="grid-col-toggle"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>
                Kolonlar
              </Dropdown.Toggle>
              <Dropdown.Menu style={{ minWidth: "170px", fontSize: "13px", padding: "6px 4px" }}>
                <div className="px-2 pb-1 text-muted" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.5px" }}>GÖRÜNÜRLEBİLİR KOLONLAR</div>
                {([
                  { key: "komisyonOrani", label: "Komisyon %" },
                  { key: "komisyon", label: "Komisyon" },
                  { key: "bmvOrani", label: "BMV %" },
                  { key: "bmv", label: "BMV" },
                  { key: "kmvOrani", label: "KMV %" },
                  { key: "kmv", label: "KMV" },
                ] as { key: keyof typeof defaultColVisibility; label: string }[]).map(({ key, label }) => (
                  <Dropdown.Item
                    key={key}
                    as="button"
                    className="d-flex align-items-center gap-2 py-1"
                    onClick={() => toggleCol(key)}
                  >
                    <span
                      style={{
                        width: "14px", height: "14px", border: "1.5px solid #6c757d",
                        borderRadius: "3px", display: "inline-flex", alignItems: "center",
                        justifyContent: "center", flexShrink: 0,
                        backgroundColor: colVisibility[key] ? "#0d6efd" : "transparent",
                      }}
                    >
                      {colVisibility[key] && (
                        <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2.5"><polyline points="1,6 4,9 11,2" /></svg>
                      )}
                    </span>
                    <span style={{ color: colVisibility[key] ? "#212529" : "#adb5bd" }}>{label}</span>
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown>
          </div>

          <div
            className="table-responsive border rounded bg-white shadow-2xs"
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                cleanupEmptyRows(null);
              }
            }}
            style={{
              minHeight: "75px",
              maxHeight: "220px",
              overflowY: "auto",
              borderColor: "#cbd5e1",
            }}
          >
            <Table size="sm" className="mb-0 align-middle" style={{ borderCollapse: "collapse" }}>
              <thead className="position-sticky top-0" style={{ backgroundColor: "#dbeafe", color: "#1e293b", zIndex: 5 }}>
                <tr style={{ height: "30px", borderBottom: "1px solid #94a3b8", fontSize: "12.5px" }}>
                  <th style={{ width: "45px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>#</th>
                  <th style={{ width: "100px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Kod</th>
                  <th style={{ width: "170px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Ad</th>
                  <th style={{ width: linesMiktarColWidth, minWidth: linesMiktarColWidth, textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Miktar</th>
                  <th style={{ width: "120px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                    {tip === 1 ? "Satış kuru" : "Alış kuru"}
                  </th>
                  {colVisibility.komisyonOrani && <th style={{ width: "55px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>%</th>}
                  {colVisibility.komisyon && <th style={{ width: "90px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Komisyon</th>}
                  {colVisibility.bmvOrani && <th style={{ width: "55px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>%</th>}
                  {colVisibility.bmv && <th style={{ width: "90px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>BMV</th>}
                  {colVisibility.kmvOrani && <th style={{ width: "55px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>%</th>}
                  {colVisibility.kmv && <th style={{ width: "90px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>KMV</th>}
                  <th style={{ width: "110px", textAlign: "center" }}>Tutar</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((row, idx) => {
                  const isRowEmpty = isRowCompletelyEmpty(row);
                  const isRowValid = isRowFilled(row);
                  const isAttempted = Boolean(invalidRowIds[row.id]);
                  const shouldValidate = (!isRowEmpty && !isRowValid) || (isAttempted && !isRowValid);

                  const hasPara = Boolean(row.paraId || (row.paraKodu && row.paraKodu.trim() !== "") || (row.paraAdi && row.paraAdi.trim() !== "") || (row.kur && parseKur(row.kur) > 0));
                  const isTL = row.paraKodu?.trim().toUpperCase() === "TL" || row.paraKodu?.trim().toUpperCase() === "TRY" || row.paraKodu?.trim().toUpperCase() === "TRL";
                  const isMiktarMissing = hasPara && (!row.miktar || String(row.miktar).trim() === "" || parseMiktar(row.miktar) <= 0);
                  const isKurMissing = hasPara && !isTL && (!row.kur || String(row.kur).trim() === "" || parseKur(row.kur) <= 0);

                  return (
                    <tr
                      key={row.id}
                      data-row-id={row.id}
                      draggable={!isLocked}
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDrop={(e) => handleDrop(e, idx)}
                      onDragEnd={handleDragEnd}
                      style={{
                        height: "32px",
                        backgroundColor: dragOverRowIndex === idx
                          ? "#e0f2fe"
                          : activeRowIndex === idx
                            ? "#f8fafc"
                            : "transparent",
                        borderTop: dragOverRowIndex === idx ? "2px solid #0284c7" : undefined,
                        borderBottom: "1px solid #e2e8f0",
                        opacity: draggedRowIndex === idx ? 0.4 : 1,
                        transition: "background-color 0.15s ease",
                      }}
                    >
                      {/* # (Sürükleme Tutamacı & Sıra No) */}
                      <td
                        className="text-center text-secondary small fw-semibold user-select-none"
                        style={{ borderRight: "1px solid #e2e8f0", cursor: isLocked ? "default" : "grab", width: "45px" }}
                        title="Satırı basılı tutarak yukarı/aşağı sürükleyebilirsiniz"
                      >
                        <div className="d-flex align-items-center justify-content-center gap-1">
                          {!isLocked && <span style={{ fontSize: "11px", color: "#94a3b8", cursor: "grab" }}>⋮⋮</span>}
                          <span>{idx + 1}</span>
                        </div>
                      </td>

                      {/* Kod with Oklu Dürbün */}
                      <td className="p-0" style={{ borderRight: "1px solid #e2e8f0" }}>
                        <div
                          className="d-flex align-items-center w-100 px-1"
                        >
                          <input
                            id={`grid-input-${idx}-kod`}
                            type="text"
                            disabled={isLocked}
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="characters"
                            spellCheck={false}
                            className="form-control form-control-sm border-0 p-0 shadow-none font-monospace fw-bold text-uppercase"
                            style={{ height: "26px", fontSize: "13px", backgroundColor: "transparent" }}
                            value={row.paraKodu}
                            onFocus={() => {
                              setActiveRowIndex(idx);
                              cleanupEmptyRows(idx);
                            }}
                            onChange={(e) => {
                              const val = e.target.value.toUpperCase();
                              handleLineFieldChange(row.id, "paraKodu", val);
                            }}
                            onDoubleClick={() => {
                              const term = (row.paraKodu || "").trim();
                              lastModalCallerRef.current = "paraGrid";
                              lastParaModalRowIndexRef.current = idx;
                              setParaModalRowId(row.id);
                              setParaSearchTerm(term);
                              if (paraList.length === 0) {
                                apiClient.get<ParaItem[]>("/para")
                                  .then((r) => {
                                    if (r.data && r.data.length > 0) setParaList(r.data);
                                  })
                                  .catch(() => { });
                              }
                              setShowParaModal(true);
                            }}
                            onKeyDown={(e) => handleCellKeyDown(e, idx, "kod")}
                          />
                          <Button
                            variant="link"
                            className="p-0 px-1 text-secondary text-decoration-none"
                            onClick={() => {
                              const term = (row.paraKodu || "").trim();
                              lastModalCallerRef.current = "paraGrid";
                              lastParaModalRowIndexRef.current = idx;
                              setParaModalRowId(row.id);
                              setParaSearchTerm(term);
                              if (paraList.length === 0) {
                                apiClient.get<ParaItem[]>("/para")
                                  .then((r) => {
                                    if (r.data && r.data.length > 0) setParaList(r.data);
                                  })
                                  .catch(() => { });
                              }
                              setShowParaModal(true);
                            }}
                            title="Para / Maden Seç (Dürbün)"
                          >
                            <IconBinoculars size={13} />
                          </Button>
                        </div>
                      </td>

                      {/* Ad */}
                      <td className="p-0 px-2 text-dark small" style={{ borderRight: "1px solid #e2e8f0" }}>
                        {row.paraAdi || "-"}
                      </td>

                      {/* Miktar */}
                      <td className="p-0" style={{ width: linesMiktarColWidth, minWidth: linesMiktarColWidth, borderRight: "1px solid #e2e8f0", backgroundColor: isMiktarMissing ? "#fee2e2" : undefined }}>
                        <input
                          id={`grid-input-${idx}-miktar`}
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          disabled={isLocked}
                          className={`form-control form-control-sm border-0 p-0 px-2 shadow-none font-monospace text-end ${isMiktarMissing ? "is-invalid border-danger border-2 text-danger fw-bold" : ""}`}
                          style={{
                            height: "26px",
                            fontSize: "13px",
                            backgroundColor: isMiktarMissing ? "#fee2e2" : "transparent",
                            border: isMiktarMissing ? "2px solid #dc2626" : "none",
                            borderRadius: isMiktarMissing ? "3px" : undefined,
                            boxShadow: isMiktarMissing ? "0 0 0 2px rgba(220, 38, 38, 0.4)" : undefined,
                          }}
                          value={row.miktar}
                          onFocus={() => {
                            setActiveRowIndex(idx);
                            cleanupEmptyRows(idx);
                          }}
                          onChange={(e) => handleLineFieldChange(row.id, "miktar", e.target.value)}
                          onBlur={(e) => {
                            const val = e.target.value.trim();
                            if (val !== "") {
                              handleLineFieldChange(row.id, "miktar", formatMiktar(val));
                            }
                          }}
                          onKeyDown={(e) => handleCellKeyDown(e, idx, "miktar")}
                          title={isMiktarMissing ? "Lütfen geçerli bir miktar giriniz" : undefined}
                        />
                      </td>

                      {/* Kur */}
                      <td className="p-0" style={{ borderRight: "1px solid #e2e8f0" }}>
                        <input
                          id={`grid-input-${idx}-kur`}
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          disabled={isLocked || isTL}
                          readOnly={isTL}
                          tabIndex={isTL ? -1 : undefined}
                          className={`form-control form-control-sm border-0 p-0 px-2 shadow-none font-monospace text-end ${isTL ? "text-muted" : (isKurMissing ? "text-danger fw-bold" : "")
                            }`}
                          style={{
                            height: "26px",
                            fontSize: "13px",
                            backgroundColor: isTL ? "#e9ecef" : (isKurMissing ? "#fee2e2" : "transparent"),
                            border: isKurMissing ? "1.5px solid #dc2626" : "none",
                            borderRadius: isKurMissing ? "3px" : undefined,
                            cursor: isTL ? "not-allowed" : undefined,
                          }}
                          value={isTL ? "" : row.kur}
                          onFocus={() => {
                            setActiveRowIndex(idx);
                            cleanupEmptyRows(idx);
                          }}
                          onChange={(e) => !isTL && handleLineFieldChange(row.id, "kur", e.target.value)}
                          onBlur={(e) => {
                            if (isTL) return;
                            const val = e.target.value.trim();
                            if (val !== "") {
                              const num = parseFloat(val.replace(/,/g, "."));
                              if (!isNaN(num)) {
                                handleLineFieldChange(row.id, "kur", num.toFixed(kurKurusSayisi));
                              }
                            }
                          }}
                          onKeyDown={(e) => handleCellKeyDown(e, idx, "kur")}
                          title={isTL ? "TL için kur girilmez" : isKurMissing ? "Lütfen geçerli bir kur giriniz" : undefined}
                        />
                      </td>

                      {/* % (Komisyon %) */}
                      {colVisibility.komisyonOrani && (
                        <td className="p-0" style={{ borderRight: "1px solid #e2e8f0" }}>
                          <input
                            id={`grid-input-${idx}-komisyonOrani`}
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            disabled={isLocked}
                            className="form-control form-control-sm border-0 p-0 px-1 shadow-none text-center font-monospace"
                            style={{ height: "26px", fontSize: "12px", backgroundColor: "transparent" }}
                            value={row.komisyonOrani}
                            onFocus={() => {
                              setActiveRowIndex(idx);
                              cleanupEmptyRows(idx);
                            }}
                            onChange={(e) => handleLineFieldChange(row.id, "komisyonOrani", e.target.value)}
                            onKeyDown={(e) => handleCellKeyDown(e, idx, "komisyonOrani")}
                          />
                        </td>
                      )}

                      {/* Komisyon */}
                      {colVisibility.komisyon && (
                        <td className="p-0" style={{ borderRight: "1px solid #e2e8f0" }}>
                          <input
                            id={`grid-input-${idx}-komisyon`}
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            disabled={isLocked}
                            className="form-control form-control-sm border-0 p-0 px-2 shadow-none text-end font-monospace"
                            style={{ height: "26px", fontSize: "12px", backgroundColor: "transparent" }}
                            value={row.komisyon}
                            onFocus={() => {
                              setActiveRowIndex(idx);
                              cleanupEmptyRows(idx);
                            }}
                            onChange={(e) => handleLineFieldChange(row.id, "komisyon", e.target.value)}
                            onKeyDown={(e) => handleCellKeyDown(e, idx, "komisyon")}
                          />
                        </td>
                      )}

                      {/* % (BMV %) - Read-Only (Müdahale edilemez) */}
                      {colVisibility.bmvOrani && (
                        <td className="p-0" style={{ borderRight: "1px solid #e2e8f0" }}>
                          <input
                            id={`grid-input-${idx}-bmvOrani`}
                            type="text"
                            readOnly
                            tabIndex={-1}
                            disabled={isLocked}
                            className="form-control form-control-sm border-0 p-0 px-1 shadow-none text-center font-monospace"
                            style={{ height: "26px", fontSize: "12px", backgroundColor: "#f8fafc", cursor: "default" }}
                            value={row.bmvOrani}
                          />
                        </td>
                      )}

                      {/* BMV - Read-Only (Müdahale edilemez) */}
                      {colVisibility.bmv && (
                        <td className="p-0" style={{ borderRight: "1px solid #e2e8f0" }}>
                          <input
                            id={`grid-input-${idx}-bmv`}
                            type="text"
                            readOnly
                            tabIndex={-1}
                            disabled={isLocked}
                            className="form-control form-control-sm border-0 p-0 px-2 shadow-none text-end font-monospace"
                            style={{ height: "26px", fontSize: "12px", backgroundColor: "#f8fafc", cursor: "default" }}
                            value={row.bmv}
                          />
                        </td>
                      )}

                      {/* % (KMV %) */}
                      {colVisibility.kmvOrani && (
                        <td className="p-0" style={{ borderRight: "1px solid #e2e8f0" }}>
                          <input
                            id={`grid-input-${idx}-kmvOrani`}
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            disabled={isLocked}
                            className="form-control form-control-sm border-0 p-0 px-1 shadow-none text-center font-monospace"
                            style={{ height: "26px", fontSize: "12px", backgroundColor: "transparent" }}
                            value={row.kmvOrani}
                            onFocus={() => {
                              setActiveRowIndex(idx);
                              cleanupEmptyRows(idx);
                            }}
                            onChange={(e) => handleLineFieldChange(row.id, "kmvOrani", e.target.value)}
                            onKeyDown={(e) => handleCellKeyDown(e, idx, "kmv")}
                          />
                        </td>
                      )}

                      {/* KMV */}
                      {colVisibility.kmv && (
                        <td className="p-0" style={{ borderRight: "1px solid #e2e8f0" }}>
                          <input
                            id={`grid-input-${idx}-kmv`}
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            disabled={isLocked}
                            className="form-control form-control-sm border-0 p-0 px-2 shadow-none text-end font-monospace"
                            style={{ height: "26px", fontSize: "12px", backgroundColor: "transparent" }}
                            value={row.kmv}
                            onFocus={() => {
                              setActiveRowIndex(idx);
                              cleanupEmptyRows(idx);
                            }}
                            onChange={(e) => handleLineFieldChange(row.id, "kmv", e.target.value)}
                            onKeyDown={(e) => handleCellKeyDown(e, idx, "kmv")}
                          />
                        </td>
                      )}

                      {/* Tutar */}
                      <td className="p-0 px-2 text-end font-monospace fw-bold text-dark" style={{ fontSize: "13px" }}>
                        {row.tutar !== "" && row.tutar !== undefined && row.tutar !== null && parseDecimal(row.tutar) > 0
                          ? parseDecimal(row.tutar).toLocaleString("tr-TR", { minimumFractionDigits: tlKurusSayisi, maximumFractionDigits: tlKurusSayisi })
                          : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>

          {/* Calculations & Totals Area */}
          <Row className="mt-3 g-3 align-items-center">
            {/* Sol Alt: Toplam tutar & Toplam masraf */}
            <Col md={3}>
              <div className="d-flex align-items-center mb-2">
                <span className="small fw-semibold text-secondary text-nowrap" style={{ minWidth: "100px" }}>
                  Toplam tutar
                </span>
                <input
                  type="text"
                  readOnly
                  className="form-control form-control-sm text-end font-monospace fw-bold bg-light"
                  value={totalTutar.toLocaleString("tr-TR", { minimumFractionDigits: tlKurusSayisi, maximumFractionDigits: tlKurusSayisi })}
                />
              </div>
              <div className="d-flex align-items-center">
                <span className="small fw-semibold text-secondary text-nowrap" style={{ minWidth: "100px" }}>
                  Toplam masraf
                </span>
                <input
                  type="text"
                  readOnly
                  className="form-control form-control-sm text-end font-monospace fw-bold bg-light"
                  value={totalMasraf.toLocaleString("tr-TR", { minimumFractionDigits: tlKurusSayisi, maximumFractionDigits: tlKurusSayisi })}
                />
              </div>
            </Col>

            {/* Orta Alt: Fonksiyon Tuşları Şeridi */}
            <Col md={6}>
              <div
                className="p-1.5 rounded d-flex flex-wrap align-items-center justify-content-center gap-1.5 border shadow-2xs"
                style={{ backgroundColor: "#e0f2fe", color: "#0369a1" }}
              >
                <Button size="sm" variant="light" className="px-2 py-0.5 border text-dark fw-bold" style={{ fontSize: "11.5px" }} onClick={() => setShowIstatistikModal(true)}>
                  F3) İst.
                </Button>
                <Button size="sm" variant="light" className="px-2 py-0.5 border text-dark fw-bold" style={{ fontSize: "11.5px" }} onClick={() => setShowKurListesiModal(true)}>
                  F4) Kur
                </Button>
                <Button size="sm" variant="light" className="px-2 py-0.5 border text-dark fw-bold" style={{ fontSize: "11.5px" }} onClick={() => { fetchVezneBalances(vezneId); setShowVezneBakiyeModal(true); }}>
                  F5) Vezne
                </Button>
                <Button size="sm" variant="light" className="px-2 py-0.5 border text-dark fw-bold" style={{ fontSize: "11.5px" }} onClick={() => setShowTlHesabiModal(true)}>
                  F6) TL Hesabı
                </Button>
                <Button size="sm" variant="light" className="px-2 py-0.5 border text-dark fw-bold" style={{ fontSize: "11.5px" }} onClick={() => setShowArbitrajModal(true)}>
                  F7) Arbitraj
                </Button>
                <Button size="sm" variant="light" className="px-2 py-0.5 border text-dark fw-bold" style={{ fontSize: "11.5px" }} onClick={handleOpenDetayModal}>
                  F8) Detay
                </Button>
                <Button size="sm" variant="light" className="px-2 py-0.5 border text-dark fw-bold" style={{ fontSize: "11.5px" }} onClick={handleOpenBanknotSay}>
                  F9) Banknot Say
                </Button>
              </div>
            </Col>

            {/* Sağ Alt: Son toplam & Ödenecek / Alınacak TL */}
            <Col md={3}>
              <div className="d-flex align-items-center mb-2">
                <span className="small fw-semibold text-secondary text-nowrap" style={{ minWidth: "100px" }}>
                  Son toplam
                </span>
                <input
                  type="text"
                  readOnly
                  className="form-control form-control-sm text-end font-monospace fw-bold bg-light"
                  value={sonToplam.toLocaleString("tr-TR", { minimumFractionDigits: tlKurusSayisi, maximumFractionDigits: tlKurusSayisi })}
                />
              </div>
              <div className="d-flex align-items-center">
                <span className="small fw-bold text-dark text-nowrap" style={{ minWidth: "100px" }}>
                  {tip === 1 ? "Alınacak TL" : "Ödenecek TL"}
                </span>
                <input
                  type="text"
                  readOnly
                  className="form-control form-control-sm text-end font-monospace fw-bold text-primary bg-light"
                  value={sonToplam.toLocaleString("tr-TR", { minimumFractionDigits: tlKurusSayisi, maximumFractionDigits: tlKurusSayisi })}
                />
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Sayfa En Altı Kısayol Bilgilendirme Metni */}
      <div className="d-flex align-items-center gap-3 mt-2 px-1 text-secondary user-select-none" style={{ fontSize: "12.5px" }}>
        <span><strong>F1</strong> Kaydet</span>
        <span><strong>F2</strong> Sil</span>
        <span><strong>F3</strong> Ara</span>
        <span><strong>F7</strong> Arbitraj</span>
        <span><strong>F10</strong> Kaydet / Yazdır</span>
      </div>

      {/* DETAY MODAL (F8) matching Screenshot 3 */}
      <Modal
        show={showDetayModal}
        onHide={() => setShowDetayModal(false)}
        size="lg"
        centered
        backdrop="static"
      >
        <Modal.Header closeButton className="py-2 bg-light">
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2">
            <IconUser size={18} className="text-primary" />
            Detay (Müşteri & Kimlik Formu)
          </Modal.Title>
        </Modal.Header>
        <Modal.Body ref={detayContainerRef} className="p-3" style={{ fontSize: "13px" }}>
          <div className="d-flex align-items-center gap-2 mb-3 pb-2 border-bottom">
            <span className="fw-semibold text-secondary text-nowrap" style={{ minWidth: "80px" }}>
              Ünvan
            </span>
            <Form.Control
              type="text"
              size="sm"
              className="fw-semibold"
              data-detay-idx={0}
              onKeyDown={(e) => handleDetayFieldKeyDown(e, 0)}
              value={unvan}
              onChange={(e) => setUnvan(e.target.value)}
              onBlur={() => {
                if (!unvan || !unvan.trim() || isAnonymousCustomerName(unvan)) {
                  setUnvan(DEFAULT_CUSTOMER_NAME);
                }
              }}
              placeholder={DEFAULT_CUSTOMER_NAME}
            />
            <Button variant="link" size="sm" className="p-0 text-secondary" title="Ek Bilgiler">
              <IconPaperclip size={18} />
            </Button>
            <Button
              variant="outline-success"
              size="sm"
              className="d-flex align-items-center gap-1 text-nowrap px-2 py-1"
              onClick={() => {
                setNotification({ type: "info", message: "Kayıtsız müşteri bilgileri geçici olarak kaydedildi." });
              }}
            >
              <IconCheck size={16} /> Kayıtsız müşteri kaydet
            </Button>
          </div>

          <Row className="g-3">
            {/* Left Column */}
            <Col md={6}>
              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "110px" }}>Cari tipi</span>
                <Form.Select
                  size="sm"
                  data-detay-idx={1}
                  onKeyDown={(e) => handleDetayFieldKeyDown(e, 1)}
                  value={detayCariTipi}
                  onChange={(e) => setDetayCariTipi(e.target.value)}
                >
                  <option value="Şahıs">Şahıs</option>
                  <option value="Firma">Firma / Şirket</option>
                </Form.Select>
              </div>

              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "110px" }}>Yetkili kişi</span>
                <InputGroup size="sm">
                  <Form.Control
                    data-detay-idx={2}
                    onKeyDown={(e) => handleDetayFieldKeyDown(e, 2, "yetkiliKisi")}
                    value={detayYetkiliKisi}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDetayYetkiliKisi(val);
                      if (!val.trim()) {
                        setDetayYetkiliKisiId(undefined);
                      } else {
                        const found = cariList.find(
                          (c) => (c.yetkiliKisi || "").toLowerCase().trim() === val.toLowerCase().trim() ||
                            (c.ad || "").toLowerCase().trim() === val.toLowerCase().trim() ||
                            String(c.kod || "").trim() === val.trim()
                        );
                        setDetayYetkiliKisiId(found ? Number(found.id) : undefined);
                      }
                    }}
                  />
                  <Button
                    variant="outline-secondary"
                    title="Yetkili Kişi Seçimi (F4)"
                    onClick={() => setActiveLookupType("yetkiliKisi")}
                  >
                    <IconBinoculars size={13} />
                  </Button>
                </InputGroup>
              </div>

              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "110px" }}>Ülke</span>
                <InputGroup size="sm">
                  <Form.Control
                    data-detay-idx={3}
                    onKeyDown={(e) => handleDetayFieldKeyDown(e, 3, "ulke")}
                    value={detayUlke}
                    maxLength={50}
                    onChange={(e) => {
                      const val = e.target.value.slice(0, 50);
                      setDetayUlke(val);
                      if (!val.trim()) {
                        setDetayUlkeId(undefined);
                      } else {
                        const found = lookupData.ulkeList.find(
                          (u) => u.ad.toLowerCase().trim() === val.toLowerCase().trim() ||
                            String(u.kod || "").trim() === val.trim() ||
                            String(u.id) === val.trim()
                        );
                        setDetayUlkeId(found ? Number(found.id) : undefined);
                      }
                    }}
                  />
                  <Button
                    variant="outline-secondary"
                    title="Ülke Seçimi (F4)"
                    onClick={() => setActiveLookupType("ulke")}
                  >
                    <IconBinoculars size={13} />
                  </Button>
                </InputGroup>
              </div>

              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "110px" }}>Uyruk</span>
                <InputGroup size="sm">
                  <Form.Control
                    data-detay-idx={4}
                    onKeyDown={(e) => handleDetayFieldKeyDown(e, 4, "uyruk")}
                    value={detayUyruk}
                    maxLength={50}
                    onChange={(e) => {
                      const val = e.target.value.slice(0, 50);
                      setDetayUyruk(val);
                      if (!val.trim()) {
                        setDetayUyrukId(undefined);
                      } else {
                        const found = lookupData.uyrukList.find(
                          (u) => u.ad.toLowerCase().trim() === val.toLowerCase().trim() ||
                            String(u.kod || "").trim() === val.trim() ||
                            String(u.id) === val.trim()
                        );
                        setDetayUyrukId(found ? Number(found.id) : undefined);
                      }
                    }}
                  />
                  <Button
                    variant="outline-secondary"
                    title="Uyruk Seçimi (F4)"
                    onClick={() => setActiveLookupType("uyruk")}
                  >
                    <IconBinoculars size={13} />
                  </Button>
                </InputGroup>
              </div>

              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "110px" }}>Pasaport no</span>
                <Form.Control
                  size="sm"
                  data-detay-idx={5}
                  onKeyDown={(e) => handleDetayFieldKeyDown(e, 5)}
                  value={detayPasaportNo}
                  maxLength={30}
                  onChange={(e) => setDetayPasaportNo(e.target.value.slice(0, 30))}
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "110px" }}>Hukuki yapı</span>
                <InputGroup size="sm">
                  <Form.Control
                    data-detay-idx={6}
                    onKeyDown={(e) => handleDetayFieldKeyDown(e, 6, "hukukiYapi")}
                    value={detayHukukiYapi}
                    maxLength={50}
                    onChange={(e) => {
                      const val = e.target.value.slice(0, 50);
                      setDetayHukukiYapi(val);
                      if (!val) {
                        setDetayHukukiYapiId(undefined);
                      } else {
                        const found = lookupData.hukukiYapiList.find((x) => x.ad.toLowerCase().trim() === val.toLowerCase().trim() || String(x.kod || "") === val.trim() || String(x.id) === val.trim());
                        setDetayHukukiYapiId(found ? found.id : undefined);
                      }
                    }}
                  />
                  <Button
                    variant="outline-secondary"
                    title="Hukuki Yapı Seçimi (F4)"
                    onClick={() => setActiveLookupType("hukukiYapi")}
                  >
                    <IconBinoculars size={13} />
                  </Button>
                </InputGroup>
              </div>

              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "110px" }}>T.C.Kimlik no</span>
                <InputGroup size="sm">
                  <Form.Control
                    data-detay-idx={7}
                    onKeyDown={(e) => handleDetayFieldKeyDown(e, 7)}
                    className={`font-monospace ${tcknDogrulandi === true ? "is-valid" : tcknDogrulandi === false ? "is-invalid" : ""}`}
                    value={vergiKimlikNo}
                    maxLength={11}
                    onChange={(e) => {
                      setVergiKimlikNo(e.target.value.replace(/\D/g, "").slice(0, 11));
                      setTcknDogrulandi(null);
                    }}
                  />
                  <Button
                    variant={tcknDogrulandi === true ? "success" : tcknDogrulandi === false ? "danger" : "outline-secondary"}
                    title="Kimlik Doğrulama Simülasyonu"
                    onClick={() => {
                      const t = (vergiKimlikNo || "").trim();
                      if (t.length === 11 && /^\d+$/.test(t)) {
                        setTcknDogrulandi(true);
                        setNotification({
                          type: "success",
                          message: `T.C. Kimlik No (${t}) doğrulaması başarılı. Nüfus ve Vatandaşlık İşleri kaydı teyit edildi.`,
                        });
                      } else {
                        setTcknDogrulandi(false);
                        setNotification({
                          type: "warning",
                          message: "Geçersiz T.C. Kimlik Numarası! Lütfen 11 haneli nüfus kimlik numaranızı kontrol ediniz.",
                        });
                      }
                    }}
                  >
                    {tcknDogrulandi === true ? <IconCheck size={13} /> : tcknDogrulandi === false ? <IconAlertTriangle size={13} /> : <IconWorld size={13} />}
                  </Button>
                  <Button
                    variant="outline-danger"
                    className="px-2 py-0 d-flex align-items-center justify-content-center gap-1"
                    style={{ fontSize: "11px", fontWeight: 600 }}
                    onClick={() => handleSearchMasak(unvan, vergiKimlikNo)}
                    disabled={isSearchingMasak}
                    title="Bu TC/VKN ile MASAK Listelerinde Sorgula"
                  >
                    {isSearchingMasak ? <Spinner animation="border" size="sm" /> : <IconShieldExclamation size={13} color="#dc2626" />}
                    <span>MASAK</span>
                  </Button>
                </InputGroup>
              </div>

              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "110px" }}>Geçerlilik tarihi</span>
                <Form.Control
                  data-detay-idx={8}
                  onKeyDown={(e) => handleDetayFieldKeyDown(e, 8)}
                  type={gecerlilikFocused || detayGecerlilikTarihi ? "date" : "text"}
                  size="sm"
                  placeholder=""
                  value={detayGecerlilikTarihi}
                  onChange={(e) => setDetayGecerlilikTarihi(e.target.value)}
                  onFocus={() => setGecerlilikFocused(true)}
                  onBlur={() => setGecerlilikFocused(false)}
                  className="font-monospace"
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "110px" }}>Doğum tarihi</span>
                <Form.Control
                  data-detay-idx={9}
                  onKeyDown={(e) => handleDetayFieldKeyDown(e, 9)}
                  type={dogumFocused || detayDogumTarihi ? "date" : "text"}
                  size="sm"
                  placeholder=""
                  value={detayDogumTarihi}
                  onChange={(e) => setDetayDogumTarihi(e.target.value)}
                  onFocus={() => setDogumFocused(true)}
                  onBlur={() => setDogumFocused(false)}
                  className="font-monospace"
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "110px" }}>Doğum yeri</span>
                <Form.Control
                  size="sm"
                  data-detay-idx={10}
                  onKeyDown={(e) => handleDetayFieldKeyDown(e, 10)}
                  value={detayDogumYeri}
                  maxLength={100}
                  onChange={(e) => setDetayDogumYeri(e.target.value.slice(0, 100))}
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "110px" }}>Kimlik kaynağı</span>
                <Form.Control
                  size="sm"
                  data-detay-idx={11}
                  onKeyDown={(e) => handleDetayFieldKeyDown(e, 11)}
                  value={detayKimlikKaynagi}
                  maxLength={50}
                  onChange={(e) => setDetayKimlikKaynagi(e.target.value.slice(0, 50))}
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "110px" }}>Kimlik seri no</span>
                <Form.Control
                  size="sm"
                  data-detay-idx={12}
                  onKeyDown={(e) => handleDetayFieldKeyDown(e, 12)}
                  value={detayKimlikSeriNo}
                  maxLength={30}
                  onChange={(e) => setDetayKimlikSeriNo(e.target.value.slice(0, 30))}
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "110px" }}>Baba adı</span>
                <Form.Control
                  size="sm"
                  data-detay-idx={13}
                  onKeyDown={(e) => handleDetayFieldKeyDown(e, 13)}
                  value={detayBabaAdi}
                  maxLength={50}
                  onChange={(e) => setDetayBabaAdi(e.target.value.slice(0, 50))}
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "110px" }}>Anne adı</span>
                <Form.Control
                  size="sm"
                  data-detay-idx={14}
                  onKeyDown={(e) => handleDetayFieldKeyDown(e, 14)}
                  value={detayAnneAdi}
                  maxLength={50}
                  onChange={(e) => setDetayAnneAdi(e.target.value.slice(0, 50))}
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "110px" }}>Vergi dairesi</span>
                <InputGroup size="sm">
                  <Form.Control
                    data-detay-idx={15}
                    onKeyDown={(e) => handleDetayFieldKeyDown(e, 15, "vergiDairesi")}
                    value={detayVergiDairesi}
                    maxLength={100}
                    onChange={(e) => {
                      const val = e.target.value.slice(0, 100);
                      setDetayVergiDairesi(val);
                      if (!val.trim()) {
                        setDetayVergiDairesiId(undefined);
                      } else {
                        const matchVd = lookupData.vergiDairesiList.find(
                          (v) => v.ad.toLowerCase().trim() === val.toLowerCase().trim() ||
                            String(v.kod || "").trim() === val.trim() ||
                            String(v.id) === val.trim()
                        );
                        setDetayVergiDairesiId(matchVd ? matchVd.id : undefined);
                      }
                    }}
                  />
                  <Button
                    variant="outline-secondary"
                    title="Vergi Dairesi Seçimi (F4)"
                    onClick={() => setActiveLookupType("vergiDairesi")}
                  >
                    <IconBinoculars size={13} />
                  </Button>
                </InputGroup>
              </div>
            </Col>

            {/* Right Column */}
            <Col md={6}>
              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "110px" }}>Adres</span>
                <Form.Control
                  size="sm"
                  data-detay-idx={16}
                  onKeyDown={(e) => handleDetayFieldKeyDown(e, 16)}
                  value={detayAdres}
                  maxLength={250}
                  onChange={(e) => setDetayAdres(e.target.value.slice(0, 250))}
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "110px" }}>Posta kodu</span>
                <InputGroup size="sm">
                  <Form.Control
                    data-detay-idx={17}
                    onKeyDown={(e) => handleDetayFieldKeyDown(e, 17, "postaKodu")}
                    value={detayPostaKodu}
                    maxLength={20}
                    onChange={(e) => {
                      const v = e.target.value.slice(0, 20);
                      setDetayPostaKodu(v);
                      if (!v.trim()) {
                        setDetayPostaKoduId(undefined);
                      } else {
                        const pList = (lookupData.postaKoduList && lookupData.postaKoduList.length > 0) ? lookupData.postaKoduList : DEFAULT_POSTA_KODLARI;
                        const matchPk = pList.find(
                          (p) =>
                            String(p.kod).trim().toLowerCase() === v.trim().toLowerCase() ||
                            String(p.id).trim() === v.trim() ||
                            (p.ad && p.ad.toLowerCase().trim() === v.toLowerCase().trim())
                        );
                        setDetayPostaKoduId(matchPk ? matchPk.id : undefined);
                        if (matchPk) {
                          if (!detayIlce && matchPk.ilce) {
                            setDetayIlce(matchPk.ilce);
                            const ilceSource = (lookupData.ilceList && lookupData.ilceList.length > 0) ? lookupData.ilceList : DEFAULT_ILCELER;
                            const foundIlce = ilceSource.find((c) => c.ad?.toLowerCase().trim() === matchPk.ilce?.toLowerCase().trim());
                            if (foundIlce) setDetayIlceId(foundIlce.id);
                          }
                          if (!detayIl && matchPk.il) {
                            setDetayIl(matchPk.il);
                            const foundIl = lookupData.ilList.find((l) => l.ad?.toLowerCase().trim() === matchPk.il?.toLowerCase().trim());
                            if (foundIl) setDetayIlId(foundIl.id);
                          }
                        }
                      }
                    }}
                    placeholder="Posta kodu"
                  />
                  <Button
                    variant="outline-secondary"
                    title="Posta Kodu Seçimi (F4)"
                    onClick={() => setActiveLookupType("postaKodu")}
                  >
                    <IconBinoculars size={13} />
                  </Button>
                </InputGroup>
              </div>

              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "110px" }}>İlçe</span>
                <InputGroup size="sm">
                  <Form.Control
                    data-detay-idx={18}
                    onKeyDown={(e) => handleDetayFieldKeyDown(e, 18, "ilce")}
                    value={detayIlce}
                    maxLength={50}
                    onChange={(e) => {
                      const val = e.target.value.slice(0, 50);
                      setDetayIlce(val);
                      if (!val) {
                        setDetayIlceId(undefined);
                      } else {
                        const ilceSource = (lookupData.ilceList && lookupData.ilceList.length > 0) ? lookupData.ilceList : DEFAULT_ILCELER;
                        const found = ilceSource.find((x) => x.ad.toLowerCase().trim() === val.toLowerCase().trim() || String(x.kod || "") === val.trim() || String(x.id) === val.trim());
                        setDetayIlceId(found ? found.id : undefined);
                      }
                    }}
                  />
                  <Button
                    variant="outline-secondary"
                    title="İlçe Seçimi (F4)"
                    onClick={() => setActiveLookupType("ilce")}
                  >
                    <IconBinoculars size={13} />
                  </Button>
                </InputGroup>
              </div>

              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "110px" }}>İl</span>
                <InputGroup size="sm">
                  <Form.Control
                    data-detay-idx={19}
                    onKeyDown={(e) => handleDetayFieldKeyDown(e, 19, "il")}
                    value={detayIl}
                    maxLength={50}
                    onChange={(e) => {
                      const val = e.target.value.slice(0, 50);
                      setDetayIl(val);
                      if (!val.trim()) {
                        setDetayIlId(undefined);
                      } else {
                        const matchIl = lookupData.ilList.find(
                          (i) => i.ad.toLowerCase().trim() === val.toLowerCase().trim() ||
                            String(i.kod || "").trim() === val.trim() ||
                            String(i.id) === val.trim()
                        );
                        setDetayIlId(matchIl ? matchIl.id : undefined);
                      }
                    }}
                  />
                  <Button
                    variant="outline-secondary"
                    title="İl / Şehir Seçimi (F4)"
                    onClick={() => setActiveLookupType("il")}
                  >
                    <IconBinoculars size={13} />
                  </Button>
                </InputGroup>
              </div>

              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "110px" }}>E-Posta</span>
                <Form.Control
                  type="email"
                  size="sm"
                  data-detay-idx={20}
                  onKeyDown={(e) => handleDetayFieldKeyDown(e, 20)}
                  value={detayEposta}
                  maxLength={100}
                  onChange={(e) => setDetayEposta(e.target.value.slice(0, 100))}
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "110px" }}>Telefon</span>
                <Form.Control
                  size="sm"
                  data-detay-idx={21}
                  onKeyDown={(e) => handleDetayFieldKeyDown(e, 21)}
                  value={detayTelefon}
                  maxLength={20}
                  onChange={(e) => setDetayTelefon(e.target.value.replace(/[^0-9+\s-]/g, "").slice(0, 20))}
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "110px" }}>Vekil</span>
                <Form.Select
                  size="sm"
                  data-detay-idx={22}
                  onKeyDown={(e) => handleDetayFieldKeyDown(e, 22)}
                  value={detayVekil}
                  onChange={(e) => setDetayVekil(e.target.value)}
                >
                  <option value="Yok">Yok</option>
                  <option value="Var">Var</option>
                </Form.Select>
              </div>

              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "110px" }}>Vekil tipi</span>
                <Form.Control
                  size="sm"
                  data-detay-idx={23}
                  onKeyDown={(e) => handleDetayFieldKeyDown(e, 23)}
                  value={detayVekilTipi}
                  maxLength={30}
                  onChange={(e) => setDetayVekilTipi(e.target.value.slice(0, 30))}
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "110px" }}>Vekil adı</span>
                <Form.Control
                  size="sm"
                  data-detay-idx={24}
                  onKeyDown={(e) => handleDetayFieldKeyDown(e, 24)}
                  value={detayVekilAdi}
                  maxLength={50}
                  onChange={(e) => setDetayVekilAdi(e.target.value.slice(0, 50))}
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "110px" }}>Vergi kimlik no</span>
                <Form.Control
                  size="sm"
                  data-detay-idx={25}
                  onKeyDown={(e) => handleDetayFieldKeyDown(e, 25)}
                  value={detayVekilKimlikNo}
                  maxLength={11}
                  onChange={(e) => setDetayVekilKimlikNo(e.target.value.replace(/\D/g, "").slice(0, 11))}
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "110px" }}>Meslek</span>
                <InputGroup size="sm">
                  <Form.Control
                    data-detay-idx={26}
                    onKeyDown={(e) => handleDetayFieldKeyDown(e, 26, "meslek")}
                    value={detayMeslek}
                    maxLength={50}
                    onChange={(e) => {
                      const val = e.target.value.slice(0, 50);
                      setDetayMeslek(val);
                      if (!val.trim()) {
                        setDetayMeslekId(undefined);
                      } else {
                        const matchM = lookupData.meslekList.find(
                          (m) => m.ad.toLowerCase().trim() === val.toLowerCase().trim() ||
                            String(m.kod || "").trim() === val.trim() ||
                            String(m.id) === val.trim()
                        );
                        setDetayMeslekId(matchM ? matchM.id : undefined);
                      }
                    }}
                  />
                  <Button
                    variant="outline-secondary"
                    title="Meslek Seçimi (F4)"
                    onClick={() => setActiveLookupType("meslek")}
                  >
                    <IconBinoculars size={13} />
                  </Button>
                </InputGroup>
              </div>

              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "110px" }}>Dernek Amacı</span>
                <Form.Control
                  size="sm"
                  data-detay-idx={27}
                  onKeyDown={(e) => handleDetayFieldKeyDown(e, 27)}
                  value={detayDernekAmaci}
                  maxLength={100}
                  onChange={(e) => setDetayDernekAmaci(e.target.value.slice(0, 100))}
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "110px" }}>Banka hesabı</span>
                <InputGroup size="sm">
                  <Form.Control
                    data-detay-idx={28}
                    onKeyDown={(e) => handleDetayFieldKeyDown(e, 28, "bankaHesabi")}
                    value={detayBankaHesabi}
                    maxLength={100}
                    onChange={(e) => {
                      const val = e.target.value.slice(0, 100);
                      setDetayBankaHesabi(val);
                      if (!val.trim()) {
                        setDetayBankaHesabiId(undefined);
                      } else {
                        const bList = (lookupData.bankaList && lookupData.bankaList.length > 0) ? lookupData.bankaList : cariList;
                        const foundB = bList.find(
                          (x) => String(x.kod || "").trim() === val.trim() ||
                            (x.ad || "").toLowerCase().includes(val.toLowerCase().trim()) ||
                            ((x as any).unvan || "").toLowerCase().includes(val.toLowerCase().trim()) ||
                            String(x.id) === val.trim()
                        );
                        setDetayBankaHesabiId(foundB ? Number(foundB.id) : undefined);
                      }
                    }}
                    placeholder="Banka / IBAN seçiniz"
                  />
                  <Button
                    variant="outline-secondary"
                    title="Banka Hesabı Seçimi (F4)"
                    onClick={() => setActiveLookupType("bankaHesabi")}
                  >
                    <IconBinoculars size={13} />
                  </Button>
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={() => {
                      if (detayBankaHesabiId) {
                        alert(`Banka Hesabı Bakiye sorgulama (ID: ${detayBankaHesabiId})`);
                      } else {
                        alert("Lütfen önce bir banka hesabı seçiniz.");
                      }
                    }}
                  >
                    Bakiye
                  </Button>
                </InputGroup>
              </div>
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer className="py-2 bg-light d-flex justify-content-between">
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => setShowGumrukModal(true)}
          >
            Gümrük
          </Button>
          <Button
            variant="success"
            size="sm"
            className="d-flex align-items-center gap-1"
            onClick={() => setShowDetayModal(false)}
          >
            <IconCheck size={16} /> Tamam
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Dürbün / Search Modal */}
      <LookupModal<DovizFisListItem>
        show={showSearchModal}
        isLoading={isLoadingFisList}
        onHide={() => setShowSearchModal(false)}
        title="Döviz Fişi Listesi (Dürbün)"
        items={savedFisList}
        columns={fisColumns}
        filterFn={(item, term) => {
          const t = term.toLowerCase();
          return (
            (item.seriNo || "").toLowerCase().includes(t) ||
            (item.belgeNo || "").toLowerCase().includes(t) ||
            (item.unvan || "").toLowerCase().includes(t) ||
            (item.vergiKimlikNo || "").toLowerCase().includes(t)
          );
        }}
        onSelect={(item) => {
          setShowSearchModal(false);
          if (!isDuzeltmeMode) {
            navigate(`/vezne/doviz-fisi-duzeltme?id=${item.fisId}`);
          }
          loadFisById(item.fisId);
        }}
      />

      {/* Cari / Müşteri Seçim Modalı (Kayıtlı Cariler & Kayıtsız Müşteriler) */}
      <MusteriSecimModal
        show={showCariModal}
        onClose={() => {
          setShowCariModal(false);
          setCariSearchTerm("");
          setCariSearchField("all");
          const caller = lastModalCallerRef.current;
          lastModalCallerRef.current = null;
          if (caller === "cariKod") {
            setTimeout(() => {
              cariKodRef.current?.focus();
              cariKodRef.current?.select();
            }, 50);
          } else if (caller === "unvan") {
            setTimeout(() => {
              unvanRef.current?.focus();
              unvanRef.current?.select();
            }, 50);
          } else if (caller === "vkn") {
            setTimeout(() => {
              vknRef.current?.focus();
              vknRef.current?.select();
            }, 50);
          }
        }}
        cariler={cariList}
        kayitsizMusteriler={kayitsizMusteriList}
        onSelectCustomer={(res) => {
          lastModalCallerRef.current = null;
          handleSelectCustomer(res);
          setShowCariModal(false);
          setCariSearchTerm("");
          setCariSearchField("all");
        }}
        currentUnvan={unvan}
        initialSearchTerm={cariSearchTerm}
        initialSearchField={cariSearchField}
      />

      {/* Para / Currency Lookup Modal */}
      <LookupModal<ParaItem>
        show={showParaModal}
        onHide={() => {
          setShowParaModal(false);
          setParaModalRowId(null);
          setParaSearchTerm("");
          const caller = lastModalCallerRef.current;
          const rIdx = lastParaModalRowIndexRef.current;
          lastModalCallerRef.current = null;
          lastParaModalRowIndexRef.current = null;
          if (caller === "paraGrid" && rIdx !== null && rIdx !== undefined) {
            setTimeout(() => {
              focusCell(rIdx, "kod", "select");
            }, 50);
          }
        }}
        title="Para / Maden Seçimi"
        items={paraList}
        columns={paraColumns}
        initialSearchTerm={paraSearchTerm}
        filterFn={(item, term) => {
          const t = term.toLowerCase().trim();
          if (!t) return true;
          const info = getUrunTipiInfo(item as any);
          return (
            (item.kod || "").toLowerCase().includes(t) ||
            (item.ad || "").toLowerCase().includes(t) ||
            info.label.toLowerCase().includes(t)
          );
        }}
        onSelect={(item) => {
          lastModalCallerRef.current = null;
          lastParaModalRowIndexRef.current = null;
          if (paraModalRowId) {
            handleSelectCurrency(paraModalRowId, item);
          }
          setShowParaModal(false);
          setParaModalRowId(null);
          setParaSearchTerm("");
        }}
      />

      {/* Vezne Lookup Modal */}
      <LookupModal<VezneItem>
        show={showVezneModal}
        onHide={() => setShowVezneModal(false)}
        title="Vezne Seçimi"
        items={vezneList}
        columns={vezneColumns}
        filterFn={(item, term) => {
          const t = term.toLowerCase();
          return (
            (item.kod || "").toLowerCase().includes(t) ||
            (item.ad || "").toLowerCase().includes(t)
          );
        }}
        onSelect={(item) => {
          setVezneId(item.id);
          setVezneKod(item.kod || "01");
          setVezneAd(item.ad || "Ana Vezne");
          fetchVezneBalances(item.id);
          setShowVezneModal(false);
        }}
      />

      {/* Detay Generic SearchLookupModal for All Binoculars */}
      <LookupModal<any>
        show={activeLookupType !== null}
        onHide={() => setActiveLookupType(null)}
        title={
          activeLookupType === "ulke"
            ? "Ülke Seçimi"
            : activeLookupType === "uyruk"
              ? "Uyruk Seçimi"
              : activeLookupType === "hukukiYapi"
                ? "Hukuki Yapı Seçimi"
                : activeLookupType === "yetkiliKisi"
                  ? "Yetkili Kişi Seçimi"
                  : activeLookupType === "il"
                    ? "İl / Şehir Seçimi"
                    : activeLookupType === "ilce"
                      ? "İlçe Seçimi"
                      : activeLookupType === "postaKodu"
                        ? "Posta Kodu Seçimi"
                        : activeLookupType === "vergiDairesi"
                          ? "Vergi Dairesi Seçimi"
                          : activeLookupType === "meslek"
                            ? "Meslek Seçimi"
                            : "Banka Hesabı Seçimi"
        }
        items={
          activeLookupType === "ulke"
            ? lookupData.ulkeList
            : activeLookupType === "uyruk"
              ? lookupData.uyrukList
              : activeLookupType === "hukukiYapi"
                ? lookupData.hukukiYapiList
                : activeLookupType === "yetkiliKisi"
                  ? cariList
                  : activeLookupType === "il"
                    ? lookupData.ilList
                    : activeLookupType === "ilce"
                      ? (() => {
                        const source = (lookupData.ilceList && lookupData.ilceList.length > 0) ? lookupData.ilceList : DEFAULT_ILCELER;
                        if (!detayIlId && !detayIl) return source;
                        const matchIl = lookupData.ilList.find((i) => i.id === detayIlId || i.ad.toLowerCase() === detayIl.toLowerCase());
                        const ilName = matchIl?.ad || detayIl;
                        const ilId = matchIl?.id || detayIlId;
                        const filtered = source.filter((i) => (ilId && i.ustId === ilId) || (ilName && i.ilAdi?.toLowerCase() === ilName.toLowerCase()));
                        return filtered.length > 0 ? filtered : source;
                      })()
                      : activeLookupType === "postaKodu"
                        ? lookupData.postaKoduList && lookupData.postaKoduList.length > 0
                          ? lookupData.postaKoduList
                          : DEFAULT_POSTA_KODLARI
                        : activeLookupType === "vergiDairesi"
                          ? lookupData.vergiDairesiList
                          : activeLookupType === "meslek"
                            ? lookupData.meslekList
                            : activeLookupType === "bankaHesabi"
                              ? lookupData.bankaList && lookupData.bankaList.length > 0
                                ? lookupData.bankaList
                                : DEFAULT_BANKALAR
                              : cariList
        }
        columns={
          activeLookupType === "postaKodu"
            ? [
              {
                header: "Posta Kodu",
                width: "110px",
                render: (it) => <span className="font-monospace fw-bold text-primary">{it.kod || it.id}</span>,
              },
              {
                header: "Semt / Mahalle",
                render: (it) => <span>{it.ad}</span>,
              },
              {
                header: "İlçe",
                width: "130px",
                render: (it) => <span>{it.ilce || "-"}</span>,
              },
              {
                header: "İl",
                width: "120px",
                render: (it) => <span className="fw-semibold">{it.il || "-"}</span>,
              },
            ]
            : activeLookupType === "ilce"
              ? [
                {
                  header: "İlçe Kodu",
                  width: "100px",
                  render: (it) => <span className="font-monospace fw-bold">{it.kod || it.id}</span>,
                },
                {
                  header: "İlçe Adı",
                  render: (it) => <span className="fw-semibold">{it.ad}</span>,
                },
                {
                  header: "Bağlı İl",
                  width: "140px",
                  render: (it) => {
                    const ilName =
                      it.ilAdi || lookupData.ilList.find((l) => l.id === it.ustId)?.ad || (detayIl || "-");
                    return <span className="text-secondary">{ilName}</span>;
                  },
                },
              ]
              : activeLookupType === "bankaHesabi"
                ? [
                  {
                    header: "Hesap Kodu",
                    width: "120px",
                    render: (it) => <span className="font-monospace fw-bold text-primary">{it.kod || it.id}</span>,
                  },
                  {
                    header: "Banka / Hesap Ünvanı",
                    render: (it) => <span className="fw-semibold">{it.ad || it.unvan || it.bankaAdi}</span>,
                  },
                  {
                    header: "IBAN",
                    width: "230px",
                    render: (it) => <span className="font-monospace small text-muted">{it.iban || "-"}</span>,
                  },
                  {
                    header: "Hesap / Şube No",
                    width: "140px",
                    render: (it) => <span>{it.hesapNo || it.subeAdi || "-"}</span>,
                  },
                ]
                : activeLookupType === "yetkiliKisi"
                  ? [
                    {
                      header: "Cari Kod",
                      width: "110px",
                      render: (it) => <span className="font-monospace fw-bold">{it.kod}</span>,
                    },
                    {
                      header: "Yetkili Kişi / Ünvan",
                      render: (it) => <span>{it.yetkiliKisi || it.ad}</span>,
                    },
                    {
                      header: "Telefon",
                      width: "120px",
                      render: (it) => <span>{it.telefon || "-"}</span>,
                    },
                  ]
                  : [
                    {
                      header: "Kod",
                      width: "100px",
                      render: (it) => <span className="font-monospace fw-bold">{it.kod || it.id}</span>,
                    },
                    {
                      header: "Tanım / Açıklama",
                      render: (it) => <span>{it.ad}</span>,
                    },
                  ]
        }
        filterFn={(it, term) => {
          const t = term.toLowerCase();
          if (activeLookupType === "postaKodu") {
            return (
              String(it.kod || it.id || "").toLowerCase().includes(t) ||
              String(it.ad || "").toLowerCase().includes(t) ||
              String(it.ilce || "").toLowerCase().includes(t) ||
              String(it.il || "").toLowerCase().includes(t)
            );
          }
          if (activeLookupType === "ilce") {
            const ilName = it.ilAdi || lookupData.ilList.find((l) => l.id === it.ustId)?.ad || "";
            return (
              String(it.kod || it.id || "").toLowerCase().includes(t) ||
              String(it.ad || "").toLowerCase().includes(t) ||
              ilName.toLowerCase().includes(t)
            );
          }
          if (activeLookupType === "bankaHesabi") {
            return (
              String(it.kod || "").toLowerCase().includes(t) ||
              String(it.ad || it.unvan || "").toLowerCase().includes(t) ||
              String(it.iban || "").toLowerCase().includes(t) ||
              String(it.hesapNo || "").toLowerCase().includes(t) ||
              String(it.bankaAdi || "").toLowerCase().includes(t)
            );
          }
          if (activeLookupType === "yetkiliKisi") {
            return (
              (it.kod || "").toLowerCase().includes(t) ||
              (it.ad || "").toLowerCase().includes(t) ||
              (it.yetkiliKisi || "").toLowerCase().includes(t)
            );
          }
          return (
            (String(it.kod || "")).toLowerCase().includes(t) ||
            (String(it.ad || "")).toLowerCase().includes(t) ||
            (String(it.id || "")).includes(t)
          );
        }}
        onSelect={(it) => {
          if (activeLookupType === "ulke") {
            setDetayUlkeId(it.id);
            setDetayUlke(it.ad);
          } else if (activeLookupType === "uyruk") {
            setDetayUyrukId(it.id);
            setDetayUyruk(it.ad);
          } else if (activeLookupType === "hukukiYapi") {
            setDetayHukukiYapiId(it.id);
            setDetayHukukiYapi(it.ad);
          } else if (activeLookupType === "yetkiliKisi") {
            setDetayYetkiliKisi(it.yetkiliKisi || it.ad || "");
            if (it.id) setDetayYetkiliKisiId(Number(it.id));
          } else if (activeLookupType === "il") {
            setDetayIlId(it.id);
            setDetayIl(it.ad);
          } else if (activeLookupType === "ilce") {
            setDetayIlceId(it.id);
            setDetayIlce(it.ad);
            if (it.ustId && !detayIlId) {
              setDetayIlId(it.ustId);
              const matchedIl = lookupData.ilList.find((l) => l.id === it.ustId);
              if (matchedIl) setDetayIl(matchedIl.ad);
              else if (it.ilAdi) setDetayIl(it.ilAdi);
            } else if (it.ilAdi && !detayIl) {
              setDetayIl(it.ilAdi);
            }
          } else if (activeLookupType === "postaKodu") {
            setDetayPostaKoduId(it.id);
            setDetayPostaKodu(it.kod || String(it.id));
            if (it.il) {
              setDetayIl(it.il);
              const matchedIl = lookupData.ilList.find((l) => l.ad?.toLowerCase() === it.il?.toLowerCase());
              if (matchedIl) setDetayIlId(matchedIl.id);
            }
            if (it.ilce) {
              setDetayIlce(it.ilce);
              const ilceSource = (lookupData.ilceList && lookupData.ilceList.length > 0) ? lookupData.ilceList : DEFAULT_ILCELER;
              const matchedIlce = ilceSource.find((c) => c.ad?.toLowerCase() === it.ilce?.toLowerCase());
              if (matchedIlce) setDetayIlceId(matchedIlce.id);
            }
          } else if (activeLookupType === "vergiDairesi") {
            setDetayVergiDairesiId(it.id);
            setDetayVergiDairesi(it.ad);
          } else if (activeLookupType === "meslek") {
            setDetayMeslekId(it.id);
            setDetayMeslek(it.ad);
          } else if (activeLookupType === "bankaHesabi") {
            setDetayBankaHesabiId(it.id);
            setDetayBankaHesabi(it.ad || it.unvan || it.kod);
          }
          setActiveLookupType(null);
        }}
      />

      {/* F7) Arbitraj Modalı */}
      <ArbitrajModal
        show={showArbitrajModal}
        onClose={() => setShowArbitrajModal(false)}
        paralar={paraList}
        kurSatirlar={kurSatirlar}
        vezneId={vezneId}
        vezneKod={vezneKod}
        vezneAd={vezneAd}
        selectedCariId={cariKartId}
        selectedUnvan={unvan}
        selectedCariKod={cariKod}
        vknTckn={vergiKimlikNo}
        istatistikKodu={istatistikKodu}
        hedefTlTutar={sonToplam || 0}
        cariList={cariList}
        statisticList={statisticList}
        pageType="doviz"
        fisTip={tip}
        onApplyToFis={handleApplyArbitrajToDovizFis}
      />

      {/* Gümrük Beyanname Modal */}
      <Modal
        show={showGumrukModal}
        onHide={() => setShowGumrukModal(false)}
        centered
        backdrop="static"
      >
        <Modal.Header closeButton className="py-2 bg-light">
          <Modal.Title className="fs-6 fw-bold">Gümrük Beyanname Bilgileri</Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3" style={{ fontSize: "13px" }}>
          <div className="d-flex align-items-center mb-2">
            <span className="text-secondary small text-nowrap" style={{ width: "130px" }}>
              Beyanname No
            </span>
            <Form.Control
              size="sm"
              data-gumruk-idx={0}
              onKeyDown={(e) => handleGumrukFieldKeyDown(e, 0)}
              value={gmBeyannameNo}
              maxLength={30}
              onChange={(e) => setGmBeyannameNo(e.target.value.slice(0, 30))}
              placeholder="Örn: 24340000EX000000"
            />
          </div>

          <div className="d-flex align-items-center mb-2">
            <span className="text-secondary small text-nowrap" style={{ width: "130px" }}>
              Beyanname Tarihi
            </span>
            <Form.Control
              type="date"
              size="sm"
              data-gumruk-idx={1}
              onKeyDown={(e) => handleGumrukFieldKeyDown(e, 1)}
              value={gmBeyannameTarih}
              onChange={(e) => setGmBeyannameTarih(e.target.value)}
            />
          </div>

          <div className="d-flex align-items-center mb-2">
            <span className="text-secondary small text-nowrap" style={{ width: "130px" }}>
              Döviz Tarih / Sayı
            </span>
            <div className="d-flex gap-2 w-100">
              <Form.Control
                type="date"
                size="sm"
                data-gumruk-idx={2}
                onKeyDown={(e) => handleGumrukFieldKeyDown(e, 2)}
                value={gmDovizTarih}
                onChange={(e) => setGmDovizTarih(e.target.value)}
              />
              <Form.Control
                size="sm"
                data-gumruk-idx={3}
                onKeyDown={(e) => handleGumrukFieldKeyDown(e, 3)}
                value={gmDovizSayi}
                maxLength={30}
                onChange={(e) => setGmDovizSayi(e.target.value.slice(0, 30))}
                placeholder="Sayı"
              />
            </div>
          </div>

          <div className="d-flex align-items-center mb-2">
            <span className="text-secondary small text-nowrap" style={{ width: "130px" }}>
              Teyit Tarih / Sayı
            </span>
            <div className="d-flex gap-2 w-100">
              <Form.Control
                type="date"
                size="sm"
                data-gumruk-idx={4}
                onKeyDown={(e) => handleGumrukFieldKeyDown(e, 4)}
                value={gmTeyitTarih}
                onChange={(e) => setGmTeyitTarih(e.target.value)}
              />
              <Form.Control
                size="sm"
                data-gumruk-idx={5}
                onKeyDown={(e) => handleGumrukFieldKeyDown(e, 5)}
                value={gmTeyitSayi}
                maxLength={30}
                onChange={(e) => setGmTeyitSayi(e.target.value.slice(0, 30))}
                placeholder="Sayı"
              />
            </div>
          </div>

          <div className="d-flex align-items-center mb-2">
            <span className="text-secondary small text-nowrap" style={{ width: "130px" }}>
              Fatura No
            </span>
            <Form.Control
              size="sm"
              data-gumruk-idx={6}
              onKeyDown={(e) => handleGumrukFieldKeyDown(e, 6)}
              value={gmFaturaNo}
              maxLength={30}
              onChange={(e) => setGmFaturaNo(e.target.value.slice(0, 30))}
              placeholder="Fatura No"
            />
          </div>
        </Modal.Body>
        <Modal.Footer className="py-2 bg-light d-flex justify-content-end">
          <Button
            variant="primary"
            size="sm"
            className="d-flex align-items-center gap-1"
            onClick={() => {
              setShowGumrukModal(false);
              setNotification({
                type: "success",
                message: "Gümrük beyanname bilgileri kaydedildi.",
              });
            }}
          >
            <IconCheck size={16} /> Kaydet
          </Button>
        </Modal.Footer>
      </Modal>

      {/* 80mm Termal e-Döviz Fişi Yazdırma Modalı */}
      <DovizFisiPrintModal
        show={showPrintModal}
        autoPrint={isPendingDirectPrint}
        onHide={() => {
          setShowPrintModal(false);
          setIsPendingDirectPrint(false);
          setPrintSnapshot(null);
        }}
        fisId={printSnapshot?.fisId ?? fisId}
        tip={printSnapshot?.tip ?? tip}
        tarih={printSnapshot?.tarih ?? tarih}
        saat={printSnapshot?.saat ?? saat}
        seriNo={printSnapshot?.seriNo ?? seriNo}
        belgeNo={printSnapshot?.belgeNo ?? belgeNo}
        unvan={printSnapshot?.unvan ?? unvan}
        vergiKimlikNo={printSnapshot?.vergiKimlikNo ?? vergiKimlikNo}
        detayIl={printSnapshot?.detayIl ?? detayIl}
        detayIlce={printSnapshot?.detayIlce ?? detayIlce}
        detayUyruk={printSnapshot?.detayUyruk ?? detayUyruk}
        detayPasaportNo={printSnapshot?.detayPasaportNo ?? detayPasaportNo}
        detayMeslek={printSnapshot?.detayMeslek ?? detayMeslek}
        detayCariTipi={printSnapshot?.detayCariTipi ?? detayCariTipi}
        vezneKod={printSnapshot?.vezneKod ?? vezneKod}
        vezne={vezneList.find((v) => v.id === vezneId) || (vezneList.length > 0 ? vezneList[0] : null)}
        istatistikKodu={printSnapshot?.istatistikKodu ?? istatistikKodu}
        lines={printSnapshot?.lines ?? lines.map((l) => ({
          paraKodu: l.paraKodu,
          paraAdi: l.paraAdi,
          miktar: l.miktar,
          kur: l.kur,
          tutar: l.tutar,
          bmv: l.bmv,
          komisyon: l.komisyon,
        }))}
        toplamTutar={printSnapshot?.toplamTutar ?? totalTutar}
        odemeTutari={printSnapshot?.odemeTutari ?? sonToplam}
        bsmvTutari={printSnapshot?.bsmvTutari ?? calculatedBsmv}
        komisyonTutari={printSnapshot?.komisyonTutari ?? totalKomisyon}
        giseUsdKuru={printSnapshot?.giseUsdKuru ?? (() => {
          const usdPara = paraList.find((p) => p.kod?.toUpperCase() === "USD");
          return usdPara ? resolveCurrencyRate(usdPara, tip, kurTuru) : 1;
        })()}
        dovizKurusSayisi={dovizKurusSayisi}
        kurKurusSayisi={kurKurusSayisi}
        tlKurusSayisi={tlKurusSayisi}
      />

      {/* F3) İstatistik Kodu Seçim Modalı */}
      <IstatistikSecimModal
        show={showIstatistikModal}
        onClose={() => {
          setShowIstatistikModal(false);
          const caller = lastModalCallerRef.current;
          lastModalCallerRef.current = null;
          if (caller === "istatistik") {
            setTimeout(() => {
              istatistikRef.current?.focus();
              istatistikRef.current?.select();
            }, 50);
          }
        }}
        tip={tip}
        onSelect={(item) => {
          lastModalCallerRef.current = null;
          handleSelectIstatistik(item);
        }}
        currentKod={istatistikKodu}
        initialSearchTerm={istatistikSearchTerm}
      />

      {/* F4) Kur Listesi (Gişe Kurları) Modalı */}
      <KurListesiModal
        show={showKurListesiModal}
        onClose={() => setShowKurListesiModal(false)}
        paralar={paraList}
        onSelect={handleSelectFromKurListesi}
        kurKurusSayisi={kurKurusSayisi}
        tip={tip}
        kurTuru={kurTuru}
      />

      {/* F5) Vezne Bakiye Modalı */}
      <VezneBakiyeModal
        show={showVezneBakiyeModal}
        onClose={() => setShowVezneBakiyeModal(false)}
        vezneAd={vezneAd}
        vezneKod={vezneKod}
        bakiyeler={vezneBakiyeler}
        tlKurusSayisi={tlKurusSayisi}
      />

      {/* F6) TL Hesabı Modalı */}
      <TlHesabiModal
        show={showTlHesabiModal}
        onClose={() => setShowTlHesabiModal(false)}
        paralar={paraList}
        tip={tip}
        kurTuru={kurTuru}
        resolveCurrencyRate={resolveCurrencyRate}
        onApply={handleApplyTlHesabi}
        kurKurusSayisi={kurKurusSayisi}
        dovizKurusSayisi={dovizKurusSayisi}
        tlKurusSayisi={tlKurusSayisi}
      />

      {/* F9) Para Sayma (Banknot Say) Modalı */}
      <ParaSaymaModal
        show={showParaSaymaModal}
        onClose={() => setShowParaSaymaModal(false)}
        currencies={getParaSaymaCurrencies()}
        counts={banknotSaymaCounts}
        onCountsChange={setBanknotSaymaCounts}
        tlKurusSayisi={tlKurusSayisi}
        dovizKurusSayisi={dovizKurusSayisi}
      />

      {/* MASAK Sorgulama Sonuç Modalı */}
      <MasakSonucModal
        show={masakModalOpen}
        onHide={() => setMasakModalOpen(false)}
        queriedName={masakResult.queriedName}
        queriedId={masakResult.queriedId}
        matches={masakResult.matches}
        searched={masakResult.searched}
        onOpenMasakManagement={() => setMasakManagementOpen(true)}
      />

      {/* 1) Kişi Seçildiğinde MASAK Sınırı Uyarısı Modalı (Sayfa Ortasında) */}
      <Modal show={showMasakCustomerWarningModal} onHide={() => setShowMasakCustomerWarningModal(false)} centered>
        <Modal.Header closeButton className="py-2 bg-warning-subtle text-warning-emphasis">
          <Modal.Title className="h6 mb-0 d-flex align-items-center gap-2">
            <IconAlertTriangle size={20} className="text-warning" />
            MASAK Yasal Bildirim Sınırı Uyarısı
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="py-3">
          <div className="d-flex align-items-start gap-3">
            <div className="p-2 bg-warning bg-opacity-10 rounded-circle text-warning flex-shrink-0">
              <IconAlertTriangle size={32} />
            </div>
            <div>
              <p className="mb-2 fw-semibold">
                İşlem tutarı MASAK Yasal Bildirim Sınırını (≥185.000 TL / 5.000 USD) aşmaktadır.
              </p>
              <p className="small text-muted mb-0">
                5549 sayılı yasa gereğince işlem yapılan müşterinin <strong>İsim / Ünvan, T.C. Kimlik / VKN, Adres ve Hukuki Yapı</strong> bilgilerinin eksiksiz girilmesi zorunludur.
              </p>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer className="py-2">
          <Button size="sm" variant="outline-secondary" onClick={() => {
            setShowMasakCustomerWarningModal(false);
            setShowDetayModal(true);
          }}>
            Detay Bilgileri Aç (F8)
          </Button>
          <Button size="sm" variant="primary" onClick={() => setShowMasakCustomerWarningModal(false)}>
            Tamam
          </Button>
        </Modal.Footer>
      </Modal>

      {/* 2a) Kaydederken Zorunlu MASAK Bilgileri Eksik Modalı (Sayfa Ortasında) */}
      <Modal show={showMasakMissingModal} onHide={() => setShowMasakMissingModal(false)} centered>
        <Modal.Header closeButton className="py-2 bg-danger-subtle text-danger">
          <Modal.Title className="h6 mb-0 d-flex align-items-center gap-2">
            <IconAlertTriangle size={20} className="text-danger" />
            MASAK Zorunlu Bilgi Eksikliği
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="py-3">
          <p className="mb-2">
            İşlem toplam tutarı <strong>MASAK Yasal Sınırını (≥185.000 TL / 5.000 USD)</strong> aşmaktadır.
          </p>
          <div className="alert alert-danger py-2 px-3 small mb-2">
            <strong>Eksik Alanlar:</strong>
            <ul className="mb-0 ps-3 mt-1">
              {masakMissingFields.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </div>
          <div className="small text-muted">
            Mevzuat gereği bu bilgiler olmadan fiş kaydedilemez. Lütfen detay penceresinden eksik bilgileri doldurunuz.
          </div>
        </Modal.Body>
        <Modal.Footer className="py-2">
          <Button size="sm" variant="secondary" onClick={() => setShowMasakMissingModal(false)}>
            Vazgeç
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              setShowMasakMissingModal(false);
              setShowDetayModal(true);
            }}
          >
            Detay Bilgilerini Doldur (F8)
          </Button>
        </Modal.Footer>
      </Modal>

      {/* 2b) Kaydederken MASAK Sınırı Onay Modalı (Sayfa Ortasında: Yine de Kaydedeyim mi / Vazgeç) */}
      <Modal show={showMasakConfirmModal} onHide={() => setShowMasakConfirmModal(false)} centered>
        <Modal.Header closeButton className="py-2 bg-warning-subtle text-warning-emphasis">
          <Modal.Title className="h6 mb-0 d-flex align-items-center gap-2">
            <IconAlertTriangle size={20} className="text-warning" />
            MASAK Yasal Sınırı - Kayıt Onayı
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="py-3 text-center">
          <div className="mb-3">
            <IconAlertTriangle size={48} className="text-warning animate-bounce" />
          </div>
          <h6 className="fw-bold mb-2">
            İşlem MASAK Yasal Sınırını (≥185.000 TL / 5.000 USD) Aşmaktadır!
          </h6>
          <p className="small text-muted mb-3">
            Müşteri kimlik ve adres bilgileri mevzuat gereğince işlemle birlikte kayıt altına alınacaktır.
          </p>
          <div className="alert alert-warning py-2 small mb-0 fw-semibold">
            Fişi yine de kaydetmek istiyor musunuz?
          </div>
        </Modal.Body>
        <Modal.Footer className="py-2 justify-content-center">
          <Button size="sm" variant="secondary" className="px-3" onClick={() => setShowMasakConfirmModal(false)}>
            Vazgeç
          </Button>
          <Button
            size="sm"
            variant="warning"
            className="fw-bold px-3"
            onClick={() => {
              setShowMasakConfirmModal(false);
              handleToolbarSave(true, isPendingDirectPrint);
            }}
          >
            Yine de Kaydet
          </Button>
        </Modal.Footer>
      </Modal>

      {/* MASAK Resmi Listeleri Yönetme / Güncelleme Modalı */}
      <MasakModal
        show={masakManagementOpen}
        onHide={() => setMasakManagementOpen(false)}
      />
    </div>
  );
};

export default DovizFisiPage;
