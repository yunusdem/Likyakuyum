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
} from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import LookupModal, { LookupColumn } from "../../components/common/LookupModal";
import { DovizFisiPrintModal } from "./DovizFisiPrintModal";
import { IstatistikSecimModal } from "./IstatistikSecimModal";
import { MusteriSecimModal, SelectedCustomerResult } from "./MusteriSecimModal";
import { KurListesiModal } from "./KurListesiModal";
import { VezneBakiyeModal } from "./VezneBakiyeModal";
import { TlHesabiModal } from "./TlHesabiModal";
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
    } catch {}
    return defaultColVisibility;
  });

  const toggleCol = (col: keyof typeof defaultColVisibility) => {
    setColVisibility((prev) => {
      const next = { ...prev, [col]: !prev[col] };
      try { localStorage.setItem(GRID_COL_STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  // Modals
  const [showSearchModal, setShowSearchModal] = useState<boolean>(false);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [companyDefinitions, setCompanyDefinitions] = useState<TodvzTanimDto | null>(null);

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
  const [showVezneModal, setShowVezneModal] = useState<boolean>(false);
  const [showParaModal, setShowParaModal] = useState<boolean>(false);
  const [paraModalRowId, setParaModalRowId] = useState<string | null>(null);
  const [showDetayModal, setShowDetayModal] = useState<boolean>(false);
  const [showGumrukModal, setShowGumrukModal] = useState<boolean>(false);
  const [tcknDogrulandi, setTcknDogrulandi] = useState<boolean | null>(null);

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
    ulkeList: [],
    uyrukList: [],
    ilList: [],
    ilceList: [],
    postaKoduList: DEFAULT_POSTA_KODLARI,
    vergiDairesiList: [],
    meslekList: [],
    hukukiYapiList: [],
    bankaList: DEFAULT_BANKALAR,
  });

  const [savedFisList, setSavedFisList] = useState<DovizFisListItem[]>([]);
  const [isLoadingFisList, setIsLoadingFisList] = useState<boolean>(false);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const detayContainerRef = useRef<HTMLDivElement | null>(null);

  // Active Doviz Fis Form State
  const [fisId, setFisId] = useState<number | null>(null);
  const [isLocked, setIsLocked] = useState<boolean>(false); // Read-only if sent to GIB
  const [isGonderildi, setIsGonderildi] = useState<boolean>(false);
  const [vezneId, setVezneId] = useState<number>(1);
  const [vezneKod, setVezneKod] = useState<string>("01");
  const [vezneAd, setVezneAd] = useState<string>("Ana Vezne");
  const [tip, setTip] = useState<number>(0); // 0: Alış, 1: Satış
  const [tarih, setTarih] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [saat, setSaat] = useState<string>(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  });

  // Empty inputs by default
  const [seriNo, setSeriNo] = useState<string>("");
  const [belgeNo, setBelgeNo] = useState<string>("");
  const [unvan, setUnvan] = useState<string>("İSİM BEYAN EDİLMEMİŞTİR");
  const [cariKartId, setCariKartId] = useState<number | null>(null);
  const [kayitsizMusteriList, setKayitsizMusteriList] = useState<KayitsizMusteriItem[]>([]);
  const [vergiKimlikNo, setVergiKimlikNo] = useState<string>("");
  const [gelisNedeni, setGelisNedeni] = useState<string>("");
  const [kurTuru, setKurTuru] = useState<number>(0); // 0: Efektif, 1: Döviz
  const [istatistikId, setIstatistikId] = useState<number | null>(null);
  const [istatistikKodu, setIstatistikKodu] = useState<string>("");

  // Detailed Customer Information (Detay Modal State) with IDs
  const [detayCariTipi, setDetayCariTipi] = useState<string>("Şahıs");
  const [detayYetkiliKisi, setDetayYetkiliKisi] = useState<string>("");
  const [detayYetkiliKisiId, setDetayYetkiliKisiId] = useState<number | null>(null);
  const [detaySirketTuru, setDetaySirketTuru] = useState<string>("");
  const [detayUlke, setDetayUlke] = useState<string>("");
  const [detayUlkeId, setDetayUlkeId] = useState<number | null>(null);
  const [detayUyruk, setDetayUyruk] = useState<string>("");
  const [detayUyrukId, setDetayUyrukId] = useState<number | null>(null);
  const [detayPasaportNo, setDetayPasaportNo] = useState<string>("");
  const [detayHukukiYapi, setDetayHukukiYapi] = useState<string>("");
  const [detayHukukiYapiId, setDetayHukukiYapiId] = useState<number | null>(null);
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

  // Table Lines: Starts with EXACTLY 1 row if no data
  const createEmptyRow = (satirNo: number): GridLineItem => ({
    id: `row-${Date.now()}-${Math.random()}`,
    satirNo,
    paraId: 0,
    paraKodu: "",
    paraAdi: "",
    miktar: "",
    kur: "",
    komisyonOrani: "",
    komisyon: "",
    bmvOrani: "",
    bmv: "",
    kmvOrani: "",
    kmv: "",
    tutar: "",
  });

  const [lines, setLines] = useState<GridLineItem[]>([createEmptyRow(1)]);
  const [activeRowIndex, setActiveRowIndex] = useState<number>(0);

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

  // Clear form for fresh new entry (Registration mode)
  const resetForm = useCallback(() => {
    setFisId(null);
    setIsLocked(false);
    setIsGonderildi(false);
    const now = new Date();
    setTarih(now.toISOString().split("T")[0]);
    setSaat(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
    setSeriNo("");
    setBelgeNo("");
    setUnvan("İSİM BEYAN EDİLMEMİŞTİR");
    setCariKartId(null);
    setVergiKimlikNo("");
    setGelisNedeni("");
    setTip(0);
    setKurTuru(0);
    setIstatistikId(null);
    setIstatistikKodu("");
    setDetayCariTipi("Şahıs");
    setDetayYetkiliKisi("");
    setDetayYetkiliKisiId(null);
    setDetaySirketTuru("");
    setDetayUlke("");
    setDetayUlkeId(null);
    setDetayUyruk("");
    setDetayUyrukId(null);
    setDetayPasaportNo("");
    setDetayHukukiYapi("");
    setDetayHukukiYapiId(null);
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
    setDetayPostaKodu("");
    setDetayPostaKoduId(null);
    setDetayIlce("");
    setDetayIlceId(null);
    setDetayIl("");
    setDetayIlId(null);
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
  }, []);

  // Load Lookups
  const loadLookupsAndList = useCallback(async () => {
    setIsLoadingLookups(true);
    try {
      const [cariler, vezneler, paralar, kurTabloRes, istatistikler, fisler, cariLk, compDef, kayitsizlar] = await Promise.all([
        CariService.getCariKartlar().catch(() => [] as CariKartItem[]),
        apiClient.get<VezneItem[]>("/vezne").then((r) => r.data || []).catch(() => [] as VezneItem[]),
        apiClient.get<ParaItem[]>("/para").then((r) => r.data || []).catch(() => [] as ParaItem[]),
        KurService.getKurTablosu({ tur: 0 }).catch(() => null),
        StatisticService.getStatistics().catch(() => [] as StatisticItem[]),
        DovizFisService.getFisList({ limit: 100 }).catch(() => [] as DovizFisListItem[]),
        CariService.getLookups().catch(() => null),
        CompanyService.getDefinitions().catch(() => null),
        DovizFisService.getKayitsizMusteriler().catch(() => [] as KayitsizMusteriItem[]),
      ]);

      if (kayitsizlar) {
        setKayitsizMusteriList(kayitsizlar);
      }

      if (compDef) {
        setCompanyDefinitions(compDef);
      }

      if (cariLk) {
        setLookupData({
          ulkeList: cariLk.ulkeList || [],
          uyrukList: cariLk.ulkeList || [],
          ilList: cariLk.ilList || [],
          ilceList: cariLk.ilceList && cariLk.ilceList.length > 0 ? (cariLk.ilceList as any) : DEFAULT_ILCELER,
          postaKoduList:
            cariLk.postaKoduList && cariLk.postaKoduList.length > 0
              ? (cariLk.postaKoduList as any)
              : DEFAULT_POSTA_KODLARI,
          vergiDairesiList: cariLk.vergiDairesiList || [],
          meslekList: cariLk.meslekList || [],
          hukukiYapiList: cariLk.hukukiYapiList || [],
          bankaList:
            cariLk.bankaList && cariLk.bankaList.length > 0
              ? cariLk.bankaList
              : DEFAULT_BANKALAR,
        });
      }

      const trimmedCariler = cariler.map((c) => ({
        ...c,
        kod: (c.kod || "").replace(/\s+/g, " ").trim(),
        ad: (c.ad || "").replace(/\s+/g, " ").trim(),
        telefon: (c.telefon || "").trim(),
      }));
      setCariList(trimmedCariler);

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

      await fetchVezneBalances(currentVezneId);

      let anlikKurSatirlari = kurTabloRes?.satirlar || [];
      let gunlukKurSatirlari: KurRowItem[] = [];
      try {
        const gunlukKurTabloRes = await KurService.getKurTablosu({ tur: 1 });
        if (gunlukKurTabloRes?.satirlar && gunlukKurTabloRes.satirlar.length > 0) {
          gunlukKurSatirlari = gunlukKurTabloRes.satirlar;
        }
      } catch (_) {}

      // Combine anlık and günlük rates (anlık takes priority, günlük fills missing rates)
      const mergedKurMap = new Map<string, KurRowItem>();
      gunlukKurSatirlari.forEach((k) => {
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
      setParaList(combinedParalar);

      if (isDuzeltmeMode) {
        if (queryId) {
          await loadFisById(Number(queryId));
        } else {
          // Düzeltme ekranı ilk açılışta boş yeni kayıt modunda açılır; kullanıcı üst arama butonundan istediği fişi seçer
          resetForm();
          applyDefaultIstatistik(tip, istatistikler, compDef, user);
        }
      } else {
        resetForm();
        // Yeni fiş modunda varsayılan istatistiği ata
        // user: AuthContext'ten gelen güncel değer; istatistikler ve compDef: yerel değişkenler (stale yok)
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
  }, [fetchVezneBalances, isDuzeltmeMode, queryId, resetForm]);

  useEffect(() => {
    loadLookupsAndList();
  }, [loadLookupsAndList]);

  // Load single Doviz Fis into form
  const loadFisById = async (id: number) => {
    try {
      const fis = await DovizFisService.getFisById(id);
      if (!fis) return;
      setFisId(fis.fisId);
      setIsGonderildi(true);

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
      setUnvan(fis.unvan || "İSİM BEYAN EDİLMEMİŞTİR");
      setCariKartId(fis.cariKartId);
      setVergiKimlikNo(fis.vergiKimlikNo || "");
      setGelisNedeni(fis.gelisNedeni || "");
      setKurTuru(fis.kurTuru ?? 0);
      setIstatistikId(fis.istatistikId);
      setIstatistikKodu(fis.istatistikKodu || (fis.tip === 1 ? "10285" : "9249"));

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
      }
      if (fis.uyrukId) {
        setDetayUyrukId(fis.uyrukId);
        const matchUyruk = lookupData.uyrukList.find((u) => u.id === fis.uyrukId);
        if (matchUyruk) setDetayUyruk(matchUyruk.ad);
      }
      if ((fis as any).hukukiYapiId) {
        setDetayHukukiYapiId((fis as any).hukukiYapiId);
        const matchH = lookupData.hukukiYapiList.find((h) => h.id === (fis as any).hukukiYapiId);
        if (matchH) {
          setDetayHukukiYapi(matchH.ad || matchH.kod || String((fis as any).hukukiYapiId));
        } else {
          setDetayHukukiYapi(String((fis as any).hukukiYapiId));
        }
      }
      if (fis.vergiDairesiId) {
        setDetayVergiDairesiId(fis.vergiDairesiId);
        const matchVd = lookupData.vergiDairesiList.find((v) => v.id === fis.vergiDairesiId);
        if (matchVd) setDetayVergiDairesi(matchVd.ad);
      }
      if ((fis as any).ilId) {
        setDetayIlId((fis as any).ilId);
      }
      if ((fis as any).il) {
        setDetayIl((fis as any).il);
      } else if ((fis as any).ilId) {
        const matchIl = lookupData.ilList.find((i) => i.id === (fis as any).ilId);
        if (matchIl) setDetayIl(matchIl.ad);
      }

      if ((fis as any).ilceId) {
        setDetayIlceId((fis as any).ilceId);
      }
      if ((fis as any).ilce) {
        setDetayIlce((fis as any).ilce);
      } else if ((fis as any).ilceId) {
        const ilceSource = (lookupData.ilceList && lookupData.ilceList.length > 0) ? lookupData.ilceList : DEFAULT_ILCELER;
        const matchIlce = ilceSource.find((i) => i.id === (fis as any).ilceId);
        if (matchIlce) {
          setDetayIlce(matchIlce.ad);
        }
      }

      if ((fis as any).postaKoduId) {
        setDetayPostaKoduId((fis as any).postaKoduId);
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
          fis.satirlar.map((s, idx) => ({
            id: `row-${idx}-${Date.now()}`,
            satirNo: s.satirNo || idx + 1,
            paraId: s.paraId,
            paraKodu: s.paraKodu || "",
            paraAdi: s.paraAdi || "",
            miktar: s.miktar != null ? Number(s.miktar).toFixed(dovizKurusSayisi) : "",
            kur: s.kur ? Number(s.kur).toFixed(kurKurusSayisi) : "",
            komisyonOrani: s.komisyonOrani || "",
            komisyon: s.komisyon || "",
            bmvOrani: s.bmvOrani || (fis.tip === 1 ? "0.2" : ""),
            bmv: s.bmv || "",
            kmvOrani: s.kmvOrani || "",
            kmv: s.kmv || "",
            tutar: s.tutar != null ? Number(s.tutar).toFixed(tlKurusSayisi) : "",
          }))
        );
      } else {
        setLines([createEmptyRow(1)]);
      }

      await fetchVezneBalances(fis.vezneId);
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

  const calculateRowTutar = useCallback((miktar: number | string, kur: number | string): number => {
    const m = typeof miktar === "number" ? miktar : parseFloat(String(miktar).replace(/,/g, ".")) || 0;
    const k = typeof kur === "number" ? kur : parseFloat(String(kur).replace(/,/g, ".")) || 0;
    const factor = Math.pow(10, tlKurusSayisi);
    return Math.round(m * k * factor) / factor;
  }, [tlKurusSayisi]);

  const handleAddRow = () => {
    setLines((prev) => [...prev, createEmptyRow(prev.length + 1)]);
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

  const handleLineFieldChange = (
    id: string,
    field: keyof GridLineItem,
    value: string
  ) => {
    if (isLocked) return;

    // Sadece geçerli pozitif sayı ve tek ondalık ayırıcı girişine izin ver
    if (
      field === "miktar" ||
      field === "kur" ||
      field === "komisyon" ||
      field === "komisyonOrani" ||
      field === "bmv" ||
      field === "bmvOrani" ||
      field === "kmv" ||
      field === "kmvOrani"
    ) {
      let cleanVal = value.replace(/[^0-9.,]/g, "");
      const parts = cleanVal.split(/[.,]/);
      if (parts.length > 2) {
        cleanVal = parts[0] + "." + parts.slice(1).join("");
      }
      value = cleanVal;
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
            const autoKur = resolveCurrencyRate(matched, tip, kurTuru);
            if (autoKur > 0) {
              updated.kur = autoKur.toFixed(kurKurusSayisi);
            }
          } else if (upper === "") {
            updated.paraId = 0;
            updated.paraAdi = "";
          }
        }

        const m = field === "miktar" ? value : updated.miktar;
        const k = field === "kur" ? value : updated.kur;
        const tutar = calculateRowTutar(m, k);
        updated.tutar = tutar > 0 ? tutar : "";

        // 1. Komisyon % ve Komisyon Tutarı (Tutar * %Komisyon)
        const komRate = parseFloat(String(updated.komisyonOrani || "0").replace(/,/g, ".")) || 0;
        const factor = Math.pow(10, tlKurusSayisi);
        if (field === "komisyon") {
          updated.komisyon = value;
        } else if (komRate > 0 && tutar > 0) {
          updated.komisyon = (Math.round(tutar * (komRate / 100) * factor) / factor).toFixed(tlKurusSayisi);
        } else if (field === "komisyonOrani" && !value) {
          updated.komisyon = "";
        }

        // 2. BMV % ve BMV Tutarı
        if (tip === 1) {
          let currentBmvOrani = updated.bmvOrani;
          if (field !== "bmvOrani" && !currentBmvOrani && tutar > 0) {
            currentBmvOrani = "0.2";
            updated.bmvOrani = "0.2";
          }
          const bmvRate = parseFloat(String(currentBmvOrani || "0").replace(/,/g, ".")) || 0;
          if (field === "bmv") {
            updated.bmv = value;
          } else if (bmvRate > 0 && tutar > 0) {
            updated.bmv = (Math.round(tutar * (bmvRate / 100) * factor) / factor).toFixed(tlKurusSayisi);
          } else if (field === "bmvOrani" && !value) {
            updated.bmv = "";
          }
        } else {
          updated.bmvOrani = "0";
          updated.bmv = "";
        }

        // 3. KMV Tutarı
        if (field === "kmvOrani") {
          const kmvRate = parseFloat(String(value || "0").replace(/,/g, ".")) || 0;
          if (kmvRate > 0 && tutar > 0) {
            updated.kmv = (Math.round(tutar * (kmvRate / 100) * factor) / factor).toFixed(tlKurusSayisi);
          } else if (!value) {
            updated.kmv = "";
          }
        }

        return updated;
      })
    );
  };

  const handleSelectCurrency = (rowId: string, para: ParaItem) => {
    if (isLocked) return;
    const autoKur = resolveCurrencyRate(para, tip, kurTuru);
    setLines((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        const m = typeof row.miktar === "number" ? row.miktar : parseFloat(String(row.miktar).replace(/,/g, ".")) || 0;
        const tutar = calculateRowTutar(m, autoKur);
        const factor = Math.pow(10, tlKurusSayisi);
        const bmvOrani = tip === 1 ? "0.2" : "0";
        const bmvVal = tip === 1 && tutar > 0 ? (Math.round(tutar * 0.002 * factor) / factor).toFixed(tlKurusSayisi) : "";
        const komRate = parseFloat(String(row.komisyonOrani || "0").replace(/,/g, ".")) || 0;
        const komVal = komRate > 0 && tutar > 0 ? (Math.round(tutar * (komRate / 100) * factor) / factor).toFixed(tlKurusSayisi) : row.komisyon;
        return {
          ...row,
          paraId: para.id,
          paraKodu: para.kod,
          paraAdi: para.ad,
          kur: autoKur > 0 ? autoKur.toFixed(kurKurusSayisi) : "",
          tutar: tutar > 0 ? tutar : "",
          bmvOrani,
          bmv: bmvVal,
          komisyon: komVal,
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

  const handleSelectIstatistik = (item: IstatistikSecimItem) => {
    if (isLocked) return;
    setIstatistikId(item.id);
    setIstatistikKodu(item.kod);
    setShowIstatistikModal(false);
    setTimeout(() => {
      focusCell(0, "kod");
    }, 50);
  };

  const handleSelectCustomer = (result: SelectedCustomerResult) => {
    setUnvan(result.unvan || "İSİM BEYAN EDİLMEMİŞTİR");
    if (result.type === "registered") {
      setCariKartId(result.id);
    } else {
      setCariKartId(null);
    }
    if (result.vergiKimlikNo) {
      setVergiKimlikNo(result.vergiKimlikNo);
    }
    if (result.adres) setDetayAdres(result.adres);
    if (result.telefon) setDetayTelefon(result.telefon);

    const raw = result.raw as any;
    if (raw) {
      if (raw.yetkiliKisi) setDetayYetkiliKisi(raw.yetkiliKisi);
      if (raw.yetkiliKisiId) setDetayYetkiliKisiId(Number(raw.yetkiliKisiId));
      else if (raw.id && result.type === "registered") setDetayYetkiliKisiId(Number(raw.id));

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

      const pkSource = (lookupData.postaKoduList && lookupData.postaKoduList.length > 0) ? lookupData.postaKoduList : DEFAULT_POSTA_KODLARI;
      if (raw.postaKoduId) {
        setDetayPostaKoduId(Number(raw.postaKoduId));
        const mPk = pkSource.find((p) => p.id === Number(raw.postaKoduId));
        if (mPk) setDetayPostaKodu(mPk.kod || mPk.ad);
      }
      if (raw.postaKodu) setDetayPostaKodu(String(raw.postaKodu));
      if (raw.bankaHesabiId) setDetayBankaHesabiId(Number(raw.bankaHesabiId));
    }
    setShowCariModal(false);
  };

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

    const factor = Math.pow(10, tlKurusSayisi);
    const bmvOrani = tip === 1 ? "0.2" : "0";
    const bmvVal =
      tip === 1 && data.tutar > 0
        ? (Math.round(data.tutar * 0.002 * factor) / factor).toFixed(tlKurusSayisi)
        : "";

    if (isCurrentEmpty && currentRow) {
      setLines((prev) =>
        prev.map((r, i) =>
          i === targetIdx
            ? {
                ...r,
                paraId: data.para.id,
                paraKodu: data.para.kod,
                paraAdi: data.para.ad,
                miktar: data.miktar.toString(),
                kur: data.kur.toFixed(kurKurusSayisi),
                tutar: data.tutar,
                bmvOrani,
                bmv: bmvVal,
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
        miktar: data.miktar.toString(),
        kur: data.kur.toFixed(kurKurusSayisi),
        tutar: data.tutar,
        bmvOrani,
        bmv: bmvVal,
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
      const t = typeof row.tutar === "number" ? row.tutar : parseFloat(String(row.tutar)) || 0;
      return acc + t;
    }, 0);
  }, [lines]);

  const calculatedBsmv = useMemo(() => {
    if (tip !== 1) return 0;
    return lines.reduce((acc, row) => {
      const b = typeof row.bmv === "number" ? row.bmv : parseFloat(String(row.bmv)) || 0;
      return acc + b;
    }, 0);
  }, [lines, tip]);

  const totalKomisyon = useMemo(() => {
    return lines.reduce((acc, row) => {
      const k = typeof row.komisyon === "number" ? row.komisyon : parseFloat(String(row.komisyon)) || 0;
      return acc + k;
    }, 0);
  }, [lines]);

  // Toplam Masraf: Tablodaki satırların toplam BMV ve Komisyon toplamıdır.
  const totalMasraf = useMemo(() => {
    const factor = Math.pow(10, tlKurusSayisi);
    return Math.round((calculatedBsmv + totalKomisyon) * factor) / factor;
  }, [calculatedBsmv, totalKomisyon, tlKurusSayisi]);

  // Son Toplam / Alışta: (Toplam Tutar - Masraflar), Satışta: (Toplam Tutar + Toplam BMV)
  const sonToplam = useMemo(() => {
    const factor = Math.pow(10, tlKurusSayisi);
    if (tip === 1) {
      return Math.round((totalTutar + calculatedBsmv) * factor) / factor;
    } else {
      return Math.round((totalTutar - totalMasraf) * factor) / factor;
    }
  }, [totalTutar, calculatedBsmv, totalMasraf, tip, tlKurusSayisi]);

  // F9) Banknot Say (Para Sayma) Açılış Kontrolü
  const handleOpenBanknotSay = useCallback(() => {
    // Fiş gridindeki geçerli döviz satırlarını kontrol et
    const validLines = lines.filter((l) => {
      const m = typeof l.miktar === "number" ? l.miktar : parseFloat(String(l.miktar).replace(/,/g, ".")) || 0;
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
      const m = typeof l.miktar === "number" ? l.miktar : parseFloat(String(l.miktar).replace(/,/g, ".")) || 0;
      return (l.paraId || (l.paraKodu && l.paraKodu.trim() !== "")) && m > 0;
    });

    const map = new Map<string, ParaSaymaCurrencyItem>();

    validLines.forEach((l) => {
      const kod = (l.paraKodu || "").trim().toUpperCase();
      const miktar = typeof l.miktar === "number" ? l.miktar : parseFloat(String(l.miktar).replace(/,/g, ".")) || 0;
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
   * Fiş tipine göre varsayılan istatistiği belirler (saf parametre fonksiyonu - stale closure yok):
   * 1. Kullanıcı tanımındaki buyStatCode / sellStatCode (istatistik kodu olarak saklanır)
   * 2. Firma tanımlarındaki ALIS_ISTATISTIK_ID / SATIS_ISTATISTIK_ID (id bazlı, String karşılaştırma)
   * 3. Fallback: Alış→'9249', Satış→'10285' sabit kodları
   */
  const applyDefaultIstatistik = (
    fisTipi: number,
    istatistikler: StatisticItem[],
    compDef: TodvzTanimDto | null,
    currentUser: typeof user
  ) => {
    // 1. Kullanıcı tanımındaki stat kodu (buyStatCode / sellStatCode)
    const userStatKod = (fisTipi === 1
      ? (currentUser?.sellStatCode || "")
      : (currentUser?.buyStatCode || "")
    ).trim();

    if (userStatKod) {
      const matched = istatistikler.find(
        (s) => (s.kod || "").trim().toLowerCase() === userStatKod.toLowerCase()
      );
      if (matched) {
        setIstatistikId(matched.id);
        setIstatistikKodu(matched.kod || userStatKod);
        return;
      }
      // Liste içinde bulunamadıysa kodu direkt yaz (ID olmadan)
      setIstatistikId(null);
      setIstatistikKodu(userStatKod);
      return;
    }

    // 2. Firma tanımındaki istatistik ID (String karşılaştırma ile tip güvenliği)
    const compIstatistikId = fisTipi === 1
      ? (compDef?.SATIS_ISTATISTIK_ID ?? null)
      : (compDef?.ALIS_ISTATISTIK_ID ?? null);

    if (compIstatistikId != null) {
      const matched = istatistikler.find(
        (s) => String(s.id) === String(compIstatistikId)
      );
      if (matched) {
        setIstatistikId(matched.id);
        setIstatistikKodu(matched.kod || "");
        return;
      }
    }

    // 3. Fallback: sabit varsayılan kodlar (Alış→9249, Satış→10285)
    const fallbackKod = fisTipi === 0 ? "9249" : "10285";
    const fallbackMatched = istatistikler.find(
      (s) => (s.kod || "").trim() === fallbackKod
    );
    if (fallbackMatched) {
      setIstatistikId(fallbackMatched.id);
      setIstatistikKodu(fallbackMatched.kod || fallbackKod);
      return;
    }

    // 4. Hiçbiri yoksa varsayılan kodu direkt yaz
    setIstatistikId(null);
    setIstatistikKodu(fallbackKod);
  };

  const handleTipChange = (newTip: number) => {
    setTip(newTip);
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
        const m = typeof row.miktar === "number" ? row.miktar : parseFloat(String(row.miktar).replace(/,/g, ".")) || 0;
        const tutar = calculateRowTutar(m, rate);
        const factor = Math.pow(10, tlKurusSayisi);
        const bmvOrani = newTip === 1 ? (row.paraId || row.paraKodu || m > 0 ? "0.2" : "") : "0";
        const bmv = newTip === 1 && tutar > 0 ? (Math.round(tutar * 0.002 * factor) / factor).toFixed(tlKurusSayisi) : "";
        const komRate = parseFloat(String(row.komisyonOrani || "0").replace(/,/g, ".")) || 0;
        const komisyon = komRate > 0 && tutar > 0 ? (Math.round(tutar * (komRate / 100) * factor) / factor).toFixed(tlKurusSayisi) : row.komisyon;
        return {
          ...row,
          kur: rate > 0 ? rate.toFixed(kurKurusSayisi) : row.kur,
          tutar: tutar > 0 ? tutar : "",
          bmvOrani,
          bmv,
          komisyon,
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
        const m = typeof row.miktar === "number" ? row.miktar : parseFloat(String(row.miktar).replace(/,/g, ".")) || 0;
        const tutar = calculateRowTutar(m, newRate);
        const factor = Math.pow(10, tlKurusSayisi);
        const bmvOrani = tip === 1 ? (row.paraId || row.paraKodu || m > 0 ? "0.2" : "") : "0";
        const bmv = tip === 1 && tutar > 0 ? (Math.round(tutar * 0.002 * factor) / factor).toFixed(tlKurusSayisi) : "";
        const komRate = parseFloat(String(row.komisyonOrani || "0").replace(/,/g, ".")) || 0;
        const komisyon = komRate > 0 && tutar > 0 ? (Math.round(tutar * (komRate / 100) * factor) / factor).toFixed(tlKurusSayisi) : row.komisyon;
        return {
          ...row,
          kur: newRate > 0 ? newRate.toFixed(kurKurusSayisi) : row.kur,
          tutar: tutar > 0 ? tutar : "",
          bmvOrani,
          bmv,
          komisyon,
        };
      })
    );
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

  // Helper to reliably focus grid cells and set proper cursor position
  const focusCell = (
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
      } else if (attempts < 20) {
        attempts++;
        setTimeout(tryFocus, 25);
      }
    };
    tryFocus();
  };

  // Keyboard navigation across all grid cells
  const handleCellKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    field: GridColumnKey
  ) => {
    // F3, F4, F5, F6, F9 Kısayolları grid inputu aktifken de doğrudan modalları açsın
    if (e.key === "F3") {
      e.preventDefault();
      e.stopPropagation();
      setShowIstatistikModal(true);
      return;
    }
    if (e.key === "F4") {
      e.preventDefault();
      e.stopPropagation();
      setShowKurListesiModal(true);
      return;
    }
    if (e.key === "F5") {
      e.preventDefault();
      e.stopPropagation();
      fetchVezneBalances(vezneId);
      setShowVezneBakiyeModal(true);
      return;
    }
    if (e.key === "F6") {
      e.preventDefault();
      e.stopPropagation();
      setShowTlHesabiModal(true);
      return;
    }
    if (e.key === "F9") {
      e.preventDefault();
      e.stopPropagation();
      handleOpenBanknotSay();
      return;
    }

    const el = e.currentTarget;
    const maxRow = lines.length - 1;

    // Görünür olan navigasyon sütunlarının dinamik sırası
    const visibleCols: GridColumnKey[] = ["kod", "miktar", "kur"];
    if (colVisibility.komisyonOrani) visibleCols.push("komisyonOrani");
    if (colVisibility.komisyon) visibleCols.push("komisyon");
    if (colVisibility.bmvOrani) visibleCols.push("bmvOrani");
    if (colVisibility.bmv) visibleCols.push("bmv");
    if (colVisibility.kmvOrani) visibleCols.push("kmvOrani");
    if (colVisibility.kmv) visibleCols.push("kmv");

    const currentVisIdx = visibleCols.indexOf(field);
    const isLastVisibleCol = currentVisIdx === visibleCols.length - 1;

    // Ctrl+Enter veya Alt+Enter: Hangi hücrede olursa olsun satırı tamamlayıp bir alt satıra geç (veya yeni satır aç)
    if (e.key === "Enter" && (e.ctrlKey || e.altKey)) {
      e.preventDefault();
      if (rowIndex >= lines.length - 1) {
        const nextIdx = lines.length;
        handleAddRow();
        setActiveRowIndex(nextIdx);
        focusCell(nextIdx, "kod", "select");
      } else {
        setActiveRowIndex(rowIndex + 1);
        focusCell(rowIndex + 1, "kod", "select");
      }
      return;
    }

    // 1. Enter Tuşu: Bir sonraki alana geçiş, son görünür alanda ise altta YENİ SATIR açıp yeni satırın kod alanına geçiş
    if (e.key === "Enter") {
      e.preventDefault();
      if (field === "kod") {
        const currentCode = (lines[rowIndex]?.paraKodu || "").trim().toUpperCase();
        if (currentCode) {
          const matched = paraList.find((p) => p.kod.toUpperCase() === currentCode);
          if (matched) {
            handleSelectCurrency(lines[rowIndex].id, matched);
            focusCell(rowIndex, "miktar", "select");
            return;
          }
        }
        focusCell(rowIndex, "miktar", "select");
        return;
      }

      if (isLastVisibleCol) {
        // Satırın son alanında Enter'a basıldı:
        // Eğer son satırsa KESİNLİKLE altta YENİ SATIR aç ve yeni satırın kod alanına geç!
        if (rowIndex >= lines.length - 1) {
          const nextIdx = lines.length;
          handleAddRow();
          setActiveRowIndex(nextIdx);
          focusCell(nextIdx, "kod", "select");
        } else {
          // Altında zaten satır varsa bir alt satırın kod alanına geç
          setActiveRowIndex(rowIndex + 1);
          focusCell(rowIndex + 1, "kod", "select");
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

    // Tab Tuşu: Son görünür sütunda basıldığında yeni satır açıp kod hücresine geçsin
    if (e.key === "Tab" && !e.shiftKey && isLastVisibleCol) {
      e.preventDefault();
      if (rowIndex >= lines.length - 1) {
        const nextIdx = lines.length;
        handleAddRow();
        setActiveRowIndex(nextIdx);
        focusCell(nextIdx, "kod", "select");
      } else {
        setActiveRowIndex(rowIndex + 1);
        focusCell(rowIndex + 1, "kod", "select");
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
        // Satırın son sütunundayken sağa basınca bir sonraki satıra geçsin (yoksa yeni satır açsın)
        const nextIdx = rowIndex + 1;
        if (rowIndex >= maxRow) {
          handleAddRow();
        }
        setActiveRowIndex(nextIdx);
        focusCell(nextIdx, "kod", "start");
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
          const lastVisible = visibleCols[visibleCols.length - 1];
          setActiveRowIndex(prevIdx);
          focusCell(prevIdx, lastVisible, "end");
        }
        return;
      }
    }

    // 4. Aşağı Yön Oku: Aynı sütunda alt satıra geçer, son satırdaysa yeni satır açar
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const targetIdx = rowIndex + 1;
      if (rowIndex >= maxRow) {
        handleAddRow();
      }
      setActiveRowIndex(targetIdx);
      focusCell(targetIdx, field, "select");
      return;
    }

    // 5. Yukarı Yön Oku: Aynı sütunda üst satıra geçer
    if (e.key === "ArrowUp" && rowIndex > 0) {
      e.preventDefault();
      const targetIdx = rowIndex - 1;
      setActiveRowIndex(targetIdx);
      focusCell(targetIdx, field, "select");
      return;
    }
  };

  const handleToolbarNew = () => {
    if (isDuzeltmeMode) {
      navigate("/vezne/doviz-fisi");
    } else {
      resetForm();
      applyDefaultIstatistik(tip, statisticList, companyDefinitions, user);
      setNotification({
        type: "info",
        message: "Yeni döviz fişi formu temizlendi.",
      });
    }
  };

  const handleToolbarSave = async () => {
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
        (typeof r.miktar === "number" ? r.miktar > 0 : (parseFloat(String(r.miktar).replace(/,/g, ".")) || 0) > 0)
    );

    const validLines = lines.filter((row) => {
      const m = typeof row.miktar === "number" ? row.miktar : parseFloat(String(row.miktar).replace(/,/g, ".")) || 0;
      const k = typeof row.kur === "number" ? row.kur : parseFloat(String(row.kur).replace(/,/g, ".")) || 0;
      return (row.paraId > 0 || row.paraKodu.trim() !== "") && m > 0 && k > 0;
    });

    if (!hasAnyInput || validLines.length === 0) {
      setNotification({
        type: "warning",
        message: "Fişte kaydedilecek geçerli döviz satırı bulunamadı! Fiş satırları boş olarak kaydedilemez. Lütfen en az bir satıra Döviz Cinsi, Miktar (>0) ve Kur (>0) giriniz.",
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    for (let i = 0; i < lines.length; i++) {
      const row = lines[i];
      const hasCode = row.paraId > 0 || row.paraKodu.trim() !== "" || row.paraAdi.trim() !== "";
      const m = typeof row.miktar === "number" ? row.miktar : parseFloat(String(row.miktar).replace(/,/g, ".")) || 0;
      const k = typeof row.kur === "number" ? row.kur : parseFloat(String(row.kur).replace(/,/g, ".")) || 0;

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

      const isAnonymous = !unvan || !unvan.trim() || 
        unvan.trim().toLocaleUpperCase('tr-TR') === "İSİM BEYAN EDİLMEMİŞTİR" || 
        unvan.trim().toLocaleUpperCase('tr-TR') === "ISIM BEYAN EDILMEMISTIR" ||
        unvan.trim().toLowerCase() === "isim beyan edilmemiştir";

      const finalUnvan = isAnonymous ? "İSİM BEYAN EDİLMEMİŞTİR" : unvan.trim();

      const payload: SaveDovizFisPayload = {
        fisId: fisId || undefined,
        vezneId: activeVezneId,
        tip,
        tarih,
        zaman: saat,
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
          const m = typeof l.miktar === "number" ? l.miktar : parseFloat(String(l.miktar).replace(/,/g, ".")) || 0;
          const k = typeof l.kur === "number" ? l.kur : parseFloat(String(l.kur).replace(/,/g, ".")) || 0;
          const bmvVal = tip === 1 ? Math.round(m * k * 0.002 * 100) / 100 : 0;

          return {
            satirNo: idx,
            paraId: pId,
            paraKodu: l.paraKodu || "",
            paraAdi: l.paraAdi || "",
            miktar: m,
            kur: k,
            iscilik: 0,
            giseKuru: k,
            tutar: calculateRowTutar(m, k),
            komisyonOrani: parseFloat(String(l.komisyonOrani || "0")) || 0,
            komisyon: parseFloat(String(l.komisyon || "0")) || 0,
            bmvOrani: tip === 1 ? 0.2 : 0,
            bmv: bmvVal,
            kmvOrani: parseFloat(String(l.kmvOrani || "0")) || 0,
            kmv: parseFloat(String(l.kmv || "0")) || 0,
            kdvOrani: 0,
            kdv: 0,
          };
        }),
      };

      const saved = await DovizFisService.saveFis(payload);

      setNotification({
        type: "success",
        message: `Döviz Fişi (${saved.seriNo || saved.belgeNo || saved.fisId}) Başarıyla Kaydedildi. Yeni fiş kaydına geçildi.`,
      });
      window.scrollTo({ top: 0, behavior: "smooth" });

      await fetchVezneBalances(vezneId);
      const freshList = await DovizFisService.getFisList({ limit: 100 });
      setSavedFisList(freshList);

      // Kayıt sonrasında otomatik yeni kayıt moduna geç ve tüm alanları temizle
      resetForm();
      applyDefaultIstatistik(tip, statisticList, companyDefinitions, user);

      if (isDuzeltmeMode) {
        navigate("/vezne/doviz-fisi");
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
    if (savedFisList.length === 0) return;
    const idx = savedFisList.length - 1;
    setCurrentIndex(idx);
    await loadFisById(savedFisList[idx].fisId);
  };

  // Keyboard shortcut listener (F1..F10, ESC)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isAnyModalOpen =
        showKurListesiModal ||
        showVezneBakiyeModal ||
        showTlHesabiModal ||
        showDetayModal ||
        showParaSaymaModal ||
        showIstatistikModal ||
        showSearchModal ||
        showCariModal ||
        showVezneModal ||
        showParaModal ||
        showGumrukModal ||
        showPrintModal;

      if (isAnyModalOpen) {
        if (e.key === "Escape") {
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
          if (showDetayModal) {
            e.preventDefault();
            setShowDetayModal(false);
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
        }
        // Modal açıkken sayfa toolbar kısayollarını (F1 Kaydet vb.) çalıştırma
        return;
      }

      if (e.key === "F1") {
        e.preventDefault();
        e.stopPropagation();
        handleToolbarSave();
      } else if (e.key === "F2") {
        if (isDuzeltmeMode) {
          e.preventDefault();
          e.stopPropagation();
          handleToolbarDelete();
        }
      } else if (e.key === "F3") {
        e.preventDefault();
        e.stopPropagation();
        setShowIstatistikModal(true);
      } else if (e.key === "F4") {
        e.preventDefault();
        e.stopPropagation();
        setShowKurListesiModal(true);
      } else if (e.key === "F5") {
        e.preventDefault();
        e.stopPropagation();
        fetchVezneBalances(vezneId);
        setShowVezneBakiyeModal(true);
      } else if (e.key === "F6") {
        e.preventDefault();
        e.stopPropagation();
        setShowTlHesabiModal(true);
      } else if (e.key === "F8") {
        e.preventDefault();
        e.stopPropagation();
        setShowDetayModal(true);
      } else if (e.key === "F9") {
        e.preventDefault();
        e.stopPropagation();
        handleOpenBanknotSay();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [
    handleToolbarSave,
    handleToolbarDelete,
    isDuzeltmeMode,
    vezneId,
    fetchVezneBalances,
    showIstatistikModal,
    showKurListesiModal,
    showVezneBakiyeModal,
    showTlHesabiModal,
    showDetayModal,
    showParaSaymaModal,
    showSearchModal,
    showCariModal,
    showVezneModal,
    showParaModal,
    showGumrukModal,
    showPrintModal,
    handleOpenBanknotSay,
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
    { header: "Kod", width: "90px", render: (p) => p.kod },
    { header: "Ad", render: (p) => p.ad },
    {
      header: tip === 0 ? (kurTuru === 0 ? "Efektif Alış" : "Döviz Alış") : (kurTuru === 0 ? "Efektif Satış" : "Döviz Satış"),
      align: "right",
      width: "130px",
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

  return (
    <div className="container-fluid p-2" style={{ backgroundColor: "#f8fafc", minHeight: "100vh" }}>
      {/* Top ERP Toolbar with Refresh Icon on right and Dynamic Balances */}
      <ERPToolbar
        disableShortcuts={true}
        pageTitle={
          <div className="d-flex align-items-center gap-2">
            <span style={{ fontSize: "14px", fontWeight: 700 }}>
              {isDuzeltmeMode ? "Döviz Fişi Düzeltme" : "Döviz Fişi"}
            </span>
            <span
              className="badge px-2 py-0.5 fw-bold text-white shadow-2xs"
              style={{
                fontSize: "11px",
                backgroundColor: tip === 1 ? "#16a34a" : "#b91c1c",
                letterSpacing: "0.5px",
                borderRadius: "3px",
              }}
            >
              {tip === 1 ? "SATIŞ FİŞİ" : "ALIŞ FİŞİ"}
            </span>
          </div>
        }
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
        onPrint={() => setShowPrintModal(true)}
        onRefresh={loadLookupsAndList}
        rightContent={
          <>
          {/* A4 PDF belge (GİB e-Döviz düzeni) — Belge sayfasında açılır; bkz. docs/belgeverapor.md */}
          <Button
            variant="outline-danger"
            size="sm"
            className="d-flex align-items-center gap-1 me-2"
            disabled={!fisId}
            title={fisId ? "Kayıtlı fişin A4 PDF belgesini yeni sekmede aç" : "Önce fişi kaydedin veya bir fiş seçin"}
            onClick={() => window.open(`/raporlar/belge?fisId=${fisId}`, "_blank", "noopener")}
          >
            PDF Belge
          </Button>
          <div className="d-flex align-items-center gap-2 px-2.5 py-0.5 bg-white rounded border shadow-2xs small" style={{ fontSize: "12px" }}>
            <span className="fw-bold text-dark">
              TL : {topBalances.tl.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-secondary">|</span>
            <span className="fw-bold text-dark">
              USD : {topBalances.usd.toLocaleString("tr-TR")}
            </span>
            <span className="text-secondary">|</span>
            <span className="fw-bold text-dark">
              EUR : {topBalances.eur.toLocaleString("tr-TR")}
            </span>
          </div>
          </>
        }
      />

      {/* GİB Kilit Uyarısı */}
      {isLocked && (
        <Alert variant="warning" className="d-flex align-items-center gap-2 my-1 py-1.5 px-3 shadow-2xs">
          <IconLock size={16} className="text-danger" />
          <span className="fw-bold small">GİB'e gönderilen fişler değiştirilemez. (Salt Okunur)</span>
        </Alert>
      )}

      {/* Notifications Alert */}
      {notification && (
        <Alert
          variant={notification.type}
          dismissible
          onClose={() => setNotification(null)}
          className="my-1 py-1.5 px-3 shadow-2xs d-flex align-items-center justify-content-between small"
        >
          <span>{notification.message}</span>
        </Alert>
      )}

      {/* Ana Form Kartı */}
      <Card className="border-0 shadow-sm rounded-2 overflow-hidden mt-1">
        <Card.Body className="p-0">
          {/* En Üstteki 3 Alan (Ferah kenarlıklı, yazılara yapışmayan masaüstü ERP düzeni) */}
          <div className="py-2.5 px-3 bg-light border-bottom">
            <Row className="g-3">
              {/* Sol Sütun: Tarih, Saat, Geliş Nedeni / Satış Dayanağı, Kur Türü */}
              <Col xs={12} md={4}>
                <div
                  className="border rounded-2 bg-white shadow-sm h-100 d-flex flex-column gap-2"
                  style={{
                    borderColor: "#cbd5e1",
                    padding: "14px 18px",
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
                        disabled={isLocked}
                        value={tarih}
                        onChange={(e) => setTarih(e.target.value)}
                        className="font-monospace px-2 py-1"
                        style={{ minWidth: 0, flex: "1 1 auto", height: "30px", fontSize: "12px", borderColor: "#cbd5e1" }}
                      />
                      <Form.Control
                        type="text"
                        size="sm"
                        autoComplete="off"
                        disabled={isLocked}
                        value={saat}
                        onChange={(e) => setSaat(e.target.value)}
                        className="font-monospace text-center px-1 py-1"
                        style={{ minWidth: "68px", width: "68px", flex: "0 0 68px", height: "30px", fontSize: "12px", borderColor: "#cbd5e1" }}
                        title="İşlem Saati (SS:DD)"
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
                        onChange={(e) => handleKurTuruChange(Number(e.target.value))}
                        className="fw-semibold px-2.5 py-1"
                        style={{ minWidth: 0, width: "100%", height: "30px", fontSize: "12.5px", borderColor: "#cbd5e1" }}
                      >
                        <option value={0}>Efektif</option>
                        <option value={1}>Döviz</option>
                      </Form.Select>
                    </div>
                  </div>
                </div>
              </Col>

              {/* Orta Sütun: Seri No, Ünvan, Fiş Tipi */}
              <Col xs={12} md={4}>
                <div
                  className="border rounded-2 bg-white shadow-sm h-100 d-flex flex-column gap-2"
                  style={{
                    borderColor: "#cbd5e1",
                    padding: "14px 18px",
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
                            onClick={openFisSecimModal}
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
                        />
                      )}
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
                          type="text"
                          autoComplete="off"
                          disabled={isLocked}
                          value={unvan}
                          maxLength={100}
                          onChange={(e) => {
                            setUnvan(e.target.value.slice(0, 100));
                            if (cariKartId) setCariKartId(null);
                          }}
                          onBlur={() => {
                            if (!unvan || !unvan.trim()) {
                              setUnvan("İSİM BEYAN EDİLMEMİŞTİR");
                            }
                          }}
                          className="fw-semibold px-2.5 py-1"
                          style={{ minWidth: 0, height: "30px", fontSize: "12.5px", borderColor: "#cbd5e1" }}
                          placeholder="İSİM BEYAN EDİLMEMİŞTİR"
                          title="Ünvan (Elle serbest yazabilir veya boş bırakabilirsiniz - İSİM BEYAN EDİLMEMİŞTİR olarak kaydedilir)"
                        />
                        <Button
                          variant="outline-secondary"
                          className="px-2 py-0 d-flex align-items-center justify-content-center"
                          style={{ height: "30px", borderColor: "#cbd5e1" }}
                          onClick={() => setShowCariModal(true)}
                          title="Cari / Müşteri Seç"
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
                      Fiş tipi
                    </label>
                    <div className="flex-grow-1" style={{ minWidth: 0 }}>
                      <Form.Select
                        size="sm"
                        value={tip}
                        onChange={(e) => handleTipChange(Number(e.target.value))}
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
                  className="border rounded-2 bg-white shadow-sm h-100 d-flex flex-column gap-2"
                  style={{
                    borderColor: "#cbd5e1",
                    padding: "14px 18px",
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
                            onClick={openFisSecimModal}
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
                      <Form.Control
                        type="text"
                        size="sm"
                        autoComplete="off"
                        disabled={isLocked}
                        value={vergiKimlikNo}
                        maxLength={11}
                        onChange={(e) => setVergiKimlikNo(e.target.value.replace(/\D/g, "").slice(0, 11))}
                        placeholder="11 haneli TCKN / 10 haneli VKN"
                        className="font-monospace px-2.5 py-1"
                        style={{ minWidth: 0, width: "100%", height: "30px", fontSize: "12.5px", borderColor: "#cbd5e1" }}
                      />
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
                          type="text"
                          size="sm"
                          autoComplete="off"
                          disabled={isLocked}
                          value={istatistikKodu}
                          maxLength={20}
                          onChange={(e) => setIstatistikKodu(e.target.value.slice(0, 20))}
                          onDoubleClick={() => !isLocked && setShowIstatistikModal(true)}
                          onKeyDown={(e) => {
                            if (e.key === "F3") {
                              e.preventDefault();
                              setShowIstatistikModal(true);
                            }
                          }}
                          className="font-monospace text-center px-2.5 py-1"
                          title="İstatistik Kodu (Çift tıklayarak veya F3 ile seçebilirsiniz)"
                          style={{ minWidth: 0, height: "30px", fontSize: "12.5px", borderColor: "#cbd5e1" }}
                        />
                        <Button
                          variant="outline-secondary"
                          className="px-2 py-0 d-flex align-items-center justify-content-center"
                          style={{ height: "30px", borderColor: "#cbd5e1" }}
                          disabled={isLocked}
                          onClick={() => setShowIstatistikModal(true)}
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

          {/* Döviz Kalemleri Tam Tablo Grid */}
          <div className="px-2.5 py-1.5">

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
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                  Kolonlar
                </Dropdown.Toggle>
                <Dropdown.Menu style={{ minWidth: "170px", fontSize: "13px", padding: "6px 4px" }}>
                  <div className="px-2 pb-1 text-muted" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.5px" }}>GÖRÜNÜRLEBİLİR KOLONLAR</div>
                  {([
                    { key: "komisyonOrani", label: "Komisyon %" },
                    { key: "komisyon",      label: "Komisyon" },
                    { key: "bmvOrani",      label: "BMV %" },
                    { key: "bmv",          label: "BMV" },
                    { key: "kmvOrani",      label: "KMV %" },
                    { key: "kmv",          label: "KMV" },
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
                          <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2.5"><polyline points="1,6 4,9 11,2"/></svg>
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
                    <th style={{ width: "100px", borderRight: "1px solid #cbd5e1" }}>Kod</th>
                    <th style={{ width: "170px", borderRight: "1px solid #cbd5e1" }}>Ad</th>
                    <th style={{ width: "120px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Miktar</th>
                    <th style={{ width: "120px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>
                      {tip === 1 ? "Satış kuru" : "Alış kuru"}
                    </th>
                    {colVisibility.komisyonOrani && <th style={{ width: "55px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>%</th>}
                    {colVisibility.komisyon      && <th style={{ width: "90px", textAlign: "right",  borderRight: "1px solid #cbd5e1" }}>Komisyon</th>}
                    {colVisibility.bmvOrani      && <th style={{ width: "55px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>%</th>}
                    {colVisibility.bmv           && <th style={{ width: "90px", textAlign: "right",  borderRight: "1px solid #cbd5e1" }}>BMV</th>}
                    {colVisibility.kmvOrani      && <th style={{ width: "55px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>%</th>}
                    {colVisibility.kmv           && <th style={{ width: "90px", textAlign: "right",  borderRight: "1px solid #cbd5e1" }}>KMV</th>}
                    <th style={{ width: "110px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Tutar</th>
                    <th style={{ width: "40px", textAlign: "center" }}>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((row, idx) => (
                    <tr
                      key={row.id}
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
                        <div className="d-flex align-items-center w-100 px-1">
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
                            }}
                            onChange={(e) => {
                              const val = e.target.value.toUpperCase();
                              handleLineFieldChange(row.id, "paraKodu", val);
                            }}
                            onKeyDown={(e) => handleCellKeyDown(e, idx, "kod")}
                          />
                          <Button
                            variant="link"
                            className="p-0 px-1 text-secondary text-decoration-none"
                            onClick={() => {
                              setParaModalRowId(row.id);
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
                      <td className="p-0" style={{ borderRight: "1px solid #e2e8f0" }}>
                        <input
                          id={`grid-input-${idx}-miktar`}
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          disabled={isLocked}
                          className="form-control form-control-sm border-0 p-0 px-2 shadow-none font-monospace text-end"
                          style={{ height: "26px", fontSize: "13px", backgroundColor: "transparent" }}
                          value={row.miktar}
                          onFocus={() => setActiveRowIndex(idx)}
                          onChange={(e) => handleLineFieldChange(row.id, "miktar", e.target.value)}
                          onBlur={(e) => {
                            const val = e.target.value.trim();
                            if (val !== "") {
                              const num = parseFloat(val.replace(/,/g, "."));
                              if (!isNaN(num)) {
                                handleLineFieldChange(row.id, "miktar", num.toFixed(dovizKurusSayisi));
                              }
                            }
                          }}
                          onKeyDown={(e) => handleCellKeyDown(e, idx, "miktar")}
                        />
                      </td>

                      {/* Kur */}
                      <td className="p-0" style={{ borderRight: "1px solid #e2e8f0" }}>
                        <input
                          id={`grid-input-${idx}-kur`}
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          disabled={isLocked}
                          className="form-control form-control-sm border-0 p-0 px-2 shadow-none font-monospace text-end"
                          style={{ height: "26px", fontSize: "13px", backgroundColor: "transparent" }}
                          value={row.kur}
                          onFocus={() => setActiveRowIndex(idx)}
                          onChange={(e) => handleLineFieldChange(row.id, "kur", e.target.value)}
                          onBlur={(e) => {
                            const val = e.target.value.trim();
                            if (val !== "") {
                              const num = parseFloat(val.replace(/,/g, "."));
                              if (!isNaN(num)) {
                                handleLineFieldChange(row.id, "kur", num.toFixed(kurKurusSayisi));
                              }
                            }
                          }}
                          onKeyDown={(e) => handleCellKeyDown(e, idx, "kur")}
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
                          onFocus={() => setActiveRowIndex(idx)}
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
                          onFocus={() => setActiveRowIndex(idx)}
                          onChange={(e) => handleLineFieldChange(row.id, "komisyon", e.target.value)}
                          onKeyDown={(e) => handleCellKeyDown(e, idx, "komisyon")}
                        />
                      </td>
                      )}

                      {/* % (BMV %) */}
                      {colVisibility.bmvOrani && (
                      <td className="p-0" style={{ borderRight: "1px solid #e2e8f0" }}>
                        <input
                          id={`grid-input-${idx}-bmvOrani`}
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          disabled={isLocked}
                          className="form-control form-control-sm border-0 p-0 px-1 shadow-none text-center font-monospace"
                          style={{ height: "26px", fontSize: "12px", backgroundColor: "transparent" }}
                          value={row.bmvOrani}
                          onFocus={() => setActiveRowIndex(idx)}
                          onChange={(e) => handleLineFieldChange(row.id, "bmvOrani", e.target.value)}
                          onKeyDown={(e) => handleCellKeyDown(e, idx, "bmvOrani")}
                        />
                      </td>
                      )}

                      {/* BMV */}
                      {colVisibility.bmv && (
                      <td className="p-0" style={{ borderRight: "1px solid #e2e8f0" }}>
                        <input
                          id={`grid-input-${idx}-bmv`}
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          disabled={isLocked}
                          className="form-control form-control-sm border-0 p-0 px-2 shadow-none text-end font-monospace"
                          style={{ height: "26px", fontSize: "12px", backgroundColor: "transparent" }}
                          value={row.bmv}
                          onFocus={() => setActiveRowIndex(idx)}
                          onChange={(e) => handleLineFieldChange(row.id, "bmv", e.target.value)}
                          onKeyDown={(e) => handleCellKeyDown(e, idx, "bmv")}
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
                          onFocus={() => setActiveRowIndex(idx)}
                          onChange={(e) => handleLineFieldChange(row.id, "kmvOrani", e.target.value)}
                          onKeyDown={(e) => handleCellKeyDown(e, idx, "kmvOrani")}
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
                          onFocus={() => setActiveRowIndex(idx)}
                          onChange={(e) => handleLineFieldChange(row.id, "kmv", e.target.value)}
                          onKeyDown={(e) => handleCellKeyDown(e, idx, "kmv")}
                        />
                      </td>
                      )}

                      {/* Tutar */}
                      <td className="p-0 px-2 text-end font-monospace fw-bold text-dark" style={{ borderRight: "1px solid #e2e8f0", fontSize: "13px" }}>
                        {row.tutar
                          ? Number(row.tutar).toLocaleString("tr-TR", { minimumFractionDigits: tlKurusSayisi, maximumFractionDigits: tlKurusSayisi })
                          : ""}
                      </td>

                      {/* İşlem */}
                      <td className="p-0 text-center">
                        <Button
                          variant="link"
                          disabled={isLocked}
                          className="p-0 text-danger"
                          onClick={() => handleRemoveLine(row.id)}
                          title="Satırı Temizle / Sil"
                        >
                          <IconTrash size={14} />
                        </Button>
                      </td>
                    </tr>
                  ))}
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
                  className="p-2 rounded text-center small fw-bold border"
                  style={{ backgroundColor: "#e0f2fe", color: "#0369a1", letterSpacing: "0.5px" }}
                >
                  <span role="button" className="mx-2 hover-underline" onClick={() => setShowIstatistikModal(true)}>F3)İst.</span>
                  <span role="button" className="mx-2 hover-underline" onClick={() => setShowKurListesiModal(true)}>F4)Kur</span>
                  <span role="button" className="mx-2 hover-underline" onClick={() => { fetchVezneBalances(vezneId); setShowVezneBakiyeModal(true); }}>F5)Vezne</span>
                  <span role="button" className="mx-2 hover-underline" onClick={() => setShowTlHesabiModal(true)}>F6)TL Hesabı</span>
                  <span role="button" className="mx-2 hover-underline">F7)Arbitraj</span>
                  <span role="button" className="mx-2 hover-underline text-primary" onClick={() => setShowDetayModal(true)}>
                    F8)Detay
                  </span>
                  <span role="button" className="mx-2 hover-underline" onClick={handleOpenBanknotSay}>F9)Banknot Say</span>
                  <span role="button" className="mx-2 hover-underline">F10)Kes</span>
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
          </div>
        </Card.Body>
      </Card>

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
                if (!unvan || !unvan.trim()) {
                  setUnvan("İSİM BEYAN EDİLMEMİŞTİR");
                }
              }}
              placeholder="İSİM BEYAN EDİLMEMİŞTİR"
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
                    title="Ülke Seçimi (TODVZ_ULKE) (F4)"
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
                    title="Uyruk Seçimi (TODVZ_TABLO_MADDESI) (F4)"
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
                    placeholder="11 haneli TCKN / 10 haneli VKN"
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
                    title="Vergi Dairesi Seçimi (TODVZ_VERGI_DAIRESI) (F4)"
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
                    maxLength={10}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 10);
                      setDetayPostaKodu(v);
                      if (!v) {
                        setDetayPostaKoduId(undefined);
                      } else {
                        const pList = (lookupData.postaKoduList && lookupData.postaKoduList.length > 0) ? lookupData.postaKoduList : DEFAULT_POSTA_KODLARI;
                        const matchPk = pList.find((p) => String(p.kod).trim() === v.trim() || String(p.id) === v.trim());
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
                  />
                  <Button
                    variant="outline-secondary"
                    title="Posta Kodu Seçimi (TODVZ_POSTA_KODU) (F4)"
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
                    title="İlçe Seçimi (TODVZ_ILCE) (F4)"
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
                    title="İl Seçimi (TODVZ_IL) (F4)"
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
                    title="Meslek Seçimi (TODVZ_MESLEK) (F4)"
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
                    title="Banka Hesabı Seçimi (TODVZ_BANKA_HESABI) (F4)"
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
        onClose={() => setShowCariModal(false)}
        cariler={cariList}
        kayitsizMusteriler={kayitsizMusteriList}
        onSelectCustomer={handleSelectCustomer}
        currentUnvan={unvan}
      />

      {/* Para / Currency Lookup Modal */}
      <LookupModal<ParaItem>
        show={showParaModal}
        onHide={() => {
          setShowParaModal(false);
          setParaModalRowId(null);
        }}
        title="Para / Maden Seçimi"
        items={paraList}
        columns={paraColumns}
        filterFn={(item, term) => {
          const t = term.toLowerCase();
          return (
            item.kod.toLowerCase().includes(t) ||
            item.ad.toLowerCase().includes(t)
          );
        }}
        onSelect={(item) => {
          if (paraModalRowId) {
            handleSelectCurrency(paraModalRowId, item);
          }
          setShowParaModal(false);
          setParaModalRowId(null);
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
            ? "Ülke Seçimi (TODVZ_ULKE)"
            : activeLookupType === "uyruk"
            ? "Uyruk Seçimi (TODVZ_TABLO_MADDESI)"
            : activeLookupType === "hukukiYapi"
            ? "Hukuki Yapı Seçimi (TODVZ_TABLO_MADDESI)"
            : activeLookupType === "yetkiliKisi"
            ? "Yetkili Kişi Seçimi"
            : activeLookupType === "il"
            ? "İl Seçimi (TODVZ_IL)"
            : activeLookupType === "ilce"
            ? "İlçe Seçimi (TODVZ_ILCE)"
            : activeLookupType === "postaKodu"
            ? "Posta Kodu Seçimi (TODVZ_POSTA_KODU)"
            : activeLookupType === "vergiDairesi"
            ? "Vergi Dairesi Seçimi (TODVZ_VERGI_DAIRESI)"
            : activeLookupType === "meslek"
            ? "Meslek Seçimi (TODVZ_MESLEK)"
            : "Banka Hesabı Seçimi (TODVZ_BANKA_HESABI)"
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
        onHide={() => setShowPrintModal(false)}
        fisId={fisId}
        tip={tip}
        tarih={tarih}
        saat={saat}
        seriNo={seriNo}
        belgeNo={belgeNo}
        unvan={unvan}
        vergiKimlikNo={vergiKimlikNo}
        detayIl={detayIl}
        detayIlce={detayIlce}
        detayUyruk={detayUyruk}
        detayPasaportNo={detayPasaportNo}
        detayMeslek={detayMeslek}
        detayCariTipi={detayCariTipi}
        vezneKod={vezneKod}
        istatistikKodu={istatistikKodu}
        lines={lines.map((l) => ({
          paraKodu: l.paraKodu,
          paraAdi: l.paraAdi,
          miktar: l.miktar,
          kur: l.kur,
          tutar: l.tutar,
          bmv: l.bmv,
          komisyon: l.komisyon,
        }))}
        toplamTutar={totalTutar}
        odemeTutari={sonToplam}
        bsmvTutari={calculatedBsmv}
        komisyonTutari={totalKomisyon}
        giseUsdKuru={(() => {
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
        onClose={() => setShowIstatistikModal(false)}
        tip={tip}
        onSelect={handleSelectIstatistik}
        currentKod={istatistikKodu}
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
    </div>
  );
};

export default DovizFisiPage;
