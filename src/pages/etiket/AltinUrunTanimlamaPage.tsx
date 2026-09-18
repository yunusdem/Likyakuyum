import React, { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Row, Col, Card, Form, Button, Alert, InputGroup, Modal, Dropdown } from "react-bootstrap";
import {
  IconBarcode,
  IconCheck,
  IconAlertTriangle,
  IconBinoculars,
  IconPrinter,
  IconCamera,
  IconTrash,
  IconPlus,
  IconRefresh,
  IconScale,
  IconCoin,
  IconCalculator,
  IconX,
  IconPhoto,
  IconFolder,
  IconMaximize,
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import LookupModal, { LookupColumn } from "../../components/common/LookupModal";
import { AyarSecimModal } from "../../components/common/AyarSecimModal";
import EtiketYazdirModal, { EtiketYazdirItem } from "./EtiketYazdirModal";
import {
  EtiketService,
  AltinUrunItem,
  SaveAltinUrunPayload,
  EtiketSablonItem,
  EtiketGrupItem,
  BankoItem,
} from "../../services/etiketService";
import { AyarService, AyarItem } from "../../services/ayarService";
import { CariService, CariKartItem } from "../../services/cariService";
import { KurService, KurRowItem } from "../../services/kurService";
import { PrinterService, YaziciItem } from "../../services/printerService";
import { envConfig } from "../../config/env.config";

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
};

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

export const AltinUrunTanimlamaPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isDuzeltmeMode = location.pathname.includes("duzeltme");

  // ─── Form State ─────────────────────────────────────────────────────────────
  const [altinUrunId, setAltinUrunId] = useState<number | null>(null);
  const [tarih, setTarih] = useState<string>(new Date().toISOString().slice(0, 10));
  const [grupKodu, setGrupKodu] = useState<string>("");
  const [urunNo, setUrunNo] = useState<number | string>("");
  const [barkod, setBarkod] = useState<string>("");
  const [ayar, setAyar] = useState<string>("22");
  const [ayarList, setAyarList] = useState<AyarItem[]>([]);
  const [showAyarModal, setShowAyarModal] = useState<boolean>(false);
  const [ureticiFirma, setUreticiFirma] = useState<string>("");
  const [orjinalKod, setOrjinalKod] = useState<string>("");
  const [model, setModel] = useState<string>("");
  const [banko, setBanko] = useState<string>("Banko 1");

  // Gramaj ve Hesap Alanları
  const [miktar, setMiktar] = useState<number | string>("");
  const [hasGram, setHasGram] = useState<number | string>("");
  const [maliyetIscilik, setMaliyetIscilik] = useState<number | string>("");
  const [maliyetIscilikParaKodu, setMaliyetIscilikParaKodu] = useState<string>("HAS");
  const [maliyetIscilikBirim, setMaliyetIscilikBirim] = useState<string>("Gram");
  const [maliyetIscilikTutari, setMaliyetIscilikTutari] = useState<number | string>("");

  const [satisIscilik, setSatisIscilik] = useState<number | string>("");
  const [satisIscilikTutari, setSatisIscilikTutari] = useState<number | string>("");
  const [toplamIscilik, setToplamIscilik] = useState<number | string>("");
  const [iscilikKari, setIscilikKari] = useState<number | string>("");
  const [toplamHas, setToplamHas] = useState<number | string>("");

  // Maliyet, Satış & Kâr & Kur Referansı
  const [kurRef, setKurRef] = useState<"alis" | "satis">("alis");
  const [maliyet, setMaliyet] = useState<number | string>(""); // HAS cinsinden
  const [maliyetDoviz, setMaliyetDoviz] = useState<number | string>(""); // Döviz/TL cinsinden
  const [maliyetParaKodu, setMaliyetParaKodu] = useState<string>("USD");
  const [satisFiyati, setSatisFiyati] = useState<number | string>(""); // HAS cinsinden
  const [satisDoviz, setSatisDoviz] = useState<number | string>(""); // Döviz/TL cinsinden
  const [satisParaKodu, setSatisParaKodu] = useState<string>("USD");
  const [satisKariYuzde, setSatisKariYuzde] = useState<number | string>("");

  // Anlık Kur Göstergeleri (HAS & USD)
  const [hasKuru1, setHasKuru1] = useState<number | string>("");
  const [hasKuru2, setHasKuru2] = useState<number | string>("");
  const [usdKuru1, setUsdKuru1] = useState<number | string>("");
  const [usdKuru2, setUsdKuru2] = useState<number | string>("");

  // Resim / Fotoğraf Listesi
  const [resim, setResim] = useState<string | null>(null);
  const [resimler, setResimler] = useState<string[]>([]);
  const [seciliResimIndex, setSeciliResimIndex] = useState<number>(0);

  // ─── UI & Liste State ───────────────────────────────────────────────────────
  const [altinList, setAltinList] = useState<AltinUrunItem[]>([]);
  const [grupList, setGrupList] = useState<EtiketGrupItem[]>([]);
  const [bankoList, setBankoList] = useState<BankoItem[]>([]);
  const [ureticiList, setUreticiList] = useState<string[]>([]);
  const [cariList, setCariList] = useState<CariKartItem[]>([]);
  const [sablonlar, setSablonlar] = useState<EtiketSablonItem[]>([]);
  const [kurRows, setKurRows] = useState<KurRowItem[]>([]);
  const [yaziciList, setYaziciList] = useState<YaziciItem[]>([]);

  const [isSaving, setIsSaving] = useState(false);
  const [modalNotif, setModalNotif] = useState<{ type: "success" | "danger" | "warning"; message: string } | null>(null);

  // Modals
  const [showLookup, setShowLookup] = useState(false);
  const [showFirmaLookup, setShowFirmaLookup] = useState(false);
  const [showGrupLookup, setShowGrupLookup] = useState(false);
  const [selectedGrupItem, setSelectedGrupItem] = useState<EtiketGrupItem | null>(null);
  const [showFotoModal, setShowFotoModal] = useState(false);
  const [showGrupEkleModal, setShowGrupEkleModal] = useState(false);
  const [showBankoLookup, setShowBankoLookup] = useState(false);
  const [selectedBankoItem, setSelectedBankoItem] = useState<BankoItem | null>(null);
  const [showBankoEkleModal, setShowBankoEkleModal] = useState(false);
  const [showKurLookup, setShowKurLookup] = useState<"hasAlis" | "hasSatis" | "usdAlis" | "usdSatis" | "maliyet" | "satis" | "iscilik" | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Yeni Grup Ekleme Form State
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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

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
    setModalNotif({ type, message: msg });
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

  const format2 = (num: number | string | undefined | null): string => {
    if (num === undefined || num === null || num === "") return "";
    const parsed = typeof num === "number" ? num : parseNum(num);
    if (isNaN(parsed) || parsed <= 0) return "";
    return parsed.toFixed(2);
  };

  const getMilyemFromAyar = useCallback((ayarStr: string): number => {
    const effectiveAyar = (ayarStr && ayarStr.trim()) ? ayarStr : "22";
    const raw = effectiveAyar.toUpperCase().trim();
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

  // ─── Kur Dönüşüm Fonksiyonları (HAS <-> Döviz / TL) ──────────────────────────
  interface RateOverrides {
    hasKuru1?: string | number;
    hasKuru2?: string | number;
    usdKuru1?: string | number;
    usdKuru2?: string | number;
    maliyetPara?: string;
    satisPara?: string;
  }

  // ─── Kur Dönüşüm Fonksiyonları (HAS <-> Döviz / TL) ──────────────────────────
  // Alt banttaki HAS Alış/Satış ve USD Alış/Satış kurlarını doğrudan referans alır
  const getRateForCurrency = useCallback(
    (paraKodu: string, ref: "alis" | "satis" = "alis", overrides?: RateOverrides): number => {
      const pKod = (paraKodu || "HAS").toUpperCase();
      if (pKod === "HAS") return 1;

      if (pKod === "TL" || pKod === "TRY") {
        const activeH1 = overrides?.hasKuru1 !== undefined ? String(overrides.hasKuru1) : hasKuru1;
        const activeH2 = overrides?.hasKuru2 !== undefined ? String(overrides.hasKuru2) : hasKuru2;
        const val = ref === "alis" ? parseNum(activeH1) : parseNum(activeH2);
        if (val > 0) return val;
        const hasRow = kurRows.find((k) => (k.kod || "").toUpperCase() === "HAS");
        return ref === "alis"
          ? (hasRow?.efektifAlis || hasRow?.dovizAlis || 1)
          : (hasRow?.efektifSatis || hasRow?.dovizSatis || 1);
      }

      if (pKod === "USD" || pKod === "$") {
        const activeU1 = overrides?.usdKuru1 !== undefined ? String(overrides.usdKuru1) : usdKuru1;
        const activeU2 = overrides?.usdKuru2 !== undefined ? String(overrides.usdKuru2) : usdKuru2;
        const val = ref === "alis" ? parseNum(activeU1) : parseNum(activeU2);
        if (val > 0) return val;
        const usdRow = kurRows.find((k) => (k.kod || "").toUpperCase() === "USD");
        return ref === "alis"
          ? (usdRow?.efektifAlis || usdRow?.dovizAlis || 1)
          : (usdRow?.efektifSatis || usdRow?.dovizSatis || 1);
      }

      const curRow = kurRows.find((k) => (k.kod || "").toUpperCase() === pKod);
      if (curRow) {
        return ref === "alis"
          ? (curRow.efektifAlis || curRow.dovizAlis || 1)
          : (curRow.efektifSatis || curRow.dovizSatis || 1);
      }
      return 1;
    },
    [hasKuru1, hasKuru2, usdKuru1, usdKuru2, kurRows]
  );

  const convertToHas = useCallback(
    (amount: number, paraKodu: string, ref: "alis" | "satis" = "alis", overrides?: RateOverrides): number => {
      if (!amount || isNaN(amount)) return 0;
      const pKod = (paraKodu || "HAS").toUpperCase();
      if (pKod === "HAS") return amount;
      const rate = getRateForCurrency(pKod, ref, overrides);
      return rate > 0 ? amount / rate : 0;
    },
    [getRateForCurrency]
  );

  const convertFromHas = useCallback(
    (hasAmount: number, targetParaKodu: string, ref: "alis" | "satis" = "alis", overrides?: RateOverrides): number => {
      if (!hasAmount || isNaN(hasAmount)) return 0;
      const pKod = (targetParaKodu || "HAS").toUpperCase();
      if (pKod === "HAS") return hasAmount;
      const rate = getRateForCurrency(pKod, ref, overrides);
      return hasAmount * rate;
    },
    [getRateForCurrency]
  );

  // ─── Otomatik Hesaplama Motoru (Kesin Kuyumculuk Formülleri) ──────────────────
  const recalculateAll = useCallback(
    (
      curMiktar: number | string,
      curAyar: string,
      curMaliyetIscilik: number | string,
      curMaliyetIscilikPara: string,
      curMaliyetBirim: string,
      curSatisIscilik: number | string,
      curKurRef: "alis" | "satis" = "alis",
      overrides?: RateOverrides
    ) => {
      const activeMaliyetPara = overrides?.maliyetPara || maliyetParaKodu;
      const activeSatisPara = overrides?.satisPara || satisParaKodu;
      const mMiktar = parseNum(curMiktar);
      const mMaliyetIscilik = parseNum(curMaliyetIscilik);
      const mSatisIscilik = parseNum(curSatisIscilik);
      const milyem = getMilyemFromAyar(curAyar);

      // 1. Miktar Has Karşılığı (Ürün Has) = Miktar * (Ayar Milyemi / 1000) (Tam 5 Hane, kilitli)
      const calcHasNum = mMiktar > 0 && milyem > 0 ? mMiktar * (milyem / 1000) : 0;
      setHasGram(calcHasNum > 0 ? format5(calcHasNum) : "");

      // 2. Maliyet İşçilik Has Karşılığı (Gram ise Miktar * İşçilik, Adet ise İşçilik)
      const rawMaliyetIscilikNum =
        mMaliyetIscilik > 0
          ? curMaliyetBirim === "Gram"
            ? mMaliyetIscilik * (mMiktar > 0 ? mMiktar : 1)
            : mMaliyetIscilik
          : 0;

      const calcMaliyetIscilikHas = convertToHas(rawMaliyetIscilikNum, curMaliyetIscilikPara, curKurRef, overrides);
      setMaliyetIscilikTutari(calcMaliyetIscilikHas > 0 ? format5(calcMaliyetIscilikHas) : "");

      // 3. Satış İşçilik Has Karşılığı (Gram ise Miktar * Satış İşçilik, Adet ise Doğrudan Satış İşçilik)
      const rawSatisIscilikNum =
        mSatisIscilik > 0
          ? curMaliyetBirim === "Gram"
            ? mSatisIscilik * (mMiktar > 0 ? mMiktar : 1)
            : mSatisIscilik
          : 0;

      const calcSatisIscilikHas = convertToHas(rawSatisIscilikNum, curMaliyetIscilikPara, curKurRef, overrides);
      setSatisIscilikTutari(calcSatisIscilikHas > 0 ? format5(calcSatisIscilikHas) : "");

      // 4. Toplam İşçilik = Maliyet İşçilik Hası + Satış İşçilik Hası
      const calcTopIsc = calcMaliyetIscilikHas + calcSatisIscilikHas;
      if (calcTopIsc > 0) {
        setToplamIscilik(format5(calcTopIsc));
        setIscilikKari(calcTopIsc);
      } else {
        setToplamIscilik("");
        setIscilikKari(0);
      }

      // 5. Toplam Has (has Maliyet) = Miktar Has + Maliyet İşçilik Has + Satış İşçilik Has
      const calcToplamHasNum = calcHasNum + calcMaliyetIscilikHas + calcSatisIscilikHas;
      const formattedToplamHas = calcToplamHasNum > 0 ? format5(calcToplamHasNum) : "";
      setToplamHas(formattedToplamHas);

      // 6. Sol Blok - Maliyet (HAS & USD/Döviz) (kilitli)
      if (calcToplamHasNum > 0) {
        setMaliyet(formattedToplamHas);
        setMaliyetDoviz(format2(convertFromHas(calcToplamHasNum, activeMaliyetPara, curKurRef, overrides)));
      } else {
        setMaliyet("");
        setMaliyetDoviz("");
      }

      // 7. Sol Blok - Satış Fiyatı (HAS & USD) ve Satış Kârı %
      // Satış Fiyatı (HAS) = Miktar Has + Satış İşçilik Has (kilitli)
      if (mSatisIscilik > 0 && calcSatisIscilikHas > 0) {
        const calcSatisHasNum = calcHasNum + calcSatisIscilikHas;
        setSatisFiyati(format5(calcSatisHasNum));
        setSatisDoviz(format2(convertFromHas(calcSatisHasNum, activeSatisPara, curKurRef, overrides)));

        // Satış Kârı % = ((Satış Fiyatı HAS - Maliyet HAS) / Maliyet HAS) * 100
        if (calcToplamHasNum > 0) {
          const derivedKar = ((calcSatisHasNum - calcToplamHasNum) / calcToplamHasNum) * 100;
          setSatisKariYuzde(derivedKar.toFixed(2));
        } else {
          setSatisKariYuzde("");
        }
      } else {
        setSatisFiyati("");
        setSatisDoviz("");
        setSatisKariYuzde("");
      }
    },
    [convertToHas, convertFromHas, getMilyemFromAyar, maliyetParaKodu, satisParaKodu]
  );

  const handleAyarChange = (newAyar: string) => {
    setAyar(newAyar);
    recalculateAll(miktar, newAyar, maliyetIscilik, maliyetIscilikParaKodu, maliyetIscilikBirim, satisIscilik, kurRef);
  };

  const handleMiktarChange = (val: string) => {
    setMiktar(val);
    recalculateAll(val, ayar || "22", maliyetIscilik, maliyetIscilikParaKodu, maliyetIscilikBirim, satisIscilik, kurRef);
  };

  const handleMaliyetIscilikChange = (val: string) => {
    setMaliyetIscilik(val);
    recalculateAll(miktar, ayar, val, maliyetIscilikParaKodu, maliyetIscilikBirim, satisIscilik, kurRef);
  };

  const handleSatisKariYuzdeChange = (val: string) => {
    setSatisKariYuzde(val);
    const mKarY = parseNum(val);
    const mMiktar = parseNum(miktar);
    const milyem = getMilyemFromAyar(ayar);
    const calcHasNum = mMiktar > 0 && milyem > 0 ? mMiktar * (milyem / 1000) : 0;
    const mMaliyetIscilik = parseNum(maliyetIscilik);
    const rawMaliyetIscilikNum =
      mMaliyetIscilik > 0
        ? maliyetIscilikBirim === "Gram"
          ? mMaliyetIscilik * (mMiktar > 0 ? mMiktar : 1)
          : mMaliyetIscilik
        : 0;
    const calcMaliyetIscilikHas = convertToHas(rawMaliyetIscilikNum, maliyetIscilikParaKodu, kurRef);
    const calcToplamHasNum = calcHasNum + calcMaliyetIscilikHas;

    if (calcToplamHasNum > 0 && val !== "") {
      const calcSatisHasNum = calcToplamHasNum * (1 + (mKarY / 100));
      setSatisFiyati(format5(calcSatisHasNum));
      setSatisDoviz(format2(convertFromHas(calcSatisHasNum, satisParaKodu, kurRef)));

      const derivedSatisIscilikHas = Math.max(0, calcSatisHasNum - calcHasNum);
      setSatisIscilikTutari(derivedSatisIscilikHas > 0 ? format5(derivedSatisIscilikHas) : "");

      const calcTopIsc = calcMaliyetIscilikHas + derivedSatisIscilikHas;
      if (calcTopIsc > 0) {
        setToplamIscilik(format5(calcTopIsc));
        setIscilikKari(calcTopIsc);
      } else {
        setToplamIscilik("");
        setIscilikKari(0);
      }

      const rawSatisIscilikVal = convertFromHas(derivedSatisIscilikHas, maliyetIscilikParaKodu, kurRef);
      const unitSatisIscilik =
        maliyetIscilikBirim === "Gram" && mMiktar > 0
          ? rawSatisIscilikVal / mMiktar
          : rawSatisIscilikVal;
      setSatisIscilik(unitSatisIscilik > 0 ? format5(unitSatisIscilik) : "");
    } else if (val === "") {
      setSatisFiyati("");
      setSatisDoviz("");
      setSatisIscilikTutari("");
      setSatisIscilik("");
      setToplamIscilik("");
      setIscilikKari(0);
    }
  };

  const handleSatisIscilikChange = (val: string) => {
    setSatisIscilik(val);
    recalculateAll(miktar, ayar, maliyetIscilik, maliyetIscilikParaKodu, maliyetIscilikBirim, val, kurRef);
  };

  const handleMaliyetBirimChange = (newBirim: string) => {
    setMaliyetIscilikBirim(newBirim);
    recalculateAll(miktar, ayar, maliyetIscilik, maliyetIscilikParaKodu, newBirim, satisIscilik, kurRef);
  };

  // ─── Kur Referansı & Alt Bant Handlers ─────────────────────────────────────
  const handleKurRefChange = (newRef: "alis" | "satis") => {
    setKurRef(newRef);
    recalculateAll(miktar, ayar, maliyetIscilik, maliyetIscilikParaKodu, maliyetIscilikBirim, satisIscilik, newRef);
  };

  const handleHasKuru1Change = (val: string) => {
    setHasKuru1(val);
    recalculateAll(miktar, ayar, maliyetIscilik, maliyetIscilikParaKodu, maliyetIscilikBirim, satisIscilik, kurRef, { hasKuru1: val });
  };

  const handleHasKuru2Change = (val: string) => {
    setHasKuru2(val);
    recalculateAll(miktar, ayar, maliyetIscilik, maliyetIscilikParaKodu, maliyetIscilikBirim, satisIscilik, kurRef, { hasKuru2: val });
  };

  const handleUsdKuru1Change = (val: string) => {
    setUsdKuru1(val);
    recalculateAll(miktar, ayar, maliyetIscilik, maliyetIscilikParaKodu, maliyetIscilikBirim, satisIscilik, kurRef, { usdKuru1: val });
  };

  const handleUsdKuru2Change = (val: string) => {
    setUsdKuru2(val);
    recalculateAll(miktar, ayar, maliyetIscilik, maliyetIscilikParaKodu, maliyetIscilikBirim, satisIscilik, kurRef, { usdKuru2: val });
  };

  // ─── Veri Yükleme ────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    try {
      const [urunler, gruplar, ureticiler, cariler, sabl, kurlar, bankolar, ayarlar, yazicilar] = await Promise.all([
        EtiketService.getAltinUrunler({ limit: 500 }),
        EtiketService.getGruplar(0).catch(() => []),
        EtiketService.getUreticiFirmalar().catch(() => []),
        CariService.getCariKartlar().catch(() => []),
        EtiketService.getSablonlar(0).catch(() => []),
        KurService.getKurTablosu({ tur: 0 }).then((t) => t?.satirlar || []).catch(() => []),
        EtiketService.getBankolar().catch(() => []),
        AyarService.getAyarlar(false).catch(() => []),
        PrinterService.getYazicilar().catch(() => []),
      ]);

      setAltinList(urunler);
      setGrupList(gruplar);
      setBankoList(bankolar);
      setUreticiList(ureticiler);
      setCariList(cariler);
      setSablonlar(sabl);
      setKurRows(kurlar);
      setAyarList(ayarlar);
      if (ayarlar && ayarlar.length > 0) {
        setAyar((prev) => {
          if (!prev || prev === "22") {
            const def22 = ayarlar.find(
              (a) =>
                a.ayarKodu === "22" ||
                a.standartAyar === 22 ||
                (a.ayarAdi && a.ayarAdi.toUpperCase().includes("22"))
            );
            return def22 ? def22.ayarKodu || def22.ayarAdi : prev || "22";
          }
          return prev;
        });
      }
      setYaziciList(yazicilar);

      // Kurları otomatik doldur (HAS & USD) - Öncelik Efektif Alış / Efektif Satış
      if (kurlar.length > 0) {
        const hasKur = kurlar.find((k) => (k.kod || "").toUpperCase() === "HAS");
        if (hasKur) {
          const hAlis = (hasKur.efektifAlis !== undefined && hasKur.efektifAlis !== null && Number(hasKur.efektifAlis) > 0) ? hasKur.efektifAlis : hasKur.dovizAlis;
          const hSatis = (hasKur.efektifSatis !== undefined && hasKur.efektifSatis !== null && Number(hasKur.efektifSatis) > 0) ? hasKur.efektifSatis : hasKur.dovizSatis;
          if (hAlis !== undefined && hAlis !== null) setHasKuru1(hAlis);
          if (hSatis !== undefined && hSatis !== null) setHasKuru2(hSatis);
        }
        const usdKur = kurlar.find((k) => (k.kod || "").toUpperCase() === "USD");
        if (usdKur) {
          const uAlis = (usdKur.efektifAlis !== undefined && usdKur.efektifAlis !== null && Number(usdKur.efektifAlis) > 0) ? usdKur.efektifAlis : usdKur.dovizAlis;
          const uSatis = (usdKur.efektifSatis !== undefined && usdKur.efektifSatis !== null && Number(usdKur.efektifSatis) > 0) ? usdKur.efektifSatis : usdKur.dovizSatis;
          if (uAlis !== undefined && uAlis !== null) setUsdKuru1(uAlis);
          if (uSatis !== undefined && uSatis !== null) setUsdKuru2(uSatis);
        }
      }
    } catch (err: any) {
      const errorMsg = extractApiErrorMessage(err, "Altın ürün ve etiket tanımlama verileri yüklenirken bir hata oluştu.");
      showNotif("danger", errorMsg);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (isDuzeltmeMode && altinList.length > 0 && !altinUrunId) {
      const queryParams = new URLSearchParams(location.search);
      const queryId = queryParams.get("id");
      if (queryId) {
        const match = altinList.find((u) => u.altinUrunId === parseInt(queryId, 10));
        if (match) handleSelectRecord(match);
        else handleSelectRecord(altinList[altinList.length - 1]);
      } else {
        handleSelectRecord(altinList[altinList.length - 1]);
      }
    } else if (!isDuzeltmeMode && altinUrunId) {
      handleNew();
    }
    const timer = setTimeout(() => {
      grupKoduRef.current?.focus();
    }, 150);
    return () => clearTimeout(timer);
  }, [isDuzeltmeMode, altinList, location.pathname, location.search]);

  // ─── F1 Klavye Kısayolu ──────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F1") {
        e.preventDefault();
        handleSave();
      } else if (isDuzeltmeMode && e.key === "F2") {
        e.preventDefault();
        if (altinUrunId) {
          setShowDeleteConfirm(true);
        } else {
          showNotif("warning", "Silinecek kayıt bulunmamaktadır.");
        }
      } else if (isDuzeltmeMode && (e.key === "F3" || e.key === "F4")) {
        e.preventDefault();
        setShowLookup(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [altinUrunId, grupKodu, urunNo, ayar, miktar, maliyet, satisFiyati, isDuzeltmeMode]);

  // ─── Grup Seçimi & Sıradaki Numarayı Alma (3 Haneli) ─────────────────────────
  const handleGrupSec = async (secilenKod: string) => {
    const kod = (secilenKod || "").trim().toUpperCase();
    if (!kod) return;
    setGrupKodu(kod);

    // Daha önce kayıt edilmiş ise listeden en büyük no'yu bulup bir sonrakini belirle
    let calculatedNextNo = 1;
    if (altinList && altinList.length > 0) {
      const matchItems = altinList.filter(
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
      const nextInfo = await EtiketService.getNextAltinUrunNo(kod, 3);
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

  // ─── Yeni Kayıt Modu (Temizle) ──────────────────────────────────────────────
  const handleNew = () => {
    setAltinUrunId(null);
    setTarih(new Date().toISOString().slice(0, 10));
    setGrupKodu("");
    setUrunNo("");
    setBarkod("");
    setAyar("22");
    setUreticiFirma("");
    setOrjinalKod("");
    setModel("");
    setBanko("Banko 1");
    setMiktar("");
    setHasGram("");
    setMaliyetIscilik("");
    setMaliyetIscilikParaKodu("HAS");
    setMaliyetIscilikBirim("Gram");
    setMaliyetIscilikTutari("");
    setSatisIscilik("");
    setSatisIscilikTutari("");
    setToplamIscilik("");
    setIscilikKari("");
    setToplamHas("");
    setMaliyet("");
    setMaliyetDoviz("");
    setMaliyetParaKodu("USD");
    setSatisFiyati("");
    setSatisDoviz("");
    setSatisParaKodu("USD");
    setSatisKariYuzde("");
    setResim(null);
    setResimler([]);
    setSeciliResimIndex(0);
  };

  // ─── Kayıt Seçme ─────────────────────────────────────────────────────────────
  const handleSelectRecord = (it: AltinUrunItem) => {
    setAltinUrunId(it.altinUrunId);
    setTarih(it.tarih ? it.tarih.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setGrupKodu(it.grupKodu);
    const paddedNo = format3Digits(it.urunNo);
    setUrunNo(paddedNo);
    setBarkod(it.barkod || `${it.grupKodu}${paddedNo}`);
    setAyar(it.ayar || "");
    setUreticiFirma(it.ureticiFirma || "");
    setOrjinalKod(it.orjinalKod || "");
    setModel(it.model || "");
    setBanko(it.banko || "Banko 1");
    setMiktar(it.miktar ? format5(it.miktar) : "");
    const itMiktar = parseNum(it.miktar || "");
    const itAyar = it.ayar || "";
    const calcHasNum = itMiktar > 0 ? itMiktar * (getMilyemFromAyar(itAyar) / 1000) : 0;
    const itHasGram = it.hasGram ? parseNum(it.hasGram) : calcHasNum;
    setHasGram(itHasGram > 0 ? format5(itHasGram) : "");

    setMaliyetIscilik(it.maliyetIscilik ? format5(it.maliyetIscilik) : "");
    const itIscilikPara = it.maliyetIscilikParaKodu || "HAS";
    const itIscilikBirim = it.maliyetIscilikBirim || "Gram";
    setMaliyetIscilikParaKodu(itIscilikPara);
    setMaliyetIscilikBirim(itIscilikBirim);

    const itIscilik = parseNum(it.maliyetIscilik || "");
    const rawIscilikNum = itIscilik > 0 ? (itIscilikBirim === "Gram" ? itIscilik * (itMiktar > 0 ? itMiktar : 1) : itIscilik) : 0;
    const calcMaliyetIscilikHas = convertToHas(rawIscilikNum, itIscilikPara, kurRef);
    const itIscilikTutari = it.maliyetIscilikTutari ? parseNum(it.maliyetIscilikTutari) : calcMaliyetIscilikHas;
    setMaliyetIscilikTutari(itIscilikTutari > 0 ? format5(itIscilikTutari) : "");

    setSatisIscilik(it.satisIscilik ? format5(it.satisIscilik) : "");
    const itSatisIscilik = parseNum(it.satisIscilik || "");
    const rawSatisIscilikNum = itSatisIscilik > 0 ? (itIscilikBirim === "Gram" ? itSatisIscilik * (itMiktar > 0 ? itMiktar : 1) : itSatisIscilik) : 0;
    const calcSatisIscilikHas = convertToHas(rawSatisIscilikNum, itIscilikPara, kurRef);
    const itSatisTutari = it.satisIscilikTutari ? parseNum(it.satisIscilikTutari) : calcSatisIscilikHas;
    setSatisIscilikTutari(itSatisTutari > 0 ? format5(itSatisTutari) : "");

    // Toplam İşçilik = Maliyet İşçilik Hası + Satış İşçilik Hası
    const effectiveMaliyetIscHas = itIscilikTutari > 0 ? itIscilikTutari : calcMaliyetIscilikHas;
    const effectiveSatisIscHas = itSatisTutari > 0 ? itSatisTutari : calcSatisIscilikHas;
    const calcTopIsc = effectiveMaliyetIscHas + effectiveSatisIscHas;
    setToplamIscilik(calcTopIsc > 0 ? format5(calcTopIsc) : (it.iscilikKari ? format5(it.iscilikKari) : ""));
    setIscilikKari(calcTopIsc > 0 ? calcTopIsc : (it.iscilikKari || 0));

    // Toplam Has (Maliyet HAS) = Miktar Has + Maliyet İşçilik Has + Satış İşçilik Has
    const calcTot = (itHasGram > 0 ? itHasGram : calcHasNum) + effectiveMaliyetIscHas + effectiveSatisIscHas;
    const mHas = it.maliyet ? format5(it.maliyet) : (calcTot > 0 ? format5(calcTot) : "");
    setToplamHas(mHas);
    setMaliyet(mHas);

    const mPKod = it.maliyetParaKodu || "USD";
    setMaliyetParaKodu(mPKod);
    if (mHas) {
      setMaliyetDoviz(format2(convertFromHas(parseNum(mHas), mPKod, kurRef)));
    } else {
      setMaliyetDoviz("");
    }

    const calcExpectedSatisHas = (itHasGram > 0 ? itHasGram : calcHasNum) + (itSatisTutari > 0 ? itSatisTutari : calcSatisIscilikHas);
    const sHas = it.satisFiyati ? format5(it.satisFiyati) : (calcExpectedSatisHas > 0 ? format5(calcExpectedSatisHas) : "");
    setSatisFiyati(sHas);

    const sPKod = it.satisParaKodu || "USD";
    setSatisParaKodu(sPKod);
    if (sHas) {
      setSatisDoviz(format2(convertFromHas(parseNum(sHas), sPKod, kurRef)));
    } else {
      setSatisDoviz("");
    }

    if (parseNum(sHas) > 0 && parseNum(mHas) > 0) {
      const derivedKar = ((parseNum(sHas) - parseNum(mHas)) / parseNum(mHas)) * 100;
      setSatisKariYuzde(derivedKar.toFixed(2));
    } else {
      setSatisKariYuzde(it.satisKariYuzde !== undefined && it.satisKariYuzde !== null ? String(it.satisKariYuzde) : "");
    }

    let activeHas1 = it.hasKuru1 && Number(it.hasKuru1) > 0 ? it.hasKuru1 : hasKuru1;
    let activeHas2 = it.hasKuru2 && Number(it.hasKuru2) > 0 ? it.hasKuru2 : hasKuru2;

    if ((!activeHas1 || Number(activeHas1) <= 0 || !activeHas2 || Number(activeHas2) <= 0) && kurRows.length > 0) {
      const hasKur = kurRows.find((k) => (k.kod || "").toUpperCase() === "HAS");
      if (hasKur) {
        const hAlis = (hasKur.efektifAlis !== undefined && hasKur.efektifAlis !== null && Number(hasKur.efektifAlis) > 0) ? hasKur.efektifAlis : hasKur.dovizAlis;
        const hSatis = (hasKur.efektifSatis !== undefined && hasKur.efektifSatis !== null && Number(hasKur.efektifSatis) > 0) ? hasKur.efektifSatis : hasKur.dovizSatis;
        if (!activeHas1 && hAlis) activeHas1 = hAlis;
        if (!activeHas2 && hSatis) activeHas2 = hSatis;
      }
    }

    if (activeHas1) setHasKuru1(activeHas1);
    if (activeHas2) setHasKuru2(activeHas2);
    const loadedImages = (it.resimler && it.resimler.length > 0) ? it.resimler : (it.resim ? [it.resim] : []);
    setResimler(loadedImages);
    setResim(loadedImages.length > 0 ? loadedImages[0] : null);
    setSeciliResimIndex(0);
    setShowLookup(false);
  };

  // ─── Fotoğraf Yükleme ve Çoklu Yönetim ────────────────────────────────────────
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
              tip: 0,
              islemId: altinUrunId || undefined,
            });
          } catch (e) {
            console.error("Fotoğraf yükleme hatası:", e);
          }
          // Doğrudan base64 verisi kullanılarak tarayıcıda anında ve net görüntüleme sağlanır
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
    if (resimler.length === 0) return;
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

  // ─── Canlı Kamera (Webcam / Stream) Yönetimi ────────────────────────────────
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
        dosyaAdi: `kamera_${Date.now()}.jpg`,
        tip: 0,
        islemId: altinUrunId || undefined,
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
      showNotif("warning", "Lütfen Ayar seçiniz.");
      return;
    }
    if (parseNum(miktar) <= 0) {
      showNotif("warning", "Lütfen ürün Miktar / Gramajını (0'dan büyük) giriniz.");
      return;
    }

    setIsSaving(true);
    try {
      const finalUrunNo = Number(urunNo) || 1;
      const paddedUrunNo = format3Digits(finalUrunNo);
      const finalBarkod = barkod.trim() || `${grupKodu.trim().toUpperCase()}${paddedUrunNo}`;

      const payload: SaveAltinUrunPayload = {
        altinUrunId: altinUrunId || undefined,
        tarih,
        grupKodu: grupKodu.trim().toUpperCase(),
        urunNo: finalUrunNo,
        barkod: finalBarkod,
        ayar,
        ureticiFirma: ureticiFirma.trim() || null,
        orjinalKod: orjinalKod.trim() || null,
        model: model.trim() || null,
        banko: banko.trim() || null,
        miktar: parseNum(miktar),
        hasGram: parseNum(hasGram),
        maliyetIscilik: parseNum(maliyetIscilik),
        maliyetIscilikParaKodu,
        maliyetIscilikBirim,
        maliyetIscilikTutari: parseNum(maliyetIscilikTutari),
        satisIscilik: parseNum(satisIscilik),
        satisIscilikTutari: parseNum(satisIscilikTutari),
        iscilikKari: parseNum(toplamIscilik),
        maliyet: parseNum(maliyet),
        maliyetParaKodu,
        satisFiyati: parseNum(satisFiyati),
        satisParaKodu,
        satisKariYuzde: parseNum(satisKariYuzde),
        hasKuru1: hasKuru1 !== "" ? parseNum(hasKuru1) : null,
        hasKuru2: hasKuru2 !== "" ? parseNum(hasKuru2) : null,
        resim: resimler.length > 0 ? resimler[seciliResimIndex] || resimler[0] : (resim || null),
        resimler: resimler.length > 0 ? resimler : (resim ? [resim] : []),
        satildi: false,
      };

      const saved = await EtiketService.saveAltinUrun(payload);
      setAltinUrunId(saved.altinUrunId);
      setUrunNo(format3Digits(saved.urunNo));
      setBarkod(saved.barkod || `${saved.grupKodu}${format3Digits(saved.urunNo)}`);
      showNotif("success", `Altın Ürün [${saved.grupKodu}-${format3Digits(saved.urunNo)}] başarıyla kaydedildi.`);

      // Listeyi tazele
      const updated = await EtiketService.getAltinUrunler({ limit: 500 });
      setAltinList(updated);
      return saved;
    } catch (err: any) {
      const errorMsg = extractApiErrorMessage(err, "Altın ürün kaydedilirken bir hata oluştu.");
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
    if (!altinUrunId) return;
    setIsSaving(true);
    try {
      await EtiketService.deleteAltinUrun(altinUrunId);
      showNotif("success", "Altın ürün kaydı başarıyla silindi.");
      setShowDeleteConfirm(false);
      handleNew();
      const updated = await EtiketService.getAltinUrunler({ limit: 500 });
      setAltinList(updated);
    } catch (err: any) {
      const errorMsg = extractApiErrorMessage(err, "Altın ürün silinirken bir hata oluştu.");
      showNotif("danger", errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Yeni Grup Kaydetme ─────────────────────────────────────────────────────
  const handleSaveYeniGrup = async () => {
    if (!yeniGrupKodu.trim()) {
      showNotif("warning", "Lütfen Grup Kodu giriniz.");
      return;
    }
    try {
      await EtiketService.saveGrup({
        tip: 0,
        grupKodu: yeniGrupKodu.trim().toUpperCase(),
        aciklama: yeniGrupAciklama.trim() || null,
        baslangicNo: Number(yeniGrupBaslangicNo) || 0,
      });
      showNotif("success", `"${yeniGrupKodu.toUpperCase()}" grubu başarıyla kaydedildi.`);
      setShowGrupEkleModal(false);
      setYeniGrupKodu("");
      setYeniGrupAciklama("");
      setYeniGrupBaslangicNo(0);

      // Grupları tazele ve bu grubu seç
      const updatedGruplar = await EtiketService.getGruplar(0);
      setGrupList(updatedGruplar);
      handleGrupSec(yeniGrupKodu.trim().toUpperCase());
    } catch (err: any) {
      const errorMsg = extractApiErrorMessage(err, "Grup eklenirken bir hata oluştu.");
      showNotif("danger", errorMsg);
    }
  };

  // ─── Yeni Banko Kaydetme ───────────────────────────────────────────────────
  const handleSaveYeniBanko = async () => {
    if (!yeniBankoAdi.trim()) {
      showNotif("warning", "Lütfen Banko Adı giriniz.");
      return;
    }
    try {
      const saved = await EtiketService.saveBanko({
        bankoKodu: yeniBankoKodu.trim().toUpperCase() || null,
        bankoAdi: yeniBankoAdi.trim(),
        aciklama: yeniBankoAciklama.trim() || null,
        aktif: true,
      });
      showNotif("success", `"${saved.bankoAdi}" bankosu başarıyla kaydedildi.`);
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
  const currentIndex = altinList.findIndex((u) => u.altinUrunId === altinUrunId);
  const handleNavigate = (dir: "first" | "prev" | "next" | "last") => {
    if (altinList.length === 0) return;
    let targetIdx = 0;
    if (dir === "first") targetIdx = 0;
    else if (dir === "prev") targetIdx = Math.max(0, currentIndex - 1);
    else if (dir === "next") targetIdx = Math.min(altinList.length - 1, currentIndex + 1);
    else if (dir === "last") targetIdx = altinList.length - 1;
    handleSelectRecord(altinList[targetIdx]);
  };

  // ─── Tablo Sütunları ─────────────────────────────────────────────────────────
  const lookupColumns: LookupColumn<AltinUrunItem>[] = [
    { header: "Grup-No", width: "90px", render: (it) => <span className="fw-bold text-primary">{it.grupKodu}-{format3Digits(it.urunNo)}</span> },
    { header: "Barkod", width: "110px", render: (it) => <span className="font-monospace">{it.barkod || "-"}</span> },
    { header: "Ayar", width: "100px", render: (it) => it.ayar || "-" },
    { header: "Model", render: (it) => it.model || "-" },
    { header: "Miktar (gr)", width: "90px", render: (it) => <span className="fw-bold">{it.miktar}</span> },
    { header: "Has (gr)", width: "80px", render: (it) => it.hasGram },
    { header: "Satış Fiyatı", width: "110px", render: (it) => `${it.satisFiyati} ${it.satisParaKodu}` },
    { header: "Üretici Firma", render: (it) => it.ureticiFirma || "-" },
  ];

  const printItems: EtiketYazdirItem[] = [
    {
      id: altinUrunId || 0,
      barkod: barkod || (grupKodu && urunNo ? `${grupKodu}${format3Digits(urunNo)}` : ""),
      fields: {
        grupUrunNo: `${grupKodu}-${format3Digits(urunNo)}`,
        ayar,
        has: String(hasGram || 0),
        gram: String(miktar || 0),
        fiyat: `${satisFiyati} ${satisParaKodu}`,
      },
    },
  ];

  const varsayilanSablon = sablonlar.find((s) => s.varsayilan) || sablonlar[0] || null;

  return (
    <div className="altin-urun-tanimlama-page w-100 pb-3" style={{ overflowX: "hidden" }}>
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

      {/* ─── ERP Toolbar ─── */}
      <ERPToolbar
        pageTitle={isDuzeltmeMode ? "C- Altın Ürün Düzeltme" : "B- Altın Ürün Barkodlama"}
        pageIcon={<IconBarcode size={20} />}
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
        onPrint={() => (altinUrunId ? setShowPrintModal(true) : showNotif("warning", "Önce bir ürün seçiniz."))}
        disabled={isSaving}
        modeText={altinUrunId ? `Kayıt: ${grupKodu}-${format3Digits(urunNo)} (${currentIndex + 1}/${altinList.length})` : (isDuzeltmeMode ? "Düzeltme Modu" : "Yeni Kayıt Modu")}
      />

      {/* ─── Ana Form Kartı ─── */}
      <Card className="shadow-sm border-0 mb-3 bg-white">
        <Card.Body className="p-3">
          {/* ─── ÜST ŞERİT: Tarih, Grup/No, Barkod Kodu ─── */}
          <div className="bg-light p-2.5 rounded-3 border mb-3">
            <Row className="g-2 align-items-center">
              {/* Tarih */}
              <Col xs={12} sm={6} md={3} lg={3}>
                <div className="d-flex align-items-center gap-2">
                  <Form.Label className="small fw-bold text-secondary mb-0 text-nowrap" style={{ minWidth: "50px" }}>
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
                <div className="d-flex align-items-center gap-2">
                  <Form.Label className="small fw-bold text-secondary mb-0 text-nowrap" style={{ minWidth: "80px" }}>
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
                <div className="d-flex align-items-center gap-2">
                  <Form.Label className="small fw-bold text-secondary mb-0 text-nowrap" style={{ minWidth: "90px" }}>
                    Barkod Kodu :
                  </Form.Label>
                  <Form.Control
                    type="text"
                    size="sm"
                    value={barkod || (grupKodu && urunNo ? `${grupKodu}${format3Digits(urunNo)}` : "")}
                    onChange={(e) => setBarkod(e.target.value)}
                    className="font-monospace fw-bold text-dark bg-white"
                  />
                </div>
              </Col>
            </Row>
          </div>

          {/* ─── İKİ SÜTUNLU GÖVDE ─── */}
          <Row className="g-3">
            {/* ─── SOL BLOK: Ürün Kimliği & Maliyet Fiyatlandırması ─── */}
            <Col xs={12} lg={6}>
              <div className="border rounded-3 p-3 bg-white h-100 d-flex flex-column gap-3">
                {/* Ürün Kimliği ve Özellikleri Başlığı */}
                <div>
                  <div className="fw-bold text-primary border-bottom pb-1.5 mb-2.5 d-flex align-items-center gap-1.5">
                    <IconScale size={18} />
                    <span>Ürün Özellikleri</span>
                  </div>

                  {/* Ayar */}
                  <div className="d-flex align-items-center mb-2 gap-2">
                    <div className="small fw-bold text-secondary text-nowrap flex-shrink-0" style={{ width: "100px" }}>
                      Ayar :
                    </div>
                    <div className="flex-grow-1">
                      <InputGroup size="sm">
                        <Form.Control
                          type="text"
                          list="altinAyarListesi"
                          value={ayar}
                          onChange={(e) => handleAyarChange(e.target.value)}
                          className="fw-bold bg-white"
                          placeholder="Ayar seçin veya yazın"
                        />
                        <Button
                          variant="outline-secondary"
                          onClick={() => setShowAyarModal(true)}
                          title="Ayar Tanımları & Seçim (Dürbün)"
                        >
                          <IconBinoculars size={15} />
                        </Button>
                      </InputGroup>
                      <datalist id="altinAyarListesi">
                        {ayarList.map((a) => (
                          <option key={a.ayarId} value={a.ayarKodu}>
                            {a.ayarAdi} ({Math.round(a.milyem * 1000)})
                          </option>
                        ))}
                      </datalist>
                    </div>
                  </div>

                  {/* Üretici Firma */}
                  <div className="d-flex align-items-center mb-2 gap-2">
                    <div className="small fw-bold text-secondary text-nowrap flex-shrink-0" style={{ width: "100px" }}>
                      Üretici Firma :
                    </div>
                    <div className="flex-grow-1">
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

                  {/* Orjinal Kod */}
                  <div className="d-flex align-items-center mb-2 gap-2">
                    <div className="small fw-bold text-secondary text-nowrap flex-shrink-0" style={{ width: "100px" }}>
                      Orjinal Kod :
                    </div>
                    <div className="flex-grow-1">
                      <Form.Control
                        type="text"
                        size="sm"
                        value={orjinalKod}
                        onChange={(e) => setOrjinalKod(e.target.value)}
                        className="font-monospace bg-white"
                      />
                    </div>
                  </div>

                  {/* Model */}
                  <div className="d-flex align-items-center mb-2 gap-2">
                    <div className="small fw-bold text-secondary text-nowrap flex-shrink-0" style={{ width: "100px" }}>
                      Model :
                    </div>
                    <div className="flex-grow-1">
                      <Form.Control
                        type="text"
                        size="sm"
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        className="bg-white"
                      />
                    </div>
                  </div>

                  {/* Banko */}
                  <div className="d-flex align-items-center mb-2 gap-2">
                    <div className="small fw-bold text-secondary text-nowrap flex-shrink-0" style={{ width: "100px" }}>
                      Banko :
                    </div>
                    <div className="flex-grow-1">
                      <InputGroup size="sm">
                        <Form.Control
                          type="text"
                          list="altinBankoListesi"
                          value={banko}
                          onChange={(e) => setBanko(e.target.value)}
                          className="fw-semibold bg-white"
                        />
                        <datalist id="altinBankoListesi">
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

                {/* Maliyet, Satış ve Kâr Fiyatlandırması */}
                <div className="pt-2 border-top">
                  <div className="d-flex align-items-center justify-content-between border-bottom pb-1.5 mb-2.5">
                    <div className="fw-bold text-primary d-flex align-items-center gap-1.5">
                      <IconCoin size={18} />
                      <span>Maliyet / Kâr</span>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <span className="small fw-bold text-secondary" style={{ fontSize: "11px" }}>Kur Ref:</span>
                      <Form.Check
                        inline
                        type="radio"
                        id="kurRefAlis"
                        name="kurRefRadio"
                        label="Alış"
                        checked={kurRef === "alis"}
                        onChange={() => handleKurRefChange("alis")}
                        className="small mb-0 text-secondary fw-semibold"
                        style={{ fontSize: "12px" }}
                      />
                      <Form.Check
                        inline
                        type="radio"
                        id="kurRefSatis"
                        name="kurRefRadio"
                        label="Satış"
                        checked={kurRef === "satis"}
                        onChange={() => handleKurRefChange("satis")}
                        className="small mb-0 text-secondary fw-semibold"
                        style={{ fontSize: "12px" }}
                      />
                    </div>
                  </div>

                  {/* Satış Kârı % */}
                  <div className="d-flex align-items-center mb-2 gap-2">
                    <div className="small fw-bold text-secondary text-nowrap flex-shrink-0" style={{ width: "100px" }}>
                      Satış Kârı % :
                    </div>
                    <div className="flex-grow-1">
                      <InputGroup size="sm" style={{ maxWidth: "135px" }}>
                        <Form.Control
                          type="text"
                          inputMode="decimal"
                          value={satisKariYuzde !== "" ? `${satisKariYuzde}` : ""}
                          onChange={(e) => handleSatisKariYuzdeChange(cleanInputStr(e.target.value))}
                          className="font-monospace text-end fw-bold text-success bg-white"
                          title="Satış Kârı %: Kâr oranını serbestçe girebilirsiniz (Örn: 20, 35, 50). Satış fiyatı otomatik güncellenir."
                        />
                        <InputGroup.Text className="bg-light">%</InputGroup.Text>
                      </InputGroup>
                    </div>
                  </div>

                  {/* Satış Fiyatı */}
                  <div className="d-flex align-items-center mb-2 gap-2">
                    <div className="small fw-bold text-secondary text-nowrap flex-shrink-0" style={{ width: "100px" }}>
                      Satış Fiyatı :
                    </div>
                    <div className="flex-grow-1 d-flex align-items-center gap-2">
                      {/* HAS Satış */}
                      <InputGroup size="sm" style={{ maxWidth: "135px" }}>
                        <Form.Control
                          type="text"
                          readOnly
                          value={satisFiyati || ""}
                          className="fw-bold font-monospace text-primary text-end bg-light fs-6"
                          title="Satış Fiyatı Has Karşılığı (Miktar Has + Satış İşçilik Has)"
                        />
                        <InputGroup.Text className="bg-light font-monospace small px-1.5 fw-semibold text-primary">HAS</InputGroup.Text>
                      </InputGroup>

                      {/* Döviz/TL Satış */}
                      <InputGroup size="sm" className="flex-grow-1">
                        <Form.Control
                          type="text"
                          readOnly
                          value={satisDoviz || ""}
                          className="fw-bold font-monospace text-primary text-end bg-light fs-6"
                          title={`Satış ${satisParaKodu} Karşılığı (Satış Fiyatı HAS * Seçilen Kur)`}
                        />
                        <Form.Control
                          type="text"
                          readOnly
                          value={satisParaKodu}
                          className="bg-light font-monospace fw-bold text-primary text-center px-1"
                          style={{ maxWidth: "52px" }}
                        />
                        <Button
                          variant="outline-secondary"
                          className="px-1.5"
                          onClick={() => setShowKurLookup("satis")}
                          title="Para Tablosundan Seç (Dürbün)"
                        >
                          <IconBinoculars size={14} />
                        </Button>
                      </InputGroup>
                    </div>
                  </div>

                  {/* Maliyet */}
                  <div className="d-flex align-items-center mb-2 gap-2">
                    <div className="small fw-bold text-secondary text-nowrap flex-shrink-0" style={{ width: "100px" }}>
                      Maliyet :
                    </div>
                    <div className="flex-grow-1 d-flex align-items-center gap-2">
                      {/* HAS Maliyet */}
                      <InputGroup size="sm" style={{ maxWidth: "135px" }}>
                        <Form.Control
                          type="text"
                          readOnly
                          value={maliyet || ""}
                          className="fw-bold font-monospace text-end bg-light"
                          title="Maliyet Has Karşılığı (Sağdaki Toplam Has Değeri)"
                        />
                        <InputGroup.Text className="bg-light font-monospace small px-1.5 fw-semibold">HAS</InputGroup.Text>
                      </InputGroup>

                      {/* Döviz/TL Maliyet */}
                      <InputGroup size="sm" className="flex-grow-1">
                        <Form.Control
                          type="text"
                          readOnly
                          value={maliyetDoviz || ""}
                          className="fw-bold font-monospace text-end bg-light"
                          title={`Maliyet ${maliyetParaKodu} Karşılığı (Maliyet HAS * Seçilen Kur)`}
                        />
                        <Form.Control
                          type="text"
                          readOnly
                          value={maliyetParaKodu}
                          className="bg-light font-monospace fw-bold text-center px-1"
                          style={{ maxWidth: "52px" }}
                        />
                        <Button
                          variant="outline-secondary"
                          className="px-1.5"
                          onClick={() => setShowKurLookup("maliyet")}
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

            {/* ─── SAĞ BLOK: Miktar ve İşçilik + Fotoğraf Kutusu ─── */}
            <Col xs={12} lg={6}>
              <div className="border rounded-3 p-3 bg-white h-100 d-flex flex-column justify-content-between gap-3">
                <div>
                  <div className="fw-bold text-primary border-bottom pb-1.5 mb-2.5 d-flex align-items-center gap-1.5">
                    <IconCalculator size={18} />
                    <span>Miktar ve İşçilik</span>
                  </div>

                  {/* Miktar & İşçilik Inputları */}
                  <div className="d-flex flex-column gap-2">
                    {/* İşçilik Türü / Brm */}
                    <div className="d-flex align-items-start gap-2">
                      <div className="small fw-bold text-secondary text-nowrap flex-shrink-0 pt-1" style={{ width: "115px" }}>
                        İşçilik Türü / Brm :
                      </div>
                      <div className="flex-grow-1 d-flex flex-column gap-1.5" style={{ maxWidth: "185px" }}>
                        <InputGroup size="sm">
                          <Form.Control
                            type="text"
                            readOnly
                            value={maliyetIscilikParaKodu}
                            className="bg-light font-monospace fw-bold text-center"
                          />
                          <Button
                            variant="outline-secondary"
                            className="px-1.5"
                            onClick={() => setShowKurLookup("iscilik")}
                            title="Para Tablosundan Seç (Dürbün)"
                          >
                            <IconBinoculars size={14} />
                          </Button>
                        </InputGroup>
                        <Form.Select
                          size="sm"
                          value={maliyetIscilikBirim}
                          onChange={(e) => handleMaliyetBirimChange(e.target.value)}
                          className="bg-white fw-semibold"
                        >
                          <option value="Gram">Gram</option>
                          <option value="Adet">Adet</option>
                        </Form.Select>
                      </div>
                    </div>

                    {/* Miktar (Gram) + Has Karşılığı Text */}
                    <div className="d-flex align-items-center gap-2">
                      <div className="small fw-bold text-secondary text-nowrap flex-shrink-0" style={{ width: "115px" }}>
                        Miktar (Gram)<span className="text-danger">*</span> :
                      </div>
                      <div className="flex-grow-1 d-flex align-items-center gap-2">
                        <Form.Control
                          type="text"
                          inputMode="decimal"
                          size="sm"
                          value={miktar ?? ""}
                          onChange={(e) => handleMiktarChange(cleanInputStr(e.target.value))}
                          onBlur={() => {
                            if (miktar) setMiktar(format5(miktar));
                          }}
                          className="fw-bold font-monospace text-end bg-white"
                          style={{ maxWidth: "145px" }}
                        />
                        <span className="badge bg-light text-primary border px-2.5 py-1.5 font-monospace fs-7 fw-bold text-nowrap">
                          {hasGram && parseNum(hasGram) > 0 ? format5(parseNum(hasGram)) : "0.00000"} Has
                        </span>
                      </div>
                    </div>

                    {/* Maliyet İşçilik + Has Karşılığı Text */}
                    <div className="d-flex align-items-center gap-2">
                      <div className="small fw-bold text-secondary text-nowrap flex-shrink-0" style={{ width: "115px" }}>
                        Maliyet İşçilik :
                      </div>
                      <div className="flex-grow-1 d-flex align-items-center gap-2">
                        <Form.Control
                          type="text"
                          inputMode="decimal"
                          size="sm"
                          value={maliyetIscilik ?? ""}
                          onChange={(e) => handleMaliyetIscilikChange(cleanInputStr(e.target.value))}
                          onBlur={() => {
                            if (maliyetIscilik) setMaliyetIscilik(format5(maliyetIscilik));
                          }}
                          className="font-monospace text-end bg-white"
                          style={{ maxWidth: "145px" }}
                        />
                        <span className="badge bg-light text-secondary border px-2 py-1.5 font-monospace text-nowrap">
                          {maliyetIscilikTutari && parseNum(maliyetIscilikTutari) > 0 ? format5(parseNum(maliyetIscilikTutari)) : "0.00000"} Has
                        </span>
                      </div>
                    </div>

                    {/* Satış İşçilik + Satış Tutarı Text */}
                    <div className="d-flex align-items-center gap-2">
                      <div className="small fw-bold text-secondary text-nowrap flex-shrink-0" style={{ width: "115px" }}>
                        Satış İşçilik :
                      </div>
                      <div className="flex-grow-1 d-flex align-items-center gap-2">
                        <Form.Control
                          type="text"
                          inputMode="decimal"
                          size="sm"
                          value={satisIscilik ?? ""}
                          onChange={(e) => handleSatisIscilikChange(cleanInputStr(e.target.value))}
                          onBlur={() => {
                            if (satisIscilik) setSatisIscilik(format5(satisIscilik));
                          }}
                          className="font-monospace text-end bg-white"
                          style={{ maxWidth: "145px" }}
                        />
                        <span className="badge bg-light text-secondary border px-2 py-1.5 font-monospace text-nowrap">
                          {satisIscilikTutari && parseNum(satisIscilikTutari) > 0 ? format5(parseNum(satisIscilikTutari)) : "0.00000"} Has
                        </span>
                      </div>
                    </div>

                    {/* Toplam İşçilik (Maliyet İşçilik Hası + Satış İşçilik Hası) */}
                    <div className="d-flex align-items-center gap-2">
                      <div className="small fw-bold text-secondary text-nowrap flex-shrink-0" style={{ width: "115px" }}>
                        Toplam İşçilik :
                      </div>
                      <div className="flex-grow-1">
                        <Form.Control
                          type="text"
                          size="sm"
                          readOnly
                          value={toplamIscilik || ""}
                          title="Toplam İşçilik = Maliyet İşçilik Hası + Satış İşçilik Hası"
                          className="font-monospace text-end bg-light fw-bold text-dark"
                          style={{ maxWidth: "145px" }}
                        />
                      </div>
                    </div>

                    {/* Toplam Has */}
                    <div className="d-flex align-items-center gap-2">
                      <div className="small fw-bold text-secondary text-nowrap flex-shrink-0" style={{ width: "115px" }}>
                        Toplam Has :
                      </div>
                      <div className="flex-grow-1">
                        <Form.Control
                          type="text"
                          size="sm"
                          readOnly
                          value={toplamHas || ""}
                          title="Toplam Has = Miktar Has + Maliyet İşçilik Has + Satış İşçilik Has (Tam 5 Hane)"
                          className="font-monospace text-end bg-light fw-bold text-success fs-6"
                          style={{ maxWidth: "185px" }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Alt Bölüm: Çoklu Fotoğraf Kutusu + ÇEK & SİL Butonları */}
                <div className="pt-2.5 border-top d-flex flex-column gap-2">
                  <div className="d-flex align-items-center gap-3">
                    <div
                      className="rounded-3 border d-flex flex-column align-items-center justify-content-center bg-light position-relative overflow-hidden flex-shrink-0 group"
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
                          alt={`Ürün Fotoğrafı ${seciliResimIndex + 1}`}
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
                          alt="Ürün Fotoğrafı"
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

                    {/* YÜKLE (Kamera / Dosya) & SİL Butonları */}
                    <div className="d-flex flex-column gap-2" style={{ width: "130px" }}>
                      <Dropdown className="w-100">
                        <Dropdown.Toggle
                          variant="outline-success"
                          size="sm"
                          className="fw-bold w-100 d-flex align-items-center justify-content-center gap-1"
                          id="dropdown-foto-yukle-secenek"
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
                  </div>

                  {/* Çoklu Fotoğraf Önizleme Küçük Resim Listesi */}
                  {resimler.length > 1 && (
                    <div className="d-flex align-items-center gap-1.5 overflow-auto py-1" style={{ maxWidth: "100%" }}>
                      {resimler.map((imgUrl, idx) => (
                        <div
                          key={idx}
                          onClick={() => {
                            setSeciliResimIndex(idx);
                            setResim(imgUrl);
                          }}
                          className={`rounded border p-0.5 cursor-pointer ${
                            idx === seciliResimIndex ? "border-primary border-2 shadow-sm" : "border-light opacity-75"
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
            </Col>
          </Row>

          {/* ─── ALT ÇUBUK: HAS & USD Kurları + Eylem Butonları ─── */}
          <div className="pt-3 mt-3 border-top d-flex align-items-center justify-content-between flex-wrap gap-3">
            {/* Sol Kısım: HAS Alış/Satış & USD Alış/Satış */}
            <div className="d-flex align-items-center gap-3 flex-wrap">
              {/* HAS Alış */}
              <div className="d-flex align-items-center gap-1.5 flex-shrink-0">
                <span className="small fw-bold text-secondary text-nowrap flex-shrink-0" style={{ minWidth: "60px" }}>
                  HAS Alış:
                </span>
                <InputGroup size="sm" style={{ width: "125px" }}>
                  <Form.Control
                    type="text"
                    value={hasKuru1 ?? ""}
                    onChange={(e) => handleHasKuru1Change(cleanInputStr(e.target.value))}
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
                    value={hasKuru2 ?? ""}
                    onChange={(e) => handleHasKuru2Change(cleanInputStr(e.target.value))}
                    className="font-monospace text-end bg-white fw-bold text-primary"
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
                <span className="small fw-bold text-secondary text-nowrap flex-shrink-0" style={{ minWidth: "60px" }}>
                  USD Alış:
                </span>
                <InputGroup size="sm" style={{ width: "125px" }}>
                  <Form.Control
                    type="text"
                    value={usdKuru1 ?? ""}
                    onChange={(e) => handleUsdKuru1Change(cleanInputStr(e.target.value))}
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
                    value={usdKuru2 ?? ""}
                    onChange={(e) => handleUsdKuru2Change(cleanInputStr(e.target.value))}
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

      {/* ─── MODAL 1: Kayıtlı Altın Ürünleri Listeleme (Lookup) ─── */}
      <LookupModal<AltinUrunItem>
        show={showLookup}
        title="Kayıtlı Altın Ürünleri (Arama / Seçim)"
        columns={lookupColumns}
        items={altinList}
        filterFn={(it, term) => {
          const t = term.toLowerCase();
          return (
            it.grupKodu.toLowerCase().includes(t) ||
            String(it.urunNo).includes(t) ||
            (it.barkod ? it.barkod.toLowerCase().includes(t) : false) ||
            (it.model ? it.model.toLowerCase().includes(t) : false) ||
            (it.ureticiFirma ? it.ureticiFirma.toLowerCase().includes(t) : false)
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
            <span>Kayıtlı Ürün Grupları (Grup Seçimi)</span>
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
            <span>Yeni Altın Ürün Grubu Tanımla</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3">
          <Form onSubmit={(e) => { e.preventDefault(); handleSaveYeniGrup(); }}>
            <Form.Group className="mb-3">
              <Form.Label className="small fw-bold text-secondary">
                Grup Kodu <span className="text-danger">*</span> (Örn: YZK, BLZ, KLY)
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
                Banko Kodu (Boş bırakılırsa otomatik BNK-01 üretilir)
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

      {/* ─── MODAL 5: Kur Seçimi Modalı ─── */}
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
            setHasKuru1(chosen);
            recalculateAll(miktar, ayar, maliyetIscilik, maliyetIscilikParaKodu, maliyetIscilikBirim, satisIscilik, kurRef, { hasKuru1: chosen });
          } else if (showKurLookup === "hasSatis") {
            const chosen = (it.efektifSatis !== undefined && it.efektifSatis !== null && Number(it.efektifSatis) > 0)
              ? it.efektifSatis
              : (it.dovizSatis || it.efektifAlis || it.dovizAlis || 0);
            setHasKuru2(chosen);
            recalculateAll(miktar, ayar, maliyetIscilik, maliyetIscilikParaKodu, maliyetIscilikBirim, satisIscilik, kurRef, { hasKuru2: chosen });
          } else if (showKurLookup === "usdAlis") {
            const chosen = (it.efektifAlis !== undefined && it.efektifAlis !== null && Number(it.efektifAlis) > 0)
              ? it.efektifAlis
              : (it.dovizAlis || it.efektifSatis || it.dovizSatis || 0);
            setUsdKuru1(chosen);
            recalculateAll(miktar, ayar, maliyetIscilik, maliyetIscilikParaKodu, maliyetIscilikBirim, satisIscilik, kurRef, { usdKuru1: chosen });
          } else if (showKurLookup === "usdSatis") {
            const chosen = (it.efektifSatis !== undefined && it.efektifSatis !== null && Number(it.efektifSatis) > 0)
              ? it.efektifSatis
              : (it.dovizSatis || it.efektifAlis || it.dovizAlis || 0);
            setUsdKuru2(chosen);
            recalculateAll(miktar, ayar, maliyetIscilik, maliyetIscilikParaKodu, maliyetIscilikBirim, satisIscilik, kurRef, { usdKuru2: chosen });
          } else if (showKurLookup === "maliyet") {
            setMaliyetParaKodu(kod);
            recalculateAll(miktar, ayar, maliyetIscilik, maliyetIscilikParaKodu, maliyetIscilikBirim, satisIscilik, kurRef, { maliyetPara: kod });
          } else if (showKurLookup === "satis") {
            setSatisParaKodu(kod);
            recalculateAll(miktar, ayar, maliyetIscilik, maliyetIscilikParaKodu, maliyetIscilikBirim, satisIscilik, kurRef, { satisPara: kod });
          } else if (showKurLookup === "iscilik") {
            setMaliyetIscilikParaKodu(kod);
            recalculateAll(miktar, ayar, maliyetIscilik, kod, maliyetIscilikBirim, satisIscilik, kurRef);
          }
          setShowKurLookup(null);
        }}
        onHide={() => setShowKurLookup(null)}
      />

      {/* ─── MODAL 6: Silme Onayı ─── */}
      <Modal show={showDeleteConfirm} onHide={() => setShowDeleteConfirm(false)} centered size="sm">
        <Modal.Header closeButton className="bg-danger text-white py-2 px-3">
          <Modal.Title className="fs-6 fw-bold">Kayıt Silme Onayı</Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3 text-center">
          <IconAlertTriangle size={36} className="text-danger mb-2" />
          <p className="mb-0">
            <strong>{grupKodu}-{urunNo}</strong> numaralı altın ürün kaydını silmek istediğinize emin misiniz?
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

      {/* ─── MODAL 7: Barkod Etiket Yazdırma ─── */}
      <EtiketYazdirModal
        show={showPrintModal}
        onHide={() => setShowPrintModal(false)}
        title="Barkod Etiketi Basımı"
        sablon={varsayilanSablon}
        items={printItems}
        yazicilar={yaziciList}
        onAfterPrint={async () => {
          if (altinUrunId) {
            await EtiketService.markAltinUrunYazdirildi([altinUrunId], true);
            showNotif("success", "Etiket yazdırıldı olarak işaretlendi.");
          }
        }}
      />

      {/* ─── MODAL 8: Sayfa Ortası Bildirim Pop-up (Modal) ─── */}
      <Modal
        show={Boolean(modalNotif)}
        onHide={() => setModalNotif(null)}
        centered
        size="sm"
        backdrop="static"
      >
        <Modal.Header
          closeButton
          className={`py-2 px-3 text-white ${
            modalNotif?.type === "success"
              ? "bg-success"
              : modalNotif?.type === "danger"
              ? "bg-danger"
              : "bg-warning"
          }`}
        >
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2">
            {modalNotif?.type === "success" && <IconCheck size={18} />}
            {modalNotif?.type === "danger" && <IconAlertTriangle size={18} />}
            {modalNotif?.type === "warning" && <IconAlertTriangle size={18} />}
            <span>
              {modalNotif?.type === "success"
                ? "İşlem Başarılı"
                : modalNotif?.type === "danger"
                ? "Hata"
                : "Bilgi / Uyarı"}
            </span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3 text-center">
          <p className="mb-0 fw-medium text-dark" style={{ fontSize: "13px" }}>
            {modalNotif?.message}
          </p>
        </Modal.Body>
        <Modal.Footer className="py-2 px-3 justify-content-center bg-light border-top">
          <Button
            variant={
              modalNotif?.type === "success"
                ? "success"
                : modalNotif?.type === "danger"
                ? "danger"
                : "primary"
            }
            size="sm"
            className="px-4 fw-semibold"
            onClick={() => setModalNotif(null)}
          >
            Tamam
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ─── MODAL 9: Canlı Kamera ile Fotoğraf Çekme Modalı ─── */}
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
            <span>Kamera ile Ürün Fotoğrafı Çek</span>
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
              <span className="text-secondary small">{model || "Altın Ürün"}</span>
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
                alt="Büyük Ürün Fotoğrafı"
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
                alt="Büyük Ürün Fotoğrafı"
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

export default AltinUrunTanimlamaPage;
