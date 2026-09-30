import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSearchParams, useLocation, useNavigate } from "react-router-dom";
import { useEBankaFisKesimi } from "../ebanka/useEBankaFisKesimi";
import { Card, Row, Col, Form, Button, Table, Badge, Alert, InputGroup, Modal, Spinner } from "react-bootstrap";
import {
  IconCheck, IconBinoculars, IconAlertTriangle, IconPlus, IconShieldExclamation, IconShieldCheck, IconPrinter, IconClock, IconCoins, IconUsers, IconBuildingBank, IconBuildingStore,
  IconArrowsExchange,
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
import { CashDeskDefinitionsPage } from "../settings/CashDeskDefinitionsPage";
import { MusteriSecimModal, SelectedCustomerResult, CustomerSearchField } from "./MusteriSecimModal";
import { CariService, CariKartItem } from "../../services/cariService";
import { CariCardRegistrationPage } from "../cari/CariCardRegistrationPage";
import { DovizFisService, KayitsizMusteriItem, IstatistikSecimItem } from "../../services/dovizFisService";
import { StatisticService, StatisticItem } from "../../services/statisticService";
import { ProductDefinitionsPage } from "../settings/ProductDefinitionsPage";
import { ProductDefinitionService } from "../../services/productDefinitionService";
import { CompanyService, TodvzTanimDto } from "../../services/companyService";
import { BankaService, BankaHesapItem } from "../../services/bankaService";
import { BankaHesapKartiPage } from "../banka/BankaHesapKartiPage";
import { PosCihaziService, PosCihaziItem } from "../../services/posCihaziService";
import { IskontoService, IskontoItem } from "../../services/iskontoService";
import { IskontoDefinitionsPage } from "../settings/IskontoDefinitionsPage";
import { KurService, KurRowItem } from "../../services/kurService";
import { NumeratorService, NumeratorItem } from "../../services/numeratorService";
import { IstatistikSecimModal } from "./IstatistikSecimModal";
import { ArbitrajModal, ArbitrajApplyResult } from "./ArbitrajModal";
import SarrafFisiPrintModal from "./SarrafFisiPrintModal";
import { PrinterService, YaziciItem } from "../../services/printerService";
import { resolveEffectivePrinter } from "../../utils/printerResolver";
import { triggerSilentPrint } from "../../services/silentPrintService";
import { generateSarrafReceiptHtml } from "../../utils/receiptHtmlGenerator";
import { onlyDecimal, onlyDigits, blockNonNumericKeys } from "../../utils/numericInput";
import { ebelgeService } from "../../services/ebelgeService";

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
  odemeAraciTuru: number; // 0: Vezne, 1: Cari, 2: Kart, 3: Hesap
  cariKartId?: number | null;
  cariKod?: string;
  cariUnvan?: string;
  bankaId?: number | null;
  posCihaziId?: number | null;
  iskontoId?: number | null;
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
  "urunKodu", "urunAdi", "adet", "miktar", "milyem", "hasGram",
  "iscilikHesaplamaSekli", "iscilikiMiktari", "iscilikHasGram", "kur", "tutar",
] as const;
type GridColKey = typeof GRID_COLS[number];

const ODEME_COLS = [
  "odemeAraciTuru", "cariKod", "paraKodu", "paraAdi", "adet", "miktar", "milyem", "hasGram", "kur", "tutar",
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
  id: makeId(), satirNo, odemeAraciTuru: 0, cariKartId: null, cariKod: "", cariUnvan: "", bankaId: null, posCihaziId: null, iskontoId: null, paraId: null, paraKodu: "TL", paraAdi: "TÜRK LİRASI",
  adet: "", miktar: "", milyem: "", hasGram: "", kur: "", tutar: "", urunTipi: 0,
});

const recomputeOdemeRow = (r: OdemeRow, defaultHasKuru: number = 0, changedField?: keyof OdemeRow): OdemeRow => {
  const isTL = (r.paraKodu || "").trim().toUpperCase() === "TL" || (r.paraKodu || "").trim().toUpperCase() === "TRY" || (r.paraKodu || "").trim().toUpperCase() === "TRL";
  const isKart = r.odemeAraciTuru === 2;
  const isIskonto = Boolean(
    r.iskontoId ||
    (r.paraKodu && r.paraKodu.trim().toUpperCase().startsWith("ISK")) ||
    (r.paraAdi && (r.paraAdi.toUpperCase().includes("İSKONTO") || r.paraAdi.toUpperCase().includes("ISKONTO")))
  );
  const isKurFixed = isTL || isKart || isIskonto;
  const isPara = (r.urunTipi === 0 || isTL || isIskonto);

  const adet = parseDecimal(r.adet);
  const miktar = parseDecimal(r.miktar);
  const rawMilyem = parseDecimal(r.milyem);
  const effectiveMilyem = rawMilyem > 1 ? (rawMilyem <= 100 ? rawMilyem / 100 : rawMilyem / 1000) : rawMilyem;

  let hasGram: number | string = r.hasGram;
  let tutar: number | string = r.tutar;
  const kurNum = parseDecimal(r.kur);
  const kur = isKurFixed ? (isIskonto ? (r.kur || "") : "") : (kurNum > 0 ? kurNum : (r.kur !== "" && r.kur !== null && r.kur !== undefined ? r.kur : (defaultHasKuru > 0 ? defaultHasKuru : "")));
  const effectiveKur = isKurFixed ? 1 : (kurNum > 0 ? kurNum : parseDecimal(kur));

  if (isIskonto) {
    if (changedField !== "tutar") {
      tutar = miktar > 0 ? miktar : (parseDecimal(r.tutar) > 0 ? parseDecimal(r.tutar) : "");
    }
    return {
      ...r,
      adet: "",
      milyem: r.milyem || "",
      hasGram: r.hasGram || "",
      tutar,
      kur: r.kur !== undefined && r.kur !== null && r.kur !== "" ? r.kur : 1,
    };
  }

  if (isPara) {
    if (changedField !== "tutar") {
      if (miktar > 0 && effectiveKur > 0) {
        tutar = parseFloat((miktar * effectiveKur).toFixed(2));
      } else if (miktar > 0 && isKurFixed) {
        tutar = miktar;
      } else {
        tutar = "";
      }
    }
    return {
      ...r,
      adet: "",
      milyem: "",
      hasGram: "",
      tutar,
      kur: isKurFixed ? "" : kur,
    };
  }

  // Maden / Altın / Gümüş
  const base = miktar > 0 ? miktar : adet;
  if (changedField !== "hasGram") {
    if (base > 0 && effectiveMilyem > 0) {
      hasGram = parseFloat((base * effectiveMilyem).toFixed(4));
    } else if (base > 0) {
      hasGram = base;
    }
  }
  if (changedField !== "tutar") {
    const effHas = parseDecimal(hasGram) > 0 ? parseDecimal(hasGram) : base;
    const mKur = kurNum > 0 ? kurNum : (defaultHasKuru > 0 ? defaultHasKuru : 1);
    if (effHas > 0 && mKur > 0) {
      tutar = parseFloat((effHas * mKur).toFixed(2));
    }
  }

  return {
    ...r,
    hasGram,
    tutar,
    kur: isKurFixed ? "" : (kur !== "" ? kur : (defaultHasKuru > 0 ? defaultHasKuru : "")),
  };
};

const recomputeRow = (r: GridRow, defaultKur: number = 0, changedField?: keyof GridRow): GridRow => {
  const isPara = r.urunTipi === 0 && Boolean(r.urunKodu && r.urunKodu.trim());
  if (isPara) {
    const miktar = parseDecimal(r.miktar);
    const kur = r.kur !== "" ? r.kur : (defaultKur > 0 ? defaultKur : "");
    const effectiveKur = parseDecimal(kur);
    let tutar: number | string = r.tutar;
    if (changedField !== "tutar") {
      if (effectiveKur > 0 && miktar > 0) {
        tutar = parseFloat((miktar * effectiveKur).toFixed(2));
      } else {
        tutar = "";
      }
    }
    return {
      ...r,
      adet: "",
      miktar: r.miktar,
      milyem: "",
      hasGram: "",
      iscilikHesaplamaSekli: 0,
      iscilikiMiktari: "",
      iscilikHasGram: "",
      kur,
      tutar,
    };
  }

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

  const kur = r.kur !== "" ? r.kur : (defaultKur > 0 ? defaultKur : "");
  const effectiveKur = parseDecimal(kur);
  const totalRowHas = (parseDecimal(hasGram) || 0) + (parseDecimal(iscilikHasGram) || 0);

  // Tabloda tutar her zaman TL cinsindendir
  let tutar: number | string = r.tutar;
  if (changedField !== "tutar") {
    if (totalRowHas > 0 && effectiveKur > 0) {
      tutar = parseFloat((totalRowHas * effectiveKur).toFixed(2));
    } else if (base > 0 && effectiveKur > 0) {
      tutar = parseFloat((base * effectiveKur).toFixed(2));
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
    setTimeout(() => setNotification(null), 2000);
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
  const [bankaList, setBankaList] = useState<BankaHesapItem[]>([]);
  const [posList, setPosList] = useState<PosCihaziItem[]>([]);
  const [iskontoList, setIskontoList] = useState<IskontoItem[]>([]);
  const [showOdemeCariModal, setShowOdemeCariModal] = useState<boolean>(false);
  const [showOdemeParaIskontoModal, setShowOdemeParaIskontoModal] = useState<boolean>(false);
  const [showNewIskontoModal, setShowNewIskontoModal] = useState<boolean>(false);
  const [showOdemeHesapModal, setShowOdemeHesapModal] = useState<boolean>(false);
  const [showOdemePosModal, setShowOdemePosModal] = useState<boolean>(false);
  const [odemeLookupSearchTerm, setOdemeLookupSearchTerm] = useState<string>("");
  const [targetOdemeRowIdForLookup, setTargetOdemeRowIdForLookup] = useState<string | null>(null);

  // POS & Banka yüklendiğinde var olan satırlardaki kodları ve adları eşleştir (sadece kod boşsa)
  useEffect(() => {
    if (posList.length > 0 || bankaList.length > 0) {
      setOdemeRows((prev) =>
        prev.map((r) => {
          if (r.odemeAraciTuru === 2 && posList.length > 0 && r.bankaId && !r.cariKod) {
            const match = posList.find((p) => p.posCihaziId === r.bankaId);
            if (match) {
              return {
                ...r,
                cariKod: match.kod,
                paraAdi: r.paraAdi && r.paraAdi !== "KREDİ KARTI / POS" ? r.paraAdi : (match.ad || "KREDİ KARTI / POS"),
              };
            }
          } else if (r.odemeAraciTuru === 3 && bankaList.length > 0 && r.bankaId && !r.cariKod) {
            const match = bankaList.find((b) => b.bankaId === r.bankaId);
            if (match) {
              return {
                ...r,
                cariKod: match.hesapNo,
                paraAdi: r.paraAdi && r.paraAdi !== "BANKA HAVALE / EFT" ? r.paraAdi : (match.hesapAdi ? `${match.bankaAdi ? match.bankaAdi + " - " : ""}${match.hesapAdi}` : (match.bankaAdi || "BANKA HAVALE / EFT")),
              };
            }
          }
          return r;
        })
      );
    }
  }, [posList, bankaList]);

  const odemeParaList = useMemo(() => {
    return urunList.filter((u) => u.urunTipi === 0 || u.kod?.toUpperCase() === "TL" || u.kod?.toUpperCase() === "TRY");
  }, [urunList]);

  // Cari ve Tahsilat satırları için hem Para/Döviz hem İskonto seçimi
  const allOdemeParaIskontoList = useMemo<any[]>(() => {
    const list: any[] = [];
    (urunList || []).forEach((u) => {
      list.push({
        id: `p-${u.id}`,
        kod: u.kod,
        tanim: u.ad,
        tur: "PARA",
        detay: u.urunTipi === 0 ? "Nakit / Para" : ((u as any).mamulTipi || "Ürün"),
        rawProduct: u,
      });
    });
    (iskontoList || []).forEach((isk) => {
      let iskDetay = "İskonto";
      if (isk.iskontoTipi === 1) iskDetay = `%${isk.oran || 0} İskonto`;
      else if (isk.iskontoTipi === 2) iskDetay = `${isk.tutar || 0} TL İskonto`;
      else if (isk.iskontoTipi === 3) iskDetay = `${isk.hasTutar || 0} Has Gr İskonto`;
      else if (isk.oran) iskDetay = `%${isk.oran} İskonto`;
      else if (isk.tutar) iskDetay = `${isk.tutar} TL İskonto`;

      list.push({
        id: `isk-${isk.iskontoId}`,
        kod: (isk.kod || `ISK-${isk.iskontoId}`).toUpperCase().trim(),
        tanim: isk.tanim,
        tur: "İSKONTO",
        detay: iskDetay,
        rawIskonto: isk,
      });
    });
    return list;
  }, [urunList, iskontoList]);

  const odemeParaIskontoColumns = useMemo<LookupColumn<any>[]>(() => [
    {
      header: "Tür",
      render: (i) => (
        <span className={`badge ${i.tur === "İSKONTO" ? "bg-warning text-dark" : "bg-primary text-white"}`} style={{ fontSize: "10px" }}>
          {i.tur}
        </span>
      ),
      width: "80px",
      highlight: false,
    },
    {
      header: "Kod",
      render: (i) => <span className="font-monospace fw-bold text-primary">{i.kod}</span>,
      width: "110px",
      highlight: true,
    },
    {
      header: "Tanım / Açıklama",
      render: (i) => <span className="fw-medium">{i.tanim}</span>,
      highlight: false,
    },
    {
      header: "Detay / Oran",
      render: (i) => <span className="text-muted small">{i.detay || "-"}</span>,
      width: "130px",
      highlight: false,
    },
  ], []);

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
  const [tip, setTip] = useState<0 | 1>(0);

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
    if (tip === 0) {
      return buyBg || "var(--user-buy-header-bg, #e2e8f0)";
    } else {
      return sellBg || "var(--user-sell-header-bg, #e2e8f0)";
    }
  }, [tip, user?.appearance?.buyHeaderBgColor, user?.appearance?.sellHeaderBgColor]);

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
  const [invalidRowIds, setInvalidRowIds] = useState<Record<string, boolean>>({});
  const rowInputRefs = useRef<Record<string, HTMLInputElement | HTMLSelectElement | null>>({});

  // Ödeme / Tahsilat Tablosu Grid State
  const [odemeRows, setOdemeRows] = useState<OdemeRow[]>([createEmptyOdemeRow(1)]);
  const [activeOdemeRowIndex, setActiveOdemeRowIndex] = useState(0);
  const [invalidOdemeRowIds, setInvalidOdemeRowIds] = useState<Record<string, boolean>>({});
  const odemeInputRefs = useRef<Record<string, HTMLInputElement | HTMLSelectElement | null>>({});

  // Header Element Refs for Keyboard Navigation
  const islemRef = useRef<HTMLSelectElement | null>(null);
  const tcknRef = useRef<HTMLInputElement | null>(null);
  const cariKodRef = useRef<HTMLInputElement | null>(null);
  const adRef = useRef<HTMLInputElement | null>(null);
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

  const lastFocusedCariKodRef = useRef<string>("");
  const lastFocusedUnvanRef = useRef<string>("");
  const lastFocusedVknRef = useRef<string>("");
  const lastFocusedIstatistikKodRef = useRef<string>("");
  const lastModalCallerRef = useRef<"cariKod" | "unvan" | "vkn" | "istatistik" | "gridKalem" | "gridOdeme" | null>(null);
  const lastKalemModalRowIdRef = useRef<string | null>(null);
  const lastOdemeModalRowIdRef = useRef<string | null>(null);

  // Modals
  const [showFisModal, setShowFisModal] = useState(false);
  const [showVezneModal, setShowVezneModal] = useState(false);
  const [showNewVezneModal, setShowNewVezneModal] = useState(false);
  const [showUrunModal, setShowUrunModal] = useState(false);
  const [showNewProductModal, setShowNewProductModal] = useState(false);
  const [showNewCariModal, setShowNewCariModal] = useState(false);
  const [showNewBankaModal, setShowNewBankaModal] = useState(false);
  const [showOdemeParaModal, setShowOdemeParaModal] = useState(false);
  const [cariSearchTerm, setCariSearchTerm] = useState("");
  const [cariSearchField, setCariSearchField] = useState<CustomerSearchField>("all");
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

  // Has toplamları (sadece maden/altın satırlarının has toplamıdır; döviz/para has içermez)
  const alisHas = totalHasGram + totalIscilikHasGram;
  const odemeHas = totalOdemeHas;
  const farkTL = totalTutar - totalOdemeTutar;
  const farkHas = alisHas - odemeHas;

  // Bakiye / Eksi Fark Onay Modalı
  const [showFarkConfirmModal, setShowFarkConfirmModal] = useState<{ show: boolean; andPrint: boolean }>({ show: false, andPrint: false });

  // İstatistik Tanımları Listesi, Firma Tanımları ve Seçili İstatistik
  const [statisticList, setStatisticList] = useState<StatisticItem[]>([]);
  const [selectedStatistic, setSelectedStatistic] = useState<StatisticItem | IstatistikSecimItem | null>(null);
  const [istatistikFisDizaynTipi, setIstatistikFisDizaynTipi] = useState<number | null>(null);
  const [companyDefinitions, setCompanyDefinitions] = useState<TodvzTanimDto | null>(null);
  const [printers, setPrinters] = useState<YaziciItem[]>([]);
  const [istatistikId, setIstatistikId] = useState<number | null>(null);
  const [istatistikKodu, setIstatistikKodu] = useState<string>("");
  const [showIstatistikModal, setShowIstatistikModal] = useState<boolean>(false);
  const [showArbitrajModal, setShowArbitrajModal] = useState<boolean>(false);
  const [arbitrajActiveInfo, setArbitrajActiveInfo] = useState<{ girisKod: string; cikisKod: string; parite: number; islemYonu: string } | null>(null);
  const prevTipRef = useRef<number>(tip);

  useEffect(() => {
    PrinterService.getYazicilar().then(setPrinters).catch(() => {});
  }, []);

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

  // Modal Açık mı Durumu (Modallar açıkken arkadaki hücre ve input geçişlerini bloke etmek için)
  const isAnyModalOpen = Boolean(
    showFisModal ||
    showVezneModal ||
    showUrunModal ||
    showCariModal ||
    showOdemeCariModal ||
    showOdemeHesapModal ||
    showOdemePosModal ||
    showOdemeParaModal ||
    showNewProductModal ||
    showNewCariModal ||
    showNewBankaModal ||
    showDetayModal ||
    showPrintModal ||
    showIstatistikModal ||
    showArbitrajModal ||
    showFarkConfirmModal.show ||
    masakModalOpen ||
    masakManagementOpen ||
    showMasakConfirmModal ||
    showMasakCustomerWarningModal ||
    showMasakMissingModal ||
    showDeleteConfirm
  );

  // MASAK Malvarlığı Dondurulanlar Bloke Durumu
  const isMasakBlocked = Boolean(masakResult.searched && masakResult.matches && masakResult.matches.length > 0);

  // 185.000 TL veya 5.000 USD MASAK Yasal Sınır Kontrolü
  const isMasakLimitExceeded = useMemo(() => {
    // İstatistik tanımlarında Fiş Dizayn Tipi = 1 (Gayriresmi/Özel) ise MASAK kontrolü ve limitleri çalışmaz
    const activeStat = selectedStatistic || statisticList.find((s) => (istatistikId && s.id === istatistikId) || (s.kod && s.kod === istatistikKodu));
    const currentDizaynTipi = istatistikFisDizaynTipi ?? (activeStat ? Number(activeStat.fisDizaynTipi) : null);
    if (currentDizaynTipi === 1) {
      return false;
    }

    const goldTlEquivalent = (alisHas > 0 ? alisHas : odemeHas) * (Number(altinHasKuru) || 0);

    return (
      totalTutar >= 185000 ||
      totalOdemeTutar >= 185000 ||
      goldTlEquivalent >= 185000 ||
      odemeRows.some((o) => (o.paraKodu === "USD" || o.paraKodu === "$") && parseDecimal(o.miktar) >= 5000) ||
      lines.some((l) => (l.urunKodu === "USD" || l.urunKodu === "$") && parseDecimal(l.miktar) >= 5000)
    );
  }, [totalTutar, totalOdemeTutar, alisHas, odemeHas, altinHasKuru, odemeRows, lines, statisticList, selectedStatistic, istatistikFisDizaynTipi, istatistikId, istatistikKodu]);

  const hasCariInOdeme = useMemo(() => {
    return odemeRows.some((r) => r.odemeAraciTuru === 1 || Boolean(r.cariKartId));
  }, [odemeRows]);

  const currencyOptions = useMemo(() => {
    const result: { kod: string; ad: string; paraId: number }[] = [];
    result.push({ kod: "TL", ad: "TÜRK LİRASI", paraId: 1 });
    (urunList || []).forEach((u) => {
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
  }, [urunList]);

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
    lastModalCallerRef.current = null;
    setIstatistikId(item.id);
    setIstatistikKodu(item.kod);
    setSelectedStatistic(item as any);
    const dizaynTipi = Number(item.fisDizaynTipi ?? (item as any).tip ?? 0);
    setIstatistikFisDizaynTipi(dizaynTipi);
    setStatisticList((prev) => {
      const idx = prev.findIndex((s) => s.id === item.id || s.kod === item.kod);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], ...item, fisDizaynTipi: dizaynTipi };
        return copy;
      }
      return [...prev, item as any];
    });
    lastFocusedIstatistikKodRef.current = item.kod;
    setShowIstatistikModal(false);
    setTimeout(() => {
      hasKuruRef.current?.focus();
      hasKuruRef.current?.select();
    }, 50);
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
      } else if (field === "unvan") {
        return (c.ad || (c as any).unvan || "").toLowerCase().includes(q);
      } else if (field === "vkn") {
        return (c.vergiKimlikNo || "").replace(/\s+/g, "").toLowerCase().includes(q.replace(/\s+/g, ""));
      }
      return false;
    });

    const matchedKayitsizlar = kayitsizMusteriList.filter((k) => {
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

      if (data.istatistikId !== undefined && data.istatistikId !== null) {
        setIstatistikId(data.istatistikId);
        const st = (statisticList || []).find((s) => s.id === data.istatistikId || s.kod === data.istatistikKodu);
        const statKod = data.istatistikKodu || st?.kod || "";
        setIstatistikKodu(statKod);
        lastFocusedIstatistikKodRef.current = statKod;
      } else if (data.istatistikKodu) {
        setIstatistikKodu(data.istatistikKodu);
        lastFocusedIstatistikKodRef.current = data.istatistikKodu;
        const st = (statisticList || []).find((s) => s.kod === data.istatistikKodu);
        if (st) setIstatistikId(st.id);
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
          const matchedIskonto = iskontoList.find((isk) => (o.iskontoId && isk.iskontoId === o.iskontoId) || (isk.kod && o.paraKodu && isk.kod.trim().toLowerCase() === o.paraKodu.trim().toLowerCase()));
          let calcAdet: number | string = o.adet != null && o.adet !== "" ? o.adet : "";
          if (!calcAdet && matchedUrun && Number(matchedUrun.gramaj) > 0 && Number(o.miktar) > 0) {
            calcAdet = Math.round(Number(o.miktar) / Number(matchedUrun.gramaj));
          } else if (!calcAdet && matchedUrun && matchedUrun.birim === 0 && Number(o.miktar) > 0) {
            calcAdet = Number(o.miktar);
          }

          let cKod = (o.cariKod || "").trim();
          let cUnv = (o.cariUnvan || "").trim();

          const oat = o.odemeAraciTuru !== undefined && o.odemeAraciTuru !== null
            ? Number(o.odemeAraciTuru)
            : (o.cariKartId ? 1 : 0);

          if (oat === 1) {
            if (o.cariKartId && (!cKod || !cUnv) && cariList.length > 0) {
              const cMatch = cariList.find((c) => c.id === o.cariKartId);
              if (cMatch) {
                if (!cKod) cKod = cMatch.kod || "";
                if (!cUnv) cUnv = cMatch.ad || "";
              }
            }
          } else if (oat === 2) {
            const pId = o.posCihaziId || o.bankaId || o.cariKartId;
            if (pId && (!cKod || !cUnv) && posList.length > 0) {
              const pMatch = posList.find((p) => p.posCihaziId === pId || p.kod === cKod);
              if (pMatch) {
                if (!cKod) cKod = pMatch.kod || "";
                if (!cUnv) cUnv = pMatch.ad || "";
              }
            }
          } else if (oat === 3) {
            const bId = o.bankaId || o.cariKartId || o.posCihaziId;
            if (bId && (!cKod || !cUnv) && bankaList.length > 0) {
              const bMatch = bankaList.find((b) => b.bankaId === bId || b.hesapNo === cKod);
              if (bMatch) {
                if (!cKod) cKod = bMatch.hesapNo || "";
                if (!cUnv) cUnv = bMatch.hesapAdi ? `${bMatch.bankaAdi ? bMatch.bankaAdi + " - " : ""}${bMatch.hesapAdi}` : (bMatch.bankaAdi || "");
              }
            }
          }

          let resolvedParaKodu = (o.paraKodu || "").trim();
          let resolvedParaAdi = (o.paraAdi || "").trim();
          if (!resolvedParaKodu) {
            if (matchedIskonto) {
              resolvedParaKodu = (matchedIskonto.kod || `ISK-${matchedIskonto.iskontoId}`).toUpperCase().trim();
              resolvedParaAdi = matchedIskonto.tanim;
            } else if (matchedUrun) {
              resolvedParaKodu = matchedUrun.kod;
              resolvedParaAdi = matchedUrun.ad;
            } else if (oat === 2 || oat === 3 || oat === 0) {
              resolvedParaKodu = "TL";
              resolvedParaAdi = "TÜRK LİRASI";
            }
          }

          const oRow: OdemeRow = {
            id: makeId(),
            satirNo: o.satirNo,
            odemeAraciTuru: oat,
            cariKartId: o.cariKartId || null,
            cariKod: cKod,
            cariUnvan: cUnv,
            bankaId: o.bankaId || (oat === 3 ? o.cariKartId : null),
            posCihaziId: o.posCihaziId || (oat === 2 ? o.cariKartId : null),
            iskontoId: o.iskontoId || matchedIskonto?.iskontoId || null,
            paraId: o.paraId ?? null,
            paraKodu: resolvedParaKodu,
            paraAdi: resolvedParaAdi || matchedUrun?.ad || (resolvedParaKodu === "TL" ? "TÜRK LİRASI" : ""),
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
  }, [vezneList, cariList, urunList, bankaList, posList]);

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
    setArbitrajActiveInfo(null);

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
      const [vezneler, urunler, fisler, cariler, kayitsizlar, stats, compDefs, anlikKurRes, gunlukKurRes, numerators, bankalar, poslar, iskontolar] = await Promise.all([
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
        BankaService.getBankalar({ aktif: true }).catch(() => [] as BankaHesapItem[]),
        PosCihaziService.getPosCihazlari().catch(() => [] as PosCihaziItem[]),
        IskontoService.getIskontolar({ aktif: true }).catch(() => [] as IskontoItem[]),
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
      setBankaList((bankalar || []) as BankaHesapItem[]);
      setPosList((poslar || []) as PosCihaziItem[]);
      setIskontoList((iskontolar || []) as IskontoItem[]);

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
  const handleSave = useCallback(async (forceMasakApprove = false, andPrint = false, forceFarkApprove = false) => {
    // MASAK Malvarlığı Dondurulanlar Listesinde ise kesinlikle kayıt yapılamaz
    if (isMasakBlocked) {
      showNotif("danger", `🚨 İŞLEM ENGELLENDİ: Bu müşteri MASAK Malvarlığı Dondurulanlar / Yaptırım Listesindedir. Kesinlikle fiş ve işlem kaydı yapılamaz!`);
      setMasakModalOpen(true);
      return;
    }

    if (!vezneId) { showNotif("warning", "Vezne seçiniz"); return; }
    const validLines = lines.filter((l) => l.urunId > 0 && parseDecimal(l.miktar) > 0);
    if (!validLines.length) { showNotif("warning", "En az bir geçerli satır giriniz"); return; }

    // Eksi bakiyeli / fark kontrolü ve onayı
    if (!forceFarkApprove && (farkTL < -0.01 || farkHas < -0.0001)) {
      setShowFarkConfirmModal({ show: true, andPrint });
      return;
    }

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

      // Kullanıcıdan MASAK limit onayı al
      if (!forceMasakApprove) {
        setShowMasakConfirmModal(true);
        return;
      }
    }

    setIsSaving(true);
    try {
      const calculatedKdv = (Number(kdvOrani) || 0) * (Number(altinHasKuru) || 0) * totalIscilikHasGram / 100;
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const liveTarih = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      const liveSaat = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
      const finalTarih = isDuzeltmeMode ? tarih : liveTarih;
      const finalSaatStr = isDuzeltmeMode ? `${tarih}T${saat}:00` : `${liveTarih}T${liveSaat}:00`;

      const payload: SaveSarrafFisPayload = {
        sarrafFisiId: fisId,
        vezneId,
        cariKartId,
        tarih: finalTarih,
        saat: finalSaatStr,
        fisNo: fisNo.trim() || null,
        seriNo: seriNo.trim() || null,
        belgeNo: fisNo.trim() || null,
        irsaliyeNo: fisNo.trim() || null,
        tip,
        altinHasKuru: Number(altinHasKuru) || 0,
        istatistikId: istatistikId || null,
        istatistikKodu: (istatistikKodu || "").trim() || null,
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
        odemeSatirlari: odemeRows
          .map((r) => recomputeOdemeRow(r, Number(altinHasKuru) || 0))
          .filter((o) => {
            const mik = parseDecimal(o.miktar);
            const tut = parseDecimal(o.tutar);
            const ad = parseDecimal(o.adet);
            const hg = parseDecimal(o.hasGram);
            return mik > 0 || tut > 0 || ad > 0 || hg > 0;
          })
          .map((o, i) => {
            const mik = parseDecimal(o.miktar);
            const ad = parseDecimal(o.adet);
            const effectiveMik = mik > 0 ? mik : (ad > 0 ? ad : 0);
            const effKur = parseDecimal(o.kur) > 0 ? parseDecimal(o.kur) : 1;
            const effTut = parseDecimal(o.tutar) > 0 ? parseDecimal(o.tutar) : (effectiveMik * effKur);
            return {
              satirNo: i + 1,
              islemeYeri: o.odemeAraciTuru === 1 ? 1 : (o.odemeAraciTuru === 2 ? 3 : (o.odemeAraciTuru === 3 ? 2 : 0)),
              odemeAraciTuru: o.odemeAraciTuru || 0,
              cariKartId: o.cariKartId || null,
              cariKod: o.cariKod || null,
              cariUnvan: o.cariUnvan || null,
              bankaId: o.bankaId || null,
              posCihaziId: o.posCihaziId || (o.odemeAraciTuru === 2 ? (o.bankaId || o.cariKartId) : null),
              paraId: o.paraId || null,
              paraKodu: o.paraKodu || (o.odemeAraciTuru === 2 || o.odemeAraciTuru === 3 ? "TL" : null),
              paraAdi: o.paraAdi || null,
              iskontoId: o.iskontoId || null,
              adet: ad,
              miktar: effectiveMik,
              milyem: parseDecimal(o.milyem),
              hasGram: parseDecimal(o.hasGram),
              kur: effKur,
              tutar: effTut,
            };
          }),
      };
      const result = await SarrafFisService.saveFis(payload);
      showNotif("success", `Fiş ${result.yeniKayit ? "kaydedildi" : "güncellendi"} — ${result.fisNo || result.sarrafFisiId}${andPrint ? " (Yazıcıya gönderiliyor...)" : ""}`);
      if (andPrint) {
        const snapObj = {
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
          odemeSatirlari: odemeRows
            .map((r) => recomputeOdemeRow(r, Number(altinHasKuru) || 0))
            .filter((o) => {
              const mik = parseDecimal(o.miktar);
              const tut = parseDecimal(o.tutar);
              const ad = parseDecimal(o.adet);
              const hasCode = Boolean((o.paraKodu && o.paraKodu.trim() !== "") || (o.paraId && o.paraId > 0));
              return mik > 0 || tut > 0 || ad > 0 || hasCode;
            })
            .map((o, i) => {
              const mik = parseDecimal(o.miktar);
              const ad = parseDecimal(o.adet);
              const effectiveMik = mik > 0 ? mik : (ad > 0 ? ad : 0);
              const effKur = parseDecimal(o.kur) > 0 ? parseDecimal(o.kur) : 1;
              const effTut = parseDecimal(o.tutar) > 0 ? parseDecimal(o.tutar) : (effectiveMik * effKur);
              return {
                satirNo: i + 1,
                odemeAraciTuru: o.odemeAraciTuru,
                paraKodu: o.paraKodu,
                paraAdi: o.paraAdi,
                adet: ad || "",
                miktar: effectiveMik || "",
                milyem: parseDecimal(o.milyem) || "",
                hasGram: parseDecimal(o.hasGram) || "",
                kur: effKur,
                tutar: effTut,
              };
            }),
          toplamTutar: totalTutar,
          toplamHas: alisHas,
          odenenTutar: totalOdemeTutar,
          kalanTutar: farkTL,
        };
        setPrintSnapshot(snapObj);

        // Tanımlarda kayıtlı olan yazıcıyı çözümle
        const resolved = resolveEffectivePrinter({
          pageType: "sarraf",
          tip,
          vezne: vezneList.find((v) => v.id === vezneId) || (vezneList.length > 0 ? vezneList[0] : null),
          user,
          printers,
        });

        const isPos = resolved.recommendedPrintType === "POS";
        const sarrafHtml = generateSarrafReceiptHtml({
          fis: snapObj,
          company: companyDefinitions,
        });

        await triggerSilentPrint({
          html: sarrafHtml,
          printerName: resolved.printer?.cihazAdi || resolved.printer?.ad || null,
          copies: resolved.kopyaSayisi || 1,
          isPos,
          title: `Sarraf_Fisi_${result.fisNo || fisNo || "Yazdir"}`,
        });
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
      const errMsg = e?.message || "Kayıt hatası";
      showNotif("danger", errMsg);

      // Otomatik olarak hatalı / eksik satırları kızart
      const invLines: Record<string, boolean> = {};
      lines.forEach((l) => {
        if (!isSarrafRowCompletelyEmpty(l) && !isSarrafRowFilled(l)) {
          invLines[l.id] = true;
        }
      });
      if (Object.keys(invLines).length > 0) {
        setInvalidRowIds((prev) => ({ ...prev, ...invLines }));
      }

      const invOdemeler: Record<string, boolean> = {};
      odemeRows.forEach((o) => {
        if (!isOdemeRowCompletelyEmpty(o) && !isOdemeRowFilled(o)) {
          invOdemeler[o.id] = true;
        }
      });
      if (Object.keys(invOdemeler).length > 0) {
        setInvalidOdemeRowIds((prev) => ({ ...prev, ...invOdemeler }));
      }
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
    if (lastOdemeModalRowIdRef.current) {
      const rowId = lastOdemeModalRowIdRef.current;
      lastOdemeModalRowIdRef.current = null;
      lastModalCallerRef.current = null;
      setShowCariModal(false);
      const rawCari = result.raw || cariList.find((c) => c.id === result.id) || {
        id: result.id,
        kod: result.kod,
        ad: result.unvan,
        unvan: result.unvan,
      };
      applyCariToOdemeRow(rowId, rawCari as any);
      setTimeout(() => focusOdemeGridCell(rowId, "miktar", "select"), 50);
      return;
    }

    lastModalCallerRef.current = null;
    const selectedName = (result.unvan || "").trim() || DEFAULT_CUSTOMER_NAME;
    setUnvan(selectedName);
    setDetayUnvan(selectedName);
    const resolvedKod = result.kod || ((result.raw as any)?.kod) || "";
    setCariKod(resolvedKod);

    lastFocusedCariKodRef.current = resolvedKod;
    lastFocusedUnvanRef.current = selectedName;
    if (result.vergiKimlikNo) {
      lastFocusedVknRef.current = result.vergiKimlikNo;
    }

    if (result.type === "registered") {
      setCariKartId(result.id);
    } else if (result.type === "unregistered") {
      setCariKartId(-result.id);
    } else {
      setCariKartId(null);
    }

    setOdemeRows((prev) =>
      prev.map((r) => {
        if (r.odemeAraciTuru === 1) {
          return {
            ...r,
            cariKod: resolvedKod || "",
            cariUnvan: selectedName || "",
            cariKartId: result.type === "registered" ? result.id : null,
            paraKodu: (r.paraKodu && r.paraKodu.trim()) ? r.paraKodu : "TL",
            paraAdi: (r.paraAdi && r.paraAdi.trim() && r.paraAdi !== "CARİ HESAP") ? r.paraAdi : "TÜRK LİRASI",
          };
        }
        return r;
      })
    );

    if (result.vergiKimlikNo) {
      setDetayVergiKimlikNo(result.vergiKimlikNo);
    }
    if (result.adres) {
      setDetayAdres(result.adres);
    }
    if (result.telefon) {
      setDetayTelefonNo(result.telefon);
    }
    if (result.eposta || result.eFaturaPostaKutusu) {
      setDetayEposta(result.eFaturaPostaKutusu || result.eposta || "");
    }

    if (result.isMukellef || result.eFaturaPostaKutusu) {
      setBelgeTuru(1);
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
      if (raw.eFaturaPostaKutusu || raw.eFaturaPosta) {
        setDetayEposta(raw.eFaturaPostaKutusu || raw.eFaturaPosta || raw.eposta || "");
        setBelgeTuru(1);
      }
      if (raw.eFatura || raw.isMukellef) {
        setBelgeTuru(1);
      }
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

    // Eğer VKN girildiyse ve adres/posta kutusu eksikse arka planda e-Belge ve GİB kontrolü yap
    const cleanVknForCheck = (result.vergiKimlikNo || (raw && raw.vergiKimlikNo) || "").replace(/\D/g, "");
    if (cleanVknForCheck.length === 10 || cleanVknForCheck.length === 11) {
      ebelgeService.mukellefSorgula(cleanVknForCheck).then((mRes) => {
        if (mRes && mRes.mukellefMi) {
          setBelgeTuru(1);
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
            if (first.telefon) setDetayTelefonNo((prev) => prev || first.telefon);
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

    // Kişi seçmede işlem tutarı MASAK sınırını (≥185.000 TL / 5.000 USD) aşıyorsa uyar (Tip 1 hariç)
    if (isMasakLimitExceeded && !isGayriResmi) {
      setShowMasakCustomerWarningModal(true);
    }
  }, [handleSearchMasak, isMasakLimitExceeded, tip, statisticList, selectedStatistic, istatistikFisDizaynTipi, istatistikId, istatistikKodu]);

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
    urun: { paraId?: number; kod?: string; urunTipi?: number; ad?: string },
    islemTip: 0 | 1
  ): number => {
    const pId = urun.paraId;
    const code = (urun.kod || "").toUpperCase().trim();
    const name = (urun.ad || "").toUpperCase().trim();

    if (code === "TL" || code === "TRY" || code === "TRL") return 1;

    // 1. Önce kur listesinde bu ürünün/paranın birebir özel kuru var mı bak
    const found = kurSatirlar.find((k) =>
      (pId && k.paraId === pId) ||
      (k.kod && k.kod.toUpperCase().trim() === code) ||
      (name && k.ad && k.ad.toUpperCase().trim() === name)
    );
    if (found) {
      const rate = islemTip === 0
        ? (found.dovizAlis ?? found.efektifAlis ?? found.dovizSatis ?? found.efektifSatis ?? 0)
        : (found.dovizSatis ?? found.efektifSatis ?? found.dovizAlis ?? found.efektifAlis ?? 0);
      if (Number(rate) > 0) return Number(rate);
    }

    // 2. Ürün Tipi Altın ise (1)
    if (urun.urunTipi === 1 || code.includes("HAS") || code.includes("ALTIN") || name.includes("ALTIN")) {
      if (Number(altinHasKuru) > 0) return Number(altinHasKuru);
      const hasKur = kurSatirlar.find((k) => ["HAS", "ALTIN", "HAS ALTIN", "HASALTIN"].includes((k.kod || "").toUpperCase().trim()));
      if (hasKur) {
        const rate = islemTip === 0 ? (hasKur.dovizAlis ?? hasKur.efektifAlis ?? 0) : (hasKur.dovizSatis ?? hasKur.efektifSatis ?? 0);
        if (Number(rate) > 0) return Number(rate);
      }
    }
    // 3. Ürün Tipi Gümüş ise (2)
    else if (urun.urunTipi === 2 || code.includes("GUMUS") || code.includes("GÜMÜŞ") || name.includes("GÜMÜŞ") || name.includes("GUMUS")) {
      if (Number(gumusHasKuru) > 0) return Number(gumusHasKuru);
      const gKur = kurSatirlar.find((k) => ["GUMUS", "GÜMÜŞ", "HAS GÜMÜŞ", "HAS GUMUS"].includes((k.kod || "").toUpperCase().trim()));
      if (gKur) {
        const rate = islemTip === 0 ? (gKur.dovizAlis ?? gKur.efektifAlis ?? 0) : (gKur.dovizSatis ?? gKur.efektifSatis ?? 0);
        if (Number(rate) > 0) return Number(rate);
      }
    }
    // 4. Diğer / Döviz ise (0)
    else if (urun.urunTipi === 0 || !urun.urunTipi) {
      const curKur = kurSatirlar.find((k) => (k.paraId && k.paraId === pId) || (k.kod && k.kod.toUpperCase().trim() === code) || (name && k.ad && k.ad.toUpperCase().trim() === name));
      if (curKur) {
        const rate = islemTip === 0 ? (curKur.dovizAlis ?? curKur.efektifAlis ?? 0) : (curKur.dovizSatis ?? curKur.efektifSatis ?? 0);
        if (Number(rate) > 0) return Number(rate);
      }
    }

    return Number(altinHasKuru) || 0;
  }, [kurSatirlar, altinHasKuru, gumusHasKuru]);

  // e-Banka'dan fiş kesiliyorsa banka tutarı (TL); miktarı boş ürün satırında miktar bu tutarın kalanından hesaplanır
  const ebHedefRef = useRef(0);

  // Ürün seçildiğinde veya kodu girildiğinde satırı otomatik doldurma & hesaplama yardımcısı
  const applyProductToRow = useCallback((
    rowId: string,
    item: UrunItem,
    overrideAdet?: number
  ) => {
    const k = (item.kod || "").trim().toUpperCase();
    if (k === "TL" || k === "TRY" || (item.ad || "").toUpperCase().includes("TÜRK LİRASI")) {
      showNotif("warning", "Sarraf fişinde kalemler tablosunda TL seçilemez.");
      return;
    }

    const autoKur = getKurForProduct(item, tip);
    const isPara = item.urunTipi === 0;
    const curHasKuru = autoKur > 0
      ? autoKur
      : (item.urunTipi === 1 ? (Number(altinHasKuru) || 0) : (item.urunTipi === 2 ? (Number(gumusHasKuru) || 0) : 0));

    setLines((prev) => prev.map((r) => {
      if (r.id !== rowId) return r;
      const rawAlis = item.alisMilyem !== undefined && item.alisMilyem !== null && Number(item.alisMilyem) > 0
        ? item.alisMilyem
        : (item.hasAlisKatsayisi && Number(item.hasAlisKatsayisi) > 0 ? item.hasAlisKatsayisi : item.hasOrani);
      const rawSatis = item.satisMilyem !== undefined && item.satisMilyem !== null && Number(item.satisMilyem) > 0
        ? item.satisMilyem
        : (item.hasSatisKatsayisi && Number(item.hasSatisKatsayisi) > 0 ? item.hasSatisKatsayisi : item.hasOrani);
      const rawHasOrani = tip === 0 ? rawAlis : rawSatis;

      const adet = isPara ? "" : (overrideAdet !== undefined ? overrideAdet : (Number(r.adet) > 0 ? Number(r.adet) : 1));
      const miktar = isPara ? (r.miktar || "") : (Number(item.gramaj) > 0 ? Number(item.gramaj) * (Number(adet) || 1) : (Number(r.miktar) > 0 ? Number(r.miktar) : ""));
      const iscilikiMiktari = isPara ? "" : (item.iscilik && Number(item.iscilik) > 0 ? Number(item.iscilik) : (r.iscilikiMiktari || ""));
      const milyem = isPara ? "" : ((rawHasOrani !== undefined && rawHasOrani !== null && Number(rawHasOrani) > 0)
        ? rawHasOrani
        : (r.milyem || ""));

      const updated: GridRow = {
        ...r,
        urunId: item.paraId,
        urunKodu: item.kod,
        urunAdi: item.ad,
        adet,
        miktar,
        milyem,
        iscilikHesaplamaSekli: isPara ? 0 : (r.iscilikHesaplamaSekli !== undefined && r.iscilikHesaplamaSekli !== null ? r.iscilikHesaplamaSekli : 0),
        iscilikiMiktari,
        iscilikHasGram: isPara ? "" : r.iscilikHasGram,
        hasGram: isPara ? "" : r.hasGram,
        urunTipi: item.urunTipi ?? 0,
        kur: autoKur > 0 ? autoKur : (curHasKuru > 0 ? curHasKuru : (r.kur || "")),
      };
      // e-Banka: miktar boşsa banka tutarının kalanı / (kur × milyem)
      if (ebHedefRef.current > 0 && !(parseDecimal(updated.miktar) > 0)) {
        const kalan = ebHedefRef.current - prev.filter((x) => x.id !== rowId).reduce((t, x) => t + parseDecimal(x.tutar), 0);
        const kurN = parseDecimal(updated.kur);
        const ham = parseDecimal(updated.milyem);
        const mil = isPara ? 1 : (ham > 1 ? (ham <= 100 ? ham / 100 : ham / 1000) : (ham > 0 ? ham : 1));
        if (kalan > 0 && kurN > 0) updated.miktar = parseFloat((kalan / (kurN * mil)).toFixed(isPara ? 2 : 3));
      }
      return recomputeRow(updated, curHasKuru);
    }));
  }, [tip, getKurForProduct, altinHasKuru, gumusHasKuru]);

  const applyProductToOdemeRow = useCallback((
    rowId: string,
    item: UrunItem,
    overrideAdet?: number
  ) => {
    const code = (item.kod || "").toUpperCase().trim();
    const isTL = code === "TL" || code === "TRY" || code === "TRL";
    const isPara = item.urunTipi === 0 || isTL;
    const autoKur = getKurForProduct(item, tip === 0 ? 0 : 1);
    const curHasKuru = Number(altinHasKuru) || 0;
    setOdemeRows((prev) => prev.map((r) => {
      if (r.id !== rowId) return r;
      const rawAlis = item.alisMilyem !== undefined && item.alisMilyem !== null && Number(item.alisMilyem) > 0
        ? item.alisMilyem
        : (item.hasAlisKatsayisi && Number(item.hasAlisKatsayisi) > 0 ? item.hasAlisKatsayisi : item.hasOrani);
      const rawSatis = item.satisMilyem !== undefined && item.satisMilyem !== null && Number(item.satisMilyem) > 0
        ? item.satisMilyem
        : (item.hasSatisKatsayisi && Number(item.hasSatisKatsayisi) > 0 ? item.hasSatisKatsayisi : item.hasOrani);
      const rawHasOrani = tip === 0 ? rawAlis : rawSatis;

      const adet = isPara ? "" : (overrideAdet !== undefined ? overrideAdet : (Number(r.adet) > 0 ? Number(r.adet) : 1));
      const miktar = isPara ? (r.miktar || "") : (Number(item.gramaj) > 0 ? Number(item.gramaj) * (Number(adet) || 1) : (Number(r.miktar) > 0 ? Number(r.miktar) : ""));
      const milyem = isPara ? "" : ((rawHasOrani !== undefined && rawHasOrani !== null && Number(rawHasOrani) > 0) ? rawHasOrani : (r.milyem || ""));
      const updated: OdemeRow = {
        ...r,
        paraId: item.paraId,
        paraKodu: item.kod,
        paraAdi: item.ad,
        adet,
        miktar,
        milyem,
        hasGram: isPara ? "" : r.hasGram,
        urunTipi: item.urunTipi ?? (isTL ? 0 : (item.kod?.length === 3 ? 0 : 1)),
        kur: isTL ? "" : (autoKur > 0 ? autoKur : (curHasKuru > 0 ? curHasKuru : (r.kur || ""))),
      };
      return recomputeOdemeRow(updated, curHasKuru);
    }));
  }, [tip, getKurForProduct, altinHasKuru]);

  // Satırın tamamen boş olup olmadığını kontrol eder
  const isSarrafRowCompletelyEmpty = useCallback((r?: GridRow): boolean => {
    if (!r) return true;
    const hasCode = Boolean((r.urunKodu && r.urunKodu.trim() !== "") || (r.urunAdi && r.urunAdi.trim() !== ""));
    const hasAdet = Boolean(r.adet && Number(r.adet) > 0);
    const hasMiktar = Boolean(r.miktar && parseDecimal(r.miktar) > 0);
    const hasTutar = Boolean(r.tutar && parseDecimal(r.tutar) > 0);
    return !hasCode && !hasAdet && !hasMiktar && !hasTutar;
  }, []);

  // Satırın geçerli şekilde doldurulup doldurulmadığını kontrol eder
  const isSarrafRowFilled = useCallback((r?: GridRow): boolean => {
    if (!r) return false;
    const hasCode = Boolean(r.urunKodu && r.urunKodu.trim() !== "");
    const hasMiktarOrAdet = Boolean((r.miktar && parseDecimal(r.miktar) > 0) || (r.adet && Number(r.adet) > 0));
    const hasKurOrTutar = Boolean((r.kur && parseDecimal(r.kur) > 0) || (r.tutar && parseDecimal(r.tutar) > 0));
    return hasCode && hasMiktarOrAdet && hasKurOrTutar;
  }, []);

  // Boş satırları otomatik temizler (Kalemler - İlk satır daima korunur)
  const cleanupEmptyRows = useCallback((keepActiveIndex?: number | null) => {
    setLines((prev) => {
      if (prev.length <= 1) return prev;
      const filtered = prev.filter((r, idx) => {
        if (idx === 0) return true; // İlk satır daima korunur
        if (keepActiveIndex !== undefined && keepActiveIndex !== null && idx === keepActiveIndex) return true;
        return !isSarrafRowCompletelyEmpty(r);
      });
      if (filtered.length === prev.length) return prev;
      const finalLines = filtered.length > 0 ? filtered : [createEmptyRow(1)];
      return finalLines.map((r, i) => ({ ...r, satirNo: i + 1 }));
    });
  }, [isSarrafRowCompletelyEmpty]);

  // Satırın tamamen boş olup olmadığını kontrol eder (Ödeme / Tahsilat)
  const isOdemeRowCompletelyEmpty = useCallback((r?: OdemeRow): boolean => {
    if (!r) return true;
    const hasSpecialCode = Boolean(
      (r.paraKodu && r.paraKodu.trim() !== "" && r.paraKodu.toUpperCase() !== "TL" && r.paraKodu.toUpperCase() !== "TRY") ||
      (r.paraAdi && r.paraAdi.trim() !== "" && r.paraAdi.toUpperCase() !== "TÜRK LİRASI" && r.paraAdi.toUpperCase() !== "TURK LIRASI")
    );
    const hasAdet = Boolean(r.adet && Number(r.adet) > 0);
    const hasMiktar = Boolean(r.miktar && parseDecimal(r.miktar) > 0);
    const hasTutar = Boolean(r.tutar && parseDecimal(r.tutar) > 0);
    const hasHasGram = Boolean(r.hasGram && parseDecimal(r.hasGram) > 0);
    return !hasSpecialCode && !hasAdet && !hasMiktar && !hasTutar && !hasHasGram;
  }, []);

  // Satırın geçerli şekilde doldurulup doldurulmadığını kontrol eder (Ödeme / Tahsilat)
  const isOdemeRowFilled = useCallback((r?: OdemeRow): boolean => {
    if (!r) return false;
    const hasCode = Boolean(r.paraKodu && r.paraKodu.trim() !== "");
    const isPara = (r.urunTipi === 0 || r.urunTipi === undefined || r.urunTipi === null || r.paraKodu?.toUpperCase() === "TL" || r.paraKodu?.toUpperCase() === "TRY");
    const hasMiktarOrAdet = isPara
      ? Boolean(r.miktar && parseDecimal(r.miktar) > 0)
      : Boolean((r.miktar && parseDecimal(r.miktar) > 0) || (r.adet && Number(r.adet) > 0));
    const hasKurOrTutar = Boolean((r.kur && parseDecimal(r.kur) > 0) || (r.tutar && parseDecimal(r.tutar) > 0));
    return hasCode && hasMiktarOrAdet && hasKurOrTutar;
  }, []);

  // Boş satırları otomatik temizler (Ödeme / Tahsilat - İlk satır daima korunur)
  const cleanupEmptyOdemeRows = useCallback((keepActiveIndex?: number | null) => {
    setOdemeRows((prev) => {
      if (prev.length <= 1) return prev;
      const filtered = prev.filter((r, idx) => {
        if (idx === 0) return true; // İlk satır daima korunur
        if (keepActiveIndex !== undefined && keepActiveIndex !== null && idx === keepActiveIndex) return true;
        return !isOdemeRowCompletelyEmpty(r);
      });
      if (filtered.length === prev.length) return prev;
      const finalRows = filtered.length > 0 ? filtered : [createEmptyOdemeRow(1)];
      return finalRows.map((r, i) => ({ ...r, satirNo: i + 1 }));
    });
  }, [isOdemeRowCompletelyEmpty]);

  // Tablolardan farklı bir yere tıklandığında tamamen boş satırları otomatik kapat
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
            adet: "",
            miktar: kalanTL > 0 ? kalanTL : "",
            kur: "",
            tutar: kalanTL > 0 ? kalanTL : "",
            hasGram: "",
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

  const normalizeRowOnBlur = useCallback((rowId: string, field: keyof GridRow) => {
    setInvalidRowIds((prev) => ({ ...prev, [rowId]: true }));
    setLines((prev) => prev.map((r) => {
      if (r.id !== rowId) return r;
      const val = r[field];
      if (typeof val === "string" && (val.startsWith(",") || val.startsWith("."))) {
        const normalized = "0" + val;
        const curHasKuru = Number(altinHasKuru) || 0;
        return recomputeRow({ ...r, [field]: normalized }, curHasKuru, field);
      }
      return r;
    }));
  }, [altinHasKuru]);

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
      const isTL = r.paraKodu?.toUpperCase() === "TL" || r.paraKodu?.toUpperCase() === "TRY";
      const isKart = r.odemeAraciTuru === 2;
      let effectiveVal = sanitizedValue;
      if (field === "kur" && (isTL || isKart)) {
        effectiveVal = 1;
      }
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
      const u = { ...r, miktar, [field]: effectiveVal };
      return recomputeOdemeRow(u, curHasKuru, field);
    }));
  }, [altinHasKuru, urunList]);

  const normalizeOdemeRowOnBlur = useCallback((rowId: string, field: keyof OdemeRow) => {
    setInvalidOdemeRowIds((prev) => ({ ...prev, [rowId]: true }));
    setOdemeRows((prev) => prev.map((r) => {
      if (r.id !== rowId) return r;
      const val = r[field];
      if (typeof val === "string" && (val.startsWith(",") || val.startsWith("."))) {
        const normalized = "0" + val;
        const curHasKuru = Number(altinHasKuru) || 0;
        return recomputeOdemeRow({ ...r, [field]: normalized }, curHasKuru, field);
      }
      return r;
    }));
  }, [altinHasKuru]);

  const handleDeleteLine = useCallback((rowId: string) => {
    setInvalidRowIds((prev) => {
      const next = { ...prev };
      delete next[rowId];
      return next;
    });
    setLines((prev) => {
      if (prev.length <= 1) {
        return [createEmptyRow(1)];
      }
      const filtered = prev.filter((r) => r.id !== rowId);
      return filtered.map((r, idx) => ({ ...r, satirNo: idx + 1 }));
    });
  }, []);

  const handleDeleteOdemeRow = useCallback((rowId: string) => {
    setInvalidOdemeRowIds((prev) => {
      const next = { ...prev };
      delete next[rowId];
      return next;
    });
    setOdemeRows((prev) => {
      if (prev.length <= 1) {
        return [createEmptyOdemeRow(1)];
      }
      const filtered = prev.filter((r) => r.id !== rowId);
      return filtered.map((r, idx) => ({ ...r, satirNo: idx + 1 }));
    });
  }, []);

  const focusGridCell = useCallback((
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
  }, []);

  const focusOdemeGridCell = useCallback((
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
  }, []);

  const handleAddSarrafRow = useCallback(() => {
    const newRow = createEmptyRow(lines.length + 1);
    setLines((prev) => [...prev, newRow]);
    setActiveRowIndex(lines.length);
    setTimeout(() => focusGridCell(newRow.id, "urunKodu", "select"), 30);
    return true;
  }, [lines.length, focusGridCell]);

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
    setTimeout(() => focusOdemeGridCell(newRow.id, "odemeAraciTuru", "select"), 20);
    setTimeout(() => focusOdemeGridCell(newRow.id, "odemeAraciTuru", "select"), 80);
    return true;
  }, [odemeRows.length, focusOdemeGridCell]);

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
        handleAddSarrafRow();
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
  }, [handleDeleteLine, handleDeleteOdemeRow, handleKapatRow, odemeRows, handleAddSarrafRow]);

  // Bildirimlerin belli süre sonra otomatik kaybolması
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 1750);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Open product modal with eager data fetch if not empty
  const openUrunModal = useCallback(async (rowId: string, initialSearch?: string) => {
    const row = lines.find((r) => r.id === rowId);
    const search = initialSearch !== undefined ? initialSearch.trim() : (row?.urunKodu || "").trim();
    activeRowIdForUrunRef.current = rowId;
    activeOdemeRowIdForUrunRef.current = null;
    setActiveRowIdForUrun(rowId);
    setActiveOdemeRowIdForUrun(null);
    setUrunSearchTerm(search);
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
  }, [lines, urunList.length]);

  const openOdemeUrunModal = useCallback(async (rowId: string, initialSearch?: string) => {
    const row = odemeRows.find((r) => r.id === rowId);
    const search = initialSearch !== undefined ? initialSearch.trim() : (row?.paraKodu || "").trim();
    activeOdemeRowIdForUrunRef.current = rowId;
    activeRowIdForUrunRef.current = null;
    setActiveOdemeRowIdForUrun(rowId);
    setActiveRowIdForUrun(null);
    setUrunSearchTerm(search);
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
  }, [odemeRows, urunList.length]);

  const openCariModalForOdeme = useCallback((rowId: string, searchVal?: string) => {
    const row = odemeRows.find((r) => r.id === rowId);
    lastModalCallerRef.current = "gridOdeme";
    lastOdemeModalRowIdRef.current = rowId;
    setCariSearchTerm(searchVal !== undefined ? searchVal : (row?.cariKod || ""));
    setCariSearchField("kod");
    setShowCariModal(true);
    if (cariList.length === 0) {
      CariService.getCariKartlar().then((r) => setCariList(r || [])).catch(() => {});
      DovizFisService.getKayitsizMusteriler().then((r) => setKayitsizMusteriList(r || [])).catch(() => {});
    }
  }, [odemeRows, cariList.length]);

  const applyCariToOdemeRow = useCallback((rowId: string, item: CariKartItem) => {
    const curHasKuru = Number(altinHasKuru) || 0;
    setOdemeRows((prev) => prev.map((r) => {
      if (r.id !== rowId) return r;
      const updated: OdemeRow = {
        ...r,
        odemeAraciTuru: 1,
        cariKartId: item.id,
        cariKod: item.kod || "",
        cariUnvan: item.ad || "",
        bankaId: null,
        posCihaziId: null,
        iskontoId: null,
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
      return recomputeOdemeRow(updated, curHasKuru);
    }));
  }, [altinHasKuru]);

  const applyIskontoToOdemeRow = useCallback((rowId: string, item: IskontoItem) => {
    const curHasKuru = Number(altinHasKuru) || 0;
    let discountAmount = 0;
    if (item.iskontoTipi === 1) {
      const oranVal = Number(item.oran) || 0;
      discountAmount = Math.round(((totalTutar * oranVal) / 100) * 100) / 100;
    } else if (item.iskontoTipi === 2) {
      const tutarVal = Number(item.tutar) || 0;
      discountAmount = totalTutar > 0 ? Math.min(totalTutar, tutarVal) : tutarVal;
    } else if (item.iskontoTipi === 3) {
      const hasVal = Number(item.hasTutar) || 0;
      const hasKur = curHasKuru > 0 ? curHasKuru : 1;
      discountAmount = Math.round(hasVal * hasKur * 100) / 100;
      if (totalTutar > 0) discountAmount = Math.min(totalTutar, discountAmount);
    } else {
      discountAmount = Number(item.tutar) || 0;
    }

    const maxCap = Number(item.maxIskontoTutari) || 0;
    if (maxCap > 0 && discountAmount > maxCap) {
      discountAmount = maxCap;
    }

    let iskKurVal: number | string = 1;
    if (item.iskontoTipi === 1) {
      iskKurVal = Number(item.oran) || 0;
    } else if (item.iskontoTipi === 2) {
      iskKurVal = Number(item.tutar) || 0;
    } else if (item.iskontoTipi === 3) {
      iskKurVal = curHasKuru > 0 ? curHasKuru : 1;
    } else if (item.oran) {
      iskKurVal = Number(item.oran) || 0;
    } else if (item.tutar) {
      iskKurVal = Number(item.tutar) || 0;
    }

    const iskKod = (item.kod || `ISK-${item.iskontoId}`).toUpperCase().trim();
    const iskAd = item.tanim ? (item.tanim.toUpperCase().includes("İSKONTO") || item.tanim.toUpperCase().includes("ISKONTO") ? item.tanim : `İSKONTO - ${item.tanim}`) : "İSKONTO";
    const finalAmount = discountAmount > 0 ? discountAmount : (item.tutar || item.oran || "");

    setOdemeRows((prev) => prev.map((r) => {
      if (r.id !== rowId) return r;
      const updated: OdemeRow = {
        ...r,
        odemeAraciTuru: 1,
        iskontoId: item.iskontoId || null,
        paraId: null,
        paraKodu: iskKod,
        paraAdi: iskAd,
        adet: "",
        miktar: finalAmount,
        milyem: item.oran ? String(item.oran) : "",
        hasGram: item.hasTutar ? String(item.hasTutar) : "",
        kur: iskKurVal,
        tutar: finalAmount,
      };
      return updated;
    }));
  }, [totalTutar, altinHasKuru]);

  const openOdemeParaIskontoModal = useCallback((rowId: string, initialSearch?: string) => {
    setTargetOdemeRowIdForLookup(rowId);
    setShowOdemeParaIskontoModal(true);
    if (iskontoList.length === 0) {
      IskontoService.getIskontolar({ aktif: true }).then((r) => setIskontoList(r || [])).catch(() => {});
    }
  }, [iskontoList.length]);

  const applyPosToOdemeRow = useCallback((rowId: string, item: PosCihaziItem) => {
    const curHasKuru = Number(altinHasKuru) || 0;
    setOdemeRows((prev) => prev.map((r) => {
      if (r.id !== rowId) return r;
      const updated: OdemeRow = {
        ...r,
        odemeAraciTuru: 2,
        posCihaziId: item.posCihaziId || null,
        bankaId: item.posCihaziId || null,
        cariKartId: null,
        cariKod: item.kod || "",
        iskontoId: null,
        paraId: null,
        paraKodu: "TL",
        paraAdi: item.ad || "KREDİ KARTI / POS",
        adet: "",
        milyem: "",
        hasGram: "",
        urunTipi: 0,
        kur: 1,
      };
      return recomputeOdemeRow(updated, curHasKuru);
    }));
  }, [altinHasKuru]);

  const applyHesapToOdemeRow = useCallback((rowId: string, item: BankaHesapItem) => {
    const curHasKuru = Number(altinHasKuru) || 0;
    setOdemeRows((prev) => prev.map((r) => {
      if (r.id !== rowId) return r;
      const updated: OdemeRow = {
        ...r,
        odemeAraciTuru: 3,
        bankaId: item.bankaId || null,
        cariKartId: null,
        cariKod: item.hesapNo || "",
        paraId: null,
        paraKodu: "TL",
        paraAdi: item.hesapAdi ? `${item.bankaAdi ? item.bankaAdi + " - " : ""}${item.hesapAdi}` : (item.bankaAdi || "BANKA HAVALE / EFT"),
        adet: "",
        milyem: "",
        hasGram: "",
        urunTipi: 0,
        kur: 1,
      };
      return recomputeOdemeRow(updated, curHasKuru);
    }));
  }, [altinHasKuru]);

  const openOdemeLookup = useCallback(async (rowId: string, initialSearch?: string) => {
    const row = odemeRows.find((r) => r.id === rowId);
    const search = initialSearch !== undefined ? initialSearch.trim() : (row?.cariKod || row?.paraKodu || "").trim();
    const tur = row?.odemeAraciTuru ?? 0;
    setTargetOdemeRowIdForLookup(rowId);
    setOdemeLookupSearchTerm(search);
    if (tur === 1) { // Cari: Para / İskonto seçimi
      openOdemeParaIskontoModal(rowId, search);
    } else if (tur === 0) { // Vezne: Para / Döviz / Has / Ürün seçimi
      openOdemeUrunModal(rowId, search);
    } else if (tur === 2) { // POS
      if (posList.length === 0) {
        try {
          const p = await PosCihaziService.getPosCihazlari();
          if (p && p.length > 0) setPosList(p);
        } catch { }
      }
      setShowOdemePosModal(true);
    } else if (tur === 3) { // Hesap
      if (bankaList.length === 0) {
        try {
          const b = await BankaService.getBankalar({ aktif: true });
          if (b && b.length > 0) setBankaList(b);
        } catch { }
      }
      setShowOdemeHesapModal(true);
    }
  }, [odemeRows, openOdemeUrunModal, openOdemeParaIskontoModal, posList.length, bankaList.length]);

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

  // ─── Keyboard Navigation: Header Fields ──────────────────────────────────────
  const handleHeaderKeyDown = async (
    e: React.KeyboardEvent<any>,
    field: "islem" | "tckn" | "kodu" | "ad" | "zamanTarih" | "zamanSaat" | "seriNo" | "belgeNo" | "istatistik" | "hasKuru" | "kdvOrani"
  ) => {
    if (isAnyModalOpen) return;
    const { isAtStart, isAtEnd } = getSelectionBounds(e.currentTarget);

    if (e.key === "Enter") {
      e.preventDefault();
      if (field === "islem") {
        tcknRef.current?.focus();
      } else if (field === "tckn") {
        const val = (detayKimlikBelgeTuru === 1 ? detayPasaportNo : detayVergiKimlikNo).trim();
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
        const { cariler, kayitsizlar, totalCount } = findMatchingCustomers("vkn", val);
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
          lastFocusedVknRef.current = val;
          cariKodRef.current?.focus();
          cariKodRef.current?.select();
          return;
        }
        if (totalCount === 0 && (val.length === 10 || val.length === 11)) {
          try {
            const res = await ebelgeService.mukellefSorgula(val);
            if (res && res.mukellefMi && res.kullanicilar && res.kullanicilar.length > 0) {
              const title = (res.kullanicilar[0].Title || "").trim();
              if (title) {
                setUnvan(title);
                setDetayUnvan(title);
                setDetayVergiKimlikNo(val);
                lastFocusedVknRef.current = val;
                lastFocusedUnvanRef.current = title;
                try {
                  const adrRes = await ebelgeService.aliciAdresleri(val);
                  if (Array.isArray(adrRes) && adrRes.length > 0) {
                    const first = adrRes[0];
                    const comb = [first.adres, first.ilce, first.il].filter(Boolean).join(" ");
                    if (comb) setDetayAdres(comb);
                  }
                } catch { }
                setNotification({ type: "info", message: `✅ e-Fatura Mükellefi (${title}) bilgileri e-Fatura sisteminden getirildi.` });
                cariKodRef.current?.focus();
                cariKodRef.current?.select();
                return;
              }
            }
          } catch { }
        }
        lastModalCallerRef.current = "vkn";
        setCariSearchTerm(val);
        setCariSearchField("vkn");
        setShowCariModal(true);
      } else if (field === "kodu") {
        const val = (cariKod || "").trim();
        const prevVal = (lastFocusedCariKodRef.current || "").trim();
        if (val && val.toLowerCase() === prevVal.toLowerCase()) {
          adRef.current?.focus();
          adRef.current?.select();
          return;
        }
        if (!val) {
          adRef.current?.focus();
          adRef.current?.select();
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
          adRef.current?.focus();
          adRef.current?.select();
          return;
        }
        lastModalCallerRef.current = "cariKod";
        setCariSearchTerm(val);
        setCariSearchField("kod");
        setShowCariModal(true);
      } else if (field === "ad") {
        const raw = (unvan || "").trim();
        if (isAnonymousCustomerName(raw)) {
          seriNoRef.current?.focus();
          return;
        }
        const val = raw;
        const prevVal = (lastFocusedUnvanRef.current || "").trim();
        if (val && val.toLowerCase() === prevVal.toLowerCase()) {
          seriNoRef.current?.focus();
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
          seriNoRef.current?.focus();
          return;
        }
        lastModalCallerRef.current = "unvan";
        setCariSearchTerm(val);
        setCariSearchField("unvan");
        setShowCariModal(true);
      } else if (field === "seriNo") {
        belgeNoRef.current?.focus();
      } else if (field === "belgeNo") {
        istatistikRef.current?.focus();
        istatistikRef.current?.select();
      } else if (field === "istatistik") {
        const val = (istatistikKodu || "").trim();
        const prevVal = (lastFocusedIstatistikKodRef.current || "").trim();
        if (val && val.toLowerCase() === prevVal.toLowerCase()) {
          hasKuruRef.current?.focus();
          hasKuruRef.current?.select();
          return;
        }
        if (!val) {
          hasKuruRef.current?.focus();
          hasKuruRef.current?.select();
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
          setIstatistikId(single.id);
          setIstatistikKodu(single.kod);
          setSelectedStatistic(single);
          setIstatistikFisDizaynTipi(Number(single.fisDizaynTipi));
          lastFocusedIstatistikKodRef.current = single.kod;
          setTimeout(() => {
            hasKuruRef.current?.focus();
            hasKuruRef.current?.select();
          }, 50);
          return;
        }
        lastModalCallerRef.current = "istatistik";
        setIstatistikSearchTerm(val);
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
      if (field === "islem" || field === "tckn") seriNoRef.current?.focus();
      else if (field === "kodu") belgeNoRef.current?.focus();
      else if (field === "ad") istatistikRef.current?.focus();
      else if (["seriNo", "belgeNo", "istatistik", "hasKuru", "kdvOrani"].includes(field)) {
        if (lines.length > 0) {
          setActiveRowIndex(0);
          focusGridCell(lines[0].id, "urunKodu", "select");
        }
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (field === "seriNo" || field === "belgeNo") cariKodRef.current?.focus();
      else if (field === "istatistik" || field === "hasKuru" || field === "kdvOrani") adRef.current?.focus();
    } else if (e.key === "ArrowRight") {
      if (isAtEnd) {
        e.preventDefault();
        if (field === "islem") tcknRef.current?.focus();
        else if (field === "tckn") cariKodRef.current?.focus();
        else if (field === "kodu") adRef.current?.focus();
        else if (field === "ad") seriNoRef.current?.focus();
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
        else if (field === "seriNo") adRef.current?.focus();
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
    if (isAnyModalOpen) return;
    const colIdx = GRID_COLS.indexOf(colKey);
    const totalCols = GRID_COLS.length;
    const { isAtStart, isAtEnd } = getSelectionBounds(e.currentTarget);

    // ESC altındaki " tuşuna basınca üst satırdaki hücre değerini kopyala (Sadece tablolarda geçerli)
    if (e.key === '"' || e.key === '“' || e.key === '”' || e.key === '„' || e.key === '«' || e.key === '»' || e.key === 'é' || e.key === 'É' || e.key === '`' || e.key === '´' || e.key === '§' || e.code === "Backquote" || (e.code === "Digit2" && e.shiftKey) || e.keyCode === 222 || e.keyCode === 192) {
      e.preventDefault();
      e.stopPropagation();
      if (rowIndex > 0) {
        const prevRow = lines[rowIndex - 1];
        const prevVal = prevRow[colKey as keyof GridRow];
        updateRow(rowId, colKey as keyof GridRow, prevVal !== undefined && prevVal !== null ? prevVal : "");
        setTimeout(() => focusGridCell(rowId, colKey, "select"), 20);
      }
      return;
    }

    const isColPassive = (col: GridColKey, rIdx: number = rowIndex) => {
      if (col === "urunAdi" || col === "hasGram" || col === "iscilikHasGram" || col === "tutar") return true;
      const currentRow = lines[rIdx];
      const isPara = currentRow && currentRow.urunTipi === 0 && Boolean(currentRow.urunKodu && currentRow.urunKodu.trim());
      if (isPara && (col === "adet" || col === "milyem" || col === "iscilikHesaplamaSekli" || col === "iscilikiMiktari")) {
        return true;
      }
      return false;
    };

    if (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) {
      e.preventDefault();
      // On urunKodu, try to resolve product or open lookup with typed text
      if (colKey === "urunKodu") {
        const row = lines[rowIndex];
        const val = (row.urunKodu || "").trim();
        const kUpper = val.toUpperCase();
        if (kUpper === "TL" || kUpper === "TRY") {
          showNotif("warning", "Sarraf fişinde kalemler tablosunda TL seçilemez.");
          updateRow(rowId, "urunKodu", "");
          return;
        }
        if (!val) {
          // Boş ise dürbün açılmaz, bir sonraki alana geçilir
          let nextIdx = colIdx + 1;
          while (nextIdx < totalCols && isColPassive(GRID_COLS[nextIdx])) {
            nextIdx++;
          }
          if (nextIdx < totalCols) {
            focusGridCell(rowId, GRID_COLS[nextIdx], "select");
          }
          return;
        }
        const matches = urunList.filter((u) => {
          const t = val.toLowerCase();
          return (
            (u.kod || "").toLowerCase().includes(t) ||
            (u.ad || "").toLowerCase().includes(t) ||
            ((u as any).barkod || "").toLowerCase().includes(t) ||
            ((u as any).model || "").toLowerCase().includes(t) ||
            ((u as any).ayar || "").toLowerCase().includes(t) ||
            ((u as any).grupKodu || "").toLowerCase().includes(t) ||
            ((u as any).aciklama || "").toLowerCase().includes(t) ||
            ((u as any).mamulTipi || "").toLowerCase().includes(t)
          );
        });
        if (matches.length === 1) {
          lastModalCallerRef.current = null;
          lastKalemModalRowIdRef.current = null;
          applyProductToRow(rowId, matches[0]);
          const isPara = matches[0].urunTipi === 0;
          setTimeout(() => focusGridCell(rowId, isPara ? "miktar" : "adet", "select"), 20);
          return;
        } else {
          lastModalCallerRef.current = "gridKalem";
          lastKalemModalRowIdRef.current = rowId;
          openUrunModal(rowId, val);
          return;
        }
      }

      // Next column in same row (skipping readonly/disabled fields including tutar)
      let nextIdx = colIdx + 1;
      while (nextIdx < totalCols && isColPassive(GRID_COLS[nextIdx])) {
        nextIdx++;
      }

      if (nextIdx < totalCols) {
        const nk = GRID_COLS[nextIdx];
        focusGridCell(rowId, nk, "select");
      } else {
        // Last column in row -> jump to next row or add row via handleAddSarrafRow
        if (rowIndex < lines.length - 1) {
          const nr = lines[rowIndex + 1];
          setActiveRowIndex(rowIndex + 1);
          focusGridCell(nr.id, "urunKodu", "select");
        } else {
          handleAddSarrafRow();
        }
      }
    } else if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault();
      let prevIdx = colIdx - 1;
      while (prevIdx >= 0 && isColPassive(GRID_COLS[prevIdx])) {
        prevIdx--;
      }
      if (prevIdx >= 0) {
        const pk = GRID_COLS[prevIdx];
        focusGridCell(rowId, pk, "select");
      } else if (rowIndex > 0) {
        const pr = lines[rowIndex - 1];
        setActiveRowIndex(rowIndex - 1);
        let prevRowLastCol: GridColKey = "kur";
        for (let i = totalCols - 1; i >= 0; i--) {
          if (!isColPassive(GRID_COLS[i], rowIndex - 1)) {
            prevRowLastCol = GRID_COLS[i];
            break;
          }
        }
        focusGridCell(pr.id, prevRowLastCol, "select");
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (rowIndex < lines.length - 1) {
        const nr = lines[rowIndex + 1];
        setActiveRowIndex(rowIndex + 1);
        focusGridCell(nr.id, colKey, "select");
      } else {
        handleAddSarrafRow();
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
      const isPassive = isColPassive(colKey);
      if (isPassive || isAtEnd) {
        e.preventDefault();
        let nextIdx = colIdx + 1;
        while (nextIdx < totalCols && isColPassive(GRID_COLS[nextIdx])) {
          nextIdx++;
        }
        if (nextIdx < totalCols) {
          const nk = GRID_COLS[nextIdx];
          focusGridCell(rowId, nk, "start");
        } else if (rowIndex < lines.length - 1) {
          const nr = lines[rowIndex + 1];
          setActiveRowIndex(rowIndex + 1);
          focusGridCell(nr.id, "urunKodu", "start");
        } else {
          handleAddSarrafRow();
        }
      }
    } else if (e.key === "ArrowLeft") {
      const isPassive = isColPassive(colKey);
      if (isPassive || isAtStart) {
        e.preventDefault();
        let prevIdx = colIdx - 1;
        while (prevIdx >= 0 && isColPassive(GRID_COLS[prevIdx])) {
          prevIdx--;
        }
        if (prevIdx >= 0) {
          const pk = GRID_COLS[prevIdx];
          focusGridCell(rowId, pk, "end");
        } else if (rowIndex > 0) {
          const pr = lines[rowIndex - 1];
          setActiveRowIndex(rowIndex - 1);
          let prevRowLastCol: GridColKey = "kur";
          for (let i = totalCols - 1; i >= 0; i--) {
            if (!isColPassive(GRID_COLS[i], rowIndex - 1)) {
              prevRowLastCol = GRID_COLS[i];
              break;
            }
          }
          focusGridCell(pr.id, prevRowLastCol, "end");
        }
      }
    }
  }, [lines, urunList, updateRow, altinHasKuru, applyProductToRow, openUrunModal, handleAddSarrafRow, isAnyModalOpen]);

  const handleOdemeGridKeyDown = useCallback((
    e: React.KeyboardEvent<HTMLElement>,
    rowIndex: number,
    colKey: OdemeColKey,
    rowId: string
  ) => {
    if (isAnyModalOpen) return;
    const colIdx = ODEME_COLS.indexOf(colKey);
    const totalCols = ODEME_COLS.length;
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

    const isOdemeColPassive = (col: OdemeColKey, rIdx: number = rowIndex) => {
      if (col === "paraAdi" || col === "hasGram" || col === "tutar" || col === "kur") return true;
      const currentRow = odemeRows[rIdx];
      const tur = currentRow?.odemeAraciTuru ?? 0;
      if (col === "cariKod" && tur === 0) {
        return true;
      }
      const isTL = currentRow?.paraKodu?.toUpperCase() === "TL" || currentRow?.paraKodu?.toUpperCase() === "TRY";
      const isPara = Boolean(
        !currentRow ||
        currentRow.urunTipi === 0 ||
        currentRow.urunTipi === undefined ||
        currentRow.urunTipi === null ||
        isTL
      );
      if (isPara && (col === "adet" || col === "milyem")) {
        return true;
      }
      return false;
    };

    const { isAtStart, isAtEnd } = getSelectionBounds(e.currentTarget);

    if (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) {
      e.preventDefault();
      if (colKey === "odemeAraciTuru") {
        const row = odemeRows[rowIndex];
        const tur = row?.odemeAraciTuru ?? 0;
        if (tur === 1 || tur === 2 || tur === 3) {
          focusOdemeGridCell(rowId, "cariKod", "select");
        } else {
          focusOdemeGridCell(rowId, "paraKodu", "select");
        }
        return;
      }

      if (colKey === "cariKod") {
        const row = odemeRows[rowIndex];
        const val = (row.cariKod || "").trim();
        const tur = row.odemeAraciTuru ?? 0;

        if (tur === 1) { // CARI
          if (!val) {
            focusOdemeGridCell(rowId, "paraKodu", "select");
            return;
          }
          const matches = cariList.filter((c) =>
            (c.kod || "").toLowerCase().includes(val.toLowerCase())
          );
          if (matches.length === 1) {
            lastModalCallerRef.current = null;
            lastOdemeModalRowIdRef.current = null;
            applyCariToOdemeRow(rowId, matches[0]);
            setTimeout(() => focusOdemeGridCell(rowId, "paraKodu", "select"), 20);
            return;
          } else {
            lastModalCallerRef.current = "gridOdeme";
            lastOdemeModalRowIdRef.current = rowId;
            openCariModalForOdeme(rowId, val);
            return;
          }
        } else if (tur === 2) { // POS
          if (!val) {
            focusOdemeGridCell(rowId, "miktar", "select");
            return;
          }
          const matches = posList.filter((p) =>
            (p.kod || "").toLowerCase().includes(val.toLowerCase()) ||
            (p.ad || "").toLowerCase().includes(val.toLowerCase())
          );
          if (matches.length === 1) {
            lastModalCallerRef.current = null;
            lastOdemeModalRowIdRef.current = null;
            applyPosToOdemeRow(rowId, matches[0]);
            setTimeout(() => focusOdemeGridCell(rowId, "miktar", "select"), 20);
            return;
          } else {
            lastModalCallerRef.current = "gridOdeme";
            lastOdemeModalRowIdRef.current = rowId;
            openOdemeLookup(rowId, val);
            return;
          }
        } else if (tur === 3) { // HESAP
          if (!val) {
            focusOdemeGridCell(rowId, "miktar", "select");
            return;
          }
          const matches = bankaList.filter((b) =>
            (b.hesapNo || "").toLowerCase().includes(val.toLowerCase()) ||
            (b.iban || "").toLowerCase().includes(val.toLowerCase()) ||
            (b.hesapAdi || "").toLowerCase().includes(val.toLowerCase())
          );
          if (matches.length === 1) {
            lastModalCallerRef.current = null;
            lastOdemeModalRowIdRef.current = null;
            applyHesapToOdemeRow(rowId, matches[0]);
            setTimeout(() => focusOdemeGridCell(rowId, "miktar", "select"), 20);
            return;
          } else {
            lastModalCallerRef.current = "gridOdeme";
            lastOdemeModalRowIdRef.current = rowId;
            openOdemeLookup(rowId, val);
            return;
          }
        }
      }

      if (colKey === "paraKodu") {
        const row = odemeRows[rowIndex];
        const val = (row.paraKodu || "").trim();
        const kUpper = val.toUpperCase();
        const isCari = row.odemeAraciTuru === 1;

        if (isCari && !val) {
          focusOdemeGridCell(rowId, "miktar", "select");
          return;
        }

        if (kUpper === "TL" || kUpper === "TRY" || (!isCari && !val)) {
          lastModalCallerRef.current = null;
          lastOdemeModalRowIdRef.current = null;
          setOdemeRows((prev) => prev.map((r) => {
            if (r.id !== rowId) return r;
            return {
              ...r,
              paraId: null,
              paraKodu: "TL",
              paraAdi: "TÜRK LİRASI",
              adet: "",
              kur: 1,
              milyem: "",
              hasGram: "",
              urunTipi: 0,
            };
          }));
          setTimeout(() => focusOdemeGridCell(rowId, "miktar", "select"), 20);
          return;
        }

        if (isCari) {
          const iskMatches = iskontoList.filter((isk) =>
            (isk.kod || "").toLowerCase().includes(val.toLowerCase())
          );
          const prodMatches = urunList.filter((u) =>
            (u.kod || "").toLowerCase().includes(val.toLowerCase())
          );

          if (iskMatches.length === 1 && prodMatches.length === 0) {
            lastModalCallerRef.current = null;
            lastOdemeModalRowIdRef.current = null;
            applyIskontoToOdemeRow(rowId, iskMatches[0]);
            setTimeout(() => focusOdemeGridCell(rowId, "tutar", "select"), 20);
            return;
          } else if (prodMatches.length === 1 && iskMatches.length === 0) {
            lastModalCallerRef.current = null;
            lastOdemeModalRowIdRef.current = null;
            const found = prodMatches[0];
            applyProductToOdemeRow(rowId, found);
            const isPara = found.urunTipi === 0 || found.kod?.toUpperCase() === "TL" || found.kod?.toUpperCase() === "TRY";
            setTimeout(() => focusOdemeGridCell(rowId, isPara ? "miktar" : "adet", "select"), 20);
            return;
          } else {
            lastModalCallerRef.current = "gridOdeme";
            lastOdemeModalRowIdRef.current = rowId;
            openOdemeParaIskontoModal(rowId, val);
            return;
          }
        }

        const matches = urunList.filter((u) =>
          (u.kod || "").toLowerCase().includes(val.toLowerCase())
        );

        if (matches.length === 1) {
          lastModalCallerRef.current = null;
          lastOdemeModalRowIdRef.current = null;
          const found = matches[0];
          applyProductToOdemeRow(rowId, found);
          const isPara = found.urunTipi === 0 || found.kod?.toUpperCase() === "TL" || found.kod?.toUpperCase() === "TRY";
          setTimeout(() => focusOdemeGridCell(rowId, isPara ? "miktar" : "adet", "select"), 20);
          return;
        } else {
          lastModalCallerRef.current = "gridOdeme";
          lastOdemeModalRowIdRef.current = rowId;
          openOdemeUrunModal(rowId, val);
          return;
        }
      }

      // Next column in same row (skipping readonly fields)
      let nextIdx = colIdx + 1;
      while (nextIdx < totalCols && isOdemeColPassive(ODEME_COLS[nextIdx])) {
        nextIdx++;
      }

      if (nextIdx < totalCols) {
        const nk = ODEME_COLS[nextIdx];
        focusOdemeGridCell(rowId, nk, "select");
      } else {
        if (rowIndex < odemeRows.length - 1) {
          const nr = odemeRows[rowIndex + 1];
          setActiveOdemeRowIndex(rowIndex + 1);
          focusOdemeGridCell(nr.id, "odemeAraciTuru", "select");
        } else {
          handleAddOdemeRow();
        }
      }
    } else if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault();
      let prevIdx = colIdx - 1;
      while (prevIdx >= 0 && isOdemeColPassive(ODEME_COLS[prevIdx])) {
        prevIdx--;
      }
      if (prevIdx >= 0) {
        const pk = ODEME_COLS[prevIdx];
        focusOdemeGridCell(rowId, pk, "select");
      } else if (rowIndex > 0) {
        const pr = odemeRows[rowIndex - 1];
        setActiveOdemeRowIndex(rowIndex - 1);
        let prevRowLastCol: OdemeColKey = "kur";
        for (let i = totalCols - 1; i >= 0; i--) {
          if (!isOdemeColPassive(ODEME_COLS[i], rowIndex - 1)) {
            prevRowLastCol = ODEME_COLS[i];
            break;
          }
        }
        focusOdemeGridCell(pr.id, prevRowLastCol, "select");
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (rowIndex < odemeRows.length - 1) {
        const nr = odemeRows[rowIndex + 1];
        setActiveOdemeRowIndex(rowIndex + 1);
        const targetCol = !isOdemeColPassive(colKey, rowIndex + 1) ? colKey : "miktar";
        focusOdemeGridCell(nr.id, targetCol, "select");
      } else {
        handleAddOdemeRow();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (rowIndex > 0) {
        const pr = odemeRows[rowIndex - 1];
        setActiveOdemeRowIndex(rowIndex - 1);
        const targetCol = !isOdemeColPassive(colKey, rowIndex - 1) ? colKey : "miktar";
        focusOdemeGridCell(pr.id, targetCol, "select");
      }
    } else if (e.key === "ArrowRight") {
      const isPassive = isOdemeColPassive(colKey);
      if (isPassive || isAtEnd) {
        e.preventDefault();
        let nextIdx = colIdx + 1;
        while (nextIdx < totalCols && isOdemeColPassive(ODEME_COLS[nextIdx])) {
          nextIdx++;
        }
        if (nextIdx < totalCols) {
          const nk = ODEME_COLS[nextIdx];
          focusOdemeGridCell(rowId, nk, "start");
        } else if (rowIndex < odemeRows.length - 1) {
          const nr = odemeRows[rowIndex + 1];
          setActiveOdemeRowIndex(rowIndex + 1);
          focusOdemeGridCell(nr.id, "odemeAraciTuru", "start");
        } else {
          handleAddOdemeRow();
        }
      }
    } else if (e.key === "ArrowLeft") {
      const isPassive = isOdemeColPassive(colKey);
      if (isPassive || isAtStart) {
        e.preventDefault();
        let prevIdx = colIdx - 1;
        while (prevIdx >= 0 && isOdemeColPassive(ODEME_COLS[prevIdx])) {
          prevIdx--;
        }
        if (prevIdx >= 0) {
          const pk = ODEME_COLS[prevIdx];
          focusOdemeGridCell(rowId, pk, "end");
        } else if (rowIndex > 0) {
          const pr = odemeRows[rowIndex - 1];
          setActiveOdemeRowIndex(rowIndex - 1);
          let prevRowLastCol: OdemeColKey = "kur";
          for (let i = totalCols - 1; i >= 0; i--) {
            if (!isOdemeColPassive(ODEME_COLS[i], rowIndex - 1)) {
              prevRowLastCol = ODEME_COLS[i];
              break;
            }
          }
          focusOdemeGridCell(pr.id, prevRowLastCol, "end");
        }
      }
    }
  }, [odemeRows, urunList, cariList, bankaList, posList, tip, altinHasKuru, openOdemeUrunModal, openOdemeLookup, openCariModalForOdeme, applyProductToOdemeRow, applyCariToOdemeRow, applyPosToOdemeRow, applyHesapToOdemeRow, focusOdemeGridCell, handleAddOdemeRow, isAnyModalOpen]);

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

  // Yazdır / Önizleme Modalı Açma (Önizlemeli)
  const openPrintPreview = useCallback(() => {
    const validLines = lines.filter((l) => Number(l.miktar) > 0 || Number(l.adet) > 0 || (l.urunKodu && l.urunKodu.trim() !== ""));
    setPrintSnapshot({
      fisId: fisId || undefined,
      fisNo: fisNo || "",
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
      odemeSatirlari: odemeRows
        .map((r) => recomputeOdemeRow(r, Number(altinHasKuru) || 0))
        .filter((o) => {
          const mik = parseDecimal(o.miktar);
          const tut = parseDecimal(o.tutar);
          const ad = parseDecimal(o.adet);
          const hasCode = Boolean((o.paraKodu && o.paraKodu.trim() !== "") || (o.paraId && o.paraId > 0));
          return mik > 0 || tut > 0 || ad > 0 || hasCode;
        })
        .map((o, i) => {
          const mik = parseDecimal(o.miktar);
          const ad = parseDecimal(o.adet);
          const effectiveMik = mik > 0 ? mik : (ad > 0 ? ad : 0);
          const effKur = parseDecimal(o.kur) > 0 ? parseDecimal(o.kur) : 1;
          const effTut = parseDecimal(o.tutar) > 0 ? parseDecimal(o.tutar) : (effectiveMik * effKur);
          return {
            satirNo: i + 1,
            odemeAraciTuru: o.odemeAraciTuru,
            paraKodu: o.paraKodu,
            paraAdi: o.paraAdi,
            adet: ad || "",
            miktar: effectiveMik || "",
            milyem: parseDecimal(o.milyem) || "",
            hasGram: parseDecimal(o.hasGram) || "",
            kur: effKur,
            tutar: effTut,
          };
        }),
      toplamTutar: totalTutar,
      toplamHas: alisHas,
      odenenTutar: totalOdemeTutar,
      kalanTutar: farkTL,
    });
    setIsPendingDirectPrint(false);
    setShowPrintModal(true);
  }, [fisId, fisNo, seriNo, tip, tarih, saat, unvan, detayUnvan, detayVergiKimlikNo, detayAdres, detayTelefonNo, detayPasaportNo, vezneKod, user, lines, odemeRows, totalTutar, alisHas, totalOdemeTutar, farkTL]);

  const closeAllModals = useCallback(() => {
    setShowCariModal(false);
    setShowOdemeCariModal(false);
    setShowOdemeHesapModal(false);
    setShowFisModal(false);
    setShowVezneModal(false);
    setShowUrunModal(false);
    setShowNewProductModal(false);
    setShowNewCariModal(false);
    setShowNewBankaModal(false);
    setShowOdemeParaModal(false);
    setShowMasakConfirmModal(false);
    setShowMasakCustomerWarningModal(false);
    setShowMasakMissingModal(false);
    setShowDeleteConfirm(false);
    setShowDetayModal(false);
    setShowPrintModal(false);
    setShowIstatistikModal(false);
    setShowArbitrajModal(false);
    setShowFarkConfirmModal({ show: false, andPrint: false });
  }, []);

  // ─── Arbitraj Sonucunu Sarraf Fişine Aktarma (F7) ──────────────────────────
  const handleApplyArbitrajToSarrafFis = useCallback(
    (result: ArbitrajApplyResult) => {
      const isAlis = result.islemYonu === "alis";

      if (isAlis) {
        // ALIŞ FİŞİ (tip = 0): Müşteriden Alınan (Giriş) -> Kalemler, Müşteriye Verilen (Çıkış) -> Ödeme
        setTip(0);
        const mainUrun =
          urunList.find(
            (u) => (u.kod || "").toUpperCase() === result.girisPara.kod.toUpperCase()
          ) || urunList[0];

        const mainKur = getKurForProduct(mainUrun, 0) || (result.girisKur > 0 ? result.girisKur : (result.parite > 0 ? result.parite : 1));
        const mainMilyem = mainUrun?.hasOrani || mainUrun?.alisMilyem || (result.girisPara.isMaden ? 1000 : 0);

        const cikisUrun = urunList.find(
          (u) => (u.kod || "").toUpperCase() === result.cikisPara.kod.toUpperCase()
        );
        const cikisKur = cikisUrun ? getKurForProduct(cikisUrun, 1) : (result.cikisKur > 0 ? result.cikisKur : 1);

        const newGridRow: GridRow = {
          id: String(Date.now()),
          satirNo: 1,
          urunId: mainUrun?.id || result.girisPara.id || 1,
          urunKodu: mainUrun?.kod || result.girisPara.kod,
          urunAdi: mainUrun?.ad || result.girisPara.ad || result.girisPara.kod,
          adet: 1,
          miktar: result.girisMiktar,
          milyem: mainMilyem,
          hasGram: mainMilyem > 0 ? (result.girisMiktar * mainMilyem) / 1000 : result.girisMiktar,
          iscilikHesaplamaSekli: 0,
          iscilikiMiktari: 0,
          iscilikHasGram: 0,
          kur: mainKur,
          tutar: mainKur > 0 ? parseFloat((result.girisMiktar * mainKur).toFixed(2)) : result.cikisMiktar,
          urunTipi: mainUrun?.urunTipi || 0,
          karat: "",
          aciklama: result.aciklama || "Arbitraj Alış",
        };
        setLines([recomputeRow(newGridRow, Number(altinHasKuru) || 0)]);

        // Ödeme Tablosu: Verilen Çıkış Bacağı
        const newOdemeRow: OdemeRow = {
          id: String(Date.now() + 1),
          satirNo: 1,
          odemeAraciTuru: 0, // Nakit Vezne
          bankaId: null,
          posCihaziId: null,
          cariKartId: null,
          cariKod: "",
          cariUnvan: "",
          iskontoId: null,
          paraId: result.cikisPara.id || 1,
          paraKodu: result.cikisPara.kod,
          paraAdi: result.cikisPara.ad,
          adet: 1,
          miktar: result.cikisMiktar,
          milyem: 0,
          hasGram: 0,
          kur: cikisKur,
          tutar: cikisKur > 0 ? parseFloat((result.cikisMiktar * cikisKur).toFixed(2)) : result.cikisMiktar,
          urunTipi: 0,
        };
        setOdemeRows([recomputeOdemeRow(newOdemeRow, Number(altinHasKuru) || 0)]);
      } else {
        // SATIŞ FİŞİ (tip = 1): Müşteriye Satılan (Çıkış) -> Kalemler, Müşteriden Alınan (Giriş) -> Tahsilat
        setTip(1);
        const mainUrun =
          urunList.find(
            (u) => (u.kod || "").toUpperCase() === result.cikisPara.kod.toUpperCase()
          ) || urunList[0];

        const mainKur = getKurForProduct(mainUrun, 1) || (result.cikisKur > 0 ? result.cikisKur : (result.parite > 0 ? result.parite : 1));
        const mainMilyem = mainUrun?.hasOrani || mainUrun?.satisMilyem || (result.cikisPara.isMaden ? 1000 : 0);

        const girisUrun = urunList.find(
          (u) => (u.kod || "").toUpperCase() === result.girisPara.kod.toUpperCase()
        );
        const girisKur = girisUrun ? getKurForProduct(girisUrun, 0) : (result.girisKur > 0 ? result.girisKur : 1);

        const newGridRow: GridRow = {
          id: String(Date.now()),
          satirNo: 1,
          urunId: mainUrun?.id || result.cikisPara.id || 1,
          urunKodu: mainUrun?.kod || result.cikisPara.kod,
          urunAdi: mainUrun?.ad || result.cikisPara.ad || result.cikisPara.kod,
          adet: 1,
          miktar: result.cikisMiktar,
          milyem: mainMilyem,
          hasGram: mainMilyem > 0 ? (result.cikisMiktar * mainMilyem) / 1000 : result.cikisMiktar,
          iscilikHesaplamaSekli: 0,
          iscilikiMiktari: 0,
          iscilikHasGram: 0,
          kur: mainKur,
          tutar: mainKur > 0 ? parseFloat((result.cikisMiktar * mainKur).toFixed(2)) : result.girisMiktar,
          urunTipi: mainUrun?.urunTipi || 0,
          karat: "",
          aciklama: result.aciklama || "Arbitraj Satış",
        };
        setLines([recomputeRow(newGridRow, Number(altinHasKuru) || 0)]);

        // Tahsilat Tablosu: Alınan Giriş Bacağı
        const newOdemeRow: OdemeRow = {
          id: String(Date.now() + 1),
          satirNo: 1,
          odemeAraciTuru: 0, // Nakit Vezne
          bankaId: null,
          posCihaziId: null,
          cariKartId: null,
          cariKod: "",
          cariUnvan: "",
          iskontoId: null,
          paraId: result.girisPara.id || 1,
          paraKodu: result.girisPara.kod,
          paraAdi: result.girisPara.ad,
          adet: 1,
          miktar: result.girisMiktar,
          milyem: 0,
          hasGram: 0,
          kur: girisKur,
          tutar: girisKur > 0 ? parseFloat((result.girisMiktar * girisKur).toFixed(2)) : result.girisMiktar,
          urunTipi: 0,
        };
        setOdemeRows([recomputeOdemeRow(newOdemeRow, Number(altinHasKuru) || 0)]);
      }

      setArbitrajActiveInfo({
        girisKod: result.girisPara.kod,
        cikisKod: result.cikisPara.kod,
        parite: result.parite,
        islemYonu: result.islemYonu,
      });

      setNotification({
        type: "success",
        message: `Arbitraj işlemi (${result.girisPara.kod} -> ${result.cikisPara.kod}) fiş satırlarına başarıyla aktarıldı.`,
      });
    },
    [urunList]
  );

  // ─── Global F-key shortcuts ──────────────────────────────────────────────────
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      // Eğer ekranda açık bir modal varsa kısayolları çalıştırma
      if (document.querySelector(".modal.show")) {
        return;
      }
      const activeEl = document.activeElement as HTMLElement | null;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(activeEl?.tagName || "") &&
        !["F1", "F3", "F4", "F7", "F8", "F9", "F10"].includes(e.key)) {
        return;
      }
      if (e.key === "F1") { e.preventDefault(); e.stopPropagation(); closeAllModals(); handleSave(false, false); }
      else if (e.key === "F3") { e.preventDefault(); e.stopPropagation(); closeAllModals(); setShowIstatistikModal(true); }
      else if (e.key === "F4") { e.preventDefault(); e.stopPropagation(); closeAllModals(); handleNew(); }
      else if (e.key === "F7") { e.preventDefault(); e.stopPropagation(); closeAllModals(); setShowArbitrajModal(true); }
      else if (e.key === "F8") { e.preventDefault(); e.stopPropagation(); closeAllModals(); openDetayModal(); }
      else if (e.key === "F9") {
        e.preventDefault();
        e.stopPropagation();
        closeAllModals();
        openPrintPreview();
      }
      else if (e.key === "F10") {
        e.preventDefault();
        e.stopPropagation();
        closeAllModals();
        handleSave(false, true);
      }
    };
    window.addEventListener("keydown", h, true);
    return () => window.removeEventListener("keydown", h, true);
  }, [handleSave, handleNew, openDetayModal, openPrintPreview, closeAllModals]);

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
    {
      header: "Alış Has",
      render: (i) => (i.alisMilyem && Number(i.alisMilyem) > 0 ? Number(i.alisMilyem).toString() : (i.hasOrani?.toString() || "-")),
      width: "85px",
      align: "right",
    },
    {
      header: "Satış Has",
      render: (i) => (i.satisMilyem && Number(i.satisMilyem) > 0 ? Number(i.satisMilyem).toString() : (i.hasOrani?.toString() || "-")),
      width: "85px",
      align: "right",
    },
    { header: "Birim", render: (i) => (i.birim === 1 ? "Gram" : (i.birim === 0 ? "Adet" : i.birim?.toString() || "")), width: "60px" },
  ];

  const odemeCariColumns: LookupColumn<CariKartItem>[] = [
    { header: "Cari Kodu", render: (i) => i.kod, width: "100px", highlight: true },
    { header: "Ünvan / Ad", render: (i) => i.ad, highlight: false },
    { header: "Telefon", render: (i) => i.telefon || "", width: "110px", highlight: false },
  ];

  const odemeHesapColumns: LookupColumn<BankaHesapItem>[] = [
    { header: "Hesap / Kart No", render: (i) => i.hesapNo || "", width: "120px", highlight: true },
    { header: "Hesap / Kart Adı", render: (i) => i.hesapAdi || "", highlight: false },
    { header: "Banka", render: (i) => i.bankaAdi || "", width: "120px", highlight: false },
    { header: "IBAN", render: (i) => i.iban || "", width: "180px", highlight: false },
  ];

  const odemePosColumns: LookupColumn<PosCihaziItem>[] = [
    { header: "POS Kodu", render: (i) => i.kod, width: "120px", highlight: true },
    { header: "POS Adı", render: (i) => i.ad, highlight: false },
    { header: "Bakiye", render: (i) => (i.bakiye ?? 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 }), width: "100px", align: "right" },
  ];

  const odemeParaColumns: LookupColumn<UrunItem>[] = [
    { header: "Para Kodu", render: (i) => <span className="font-monospace fw-bold text-primary">{i.kod}</span>, width: "120px", highlight: true },
    { header: "Para Adı", render: (i) => <span className="fw-semibold">{i.ad}</span>, highlight: false },
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
    // Ödeme kısmı: banka hesabı + banka tutarı (döviz hesapta döviz miktarı × o günün kuru)
    ebHedefRef.current = b.tutarTl;
    const hesap = b.bankaId ? bankaList.find((x) => x.bankaId === b.bankaId) : undefined;
    if (hesap && b.tutarTl > 0) {
      const tl = ["TL", "TRY"].includes(b.paraKodu.toUpperCase());
      const satir: OdemeRow = {
        ...createEmptyOdemeRow(1),
        odemeAraciTuru: 2,
        bankaId: hesap.bankaId,
        paraKodu: hesap.hesapNo || hesap.iban || "",
        paraAdi: hesap.hesapAdi ? `${hesap.bankaAdi ? hesap.bankaAdi + " - " : ""}${hesap.hesapAdi}` : (hesap.bankaAdi || ""),
        urunTipi: 0,
        miktar: tl ? b.tutarTl : b.tutar,
        kur: tl ? 1 : parseFloat((b.tutarTl / b.tutar).toFixed(4)),
      };
      setOdemeRows([recomputeOdemeRow(satir, Number(altinHasKuru) || 0)]);
    } else if (b.tutarTl > 0) {
      showNotif("warning", "Bu e-Banka hesabı bir Banka Hesap Kartı ile eşlenmemiş; ödeme tablosunda Kart satırına bankayı elle seçin (e-Banka > Hesaplar'dan eşleyebilirsiniz).");
    }
  });

  return (
    <div className="sarraf-fisi-page w-100 pb-3" style={{ fontFamily: "'Segoe UI', sans-serif", fontSize: "12.5px", "--active-fis-theme-bg": activeFisThemeBg } as React.CSSProperties}>
      {ebFis.bant}
      <ERPToolbar
        disableShortcuts
        pageTitle={
          <span style={{ fontWeight: 700, fontSize: "14px" }} className="d-flex align-items-center gap-2">
            {displayTitle}{" "}
            <Badge bg={tip === 0 ? "primary" : "success"} style={{ fontSize: "11px" }}>
              {tip === 0 ? "ALIŞ" : "SATIŞ"}
            </Badge>
            {arbitrajActiveInfo && (
              <Badge bg="warning" className="text-dark fw-bold px-2 py-0.5 d-inline-flex align-items-center gap-1 shadow-2xs" style={{ fontSize: "11px" }}>
                <IconArrowsExchange size={14} /> ARBİTRAJ ({arbitrajActiveInfo.girisKod} ⇄ {arbitrajActiveInfo.cikisKod})
              </Badge>
            )}
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
        onPrint={openPrintPreview}
        onPreview={openPrintPreview}
        centerContent={undefined}
        rightContent={
          <div className="d-flex align-items-center gap-2 text-nowrap">
            {/* Vezne Bakiyeleri: sağ tarafta, veznenin solunda, dış kenarlıksız, daha kısa */}
            <div
              className="d-flex align-items-center gap-1.5 font-monospace text-secondary"
              style={{ fontSize: "10.5px" }}
            >
              <span>TL: <strong className="text-dark">{fmtBakiye("TL")}</strong></span>
              <span className="opacity-40">|</span>
              <span>USD: <strong className="text-dark">{fmtBakiye("USD")}</strong></span>
              <span className="opacity-40">|</span>
              <span>EUR: <strong className="text-dark">{fmtBakiye("EUR")}</strong></span>
            </div>

            {/* Vezne */}
            <div
              className="d-flex align-items-center gap-1 px-2 py-0.5 rounded border bg-white shadow-2xs font-monospace"
              style={{ fontSize: "11px" }}
            >
              <span className="text-primary fw-bold" style={{ fontSize: "10.5px" }}>VEZNE:</span>
              <strong className="text-dark" style={{ fontSize: "11px" }}>{vezneKod || "01"}</strong>
            </div>

            {/* Zaman: Fiş Düzeltme modunda düzenlenebilir, Kayıt modunda sadece gösterilir ve değiştirilemez */}
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
        className={`shadow-sm mb-2 fis-theme-card ${isMasakBlocked ? "border-2 border-danger" : ""}`}
        data-fis-theme="active"
        style={
          isMasakBlocked
            ? { boxShadow: "0 0 0 4px rgba(220, 53, 69, 0.4)", backgroundColor: "#fff5f5" }
            : { backgroundColor: activeFisThemeBg }
        }
      >
        <Card.Body className="p-2 fis-theme-card-body" data-fis-theme="active" style={{ backgroundColor: activeFisThemeBg }}>
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
                    const rawAlis = (found as any).alisMilyem || (found as any).hasAlisKatsayisi || (found as any).hasOrani || r.milyem;
                    const rawSatis = (found as any).satisMilyem || (found as any).hasSatisKatsayisi || (found as any).hasOrani || r.milyem;
                    const rawMilyem = newTip === 0 ? rawAlis : rawSatis;
                    const updated = {
                      ...r,
                      kur: autoKur > 0 ? autoKur : r.kur,
                      milyem: (found as any).urunTipi === 0 ? "" : (rawMilyem || r.milyem),
                    };
                    return recomputeRow(updated, autoKur);
                  }));
                  setOdemeRows((prev) => prev.map((r) => {
                    if (!r.paraKodu || r.paraKodu === "TL") return r;
                    const found = urunList.find((u) => u.kod.trim().toLowerCase() === r.paraKodu.trim().toLowerCase()) || { paraId: r.paraId, kod: r.paraKodu, urunTipi: r.urunTipi };
                    const autoKur = getKurForProduct(found, newTip === 0 ? 1 : 0);
                    const rawAlis = (found as any).alisMilyem || (found as any).hasAlisKatsayisi || (found as any).hasOrani || r.milyem;
                    const rawSatis = (found as any).satisMilyem || (found as any).hasSatisKatsayisi || (found as any).hasOrani || r.milyem;
                    const rawMilyem = newTip === 0 ? rawSatis : rawAlis;
                    const updated = {
                      ...r,
                      kur: autoKur > 0 ? autoKur : r.kur,
                      milyem: (found as any).urunTipi === 0 ? "" : (rawMilyem || r.milyem),
                    };
                    return recomputeOdemeRow(updated, currentHasKuru);
                  }));
                }}
                onKeyDown={(e) => {
                  if (e.key === " " || e.code === "Space" || e.keyCode === 32) {
                    e.preventDefault();
                    e.stopPropagation();
                    const newTip = (tip === 0 ? 1 : 0) as 0 | 1;
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
                      const rawAlis = (found as any).alisMilyem || (found as any).hasAlisKatsayisi || (found as any).hasOrani || r.milyem;
                      const rawSatis = (found as any).satisMilyem || (found as any).hasSatisKatsayisi || (found as any).hasOrani || r.milyem;
                      const rawMilyem = newTip === 0 ? rawAlis : rawSatis;
                      const updated = {
                        ...r,
                        kur: autoKur > 0 ? autoKur : r.kur,
                        milyem: (found as any).urunTipi === 0 ? "" : (rawMilyem || r.milyem),
                      };
                      return recomputeRow(updated, autoKur);
                    }));
                    setOdemeRows((prev) => prev.map((r) => {
                      if (!r.paraKodu || r.paraKodu === "TL") return r;
                      const found = urunList.find((u) => u.kod.trim().toLowerCase() === r.paraKodu.trim().toLowerCase()) || { paraId: r.paraId, kod: r.paraKodu, urunTipi: r.urunTipi };
                      const autoKur = getKurForProduct(found, newTip === 0 ? 1 : 0);
                      const rawAlis = (found as any).alisMilyem || (found as any).hasAlisKatsayisi || (found as any).hasOrani || r.milyem;
                      const rawSatis = (found as any).satisMilyem || (found as any).hasSatisKatsayisi || (found as any).hasOrani || r.milyem;
                      const rawMilyem = newTip === 0 ? rawSatis : rawAlis;
                      const updated = {
                        ...r,
                        kur: autoKur > 0 ? autoKur : r.kur,
                        milyem: (found as any).urunTipi === 0 ? "" : (rawMilyem || r.milyem),
                      };
                      return recomputeOdemeRow(updated, currentHasKuru);
                    }));
                    return;
                  }
                  handleHeaderKeyDown(e, "islem");
                }}
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
                    lastModalCallerRef.current = "vkn";
                    setCariSearchField("vkn");
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
                    lastModalCallerRef.current = "vkn";
                    setCariSearchField("vkn");
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
                    const term = (cariKod || "").trim();
                    lastModalCallerRef.current = "cariKod";
                    setCariSearchField("kod");
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
                    const term = (cariKod || "").trim();
                    lastModalCallerRef.current = "cariKod";
                    setCariSearchField("kod");
                    setCariSearchTerm(term);
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
                    const term = isAnonymousCustomerName(raw) ? "" : raw;
                    lastModalCallerRef.current = "unvan";
                    setCariSearchField("unvan");
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
                    const raw = (unvan || "").trim();
                    const term = isAnonymousCustomerName(raw) ? "" : raw;
                    lastModalCallerRef.current = "unvan";
                    setCariSearchField("unvan");
                    setCariSearchTerm(term);
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
                      e.stopPropagation();
                      const term = (istatistikKodu || "").trim();
                      setIstatistikSearchTerm(term);
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
                    const term = (istatistikKodu || "").trim();
                    lastModalCallerRef.current = "istatistik";
                    setIstatistikSearchTerm(term);
                    setShowIstatistikModal(true);
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const term = (istatistikKodu || "").trim();
                    lastModalCallerRef.current = "istatistik";
                    setIstatistikSearchTerm(term);
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
              <Form.Control
                ref={kdvOraniRef}
                type="number"
                size="sm"
                value={kdvOrani}
                onChange={(e) => setKdvOrani(e.target.value)}
                onKeyDown={(e) => handleHeaderKeyDown(e, "kdvOrani")}
                className="font-monospace text-end"
                style={{ width: "65px" }}
              />
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* ─── 2. Satır Tablosu (Kalemler) (Ayrı Dış Dikdörtgen Kutu) ─── */}
      <Card className="shadow-sm mb-2 border rounded-2 fis-theme-card" data-fis-theme="active" style={{ backgroundColor: activeFisThemeBg }}>
        <Card.Body className="p-2 fis-theme-card-body" data-fis-theme="active" style={{ backgroundColor: activeFisThemeBg }}>
          <div style={{ overflowX: "auto" }}>
            <Table bordered size="sm" hover className="mb-0" style={{ fontSize: "11.5px", minWidth: 960 }}>
              <thead style={{ background: "#d9e8fb", color: "#000" }}>
                <tr className="text-center align-middle">
                  <th style={{ width: 25 }} className="text-center">#</th>
                  <th style={{ width: 110 }} className="text-center">Ürün kodu</th>
                  <th style={{ width: 140 }} className="text-center">Ürün adı</th>
                  <th style={{ width: 55 }} className="text-center">Adet</th>
                  <th style={{ width: 75 }} className="text-center">Miktar</th>
                  <th style={{ width: 70 }} className="text-center">Milyem</th>
                  <th style={{ width: 85 }} className="text-center">Has</th>
                  <th style={{ width: 85 }} className="text-center">İşçilik şekli</th>
                  <th style={{ width: 85 }} className="text-center">İşçilik</th>
                  <th style={{ width: 85 }} className="text-center">İşçilik (Has)</th>
                  <th style={{ width: 105 }} className="text-center">Kur</th>
                  <th style={{ width: 110 }} className="text-center">Tutar (TL)</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((row, rowIndex) => {
                  const isRowEmpty = isSarrafRowCompletelyEmpty(row);
                  const isRowValid = isSarrafRowFilled(row);
                  const isAttempted = Boolean(invalidRowIds[row.id]);
                  const shouldValidate = (!isRowEmpty && !isRowValid) || (isAttempted && !isRowValid);

                  const isKodMissing = shouldValidate && (!row.urunKodu || row.urunKodu.trim() === "");
                  const isPara = row.urunTipi === 0 && Boolean(row.urunKodu && row.urunKodu.trim());
                  const isAdetMissing = shouldValidate && !isPara && (!row.adet || Number(row.adet) <= 0) && (!row.miktar || parseDecimal(row.miktar) <= 0);
                  const isMiktarMissing = shouldValidate && (isPara ? (!row.miktar || parseDecimal(row.miktar) <= 0) : isAdetMissing);
                  const isKurMissing = shouldValidate && (!row.kur || parseDecimal(row.kur) <= 0);

                  const handleKalemRowFocus = () => {
                    cleanupEmptyRows(rowIndex);
                    cleanupEmptyOdemeRows();
                    setActiveRowIndex(rowIndex);
                  };

                  return (
                    <tr
                      key={row.id}
                      data-row-id={row.id}
                      data-table-type="kalemler"
                      style={
                        shouldValidate
                          ? { background: "#fff1f2", borderLeft: "4px solid #ef4444" }
                          : (rowIndex === activeRowIndex ? { background: "#edf5ff" } : {})
                      }
                      title={shouldValidate ? "Eksik veya hatalı bilgi içeren satır!" : undefined}
                    >
                      <td className="text-muted text-center" style={{ padding: "2px", fontSize: "10px", verticalAlign: "middle" }}>
                        {rowIndex + 1}
                      </td>

                      {/* Ürün kodu */}
                      <td>
                        <InputGroup size="sm" style={isKodMissing ? { backgroundColor: "#fee2e2", border: "1.5px solid #dc2626", borderRadius: "3px" } : {}}>
                          <Form.Control
                            ref={(el) => { rowInputRefs.current[`${row.id}_urunKodu`] = el; }}
                            value={row.urunKodu}
                            onChange={(e) => {
                              const val = e.target.value;
                              const kUpper = val.trim().toUpperCase();
                              if (kUpper === "TL" || kUpper === "TRY") {
                                showNotif("warning", "Sarraf fişinde kalemler tablosunda TL seçilemez.");
                                updateRow(row.id, "urunKodu", "");
                                return;
                              }
                              updateRow(row.id, "urunKodu", val);
                              const match = urunList.find((u) => u.kod.trim().toLowerCase() === val.trim().toLowerCase());
                              if (match) {
                                const matchK = (match.kod || "").trim().toUpperCase();
                                if (matchK === "TL" || matchK === "TRY" || (match.ad || "").toUpperCase().includes("TÜRK LİRASI")) {
                                  showNotif("warning", "Sarraf fişinde kalemler tablosunda TL seçilemez.");
                                  updateRow(row.id, "urunKodu", "");
                                  return;
                                }
                                applyProductToRow(row.id, match);
                              }
                            }}
                            onBlur={(e) => {
                              const val = e.target.value.trim();
                              const kUpper = val.toUpperCase();
                              if (kUpper === "TL" || kUpper === "TRY") {
                                showNotif("warning", "Sarraf fişinde kalemler tablosunda TL seçilemez.");
                                updateRow(row.id, "urunKodu", "");
                                setInvalidRowIds((prev) => ({ ...prev, [row.id]: true }));
                                return;
                              }
                              if (val) {
                                const match = urunList.find((u) => u.kod.trim().toLowerCase() === val.toLowerCase());
                                if (match) {
                                  const matchK = (match.kod || "").trim().toUpperCase();
                                  if (matchK === "TL" || matchK === "TRY" || (match.ad || "").toUpperCase().includes("TÜRK LİRASI")) {
                                    showNotif("warning", "Sarraf fişinde kalemler tablosunda TL seçilemez.");
                                    updateRow(row.id, "urunKodu", "");
                                    setInvalidRowIds((prev) => ({ ...prev, [row.id]: true }));
                                    return;
                                  }
                                  applyProductToRow(row.id, match);
                                }
                              }
                              setInvalidRowIds((prev) => ({ ...prev, [row.id]: true }));
                            }}
                            onDoubleClick={() => openUrunModal(row.id)}
                            onKeyDown={(e) => {
                              if (e.key === "F4") {
                                e.preventDefault();
                                e.stopPropagation();
                                openUrunModal(row.id);
                                return;
                              }
                              handleGridKeyDown(e, rowIndex, "urunKodu", row.id);
                            }}
                            onFocus={handleKalemRowFocus}
                            className={isKodMissing ? "text-danger fw-bold" : ""}
                            style={{
                              fontSize: "11px",
                              padding: "1px 4px",
                              textTransform: "uppercase",
                              backgroundColor: isKodMissing ? "#fee2e2" : undefined,
                            }}
                            title={isKodMissing ? "Lütfen ürün kodu seçiniz" : undefined}
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
                          ref={(el) => { rowInputRefs.current[`${row.id}_urunAdi`] = el; }}
                          size="sm"
                          value={row.urunAdi}
                          readOnly
                          onFocus={handleKalemRowFocus}
                          onKeyDown={(e) => handleGridKeyDown(e, rowIndex, "urunAdi", row.id)}
                          style={{ fontSize: "11px", padding: "1px 4px", background: "#e9ecef" }}
                        />
                      </td>

                      {/* Adet */}
                      <td>
                        <Form.Control
                          ref={(el) => { rowInputRefs.current[`${row.id}_adet`] = el; }}
                          inputMode="numeric"
                          size="sm"
                          readOnly={isPara}
                          tabIndex={isPara ? -1 : undefined}
                          className={`text-end font-monospace ${!isPara && isAdetMissing ? "text-danger fw-bold" : ""} ${isPara ? "text-muted" : ""}`}
                          value={isPara ? "" : row.adet}
                          onChange={(e) => !isPara && updateRow(row.id, "adet", e.target.value)}
                          onKeyDown={(e) => handleGridKeyDown(e, rowIndex, "adet", row.id)}
                          onBlur={() => setInvalidRowIds((prev) => ({ ...prev, [row.id]: true }))}
                          onFocus={handleKalemRowFocus}
                          style={{
                            fontSize: "11px",
                            padding: "1px 4px",
                            backgroundColor: isPara ? "#e9ecef" : (!isPara && isAdetMissing ? "#fee2e2" : undefined),
                            border: (!isPara && isAdetMissing) ? "1.5px solid #dc2626" : undefined,
                            cursor: isPara ? "not-allowed" : undefined,
                          }}
                          title={isPara ? "Döviz/Para işlemlerinde adet girilmez, miktar kullanılır" : isAdetMissing ? "Lütfen adet veya miktar giriniz" : undefined}
                        />
                      </td>

                      {/* Miktar */}
                      <td>
                        <Form.Control
                          ref={(el) => { rowInputRefs.current[`${row.id}_miktar`] = el; }}
                          inputMode="decimal"
                          size="sm"
                          className={`text-end font-monospace ${isMiktarMissing ? "text-danger fw-bold" : ""}`}
                          value={row.miktar}
                          onChange={(e) => updateRow(row.id, "miktar", e.target.value)}
                          onKeyDown={(e) => handleGridKeyDown(e, rowIndex, "miktar", row.id)}
                          onBlur={() => normalizeRowOnBlur(row.id, "miktar")}
                          onFocus={handleKalemRowFocus}
                          style={{
                            fontSize: "11px",
                            padding: "1px 4px",
                            backgroundColor: isMiktarMissing ? "#fee2e2" : undefined,
                            border: isMiktarMissing ? "1.5px solid #dc2626" : undefined,
                          }}
                          title={isMiktarMissing ? "Lütfen miktar giriniz" : undefined}
                        />
                      </td>

                      {/* Milyem */}
                      <td>
                        <Form.Control
                          ref={(el) => { rowInputRefs.current[`${row.id}_milyem`] = el; }}
                          inputMode="decimal"
                          data-decimal="true"
                          size="sm"
                          readOnly={isPara}
                          tabIndex={isPara ? -1 : undefined}
                          className={`text-end font-monospace ${isPara ? "text-muted" : ""}`}
                          value={isPara ? "" : row.milyem}
                          onChange={(e) => !isPara && updateRow(row.id, "milyem", e.target.value)}
                          onKeyDown={(e) => handleGridKeyDown(e, rowIndex, "milyem", row.id)}
                          onBlur={() => !isPara && normalizeRowOnBlur(row.id, "milyem")}
                          onFocus={handleKalemRowFocus}
                          style={{
                            fontSize: "11px",
                            padding: "1px 4px",
                            backgroundColor: isPara ? "#e9ecef" : undefined,
                            cursor: isPara ? "not-allowed" : undefined,
                          }}
                          title={isPara ? "Döviz/Para işlemlerinde milyem girilmez" : undefined}
                        />
                      </td>

                      {/* Has (Gr) - Pasif / Otomatik Hesaplanır */}
                      <td>
                        <Form.Control
                          ref={(el) => { rowInputRefs.current[`${row.id}_hasGram`] = el; }}
                          readOnly
                          tabIndex={-1}
                          size="sm"
                          className="text-end font-monospace text-muted"
                          value={isPara ? "" : row.hasGram}
                          onFocus={handleKalemRowFocus}
                          onKeyDown={(e) => handleGridKeyDown(e, rowIndex, "hasGram", row.id)}
                          style={{ fontSize: "11px", padding: "1px 4px", backgroundColor: "#e9ecef", cursor: "not-allowed" }}
                          title="Altın has gramı otomatik hesaplanır, değiştirilemez"
                        />
                      </td>

                      {/* İşçilik şekli */}
                      <td>
                        <Form.Select
                          size="sm"
                          disabled={isPara}
                          tabIndex={isPara ? -1 : undefined}
                          value={isPara ? 0 : row.iscilikHesaplamaSekli}
                          ref={(el) => { rowInputRefs.current[`${row.id}_iscilikHesaplamaSekli`] = el; }}
                          onChange={(e) => !isPara && updateRow(row.id, "iscilikHesaplamaSekli", Number(e.target.value))}
                          onKeyDown={(e) => {
                            if (e.key === " " || e.code === "Space" || e.keyCode === 32) {
                              e.preventDefault();
                              e.stopPropagation();
                              const nextVal = ((Number(row.iscilikHesaplamaSekli) || 0) + 1) % 4;
                              updateRow(row.id, "iscilikHesaplamaSekli", nextVal);
                              return;
                            }
                            handleGridKeyDown(e, rowIndex, "iscilikHesaplamaSekli", row.id);
                          }}
                          onBlur={() => setInvalidRowIds((prev) => ({ ...prev, [row.id]: true }))}
                          onFocus={handleKalemRowFocus}
                          style={{
                            fontSize: "10.5px",
                            padding: "1px 2px",
                            backgroundColor: isPara ? "#e9ecef" : undefined,
                            cursor: isPara ? "not-allowed" : undefined,
                          }}
                          title={isPara ? "Döviz/Para işlemlerinde işçilik uygulanmaz" : undefined}
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
                          readOnly={isPara}
                          tabIndex={isPara ? -1 : undefined}
                          className={`text-end font-monospace ${isPara ? "text-muted" : ""}`}
                          value={isPara ? "" : row.iscilikiMiktari}
                          onChange={(e) => !isPara && updateRow(row.id, "iscilikiMiktari", e.target.value)}
                          onKeyDown={(e) => handleGridKeyDown(e, rowIndex, "iscilikiMiktari", row.id)}
                          onBlur={() => !isPara && normalizeRowOnBlur(row.id, "iscilikiMiktari")}
                          onFocus={handleKalemRowFocus}
                          style={{
                            fontSize: "11px",
                            padding: "1px 4px",
                            backgroundColor: isPara ? "#e9ecef" : undefined,
                            cursor: isPara ? "not-allowed" : undefined,
                          }}
                          title={isPara ? "Döviz/Para işlemlerinde işçilik uygulanmaz" : undefined}
                        />
                      </td>

                      {/* İşçilik Has Gram - Pasif / Otomatik Hesaplanır */}
                      <td>
                        <Form.Control
                          ref={(el) => { rowInputRefs.current[`${row.id}_iscilikHasGram`] = el; }}
                          readOnly
                          tabIndex={-1}
                          size="sm"
                          className="text-end font-monospace text-muted"
                          value={isPara ? "" : row.iscilikHasGram}
                          onFocus={handleKalemRowFocus}
                          onKeyDown={(e) => handleGridKeyDown(e, rowIndex, "iscilikHasGram", row.id)}
                          style={{ fontSize: "11px", padding: "1px 4px", backgroundColor: "#e9ecef", cursor: "not-allowed" }}
                          title="İşçilik has gramı otomatik hesaplanır, değiştirilemez"
                        />
                      </td>

                      {/* Kur */}
                      <td>
                        <Form.Control
                          ref={(el) => { rowInputRefs.current[`${row.id}_kur`] = el; }}
                          inputMode="decimal"
                          size="sm"
                          className={`text-end font-monospace ${isKurMissing ? "text-danger fw-bold" : ""}`}
                          value={row.kur}
                          onChange={(e) => updateRow(row.id, "kur", e.target.value)}
                          onKeyDown={(e) => handleGridKeyDown(e, rowIndex, "kur", row.id)}
                          onBlur={() => normalizeRowOnBlur(row.id, "kur")}
                          onFocus={handleKalemRowFocus}
                          style={{
                            fontSize: "11px",
                            padding: "1px 4px",
                            backgroundColor: isKurMissing ? "#fee2e2" : undefined,
                            border: isKurMissing ? "1.5px solid #dc2626" : undefined,
                          }}
                          title={isKurMissing ? "Lütfen kur giriniz" : undefined}
                        />
                      </td>

                      {/* Tutar - Pasif / Otomatik Hesaplanır */}
                      <td>
                        <Form.Control
                          ref={(el) => { rowInputRefs.current[`${row.id}_tutar`] = el; }}
                          readOnly
                          tabIndex={-1}
                          size="sm"
                          className="text-end font-monospace text-muted"
                          value={row.tutar}
                          onFocus={handleKalemRowFocus}
                          onKeyDown={(e) => handleGridKeyDown(e, rowIndex, "tutar", row.id)}
                          style={{
                            fontSize: "11px",
                            padding: "1px 4px",
                            backgroundColor: "#e9ecef",
                            cursor: "not-allowed",
                          }}
                          title="Tutar otomatik hesaplanır, değiştirilemez"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot style={{ background: "#f2f4f7", fontWeight: 600, fontSize: "11px" }}>
                <tr>
                  <td colSpan={3} className="text-end small">Toplam</td>
                  <td style={{ textAlign: "right" }}>{totalAdet || ""}</td>
                  <td style={{ textAlign: "right" }}>{totalMiktar ? totalMiktar.toFixed(3) : ""}</td>
                  <td></td>
                  <td style={{ textAlign: "right" }}>{totalHasGram ? totalHasGram.toFixed(4) : ""}</td>
                  <td></td>
                  <td></td>
                  <td style={{ textAlign: "right" }}>{totalIscilikHasGram ? totalIscilikHasGram.toFixed(4) : ""}</td>
                  <td></td>
                  <td style={{ textAlign: "right" }}>
                    {totalTutar ? totalTutar.toLocaleString("tr-TR", { minimumFractionDigits: 2 }) + " TL" : ""}
                  </td>
                </tr>
              </tfoot>
            </Table>
          </div>
        </Card.Body>
      </Card>

      {/* ─── 3. Alt Bölüm (Ödeme / Tahsilat Tablosu ve Özet) ─── */}
      <Card className="shadow-sm mb-2 border rounded-2 fis-theme-card" data-fis-theme="active" style={{ backgroundColor: activeFisThemeBg }}>
        <Card.Body className="p-2 fis-theme-card-body" data-fis-theme="active" style={{ backgroundColor: activeFisThemeBg }}>
          <Row className="g-2 align-items-start">
            {/* SOLDA: Ödeme / Tahsilat Tablosu (Üstteki tablo ile birebir aynı tasarım) */}
            <Col xs={12} lg={8} md={7}>
              <div className="border rounded bg-white shadow-2xs overflow-hidden mb-1">
                <div className="bg-light px-2 py-1 border-bottom">
                  <span className="fw-bold text-secondary" style={{ fontSize: "12px" }}>
                    ÖDEME / TAHSİLAT TABLOSU
                  </span>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <Table bordered size="sm" hover className="mb-0" style={{ fontSize: "11.5px", minWidth: 780 }}>
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
                        <th style={{ width: 85 }} className="text-center">Has</th>
                        <th style={{ width: 105 }} className="text-center">Kur</th>
                        <th style={{ width: 110 }} className="text-center">Tutar (TL)</th>
                      </tr>
                    </thead>
                  <tbody>
                    {odemeRows.map((oRow, rowIndex) => {
                      const isOdemeRowEmpty = isOdemeRowCompletelyEmpty(oRow);
                      const isOdemeRowValid = isOdemeRowFilled(oRow);
                      const isOdemeAttempted = Boolean(invalidOdemeRowIds[oRow.id]);
                      const shouldValidateOdeme = (!isOdemeRowEmpty && !isOdemeRowValid) || (isOdemeAttempted && !isOdemeRowValid);

                      const isOdemeCari = oRow.odemeAraciTuru === 1;
                      const isOdemeKart = oRow.odemeAraciTuru === 2;
                      const isOdemeHesap = oRow.odemeAraciTuru === 3;

                      const isOdemePara = Boolean(
                        oRow.urunTipi === 0 ||
                        oRow.urunTipi === undefined ||
                        oRow.urunTipi === null ||
                        oRow.paraKodu?.toUpperCase() === "TL" ||
                        oRow.paraKodu?.toUpperCase() === "TRY"
                      );

                      const isOdemeTL = (oRow.paraKodu || "").trim().toUpperCase() === "TL" || (oRow.paraKodu || "").trim().toUpperCase() === "TRY" || (oRow.paraKodu || "").trim().toUpperCase() === "TRL" || (!oRow.paraKodu && (oRow.odemeAraciTuru === 0 || oRow.odemeAraciTuru === 2 || oRow.odemeAraciTuru === 3));
                      const isOdemeKurDisabled = true;

                      const isOdemeKodMissing = shouldValidateOdeme && (!oRow.paraKodu || oRow.paraKodu.trim() === "");
                      const isOdemeAdetMissing = shouldValidateOdeme && !isOdemePara && (!oRow.adet || Number(oRow.adet) <= 0) && (!oRow.miktar || parseDecimal(oRow.miktar) <= 0);
                      const isOdemeMiktarMissing = shouldValidateOdeme && (
                        isOdemePara
                          ? (!oRow.miktar || parseDecimal(oRow.miktar) <= 0)
                          : isOdemeAdetMissing
                      );
                      const isOdemeKurMissing = false;

                      const handleOdemeRowFocus = () => {
                        cleanupEmptyOdemeRows(rowIndex);
                        cleanupEmptyRows();
                        setActiveOdemeRowIndex(rowIndex);
                      };

                      return (
                      <tr
                        key={oRow.id}
                        data-row-id={oRow.id}
                        data-table-type="odeme"
                        style={
                          shouldValidateOdeme
                            ? { background: "#fff1f2", borderLeft: "4px solid #ef4444" }
                            : (rowIndex === activeOdemeRowIndex ? { background: "#edf5ff" } : {})
                        }
                        onContextMenu={(e) => {
                          e.preventDefault();
                          handleKapatRow(oRow.id);
                        }}
                        title={shouldValidateOdeme ? "Eksik veya hatalı bilgi içeren satır!" : "Sağ tık: Kalan bakiyeyi bu satır ile kapat"}
                      >
                        <td className="text-muted text-center" style={{ padding: "2px", fontSize: "10px", verticalAlign: "middle" }}>
                          {rowIndex + 1}
                        </td>

                        {/* Tür Seçimi (Vezne, Cari, POS, Hesap) */}
                        <td>
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
                                  defCariKod = (cariKod && cariKod.trim() && cariKod !== "00000") ? cariKod.trim() : "";
                                  defCariUnvan = (unvan && unvan !== "NİHAİ TÜKETİCİ") ? unvan : "";
                                  defKod = "";
                                  defAd = "";
                                  defCariId = cariKartId || null;
                                } else if (val === 2) {
                                  defKod = "TL";
                                  const defPos = posList.length > 0 ? posList[0] : null;
                                  defCariKod = defPos ? (defPos.kod || "") : "";
                                  defAd = defPos ? (defPos.ad || "KREDİ KARTI / POS") : "KREDİ KARTI / POS";
                                  defCariId = defPos ? defPos.posCihaziId : null;
                                } else if (val === 3) {
                                  defKod = "TL";
                                  const defBanka = bankaList.length > 0 ? bankaList[0] : null;
                                  defCariKod = defBanka ? (defBanka.hesapNo || "") : "";
                                  defAd = defBanka
                                    ? (defBanka.hesapAdi ? `${defBanka.bankaAdi ? defBanka.bankaAdi + " - " : ""}${defBanka.hesapAdi}` : (defBanka.bankaAdi || "BANKA HAVALE / EFT"))
                                    : "BANKA HAVALE / EFT";
                                  defCariId = defBanka ? defBanka.bankaId : null;
                                }
                                return {
                                  ...r,
                                  odemeAraciTuru: val,
                                  paraKodu: val === 1 ? "" : (val === 0 ? (r.paraKodu || "TL") : defKod),
                                  paraAdi: val === 1 ? "" : defAd,
                                  paraId: null,
                                  cariKartId: val === 1 ? defCariId : null,
                                  cariKod: defCariKod,
                                  cariUnvan: defCariUnvan,
                                  bankaId: val === 3 ? defCariId : null,
                                  posCihaziId: val === 2 ? defCariId : null,
                                  adet: "",
                                  miktar: val === 1 ? "" : r.miktar,
                                  milyem: "",
                                  hasGram: "",
                                  kur: val === 1 ? "" : ((val === 2 || val === 3) ? 1 : r.kur),
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
                                    defCariKod = (cariKod && cariKod.trim() && cariKod !== "00000") ? cariKod.trim() : "";
                                    defCariUnvan = (unvan && unvan !== "NİHAİ TÜKETİCİ") ? unvan : "";
                                    defKod = "";
                                    defAd = "";
                                    defCariId = cariKartId || null;
                                  } else if (nextVal === 2) {
                                    defKod = "TL";
                                    const defPos = posList.length > 0 ? posList[0] : null;
                                    defCariKod = defPos ? (defPos.kod || "") : "";
                                    defAd = defPos ? (defPos.ad || "KREDİ KARTI / POS") : "KREDİ KARTI / POS";
                                    defCariId = defPos ? defPos.posCihaziId : null;
                                  } else if (nextVal === 3) {
                                    defKod = "TL";
                                    const defBanka = bankaList.length > 0 ? bankaList[0] : null;
                                    defCariKod = defBanka ? (defBanka.hesapNo || "") : "";
                                    defAd = defBanka
                                      ? (defBanka.hesapAdi ? `${defBanka.bankaAdi ? defBanka.bankaAdi + " - " : ""}${defBanka.hesapAdi}` : (defBanka.bankaAdi || "BANKA HAVALE / EFT"))
                                      : "BANKA HAVALE / EFT";
                                    defCariId = defBanka ? defBanka.bankaId : null;
                                  }
                                  return {
                                    ...r,
                                    odemeAraciTuru: nextVal,
                                    paraKodu: nextVal === 1 ? "" : (nextVal === 0 ? (r.paraKodu || "TL") : defKod),
                                    paraAdi: nextVal === 1 ? "" : defAd,
                                    paraId: null,
                                    cariKartId: nextVal === 1 ? defCariId : null,
                                    cariKod: defCariKod,
                                    cariUnvan: defCariUnvan,
                                    bankaId: nextVal === 3 ? defCariId : null,
                                    posCihaziId: nextVal === 2 ? defCariId : null,
                                    adet: "",
                                    miktar: nextVal === 1 ? "" : r.miktar,
                                    milyem: "",
                                    hasGram: "",
                                    kur: nextVal === 1 ? "" : ((nextVal === 2 || nextVal === 3) ? 1 : r.kur),
                                    tutar: nextVal === 1 ? "" : r.tutar,
                                  };
                                }));
                                return;
                              }
                              handleOdemeGridKeyDown(e, rowIndex, "odemeAraciTuru", oRow.id);
                            }}
                            onBlur={() => setInvalidOdemeRowIds((prev) => ({ ...prev, [oRow.id]: true }))}
                            onFocus={handleOdemeRowFocus}
                            style={{ fontSize: "11px", padding: "1px 2px", fontWeight: 600 }}
                          >
                            <option value={0}>Vezne</option>
                            <option value={1}>Cari</option>
                            <option value={2}>POS</option>
                            <option value={3}>Hesap</option>
                          </Form.Select>
                        </td>

                        {/* Kod (+ Dürbün) */}
                        <td>
                          {isOdemeCari ? (
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
                                  const match = cariList.find((c) => (c.kod || "").trim().toLowerCase() === val.trim().toLowerCase());
                                  if (match) {
                                    setOdemeRows((prev) => prev.map((r) => r.id === oRow.id ? { ...r, cariKartId: match.id, cariKod: match.kod, cariUnvan: match.ad || (match as any).unvan || "" } : r));
                                  }
                                }}
                                onBlur={(e) => {
                                  const val = e.target.value.trim();
                                  if (val) {
                                    const cMatch = cariList.find((c) => (c.kod || "").toLowerCase() === val.toLowerCase());
                                    if (cMatch) {
                                      setOdemeRows((prev) => prev.map((r) => r.id === oRow.id ? { ...r, cariKartId: cMatch.id, cariKod: cMatch.kod, cariUnvan: cMatch.ad || (cMatch as any).unvan || "" } : r));
                                    }
                                  }
                                }}
                                onDoubleClick={() => openCariModalForOdeme(oRow.id)}
                                onKeyDown={(e) => {
                                  if (e.key === "F4" || e.key === "F3") {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    openCariModalForOdeme(oRow.id);
                                    return;
                                  }
                                  handleOdemeGridKeyDown(e, rowIndex, "cariKod", oRow.id);
                                }}
                                onFocus={handleOdemeRowFocus}
                                style={{ fontSize: "11px", padding: "1px 4px" }}
                              />
                              <Button
                                type="button"
                                tabIndex={-1}
                                variant="outline-secondary"
                                className="px-1 py-0 d-flex align-items-center"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  openCariModalForOdeme(oRow.id);
                                }}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  openCariModalForOdeme(oRow.id);
                                }}
                                title="Cari Seç (F3/F4)"
                              >
                                <IconBinoculars size={12} />
                              </Button>
                            </InputGroup>
                          ) : isOdemeKart ? (
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
                                  const match = posList.find((p) => (p.kod || "").trim().toLowerCase() === val.trim().toLowerCase());
                                  if (match) {
                                    applyPosToOdemeRow(oRow.id, match);
                                  }
                                }}
                                onBlur={(e) => {
                                  const val = e.target.value.trim();
                                  if (val) {
                                    const match = posList.find((p) => (p.kod || "").toLowerCase() === val.toLowerCase());
                                    if (match) {
                                      applyPosToOdemeRow(oRow.id, match);
                                    }
                                  }
                                }}
                                onDoubleClick={() => openOdemeLookup(oRow.id)}
                                onKeyDown={(e) => {
                                  if (e.key === "F4" || e.key === "F3") {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    openOdemeLookup(oRow.id);
                                    return;
                                  }
                                  handleOdemeGridKeyDown(e, rowIndex, "cariKod", oRow.id);
                                }}
                                onFocus={handleOdemeRowFocus}
                                style={{ fontSize: "11px", padding: "1px 4px", backgroundColor: "#fff" }}
                              />
                              <Button
                                type="button"
                                tabIndex={-1}
                                variant="outline-secondary"
                                className="px-1 py-0 d-flex align-items-center"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  openOdemeLookup(oRow.id);
                                }}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  openOdemeLookup(oRow.id);
                                }}
                                title="POS Cihazı Seç (F3/F4)"
                              >
                                <IconBinoculars size={12} />
                              </Button>
                            </InputGroup>
                          ) : isOdemeHesap ? (
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
                                  const match = bankaList.find((b) => (b.hesapNo || "").trim().toLowerCase() === val.trim().toLowerCase());
                                  if (match) {
                                    applyHesapToOdemeRow(oRow.id, match);
                                  }
                                }}
                                onBlur={(e) => {
                                  const val = e.target.value.trim();
                                  if (val) {
                                    const match = bankaList.find((b) => (b.hesapNo || "").toLowerCase() === val.toLowerCase());
                                    if (match) {
                                      applyHesapToOdemeRow(oRow.id, match);
                                    }
                                  }
                                }}
                                onDoubleClick={() => openOdemeLookup(oRow.id)}
                                onKeyDown={(e) => {
                                  if (e.key === "F4" || e.key === "F3") {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    openOdemeLookup(oRow.id);
                                    return;
                                  }
                                  handleOdemeGridKeyDown(e, rowIndex, "cariKod", oRow.id);
                                }}
                                onFocus={handleOdemeRowFocus}
                                style={{ fontSize: "11px", padding: "1px 4px", backgroundColor: "#fff" }}
                              />
                              <Button
                                type="button"
                                tabIndex={-1}
                                variant="outline-secondary"
                                className="px-1 py-0 d-flex align-items-center"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  openOdemeLookup(oRow.id);
                                }}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  openOdemeLookup(oRow.id);
                                }}
                                title="Banka Hesabı Seç (F3/F4)"
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

                        {/* Açıklama / Adı */}
                        <td>
                          <Form.Control
                            ref={(el) => { odemeInputRefs.current[`${oRow.id}_paraAdi`] = el; }}
                            size="sm"
                            value={isOdemeCari ? (oRow.cariUnvan || unvan || "CARİ HESAP") : (isOdemeKart || isOdemeHesap) ? (oRow.paraAdi || (isOdemeKart ? "KREDİ KARTI / POS" : "BANKA HAVALE / EFT")) : (oRow.paraAdi || (oRow.paraKodu === "TL" ? "TÜRK LİRASI" : ""))}
                            readOnly
                            tabIndex={-1}
                            onFocus={handleOdemeRowFocus}
                            onKeyDown={(e) => handleOdemeGridKeyDown(e, rowIndex, "paraAdi", oRow.id)}
                            style={{ fontSize: "11px", padding: "1px 4px", background: "#e9ecef" }}
                          />
                        </td>

                        {/* Para / İskonto (+ Dürbün) */}
                        <td>
                          <InputGroup size="sm" style={isOdemeKodMissing ? { backgroundColor: "#fee2e2", border: "1.5px solid #dc2626", borderRadius: "3px" } : {}}>
                            <Form.Control
                              ref={(el) => { odemeInputRefs.current[`${oRow.id}_paraKodu`] = el; }}
                              value={oRow.paraKodu || ""}
                              placeholder={isOdemeCari ? "Para / İskonto Seç" : "Para Kod / Dürbün"}
                              onChange={(e) => {
                                const val = e.target.value;
                                updateOdemeRow(oRow.id, "paraKodu", val);
                                if (val.trim().toUpperCase() === "TL" || val.trim().toUpperCase() === "TRY" || val.trim().toUpperCase() === "TRL") {
                                  setOdemeRows((prev) => prev.map((r) => r.id === oRow.id ? { ...r, paraKodu: "TL", paraAdi: "TÜRK LİRASI", adet: "", kur: "", milyem: "", urunTipi: 0, hasGram: "" } : r));
                                } else if (isOdemeCari) {
                                  const iskMatch = iskontoList.find((isk) => (isk.kod || "").trim().toLowerCase() === val.trim().toLowerCase());
                                  if (iskMatch) {
                                    applyIskontoToOdemeRow(oRow.id, iskMatch);
                                  } else {
                                    const match = urunList.find((u) => u.kod.trim().toLowerCase() === val.trim().toLowerCase());
                                    if (match) {
                                      applyProductToOdemeRow(oRow.id, match);
                                    }
                                  }
                                } else {
                                  const match = urunList.find((u) => u.kod.trim().toLowerCase() === val.trim().toLowerCase());
                                  if (match) {
                                    applyProductToOdemeRow(oRow.id, match);
                                  }
                                }
                              }}
                              onBlur={(e) => {
                                const val = e.target.value.trim();
                                if (val.toUpperCase() === "TL" || val.toUpperCase() === "TRY" || val.toUpperCase() === "TRL") {
                                  setOdemeRows((prev) => prev.map((r) => r.id === oRow.id ? { ...r, paraKodu: "TL", paraAdi: "TÜRK LİRASI", adet: "", kur: "", milyem: "", urunTipi: 0, hasGram: "" } : r));
                                } else if (val) {
                                  if (isOdemeCari) {
                                    const iskMatch = iskontoList.find((isk) => (isk.kod || "").toLowerCase() === val.toLowerCase());
                                    if (iskMatch) {
                                      applyIskontoToOdemeRow(oRow.id, iskMatch);
                                    } else {
                                      const match = urunList.find((u) => u.kod.trim().toLowerCase() === val.toLowerCase());
                                      if (match) {
                                        applyProductToOdemeRow(oRow.id, match);
                                      } else {
                                        const kMatch = kurSatirlar.find((k) => (k.kod || "").trim().toLowerCase() === val.toLowerCase());
                                        if (kMatch) {
                                          applyProductToOdemeRow(oRow.id, {
                                            id: kMatch.paraId || 0,
                                            paraId: kMatch.paraId,
                                            kod: kMatch.kod || val.toUpperCase(),
                                            ad: kMatch.ad || val.toUpperCase(),
                                            urunTipi: 0,
                                            alisFiyati: kMatch.dovizAlis ?? kMatch.efektifAlis ?? 0,
                                            satisFiyati: kMatch.dovizSatis ?? kMatch.efektifSatis ?? 0,
                                          } as UrunItem);
                                        }
                                      }
                                    }
                                  } else {
                                    const match = urunList.find((u) => u.kod.trim().toLowerCase() === val.toLowerCase());
                                    if (match) {
                                      applyProductToOdemeRow(oRow.id, match);
                                    } else {
                                      const kMatch = kurSatirlar.find((k) => (k.kod || "").trim().toLowerCase() === val.toLowerCase());
                                      if (kMatch) {
                                        applyProductToOdemeRow(oRow.id, {
                                          id: kMatch.paraId || 0,
                                          paraId: kMatch.paraId,
                                          kod: kMatch.kod || val.toUpperCase(),
                                          ad: kMatch.ad || val.toUpperCase(),
                                          urunTipi: 0,
                                          alisFiyati: kMatch.dovizAlis ?? kMatch.efektifAlis ?? 0,
                                          satisFiyati: kMatch.dovizSatis ?? kMatch.efektifSatis ?? 0,
                                        } as UrunItem);
                                      }
                                    }
                                  }
                                }
                                setInvalidOdemeRowIds((prev) => ({ ...prev, [oRow.id]: true }));
                              }}
                              onDoubleClick={() => {
                                if (isOdemeCari) {
                                  openOdemeParaIskontoModal(oRow.id, oRow.paraKodu);
                                } else {
                                  openOdemeUrunModal(oRow.id);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "F4" || e.key === "F3") {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (isOdemeCari) {
                                    openOdemeParaIskontoModal(oRow.id, oRow.paraKodu);
                                  } else {
                                    openOdemeUrunModal(oRow.id);
                                  }
                                  return;
                                }
                                handleOdemeGridKeyDown(e, rowIndex, "paraKodu", oRow.id);
                              }}
                              onFocus={handleOdemeRowFocus}
                              className={isOdemeKodMissing ? "text-danger fw-bold" : ""}
                              style={{
                                fontSize: "11px",
                                padding: "1px 4px",
                                textTransform: "uppercase",
                                backgroundColor: isOdemeKodMissing ? "#fee2e2" : undefined,
                              }}
                              title={isOdemeKodMissing ? "Lütfen para veya iskonto kodu seçiniz" : undefined}
                            />
                            <Button
                              type="button"
                              tabIndex={-1}
                              variant="outline-secondary"
                              className="px-1 py-0 d-flex align-items-center"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (isOdemeCari) {
                                  openOdemeParaIskontoModal(oRow.id, oRow.paraKodu);
                                } else {
                                  openOdemeUrunModal(oRow.id);
                                }
                              }}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (isOdemeCari) {
                                  openOdemeParaIskontoModal(oRow.id, oRow.paraKodu);
                                } else {
                                  openOdemeUrunModal(oRow.id);
                                }
                              }}
                              title={isOdemeCari ? "Para / İskonto Seç (F3/F4)" : "Para / Ürün Seç (F3/F4)"}
                            >
                              <IconBinoculars size={12} />
                            </Button>
                          </InputGroup>
                        </td>

                        {/* Adet */}
                        <td>
                          <Form.Control
                            ref={(el) => { odemeInputRefs.current[`${oRow.id}_adet`] = el; }}
                            inputMode="numeric"
                            size="sm"
                            readOnly={isOdemePara}
                            tabIndex={isOdemePara ? -1 : undefined}
                            className={`text-end font-monospace ${isOdemePara ? "text-muted" : ""} ${isOdemeAdetMissing ? "text-danger fw-bold" : ""}`}
                            value={isOdemePara ? "" : (oRow.adet || "")}
                            onChange={(e) => !isOdemePara && updateOdemeRow(oRow.id, "adet", e.target.value)}
                            onKeyDown={(e) => handleOdemeGridKeyDown(e, rowIndex, "adet", oRow.id)}
                            onBlur={() => setInvalidOdemeRowIds((prev) => ({ ...prev, [oRow.id]: true }))}
                            onFocus={handleOdemeRowFocus}
                            style={{
                              fontSize: "11px",
                              padding: "1px 4px",
                              backgroundColor: isOdemePara ? "#e9ecef" : (isOdemeAdetMissing ? "#fee2e2" : undefined),
                              border: isOdemeAdetMissing ? "1.5px solid #dc2626" : undefined,
                              cursor: isOdemePara ? "not-allowed" : undefined,
                            }}
                            title={isOdemePara ? "Döviz/Para işlemlerinde adet girilmez, miktar kullanılır" : isOdemeAdetMissing ? "Lütfen adet veya miktar giriniz" : undefined}
                          />
                        </td>

                        {/* Miktar */}
                        <td>
                          <Form.Control
                            ref={(el) => { odemeInputRefs.current[`${oRow.id}_miktar`] = el; }}
                            inputMode="decimal"
                            size="sm"
                            className={`text-end font-monospace ${isOdemeMiktarMissing ? "text-danger fw-bold" : ""}`}
                            value={oRow.miktar}
                            onChange={(e) => updateOdemeRow(oRow.id, "miktar", e.target.value)}
                            onKeyDown={(e) => handleOdemeGridKeyDown(e, rowIndex, "miktar", oRow.id)}
                            onBlur={() => normalizeOdemeRowOnBlur(oRow.id, "miktar")}
                            onFocus={handleOdemeRowFocus}
                            style={{
                              fontSize: "11px",
                              padding: "1px 4px",
                              backgroundColor: isOdemeMiktarMissing ? "#fee2e2" : undefined,
                              border: isOdemeMiktarMissing ? "1.5px solid #dc2626" : undefined,
                            }}
                            title={isOdemeMiktarMissing ? "Lütfen miktar giriniz" : undefined}
                          />
                        </td>

                        {/* Milyem */}
                        <td>
                          <Form.Control
                            ref={(el) => { odemeInputRefs.current[`${oRow.id}_milyem`] = el; }}
                            inputMode="decimal"
                            data-decimal="true"
                            size="sm"
                            readOnly={isOdemePara}
                            tabIndex={isOdemePara ? -1 : undefined}
                            className={`text-end font-monospace ${isOdemePara ? "text-muted" : ""}`}
                            value={isOdemePara ? "" : oRow.milyem}
                            onChange={(e) => !isOdemePara && updateOdemeRow(oRow.id, "milyem", e.target.value)}
                            onKeyDown={(e) => handleOdemeGridKeyDown(e, rowIndex, "milyem", oRow.id)}
                            onBlur={() => {
                              if (!isOdemePara) normalizeOdemeRowOnBlur(oRow.id, "milyem");
                              else setInvalidOdemeRowIds((prev) => ({ ...prev, [oRow.id]: true }));
                            }}
                            onFocus={handleOdemeRowFocus}
                            style={{
                              fontSize: "11px",
                              padding: "1px 4px",
                              backgroundColor: isOdemePara ? "#e9ecef" : undefined,
                              cursor: isOdemePara ? "not-allowed" : undefined,
                            }}
                            title={isOdemePara ? "Döviz/Para işlemlerinde milyem girilmez" : undefined}
                          />
                        </td>

                        {/* Has Gr - Pasif / Otomatik Hesaplanır */}
                        <td>
                          <Form.Control
                            ref={(el) => { odemeInputRefs.current[`${oRow.id}_hasGram`] = el; }}
                            readOnly
                            tabIndex={-1}
                            size="sm"
                            className="text-end font-monospace text-muted"
                            value={oRow.hasGram}
                            onFocus={handleOdemeRowFocus}
                            onKeyDown={(e) => handleOdemeGridKeyDown(e, rowIndex, "hasGram", oRow.id)}
                            style={{ fontSize: "11px", padding: "1px 4px", backgroundColor: "#e9ecef", cursor: "not-allowed" }}
                            title="Has gram otomatik hesaplanır, değiştirilemez"
                          />
                        </td>

                        {/* Kur */}
                        <td>
                          <Form.Control
                            ref={(el) => { odemeInputRefs.current[`${oRow.id}_kur`] = el; }}
                            inputMode="decimal"
                            size="sm"
                            readOnly={isOdemeKurDisabled}
                            disabled={isOdemeKurDisabled}
                            tabIndex={isOdemeKurDisabled ? -1 : undefined}
                            className={`text-end font-monospace ${isOdemeTL ? "text-muted" : "fw-bold text-dark"} ${isOdemeKurMissing ? "text-danger fw-bold" : ""}`}
                            value={isOdemeTL ? "" : (oRow.kur && Number(oRow.kur) > 0 ? oRow.kur : (getKurForProduct({ paraId: oRow.paraId ?? undefined, kod: oRow.paraKodu, urunTipi: oRow.urunTipi, ad: oRow.paraAdi }, tip === 0 ? 0 : 1) || (Number(altinHasKuru) > 0 ? altinHasKuru : "")))}
                            placeholder={isOdemeTL ? "-" : "Kur"}
                            onChange={(e) => !isOdemeKurDisabled && updateOdemeRow(oRow.id, "kur", e.target.value)}
                            onKeyDown={(e) => handleOdemeGridKeyDown(e, rowIndex, "kur", oRow.id)}
                            onBlur={() => !isOdemeKurDisabled && normalizeOdemeRowOnBlur(oRow.id, "kur")}
                            onFocus={handleOdemeRowFocus}
                            style={{
                              fontSize: "11px",
                              padding: "1px 4px",
                              backgroundColor: isOdemeTL ? "#e9ecef" : (isOdemeKurMissing ? "#fee2e2" : "#f8fafc"),
                              border: isOdemeKurMissing ? "1.5px solid #dc2626" : undefined,
                              cursor: "not-allowed",
                            }}
                            title={isOdemeTL ? "TL için kur sabittir" : isOdemeKart ? "Kart işlemlerinde kur sabittir" : isOdemeHesap ? "Hesap işlemlerinde kur sabittir" : "Sistem kuru (Değiştirilemez)"}
                          />
                        </td>

                        {/* Tutar - Pasif / Otomatik Hesaplanır */}
                        <td>
                          <Form.Control
                            ref={(el) => { odemeInputRefs.current[`${oRow.id}_tutar`] = el; }}
                            readOnly
                            tabIndex={-1}
                            size="sm"
                            className="text-end font-monospace text-muted"
                            value={oRow.tutar}
                            onFocus={handleOdemeRowFocus}
                            onKeyDown={(e) => handleOdemeGridKeyDown(e, rowIndex, "tutar", oRow.id)}
                            style={{ fontSize: "11px", padding: "1px 4px", backgroundColor: "#e9ecef", cursor: "not-allowed" }}
                            title="Tutar otomatik hesaplanır, değiştirilemez"
                          />
                        </td>
                      </tr>
                    );
                  })}
                  </tbody>
                  <tfoot style={{ background: "#f2f4f7", fontWeight: 600, fontSize: "11px" }}>
                    <tr>
                      <td colSpan={4} className="text-end small">Toplam</td>
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
                        <td className="text-end font-monospace" style={{ color: totalTutar < 0 ? "#dc2626" : "inherit" }}>
                          {totalTutar.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="text-end font-monospace" style={{ color: alisHas < 0 ? "#dc2626" : "inherit" }}>
                          {alisHas.toFixed(4)}
                        </td>
                      </tr>
                      <tr>
                        <td className="fw-semibold text-secondary">{tip === 0 ? "Ödeme" : "Tahsilat"}</td>
                        <td className="text-end font-monospace" style={{ color: totalOdemeTutar < 0 ? "#dc2626" : "inherit" }}>
                          {totalOdemeTutar.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="text-end font-monospace" style={{ color: odemeHas < 0 ? "#dc2626" : "inherit" }}>
                          {odemeHas.toFixed(4)}
                        </td>
                      </tr>
                      {/* Fark Satırı */}
                      <tr
                        style={{
                          background: (farkTL < -0.01 || farkHas < -0.0001)
                            ? "#fee2e2"
                            : ((Math.abs(farkTL) > 0.01 || Math.abs(farkHas) > 0.0001) ? "#fffbeb" : "#f8f9fa"),
                          border: (farkTL < -0.01 || farkHas < -0.0001) ? "1.5px solid #dc2626" : undefined,
                        }}
                      >
                        <td
                          className="fw-bold"
                          style={{
                            color: (farkTL < -0.01 || farkHas < -0.0001) ? "#dc2626" : "inherit",
                            verticalAlign: "middle",
                          }}
                        >
                          Fark {(farkTL < -0.01 || farkHas < -0.0001) ? (
                            <span
                              className="badge bg-danger ms-1"
                              style={{
                                fontSize: "10px",
                                padding: "3px 6px",
                                boxShadow: "0 0 6px rgba(220,38,38,0.5)",
                              }}
                            >
                              Eksi Bakiye
                            </span>
                          ) : null}
                        </td>
                        <td
                          className="text-end fw-bold font-monospace"
                          style={{
                            color: farkTL < -0.01 ? "#dc2626" : (Math.abs(farkTL) > 0.01 ? "#d97706" : "#16a34a"),
                            fontSize: "12.5px",
                            fontWeight: 800,
                            verticalAlign: "middle",
                            backgroundColor: farkTL < -0.01 ? "#fecaca" : undefined,
                          }}
                        >
                          {farkTL.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                        </td>
                        <td
                          className="text-end fw-bold font-monospace"
                          style={{
                            color: farkHas < -0.0001 ? "#dc2626" : (Math.abs(farkHas) > 0.0001 ? "#d97706" : "#16a34a"),
                            fontSize: "12.5px",
                            fontWeight: 800,
                            verticalAlign: "middle",
                            backgroundColor: farkHas < -0.0001 ? "#fecaca" : undefined,
                          }}
                        >
                          {farkHas.toFixed(4)}
                        </td>
                      </tr>
                    </tbody>
                  </Table>
                </div>
              </div>
            </Col>
          </Row>

          {/* ─── Alt Kısayol Çubuğu (Kaydet, F7 Arbitraj, F8 Detay ve Sağda Belge Türü) ───────── */}
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
                onClick={() => setShowArbitrajModal(true)}
                title="Arbitraj İşlemi Aç (F7)"
              >
                <Badge bg="warning" className="text-dark px-1.5 py-0.5" style={{ fontSize: "10.5px" }}>F7</Badge>
                <span className="fw-bold text-dark">Arbitraj</span>
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
                title="Fişi Kaydet / Yazdır (F10)"
              >
                <Badge bg="success" className="px-1.5 py-0.5" style={{ fontSize: "10.5px" }}>F10</Badge>
                <span className="fw-bold text-dark">Kaydet / Yazdır</span>
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
        initialSearchField={cariSearchField}
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
              adRef.current?.focus();
              adRef.current?.select();
            }, 50);
          } else if (caller === "vkn") {
            setTimeout(() => {
              tcknRef.current?.focus();
              tcknRef.current?.select();
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
        onAddNew={() => setShowNewVezneModal(true)}
        addNewLabel="Yeni Kayıt"
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
          const caller = lastModalCallerRef.current;
          const kRowId = lastKalemModalRowIdRef.current;
          const oRowId = lastOdemeModalRowIdRef.current;
          lastModalCallerRef.current = null;
          lastKalemModalRowIdRef.current = null;
          lastOdemeModalRowIdRef.current = null;
          activeRowIdForUrunRef.current = null;
          activeOdemeRowIdForUrunRef.current = null;
          setActiveRowIdForUrun(null);
          setActiveOdemeRowIdForUrun(null);

          if (caller === "gridKalem" && kRowId) {
            setTimeout(() => {
              focusGridCell(kRowId, "urunKodu", "select");
            }, 50);
          } else if (caller === "gridOdeme" && oRowId) {
            setTimeout(() => {
              focusOdemeGridCell(oRowId, "paraKodu", "select");
            }, 50);
          }
        }}
        title={Boolean(activeRowIdForUrunRef.current || activeRowIdForUrun) ? "Ürün Seçimi" : "Para / Döviz Seç"}
        items={urunList}
        isLoading={isUrunLoading}
        columns={urunColumns}
        onAddNew={() => setShowNewProductModal(true)}
        addNewLabel="Yeni Kayıt"
        isItemDisabled={(item) => {
          const isKalemModal = Boolean(activeRowIdForUrunRef.current || activeRowIdForUrun);
          if (!isKalemModal) return false;
          const k = (item.kod || "").trim().toUpperCase();
          return k === "TL" || k === "TRY" || (item.ad || "").toUpperCase().includes("TÜRK LİRASI");
        }}
        filterFn={(item, term) => {
          const t = (term || "").toLowerCase().trim();
          if (!t) return true;
          return (
            (item.kod || "").toLowerCase().includes(t) ||
            (item.ad || "").toLowerCase().includes(t) ||
            ((item as any).barkod || "").toLowerCase().includes(t) ||
            ((item as any).model || "").toLowerCase().includes(t) ||
            ((item as any).ayar || "").toLowerCase().includes(t) ||
            ((item as any).grupKodu || "").toLowerCase().includes(t) ||
            ((item as any).aciklama || "").toLowerCase().includes(t) ||
            ((item as any).mamulTipi || "").toLowerCase().includes(t)
          );
        }}
        onSelect={(item) => {
          lastModalCallerRef.current = null;
          lastKalemModalRowIdRef.current = null;
          lastOdemeModalRowIdRef.current = null;
          const targetKalemRowId = activeRowIdForUrunRef.current || activeRowIdForUrun;
          const targetOdemeRowId = activeOdemeRowIdForUrunRef.current || activeOdemeRowIdForUrun;

          if (targetKalemRowId) {
            applyProductToRow(targetKalemRowId, item);
            const isPara = item.urunTipi === 0;
            setTimeout(() => {
              focusGridCell(targetKalemRowId, isPara ? "miktar" : "adet", "select");
            }, 30);
          } else if (targetOdemeRowId) {
            applyProductToOdemeRow(targetOdemeRowId, item);
            const isPara = item.urunTipi === 0 || item.kod?.toUpperCase() === "TL" || item.kod?.toUpperCase() === "TRY";
            setTimeout(() => {
              focusOdemeGridCell(targetOdemeRowId, isPara ? "miktar" : "adet", "select");
            }, 30);
          }
          setShowUrunModal(false);
          activeRowIdForUrunRef.current = null;
          activeOdemeRowIdForUrunRef.current = null;
          setActiveRowIdForUrun(null);
          setActiveOdemeRowIdForUrun(null);
        }}
      />

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
              onSuccess={async (createdProduct) => {
                setShowNewProductModal(false);
                setShowUrunModal(false);
                try {
                  const uList = await SarrafFisService.getUrunler();
                  if (uList && uList.length > 0) {
                    setUrunList(uList);
                    const targetKalemRowId = activeRowIdForUrunRef.current || activeRowIdForUrun;
                    const targetOdemeRowId = activeOdemeRowIdForUrunRef.current || activeOdemeRowIdForUrun;
                    const matched = (createdProduct
                      ? uList.find((x) => x.id === createdProduct.id || x.kod.toLowerCase() === createdProduct.kod.toLowerCase())
                      : null) || uList[uList.length - 1];
                    if (matched) {
                      if (targetKalemRowId) {
                        applyProductToRow(targetKalemRowId, matched);
                      } else if (targetOdemeRowId) {
                        applyProductToOdemeRow(targetOdemeRowId, matched);
                      }
                    }
                  }
                } catch (err) {
                  console.error("Ürün listesi yenilenirken hata:", err);
                }
              }}
              onCancel={() => setShowNewProductModal(false)}
            />
          </Modal.Body>
        </Modal>
      )}

      {/* Ödeme Tablosu: Cari Seçim Modalı */}
      <LookupModal<CariKartItem>
        show={showOdemeCariModal}
        searchByCodeOnly={true}
        onHide={() => {
          setShowOdemeCariModal(false);
          if (targetOdemeRowIdForLookup) {
            focusOdemeGridCell(targetOdemeRowIdForLookup, "paraKodu", "select");
          }
        }}
        title="Cari Kart Seç (Tahsilat / Ödeme)"
        items={cariList}
        columns={odemeCariColumns}
        onAddNew={() => setShowNewCariModal(true)}
        addNewLabel="Yeni Kayıt"
        filterFn={(item, term) => {
          const t = (term || "").toLowerCase().trim();
          if (!t) return true;
          return (item.kod || "").toLowerCase().includes(t);
        }}
        onSelect={(item) => {
          if (targetOdemeRowIdForLookup) {
            applyCariToOdemeRow(targetOdemeRowIdForLookup, item);
            setTimeout(() => {
              focusOdemeGridCell(targetOdemeRowIdForLookup, "miktar", "select");
            }, 30);
          }
          setShowOdemeCariModal(false);
        }}
      />

      {/* Ödeme Tablosu: Para / İskonto Seçim Modalı (Cari Satırları İçin) */}
      <LookupModal<any>
        show={showOdemeParaIskontoModal}
        searchByCodeOnly={true}
        onHide={() => {
          setShowOdemeParaIskontoModal(false);
          if (targetOdemeRowIdForLookup) {
            focusOdemeGridCell(targetOdemeRowIdForLookup, "paraKodu", "select");
          }
        }}
        title="Para / İskonto Seç (Tahsilat / Ödeme)"
        items={allOdemeParaIskontoList}
        columns={odemeParaIskontoColumns}
        onAddNew={() => setShowNewIskontoModal(true)}
        addNewLabel="Yeni İskonto Tanımla"
        filterFn={(item, term) => {
          const t = (term || "").toLowerCase().trim();
          if (!t) return true;
          return (item.kod || "").toLowerCase().includes(t);
        }}
        onSelect={(item) => {
          if (targetOdemeRowIdForLookup) {
            if (item.tur === "İSKONTO" && item.rawIskonto) {
              applyIskontoToOdemeRow(targetOdemeRowIdForLookup, item.rawIskonto);
              setTimeout(() => {
                focusOdemeGridCell(targetOdemeRowIdForLookup, "tutar", "select");
              }, 30);
            } else if (item.rawProduct) {
              applyProductToOdemeRow(targetOdemeRowIdForLookup, item.rawProduct);
              const isPara = item.rawProduct.urunTipi === 0 || item.rawProduct.kod?.toUpperCase() === "TL" || item.rawProduct.kod?.toUpperCase() === "TRY";
              setTimeout(() => {
                focusOdemeGridCell(targetOdemeRowIdForLookup, isPara ? "miktar" : "adet", "select");
              }, 30);
            }
          }
          setShowOdemeParaIskontoModal(false);
        }}
      />

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
              <IconCoins size={20} className="text-primary" />
              <span>Yeni İskonto Tanımı</span>
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="p-3" style={{ maxHeight: "80vh", overflowY: "auto" }}>
            <IskontoDefinitionsPage
              isModal={true}
              onSuccess={async (createdIskonto) => {
                setShowNewIskontoModal(false);
                setShowOdemeParaIskontoModal(false);
                try {
                  const iskList = await IskontoService.getIskontolar({ aktif: true });
                  if (iskList && iskList.length > 0) {
                    setIskontoList(iskList);
                    if (targetOdemeRowIdForLookup && createdIskonto) {
                      applyIskontoToOdemeRow(targetOdemeRowIdForLookup, createdIskonto);
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

      {/* Ödeme Tablosu: Cari Para (Para / Döviz) Seçim Modalı */}
      <LookupModal<UrunItem>
        show={showOdemeParaModal}
        searchByCodeOnly={true}
        onHide={() => {
          setShowOdemeParaModal(false);
          if (targetOdemeRowIdForLookup) {
            focusOdemeGridCell(targetOdemeRowIdForLookup, "paraKodu", "select");
          }
        }}
        title="Para / Döviz Seç (Cari Para)"
        items={odemeParaList}
        columns={odemeParaColumns}
        onAddNew={() => setShowNewProductModal(true)}
        addNewLabel="Yeni Kayıt"
        filterFn={(item, term) => {
          const t = (term || "").toLowerCase().trim();
          if (!t) return true;
          return (item.kod || "").toLowerCase().includes(t);
        }}
        onSelect={(item) => {
          if (targetOdemeRowIdForLookup) {
            applyProductToOdemeRow(targetOdemeRowIdForLookup, item);
            setTimeout(() => {
              focusOdemeGridCell(targetOdemeRowIdForLookup, "miktar", "select");
            }, 30);
          }
          setShowOdemeParaModal(false);
        }}
      />

      {/* Ödeme Tablosu: Banka / Hesap Seçim Modalı */}
      <LookupModal<BankaHesapItem>
        show={showOdemeHesapModal}
        searchByCodeOnly={true}
        initialSearchTerm={odemeLookupSearchTerm}
        onHide={() => {
          setShowOdemeHesapModal(false);
          setOdemeLookupSearchTerm("");
          if (targetOdemeRowIdForLookup) {
            focusOdemeGridCell(targetOdemeRowIdForLookup, "paraKodu", "select");
          }
        }}
        title="Banka / Hesap Seç (Tahsilat / Ödeme)"
        items={bankaList}
        columns={odemeHesapColumns}
        onAddNew={() => setShowNewBankaModal(true)}
        addNewLabel="Yeni Kayıt"
        filterFn={(item, term) => {
          const t = (term || "").toLowerCase().trim();
          if (!t) return true;
          return (item.hesapNo || "").toLowerCase().includes(t) || (item.iban || "").toLowerCase().includes(t) || (item.hesapAdi || "").toLowerCase().includes(t);
        }}
        onSelect={(item) => {
          if (targetOdemeRowIdForLookup) {
            applyHesapToOdemeRow(targetOdemeRowIdForLookup, item);
            setTimeout(() => {
              focusOdemeGridCell(targetOdemeRowIdForLookup, "miktar", "select");
            }, 30);
          }
          setShowOdemeHesapModal(false);
          setOdemeLookupSearchTerm("");
        }}
      />

      {/* Ödeme Tablosu: POS Seçim Modalı */}
      <LookupModal<PosCihaziItem>
        show={showOdemePosModal}
        searchByCodeOnly={true}
        initialSearchTerm={odemeLookupSearchTerm}
        onHide={() => {
          setShowOdemePosModal(false);
          setOdemeLookupSearchTerm("");
          if (targetOdemeRowIdForLookup) {
            focusOdemeGridCell(targetOdemeRowIdForLookup, "paraKodu", "select");
          }
        }}
        title="POS Cihazı Seç (Tahsilat / Ödeme)"
        items={posList}
        columns={odemePosColumns}
        filterFn={(item, term) => {
          const t = (term || "").toLowerCase().trim();
          if (!t) return true;
          return (item.kod || "").toLowerCase().includes(t) || (item.ad || "").toLowerCase().includes(t);
        }}
        onSelect={(item) => {
          if (targetOdemeRowIdForLookup) {
            applyPosToOdemeRow(targetOdemeRowIdForLookup, item);
            setTimeout(() => {
              focusOdemeGridCell(targetOdemeRowIdForLookup, "miktar", "select");
            }, 30);
          }
          setShowOdemePosModal(false);
          setOdemeLookupSearchTerm("");
        }}
      />

      {/* Yeni Cari Kart Tanımı Modalı */}
      {showNewCariModal && (
        <Modal
          show={showNewCariModal}
          onHide={() => setShowNewCariModal(false)}
          size="xl"
          centered
          backdrop="static"
          dialogClassName="modal-95w"
        >
          <Modal.Header closeButton className="py-2 px-3 bg-light">
            <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2">
              <IconUsers size={20} className="text-primary" />
              <span>Yeni Cari Kart Tanımı</span>
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="p-3" style={{ maxHeight: "85vh", overflowY: "auto" }}>
            <CariCardRegistrationPage
              isModal={true}
              onSuccess={async (createdCari) => {
                setShowNewCariModal(false);
                setShowOdemeCariModal(false);
                try {
                  const updatedList = await CariService.getCariKartlar();
                  if (updatedList && updatedList.length > 0) {
                    setCariList(updatedList);
                    const matched = (createdCari
                      ? updatedList.find((x) => x.id === createdCari.id || (x.kod && x.kod.toLowerCase() === (createdCari.kod || "").toLowerCase()))
                      : null) || updatedList[updatedList.length - 1];
                    if (matched && targetOdemeRowIdForLookup) {
                      applyCariToOdemeRow(targetOdemeRowIdForLookup, matched);
                      setTimeout(() => {
                        focusOdemeGridCell(targetOdemeRowIdForLookup, "miktar", "select");
                      }, 50);
                    }
                  }
                } catch (err) {
                  console.error("Cari listesi yenilenirken hata:", err);
                }
              }}
              onCancel={() => setShowNewCariModal(false)}
            />
          </Modal.Body>
        </Modal>
      )}

      {/* Yeni Banka / Hesap Tanımı Modalı */}
      {showNewBankaModal && (
        <Modal
          show={showNewBankaModal}
          onHide={() => setShowNewBankaModal(false)}
          size="xl"
          centered
          backdrop="static"
          dialogClassName="modal-95w"
        >
          <Modal.Header closeButton className="py-2 px-3 bg-light">
            <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2">
              <IconBuildingBank size={20} className="text-primary" />
              <span>Yeni Banka / Hesap Tanımı</span>
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="p-3" style={{ maxHeight: "85vh", overflowY: "auto" }}>
            <BankaHesapKartiPage
              isModal={true}
              onSuccess={async (createdHesap) => {
                setShowNewBankaModal(false);
                setShowOdemeHesapModal(false);
                try {
                  const updatedList = await BankaService.getBankalar();
                  if (updatedList && updatedList.length > 0) {
                    setBankaList(updatedList);
                    const matched = (createdHesap
                      ? updatedList.find((x) => x.bankaId === createdHesap.bankaId || (x.hesapNo && x.hesapNo.toLowerCase() === (createdHesap.hesapNo || "").toLowerCase()))
                      : null) || updatedList[updatedList.length - 1];
                    if (matched && targetOdemeRowIdForLookup) {
                      applyHesapToOdemeRow(targetOdemeRowIdForLookup, matched);
                      setTimeout(() => {
                        focusOdemeGridCell(targetOdemeRowIdForLookup, "miktar", "select");
                      }, 50);
                    }
                  }
                } catch (err) {
                  console.error("Banka listesi yenilenirken hata:", err);
                }
              }}
              onCancel={() => setShowNewBankaModal(false)}
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
                    setVezneList(data);
                    if (createdVezne) {
                      const matched = data.find((v) => v.id === createdVezne.id || v.kod === createdVezne.kod);
                      if (matched) {
                        setVezneId(matched.id); setVezneKod(matched.kod); setVezneAd(matched.ad);
                        const bak = await SarrafFisService.getVezneBakiye(matched.id).catch(() => []);
                        setBakiyeler(bak);
                      }
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
              void handleSave(true, false, true);
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
        vezne={vezneList.find((v) => v.id === vezneId) || (vezneList.length > 0 ? vezneList[0] : null)}
        kullaniciAdi={printSnapshot?.kullaniciAdi ?? (user?.fullName || user?.username || "Kasiyer")}
        satirlar={printSnapshot?.satirlar ?? lines.filter((l) => Number(l.miktar) > 0 || Number(l.tutar) > 0 || Number(l.adet) > 0 || (l.urunAdi && l.urunAdi.trim() !== ""))}
        odemeSatirlari={printSnapshot?.odemeSatirlari ?? odemeRows.filter((o) => parseDecimal(o.miktar) > 0 || parseDecimal(o.tutar) > 0 || parseDecimal(o.adet) > 0 || (o.paraKodu && o.paraKodu.trim() !== ""))}
        toplamTutar={printSnapshot?.toplamTutar ?? totalTutar}
        toplamHas={printSnapshot?.toplamHas ?? alisHas}
        odenenTutar={printSnapshot?.odenenTutar ?? totalOdemeTutar}
        kalanTutar={printSnapshot?.kalanTutar ?? farkTL}
      />

      {/* Eksi Bakiye / Fark Onay Modalı */}
      <Modal
        show={showFarkConfirmModal.show}
        onHide={() => setShowFarkConfirmModal({ show: false, andPrint: false })}
        centered
        backdrop="static"
      >
        <Modal.Header closeButton className="bg-danger text-white py-2">
          <Modal.Title style={{ fontSize: "15px", fontWeight: 700 }}>
            ⚠️ Bakiye Farkı Uyarısı
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3">
          <div className="alert alert-danger mb-3 p-2.5" style={{ fontSize: "13px" }}>
            <div className="fw-bold mb-1">
              🚨 Fişte Eksi Bakiye / Ödeme Farkı Bulunmaktadır!
            </div>
            <div className="mt-2 d-flex flex-column gap-1 font-monospace">
              <div><strong>TL Fark:</strong> <span className="text-danger fw-bold">{farkTL.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL</span></div>
              <div><strong>HAS Fark:</strong> <span className="text-danger fw-bold">{farkHas.toFixed(4)} Has</span></div>
            </div>
          </div>
          <p className="mb-0" style={{ fontSize: "13.5px" }}>
            Ödeme / tahsilat toplamı işlem tutarını karşılamıyor veya eksi bakiye oluşturuyor. <strong>Fişi yine de kaydetmek istiyor musunuz?</strong>
          </p>
        </Modal.Body>
        <Modal.Footer className="py-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowFarkConfirmModal({ show: false, andPrint: false })}
          >
            Vazgeç
          </Button>
          <Button
            variant="danger"
            size="sm"
            className="fw-bold"
            onClick={() => {
              const andPrint = showFarkConfirmModal.andPrint;
              setShowFarkConfirmModal({ show: false, andPrint: false });
              void handleSave(true, andPrint, true);
            }}
          >
            Evet, Yine de Kaydet
          </Button>
        </Modal.Footer>
      </Modal>

      {/* F7) Arbitraj Modalı */}
      <ArbitrajModal
        show={showArbitrajModal}
        onClose={() => setShowArbitrajModal(false)}
        paralar={kurSatirlar.map((k) => ({
          id: k.paraId,
          kod: k.kod,
          ad: k.ad,
          isMaden: false,
          dovizAlis: k.dovizAlis ?? undefined,
          dovizSatis: k.dovizSatis ?? undefined,
          efektifAlis: k.efektifAlis ?? undefined,
          efektifSatis: k.efektifSatis ?? undefined,
          parite: k.parite ?? undefined,
        }))}
        kurSatirlar={kurSatirlar}
        urunler={urunList}
        vezneId={vezneId}
        vezneKod={vezneKod}
        vezneAd={vezneAd}
        selectedCariId={cariKartId}
        selectedUnvan={unvan || detayUnvan}
        cariList={cariList}
        pageType="sarraf"
        fisTip={tip}
        onApplyToFis={handleApplyArbitrajToSarrafFis}
      />
    </div>
  );
};

export default SarrafFisiPage;
