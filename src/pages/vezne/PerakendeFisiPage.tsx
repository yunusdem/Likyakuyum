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
  { id: 1, paraId: 1, kod: "TL", ad: "TÜRK LİRASI", urunTipi: 0, gramaj: 0, hasOrani: 0 },
  { id: 2, paraId: 2, kod: "USD", ad: "AMERİKAN DOLARI", urunTipi: 1, gramaj: 0, hasOrani: 0 },
  { id: 3, paraId: 3, kod: "EUR", ad: "EURO", urunTipi: 1, gramaj: 0, hasOrani: 0 },
  { id: 4, paraId: 4, kod: "HAS", ad: "HAS ALTIN (24 AYAR)", urunTipi: 2, gramaj: 1, hasOrani: 1000 },
  { id: 5, paraId: 5, kod: "CEYREK", ad: "ÇEYREK ALTIN", urunTipi: 2, gramaj: 1.75, hasOrani: 916 },
  { id: 6, paraId: 6, kod: "YARIM", ad: "YARIM ALTIN", urunTipi: 2, gramaj: 3.5, hasOrani: 916 },
  { id: 7, paraId: 7, kod: "TAM", ad: "TAM ALTIN", urunTipi: 2, gramaj: 7.0, hasOrani: 916 },
  { id: 8, paraId: 8, kod: "ATA", ad: "ATA LİRA", urunTipi: 2, gramaj: 7.216, hasOrani: 916 },
  { id: 9, paraId: 9, kod: "POS", ad: "KREDİ KARTI / POS", urunTipi: 0, gramaj: 0, hasOrani: 0 },
  { id: 10, paraId: 10, kod: "HAVALE", ad: "HAVALE / EFT", urunTipi: 0, gramaj: 0, hasOrani: 0 },
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
  paraKodu: "TL",
  paraAdi: "TÜRK LİRASI",
  adet: "",
  miktar: "",
  milyem: "",
  hasGram: "",
  kur: 1,
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
  const [showIskontoModal, setShowIskontoModal] = useState<boolean>(false);

  // Refs for grid keyboard navigation
  const rowInputRefs = useRef<Record<string, HTMLElement | null>>({});
  const odemeInputRefs = useRef<Record<string, HTMLElement | null>>({});

  // Submitting State & Mutex Ref
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const isSubmittingRef = useRef<boolean>(false);

  // Modals State
  const [showVezneModal, setShowVezneModal] = useState<boolean>(false);
  const [showMusteriModal, setShowMusteriModal] = useState<boolean>(false);
  const [showProductLookup, setShowProductLookup] = useState<boolean>(false);
  const [showAyarModal, setShowAyarModal] = useState<boolean>(false);
  const [activeAyarRowId, setActiveAyarRowId] = useState<string | null>(null);
  const [cariler, setCariler] = useState<CariKartItem[]>([]);
  const [cariLookups, setCariLookups] = useState<CariLookups | null>(null);
  const [kayitsizMusteriler, setKayitsizMusteriler] = useState<KayitsizMusteriItem[]>([]);
  const [altinList, setAltinList] = useState<AltinUrunItem[]>([]);
  const [ozelList, setOzelList] = useState<OzelUrunItem[]>([]);
  const [isProductLoading, setIsProductLoading] = useState<boolean>(false);

  // Print Preview Modal
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
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
          setOdemeUrunList(res);
        }
      })
      .catch(console.error);

    IskontoService.getIskontolar({ aktif: true })
      .then((data) => {
        setIskontolar(data || []);
      })
      .catch(console.error);

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
    const miktar = Number(row.miktar) || 0;
    const milyem = Number(row.milyem) || 0;
    const kur = Number(row.kur) || 0;

    let tutar = Number(row.tutar) || 0;
    let hasGram = Number(row.hasGram) || 0;

    if (row.paraKodu === "TL" || row.paraKodu === "TRY") {
      tutar = miktar;
      hasGram = hasKuru > 0 ? miktar / hasKuru : 0;
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

    addProductToCart({
      altinUrunId: (raw as any).altinUrunId ?? null,
      barkod: barcode,
      urunAdi,
      ayar: raw.ayar || "14K",
      miktar: raw.miktar || 1,
      birim: (raw as any).birim || "Adet",
      gram,
      hasGram,
      satisFiyati: Number(raw.satisFiyati) || 0,
      kdvOrani: 0,
    });

    setShowProductLookup(false);
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

      // If user typed a barcode in the barcode cell and pressed enter, resolve it
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
                  if (rowIndex === prev.length - 1) {
                    const newRow = createEmptyRow();
                    next.push(newRow);
                    setActiveRowIndex(next.length - 1);
                    setTimeout(() => focusGridCell(newRow.id, "barkod", "select"), 50);
                  } else {
                    setActiveRowIndex(rowIndex + 1);
                    setTimeout(() => focusGridCell(next[rowIndex + 1].id, "barkod", "select"), 50);
                  }
                  return next;
                });
              }
            })
            .catch(() => {
              setShowProductLookup(true);
            });
          return;
        } else {
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

          const newRow = createEmptyRow();
          setItems((prev) => [...prev, newRow]);
          setActiveRowIndex(rowIndex + 1);
          setTimeout(() => focusGridCell(newRow.id, "barkod", "select"), 30);
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
        const milyem = item.hasOrani ? item.hasOrani : (item.urunTipi === 2 ? 1000 : "");
        const kur = isTL ? 1 : (item.urunTipi === 2 ? altinHasKuru : 1);
        const updated: OdemeRow = {
          ...r,
          paraId: item.paraId || item.id,
          paraKodu: item.kod,
          paraAdi: item.ad,
          milyem: milyem ? String(milyem) : "",
          kur: kur > 0 ? kur : 1,
        };
        return recomputeOdemeRow(updated, altinHasKuru);
      })
    );
  }, [altinHasKuru]);

  // Keyboard navigation for Payment Grid
  const handleOdemeGridKeyDown = (
    e: React.KeyboardEvent<HTMLElement>,
    rowIndex: number,
    colKey: OdemeGridColKey,
    rowId: string
  ) => {
    const colIdx = ODEME_GRID_COLS.indexOf(colKey);
    const totalCols = ODEME_GRID_COLS.length;

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

  // Sağ tık ERP Menüsü Olayları (Satırı Sil & Satır Ekle)
  useEffect(() => {
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

    window.addEventListener("erp-grid-row-delete", handleGridDelete);
    window.addEventListener("erp-grid-row-add", handleGridAdd);
    return () => {
      window.removeEventListener("erp-grid-row-delete", handleGridDelete);
      window.removeEventListener("erp-grid-row-add", handleGridAdd);
    };
  }, [handleDeleteRow, handleDeleteOdemeRow, odemeRows]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      const isInput =
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.tagName === "SELECT");

      if (e.key === "F1") {
        e.preventDefault();
        handleCompleteSale(false);
      } else if (e.key === "F2") {
        e.preventDefault();
        if (isDuzeltmeMode && currentFaturaId) {
          handleDeleteCurrent();
        }
      } else if (e.key === "F3") {
        e.preventDefault();
        if (isDuzeltmeMode) {
          handleOpenHistory();
        }
      } else if (e.key === "F4") {
        e.preventDefault();
        setShowMusteriModal(true);
      } else if (e.key === "F9") {
        e.preventDefault();
        handleCompleteSale(true);
      } else if (e.key === "Insert" && !isInput) {
        e.preventDefault();
        handleAddRow();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
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

    if (vezneler.length > 0) {
      const uv = await resolveUserVezne(vezneler);
      if (uv) setSelectedVezne(uv);
    }

    showInfo("Yeni satış formu hazırlandı");
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
  };

  // Customer selection from Modal
  const handleSelectCustomer = async (res: SelectedCustomerResult) => {
    setAliciUnvan(res.unvan);
    setAliciVknTckn(res.vergiKimlikNo || "11111111111");
    setCariKod(res.kod || (res.raw as any)?.kod || (res.raw as any)?.cariKodu || "");
    setAdres(res.adres || "");
    setTelefon(res.telefon || "");

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
  };

  // Valid non-empty items
  const validItems = items.filter(
    (i) => (i.barkod && i.barkod.trim()) || (i.urunAdi && i.urunAdi.trim()) || Number(i.birimFiyat) > 0
  );

  // Complete Sale & Save Invoice
  const handleCompleteSale = async (withPrint: boolean = false) => {
    if (isSubmittingRef.current) return;

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
      };

      const result = await PerakendeService.createInvoice(payload);

      if (withPrint) {
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

  // Grand totals calculation
  const totalQuantity = validItems.reduce((acc, i) => acc + (Number(i.miktar) || 0), 0);
  const totalGrams = validItems.reduce((acc, i) => acc + (Number(i.gram) || 0), 0);
  const totalHasGrams = validItems.reduce((acc, i) => acc + (Number(i.hasGram) || 0), 0);
  const araToplam = validItems.reduce((acc, i) => acc + (Number(i.tutar) || 0), 0);
  const toplamKdv = validItems.reduce((acc, i) => acc + (Number(i.kdvTutari) || 0), 0);
  const brutToplam = araToplam + toplamKdv;

  // Selected iskonto calculation & limits
  const selectedIskonto = iskontolar.find((x) => x.iskontoId === selectedIskontoId) || null;

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
  } else if (iskontoTutari > 0) {
    // Loaded from existing invoice
    calculatedIskontoTutari = Math.min(brutToplam, Number(iskontoTutari) || 0);
    calculatedIskontoOrani =
      Number(iskontoOrani) ||
      (brutToplam > 0 ? Math.round((calculatedIskontoTutari / brutToplam) * 10000) / 100 : 0);
  }

  const genelToplam = Math.max(0, Math.round((brutToplam - calculatedIskontoTutari) * 100) / 100);


  // Payment totals calculation
  const totalOdemeAdet = odemeRows.reduce((s, r) => s + (Number(r.adet) || 0), 0);
  const totalOdemeMiktar = odemeRows.reduce((s, r) => s + (Number(r.miktar) || 0), 0);
  const totalOdemeHas = odemeRows.reduce((s, r) => s + (Number(r.hasGram) || 0), 0);
  const totalOdemeTutar = odemeRows.reduce((s, r) => s + (Number(r.tutar) || 0), 0);

  const farkTL = genelToplam - totalOdemeTutar;
  const farkHas = totalHasGrams - totalOdemeHas;

  // Auto-sync single payment row to genelToplam and totalHasGrams so Fark = 0 and payment table is automatically filled
  useEffect(() => {
    setOdemeRows((prev) => {
      if (prev.length === 1) {
        const first = prev[0];
        if (first.paraKodu === "TL" || !first.paraKodu) {
          const tutarVal = genelToplam > 0 ? parseFloat(genelToplam.toFixed(2)) : "";
          const hasKuruNum = Number(altinHasKuru) || 0;
          const hasVal =
            hasKuruNum > 0 && Number(tutarVal) > 0
              ? parseFloat((Number(tutarVal) / hasKuruNum).toFixed(4))
              : (totalHasGrams > 0 ? parseFloat(totalHasGrams.toFixed(4)) : "");
          const adetVal = genelToplam > 0 ? 1 : "";

          if (
            first.tutar !== tutarVal ||
            first.miktar !== tutarVal ||
            first.hasGram !== hasVal ||
            first.adet !== adetVal ||
            first.kur !== 1 ||
            first.paraAdi !== "TÜRK LİRASI"
          ) {
            return [
              {
                ...first,
                paraKodu: "TL",
                paraAdi: "TÜRK LİRASI",
                adet: adetVal,
                miktar: tutarVal,
                kur: 1,
                hasGram: hasVal,
                tutar: tutarVal,
              },
            ];
          }
        }
      }
      return prev;
    });
  }, [genelToplam, totalHasGrams, altinHasKuru]);

  // Vezne Lookup Columns
  const vezneLookupColumns: LookupColumn<VezneItem>[] = [
    { header: "Kod", width: "100px", align: "center", render: (v) => <span className="fw-bold">{v.kod}</span> },
    { header: "Vezne Adı", render: (v) => <span>{v.ad}</span> },
  ];

  // Payment Product Lookup Columns
  const odemeLookupColumns: LookupColumn<UrunItem>[] = [
    { header: "Kod", width: "110px", render: (u) => <span className="fw-bold font-monospace text-primary">{u.kod}</span> },
    { header: "Para / Ürün Adı", render: (u) => <span>{u.ad}</span> },
    {
      header: "Tip",
      width: "100px",
      align: "center",
      render: (u) => (
        <Badge bg={u.urunTipi === 0 ? "secondary" : u.urunTipi === 1 ? "info" : "warning"} className="text-dark">
          {u.urunTipi === 0 ? "Para / Nakit" : u.urunTipi === 1 ? "Döviz" : "Altın / Ziynet"}
        </Badge>
      ),
    },
    {
      header: "Milyem / Has",
      width: "110px",
      align: "right",
      render: (u) => <span className="font-monospace">{u.hasOrani ? `${u.hasOrani} ‰` : "-"}</span>,
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
      style={{ fontFamily: "'Segoe UI', sans-serif", fontSize: "12.5px" }}
    >
      {ebFis.bant}
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
              {senaryo === "EARSIVFATURA" ? "e-Arşiv" : "e-Fatura"}
            </Badge>
          </span>
        }
        pageIcon={<IconBarcode size={20} />}
        onNew={handleNew}
        onSave={() => handleCompleteSale(false)}
        onPrint={() => handleCompleteSale(true)}
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
              title="Kaydet & Yazdır (F9)"
              disabled={isSubmitting}
            >
              <IconPrinter size={15} />
              <span>Kaydet & Yazdır (F9)</span>
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
            <div className="input-group input-group-sm" style={{ width: 175 }}>
              <input
                type="text"
                className="form-control form-control-sm font-monospace fw-bold text-primary bg-white"
                value={faturaNo}
                onChange={(e) => setFaturaNo(e.target.value)}
                placeholder="Otomatik (Numaratör)"
                style={{ fontSize: "11.5px" }}
              />
              <Button
                size="sm"
                variant="outline-secondary"
                className="px-2 py-0 d-flex align-items-center"
                onClick={loadNextNo}
                title="Numaratörden Sıradaki Numarayı Çek"
              >
                <IconRefresh size={13} />
              </Button>
            </div>
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
              style={{ width: 135, fontSize: "12px" }}
              value={senaryo}
              onChange={(e) => {
                const newSenaryo = e.target.value;
                setSenaryo(newSenaryo);
                if (faturaNo) {
                  const pfx = newSenaryo === "EARSIVFATURA" ? "EAR" : "GIB";
                  PerakendeService.getNextFaturaNo(pfx).then(setFaturaNo).catch(console.error);
                }
              }}
            >
              <option value="EARSIVFATURA">e-Arşiv Fatura</option>
              <option value="TEMELFATURA">Temel Fatura</option>
              <option value="TICARIFATURA">Ticari Fatura</option>
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
          {/* 1. Satır: TCKN / VKN | Cari Kodu | Müşteri Adı (+ Dürbün + Nihai Tüketici) */}
          <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
            {/* TCKN / VKN */}
            <div className="d-flex align-items-center gap-1" style={{ minWidth: "210px" }}>
              <label style={{ width: 75, minWidth: 75, fontSize: "12px", fontWeight: 600 }} className="mb-0 text-secondary">
                TCKN / VKN
              </label>
              <Form.Control
                size="sm"
                maxLength={11}
                value={aliciVknTckn}
                onChange={(e) => setAliciVknTckn(e.target.value.replace(/\D/g, ""))}
                style={{ fontSize: "12px", fontFamily: "monospace", fontWeight: 600, width: "135px" }}
              />
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
                  style={{ fontSize: "12px", fontFamily: "monospace", fontWeight: 600 }}
                />
                <Button
                  variant="outline-secondary"
                  className="px-1.5 py-0 d-flex align-items-center"
                  onClick={() => setShowMusteriModal(true)}
                  title="Cari Seç"
                >
                  <IconBinoculars size={13} />
                </Button>
              </InputGroup>
            </div>

            {/* Müşteri Adı (+ Dürbün + Nihai Tüketici Butonu) */}
            <div className="d-flex align-items-center gap-1" style={{ minWidth: "260px", width: "340px", flex: "1.2 1 280px" }}>
              <label style={{ width: 75, minWidth: 75, fontSize: "12px", fontWeight: 600 }} className="mb-0 text-secondary">
                Müşteri Adı
              </label>
              <InputGroup size="sm" style={{ flex: 1 }}>
                <Form.Control
                  value={aliciUnvan}
                  onChange={(e) => {
                    setAliciUnvan(e.target.value);
                    if (cariKartId) setCariKartId(null);
                  }}
                  style={{ fontSize: "12px", fontWeight: 600 }}
                />
                <Button
                  variant="outline-secondary"
                  className="px-1.5 py-0 d-flex align-items-center"
                  onClick={() => setShowMusteriModal(true)}
                  title="Cari / Müşteri Seç (F4)"
                >
                  <IconBinoculars size={13} />
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

            {/* İskonto Bölümü (Müşteri Adı'nın Sağında - Doğrudan Dürbün ile Seçim) */}
            <div className="d-flex align-items-center gap-1" style={{ minWidth: "240px", width: "290px", flex: "1 1 240px" }}>
              <label style={{ width: 50, minWidth: 50, fontSize: "12px", fontWeight: 600 }} className="mb-0 text-secondary">
                İskonto
              </label>
              <InputGroup size="sm" style={{ flex: 1 }}>
                <Form.Control
                  readOnly
                  value={
                    selectedIskonto
                      ? `${selectedIskonto.kod ? `[${selectedIskonto.kod}] ` : ""}${selectedIskonto.tanim}`
                      : (iskontoKodu ? `[${iskontoKodu}]` : "")
                  }
                  onClick={() => setShowIskontoModal(true)}
                  style={{
                    fontSize: "12px",
                    cursor: "pointer",
                    backgroundColor: "#fff",
                    fontWeight: selectedIskonto || iskontoKodu ? 600 : "normal",
                  }}
                  title="İskonto Seçmek İçin Tıklayın (Dürbün)"
                />
                <Button
                  variant="outline-secondary"
                  className="px-2 py-0 d-flex align-items-center"
                  onClick={() => setShowIskontoModal(true)}
                  title="İskonto Seç (Dürbün)"
                >
                  <IconBinoculars size={13} />
                </Button>
              </InputGroup>
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
            <div className="bg-light px-2 py-1 border-bottom d-flex align-items-center justify-content-between">
              <span className="fw-bold text-secondary" style={{ fontSize: "12px" }}>
                ÖDEME / TAHSİLAT TABLOSU
              </span>
              <Button
                variant="outline-primary"
                size="sm"
                className="py-0 px-2 d-flex align-items-center gap-1"
                style={{ fontSize: "11px" }}
                onClick={() => {
                  const newRow = createEmptyOdemeRow(odemeRows.length + 1);
                  setOdemeRows((prev) => [...prev, newRow]);
                  setActiveOdemeRowIndex(odemeRows.length);
                  setTimeout(() => focusOdemeGridCell(newRow.id, "paraKodu", "select"), 30);
                }}
              >
                <IconPlus size={13} />
                <span>Ödeme Satırı Ekle</span>
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
                              if (val.trim().toUpperCase() === "TL" || val.trim().toUpperCase() === "TRY") {
                                setOdemeRows((prev) => prev.map((r) => r.id === oRow.id ? { ...r, paraKodu: "TL", paraAdi: "TÜRK LİRASI", kur: 1, milyem: "" } : r));
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
                    İskonto {iskontoKodu ? `(${iskontoKodu})` : ""} {calculatedIskontoOrani > 0 ? `(%${calculatedIskontoOrani})` : ""}:
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
          <span className="text-secondary">•</span>
          <span>
            <kbd className="bg-secondary text-white px-1.5 py-0.5 rounded me-1 fw-bold">F4</kbd>
            <strong className="text-dark">Müşteri Seç</strong>
          </span>
          <span className="text-secondary">•</span>
          <span>
            <kbd className="bg-success text-white px-1.5 py-0.5 rounded me-1 fw-bold">F9</kbd>
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
        onHide={() => setShowIskontoModal(false)}
        title="İskonto Tanımı Seçiniz"
        items={iskontolar}
        columns={iskontoLookupColumns}
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
              // Fiş tutarı minimumu karşılamıyorsa hata popup'ı verme, seçme
              setShowIskontoModal(false);
              return;
            }
            setSelectedIskontoId(selected.iskontoId);
            setIskontoKodu(selected.kod || "");
            if (selected.iskontoTipi === 1) {
              setIskontoOrani(Number(selected.oran) || 0);
            }
          }
          setShowIskontoModal(false);
        }}
      />

      {/* Barkodlu Altın / Özel Ürün Seçim Modalı (LookupModal) */}
      <LookupModal
        show={showProductLookup}
        onHide={() => setShowProductLookup(false)}
        title="Barkodlu Ürün Seçimi"
        items={combinedLookupItems}
        isLoading={isProductLoading}
        columns={productLookupColumns}
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
        }}
        title="Ödeme Para / Döviz / Altın Seçimi"
        items={odemeUrunList}
        columns={odemeLookupColumns}
        filterFn={(u, term) =>
          u.kod.toLowerCase().includes(term.toLowerCase()) ||
          u.ad.toLowerCase().includes(term.toLowerCase())
        }
        onSelect={(selectedUrun) => {
          if (activeOdemeRowIdForUrun) {
            applyProductToOdemeRow(activeOdemeRowIdForUrun, selectedUrun);
          }
          setShowOdemeUrunModal(false);
          setActiveOdemeRowIdForUrun(null);
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
          onClose={() => setShowMusteriModal(false)}
          cariler={cariler}
          kayitsizMusteriler={kayitsizMusteriler}
          onSelectCustomer={handleSelectCustomer}
          currentUnvan={aliciUnvan}
        />
      )}

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
          onHide={() => setShowPrintModal(false)}
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
