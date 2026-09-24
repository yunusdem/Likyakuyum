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
} from "@tabler/icons-react";
import { ERPToolbar } from "../../components/common/ERPToolbar";
import { useEBankaFisKesimi } from "../ebanka/useEBankaFisKesimi";
import { LookupModal, LookupColumn } from "../../components/common/LookupModal";
import {
  CariKartItem,
  CariLookups,
  CariService,
} from "../../services/cariService";
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
import {
  PerakendeService,
  PerakendeFaturaModel,
  PerakendeFaturaListItem,
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
} from "./MusteriSecimModal";
import { PerakendeFisiPrintModal } from "./PerakendeFisiPrintModal";
import { SarrafFisService, UrunItem } from "../../services/sarrafFisService";
import { KurService } from "../../services/kurService";
import { MasakService, MasakEslesme } from "../../services/masakService";
import { MasakSonucModal } from "../../components/masak/MasakSonucModal";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

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
  paraId?: number;
  paraKodu: string;
  paraAdi: string;
  adet: number | string;
  miktar: number | string;
  milyem: number | string;
  hasGram: number | string;
  kur: number | string;
  tutar: number | string;
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
  paraKodu: "",
  paraAdi: "",
  adet: "",
  miktar: "",
  milyem: "",
  hasGram: "",
  kur: "",
  tutar: "",
});

const isRowEmpty = (row?: CartLineItem): boolean => {
  if (!row) return true;
  const hasBarkod = Boolean(row.barkod && String(row.barkod).trim());
  const hasUrunAdi = Boolean(row.urunAdi && String(row.urunAdi).trim());
  const hasGram = Boolean(row.gram !== "" && Number(row.gram) > 0);
  const hasHasGram = Boolean(row.hasGram !== "" && Number(row.hasGram) > 0);
  const hasBirimFiyat = Boolean(row.birimFiyat !== "" && Number(row.birimFiyat) > 0);
  const hasTutar = Boolean(row.tutar !== "" && Number(row.tutar) > 0);
  const hasKdvTutari = Boolean(row.kdvTutari !== "" && Number(row.kdvTutari) > 0);

  return !hasBarkod && !hasUrunAdi && !hasGram && !hasHasGram && !hasBirimFiyat && !hasTutar && !hasKdvTutari;
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
    if (raw.eFaturaKullanicisi === false) {
      return "EARSIVFATURA";
    }
    if (raw.eFaturaSenaryosu === "TICARIFATURA" || raw.ticariFatura) {
      return "TICARIFATURA";
    }
    return "TEMELFATURA";
  }

  // 5. 11 Haneli TCKN -> Şahıs / Gerçek Kişi
  if (digits.length === 11) {
    if (digits === "11111111111") {
      return "EARSIVFATURA";
    }
    if (raw.eFaturaKullanicisi || raw.eFaturaPostaKutusu) {
      return "TEMELFATURA";
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
  const [vezneler, setVezneler] = useState<VezneItem[]>([]);
  const [selectedVezne, setSelectedVezne] = useState<VezneItem | null>(null);
  const [faturaTipi, setFaturaTipi] = useState<number>(1); // 0: Alış, 1: Satış
  const [senaryo, setSenaryo] = useState<string>("EARSIVFATURA");

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

  // Cart & Grid State
  const [items, setItems] = useState<CartLineItem[]>([createEmptyRow()]);
  const [, setActiveRowIndex] = useState<number>(0);

  // Payment Rows State
  const [odemeRows, setOdemeRows] = useState<OdemeRow[]>([createEmptyOdemeRow(1)]);
  const [activeOdemeRowIndex, setActiveOdemeRowIndex] = useState<number>(0);
  const [activeOdemeRowIdForUrun, setActiveOdemeRowIdForUrun] = useState<string | null>(null);
  const [showOdemeUrunModal, setShowOdemeUrunModal] = useState<boolean>(false);
  const [odemeUrunList, setOdemeUrunList] = useState<UrunItem[]>(DEFAULT_ODEME_URUNLER);
  const [altinHasKuru, setAltinHasKuru] = useState<number>(3000);

  // Iskonto (TODVZ_ISKONTO)
  const [iskontolar, setIskontolar] = useState<IskontoItem[]>([]);
  const [selectedIskontoId, setSelectedIskontoId] = useState<number | null>(null);
  const [iskontoOrani, setIskontoOrani] = useState<number>(0);
  const [iskontoTutari, setIskontoTutari] = useState<number>(0);
  const [iskontoKodu, setIskontoKodu] = useState<string>("");
  const [iskontoSearchTerm, setIskontoSearchTerm] = useState<string>("");
  const [showIskontoModal, setShowIskontoModal] = useState<boolean>(false);

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

  // Modals State
  const [showVezneModal, setShowVezneModal] = useState<boolean>(false);
  const [showMusteriModal, setShowMusteriModal] = useState<boolean>(false);
  const [musteriSearchTerm, setMusteriSearchTerm] = useState<string>("");
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
    CashDeskService.getVezneler()
      .then(async (data) => {
        const list = data || [];
        setVezneler(list);
        if (list.length > 0) {
          const uv = await resolveUserVezne(list);
          if (uv) setSelectedVezne(uv);
        }
      })
      .catch(console.error);

    CariService.getCariKartlar()
      .then(setCariler)
      .catch(console.error);

    CariService.getLookups()
      .then(setCariLookups)
      .catch(console.error);

    DovizFisService.getKayitsizMusteriler()
      .then(setKayitsizMusteriler)
      .catch(console.error);

    SarrafFisService.getUrunler()
      .then((res) => {
        if (res && res.length > 0) {
          const defaultMap = new Map(DEFAULT_ODEME_URUNLER.map((d) => [d.kod.toUpperCase(), d]));
          // Veritabanındaki sıralamayı doğrudan koruyarak listeliyoruz:
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
      })
      .catch(console.error);

    IskontoService.getIskontolar({ aktif: true })
      .then((data) => {
        setIskontolar(data || []);
      })
      .catch(console.error);

    Promise.all([
      KurService.getKurTablosu({ tur: 0 }).catch(() => null),
      KurService.getKurTablosu({ tur: 1 }).catch(() => null),
    ]).then(([anlikRes, gunlukRes]) => {
      const mergedKurMap = new Map<string, any>();
      (gunlukRes?.satirlar || []).forEach((k) => {
        const cCode = (k.kod || "").toUpperCase().trim();
        if (cCode) mergedKurMap.set(cCode, k);
      });
      (anlikRes?.satirlar || []).forEach((k) => {
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
      const allKurList = Array.from(mergedKurMap.values());
      const hasKurItem = allKurList.find((k) => ["HAS", "ALTIN", "HAS ALTIN"].includes((k.kod || "").toUpperCase().trim()));
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
    const miktar = Number(line.miktar) || 0;
    const birimFiyat = Number(line.birimFiyat) || 0;
    const kdvOrani = Number(line.kdvOrani) || 0;
    const tutar = Math.round(miktar * birimFiyat * 100) / 100;
    const kdvTutari = Math.round(tutar * (kdvOrani / 100) * 100) / 100;
    const toplamTutar = Math.round((tutar + kdvTutari) * 100) / 100;

    return {
      id: line.id || makeId(),
      altinUrunId: line.altinUrunId ?? null,
      barkod: line.barkod || "",
      urunAdi: line.urunAdi || "",
      ayar: line.ayar || "14K",
      miktar: line.miktar === "" ? "" : miktar,
      birim: line.birim || "Adet",
      gram: line.gram === "" ? "" : (Number(line.gram) || 0),
      hasGram: line.hasGram === "" ? "" : (Number(line.hasGram) || 0),
      birimFiyat: line.birimFiyat === "" ? "" : birimFiyat,
      tutar: tutar > 0 ? tutar : (line.tutar === "" ? "" : 0),
      kdvOrani: line.kdvOrani === "" ? "" : kdvOrani,
      kdvTutari: kdvTutari > 0 ? kdvTutari : (line.kdvTutari === "" ? "" : 0),
      toplamTutar: toplamTutar > 0 ? toplamTutar : (line.toplamTutar === "" ? "" : 0),
    };
  };

  // Recompute single Payment Row
  const recomputeOdemeRow = (row: OdemeRow, hasKuru: number): OdemeRow => {
    const isTL = row.paraKodu === "TL" || row.paraKodu === "TRY";
    const isVeresiye =
      row.paraKodu === "VERESIYE" ||
      row.paraKodu === "ACIKHESAP" ||
      row.paraAdi?.toUpperCase().includes("VERESİYE") ||
      row.paraAdi?.toUpperCase().includes("AÇIK HESAP");

    const miktar = Number(row.miktar) || 0;
    const milyem = Number(row.milyem) || 0;
    const kur = Number(row.kur) || 0;

    let tutar = Number(row.tutar) || 0;
    let hasGram = Number(row.hasGram) || 0;

    if (isTL || isVeresiye) {
      if (miktar > 0) {
        tutar = kur > 0 ? miktar * kur : miktar;
      }
      hasGram = hasKuru > 0 && tutar > 0 ? tutar / hasKuru : 0;
    } else if (milyem > 0) {
      hasGram = miktar * (milyem / 1000);
      tutar = kur > 0 ? miktar * kur : (hasKuru > 0 ? hasGram * hasKuru : 0);
    } else {
      tutar = miktar * kur;
      hasGram = hasKuru > 0 ? tutar / hasKuru : 0;
    }

    return {
      ...row,
      hasGram: hasGram > 0 ? Number(hasGram.toFixed(4)) : (row.hasGram === "" ? "" : 0),
      tutar: tutar > 0 ? Number(tutar.toFixed(2)) : (row.tutar === "" ? "" : 0),
    };
  };

  // Add Product to Cart with automatic new empty row generation & focus
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

      let next: CartLineItem[];
      const newEmptyRow = createEmptyRow();
      if (emptyIdx >= 0) {
        next = [...prev];
        next[emptyIdx] = { ...populated, id: prev[emptyIdx].id };
        if (emptyIdx === prev.length - 1) {
          next.push(newEmptyRow);
          setActiveRowIndex(next.length - 1);
          setTimeout(() => focusGridCell(newEmptyRow.id, "barkod", "select"), 50);
        } else {
          setActiveRowIndex(emptyIdx + 1);
          setTimeout(() => focusGridCell(next[emptyIdx + 1].id, "barkod", "select"), 50);
        }
        return next;
      } else {
        next = [...prev, populated, newEmptyRow];
        setActiveRowIndex(next.length - 1);
        setTimeout(() => focusGridCell(newEmptyRow.id, "barkod", "select"), 50);
        return next;
      }
    });
  };

  // Product Selection from Dürbün (LookupModal)
  const handleSelectFromProductLookup = async (
    item: { tip: "altin" | "ozel"; item: AltinUrunItem | OzelUrunItem }
  ) => {
    const raw = item.item;
    const barcode = raw.barkod || `${raw.grupKodu}${raw.urunNo}`;
    const urunAdi =
      item.tip === "altin"
        ? (raw as AltinUrunItem).model || "Altın Takı / Ziynet"
        : (raw as OzelUrunItem).mamulTipi || "Özel Ürün";

    const hasGram = Number((raw as any).hasGram) || 0;
    const gram = Number((raw as any).gram) || (hasGram > 0 ? Number((hasGram * 1.05).toFixed(2)) : (Number(raw.miktar) || 1));

    setItems((prev) => {
      let targetIdx = prev.findIndex((r) => r.id === activeProductRowId);
      if (targetIdx === -1) {
        targetIdx = prev.findIndex(
          (r) => !r.barkod?.trim() && !r.urunAdi?.trim() && (!r.birimFiyat || Number(r.birimFiyat) === 0)
        );
      }
      if (targetIdx === -1) {
        targetIdx = prev.length - 1;
      }

      const existingRow = prev[targetIdx] || createEmptyRow();
      const populated = recalculateLine({
        ...existingRow,
        altinUrunId: (raw as any).altinUrunId ?? null,
        barkod: barcode,
        urunAdi,
        ayar: raw.ayar || "14K",
        miktar: raw.miktar || 1,
        birim: (raw as any).birim || "Adet",
        gram,
        hasGram,
        birimFiyat: Number(raw.satisFiyati) || 0,
        kdvOrani: 0,
      });

      const next = [...prev];
      next[targetIdx] = { ...populated, id: existingRow.id };

      // Satırlar dolunca sadece en altta boş satır yoksa 1 yeni boş satır ekle
      const lastItem = next[next.length - 1];
      if (!isRowEmpty(lastItem)) {
        const newEmptyRow = createEmptyRow();
        next.push(newEmptyRow);
        setActiveRowIndex(next.length - 1);
        setTimeout(() => focusGridCell(newEmptyRow.id, "barkod", "select"), 50);
      } else {
        const nextFocusIdx = targetIdx + 1 < next.length ? targetIdx + 1 : targetIdx;
        setActiveRowIndex(nextFocusIdx);
        setTimeout(() => focusGridCell(next[nextFocusIdx].id, "barkod", "select"), 50);
      }
      return next;
    });

    setShowProductLookup(false);
    setActiveProductRowId(null);
    setProductSearchTerm("");
  };

  // Combined Lookup Items for Product Search Modal
  const combinedLookupItems: { tip: "altin" | "ozel"; item: AltinUrunItem | OzelUrunItem }[] = [
    ...altinList.map((it) => ({ tip: "altin" as const, item: it })),
    ...ozelList.map((it) => ({ tip: "ozel" as const, item: it })),
  ];

  const productLookupColumns: LookupColumn<{ tip: "altin" | "ozel"; item: AltinUrunItem | OzelUrunItem }>[] = [
    {
      header: "Tip",
      width: "70px",
      align: "center",
      render: (it) => (
        <Badge bg={it.tip === "altin" ? "warning" : "info"} className="text-dark fw-bold">
          {it.tip === "altin" ? "Altın" : "Özel"}
        </Badge>
      ),
    },
    {
      header: "Barkod",
      width: "120px",
      render: (it) => (
        <span className="font-monospace fw-bold text-primary">{it.item.barkod || "-"}</span>
      ),
    },
    {
      header: "Açıklama / Model",
      render: (it) =>
        (it.tip === "altin"
          ? (it.item as AltinUrunItem).model
          : (it.item as OzelUrunItem).mamulTipi) || "-",
    },
    {
      header: "Ayar",
      width: "80px",
      align: "center",
      render: (it) => <Badge bg="light" text="dark" className="border">{it.item.ayar || "-"}</Badge>,
    },
    {
      header: "Gram",
      width: "90px",
      align: "right",
      render: (it) => (
        <span className="font-monospace">
          {it.tip === "altin" ? (it.item as AltinUrunItem).miktar || "-" : (it.item as OzelUrunItem).miktar || "-"}
        </span>
      ),
    },
    {
      header: "Fiyat",
      width: "110px",
      align: "right",
      render: (it) => (
        <strong className="text-success font-monospace">
          {Number(it.item.satisFiyati || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺
        </strong>
      ),
    },
  ];

  // Valid non-empty items
  const validItems = items.filter(
    (i) => (i.barkod && i.barkod.trim()) || (i.urunAdi && i.urunAdi.trim()) || Number(i.birimFiyat) > 0
  );

  // Grand totals calculation
  const totalQuantity = validItems.reduce((acc, i) => acc + (Number(i.miktar) || 0), 0);
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
  const totalOdemeAdet = odemeRows.reduce((s, r) => s + (Number(r.adet) || 0), 0);
  const totalOdemeMiktar = odemeRows.reduce((s, r) => s + (Number(r.miktar) || 0), 0);
  const totalOdemeHas = odemeRows.reduce((s, r) => s + (Number(r.hasGram) || 0), 0);
  const totalOdemeTutar = odemeRows.reduce((s, r) => s + (Number(r.tutar) || 0), 0);

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

  // Table Grid Cell Modification Handler
  const handleUpdateItem = (rowId: string, field: keyof CartLineItem, value: any) => {
    setItems((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const updated = { ...r, [field]: value };
        return recalculateLine(updated);
      })
    );
  };

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

                setItems((prev) => {
                  const next = prev.map((r, i) => (i === rowIndex ? populated : r));
                  const lastItem = next[next.length - 1];
                  if (!isRowEmpty(lastItem)) {
                    const newRow = createEmptyRow();
                    next.push(newRow);
                    setActiveRowIndex(next.length - 1);
                    setTimeout(() => focusGridCell(newRow.id, "barkod", "select"), 50);
                  } else {
                    const nextFocusIdx = rowIndex + 1 < next.length ? rowIndex + 1 : rowIndex;
                    setActiveRowIndex(nextFocusIdx);
                    setTimeout(() => focusGridCell(next[nextFocusIdx].id, "barkod", "select"), 50);
                  }
                  return next;
                });
              } else {
                setActiveProductRowId(rowId);
                setProductSearchTerm(val);
                setShowProductLookup(true);
              }
            })
            .catch(() => {
              setActiveProductRowId(rowId);
              setProductSearchTerm(val);
              setShowProductLookup(true);
            });
          return;
        } else {
          setActiveProductRowId(rowId);
          setProductSearchTerm("");
          setShowProductLookup(true);
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

      // Next column in same row
      if (colIdx + 1 < totalCols) {
        const nk = GRID_COLS[colIdx + 1];
        focusGridCell(rowId, nk, "select");
      } else {
        // Last column in row -> jump to next row or create a new row
        if (rowIndex < items.length - 1) {
          const nr = items[rowIndex + 1];
          setActiveRowIndex(rowIndex + 1);
          focusGridCell(nr.id, "barkod", "select");
        } else {
          const currentRow = items[rowIndex];
          if (isRowEmpty(currentRow)) {
            focusGridCell(currentRow.id, "barkod", "select");
            return;
          }

          const lastRow = items[items.length - 1];
          if (!isRowEmpty(lastRow)) {
            const newRow = createEmptyRow();
            setItems((prev) => [...prev, newRow]);
            setActiveRowIndex(rowIndex + 1);
            setTimeout(() => focusGridCell(newRow.id, "barkod", "select"), 30);
          } else {
            focusGridCell(lastRow.id, "barkod", "select");
          }
        }
      }
    } else if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault();
      if (colIdx > 0) {
        const pk = GRID_COLS[colIdx - 1];
        focusGridCell(rowId, pk, "select");
      } else if (rowIndex > 0) {
        const pr = items[rowIndex - 1];
        setActiveRowIndex(rowIndex - 1);
        focusGridCell(pr.id, GRID_COLS[totalCols - 1], "select");
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (rowIndex < items.length - 1) {
        const nr = items[rowIndex + 1];
        setActiveRowIndex(rowIndex + 1);
        focusGridCell(nr.id, colKey, "select");
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (rowIndex > 0) {
        const pr = items[rowIndex - 1];
        setActiveRowIndex(rowIndex - 1);
        focusGridCell(pr.id, colKey, "select");
      }
    } else if (e.key === "ArrowRight") {
      if (isAtEnd) {
        e.preventDefault();
        if (colIdx + 1 < totalCols) {
          focusGridCell(rowId, GRID_COLS[colIdx + 1], "select");
        }
      }
    } else if (e.key === "ArrowLeft") {
      if (isAtStart) {
        e.preventDefault();
        if (colIdx > 0) {
          focusGridCell(rowId, GRID_COLS[colIdx - 1], "select");
        }
      }
    } else if (e.key === "F4" || (e.key === "Enter" && colKey === "barkod" && !items[rowIndex]?.barkod)) {
      e.preventDefault();
      if (colKey === "barkod") {
        setActiveProductRowId(rowId);
        setProductSearchTerm((String(items[rowIndex]?.barkod) || "").trim());
        setShowProductLookup(true);
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
        }
        const updated = { ...r, [field]: sanitizedValue };
        return recomputeOdemeRow(updated, altinHasKuru);
      })
    );
  }, [altinHasKuru]);

  // Apply selected Currency / Product to Payment Row
  const applyProductToOdemeRow = useCallback((rowId: string, item: UrunItem) => {
    setOdemeRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const isTL = item.kod.toUpperCase() === "TL" || item.kod.toUpperCase() === "TRY";
        const isVeresiye = item.kod.toUpperCase() === "VERESIYE" || item.kod.toUpperCase() === "ACIKHESAP";

        // Alış / Satış milyem kontrolü:
        // Perakende Satış Fişinde (faturaTipi === 1): Müşteriden ödeme/tahsilat olarak altın alınıyor -> alisMilyem kullanılır
        // Perakende Alış Fişinde (faturaTipi === 0): Müşteriye ödeme olarak altın veriliyor -> satisMilyem kullanılır
        let milyemVal = "";
        const effAlis = Number(item.alisMilyem) > 0 ? Number(item.alisMilyem) : (Number(item.hasOrani) || 1000);
        const effSatis = Number(item.satisMilyem) > 0 ? Number(item.satisMilyem) : (Number(item.hasOrani) || 1000);
        if (item.urunTipi === 2 || (item.hasOrani && Number(item.hasOrani) > 0) || Number(item.alisMilyem) > 0 || Number(item.satisMilyem) > 0) {
          if (faturaTipi === 1) {
            milyemVal = String(effAlis);
          } else {
            milyemVal = String(effSatis);
          }
        }

        const kur = isTL || isVeresiye ? 1 : (item.urunTipi === 2 || Number(item.hasOrani) > 0 ? altinHasKuru : 1);
        let updated: OdemeRow = {
          ...r,
          paraId: item.paraId || item.id,
          paraKodu: item.kod,
          paraAdi: item.ad,
          adet: r.adet || (item.gramaj && Number(item.gramaj) > 0 ? 1 : ""),
          miktar: r.miktar || (item.gramaj && Number(item.gramaj) > 0 ? item.gramaj : ""),
          milyem: milyemVal,
          kur: kur > 0 ? kur : 1,
        };

        // Eğer veresiye seçildiyse ve kalan tutar varsa otomatik tutara ve miktara aktar
        if (isVeresiye) {
          const otherPaid = prev
            .filter((x) => x.id !== rowId)
            .reduce((acc, curr) => acc + (Number(curr.tutar) || 0), 0);
          const rem = Math.max(0, parseFloat((genelToplam - otherPaid).toFixed(2)));
          if (rem > 0) {
            updated.adet = 1;
            updated.miktar = rem;
            updated.kur = 1;
            updated.tutar = rem;
            updated.hasGram = altinHasKuru > 0 ? Number((rem / altinHasKuru).toFixed(4)) : "";
          } else {
            updated.adet = 1;
            updated.kur = 1;
          }
        }

        return recomputeOdemeRow(updated, altinHasKuru);
      })
    );
  }, [altinHasKuru, faturaTipi, genelToplam]);

  // Otomatik Kalan Tutarı Cari Karta Veresiye / Açık Hesap Yazma
  const handleAutoVeresiye = useCallback((amountToAdd?: number) => {
    const rawDiff = typeof amountToAdd === "number" ? amountToAdd : (genelToplam - odemeRows.reduce((s, r) => s + (Number(r.tutar) || 0), 0));
    const diff = Math.max(0, parseFloat(rawDiff.toFixed(2)));

    if (!cariKartId || aliciUnvan.trim() === "NİHAİ TÜKETİCİ") {
      showWarning("Veresiye / Açık Hesap yazabilmek için lütfen kayıtlı bir Müşteri / Cari seçiniz!");
      setMusteriSearchTerm(aliciUnvan !== "NİHAİ TÜKETİCİ" ? aliciUnvan : cariKod);
      setShowMusteriModal(true);
      return;
    }

    let targetRowId = "";
    setOdemeRows((prev) => {
      const existingIdx = prev.findIndex(
        (r) =>
          r.paraKodu?.trim().toUpperCase() === "VERESIYE" ||
          r.paraAdi?.toUpperCase().includes("VERESİYE") ||
          r.paraAdi?.toUpperCase().includes("AÇIK HESAP")
      );

      if (existingIdx >= 0) {
        const next = [...prev];
        targetRowId = next[existingIdx].id;
        const currentTutar = Number(next[existingIdx].tutar) || 0;
        const nextTutar = diff > 0 ? parseFloat((currentTutar + diff).toFixed(2)) : (Number(next[existingIdx].tutar) || 0);
        const calcHas = altinHasKuru > 0 && nextTutar > 0 ? Number((nextTutar / altinHasKuru).toFixed(4)) : (next[existingIdx].hasGram || "");
        next[existingIdx] = {
          ...next[existingIdx],
          adet: next[existingIdx].adet || 1,
          miktar: nextTutar > 0 ? nextTutar : (next[existingIdx].miktar || ""),
          kur: 1,
          tutar: nextTutar > 0 ? nextTutar : (next[existingIdx].tutar || ""),
          hasGram: calcHas,
        };
        return next;
      }

      const emptyIdx = prev.findIndex(
        (r) => !r.paraKodu && (!r.tutar || Number(r.tutar) === 0)
      );

      const nextTutar = diff > 0 ? diff : "";
      const calcHas = altinHasKuru > 0 && diff > 0 ? Number((diff / altinHasKuru).toFixed(4)) : "";

      if (emptyIdx >= 0) {
        const next = [...prev];
        targetRowId = next[emptyIdx].id;
        next[emptyIdx] = {
          ...next[emptyIdx],
          paraId: 99,
          paraKodu: "VERESIYE",
          paraAdi: "AÇIK HESAP / VERESİYE",
          adet: 1,
          miktar: nextTutar,
          milyem: "",
          kur: 1,
          tutar: nextTutar,
          hasGram: calcHas,
        };
        return next;
      }

      const newId = "odeme-" + (prev.length + 1);
      targetRowId = newId;
      const newRow: OdemeRow = {
        id: newId,
        paraId: 99,
        paraKodu: "VERESIYE",
        paraAdi: "AÇIK HESAP / VERESİYE",
        adet: 1,
        miktar: nextTutar,
        milyem: "",
        hasGram: calcHas,
        kur: 1,
        tutar: nextTutar,
      };
      return [...prev, newRow];
    });

    if (targetRowId) {
      setTimeout(() => focusOdemeGridCell(targetRowId, "tutar", "select"), 50);
    }
  }, [genelToplam, odemeRows, cariKartId, aliciUnvan, cariKod, altinHasKuru, showInfo, showWarning, showSuccess, focusOdemeGridCell]);

  // Keyboard navigation for Payment Grid
  const handleOdemeGridKeyDown = (
    e: React.KeyboardEvent<HTMLElement>,
    rowIndex: number,
    colKey: OdemeGridColKey,
    rowId: string
  ) => {
    const colIdx = ODEME_GRID_COLS.indexOf(colKey);
    const totalCols = ODEME_GRID_COLS.length;

    if (colKey === "paraKodu") {
      const typed = (String(odemeRows[rowIndex]?.paraKodu) || "").trim();
      if (e.key === "Enter" || e.key === "F4" || e.key === "F3") {
        e.preventDefault();
        const upper = typed.toUpperCase();
        if (upper === "VERESIYE" || upper === "VERESİYE" || upper === "ACIKHESAP" || upper === "AÇIK HESAP" || upper === "ACIK HESAP") {
          applyProductToOdemeRow(rowId, { id: 99, paraId: 99, kod: "VERESIYE", ad: "AÇIK HESAP / VERESİYE", urunTipi: 0, gramaj: 0, hasOrani: 0, alisMilyem: 0, satisMilyem: 0 });
          focusOdemeGridCell(rowId, "tutar", "select");
          return;
        }
        const match = odemeUrunList.find((u) => u.kod.trim().toLowerCase() === typed.toLowerCase());
        if (match) {
          applyProductToOdemeRow(rowId, match);
          focusOdemeGridCell(rowId, "adet", "select");
          return;
        }
        setOdemeSearchTerm(typed);
        openOdemeUrunModal(rowId);
        return;
      }
    }

    if (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) {
      e.preventDefault();
      if (colIdx + 1 < totalCols) {
        focusOdemeGridCell(rowId, ODEME_GRID_COLS[colIdx + 1], "select");
      } else {
        if (rowIndex < odemeRows.length - 1) {
          const nr = odemeRows[rowIndex + 1];
          setActiveOdemeRowIndex(rowIndex + 1);
          focusOdemeGridCell(nr.id, "paraKodu", "select");
        } else {
          const newRow = createEmptyOdemeRow(odemeRows.length + 1);
          setOdemeRows((prev) => [...prev, newRow]);
          setActiveOdemeRowIndex(odemeRows.length);
          setTimeout(() => focusOdemeGridCell(newRow.id, "paraKodu", "select"), 30);
        }
      }
    } else if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault();
      if (colIdx > 0) {
        focusOdemeGridCell(rowId, ODEME_GRID_COLS[colIdx - 1], "select");
      } else if (rowIndex > 0) {
        const pr = odemeRows[rowIndex - 1];
        setActiveOdemeRowIndex(rowIndex - 1);
        focusOdemeGridCell(pr.id, ODEME_GRID_COLS[totalCols - 1], "select");
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (rowIndex < odemeRows.length - 1) {
        const nr = odemeRows[rowIndex + 1];
        setActiveOdemeRowIndex(rowIndex + 1);
        focusOdemeGridCell(nr.id, colKey, "select");
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (rowIndex > 0) {
        const pr = odemeRows[rowIndex - 1];
        setActiveOdemeRowIndex(rowIndex - 1);
        focusOdemeGridCell(pr.id, colKey, "select");
      }
    }
  };

  const openOdemeUrunModal = (rowId: string) => {
    setActiveOdemeRowIdForUrun(rowId);
    setShowOdemeUrunModal(true);
  };

  // Insert Row at specific index (Items Table)
  const handleAddRow = useCallback((afterIndex?: number) => {
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
  }, []);

  // Insert Row at specific index (Payment Table)
  const handleAddOdemeRow = useCallback((afterIndex?: number) => {
    const newRow = createEmptyOdemeRow(odemeRows.length + 1);
    setOdemeRows((prev) => {
      if (typeof afterIndex === "number" && afterIndex >= 0) {
        const next = [...prev];
        next.splice(afterIndex + 1, 0, newRow);
        return next;
      }
      return [...prev, newRow];
    });

    setTimeout(() => {
      focusOdemeGridCell(newRow.id, "paraKodu", "select");
    }, 50);
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

  const handleCompleteSaleRef = useRef<((withPrint?: boolean, bypassMasakWarning?: boolean) => Promise<void>) | null>(null);

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
          handleCompleteSaleRef.current?.(pendingSaveWithPrint, true);
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
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
        handleCompleteSale(false);
      } else if (isF2) {
        e.preventDefault();
        if (isDuzeltmeMode && currentFaturaId) {
          handleDeleteCurrent();
        }
      } else if (isF3) {
        e.preventDefault();
        if (isDuzeltmeMode) {
          handleOpenHistory();
        }
      } else if (isF4) {
        e.preventDefault();
        setMusteriSearchTerm(aliciUnvan !== "NİHAİ TÜKETİCİ" ? aliciUnvan : cariKod);
        setShowMusteriModal(true);
      } else if (isF8) {
        e.preventDefault();
        openMusteriDetayModal();
      } else if (isF9 || isF10) {
        e.preventDefault();
        e.stopPropagation();
        handleCompleteSale(true);
      } else if (e.key === "Insert" && !isInput) {
        e.preventDefault();
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

  // Customer selection from Modal
  const handleSelectCustomer = async (res: SelectedCustomerResult) => {
    setAliciUnvan(res.unvan);
    const rawData = res.raw as any;
    const passportNo = rawData?.pasaportNo || "";
    const identVal = res.vergiKimlikNo || passportNo || "";
    setAliciVknTckn(identVal || "11111111111");
    setCariKod(res.kod || rawData?.kod || rawData?.cariKodu || "");
    setAdres(res.adres || "");
    setTelefon(res.telefon || "");

    const autoSenaryo = detectScenario(identVal, rawData, res.unvan);
    setSenaryo(autoSenaryo);

    let lookups = cariLookups;
    if (!lookups) {
      try {
        lookups = await CariService.getLookups();
        setCariLookups(lookups);
      } catch { }
    }

    if (res.type === "registered" && res.id) {
      setCariKartId(res.id);
      const raw = res.raw as any;
      if (raw) {
        const vdName =
          raw.vergiDairesi ||
          lookups?.vergiDairesiList?.find((x) => x.id === raw.vergiDairesiId)?.ad ||
          "";
        const ilName =
          raw.il ||
          lookups?.ilList?.find((x) => x.id === raw.ilId)?.ad ||
          "";
        const ilceName =
          raw.ilce ||
          lookups?.ilceList?.find((x) => x.id === raw.ilceId)?.ad ||
          "";

        setVergiDairesi(vdName);
        setIl(ilName);
        setIlce(ilceName);
        if (raw.adres) setAdres(raw.adres);
        if (raw.telefon) setTelefon(raw.telefon);
        if (raw.eposta) setEposta(raw.eposta);
      }
    } else if (res.type === "unregistered") {
      setCariKartId(null);
      const raw = res.raw as any;
      if (raw) {
        const vdName =
          raw.vergiDairesi ||
          lookups?.vergiDairesiList?.find((x) => x.id === raw.vergiDairesiId)?.ad ||
          "";
        const ilName =
          raw.il ||
          lookups?.ilList?.find((x) => x.id === raw.ilId)?.ad ||
          "";
        const ilceName =
          raw.ilce ||
          lookups?.ilceList?.find((x) => x.id === raw.ilceId)?.ad ||
          "";

        setVergiDairesi(vdName);
        setIl(ilName);
        setIlce(ilceName);
        if (raw.adres) setAdres(raw.adres);
        if (raw.telefon) setTelefon(raw.telefon);
        if (raw.eposta) setEposta(raw.eposta);
      }
    } else {
      setCariKartId(null);
      setVergiDairesi("");
      setIl("");
      setIlce("");
      setEposta("");
    }
    setShowMusteriModal(false);
    setMusteriSearchTerm("");

    // MASAK Kontrolü (1. Kontrol Noktası: Kişi Seçildiğinde / Sorgulandığında)
    if (res.unvan && res.unvan !== "NİHAİ TÜKETİCİ") {
      void handleMasakQuery(res.unvan, res.vergiKimlikNo);
    } else {
      setMasakResult({ matches: [], searched: false });
    }
  };

  // Complete Sale & Save Invoice
  const handleCompleteSale = async (withPrint: boolean = false, bypassMasakWarning: boolean = false) => {
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
    // Fiş toplamı ve ödeme tamamlanmadan (fark = 0 olmadan) kaydet çalışmaz
    const diffTL = Math.abs(genelToplam - totalOdemeTutar);
    const hasVeresiye = odemeRows.some(
      (r) =>
        r.paraKodu?.trim().toUpperCase() === "VERESIYE" ||
        r.paraAdi?.toUpperCase().includes("VERESİYE") ||
        r.paraAdi?.toUpperCase().includes("AÇIK HESAP")
    );

    if (diffTL > 0.05) {
      showWarning(
        `Fiş genel toplamı (${genelToplam.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺) ile ödeme / tahsilat tutarı (${totalOdemeTutar.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺) eşit değil! Aradaki ${diffTL.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺ farkı kapatınız veya "Kalanı Veresiye Yaz" butonunu kullanınız.`
      );
      return;
    }

    // Veresiye varsa Cari Kart zorunluluğu
    if (hasVeresiye && (!cariKartId || aliciUnvan.trim() === "NİHAİ TÜKETİCİ")) {
      showWarning("Veresiye / Açık hesap tutarı kaydedebilmek için lütfen kayıtlı bir Müşteri / Cari seçiniz!");
      setMusteriSearchTerm(aliciUnvan !== "NİHAİ TÜKETİCİ" ? aliciUnvan : cariKod);
      setShowMusteriModal(true);
      return;
    }

    // MASAK Kontrolü (2. Kontrol Noktası: Kaydederken limit aşıyorsa uyarır)
    const MASAK_LIMIT = 185000;
    if (genelToplam >= MASAK_LIMIT && !bypassMasakWarning) {
      const isMissingInfo =
        cleanVkn === "11111111111" ||
        aliciUnvan.trim().toUpperCase() === "NİHAİ TÜKETİCİ" ||
        !adres.trim();

      if (isMissingInfo) {
        setPendingSaveWithPrint(withPrint);
        setShowMasakLimitWarningModal(true);
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
        miktar: Number(item.miktar) || 1,
        birim: item.birim,
        gram: Number(item.gram) || 0,
        hasGram: Number(item.hasGram) || 0,
        birimFiyat: Number(item.birimFiyat) || 0,
        kdvOrani: Number(item.kdvOrani) || 0,
      }));

      const payloadOdemeler: SavePerakendeFaturaOdemePayload[] = odemeRows
        .filter((r) => r.paraKodu || Number(r.tutar) > 0)
        .map((r, idx) => ({
          satirNo: idx + 1,
          paraId: r.paraId ?? null,
          paraKodu: r.paraKodu || "TL",
          paraAdi: r.paraAdi || (r.paraKodu === "TL" ? "TÜRK LİRASI" : ""),
          adet: r.adet !== "" && r.adet !== null && r.adet !== undefined ? Number(r.adet) : null,
          miktar: r.miktar !== "" && r.miktar !== null && r.miktar !== undefined ? Number(r.miktar) : null,
          milyem: r.milyem !== "" && r.milyem !== null && r.milyem !== undefined ? Number(r.milyem) : null,
          hasGram: r.hasGram !== "" && r.hasGram !== null && r.hasGram !== undefined ? Number(r.hasGram) : null,
          kur: Number(r.kur) || 1,
          tutar: Number(r.tutar) || 0,
        }));

      const payload: SavePerakendeFaturaPayload = {
        faturaId: currentFaturaId,
        vezneId: selectedVezne?.id || 1,
        faturaNo: faturaNo.trim(),
        tarih: `${tarih}T${saat}:00`,
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
        setIsPendingDirectPrint(true);
        setPrintedFatura(result);
        setShowPrintModal(true);
      }

      if (isDuzeltmeMode) {
        showSuccess("Kayıt güncellendi");
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
        // Yazdırılacaksa yazdırma penceresi açık kalsın, yalnız eşlenir
        if (await ebFis.kaydedildi(result?.faturaId, !withPrint)) return;
        handleReset();
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
          const miktar = Number(s.miktar ?? s.MIKTAR) || 1;
          const birimFiyat = Number(s.birimFiyat ?? s.BIRIM_FIYAT) || 0;
          const tutar = Number(s.tutar ?? s.TUTAR) || Math.round(miktar * birimFiyat * 100) / 100;
          const kdvOrani = Number(s.kdvOrani ?? s.KDV_ORANI) || 0;
          const kdvTutari =
            Number(s.kdvTutari ?? s.KDV_TUTARI) ||
            Math.round(tutar * (kdvOrani / 100) * 100) / 100;
          const toplamTutar =
            Number(s.toplamTutar ?? s.TOPLAM_TUTAR ?? s.grandTotal) ||
            Math.round((tutar + kdvTutari) * 100) / 100;

          return {
            id: makeId(),
            altinUrunId: s.altinUrunId ?? s.ALTIN_URUN_ID ?? null,
            barkod: s.barkod || s.BARKOD || "",
            urunAdi: s.urunAdi || s.URUN_ADI || "Altın Ürün",
            ayar: s.ayar || s.AYAR || "14K",
            miktar,
            birim: s.birim || s.BIRIM || "Adet",
            gram: Number(s.gram ?? s.GRAM) || 0,
            hasGram: Number(s.hasGram ?? s.HAS_GRAM) || 0,
            birimFiyat,
            tutar,
            kdvOrani,
            kdvTutari,
            toplamTutar,
          };
        });
        setItems([...loadedItems, createEmptyRow()]);
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
            createEmptyRow(),
          ]);
        } else {
          setItems([createEmptyRow()]);
        }
      }

      // Ödeme Satırlarını Yükle (ODEMELER)
      const rawOdemeler: any[] = inv.odemeler || inv.ODEMELER || inv.odemeSatirlari || [];
      if (rawOdemeler && rawOdemeler.length > 0) {
        const loadedOdemeler: OdemeRow[] = rawOdemeler.map((o: any, idx: number) => ({
          id: makeId(),
          paraId: o.paraId ?? o.PARA_ID ?? null,
          paraKodu: (o.paraKodu || o.PARA_KODU || "TL").trim(),
          paraAdi: (o.paraAdi || o.PARA_ADI || "").trim(),
          adet: o.adet !== null && o.adet !== undefined && o.adet !== "" ? o.adet : (o.ADET !== null && o.ADET !== undefined ? o.ADET : ""),
          miktar: o.miktar !== null && o.miktar !== undefined && o.miktar !== "" ? o.miktar : (o.MIKTAR !== null && o.MIKTAR !== undefined ? o.MIKTAR : ""),
          milyem: o.milyem !== null && o.milyem !== undefined && o.milyem !== "" ? o.milyem : (o.MILYEM !== null && o.MILYEM !== undefined ? o.MILYEM : ""),
          hasGram: o.hasGram !== null && o.hasGram !== undefined && o.hasGram !== "" ? o.hasGram : (o.HAS_GRAM !== null && o.HAS_GRAM !== undefined ? o.HAS_GRAM : ""),
          kur: Number(o.kur ?? o.KUR) || 1,
          tutar: Number(o.tutar ?? o.TUTAR) || 0,
        }));
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
        setItems((prev) => [...prev, createEmptyRow()]);
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
  }, [handleDeleteRow, handleDeleteOdemeRow, handleKapatRow, odemeRows]);



  // Vezne Lookup Columns
  const vezneLookupColumns: LookupColumn<VezneItem>[] = [
    { header: "Kod", width: "100px", align: "center", render: (v) => <span className="fw-bold">{v.kod}</span> },
    { header: "Vezne Adı", render: (v) => <span>{v.ad}</span> },
  ];

  // Payment Product Lookup Columns
  const odemeLookupColumns: LookupColumn<UrunItem>[] = [
    { header: "Kod", width: "100px", render: (u) => <span className="fw-bold font-monospace text-primary">{u.kod}</span> },
    { header: "Para / Ürün Adı", render: (u) => <span>{u.ad}</span> },
    {
      header: "Tip",
      width: "95px",
      align: "center",
      render: (u) => (
        <Badge bg={u.kod === "VERESIYE" ? "danger" : u.urunTipi === 0 ? "secondary" : u.urunTipi === 1 ? "info" : "warning"} className={u.kod === "VERESIYE" ? "text-white" : "text-dark"}>
          {u.kod === "VERESIYE" ? "Açık Hesap" : u.urunTipi === 0 ? "Para / Nakit" : u.urunTipi === 1 ? "Döviz" : "Altın / Ziynet"}
        </Badge>
      ),
    },
    {
      header: "Alış Milyem",
      width: "90px",
      align: "right",
      render: (u) => (
        <span className="font-monospace fw-bold text-success">
          {u.alisMilyem ? `${u.alisMilyem} ‰` : (u.hasOrani ? `${u.hasOrani} ‰` : "-")}
        </span>
      ),
    },
    {
      header: "Satış Milyem",
      width: "90px",
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
      }}
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
                : senaryo === "TICARIFATURA"
                ? "Ticari Fatura"
                : senaryo === "YOLCUBERABERFATURA"
                ? "Yolcu Beraberi (Pasaport)"
                : senaryo === "IHRACAT"
                ? "İhracat"
                : senaryo === "KAMU"
                ? "Kamu Faturası"
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
          <div className="d-flex align-items-center gap-1">
            {isDuzeltmeMode && (
              <Button
                variant="outline-primary"
                size="sm"
                className="py-1 px-2 fw-semibold d-flex align-items-center gap-1"
                style={{ fontSize: "11px" }}
                onClick={() => navigate("/vezne/perakende-fisi-kayit")}
                title="Kayıt Sayfasına Git"
              >
                <IconPlus size={15} />
                <span>Kayıt Sayfası</span>
              </Button>
            )}
            <Button
              variant="outline-success"
              size="sm"
              className="py-1 px-2 fw-semibold d-flex align-items-center gap-1"
              style={{ fontSize: "11px" }}
              onClick={() => handleCompleteSale(true)}
              title="Kaydet & Yazdır (F10)"
              disabled={isSubmitting}
            >
              <IconPrinter size={15} />
              <span>Kaydet & Yazdır (F10)</span>
            </Button>
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

          {/* Tarih & Saat */}
          <div className="d-flex align-items-center gap-1">
            <span className="fw-bold text-secondary">TARİH</span>
            <input
              type="date"
              className="form-control form-control-sm bg-white"
              style={{ width: 120, fontSize: "12px" }}
              value={tarih}
              onChange={(e) => setTarih(e.target.value)}
            />
            <input
              type="time"
              className="form-control form-control-sm bg-white"
              style={{ width: 80, fontSize: "12px" }}
              value={saat}
              onChange={(e) => setSaat(e.target.value)}
            />
          </div>

          {/* Senaryo */}
          <div className="d-flex align-items-center gap-1">
            <span className="fw-bold text-secondary">SENARYO</span>
            <Form.Select
              size="sm"
              style={{ width: 165, fontSize: "12px", fontWeight: 600 }}
              value={senaryo}
              onChange={(e) => {
                const newSenaryo = e.target.value;
                setSenaryo(newSenaryo);
                if (faturaNo) {
                  let pfx = "EAR";
                  if (newSenaryo === "TEMELFATURA" || newSenaryo === "TICARIFATURA") pfx = "GIB";
                  else if (newSenaryo === "YOLCUBERABERFATURA") pfx = "TAX";
                  else if (newSenaryo === "IHRACAT") pfx = "IHR";
                  else if (newSenaryo === "KAMU") pfx = "KAM";
                  PerakendeService.getNextFaturaNo(pfx).then(setFaturaNo).catch(console.error);
                }
              }}
            >
              <option value="EARSIVFATURA">e-Arşiv Fatura</option>
              <option value="TEMELFATURA">Temel Fatura</option>
              <option value="TICARIFATURA">Ticari Fatura</option>
              <option value="YOLCUBERABERFATURA">Yolcu Beraberi (Pasaport)</option>
              <option value="IHRACAT">İhracat Faturası</option>
              <option value="KAMU">Kamu Faturası</option>
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
            onChange={(e) => setFaturaTipi(Number(e.target.value))}
          >
            <option value={0}>ALIŞ</option>
            <option value={1}>SATIŞ</option>
          </Form.Select>
        </div>
      </div>

      {/* ─── 3. Header Panel: Müşteri & Cari Bilgileri (2 Düzenli Satır) ─── */}
      <Card className="shadow-sm mb-2 border">
        <Card.Body className="p-2">
          {/* 1. Satır: TCKN / VKN / Pasaport | Cari Kodu | Müşteri Adı (+ Dürbün + Nihai Tüketici) */}
          <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
            {/* TCKN / VKN / Pasaport (+ Dürbün + MASAK Butonu) */}
            <div className="d-flex align-items-center gap-1" style={{ minWidth: "245px" }}>
              <label style={{ width: 75, minWidth: 75, fontSize: "12px", fontWeight: 600 }} className="mb-0 text-secondary">
                TCKN / VKN
              </label>
              <InputGroup size="sm" style={{ width: "175px" }}>
                <Form.Control
                  size="sm"
                  value={aliciVknTckn}
                  onChange={(e) => {
                    const rawVal = e.target.value;
                    setAliciVknTckn(rawVal);
                    const newSenaryo = detectScenario(rawVal, undefined, aliciUnvan);
                    setSenaryo(newSenaryo);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "F4") {
                      e.preventDefault();
                      setMusteriSearchTerm(aliciVknTckn && aliciVknTckn !== "11111111111" ? aliciVknTckn : "");
                      setShowMusteriModal(true);
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
                    setMusteriSearchTerm(aliciVknTckn && aliciVknTckn !== "11111111111" ? aliciVknTckn : "");
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
                  size="sm"
                  value={cariKod}
                  onChange={(e) => setCariKod(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      setMusteriSearchTerm(cariKod.trim());
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
                    setMusteriSearchTerm(cariKod.trim());
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
                      setMusteriSearchTerm(aliciUnvan && aliciUnvan !== "NİHAİ TÜKETİCİ" ? aliciUnvan.trim() : "");
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
                    setMusteriSearchTerm(aliciUnvan !== "NİHAİ TÜKETİCİ" ? aliciUnvan.trim() : cariKod.trim());
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

            {/* İskonto Bölümü */}
            <div className="d-flex align-items-center gap-1" style={{ minWidth: "250px", flex: "1 1 250px" }}>
              <label style={{ width: 50, minWidth: 50, fontSize: "12px", fontWeight: 600 }} className="mb-0 text-secondary">
                İskonto
              </label>
              <div className="d-flex flex-column" style={{ flex: 1 }}>
                <InputGroup size="sm">
                  <Form.Control
                    value={iskontoKodu}
                    onChange={(e) => {
                      const typed = e.target.value;
                      setIskontoKodu(typed);
                      const match = iskontolar.find(
                        (x) =>
                          (x.kod && x.kod.toLowerCase() === typed.trim().toLowerCase()) ||
                          (x.tanim && x.tanim.toLowerCase() === typed.trim().toLowerCase())
                      );
                      if (match) {
                        applySelectedIskonto(match);
                      } else if (!typed.trim()) {
                        applySelectedIskonto(null);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === "F4") {
                        e.preventDefault();
                        const trimmed = iskontoKodu.trim();
                        const match = iskontolar.find(
                          (x) =>
                            (x.kod && x.kod.toLowerCase() === trimmed.toLowerCase()) ||
                            (x.tanim && x.tanim.toLowerCase() === trimmed.toLowerCase())
                        );
                        if (match) {
                          applySelectedIskonto(match);
                        } else {
                          setIskontoSearchTerm(trimmed);
                          setShowIskontoModal(true);
                        }
                      }
                    }}
                    placeholder="İskonto Kodu..."
                    title={
                      selectedIskonto
                        ? `${selectedIskonto.tanim} (${
                            selectedIskonto.iskontoTipi === 1
                              ? `%${selectedIskonto.oran}`
                              : selectedIskonto.iskontoTipi === 2
                              ? `${selectedIskonto.tutar} ₺`
                              : `${selectedIskonto.hasTutar} Gr Has`
                          })`
                        : "İskonto kodu girip Enter'a basın veya Dürbün ile arayın"
                    }
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                    }}
                  />
                  {iskontoKodu && (
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      className="px-1.5 py-0 d-flex align-items-center text-muted"
                      onClick={() => applySelectedIskonto(null)}
                      title="İskontoyu Temizle"
                    >
                      <IconX size={12} />
                    </Button>
                  )}
                  <Button
                    variant="outline-secondary"
                    className="px-2 py-0 d-flex align-items-center"
                    onClick={() => {
                      setIskontoSearchTerm(iskontoKodu.trim());
                      setShowIskontoModal(true);
                    }}
                    title="İskonto Seç (F4 / Dürbün)"
                  >
                    <IconBinoculars size={13} />
                  </Button>
                </InputGroup>
                {selectedIskonto && (
                  <div
                    className="d-flex align-items-center justify-content-between px-1"
                    style={{ fontSize: "10px", lineHeight: "1.2", marginTop: "2px" }}
                  >
                    <span
                      className="text-success fw-bold text-truncate"
                      style={{ maxWidth: "150px" }}
                      title={selectedIskonto.tanim}
                    >
                      ✓ {selectedIskonto.tanim}
                    </span>
                    <span className="badge bg-success-subtle text-success border border-success-subtle">
                      {selectedIskonto.iskontoTipi === 1
                        ? `-%${selectedIskonto.oran}`
                        : selectedIskonto.iskontoTipi === 2
                        ? `-${selectedIskonto.tutar} ₺`
                        : selectedIskonto.iskontoTipi === 3
                        ? `-${selectedIskonto.hasTutar}g Has`
                        : "İskonto"}
                    </span>
                  </div>
                )}
              </div>
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

      {/* ─── 4. Satış Kalemleri Grid Tablosu (Tam Ekrana Sığar, Mobilde Kaydırılabilir) ─── */}
      <div
        className="table-responsive border rounded bg-white shadow-sm w-100 mb-2"
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
              <th style={{ width: "3%", minWidth: "28px" }}>#</th>
              <th style={{ width: "13%", minWidth: "130px" }}>Barkod</th>
              <th style={{ width: "23%", minWidth: "180px" }}>Ürün Açıklaması / Model</th>
              <th style={{ width: "7%", minWidth: "65px" }}>Ayar</th>
              <th style={{ width: "6%", minWidth: "55px" }}>Miktar</th>
              <th style={{ width: "6%", minWidth: "55px" }}>Birim</th>
              <th style={{ width: "8%", minWidth: "70px" }}>Gram</th>
              <th style={{ width: "8%", minWidth: "70px" }}>Has Gr</th>
              <th style={{ width: "10%", minWidth: "85px" }}>Birim Fiyat (₺)</th>
              <th style={{ width: "5%", minWidth: "45px" }}>KDV %</th>
              <th style={{ width: "7%", minWidth: "70px" }}>KDV (₺)</th>
              <th style={{ width: "9%", minWidth: "85px" }}>Satır Toplamı (₺)</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
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
                    <div className="input-group input-group-sm">
                      <input
                        ref={(el) => {
                          rowInputRefs.current[`${item.id}_barkod`] = el;
                        }}
                        type="text"
                        className="form-control form-control-sm font-monospace fw-bold text-primary p-1"
                        style={{ fontSize: "12px" }}
                        value={item.barkod}
                        onChange={(e) => handleUpdateItem(item.id, "barkod", e.target.value)}
                        onKeyDown={(e) => handleGridKeyDown(e, idx, "barkod", item.id)}
                        onFocus={() => setActiveRowIndex(idx)}
                        placeholder="Barkod Okut..."
                      />
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        className="px-1.5 py-0 d-flex align-items-center"
                        onClick={() => {
                          setActiveProductRowId(item.id);
                          setProductSearchTerm((String(item.barkod) || "").trim());
                          setShowProductLookup(true);
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
                      className="form-control form-control-sm p-1"
                      style={{ fontSize: "12px" }}
                      value={item.urunAdi}
                      onChange={(e) => handleUpdateItem(item.id, "urunAdi", e.target.value)}
                      onKeyDown={(e) => handleGridKeyDown(e, idx, "urunAdi", item.id)}
                      onFocus={() => setActiveRowIndex(idx)}
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
                        className="form-control form-control-sm text-center fw-bold p-1"
                        style={{ fontSize: "11.5px" }}
                        value={item.ayar}
                        onChange={(e) => handleUpdateItem(item.id, "ayar", e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "F4" || (e.key === "Enter" && !item.ayar)) {
                            e.preventDefault();
                            setActiveAyarRowId(item.id);
                            setShowAyarModal(true);
                            return;
                          }
                          handleGridKeyDown(e, idx, "ayar", item.id);
                        }}
                        onFocus={() => setActiveRowIndex(idx)}
                      />
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        className="px-1 py-0 d-flex align-items-center"
                        onClick={() => {
                          setActiveAyarRowId(item.id);
                          setShowAyarModal(true);
                        }}
                        title="Ayar Seç (F4)"
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
                      type="number"
                      min={1}
                      className="form-control form-control-sm text-center font-monospace p-1"
                      style={{ fontSize: "12px" }}
                      value={item.miktar}
                      onChange={(e) => handleUpdateItem(item.id, "miktar", e.target.value)}
                      onKeyDown={(e) => handleGridKeyDown(e, idx, "miktar", item.id)}
                      onFocus={() => setActiveRowIndex(idx)}
                    />
                  </td>

                  {/* Birim */}
                  <td style={{ padding: "2px 4px" }}>
                    <input
                      ref={(el) => {
                        rowInputRefs.current[`${item.id}_birim`] = el;
                      }}
                      type="text"
                      className="form-control form-control-sm text-center p-1"
                      style={{ fontSize: "11.5px" }}
                      value={item.birim}
                      onChange={(e) => handleUpdateItem(item.id, "birim", e.target.value)}
                      onKeyDown={(e) => handleGridKeyDown(e, idx, "birim", item.id)}
                      onFocus={() => setActiveRowIndex(idx)}
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
                      className="form-control form-control-sm text-end font-monospace p-1"
                      style={{ fontSize: "12px" }}
                      value={item.gram}
                      onChange={(e) => handleUpdateItem(item.id, "gram", e.target.value)}
                      onKeyDown={(e) => handleGridKeyDown(e, idx, "gram", item.id)}
                      onFocus={() => setActiveRowIndex(idx)}
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
                      className="form-control form-control-sm text-end font-monospace p-1"
                      style={{ fontSize: "12px" }}
                      value={item.hasGram}
                      onChange={(e) => handleUpdateItem(item.id, "hasGram", e.target.value)}
                      onKeyDown={(e) => handleGridKeyDown(e, idx, "hasGram", item.id)}
                      onFocus={() => setActiveRowIndex(idx)}
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
                      className="form-control form-control-sm text-end font-monospace fw-bold text-success p-1"
                      style={{ fontSize: "12px" }}
                      value={item.birimFiyat}
                      onChange={(e) => handleUpdateItem(item.id, "birimFiyat", e.target.value)}
                      onKeyDown={(e) => handleGridKeyDown(e, idx, "birimFiyat", item.id)}
                      onFocus={() => setActiveRowIndex(idx)}
                      placeholder="0.00"
                    />
                  </td>

                  {/* KDV % */}
                  <td style={{ padding: "2px 4px" }}>
                    <input
                      ref={(el) => {
                        rowInputRefs.current[`${item.id}_kdvOrani`] = el;
                      }}
                      type="number"
                      className="form-control form-control-sm text-center font-monospace p-1"
                      style={{ fontSize: "11.5px" }}
                      value={item.kdvOrani}
                      onChange={(e) => handleUpdateItem(item.id, "kdvOrani", e.target.value)}
                      onKeyDown={(e) => handleGridKeyDown(e, idx, "kdvOrani", item.id)}
                      onFocus={() => setActiveRowIndex(idx)}
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

      {/* ─── 5. Bottom Sections: ÖDEME TABLOSU (Solda) | TL/HAS Özet (Sağda) ─── */}
      <Row className="g-2 align-items-start mb-2">
        {/* SOLDA: Ödeme / Tahsilat Tablosu (Sarraf Fişi ile Birebir Aynı Tasarım) */}
        <Col xs={12} lg={8} md={7}>
          <div className="border rounded bg-white shadow-sm overflow-hidden">
            <div className="bg-light px-2 py-1 border-bottom d-flex justify-content-between align-items-center">
              <span className="fw-bold text-secondary" style={{ fontSize: "12px" }}>
                ÖDEME / TAHSİLAT TABLOSU
              </span>
              <Button
                variant="outline-danger"
                size="sm"
                className="py-0 px-2 fw-semibold d-flex align-items-center gap-1 shadow-2xs"
                style={{ fontSize: "11px", height: "22px" }}
                onClick={() => handleAutoVeresiye()}
                title="Cari Karta Veresiye / Açık Hesap Ekle"
              >
                <i className="bi bi-person-dash"></i>
                Veresiye Ekle
              </Button>
            </div>
            <div style={{ overflowX: "auto" }}>
              <Table bordered size="sm" hover className="mb-0 align-middle text-nowrap" style={{ fontSize: "11.5px", minWidth: 620 }}>
                <thead style={{ background: "#d9e8fb", color: "#000" }}>
                  <tr className="text-center align-middle">
                    <th style={{ width: 25 }} className="text-center">#</th>
                    <th style={{ width: 110 }}>Para</th>
                    <th style={{ width: 140 }}>Para adı</th>
                    <th style={{ width: 55 }}>Adet</th>
                    <th style={{ width: 75 }}>Miktar</th>
                    <th style={{ width: 70 }}>Milyem</th>
                    <th style={{ width: 85 }}>Has Gr</th>
                    <th style={{ width: 95 }}>Kur</th>
                    <th style={{ width: 110 }}>Tutar (TL)</th>
                  </tr>
                </thead>
                <tbody>
                  {odemeRows.map((oRow, rowIndex) => (
                    <tr
                      key={oRow.id}
                      data-row-id={oRow.id}
                      data-table-type="odeme"
                      style={rowIndex === activeOdemeRowIndex ? { background: "#edf5ff" } : {}}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        handleKapatRow(oRow.id);
                      }}
                      title="Sağ tık: Kalan bakiyeyi bu satır ile kapat"
                    >
                      <td className="text-muted text-center" style={{ padding: "2px", fontSize: "10px", verticalAlign: "middle" }}>
                        {rowIndex + 1}
                      </td>

                      {/* Para Kodu (+ Dürbün) */}
                      <td style={{ padding: "2px 4px" }}>
                        <InputGroup size="sm">
                          <Form.Control
                            ref={(el) => { odemeInputRefs.current[`${oRow.id}_paraKodu`] = el; }}
                            value={oRow.paraKodu}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateOdemeRow(oRow.id, "paraKodu", val);
                              const upper = val.trim().toUpperCase();
                              if (upper === "TL" || upper === "TRY") {
                                setOdemeRows((prev) => prev.map((r) => r.id === oRow.id ? { ...r, paraKodu: "TL", paraAdi: "TÜRK LİRASI", kur: 1, milyem: "" } : r));
                              } else if (upper === "VERESIYE" || upper === "VERESİYE" || upper === "ACIKHESAP" || upper === "AÇIK HESAP" || upper === "ACIK HESAP") {
                                applyProductToOdemeRow(oRow.id, { id: 99, paraId: 99, kod: "VERESIYE", ad: "AÇIK HESAP / VERESİYE", urunTipi: 0, gramaj: 0, hasOrani: 0, alisMilyem: 0, satisMilyem: 0 });
                              } else {
                                const match = odemeUrunList.find((u) => u.kod.trim().toLowerCase() === val.trim().toLowerCase());
                                if (match) {
                                  applyProductToOdemeRow(oRow.id, match);
                                }
                              }
                            }}
                            onDoubleClick={() => openOdemeUrunModal(oRow.id)}
                            onKeyDown={(e) => {
                              if (e.key === "F4" || e.key === "F3") {
                                e.preventDefault();
                                openOdemeUrunModal(oRow.id);
                                return;
                              }
                              handleOdemeGridKeyDown(e, rowIndex, "paraKodu", oRow.id);
                            }}
                            onFocus={() => setActiveOdemeRowIndex(rowIndex)}
                            style={{ fontSize: "11px", padding: "1px 4px", textTransform: "uppercase", fontWeight: 600 }}
                          />
                          <Button
                            type="button"
                            tabIndex={-1}
                            variant="outline-secondary"
                            className="px-1 py-0 d-flex align-items-center"
                            onClick={() => openOdemeUrunModal(oRow.id)}
                            title="Para / Ürün Seç (F3/F4)"
                          >
                            <IconBinoculars size={12} />
                          </Button>
                        </InputGroup>
                      </td>

                      {/* Para Adı */}
                      <td style={{ padding: "2px 4px" }}>
                        <Form.Control
                          size="sm"
                          value={oRow.paraAdi || (oRow.paraKodu === "TL" ? "TÜRK LİRASI" : "")}
                          readOnly
                          style={{ fontSize: "11px", padding: "1px 4px", background: "#f8f9fa" }}
                        />
                      </td>

                      {/* Adet */}
                      <td style={{ padding: "2px 4px" }}>
                        <Form.Control
                          ref={(el) => { odemeInputRefs.current[`${oRow.id}_adet`] = el; }}
                          inputMode="numeric"
                          size="sm"
                          className="text-end font-monospace"
                          value={oRow.adet || ""}
                          onChange={(e) => updateOdemeRow(oRow.id, "adet", e.target.value)}
                          onKeyDown={(e) => handleOdemeGridKeyDown(e, rowIndex, "adet", oRow.id)}
                          onFocus={() => setActiveOdemeRowIndex(rowIndex)}
                          style={{ fontSize: "11px", padding: "1px 4px" }}
                        />
                      </td>

                      {/* Miktar */}
                      <td style={{ padding: "2px 4px" }}>
                        <Form.Control
                          ref={(el) => { odemeInputRefs.current[`${oRow.id}_miktar`] = el; }}
                          inputMode="decimal"
                          size="sm"
                          className="text-end font-monospace fw-semibold"
                          value={oRow.miktar}
                          onChange={(e) => updateOdemeRow(oRow.id, "miktar", e.target.value)}
                          onKeyDown={(e) => handleOdemeGridKeyDown(e, rowIndex, "miktar", oRow.id)}
                          onFocus={() => setActiveOdemeRowIndex(rowIndex)}
                          style={{ fontSize: "11px", padding: "1px 4px" }}
                        />
                      </td>

                      {/* Milyem */}
                      <td style={{ padding: "2px 4px" }}>
                        <Form.Control
                          ref={(el) => { odemeInputRefs.current[`${oRow.id}_milyem`] = el; }}
                          inputMode="decimal"
                          size="sm"
                          className="text-end font-monospace"
                          value={oRow.milyem}
                          onChange={(e) => updateOdemeRow(oRow.id, "milyem", e.target.value)}
                          onKeyDown={(e) => handleOdemeGridKeyDown(e, rowIndex, "milyem", oRow.id)}
                          onFocus={() => setActiveOdemeRowIndex(rowIndex)}
                          style={{ fontSize: "11px", padding: "1px 4px" }}
                        />
                      </td>

                      {/* Has Gr */}
                      <td style={{ padding: "2px 4px" }}>
                        <Form.Control
                          ref={(el) => { odemeInputRefs.current[`${oRow.id}_hasGram`] = el; }}
                          inputMode="decimal"
                          size="sm"
                          className="text-end font-monospace"
                          value={oRow.hasGram}
                          onChange={(e) => updateOdemeRow(oRow.id, "hasGram", e.target.value)}
                          onKeyDown={(e) => handleOdemeGridKeyDown(e, rowIndex, "hasGram", oRow.id)}
                          onFocus={() => setActiveOdemeRowIndex(rowIndex)}
                          style={{ fontSize: "11px", padding: "1px 4px" }}
                        />
                      </td>

                      {/* Kur */}
                      <td style={{ padding: "2px 4px" }}>
                        <Form.Control
                          ref={(el) => { odemeInputRefs.current[`${oRow.id}_kur`] = el; }}
                          inputMode="decimal"
                          size="sm"
                          className="text-end font-monospace"
                          value={oRow.kur}
                          onChange={(e) => updateOdemeRow(oRow.id, "kur", e.target.value)}
                          onKeyDown={(e) => handleOdemeGridKeyDown(e, rowIndex, "kur", oRow.id)}
                          onFocus={() => setActiveOdemeRowIndex(rowIndex)}
                          style={{ fontSize: "11px", padding: "1px 4px" }}
                        />
                      </td>

                      {/* Tutar */}
                      <td style={{ padding: "2px 4px" }}>
                        <Form.Control
                          ref={(el) => { odemeInputRefs.current[`${oRow.id}_tutar`] = el; }}
                          inputMode="decimal"
                          size="sm"
                          className="text-end font-monospace fw-bold text-success"
                          value={oRow.tutar}
                          onChange={(e) => updateOdemeRow(oRow.id, "tutar", e.target.value)}
                          onKeyDown={(e) => handleOdemeGridKeyDown(e, rowIndex, "tutar", oRow.id)}
                          onFocus={() => setActiveOdemeRowIndex(rowIndex)}
                          style={{ fontSize: "11px", padding: "1px 4px" }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot style={{ background: "#f2f4f7", fontWeight: 600, fontSize: "11px" }}>
                  <tr>
                    <td colSpan={3} className="text-end small">Toplam</td>
                    <td style={{ textAlign: "right" }}>{totalOdemeAdet || ""}</td>
                    <td style={{ textAlign: "right" }}>{totalOdemeMiktar ? Number(totalOdemeMiktar).toFixed(3) : ""}</td>
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
                  <tr style={{ background: (Math.abs(farkTL) > 0.01 || Math.abs(farkHas) > 0.0001) ? "#fff5f5" : "#f8f9fa" }}>
                    <td className="fw-bold">Fark</td>
                    <td className="text-end fw-bold font-monospace" style={{ color: Math.abs(farkTL) > 0.01 ? "#dc3545" : "inherit" }}>
                      {farkTL.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺
                    </td>
                    <td className="text-end fw-bold font-monospace" style={{ color: Math.abs(farkHas) > 0.0001 ? "#dc3545" : "inherit" }}>
                      {farkHas.toFixed(4)}
                    </td>
                  </tr>
                  {farkTL > 0.01 && (
                    <tr>
                      <td colSpan={3} className="p-1.5 bg-light text-center">
                        <Button
                          variant="outline-warning"
                          size="sm"
                          className="w-100 py-1 fw-bold text-dark d-flex align-items-center justify-content-center gap-1 shadow-2xs"
                          style={{ fontSize: "11.5px", borderColor: "#f59e0b", backgroundColor: "#fffbeb" }}
                          onClick={() => handleAutoVeresiye()}
                          title="Kalan farkı Cari Karta Veresiye / Açık Hesap olarak aktar"
                        >
                          <IconReportMoney size={16} className="text-warning" />
                          <span>Kalanı Veresiye Yaz ({farkTL.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺)</span>
                        </Button>
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
            <strong className="text-dark">Kaydet & Yazdır</strong>
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
        title="İskonto Tanımı Seçiniz"
        items={iskontolar}
        columns={iskontoLookupColumns}
        initialSearchTerm={iskontoSearchTerm}
        selectedId={selectedIskontoId}
        filterFn={(it, term) => {
          const t = term.toLowerCase();
          return (
            (it.kod ? it.kod.toLowerCase().includes(t) : false) ||
            (it.tanim ? it.tanim.toLowerCase().includes(t) : false) ||
            (it.aciklama ? it.aciklama.toLowerCase().includes(t) : false)
          );
        }}
        onSelect={(selected) => {
          if (selected) {
            const minReq = Number(selected.minTutar) || 0;
            if (minReq > 0 && brutToplam < minReq) {
              showError(
                `Bu iskonto için minimum fiş tutarı ${minReq.toLocaleString("tr-TR")} ₺ olmalıdır.`
              );
              setShowIskontoModal(false);
              return;
            }
            applySelectedIskonto(selected);
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
        }}
        title="Barkodlu Ürün Seçimi"
        items={combinedLookupItems}
        isLoading={isProductLoading}
        columns={productLookupColumns}
        initialSearchTerm={productSearchTerm}
        filterFn={(it, term) => {
          const t = term.toLowerCase();
          const barkod = (it.item.barkod || `${it.item.grupKodu}${it.item.urunNo}`).toLowerCase();
          const model = (
            (it.tip === "altin"
              ? (it.item as AltinUrunItem).model
              : (it.item as OzelUrunItem).mamulTipi) || ""
          ).toLowerCase();
          const ayar = (it.item.ayar || "").toLowerCase();
          return barkod.includes(t) || model.includes(t) || ayar.includes(t);
        }}
        onSelect={handleSelectFromProductLookup}
      />

      {/* Ödeme / Para Ürün Seçim Modalı */}
      <LookupModal
        show={showOdemeUrunModal}
        onHide={() => {
          setShowOdemeUrunModal(false);
          setActiveOdemeRowIdForUrun(null);
          setOdemeSearchTerm("");
        }}
        title="Ödeme Para / Döviz / Altın Seçimi"
        items={odemeUrunList.filter((u) => {
          const k = (u.kod || "").toUpperCase().trim();
          return k !== "VERESIYE" && k !== "VERESİYE" && k !== "ACIKHESAP" && k !== "AÇIK HESAP";
        })}
        columns={odemeLookupColumns}
        initialSearchTerm={odemeSearchTerm}
        filterFn={(u, term) => {
          const t = term.toLowerCase();
          return (
            u.kod.toLowerCase().includes(t) ||
            u.ad.toLowerCase().includes(t)
          );
        }}
        onSelect={(selectedUrun) => {
          if (activeOdemeRowIdForUrun) {
            applyProductToOdemeRow(activeOdemeRowIdForUrun, selectedUrun);
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
        filterFn={(v, term) =>
          v.kod.toLowerCase().includes(term.toLowerCase()) ||
          v.ad.toLowerCase().includes(term.toLowerCase())
        }
        onSelect={(v) => {
          setSelectedVezne(v);
          setShowVezneModal(false);
        }}
      />

      {/* Müşteri / Cari Seçim Modalı (MusteriSecimModal) */}
      {showMusteriModal && (
        <MusteriSecimModal
          show={showMusteriModal}
          onClose={() => {
            setShowMusteriModal(false);
            setMusteriSearchTerm("");
          }}
          cariler={cariler}
          kayitsizMusteriler={kayitsizMusteriler}
          onSelectCustomer={handleSelectCustomer}
          currentUnvan={aliciUnvan}
          initialSearchTerm={musteriSearchTerm}
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
    </div>
  );
};

export default PerakendeFisiPage;
