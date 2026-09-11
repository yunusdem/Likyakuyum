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
import { CariService, CariKartItem } from "../../services/cariService";
import { apiClient } from "../../services/apiClient";
import { KurService, KurRowItem } from "../../services/kurService";
import { StatisticService, StatisticItem } from "../../services/statisticService";
import {
  DovizFisService,
  DovizFisModel,
  DovizFisListItem,
  SaveDovizFisPayload,
} from "../../services/dovizFisService";
import { useAuth } from "../../context/AuthContext";

interface VezneItem {
  id: number;
  kod: string;
  ad: string;
}

interface ParaItem {
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

  // Modals
  const [showSearchModal, setShowSearchModal] = useState<boolean>(false);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
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
  const [tip, setTip] = useState<number>(1); // 1: Satış, 0: Alış
  const [tarih, setTarih] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [saat, setSaat] = useState<string>(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  });

  // Empty inputs by default
  const [seriNo, setSeriNo] = useState<string>("");
  const [belgeNo, setBelgeNo] = useState<string>("");
  const [unvan, setUnvan] = useState<string>("");
  const [cariKartId, setCariKartId] = useState<number | null>(null);
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

  // Autocomplete state for currency in line item
  const [activeSuggestRowId, setActiveSuggestRowId] = useState<string | null>(null);
  const [suggestSearch, setSuggestSearch] = useState<string>("");
  const [suggestHighlightIdx, setSuggestHighlightIdx] = useState<number>(0);

  // Drag & drop state for row reordering
  const [draggedRowIndex, setDraggedRowIndex] = useState<number | null>(null);
  const [dragOverRowIndex, setDragOverRowIndex] = useState<number | null>(null);

  // Dynamic Vezne Balances fetched from backend
  const [topBalances, setTopBalances] = useState<{ tl: number; usd: number; eur: number }>({
    tl: 0,
    usd: 0,
    eur: 0,
  });

  // Fetch dynamic balances for current vezne
  const fetchVezneBalances = useCallback(async (vId: number) => {
    try {
      const bakiye = await DovizFisService.getVezneBakiye(vId);
      setTopBalances(bakiye);
    } catch (e) {
      console.error("Vezne bakiye getirme hatası:", e);
    }
  }, []);

  // Close suggestion dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest(".suggest-dropdown-container")) {
        setActiveSuggestRowId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
    setUnvan("");
    setCariKartId(null);
    setVergiKimlikNo("");
    setGelisNedeni("");
    setKurTuru(0);
    setIstatistikId(null);
    setIstatistikKodu("");
    setDetayUlke("");
    setDetayUlkeId(null);
    setDetayUyruk("");
    setDetayUyrukId(null);
    setDetayHukukiYapi("");
    setDetayHukukiYapiId(null);
    setDetayYetkiliKisi("");
    setDetayYetkiliKisiId(null);
    setDetayKimlikKaynagi("");
    setDetayDernekAmaci("");
    setDetaySirketTuru("");
    setDetayPasaportNo("");
    setDetayGecerlilikTarihi("");
    setDetayDogumTarihi("");
    setDetayDogumYeri("");
    setDetayKimlikSeriNo("");
    setDetayBabaAdi("");
    setDetayAnneAdi("");
    setDetayAdres("");
    setDetayPostaKodu("");
    setDetayPostaKoduId(null);
    setDetayIlce("");
    setDetayIlceId(null);
    setDetayIl("");
    setDetayIlId(null);
    setDetayEposta("");
    setDetayTelefon("");
    setDetayVekilAdi("");
    setDetayVekilKimlikNo("");
    setDetayMeslek("");
    setDetayMeslekId(null);
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
    setCurrentIndex(-1);
  }, [tip]);

  // Load Lookups
  const loadLookupsAndList = useCallback(async () => {
    setIsLoadingLookups(true);
    try {
      const [cariler, vezneler, paralar, kurTabloRes, istatistikler, fisler, cariLk] = await Promise.all([
        CariService.getCariKartlar().catch(() => [] as CariKartItem[]),
        apiClient.get<VezneItem[]>("/vezne").then((r) => r.data || []).catch(() => [] as VezneItem[]),
        apiClient.get<ParaItem[]>("/para").then((r) => r.data || []).catch(() => [] as ParaItem[]),
        KurService.getKurTablosu({ tur: 0 }).catch(() => null),
        StatisticService.getStatistics().catch(() => [] as StatisticItem[]),
        DovizFisService.getFisList({ limit: 100 }).catch(() => [] as DovizFisListItem[]),
        CariService.getLookups().catch(() => null),
      ]);

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

      const kurSatirlari = kurTabloRes?.satirlar || [];
      setKurSatirlar(kurSatirlari);

      const combinedParalar: ParaItem[] = [];
      const codeSet = new Set<string>();

      paralar.forEach((p) => {
        const cCode = (p.kod || "").toUpperCase().trim();
        const kurMatch = kurSatirlari.find((k) => (k.kod || "").toUpperCase().trim() === cCode);
        combinedParalar.push({
          id: p.id,
          kod: cCode,
          ad: p.ad || cCode,
          parite: kurMatch?.parite || p.parite || 1,
          dovizAlis: kurMatch?.dovizAlis ?? undefined,
          dovizSatis: kurMatch?.dovizSatis ?? undefined,
          efektifAlis: kurMatch?.efektifAlis ?? undefined,
          efektifSatis: kurMatch?.efektifSatis ?? undefined,
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
            parite: k.parite || 1,
            dovizAlis: k.dovizAlis ?? undefined,
            dovizSatis: k.dovizSatis ?? undefined,
            efektifAlis: k.efektifAlis ?? undefined,
            efektifSatis: k.efektifSatis ?? undefined,
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
        } else if (fisler.length > 0) {
          await loadFisById(fisler[0].fisId);
          setCurrentIndex(0);
        }
      } else {
        resetForm();
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

      const isGibLocked = (fis as any).eBelgeDurumu === 1 || (fis as any).E_BELGE_DURUMU === 1;
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
      setUnvan(fis.unvan || "");
      setCariKartId(fis.cariKartId);
      setVergiKimlikNo(fis.vergiKimlikNo || "");
      setGelisNedeni(fis.gelisNedeni || "32 SAYILI KARAR GEREĞİ");
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

      if (fis.satirlar && fis.satirlar.length > 0) {
        setLines(
          fis.satirlar.map((s, idx) => ({
            id: `row-${idx}-${Date.now()}`,
            satirNo: s.satirNo || idx + 1,
            paraId: s.paraId,
            paraKodu: s.paraKodu || "",
            paraAdi: s.paraAdi || "",
            miktar: s.miktar || "",
            kur: s.kur ? Number(s.kur).toFixed(4) : "",
            komisyonOrani: s.komisyonOrani || "",
            komisyon: s.komisyon || "",
            bmvOrani: s.bmvOrani || (fis.tip === 1 ? "0.2" : ""),
            bmv: s.bmv || "",
            kmvOrani: s.kmvOrani || "",
            kmv: s.kmv || "",
            tutar: s.tutar || "",
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

  const resolveCurrencyRate = useCallback(
    (para: ParaItem, currentTip: number, currentKurTuru: number): number => {
      if (currentKurTuru === 0) {
        return currentTip === 1
          ? (para.efektifSatis || para.dovizSatis || para.parite || 1)
          : (para.efektifAlis || para.dovizAlis || para.parite || 1);
      } else {
        return currentTip === 1
          ? (para.dovizSatis || para.efektifSatis || para.parite || 1)
          : (para.dovizAlis || para.efektifAlis || para.parite || 1);
      }
    },
    []
  );

  const calculateRowTutar = (miktar: number | string, kur: number | string): number => {
    const m = typeof miktar === "number" ? miktar : parseFloat(String(miktar).replace(/,/g, ".")) || 0;
    const k = typeof kur === "number" ? kur : parseFloat(String(kur).replace(/,/g, ".")) || 0;
    return Math.round(m * k * 100) / 100;
  };

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

        const m = field === "miktar" ? value : updated.miktar;
        const k = field === "kur" ? value : updated.kur;
        const tutar = calculateRowTutar(m, k);
        updated.tutar = tutar > 0 ? tutar : "";

        // 1. Komisyon % ve Komisyon Tutarı (Tutar * %Komisyon)
        const komRate = parseFloat(String(updated.komisyonOrani || "0").replace(/,/g, ".")) || 0;
        if (field === "komisyon") {
          updated.komisyon = value;
        } else if (komRate > 0 && tutar > 0) {
          updated.komisyon = (Math.round(tutar * (komRate / 100) * 100) / 100).toFixed(2);
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
            updated.bmv = (Math.round(tutar * (bmvRate / 100) * 100) / 100).toFixed(2);
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
            updated.kmv = (Math.round(tutar * (kmvRate / 100) * 100) / 100).toFixed(2);
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
        const bmvOrani = tip === 1 ? "0.2" : "0";
        const bmvVal = tip === 1 && tutar > 0 ? (Math.round(tutar * 0.002 * 100) / 100).toFixed(2) : "";
        const komRate = parseFloat(String(row.komisyonOrani || "0").replace(/,/g, ".")) || 0;
        const komVal = komRate > 0 && tutar > 0 ? (Math.round(tutar * (komRate / 100) * 100) / 100).toFixed(2) : row.komisyon;
        return {
          ...row,
          paraId: para.id,
          paraKodu: para.kod,
          paraAdi: para.ad,
          kur: autoKur.toFixed(4),
          tutar: tutar > 0 ? tutar : "",
          bmvOrani,
          bmv: bmvVal,
          komisyon: komVal,
        };
      })
    );
    setActiveSuggestRowId(null);
    setSuggestSearch("");

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

  const filteredSuggestions = useMemo(() => {
    const term = suggestSearch.trim().toLowerCase();
    if (!term) return [];
    return paraList.filter(
      (p) => p.kod.toLowerCase().includes(term) || p.ad.toLowerCase().includes(term)
    );
  }, [paraList, suggestSearch]);

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
    return Math.round((calculatedBsmv + totalKomisyon) * 100) / 100;
  }, [calculatedBsmv, totalKomisyon]);

  // Son Toplam / Alışta: (Toplam Tutar - Masraflar), Satışta: (Toplam Tutar + Toplam BMV)
  const sonToplam = useMemo(() => {
    if (tip === 1) {
      return Math.round((totalTutar + calculatedBsmv) * 100) / 100;
    } else {
      return Math.round((totalTutar - totalMasraf) * 100) / 100;
    }
  }, [totalTutar, calculatedBsmv, totalMasraf, tip]);

  const handleTipChange = (newTip: number) => {
    if (isLocked) return;
    setTip(newTip);
    setLines((prev) =>
      prev.map((row) => {
        let rate = parseFloat(String(row.kur).replace(/,/g, ".")) || 0;
        if (row.paraId) {
          const found = paraList.find((p) => p.id === row.paraId || p.kod === row.paraKodu);
          if (found) {
            rate = resolveCurrencyRate(found, newTip, kurTuru);
          }
        }
        const m = parseFloat(String(row.miktar).replace(/,/g, ".")) || 0;
        const tutar = calculateRowTutar(m, rate);
        const bmvOrani = newTip === 1 ? (row.paraId || row.miktar ? "0.2" : "") : "0";
        const bmv = newTip === 1 && tutar > 0 ? (Math.round(tutar * 0.002 * 100) / 100).toFixed(2) : "";
        return {
          ...row,
          kur: rate > 0 ? rate.toFixed(4) : row.kur,
          tutar: tutar > 0 ? tutar : "",
          bmvOrani,
          bmv,
        };
      })
    );
  };

  const handleKurTuruChange = (newKurTuru: number) => {
    if (isLocked) return;
    setKurTuru(newKurTuru);
    setLines((prev) =>
      prev.map((row) => {
        if (!row.paraId) return row;
        const found = paraList.find((p) => p.id === row.paraId || p.kod === row.paraKodu);
        if (!found) return row;
        const newRate = resolveCurrencyRate(found, tip, newKurTuru);
        const m = typeof row.miktar === "number" ? row.miktar : parseFloat(String(row.miktar)) || 0;
        const tutar = calculateRowTutar(m, newRate);
        return {
          ...row,
          kur: newRate.toFixed(4),
          tutar: tutar > 0 ? tutar : "",
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
      } else if (attempts < 15) {
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
    const el = e.currentTarget;
    const maxRow = lines.length - 1;
    const colIdx = GRID_COLUMNS.indexOf(field);

    // Autocomplete dropdown navigation (only on kod column)
    if (field === "kod" && activeSuggestRowId === lines[rowIndex]?.id && filteredSuggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSuggestHighlightIdx((prev) => (prev + 1) % filteredSuggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSuggestHighlightIdx((prev) => (prev - 1 + filteredSuggestions.length) % filteredSuggestions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const sel = filteredSuggestions[suggestHighlightIdx] || filteredSuggestions[0];
        if (sel) handleSelectCurrency(lines[rowIndex].id, sel);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setActiveSuggestRowId(null);
        return;
      }
    }

    // 1. Enter Tuşu: Bir sonraki alana geçiş, son sütun (kmv)'da ise altta YENİ SATIR açıp kod alanına geçiş
    if (e.key === "Enter") {
      e.preventDefault();
      if (field === "kod") {
        if (activeSuggestRowId === lines[rowIndex]?.id && filteredSuggestions.length > 0) {
          const sel = filteredSuggestions[suggestHighlightIdx] || filteredSuggestions[0];
          if (sel) {
            handleSelectCurrency(lines[rowIndex].id, sel);
            return;
          }
        }
      }

      if (field === "kmv") {
        // kmv de iken Enter'a basınca KESİNLİKLE altta YENİ SATIR açılacak ve yeni satırın kod alanına geçecek
        const nextIdx = lines.length;
        handleAddRow();
        setActiveRowIndex(nextIdx);
        focusCell(nextIdx, "kod", "select");
        return;
      } else {
        // Sıradaki sütuna geç
        const nextCol = GRID_COLUMNS[colIdx + 1];
        if (nextCol) {
          focusCell(rowIndex, nextCol, "select");
        }
        return;
      }
    }

    // 2. Sağ Yön Oku: Yazı varsa sonuna kadar ilerler, sonundaysa bir sonraki sütuna / satıra kayar
    if (e.key === "ArrowRight") {
      const len = el.value ? el.value.length : 0;
      const isAtEnd = el.selectionStart === len && el.selectionEnd === len;
      if (!isAtEnd) {
        // Yazı içinde ilerlemesine izin ver (tarayıcı varsayılanı)
        return;
      }

      // İmleç yazının tam sonunda: Bir sonraki sütuna / satıra geç
      e.preventDefault();
      if (colIdx < GRID_COLUMNS.length - 1) {
        const nextCol = GRID_COLUMNS[colIdx + 1];
        focusCell(rowIndex, nextCol, "start");
        return;
      } else {
        // Satırın en son sütunundayken (kmv) sağa basınca bir sonraki satıra geçsin (yoksa yeni satır açsın)
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
        // Yazı içinde gerilemesine izin ver (tarayıcı varsayılanı)
        return;
      }

      // İmleç yazının tam başında: Bir önceki sütuna / satıra geç
      e.preventDefault();
      if (colIdx > 0) {
        const prevCol = GRID_COLUMNS[colIdx - 1];
        focusCell(rowIndex, prevCol, "end");
        return;
      } else {
        // İlk sütunda (kod) sola basınca bir önceki satırın en son sütununa (kmv) geçsin
        if (rowIndex > 0) {
          const prevIdx = rowIndex - 1;
          setActiveRowIndex(prevIdx);
          focusCell(prevIdx, "kmv", "end");
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
      setNotification({
        type: "info",
        message: "Yeni döviz fişi formu temizlendi.",
      });
    }
  };

  const handleToolbarSave = async () => {
    if (isLocked) {
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

    const activeVezneId = (vezneId && Number(vezneId) > 0) ? Number(vezneId) : 1;

    // 2. Line validations
    const hasAnyInput = lines.some(
      (r) =>
        r.paraKodu.trim() !== "" ||
        r.paraAdi.trim() !== "" ||
        (typeof r.miktar === "number" ? r.miktar > 0 : (parseFloat(String(r.miktar).replace(/,/g, ".")) || 0) > 0)
    );

    if (!hasAnyInput) {
      setNotification({
        type: "warning",
        message: "Kaydedilecek döviz satırı bulunamadı. Lütfen en az bir satıra Döviz Cinsi, Miktar ve Kur giriniz.",
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

    const validLines = lines.filter((row) => {
      const m = typeof row.miktar === "number" ? row.miktar : parseFloat(String(row.miktar).replace(/,/g, ".")) || 0;
      const k = typeof row.kur === "number" ? row.kur : parseFloat(String(row.kur).replace(/,/g, ".")) || 0;
      return (row.paraId > 0 || row.paraKodu.trim() !== "") && m > 0 && k > 0;
    });

    if (validLines.length === 0) {
      setNotification({
        type: "warning",
        message: "Lütfen en az bir geçerli döviz kalemi (Döviz Cinsi, Miktar ve Kur) giriniz.",
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
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
        unvan: unvan.trim() || undefined,
        kisilikTipi: detayCariTipi === "Firma" ? 2 : 1,
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
      setFisId(saved.fisId);
      setIsGonderildi(true);
      if (saved.seriNo) setSeriNo(saved.seriNo);
      if (saved.belgeNo) setBelgeNo(saved.belgeNo);

      setNotification({
        type: "success",
        message: `Döviz Fişi (${saved.seriNo || saved.belgeNo || saved.fisId}) GÖNDERİLDİ / Başarıyla Kaydedildi.`,
      });
      window.scrollTo({ top: 0, behavior: "smooth" });

      await fetchVezneBalances(vezneId);
      const freshList = await DovizFisService.getFisList({ limit: 100 });
      setSavedFisList(freshList);
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

  // Keyboard shortcut listener (F1..F9)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F1") {
        e.preventDefault();
        handleToolbarSave();
      } else if (e.key === "F2") {
        e.preventDefault();
        handleToolbarDelete();
      } else if (e.key === "F4") {
        e.preventDefault();
        openFisSecimModal();
      } else if (e.key === "F5") {
        e.preventDefault();
        setShowVezneModal(true);
      } else if (e.key === "F8") {
        e.preventDefault();
        setShowDetayModal(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

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
      header: "Kur",
      align: "right",
      width: "110px",
      render: (p) => resolveCurrencyRate(p, tip, kurTuru).toFixed(4),
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
        onNew={handleToolbarNew}
        onSave={handleToolbarSave}
        onSearch={openFisSecimModal}
        onDelete={handleToolbarDelete}
        onFirst={handleFirst}
        onPrev={handlePrev}
        onNext={handleNext}
        onLast={handleLast}
        onPrint={() => setShowPrintModal(true)}
        onRefresh={loadLookupsAndList}
        rightContent={
          <div className="d-flex align-items-center gap-3 px-3 py-1 bg-white rounded border shadow-2xs small">
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
        }
      />

      {/* GİB Kilit Uyarısı */}
      {isLocked && (
        <Alert variant="warning" className="d-flex align-items-center gap-2 my-2 py-2 px-3 shadow-2xs">
          <IconLock size={18} className="text-danger" />
          <span className="fw-bold">GİB'e gönderilen fişler değiştirilemez. (Salt Okunur)</span>
        </Alert>
      )}

      {/* Notifications Alert */}
      {notification && (
        <Alert
          variant={notification.type}
          dismissible
          onClose={() => setNotification(null)}
          className="my-2 py-2 px-3 shadow-2xs d-flex align-items-center justify-content-between"
        >
          <span>{notification.message}</span>
        </Alert>
      )}

      {/* Ana Form Kartı */}
      <Card className="border-0 shadow-sm rounded-3 overflow-hidden">
        <Card.Body className="p-0">
          {/* Fiş Başlık Şeridi */}
          <div
            className="py-2 px-3 text-center text-white fw-bold"
            style={{
              backgroundColor: tip === 1 ? "#16a34a" : "#b91c1c",
              letterSpacing: "1px",
              fontSize: "1.15rem",
            }}
          >
            {tip === 1
              ? (isGonderildi ? "SATIŞ FİŞİ - GÖNDERİLDİ" : "SATIŞ FİŞİ")
              : (isGonderildi ? "ALIŞ FİŞİ - GÖNDERİLDİ" : "ALIŞ FİŞİ")}
          </div>

          {/* En Üstteki 3 Alan (Geniş kenarlıklı ve rahat boşluklu kartlar) */}
          <div className="p-3 px-4 bg-light border-bottom">
            <Row className="g-3">
              {/* Sol Sütun: Tarih, Saat, Geliş Nedeni / Satış Dayanağı, Kur Türü */}
              <Col xs={12} md={4}>
                <div
                  className="p-3 border rounded-3 bg-white shadow-xs h-100 d-flex flex-column justify-content-between"
                  style={{ borderColor: "#cbd5e1", minHeight: "210px" }}
                >
                  <div className="d-flex flex-row align-items-center gap-2 mb-2.5">
                    <label
                      className="small fw-semibold mb-0 text-secondary text-nowrap"
                      style={{ minWidth: "100px", width: "100px", flexShrink: 0, fontSize: "12.5px" }}
                    >
                      Tarih
                    </label>
                    <div className="flex-grow-1" style={{ minWidth: 0 }}>
                      <Form.Control
                        type="date"
                        size="sm"
                        disabled={isLocked}
                        value={tarih}
                        onChange={(e) => setTarih(e.target.value)}
                        className="font-monospace"
                        style={{ minWidth: 0, width: "100%", padding: "0.25rem 0.4rem" }}
                      />
                    </div>
                  </div>

                  <div className="d-flex flex-row align-items-center gap-2 mb-2.5">
                    <label
                      className="small fw-semibold mb-0 text-secondary text-nowrap"
                      style={{ minWidth: "100px", width: "100px", flexShrink: 0, fontSize: "12.5px" }}
                    >
                      Saat
                    </label>
                    <div className="flex-grow-1" style={{ minWidth: 0 }}>
                      <Form.Control
                        type="text"
                        size="sm"
                        disabled={isLocked}
                        value={saat}
                        onChange={(e) => setSaat(e.target.value)}
                        className="font-monospace"
                        style={{ minWidth: 0, width: "100%" }}
                      />
                    </div>
                  </div>

                  <div className="d-flex flex-row align-items-center gap-2 mb-2.5">
                    <label
                      className="small fw-semibold mb-0 text-secondary text-nowrap"
                      style={{ minWidth: "100px", width: "100px", flexShrink: 0, fontSize: "12px" }}
                      title={tip === 1 ? "Satışın dayanağı" : "Geliş nedeni"}
                    >
                      {tip === 1 ? "Satış dayanağı" : "Geliş nedeni"}
                    </label>
                    <div className="flex-grow-1" style={{ minWidth: 0 }}>
                      <Form.Control
                        type="text"
                        size="sm"
                        disabled={isLocked}
                        value={gelisNedeni}
                        maxLength={100}
                        onChange={(e) => setGelisNedeni(e.target.value.slice(0, 100))}
                        style={{ minWidth: 0, width: "100%" }}
                      />
                    </div>
                  </div>

                  <div className="d-flex flex-row align-items-center gap-2">
                    <label
                      className="small fw-semibold mb-0 text-secondary text-nowrap"
                      style={{ minWidth: "100px", width: "100px", flexShrink: 0, fontSize: "12.5px" }}
                    >
                      Kur türü
                    </label>
                    <div className="flex-grow-1" style={{ minWidth: 0 }}>
                      <Form.Select
                        size="sm"
                        disabled={isLocked}
                        value={kurTuru}
                        onChange={(e) => handleKurTuruChange(Number(e.target.value))}
                        className="fw-semibold"
                        style={{ minWidth: 0, width: "100%" }}
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
                  className="p-3 border rounded-3 bg-white shadow-xs h-100 d-flex flex-column justify-content-between"
                  style={{ borderColor: "#cbd5e1", minHeight: "210px" }}
                >
                  <div className="d-flex flex-row align-items-center gap-2 mb-2.5">
                    <label
                      className="small fw-semibold mb-0 text-secondary text-nowrap"
                      style={{ minWidth: "80px", width: "80px", flexShrink: 0, fontSize: "12.5px" }}
                    >
                      Seri no
                    </label>
                    <div className="flex-grow-1" style={{ minWidth: 0 }}>
                      {isDuzeltmeMode ? (
                        <InputGroup size="sm">
                          <Form.Control
                            type="text"
                            disabled={isLocked}
                            value={seriNo}
                            maxLength={20}
                            onChange={(e) => setSeriNo(e.target.value.slice(0, 20))}
                            className="font-monospace fw-bold"
                            style={{ minWidth: 0 }}
                          />
                          <Button
                            variant="outline-secondary"
                            className="px-2"
                            onClick={openFisSecimModal}
                            title="Seri No ile Fiş Ara / Seç"
                          >
                            <IconBinoculars size={15} />
                          </Button>
                        </InputGroup>
                      ) : (
                        <Form.Control
                          type="text"
                          size="sm"
                          disabled={isLocked}
                          value={seriNo}
                          maxLength={20}
                          onChange={(e) => setSeriNo(e.target.value.slice(0, 20))}
                          className="font-monospace fw-bold"
                          style={{ minWidth: 0, width: "100%" }}
                        />
                      )}
                    </div>
                  </div>

                  <div className="d-flex flex-row align-items-center gap-2 mb-2.5">
                    <label
                      className="small fw-semibold mb-0 text-secondary text-nowrap"
                      style={{ minWidth: "80px", width: "80px", flexShrink: 0, fontSize: "12.5px" }}
                    >
                      Ünvan
                    </label>
                    <div className="flex-grow-1" style={{ minWidth: 0 }}>
                      <InputGroup size="sm">
                        <Form.Control
                          type="text"
                          disabled={isLocked}
                          value={unvan}
                          maxLength={100}
                          onChange={(e) => setUnvan(e.target.value.slice(0, 100))}
                          className="fw-semibold"
                          style={{ minWidth: 0 }}
                        />
                        <Button
                          variant="outline-secondary"
                          className="px-2"
                          onClick={() => setShowCariModal(true)}
                          title="Cari Seç"
                        >
                          <IconBinoculars size={15} />
                        </Button>
                      </InputGroup>
                    </div>
                  </div>

                  <div className="d-flex flex-row align-items-center gap-2">
                    <label
                      className="small fw-semibold mb-0 text-secondary text-nowrap"
                      style={{ minWidth: "80px", width: "80px", flexShrink: 0, fontSize: "12.5px" }}
                    >
                      Fiş tipi
                    </label>
                    <div className="flex-grow-1" style={{ minWidth: 0 }}>
                      <Form.Select
                        size="sm"
                        disabled={isLocked}
                        value={tip}
                        onChange={(e) => handleTipChange(Number(e.target.value))}
                        className="fw-bold text-uppercase"
                        style={{ minWidth: 0, width: "100%" }}
                      >
                        <option value={1}>SATIŞ</option>
                        <option value={0}>ALIŞ</option>
                      </Form.Select>
                    </div>
                  </div>
                </div>
              </Col>

              {/* Sağ Sütun: Belge No, VKN/TCKN, İstatistik Kodu */}
              <Col xs={12} md={4}>
                <div
                  className="p-3 border rounded-3 bg-white shadow-xs h-100 d-flex flex-column justify-content-between"
                  style={{ borderColor: "#cbd5e1", minHeight: "210px" }}
                >
                  <div className="d-flex flex-row align-items-center gap-2 mb-2.5">
                    <label
                      className="small fw-semibold mb-0 text-secondary text-nowrap"
                      style={{ minWidth: "95px", width: "95px", flexShrink: 0, fontSize: "12.5px" }}
                    >
                      Belge no
                    </label>
                    <div className="flex-grow-1" style={{ minWidth: 0 }}>
                      {isDuzeltmeMode ? (
                        <InputGroup size="sm">
                          <Form.Control
                            type="text"
                            disabled={isLocked}
                            value={belgeNo}
                            maxLength={30}
                            onChange={(e) => setBelgeNo(e.target.value.slice(0, 30))}
                            className="font-monospace fw-bold"
                            style={{ minWidth: 0 }}
                          />
                          <Button
                            variant="outline-secondary"
                            className="px-2"
                            onClick={openFisSecimModal}
                            title="Belge No ile Fiş Ara / Seç"
                          >
                            <IconBinoculars size={15} />
                          </Button>
                        </InputGroup>
                      ) : (
                        <Form.Control
                          type="text"
                          size="sm"
                          disabled={isLocked}
                          value={belgeNo}
                          maxLength={30}
                          onChange={(e) => setBelgeNo(e.target.value.slice(0, 30))}
                          className="font-monospace fw-bold"
                          style={{ minWidth: 0, width: "100%" }}
                        />
                      )}
                    </div>
                  </div>

                  <div className="d-flex flex-row align-items-center gap-2 mb-2.5">
                    <label
                      className="small fw-semibold mb-0 text-secondary text-nowrap"
                      style={{ minWidth: "95px", width: "95px", flexShrink: 0, fontSize: "12.5px" }}
                    >
                      VKN / TCKN
                    </label>
                    <div className="flex-grow-1" style={{ minWidth: 0 }}>
                      <Form.Control
                        type="text"
                        size="sm"
                        disabled={isLocked}
                        value={vergiKimlikNo}
                        maxLength={11}
                        onChange={(e) => setVergiKimlikNo(e.target.value.replace(/\D/g, "").slice(0, 11))}
                        placeholder="11 haneli TCKN / 10 haneli VKN"
                        className="font-monospace"
                        style={{ minWidth: 0, width: "100%" }}
                      />
                    </div>
                  </div>

                  <div className="d-flex flex-row align-items-center gap-2">
                    <label
                      className="small fw-semibold mb-0 text-secondary text-nowrap"
                      style={{ minWidth: "95px", width: "95px", flexShrink: 0, fontSize: "12.5px" }}
                    >
                      İstatistik kodu
                    </label>
                    <div className="flex-grow-1" style={{ minWidth: 0 }}>
                      <Form.Control
                        type="text"
                        size="sm"
                        disabled={isLocked}
                        value={istatistikKodu}
                        maxLength={20}
                        onChange={(e) => setIstatistikKodu(e.target.value.slice(0, 20))}
                        className="font-monospace text-center"
                        title="İstatistik Kodu"
                        style={{ minWidth: 0, width: "100%" }}
                      />
                    </div>
                  </div>
                </div>
              </Col>
            </Row>
          </div>

          {/* Döviz Kalemleri Tam Tablo Grid (Masaüstü Ekran Görüntüsü Birebir Kolonları) */}
          <div className="p-3">
            <div className="table-responsive border rounded bg-white" style={{ minHeight: "220px" }}>
              <Table size="sm" className="mb-0 align-middle" style={{ borderCollapse: "collapse" }}>
                <thead style={{ backgroundColor: "#dbeafe", color: "#1e293b" }}>
                  <tr style={{ borderBottom: "1px solid #94a3b8", fontSize: "12.5px" }}>
                    <th style={{ width: "45px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>#</th>
                    <th style={{ width: "100px", borderRight: "1px solid #cbd5e1" }}>Kod</th>
                    <th style={{ width: "170px", borderRight: "1px solid #cbd5e1" }}>Ad</th>
                    <th style={{ width: "120px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Miktar</th>
                    <th style={{ width: "120px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>
                      {tip === 1 ? "Satış kuru" : "Alış kuru"}
                    </th>
                    <th style={{ width: "55px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>%</th>
                    <th style={{ width: "90px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Komisyon</th>
                    <th style={{ width: "55px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>%</th>
                    <th style={{ width: "90px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>BMV</th>
                    <th style={{ width: "55px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>%</th>
                    <th style={{ width: "90px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>KMV</th>
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

                      {/* Kod with Oklu Dürbün & Autocomplete Popup */}
                      <td className="p-0 position-relative suggest-dropdown-container" style={{ borderRight: "1px solid #e2e8f0" }}>
                        <div className="d-flex align-items-center w-100 px-1">
                          <input
                            id={`grid-input-${idx}-kod`}
                            type="text"
                            disabled={isLocked}
                            className="form-control form-control-sm border-0 p-0 shadow-none font-monospace fw-bold text-uppercase"
                            style={{ height: "26px", fontSize: "13px", backgroundColor: "transparent" }}
                            value={row.paraKodu}
                            onFocus={() => {
                              setActiveRowIndex(idx);
                            }}
                            onChange={(e) => {
                              const val = e.target.value.toUpperCase();
                              handleLineFieldChange(row.id, "paraKodu", val);
                              setSuggestSearch(val);
                              if (val.trim().length > 0) {
                                setActiveSuggestRowId(row.id);
                              } else {
                                setActiveSuggestRowId(null);
                              }
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

                        {/* Floating Suggestion Dropdown */}
                        {activeSuggestRowId === row.id && filteredSuggestions.length > 0 && (
                          <div
                            className="position-absolute bg-white border rounded shadow-lg p-1"
                            style={{
                              top: "100%",
                              left: 0,
                              zIndex: 1050,
                              width: "250px",
                              maxHeight: "180px",
                              overflowY: "auto",
                            }}
                          >
                            {filteredSuggestions.map((item, sIdx) => {
                              const rate = resolveCurrencyRate(item, tip, kurTuru);
                              return (
                                <div
                                  key={item.id}
                                  className={`p-1 px-2 rounded small d-flex justify-content-between align-items-center ${
                                    sIdx === suggestHighlightIdx ? "bg-primary text-white" : "hover-bg-light"
                                  }`}
                                  style={{ cursor: "pointer" }}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleSelectCurrency(row.id, item);
                                  }}
                                >
                                  <div>
                                    <span className="fw-bold">{item.kod}</span>
                                    <span className="ms-2 opacity-75">{item.ad}</span>
                                  </div>
                                  <span className="fw-semibold">{rate.toFixed(4)}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
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
                          disabled={isLocked}
                          className="form-control form-control-sm border-0 p-0 px-2 shadow-none font-monospace text-end"
                          style={{ height: "26px", fontSize: "13px", backgroundColor: "transparent" }}
                          value={row.miktar}
                          onFocus={() => setActiveRowIndex(idx)}
                          onChange={(e) => handleLineFieldChange(row.id, "miktar", e.target.value)}
                          onKeyDown={(e) => handleCellKeyDown(e, idx, "miktar")}
                        />
                      </td>

                      {/* Kur */}
                      <td className="p-0" style={{ borderRight: "1px solid #e2e8f0" }}>
                        <input
                          id={`grid-input-${idx}-kur`}
                          type="text"
                          inputMode="decimal"
                          disabled={isLocked}
                          className="form-control form-control-sm border-0 p-0 px-2 shadow-none font-monospace text-end"
                          style={{ height: "26px", fontSize: "13px", backgroundColor: "transparent" }}
                          value={row.kur}
                          onFocus={() => setActiveRowIndex(idx)}
                          onChange={(e) => handleLineFieldChange(row.id, "kur", e.target.value)}
                          onKeyDown={(e) => handleCellKeyDown(e, idx, "kur")}
                        />
                      </td>

                      {/* % (Komisyon %) */}
                      <td className="p-0" style={{ borderRight: "1px solid #e2e8f0" }}>
                        <input
                          id={`grid-input-${idx}-komisyonOrani`}
                          type="text"
                          inputMode="decimal"
                          disabled={isLocked}
                          className="form-control form-control-sm border-0 p-0 px-1 shadow-none text-center font-monospace"
                          style={{ height: "26px", fontSize: "12px", backgroundColor: "transparent" }}
                          value={row.komisyonOrani}
                          onFocus={() => setActiveRowIndex(idx)}
                          onChange={(e) => handleLineFieldChange(row.id, "komisyonOrani", e.target.value)}
                          onKeyDown={(e) => handleCellKeyDown(e, idx, "komisyonOrani")}
                        />
                      </td>

                      {/* Komisyon */}
                      <td className="p-0" style={{ borderRight: "1px solid #e2e8f0" }}>
                        <input
                          id={`grid-input-${idx}-komisyon`}
                          type="text"
                          inputMode="decimal"
                          disabled={isLocked}
                          className="form-control form-control-sm border-0 p-0 px-2 shadow-none text-end font-monospace"
                          style={{ height: "26px", fontSize: "12px", backgroundColor: "transparent" }}
                          value={row.komisyon}
                          onFocus={() => setActiveRowIndex(idx)}
                          onChange={(e) => handleLineFieldChange(row.id, "komisyon", e.target.value)}
                          onKeyDown={(e) => handleCellKeyDown(e, idx, "komisyon")}
                        />
                      </td>

                      {/* % (BMV %) */}
                      <td className="p-0" style={{ borderRight: "1px solid #e2e8f0" }}>
                        <input
                          id={`grid-input-${idx}-bmvOrani`}
                          type="text"
                          inputMode="decimal"
                          disabled={isLocked}
                          className="form-control form-control-sm border-0 p-0 px-1 shadow-none text-center font-monospace"
                          style={{ height: "26px", fontSize: "12px", backgroundColor: "transparent" }}
                          value={row.bmvOrani}
                          onFocus={() => setActiveRowIndex(idx)}
                          onChange={(e) => handleLineFieldChange(row.id, "bmvOrani", e.target.value)}
                          onKeyDown={(e) => handleCellKeyDown(e, idx, "bmvOrani")}
                        />
                      </td>

                      {/* BMV */}
                      <td className="p-0" style={{ borderRight: "1px solid #e2e8f0" }}>
                        <input
                          id={`grid-input-${idx}-bmv`}
                          type="text"
                          inputMode="decimal"
                          disabled={isLocked}
                          className="form-control form-control-sm border-0 p-0 px-2 shadow-none text-end font-monospace"
                          style={{ height: "26px", fontSize: "12px", backgroundColor: "transparent" }}
                          value={row.bmv}
                          onFocus={() => setActiveRowIndex(idx)}
                          onChange={(e) => handleLineFieldChange(row.id, "bmv", e.target.value)}
                          onKeyDown={(e) => handleCellKeyDown(e, idx, "bmv")}
                        />
                      </td>

                      {/* % (KMV %) */}
                      <td className="p-0" style={{ borderRight: "1px solid #e2e8f0" }}>
                        <input
                          id={`grid-input-${idx}-kmvOrani`}
                          type="text"
                          inputMode="decimal"
                          disabled={isLocked}
                          className="form-control form-control-sm border-0 p-0 px-1 shadow-none text-center font-monospace"
                          style={{ height: "26px", fontSize: "12px", backgroundColor: "transparent" }}
                          value={row.kmvOrani}
                          onFocus={() => setActiveRowIndex(idx)}
                          onChange={(e) => handleLineFieldChange(row.id, "kmvOrani", e.target.value)}
                          onKeyDown={(e) => handleCellKeyDown(e, idx, "kmvOrani")}
                        />
                      </td>

                      {/* KMV */}
                      <td className="p-0" style={{ borderRight: "1px solid #e2e8f0" }}>
                        <input
                          id={`grid-input-${idx}-kmv`}
                          type="text"
                          inputMode="decimal"
                          disabled={isLocked}
                          className="form-control form-control-sm border-0 p-0 px-2 shadow-none text-end font-monospace"
                          style={{ height: "26px", fontSize: "12px", backgroundColor: "transparent" }}
                          value={row.kmv}
                          onFocus={() => setActiveRowIndex(idx)}
                          onChange={(e) => handleLineFieldChange(row.id, "kmv", e.target.value)}
                          onKeyDown={(e) => handleCellKeyDown(e, idx, "kmv")}
                        />
                      </td>

                      {/* Tutar */}
                      <td className="p-0 px-2 text-end font-monospace fw-bold text-dark" style={{ borderRight: "1px solid #e2e8f0", fontSize: "13px" }}>
                        {row.tutar
                          ? Number(row.tutar).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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
                    value={totalTutar.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                    value={totalMasraf.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  />
                </div>
              </Col>

              {/* Orta Alt: Fonksiyon Tuşları Şeridi */}
              <Col md={6}>
                <div
                  className="p-2 rounded text-center small fw-bold border"
                  style={{ backgroundColor: "#e0f2fe", color: "#0369a1", letterSpacing: "0.5px" }}
                >
                  <span role="button" className="mx-2 hover-underline">F3)İst.</span>
                  <span role="button" className="mx-2 hover-underline" onClick={() => setShowSearchModal(true)}>F4)Kur</span>
                  <span role="button" className="mx-2 hover-underline" onClick={() => setShowVezneModal(true)}>F5)Vezne</span>
                  <span role="button" className="mx-2 hover-underline">F6)TL Hesabı</span>
                  <span role="button" className="mx-2 hover-underline">F7)Arbitraj</span>
                  <span role="button" className="mx-2 hover-underline text-primary" onClick={() => setShowDetayModal(true)}>
                    F8)Detay
                  </span>
                  <span role="button" className="mx-2 hover-underline">F9)Banknot Say</span>
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
                    value={sonToplam.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                    value={sonToplam.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

      {/* Cari Lookup Modal */}
      <LookupModal<CariKartItem>
        show={showCariModal}
        onHide={() => setShowCariModal(false)}
        title="Cari Kart Seçimi"
        items={cariList}
        columns={cariColumns}
        filterFn={(item, term) => {
          const t = term.toLowerCase();
          return (
            (item.kod || "").toLowerCase().includes(t) ||
            (item.ad || "").toLowerCase().includes(t) ||
            (item.vergiKimlikNo || "").toLowerCase().includes(t)
          );
        }}
        onSelect={(item) => {
          setCariKartId(item.id);
          setUnvan(item.ad || "");
          if (item.vergiKimlikNo) {
            setVergiKimlikNo(item.vergiKimlikNo);
          }
          if (item.yetkiliKisi) setDetayYetkiliKisi(item.yetkiliKisi);
          if ((item as any).yetkiliKisiId) setDetayYetkiliKisiId(Number((item as any).yetkiliKisiId));
          else if (item.id) setDetayYetkiliKisiId(Number(item.id));
          if (item.adres) setDetayAdres(item.adres);
          if (item.telefon) setDetayTelefon(item.telefon);

          // İl
          if ((item as any).ilId) {
            setDetayIlId(Number((item as any).ilId));
            const mIl = lookupData.ilList.find((l) => l.id === Number((item as any).ilId));
            if (mIl) setDetayIl(mIl.ad);
          }
          if ((item as any).il) {
            setDetayIl((item as any).il);
          }

          // İlçe
          const ilceSource = (lookupData.ilceList && lookupData.ilceList.length > 0) ? lookupData.ilceList : DEFAULT_ILCELER;
          if ((item as any).ilceId) {
            setDetayIlceId(Number((item as any).ilceId));
            const mIlce = ilceSource.find((c) => c.id === Number((item as any).ilceId));
            if (mIlce) setDetayIlce(mIlce.ad);
          }
          if ((item as any).ilce) {
            setDetayIlce((item as any).ilce);
          }

          // Posta Kodu
          const pkSource = (lookupData.postaKoduList && lookupData.postaKoduList.length > 0) ? lookupData.postaKoduList : DEFAULT_POSTA_KODLARI;
          if ((item as any).postaKoduId) {
            setDetayPostaKoduId(Number((item as any).postaKoduId));
            const mPk = pkSource.find((p) => p.id === Number((item as any).postaKoduId));
            if (mPk) setDetayPostaKodu(mPk.kod || mPk.ad);
          }
          if ((item as any).postaKodu) {
            setDetayPostaKodu(String((item as any).postaKodu));
          }

          if ((item as any).bankaHesabiId) setDetayBankaHesabiId(Number((item as any).bankaHesabiId));
          setShowCariModal(false);
        }}
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
          return usdPara ? (tip === 1 ? (usdPara.efektifSatis || usdPara.dovizSatis || 47.2) : (usdPara.efektifAlis || usdPara.dovizAlis || 47.2)) : 47.2;
        })()}
      />
    </div>
  );
};

export default DovizFisiPage;
