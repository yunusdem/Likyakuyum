import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Table,
  Button,
  Badge,
  Modal,
  Form,
  InputGroup,
  Card,
  Row,
  Col,
  Spinner,
  Alert,
} from "react-bootstrap";
import {
  IconBarcode,
  IconSearch,
  IconPrinter,
  IconPlus,
  IconTrash,
  IconRefresh,
  IconBinoculars,
  IconEdit,
  IconX,
  IconHistory,
  IconCheck,
  IconShieldCheck,
  IconAlertTriangle,
  IconReportMoney,
  IconClock,
  IconDiscount,
  IconCoins,
  IconBuildingStore,
  IconPercentage,
} from "@tabler/icons-react";
import { ERPToolbar } from "../../components/common/ERPToolbar";
import { useEBankaFisKesimi } from "../ebanka/useEBankaFisKesimi";
import { LookupModal, LookupColumn } from "../../components/common/LookupModal";
import { ProductDefinitionsPage } from "../settings/ProductDefinitionsPage";
import { CashDeskDefinitionsPage } from "../settings/CashDeskDefinitionsPage";
import { IskontoDefinitionsPage } from "../settings/IskontoDefinitionsPage";
import {
  CariKartItem,
  CariLookups,
  CariService,
} from "../../services/cariService";
import { ebelgeService } from "../../services/ebelgeService";
import {
  DovizFisService,
  KayitsizMusteriItem,
} from "../../services/dovizFisService";
import {
  EtiketService,
  AltinUrunItem,
  OzelUrunItem,
} from "../../services/etiketService";
import { CashDeskService, VezneItem } from "../../services/cashDeskService";
import { PosCihaziService, PosCihaziItem } from "../../services/posCihaziService";
import { BankaService, BankaHesapItem } from "../../services/bankaService";
import {
  PerakendeService,
  PerakendeFaturaModel,
  PerakendeFaturaListItem,
  PerakendeFaturaSatiriItem,
  SavePerakendeFaturaPayload,
  SavePerakendeFaturaSatiriPayload,
  SavePerakendeFaturaOdemePayload,
  PerakendeFaturaOdemeItem,
} from "../../services/perakendeService";
import {
  IskontoService,
  IskontoItem,
} from "../../services/iskontoService";
import { AyarSecimModal } from "../../components/common/AyarSecimModal";
import { AyarItem } from "../../services/ayarService";
import {
  MusteriSecimModal,
  SelectedCustomerResult,
  CustomerSearchField,
} from "./MusteriSecimModal";
import { PerakendeFisiPrintModal } from "./PerakendeFisiPrintModal";
import { PrinterService, YaziciItem } from "../../services/printerService";
import { CompanyService } from "../../services/companyService";
import { resolveEffectivePrinter } from "../../utils/printerResolver";
import { triggerSilentPrint } from "../../services/silentPrintService";
import { generatePerakendeReceiptHtml } from "../../utils/receiptHtmlGenerator";
import { SarrafFisService, UrunItem } from "../../services/sarrafFisService";
import { KurService } from "../../services/kurService";
import { MasakService, MasakEslesme } from "../../services/masakService";
import { MasakSonucModal } from "../../components/masak/MasakSonucModal";
import { StatisticService, StatisticItem } from "../../services/statisticService";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { formatMiktar, parseDecimal, onlyDecimal, onlyDigits, blockNonNumericKeys } from "../../utils/numericInput";

interface CartLineItem {
  id: string;
  altinUrunId?: number | null;
  barkod: string;
  urunAdi: string;
  ayar: string;
  miktar: number | string;
  birim: string;
  gram: number | string;
  hasGram: number | string;
  birimFiyat: number | string;
  tutar: number | string;
  kdvOrani: number | string;
  kdvTutari: number | string;
  toplamTutar: number | string;
}

export interface OdemeRow {
  id: string;
  odemeAraciTuru?: number; // 0: Vezne, 1: Cari, 2: POS, 3: Hesap
  paraId?: number | null;
  paraKodu: string;
  paraAdi: string;
  adet: number | string;
  miktar: number | string;
  milyem: number | string;
  hasGram: number | string;
  kur: number | string;
  tutar: number | string;
  cariKartId?: number | null;
  cariUnvan?: string | null;
  cariKod?: string | null;
  bankaId?: number | null;
  posCihaziId?: number | null;
  urunTipi?: number;
}

const DEFAULT_ODEME_URUNLER: UrunItem[] = [
  { id: 1, paraId: 1, kod: "TL", ad: "TÜRK LİRASI", urunTipi: 0, gramaj: 0, hasOrani: 0, alisMilyem: 0, satisMilyem: 0 },
  { id: 2, paraId: 2, kod: "USD", ad: "AMERİKAN DOLARI", urunTipi: 1, gramaj: 0, hasOrani: 0, alisMilyem: 0, satisMilyem: 0 },
  { id: 3, paraId: 3, kod: "EUR", ad: "EURO", urunTipi: 1, gramaj: 0, hasOrani: 0, alisMilyem: 0, satisMilyem: 0 },
  { id: 4, paraId: 4, kod: "HAS", ad: "HAS ALTIN (24 AYAR)", urunTipi: 2, gramaj: 1, hasOrani: 1000, alisMilyem: 1000, satisMilyem: 1000 },
  { id: 5, paraId: 5, kod: "CEYREK", ad: "ÇEYREK ALTIN", urunTipi: 2, gramaj: 1.75, hasOrani: 916, alisMilyem: 916, satisMilyem: 916 },
  { id: 6, paraId: 6, kod: "YARIM", ad: "YARIM ALTIN", urunTipi: 2, gramaj: 3.5, hasOrani: 916, alisMilyem: 916, satisMilyem: 916 },
  { id: 7, paraId: 7, kod: "TAM", ad: "TAM ALTIN", urunTipi: 2, gramaj: 7.0, hasOrani: 916, alisMilyem: 916, satisMilyem: 916 },
  { id: 8, paraId: 8, kod: "ATA", ad: "ATA LİRA", urunTipi: 2, gramaj: 7.216, hasOrani: 916, alisMilyem: 916, satisMilyem: 916 },
  { id: 9, paraId: 9, kod: "22AYAR", ad: "22 AYAR HURDA / BİLEZİK", urunTipi: 2, gramaj: 1, hasOrani: 916, alisMilyem: 916, satisMilyem: 916 },
  { id: 10, paraId: 10, kod: "18AYAR", ad: "18 AYAR HURDA / ZİYNET", urunTipi: 2, gramaj: 1, hasOrani: 750, alisMilyem: 750, satisMilyem: 750 },
  { id: 11, paraId: 11, kod: "14AYAR", ad: "14 AYAR HURDA / ZİYNET", urunTipi: 2, gramaj: 1, hasOrani: 585, alisMilyem: 585, satisMilyem: 585 },
  { id: 12, paraId: 12, kod: "8AYAR", ad: "8 AYAR HURDA", urunTipi: 2, gramaj: 1, hasOrani: 333, alisMilyem: 333, satisMilyem: 333 },
  { id: 13, paraId: 13, kod: "POS", ad: "KREDİ KARTI / POS", urunTipi: 0, gramaj: 0, hasOrani: 0, alisMilyem: 0, satisMilyem: 0 },
  { id: 14, paraId: 14, kod: "HAVALE", ad: "HAVALE / EFT", urunTipi: 0, gramaj: 0, hasOrani: 0, alisMilyem: 0, satisMilyem: 0 },
  { id: 15, paraId: 15, kod: "GUMUS", ad: "GÜMÜŞ (999/925)", urunTipi: 3, gramaj: 1, hasOrani: 1000, alisMilyem: 1000, satisMilyem: 1000 },
];

const GRID_COLS = [
  "barkod",
  "urunAdi",
  "ayar",
  "miktar",
  "birim",
  "gram",
  "hasGram",
  "birimFiyat",
  "kdvOrani",
] as const;
type GridColKey = typeof GRID_COLS[number];

const ODEME_GRID_COLS = [
  "odemeAraciTuru",
  "cariKod",
  "paraAdi",
  "paraKodu",
  "adet",
  "miktar",
  "milyem",
  "hasGram",
  "kur",
  "tutar",
] as const;
type OdemeGridColKey = typeof ODEME_GRID_COLS[number];

const makeId = () => `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const createEmptyRow = (): CartLineItem => ({
  id: makeId(),
  altinUrunId: null,
  barkod: "",
  urunAdi: "",
  ayar: "14K",
  miktar: 1,
  birim: "Adet",
  gram: "",
  hasGram: "",
  birimFiyat: "",
  tutar: "",
  kdvOrani: 0,
  kdvTutari: "",
  toplamTutar: "",
});

const createEmptyOdemeRow = (index: number = 1): OdemeRow => ({
  id: `odeme-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
  odemeAraciTuru: 0,
  paraKodu: "",
  paraAdi: "",
  adet: "",
  miktar: "",
  milyem: "",
  hasGram: "",
  kur: "",
  tutar: "",
  cariKartId: null,
  bankaId: null,
});

const isRowEmpty = (row?: CartLineItem): boolean => {
  if (!row) return true;
  const hasBarkod = Boolean(row.barkod && String(row.barkod).trim());
  const hasUrunAdi = Boolean(row.urunAdi && String(row.urunAdi).trim());
  const hasGram = Boolean(row.gram !== "" && row.gram !== null && Number(row.gram) > 0);
  const hasHasGram = Boolean(row.hasGram !== "" && row.hasGram !== null && Number(row.hasGram) > 0);
  const hasBirimFiyat = Boolean(row.birimFiyat !== "" && row.birimFiyat !== null && Number(row.birimFiyat) > 0);
  const hasTutar = Boolean(row.tutar !== "" && row.tutar !== null && Number(row.tutar) > 0);

  return !hasBarkod && !hasUrunAdi && !hasGram && !hasHasGram && !hasBirimFiyat && !hasTutar;
};

export const isAltinOrGumusRow = (row?: Partial<OdemeRow> | null, customList?: UrunItem[]): boolean => {
  if (!row) return false;
  const code = (row.paraKodu || "").toUpperCase().trim();
  const name = (row.paraAdi || "").toUpperCase().trim();
  if (!code && !name) return false;

  const nonMetalCodes = [
    "TL", "TRY", "USD", "EUR", "GBP", "CHF", "CAD", "AUD", "SAR", "AED", "RUB", "JPY",
    "POS", "HAVALE", "EFT", "VERESIYE", "ACIKHESAP", "AÇIK HESAP"
  ];
  if (nonMetalCodes.includes(code)) {
    return false;
  }
  if (
    code.startsWith("ISK") ||
    name.includes("İSKONTO") ||
    name.includes("ISKONTO") ||
    name.includes("AÇIK HESAP") ||
    name.includes("VERESİYE") ||
    name.includes("KREDİ KARTI") ||
    name.includes("HAVALE") ||
    name.includes("EFT") ||
    name.includes("DOLAR") ||
    name.includes("EURO") ||
    name.includes("POUND") ||
    name.includes("STERLİN") ||
    name.includes("FRANG")
  ) {
    return false;
  }

  const listToCheck = customList && customList.length > 0 ? customList : DEFAULT_ODEME_URUNLER;
  const found = listToCheck.find((u) => u.kod.toUpperCase().trim() === code);
  if (found) {
    if (found.urunTipi === 2 || found.urunTipi === 3 || (found.hasOrani && Number(found.hasOrani) > 0) || (found.alisMilyem && Number(found.alisMilyem) > 0)) {
      return true;
    }
    if (found.urunTipi === 0 || found.urunTipi === 1 || found.urunTipi === 99) {
      return false;
    }
  }

  const metalKeywords = [
    "HAS", "ALTIN", "CEYREK", "ÇEYREK", "YARIM", "TAM", "ATA", "GREMSE",
    "22AYAR", "18AYAR", "14AYAR", "8AYAR", "24AYAR", "22 AYAR", "18 AYAR", "14 AYAR", "8 AYAR", "24 AYAR",
    "GUMUS", "GÜMÜŞ", "ZIYNET", "BILEZIK", "BİLEZİK", "HURDA", "KULCE", "KÜLÇE"
  ];
  return metalKeywords.some((k) => code.includes(k) || name.includes(k));
};

const isOdemeRowEmpty = (row?: OdemeRow): boolean => {
  if (!row) return true;
  const hasSpecialKod = Boolean(
    (row.paraKodu && row.paraKodu.trim() !== "" && row.paraKodu.toUpperCase() !== "TL" && row.paraKodu.toUpperCase() !== "TRY") ||
    (row.paraAdi && row.paraAdi.trim() !== "" && row.paraAdi.toUpperCase() !== "TÜRK LİRASI" && row.paraAdi.toUpperCase() !== "TURK LIRASI")
  );
  const hasAdet = Boolean(row.adet !== "" && row.adet !== null && Number(row.adet) > 0);
  const hasMiktar = Boolean(row.miktar !== "" && row.miktar !== null && Number(row.miktar) > 0);
  const hasTutar = Boolean(row.tutar !== "" && row.tutar !== null && Number(row.tutar) > 0);
  const hasHasGram = Boolean(row.hasGram !== "" && row.hasGram !== null && Number(row.hasGram) > 0);
  return !hasSpecialKod && !hasAdet && !hasMiktar && !hasTutar && !hasHasGram;
};

const isPerakendeRowFilled = (row?: CartLineItem): boolean => {
  if (!row) return false;
  const hasCodeOrName = Boolean((row.barkod && String(row.barkod).trim()) || (row.urunAdi && String(row.urunAdi).trim()));
  const hasMiktarOrGram = Boolean((row.miktar !== "" && Number(row.miktar) > 0) || (row.gram !== "" && Number(row.gram) > 0));
  const hasFiyatOrTutar = Boolean((row.birimFiyat !== "" && Number(row.birimFiyat) > 0) || (row.tutar !== "" && Number(row.tutar) > 0));
  return hasCodeOrName && hasMiktarOrGram && hasFiyatOrTutar;
};

export const isAnonymousCustomerName = (val?: string | null): boolean => {
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

export function detectScenario(
  identValue: string,
  rawCustomer?: any,
  unvan?: string
): string {
  const clean = (identValue || "").trim();
  const raw = rawCustomer || {};
  const passport = (raw.pasaportNo || "").trim();
  const unvanUpper = (unvan || raw.unvan || raw.aliciUnvan || "").toUpperCase();

  // Müşteride kayıtlı senaryo varsa önceliklidir
  if (raw.senaryo) return raw.senaryo;

  // 1. Kamu Kurumu Kontrolü (Kamu Faturası)
  const isKamu =
    raw.isKamu ||
    raw.kamuKurumu ||
    raw.kamu ||
    unvanUpper.includes("BELEDİYE") ||
    unvanUpper.includes("BELEDIYE") ||
    unvanUpper.includes("BAKANLIĞI") ||
    unvanUpper.includes("BAKANLIGI") ||
    unvanUpper.includes("MÜDÜRLÜĞÜ") ||
    unvanUpper.includes("MUDURLUGU") ||
    unvanUpper.includes("KAYMAKAMLIĞI") ||
    unvanUpper.includes("VALİLİĞİ") ||
    unvanUpper.includes("VALILIGI") ||
    unvanUpper.includes("DEVLET HASTANESİ") ||
    unvanUpper.includes("ÜNİVERSİTESİ") ||
    unvanUpper.includes("UNIVERSITESI") ||
    unvanUpper.includes("İL ÖZEL İDARESİ") ||
    unvanUpper.includes("GENEL MÜDÜRLÜK") ||
    unvanUpper.includes("REKTÖRLÜĞÜ") ||
    unvanUpper.includes("EMNİYET") ||
    unvanUpper.includes("DEFTERDARLIĞI") ||
    unvanUpper.includes("MALMÜDÜRLÜĞÜ") ||
    unvanUpper.includes("KAMU");

  if (isKamu) {
    return "KAMU";
  }

  // 2. Yabancı / Pasaport Kontrolü (Yolcu Beraberi Fatura)
  const isPassportOrForeigner =
    Boolean(passport) ||
    raw.kisilikTipi === 2 ||
    raw.uyruk === "YABANCI" ||
    clean.toUpperCase().startsWith("P:") ||
    clean.toUpperCase().startsWith("PAS:") ||
    clean.replace(/\D/g, "") === "2222222222" ||
    (clean.length >= 6 && clean.length <= 9 && /[A-Za-z]/.test(clean));

  if (isPassportOrForeigner) {
    return "YOLCUBERABERFATURA";
  }

  // 3. İhracat Kontrolü
  if (
    raw.isIhracat ||
    unvanUpper.includes("EXPORT") ||
    unvanUpper.includes("İHRACAT") ||
    unvanUpper.includes("IHRACAT")
  ) {
    return "IHRACAT";
  }

  const digits = clean.replace(/\D/g, "");

  // 4. 10 Haneli VKN -> Kurumsal / Tüzel Kişi
  if (digits.length === 10) {
    if (raw.eFaturaKullanicisi || raw.ticariFatura || raw.eFaturaSenaryosu === "TICARIFATURA") {
      return "TICARIFATURA";
    }
    return "EARSIVFATURA";
  }

  // 5. 11 Haneli TCKN -> Şahıs / Gerçek Kişi
  if (digits.length === 11) {
    if (digits === "11111111111") {
      return "EARSIVFATURA";
    }
    if (raw.eFaturaKullanicisi || raw.eFaturaPostaKutusu || raw.ticariFatura || raw.eFaturaSenaryosu === "TICARIFATURA") {
      return "TICARIFATURA";
    }
    return "EARSIVFATURA";
  }

  return "EARSIVFATURA";
}

export interface PerakendeFisiPageProps {
  isDuzeltme?: boolean;
}

export const PerakendeFisiPage: React.FC<PerakendeFisiPageProps> = ({ isDuzeltme = false }) => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  const isDuzeltmeMode = Boolean(isDuzeltme || location.pathname.includes("duzeltme"));

  // Active Loaded Invoice State
  const [currentFaturaId, setCurrentFaturaId] = useState<number | null>(null);
  const [, setCurrentIndex] = useState<number>(0);

  // Header State
  const [faturaNo, setFaturaNo] = useState<string>("");
  const [tarih, setTarih] = useState<string>(
    new Date().toISOString().substring(0, 10)
  );
  const [saat, setSaat] = useState<string>(
    new Date().toTimeString().substring(0, 5)
  );

  // Kayıt modunda anlık saati canlı güncelle
  useEffect(() => {
    if (isDuzeltmeMode) return;
    const updateTime = () => {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      setTarih(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
      setSaat(`${pad(now.getHours())}:${pad(now.getMinutes())}`);
    };
    updateTime();
    const timer = setInterval(updateTime, 10000);
    return () => clearInterval(timer);
  }, [isDuzeltmeMode]);

  const [vezneler, setVezneler] = useState<VezneItem[]>([]);
  const [selectedVezne, setSelectedVezne] = useState<VezneItem | null>(null);
  const [posCihazlari, setPosCihazlari] = useState<PosCihaziItem[]>([]);
  const [showPosModal, setShowPosModal] = useState<boolean>(false);
  const [pendingPosRowId, setPendingPosRowId] = useState<string | null>(null);
  const [posSearchTerm, setPosSearchTerm] = useState<string>("");

  const [bankaHesaplari, setBankaHesaplari] = useState<BankaHesapItem[]>([]);
  const [showBankaModal, setShowBankaModal] = useState<boolean>(false);
  const [pendingBankaRowId, setPendingBankaRowId] = useState<string | null>(null);
  const [bankaSearchTerm, setBankaSearchTerm] = useState<string>("");

  const [printers, setPrinters] = useState<YaziciItem[]>([]);
  const [companyDefinitions, setCompanyDefinitions] = useState<any>(null);
  const [statisticList, setStatisticList] = useState<StatisticItem[]>([]);
  const [faturaTipi, setFaturaTipi] = useState<number>(1); // 0: Alış, 1: Satış
  const [senaryo, setSenaryo] = useState<string>("EARSIVFATURA");

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
      } catch {}
    }
    if (faturaTipi === 0) {
      return buyBg || "var(--user-buy-header-bg, #e2e8f0)";
    } else {
      return sellBg || "var(--user-sell-header-bg, #e2e8f0)";
    }
  }, [faturaTipi, user?.appearance?.buyHeaderBgColor, user?.appearance?.sellHeaderBgColor]);

  useEffect(() => {
    PrinterService.getYazicilar().then(setPrinters).catch(() => { });
    CompanyService.getDefinitions().then(setCompanyDefinitions).catch(() => { });
    StatisticService.getStatistics().then(setStatisticList).catch(() => { });
    PosCihaziService.getPosCihazlari().then(setPosCihazlari).catch(() => { });
    BankaService.getBankalar().then(setBankaHesaplari).catch(() => { });
  }, []);

  // POS ve Banka cihazları/hesapları yüklendiğinde ödeme tablosundaki satırların kodlarını tamamla (sadece kod boşsa)
  useEffect(() => {
    if (posCihazlari.length > 0 || bankaHesaplari.length > 0) {
      setOdemeRows((prev) =>
        prev.map((r) => {
          if (r.odemeAraciTuru === 2 && posCihazlari.length > 0 && r.bankaId && !r.cariKod) {
            const match = posCihazlari.find((p) => p.posCihaziId === r.bankaId);
            if (match) {
              return {
                ...r,
                cariKod: match.kod,
                paraAdi: r.paraAdi && r.paraAdi !== "KREDİ KARTI / POS" ? r.paraAdi : (match.ad || "KREDİ KARTI / POS"),
              };
            }
          } else if (r.odemeAraciTuru === 3 && bankaHesaplari.length > 0 && r.bankaId && !r.cariKod) {
            const match = bankaHesaplari.find((b) => b.bankaId === r.bankaId);
            if (match) {
              return {
                ...r,
                cariKod: match.hesapNo,
                paraAdi: r.paraAdi && r.paraAdi !== "BANKA HAVALE / EFT" ? r.paraAdi : (match.hesapAdi || "BANKA HAVALE / EFT"),
              };
            }
          }
          return r;
        })
      );
    }
  }, [posCihazlari, bankaHesaplari]);

  // Customer State
  const [aliciVknTckn, setAliciVknTckn] = useState<string>("11111111111");
  const [cariKod, setCariKod] = useState<string>("");
  const [aliciUnvan, setAliciUnvan] = useState<string>("NİHAİ TÜKETİCİ");
  const [cariKartId, setCariKartId] = useState<number | null>(null);
  const [adres, setAdres] = useState<string>("");
  const [ilce, setIlce] = useState<string>("");
  const [il, setIl] = useState<string>("");
  const [vergiDairesi, setVergiDairesi] = useState<string>("");
  const [telefon, setTelefon] = useState<string>("");
  const [eposta, setEposta] = useState<string>("");

  // E-Belge / GİB Mükellefiyet Kontrolü (TCKN / VKN Sorgulama)
  const checkAndApplyMukellefiyet = useCallback(async (vknTckn: string, currentUnvan?: string, fallbackSenaryo?: string) => {
    const clean = (vknTckn || "").replace(/\D/g, "");
    if (!clean || clean === "11111111111" || clean === "2222222222") {
      setSenaryo("EARSIVFATURA");
      return "EARSIVFATURA";
    }

    // Pasaport / Yabancı kontrolü
    if (vknTckn.toUpperCase().startsWith("P:") || vknTckn.toUpperCase().startsWith("PAS:") || (clean.length >= 6 && clean.length <= 9 && /[A-Za-z]/.test(vknTckn))) {
      setSenaryo("YOLCUBERABERFATURA");
      return "YOLCUBERABERFATURA";
    }

    if (clean.length === 10 || clean.length === 11) {
      try {
        const res = await ebelgeService.mukellefSorgula(clean);
        if (res && res.mukellefMi) {
          // E-Fatura Mükellefi -> Doğrudan e-Fatura (TICARIFATURA)
          setSenaryo("TICARIFATURA");
          const foundTitle = (res.kullanicilar?.[0]?.Title || "").trim();
          if (foundTitle) {
            setAliciUnvan(foundTitle);
            lastFocusedUnvanRef.current = foundTitle;
          }
          // ICE / e-Fatura kayıtlı adreslerini de getir
          try {
            const adrRes = await ebelgeService.aliciAdresleri(clean);
            if (Array.isArray(adrRes) && adrRes.length > 0) {
              const firstAdres = adrRes[0];
              const combinedAdres = [firstAdres.adres, firstAdres.ilce, firstAdres.il].filter(Boolean).join(" ");
              if (combinedAdres) {
                setDetayAdres(combinedAdres);
              }
              if (firstAdres.vergiDairesi) {
                setVergiDairesi(firstAdres.vergiDairesi);
              }
            }
          } catch { }

          showInfo(`✅ e-Fatura Mükellefi (${foundTitle || clean}) bilgileri getirildi → Senaryo: e-Fatura`);
          return "TICARIFATURA";
        } else {
          // E-Fatura Mükellefi değil -> e-Arşiv (EARSIVFATURA)
          setSenaryo("EARSIVFATURA");
          return "EARSIVFATURA";
        }
      } catch (err) {
        console.warn("Mükellef sorgulama hatası:", err);
        const auto = detectScenario(vknTckn, undefined, currentUnvan);
        setSenaryo(auto);
        return auto;
      }
    }
    const auto = detectScenario(vknTckn, undefined, currentUnvan);
    setSenaryo(auto);
    return auto;
  }, [showInfo]);

  // Cart & Grid State
  const [items, setItems] = useState<CartLineItem[]>([createEmptyRow()]);
  const [activeRowIndex, setActiveRowIndex] = useState<number>(0);
  const [invalidRowIds, setInvalidRowIds] = useState<Record<string, boolean>>({});

  // Payment Rows State
  const [odemeRows, setOdemeRows] = useState<OdemeRow[]>([createEmptyOdemeRow(1)]);
  const [activeOdemeRowIndex, setActiveOdemeRowIndex] = useState<number>(0);
  const [activeOdemeRowIdForUrun, setActiveOdemeRowIdForUrun] = useState<string | null>(null);
  const [showOdemeUrunModal, setShowOdemeUrunModal] = useState<boolean>(false);
  const [odemeUrunList, setOdemeUrunList] = useState<UrunItem[]>(DEFAULT_ODEME_URUNLER);
  const [altinHasKuru, setAltinHasKuru] = useState<number>(3000);
  const [kurMap, setKurMap] = useState<Map<string, any>>(new Map());

  // Iskonto (TODVZ_ISKONTO)
  const [iskontolar, setIskontolar] = useState<IskontoItem[]>([]);
  const [selectedIskontoId, setSelectedIskontoId] = useState<number | null>(null);
  const [iskontoOrani, setIskontoOrani] = useState<number>(0);
  const [iskontoTutari, setIskontoTutari] = useState<number>(0);
  const [iskontoKodu, setIskontoKodu] = useState<string>("");
  const [iskontoSearchTerm, setIskontoSearchTerm] = useState<string>("");
  const [showIskontoModal, setShowIskontoModal] = useState<boolean>(false);

  // Combined Payment Products + Active Discounts for Tahsilat/Ödeme table
  const allOdemeUrunler = useMemo<UrunItem[]>(() => {
    const iskontoUrunler: UrunItem[] = (iskontolar || []).map((isk) => ({
      id: 100000 + Number(isk.iskontoId || 1),
      paraId: 100000 + Number(isk.iskontoId || 1),
      kod: (isk.kod || `ISK-${isk.iskontoId || 1}`).toUpperCase().trim(),
      ad: isk.tanim ? (isk.tanim.toUpperCase().includes("İSKONTO") || isk.tanim.toUpperCase().includes("ISKONTO") ? isk.tanim : `İskonto: ${isk.tanim}`) : "İskonto",
      urunTipi: 99,
      gramaj: 0,
      hasOrani: 0,
      alisMilyem: 0,
      satisMilyem: 0,
      isIskonto: true,
      rawIskonto: isk,
    } as any));

    return [...odemeUrunList, ...iskontoUrunler];
  }, [odemeUrunList, iskontolar]);

  const hasCariInOdeme = useMemo(() => {
    return odemeRows.some((r) => r.odemeAraciTuru === 1 || Boolean(r.cariKartId));
  }, [odemeRows]);

  const currencyOptions = useMemo(() => {
    const result: { kod: string; ad: string; paraId: number }[] = [];
    result.push({ kod: "TL", ad: "TÜRK LİRASI", paraId: 1 });
    (odemeUrunList || []).forEach((u) => {
      const k = (u.kod || "").trim().toUpperCase();
      if (!k || k === "TL" || k === "TRY") return;
      if (
        u.urunTipi === 0 ||
        k === "USD" ||
        k === "EUR" ||
        k === "HAS" ||
        k === "CHF" ||
        k === "GBP" ||
        (u.ad || "").toUpperCase().includes("LİRA") ||
        (u.ad || "").toUpperCase().includes("DOLAR") ||
        (u.ad || "").toUpperCase().includes("EURO") ||
        (u.ad || "").toUpperCase().includes("ALTIN")
      ) {
        if (!result.some((r) => r.kod === k)) {
          result.push({ kod: k, ad: u.ad || k, paraId: u.paraId || u.id });
        }
      }
    });
    return result;
  }, [odemeUrunList]);

  const pendingVeresiyeRowIdRef = useRef<string | null>(null);

  const applySelectedIskonto = useCallback(
    (item: IskontoItem | null) => {
      if (item) {
        setSelectedIskontoId(item.iskontoId);
        setIskontoKodu(item.kod || item.tanim || "");
        if (item.iskontoTipi === 1) {
          setIskontoOrani(Number(item.oran) || 0);
          setIskontoTutari(0);
        } else if (item.iskontoTipi === 2) {
          setIskontoTutari(Number(item.tutar) || 0);
          setIskontoOrani(0);
        } else if (item.iskontoTipi === 3) {
          const hasVal = Number(item.hasTutar) || 0;
          const hasKur = Number(altinHasKuru) || 0;
          setIskontoTutari(Math.round(hasVal * hasKur * 100) / 100);
          setIskontoOrani(0);
        } else {
          if (item.oran) setIskontoOrani(Number(item.oran));
          if (item.tutar) setIskontoTutari(Number(item.tutar));
        }
      } else {
        setSelectedIskontoId(null);
        setIskontoKodu("");
        setIskontoOrani(0);
        setIskontoTutari(0);
      }
    },
    [altinHasKuru]
  );

  // Refs for grid keyboard navigation
  const rowInputRefs = useRef<Record<string, HTMLElement | null>>({});
  const odemeInputRefs = useRef<Record<string, HTMLElement | null>>({});

  // Submitting State & Mutex Ref
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const isSubmittingRef = useRef<boolean>(false);

  const vknRef = useRef<HTMLInputElement | null>(null);
  const cariKodRef = useRef<HTMLInputElement | null>(null);
  const aliciUnvanRef = useRef<HTMLInputElement | null>(null);

  const lastFocusedCariKodRef = useRef<string>("");
  const lastFocusedUnvanRef = useRef<string>("");
  const lastFocusedVknRef = useRef<string>("");
  const lastModalCallerRef = useRef<"cariKod" | "unvan" | "vkn" | "productLookup" | "odemeLookup" | null>(null);
  const lastProductRowIdRef = useRef<string | null>(null);
  const activeProductRowIdRef = useRef<string | null>(null);
  const lastOdemeRowIdRef = useRef<string | null>(null);

  // Modals State
  const [showVezneModal, setShowVezneModal] = useState<boolean>(false);
  const [showNewVezneModal, setShowNewVezneModal] = useState<boolean>(false);
  const [showNewProductModal, setShowNewProductModal] = useState<boolean>(false);
  const [showNewIskontoModal, setShowNewIskontoModal] = useState<boolean>(false);
  const [showMusteriModal, setShowMusteriModal] = useState<boolean>(false);
  const [musteriSearchTerm, setMusteriSearchTerm] = useState<string>("");
  const [cariSearchField, setCariSearchField] = useState<CustomerSearchField>("all");
  const [showProductLookup, setShowProductLookup] = useState<boolean>(false);
  const [activeProductRowId, setActiveProductRowId] = useState<string | null>(null);
  const [productSearchTerm, setProductSearchTerm] = useState<string>("");
  const [odemeSearchTerm, setOdemeSearchTerm] = useState<string>("");
  const [showAyarModal, setShowAyarModal] = useState<boolean>(false);
  const [activeAyarRowId, setActiveAyarRowId] = useState<string | null>(null);
  const [cariler, setCariler] = useState<CariKartItem[]>([]);
  const [cariLookups, setCariLookups] = useState<CariLookups | null>(null);
  const [kayitsizMusteriler, setKayitsizMusteriler] = useState<KayitsizMusteriItem[]>([]);
  const [altinList, setAltinList] = useState<AltinUrunItem[]>([]);
  const [ozelList, setOzelList] = useState<OzelUrunItem[]>([]);
  const [isProductLoading, setIsProductLoading] = useState<boolean>(false);

  // MASAK States
  const [masakModalOpen, setMasakModalOpen] = useState<boolean>(false);
  const [masakResult, setMasakResult] = useState<{
    queriedName?: string;
    queriedId?: string;
    matches: MasakEslesme[];
    searched: boolean;
  }>({ matches: [], searched: false });
  const [showMasakLimitWarningModal, setShowMasakLimitWarningModal] = useState<boolean>(false);
  const [showMasakConfirmModal, setShowMasakConfirmModal] = useState<boolean>(false);
  const [showOdemeFarkConfirmModal, setShowOdemeFarkConfirmModal] = useState<{ show: boolean; andPrint: boolean; rawDiffTL: number }>({ show: false, andPrint: false, rawDiffTL: 0 });
  const [isSearchingMasak, setIsSearchingMasak] = useState<boolean>(false);
  const [pendingSaveWithPrint, setPendingSaveWithPrint] = useState<boolean>(false);

  // Müşteri & MASAK Detay Bilgileri Modalı State
  const [showMusteriDetayModal, setShowMusteriDetayModal] = useState<boolean>(false);
  const [detayUnvan, setDetayUnvan] = useState<string>("");
  const [detayVknTckn, setDetayVknTckn] = useState<string>("");
  const [detayAdres, setDetayAdres] = useState<string>("");
  const [detayIl, setDetayIl] = useState<string>("");
  const [detayIlce, setDetayIlce] = useState<string>("");
  const [detayVergiDairesi, setDetayVergiDairesi] = useState<string>("");
  const [detayTelefon, setDetayTelefon] = useState<string>("");
  const [detayEposta, setDetayEposta] = useState<string>("");

  const isMasakBlocked = Boolean(
    masakResult.searched && masakResult.matches && masakResult.matches.length > 0
  );

  // Print Preview Modal
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [isPendingDirectPrint, setIsPendingDirectPrint] = useState<boolean>(false);
  const [printedFatura, setPrintedFatura] = useState<PerakendeFaturaModel | null>(null);

  // Invoices History Search Modal
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [historyList, setHistoryList] = useState<PerakendeFaturaListItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [historySearch, setHistorySearch] = useState<string>("");
  const [historyStartDate, setHistoryStartDate] = useState<string>(
    new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10)
  );
  const [historyEndDate, setHistoryEndDate] = useState<string>(
    new Date().toISOString().substring(0, 10)
  );

  // Safe selection bounds helper
  const getSelectionBounds = (el: any): { isAtStart: boolean; isAtEnd: boolean } => {
    if (!el || !(el instanceof HTMLInputElement)) {
      return { isAtStart: true, isAtEnd: true };
    }
    try {
      const len = el.value ? el.value.length : 0;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      if (typeof start === "number" && typeof end === "number") {
        return {
          isAtStart: start === 0,
          isAtEnd: end === len,
        };
      }
    } catch { }
    return { isAtStart: true, isAtEnd: true };
  };

  // Focus Grid Cell Helper (Items Table)
  const focusGridCell = (
    rowId: string,
    field: GridColKey,
    mode: "select" | "start" | "end" = "select"
  ) => {
    const el = rowInputRefs.current[`${rowId}_${field}`];
    if (el) {
      el.focus();
      if (el instanceof HTMLInputElement) {
        try {
          if (mode === "select") {
            el.select();
          } else if (mode === "start") {
            el.setSelectionRange(0, 0);
          } else if (mode === "end") {
            const len = el.value ? el.value.length : 0;
            el.setSelectionRange(len, len);
          }
        } catch { }
      }
    }
  };

  // Focus Payment Grid Cell Helper
  const focusOdemeGridCell = (
    rowId: string,
    field: OdemeGridColKey,
    mode: "select" | "start" | "end" = "select"
  ) => {
    const el = odemeInputRefs.current[`${rowId}_${field}`];
    if (el) {
      el.focus();
      if (el instanceof HTMLInputElement) {
        try {
          if (mode === "select") {
            el.select();
          } else if (mode === "start") {
            el.setSelectionRange(0, 0);
          } else if (mode === "end") {
            const len = el.value ? el.value.length : 0;
            el.setSelectionRange(len, len);
          }
        } catch { }
      }
    }
  };

  // Initial Next Number
  const loadNextNo = useCallback(async () => {
    try {
      const prefix = senaryo === "EARSIVFATURA" ? "EAR" : "GIB";
      const nextNo = await PerakendeService.getNextFaturaNo(prefix);
      setFaturaNo(nextNo);
    } catch {
      const year = new Date().getFullYear();
      setFaturaNo(`GIB${year}000000001`);
    }
  }, [senaryo]);

  // Load products list for dropdown / modal lookup
  const loadProductsForLookup = useCallback(async () => {
    setIsProductLoading(true);
    try {
      const [altinlar, ozeller] = await Promise.all([
        EtiketService.getAltinUrunler().catch(() => [] as AltinUrunItem[]),
        EtiketService.getOzelUrunler().catch(() => [] as OzelUrunItem[]),
      ]);
      setAltinList(altinlar);
      setOzelList(ozeller);
    } catch (err) {
      console.error("loadProductsForLookup error:", err);
    } finally {
      setIsProductLoading(false);
    }
  }, []);

  const loadVezneler = useCallback(async () => {
    try {
      const data = await CashDeskService.getVezneler();
      const list = data || [];
      setVezneler(list);
      return list;
    } catch (err) {
      console.error("loadVezneler error:", err);
      return [];
    }
  }, []);

  const loadOdemeUrunler = useCallback(async () => {
    try {
      const res = await SarrafFisService.getUrunler();
      if (res && res.length > 0) {
        const defaultMap = new Map(DEFAULT_ODEME_URUNLER.map((d) => [d.kod.toUpperCase(), d]));
        const list = res.map((r) => {
          const code = (r.kod || "").toUpperCase().trim();
          const def = defaultMap.get(code);
          return {
            ...def,
            ...r,
            alisMilyem: Number(r.alisMilyem) > 0 ? Number(r.alisMilyem) : (Number(def?.alisMilyem) || Number(r.hasOrani) || 0),
            satisMilyem: Number(r.satisMilyem) > 0 ? Number(r.satisMilyem) : (Number(def?.satisMilyem) || Number(r.hasOrani) || 0),
          };
        });
        setOdemeUrunList(list);
      }
    } catch (err) {
      console.error("loadOdemeUrunler error:", err);
    }
  }, []);

  const loadIskontolar = useCallback(async () => {
    try {
      const data = await IskontoService.getIskontolar({ aktif: true });
      setIskontolar(data || []);
    } catch (err) {
      console.error("loadIskontolar error:", err);
    }
  }, []);

  // Determine user's active cashier vezne on mount
  const resolveUserVezne = useCallback(
    async (list: VezneItem[]): Promise<VezneItem | undefined> => {
      if (!list || list.length === 0) return undefined;

      if (user?.id) {
        try {
          const userVezneId = await SarrafFisService.getUserVezneId(Number(user.id));
          if (userVezneId) {
            const uv = list.find((v) => v.id === userVezneId);
            if (uv) return uv;
          }
        } catch { }
      }

      if (user?.cashierCode) {
        const target = String(user.cashierCode).toLowerCase().trim();
        const uv = list.find(
          (v) =>
            String(v.id) === target ||
            String(v.kod).toLowerCase() === target
        );
        if (uv) return uv;
      }

      return list[0];
    },
    [user?.id, user?.cashierCode]
  );

  useEffect(() => {
    loadVezneler().then(async (list) => {
      if (list && list.length > 0) {
        const uv = await resolveUserVezne(list);
        if (uv) setSelectedVezne(uv);
      }
    });

    CariService.getCariKartlar()
      .then(setCariler)
      .catch(console.error);

    CariService.getLookups()
      .then(setCariLookups)
      .catch(console.error);

    DovizFisService.getKayitsizMusteriler()
      .then(setKayitsizMusteriler)
      .catch(console.error);

    loadOdemeUrunler();
    loadIskontolar();

    Promise.all([
      KurService.getKurTablosu({ tur: 0 }).catch(() => null),
      KurService.getKurTablosu({ tur: 1 }).catch(() => null),
    ]).then(([anlikRes, gunlukRes]) => {
      const mergedKurMap = new Map<string, any>();
      (gunlukRes?.satirlar || []).forEach((k) => {
        const cCode = (k.kod || "").toUpperCase().trim();
        if (cCode) mergedKurMap.set(cCode, k);
        if (k.paraId) mergedKurMap.set(String(k.paraId), k);
        if (k.ad) mergedKurMap.set(k.ad.toUpperCase().trim(), k);
      });
      (anlikRes?.satirlar || []).forEach((k) => {
        const cCode = (k.kod || "").toUpperCase().trim();
        if (cCode) {
          const existing = mergedKurMap.get(cCode);
          const mergedItem = {
            ...existing,
            ...k,
            efektifAlis: k.efektifAlis ?? existing?.efektifAlis ?? null,
            efektifSatis: k.efektifSatis ?? existing?.efektifSatis ?? null,
            dovizAlis: k.dovizAlis ?? existing?.dovizAlis ?? null,
            dovizSatis: k.dovizSatis ?? existing?.dovizSatis ?? null,
            parite: k.parite ?? existing?.parite ?? null,
          };
          mergedKurMap.set(cCode, mergedItem);
          if (k.paraId) mergedKurMap.set(String(k.paraId), mergedItem);
          if (k.ad) mergedKurMap.set(k.ad.toUpperCase().trim(), mergedItem);
        }
      });
      setKurMap(mergedKurMap);
      const allKurList = Array.from(mergedKurMap.values());
      const hasKurItem = allKurList.find((k) => ["HAS", "ALTIN", "HAS ALTIN", "HASALTIN"].includes((k.kod || "").toUpperCase().trim()));
      const rate = hasKurItem ? Number(hasKurItem.dovizAlis ?? hasKurItem.efektifAlis ?? hasKurItem.dovizSatis ?? hasKurItem.efektifSatis) || 0 : 0;
      if (rate > 0) {
        setAltinHasKuru(rate);
      }
    }).catch(console.error);

    loadProductsForLookup();

    if (isDuzeltmeMode) {
      PerakendeService.listInvoices({ limit: 500 })
        .then(async (res: any) => {
          const rawList = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
          if (rawList.length > 0) {
            const mappedList: PerakendeFaturaListItem[] = rawList.map((f: any) => ({
              faturaId: Number(f.faturaId ?? f.FATURA_ID) || 0,
              vezneId: f.vezneId ?? f.VEZNE_ID ?? null,
              vezneKod: f.vezneKod || f.VEZNE_KOD || "",
              vezneAd: f.vezneAd || f.VEZNE_AD || "",
              faturaNo: f.faturaNo || f.FATURA_NO || "",
              ettn: f.ettn || f.ETTN || "",
              tarih: f.tarih || f.TARIH || new Date().toISOString(),
              faturaTipi: Number(f.faturaTipi ?? f.FATURA_TIPI) === 0 ? 0 : 1,
              senaryo: f.senaryo || f.SENARYO || "EARSIVFATURA",
              cariKartId: f.cariKartId ?? f.CARI_KART_ID ?? null,
              cariKod: f.cariKod || f.CARI_KOD || null,
              cariUnvan: f.cariUnvan || f.CARI_UNVAN || null,
              aliciVknTckn: f.aliciVknTckn || f.ALICI_VKN_TCKN || "",
              aliciUnvan: f.aliciUnvan || f.ALICI_UNVAN || "",
              adres: f.adres || f.ADRES || "",
              ilce: f.ilce || f.ILCE || "",
              il: f.il || f.IL || "",
              vergiDairesi: f.vergiDairesi || f.VERGI_DAIRESI || "",
              eposta: f.eposta || f.EPOSTA || "",
              telefon: f.telefon || f.TELEFON || "",
              paraId: Number(f.paraId ?? f.PARA_ID) || 1,
              paraKodu: f.paraKodu || f.PARA_KODU || "TL",
              kur: Number(f.kur ?? f.KUR) || 1.0,
              araToplam: Number(f.araToplam ?? f.ARA_TOPLAM) || 0,
              toplamKdv: Number(f.toplamKdv ?? f.TOPLAM_KDV) || 0,
              iskontoId: f.iskontoId ?? f.ISKONTO_ID ?? null,
              iskontoKodu: f.iskontoKodu || f.ISKONTO_KODU || null,
              iskontoOrani: Number(f.iskontoOrani ?? f.ISKONTO_ORANI) || 0,
              iskontoTutari: Number(f.iskontoTutari ?? f.ISKONTO_TUTARI) || 0,
              genelToplam: Number(f.genelToplam ?? f.GENEL_TOPLAM) || 0,
              eBelgeDurumu: Number(f.eBelgeDurumu ?? f.E_BELGE_DURUMU) || 0,
              gibStatuKodu: f.gibStatuKodu || f.GIB_STATU_KODU || null,
              ekleyenId: f.ekleyenId ?? f.EKLEYEN_ID ?? null,
              eklemeZamani: f.eklemeZamani || f.EKLEME_ZAMANI || null,
            })).sort((a, b) => (Number(a.faturaId) || 0) - (Number(b.faturaId) || 0));

            setHistoryList(mappedList);
            const lastIdx = mappedList.length - 1;
            const lastInv = mappedList[lastIdx];
            if (lastInv?.faturaId) {
              setCurrentIndex(lastIdx);
              await handleSelectInvoiceForEdit(lastInv.faturaId);
            }
          }
        })
        .catch(console.error);
    }

    setTimeout(() => {
      if (items[0]) {
        focusGridCell(items[0].id, "barkod", "select");
      }
    }, 150);
  }, [loadProductsForLookup, resolveUserVezne, isDuzeltmeMode]);

  // Recalculate Totals for single Cart line item
  const recalculateLine = (line: Partial<CartLineItem>): CartLineItem => {
    const miktar = parseDecimal(line.miktar);
    const birimFiyat = parseDecimal(line.birimFiyat);
    const kdvOrani = parseDecimal(line.kdvOrani);
    const tutar = Math.round(miktar * birimFiyat * 100) / 100;
    const kdvTutari = Math.round(tutar * (kdvOrani / 100) * 100) / 100;
    const toplamTutar = Math.round((tutar + kdvTutari) * 100) / 100;

    return {
      id: line.id || makeId(),
      altinUrunId: line.altinUrunId ?? null,
      barkod: line.barkod || "",
      urunAdi: line.urunAdi || "",
      ayar: line.ayar || "14K",
      miktar: line.miktar === "" ? "" : (line.miktar !== undefined && line.miktar !== null ? line.miktar : (miktar || 1)),
      birim: line.birim || "Adet",
      gram: line.gram === "" ? "" : (parseDecimal(line.gram) || 0),
      hasGram: line.hasGram === "" ? "" : (parseDecimal(line.hasGram) || 0),
      birimFiyat: line.birimFiyat === "" ? "" : birimFiyat,
      tutar: tutar > 0 ? tutar : (line.tutar === "" ? "" : 0),
      kdvOrani: line.kdvOrani === "" ? "" : kdvOrani,
      kdvTutari: kdvTutari > 0 ? kdvTutari : (line.kdvTutari === "" ? "" : 0),
      toplamTutar: toplamTutar > 0 ? toplamTutar : (line.toplamTutar === "" ? "" : 0),
    };
  };

  // Recompute single Payment Row
  const recomputeOdemeRow = (row: OdemeRow, hasKuru: number): OdemeRow => {
    const isMetal = isAltinOrGumusRow(row, odemeUrunList);
    const isIskonto =
      row.paraKodu?.trim().toUpperCase().startsWith("ISK") ||
      row.paraAdi?.toUpperCase().includes("İSKONTO") ||
      row.paraAdi?.toUpperCase().includes("ISKONTO") ||
      (row.paraId !== undefined && row.paraId !== null && Number(row.paraId) >= 100000);

    const miktar = parseDecimal(row.miktar);
    const kur = parseDecimal(row.kur);

    let tutar = parseDecimal(row.tutar);
    let hasGram = parseDecimal(row.hasGram);

    if (isIskonto) {
      // İskonto satırında Kur: Değer / Oran
      const matchedIsk = iskontolar.find(
        (x) =>
          (x.kod && x.kod.toUpperCase() === row.paraKodu?.toUpperCase()) ||
          row.paraId === 100000 + Number(x.iskontoId)
      );

      if (matchedIsk?.iskontoTipi === 1 || (!matchedIsk && kur > 0 && kur <= 100)) {
        // Yüzde (%) Oran
        tutar = Math.round(((brutToplam * kur) / 100) * 100) / 100;
      } else if (matchedIsk?.iskontoTipi === 3) {
        // Altın / Has Gram
        const hasVal = Number(matchedIsk.hasTutar) || miktar;
        tutar = Math.round(hasVal * (hasKuru > 0 ? hasKuru : kur) * 100) / 100;
      } else if (miktar > 0 && kur > 0 && kur !== 1) {
        tutar = Number((miktar * kur).toFixed(2));
      } else if (miktar > 0) {
        tutar = miktar;
      }

      return {
        ...row,
        adet: "",
        milyem: "",
        hasGram: "",
        tutar: tutar > 0 ? Number(tutar.toFixed(2)) : (row.tutar === "" ? "" : 0),
      };
    }

    const isTL = row.paraKodu?.trim().toUpperCase() === "TL" || row.paraKodu?.trim().toUpperCase() === "TRY" || row.paraKodu?.trim().toUpperCase() === "TRL";
    let effectiveKur = kur;
    if (!isTL && effectiveKur <= 0) {
      effectiveKur = Number(hasKuru) || 1;
    }

    if (!isMetal) {
      // Döviz / Nakit / Veresiye: Sadece miktar ve kur çalışır, tutar = miktar * kur. Has Gr gözükmez (boş kalır).
      if (miktar > 0) {
        tutar = isTL ? miktar : (effectiveKur > 0 ? miktar * effectiveKur : miktar);
      } else {
        tutar = 0;
      }

      return {
        ...row,
        adet: "",
        milyem: "",
        hasGram: "",
        kur: isTL ? "" : (row.kur ? row.kur : (effectiveKur > 0 ? effectiveKur : "")),
        tutar: tutar > 0 ? Number(tutar.toFixed(2)) : (row.tutar === "" ? "" : 0),
      };
    } else {
      // Altın / Gümüş: Adet, Miktar, Milyem, Has Gr, Kur, Tutar aktif
      const milyem = parseDecimal(row.milyem);
      if (milyem > 0 && miktar > 0) {
        hasGram = miktar * (milyem / 1000);
        tutar = kur > 0 ? miktar * kur : (hasKuru > 0 ? hasGram * hasKuru : 0);
      } else if (miktar > 0) {
        tutar = kur > 0 ? miktar * kur : (hasKuru > 0 ? miktar * hasKuru : 0);
        hasGram = hasKuru > 0 && tutar > 0 ? tutar / hasKuru : 0;
      }

      return {
        ...row,
        kur: isTL ? "" : (row.kur ? row.kur : (hasKuru > 0 ? hasKuru : "")),
        hasGram: hasGram > 0 ? Number(hasGram.toFixed(4)) : (row.hasGram === "" ? "" : 0),
        tutar: tutar > 0 ? Number(tutar.toFixed(2)) : (row.tutar === "" ? "" : 0),
      };
    }
  };

  // Add Product to Cart with automatic focus on miktar
  const addProductToCart = (product: {
    altinUrunId?: number | null;
    barkod: string;
    urunAdi: string;
    ayar?: string | null;
    miktar?: number;
    birim?: string;
    gram?: number;
    hasGram?: number;
    satisFiyati?: number;
    kdvOrani?: number;
  }) => {
    const populated = recalculateLine({
      altinUrunId: product.altinUrunId ?? null,
      barkod: product.barkod,
      urunAdi: product.urunAdi || "Altın Ürün",
      ayar: product.ayar || "14K",
      miktar: product.miktar || 1,
      birim: product.birim || "Adet",
      gram: product.gram || 0,
      hasGram: product.hasGram || 0,
      birimFiyat: product.satisFiyati || 0,
      kdvOrani: product.kdvOrani ?? 0,
    });

    setItems((prev) => {
      const emptyIdx = prev.findIndex(
        (r) => !r.barkod?.trim() && !r.urunAdi?.trim() && (!r.birimFiyat || Number(r.birimFiyat) === 0)
      );

      if (emptyIdx >= 0) {
        const next = [...prev];
        next[emptyIdx] = { ...populated, id: prev[emptyIdx].id };
        setActiveRowIndex(emptyIdx);
        setTimeout(() => focusGridCell(prev[emptyIdx].id, "miktar", "select"), 50);
        return next;
      } else {
        const newRow = { ...populated, id: makeId() };
        const next = [...prev, newRow];
        setActiveRowIndex(next.length - 1);
        setTimeout(() => focusGridCell(newRow.id, "miktar", "select"), 50);
        return next;
      }
    });
  };

  // Open Product Lookup Modal Helper
  const openProductLookup = (rowId: string, initialTerm?: string) => {
    const row = items.find((r) => r.id === rowId);
    const search = initialTerm !== undefined ? initialTerm.trim() : (String(row?.barkod || "")).trim();
    lastModalCallerRef.current = "productLookup";
    lastProductRowIdRef.current = rowId;
    activeProductRowIdRef.current = rowId;
    setActiveProductRowId(rowId);
    setProductSearchTerm(search);
    setShowProductLookup(true);
  };

  // Product Selection from Dürbün (LookupModal)
  type ProductLookupType = "altin" | "ozel" | "para";
  type ProductLookupEntry = { tip: ProductLookupType; item: AltinUrunItem | OzelUrunItem | UrunItem };

  const handleSelectFromProductLookup = async (
    item: ProductLookupEntry
  ) => {
    let barcode = "";
    let urunAdi = "";
    let ayar = "14K";
    let miktar = 1;
    let birim = "Adet";
    let gram = 0;
    let hasGram = 0;
    let birimFiyat = 0;

    if (item.tip === "para") {
      const rawPara = item.item as UrunItem;
      barcode = ""; // Barkodsuz ürün
      urunAdi = rawPara.ad || rawPara.kod;
      ayar = rawPara.kod;
      const isGramType = Number(rawPara.urunTipi) === 0 || (Number(rawPara.urunTipi) === 2 && (!rawPara.gramaj || rawPara.gramaj === 1));
      birim = isGramType ? "Gram" : "Adet";
      gram = Number(rawPara.gramaj) || (isGramType ? 1 : 0);
      hasGram = Number(rawPara.hasOrani) || 0;

      const kur = getKurForProduct(rawPara, faturaTipi === 2 ? 0 : 1);
      birimFiyat = Number(rawPara.satisFiyati) || (kur > 0 ? kur : 0);
    } else {
      const raw = item.item as AltinUrunItem | OzelUrunItem;
      barcode = raw.barkod || `${raw.grupKodu || ""}${raw.urunNo || ""}`;
      urunAdi =
        item.tip === "altin"
          ? (raw as AltinUrunItem).model || "Altın Takı / Ziynet"
          : (raw as OzelUrunItem).mamulTipi || "Özel Ürün";

      hasGram = Number((raw as any).hasGram) || 0;
      gram = Number((raw as any).gram) || (hasGram > 0 ? Number((hasGram * 1.05).toFixed(2)) : (Number(raw.miktar) || 1));
      ayar = raw.ayar || "14K";
      birim = (raw as any).birim || "Adet";
      birimFiyat = Number(raw.satisFiyati) || 0;
    }

    const targetRowId = activeProductRowIdRef.current || activeProductRowId || lastProductRowIdRef.current;

    setItems((prev) => {
      let targetIdx = -1;
      if (targetRowId) {
        targetIdx = prev.findIndex((r) => r.id === targetRowId);
      }
      if (targetIdx === -1 && typeof activeRowIndex === "number" && activeRowIndex >= 0 && activeRowIndex < prev.length) {
        targetIdx = activeRowIndex;
      }
      if (targetIdx === -1) {
        targetIdx = prev.findIndex(
          (r) => !r.barkod?.trim() && !r.urunAdi?.trim() && (!r.birimFiyat || Number(r.birimFiyat) === 0)
        );
      }
      if (targetIdx === -1) {
        targetIdx = prev.length > 0 ? prev.length - 1 : 0;
      }

      const existingRow = prev[targetIdx] || createEmptyRow();
      const populated = recalculateLine({
        ...existingRow,
        altinUrunId: item.tip === "para" ? null : ((item.item as any).altinUrunId ?? null),
        barkod: barcode,
        urunAdi,
        ayar,
        miktar: miktar || 1,
        birim,
        gram,
        hasGram,
        birimFiyat,
        kdvOrani: 0,
      });

      const next = prev.length > 0 ? [...prev] : [existingRow];
      next[targetIdx] = { ...populated, id: existingRow.id };

      setActiveRowIndex(targetIdx);
      setTimeout(() => focusGridCell(existingRow.id, item.tip === "para" ? "miktar" : "birimFiyat", "select"), 50);

      return next;
    });

    setShowProductLookup(false);
    setActiveProductRowId(null);
    activeProductRowIdRef.current = null;
    lastProductRowIdRef.current = null;
    setProductSearchTerm("");
  };

  // Merchandise para/döviz/sarrafiye listesi (TL / Nakit para ve banka/pos ödeme araçları hariç)
  const paraMerchandiseList = (odemeUrunList || []).filter(
    (u) =>
      u.kod &&
      !["TL", "TRY", "TRL", "TÜRK LİRASI", "TURK LIRASI", "POS", "HAVALE", "EFT", "KREDİ KARTI", "KREDI KARTI"].includes(
        u.kod.toUpperCase().trim()
      )
  );

  // Combined Lookup Items for Product Search Modal (Barkodlu Altın, Özel Ürün ve Barkodsuz Para/Döviz/Sarrafiye)
  const combinedLookupItems: ProductLookupEntry[] = [
    ...altinList.map((it) => ({ tip: "altin" as const, item: it })),
    ...ozelList.map((it) => ({ tip: "ozel" as const, item: it })),
    ...paraMerchandiseList.map((it) => ({ tip: "para" as const, item: it })),
  ];

  const productLookupColumns: LookupColumn<ProductLookupEntry>[] = [
    {
      header: "Tip",
      width: "85px",
      align: "center",
      render: (it) => (
        <Badge
          bg={it.tip === "altin" ? "warning" : it.tip === "ozel" ? "info" : "success"}
          className="text-dark fw-bold"
        >
          {it.tip === "altin" ? "Altın" : it.tip === "ozel" ? "Özel" : "Para/Sarraf"}
        </Badge>
      ),
    },
    {
      header: "Barkod / Kod",
      width: "125px",
      render: (it) => {
        if (it.tip === "para") {
          return (
            <span className="font-monospace fw-bold text-success">
              {(it.item as UrunItem).kod || "-"}
            </span>
          );
        }
        return (
          <span className="font-monospace fw-bold text-primary">
            {(it.item as AltinUrunItem | OzelUrunItem).barkod || "-"}
          </span>
        );
      },
    },
    {
      header: "Açıklama / Model / Tanım",
      render: (it) => {
        if (it.tip === "para") {
          const p = it.item as UrunItem;
          return p.ad || p.kod || "-";
        }
        return (
          (it.tip === "altin"
            ? (it.item as AltinUrunItem).model
            : (it.item as OzelUrunItem).mamulTipi) || "-"
        );
      },
    },
    {
      header: "Ayar",
      width: "85px",
      align: "center",
      render: (it) => {
        if (it.tip === "para") {
          const p = it.item as UrunItem;
          return (
            <Badge bg="light" text="dark" className="border">
              {p.hasOrani ? `${p.hasOrani} Has` : p.kod}
            </Badge>
          );
        }
        return <Badge bg="light" text="dark" className="border">{(it.item as any).ayar || "-"}</Badge>;
      },
    },
    {
      header: "Gram / Miktar",
      width: "100px",
      align: "right",
      render: (it) => {
        if (it.tip === "para") {
          const p = it.item as UrunItem;
          return (
            <span className="font-monospace">
              {Number(p.gramaj) > 0
                ? `${Number(p.gramaj).toFixed(2)} gr`
                : (p.urunTipi === 0 ? "1.00 gr" : "1 Adet")}
            </span>
          );
        }
        return (
          <span className="font-monospace">
            {it.tip === "altin" ? (it.item as AltinUrunItem).miktar || "-" : (it.item as OzelUrunItem).miktar || "-"}
          </span>
        );
      },
    },
    {
      header: "Fiyat",
      width: "115px",
      align: "right",
      render: (it) => {
        let price = 0;
        if (it.tip === "para") {
          const p = it.item as UrunItem;
          const kur = getKurForProduct(p, faturaTipi === 2 ? 0 : 1);
          price = Number(p.satisFiyati) || (kur > 0 ? kur : 0);
        } else {
          price = Number((it.item as any).satisFiyati || 0);
        }
        return (
          <strong className="text-success font-monospace">
            {price > 0 ? `${price.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺` : "-"}
          </strong>
        );
      },
    },
  ];

  // Valid non-empty items
  const validItems = items.filter(
    (i) => (i.barkod && i.barkod.trim()) || (i.urunAdi && i.urunAdi.trim()) || Number(i.birimFiyat) > 0
  );

  // Grand totals calculation
  const totalQuantity = validItems.reduce((acc, i) => acc + (parseDecimal(i.miktar) || 0), 0);
  const totalGrams = validItems.reduce((acc, i) => acc + (Number(i.gram) || 0), 0);
  const totalHasGrams = validItems.reduce((acc, i) => acc + (Number(i.hasGram) || 0), 0);
  const araToplam = validItems.reduce((acc, i) => acc + (Number(i.tutar) || 0), 0);
  const toplamKdv = validItems.reduce((acc, i) => acc + (Number(i.kdvTutari) || 0), 0);
  const brutToplam = araToplam + toplamKdv;

  // Selected iskonto calculation & limits
  const selectedIskonto =
    iskontolar.find((x) => x.iskontoId === selectedIskontoId) ||
    (iskontoKodu.trim()
      ? iskontolar.find(
        (x) =>
          (x.kod && x.kod.toLowerCase() === iskontoKodu.trim().toLowerCase()) ||
          (x.tanim && x.tanim.toLowerCase() === iskontoKodu.trim().toLowerCase())
      )
      : null) ||
    null;

  let calculatedIskontoTutari = 0;
  let calculatedIskontoOrani = 0;

  if (selectedIskonto) {
    const minReq = Number(selectedIskonto.minTutar) || 0;
    if (minReq <= 0 || brutToplam >= minReq) {
      if (selectedIskonto.iskontoTipi === 1) {
        // Yüzde (%)
        const oranVal = Number(selectedIskonto.oran) || 0;
        calculatedIskontoOrani = oranVal;
        calculatedIskontoTutari = Math.round(((brutToplam * oranVal) / 100) * 100) / 100;
      } else if (selectedIskonto.iskontoTipi === 2) {
        // Sabit Tutar (TL)
        const tutarVal = Number(selectedIskonto.tutar) || 0;
        calculatedIskontoTutari = Math.min(brutToplam, tutarVal);
        calculatedIskontoOrani = brutToplam > 0 ? Math.round((calculatedIskontoTutari / brutToplam) * 10000) / 100 : 0;
      } else if (selectedIskonto.iskontoTipi === 3) {
        // Has Gram
        const hasVal = Number(selectedIskonto.hasTutar) || 0;
        const hasKur = Number(altinHasKuru) || 0;
        const tutarVal = Math.round(hasVal * hasKur * 100) / 100;
        calculatedIskontoTutari = Math.min(brutToplam, tutarVal);
        calculatedIskontoOrani = brutToplam > 0 ? Math.round((calculatedIskontoTutari / brutToplam) * 10000) / 100 : 0;
      } else {
        // Serbest / Diğer
        calculatedIskontoTutari = Number(iskontoTutari) || 0;
        calculatedIskontoOrani =
          Number(iskontoOrani) ||
          (brutToplam > 0 ? Math.round((calculatedIskontoTutari / brutToplam) * 10000) / 100 : 0);
      }

      // Max Iskonto Tutari Cap Check
      const maxCap = Number(selectedIskonto.maxIskontoTutari) || 0;
      if (maxCap > 0 && calculatedIskontoTutari > maxCap) {
        calculatedIskontoTutari = maxCap;
      }
    }
  } else if (iskontoTutari > 0 || iskontoOrani > 0) {
    // Serbest / manual entry or loaded from existing invoice
    if (iskontoOrani > 0) {
      calculatedIskontoOrani = Number(iskontoOrani);
      calculatedIskontoTutari = Math.round(((brutToplam * iskontoOrani) / 100) * 100) / 100;
    } else {
      calculatedIskontoTutari = Math.min(brutToplam, Number(iskontoTutari) || 0);
      calculatedIskontoOrani =
        brutToplam > 0 ? Math.round((calculatedIskontoTutari / brutToplam) * 10000) / 100 : 0;
    }
  }

  const genelToplam = Math.max(0, Math.round((brutToplam - calculatedIskontoTutari) * 100) / 100);

  // Payment totals calculation
  const totalOdemeAdet = odemeRows.reduce((s, r) => s + (parseDecimal(r.adet) || 0), 0);
  const totalOdemeMiktar = odemeRows.reduce((s, r) => s + (parseDecimal(r.miktar) || 0), 0);
  const totalOdemeHas = odemeRows.reduce((s, r) => s + (parseDecimal(r.hasGram) || 0), 0);
  const totalOdemeTutar = odemeRows.reduce((s, r) => s + (parseDecimal(r.tutar) || 0), 0);

  const farkTL = genelToplam - totalOdemeTutar;
  const farkHas = totalHasGrams - totalOdemeHas;

  const iskontoLookupColumns: LookupColumn<IskontoItem>[] = [
    {
      header: "İskonto Kodu",
      width: "110px",
      render: (item) => {
        const minReq = Number(item.minTutar) || 0;
        const isEligible = minReq === 0 || brutToplam >= minReq;
        return (
          <span className={`font-monospace fw-bold ${isEligible ? "text-dark" : "text-muted opacity-50"}`}>
            {item.kod || "-"}
          </span>
        );
      },
    },
    {
      header: "İskonto Tanımı",
      render: (item) => {
        const minReq = Number(item.minTutar) || 0;
        const isEligible = minReq === 0 || brutToplam >= minReq;
        return (
          <span className={isEligible ? "fw-semibold" : "text-muted opacity-50"}>
            {item.tanim}
          </span>
        );
      },
    },
    {
      header: "Tipi",
      width: "110px",
      align: "center",
      render: (item) => {
        const minReq = Number(item.minTutar) || 0;
        const isEligible = minReq === 0 || brutToplam >= minReq;
        const opacityClass = isEligible ? "" : "opacity-50";
        if (item.iskontoTipi === 1) return <Badge bg="info" className={`text-dark ${opacityClass}`}>Yüzde (%)</Badge>;
        if (item.iskontoTipi === 2) return <Badge bg="primary" className={opacityClass}>Sabit Tutar</Badge>;
        if (item.iskontoTipi === 3) return <Badge bg="warning" className={`text-dark ${opacityClass}`}>Has Gram</Badge>;
        return <Badge bg="secondary" className={opacityClass}>Serbest</Badge>;
      },
    },
    {
      header: "Değer / Oran",
      width: "110px",
      align: "right",
      render: (item) => {
        const minReq = Number(item.minTutar) || 0;
        const isEligible = minReq === 0 || brutToplam >= minReq;
        if (!isEligible) {
          if (item.iskontoTipi === 1) return <span className="font-monospace text-muted opacity-50">%{item.oran}</span>;
          if (item.iskontoTipi === 2) return <span className="font-monospace text-muted opacity-50">{item.tutar?.toLocaleString("tr-TR")} ₺</span>;
          if (item.iskontoTipi === 3) return <span className="font-monospace text-muted opacity-50">{item.hasTutar} Gr</span>;
          return "-";
        }
        if (item.iskontoTipi === 1) return <span className="font-monospace fw-bold text-primary">%{item.oran}</span>;
        if (item.iskontoTipi === 2) return <span className="font-monospace fw-bold text-success">{item.tutar?.toLocaleString("tr-TR")} ₺</span>;
        if (item.iskontoTipi === 3) return <span className="font-monospace fw-bold text-warning">{item.hasTutar} Gr Has</span>;
        return "-";
      },
    },
    {
      header: "Min. Fiş Tutarı",
      width: "120px",
      align: "right",
      render: (item) => {
        const minReq = Number(item.minTutar) || 0;
        const isEligible = minReq === 0 || brutToplam >= minReq;
        return minReq ? (
          <span className={`font-monospace ${isEligible ? "text-dark" : "text-danger opacity-75"}`}>
            {minReq.toLocaleString("tr-TR")} ₺
          </span>
        ) : (
          <span className="text-muted">-</span>
        );
      },
    },
    {
      header: "Durum",
      width: "110px",
      align: "center",
      render: (item) => {
        const minReq = Number(item.minTutar) || 0;
        const isEligible = minReq === 0 || brutToplam >= minReq;
        return isEligible ? (
          <Badge bg="success-subtle" className="text-success border border-success-subtle">
            Uygun
          </Badge>
        ) : (
          <Badge bg="secondary" className="opacity-50">
            Yetersiz Tutar
          </Badge>
        );
      },
    },
  ];

  // Boş kalem satırlarını otomatik temizleme (İlk satır - index 0 daima korunur)
  const cleanupEmptyRows = useCallback((keepActiveIndex?: number | null) => {
    setItems((prev) => {
      if (prev.length <= 1) return prev;
      const filtered = prev.filter((r, idx) => {
        if (idx === 0) return true; // İlk satır daima korunur
        if (typeof keepActiveIndex === "number" && idx === keepActiveIndex) return true;
        return !isRowEmpty(r);
      });
      if (filtered.length === prev.length) return prev;
      return filtered.length > 0 ? filtered : [createEmptyRow()];
    });
  }, []);

  // Boş ödeme satırlarını otomatik temizleme (İlk satır - index 0 daima korunur)
  const cleanupEmptyOdemeRows = useCallback((keepActiveIndex?: number | null) => {
    setOdemeRows((prev) => {
      if (prev.length <= 1) return prev;
      const filtered = prev.filter((r, idx) => {
        if (idx === 0) return true; // İlk satır daima korunur
        if (typeof keepActiveIndex === "number" && idx === keepActiveIndex) return true;
        return !isOdemeRowEmpty(r);
      });
      if (filtered.length === prev.length) return prev;
      return filtered.length > 0 ? filtered.map((r, i) => ({ ...r, satirNo: i + 1 })) : [createEmptyOdemeRow(1)];
    });
  }, []);

  const isAnyModalOpen = Boolean(
    showMusteriModal ||
    showHistoryModal ||
    showOdemeUrunModal ||
    showIskontoModal ||
    showPrintModal ||
    showMusteriDetayModal ||
    showVezneModal ||
    showProductLookup ||
    showAyarModal ||
    showMasakLimitWarningModal ||
    showNewProductModal ||
    showNewVezneModal ||
    showNewIskontoModal ||
    masakModalOpen
  );

  // Tablolardan farklı bir yere tıklandığında tamamen boş satırları otomatik temizle (İlk satır korunur)
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (isAnyModalOpen) return;

      const isInsideKalemler = Boolean(target.closest('[data-table-type="kalemler"]'));
      const isInsideOdeme = Boolean(target.closest('[data-table-type="odeme"]'));

      if (!isInsideKalemler) {
        cleanupEmptyRows(null);
      }
      if (!isInsideOdeme) {
        cleanupEmptyOdemeRows(null);
      }
    };

    document.addEventListener("mousedown", handleGlobalClick);
    return () => document.removeEventListener("mousedown", handleGlobalClick);
  }, [cleanupEmptyRows, cleanupEmptyOdemeRows, isAnyModalOpen]);

  // Table Grid Cell Modification Handler
  const handleUpdateItem = (rowId: string, field: keyof CartLineItem, value: any) => {
    setItems((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const isBarkodlu = Boolean((r.barkod && String(r.barkod).trim()) || r.altinUrunId);
        // Barkodlu üründe sadece miktar değiştirilebilir; diğer alanlar sabittir
        if (isBarkodlu && (field === "gram" || field === "hasGram" || field === "ayar" || field === "birim" || field === "urunAdi" || field === "birimFiyat" || field === "kdvOrani")) {
          return r;
        }
        let valToSet = value;
        if (field === "miktar") {
          valToSet = formatMiktar(value);
        }
        const updated = { ...r, [field]: valToSet };
        if (field === "barkod" && !String(value).trim()) {
          updated.altinUrunId = null;
        }
        return recalculateLine(updated);
      })
    );
  };

  // Insert Row Handler
  const handleAddPerakendeRow = useCallback((afterIndex?: number) => {
    const newRow = createEmptyRow();
    setItems((prev) => {
      if (typeof afterIndex === "number" && afterIndex >= 0) {
        const next = [...prev];
        next.splice(afterIndex + 1, 0, newRow);
        return next;
      }
      return [...prev, newRow];
    });

    setTimeout(() => {
      focusGridCell(newRow.id, "barkod", "select");
    }, 50);
    return true;
  }, []);

  // Keyboard Navigation across Table Grid Cells
  const handleGridKeyDown = (
    e: React.KeyboardEvent<HTMLElement>,
    rowIndex: number,
    colKey: GridColKey,
    rowId: string
  ) => {
    const colIdx = GRID_COLS.indexOf(colKey);
    const totalCols = GRID_COLS.length;
    const { isAtStart, isAtEnd } = getSelectionBounds(e.currentTarget);

    // ESC altındaki " tuşuna basınca üst satırdaki hücre değerini kopyala (Sadece tablolarda geçerli)
    if (e.key === '"' || e.key === '“' || e.key === '”' || e.key === '„' || e.key === '«' || e.key === '»' || e.key === 'é' || e.key === 'É' || e.key === '`' || e.key === '´' || e.key === '§' || e.code === "Backquote" || (e.code === "Digit2" && e.shiftKey) || e.keyCode === 222 || e.keyCode === 192) {
      e.preventDefault();
      e.stopPropagation();
      if (rowIndex > 0) {
        const prevRow = items[rowIndex - 1];
        const prevVal = prevRow[colKey as keyof CartLineItem];
        handleUpdateItem(rowId, colKey as keyof CartLineItem, prevVal !== undefined && prevVal !== null ? prevVal : "");
        setTimeout(() => focusGridCell(rowId, colKey, "select"), 20);
      }
      return;
    }

    if (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) {
      e.preventDefault();

      // If user typed a barcode/code in the barcode cell and pressed enter, resolve it or open lookup
      if (colKey === "barkod") {
        const row = items[rowIndex];
        const val = (String(row.barkod) || "").trim();
        if (val) {
          PerakendeService.getProductByBarcode(val)
            .then((product) => {
              if (product) {
                const populated = recalculateLine({
                  ...row,
                  altinUrunId: product.altinUrunId,
                  barkod: product.barkod,
                  urunAdi: product.urunAdi || "Altın Ürün",
                  ayar: product.ayar || "14K",
                  miktar: product.miktar || 1,
                  birim: product.birim || "Adet",
                  gram: product.gram || 0,
                  hasGram: product.hasGram || 0,
                  birimFiyat: product.satisFiyati || 0,
                  kdvOrani: product.kdvOrani ?? 0,
                });

                setItems((prev) => prev.map((r, i) => (i === rowIndex ? populated : r)));
                setActiveRowIndex(rowIndex);
                setTimeout(() => focusGridCell(row.id, "miktar", "select"), 50);
              } else {
                openProductLookup(rowId, val);
              }
            })
            .catch(() => {
              openProductLookup(rowId, val);
            });
          return;
        } else {
          // Boş ise dürbün açılmaz, bir sonraki alana geçilir
          focusGridCell(rowId, "urunAdi", "select");
          return;
        }
      }

      if (colKey === "ayar") {
        const row = items[rowIndex];
        const val = (String(row.ayar) || "").trim();
        if (!val) {
          setActiveAyarRowId(rowId);
          setShowAyarModal(true);
          return;
        }
      }

      const currentRow = items[rowIndex];
      const isRowBarkodlu = Boolean((currentRow?.barkod && String(currentRow.barkod).trim()) || currentRow?.altinUrunId);

      // Next column in same row
      if (colIdx + 1 < totalCols) {
        const nk = GRID_COLS[colIdx + 1];
        focusGridCell(rowId, nk, "select");
      } else {
        // Last column in row -> jump to next row or create a new row via handleAddPerakendeRow
        if (rowIndex < items.length - 1) {
          const nr = items[rowIndex + 1];
          cleanupEmptyRows(rowIndex + 1);
          setActiveRowIndex(rowIndex + 1);
          focusGridCell(nr.id, "barkod", "select");
        } else {
          handleAddPerakendeRow();
        }
      }
    } else if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault();
      const currentRow = items[rowIndex];
      const isRowBarkodlu = Boolean((currentRow?.barkod && String(currentRow.barkod).trim()) || currentRow?.altinUrunId);

      if ((colKey === "birimFiyat" || colKey === "kdvOrani") && isRowBarkodlu) {
        focusGridCell(rowId, "miktar", "select");
      } else if (colKey === "miktar" && isRowBarkodlu) {
        focusGridCell(rowId, "barkod", "select");
      } else if (colIdx > 0) {
        const pk = GRID_COLS[colIdx - 1];
        focusGridCell(rowId, pk, "select");
      } else if (rowIndex > 0) {
        const pr = items[rowIndex - 1];
        cleanupEmptyRows(rowIndex - 1);
        setActiveRowIndex(rowIndex - 1);
        focusGridCell(pr.id, GRID_COLS[totalCols - 1], "select");
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (rowIndex < items.length - 1) {
        const nr = items[rowIndex + 1];
        cleanupEmptyRows(rowIndex + 1);
        setActiveRowIndex(rowIndex + 1);
        focusGridCell(nr.id, colKey, "select");
      } else {
        handleAddPerakendeRow();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (rowIndex > 0) {
        const pr = items[rowIndex - 1];
        cleanupEmptyRows(rowIndex - 1);
        setActiveRowIndex(rowIndex - 1);
        focusGridCell(pr.id, colKey, "select");
      }
    } else if (e.key === "ArrowRight") {
      if (isAtEnd) {
        e.preventDefault();
        if (colIdx + 1 < totalCols) {
          focusGridCell(rowId, GRID_COLS[colIdx + 1], "select");
        } else if (rowIndex < items.length - 1) {
          const nr = items[rowIndex + 1];
          cleanupEmptyRows(rowIndex + 1);
          setActiveRowIndex(rowIndex + 1);
          focusGridCell(nr.id, "barkod", "select");
        } else {
          handleAddPerakendeRow();
        }
      }
    } else if (e.key === "ArrowLeft") {
      if (isAtStart) {
        e.preventDefault();
        if (colIdx > 0) {
          focusGridCell(rowId, GRID_COLS[colIdx - 1], "select");
        } else if (rowIndex > 0) {
          const pr = items[rowIndex - 1];
          cleanupEmptyRows(rowIndex - 1);
          setActiveRowIndex(rowIndex - 1);
          focusGridCell(pr.id, GRID_COLS[totalCols - 1], "select");
        }
      }
    } else if (e.key === "F4" || (e.key === "Enter" && colKey === "barkod" && !items[rowIndex]?.barkod)) {
      e.preventDefault();
      if (colKey === "barkod") {
        openProductLookup(rowId, (String(items[rowIndex]?.barkod) || "").trim());
      } else if (colKey === "ayar") {
        setActiveAyarRowId(rowId);
        setShowAyarModal(true);
      }
    }
  };

  // Payment Grid Update Handler
  const updateOdemeRow = useCallback((rowId: string, field: keyof OdemeRow, value: any) => {
    setOdemeRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        let sanitizedValue = value;
        if (field === "adet") {
          sanitizedValue = value.replace(/\D/g, "");
        } else if (field === "miktar") {
          sanitizedValue = formatMiktar(value);
        }
        const updated = { ...r, [field]: sanitizedValue };
        if (field === "tutar") {
          const tVal = parseDecimal(sanitizedValue);
          const kVal = parseDecimal(r.kur) || 1;
          const isMetal = isAltinOrGumusRow(r, odemeUrunList);
          if (!isMetal && tVal > 0 && kVal > 0) {
            updated.miktar = formatMiktar(Number((tVal / kVal).toFixed(4)));
          }
        }
        return recomputeOdemeRow(updated, altinHasKuru);
      })
    );
  }, [altinHasKuru, odemeUrunList]);

  // Helper: Ürün / Döviz / Maden için Güncel Alış/Satış Kurunu Çek
  const getKurForProduct = useCallback((
    urun: { paraId?: number | null; kod?: string; ad?: string; urunTipi?: number; alisFiyati?: number; satisFiyati?: number },
    islemTip: 0 | 1 // 0: Alış, 1: Satış
  ): number => {
    const code = (urun.kod || "").toUpperCase().trim();
    if (code === "TL" || code === "TRY" || code === "TRL") return 1;

    const allList = Array.from(kurMap.values());
    const found = allList.find((k) => 
      (urun.paraId && k.paraId === urun.paraId) || 
      (k.kod && k.kod.toUpperCase().trim() === code) ||
      (urun.ad && k.tanim && k.tanim.toUpperCase().trim() === urun.ad.toUpperCase().trim())
    );

    if (found) {
      const rate = islemTip === 0
        ? (found.efektifAlis ?? found.dovizAlis ?? found.efektifSatis ?? found.dovizSatis ?? 0)
        : (found.efektifSatis ?? found.dovizSatis ?? found.efektifAlis ?? found.dovizAlis ?? 0);
      if (Number(rate) > 0) return Number(rate);
    }

    const isGumus = code.includes("GUMUS") || code.includes("GÜMÜŞ") || (urun.ad || "").toUpperCase().includes("GÜMÜŞ") || (urun.ad || "").toUpperCase().includes("GUMUS") || urun.urunTipi === 3;
    if (isGumus) {
      const gKur = allList.find((k) => ["GUMUS", "GÜMÜŞ", "HAS GÜMÜŞ", "HAS GUMUS"].includes((k.kod || "").toUpperCase().trim()));
      if (gKur) {
        const rate = islemTip === 0 ? (gKur.efektifAlis ?? gKur.dovizAlis ?? 0) : (gKur.efektifSatis ?? gKur.dovizSatis ?? 0);
        if (Number(rate) > 0) return Number(rate);
      }
      return 1;
    }

    const isAltin = isAltinOrGumusRow({ paraKodu: code, paraAdi: urun.ad || "" }, odemeUrunList) || urun.urunTipi === 2 || urun.urunTipi === 1;
    if (isAltin) {
      const hasKur = allList.find((k) => ["HAS", "ALTIN", "HAS ALTIN", "HASALTIN"].includes((k.kod || "").toUpperCase().trim()));
      if (hasKur) {
        const rate = islemTip === 0 ? (hasKur.efektifAlis ?? hasKur.dovizAlis ?? 0) : (hasKur.efektifSatis ?? hasKur.dovizSatis ?? 0);
        if (Number(rate) > 0) return Number(rate);
      }
      if (Number(altinHasKuru) > 0) return Number(altinHasKuru);
    }

    if (code) {
      const curKur = allList.find((k) => (k.kod && k.kod.toUpperCase().trim() === code) || (urun.paraId && k.paraId === urun.paraId));
      if (curKur) {
        const rate = islemTip === 0 ? (curKur.efektifAlis ?? curKur.dovizAlis ?? 0) : (curKur.efektifSatis ?? curKur.dovizSatis ?? 0);
        if (Number(rate) > 0) return Number(rate);
      }
    }

    if (Number(urun.satisFiyati) > 0 || Number(urun.alisFiyati) > 0) {
      return islemTip === 0 ? (Number(urun.alisFiyati) || Number(urun.satisFiyati) || 1) : (Number(urun.satisFiyati) || Number(urun.alisFiyati) || 1);
    }

    return 1;
  }, [kurMap, odemeUrunList, altinHasKuru]);

  // Apply selected Currency / Product / Iskonto to Payment Row
  const applyProductToOdemeRow = useCallback((rowId: string, item: UrunItem) => {
    setOdemeRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const isTL = item.kod.toUpperCase() === "TL" || item.kod.toUpperCase() === "TRY";
        const isVeresiye =
          item.kod.toUpperCase() === "VERESIYE" ||
          item.kod.toUpperCase() === "ACIKHESAP" ||
          item.kod.toUpperCase() === "VERESİYE" ||
          item.kod.toUpperCase() === "AÇIK HESAP";

        const rawIsk =
          (item as any).rawIskonto ||
          iskontolar.find((x) => x.kod && x.kod.toLowerCase() === item.kod.trim().toLowerCase());
        const isIskonto = Boolean(rawIsk || (item as any).isIskonto || item.urunTipi === 99 || item.kod.toUpperCase().startsWith("ISK"));

        // İskonto seçildiyse: tutarı hesapla ve ödeme satırına aktar
        if (isIskonto && rawIsk) {
          let discountAmount = 0;
          if (rawIsk.iskontoTipi === 1) {
            // Yüzde (%)
            const oranVal = Number(rawIsk.oran) || 0;
            discountAmount = Math.round(((brutToplam * oranVal) / 100) * 100) / 100;
          } else if (rawIsk.iskontoTipi === 2) {
            // Sabit Tutar (TL)
            const tutarVal = Number(rawIsk.tutar) || 0;
            discountAmount = Math.min(brutToplam, tutarVal);
          } else if (rawIsk.iskontoTipi === 3) {
            // Altın / Has Gram
            const hasVal = Number(rawIsk.hasTutar) || 0;
            const hasKur = Number(altinHasKuru) || 1;
            discountAmount = Math.min(brutToplam, Math.round(hasVal * hasKur * 100) / 100);
          } else {
            discountAmount = Number(rawIsk.tutar) || 0;
          }

          const maxCap = Number(rawIsk.maxIskontoTutari) || 0;
          if (maxCap > 0 && discountAmount > maxCap) {
            discountAmount = maxCap;
          }

          let iskKurVal: number | string = 1;
          if (rawIsk.iskontoTipi === 1) {
            iskKurVal = Number(rawIsk.oran) || 0;
          } else if (rawIsk.iskontoTipi === 2) {
            iskKurVal = Number(rawIsk.tutar) || 0;
          } else if (rawIsk.iskontoTipi === 3) {
            iskKurVal = Number(altinHasKuru) || 1;
          } else if (rawIsk.oran) {
            iskKurVal = Number(rawIsk.oran) || 0;
          } else if (rawIsk.tutar) {
            iskKurVal = Number(rawIsk.tutar) || 0;
          }

          return {
            ...r,
            paraId: item.paraId || item.id,
            paraKodu: item.kod,
            paraAdi: item.ad,
            adet: "",
            miktar: discountAmount > 0 ? discountAmount : "",
            milyem: "",
            kur: iskKurVal,
            tutar: discountAmount > 0 ? discountAmount : "",
            hasGram: "",
          };
        }

        const isMetal = isAltinOrGumusRow({ paraKodu: item.kod, paraAdi: item.ad }, odemeUrunList);

        let milyemVal = "";
        let kurVal = 1;

        if (isMetal) {
          const effAlis = Number(item.alisMilyem) > 0 ? Number(item.alisMilyem) : (Number((item as any).hasAlisKatsayisi) > 0 ? Number((item as any).hasAlisKatsayisi) : (Number(item.hasOrani) || 1000));
          const effSatis = Number(item.satisMilyem) > 0 ? Number(item.satisMilyem) : (Number((item as any).hasSatisKatsayisi) > 0 ? Number((item as any).hasSatisKatsayisi) : (Number(item.hasOrani) || 1000));
          if (faturaTipi === 1) {
            milyemVal = String(effSatis);
          } else {
            milyemVal = String(effAlis);
          }

          kurVal = getKurForProduct(item, faturaTipi === 1 ? 1 : 0);
        } else if (isTL || isVeresiye) {
          kurVal = 1;
        } else {
          kurVal = getKurForProduct(item, faturaTipi === 1 ? 1 : 0);
        }

        let updated: OdemeRow = {
          ...r,
          paraId: item.paraId || item.id,
          paraKodu: item.kod,
          paraAdi: item.ad,
          adet: isMetal ? (r.adet || (item.gramaj && Number(item.gramaj) > 0 ? 1 : "")) : "",
          miktar: r.miktar || (isMetal && item.gramaj && Number(item.gramaj) > 0 ? item.gramaj : ""),
          milyem: milyemVal,
          urunTipi: item.urunTipi || 0,
          kur: (isTL || isVeresiye) ? "" : (kurVal > 0 ? kurVal : 1),
        };

        // Eğer veresiye seçildiyse ve kalan tutar varsa otomatik tutara ve miktara aktar
        if (isVeresiye) {
          if (!r.cariKartId && (!cariKartId || aliciUnvan.trim() === "NİHAİ TÜKETİCİ")) {
            pendingVeresiyeRowIdRef.current = rowId;
            showWarning("Veresiye / Açık Hesap yazabilmek için lütfen Cari Kart seçiniz.");
            setMusteriSearchTerm(r.cariUnvan || r.cariKod || (aliciUnvan !== "NİHAİ TÜKETİCİ" ? aliciUnvan : cariKod));
            setShowMusteriModal(true);
          }
          if (r.cariUnvan) {
            updated.paraAdi = `AÇIK HESAP (${r.cariUnvan})`;
          }
          const otherPaid = prev
            .filter((x) => x.id !== rowId && x.paraKodu?.trim().toUpperCase() !== "VERESIYE" && !x.paraAdi?.toUpperCase().includes("VERESİYE") && !x.paraAdi?.toUpperCase().includes("AÇIK HESAP"))
            .reduce((acc, curr) => acc + (Number(curr.tutar) || 0), 0);
          const rem = Math.max(0, parseFloat((genelToplam - otherPaid).toFixed(2)));
          if (rem > 0) {
            updated.adet = "";
            updated.miktar = rem;
            updated.kur = 1;
            updated.tutar = rem;
            updated.hasGram = "";
          } else {
            updated.adet = "";
            updated.kur = 1;
          }
        }

        return recomputeOdemeRow(updated, altinHasKuru);
      })
    );
  }, [altinHasKuru, faturaTipi, genelToplam, brutToplam, iskontolar, kurMap, odemeUrunList, cariKartId, aliciUnvan, cariKod, showWarning]);

  // Otomatik Kalan Tutarı Cari Karta Veresiye / Açık Hesap Yazma (F7)
  const handleAutoVeresiye = useCallback((amountToAdd?: number, explicitCariId?: number | null, explicitCariUnvan?: string | null, explicitCariKod?: string | null) => {
    const hasExplicit = explicitCariId !== undefined || explicitCariUnvan !== undefined;
    const hasHeaderCari = Boolean(cariKartId || (aliciUnvan && aliciUnvan.trim() !== "" && aliciUnvan.trim().toUpperCase() !== "NİHAİ TÜKETİCİ"));

    // Eğer ne parametre olarak bir cari verildi, ne de fiş başlığında kayıtlı bir cari varsa -> Cari seçim modalını aç
    if (!hasExplicit && !hasHeaderCari) {
      pendingVeresiyeRowIdRef.current = "auto";
      setMusteriSearchTerm("");
      setShowMusteriModal(true);
      return;
    }

    const effCariId = explicitCariId !== undefined ? explicitCariId : (cariKartId || null);
    const effCariUnvan = explicitCariUnvan !== undefined ? (explicitCariUnvan || "") : (aliciUnvan && aliciUnvan.trim().toUpperCase() !== "NİHAİ TÜKETİCİ" ? aliciUnvan : "");
    const effCariKod = explicitCariKod !== undefined ? (explicitCariKod || "") : (cariKod || "");

    const nonVeresiyePaid = odemeRows
      .filter((r) => r.paraKodu?.trim().toUpperCase() !== "VERESIYE" && !r.paraAdi?.toUpperCase().includes("VERESİYE") && !r.paraAdi?.toUpperCase().includes("AÇIK HESAP") && !r.cariKartId)
      .reduce((s, r) => s + (Number(r.tutar) || 0), 0);
    const rawDiff = typeof amountToAdd === "number" ? amountToAdd : (genelToplam - nonVeresiyePaid);
    const diff = Math.max(0, parseFloat(rawDiff.toFixed(2)));

    let targetRowId = "";
    setOdemeRows((prev) => {
      const existingIdx = prev.findIndex(
        (r) =>
          r.paraKodu?.trim().toUpperCase() === "VERESIYE" ||
          r.paraAdi?.toUpperCase().includes("VERESİYE") ||
          r.paraAdi?.toUpperCase().includes("AÇIK HESAP") ||
          Boolean(r.cariKartId)
      );

      if (existingIdx >= 0) {
        const next = [...prev];
        targetRowId = next[existingIdx].id;
        const rowUnvan = effCariUnvan || next[existingIdx].cariUnvan || "";
        next[existingIdx] = {
          ...next[existingIdx],
          paraId: 1,
          paraKodu: effCariKod || "VERESIYE",
          paraAdi: rowUnvan || "VERESİYE",
          cariKartId: effCariId !== null ? effCariId : next[existingIdx].cariKartId,
          cariUnvan: rowUnvan,
          cariKod: effCariKod || next[existingIdx].cariKod,
          adet: "",
          miktar: diff > 0 ? diff : (next[existingIdx].miktar || ""),
          kur: 1,
          tutar: diff > 0 ? diff : (next[existingIdx].tutar || ""),
          hasGram: "",
        };
        return next;
      }

      const emptyIdx = prev.findIndex(
        (r) => !r.paraKodu && (!r.tutar || Number(r.tutar) === 0)
      );

      if (emptyIdx >= 0) {
        const next = [...prev];
        targetRowId = next[emptyIdx].id;
        next[emptyIdx] = {
          ...next[emptyIdx],
          paraId: 1,
          paraKodu: effCariKod || "VERESIYE",
          paraAdi: effCariUnvan || "VERESİYE",
          cariKartId: effCariId,
          cariUnvan: effCariUnvan,
          cariKod: effCariKod,
          adet: "",
          miktar: diff > 0 ? diff : "",
          milyem: "",
          kur: 1,
          tutar: diff > 0 ? diff : "",
          hasGram: "",
        };
        return next;
      }

      const newId = `odeme-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      targetRowId = newId;
      const newRow: OdemeRow = {
        id: newId,
        paraId: 1,
        paraKodu: effCariKod || "VERESIYE",
        paraAdi: effCariUnvan || "VERESİYE",
        cariKartId: effCariId,
        cariUnvan: effCariUnvan,
        cariKod: effCariKod,
        adet: "",
        miktar: diff > 0 ? diff : "",
        milyem: "",
        hasGram: "",
        kur: 1,
        tutar: diff > 0 ? diff : "",
      };
      return [...prev, newRow];
    });

    if (diff > 0) {
      showSuccess(`Kalan tutar (${diff.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL) veresiye olarak eklendi.`);
    }

    setTimeout(() => {
      if (targetRowId) {
        focusOdemeGridCell(targetRowId, "miktar", "select");
      }
    }, 50);
  }, [genelToplam, odemeRows, cariKartId, aliciUnvan, cariKod, showSuccess, focusOdemeGridCell]);

  // İskonto Seçildiğinde Ödeme Satırı Olarak Ekleme
  const handleAddIskontoToOdeme = useCallback(
    (isk: IskontoItem) => {
      const minReq = Number(isk.minTutar) || 0;
      if (minReq > 0 && brutToplam < minReq) {
        showError(`Bu iskonto için minimum fiş tutarı ${minReq.toLocaleString("tr-TR")} ₺ olmalıdır.`);
        return;
      }

      let discountAmount = 0;
      if (isk.iskontoTipi === 1) {
        // Yüzde (%)
        const oranVal = Number(isk.oran) || 0;
        discountAmount = Math.round(((brutToplam * oranVal) / 100) * 100) / 100;
      } else if (isk.iskontoTipi === 2) {
        // Sabit Tutar (TL)
        discountAmount = Math.min(brutToplam, Number(isk.tutar) || 0);
      } else if (isk.iskontoTipi === 3) {
        // Has Gram
        const hasVal = Number(isk.hasTutar) || 0;
        const hasKur = Number(altinHasKuru) || 1;
        discountAmount = Math.min(brutToplam, Math.round(hasVal * hasKur * 100) / 100);
      } else {
        discountAmount = Number(isk.tutar) || 0;
      }

      const maxCap = Number(isk.maxIskontoTutari) || 0;
      if (maxCap > 0 && discountAmount > maxCap) {
        discountAmount = maxCap;
      }

      const iskKod = (isk.kod || `ISK-${isk.iskontoId}`).toUpperCase().trim();
      const iskAd = isk.tanim
        ? isk.tanim.toUpperCase().includes("İSKONTO") || isk.tanim.toUpperCase().includes("ISKONTO")
          ? isk.tanim
          : `İskonto: ${isk.tanim}`
        : "İskonto";
      const calcHas = altinHasKuru > 0 && discountAmount > 0 ? Number((discountAmount / altinHasKuru).toFixed(4)) : "";

      let iskKurVal: number | string = 1;
      if (isk.iskontoTipi === 1) {
        iskKurVal = Number(isk.oran) || 0;
      } else if (isk.iskontoTipi === 2) {
        iskKurVal = Number(isk.tutar) || 0;
      } else if (isk.iskontoTipi === 3) {
        iskKurVal = Number(altinHasKuru) || 1;
      } else if (isk.oran) {
        iskKurVal = Number(isk.oran) || 0;
      } else if (isk.tutar) {
        iskKurVal = Number(isk.tutar) || 0;
      }

      let targetRowId = "";
      setOdemeRows((prev) => {
        // 1. Aynı iskonto zaten varsa güncelle
        const existingIdx = prev.findIndex(
          (r) => r.paraKodu?.toUpperCase() === iskKod || r.paraId === 100000 + isk.iskontoId
        );
        if (existingIdx >= 0) {
          const next = [...prev];
          targetRowId = next[existingIdx].id;
          next[existingIdx] = {
            ...next[existingIdx],
            paraId: 100000 + isk.iskontoId,
            paraKodu: iskKod,
            paraAdi: iskAd,
            adet: "",
            miktar: discountAmount,
            milyem: "",
            kur: iskKurVal,
            tutar: discountAmount,
            hasGram: "",
          };
          return next;
        }

        // 2. Boş bir satır varsa üzerine yaz
        const emptyIdx = prev.findIndex((r) => !r.paraKodu && (!r.tutar || Number(r.tutar) === 0));
        if (emptyIdx >= 0) {
          const next = [...prev];
          targetRowId = next[emptyIdx].id;
          next[emptyIdx] = {
            ...next[emptyIdx],
            paraId: 100000 + isk.iskontoId,
            paraKodu: iskKod,
            paraAdi: iskAd,
            adet: "",
            miktar: discountAmount,
            milyem: "",
            kur: iskKurVal,
            tutar: discountAmount,
            hasGram: "",
          };
          return next;
        }

        // 3. Yeni satır olarak ekle
        const newId = `odeme-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        targetRowId = newId;
        return [
          ...prev,
          {
            id: newId,
            satirNo: prev.length + 1,
            paraId: 100000 + isk.iskontoId,
            paraKodu: iskKod,
            paraAdi: iskAd,
            adet: "",
            miktar: discountAmount,
            milyem: "",
            kur: iskKurVal,
            tutar: discountAmount,
            hasGram: "",
          },
        ];
      });

      showSuccess(`${iskAd} (${discountAmount.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL) başarıyla eklendi.`);
      if (targetRowId) {
        setTimeout(() => focusOdemeGridCell(targetRowId, "tutar", "select"), 50);
      }
    },
    [brutToplam, altinHasKuru, showError, showSuccess, focusOdemeGridCell]
  );

  // Helper to determine navigable columns for payment rows (Kur & Tutar are readOnly/calculated)
  const getNavigableOdemeCols = useCallback((row?: OdemeRow): OdemeGridColKey[] => {
    const isHasCodeCol = row?.odemeAraciTuru === 1 || row?.odemeAraciTuru === 2 || row?.odemeAraciTuru === 3 || Boolean(row?.cariKartId);
    const cols: OdemeGridColKey[] = ["odemeAraciTuru"];
    if (isHasCodeCol) {
      cols.push("cariKod");
    }
    cols.push("paraKodu");
    if (isAltinOrGumusRow(row, odemeUrunList)) {
      cols.push("adet", "miktar", "milyem");
      return cols;
    }
    cols.push("miktar");
    return cols;
  }, [odemeUrunList]);

  // Keyboard navigation for Payment Grid
  const handleOdemeGridKeyDown = (
    e: React.KeyboardEvent<HTMLElement>,
    rowIndex: number,
    colKey: OdemeGridColKey,
    rowId: string
  ) => {
    const currentRow = odemeRows[rowIndex];
    const navCols = getNavigableOdemeCols(currentRow);
    let colIdx = navCols.indexOf(colKey);
    if (colIdx === -1) {
      colIdx = 0;
    }
    const totalCols = navCols.length;
    const { isAtStart, isAtEnd } = getSelectionBounds(e.currentTarget);

    // ESC altındaki " tuşuna basınca üst satırdaki hücre değerini kopyala (Sadece tablolarda geçerli)
    if (e.key === '"' || e.key === '“' || e.key === '”' || e.key === '„' || e.key === '«' || e.key === '»' || e.key === 'é' || e.key === 'É' || e.key === '`' || e.key === '´' || e.key === '§' || e.code === "Backquote" || (e.code === "Digit2" && e.shiftKey) || e.keyCode === 222 || e.keyCode === 192) {
      e.preventDefault();
      e.stopPropagation();
      if (rowIndex > 0) {
        const prevRow = odemeRows[rowIndex - 1];
        const prevVal = prevRow[colKey as keyof OdemeRow];
        updateOdemeRow(rowId, colKey as keyof OdemeRow, prevVal !== undefined && prevVal !== null ? prevVal : "");
        setTimeout(() => focusOdemeGridCell(rowId, colKey, "select"), 20);
      }
      return;
    }

    if (colKey === "odemeAraciTuru") {
      if (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) {
        e.preventDefault();
        const nextCol = navCols[1] || "paraKodu";
        focusOdemeGridCell(rowId, nextCol, "select");
        return;
      }
    }

    if (colKey === "cariKod") {
      const typed = (String(odemeRows[rowIndex]?.cariKod) || "").trim();
      const isPos = currentRow?.odemeAraciTuru === 2;
      const isHesap = currentRow?.odemeAraciTuru === 3;

      if (isPos) {
        if (e.key === "Enter" || e.key === "F4" || e.key === "F3" || (e.key === "Tab" && !e.shiftKey)) {
          e.preventDefault();
          e.stopPropagation();
          if (!typed && e.key !== "F4" && e.key !== "F3") {
            focusOdemeGridCell(rowId, "miktar", "select");
            return;
          }
          const matches = posCihazlari.filter(
            (p) =>
              (p.kod || "").toLowerCase().includes(typed.toLowerCase()) ||
              (p.ad || "").toLowerCase().includes(typed.toLowerCase())
          );
          if (matches.length === 1 && e.key !== "F4" && e.key !== "F3") {
            const match = matches[0];
            setOdemeRows((prev) =>
              prev.map((r) =>
                r.id === rowId
                  ? {
                      ...r,
                      cariKod: match.kod,
                      paraAdi: match.ad || "KREDİ KARTI / POS",
                      bankaId: match.posCihaziId,
                    }
                  : r
              )
            );
            focusOdemeGridCell(rowId, "miktar", "select");
            return;
          }
          setPendingPosRowId(rowId);
          setPosSearchTerm(typed);
          setShowPosModal(true);
          return;
        }
      } else if (isHesap) {
        if (e.key === "Enter" || e.key === "F4" || e.key === "F3" || (e.key === "Tab" && !e.shiftKey)) {
          e.preventDefault();
          e.stopPropagation();
          if (!typed && e.key !== "F4" && e.key !== "F3") {
            focusOdemeGridCell(rowId, "miktar", "select");
            return;
          }
          const matches = bankaHesaplari.filter(
            (b) =>
              (b.hesapNo || "").toLowerCase().includes(typed.toLowerCase()) ||
              (b.hesapAdi || "").toLowerCase().includes(typed.toLowerCase()) ||
              (b.iban || "").toLowerCase().includes(typed.toLowerCase())
          );
          if (matches.length === 1 && e.key !== "F4" && e.key !== "F3") {
            const match = matches[0];
            setOdemeRows((prev) =>
              prev.map((r) =>
                r.id === rowId
                  ? {
                      ...r,
                      cariKod: match.hesapNo,
                      paraAdi: match.hesapAdi || "BANKA HAVALE / EFT",
                      bankaId: match.bankaId,
                    }
                  : r
              )
            );
            focusOdemeGridCell(rowId, "miktar", "select");
            return;
          }
          setPendingBankaRowId(rowId);
          setBankaSearchTerm(typed);
          setShowBankaModal(true);
          return;
        }
      } else {
        if (e.key === "Enter" || e.key === "F4" || e.key === "F3" || (e.key === "Tab" && !e.shiftKey)) {
          e.preventDefault();
          e.stopPropagation();
          if (!typed) {
            focusOdemeGridCell(rowId, "paraKodu", "select");
            return;
          }
          const matches = cariler.filter((c) => (c.kod || "").toLowerCase().includes(typed.toLowerCase()) || (c.ad || "").toLowerCase().includes(typed.toLowerCase()));
          if (matches.length === 1 && e.key !== "F4" && e.key !== "F3") {
            const match = matches[0];
            setOdemeRows((prev) => prev.map((r) => r.id === rowId ? {
              ...r,
              odemeAraciTuru: 1,
              cariKartId: match.id,
              cariKod: match.kod,
              cariUnvan: match.ad || "",
              paraId: null,
              paraKodu: "",
              paraAdi: "",
              adet: "",
              miktar: "",
              milyem: "",
              hasGram: "",
              kur: "",
              tutar: "",
            } : r));
            focusOdemeGridCell(rowId, "paraKodu", "select");
            return;
          }
          pendingVeresiyeRowIdRef.current = rowId;
          setMusteriSearchTerm(typed);
          setCariSearchField("kod");
          setShowMusteriModal(true);
          return;
        }
      }
    }

    if (colKey === "paraKodu") {
      const typed = (String(odemeRows[rowIndex]?.paraKodu) || "").trim();
      const isCari = currentRow?.odemeAraciTuru === 1 || Boolean(currentRow?.cariKartId);
      const isIskontoRow =
        currentRow?.paraKodu?.trim().toUpperCase().startsWith("ISK") ||
        currentRow?.paraAdi?.toUpperCase().includes("İSKONTO") ||
        currentRow?.paraAdi?.toUpperCase().includes("ISKONTO") ||
        (currentRow?.paraId !== undefined && currentRow?.paraId !== null && Number(currentRow?.paraId) >= 100000);

      if (e.key === "Enter" || e.key === "F4" || e.key === "F3" || (e.key === "Tab" && !e.shiftKey)) {
        e.preventDefault();
        e.stopPropagation();
        if (isIskontoRow && (e.key === "F4" || e.key === "F3")) {
          setShowIskontoModal(true);
          return;
        }

        if (isCari && !typed && e.key !== "F4" && e.key !== "F3") {
          focusOdemeGridCell(rowId, "miktar", "select");
          return;
        }

        const upper = typed.toUpperCase();
        if ((!isCari && !typed) || upper === "TL" || upper === "TRY" || upper === "TRL") {
          setOdemeRows((prev) =>
            prev.map((r) =>
              r.id === rowId
                ? { ...r, paraKodu: "TL", paraAdi: "TÜRK LİRASI", kur: 1, milyem: "", adet: "", hasGram: "" }
                : r
            )
          );
          focusOdemeGridCell(rowId, "miktar", "select");
          return;
        }
        if (e.key === "F4" || e.key === "F3") {
          lastModalCallerRef.current = "odemeLookup";
          lastOdemeRowIdRef.current = rowId;
          setOdemeSearchTerm(typed);
          openOdemeUrunModal(rowId);
          return;
        }
        const matches = allOdemeUrunler.filter((u) => u.kod.trim().toLowerCase().includes(typed.toLowerCase()));
        if (matches.length === 1) {
          lastModalCallerRef.current = null;
          lastOdemeRowIdRef.current = null;
          applyProductToOdemeRow(rowId, matches[0]);
          const isMetal = matches[0].urunTipi === 2 || matches[0].urunTipi === 3 || (matches[0].hasOrani && Number(matches[0].hasOrani) > 0);
          focusOdemeGridCell(rowId, isMetal ? "adet" : "miktar", "select");
          return;
        }
        lastModalCallerRef.current = "odemeLookup";
        lastOdemeRowIdRef.current = rowId;
        setOdemeSearchTerm(typed);
        openOdemeUrunModal(rowId);
        return;
      }
    }

    if (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) {
      e.preventDefault();
      if (colIdx + 1 < totalCols) {
        focusOdemeGridCell(rowId, navCols[colIdx + 1], "select");
      } else {
        if (rowIndex < odemeRows.length - 1) {
          const nr = odemeRows[rowIndex + 1];
          setActiveOdemeRowIndex(rowIndex + 1);
          const nextNavCols = getNavigableOdemeCols(nr);
          focusOdemeGridCell(nr.id, nextNavCols[0] || "paraKodu", "select");
        } else {
          handleAddOdemeRow();
        }
      }
    } else if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault();
      if (colIdx > 0) {
        focusOdemeGridCell(rowId, navCols[colIdx - 1], "select");
      } else if (rowIndex > 0) {
        const pr = odemeRows[rowIndex - 1];
        setActiveOdemeRowIndex(rowIndex - 1);
        const prevNavCols = getNavigableOdemeCols(pr);
        focusOdemeGridCell(pr.id, prevNavCols[prevNavCols.length - 1] || "kur", "select");
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (rowIndex < odemeRows.length - 1) {
        const nr = odemeRows[rowIndex + 1];
        setActiveOdemeRowIndex(rowIndex + 1);
        const nextCols = getNavigableOdemeCols(nr);
        const targetCol = nextCols.includes(colKey) ? colKey : (nextCols[Math.min(colIdx, nextCols.length - 1)] || "miktar");
        focusOdemeGridCell(nr.id, targetCol, "select");
      } else {
        handleAddOdemeRow();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (rowIndex > 0) {
        const pr = odemeRows[rowIndex - 1];
        setActiveOdemeRowIndex(rowIndex - 1);
        const prevCols = getNavigableOdemeCols(pr);
        const targetCol = prevCols.includes(colKey) ? colKey : (prevCols[Math.min(colIdx, prevCols.length - 1)] || "miktar");
        focusOdemeGridCell(pr.id, targetCol, "select");
      }
    } else if (e.key === "ArrowRight") {
      if (isAtEnd) {
        e.preventDefault();
        if (colIdx + 1 < totalCols) {
          focusOdemeGridCell(rowId, navCols[colIdx + 1], "select");
        } else if (rowIndex < odemeRows.length - 1) {
          const nr = odemeRows[rowIndex + 1];
          setActiveOdemeRowIndex(rowIndex + 1);
          const nextNavCols = getNavigableOdemeCols(nr);
          focusOdemeGridCell(nr.id, nextNavCols[0] || "paraKodu", "select");
        } else {
          handleAddOdemeRow();
        }
      }
    } else if (e.key === "ArrowLeft") {
      if (isAtStart) {
        e.preventDefault();
        if (colIdx > 0) {
          focusOdemeGridCell(rowId, navCols[colIdx - 1], "select");
        } else if (rowIndex > 0) {
          const pr = odemeRows[rowIndex - 1];
          setActiveOdemeRowIndex(rowIndex - 1);
          const prevNavCols = getNavigableOdemeCols(pr);
          focusOdemeGridCell(pr.id, prevNavCols[prevNavCols.length - 1] || "kur", "select");
        }
      }
    }
  };

  const openOdemeUrunModal = (rowId: string) => {
    lastOdemeRowIdRef.current = rowId;
    setActiveOdemeRowIdForUrun(rowId);
    setShowOdemeUrunModal(true);
  };

  // Insert Row at specific index (Items Table)
  const handleAddRow = useCallback((afterIndex?: number) => {
    handleAddPerakendeRow(afterIndex);
  }, [handleAddPerakendeRow]);

  // Insert Row at specific index (Payment Table)
  const handleAddOdemeRow = useCallback((afterIndex?: number) => {
    const newRow = createEmptyOdemeRow(odemeRows.length + 1);
    const newIdx = typeof afterIndex === "number" && afterIndex >= 0 ? afterIndex + 1 : odemeRows.length;
    setOdemeRows((prev) => {
      if (typeof afterIndex === "number" && afterIndex >= 0) {
        const next = [...prev];
        next.splice(afterIndex + 1, 0, newRow);
        return next;
      }
      return [...prev, newRow];
    });

    setActiveOdemeRowIndex(newIdx);

    setTimeout(() => {
      focusOdemeGridCell(newRow.id, "odemeAraciTuru", "select");
    }, 20);
    setTimeout(() => {
      focusOdemeGridCell(newRow.id, "odemeAraciTuru", "select");
    }, 80);
    return true;
  }, [odemeRows.length]);

  // Delete Item Row
  const handleDeleteRow = useCallback((rowId: string) => {
    setItems((prev) => {
      const filtered = prev.filter((r, idx) => r.id !== rowId && String(idx) !== String(rowId));
      if (filtered.length === 0) {
        return [createEmptyRow()];
      }
      return filtered;
    });
  }, []);

  // Delete Payment Row
  const handleDeleteOdemeRow = useCallback((rowId: string) => {
    setOdemeRows((prev) => {
      const filtered = prev.filter((r, idx) => r.id !== rowId && String(idx) !== String(rowId));
      if (filtered.length === 0) {
        return [createEmptyOdemeRow(1)];
      }
      return filtered.map((r, idx) => ({ ...r, satirNo: idx + 1 }));
    });
  }, []);

  const handleCompleteSaleRef = useRef<((withPrint?: boolean, bypassMasakWarning?: boolean, forceOdemeFarkApprove?: boolean) => Promise<void>) | null>(null);

  // Müşteri / MASAK Detay Modalını Aç
  const openMusteriDetayModal = useCallback(() => {
    setDetayUnvan(aliciUnvan !== "NİHAİ TÜKETİCİ" ? aliciUnvan : "");
    setDetayVknTckn(aliciVknTckn !== "11111111111" ? aliciVknTckn : "");
    setDetayAdres(adres || "");
    setDetayIl(il || "");
    setDetayIlce(ilce || "");
    setDetayVergiDairesi(vergiDairesi || "");
    setDetayTelefon(telefon || "");
    setDetayEposta(eposta || "");
    setShowMusteriDetayModal(true);
  }, [aliciUnvan, aliciVknTckn, adres, il, ilce, vergiDairesi, telefon, eposta]);

  // Müşteri / MASAK Detay Bilgilerini Kaydet ve Uygula
  const handleSaveMusteriDetay = useCallback(
    (andCompleteSale: boolean = false) => {
      if (!detayUnvan.trim()) {
        showWarning("Lütfen Müşteri Adı / Ünvanını giriniz.");
        return;
      }
      const cleanTc = detayVknTckn.trim();
      if (!cleanTc || cleanTc === "11111111111") {
        showWarning("Lütfen geçerli bir TCKN (11 hane), VKN (10 hane) veya Pasaport No giriniz.");
        return;
      }
      if (!detayAdres.trim()) {
        showWarning("MASAK yasal mevzuatı uyarınca Adres bilgisi zorunludur.");
        return;
      }

      setAliciUnvan(detayUnvan.trim());
      setAliciVknTckn(cleanTc);
      setAdres(detayAdres.trim());
      setIl(detayIl.trim());
      setIlce(detayIlce.trim());
      setVergiDairesi(detayVergiDairesi.trim());
      setTelefon(detayTelefon.trim());
      setEposta(detayEposta.trim());
      const newSenaryo = detectScenario(cleanTc, undefined, detayUnvan.trim());
      setSenaryo(newSenaryo);

      setShowMusteriDetayModal(false);
      showSuccess("Müşteri ve adres bilgileri güncellendi.");

      if (andCompleteSale) {
        setTimeout(() => {
          handleCompleteSaleRef.current?.(pendingSaveWithPrint, true, true);
        }, 120);
      }
    },
    [
      detayUnvan,
      detayVknTckn,
      detayAdres,
      detayIl,
      detayIlce,
      detayVergiDairesi,
      detayTelefon,
      detayEposta,
      pendingSaveWithPrint,
      showWarning,
      showSuccess,
    ]
  );

  // Global Keyboard Shortcuts
  const closeAllModals = useCallback(() => {
    setShowMusteriModal(false);
    setShowHistoryModal(false);
    setShowOdemeUrunModal(false);
    setShowIskontoModal(false);
    setShowPrintModal(false);
    setShowMusteriDetayModal(false);
    setShowVezneModal(false);
    setShowProductLookup(false);
    setShowAyarModal(false);
    setMasakModalOpen(false);
    setShowMasakLimitWarningModal(false);
    setShowOdemeFarkConfirmModal({ show: false, andPrint: false, rawDiffTL: 0 });
  }, []);

  // Global Keyboard Shortcuts (F1, F2, F3, F4, F8, F9, F10)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Eğer ekranda açık bir modal varsa kısayolları çalıştırma
      if (document.querySelector(".modal.show")) {
        return;
      }

      const activeEl = document.activeElement as HTMLElement | null;
      const isInput =
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.tagName === "SELECT");

      const key = e.key;
      const isF10 = key === "F10" || e.code === "F10" || e.keyCode === 121;
      const isF1 = key === "F1" || e.code === "F1" || e.keyCode === 112;
      const isF2 = key === "F2" || e.code === "F2" || e.keyCode === 113;
      const isF3 = key === "F3" || e.code === "F3" || e.keyCode === 114;
      const isF4 = key === "F4" || e.code === "F4" || e.keyCode === 115;
      const isF8 = key === "F8" || e.code === "F8" || e.keyCode === 119;
      const isF9 = key === "F9" || e.code === "F9" || e.keyCode === 120;

      if (isF1) {
        e.preventDefault();
        e.stopPropagation();
        closeAllModals();
        handleCompleteSale(false);
      } else if (isF2) {
        e.preventDefault();
        e.stopPropagation();
        closeAllModals();
        if (isDuzeltmeMode && currentFaturaId) {
          handleDeleteCurrent();
        }
      } else if (isF3) {
        e.preventDefault();
        e.stopPropagation();
        closeAllModals();
        if (isDuzeltmeMode) {
          handleOpenHistory();
        }
      } else if (isF4) {
        e.preventDefault();
        e.stopPropagation();
        closeAllModals();
        setMusteriSearchTerm(aliciUnvan !== "NİHAİ TÜKETİCİ" ? aliciUnvan : cariKod);
        setShowMusteriModal(true);
      } else if (isF8) {
        e.preventDefault();
        e.stopPropagation();
        closeAllModals();
        openMusteriDetayModal();
      } else if (isF9) {
        e.preventDefault();
        e.stopPropagation();
        closeAllModals();
        handleOpenPrintPreview();
      } else if (isF10) {
        e.preventDefault();
        e.stopPropagation();
        closeAllModals();
        handleCompleteSale(true);
      } else if (e.key === "Insert" && !isInput) {
        e.preventDefault();
        e.stopPropagation();
        handleAddRow();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  });

  // Reset / New (Toolbar onNew)
  const handleNew = () => {
    if (isDuzeltmeMode) {
      navigate("/vezne/perakende-fisi-kayit");
    } else {
      handleReset();
    }
  };

  const handleReset = async () => {
    setCurrentFaturaId(null);
    setCurrentIndex(0);
    setItems([createEmptyRow()]);
    setOdemeRows([createEmptyOdemeRow(1)]);
    setActiveRowIndex(0);
    setAliciVknTckn("11111111111");
    setCariKod("");
    setAliciUnvan("NİHAİ TÜKETİCİ");
    setCariKartId(null);
    setAdres("");
    setIlce("");
    setIl("");
    setVergiDairesi("");
    setTelefon("");
    setEposta("");
    setFaturaTipi(1);
    setSenaryo("EARSIVFATURA");
    setFaturaNo("");
    setSelectedIskontoId(null);
    setIskontoOrani(0);
    setIskontoTutari(0);
    setIskontoKodu("");
    setIskontoSearchTerm("");
    setMusteriSearchTerm("");
    setProductSearchTerm("");
    setOdemeSearchTerm("");
    setMasakResult({ matches: [], searched: false });

    if (vezneler.length > 0) {
      const uv = await resolveUserVezne(vezneler);
      if (uv) setSelectedVezne(uv);
    }

    setTimeout(() => {
      if (items[0]) {
        focusGridCell(items[0].id, "barkod", "select");
      }
    }, 50);
  };

  // Quick Nihai Tüketici
  const handleSetNihaiTuketici = () => {
    setAliciVknTckn("11111111111");
    setCariKod("");
    setAliciUnvan("NİHAİ TÜKETİCİ");
    setCariKartId(null);
    setAdres("");
    setIlce("");
    setIl("");
    setVergiDairesi("");
    setTelefon("");
    setEposta("");
    setSenaryo("EARSIVFATURA");
    setMasakResult({ matches: [], searched: false });
  };

  // MASAK Sorgulama Fonksiyonu
  const handleMasakQuery = async (nameToQuery?: string, idToQuery?: string) => {
    const cleanName = (nameToQuery !== undefined ? nameToQuery : aliciUnvan || "").trim();
    const cleanId = (idToQuery !== undefined ? idToQuery : aliciVknTckn || "").replace(/\D/g, "");

    if (!cleanName && !cleanId) {
      showWarning("MASAK sorgusu yapabilmek için Müşteri Adı veya TCKN/VKN giriniz.");
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
        showError(`🚨 DİKKAT: "${cleanName || cleanId}" için MASAK listelerinde ${matches.length} eşleşme bulundu!`);
      }
    } catch (err: any) {
      showError("MASAK sorgulama sırasında hata oluştu: " + (err.message || "Bilinmeyen hata"));
    } finally {
      setIsSearchingMasak(false);
    }
  };

  const findMatchingCustomers = (
    field: "kod" | "unvan" | "vkn",
    query: string
  ): { cariler: CariKartItem[]; kayitsizlar: KayitsizMusteriItem[]; totalCount: number } => {
    const q = query.toLowerCase().trim();
    if (!q) return { cariler: [], kayitsizlar: [], totalCount: 0 };

    const matchedCariler = cariler.filter((c) => {
      if (field === "kod") {
        return (c.kod || "").toLowerCase().includes(q);
      } else if (field === "unvan") {
        return (c.ad || (c as any).unvan || "").toLowerCase().includes(q);
      } else if (field === "vkn") {
        return (c.vergiKimlikNo || "").replace(/\s+/g, "").toLowerCase().includes(q.replace(/\s+/g, ""));
      }
      return false;
    });

    const matchedKayitsizlar = kayitsizMusteriler.filter((k) => {
      if (field === "kod") {
        return false;
      } else if (field === "unvan") {
        return (k.ad || k.unvan || "").toLowerCase().includes(q);
      } else if (field === "vkn") {
        return (k.vergiKimlikNo || "").replace(/\s+/g, "").toLowerCase().includes(q.replace(/\s+/g, ""));
      }
      return false;
    });

    return {
      cariler: matchedCariler,
      kayitsizlar: matchedKayitsizlar,
      totalCount: matchedCariler.length + matchedKayitsizlar.length,
    };
  };

  // Customer selection from Modal
  const handleSelectCustomer = async (res: SelectedCustomerResult) => {
    lastModalCallerRef.current = null;

    // Eğer veresiye satırından veya veresiye işleminden müşteri seçimine gelindiyse SADECE o ödeme satırına ata, üstteki başlık cariyi ASLA DEĞİŞTİRME!
    if (pendingVeresiyeRowIdRef.current) {
      const targetRowId = pendingVeresiyeRowIdRef.current;
      pendingVeresiyeRowIdRef.current = null;
      setShowMusteriModal(false);
      setMusteriSearchTerm("");

      const rawData = res.raw as any;
      const cariKodVal = res.kod || rawData?.kod || rawData?.cariKodu || "";
      const cariUnvanVal = res.unvan || "";
      const cariIdVal = res.id || (res.type === "registered" ? res.id : null);

      let activeIdx = 0;
      let targetRowIdToFocus = "";

      setOdemeRows((prev) => {
        let found = false;
        const next = prev.map((r, idx) => {
          if (
            r.id === targetRowId ||
            (targetRowId === "auto" &&
              (r.paraKodu?.trim().toUpperCase() === "VERESIYE" ||
                r.paraAdi?.toUpperCase().includes("VERESİYE") ||
                r.paraAdi?.toUpperCase().includes("AÇIK HESAP") ||
                Boolean(r.cariKartId)))
          ) {
            found = true;
            activeIdx = idx;
            targetRowIdToFocus = r.id;
            const otherPaid = prev
              .filter(
                (x) =>
                  x.id !== r.id &&
                  x.paraKodu?.trim().toUpperCase() !== "VERESIYE" &&
                  !x.paraAdi?.toUpperCase().includes("VERESİYE") &&
                  !x.paraAdi?.toUpperCase().includes("AÇIK HESAP") &&
                  !x.cariKartId
              )
              .reduce((acc, curr) => acc + (Number(curr.tutar) || 0), 0);
            const rem = Math.max(0, parseFloat((genelToplam - otherPaid).toFixed(2)));
            const effMiktar = r.miktar && Number(r.miktar) > 0 ? r.miktar : (rem > 0 ? rem : "");
            const effTutar = r.tutar && Number(r.tutar) > 0 ? r.tutar : (rem > 0 ? rem : "");

            if (targetRowId !== "auto") {
              return {
                ...r,
                odemeAraciTuru: 1,
                cariKartId: cariIdVal,
                cariUnvan: cariUnvanVal,
                cariKod: cariKodVal,
                paraId: null,
                paraKodu: "",
                paraAdi: "",
                adet: "",
                miktar: "",
                milyem: "",
                hasGram: "",
                kur: "",
                tutar: "",
              };
            }

            return {
              ...r,
              odemeAraciTuru: 1,
              paraId: 1,
              paraKodu: cariKodVal || "VERESIYE",
              paraAdi: cariUnvanVal || "VERESİYE",
              cariKartId: cariIdVal,
              cariUnvan: cariUnvanVal,
              cariKod: cariKodVal,
              adet: "",
              miktar: effMiktar,
              milyem: "",
              hasGram: "",
              kur: 1,
              tutar: effTutar,
            };
          }
          return r;
        });

        if (!found) {
          const otherPaid = prev
            .filter(
              (x) =>
                x.paraKodu?.trim().toUpperCase() !== "VERESIYE" &&
                !x.paraAdi?.toUpperCase().includes("VERESİYE") &&
                !x.paraAdi?.toUpperCase().includes("AÇIK HESAP") &&
                !x.cariKartId
            )
            .reduce((acc, curr) => acc + (Number(curr.tutar) || 0), 0);
          const rem = Math.max(0, parseFloat((genelToplam - otherPaid).toFixed(2)));
          const emptyIdx = prev.findIndex((r) => !r.paraKodu && !r.miktar && !r.tutar);

          if (emptyIdx >= 0) {
            const copy = [...prev];
            const existingId = copy[emptyIdx].id;
            targetRowIdToFocus = existingId;
            copy[emptyIdx] = {
              ...copy[emptyIdx],
              paraId: 1,
              paraKodu: cariKodVal || "VERESIYE",
              paraAdi: cariUnvanVal || "VERESİYE",
              cariKartId: cariIdVal,
              cariUnvan: cariUnvanVal,
              cariKod: cariKodVal,
              adet: "",
              miktar: rem > 0 ? rem : "",
              milyem: "",
              hasGram: "",
              kur: 1,
              tutar: rem > 0 ? rem : "",
            };
            activeIdx = emptyIdx;
            return copy;
          }

          const newId = targetRowId !== "auto" && targetRowId ? targetRowId : `odeme-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          targetRowIdToFocus = newId;
          const newRow: OdemeRow = {
            id: newId,
            paraId: 1,
            paraKodu: cariKodVal || "VERESIYE",
            paraAdi: cariUnvanVal || "VERESİYE",
            cariKartId: cariIdVal,
            cariUnvan: cariUnvanVal,
            cariKod: cariKodVal,
            adet: "",
            miktar: rem > 0 ? rem : "",
            milyem: "",
            hasGram: "",
            kur: 1,
            tutar: rem > 0 ? rem : "",
          };
          activeIdx = prev.length;
          return [...prev, newRow];
        }

        return next;
      });

      setActiveOdemeRowIndex(activeIdx);
      if (targetRowIdToFocus) {
        setTimeout(() => focusOdemeGridCell(targetRowIdToFocus, "miktar", "select"), 50);
      }

      return;
    }

    setAliciUnvan(res.unvan);
    const rawData = res.raw as any;
    const passportNo = rawData?.pasaportNo || "";
    const identVal = res.vergiKimlikNo || passportNo || "";
    setAliciVknTckn(identVal || "11111111111");
    const resolvedKod = res.kod || rawData?.kod || rawData?.cariKodu || "";
    setCariKod(resolvedKod);
    setAdres(res.adres || "");
    setTelefon(res.telefon || "");

    lastFocusedCariKodRef.current = resolvedKod;
    lastFocusedUnvanRef.current = res.unvan;
    lastFocusedVknRef.current = identVal;

    const autoSenaryo = (res.isMukellef || res.eFaturaPostaKutusu || rawData?.eFatura) ? "TICARIFATURA" : detectScenario(identVal, rawData, res.unvan);
    setSenaryo(autoSenaryo);
    if (identVal && identVal !== "11111111111") {
      void checkAndApplyMukellefiyet(identVal, res.unvan, autoSenaryo);
    }

    setOdemeRows((prev) =>
      prev.map((r) => {
        if (r.odemeAraciTuru === 1) {
          return {
            ...r,
            paraKodu: resolvedKod || "VERESIYE",
            paraAdi: res.unvan || "VERESİYE / AÇIK HESAP",
            cariKartId: res.type === "registered" ? res.id : null,
            cariUnvan: res.unvan,
            cariKod: resolvedKod,
          };
        }
        return r;
      })
    );

    let lookups = cariLookups;
    if (!lookups) {
      try {
        lookups = await CariService.getLookups();
        setCariLookups(lookups);
      } catch { }
    }

    const resolvedVd =
      res.vergiDairesi ||
      rawData?.vergiDairesi ||
      lookups?.vergiDairesiList?.find((x) => x.id === rawData?.vergiDairesiId)?.ad ||
      "";
    const resolvedIl =
      res.il ||
      rawData?.il ||
      lookups?.ilList?.find((x) => x.id === rawData?.ilId)?.ad ||
      "";
    const resolvedIlce =
      res.ilce ||
      rawData?.ilce ||
      lookups?.ilceList?.find((x) => x.id === rawData?.ilceId)?.ad ||
      "";
    const resolvedAdres = res.adres || rawData?.adres || "";
    const resolvedTelefon = res.telefon || rawData?.telefon || "";
    const resolvedEposta = res.eFaturaPostaKutusu || res.eposta || rawData?.eposta || "";

    setVergiDairesi(resolvedVd);
    setDetayVergiDairesi(resolvedVd);
    setIl(resolvedIl);
    setDetayIl(resolvedIl);
    setIlce(resolvedIlce);
    setDetayIlce(resolvedIlce);
    setAdres(resolvedAdres);
    setDetayAdres(resolvedAdres);
    setTelefon(resolvedTelefon);
    setDetayTelefon(resolvedTelefon);
    setEposta(resolvedEposta);
    setDetayEposta(resolvedEposta);
    setDetayUnvan(res.unvan);
    setDetayVknTckn(identVal);

    if (res.type === "registered" && res.id) {
      setCariKartId(res.id);
    } else {
      setCariKartId(null);
    }

    setShowMusteriModal(false);
    setMusteriSearchTerm("");

    // MASAK Kontrolü (1. Kontrol Noktası: Kişi Seçildiğinde / Sorgulandığında)
    const activeStatId = faturaTipi === 0 ? companyDefinitions?.ALIS_ISTATISTIK_ID : companyDefinitions?.SATIS_ISTATISTIK_ID;
    const activeStat = statisticList.find((s) => s.id === Number(activeStatId));
    const isGayriResmi = activeStat && Number(activeStat.fisDizaynTipi) === 1;

    if (!isGayriResmi && res.unvan && res.unvan !== "NİHAİ TÜKETİCİ") {
      void handleMasakQuery(res.unvan, res.vergiKimlikNo);
    } else {
      setMasakResult({ matches: [], searched: false });
    }

    if (genelToplam >= 185000 && !isGayriResmi) {
      const cleanVkn = (res.vergiKimlikNo || "").trim();
      const isMissingInfo =
        !cleanVkn ||
        cleanVkn === "11111111111" ||
        res.unvan.trim().toUpperCase() === "NİHAİ TÜKETİCİ" ||
        !res.adres?.trim();
      if (isMissingInfo) {
        setShowMasakLimitWarningModal(true);
      }
    }
  };

  // F9: Fiş / Fatura Önizleme Modalı Aç
  const handleOpenPrintPreview = () => {
    if (printedFatura) {
      setIsPendingDirectPrint(false);
      setShowPrintModal(true);
      return;
    }
    const previewSatirlar: PerakendeFaturaSatiriItem[] = validItems.map((r, idx) => ({
      satirNo: idx + 1,
      altinUrunId: r.altinUrunId || null,
      barkod: r.barkod || null,
      urunAdi: r.urunAdi || "",
      ayar: r.ayar || null,
      miktar: Number(r.miktar) || 1,
      birim: r.birim || "Gr",
      gram: Number(r.gram) || 0,
      hasGram: Number(r.hasGram) || 0,
      birimFiyat: Number(r.birimFiyat) || 0,
      tutar: Number(r.tutar) || 0,
      kdvOrani: Number(r.kdvOrani) || 0,
      kdvTutari: Number(r.kdvTutari) || 0,
      toplamTutar: Number(r.toplamTutar) || 0,
    }));

    const previewFatura: PerakendeFaturaModel = {
      faturaId: currentFaturaId || 1,
      vezneId: selectedVezne?.id || 1,
      vezneKod: selectedVezne?.kod || user?.cashierCode || "01",
      vezneAd: selectedVezne?.ad || "Ana Vezne",
      faturaNo: faturaNo || `PRF-${new Date().getFullYear()}-00001`,
      ettn: "FD5AA22A-A68D-4B2E-87CF-E958E3800001",
      tarih: `${tarih}T${saat}:00`,
      faturaTipi: faturaTipi || 1,
      senaryo: senaryo || "EARSIVFATURA",
      cariKartId: cariKartId || null,
      cariKod: cariKod || null,
      cariUnvan: aliciUnvan || null,
      aliciVknTckn: (aliciVknTckn || "").replace(/\D/g, "") || "11111111111",
      aliciUnvan: aliciUnvan || "NİHAİ TÜKETİCİ",
      adres: adres || "",
      ilce: ilce || "",
      il: il || "",
      vergiDairesi: vergiDairesi || "",
      eposta: eposta || "",
      telefon: telefon || "",
      paraId: 1,
      paraKodu: "TL",
      kur: 1,
      araToplam: araToplam,
      toplamKdv: toplamKdv,
      iskontoId: selectedIskonto?.iskontoId || null,
      iskontoKodu: selectedIskonto?.kod || selectedIskonto?.tanim || null,
      iskontoOrani: iskontoOrani,
      iskontoTutari: iskontoTutari,
      genelToplam: genelToplam,
      eBelgeDurumu: 0,
      satirlar: previewSatirlar,
    };
    setPrintedFatura(previewFatura);
    setIsPendingDirectPrint(false);
    setShowPrintModal(true);
  };

  // Complete Sale & Save Invoice
  const handleCompleteSale = async (
    withPrint: boolean = false,
    bypassMasakWarning: boolean = false,
    forceOdemeFarkApprove: boolean = false
  ) => {
    handleCompleteSaleRef.current = handleCompleteSale;
    if (isSubmittingRef.current) return;

    // MASAK Malvarlığı Dondurulanlar Bloke Kontrolü (Kesinlikle Kayıt Yapılamaz!)
    if (isMasakBlocked) {
      showError(
        `⛔ İŞLEM ENGELLENDİ: "${masakResult.queriedName || aliciUnvan}" MASAK Malvarlığı Dondurulanlar listesindedir! Bu kişi/kuruluş için fatura/fiş kaydedilemez.`
      );
      setMasakModalOpen(true);
      return;
    }

    if (validItems.length === 0) {
      showWarning("Faturada en az bir satış kalemi bulunmalıdır!");
      return;
    }

    const cleanVkn = (aliciVknTckn || "").replace(/\D/g, "");
    if (cleanVkn.length !== 11 && cleanVkn.length !== 10) {
      showWarning("TCKN (11 hane) veya VKN (10 hane) geçerli uzunlukta olmalıdır!");
    }

    if (!aliciUnvan.trim()) {
      showError("Alıcı Ünvanı / Müşteri Adı boş bırakılamaz!");
      return;
    }

    // Fiş Toplamı ve Ödeme Kontrolü:
    const rawDiffTL = parseFloat((genelToplam - totalOdemeTutar).toFixed(2));
    const hasVeresiye = odemeRows.some(
      (r) =>
        r.paraKodu?.trim().toUpperCase() === "VERESIYE" ||
        r.paraAdi?.toUpperCase().includes("VERESİYE") ||
        r.paraAdi?.toUpperCase().includes("AÇIK HESAP")
    );

    if (rawDiffTL < -0.05) {
      showError(
        `⛔ Ödeme / tahsilat tutarı (${totalOdemeTutar.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺), fiş genel toplamından (${genelToplam.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺) fazladır! Aradaki ${(Math.abs(rawDiffTL)).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺ eksi (-) farkı lütfen düzeltiniz.`
      );
      return;
    }

    if (totalOdemeTutar > 0 && rawDiffTL > 0.05 && !forceOdemeFarkApprove) {
      setShowOdemeFarkConfirmModal({ show: true, andPrint: withPrint, rawDiffTL });
      return;
    }

    // Veresiye varsa Cari Kart zorunluluğu: satırda veya başlıkta kayıtlı bir cari kart olmalıdır
    const anonymousVeresiye = odemeRows.find(
      (r) =>
        (r.paraKodu?.trim().toUpperCase() === "VERESIYE" ||
          r.paraAdi?.toUpperCase().includes("VERESİYE") ||
          r.paraAdi?.toUpperCase().includes("AÇIK HESAP")) &&
        !r.cariKartId &&
        (!cariKartId || aliciUnvan.trim() === "NİHAİ TÜKETİCİ")
    );

    if (anonymousVeresiye) {
      showWarning("Veresiye / Açık hesap tutarı kaydedebilmek için lütfen satıra veya başlığa ait kayıtlı bir Müşteri / Cari seçiniz!");
      pendingVeresiyeRowIdRef.current = anonymousVeresiye.id;
      setMusteriSearchTerm(aliciUnvan !== "NİHAİ TÜKETİCİ" ? aliciUnvan : cariKod);
      setShowMusteriModal(true);
      return;
    }

    // MASAK Kontrolü (2. Kontrol Noktası: Kaydederken limit aşıyorsa uyarır, Fiş Dizayn Tipi = 1 ise gayriresmi işlem olduğundan sınır ve kontrol çalışmaz)
    const activeStatId = faturaTipi === 0 ? companyDefinitions?.ALIS_ISTATISTIK_ID : companyDefinitions?.SATIS_ISTATISTIK_ID;
    const activeStat = statisticList.find((s) => s.id === Number(activeStatId));
    const isGayriResmi = activeStat && Number(activeStat.fisDizaynTipi) === 1;

    const MASAK_LIMIT = 185000;
    if (genelToplam >= MASAK_LIMIT && !bypassMasakWarning && !isGayriResmi) {
      const isMissingInfo =
        cleanVkn === "11111111111" ||
        aliciUnvan.trim().toUpperCase() === "NİHAİ TÜKETİCİ" ||
        !adres.trim();

      setPendingSaveWithPrint(withPrint);
      if (isMissingInfo) {
        setShowMasakLimitWarningModal(true);
        return;
      } else {
        setShowMasakConfirmModal(true);
        return;
      }
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      const payloadSatirlar: SavePerakendeFaturaSatiriPayload[] = validItems.map((item) => ({
        altinUrunId: item.altinUrunId,
        barkod: item.barkod,
        urunAdi: item.urunAdi || "Altın Ürün",
        ayar: item.ayar,
        miktar: parseDecimal(item.miktar) || 1,
        birim: item.birim,
        gram: parseDecimal(item.gram) || 0,
        hasGram: parseDecimal(item.hasGram) || 0,
        birimFiyat: parseDecimal(item.birimFiyat) || 0,
        kdvOrani: parseDecimal(item.kdvOrani) || 0,
      }));

      let payloadOdemeler: SavePerakendeFaturaOdemePayload[] = odemeRows
        .filter((r) => parseDecimal(r.tutar) > 0 || parseDecimal(r.miktar) > 0 || r.cariKartId || (r.cariKod && r.cariKod.trim() !== ""))
        .map((r, idx) => {
          return {
            satirNo: idx + 1,
            odemeAraciTuru: r.odemeAraciTuru || 0,
            cariKartId: r.odemeAraciTuru === 1 ? (r.cariKartId || null) : null,
            posCihaziId: r.odemeAraciTuru === 2 ? (r.posCihaziId || r.bankaId || null) : null,
            cariKod: r.cariKod || null,
            cariUnvan: r.cariUnvan || null,
            paraId: r.paraId ?? null,
            paraKodu: r.paraKodu || "TL",
            paraAdi: r.paraAdi || (r.paraKodu === "TL" ? "TÜRK LİRASI" : ""),
            adet: r.adet !== "" && r.adet !== null && r.adet !== undefined ? parseDecimal(r.adet) : null,
            miktar: r.miktar !== "" && r.miktar !== null && r.miktar !== undefined ? parseDecimal(r.miktar) : null,
            milyem: r.milyem !== "" && r.milyem !== null && r.milyem !== undefined ? parseDecimal(r.milyem) : null,
            hasGram: r.hasGram !== "" && r.hasGram !== null && r.hasGram !== undefined ? parseDecimal(r.hasGram) : null,
            kur: parseDecimal(r.kur) || 1,
            tutar: parseDecimal(r.tutar) || 0,
          };
        });

      if (payloadOdemeler.length === 0 && genelToplam > 0) {
        payloadOdemeler = [{
          satirNo: 1,
          odemeAraciTuru: 0,
          cariKartId: null,
          posCihaziId: null,
          cariKod: null,
          cariUnvan: null,
          paraId: 1,
          paraKodu: "TL",
          paraAdi: "TÜRK LİRASI",
          adet: null,
          miktar: genelToplam,
          milyem: null,
          hasGram: null,
          kur: 1,
          tutar: genelToplam,
        }];
      }

      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const liveTarih = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      const liveSaat = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
      const finalTarihStr = isDuzeltmeMode ? `${tarih}T${saat}:00` : `${liveTarih}T${liveSaat}:00`;

      const payload: SavePerakendeFaturaPayload = {
        faturaId: currentFaturaId,
        vezneId: selectedVezne?.id || 1,
        faturaNo: faturaNo.trim(),
        tarih: finalTarihStr,
        faturaTipi,
        senaryo,
        cariKartId,
        aliciVknTckn: cleanVkn || "11111111111",
        aliciUnvan: aliciUnvan.trim(),
        adres: adres.trim() || undefined,
        ilce: ilce.trim() || undefined,
        il: il.trim() || undefined,
        vergiDairesi: vergiDairesi.trim() || undefined,
        telefon: telefon.trim() || undefined,
        eposta: eposta.trim() || undefined,
        paraId: 1, // TL
        kur: 1.0,
        iskontoId: selectedIskontoId,
        iskontoKodu: iskontoKodu || (selectedIskonto ? selectedIskonto.kod || "" : ""),
        iskontoOrani: calculatedIskontoOrani,
        iskontoTutari: calculatedIskontoTutari,
        satirlar: payloadSatirlar,
        odemeler: payloadOdemeler,
      };

      const result = await PerakendeService.createInvoice(payload);

      if (withPrint) {
        // Önizlemesiz doğrudan yerel sessiz yazdırma servisine (localhost:5050) gönder
        const resolved = resolveEffectivePrinter({
          pageType: "perakende",
          tip: faturaTipi,
          vezne: selectedVezne,
          user,
          printers,
        });
        const isPos = resolved.recommendedPrintType === "POS";
        const receiptHtml = generatePerakendeReceiptHtml({
          fatura: result || payload,
          company: companyDefinitions,
          isPos,
        });
        await triggerSilentPrint({
          html: receiptHtml,
          printerName: resolved.printer?.cihazAdi || resolved.printer?.ad || null,
          copies: resolved.kopyaSayisi || 1,
          isPos,
          title: `Perakende_Fisi_${result?.faturaNo || payload?.faturaNo || "Yazdir"}`,
        });
      }

      if (isDuzeltmeMode) {
        showSuccess(withPrint ? "✅ Fiş güncellendi ve doğrudan yazıcıya gönderildi." : "Kayıt güncellendi");
        // Fiş düzenlenince otomatik son kayıt açılsın
        const res: any = await PerakendeService.listInvoices({ limit: 500 });
        const rawList = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
        if (rawList.length > 0) {
          const mappedList: PerakendeFaturaListItem[] = rawList.map((f: any) => ({
            faturaId: Number(f.faturaId ?? f.FATURA_ID) || 0,
            vezneId: f.vezneId ?? f.VEZNE_ID ?? null,
            vezneKod: f.vezneKod || f.VEZNE_KOD || "",
            vezneAd: f.vezneAd || f.VEZNE_AD || "",
            faturaNo: f.faturaNo || f.FATURA_NO || "",
            ettn: f.ettn || f.ETTN || "",
            tarih: f.tarih || f.TARIH || new Date().toISOString(),
            faturaTipi: Number(f.faturaTipi ?? f.FATURA_TIPI) === 0 ? 0 : 1,
            senaryo: f.senaryo || f.SENARYO || "EARSIVFATURA",
            cariKartId: f.cariKartId ?? f.CARI_KART_ID ?? null,
            cariKod: f.cariKod || f.CARI_KOD || null,
            cariUnvan: f.cariUnvan || f.CARI_UNVAN || null,
            aliciVknTckn: f.aliciVknTckn || f.ALICI_VKN_TCKN || "",
            aliciUnvan: f.aliciUnvan || f.ALICI_UNVAN || "",
            adres: f.adres || f.ADRES || "",
            ilce: f.ilce || f.ILCE || "",
            il: f.il || f.IL || "",
            vergiDairesi: f.vergiDairesi || f.VERGI_DAIRESI || "",
            eposta: f.eposta || f.EPOSTA || "",
            telefon: f.telefon || f.TELEFON || "",
            paraId: Number(f.paraId ?? f.PARA_ID) || 1,
            paraKodu: f.paraKodu || f.PARA_KODU || "TL",
            kur: Number(f.kur ?? f.KUR) || 1.0,
            araToplam: Number(f.araToplam ?? f.ARA_TOPLAM) || 0,
            toplamKdv: Number(f.toplamKdv ?? f.TOPLAM_KDV) || 0,
            iskontoId: f.iskontoId ?? f.ISKONTO_ID ?? null,
            iskontoKodu: f.iskontoKodu || f.ISKONTO_KODU || null,
            iskontoOrani: Number(f.iskontoOrani ?? f.ISKONTO_ORANI) || 0,
            iskontoTutari: Number(f.iskontoTutari ?? f.ISKONTO_TUTARI) || 0,
            genelToplam: Number(f.genelToplam ?? f.GENEL_TOPLAM) || 0,
            eBelgeDurumu: Number(f.eBelgeDurumu ?? f.E_BELGE_DURUMU) || 0,
            gibStatuKodu: f.gibStatuKodu || f.GIB_STATU_KODU || null,
            ekleyenId: f.ekleyenId ?? f.EKLEYEN_ID ?? null,
            eklemeZamani: f.eklemeZamani || f.EKLEME_ZAMANI || null,
          })).sort((a, b) => (Number(a.faturaId) || 0) - (Number(b.faturaId) || 0));

          setHistoryList(mappedList);
          const targetId = result?.faturaId || currentFaturaId || mappedList[mappedList.length - 1]?.faturaId;
          if (targetId) {
            const idx = mappedList.findIndex((x) => x.faturaId === targetId);
            setCurrentIndex(idx >= 0 ? idx : mappedList.length - 1);
            await handleSelectInvoiceForEdit(targetId);
          }
        }
      } else {
        if (await ebFis.kaydedildi(result?.faturaId, true)) return;
        handleReset();
        showSuccess(withPrint ? "✅ Fiş başarıyla kaydedildi ve doğrudan yazıcıya gönderildi." : "Satış başarıyla kaydedildi.");
      }
    } catch (err: any) {
      const msg =
        err.response?.data?.message || err.message || "Fatura ve satış kaydedilirken bir hata oluştu.";
      showError(msg);
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };
  handleCompleteSaleRef.current = handleCompleteSale;

  // Invoices History (Toolbar onSearch / F3)
  const handleOpenHistory = async () => {
    setShowHistoryModal(true);
    setHistoryLoading(true);
    try {
      const res: any = await PerakendeService.listInvoices({
        baslangicTarihi: historyStartDate,
        bitisTarihi: historyEndDate,
        search: historySearch.trim() || undefined,
        limit: 100,
      });
      const rawList = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      const mappedList: PerakendeFaturaListItem[] = rawList.map((f: any) => ({
        faturaId: Number(f.faturaId ?? f.FATURA_ID) || 0,
        vezneId: f.vezneId ?? f.VEZNE_ID ?? null,
        vezneKod: f.vezneKod || f.VEZNE_KOD || "",
        vezneAd: f.vezneAd || f.VEZNE_AD || "",
        faturaNo: f.faturaNo || f.FATURA_NO || "",
        ettn: f.ettn || f.ETTN || "",
        tarih: f.tarih || f.TARIH || new Date().toISOString(),
        faturaTipi: Number(f.faturaTipi ?? f.FATURA_TIPI) === 0 ? 0 : 1,
        senaryo: f.senaryo || f.SENARYO || "EARSIVFATURA",
        cariKartId: f.cariKartId ?? f.CARI_KART_ID ?? null,
        cariKod: f.cariKod || f.CARI_KOD || null,
        cariUnvan: f.cariUnvan || f.CARI_UNVAN || null,
        aliciVknTckn: f.aliciVknTckn || f.ALICI_VKN_TCKN || "",
        aliciUnvan: f.aliciUnvan || f.ALICI_UNVAN || "",
        adres: f.adres || f.ADRES || "",
        ilce: f.ilce || f.ILCE || "",
        il: f.il || f.IL || "",
        vergiDairesi: f.vergiDairesi || f.VERGI_DAIRESI || "",
        eposta: f.eposta || f.EPOSTA || "",
        telefon: f.telefon || f.TELEFON || "",
        paraId: Number(f.paraId ?? f.PARA_ID) || 1,
        paraKodu: f.paraKodu || f.PARA_KODU || "TL",
        kur: Number(f.kur ?? f.KUR) || 1.0,
        araToplam: Number(f.araToplam ?? f.ARA_TOPLAM) || 0,
        toplamKdv: Number(f.toplamKdv ?? f.TOPLAM_KDV) || 0,
        iskontoId: f.iskontoId ?? f.ISKONTO_ID ?? null,
        iskontoKodu: f.iskontoKodu || f.ISKONTO_KODU || null,
        iskontoOrani: Number(f.iskontoOrani ?? f.ISKONTO_ORANI) || 0,
        iskontoTutari: Number(f.iskontoTutari ?? f.ISKONTO_TUTARI) || 0,
        genelToplam: Number(f.genelToplam ?? f.GENEL_TOPLAM) || 0,
        eBelgeDurumu: Number(f.eBelgeDurumu ?? f.E_BELGE_DURUMU) || 0,
        gibStatuKodu: f.gibStatuKodu || f.GIB_STATU_KODU || null,
        ekleyenId: f.ekleyenId ?? f.EKLEYEN_ID ?? null,
        eklemeZamani: f.eklemeZamani || f.EKLEME_ZAMANI || null,
      })).sort((a, b) => (Number(a.faturaId) || 0) - (Number(b.faturaId) || 0));

      setHistoryList(mappedList);
    } catch (err: any) {
      showError("Faturalar aranırken hata oluştu: " + (err.message || ""));
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSearchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res: any = await PerakendeService.listInvoices({
        baslangicTarihi: historyStartDate,
        bitisTarihi: historyEndDate,
        search: historySearch.trim() || undefined,
        limit: 100,
      });
      const rawList = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      const mappedList: PerakendeFaturaListItem[] = rawList.map((f: any) => ({
        faturaId: Number(f.faturaId ?? f.FATURA_ID) || 0,
        vezneId: f.vezneId ?? f.VEZNE_ID ?? null,
        vezneKod: f.vezneKod || f.VEZNE_KOD || "",
        vezneAd: f.vezneAd || f.VEZNE_AD || "",
        faturaNo: f.faturaNo || f.FATURA_NO || "",
        ettn: f.ettn || f.ETTN || "",
        tarih: f.tarih || f.TARIH || new Date().toISOString(),
        faturaTipi: Number(f.faturaTipi ?? f.FATURA_TIPI) === 0 ? 0 : 1,
        senaryo: f.senaryo || f.SENARYO || "EARSIVFATURA",
        cariKartId: f.cariKartId ?? f.CARI_KART_ID ?? null,
        aliciVknTckn: f.aliciVknTckn || f.ALICI_VKN_TCKN || "",
        aliciUnvan: f.aliciUnvan || f.ALICI_UNVAN || "",
        adres: f.adres || f.ADRES || "",
        ilce: f.ilce || f.ILCE || "",
        il: f.il || f.IL || "",
        vergiDairesi: f.vergiDairesi || f.VERGI_DAIRESI || "",
        eposta: f.eposta || f.EPOSTA || "",
        telefon: f.telefon || f.TELEFON || "",
        paraId: Number(f.paraId ?? f.PARA_ID) || 1,
        paraKodu: f.paraKodu || f.PARA_KODU || "TL",
        kur: Number(f.kur ?? f.KUR) || 1.0,
        araToplam: Number(f.araToplam ?? f.ARA_TOPLAM) || 0,
        toplamKdv: Number(f.toplamKdv ?? f.TOPLAM_KDV) || 0,
        iskontoId: f.iskontoId ?? f.ISKONTO_ID ?? null,
        iskontoKodu: f.iskontoKodu || f.ISKONTO_KODU || null,
        iskontoOrani: Number(f.iskontoOrani ?? f.ISKONTO_ORANI) || 0,
        iskontoTutari: Number(f.iskontoTutari ?? f.ISKONTO_TUTARI) || 0,
        genelToplam: Number(f.genelToplam ?? f.GENEL_TOPLAM) || 0,
        eBelgeDurumu: Number(f.eBelgeDurumu ?? f.E_BELGE_DURUMU) || 0,
        gibStatuKodu: f.gibStatuKodu || f.GIB_STATU_KODU || null,
        ekleyenId: f.ekleyenId ?? f.EKLEYEN_ID ?? null,
        eklemeZamani: f.eklemeZamani || f.EKLEME_ZAMANI || null,
      })).sort((a, b) => (Number(a.faturaId) || 0) - (Number(b.faturaId) || 0));

      setHistoryList(mappedList);
    } catch (err: any) {
      showError("Filtreleme hatası: " + (err.message || ""));
    } finally {
      setHistoryLoading(false);
    }
  };

  // Load single invoice by ID
  const handleSelectInvoiceForEdit = async (id: number) => {
    try {
      const inv: any = await PerakendeService.getInvoiceById(id);
      if (!inv) {
        showError("Fatura detayları getirilemedi.");
        return;
      }

      setCurrentFaturaId(inv.faturaId);
      setFaturaNo(inv.faturaNo || "");
      if (inv.tarih) {
        setTarih(inv.tarih.substring(0, 10));
        setSaat(inv.tarih.substring(11, 16) || "12:00");
      }
      setFaturaTipi(Number(inv.faturaTipi ?? inv.FATURA_TIPI) === 0 ? 0 : 1);
      setSenaryo(inv.senaryo || "EARSIVFATURA");
      setAliciVknTckn(inv.aliciVknTckn || "11111111111");
      setAliciUnvan(inv.aliciUnvan || "NİHAİ TÜKETİCİ");
      setCariKartId(inv.cariKartId || null);
      setAdres(inv.adres || "");
      setIlce(inv.ilce || "");
      setIl(inv.il || "");
      setVergiDairesi(inv.vergiDairesi || "");
      setTelefon(inv.telefon || "");
      setEposta(inv.eposta || "");
      setSelectedIskontoId(inv.iskontoId ?? inv.ISKONTO_ID ?? null);
      setIskontoKodu(inv.iskontoKodu || inv.ISKONTO_KODU || "");
      setIskontoOrani(Number(inv.iskontoOrani ?? inv.ISKONTO_ORANI) || 0);
      setIskontoTutari(Number(inv.iskontoTutari ?? inv.ISKONTO_TUTARI) || 0);

      if (inv.cariKod || inv.CARI_KOD) {
        setCariKod(inv.cariKod || inv.CARI_KOD);
      } else if (inv.cariKartId) {
        try {
          const c = cariler.find((x) => x.id === inv.cariKartId) || (await CariService.getCariKartById(inv.cariKartId));
          if (c?.kod) setCariKod(c.kod);
          else if ((c as any)?.cariKodu) setCariKod((c as any).cariKodu);
        } catch {
          setCariKod("");
        }
      } else {
        setCariKod("");
      }

      const rawSatirlar: any[] = inv.satirlar || inv.SATIRLAR || [];
      if (rawSatirlar && rawSatirlar.length > 0) {
        const loadedItems: CartLineItem[] = rawSatirlar.map((s: any) => {
          const rawMiktar = s.miktar ?? s.MIKTAR;
          const miktar = parseDecimal(rawMiktar) || 1;
          const birimFiyat = parseDecimal(s.birimFiyat ?? s.BIRIM_FIYAT) || 0;
          const tutar = parseDecimal(s.tutar ?? s.TUTAR) || Math.round(miktar * birimFiyat * 100) / 100;
          const kdvOrani = parseDecimal(s.kdvOrani ?? s.KDV_ORANI) || 0;
          const kdvTutari =
            parseDecimal(s.kdvTutari ?? s.KDV_TUTARI) ||
            Math.round(tutar * (kdvOrani / 100) * 100) / 100;
          const toplamTutar =
            parseDecimal(s.toplamTutar ?? s.TOPLAM_TUTAR ?? s.grandTotal) ||
            Math.round((tutar + kdvTutari) * 100) / 100;

          return {
            id: makeId(),
            altinUrunId: s.altinUrunId ?? s.ALTIN_URUN_ID ?? null,
            barkod: s.barkod || s.BARKOD || "",
            urunAdi: s.urunAdi || s.URUN_ADI || "Altın Ürün",
            ayar: s.ayar || s.AYAR || "14K",
            miktar: formatMiktar(rawMiktar != null ? rawMiktar : miktar),
            birim: s.birim || s.BIRIM || "Adet",
            gram: parseDecimal(s.gram ?? s.GRAM) || 0,
            hasGram: parseDecimal(s.hasGram ?? s.HAS_GRAM) || 0,
            birimFiyat,
            tutar,
            kdvOrani,
            kdvTutari,
            toplamTutar,
          };
        });
        setItems(loadedItems);
      } else {
        const invGenelToplam = Number(inv.genelToplam ?? inv.GENEL_TOPLAM) || 0;
        const invAraToplam = Number(inv.araToplam ?? inv.ARA_TOPLAM) || invGenelToplam;
        const invToplamKdv = Number(inv.toplamKdv ?? inv.TOPLAM_KDV) || 0;

        if (invGenelToplam > 0 || invAraToplam > 0) {
          setItems([
            {
              id: makeId(),
              altinUrunId: null,
              barkod: "",
              urunAdi: "Perakende Satış",
              ayar: "14K",
              miktar: 1,
              birim: "Adet",
              gram: 0,
              hasGram: 0,
              birimFiyat: invAraToplam,
              tutar: invAraToplam,
              kdvOrani: invAraToplam > 0 && invToplamKdv > 0 ? Math.round((invToplamKdv / invAraToplam) * 100) : 0,
              kdvTutari: invToplamKdv,
              toplamTutar: invGenelToplam || invAraToplam,
            },
          ]);
        } else {
          setItems([createEmptyRow()]);
        }
      }

      // Ödeme Satırlarını Yükle (ODEMELER)
      const rawOdemeler: any[] = inv.odemeler || inv.ODEMELER || inv.odemeSatirlari || [];
      if (rawOdemeler && rawOdemeler.length > 0) {
        const loadedOdemeler: OdemeRow[] = rawOdemeler.map((o: any, idx: number) => {
          const rawKod = (o.paraKodu || o.PARA_KODU || "").trim();
          let rowParaAdi = (o.paraAdi || o.PARA_ADI || "").trim();
          const rowCariId = o.cariKartId ?? o.CARI_KART_ID ?? null;
          const rowPosId = o.posCihaziId ?? o.POS_CIHAZI_ID ?? o.bankaId ?? o.BANKA_ID ?? null;
          let rowCariKod = (o.cariKod || o.CARI_KOD || "").trim();
          let rowCariUnvan = (o.cariUnvan || o.CARI_UNVAN || "").trim();

          const oat = o.odemeAraciTuru !== undefined && o.odemeAraciTuru !== null
            ? Number(o.odemeAraciTuru)
            : (rowPosId ? 2 : (rowCariId ? 1 : (rowParaAdi?.toUpperCase().includes("POS") || rowParaAdi?.toUpperCase().includes("KREDİ KARTI") ? 2 : 0)));

          if (oat === 2) {
            if (posCihazlari && posCihazlari.length > 0) {
              const matchedPos = posCihazlari.find((p) =>
                (rowPosId && p.posCihaziId === rowPosId) ||
                (rowCariKod && (p.kod || "").trim().toLowerCase() === rowCariKod.toLowerCase()) ||
                (rowParaAdi && (p.ad || "").trim().toLowerCase() === rowParaAdi.toLowerCase())
              );
              if (matchedPos) {
                if (!rowCariKod) rowCariKod = matchedPos.kod || "";
                if (!rowParaAdi || rowParaAdi === "KREDİ KARTI / POS") rowParaAdi = matchedPos.ad || "KREDİ KARTI / POS";
              }
            }
          } else if (rowCariId && (!rowCariKod || !rowCariUnvan) && cariler.length > 0) {
            const matchedC = cariler.find((c) => c.id === rowCariId);
            if (matchedC) {
              if (!rowCariKod) rowCariKod = matchedC.kod || "";
              if (!rowCariUnvan) rowCariUnvan = matchedC.ad || "";
            }
          }

          const rawMiktar = o.miktar !== null && o.miktar !== undefined && o.miktar !== "" ? o.miktar : (o.MIKTAR !== null && o.MIKTAR !== undefined ? o.MIKTAR : "");

          return {
            id: `odeme-${Date.now()}-${idx + 1}-${Math.random().toString(36).slice(2, 6)}`,
            satirNo: idx + 1,
            odemeAraciTuru: oat,
            bankaId: rowPosId || (oat === 2 ? rowCariId : null),
            paraId: o.paraId ?? o.PARA_ID ?? null,
            paraKodu: rawKod || "TL",
            paraAdi: rowParaAdi || (rawKod === "TL" ? "TÜRK LİRASI" : ""),
            cariKartId: oat === 1 ? rowCariId : null,
            cariKod: rowCariKod,
            cariUnvan: rowCariUnvan,
            adet: o.adet !== null && o.adet !== undefined && o.adet !== "" ? o.adet : (o.ADET !== null && o.ADET !== undefined ? o.ADET : ""),
            miktar: rawMiktar !== "" ? formatMiktar(rawMiktar) : "",
            milyem: o.milyem !== null && o.milyem !== undefined && o.milyem !== "" ? o.milyem : (o.MILYEM !== null && o.MILYEM !== undefined ? o.MILYEM : ""),
            hasGram: o.hasGram !== null && o.hasGram !== undefined && o.hasGram !== "" ? o.hasGram : (o.HAS_GRAM !== null && o.HAS_GRAM !== undefined ? o.HAS_GRAM : ""),
            kur: parseDecimal(o.kur ?? o.KUR) || 1,
            tutar: parseDecimal(o.tutar ?? o.TUTAR) || 0,
          };
        });
        setOdemeRows(loadedOdemeler);
      } else {
        const invGenelToplam = Number(inv.genelToplam ?? inv.GENEL_TOPLAM) || 0;
        setOdemeRows([
          {
            id: makeId(),
            paraId: 1,
            paraKodu: "TL",
            paraAdi: "TÜRK LİRASI",
            adet: "",
            miktar: "",
            milyem: "",
            hasGram: "",
            kur: 1,
            tutar: invGenelToplam > 0 ? invGenelToplam : "",
          },
        ]);
      }

      setShowHistoryModal(false);
    } catch (err) {
      console.error("handleSelectInvoiceForEdit error:", err);
      showError("Fatura yüklenirken hata oluştu.");
    }
  };

  // Delete invoice (Toolbar onDelete / F2)
  const handleDeleteInvoice = async (id: number, no: string) => {
    if (!window.confirm(`'${no}' numaralı faturayı silmek ve ürünleri stoğa iade etmek istediğinize emin misiniz?`)) {
      return;
    }

    try {
      await PerakendeService.deleteInvoice(id);
      setHistoryList((prev) => prev.filter((f) => f.faturaId !== id));

      if (currentFaturaId === id) {
        const remaining = historyList.filter((f) => f.faturaId !== id);
        if (remaining.length > 0) {
          const last = remaining[remaining.length - 1];
          await handleSelectInvoiceForEdit(last.faturaId);
        } else {
          handleReset();
        }
      }
    } catch (err: any) {
      showError("Fatura silinirken hata: " + (err.message || ""));
    }
  };

  const handleDeleteCurrent = async () => {
    if (!currentFaturaId) return;
    await handleDeleteInvoice(currentFaturaId, faturaNo);
  };

  // Navigation handlers
  const handleFirst = async () => {
    if (historyList.length === 0) return;
    const sorted = [...historyList].sort((a, b) => a.faturaId - b.faturaId);
    setCurrentIndex(0);
    await handleSelectInvoiceForEdit(sorted[0].faturaId);
  };

  const handlePrev = async () => {
    if (historyList.length === 0) return;
    const sorted = [...historyList].sort((a, b) => a.faturaId - b.faturaId);
    const currIdx = sorted.findIndex((f) => f.faturaId === currentFaturaId);
    const nextIdx = currIdx > 0 ? currIdx - 1 : 0;
    setCurrentIndex(nextIdx);
    await handleSelectInvoiceForEdit(sorted[nextIdx].faturaId);
  };

  const handleNext = async () => {
    if (historyList.length === 0) return;
    const sorted = [...historyList].sort((a, b) => a.faturaId - b.faturaId);
    const currIdx = sorted.findIndex((f) => f.faturaId === currentFaturaId);
    const nextIdx = currIdx >= 0 && currIdx < sorted.length - 1 ? currIdx + 1 : sorted.length - 1;
    setCurrentIndex(nextIdx);
    await handleSelectInvoiceForEdit(sorted[nextIdx].faturaId);
  };

  const handleLast = async () => {
    if (historyList.length === 0) return;
    const sorted = [...historyList].sort((a, b) => a.faturaId - b.faturaId);
    const lastIdx = sorted.length - 1;
    setCurrentIndex(lastIdx);
    await handleSelectInvoiceForEdit(sorted[lastIdx].faturaId);
  };

  const handleViewInvoiceDetail = async (id: number) => {
    try {
      const inv = await PerakendeService.getInvoiceById(id);
      if (inv) {
        setPrintedFatura(inv);
        setShowPrintModal(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Sağ tık kalanı kapat
  const handleKapatRow = useCallback((rowId: string) => {
    const otherPaidTL = odemeRows
      .filter((r, idx) => r.id !== rowId && String(idx) !== String(rowId))
      .reduce((s, r) => s + (Number(r.tutar) || 0), 0);
    const kalanTL = Math.max(0, parseFloat((genelToplam - otherPaidTL).toFixed(2)));
    const hasKuruVal = Number(altinHasKuru) || 0;

    setOdemeRows((prev) =>
      prev.map((r, idx) => {
        if (r.id !== rowId && String(idx) !== String(rowId)) return r;
        const pk = r.paraKodu ? r.paraKodu.trim().toUpperCase() : "";
        const isTL = pk === "TL" || pk === "TRY" || !pk;

        if (isTL) {
          const hasVal = hasKuruVal > 0 && kalanTL > 0 ? parseFloat((kalanTL / hasKuruVal).toFixed(4)) : "";
          return {
            ...r,
            paraKodu: "TL",
            paraAdi: "TÜRK LİRASI",
            adet: kalanTL > 0 ? 1 : "",
            miktar: kalanTL > 0 ? kalanTL : "",
            kur: 1,
            tutar: kalanTL > 0 ? kalanTL : "",
            hasGram: hasVal,
          };
        }

        let rowKur = Number(r.kur) || 0;
        if (rowKur <= 0) rowKur = 1;

        const miktarVal = rowKur > 0 && kalanTL > 0 ? parseFloat((kalanTL / rowKur).toFixed(4)) : (kalanTL || "");
        const hasVal = hasKuruVal > 0 && kalanTL > 0 ? parseFloat((kalanTL / hasKuruVal).toFixed(4)) : "";
        return {
          ...r,
          adet: 1,
          miktar: miktarVal,
          tutar: kalanTL > 0 ? kalanTL : "",
          hasGram: hasVal,
          kur: rowKur,
        };
      })
    );
  }, [odemeRows, genelToplam, altinHasKuru]);

  // Sağ tık ERP Menüsü Olayları (Kalanı Kapat, Satırı Sil & Satır Ekle)
  useEffect(() => {
    const handleGridKapat = (e: any) => {
      const rowId = e.detail?.rowId;
      if (rowId) {
        handleKapatRow(rowId);
      } else if (odemeRows.length > 0) {
        handleKapatRow(odemeRows[odemeRows.length - 1].id);
      }
    };

    const handleGridDelete = (e: any) => {
      const rowId = e.detail?.rowId;
      const tableType = e.detail?.tableType;
      if (!rowId) return;

      if (tableType === "odeme" || odemeRows.some((o, idx) => o.id === rowId || String(idx) === String(rowId))) {
        handleDeleteOdemeRow(rowId);
      } else {
        handleDeleteRow(rowId);
      }
    };

    const handleGridAdd = (e: any) => {
      const tableType = e.detail?.tableType;
      const rowId = e.detail?.rowId;

      if (tableType === "odeme" || (rowId && odemeRows.some((o, idx) => o.id === rowId || String(idx) === String(rowId)))) {
        setOdemeRows((prev) => [...prev, createEmptyOdemeRow(prev.length + 1)]);
      } else {
        handleAddPerakendeRow();
      }
    };

    window.addEventListener("erp-grid-row-kapat", handleGridKapat);
    window.addEventListener("erp-grid-row-delete", handleGridDelete);
    window.addEventListener("erp-grid-row-add", handleGridAdd);
    return () => {
      window.removeEventListener("erp-grid-row-kapat", handleGridKapat);
      window.removeEventListener("erp-grid-row-delete", handleGridDelete);
      window.removeEventListener("erp-grid-row-add", handleGridAdd);
    };
  }, [handleDeleteRow, handleDeleteOdemeRow, handleKapatRow, odemeRows, handleAddPerakendeRow]);



  // Vezne Lookup Columns
  const vezneLookupColumns: LookupColumn<VezneItem>[] = [
    { header: "Kod", width: "100px", align: "center", render: (v) => <span className="fw-bold">{v.kod}</span> },
    { header: "Vezne Adı", render: (v) => <span>{v.ad}</span> },
  ];

  // Payment Product Lookup Columns
  const odemeLookupColumns: LookupColumn<UrunItem>[] = [
    { header: "Kod", width: "110px", render: (u) => <span className="fw-bold font-monospace text-primary">{u.kod}</span>, highlight: true },
    { header: "Para / Ürün Tanımı", render: (u) => <span className="fw-semibold text-dark">{u.ad}</span>, highlight: false },
    {
      header: "Tip",
      width: "105px",
      align: "center",
      highlight: false,
      render: (u) => {
        const kod = (u.kod || "").toUpperCase().trim();
        const ad = (u.ad || "").toUpperCase().trim();

        let tipLabel = "Nakit";
        let badgeStyle: React.CSSProperties = {
          backgroundColor: "#f3f4f6",
          color: "#374151",
          border: "1px solid #e5e7eb",
          fontWeight: 600,
          fontSize: "11px",
          padding: "3px 8px",
          borderRadius: "4px",
          display: "inline-block",
        };

        // İskonto kontrolü (en önce)
        const isIskontoItem =
          (u as any).isIskonto === true ||
          u.urunTipi === 99 ||
          kod.startsWith("ISK") ||
          ad.includes("İSKONTO") ||
          ad.includes("ISKONTO");

        if (isIskontoItem) {
          tipLabel = "İskonto";
          badgeStyle = {
            backgroundColor: "#f0fdf4",
            color: "#15803d",
            border: "1px solid #86efac",
            fontWeight: 600,
            fontSize: "11px",
            padding: "3px 8px",
            borderRadius: "4px",
            display: "inline-block",
          };
        } else if (kod === "VERESIYE" || kod === "VERESİYE" || kod === "ACIKHESAP" || kod === "AÇIK HESAP") {
          tipLabel = "Açık Hesap";
          badgeStyle = {
            backgroundColor: "#fef2f2",
            color: "#dc2626",
            border: "1px solid #fecaca",
            fontWeight: 600,
            fontSize: "11px",
            padding: "3px 8px",
            borderRadius: "4px",
            display: "inline-block",
          };
        } else if (
          u.urunTipi === 3 ||
          kod.includes("GUMUS") ||
          kod.includes("GÜMÜŞ") ||
          ad.includes("GÜMÜŞ") ||
          ad.includes("GUMUS")
        ) {
          tipLabel = "Gümüş";
          badgeStyle = {
            backgroundColor: "#f8fafc",
            color: "#475569",
            border: "1px solid #cbd5e1",
            fontWeight: 600,
            fontSize: "11px",
            padding: "3px 8px",
            borderRadius: "4px",
            display: "inline-block",
          };
        } else if (
          u.urunTipi === 2 ||
          kod === "HAS" ||
          kod.includes("ALTIN") ||
          kod.includes("AYAR") ||
          ad.includes("ALTIN") ||
          ad.includes("AYAR") ||
          ad.includes("BİLEZİK") ||
          ad.includes("BILEZIK") ||
          ad.includes("ZİYNET") ||
          ad.includes("ZIYNET") ||
          ad.includes("CEYREK") ||
          ad.includes("ÇEYREK") ||
          ad.includes("YARIM") ||
          ad.includes("TAM") ||
          ad.includes("ATA")
        ) {
          tipLabel = "Altın";
          badgeStyle = {
            backgroundColor: "#fefce8",
            color: "#854d0e",
            border: "1px solid #fef08a",
            fontWeight: 600,
            fontSize: "11px",
            padding: "3px 8px",
            borderRadius: "4px",
            display: "inline-block",
          };
        } else if (
          u.urunTipi === 1 ||
          kod === "USD" ||
          kod === "EUR" ||
          kod === "GBP" ||
          kod === "CHF" ||
          ad.includes("DOLAR") ||
          ad.includes("EURO")
        ) {
          tipLabel = "Döviz";
          badgeStyle = {
            backgroundColor: "#eff6ff",
            color: "#1d4ed8",
            border: "1px solid #bfdbfe",
            fontWeight: 600,
            fontSize: "11px",
            padding: "3px 8px",
            borderRadius: "4px",
            display: "inline-block",
          };
        }

        return <span style={badgeStyle}>{tipLabel}</span>;
      },
    },
    {
      header: "Alış Milyem",
      width: "100px",
      align: "right",
      render: (u) => (
        <span className="font-monospace fw-bold text-success">
          {u.alisMilyem ? `${u.alisMilyem} ‰` : (u.hasOrani ? `${u.hasOrani} ‰` : "-")}
        </span>
      ),
    },
    {
      header: "Satış Milyem",
      width: "100px",
      align: "right",
      render: (u) => (
        <span className="font-monospace fw-bold text-primary">
          {u.satisMilyem ? `${u.satisMilyem} ‰` : (u.hasOrani ? `${u.hasOrani} ‰` : "-")}
        </span>
      ),
    },
  ];

  // e-Banka mutabakatından "Fiş kes" ile gelindiyse cari / tarih / yön dolu açılır
  const ebFis = useEBankaFisKesimi("perakende", cariler.length > 0 && !isDuzeltmeMode, (b) => {
    setFaturaTipi(b.tip);
    if (b.musteri) void handleSelectCustomer(b.musteri);
    setTarih(b.tarih);
  });

  return (
    <div
      className="perakende-fisi-page w-100 pb-3"
      style={{
        fontFamily: "'Segoe UI', sans-serif",
        fontSize: "12.5px",
        minHeight: "100vh",
        border: isMasakBlocked ? "4px solid #dc2626" : "none",
        boxShadow: isMasakBlocked ? "inset 0 0 16px rgba(220, 38, 38, 0.4)" : "none",
        backgroundColor: isMasakBlocked ? "#fff5f5" : undefined,
        transition: "all 0.3s ease",
        "--active-fis-theme-bg": activeFisThemeBg,
      } as React.CSSProperties}
    >
      {ebFis.bant}

      {/* MASAK Malvarlığı Dondurulanlar Kırmızı Bloke Uyarısı */}
      {isMasakBlocked && (
        <Alert variant="danger" className="d-flex align-items-center justify-content-between my-2 py-2.5 px-3 shadow border-2 border-danger bg-danger text-white">
          <div className="d-flex align-items-center gap-2">
            <IconShieldCheck size={28} className="text-white flex-shrink-0" />
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

      {/* ─── 1. Top ERP Toolbar ────────────────────────────────────────── */}
      <ERPToolbar
        disableShortcuts
        pageTitle={
          <span style={{ fontWeight: 700, fontSize: "14px" }}>
            {isDuzeltmeMode ? "D- Perakende Fişi Düzeltme" : "C- Perakende Fişi Kayıt"}{" "}
            <Badge bg={faturaTipi === 1 ? "success" : "primary"} style={{ fontSize: "11px" }}>
              {faturaTipi === 1 ? "SATIŞ" : "ALIŞ"}
            </Badge>
            <Badge bg="primary" className="ms-1" style={{ fontSize: "11px" }}>
              {senaryo === "EARSIVFATURA"
                ? "e-Arşiv"
                : senaryo === "TEMELFATURA"
                  ? "Temel Fatura"
                  : "e-Fatura"}
            </Badge>
          </span>
        }
        pageIcon={<IconBarcode size={20} />}
        onNew={handleNew}
        onSave={() => handleCompleteSale(false)}
        onPrint={() => handleCompleteSale(true)}
        onDetailSearch={openMusteriDetayModal}
        onSearch={isDuzeltmeMode ? handleOpenHistory : undefined}
        onDelete={isDuzeltmeMode && currentFaturaId ? handleDeleteCurrent : undefined}
        hideSearch={!isDuzeltmeMode}
        hideDelete={!isDuzeltmeMode || !currentFaturaId}
        hideNavigation={!isDuzeltmeMode}
        onFirst={isDuzeltmeMode ? handleFirst : undefined}
        onPrev={isDuzeltmeMode ? handlePrev : undefined}
        onNext={isDuzeltmeMode ? handleNext : undefined}
        onLast={isDuzeltmeMode ? handleLast : undefined}
        rightContent={
          <div className="d-flex align-items-center gap-2">
            {/* Üstteki kompakt tarih ve saat bölümü (Refresh butonunun hemen solunda) */}
            {isDuzeltmeMode ? (
              <div className="d-flex align-items-center gap-1 bg-white px-2 py-0.5 border rounded shadow-2xs font-monospace" style={{ height: "28px" }}>
                <span className="text-secondary fw-bold" style={{ fontSize: "11px" }}>TARİH</span>
                <input
                  type="date"
                  className="form-control form-control-sm border-0 p-0 text-center fw-semibold text-dark bg-transparent"
                  style={{ width: "110px", fontSize: "11.5px", height: "22px" }}
                  value={tarih}
                  onChange={(e) => setTarih(e.target.value)}
                  title="Kayıtlı Fiş Tarihi (Düzenlenebilir)"
                />
                <input
                  type="time"
                  className="form-control form-control-sm border-0 p-0 text-center text-secondary bg-transparent"
                  style={{ width: "55px", fontSize: "11px", height: "22px" }}
                  value={saat}
                  onChange={(e) => setSaat(e.target.value)}
                  title="Kayıtlı Fiş Saati (Düzenlenebilir)"
                />
              </div>
            ) : (
              <div
                className="d-flex align-items-center gap-1 px-2 py-0.5 rounded border bg-white shadow-2xs font-monospace text-dark"
                style={{ height: "28px", fontSize: "11px", cursor: "default", color: "#000000" }}
                title="Fiş Kayıt Tarihi ve Saati (Otomatik / Değiştirilemez)"
              >
                <IconClock size={13} className="text-dark" style={{ color: "#000000" }} />
                <span className="fw-semibold text-dark" style={{ color: "#000000" }}>
                  {tarih ? tarih.split("-").reverse().join(".") : ""}
                </span>
                <strong className="text-dark" style={{ color: "#000000" }}>
                  {saat}
                </strong>
              </div>
            )}
            {isDuzeltmeMode && (
              <Button
                variant="outline-primary"
                size="sm"
                className="py-1 px-2 fw-semibold d-flex align-items-center gap-1"
                style={{ fontSize: "11px", height: "28px" }}
                onClick={() => navigate("/vezne/perakende-fisi-kayit")}
                title="Kayıt Sayfasına Git"
              >
                <IconPlus size={15} />
                <span>Kayıt Sayfası</span>
              </Button>
            )}
          </div>
        }
      />

      {/* ─── 2. Top Vezne & Fatura Parametreleri Barı (Responsive) ───── */}
      <div
        className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2 p-1.5 border rounded bg-light"
        style={{ fontSize: "12px" }}
      >
        <div className="d-flex align-items-center flex-wrap gap-2">
          {/* Vezne (Giriş Yapanın Veznesi - Sabit ve Değiştirilemez) */}
          <div className="d-flex align-items-center gap-1">
            <span className="fw-bold text-primary" style={{ minWidth: 45 }}>
              VEZNE
            </span>
            <input
              type="text"
              value={selectedVezne?.kod || user?.cashierCode || "01"}
              readOnly
              disabled
              className="form-control form-control-sm text-center fw-bold bg-light"
              style={{ width: 60, fontSize: "12px", cursor: "not-allowed" }}
              title="Vezne giriş yapan kullanıcıya aittir ve değiştirilemez"
            />
            {selectedVezne?.ad && (
              <span className="text-muted small ms-1 d-none d-md-inline">({selectedVezne.ad})</span>
            )}
          </div>

          {/* Fatura No */}
          <div className="d-flex align-items-center gap-1">
            <span className="fw-bold text-secondary" style={{ minWidth: 65 }}>
              FATURA NO
            </span>
            <input
              type="text"
              className="form-control form-control-sm font-monospace fw-bold text-primary bg-white"
              value={faturaNo}
              onChange={(e) => setFaturaNo(e.target.value)}
              placeholder="Otomatik (Numaratör)"
              style={{ width: 160, fontSize: "11.5px" }}
            />
          </div>

          {/* Senaryo */}
          <div className="d-flex align-items-center gap-1">
            <span className="fw-bold text-secondary">SENARYO</span>
            <Form.Select
              size="sm"
              style={{ width: 145, fontSize: "12px", fontWeight: 600 }}
              value={senaryo}
              onChange={(e) => {
                const newSenaryo = e.target.value;
                setSenaryo(newSenaryo);
                if (faturaNo) {
                  const pfx = (newSenaryo === "TEMELFATURA" || newSenaryo === "TICARIFATURA") ? "GIB" : "EAR";
                  PerakendeService.getNextFaturaNo(pfx).then(setFaturaNo).catch(console.error);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === " " || e.code === "Space" || e.keyCode === 32) {
                  e.preventDefault();
                  e.stopPropagation();
                  const order = ["EARSIVFATURA", "TICARIFATURA", "TEMELFATURA"];
                  const curIdx = order.indexOf(senaryo);
                  const nextSenaryo = order[(curIdx + 1) % order.length];
                  setSenaryo(nextSenaryo);
                  if (faturaNo) {
                    const pfx = (nextSenaryo === "TEMELFATURA" || nextSenaryo === "TICARIFATURA") ? "GIB" : "EAR";
                    PerakendeService.getNextFaturaNo(pfx).then(setFaturaNo).catch(console.error);
                  }
                }
              }}
            >
              <option value="EARSIVFATURA">e-Arşiv</option>
              <option value="TICARIFATURA">e-Fatura</option>
              <option value="TEMELFATURA">Temel Fatura</option>
            </Form.Select>
          </div>
        </div>

        {/* Fatura Tipi / İşlem: Sadece Alış (0) ve Satış (1) */}
        <div className="d-flex align-items-center gap-1">
          <span className="fw-bold text-secondary small">İŞLEM:</span>
          <Form.Select
            size="sm"
            style={{ width: 100, fontSize: "12px", fontWeight: 700 }}
            className={faturaTipi === 1 ? "text-success border-success" : "text-primary border-primary"}
            value={faturaTipi}
            onChange={(e) => {
              const newTip = Number(e.target.value);
              setFaturaTipi(newTip);
              setOdemeRows((prev) => prev.map((r) => {
                if (!r.paraKodu || r.paraKodu === "TL" || r.paraKodu === "VERESIYE") return r;
                const found = odemeUrunList.find((u) => u.kod.toUpperCase() === r.paraKodu.toUpperCase());
                if (!found) return r;
                const effAlis = Number(found.alisMilyem) > 0 ? Number(found.alisMilyem) : (Number((found as any).hasAlisKatsayisi) > 0 ? Number((found as any).hasAlisKatsayisi) : (Number(found.hasOrani) || 1000));
                const effSatis = Number(found.satisMilyem) > 0 ? Number(found.satisMilyem) : (Number((found as any).hasSatisKatsayisi) > 0 ? Number((found as any).hasSatisKatsayisi) : (Number(found.hasOrani) || 1000));
                const milyemVal = newTip === 1 ? String(effAlis) : String(effSatis);
                return { ...r, milyem: milyemVal };
              }));
            }}
            onKeyDown={(e) => {
              if (e.key === " " || e.code === "Space" || e.keyCode === 32) {
                e.preventDefault();
                e.stopPropagation();
                const newTip = (faturaTipi === 1 ? 0 : 1);
                setFaturaTipi(newTip);
                setOdemeRows((prev) => prev.map((r) => {
                  if (!r.paraKodu || r.paraKodu === "TL" || r.paraKodu === "VERESIYE") return r;
                  const found = odemeUrunList.find((u) => u.kod.toUpperCase() === r.paraKodu.toUpperCase());
                  if (!found) return r;
                  const effAlis = Number(found.alisMilyem) > 0 ? Number(found.alisMilyem) : (Number((found as any).hasAlisKatsayisi) > 0 ? Number((found as any).hasAlisKatsayisi) : (Number(found.hasOrani) || 1000));
                  const effSatis = Number(found.satisMilyem) > 0 ? Number(found.satisMilyem) : (Number((found as any).hasSatisKatsayisi) > 0 ? Number((found as any).hasSatisKatsayisi) : (Number(found.hasOrani) || 1000));
                  const milyemVal = newTip === 1 ? String(effAlis) : String(effSatis);
                  return { ...r, milyem: milyemVal };
                }));
              }
            }}
          >
            <option value={0}>ALIŞ</option>
            <option value={1}>SATIŞ</option>
          </Form.Select>
        </div>
      </div>

      {/* ─── 3. Header Panel: Müşteri & Cari Bilgileri (2 Düzenli Satır) ─── */}
      <Card className="shadow-sm mb-2 border fis-theme-card" data-fis-theme="active" style={{ backgroundColor: activeFisThemeBg }}>
        <Card.Body className="p-2 fis-theme-card-body" data-fis-theme="active" style={{ backgroundColor: activeFisThemeBg }}>
          {/* 1. Satır: TCKN / VKN / Pasaport | Cari Kodu | Müşteri Adı (+ Dürbün + Nihai Tüketici) */}
          <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
            {/* TCKN / VKN / Pasaport (+ Dürbün + MASAK Butonu) */}
            <div className="d-flex align-items-center gap-1" style={{ minWidth: "245px" }}>
              <label style={{ width: 75, minWidth: 75, fontSize: "12px", fontWeight: 600 }} className="mb-0 text-secondary">
                TCKN / VKN
              </label>
              <InputGroup size="sm" style={{ width: "175px" }}>
                <Form.Control
                  ref={vknRef}
                  size="sm"
                  value={aliciVknTckn}
                  onChange={(e) => {
                    const rawVal = e.target.value;
                    setAliciVknTckn(rawVal);
                    const newSenaryo = detectScenario(rawVal, undefined, aliciUnvan);
                    setSenaryo(newSenaryo);
                  }}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const val = (aliciVknTckn && aliciVknTckn !== "11111111111" ? aliciVknTckn : "").trim();
                      const prevVal = (lastFocusedVknRef.current || "").trim();
                      if (val && val === prevVal) {
                        cariKodRef.current?.focus();
                        cariKodRef.current?.select();
                        return;
                      }
                      if (!val) {
                        cariKodRef.current?.focus();
                        cariKodRef.current?.select();
                        return;
                      }
                      const { cariler: mc, kayitsizlar: mk, totalCount } = findMatchingCustomers("vkn", val);
                      if (totalCount === 1) {
                        if (mc.length === 1) {
                          const single = mc[0];
                          void handleSelectCustomer({
                            type: "registered",
                            id: single.id,
                            kod: single.kod,
                            unvan: single.ad || (single as any).unvan || "",
                            vergiKimlikNo: single.vergiKimlikNo || "",
                            adres: single.adres || "",
                            telefon: single.telefon || "",
                            raw: single,
                          });
                        } else if (mk.length === 1) {
                          const singleK = mk[0];
                          void handleSelectCustomer({
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
                        lastFocusedVknRef.current = val;
                        cariKodRef.current?.focus();
                        cariKodRef.current?.select();
                        return;
                      }
                      if (totalCount === 0 && (val.length === 10 || val.length === 11)) {
                        const senaryoRes = await checkAndApplyMukellefiyet(val, aliciUnvan);
                        if (senaryoRes === "TICARIFATURA") {
                          lastFocusedVknRef.current = val;
                          cariKodRef.current?.focus();
                          cariKodRef.current?.select();
                          return;
                        }
                      }
                      lastModalCallerRef.current = "vkn";
                      setMusteriSearchTerm(val);
                      setCariSearchField("vkn");
                      setShowMusteriModal(true);
                    }
                  }}
                  onBlur={(e) => {
                    const val = e.target.value.trim();
                    if (val && val !== "11111111111") {
                      void checkAndApplyMukellefiyet(val, aliciUnvan);
                    }
                  }}
                  placeholder="TCKN / VKN / Pasaport"
                  title="TCKN (11 hane), VKN (10 hane) veya Pasaport No"
                  style={{ fontSize: "12px", fontFamily: "monospace", fontWeight: 600 }}
                />
                <Button
                  variant="outline-secondary"
                  className="px-1.5 py-0 d-flex align-items-center"
                  onClick={() => {
                    const val = (aliciVknTckn && aliciVknTckn !== "11111111111" ? aliciVknTckn : "").trim();
                    lastModalCallerRef.current = "vkn";
                    setMusteriSearchTerm(val);
                    setCariSearchField("vkn");
                    setShowMusteriModal(true);
                  }}
                  title="Cari / Müşteri Seç (F4 / Dürbün)"
                >
                  <IconBinoculars size={13} />
                </Button>
                <Button
                  variant="outline-danger"
                  size="sm"
                  className="px-1.5 py-0 d-flex align-items-center justify-content-center border border-danger text-danger bg-white"
                  onClick={() => handleMasakQuery()}
                  disabled={isSearchingMasak}
                  title="MASAK Malvarlığı Dondurulanlar Listesinde Sorgula"
                  style={{ height: "26px", minWidth: "28px" }}
                >
                  {isSearchingMasak ? (
                    <Spinner size="sm" animation="border" style={{ width: 12, height: 12 }} />
                  ) : (
                    <IconShieldCheck size={15} className="text-danger" />
                  )}
                </Button>
              </InputGroup>
            </div>

            {/* Cari Kodu */}
            <div className="d-flex align-items-center gap-1" style={{ minWidth: "180px" }}>
              <label style={{ width: 65, minWidth: 65, fontSize: "12px", fontWeight: 600 }} className="mb-0 text-secondary">
                Cari Kodu
              </label>
              <InputGroup size="sm" style={{ width: "120px" }}>
                <Form.Control
                  ref={cariKodRef}
                  size="sm"
                  value={cariKod}
                  onChange={(e) => setCariKod(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const val = (cariKod || "").trim();
                      const prevVal = (lastFocusedCariKodRef.current || "").trim();
                      if (val && val.toLowerCase() === prevVal.toLowerCase()) {
                        aliciUnvanRef.current?.focus();
                        aliciUnvanRef.current?.select();
                        return;
                      }
                      if (!val) {
                        aliciUnvanRef.current?.focus();
                        aliciUnvanRef.current?.select();
                        return;
                      }
                      const { cariler: mc, totalCount } = findMatchingCustomers("kod", val);
                      if (totalCount === 1 && mc.length === 1) {
                        const single = mc[0];
                        void handleSelectCustomer({
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
                        aliciUnvanRef.current?.focus();
                        aliciUnvanRef.current?.select();
                        return;
                      }
                      lastModalCallerRef.current = "cariKod";
                      setMusteriSearchTerm(val);
                      setCariSearchField("kod");
                      setShowMusteriModal(true);
                    }
                  }}
                  placeholder="Cari Kodu"
                  style={{ fontSize: "12px", fontFamily: "monospace", fontWeight: 600 }}
                />
                <Button
                  variant="outline-secondary"
                  className="px-1.5 py-0 d-flex align-items-center"
                  onClick={() => {
                    const val = (cariKod || "").trim();
                    lastModalCallerRef.current = "cariKod";
                    setMusteriSearchTerm(val);
                    setCariSearchField("kod");
                    setShowMusteriModal(true);
                  }}
                  title="Cari Seç"
                >
                  <IconBinoculars size={13} />
                </Button>
              </InputGroup>
            </div>

            {/* Müşteri Adı (+ Dürbün + MASAK Butonu + Nihai Tüketici) */}
            <div className="d-flex align-items-center gap-1" style={{ minWidth: "320px", width: "380px", flex: "1.3 1 320px" }}>
              <label style={{ width: 75, minWidth: 75, fontSize: "12px", fontWeight: 600 }} className="mb-0 text-secondary">
                Müşteri Adı
              </label>
              <InputGroup size="sm" style={{ flex: 1 }}>
                <Form.Control
                  ref={aliciUnvanRef}
                  value={aliciUnvan}
                  onChange={(e) => {
                    const newUnvan = e.target.value;
                    setAliciUnvan(newUnvan);
                    if (cariKartId) setCariKartId(null);
                    const newSenaryo = detectScenario(aliciVknTckn, undefined, newUnvan);
                    setSenaryo(newSenaryo);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const raw = (aliciUnvan || "").trim();
                      if (isAnonymousCustomerName(raw)) {
                        if (items.length > 0) {
                          focusGridCell(items[0].id, "barkod", "select");
                        }
                        return;
                      }
                      const val = raw;
                      const prevVal = (lastFocusedUnvanRef.current || "").trim();
                      if (val && val.toLowerCase() === prevVal.toLowerCase()) {
                        if (items.length > 0) {
                          focusGridCell(items[0].id, "barkod", "select");
                        }
                        return;
                      }
                      const { cariler: mc, kayitsizlar: mk, totalCount } = findMatchingCustomers("unvan", val);
                      if (totalCount === 1) {
                        if (mc.length === 1) {
                          const single = mc[0];
                          void handleSelectCustomer({
                            type: "registered",
                            id: single.id,
                            kod: single.kod,
                            unvan: single.ad || (single as any).unvan || "",
                            vergiKimlikNo: single.vergiKimlikNo || "",
                            adres: single.adres || "",
                            telefon: single.telefon || "",
                            raw: single,
                          });
                        } else if (mk.length === 1) {
                          const singleK = mk[0];
                          void handleSelectCustomer({
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
                        if (items.length > 0) {
                          focusGridCell(items[0].id, "barkod", "select");
                        }
                        return;
                      }
                      lastModalCallerRef.current = "unvan";
                      setMusteriSearchTerm(val);
                      setCariSearchField("unvan");
                      setShowMusteriModal(true);
                    }
                  }}
                  placeholder="Müşteri Adı / Ünvanı"
                  style={{ fontSize: "12px", fontWeight: 600 }}
                />
                <Button
                  variant="outline-secondary"
                  className="px-1.5 py-0 d-flex align-items-center"
                  onClick={() => {
                    const raw = (aliciUnvan || "").trim();
                    const val = isAnonymousCustomerName(raw) ? "" : raw;
                    lastModalCallerRef.current = "unvan";
                    setMusteriSearchTerm(val);
                    setCariSearchField("unvan");
                    setShowMusteriModal(true);
                  }}
                  title="Cari / Müşteri Seç (F4)"
                >
                  <IconBinoculars size={13} />
                </Button>
                <Button
                  variant="outline-danger"
                  size="sm"
                  className="px-1.5 py-0 d-flex align-items-center justify-content-center border border-danger text-danger bg-white"
                  onClick={() => handleMasakQuery(aliciUnvan, aliciVknTckn)}
                  disabled={isSearchingMasak}
                  title="Müşteri Adı ile MASAK Listelerinde Sorgula"
                  style={{ height: "26px", minWidth: "28px" }}
                >
                  {isSearchingMasak ? (
                    <Spinner size="sm" animation="border" style={{ width: 12, height: 12 }} />
                  ) : (
                    <IconShieldCheck size={15} className="text-danger" />
                  )}
                </Button>
              </InputGroup>
              <Button
                variant="outline-primary"
                size="sm"
                className="px-1.5 py-0"
                onClick={handleSetNihaiTuketici}
                title="Nihai Tüketici Olarak Doldur"
                style={{ fontSize: "11px", whiteSpace: "nowrap" }}
              >
                Nihai
              </Button>
            </div>
          </div>

          {/* 2. Satır: Vergi Dairesi | İl / İlçe | Telefon | E-Posta | Adres */}
          <div className="d-flex align-items-center gap-2 flex-wrap">
            {/* Vergi Dairesi */}
            <div className="d-flex align-items-center gap-1" style={{ minWidth: "180px", flex: 1 }}>
              <label style={{ width: 75, minWidth: 75, fontSize: "12px", fontWeight: 600 }} className="mb-0 text-secondary">
                Vergi Dairesi
              </label>
              <Form.Control
                size="sm"
                value={vergiDairesi}
                onChange={(e) => setVergiDairesi(e.target.value)}
                style={{ fontSize: "12px" }}
              />
            </div>

            {/* İl / İlçe */}
            <div className="d-flex align-items-center gap-1" style={{ minWidth: "200px", flex: 1.2 }}>
              <label style={{ width: 55, minWidth: 55, fontSize: "12px", fontWeight: 600 }} className="mb-0 text-secondary">
                İl / İlçe
              </label>
              <div className="d-flex gap-1 w-100">
                <Form.Control
                  size="sm"
                  placeholder="İl"
                  value={il}
                  onChange={(e) => setIl(e.target.value)}
                  style={{ fontSize: "12px" }}
                />
                <Form.Control
                  size="sm"
                  placeholder="İlçe"
                  value={ilce}
                  onChange={(e) => setIlce(e.target.value)}
                  style={{ fontSize: "12px" }}
                />
              </div>
            </div>

            {/* Telefon */}
            <div className="d-flex align-items-center gap-1" style={{ minWidth: "160px", flex: 1 }}>
              <label style={{ width: 50, minWidth: 50, fontSize: "12px", fontWeight: 600 }} className="mb-0 text-secondary">
                Telefon
              </label>
              <Form.Control
                size="sm"
                value={telefon}
                onChange={(e) => setTelefon(e.target.value)}
                style={{ fontSize: "12px" }}
              />
            </div>

            {/* E-Posta */}
            <div className="d-flex align-items-center gap-1" style={{ minWidth: "170px", flex: 1 }}>
              <label style={{ width: 50, minWidth: 50, fontSize: "12px", fontWeight: 600 }} className="mb-0 text-secondary">
                E-Posta
              </label>
              <Form.Control
                size="sm"
                type="email"
                value={eposta}
                onChange={(e) => setEposta(e.target.value)}
                style={{ fontSize: "12px" }}
              />
            </div>

            {/* Adres */}
            <div className="d-flex align-items-center gap-1" style={{ minWidth: "200px", flex: 1.5 }}>
              <label style={{ width: 45, minWidth: 45, fontSize: "12px", fontWeight: 600 }} className="mb-0 text-secondary">
                Adres
              </label>
              <Form.Control
                size="sm"
                value={adres}
                onChange={(e) => setAdres(e.target.value)}
                style={{ fontSize: "12px" }}
              />
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* ─── 4. Satış Kalemleri Grid Tablosu (Ayrı Dış Dikdörtgen Kutu) ─── */}
      <Card className="shadow-sm mb-2 border rounded-2 fis-theme-card" data-fis-theme="active" style={{ backgroundColor: activeFisThemeBg }}>
        <Card.Body className="p-2 fis-theme-card-body" data-fis-theme="active" style={{ backgroundColor: activeFisThemeBg }}>
          <div
            className="table-responsive w-100"
            style={{ minHeight: "160px", overflowX: "auto" }}
          >
            <Table
              bordered
              size="sm"
              hover
              className="mb-0 align-middle text-nowrap w-100"
              style={{ fontSize: "11.5px", minWidth: "820px" }}
            >
              <thead style={{ background: "#d9e8fb", color: "#000" }}>
                <tr className="text-center align-middle">
                  <th style={{ width: "3%", minWidth: "28px" }} className="text-center">#</th>
                  <th style={{ width: "13%", minWidth: "130px" }} className="text-center">Barkod</th>
                  <th style={{ width: "23%", minWidth: "180px" }} className="text-center">Ürün Açıklaması / Model</th>
                  <th style={{ width: "7%", minWidth: "65px" }} className="text-center">Ayar</th>
                  <th style={{ width: "6%", minWidth: "55px" }} className="text-center">Miktar</th>
                  <th style={{ width: "6%", minWidth: "55px" }} className="text-center">Birim</th>
                  <th style={{ width: "8%", minWidth: "70px" }} className="text-center">Gram</th>
                  <th style={{ width: "8%", minWidth: "70px" }} className="text-center">Has Gr</th>
                  <th style={{ width: "10%", minWidth: "85px" }} className="text-center">Birim Fiyat (₺)</th>
                  <th style={{ width: "5%", minWidth: "45px" }} className="text-center">KDV %</th>
                  <th style={{ width: "7%", minWidth: "70px" }} className="text-center">KDV (₺)</th>
                  <th style={{ width: "9%", minWidth: "85px" }} className="text-center">Satır Toplamı (₺)</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const isBarkodlu = Boolean((item.barkod && String(item.barkod).trim()) || item.altinUrunId);
                  const isRowItemEmpty = isRowEmpty(item);
                  const isRowValid = isPerakendeRowFilled(item);
                  const isAttempted = Boolean(invalidRowIds[item.id]);
                  const shouldValidate = (!isRowItemEmpty && !isRowValid) || (isAttempted && !isRowValid);

                  const isBarkodMissing = shouldValidate && (!item.barkod || !String(item.barkod).trim()) && (!item.urunAdi || !String(item.urunAdi).trim());
                  const isMiktarMissing = shouldValidate && (!item.miktar || Number(item.miktar) <= 0) && (!item.gram || Number(item.gram) <= 0);
                  const isFiyatMissing = shouldValidate && (!item.birimFiyat || Number(item.birimFiyat) <= 0) && (!item.tutar || Number(item.tutar) <= 0);

                  return (
                    <tr
                      key={item.id}
                      data-row-id={item.id}
                      data-table-type="kalemler"
                      style={{
                        backgroundColor: idx % 2 === 0 ? "#ffffff" : "#fdfdfd",
                      }}
                    >
                      {/* Satır Sıra No */}
                      <td className="text-center text-muted fw-bold" style={{ fontSize: "11px" }}>
                        {idx + 1}
                      </td>

                      {/* Barkod (+ Dürbün) */}
                      <td style={{ padding: "2px 4px" }}>
                        <div className="input-group input-group-sm" style={isBarkodMissing ? { backgroundColor: "#fee2e2", border: "1.5px solid #dc2626", borderRadius: "3px" } : {}}>
                          <input
                            ref={(el) => {
                              rowInputRefs.current[`${item.id}_barkod`] = el;
                            }}
                            type="text"
                            className={`form-control form-control-sm font-monospace fw-bold p-1 ${isBarkodMissing ? "text-danger" : "text-primary"}`}
                            style={{ fontSize: "12px", backgroundColor: isBarkodMissing ? "#fee2e2" : undefined }}
                            value={item.barkod}
                            onChange={(e) => handleUpdateItem(item.id, "barkod", e.target.value)}
                            onKeyDown={(e) => handleGridKeyDown(e, idx, "barkod", item.id)}
                            onFocus={() => {
                              setActiveRowIndex(idx);
                              cleanupEmptyRows(idx);
                              cleanupEmptyOdemeRows(null);
                            }}
                            placeholder="Barkod Okut..."
                            title={isBarkodMissing ? "Lütfen barkod veya ürün seçiniz" : undefined}
                          />
                          <Button
                            variant="outline-secondary"
                            size="sm"
                            className="px-1.5 py-0 d-flex align-items-center"
                            onClick={() => {
                              openProductLookup(item.id, (String(item.barkod) || "").trim());
                            }}
                            title="Barkod Listesinden Seç (F4)"
                          >
                            <IconBinoculars size={13} />
                          </Button>
                        </div>
                      </td>

                      {/* Ürün Adı */}
                      <td style={{ padding: "2px 4px" }}>
                        <input
                          ref={(el) => {
                            rowInputRefs.current[`${item.id}_urunAdi`] = el;
                          }}
                          type="text"
                          readOnly={isBarkodlu}
                          tabIndex={isBarkodlu ? -1 : 0}
                          className={`form-control form-control-sm p-1 ${isBarkodMissing ? "text-danger fw-bold" : ""}`}
                          style={{
                            fontSize: "12px",
                            backgroundColor: isBarkodlu ? "#f8fafc" : isBarkodMissing ? "#fee2e2" : undefined,
                            border: isBarkodMissing ? "1.5px solid #dc2626" : undefined,
                            cursor: isBarkodlu ? "not-allowed" : undefined,
                            color: isBarkodlu ? "#475569" : undefined,
                          }}
                          value={item.urunAdi}
                          onChange={(e) => handleUpdateItem(item.id, "urunAdi", e.target.value)}
                          onKeyDown={(e) => handleGridKeyDown(e, idx, "urunAdi", item.id)}
                          onFocus={() => {
                            setActiveRowIndex(idx);
                            cleanupEmptyRows(idx);
                            cleanupEmptyOdemeRows(null);
                          }}
                          placeholder="Ürün adı..."
                        />
                      </td>

                      {/* Ayar */}
                      <td style={{ padding: "2px 4px" }}>
                        <div className="input-group input-group-sm">
                          <input
                            ref={(el) => {
                              rowInputRefs.current[`${item.id}_ayar`] = el;
                            }}
                            type="text"
                            readOnly={isBarkodlu}
                            tabIndex={isBarkodlu ? -1 : 0}
                            className="form-control form-control-sm text-center fw-bold p-1"
                            style={{
                              fontSize: "11.5px",
                              backgroundColor: isBarkodlu ? "#f8fafc" : undefined,
                              cursor: isBarkodlu ? "not-allowed" : undefined,
                              color: isBarkodlu ? "#475569" : undefined,
                            }}
                            value={item.ayar}
                            onChange={(e) => handleUpdateItem(item.id, "ayar", e.target.value)}
                            onKeyDown={(e) => {
                              if (!isBarkodlu && (e.key === "F4" || (e.key === "Enter" && !item.ayar))) {
                                e.preventDefault();
                                setActiveAyarRowId(item.id);
                                setShowAyarModal(true);
                                return;
                              }
                              handleGridKeyDown(e, idx, "ayar", item.id);
                            }}
                            onFocus={() => {
                              setActiveRowIndex(idx);
                              cleanupEmptyRows(idx);
                              cleanupEmptyOdemeRows(null);
                            }}
                          />
                          <Button
                            variant="outline-secondary"
                            size="sm"
                            disabled={isBarkodlu}
                            className="px-1 py-0 d-flex align-items-center"
                            onClick={() => {
                              if (!isBarkodlu) {
                                setActiveAyarRowId(item.id);
                                setShowAyarModal(true);
                              }
                            }}
                            title={isBarkodlu ? "Barkodlu üründe ayar sabittir" : "Ayar Seç (F4)"}
                          >
                            <IconBinoculars size={12} />
                          </Button>
                        </div>
                      </td>

                      {/* Miktar */}
                      <td style={{ padding: "2px 4px" }}>
                        <input
                          ref={(el) => {
                            rowInputRefs.current[`${item.id}_miktar`] = el;
                          }}
                          type="text"
                          inputMode="decimal"
                          className={`form-control form-control-sm text-center font-monospace p-1 ${isMiktarMissing ? "text-danger fw-bold" : isBarkodlu ? "fw-bold text-primary" : ""}`}
                          style={{
                            fontSize: "12px",
                            backgroundColor: isMiktarMissing ? "#fee2e2" : isBarkodlu ? "#f0f9ff" : undefined,
                            border: isMiktarMissing ? "1.5px solid #dc2626" : isBarkodlu ? "1.5px solid #bae6fd" : undefined,
                          }}
                          value={formatMiktar(item.miktar)}
                          onChange={(e) => handleUpdateItem(item.id, "miktar", e.target.value)}
                          onBlur={() => handleUpdateItem(item.id, "miktar", formatMiktar(item.miktar))}
                          onKeyDown={(e) => handleGridKeyDown(e, idx, "miktar", item.id)}
                          onFocus={() => {
                            setActiveRowIndex(idx);
                            cleanupEmptyRows(idx);
                            cleanupEmptyOdemeRows(null);
                          }}
                          title={isMiktarMissing ? "Lütfen miktar giriniz" : isBarkodlu ? "Barkodlu üründe sadece miktar değiştirilebilir" : undefined}
                        />
                      </td>

                      {/* Birim */}
                      <td style={{ padding: "2px 4px" }}>
                        <input
                          ref={(el) => {
                            rowInputRefs.current[`${item.id}_birim`] = el;
                          }}
                          type="text"
                          readOnly={isBarkodlu}
                          tabIndex={isBarkodlu ? -1 : 0}
                          className="form-control form-control-sm text-center p-1"
                          style={{
                            fontSize: "11.5px",
                            backgroundColor: isBarkodlu ? "#f8fafc" : undefined,
                            cursor: isBarkodlu ? "not-allowed" : undefined,
                            color: isBarkodlu ? "#475569" : undefined,
                          }}
                          value={item.birim}
                          onChange={(e) => handleUpdateItem(item.id, "birim", e.target.value)}
                          onKeyDown={(e) => handleGridKeyDown(e, idx, "birim", item.id)}
                          onFocus={() => {
                            setActiveRowIndex(idx);
                            cleanupEmptyRows(idx);
                            cleanupEmptyOdemeRows(null);
                          }}
                        />
                      </td>

                      {/* Gram */}
                      <td style={{ padding: "2px 4px" }}>
                        <input
                          ref={(el) => {
                            rowInputRefs.current[`${item.id}_gram`] = el;
                          }}
                          type="number"
                          step="0.01"
                          readOnly={isBarkodlu}
                          tabIndex={isBarkodlu ? -1 : 0}
                          className={`form-control form-control-sm text-end font-monospace p-1 ${isMiktarMissing ? "text-danger fw-bold" : ""}`}
                          style={{
                            fontSize: "12px",
                            backgroundColor: isBarkodlu ? "#f8fafc" : isMiktarMissing ? "#fee2e2" : undefined,
                            border: isMiktarMissing ? "1.5px solid #dc2626" : undefined,
                            cursor: isBarkodlu ? "not-allowed" : undefined,
                            color: isBarkodlu ? "#475569" : undefined,
                          }}
                          value={item.gram}
                          onChange={(e) => handleUpdateItem(item.id, "gram", e.target.value)}
                          onKeyDown={(e) => handleGridKeyDown(e, idx, "gram", item.id)}
                          onFocus={() => {
                            setActiveRowIndex(idx);
                            cleanupEmptyRows(idx);
                            cleanupEmptyOdemeRows(null);
                          }}
                          title={isBarkodlu ? "Barkodlu üründe gramaj sabittir" : isMiktarMissing ? "Lütfen miktar veya gram giriniz" : undefined}
                        />
                      </td>

                      {/* Has Gram */}
                      <td style={{ padding: "2px 4px" }}>
                        <input
                          ref={(el) => {
                            rowInputRefs.current[`${item.id}_hasGram`] = el;
                          }}
                          type="number"
                          step="0.001"
                          readOnly={isBarkodlu}
                          tabIndex={isBarkodlu ? -1 : 0}
                          className="form-control form-control-sm text-end font-monospace p-1"
                          style={{
                            fontSize: "12px",
                            backgroundColor: isBarkodlu ? "#f8fafc" : undefined,
                            cursor: isBarkodlu ? "not-allowed" : undefined,
                            color: isBarkodlu ? "#475569" : undefined,
                          }}
                          value={item.hasGram}
                          onChange={(e) => handleUpdateItem(item.id, "hasGram", e.target.value)}
                          onKeyDown={(e) => handleGridKeyDown(e, idx, "hasGram", item.id)}
                          onFocus={() => {
                            setActiveRowIndex(idx);
                            cleanupEmptyRows(idx);
                            cleanupEmptyOdemeRows(null);
                          }}
                        />
                      </td>

                      {/* Birim Fiyat */}
                      <td style={{ padding: "2px 4px" }}>
                        <input
                          ref={(el) => {
                            rowInputRefs.current[`${item.id}_birimFiyat`] = el;
                          }}
                          type="number"
                          step="0.01"
                          readOnly={isBarkodlu}
                          tabIndex={isBarkodlu ? -1 : 0}
                          className={`form-control form-control-sm text-end font-monospace fw-bold p-1 ${isFiyatMissing ? "text-danger" : "text-success"}`}
                          style={{
                            fontSize: "12px",
                            backgroundColor: isBarkodlu ? "#f8fafc" : isFiyatMissing ? "#fee2e2" : undefined,
                            border: isFiyatMissing ? "1.5px solid #dc2626" : undefined,
                            cursor: isBarkodlu ? "not-allowed" : undefined,
                          }}
                          value={item.birimFiyat}
                          onChange={(e) => handleUpdateItem(item.id, "birimFiyat", e.target.value)}
                          onKeyDown={(e) => handleGridKeyDown(e, idx, "birimFiyat", item.id)}
                          onFocus={() => {
                            setActiveRowIndex(idx);
                            cleanupEmptyRows(idx);
                            cleanupEmptyOdemeRows(null);
                          }}
                          placeholder="0.00"
                          title={isBarkodlu ? "Barkodlu üründe birim fiyat değiştirilemez" : isFiyatMissing ? "Lütfen birim fiyat giriniz" : undefined}
                        />
                      </td>

                      {/* KDV % */}
                      <td style={{ padding: "2px 4px" }}>
                        <input
                          ref={(el) => {
                            rowInputRefs.current[`${item.id}_kdvOrani`] = el;
                          }}
                          type="number"
                          readOnly={isBarkodlu}
                          tabIndex={isBarkodlu ? -1 : 0}
                          className="form-control form-control-sm text-center font-monospace p-1"
                          style={{
                            fontSize: "11.5px",
                            backgroundColor: isBarkodlu ? "#f8fafc" : undefined,
                            cursor: isBarkodlu ? "not-allowed" : undefined,
                            color: isBarkodlu ? "#475569" : undefined,
                          }}
                          value={item.kdvOrani}
                          onChange={(e) => handleUpdateItem(item.id, "kdvOrani", e.target.value)}
                          onKeyDown={(e) => handleGridKeyDown(e, idx, "kdvOrani", item.id)}
                          onFocus={() => {
                            setActiveRowIndex(idx);
                            cleanupEmptyRows(idx);
                            cleanupEmptyOdemeRows(null);
                          }}
                          title={isBarkodlu ? "Barkodlu üründe KDV oranı değiştirilemez" : undefined}
                        />
                      </td>

                      {/* KDV Tutarı */}
                      <td className="text-end font-monospace text-muted px-2" style={{ fontSize: "11.5px" }}>
                        {typeof item.kdvTutari === "number" && item.kdvTutari > 0
                          ? `${item.kdvTutari.toLocaleString("tr-TR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })} ₺`
                          : "-"}
                      </td>

                      {/* Satır Toplamı */}
                      <td className="text-end font-monospace fw-bold text-dark px-2" style={{ fontSize: "12px" }}>
                        {typeof item.toplamTutar === "number" && item.toplamTutar > 0
                          ? `${item.toplamTutar.toLocaleString("tr-TR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })} ₺`
                          : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>

      {/* ─── 5. Bottom Sections: ÖDEME TABLOSU (Solda) | TL/HAS Özet (Sağda) ─── */}
      <Card className="shadow-sm mb-2 border rounded-2 fis-theme-card" data-fis-theme="active" style={{ backgroundColor: activeFisThemeBg }}>
        <Card.Body className="p-2 fis-theme-card-body" data-fis-theme="active" style={{ backgroundColor: activeFisThemeBg }}>
          <Row className="g-2 align-items-start mb-0">
            {/* SOLDA: Ödeme / Tahsilat Tablosu (Sarraf Fişi ile Birebir Aynı Tasarım) */}
            <Col xs={12} lg={8} md={7}>
              <div className="border rounded bg-white shadow-sm overflow-hidden">
                <div className="bg-light px-2 py-1 border-bottom d-flex justify-content-between align-items-center">
                  <span className="fw-bold text-secondary" style={{ fontSize: "12px" }}>
                    ÖDEME / TAHSİLAT TABLOSU
                  </span>
                </div>
            <div style={{ overflowX: "auto" }}>
              <Table bordered size="sm" hover className="mb-0 align-middle text-nowrap" style={{ fontSize: "11.5px", minWidth: 780 }}>
                <thead style={{ background: "#d9e8fb", color: "#000" }}>
                  <tr className="text-center align-middle">
                    <th style={{ width: 25 }} className="text-center">#</th>
                    <th style={{ width: 85 }} className="text-center">Tür</th>
                    <th style={{ width: 110 }} className="text-center">Kod</th>
                    <th style={{ width: 140 }} className="text-center">Açıklama</th>
                    <th style={{ width: 110 }} className="text-center">Para / İskonto</th>
                    <th style={{ width: 55 }} className="text-center">Adet</th>
                    <th style={{ width: 75 }} className="text-center">Miktar</th>
                    <th style={{ width: 70 }} className="text-center">Milyem</th>
                    <th style={{ width: 85 }} className="text-center">Has Gr</th>
                    <th style={{ width: 95 }} className="text-center">Kur / Oran</th>
                    <th style={{ width: 110 }} className="text-center">Tutar (TL)</th>
                  </tr>
                </thead>
                <tbody>
                  {odemeRows.map((oRow, rowIndex) => {
                    const isMetal = isAltinOrGumusRow(oRow, odemeUrunList);
                    const isPosRow = oRow.odemeAraciTuru === 2;
                    const isHesapRow = oRow.odemeAraciTuru === 3;
                    const isVeresiyeRow =
                      oRow.odemeAraciTuru === 1 ||
                      (!isPosRow &&
                        !isHesapRow &&
                        (oRow.paraKodu?.trim().toUpperCase() === "VERESIYE" ||
                          oRow.paraAdi?.toUpperCase().includes("VERESİYE") ||
                          oRow.paraAdi?.toUpperCase().includes("AÇIK HESAP")));

                    const isIskontoRow =
                      oRow.paraKodu?.trim().toUpperCase().startsWith("ISK") ||
                      oRow.paraAdi?.toUpperCase().includes("İSKONTO") ||
                      oRow.paraAdi?.toUpperCase().includes("ISKONTO") ||
                      (oRow.paraId !== undefined && oRow.paraId !== null && Number(oRow.paraId) >= 100000);

                    const isOverpaidVeresiye = farkTL < -0.01 && isVeresiyeRow;
                    const isOdemeRowTL = !isIskontoRow && !isMetal && (
                      (oRow.paraKodu || "").trim().toUpperCase() === "TL" ||
                      (oRow.paraKodu || "").trim().toUpperCase() === "TRY" ||
                      (oRow.paraKodu || "").trim().toUpperCase() === "TRL" ||
                      (!oRow.paraKodu && (oRow.odemeAraciTuru === 0 || oRow.odemeAraciTuru === 2 || oRow.odemeAraciTuru === 3))
                    );

                    // Veresiye satırları açık kırmızı (#fee2e2 / #991b1b)
                    // İskonto satırları açık yeşil (#dcfce7 / #166534)
                    const rowBg = isVeresiyeRow
                      ? "#fee2e2"
                      : isIskontoRow
                        ? "#dcfce7"
                        : rowIndex === activeOdemeRowIndex
                          ? "#edf5ff"
                          : "#ffffff";

                    const rowTextColor = isVeresiyeRow
                      ? "#991b1b"
                      : isIskontoRow
                        ? "#166534"
                        : undefined;

                    const rowBorderColor = isVeresiyeRow
                      ? "#fca5a5"
                      : isIskontoRow
                        ? "#86efac"
                        : undefined;

                    return (
                      <tr
                        key={oRow.id}
                        data-row-id={oRow.id}
                        data-table-type="odeme"
                        className={isVeresiyeRow ? "table-danger" : isIskontoRow ? "table-success" : (rowIndex === activeOdemeRowIndex ? "table-primary" : "")}
                        style={{
                          backgroundColor: rowBg,
                          "--bs-table-bg": rowBg,
                          "--bs-table-accent-bg": rowBg,
                          "--bs-table-hover-bg": isVeresiyeRow ? "#fecaca" : isIskontoRow ? "#bbf7d0" : "#dbeafe",
                        } as any}
                      >
                        <td className="text-muted text-center" style={{ padding: "2px", fontSize: "10px", verticalAlign: "middle", backgroundColor: rowBg, color: rowTextColor, borderColor: rowBorderColor }}>
                          {rowIndex + 1}
                        </td>

                        {/* Tür Seçimi (Vezne, Cari, POS, Hesap) */}
                        <td style={{ padding: "2px 4px", backgroundColor: rowBg, borderColor: rowBorderColor, verticalAlign: "middle" }}>
                          <Form.Select
                            ref={(el) => { odemeInputRefs.current[`${oRow.id}_odemeAraciTuru`] = el; }}
                            size="sm"
                            value={oRow.odemeAraciTuru ?? 0}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setOdemeRows((prev) => prev.map((r) => {
                                if (r.id !== oRow.id) return r;
                                let defKod = "TL";
                                let defAd = "TÜRK LİRASI";
                                let defCariId = null;
                                let defCariKod = "";
                                let defCariUnvan = "";
                                if (val === 1) {
                                  defCariKod = (cariKod && cariKod.trim()) ? cariKod.trim() : "";
                                  defCariUnvan = (aliciUnvan && aliciUnvan !== "NİHAİ TÜKETİCİ" && aliciUnvan !== "VERESİYE / AÇIK HESAP") ? aliciUnvan : "";
                                  defKod = "";
                                  defAd = "";
                                  defCariId = cariKartId || null;
                                } else if (val === 2) {
                                  defKod = "TL";
                                  defAd = "KREDİ KARTI / POS";
                                } else if (val === 3) {
                                  defKod = "TL";
                                  defAd = "BANKA HAVALE / EFT";
                                }
                                return {
                                  ...r,
                                  odemeAraciTuru: val,
                                  paraKodu: val === 1 ? "" : (val === 0 ? (r.paraKodu || "TL") : defKod),
                                  paraAdi: val === 1 ? "" : defAd,
                                  paraId: null,
                                  cariKartId: defCariId,
                                  cariKod: defCariKod,
                                  cariUnvan: defCariUnvan,
                                  bankaId: null,
                                  adet: "",
                                  miktar: val === 1 ? "" : r.miktar,
                                  milyem: "",
                                  hasGram: "",
                                  kur: val === 1 ? "" : 1,
                                  tutar: val === 1 ? "" : r.tutar,
                                };
                              }));
                            }}
                            onKeyDown={(e) => {
                              if (e.key === " " || e.code === "Space" || e.keyCode === 32) {
                                e.preventDefault();
                                e.stopPropagation();
                                const nextVal = ((oRow.odemeAraciTuru ?? 0) + 1) % 4;
                                setOdemeRows((prev) => prev.map((r) => {
                                  if (r.id !== oRow.id) return r;
                                  let defKod = "TL";
                                  let defAd = "TÜRK LİRASI";
                                  let defCariId = null;
                                  let defCariKod = "";
                                  let defCariUnvan = "";
                                  if (nextVal === 1) {
                                    defCariKod = (cariKod && cariKod.trim()) ? cariKod.trim() : "";
                                    defCariUnvan = (aliciUnvan && aliciUnvan !== "NİHAİ TÜKETİCİ" && aliciUnvan !== "VERESİYE / AÇIK HESAP") ? aliciUnvan : "";
                                    defKod = "";
                                    defAd = "";
                                    defCariId = cariKartId || null;
                                  } else if (nextVal === 2) {
                                    defKod = "TL";
                                    defAd = "KREDİ KARTI / POS";
                                  } else if (nextVal === 3) {
                                    defKod = "TL";
                                    defAd = "BANKA HAVALE / EFT";
                                  }
                                  return {
                                    ...r,
                                    odemeAraciTuru: nextVal,
                                    paraKodu: nextVal === 1 ? "" : (nextVal === 0 ? (r.paraKodu || "TL") : defKod),
                                    paraAdi: nextVal === 1 ? "" : defAd,
                                    paraId: null,
                                    cariKartId: defCariId,
                                    cariKod: defCariKod,
                                    cariUnvan: defCariUnvan,
                                    bankaId: null,
                                    adet: "",
                                    miktar: nextVal === 1 ? "" : r.miktar,
                                    milyem: "",
                                    hasGram: "",
                                    kur: nextVal === 1 ? "" : 1,
                                    tutar: nextVal === 1 ? "" : r.tutar,
                                  };
                                }));
                                return;
                              }
                              handleOdemeGridKeyDown(e, rowIndex, "odemeAraciTuru", oRow.id);
                            }}
                            onFocus={() => {
                              setActiveOdemeRowIndex(rowIndex);
                              cleanupEmptyOdemeRows(rowIndex);
                              cleanupEmptyRows(null);
                            }}
                            style={{ fontSize: "11px", padding: "1px 2px", fontWeight: 600 }}
                          >
                            <option value={0}>Vezne</option>
                            <option value={1}>Cari</option>
                            <option value={2}>POS</option>
                            <option value={3}>Hesap</option>
                          </Form.Select>
                        </td>

                        {/* Kod (+ Dürbün / Seç) */}
                        <td style={{ padding: "2px 4px", backgroundColor: rowBg, borderColor: rowBorderColor, verticalAlign: "middle" }}>
                          {isVeresiyeRow ? (
                            <InputGroup size="sm">
                              <Form.Control
                                ref={(el) => { odemeInputRefs.current[`${oRow.id}_cariKod`] = el; }}
                                value={oRow.cariKod ?? ""}
                                placeholder="Cari Kod / Dürbün"
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (!val) {
                                    setOdemeRows((prev) => prev.map((r) => r.id === oRow.id ? { ...r, cariKod: "", cariKartId: null, cariUnvan: "" } : r));
                                    return;
                                  }
                                  setOdemeRows((prev) => prev.map((r) => r.id === oRow.id ? { ...r, cariKod: val } : r));
                                  const match = cariler.find((c) => (c.kod || "").trim().toLowerCase() === val.trim().toLowerCase());
                                  if (match) {
                                    setOdemeRows((prev) => prev.map((r) => r.id === oRow.id ? { ...r, cariKartId: match.id, cariKod: match.kod, cariUnvan: match.ad || "" } : r));
                                  }
                                }}
                                onBlur={(e) => {
                                  const val = e.target.value.trim();
                                  if (val) {
                                    const cMatch = cariler.find((c) => (c.kod || "").toLowerCase() === val.toLowerCase());
                                    if (cMatch) {
                                      setOdemeRows((prev) => prev.map((r) => r.id === oRow.id ? { ...r, cariKartId: cMatch.id, cariKod: cMatch.kod, cariUnvan: cMatch.ad || "" } : r));
                                    }
                                  }
                                }}
                                onDoubleClick={() => {
                                  pendingVeresiyeRowIdRef.current = oRow.id;
                                  setCariSearchField("kod");
                                  setMusteriSearchTerm(oRow.cariKod || "");
                                  setShowMusteriModal(true);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "F4" || e.key === "F3") {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    pendingVeresiyeRowIdRef.current = oRow.id;
                                    setCariSearchField("kod");
                                    setMusteriSearchTerm(oRow.cariKod || "");
                                    setShowMusteriModal(true);
                                    return;
                                  }
                                  handleOdemeGridKeyDown(e, rowIndex, "cariKod", oRow.id);
                                }}
                                onFocus={() => {
                                  setActiveOdemeRowIndex(rowIndex);
                                  cleanupEmptyOdemeRows(rowIndex);
                                  cleanupEmptyRows(null);
                                }}
                                style={{
                                  fontSize: "11px",
                                  padding: "1px 4px",
                                  backgroundColor: rowBg,
                                  color: rowTextColor,
                                  borderColor: rowBorderColor,
                                }}
                              />
                              <Button
                                type="button"
                                tabIndex={-1}
                                variant={isVeresiyeRow ? "outline-danger" : "outline-secondary"}
                                className="px-1 py-0 d-flex align-items-center"
                                onClick={() => {
                                  pendingVeresiyeRowIdRef.current = oRow.id;
                                  setCariSearchField("kod");
                                  setMusteriSearchTerm(oRow.cariKod || "");
                                  setShowMusteriModal(true);
                                }}
                                title="Cari Kart Seç (F3/F4)"
                                style={{
                                  borderColor: isVeresiyeRow ? "#fca5a5" : undefined,
                                  color: isVeresiyeRow ? "#dc2626" : undefined,
                                  backgroundColor: rowBg,
                                }}
                              >
                                <IconBinoculars size={12} />
                              </Button>
                            </InputGroup>
                          ) : isIskontoRow ? (
                            <InputGroup size="sm">
                              <Form.Control
                                ref={(el) => { odemeInputRefs.current[`${oRow.id}_cariKod`] = el; }}
                                value={oRow.paraKodu || "ISKONTO"}
                                readOnly
                                onDoubleClick={() => setShowIskontoModal(true)}
                                onKeyDown={(e) => {
                                  if (e.key === "F4" || e.key === "F3") {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setShowIskontoModal(true);
                                    return;
                                  }
                                  handleOdemeGridKeyDown(e, rowIndex, "cariKod", oRow.id);
                                }}
                                style={{
                                  fontSize: "11px",
                                  padding: "1px 4px",
                                  backgroundColor: rowBg,
                                  color: rowTextColor,
                                  borderColor: rowBorderColor,
                                }}
                              />
                              <Button
                                type="button"
                                tabIndex={-1}
                                variant="outline-success"
                                className="px-1 py-0 d-flex align-items-center"
                                onClick={() => setShowIskontoModal(true)}
                                title="İskonto Seç (F3/F4)"
                              >
                                <IconBinoculars size={12} />
                              </Button>
                            </InputGroup>
                          ) : isPosRow ? (
                            <InputGroup size="sm">
                              <Form.Control
                                ref={(el) => { odemeInputRefs.current[`${oRow.id}_cariKod`] = el; }}
                                value={oRow.cariKod ?? ""}
                                placeholder="POS Kodu / Dürbün"
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (!val) {
                                    setOdemeRows((prev) => prev.map((r) => r.id === oRow.id ? { ...r, cariKod: "", bankaId: null, paraAdi: "" } : r));
                                    return;
                                  }
                                  setOdemeRows((prev) => prev.map((r) => r.id === oRow.id ? { ...r, cariKod: val } : r));
                                  const match = posCihazlari.find((p) => (p.kod || "").trim().toLowerCase() === val.trim().toLowerCase());
                                  if (match) {
                                    setOdemeRows((prev) => prev.map((r) => r.id === oRow.id ? {
                                      ...r,
                                      cariKod: match.kod,
                                      paraAdi: match.ad || "KREDİ KARTI / POS",
                                      bankaId: match.posCihaziId,
                                    } : r));
                                  }
                                }}
                                onBlur={(e) => {
                                  const val = e.target.value.trim();
                                  if (val) {
                                    const match = posCihazlari.find((p) => (p.kod || "").toLowerCase() === val.toLowerCase());
                                    if (match) {
                                      setOdemeRows((prev) => prev.map((r) => r.id === oRow.id ? {
                                        ...r,
                                        cariKod: match.kod,
                                        paraAdi: match.ad || "KREDİ KARTI / POS",
                                        bankaId: match.posCihaziId,
                                      } : r));
                                    }
                                  }
                                }}
                                onDoubleClick={() => {
                                  setPendingPosRowId(oRow.id);
                                  setPosSearchTerm(oRow.cariKod || "");
                                  setShowPosModal(true);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "F4" || e.key === "F3") {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setPendingPosRowId(oRow.id);
                                    setPosSearchTerm(oRow.cariKod || "");
                                    setShowPosModal(true);
                                    return;
                                  }
                                  handleOdemeGridKeyDown(e, rowIndex, "cariKod", oRow.id);
                                }}
                                onFocus={() => {
                                  setActiveOdemeRowIndex(rowIndex);
                                  cleanupEmptyOdemeRows(rowIndex);
                                  cleanupEmptyRows(null);
                                }}
                                style={{
                                  fontSize: "11px",
                                  padding: "1px 4px",
                                  backgroundColor: rowBg,
                                  color: rowTextColor,
                                  borderColor: rowBorderColor,
                                }}
                              />
                              <Button
                                type="button"
                                tabIndex={-1}
                                variant="outline-secondary"
                                className="px-1 py-0 d-flex align-items-center"
                                onClick={() => {
                                  setPendingPosRowId(oRow.id);
                                  setPosSearchTerm(oRow.cariKod || "");
                                  setShowPosModal(true);
                                }}
                                title="POS Cihazı Seç (F3/F4)"
                                style={{
                                  backgroundColor: rowBg,
                                }}
                              >
                                <IconBinoculars size={12} />
                              </Button>
                            </InputGroup>
                          ) : isHesapRow ? (
                            <InputGroup size="sm">
                              <Form.Control
                                ref={(el) => { odemeInputRefs.current[`${oRow.id}_cariKod`] = el; }}
                                value={oRow.cariKod ?? ""}
                                placeholder="Hesap No / Dürbün"
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (!val) {
                                    setOdemeRows((prev) => prev.map((r) => r.id === oRow.id ? { ...r, cariKod: "", bankaId: null, paraAdi: "" } : r));
                                    return;
                                  }
                                  setOdemeRows((prev) => prev.map((r) => r.id === oRow.id ? { ...r, cariKod: val } : r));
                                  const match = bankaHesaplari.find((b) => (b.hesapNo || "").trim().toLowerCase() === val.trim().toLowerCase());
                                  if (match) {
                                    setOdemeRows((prev) => prev.map((r) => r.id === oRow.id ? {
                                      ...r,
                                      cariKod: match.hesapNo,
                                      paraAdi: match.hesapAdi || "BANKA HAVALE / EFT",
                                      bankaId: match.bankaId,
                                    } : r));
                                  }
                                }}
                                onBlur={(e) => {
                                  const val = e.target.value.trim();
                                  if (val) {
                                    const match = bankaHesaplari.find((b) => (b.hesapNo || "").toLowerCase() === val.toLowerCase());
                                    if (match) {
                                      setOdemeRows((prev) => prev.map((r) => r.id === oRow.id ? {
                                        ...r,
                                        cariKod: match.hesapNo,
                                        paraAdi: match.hesapAdi || "BANKA HAVALE / EFT",
                                        bankaId: match.bankaId,
                                      } : r));
                                    }
                                  }
                                }}
                                onDoubleClick={() => {
                                  setPendingBankaRowId(oRow.id);
                                  setBankaSearchTerm(oRow.cariKod || "");
                                  setShowBankaModal(true);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "F4" || e.key === "F3") {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setPendingBankaRowId(oRow.id);
                                    setBankaSearchTerm(oRow.cariKod || "");
                                    setShowBankaModal(true);
                                    return;
                                  }
                                  handleOdemeGridKeyDown(e, rowIndex, "cariKod", oRow.id);
                                }}
                                onFocus={() => {
                                  setActiveOdemeRowIndex(rowIndex);
                                  cleanupEmptyOdemeRows(rowIndex);
                                  cleanupEmptyRows(null);
                                }}
                                style={{
                                  fontSize: "11px",
                                  padding: "1px 4px",
                                  backgroundColor: rowBg,
                                  color: rowTextColor,
                                  borderColor: rowBorderColor,
                                }}
                              />
                              <Button
                                type="button"
                                tabIndex={-1}
                                variant="outline-secondary"
                                className="px-1 py-0 d-flex align-items-center"
                                onClick={() => {
                                  setPendingBankaRowId(oRow.id);
                                  setBankaSearchTerm(oRow.cariKod || "");
                                  setShowBankaModal(true);
                                }}
                                title="Banka Hesabı Seç (F3/F4)"
                                style={{
                                  backgroundColor: rowBg,
                                }}
                              >
                                <IconBinoculars size={12} />
                              </Button>
                            </InputGroup>
                          ) : (
                            <Form.Control
                              ref={(el) => { odemeInputRefs.current[`${oRow.id}_cariKod`] = el; }}
                              size="sm"
                              value="-"
                              readOnly
                              disabled
                              tabIndex={-1}
                              style={{ fontSize: "11px", padding: "1px 4px", backgroundColor: "#e9ecef", cursor: "not-allowed", textAlign: "center" }}
                            />
                          )}
                        </td>

                        {/* Para Adı / Cari Hesap Adı */}
                        <td style={{ padding: "2px 4px", backgroundColor: rowBg, borderColor: rowBorderColor, verticalAlign: "middle" }}>
                          <Form.Control
                            ref={(el) => { odemeInputRefs.current[`${oRow.id}_paraAdi`] = el; }}
                            size="sm"
                            value={
                              isVeresiyeRow
                                ? (oRow.cariUnvan || aliciUnvan || "VERESİYE / AÇIK HESAP")
                                : (oRow.paraAdi || (oRow.paraKodu === "TL" ? "TÜRK LİRASI" : ""))
                            }
                            readOnly
                            tabIndex={-1}
                            onKeyDown={(e) => handleOdemeGridKeyDown(e, rowIndex, "paraAdi", oRow.id)}
                            style={{
                              fontSize: "11px",
                              padding: "1px 4px",
                              backgroundColor: rowBg,
                              color: rowTextColor || undefined,
                              fontWeight: (isVeresiyeRow || isIskontoRow) ? 600 : undefined,
                              borderColor: rowBorderColor,
                            }}
                          />
                        </td>

                        {/* Para Kodu (+ Dürbün) */}
                        <td style={{ padding: "2px 4px", backgroundColor: rowBg, borderColor: rowBorderColor, verticalAlign: "middle" }}>
                          <InputGroup size="sm">
                            <Form.Control
                              ref={(el) => { odemeInputRefs.current[`${oRow.id}_paraKodu`] = el; }}
                              value={oRow.paraKodu || ""}
                              placeholder="Para Kod / Dürbün"
                              onChange={(e) => {
                                const val = e.target.value;
                                updateOdemeRow(oRow.id, "paraKodu", val);
                                const upper = val.trim().toUpperCase();
                                if (upper === "TL" || upper === "TRY" || upper === "TRL") {
                                  setOdemeRows((prev) =>
                                    prev.map((r) =>
                                      r.id === oRow.id
                                        ? { ...r, paraKodu: "TL", paraAdi: "TÜRK LİRASI", kur: 1, milyem: "", adet: "", hasGram: "" }
                                        : r
                                    )
                                  );
                                } else {
                                  const match = allOdemeUrunler.find((u) => u.kod.trim().toLowerCase() === val.trim().toLowerCase());
                                  if (match) {
                                    applyProductToOdemeRow(oRow.id, match);
                                  }
                                }
                              }}
                              onBlur={(e) => {
                                const val = e.target.value.trim();
                                if (val.toUpperCase() === "TL" || val.toUpperCase() === "TRY" || val.toUpperCase() === "TRL") {
                                  setOdemeRows((prev) =>
                                    prev.map((r) =>
                                      r.id === oRow.id
                                        ? { ...r, paraKodu: "TL", paraAdi: "TÜRK LİRASI", kur: 1, milyem: "", adet: "", hasGram: "" }
                                        : r
                                    )
                                  );
                                } else if (val) {
                                  const match = allOdemeUrunler.find((u) => u.kod.trim().toLowerCase() === val.toLowerCase());
                                  if (match) {
                                    applyProductToOdemeRow(oRow.id, match);
                                  }
                                }
                              }}
                              onDoubleClick={() => openOdemeUrunModal(oRow.id)}
                              onKeyDown={(e) => {
                                if (e.key === "F4" || e.key === "F3") {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  openOdemeUrunModal(oRow.id);
                                  return;
                                }
                                handleOdemeGridKeyDown(e, rowIndex, "paraKodu", oRow.id);
                              }}
                              onFocus={() => {
                                setActiveOdemeRowIndex(rowIndex);
                                cleanupEmptyOdemeRows(rowIndex);
                                cleanupEmptyRows(null);
                              }}
                              style={{
                                fontSize: "11px",
                                padding: "1px 4px",
                                textTransform: "uppercase",
                                fontWeight: 600,
                                backgroundColor: rowBg,
                                color: rowTextColor,
                                borderColor: rowBorderColor,
                              }}
                            />
                            <Button
                              type="button"
                              tabIndex={-1}
                              variant="outline-secondary"
                              className="px-1 py-0 d-flex align-items-center"
                              onClick={() => openOdemeUrunModal(oRow.id)}
                              title="Para / Ürün Seç (F3/F4)"
                              style={{
                                borderColor: isVeresiyeRow ? "#fca5a5" : isIskontoRow ? "#86efac" : undefined,
                                backgroundColor: rowBg,
                              }}
                            >
                              <IconBinoculars size={12} />
                            </Button>
                          </InputGroup>
                        </td>

                        {/* Adet */}
                        <td style={{ padding: "2px 4px", backgroundColor: rowBg, borderColor: rowBorderColor, verticalAlign: "middle" }}>
                          <Form.Control
                            ref={(el) => { odemeInputRefs.current[`${oRow.id}_adet`] = el; }}
                            inputMode="numeric"
                            size="sm"
                            className="text-end font-monospace"
                            value={oRow.adet || ""}
                            readOnly={!isMetal}
                            disabled={!isMetal}
                            tabIndex={!isMetal ? -1 : undefined}
                            onChange={(e) => updateOdemeRow(oRow.id, "adet", e.target.value)}
                            onKeyDown={(e) => handleOdemeGridKeyDown(e, rowIndex, "adet", oRow.id)}
                            onFocus={() => {
                              setActiveOdemeRowIndex(rowIndex);
                              cleanupEmptyOdemeRows(rowIndex);
                              cleanupEmptyRows(null);
                            }}
                            style={{
                              fontSize: "11px",
                              padding: "1px 4px",
                              backgroundColor: rowBg,
                              color: rowTextColor || (!isMetal ? "#94a3b8" : undefined),
                              borderColor: rowBorderColor,
                            }}
                          />
                        </td>

                        {/* Miktar */}
                        <td style={{ padding: "2px 4px", backgroundColor: rowBg, borderColor: rowBorderColor, verticalAlign: "middle" }}>
                          <Form.Control
                            ref={(el) => { odemeInputRefs.current[`${oRow.id}_miktar`] = el; }}
                            inputMode="decimal"
                            size="sm"
                            className="text-end font-monospace fw-semibold"
                            value={formatMiktar(oRow.miktar)}
                            onChange={(e) => updateOdemeRow(oRow.id, "miktar", e.target.value)}
                            onBlur={() => updateOdemeRow(oRow.id, "miktar", formatMiktar(oRow.miktar))}
                            onKeyDown={(e) => handleOdemeGridKeyDown(e, rowIndex, "miktar", oRow.id)}
                            onFocus={() => {
                              setActiveOdemeRowIndex(rowIndex);
                              cleanupEmptyOdemeRows(rowIndex);
                              cleanupEmptyRows(null);
                            }}
                            style={{
                              fontSize: "11px",
                              padding: "1px 4px",
                              backgroundColor: rowBg,
                              color: rowTextColor,
                              borderColor: rowBorderColor,
                            }}
                          />
                        </td>

                        {/* Milyem */}
                        <td style={{ padding: "2px 4px", backgroundColor: rowBg, borderColor: rowBorderColor, verticalAlign: "middle" }}>
                          <Form.Control
                            ref={(el) => { odemeInputRefs.current[`${oRow.id}_milyem`] = el; }}
                            inputMode="decimal"
                            size="sm"
                            className="text-end font-monospace"
                            value={oRow.milyem}
                            readOnly={!isMetal}
                            disabled={!isMetal}
                            tabIndex={!isMetal ? -1 : undefined}
                            onChange={(e) => updateOdemeRow(oRow.id, "milyem", e.target.value)}
                            onKeyDown={(e) => handleOdemeGridKeyDown(e, rowIndex, "milyem", oRow.id)}
                            onFocus={() => {
                              setActiveOdemeRowIndex(rowIndex);
                              cleanupEmptyOdemeRows(rowIndex);
                              cleanupEmptyRows(null);
                            }}
                            style={{
                              fontSize: "11px",
                              padding: "1px 4px",
                              backgroundColor: rowBg,
                              color: rowTextColor || (!isMetal ? "#94a3b8" : undefined),
                              borderColor: rowBorderColor,
                            }}
                          />
                        </td>

                        {/* Has Gr */}
                        <td style={{ padding: "2px 4px", backgroundColor: rowBg, borderColor: rowBorderColor, verticalAlign: "middle" }}>
                          <Form.Control
                            ref={(el) => { odemeInputRefs.current[`${oRow.id}_hasGram`] = el; }}
                            inputMode="decimal"
                            size="sm"
                            className="text-end font-monospace"
                            value={isMetal ? (oRow.hasGram || "") : ""}
                            readOnly={!isMetal}
                            disabled={!isMetal}
                            tabIndex={!isMetal ? -1 : undefined}
                            onChange={(e) => updateOdemeRow(oRow.id, "hasGram", e.target.value)}
                            onKeyDown={(e) => handleOdemeGridKeyDown(e, rowIndex, "hasGram", oRow.id)}
                            onFocus={() => {
                              setActiveOdemeRowIndex(rowIndex);
                              cleanupEmptyOdemeRows(rowIndex);
                              cleanupEmptyRows(null);
                            }}
                            style={{
                              fontSize: "11px",
                              padding: "1px 4px",
                              backgroundColor: rowBg,
                              color: rowTextColor || (!isMetal ? "#94a3b8" : undefined),
                              borderColor: rowBorderColor,
                            }}
                          />
                        </td>

                        {/* Kur - Kesinlikle Değiştirilemez / Salt Okunur */}
                        <td style={{ padding: "2px 4px", backgroundColor: isOdemeRowTL ? "#e9ecef" : "#f8fafc", borderColor: rowBorderColor, verticalAlign: "middle" }}>
                          <Form.Control
                            size="sm"
                            readOnly
                            disabled
                            tabIndex={-1}
                            className={`text-end font-monospace ${isOdemeRowTL ? "text-muted" : "fw-bold text-dark"}`}
                            value={isOdemeRowTL ? "" : (oRow.kur !== "" && oRow.kur !== null && oRow.kur !== undefined && Number(oRow.kur) > 0 ? oRow.kur : (getKurForProduct({ paraId: oRow.paraId, kod: oRow.paraKodu, ad: oRow.paraAdi, urunTipi: oRow.urunTipi }, faturaTipi === 1 ? 0 : 1) || (Number(altinHasKuru) > 0 ? altinHasKuru : "")))}
                            placeholder={isOdemeRowTL ? "-" : "Kur"}
                            style={{
                              fontSize: "11px",
                              padding: "1px 4px",
                              backgroundColor: isOdemeRowTL ? "#e9ecef" : "#f8fafc",
                              cursor: "not-allowed",
                              borderColor: rowBorderColor,
                            }}
                            title="Ödeme kur değeri (Değiştirilemez)"
                          />
                        </td>

                        {/* Tutar (TL) - Pasif / Salt Okunur */}
                        <td style={{ padding: "2px 4px", backgroundColor: rowBg, borderColor: rowBorderColor, verticalAlign: "middle" }}>
                          <Form.Control
                            ref={(el) => { odemeInputRefs.current[`${oRow.id}_tutar`] = el; }}
                            size="sm"
                            className="text-end font-monospace fw-bold"
                            value={oRow.tutar !== "" && !isNaN(Number(oRow.tutar)) ? Number(oRow.tutar).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : oRow.tutar}
                            readOnly
                            tabIndex={-1}
                            onKeyDown={(e) => handleOdemeGridKeyDown(e, rowIndex, "kur", oRow.id)}
                            style={{
                              fontSize: "11px",
                              padding: "1px 4px",
                              backgroundColor: rowBg,
                              color: rowTextColor || (isOverpaidVeresiye ? "#b91c1c" : isVeresiyeRow ? "#991b1b" : "#166534"),
                              borderColor: rowBorderColor,
                              cursor: "default",
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot style={{ background: "#f2f4f7", fontWeight: 600, fontSize: "11px" }}>
                  <tr>
                    <td colSpan={3} className="text-end small">Toplam</td>
                    <td style={{ textAlign: "right" }}>{totalOdemeAdet || ""}</td>
                    <td style={{ textAlign: "right" }}>{totalOdemeMiktar ? Number(totalOdemeMiktar).toLocaleString("tr-TR", { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : ""}</td>
                    <td></td>
                    <td style={{ textAlign: "right" }}>{totalOdemeHas ? Number(totalOdemeHas).toFixed(4) : ""}</td>
                    <td></td>
                    <td style={{ textAlign: "right" }}>
                      {totalOdemeTutar ? totalOdemeTutar.toLocaleString("tr-TR", { minimumFractionDigits: 2 }) + " TL" : ""}
                    </td>
                  </tr>
                </tfoot>
              </Table>
            </div>
          </div>
        </Col>

        {/* SAĞDA: TL / HAS Özet Tablosu */}
        <Col xs={12} lg={4} md={5}>
          <div className="d-flex flex-column gap-2">
            {/* TL / HAS Karşılığı ve Fark Tablosu */}
            <div className="border rounded bg-white overflow-hidden shadow-sm">
              <Table bordered size="sm" className="mb-0 align-middle" style={{ fontSize: "11.5px" }}>
                <thead style={{ background: "#eef2f6" }}>
                  <tr>
                    <th></th>
                    <th className="text-center" style={{ width: "42%" }}>TL</th>
                    <th className="text-center" style={{ width: "42%" }}>HAS</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="fw-semibold text-secondary">{faturaTipi === 0 ? "Alış" : "Satış"}</td>
                    <td className="text-end font-monospace">{genelToplam.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</td>
                    <td className="text-end font-monospace">{totalHasGrams.toFixed(4)}</td>
                  </tr>
                  <tr>
                    <td className="fw-semibold text-secondary">{faturaTipi === 0 ? "Ödeme" : "Tahsilat"}</td>
                    <td className="text-end font-monospace">{totalOdemeTutar.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</td>
                    <td className="text-end font-monospace">{totalOdemeHas.toFixed(4)}</td>
                  </tr>
                  <tr style={{ background: farkTL < -0.01 ? "#fee2e2" : (Math.abs(farkTL) > 0.01 || Math.abs(farkHas) > 0.0001) ? "#fff5f5" : "#f8f9fa" }}>
                    <td className="fw-bold" style={{ color: farkTL < -0.01 ? "#991b1b" : "inherit" }}>Fark</td>
                    <td className="text-end fw-bold font-monospace" style={{ color: farkTL < -0.01 ? "#991b1b" : Math.abs(farkTL) > 0.01 ? "#dc3545" : "inherit" }}>
                      {farkTL < -0.01 ? (
                        <span className="badge bg-danger text-white px-2 py-1 shadow-2xs" style={{ fontSize: "11.5px" }}>
                          {farkTL.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺
                        </span>
                      ) : (
                        <span>{farkTL.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</span>
                      )}
                    </td>
                    <td className="text-end fw-bold font-monospace" style={{ color: Math.abs(farkHas) > 0.0001 ? "#dc3545" : "inherit" }}>
                      {farkHas.toFixed(4)}
                    </td>
                  </tr>
                  {farkTL < -0.01 && (
                    <tr>
                      <td colSpan={3} className="p-1.5 text-center" style={{ background: "#fef2f2" }}>
                        <div className="text-danger small fw-bold d-flex align-items-center justify-content-center gap-1">
                          <i className="bi bi-exclamation-triangle-fill"></i>
                          <span>Ödeme fiş toplamından {(Math.abs(farkTL)).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺ fazladır!</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </div>

            {/* Alt Toplam Özeti Kutusu */}
            <div className="p-2 border rounded bg-light" style={{ fontSize: "11.5px" }}>
              <div className="d-flex justify-content-between mb-1">
                <span className="text-muted">Toplam Kalem:</span>
                <strong className="font-monospace">{validItems.length}</strong>
              </div>
              <div className="d-flex justify-content-between mb-1">
                <span className="text-muted">Toplam Gram / Adet:</span>
                <strong className="font-monospace">{totalGrams.toFixed(2)} gr ({totalQuantity} ad)</strong>
              </div>
              <div className="d-flex justify-content-between mb-1">
                <span className="text-muted">Ara Toplam:</span>
                <strong className="font-monospace">{araToplam.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</strong>
              </div>
              <div className="d-flex justify-content-between mb-1">
                <span className="text-muted">Toplam KDV:</span>
                <strong className="font-monospace">{toplamKdv.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</strong>
              </div>

              {/* İskonto & İndirim Özeti */}
              {calculatedIskontoTutari > 0 && (
                <div className="d-flex justify-content-between text-danger fw-semibold my-1 pt-1 border-top">
                  <span>
                    İskonto{" "}
                    {selectedIskonto
                      ? `(${selectedIskonto.kod ? `${selectedIskonto.kod} - ` : ""}${selectedIskonto.tanim})`
                      : iskontoKodu
                        ? `(${iskontoKodu})`
                        : ""}{" "}
                    {calculatedIskontoOrani > 0 ? `(%${calculatedIskontoOrani})` : ""}:
                  </span>
                  <strong className="font-monospace">
                    -{calculatedIskontoTutari.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺
                  </strong>
                </div>
              )}

              <div className="d-flex justify-content-between pt-1 fw-bold text-success" style={{ fontSize: "13px" }}>
                <span>GENEL TOPLAM:</span>
                <span className="font-monospace">{genelToplam.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</span>
              </div>
            </div>
          </div>
        </Col>
      </Row>
        </Card.Body>
      </Card>

      {/* ─── 6. Kısayol Bilgilendirme Çubuğu (Footer Notu) ────────────── */}
      <div
        className="d-flex align-items-center justify-content-between flex-wrap gap-2 px-3 py-1.5 rounded border bg-white text-muted shadow-sm"
        style={{ fontSize: "11px" }}
      >
        <div className="d-flex align-items-center flex-wrap gap-2 gap-md-3">
          <span>
            <kbd className="bg-primary text-white px-1.5 py-0.5 rounded me-1 fw-bold">F1</kbd>
            <strong className="text-dark">Kaydet</strong>
          </span>
          {isDuzeltmeMode && (
            <>
              <span className="text-secondary">•</span>
              <span>
                <kbd className="bg-danger text-white px-1.5 py-0.5 rounded me-1 fw-bold">F2</kbd>
                <strong className="text-dark">Sil</strong>
              </span>
              <span className="text-secondary">•</span>
              <span>
                <kbd className="bg-info text-white px-1.5 py-0.5 rounded me-1 fw-bold">F3</kbd>
                <strong className="text-dark">Fatura Ara</strong>
              </span>
            </>
          )}
          <span className="text-secondary">•</span>
          <span
            className="user-select-none"
            onClick={() => {
              setMusteriSearchTerm(aliciUnvan !== "NİHAİ TÜKETİCİ" ? aliciUnvan : cariKod);
              setShowMusteriModal(true);
            }}
            style={{ cursor: "pointer" }}
            title="Cari / Müşteri Seçimi (F4)"
          >
            <kbd className="bg-secondary text-white px-1.5 py-0.5 rounded me-1 fw-bold">F4</kbd>
            <strong className="text-dark">Cari Seç</strong>
          </span>
          <span className="text-secondary">•</span>
          <span
            className="user-select-none"
            onClick={openMusteriDetayModal}
            style={{ cursor: "pointer" }}
            title="Müşteri Detayı ve Adres Bilgileri Formunu Aç (F8)"
          >
            <kbd className="bg-warning text-dark px-1.5 py-0.5 rounded me-1 fw-bold">F8</kbd>
            <strong className="text-dark">Müşteri Detayı</strong>
          </span>
          <span className="text-secondary">•</span>
          <span>
            <kbd className="bg-success text-white px-1.5 py-0.5 rounded me-1 fw-bold">F10</kbd>
            <strong className="text-dark">Kaydet / Yazdır</strong>
          </span>
        </div>
        <div className="text-muted small d-none d-lg-block">
          Likya Kuyumculuk ERP
        </div>
      </div>

      {/* ─── MODALS ───────────────────────────────────────────────────── */}

      {/* İskonto Seçim Modalı (LookupModal) */}
      <LookupModal<IskontoItem>
        show={showIskontoModal}
        onHide={() => {
          setShowIskontoModal(false);
          setIskontoSearchTerm("");
        }}
        title="Ödeme Tablosuna İskonto Seçiniz"
        items={iskontolar}
        columns={iskontoLookupColumns}
        initialSearchTerm={iskontoSearchTerm}
        onAddNew={() => setShowNewIskontoModal(true)}
        addNewLabel="Yeni Kayıt"
        filterFn={(it, term) => {
          const t = term.toLowerCase();
          return (
            (it.kod ? it.kod.toLowerCase().includes(t) : false) ||
            (it.tanim ? it.tanim.toLowerCase().includes(t) : false)
          );
        }}
        onSelect={(selected) => {
          if (selected) {
            handleAddIskontoToOdeme(selected);
          }
          setShowIskontoModal(false);
          setIskontoSearchTerm("");
        }}
      />

      {/* Barkodlu Altın / Özel Ürün Seçim Modalı (LookupModal) */}
      <LookupModal
        show={showProductLookup}
        onHide={() => {
          setShowProductLookup(false);
          setProductSearchTerm("");
          const caller = lastModalCallerRef.current;
          const pRowId = lastProductRowIdRef.current;
          lastModalCallerRef.current = null;
          lastProductRowIdRef.current = null;
          if (caller === "productLookup" && pRowId) {
            setTimeout(() => {
              focusGridCell(pRowId, "barkod", "select");
            }, 50);
          }
        }}
        title="Barkodlu / Barkodsuz Ürün ve Para Tablosu Seçimi"
        items={combinedLookupItems}
        isLoading={isProductLoading}
        columns={productLookupColumns}
        initialSearchTerm={productSearchTerm}
        filterFn={(it, term) => {
          const t = (term || "").toLowerCase().trim();
          if (!t) return true;
          if (it.tip === "para") {
            const p = it.item as UrunItem;
            const kod = (p.kod || "").toLowerCase();
            const ad = (p.ad || "").toLowerCase();
            return kod.includes(t) || ad.includes(t);
          }
          const raw = it.item as AltinUrunItem | OzelUrunItem;
          const barkod = (raw.barkod || `${raw.grupKodu || ""}${raw.urunNo || ""}`).toLowerCase();
          const model = (
            (it.tip === "altin"
              ? (raw as AltinUrunItem).model
              : (raw as OzelUrunItem).mamulTipi) || ""
          ).toLowerCase();
          const ayar = (raw.ayar || "").toLowerCase();
          const grupKodu = (raw.grupKodu || "").toLowerCase();
          const urunNo = String(raw.urunNo || "").toLowerCase();
          const aciklama = ((raw as any).aciklama || (raw as any).ad || "").toLowerCase();
          const bankoKodu = ((raw as any).bankoKodu || "").toLowerCase();
          return (
            barkod.includes(t) ||
            model.includes(t) ||
            ayar.includes(t) ||
            grupKodu.includes(t) ||
            urunNo.includes(t) ||
            aciklama.includes(t) ||
            bankoKodu.includes(t)
          );
        }}
        onSelect={(item) => {
          lastModalCallerRef.current = null;
          lastProductRowIdRef.current = null;
          handleSelectFromProductLookup(item);
        }}
      />

      {/* Ödeme / Para ve İskonto Seçim Modalı */}
      <LookupModal
        show={showOdemeUrunModal}
        searchByCodeOnly={true}
        onHide={() => {
          setShowOdemeUrunModal(false);
          const caller = lastModalCallerRef.current;
          const oRowId = lastOdemeRowIdRef.current;
          lastModalCallerRef.current = null;
          lastOdemeRowIdRef.current = null;
          setActiveOdemeRowIdForUrun(null);
          setOdemeSearchTerm("");
          if (caller === "odemeLookup" && oRowId) {
            setTimeout(() => {
              focusOdemeGridCell(oRowId, "paraKodu", "select");
            }, 50);
          }
        }}
        title="Ödeme Para / İskonto Seçimi"
        items={(() => {
          const targetRow = odemeRows.find((r) => r.id === (activeOdemeRowIdForUrun || lastOdemeRowIdRef.current));
          const isCari = targetRow?.odemeAraciTuru === 1 || Boolean(targetRow?.cariKartId);
          const baseList = isCari ? allOdemeUrunler : odemeUrunList;
          return baseList.filter((u) => {
            const k = (u.kod || "").toUpperCase().trim();
            return k !== "VERESIYE" && k !== "VERESİYE" && k !== "ACIKHESAP" && k !== "AÇIK HESAP";
          });
        })()}
        columns={odemeLookupColumns}
        initialSearchTerm={odemeSearchTerm}
        onAddNew={() => setShowNewProductModal(true)}
        addNewLabel="Yeni Kayıt"
        filterFn={(u, term) => {
          const t = term.toLowerCase().trim();
          if (!t) return true;
          return (u.kod || "").toLowerCase().includes(t);
        }}
        onSelect={(selectedUrun) => {
          const targetRowId = activeOdemeRowIdForUrun || lastOdemeRowIdRef.current;
          lastModalCallerRef.current = null;
          lastOdemeRowIdRef.current = null;
          if (targetRowId) {
            applyProductToOdemeRow(targetRowId, selectedUrun);
          }
          setShowOdemeUrunModal(false);
          setActiveOdemeRowIdForUrun(null);
          setOdemeSearchTerm("");
        }}
      />

      {/* Vezne Seçim Modalı (LookupModal) */}
      <LookupModal
        show={showVezneModal}
        onHide={() => setShowVezneModal(false)}
        title="Vezne / Kasa Seçimi"
        items={vezneler}
        columns={vezneLookupColumns}
        onAddNew={() => setShowNewVezneModal(true)}
        addNewLabel="Yeni Kayıt"
        filterFn={(v, term) =>
          v.kod.toLowerCase().includes(term.toLowerCase()) ||
          v.ad.toLowerCase().includes(term.toLowerCase())
        }
        onSelect={(v) => {
          setSelectedVezne(v);
          setShowVezneModal(false);
        }}
      />

      {/* POS Cihazı Seçim Modalı */}
      <LookupModal<PosCihaziItem>
        show={showPosModal}
        onHide={() => {
          setShowPosModal(false);
          setPosSearchTerm("");
          setPendingPosRowId(null);
        }}
        title="POS Cihazı Seçimi"
        items={posCihazlari}
        initialSearchTerm={posSearchTerm}
        selectedId={
          posSearchTerm
            ? posSearchTerm
            : (odemeRows.find((r) => r.id === pendingPosRowId)?.bankaId ||
               odemeRows.find((r) => r.id === pendingPosRowId)?.cariKod ||
               undefined)
        }
        columns={[
          { header: "Kod", width: "120px", render: (p) => <span className="fw-bold font-monospace text-primary">{p.kod}</span>, highlight: true },
          { header: "POS Cihazı Adı", render: (p) => <span className="fw-semibold text-dark">{p.ad}</span>, highlight: false },
        ]}
        filterFn={(p, term) => {
          const t = term.toLowerCase().trim();
          return (p.kod || "").toLowerCase().includes(t) || (p.ad || "").toLowerCase().includes(t);
        }}
        onSelect={(pos) => {
          if (pos && pendingPosRowId) {
            const targetRowId = pendingPosRowId;
            setOdemeRows((prev) => prev.map((r) => r.id === targetRowId ? {
              ...r,
              cariKod: pos.kod,
              paraAdi: pos.ad || "KREDİ KARTI / POS",
              bankaId: pos.posCihaziId,
            } : r));
            setTimeout(() => {
              focusOdemeGridCell(targetRowId, "miktar", "select");
            }, 50);
          }
          setShowPosModal(false);
          setPosSearchTerm("");
          setPendingPosRowId(null);
        }}
      />

      {/* Banka Hesap Seçim Modalı */}
      <LookupModal<BankaHesapItem>
        show={showBankaModal}
        onHide={() => {
          setShowBankaModal(false);
          setBankaSearchTerm("");
          setPendingBankaRowId(null);
        }}
        title="Banka Hesabı Seçimi"
        items={bankaHesaplari}
        initialSearchTerm={bankaSearchTerm}
        selectedId={
          bankaSearchTerm
            ? bankaSearchTerm
            : (odemeRows.find((r) => r.id === pendingBankaRowId)?.bankaId ||
               odemeRows.find((r) => r.id === pendingBankaRowId)?.cariKod ||
               undefined)
        }
        columns={[
          { header: "Hesap No", width: "130px", render: (b) => <span className="fw-bold font-monospace text-primary">{b.hesapNo}</span>, highlight: true },
          { header: "Hesap Adı", render: (b) => <span className="fw-semibold text-dark">{b.hesapAdi}</span>, highlight: false },
          { header: "IBAN", width: "220px", render: (b) => <span className="small text-muted font-monospace">{b.iban || "-"}</span>, highlight: false },
        ]}
        filterFn={(b, term) => {
          const t = term.toLowerCase().trim();
          return (b.hesapNo || "").toLowerCase().includes(t) ||
                 (b.hesapAdi || "").toLowerCase().includes(t) ||
                 (b.iban || "").toLowerCase().includes(t);
        }}
        onSelect={(banka) => {
          if (banka && pendingBankaRowId) {
            const targetRowId = pendingBankaRowId;
            setOdemeRows((prev) => prev.map((r) => r.id === targetRowId ? {
              ...r,
              cariKod: banka.hesapNo,
              paraAdi: banka.hesapAdi || "BANKA HAVALE / EFT",
              bankaId: banka.bankaId,
            } : r));
            setTimeout(() => {
              focusOdemeGridCell(targetRowId, "miktar", "select");
            }, 50);
          }
          setShowBankaModal(false);
          setBankaSearchTerm("");
          setPendingBankaRowId(null);
        }}
      />

      {/* Müşteri / Cari Seçim Modalı (MusteriSecimModal) */}
      {showMusteriModal && (
        <MusteriSecimModal
          show={showMusteriModal}
          onClose={() => {
            setShowMusteriModal(false);
            setMusteriSearchTerm("");
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
                aliciUnvanRef.current?.focus();
                aliciUnvanRef.current?.select();
              }, 50);
            } else if (caller === "vkn") {
              setTimeout(() => {
                vknRef.current?.focus();
                vknRef.current?.select();
              }, 50);
            }
          }}
          cariler={cariler}
          kayitsizMusteriler={kayitsizMusteriler}
          onSelectCustomer={(res) => {
            lastModalCallerRef.current = null;
            void handleSelectCustomer(res);
            setShowMusteriModal(false);
            setMusteriSearchTerm("");
            setCariSearchField("all");
          }}
          currentUnvan={aliciUnvan}
          initialSearchTerm={musteriSearchTerm}
          initialSearchField={cariSearchField}
        />
      )}

      {/* MASAK Sorgulama Sonuç Modalı */}
      <MasakSonucModal
        show={masakModalOpen}
        onHide={() => setMasakModalOpen(false)}
        queriedName={masakResult.queriedName}
        queriedId={masakResult.queriedId}
        matches={masakResult.matches}
        searched={masakResult.searched}
      />

      {/* MASAK Limit Uyarı & Onay Modalı */}
      <Modal
        show={showMasakLimitWarningModal}
        onHide={() => setShowMasakLimitWarningModal(false)}
        centered
        backdrop="static"
      >
        <Modal.Header closeButton className="py-2 bg-warning text-dark">
          <Modal.Title className="h6 mb-0 d-flex align-items-center gap-2 fw-bold">
            <IconAlertTriangle size={20} />
            MASAK Yasal Bildirim Sınırı Uyarısı (≥185.000 TL)
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="py-3">
          <div className="d-flex align-items-start gap-3">
            <div className="p-2 bg-warning bg-opacity-10 rounded-circle text-warning flex-shrink-0">
              <IconAlertTriangle size={32} />
            </div>
            <div>
              <p className="mb-2 fw-semibold">
                İşlem tutarı <strong>185.000 TL</strong> yasal kimlik tespit limitini aşmaktadır.
              </p>
              <p className="small text-muted mb-2">
                5549 sayılı Kanun uyarınca 185.000 TL ve üzeri işlemlerde müşterinin gerçek <strong>İsim/Ünvan, T.C. Kimlik No / VKN ve Adres</strong> bilgilerinin eksiksiz girilmesi yasal zorunluluktur.
              </p>
              <div className="alert alert-warning py-1.5 px-2.5 small mb-0">
                Lütfen <strong>Detaya Git</strong> butonuna tıklayarak müşterinin kimlik ve adres bilgilerini doldurunuz.
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer className="py-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShowMasakLimitWarningModal(false)}
          >
            Vazgeç
          </Button>
          <Button
            size="sm"
            variant="outline-warning"
            className="fw-bold"
            onClick={() => {
              setShowMasakLimitWarningModal(false);
              void handleCompleteSale(pendingSaveWithPrint, true, true);
            }}
          >
            Yine de Kaydet
          </Button>
          <Button
            size="sm"
            variant="warning"
            className="fw-bold d-flex align-items-center gap-1 text-dark"
            onClick={() => {
              setShowMasakLimitWarningModal(false);
              openMusteriDetayModal();
            }}
          >
            <IconEdit size={16} />
            <span>Detaya Git (F8)</span>
          </Button>
        </Modal.Footer>
      </Modal>

      {/* MASAK Yasal Sınırı Kayıt Onay Modalı */}
      <Modal
        show={showMasakConfirmModal}
        onHide={() => setShowMasakConfirmModal(false)}
        centered
        backdrop="static"
      >
        <Modal.Header closeButton className="py-2 bg-warning-subtle text-warning-emphasis">
          <Modal.Title className="h6 mb-0 d-flex align-items-center gap-2">
            <IconAlertTriangle size={20} className="text-warning" />
            MASAK Yasal Sınırı - Kayıt Onayı
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="py-3 text-center">
          <div className="mb-3">
            <IconAlertTriangle size={48} className="text-warning" />
          </div>
          <h6 className="fw-bold mb-2">
            İşlem MASAK Yasal Sınırını (≥185.000 TL) Aşmaktadır!
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
              void handleCompleteSale(pendingSaveWithPrint, true, true);
            }}
          >
            Yine de Kaydet
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Müşteri & MASAK Detay Bilgileri Modalı */}
      <Modal
        show={showMusteriDetayModal}
        onHide={() => setShowMusteriDetayModal(false)}
        centered
        size="lg"
      >
        <Modal.Header closeButton className="py-2 bg-light border-bottom">
          <Modal.Title className="h6 mb-0 d-flex align-items-center gap-2 fw-bold text-dark">
            <IconBinoculars size={18} className="text-primary" />
            Müşteri / MASAK Detay Bilgileri (F8)
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3">
          <Row className="g-3">
            <Col xs={12} md={6}>
              <Form.Group className="mb-2">
                <Form.Label className="small fw-bold text-secondary mb-1">
                  Müşteri Adı / Ünvanı <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  size="sm"
                  value={detayUnvan}
                  onChange={(e) => setDetayUnvan(e.target.value)}
                  placeholder="Müşteri Adı Soyadı veya Ünvanı"
                  style={{ fontWeight: 600 }}
                />
              </Form.Group>

              <Form.Group className="mb-2">
                <Form.Label className="small fw-bold text-secondary mb-1">
                  TCKN / VKN / Pasaport No <span className="text-danger">*</span>
                </Form.Label>
                <InputGroup size="sm">
                  <Form.Control
                    value={detayVknTckn}
                    onChange={(e) => setDetayVknTckn(e.target.value)}
                    placeholder="11 haneli TCKN veya 10 haneli VKN"
                    style={{ fontFamily: "monospace", fontWeight: 600 }}
                  />
                  <Button
                    variant="outline-danger"
                    size="sm"
                    className="d-flex align-items-center gap-1 fw-semibold"
                    onClick={() => handleMasakQuery(detayUnvan, detayVknTckn)}
                    disabled={isSearchingMasak}
                    title="MASAK Listelerinde Sorgula"
                  >
                    {isSearchingMasak ? (
                      <Spinner size="sm" animation="border" style={{ width: 12, height: 12 }} />
                    ) : (
                      <IconShieldCheck size={14} className="text-danger" />
                    )}
                    <span>MASAK</span>
                  </Button>
                </InputGroup>
              </Form.Group>

              <Form.Group className="mb-2">
                <Form.Label className="small fw-bold text-secondary mb-1">Vergi Dairesi</Form.Label>
                <Form.Control
                  size="sm"
                  value={detayVergiDairesi}
                  onChange={(e) => setDetayVergiDairesi(e.target.value)}
                  placeholder="Vergi Dairesi Adı"
                />
              </Form.Group>

              <Row className="g-2">
                <Col xs={6}>
                  <Form.Group className="mb-2">
                    <Form.Label className="small fw-bold text-secondary mb-1">İl</Form.Label>
                    <Form.Control
                      size="sm"
                      value={detayIl}
                      onChange={(e) => setDetayIl(e.target.value)}
                      placeholder="İl"
                    />
                  </Form.Group>
                </Col>
                <Col xs={6}>
                  <Form.Group className="mb-2">
                    <Form.Label className="small fw-bold text-secondary mb-1">İlçe</Form.Label>
                    <Form.Control
                      size="sm"
                      value={detayIlce}
                      onChange={(e) => setDetayIlce(e.target.value)}
                      placeholder="İlçe"
                    />
                  </Form.Group>
                </Col>
              </Row>
            </Col>

            <Col xs={12} md={6}>
              <Form.Group className="mb-2">
                <Form.Label className="small fw-bold text-secondary mb-1">
                  Adres <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  size="sm"
                  value={detayAdres}
                  onChange={(e) => setDetayAdres(e.target.value)}
                  placeholder="Mahalle, cadde, sokak, bina ve kapı no..."
                  style={{ fontSize: "12px" }}
                />
              </Form.Group>

              <Form.Group className="mb-2">
                <Form.Label className="small fw-bold text-secondary mb-1">Telefon</Form.Label>
                <Form.Control
                  size="sm"
                  value={detayTelefon}
                  onChange={(e) => setDetayTelefon(e.target.value)}
                  placeholder="05XX XXX XX XX"
                />
              </Form.Group>

              <Form.Group className="mb-2">
                <Form.Label className="small fw-bold text-secondary mb-1">E-Posta</Form.Label>
                <Form.Control
                  size="sm"
                  type="email"
                  value={detayEposta}
                  onChange={(e) => setDetayEposta(e.target.value)}
                  placeholder="ornek@alanadi.com"
                />
              </Form.Group>
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer className="py-2 bg-light border-top d-flex justify-content-between">
          <Button
            size="sm"
            variant="outline-secondary"
            onClick={() => {
              setShowMusteriDetayModal(false);
              setMusteriSearchTerm(detayUnvan || aliciUnvan !== "NİHAİ TÜKETİCİ" ? detayUnvan || aliciUnvan : "");
              setShowMusteriModal(true);
            }}
          >
            Cari Listesinden Seç (F4)
          </Button>
          <div className="d-flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setShowMusteriDetayModal(false)}
            >
              Vazgeç
            </Button>
            <Button
              size="sm"
              variant="success"
              className="fw-bold d-flex align-items-center gap-1"
              onClick={() => handleSaveMusteriDetay(true)}
            >
              <IconCheck size={16} />
              <span>Kaydet ve Fişi Tamamla</span>
            </Button>
          </div>
        </Modal.Footer>
      </Modal>

      {/* Ayar Seçim Modalı (AyarSecimModal) */}
      {showAyarModal && (
        <AyarSecimModal
          show={showAyarModal}
          onHide={() => {
            setShowAyarModal(false);
            setActiveAyarRowId(null);
          }}
          selectedAyarKodu={
            items.find((it) => it.id === activeAyarRowId)?.ayar || undefined
          }
          onSelect={(selectedAyar: AyarItem) => {
            if (activeAyarRowId) {
              setItems((prev) =>
                prev.map((r) => {
                  if (r.id !== activeAyarRowId) return r;
                  const gram = Number(r.gram) || 0;
                  const milyem = Number(selectedAyar.milyem) || 0;
                  const hasGram =
                    gram > 0 && milyem > 0
                      ? parseFloat(((gram * milyem) / 1000).toFixed(3))
                      : r.hasGram;

                  return recalculateLine({
                    ...r,
                    ayar: selectedAyar.ayarKodu,
                    hasGram,
                  });
                })
              );
              setTimeout(() => {
                focusGridCell(activeAyarRowId, "miktar", "select");
              }, 50);
            }
            setShowAyarModal(false);
            setActiveAyarRowId(null);
          }}
        />
      )}

      {/* Yazdırma Önizleme Modalı (PerakendeFisiPrintModal) */}
      {showPrintModal && (
        <PerakendeFisiPrintModal
          show={showPrintModal}
          autoPrint={isPendingDirectPrint}
          onHide={() => {
            setShowPrintModal(false);
            setIsPendingDirectPrint(false);
          }}
          fatura={printedFatura}
          vezne={selectedVezne}
        />
      )}

      {/* Geçmiş Faturalar Arama ve İptal Modalı */}
      <Modal
        show={showHistoryModal}
        onHide={() => setShowHistoryModal(false)}
        size="xl"
        centered
        backdrop="static"
      >
        <Modal.Header closeButton className="bg-light py-2 px-3 border-bottom">
          <div className="d-flex align-items-center gap-2">
            <IconHistory size={20} className="text-primary" />
            <h6 className="mb-0 fw-bold">Geçmiş Perakende Satışları & Faturalar</h6>
          </div>
        </Modal.Header>

        <Modal.Body className="p-3 bg-light">
          {/* Filtreleme Alanı */}
          <div className="row g-2 mb-3 bg-white p-2 rounded border">
            <div className="col-12 col-md-3">
              <Form.Label className="small text-muted mb-1">Başlangıç Tarihi</Form.Label>
              <Form.Control
                size="sm"
                type="date"
                value={historyStartDate}
                onChange={(e) => setHistoryStartDate(e.target.value)}
              />
            </div>
            <div className="col-12 col-md-3">
              <Form.Label className="small text-muted mb-1">Bitiş Tarihi</Form.Label>
              <Form.Control
                size="sm"
                type="date"
                value={historyEndDate}
                onChange={(e) => setHistoryEndDate(e.target.value)}
              />
            </div>
            <div className="col-12 col-md-4">
              <Form.Label className="small text-muted mb-1">Arama</Form.Label>
              <Form.Control
                size="sm"
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
              />
            </div>
            <div className="col-12 col-md-2 d-flex align-items-end">
              <Button
                variant="primary"
                size="sm"
                className="w-100 d-flex align-items-center justify-content-center gap-1"
                onClick={handleSearchHistory}
                disabled={historyLoading}
              >
                {historyLoading ? (
                  <Spinner size="sm" animation="border" />
                ) : (
                  <>
                    <IconSearch size={14} />
                    <span>Filtrele</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Fatura Listesi Tablosu */}
          <div className="table-responsive bg-white rounded border" style={{ maxHeight: "400px" }}>
            <Table hover size="sm" className="align-middle mb-0 text-nowrap" style={{ fontSize: "12px" }}>
              <thead style={{ background: "#d9e8fb" }} className="sticky-top small">
                <tr>
                  <th>Fatura No</th>
                  <th>Tarih</th>
                  <th>Senaryo</th>
                  <th>Alıcı / Müşteri</th>
                  <th>TCKN / VKN</th>
                  <th className="text-end">Ara Toplam</th>
                  <th className="text-end">KDV</th>
                  <th className="text-end">Genel Toplam</th>
                  <th className="text-center">E-Belge</th>
                  <th className="text-center">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {historyLoading ? (
                  <tr>
                    <td colSpan={10} className="text-center py-4">
                      <Spinner size="sm" animation="border" className="me-2" />
                      Faturalar yükleniyor...
                    </td>
                  </tr>
                ) : historyList.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-4 text-muted">
                      Kriterlere uygun kayıt bulunamadı.
                    </td>
                  </tr>
                ) : (
                  historyList.map((f) => (
                    <tr
                      key={f.faturaId}
                      onDoubleClick={() => handleSelectInvoiceForEdit(f.faturaId)}
                      style={{ cursor: "pointer" }}
                      className="user-select-none"
                      title="Forma aktarmak ve düzenlemek için çift tıklayın"
                    >
                      <td className="fw-bold font-monospace text-primary">{f.faturaNo || "-"}</td>
                      <td className="small">
                        {f.tarih ? new Date(f.tarih).toLocaleDateString("tr-TR") : "-"}
                      </td>
                      <td>
                        <Badge bg="light" text="dark" className="border">
                          {f.senaryo || "EARSIVFATURA"}
                        </Badge>
                      </td>
                      <td className="fw-bold">{f.aliciUnvan || "-"}</td>
                      <td className="font-monospace small">{f.aliciVknTckn || "-"}</td>
                      <td className="text-end font-monospace">
                        {(Number(f.araToplam) || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                      </td>
                      <td className="text-end font-monospace">
                        {(Number(f.toplamKdv) || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                      </td>
                      <td className="text-end fw-bold font-monospace text-success">
                        {(Number(f.genelToplam) || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                      </td>
                      <td className="text-center">
                        {f.eBelgeDurumu === 2 ? (
                          <Badge bg="success">GİB Onaylı</Badge>
                        ) : f.eBelgeDurumu === 1 ? (
                          <Badge bg="info">İletildi</Badge>
                        ) : (
                          <Badge bg="secondary">Taslak</Badge>
                        )}
                      </td>
                      <td className="text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="btn-group btn-group-sm">
                          <Button
                            variant="primary"
                            size="sm"
                            className="py-0 px-2 fw-semibold"
                            onClick={() => handleSelectInvoiceForEdit(f.faturaId)}
                            title="Forma Aktar ve Düzenle"
                          >
                            <IconEdit size={14} className="me-1" />
                            Aç
                          </Button>
                          <Button
                            variant="outline-primary"
                            size="sm"
                            className="py-0 px-2"
                            onClick={() => handleViewInvoiceDetail(f.faturaId)}
                            title="İncele ve Yazdır"
                          >
                            <IconPrinter size={14} className="me-1" />
                            Yazdır
                          </Button>
                          <Button
                            variant="outline-danger"
                            size="sm"
                            className="py-0 px-2"
                            onClick={() => handleDeleteInvoice(f.faturaId, f.faturaNo)}
                            title="Faturayı Sil ve Stoğa İade Et"
                          >
                            <IconX size={14} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        </Modal.Body>

        <Modal.Footer className="bg-light py-2 px-3 border-top">
          <Button variant="secondary" size="sm" onClick={() => setShowHistoryModal(false)}>
            Kapat
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Yeni Ürün / Para Tanımı Modalı */}
      {showNewProductModal && (
        <Modal
          show={showNewProductModal}
          onHide={() => setShowNewProductModal(false)}
          size="xl"
          centered
          backdrop="static"
          dialogClassName="modal-95w"
        >
          <Modal.Header closeButton className="py-2 px-3 bg-light">
            <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2">
              <IconCoins size={20} className="text-primary" />
              <span>Yeni Ürün / Para Tanımı</span>
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="p-3" style={{ maxHeight: "80vh", overflowY: "auto" }}>
            <ProductDefinitionsPage
              isModal={true}
              onSuccess={async () => {
                setShowNewProductModal(false);
                setShowProductLookup(false);
                setShowOdemeUrunModal(false);
                try {
                  await Promise.all([loadProductsForLookup(), loadOdemeUrunler()]);
                } catch (err) {
                  console.error("Ürün listesi yenilenirken hata:", err);
                }
              }}
              onCancel={() => setShowNewProductModal(false)}
            />
          </Modal.Body>
        </Modal>
      )}

      {/* Yeni Vezne / Kasa Tanımı Modalı */}
      {showNewVezneModal && (
        <Modal
          show={showNewVezneModal}
          onHide={() => setShowNewVezneModal(false)}
          size="xl"
          centered
          backdrop="static"
          dialogClassName="modal-95w"
        >
          <Modal.Header closeButton className="py-2 px-3 bg-light">
            <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2">
              <IconBuildingStore size={20} className="text-primary" />
              <span>Yeni Vezne / Kasa Tanımı</span>
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="p-3" style={{ maxHeight: "80vh", overflowY: "auto" }}>
            <CashDeskDefinitionsPage
              isModal={true}
              onSuccess={async (createdVezne) => {
                setShowNewVezneModal(false);
                setShowVezneModal(false);
                try {
                  const data = await CashDeskService.getVezneler();
                  if (data && data.length > 0) {
                    setVezneler(data);
                    if (createdVezne) {
                      const matched = data.find((v) => v.id === createdVezne.id || v.kod === createdVezne.kod);
                      if (matched) setSelectedVezne(matched);
                    }
                  }
                } catch (err) {
                  console.error("Vezne listesi yenilenirken hata:", err);
                }
              }}
              onCancel={() => setShowNewVezneModal(false)}
            />
          </Modal.Body>
        </Modal>
      )}

      {/* Yeni İskonto Tanımı Modalı */}
      {showNewIskontoModal && (
        <Modal
          show={showNewIskontoModal}
          onHide={() => setShowNewIskontoModal(false)}
          size="xl"
          centered
          backdrop="static"
          dialogClassName="modal-95w"
        >
          <Modal.Header closeButton className="py-2 px-3 bg-light">
            <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2">
              <IconPercentage size={20} className="text-primary" />
              <span>Yeni İskonto Tanımı</span>
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="p-3" style={{ maxHeight: "80vh", overflowY: "auto" }}>
            <IskontoDefinitionsPage
              isModal={true}
              onSuccess={async (createdIskonto) => {
                setShowNewIskontoModal(false);
                setShowIskontoModal(false);
                try {
                  const data = await IskontoService.getIskontolar({ aktif: true });
                  if (data) {
                    setIskontolar(data);
                    if (createdIskonto) {
                      const matched = data.find((i) => i.iskontoId === createdIskonto.iskontoId || i.kod === createdIskonto.kod);
                      if (matched) handleAddIskontoToOdeme(matched);
                    }
                  }
                } catch (err) {
                  console.error("İskonto listesi yenilenirken hata:", err);
                }
              }}
              onCancel={() => setShowNewIskontoModal(false)}
            />
          </Modal.Body>
        </Modal>
      )}

      {/* Ödeme / Tahsilat Farkı Onay Modalı */}
      <Modal
        show={showOdemeFarkConfirmModal.show}
        onHide={() => setShowOdemeFarkConfirmModal({ show: false, andPrint: false, rawDiffTL: 0 })}
        centered
        backdrop="static"
      >
        <Modal.Header closeButton className="bg-warning-subtle text-dark py-2">
          <Modal.Title style={{ fontSize: "15px", fontWeight: 700 }}>
            ⚠️ Dikkat / Uyarı: Ödeme Tutarı Uyarısı
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3">
          <div className="alert alert-warning mb-3 p-2.5" style={{ fontSize: "13px" }}>
            <div className="fw-bold mb-1">
              Fiş genel toplamı ({genelToplam.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺) ile ödeme / tahsilat tutarı ({totalOdemeTutar.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺) eşit değil!
            </div>
            <div className="mt-1">
              Aradaki <strong>{showOdemeFarkConfirmModal.rawDiffTL.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</strong> fark kapatılmadı.
            </div>
          </div>
          <p className="mb-0" style={{ fontSize: "13.5px" }}>
            Fişi bu haliyle <strong>yine de kaydetmek istiyor musunuz?</strong>
          </p>
        </Modal.Body>
        <Modal.Footer className="py-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowOdemeFarkConfirmModal({ show: false, andPrint: false, rawDiffTL: 0 })}
          >
            Vazgeç / Düzenle
          </Button>
          <Button
            variant="warning"
            size="sm"
            className="fw-bold text-dark"
            onClick={() => {
              const andPrint = showOdemeFarkConfirmModal.andPrint;
              setShowOdemeFarkConfirmModal({ show: false, andPrint: false, rawDiffTL: 0 });
              void handleCompleteSale(andPrint, true, true);
            }}
          >
            Yine de Kaydet
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default PerakendeFisiPage;
