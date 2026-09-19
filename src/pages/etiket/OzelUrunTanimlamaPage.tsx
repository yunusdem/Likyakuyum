import React, { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Row, Col, Card, Form, Button, Alert, InputGroup, Modal, Dropdown, Table, Badge } from "react-bootstrap";
import {
  IconCheck,
  IconAlertTriangle,
  IconBinoculars,
  IconCamera,
  IconPlus,
  IconCoin,
  IconDiamond,
  IconTrash,
  IconFolder,
  IconScale,
  IconSparkles,
  IconX,
  IconMaximize,
  IconChevronLeft,
  IconChevronRight,
  IconPrinter,
} from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import LookupModal, { LookupColumn } from "../../components/common/LookupModal";
import { AyarSecimModal } from "../../components/common/AyarSecimModal";
import EtiketYazdirModal, { EtiketYazdirItem } from "./EtiketYazdirModal";
import {
  EtiketService,
  OzelUrunItem,
  SaveOzelUrunPayload,
  EtiketSablonItem,
  EtiketGrupItem,
  BankoItem,
} from "../../services/etiketService";
import { AyarService, AyarItem } from "../../services/ayarService";
import { CariService, CariKartItem } from "../../services/cariService";
import { KurService, KurRowItem } from "../../services/kurService";
import { PrinterService, YaziciItem } from "../../services/printerService";
import { envConfig } from "../../config/env.config";

export interface TasSatiri {
  id: string;
  tasCinsi: string;
  adet: number | string;
  miktar: number | string; // Karat veya Gram
  birim: string; // Ct, Gr
  renk: string;
  saflik: string;
  kesim: string;
  birimFiyat: number | string;
  tutar: number | string;
  paraKodu: string;
}

const AYAR_MILYEM_MAP: Record<string, number> = {
  "24": 1000,
  "24 AYAR": 1000,
  "22": 916,
  "22 AYAR": 916,
  "22 FANTAZI": 956,
  "22 FANTAZİ": 956,
  "22 AYAR FANTAZI": 956,
  "22 AYAR FANTAZİ": 956,
  "18": 750,
  "18 AYAR": 750,
  "14": 585,
  "14 AYAR": 585,
  "8": 333,
  "8 AYAR": 333,
  "925": 925,
  "925 GÜMÜŞ": 925,
  "950": 950,
  "950 PLATİN": 950,
};

const PREDEFINED_TAS_CINSLERI = [
  "Pırlanta",
  "Baget Pırlanta",
  "Tektaş Pırlanta",
  "Zümrüt",
  "Safir",
  "Yakut",
  "Elmas",
  "İnci",
  "Zirkon",
  "Moissanite",
  "Tanzanit",
  "Ametist",
  "Topaz",
  "Turmalin",
  "Akuamarin",
  "Opal",
  "Kuvars",
  "Diğer",
];

const PREDEFINED_KESIMLER = [
  "Brillant (Yuvarlak)",
  "Baget",
  "Prenses",
  "Damla (Armut)",
  "Oval",
  "Markiz",
  "Kalp",
  "Zümrüt Kesim (Emerald)",
  "Radyant",
  "Kushion (Yastık)",
  "Trilyon",
];

const PREDEFINED_RENKLER = [
  "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S-Z", "FANCY"
];

const PREDEFINED_SAFLIKLAR = [
  "FL", "IF", "VVS1", "VVS2", "VS1", "VS2", "SI1", "SI2", "SI3", "I1", "I2", "I3"
];

const resolveImageUrl = (imgStr: string | null | undefined): string => {
  if (!imgStr) return "";
  const trimmed = imgStr.trim();
  if (
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://")
  ) {
    return trimmed;
  }
  if (trimmed.startsWith("/") || trimmed.startsWith("uploads/")) {
    return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  }
  if (trimmed.length > 50 && !trimmed.includes("/") && !trimmed.includes(".")) {
    return `data:image/jpeg;base64,${trimmed}`;
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
};

const format3Digits = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === "") return "";
  const num = typeof val === "number" ? val : parseInt(String(val), 10);
  if (isNaN(num)) return String(val);
  return String(num).padStart(3, "0");
};

const TOTAL_GRID_COLS = 9;

export const OzelUrunTanimlamaPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isDuzeltmeMode = location.pathname.includes("duzeltme");

  // ─── Form State (TODVZ_OZEL_URUN) ───────────────────────────────────────────
  const [ozelUrunId, setOzelUrunId] = useState<number | null>(null);
  const [tarih, setTarih] = useState<string>(new Date().toISOString().slice(0, 10));
  const [grupKodu, setGrupKodu] = useState<string>("");
  const [urunNo, setUrunNo] = useState<number | string>("");
  const [barkod, setBarkod] = useState<string>("");

  // Temel Kimlik Bilgileri
  const [mamulTipi, setMamulTipi] = useState<string>("");
  const [ureticiFirma, setUreticiFirma] = useState<string>("");
  const [orjinalKod, setOrjinalKod] = useState<string>("");
  const [model, setModel] = useState<string>("");
  const [banko, setBanko] = useState<string>("Banko 1");

  // ─── Montür (Altın / Gövde) Özellikleri (Ayar başlangıçta boş) ──────────────
  const [monturGram, setMonturGram] = useState<number | string>("");
  const [ayar, setAyar] = useState<string>("");
  const [ayarList, setAyarList] = useState<AyarItem[]>([]);
  const [showAyarModal, setShowAyarModal] = useState<boolean>(false);
  const [monturHas, setMonturHas] = useState<number | string>("");
  const [monturIscilik, setMonturIscilik] = useState<number | string>("");
  const [monturIscilikBirim, setMonturIscilikBirim] = useState<string>("Gram");
  const [monturIscilikParaKodu, setMonturIscilikParaKodu] = useState<string>("USD");
  const [monturIscilikTutari, setMonturIscilikTutari] = useState<number | string>("");
  const [monturMaliyet, setMonturMaliyet] = useState<number | string>("");

  // ─── Çoklu Taşlar Tablosu (Multi-Stone Grid) ────────────────────────────────
  const [taslar, setTaslar] = useState<TasSatiri[]>([
    {
      id: "tas_1",
      tasCinsi: "",
      adet: "",
      miktar: "",
      birim: "Ct",
      renk: "",
      saflik: "",
      kesim: "",
      birimFiyat: "",
      tutar: "",
      paraKodu: "USD",
    },
  ]);

  // ─── Maliyet, Satış & Kâr Fiyatlandırması ────────────────────────────────────
  const [maliyet, setMaliyet] = useState<number | string>("");
  const [maliyetParaKodu, setMaliyetParaKodu] = useState<string>("USD");
  const [satisFiyati, setSatisFiyati] = useState<number | string>("");
  const [satisParaKodu, setSatisParaKodu] = useState<string>("USD");
  const [satisKariYuzde, setSatisKariYuzde] = useState<number | string>(100);

  // Anlık Kur Alanları (HAS & USD Alış/Satış)
  const [hasAlis, setHasAlis] = useState<number | string>("");
  const [hasSatis, setHasSatis] = useState<number | string>("");
  const [usdAlis, setUsdAlis] = useState<number | string>("");
  const [usdSatis, setUsdSatis] = useState<number | string>("");
  const [eurKuru, setEurKuru] = useState<number | string>("");

  // Resim / Fotoğraf Yönetimi
  const [resim, setResim] = useState<string | null>(null);
  const [resimler, setResimler] = useState<string[]>([]);
  const [seciliResimIndex, setSeciliResimIndex] = useState<number>(0);

  // Canlı Kamera State
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ─── UI & Liste State ───────────────────────────────────────────────────────
  const [ozelList, setOzelList] = useState<OzelUrunItem[]>([]);
  const [grupList, setGrupList] = useState<EtiketGrupItem[]>([]);
  const [bankoList, setBankoList] = useState<BankoItem[]>([]);
  const [ureticiList, setUreticiList] = useState<string[]>([]);
  const [cariList, setCariList] = useState<CariKartItem[]>([]);
  const [sablonlar, setSablonlar] = useState<EtiketSablonItem[]>([]);
  const [kurRows, setKurRows] = useState<KurRowItem[]>([]);
  const [yaziciList, setYaziciList] = useState<YaziciItem[]>([]);

  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "danger" | "warning"; message: string } | null>(null);

  // Modals
  const [showLookup, setShowLookup] = useState(false);
  const [showFirmaLookup, setShowFirmaLookup] = useState(false);
  const [showGrupLookup, setShowGrupLookup] = useState(false);
  const [selectedGrupItem, setSelectedGrupItem] = useState<EtiketGrupItem | null>(null);
  const [showGrupEkleModal, setShowGrupEkleModal] = useState(false);
  const [showBankoLookup, setShowBankoLookup] = useState(false);
  const [selectedBankoItem, setSelectedBankoItem] = useState<BankoItem | null>(null);
  const [showBankoEkleModal, setShowBankoEkleModal] = useState(false);
  const [showKurLookup, setShowKurLookup] = useState<
    "hasAlis" | "hasSatis" | "usdAlis" | "usdSatis" | "eur" | "maliyet" | "satis" | "monturIscilik" | "tasPara" | null
  >(null);
  const [selectedTasIdForKur, setSelectedTasIdForKur] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showFotoModal, setShowFotoModal] = useState(false);

  // Yeni Grup Ekleme Form State (Özel Ürün: tip = 1)
  const [yeniGrupKodu, setYeniGrupKodu] = useState("");
  const [yeniGrupAciklama, setYeniGrupAciklama] = useState("");
  const [yeniGrupBaslangicNo, setYeniGrupBaslangicNo] = useState<number | string>(0);

  // Yeni Banko Ekleme Form State
  const [yeniBankoKodu, setYeniBankoKodu] = useState("");
  const [yeniBankoAdi, setYeniBankoAdi] = useState("");
  const [yeniBankoAciklama, setYeniBankoAciklama] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const grupKoduRef = useRef<HTMLInputElement | null>(null);

  // Sağ Tık (Context Menu) State
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    tasId?: string;
    tasIndex?: number;
  } | null>(null);

  useEffect(() => {
    const handleOutsideClick = () => {
      if (contextMenu?.visible) setContextMenu(null);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && contextMenu?.visible) setContextMenu(null);
    };
    window.addEventListener("click", handleOutsideClick);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("click", handleOutsideClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenu]);

  useEffect(() => {
    grupKoduRef.current?.focus();
  }, []);

  const extractApiErrorMessage = (err: any, defaultMsg: string): string => {
    if (!err) return defaultMsg;
    if (typeof err === "string") return err;
    const respMsg = err.response?.data?.message || err.response?.data?.error || err.response?.data?.hata;
    if (respMsg && typeof respMsg === "string" && respMsg.trim()) {
      return respMsg.trim();
    }
    if (err.message && typeof err.message === "string" && err.message.trim()) {
      const msg = err.message.trim();
      if (msg.startsWith("Error: ")) return msg.replace(/^Error:\s*/, "");
      return msg;
    }
    return defaultMsg;
  };

  const showNotif = (type: "success" | "danger" | "warning", msg: string) => {
    setNotification({ type, message: msg });
    setTimeout(() => setNotification(null), type === "danger" ? 7000 : 4000);
  };

  const cleanInputStr = (val: string): string => {
    let cleaned = val.replace(/[^0-9.,]/g, "");
    let seenSep = false;
    let result = "";
    for (let i = 0; i < cleaned.length; i++) {
      const ch = cleaned[i];
      if (ch === "." || ch === ",") {
        if (!seenSep) {
          result += ch;
          seenSep = true;
        }
      } else {
        result += ch;
      }
    }
    return result;
  };

  const parseNum = (val: number | string | undefined | null): number => {
    if (val === undefined || val === null || val === "") return 0;
    const normalized = String(val).replace(/,/g, ".");
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? 0 : parsed;
  };

  const format5 = (num: number | string | undefined | null): string => {
    if (num === undefined || num === null || num === "") return "";
    const parsed = typeof num === "number" ? num : parseNum(num);
    if (isNaN(parsed) || parsed <= 0) return "";
    return parsed.toFixed(5);
  };

  const formatNumber = (num: number, maxDecimals: number = 2): string => {
    if (num === undefined || num === null || isNaN(num) || num <= 0) return "";
    return Number(num.toFixed(maxDecimals)).toString();
  };

  const getMilyemFromAyar = useCallback((ayarStr: string): number => {
    if (!ayarStr || !ayarStr.trim()) return 0;
    const raw = ayarStr.toUpperCase().trim();
    const normalized = raw
      .replace(/İ/g, "I")
      .replace(/Ş/g, "S")
      .replace(/Ğ/g, "G")
      .replace(/Ü/g, "U")
      .replace(/Ö/g, "O")
      .replace(/Ç/g, "C");

    // 1. ÖNCELİK 1: Altın Ayar & Milyem Tanımları (TODVZ_AYAR - ayarList)
    if (ayarList && ayarList.length > 0) {
      // 1.a: Tam Kod / Ad Eşleşmesi
      const foundInDb = ayarList.find((a) => {
        const aKod = (a.ayarKodu || "").toUpperCase().trim();
        const aAdi = (a.ayarAdi || "").toUpperCase().trim();
        const aKodNorm = aKod
          .replace(/İ/g, "I")
          .replace(/Ş/g, "S")
          .replace(/Ğ/g, "G")
          .replace(/Ü/g, "U")
          .replace(/Ö/g, "O")
          .replace(/Ç/g, "C");
        const aAdiNorm = aAdi
          .replace(/İ/g, "I")
          .replace(/Ş/g, "S")
          .replace(/Ğ/g, "G")
          .replace(/Ü/g, "U")
          .replace(/Ö/g, "O")
          .replace(/Ç/g, "C");

        return (
          aKod === raw ||
          aAdi === raw ||
          aKodNorm === normalized ||
          aAdiNorm === normalized ||
          `${aKod} AYAR` === raw ||
          `${aKodNorm} AYAR` === normalized ||
          `${a.standartAyar} AYAR` === raw ||
          `${a.standartAyar}` === raw
        );
      });

      if (foundInDb && foundInDb.milyem !== undefined && foundInDb.milyem !== null) {
        const m = Number(foundInDb.milyem);
        if (m > 0) {
          return m <= 1 ? m * 1000 : m;
        }
      }

      // 1.b: Sayısal Standart Ayar Eşleşmesi (Örn: "22", "14", "18", "24", "8")
      const parsedNum = parseFloat(normalized.replace(/,/g, "."));
      if (!isNaN(parsedNum) && parsedNum > 0) {
        const matchByStandart = ayarList.find((a) => Number(a.standartAyar) === parsedNum);
        if (matchByStandart && matchByStandart.milyem !== undefined && matchByStandart.milyem !== null) {
          const m = Number(matchByStandart.milyem);
          if (m > 0) {
            return m <= 1 ? m * 1000 : m;
          }
        }
      }
    }

    // 2. ÖNCELİK 2: FANTAZİ & Statik Harita
    if (normalized.includes("FANTAZI") || raw.includes("FANTAZİ")) {
      return 956;
    }
    if (AYAR_MILYEM_MAP[raw] || AYAR_MILYEM_MAP[normalized]) {
      return AYAR_MILYEM_MAP[raw] || AYAR_MILYEM_MAP[normalized];
    }

    // 3. ÖNCELİK 3: Sayısal Ayrıştırma
    const parsed = parseFloat(normalized.replace(/,/g, "."));
    if (!isNaN(parsed) && parsed > 0) {
      if (parsed <= 24) {
        if (parsed === 24) return 1000;
        if (parsed === 22) return 916;
        if (parsed === 18) return 750;
        if (parsed === 14) return 585;
        if (parsed === 8) return 333;
        return (parsed / 24) * 1000;
      } else if (parsed > 100 && parsed <= 1000) {
        return parsed;
      }
    }
    return 0;
  }, [ayarList]);

  const kurRef = {
    hasAlis: parseNum(hasAlis),
    hasSatis: parseNum(hasSatis),
    usdAlis: parseNum(usdAlis),
    usdSatis: parseNum(usdSatis),
    usd: parseNum(usdSatis) > 0 ? parseNum(usdSatis) : parseNum(usdAlis),
    eur: parseNum(eurKuru),
  };

  const getKurVal = useCallback(
    (code: string, ref: { hasAlis: number; hasSatis: number; usdAlis: number; usdSatis: number; usd: number; eur: number }): number => {
      const c = (code || "").toUpperCase().trim();
      if (c === "HAS" || c === "ALTIN") return ref.hasSatis > 0 ? ref.hasSatis : (ref.hasAlis > 0 ? ref.hasAlis : 1);
      if (c === "USD" || c === "$") return ref.usdSatis > 0 ? ref.usdSatis : (ref.usdAlis > 0 ? ref.usdAlis : (ref.usd > 0 ? ref.usd : 1));
      if (c === "EUR" || c === "€") return ref.eur > 0 ? ref.eur : 1;
      if (c === "TL" || c === "TRY" || c === "₺") return 1;

      // Kurlar tablosunda ara
      const row = kurRows.find((k) => (k.kod || "").toUpperCase() === c);
      if (row) {
        const rate = row.efektifSatis || row.efektifAlis || row.dovizSatis || row.dovizAlis;
        if (rate && rate > 0) return rate;
      }
      return 1;
    },
    [kurRows]
  );

  // 1 Gram Has Altının USD Cinsinden Değerini (Parite / Altın Kuru) Hesaplar
  const getHasGramUsdRate = useCallback(
    (ref: { hasAlis: number; hasSatis: number; usdAlis: number; usdSatis: number; usd: number; eur: number }): number => {
      const hasRate = ref.hasSatis > 0 ? ref.hasSatis : (ref.hasAlis > 0 ? ref.hasAlis : 0);
      const usdRate = ref.usdSatis > 0 ? ref.usdSatis : (ref.usdAlis > 0 ? ref.usdAlis : (ref.usd > 0 ? ref.usd : 1));
      if (hasRate <= 0) return 0;
      const validUsd = usdRate > 0 ? usdRate : 1;

      // Durum 1: Ekrana 3.50 veya 3.45 gibi binlik katsayı (3,500 TL/gr HAS) girildiyse
      if (hasRate < 10) {
        return (hasRate * 1000) / validUsd;
      }
      // Durum 2: Ekrana 3500 TL gibi tam TL/gr HAS girildiyse
      if (hasRate >= 500) {
        return hasRate / validUsd;
      }
      // Durum 3: Ekrana doğrudan gram altın USD fiyatı (örn: 75 - 150 USD/gr) girildiyse
      if (hasRate >= 40 && hasRate < 500 && validUsd > 10) {
        return hasRate;
      }
      return hasRate / validUsd;
    },
    []
  );

  // Verilen tutarı ve para birimini USD'ye çevirir
  const convertToUSD = useCallback(
    (
      amount: number,
      fromCode: string,
      ref: { hasAlis: number; hasSatis: number; usdAlis: number; usdSatis: number; usd: number; eur: number }
    ): number => {
      if (!amount || amount <= 0) return 0;
      const f = (fromCode || "").toUpperCase().trim();
      if (f === "USD" || f === "$") return amount;
      if (f === "HAS" || f === "ALTIN") {
        const hasUsd = getHasGramUsdRate(ref);
        return amount * hasUsd;
      }
      const usdRate = ref.usdSatis > 0 ? ref.usdSatis : (ref.usdAlis > 0 ? ref.usdAlis : (ref.usd > 0 ? ref.usd : 1));
      if (f === "TL" || f === "TRY" || f === "₺") {
        return usdRate > 0 ? amount / usdRate : amount;
      }
      if (f === "EUR" || f === "€") {
        const eurRate = ref.eur > 0 ? ref.eur : 1;
        return usdRate > 0 ? (amount * eurRate) / usdRate : amount;
      }
      const row = kurRows.find((k) => (k.kod || "").toUpperCase() === f);
      if (row) {
        const rateTl = row.efektifSatis || row.efektifAlis || row.dovizSatis || row.dovizAlis || 1;
        return usdRate > 0 ? (amount * rateTl) / usdRate : amount;
      }
      return amount;
    },
    [getHasGramUsdRate, kurRows]
  );

  // Verilen USD tutarını hedef para birimine çevirir
  const convertFromUSD = useCallback(
    (
      amountUsd: number,
      toCode: string,
      ref: { hasAlis: number; hasSatis: number; usdAlis: number; usdSatis: number; usd: number; eur: number }
    ): number => {
      if (!amountUsd || amountUsd <= 0) return 0;
      const t = (toCode || "").toUpperCase().trim();
      if (t === "USD" || t === "$") return amountUsd;
      if (t === "HAS" || t === "ALTIN") {
        const hasUsd = getHasGramUsdRate(ref);
        return hasUsd > 0 ? amountUsd / hasUsd : amountUsd;
      }
      const usdRate = ref.usdSatis > 0 ? ref.usdSatis : (ref.usdAlis > 0 ? ref.usdAlis : (ref.usd > 0 ? ref.usd : 1));
      if (t === "TL" || t === "TRY" || t === "₺") {
        return amountUsd * usdRate;
      }
      if (t === "EUR" || t === "€") {
        const eurRate = ref.eur > 0 ? ref.eur : 1;
        return eurRate > 0 ? (amountUsd * usdRate) / eurRate : amountUsd;
      }
      const row = kurRows.find((k) => (k.kod || "").toUpperCase() === t);
      if (row) {
        const rateTl = row.efektifSatis || row.efektifAlis || row.dovizSatis || row.dovizAlis || 1;
        return rateTl > 0 ? (amountUsd * usdRate) / rateTl : amountUsd;
      }
      return amountUsd;
    },
    [getHasGramUsdRate, kurRows]
  );

  const convertCurrency = useCallback(
    (
      amount: number,
      fromCode: string,
      toCode: string,
      ref: { hasAlis: number; hasSatis: number; usdAlis: number; usdSatis: number; usd: number; eur: number }
    ): number => {
      if (!amount || amount <= 0) return 0;
      const f = (fromCode || "").toUpperCase().trim();
      const t = (toCode || "").toUpperCase().trim();
      if (f === t) return amount;
      const inUsd = convertToUSD(amount, f, ref);
      return convertFromUSD(inUsd, t, ref);
    },
    [convertToUSD, convertFromUSD]
  );

  // ─── Birleşik Hesaplama Motoru (Montür + Taşlar = Toplam Maliyet & Satış) ────
  const recalculateAll = useCallback(
    (
      curMonturGram: number | string,
      curAyar: string,
      curMonturIscilik: number | string,
      curMonturIscilikBirim: string,
      curMonturIscilikPara: string,
      curTaslar: TasSatiri[],
      curMaliyetPara: string,
      curSatisPara: string,
      curSatisKarYuzde: number | string,
      curKurRef: { hasAlis: number; hasSatis: number; usdAlis: number; usdSatis: number; usd: number; eur: number }
    ) => {
      const mGram = parseNum(curMonturGram);
      const milyem = getMilyemFromAyar(curAyar);

      // 1. Montür Has Miktarı: Montür Gr * Ayar Milyemi (5 hane: 0.00000 Has)
      const calcMonturHasNum = mGram > 0 && milyem > 0 ? mGram * (milyem / 1000) : 0;
      setMonturHas(calcMonturHasNum > 0 ? format5(calcMonturHasNum) : "");

      // 2. 1 Gram Has Altının USD Değeri ve Montür Altın Tutarı (USD)
      const hasGramUsd = getHasGramUsdRate(curKurRef);
      const monturAltinUSD = calcMonturHasNum * hasGramUsd;

      // 3. Montür İşçilik Tutarı (USD):
      //    Birim '/ Gram' ise: Montür Gr * Montür İşçilik
      //    Birim '/ Adet' ise: Doğrudan girilen işçilik değeri
      const mIscilik = parseNum(curMonturIscilik);
      const rawMonturIscilikTutari =
        mIscilik > 0
          ? curMonturIscilikBirim === "Gram"
            ? mIscilik * mGram
            : mIscilik
          : 0;
      setMonturIscilikTutari(rawMonturIscilikTutari > 0 ? formatNumber(rawMonturIscilikTutari, 2) : "");

      const monturIscilikUSD = convertToUSD(rawMonturIscilikTutari, curMonturIscilikPara || "USD", curKurRef);

      // 4. Toplam Montür Maliyeti (USD / Hedef Para Cinsinden): Montür Altın Bedeli + Montür İşçilik Bedeli
      const toplamMonturUSD = monturAltinUSD + monturIscilikUSD;
      const targetMonturMaliyet = convertFromUSD(toplamMonturUSD, curMaliyetPara || "USD", curKurRef);
      setMonturMaliyet(targetMonturMaliyet > 0 ? formatNumber(targetMonturMaliyet, 2) : "");

      // 5. Çoklu Taşlar Toplam Maliyeti (Hedef Maliyet Para Birimi Cinsinden)
      let toplamTasUSD = 0;
      curTaslar.forEach((t) => {
        const tTutar = parseNum(t.tutar);
        if (tTutar > 0) {
          toplamTasUSD += convertToUSD(tTutar, t.paraKodu || "USD", curKurRef);
        }
      });
      const targetTaslarMaliyet = convertFromUSD(toplamTasUSD, curMaliyetPara || "USD", curKurRef);

      // 6. Toplam Maliyet (USD / Hedef Para): Toplam Montür Maliyeti + Taşlar Tutarı (Kilitli / Read-only)
      const calcToplamMaliyet = targetMonturMaliyet + targetTaslarMaliyet;
      const formattedMaliyet = calcToplamMaliyet > 0 ? formatNumber(calcToplamMaliyet, 2) : "";
      setMaliyet(formattedMaliyet);

      // 7. Satış Fiyatı = Toplam Maliyet * (1 + (Satış Kârı % / 100)) (Kilitli / Otomatik)
      const karY =
        typeof curSatisKarYuzde === "number" || (typeof curSatisKarYuzde === "string" && curSatisKarYuzde !== "")
          ? parseNum(curSatisKarYuzde)
          : 100;

      if (calcToplamMaliyet > 0) {
        const calcSatisInMaliyetPara = calcToplamMaliyet * (1 + karY / 100);
        const calcSatisInTarget = convertCurrency(calcSatisInMaliyetPara, curMaliyetPara || "USD", curSatisPara || "USD", curKurRef);
        setSatisFiyati(formatNumber(calcSatisInTarget, 2));
      } else {
        setSatisFiyati("");
      }
    },
    [getMilyemFromAyar, getHasGramUsdRate, convertToUSD, convertFromUSD, convertCurrency]
  );

  // ─── Montür Alanları Değişimleri ───────────────────────────────────────────
  const handleMonturGramChange = (val: string) => {
    setMonturGram(val);
    recalculateAll(val, ayar, monturIscilik, monturIscilikBirim, monturIscilikParaKodu, taslar, maliyetParaKodu, satisParaKodu, satisKariYuzde, kurRef);
  };

  const handleAyarChange = (newAyar: string) => {
    setAyar(newAyar);
    recalculateAll(monturGram, newAyar, monturIscilik, monturIscilikBirim, monturIscilikParaKodu, taslar, maliyetParaKodu, satisParaKodu, satisKariYuzde, kurRef);
  };

  const handleMonturIscilikChange = (val: string) => {
    setMonturIscilik(val);
    recalculateAll(monturGram, ayar, val, monturIscilikBirim, monturIscilikParaKodu, taslar, maliyetParaKodu, satisParaKodu, satisKariYuzde, kurRef);
  };

  const handleMonturIscilikBirimChange = (val: string) => {
    setMonturIscilikBirim(val);
    recalculateAll(monturGram, ayar, monturIscilik, val, monturIscilikParaKodu, taslar, maliyetParaKodu, satisParaKodu, satisKariYuzde, kurRef);
  };

  // ─── Çoklu Taşlar Grid İşlemleri ───────────────────────────────────────────
  const handleTasEkle = () => {
    const newTas: TasSatiri = {
      id: `tas_${Date.now()}`,
      tasCinsi: "",
      adet: "",
      miktar: "",
      birim: "Ct",
      renk: "",
      saflik: "",
      kesim: "",
      birimFiyat: "",
      tutar: "",
      paraKodu: "USD",
    };
    const nextTaslar = [...taslar, newTas];
    setTaslar(nextTaslar);
    recalculateAll(monturGram, ayar, monturIscilik, monturIscilikBirim, monturIscilikParaKodu, nextTaslar, maliyetParaKodu, satisParaKodu, satisKariYuzde, kurRef);
  };

  const handleTasSil = (id: string) => {
    if (taslar.length <= 1) {
      showNotif("warning", "En az bir taş satırı bulunmalıdır.");
      return;
    }
    const nextTaslar = taslar.filter((t) => t.id !== id);
    setTaslar(nextTaslar);
    recalculateAll(monturGram, ayar, monturIscilik, monturIscilikBirim, monturIscilikParaKodu, nextTaslar, maliyetParaKodu, satisParaKodu, satisKariYuzde, kurRef);
  };

  const handleTasGuncelle = (id: string, field: keyof TasSatiri, val: any) => {
    const nextTaslar = taslar.map((t) => {
      if (t.id !== id) return t;
      const updated = { ...t, [field]: val };
      if (field === "miktar" || field === "birimFiyat") {
        const m = field === "miktar" ? parseNum(val) : parseNum(t.miktar);
        const bf = field === "birimFiyat" ? parseNum(val) : parseNum(t.birimFiyat);
        if (m > 0 && bf > 0) {
          updated.tutar = formatNumber(m * bf, 2);
        }
      }
      return updated;
    });
    setTaslar(nextTaslar);
    recalculateAll(monturGram, ayar, monturIscilik, monturIscilikBirim, monturIscilikParaKodu, nextTaslar, maliyetParaKodu, satisParaKodu, satisKariYuzde, kurRef);
  };

  // ─── Taş Grid Klavye Yön Okları & Enter Navigasyonu ────────────────────────
  const focusCell = (r: number, c: number) => {
    const el = document.querySelector<HTMLElement>(`[data-grid-row="${r}"][data-grid-col="${c}"]`);
    if (el) {
      el.focus();
      if (el instanceof HTMLInputElement && el.type === "text") {
        el.select();
      }
    }
  };

  const handleCellKeyDown = (
    e: React.KeyboardEvent<any>,
    rowIndex: number,
    colIndex: number
  ) => {
    const target = e.currentTarget as HTMLInputElement;

    if (e.key === "ArrowUp") {
      if (rowIndex > 0) {
        e.preventDefault();
        focusCell(rowIndex - 1, colIndex);
      }
    } else if (e.key === "ArrowDown") {
      if (rowIndex < taslar.length - 1) {
        e.preventDefault();
        focusCell(rowIndex + 1, colIndex);
      }
    } else if (e.key === "ArrowLeft") {
      const isAtStart = target.selectionStart === 0 && target.selectionEnd === 0;
      if (isAtStart && colIndex > 0) {
        e.preventDefault();
        focusCell(rowIndex, colIndex - 1);
      }
    } else if (e.key === "ArrowRight") {
      const isAtEnd = target.selectionStart === (target.value?.length || 0);
      if (isAtEnd && colIndex < TOTAL_GRID_COLS - 1) {
        e.preventDefault();
        focusCell(rowIndex, colIndex + 1);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (colIndex < TOTAL_GRID_COLS - 1) {
        focusCell(rowIndex, colIndex + 1);
      } else if (rowIndex < taslar.length - 1) {
        focusCell(rowIndex + 1, 0);
      } else {
        handleTasEkle();
        setTimeout(() => {
          focusCell(rowIndex + 1, 0);
        }, 50);
      }
    }
  };

  // ─── Taşlar Toplam Özet Değerleri ──────────────────────────────────────────
  const toplamTasAdedi = taslar.reduce((acc, t) => acc + (parseNum(t.adet) || 0), 0);
  const toplamTasKarat = taslar.reduce((acc, t) => acc + (parseNum(t.miktar) || 0), 0);
  const toplamTasTutariUSD = taslar.reduce((acc, t) => {
    const tutar = parseNum(t.tutar);
    return acc + convertCurrency(tutar, t.paraKodu || "USD", "USD", kurRef);
  }, 0);

  // ─── Fiyat ve Kâr Manuel Değişimleri ───────────────────────────────────────
  const handleMaliyetChange = (val: string) => {
    setMaliyet(val);
    const mNum = parseNum(val);
    const yNum = parseNum(satisKariYuzde) || 100;
    if (mNum > 0) {
      setSatisFiyati(formatNumber(mNum * (1 + yNum / 100), 2));
    }
  };

  const handleSatisFiyatiChange = (val: string) => {
    setSatisFiyati(val);
    const sNum = parseNum(val);
    const mNum = parseNum(maliyet);
    if (mNum > 0 && sNum > 0) {
      const sNumInMaliyetPara =
        satisParaKodu !== maliyetParaKodu
          ? convertCurrency(sNum, satisParaKodu || "USD", maliyetParaKodu || "USD", kurRef)
          : sNum;
      const yuzde = Number((((sNumInMaliyetPara - mNum) / mNum) * 100).toFixed(2));
      setSatisKariYuzde(yuzde);
    }
  };

  const handleKarYuzdeChange = (val: string) => {
    setSatisKariYuzde(val);
    recalculateAll(
      monturGram,
      ayar,
      monturIscilik,
      monturIscilikBirim,
      monturIscilikParaKodu,
      taslar,
      maliyetParaKodu,
      satisParaKodu,
      val,
      kurRef
    );
  };

  const handleHasAlisChange = (val: string) => {
    setHasAlis(val);
    const updatedRef = { ...kurRef, hasAlis: parseNum(val) };
    recalculateAll(monturGram, ayar, monturIscilik, monturIscilikBirim, monturIscilikParaKodu, taslar, maliyetParaKodu, satisParaKodu, satisKariYuzde, updatedRef);
  };

  const handleHasSatisChange = (val: string) => {
    setHasSatis(val);
    const updatedRef = { ...kurRef, hasSatis: parseNum(val) };
    recalculateAll(monturGram, ayar, monturIscilik, monturIscilikBirim, monturIscilikParaKodu, taslar, maliyetParaKodu, satisParaKodu, satisKariYuzde, updatedRef);
  };

  const handleUsdAlisChange = (val: string) => {
    setUsdAlis(val);
    const updatedRef = { ...kurRef, usdAlis: parseNum(val) };
    recalculateAll(monturGram, ayar, monturIscilik, monturIscilikBirim, monturIscilikParaKodu, taslar, maliyetParaKodu, satisParaKodu, satisKariYuzde, updatedRef);
  };

  const handleUsdSatisChange = (val: string) => {
    setUsdSatis(val);
    const updatedRef = { ...kurRef, usdSatis: parseNum(val), usd: parseNum(val) };
    recalculateAll(monturGram, ayar, monturIscilik, monturIscilikBirim, monturIscilikParaKodu, taslar, maliyetParaKodu, satisParaKodu, satisKariYuzde, updatedRef);
  };

  // ─── Fotoğraf Yükleme ve Kamera Yönetimi ────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    const readPromises = fileList.map((file) => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
          const base64 = event.target?.result as string;
          if (!base64) {
            resolve("");
            return;
          }
          try {
            await EtiketService.uploadFoto({
              base64,
              dosyaAdi: file.name,
              tip: 1, // 1 = Özel Ürün
              islemId: ozelUrunId || undefined,
            });
          } catch (err: any) {
            console.error("Fotoğraf yükleme hatası:", err);
          }
          resolve(base64);
        };
        reader.readAsDataURL(file);
      });
    });

    const newUrls = (await Promise.all(readPromises)).filter(Boolean);
    if (newUrls.length > 0) {
      setResimler((prev) => {
        const combined = [...prev, ...newUrls];
        setResim(combined[combined.length - 1]);
        setSeciliResimIndex(combined.length - 1);
        return combined;
      });
      showNotif("success", `${newUrls.length} adet fotoğraf başarıyla eklendi.`);
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const handleDeleteSelectedPhoto = () => {
    if (resimler.length === 0) {
      setResim(null);
      return;
    }
    const nextList = resimler.filter((_, idx) => idx !== seciliResimIndex);
    setResimler(nextList);
    if (nextList.length > 0) {
      const nextIdx = Math.max(0, seciliResimIndex - 1);
      setSeciliResimIndex(nextIdx);
      setResim(nextList[nextIdx]);
    } else {
      setSeciliResimIndex(0);
      setResim(null);
    }
  };

  const startCamera = async () => {
    setCameraError(null);
    setShowCameraModal(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      setCameraError("Kamera erişimi sağlanamadı veya izin verilmedi. Lütfen tarayıcı kamera izinlerini kontrol ediniz.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setShowCameraModal(false);
    setCameraError(null);
  };

  const capturePhoto = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64 = canvas.toDataURL("image/jpeg", 0.85);

    stopCamera();

    try {
      await EtiketService.uploadFoto({
        base64,
        dosyaAdi: `kamera_ozel_${Date.now()}.jpg`,
        tip: 1,
        islemId: ozelUrunId || undefined,
      });
    } catch (e) {
      console.error("Fotoğraf yükleme hatası:", e);
    }

    setResimler((prev) => {
      const combined = [...prev, base64];
      setResim(base64);
      setSeciliResimIndex(combined.length - 1);
      return combined;
    });
    showNotif("success", "Fotoğraf kameradan başarıyla çekildi ve eklendi.");
  };

  // ─── Veri Yükleme ────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    try {
      const [urunler, gruplar, ureticiler, cariler, sabl, kurlar, bankolar, ayarlar, yazicilar] = await Promise.all([
        EtiketService.getOzelUrunler({ limit: 500 }),
        EtiketService.getGruplar(1).catch(() => []),
        EtiketService.getUreticiFirmalar().catch(() => []),
        CariService.getCariKartlar().catch(() => []),
        EtiketService.getSablonlar(1).catch(() => []),
        KurService.getKurTablosu({ tur: 0 }).then((t) => t?.satirlar || []).catch(() => []),
        EtiketService.getBankolar().catch(() => []),
        AyarService.getAyarlar(false).catch(() => []),
        PrinterService.getYazicilar().catch(() => []),
      ]);

      setOzelList(urunler);
      setGrupList(gruplar);
      setBankoList(bankolar);
      setUreticiList(ureticiler);
      setCariList(cariler);
      setSablonlar(sabl);
      setKurRows(kurlar);
      setAyarList(ayarlar);
      setYaziciList(yazicilar);

      if (kurlar.length > 0) {
        const hasKur = kurlar.find((k) => (k.kod || "").toUpperCase() === "HAS");
        if (hasKur) {
          const hAlis = (hasKur.efektifAlis !== undefined && hasKur.efektifAlis !== null && Number(hasKur.efektifAlis) > 0) ? hasKur.efektifAlis : hasKur.dovizAlis;
          const hSatis = (hasKur.efektifSatis !== undefined && hasKur.efektifSatis !== null && Number(hasKur.efektifSatis) > 0) ? hasKur.efektifSatis : hasKur.dovizSatis;
          if (hAlis !== undefined && hAlis !== null) setHasAlis(hAlis);
          if (hSatis !== undefined && hSatis !== null) setHasSatis(hSatis);
        }

        const usdKur = kurlar.find((k) => (k.kod || "").toUpperCase() === "USD");
        if (usdKur) {
          const uAlis = (usdKur.efektifAlis !== undefined && usdKur.efektifAlis !== null && Number(usdKur.efektifAlis) > 0) ? usdKur.efektifAlis : usdKur.dovizAlis;
          const uSatis = (usdKur.efektifSatis !== undefined && usdKur.efektifSatis !== null && Number(usdKur.efektifSatis) > 0) ? usdKur.efektifSatis : (usdKur.efektifAlis || usdKur.dovizSatis || usdKur.dovizAlis);
          if (uAlis !== undefined && uAlis !== null) setUsdAlis(uAlis);
          if (uSatis !== undefined && uSatis !== null) setUsdSatis(uSatis);
        }

        const eurKur = kurlar.find((k) => (k.kod || "").toUpperCase() === "EUR");
        if (eurKur) {
          const eSatis = (eurKur.efektifSatis !== undefined && eurKur.efektifSatis !== null && Number(eurKur.efektifSatis) > 0) ? eurKur.efektifSatis : (eurKur.efektifAlis || eurKur.dovizSatis || eurKur.dovizAlis);
          if (eSatis) setEurKuru(eSatis);
        }
      }
    } catch (err: any) {
      const errorMsg = extractApiErrorMessage(err, "Özel ürün ve etiket tanımlama verileri yüklenirken bir hata oluştu.");
      showNotif("danger", errorMsg);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (isDuzeltmeMode && ozelList.length > 0 && !ozelUrunId) {
      const queryParams = new URLSearchParams(location.search);
      const queryId = queryParams.get("id");
      if (queryId) {
        const match = ozelList.find((u) => u.ozelUrunId === parseInt(queryId, 10));
        if (match) handleSelectRecord(match);
        else handleSelectRecord(ozelList[ozelList.length - 1]);
      } else {
        handleSelectRecord(ozelList[ozelList.length - 1]);
      }
    } else if (!isDuzeltmeMode && ozelUrunId) {
      handleNew();
    }
    const timer = setTimeout(() => {
      grupKoduRef.current?.focus();
    }, 150);
    return () => clearTimeout(timer);
  }, [isDuzeltmeMode, ozelList, location.pathname, location.search]);

  // ─── F1 Klavye Kısayolu ────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F1") {
        e.preventDefault();
        handleSave();
      } else if (isDuzeltmeMode && e.key === "F2") {
        e.preventDefault();
        if (ozelUrunId) setShowDeleteConfirm(true);
        else showNotif("warning", "Silinecek kayıt bulunmamaktadır.");
      } else if (isDuzeltmeMode && (e.key === "F3" || e.key === "F4")) {
        e.preventDefault();
        setShowLookup(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [ozelUrunId, grupKodu, urunNo, mamulTipi, ayar, monturGram, taslar, maliyet, satisFiyati, isDuzeltmeMode]);

  // ─── Grup Seçimi & Sıradaki Numarayı Alma (3 Haneli) ─────────────────────────
  const handleGrupSec = async (secilenKod: string) => {
    const kod = (secilenKod || "").trim().toUpperCase();
    if (!kod) return;
    setGrupKodu(kod);

    let calculatedNextNo = 1;
    if (ozelList && ozelList.length > 0) {
      const matchItems = ozelList.filter(
        (x) => (x.grupKodu || "").trim().toUpperCase() === kod
      );
      if (matchItems.length > 0) {
        const maxNo = Math.max(...matchItems.map((x) => Number(x.urunNo) || 0));
        if (maxNo > 0) {
          calculatedNextNo = maxNo + 1;
        }
      }
    }

    try {
      const nextInfo = await EtiketService.getNextOzelUrunNo(kod, 3);
      const sonNoNum = Math.max(Number(nextInfo.sonNo) || 1, calculatedNextNo);
      const paddedNo = format3Digits(sonNoNum);
      setUrunNo(paddedNo);
      setBarkod(`${kod}${paddedNo}`);
    } catch {
      const paddedNo = format3Digits(calculatedNextNo);
      setUrunNo(paddedNo);
      setBarkod(`${kod}${paddedNo}`);
    }
  };

  // ─── Yeni Kayıt Modu (Temizle - Ayar boş gelir) ─────────────────────────────
  const handleNew = () => {
    setOzelUrunId(null);
    setTarih(new Date().toISOString().slice(0, 10));
    setGrupKodu("");
    setUrunNo("");
    setBarkod("");
    setMamulTipi("");
    setAyar("");
    setUreticiFirma("");
    setOrjinalKod("");
    setModel("");
    setBanko("Banko 1");
    setMonturGram("");
    setMonturHas("");
    setMonturIscilik("");
    setMonturIscilikBirim("Gram");
    setMonturIscilikParaKodu("USD");
    setMonturIscilikTutari("");
    setMonturMaliyet("");

    setTaslar([
      {
        id: "tas_1",
        tasCinsi: "",
        adet: "",
        miktar: "",
        birim: "Ct",
        renk: "",
        saflik: "",
        kesim: "",
        birimFiyat: "",
        tutar: "",
        paraKodu: "USD",
      },
    ]);

    setMaliyet("");
    setMaliyetParaKodu("USD");
    setSatisFiyati("");
    setSatisParaKodu("USD");
    setSatisKariYuzde(100);
    setResim(null);
    setResimler([]);
    setSeciliResimIndex(0);
  };

  // ─── Kayıt Seçme ─────────────────────────────────────────────────────────────
  const handleSelectRecord = (it: OzelUrunItem) => {
    setOzelUrunId(it.ozelUrunId);
    setTarih(it.tarih ? it.tarih.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setGrupKodu(it.grupKodu);
    const paddedNo = format3Digits(it.urunNo);
    setUrunNo(paddedNo);
    setBarkod(it.barkod || `${it.grupKodu}${paddedNo}`);
    setMamulTipi(it.mamulTipi || "");
    setAyar(it.ayar || "");
    setUreticiFirma(it.ureticiFirma || "");
    setOrjinalKod(it.orjinalKod || "");
    setModel(it.modelOzellik1 || "");
    setBanko(it.banko || "Banko 1");

    let loadedTaslar: TasSatiri[] = [];
    if (it.modelOzellik2) {
      try {
        const extra = JSON.parse(it.modelOzellik2);
        if (extra.monturGram !== undefined) setMonturGram(extra.monturGram);
        if (extra.monturHas !== undefined) setMonturHas(extra.monturHas);
        if (extra.monturIscilik !== undefined) setMonturIscilik(extra.monturIscilik);
        if (extra.monturIscilikBirim !== undefined) setMonturIscilikBirim(extra.monturIscilikBirim);
        if (extra.monturIscilikParaKodu !== undefined) setMonturIscilikParaKodu(extra.monturIscilikParaKodu);
        if (extra.monturMaliyet !== undefined) setMonturMaliyet(extra.monturMaliyet);
        if (Array.isArray(extra.taslar) && extra.taslar.length > 0) {
          loadedTaslar = extra.taslar;
        }
      } catch {
        // Fallback
      }
    }

    if (loadedTaslar.length === 0) {
      setMonturGram(it.miktar || "");
      loadedTaslar = [
        {
          id: "tas_1",
          tasCinsi: it.tasCinsi || "",
          adet: it.tasAdet ?? "",
          miktar: it.tasMiktar ?? "",
          birim: it.tasBirim || "Ct",
          renk: it.tasRenk || "",
          saflik: it.tasSaflik || "",
          kesim: "",
          birimFiyat: "",
          tutar: it.tasTutar ?? "",
          paraKodu: it.tasTutarBirimi || "USD",
        },
      ];
    }
    setTaslar(loadedTaslar);

    setMaliyet(it.maliyet !== undefined && it.maliyet !== null ? it.maliyet : "");
    setMaliyetParaKodu(it.maliyetParaKodu || "USD");
    setSatisFiyati(it.satisFiyati !== undefined && it.satisFiyati !== null ? it.satisFiyati : "");
    setSatisParaKodu(it.satisParaKodu || "USD");
    setSatisKariYuzde(it.karYuzdesi !== undefined && it.karYuzdesi !== null ? it.karYuzdesi : 100);

    const loadedImages = (it.resimler && it.resimler.length > 0) ? it.resimler : (it.resim ? [it.resim] : []);
    setResimler(loadedImages);
    setResim(loadedImages.length > 0 ? loadedImages[0] : null);
    setSeciliResimIndex(0);
    setShowLookup(false);
  };

  // ─── Kaydet / Güncelle (F1) ──────────────────────────────────────────────────
  const handleSave = async () => {
    if (!grupKodu.trim()) {
      showNotif("warning", "Lütfen Grup Kodu seçiniz.");
      return;
    }
    if (!urunNo || Number(urunNo) <= 0) {
      showNotif("warning", "Lütfen geçerli bir Ürün No giriniz.");
      return;
    }
    if (!ayar.trim()) {
      showNotif("warning", "Lütfen Montür Ayarını seçiniz.");
      return;
    }
    if (parseNum(monturGram) <= 0) {
      showNotif("warning", "Lütfen Montür Gramajını (0'dan büyük) giriniz.");
      return;
    }

    setIsSaving(true);
    try {
      const finalUrunNo = Number(urunNo) || 1;
      const paddedUrunNo = format3Digits(finalUrunNo);
      const finalBarkod = barkod.trim() || `${grupKodu.trim().toUpperCase()}${paddedUrunNo}`;

      const extraMetadata = JSON.stringify({
        monturGram: monturGram || "",
        monturHas: monturHas || "",
        monturIscilik: monturIscilik || "",
        monturIscilikBirim: monturIscilikBirim || "Gram",
        monturIscilikParaKodu: monturIscilikParaKodu || "USD",
        monturMaliyet: monturMaliyet || "",
        taslar,
      });

      const primaryTas = taslar[0] || {
        tasCinsi: "",
        miktar: "",
        birim: "Ct",
        renk: "",
        saflik: "",
        kesim: "",
        adet: "",
        birimFiyat: "",
        tutar: "",
        paraKodu: "USD",
      };

      const payload: SaveOzelUrunPayload = {
        ozelUrunId: ozelUrunId || undefined,
        tarih,
        grupKodu: grupKodu.trim().toUpperCase(),
        urunNo: finalUrunNo,
        barkod: finalBarkod,
        mamulTipi: mamulTipi.trim() || null,
        ureticiFirma: ureticiFirma.trim() || null,
        orjinalKod: orjinalKod.trim() || null,
        ayar: ayar.trim() || null,
        modelOzellik1: model.trim() || null,
        modelOzellik2: extraMetadata,
        banko: banko.trim() || null,
        miktar: parseNum(monturGram) || 1,
        miktarBirimi: monturGram ? "Gram" : "Adet",
        tasCinsi: taslar.length > 1 ? `${primaryTas.tasCinsi || "Taş"} (+${taslar.length - 1} Taş)` : primaryTas.tasCinsi || null,
        tasMiktar: toplamTasKarat > 0 ? toplamTasKarat : (parseNum(primaryTas.miktar) || null),
        tasBirim: primaryTas.birim || "Ct",
        tasRenk: primaryTas.renk || null,
        tasSaflik: primaryTas.saflik || null,
        tasAdet: toplamTasAdedi > 0 ? toplamTasAdedi : 1,
        tasTutar: parseNum(primaryTas.tutar) || null,
        tasTutarBirimi: primaryTas.paraKodu || "USD",
        maliyet: parseNum(maliyet),
        maliyetParaKodu: maliyetParaKodu || "USD",
        karYuzdesi: parseNum(satisKariYuzde),
        sabitle: false,
        satisFiyati: parseNum(satisFiyati),
        satisParaKodu: satisParaKodu || "USD",
        hizliGiris: false,
        resim: resimler.length > 0 ? resimler[seciliResimIndex] || resimler[0] : (resim || null),
        resimler: resimler.length > 0 ? resimler : (resim ? [resim] : []),
        satildi: false,
      };

      const saved = await EtiketService.saveOzelUrun(payload);
      setOzelUrunId(saved.ozelUrunId);
      setUrunNo(format3Digits(saved.urunNo));
      setBarkod(saved.barkod || `${saved.grupKodu}${format3Digits(saved.urunNo)}`);
      showNotif("success", `Özel Ürün [${saved.grupKodu}-${format3Digits(saved.urunNo)}] başarıyla kaydedildi.`);

      const updated = await EtiketService.getOzelUrunler({ limit: 500 });
      setOzelList(updated);
      return saved;
    } catch (err: any) {
      const errorMsg = extractApiErrorMessage(err, "Özel ürün kaydedilirken bir hata oluştu.");
      showNotif("danger", errorMsg);
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Kaydet ve Yazdır ───────────────────────────────────────────────────────
  const handleSaveAndPrint = async () => {
    const saved = await handleSave();
    if (saved) {
      setShowPrintModal(true);
    }
  };

  // ─── Sil (F2) ────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!ozelUrunId) return;
    setIsSaving(true);
    try {
      await EtiketService.deleteOzelUrun(ozelUrunId);
      showNotif("success", "Özel ürün kaydı başarıyla silindi.");
      setShowDeleteConfirm(false);
      handleNew();
      const updated = await EtiketService.getOzelUrunler({ limit: 500 });
      setOzelList(updated);
    } catch (err: any) {
      const errorMsg = extractApiErrorMessage(err, "Özel ürün silinirken bir hata oluştu.");
      showNotif("danger", errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Yeni Grup Kaydetme Modalı ──────────────────────────────────────────────
  const handleSaveYeniGrup = async () => {
    if (!yeniGrupKodu.trim()) {
      showNotif("warning", "Grup Kodu zorunludur.");
      return;
    }
    try {
      const saved = await EtiketService.saveGrup({
        tip: 1,
        grupKodu: yeniGrupKodu.trim().toUpperCase(),
        aciklama: yeniGrupAciklama.trim() || undefined,
        baslangicNo: Number(yeniGrupBaslangicNo) || 0,
      });
      showNotif("success", `Yeni Grup [${saved.grupKodu}] başarıyla oluşturuldu.`);
      setShowGrupEkleModal(false);
      setYeniGrupKodu("");
      setYeniGrupAciklama("");
      setYeniGrupBaslangicNo(0);

      const updatedGruplar = await EtiketService.getGruplar(1);
      setGrupList(updatedGruplar);
      handleGrupSec(saved.grupKodu);
    } catch (err: any) {
      showNotif("danger", err?.message || "Grup kaydedilirken hata oluştu.");
    }
  };

  // ─── Yeni Banko Kaydetme Modalı ─────────────────────────────────────────────
  const handleSaveYeniBanko = async () => {
    if (!yeniBankoAdi.trim()) {
      showNotif("warning", "Banko Adı zorunludur.");
      return;
    }
    try {
      const saved = await EtiketService.saveBanko({
        bankoKodu: yeniBankoKodu.trim().toUpperCase() || undefined,
        bankoAdi: yeniBankoAdi.trim(),
        aciklama: yeniBankoAciklama.trim() || undefined,
      });
      showNotif("success", `Yeni Banko [${saved.bankoAdi}] başarıyla oluşturuldu.`);
      setShowBankoEkleModal(false);
      setYeniBankoKodu("");
      setYeniBankoAdi("");
      setYeniBankoAciklama("");

      const updatedBankolar = await EtiketService.getBankolar();
      setBankoList(updatedBankolar);
      setBanko(saved.bankoAdi);
    } catch (err: any) {
      const errorMsg = extractApiErrorMessage(err, "Banko eklenirken bir hata oluştu.");
      showNotif("danger", errorMsg);
    }
  };

  // ─── Kayıt Gezinme ──────────────────────────────────────────────────────────
  const currentIndex = ozelList.findIndex((u) => u.ozelUrunId === ozelUrunId);
  const handleNavigate = (dir: "first" | "prev" | "next" | "last") => {
    if (ozelList.length === 0) return;
    let targetIdx = 0;
    if (dir === "first") targetIdx = 0;
    else if (dir === "prev") targetIdx = Math.max(0, currentIndex - 1);
    else if (dir === "next") targetIdx = Math.min(ozelList.length - 1, currentIndex + 1);
    else if (dir === "last") targetIdx = ozelList.length - 1;
    handleSelectRecord(ozelList[targetIdx]);
  };

  // ─── Tablo Sütunları ─────────────────────────────────────────────────────────
  const lookupColumns: LookupColumn<OzelUrunItem>[] = [
    { header: "Grup-No", width: "90px", render: (it) => <span className="fw-bold text-primary">{it.grupKodu}-{format3Digits(it.urunNo)}</span> },
    { header: "Barkod", width: "110px", render: (it) => <span className="font-monospace">{it.barkod || "-"}</span> },
    { header: "Mamul Tipi", width: "100px", render: (it) => it.mamulTipi || "-" },
    { header: "Ayar", width: "80px", render: (it) => it.ayar ? `${it.ayar} Ayar` : "-" },
    { header: "Taş Cinsi", width: "120px", render: (it) => it.tasCinsi || "-" },
    { header: "Karat (Ct)", width: "80px", render: (it) => it.tasMiktar || "-" },
    { header: "Satış Fiyatı", width: "110px", render: (it) => `${it.satisFiyati} ${it.satisParaKodu}` },
    { header: "Üretici Firma", render: (it) => it.ureticiFirma || "-" },
  ];

  const printItems: EtiketYazdirItem[] = [
    {
      id: ozelUrunId || 0,
      barkod: barkod || (grupKodu && urunNo ? `${grupKodu}${format3Digits(urunNo)}` : ""),
      fields: {
        grupUrunNo: `${grupKodu}-${format3Digits(urunNo)}`,
        mamulTipi: mamulTipi || "-",
        ayar: ayar ? `${ayar} Ayar` : "-",
        has: monturHas ? `${monturHas} Has` : "-",
        gram: monturGram ? `${monturGram} Gr` : "-",
        tas: `${taslar[0]?.tasCinsi || ""} ${toplamTasKarat ? toplamTasKarat + " Ct" : ""}`.trim() || "-",
        fiyat: `${satisFiyati} ${satisParaKodu}`,
        maliyet: `${maliyet} ${maliyetParaKodu}`,
      },
    },
  ];

  const varsayilanSablon = sablonlar.find((s) => s.varsayilan) || sablonlar[0] || null;

  return (
    <div className="ozel-urun-tanimlama-page w-100 pb-3" style={{ overflowX: "hidden" }}>
      {/* ─── Gizli Dosya & Kamera Seçicileri ─── */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: "none" }}
        accept="image/*"
        multiple
        onChange={handleFileChange}
      />
      <input
        type="file"
        ref={cameraInputRef}
        style={{ display: "none" }}
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
      />

      {/* ─── Datalist: Mamul Tipleri (Seçilebilir ve Yazılabilir) ─── */}
      <datalist id="mamulTipiListesi">
        <option value="Yüzük" />
        <option value="Tektaş Pırlanta" />
        <option value="Beştaş Pırlanta" />
        <option value="Tamtur Pırlanta" />
        <option value="Kolye" />
        <option value="Küpe" />
        <option value="Bileklik" />
        <option value="Bilezik" />
        <option value="Broş" />
        <option value="Gerdanlık" />
        <option value="Set / Takım" />
        <option value="Diğer" />
      </datalist>

      {/* ─── Datalist: Taş Cinsleri (Seçilebilir ve Yazılabilir) ─── */}
      <datalist id="tasCinsiListesi">
        {PREDEFINED_TAS_CINSLERI.map((tc) => (
          <option key={tc} value={tc} />
        ))}
      </datalist>

      {/* ─── Datalist: Kesim Tipleri ─── */}
      <datalist id="kesimListesi">
        {PREDEFINED_KESIMLER.map((k) => (
          <option key={k} value={k} />
        ))}
      </datalist>

      {/* ─── Datalist: Renk Listesi ─── */}
      <datalist id="renkListesi">
        {PREDEFINED_RENKLER.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>

      {/* ─── Datalist: Saflık Listesi ─── */}
      <datalist id="saflikListesi">
        {PREDEFINED_SAFLIKLAR.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      {/* ─── Datalist: Ayarlar (Seçilebilir ve Yazılabilir) ─── */}
      <datalist id="ayarListesi">
        <option value="14" />
        <option value="18" />
        <option value="22" />
        <option value="24" />
        <option value="8" />
        <option value="585" />
        <option value="750" />
        <option value="916" />
        <option value="995" />
        <option value="925 Gümüş" />
        <option value="950 Platin" />
      </datalist>

      {/* ─── ERP Toolbar ─── */}
      <ERPToolbar
        pageTitle={isDuzeltmeMode ? "E- Özel Ürün Düzeltme" : "D- Özel Ürün Barkodlama"}
        pageIcon={<IconDiamond size={20} />}
        onNew={handleNew}
        onSave={handleSave}
        onDelete={isDuzeltmeMode ? () => setShowDeleteConfirm(true) : undefined}
        onSearch={isDuzeltmeMode ? () => setShowLookup(true) : undefined}
        onFirst={isDuzeltmeMode ? () => handleNavigate("first") : undefined}
        onPrev={isDuzeltmeMode ? () => handleNavigate("prev") : undefined}
        onNext={isDuzeltmeMode ? () => handleNavigate("next") : undefined}
        onLast={isDuzeltmeMode ? () => handleNavigate("last") : undefined}
        hideDelete={!isDuzeltmeMode}
        hideSearch={!isDuzeltmeMode}
        hideNavigation={!isDuzeltmeMode}
        onRefresh={loadAll}
        onPrint={() => (ozelUrunId ? setShowPrintModal(true) : showNotif("warning", "Önce bir ürün seçiniz."))}
        disabled={isSaving}
        modeText={ozelUrunId ? `Kayıt: ${grupKodu}-${format3Digits(urunNo)} (${currentIndex + 1}/${ozelList.length})` : (isDuzeltmeMode ? "Düzeltme Modu" : "Yeni Kayıt Modu")}
      />

      {/* ─── Sayfa Ortası Toast Bildirim ─── */}
      {notification && (
        <div className="erp-toast-container">
          <Alert
            variant={notification.type}
            dismissible
            onClose={() => setNotification(null)}
            className="erp-toast-item d-flex align-items-center mb-0 shadow py-2 px-3 border-0"
          >
            {notification.type === "success" ? (
              <IconCheck size={18} className="me-2 text-success flex-shrink-0" />
            ) : (
              <IconAlertTriangle size={18} className="me-2 text-danger flex-shrink-0" />
            )}
            <span style={{ fontSize: "13px" }}>{notification.message}</span>
          </Alert>
        </div>
      )}

      {/* ─── Ana Form Kartı ─── */}
      <Card className="shadow-sm border-0 mb-3 bg-white">
        <Card.Body className="p-3">
          {/* ─── ÜST ŞERİT: Tarih, Grup/No, Barkod Kodu ─── */}
          <div className="bg-light p-2.5 rounded-3 border mb-3">
            <Row className="g-2 align-items-center">
              {/* Tarih */}
              <Col xs={12} sm={6} md={3} lg={3}>
                <div className="d-flex align-items-center gap-1.5">
                  <Form.Label className="small fw-bold text-secondary mb-0 text-nowrap">
                    Tarih :
                  </Form.Label>
                  <Form.Control
                    type="date"
                    size="sm"
                    value={tarih}
                    onChange={(e) => setTarih(e.target.value)}
                    className="font-monospace bg-white"
                  />
                </div>
              </Col>

              {/* Grup / No */}
              <Col xs={12} sm={12} md={5} lg={5}>
                <div className="d-flex align-items-center gap-1.5">
                  <Form.Label className="small fw-bold text-secondary mb-0 text-nowrap">
                    Grup / No<span className="text-danger">*</span> :
                  </Form.Label>
                  <InputGroup size="sm">
                    <Form.Control
                      ref={grupKoduRef}
                      type="text"
                      value={grupKodu}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        setGrupKodu(val);
                      }}
                      onBlur={() => {
                        if (grupKodu) handleGrupSec(grupKodu);
                      }}
                      style={{ maxWidth: "85px" }}
                      className="fw-bold text-primary font-monospace bg-white text-center"
                    />
                    <Form.Control
                      type="text"
                      value={urunNo}
                      onChange={(e) => {
                        const val = e.target.value;
                        setUrunNo(val);
                        if (grupKodu && val) {
                          const numVal = parseInt(val, 10);
                          if (!isNaN(numVal)) {
                            setBarkod(`${grupKodu}${format3Digits(numVal)}`);
                          } else {
                            setBarkod(`${grupKodu}${val}`);
                          }
                        }
                      }}
                      onBlur={() => {
                        if (urunNo !== "") {
                          const padded = format3Digits(urunNo);
                          setUrunNo(padded);
                          if (grupKodu) {
                            setBarkod(`${grupKodu}${padded}`);
                          }
                        }
                      }}
                      style={{ maxWidth: "65px" }}
                      className="text-center font-monospace bg-white fw-bold"
                    />
                    <Button
                      variant="outline-primary"
                      onClick={() => {
                        setSelectedGrupItem(null);
                        setShowGrupLookup(true);
                      }}
                      title="Kayıtlı Gruplardan Seç (Dürbün)"
                      className="px-2"
                    >
                      <IconBinoculars size={16} />
                    </Button>
                  </InputGroup>
                </div>
              </Col>

              {/* Barkod Kodu */}
              <Col xs={12} sm={6} md={4} lg={4}>
                <div className="d-flex align-items-center gap-1.5">
                  <Form.Label className="small fw-bold text-secondary mb-0 text-nowrap">
                    Barkod Kodu :
                  </Form.Label>
                  <Form.Control
                    type="text"
                    size="sm"
                    value={barkod || (grupKodu && urunNo ? `${grupKodu}${format3Digits(urunNo)}` : "")}
                    onChange={(e) => setBarkod(e.target.value)}
                    className="font-monospace fw-bold text-dark bg-white"
                    style={{ maxWidth: "160px" }}
                  />
                </div>
              </Col>
            </Row>
          </div>

          {/* ─── ORTA BÖLÜM: SOL (Ürün Kimliği) + SAĞ (Montür & Birleşik Fiyatlandırma) ─── */}
          <Row className="g-3 mb-3">
            {/* ─── SOL BLOK: Ürün Kimliği ─── */}
            <Col xs={12} lg={6}>
              <div className="border rounded-3 p-3 bg-white h-100 d-flex flex-column justify-content-between">
                <div>
                  <div className="fw-bold text-primary border-bottom pb-1.5 mb-2.5 d-flex align-items-center gap-1.5">
                    <IconDiamond size={18} />
                    <span>Ürün Kimliği</span>
                  </div>

                  {/* Mamul Tipi (Kullanıcı Kendi Girer / Datalist) */}
                  <div className="d-flex align-items-center mb-2 gap-1.5">
                    <div className="small fw-bold text-secondary text-nowrap flex-shrink-0" style={{ width: "95px" }}>
                      Mamul Tipi :
                    </div>
                    <div style={{ maxWidth: "200px" }}>
                      <Form.Control
                        type="text"
                        size="sm"
                        list="mamulTipiListesi"
                        value={mamulTipi}
                        onChange={(e) => setMamulTipi(e.target.value)}
                        className="fw-bold bg-white"
                      />
                    </div>
                  </div>

                  {/* Üretici Firma */}
                  <div className="d-flex align-items-center mb-2 gap-1.5">
                    <div className="small fw-bold text-secondary text-nowrap flex-shrink-0" style={{ width: "95px" }}>
                      Üretici Firma :
                    </div>
                    <div style={{ maxWidth: "200px" }}>
                      <InputGroup size="sm">
                        <Form.Control
                          type="text"
                          value={ureticiFirma}
                          onChange={(e) => setUreticiFirma(e.target.value)}
                          className="fw-semibold bg-white"
                        />
                        <Button
                          variant="outline-secondary"
                          className="px-2"
                          onClick={() => setShowFirmaLookup(true)}
                          title="Kayıtlı Firmalardan Seç (Dürbün)"
                        >
                          <IconBinoculars size={15} />
                        </Button>
                      </InputGroup>
                    </div>
                  </div>

                  {/* Orjinal Kod & Model (Yan Yana) */}
                  <Row className="g-2 mb-2">
                    <Col xs={12} sm={6}>
                      <div className="d-flex align-items-center gap-1.5">
                        <div className="small fw-bold text-secondary text-nowrap flex-shrink-0" style={{ width: "95px" }}>
                          Orjinal Kod :
                        </div>
                        <Form.Control
                          type="text"
                          size="sm"
                          value={orjinalKod}
                          onChange={(e) => setOrjinalKod(e.target.value)}
                          className="font-monospace bg-white text-end"
                          style={{ maxWidth: "150px" }}
                        />
                      </div>
                    </Col>
                    <Col xs={12} sm={6}>
                      <div className="d-flex align-items-center gap-1.5">
                        <div className="small fw-bold text-secondary text-nowrap flex-shrink-0" style={{ width: "50px" }}>
                          Model :
                        </div>
                        <Form.Control
                          type="text"
                          size="sm"
                          value={model}
                          onChange={(e) => setModel(e.target.value)}
                          className="bg-white"
                          style={{ maxWidth: "160px" }}
                        />
                      </div>
                    </Col>
                  </Row>

                  {/* Banko */}
                  <div className="d-flex align-items-center gap-1.5">
                    <div className="small fw-bold text-secondary text-nowrap flex-shrink-0" style={{ width: "95px" }}>
                      Banko :
                    </div>
                    <div style={{ maxWidth: "200px" }}>
                      <InputGroup size="sm">
                        <Form.Control
                          type="text"
                          list="ozelBankoListesi"
                          value={banko}
                          onChange={(e) => setBanko(e.target.value)}
                          className="fw-semibold bg-white"
                        />
                        <datalist id="ozelBankoListesi">
                          {bankoList.map((b) => (
                            <option key={b.bankoId} value={b.bankoAdi}>
                              {b.bankoKodu} - {b.bankoAdi}
                            </option>
                          ))}
                        </datalist>
                        <Button
                          variant="outline-success"
                          onClick={() => setShowBankoEkleModal(true)}
                          title="Yeni Banko Tanımla / Ekle"
                          className="d-flex align-items-center px-2"
                        >
                          <IconPlus size={14} />
                        </Button>
                        <Button
                          variant="outline-secondary"
                          className="px-2"
                          onClick={() => {
                            setSelectedBankoItem(null);
                            setShowBankoLookup(true);
                          }}
                          title="Kayıtlı Bankolardan Seç (Dürbün)"
                        >
                          <IconBinoculars size={15} />
                        </Button>
                      </InputGroup>
                    </div>
                  </div>
                </div>
              </div>
            </Col>

            {/* ─── SAĞ BLOK: Montür Maliyeti + Birleşik Fiyatlandırma ─── */}
            <Col xs={12} lg={6}>
              <div className="border rounded-3 p-3 bg-white h-100 d-flex flex-column justify-content-between gap-2.5">
                {/* Montür (Gövde Altın / Metal) Hesap Alanı */}
                <div>
                  <div className="fw-bold text-primary border-bottom pb-1.5 mb-2 d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center gap-1.5">
                      <IconScale size={18} />
                      <span>Montür Maliyeti</span>
                    </div>
                    {monturHas && parseNum(monturHas) > 0 ? (
                      <Badge bg="primary" className="font-monospace px-2 py-1">
                        {monturHas} HAS
                      </Badge>
                    ) : null}
                  </div>

                  {/* Montür Gramajı & Ayar (Kullanıcı Kendi Yazar / Seçer, başlangıçta boş) */}
                  <div className="d-flex align-items-center mb-2 gap-1.5">
                    <div className="small fw-bold text-secondary text-nowrap flex-shrink-0" style={{ width: "115px" }}>
                      Montür Gr / Ayar :
                    </div>
                    <div className="flex-grow-1 d-flex align-items-center gap-1.5" style={{ maxWidth: "270px" }}>
                      <Form.Control
                        type="text"
                        inputMode="decimal"
                        size="sm"
                        value={monturGram ?? ""}
                        onChange={(e) => handleMonturGramChange(cleanInputStr(e.target.value))}
                        className="fw-bold font-monospace text-end bg-white"
                        style={{ maxWidth: "105px" }}
                        placeholder="0.00"
                      />
                      <InputGroup size="sm" style={{ maxWidth: "160px" }}>
                        <Form.Control
                          type="text"
                          list="ayarListesi"
                          value={ayar}
                          onChange={(e) => handleAyarChange(e.target.value)}
                          className="bg-white fw-bold font-monospace text-end"
                          placeholder="Ayar seçin / yazın"
                        />
                        <Button
                          variant="outline-secondary"
                          onClick={() => setShowAyarModal(true)}
                          title="Ayar Tanımları & Seçim (Dürbün)"
                        >
                          <IconBinoculars size={15} />
                        </Button>
                      </InputGroup>
                    </div>
                  </div>

                  {/* Montür İşçilik & Dürbünlü Para Tablosu Seçimi */}
                  <div className="d-flex align-items-center mb-2 gap-1.5">
                    <div className="small fw-bold text-secondary text-nowrap flex-shrink-0" style={{ width: "115px" }}>
                      Montür İşçilik :
                    </div>
                    <div className="flex-grow-1 d-flex align-items-center gap-1.5">
                      <Form.Control
                        type="text"
                        inputMode="decimal"
                        size="sm"
                        value={monturIscilik ?? ""}
                        onChange={(e) => handleMonturIscilikChange(cleanInputStr(e.target.value))}
                        className="font-monospace text-end bg-white"
                        style={{ maxWidth: "110px" }}
                      />
                      <Form.Select
                        size="sm"
                        value={monturIscilikBirim}
                        onChange={(e) => handleMonturIscilikBirimChange(e.target.value)}
                        className="bg-white fw-semibold"
                        style={{ maxWidth: "90px" }}
                      >
                        <option value="Gram">/ Gram</option>
                        <option value="Adet">/ Adet</option>
                      </Form.Select>
                      <InputGroup size="sm" style={{ width: "120px" }}>
                        <Form.Control
                          type="text"
                          readOnly
                          value={monturIscilikParaKodu}
                          className="font-monospace bg-light fw-bold text-center px-1"
                        />
                        <Button
                          variant="outline-secondary"
                          className="px-2"
                          onClick={() => setShowKurLookup("monturIscilik")}
                          title="Para Tablosundan Seç (Dürbün)"
                        >
                          <IconBinoculars size={14} />
                        </Button>
                      </InputGroup>
                    </div>
                  </div>
                </div>

                {/* Birleşik Maliyet, Satış & Kâr Motoru (Dürbün İkonu ile Para Tablosundan Seçim) */}
                <div className="pt-2 border-top">
                  <div className="fw-bold text-primary border-bottom pb-1 mb-2 d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center gap-1.5">
                      <IconCoin size={17} />
                      <span>Maliyet / Satış Fiyatlandırması</span>
                    </div>
                    {monturMaliyet && parseNum(monturMaliyet) > 0 ? (
                      <span className="small text-muted font-monospace" style={{ fontSize: "11px" }}>
                        Montür: <strong className="text-dark">{monturMaliyet} {maliyetParaKodu}</strong>
                      </span>
                    ) : null}
                  </div>

                  {/* Toplam Maliyet */}
                  <div className="d-flex align-items-center mb-2 gap-1.5">
                    <div className="small fw-bold text-secondary text-nowrap flex-shrink-0" style={{ width: "115px" }}>
                      Toplam Maliyet :
                    </div>
                    <div style={{ maxWidth: "220px" }}>
                      <InputGroup size="sm">
                        <Form.Control
                          type="text"
                          readOnly
                          value={maliyet ?? ""}
                          className="fw-bold font-monospace text-end bg-light"
                          title="Toplam Montür Maliyeti + Taşlar Tutarı (Kilitli)"
                        />
                        <Form.Control
                          type="text"
                          readOnly
                          value={maliyetParaKodu}
                          className="bg-light font-monospace fw-bold text-center px-1"
                          style={{ maxWidth: "55px" }}
                        />
                        <Button
                          variant="outline-secondary"
                          className="px-2"
                          onClick={() => setShowKurLookup("maliyet")}
                          title="Para Tablosundan Seç (Dürbün)"
                        >
                          <IconBinoculars size={14} />
                        </Button>
                      </InputGroup>
                    </div>
                  </div>

                  {/* Satış Kârı % */}
                  <div className="d-flex align-items-center mb-2 gap-1.5">
                    <div className="small fw-bold text-secondary text-nowrap flex-shrink-0" style={{ width: "115px" }}>
                      Satış Kârı % :
                    </div>
                    <div style={{ maxWidth: "140px" }}>
                      <InputGroup size="sm">
                        <Form.Control
                          type="text"
                          inputMode="decimal"
                          value={satisKariYuzde ?? ""}
                          onChange={(e) => handleKarYuzdeChange(cleanInputStr(e.target.value))}
                          className="font-monospace text-end fw-bold text-success bg-white"
                        />
                        <InputGroup.Text className="bg-light fw-bold px-2">%</InputGroup.Text>
                      </InputGroup>
                    </div>
                  </div>

                  {/* Satış Fiyatı */}
                  <div className="d-flex align-items-center mb-1 gap-1.5">
                    <div className="small fw-bold text-secondary text-nowrap flex-shrink-0" style={{ width: "115px" }}>
                      Satış Fiyatı :
                    </div>
                    <div style={{ maxWidth: "220px" }}>
                      <InputGroup size="sm">
                        <Form.Control
                          type="text"
                          inputMode="decimal"
                          value={satisFiyati ?? ""}
                          onChange={(e) => handleSatisFiyatiChange(cleanInputStr(e.target.value))}
                          className="fw-bold font-monospace text-primary text-end bg-white fs-6"
                        />
                        <Form.Control
                          type="text"
                          readOnly
                          value={satisParaKodu}
                          className="bg-light font-monospace fw-bold text-primary text-center px-1"
                          style={{ maxWidth: "55px" }}
                        />
                        <Button
                          variant="outline-secondary"
                          className="px-2"
                          onClick={() => setShowKurLookup("satis")}
                          title="Para Tablosundan Seç (Dürbün)"
                        >
                          <IconBinoculars size={14} />
                        </Button>
                      </InputGroup>
                    </div>
                  </div>
                </div>
              </div>
            </Col>
          </Row>

          {/* ─── TAM GENİŞLİK ÇOKLU TAŞ TABLOSU (MULTI-STONE GRID - SAĞ TIK + YÖN OKLARI İLE YÖNETİM) ─── */}
          <div
            className="border rounded-3 p-3 bg-white mb-3 shadow-sm position-relative"
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu({
                visible: true,
                x: e.clientX,
                y: e.clientY,
              });
            }}
          >
            {/* Tablo Üst Başlık & İstatistik Rozetleri */}
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 border-bottom pb-2 mb-2.5">
              <div className="d-flex align-items-center gap-2">
                <div className="fw-bold text-primary d-flex align-items-center gap-1.5 fs-6">
                  <IconSparkles size={19} />
                  <span>Çoklu Taş Tablosu</span>
                </div>
                <span className="badge bg-light text-secondary border fw-normal" style={{ fontSize: "11px" }}>
                  🖱️ Sağ tık: Taş Ekle/Sil | ⌨️ Yön okları ile gezin
                </span>
              </div>

              {/* Canlı İstatistik Rozetleri */}
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <Badge bg="light" text="dark" className="border px-2.5 py-1.5 font-monospace fw-semibold" style={{ fontSize: "12px" }}>
                  <span className="text-muted fw-normal">Taş: </span>
                  <strong>{toplamTasAdedi} Adet</strong>
                </Badge>
                <Badge bg="light" text="primary" className="border px-2.5 py-1.5 font-monospace fw-semibold" style={{ fontSize: "12px" }}>
                  <span className="text-muted fw-normal">Toplam Karat: </span>
                  <strong>{formatNumber(toplamTasKarat, 2)} Ct</strong>
                </Badge>
                <Badge bg="success" className="px-2.5 py-1.5 font-monospace fs-6 shadow-sm">
                  <span className="fw-normal opacity-75">Taşlar Tutarı: </span>
                  <strong>{formatNumber(toplamTasTutariUSD, 2)} USD</strong>
                </Badge>
              </div>
            </div>

            {/* Taş Grid Tablosu (Tam Genişlik, Yatay Kaydırmasız) */}
            <div className="w-100 border rounded bg-white overflow-hidden">
              <Table size="sm" hover className="mb-0 align-middle w-100" style={{ fontSize: "12px", tableLayout: "fixed" }}>
                <thead className="table-light">
                  <tr className="text-secondary small border-bottom">
                    <th style={{ width: "35px" }} className="text-center">#</th>
                    <th style={{ width: "17%" }}>Taş Cinsi</th>
                    <th style={{ width: "65px" }} className="text-end">Adet</th>
                    <th style={{ width: "90px" }} className="text-end">Karat (Ct)</th>
                    <th style={{ width: "70px" }} className="text-center">Renk</th>
                    <th style={{ width: "80px" }} className="text-center">Saflık</th>
                    <th style={{ width: "15%" }}>Kesim</th>
                    <th style={{ width: "100px" }} className="text-end">Birim Fyt</th>
                    <th style={{ width: "110px" }} className="text-end">Tutar</th>
                    <th style={{ width: "95px" }} className="text-center">Döviz</th>
                  </tr>
                </thead>
                <tbody>
                  {taslar.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center py-4 text-muted">
                        <IconSparkles size={24} className="opacity-50 mb-1 d-block mx-auto text-secondary" />
                        Henüz taş eklenmedi. Tabloya sağ tıklayıp <strong>"Yeni Taş Ekle"</strong> seçeneğini kullanabilirsiniz.
                      </td>
                    </tr>
                  ) : (
                    taslar.map((t, idx) => (
                      <tr
                        key={t.id}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setContextMenu({
                            visible: true,
                            x: e.clientX,
                            y: e.clientY,
                            tasId: t.id,
                            tasIndex: idx,
                          });
                        }}
                        style={{ cursor: "context-menu" }}
                        title="Sağ tıklayarak bu satırı silebilir veya yeni taş ekleyebilirsiniz"
                      >
                        <td className="text-muted small fw-bold text-center">{idx + 1}</td>
                        {/* 0: Taş Cinsi */}
                        <td>
                          <Form.Control
                            type="text"
                            size="sm"
                            list="tasCinsiListesi"
                            value={t.tasCinsi}
                            onChange={(e) => handleTasGuncelle(t.id, "tasCinsi", e.target.value)}
                            onKeyDown={(e) => handleCellKeyDown(e, idx, 0)}
                            data-grid-row={idx}
                            data-grid-col={0}
                            className="bg-white fw-bold py-1 px-1.5"
                            style={{ fontSize: "12px" }}
                          />
                        </td>
                        {/* 1: Adet */}
                        <td>
                          <Form.Control
                            type="text"
                            inputMode="numeric"
                            size="sm"
                            value={t.adet}
                            onChange={(e) => handleTasGuncelle(t.id, "adet", cleanInputStr(e.target.value))}
                            onKeyDown={(e) => handleCellKeyDown(e, idx, 1)}
                            data-grid-row={idx}
                            data-grid-col={1}
                            className="text-end bg-white py-1 px-1 font-monospace"
                            style={{ fontSize: "12px" }}
                          />
                        </td>
                        {/* 2: Karat (Ct) */}
                        <td>
                          <Form.Control
                            type="text"
                            inputMode="decimal"
                            size="sm"
                            value={t.miktar}
                            onChange={(e) => handleTasGuncelle(t.id, "miktar", cleanInputStr(e.target.value))}
                            onKeyDown={(e) => handleCellKeyDown(e, idx, 2)}
                            data-grid-row={idx}
                            data-grid-col={2}
                            className="text-end bg-white py-1 px-1.5 font-monospace fw-bold text-primary"
                            style={{ fontSize: "12px" }}
                          />
                        </td>
                        {/* 3: Renk */}
                        <td>
                          <Form.Control
                            type="text"
                            size="sm"
                            list="renkListesi"
                            value={t.renk}
                            onChange={(e) => handleTasGuncelle(t.id, "renk", e.target.value.toUpperCase())}
                            onKeyDown={(e) => handleCellKeyDown(e, idx, 3)}
                            data-grid-row={idx}
                            data-grid-col={3}
                            className="text-center bg-white py-1 px-1 font-monospace fw-semibold"
                            style={{ fontSize: "11px" }}
                          />
                        </td>
                        {/* 4: Saflık */}
                        <td>
                          <Form.Control
                            type="text"
                            size="sm"
                            list="saflikListesi"
                            value={t.saflik}
                            onChange={(e) => handleTasGuncelle(t.id, "saflik", e.target.value.toUpperCase())}
                            onKeyDown={(e) => handleCellKeyDown(e, idx, 4)}
                            data-grid-row={idx}
                            data-grid-col={4}
                            className="text-center bg-white py-1 px-1 font-monospace fw-semibold"
                            style={{ fontSize: "11px" }}
                          />
                        </td>
                        {/* 5: Kesim */}
                        <td>
                          <Form.Control
                            type="text"
                            size="sm"
                            list="kesimListesi"
                            value={t.kesim}
                            onChange={(e) => handleTasGuncelle(t.id, "kesim", e.target.value)}
                            onKeyDown={(e) => handleCellKeyDown(e, idx, 5)}
                            data-grid-row={idx}
                            data-grid-col={5}
                            className="bg-white py-1 px-1.5"
                            style={{ fontSize: "11px" }}
                          />
                        </td>
                        {/* 6: Birim Fyt */}
                        <td>
                          <Form.Control
                            type="text"
                            inputMode="decimal"
                            size="sm"
                            value={t.birimFiyat}
                            onChange={(e) => handleTasGuncelle(t.id, "birimFiyat", cleanInputStr(e.target.value))}
                            onKeyDown={(e) => handleCellKeyDown(e, idx, 6)}
                            data-grid-row={idx}
                            data-grid-col={6}
                            className="text-end bg-white py-1 px-1.5 font-monospace"
                            style={{ fontSize: "12px" }}
                          />
                        </td>
                        {/* 7: Tutar */}
                        <td>
                          <Form.Control
                            type="text"
                            inputMode="decimal"
                            size="sm"
                            value={t.tutar}
                            onChange={(e) => handleTasGuncelle(t.id, "tutar", cleanInputStr(e.target.value))}
                            onKeyDown={(e) => handleCellKeyDown(e, idx, 7)}
                            data-grid-row={idx}
                            data-grid-col={7}
                            className="text-end bg-white py-1 px-1.5 font-monospace fw-bold text-success"
                            style={{ fontSize: "12px" }}
                          />
                        </td>
                        {/* 8: Döviz (Para Tablosundan Seçim Dürbünlü) */}
                        <td>
                          <InputGroup size="sm">
                            <Form.Control
                              type="text"
                              readOnly
                              value={t.paraKodu || "USD"}
                              onKeyDown={(e) => handleCellKeyDown(e, idx, 8)}
                              data-grid-row={idx}
                              data-grid-col={8}
                              className="bg-light font-monospace fw-bold text-center px-1"
                              style={{ fontSize: "11px" }}
                            />
                            <Button
                              variant="outline-secondary"
                              className="px-1"
                              onClick={() => {
                                setSelectedTasIdForKur(t.id);
                                setShowKurLookup("tasPara");
                              }}
                              title="Para Tablosundan Seç (Dürbün)"
                            >
                              <IconBinoculars size={13} />
                            </Button>
                          </InputGroup>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
            </div>

            {/* ─── Sağ Tık Context Menu Popup ─── */}
            {contextMenu?.visible && (
              <div
                className="position-fixed bg-white border rounded-3 shadow-lg py-1"
                style={{
                  top: `${contextMenu.y}px`,
                  left: `${contextMenu.x}px`,
                  zIndex: 9999,
                  minWidth: "185px",
                  fontSize: "13px",
                  boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  className="d-flex align-items-center gap-2 px-3 py-2 text-success fw-semibold"
                  style={{ cursor: "pointer" }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f0fdf4")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  onClick={() => {
                    handleTasEkle();
                    setContextMenu(null);
                  }}
                >
                  <IconPlus size={16} />
                  <span>Yeni Taş Ekle</span>
                </div>
                {contextMenu.tasId && (
                  <div
                    className="d-flex align-items-center gap-2 px-3 py-2 text-danger fw-semibold border-top"
                    style={{ cursor: "pointer" }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#fef2f2")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                    onClick={() => {
                      if (contextMenu.tasId) handleTasSil(contextMenu.tasId);
                      setContextMenu(null);
                    }}
                  >
                    <IconTrash size={16} />
                    <span>Seçili Taşı Sil {contextMenu.tasIndex !== undefined ? `(#${contextMenu.tasIndex + 1})` : ""}</span>
                  </div>
                )}
                {taslar.length > 0 && (
                  <div
                    className="d-flex align-items-center gap-2 px-3 py-2 text-secondary border-top"
                    style={{ cursor: "pointer" }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8fafc")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                    onClick={() => {
                      setTaslar([]);
                      recalculateAll(monturGram, ayar, monturIscilik, monturIscilikBirim, monturIscilikParaKodu, [], maliyetParaKodu, satisParaKodu, satisKariYuzde, kurRef);
                      setContextMenu(null);
                    }}
                  >
                    <IconX size={15} />
                    <span>Tüm Taşları Temizle</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ─── ALT BÖLÜM: Fotoğraf Yönetimi (Önizleme, Kamera, Yükle & Sil) ─── */}
          <div className="border rounded-3 p-3 bg-light mb-3">
            <div className="d-flex align-items-center gap-3">
              {/* Ana Fotoğraf Önizleme Kutusu */}
              <div
                className="rounded-3 border d-flex flex-column align-items-center justify-content-center bg-white position-relative overflow-hidden flex-shrink-0 group"
                style={{
                  width: "140px",
                  height: "110px",
                  boxShadow: "inset 0 1px 3px rgba(0,0,0,0.05)",
                  cursor: (resimler.length > 0 || resim) ? "zoom-in" : "default",
                }}
                onClick={() => {
                  if (resimler.length > 0 || resim) setShowFotoModal(true);
                }}
                title={(resimler.length > 0 || resim) ? "Büyütmek için tıklayın" : ""}
              >
                {resimler.length > 0 && resimler[seciliResimIndex] ? (
                  <img
                    src={resolveImageUrl(resimler[seciliResimIndex])}
                    alt={`Özel Ürün Fotoğrafı ${seciliResimIndex + 1}`}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      padding: "4px",
                    }}
                  />
                ) : resim ? (
                  <img
                    src={resolveImageUrl(resim)}
                    alt="Özel Ürün Fotoğrafı"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      padding: "4px",
                    }}
                  />
                ) : (
                  <div className="d-flex flex-column align-items-center text-muted p-2 text-center">
                    <IconCamera size={28} className="text-secondary opacity-50 mb-1" />
                    <span className="small fw-semibold text-secondary" style={{ fontSize: "11px" }}>Fotoğraf Yok</span>
                  </div>
                )}

                {/* Büyütme Butonu */}
                {(resimler.length > 0 || resim) && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowFotoModal(true);
                    }}
                    className="btn btn-sm btn-light border position-absolute end-0 top-0 m-1 rounded-circle d-flex align-items-center justify-content-center shadow-xs"
                    style={{ width: "24px", height: "24px", zIndex: 6, opacity: 0.85, padding: 0 }}
                    title="Fotoğrafı Büyüt"
                  >
                    <IconMaximize size={13} className="text-dark" />
                  </button>
                )}

                {resimler.length > 1 && (
                  <span
                    className="position-absolute bottom-0 end-0 bg-dark bg-opacity-75 text-white px-1.5 py-0.5 rounded-top-start small font-monospace"
                    style={{ fontSize: "10px" }}
                  >
                    {seciliResimIndex + 1}/{resimler.length}
                  </span>
                )}
              </div>

              {/* YÜKLE & SİL Eylem Butonları */}
              <div className="d-flex flex-column gap-2" style={{ width: "135px" }}>
                <Dropdown className="w-100">
                  <Dropdown.Toggle
                    variant="outline-success"
                    size="sm"
                    className="fw-bold w-100 d-flex align-items-center justify-content-center gap-1"
                    id="dropdown-ozel-foto-yukle"
                  >
                    <IconCamera size={15} />
                    <span>YÜKLE</span>
                  </Dropdown.Toggle>
                  <Dropdown.Menu className="shadow border-0 py-1" style={{ minWidth: "150px" }}>
                    <Dropdown.Item
                      onClick={startCamera}
                      className="d-flex align-items-center gap-2 small py-2"
                    >
                      <IconCamera size={16} className="text-success" />
                      <span className="fw-semibold">Kameradan Çek</span>
                    </Dropdown.Item>
                    <Dropdown.Item
                      onClick={() => fileInputRef.current?.click()}
                      className="d-flex align-items-center gap-2 small py-2"
                    >
                      <IconFolder size={16} className="text-primary" />
                      <span className="fw-semibold">Dosyadan Seç</span>
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>

                <Button
                  variant="outline-danger"
                  size="sm"
                  className="fw-bold"
                  onClick={handleDeleteSelectedPhoto}
                  disabled={resimler.length === 0 && !resim}
                  title="Seçili Fotoğrafı Kaldır"
                >
                  SİL
                </Button>
              </div>

              {/* Çoklu Fotoğraf Küçük Kareler Listesi (Thumbnails) */}
              {resimler.length > 1 && (
                <div className="d-flex align-items-center gap-1.5 overflow-auto py-1 flex-grow-1" style={{ maxWidth: "100%" }}>
                  {resimler.map((imgUrl, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        setSeciliResimIndex(idx);
                        setResim(imgUrl);
                      }}
                      className={`rounded border p-0.5 cursor-pointer ${idx === seciliResimIndex ? "border-primary border-2 shadow-sm" : "border-light opacity-75"
                        }`}
                      style={{
                        width: "36px",
                        height: "36px",
                        flexShrink: 0,
                        cursor: "pointer",
                        background: "#fff",
                      }}
                    >
                      <img
                        src={resolveImageUrl(imgUrl)}
                        alt={`thumb-${idx}`}
                        style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "2px" }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ─── ALT ÇUBUK: Kurlar + Eylem Butonları ─── */}
          <div className="pt-3 mt-3 border-top d-flex align-items-center justify-content-between flex-wrap gap-3">
            {/* Sol Kısım: HAS Alış, HAS Satış, USD Alış, USD Satış */}
            <div className="d-flex align-items-center gap-3 flex-wrap">
              {/* HAS Alış */}
              <div className="d-flex align-items-center gap-1.5 flex-shrink-0">
                <span className="small fw-bold text-secondary text-nowrap flex-shrink-0" style={{ minWidth: "65px" }}>
                  HAS Alış:
                </span>
                <InputGroup size="sm" style={{ width: "125px" }}>
                  <Form.Control
                    type="text"
                    value={hasAlis ?? ""}
                    onChange={(e) => handleHasAlisChange(cleanInputStr(e.target.value))}
                    className="font-monospace text-end bg-white fw-bold text-dark"
                  />
                  <Button
                    variant="outline-secondary"
                    className="px-1.5"
                    onClick={() => setShowKurLookup("hasAlis")}
                    title="Anlık Fiyat Listesinden Seç (HAS Alış)"
                  >
                    <IconBinoculars size={14} />
                  </Button>
                </InputGroup>
              </div>

              {/* HAS Satış */}
              <div className="d-flex align-items-center gap-1.5 flex-shrink-0">
                <span className="small fw-bold text-secondary text-nowrap flex-shrink-0" style={{ minWidth: "65px" }}>
                  HAS Satış:
                </span>
                <InputGroup size="sm" style={{ width: "125px" }}>
                  <Form.Control
                    type="text"
                    value={hasSatis ?? ""}
                    onChange={(e) => handleHasSatisChange(cleanInputStr(e.target.value))}
                    className="font-monospace text-end bg-white fw-bold text-dark"
                  />
                  <Button
                    variant="outline-secondary"
                    className="px-1.5"
                    onClick={() => setShowKurLookup("hasSatis")}
                    title="Anlık Fiyat Listesinden Seç (HAS Satış)"
                  >
                    <IconBinoculars size={14} />
                  </Button>
                </InputGroup>
              </div>

              {/* USD Alış */}
              <div className="d-flex align-items-center gap-1.5 flex-shrink-0">
                <span className="small fw-bold text-secondary text-nowrap flex-shrink-0" style={{ minWidth: "65px" }}>
                  USD Alış:
                </span>
                <InputGroup size="sm" style={{ width: "125px" }}>
                  <Form.Control
                    type="text"
                    value={usdAlis ?? ""}
                    onChange={(e) => handleUsdAlisChange(cleanInputStr(e.target.value))}
                    className="font-monospace text-end bg-white fw-bold text-dark"
                  />
                  <Button
                    variant="outline-secondary"
                    className="px-1.5"
                    onClick={() => setShowKurLookup("usdAlis")}
                    title="Anlık Fiyat Listesinden Seç (USD Alış)"
                  >
                    <IconBinoculars size={14} />
                  </Button>
                </InputGroup>
              </div>

              {/* USD Satış */}
              <div className="d-flex align-items-center gap-1.5 flex-shrink-0">
                <span className="small fw-bold text-secondary text-nowrap flex-shrink-0" style={{ minWidth: "65px" }}>
                  USD Satış:
                </span>
                <InputGroup size="sm" style={{ width: "125px" }}>
                  <Form.Control
                    type="text"
                    value={usdSatis ?? ""}
                    onChange={(e) => handleUsdSatisChange(cleanInputStr(e.target.value))}
                    className="font-monospace text-end bg-white fw-bold text-primary"
                  />
                  <Button
                    variant="outline-secondary"
                    className="px-1.5"
                    onClick={() => setShowKurLookup("usdSatis")}
                    title="Anlık Fiyat Listesinden Seç (USD Satış)"
                  >
                    <IconBinoculars size={14} />
                  </Button>
                </InputGroup>
              </div>
            </div>

            {/* Sağ Kısım: [F1 Kaydet], [Kaydet / Yazdır], [Vazgeç] Butonları */}
            <div className="d-flex align-items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                className="px-3 py-1 fw-bold d-flex align-items-center gap-1.5 shadow-sm"
                onClick={handleSave}
                disabled={isSaving}
                title="Ürünü Kaydet (F1)"
              >
                <span className="badge bg-white text-primary font-monospace" style={{ fontSize: "10px" }}>F1</span>
                <span>Kaydet</span>
              </Button>

              <Button
                variant="success"
                size="sm"
                className="px-3 py-1 fw-bold d-flex align-items-center gap-1.5 shadow-sm"
                onClick={handleSaveAndPrint}
                disabled={isSaving}
                title="Ürünü Kaydet ve Barkod Etiketi Yazdır"
              >
                <IconPrinter size={15} />
                <span>Kaydet / Yazdır</span>
              </Button>

              <Button
                variant="outline-secondary"
                size="sm"
                className="px-3 py-1 fw-semibold"
                onClick={handleNew}
                disabled={isSaving}
              >
                Vazgeç
              </Button>
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* ─── MODAL 1: Özel Ürün Arama & Listeleme (F3 / F4 / Dürbün) ─── */}
      <LookupModal<OzelUrunItem>
        show={showLookup}
        title="Özel Ürün Kartı Arama & Seçim (TODVZ_OZEL_URUN)"
        columns={lookupColumns}
        items={ozelList}
        filterFn={(it, term) => {
          const t = term.toLowerCase();
          return (
            it.grupKodu.toLowerCase().includes(t) ||
            String(it.urunNo).includes(t) ||
            (it.barkod ? it.barkod.toLowerCase().includes(t) : false) ||
            (it.mamulTipi ? it.mamulTipi.toLowerCase().includes(t) : false) ||
            (it.ureticiFirma ? it.ureticiFirma.toLowerCase().includes(t) : false) ||
            (it.tasCinsi ? it.tasCinsi.toLowerCase().includes(t) : false)
          );
        }}
        onSelect={handleSelectRecord}
        onHide={() => setShowLookup(false)}
      />

      {/* ─── MODAL 2: Kayıtlı Grupları Listeleme & Seçme Modalı ─── */}
      <Modal show={showGrupLookup} onHide={() => setShowGrupLookup(false)} centered size="lg">
        <Modal.Header closeButton className="bg-light py-2 px-3 border-bottom">
          <Modal.Title className="fs-6 fw-bold text-dark d-flex align-items-center gap-2">
            <IconBinoculars size={18} className="text-primary" />
            <span>Kayıtlı Özel Ürün Grupları (Grup Seçimi)</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3">
          <div className="d-flex justify-content-between align-items-center mb-2.5">
            <span className="small text-muted">Seçmek istediğiniz satıra tıklayıp Seç'e basabilir veya satıra çift tıklayabilirsiniz.</span>
            <Button
              variant="success"
              size="sm"
              onClick={() => {
                setShowGrupLookup(false);
                setShowGrupEkleModal(true);
              }}
              className="d-flex align-items-center gap-1"
            >
              <IconPlus size={15} />
              <span>+ Yeni Grup Tanımla</span>
            </Button>
          </div>

          <div className="table-responsive border rounded bg-white" style={{ maxHeight: "320px" }}>
            <table className="table table-hover table-sm mb-0 align-middle">
              <thead className="table-light sticky-top">
                <tr className="small text-muted">
                  <th style={{ width: "120px" }}>Grup Kodu</th>
                  <th>Açıklama</th>
                  <th style={{ width: "110px" }} className="text-center">Son Numara</th>
                </tr>
              </thead>
              <tbody>
                {grupList.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center py-3 text-muted small">
                      Henüz kayıtlı grup bulunmamaktadır.
                    </td>
                  </tr>
                ) : (
                  grupList.map((g, i) => {
                    const isSelected = selectedGrupItem?.grupKodu === g.grupKodu;
                    return (
                      <tr
                        key={i}
                        className={isSelected ? "table-primary fw-semibold" : ""}
                        style={{ cursor: "pointer", userSelect: "none" }}
                        onClick={() => setSelectedGrupItem(g)}
                        onDoubleClick={() => {
                          handleGrupSec(g.grupKodu);
                          setShowGrupLookup(false);
                        }}
                      >
                        <td className="fw-bold font-monospace text-primary">{g.grupKodu}</td>
                        <td>{g.aciklama || "-"}</td>
                        <td className="text-center font-monospace fw-bold">{g.sonNo}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Modal.Body>
        <Modal.Footer className="bg-light py-2 px-3 border-top d-flex justify-content-end gap-2">
          <Button variant="outline-secondary" size="sm" onClick={() => setShowGrupLookup(false)}>
            Vazgeç
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!selectedGrupItem}
            onClick={() => {
              if (selectedGrupItem) {
                handleGrupSec(selectedGrupItem.grupKodu);
                setShowGrupLookup(false);
              }
            }}
          >
            Seç
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ─── MODAL 3: Yeni Grup Ekleme Modalı (+ Yeni) ─── */}
      <Modal show={showGrupEkleModal} onHide={() => setShowGrupEkleModal(false)} centered>
        <Modal.Header closeButton className="bg-light py-2 px-3 border-bottom">
          <Modal.Title className="fs-6 fw-bold text-dark d-flex align-items-center gap-2">
            <IconPlus size={18} className="text-success" />
            <span>Yeni Özel Ürün Grubu Tanımla</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3">
          <Form onSubmit={(e) => { e.preventDefault(); handleSaveYeniGrup(); }}>
            <Form.Group className="mb-3">
              <Form.Label className="small fw-bold text-secondary">
                Grup Kodu <span className="text-danger">*</span> (Örn: PIR, ELM, ZMR)
              </Form.Label>
              <Form.Control
                type="text"
                autoFocus
                maxLength={10}
                value={yeniGrupKodu}
                onChange={(e) => setYeniGrupKodu(e.target.value.toUpperCase())}
                className="font-monospace fw-bold"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label className="small fw-bold text-secondary">Grup Açıklaması</Form.Label>
              <Form.Control
                type="text"
                value={yeniGrupAciklama}
                onChange={(e) => setYeniGrupAciklama(e.target.value)}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label className="small fw-bold text-secondary">Başlangıç Numarası</Form.Label>
              <Form.Control
                type="number"
                value={yeniGrupBaslangicNo}
                onChange={(e) => setYeniGrupBaslangicNo(parseInt(e.target.value, 10) || 0)}
                className="font-monospace"
              />
              <Form.Text className="text-muted small">0 bırakılırsa ilk ürün 1 numara ile başlar.</Form.Text>
            </Form.Group>

            <div className="d-flex justify-content-end gap-2 pt-2 border-top">
              <Button variant="outline-secondary" onClick={() => setShowGrupEkleModal(false)}>
                Vazgeç
              </Button>
              <Button variant="success" type="submit">
                Grup Kaydet
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

      {/* ─── MODAL 4: Üretici Firma Lookup Modalı ─── */}
      <LookupModal<CariKartItem>
        show={showFirmaLookup}
        title="Üretici Firma Seç"
        columns={[
          { header: "Kod", width: "100px", render: (it) => <span className="font-monospace fw-bold">{it.kod}</span> },
          { header: "Firma / Cari Adı", render: (it) => it.ad || it.kod || "-" },
          { header: "Yetkili", width: "140px", render: (it) => it.yetkiliKisi || "-" },
          { header: "Telefon", width: "120px", render: (it) => it.telefon || "-" },
        ]}
        items={cariList}
        filterFn={(it, term) => {
          const t = term.toLowerCase();
          return (
            (it.kod ? it.kod.toLowerCase().includes(t) : false) ||
            (it.ad ? it.ad.toLowerCase().includes(t) : false) ||
            (it.yetkiliKisi ? it.yetkiliKisi.toLowerCase().includes(t) : false)
          );
        }}
        onSelect={(it) => {
          setUreticiFirma(it.ad || it.kod || "");
          setShowFirmaLookup(false);
        }}
        onHide={() => setShowFirmaLookup(false)}
      />

      {/* ─── MODAL 4B: Kayıtlı Bankoları Listeleme & Seçme Modalı ─── */}
      <Modal show={showBankoLookup} onHide={() => setShowBankoLookup(false)} centered size="lg">
        <Modal.Header closeButton className="bg-light py-2 px-3 border-bottom">
          <Modal.Title className="fs-6 fw-bold text-dark d-flex align-items-center gap-2">
            <IconBinoculars size={18} className="text-primary" />
            <span>Kayıtlı Bankolar (Banko Seçimi)</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3">
          <div className="d-flex justify-content-between align-items-center mb-2.5">
            <span className="small text-muted">Seçmek istediğiniz satıra tıklayıp Seç'e basabilir veya satıra çift tıklayabilirsiniz.</span>
            <Button
              variant="success"
              size="sm"
              onClick={() => {
                setShowBankoLookup(false);
                setShowBankoEkleModal(true);
              }}
              className="d-flex align-items-center gap-1"
            >
              <IconPlus size={15} />
              <span>+ Yeni Banko Tanımla</span>
            </Button>
          </div>

          <div className="table-responsive border rounded bg-white" style={{ maxHeight: "320px" }}>
            <table className="table table-hover table-sm mb-0 align-middle">
              <thead className="table-light sticky-top">
                <tr className="small text-muted">
                  <th style={{ width: "120px" }}>Banko Kodu</th>
                  <th>Banko Adı</th>
                  <th>Açıklama</th>
                </tr>
              </thead>
              <tbody>
                {bankoList.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center py-3 text-muted small">
                      Henüz kayıtlı banko bulunmamaktadır.
                    </td>
                  </tr>
                ) : (
                  bankoList.map((b) => {
                    const isSelected = selectedBankoItem?.bankoId === b.bankoId;
                    return (
                      <tr
                        key={b.bankoId}
                        className={isSelected ? "table-primary fw-semibold" : ""}
                        style={{ cursor: "pointer", userSelect: "none" }}
                        onClick={() => setSelectedBankoItem(b)}
                        onDoubleClick={() => {
                          setBanko(b.bankoAdi);
                          setShowBankoLookup(false);
                        }}
                      >
                        <td className="fw-bold font-monospace text-primary">{b.bankoKodu}</td>
                        <td className="fw-semibold text-dark">{b.bankoAdi}</td>
                        <td className="text-muted small">{b.aciklama || "-"}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Modal.Body>
        <Modal.Footer className="bg-light py-2 px-3 border-top d-flex justify-content-end gap-2">
          <Button variant="outline-secondary" size="sm" onClick={() => setShowBankoLookup(false)}>
            Vazgeç
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!selectedBankoItem}
            onClick={() => {
              if (selectedBankoItem) {
                setBanko(selectedBankoItem.bankoAdi);
                setShowBankoLookup(false);
              }
            }}
          >
            Seç
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ─── MODAL 4C: Yeni Banko Tanımlama Modalı (+ Yeni Banko) ─── */}
      <Modal show={showBankoEkleModal} onHide={() => setShowBankoEkleModal(false)} centered>
        <Modal.Header closeButton className="bg-light py-2 px-3 border-bottom">
          <Modal.Title className="fs-6 fw-bold text-dark d-flex align-items-center gap-2">
            <IconPlus size={18} className="text-success" />
            <span>Yeni Banko / Vitrin Tanımla</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3">
          <Form onSubmit={(e) => { e.preventDefault(); handleSaveYeniBanko(); }}>
            <Form.Group className="mb-3">
              <Form.Label className="small fw-bold text-secondary">
                Banko Kodu
              </Form.Label>
              <Form.Control
                type="text"
                maxLength={20}
                value={yeniBankoKodu}
                onChange={(e) => setYeniBankoKodu(e.target.value.toUpperCase())}
                className="font-monospace fw-bold"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label className="small fw-bold text-secondary">
                Banko Adı <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                type="text"
                autoFocus
                value={yeniBankoAdi}
                onChange={(e) => setYeniBankoAdi(e.target.value)}
                className="fw-bold"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label className="small fw-bold text-secondary">Açıklama</Form.Label>
              <Form.Control
                type="text"
                value={yeniBankoAciklama}
                onChange={(e) => setYeniBankoAciklama(e.target.value)}
              />
            </Form.Group>

            <div className="d-flex justify-content-end gap-2 pt-2 border-top">
              <Button variant="outline-secondary" onClick={() => setShowBankoEkleModal(false)}>
                Vazgeç
              </Button>
              <Button variant="success" type="submit">
                Banko Kaydet
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

      {/* ─── MODAL 5: Kur Seçimi Modalı (Para Tablosundan Seçim) ─── */}
      <LookupModal<KurRowItem>
        show={showKurLookup !== null}
        title="Para Tablosundan Para Birimi / Kur Seç"
        columns={[
          { header: "Döviz / Para Kodu", width: "120px", render: (it) => <span className="font-monospace fw-bold text-primary">{it.kod}</span> },
          { header: "Açıklama / Para Adı", render: (it) => it.ad || "-" },
          { header: "Efektif Alış", width: "110px", render: (it) => it.efektifAlis ?? it.dovizAlis ?? "-" },
          { header: "Efektif Satış", width: "110px", render: (it) => it.efektifSatis ?? it.dovizSatis ?? "-" },
          { header: "Döviz Alış", width: "110px", render: (it) => it.dovizAlis ?? "-" },
          { header: "Döviz Satış", width: "110px", render: (it) => it.dovizSatis ?? "-" },
        ]}
        items={kurRows}
        filterFn={(it, term) => {
          const t = term.toLowerCase();
          return it.kod.toLowerCase().includes(t) || it.ad.toLowerCase().includes(t);
        }}
        onSelect={(it) => {
          const kod = (it.kod || "").toUpperCase();
          if (showKurLookup === "hasAlis") {
            const chosen = (it.efektifAlis !== undefined && it.efektifAlis !== null && Number(it.efektifAlis) > 0)
              ? it.efektifAlis
              : (it.dovizAlis || it.efektifSatis || it.dovizSatis || 0);
            setHasAlis(chosen);
            const updatedRef = { ...kurRef, hasAlis: parseNum(chosen) };
            recalculateAll(monturGram, ayar, monturIscilik, monturIscilikBirim, monturIscilikParaKodu, taslar, maliyetParaKodu, satisParaKodu, satisKariYuzde, updatedRef);
          } else if (showKurLookup === "hasSatis") {
            const chosen = (it.efektifSatis !== undefined && it.efektifSatis !== null && Number(it.efektifSatis) > 0)
              ? it.efektifSatis
              : (it.dovizSatis || it.efektifAlis || it.dovizAlis || 0);
            setHasSatis(chosen);
            const updatedRef = { ...kurRef, hasSatis: parseNum(chosen) };
            recalculateAll(monturGram, ayar, monturIscilik, monturIscilikBirim, monturIscilikParaKodu, taslar, maliyetParaKodu, satisParaKodu, satisKariYuzde, updatedRef);
          } else if (showKurLookup === "usdAlis") {
            const chosen = (it.efektifAlis !== undefined && it.efektifAlis !== null && Number(it.efektifAlis) > 0)
              ? it.efektifAlis
              : (it.dovizAlis || it.efektifSatis || it.dovizSatis || 0);
            setUsdAlis(chosen);
            const updatedRef = { ...kurRef, usdAlis: parseNum(chosen) };
            recalculateAll(monturGram, ayar, monturIscilik, monturIscilikBirim, monturIscilikParaKodu, taslar, maliyetParaKodu, satisParaKodu, satisKariYuzde, updatedRef);
          } else if (showKurLookup === "usdSatis") {
            const chosen = (it.efektifSatis !== undefined && it.efektifSatis !== null && Number(it.efektifSatis) > 0)
              ? it.efektifSatis
              : (it.dovizSatis || it.efektifAlis || it.dovizAlis || 0);
            setUsdSatis(chosen);
            const updatedRef = { ...kurRef, usdSatis: parseNum(chosen), usd: parseNum(chosen) };
            recalculateAll(monturGram, ayar, monturIscilik, monturIscilikBirim, monturIscilikParaKodu, taslar, maliyetParaKodu, satisParaKodu, satisKariYuzde, updatedRef);
          } else if (showKurLookup === "eur") {
            const chosen = (it.efektifSatis !== undefined && it.efektifSatis !== null && Number(it.efektifSatis) > 0)
              ? it.efektifSatis
              : (it.efektifAlis || it.dovizSatis || it.dovizAlis || 0);
            setEurKuru(chosen);
            const updatedRef = { ...kurRef, eur: parseNum(chosen) };
            recalculateAll(monturGram, ayar, monturIscilik, monturIscilikBirim, monturIscilikParaKodu, taslar, maliyetParaKodu, satisParaKodu, satisKariYuzde, updatedRef);
          } else if (showKurLookup === "maliyet") {
            const oldPara = maliyetParaKodu;
            setMaliyetParaKodu(kod);
            const mNum = parseNum(maliyet);
            if (mNum > 0) {
              const oldRate = getKurVal(oldPara, kurRef);
              const newRate = getKurVal(kod, kurRef);
              const convertedMaliyet = newRate > 0 ? (mNum * oldRate) / newRate : mNum;
              setMaliyet(formatNumber(convertedMaliyet, 2));
            }
            if (parseNum(monturGram) > 0 || (taslar && taslar.length > 0)) {
              recalculateAll(monturGram, ayar, monturIscilik, monturIscilikBirim, monturIscilikParaKodu, taslar, kod, satisParaKodu, satisKariYuzde, kurRef);
            }
          } else if (showKurLookup === "satis") {
            const oldPara = satisParaKodu;
            setSatisParaKodu(kod);
            const sNum = parseNum(satisFiyati);
            if (sNum > 0) {
              const oldRate = getKurVal(oldPara, kurRef);
              const newRate = getKurVal(kod, kurRef);
              const convertedSatis = newRate > 0 ? (sNum * oldRate) / newRate : sNum;
              setSatisFiyati(formatNumber(convertedSatis, 2));
            }
            if (parseNum(monturGram) > 0 || (taslar && taslar.length > 0)) {
              recalculateAll(monturGram, ayar, monturIscilik, monturIscilikBirim, monturIscilikParaKodu, taslar, maliyetParaKodu, kod, satisKariYuzde, kurRef);
            }
          } else if (showKurLookup === "monturIscilik") {
            setMonturIscilikParaKodu(kod);
            recalculateAll(monturGram, ayar, monturIscilik, monturIscilikBirim, kod, taslar, maliyetParaKodu, satisParaKodu, satisKariYuzde, kurRef);
          } else if (showKurLookup === "tasPara" && selectedTasIdForKur) {
            handleTasGuncelle(selectedTasIdForKur, "paraKodu", kod);
            setSelectedTasIdForKur(null);
          }
          setShowKurLookup(null);
        }}
        onHide={() => {
          setShowKurLookup(null);
          setSelectedTasIdForKur(null);
        }}
      />

      {/* ─── MODAL 6: Silme Onayı ─── */}
      <Modal show={showDeleteConfirm} onHide={() => setShowDeleteConfirm(false)} centered size="sm">
        <Modal.Header closeButton className="bg-danger text-white py-2 px-3">
          <Modal.Title className="fs-6 fw-bold">Kayıt Silme Onayı</Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3 text-center">
          <IconAlertTriangle size={36} className="text-danger mb-2" />
          <p className="mb-0">
            <strong>{grupKodu}-{urunNo}</strong> numaralı özel ürün kaydını silmek istediğinize emin misiniz?
          </p>
        </Modal.Body>
        <Modal.Footer className="py-2 px-3 justify-content-center">
          <Button variant="secondary" size="sm" onClick={() => setShowDeleteConfirm(false)}>
            Vazgeç
          </Button>
          <Button variant="danger" size="sm" onClick={handleDelete} disabled={isSaving}>
            Evet, Sil
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ─── MODAL 7: Canlı Kamera ile Fotoğraf Çekme Modalı ─── */}
      <Modal
        show={showCameraModal}
        onHide={stopCamera}
        centered
        backdrop="static"
        size="lg"
      >
        <Modal.Header closeButton className="bg-light py-2 px-3 border-bottom">
          <Modal.Title className="fs-6 fw-bold text-dark d-flex align-items-center gap-2">
            <IconCamera size={18} className="text-success" />
            <span>Kamera ile Özel Ürün Fotoğrafı Çek</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3 text-center bg-dark">
          {cameraError ? (
            <div className="text-white p-4">
              <IconAlertTriangle size={36} className="text-warning mb-2" />
              <p className="mb-3 text-warning">{cameraError}</p>
              <Button
                variant="outline-light"
                size="sm"
                onClick={() => {
                  stopCamera();
                  cameraInputRef.current?.click();
                }}
              >
                Cihaz Dosya/Kamera Seçicisini Kullan
              </Button>
            </div>
          ) : (
            <div className="position-relative d-inline-block rounded overflow-hidden" style={{ maxHeight: "420px", maxWidth: "100%" }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                style={{ width: "100%", maxHeight: "400px", objectFit: "contain", borderRadius: "8px" }}
              />
            </div>
          )}
          <canvas ref={canvasRef} style={{ display: "none" }} />
        </Modal.Body>
        <Modal.Footer className="py-2 px-3 bg-light border-top d-flex justify-content-between">
          <Button variant="outline-secondary" size="sm" onClick={stopCamera}>
            Vazgeç
          </Button>
          {!cameraError && (
            <Button
              variant="success"
              size="sm"
              className="fw-bold px-4 d-flex align-items-center gap-2"
              onClick={capturePhoto}
            >
              <IconCamera size={16} />
              <span>Fotoğrafı Çek</span>
            </Button>
          )}
        </Modal.Footer>
      </Modal>

      {/* ─── MODAL 8: Barkod Etiket Yazdırma ─── */}
      <EtiketYazdirModal
        show={showPrintModal}
        onHide={() => setShowPrintModal(false)}
        title="Özel Ürün Barkod Etiketi Basımı"
        sablon={varsayilanSablon}
        items={printItems}
        yazicilar={yaziciList}
        onAfterPrint={async () => {
          if (ozelUrunId) {
            await EtiketService.markOzelUrunYazdirildi([ozelUrunId], true);
            showNotif("success", "Etiket yazdırıldı olarak işaretlendi.");
          }
        }}
      />

      {/* ─── Fotoğraf Büyütme Lightbox Modalı ─── */}
      <Modal
        show={showFotoModal}
        onHide={() => setShowFotoModal(false)}
        centered
        size="lg"
        contentClassName="bg-transparent border-0 shadow-none"
      >
        <div
          className="position-relative bg-dark bg-opacity-95 rounded-4 p-3 d-flex flex-column align-items-center shadow-lg border border-secondary border-opacity-50"
          style={{ backdropFilter: "blur(8px)" }}
        >
          {/* Üst Bar: Başlık ve Kapat Butonu */}
          <div className="d-flex align-items-center justify-content-between w-100 mb-2 px-2 text-white">
            <div className="d-flex align-items-center gap-2">
              <span className="fw-bold font-monospace fs-6">
                {grupKodu}-{urunNo}
              </span>
              <span className="text-secondary small">{mamulTipi || "Özel Ürün"}</span>
              {resimler.length > 1 && (
                <span className="badge bg-secondary font-monospace">
                  {seciliResimIndex + 1} / {resimler.length}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowFotoModal(false)}
              className="btn btn-sm btn-outline-light rounded-circle d-flex align-items-center justify-content-center"
              style={{ width: "34px", height: "34px" }}
              title="Kapat"
            >
              <IconX size={20} />
            </button>
          </div>

          {/* Büyük Görsel Alanı */}
          <div
            className="position-relative w-100 d-flex align-items-center justify-content-center bg-black bg-opacity-40 rounded-3 overflow-hidden p-2"
            style={{ maxHeight: "75vh", minHeight: "350px" }}
          >
            {(resimler.length > 0 && resimler[seciliResimIndex]) ? (
              <img
                src={resolveImageUrl(resimler[seciliResimIndex])}
                alt="Büyük Özel Ürün Fotoğrafı"
                style={{
                  maxWidth: "100%",
                  maxHeight: "70vh",
                  objectFit: "contain",
                  borderRadius: "6px",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
                }}
              />
            ) : resim ? (
              <img
                src={resolveImageUrl(resim)}
                alt="Büyük Özel Ürün Fotoğrafı"
                style={{
                  maxWidth: "100%",
                  maxHeight: "70vh",
                  objectFit: "contain",
                  borderRadius: "6px",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
                }}
              />
            ) : null}

            {/* Sol / Sağ Oklar */}
            {resimler.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setSeciliResimIndex((prev) => (prev > 0 ? prev - 1 : resimler.length - 1))}
                  className="btn btn-dark position-absolute start-0 top-50 translate-middle-y ms-3 rounded-circle d-flex align-items-center justify-content-center opacity-85 shadow-lg border border-secondary"
                  style={{ width: "44px", height: "44px", zIndex: 10 }}
                  title="Önceki Fotoğraf"
                >
                  <IconChevronLeft size={24} className="text-white" />
                </button>
                <button
                  type="button"
                  onClick={() => setSeciliResimIndex((prev) => (prev < resimler.length - 1 ? prev + 1 : 0))}
                  className="btn btn-dark position-absolute end-0 top-50 translate-middle-y me-3 rounded-circle d-flex align-items-center justify-content-center opacity-85 shadow-lg border border-secondary"
                  style={{ width: "44px", height: "44px", zIndex: 10 }}
                  title="Sonraki Fotoğraf"
                >
                  <IconChevronRight size={24} className="text-white" />
                </button>
              </>
            )}
          </div>

          {/* Alt Küçük Resim Şeridi */}
          {resimler.length > 1 && (
            <div className="d-flex align-items-center gap-2 mt-3 overflow-auto py-1 px-2">
              {resimler.map((imgUrl, idx) => (
                <div
                  key={idx}
                  onClick={() => setSeciliResimIndex(idx)}
                  className={`rounded border p-0.5 cursor-pointer transition-all ${
                    idx === seciliResimIndex
                      ? "border-warning border-2 scale-110 shadow"
                      : "border-secondary opacity-60 hover-opacity-100"
                  }`}
                  style={{ width: "50px", height: "50px", background: "#fff", cursor: "pointer" }}
                >
                  <img
                    src={resolveImageUrl(imgUrl)}
                    alt={`thumb-${idx}`}
                    style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "3px" }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
      {/* Ayar Seçim & Tanımlama Modalı (TODVZ_AYAR) */}
      <AyarSecimModal
        show={showAyarModal}
        onHide={() => setShowAyarModal(false)}
        onSelect={(selected) => {
          AyarService.getAyarlar(false).then((freshList) => {
            if (freshList && freshList.length > 0) setAyarList(freshList);
          }).catch(() => {});
          handleAyarChange(selected.ayarKodu || selected.ayarAdi);
          setShowAyarModal(false);
        }}
        selectedAyarKodu={ayar}
      />
    </div>
  );
};

export default OzelUrunTanimlamaPage;
