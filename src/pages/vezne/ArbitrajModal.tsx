import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Modal, Row, Col, Card, Form, Button, Badge, Table, Alert, InputGroup } from "react-bootstrap";
import {
  IconArrowsExchange,
  IconCheck,
  IconX,
  IconBinoculars,
  IconPlus,
  IconTrash,
  IconDeviceFloppy,
  IconSearch,
} from "@tabler/icons-react";
import { KurRowItem } from "../../services/kurService";
import { CariKartItem, CariService } from "../../services/cariService";
import { StatisticItem, StatisticService } from "../../services/statisticService";

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
  islemYonu: "alis" | "satis";
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
  cariKodu?: string;
  vknTckn?: string;
  istatistikKodu?: string;
}

export interface ArbitrajModalLine {
  id: string;
  satirNo: number;
  paraId: number;
  kod: string;
  ad: string;
  miktar: number | string;
  kur: number | string;
  tutar: number | string;
  isMaden?: boolean;
  milyem?: number;
}

interface ArbitrajModalProps {
  show: boolean;
  onClose: () => void;
  fisTip?: number; // 0: Ana sayfa Alış -> Modal Satış, 1: Ana sayfa Satış -> Modal Alış
  hedefTlTutar?: number; // Ana ekrandaki toplam TL tutarı
  paralar?: ArbitrajCurrencyItem[];
  kurSatirlar?: KurRowItem[];
  urunler?: any[];
  vezneId?: number;
  vezneKod?: string;
  vezneAd?: string;
  selectedCariId?: number | null;
  selectedUnvan?: string;
  selectedCariKod?: string;
  vknTckn?: string;
  istatistikKodu?: string;
  cariList?: CariKartItem[];
  statisticList?: StatisticItem[];
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
  hedefTlTutar = 0,
  paralar = [],
  kurSatirlar = [],
  urunler = [],
  vezneId = 1,
  vezneKod = "00",
  vezneAd = "Ana Kasa",
  selectedCariId = null,
  selectedUnvan = "İSİM BEYAN EDİLMEMİŞTİR",
  selectedCariKod = "",
  vknTckn = "",
  istatistikKodu = "9249",
  cariList = [],
  statisticList = [],
  pageType,
  onApplyToFis,
  onSaveDirect,
  kurKurusSayisi = 4,
  dovizKurusSayisi = 2,
  tlKurusSayisi = 2,
}) => {
  // Alış fişindeyken modal "SATIŞ FİŞİ", Satış fişindeyken modal "ALIŞ FİŞİ" olarak açılır
  const targetIslemYonu: "alis" | "satis" = fisTip === 0 ? "satis" : "alis";

  // Form Header State
  const [islemYonu, setIslemYonu] = useState<"alis" | "satis">(targetIslemYonu);
  const [tarih, setTarih] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [saat, setSaat] = useState<string>(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  });
  const [seriNo, setSeriNo] = useState<string>("ARB");
  const [belgeNo, setBelgeNo] = useState<string>("Otomatik");
  const [gelisNedeni, setGelisNedeni] = useState<string>("Arbitraj");
  const [cariId, setCariId] = useState<number | null>(selectedCariId);
  const [cariKodu, setCariKodu] = useState<string>(selectedCariKod || "");
  const [unvan, setUnvan] = useState<string>(selectedUnvan || "İSİM BEYAN EDİLMEMİŞTİR");
  const [formVknTckn, setFormVknTckn] = useState<string>(vknTckn || "");
  const [kurTuru, setKurTuru] = useState<number>(0); // 0: Efektif, 1: Döviz
  const [istatistikKod, setIstatistikKod] = useState<string>(istatistikKodu || "9249");

  // Lookup lists state (cariler, istatistikler)
  const [localCariList, setLocalCariList] = useState<CariKartItem[]>(cariList);
  const [localStatList, setLocalStatList] = useState<StatisticItem[]>(statisticList);

  // Satırlar Grid State
  const [lines, setLines] = useState<ArbitrajModalLine[]>([]);

  // Lookup Overlay States (Cari, İstatistik, Para/Maden)
  const [lookupType, setLookupType] = useState<"cari" | "istatistik" | "currency" | null>(null);
  const [lookupSearchTerm, setLookupSearchTerm] = useState<string>("");
  const [activeLookupLineId, setActiveLookupLineId] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "danger"; text: string } | null>(null);

  // Parse helper
  const parseNum = (val: number | string | undefined): number => {
    if (val === undefined || val === null || val === "") return 0;
    const clean = String(val).replace(/\s/g, "").replace(/,/g, ".");
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  };

  // Sync / Load Cari list
  useEffect(() => {
    if (cariList && cariList.length > 0) {
      setLocalCariList(cariList);
    } else if (show) {
      CariService.getCariKartlar()
        .then((res) => setLocalCariList(res || []))
        .catch(() => {});
    }
  }, [cariList, show]);

  // Sync / Load Statistic list
  useEffect(() => {
    if (statisticList && statisticList.length > 0) {
      setLocalStatList(statisticList);
    } else if (show) {
      StatisticService.getStatistics()
        .then((res) => setLocalStatList(res || []))
        .catch(() => {});
    }
  }, [statisticList, show]);

  // Combine currencies and products
  const currencyList = useMemo<ArbitrajCurrencyItem[]>(() => {
    const list: ArbitrajCurrencyItem[] = [];

    (paralar || []).forEach((p) => {
      const kod = (p.kod || "").toUpperCase().trim();
      if (kod && kod !== "TL" && kod !== "TRY" && !list.some((x) => x.kod.toUpperCase() === kod)) {
        list.push({
          id: p.id || 1,
          kod: p.kod,
          ad: p.ad || p.kod,
          isMaden: p.isMaden || false,
          milyem: p.milyem || 1000,
          dovizAlis: p.dovizAlis,
          dovizSatis: p.dovizSatis,
          efektifAlis: p.efektifAlis,
          efektifSatis: p.efektifSatis,
          parite: p.parite,
        });
      }
    });

    (kurSatirlar || []).forEach((k) => {
      const kod = (k.kod || "").toUpperCase().trim();
      if (kod && kod !== "TL" && kod !== "TRY" && !list.some((x) => x.kod.toUpperCase() === kod)) {
        list.push({
          id: k.paraId || 1,
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

    (urunler || []).forEach((u) => {
      const kod = (u.kod || "").toUpperCase().trim();
      if (kod && kod !== "TL" && kod !== "TRY" && !list.some((x) => x.kod.toUpperCase() === kod)) {
        list.push({
          id: u.id || u.urunId || 999,
          kod: u.kod,
          ad: u.ad || u.kod,
          isMaden: true,
          milyem: u.hasOrani || u.alisMilyem || 1000,
          dovizAlis: u.alisFiyati,
          dovizSatis: u.satisFiyati,
        });
      }
    });

    if (!list.some((x) => x.kod.toUpperCase() === "EUR")) {
      list.push({ id: 2, kod: "EUR", ad: "EURO", isMaden: false, efektifAlis: 37.1, efektifSatis: 37.5, dovizAlis: 37.05, dovizSatis: 37.55 });
    }
    if (!list.some((x) => x.kod.toUpperCase() === "USD")) {
      list.push({ id: 1, kod: "USD", ad: "AMERİKAN DOLARI", isMaden: false, efektifAlis: 34.1, efektifSatis: 34.5, dovizAlis: 34.05, dovizSatis: 34.55 });
    }
    if (!list.some((x) => x.kod.toUpperCase() === "HAS")) {
      list.push({ id: 99, kod: "HAS", ad: "HAS ALTIN (24 AYAR)", isMaden: true, milyem: 1000, efektifAlis: 3050, efektifSatis: 3080 });
    }

    return list;
  }, [paralar, kurSatirlar, urunler]);

  // Find live rate for currency/item based on direction and kurTuru
  const getRateForItem = useCallback(
    (item: ArbitrajCurrencyItem, direction: "alis" | "satis", currentKurTuru: number = kurTuru): number => {
      const srcKur = (kurSatirlar || []).find((k) => k.kod.toUpperCase() === item.kod.toUpperCase());
      if (direction === "satis") {
        if (currentKurTuru === 1) {
          const rate = srcKur?.dovizSatis || item.dovizSatis || srcKur?.efektifSatis || item.efektifSatis || 0;
          if (Number(rate) > 0) return Number(rate);
        } else {
          const rate = srcKur?.efektifSatis || item.efektifSatis || srcKur?.dovizSatis || item.dovizSatis || 0;
          if (Number(rate) > 0) return Number(rate);
        }
      } else {
        if (currentKurTuru === 1) {
          const rate = srcKur?.dovizAlis || item.dovizAlis || srcKur?.efektifAlis || item.efektifAlis || 0;
          if (Number(rate) > 0) return Number(rate);
        } else {
          const rate = srcKur?.efektifAlis || item.efektifAlis || srcKur?.dovizAlis || item.dovizAlis || 0;
          if (Number(rate) > 0) return Number(rate);
        }
      }
      return 1.0;
    },
    [kurSatirlar, kurTuru]
  );

  // Initialize modal state ONLY when modal transitions from closed to open
  const prevShowRef = useRef(false);
  useEffect(() => {
    if (show && !prevShowRef.current) {
      setSaveMessage(null);
      setIsSaving(false);
      setLookupType(null);
      setLookupSearchTerm("");
      setActiveLookupLineId(null);

      const dir = fisTip === 0 ? "satis" : "alis";
      setIslemYonu(dir);
      setGelisNedeni(dir === "satis" ? "Arbitraj Satış" : "Arbitraj Alış");
      setCariId(selectedCariId);
      setCariKodu(selectedCariKod || "");
      setUnvan(selectedUnvan || "İSİM BEYAN EDİLMEMİŞTİR");
      setFormVknTckn(vknTckn || "");
      setIstatistikKod(istatistikKodu || "9249");

      // Default item
      const defaultItem =
        pageType === "sarraf"
          ? (currencyList.find((c) => c.kod.toUpperCase() === "HAS") || currencyList[0])
          : (currencyList.find((c) => c.kod.toUpperCase() === "EUR") || currencyList[0]);

      if (defaultItem) {
        const rate = getRateForItem(defaultItem, dir, 0);
        const targetTl = Number(hedefTlTutar) > 0 ? Number(hedefTlTutar) : 0;
        const calculatedMiktar = rate > 0 && targetTl > 0 ? targetTl / rate : 100;
        const totalTutar = targetTl > 0 ? targetTl : calculatedMiktar * rate;

        setLines([
          {
            id: String(Date.now()),
            satirNo: 1,
            paraId: defaultItem.id,
            kod: defaultItem.kod,
            ad: defaultItem.ad,
            miktar: calculatedMiktar.toFixed(defaultItem.isMaden ? 3 : dovizKurusSayisi),
            kur: rate.toFixed(kurKurusSayisi),
            tutar: totalTutar.toFixed(tlKurusSayisi),
            isMaden: defaultItem.isMaden,
            milyem: defaultItem.milyem || 1000,
          },
        ]);
      }
    }
    prevShowRef.current = show;
  }, [show, fisTip, hedefTlTutar, selectedCariId, selectedCariKod, selectedUnvan, vknTckn, istatistikKodu, pageType, currencyList, getRateForItem, dovizKurusSayisi, kurKurusSayisi, tlKurusSayisi]);

  // Recalculate rates when kurTuru changes
  const handleKurTuruChange = (newKurTuru: number) => {
    setKurTuru(newKurTuru);
    setLines((prev) =>
      prev.map((l) => {
        const item = currencyList.find((c) => c.kod.toUpperCase() === l.kod.toUpperCase());
        if (!item) return l;
        const rate = getRateForItem(item, islemYonu, newKurTuru);
        const m = parseNum(l.miktar);
        const tutar = m > 0 && rate > 0 ? (m * rate).toFixed(tlKurusSayisi) : l.tutar;
        return {
          ...l,
          kur: rate.toFixed(kurKurusSayisi),
          tutar,
        };
      })
    );
  };

  // Switch direction (Alış <-> Satış)
  const handleToggleIslemYonu = () => {
    const newDir: "alis" | "satis" = islemYonu === "satis" ? "alis" : "satis";
    setIslemYonu(newDir);
    setGelisNedeni(newDir === "satis" ? "Arbitraj Satış" : "Arbitraj Alış");
    setLines((prev) =>
      prev.map((l) => {
        const item = currencyList.find((c) => c.kod.toUpperCase() === l.kod.toUpperCase());
        if (!item) return l;
        const rate = getRateForItem(item, newDir, kurTuru);
        const m = parseNum(l.miktar);
        const tutar = m > 0 && rate > 0 ? (m * rate).toFixed(tlKurusSayisi) : l.tutar;
        return {
          ...l,
          kur: rate.toFixed(kurKurusSayisi),
          tutar,
        };
      })
    );
  };

  // Recalculate a line on field edit
  const handleUpdateLine = (lineId: string, field: "miktar" | "kur" | "tutar" | "kod" | "ad", value: string) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        const updated = { ...l, [field]: value };

        if (field === "kod") {
          const found = currencyList.find((c) => c.kod.toUpperCase() === value.trim().toUpperCase());
          if (found) {
            const rate = getRateForItem(found, islemYonu, kurTuru);
            const targetTl = Number(hedefTlTutar) > 0 ? Number(hedefTlTutar) : parseNum(l.tutar);
            const calcMiktar = rate > 0 && targetTl > 0 ? targetTl / rate : (parseNum(l.miktar) > 0 ? parseNum(l.miktar) : 100);
            const calcTutar = targetTl > 0 ? targetTl : calcMiktar * rate;

            return {
              ...updated,
              paraId: found.id,
              kod: found.kod,
              ad: found.ad,
              kur: rate.toFixed(kurKurusSayisi),
              miktar: calcMiktar.toFixed(found.isMaden ? 3 : dovizKurusSayisi),
              tutar: calcTutar.toFixed(tlKurusSayisi),
              isMaden: found.isMaden,
              milyem: found.milyem || 1000,
            };
          }
          return updated;
        }

        const m = parseNum(field === "miktar" ? value : updated.miktar);
        const k = parseNum(field === "kur" ? value : updated.kur);
        const t = parseNum(field === "tutar" ? value : updated.tutar);

        if (field === "miktar" || field === "kur") {
          if (m > 0 && k > 0) {
            updated.tutar = (m * k).toFixed(tlKurusSayisi);
          }
        } else if (field === "tutar") {
          if (t > 0 && k > 0) {
            updated.miktar = (t / k).toFixed(l.isMaden ? 3 : dovizKurusSayisi);
          }
        }
        return updated;
      })
    );
  };

  // Select currency from lookup for a line
  const handleSelectCurrencyForLine = (lineId: string, item: ArbitrajCurrencyItem) => {
    const rate = getRateForItem(item, islemYonu, kurTuru);
    const targetTl = Number(hedefTlTutar) > 0 ? Number(hedefTlTutar) : 0;

    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        const calcMiktar = rate > 0 && targetTl > 0 ? targetTl / rate : (parseNum(l.miktar) > 0 ? parseNum(l.miktar) : 100);
        const calcTutar = targetTl > 0 ? targetTl : calcMiktar * rate;

        return {
          ...l,
          paraId: item.id,
          kod: item.kod,
          ad: item.ad,
          kur: rate.toFixed(kurKurusSayisi),
          miktar: calcMiktar.toFixed(item.isMaden ? 3 : dovizKurusSayisi),
          tutar: calcTutar.toFixed(tlKurusSayisi),
          isMaden: item.isMaden,
          milyem: item.milyem || 1000,
        };
      })
    );
    setLookupType(null);
    setActiveLookupLineId(null);
  };

  // Cari search and select
  const handleSelectCari = (c: CariKartItem) => {
    setCariId(c.id);
    setCariKodu(c.kod || "");
    setUnvan(c.ad || "");
    setFormVknTckn(c.vergiKimlikNo || "");
    setLookupType(null);
  };

  // Add line
  const handleAddLine = () => {
    const defaultItem = currencyList[0] || { id: 1, kod: "USD", ad: "AMERİKAN DOLARI" };
    const rate = getRateForItem(defaultItem, islemYonu, kurTuru);
    setLines((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        satirNo: prev.length + 1,
        paraId: defaultItem.id,
        kod: defaultItem.kod,
        ad: defaultItem.ad,
        miktar: "0",
        kur: rate.toFixed(kurKurusSayisi),
        tutar: "0.00",
        isMaden: defaultItem.isMaden,
        milyem: defaultItem.milyem || 1000,
      },
    ]);
  };

  // Remove line
  const handleRemoveLine = (lineId: string) => {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((l) => l.id !== lineId).map((l, idx) => ({ ...l, satirNo: idx + 1 })));
  };

  // Grand totals
  const totalTl = useMemo(() => {
    return lines.reduce((sum, l) => sum + parseNum(l.tutar), 0);
  }, [lines]);

  const farkTl = useMemo(() => {
    return Number(hedefTlTutar) > 0 ? Math.round((totalTl - Number(hedefTlTutar)) * 100) / 100 : 0;
  }, [totalTl, hedefTlTutar]);

  // Save / Apply Arbitraj
  const handleSaveArbitraj = async () => {
    if (lines.length === 0 || totalTl <= 0) {
      setSaveMessage({ type: "danger", text: "Lütfen geçerli bir satır ve tutar giriniz." });
      return;
    }

    const firstLine = lines[0];
    const selectedItem = currencyList.find((c) => c.kod.toUpperCase() === firstLine.kod.toUpperCase()) || {
      id: firstLine.paraId,
      kod: firstLine.kod,
      ad: firstLine.ad,
      isMaden: firstLine.isMaden,
      milyem: firstLine.milyem,
    };

    const miktarNum = parseNum(firstLine.miktar);
    const kurNum = parseNum(firstLine.kur);

    const applyResult: ArbitrajApplyResult = {
      islemYonu,
      girisPara: islemYonu === "satis" ? { id: 0, kod: "USD", ad: "Dolar" } : selectedItem,
      girisMiktar: islemYonu === "satis" ? Number(hedefTlTutar) : miktarNum,
      girisKur: islemYonu === "satis" ? 1.0 : kurNum,
      cikisPara: islemYonu === "satis" ? selectedItem : { id: 0, kod: "USD", ad: "Dolar" },
      cikisMiktar: islemYonu === "satis" ? miktarNum : Number(hedefTlTutar),
      cikisKur: islemYonu === "satis" ? kurNum : 1.0,
      parite: kurNum,
      pariteYonu: "carp",
      aciklama: `${gelisNedeni || "Arbitraj"} - ${firstLine.kod}`,
      cariId: cariId,
      cariUnvan: unvan,
      cariKodu: cariKodu,
      vknTckn: formVknTckn,
      istatistikKodu: istatistikKod,
    };

    setIsSaving(true);
    setSaveMessage(null);

    try {
      if (onApplyToFis) {
        onApplyToFis(applyResult);
      }
      if (onSaveDirect) {
        await onSaveDirect(applyResult);
      }
      setSaveMessage({ type: "success", text: "Arbitraj başarıyla oluşturuldu ve aktarıldı!" });
      setTimeout(() => {
        onClose();
      }, 400);
    } catch (err: any) {
      setSaveMessage({ type: "danger", text: err?.message || "Arbitraj kaydedilirken hata oluştu." });
    } finally {
      setIsSaving(false);
    }
  };

  // Keyboard shortcut inside modal (ESC, F1, F10)
  useEffect(() => {
    if (!show || lookupType !== null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === "F1" || e.key === "F10") {
        e.preventDefault();
        e.stopPropagation();
        handleSaveArbitraj();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [show, lookupType, onClose, handleSaveArbitraj]);

  // Filtered Cari items for lookup
  const filteredCariler = useMemo(() => {
    if (!lookupSearchTerm.trim()) return localCariList.slice(0, 100);
    const t = lookupSearchTerm.toLowerCase().trim();
    return localCariList.filter(
      (c) =>
        (c.kod || "").toLowerCase().includes(t) ||
        (c.ad || "").toLowerCase().includes(t) ||
        (c.vergiKimlikNo || "").toLowerCase().includes(t) ||
        (c.telefon || "").toLowerCase().includes(t)
    ).slice(0, 100);
  }, [localCariList, lookupSearchTerm]);

  // Filtered Statistic items for lookup
  const filteredStats = useMemo(() => {
    if (!lookupSearchTerm.trim()) return localStatList.slice(0, 100);
    const t = lookupSearchTerm.toLowerCase().trim();
    return localStatList.filter(
      (s) =>
        (s.kod || "").toLowerCase().includes(t) ||
        ((s as any).aciklama || (s as any).ad || "").toLowerCase().includes(t)
    ).slice(0, 100);
  }, [localStatList, lookupSearchTerm]);

  // Filtered Currency items for lookup
  const filteredCurrencies = useMemo(() => {
    if (!lookupSearchTerm.trim()) return currencyList;
    const t = lookupSearchTerm.toLowerCase().trim();
    return currencyList.filter(
      (c) => (c.kod || "").toLowerCase().includes(t) || (c.ad || "").toLowerCase().includes(t)
    );
  }, [currencyList, lookupSearchTerm]);

  const isSatis = islemYonu === "satis";
  const themeHeaderBg = isSatis
    ? "linear-gradient(135deg, #be123c 0%, #e11d48 100%)"
    : "linear-gradient(135deg, #047857 0%, #059669 100%)";
  const themeFormBg = isSatis ? "#fff1f2" : "#f0fdf4";
  const themeBorderColor = isSatis ? "#fecdd3" : "#bbf7d0";

  return (
    <>
      <Modal
        show={show}
        onHide={onClose}
        size="xl"
        centered
        backdrop="static"
        enforceFocus={false}
        restoreFocus={false}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Başlığı */}
        <Modal.Header
          closeButton
          className="py-2.5 px-3 text-white border-0"
          style={{ background: themeHeaderBg }}
        >
          <div className="d-flex align-items-center justify-content-between w-100 me-2">
            <div className="d-flex align-items-center gap-2">
              <IconArrowsExchange size={22} />
              <Modal.Title className="fs-6 fw-bold text-white mb-0 d-flex align-items-center gap-2">
                <span>E- {pageType === "sarraf" ? "Sarraf" : "Döviz"} Fişi Kayıt</span>
                <Badge
                  bg="light"
                  className={isSatis ? "text-danger fw-extrabold px-2.5 py-1" : "text-success fw-extrabold px-2.5 py-1"}
                  style={{ fontSize: "12px", cursor: "pointer" }}
                  onClick={handleToggleIslemYonu}
                  title="Yönü Değiştirmek İçin Tıklayınız (Alış / Satış)"
                >
                  {isSatis ? "ARBİTRAJ SATIŞ FİŞİ" : "ARBİTRAJ ALIŞ FİŞİ"}
                </Badge>
                <Badge bg="dark" className="text-white px-2 py-0.5 font-monospace" style={{ fontSize: "11px" }}>
                  F7
                </Badge>
              </Modal.Title>
            </div>
            <div className="d-flex align-items-center gap-2 text-white small">
              <span>Vezne: <strong>{vezneKod} - {vezneAd}</strong></span>
              {Number(hedefTlTutar) > 0 && (
                <Badge bg="warning" text="dark" className="fw-bold px-2 py-1">
                  Arka Fiş Tutar: {Number(hedefTlTutar).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL
                </Badge>
              )}
            </div>
          </div>
        </Modal.Header>

        <Modal.Body className="p-3" style={{ fontSize: "12.5px", backgroundColor: themeFormBg, position: "relative" }}>
          {saveMessage && (
            <Alert variant={saveMessage.type} className="py-2 px-3 mb-2 small d-flex align-items-center gap-2">
              {saveMessage.type === "success" ? <IconCheck size={16} /> : <IconX size={16} />}
              <span>{saveMessage.text}</span>
            </Alert>
          )}

          {/* ─── 1. ÜST FORM ALANLARI (TÜM GİRDİLER YAZILABİLİR VE DÜRBÜNLÜ) ──────────────── */}
          <Card className="mb-2.5 shadow-2xs border" style={{ borderColor: themeBorderColor }}>
            <Card.Body className="p-2.5">
              <Row className="g-2">
                {/* 1. Sütun: Tarih/Saat, Geliş Nedeni, Kur Türü */}
                <Col md={4}>
                  <div className="d-flex align-items-center mb-1.5">
                    <span className="small fw-semibold text-secondary text-nowrap" style={{ minWidth: "95px" }}>Tarih / Saat</span>
                    <Form.Control
                      size="sm"
                      type="date"
                      value={tarih}
                      onChange={(e) => setTarih(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                      className="me-1"
                      style={{ fontSize: "12px" }}
                    />
                    <Form.Control
                      size="sm"
                      type="text"
                      value={saat}
                      onChange={(e) => setSaat(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                      style={{ width: "70px", fontSize: "12px" }}
                    />
                  </div>
                  <div className="d-flex align-items-center mb-1.5">
                    <span className="small fw-semibold text-secondary text-nowrap" style={{ minWidth: "95px" }}>Geliş nedeni</span>
                    <Form.Control
                      size="sm"
                      type="text"
                      value={gelisNedeni}
                      onChange={(e) => setGelisNedeni(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                      style={{ fontSize: "12px" }}
                    />
                  </div>
                  <div className="d-flex align-items-center">
                    <span className="small fw-semibold text-secondary text-nowrap" style={{ minWidth: "95px" }}>Kur türü</span>
                    <Form.Select
                      size="sm"
                      value={kurTuru}
                      onChange={(e) => handleKurTuruChange(Number(e.target.value))}
                      onKeyDown={(e) => e.stopPropagation()}
                      style={{ fontSize: "12px" }}
                    >
                      <option value={0}>Efektif Kurları</option>
                      <option value={1}>Döviz Kurları</option>
                    </Form.Select>
                  </div>
                </Col>

                {/* 2. Sütun: Seri no, Cari Kodu (Dürbünlü), Ünvan (Dürbünlü), Fiş Tipi */}
                <Col md={4}>
                  <div className="d-flex align-items-center mb-1.5">
                    <span className="small fw-semibold text-secondary text-nowrap" style={{ minWidth: "85px" }}>Seri no</span>
                    <Form.Control
                      size="sm"
                      type="text"
                      value={seriNo}
                      onChange={(e) => setSeriNo(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                      placeholder="Seri..."
                      style={{ fontSize: "12px" }}
                    />
                  </div>

                  {/* Cari Kodu (Dürbün Butonlu) */}
                  <div className="d-flex align-items-center mb-1.5">
                    <span className="small fw-semibold text-secondary text-nowrap" style={{ minWidth: "85px" }}>Cari Kodu</span>
                    <InputGroup size="sm">
                      <Form.Control
                        type="text"
                        value={cariKodu}
                        onChange={(e) => setCariKodu(e.target.value)}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === "Enter") {
                            const val = e.currentTarget.value.trim().toLowerCase();
                            const found = localCariList.find((c) => c.kod?.toLowerCase() === val);
                            if (found) {
                              handleSelectCari(found);
                            } else {
                              setLookupSearchTerm(e.currentTarget.value);
                              setLookupType("cari");
                            }
                          }
                        }}
                        onBlur={() => {
                          if (cariKodu.trim()) {
                            const found = localCariList.find((c) => c.kod?.toLowerCase() === cariKodu.trim().toLowerCase());
                            if (found) {
                              setCariId(found.id);
                              setUnvan(found.ad || "");
                              setFormVknTckn(found.vergiKimlikNo || "");
                            }
                          }
                        }}
                        placeholder="Cari Kodu"
                        style={{ fontSize: "12px" }}
                      />
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        className="px-2 py-0 d-flex align-items-center justify-content-center bg-white"
                        onClick={() => {
                          setLookupSearchTerm(cariKodu);
                          setLookupType("cari");
                        }}
                        title="Cari Listesinden Seç (Dürbün)"
                      >
                        <IconBinoculars size={14} />
                      </Button>
                    </InputGroup>
                  </div>

                  {/* Ünvan (Dürbün Butonlu) */}
                  <div className="d-flex align-items-center mb-1.5">
                    <span className="small fw-semibold text-secondary text-nowrap" style={{ minWidth: "85px" }}>Ünvan</span>
                    <InputGroup size="sm">
                      <Form.Control
                        type="text"
                        value={unvan}
                        onChange={(e) => setUnvan(e.target.value)}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === "Enter") {
                            setLookupSearchTerm(e.currentTarget.value);
                            setLookupType("cari");
                          }
                        }}
                        placeholder="Ünvan / Müşteri Adı"
                        style={{ fontSize: "12px", fontWeight: "bold" }}
                      />
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        className="px-2 py-0 d-flex align-items-center justify-content-center bg-white"
                        onClick={() => {
                          setLookupSearchTerm(unvan === "İSİM BEYAN EDİLMEMİŞTİR" ? "" : unvan);
                          setLookupType("cari");
                        }}
                        title="Cari Listesinden Seç (Dürbün)"
                      >
                        <IconBinoculars size={14} />
                      </Button>
                    </InputGroup>
                  </div>

                  <div className="d-flex align-items-center">
                    <span className="small fw-semibold text-secondary text-nowrap" style={{ minWidth: "85px" }}>Fiş tipi</span>
                    <Button
                      variant={isSatis ? "outline-danger" : "outline-success"}
                      size="sm"
                      className="py-0 px-2 fw-bold"
                      style={{ fontSize: "11.5px" }}
                      onClick={handleToggleIslemYonu}
                    >
                      {isSatis ? "SATIŞ FİŞİ" : "ALIŞ FİŞİ"} (Değiştir)
                    </Button>
                  </div>
                </Col>

                {/* 3. Sütun: Belge no, VKN/TCKN, İstatistik Kodu (Dürbünlü) */}
                <Col md={4}>
                  <div className="d-flex align-items-center mb-1.5">
                    <span className="small fw-semibold text-secondary text-nowrap" style={{ minWidth: "105px" }}>Belge no</span>
                    <Form.Control
                      size="sm"
                      type="text"
                      value={belgeNo}
                      onChange={(e) => setBelgeNo(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                      style={{ fontSize: "12px" }}
                    />
                  </div>
                  <div className="d-flex align-items-center mb-1.5">
                    <span className="small fw-semibold text-secondary text-nowrap" style={{ minWidth: "105px" }}>VKN / TCKN</span>
                    <Form.Control
                      size="sm"
                      type="text"
                      value={formVknTckn}
                      onChange={(e) => setFormVknTckn(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                      placeholder="VKN veya TCKN"
                      style={{ fontSize: "12px" }}
                    />
                  </div>

                  {/* İstatistik Kodu (Dürbünlü) */}
                  <div className="d-flex align-items-center">
                    <span className="small fw-semibold text-secondary text-nowrap" style={{ minWidth: "105px" }}>İstatistik kodu</span>
                    <InputGroup size="sm">
                      <Form.Control
                        type="text"
                        value={istatistikKod}
                        onChange={(e) => setIstatistikKod(e.target.value)}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === "Enter") {
                            setLookupSearchTerm(e.currentTarget.value);
                            setLookupType("istatistik");
                          }
                        }}
                        placeholder="İstatistik Kodu"
                        style={{ fontSize: "12px", fontWeight: "bold" }}
                      />
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        className="px-2 py-0 d-flex align-items-center justify-content-center bg-white"
                        onClick={() => {
                          setLookupSearchTerm(istatistikKod);
                          setLookupType("istatistik");
                        }}
                        title="İstatistik Kodu Seç (Dürbün)"
                      >
                        <IconBinoculars size={14} />
                      </Button>
                    </InputGroup>
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          {/* ─── 2. SATIRLAR TABLOSU (DÖVİZ / MADEN GRID) ────────────────────────────────── */}
          <Card className="mb-2.5 shadow-2xs border" style={{ borderColor: themeBorderColor }}>
            <Card.Header className="py-1.5 px-2 bg-white d-flex justify-content-between align-items-center border-bottom">
              <span className="fw-bold text-dark small">
                {isSatis ? "Satılan Kalemler (Çıkış Bacağı)" : "Alınan Kalemler (Giriş Bacağı)"}
              </span>
              <Button size="sm" variant="outline-primary" className="py-0 px-2 fw-semibold" style={{ fontSize: "11.5px" }} onClick={handleAddLine}>
                <IconPlus size={13} className="me-1" /> Satır Ekle
              </Button>
            </Card.Header>
            <div className="table-responsive" style={{ maxHeight: "240px" }}>
              <Table bordered hover size="sm" className="mb-0 align-middle text-nowrap">
                <thead className="bg-light text-secondary small text-center">
                  <tr>
                    <th style={{ width: "40px" }}>#</th>
                    <th style={{ width: "150px" }}>Kod</th>
                    <th>Ad / Tanım</th>
                    <th style={{ width: "140px" }}>Miktar</th>
                    <th style={{ width: "130px" }}>{isSatis ? "Satış Kuru" : "Alış Kuru"}</th>
                    <th style={{ width: "150px" }}>Tutar (TL)</th>
                    <th style={{ width: "45px" }}>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, idx) => (
                    <tr key={l.id}>
                      <td className="text-center text-muted fw-bold small">{idx + 1}</td>
                      <td>
                        <InputGroup size="sm">
                          <Form.Control
                            size="sm"
                            type="text"
                            value={l.kod}
                            onChange={(e) => handleUpdateLine(l.id, "kod", e.target.value)}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              if (e.key === "Enter") {
                                setActiveLookupLineId(l.id);
                                setLookupSearchTerm(e.currentTarget.value);
                                setLookupType("currency");
                              }
                            }}
                            placeholder="USD, EUR, HAS..."
                            className="fw-bold text-primary font-monospace"
                            style={{ fontSize: "12px" }}
                          />
                          <Button
                            variant="outline-secondary"
                            size="sm"
                            className="px-1.5 py-0 bg-white"
                            onClick={() => {
                              setActiveLookupLineId(l.id);
                              setLookupSearchTerm(l.kod);
                              setLookupType("currency");
                            }}
                            title="Döviz / Maden Seç (Dürbün)"
                          >
                            <IconBinoculars size={13} />
                          </Button>
                        </InputGroup>
                      </td>
                      <td>
                        <Form.Control
                          size="sm"
                          type="text"
                          value={l.ad || l.kod}
                          onChange={(e) => handleUpdateLine(l.id, "ad", e.target.value)}
                          onKeyDown={(e) => e.stopPropagation()}
                          className="fw-semibold small"
                          style={{ fontSize: "12px" }}
                        />
                      </td>
                      <td>
                        <Form.Control
                          size="sm"
                          type="text"
                          className="text-end font-monospace fw-bold"
                          style={{ fontSize: "12px" }}
                          value={l.miktar}
                          onChange={(e) => handleUpdateLine(l.id, "miktar", e.target.value)}
                          onKeyDown={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td>
                        <Form.Control
                          size="sm"
                          type="text"
                          className="text-end font-monospace fw-bold text-dark"
                          style={{ fontSize: "12px" }}
                          value={l.kur}
                          onChange={(e) => handleUpdateLine(l.id, "kur", e.target.value)}
                          onKeyDown={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td>
                        <Form.Control
                          size="sm"
                          type="text"
                          className="text-end font-monospace fw-bold text-success"
                          style={{ fontSize: "12px" }}
                          value={l.tutar}
                          onChange={(e) => handleUpdateLine(l.id, "tutar", e.target.value)}
                          onKeyDown={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="text-center">
                        <Button
                          variant="outline-danger"
                          size="sm"
                          className="p-0.5 border-0"
                          disabled={lines.length <= 1}
                          onClick={() => handleRemoveLine(l.id)}
                          title="Satırı Sil"
                        >
                          <IconTrash size={14} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card>

          {/* ─── 3. ALT TOPLAM VE DENGE KARTI ────────────────────────────────────────────── */}
          <Card className="border shadow-2xs" style={{ borderColor: themeBorderColor }}>
            <Card.Body className="p-2.5">
              <Row className="g-2 align-items-center justify-content-between">
                <Col md={6}>
                  <div className="d-flex align-items-center gap-2">
                    <span className="small fw-semibold text-secondary">Arbitraj Dengesi:</span>
                    {Math.abs(farkTl) <= 0.05 ? (
                      <Badge bg="success" className="px-2.5 py-1.5 fw-bold d-flex align-items-center gap-1">
                        <IconCheck size={14} /> TL Dengesi %100 Eşitlendi
                      </Badge>
                    ) : (
                      <Badge bg="warning" text="dark" className="px-2.5 py-1.5 fw-bold">
                        Fark: {farkTl.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL
                      </Badge>
                    )}
                  </div>
                </Col>

                <Col md={6}>
                  <div className="d-flex align-items-center justify-content-end gap-3">
                    <div className="d-flex align-items-center gap-1.5">
                      <span className="small fw-bold text-dark text-nowrap">Toplam Tutar:</span>
                      <Form.Control
                        size="sm"
                        readOnly
                        className="text-end font-monospace fw-bold bg-white text-dark"
                        style={{ width: "140px", fontSize: "13px" }}
                        value={`${totalTl.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL`}
                      />
                    </div>
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Modal.Body>

        {/* ─── 4. MODAL FOOTER BUTONLARI ─────────────────────────────────────────────────── */}
        <Modal.Footer className="py-2 px-3 bg-white border-top d-flex justify-content-between align-items-center">
          <Button variant="secondary" size="sm" onClick={onClose} className="fw-semibold px-3">
            <IconX size={15} className="me-1" /> [ESC] Vazgeç / Kapat
          </Button>

          <Button
            variant={isSatis ? "danger" : "success"}
            size="sm"
            className="fw-bold px-4 shadow-2xs d-flex align-items-center gap-1.5"
            onClick={handleSaveArbitraj}
            disabled={isSaving || totalTl <= 0}
          >
            <IconDeviceFloppy size={16} />
            <span>[F10] Arbitraj Fişini Kaydet & Aktar</span>
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ─── ENTEGRE DÜRBÜN SEÇİM MODALI (POPUP OVERLAY) ─────────────────────────────────── */}
      {lookupType && (
        <Modal
          show={true}
          onHide={() => setLookupType(null)}
          size="lg"
          centered
          backdrop="static"
          enforceFocus={false}
          restoreFocus={false}
          style={{ zIndex: 1070 }}
        >
          <Modal.Header closeButton className="py-2 px-3 bg-light border-bottom">
            <Modal.Title className="fs-6 fw-bold text-dark d-flex align-items-center gap-2">
              <IconBinoculars size={18} className="text-primary" />
              <span>
                {lookupType === "cari"
                  ? "Cari Hesap Seçiniz"
                  : lookupType === "istatistik"
                  ? "İstatistik Kodu Seçiniz"
                  : "Döviz / Maden Para Seçiniz"}
              </span>
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="p-3">
            {/* Arama Kutusu */}
            <InputGroup className="mb-2.5">
              <InputGroup.Text className="bg-white">
                <IconSearch size={16} className="text-secondary" />
              </InputGroup.Text>
              <Form.Control
                autoFocus
                placeholder="Aramak istediğiniz kodu, adı veya bilgiyi yazın..."
                value={lookupSearchTerm}
                onChange={(e) => setLookupSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Escape") {
                    setLookupType(null);
                  }
                }}
              />
            </InputGroup>

            {/* Sonuç Listesi */}
            <div className="table-responsive" style={{ maxHeight: "350px", overflowY: "auto" }}>
              <Table hover bordered size="sm" className="mb-0 align-middle">
                {/* 1) CARİ TABLOSU */}
                {lookupType === "cari" && (
                  <>
                    <thead className="bg-light text-secondary small">
                      <tr>
                        <th style={{ width: "120px" }}>Cari Kodu</th>
                        <th>Ünvan / Ad</th>
                        <th style={{ width: "130px" }}>VKN / TCKN</th>
                        <th style={{ width: "120px" }}>Telefon</th>
                        <th style={{ width: "70px" }}>İşlem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCariler.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-3 text-muted">Eşleşen cari bulunamadı.</td>
                        </tr>
                      ) : (
                        filteredCariler.map((c) => (
                          <tr
                            key={c.id}
                            style={{ cursor: "pointer" }}
                            onDoubleClick={() => handleSelectCari(c)}
                          >
                            <td className="fw-bold font-monospace text-primary">{c.kod}</td>
                            <td className="fw-semibold">{c.ad}</td>
                            <td className="font-monospace">{c.vergiKimlikNo || "-"}</td>
                            <td>{c.telefon || "-"}</td>
                            <td className="text-center">
                              <Button
                                size="sm"
                                variant="primary"
                                className="py-0 px-2"
                                style={{ fontSize: "11px" }}
                                onClick={() => handleSelectCari(c)}
                              >
                                Seç
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </>
                )}

                {/* 2) İSTATİSTİK TABLOSU */}
                {lookupType === "istatistik" && (
                  <>
                    <thead className="bg-light text-secondary small">
                      <tr>
                        <th style={{ width: "130px" }}>İstatistik Kodu</th>
                        <th>Açıklama / Tanım</th>
                        <th style={{ width: "70px" }}>İşlem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStats.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="text-center py-3 text-muted">Eşleşen istatistik kodu bulunamadı.</td>
                        </tr>
                      ) : (
                        filteredStats.map((s) => (
                          <tr
                            key={s.id || s.kod}
                            style={{ cursor: "pointer" }}
                            onDoubleClick={() => {
                              setIstatistikKod(s.kod);
                              setLookupType(null);
                            }}
                          >
                            <td className="fw-bold font-monospace text-primary">{s.kod}</td>
                            <td>{(s as any).aciklama || (s as any).ad || (s as any).tanim || s.kod}</td>
                            <td className="text-center">
                              <Button
                                size="sm"
                                variant="primary"
                                className="py-0 px-2"
                                style={{ fontSize: "11px" }}
                                onClick={() => {
                                  setIstatistikKod(s.kod);
                                  setLookupType(null);
                                }}
                              >
                                Seç
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </>
                )}

                {/* 3) DÖVİZ / MADEN TABLOSU */}
                {lookupType === "currency" && (
                  <>
                    <thead className="bg-light text-secondary small">
                      <tr>
                        <th style={{ width: "100px" }}>Kod</th>
                        <th>Ad / Tanım</th>
                        <th style={{ width: "120px" }} className="text-end">Alış Kuru</th>
                        <th style={{ width: "120px" }} className="text-end">Satış Kuru</th>
                        <th style={{ width: "70px" }}>İşlem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCurrencies.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-3 text-muted">Eşleşen para/maden bulunamadı.</td>
                        </tr>
                      ) : (
                        filteredCurrencies.map((item) => (
                          <tr
                            key={item.kod}
                            style={{ cursor: "pointer" }}
                            onDoubleClick={() => {
                              if (activeLookupLineId) {
                                handleSelectCurrencyForLine(activeLookupLineId, item);
                              }
                            }}
                          >
                            <td className="fw-bold font-monospace text-primary">{item.kod}</td>
                            <td className="fw-semibold">{item.ad}</td>
                            <td className="text-end font-monospace text-primary fw-bold">
                              {Number(item.efektifAlis || item.dovizAlis || 0).toLocaleString("tr-TR", { minimumFractionDigits: 4 })}
                            </td>
                            <td className="text-end font-monospace text-danger fw-bold">
                              {Number(item.efektifSatis || item.dovizSatis || 0).toLocaleString("tr-TR", { minimumFractionDigits: 4 })}
                            </td>
                            <td className="text-center">
                              <Button
                                size="sm"
                                variant="primary"
                                className="py-0 px-2"
                                style={{ fontSize: "11px" }}
                                onClick={() => {
                                  if (activeLookupLineId) {
                                    handleSelectCurrencyForLine(activeLookupLineId, item);
                                  }
                                }}
                              >
                                Seç
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </>
                )}
              </Table>
            </div>
          </Modal.Body>
          <Modal.Footer className="py-2 px-3 bg-light d-flex justify-content-end">
            <Button variant="secondary" size="sm" onClick={() => setLookupType(null)}>
              Kapat
            </Button>
          </Modal.Footer>
        </Modal>
      )}
    </>
  );
};

export default ArbitrajModal;
