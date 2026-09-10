import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Card,
  Row,
  Col,
  Form,
  Button,
  Table,
  Badge,
  Alert,
  InputGroup,
} from "react-bootstrap";
import {
  IconFileText,
  IconCoins,
  IconBinoculars,
  IconPlus,
  IconTrash,
  IconGripVertical,
  IconArrowsExchange,
  IconArrowRight,
  IconArrowLeft,
  IconScale,
  IconUser,
  IconBuildingBank,
} from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import LookupModal from "../../components/common/LookupModal";
import { CariService, CariKartItem } from "../../services/cariService";
import { apiClient } from "../../services/apiClient";
import {
  CariDekontService,
  CariDekontListItem,
  SaveCariDekontPayload,
} from "../../services/cariDekontService";
import { useAuth } from "../../context/AuthContext";
import { printReportTable } from "../../utils/printReport";

interface VezneItem {
  id: number;
  kod: string;
  ad: string;
}

interface ParaItem {
  id: number;
  kod: string;
  ad: string;
  hasOrani?: number;
}

export interface GridRowState {
  id: string;
  satirNo: number;
  paraId: number;
  paraKodu: string;
  paraAdi: string;
  meblag: number | string;
  hasOrani: number | string;
  hasMiktar: number;
  kur: number | string;
  giseKuru: number | string;
  tutar: number;
  aciklama: string;
}

export const CariEmanetDekontPage: React.FC = () => {
  const { user } = useAuth();

  // Navigation and Saved Dekont List
  const [savedDekonts, setSavedDekonts] = useState<CariDekontListItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);

  // Lookups
  const [cariList, setCariList] = useState<CariKartItem[]>([]);
  const [vezneList, setVezneList] = useState<VezneItem[]>([]);
  const [paraList, setParaList] = useState<ParaItem[]>([]);
  const [isLoadingLookups, setIsLoadingLookups] = useState<boolean>(true);

  // Form State (matching TODVZ_CARI_DEKONT and SODVZ_CARI_DEKONT_KAYDET)
  const [cariDekontId, setCariDekontId] = useState<number | null>(null);
  const [dekontNo, setDekontNo] = useState<string>("");
  const [tip, setTip] = useState<number>(0); // 0: Giriş (Emanet Al), 1: Çıkış (Emanet Ver), 2: Dekont (Virman / Transfer)
  const [tarih, setTarih] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [vade, setVade] = useState<string>("");
  const [iptalTarihi, setIptalTarihi] = useState<string>("");
  const [aciklama, setAciklama] = useState<string>("");
  const [kurCinsi, setKurCinsi] = useState<number>(0); // 0: Serbest Piyasa, 1: Gişe Kuru, 2: TCMB
  const [satirDurumu, setSatirDurumu] = useState<number>(0); // 0: Normal, 1: İptal, 2: Beklemede
  const [evrakTuru, setEvrakTuru] = useState<number>(0); // 0: Cari Dekont, 1: Fiş / Dönüşüm
  const [oncekiId, setOncekiId] = useState<number | null>(null);
  const [oncekiInputText, setOncekiInputText] = useState<string>("");
  const [showOncekiLookupModal, setShowOncekiLookupModal] = useState<boolean>(false);

  // 1. Cari (Girişte Alacaklı / Çıkışta Borçlu / Virman'da Cari 1 Çıkış)
  const [cariKartId, setCariKartId] = useState<number | null>(null);
  const [cariKod, setCariKod] = useState<string>("");
  const [cariAd, setCariAd] = useState<string>("");
  const [cariTelefon, setCariTelefon] = useState<string>("");
  const [cariInputText, setCariInputText] = useState<string>("");
  const [cariSuggestions, setCariSuggestions] = useState<CariKartItem[]>([]);
  const [showCariSuggest, setShowCariSuggest] = useState<boolean>(false);

  // 2. Cari (Sadece tip === 2 Dekont/Virman modunda aktif olan Hedef Cari)
  const [cari2KartId, setCari2KartId] = useState<number | null>(null);
  const [cari2Kod, setCari2Kod] = useState<string>("");
  const [cari2Ad, setCari2Ad] = useState<string>("");
  const [cari2Telefon, setCari2Telefon] = useState<string>("");
  const [cari2InputText, setCari2InputText] = useState<string>("");
  const [cari2Suggestions, setCari2Suggestions] = useState<CariKartItem[]>([]);
  const [showCari2Suggest, setShowCari2Suggest] = useState<boolean>(false);
  const [showCari2Lookup, setShowCari2Lookup] = useState<boolean>(false);

  // Vezne
  const [vezneId, setVezneId] = useState<number>(1);
  const [vezneKod, setVezneKod] = useState<string>("");
  const [vezneAd, setVezneAd] = useState<string>("");

  // Diğer alanlar
  const [teslimEden, setTeslimEden] = useState<string>("");
  const [teslimAlan, setTeslimAlan] = useState<string>("");

  // Helper to create blank row
  const createEmptyRow = (satirNo: number = 1): GridRowState => ({
    id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    satirNo,
    paraId: 0,
    paraKodu: "",
    paraAdi: "",
    meblag: 0,
    hasOrani: 1.0,
    hasMiktar: 0,
    kur: 0,
    giseKuru: 1.0,
    tutar: 0,
    aciklama: "",
  });

  // ÇİFT TARAFLI GRID STATE (Sol Panel ve Sağ Panel)
  const [solSatirlar, setSolSatirlar] = useState<GridRowState[]>([createEmptyRow(1)]);
  const [sagSatirlar, setSagSatirlar] = useState<GridRowState[]>([createEmptyRow(1)]);

  // Aktif taraf ve seçili satır indisleri
  const [activeSide, setActiveSide] = useState<"sol" | "sag">("sol");
  const [selectedSolIndex, setSelectedSolIndex] = useState<number>(0);
  const [selectedSagIndex, setSelectedSagIndex] = useState<number>(0);

  // Drag and drop state
  const [draggedSolIndex, setDraggedSolIndex] = useState<number | null>(null);
  const [dragOverSolIndex, setDragOverSolIndex] = useState<number | null>(null);
  const [draggedSagIndex, setDraggedSagIndex] = useState<number | null>(null);
  const [dragOverSagIndex, setDragOverSagIndex] = useState<number | null>(null);

  // Modals & UI
  const [showDekontSearchModal, setShowDekontSearchModal] = useState<boolean>(false);
  const [showCariLookup, setShowCariLookup] = useState<boolean>(false);
  const [showVezneLookup, setShowVezneLookup] = useState<boolean>(false);
  const [dekontSearchFilter, setDekontSearchFilter] = useState<string>("");
  const [alertInfo, setAlertInfo] = useState<{ type: "success" | "danger" | "warning" | "info"; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Input refs key: `${side}-${rowIndex}-${colKey}`
  const cellRefs = useRef<{ [key: string]: HTMLElement | null }>({});

  // Helper: Kullanıcının kayıtlı veznesini ata
  const applyUserVezne = useCallback(
    (list: VezneItem[]) => {
      if (!list || list.length === 0) return;
      const target = String(user?.cashierCode || "").trim().toLowerCase();
      let matched: VezneItem | undefined;
      if (target) {
        matched = list.find(
          (v) =>
            String(v.id).toLowerCase() === target ||
            v.kod.toLowerCase() === target
        );
        if (!matched && !isNaN(Number(target))) {
          matched = list.find((v) => v.id === Number(target));
        }
      }
      if (!matched && user?.username) {
        matched = list.find((v) => v.ad.toLowerCase().includes(user.username.toLowerCase()));
      }
      if (!matched && list.length > 0) {
        matched = list[0];
      }
      if (matched) {
        setVezneId(matched.id);
        setVezneKod(matched.kod);
        setVezneAd(matched.ad);
      }
    },
    [user]
  );

  // Panel Başlık ve Muhasebe Rol Konfigürasyonu
  const tipConfig = useMemo(() => {
    if (tip === 0) {
      // GİRİŞ (Emanet Al)
      return {
        mode: "giris",
        title: "Emanet Alma (Giriş Dekontu)",
        left: {
          title: "Sol Panel: CARİ Kalemleri",
          subTitle: cariAd ? `${cariKod} - ${cariAd}` : "Müşteriden Gelen Kalemler",
          badge: "MÜŞTERİ / ALACAK (TESLİM ALINAN)",
          badgeBg: "success",
          lineTip: 1,
          icon: <IconUser size={16} className="text-success me-1" />,
        },
        right: {
          title: "Sağ Panel: VEZNE / DEPO Kalemleri",
          subTitle: vezneAd ? `${vezneKod} - ${vezneAd}` : "Kasaya Giren Kalemler",
          badge: "VEZNE / KASAYA GİRİŞ",
          badgeBg: "primary",
          lineTip: 0,
          icon: <IconBuildingBank size={16} className="text-primary me-1" />,
        },
      };
    } else if (tip === 1) {
      // ÇIKIŞ (Emanet Ver)
      return {
        mode: "cikis",
        title: "Emanet Verme (Çıkış Dekontu)",
        left: {
          title: "Sol Panel: VEZNE / DEPO Kalemleri",
          subTitle: vezneAd ? `${vezneKod} - ${vezneAd}` : "Kasadan Çıkan Kalemler",
          badge: "VEZNE / KASADAN ÇIKIŞ",
          badgeBg: "danger",
          lineTip: 1,
          icon: <IconBuildingBank size={16} className="text-danger me-1" />,
        },
        right: {
          title: "Sağ Panel: CARİ Kalemleri",
          subTitle: cariAd ? `${cariKod} - ${cariAd}` : "Müşteriye Verilen Kalemler",
          badge: "MÜŞTERİ / BORÇ (TESLİM EDİLEN)",
          badgeBg: "warning",
          lineTip: 0,
          icon: <IconUser size={16} className="text-warning me-1" />,
        },
      };
    } else {
      // DEKONT (Virman / Karşılıklı Transfer)
      return {
        mode: "virman",
        title: "Dekont (Virman / Karşılıklı Cari Transfer)",
        left: {
          title: "Sol Panel: CARİ 1 (Çıkış Yapan Cari)",
          subTitle: cariAd ? `${cariKod} - ${cariAd}` : "Kaynak Cari (Alacaklı)",
          badge: "CARİ 1 (ÇIKIŞ)",
          badgeBg: "danger",
          lineTip: 1,
          icon: <IconUser size={16} className="text-danger me-1" />,
        },
        right: {
          title: "Sağ Panel: CARİ 2 (Giriş Yapan Cari)",
          subTitle: cari2Ad ? `${cari2Kod} - ${cari2Ad}` : "Hedef Cari (Borçlu)",
          badge: "CARİ 2 (GİRİŞ)",
          badgeBg: "success",
          lineTip: 0,
          icon: <IconUser size={16} className="text-success me-1" />,
        },
      };
    }
  }, [tip, cariKod, cariAd, cari2Kod, cari2Ad, vezneKod, vezneAd]);

  // Lookupları ve Dekont Listesini Yükle
  const loadLookupsAndList = useCallback(async () => {
    setIsLoadingLookups(true);
    try {
      const [cariler, vezneler, paralar, dekontlar] = await Promise.all([
        CariService.getCariKartlar().catch(() => [] as CariKartItem[]),
        apiClient.get<VezneItem[]>("/vezne").then((r) => r.data || []).catch(() => [] as VezneItem[]),
        apiClient.get<ParaItem[]>("/para").then((r) => r.data || []).catch(() => [] as ParaItem[]),
        CariDekontService.getDekontList({ limit: 100 }).catch(() => [] as CariDekontListItem[]),
      ]);

      const trimmedCariler = cariler.map((c) => ({
        ...c,
        kod: (c.kod || "").replace(/\s+/g, " ").trim(),
        ad: (c.ad || "").replace(/\s+/g, " ").trim(),
        telefon: (c.telefon || "").trim(),
      }));
      setCariList(trimmedCariler);
      setVezneList(vezneler);
      setParaList(paralar);
      setSavedDekonts(dekontlar);

      applyUserVezne(vezneler);
      setTeslimAlan("");
    } catch (err: any) {
      console.error("Lookuplar yüklenirken hata:", err);
    } finally {
      setIsLoadingLookups(false);
    }
  }, [applyUserVezne]);

  useEffect(() => {
    loadLookupsAndList();
  }, [loadLookupsAndList]);

  // Dekont Yükleme (Veritabanından Sol ve Sağ Panellere Dağıtma)
  const loadDekontRecord = useCallback(async (recordId: number) => {
    setIsSaving(true);
    try {
      const data = await CariDekontService.getDekontById(recordId);
      setCariDekontId(data.cariDekontId);
      setDekontNo(data.dekontNo);
      setTip(data.tip ?? 0);
      setTarih(data.tarih ? data.tarih.split("T")[0] : new Date().toISOString().split("T")[0]);
      setVade(data.vade ? data.vade.split("T")[0] : "");
      setIptalTarihi(data.iptalTarihi ? data.iptalTarihi.split("T")[0] : "");
      setAciklama(data.aciklama || "");
      setKurCinsi(data.kurCinsi ?? 0);
      setSatirDurumu(data.satirDurumu ?? 0);
      setEvrakTuru(data.evrakTuru ?? 0);
      setOncekiId(data.oncekiId ?? null);
      setOncekiInputText(data.oncekiId ? `DK-${String(data.oncekiId).padStart(6, "0")}` : "");

      try {
        sessionStorage.setItem("lastCariDekontId", String(recordId));
      } catch { }

      // Cari 1
      const activeCariId = data.tip === 0 ? data.alacakliId : data.borcluId;
      const rawKod = data.tip === 0 ? data.alacakliKod : data.borcluKod;
      const rawAd = data.tip === 0 ? data.alacakliAd : data.borcluAd;
      const activeCariKod = (rawKod || "").replace(/\s+/g, " ").trim();
      const activeCariAd = (rawAd || "").replace(/\s+/g, " ").trim();

      const matchedCari = cariList.find((c) => c.id === activeCariId);
      const activeCariTelefon = (
        data.telefon ||
        (data.tip === 0 ? data.alacakliTelefon : data.borcluTelefon) ||
        matchedCari?.telefon ||
        ""
      ).trim();

      setCariKartId(activeCariId || null);
      setCariKod(activeCariKod);
      setCariAd(activeCariAd);
      setCariTelefon(activeCariTelefon);
      setCariInputText(
        activeCariKod && activeCariAd
          ? `${activeCariKod} - ${activeCariAd}`
          : activeCariAd || activeCariKod || ""
      );

      // Cari 2 (Virman durumunda)
      if (data.tip === 2 && data.borcluId && data.borcluId !== data.alacakliId) {
        const c2 = cariList.find((c) => c.id === data.borcluId);
        setCari2KartId(data.borcluId);
        const c2k = (data.borcluKod || c2?.kod || "").replace(/\s+/g, " ").trim();
        const c2a = (data.borcluAd || c2?.ad || "").replace(/\s+/g, " ").trim();
        setCari2Kod(c2k);
        setCari2Ad(c2a);
        setCari2Telefon((data.borcluTelefon || c2?.telefon || "").trim());
        setCari2InputText(c2k && c2a ? `${c2k} - ${c2a}` : c2a || c2k || "");
      } else {
        setCari2KartId(null);
        setCari2Kod("");
        setCari2Ad("");
        setCari2Telefon("");
        setCari2InputText("");
      }

      // Vezne
      setVezneId(data.vezneId);
      setVezneKod((data.vezneKod || "").trim());
      setVezneAd((data.vezneAd || "").trim());

      // Teslim bilgisi
      if (data.tip === 0) {
        setTeslimEden(activeCariAd || "");
        setTeslimAlan((data.ekleyenAd || user?.username || "Veznedar").trim());
      } else {
        setTeslimEden((user?.username || "Veznedar").trim());
        setTeslimAlan(activeCariAd || "");
      }

      // Satırları Sol ve Sağ Panellere Dağıtma
      if (data.satirlar && data.satirlar.length > 0) {
        // Kuyum/Döviz ERP standardı: Sol panel Alacak / Çıkış (TIP: 1), Sağ panel Borç / Giriş (TIP: 0)
        const leftTargetTip = 1;
        const rightTargetTip = 0;

        const leftRows: GridRowState[] = [];
        const rightRows: GridRowState[] = [];

        data.satirlar.forEach((s, idx) => {
          const rowState: GridRowState = {
            id: `row-${s.satirNo || idx + 1}-${Date.now()}-${idx}`,
            satirNo: 1,
            paraId: s.paraId,
            paraKodu: (s.paraKodu || "").trim(),
            paraAdi: (s.paraAdi || "").trim(),
            meblag: s.meblag,
            hasOrani:
              s.hasOrani !== undefined && s.hasOrani !== null && !isNaN(Number(s.hasOrani)) && Number(s.hasOrani) > 0
                ? Number(s.hasOrani)
                : 1.0,
            hasMiktar: s.hasMiktar,
            kur: s.kur,
            giseKuru: s.giseKuru,
            tutar: s.tutar,
            aciklama: s.aciklama || "",
          };

          if (s.tip === leftTargetTip) {
            rowState.satirNo = leftRows.length + 1;
            leftRows.push(rowState);
          } else if (s.tip === rightTargetTip) {
            rowState.satirNo = rightRows.length + 1;
            rightRows.push(rowState);
          } else {
            // Belirsiz satır tipini sol panele al
            rowState.satirNo = leftRows.length + 1;
            leftRows.push(rowState);
          }
        });

        // Eğer eski tek taraflı kayıt varsa ve hepsi tek tarafa düştüyse:
        if (leftRows.length > 0 && rightRows.length === 0) {
          setSolSatirlar(leftRows);
          setSagSatirlar([createEmptyRow(1)]);
        } else if (leftRows.length === 0 && rightRows.length > 0) {
          setSolSatirlar(rightRows);
          setSagSatirlar([createEmptyRow(1)]);
        } else {
          setSolSatirlar(leftRows.length > 0 ? leftRows : [createEmptyRow(1)]);
          setSagSatirlar(rightRows.length > 0 ? rightRows : [createEmptyRow(1)]);
        }
      } else {
        setSolSatirlar([createEmptyRow(1)]);
        setSagSatirlar([createEmptyRow(1)]);
      }

      setAlertInfo({
        type: "info",
        message: `${data.dekontNo} numaralı dekont kaydı yüklendi.`,
      });
    } catch (err: any) {
      setAlertInfo({
        type: "danger",
        message: "Dekont kaydı yüklenemedi: " + (err?.message || err),
      });
    } finally {
      setIsSaving(false);
    }
  }, [cariList, tipConfig, user]);

  // Sayfa yenilendiğinde (F5) son çalışılan dekontu otomatik geri yükle
  const hasRestoredRef = useRef<boolean>(false);
  useEffect(() => {
    if (!isLoadingLookups && !hasRestoredRef.current) {
      hasRestoredRef.current = true;
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const paramId = urlParams.get("id");
        const storedId = sessionStorage.getItem("lastCariDekontId");
        const targetIdToLoad = paramId ? Number(paramId) : storedId ? Number(storedId) : null;
        if (targetIdToLoad && targetIdToLoad > 0) {
          loadDekontRecord(targetIdToLoad);
        }
      } catch { }
    }
  }, [isLoadingLookups, loadDekontRecord]);

  // Yeni Kayıt Butonu (Reset form)
  const handleNew = () => {
    setCariDekontId(null);
    setCurrentIndex(-1);
    setDekontNo("");
    setTarih(new Date().toISOString().split("T")[0]);
    setVade("");
    setIptalTarihi("");
    setOncekiId(null);
    setOncekiInputText("");
    try {
      sessionStorage.removeItem("lastCariDekontId");
    } catch { }
    setTip(0);
    setCariKartId(null);
    setCariKod("");
    setCariAd("");
    setCariTelefon("");
    setCariInputText("");
    setShowCariSuggest(false);
    setCari2KartId(null);
    setCari2Kod("");
    setCari2Ad("");
    setCari2Telefon("");
    setCari2InputText("");
    setShowCari2Suggest(false);
    applyUserVezne(vezneList);
    setAciklama("");
    setKurCinsi(0);
    setSatirDurumu(0);
    setEvrakTuru(0);
    setTeslimEden("");
    setTeslimAlan("");

    setSolSatirlar([createEmptyRow(1)]);
    setSagSatirlar([createEmptyRow(1)]);
    setSelectedSolIndex(0);
    setSelectedSagIndex(0);
    setActiveSide("sol");
    setAlertInfo(null);
  };

  // Önceki Belge Girişi & Dürbün Seçimi
  const handleOncekiInputChange = (val: string) => {
    setOncekiInputText(val);
    const digits = val.replace(/[^0-9]/g, "");
    if (digits) {
      setOncekiId(Number(digits));
    } else {
      setOncekiId(null);
    }
  };

  const handleSelectOncekiDekont = (item: CariDekontListItem) => {
    setOncekiId(item.cariDekontId);
    setOncekiInputText(item.dekontNo || `DK-${String(item.cariDekontId).padStart(6, "0")}`);
    setShowOncekiLookupModal(false);
  };

  // 1. Cari Seçildiğinde
  const handleSelectCari = (cari: CariKartItem) => {
    const cleanKod = (cari.kod || "").replace(/\s+/g, " ").trim();
    const cleanAd = (cari.ad || "").replace(/\s+/g, " ").trim();
    setCariKartId(cari.id);
    setCariKod(cleanKod);
    setCariAd(cleanAd);
    setCariTelefon((cari.telefon || "").trim());
    setCariInputText(cleanKod && cleanAd ? `${cleanKod} - ${cleanAd}` : cleanAd || cleanKod);
    setShowCariSuggest(false);
    if (tip === 0) {
      setTeslimEden(cleanAd);
    } else {
      setTeslimAlan(cleanAd);
    }
    setShowCariLookup(false);
  };

  // 1. Cari Kodu / Adı klavye ile yazıldığında
  const handleCariInputChange = (val: string) => {
    setCariInputText(val);
    const trimmed = val.trim().toLowerCase();
    if (!trimmed) {
      setCariKartId(null);
      setCariKod("");
      setCariAd("");
      setCariTelefon("");
      setCariSuggestions([]);
      setShowCariSuggest(false);
      return;
    }

    const matches = cariList.filter(
      (c) =>
        (c.kod && c.kod.toLowerCase().includes(trimmed)) ||
        (c.ad && c.ad.toLowerCase().includes(trimmed))
    );
    setCariSuggestions(matches.slice(0, 10));
    setShowCariSuggest(matches.length > 0);

    const exact = cariList.find(
      (c) =>
        (c.kod && c.kod.replace(/\s+/g, " ").trim().toLowerCase() === trimmed) ||
        (c.ad && c.ad.replace(/\s+/g, " ").trim().toLowerCase() === trimmed) ||
        `${(c.kod || "").replace(/\s+/g, " ").trim()} - ${(c.ad || "").replace(/\s+/g, " ").trim()}`.toLowerCase() === trimmed
    );
    if (exact) {
      const cleanKod = (exact.kod || "").replace(/\s+/g, " ").trim();
      const cleanAd = (exact.ad || "").replace(/\s+/g, " ").trim();
      setCariKartId(exact.id);
      setCariKod(cleanKod);
      setCariAd(cleanAd);
      setCariTelefon((exact.telefon || "").trim());
      if (tip === 0) setTeslimEden(cleanAd);
      else setTeslimAlan(cleanAd);
    }
  };

  // 2. Cari Seçildiğinde (Virman için)
  const handleSelectCari2 = (cari: CariKartItem) => {
    const cleanKod = (cari.kod || "").replace(/\s+/g, " ").trim();
    const cleanAd = (cari.ad || "").replace(/\s+/g, " ").trim();
    setCari2KartId(cari.id);
    setCari2Kod(cleanKod);
    setCari2Ad(cleanAd);
    setCari2Telefon((cari.telefon || "").trim());
    setCari2InputText(cleanKod && cleanAd ? `${cleanKod} - ${cleanAd}` : cleanAd || cleanKod);
    setShowCari2Suggest(false);
    setShowCari2Lookup(false);
  };

  const handleCari2InputChange = (val: string) => {
    setCari2InputText(val);
    const trimmed = val.trim().toLowerCase();
    if (!trimmed) {
      setCari2KartId(null);
      setCari2Kod("");
      setCari2Ad("");
      setCari2Telefon("");
      setCari2Suggestions([]);
      setShowCari2Suggest(false);
      return;
    }

    const matches = cariList.filter(
      (c) =>
        (c.kod && c.kod.toLowerCase().includes(trimmed)) ||
        (c.ad && c.ad.toLowerCase().includes(trimmed))
    );
    setCari2Suggestions(matches.slice(0, 10));
    setShowCari2Suggest(matches.length > 0);

    const exact = cariList.find(
      (c) =>
        (c.kod && c.kod.replace(/\s+/g, " ").trim().toLowerCase() === trimmed) ||
        (c.ad && c.ad.replace(/\s+/g, " ").trim().toLowerCase() === trimmed) ||
        `${(c.kod || "").replace(/\s+/g, " ").trim()} - ${(c.ad || "").replace(/\s+/g, " ").trim()}`.toLowerCase() === trimmed
    );
    if (exact) {
      const cleanKod = (exact.kod || "").replace(/\s+/g, " ").trim();
      const cleanAd = (exact.ad || "").replace(/\s+/g, " ").trim();
      setCari2KartId(exact.id);
      setCari2Kod(cleanKod);
      setCari2Ad(cleanAd);
      setCari2Telefon((exact.telefon || "").trim());
    }
  };

  // Vezne Seçildiğinde
  const handleSelectVezne = (vezne: VezneItem) => {
    setVezneId(vezne.id);
    setVezneKod(vezne.kod);
    setVezneAd(vezne.ad);
    setShowVezneLookup(false);
  };

  // --- GRID HÜCRE DEĞİŞİKLİK YÖNETİMİ ---
  const handleGridChange = (
    side: "sol" | "sag",
    index: number,
    field: keyof GridRowState,
    value: any
  ) => {
    const setter = side === "sol" ? setSolSatirlar : setSagSatirlar;

    setter((prev) => {
      const copy = [...prev];
      const row = { ...copy[index] };

      if (field === "paraId") {
        const pId = Number(value);
        const selectedPara = paraList.find((p) => p.id === pId);
        row.paraId = pId;
        row.paraKodu = selectedPara?.kod || "";
        row.paraAdi = selectedPara?.ad || "";
        row.hasOrani =
          selectedPara?.hasOrani && selectedPara.hasOrani > 0
            ? selectedPara.hasOrani
            : 1.0;
        const m = parseFloat(String(row.meblag).replace(",", ".")) || 0;
        const h = parseFloat(String(row.hasOrani).replace(",", ".")) || 1.0;
        const k = parseFloat(String(row.kur).replace(",", ".")) || 0;
        row.hasMiktar = Number((m * h).toFixed(3));
        row.tutar = Number((row.hasMiktar * k).toFixed(2));
      } else if (field === "meblag") {
        row.meblag = value;
        const m = parseFloat(String(value).replace(",", ".")) || 0;
        const h = parseFloat(String(row.hasOrani).replace(",", ".")) || 1.0;
        const k = parseFloat(String(row.kur).replace(",", ".")) || 0;
        row.hasMiktar = Number((m * h).toFixed(3));
        row.tutar = Number((row.hasMiktar * k).toFixed(2));
      } else if (field === "hasOrani") {
        row.hasOrani = value;
        const m = parseFloat(String(row.meblag).replace(",", ".")) || 0;
        const h = parseFloat(String(value).replace(",", ".")) || 0;
        const k = parseFloat(String(row.kur).replace(",", ".")) || 0;
        row.hasMiktar = Number((m * h).toFixed(3));
        row.tutar = Number((row.hasMiktar * k).toFixed(2));
      } else if (field === "kur") {
        row.kur = value;
        const k = parseFloat(String(value).replace(",", ".")) || 0;
        row.tutar = Number((row.hasMiktar * k).toFixed(2));
      } else if (field === "giseKuru") {
        row.giseKuru = value;
      } else {
        (row as any)[field] = value;
      }

      copy[index] = row;
      return copy;
    });
  };

  // --- SATIR EKLEME VE SİLME ---
  const handleAddRow = (side: "sol" | "sag") => {
    if (side === "sol") {
      setSolSatirlar((prev) => [...prev, createEmptyRow(prev.length + 1)]);
      setSelectedSolIndex(solSatirlar.length);
      setActiveSide("sol");
    } else {
      setSagSatirlar((prev) => [...prev, createEmptyRow(prev.length + 1)]);
      setSelectedSagIndex(sagSatirlar.length);
      setActiveSide("sag");
    }
  };

  const handleDeleteRow = (side: "sol" | "sag", indexToDelete?: number) => {
    const isSol = side === "sol";
    const currentList = isSol ? solSatirlar : sagSatirlar;
    const currentIdx = indexToDelete !== undefined ? indexToDelete : (isSol ? selectedSolIndex : selectedSagIndex);
    const setter = isSol ? setSolSatirlar : setSagSatirlar;
    const indexSetter = isSol ? setSelectedSolIndex : setSelectedSagIndex;

    if (currentList.length <= 1) {
      setter([createEmptyRow(1)]);
      indexSetter(0);
      return;
    }

    const updated = currentList
      .filter((_, idx) => idx !== currentIdx)
      .map((r, idx) => ({ ...r, satirNo: idx + 1 }));

    setter(updated);
    indexSetter(Math.max(0, currentIdx - 1));
  };

  // --- OTOMATİK EŞİTLEME (DENKLEŞTİRME) ---
  const handleSyncLeftToRight = () => {
    const validLeft = solSatirlar.filter((k) => (parseFloat(String(k.meblag).replace(",", ".")) || 0) > 0);
    if (validLeft.length === 0) {
      setAlertInfo({
        type: "warning",
        message: "Sol panelde sağ tarafa eşitlenecek geçerli bir kalem bulunamadı.",
      });
      return;
    }
    const cloned = validLeft.map((r, i) => ({
      ...r,
      id: `sag-row-${Date.now()}-${i + 1}`,
      satirNo: i + 1,
    }));
    setSagSatirlar(cloned);
    setAlertInfo({
      type: "success",
      message: `${cloned.length} adet kalem sol panelden sağ panele birebir eşitlendi.`,
    });
  };

  const handleSyncRightToLeft = () => {
    const validRight = sagSatirlar.filter((k) => (parseFloat(String(k.meblag).replace(",", ".")) || 0) > 0);
    if (validRight.length === 0) {
      setAlertInfo({
        type: "warning",
        message: "Sağ panelde sol tarafa eşitlenecek geçerli bir kalem bulunamadı.",
      });
      return;
    }
    const cloned = validRight.map((r, i) => ({
      ...r,
      id: `sol-row-${Date.now()}-${i + 1}`,
      satirNo: i + 1,
    }));
    setSolSatirlar(cloned);
    setAlertInfo({
      type: "success",
      message: `${cloned.length} adet kalem sağ panelden sol panele birebir eşitlendi.`,
    });
  };

  // --- DRAG & DROP SATIR SIRALAMA ---
  const handleDropRow = (side: "sol" | "sag", targetIdx: number) => {
    const isSol = side === "sol";
    const dragIdx = isSol ? draggedSolIndex : draggedSagIndex;
    const list = isSol ? solSatirlar : sagSatirlar;
    const setter = isSol ? setSolSatirlar : setSagSatirlar;
    const setDragIdx = isSol ? setDraggedSolIndex : setDraggedSagIndex;
    const setOverIdx = isSol ? setDragOverSolIndex : setDragOverSagIndex;
    const selectSetter = isSol ? setSelectedSolIndex : setSelectedSagIndex;

    if (dragIdx === null || dragIdx === targetIdx) return;
    const updated = [...list];
    const [moved] = updated.splice(dragIdx, 1);
    updated.splice(targetIdx, 0, moved);
    updated.forEach((r, i) => {
      r.satirNo = i + 1;
    });
    setter(updated);
    selectSetter(targetIdx);
    setDragIdx(null);
    setOverIdx(null);
  };

  // --- KLAVYE İLE NAVİGASYON (ENTER & OK TUŞLARI) ---
  const gridColumns = ["paraId", "meblag", "hasOrani", "kur", "giseKuru", "aciklama"];

  const isCursorAtEnd = (target: any) => {
    if (!target) return true;
    if (target.tagName === "SELECT") return true;
    try {
      const val = String(target.value ?? "");
      if (typeof target.selectionStart === "number") {
        return target.selectionStart >= val.length;
      }
    } catch {
      return true;
    }
    return true;
  };

  const isCursorAtStart = (target: any) => {
    if (!target) return true;
    if (target.tagName === "SELECT") return true;
    try {
      if (typeof target.selectionStart === "number") {
        return target.selectionStart === 0 && target.selectionEnd === 0;
      }
    } catch {
      return true;
    }
    return true;
  };

  const handleKeyDown = (
    e: React.KeyboardEvent,
    side: "sol" | "sag",
    rowIndex: number,
    colName: string
  ) => {
    const colIdx = gridColumns.indexOf(colName);
    const target = e.target as any;
    const list = side === "sol" ? solSatirlar : sagSatirlar;
    const setSelectIdx = side === "sol" ? setSelectedSolIndex : setSelectedSagIndex;

    setActiveSide(side);

    if (e.key === "Enter") {
      e.preventDefault();
      if (colIdx < gridColumns.length - 1) {
        const nextCol = gridColumns[colIdx + 1];
        const nextEl = cellRefs.current[`${side}-${rowIndex}-${nextCol}`] as HTMLInputElement | null;
        nextEl?.focus();
        if (nextEl?.select && nextEl.tagName !== "SELECT") nextEl.select();
      } else {
        if (rowIndex < list.length - 1) {
          const nextRowEl = cellRefs.current[`${side}-${rowIndex + 1}-${gridColumns[0]}`] as HTMLElement | null;
          nextRowEl?.focus();
          setSelectIdx(rowIndex + 1);
        } else {
          handleAddRow(side);
          setTimeout(() => {
            const newRowEl = cellRefs.current[`${side}-${rowIndex + 1}-${gridColumns[0]}`] as HTMLElement | null;
            newRowEl?.focus();
            setSelectIdx(rowIndex + 1);
          }, 40);
        }
      }
    } else if (e.key === "ArrowRight") {
      if (isCursorAtEnd(target)) {
        if (colIdx < gridColumns.length - 1) {
          e.preventDefault();
          const nextCol = gridColumns[colIdx + 1];
          const nextEl = cellRefs.current[`${side}-${rowIndex}-${nextCol}`] as HTMLInputElement | null;
          nextEl?.focus();
          if (nextEl?.setSelectionRange && nextEl.tagName !== "SELECT") {
            nextEl.setSelectionRange(0, 0);
          }
        } else if (rowIndex < list.length - 1) {
          e.preventDefault();
          const nextRowEl = cellRefs.current[`${side}-${rowIndex + 1}-${gridColumns[0]}`] as HTMLInputElement | null;
          nextRowEl?.focus();
          setSelectIdx(rowIndex + 1);
        }
      }
    } else if (e.key === "ArrowLeft") {
      if (isCursorAtStart(target)) {
        if (colIdx > 0) {
          e.preventDefault();
          const prevCol = gridColumns[colIdx - 1];
          const prevEl = cellRefs.current[`${side}-${rowIndex}-${prevCol}`] as HTMLInputElement | null;
          prevEl?.focus();
          if (prevEl?.setSelectionRange && prevEl.tagName !== "SELECT") {
            const len = prevEl.value ? prevEl.value.length : 0;
            prevEl.setSelectionRange(len, len);
          }
        } else if (rowIndex > 0) {
          e.preventDefault();
          const prevRowEl = cellRefs.current[`${side}-${rowIndex - 1}-${gridColumns[gridColumns.length - 1]}`] as HTMLInputElement | null;
          prevRowEl?.focus();
          setSelectIdx(rowIndex - 1);
        }
      }
    } else if (e.key === "ArrowDown") {
      if (rowIndex < list.length - 1) {
        e.preventDefault();
        const downEl = cellRefs.current[`${side}-${rowIndex + 1}-${colName}`] as HTMLInputElement | null;
        downEl?.focus();
        setSelectIdx(rowIndex + 1);
      }
    } else if (e.key === "ArrowUp") {
      if (rowIndex > 0) {
        e.preventDefault();
        const upEl = cellRefs.current[`${side}-${rowIndex - 1}-${colName}`] as HTMLInputElement | null;
        upEl?.focus();
        setSelectIdx(rowIndex - 1);
      }
    }
  };

  // --- TOPLAMLAR VE BAKİYE / DENKLEŞTİRME FARKI ---
  const solTotals = useMemo(() => {
    let toplamMiktar = 0;
    let toplamHas = 0;
    let toplamTutar = 0;

    solSatirlar.forEach((k) => {
      const m = parseFloat(String(k.meblag).replace(",", ".")) || 0;
      toplamMiktar += m;
      toplamHas += Number(k.hasMiktar) || 0;
      toplamTutar += Number(k.tutar) || 0;
    });

    return {
      toplamMiktar: Number(toplamMiktar.toFixed(2)),
      toplamHas: Number(toplamHas.toFixed(3)),
      toplamTutar: Number(toplamTutar.toFixed(2)),
      kalemSayisi: solSatirlar.filter((k) => (parseFloat(String(k.meblag).replace(",", ".")) || 0) > 0).length,
    };
  }, [solSatirlar]);

  const sagTotals = useMemo(() => {
    let toplamMiktar = 0;
    let toplamHas = 0;
    let toplamTutar = 0;

    sagSatirlar.forEach((k) => {
      const m = parseFloat(String(k.meblag).replace(",", ".")) || 0;
      toplamMiktar += m;
      toplamHas += Number(k.hasMiktar) || 0;
      toplamTutar += Number(k.tutar) || 0;
    });

    return {
      toplamMiktar: Number(toplamMiktar.toFixed(2)),
      toplamHas: Number(toplamHas.toFixed(3)),
      toplamTutar: Number(toplamTutar.toFixed(2)),
      kalemSayisi: sagSatirlar.filter((k) => (parseFloat(String(k.meblag).replace(",", ".")) || 0) > 0).length,
    };
  }, [sagSatirlar]);

  const balanceDiff = useMemo(() => {
    const hasFarki = Number((solTotals.toplamHas - sagTotals.toplamHas).toFixed(3));
    const tutarFarki = Number((solTotals.toplamTutar - sagTotals.toplamTutar).toFixed(2));
    const isBalanced = Math.abs(hasFarki) < 0.001 && Math.abs(tutarFarki) < 0.01;
    return {
      hasFarki,
      tutarFarki,
      isBalanced,
    };
  }, [solTotals, sagTotals]);

  // --- KAYDET BUTONU ---
  const handleSave = async () => {
    let targetCariId = cariKartId;
    if (!targetCariId && cariInputText.trim()) {
      const trimmed = cariInputText.trim().toLowerCase();
      const found = cariList.find(
        (c) =>
          (c.kod && c.kod.toLowerCase() === trimmed) ||
          (c.ad && c.ad.toLowerCase() === trimmed) ||
          `${c.kod} - ${c.ad}`.toLowerCase() === trimmed
      );
      if (found) {
        targetCariId = found.id;
        setCariKartId(found.id);
      }
    }

    if (!targetCariId && tip !== 1) {
      setAlertInfo({
        type: "danger",
        message: "Lütfen geçerli bir Cari Hesap seçiniz.",
      });
      return;
    }

    const validSol = solSatirlar.filter((k) => (parseFloat(String(k.meblag).replace(",", ".")) || 0) > 0);
    const validSag = sagSatirlar.filter((k) => (parseFloat(String(k.meblag).replace(",", ".")) || 0) > 0);

    if (validSol.length === 0 && validSag.length === 0) {
      setAlertInfo({
        type: "danger",
        message: "Lütfen en az bir tarafa (Sol veya Sağ panel) geçerli para birimi ve miktar içeren dekont kalemi giriniz.",
      });
      return;
    }

    // Satır validasyonları
    const validateLines = (lines: GridRowState[], sideName: string) => {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const seq = line.satirNo || i + 1;
        if (!line.paraId || line.paraId <= 0) {
          throw new Error(`[${sideName} ${seq}. Satır]: Para birimi seçilmemiş.`);
        }
        const m = parseFloat(String(line.meblag).replace(",", ".")) || 0;
        if (isNaN(m) || m <= 0) {
          throw new Error(`[${sideName} ${seq}. Satır]: Miktar 0 veya boş olamaz.`);
        }
      }
    };

    try {
      validateLines(validSol, tipConfig.left.title);
      validateLines(validSag, tipConfig.right.title);
    } catch (valErr: any) {
      setAlertInfo({
        type: "danger",
        message: valErr.message,
      });
      return;
    }

    // Sol ve Sağ satırları doğru TIP ve sıralama ile birleştir
    const solTip = tipConfig.left.lineTip;
    const sagTip = tipConfig.right.lineTip;

    let seqCounter = 1;
    const combinedLines = [
      ...validSol.map((line) => ({
        satirNo: seqCounter++,
        tip: solTip,
        paraId: line.paraId,
        meblag: parseFloat(String(line.meblag).replace(",", ".")) || 0,
        hasOrani: parseFloat(String(line.hasOrani).replace(",", ".")) || 1.0,
        kur: parseFloat(String(line.kur).replace(",", ".")) || 1.0,
        giseKuru: parseFloat(String(line.giseKuru).replace(",", ".")) || 1.0,
        aciklama: line.aciklama,
      })),
      ...validSag.map((line) => ({
        satirNo: seqCounter++,
        tip: sagTip,
        paraId: line.paraId,
        meblag: parseFloat(String(line.meblag).replace(",", ".")) || 0,
        hasOrani: parseFloat(String(line.hasOrani).replace(",", ".")) || 1.0,
        kur: parseFloat(String(line.kur).replace(",", ".")) || 1.0,
        giseKuru: parseFloat(String(line.giseKuru).replace(",", ".")) || 1.0,
        aciklama: line.aciklama,
      })),
    ];

    setIsSaving(true);
    setAlertInfo(null);

    try {
      const payload: SaveCariDekontPayload = {
        cariDekontId: cariDekontId && cariDekontId > 0 ? cariDekontId : null,
        tip,
        tarih,
        aciklama: aciklama.trim() || undefined,
        kurCinsi: Number(kurCinsi) || 0,
        borcluId: tip === 2 ? (cari2KartId || targetCariId || 1) : (targetCariId || 1),
        alacakliId: targetCariId || 1,
        telefon: cariTelefon.trim() || undefined,
        vezneId: vezneId || 1,
        kullaniciId: Number(user?.id) || 1,
        degisiklikTakipVar: true,
        satirDurumu: Number(satirDurumu) || 0,
        evrakTuru: Number(evrakTuru) || 0,
        vade: vade ? vade : null,
        iptalTarihi: iptalTarihi ? iptalTarihi : (satirDurumu === 1 ? new Date().toISOString().split("T")[0] : null),
        oncekiId: oncekiId ? Number(oncekiId) : null,
        satirlar: combinedLines,
      };

      const saved = await CariDekontService.saveDekont(payload);
      setCariDekontId(saved.cariDekontId);
      setDekontNo(saved.dekontNo);
      try {
        sessionStorage.setItem("lastCariDekontId", String(saved.cariDekontId));
      } catch { }

      setAlertInfo({
        type: "success",
        message: `SODVZ_CARI_DEKONT_KAYDET: ${saved.dekontNo} numaralı ${tipConfig.title} başarıyla kaydedildi.`,
      });

      const updatedList = await CariDekontService.getDekontList({ limit: 100 });
      setSavedDekonts(updatedList);
      const newIdx = updatedList.findIndex((d) => d.cariDekontId === saved.cariDekontId);
      if (newIdx !== -1) setCurrentIndex(newIdx);

      await loadDekontRecord(saved.cariDekontId);
    } catch (err: any) {
      setAlertInfo({
        type: "danger",
        message: "Kaydetme hatası: " + (err?.response?.data?.message || err?.message || err),
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Toolbar Sil butonu aktif taraftaki seçili satırı siler
  const handleDelete = () => {
    handleDeleteRow(activeSide);
  };

  // Yazdır
  const handlePrint = () => {
    const solValid = solSatirlar.filter((s) => (parseFloat(String(s.meblag).replace(",", ".")) || 0) > 0);
    const sagValid = sagSatirlar.filter((s) => (parseFloat(String(s.meblag).replace(",", ".")) || 0) > 0);

    const printLines = [
      ...solValid.map((s) => ({ ...s, taraf: tipConfig.left.badge })),
      ...sagValid.map((s) => ({ ...s, taraf: tipConfig.right.badge })),
    ];

    if (printLines.length === 0) {
      setAlertInfo({
        type: "warning",
        message: "Yazdırılacak kalem bulunmuyor.",
      });
      return;
    }

    printReportTable({
      title: `${tipConfig.title} - Dekont No: ${dekontNo || "YENİ"}`,
      subtitle: `Tarih: ${tarih} | ${tipConfig.left.title}: ${cariKod} - ${cariAd} | ${tipConfig.right.title}: ${vezneAd}`,
      data: printLines,
      columns: [
        { header: "Taraf / Yön", render: (k) => k.taraf },
        { header: "Sıra", width: "45px", align: "center", render: (k) => k.satirNo },
        { header: "Cinsi / Para", render: (k) => k.paraAdi || k.paraKodu || "-" },
        {
          header: "Miktar / Gram",
          align: "right",
          render: (k) => (parseFloat(String(k.meblag).replace(",", ".")) || 0).toFixed(2),
        },
        {
          header: "Ayar / Has Oranı",
          align: "right",
          render: (k) => (parseFloat(String(k.hasOrani).replace(",", ".")) || 0).toFixed(3),
        },
        { header: "Has Karşılığı", align: "right", render: (k) => k.hasMiktar.toFixed(3) },
        {
          header: "Rayiç / Kur",
          align: "right",
          render: (k) => {
            const kur = parseFloat(String(k.kur).replace(",", ".")) || 0;
            return kur > 0 ? `${kur.toFixed(2)} ₺` : "-";
          },
        },
        { header: "Tutar", align: "right", render: (k) => `${k.tutar.toFixed(2)} ₺` },
        { header: "Açıklama", render: (k) => k.aciklama || "-" },
      ],
    });
  };

  // Navigasyon tuşları
  const handleFirst = () => {
    if (savedDekonts.length > 0) {
      setCurrentIndex(0);
      loadDekontRecord(savedDekonts[0].cariDekontId);
    }
  };

  const handlePrev = () => {
    if (savedDekonts.length === 0) return;
    const prevIdx = currentIndex > 0 ? currentIndex - 1 : 0;
    setCurrentIndex(prevIdx);
    loadDekontRecord(savedDekonts[prevIdx].cariDekontId);
  };

  const handleNext = () => {
    if (savedDekonts.length === 0) return;
    const nextIdx = currentIndex < savedDekonts.length - 1 ? currentIndex + 1 : savedDekonts.length - 1;
    setCurrentIndex(nextIdx);
    loadDekontRecord(savedDekonts[nextIdx].cariDekontId);
  };

  const handleLast = () => {
    if (savedDekonts.length > 0) {
      const lastIdx = savedDekonts.length - 1;
      setCurrentIndex(lastIdx);
      loadDekontRecord(savedDekonts[lastIdx].cariDekontId);
    }
  };

  // Filtrelenmiş dekont arama listesi
  const filteredDekonts = useMemo(() => {
    if (!dekontSearchFilter.trim()) return savedDekonts;
    const q = dekontSearchFilter.toLowerCase();
    return savedDekonts.filter(
      (d) =>
        d.dekontNo.toLowerCase().includes(q) ||
        d.cariKod.toLowerCase().includes(q) ||
        d.cariAd.toLowerCase().includes(q) ||
        d.vezneAd.toLowerCase().includes(q) ||
        d.aciklama.toLowerCase().includes(q)
    );
  }, [savedDekonts, dekontSearchFilter]);

  // Tekil Grid Panel Bileşeni (Sol veya Sağ panel için yeniden kullanılabilir tablo)
  const renderGridPanel = (side: "sol" | "sag") => {
    const isSol = side === "sol";
    const panelCfg = isSol ? tipConfig.left : tipConfig.right;
    const rows = isSol ? solSatirlar : sagSatirlar;
    const totals = isSol ? solTotals : sagTotals;
    const selectedIdx = isSol ? selectedSolIndex : selectedSagIndex;
    const draggedIdx = isSol ? draggedSolIndex : draggedSagIndex;
    const dragOverIdx = isSol ? dragOverSolIndex : dragOverSagIndex;
    const setDraggedIdx = isSol ? setDraggedSolIndex : setDraggedSagIndex;
    const setDragOverIdx = isSol ? setDragOverSolIndex : setDragOverSagIndex;
    const setSelectedIdx = isSol ? setSelectedSolIndex : setSelectedSagIndex;

    const accentBorderClass = isSol
      ? (tip === 0 ? "border-start border-4 border-success" : tip === 1 ? "border-start border-4 border-danger" : "border-start border-4 border-danger")
      : (tip === 0 ? "border-start border-4 border-primary" : tip === 1 ? "border-start border-4 border-warning" : "border-start border-4 border-success");

    return (
      <Card
        className={`shadow-sm border border-secondary-subtle rounded-3 overflow-hidden h-100 d-flex flex-column ${activeSide === side ? "ring-1 ring-primary" : ""
          }`}
        onClick={() => setActiveSide(side)}
      >
        {/* Panel Başlığı */}
        <Card.Header className={`bg-light py-1.5 px-2.5 border-bottom d-flex align-items-center justify-content-between ${accentBorderClass}`}>
          <div className="d-flex align-items-center gap-1.5 overflow-hidden">
            {panelCfg.icon}
            <div className="d-flex flex-column">
              <div className="d-flex align-items-center gap-1.5">
                <span className="fw-bold small text-dark">{panelCfg.title}</span>
                <Badge bg={panelCfg.badgeBg} className="smaller py-0.5 px-1.5">
                  {panelCfg.badge}
                </Badge>
              </div>
              <span className="text-muted smaller text-truncate font-monospace" style={{ maxWidth: "260px" }}>
                {panelCfg.subTitle}
              </span>
            </div>
          </div>

          {/* Panel Hızlı Düğmeleri */}
          <div className="d-flex align-items-center gap-1">
            {isSol ? (
              <Button
                size="sm"
                variant="outline-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSyncLeftToRight();
                }}
                title="Sol taraftaki satırları sağ panele kopyalar / eşitler"
                className="py-0.5 px-1.5 smaller fw-semibold d-flex align-items-center gap-1"
              >
                <span>➔ Sağa Eşitle</span>
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline-secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSyncRightToLeft();
                }}
                title="Sağ taraftaki satırları sol panele kopyalar / eşitler"
                className="py-0.5 px-1.5 smaller fw-semibold d-flex align-items-center gap-1"
              >
                <span>⬅ Sola Eşitle</span>
              </Button>
            )}

            <Button
              size="sm"
              variant="outline-success"
              onClick={(e) => {
                e.stopPropagation();
                handleAddRow(side);
              }}
              title="Bu panele yeni satır ekle"
              className="py-0.5 px-1.5 smaller fw-semibold d-flex align-items-center gap-1"
            >
              <IconPlus size={13} />
              <span>Ekle</span>
            </Button>

            <Button
              size="sm"
              variant="outline-danger"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteRow(side);
              }}
              title="Bu paneldeki seçili satırı sil"
              className="py-0.5 px-1.5 smaller fw-semibold d-flex align-items-center"
            >
              <IconTrash size={13} />
            </Button>
          </div>
        </Card.Header>

        {/* Panel Tablo Gövdesi */}
        <Card.Body className="p-0 flex-grow-1">
          <div className="table-responsive" style={{ minHeight: "220px", maxHeight: "360px", overflowY: "auto" }}>
            <Table bordered hover size="sm" className="mb-0 align-middle text-nowrap">
              <thead className="table-light sticky-top" style={{ top: 0, zIndex: 2 }}>
                <tr className="smaller text-center user-select-none" style={{ fontSize: "0.74rem" }}>
                  <th style={{ width: "36px" }}>#</th>
                  <th style={{ minWidth: "135px" }}>Cinsi / Para</th>
                  <th style={{ width: "95px" }}>Miktar</th>
                  <th style={{ width: "80px" }}>Ayar/Has</th>
                  <th style={{ width: "95px" }}>Has Karşılığı</th>
                  <th style={{ width: "85px" }}>Kur</th>
                  <th style={{ width: "80px" }}>Gişe</th>
                  <th style={{ width: "95px" }}>Tutar</th>
                  <th style={{ minWidth: "120px" }}>Açıklama</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const isSelected = selectedIdx === idx;
                  const isDragging = draggedIdx === idx;
                  const isDragOver = dragOverIdx === idx;

                  return (
                    <tr
                      key={row.id}
                      draggable={true}
                      onDragStart={(e) => {
                        setDraggedIdx(idx);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        if (dragOverIdx !== idx) setDragOverIdx(idx);
                      }}
                      onDragLeave={() => {
                        if (dragOverIdx === idx) setDragOverIdx(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleDropRow(side, idx);
                      }}
                      onDragEnd={() => {
                        setDraggedIdx(null);
                        setDragOverIdx(null);
                      }}
                      className={`${isSelected ? "table-active" : ""} ${isDragging ? "opacity-25 bg-warning-subtle" : ""
                        } ${isDragOver ? "border-top border-3 border-primary bg-primary-subtle" : ""
                        }`}
                      onClick={() => {
                        setSelectedIdx(idx);
                        setActiveSide(side);
                      }}
                    >
                      <td
                        className="text-center smaller text-muted fw-bold align-middle py-0.5 px-1 user-select-none"
                        style={{ cursor: "grab" }}
                        title="Yukarı/aşağı sürükleyebilirsiniz"
                      >
                        <div className="d-flex align-items-center justify-content-center gap-0.5">
                          <IconGripVertical size={12} className="text-secondary opacity-75" />
                          <span>{row.satirNo}</span>
                        </div>
                      </td>

                      {/* 1. Cinsi / Para */}
                      <td className="p-0.5">
                        <Form.Select
                          ref={(el) => { cellRefs.current[`${side}-${idx}-paraId`] = el; }}
                          size="sm"
                          value={row.paraId}
                          onChange={(e) => handleGridChange(side, idx, "paraId", e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, side, idx, "paraId")}
                          className="py-0 px-1 border-0 bg-transparent fw-semibold smaller"
                          style={{ height: "26px", fontSize: "0.78rem" }}
                        >
                          <option value={0}></option>
                          {paraList.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.kod} - {p.ad}
                            </option>
                          ))}
                        </Form.Select>
                      </td>

                      {/* 2. Miktar */}
                      <td className="p-0.5">
                        <Form.Control
                          ref={(el) => { cellRefs.current[`${side}-${idx}-meblag`] = el; }}
                          size="sm"
                          type="text"
                          inputMode="decimal"
                          value={row.meblag === 0 ? "" : (row.meblag ?? "")}
                          onChange={(e) => handleGridChange(side, idx, "meblag", e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, side, idx, "meblag")}
                          className="text-end font-monospace fw-bold py-0 px-1 border-0 bg-transparent smaller"
                          style={{ height: "26px", fontSize: "0.78rem" }}
                        />
                      </td>

                      {/* 3. Ayar / Has Oranı */}
                      <td className="p-0.5">
                        <Form.Control
                          ref={(el) => { cellRefs.current[`${side}-${idx}-hasOrani`] = el; }}
                          size="sm"
                          type="text"
                          inputMode="decimal"
                          value={row.hasOrani ?? ""}
                          onChange={(e) => handleGridChange(side, idx, "hasOrani", e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, side, idx, "hasOrani")}
                          className="text-end font-monospace py-0 px-1 border-0 bg-transparent smaller"
                          style={{ height: "26px", fontSize: "0.78rem" }}
                        />
                      </td>

                      {/* 4. Has Karşılığı (Readonly) */}
                      <td className="text-end font-monospace fw-bold text-primary pe-2 smaller" style={{ fontSize: "0.78rem" }}>
                        {row.hasMiktar.toFixed(3)}
                      </td>

                      {/* 5. Rayiç / Kur */}
                      <td className="p-0.5">
                        <Form.Control
                          ref={(el) => { cellRefs.current[`${side}-${idx}-kur`] = el; }}
                          size="sm"
                          type="text"
                          inputMode="decimal"
                          value={row.kur === 0 ? "" : (row.kur ?? "")}
                          onChange={(e) => handleGridChange(side, idx, "kur", e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, side, idx, "kur")}
                          className="text-end font-monospace py-0 px-1 border-0 bg-transparent smaller"
                          style={{ height: "26px", fontSize: "0.78rem" }}
                        />
                      </td>

                      {/* 6. Gişe Kuru */}
                      <td className="p-0.5">
                        <Form.Control
                          ref={(el) => { cellRefs.current[`${side}-${idx}-giseKuru`] = el; }}
                          size="sm"
                          type="text"
                          inputMode="decimal"
                          value={row.giseKuru === 0 ? "" : (row.giseKuru ?? "")}
                          onChange={(e) => handleGridChange(side, idx, "giseKuru", e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, side, idx, "giseKuru")}
                          className="text-end font-monospace py-0 px-1 border-0 bg-transparent smaller"
                          style={{ height: "26px", fontSize: "0.78rem" }}
                        />
                      </td>

                      {/* 7. Tutar (Readonly) */}
                      <td className="text-end font-monospace pe-2 smaller" style={{ fontSize: "0.78rem" }}>
                        {row.tutar > 0 ? row.tutar.toLocaleString("tr-TR", { minimumFractionDigits: 2 }) : "-"}
                      </td>

                      {/* 8. Açıklama */}
                      <td className="p-0.5">
                        <Form.Control
                          ref={(el) => { cellRefs.current[`${side}-${idx}-aciklama`] = el; }}
                          size="sm"
                          value={row.aciklama}
                          onChange={(e) => handleGridChange(side, idx, "aciklama", e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, side, idx, "aciklama")}
                          className="py-0 px-1 border-0 bg-transparent smaller"
                          style={{ height: "26px", fontSize: "0.78rem" }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        </Card.Body>

        {/* Panel Alt Toplam Çubuğu */}
        <Card.Footer className="bg-light py-1 px-2 border-top">
          <div className="d-flex align-items-center justify-content-between smaller font-monospace" style={{ fontSize: "0.75rem" }}>
            <div>
              Kalem: <strong className="text-dark">{totals.kalemSayisi}</strong>
            </div>
            <div>
              Miktar: <strong className="text-dark">{totals.toplamMiktar.toFixed(2)}</strong>
            </div>
            <div>
              Has: <strong className="text-primary">{totals.toplamHas.toFixed(3)}g</strong>
            </div>
            <div>
              Tutar: <strong className="text-success">{totals.toplamTutar.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}₺</strong>
            </div>
          </div>
        </Card.Footer>
      </Card>
    );
  };

  return (
    <div className="cari-emanet-dekont-page container-fluid px-2 py-2">
      {/* 1. ERP Ribbon Toolbar */}
      <ERPToolbar
        pageTitle="K- Cari Emanet Dekont"
        pageIcon={<IconFileText size={22} className="text-primary" />}
        onNew={handleNew}
        onSave={handleSave}
        onDelete={handleDelete}
        onSearch={() => setShowDekontSearchModal(true)}
        onFirst={handleFirst}
        onPrev={handlePrev}
        onNext={handleNext}
        onLast={handleLast}
        onRefresh={() => {
          loadLookupsAndList();
          if (cariDekontId) loadDekontRecord(cariDekontId);
        }}
        onClear={handleNew}
        onPrint={handlePrint}
        disabled={isSaving || isLoadingLookups}
        rightContent={
          <div className="d-flex align-items-center gap-2">
            {cariDekontId ? (
              <Badge bg="success" className="px-2 py-1 font-monospace">
                Kayıtlı: {dekontNo || `ID: ${cariDekontId}`}
              </Badge>
            ) : (
              <Badge bg="warning" text="dark" className="px-2 py-1">
                Yeni Dekont Modu
              </Badge>
            )}
          </div>
        }
      />

      {/* Alert Notifications */}
      {alertInfo && (
        <Alert
          variant={alertInfo.type}
          dismissible
          onClose={() => setAlertInfo(null)}
          className="py-1.5 px-3 mb-2"
        >
          {alertInfo.message}
        </Alert>
      )}

      {/* 2. Dekont Başlık ve Parametre Alanları Kartı */}
      <Card className="shadow-sm border border-secondary-subtle rounded-3 overflow-hidden mb-2">
        <Card.Body className="p-2.5 bg-body">
          <Row className="g-2.5">
            {/* Sol Sütun: Dekont & Tarih & Vezne Parametreleri */}
            <Col xs={12} md={6} lg={4}>
              <div className="p-2 border rounded bg-white shadow-2xs h-100 d-flex flex-column justify-content-between">
                {/* 1. Dekont No with Dürbün */}
                <Row className="g-2 align-items-center mb-1.5">
                  <Col xs={4}>
                    <Form.Label className="small fw-semibold mb-0 text-dark">Dekont No</Form.Label>
                  </Col>
                  <Col xs={8}>
                    <InputGroup size="sm">
                      <Form.Control
                        value={dekontNo}
                        onChange={(e) => setDekontNo(e.target.value)}
                        placeholder=""
                        className="fw-bold font-monospace text-primary bg-white"
                      />
                      <Button
                        variant="outline-secondary"
                        onClick={() => setShowDekontSearchModal(true)}
                        title="Dekont Listesi"
                        className="d-flex align-items-center justify-content-center px-2 bg-light border-start-0"
                        style={{ borderColor: "#ced4da" }}
                      >
                        <span className="d-inline-flex align-items-center gap-1" style={{ color: "#7c8db5" }}>
                          <IconBinoculars size={16} strokeWidth={1.8} />
                          <svg
                            width="11"
                            height="11"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <line x1="5" y1="12" x2="19" y2="12" />
                            <polyline points="12 5 19 12 12 19" />
                          </svg>
                        </span>
                      </Button>
                    </InputGroup>
                  </Col>
                </Row>

                {/* 2. İşlem Türü (Giriş, Çıkış, Dekont/Virman) */}
                <Row className="g-2 align-items-center mb-1.5">
                  <Col xs={4}>
                    <Form.Label className="small fw-semibold mb-0 text-dark">İşlem Türü</Form.Label>
                  </Col>
                  <Col xs={8}>
                    <Form.Select
                      size="sm"
                      value={tip}
                      onChange={(e) => setTip(Number(e.target.value))}
                      className="fw-semibold"
                    >
                      <option value={0}>Giriş (Emanet Al)</option>
                      <option value={1}>Çıkış (Emanet Ver)</option>
                      <option value={2}>Dekont (Virman / Transfer)</option>
                    </Form.Select>
                  </Col>
                </Row>

                {/* 3. İşlem Tarihi */}
                <Row className="g-2 align-items-center mb-1.5">
                  <Col xs={4}>
                    <Form.Label className="small fw-semibold mb-0 text-dark">İşlem Tarihi</Form.Label>
                  </Col>
                  <Col xs={8}>
                    <Form.Control
                      type="date"
                      size="sm"
                      value={tarih}
                      onChange={(e) => setTarih(e.target.value)}
                      className="font-monospace"
                    />
                  </Col>
                </Row>

                {/* 4. Vade Tarihi */}
                <Row className="g-2 align-items-center mb-1.5">
                  <Col xs={4}>
                    <Form.Label className="small fw-semibold mb-0 text-dark">Vade Tarihi</Form.Label>
                  </Col>
                  <Col xs={8}>
                    <Form.Control
                      type="date"
                      size="sm"
                      value={vade}
                      onChange={(e) => setVade(e.target.value)}
                      className="font-monospace"
                    />
                  </Col>
                </Row>

                {/* 5. Vezne / Kasa */}
                <Row className="g-2 align-items-center">
                  <Col xs={4}>
                    <Form.Label className="small fw-semibold mb-0 text-dark">Vezne (Sabit)</Form.Label>
                  </Col>
                  <Col xs={8}>
                    <Form.Control
                      size="sm"
                      readOnly
                      value={vezneAd ? `${vezneKod} - ${vezneAd}` : vezneKod}
                      className="bg-light text-secondary fw-semibold"
                      title="Kullanıcının kayıtlı olduğu vezne (Sabit / Değiştirilemez)"
                    />
                  </Col>
                </Row>
              </div>
            </Col>

            {/* Orta Sütun: Cari Hesap Seçimi & İletişim & Kur Cinsi */}
            <Col xs={12} md={6} lg={4}>
              <div className="p-2 border rounded bg-white shadow-2xs h-100 d-flex flex-column justify-content-between">
                {/* 1. Cari Kodu & Ünvanı with Dürbün */}
                <Row className="g-2 align-items-center mb-1.5">
                  <Col xs={4}>
                    <Form.Label className="small fw-semibold mb-0 text-dark">
                      {tip === 2 ? "1. Cari (Çıkış)" : "Cari Kodu / Adı"}
                    </Form.Label>
                  </Col>
                  <Col xs={8} className="position-relative">
                    <InputGroup size="sm">
                      <Form.Control
                        value={cariInputText}
                        onChange={(e) => handleCariInputChange(e.target.value)}
                        onFocus={() => {
                          if (cariInputText.trim()) {
                            const trimmed = cariInputText.trim().toLowerCase();
                            const matches = cariList.filter(
                              (c) =>
                                (c.kod && c.kod.toLowerCase().includes(trimmed)) ||
                                (c.ad && c.ad.toLowerCase().includes(trimmed))
                            );
                            setCariSuggestions(matches.slice(0, 10));
                            setShowCariSuggest(matches.length > 0);
                          }
                        }}
                        onBlur={() => {
                          setTimeout(() => setShowCariSuggest(false), 250);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && showCariSuggest && cariSuggestions.length > 0) {
                            e.preventDefault();
                            handleSelectCari(cariSuggestions[0]);
                          }
                        }}
                        placeholder=""
                        className={cariKartId ? "bg-white fw-bold text-dark" : "bg-white"}
                      />
                      <Button
                        variant="outline-secondary"
                        onClick={() => setShowCariLookup(true)}
                        title="Cari Hesap Listesi"
                        className="d-flex align-items-center justify-content-center px-2 bg-light border-start-0"
                        style={{ borderColor: "#ced4da" }}
                      >
                        <span className="d-inline-flex align-items-center gap-1" style={{ color: "#7c8db5" }}>
                          <IconBinoculars size={16} strokeWidth={1.8} />
                          <svg
                            width="11"
                            height="11"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <line x1="5" y1="12" x2="19" y2="12" />
                            <polyline points="12 5 19 12 12 19" />
                          </svg>
                        </span>
                      </Button>
                    </InputGroup>
                    {showCariSuggest && cariSuggestions.length > 0 && (
                      <div
                        className="position-absolute bg-white border rounded shadow-lg"
                        style={{
                          zIndex: 1050,
                          maxHeight: "220px",
                          overflowY: "auto",
                          top: "100%",
                          left: "8px",
                          right: "8px",
                          marginTop: "2px",
                        }}
                      >
                        {cariSuggestions.map((c) => (
                          <div
                            key={c.id}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleSelectCari(c);
                            }}
                            className="px-2.5 py-1.5 border-bottom d-flex align-items-center justify-content-between cursor-pointer small"
                            style={{ cursor: "pointer" }}
                          >
                            <span className="font-monospace fw-bold text-primary">{c.kod}</span>
                            <span className="text-truncate ms-2 flex-grow-1 text-dark">{c.ad}</span>
                            {c.telefon && <span className="text-muted ms-2 smaller">{c.telefon}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </Col>
                </Row>

                {/* Virman Durumunda 2. Cari Seçimi */}
                {tip === 2 && (
                  <Row className="g-2 align-items-center mb-1.5">
                    <Col xs={4}>
                      <Form.Label className="small fw-semibold mb-0 text-success">
                        2. Cari (Giriş)
                      </Form.Label>
                    </Col>
                    <Col xs={8} className="position-relative">
                      <InputGroup size="sm">
                        <Form.Control
                          value={cari2InputText}
                          onChange={(e) => handleCari2InputChange(e.target.value)}
                          onFocus={() => {
                            if (cari2InputText.trim()) {
                              const trimmed = cari2InputText.trim().toLowerCase();
                              const matches = cariList.filter(
                                (c) =>
                                  (c.kod && c.kod.toLowerCase().includes(trimmed)) ||
                                  (c.ad && c.ad.toLowerCase().includes(trimmed))
                              );
                              setCari2Suggestions(matches.slice(0, 10));
                              setShowCari2Suggest(matches.length > 0);
                            }
                          }}
                          onBlur={() => {
                            setTimeout(() => setShowCari2Suggest(false), 250);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && showCari2Suggest && cari2Suggestions.length > 0) {
                              e.preventDefault();
                              handleSelectCari2(cari2Suggestions[0]);
                            }
                          }}
                          placeholder=""
                          className={cari2KartId ? "bg-white fw-bold text-success" : "bg-white"}
                        />
                        <Button
                          variant="outline-secondary"
                          onClick={() => setShowCari2Lookup(true)}
                          title="2. Cari Hesap Listesi"
                          className="d-flex align-items-center justify-content-center px-2 bg-light border-start-0"
                          style={{ borderColor: "#ced4da" }}
                        >
                          <span className="d-inline-flex align-items-center gap-1" style={{ color: "#7c8db5" }}>
                            <IconBinoculars size={16} strokeWidth={1.8} />
                          </span>
                        </Button>
                      </InputGroup>
                      {showCari2Suggest && cari2Suggestions.length > 0 && (
                        <div
                          className="position-absolute bg-white border rounded shadow-lg"
                          style={{
                            zIndex: 1050,
                            maxHeight: "220px",
                            overflowY: "auto",
                            top: "100%",
                            left: "8px",
                            right: "8px",
                            marginTop: "2px",
                          }}
                        >
                          {cari2Suggestions.map((c) => (
                            <div
                              key={c.id}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleSelectCari2(c);
                              }}
                              className="px-2.5 py-1.5 border-bottom d-flex align-items-center justify-content-between cursor-pointer small"
                              style={{ cursor: "pointer" }}
                            >
                              <span className="font-monospace fw-bold text-success">{c.kod}</span>
                              <span className="text-truncate ms-2 flex-grow-1 text-dark">{c.ad}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </Col>
                  </Row>
                )}

                {/* 2. Telefon */}
                <Row className="g-2 align-items-center mb-1.5">
                  <Col xs={4}>
                    <Form.Label className="small fw-semibold mb-0 text-dark">Telefon</Form.Label>
                  </Col>
                  <Col xs={8}>
                    <Form.Control
                      size="sm"
                      value={cariTelefon}
                      onChange={(e) => setCariTelefon(e.target.value)}
                    />
                  </Col>
                </Row>

                {/* 3. Teslim Eden */}
                <Row className="g-2 align-items-center mb-1.5">
                  <Col xs={4}>
                    <Form.Label className="small fw-semibold mb-0 text-dark">Teslim Eden</Form.Label>
                  </Col>
                  <Col xs={8}>
                    <Form.Control
                      size="sm"
                      value={teslimEden}
                      onChange={(e) => setTeslimEden(e.target.value)}
                    />
                  </Col>
                </Row>

                {/* 4. Teslim Alan */}
                <Row className="g-2 align-items-center mb-1.5">
                  <Col xs={4}>
                    <Form.Label className="small fw-semibold mb-0 text-dark">Teslim Alan</Form.Label>
                  </Col>
                  <Col xs={8}>
                    <Form.Control
                      size="sm"
                      value={teslimAlan}
                      onChange={(e) => setTeslimAlan(e.target.value)}
                    />
                  </Col>
                </Row>

                {/* 5. Kur Cinsi */}
                <Row className="g-2 align-items-center">
                  <Col xs={4}>
                    <Form.Label className="small fw-semibold mb-0 text-dark">Kur Cinsi</Form.Label>
                  </Col>
                  <Col xs={8}>
                    <Form.Select
                      size="sm"
                      value={kurCinsi}
                      onChange={(e) => setKurCinsi(Number(e.target.value))}
                    >
                      <option value={0}>0 - Serbest Piyasa</option>
                      <option value={1}>1 - Gişe Kuru</option>
                      <option value={2}>2 - TCMB Kuru</option>
                    </Form.Select>
                  </Col>
                </Row>
              </div>
            </Col>

            {/* Sağ Sütun: Evrak Türü & Satır Durumu & Açıklama & Özetler */}
            <Col xs={12} md={12} lg={4}>
              <div className="p-2 border rounded bg-white shadow-2xs h-100 d-flex flex-column justify-content-between">
                {/* 1. Evrak Türü */}
                <Row className="g-2 align-items-center mb-1.5">
                  <Col xs={4}>
                    <Form.Label className="small fw-semibold mb-0 text-dark">Evrak Türü</Form.Label>
                  </Col>
                  <Col xs={8}>
                    <Form.Select
                      size="sm"
                      value={evrakTuru}
                      onChange={(e) => setEvrakTuru(Number(e.target.value))}
                    >
                      <option value={0}>0 - Cari Dekont</option>
                      <option value={1}>1 - Dönüşüm / Fiş</option>
                    </Form.Select>
                  </Col>
                </Row>

                {/* 2. Satır Durumu */}
                <Row className="g-2 align-items-center mb-1.5">
                  <Col xs={4}>
                    <Form.Label className="small fw-semibold mb-0 text-dark">Durum</Form.Label>
                  </Col>
                  <Col xs={8}>
                    <Form.Select
                      size="sm"
                      value={satirDurumu}
                      onChange={(e) => setSatirDurumu(Number(e.target.value))}
                      className={satirDurumu === 1 ? "border-danger text-danger fw-bold" : ""}
                    >
                      <option value={0}>0 - Normal (Aktif)</option>
                      <option value={1}>1 - İptal Edildi</option>
                      <option value={2}>2 - Beklemede</option>
                    </Form.Select>
                  </Col>
                </Row>

                {satirDurumu === 1 && (
                  <Row className="g-2 align-items-center mb-1.5">
                    <Col xs={4}>
                      <Form.Label className="small fw-semibold mb-0 text-danger">İptal Tarihi</Form.Label>
                    </Col>
                    <Col xs={8}>
                      <Form.Control
                        type="date"
                        size="sm"
                        value={iptalTarihi}
                        onChange={(e) => setIptalTarihi(e.target.value)}
                        className="font-monospace border-danger"
                      />
                    </Col>
                  </Row>
                )}

                {/* 3. Önceki Belge ID with Dürbün */}
                <Row className="g-2 align-items-center mb-1.5">
                  <Col xs={4}>
                    <Form.Label className="small fw-semibold mb-0 text-dark" title="Dönüşen önceki dekont / fiş kaydı">
                      Önceki Belge
                    </Form.Label>
                  </Col>
                  <Col xs={8}>
                    <InputGroup size="sm">
                      <Form.Control
                        type="text"
                        value={oncekiInputText}
                        onChange={(e) => handleOncekiInputChange(e.target.value)}
                        placeholder="Örn: DK-000005"
                        className={oncekiId ? "font-monospace fw-bold text-dark" : "font-monospace"}
                      />
                      <Button
                        variant="outline-secondary"
                        onClick={() => setShowOncekiLookupModal(true)}
                        title="Önceki Dekont Listesi (Dürbün)"
                        className="d-flex align-items-center justify-content-center px-2 bg-light border-start-0"
                        style={{ borderColor: "#ced4da" }}
                      >
                        <span className="d-inline-flex align-items-center gap-1" style={{ color: "#7c8db5" }}>
                          <IconBinoculars size={16} strokeWidth={1.8} />
                          <svg
                            width="11"
                            height="11"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <line x1="5" y1="12" x2="19" y2="12" />
                            <polyline points="12 5 19 12 12 19" />
                          </svg>
                        </span>
                      </Button>
                    </InputGroup>
                  </Col>
                </Row>

                {/* 4. Genel Açıklama */}
                <Row className="g-2 align-items-center mb-1.5">
                  <Col xs={4}>
                    <Form.Label className="small fw-semibold mb-0 text-dark">Açıklama</Form.Label>
                  </Col>
                  <Col xs={8}>
                    <Form.Control
                      size="sm"
                      maxLength={100}
                      value={aciklama}
                      onChange={(e) => setAciklama(e.target.value)}
                      placeholder=""
                    />
                  </Col>
                </Row>

                {/* 5. Canlı Bakiye & Denkleştirme Özeti */}
                <div className="bg-light p-1.5 rounded border mt-auto">
                  <Row className="g-1 text-center font-monospace smaller" style={{ fontSize: "0.75rem" }}>
                    <Col xs={4}>
                      <div className="text-muted">Sol Toplam Has</div>
                      <div className="fw-bold text-dark">{solTotals.toplamHas.toFixed(3)}g</div>
                    </Col>
                    <Col xs={4}>
                      <div className="text-muted">Sağ Toplam Has</div>
                      <div className="fw-bold text-dark">{sagTotals.toplamHas.toFixed(3)}g</div>
                    </Col>
                    <Col xs={4}>
                      <div className="text-muted">Denklik Durumu</div>
                      {balanceDiff.isBalanced ? (
                        <div className="fw-bold text-success">Dengede ✓</div>
                      ) : (
                        <div className="fw-bold text-warning">
                          Fark: {balanceDiff.hasFarki > 0 ? "+" : ""}{balanceDiff.hasFarki.toFixed(3)}g
                        </div>
                      )}
                    </Col>
                  </Row>
                </div>
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* 3. ÇİFT TARAFLI EMANET KALEMLERİ GRİD ALANI (SOL VE SAĞ PANEL) */}
      {/* Üst Canlı Denkleştirme Çubuğu */}
      <div className="bg-white border rounded-3 py-1.5 px-3 mb-2 shadow-2xs d-flex flex-wrap align-items-center justify-content-between gap-2">
        <div className="d-flex align-items-center gap-2">
          <IconScale size={18} className="text-primary" />
          <span className="fw-bold small text-dark">Çift Taraflı Dekont Kalemleri</span>
          <Badge bg={tip === 0 ? "success" : tip === 1 ? "danger" : "primary"}>
            {tip === 0 ? "Giriş (Emanet Al)" : tip === 1 ? "Çıkış (Emanet Ver)" : "Dekont (Virman / Transfer)"}
          </Badge>
        </div>

        {/* Canlı Fark Göstergeleri */}
        <div className="d-flex align-items-center gap-3 font-monospace small">
          <div>
            <span className="text-muted me-1">Sol:</span>
            <strong className="text-dark">{solTotals.toplamHas.toFixed(3)} gr</strong>
          </div>
          <IconArrowsExchange size={16} className="text-secondary" />
          <div>
            <span className="text-muted me-1">Sağ:</span>
            <strong className="text-dark">{sagTotals.toplamHas.toFixed(3)} gr</strong>
          </div>
          <div>
            <span className="text-muted me-1">Fark:</span>
            {balanceDiff.isBalanced ? (
              <Badge bg="success" className="px-2 py-1">
                ✓ Dengede (0.000 gr)
              </Badge>
            ) : (
              <Badge bg="warning" text="dark" className="px-2 py-1">
                Fark: {balanceDiff.hasFarki > 0 ? "+" : ""}{balanceDiff.hasFarki.toFixed(3)} gr ({balanceDiff.tutarFarki.toFixed(2)} ₺)
              </Badge>
            )}
          </div>
        </div>

        {/* Hızlı Eşitleme Düğmeleri */}
        <div className="d-flex align-items-center gap-1.5">
          <Button
            size="sm"
            variant="outline-primary"
            onClick={handleSyncLeftToRight}
            title="Sol paneldeki kalemleri sağ panele aktarır / eşitler"
            className="py-1 px-2 smaller fw-semibold d-flex align-items-center gap-1"
          >
            <IconArrowRight size={14} />
            <span>Sol ➔ Sağa Eşitle</span>
          </Button>
          <Button
            size="sm"
            variant="outline-secondary"
            onClick={handleSyncRightToLeft}
            title="Sağ paneldeki kalemleri sol panele aktarır / eşitler"
            className="py-1 px-2 smaller fw-semibold d-flex align-items-center gap-1"
          >
            <IconArrowLeft size={14} />
            <span>⬅ Sağ ➔ Sola Eşitle</span>
          </Button>
        </div>
      </div>

      {/* Tam Ortadan 2'ye Bölünmüş Yan Yana Paneller */}
      <div className="row g-2 mb-2">
        {/* SOL PANEL */}
        <div className="col-12 col-xl-6">
          {renderGridPanel("sol")}
        </div>

        {/* SAĞ PANEL */}
        <div className="col-12 col-xl-6">
          {renderGridPanel("sag")}
        </div>
      </div>

      {/* Dürbün ile Dekont Arama Modalı */}
      <LookupModal<CariDekontListItem>
        show={showDekontSearchModal}
        onHide={() => setShowDekontSearchModal(false)}
        title="Kayıtlı Cari Emanet Dekontları Listesi (Dürbün)"
        items={filteredDekonts}
        isLoading={isSaving}
        searchPlaceholder="Dekont no, cari kodu, cari ünvanı ile arayınız..."
        columns={[
          { header: "Dekont No", width: "110px", render: (d) => <span className="font-monospace fw-bold text-primary">{d.dekontNo}</span> },
          { header: "Tür", width: "120px", render: (d) => <Badge bg={d.tip === 0 ? "success" : d.tip === 1 ? "danger" : "primary"}>{d.tipLabel}</Badge> },
          { header: "Tarih", width: "100px", render: (d) => <span className="font-monospace">{d.tarih}</span> },
          { header: "Cari Kodu", width: "110px", render: (d) => <span className="font-monospace">{d.cariKod}</span> },
          { header: "Cari Ünvanı", render: (d) => <span className="fw-semibold">{d.cariAd}</span> },
          { header: "Vezne", width: "110px", render: (d) => <span>{d.vezneAd}</span> },
          { header: "Kalem", width: "70px", align: "center", render: (d) => <span>{d.kalemSayisi}</span> },
          { header: "Açıklama", render: (d) => <span className="text-muted small">{d.aciklama || "-"}</span> },
        ]}
        filterFn={(d, term) => {
          const t = term.toLowerCase();
          return (
            d.dekontNo.toLowerCase().includes(t) ||
            d.cariKod.toLowerCase().includes(t) ||
            d.cariAd.toLowerCase().includes(t) ||
            d.vezneAd.toLowerCase().includes(t) ||
            d.aciklama.toLowerCase().includes(t)
          );
        }}
        onSelect={(item) => {
          const idx = savedDekonts.findIndex((x) => x.cariDekontId === item.cariDekontId);
          if (idx !== -1) setCurrentIndex(idx);
          loadDekontRecord(item.cariDekontId);
          setShowDekontSearchModal(false);
        }}
      />

      {/* 1. Cari Lookup Modalı (Dürbün) */}
      <LookupModal<CariKartItem>
        show={showCariLookup}
        onHide={() => setShowCariLookup(false)}
        title="Cari Hesap Listesi (Dürbün)"
        items={cariList}
        isLoading={isLoadingLookups}
        searchPlaceholder="Cari kodu veya adı ile arayınız..."
        columns={[
          { header: "Cari Kodu", width: "130px", render: (c) => <span className="font-monospace fw-bold">{c.kod}</span> },
          { header: "Cari Ünvanı / Adı", render: (c) => <span>{c.ad}</span> },
          { header: "Telefon", width: "130px", render: (c) => <span>{c.telefon || "-"}</span> },
          { header: "TC / Vergi No", width: "130px", render: (c) => <span>{c.vergiKimlikNo || "-"}</span> },
        ]}
        filterFn={(c, term) => {
          const t = term.toLowerCase();
          return (
            c.kod.toLowerCase().includes(t) ||
            c.ad.toLowerCase().includes(t) ||
            (c.telefon && c.telefon.includes(t)) ||
            (c.vergiKimlikNo && c.vergiKimlikNo.includes(t))
          );
        }}
        onSelect={handleSelectCari}
      />

      {/* 2. Cari Lookup Modalı (Virman için) */}
      <LookupModal<CariKartItem>
        show={showCari2Lookup}
        onHide={() => setShowCari2Lookup(false)}
        title="2. Cari Hesap Listesi (Hedef Cari - Dürbün)"
        items={cariList}
        isLoading={isLoadingLookups}
        searchPlaceholder="Cari kodu veya adı ile arayınız..."
        columns={[
          { header: "Cari Kodu", width: "130px", render: (c) => <span className="font-monospace fw-bold text-success">{c.kod}</span> },
          { header: "Cari Ünvanı / Adı", render: (c) => <span>{c.ad}</span> },
          { header: "Telefon", width: "130px", render: (c) => <span>{c.telefon || "-"}</span> },
        ]}
        filterFn={(c, term) => {
          const t = term.toLowerCase();
          return c.kod.toLowerCase().includes(t) || c.ad.toLowerCase().includes(t);
        }}
        onSelect={handleSelectCari2}
      />

      {/* Vezne Lookup Modalı (Dürbün) */}
      <LookupModal<VezneItem>
        show={showVezneLookup}
        onHide={() => setShowVezneLookup(false)}
        title="Vezne Listesi (Dürbün)"
        items={vezneList}
        isLoading={isLoadingLookups}
        searchPlaceholder="Vezne kodu veya adı ile arayınız..."
        columns={[
          { header: "Vezne Kodu", width: "120px", render: (v) => <span className="font-monospace fw-bold">{v.kod}</span> },
          { header: "Vezne Adı", render: (v) => <span>{v.ad}</span> },
        ]}
        filterFn={(v, term) => {
          const t = term.toLowerCase();
          return v.kod.toLowerCase().includes(t) || v.ad.toLowerCase().includes(t);
        }}
        onSelect={handleSelectVezne}
      />

      {/* Önceki Belge Lookup Modalı (Dürbün) */}
      <LookupModal<CariDekontListItem>
        show={showOncekiLookupModal}
        onHide={() => setShowOncekiLookupModal(false)}
        title="Önceki Belge Seçimi (Dürbün)"
        items={savedDekonts.filter((d) => !cariDekontId || d.cariDekontId !== cariDekontId)}
        isLoading={isLoadingLookups}
        searchPlaceholder="Dekont no, cari kodu veya ünvanı ile arayınız..."
        columns={[
          { header: "Dekont No", width: "120px", render: (d) => <span className="font-monospace fw-bold text-primary">{d.dekontNo}</span> },
          { header: "Tür", width: "120px", render: (d) => <Badge bg={d.tip === 0 ? "success" : d.tip === 1 ? "danger" : "primary"}>{d.tipLabel}</Badge> },
          { header: "Tarih", width: "100px", render: (d) => <span className="font-monospace">{d.tarih}</span> },
          { header: "Cari Kodu", width: "110px", render: (d) => <span className="font-monospace">{d.cariKod}</span> },
          { header: "Cari Ünvanı", render: (d) => <span className="fw-semibold">{d.cariAd}</span> },
          { header: "Vezne", width: "110px", render: (d) => <span>{d.vezneAd}</span> },
          { header: "Miktar", width: "100px", align: "right", render: (d) => <span className="font-monospace">{d.toplamMiktar.toFixed(2)}</span> },
          { header: "Açıklama", render: (d) => <span className="text-muted small">{d.aciklama || "-"}</span> },
        ]}
        filterFn={(d, term) => {
          const t = term.toLowerCase();
          return (
            d.dekontNo.toLowerCase().includes(t) ||
            d.cariKod.toLowerCase().includes(t) ||
            d.cariAd.toLowerCase().includes(t) ||
            d.vezneAd.toLowerCase().includes(t) ||
            d.aciklama.toLowerCase().includes(t)
          );
        }}
        onSelect={handleSelectOncekiDekont}
      />
    </div>
  );
};

export default CariEmanetDekontPage;
