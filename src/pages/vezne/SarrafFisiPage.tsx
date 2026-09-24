import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSearchParams, useLocation, useNavigate } from "react-router-dom";
import { useEBankaFisKesimi } from "../ebanka/useEBankaFisKesimi";
import { Card, Row, Col, Form, Button, Table, Badge, Alert, InputGroup, Modal, Spinner } from "react-bootstrap";
import {
  IconCheck, IconBinoculars, IconAlertTriangle, IconPlus, IconShieldExclamation, IconShieldCheck, IconPrinter,
} from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import LookupModal, { LookupColumn } from "../../components/common/LookupModal";
import { useAuth } from "../../context/AuthContext";
import { MasakService, MasakEslesme } from "../../services/masakService";
import { MasakSonucModal } from "../../components/masak/MasakSonucModal";
import MasakModal from "../../components/masak/MasakModal";
import {
  SarrafFisService, SaveSarrafFisPayload, SarrafFisListItem,
  UrunItem, VezneBakiyeItem,
} from "../../services/sarrafFisService";
import { CashDeskService } from "../../services/cashDeskService";
import { MusteriSecimModal, SelectedCustomerResult } from "./MusteriSecimModal";
import { CariService, CariKartItem } from "../../services/cariService";
import { DovizFisService, KayitsizMusteriItem, IstatistikSecimItem } from "../../services/dovizFisService";
import { StatisticService, StatisticItem } from "../../services/statisticService";
import { CompanyService, TodvzTanimDto } from "../../services/companyService";
import { KurService, KurRowItem } from "../../services/kurService";
import { NumeratorService, NumeratorItem } from "../../services/numeratorService";
import { IstatistikSecimModal } from "./IstatistikSecimModal";
import SarrafFisiPrintModal from "./SarrafFisiPrintModal";
import { onlyDecimal, onlyDigits, blockNonNumericKeys } from "../../utils/numericInput";

// ─── Types ────────────────────────────────────────────────────────────────────
interface VezneItem { id: number; kod: string; ad: string; }

interface GridRow {
  id: string;
  satirId?: number | null;
  satirNo: number;
  urunId: number;
  urunKodu: string;
  urunAdi: string;
  adet: number | string;
  miktar: number | string;
  milyem: number | string;
  hasGram: number | string;
  iscilikHesaplamaSekli: number | string;
  iscilikiMiktari: number | string;
  iscilikHasGram: number | string;
  kur: number | string;
  tutar: number | string;
  urunTipi: number;
  karat: number | string;
  aciklama: string;
}

interface OdemeRow {
  id: string;
  satirNo: number;
  odemeAraciTuru: number;
  paraId: number | null;
  paraKodu: string;
  paraAdi?: string;
  adet?: number | string;
  miktar: number | string;
  milyem: number | string;
  hasGram: number | string;
  kur: number | string;
  tutar: number | string;
  urunTipi?: number;
}

const GRID_COLS = [
  "urunKodu", "adet", "miktar", "milyem", "hasGram",
  "iscilikHesaplamaSekli", "iscilikiMiktari", "iscilikHasGram", "kur", "tutar",
] as const;
type GridColKey = typeof GRID_COLS[number];

const ODEME_COLS = [
  "paraKodu", "adet", "miktar", "milyem", "hasGram", "kur", "tutar",
] as const;
type OdemeColKey = typeof ODEME_COLS[number];

const parseDecimal = (val: any): number => {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  const normalized = String(val).replace(/\s/g, "").replace(",", ".");
  const num = parseFloat(normalized);
  return isNaN(num) ? 0 : num;
};

const makeId = () => `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const createEmptyRow = (satirNo = 1): GridRow => ({
  id: makeId(), satirId: null, satirNo, urunId: 0, urunKodu: "", urunAdi: "",
  adet: "", miktar: "", milyem: "", hasGram: "", iscilikHesaplamaSekli: 0,
  iscilikiMiktari: "", iscilikHasGram: "", kur: "", tutar: "", urunTipi: 0, karat: "", aciklama: "",
});
const createEmptyOdemeRow = (satirNo: number): OdemeRow => ({
  id: makeId(), satirNo, odemeAraciTuru: 0, paraId: null, paraKodu: "", paraAdi: "",
  adet: "", miktar: "", milyem: "", hasGram: "", kur: "", tutar: "", urunTipi: 0,
});

const recomputeOdemeRow = (r: OdemeRow, defaultHasKuru: number = 0, changedField?: keyof OdemeRow): OdemeRow => {
  const adet = parseDecimal(r.adet);
  const miktar = parseDecimal(r.miktar);
  const rawMilyem = parseDecimal(r.milyem);
  const effectiveMilyem = rawMilyem > 1 ? (rawMilyem <= 100 ? rawMilyem / 100 : rawMilyem / 1000) : rawMilyem;
  const base = miktar > 0 ? miktar : adet;

  let hasGram: number | string = r.hasGram;
  let tutar: number | string = r.tutar;
  const kurNum = parseDecimal(r.kur);
  const kur = kurNum > 0 ? kurNum : (r.paraKodu === "TL" ? 1 : (r.kur !== "" ? r.kur : 1));
  const effectiveKur = parseDecimal(kur);

  if (r.paraKodu === "TL") {
    if (changedField === "miktar") {
      tutar = miktar > 0 ? miktar : (r.miktar !== "" ? r.miktar : "");
    } else if (changedField === "tutar") {
      tutar = r.tutar;
    } else if (changedField === "adet") {
      tutar = adet > 0 ? adet : (r.adet !== "" ? r.adet : "");
    } else if (tutar === "" && miktar > 0) {
      tutar = miktar;
    }
    if (defaultHasKuru > 0 && parseDecimal(tutar) > 0 && changedField !== "hasGram") {
      hasGram = parseFloat((parseDecimal(tutar) / defaultHasKuru).toFixed(4));
    }
  } else if (r.urunTipi === 1 || r.urunTipi === 2 || effectiveMilyem > 0) {
    // Maden / Altın / Gümüş
    if (changedField !== "hasGram") {
      if (base > 0 && effectiveMilyem > 0) {
        hasGram = parseFloat((base * effectiveMilyem).toFixed(4));
      } else if (base > 0) {
        hasGram = base;
      }
    }
    if (changedField !== "tutar") {
      const effHas = parseDecimal(hasGram) > 0 ? parseDecimal(hasGram) : base;
      if (effHas > 0 && effectiveKur > 0) {
        tutar = parseFloat((effHas * effectiveKur).toFixed(2));
      }
    }
  } else {
    // Döviz
    if (changedField !== "tutar") {
      if (base > 0 && effectiveKur > 0) {
        tutar = parseFloat((base * effectiveKur).toFixed(2));
      }
    }
    if (defaultHasKuru > 0 && parseDecimal(tutar) > 0 && changedField !== "hasGram") {
      hasGram = parseFloat((parseDecimal(tutar) / defaultHasKuru).toFixed(4));
    }
  }

  return {
    ...r,
    hasGram,
    tutar,
    kur,
  };
};

const recomputeRow = (r: GridRow, defaultKur: number = 0, changedField?: keyof GridRow): GridRow => {
  const adet = parseDecimal(r.adet);
  const miktar = parseDecimal(r.miktar);
  const rawMilyem = parseDecimal(r.milyem);
  const effectiveMilyem = rawMilyem > 1 ? (rawMilyem <= 100 ? rawMilyem / 100 : rawMilyem / 1000) : rawMilyem;

  // Has hesabı: kullanıcı doğrudan hasGram yazıyorsa ezme
  const base = miktar > 0 ? miktar : adet;
  let hasGram: number | string = r.hasGram;
  if (changedField !== "hasGram") {
    if (r.urunTipi === 1 || r.urunTipi === 2 || effectiveMilyem > 0) {
      if (miktar > 0 && effectiveMilyem > 0) {
        hasGram = parseFloat((miktar * effectiveMilyem).toFixed(4));
      } else if (miktar > 0) {
        hasGram = miktar;
      } else if (adet > 0 && effectiveMilyem > 0) {
        hasGram = parseFloat((adet * effectiveMilyem).toFixed(4));
      } else if (r.hasGram !== "" && parseDecimal(r.hasGram) > 0) {
        hasGram = parseDecimal(r.hasGram);
      }
    } else if (r.hasGram !== "" && parseDecimal(r.hasGram) > 0) {
      hasGram = parseDecimal(r.hasGram);
    }
  }

  // İşçilik hesabı: 0: Gram, 1: Adet, 2: Toplam
  const iscilikSekli = Number(r.iscilikHesaplamaSekli) || 0;
  const iscilikiMiktari = parseDecimal(r.iscilikiMiktari);
  let iscilikHasGram: number | string = r.iscilikHasGram;

  if (changedField !== "iscilikHasGram") {
    if (iscilikiMiktari > 0) {
      if (iscilikSekli === 0) {
        // Gram seçilirse: gram (veya miktar/adet) * işçilik
        const gramVal = miktar > 0 ? miktar : (adet > 0 ? adet : 0);
        iscilikHasGram = parseFloat((gramVal * iscilikiMiktari).toFixed(4));
      } else if (iscilikSekli === 1) {
        // Adet seçilirse: adet * işçilik
        const adetVal = adet > 0 ? adet : 1;
        iscilikHasGram = parseFloat((adetVal * iscilikiMiktari).toFixed(4));
      } else if (iscilikSekli === 2) {
        // Toplam seçilirse
        iscilikHasGram = parseFloat(iscilikiMiktari.toFixed(4));
      }
    } else if (r.iscilikHasGram !== "" && parseDecimal(r.iscilikHasGram) > 0) {
      iscilikHasGram = parseDecimal(r.iscilikHasGram);
    }
  }

  const kurNum = parseDecimal(r.kur);
  const kur = r.kur !== "" ? r.kur : (defaultKur > 0 ? defaultKur : "");
  const effectiveKur = parseDecimal(kur);
  const totalRowHas = (parseDecimal(hasGram) || 0) + (parseDecimal(iscilikHasGram) || 0);

  // Tabloda tutar her zaman TL cinsindendir
  let tutar: number | string = r.tutar;
  if (changedField !== "tutar") {
    if (r.urunTipi === 0) {
      // Döviz / Para: miktar * kur (TL)
      const baseVal = miktar > 0 ? miktar : adet;
      if (baseVal > 0 && effectiveKur > 0) {
        tutar = parseFloat((baseVal * effectiveKur).toFixed(2));
      }
      if (defaultKur > 0 && parseDecimal(tutar) > 0 && (hasGram === "" || parseDecimal(hasGram) === 0)) {
        hasGram = parseFloat((parseDecimal(tutar) / defaultKur).toFixed(4));
      }
    } else {
      // Altın / Gümüş: (Has Gr + İşçilik Has Gr) * Kur (TL)
      if (totalRowHas > 0 && effectiveKur > 0) {
        tutar = parseFloat((totalRowHas * effectiveKur).toFixed(2));
      } else if (base > 0 && effectiveKur > 0) {
        tutar = parseFloat((base * effectiveKur).toFixed(2));
      }
    }
  }

  return {
    ...r,
    hasGram,
    iscilikHasGram,
    kur,
    tutar,
  };
};

const DEFAULT_CUSTOMER_NAME = "İsim beyan edilmemiştir";

const getUserVezne = (list: VezneItem[], cashierCode?: string): VezneItem | undefined => {
  if (!list.length) return undefined;
  const t = String(cashierCode || "").trim();
  if (t) {
    const m = list.find((v) => String(v.id) === t || v.kod.trim() === t) ||
      (!isNaN(Number(t)) ? list.find((v) => v.id === Number(t)) : undefined);
    if (m) return m;
  }
  return list[0];
};

export interface SarrafFisiPageProps {
  isPerakende?: boolean;
  isDuzeltme?: boolean;
}

export const SarrafFisiPage: React.FC<SarrafFisiPageProps> = ({
  isPerakende = false,
  isDuzeltme = false,
}) => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryId = searchParams.get("id") || searchParams.get("sarrafFisiId");
  const isDuzeltmeMode = Boolean(isDuzeltme || location.pathname.includes("duzeltme"));

  const [notification, setNotification] = useState<{ type: "success" | "danger" | "warning" | "info"; message: string } | null>(null);
  const showNotif = (type: "success" | "danger" | "warning" | "info", msg: string) => {
    setNotification({ type, message: msg });
    setTimeout(() => setNotification(null), 4500);
  };

  // Lookups
  const [vezneList, setVezneList] = useState<VezneItem[]>([]);
  const [urunList, setUrunList] = useState<UrunItem[]>([]);
  const [bakiyeler, setBakiyeler] = useState<VezneBakiyeItem[]>([]);
  const [fisList, setFisList] = useState<SarrafFisListItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [cariList, setCariList] = useState<CariKartItem[]>([]);
  const [kayitsizMusteriList, setKayitsizMusteriList] = useState<KayitsizMusteriItem[]>([]);
  const [showCariModal, setShowCariModal] = useState<boolean>(false);
  const [kurSatirlar, setKurSatirlar] = useState<KurRowItem[]>([]);
  const [numeratorList, setNumeratorList] = useState<NumeratorItem[]>([]);

  // Helper to determine active Seri No / Belge No from Numerators
  const getNumeratorForTip = useCallback((t: number, numerators: NumeratorItem[]) => {
    if (t === 0) {
      // Alış Seri No: Tur 0, 1, 2, 3 (veya 8)
      const num = (numerators || []).find((n) => [0, 1, 2, 3].includes(n.tur))
        || (numerators || []).find((n) => n.tur === 8);
      if (num) {
        const onek = (num.onek || "A").trim();
        const baslangic = num.baslangic || 1;
        const uzunluk = num.uzunluk || 10;
        const padLen = Math.max(1, uzunluk - onek.length);
        const numStr = num.onuneSifirKoy !== false
          ? String(baslangic).padStart(padLen, "0")
          : String(baslangic);
        const fullSeri = `${onek}${numStr}`;
        return {
          seriNo: fullSeri,
          fisNo: num.ornekNumara || String(baslangic),
        };
      }
      return { seriNo: "", fisNo: "" };
    } else {
      // Satış Seri No: Tur 4, 5, 6, 7 (veya 9)
      const num = (numerators || []).find((n) => [4, 5, 6, 7].includes(n.tur))
        || (numerators || []).find((n) => n.tur === 9);
      if (num) {
        const onek = (num.onek || "S").trim();
        const baslangic = num.baslangic || 1;
        const uzunluk = num.uzunluk || 10;
        const padLen = Math.max(1, uzunluk - onek.length);
        const numStr = num.onuneSifirKoy !== false
          ? String(baslangic).padStart(padLen, "0")
          : String(baslangic);
        const fullSeri = `${onek}${numStr}`;
        return {
          seriNo: fullSeri,
          fisNo: num.ornekNumara || String(baslangic),
        };
      }
      return { seriNo: "", fisNo: "" };
    }
  }, []);

  // Header State
  const [fisId, setFisId] = useState<number | null>(null);
  const [fisNo, setFisNo] = useState("");
  const [seriNo, setSeriNo] = useState("");
  const [cariKod, setCariKod] = useState("");
  const [tarih, setTarih] = useState(() => new Date().toISOString().split("T")[0]);
  const [saat, setSaat] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  });
  const [tip, setTip] = useState<0 | 1>(0);
  const [belgeTuru, setBelgeTuru] = useState(0);
  const [unvan, setUnvan] = useState(DEFAULT_CUSTOMER_NAME);
  const [cariKartId, setCariKartId] = useState<number | null>(null);
  const [altinHasKuru, setAltinHasKuru] = useState<number | string>("");
  const [alisKuru, setAlisKuru] = useState<number | string>("");
  const [satisKuru, setSatisKuru] = useState<number | string>("");
  const [gumusHasKuru, setGumusHasKuru] = useState<number | string>("");
  const [kdvOrani, setKdvOrani] = useState<number | string>("");
  const [vezneId, setVezneId] = useState(0);
  const [vezneKod, setVezneKod] = useState("");
  const [vezneAd, setVezneAd] = useState("");

  // Detay Modal State
  const [detayUnvan, setDetayUnvan] = useState(DEFAULT_CUSTOMER_NAME);
  const [detayKisilikTipi, setDetayKisilikTipi] = useState(0);
  const [detayVergiKimlikNo, setDetayVergiKimlikNo] = useState("");
  const [detayBabaAdi, setDetayBabaAdi] = useState("");
  const [detayAnneAdi, setDetayAnneAdi] = useState("");
  const [detayAdres, setDetayAdres] = useState("");
  const [detayEposta, setDetayEposta] = useState("");
  const [detayTelefonNo, setDetayTelefonNo] = useState("");
  const [detayDogumTarihi, setDetayDogumTarihi] = useState("");
  const [detayDogumYeri, setDetayDogumYeri] = useState("");
  const [detayKimlikSeriNo, setDetayKimlikSeriNo] = useState("");
  const [detayPasaportNo, setDetayPasaportNo] = useState("");
  const [detayKimlikBelgeTuru, setDetayKimlikBelgeTuru] = useState(0);
  const [detayKimlikGecerlilikTarihi, setDetayKimlikGecerlilikTarihi] = useState("");
  const [detayVekilAdi, setDetayVekilAdi] = useState("");
  const [detayVekilKimlikNo, setDetayVekilKimlikNo] = useState("");

  // Grid State (Kalemler)
  const [lines, setLines] = useState<GridRow[]>([createEmptyRow(1)]);
  const [activeRowIndex, setActiveRowIndex] = useState(0);
  const rowInputRefs = useRef<Record<string, HTMLInputElement | HTMLSelectElement | null>>({});

  // Ödeme / Tahsilat Tablosu Grid State
  const [odemeRows, setOdemeRows] = useState<OdemeRow[]>([createEmptyOdemeRow(1)]);
  const [activeOdemeRowIndex, setActiveOdemeRowIndex] = useState(0);
  const odemeInputRefs = useRef<Record<string, HTMLInputElement | HTMLSelectElement | null>>({});

  // Header Element Refs for Keyboard Navigation
  const islemRef = useRef<HTMLSelectElement | null>(null);
  const tcknRef = useRef<HTMLInputElement | null>(null);
  const cariKodRef = useRef<HTMLInputElement | null>(null);
  const adRef = useRef<HTMLInputElement | null>(null);
  const zamanTarihRef = useRef<HTMLInputElement | null>(null);
  const zamanSaatRef = useRef<HTMLInputElement | null>(null);
  const seriNoRef = useRef<HTMLInputElement | null>(null);
  const belgeNoRef = useRef<HTMLInputElement | null>(null);
  const istatistikRef = useRef<HTMLInputElement | null>(null);
  const hasKuruRef = useRef<HTMLInputElement | null>(null);
  const kdvOraniRef = useRef<HTMLInputElement | null>(null);

  // Detay Modal Element Refs for Keyboard Navigation
  const detayRefs = useRef<Record<string, HTMLInputElement | HTMLSelectElement | null>>({});
  const DETAY_FIELDS = [
    "unvan", "kisilikTipi", "kimlikBelgeTuru", "vergiKimlikNo", "kimlikSeriNo",
    "pasaportNo", "babaAdi", "anneAdi", "dogumTarihi", "dogumYeri",
    "kimlikGecerlilikTarihi", "telefonNo", "adres", "eposta", "vekilAdi", "vekilKimlikNo",
  ] as const;

  // Modals
  const [showFisModal, setShowFisModal] = useState(false);
  const [showVezneModal, setShowVezneModal] = useState(false);
  const [showUrunModal, setShowUrunModal] = useState(false);
  const [cariSearchTerm, setCariSearchTerm] = useState("");
  const [urunSearchTerm, setUrunSearchTerm] = useState("");
  const [istatistikSearchTerm, setIstatistikSearchTerm] = useState("");
  const [showMasakConfirmModal, setShowMasakConfirmModal] = useState(false);
  const [showMasakCustomerWarningModal, setShowMasakCustomerWarningModal] = useState(false);
  const [showMasakMissingModal, setShowMasakMissingModal] = useState(false);
  const [masakMissingFields, setMasakMissingFields] = useState<string[]>([]);
  const [activeRowIdForUrun, setActiveRowIdForUrun] = useState<string | null>(null);
  const [activeOdemeRowIdForUrun, setActiveOdemeRowIdForUrun] = useState<string | null>(null);
  const activeRowIdForUrunRef = useRef<string | null>(null);
  const activeOdemeRowIdForUrunRef = useRef<string | null>(null);
  const [isUrunLoading, setIsUrunLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDetayModal, setShowDetayModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printSnapshot, setPrintSnapshot] = useState<any>(null);
  const [isPendingDirectPrint, setIsPendingDirectPrint] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Totals (Kalemler)
  const totalAdet = lines.reduce((s, r) => s + (parseDecimal(r.adet) || 0), 0);
  const totalMiktar = lines.reduce((s, r) => s + (parseDecimal(r.miktar) || 0), 0);
  const totalHasGram = lines.reduce((s, r) => s + (parseDecimal(r.hasGram) || 0), 0);
  const totalIscilikMiktari = lines.reduce((s, r) => s + (parseDecimal(r.iscilikiMiktari) || 0), 0);
  const totalIscilikHasGram = lines.reduce((s, r) => s + (parseDecimal(r.iscilikHasGram) || 0), 0);
  const totalTutar = lines.reduce((s, r) => s + (parseDecimal(r.tutar) || 0), 0);

  // Totals (Ödeme / Tahsilat)
  const totalOdemeAdet = odemeRows.reduce((s, r) => s + (parseDecimal(r.adet) || 0), 0);
  const totalOdemeMiktar = odemeRows.reduce((s, r) => s + (parseDecimal(r.miktar) || 0), 0);
  const totalOdemeHas = odemeRows.reduce((s, r) => s + (parseDecimal(r.hasGram) || 0), 0);
  const totalOdemeTutar = odemeRows.reduce((s, r) => s + (parseDecimal(r.tutar) || 0), 0);

  const hasKuruNum = Number(altinHasKuru) || 0;
  const alisHas = (totalHasGram + totalIscilikHasGram) > 0
    ? (totalHasGram + totalIscilikHasGram)
    : (hasKuruNum > 0 ? totalTutar / hasKuruNum : 0);
  const odemeHas = totalOdemeHas > 0
    ? totalOdemeHas
    : (hasKuruNum > 0 ? totalOdemeTutar / hasKuruNum : (totalOdemeTutar === totalTutar ? alisHas : 0));
  const farkTL = totalTutar - totalOdemeTutar;
  const farkHas = alisHas - odemeHas;

  // İstatistik Tanımları Listesi, Firma Tanımları ve Seçili İstatistik
  const [statisticList, setStatisticList] = useState<StatisticItem[]>([]);
  const [companyDefinitions, setCompanyDefinitions] = useState<TodvzTanimDto | null>(null);
  const [istatistikId, setIstatistikId] = useState<number | null>(null);
  const [istatistikKodu, setIstatistikKodu] = useState<string>("");
  const [showIstatistikModal, setShowIstatistikModal] = useState<boolean>(false);
  const prevTipRef = useRef<number>(tip);

  // MASAK Sorgulama ve Limit Takip Durumu
  const [isSearchingMasak, setIsSearchingMasak] = useState<boolean>(false);
  const [masakModalOpen, setMasakModalOpen] = useState<boolean>(false);
  const [masakManagementOpen, setMasakManagementOpen] = useState<boolean>(false);
  const [masakResult, setMasakResult] = useState<{
    queriedName?: string;
    queriedId?: string;
    matches: MasakEslesme[];
    searched: boolean;
  }>({ matches: [], searched: false });

  // MASAK Malvarlığı Dondurulanlar Bloke Durumu
  const isMasakBlocked = Boolean(masakResult.searched && masakResult.matches && masakResult.matches.length > 0);

  // 185.000 TL veya 5.000 USD MASAK Yasal Sınır Kontrolü
  const isMasakLimitExceeded = useMemo(() => {
    return (
      totalTutar >= 185000 ||
      totalOdemeTutar >= 185000 ||
      odemeRows.some((o) => (o.paraKodu === "USD" || o.paraKodu === "$") && parseDecimal(o.miktar) >= 5000) ||
      lines.some((l) => (l.urunKodu === "USD" || l.urunKodu === "$") && parseDecimal(l.miktar) >= 5000)
    );
  }, [totalTutar, totalOdemeTutar, odemeRows, lines]);

  // Varsayılan İstatistik Belirleme Fonksiyonu (1. Firma Tanımları, 2. Kullanıcı Tercihi, 3. İlk Kayıt)
  const getDefaultStatistic = useCallback(
    (tipValue: 0 | 1, customList?: StatisticItem[], customDefs?: any): StatisticItem | undefined => {
      const list = customList || statisticList;
      const defs = customDefs !== undefined ? customDefs : companyDefinitions;
      if (!list || list.length === 0) return undefined;

      // 1. Firma Tanımları Kontrolü (Öncelikli)
      if (defs) {
        const companyStatId =
          tipValue === 0 ? defs.ALIS_ISTATISTIK_ID : defs.SATIS_ISTATISTIK_ID;
        if (companyStatId) {
          const foundCompany = list.find((s) => s.id === Number(companyStatId));
          if (foundCompany) return foundCompany;
        }
      }

      // 2. Kullanıcı Tanımları Kontrolü
      const userStatCode = tipValue === 0 ? user?.buyStatCode : user?.sellStatCode;
      if (userStatCode && userStatCode.trim()) {
        const cleanUserCode = userStatCode.trim().toLowerCase();
        const foundUser = list.find(
          (s) =>
            (s.kod && s.kod.toLowerCase() === cleanUserCode) ||
            String(s.id) === cleanUserCode
        );
        if (foundUser) return foundUser;
      }

      // 3. Fiş tipine uygun ilk kayıt
      const foundFirst =
        list.find((s) => {
          const fType = Number(s.fisTipi);
          if (tipValue === 0) {
            return fType === 0 || fType === 2;
          } else {
            return fType === 1 || fType === 2;
          }
        }) || list[0];

      return foundFirst;
    },
    [statisticList, user?.buyStatCode, user?.sellStatCode, companyDefinitions]
  );

  const handleSelectIstatistik = (item: IstatistikSecimItem) => {
    setIstatistikId(item.id);
    setIstatistikKodu(item.kod);
    setShowIstatistikModal(false);
  };

  const handleSearchMasak = async (explicitName?: string, explicitId?: string) => {
    const rawName = explicitName !== undefined ? explicitName : unvan;
    const rawId = explicitId !== undefined ? explicitId : detayVergiKimlikNo;

    const isAnon = !rawName || !rawName.trim() ||
      rawName.trim().toUpperCase() === "İSİM BEYAN EDİLMEMİŞTİR" ||
      rawName.trim().toUpperCase() === "ISIM BEYAN EDILMEMISTIR";

    const cleanName = isAnon ? "" : rawName.trim();
    const cleanId = (rawId || "").trim();

    if (!cleanName && !cleanId) {
      showNotif("warning", "MASAK sorgusu yapabilmek için lütfen Müşteri Adı / Ünvan veya T.C. Kimlik / VKN giriniz.");
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
        showNotif("danger", `🚨 DİKKAT: "${cleanName || cleanId}" için MASAK listelerinde ${matches.length} eşleşme bulundu!`);
      } else {
        setMasakModalOpen(false);
      }
    } catch (err: any) {
      showNotif("danger", `MASAK sorgusu yapılamadı: ${err?.message || "Sunucu bağlantı hatası"}`);
    } finally {
      setIsSearchingMasak(false);
    }
  };



  // Sayfa ilk açılınca otomatik inputa / işleme odaklan
  useEffect(() => {
    const timer = setTimeout(() => {
      islemRef.current?.focus();
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  const initialLoadDoneRef = useRef(false);

  // Load by ID
  const loadFisById = useCallback(async (id: number) => {
    try {
      const data = await SarrafFisService.getFisById(id);
      if (!data) return;
      setFisId(data.sarrafFisiId);
      const rawFisNo = ((data as any).fisNo || "").trim();
      const rawSeriNo = ((data as any).seriNo || "").trim();
      const rawBelgeNo = ((data as any).belgeNo || (data as any).irsaliyeNo || "").trim();
      setSeriNo(rawSeriNo || rawFisNo);
      setFisNo(rawBelgeNo !== rawFisNo ? rawBelgeNo : "");
      setTarih(data.tarih || new Date().toISOString().split("T")[0]);
      if (data.saat) setSaat(new Date(data.saat).toTimeString().slice(0, 5));
      const loadedTip = (data.tip as 0 | 1) || 0;
      setTip(loadedTip);
      prevTipRef.current = loadedTip;
      setBelgeTuru(data.belgeTuru || 0);
      setUnvan(data.unvan || DEFAULT_CUSTOMER_NAME);
      setCariKartId(data.cariKartId || null);
      if (data.cariKartId && cariList.length > 0) {
        const matchedCari = cariList.find((c) => c.id === data.cariKartId);
        if (matchedCari) setCariKod(matchedCari.kod || "");
        else setCariKod("");
      } else {
        setCariKod("");
      }
      setAltinHasKuru(data.altinHasKuru || "");
      setAlisKuru(data.alisKuru || "");
      setSatisKuru(data.satisKuru || "");
      setGumusHasKuru(data.gumusHasKuru || "");
      setKdvOrani(data.kdvOrani !== null && data.kdvOrani !== undefined ? data.kdvOrani : "");
      if (data.vezneId) {
        setVezneId(data.vezneId);
        const vz = vezneList.find((v) => v.id === data.vezneId);
        if (vz) { setVezneKod(vz.kod); setVezneAd(vz.ad); }
        const bak = await SarrafFisService.getVezneBakiye(data.vezneId).catch(() => []);
        setBakiyeler(bak);
      }
      setDetayUnvan(data.unvan || DEFAULT_CUSTOMER_NAME);
      setDetayKisilikTipi((data as any).kisilikTipi || 0);
      setMasakResult({ matches: [], searched: false });
      setMasakModalOpen(false);
      setDetayVergiKimlikNo((data as any).vergiKimlikNo || "");
      setDetayBabaAdi((data as any).babaAdi || "");
      setDetayAnneAdi((data as any).anneAdi || "");
      setDetayAdres((data as any).adres || "");
      setDetayEposta((data as any).eposta || "");
      setDetayTelefonNo((data as any).telefonNo || "");
      setDetayDogumTarihi((data as any).dogumTarihi || "");
      setDetayDogumYeri((data as any).dogumYeri || "");
      setDetayKimlikSeriNo((data as any).kimlikSeriNo || "");
      setDetayPasaportNo((data as any).pasaportNo || "");
      setDetayKimlikBelgeTuru((data as any).kimlikBelgeTuru || 0);
      setDetayKimlikGecerlilikTarihi((data as any).kimlikGecerlilikTarihi || "");
      setDetayVekilAdi((data as any).vekilAdi || "");
      setDetayVekilKimlikNo((data as any).vekilKimlikNo || "");

      if (data.satirlar && data.satirlar.length > 0) {
        const curHasKuru = Number(data.altinHasKuru) || 0;
        const mapped = data.satirlar.map((s: any) => {
          let itemMilyem = (s.milyem !== undefined && s.milyem !== null && s.milyem !== "") ? s.milyem : "";
          if ((itemMilyem === "" || Number(itemMilyem) === 0) && (s.urunId || s.urunKodu) && urunList.length > 0) {
            const matchedUrun = urunList.find((u) => (s.urunId && u.paraId === s.urunId) || (u.kod && s.urunKodu && u.kod.trim().toLowerCase() === s.urunKodu.trim().toLowerCase()));
            if (matchedUrun && matchedUrun.hasOrani !== undefined && matchedUrun.hasOrani !== null) {
              itemMilyem = matchedUrun.hasOrani;
            }
          }
          const rowObj: GridRow = {
            id: `row-${s.sarrafFisiSatiriId || makeId()}`,
            satirId: s.sarrafFisiSatiriId,
            satirNo: s.satirNo,
            urunId: s.urunId || 0,
            urunKodu: s.urunKodu || "",
            urunAdi: s.urunAdi || "",
            adet: s.adet != null ? s.adet : "",
            miktar: s.miktar != null ? s.miktar : "",
            milyem: itemMilyem,
            hasGram: s.hasGram != null ? s.hasGram : "",
            iscilikHesaplamaSekli: s.iscilikHesaplamaSekli || 0,
            iscilikiMiktari: s.iscilikiMiktari != null ? s.iscilikiMiktari : "",
            iscilikHasGram: s.iscilikHasGram != null ? s.iscilikHasGram : "",
            kur: s.kur != null ? s.kur : "",
            tutar: s.tutar != null ? s.tutar : "",
            urunTipi: s.urunTipi || 0,
            karat: s.karat || "",
            aciklama: s.aciklama || "",
          };
          return recomputeRow(rowObj, curHasKuru);
        });
        setLines(mapped.length > 0 ? mapped : [createEmptyRow(1)]);
      } else {
        setLines([createEmptyRow(1)]);
      }

      if (data.odemeSatirlari && data.odemeSatirlari.length > 0) {
        const curHasKuru = Number(data.altinHasKuru) || 0;
        const mappedOdeme = data.odemeSatirlari.map((o: any) => {
          let oMilyem = (o.milyem !== undefined && o.milyem !== null && o.milyem !== "") ? o.milyem : "";
          if ((oMilyem === "" || Number(oMilyem) === 0) && (o.paraId || o.paraKodu) && urunList.length > 0) {
            const matchedUrun = urunList.find((u) => (o.paraId && u.paraId === o.paraId) || (u.kod && o.paraKodu && u.kod.trim().toLowerCase() === o.paraKodu.trim().toLowerCase()));
            if (matchedUrun && matchedUrun.hasOrani !== undefined && matchedUrun.hasOrani !== null) {
              oMilyem = matchedUrun.hasOrani;
            }
          }
          const matchedUrun = urunList.find((u) => (o.paraId && u.paraId === o.paraId) || (u.kod && o.paraKodu && u.kod.trim().toLowerCase() === o.paraKodu.trim().toLowerCase()));
          let calcAdet: number | string = o.adet != null && o.adet !== "" ? o.adet : "";
          if (!calcAdet && matchedUrun && Number(matchedUrun.gramaj) > 0 && Number(o.miktar) > 0) {
            calcAdet = Math.round(Number(o.miktar) / Number(matchedUrun.gramaj));
          } else if (!calcAdet && matchedUrun && matchedUrun.birim === 0 && Number(o.miktar) > 0) {
            calcAdet = Number(o.miktar);
          }
          const oRow: OdemeRow = {
            id: makeId(),
            satirNo: o.satirNo,
            odemeAraciTuru: o.odemeAraciTuru || 0,
            paraId: o.paraId,
            paraKodu: o.paraKodu || "TL",
            paraAdi: o.paraAdi || matchedUrun?.ad || (o.paraKodu === "TL" ? "TÜRK LİRASI" : ""),
            adet: calcAdet,
            miktar: o.miktar != null ? o.miktar : "",
            milyem: oMilyem,
            hasGram: o.hasGram != null ? o.hasGram : "",
            kur: o.kur != null ? o.kur : 1,
            tutar: o.tutar != null ? o.tutar : "",
            urunTipi: o.urunTipi || matchedUrun?.urunTipi || 0,
          };
          return recomputeOdemeRow(oRow, curHasKuru);
        });
        setOdemeRows(mappedOdeme.length > 0 ? mappedOdeme : [createEmptyOdemeRow(1)]);
      } else {
        setOdemeRows([createEmptyOdemeRow(1)]);
      }
    } catch (e) {
      showNotif("danger", "Fiş yüklenemedi");
    }
  }, [vezneList, cariList, urunList]);

  // Reset form (keeps cashier's vezne intact, clears all inputs)
  const resetForm = useCallback(() => {
    setFisId(null);
    setFisNo("");
    setSeriNo("");
    setCariKod("");
    setTarih(new Date().toISOString().split("T")[0]);
    const d = new Date();
    setSaat(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
    setTip(0);
    setBelgeTuru(0);
    setUnvan(DEFAULT_CUSTOMER_NAME);
    setCariKartId(null);

    // Varsayılan HAS Altın ve Gümüş kurları
    let defaultHas: number | string = "";
    let defaultGumus: number | string = "";
    if (kurSatirlar.length > 0) {
      const hasKurItem = kurSatirlar.find((k) => ["HAS", "ALTIN", "HAS ALTIN"].includes((k.kod || "").toUpperCase().trim()));
      if (hasKurItem) {
        defaultHas = (hasKurItem.dovizAlis ?? hasKurItem.efektifAlis ?? hasKurItem.dovizSatis ?? hasKurItem.efektifSatis) || "";
      }
      const gumusKurItem = kurSatirlar.find((k) => ["GUMUS", "GÜMÜŞ", "HAS GÜMÜŞ"].includes((k.kod || "").toUpperCase().trim()));
      if (gumusKurItem) {
        defaultGumus = (gumusKurItem.dovizAlis ?? gumusKurItem.efektifAlis ?? gumusKurItem.dovizSatis ?? gumusKurItem.efektifSatis) || "";
      }
    }
    setAltinHasKuru(defaultHas);
    setAlisKuru("");
    setSatisKuru("");
    setGumusHasKuru(defaultGumus);
    setKdvOrani("");
    setDetayUnvan(DEFAULT_CUSTOMER_NAME);
    setDetayKisilikTipi(0);
    setDetayVergiKimlikNo("");
    setDetayBabaAdi("");
    setDetayAnneAdi("");
    setDetayAdres("");
    setDetayEposta("");
    setDetayTelefonNo("");
    setDetayDogumTarihi("");
    setDetayDogumYeri("");
    setDetayKimlikSeriNo("");
    setDetayPasaportNo("");
    setDetayKimlikBelgeTuru(0);
    setDetayKimlikGecerlilikTarihi("");
    setDetayVekilAdi("");
    setDetayVekilKimlikNo("");
    const defStat = getDefaultStatistic(0);
    setIstatistikId(defStat ? defStat.id : null);
    setIstatistikKodu(defStat ? defStat.kod : "");
    setLines([createEmptyRow(1)]);
    setActiveRowIndex(0);
    setOdemeRows([createEmptyOdemeRow(1)]);
    setActiveOdemeRowIndex(0);
  }, [getDefaultStatistic, kurSatirlar]);

  const handleNew = useCallback(() => {
    if (isDuzeltmeMode) {
      navigate("/vezne/sarraf-fisi-kayit");
    } else {
      resetForm();
    }
  }, [isDuzeltmeMode, navigate, resetForm]);

  // Load lookups & user's default vezne & load initial record on first load
  const loadLookupsAndData = useCallback(async () => {
    try {
      const [vezneler, urunler, fisler, cariler, kayitsizlar, stats, compDefs, anlikKurRes, gunlukKurRes, numerators] = await Promise.all([
        CashDeskService.getVezneler().catch((): VezneItem[] => []),
        SarrafFisService.getUrunler().catch(() => []),
        SarrafFisService.getFisList({ limit: 500 }).catch(() => []),
        CariService.getCariKartlar().catch(() => [] as CariKartItem[]),
        DovizFisService.getKayitsizMusteriler().catch(() => []),
        StatisticService.getStatistics().catch(() => [] as StatisticItem[]),
        CompanyService.getDefinitions().catch(() => null),
        KurService.getKurTablosu({ tur: 0 }).catch(() => null),
        KurService.getKurTablosu({ tur: 1 }).catch(() => null),
        NumeratorService.getNumerators().catch(() => [] as NumeratorItem[]),
      ]);
      setVezneList(vezneler as VezneItem[]);
      setUrunList(urunler);
      const sortedFisler = [...(fisler || [])].sort((a, b) => (Number(a.sarrafFisiId) || 0) - (Number(b.sarrafFisiId) || 0));
      setFisList(sortedFisler);
      setCariList(cariler as CariKartItem[]);
      setKayitsizMusteriList(kayitsizlar as KayitsizMusteriItem[]);
      setStatisticList(stats as StatisticItem[]);
      if (compDefs) setCompanyDefinitions(compDefs);
      setNumeratorList(numerators || []);

      // Merge anlık & günlük kur satırları
      const mergedKurMap = new Map<string, KurRowItem>();
      (gunlukKurRes?.satirlar || []).forEach((k) => {
        const cCode = (k.kod || "").toUpperCase().trim();
        if (cCode) mergedKurMap.set(cCode, k);
      });
      (anlikKurRes?.satirlar || []).forEach((k) => {
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
      setKurSatirlar(allKurList);

      const hasKurItem = allKurList.find((k) => ["HAS", "ALTIN", "HAS ALTIN"].includes((k.kod || "").toUpperCase().trim()));
      const defaultHas = hasKurItem ? ((hasKurItem.dovizAlis ?? hasKurItem.efektifAlis ?? hasKurItem.dovizSatis ?? hasKurItem.efektifSatis) || "") : "";
      const gumusKurItem = allKurList.find((k) => ["GUMUS", "GÜMÜŞ", "HAS GÜMÜŞ"].includes((k.kod || "").toUpperCase().trim()));
      const defaultGumus = gumusKurItem ? ((gumusKurItem.dovizAlis ?? gumusKurItem.efektifAlis ?? gumusKurItem.dovizSatis ?? gumusKurItem.efektifSatis) || "") : "";

      if (!queryId) {
        let userVezneId: number | null = null;
        if (user?.id) {
          userVezneId = await SarrafFisService.getUserVezneId(Number(user.id)).catch(() => null);
        }
        let uv: VezneItem | undefined;
        if (userVezneId) {
          uv = (vezneler as VezneItem[]).find((v) => v.id === userVezneId);
        }
        if (!uv) {
          uv = getUserVezne(vezneler as VezneItem[], user?.cashierCode);
        }
        if (uv) {
          setVezneId(uv.id); setVezneKod(uv.kod); setVezneAd(uv.ad);
          const bak = await SarrafFisService.getVezneBakiye(uv.id).catch(() => []);
          setBakiyeler(bak);
        }

        // Sayfa ilk kez açıldığında: Düzeltme sayfasında son kayıt açılsın
        if (!initialLoadDoneRef.current) {
          initialLoadDoneRef.current = true;
          if (isDuzeltmeMode && sortedFisler.length > 0) {
            const lastIdx = sortedFisler.length - 1;
            const lastFis = sortedFisler[lastIdx];
            if (lastFis?.sarrafFisiId) {
              setCurrentIndex(lastIdx);
              await loadFisById(lastFis.sarrafFisiId);
            }
          } else if (!isDuzeltmeMode) {
            if (defaultHas) setAltinHasKuru(defaultHas);
            if (defaultGumus) setGumusHasKuru(defaultGumus);
            const defStat = getDefaultStatistic(tip, stats as StatisticItem[], compDefs);
            if (defStat) {
              setIstatistikId(defStat.id);
              setIstatistikKodu(defStat.kod);
            }
          }
        }
      } else {
        if (!initialLoadDoneRef.current) {
          initialLoadDoneRef.current = true;
          await loadFisById(Number(queryId));
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, [queryId, user?.id, user?.cashierCode, isDuzeltmeMode, tip, getDefaultStatistic]);

  useEffect(() => {
    loadLookupsAndData();
  }, [loadLookupsAndData]);

  const handleRefresh = useCallback(async () => {
    initialLoadDoneRef.current = false;
    await loadLookupsAndData();
    if (!isDuzeltmeMode && !queryId) {
      resetForm();
    }
  }, [loadLookupsAndData, isDuzeltmeMode, queryId, resetForm]);

  // Navigation handlers (Düzeltme sayfaları için)
  const handleOpenFisModal = useCallback(async () => {
    try {
      const list = await SarrafFisService.getFisList({ limit: 500 }).catch(() => []);
      if (list && list.length > 0) {
        const sorted = [...list].sort((a, b) => (Number(a.sarrafFisiId) || 0) - (Number(b.sarrafFisiId) || 0));
        setFisList(sorted);
      }
    } catch (e) {
      console.error(e);
    }
    setShowFisModal(true);
  }, []);

  const handleFirst = useCallback(async () => {
    try {
      let list = fisList;
      if (!list || list.length === 0) {
        list = await SarrafFisService.getFisList({ limit: 500 }).catch(() => []);
      }
      if (!list?.length) {
        showNotif("info", "Kayıtlı fiş bulunamadı");
        return;
      }
      const sorted = [...list].sort((a, b) => (Number(a.sarrafFisiId) || 0) - (Number(b.sarrafFisiId) || 0));
      setFisList(sorted);
      setCurrentIndex(0);
      await loadFisById(sorted[0].sarrafFisiId);
    } catch (e) {
      console.error(e);
    }
  }, [fisList, loadFisById]);

  const handlePrev = useCallback(async () => {
    try {
      let list = fisList;
      if (!list || list.length === 0) {
        list = await SarrafFisService.getFisList({ limit: 500 }).catch(() => []);
      }
      if (!list?.length) {
        showNotif("info", "Kayıtlı fiş bulunamadı");
        return;
      }
      const sorted = [...list].sort((a, b) => (Number(a.sarrafFisiId) || 0) - (Number(b.sarrafFisiId) || 0));
      setFisList(sorted);
      const curIdx = fisId ? sorted.findIndex((f) => Number(f.sarrafFisiId) === Number(fisId)) : currentIndex;
      let nextIdx = (curIdx >= 0 ? curIdx : sorted.length) - 1;
      if (nextIdx < 0) {
        showNotif("info", "İlk kayıttasınız");
        nextIdx = 0;
      }
      setCurrentIndex(nextIdx);
      await loadFisById(sorted[nextIdx].sarrafFisiId);
    } catch (e) {
      console.error(e);
    }
  }, [fisList, fisId, currentIndex, loadFisById]);

  const handleNext = useCallback(async () => {
    try {
      let list = fisList;
      if (!list || list.length === 0) {
        list = await SarrafFisService.getFisList({ limit: 500 }).catch(() => []);
      }
      if (!list?.length) {
        showNotif("info", "Kayıtlı fiş bulunamadı");
        return;
      }
      const sorted = [...list].sort((a, b) => (Number(a.sarrafFisiId) || 0) - (Number(b.sarrafFisiId) || 0));
      setFisList(sorted);
      const curIdx = fisId ? sorted.findIndex((f) => Number(f.sarrafFisiId) === Number(fisId)) : currentIndex;
      let nextIdx = (curIdx >= 0 ? curIdx : -1) + 1;
      if (nextIdx >= sorted.length) {
        showNotif("info", "Son kayıttasınız");
        nextIdx = sorted.length - 1;
      }
      setCurrentIndex(nextIdx);
      await loadFisById(sorted[nextIdx].sarrafFisiId);
    } catch (e) {
      console.error(e);
    }
  }, [fisList, fisId, currentIndex, loadFisById]);

  const handleLast = useCallback(async () => {
    try {
      let list = fisList;
      if (!list || list.length === 0) {
        list = await SarrafFisService.getFisList({ limit: 500 }).catch(() => []);
      }
      if (!list?.length) {
        showNotif("info", "Kayıtlı fiş bulunamadı");
        return;
      }
      const sorted = [...list].sort((a, b) => (Number(a.sarrafFisiId) || 0) - (Number(b.sarrafFisiId) || 0));
      setFisList(sorted);
      const lastIdx = sorted.length - 1;
      setCurrentIndex(lastIdx);
      await loadFisById(sorted[lastIdx].sarrafFisiId);
    } catch (e) {
      console.error(e);
    }
  }, [fisList, loadFisById]);

  // Save
  const handleSave = useCallback(async (forceMasakApprove = false, andPrint = false) => {
    // MASAK Malvarlığı Dondurulanlar Listesinde ise kesinlikle kayıt yapılamaz
    if (isMasakBlocked) {
      showNotif("danger", `🚨 İŞLEM ENGELLENDİ: Bu müşteri MASAK Malvarlığı Dondurulanlar / Yaptırım Listesindedir. Kesinlikle fiş ve işlem kaydı yapılamaz!`);
      setMasakModalOpen(true);
      return;
    }

    if (!vezneId) { showNotif("warning", "Vezne seçiniz"); return; }
    const validLines = lines.filter((l) => l.urunId > 0 && parseDecimal(l.miktar) > 0);
    if (!validLines.length) { showNotif("warning", "En az bir geçerli satır giriniz"); return; }

    // 185.000 TL veya 5.000 USD MASAK Sınır ve Kimlik Bilgisi Kontrolü
    if (isMasakLimitExceeded) {
      const activeUnvan = (unvan || detayUnvan || "").trim();
      const normUnvan = activeUnvan.toLocaleUpperCase('tr-TR');
      const isAnon = !activeUnvan ||
        normUnvan === "İSİM BEYAN EDİLMEMİŞTİR" ||
        normUnvan === "ISIM BEYAN EDILMEMISTIR" ||
        normUnvan.includes("BEYAN");

      const missingFields: string[] = [];
      if (isAnon) missingFields.push("İsim / Ünvan");
      if (!detayVergiKimlikNo || !detayVergiKimlikNo.trim()) missingFields.push("T.C. Kimlik / VKN");
      if (!detayAdres || !detayAdres.trim()) missingFields.push("Müşteri Adresi");
      if (detayKisilikTipi === undefined || detayKisilikTipi === null) missingFields.push("Hukuki Yapı / Kişilik Tipi");

      if (missingFields.length > 0) {
        setMasakMissingFields(missingFields);
        setShowMasakMissingModal(true);
        return;
      }

      // Kaydederken limit aşıyorsa uyar: Yine de kaydedeyim mi vazgeçeyim mi
      if (!forceMasakApprove) {
        setShowMasakConfirmModal(true);
        return;
      }

      // Sınır aşıldığında MASAK sorgulamasını otomatik çalıştır
      try {
        const cleanName = isAnon ? "" : (unvan || detayUnvan || "").trim();
        const cleanId = (detayVergiKimlikNo || "").trim();
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
            showNotif("danger", `🚨 DİKKAT: "${cleanName || cleanId}" MASAK Malvarlığı Dondurulanlar Listesinde bulundu! İşlem kesinlikle engellendi.`);
            return;
          }
        }
      } catch (err) {
        console.error("Auto MASAK check error:", err);
      }
    }

    setIsSaving(true);
    try {
      const calculatedKdv = (Number(kdvOrani) || 0) * (Number(altinHasKuru) || 0) * totalIscilikHasGram / 100;
      const payload: SaveSarrafFisPayload = {
        sarrafFisiId: fisId,
        vezneId,
        cariKartId,
        tarih,
        saat: tarih + "T" + saat + ":00",
        fisNo: fisNo.trim() || null,
        seriNo: seriNo.trim() || null,
        belgeNo: fisNo.trim() || null,
        irsaliyeNo: fisNo.trim() || null,
        tip,
        altinHasKuru: Number(altinHasKuru) || 0,
        alisKuru: Number(alisKuru) || 0,
        satisKuru: Number(satisKuru) || 0,
        gumusHasKuru: Number(gumusHasKuru) || 0,
        kdvOrani: kdvOrani !== "" && !isNaN(Number(kdvOrani)) ? Number(kdvOrani) : null,
        kdv: parseFloat(calculatedKdv.toFixed(2)),
        belgeTuru,
        unvan: unvan || detayUnvan || null,
        kisilikTipi: detayKisilikTipi || null,
        vergiKimlikNo: detayVergiKimlikNo || null,
        babaAdi: detayBabaAdi || null,
        anneAdi: detayAnneAdi || null,
        adres: detayAdres || null,
        eposta: detayEposta || null,
        telefonNo: detayTelefonNo || null,
        dogumTarihi: detayDogumTarihi || null,
        dogumYeri: detayDogumYeri || null,
        kimlikSeriNo: detayKimlikSeriNo || null,
        pasaportNo: detayPasaportNo || null,
        kimlikBelgeTuru: detayKimlikBelgeTuru || null,
        kimlikGecerlilikTarihi: detayKimlikGecerlilikTarihi || null,
        vekilAdi: detayVekilAdi || null,
        vekilKimlikNo: detayVekilKimlikNo || null,
        masakListesindeVar: (masakResult.matches && masakResult.matches.length > 0) ? true : false,
        kullaniciId: Number(user?.id) || 1,
        yazdirilanBelgeTipi: 0,
        satirlar: validLines.map((l, i) => ({
          satirId: l.satirId ?? null,
          satirNo: i + 1,
          urunId: l.urunId,
          miktar: Number(l.miktar) || 0,
          milyem: Number(l.milyem) || 0,
          hasGram: Number(l.hasGram) || 0,
          adet: Number(l.adet) || 0,
          iscilikiMiktari: Number(l.iscilikiMiktari) || 0,
          iscilikHasGram: Number(l.iscilikHasGram) || 0,
          iscilikHesaplamaSekli: l.iscilikHesaplamaSekli !== undefined && l.iscilikHesaplamaSekli !== null && !isNaN(Number(l.iscilikHesaplamaSekli)) ? Number(l.iscilikHesaplamaSekli) : 0,
          aciklama: l.aciklama || null,
          kur: Number(l.kur) || 0,
          tutar: Number(l.tutar) || 0,
          urunTipi: l.urunTipi || 0,
          karat: l.karat && !isNaN(Number(l.karat)) ? Number(l.karat) : null,
        })),
        odemeSatirlari: odemeRows.filter((o) => Number(o.miktar) > 0 || Number(o.tutar) > 0 || Number(o.adet) > 0 || (o.paraId && o.paraId > 0)).map((o, i) => ({
          satirNo: i + 1,
          islemeYeri: 0,
          odemeAraciTuru: o.odemeAraciTuru || 0,
          paraId: o.paraId || null,
          adet: Number(o.adet) || 0,
          miktar: Number(o.miktar) > 0 ? Number(o.miktar) : (Number(o.adet) > 0 ? Number(o.adet) : 0),
          milyem: Number(o.milyem) || 0,
          hasGram: Number(o.hasGram) || 0,
          kur: Number(o.kur) || 1,
          tutar: Number(o.tutar) || 0,
        })),
      };
      const result = await SarrafFisService.saveFis(payload);
      showNotif("success", `Fiş ${result.yeniKayit ? "kaydedildi" : "güncellendi"} — ${result.fisNo || result.sarrafFisiId}${andPrint ? " (Yazıcıya gönderiliyor...)" : ""}`);
      if (andPrint) {
        setPrintSnapshot({
          fisId: result.sarrafFisiId,
          fisNo: result.fisNo || fisNo,
          seriNo: seriNo,
          belgeNo: fisNo,
          tip: tip,
          tarih: tarih,
          saat: saat,
          unvan: unvan || detayUnvan,
          vergiKimlikNo: detayVergiKimlikNo,
          detayIl: "",
          detayIlce: "",
          detayAdres: detayAdres,
          detayTelefonNo: detayTelefonNo,
          detayPasaportNo: detayPasaportNo,
          vezneKod: vezneKod,
          kullaniciAdi: user?.fullName || user?.username || "Kasiyer",
          satirlar: validLines.map((l, i) => ({
            satirNo: i + 1,
            urunKodu: l.urunKodu,
            urunAdi: l.urunAdi,
            adet: l.adet,
            miktar: l.miktar,
            milyem: l.milyem,
            hasGram: l.hasGram,
            iscilikiMiktari: l.iscilikiMiktari,
            iscilikHasGram: l.iscilikHasGram,
            iscilikHesaplamaSekli: l.iscilikHesaplamaSekli,
            kur: l.kur,
            tutar: l.tutar,
            aciklama: l.aciklama,
            urunTipi: l.urunTipi,
            karat: l.karat,
          })),
          odemeSatirlari: odemeRows.filter((o) => Number(o.miktar) > 0 || Number(o.tutar) > 0 || Number(o.adet) > 0 || (o.paraId && o.paraId > 0)).map((o, i) => ({
            satirNo: i + 1,
            odemeAraciTuru: o.odemeAraciTuru,
            paraKodu: o.paraKodu,
            paraAdi: o.paraAdi,
            adet: o.adet,
            miktar: o.miktar,
            milyem: o.milyem,
            hasGram: o.hasGram,
            kur: o.kur,
            tutar: o.tutar,
          })),
          toplamTutar: totalTutar,
          toplamHas: alisHas,
          odenenTutar: totalOdemeTutar,
          kalanTutar: farkTL,
        });
        setIsPendingDirectPrint(true);
        setShowPrintModal(true);
      }
      if (isDuzeltmeMode || fisId) {
        // Düzeltme modunda formu boşaltma, kaydedilen kaydı tekrar yükle
        await loadFisById(result.sarrafFisiId);
      } else {
        if (await ebFis.kaydedildi(result.sarrafFisiId)) return;
        // Kayıt sayfasında formu temizle ve yeni fişe geç
        resetForm();
      }
      const bak = await SarrafFisService.getVezneBakiye(vezneId).catch(() => bakiyeler);
      setBakiyeler(bak);
      const fl = await SarrafFisService.getFisList({ limit: 200 }).catch(() => fisList);
      setFisList(fl);
    } catch (e: any) {
      showNotif("danger", e?.message || "Kayıt hatası");
    } finally {
      setIsSaving(false);
    }
  }, [vezneId, fisId, fisNo, seriNo, tarih, saat, tip, belgeTuru, altinHasKuru, alisKuru, satisKuru,
    gumusHasKuru, kdvOrani, unvan, detayUnvan, detayKisilikTipi, detayVergiKimlikNo,
    detayBabaAdi, detayAnneAdi, detayAdres, detayEposta, detayTelefonNo, detayDogumTarihi,
    detayDogumYeri, detayKimlikSeriNo, detayPasaportNo, detayKimlikBelgeTuru,
    detayKimlikGecerlilikTarihi, detayVekilAdi, detayVekilKimlikNo,
    cariKartId, lines, odemeRows, user?.id, bakiyeler, fisList, resetForm, isDuzeltmeMode, loadFisById]);

  // Delete
  const handleDelete = useCallback(async () => {
    if (!fisId) return;
    try {
      await SarrafFisService.deleteFis(fisId, Number(user?.id) || 1);
      showNotif("success", "Fiş silindi");
      resetForm();
      setShowDeleteConfirm(false);
      const fl = await SarrafFisService.getFisList({ limit: 200 }).catch(() => []);
      setFisList(fl);
    } catch (e: any) {
      showNotif("danger", e?.message || "Silme hatası");
      setShowDeleteConfirm(false);
    }
  }, [fisId, user?.id, resetForm]);

  // Customer selection from MusteriSecimModal
  const handleSelectCustomer = useCallback((result: SelectedCustomerResult) => {
    const selectedName = (result.unvan || "").trim() || DEFAULT_CUSTOMER_NAME;
    setUnvan(selectedName);
    setDetayUnvan(selectedName);
    setCariKod(result.kod || ((result.raw as any)?.kod) || "");

    if (result.type === "registered") {
      setCariKartId(result.id);
    } else if (result.type === "unregistered") {
      setCariKartId(-result.id);
    } else {
      setCariKartId(null);
    }

    if (result.vergiKimlikNo) {
      setDetayVergiKimlikNo(result.vergiKimlikNo);
    }
    if (result.adres) {
      setDetayAdres(result.adres);
    }
    if (result.telefon) {
      setDetayTelefonNo(result.telefon);
    }

    const raw = result.raw as any;
    if (raw) {
      if (raw.kisilikTipi !== undefined && raw.kisilikTipi !== null) {
        setDetayKisilikTipi(Number(raw.kisilikTipi));
      }
      if (raw.vergiKimlikNo) setDetayVergiKimlikNo(raw.vergiKimlikNo);
      if (raw.babaAdi) setDetayBabaAdi(raw.babaAdi);
      if (raw.anneAdi) setDetayAnneAdi(raw.anneAdi);
      if (raw.adres) setDetayAdres(raw.adres);
      if (raw.eposta) setDetayEposta(raw.eposta);
      if (raw.telefon) setDetayTelefonNo(raw.telefon);
      if (raw.dogumTarihi) setDetayDogumTarihi(String(raw.dogumTarihi).split("T")[0]);
      if (raw.dogumYeri) setDetayDogumYeri(raw.dogumYeri);
      if (raw.kimlikSeriNo) setDetayKimlikSeriNo(raw.kimlikSeriNo);
      if (raw.pasaportNo) setDetayPasaportNo(raw.pasaportNo);
      if (raw.kimlikBelgeTuru !== undefined && raw.kimlikBelgeTuru !== null) {
        setDetayKimlikBelgeTuru(Number(raw.kimlikBelgeTuru));
      }
      if (raw.kimlikGecerlilikTarihi) {
        setDetayKimlikGecerlilikTarihi(String(raw.kimlikGecerlilikTarihi).split("T")[0]);
      }
      if (raw.vekilAdi) setDetayVekilAdi(raw.vekilAdi);
      if (raw.vekilKimlikNo) setDetayVekilKimlikNo(raw.vekilKimlikNo);

      // Cari kartta tanımlı istatistiği uygula
      const statId = tip === 0 ? raw.alisIstatistikId : raw.satisIstatistikId;
      if (statId && statisticList.length > 0) {
        const m = statisticList.find((s) => s.id === Number(statId));
        if (m) {
          setIstatistikId(m.id);
          setIstatistikKodu(m.kod);
        }
      }
    }

    setShowCariModal(false);

    // Müşteri seçildiğinde otomatik MASAK yaptırım / dondurulanlar kontrolü
    const selectedCustomerName = (result.unvan || "").trim();
    if (selectedCustomerName && !selectedCustomerName.toLocaleUpperCase("tr-TR").includes("BEYAN")) {
      handleSearchMasak(selectedCustomerName, result.vergiKimlikNo || (raw && raw.vergiKimlikNo) || undefined);
    } else {
      setMasakResult({ matches: [], searched: false });
    }
  }, [handleSearchMasak, isMasakLimitExceeded, tip, statisticList]);

  // Open F5 Detay Modal (syncing current Unvan if set)
  const openDetayModal = useCallback(() => {
    if (unvan && unvan !== DEFAULT_CUSTOMER_NAME && (!detayUnvan || detayUnvan === DEFAULT_CUSTOMER_NAME)) {
      setDetayUnvan(unvan);
    }
    setShowDetayModal(true);
  }, [unvan, detayUnvan]);

  // Detay save
  const handleSaveDetay = useCallback(async () => {
    if (!fisId) {
      // Just keep in state if fis is not yet saved to DB
      setUnvan(detayUnvan || DEFAULT_CUSTOMER_NAME);
      setShowDetayModal(false);
      return;
    }
    try {
      await SarrafFisService.saveDetay(fisId, {
        unvan: detayUnvan || null,
        kisilikTipi: detayKisilikTipi || null,
        vergiKimlikNo: detayVergiKimlikNo || null,
        babaAdi: detayBabaAdi || null,
        anneAdi: detayAnneAdi || null,
        adres: detayAdres || null,
        eposta: detayEposta || null,
        telefonNo: detayTelefonNo || null,
        dogumTarihi: detayDogumTarihi || null,
        dogumYeri: detayDogumYeri || null,
        kimlikSeriNo: detayKimlikSeriNo || null,
        pasaportNo: detayPasaportNo || null,
        kimlikBelgeTuru: detayKimlikBelgeTuru || null,
        kimlikGecerlilikTarihi: detayKimlikGecerlilikTarihi || null,
        vekilAdi: detayVekilAdi || null,
        vekilKimlikNo: detayVekilKimlikNo || null,
        kullaniciId: Number(user?.id) || 1,
      });
      setUnvan(detayUnvan || DEFAULT_CUSTOMER_NAME);
      showNotif("success", "Müşteri detayı kaydedildi");
      setShowDetayModal(false);
    } catch (e: any) {
      showNotif("danger", e?.message || "Detay kayıt hatası");
    }
  }, [fisId, detayUnvan, detayKisilikTipi, detayVergiKimlikNo, detayBabaAdi, detayAnneAdi,
    detayAdres, detayEposta, detayTelefonNo, detayDogumTarihi, detayDogumYeri,
    detayKimlikSeriNo, detayPasaportNo, detayKimlikBelgeTuru, detayKimlikGecerlilikTarihi,
    detayVekilAdi, detayVekilKimlikNo, user?.id]);

  // Helper: Ürün / Döviz / Maden için Güncel Alış/Satış Kurunu Çek
  const getKurForProduct = useCallback((
    urun: { paraId?: number; kod?: string; urunTipi?: number },
    islemTip: 0 | 1
  ): number => {
    const pId = urun.paraId;
    const code = (urun.kod || "").toUpperCase().trim();

    if (code === "TL" || code === "TRY") return 1;

    // 1. Önce kur listesinde bu ürünün/paranın birebir özel kuru var mı bak
    const found = kurSatirlar.find((k) => (pId && k.paraId === pId) || (k.kod && k.kod.toUpperCase().trim() === code));
    if (found) {
      const rate = islemTip === 0
        ? (found.dovizAlis ?? found.efektifAlis ?? 0)
        : (found.dovizSatis ?? found.efektifSatis ?? 0);
      if (rate > 0) return rate;
    }

    // 2. Ürün Tipi Altın ise (1)
    if (urun.urunTipi === 1) {
      if (Number(altinHasKuru) > 0) return Number(altinHasKuru);
      const hasKur = kurSatirlar.find((k) => ["HAS", "ALTIN", "HAS ALTIN", "HASALTIN"].includes((k.kod || "").toUpperCase().trim()));
      if (hasKur) {
        const rate = islemTip === 0 ? (hasKur.dovizAlis ?? hasKur.efektifAlis ?? 0) : (hasKur.dovizSatis ?? hasKur.efektifSatis ?? 0);
        if (rate > 0) return rate;
      }
    }
    // 3. Ürün Tipi Gümüş ise (2)
    else if (urun.urunTipi === 2) {
      if (Number(gumusHasKuru) > 0) return Number(gumusHasKuru);
      const gKur = kurSatirlar.find((k) => ["GUMUS", "GÜMÜŞ", "HAS GÜMÜŞ", "HAS GUMUS"].includes((k.kod || "").toUpperCase().trim()));
      if (gKur) {
        const rate = islemTip === 0 ? (gKur.dovizAlis ?? gKur.efektifAlis ?? 0) : (gKur.dovizSatis ?? gKur.efektifSatis ?? 0);
        if (rate > 0) return rate;
      }
    }
    // 4. Diğer / Döviz ise (0)
    else if (urun.urunTipi === 0) {
      const curKur = kurSatirlar.find((k) => (k.paraId && k.paraId === pId) || (k.kod && k.kod.toUpperCase().trim() === code));
      if (curKur) {
        const rate = islemTip === 0 ? (curKur.dovizAlis ?? curKur.efektifAlis ?? 0) : (curKur.dovizSatis ?? curKur.efektifSatis ?? 0);
        if (rate > 0) return rate;
      }
    }

    return Number(altinHasKuru) || 0;
  }, [kurSatirlar, altinHasKuru, gumusHasKuru]);

  // Ürün seçildiğinde veya kodu girildiğinde satırı otomatik doldurma & hesaplama yardımcısı
  const applyProductToRow = useCallback((
    rowId: string,
    item: UrunItem,
    overrideAdet?: number
  ) => {
    const autoKur = getKurForProduct(item, tip);
    const curHasKuru = autoKur > 0
      ? autoKur
      : (item.urunTipi === 1 ? (Number(altinHasKuru) || 0) : (item.urunTipi === 2 ? (Number(gumusHasKuru) || 0) : 0));

    setLines((prev) => prev.map((r) => {
      if (r.id !== rowId) return r;
      const rawHasOrani = item.hasOrani;
      const adet = overrideAdet !== undefined ? overrideAdet : (Number(r.adet) > 0 ? Number(r.adet) : 1);
      const miktar = Number(item.gramaj) > 0 ? Number(item.gramaj) * adet : (Number(r.miktar) > 0 ? Number(r.miktar) : "");
      const iscilikiMiktari = item.iscilik && Number(item.iscilik) > 0 ? Number(item.iscilik) : (r.iscilikiMiktari || "");
      const milyem = (rawHasOrani !== undefined && rawHasOrani !== null && Number(rawHasOrani) > 0)
        ? rawHasOrani
        : (r.milyem || "");

      const updated: GridRow = {
        ...r,
        urunId: item.paraId,
        urunKodu: item.kod,
        urunAdi: item.ad,
        adet,
        miktar,
        milyem,
        iscilikHesaplamaSekli: r.iscilikHesaplamaSekli !== undefined && r.iscilikHesaplamaSekli !== null ? r.iscilikHesaplamaSekli : 0,
        iscilikiMiktari,
        urunTipi: item.urunTipi || 0,
        kur: autoKur > 0 ? autoKur : (curHasKuru > 0 ? curHasKuru : (r.kur || "")),
      };
      return recomputeRow(updated, curHasKuru);
    }));
  }, [tip, getKurForProduct, altinHasKuru, gumusHasKuru]);

  const applyProductToOdemeRow = useCallback((
    rowId: string,
    item: UrunItem,
    overrideAdet?: number
  ) => {
    const autoKur = getKurForProduct(item, tip === 0 ? 1 : 0);
    const curHasKuru = Number(altinHasKuru) || 0;
    setOdemeRows((prev) => prev.map((r) => {
      if (r.id !== rowId) return r;
      const rawHasOrani = item.hasOrani;
      const adet = overrideAdet !== undefined ? overrideAdet : (Number(r.adet) > 0 ? Number(r.adet) : 1);
      const miktar = Number(item.gramaj) > 0 ? Number(item.gramaj) * adet : (Number(r.miktar) > 0 ? Number(r.miktar) : "");
      const milyem = (rawHasOrani !== undefined && rawHasOrani !== null && Number(rawHasOrani) > 0) ? rawHasOrani : (r.milyem || "");
      const updated: OdemeRow = {
        ...r,
        paraId: item.paraId,
        paraKodu: item.kod,
        paraAdi: item.ad,
        adet,
        miktar: Number(miktar) > 0 ? miktar : r.miktar,
        milyem,
        urunTipi: item.urunTipi || 0,
        kur: autoKur > 0 ? autoKur : (curHasKuru > 0 ? curHasKuru : (r.kur || 1)),
      };
      return recomputeOdemeRow(updated, curHasKuru);
    }));
  }, [tip, getKurForProduct, altinHasKuru]);

  // Sağ tıkla kalanı kapat fonksiyonu
  const handleKapatRow = useCallback((rowId: string) => {
    const otherPaidTL = odemeRows
      .filter((r) => r.id !== rowId)
      .reduce((s, r) => s + (parseDecimal(r.tutar) || 0), 0);
    const kalanTL = Math.max(0, parseFloat((totalTutar - otherPaidTL).toFixed(2)));
    const hasKuruVal = Number(altinHasKuru) || 0;

    setOdemeRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
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

        let rowKur = parseDecimal(r.kur);
        if (rowKur <= 0) {
          const found = urunList.find((u) => u.kod.trim().toLowerCase() === pk.toLowerCase());
          if (found) {
            const autoKur = getKurForProduct(found, tip === 0 ? 1 : 0);
            if (autoKur > 0) rowKur = autoKur;
          }
        }
        if (rowKur <= 0) rowKur = 1;

        if (r.urunTipi === 1 || r.urunTipi === 2 || parseDecimal(r.milyem) > 0) {
          // Maden / Altın / Gümüş
          const rawM = parseDecimal(r.milyem);
          const effM = rawM > 1 ? (rawM <= 100 ? rawM / 100 : rawM / 1000) : (rawM > 0 ? rawM : 1);
          const effKur = rowKur > 0 ? rowKur : (hasKuruVal > 0 ? hasKuruVal : 1);
          const hasVal = effKur > 0 && kalanTL > 0 ? parseFloat((kalanTL / effKur).toFixed(4)) : "";
          const miktarVal = effM > 0 && hasVal ? parseFloat((Number(hasVal) / effM).toFixed(4)) : (hasVal || "");
          return {
            ...r,
            tutar: kalanTL > 0 ? kalanTL : "",
            hasGram: hasVal,
            miktar: miktarVal,
            adet: 1,
            kur: rowKur,
          };
        } else {
          // Döviz (USD, EUR vs.)
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
        }
      })
    );
  }, [odemeRows, totalTutar, altinHasKuru, urunList, getKurForProduct, tip]);

  // Has Kuru change
  const handleAltinHasKuruChange = useCallback((val: string) => {
    const cleanVal = onlyDecimal(val);
    setAltinHasKuru(cleanVal);
    const newKur = Number(cleanVal) || 0;
    if (newKur > 0) {
      setLines((prev) => prev.map((r) => {
        const updated = { ...r, kur: newKur };
        return recomputeRow(updated, newKur);
      }));
      setOdemeRows((prev) => prev.map((r) => recomputeOdemeRow(r, newKur)));
    }
  }, []);

  // Row update
  const updateRow = useCallback((rowId: string, field: keyof GridRow, value: any) => {
    let sanitizedValue = value;
    if (field === "adet") {
      sanitizedValue = onlyDigits(String(value));
    } else if (
      field === "miktar" ||
      field === "milyem" ||
      field === "hasGram" ||
      field === "iscilikiMiktari" ||
      field === "iscilikHasGram" ||
      field === "kur" ||
      field === "tutar" ||
      field === "karat"
    ) {
      sanitizedValue = onlyDecimal(String(value));
    }

    const curHasKuru = Number(altinHasKuru) || 0;
    setLines((prev) => prev.map((r) => {
      if (r.id !== rowId) return r;

      let miktar = r.miktar;
      if (field === "adet") {
        const numAdet = Number(sanitizedValue) || 0;
        const found = urunList.find((u) => u.kod.trim().toLowerCase() === (r.urunKodu || "").trim().toLowerCase());
        if (found && Number(found.gramaj) > 0 && numAdet > 0) {
          miktar = Number(found.gramaj) * numAdet;
        }
      }

      const updated = {
        ...r,
        miktar,
        [field]: sanitizedValue
      };
      return recomputeRow(updated, curHasKuru, field);
    }));
  }, [altinHasKuru, urunList]);

  const updateOdemeRow = useCallback((rowId: string, field: keyof OdemeRow, value: any) => {
    let sanitizedValue = value;
    if (field === "adet") {
      sanitizedValue = onlyDigits(String(value));
    } else if (
      field === "miktar" ||
      field === "milyem" ||
      field === "hasGram" ||
      field === "kur" ||
      field === "tutar"
    ) {
      sanitizedValue = onlyDecimal(String(value));
    }

    const curHasKuru = Number(altinHasKuru) || 0;
    setOdemeRows((prev) => prev.map((r) => {
      if (r.id !== rowId) return r;
      let miktar = r.miktar;
      if (field === "adet") {
        const numAdet = Number(sanitizedValue) || 0;
        const found = urunList.find((u) => u.kod.trim().toLowerCase() === (r.paraKodu || "").trim().toLowerCase());
        if (found && Number(found.gramaj) > 0 && numAdet > 0) {
          miktar = Number(found.gramaj) * numAdet;
        } else if (numAdet > 0 && (!miktar || Number(miktar) === 0)) {
          miktar = numAdet;
        }
      }
      const u = { ...r, miktar, [field]: sanitizedValue };
      return recomputeOdemeRow(u, curHasKuru, field);
    }));
  }, [altinHasKuru, urunList]);

  const handleDeleteLine = useCallback((rowId: string) => {
    setLines((prev) => {
      if (prev.length <= 1) {
        return [createEmptyRow(1)];
      }
      const filtered = prev.filter((r) => r.id !== rowId);
      return filtered.map((r, idx) => ({ ...r, satirNo: idx + 1 }));
    });
  }, []);

  const handleDeleteOdemeRow = useCallback((rowId: string) => {
    setOdemeRows((prev) => {
      if (prev.length <= 1) {
        return [createEmptyOdemeRow(1)];
      }
      const filtered = prev.filter((r) => r.id !== rowId);
      return filtered.map((r, idx) => ({ ...r, satirNo: idx + 1 }));
    });
  }, []);

  // Sağ tık menüsü eylemleri (Kalanı Kapat, Satırı Sil & Yeni Satır Ekle - Her iki tablo için duyarlı)
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

      if (tableType === "odeme" || odemeRows.some((o) => o.id === rowId)) {
        handleDeleteOdemeRow(rowId);
      } else {
        handleDeleteLine(rowId);
      }
    };

    const handleGridAdd = (e: any) => {
      const tableType = e.detail?.tableType;
      const rowId = e.detail?.rowId;

      if (tableType === "odeme" || (rowId && odemeRows.some((o) => o.id === rowId))) {
        setOdemeRows((prev) => [...prev, createEmptyOdemeRow(prev.length + 1)]);
      } else {
        setLines((prev) => [...prev, createEmptyRow(prev.length + 1)]);
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
  }, [handleDeleteLine, handleDeleteOdemeRow, handleKapatRow, odemeRows]);

  // Bildirimlerin belli süre sonra otomatik kaybolması
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Open product modal with eager data fetch if empty
  const openUrunModal = useCallback(async (rowId: string, initialSearch?: string) => {
    activeRowIdForUrunRef.current = rowId;
    activeOdemeRowIdForUrunRef.current = null;
    setActiveRowIdForUrun(rowId);
    setActiveOdemeRowIdForUrun(null);
    setUrunSearchTerm(initialSearch !== undefined ? initialSearch : "");
    setShowUrunModal(true);
    if (urunList.length === 0) {
      setIsUrunLoading(true);
      try {
        const u = await SarrafFisService.getUrunler();
        if (u && u.length > 0) {
          setUrunList(u);
        }
      } catch (err) {
        console.error("Error fetching products on modal open:", err);
      } finally {
        setIsUrunLoading(false);
      }
    }
  }, [urunList.length]);

  const openOdemeUrunModal = useCallback(async (rowId: string, initialSearch?: string) => {
    activeOdemeRowIdForUrunRef.current = rowId;
    activeRowIdForUrunRef.current = null;
    setActiveOdemeRowIdForUrun(rowId);
    setActiveRowIdForUrun(null);
    setUrunSearchTerm(initialSearch !== undefined ? initialSearch : "");
    setShowUrunModal(true);
    if (urunList.length === 0) {
      setIsUrunLoading(true);
      try {
        const u = await SarrafFisService.getUrunler();
        if (u && u.length > 0) {
          setUrunList(u);
        }
      } catch (err) {
        console.error("Error fetching products on modal open:", err);
      } finally {
        setIsUrunLoading(false);
      }
    }
  }, [urunList.length]);

  // ─── Safe selection bounds helper (prevents DOMException on date/time/number inputs) ──
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
    } catch (err) { }
    return { isAtStart: true, isAtEnd: true };
  };

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

  // ─── Keyboard Navigation: Header Fields ──────────────────────────────────────
  const handleHeaderKeyDown = (
    e: React.KeyboardEvent<any>,
    field: "islem" | "tckn" | "kodu" | "ad" | "zamanTarih" | "zamanSaat" | "seriNo" | "belgeNo" | "istatistik" | "hasKuru" | "kdvOrani"
  ) => {
    const { isAtStart, isAtEnd } = getSelectionBounds(e.currentTarget);

    if (e.key === "Enter") {
      e.preventDefault();
      if (field === "islem") {
        tcknRef.current?.focus();
      } else if (field === "tckn") {
        const term = (detayVergiKimlikNo || "").trim();
        setCariSearchTerm(term);
        setShowCariModal(true);
      } else if (field === "kodu") {
        const term = (cariKod || "").trim();
        setCariSearchTerm(term);
        setShowCariModal(true);
      } else if (field === "ad") {
        const raw = (unvan || "").trim();
        const term = (raw === DEFAULT_CUSTOMER_NAME || raw.toUpperCase() === "İSİM BEYAN EDİLMEMİŞTİR" || raw.toUpperCase() === "ISIM BEYAN EDILMEMISTIR") ? "" : raw;
        setCariSearchTerm(term);
        setShowCariModal(true);
      } else if (field === "zamanTarih") {
        zamanSaatRef.current?.focus();
      } else if (field === "zamanSaat") {
        seriNoRef.current?.focus();
      } else if (field === "seriNo") {
        belgeNoRef.current?.focus();
      } else if (field === "belgeNo") {
        istatistikRef.current?.focus();
      } else if (field === "istatistik") {
        const term = (istatistikKodu || "").trim();
        setIstatistikSearchTerm(term);
        setShowIstatistikModal(true);
      } else if (field === "hasKuru") {
        kdvOraniRef.current?.focus();
      } else if (field === "kdvOrani") {
        if (lines.length > 0) {
          setActiveRowIndex(0);
          focusGridCell(lines[0].id, "urunKodu", "select");
        }
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (field === "islem" || field === "tckn") zamanTarihRef.current?.focus();
      else if (field === "kodu") seriNoRef.current?.focus();
      else if (field === "ad") istatistikRef.current?.focus();
      else if (["zamanTarih", "zamanSaat", "seriNo", "belgeNo", "istatistik", "hasKuru", "kdvOrani"].includes(field)) {
        if (lines.length > 0) {
          setActiveRowIndex(0);
          focusGridCell(lines[0].id, "urunKodu", "select");
        }
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (field === "zamanTarih" || field === "zamanSaat") islemRef.current?.focus();
      else if (field === "seriNo" || field === "belgeNo") cariKodRef.current?.focus();
      else if (field === "istatistik" || field === "hasKuru" || field === "kdvOrani") adRef.current?.focus();
    } else if (e.key === "ArrowRight") {
      if (isAtEnd) {
        e.preventDefault();
        if (field === "islem") tcknRef.current?.focus();
        else if (field === "tckn") cariKodRef.current?.focus();
        else if (field === "kodu") adRef.current?.focus();
        else if (field === "ad") zamanTarihRef.current?.focus();
        else if (field === "zamanTarih") zamanSaatRef.current?.focus();
        else if (field === "zamanSaat") seriNoRef.current?.focus();
        else if (field === "seriNo") belgeNoRef.current?.focus();
        else if (field === "belgeNo") istatistikRef.current?.focus();
        else if (field === "istatistik") hasKuruRef.current?.focus();
        else if (field === "hasKuru") kdvOraniRef.current?.focus();
        else if (field === "kdvOrani") {
          if (lines.length > 0) {
            setActiveRowIndex(0);
            focusGridCell(lines[0].id, "urunKodu", "select");
          }
        }
      }
    } else if (e.key === "ArrowLeft") {
      if (isAtStart) {
        e.preventDefault();
        if (field === "tckn") islemRef.current?.focus();
        else if (field === "kodu") tcknRef.current?.focus();
        else if (field === "ad") cariKodRef.current?.focus();
        else if (field === "zamanTarih") adRef.current?.focus();
        else if (field === "zamanSaat") zamanTarihRef.current?.focus();
        else if (field === "seriNo") zamanSaatRef.current?.focus();
        else if (field === "belgeNo") seriNoRef.current?.focus();
        else if (field === "istatistik") belgeNoRef.current?.focus();
        else if (field === "hasKuru") istatistikRef.current?.focus();
        else if (field === "kdvOrani") hasKuruRef.current?.focus();
      }
    }
  };

  // ─── Keyboard Navigation: Grid ───────────────────────────────────────────────
  const handleGridKeyDown = useCallback((
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
      // On urunKodu, try to resolve product or open lookup with typed text
      if (colKey === "urunKodu") {
        const row = lines[rowIndex];
        const val = (row.urunKodu || "").trim();
        if (!val) {
          openUrunModal(rowId, "");
          return;
        }
        const found = urunList.find((u) => u.kod.trim().toLowerCase() === val.toLowerCase());
        if (found) {
          applyProductToRow(rowId, found);
          setTimeout(() => focusGridCell(rowId, "adet", "select"), 20);
          return;
        } else {
          openUrunModal(rowId, val);
          return;
        }
      }

      // Next column in same row
      if (colIdx + 1 < totalCols) {
        const nk = GRID_COLS[colIdx + 1];
        focusGridCell(rowId, nk, "select");
      } else {
        // Last column in row -> automatic new row only if current row has data
        if (rowIndex < lines.length - 1) {
          const nr = lines[rowIndex + 1];
          setActiveRowIndex(rowIndex + 1);
          focusGridCell(nr.id, "urunKodu", "select");
        } else {
          const cur = lines[rowIndex];
          if (cur && ((cur.urunKodu && cur.urunKodu.trim() !== "") || parseDecimal(cur.miktar) > 0 || parseDecimal(cur.tutar) > 0)) {
            const newRow = createEmptyRow(lines.length + 1);
            setLines((prev) => [...prev, newRow]);
            setActiveRowIndex(rowIndex + 1);
            setTimeout(() => focusGridCell(newRow.id, "urunKodu", "select"), 30);
          }
        }
      }
    } else if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault();
      if (colIdx > 0) {
        const pk = GRID_COLS[colIdx - 1];
        focusGridCell(rowId, pk, "select");
      } else if (rowIndex > 0) {
        const pr = lines[rowIndex - 1];
        setActiveRowIndex(rowIndex - 1);
        focusGridCell(pr.id, GRID_COLS[totalCols - 1], "select");
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (rowIndex < lines.length - 1) {
        const nr = lines[rowIndex + 1];
        setActiveRowIndex(rowIndex + 1);
        focusGridCell(nr.id, colKey, "select");
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (rowIndex > 0) {
        const pr = lines[rowIndex - 1];
        setActiveRowIndex(rowIndex - 1);
        focusGridCell(pr.id, colKey, "select");
      } else {
        // Jump back to header
        if (colIdx < 4) adRef.current?.focus();
        else belgeNoRef.current?.focus();
      }
    } else if (e.key === "ArrowRight") {
      if (isAtEnd) {
        e.preventDefault();
        if (colIdx + 1 < totalCols) {
          const nk = GRID_COLS[colIdx + 1];
          focusGridCell(rowId, nk, "start");
        } else if (rowIndex < lines.length - 1) {
          const nr = lines[rowIndex + 1];
          setActiveRowIndex(rowIndex + 1);
          focusGridCell(nr.id, "urunKodu", "start");
        }
      }
    } else if (e.key === "ArrowLeft") {
      if (isAtStart) {
        e.preventDefault();
        if (colIdx > 0) {
          const pk = GRID_COLS[colIdx - 1];
          focusGridCell(rowId, pk, "end");
        } else if (rowIndex > 0) {
          const pr = lines[rowIndex - 1];
          setActiveRowIndex(rowIndex - 1);
          focusGridCell(pr.id, GRID_COLS[totalCols - 1], "end");
        }
      }
    }
  }, [lines, urunList, updateRow, altinHasKuru, applyProductToRow, openUrunModal]);

  const focusOdemeGridCell = (
    rowId: string,
    field: OdemeColKey,
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

  const handleOdemeGridKeyDown = useCallback((
    e: React.KeyboardEvent<HTMLElement>,
    rowIndex: number,
    colKey: OdemeColKey,
    rowId: string
  ) => {
    const colIdx = ODEME_COLS.indexOf(colKey);
    const totalCols = ODEME_COLS.length;
    const { isAtStart, isAtEnd } = getSelectionBounds(e.currentTarget);

    if (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) {
      e.preventDefault();
      if (colKey === "paraKodu") {
        const row = odemeRows[rowIndex];
        const val = (row.paraKodu || "").trim();
        if (!val) {
          openOdemeUrunModal(rowId, "");
          return;
        }
        const found = urunList.find((u) => u.kod.trim().toLowerCase() === val.toLowerCase());
        if (found) {
          const autoKur = getKurForProduct(found, tip === 0 ? 1 : 0);
          const curHasKuru = Number(altinHasKuru) || 0;
          setOdemeRows((prev) => prev.map((r) => {
            if (r.id !== rowId) return r;
            const rawHasOrani = found.hasOrani;
            const adet = Number(r.adet) || 1;
            const miktar = Number(found.gramaj) > 0 ? Number(found.gramaj) * adet : (Number(r.miktar) || 0);
            const milyem = (rawHasOrani !== undefined && rawHasOrani !== null) ? rawHasOrani : (r.milyem || "");
            const updated: OdemeRow = {
              ...r,
              paraId: found.paraId,
              paraKodu: found.kod,
              paraAdi: found.ad,
              adet,
              miktar: miktar > 0 ? miktar : r.miktar,
              milyem,
              urunTipi: found.urunTipi || 0,
              kur: autoKur > 0 ? autoKur : (r.kur || 1),
            };
            return recomputeOdemeRow(updated, curHasKuru);
          }));
          setTimeout(() => focusOdemeGridCell(rowId, "adet", "select"), 20);
          return;
        } else if (val.toUpperCase() === "TL" || val.toUpperCase() === "TRY") {
          setOdemeRows((prev) => prev.map((r) => {
            if (r.id !== rowId) return r;
            return {
              ...r,
              paraId: null,
              paraKodu: "TL",
              paraAdi: "TÜRK LİRASI",
              kur: 1,
              milyem: "",
            };
          }));
          setTimeout(() => focusOdemeGridCell(rowId, "tutar", "select"), 20);
          return;
        } else {
          openOdemeUrunModal(rowId, val);
          return;
        }
      }

      // Next column in same row
      if (colIdx + 1 < totalCols) {
        const nk = ODEME_COLS[colIdx + 1];
        focusOdemeGridCell(rowId, nk, "select");
      } else {
        if (rowIndex < odemeRows.length - 1) {
          const nr = odemeRows[rowIndex + 1];
          setActiveOdemeRowIndex(rowIndex + 1);
          focusOdemeGridCell(nr.id, "paraKodu", "select");
        } else {
          const cur = odemeRows[rowIndex];
          if (cur && ((cur.paraKodu && cur.paraKodu.trim() !== "") || parseDecimal(cur.miktar) > 0 || parseDecimal(cur.tutar) > 0)) {
            const newRow = createEmptyOdemeRow(odemeRows.length + 1);
            setOdemeRows((prev) => [...prev, newRow]);
            setActiveOdemeRowIndex(rowIndex + 1);
            setTimeout(() => focusOdemeGridCell(newRow.id, "paraKodu", "select"), 30);
          }
        }
      }
    } else if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault();
      if (colIdx > 0) {
        const pk = ODEME_COLS[colIdx - 1];
        focusOdemeGridCell(rowId, pk, "select");
      } else if (rowIndex > 0) {
        const pr = odemeRows[rowIndex - 1];
        setActiveOdemeRowIndex(rowIndex - 1);
        focusOdemeGridCell(pr.id, ODEME_COLS[totalCols - 1], "select");
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
  }, [odemeRows, urunList, tip, altinHasKuru, openOdemeUrunModal]);

  // ─── Keyboard Navigation: Detay Modal ─────────────────────────────────────────
  const handleDetayKeyDown = (
    e: React.KeyboardEvent<any>,
    fieldName: typeof DETAY_FIELDS[number]
  ) => {
    const idx = DETAY_FIELDS.indexOf(fieldName);
    const { isAtStart, isAtEnd } = getSelectionBounds(e.currentTarget);

    if (e.key === "Enter") {
      e.preventDefault();
      if (idx + 1 < DETAY_FIELDS.length) {
        detayRefs.current[DETAY_FIELDS[idx + 1]]?.focus();
      } else {
        handleSaveDetay();
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (idx + 1 < DETAY_FIELDS.length) {
        detayRefs.current[DETAY_FIELDS[idx + 1]]?.focus();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (idx > 0) {
        detayRefs.current[DETAY_FIELDS[idx - 1]]?.focus();
      }
    } else if (e.key === "ArrowRight") {
      if (isAtEnd && idx + 1 < DETAY_FIELDS.length) {
        e.preventDefault();
        detayRefs.current[DETAY_FIELDS[idx + 1]]?.focus();
      }
    } else if (e.key === "ArrowLeft") {
      if (isAtStart && idx > 0) {
        e.preventDefault();
        detayRefs.current[DETAY_FIELDS[idx - 1]]?.focus();
      }
    }
  };

  // ─── Global F-key shortcuts ──────────────────────────────────────────────────
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (showPrintModal) return;
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName) &&
        !["F1", "F3", "F4", "F8", "F10"].includes(e.key)) {
        return;
      }
      if (e.key === "F1") { e.preventDefault(); handleSave(false, false); }
      else if (e.key === "F3") { e.preventDefault(); setShowIstatistikModal(true); }
      else if (e.key === "F4") { e.preventDefault(); handleNew(); }
      else if (e.key === "F8") { e.preventDefault(); openDetayModal(); }
      else if (e.key === "F10") { e.preventDefault(); handleSave(false, true); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [handleSave, handleNew, openDetayModal, showPrintModal]);

  // LookupModal columns
  const fisColumns: LookupColumn<SarrafFisListItem>[] = [
    { header: "Belge No", render: (i) => i.fisNo },
    { header: "Tarih", render: (i) => i.tarih, width: "100px" },
    { header: "Tip", render: (i) => <Badge bg={i.tip === 0 ? "primary" : "success"}>{i.tipLabel}</Badge>, width: "60px" },
    { header: "Müşteri", render: (i) => i.unvan },
    { header: "Has Kur", render: (i) => i.altinHasKuru?.toLocaleString("tr-TR"), width: "90px", align: "right" },
  ];

  const vezneColumns: LookupColumn<VezneItem>[] = [
    { header: "Kod", render: (i) => i.kod, width: "80px" },
    { header: "Ad", render: (i) => i.ad },
  ];

  const urunColumns: LookupColumn<UrunItem>[] = [
    { header: "Kod", render: (i) => i.kod, width: "80px" },
    { header: "Ad", render: (i) => i.ad },
    { header: "Has Oranı", render: (i) => i.hasOrani?.toString() || "", width: "90px", align: "right" },
    { header: "Birim", render: (i) => i.birim?.toString() || "", width: "60px" },
  ];

  const fmtBakiye = (kod: string) => {
    const b = bakiyeler.find((item) => item.paraKodu === kod || item.paraKodu === (kod === "TL" ? "TRY" : kod));
    return (b?.miktar || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  const displayTitle = isPerakende
    ? (isDuzeltmeMode ? "D- Perakende Fişi Düzeltme" : "C- Perakende Fişi Kayıt")
    : isDuzeltmeMode
      ? "B- Sarraf Fişi Düzeltme"
      : "A- Sarraf Fişi Kayıt";

  // e-Banka mutabakatından "Fiş kes" ile gelindiyse cari / tarih / yön dolu açılır
  const ebFis = useEBankaFisKesimi("sarraf", cariList.length > 0 && !isDuzeltmeMode && !queryId, (b) => {
    setTip(b.tip);
    const hasKurItem = kurSatirlar.find((k) => ["HAS", "ALTIN", "HAS ALTIN"].includes((k.kod || "").toUpperCase().trim()));
    const rate = hasKurItem ? ((hasKurItem.dovizAlis ?? hasKurItem.efektifAlis ?? hasKurItem.dovizSatis ?? hasKurItem.efektifSatis) || 0) : 0;
    if (rate > 0) setAltinHasKuru(rate);
    const gumusKurItem = kurSatirlar.find((k) => ["GUMUS", "GÜMÜŞ", "HAS GÜMÜŞ"].includes((k.kod || "").toUpperCase().trim()));
    const gRate = gumusKurItem ? ((gumusKurItem.dovizAlis ?? gumusKurItem.efektifAlis ?? gumusKurItem.dovizSatis ?? gumusKurItem.efektifSatis) || 0) : 0;
    if (gRate > 0) setGumusHasKuru(gRate);
    if (b.musteri) handleSelectCustomer(b.musteri);
    setTarih(b.tarih);
  });

  return (
    <div className="sarraf-fisi-page w-100 pb-3" style={{ fontFamily: "'Segoe UI', sans-serif", fontSize: "12.5px" }}>
      {ebFis.bant}
      <ERPToolbar
        disableShortcuts
        pageTitle={
          <span style={{ fontWeight: 700, fontSize: "14px" }}>
            {displayTitle}{" "}
            <Badge bg={tip === 0 ? "primary" : "success"} style={{ fontSize: "11px" }}>
              {tip === 0 ? "ALIŞ" : "SATIŞ"}
            </Badge>
          </span>
        }
        onNew={handleNew}
        onSave={() => handleSave(false, false)}
        onSearch={isDuzeltmeMode ? handleOpenFisModal : undefined}
        onDetailSearch={openDetayModal}
        onDelete={isDuzeltmeMode && fisId ? () => setShowDeleteConfirm(true) : undefined}
        hideSearch={!isDuzeltmeMode}
        hideDelete={!isDuzeltmeMode || !fisId}
        hideNavigation={!isDuzeltmeMode}
        onFirst={isDuzeltmeMode ? handleFirst : undefined}
        onPrev={isDuzeltmeMode ? handlePrev : undefined}
        onNext={isDuzeltmeMode ? handleNext : undefined}
        onLast={isDuzeltmeMode ? handleLast : undefined}
        onRefresh={handleRefresh}
        onPrint={() => handleSave(false, true)}
        centerContent={undefined}
        rightContent={
          <div className="d-flex align-items-center gap-2 text-nowrap">
            {/* Vezne Bakiyeleri: sağ tarafta, veznenin solunda, dış kenarlıksız */}
            <div
              className="d-flex align-items-center gap-2 font-monospace"
              style={{ fontSize: "11px" }}
            >
              <span className="text-muted" style={{ fontSize: "10.5px" }}>TL:</span> <strong className="text-dark" style={{ fontSize: "11px" }}>{fmtBakiye("TL")}</strong>
              <span className="text-muted ms-1" style={{ fontSize: "10.5px" }}>USD:</span> <strong className="text-dark" style={{ fontSize: "11px" }}>{fmtBakiye("USD")}</strong>
              <span className="text-muted ms-1" style={{ fontSize: "10.5px" }}>EUR:</span> <strong className="text-dark" style={{ fontSize: "11px" }}>{fmtBakiye("EUR")}</strong>
            </div>

            <div
              className="d-flex align-items-center gap-1 px-2 py-0.5 rounded border bg-white shadow-2xs font-monospace"
              style={{ fontSize: "11px" }}
            >
              <span className="text-primary fw-bold" style={{ fontSize: "10.5px" }}>VEZNE:</span>
              <strong className="text-dark" style={{ fontSize: "11px" }}>{vezneKod || "01"}</strong>
            </div>

            <Button
              variant="outline-success"
              size="sm"
              className="py-1 px-2 fw-semibold d-flex align-items-center gap-1"
              style={{ fontSize: "11px" }}
              onClick={() => handleSave(false, true)}
              title="Kaydet & Yazdır (F10)"
            >
              <IconPrinter size={15} />
              <span>Kaydet & Yazdır (F10)</span>
            </Button>
          </div>
        }
      />

      {/* Sağ altta beliren ve 3.5 sn sonra yok olan bildirim */}
      {notification && (
        <div className="erp-toast-container">
          <Alert variant={notification.type} className="erp-toast-item py-2 px-3 mb-0 border-0 shadow small" dismissible onClose={() => setNotification(null)}>
            {notification.message}
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

      <Card
        className={`shadow-sm mb-2 ${isMasakBlocked ? "border-2 border-danger" : ""}`}
        style={isMasakBlocked ? { boxShadow: "0 0 0 4px rgba(220, 53, 69, 0.4)", backgroundColor: "#fff5f5" } : {}}
      >
        <Card.Body className="p-2">
          {/* ─── Header Form: 2 Düzenli Satır ─────────────────────────────────── */}

          {/* 1. Satır: İşlem | TC/VKN (+Dürbün +MASAK) | Cari Kodu | Adı (+Dürbün +MASAK) | Zaman (En Sağda) */}
          <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
            {/* İşlem */}
            <div className="d-flex align-items-center gap-1">
              <label style={{ width: 40, minWidth: 40, fontSize: "12px", fontWeight: 600 }} className="mb-0 text-secondary">İşlem</label>
              <Form.Select
                ref={islemRef}
                size="sm"
                value={tip}
                onChange={(e) => {
                  const newTip = Number(e.target.value) as 0 | 1;
                  setTip(newTip);
                  if (!isDuzeltmeMode || !fisId) {
                    const defStat = getDefaultStatistic(newTip);
                    if (defStat) {
                      setIstatistikId(defStat.id);
                      setIstatistikKodu(defStat.kod);
                    }
                  }
                  const currentHasKuru = Number(altinHasKuru) || 0;
                  setLines((prev) => prev.map((r) => {
                    if (!r.urunKodu) return r;
                    const found = urunList.find((u) => u.kod.trim().toLowerCase() === r.urunKodu.trim().toLowerCase()) || { paraId: r.urunId, kod: r.urunKodu, urunTipi: r.urunTipi };
                    const autoKur = getKurForProduct(found, newTip);
                    const updated = { ...r, kur: autoKur > 0 ? autoKur : r.kur };
                    return recomputeRow(updated, autoKur);
                  }));
                  setOdemeRows((prev) => prev.map((r) => {
                    if (!r.paraKodu || r.paraKodu === "TL") return r;
                    const found = urunList.find((u) => u.kod.trim().toLowerCase() === r.paraKodu.trim().toLowerCase()) || { paraId: r.paraId, kod: r.paraKodu, urunTipi: r.urunTipi };
                    const autoKur = getKurForProduct(found, newTip === 0 ? 1 : 0);
                    const updated = { ...r, kur: autoKur > 0 ? autoKur : r.kur };
                    return recomputeOdemeRow(updated, currentHasKuru);
                  }));
                }}
                onKeyDown={(e) => handleHeaderKeyDown(e, "islem")}
                className="fw-bold"
                style={{ width: "95px", color: tip === 0 ? "#0d6efd" : "#198754" }}
              >
                <option value={0}>ALIŞ</option>
                <option value={1}>SATIŞ</option>
              </Form.Select>
            </div>

            {/* TC / VKN / Pasaport (+ Dürbün + MASAK) */}
            <div className="d-flex align-items-center gap-1">
              <label style={{ width: detayKimlikBelgeTuru === 1 ? 75 : 55, minWidth: detayKimlikBelgeTuru === 1 ? 75 : 55, fontSize: "12px", fontWeight: 600 }} className="mb-0 text-secondary">
                {detayKimlikBelgeTuru === 1 ? "Pasaport No" : "TC / VKN"}
              </label>
              <InputGroup size="sm" style={{ width: "190px" }}>
                <Form.Control
                  ref={tcknRef}
                  size="sm"
                  maxLength={detayKimlikBelgeTuru === 1 ? 20 : 11}
                  value={detayKimlikBelgeTuru === 1 ? detayPasaportNo : detayVergiKimlikNo}
                  onChange={(e) => {
                    if (detayKimlikBelgeTuru === 1) {
                      setDetayPasaportNo(e.target.value);
                    } else {
                      const val = onlyDigits(e.target.value).slice(0, 11);
                      setDetayVergiKimlikNo(val);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (detayKimlikBelgeTuru !== 1) blockNonNumericKeys(e);
                    handleHeaderKeyDown(e, "tckn");
                  }}
                  className="font-monospace"
                  title={detayKimlikBelgeTuru === 1 ? "Pasaport Numarası" : "T.C. Kimlik / Vergi Kimlik No (11 hane)"}
                />
                <Button
                  type="button"
                  tabIndex={-1}
                  variant="outline-secondary"
                  className="px-2 py-0 d-flex align-items-center"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const term = (detayKimlikBelgeTuru === 1 ? detayPasaportNo : detayVergiKimlikNo).trim();
                    setCariSearchTerm(term);
                    setShowCariModal(true);
                    if (cariList.length === 0) {
                      CariService.getCariKartlar().then((r) => setCariList(r || [])).catch(() => { });
                      DovizFisService.getKayitsizMusteriler().then((r) => setKayitsizMusteriList(r || [])).catch(() => { });
                    }
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const term = (detayKimlikBelgeTuru === 1 ? detayPasaportNo : detayVergiKimlikNo).trim();
                    setCariSearchTerm(term);
                    setShowCariModal(true);
                    if (cariList.length === 0) {
                      CariService.getCariKartlar().then((r) => setCariList(r || [])).catch(() => { });
                      DovizFisService.getKayitsizMusteriler().then((r) => setKayitsizMusteriList(r || [])).catch(() => { });
                    }
                  }}
                  title={detayKimlikBelgeTuru === 1 ? "Pasaport No ile Cari / Müşteri Ara ve Seç" : "TC / VKN ile Cari / Müşteri Ara ve Seç"}
                >
                  <IconBinoculars size={14} />
                </Button>
                <Button
                  variant="outline-danger"
                  className="px-2 py-0 d-flex align-items-center justify-content-center gap-1"
                  style={{ fontSize: "11px", fontWeight: 600 }}
                  onClick={() => handleSearchMasak(unvan, detayKimlikBelgeTuru === 1 ? detayPasaportNo : detayVergiKimlikNo)}
                  disabled={isSearchingMasak}
                  title="MASAK Listelerinde Sorgula"
                >
                  {isSearchingMasak ? <Spinner animation="border" size="sm" /> : <IconShieldExclamation size={14} color="#dc2626" />}
                </Button>
              </InputGroup>
            </div>

            {/* Cari Kodu */}
            <div className="d-flex align-items-center gap-1">
              <label style={{ width: 60, minWidth: 60, fontSize: "12px", fontWeight: 600 }} className="mb-0 text-secondary">Cari Kodu</label>
              <InputGroup size="sm" style={{ width: "135px" }}>
                <Form.Control
                  ref={cariKodRef}
                  size="sm"
                  value={cariKod}
                  onChange={(e) => setCariKod(e.target.value)}
                  onKeyDown={(e) => handleHeaderKeyDown(e, "kodu")}
                  className="font-monospace"
                />
                <Button
                  type="button"
                  tabIndex={-1}
                  variant="outline-secondary"
                  className="px-2 py-0 d-flex align-items-center"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setCariSearchTerm((cariKod || "").trim());
                    setShowCariModal(true);
                    if (cariList.length === 0) {
                      CariService.getCariKartlar().then((r) => setCariList(r || [])).catch(() => { });
                      DovizFisService.getKayitsizMusteriler().then((r) => setKayitsizMusteriList(r || [])).catch(() => { });
                    }
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setCariSearchTerm((cariKod || "").trim());
                    setShowCariModal(true);
                    if (cariList.length === 0) {
                      CariService.getCariKartlar().then((r) => setCariList(r || [])).catch(() => { });
                      DovizFisService.getKayitsizMusteriler().then((r) => setKayitsizMusteriList(r || [])).catch(() => { });
                    }
                  }}
                  title="Cari / Müşteri Seç"
                >
                  <IconBinoculars size={14} />
                </Button>
              </InputGroup>
            </div>

            {/* Adı (+ Dürbün + MASAK) */}
            <div className="d-flex align-items-center gap-1">
              <label style={{ width: 30, minWidth: 30, fontSize: "12px", fontWeight: 600 }} className="mb-0 text-secondary">Adı</label>
              <InputGroup size="sm" style={{ width: "240px", maxWidth: "260px" }}>
                <Form.Control
                  ref={adRef}
                  value={unvan}
                  onChange={(e) => {
                    setUnvan(e.target.value);
                    if (cariKartId) setCariKartId(null);
                  }}
                  onBlur={() => {
                    if (!unvan || !unvan.trim()) {
                      setUnvan(DEFAULT_CUSTOMER_NAME);
                    }
                  }}
                  onKeyDown={(e) => handleHeaderKeyDown(e, "ad")}
                />
                <Button
                  type="button"
                  tabIndex={-1}
                  variant="outline-secondary"
                  className="px-2 py-0 d-flex align-items-center"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const raw = (unvan || "").trim();
                    setCariSearchTerm(raw === DEFAULT_CUSTOMER_NAME ? "" : raw);
                    setShowCariModal(true);
                    if (cariList.length === 0) {
                      CariService.getCariKartlar().then((r) => setCariList(r || [])).catch(() => { });
                      DovizFisService.getKayitsizMusteriler().then((r) => setKayitsizMusteriList(r || [])).catch(() => { });
                    }
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const raw = (unvan || "").trim();
                    setCariSearchTerm(raw === DEFAULT_CUSTOMER_NAME ? "" : raw);
                    setShowCariModal(true);
                    if (cariList.length === 0) {
                      CariService.getCariKartlar().then((r) => setCariList(r || [])).catch(() => { });
                      DovizFisService.getKayitsizMusteriler().then((r) => setKayitsizMusteriList(r || [])).catch(() => { });
                    }
                  }}
                  title="Cari / Müşteri Seç"
                >
                  <IconBinoculars size={14} />
                </Button>
                <Button
                  variant="outline-danger"
                  className="px-2 py-0 d-flex align-items-center justify-content-center gap-1"
                  style={{ fontSize: "11px", fontWeight: 600 }}
                  onClick={() => handleSearchMasak(unvan, detayVergiKimlikNo)}
                  disabled={isSearchingMasak}
                  title="İsim ve TC/VKN ile MASAK Listelerinde Sorgula"
                >
                  {isSearchingMasak ? <Spinner animation="border" size="sm" /> : <IconShieldExclamation size={14} color="#dc2626" />}
                </Button>
              </InputGroup>
            </div>

            {/* Zaman (En sağda) */}
            <div className="d-flex align-items-center gap-1 ms-auto">
              <label style={{ width: 45, minWidth: 45, fontSize: "12px", fontWeight: 600 }} className="mb-0 text-secondary">Zaman</label>
              <div className="d-flex gap-1">
                <Form.Control
                  ref={zamanTarihRef}
                  type="date"
                  size="sm"
                  value={tarih}
                  onChange={(e) => setTarih(e.target.value)}
                  onKeyDown={(e) => handleHeaderKeyDown(e, "zamanTarih")}
                  style={{ width: "135px" }}
                />
                <Form.Control
                  ref={zamanSaatRef}
                  type="time"
                  size="sm"
                  value={saat}
                  onChange={(e) => setSaat(e.target.value)}
                  onKeyDown={(e) => handleHeaderKeyDown(e, "zamanSaat")}
                  style={{ width: "85px" }}
                />
              </div>
            </div>
          </div>

          {/* 2. Satır: Seri No | Belge No | İstatistik Kodu */}
          <div className="d-flex align-items-center gap-3 mb-1 flex-wrap">
            {/* Seri No */}
            <div className="d-flex align-items-center gap-1">
              <label style={{ width: 55, minWidth: 55, fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap" }} className="mb-0 text-secondary">Seri No</label>
              <Form.Control
                ref={seriNoRef}
                size="sm"
                maxLength={20}
                placeholder="Otomatik"
                title="Fiş Seri No (Boş bırakılırsa numaratörden otomatik atanır)"
                value={seriNo}
                onChange={(e) => setSeriNo(e.target.value.toUpperCase())}
                onKeyDown={(e) => handleHeaderKeyDown(e, "seriNo")}
                className="font-monospace"
                style={{ width: "120px" }}
              />
            </div>

            {/* Belge No */}
            <div className="d-flex align-items-center gap-1">
              <label style={{ width: 55, minWidth: 55, fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap" }} className="mb-0 text-secondary">Belge No</label>
              <Form.Control
                ref={belgeNoRef}
                size="sm"
                maxLength={20}
                placeholder="Otomatik"
                title="Belge No"
                value={fisNo}
                onChange={(e) => setFisNo(e.target.value)}
                onKeyDown={(e) => handleHeaderKeyDown(e, "belgeNo")}
                className="font-monospace"
                style={{ width: "120px" }}
              />
            </div>

            {/* İstatistik */}
            <div className="d-flex align-items-center gap-1">
              <label style={{ width: 55, minWidth: 55, fontSize: "12px", fontWeight: 600 }} className="mb-0 text-secondary">İstatistik</label>
              <InputGroup size="sm" style={{ width: "135px" }}>
                <Form.Control
                  ref={istatistikRef}
                  type="text"
                  size="sm"
                  autoComplete="off"
                  value={istatistikKodu}
                  maxLength={20}
                  onChange={(e) => {
                    const val = e.target.value.slice(0, 20);
                    setIstatistikKodu(val);
                    if (!val.trim()) setIstatistikId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "F3") {
                      e.preventDefault();
                      setIstatistikSearchTerm((istatistikKodu || "").trim());
                      setShowIstatistikModal(true);
                    } else {
                      handleHeaderKeyDown(e, "istatistik");
                    }
                  }}
                  className="font-monospace text-center px-1"
                  title="İstatistik Kodu (F3 ile seçebilirsiniz)"
                />
                <Button
                  type="button"
                  tabIndex={-1}
                  variant="outline-secondary"
                  className="px-2 py-0 d-flex align-items-center justify-content-center"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIstatistikSearchTerm((istatistikKodu || "").trim());
                    setShowIstatistikModal(true);
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIstatistikSearchTerm((istatistikKodu || "").trim());
                    setShowIstatistikModal(true);
                  }}
                  title="F3) İstatistik Kodu Seçimi"
                >
                  <IconBinoculars size={14} />
                </Button>
              </InputGroup>
            </div>

            {/* Has Kuru */}
            <div className="d-flex align-items-center gap-1">
              <label style={{ fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap" }} className="mb-0 text-secondary">Has Kuru</label>
              <Form.Control
                ref={hasKuruRef}
                type="number"
                size="sm"
                value={altinHasKuru}
                onChange={(e) => handleAltinHasKuruChange(e.target.value)}
                onKeyDown={(e) => handleHeaderKeyDown(e, "hasKuru")}
                className="font-monospace text-end"
                style={{ width: "95px" }}
              />
            </div>

            {/* İşçilik KDV % */}
            <div className="d-flex align-items-center gap-1">
              <label style={{ fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap" }} className="mb-0 text-secondary">İşçilik KDV %</label>
              <div className="d-flex gap-1 align-items-center">
                <Form.Control
                  ref={kdvOraniRef}
                  type="number"
                  size="sm"
                  value={kdvOrani}
                  onChange={(e) => setKdvOrani(e.target.value)}
                  onKeyDown={(e) => handleHeaderKeyDown(e, "kdvOrani")}
                  className="font-monospace text-end"
                  style={{ width: "55px" }}
                />
                <Form.Control
                  type="number"
                  size="sm"
                  readOnly
                  value={((Number(kdvOrani) || 0) * (Number(altinHasKuru) || 0) * totalIscilikHasGram / 100).toFixed(2)}
                  className="font-monospace text-end"
                  style={{ width: "75px", background: "#f8f9fa" }}
                  title="Hesaplanan KDV Tutarı (TL)"
                />
              </div>
            </div>
          </div>

          {/* ─── Grid / Satır Tablosu ───────────────────────────────────────────── */}
          <div style={{ overflowX: "auto" }}>
            <Table bordered size="sm" hover className="mb-1" style={{ fontSize: "11.5px", minWidth: 960 }}>
              <thead style={{ background: "#d9e8fb", color: "#000" }}>
                <tr>
                  <th style={{ width: 25 }} className="text-center">#</th>
                  <th style={{ width: 110 }}>Ürün kodu</th>
                  <th style={{ width: 140 }}>Ürün adı</th>
                  <th style={{ width: 55 }}>Adet</th>
                  <th style={{ width: 75 }}>Miktar (gr)</th>
                  <th style={{ width: 70 }}>Milyem</th>
                  <th style={{ width: 85 }}>Altın Has (Gr)</th>
                  <th style={{ width: 85 }}>İşçilik şekli</th>
                  <th style={{ width: 85 }}>İşçilik</th>
                  <th style={{ width: 85 }}>İşçilik (Has)</th>
                  <th style={{ width: 105 }}>Kur</th>
                  <th style={{ width: 110 }}>Tutar (TL)</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((row, rowIndex) => (
                  <tr key={row.id} data-row-id={row.id} data-table-type="kalemler" style={rowIndex === activeRowIndex ? { background: "#edf5ff" } : {}}>
                    <td className="text-muted text-center" style={{ padding: "2px", fontSize: "10px", verticalAlign: "middle" }}>
                      {rowIndex + 1}
                    </td>

                    {/* Ürün kodu */}
                    <td>
                      <InputGroup size="sm">
                        <Form.Control
                          ref={(el) => { rowInputRefs.current[`${row.id}_urunKodu`] = el; }}
                          value={row.urunKodu}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateRow(row.id, "urunKodu", val);
                            const match = urunList.find((u) => u.kod.trim().toLowerCase() === val.trim().toLowerCase());
                            if (match) {
                              applyProductToRow(row.id, match);
                            }
                          }}
                          onBlur={(e) => {
                            const val = e.target.value.trim();
                            if (val) {
                              const match = urunList.find((u) => u.kod.trim().toLowerCase() === val.toLowerCase());
                              if (match) {
                                applyProductToRow(row.id, match);
                              }
                            }
                          }}
                          onDoubleClick={() => openUrunModal(row.id)}
                          onKeyDown={(e) => {
                            if (e.key === "F4" || e.key === "F3") {
                              e.preventDefault();
                              openUrunModal(row.id);
                              return;
                            }
                            handleGridKeyDown(e, rowIndex, "urunKodu", row.id);
                          }}
                          onFocus={() => setActiveRowIndex(rowIndex)}
                          style={{ fontSize: "11px", padding: "1px 4px", textTransform: "uppercase" }}
                        />
                        <Button
                          type="button"
                          tabIndex={-1}
                          variant="outline-secondary"
                          className="px-1 py-0 d-flex align-items-center"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            openUrunModal(row.id);
                          }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            openUrunModal(row.id);
                          }}
                          title="Ürün Seç (F3/F4)"
                        >
                          <IconBinoculars size={12} />
                        </Button>
                      </InputGroup>
                    </td>

                    {/* Ürün adı - read only */}
                    <td>
                      <Form.Control
                        size="sm"
                        value={row.urunAdi}
                        readOnly
                        style={{ fontSize: "11px", padding: "1px 4px", background: "#f8f9fa" }}
                      />
                    </td>

                    {/* Adet */}
                    <td>
                      <Form.Control
                        ref={(el) => { rowInputRefs.current[`${row.id}_adet`] = el; }}
                        inputMode="numeric"
                        size="sm"
                        className="text-end font-monospace"
                        value={row.adet}
                        onChange={(e) => updateRow(row.id, "adet", e.target.value)}
                        onKeyDown={(e) => handleGridKeyDown(e, rowIndex, "adet", row.id)}
                        onFocus={() => setActiveRowIndex(rowIndex)}
                        style={{ fontSize: "11px", padding: "1px 4px" }}
                      />
                    </td>

                    {/* Miktar */}
                    <td>
                      <Form.Control
                        ref={(el) => { rowInputRefs.current[`${row.id}_miktar`] = el; }}
                        inputMode="decimal"
                        size="sm"
                        className="text-end font-monospace"
                        value={row.miktar}
                        onChange={(e) => updateRow(row.id, "miktar", e.target.value)}
                        onKeyDown={(e) => handleGridKeyDown(e, rowIndex, "miktar", row.id)}
                        onFocus={() => setActiveRowIndex(rowIndex)}
                        style={{ fontSize: "11px", padding: "1px 4px" }}
                      />
                    </td>

                    {/* Milyem */}
                    <td>
                      <Form.Control
                        ref={(el) => { rowInputRefs.current[`${row.id}_milyem`] = el; }}
                        inputMode="decimal"
                        data-decimal="true"
                        size="sm"
                        className="text-end font-monospace"
                        value={row.milyem}
                        onChange={(e) => updateRow(row.id, "milyem", e.target.value)}
                        onKeyDown={(e) => handleGridKeyDown(e, rowIndex, "milyem", row.id)}
                        onFocus={() => setActiveRowIndex(rowIndex)}
                        style={{ fontSize: "11px", padding: "1px 4px" }}
                      />
                    </td>

                    {/* Has (Gr) */}
                    <td>
                      <Form.Control
                        ref={(el) => { rowInputRefs.current[`${row.id}_hasGram`] = el; }}
                        inputMode="decimal"
                        data-decimal="true"
                        size="sm"
                        className="text-end font-monospace"
                        value={row.hasGram}
                        onChange={(e) => updateRow(row.id, "hasGram", e.target.value)}
                        onKeyDown={(e) => handleGridKeyDown(e, rowIndex, "hasGram", row.id)}
                        onFocus={() => setActiveRowIndex(rowIndex)}
                        style={{ fontSize: "11px", padding: "1px 4px" }}
                      />
                    </td>

                    {/* İşçilik şekli */}
                    <td>
                      <Form.Select
                        size="sm"
                        value={row.iscilikHesaplamaSekli}
                        ref={(el) => { rowInputRefs.current[`${row.id}_iscilikHesaplamaSekli`] = el; }}
                        onChange={(e) => updateRow(row.id, "iscilikHesaplamaSekli", Number(e.target.value))}
                        onKeyDown={(e) => handleGridKeyDown(e, rowIndex, "iscilikHesaplamaSekli", row.id)}
                        onFocus={() => setActiveRowIndex(rowIndex)}
                        style={{ fontSize: "10.5px", padding: "1px 2px" }}
                      >
                        <option value={0}>Gram</option>
                        <option value={1}>Adet</option>
                        <option value={2}>Toplam</option>
                      </Form.Select>
                    </td>

                    {/* İşçilik miktarı */}
                    <td>
                      <Form.Control
                        ref={(el) => { rowInputRefs.current[`${row.id}_iscilikiMiktari`] = el; }}
                        inputMode="decimal"
                        data-decimal="true"
                        size="sm"
                        className="text-end font-monospace"
                        value={row.iscilikiMiktari}
                        onChange={(e) => updateRow(row.id, "iscilikiMiktari", e.target.value)}
                        onKeyDown={(e) => handleGridKeyDown(e, rowIndex, "iscilikiMiktari", row.id)}
                        onFocus={() => setActiveRowIndex(rowIndex)}
                        style={{ fontSize: "11px", padding: "1px 4px" }}
                      />
                    </td>

                    {/* İşçilik Has Gram */}
                    <td>
                      <Form.Control
                        ref={(el) => { rowInputRefs.current[`${row.id}_iscilikHasGram`] = el; }}
                        inputMode="decimal"
                        data-decimal="true"
                        size="sm"
                        className="text-end font-monospace"
                        value={row.iscilikHasGram}
                        onChange={(e) => updateRow(row.id, "iscilikHasGram", e.target.value)}
                        onKeyDown={(e) => handleGridKeyDown(e, rowIndex, "iscilikHasGram", row.id)}
                        onFocus={() => setActiveRowIndex(rowIndex)}
                        style={{ fontSize: "11px", padding: "1px 4px" }}
                      />
                    </td>

                    {/* Kur */}
                    <td>
                      <Form.Control
                        ref={(el) => { rowInputRefs.current[`${row.id}_kur`] = el; }}
                        inputMode="decimal"
                        size="sm"
                        className="text-end font-monospace"
                        value={row.kur}
                        onChange={(e) => updateRow(row.id, "kur", e.target.value)}
                        onKeyDown={(e) => handleGridKeyDown(e, rowIndex, "kur", row.id)}
                        onFocus={() => setActiveRowIndex(rowIndex)}
                        style={{ fontSize: "11px", padding: "1px 4px" }}
                      />
                    </td>

                    {/* Tutar */}
                    <td>
                      <Form.Control
                        ref={(el) => { rowInputRefs.current[`${row.id}_tutar`] = el; }}
                        inputMode="decimal"
                        size="sm"
                        className="text-end font-monospace"
                        value={row.tutar}
                        onChange={(e) => updateRow(row.id, "tutar", e.target.value)}
                        onKeyDown={(e) => handleGridKeyDown(e, rowIndex, "tutar", row.id)}
                        onFocus={() => setActiveRowIndex(rowIndex)}
                        style={{ fontSize: "11px", padding: "1px 4px" }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot style={{ background: "#f2f4f7", fontWeight: 600, fontSize: "11px" }}>
                <tr>
                  <td colSpan={3} className="text-end small">Toplam</td>
                  <td style={{ textAlign: "right" }}>{totalAdet || ""}</td>
                  <td style={{ textAlign: "right" }}>{totalMiktar ? totalMiktar.toFixed(3) : ""}</td>
                  <td></td>
                  <td style={{ textAlign: "right" }}>{totalHasGram ? totalHasGram.toFixed(4) : ""}</td>
                  <td></td>
                  <td style={{ textAlign: "right" }}>{totalIscilikMiktari || ""}</td>
                  <td style={{ textAlign: "right" }}>{totalIscilikHasGram ? totalIscilikHasGram.toFixed(4) : ""}</td>
                  <td></td>
                  <td style={{ textAlign: "right" }}>
                    {totalTutar ? totalTutar.toLocaleString("tr-TR", { minimumFractionDigits: 2 }) + " TL" : ""}
                  </td>
                </tr>
              </tfoot>
            </Table>
          </div>

          {/* ─── Bottom Sections: ÖDEME (Solda) | Has Kuru & TL/HAS (Sağda Alt Alta) ─── */}
          <Row className="g-2 mt-1 align-items-start">
            {/* SOLDA: Ödeme / Tahsilat Tablosu (Üstteki tablo ile birebir aynı tasarım) */}
            <Col xs={12} lg={8} md={7}>
              <div className="border rounded bg-white shadow-2xs overflow-hidden mb-1">
                <div className="bg-light px-2 py-1 border-bottom">
                  <span className="fw-bold text-secondary" style={{ fontSize: "12px" }}>
                    ÖDEME / TAHSİLAT TABLOSU
                  </span>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <Table bordered size="sm" hover className="mb-0" style={{ fontSize: "11.5px", minWidth: 680 }}>
                    <thead style={{ background: "#d9e8fb", color: "#000" }}>
                      <tr>
                        <th style={{ width: 25 }} className="text-center">#</th>
                        <th style={{ width: 110 }}>Para</th>
                        <th style={{ width: 140 }}>Para adı</th>
                        <th style={{ width: 55 }}>Adet</th>
                        <th style={{ width: 75 }}>Miktar</th>
                        <th style={{ width: 70 }}>Milyem</th>
                        <th style={{ width: 85 }}>Has Gr</th>
                        <th style={{ width: 105 }}>Kur</th>
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
                        <td>
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
                                  const match = urunList.find((u) => u.kod.trim().toLowerCase() === val.trim().toLowerCase());
                                  if (match) {
                                    applyProductToOdemeRow(oRow.id, match);
                                  }
                                }
                              }}
                              onBlur={(e) => {
                                const val = e.target.value.trim();
                                if (val.toUpperCase() === "TL" || val.toUpperCase() === "TRY") {
                                  setOdemeRows((prev) => prev.map((r) => r.id === oRow.id ? { ...r, paraKodu: "TL", paraAdi: "TÜRK LİRASI", kur: 1, milyem: "" } : r));
                                } else if (val) {
                                  const match = urunList.find((u) => u.kod.trim().toLowerCase() === val.toLowerCase());
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
                              style={{ fontSize: "11px", padding: "1px 4px", textTransform: "uppercase" }}
                            />
                            <Button
                              type="button"
                              tabIndex={-1}
                              variant="outline-secondary"
                              className="px-1 py-0 d-flex align-items-center"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                openOdemeUrunModal(oRow.id);
                              }}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                openOdemeUrunModal(oRow.id);
                              }}
                              title="Para / Ürün Seç (F3/F4)"
                            >
                              <IconBinoculars size={12} />
                            </Button>
                          </InputGroup>
                        </td>

                        {/* Para Adı - read only */}
                        <td>
                          <Form.Control
                            size="sm"
                            value={oRow.paraAdi || (oRow.paraKodu === "TL" ? "TÜRK LİRASI" : "")}
                            readOnly
                            style={{ fontSize: "11px", padding: "1px 4px", background: "#f8f9fa" }}
                          />
                        </td>

                        {/* Adet */}
                        <td>
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
                        <td>
                          <Form.Control
                            ref={(el) => { odemeInputRefs.current[`${oRow.id}_miktar`] = el; }}
                            inputMode="decimal"
                            size="sm"
                            className="text-end font-monospace"
                            value={oRow.miktar}
                            onChange={(e) => updateOdemeRow(oRow.id, "miktar", e.target.value)}
                            onKeyDown={(e) => handleOdemeGridKeyDown(e, rowIndex, "miktar", oRow.id)}
                            onFocus={() => setActiveOdemeRowIndex(rowIndex)}
                            style={{ fontSize: "11px", padding: "1px 4px" }}
                          />
                        </td>

                        {/* Milyem */}
                        <td>
                          <Form.Control
                            ref={(el) => { odemeInputRefs.current[`${oRow.id}_milyem`] = el; }}
                            inputMode="decimal"
                            data-decimal="true"
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
                        <td>
                          <Form.Control
                            ref={(el) => { odemeInputRefs.current[`${oRow.id}_hasGram`] = el; }}
                            inputMode="decimal"
                            data-decimal="true"
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
                        <td>
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
                        <td>
                          <Form.Control
                            ref={(el) => { odemeInputRefs.current[`${oRow.id}_tutar`] = el; }}
                            inputMode="decimal"
                            size="sm"
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

            {/* SAĞDA: TL/HAS Özet */}
            <Col xs={12} lg={4} md={5}>
              <div className="d-flex flex-column gap-2">
                {/* TL / HAS Summary Table */}
                <div className="border rounded bg-white overflow-hidden shadow-2xs">
                  <Table bordered size="sm" className="mb-0" style={{ fontSize: "11.5px" }}>
                    <thead style={{ background: "#eef2f6" }}>
                      <tr>
                        <th></th>
                        <th className="text-center" style={{ width: "42%" }}>TL</th>
                        <th className="text-center" style={{ width: "42%" }}>HAS</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="fw-semibold text-secondary">{tip === 0 ? "Alış" : "Satış"}</td>
                        <td className="text-end font-monospace">{totalTutar.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</td>
                        <td className="text-end font-monospace">{alisHas.toFixed(4)}</td>
                      </tr>
                      <tr>
                        <td className="fw-semibold text-secondary">{tip === 0 ? "Ödeme" : "Tahsilat"}</td>
                        <td className="text-end font-monospace">{totalOdemeTutar.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</td>
                        <td className="text-end font-monospace">{odemeHas.toFixed(4)}</td>
                      </tr>
                      <tr style={{ background: (farkTL !== 0 || farkHas !== 0) ? "#fff5f5" : "#f8f9fa" }}>
                        <td className="fw-bold">Fark</td>
                        <td className="text-end fw-bold font-monospace" style={{ color: Math.abs(farkTL) > 0.01 ? "#dc3545" : "inherit" }}>
                          {farkTL.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="text-end fw-bold font-monospace" style={{ color: Math.abs(farkHas) > 0.0001 ? "#dc3545" : "inherit" }}>
                          {farkHas.toFixed(4)}
                        </td>
                      </tr>
                    </tbody>
                  </Table>
                </div>
              </div>
            </Col>
          </Row>

          {/* ─── Alt Kısayol Çubuğu (Kaydet, F8 Detay ve Sağda Belge Türü) ───────── */}
          <div className="d-flex gap-3 flex-wrap mt-2 pt-2 border-top align-items-center justify-content-between">
            <div className="d-flex align-items-center gap-2">
              <span
                className="d-inline-flex align-items-center gap-1.5 px-2.5 py-1 rounded border bg-light shadow-2xs"
                style={{ fontSize: "11.5px", cursor: "pointer" }}
                onClick={() => handleSave(false, false)}
                title="Fişi Kaydet (F1)"
              >
                <Badge bg="primary" className="px-1.5 py-0.5" style={{ fontSize: "10.5px" }}>F1</Badge>
                <span className="fw-bold text-dark">Kaydet</span>
              </span>
              <span
                className="d-inline-flex align-items-center gap-1.5 px-2.5 py-1 rounded border bg-light shadow-2xs"
                style={{ fontSize: "11.5px", cursor: "pointer" }}
                onClick={openDetayModal}
                title="Müşteri Detayı Aç (F8)"
              >
                <Badge bg="dark" className="px-1.5 py-0.5" style={{ fontSize: "10.5px" }}>F8</Badge>
                <span className="fw-bold text-dark">Detay</span>
              </span>
              <span
                className="d-inline-flex align-items-center gap-1.5 px-2.5 py-1 rounded border bg-light shadow-2xs"
                style={{ fontSize: "11.5px", cursor: "pointer" }}
                onClick={() => handleSave(false, true)}
                title="Fişi Kaydet & Yazdır (F10)"
              >
                <Badge bg="success" className="px-1.5 py-0.5" style={{ fontSize: "10.5px" }}>F10</Badge>
                <span className="fw-bold text-dark">Kaydet & Yazdır</span>
              </span>
            </div>

            {/* Sağ En Altta Kağıt Fatura / e-Fatura / e-İrsaliye Seçimi */}
            <div className="d-flex align-items-center gap-1.5">
              <label className="small fw-bold text-secondary mb-0" style={{ fontSize: "12px" }}>
                Belge Türü:
              </label>
              <Form.Select
                size="sm"
                value={belgeTuru}
                onChange={(e) => setBelgeTuru(Number(e.target.value))}
                style={{ width: "135px", fontSize: "12px", fontWeight: 600 }}
              >
                <option value={0}>Kağıt fatura</option>
                <option value={1}>e-Fatura</option>
                <option value={2}>e-İrsaliye</option>
              </Form.Select>
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* ─── MODALS ───────────────────────────────────────────────────────────── */}

      {/* Cari / Müşteri Seçim Modalı (Kayıtlı Cariler & Kayıtsız Müşteriler) */}
      <MusteriSecimModal
        show={showCariModal}
        initialSearchTerm={cariSearchTerm}
        onClose={() => setShowCariModal(false)}
        cariler={cariList}
        kayitsizMusteriler={kayitsizMusteriList}
        onSelectCustomer={handleSelectCustomer}
        currentUnvan={unvan}
      />

      {/* Fiş Ara Modalı (Dürbün / Fiş Listesi) */}
      <LookupModal<SarrafFisListItem>
        show={showFisModal}
        onHide={() => setShowFisModal(false)}
        title="Kayıtlı Sarraf Fişleri"
        items={fisList}
        selectedId={fisId}
        columns={fisColumns}
        filterFn={(item, term) => {
          const t = (term || "").toLowerCase().trim();
          if (!t) return true;
          return (item.fisNo || "").toLowerCase().includes(t) ||
            String(item.sarrafFisiId || "").toLowerCase().includes(t) ||
            (item.unvan || "").toLowerCase().includes(t) ||
            (item.tarih || "").includes(t);
        }}
        onSelect={(item) => {
          setShowFisModal(false);
          const foundIdx = fisList.findIndex((f) => Number(f.sarrafFisiId) === Number(item.sarrafFisiId));
          if (foundIdx >= 0) setCurrentIndex(foundIdx);
          loadFisById(item.sarrafFisiId);
        }}
      />

      {/* Vezne Seç Modalı */}
      <LookupModal<VezneItem>
        show={showVezneModal}
        onHide={() => setShowVezneModal(false)}
        title="Vezne Seç"
        items={vezneList}
        columns={vezneColumns}
        filterFn={(item, term) => {
          const t = term.toLowerCase();
          return item.kod.toLowerCase().includes(t) || item.ad.toLowerCase().includes(t);
        }}
        onSelect={async (item) => {
          setVezneId(item.id); setVezneKod(item.kod); setVezneAd(item.ad);
          setShowVezneModal(false);
          const bak = await SarrafFisService.getVezneBakiye(item.id).catch(() => []);
          setBakiyeler(bak);
        }}
      />

      {/* Ürün Seç Modalı */}
      <LookupModal<UrunItem>
        show={showUrunModal}
        initialSearchTerm={urunSearchTerm}
        onHide={() => {
          setShowUrunModal(false);
          activeRowIdForUrunRef.current = null;
          activeOdemeRowIdForUrunRef.current = null;
          setActiveRowIdForUrun(null);
          setActiveOdemeRowIdForUrun(null);
        }}
        title="Ürün / Para Seç"
        items={urunList}
        isLoading={isUrunLoading}
        columns={urunColumns}
        filterFn={(item, term) => {
          const t = (term || "").toLowerCase().trim();
          if (!t) return true;
          const k = (item.kod || "").toLowerCase();
          const a = (item.ad || "").toLowerCase();
          return k.includes(t) || a.includes(t);
        }}
        onSelect={(item) => {
          const targetKalemRowId = activeRowIdForUrunRef.current || activeRowIdForUrun;
          const targetOdemeRowId = activeOdemeRowIdForUrunRef.current || activeOdemeRowIdForUrun;

          if (targetKalemRowId) {
            applyProductToRow(targetKalemRowId, item);
            setTimeout(() => {
              focusGridCell(targetKalemRowId, "adet", "select");
            }, 30);
          } else if (targetOdemeRowId) {
            applyProductToOdemeRow(targetOdemeRowId, item);
            setTimeout(() => {
              focusOdemeGridCell(targetOdemeRowId, "adet", "select");
            }, 30);
          }
          setShowUrunModal(false);
          activeRowIdForUrunRef.current = null;
          activeOdemeRowIdForUrunRef.current = null;
          setActiveRowIdForUrun(null);
          setActiveOdemeRowIdForUrun(null);
        }}
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
                5549 sayılı yasa gereğince işlem yapılan müşterinin <strong>İsim / Ünvan, T.C. Kimlik / VKN, Adres ve Kişilik Tipi</strong> bilgilerinin eksiksiz girilmesi zorunludur.
              </p>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer className="py-2">
          <Button size="sm" variant="outline-secondary" onClick={() => {
            setShowMasakCustomerWarningModal(false);
            openDetayModal();
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
              openDetayModal();
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
              handleSave(true);
            }}
          >
            Yine de Kaydet
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Silme Onay Modalı (F8) */}
      <Modal show={showDeleteConfirm} onHide={() => setShowDeleteConfirm(false)} centered size="sm">
        <Modal.Header closeButton className="py-2">
          <Modal.Title className="h6 mb-0">
            <IconAlertTriangle size={16} className="text-danger me-1" />
            Belgeyi Sil
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="small py-2">
          Belge <strong>#{fisNo || fisId}</strong> silinecektir. Emin misiniz?
        </Modal.Body>
        <Modal.Footer className="py-1">
          <Button size="sm" variant="secondary" onClick={() => setShowDeleteConfirm(false)}>İptal</Button>
          <Button size="sm" variant="danger" onClick={handleDelete}>Sil</Button>
        </Modal.Footer>
      </Modal>

      {/* ─── F8 Detay Modalı: Label solda, Input sağda, Enter/Yön Tuşları ile Geçiş ─ */}
      <Modal show={showDetayModal} onHide={() => setShowDetayModal(false)} centered size="lg">
        <Modal.Header closeButton className="py-2">
          <Modal.Title className="h6 mb-0 d-flex align-items-center">
            <IconBinoculars size={16} className="text-primary me-2" />
            Müşteri Detayı — F8
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3">
          <Row className="g-2">
            {/* Sol Kolon */}
            <Col xs={12} md={6}>
              <div className="d-flex align-items-center mb-2">
                <label style={{ width: 135, minWidth: 135, fontSize: "12px", fontWeight: 600 }}>Unvan / Ad Soyad</label>
                <Form.Control
                  ref={(el) => { detayRefs.current["unvan"] = el; }}
                  size="sm"
                  value={detayUnvan}
                  onChange={(e) => setDetayUnvan(e.target.value)}
                  onKeyDown={(e) => handleDetayKeyDown(e, "unvan")}
                  style={{ flex: 1 }}
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <label style={{ width: 135, minWidth: 135, fontSize: "12px", fontWeight: 600 }}>Kişilik Tipi</label>
                <Form.Select
                  ref={(el) => { detayRefs.current["kisilikTipi"] = el; }}
                  size="sm"
                  value={detayKisilikTipi}
                  onChange={(e) => setDetayKisilikTipi(Number(e.target.value))}
                  onKeyDown={(e) => handleDetayKeyDown(e, "kisilikTipi")}
                  style={{ flex: 1 }}
                >
                  <option value={0}>Gerçek Kişi</option>
                  <option value={1}>Tüzel Kişi</option>
                </Form.Select>
              </div>

              <div className="d-flex align-items-center mb-2">
                <label style={{ width: 135, minWidth: 135, fontSize: "12px", fontWeight: 600 }}>Kimlik Belge Türü</label>
                <Form.Select
                  ref={(el) => { detayRefs.current["kimlikBelgeTuru"] = el; }}
                  size="sm"
                  value={detayKimlikBelgeTuru}
                  onChange={(e) => setDetayKimlikBelgeTuru(Number(e.target.value))}
                  onKeyDown={(e) => handleDetayKeyDown(e, "kimlikBelgeTuru")}
                  style={{ flex: 1 }}
                >
                  <option value={0}>T.C. Kimlik</option>
                  <option value={1}>Pasaport</option>
                  <option value={2}>Ehliyet</option>
                </Form.Select>
              </div>

              {detayKimlikBelgeTuru === 1 ? (
                <div className="d-flex align-items-center mb-2">
                  <label style={{ width: 135, minWidth: 135, fontSize: "12px", fontWeight: 600 }}>Pasaport No</label>
                  <InputGroup size="sm" style={{ flex: 1 }}>
                    <Form.Control
                      ref={(el) => { detayRefs.current["pasaportNo"] = el; }}
                      size="sm"
                      value={detayPasaportNo}
                      onChange={(e) => setDetayPasaportNo(e.target.value)}
                      onKeyDown={(e) => handleDetayKeyDown(e, "pasaportNo")}
                      maxLength={20}
                    />
                    <Button
                      variant="outline-danger"
                      className="px-2 py-0 d-flex align-items-center justify-content-center gap-1"
                      style={{ fontSize: "11px", fontWeight: 600 }}
                      onClick={() => handleSearchMasak(detayUnvan || unvan, detayPasaportNo)}
                      disabled={isSearchingMasak}
                      title="Pasaport No ile MASAK Listelerinde Sorgula"
                    >
                      {isSearchingMasak ? <Spinner animation="border" size="sm" /> : <IconShieldExclamation size={13} color="#dc2626" />}
                      <span>MASAK</span>
                    </Button>
                  </InputGroup>
                </div>
              ) : (
                <div className="d-flex align-items-center mb-2">
                  <label style={{ width: 135, minWidth: 135, fontSize: "12px", fontWeight: 600 }}>Vergi / TC Kimlik (11)</label>
                  <InputGroup size="sm" style={{ flex: 1 }}>
                    <Form.Control
                      ref={(el) => { detayRefs.current["vergiKimlikNo"] = el; }}
                      value={detayVergiKimlikNo}
                      onChange={(e) => setDetayVergiKimlikNo(onlyDigits(e.target.value).slice(0, 11))}
                      onKeyDown={(e) => handleDetayKeyDown(e, "vergiKimlikNo")}
                      maxLength={11}
                    />
                    <Button
                      variant="outline-danger"
                      className="px-2 py-0 d-flex align-items-center justify-content-center gap-1"
                      style={{ fontSize: "11px", fontWeight: 600 }}
                      onClick={() => handleSearchMasak(detayUnvan || unvan, detayVergiKimlikNo)}
                      disabled={isSearchingMasak}
                      title="Bu TC/VKN ile MASAK Listelerinde Sorgula"
                    >
                      {isSearchingMasak ? <Spinner animation="border" size="sm" /> : <IconShieldExclamation size={13} color="#dc2626" />}
                      <span>MASAK</span>
                    </Button>
                  </InputGroup>
                </div>
              )}

              <div className="d-flex align-items-center mb-2">
                <label style={{ width: 135, minWidth: 135, fontSize: "12px", fontWeight: 600 }}>Kimlik Seri No</label>
                <Form.Control
                  ref={(el) => { detayRefs.current["kimlikSeriNo"] = el; }}
                  size="sm"
                  value={detayKimlikSeriNo}
                  onChange={(e) => setDetayKimlikSeriNo(e.target.value)}
                  onKeyDown={(e) => handleDetayKeyDown(e, "kimlikSeriNo")}
                  maxLength={20}
                  style={{ flex: 1 }}
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <label style={{ width: 135, minWidth: 135, fontSize: "12px", fontWeight: 600 }}>Baba Adı</label>
                <Form.Control
                  ref={(el) => { detayRefs.current["babaAdi"] = el; }}
                  size="sm"
                  value={detayBabaAdi}
                  onChange={(e) => setDetayBabaAdi(e.target.value)}
                  onKeyDown={(e) => handleDetayKeyDown(e, "babaAdi")}
                  style={{ flex: 1 }}
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <label style={{ width: 135, minWidth: 135, fontSize: "12px", fontWeight: 600 }}>Anne Adı</label>
                <Form.Control
                  ref={(el) => { detayRefs.current["anneAdi"] = el; }}
                  size="sm"
                  value={detayAnneAdi}
                  onChange={(e) => setDetayAnneAdi(e.target.value)}
                  onKeyDown={(e) => handleDetayKeyDown(e, "anneAdi")}
                  style={{ flex: 1 }}
                />
              </div>
            </Col>

            {/* Sağ Kolon */}
            <Col xs={12} md={6}>
              <div className="d-flex align-items-center mb-2">
                <label style={{ width: 135, minWidth: 135, fontSize: "12px", fontWeight: 600 }}>Doğum Tarihi</label>
                <Form.Control
                  ref={(el) => { detayRefs.current["dogumTarihi"] = el; }}
                  type="date"
                  size="sm"
                  value={detayDogumTarihi}
                  onChange={(e) => setDetayDogumTarihi(e.target.value)}
                  onKeyDown={(e) => handleDetayKeyDown(e, "dogumTarihi")}
                  style={{ flex: 1 }}
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <label style={{ width: 135, minWidth: 135, fontSize: "12px", fontWeight: 600 }}>Doğum Yeri</label>
                <Form.Control
                  ref={(el) => { detayRefs.current["dogumYeri"] = el; }}
                  size="sm"
                  value={detayDogumYeri}
                  onChange={(e) => setDetayDogumYeri(e.target.value)}
                  onKeyDown={(e) => handleDetayKeyDown(e, "dogumYeri")}
                  style={{ flex: 1 }}
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <label style={{ width: 135, minWidth: 135, fontSize: "12px", fontWeight: 600 }}>Kimlik Geçerlilik</label>
                <Form.Control
                  ref={(el) => { detayRefs.current["kimlikGecerlilikTarihi"] = el; }}
                  type="date"
                  size="sm"
                  value={detayKimlikGecerlilikTarihi}
                  onChange={(e) => setDetayKimlikGecerlilikTarihi(e.target.value)}
                  onKeyDown={(e) => handleDetayKeyDown(e, "kimlikGecerlilikTarihi")}
                  style={{ flex: 1 }}
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <label style={{ width: 135, minWidth: 135, fontSize: "12px", fontWeight: 600 }}>Telefon</label>
                <Form.Control
                  ref={(el) => { detayRefs.current["telefonNo"] = el; }}
                  size="sm"
                  value={detayTelefonNo}
                  onChange={(e) => setDetayTelefonNo(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => handleDetayKeyDown(e, "telefonNo")}
                  style={{ flex: 1 }}
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <label style={{ width: 135, minWidth: 135, fontSize: "12px", fontWeight: 600 }}>Adres</label>
                <Form.Control
                  ref={(el) => { detayRefs.current["adres"] = el; }}
                  size="sm"
                  value={detayAdres}
                  onChange={(e) => setDetayAdres(e.target.value)}
                  onKeyDown={(e) => handleDetayKeyDown(e, "adres")}
                  style={{ flex: 1 }}
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <label style={{ width: 135, minWidth: 135, fontSize: "12px", fontWeight: 600 }}>E-posta</label>
                <Form.Control
                  ref={(el) => { detayRefs.current["eposta"] = el; }}
                  size="sm"
                  type="email"
                  value={detayEposta}
                  onChange={(e) => setDetayEposta(e.target.value)}
                  onKeyDown={(e) => handleDetayKeyDown(e, "eposta")}
                  style={{ flex: 1 }}
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <label style={{ width: 135, minWidth: 135, fontSize: "12px", fontWeight: 600 }}>Vekil Adı</label>
                <Form.Control
                  ref={(el) => { detayRefs.current["vekilAdi"] = el; }}
                  size="sm"
                  value={detayVekilAdi}
                  onChange={(e) => setDetayVekilAdi(e.target.value)}
                  onKeyDown={(e) => handleDetayKeyDown(e, "vekilAdi")}
                  style={{ flex: 1 }}
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <label style={{ width: 135, minWidth: 135, fontSize: "12px", fontWeight: 600 }}>Vekil Kimlik No</label>
                <Form.Control
                  ref={(el) => { detayRefs.current["vekilKimlikNo"] = el; }}
                  size="sm"
                  value={detayVekilKimlikNo}
                  onChange={(e) => setDetayVekilKimlikNo(e.target.value)}
                  onKeyDown={(e) => handleDetayKeyDown(e, "vekilKimlikNo")}
                  style={{ flex: 1 }}
                />
              </div>
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer className="py-1">
          <Button size="sm" variant="secondary" onClick={() => setShowDetayModal(false)}>İptal</Button>
          <Button size="sm" variant="success" onClick={handleSaveDetay}>
            <IconCheck size={14} className="me-1" />
            Uygula / Kaydet
          </Button>
        </Modal.Footer>
      </Modal>

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

      {/* MASAK Resmi Listeleri Yönetme / Güncelleme Modalı */}
      <MasakModal
        show={masakManagementOpen}
        onHide={() => setMasakManagementOpen(false)}
      />

      {/* F3) İstatistik Kodu Seçim Modalı */}
      <IstatistikSecimModal
        show={showIstatistikModal}
        initialSearchTerm={istatistikSearchTerm}
        onClose={() => setShowIstatistikModal(false)}
        tip={tip}
        onSelect={handleSelectIstatistik}
        currentKod={istatistikKodu}
      />

      {/* 80mm POS & A4 Sarraf Fişi Yazdırma Modalı */}
      <SarrafFisiPrintModal
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
        belgeNo={printSnapshot?.belgeNo ?? fisNo}
        unvan={printSnapshot?.unvan ?? (unvan || detayUnvan)}
        vergiKimlikNo={printSnapshot?.vergiKimlikNo ?? detayVergiKimlikNo}
        detayIl={printSnapshot?.detayIl ?? ""}
        detayIlce={printSnapshot?.detayIlce ?? ""}
        detayUyruk={printSnapshot?.detayUyruk ?? ""}
        detayPasaportNo={printSnapshot?.detayPasaportNo ?? detayPasaportNo}
        detayMeslek={printSnapshot?.detayMeslek ?? ""}
        detayCariTipi={printSnapshot?.detayCariTipi ?? ""}
        detayAdres={printSnapshot?.detayAdres ?? detayAdres}
        detayTelefonNo={printSnapshot?.detayTelefonNo ?? detayTelefonNo}
        vezneKod={printSnapshot?.vezneKod ?? vezneKod}
        kullaniciAdi={printSnapshot?.kullaniciAdi ?? (user?.fullName || user?.username || "Kasiyer")}
        satirlar={printSnapshot?.satirlar ?? lines.filter((l) => Number(l.miktar) > 0 || Number(l.tutar) > 0 || Number(l.adet) > 0 || (l.urunAdi && l.urunAdi.trim() !== ""))}
        odemeSatirlari={printSnapshot?.odemeSatirlari ?? odemeRows.filter((o) => Number(o.miktar) > 0 || Number(o.tutar) > 0 || Number(o.adet) > 0 || (o.paraKodu && o.paraKodu.trim() !== ""))}
        toplamTutar={printSnapshot?.toplamTutar ?? totalTutar}
        toplamHas={printSnapshot?.toplamHas ?? alisHas}
        odenenTutar={printSnapshot?.odenenTutar ?? totalOdemeTutar}
        kalanTutar={printSnapshot?.kalanTutar ?? farkTL}
      />
    </div>
  );
};

export default SarrafFisiPage;
