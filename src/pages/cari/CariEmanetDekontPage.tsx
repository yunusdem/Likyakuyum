import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
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
  Modal,
} from "react-bootstrap";
import {
  IconFileText,
  IconBinoculars,
  IconCheck,
  IconPlus,
  IconTrash,
  IconArrowRight,
  IconUser,
  IconBuildingBank,
  IconDeviceFloppy,
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
import { KurService } from "../../services/kurService";
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
  kur?: number;
  caprazKur?: number;
  parite?: number;
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

type MutabakatType = "capraz" | "has" | "kur";

export const CariEmanetDekontPage: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryId = searchParams.get("id") || searchParams.get("cariDekontId");
  const isDuzeltmeMode = location.pathname.includes("duzeltme");
  const prevPathRef = useRef<string>(location.pathname);
  const cariListRef = useRef<CariKartItem[]>([]);
  const savedDekontsRef = useRef<CariDekontListItem[]>([]);

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
  const [tip, setTip] = useState<number>(0); // 0: Emanet alma, 1: Emanet verme, 2: Dekont (Virman)
  const [mutabakatTuru, setMutabakatTuru] = useState<MutabakatType>("capraz");
  const [tarih, setTarih] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [vade, setVade] = useState<string>("");
  const [iptalTarihi, setIptalTarihi] = useState<string>("");
  const [aciklama, setAciklama] = useState<string>("");
  const [refNo, setRefNo] = useState<string>("");
  const [bazDoviz, setBazDoviz] = useState<string>("USD");
  const [kurCinsi, setKurCinsi] = useState<number>(0);
  const [satirDurumu, setSatirDurumu] = useState<number>(0);
  const [evrakTuru, setEvrakTuru] = useState<number>(0);
  const [oncekiId, setOncekiId] = useState<number | null>(null);
  const [oncekiInputText, setOncekiInputText] = useState<string>("");
  const [showOncekiLookupModal, setShowOncekiLookupModal] = useState<boolean>(false);
  const [teslimEden, setTeslimEden] = useState<string>("");
  const [teslimAlan, setTeslimAlan] = useState<string>("");

  // Vezne (Ana Kasa)
  const [vezneId, setVezneId] = useState<number>(1);
  const [vezneKod, setVezneKod] = useState<string>("00");
  const [vezneAd, setVezneAd] = useState<string>("Ana kasa");

  // Cari 1 (Sol Panel or Right Panel depending on tip)
  const [cariKartId, setCariKartId] = useState<number | null>(null);
  const [cariKod, setCariKod] = useState<string>("");
  const [cariAd, setCariAd] = useState<string>("");
  const [cariTelefon, setCariTelefon] = useState<string>("");
  const [cariInputText, setCariInputText] = useState<string>("");
  const [cariSuggestions, setCariSuggestions] = useState<CariKartItem[]>([]);
  const [showCariSuggest, setShowCariSuggest] = useState<boolean>(false);

  // Cari 2 (Dekont / Virman modunda 2. Cari)
  const [cari2KartId, setCari2KartId] = useState<number | null>(null);
  const [cari2Kod, setCari2Kod] = useState<string>("");
  const [cari2Ad, setCari2Ad] = useState<string>("");
  const [cari2Telefon, setCari2Telefon] = useState<string>("");

  // Helper to create blank row
  const createEmptyRow = (satirNo: number = 1, defaultPara?: ParaItem): GridRowState => {
    let initialKur: number | string = "";
    const has = defaultPara?.hasOrani && defaultPara.hasOrani > 0 ? defaultPara.hasOrani : 1.0;
    if (defaultPara) {
      if (mutabakatTuru === "capraz") {
        initialKur = defaultPara.caprazKur ?? defaultPara.kur ?? (defaultPara.kod === "USD" ? 1.0 : 1.0);
      } else if (mutabakatTuru === "has") {
        initialKur = has;
      } else {
        initialKur = defaultPara.kur ?? (defaultPara.kod === "TL" ? 1.0 : 1.0);
      }
    }
    return {
      id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      satirNo,
      paraId: defaultPara?.id || 0,
      paraKodu: (defaultPara?.kod || "").trim(),
      paraAdi: (defaultPara?.ad || "").trim(),
      meblag: "",
      hasOrani: has,
      hasMiktar: 0,
      kur: initialKur,
      giseKuru: defaultPara?.kur || 1.0,
      tutar: 0,
      aciklama: "",
    };
  };

  // ÇİFT TARAFLI GRID STATE (Sol Panel ve Sağ Panel)
  const [solSatirlar, setSolSatirlar] = useState<GridRowState[]>([createEmptyRow(1)]);
  const [sagSatirlar, setSagSatirlar] = useState<GridRowState[]>([createEmptyRow(1)]);

  // Aktif taraf ve seçili satır indisleri
  const [activeSide, setActiveSide] = useState<"sol" | "sag">("sol");
  const [selectedSolIndex, setSelectedSolIndex] = useState<number>(0);
  const [selectedSagIndex, setSelectedSagIndex] = useState<number>(0);
  const [activeField, setActiveField] = useState<"smb" | "meblag" | "kur">("smb");
  const [activeRowIndex, setActiveRowIndex] = useState<number>(0);

  // Modals & UI
  const [showDekontSearchModal, setShowDekontSearchModal] = useState<boolean>(false);
  const [showCariLookupTarget, setShowCariLookupTarget] = useState<"cari1" | "cari2" | null>(null);
  const [showVezneLookup, setShowVezneLookup] = useState<boolean>(false);
  const [showParaLookupTarget, setShowParaLookupTarget] = useState<{ side: "sol" | "sag"; index: number } | null>(null);
  const [showBakiyeModal, setShowBakiyeModal] = useState<boolean>(false);
  const [alertInfo, setAlertInfo] = useState<{ type: "success" | "danger" | "warning" | "info"; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // SMB Canlı Öneri Durumu
  const [activeSmbSuggest, setActiveSmbSuggest] = useState<{ side: "sol" | "sag"; index: number } | null>(null);
  const [smbSearchTerm, setSmbSearchTerm] = useState<string>("");
  const [smbSuggestIndex, setSmbSuggestIndex] = useState<number>(0);
  const [suggestDropdownPos, setSuggestDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);

  // Input konumunu dinamik hesapla (Table scrollbar veya sınırları tarafından kesilmemesi için fixed position)
  const updateSuggestPos = useCallback(() => {
    if (!activeSmbSuggest) {
      setSuggestDropdownPos(null);
      return;
    }
    const inputEl = document.getElementById(`grid-input-${activeSmbSuggest.side}-${activeSmbSuggest.index}-smb`);
    if (inputEl) {
      const rect = inputEl.getBoundingClientRect();
      setSuggestDropdownPos({
        top: rect.bottom + 2,
        left: rect.left,
        width: Math.max(260, rect.width + 120),
      });
    } else {
      setSuggestDropdownPos(null);
    }
  }, [activeSmbSuggest]);

  useEffect(() => {
    updateSuggestPos();
  }, [activeSmbSuggest, updateSuggestPos]);

  useEffect(() => {
    if (!activeSmbSuggest) return;
    const handleScrollOrResize = () => updateSuggestPos();
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [activeSmbSuggest, updateSuggestPos]);

  // Türkçe karakter duyarlı normalizasyon
  const normalizeTr = (str: string): string => {
    return (str || "")
      .toLocaleUpperCase("tr-TR")
      .replace(/İ/g, "I")
      .replace(/ı/g, "I")
      .replace(/Ş/g, "S")
      .replace(/Ğ/g, "G")
      .replace(/Ü/g, "U")
      .replace(/Ö/g, "O")
      .replace(/Ç/g, "C")
      .trim();
  };

  // Akıllı Harf ve Kod Uyuşma Sıralaması (Aynı harflerle başlayanlar en başta)
  const smbSuggestions = useMemo(() => {
    if (!activeSmbSuggest) return [];
    const rawTerm = (smbSearchTerm || "").trim();
    if (!rawTerm) {
      return paraList.slice(0, 15);
    }

    const normTerm = normalizeTr(rawTerm);
    const upperTerm = rawTerm.toUpperCase();

    interface ScoredPara {
      para: ParaItem;
      score: number;
    }

    const scoredList: ScoredPara[] = [];

    for (const p of paraList) {
      const pKod = (p.kod || "").trim().toUpperCase();
      const pAd = (p.ad || "").trim();
      const normKod = normalizeTr(pKod);
      const normAd = normalizeTr(pAd);

      let score = 0;

      // 1. Tam kod eşleşmesi (En yüksek öncelik)
      if (pKod === upperTerm || normKod === normTerm) {
        score = 1000;
      }
      // 2. Kod aranan harflerle başlıyorsa (Örn: "U" -> "USD", "E" -> "EUR")
      else if (pKod.startsWith(upperTerm) || normKod.startsWith(normTerm)) {
        score = 800 - pKod.length * 10;
      }
      // 3. Ad aranan harflerle başlıyorsa (Örn: "AMER" -> "AMERİKAN DOLARI")
      else if (normAd.startsWith(normTerm)) {
        score = 600;
      }
      // 4. Kod aranan harfleri içeriyorsa
      else if (pKod.includes(upperTerm) || normKod.includes(normTerm)) {
        score = 400;
      }
      // 5. Ad aranan harfleri içeriyorsa
      else if (normAd.includes(normTerm)) {
        score = 200;
      }

      if (score > 0) {
        scoredList.push({ para: p, score });
      }
    }

    // Yüksek puandan düşüğe doğru sırala
    scoredList.sort((a, b) => b.score - a.score);

    return scoredList.map((s) => s.para).slice(0, 15);
  }, [activeSmbSuggest, smbSearchTerm, paraList]);

  // Format Helper for Numbers (Dip Toplamlar için)
  const formatNumberDisplay = (val: number | string | undefined | null): string => {
    if (val === "" || val === null || val === undefined) return "0.00";
    const cleanNum = parseFloat(String(val).replace(/,/g, "."));
    if (isNaN(cleanNum)) return "0.00";
    return cleanNum.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

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
        setVezneKod(matched.kod || "00");
        setVezneAd(matched.ad || "Ana kasa");
      }
    },
    [user]
  );

  // Tekil Satırın Baz Eşdeğerini Hesapla
  const getRowEquivalent = useCallback(
    (row: GridRowState, mutabakat: MutabakatType): number => {
      const m = parseFloat(String(row.meblag || 0).replace(/,/g, ".")) || 0;
      if (m === 0) return 0;

      if (mutabakat === "capraz") {
        const r = parseFloat(String(row.kur ?? 1).replace(/,/g, ".")) || 1.0;
        return m * r;
      } else if (mutabakat === "has") {
        const h = parseFloat(String(row.hasOrani ?? 1).replace(/,/g, ".")) || 1.0;
        return m * h;
      } else {
        const k = parseFloat(String(row.kur ?? 1).replace(/,/g, ".")) || 1.0;
        return m * k;
      }
    },
    []
  );

  // Sol ve Sağ Baz Toplamları
  const solBazToplam = useMemo(() => {
    return solSatirlar.reduce((acc, r) => acc + getRowEquivalent(r, mutabakatTuru), 0);
  }, [solSatirlar, mutabakatTuru, getRowEquivalent]);

  const sagBazToplam = useMemo(() => {
    return sagSatirlar.reduce((acc, r) => acc + getRowEquivalent(r, mutabakatTuru), 0);
  }, [sagSatirlar, mutabakatTuru, getRowEquivalent]);

  // Otomatik Denkleştirme Fonksiyonu (Sağ paneli sol panele eşitleyecek miktarı hesaplar)
  const autoBalanceRow = useCallback(
    (targetRows: GridRowState[], rowIndex: number, mutabakat: MutabakatType, baseTotalTarget: number): GridRowState[] => {
      return targetRows.map((r, idx) => {
        if (idx !== rowIndex) return r;
        const rate = parseFloat(String(r.kur ?? 1).replace(/,/g, ".")) || 1.0;
        const has = parseFloat(String(r.hasOrani ?? 1).replace(/,/g, ".")) || 1.0;

        // Önceki satırların baz toplamı
        const priorTotal = targetRows
          .slice(0, idx)
          .reduce((acc, prevRow) => acc + getRowEquivalent(prevRow, mutabakat), 0);

        const remainingBase = Math.max(0, baseTotalTarget - priorTotal);

        let calculatedMiktar = 0;
        if (mutabakat === "capraz") {
          calculatedMiktar = rate > 0 ? Number((remainingBase / rate).toFixed(2)) : 0;
        } else if (mutabakat === "has") {
          calculatedMiktar = has > 0 ? Number((remainingBase / has).toFixed(3)) : 0;
        } else {
          calculatedMiktar = rate > 0 ? Number((remainingBase / rate).toFixed(2)) : 0;
        }

        return {
          ...r,
          meblag: calculatedMiktar > 0 ? calculatedMiktar : "",
        };
      });
    },
    [getRowEquivalent]
  );

  // Formu sıfırla / temizle (Kayıt modunda her yer boş gelecek)
  const resetFormToBlank = useCallback((showAlert: boolean = false) => {
    setCariDekontId(null);
    setDekontNo("");
    setTip(0);
    setTarih(new Date().toISOString().split("T")[0]);
    setVade("");
    setIptalTarihi("");
    setAciklama("");
    setRefNo("");
    setCariKartId(null);
    setCariKod("");
    setCariAd("");
    setCariTelefon("");
    setCariInputText("");
    setCariSuggestions([]);
    setShowCariSuggest(false);
    setCari2KartId(null);
    setCari2Kod("");
    setCari2Ad("");
    setCari2Telefon("");
    setSatirDurumu(0);
    setEvrakTuru(0);
    setOncekiId(null);
    setOncekiInputText("");
    setTeslimEden("");
    setTeslimAlan("");
    setSolSatirlar([createEmptyRow(1)]);
    setSagSatirlar([createEmptyRow(1)]);
    setCurrentIndex(-1);
    if (showAlert) {
      setAlertInfo({
        type: "info",
        message: "Yeni dekont kaydı oluşturma modu açıldı.",
      });
    }
  }, []);

  // Yeni Kayıt Butonu (+)
  // İkon grubundaki ilk ikon olan üstünde + olan ikona basınca kayıt sayfasına yönlendirecek.
  // Düzenleme sayfasında 0 dan kayıt olmasın kayıt sayfasında olsun.
  const handleNew = useCallback(() => {
    if (isDuzeltmeMode) {
      navigate("/cari/emanet-dekont");
      return;
    }
    resetFormToBlank(true);
  }, [isDuzeltmeMode, navigate, resetFormToBlank]);

  // Dekont Yükleme (Düzeltme modunda son kayıt veya seçilen kayıt yüklenir)
  const loadDekontRecord = useCallback(
    async (recordId: number, carilerOverride?: CariKartItem[], showAlert: boolean = true) => {
      try {
        const data = await CariDekontService.getDekontById(recordId);
        setCariDekontId(data.cariDekontId);
        setDekontNo(data.dekontNo);
        setTip(data.tip ?? 0);
        setTarih(data.tarih ? data.tarih.split("T")[0] : new Date().toISOString().split("T")[0]);
        setVade(data.vade ? data.vade.split("T")[0] : "");
        setIptalTarihi(data.iptalTarihi ? data.iptalTarihi.split("T")[0] : "");
        setAciklama(data.aciklama || "");
        setVezneId(data.vezneId);
        setVezneKod(data.vezneKod || "00");
        setVezneAd(data.vezneAd || "Ana kasa");
        setEvrakTuru(data.evrakTuru ?? 0);
        setSatirDurumu(data.satirDurumu ?? 0);
        setKurCinsi(data.kurCinsi ?? 0);
        if (data.oncekiId) {
          setOncekiId(data.oncekiId);
          setOncekiInputText(`DK-${String(data.oncekiId).padStart(6, "0")}`);
        } else {
          setOncekiId(null);
          setOncekiInputText("");
        }
        setTeslimEden(data.teslimEden || "");
        setTeslimAlan(data.teslimAlan || "");

        const currentCariList = carilerOverride || cariListRef.current;
        const activeCariId = data.tip === 0 ? data.alacakliId : data.borcluId;
        const matchedCari = currentCariList.find((c) => c.id === activeCariId);
        setCariKartId(activeCariId || null);
        const cKod = (data.tip === 0 ? data.alacakliKod : data.borcluKod) || matchedCari?.kod || "";
        const cAd = (data.tip === 0 ? data.alacakliAd : data.borcluAd) || matchedCari?.ad || "";
        setCariKod(cKod);
        setCariAd(cAd);
        setCariTelefon(data.telefon || matchedCari?.telefon || "");
        setCariInputText(cKod && cAd ? `${cKod} - ${cAd}` : cAd || cKod);

        if (data.tip === 2 && data.borcluId && data.alacakliId) {
          const c2 = currentCariList.find((c) => c.id === data.alacakliId);
          setCari2KartId(data.alacakliId);
          setCari2Kod(data.alacakliKod || c2?.kod || "");
          setCari2Ad(data.alacakliAd || c2?.ad || "");
          setCari2Telefon(c2?.telefon || "");
        }

        // Satırları Sol ve Sağ Panellere Dağıt
        if (data.satirlar && data.satirlar.length > 0) {
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
              hasOrani: s.hasOrani || 1.0,
              hasMiktar: s.hasMiktar,
              kur: s.kur || 1.0,
              giseKuru: s.giseKuru || 1.0,
              tutar: s.tutar,
              aciklama: s.aciklama || "",
            };

            if (s.tip === leftTargetTip) {
              rowState.satirNo = leftRows.length + 1;
              leftRows.push(rowState);
            } else {
              rowState.satirNo = rightRows.length + 1;
              rightRows.push(rowState);
            }
          });

          setSolSatirlar(leftRows.length > 0 ? leftRows : [createEmptyRow(1)]);
          setSagSatirlar(rightRows.length > 0 ? rightRows : [createEmptyRow(1)]);
        } else {
          setSolSatirlar([createEmptyRow(1)]);
          setSagSatirlar([createEmptyRow(1)]);
        }

        if (showAlert) {
          setAlertInfo({
            type: "info",
            message: `${data.dekontNo} numaralı dekont kaydı yüklendi.`,
          });
        }
      } catch (err: any) {
        setAlertInfo({
          type: "danger",
          message: "Dekont kaydı yüklenemedi: " + (err?.message || err),
        });
      }
    },
    []
  );

  // Lookupları, Güncel Kur Tablosunu ve Dekont Listesini Yükle
  const loadLookupsAndList = useCallback(async () => {
    setIsLoadingLookups(true);
    try {
      const [cariler, vezneler, paralar, kurTabloRes, dekontlar] = await Promise.all([
        CariService.getCariKartlar().catch(() => [] as CariKartItem[]),
        apiClient.get<VezneItem[]>("/vezne").then((r) => r.data || []).catch(() => [] as VezneItem[]),
        apiClient.get<ParaItem[]>("/para").then((r) => r.data || []).catch(() => [] as ParaItem[]),
        KurService.getKurTablosu({ tur: 0 }).catch(() => null),
        CariDekontService.getDekontList({ limit: 100 }).catch(() => [] as CariDekontListItem[]),
      ]);

      const trimmedCariler = cariler.map((c) => ({
        ...c,
        kod: (c.kod || "").replace(/\s+/g, " ").trim(),
        ad: (c.ad || "").replace(/\s+/g, " ").trim(),
        telefon: (c.telefon || "").trim(),
      }));
      setCariList(trimmedCariler);
      cariListRef.current = trimmedCariler;
      setVezneList(vezneler);

      // A-Anlık Fiyat Listesindeki güncel parite oranlarını çek (Bu parite oranı Kur oluyor)
      const kurMap = new Map<number, any>();
      const kurCodeMap = new Map<string, any>();
      if (kurTabloRes?.satirlar && Array.isArray(kurTabloRes.satirlar)) {
        kurTabloRes.satirlar.forEach((k: any) => {
          if (k.paraId) kurMap.set(Number(k.paraId), k);
          if (k.kod) kurCodeMap.set(String(k.kod).toUpperCase().trim(), k);
        });
      }

      let baseParalar: ParaItem[] = [...paralar];
      if (baseParalar.length === 0 && kurTabloRes?.satirlar && Array.isArray(kurTabloRes.satirlar)) {
        baseParalar = kurTabloRes.satirlar.map((k: any) => ({
          id: k.paraId || Math.floor(Math.random() * 1000) + 1,
          kod: (k.kod || "").trim().toUpperCase(),
          ad: (k.ad || "").trim(),
          hasOrani: 1.0,
          parite: k.parite != null && Number(k.parite) > 0 ? Number(k.parite) : 1.0,
          kur: k.parite != null && Number(k.parite) > 0 ? Number(k.parite) : 1.0,
        }));
      }
      if (baseParalar.length === 0) {
        baseParalar = [
          { id: 1, kod: "USD", ad: "AMERİKAN DOLARI", parite: 1.0, kur: 1.0, hasOrani: 1.0 },
          { id: 2, kod: "EUR", ad: "EURO", parite: 1.155602, kur: 1.155602, hasOrani: 1.0 },
          { id: 3, kod: "GBP", ad: "İNGİLİZ STERLİNİ", parite: 0.744402, kur: 0.744402, hasOrani: 1.0 },
          { id: 4, kod: "CHF", ad: "İSVİÇRE FRANGI", parite: 0.822526, kur: 0.822526, hasOrani: 1.0 },
          { id: 5, kod: "TL", ad: "TÜRK LİRASI", parite: 1.0, kur: 1.0, hasOrani: 1.0 },
          { id: 6, kod: "HAS", ad: "HAS ALTIN", parite: 1.0, kur: 1.0, hasOrani: 1.0 },
          { id: 7, kod: "22A", ad: "22 AYAR ALTIN", parite: 1.0, kur: 1.0, hasOrani: 0.916 },
          { id: 8, kod: "14A", ad: "14 AYAR ALTIN", parite: 1.0, kur: 1.0, hasOrani: 0.585 },
        ];
      }

      // A-Anlık Fiyat Listesindeki tüm satırları da döviz listesine dahil et
      if (kurTabloRes?.satirlar && Array.isArray(kurTabloRes.satirlar)) {
        kurTabloRes.satirlar.forEach((k: any) => {
          const cKod = (k.kod || "").toUpperCase().trim();
          if (cKod && !baseParalar.some((p) => (p.kod || "").toUpperCase().trim() === cKod)) {
            baseParalar.push({
              id: k.paraId || baseParalar.length + 10,
              kod: cKod,
              ad: (k.ad || "").trim(),
              hasOrani: 1.0,
              parite: k.parite != null && Number(k.parite) > 0 ? Number(k.parite) : 1.0,
              kur: k.parite != null && Number(k.parite) > 0 ? Number(k.parite) : 1.0,
            });
          }
        });
      }

      const enrichedParalar: ParaItem[] = baseParalar.map((p) => {
        const cleanKod = (p.kod || "").toUpperCase().trim();
        const k = kurMap.get(p.id) || kurCodeMap.get(cleanKod);

        // A-Anlık Fiyat Listesi Parite Oranı = Kur (Kullanıcı: "bu parite oranı Kur oluyor")
        let pariteOrani = k?.parite != null && Number(k.parite) > 0 ? Number(k.parite) : null;
        if (pariteOrani == null) {
          if (cleanKod === "USD") pariteOrani = 1.0;
          else if (cleanKod === "TL" || cleanKod === "TRY") pariteOrani = 1.0;
          else if (p.parite != null && Number(p.parite) > 0) pariteOrani = Number(p.parite);
          else if (k?.efektifSatis) pariteOrani = Number(k.efektifSatis);
          else if (p.kur) pariteOrani = Number(p.kur);
          else pariteOrani = 1.0;
        }

        let has = p.hasOrani && p.hasOrani > 0 ? p.hasOrani : 1.0;
        if (cleanKod === "HAS" || cleanKod === "ALT") has = 1.0;
        else if (cleanKod === "22A") has = 0.916;
        else if (cleanKod === "14A") has = 0.585;

        return {
          ...p,
          kod: cleanKod,
          ad: (p.ad || "").trim(),
          hasOrani: has,
          parite: pariteOrani,
          kur: pariteOrani, // Parite oranı Kur oluyor
          caprazKur: pariteOrani,
        };
      });

      setParaList(enrichedParalar);
      const sortedDekonts = [...dekontlar].sort((a, b) => a.cariDekontId - b.cariDekontId);
      setSavedDekonts(sortedDekonts);
      savedDekontsRef.current = sortedDekonts;

      applyUserVezne(vezneler);

      // Kayıt vs Düzeltme Modu Davranışı:
      // Cari emanet kayıtta ilk açılışta heryer boş gelecek.
      // Düzeltme sayfasında da son kayıt her zaman seçili gelecek.
      if (isDuzeltmeMode) {
        if (queryId) {
          const targetId = Number(queryId);
          const foundIdx = sortedDekonts.findIndex((d) => d.cariDekontId === targetId);
          if (foundIdx !== -1) setCurrentIndex(foundIdx);
          await loadDekontRecord(targetId, trimmedCariler, false);
        } else if (sortedDekonts.length > 0) {
          const lastIdx = sortedDekonts.length - 1;
          setCurrentIndex(lastIdx);
          await loadDekontRecord(sortedDekonts[lastIdx].cariDekontId, trimmedCariler, false);
        } else {
          resetFormToBlank(false);
        }
      } else {
        resetFormToBlank(false);
      }
    } catch (err: any) {
      console.error("Lookuplar yüklenirken hata:", err);
    } finally {
      setIsLoadingLookups(false);
    }
  }, [applyUserVezne, isDuzeltmeMode, queryId, loadDekontRecord, resetFormToBlank]);

  // Sayfa ilk yüklendiğinde lookupları ve başlangıç kaydını 1 kez çek
  useEffect(() => {
    loadLookupsAndList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // URL veya Mod Değiştiğinde (Kayıt <-> Düzeltme Geçişi)
  useEffect(() => {
    const prevPath = prevPathRef.current;
    prevPathRef.current = location.pathname;

    if (prevPath !== location.pathname) {
      if (isDuzeltmeMode) {
        if (savedDekontsRef.current.length > 0) {
          const lastIdx = savedDekontsRef.current.length - 1;
          setCurrentIndex(lastIdx);
          loadDekontRecord(savedDekontsRef.current[lastIdx].cariDekontId, undefined, false);
        } else {
          resetFormToBlank(false);
        }
      } else {
        resetFormToBlank(false);
      }
    }
  }, [location.pathname, isDuzeltmeMode, loadDekontRecord, resetFormToBlank]);

  // Para Birimi Seçildiğinde Tek Seferde Tüm Hücreleri Doldur
  const handleSelectParaForRow = (
    side: "sol" | "sag",
    index: number,
    p: ParaItem
  ) => {
    const isLeft = side === "sol";
    const setter = isLeft ? setSolSatirlar : setSagSatirlar;

    // A-Anlık Fiyat Listesi Parite Oranı = Kur (Kullanıcı: "bu parite oranı Kur oluyor")
    const pariteKur = p.parite ?? p.caprazKur ?? p.kur ?? (p.kod === "USD" ? 1.0 : 1.0);
    const has = p.hasOrani && p.hasOrani > 0 ? p.hasOrani : 1.0;

    setter((prevRows) => {
      const rows = [...prevRows];
      const currentRow = rows[index] || createEmptyRow(index + 1);

      const updatedRow: GridRowState = {
        ...currentRow,
        paraId: p.id,
        paraKodu: (p.kod || "").trim().toUpperCase(),
        paraAdi: (p.ad || "").trim(),
        hasOrani: has,
        kur: pariteKur,
        giseKuru: pariteKur,
      };
      rows[index] = updatedRow;

      if (!isLeft && solBazToplam > 0 && (!updatedRow.meblag || Number(updatedRow.meblag) === 0)) {
        return autoBalanceRow(rows, index, mutabakatTuru, solBazToplam);
      }
      return rows;
    });

    setActiveSmbSuggest(null);

    // SMB seçildikten sonra otomatik olarak Miktar hücresine odaklan
    setTimeout(() => {
      const meblagInput = document.getElementById(`grid-input-${side}-${index}-meblag`) as HTMLInputElement | null;
      if (meblagInput) {
        meblagInput.focus();
        meblagInput.select();
        setActiveField("meblag");
      }
    }, 40);
  };

  // Grid Değer Güncelleme (Atomik ve Güvenli)
  const handleGridChange = (
    side: "sol" | "sag",
    index: number,
    field: keyof GridRowState,
    value: any
  ) => {
    const isLeft = side === "sol";
    const setter = isLeft ? setSolSatirlar : setSagSatirlar;

    setter((prevRows) => {
      const rows = [...prevRows];
      const currentRow = rows[index] || createEmptyRow(index + 1);
      const updatedRow = { ...currentRow, [field]: value };
      rows[index] = updatedRow;

      // Kullanıcı klavyeden SMB kodu yazdıysa ve paraList içinde eşleştiyse parite kurunu getir
      if (field === "paraKodu") {
        const searchVal = String(value).toUpperCase().trim();
        const matchedPara = paraList.find(
          (p) => (p.kod && p.kod.toUpperCase().trim() === searchVal) || p.id === Number(value)
        );
        if (matchedPara) {
          updatedRow.paraId = matchedPara.id;
          updatedRow.paraAdi = matchedPara.ad;
          const has = matchedPara.hasOrani && matchedPara.hasOrani > 0 ? matchedPara.hasOrani : 1.0;
          updatedRow.hasOrani = has;
          const pariteKur = matchedPara.parite ?? matchedPara.caprazKur ?? matchedPara.kur ?? (matchedPara.kod === "USD" ? 1.0 : 1.0);
          updatedRow.kur = pariteKur;
          updatedRow.giseKuru = pariteKur;
        }
      }

      return rows;
    });
  };

  // F6 - Hesap Kapat / Otomatik Dengele
  const handleHesapKapat = useCallback(() => {
    if (solBazToplam <= 0) return;
    const targetIdx = selectedSagIndex >= 0 ? selectedSagIndex : sagSatirlar.length - 1;
    const balanced = autoBalanceRow(sagSatirlar, targetIdx, mutabakatTuru, solBazToplam);
    setSagSatirlar(balanced);
    setAlertInfo({
      type: "success",
      message: "Hesap kapatıldı: İki tarafın toplamı eşitlendi.",
    });
    setTimeout(() => setAlertInfo(null), 3000);
  }, [solBazToplam, selectedSagIndex, sagSatirlar, mutabakatTuru, autoBalanceRow]);

  // Yeni Satır Ekle
  const handleAddRow = (side: "sol" | "sag") => {
    const isLeft = side === "sol";
    const setter = isLeft ? setSolSatirlar : setSagSatirlar;
    setter((prev) => {
      const defaultP = isLeft
        ? (paraList.find((p) => p.kod === "USD") || paraList[0])
        : (paraList.find((p) => p.kod === "EUR") || paraList[1] || paraList[0]);
      return [...prev, createEmptyRow(prev.length + 1, defaultP)];
    });
  };

  // Satır Sil
  const handleDeleteRow = (side: "sol" | "sag", index: number) => {
    if (side === "sol") {
      if (solSatirlar.length <= 1) {
        setSolSatirlar([createEmptyRow(1)]);
      } else {
        setSolSatirlar((prev) => prev.filter((_, i) => i !== index).map((r, i) => ({ ...r, satirNo: i + 1 })));
      }
    } else {
      if (sagSatirlar.length <= 1) {
        setSagSatirlar([createEmptyRow(1)]);
      } else {
        setSagSatirlar((prev) => prev.filter((_, i) => i !== index).map((r, i) => ({ ...r, satirNo: i + 1 })));
      }
    }
  };

  // F9 - Tablolar Arası Geçiş (Doğrudan hücreye odaklanır)
  const handleF9Switch = useCallback(() => {
    const nextSide = activeSide === "sol" ? "sag" : "sol";
    const rows = nextSide === "sol" ? solSatirlar : sagSatirlar;
    const targetRow = Math.min(Math.max(0, activeRowIndex), rows.length - 1);
    setActiveSide(nextSide);
    if (nextSide === "sol") setSelectedSolIndex(targetRow);
    else setSelectedSagIndex(targetRow);
    setActiveRowIndex(targetRow);

    setTimeout(() => {
      const targetId = `grid-input-${nextSide}-${targetRow}-${activeField}`;
      const el = document.getElementById(targetId) as HTMLInputElement | null;
      if (el) {
        el.focus();
        el.select();
      } else {
        const fallback =
          (document.getElementById(`grid-input-${nextSide}-${targetRow}-meblag`) as HTMLInputElement) ||
          (document.getElementById(`grid-input-${nextSide}-${targetRow}-smb`) as HTMLInputElement);
        if (fallback) {
          fallback.focus();
          fallback.select();
        }
      }
    }, 40);
  }, [activeSide, activeRowIndex, activeField, solSatirlar, sagSatirlar]);

  // Hücreler İçi Klavye (Yön Okları ile Gezinme ve Enter ile Yeni Satır)
  const handleCellKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    side: "sol" | "sag",
    rowIndex: number,
    field: "smb" | "meblag" | "kur"
  ) => {
    const el = e.currentTarget;
    const isLeft = side === "sol";
    const rows = isLeft ? solSatirlar : sagSatirlar;
    const maxRow = rows.length - 1;

    // SMB Açılır Öneri Gezinmesi
    if (field === "smb" && activeSmbSuggest?.side === side && activeSmbSuggest?.index === rowIndex && smbSuggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSmbSuggestIndex((prev) => {
          const next = (prev + 1) % smbSuggestions.length;
          setTimeout(() => {
            const itemEl = document.getElementById(`smb-suggest-item-${next}`);
            itemEl?.scrollIntoView({ block: "nearest" });
          }, 10);
          return next;
        });
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSmbSuggestIndex((prev) => {
          const next = (prev - 1 + smbSuggestions.length) % smbSuggestions.length;
          setTimeout(() => {
            const itemEl = document.getElementById(`smb-suggest-item-${next}`);
            itemEl?.scrollIntoView({ block: "nearest" });
          }, 10);
          return next;
        });
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const selected = smbSuggestions[smbSuggestIndex] || smbSuggestions[0];
        if (selected) {
          handleSelectParaForRow(side, rowIndex, selected);
          return;
        }
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setActiveSmbSuggest(null);
        return;
      }
    }

    // Enter Tuşu Davranışı: smb -> meblag -> kur -> otomatik yeni satır
    if (e.key === "Enter") {
      e.preventDefault();
      if (field === "smb") {
        if (activeSmbSuggest?.side === side && activeSmbSuggest?.index === rowIndex && smbSuggestions.length > 0) {
          const selected = smbSuggestions[smbSuggestIndex] || smbSuggestions[0];
          handleSelectParaForRow(side, rowIndex, selected);
          return;
        }
        const nextEl = document.getElementById(`grid-input-${side}-${rowIndex}-meblag`) as HTMLInputElement | null;
        if (nextEl) {
          nextEl.focus();
          nextEl.select();
          setActiveField("meblag");
        }
        return;
      } else if (field === "meblag") {
        const nextEl = document.getElementById(`grid-input-${side}-${rowIndex}-kur`) as HTMLInputElement | null;
        if (nextEl) {
          nextEl.focus();
          nextEl.select();
          setActiveField("kur");
        }
        return;
      } else if (field === "kur") {
        const nextIdx = rows.length;
        handleAddRow(side);
        setActiveRowIndex(nextIdx);
        if (side === "sol") setSelectedSolIndex(nextIdx);
        else setSelectedSagIndex(nextIdx);
        setActiveField("smb");
        setTimeout(() => {
          const nextInput = document.getElementById(`grid-input-${side}-${nextIdx}-smb`) as HTMLInputElement | null;
          if (nextInput) {
            nextInput.focus();
            nextInput.select();
          }
        }, 50);
        return;
      }
    }

    // Yön Okları
    if (e.key === "ArrowRight") {
      const isAtEnd = el.selectionStart === el.selectionEnd && el.selectionStart === el.value.length;
      if (isAtEnd) {
        if (field === "smb") {
          e.preventDefault();
          const nextEl = document.getElementById(`grid-input-${side}-${rowIndex}-meblag`) as HTMLInputElement | null;
          if (nextEl) {
            nextEl.focus();
            nextEl.select();
            setActiveField("meblag");
          }
        } else if (field === "meblag") {
          e.preventDefault();
          const nextEl = document.getElementById(`grid-input-${side}-${rowIndex}-kur`) as HTMLInputElement | null;
          if (nextEl) {
            nextEl.focus();
            nextEl.select();
            setActiveField("kur");
          }
        } else if (field === "kur" && rowIndex < maxRow) {
          e.preventDefault();
          const nextEl = document.getElementById(`grid-input-${side}-${rowIndex + 1}-smb`) as HTMLInputElement | null;
          if (nextEl) {
            nextEl.focus();
            nextEl.select();
            setActiveRowIndex(rowIndex + 1);
            if (side === "sol") setSelectedSolIndex(rowIndex + 1);
            else setSelectedSagIndex(rowIndex + 1);
            setActiveField("smb");
          }
        }
      }
    } else if (e.key === "ArrowLeft") {
      const isAtStart = el.selectionStart === 0 && el.selectionEnd === 0;
      if (isAtStart) {
        if (field === "kur") {
          e.preventDefault();
          const prevEl = document.getElementById(`grid-input-${side}-${rowIndex}-meblag`) as HTMLInputElement | null;
          if (prevEl) {
            prevEl.focus();
            prevEl.select();
            setActiveField("meblag");
          }
        } else if (field === "meblag") {
          e.preventDefault();
          const prevEl = document.getElementById(`grid-input-${side}-${rowIndex}-smb`) as HTMLInputElement | null;
          if (prevEl) {
            prevEl.focus();
            prevEl.select();
            setActiveField("smb");
          }
        } else if (field === "smb" && rowIndex > 0) {
          e.preventDefault();
          const prevEl = document.getElementById(`grid-input-${side}-${rowIndex - 1}-kur`) as HTMLInputElement | null;
          if (prevEl) {
            prevEl.focus();
            prevEl.select();
            setActiveRowIndex(rowIndex - 1);
            if (side === "sol") setSelectedSolIndex(rowIndex - 1);
            else setSelectedSagIndex(rowIndex - 1);
            setActiveField("kur");
          }
        }
      }
    } else if (e.key === "ArrowDown") {
      if (rowIndex < maxRow) {
        e.preventDefault();
        const targetEl = document.getElementById(`grid-input-${side}-${rowIndex + 1}-${field}`) as HTMLInputElement | null;
        if (targetEl) {
          targetEl.focus();
          targetEl.select();
          setActiveRowIndex(rowIndex + 1);
          if (side === "sol") setSelectedSolIndex(rowIndex + 1);
          else setSelectedSagIndex(rowIndex + 1);
        }
      }
    } else if (e.key === "ArrowUp") {
      if (rowIndex > 0) {
        e.preventDefault();
        const targetEl = document.getElementById(`grid-input-${side}-${rowIndex - 1}-${field}`) as HTMLInputElement | null;
        if (targetEl) {
          targetEl.focus();
          targetEl.select();
          setActiveRowIndex(rowIndex - 1);
          if (side === "sol") setSelectedSolIndex(rowIndex - 1);
          else setSelectedSagIndex(rowIndex - 1);
        }
      }
    }
  };

  // Cari Seçildiğinde
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
  };

  // Cari Kodu / Adı klavye ile yazıldığında
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

  // Kaydetme İşlemi
  const handleSave = async () => {
    let targetCariId = cariKartId;
    if (!targetCariId && tip !== 1) {
      setAlertInfo({
        type: "danger",
        message: "Lütfen geçerli bir Cari Hesap seçiniz.",
      });
      return;
    }

    const validSol = solSatirlar.filter((k) => (parseFloat(String(k.meblag).replace(/,/g, ".")) || 0) > 0);
    const validSag = sagSatirlar.filter((k) => (parseFloat(String(k.meblag).replace(/,/g, ".")) || 0) > 0);

    if (validSol.length === 0 && validSag.length === 0) {
      setAlertInfo({
        type: "danger",
        message: "Lütfen en az bir tarafa geçerli miktar içeren dekont kalemi giriniz.",
      });
      return;
    }

    let seqCounter = 1;
    const combinedLines = [
      ...validSol.map((line) => ({
        satirNo: seqCounter++,
        tip: 1, // Sol taraf
        paraId: line.paraId || 1,
        meblag: parseFloat(String(line.meblag).replace(/,/g, ".")) || 0,
        hasOrani: parseFloat(String(line.hasOrani).replace(/,/g, ".")) || 1.0,
        kur: parseFloat(String(line.kur).replace(/,/g, ".")) || 1.0,
        giseKuru: parseFloat(String(line.giseKuru).replace(/,/g, ".")) || 1.0,
        aciklama: line.aciklama || "",
      })),
      ...validSag.map((line) => ({
        satirNo: seqCounter++,
        tip: 0, // Sağ taraf
        paraId: line.paraId || 1,
        meblag: parseFloat(String(line.meblag).replace(/,/g, ".")) || 0,
        hasOrani: parseFloat(String(line.hasOrani).replace(/,/g, ".")) || 1.0,
        kur: parseFloat(String(line.kur).replace(/,/g, ".")) || 1.0,
        giseKuru: parseFloat(String(line.giseKuru).replace(/,/g, ".")) || 1.0,
        aciklama: line.aciklama || "",
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
        kurCinsi: mutabakatTuru === "capraz" ? kurCinsi || 0 : mutabakatTuru === "has" ? 1 : 2,
        borcluId: tip === 2 ? (cariKartId || 1) : (targetCariId || 1),
        alacakliId: tip === 2 ? (cari2KartId || 1) : (targetCariId || 1),
        telefon: cariTelefon.trim() || undefined,
        vezneId: vezneId || 1,
        kullaniciId: Number(user?.id) || 1,
        degisiklikTakipVar: true,
        satirDurumu,
        evrakTuru,
        oncekiId: oncekiId || undefined,
        teslimEden: teslimEden.trim() || undefined,
        teslimAlan: teslimAlan.trim() || undefined,
        vade: vade ? vade : null,
        iptalTarihi: iptalTarihi ? iptalTarihi : null,
        satirlar: combinedLines,
      };

      const result = await CariDekontService.saveDekont(payload);
      setCariDekontId(result.cariDekontId);
      setDekontNo(result.dekontNo);
      setAlertInfo({
        type: "success",
        message: `✅ Dekont #${result.dekontNo} başarıyla kaydedildi.`,
      });
      loadLookupsAndList();
    } catch (err: any) {
      setAlertInfo({
        type: "danger",
        message: `❌ Kaydetme Hatası: ${err?.message || "Kayıt sırasında bir hata oluştu."}`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Silme İşlemi
  const handleDelete = async () => {
    if (!cariDekontId) return;
    if (!window.confirm("Bu dekont kaydını silmek istediğinize emin misiniz?")) return;
    try {
      setIsSaving(true);
      await CariDekontService.deleteDekont(cariDekontId);
      setAlertInfo({
        type: "success",
        message: `Dekont #${dekontNo} silindi.`,
      });
      handleNew();
      loadLookupsAndList();
    } catch (err: any) {
      setAlertInfo({
        type: "danger",
        message: "Silme hatası: " + (err?.message || err),
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Navigasyon Fonksiyonları
  const handleFirst = () => {
    if (savedDekonts.length === 0) return;
    setCurrentIndex(0);
    loadDekontRecord(savedDekonts[0].cariDekontId);
  };

  const handlePrev = () => {
    if (savedDekonts.length === 0) return;
    const nextIdx = Math.max(0, currentIndex - 1);
    setCurrentIndex(nextIdx);
    loadDekontRecord(savedDekonts[nextIdx].cariDekontId);
  };

  const handleNext = () => {
    if (savedDekonts.length === 0) return;
    const nextIdx = Math.min(savedDekonts.length - 1, currentIndex + 1);
    setCurrentIndex(nextIdx);
    loadDekontRecord(savedDekonts[nextIdx].cariDekontId);
  };

  const handleLast = () => {
    if (savedDekonts.length === 0) return;
    const lastIdx = savedDekonts.length - 1;
    setCurrentIndex(lastIdx);
    loadDekontRecord(savedDekonts[lastIdx].cariDekontId);
  };

  // Global Klavye Kısayolları
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F1") {
        e.preventDefault();
        handleSave();
      } else if (e.key === "F5") {
        e.preventDefault();
        setShowBakiyeModal(true);
      } else if (e.key === "F6") {
        e.preventDefault();
        handleHesapKapat();
      } else if (e.key === "F9") {
        e.preventDefault();
        handleF9Switch();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave, handleHesapKapat, handleF9Switch]);

  // Tablo 3. Sütun Başlığı ve Dip Toplam Etiketi
  const col3Header = useMemo(() => {
    if (mutabakatTuru === "capraz") return "Çapraz kur";
    if (mutabakatTuru === "has") return "Altın Has Gr";
    return "Kur";
  }, [mutabakatTuru]);

  const dipToplamLabel = useMemo(() => {
    if (mutabakatTuru === "capraz") return `TOPLAM (${bazDoviz})`;
    if (mutabakatTuru === "has") return "TOPLAM (HAS)";
    return "TOPLAM (TL)";
  }, [mutabakatTuru, bazDoviz]);

  // Panel Başlık ve Muhasebe Rolleri
  const panelRoles = useMemo(() => {
    if (tip === 0) {
      // Emanet Alma
      return {
        sol: {
          title: "VEZNEYE GİRİŞ",
          isPink: false,
          kod: vezneKod || "00",
          ad: vezneAd || "Ana kasa",
          isVezne: true,
        },
        sag: {
          title: "ALACAKLANDIRMA",
          isPink: true,
          kod: cariKod,
          ad: cariAd,
          isVezne: false,
          cariTarget: "cari1",
        },
      };
    } else if (tip === 1) {
      // Emanet Verme
      return {
        sol: {
          title: "BORÇLANDIRMA",
          isPink: true,
          kod: cariKod,
          ad: cariAd,
          isVezne: false,
          cariTarget: "cari1",
        },
        sag: {
          title: "VEZNEDEN ÇIKIŞ",
          isPink: false,
          kod: vezneKod || "00",
          ad: vezneAd || "Ana kasa",
          isVezne: true,
        },
      };
    } else {
      // Dekont / Virman
      return {
        sol: {
          title: "BORÇLANDIRMA",
          isPink: true,
          kod: cariKod,
          ad: cariAd,
          isVezne: false,
          cariTarget: "cari1",
        },
        sag: {
          title: "ALACAKLANDIRMA",
          isPink: false,
          kod: cari2Kod,
          ad: cari2Ad,
          isVezne: false,
          cariTarget: "cari2",
        },
      };
    }
  }, [tip, vezneKod, vezneAd, cariKod, cariAd, cari2Kod, cari2Ad]);

  return (
    <div className="p-1 p-md-2" style={{ fontFamily: "Tahoma, 'Segoe UI', Arial, sans-serif" }}>
      {/* 1. ERP Toolbar */}
      <ERPToolbar
        pageTitle={isDuzeltmeMode ? "F- Cari Emanet Dekont Düzeltme" : "E- Cari Emanet Dekont Kayıt"}
        onNew={handleNew}
        onSave={handleSave}
        onDelete={isDuzeltmeMode ? handleDelete : undefined}
        onSearch={isDuzeltmeMode ? () => setShowDekontSearchModal(true) : undefined}
        hideSearch={!isDuzeltmeMode}
        hideDelete={!isDuzeltmeMode}
        onFirst={handleFirst}
        onPrev={handlePrev}
        onNext={handleNext}
        onLast={handleLast}
        onRefresh={() => {
          loadLookupsAndList();
          if (cariDekontId) loadDekontRecord(cariDekontId);
        }}
        onClear={handleNew}
        onPrint={() => window.print()}
        disabled={isSaving}
        rightContent={
          <div className="d-flex align-items-center gap-2">
            {cariDekontId ? (
              <Badge bg="success" className="px-2 py-1 font-monospace">
                {isDuzeltmeMode ? "Düzeltme: " : "Kayıtlı: "} {dekontNo || `ID: ${cariDekontId}`}
              </Badge>
            ) : (
              <Badge bg="warning" text="dark" className="px-2 py-1">
                {isDuzeltmeMode ? "Dekont Seçilmedi" : "Yeni Dekont"}
              </Badge>
            )}
          </div>
        }
      />

      {/* Alert Bildirimi - Çarpı kapatma butonu alanın içine tam oturacak şekilde flex hizalı */}
      {alertInfo && (
        <div
          className={`alert alert-${alertInfo.type} py-1.5 px-3 mb-2 small shadow-2xs border-0 d-flex align-items-center justify-content-between`}
          role="alert"
          style={{ minHeight: "36px" }}
        >
          <div className="d-flex align-items-center gap-2 flex-grow-1 overflow-hidden">
            <span>{alertInfo.message}</span>
          </div>
          <button
            type="button"
            className="btn-close flex-shrink-0 ms-2"
            aria-label="Kapat"
            onClick={() => setAlertInfo(null)}
            style={{
              position: "static",
              fontSize: "0.65rem",
              padding: "0.25rem",
              margin: 0,
              boxShadow: "none",
            }}
          />
        </div>
      )}

      {/* 2. Dekont Başlık ve Parametre Alanları Kartı */}
      <Card className="shadow-xs border border-secondary-subtle rounded-2 overflow-hidden mb-2.5">
        <Card.Body className="p-2.5 bg-body">
          <Row className="g-2.5">
            {/* Sol Sütun: İşlem Türü & Tarih & Vezne & Dekont No */}
            <Col xs={12} md={6} lg={4}>
              <div className="p-2 border rounded bg-white shadow-2xs h-100 d-flex flex-column justify-content-between">
                {/* 1. İşlem Türü - EN BAŞTA! */}
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
                      <option value={0}>Emanet alma</option>
                      <option value={1}>Emanet verme</option>
                      <option value={2}>Dekont / Virman</option>
                    </Form.Select>
                  </Col>
                </Row>

                {/* 2. İşlem Tarihi */}
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

                {/* 3. Vade Tarihi */}
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

                {/* 4. Vezne */}
                <Row className="g-2 align-items-center mb-1.5">
                  <Col xs={4}>
                    <Form.Label className="small fw-semibold mb-0 text-dark">Vezne</Form.Label>
                  </Col>
                  <Col xs={8}>
                    <InputGroup size="sm">
                      <Form.Control
                        value={vezneAd ? `${vezneKod} - ${vezneAd}` : (vezneKod || "Ana Vezne")}
                        readOnly
                        className="bg-light text-secondary fw-semibold"
                        title="Vezne"
                      />
                      <Button
                        variant="outline-secondary"
                        onClick={() => setShowVezneLookup(true)}
                        title="Vezne Seç"
                        className="d-flex align-items-center justify-content-center px-2 bg-light border-start-0"
                        style={{ borderColor: "#ced4da" }}
                      >
                        <IconBinoculars size={15} />
                      </Button>
                    </InputGroup>
                  </Col>
                </Row>

                {/* 5. Evrak Türü */}
                <Row className="g-2 align-items-center">
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
              </div>
            </Col>

            {/* Orta Sütun: Cari Hesap Seçimi & İletişim & Mutabakat */}
            <Col xs={12} md={6} lg={4}>
              <div className="p-2 border rounded bg-white shadow-2xs h-100 d-flex flex-column justify-content-between">
                {/* 1. Cari Kodu / Adı with Dürbün */}
                <Row className="g-2 align-items-center mb-1.5">
                  <Col xs={4}>
                    <Form.Label className="small fw-semibold mb-0 text-dark">
                      {tip === 2 ? "1. Cari (Çıkış)" : "Cari Kodu / Adı"}
                    </Form.Label>
                  </Col>
                  <Col xs={8} className="position-relative">
                    <InputGroup size="sm">
                      <Form.Control
                        value={cariInputText || (cariKod ? (cariAd ? `${cariKod} - ${cariAd}` : cariKod) : "")}
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
                        className={cariKartId ? "bg-white fw-bold text-dark" : "bg-white"}
                      />
                      <Button
                        variant="outline-secondary"
                        onClick={() => setShowCariLookupTarget("cari1")}
                        title="Cari Hesap Listesi"
                        className="d-flex align-items-center justify-content-center px-2 bg-light border-start-0"
                        style={{ borderColor: "#ced4da" }}
                      >
                        <IconBinoculars size={15} />
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

                {/* Eğer tip === 2 (Dekont / Virman) ise 2. Cari göster */}
                {tip === 2 && (
                  <Row className="g-2 align-items-center mb-1.5">
                    <Col xs={4}>
                      <Form.Label className="small fw-semibold mb-0 text-dark">2. Cari (Giriş)</Form.Label>
                    </Col>
                    <Col xs={8}>
                      <InputGroup size="sm">
                        <Form.Control
                          value={cari2Kod ? (cari2Ad ? `${cari2Kod} - ${cari2Ad}` : cari2Kod) : ""}
                          onChange={(e) => setCari2Kod(e.target.value)}
                          className={cari2KartId ? "bg-white fw-bold text-dark" : "bg-white"}
                        />
                        <Button
                          variant="outline-secondary"
                          onClick={() => setShowCariLookupTarget("cari2")}
                          title="2. Cari Listesi"
                          className="d-flex align-items-center justify-content-center px-2 bg-light border-start-0"
                          style={{ borderColor: "#ced4da" }}
                        >
                          <IconBinoculars size={15} />
                        </Button>
                      </InputGroup>
                    </Col>
                  </Row>
                )}

                {/* Telefon */}
                <Row className="g-2 align-items-center mb-1.5">
                  <Col xs={4}>
                    <Form.Label className="small fw-semibold mb-0 text-dark">Telefon</Form.Label>
                  </Col>
                  <Col xs={8}>
                    <Form.Control
                      size="sm"
                      value={cariTelefon}
                      readOnly
                      className="bg-light text-muted font-monospace"
                    />
                  </Col>
                </Row>

                {/* Mutabakat */}
                <Row className="g-2 align-items-center mb-1.5">
                  <Col xs={4}>
                    <Form.Label className="small fw-semibold mb-0 text-dark">Mutabakat</Form.Label>
                  </Col>
                  <Col xs={8}>
                    <Form.Select
                      size="sm"
                      value={mutabakatTuru}
                      onChange={(e) => setMutabakatTuru(e.target.value as MutabakatType)}
                    >
                      <option value="capraz">Çapraz kur</option>
                      <option value="has">Has</option>
                      <option value="kur">Ana Para / TL</option>
                    </Form.Select>
                  </Col>
                </Row>

                {/* Tarih */}
                <Row className="g-2 align-items-center mb-1.5">
                  <Col xs={4}>
                    <Form.Label className="small fw-semibold mb-0 text-dark">Tarih</Form.Label>
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

                {/* Teslim Alan */}
                <Row className="g-2 align-items-center">
                  <Col xs={4}>
                    <Form.Label className="small fw-semibold mb-0 text-dark">Teslim Alan</Form.Label>
                  </Col>
                  <Col xs={8}>
                    <Form.Control
                      size="sm"
                      maxLength={50}
                      value={teslimAlan}
                      onChange={(e) => setTeslimAlan(e.target.value)}
                    />
                  </Col>
                </Row>
              </div>
            </Col>

            {/* Sağ Sütun: Evrak Türü & Satır Durumu & Açıklama */}
            <Col xs={12} md={12} lg={4}>
              <div className="p-2 border rounded bg-white shadow-2xs h-100 d-flex flex-column justify-content-between">
                {/* 1. Dekont No with Dürbün - EN SAĞDA EN ÜSTTE! */}
                <Row className="g-2 align-items-center mb-1.5">
                  <Col xs={4}>
                    <Form.Label className="small fw-semibold mb-0 text-dark">Dekont No</Form.Label>
                  </Col>
                  <Col xs={8}>
                    <InputGroup size="sm">
                      <Form.Control
                        value={dekontNo}
                        onChange={(e) => setDekontNo(e.target.value)}
                        className="font-monospace fw-bold text-primary"
                      />
                      <Button
                        variant="outline-secondary"
                        onClick={() => setShowDekontSearchModal(true)}
                        title="Dekont Ara (Dürbün)"
                        className="d-flex align-items-center justify-content-center px-2 bg-light border-start-0"
                        style={{ borderColor: "#ced4da" }}
                      >
                        <IconBinoculars size={15} />
                      </Button>
                    </InputGroup>
                  </Col>
                </Row>

                {/* Satır Durumu */}
                <Row className="g-2 align-items-center mb-1.5">
                  <Col xs={4}>
                    <Form.Label className="small fw-semibold mb-0 text-dark">Durum</Form.Label>
                  </Col>
                  <Col xs={8}>
                    <Form.Select
                      size="sm"
                      value={satirDurumu}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setSatirDurumu(val);
                        if (val === 1 && !iptalTarihi) {
                          setIptalTarihi(new Date().toISOString().split("T")[0]);
                        } else if (val === 0) {
                          setIptalTarihi("");
                        }
                      }}
                    >
                      <option value={0}>0 - Normal (Aktif)</option>
                      <option value={1}>1 - İptal Edildi</option>
                      <option value={2}>2 - Beklemede</option>
                    </Form.Select>
                  </Col>
                </Row>

                {/* İptal Tarihi */}
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

                {/* Önceki Belge */}
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
                        className={oncekiId ? "font-monospace fw-bold text-dark" : "font-monospace"}
                      />
                      <Button
                        variant="outline-secondary"
                        onClick={() => setShowOncekiLookupModal(true)}
                        title="Önceki Dekont Listesi"
                        className="d-flex align-items-center justify-content-center px-2 bg-light border-start-0"
                        style={{ borderColor: "#ced4da" }}
                      >
                        <IconBinoculars size={15} />
                      </Button>
                    </InputGroup>
                  </Col>
                </Row>

                {/* Açıklama */}
                <Row className="g-2 align-items-center">
                  <Col xs={4}>
                    <Form.Label className="small fw-semibold mb-0 text-dark">Açıklama</Form.Label>
                  </Col>
                  <Col xs={8}>
                    <Form.Control
                      size="sm"
                      maxLength={100}
                      value={aciklama}
                      onChange={(e) => setAciklama(e.target.value)}
                    />
                  </Col>
                </Row>
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* 3. Ana Bölüm: Çift Taraflı Tablolar ve Alt Kısım (Sayfa dış kenarlığı kaldırıldı) */}
      <div className="w-100 bg-transparent">
        {/* ÇİFT TARAFLI GRID BÖLÜMÜ (Sol Panel ve Sağ Panel - Belirgin Ayrım) */}
        <Row className="gx-4 gy-3 mt-1">
          {/* ===================== SOL PANEL ===================== */}
          <Col xs={12} lg={6}>
            <div
              className="p-3 bg-white h-100 d-flex flex-column justify-content-between"
              style={{
                border: "1.5px solid #64748b",
                borderRadius: "8px",
                boxShadow: "0 2px 8px -2px rgba(15, 23, 42, 0.08), 0 1px 3px -1px rgba(15, 23, 42, 0.06)",
              }}
            >
              {/* Kod ve Ad Alanları */}
              <div className="mb-2">
                <div className="d-flex align-items-center mb-1">
                  <span className="small text-dark me-2" style={{ width: "35px" }}>
                    Kod
                  </span>
                  <InputGroup size="sm" style={{ height: "23px", maxWidth: "260px" }}>
                    <Form.Control
                      value={panelRoles.sol.kod}
                      onChange={(e) => {
                        if (!panelRoles.sol.isVezne) setCariKod(e.target.value);
                      }}
                      readOnly={panelRoles.sol.isVezne}
                      style={{
                        height: "23px",
                        fontSize: "12px",
                        border: "1px solid #7f9db9",
                        borderRadius: "2px 0 0 2px",
                        backgroundColor: "#ffffff",
                        padding: "0 6px",
                      }}
                    />
                    <Button
                      variant="light"
                      className="p-0 px-1 border border-start-0 d-flex align-items-center justify-content-center"
                      style={{ borderColor: "#7f9db9", height: "23px" }}
                      onClick={() => {
                        if (panelRoles.sol.isVezne) setShowVezneLookup(true);
                        else setShowCariLookupTarget("cari1");
                      }}
                      title="Ara"
                    >
                      <IconBinoculars size={13} />
                    </Button>
                  </InputGroup>
                </div>

                <div className="d-flex align-items-center">
                  <span className="small text-dark me-2" style={{ width: "35px" }}>
                    Ad
                  </span>
                  <InputGroup size="sm" style={{ height: "23px" }}>
                    <Form.Control
                      value={panelRoles.sol.ad}
                      onChange={(e) => {
                        if (!panelRoles.sol.isVezne) setCariAd(e.target.value);
                      }}
                      readOnly={panelRoles.sol.isVezne}
                      style={{
                        height: "23px",
                        fontSize: "12px",
                        border: "1px solid #7f9db9",
                        borderRadius: "2px 0 0 2px",
                        backgroundColor: "#ffffff",
                        padding: "0 6px",
                      }}
                    />
                    <Button
                      variant="light"
                      className="p-0 px-1 border border-start-0 d-flex align-items-center justify-content-center"
                      style={{ borderColor: "#7f9db9", height: "23px" }}
                      onClick={() => {
                        if (panelRoles.sol.isVezne) setShowVezneLookup(true);
                        else setShowCariLookupTarget("cari1");
                      }}
                      title="Ara"
                    >
                      <IconBinoculars size={13} />
                    </Button>
                  </InputGroup>
                </div>
              </div>

              {/* Tablo Konteyneri - Düzgün kenarlık ve estetik görünüm */}
              <div
                style={{
                  border: "1px solid #7f9db9",
                  borderRadius: "6px",
                  overflow: "hidden",
                  backgroundColor: "#ffffff",
                }}
              >
                {/* Pembe / Normal Başlık Şeridi */}
                <div
                  className="w-100 text-center fw-bold text-nowrap"
                  style={{
                    height: "24px",
                    lineHeight: "24px",
                    fontSize: "12px",
                    backgroundColor: panelRoles.sol.isPink ? "#ff66cc" : "#f1f5f9",
                    color: "#000000",
                    letterSpacing: "0.5px",
                    borderBottom: "1px solid #7f9db9",
                  }}
                >
                  {panelRoles.sol.title}
                </div>

                {/* Grid Tablosu */}
                <div
                  style={{
                    minHeight: "220px",
                    maxHeight: "320px",
                    overflowY: "auto",
                  }}
                >
                  <table
                    className="w-100"
                    style={{
                      borderCollapse: "collapse",
                      fontSize: "12.5px",
                      color: "#000000",
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          backgroundColor: "#b8d7fe",
                          height: "24px",
                          color: "#0f3e74",
                          textAlign: "center",
                          position: "sticky",
                          top: 0,
                          zIndex: 1,
                        }}
                      >
                        <th style={{ width: "100px", padding: "1px 4px", borderRight: "1px solid #8ab8ee" }}>SMB</th>
                        <th style={{ width: "150px", padding: "1px 6px", borderRight: "1px solid #8ab8ee" }}>Miktar</th>
                        <th style={{ padding: "1px 6px" }}>{col3Header}</th>
                        <th style={{ width: "26px", padding: 0 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {solSatirlar.map((row, idx) => (
                        <tr
                          key={row.id}
                          style={{
                            height: "24px",
                            borderBottom: "1px solid #e0e0e0",
                            backgroundColor: idx === selectedSolIndex && activeSide === "sol" ? "#f1f5f9" : idx === selectedSolIndex ? "#f8fafc" : "#ffffff",
                          }}
                          onClick={() => {
                            setSelectedSolIndex(idx);
                            setActiveSide("sol");
                            setActiveRowIndex(idx);
                          }}
                        >
                          {/* 1. SMB */}
                          <td style={{ padding: 0, borderRight: "1px solid #e0e0e0" }}>
                            <div className="d-flex align-items-center">
                              <input
                                id={`grid-input-sol-${idx}-smb`}
                                type="text"
                                value={row.paraKodu || ""}
                                onChange={(e) => {
                                  const val = e.target.value.toUpperCase();
                                  setSmbSearchTerm(val);
                                  setSmbSuggestIndex(0);
                                  setActiveSmbSuggest({ side: "sol", index: idx });
                                  handleGridChange("sol", idx, "paraKodu", val);
                                }}
                                onFocus={() => {
                                  setActiveSide("sol");
                                  setActiveRowIndex(idx);
                                  setSelectedSolIndex(idx);
                                  setActiveField("smb");
                                  setSmbSearchTerm(row.paraKodu || "");
                                  setSmbSuggestIndex(0);
                                  setActiveSmbSuggest({ side: "sol", index: idx });
                                }}
                                onBlur={() => {
                                  setTimeout(() => {
                                    setActiveSmbSuggest((curr) => (curr?.side === "sol" && curr?.index === idx ? null : curr));
                                  }, 220);
                                }}
                                onKeyDown={(e) => handleCellKeyDown(e, "sol", idx, "smb")}
                                style={{
                                  width: "100%",
                                  height: "22px",
                                  border: "none",
                                  outline: "none",
                                  padding: "0 4px",
                                  fontSize: "12.5px",
                                  fontWeight: 600,
                                  color: "#0f172a",
                                  backgroundColor: "transparent",
                                }}
                                autoComplete="off"
                              />
                              <Button
                                variant="link"
                                className="p-0 px-1 text-secondary text-decoration-none"
                                onClick={() => setShowParaLookupTarget({ side: "sol", index: idx })}
                                title="Para Seç"
                              >
                                <IconBinoculars size={12} />
                              </Button>
                            </div>
                          </td>

                          {/* 2. Miktar */}
                          <td style={{ padding: 0, borderRight: "1px solid #e0e0e0" }}>
                            <input
                              id={`grid-input-sol-${idx}-meblag`}
                              type="text"
                              inputMode="decimal"
                              value={row.meblag !== undefined && row.meblag !== null ? String(row.meblag) : ""}
                              onChange={(e) => {
                                const val = e.target.value.replace(/,/g, ".");
                                if (val === "" || /^\d*\.?\d*$/.test(val)) {
                                  handleGridChange("sol", idx, "meblag", val);
                                }
                              }}
                              onFocus={() => {
                                setActiveSide("sol");
                                setActiveRowIndex(idx);
                                setSelectedSolIndex(idx);
                                setActiveField("meblag");
                              }}
                              onKeyDown={(e) => handleCellKeyDown(e, "sol", idx, "meblag")}
                              style={{
                                width: "100%",
                                height: "22px",
                                border: "none",
                                outline: "none",
                                padding: "0 6px",
                                fontSize: "12.5px",
                                textAlign: "right",
                                fontWeight: 500,
                                color: "#0f172a",
                                backgroundColor: "transparent",
                              }}
                            />
                          </td>

                          {/* 3. Çapraz kur / Has / Kur */}
                          <td style={{ padding: 0, borderRight: "1px solid #e0e0e0" }}>
                            <input
                              id={`grid-input-sol-${idx}-kur`}
                              type="text"
                              inputMode="decimal"
                              value={
                                mutabakatTuru === "has"
                                  ? (row.hasOrani !== undefined && row.hasOrani !== null ? String(row.hasOrani) : "")
                                  : (row.kur !== undefined && row.kur !== null ? String(row.kur) : "")
                              }
                              onChange={(e) => {
                                const val = e.target.value.replace(/,/g, ".");
                                if (val === "" || /^\d*\.?\d*$/.test(val)) {
                                  if (mutabakatTuru === "has") {
                                    handleGridChange("sol", idx, "hasOrani", val);
                                  } else {
                                    handleGridChange("sol", idx, "kur", val);
                                  }
                                }
                              }}
                              onFocus={() => {
                                setActiveSide("sol");
                                setActiveRowIndex(idx);
                                setSelectedSolIndex(idx);
                                setActiveField("kur");
                              }}
                              onKeyDown={(e) => handleCellKeyDown(e, "sol", idx, "kur")}
                              style={{
                                width: "100%",
                                height: "22px",
                                border: "none",
                                outline: "none",
                                padding: "0 6px",
                                fontSize: "12.5px",
                                textAlign: "right",
                                fontWeight: 500,
                                color: "#0f172a",
                                backgroundColor: "transparent",
                              }}
                            />
                          </td>

                          {/* Sil Butonu */}
                          <td style={{ padding: 0, textAlign: "center" }}>
                            <Button
                              variant="link"
                              className="p-0 text-danger text-decoration-none"
                              onClick={() => handleDeleteRow("sol", idx)}
                              title="Satırı Sil"
                            >
                              <IconTrash size={12} />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Dip Toplam (Satır Ekle butonu kaldırıldı, Enter tuşu ile çapraz kurdayken otomatik eklenir) */}
              <div className="d-flex align-items-center justify-content-end mt-2 pt-2 border-top">
                <div className="d-flex align-items-center gap-2">
                  <span className="fw-semibold text-dark" style={{ fontSize: "12px" }}>
                    {dipToplamLabel}
                  </span>
                  <span
                    className="fw-bold font-monospace text-dark px-2.5 py-1 border bg-light"
                    style={{ fontSize: "13px", minWidth: "100px", textAlign: "right", borderRadius: "4px" }}
                  >
                    {formatNumberDisplay(solBazToplam)}
                  </span>
                </div>
              </div>
            </div>
          </Col>

          {/* ===================== SAĞ PANEL ===================== */}
          <Col xs={12} lg={6}>
            <div
              className="p-3 bg-white h-100 d-flex flex-column justify-content-between"
              style={{
                border: "1.5px solid #64748b",
                borderRadius: "8px",
                boxShadow: "0 2px 8px -2px rgba(15, 23, 42, 0.08), 0 1px 3px -1px rgba(15, 23, 42, 0.06)",
              }}
            >
              {/* Kod ve Ad Alanları */}
              <div className="mb-2">
                <div className="d-flex align-items-center mb-1">
                  <span className="small text-dark me-2" style={{ width: "35px" }}>
                    Kod
                  </span>
                  <InputGroup size="sm" style={{ height: "23px", maxWidth: "260px" }}>
                    <Form.Control
                      value={panelRoles.sag.kod}
                      onChange={(e) => {
                        if (panelRoles.sag.cariTarget === "cari1") setCariKod(e.target.value);
                        else if (panelRoles.sag.cariTarget === "cari2") setCari2Kod(e.target.value);
                      }}
                      readOnly={panelRoles.sag.isVezne}
                      style={{
                        height: "23px",
                        fontSize: "12px",
                        border: "1px solid #7f9db9",
                        borderRadius: "2px 0 0 2px",
                        backgroundColor: "#ffffff",
                        padding: "0 6px",
                      }}
                    />
                    <Button
                      variant="light"
                      className="p-0 px-1 border border-start-0 d-flex align-items-center justify-content-center"
                      style={{ borderColor: "#7f9db9", height: "23px" }}
                      onClick={() => {
                        if (panelRoles.sag.isVezne) setShowVezneLookup(true);
                        else if (panelRoles.sag.cariTarget === "cari2") setShowCariLookupTarget("cari2");
                        else setShowCariLookupTarget("cari1");
                      }}
                      title="Ara"
                    >
                      <IconBinoculars size={13} />
                    </Button>
                  </InputGroup>
                </div>

                <div className="d-flex align-items-center">
                  <span className="small text-dark me-2" style={{ width: "35px" }}>
                    Ad
                  </span>
                  <InputGroup size="sm" style={{ height: "23px" }}>
                    <Form.Control
                      value={panelRoles.sag.ad}
                      onChange={(e) => {
                        if (panelRoles.sag.cariTarget === "cari1") setCariAd(e.target.value);
                        else if (panelRoles.sag.cariTarget === "cari2") setCari2Ad(e.target.value);
                      }}
                      readOnly={panelRoles.sag.isVezne}
                      style={{
                        height: "23px",
                        fontSize: "12px",
                        border: "1px solid #7f9db9",
                        borderRadius: "2px 0 0 2px",
                        backgroundColor: "#ffffff",
                        padding: "0 6px",
                      }}
                    />
                    <Button
                      variant="light"
                      className="p-0 px-1 border border-start-0 d-flex align-items-center justify-content-center"
                      style={{ borderColor: "#7f9db9", height: "23px" }}
                      onClick={() => {
                        if (panelRoles.sag.isVezne) setShowVezneLookup(true);
                        else if (panelRoles.sag.cariTarget === "cari2") setShowCariLookupTarget("cari2");
                        else setShowCariLookupTarget("cari1");
                      }}
                      title="Ara"
                    >
                      <IconBinoculars size={13} />
                    </Button>
                  </InputGroup>
                </div>
              </div>

              {/* Tablo Konteyneri - Düzgün kenarlık ve estetik görünüm */}
              <div
                style={{
                  border: "1px solid #7f9db9",
                  borderRadius: "6px",
                  overflow: "hidden",
                  backgroundColor: "#ffffff",
                }}
              >
                {/* Pembe / Normal Başlık Şeridi */}
                <div
                  className="w-100 text-center fw-bold text-nowrap"
                  style={{
                    height: "24px",
                    lineHeight: "24px",
                    fontSize: "12px",
                    backgroundColor: panelRoles.sag.isPink ? "#ff66cc" : "#f1f5f9",
                    color: "#000000",
                    letterSpacing: "0.5px",
                    borderBottom: "1px solid #7f9db9",
                  }}
                >
                  {panelRoles.sag.title}
                </div>

                {/* Grid Tablosu */}
                <div
                  style={{
                    minHeight: "220px",
                    maxHeight: "320px",
                    overflowY: "auto",
                  }}
                >
                  <table
                    className="w-100"
                    style={{
                      borderCollapse: "collapse",
                      fontSize: "12.5px",
                      color: "#000000",
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          backgroundColor: "#b8d7fe",
                          height: "24px",
                          color: "#0f3e74",
                          textAlign: "center",
                          position: "sticky",
                          top: 0,
                          zIndex: 1,
                        }}
                      >
                        <th style={{ width: "100px", padding: "1px 4px", borderRight: "1px solid #8ab8ee" }}>SMB</th>
                        <th style={{ width: "150px", padding: "1px 6px", borderRight: "1px solid #8ab8ee" }}>Miktar</th>
                        <th style={{ padding: "1px 6px" }}>{col3Header}</th>
                        <th style={{ width: "26px", padding: 0 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {sagSatirlar.map((row, idx) => (
                        <tr
                          key={row.id}
                          style={{
                            height: "24px",
                            borderBottom: "1px solid #e0e0e0",
                            backgroundColor: idx === selectedSagIndex && activeSide === "sag" ? "#f1f5f9" : idx === selectedSagIndex ? "#f8fafc" : "#ffffff",
                          }}
                          onClick={() => {
                            setSelectedSagIndex(idx);
                            setActiveSide("sag");
                            setActiveRowIndex(idx);
                          }}
                        >
                          {/* 1. SMB */}
                          <td style={{ padding: 0, borderRight: "1px solid #e0e0e0" }}>
                            <div className="d-flex align-items-center">
                              <input
                                id={`grid-input-sag-${idx}-smb`}
                                type="text"
                                value={row.paraKodu || ""}
                                onChange={(e) => {
                                  const val = e.target.value.toUpperCase();
                                  setSmbSearchTerm(val);
                                  setSmbSuggestIndex(0);
                                  setActiveSmbSuggest({ side: "sag", index: idx });
                                  handleGridChange("sag", idx, "paraKodu", val);
                                }}
                                onFocus={() => {
                                  setActiveSide("sag");
                                  setActiveRowIndex(idx);
                                  setSelectedSagIndex(idx);
                                  setActiveField("smb");
                                  setSmbSearchTerm(row.paraKodu || "");
                                  setSmbSuggestIndex(0);
                                  setActiveSmbSuggest({ side: "sag", index: idx });
                                }}
                                onBlur={() => {
                                  setTimeout(() => {
                                    setActiveSmbSuggest((curr) => (curr?.side === "sag" && curr?.index === idx ? null : curr));
                                  }, 220);
                                }}
                                onKeyDown={(e) => handleCellKeyDown(e, "sag", idx, "smb")}
                                style={{
                                  width: "100%",
                                  height: "22px",
                                  border: "none",
                                  outline: "none",
                                  padding: "0 4px",
                                  fontSize: "12.5px",
                                  fontWeight: 600,
                                  color: "#0f172a",
                                  backgroundColor: "transparent",
                                }}
                                autoComplete="off"
                              />
                              <Button
                                variant="link"
                                className="p-0 px-1 text-secondary text-decoration-none"
                                onClick={() => setShowParaLookupTarget({ side: "sag", index: idx })}
                                title="Para Seç"
                              >
                                <IconBinoculars size={12} />
                              </Button>
                            </div>
                          </td>

                          {/* 2. Miktar */}
                          <td style={{ padding: 0, borderRight: "1px solid #e0e0e0" }}>
                            <input
                              id={`grid-input-sag-${idx}-meblag`}
                              type="text"
                              inputMode="decimal"
                              value={row.meblag !== undefined && row.meblag !== null ? String(row.meblag) : ""}
                              onChange={(e) => {
                                const val = e.target.value.replace(/,/g, ".");
                                if (val === "" || /^\d*\.?\d*$/.test(val)) {
                                  handleGridChange("sag", idx, "meblag", val);
                                }
                              }}
                              onFocus={() => {
                                setActiveSide("sag");
                                setActiveRowIndex(idx);
                                setSelectedSagIndex(idx);
                                setActiveField("meblag");
                              }}
                              onKeyDown={(e) => handleCellKeyDown(e, "sag", idx, "meblag")}
                              style={{
                                width: "100%",
                                height: "22px",
                                border: "none",
                                outline: "none",
                                padding: "0 6px",
                                fontSize: "12.5px",
                                textAlign: "right",
                                fontWeight: 500,
                                color: "#0f172a",
                                backgroundColor: "transparent",
                              }}
                            />
                          </td>

                          {/* 3. Çapraz kur / Has / Kur */}
                          <td style={{ padding: 0, borderRight: "1px solid #e0e0e0" }}>
                            <input
                              id={`grid-input-sag-${idx}-kur`}
                              type="text"
                              inputMode="decimal"
                              value={
                                mutabakatTuru === "has"
                                  ? (row.hasOrani !== undefined && row.hasOrani !== null ? String(row.hasOrani) : "")
                                  : (row.kur !== undefined && row.kur !== null ? String(row.kur) : "")
                              }
                              onChange={(e) => {
                                const val = e.target.value.replace(/,/g, ".");
                                if (val === "" || /^\d*\.?\d*$/.test(val)) {
                                  if (mutabakatTuru === "has") {
                                    handleGridChange("sag", idx, "hasOrani", val);
                                  } else {
                                    handleGridChange("sag", idx, "kur", val);
                                  }
                                }
                              }}
                              onFocus={() => {
                                setActiveSide("sag");
                                setActiveRowIndex(idx);
                                setSelectedSagIndex(idx);
                                setActiveField("kur");
                              }}
                              onKeyDown={(e) => handleCellKeyDown(e, "sag", idx, "kur")}
                              style={{
                                width: "100%",
                                height: "22px",
                                border: "none",
                                outline: "none",
                                padding: "0 6px",
                                fontSize: "12.5px",
                                textAlign: "right",
                                fontWeight: 500,
                                color: "#0f172a",
                                backgroundColor: "transparent",
                              }}
                            />
                          </td>

                          {/* Sil Butonu */}
                          <td style={{ padding: 0, textAlign: "center" }}>
                            <Button
                              variant="link"
                              className="p-0 text-danger text-decoration-none"
                              onClick={() => handleDeleteRow("sag", idx)}
                              title="Satırı Sil"
                            >
                              <IconTrash size={12} />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Dip Toplam (Satır Ekle butonu kaldırıldı, Enter tuşu ile çapraz kurdayken otomatik eklenir) */}
              <div className="d-flex align-items-center justify-content-end mt-2 pt-2 border-top">
                <div className="d-flex align-items-center gap-2">
                  <span className="fw-semibold text-dark" style={{ fontSize: "12px" }}>
                    {dipToplamLabel}
                  </span>
                  <span
                    className="fw-bold font-monospace text-dark px-2.5 py-1 border bg-light"
                    style={{ fontSize: "13px", minWidth: "100px", textAlign: "right", borderRadius: "4px" }}
                  >
                    {formatNumberDisplay(sagBazToplam)}
                  </span>
                </div>
              </div>
            </div>
          </Col>
        </Row>

        {/* 4. Alt Kısım: Ref No (En alttaki kaydet butonu kaldırıldı, üstteki kaydet ikonu veya F1 kullanılır) */}
        <div className="d-flex align-items-center justify-content-between mt-2 pt-2 border-top">
          <div className="d-flex align-items-center">
            <span className="small text-dark me-2" style={{ width: "50px" }}>
              Ref no
            </span>
            <Form.Control
              size="sm"
              value={refNo}
              onChange={(e) => setRefNo(e.target.value)}
              style={{
                height: "25px",
                width: "160px",
                fontSize: "12.5px",
                border: "1px solid #7f9db9",
                borderRadius: "2px",
              }}
            />
          </div>

          <div className="text-muted small">
            Kaydetmek için üst araç çubuğundaki <IconDeviceFloppy size={14} className="align-text-bottom text-primary" /> simgesini veya <strong>F1</strong> tuşunu kullanabilirsiniz.
          </div>
        </div>

        {/* 5. Alt Cyan Durum Çubuğu (Görseldeki Gibi Kısayol Tuşları) */}
        <div
          className="w-100 text-center text-nowrap fw-semibold mt-2 px-2"
          style={{
            height: "24px",
            lineHeight: "24px",
            backgroundColor: "#d5f3fe",
            color: "#0369a1",
            fontSize: "11.5px",
            borderRadius: "2px",
            border: "1px solid #bae6fd",
            userSelect: "none",
          }}
        >
          <span className="me-3 cursor-pointer" onClick={handleSave} style={{ cursor: "pointer" }}>
            <strong>F1)</strong> Kayıt
          </span>
          <span className="me-3 cursor-pointer" onClick={() => setShowBakiyeModal(true)} style={{ cursor: "pointer" }}>
            <strong>F5)</strong> Bakiye
          </span>
          <span className="me-3 cursor-pointer" onClick={handleHesapKapat} style={{ cursor: "pointer" }}>
            <strong>F6)</strong> Hesap Kapat
          </span>
          <span className="me-3">
            <strong>F7)</strong> Vadeli işlem
          </span>
          <span
            className="me-3 cursor-pointer"
            onClick={handleF9Switch}
            style={{ cursor: "pointer" }}
          >
            <strong>F9)</strong> Sağ/Sol
          </span>
          <span>
            <strong>F10)</strong> Kes
          </span>
        </div>
      </div>

      {/* ===================== MODALLAR ===================== */}

      {/* 1. Dekont Arama Modalı */}
      <LookupModal<CariDekontListItem>
        show={showDekontSearchModal}
        onHide={() => setShowDekontSearchModal(false)}
        title="Kayıtlı Dekontlar Listesi"
        searchPlaceholder="Dekont no, cari kodu veya adı ile ara..."
        items={savedDekonts}
        isLoading={isLoadingLookups}
        filterFn={(item, term) => {
          const t = term.toLowerCase();
          return (
            (item.dekontNo && item.dekontNo.toLowerCase().includes(t)) ||
            (item.cariKod && item.cariKod.toLowerCase().includes(t)) ||
            (item.cariAd && item.cariAd.toLowerCase().includes(t))
          );
        }}
        columns={[
          {
            header: "Dekont No",
            width: "120px",
            render: (d) => <span className="fw-bold font-monospace text-primary">{d.dekontNo}</span>,
          },
          {
            header: "Tarih",
            width: "100px",
            render: (d) => d.tarih ? d.tarih.split("T")[0] : "",
          },
          {
            header: "Cari",
            render: (d) => (
              <div>
                <div className="fw-semibold">{d.cariAd || "-"}</div>
                <small className="text-muted">{d.cariKod}</small>
              </div>
            ),
          },
          {
            header: "İşlem Türü",
            width: "130px",
            render: (d) => (
              <Badge bg={d.tip === 0 ? "success" : d.tip === 1 ? "danger" : "info"}>
                {d.tip === 0 ? "Emanet Alma" : d.tip === 1 ? "Emanet Verme" : "Dekont / Virman"}
              </Badge>
            ),
          },
        ]}
        onSelect={(d) => {
          const idx = savedDekonts.findIndex((s) => s.cariDekontId === d.cariDekontId);
          if (idx !== -1) setCurrentIndex(idx);
          loadDekontRecord(d.cariDekontId);
          setShowDekontSearchModal(false);
        }}
      />

      {/* 2. Cari Seçim Modalı */}
      <LookupModal<CariKartItem>
        show={showCariLookupTarget !== null}
        onHide={() => setShowCariLookupTarget(null)}
        title="Cari Hesap Seçimi"
        searchPlaceholder="Cari kodu, adı veya telefonu ile ara..."
        items={cariList}
        isLoading={isLoadingLookups}
        filterFn={(item, term) => {
          const t = term.toLowerCase();
          return (
            (item.kod && item.kod.toLowerCase().includes(t)) ||
            (item.ad && item.ad.toLowerCase().includes(t)) ||
            (item.telefon && item.telefon.toLowerCase().includes(t))
          );
        }}
        columns={[
          {
            header: "Cari Kodu",
            width: "140px",
            render: (c) => <span className="fw-bold font-monospace text-primary">{c.kod}</span>,
          },
          {
            header: "Cari Ünvanı / Adı",
            render: (c) => <span className="fw-semibold text-dark">{c.ad}</span>,
          },
          {
            header: "Telefon",
            width: "130px",
            render: (c) => <span className="font-monospace text-muted">{c.telefon || "-"}</span>,
          },
        ]}
        onSelect={(c) => {
          if (showCariLookupTarget === "cari2") {
            setCari2KartId(c.id);
            setCari2Kod(c.kod);
            setCari2Ad(c.ad);
            setCari2Telefon(c.telefon || "");
          } else {
            handleSelectCari(c);
          }
          setShowCariLookupTarget(null);
        }}
      />

      {/* Önceki Dekont Seçim Modalı */}
      <LookupModal<CariDekontListItem>
        show={showOncekiLookupModal}
        onHide={() => setShowOncekiLookupModal(false)}
        title="Önceki Dekont / Fiş Kaydı Seçimi"
        searchPlaceholder="Dekont no, cari veya tarih ile ara..."
        items={savedDekonts}
        isLoading={isLoadingLookups}
        filterFn={(item, term) => {
          const t = term.toLowerCase();
          return (
            (item.dekontNo && item.dekontNo.toLowerCase().includes(t)) ||
            (item.cariKod && item.cariKod.toLowerCase().includes(t)) ||
            (item.cariAd && item.cariAd.toLowerCase().includes(t))
          );
        }}
        columns={[
          {
            header: "Dekont No",
            width: "120px",
            render: (d) => <span className="fw-bold font-monospace text-primary">{d.dekontNo}</span>,
          },
          {
            header: "Tarih",
            width: "100px",
            render: (d) => (d.tarih ? d.tarih.split("T")[0] : ""),
          },
          {
            header: "Cari",
            render: (d) => (
              <div>
                <div className="fw-semibold">{d.cariAd || "-"}</div>
                <small className="text-muted">{d.cariKod}</small>
              </div>
            ),
          },
        ]}
        onSelect={handleSelectOncekiDekont}
      />

      {/* 3. Vezne Seçim Modalı */}
      <LookupModal<VezneItem>
        show={showVezneLookup}
        onHide={() => setShowVezneLookup(false)}
        title="Vezne / Kasa Seçimi"
        searchPlaceholder="Vezne kodu veya adı ile ara..."
        items={vezneList}
        isLoading={isLoadingLookups}
        filterFn={(item, term) => {
          const t = term.toLowerCase();
          return (
            (item.kod && item.kod.toLowerCase().includes(t)) ||
            (item.ad && item.ad.toLowerCase().includes(t))
          );
        }}
        columns={[
          {
            header: "Vezne Kodu",
            width: "120px",
            render: (v) => <span className="fw-bold font-monospace text-primary">{v.kod}</span>,
          },
          {
            header: "Vezne Adı",
            render: (v) => <span className="fw-semibold text-dark">{v.ad}</span>,
          },
        ]}
        onSelect={(v) => {
          setVezneId(v.id);
          setVezneKod(v.kod);
          setVezneAd(v.ad);
          setShowVezneLookup(false);
        }}
      />

      {/* 4. Para / Döviz / Maden Seçim Modalı */}
      <LookupModal<ParaItem>
        show={showParaLookupTarget !== null}
        onHide={() => setShowParaLookupTarget(null)}
        title="Para Birimi / Maden Seçimi"
        searchPlaceholder="Sembol (USD, EUR, HAS...) veya ad ile ara..."
        items={paraList}
        isLoading={isLoadingLookups}
        filterFn={(item, term) => {
          const t = term.toLowerCase();
          return (
            (item.kod && item.kod.toLowerCase().includes(t)) ||
            (item.ad && item.ad.toLowerCase().includes(t))
          );
        }}
        columns={[
          {
            header: "Sembol (SMB)",
            width: "100px",
            render: (p) => <span className="badge bg-primary px-2 py-1 font-monospace">{p.kod}</span>,
          },
          {
            header: "Para / Maden Tanımı",
            render: (p) => <span className="fw-semibold text-dark">{p.ad}</span>,
          },
          {
            header: "Ayar / Has Oranı",
            width: "120px",
            align: "right",
            render: (p) => <span className="font-monospace">{p.hasOrani ?? 1.0}</span>,
          },
          {
            header: "Parite (Kur)",
            width: "120px",
            align: "right",
            render: (p) => (
              <span className="font-monospace fw-semibold text-success">
                {p.parite != null ? p.parite.toFixed(4) : (p.kur != null ? Number(p.kur).toFixed(4) : "-")}
              </span>
            ),
          },
        ]}
        onSelect={(p) => {
          if (showParaLookupTarget) {
            handleSelectParaForRow(showParaLookupTarget.side, showParaLookupTarget.index, p);
          }
          setShowParaLookupTarget(null);
        }}
      />

      {/* 5. F5 - Cari Bakiye Bilgi Modalı */}
      <Modal show={showBakiyeModal} onHide={() => setShowBakiyeModal(false)} centered size="sm">
        <Modal.Header closeButton className="py-2">
          <Modal.Title className="fs-6 fw-bold">Cari Bakiye Bilgisi (F5)</Modal.Title>
        </Modal.Header>
        <Modal.Body className="py-3 text-center">
          <div className="fw-bold text-primary mb-1">{cariKod || "Seçili Cari Yok"}</div>
          <div className="text-secondary small mb-3">{cariAd || "Lütfen bir cari hesap seçiniz"}</div>
          <div className="p-2 border rounded bg-light">
            <span className="small text-muted d-block">Güncel Net Bakiye</span>
            <span className="fs-5 fw-bold text-dark font-monospace">0.00 TL</span>
          </div>
        </Modal.Body>
        <Modal.Footer className="py-1.5">
          <Button variant="secondary" size="sm" onClick={() => setShowBakiyeModal(false)}>
            Kapat
          </Button>
        </Modal.Footer>
      </Modal>

      {/* 6. SMB Floating Suggestion Dropdown (Table taşmalarından ve scrollbar'dan asla etkilenmeyen fixed popup) */}
      {activeSmbSuggest && smbSuggestions.length > 0 && suggestDropdownPos && (
        <div
          style={{
            position: "fixed",
            top: suggestDropdownPos.top,
            left: suggestDropdownPos.left,
            width: suggestDropdownPos.width,
            maxHeight: "240px",
            overflowY: "auto",
            backgroundColor: "#ffffff",
            border: "1.5px solid #2563eb",
            boxShadow: "0 10px 25px -3px rgba(0, 0, 0, 0.25), 0 4px 6px -2px rgba(0, 0, 0, 0.1)",
            zIndex: 99999,
            borderRadius: "6px",
          }}
        >
          <div
            style={{
              padding: "4px 8px",
              backgroundColor: "#f1f5f9",
              borderBottom: "1px solid #e2e8f0",
              fontSize: "11px",
              fontWeight: 700,
              color: "#475569",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>DÖVİZ / MADEN SEÇİMİ</span>
            <span>PARİTE (KUR)</span>
          </div>
          {smbSuggestions.map((p, pIdx) => {
            const isSelected = pIdx === smbSuggestIndex;
            const pariteVal = p.parite != null ? p.parite : (p.kur != null ? Number(p.kur) : 1.0);
            return (
              <div
                id={`smb-suggest-item-${pIdx}`}
                key={p.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelectParaForRow(activeSmbSuggest.side, activeSmbSuggest.index, p);
                }}
                style={{
                  padding: "6px 8px",
                  cursor: "pointer",
                  fontSize: "12px",
                  backgroundColor: isSelected ? "#2563eb" : pIdx % 2 === 0 ? "#ffffff" : "#f8fafc",
                  color: isSelected ? "#ffffff" : "#0f172a",
                  borderBottom: "1px solid #f1f5f9",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
                onMouseEnter={() => setSmbSuggestIndex(pIdx)}
              >
                <div className="d-flex align-items-center gap-2" style={{ overflow: "hidden" }}>
                  <span
                    style={{
                      fontWeight: 700,
                      fontFamily: "monospace",
                      fontSize: "12px",
                      backgroundColor: isSelected ? "#1d4ed8" : "#e0e7ff",
                      color: isSelected ? "#ffffff" : "#1e40af",
                      padding: "1px 5px",
                      borderRadius: "3px",
                      flexShrink: 0,
                    }}
                  >
                    {p.kod}
                  </span>
                  <span
                    style={{
                      fontWeight: 500,
                      color: isSelected ? "#ffffff" : "#334155",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {p.ad}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: "11.5px",
                    fontFamily: "monospace",
                    fontWeight: 600,
                    color: isSelected ? "#fef08a" : "#059669",
                    marginLeft: "8px",
                    flexShrink: 0,
                  }}
                >
                  {pariteVal.toFixed(4)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CariEmanetDekontPage;
