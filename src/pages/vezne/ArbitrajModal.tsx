import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Modal, Row, Col, Card, Form, Button, Badge, InputGroup, Alert } from "react-bootstrap";
import {
  IconArrowsExchange,
  IconCheck,
  IconX,
  IconArrowRight,
  IconArrowLeft,
  IconReceipt,
  IconBinoculars,
} from "@tabler/icons-react";
import LookupModal, { LookupColumn } from "../../components/common/LookupModal";
import { KurRowItem } from "../../services/kurService";
import { CariKartItem } from "../../services/cariService";
import { DovizFisService } from "../../services/dovizFisService";

export interface ArbitrajCurrencyItem {
  id: number;
  kod: string;
  ad: string;
  isMaden?: boolean;
  milyem?: number;
  dovizAlis?: number;
  dovizSatis?: number;
  efektifAlis?: number;
  efektifSatis?: number;
  parite?: number;
}

export interface ArbitrajApplyResult {
  islemYonu: "alis" | "satis"; // "alis": Müşteriden alıyoruz, "satis": Müşteriye satıyoruz
  girisPara: ArbitrajCurrencyItem;
  girisMiktar: number;
  girisKur: number;
  cikisPara: ArbitrajCurrencyItem;
  cikisMiktar: number;
  cikisKur: number;
  parite: number;
  pariteYonu: "carp" | "bol";
  aciklama: string;
  cariId: number | null;
  cariUnvan: string;
}

interface ArbitrajModalProps {
  show: boolean;
  onClose: () => void;
  fisTip?: number; // 0: Alış fişi (Modal sadece Satış Arbitrajı), 1: Satış fişi (Modal sadece Alış Arbitrajı)
  paralar?: ArbitrajCurrencyItem[];
  kurSatirlar?: KurRowItem[];
  urunler?: any[];
  vezneId?: number;
  vezneKod?: string;
  vezneAd?: string;
  selectedCariId?: number | null;
  selectedUnvan?: string;
  cariList?: CariKartItem[];
  pageType: "doviz" | "sarraf";
  onApplyToFis?: (result: ArbitrajApplyResult) => void;
  onSaveDirect?: (result: ArbitrajApplyResult) => Promise<boolean | void>;
  kurKurusSayisi?: number;
  dovizKurusSayisi?: number;
  tlKurusSayisi?: number;
}

export const ArbitrajModal: React.FC<ArbitrajModalProps> = ({
  show,
  onClose,
  fisTip = 0,
  paralar = [],
  kurSatirlar = [],
  urunler = [],
  vezneId = 1,
  vezneKod = "VZN01",
  vezneAd = "Ana Vezne",
  selectedCariId = null,
  selectedUnvan = "Genel Müşteri",
  cariList = [],
  pageType,
  onApplyToFis,
  onSaveDirect,
  kurKurusSayisi = 6,
  dovizKurusSayisi = 2,
  tlKurusSayisi = 2,
}) => {
  // Alış Fişi seçili ise -> Sadece Arbitraj Satış; Satış Fişi seçili ise -> Sadece Arbitraj Alış
  const targetIslemYonu: "alis" | "satis" = fisTip === 0 ? "satis" : "alis";

  // ─── State ─────────────────────────────────────────────────────────────
  const [islemYonu, setIslemYonu] = useState<"alis" | "satis">(targetIslemYonu);
  const [girisKod, setGirisKod] = useState<string>("EUR");
  const [cikisKod, setCikisKod] = useState<string>("USD");
  const [girisMiktarStr, setGirisMiktarStr] = useState<string>("1000");
  const [cikisMiktarStr, setCikisMiktarStr] = useState<string>("");
  const [pariteStr, setPariteStr] = useState<string>("1.085000");
  const [pariteYonu, setPariteYonu] = useState<"carp" | "bol">("carp"); // carp: Çıkış = Giriş * Parite, bol: Çıkış = Giriş / Parite
  const [aciklama, setAciklama] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "danger"; text: string } | null>(null);

  // Lookups
  const [showGirisLookup, setShowGirisLookup] = useState<boolean>(false);
  const [showCikisLookup, setShowCikisLookup] = useState<boolean>(false);

  // Active editing source to avoid calculation loops ("giris" | "cikis" | "parite")
  const lastEditedField = useRef<"giris" | "cikis" | "parite">("giris");

  // Input refs
  const girisKodInputRef = useRef<HTMLInputElement | null>(null);
  const girisMiktarInputRef = useRef<HTMLInputElement | null>(null);
  const cikisKodInputRef = useRef<HTMLInputElement | null>(null);
  const cikisMiktarInputRef = useRef<HTMLInputElement | null>(null);
  const pariteInputRef = useRef<HTMLInputElement | null>(null);
  const aciklamaInputRef = useRef<HTMLInputElement | null>(null);

  const focusInput = (ref: React.RefObject<HTMLInputElement | null>) => {
    if (ref.current) {
      ref.current.focus();
      ref.current.select();
    }
  };

  // ─── Combine FX Currencies and Gold/Metal items into a rich list ────────
  const combinedItems = useMemo<ArbitrajCurrencyItem[]>(() => {
    const list: ArbitrajCurrencyItem[] = [];

    // Add Paralar (USD, EUR, GBP, CHF, TRY, etc.)
    paralar.forEach((p) => {
      if (!list.some((x) => x.kod.toUpperCase() === p.kod.toUpperCase())) {
        list.push({
          id: p.id,
          kod: p.kod,
          ad: p.ad || p.kod,
          isMaden: false,
          dovizAlis: p.dovizAlis,
          dovizSatis: p.dovizSatis,
          efektifAlis: p.efektifAlis,
          efektifSatis: p.efektifSatis,
          parite: p.parite,
        });
      }
    });

    // If kurSatirlar has items not in paralar, add them
    kurSatirlar.forEach((k) => {
      if (!list.some((x) => x.kod.toUpperCase() === k.kod.toUpperCase())) {
        list.push({
          id: k.paraId,
          kod: k.kod,
          ad: k.ad || k.kod,
          isMaden: false,
          dovizAlis: k.dovizAlis ?? undefined,
          dovizSatis: k.dovizSatis ?? undefined,
          efektifAlis: k.efektifAlis ?? undefined,
          efektifSatis: k.efektifSatis ?? undefined,
          parite: k.parite ?? undefined,
        });
      }
    });

    // Add Gold / Metal items (HAS, 22K, 14K, etc.)
    if (urunler && urunler.length > 0) {
      urunler.forEach((u) => {
        const kodUpper = (u.kod || "").toUpperCase();
        if (!list.some((x) => x.kod.toUpperCase() === kodUpper)) {
          list.push({
            id: u.id || u.urunId || 9999,
            kod: u.kod || "HAS",
            ad: u.ad || "Has Altın",
            isMaden: true,
            milyem: u.hasOrani || u.alisMilyem || 1000,
            dovizAlis: u.alisFiyati,
            dovizSatis: u.satisFiyati,
          });
        }
      });
    }

    // Default ensure HAS Altın is available if not present
    if (!list.some((x) => x.kod.toUpperCase() === "HAS" || x.kod.toUpperCase() === "ALTIN")) {
      list.push({
        id: 9901,
        kod: "HAS",
        ad: "Has Altın (GR)",
        isMaden: true,
        milyem: 1000,
      });
    }

    // Default fallback currencies if empty
    if (!list.some((x) => x.kod.toUpperCase() === "USD")) {
      list.push({ id: 1, kod: "USD", ad: "Amerikan Doları", isMaden: false });
    }
    if (!list.some((x) => x.kod.toUpperCase() === "EUR")) {
      list.push({ id: 2, kod: "EUR", ad: "Euro", isMaden: false });
    }
    if (!list.some((x) => x.kod.toUpperCase() === "TL" || x.kod.toUpperCase() === "TRY")) {
      list.push({ id: 0, kod: "TL", ad: "Türk Lirası", isMaden: false });
    }

    return list;
  }, [paralar, kurSatirlar, urunler]);

  // Selected items
  const selectedGirisItem = useMemo(() => {
    return (
      combinedItems.find((c) => c.kod.toUpperCase() === girisKod.toUpperCase().trim()) ||
      combinedItems[0] || { id: 1, kod: "EUR", ad: "Euro", isMaden: false }
    );
  }, [combinedItems, girisKod]);

  const selectedCikisItem = useMemo(() => {
    return (
      combinedItems.find((c) => c.kod.toUpperCase() === cikisKod.toUpperCase().trim()) ||
      combinedItems[1] || { id: 2, kod: "USD", ad: "Amerikan Doları", isMaden: false }
    );
  }, [combinedItems, cikisKod]);

  // Number parser
  const parseNum = (val: string): number => {
    if (!val) return 0;
    const clean = String(val).replace(/\s/g, "").replace(/,/g, ".");
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  };

  // Helper to find live parity between two units
  const calculateMarketParity = useCallback(
    (sourceKod: string, targetKod: string): { parity: number; calcType: "carp" | "bol" } => {
      const src = sourceKod.toUpperCase().trim();
      const tgt = targetKod.toUpperCase().trim();

      if (src === tgt) return { parity: 1.0, calcType: "carp" };

      const srcKur = kurSatirlar.find((k) => k.kod.toUpperCase() === src);
      const tgtKur = kurSatirlar.find((k) => k.kod.toUpperCase() === tgt);

      // EUR vs USD
      if (src === "EUR" && tgt === "USD") {
        if (srcKur?.parite && srcKur.parite > 0) return { parity: srcKur.parite, calcType: "carp" };
        if (srcKur?.efektifAlis && tgtKur?.efektifAlis && tgtKur.efektifAlis > 0) {
          return { parity: srcKur.efektifAlis / tgtKur.efektifAlis, calcType: "carp" };
        }
        return { parity: 1.085, calcType: "carp" };
      }
      if (src === "USD" && tgt === "EUR") {
        if (srcKur?.parite && srcKur.parite > 0) return { parity: 1 / srcKur.parite, calcType: "carp" };
        if (srcKur?.efektifAlis && tgtKur?.efektifAlis && tgtKur.efektifAlis > 0) {
          return { parity: srcKur.efektifAlis / tgtKur.efektifAlis, calcType: "carp" };
        }
        return { parity: 1 / 1.085, calcType: "carp" };
      }

      // GBP vs USD
      if (src === "GBP" && tgt === "USD") {
        if (srcKur?.parite && srcKur.parite > 0) return { parity: srcKur.parite, calcType: "carp" };
        return { parity: 1.285, calcType: "carp" };
      }
      if (src === "USD" && tgt === "GBP") {
        return { parity: 1 / 1.285, calcType: "carp" };
      }

      // HAS Altın vs USD ($/gr)
      if (src === "HAS" && tgt === "USD") {
        return { parity: 85.0, calcType: "carp" };
      }
      if (src === "USD" && tgt === "HAS") {
        return { parity: 85.0, calcType: "bol" };
      }

      // HAS Altın vs EUR (€/gr)
      if (src === "HAS" && tgt === "EUR") {
        return { parity: 78.5, calcType: "carp" };
      }
      if (src === "EUR" && tgt === "HAS") {
        return { parity: 78.5, calcType: "bol" };
      }

      // General fallback via TL rates
      const srcRate =
        src === "TL" || src === "TRY"
          ? 1
          : (srcKur?.efektifAlis || srcKur?.dovizAlis || (src === "USD" ? 34.2 : src === "EUR" ? 37.1 : 1));
      const tgtRate =
        tgt === "TL" || tgt === "TRY"
          ? 1
          : (tgtKur?.efektifAlis || tgtKur?.dovizAlis || (tgt === "USD" ? 34.2 : tgt === "EUR" ? 37.1 : 1));

      if (tgtRate > 0) {
        return { parity: srcRate / tgtRate, calcType: "carp" };
      }

      return { parity: 1.0, calcType: "carp" };
    },
    [kurSatirlar]
  );

  // Recalculate amounts based on current parite and lastEditedField
  const refreshCalculations = useCallback(
    (
      gValStr: string,
      cValStr: string,
      pValStr: string,
      pDir: "carp" | "bol",
      sourceField: "giris" | "cikis" | "parite"
    ) => {
      const gNum = parseNum(gValStr);
      const cNum = parseNum(cValStr);
      const pNum = parseNum(pValStr);

      if (sourceField === "giris" || sourceField === "parite") {
        if (pNum > 0) {
          const calculatedCikis = pDir === "carp" ? gNum * pNum : gNum / pNum;
          setCikisMiktarStr(
            calculatedCikis > 0
              ? calculatedCikis.toFixed(selectedCikisItem.isMaden ? 3 : dovizKurusSayisi)
              : ""
          );
        }
      } else if (sourceField === "cikis") {
        if (pNum > 0) {
          const calculatedGiris = pDir === "carp" ? cNum / pNum : cNum * pNum;
          setGirisMiktarStr(
            calculatedGiris > 0
              ? calculatedGiris.toFixed(selectedGirisItem.isMaden ? 3 : dovizKurusSayisi)
              : ""
          );
        }
      }
    },
    [dovizKurusSayisi, selectedCikisItem.isMaden, selectedGirisItem.isMaden]
  );

  // Modal open initialization (only runs once on open)
  const prevShowRef = useRef<boolean>(false);
  useEffect(() => {
    if (show && !prevShowRef.current) {
      setSaveMessage(null);
      setIsSaving(false);
      const determinedYonu = fisTip === 0 ? "satis" : "alis";
      setIslemYonu(determinedYonu);

      // Default currencies based on direction and page
      const defaultGiris = pageType === "sarraf" ? (determinedYonu === "satis" ? "USD" : "HAS") : "EUR";
      const defaultCikis = pageType === "sarraf" ? (determinedYonu === "satis" ? "HAS" : "USD") : "USD";
      setGirisKod(defaultGiris);
      setCikisKod(defaultCikis);
      setGirisMiktarStr(pageType === "sarraf" ? (determinedYonu === "satis" ? "8500" : "100") : "1000");

      const { parity, calcType } = calculateMarketParity(defaultGiris, defaultCikis);
      setPariteStr(parity.toFixed(kurKurusSayisi));
      setPariteYonu(calcType);
      setAciklama(`${defaultGiris}/${defaultCikis} Arbitraj`);

      lastEditedField.current = "giris";
      const gMiktar = pageType === "sarraf" ? (determinedYonu === "satis" ? 8500 : 100) : 1000;
      const calculatedC = calcType === "carp" ? gMiktar * parity : gMiktar / parity;
      setCikisMiktarStr(calculatedC.toFixed(dovizKurusSayisi));

      setTimeout(() => {
        focusInput(girisMiktarInputRef);
      }, 100);
    }
    prevShowRef.current = show;
  }, [show, fisTip, pageType, calculateMarketParity, kurKurusSayisi, dovizKurusSayisi]);

  // Swap currencies (Giriş <-> Çıkış)
  const handleSwapCurrencies = () => {
    const oldGiris = girisKod;
    const oldCikis = cikisKod;
    setGirisKod(oldCikis);
    setCikisKod(oldGiris);

    const { parity, calcType } = calculateMarketParity(oldCikis, oldGiris);
    setPariteStr(parity.toFixed(kurKurusSayisi));
    setPariteYonu(calcType);
    setAciklama(`${oldCikis}/${oldGiris} Arbitraj`);

    lastEditedField.current = "giris";
    refreshCalculations(girisMiktarStr, cikisMiktarStr, parity.toFixed(kurKurusSayisi), calcType, "giris");
  };

  // Quick preset selection
  const handlePresetSelect = (src: string, tgt: string) => {
    setGirisKod(src);
    setCikisKod(tgt);
    const { parity, calcType } = calculateMarketParity(src, tgt);
    setPariteStr(parity.toFixed(kurKurusSayisi));
    setPariteYonu(calcType);
    setAciklama(`${src}/${tgt} Arbitraj`);

    lastEditedField.current = "giris";
    refreshCalculations(girisMiktarStr, cikisMiktarStr, parity.toFixed(kurKurusSayisi), calcType, "giris");
  };

  // Handlers for inputs
  const handleGirisCodeChange = (val: string) => {
    const code = val.toUpperCase().trim();
    setGirisKod(code);
    const { parity, calcType } = calculateMarketParity(code, cikisKod);
    setPariteStr(parity.toFixed(kurKurusSayisi));
    setPariteYonu(calcType);
    refreshCalculations(girisMiktarStr, cikisMiktarStr, parity.toFixed(kurKurusSayisi), calcType, "giris");
  };

  const handleCikisCodeChange = (val: string) => {
    const code = val.toUpperCase().trim();
    setCikisKod(code);
    const { parity, calcType } = calculateMarketParity(girisKod, code);
    setPariteStr(parity.toFixed(kurKurusSayisi));
    setPariteYonu(calcType);
    refreshCalculations(girisMiktarStr, cikisMiktarStr, parity.toFixed(kurKurusSayisi), calcType, "giris");
  };

  const handleGirisAmountChange = (val: string) => {
    setGirisMiktarStr(val);
    lastEditedField.current = "giris";
    refreshCalculations(val, cikisMiktarStr, pariteStr, pariteYonu, "giris");
  };

  const handleCikisAmountChange = (val: string) => {
    setCikisMiktarStr(val);
    lastEditedField.current = "cikis";
    refreshCalculations(girisMiktarStr, val, pariteStr, pariteYonu, "cikis");
  };

  const handlePariteChange = (val: string) => {
    setPariteStr(val);
    lastEditedField.current = "parite";
    refreshCalculations(girisMiktarStr, cikisMiktarStr, val, pariteYonu, "parite");
  };

  // Keyboard shortcut inside modal (ESC, F1, Enter)
  useEffect(() => {
    if (!show || showGirisLookup || showCikisLookup) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === "F1") {
        e.preventDefault();
        e.stopPropagation();
        handleApplyToFis();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [show, showGirisLookup, showCikisLookup, onClose]);

  // Values as numbers
  const girisMiktarNum = parseNum(girisMiktarStr);
  const cikisMiktarNum = parseNum(cikisMiktarStr);
  const pariteNum = parseNum(pariteStr);

  // Apply to Active Page
  const handleApplyToFis = () => {
    if (girisMiktarNum <= 0 || cikisMiktarNum <= 0 || pariteNum <= 0) {
      setSaveMessage({ type: "danger", text: "Lütfen geçerli giriş/çıkış miktarları ve parite giriniz." });
      return;
    }

    const result: ArbitrajApplyResult = {
      islemYonu,
      girisPara: selectedGirisItem,
      girisMiktar: girisMiktarNum,
      girisKur: 1.0,
      cikisPara: selectedCikisItem,
      cikisMiktar: cikisMiktarNum,
      cikisKur: 1.0,
      parite: pariteNum,
      pariteYonu,
      aciklama: aciklama || `${girisKod}/${cikisKod} Arbitraj`,
      cariId: selectedCariId,
      cariUnvan: selectedUnvan,
    };

    if (onApplyToFis) {
      onApplyToFis(result);
      onClose();
    }
  };

  // Direct Save via Service
  const handleDirectSave = async () => {
    if (girisMiktarNum <= 0 || cikisMiktarNum <= 0 || pariteNum <= 0) {
      setSaveMessage({ type: "danger", text: "Lütfen geçerli giriş/çıkış miktarları ve parite giriniz." });
      return;
    }

    const result: ArbitrajApplyResult = {
      islemYonu,
      girisPara: selectedGirisItem,
      girisMiktar: girisMiktarNum,
      girisKur: 1.0,
      cikisPara: selectedCikisItem,
      cikisMiktar: cikisMiktarNum,
      cikisKur: 1.0,
      parite: pariteNum,
      pariteYonu,
      aciklama: aciklama || `${girisKod}/${cikisKod} Arbitraj`,
      cariId: selectedCariId,
      cariUnvan: selectedUnvan,
    };

    setIsSaving(true);
    setSaveMessage(null);
    try {
      if (onSaveDirect) {
        await onSaveDirect(result);
        setSaveMessage({ type: "success", text: "Arbitraj başarıyla kaydedildi!" });
        setTimeout(() => {
          onClose();
        }, 1000);
      } else {
        const today = new Date().toISOString().split("T")[0];
        const nowTime = new Date().toLocaleTimeString("tr-TR", { hour12: false });

        const alisRes = await DovizFisService.saveFis({
          vezneId: vezneId || 1,
          tip: 0,
          tarih: today,
          zaman: nowTime,
          seriNo: "ARB",
          belgeNo: String(Date.now()).slice(-6),
          gelisNedeni: "Arbitraj Alış",
          kurTuru: 0,
          unvan: selectedUnvan || "Genel Müşteri",
          toplamTutar: 0,
          yuvarlama: 0,
          odemeTutari: 0,
          satirlar: [
            {
              satirNo: 1,
              paraId: selectedGirisItem.id,
              paraKodu: selectedGirisItem.kod,
              paraAdi: selectedGirisItem.ad,
              miktar: girisMiktarNum,
              kur: 1.0,
              tutar: girisMiktarNum,
            },
          ],
        });

        const createdAlisId = (alisRes as any)?.fisId || (alisRes as any)?.id || null;
        await DovizFisService.saveFis({
          vezneId: vezneId || 1,
          tip: 1,
          tarih: today,
          zaman: nowTime,
          seriNo: "ARB",
          belgeNo: String(Date.now() + 1).slice(-6),
          gelisNedeni: "Arbitraj Satış",
          kurTuru: 0,
          unvan: selectedUnvan || "Genel Müşteri",
          arbitrajId: createdAlisId,
          toplamTutar: 0,
          yuvarlama: 0,
          odemeTutari: 0,
          satirlar: [
            {
              satirNo: 1,
              paraId: selectedCikisItem.id,
              paraKodu: selectedCikisItem.kod,
              paraAdi: selectedCikisItem.ad,
              miktar: cikisMiktarNum,
              kur: 1.0,
              tutar: cikisMiktarNum,
            },
          ],
        });

        setSaveMessage({ type: "success", text: "Arbitraj fişi kaydedildi!" });
        setTimeout(() => {
          onClose();
        }, 1000);
      }
    } catch (err: any) {
      setSaveMessage({
        type: "danger",
        text: err?.message || "Arbitraj kaydı sırasında hata oluştu.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Lookup Columns
  const lookupColumns: LookupColumn<ArbitrajCurrencyItem>[] = [
    { header: "Kod", render: (i) => <span className="fw-bold font-monospace">{i.kod}</span>, width: "90px" },
    { header: "Ad / Tanım", render: (i) => i.ad },
    {
      header: "Tür",
      render: (i) => (
        <Badge bg={i.isMaden ? "warning" : "info"} className="text-dark">
          {i.isMaden ? "Maden" : "Döviz"}
        </Badge>
      ),
      width: "75px",
    },
    {
      header: "Alış",
      render: (i) => (i.efektifAlis || i.dovizAlis ? Number(i.efektifAlis || i.dovizAlis).toLocaleString("tr-TR", { minimumFractionDigits: 2 }) : "-"),
      width: "95px",
      align: "right",
    },
    {
      header: "Satış",
      render: (i) => (i.efektifSatis || i.dovizSatis ? Number(i.efektifSatis || i.dovizSatis).toLocaleString("tr-TR", { minimumFractionDigits: 2 }) : "-"),
      width: "95px",
      align: "right",
    },
  ];

  return (
    <>
      <Modal
        show={show}
        onHide={onClose}
        size="lg"
        centered
        backdrop="static"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <Modal.Header
          closeButton
          className="py-2 px-3 text-white border-0"
          style={{
            background:
              islemYonu === "satis"
                ? "linear-gradient(135deg, #065f46 0%, #047857 100%)"
                : "linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%)",
          }}
        >
          <div className="d-flex align-items-center gap-2">
            <IconArrowsExchange size={20} />
            <Modal.Title className="fs-6 fw-bold text-white mb-0 d-flex align-items-center gap-2">
              Arbitraj İşlemi
              <Badge bg="light" className={islemYonu === "satis" ? "text-success fw-bold" : "text-primary fw-bold"}>
                {islemYonu === "satis" ? "Arbitraj Satış" : "Arbitraj Alış"}
              </Badge>
              <Badge bg="dark" className="text-white px-2 py-0.5 font-monospace" style={{ fontSize: "11px" }}>
                F7
              </Badge>
            </Modal.Title>
          </div>
        </Modal.Header>

        <Modal.Body className="p-3 bg-light" style={{ fontSize: "13px" }}>
          {saveMessage && (
            <Alert variant={saveMessage.type} className="py-2 px-3 mb-2 small d-flex align-items-center gap-2">
              {saveMessage.type === "success" ? <IconCheck size={16} /> : <IconX size={16} />}
              <span>{saveMessage.text}</span>
            </Alert>
          )}

          {/* Üst Bilgi Barı: Cari & Vezne */}
          <div className="bg-white p-2 rounded border shadow-2xs mb-2.5">
            <Row className="g-2 align-items-center">
              <Col md={7}>
                <div className="d-flex align-items-center gap-1.5">
                  <span className="small fw-semibold text-secondary text-nowrap">Cari / Müşteri:</span>
                  <Form.Control
                    size="sm"
                    readOnly
                    className="bg-light fw-bold text-truncate"
                    value={selectedUnvan || "Genel Müşteri"}
                  />
                </div>
              </Col>
              <Col md={5}>
                <div className="d-flex align-items-center justify-content-end gap-1.5">
                  <span className="small fw-semibold text-secondary text-nowrap">Vezne:</span>
                  <span className="badge bg-secondary font-monospace">
                    {vezneKod} - {vezneAd}
                  </span>
                </div>
              </Col>
            </Row>
          </div>

          {/* Hızlı Parite Butonları */}
          <div className="d-flex align-items-center gap-1.5 mb-2.5 flex-wrap">
            <Button
              type="button"
              size="sm"
              variant="outline-dark"
              className="px-2 py-0.5 fw-bold"
              style={{ fontSize: "11px" }}
              onClick={() => handlePresetSelect("EUR", "USD")}
            >
              EUR/USD
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline-dark"
              className="px-2 py-0.5 fw-bold"
              style={{ fontSize: "11px" }}
              onClick={() => handlePresetSelect("GBP", "USD")}
            >
              GBP/USD
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline-warning"
              className="px-2 py-0.5 fw-bold text-dark"
              style={{ fontSize: "11px" }}
              onClick={() => handlePresetSelect("HAS", "USD")}
            >
              HAS/USD ($/gr)
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline-warning"
              className="px-2 py-0.5 fw-bold text-dark"
              style={{ fontSize: "11px" }}
              onClick={() => handlePresetSelect("USD", "HAS")}
            >
              USD/HAS
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline-warning"
              className="px-2 py-0.5 fw-bold text-dark"
              style={{ fontSize: "11px" }}
              onClick={() => handlePresetSelect("HAS", "EUR")}
            >
              HAS/EUR (€/gr)
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline-secondary"
              className="px-2 py-0.5 fw-bold ms-auto d-flex align-items-center gap-1"
              style={{ fontSize: "11px" }}
              onClick={handleSwapCurrencies}
              title="Giriş ve Çıkış Birimlerini Yer Değiştir"
            >
              <IconArrowsExchange size={14} /> Takas Et (⇄)
            </Button>
          </div>

          {/* Ana Çift Bacak Kartları */}
          <Row className="g-2.5 align-items-stretch">
            {/* Giriş Bacağı */}
            <Col md={5}>
              <Card className="h-100 border-success shadow-2xs" style={{ backgroundColor: "#f0fdf4" }}>
                <Card.Header
                  className="py-1 px-2.5 text-white d-flex align-items-center justify-content-between"
                  style={{ backgroundColor: "#16a34a" }}
                >
                  <span className="fw-bold small d-flex align-items-center gap-1">
                    <IconArrowRight size={15} /> GİRİŞ (Kasaya Giren)
                  </span>
                  <span className="badge bg-light text-success fw-bold">+ Borç</span>
                </Card.Header>
                <Card.Body className="p-2.5">
                  {/* Para / Maden Kodu Input + Dürbün */}
                  <div className="mb-2">
                    <label className="small fw-semibold text-secondary mb-1">Para / Maden Kodu</label>
                    <InputGroup size="sm">
                      <Form.Control
                        ref={girisKodInputRef}
                        type="text"
                        className="fw-bold font-monospace text-uppercase"
                        value={girisKod}
                        placeholder="Örn: USD, EUR, HAS"
                        onChange={(e) => handleGirisCodeChange(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const match = combinedItems.find(
                              (c) => c.kod.toUpperCase() === girisKod.toUpperCase().trim()
                            );
                            if (match) {
                              focusInput(girisMiktarInputRef);
                            } else {
                              setShowGirisLookup(true);
                            }
                          } else if (e.key === "F4") {
                            e.preventDefault();
                            setShowGirisLookup(true);
                          } else if (e.key === "ArrowDown") {
                            e.preventDefault();
                            focusInput(girisMiktarInputRef);
                          } else if (e.key === "ArrowRight") {
                            e.preventDefault();
                            focusInput(pariteInputRef);
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline-secondary"
                        onClick={() => setShowGirisLookup(true)}
                        title="Para / Maden Ara (Dürbün - F4)"
                      >
                        <IconBinoculars size={14} />
                      </Button>
                    </InputGroup>
                    <div className="small text-muted mt-0.5 text-truncate" style={{ fontSize: "11px" }}>
                      {selectedGirisItem.ad}
                    </div>
                  </div>

                  <div>
                    <label className="small fw-bold text-success mb-1">Giriş Miktarı</label>
                    <InputGroup size="sm">
                      <Form.Control
                        ref={girisMiktarInputRef}
                        type="text"
                        className="font-monospace fw-bold text-end fs-6 text-success bg-white border-success"
                        value={girisMiktarStr}
                        onChange={(e) => handleGirisAmountChange(e.target.value)}
                        placeholder="0.00"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            focusInput(pariteInputRef);
                          } else if (e.key === "ArrowUp") {
                            e.preventDefault();
                            focusInput(girisKodInputRef);
                          } else if (e.key === "ArrowDown") {
                            e.preventDefault();
                            focusInput(aciklamaInputRef);
                          } else if (e.key === "ArrowRight") {
                            e.preventDefault();
                            focusInput(pariteInputRef);
                          }
                        }}
                      />
                      <InputGroup.Text className="fw-bold bg-success text-white">
                        {selectedGirisItem.kod}
                      </InputGroup.Text>
                    </InputGroup>
                  </div>
                </Card.Body>
              </Card>
            </Col>

            {/* Orta Parite & Yön Alanı */}
            <Col md={2} className="d-flex flex-column justify-content-center align-items-center">
              <div className="w-100 p-2 text-center bg-white rounded border shadow-2xs">
                <span className="small fw-bold text-primary d-block mb-1">Parite</span>
                <Form.Control
                  ref={pariteInputRef}
                  size="sm"
                  type="text"
                  className="font-monospace fw-bold text-center text-primary border-primary mb-1"
                  value={pariteStr}
                  onChange={(e) => handlePariteChange(e.target.value)}
                  placeholder="1.000000"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      focusInput(cikisMiktarInputRef);
                    } else if (e.key === "ArrowLeft") {
                      e.preventDefault();
                      focusInput(girisMiktarInputRef);
                    } else if (e.key === "ArrowRight") {
                      e.preventDefault();
                      focusInput(cikisKodInputRef);
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      focusInput(girisKodInputRef);
                    } else if (e.key === "ArrowDown") {
                      e.preventDefault();
                      focusInput(cikisMiktarInputRef);
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline-primary"
                  className="w-100 py-0.5"
                  style={{ fontSize: "10.5px" }}
                  onClick={() => {
                    const newDir = pariteYonu === "carp" ? "bol" : "carp";
                    setPariteYonu(newDir);
                    refreshCalculations(girisMiktarStr, cikisMiktarStr, pariteStr, newDir, "giris");
                  }}
                >
                  {pariteYonu === "carp" ? "Çarpım (×)" : "Bölüm (÷)"}
                </Button>
              </div>
            </Col>

            {/* Çıkış Bacağı */}
            <Col md={5}>
              <Card className="h-100 border-danger shadow-2xs" style={{ backgroundColor: "#fff5f5" }}>
                <Card.Header
                  className="py-1 px-2.5 text-white d-flex align-items-center justify-content-between"
                  style={{ backgroundColor: "#dc2626" }}
                >
                  <span className="fw-bold small d-flex align-items-center gap-1">
                    <IconArrowLeft size={15} /> ÇIKIŞ (Kasadan Çıkan)
                  </span>
                  <span className="badge bg-light text-danger fw-bold">- Alacak</span>
                </Card.Header>
                <Card.Body className="p-2.5">
                  {/* Para / Maden Kodu Input + Dürbün */}
                  <div className="mb-2">
                    <label className="small fw-semibold text-secondary mb-1">Para / Maden Kodu</label>
                    <InputGroup size="sm">
                      <Form.Control
                        ref={cikisKodInputRef}
                        type="text"
                        className="fw-bold font-monospace text-uppercase"
                        value={cikisKod}
                        placeholder="Örn: USD, EUR, HAS"
                        onChange={(e) => handleCikisCodeChange(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const match = combinedItems.find(
                              (c) => c.kod.toUpperCase() === cikisKod.toUpperCase().trim()
                            );
                            if (match) {
                              focusInput(cikisMiktarInputRef);
                            } else {
                              setShowCikisLookup(true);
                            }
                          } else if (e.key === "F4") {
                            e.preventDefault();
                            setShowCikisLookup(true);
                          } else if (e.key === "ArrowLeft") {
                            e.preventDefault();
                            focusInput(pariteInputRef);
                          } else if (e.key === "ArrowDown") {
                            e.preventDefault();
                            focusInput(cikisMiktarInputRef);
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline-secondary"
                        onClick={() => setShowCikisLookup(true)}
                        title="Para / Maden Ara (Dürbün - F4)"
                      >
                        <IconBinoculars size={14} />
                      </Button>
                    </InputGroup>
                    <div className="small text-muted mt-0.5 text-truncate" style={{ fontSize: "11px" }}>
                      {selectedCikisItem.ad}
                    </div>
                  </div>

                  <div>
                    <label className="small fw-bold text-danger mb-1">Çıkış Miktarı</label>
                    <InputGroup size="sm">
                      <Form.Control
                        ref={cikisMiktarInputRef}
                        type="text"
                        className="font-monospace fw-bold text-end fs-6 text-danger bg-white border-danger"
                        value={cikisMiktarStr}
                        onChange={(e) => handleCikisAmountChange(e.target.value)}
                        placeholder="0.00"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            focusInput(aciklamaInputRef);
                          } else if (e.key === "ArrowUp") {
                            e.preventDefault();
                            focusInput(cikisKodInputRef);
                          } else if (e.key === "ArrowLeft") {
                            e.preventDefault();
                            focusInput(pariteInputRef);
                          } else if (e.key === "ArrowDown") {
                            e.preventDefault();
                            focusInput(aciklamaInputRef);
                          }
                        }}
                      />
                      <InputGroup.Text className="fw-bold bg-danger text-white">
                        {selectedCikisItem.kod}
                      </InputGroup.Text>
                    </InputGroup>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Not / Açıklama */}
          <div className="mt-2.5">
            <Form.Control
              ref={aciklamaInputRef}
              size="sm"
              value={aciklama}
              onChange={(e) => setAciklama(e.target.value)}
              placeholder="Açıklama / Not"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleApplyToFis();
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  focusInput(cikisMiktarInputRef);
                }
              }}
            />
          </div>
        </Modal.Body>

        <Modal.Footer className="py-2 px-3 bg-light d-flex justify-content-between">
          <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={isSaving}>
            <IconX size={15} className="me-1" /> [ESC] Vazgeç
          </Button>

          <div className="d-flex gap-2">
            {onApplyToFis && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                className="fw-bold d-flex align-items-center gap-1"
                onClick={handleApplyToFis}
                disabled={isSaving}
              >
                <IconCheck size={16} /> [F1] Fişe Aktar
              </Button>
            )}

            <Button
              type="button"
              variant="success"
              size="sm"
              className="fw-bold d-flex align-items-center gap-1 shadow-sm"
              onClick={handleDirectSave}
              disabled={isSaving}
            >
              <IconReceipt size={16} /> {isSaving ? "Kaydediliyor..." : "Arbitraj Fişi Kaydet"}
            </Button>
          </div>
        </Modal.Footer>
      </Modal>

      {/* Giriş Bacağı Para/Maden Seçim Lookup Modalı */}
      <LookupModal
        show={showGirisLookup}
        initialSearchTerm={girisKod}
        onHide={() => {
          setShowGirisLookup(false);
          setTimeout(() => focusInput(girisKodInputRef), 50);
        }}
        title="Giriş Bacağı Para / Maden Seçimi"
        items={combinedItems}
        columns={lookupColumns}
        filterFn={(item, term) =>
          item.kod.toLowerCase().includes(term.toLowerCase()) ||
          item.ad.toLowerCase().includes(term.toLowerCase())
        }
        onSelect={(item) => {
          setGirisKod(item.kod);
          setShowGirisLookup(false);
          const { parity, calcType } = calculateMarketParity(item.kod, cikisKod);
          setPariteStr(parity.toFixed(kurKurusSayisi));
          setPariteYonu(calcType);
          refreshCalculations(girisMiktarStr, cikisMiktarStr, parity.toFixed(kurKurusSayisi), calcType, "giris");
          setTimeout(() => focusInput(girisMiktarInputRef), 100);
        }}
      />

      {/* Çıkış Bacağı Para/Maden Seçim Lookup Modalı */}
      <LookupModal
        show={showCikisLookup}
        initialSearchTerm={cikisKod}
        onHide={() => {
          setShowCikisLookup(false);
          setTimeout(() => focusInput(cikisKodInputRef), 50);
        }}
        title="Çıkış Bacağı Para / Maden Seçimi"
        items={combinedItems}
        columns={lookupColumns}
        filterFn={(item, term) =>
          item.kod.toLowerCase().includes(term.toLowerCase()) ||
          item.ad.toLowerCase().includes(term.toLowerCase())
        }
        onSelect={(item) => {
          setCikisKod(item.kod);
          setShowCikisLookup(false);
          const { parity, calcType } = calculateMarketParity(girisKod, item.kod);
          setPariteStr(parity.toFixed(kurKurusSayisi));
          setPariteYonu(calcType);
          refreshCalculations(girisMiktarStr, cikisMiktarStr, parity.toFixed(kurKurusSayisi), calcType, "giris");
          setTimeout(() => focusInput(cikisMiktarInputRef), 100);
        }}
      />
    </>
  );
};
