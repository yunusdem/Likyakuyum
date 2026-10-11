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
  IconScale,
  IconUser,
  IconFileText,
} from "@tabler/icons-react";
import { KurRowItem } from "../../services/kurService";
import { CariKartItem, CariService } from "../../services/cariService";
import { StatisticItem, StatisticService } from "../../services/statisticService";
import { TodvzTanimDto } from "../../services/companyService";

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

export interface ArbitrajDetayModel {
  cariTipi?: string;
  yetkiliKisi?: string;
  yetkiliKisiId?: number;
  sirketTuru?: string | number;
  dernekAmaci?: string;
  pasaportNo?: string;
  gecerlilikTarihi?: string;
  dogumTarihi?: string;
  dogumYeri?: string;
  kimlikKaynagi?: string;
  kimlikSeriNo?: string;
  babaAdi?: string;
  anneAdi?: string;
  vergiDairesi?: string;
  vergiDairesiId?: number | null;
  adres?: string;
  eposta?: string;
  telefon?: string;
  vekil?: string;
  vekilTipi?: string;
  vekilAdi?: string;
  vekilKimlikNo?: string;
  meslek?: string;
  meslekId?: number | null;
  ulke?: string;
  uyruk?: string;
  hukukiYapi?: string;
  il?: string;
  ilce?: string;
  postaKodu?: string;
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
  allLines?: ArbitrajModalLine[];
  detay?: ArbitrajDetayModel;
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
  komisyonOrani?: number | string;
  komisyon?: number | string;
  bmvOrani?: number | string;
  bmv?: number | string;
  kmvOrani?: number | string;
  kmv?: number | string;
  isMaden?: boolean;
  milyem?: number;
}

interface ArbitrajModalProps {
  show: boolean;
  onClose: () => void;
  fisTip?: number; // 0: Alış -> Modal Alış, 1: Satış -> Modal Satış (Birebir eşleşmeli)
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
  companyDefinitions?: TodvzTanimDto | null;
  initialDetay?: ArbitrajDetayModel;
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
  companyDefinitions = null,
  initialDetay,
  pageType,
  onApplyToFis,
  onSaveDirect,
  kurKurusSayisi = 4,
  dovizKurusSayisi = 2,
  tlKurusSayisi = 2,
}) => {
  // Alıştayken Alış ("alis"), Satıştayken Satış ("satis") olarak birebir açılır
  const targetIslemYonu: "alis" | "satis" = fisTip === 1 ? "satis" : "alis";

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

  // F8 Detay Formu State
  const [showDetayModal, setShowDetayModal] = useState<boolean>(false);
  const [detayCariTipi, setDetayCariTipi] = useState<string>(initialDetay?.cariTipi || "Şahıs");
  const [detayYetkiliKisi, setDetayYetkiliKisi] = useState<string>(initialDetay?.yetkiliKisi || "");
  const [detayYetkiliKisiId, setDetayYetkiliKisiId] = useState<number | undefined>(initialDetay?.yetkiliKisiId);
  const [detaySirketTuru, setDetaySirketTuru] = useState<string | number | undefined>(initialDetay?.sirketTuru);
  const [detayDernekAmaci, setDetayDernekAmaci] = useState<string>(initialDetay?.dernekAmaci || "");
  const [detayPasaportNo, setDetayPasaportNo] = useState<string>(initialDetay?.pasaportNo || "");
  const [detayGecerlilikTarihi, setDetayGecerlilikTarihi] = useState<string>(initialDetay?.gecerlilikTarihi || "");
  const [detayDogumTarihi, setDetayDogumTarihi] = useState<string>(initialDetay?.dogumTarihi || "");
  const [detayDogumYeri, setDetayDogumYeri] = useState<string>(initialDetay?.dogumYeri || "");
  const [detayKimlikKaynagi, setDetayKimlikKaynagi] = useState<string>(initialDetay?.kimlikKaynagi || "");
  const [detayKimlikSeriNo, setDetayKimlikSeriNo] = useState<string>(initialDetay?.kimlikSeriNo || "");
  const [detayBabaAdi, setDetayBabaAdi] = useState<string>(initialDetay?.babaAdi || "");
  const [detayAnneAdi, setDetayAnneAdi] = useState<string>(initialDetay?.anneAdi || "");
  const [detayVergiDairesi, setDetayVergiDairesi] = useState<string>(initialDetay?.vergiDairesi || "");
  const [detayVergiDairesiId, setDetayVergiDairesiId] = useState<number | null>(initialDetay?.vergiDairesiId ?? null);
  const [detayAdres, setDetayAdres] = useState<string>(initialDetay?.adres || "");
  const [detayEposta, setDetayEposta] = useState<string>(initialDetay?.eposta || "");
  const [detayTelefon, setDetayTelefon] = useState<string>(initialDetay?.telefon || "");
  const [detayVekil, setDetayVekil] = useState<string>(initialDetay?.vekil || "Yok");
  const [detayVekilTipi, setDetayVekilTipi] = useState<string>(initialDetay?.vekilTipi || "Şahıs");
  const [detayVekilAdi, setDetayVekilAdi] = useState<string>(initialDetay?.vekilAdi || "");
  const [detayVekilKimlikNo, setDetayVekilKimlikNo] = useState<string>(initialDetay?.vekilKimlikNo || "");
  const [detayMeslek, setDetayMeslek] = useState<string>(initialDetay?.meslek || "");
  const [detayMeslekId, setDetayMeslekId] = useState<number | null>(initialDetay?.meslekId ?? null);
  const [detayUlke, setDetayUlke] = useState<string>(initialDetay?.ulke || "TÜRKİYE");
  const [detayUyruk, setDetayUyruk] = useState<string>(initialDetay?.uyruk || "TÜRKİYE");
  const [detayHukukiYapi, setDetayHukukiYapi] = useState<string>(initialDetay?.hukukiYapi || "");
  const [detayIl, setDetayIl] = useState<string>(initialDetay?.il || "");
  const [detayIlce, setDetayIlce] = useState<string>(initialDetay?.ilce || "");
  const [detayPostaKodu, setDetayPostaKodu] = useState<string>(initialDetay?.postaKodu || "");

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

  // Fiş Tipi Ref (Otomatik Odaklanma İçin)
  const tipSelectRef = useRef<HTMLSelectElement | null>(null);

  // Parse helper
  const parseNum = useCallback((val: number | string | undefined): number => {
    if (val === undefined || val === null || val === "") return 0;
    const clean = String(val).replace(/\s/g, "").replace(/,/g, ".");
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  }, []);

  // Sync / Load lists
  useEffect(() => {
    if (cariList && cariList.length > 0) {
      setLocalCariList(cariList);
    } else if (show) {
      CariService.getCariKartlar()
        .then((res) => {
          if (res && res.length > 0) setLocalCariList(res);
        })
        .catch(() => {});
    }
  }, [cariList, show]);

  useEffect(() => {
    if (statisticList && statisticList.length > 0) {
      setLocalStatList(statisticList);
    } else if (show) {
      StatisticService.getStatistics()
        .then((res) => {
          if (res && res.length > 0) setLocalStatList(res);
        })
        .catch(() => {});
    }
  }, [statisticList, show]);

  // Combined currency + metal list
  const currencyList = useMemo<ArbitrajCurrencyItem[]>(() => {
    const list: ArbitrajCurrencyItem[] = [];

    (paralar || []).forEach((p) => {
      const kod = (p.kod || "").toUpperCase().trim();
      if (kod && kod !== "TL" && kod !== "TRY" && !list.some((x) => x.kod.toUpperCase() === kod)) {
        list.push({
          id: p.id,
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

  // Active statistic object
  const activeStat = useMemo(() => {
    const rawKod = (istatistikKod || "").trim();
    if (!rawKod) return null;
    return localStatList.find((s) => s.kod === rawKod || (s as any).kod === rawKod) || null;
  }, [istatistikKod, localStatList]);

  // Calculation function matching DovizFisiPage.tsx rules exactly:
  // - ALIŞ (islemYonu === "alis"): KMV & BMV are ZERO. Only Komisyon applies.
  // - SATIŞ (islemYonu === "satis"): BMV & KMV calculate according to active statistic & company definitions.
  const calculateRow = useCallback(
    (params: {
      miktar: number | string;
      kur: number | string;
      kod: string;
      komisyonOrani?: number | string;
      bmvOrani?: number | string;
      kmvOrani?: number | string;
      currentDirection?: "alis" | "satis";
    }) => {
      const dir = params.currentDirection || islemYonu;
      const m = parseNum(params.miktar);
      const k = parseNum(params.kur);
      const isTL = (params.kod || "").toUpperCase().trim() === "TL" || (params.kod || "").toUpperCase().trim() === "TRY";
      const brutTutar = m > 0 ? (isTL ? m : parseFloat((m * k).toFixed(tlKurusSayisi))) : 0;

      let bmvVal = "";
      let kmvVal = "";
      let komVal = "";

      const komRate = parseNum(params.komisyonOrani || "0");
      if (komRate > 0 && brutTutar > 0) {
        komVal = parseFloat((brutTutar * (komRate / 100)).toFixed(2)).toFixed(2);
      }

      // ALIŞTA KMV VE BMV KESİNLİKLE YOKTUR! SADECE KOMİSYON!
      if (dir === "alis") {
        return {
          brutTutar,
          tutar: brutTutar > 0 ? brutTutar.toFixed(tlKurusSayisi) : "0.00",
          bmvOrani: "",
          bmv: "",
          kmvOrani: "",
          kmv: "",
          komisyonOrani: komRate > 0 ? komRate.toString() : "",
          komisyon: komVal,
        };
      }

      // SATIŞTA:
      const bmvRate = parseNum(params.bmvOrani || "0");
      const kmvRate = parseNum(params.kmvOrani || "0");

      if (bmvRate > 0 && brutTutar > 0) {
        bmvVal = parseFloat((brutTutar * (bmvRate / 100)).toFixed(2)).toFixed(2);
      }

      const effectiveKmvFactor = kmvRate >= 1 && kmvRate <= 10 ? kmvRate / 1000 : kmvRate / 100;
      const kmvMode =
        companyDefinitions?.KMV_UYGULAMA_SEKLI === 1 ||
        companyDefinitions?.KMV_UYGULAMA_SEKLI === 2 ||
        companyDefinitions?.KMV_UYGULAMA_SEKLI === 3
          ? companyDefinitions.KMV_UYGULAMA_SEKLI
          : 3;

      if (kmvMode === 1) {
        kmvVal = "";
      } else {
        if (kmvRate > 0 && brutTutar > 0) {
          const calculatedKmv = parseFloat((brutTutar * effectiveKmvFactor).toFixed(2));
          kmvVal = calculatedKmv > 0 ? calculatedKmv.toFixed(2) : "";
        }
      }

      return {
        brutTutar,
        tutar: brutTutar > 0 ? brutTutar.toFixed(tlKurusSayisi) : "0.00",
        bmvOrani: bmvRate > 0 ? bmvRate.toString() : "",
        bmv: bmvVal,
        kmvOrani: kmvRate > 0 ? kmvRate.toString() : "",
        kmv: kmvVal,
        komisyonOrani: komRate > 0 ? komRate.toString() : "",
        komisyon: komVal,
      };
    },
    [islemYonu, parseNum, tlKurusSayisi, companyDefinitions]
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
      setShowDetayModal(false);

      // Alıştayken Alış, Satıştayken Satış olarak aç
      const dir: "alis" | "satis" = fisTip === 1 ? "satis" : "alis";
      setIslemYonu(dir);
      setGelisNedeni(dir === "satis" ? "Arbitraj Satış" : "Arbitraj Alış");
      setCariId(selectedCariId);
      setCariKodu(selectedCariKod || "");
      setUnvan(selectedUnvan || "İSİM BEYAN EDİLMEMİŞTİR");
      setFormVknTckn(vknTckn || "");

      // İstatistik belirle (Varsa Firma Tanımlarındaki Arbitraj istatistiği, yoksa aktarılan)
      let initialStat = istatistikKodu || "9249";
      if (dir === "alis" && companyDefinitions?.ARBITRAJ_ALIS_ISTATISTIK_ID) {
        const foundStat = localStatList.find((s) => s.id === companyDefinitions.ARBITRAJ_ALIS_ISTATISTIK_ID);
        if (foundStat?.kod) initialStat = foundStat.kod;
      } else if (dir === "satis" && companyDefinitions?.ARBITRAJ_SATIS_ISTATISTIK_ID) {
        const foundStat = localStatList.find((s) => s.id === companyDefinitions.ARBITRAJ_SATIS_ISTATISTIK_ID);
        if (foundStat?.kod) initialStat = foundStat.kod;
      }
      setIstatistikKod(initialStat);

      // Default item
      const defaultItem =
        pageType === "sarraf"
          ? (currencyList.find((c) => c.kod.toUpperCase() === "HAS") || currencyList[0])
          : (currencyList.find((c) => c.kod.toUpperCase() === "EUR") || currencyList[0]);

      if (defaultItem) {
        const rate = getRateForItem(defaultItem, dir, 0);
        const targetTl = Number(hedefTlTutar) > 0 ? Number(hedefTlTutar) : 0;
        const calculatedMiktar = rate > 0 && targetTl > 0 ? targetTl / rate : 100;

        const calc = calculateRow({
          miktar: calculatedMiktar.toFixed(defaultItem.isMaden ? 3 : dovizKurusSayisi),
          kur: rate.toFixed(kurKurusSayisi),
          kod: defaultItem.kod,
          currentDirection: dir,
        });

        setLines([
          {
            id: String(Date.now()),
            satirNo: 1,
            paraId: defaultItem.id,
            kod: defaultItem.kod,
            ad: defaultItem.ad,
            miktar: calculatedMiktar.toFixed(defaultItem.isMaden ? 3 : dovizKurusSayisi),
            kur: rate.toFixed(kurKurusSayisi),
            tutar: calc.tutar,
            komisyonOrani: calc.komisyonOrani,
            komisyon: calc.komisyon,
            bmvOrani: calc.bmvOrani,
            bmv: calc.bmv,
            kmvOrani: calc.kmvOrani,
            kmv: calc.kmv,
            isMaden: defaultItem.isMaden,
            milyem: defaultItem.milyem || 1000,
          },
        ]);
      }
    }
    prevShowRef.current = show;
  }, [
    show,
    fisTip,
    hedefTlTutar,
    selectedCariId,
    selectedCariKod,
    selectedUnvan,
    vknTckn,
    istatistikKodu,
    pageType,
    currencyList,
    getRateForItem,
    dovizKurusSayisi,
    kurKurusSayisi,
    tlKurusSayisi,
    calculateRow,
    companyDefinitions,
    localStatList,
  ]);

  // Modal açıldığında otomatik olarak Fiş Tipine (Alış / Satış) odaklan
  useEffect(() => {
    if (show && !showDetayModal && lookupType === null) {
      const focusTip = () => {
        const el = tipSelectRef.current || (document.getElementById("arbitraj-fis-tip-select") as HTMLSelectElement | null);
        if (el && document.activeElement !== el) {
          el.focus({ preventScroll: true });
        }
      };
      focusTip();
      const t1 = setTimeout(focusTip, 50);
      const t2 = setTimeout(focusTip, 150);
      const t3 = setTimeout(focusTip, 300);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }
  }, [show, showDetayModal, lookupType]);

  // Recalculate rates when kurTuru changes
  const handleKurTuruChange = (newKurTuru: number) => {
    setKurTuru(newKurTuru);
    setLines((prev) =>
      prev.map((l) => {
        const item = currencyList.find((c) => c.kod.toUpperCase() === l.kod.toUpperCase());
        if (!item) return l;
        const rate = getRateForItem(item, islemYonu, newKurTuru);
        const calc = calculateRow({
          miktar: l.miktar,
          kur: rate.toFixed(kurKurusSayisi),
          kod: l.kod,
          komisyonOrani: l.komisyonOrani,
          bmvOrani: l.bmvOrani,
          kmvOrani: l.kmvOrani,
          currentDirection: islemYonu,
        });
        return {
          ...l,
          kur: rate.toFixed(kurKurusSayisi),
          tutar: calc.tutar,
          komisyon: calc.komisyon,
          bmv: calc.bmv,
          kmv: calc.kmv,
        };
      })
    );
  };

  // Switch direction (Alış <-> Satış)
  const handleToggleIslemYonu = (targetDir?: "alis" | "satis") => {
    const newDir: "alis" | "satis" = targetDir || (islemYonu === "satis" ? "alis" : "satis");
    setIslemYonu(newDir);
    setGelisNedeni(newDir === "satis" ? "Arbitraj Satış" : "Arbitraj Alış");

    // İstatistik oranlarını al
    let statBmv = "";
    let statKmv = "";
    let statKom = "";
    if (activeStat && newDir === "satis") {
      statBmv = activeStat.bmvOrani ? String(activeStat.bmvOrani) : "";
      statKmv = activeStat.kmvOrani ? String(activeStat.kmvOrani) : "0.2";
      statKom = activeStat.komisyonOrani ? String(activeStat.komisyonOrani) : "";
    } else if (activeStat && newDir === "alis") {
      statKom = activeStat.komisyonOrani ? String(activeStat.komisyonOrani) : "";
    }

    setLines((prev) =>
      prev.map((l) => {
        const item = currencyList.find((c) => c.kod.toUpperCase() === l.kod.toUpperCase());
        const rate = item ? getRateForItem(item, newDir, kurTuru) : parseNum(l.kur);
        const calc = calculateRow({
          miktar: l.miktar,
          kur: rate.toFixed(kurKurusSayisi),
          kod: l.kod,
          komisyonOrani: statKom || l.komisyonOrani,
          bmvOrani: newDir === "alis" ? "" : (statBmv || l.bmvOrani),
          kmvOrani: newDir === "alis" ? "" : (statKmv || l.kmvOrani),
          currentDirection: newDir,
        });
        return {
          ...l,
          kur: rate.toFixed(kurKurusSayisi),
          tutar: calc.tutar,
          komisyonOrani: calc.komisyonOrani,
          komisyon: calc.komisyon,
          bmvOrani: calc.bmvOrani,
          bmv: calc.bmv,
          kmvOrani: calc.kmvOrani,
          kmv: calc.kmv,
        };
      })
    );
  };

  // Recalculate a line on field edit
  const handleUpdateLine = (
    lineId: string,
    field: "miktar" | "kur" | "tutar" | "kod" | "ad" | "komisyonOrani",
    value: string
  ) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;

        if (field === "kod") {
          const found = currencyList.find((c) => c.kod.toUpperCase() === value.trim().toUpperCase());
          if (found) {
            const rate = getRateForItem(found, islemYonu, kurTuru);
            const targetTl = Number(hedefTlTutar) > 0 ? Number(hedefTlTutar) : parseNum(l.tutar);
            const calcMiktar =
              rate > 0 && targetTl > 0 ? targetTl / rate : parseNum(l.miktar) > 0 ? parseNum(l.miktar) : 100;

            const calc = calculateRow({
              miktar: calcMiktar.toFixed(found.isMaden ? 3 : dovizKurusSayisi),
              kur: rate.toFixed(kurKurusSayisi),
              kod: found.kod,
              komisyonOrani: l.komisyonOrani,
              bmvOrani: l.bmvOrani,
              kmvOrani: l.kmvOrani,
              currentDirection: islemYonu,
            });

            return {
              ...l,
              paraId: found.id,
              kod: found.kod,
              ad: found.ad,
              kur: rate.toFixed(kurKurusSayisi),
              miktar: calcMiktar.toFixed(found.isMaden ? 3 : dovizKurusSayisi),
              tutar: calc.tutar,
              komisyon: calc.komisyon,
              bmv: calc.bmv,
              kmv: calc.kmv,
              isMaden: found.isMaden,
              milyem: found.milyem || 1000,
            };
          }
          return { ...l, kod: value };
        }

        if (field === "ad") {
          return { ...l, ad: value };
        }

        let newMiktar = field === "miktar" ? value : l.miktar;
        let newKur = field === "kur" ? value : l.kur;
        let newKomOrani = field === "komisyonOrani" ? value : l.komisyonOrani;

        if (field === "tutar") {
          const tNum = parseNum(value);
          const kNum = parseNum(l.kur);
          if (tNum > 0 && kNum > 0) {
            newMiktar = (tNum / kNum).toFixed(l.isMaden ? 3 : dovizKurusSayisi);
          }
        }

        const calc = calculateRow({
          miktar: newMiktar,
          kur: newKur,
          kod: l.kod,
          komisyonOrani: newKomOrani,
          bmvOrani: l.bmvOrani,
          kmvOrani: l.kmvOrani,
          currentDirection: islemYonu,
        });

        return {
          ...l,
          miktar: newMiktar,
          kur: newKur,
          komisyonOrani: calc.komisyonOrani,
          komisyon: calc.komisyon,
          bmv: calc.bmv,
          kmv: calc.kmv,
          tutar: calc.tutar,
        };
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
        const calcMiktar =
          rate > 0 && targetTl > 0 ? targetTl / rate : parseNum(l.miktar) > 0 ? parseNum(l.miktar) : 100;

        const calc = calculateRow({
          miktar: calcMiktar.toFixed(item.isMaden ? 3 : dovizKurusSayisi),
          kur: rate.toFixed(kurKurusSayisi),
          kod: item.kod,
          komisyonOrani: l.komisyonOrani,
          bmvOrani: l.bmvOrani,
          kmvOrani: l.kmvOrani,
          currentDirection: islemYonu,
        });

        return {
          ...l,
          paraId: item.id,
          kod: item.kod,
          ad: item.ad,
          kur: rate.toFixed(kurKurusSayisi),
          miktar: calcMiktar.toFixed(item.isMaden ? 3 : dovizKurusSayisi),
          tutar: calc.tutar,
          komisyon: calc.komisyon,
          bmv: calc.bmv,
          kmv: calc.kmv,
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
    setDetayTelefon(c.telefon || "");
    setDetayAdres(c.adres || "");
    setLookupType(null);
  };

  // Add line
  const handleAddLine = () => {
    const defaultItem = currencyList[0] || { id: 1, kod: "USD", ad: "AMERİKAN DOLARI" };
    const rate = getRateForItem(defaultItem, islemYonu, kurTuru);
    const calc = calculateRow({
      miktar: "0",
      kur: rate.toFixed(kurKurusSayisi),
      kod: defaultItem.kod,
      currentDirection: islemYonu,
    });
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
        komisyonOrani: calc.komisyonOrani,
        komisyon: calc.komisyon,
        bmvOrani: calc.bmvOrani,
        bmv: calc.bmv,
        kmvOrani: calc.kmvOrani,
        kmv: calc.kmv,
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

  // Calculations for summary boxes:
  const totalTutar = useMemo(() => {
    return lines.reduce((acc, row) => acc + parseNum(row.tutar), 0);
  }, [lines, parseNum]);

  const totalKomisyon = useMemo(() => {
    return lines.reduce((acc, row) => acc + parseNum(row.komisyon), 0);
  }, [lines, parseNum]);

  const totalBmv = useMemo(() => {
    if (islemYonu === "alis") return 0;
    return lines.reduce((acc, row) => acc + parseNum(row.bmv), 0);
  }, [lines, islemYonu, parseNum]);

  const totalKmv = useMemo(() => {
    if (islemYonu === "alis") return 0;
    return lines.reduce((acc, row) => acc + parseNum(row.kmv), 0);
  }, [lines, islemYonu, parseNum]);

  const totalMasraf = useMemo(() => {
    if (islemYonu === "alis") {
      return parseFloat(totalKomisyon.toFixed(2));
    }
    const kmvMode =
      companyDefinitions?.KMV_UYGULAMA_SEKLI === 1 ||
      companyDefinitions?.KMV_UYGULAMA_SEKLI === 2 ||
      companyDefinitions?.KMV_UYGULAMA_SEKLI === 3
        ? companyDefinitions.KMV_UYGULAMA_SEKLI
        : 3;
    const effectiveKmv = kmvMode === 3 ? totalKmv : 0;
    return parseFloat((totalBmv + effectiveKmv + totalKomisyon).toFixed(2));
  }, [islemYonu, totalKomisyon, totalBmv, totalKmv, companyDefinitions]);

  // Son Toplam:
  // Alış fişinde: Ödenecek TL = Toplam Tutar - Toplam Masraf
  // Satış fişinde: Alınacak TL = Toplam Tutar + Toplam Masraf
  const sonToplam = useMemo(() => {
    if (islemYonu === "satis") {
      return parseFloat((totalTutar + totalMasraf).toFixed(2));
    } else {
      return parseFloat((totalTutar - totalMasraf).toFixed(2));
    }
  }, [islemYonu, totalTutar, totalMasraf]);

  // Arbitraj Farkı (Arka plandaki hedef fiş tutarı ile denge)
  const farkTl = useMemo(() => {
    const hedef = Number(hedefTlTutar) || 0;
    if (hedef <= 0) return 0;
    return parseFloat((sonToplam - hedef).toFixed(2));
  }, [sonToplam, hedefTlTutar]);

  // Otomatik Dengele butonu: İlk satırın miktarını arka plan hedef TL tutarını karşılayacak şekilde ayarlar
  const handleAutoBalance = () => {
    if (lines.length === 0 || Number(hedefTlTutar) <= 0) return;
    const targetTl = Number(hedefTlTutar);
    const first = lines[0];
    const k = parseNum(first.kur);
    if (k <= 0) return;

    const newMiktar = (targetTl / k).toFixed(first.isMaden ? 3 : dovizKurusSayisi);
    handleUpdateLine(first.id, "miktar", newMiktar);
  };

  // Save / Apply Arbitraj
  const handleSaveArbitraj = async () => {
    if (lines.length === 0 || totalTutar <= 0) {
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
      allLines: lines,
      detay: {
        cariTipi: detayCariTipi,
        yetkiliKisi: detayYetkiliKisi,
        yetkiliKisiId: detayYetkiliKisiId,
        sirketTuru: detaySirketTuru,
        dernekAmaci: detayDernekAmaci,
        pasaportNo: detayPasaportNo,
        gecerlilikTarihi: detayGecerlilikTarihi,
        dogumTarihi: detayDogumTarihi,
        dogumYeri: detayDogumYeri,
        kimlikKaynagi: detayKimlikKaynagi,
        kimlikSeriNo: detayKimlikSeriNo,
        babaAdi: detayBabaAdi,
        anneAdi: detayAnneAdi,
        vergiDairesi: detayVergiDairesi,
        vergiDairesiId: detayVergiDairesiId,
        adres: detayAdres,
        eposta: detayEposta,
        telefon: detayTelefon,
        vekil: detayVekil,
        vekilTipi: detayVekilTipi,
        vekilAdi: detayVekilAdi,
        vekilKimlikNo: detayVekilKimlikNo,
        meslek: detayMeslek,
        meslekId: detayMeslekId,
        ulke: detayUlke,
        uyruk: detayUyruk,
        hukukiYapi: detayHukukiYapi,
        il: detayIl,
        ilce: detayIlce,
        postaKodu: detayPostaKodu,
      },
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

  // Keyboard shortcut inside modal (ESC, F8, F1, F10)
  useEffect(() => {
    if (!show || lookupType !== null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (showDetayModal) {
          setShowDetayModal(false);
        } else {
          onClose();
        }
      } else if (e.key === "F8") {
        e.preventDefault();
        e.stopPropagation();
        setShowDetayModal(true);
      } else if (e.key === "F1" || e.key === "F10") {
        e.preventDefault();
        e.stopPropagation();
        handleSaveArbitraj();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [show, lookupType, showDetayModal, onClose, handleSaveArbitraj]);

  // Filtered Cari items for lookup
  const filteredCariler = useMemo(() => {
    if (!lookupSearchTerm.trim()) return localCariList.slice(0, 100);
    const t = lookupSearchTerm.toLowerCase().trim();
    return localCariList
      .filter(
        (c) =>
          (c.kod || "").toLowerCase().includes(t) ||
          (c.ad || "").toLowerCase().includes(t) ||
          (c.vergiKimlikNo || "").toLowerCase().includes(t) ||
          (c.telefon || "").toLowerCase().includes(t)
      )
      .slice(0, 100);
  }, [localCariList, lookupSearchTerm]);

  // Filtered Statistic items for lookup
  const filteredStats = useMemo(() => {
    if (!lookupSearchTerm.trim()) return localStatList.slice(0, 100);
    const t = lookupSearchTerm.toLowerCase().trim();
    return localStatList
      .filter(
        (s) =>
          (s.kod || "").toLowerCase().includes(t) ||
          ((s as any).aciklama || (s as any).ad || "").toLowerCase().includes(t)
      )
      .slice(0, 100);
  }, [localStatList, lookupSearchTerm]);

  // Filtered Currency items for lookup
  const filteredCurrencies = useMemo(() => {
    if (!lookupSearchTerm.trim()) return currencyList;
    const t = lookupSearchTerm.toLowerCase().trim();
    return currencyList.filter(
      (c) => (c.kod || "").toLowerCase().includes(t) || (c.ad || "").toLowerCase().includes(t)
    );
  }, [currencyList, lookupSearchTerm]);

  // Temalandırma - DovizFisiPage ile birebir renkler:
  const isSatis = islemYonu === "satis";
  const activeFisThemeBg = isSatis ? "#fff1f2" : "#f0fdf4";
  const activeFisThemeBorder = isSatis ? "#dc2626" : "#16a34a";
  const activeFisThemeText = isSatis ? "#b91c1c" : "#15803d";
  const activeHeaderBg = isSatis
    ? "linear-gradient(135deg, #b91c1c 0%, #dc2626 100%)"
    : "linear-gradient(135deg, #15803d 0%, #16a34a 100%)";

  return (
    <>
      <Modal
        show={show}
        onHide={onClose}
        dialogClassName="modal-95w"
        size="xl"
        centered
        backdrop="static"
        enforceFocus={false}
        restoreFocus={false}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Başlığı (Toolbar Center Badge & Header) */}
        <Modal.Header
          closeButton
          className="py-2 px-3 text-white border-0 shadow-sm"
          style={{ background: activeHeaderBg }}
        >
          <div className="d-flex align-items-center justify-content-between w-100 me-2">
            <div className="d-flex align-items-center gap-2">
              <IconArrowsExchange size={24} className="text-white" />
              <div>
                <Modal.Title className="fs-6 fw-bold text-white mb-0 d-flex align-items-center gap-2">
                  <span>E- {pageType === "sarraf" ? "Sarraf" : "Döviz"} Fişi Kayıt (ARBİTRAJ FİŞİ)</span>
                  <Badge bg="dark" className="text-white px-2 py-0.5 font-monospace" style={{ fontSize: "11px" }}>
                    F7
                  </Badge>
                </Modal.Title>
                <div style={{ fontSize: "11px", opacity: 0.9 }}>
                  Vezne: <strong>{vezneKod} - {vezneAd}</strong>
                </div>
              </div>
            </div>

            {/* Orta: DovizFisiPage ile Birebir Büyük Rozet */}
            <div className="d-flex align-items-center gap-2">
              <div
                style={{
                  border: isSatis ? "2px solid #dc2626" : "2px solid #16a34a",
                  backgroundColor: activeFisThemeBg,
                  color: activeFisThemeText,
                  fontWeight: 800,
                  fontSize: "13.5px",
                  letterSpacing: "3px",
                  minWidth: "180px",
                  padding: "4px 25px",
                  borderRadius: "6px",
                  height: "32px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: isSatis ? "0 1px 3px rgba(220, 38, 38, 0.2)" : "0 1px 3px rgba(22, 163, 74, 0.2)",
                  textAlign: "center",
                  textTransform: "uppercase",
                  userSelect: "none",
                }}
              >
                {isSatis ? "SATIŞ" : "ALIŞ"}
              </div>
            </div>

            {/* Sağ Bilgi */}
            <div className="d-flex align-items-center gap-2 text-white small">
              {Number(hedefTlTutar) > 0 && (
                <Badge bg="warning" text="dark" className="fw-bold px-2 py-1 shadow-2xs">
                  Arka Fiş Tutar: {Number(hedefTlTutar).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL
                </Badge>
              )}
            </div>
          </div>
        </Modal.Header>

        <Modal.Body className="p-3" style={{ fontSize: "12.5px", backgroundColor: "#f8fafc", position: "relative" }}>
          {saveMessage && (
            <Alert variant={saveMessage.type} className="py-2 px-3 mb-2.5 small d-flex align-items-center gap-2">
              {saveMessage.type === "success" ? <IconCheck size={16} /> : <IconX size={16} />}
              <span>{saveMessage.text}</span>
            </Alert>
          )}

          {/* ─── 1. ÜST FORM ALANLARI (DOVIZ FISI ILE BIREBIR 3 SUTUNLU PANEL) ──────────────── */}
          <Row className="g-2 mb-2.5">
            {/* 1. Sütun: Tarih/Saat, Geliş Nedeni, Kur Türü */}
            <Col xs={12} md={4}>
              <div
                className="border rounded-2 shadow-2xs h-100 d-flex flex-column gap-2"
                style={{
                  borderColor: "#cbd5e1",
                  padding: "12px 16px",
                  backgroundColor: activeFisThemeBg,
                }}
              >
                <div className="d-flex flex-row align-items-center gap-2">
                  <label
                    className="small fw-semibold mb-0 text-nowrap"
                    style={{ minWidth: "90px", width: "90px", flexShrink: 0, fontSize: "12.5px", color: "#334155" }}
                  >
                    Tarih / Saat
                  </label>
                  <div className="d-flex flex-grow-1 gap-1" style={{ minWidth: 0 }}>
                    <Form.Control
                      size="sm"
                      type="date"
                      value={tarih}
                      onChange={(e) => setTarih(e.target.value)}
                      className="px-2 py-1"
                      style={{ fontSize: "12.5px", borderColor: "#cbd5e1" }}
                    />
                    <Form.Control
                      size="sm"
                      type="text"
                      value={saat}
                      onChange={(e) => setSaat(e.target.value)}
                      style={{ width: "70px", fontSize: "12.5px", borderColor: "#cbd5e1" }}
                    />
                  </div>
                </div>

                <div className="d-flex flex-row align-items-center gap-2">
                  <label
                    className="small fw-semibold mb-0 text-nowrap"
                    style={{ minWidth: "90px", width: "90px", flexShrink: 0, fontSize: "12.5px", color: "#334155" }}
                  >
                    Geliş nedeni
                  </label>
                  <div className="flex-grow-1" style={{ minWidth: 0 }}>
                    <Form.Control
                      size="sm"
                      type="text"
                      value={gelisNedeni}
                      onChange={(e) => setGelisNedeni(e.target.value)}
                      className="px-2 py-1"
                      style={{ fontSize: "12.5px", borderColor: "#cbd5e1" }}
                    />
                  </div>
                </div>

                <div className="d-flex flex-row align-items-center gap-2">
                  <label
                    className="small fw-semibold mb-0 text-nowrap"
                    style={{ minWidth: "90px", width: "90px", flexShrink: 0, fontSize: "12.5px", color: "#334155" }}
                  >
                    Kur türü
                  </label>
                  <div className="flex-grow-1" style={{ minWidth: 0 }}>
                    <Form.Select
                      size="sm"
                      value={kurTuru}
                      onChange={(e) => handleKurTuruChange(Number(e.target.value))}
                      className="px-2 py-1 fw-bold"
                      style={{ fontSize: "12.5px", borderColor: "#cbd5e1" }}
                    >
                      <option value={0}>Efektif Kurları</option>
                      <option value={1}>Döviz Kurları</option>
                    </Form.Select>
                  </div>
                </div>
              </div>
            </Col>

            {/* 2. Sütun: Seri No, Cari Kodu, Müşteri Ünvanı, Fiş Tipi */}
            <Col xs={12} md={4}>
              <div
                className="border rounded-2 shadow-2xs h-100 d-flex flex-column gap-2"
                style={{
                  borderColor: "#cbd5e1",
                  padding: "12px 16px",
                  backgroundColor: activeFisThemeBg,
                }}
              >
                <div className="d-flex flex-row align-items-center gap-2">
                  <label
                    className="small fw-semibold mb-0 text-nowrap"
                    style={{ minWidth: "85px", width: "85px", flexShrink: 0, fontSize: "12.5px", color: "#334155" }}
                  >
                    Seri no
                  </label>
                  <div className="flex-grow-1" style={{ minWidth: 0 }}>
                    <Form.Control
                      size="sm"
                      type="text"
                      value={seriNo}
                      onChange={(e) => setSeriNo(e.target.value)}
                      placeholder="Seri no..."
                      className="px-2 py-1 font-monospace fw-bold"
                      style={{ fontSize: "12.5px", borderColor: "#cbd5e1" }}
                    />
                  </div>
                </div>

                <div className="d-flex flex-row align-items-center gap-2">
                  <label
                    className="small fw-semibold mb-0 text-nowrap"
                    style={{ minWidth: "85px", width: "85px", flexShrink: 0, fontSize: "12.5px", color: "#334155" }}
                  >
                    Cari kodu
                  </label>
                  <div className="flex-grow-1" style={{ minWidth: 0 }}>
                    <InputGroup size="sm">
                      <Form.Control
                        type="text"
                        value={cariKodu}
                        onChange={(e) => setCariKodu(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            setLookupSearchTerm(e.currentTarget.value);
                            setLookupType("cari");
                          }
                        }}
                        placeholder="Cari kodu..."
                        className="font-monospace fw-bold px-2 py-1"
                        style={{ fontSize: "12.5px", borderColor: "#cbd5e1" }}
                      />
                      <Button
                        variant="outline-secondary"
                        className="px-2 py-0 bg-white"
                        style={{ borderColor: "#cbd5e1" }}
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
                </div>

                <div className="d-flex flex-row align-items-center gap-2">
                  <label
                    className="small fw-semibold mb-0 text-nowrap"
                    style={{ minWidth: "85px", width: "85px", flexShrink: 0, fontSize: "12.5px", color: "#334155" }}
                  >
                    Müşteri
                  </label>
                  <div className="flex-grow-1" style={{ minWidth: 0 }}>
                    <InputGroup size="sm">
                      <Form.Control
                        type="text"
                        value={unvan}
                        onChange={(e) => setUnvan(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            setLookupSearchTerm(e.currentTarget.value);
                            setLookupType("cari");
                          }
                        }}
                        placeholder="Müşteri Adı..."
                        className="fw-bold px-2 py-1"
                        style={{ fontSize: "12.5px", borderColor: "#cbd5e1" }}
                      />
                      <Button
                        variant="outline-secondary"
                        className="px-2 py-0 bg-white"
                        style={{ borderColor: "#cbd5e1" }}
                        onClick={() => {
                          setLookupSearchTerm(unvan === "İSİM BEYAN EDİLMEMİŞTİR" ? "" : unvan);
                          setLookupType("cari");
                        }}
                        title="Cari Listesinden Seç (Dürbün)"
                      >
                        <IconBinoculars size={14} />
                      </Button>
                      <Button
                        variant="outline-primary"
                        className="px-2 py-0 fw-bold d-flex align-items-center gap-1"
                        style={{ fontSize: "11px" }}
                        onClick={() => setShowDetayModal(true)}
                        title="Müşteri Detay Formu (F8)"
                      >
                        <IconUser size={13} /> F8
                      </Button>
                    </InputGroup>
                  </div>
                </div>

                <div className="d-flex flex-row align-items-center gap-2">
                  <label
                    className="small fw-semibold mb-0 text-nowrap"
                    style={{ minWidth: "85px", width: "85px", flexShrink: 0, fontSize: "12.5px", color: "#334155" }}
                  >
                    Fiş tipi
                  </label>
                  <div className="flex-grow-1" style={{ minWidth: 0 }}>
                    <Form.Select
                      id="arbitraj-fis-tip-select"
                      ref={tipSelectRef}
                      size="sm"
                      value={isSatis ? 1 : 0}
                      onChange={(e) => handleToggleIslemYonu(Number(e.target.value) === 1 ? "satis" : "alis")}
                      onKeyDown={(e) => {
                        if (e.key === " " || e.code === "Space") {
                          e.preventDefault();
                          handleToggleIslemYonu();
                        } else if (e.key === "Enter") {
                          e.preventDefault();
                          const firstInput = document.querySelector(".arbitraj-table-code-input") as HTMLInputElement | null;
                          if (firstInput) {
                            firstInput.focus();
                            firstInput.select();
                          }
                        }
                      }}
                      className="fw-bold text-uppercase px-2.5 py-1"
                      style={{
                        fontSize: "12.5px",
                        borderColor: activeFisThemeBorder,
                        color: activeFisThemeText,
                        backgroundColor: "#ffffff",
                      }}
                    >
                      <option value={0}>ALIŞ</option>
                      <option value={1}>SATIŞ</option>
                    </Form.Select>
                  </div>
                </div>
              </div>
            </Col>

            {/* 3. Sütun: Belge No, VKN/TCKN, İstatistik Kodu */}
            <Col xs={12} md={4}>
              <div
                className="border rounded-2 shadow-2xs h-100 d-flex flex-column gap-2"
                style={{
                  borderColor: "#cbd5e1",
                  padding: "12px 16px",
                  backgroundColor: activeFisThemeBg,
                }}
              >
                <div className="d-flex flex-row align-items-center gap-2">
                  <label
                    className="small fw-semibold mb-0 text-nowrap"
                    style={{ minWidth: "100px", width: "100px", flexShrink: 0, fontSize: "12.5px", color: "#334155" }}
                  >
                    Belge no
                  </label>
                  <div className="flex-grow-1" style={{ minWidth: 0 }}>
                    <Form.Control
                      size="sm"
                      type="text"
                      value={belgeNo}
                      onChange={(e) => setBelgeNo(e.target.value)}
                      className="px-2 py-1 font-monospace fw-bold"
                      style={{ fontSize: "12.5px", borderColor: "#cbd5e1" }}
                    />
                  </div>
                </div>

                <div className="d-flex flex-row align-items-center gap-2">
                  <label
                    className="small fw-semibold mb-0 text-nowrap"
                    style={{ minWidth: "100px", width: "100px", flexShrink: 0, fontSize: "12.5px", color: "#334155" }}
                  >
                    VKN / TCKN
                  </label>
                  <div className="flex-grow-1" style={{ minWidth: 0 }}>
                    <Form.Control
                      size="sm"
                      type="text"
                      value={formVknTckn}
                      onChange={(e) => setFormVknTckn(e.target.value)}
                      placeholder="VKN / TCKN..."
                      className="px-2 py-1 font-monospace"
                      style={{ fontSize: "12.5px", borderColor: "#cbd5e1" }}
                    />
                  </div>
                </div>

                <div className="d-flex flex-row align-items-center gap-2">
                  <label
                    className="small fw-semibold mb-0 text-nowrap"
                    style={{ minWidth: "100px", width: "100px", flexShrink: 0, fontSize: "12.5px", color: "#334155" }}
                  >
                    İstatistik kodu
                  </label>
                  <div className="flex-grow-1" style={{ minWidth: 0 }}>
                    <InputGroup size="sm">
                      <Form.Control
                        type="text"
                        value={istatistikKod}
                        onChange={(e) => setIstatistikKod(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            setLookupSearchTerm(e.currentTarget.value);
                            setLookupType("istatistik");
                          }
                        }}
                        placeholder="İstatistik Kodu..."
                        className="font-monospace fw-bold px-2 py-1"
                        style={{ fontSize: "12.5px", borderColor: "#cbd5e1" }}
                      />
                      <Button
                        variant="outline-secondary"
                        className="px-2 py-0 bg-white"
                        style={{ borderColor: "#cbd5e1" }}
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
                </div>
              </div>
            </Col>
          </Row>

          {/* ─── 2. SATIRLAR TABLOSU (DÖVİZ FİŞİ İLE BİREBİR KOLONLAR) ────────────────────── */}
          <Card className="mb-2.5 shadow-2xs border" style={{ borderColor: "#cbd5e1" }}>
            <Card.Header
              className="py-1.5 px-3 d-flex justify-content-between align-items-center border-bottom"
              style={{ backgroundColor: activeFisThemeBg }}
            >
              <div className="d-flex align-items-center gap-2">
                <span className="fw-bold small" style={{ color: activeFisThemeText }}>
                  {isSatis ? "Satılan Kalemler (Çıkış Bacağı)" : "Alınan Kalemler (Giriş Bacağı)"}
                </span>
                <Badge bg={isSatis ? "danger" : "success"} className="px-2 py-0.5">
                  {lines.length} Satır
                </Badge>
              </div>
              <Button
                size="sm"
                variant={isSatis ? "outline-danger" : "outline-success"}
                className="py-0.5 px-2.5 fw-semibold d-flex align-items-center gap-1 bg-white"
                style={{ fontSize: "11.5px" }}
                onClick={handleAddLine}
              >
                <IconPlus size={14} /> Satır Ekle
              </Button>
            </Card.Header>
            <div className="table-responsive" style={{ maxHeight: "260px" }}>
              <Table bordered hover size="sm" className="mb-0 align-middle text-nowrap">
                <thead className="bg-light text-secondary small text-center">
                  <tr>
                    <th style={{ width: "35px" }}>#</th>
                    <th style={{ width: "130px" }}>Kod</th>
                    <th>Tanım / Adı</th>
                    <th style={{ width: "120px" }}>Miktar</th>
                    <th style={{ width: "120px" }}>{isSatis ? "Satış Kuru" : "Alış Kuru"}</th>
                    <th style={{ width: "135px" }}>Tutar (TL)</th>
                    <th style={{ width: "65px" }}>Kom %</th>
                    <th style={{ width: "90px" }}>Komisyon</th>
                    {isSatis && <th style={{ width: "65px" }}>BMV %</th>}
                    {isSatis && <th style={{ width: "90px" }}>BMV</th>}
                    {isSatis && <th style={{ width: "65px" }}>KMV %</th>}
                    {isSatis && <th style={{ width: "90px" }}>KMV</th>}
                    <th style={{ width: "40px" }}>İşlem</th>
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
                              if (e.key === "Enter") {
                                setActiveLookupLineId(l.id);
                                setLookupSearchTerm(e.currentTarget.value);
                                setLookupType("currency");
                              }
                            }}
                            placeholder="USD, EUR..."
                            className="fw-bold font-monospace text-primary arbitraj-table-code-input"
                            style={{ fontSize: "12px", height: "26px" }}
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
                          className="fw-semibold small px-1.5"
                          style={{ fontSize: "12px", height: "26px" }}
                        />
                      </td>
                      <td>
                        <Form.Control
                          size="sm"
                          type="text"
                          className="text-end font-monospace fw-bold px-1.5"
                          style={{ fontSize: "12px", height: "26px" }}
                          value={l.miktar}
                          onChange={(e) => handleUpdateLine(l.id, "miktar", e.target.value)}
                        />
                      </td>
                      <td>
                        <Form.Control
                          size="sm"
                          type="text"
                          className="text-end font-monospace fw-bold text-dark px-1.5"
                          style={{ fontSize: "12px", height: "26px" }}
                          value={l.kur}
                          onChange={(e) => handleUpdateLine(l.id, "kur", e.target.value)}
                        />
                      </td>
                      <td>
                        <Form.Control
                          size="sm"
                          type="text"
                          className="text-end font-monospace fw-bold px-1.5"
                          style={{ fontSize: "12px", height: "26px", color: isSatis ? "#dc2626" : "#16a34a" }}
                          value={l.tutar}
                          onChange={(e) => handleUpdateLine(l.id, "tutar", e.target.value)}
                        />
                      </td>
                      <td>
                        <Form.Control
                          size="sm"
                          type="text"
                          className="text-center font-monospace px-1"
                          style={{ fontSize: "12px", height: "26px" }}
                          value={l.komisyonOrani || ""}
                          onChange={(e) => handleUpdateLine(l.id, "komisyonOrani", e.target.value)}
                        />
                      </td>
                      <td>
                        <Form.Control
                          size="sm"
                          readOnly
                          tabIndex={-1}
                          className="text-end font-monospace px-1.5 bg-light"
                          style={{ fontSize: "12px", height: "26px" }}
                          value={l.komisyon || ""}
                        />
                      </td>
                      {isSatis && (
                        <td>
                          <Form.Control
                            size="sm"
                            readOnly
                            tabIndex={-1}
                            className="text-center font-monospace px-1 bg-light"
                            style={{ fontSize: "12px", height: "26px" }}
                            value={l.bmvOrani || ""}
                          />
                        </td>
                      )}
                      {isSatis && (
                        <td>
                          <Form.Control
                            size="sm"
                            readOnly
                            tabIndex={-1}
                            className="text-end font-monospace px-1.5 bg-light"
                            style={{ fontSize: "12px", height: "26px" }}
                            value={l.bmv || ""}
                          />
                        </td>
                      )}
                      {isSatis && (
                        <td>
                          <Form.Control
                            size="sm"
                            readOnly
                            tabIndex={-1}
                            className="text-center font-monospace px-1 bg-light"
                            style={{ fontSize: "12px", height: "26px" }}
                            value={l.kmvOrani || ""}
                          />
                        </td>
                      )}
                      {isSatis && (
                        <td>
                          <Form.Control
                            size="sm"
                            readOnly
                            tabIndex={-1}
                            className="text-end font-monospace px-1.5 bg-light"
                            style={{ fontSize: "12px", height: "26px" }}
                            value={l.kmv || ""}
                          />
                        </td>
                      )}
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

          {/* ─── 3. ALT TOPLAM, MASRAF VE ARBİTRAJ DENGESİ ───────────────────────────────── */}
          <Card className="border shadow-2xs" style={{ borderColor: "#cbd5e1", backgroundColor: "#ffffff" }}>
            <Card.Body className="p-2.5">
              <Row className="g-2 align-items-center">
                {/* Arbitraj Dengesi & Arka Fiş Eşitleme Butonu */}
                <Col md={5}>
                  <div className="d-flex align-items-center gap-2">
                    <span className="small fw-semibold text-secondary">Arbitraj Dengesi:</span>
                    {Number(hedefTlTutar) > 0 ? (
                      Math.abs(farkTl) <= 0.05 ? (
                        <Badge bg="success" className="px-2.5 py-1.5 fw-bold d-flex align-items-center gap-1">
                          <IconCheck size={14} /> TL Dengesi %100 Eşitlendi
                        </Badge>
                      ) : (
                        <div className="d-flex align-items-center gap-1.5">
                          <Badge bg="warning" text="dark" className="px-2 py-1 fw-bold">
                            Fark: {farkTl.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline-primary"
                            className="py-0 px-2 fw-semibold d-flex align-items-center gap-1"
                            style={{ fontSize: "11px" }}
                            onClick={handleAutoBalance}
                            title="Hedef TL tutarına göre miktarı otomatik dengele"
                          >
                            <IconScale size={13} /> Dengele
                          </Button>
                        </div>
                      )
                    ) : (
                      <span className="text-muted small">Bağımsız Fiş</span>
                    )}
                  </div>
                </Col>

                {/* Toplam Tutar, Toplam Masraf, Ödenecek / Alınacak TL */}
                <Col md={7}>
                  <div className="d-flex align-items-center justify-content-end gap-3 flex-wrap">
                    <div className="d-flex align-items-center gap-1.5">
                      <span className="small fw-bold text-secondary text-nowrap">Toplam Tutar:</span>
                      <Form.Control
                        size="sm"
                        readOnly
                        tabIndex={-1}
                        className="text-end font-monospace fw-bold bg-light"
                        style={{ width: "120px", fontSize: "12.5px" }}
                        value={`${totalTutar.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL`}
                      />
                    </div>

                    <div className="d-flex align-items-center gap-1.5">
                      <span className="small fw-bold text-secondary text-nowrap">Toplam Masraf:</span>
                      <Form.Control
                        size="sm"
                        readOnly
                        tabIndex={-1}
                        className="text-end font-monospace fw-bold bg-light text-muted"
                        style={{ width: "105px", fontSize: "12.5px" }}
                        value={`${totalMasraf.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL`}
                      />
                    </div>

                    <div className="d-flex align-items-center gap-1.5">
                      <span className="small fw-bold text-nowrap" style={{ color: activeFisThemeText }}>
                        {isSatis ? "Alınacak TL:" : "Ödenecek TL:"}
                      </span>
                      <Form.Control
                        size="sm"
                        readOnly
                        tabIndex={-1}
                        className="text-end font-monospace fw-bold"
                        style={{
                          width: "135px",
                          fontSize: "13px",
                          borderColor: activeFisThemeBorder,
                          backgroundColor: activeFisThemeBg,
                          color: activeFisThemeText,
                        }}
                        value={`${sonToplam.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL`}
                      />
                    </div>
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Modal.Body>

        {/* ─── 4. MODAL FOOTER & KISAYOL ÇUBUĞU (DOVİZ FİŞİ ILE BİREBİR) ────────────────────── */}
        <Modal.Footer className="py-2 px-3 bg-white border-top d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-3">
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={() => setShowDetayModal(true)}
              className="fw-bold px-3 d-flex align-items-center gap-1.5"
            >
              <IconUser size={15} />
              <span>[F8] Müşteri Detay</span>
            </Button>
            <span className="text-muted small">
              <kbd>F8</kbd> Detay | <kbd>F10</kbd> Kaydet & Aktar | <kbd>ESC</kbd> Vazgeç
            </span>
          </div>

          <div className="d-flex align-items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose} className="fw-semibold px-3">
              <IconX size={15} className="me-1" /> [ESC] Vazgeç / Kapat
            </Button>

            <Button
              variant={isSatis ? "danger" : "success"}
              size="sm"
              className="fw-bold px-4 shadow-2xs d-flex align-items-center gap-1.5"
              onClick={handleSaveArbitraj}
              disabled={isSaving || totalTutar <= 0}
            >
              <IconDeviceFloppy size={16} />
              <span>[F10] Arbitraj Fişini Kaydet & Aktar</span>
            </Button>
          </div>
        </Modal.Footer>
      </Modal>

      {/* ─── F8) DETAY MODAL (MÜŞTERİ & KİMLİK FORMU) ─────────────────────────────────────── */}
      <Modal
        show={showDetayModal}
        onHide={() => setShowDetayModal(false)}
        size="lg"
        centered
        backdrop="static"
        style={{ zIndex: 1060 }}
      >
        <Modal.Header closeButton className="py-2 px-3 bg-light border-bottom">
          <Modal.Title className="fs-6 fw-bold text-dark d-flex align-items-center gap-2">
            <IconUser size={18} className="text-primary" />
            <span>Müşteri Detay & Kimlik Formu (F8)</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3" style={{ fontSize: "12.5px" }}>
          <div className="d-flex align-items-center gap-2 mb-3 pb-2 border-bottom">
            <span className="fw-semibold text-secondary text-nowrap" style={{ minWidth: "90px" }}>
              Ünvan / Ad
            </span>
            <Form.Control
              type="text"
              size="sm"
              className="fw-bold"
              value={unvan}
              onChange={(e) => setUnvan(e.target.value)}
              placeholder="Müşteri Ünvanı / Adı..."
            />
          </div>

          <Row className="g-3">
            {/* Sol Sütun */}
            <Col md={6}>
              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "115px" }}>
                  Cari tipi
                </span>
                <Form.Select
                  size="sm"
                  value={detayCariTipi}
                  onChange={(e) => setDetayCariTipi(e.target.value)}
                >
                  <option value="Şahıs">Şahıs</option>
                  <option value="Firma">Firma / Şirket</option>
                </Form.Select>
              </div>

              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "115px" }}>
                  Yetkili kişi
                </span>
                <Form.Control
                  size="sm"
                  type="text"
                  value={detayYetkiliKisi}
                  onChange={(e) => setDetayYetkiliKisi(e.target.value)}
                  placeholder="Yetkili Kişi..."
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "115px" }}>
                  Ülke / Uyruk
                </span>
                <div className="d-flex gap-1 flex-grow-1">
                  <Form.Control
                    size="sm"
                    type="text"
                    value={detayUlke}
                    onChange={(e) => setDetayUlke(e.target.value)}
                    placeholder="Ülke"
                  />
                  <Form.Control
                    size="sm"
                    type="text"
                    value={detayUyruk}
                    onChange={(e) => setDetayUyruk(e.target.value)}
                    placeholder="Uyruk"
                  />
                </div>
              </div>

              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "115px" }}>
                  Pasaport no
                </span>
                <Form.Control
                  size="sm"
                  type="text"
                  value={detayPasaportNo}
                  onChange={(e) => setDetayPasaportNo(e.target.value)}
                  placeholder="Pasaport No..."
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "115px" }}>
                  Geçerlilik tarihi
                </span>
                <Form.Control
                  size="sm"
                  type="date"
                  value={detayGecerlilikTarihi}
                  onChange={(e) => setDetayGecerlilikTarihi(e.target.value)}
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "115px" }}>
                  Vergi dairesi
                </span>
                <Form.Control
                  size="sm"
                  type="text"
                  value={detayVergiDairesi}
                  onChange={(e) => setDetayVergiDairesi(e.target.value)}
                  placeholder="Vergi Dairesi..."
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "115px" }}>
                  Meslek
                </span>
                <Form.Control
                  size="sm"
                  type="text"
                  value={detayMeslek}
                  onChange={(e) => setDetayMeslek(e.target.value)}
                  placeholder="Meslek..."
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "115px" }}>
                  Hukuki yapı
                </span>
                <Form.Control
                  size="sm"
                  type="text"
                  value={detayHukukiYapi}
                  onChange={(e) => setDetayHukukiYapi(e.target.value)}
                  placeholder="Hukuki Yapı..."
                />
              </div>
            </Col>

            {/* Sağ Sütun */}
            <Col md={6}>
              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "115px" }}>
                  VKN / TCKN
                </span>
                <Form.Control
                  size="sm"
                  type="text"
                  className="font-monospace fw-bold"
                  value={formVknTckn}
                  onChange={(e) => setFormVknTckn(e.target.value)}
                  placeholder="TCKN veya VKN..."
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "115px" }}>
                  Kimlik seri no
                </span>
                <Form.Control
                  size="sm"
                  type="text"
                  value={detayKimlikSeriNo}
                  onChange={(e) => setDetayKimlikSeriNo(e.target.value)}
                  placeholder="Kimlik Seri No..."
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "115px" }}>
                  Doğum tarihi / yeri
                </span>
                <div className="d-flex gap-1 flex-grow-1">
                  <Form.Control
                    size="sm"
                    type="date"
                    value={detayDogumTarihi}
                    onChange={(e) => setDetayDogumTarihi(e.target.value)}
                  />
                  <Form.Control
                    size="sm"
                    type="text"
                    value={detayDogumYeri}
                    onChange={(e) => setDetayDogumYeri(e.target.value)}
                    placeholder="Doğum Yeri"
                  />
                </div>
              </div>

              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "115px" }}>
                  Baba / Anne adı
                </span>
                <div className="d-flex gap-1 flex-grow-1">
                  <Form.Control
                    size="sm"
                    type="text"
                    value={detayBabaAdi}
                    onChange={(e) => setDetayBabaAdi(e.target.value)}
                    placeholder="Baba Adı"
                  />
                  <Form.Control
                    size="sm"
                    type="text"
                    value={detayAnneAdi}
                    onChange={(e) => setDetayAnneAdi(e.target.value)}
                    placeholder="Anne Adı"
                  />
                </div>
              </div>

              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "115px" }}>
                  Telefon / E-posta
                </span>
                <div className="d-flex gap-1 flex-grow-1">
                  <Form.Control
                    size="sm"
                    type="text"
                    value={detayTelefon}
                    onChange={(e) => setDetayTelefon(e.target.value)}
                    placeholder="Telefon"
                  />
                  <Form.Control
                    size="sm"
                    type="email"
                    value={detayEposta}
                    onChange={(e) => setDetayEposta(e.target.value)}
                    placeholder="E-posta"
                  />
                </div>
              </div>

              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "115px" }}>
                  İl / İlçe
                </span>
                <div className="d-flex gap-1 flex-grow-1">
                  <Form.Control
                    size="sm"
                    type="text"
                    value={detayIl}
                    onChange={(e) => setDetayIl(e.target.value)}
                    placeholder="İl"
                  />
                  <Form.Control
                    size="sm"
                    type="text"
                    value={detayIlce}
                    onChange={(e) => setDetayIlce(e.target.value)}
                    placeholder="İlçe"
                  />
                </div>
              </div>

              <div className="d-flex align-items-center mb-2">
                <span className="text-secondary small text-nowrap" style={{ width: "115px" }}>
                  Adres
                </span>
                <Form.Control
                  size="sm"
                  as="textarea"
                  rows={2}
                  value={detayAdres}
                  onChange={(e) => setDetayAdres(e.target.value)}
                  placeholder="Açık Adres..."
                />
              </div>
            </Col>
          </Row>

          {/* Vekil Bilgileri */}
          <div className="mt-3 pt-2 border-top">
            <Row className="g-2 align-items-center">
              <Col md={3}>
                <div className="d-flex align-items-center">
                  <span className="text-secondary small text-nowrap me-2" style={{ width: "80px" }}>
                    Vekil durumu
                  </span>
                  <Form.Select
                    size="sm"
                    value={detayVekil}
                    onChange={(e) => setDetayVekil(e.target.value)}
                  >
                    <option value="Yok">Yok</option>
                    <option value="Var">Var (Temsilen)</option>
                  </Form.Select>
                </div>
              </Col>
              {detayVekil === "Var" && (
                <>
                  <Col md={3}>
                    <Form.Control
                      size="sm"
                      type="text"
                      value={detayVekilAdi}
                      onChange={(e) => setDetayVekilAdi(e.target.value)}
                      placeholder="Vekil / Temsilci Adı..."
                    />
                  </Col>
                  <Col md={3}>
                    <Form.Control
                      size="sm"
                      type="text"
                      className="font-monospace"
                      value={detayVekilKimlikNo}
                      onChange={(e) => setDetayVekilKimlikNo(e.target.value)}
                      placeholder="Vekil TCKN / Pasaport..."
                    />
                  </Col>
                  <Col md={3}>
                    <Form.Select
                      size="sm"
                      value={detayVekilTipi}
                      onChange={(e) => setDetayVekilTipi(e.target.value)}
                    >
                      <option value="Şahıs">Şahıs</option>
                      <option value="Firma">Firma</option>
                    </Form.Select>
                  </Col>
                </>
              )}
            </Row>
          </div>
        </Modal.Body>
        <Modal.Footer className="py-2 px-3 bg-light border-top d-flex justify-content-between">
          <Button variant="secondary" size="sm" onClick={() => setShowDetayModal(false)}>
            Vazgeç
          </Button>
          <Button
            variant="primary"
            size="sm"
            className="fw-bold px-3"
            onClick={() => setShowDetayModal(false)}
          >
            <IconCheck size={16} className="me-1" /> Detayları Uygula & Kapat
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
