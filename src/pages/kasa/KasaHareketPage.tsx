import React, { useState, useEffect, useCallback, useRef } from "react";
import { useKullaniciYetkisi } from "../../hooks/useKullaniciYetkisi";
import { fisGunu, yerelGun } from "../../utils/fisTarihi";
import { useLocation, useNavigate } from "react-router-dom";
import { Container, Row, Col, Card, Form, Button, Badge, Alert, Modal, InputGroup, Table } from "react-bootstrap";
import {
  IconCoins,
  IconCheck,
  IconBinoculars,
  IconAlertTriangle,
  IconClock,
  IconArrowUpRight,
  IconArrowDownLeft,
  IconBuildingBank,
  IconWallet,
  IconList,
  IconInfoCircle,
} from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import LookupModal, { LookupColumn } from "../../components/common/LookupModal";
import FisDurbunModal from "../../components/common/FisDurbunModal";
import {
  KasaService,
  HesapItem,
  HesapHareketiItem,
  KasaLookups,
  SaveHesapHareketiPayload,
} from "../../services/kasaService";
import { CashDeskService, VezneItem } from "../../services/cashDeskService";
import { VezneTransferiService } from "../../services/vezneTransferiService";
import { CompanyService } from "../../services/companyService";
import {
  parseDecimal,
  formatMiktar,
  formatTutar,
  formatTutarInput,
} from "../../utils/numericInput";

export const KasaHareketPage: React.FC = () => {
  // Tarih değiştirme yetkisi yoksa tarih alanı kilitli (docs/YETKI_VE_VEZNE_YOL_HARITASI.md §4.2; sunucu da denetler)
  const tarihYetkisi = useKullaniciYetkisi().tarihDegistirme;
  const location = useLocation();
  const navigate = useNavigate();
  const isEditPage = location.pathname.includes("hareket-duzeltme");

  // ─── State: Hareket Form Alanları (TODVZ_HESAP_HAREKETI) ───────────────────
  const [hesapHareketiId, setHesapHareketiId] = useState<number | null>(null);
  const [tarih, setTarih] = useState<string>(yerelGun());
  const [aciklama, setAciklama] = useState("");
  const [tip, setTip] = useState<number>(1); // 0: Giriş, 1: Çıkış (Varsayılan: Kasadan Çıkış)

  // Hesap Seçimi (Kayıt sayfasında başlangıçta her zaman boş)
  const [hesapId, setHesapId] = useState<number | null>(null);
  const [hesapKod, setHesapKod] = useState("");
  const [hesapAd, setHesapAd] = useState("");
  const [hesapBakiye, setHesapBakiye] = useState<number>(0);

  // Vezne Seçimi
  const [vezneId, setVezneId] = useState<number | null>(null);
  const [vezneKod, setVezneKod] = useState("");
  const [vezneAd, setVezneAd] = useState("");

  // Para / Birim ve Tutarlar (Kayıt sayfasında meblağ ve açıklamalar her zaman boş başlar)
  const [paraId, setParaId] = useState<number | null>(null);
  const [paraKod, setParaKod] = useState("");
  const [paraAd, setParaAd] = useState("");
  const [meblag, setMeblag] = useState<number | string>("");
  const [kdvOrani, setKdvOrani] = useState<number | string>(0);
  const [kdvTutari, setKdvTutari] = useState<number | string>(0);
  const [degisiklikTakipVar, setDegisiklikTakipVar] = useState<boolean>(true);

  // Read-only denetim alanları
  const [eklemeZamani, setEklemeZamani] = useState<string | null>(null);
  const [guncellemeZamani, setGuncellemeZamani] = useState<string | null>(null);

  // ─── State: UI & Lookups ───────────────────────────────────────────────────
  const [hesapList, setHesapList] = useState<HesapItem[]>([]);
  const [hareketList, setHareketList] = useState<HesapHareketiItem[]>([]);
  const [vezneList, setVezneList] = useState<VezneItem[]>([]);
  const [lookups, setLookups] = useState<KasaLookups>({ vezneler: [], paralar: [] });
  const [vezneBakiyeler, setVezneBakiyeler] = useState<{ paraId: number; paraKodu: string; paraAdi: string; miktar: number }[]>([]);

  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "danger" | "warning" | "info"; message: string } | null>(null);

  // Modallar
  const [showHareketLookup, setShowHareketLookup] = useState(false);
  const [showHesapLookup, setShowHesapLookup] = useState(false);
  const [showVezneLookup, setShowVezneLookup] = useState(false);
  const [showParaLookup, setShowParaLookup] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Modal arama başlangıç değerleri
  const [hesapInitialSearch, setHesapInitialSearch] = useState("");
  const [vezneInitialSearch, setVezneInitialSearch] = useState("");
  const [paraInitialSearch, setParaInitialSearch] = useState("");

  // Input metin değerleri
  const [hesapInputVal, setHesapInputVal] = useState("");
  const [vezneInputVal, setVezneInputVal] = useState("");
  const [paraInputVal, setParaInputVal] = useState("");

  const hasAutoSelectedRef = useRef(false);
  const tarihRef = useRef<HTMLInputElement | null>(null);
  const tipRef = useRef<HTMLSelectElement | null>(null);
  const hesapInputRef = useRef<HTMLInputElement | null>(null);
  const aciklamaRef = useRef<HTMLInputElement | null>(null);
  const meblagRef = useRef<HTMLInputElement | null>(null);
  const paraRef = useRef<HTMLInputElement | null>(null);
  const vezneInputRef = useRef<HTMLInputElement | null>(null);
  const kdvOraniRef = useRef<HTMLInputElement | null>(null);
  const kdvTutariRef = useRef<HTMLInputElement | null>(null);

  // Canlı Tarih/Saat
  const [currentDateTime, setCurrentDateTime] = useState<string>("");
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentDateTime(
        now.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" }) +
          " " +
          now.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const showNotif = (type: "success" | "danger" | "warning" | "info", msg: string) => {
    setNotification({ type, message: msg });
    setTimeout(() => setNotification(null), 4000);
  };

  // ─── Vezne Bakiyelerini Getirme ──────────────────────────────────────────────
  const fetchVezneBakiyeler = useCallback(async (vId?: number | null) => {
    const targetId = vId !== undefined ? vId : vezneId;
    if (!targetId) {
      setVezneBakiyeler([]);
      return;
    }
    try {
      const bList = await VezneTransferiService.getVezneBakiyeler(targetId);
      setVezneBakiyeler(Array.isArray(bList) ? bList : []);
    } catch {
      setVezneBakiyeler([]);
    }
  }, [vezneId]);

  // ─── Hesaplamalar ve Dinamik Değişiklik İşleyicileri ─────────────────────────
  const handleDotToCommaKeyDown = (e: React.KeyboardEvent<any>, onFormattedChange: (val: string) => void) => {
    if (e.key === "." || e.key === "Decimal") {
      e.preventDefault();
      const input = e.currentTarget;
      const raw = input.value;
      if (!raw.includes(",")) {
        const start = input.selectionStart ?? raw.length;
        const end = input.selectionEnd ?? raw.length;
        const nextVal = raw.slice(0, start) + "," + raw.slice(end);
        onFormattedChange(nextVal);
        requestAnimationFrame(() => {
          const commaIdx = nextVal.indexOf(",");
          const pos = commaIdx !== -1 ? commaIdx + 1 : nextVal.length;
          input.setSelectionRange(pos, pos);
        });
      }
    }
  };

  const handleMeblagChange = (val: string) => {
    let raw = val;
    if (raw.length > 1 && raw.startsWith("0") && !raw.startsWith("0,") && !raw.startsWith("0.")) {
      raw = raw.replace(/^0+/, "") || "0";
    }
    const formatted = formatTutarInput(raw);
    setMeblag(formatted);
    const mNum = parseDecimal(formatted);
    const oNum = parseDecimal(kdvOrani);
    if (mNum > 0 && oNum > 0) {
      const kdvVal = parseFloat(((mNum * oNum) / 100).toFixed(4));
      setKdvTutari(formatMiktar(kdvVal));
    } else {
      setKdvTutari("0");
    }
  };

  const handleKdvOraniChange = (val: string) => {
    let raw = val;
    if (raw.length > 1 && raw.startsWith("0") && !raw.startsWith("0,") && !raw.startsWith("0.")) {
      raw = raw.replace(/^0+/, "") || "0";
    }
    const formatted = formatTutarInput(raw);
    setKdvOrani(formatted);
    const mNum = parseDecimal(meblag);
    const oNum = parseDecimal(formatted);
    if (mNum > 0 && oNum > 0) {
      const kdvVal = parseFloat(((mNum * oNum) / 100).toFixed(4));
      setKdvTutari(formatMiktar(kdvVal));
    } else {
      setKdvTutari("0");
    }
  };

  const handleKdvTutariChange = (val: string) => {
    let raw = val;
    if (raw.length > 1 && raw.startsWith("0") && !raw.startsWith("0,") && !raw.startsWith("0.")) {
      raw = raw.replace(/^0+/, "") || "0";
    }
    const formatted = formatTutarInput(raw);
    setKdvTutari(formatted);
    const mNum = parseDecimal(meblag);
    const kNum = parseDecimal(formatted);
    if (mNum > 0 && kNum > 0) {
      const oranVal = parseFloat(((kNum / mNum) * 100).toFixed(2));
      setKdvOrani(formatMiktar(oranVal));
    }
  };

  const meblagNum = parseDecimal(meblag);
  const kdvTutariNum = parseDecimal(kdvTutari);
  const genelToplam = meblagNum + kdvTutariNum;

  const mevcutVezneBakiye = vezneBakiyeler.find(
    (b) => Number(b.paraId) === Number(paraId) || (b.paraKodu && b.paraKodu.toUpperCase() === (paraKod || "").toUpperCase())
  )?.miktar ?? 0;

  // ─── Hesap Seçimi ────────────────────────────────────────────────────────────
  const handleSelectHesap = useCallback((h: HesapItem) => {
    setHesapId(h.hesapId);
    setHesapKod(h.kod || "");
    setHesapAd(h.ad || "");
    setHesapInputVal(h.kod || "");
    setHesapBakiye(h.bakiye || 0);
    const oran = h.kdvOrani ?? 0;
    setKdvOrani(formatMiktar(oran));

    const mNum = parseDecimal(meblag);
    if (mNum > 0 && oran > 0) {
      const kdvVal = parseFloat(((mNum * oran) / 100).toFixed(4));
      setKdvTutari(formatMiktar(kdvVal));
    } else {
      setKdvTutari("0");
    }

    const hesapMetni = `${h.kod || ""} ${h.ad || ""}`.toLocaleUpperCase("tr-TR");
    const isGoldOrProduction =
      hesapMetni.includes("URETIM") ||
      hesapMetni.includes("ÜRETİM") ||
      hesapMetni.includes("İMALAT") ||
      hesapMetni.includes("IMALAT") ||
      hesapMetni.includes("ALTIN");

    if (isGoldOrProduction && lookups.paralar.length > 0) {
      const hasPara =
        lookups.paralar.find((p) => (p.kod || "").toUpperCase() === "HAS") ||
        lookups.paralar.find((p) => (p.ad || "").toUpperCase().includes("HAS")) ||
        lookups.paralar[0];

      if (hasPara) {
        setParaId(hasPara.id);
        setParaKod(hasPara.kod);
        setParaAd(hasPara.ad);
        setParaInputVal(hasPara.kod);
      }
    }

    setTimeout(() => aciklamaRef.current?.focus(), 50);
  }, [lookups.paralar, meblag]);

  // Hesap koduna yazıp Enter'a basıldığında arama ve modal açma mantığı
  const handleHesapKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = (hesapInputVal || "").trim().toLowerCase();
      // Boş ise veya değiştirilmemiş ise modal açma, direkt Açıklama alanına geç
      if (!val || (hesapId && val === (hesapKod || "").trim().toLowerCase())) {
        aciklamaRef.current?.focus();
        aciklamaRef.current?.select();
        return;
      }
      const exact = hesapList.find((h) => (h.kod || "").toLowerCase() === val);
      if (exact) {
        handleSelectHesap(exact);
        return;
      }
      const matches = hesapList.filter((h) =>
        (h.kod || "").toLowerCase().includes(val) ||
        (h.ad || "").toLowerCase().includes(val)
      );
      if (matches.length === 1) {
        handleSelectHesap(matches[0]);
        return;
      }
      setHesapInitialSearch(hesapInputVal.trim());
      setShowHesapLookup(true);
    } else if (e.key === "F4") {
      e.preventDefault();
      setHesapInitialSearch(hesapInputVal.trim());
      setShowHesapLookup(true);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      aciklamaRef.current?.focus();
      aciklamaRef.current?.select();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      tipRef.current?.focus();
    }
  };

  // Para koduna yazıp Enter'a basıldığında arama ve modal açma mantığı
  const handleParaKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = (paraInputVal || "").trim().toLowerCase();
      // Boş ise veya değiştirilmemiş ise modal açma, direkt KDV Oranı alanına geç
      if (!val || (paraId && val === (paraKod || "").trim().toLowerCase())) {
        kdvOraniRef.current?.focus();
        kdvOraniRef.current?.select();
        return;
      }
      const exact = lookups.paralar.find((p) => (p.kod || "").toLowerCase() === val);
      if (exact) {
        setParaId(exact.id);
        setParaKod(exact.kod);
        setParaAd(exact.ad);
        setParaInputVal(exact.kod);
        kdvOraniRef.current?.focus();
        kdvOraniRef.current?.select();
        return;
      }
      const matches = lookups.paralar.filter((p) =>
        (p.kod || "").toLowerCase().includes(val) ||
        (p.ad || "").toLowerCase().includes(val)
      );
      if (matches.length === 1) {
        setParaId(matches[0].id);
        setParaKod(matches[0].kod);
        setParaAd(matches[0].ad);
        setParaInputVal(matches[0].kod);
        kdvOraniRef.current?.focus();
        kdvOraniRef.current?.select();
        return;
      }
      setParaInitialSearch(paraInputVal.trim());
      setShowParaLookup(true);
    } else if (e.key === "F4") {
      e.preventDefault();
      setParaInitialSearch(paraInputVal.trim());
      setShowParaLookup(true);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      kdvOraniRef.current?.focus();
      kdvOraniRef.current?.select();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      meblagRef.current?.focus();
      meblagRef.current?.select();
    }
  };

  // Vezne koduna yazıp Enter'a basıldığında arama ve modal açma mantığı
  const handleVezneKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = (vezneInputVal || "").trim().toLowerCase();
      if (!val) {
        setVezneInitialSearch("");
        setShowVezneLookup(true);
        return;
      }
      const exact = vezneList.find((v) => (v.kod || "").toLowerCase() === val);
      if (exact) {
        setVezneId(exact.id);
        setVezneKod(exact.kod);
        setVezneAd(exact.ad);
        setVezneInputVal(exact.kod);
        fetchVezneBakiyeler(exact.id);
        kdvOraniRef.current?.focus();
        kdvOraniRef.current?.select();
        return;
      }
      const matches = vezneList.filter((v) =>
        (v.kod || "").toLowerCase().includes(val) ||
        (v.ad || "").toLowerCase().includes(val)
      );
      if (matches.length === 1) {
        setVezneId(matches[0].id);
        setVezneKod(matches[0].kod);
        setVezneAd(matches[0].ad);
        setVezneInputVal(matches[0].kod);
        fetchVezneBakiyeler(matches[0].id);
        kdvOraniRef.current?.focus();
        kdvOraniRef.current?.select();
        return;
      }
      setVezneInitialSearch(vezneInputVal.trim());
      setShowVezneLookup(true);
    } else if (e.key === "F4") {
      e.preventDefault();
      setVezneInitialSearch(vezneInputVal.trim());
      setShowVezneLookup(true);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      kdvOraniRef.current?.focus();
      kdvOraniRef.current?.select();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      paraRef.current?.focus();
    }
  };

  // ─── Veri Yükleme ────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    try {
      const [hesaplar, hareketler, lks, vezneler, kullaniciVezneId] = await Promise.all([
        KasaService.getHesaplar(),
        KasaService.getHareketler({ limit: 500 }),
        KasaService.getLookups(),
        CashDeskService.getVezneler().catch(() => []),
        KasaService.getUserVezne().catch(() => null),
      ]);
      const sortedHareketler = Array.isArray(hareketler)
        ? [...hareketler].sort((a, b) => (Number(a.hesapHareketiId) || 0) - (Number(b.hesapHareketiId) || 0))
        : [];
      setHesapList(hesaplar);
      setHareketList(sortedHareketler);
      setLookups(lks);
      setVezneList(vezneler);

      // Sadece kayıt sayfasında varsayılan vezne ve para birimini belirle
      if (!isEditPage) {
        setParaId((prev) => {
          if (prev) return prev;
          if (lks.paralar && lks.paralar.length > 0) {
            const hasAltin = lks.paralar.find((p) => ["HAS", "GR"].includes((p.kod || "").toUpperCase()));
            const defaultPara = hasAltin || lks.paralar[0];
            setParaKod(defaultPara.kod);
            setParaAd(defaultPara.ad);
            setParaInputVal(defaultPara.kod);
            return defaultPara.id;
          }
          return prev;
        });

        setVezneId((prev) => {
          if (prev) {
            fetchVezneBakiyeler(prev);
            return prev;
          }
          const defaultVezne =
            (kullaniciVezneId && vezneler.find((v) => v.id === kullaniciVezneId)) || vezneler[0] || null;
          if (defaultVezne) {
            setVezneKod(defaultVezne.kod);
            setVezneAd(defaultVezne.ad);
            setVezneInputVal(defaultVezne.kod);
            fetchVezneBakiyeler(defaultVezne.id);
            return defaultVezne.id;
          }
          return prev;
        });
      }
    } catch (err: any) {
      showNotif("danger", err?.message || "Kasa hareket verileri yüklenemedi.");
    }
  }, [isEditPage, fetchVezneBakiyeler]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Sayfa ilk açılınca her zaman doğrudan İşlem Türü bölümündeki alana odaklan
  useEffect(() => {
    tipRef.current?.focus();
    const timer = setTimeout(() => {
      tipRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // ─── Hareket Seçimi ──────────────────────────────────────────────────────────
  const handleSelectHareket = useCallback((h: HesapHareketiItem) => {
    setHesapHareketiId(h.hesapHareketiId);
    setTarih((h.tarih || "").slice(0, 10));
    setAciklama(h.aciklama || "");
    setTip(h.tip);
    setHesapId(h.hesapId);
    setHesapKod(h.hesapKod || "");
    setHesapAd(h.hesapAd || "");
    setHesapInputVal(h.hesapKod || "");
    setVezneId(h.vezneId);
    setVezneKod(h.vezneKod || "");
    setVezneAd(h.vezneAd || "");
    setVezneInputVal(h.vezneKod || "");
    setParaId(h.paraId);
    setParaKod(h.paraKodu || "");
    setParaAd(h.paraAdi || "");
    setParaInputVal(h.paraKodu || "");
    setMeblag(h.meblag !== undefined && h.meblag !== null ? formatMiktar(h.meblag) : "");
    const oNum = h.kdvOrani ?? 0;
    setKdvOrani(formatMiktar(oNum));
    const calculatedKdv = h.kdv !== undefined && h.kdv !== null ? h.kdv : (h.meblag && h.kdvOrani ? parseFloat(((h.meblag * h.kdvOrani) / 100).toFixed(4)) : 0);
    setKdvTutari(formatMiktar(calculatedKdv));
    setEklemeZamani(h.eklemeZamani || null);
    setGuncellemeZamani(h.guncellemeZamani || null);

    setHareketList((prev) => {
      if (prev.some((x) => Number(x.hesapHareketiId) === Number(h.hesapHareketiId))) {
        return prev;
      }
      const next = [...prev, h];
      next.sort((a, b) => (Number(a.hesapHareketiId) || 0) - (Number(b.hesapHareketiId) || 0));
      return next;
    });

    // Seçilen hesabın güncel bakiye bilgisini güncelle
    const foundHesap = hesapList.find((x) => x.hesapId === h.hesapId);
    if (foundHesap) {
      setHesapBakiye(foundHesap.bakiye || 0);
    }
    if (h.vezneId) {
      fetchVezneBakiyeler(h.vezneId);
    }
    setTimeout(() => {
      tipRef.current?.focus();
    }, 50);
  }, [hesapList, fetchVezneBakiyeler]);

  // ─── Yeni Kayıt Modu (F4 / Yeni) ───────────────────────────────────────────
  const handleNew = useCallback(() => {
    setHesapHareketiId(null);
    setTarih(yerelGun());
    setAciklama("");
    setTip(1);
    setHesapId(null);
    setHesapKod("");
    setHesapAd("");
    setHesapInputVal("");
    setHesapBakiye(0);
    setKdvOrani("0");
    setKdvTutari("0");
    setMeblag("");
    setEklemeZamani(null);
    setGuncellemeZamani(null);
    if (paraKod) {
      setParaInputVal(paraKod);
    }
    if (vezneId) {
      fetchVezneBakiyeler(vezneId);
    }
    setTimeout(() => tipRef.current?.focus(), 50);
  }, [vezneId, fetchVezneBakiyeler]);

  // URL'de ?id= parametresi varsa sadece ilk yüklemede çek
  const initialUrlCheckedRef = useRef(false);
  useEffect(() => {
    if (initialUrlCheckedRef.current) return;
    const queryParams = new URLSearchParams(location.search);
    const queryId = queryParams.get("id");

    if (isEditPage && queryId && hareketList.length > 0) {
      initialUrlCheckedRef.current = true;
      const match = hareketList.find((h) => String(h.hesapHareketiId) === queryId);
      if (match) {
        handleSelectHareket(match);
      } else {
        KasaService.getHareketById(Number(queryId))
          .then((item) => {
            if (item && item.hesapHareketiId) {
              handleSelectHareket(item);
            }
          })
          .catch(() => {});
      }
    }
  }, [isEditPage, location.search, hareketList, handleSelectHareket]);

  // Sayfa modu değiştiğinde (Kayıt vs Düzeltme)
  const prevPathnameRef = useRef(location.pathname);
  useEffect(() => {
    if (prevPathnameRef.current !== location.pathname) {
      prevPathnameRef.current = location.pathname;
      handleNew();
    }
  }, [location.pathname, handleNew]);

  // Vezne seçildiğinde anlık bakiyeleri yükle
  useEffect(() => {
    if (vezneId) {
      fetchVezneBakiyeler(vezneId);
    } else {
      setVezneBakiyeler([]);
    }
  }, [vezneId, fetchVezneBakiyeler]);

  // ─── Kaydet Aksiyonu (F1) ────────────────────────────────────────────────────
  const handleSave = useCallback(async (): Promise<HesapHareketiItem | null> => {
    if (!hesapId) {
      showNotif("warning", "Lütfen bir hesap kartı seçiniz.");
      setShowHesapLookup(true);
      return null;
    }
    if (!vezneId) {
      showNotif("warning", "Lütfen işlem yapılacak vezneyi seçiniz.");
      setShowVezneLookup(true);
      return null;
    }
    if (!paraId) {
      showNotif("warning", "Lütfen para/gramaj birimini seçiniz.");
      setShowParaLookup(true);
      return null;
    }
    const meblagNumber = parseDecimal(meblag);
    if (!meblag || meblagNumber <= 0) {
      showNotif("warning", "Lütfen geçerli bir gramaj/meblağ giriniz.");
      meblagRef.current?.focus();
      return null;
    }

    setIsSaving(true);
    try {
      const kdvOraniNumber = parseDecimal(kdvOrani);
      const kdvTutariNumber = parseDecimal(kdvTutari);
      const defaultAciklama = aciklama.trim() || `${hesapAd} ${tip === 1 ? "Hammadde Çıkış Fişi" : "Hammadde Giriş Fişi"}`;
      const payload: SaveHesapHareketiPayload = {
        hesapHareketiId,
        hesapId,
        tarih: fisGunu(tarih, !hesapHareketiId, tarihYetkisi),
        aciklama: defaultAciklama,
        paraId,
        meblag: meblagNumber,
        kdvOrani: kdvOraniNumber,
        kdv: kdvTutariNumber,
        tip,
        vezneId,
        degisiklikTakipVar,
      };

      const saved = await KasaService.saveHareket(payload);
      showNotif("success", `Kasa hareketi ${hesapHareketiId ? "güncellendi" : "kaydedildi"}.`);

      // Verileri tazele
      const [updatedHareketler, updatedHesaplar] = await Promise.all([
        KasaService.getHareketler({ limit: 500 }),
        KasaService.getHesaplar(),
      ]);
      const sortedHareketler = Array.isArray(updatedHareketler)
        ? [...updatedHareketler].sort((a, b) => (Number(a.hesapHareketiId) || 0) - (Number(b.hesapHareketiId) || 0))
        : [];
      setHareketList(sortedHareketler);
      setHesapList(updatedHesaplar);

      // Vezne bakiyesini anlık güncelle
      if (vezneId) {
        fetchVezneBakiyeler(vezneId);
      }

      // Kayıt sayfasında kayıt olduktan hemen sonra formu tamamen temizle
      if (!isEditPage) {
        handleNew();
        setTimeout(() => tipRef.current?.focus(), 50);
      } else {
        setHesapHareketiId(saved.hesapHareketiId);
        setAciklama(saved.aciklama || defaultAciklama);
        navigate(`?id=${saved.hesapHareketiId}`, { replace: true });
        setTimeout(() => tipRef.current?.focus(), 50);
      }

      return saved;
    } catch (err: any) {
      showNotif("danger", err?.message || "Kasa hareketi kaydedilirken hata oluştu.");
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [hesapId, vezneId, paraId, meblag, tip, aciklama, hesapAd, hesapHareketiId, tarih, tarihYetkisi, kdvOrani, kdvTutari, degisiklikTakipVar, isEditPage, handleNew, fetchVezneBakiyeler, navigate]);

  // ─── Sil / Geri Al Aksiyonu (F2) ─────────────────────────────────────────────
  const handleDelete = useCallback(async () => {
    if (!hesapHareketiId) return;
    try {
      await KasaService.deleteHareket(hesapHareketiId, degisiklikTakipVar);
      showNotif("success", "Kasa hareketi geri alındı / silindi.");
      setShowDeleteConfirm(false);
      handleNew();

      const [updatedHareketler, updatedHesaplar] = await Promise.all([
        KasaService.getHareketler({ limit: 500 }),
        KasaService.getHesaplar(),
      ]);
      const sortedHareketler = Array.isArray(updatedHareketler)
        ? [...updatedHareketler].sort((a, b) => (Number(a.hesapHareketiId) || 0) - (Number(b.hesapHareketiId) || 0))
        : [];
      setHareketList(sortedHareketler);
      setHesapList(updatedHesaplar);

      if (vezneId) {
        fetchVezneBakiyeler(vezneId);
      }
    } catch (err: any) {
      showNotif("danger", err?.message || "Hareket silinemedi.");
      setShowDeleteConfirm(false);
    }
  }, [hesapHareketiId, degisiklikTakipVar, handleNew, vezneId, fetchVezneBakiyeler]);

  // ─── Kayıtlar Arası Gezinme (Düzeltme Modu) ──────────────────────────────────
  const currentIndex = hareketList.findIndex((h) => Number(h.hesapHareketiId) === Number(hesapHareketiId));

  const handleFirst = useCallback(() => {
    if (hareketList.length > 0) {
      handleSelectHareket(hareketList[0]);
    } else {
      showNotif("info", "Kayıtlı kasa hareketi bulunamadı.");
    }
  }, [hareketList, handleSelectHareket]);

  const handleLast = useCallback(() => {
    if (hareketList.length > 0) {
      handleSelectHareket(hareketList[hareketList.length - 1]);
    } else {
      showNotif("info", "Kayıtlı kasa hareketi bulunamadı.");
    }
  }, [hareketList, handleSelectHareket]);

  const handlePrev = useCallback(() => {
    if (hareketList.length === 0) {
      showNotif("info", "Kayıtlı kasa hareketi bulunamadı.");
      return;
    }
    if (currentIndex === -1) {
      handleSelectHareket(hareketList[hareketList.length - 1]);
      return;
    }
    if (currentIndex <= 0) {
      showNotif("info", "İlk kayıttasınız.");
      return;
    }
    handleSelectHareket(hareketList[currentIndex - 1]);
  }, [hareketList, currentIndex, handleSelectHareket]);

  const handleNext = useCallback(() => {
    if (hareketList.length === 0) {
      showNotif("info", "Kayıtlı kasa hareketi bulunamadı.");
      return;
    }
    if (currentIndex === -1) {
      handleSelectHareket(hareketList[0]);
      return;
    }
    if (currentIndex >= hareketList.length - 1) {
      showNotif("info", "Son kayıttasınız.");
      return;
    }
    handleSelectHareket(hareketList[currentIndex + 1]);
  }, [hareketList, currentIndex, handleSelectHareket]);

  // Klavye kısayolları ve gezinme (F1..F4, PageUp/PageDown, Alt+Sol/Sağ ok)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Modallar açıkken genel kısayolları çalıştırma
      if (
        showHareketLookup ||
        showHesapLookup ||
        showVezneLookup ||
        showParaLookup ||
        showDeleteConfirm
      ) {
        return;
      }

      if (e.key === "F1") {
        e.preventDefault();
        handleSave();
      } else if (e.key === "F2" && isEditPage && hesapHareketiId) {
        e.preventDefault();
        setShowDeleteConfirm(true);
      } else if (e.key === "F3") {
        e.preventDefault();
        setShowHareketLookup(true);
      } else if (e.key === "F4" && !isEditPage) {
        e.preventDefault();
        handleNew();
      } else if (isEditPage) {
        // Düzeltme sayfasında kayıtlar arasında gezinme
        if (e.key === "PageUp" || (e.altKey && e.key === "ArrowLeft")) {
          e.preventDefault();
          handlePrev();
        } else if (e.key === "PageDown" || (e.altKey && e.key === "ArrowRight")) {
          e.preventDefault();
          handleNext();
        } else if ((e.ctrlKey || e.altKey) && e.key === "Home") {
          e.preventDefault();
          handleFirst();
        } else if ((e.ctrlKey || e.altKey) && e.key === "End") {
          e.preventDefault();
          handleLast();
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [
    showHareketLookup,
    showHesapLookup,
    showVezneLookup,
    showParaLookup,
    showDeleteConfirm,
    isEditPage,
    hesapHareketiId,
    handleSave,
    handleNew,
    handlePrev,
    handleNext,
    handleFirst,
    handleLast,
  ]);

  // ─── Lookup Kolonları ────────────────────────────────────────────────────────
  const hareketLookupColumns: LookupColumn<HesapHareketiItem>[] = [
    { header: "İşlem No", width: "90px", render: (it) => <span className="font-monospace fw-bold text-primary">#{it.hesapHareketiId}</span> },
    { header: "Tarih", width: "100px", render: (it) => new Date(it.tarih).toLocaleDateString("tr-TR") },
    { header: "Hesap", render: (it) => `${it.hesapKod || ""} - ${it.hesapAd || ""}` },
    { header: "Açıklama", render: (it) => it.aciklama || "-" },
    { header: "Vezne", width: "110px", render: (it) => it.vezneAd || "-" },
    {
      header: "Gramaj / Meblağ",
      width: "130px",
      align: "right",
      render: (it) => (
        <span className="font-monospace fw-semibold text-end d-block">
          {Number(it.meblag || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} {it.paraKodu || ""}
        </span>
      ),
    },
    {
      header: "Tip",
      width: "90px",
      align: "center",
      render: (it) => <Badge bg={it.tip === 1 ? "danger" : "success"}>{it.tip === 1 ? "Çıkış" : "Giriş"}</Badge>,
    },
  ];

  const hesapLookupColumns: LookupColumn<HesapItem>[] = [
    { header: "Hesap Kodu", width: "130px", render: (it) => <span className="font-monospace fw-bold text-primary">{it.kod}</span> },
    { header: "Hesap Adı", render: (it) => <span className="fw-medium">{it.ad}</span> },
    { header: "KDV Oranı", width: "90px", align: "right", render: (it) => <span className="font-monospace text-end d-block">%{Number(it.kdvOrani || 0)}</span> },
    {
      header: "Bakiye",
      width: "130px",
      align: "right",
      render: (it) => (
        <span className={`font-monospace text-end d-block fw-semibold ${Number(it.bakiye || 0) < 0 ? "text-danger" : "text-success"}`}>
          {Number(it.bakiye || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
        </span>
      ),
    },
  ];

  const vezneColumns: LookupColumn<VezneItem>[] = [
    { header: "Vezne Kodu", render: (i) => <span className="font-monospace fw-bold text-primary">{i.kod}</span>, width: "100px" },
    { header: "Vezne Adı", render: (i) => <span className="fw-medium">{i.ad}</span> },
  ];

  const paraColumns: LookupColumn<{ id: number; kod: string; ad: string }>[] = [
    { header: "Para Kodu", render: (i) => <span className="font-monospace fw-bold text-success">{i.kod}</span>, width: "100px" },
    { header: "Para Adı", render: (i) => <span className="fw-medium">{i.ad}</span> },
  ];

  return (
    <div className="kasa-hareket-page w-100 pb-3" style={{ overflowX: "hidden" }}>
      <style>{`
        .kasa-hareket-page table tbody tr:hover > td,
        .kasa-hareket-page table tbody tr:hover > th,
        .kasa-hareket-page .table-hover tbody tr:hover > td,
        .kasa-hareket-page .table-hover tbody tr:hover > th,
        .kasa-hareket-table.table-hover tbody tr:hover > td,
        .kasa-hareket-table.table-hover tbody tr:hover > th {
          background-color: #ffffff !important;
          color: #0f172a !important;
        }
        .kasa-hareket-page table tbody tr.table-primary:hover > td,
        .kasa-hareket-page table tbody tr.table-primary:hover > th,
        .kasa-hareket-table.table-hover tbody tr.table-primary:hover > td,
        .kasa-hareket-table.table-hover tbody tr.table-primary:hover > th {
          background-color: #eff6ff !important;
          color: #1e40af !important;
        }
        .kasa-hareket-page .form-control-sm,
        .kasa-hareket-page .form-select-sm,
        .kasa-hareket-page .btn-sm {
          padding-top: 0.2rem;
          padding-bottom: 0.2rem;
          font-size: 0.8125rem;
          min-height: 28px;
        }
      `}</style>

      {/* 1. Üst ERP Aksiyon Şeridi (Tek kontrol noktası) */}
      <ERPToolbar
        pageTitle={isEditPage ? "D- Kasa Hareket Düzeltme" : "C- Kasa Hareket Kayıt"}
        pageIcon={<IconCoins size={20} />}
        hideSearch={!isEditPage}
        hideDelete={!isEditPage}
        hideNavigation={!isEditPage}
        disabled={isSaving}
        onSave={handleSave}
        onDelete={() => {
          if (hesapHareketiId) setShowDeleteConfirm(true);
          else showNotif("warning", "Geri alınacak bir kasa hareketi seçiniz.");
        }}
        onNew={isEditPage ? undefined : handleNew}
        hideNew={isEditPage}
        onRefresh={loadAll}
        onSearch={() => setShowHareketLookup(true)}
        onPrint={() => window.print()}
        onFirst={handleFirst}
        onPrev={handlePrev}
        onNext={handleNext}
        onLast={handleLast}
        modeText={hesapHareketiId ? `Düzenleme: #${hesapHareketiId} ${hesapAd}` : "Yeni Hareket Modu"}
        centerContent={
          <div className="d-flex align-items-center gap-1.5 px-3 py-1 bg-white rounded border shadow-2xs text-nowrap">
            <IconBuildingBank size={18} className="text-primary flex-shrink-0" />
            <span className="text-secondary small fw-semibold">Vezne:</span>
            <span className="fw-bold text-dark font-monospace" style={{ fontSize: "14px" }}>
              {vezneAd ? `${vezneKod ? vezneKod + " - " : ""}${vezneAd}` : "Ana Vezne"}
            </span>
            {mevcutVezneBakiye > 0 && (
              <Badge bg="primary-subtle" className="text-primary border border-primary-subtle font-monospace ms-1 px-1.5 py-0.5">
                Bakiye: {formatMiktar(mevcutVezneBakiye)} {paraKod}
              </Badge>
            )}
          </div>
        }
        rightContent={
          <div className="d-flex align-items-center gap-2">
            {hesapHareketiId && (
              <Badge bg={tip === 1 ? "danger" : "success"} className="px-2 py-1 fs-7">
                {tip === 1 ? "Çıkış Fişi" : "Giriş Fişi"}
              </Badge>
            )}
            <div className="d-flex align-items-center text-muted small bg-light px-2 py-1 rounded border font-monospace">
              <IconClock size={14} className="me-1 text-primary" />
              <span>{currentDateTime}</span>
            </div>
          </div>
        }
      />

      {/* Bildirim Paneli */}
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
            ) : notification.type === "info" ? (
              <IconInfoCircle size={18} className="me-2 text-info flex-shrink-0" />
            ) : (
              <IconAlertTriangle size={18} className="me-2 text-danger flex-shrink-0" />
            )}
            <span style={{ fontSize: "13px" }}>{notification.message}</span>
          </Alert>
        </div>
      )}

      {/* 2. Kasa Hareketi Formu */}
      <Card className="border shadow-sm mb-2 w-100 bg-white">
        <Card.Body className="py-2.5 px-3">
          <Row className="g-2">
            <Col lg={6} md={8} sm={12}>
              {/* İşlem Tarihi */}
              <Form.Group as={Row} className="align-items-center g-1" style={{ marginBottom: "4px" }}>
                <Form.Label column style={{ width: "98px", flex: "0 0 98px", maxWidth: "98px", fontSize: "11.5px", whiteSpace: "nowrap" }} className="fw-bold text-secondary text-start py-0 pe-1 ps-0 text-nowrap">
                  İşlem Tarihi <span className="text-danger">*</span> :
                </Form.Label>
                <Col>
                  <div style={{ maxWidth: "145px" }}>
                    <Form.Control
                      ref={tarihRef}
                      type="date"
                      size="sm"
                      value={tarih}
                      onChange={(e) => setTarih(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === "ArrowDown") {
                          e.preventDefault();
                          tipRef.current?.focus();
                        }
                      }}
                      disabled={!tarihYetkisi}
                      title={tarihYetkisi ? undefined : "Tarih değiştirme yetkiniz yok"}
                      className="font-monospace"
                    />
                  </div>
                </Col>
              </Form.Group>

              {/* İşlem Türü (Giriş / Çıkış) */}
              <Form.Group as={Row} className="align-items-center g-1" style={{ marginBottom: "4px" }}>
                <Form.Label column style={{ width: "98px", flex: "0 0 98px", maxWidth: "98px", fontSize: "11.5px", whiteSpace: "nowrap" }} className="fw-bold text-secondary text-start py-0 pe-1 ps-0 text-nowrap">
                  İşlem Türü <span className="text-danger">*</span> :
                </Form.Label>
                <Col>
                  <div style={{ maxWidth: "145px" }}>
                    <Form.Select
                      id="islemTuruSelect"
                      ref={tipRef}
                      autoFocus
                      size="sm"
                      value={tip}
                      onChange={(e) => setTip(Number(e.target.value))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          hesapInputRef.current?.focus();
                          hesapInputRef.current?.select();
                        } else if (e.key === "ArrowUp" && e.altKey) {
                          e.preventDefault();
                          tarihRef.current?.focus();
                        }
                      }}
                      className="fw-semibold"
                    >
                      <option value={1}>Kasadan Çıkış</option>
                      <option value={0}>Kasaya Giriş</option>
                    </Form.Select>
                  </div>
                </Col>
              </Form.Group>

              {/* Hesap Seçimi */}
              <Form.Group as={Row} className="align-items-center g-1" style={{ marginBottom: "4px" }}>
                <Form.Label column style={{ width: "98px", flex: "0 0 98px", maxWidth: "98px", fontSize: "11.5px", whiteSpace: "nowrap" }} className="fw-bold text-secondary text-start py-0 pe-1 ps-0 text-nowrap">
                  Hesap Seçimi <span className="text-danger">*</span> :
                </Form.Label>
                <Col>
                  <div style={{ maxWidth: "145px" }}>
                    <InputGroup size="sm">
                      <Form.Control
                        id="hesapKodInput"
                        ref={hesapInputRef}
                        type="text"
                        placeholder="Hesap kodu yazın..."
                        value={hesapInputVal}
                        onChange={(e) => {
                          setHesapInputVal(e.target.value);
                          if (!e.target.value.trim()) {
                            setHesapId(null);
                            setHesapKod("");
                            setHesapAd("");
                            setHesapBakiye(0);
                          }
                        }}
                        onFocus={(e) => e.target.select()}
                        onKeyDown={handleHesapKeyDown}
                        className="fw-bold font-monospace"
                      />
                      <Button
                        variant="outline-secondary"
                        onClick={() => {
                          setHesapInitialSearch(hesapInputVal.trim());
                          setShowHesapLookup(true);
                        }}
                        title="Hesap Listesinden Seç (F4 / Dürbün)"
                      >
                        <IconBinoculars size={15} />
                      </Button>
                    </InputGroup>
                    {hesapAd && (
                      <div className="text-truncate fw-medium" style={{ fontSize: "11px", marginTop: "2px", lineHeight: "1.2" }} title={hesapAd}>
                        <span className="text-muted">{hesapAd}</span> {hesapBakiye !== 0 && (
                          <span className={`ms-1 fw-bold ${hesapBakiye < 0 ? "text-danger" : "text-success"}`}>
                            ({Number(hesapBakiye).toLocaleString("tr-TR", { minimumFractionDigits: 2 })})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </Col>
              </Form.Group>

              {/* Açıklama */}
              <Form.Group as={Row} className="align-items-center g-1" style={{ marginBottom: "4px" }}>
                <Form.Label column style={{ width: "98px", flex: "0 0 98px", maxWidth: "98px", fontSize: "11.5px", whiteSpace: "nowrap" }} className="fw-bold text-secondary text-start py-0 pe-1 ps-0 text-nowrap">
                  Açıklama :
                </Form.Label>
                <Col>
                  <div style={{ maxWidth: "185px" }}>
                    <Form.Control
                      ref={aciklamaRef}
                      type="text"
                      size="sm"
                      value={aciklama}
                      onChange={(e) => setAciklama(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === "ArrowDown") {
                          e.preventDefault();
                          meblagRef.current?.focus();
                          meblagRef.current?.select();
                        } else if (e.key === "ArrowUp") {
                          e.preventDefault();
                          hesapInputRef.current?.focus();
                          hesapInputRef.current?.select();
                        }
                      }}
                    />
                  </div>
                </Col>
              </Form.Group>

              {/* Gramaj / Meblağ & Para Birimi Seçici */}
              <Form.Group as={Row} className="align-items-center g-1" style={{ marginBottom: "4px" }}>
                <Form.Label column style={{ width: "98px", flex: "0 0 98px", maxWidth: "98px", fontSize: "11.5px", whiteSpace: "nowrap" }} className="fw-bold text-secondary text-start py-0 pe-1 ps-0 text-nowrap">
                  Gramaj / Meblağ <span className="text-danger">*</span> :
                </Form.Label>
                <Col>
                  <div style={{ maxWidth: "185px" }}>
                    <InputGroup size="sm">
                      <Form.Control
                        ref={meblagRef}
                        type="text"
                        inputMode="decimal"
                        value={meblag}
                        onChange={(e) => handleMeblagChange(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            paraRef.current?.focus();
                            paraRef.current?.select();
                          } else if (e.key === "ArrowDown") {
                            e.preventDefault();
                            kdvOraniRef.current?.focus();
                            kdvOraniRef.current?.select();
                          } else if (e.key === "ArrowUp") {
                            e.preventDefault();
                            aciklamaRef.current?.focus();
                            aciklamaRef.current?.select();
                          } else {
                            handleDotToCommaKeyDown(e, handleMeblagChange);
                          }
                        }}
                        onFocus={(e) => e.target.select()}
                        onBlur={() => {
                          const num = parseDecimal(meblag);
                          if (!isNaN(num) && num !== 0) {
                            setMeblag(formatMiktar(num));
                          }
                        }}
                        className="fw-bold font-monospace text-primary text-end allow-full-width"
                        style={{ minWidth: "55px", flex: "1 1 auto" }}
                      />
                      {/* Yazılabilir Para Birimi Kutusu */}
                      <Form.Control
                        ref={paraRef}
                        type="text"
                        placeholder="Para"
                        value={paraInputVal}
                        onChange={(e) => {
                          const val = e.target.value.toUpperCase();
                          setParaInputVal(val);
                          if (!val.trim()) {
                            setParaId(null);
                            setParaKod("");
                            setParaAd("");
                          }
                        }}
                        onFocus={(e) => e.target.select()}
                        onKeyDown={handleParaKeyDown}
                        style={{
                          width: "50px",
                          maxWidth: "50px",
                          minWidth: "50px",
                          fontWeight: "bold",
                          textAlign: "center",
                          textTransform: "uppercase",
                          paddingLeft: "2px",
                          paddingRight: "2px",
                        }}
                        className="bg-light font-monospace text-center flex-shrink-0"
                      />
                      <Button
                        variant="outline-secondary"
                        onClick={() => {
                          setParaInitialSearch(paraInputVal.trim());
                          setShowParaLookup(true);
                        }}
                        title="Para Birimi Ara (F4 / Dürbün)"
                      >
                        <IconBinoculars size={14} />
                      </Button>
                    </InputGroup>
                  </div>
                </Col>
              </Form.Group>

              {/* KDV Oranı (%) & KDV Tutarı */}
              <Form.Group as={Row} className="align-items-center g-1" style={{ marginBottom: "4px" }}>
                <Form.Label column style={{ width: "98px", flex: "0 0 98px", maxWidth: "98px", fontSize: "11.5px", whiteSpace: "nowrap" }} className="fw-bold text-secondary text-start py-0 pe-1 ps-0 text-nowrap">
                  KDV Oranı (%) :
                </Form.Label>
                <Col>
                  <div className="d-flex align-items-center gap-1.5" style={{ maxWidth: "185px" }}>
                    <Form.Control
                      ref={kdvOraniRef}
                      type="text"
                      inputMode="decimal"
                      size="sm"
                      value={kdvOrani}
                      onChange={(e) => handleKdvOraniChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === "ArrowDown") {
                          e.preventDefault();
                          kdvTutariRef.current?.focus();
                          kdvTutariRef.current?.select();
                        } else if (e.key === "ArrowUp") {
                          e.preventDefault();
                          paraRef.current?.focus();
                          paraRef.current?.select();
                        } else {
                          handleDotToCommaKeyDown(e, handleKdvOraniChange);
                        }
                      }}
                      onFocus={(e) => e.target.select()}
                      onBlur={() => {
                        const num = parseDecimal(kdvOrani);
                        if (!isNaN(num)) {
                          setKdvOrani(formatMiktar(num));
                        }
                      }}
                      className="font-monospace text-end"
                      style={{ width: "45px", maxWidth: "45px" }}
                    />
                    <span className="fw-semibold text-secondary flex-shrink-0" style={{ fontSize: "11.5px" }}>Tutar:</span>
                    <Form.Control
                      ref={kdvTutariRef}
                      type="text"
                      inputMode="decimal"
                      size="sm"
                      value={kdvTutari}
                      onChange={(e) => handleKdvTutariChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleSave();
                        } else if (e.key === "ArrowUp") {
                          e.preventDefault();
                          kdvOraniRef.current?.focus();
                          kdvOraniRef.current?.select();
                        } else {
                          handleDotToCommaKeyDown(e, handleKdvTutariChange);
                        }
                      }}
                      onFocus={(e) => e.target.select()}
                      onBlur={() => {
                        const num = parseDecimal(kdvTutari);
                        if (!isNaN(num)) {
                          setKdvTutari(formatMiktar(num));
                        }
                      }}
                      className="font-monospace text-end bg-light fw-semibold"
                      style={{ flex: "1 1 auto", maxWidth: "90px" }}
                    />
                  </div>
                </Col>
              </Form.Group>

              {/* Genel Toplam (Meblağ + KDV) */}
              <Form.Group as={Row} className="align-items-center g-1" style={{ marginBottom: "4px" }}>
                <Form.Label column style={{ width: "98px", flex: "0 0 98px", maxWidth: "98px", fontSize: "11.5px", whiteSpace: "nowrap" }} className="fw-bold text-secondary text-start py-0 pe-1 ps-0 text-nowrap">
                  Toplam Tutar :
                </Form.Label>
                <Col>
                  <div style={{ maxWidth: "185px" }}>
                    <Form.Control
                      type="text"
                      size="sm"
                      readOnly
                      value={`${formatTutar(genelToplam, 2)} ${paraKod || ""}`}
                      className="fw-bold font-monospace bg-light text-end"
                    />
                  </div>
                </Col>
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* ─── MODALLAR ────────────────────────────────────────────────────────── */}

      {/* Hareket Lookup (F3) */}
      {/* Sunucu taraflı gelişmiş filtre (docs/FIS_TARIH_VE_DURBUN_YOL_HARITASI.md D1–D4) */}
      <FisDurbunModal<HesapHareketiItem>
        show={showHareketLookup}
        title="Kasa Hareketi Seçiniz"
        columns={hareketLookupColumns}
        getir={(parametreler, limit) => KasaService.getHareketler({ ...parametreler, limit })}
        sunucuArama
        selectOnDoubleClick={true}
        searchPlaceholder="Açıklama, hesap veya vezne ile arayın..."
        alanlar={{ tarih: true, vezne: true, urun: true, tip: true, cari: true, tutar: true, belgeNo: true }}
        vezneler={vezneList.map((v) => ({ deger: String(v.id), ad: `${v.kod} - ${v.ad}` }))}
        urunler={(lookups.paralar || []).map((p) => ({ deger: String(p.id), ad: `${p.kod} - ${p.ad}` }))}
        tipler={[{ deger: "0", ad: "Giriş" }, { deger: "1", ad: "Çıkış" }]}
        etiketler={{ urun: "Para birimi", cari: "Hesap kodu / adı", tutar: "Gramaj / meblağ", belgeNo: "İşlem no" }}
        onSelect={(selected) => {
          handleSelectHareket(selected);
          setShowHareketLookup(false);
        }}
        onHide={() => setShowHareketLookup(false)}
      />

      {/* Hesap Lookup Modalı */}
      <LookupModal<HesapItem>
        show={showHesapLookup}
        initialSearchTerm={hesapInitialSearch}
        title="Hesap Kartı Seçiniz"
        columns={hesapLookupColumns}
        items={hesapList}
        filterFn={(it, term) => {
          const t = term.toLowerCase();
          return (
            (it.kod ? it.kod.toLowerCase().includes(t) : false) ||
            (it.ad ? it.ad.toLowerCase().includes(t) : false)
          );
        }}
        onSelect={(selected) => {
          handleSelectHesap(selected);
          setShowHesapLookup(false);
          setTimeout(() => aciklamaRef.current?.focus(), 50);
        }}
        onHide={() => {
          setShowHesapLookup(false);
          setTimeout(() => hesapInputRef.current?.focus(), 50);
        }}
      />

      {/* Vezne Lookup Modalı */}
      <LookupModal<VezneItem>
        show={showVezneLookup}
        initialSearchTerm={vezneInitialSearch}
        title="Vezne Seçiniz"
        columns={vezneColumns}
        items={vezneList}
        filterFn={(it, term) => {
          const t = term.toLowerCase();
          return it.kod.toLowerCase().includes(t) || it.ad.toLowerCase().includes(t);
        }}
        onSelect={(selected) => {
          setVezneId(selected.id);
          setVezneKod(selected.kod);
          setVezneAd(selected.ad);
          setVezneInputVal(selected.kod);
          fetchVezneBakiyeler(selected.id);
          setShowVezneLookup(false);
          setTimeout(() => kdvOraniRef.current?.focus(), 50);
        }}
        onHide={() => {
          setShowVezneLookup(false);
          setTimeout(() => vezneInputRef.current?.focus(), 50);
        }}
      />

      {/* Para/Birim Lookup Modalı */}
      <LookupModal<{ id: number; kod: string; ad: string }>
        show={showParaLookup}
        initialSearchTerm={paraInitialSearch}
        title="Para / Gramaj Birimi Seçiniz"
        columns={paraColumns}
        items={lookups.paralar}
        filterFn={(it, term) => {
          const t = term.toLowerCase();
          return it.kod.toLowerCase().includes(t) || it.ad.toLowerCase().includes(t);
        }}
        onSelect={(selected) => {
          setParaId(selected.id);
          setParaKod(selected.kod);
          setParaAd(selected.ad);
          setParaInputVal(selected.kod);
          setShowParaLookup(false);
          setTimeout(() => {
            kdvOraniRef.current?.focus();
            kdvOraniRef.current?.select();
          }, 50);
        }}
        onHide={() => {
          setShowParaLookup(false);
          setTimeout(() => {
            paraRef.current?.focus();
            paraRef.current?.select();
          }, 50);
        }}
      />

      {/* Silme Onay Modalı */}
      <Modal show={showDeleteConfirm} onHide={() => setShowDeleteConfirm(false)} centered size="sm">
        <Modal.Header closeButton>
          <Modal.Title className="fs-6 fw-bold text-danger d-flex align-items-center gap-2">
            <IconAlertTriangle size={18} /> Kasa Hareketini Geri Al
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="py-3 text-center">
          <p className="mb-2 small">
            <strong>#{hesapHareketiId}</strong> numaralı hareket ({hesapAd} - {meblag} {paraKod}) geri alınacak ve vezne bakiyesi eski haline döndürülecektir.
          </p>
          <p className="mb-0 fw-semibold text-danger">Yine de silinsin mi?</p>
        </Modal.Body>
        <Modal.Footer className="py-2">
          <Button variant="secondary" size="sm" onClick={() => setShowDeleteConfirm(false)}>
            Vazgeç
          </Button>
          <Button variant="danger" size="sm" onClick={handleDelete}>
            Evet, Geri Al
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default KasaHareketPage;
