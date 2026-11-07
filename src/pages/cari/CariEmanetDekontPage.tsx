import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { caprazKurDenetle, kurDegistirilebilir } from "../../../Backend/src/services/yetki/kullaniciYetkiKural";
import { kurOnayi } from "../../utils/kurYetkiDenetimi";
import { CompanyService } from "../../services/companyService";
import { useKullaniciYetkisi } from "../../hooks/useKullaniciYetkisi";
import { fisGunu } from "../../utils/fisTarihi";
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
import { isCtrlNEvent } from "../../utils/keyboardShortcuts";
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
import { onlyDecimal, blockNonNumericKeys } from "../../utils/numericInput";
import useERPAutoFocus from "../../hooks/useERPAutoFocus";

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
  tlKur?: number;
  giseKuru?: number;
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
  // Tarih değiştirme yetkisi yoksa tarih alanı kilitli (docs/YETKI_VE_VEZNE_YOL_HARITASI.md §4.2; sunucu da denetler)
  const kYetki = useKullaniciYetkisi();
  const tarihYetkisi = kYetki.tarihDegistirme;
  // Kur yetkisi "Yok" ise satır kurları kilitli (has mutabakatında has oranı serbest)
  const kurAcik = kurDegistirilebilir(kYetki);
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

  const islemTuruRef = useRef<HTMLSelectElement | null>(null);

  useERPAutoFocus({
    preferredSelector: "#islemTuruSelect",
    dependencies: [cariDekontId, isLoadingLookups],
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      islemTuruRef.current?.focus();
    }, 80);
    return () => clearTimeout(timer);
  }, [location.pathname, cariDekontId]);

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

  // Otomatik Denkleştirme Fonksiyonu (Sağ veya sol paneli karşı tarafa eşitleyecek miktarı hesaplar)
  const autoBalanceRow = useCallback(
    (
      targetRows: GridRowState[],
      rowIndex: number,
      mutabakat: MutabakatType,
      baseTotalTarget: number,
      oppositeRows?: GridRowState[]
    ): GridRowState[] => {
      const targetIdx = Math.max(0, Math.min(rowIndex, targetRows.length - 1));
      return targetRows.map((r, idx) => {
        if (idx !== targetIdx) return r;

        let rowToBalance = { ...r };

        // Eğer para seçili değilse uygun bir para birimi ata
        if (!rowToBalance.paraKodu || !rowToBalance.paraKodu.trim()) {
          let defaultP: ParaItem | undefined;
          if (mutabakat === "has") {
            defaultP = paraList.find((p) => p.kod === "HAS") || paraList[0];
          } else if (mutabakat === "kur") {
            defaultP = paraList.find((p) => p.kod === "TL") || paraList[0];
          } else {
            const oppParaKod = oppositeRows?.[0]?.paraKodu;
            if (oppParaKod && oppParaKod !== "USD") {
              defaultP = paraList.find((p) => p.kod === "USD") || paraList[0];
            } else if (oppParaKod === "USD") {
              defaultP = paraList.find((p) => p.kod === "EUR") || paraList.find((p) => p.kod === "USD") || paraList[0];
            } else {
              defaultP = paraList.find((p) => p.kod === "USD") || paraList[0];
            }
          }

          if (defaultP) {
            const has = defaultP.hasOrani && defaultP.hasOrani > 0 ? defaultP.hasOrani : 1.0;
            let targetKur: number | string = defaultP.caprazKur ?? defaultP.parite ?? (defaultP.kod === "USD" ? 1.0 : 1.0);
            if (mutabakat === "has") targetKur = has;
            else if (mutabakat === "kur") targetKur = defaultP.giseKuru ?? defaultP.tlKur ?? 1.0;

            rowToBalance.paraId = defaultP.id;
            rowToBalance.paraKodu = (defaultP.kod || "").trim().toUpperCase();
            rowToBalance.paraAdi = (defaultP.ad || "").trim();
            rowToBalance.hasOrani = has;
            rowToBalance.kur = targetKur;
            rowToBalance.giseKuru = defaultP.giseKuru ?? defaultP.tlKur ?? 1.0;
          }
        }

        const rate = parseFloat(String(rowToBalance.kur ?? 1).replace(/,/g, ".")) || 1.0;
        const has = parseFloat(String(rowToBalance.hasOrani ?? 1).replace(/,/g, ".")) || 1.0;

        // Bu satır haricindeki diğer satırların baz toplamı
        const otherRowsTotal = targetRows
          .filter((_, i) => i !== targetIdx)
          .reduce((acc, otherRow) => acc + getRowEquivalent(otherRow, mutabakat), 0);

        const remainingBase = Math.max(0, baseTotalTarget - otherRowsTotal);

        let calculatedMiktar = 0;
        if (mutabakat === "capraz") {
          const isGold = (rowToBalance.paraKodu || "").includes("HAS") || (rowToBalance.paraKodu || "").includes("ALT");
          calculatedMiktar = rate > 0 ? Number((remainingBase / rate).toFixed(isGold ? 3 : 2)) : 0;
        } else if (mutabakat === "has") {
          calculatedMiktar = has > 0 ? Number((remainingBase / has).toFixed(3)) : 0;
        } else {
          calculatedMiktar = rate > 0 ? Number((remainingBase / rate).toFixed(2)) : 0;
        }

        return {
          ...rowToBalance,
          meblag: calculatedMiktar > 0 ? calculatedMiktar : "",
        };
      });
    },
    [getRowEquivalent, paraList]
  );

  // Mutabakat Türü Değiştiğinde Tablolardaki Kurları Otomatik Güncelle
  const handleMutabakatTuruChange = useCallback(
    (newMutabakat: MutabakatType) => {
      setMutabakatTuru(newMutabakat);
      const updateRows = (rows: GridRowState[]) =>
        rows.map((r) => {
          if (!r.paraKodu) return r;
          const matched = paraList.find((p) => (p.kod || "").toUpperCase() === r.paraKodu.toUpperCase());
          if (!matched) return r;
          let newKur: number | string = r.kur;
          if (newMutabakat === "capraz") {
            newKur = matched.caprazKur ?? matched.parite ?? (matched.kod === "USD" ? 1.0 : 1.0);
          } else if (newMutabakat === "has") {
            newKur = matched.hasOrani ?? 1.0;
          } else {
            newKur = matched.giseKuru ?? matched.tlKur ?? 1.0;
          }
          return {
            ...r,
            kur: newKur,
            hasOrani: matched.hasOrani ?? r.hasOrani,
          };
        });

      setSolSatirlar(updateRows);
      setSagSatirlar(updateRows);
    },
    [paraList]
  );

  // Boş Satırları Otomatik Temizleme: İlk satır haricinde boş bir satır varsa bir yere tıklayınca otomatik kalkar
  useEffect(() => {
    const handleDocumentMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const clickedRowId = target?.closest("tr")?.getAttribute("data-row-id");

      setSolSatirlar((prev) => {
        if (prev.length <= 1) return prev;
        const filtered = prev.filter((r, idx) => {
          if (idx === 0) return true; // İlk satır daima korunur
          const isEmpty = (!r.paraKodu || !r.paraKodu.trim()) && (!r.meblag || Number(r.meblag) === 0);
          if (isEmpty && r.id !== clickedRowId) {
            return false;
          }
          return true;
        });
        if (filtered.length === prev.length) return prev;
        return filtered.map((r, i) => ({ ...r, satirNo: i + 1 }));
      });

      setSagSatirlar((prev) => {
        if (prev.length <= 1) return prev;
        const filtered = prev.filter((r, idx) => {
          if (idx === 0) return true; // İlk satır daima korunur
          const isEmpty = (!r.paraKodu || !r.paraKodu.trim()) && (!r.meblag || Number(r.meblag) === 0);
          if (isEmpty && r.id !== clickedRowId) {
            return false;
          }
          return true;
        });
        if (filtered.length === prev.length) return prev;
        return filtered.map((r, i) => ({ ...r, satirNo: i + 1 }));
      });
    };

    document.addEventListener("mousedown", handleDocumentMouseDown);
    return () => document.removeEventListener("mousedown", handleDocumentMouseDown);
  }, []);

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

      // 1. USD'nin TL satış kurunu belirle (Çapraz kur ve TL pariteleri için baz alınır)
      let usdTLRate = 1.0;
      if (kurTabloRes?.satirlar && Array.isArray(kurTabloRes.satirlar)) {
        const usdItem = kurTabloRes.satirlar.find((k: any) => (k.kod || "").toUpperCase().trim() === "USD");
        if (usdItem) {
          usdTLRate = Number(usdItem.dovizSatis || usdItem.efektifSatis || usdItem.dovizAlis || 1.0);
        }
      }
      if (usdTLRate <= 0) usdTLRate = 1.0;

      const enrichedParalar: ParaItem[] = baseParalar.map((p) => {
        const cleanKod = (p.kod || "").toUpperCase().trim();
        const k = kurMap.get(p.id) || kurCodeMap.get(cleanKod);

        // Gişe TL Satış Kuru
        let tlKur = 1.0;
        if (cleanKod === "TL" || cleanKod === "TRY") {
          tlKur = 1.0;
        } else if (k) {
          tlKur = Number(k.dovizSatis || k.efektifSatis || k.dovizAlis || (k.parite ? k.parite * usdTLRate : 1.0));
        } else if (cleanKod === "USD") {
          tlKur = usdTLRate;
        }

        // Çapraz Kur / Parite (USD Bazında)
        let pariteOrani = 1.0;
        if (cleanKod === "USD") {
          pariteOrani = 1.0;
        } else if (cleanKod === "TL" || cleanKod === "TRY") {
          // TL'nin USD karşılığı: 1 TL = 1 / usdTLRate
          pariteOrani = usdTLRate > 0 ? Number((1.0 / usdTLRate).toFixed(6)) : 1.0;
        } else if (k?.parite != null && Number(k.parite) > 0) {
          pariteOrani = Number(Number(k.parite).toFixed(6));
        } else if (tlKur > 0 && usdTLRate > 0) {
          pariteOrani = Number((tlKur / usdTLRate).toFixed(6));
        }

        // Has Oranı (Milyem)
        let has = p.hasOrani && p.hasOrani > 0 ? p.hasOrani : 1.0;
        if (cleanKod === "HAS" || cleanKod === "ALT" || cleanKod === "24A" || cleanKod === "24") has = 1.0;
        else if (cleanKod === "22A" || cleanKod === "22") has = 0.916;
        else if (cleanKod === "18A" || cleanKod === "18") has = 0.750;
        else if (cleanKod === "14A" || cleanKod === "14") has = 0.585;
        else if (cleanKod === "8A" || cleanKod === "8") has = 0.333;
        else if (k?.hasOrani && Number(k.hasOrani) > 0) {
          has = Number(k.hasOrani) > 10 ? Number(k.hasOrani) / 1000 : Number(k.hasOrani);
        }

        return {
          ...p,
          kod: cleanKod,
          ad: (p.ad || "").trim(),
          hasOrani: has,
          parite: pariteOrani,
          caprazKur: pariteOrani,
          tlKur,
          giseKuru: tlKur,
          kur: pariteOrani,
        };
      });

      setParaList(enrichedParalar);
      const sortedDekonts = [...dekontlar].sort((a, b) => a.cariDekontId - b.cariDekontId);
      setSavedDekonts(sortedDekonts);
      savedDekontsRef.current = sortedDekonts;

      applyUserVezne(vezneler);

      // Kayıt vs Düzeltme Modu Davranışı:
      // Hem Kayıt hem de Düzeltme ilk açılışta boş form ile başlar
      if (isDuzeltmeMode && queryId) {
        const targetId = Number(queryId);
        const foundIdx = sortedDekonts.findIndex((d) => d.cariDekontId === targetId);
        if (foundIdx !== -1) setCurrentIndex(foundIdx);
        await loadDekontRecord(targetId, trimmedCariler, false);
      } else {
        setCurrentIndex(-1);
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
      setCurrentIndex(-1);
      resetFormToBlank(false);
    }
  }, [location.pathname, resetFormToBlank]);

  // Para Birimi Seçildiğinde Tek Seferde Tüm Hücreleri Doldur
  const handleSelectParaForRow = (
    side: "sol" | "sag",
    index: number,
    p: ParaItem
  ) => {
    const isLeft = side === "sol";
    const setter = isLeft ? setSolSatirlar : setSagSatirlar;

    const has = p.hasOrani && p.hasOrani > 0 ? p.hasOrani : 1.0;
    let targetKur: number | string = p.caprazKur ?? p.parite ?? (p.kod === "USD" ? 1.0 : 1.0);
    if (mutabakatTuru === "has") {
      targetKur = has;
    } else if (mutabakatTuru === "kur") {
      targetKur = p.giseKuru ?? p.tlKur ?? (p.kod === "TL" ? 1.0 : 1.0);
    }

    setter((prevRows) => {
      const rows = [...prevRows];
      const currentRow = rows[index] || createEmptyRow(index + 1);

      const updatedRow: GridRowState = {
        ...currentRow,
        paraId: p.id,
        paraKodu: (p.kod || "").trim().toUpperCase(),
        paraAdi: (p.ad || "").trim(),
        hasOrani: has,
        kur: targetKur,
        giseKuru: p.giseKuru ?? p.tlKur ?? 1.0,
      };
      rows[index] = updatedRow;

      if (!isLeft && solBazToplam > 0 && (!updatedRow.meblag || Number(updatedRow.meblag) === 0)) {
        return autoBalanceRow(rows, index, mutabakatTuru, solBazToplam);
      }
      return rows;
    });

    setActiveSmbSuggest(null);

    // SMB seçildikten sonra otomatik olarak Miktar hücresine odaklan
    requestAnimationFrame(() => {
      const meblagInput = document.getElementById(`grid-input-${side}-${index}-meblag`) as HTMLInputElement | null;
      if (meblagInput) {
        meblagInput.focus();
        meblagInput.select();
        setActiveField("meblag");
      }
    });
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
      let sanitizedValue = value;
      if (field === "meblag" || field === "hasOrani" || field === "kur" || field === "giseKuru") {
        sanitizedValue = onlyDecimal(value);
      }
      const updatedRow = { ...currentRow, [field]: sanitizedValue };
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
          let targetKur: number | string = matchedPara.caprazKur ?? matchedPara.parite ?? (matchedPara.kod === "USD" ? 1.0 : 1.0);
          if (mutabakatTuru === "has") {
            targetKur = has;
          } else if (mutabakatTuru === "kur") {
            targetKur = matchedPara.giseKuru ?? matchedPara.tlKur ?? (matchedPara.kod === "TL" ? 1.0 : 1.0);
          }
          updatedRow.kur = targetKur;
          updatedRow.giseKuru = matchedPara.giseKuru ?? matchedPara.tlKur ?? 1.0;
        }
      }

      return rows;
    });
  };

  // F6 - Hesap Kapat / Otomatik Dengele
  const handleHesapKapat = useCallback(() => {
    if (solBazToplam <= 0) return;
    const targetIdx = selectedSagIndex >= 0 ? selectedSagIndex : sagSatirlar.length - 1;
    const balanced = autoBalanceRow(sagSatirlar, targetIdx, mutabakatTuru, solBazToplam, solSatirlar);
    setSagSatirlar(balanced);
    setAlertInfo({
      type: "success",
      message: "Hesap kapatıldı: İki tarafın toplamı eşitlendi.",
    });
    setTimeout(() => setAlertInfo(null), 3000);
  }, [solBazToplam, selectedSagIndex, sagSatirlar, mutabakatTuru, autoBalanceRow, solSatirlar]);

  // Yeni Satır Ekle
  const handleAddRow = (side: "sol" | "sag") => {
    const setter = side === "sol" ? setSolSatirlar : setSagSatirlar;
    setter((prev) => {
      // Kesinlikle otomatik USD veya EUR seçili gelmeyecek, tamamen boş satır açılacak
      return [...prev, createEmptyRow(prev.length + 1)];
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

  // Sağ tık menüsü eylemleri (Kalanı Kapat, Satırı Sil & Yeni Satır Ekle)
  useEffect(() => {
    const handleGridKapat = (e: any) => {
      const rowId = e.detail?.rowId;
      const tableType = e.detail?.tableType;

      let isSag = tableType === "sag";
      let isSol = tableType === "sol";
      let targetRowIndex = -1;

      if (rowId) {
        const foundSag = sagSatirlar.findIndex((r) => r.id === rowId);
        if (foundSag !== -1) {
          isSag = true;
          isSol = false;
          targetRowIndex = foundSag;
        } else {
          const foundSol = solSatirlar.findIndex((r) => r.id === rowId);
          if (foundSol !== -1) {
            isSol = true;
            isSag = false;
            targetRowIndex = foundSol;
          }
        }
      }

      if (!isSag && !isSol) {
        if (activeSide === "sag" || solBazToplam > sagBazToplam) {
          isSag = true;
          targetRowIndex = selectedSagIndex >= 0 ? selectedSagIndex : sagSatirlar.length - 1;
        } else {
          isSol = true;
          targetRowIndex = selectedSolIndex >= 0 ? selectedSolIndex : solSatirlar.length - 1;
        }
      }

      if (isSag) {
        if (solBazToplam <= 0) {
          setAlertInfo({
            type: "warning",
            message: "Kapatılacak bakiye yok: Karşı tarafın (sol) toplamı 0.",
          });
          setTimeout(() => setAlertInfo(null), 3000);
          return;
        }
        const targetIdx = targetRowIndex >= 0 ? targetRowIndex : sagSatirlar.length - 1;
        const balanced = autoBalanceRow(sagSatirlar, targetIdx, mutabakatTuru, solBazToplam, solSatirlar);
        setSagSatirlar(balanced);
        setSelectedSagIndex(targetIdx);
        setActiveSide("sag");
        setActiveRowIndex(targetIdx);
        setAlertInfo({
          type: "success",
          message: "Kalan bakiye otomatik kapatıldı.",
        });
        setTimeout(() => setAlertInfo(null), 3000);
      } else {
        if (sagBazToplam <= 0) {
          setAlertInfo({
            type: "warning",
            message: "Kapatılacak bakiye yok: Karşı tarafın (sağ) toplamı 0.",
          });
          setTimeout(() => setAlertInfo(null), 3000);
          return;
        }
        const targetIdx = targetRowIndex >= 0 ? targetRowIndex : solSatirlar.length - 1;
        const balanced = autoBalanceRow(solSatirlar, targetIdx, mutabakatTuru, sagBazToplam, sagSatirlar);
        setSolSatirlar(balanced);
        setSelectedSolIndex(targetIdx);
        setActiveSide("sol");
        setActiveRowIndex(targetIdx);
        setAlertInfo({
          type: "success",
          message: "Kalan bakiye otomatik kapatıldı.",
        });
        setTimeout(() => setAlertInfo(null), 3000);
      }
    };

    const handleGridDelete = (e: any) => {
      const rowId = e.detail?.rowId;
      if (!rowId) return;
      const solIdx = solSatirlar.findIndex((r) => r.id === rowId);
      if (solIdx !== -1) {
        handleDeleteRow("sol", solIdx);
        return;
      }
      const sagIdx = sagSatirlar.findIndex((r) => r.id === rowId);
      if (sagIdx !== -1) {
        handleDeleteRow("sag", sagIdx);
      }
    };

    const handleGridAdd = (e: any) => {
      const tableType = e.detail?.tableType;
      const rowId = e.detail?.rowId;
      let targetSide = activeSide;
      if (tableType === "sag" || (rowId && sagSatirlar.some((r) => r.id === rowId))) {
        targetSide = "sag";
      } else if (tableType === "sol" || (rowId && solSatirlar.some((r) => r.id === rowId))) {
        targetSide = "sol";
      }

      if (targetSide === "sol") {
        setSolSatirlar((prev) => [...prev, createEmptyRow(prev.length + 1)]);
      } else {
        setSagSatirlar((prev) => [...prev, createEmptyRow(prev.length + 1)]);
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
  }, [
    solSatirlar,
    sagSatirlar,
    activeSide,
    selectedSolIndex,
    selectedSagIndex,
    solBazToplam,
    sagBazToplam,
    mutabakatTuru,
    autoBalanceRow,
  ]);

  // Bildirimlerin 3.5 sn sonra otomatik kapanması
  useEffect(() => {
    if (alertInfo) {
      const timer = setTimeout(() => setAlertInfo(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [alertInfo]);

  // F9 - Tablolar Arası Geçiş (Doğrudan hücreye odaklanır)
  const handleF9Switch = useCallback(() => {
    const nextSide = activeSide === "sol" ? "sag" : "sol";
    const rows = nextSide === "sol" ? solSatirlar : sagSatirlar;
    const targetRow = Math.min(Math.max(0, activeRowIndex), rows.length - 1);
    setActiveSide(nextSide);
    if (nextSide === "sol") setSelectedSolIndex(targetRow);
    else setSelectedSagIndex(targetRow);
    setActiveRowIndex(targetRow);

    requestAnimationFrame(() => {
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
    });
  }, [activeSide, activeRowIndex, activeField, solSatirlar, sagSatirlar]);

  // Odaklama Yardımcısı
  const focusElement = (id: string, selectText: boolean = true) => {
    const el = document.getElementById(id) as HTMLElement | null;
    if (!el) return false;
    el.focus();
    if (selectText && el instanceof HTMLInputElement) {
      try {
        if (el.type !== "date") {
          el.select();
        }
      } catch {
        // ignore
      }
    }
    return true;
  };

  // Üst Form Kartları ve Şerit İçi 2D Klavye Gezinmesi (Sağ, Sol, Yukarı, Aşağı)
  const handleHeaderKeyDown = (
    e: React.KeyboardEvent<HTMLElement>,
    currentFieldId: string
  ) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
      return;
    }

    const isInput = e.currentTarget instanceof HTMLInputElement;
    if (isInput && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      const input = e.currentTarget as HTMLInputElement;
      if (input.type !== "date") {
        const { selectionStart, selectionEnd, value } = input;
        if (e.key === "ArrowLeft") {
          const isAtStart =
            (selectionStart === 0 && selectionEnd === 0) ||
            (selectionStart === 0 && selectionEnd === value.length);
          if (!isAtStart) return;
        } else if (e.key === "ArrowRight") {
          const isAtEnd =
            (selectionStart === value.length && selectionEnd === value.length) ||
            (selectionStart === 0 && selectionEnd === value.length);
          if (!isAtEnd) return;
        }
      }
    }

    e.preventDefault();

    switch (currentFieldId) {
      // --- KOLON 1 ---
      case "islemTuruSelect":
        if (e.key === "ArrowDown") focusElement("tarihInput");
        else if (e.key === "ArrowRight") focusElement("cariKodAdInput");
        break;

      case "tarihInput":
        if (e.key === "ArrowUp") focusElement("islemTuruSelect");
        else if (e.key === "ArrowDown") focusElement("evrakTuruSelect");
        else if (e.key === "ArrowRight") focusElement("vadeInput");
        break;

      case "vadeInput":
        if (e.key === "ArrowUp") focusElement("islemTuruSelect");
        else if (e.key === "ArrowDown") focusElement("evrakTuruSelect");
        else if (e.key === "ArrowLeft") focusElement("tarihInput");
        else if (e.key === "ArrowRight") focusElement("cariTelefonInput") || focusElement("mutabakatSelect") || focusElement("cariKodAdInput");
        break;

      case "evrakTuruSelect":
        if (e.key === "ArrowUp") focusElement("tarihInput");
        else if (e.key === "ArrowDown") focusElement("grid-input-sol-0-smb") || focusElement("solPanelKodInput");
        else if (e.key === "ArrowRight") focusElement("teslimAlanInput");
        break;

      // --- KOLON 2 ---
      case "cariKodAdInput":
        if (e.key === "ArrowLeft") focusElement("islemTuruSelect");
        else if (e.key === "ArrowRight") focusElement("dekontNoInput");
        else if (e.key === "ArrowDown") {
          if (tip === 2 && document.getElementById("cari2Input")) focusElement("cari2Input");
          else focusElement("cariTelefonInput") || focusElement("mutabakatSelect");
        }
        break;

      case "cari2Input":
        if (e.key === "ArrowLeft") focusElement("islemTuruSelect");
        else if (e.key === "ArrowRight") focusElement("dekontNoInput");
        else if (e.key === "ArrowUp") focusElement("cariKodAdInput");
        else if (e.key === "ArrowDown") focusElement("cariTelefonInput") || focusElement("mutabakatSelect");
        break;

      case "cariTelefonInput":
        if (e.key === "ArrowLeft") focusElement("vadeInput") || focusElement("tarihInput");
        else if (e.key === "ArrowRight") focusElement("mutabakatSelect");
        else if (e.key === "ArrowUp") {
          if (tip === 2 && document.getElementById("cari2Input")) focusElement("cari2Input");
          else focusElement("cariKodAdInput");
        } else if (e.key === "ArrowDown") focusElement("teslimAlanInput");
        break;

      case "mutabakatSelect":
        if (e.key === "ArrowLeft") focusElement("cariTelefonInput");
        else if (e.key === "ArrowRight") focusElement("durumSelect");
        else if (e.key === "ArrowUp") {
          if (tip === 2 && document.getElementById("cari2Input")) focusElement("cari2Input");
          else focusElement("cariKodAdInput");
        } else if (e.key === "ArrowDown") focusElement("teslimAlanInput");
        break;

      case "teslimAlanInput":
        if (e.key === "ArrowLeft") focusElement("evrakTuruSelect");
        else if (e.key === "ArrowRight") focusElement("aciklamaInput") || focusElement("oncekiBelgeInput");
        else if (e.key === "ArrowUp") focusElement("cariTelefonInput") || focusElement("mutabakatSelect");
        else if (e.key === "ArrowDown") focusElement("grid-input-sol-0-smb") || focusElement("solPanelKodInput");
        break;

      // --- KOLON 3 ---
      case "dekontNoInput":
        if (e.key === "ArrowLeft") focusElement("cariKodAdInput");
        else if (e.key === "ArrowDown") focusElement("durumSelect");
        break;

      case "durumSelect":
        if (e.key === "ArrowLeft") focusElement("mutabakatSelect") || focusElement("cariTelefonInput");
        else if (e.key === "ArrowRight") {
          if (document.getElementById("iptalTarihiInput")) focusElement("iptalTarihiInput");
        } else if (e.key === "ArrowUp") focusElement("dekontNoInput");
        else if (e.key === "ArrowDown") focusElement("oncekiBelgeInput");
        break;

      case "iptalTarihiInput":
        if (e.key === "ArrowLeft") focusElement("durumSelect");
        else if (e.key === "ArrowUp") focusElement("dekontNoInput");
        else if (e.key === "ArrowDown") focusElement("oncekiBelgeInput");
        break;

      case "oncekiBelgeInput":
        if (e.key === "ArrowLeft") focusElement("mutabakatSelect");
        else if (e.key === "ArrowUp") focusElement("durumSelect");
        else if (e.key === "ArrowDown") focusElement("aciklamaInput");
        break;

      case "aciklamaInput":
        if (e.key === "ArrowLeft") focusElement("teslimAlanInput");
        else if (e.key === "ArrowUp") focusElement("oncekiBelgeInput");
        else if (e.key === "ArrowDown") focusElement("grid-input-sag-0-smb") || focusElement("sagPanelKodInput");
        break;

      // --- RIBBON SOL ---
      case "solPanelKodInput":
        if (e.key === "ArrowUp") focusElement("teslimAlanInput") || focusElement("evrakTuruSelect");
        else if (e.key === "ArrowDown") focusElement("grid-input-sol-0-smb");
        else if (e.key === "ArrowRight") focusElement("solPanelAdInput");
        else if (e.key === "ArrowLeft") focusElement("evrakTuruSelect");
        break;

      case "solPanelAdInput":
        if (e.key === "ArrowUp") focusElement("teslimAlanInput");
        else if (e.key === "ArrowDown") focusElement("grid-input-sol-0-smb");
        else if (e.key === "ArrowLeft") focusElement("solPanelKodInput");
        else if (e.key === "ArrowRight") focusElement("sagPanelKodInput");
        break;

      // --- RIBBON SAĞ ---
      case "sagPanelKodInput":
        if (e.key === "ArrowUp") focusElement("aciklamaInput");
        else if (e.key === "ArrowDown") focusElement("grid-input-sag-0-smb");
        else if (e.key === "ArrowLeft") focusElement("solPanelAdInput");
        else if (e.key === "ArrowRight") focusElement("sagPanelAdInput");
        break;

      case "sagPanelAdInput":
        if (e.key === "ArrowUp") focusElement("aciklamaInput");
        else if (e.key === "ArrowDown") focusElement("grid-input-sag-0-smb");
        else if (e.key === "ArrowLeft") focusElement("sagPanelKodInput");
        break;
    }
  };

  // Hücreler İçi Klavye (Yön Okları ile 2D Gezinme ve Enter ile Yeni Satır)
  const handleCellKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    side: "sol" | "sag",
    rowIndex: number,
    field: "smb" | "meblag" | "kur"
  ) => {
    if (field === "meblag" || field === "kur") {
      blockNonNumericKeys(e, true);
    }

    const el = e.currentTarget;
    const isLeft = side === "sol";
    const rows = isLeft ? solSatirlar : sagSatirlar;
    const maxRow = rows.length - 1;

    // Enter Tuşu Davranışı: smb -> meblag -> kur -> otomatik yeni satır
    if (e.key === "Enter") {
      e.preventDefault();
      if (field === "smb") {
        const row = rows[rowIndex];
        const val = (row?.paraKodu || "").trim().toUpperCase();

        if (!val) {
          // Boşsa arama modalı açılmaz, sonraki hücreye (meblağ) odaklanır
          const nextEl = document.getElementById(`grid-input-${side}-${rowIndex}-meblag`) as HTMLInputElement | null;
          if (nextEl) {
            nextEl.focus();
            nextEl.select();
            setActiveField("meblag");
          }
          return;
        }

        // 1. Birebir kod eşleşmesi kontrolü
        const exact = paraList.find((p) => (p.kod || "").trim().toUpperCase() === val);
        if (exact) {
          handleSelectParaForRow(side, rowIndex, exact);
          return;
        }

        // 2. Kısmi eşleşme kontrolü (kod veya ad içerenler)
        const matches = paraList.filter(
          (p) =>
            (p.kod && p.kod.trim().toUpperCase().includes(val)) ||
            (p.ad && p.ad.trim().toLocaleUpperCase("tr-TR").includes(val))
        );

        if (matches.length === 1) {
          // Tek kayıt varsa direk seç ve sonraki hücreye (meblağ) odaklan
          handleSelectParaForRow(side, rowIndex, matches[0]);
          return;
        }

        // Birden fazla kayıt varsa veya hiç eşleşme yoksa modalı aç
        setShowParaLookupTarget({ side, index: rowIndex });
        return;
      } else if (field === "meblag") {
        const row = rows[rowIndex];
        const isMissing = Boolean(row?.paraKodu && (!row?.meblag || Number(row?.meblag) <= 0));
        if (isMissing) {
          // Miktar girilmemişse kızarsın ve buradan çıkamasın / yeni satır açılmasın
          const meblagEl = document.getElementById(`grid-input-${side}-${rowIndex}-meblag`) as HTMLInputElement | null;
          if (meblagEl) {
            meblagEl.focus();
            meblagEl.select();
          }
          return;
        }

        const nextEl = document.getElementById(`grid-input-${side}-${rowIndex}-kur`) as HTMLInputElement | null;
        if (nextEl) {
          nextEl.focus();
          nextEl.select();
          setActiveField("kur");
        }
        return;
      } else if (field === "kur") {
        const currentRow = rows[rowIndex];
        const isMissingMeblag = Boolean(
          currentRow?.paraKodu && (!currentRow?.meblag || Number(currentRow?.meblag) <= 0)
        );

        // 1. Eğer miktar girilmemişse kesinlikle yeni satır açma, miktar hücresine geri dön
        if (isMissingMeblag) {
          const meblagEl = document.getElementById(`grid-input-${side}-${rowIndex}-meblag`) as HTMLInputElement | null;
          if (meblagEl) {
            meblagEl.focus();
            meblagEl.select();
            setActiveField("meblag");
          }
          return;
        }

        const isCurrentRowEmpty =
          (!currentRow?.paraKodu || !currentRow?.paraKodu.trim()) &&
          (!currentRow?.meblag || Number(currentRow?.meblag) <= 0);

        // 2. Eğer aralardaki bir satırdaysak (son satır değilsek), bir alt satıra geç (yeni satır açma)
        if (rowIndex < maxRow) {
          const nextIdx = rowIndex + 1;
          setActiveRowIndex(nextIdx);
          if (side === "sol") setSelectedSolIndex(nextIdx);
          else setSelectedSagIndex(nextIdx);
          setActiveField("smb");
          requestAnimationFrame(() => {
            const nextInput = document.getElementById(`grid-input-${side}-${nextIdx}-smb`) as HTMLInputElement | null;
            if (nextInput) {
              nextInput.focus();
              nextInput.select();
            }
          });
          return;
        }

        // 3. Son satırdayız:
        // Eğer mevcut satır boşsa veya tabloda herhangi bir boş satır / eksik miktarlı satır varsa YENİ SATIR AÇMA!
        // Başa (ilk satıra) dön.
        const hasAnyEmptyOrIncompleteRow = rows.some((r, rIdx) => {
          if (rIdx === rowIndex) return false;
          const rEmpty = (!r.paraKodu || !r.paraKodu.trim()) && (!r.meblag || Number(r.meblag) <= 0);
          const rMissing = Boolean(r.paraKodu && (!r.meblag || Number(r.meblag) <= 0));
          return rEmpty || rMissing;
        });

        if (
          isCurrentRowEmpty ||
          hasAnyEmptyOrIncompleteRow ||
          !currentRow?.paraKodu ||
          !currentRow?.meblag ||
          Number(currentRow?.meblag) <= 0
        ) {
          setActiveRowIndex(0);
          if (side === "sol") setSelectedSolIndex(0);
          else setSelectedSagIndex(0);
          setActiveField("smb");
          requestAnimationFrame(() => {
            const firstInput = document.getElementById(`grid-input-${side}-0-smb`) as HTMLInputElement | null;
            if (firstInput) {
              firstInput.focus();
              firstInput.select();
            }
          });
          return;
        }

        // 4. Mevcut son satır tamamen dolu (paraKodu var ve miktar > 0) ve tabloda başka boş/eksik satır yok:
        // Yeni satır aç (otomatik para seçilmeden, tamamen boş) ve yeni satırın SMB hücresine odaklan.
        const nextIdx = rows.length;
        handleAddRow(side);
        setActiveRowIndex(nextIdx);
        if (side === "sol") setSelectedSolIndex(nextIdx);
        else setSelectedSagIndex(nextIdx);
        setActiveField("smb");
        requestAnimationFrame(() => {
          const nextInput = document.getElementById(`grid-input-${side}-${nextIdx}-smb`) as HTMLInputElement | null;
          if (nextInput) {
            nextInput.focus();
            nextInput.select();
          }
        });
        return;
      }
    }

    // Yön Okları (Sağ, Sol, Yukarı, Aşağı ve Tablolar Arası Geçiş)
    if (e.key === "ArrowRight") {
      const isAtEnd =
        (el.selectionStart === el.selectionEnd && el.selectionStart === el.value.length) ||
        (el.selectionStart === 0 && el.selectionEnd === el.value.length);
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
        } else if (field === "kur") {
          e.preventDefault();
          if (side === "sol") {
            // SOL panelden SAĞ panele aynı satırın SMB hücresine geçiş
            const targetRow = Math.min(rowIndex, sagSatirlar.length - 1);
            const nextEl = document.getElementById(`grid-input-sag-${targetRow}-smb`) as HTMLInputElement | null;
            if (nextEl) {
              setActiveSide("sag");
              setActiveRowIndex(targetRow);
              setSelectedSagIndex(targetRow);
              setActiveField("smb");
              nextEl.focus();
              nextEl.select();
            }
          } else if (rowIndex < maxRow) {
            const nextEl = document.getElementById(`grid-input-sag-${rowIndex + 1}-smb`) as HTMLInputElement | null;
            if (nextEl) {
              setActiveRowIndex(rowIndex + 1);
              setSelectedSagIndex(rowIndex + 1);
              setActiveField("smb");
              nextEl.focus();
              nextEl.select();
            }
          }
        }
      }
    } else if (e.key === "ArrowLeft") {
      const isAtStart =
        (el.selectionStart === 0 && el.selectionEnd === 0) ||
        (el.selectionStart === 0 && el.selectionEnd === el.value.length);
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
        } else if (field === "smb") {
          e.preventDefault();
          if (side === "sag") {
            // SAĞ panelden SOL panele aynı satırın KUR hücresine geçiş
            const targetRow = Math.min(rowIndex, solSatirlar.length - 1);
            const prevEl = document.getElementById(`grid-input-sol-${targetRow}-kur`) as HTMLInputElement | null;
            if (prevEl) {
              setActiveSide("sol");
              setActiveRowIndex(targetRow);
              setSelectedSolIndex(targetRow);
              setActiveField("kur");
              prevEl.focus();
              prevEl.select();
            }
          } else if (rowIndex > 0) {
            const prevEl = document.getElementById(`grid-input-sol-${rowIndex - 1}-kur`) as HTMLInputElement | null;
            if (prevEl) {
              setActiveRowIndex(rowIndex - 1);
              setSelectedSolIndex(rowIndex - 1);
              setActiveField("kur");
              prevEl.focus();
              prevEl.select();
            }
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
      } else if (rowIndex === 0) {
        // En üst satırdayken yukarı oka basılırsa forma geçiş
        e.preventDefault();
        if (side === "sol") {
          focusElement("teslimAlanInput") || focusElement("solPanelKodInput");
        } else {
          focusElement("aciklamaInput") || focusElement("sagPanelKodInput");
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
    // Seçildikten sonra sonraki alana (2. Cari varsa 2. Cari, yoksa Telefon'a) odaklan
    setTimeout(() => {
      if (tip === 2) {
        const c2 = document.getElementById("cari2Input");
        if (c2) {
          c2.focus();
          (c2 as HTMLInputElement).select?.();
          return;
        }
      }
      const telEl = document.getElementById("cariTelefonInput");
      if (telEl) {
        telEl.focus();
        (telEl as HTMLInputElement).select?.();
        return;
      }
      const teslimAlanEl = document.getElementById("teslimAlanInput");
      if (teslimAlanEl) {
        teslimAlanEl.focus();
        (teslimAlanEl as HTMLInputElement).select?.();
        return;
      }
      const firstCell = document.getElementById("grid-input-sol-0-smb") as HTMLInputElement | null;
      if (firstCell) {
        firstCell.focus();
        firstCell.select();
      }
    }, 60);
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
    } else {
      setCariKartId(null);
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
    setTimeout(() => {
      const aciklamaEl = document.getElementById("aciklamaInput");
      if (aciklamaEl) {
        aciklamaEl.focus();
        (aciklamaEl as HTMLInputElement).select?.();
        return;
      }
      const firstCell = document.getElementById("grid-input-sol-0-smb") as HTMLInputElement | null;
      if (firstCell) {
        firstCell.focus();
        firstCell.select();
      }
    }, 60);
    setTimeout(() => {
      const aciklamaEl = document.getElementById("aciklamaInput");
      if (aciklamaEl) {
        aciklamaEl.focus();
        (aciklamaEl as HTMLInputElement).select?.();
        return;
      }
      const firstCell = document.getElementById("grid-input-sol-0-smb") as HTMLInputElement | null;
      if (firstCell) {
        firstCell.focus();
        firstCell.select();
      }
    }, 60);
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

    // Kur yetkisi (gişe kuru = satırın parite kuru) ve çapraz kur kontrolü (docs/YETKI_VE_VEZNE_YOL_HARITASI.md §4.2; sunucu da denetler)
    const kurCinsiDegeri = mutabakatTuru === "capraz" ? kurCinsi || 0 : mutabakatTuru === "has" ? 1 : 2;
    if (mutabakatTuru !== "has") {
      const kurSatirlari = combinedLines.map((l, i) => ({
        etiket: `${i + 1}. satırın kuru`,
        gise: l.giseKuru > 0 && l.giseKuru !== 1 ? { kur: l.giseKuru } : null,
        kur: l.kur,
      }));
      if (!kurOnayi(kYetki, kurSatirlari, (m) => setAlertInfo({ type: "danger", message: m }))) return;
    }
    if (!kYetki.caprazKurKontroluYok) {
      const tanim = await CompanyService.getDefinitions().catch(() => null);
      const tolerans = kurCinsiDegeri === 2 ? Number(tanim?.CARI_TL_TOLERANSI) || 0 : Number(tanim?.CARI_USD_TOLERANSI) || 0;
      const caprazHata = caprazKurDenetle(kYetki, combinedLines, kurCinsiDegeri, tolerans);
      if (caprazHata) {
        setAlertInfo({ type: "danger", message: caprazHata });
        return;
      }
    }

    setIsSaving(true);
    setAlertInfo(null);

    try {
      const payload: SaveCariDekontPayload = {
        cariDekontId: cariDekontId && cariDekontId > 0 ? cariDekontId : null,
        tip,
        tarih: fisGunu(tarih, !(cariDekontId && cariDekontId > 0), tarihYetkisi),
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
      const isCtrlN = isCtrlNEvent(e);
      if (isCtrlN) {
        if (!isDuzeltmeMode) {
          e.preventDefault();
          e.stopPropagation();
          handleNew();
        }
        return;
      }

      if (e.key === "F1") {
        e.preventDefault();
        handleSave();
      } else if (e.key === "F5") {
        e.preventDefault();
        if (kYetki.cariBakiye) setShowBakiyeModal(true);
      } else if (e.key === "F6") {
        e.preventDefault();
        handleHesapKapat();
      } else if (e.key === "F9") {
        e.preventDefault();
        handleF9Switch();
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [handleSave, handleHesapKapat, handleF9Switch, handleNew]);

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
    <div className="w-100 pb-2" style={{ fontFamily: "Tahoma, 'Segoe UI', Arial, sans-serif", overflowX: "hidden" }}>
      {/* 1. ERP Toolbar */}
      <ERPToolbar
        pageTitle={isDuzeltmeMode ? "F- Cari Emanet Dekont Düzeltme" : "E- Cari Emanet Dekont Kayıt"}
        pageIcon={<IconFileText size={20} />}
        onNew={isDuzeltmeMode ? undefined : handleNew}
        hideNew={isDuzeltmeMode}
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
        modeText={isDuzeltmeMode ? "Düzeltme Modu" : "Yeni Kayıt Modu"}
        centerContent={
          <div className="d-flex align-items-center gap-2">
            <div
              style={{
                border: tip === 0 ? "2px solid #16a34a" : tip === 1 ? "2px solid #dc2626" : "2px solid #2563eb",
                backgroundColor: tip === 0 ? "#f0fdf4" : tip === 1 ? "#fef2f2" : "#eff6ff",
                color: tip === 0 ? "#15803d" : tip === 1 ? "#b91c1c" : "#1d4ed8",
                fontWeight: 800,
                fontSize: "13px",
                letterSpacing: "2px",
                minWidth: "190px",
                padding: "3px 18px",
                borderRadius: "6px",
                height: "28px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                textTransform: "uppercase",
              }}
            >
              {tip === 0 ? "EMANET ALMA" : tip === 1 ? "EMANET VERME" : "DEKONT / VİRMAN"}
            </div>
          </div>
        }
        rightContent={
          <div className="d-flex align-items-center gap-2">
            {cariDekontId && (
              <Badge bg="secondary" className="px-2 py-1 font-monospace">
                {dekontNo || `ID: ${cariDekontId}`}
              </Badge>
            )}
            <div className="d-flex align-items-center gap-2 px-2 py-0.5 bg-white rounded border shadow-2xs small font-monospace" style={{ fontSize: "11px" }}>
              <span className="text-muted" style={{ fontSize: "10.5px" }}>Sol:</span>
              <strong className="text-dark" style={{ fontSize: "11px" }}>{formatNumberDisplay(solBazToplam)}</strong>
              <span className="text-secondary opacity-50">|</span>
              <span className="text-muted" style={{ fontSize: "10.5px" }}>Sağ:</span>
              <strong className="text-dark" style={{ fontSize: "11px" }}>{formatNumberDisplay(sagBazToplam)}</strong>
            </div>
          </div>
        }
      />

      {/* Alert Bildirimi - Sağ altta beliren ve 3.5 sn sonra yok olan toast */}
      {alertInfo && (
        <div className="erp-toast-container">
          <div
            className={`alert alert-${alertInfo.type} erp-toast-item py-2 px-3 mb-0 shadow border-0 d-flex align-items-center justify-content-between`}
            role="alert"
            style={{ minHeight: "36px" }}
          >
            <div className="d-flex align-items-center gap-2 flex-grow-1 overflow-hidden">
              <span style={{ fontSize: "13px" }}>{alertInfo.message}</span>
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
        </div>
      )}

      {/* 2. Dekont Başlık ve Parametre Alanları Kartı (Kompakt ve Dolu Dolu ERP Tasarımı) */}
      <Card className="shadow-xs border border-secondary-subtle rounded-2 mb-2 bg-light">
        <Card.Body className="p-2">
          <Row className="g-2">
            {/* Kolon 1: İşlem Türü, Tarih / Vade, Vezne, Evrak Türü */}
            <Col xs={12} lg={4}>
              <div className="p-2 bg-white rounded border border-secondary-subtle d-flex flex-column shadow-2xs" style={{ gap: "3.5px" }}>
                {/* İşlem Türü */}
                <div className="d-flex align-items-center gap-2">
                  <label className="text-secondary fw-semibold small text-nowrap" style={{ width: "82px", minWidth: "82px", fontSize: "12px" }}>
                    İşlem Türü
                  </label>
                  <Form.Select
                    id="islemTuruSelect"
                    ref={islemTuruRef}
                    autoFocus
                    size="sm"
                    value={tip}
                    onChange={(e) => setTip(Number(e.target.value))}
                    onKeyDown={(e) => handleHeaderKeyDown(e, "islemTuruSelect")}
                    className="fw-bold"
                    style={{
                      height: "26px",
                      fontSize: "12px",
                      color: tip === 0 ? "#15803d" : tip === 1 ? "#dc2626" : "#2563eb",
                    }}
                  >
                    <option value={0}>Emanet alma</option>
                    <option value={1}>Emanet verme</option>
                    <option value={2}>Dekont / Virman</option>
                  </Form.Select>
                </div>

                {/* İşlem Tarihi & Vade */}
                <div className="d-flex align-items-center gap-2">
                  <label className="text-secondary fw-semibold small text-nowrap" style={{ width: "82px", minWidth: "82px", fontSize: "12px" }}>
                    Tarih / Vade
                  </label>
                  <div className="d-flex align-items-center gap-1 flex-grow-1" style={{ minWidth: 0 }}>
                    <Form.Control
                      id="tarihInput"
                      type="date"
                      size="sm"
                      value={tarih}
                      onChange={(e) => setTarih(e.target.value)}
                      onKeyDown={(e) => handleHeaderKeyDown(e, "tarihInput")}
                      disabled={!tarihYetkisi}
                      title={tarihYetkisi ? "İşlem Tarihi" : "Tarih değiştirme yetkiniz yok"}
                      className="font-monospace px-1.5"
                      style={{ height: "26px", fontSize: "12px" }}
                    />
                    <Form.Control
                      id="vadeInput"
                      type="date"
                      size="sm"
                      value={vade}
                      onChange={(e) => setVade(e.target.value)}
                      onKeyDown={(e) => handleHeaderKeyDown(e, "vadeInput")}
                      title="Vade Tarihi"
                      className="font-monospace px-1.5"
                      style={{ height: "26px", fontSize: "12px" }}
                    />
                  </div>
                </div>

                {/* Vezne */}
                <div className="d-flex align-items-center gap-2">
                  <label className="text-secondary fw-semibold small text-nowrap" style={{ width: "82px", minWidth: "82px", fontSize: "12px" }}>
                    Vezne
                  </label>
                  <InputGroup size="sm" style={{ height: "26px" }}>
                    <Form.Control
                      value={vezneAd ? `${vezneKod} - ${vezneAd}` : (vezneKod || "Ana Vezne")}
                      readOnly
                      className="bg-light text-secondary fw-semibold"
                      style={{ height: "26px", fontSize: "12px" }}
                      title="Vezne"
                    />
                    <Button
                      variant="outline-secondary"
                      onClick={() => setShowVezneLookup(true)}
                      title="Vezne Seç"
                      className="d-flex align-items-center justify-content-center px-2 bg-light border-start-0"
                      style={{ borderColor: "#ced4da", height: "26px" }}
                    >
                      <IconBinoculars size={14} />
                    </Button>
                  </InputGroup>
                </div>

                {/* Evrak Türü */}
                <div className="d-flex align-items-center gap-2">
                  <label className="text-secondary fw-semibold small text-nowrap" style={{ width: "82px", minWidth: "82px", fontSize: "12px" }}>
                    Evrak Türü
                  </label>
                  <Form.Select
                    id="evrakTuruSelect"
                    size="sm"
                    value={evrakTuru}
                    onChange={(e) => setEvrakTuru(Number(e.target.value))}
                    onKeyDown={(e) => handleHeaderKeyDown(e, "evrakTuruSelect")}
                    style={{ height: "26px", fontSize: "12px" }}
                  >
                    <option value={0}>0 - Cari Dekont</option>
                    <option value={1}>1 - Dönüşüm / Fiş</option>
                  </Form.Select>
                </div>
              </div>
            </Col>

            {/* Kolon 2: Cari Seçimi, 2. Cari (Dekont ise), Telefon / Mutabakat, Teslim Alan */}
            <Col xs={12} lg={4}>
              <div className="p-2 bg-white rounded border border-secondary-subtle d-flex flex-column shadow-2xs" style={{ gap: "3.5px" }}>
                {/* 1. Cari (Çıkış) / Cari Kodu/Adı */}
                <div className="d-flex align-items-center gap-2 position-relative">
                  <label className="text-secondary fw-semibold small text-nowrap" style={{ width: "85px", minWidth: "85px", fontSize: "12px" }}>
                    {tip === 2 ? "1. Cari (Çıkış)" : "Cari Kod/Ad"}
                  </label>
                  <div className="flex-grow-1 position-relative" style={{ minWidth: 0 }}>
                    <InputGroup size="sm" style={{ height: "26px" }}>
                      <Form.Control
                        id="cariKodAdInput"
                        value={cariInputText || (cariKod ? (cariAd ? `${cariKod} - ${cariAd}` : cariKod) : "")}
                        onChange={(e) => handleCariInputChange(e.target.value)}
                        onKeyDown={(e) => {
                          handleHeaderKeyDown(e, "cariKodAdInput");
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const term = (cariInputText || cariKod || "").trim().toLowerCase();
                            if (!term) {
                              if (tip === 2 && document.getElementById("cari2Input")) {
                                focusElement("cari2Input");
                              } else {
                                focusElement("cariTelefonInput") || focusElement("teslimAlanInput");
                              }
                              return;
                            }
                            const exact = cariList.find(
                              (c) =>
                                (c.kod && c.kod.toLowerCase() === term) ||
                                (c.ad && c.ad.toLowerCase() === term) ||
                                `${(c.kod || "").toLowerCase()} - ${(c.ad || "").toLowerCase()}` === term
                            );
                            if (exact) {
                              handleSelectCari(exact);
                              return;
                            }
                            const matches = cariList.filter(
                              (c) =>
                                (c.kod && c.kod.toLowerCase().includes(term)) ||
                                (c.ad && c.ad.toLowerCase().includes(term))
                            );
                            if (matches.length === 1) {
                              handleSelectCari(matches[0]);
                              return;
                            }
                            setShowCariLookupTarget("cari1");
                          }
                        }}
                        className={cariKartId ? "bg-white fw-bold text-dark" : "bg-white"}
                        style={{ height: "26px", fontSize: "12px" }}
                      />
                      <Button
                        variant="outline-secondary"
                        onClick={() => setShowCariLookupTarget("cari1")}
                        title="Cari Hesap Listesi"
                        className="d-flex align-items-center justify-content-center px-2 bg-light border-start-0"
                        style={{ borderColor: "#ced4da", height: "26px" }}
                      >
                        <IconBinoculars size={14} />
                      </Button>
                    </InputGroup>
                  </div>
                </div>

                {/* Eğer tip === 2 (Dekont / Virman) ise 2. Cari göster */}
                {tip === 2 && (
                  <div className="d-flex align-items-center gap-2">
                    <label className="text-secondary fw-semibold small text-nowrap" style={{ width: "85px", minWidth: "85px", fontSize: "12px" }}>
                      2. Cari (Giriş)
                    </label>
                    <InputGroup size="sm" style={{ height: "26px" }}>
                      <Form.Control
                        id="cari2Input"
                        value={cari2Kod ? (cari2Ad ? `${cari2Kod} - ${cari2Ad}` : cari2Kod) : ""}
                        onChange={(e) => setCari2Kod(e.target.value)}
                        onKeyDown={(e) => {
                          handleHeaderKeyDown(e, "cari2Input");
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const term = (cari2Kod || "").trim().toLowerCase();
                            if (!term) {
                              focusElement("cariTelefonInput") || focusElement("teslimAlanInput");
                              return;
                            }
                            const exact = cariList.find(
                              (c) =>
                                (c.kod && c.kod.toLowerCase() === term) ||
                                (c.ad && c.ad.toLowerCase() === term)
                            );
                            if (exact) {
                              setCari2KartId(exact.id);
                              setCari2Kod(exact.kod);
                              setCari2Ad(exact.ad);
                              setCari2Telefon(exact.telefon || "");
                              setTimeout(() => {
                                const telEl = document.getElementById("cariTelefonInput");
                                if (telEl) {
                                  telEl.focus();
                                  (telEl as HTMLInputElement).select?.();
                                } else {
                                  const teslimEl = document.getElementById("teslimAlanInput");
                                  teslimEl?.focus();
                                }
                              }, 60);
                              return;
                            }
                            const matches = cariList.filter(
                              (c) =>
                                (c.kod && c.kod.toLowerCase().includes(term)) ||
                                (c.ad && c.ad.toLowerCase().includes(term))
                            );
                            if (matches.length === 1) {
                              setCari2KartId(matches[0].id);
                              setCari2Kod(matches[0].kod);
                              setCari2Ad(matches[0].ad);
                              setCari2Telefon(matches[0].telefon || "");
                              setTimeout(() => {
                                const telEl = document.getElementById("cariTelefonInput");
                                if (telEl) {
                                  telEl.focus();
                                  (telEl as HTMLInputElement).select?.();
                                } else {
                                  const teslimEl = document.getElementById("teslimAlanInput");
                                  teslimEl?.focus();
                                }
                              }, 60);
                              return;
                            }
                            setShowCariLookupTarget("cari2");
                          }
                        }}
                        className={cari2KartId ? "bg-white fw-bold text-dark" : "bg-white"}
                        style={{ height: "26px", fontSize: "12px" }}
                      />
                      <Button
                        variant="outline-secondary"
                        onClick={() => setShowCariLookupTarget("cari2")}
                        title="2. Cari Listesi"
                        className="d-flex align-items-center justify-content-center px-2 bg-light border-start-0"
                        style={{ borderColor: "#ced4da", height: "26px" }}
                      >
                        <IconBinoculars size={14} />
                      </Button>
                    </InputGroup>
                  </div>
                )}

                {/* Telefon & Mutabakat Türü */}
                <div className="d-flex align-items-center gap-2">
                  <label className="text-secondary fw-semibold small text-nowrap" style={{ width: "85px", minWidth: "85px", fontSize: "12px" }}>
                    Tel / Mutabakat
                  </label>
                  <div className="d-flex align-items-center gap-1 flex-grow-1" style={{ minWidth: 0 }}>
                    <Form.Control
                      id="cariTelefonInput"
                      size="sm"
                      value={cariTelefon}
                      onChange={(e) => setCariTelefon(e.target.value)}
                      onKeyDown={(e) => {
                        handleHeaderKeyDown(e, "cariTelefonInput");
                        if (e.key === "Enter") {
                          e.preventDefault();
                          focusElement("mutabakatSelect") || focusElement("teslimAlanInput");
                        }
                      }}
                      className="bg-white font-monospace"
                      style={{ height: "26px", fontSize: "12px", width: "115px", flexShrink: 0 }}
                    />
                    <Form.Select
                      id="mutabakatSelect"
                      size="sm"
                      value={mutabakatTuru}
                      onChange={(e) => handleMutabakatTuruChange(e.target.value as MutabakatType)}
                      onKeyDown={(e) => {
                        handleHeaderKeyDown(e, "mutabakatSelect");
                        if (e.key === "Enter") {
                          e.preventDefault();
                          focusElement("teslimAlanInput");
                        }
                      }}
                      style={{ height: "26px", fontSize: "12px" }}
                      title="Mutabakat Türü"
                    >
                      <option value="capraz">Çapraz kur</option>
                      <option value="has">Has</option>
                      <option value="kur">Ana Para / TL</option>
                    </Form.Select>
                  </div>
                </div>

                {/* Teslim Alan */}
                <div className="d-flex align-items-center gap-2">
                  <label className="text-secondary fw-semibold small text-nowrap" style={{ width: "85px", minWidth: "85px", fontSize: "12px" }}>
                    Teslim Alan
                  </label>
                  <Form.Control
                    id="teslimAlanInput"
                    size="sm"
                    maxLength={50}
                    value={teslimAlan}
                    onChange={(e) => setTeslimAlan(e.target.value)}
                    onKeyDown={(e) => {
                      handleHeaderKeyDown(e, "teslimAlanInput");
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const firstCell = document.getElementById("grid-input-sol-0-smb") as HTMLInputElement | null;
                        firstCell?.focus();
                        firstCell?.select();
                      }
                    }}
                    style={{ height: "26px", fontSize: "12px" }}
                  />
                </div>
              </div>
            </Col>

            {/* Kolon 3: Dekont No, Durum & İptal Tarihi, Önceki Belge, Açıklama */}
            <Col xs={12} lg={4}>
              <div className="p-2 bg-white rounded border border-secondary-subtle d-flex flex-column shadow-2xs" style={{ gap: "3.5px" }}>
                {/* Dekont No (Yalnızca Düzeltme modunda Dürbün ikonu bulunur) */}
                <div className="d-flex align-items-center gap-2">
                  <label className="text-secondary fw-semibold small text-nowrap" style={{ width: "85px", minWidth: "85px", fontSize: "12px" }}>
                    Dekont No
                  </label>
                  {isDuzeltmeMode ? (
                    <InputGroup size="sm" style={{ height: "26px" }}>
                      <Form.Control
                        id="dekontNoInput"
                        value={dekontNo}
                        onChange={(e) => setDekontNo(e.target.value)}
                        onKeyDown={(e) => handleHeaderKeyDown(e, "dekontNoInput")}
                        placeholder="Otomatik"
                        className="font-monospace fw-bold text-primary"
                        style={{ height: "26px", fontSize: "12px" }}
                      />
                      <Button
                        variant="outline-secondary"
                        onClick={() => setShowDekontSearchModal(true)}
                        title="Dekont Ara (Dürbün)"
                        className="d-flex align-items-center justify-content-center px-2 bg-light border-start-0"
                        style={{ borderColor: "#ced4da", height: "26px" }}
                      >
                        <IconBinoculars size={14} />
                      </Button>
                    </InputGroup>
                  ) : (
                    <Form.Control
                      id="dekontNoInput"
                      value={dekontNo}
                      onChange={(e) => setDekontNo(e.target.value)}
                      onKeyDown={(e) => handleHeaderKeyDown(e, "dekontNoInput")}
                      placeholder="Otomatik"
                      className="font-monospace fw-bold text-primary"
                      style={{ height: "26px", fontSize: "12px" }}
                    />
                  )}
                </div>

                {/* Satır Durumu & İptal Tarihi */}
                <div className="d-flex align-items-center gap-2">
                  <label className="text-secondary fw-semibold small text-nowrap" style={{ width: "85px", minWidth: "85px", fontSize: "12px" }}>
                    Durum
                  </label>
                  <div className="d-flex align-items-center gap-1 flex-grow-1" style={{ minWidth: 0 }}>
                    <Form.Select
                      id="durumSelect"
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
                      onKeyDown={(e) => handleHeaderKeyDown(e, "durumSelect")}
                      style={{
                        height: "26px",
                        fontSize: "12px",
                        color: satirDurumu === 1 ? "#dc2626" : satirDurumu === 2 ? "#d97706" : "#16a34a",
                        fontWeight: 600,
                      }}
                    >
                      <option value={0}>0 - Normal (Aktif)</option>
                      <option value={1}>1 - İptal Edildi</option>
                      <option value={2}>2 - Beklemede</option>
                    </Form.Select>
                    {satirDurumu === 1 && (
                      <Form.Control
                        id="iptalTarihiInput"
                        type="date"
                        size="sm"
                        value={iptalTarihi}
                        onChange={(e) => setIptalTarihi(e.target.value)}
                        onKeyDown={(e) => handleHeaderKeyDown(e, "iptalTarihiInput")}
                        title="İptal Tarihi"
                        className="font-monospace border-danger px-1"
                        style={{ height: "26px", fontSize: "12px", width: "120px", flexShrink: 0 }}
                      />
                    )}
                  </div>
                </div>

                {/* Önceki Belge */}
                <div className="d-flex align-items-center gap-2">
                  <label className="text-secondary fw-semibold small text-nowrap" style={{ width: "85px", minWidth: "85px", fontSize: "12px" }} title="Dönüşen önceki dekont / fiş kaydı">
                    Önceki Belge
                  </label>
                  <InputGroup size="sm" style={{ height: "26px" }}>
                    <Form.Control
                      id="oncekiBelgeInput"
                      type="text"
                      value={oncekiInputText}
                      onChange={(e) => handleOncekiInputChange(e.target.value)}
                      onKeyDown={(e) => {
                        handleHeaderKeyDown(e, "oncekiBelgeInput");
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const term = (oncekiInputText || "").trim().toLowerCase();
                          if (!term) {
                            focusElement("aciklamaInput");
                            return;
                          }
                          const exact = savedDekonts.find(
                            (d) =>
                              (d.dekontNo && d.dekontNo.toLowerCase() === term) ||
                              String(d.cariDekontId) === term
                          );
                          if (exact) {
                            handleSelectOncekiDekont(exact);
                            return;
                          }
                          const matches = savedDekonts.filter(
                            (d) =>
                              (d.dekontNo && d.dekontNo.toLowerCase().includes(term)) ||
                              (d.cariKod && d.cariKod.toLowerCase().includes(term)) ||
                              (d.cariAd && d.cariAd.toLowerCase().includes(term))
                          );
                          if (matches.length === 1) {
                            handleSelectOncekiDekont(matches[0]);
                            return;
                          }
                          setShowOncekiLookupModal(true);
                        }
                      }}
                      className={oncekiId ? "font-monospace fw-bold text-dark" : "font-monospace"}
                      style={{ height: "26px", fontSize: "12px" }}
                    />
                    <Button
                      variant="outline-secondary"
                      onClick={() => setShowOncekiLookupModal(true)}
                      title="Önceki Dekont Listesi"
                      className="d-flex align-items-center justify-content-center px-2 bg-light border-start-0"
                      style={{ borderColor: "#ced4da", height: "26px" }}
                    >
                      <IconBinoculars size={14} />
                    </Button>
                  </InputGroup>
                </div>

                {/* Açıklama */}
                <div className="d-flex align-items-center gap-2">
                  <label className="text-secondary fw-semibold small text-nowrap" style={{ width: "85px", minWidth: "85px", fontSize: "12px" }}>
                    Açıklama
                  </label>
                  <Form.Control
                    id="aciklamaInput"
                    size="sm"
                    maxLength={100}
                    value={aciklama}
                    onChange={(e) => setAciklama(e.target.value)}
                    onKeyDown={(e) => {
                      handleHeaderKeyDown(e, "aciklamaInput");
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const firstCell = document.getElementById("grid-input-sol-0-smb") as HTMLInputElement | null;
                        firstCell?.focus();
                        firstCell?.select();
                      }
                    }}
                    style={{ height: "26px", fontSize: "12px" }}
                  />
                </div>
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* 3. Ana Bölüm: Çift Taraflı Grid Bölümü (Sol Panel ve Sağ Panel) */}
      <div className="w-100 bg-transparent">
        <Row className="g-2 mt-0">
          {/* ===================== SOL PANEL ===================== */}
          <Col xs={12} lg={6}>
            <div
              className="p-2 bg-white h-100 d-flex flex-column justify-content-between rounded border shadow-2xs"
              style={{
                borderColor: "#94a3b8",
                borderWidth: "1.5px",
              }}
            >
              {/* Üst Şerit: Başlık Ribbon + Kod & Ad Tek Satırda */}
              <div className="mb-1.5 rounded overflow-hidden border" style={{ borderColor: "#cbd5e1" }}>
                {/* Pembe / Normal Başlık Şeridi */}
                <div
                  className="w-100 text-center fw-bold text-nowrap text-uppercase"
                  style={{
                    height: "25px",
                    lineHeight: "25px",
                    fontSize: "12px",
                    backgroundColor: panelRoles.sol.isPink ? "#ff66cc" : "#e2e8f0",
                    color: "#000000",
                    letterSpacing: "0.8px",
                    borderBottom: "1px solid #cbd5e1",
                  }}
                >
                  {panelRoles.sol.title}
                </div>

                {/* Kod ve Ad Alanları (Tek satırda, yan yana) */}
                <div className="d-flex align-items-center gap-2 p-1.5 bg-light">
                  <div className="d-flex align-items-center gap-1" style={{ minWidth: "150px", maxWidth: "180px" }}>
                    <span className="small fw-semibold text-secondary" style={{ fontSize: "11.5px" }}>Kod:</span>
                    <InputGroup size="sm" style={{ height: "24px" }}>
                      <Form.Control
                        id="solPanelKodInput"
                        value={panelRoles.sol.kod}
                        onChange={(e) => {
                          if (!panelRoles.sol.isVezne) setCariKod(e.target.value);
                        }}
                        onKeyDown={(e) => handleHeaderKeyDown(e, "solPanelKodInput")}
                        readOnly={panelRoles.sol.isVezne}
                        style={{
                          height: "24px",
                          fontSize: "11.5px",
                          padding: "0 6px",
                          backgroundColor: panelRoles.sol.isVezne ? "#f8fafc" : "#ffffff",
                        }}
                      />
                      <Button
                        variant="light"
                        className="p-0 px-1 border border-start-0 d-flex align-items-center justify-content-center"
                        style={{ height: "24px" }}
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

                  <div className="d-flex align-items-center gap-1 flex-grow-1">
                    <span className="small fw-semibold text-secondary" style={{ fontSize: "11.5px" }}>Ad:</span>
                    <InputGroup size="sm" style={{ height: "24px" }}>
                      <Form.Control
                        id="solPanelAdInput"
                        value={panelRoles.sol.ad}
                        onChange={(e) => {
                          if (!panelRoles.sol.isVezne) setCariAd(e.target.value);
                        }}
                        onKeyDown={(e) => handleHeaderKeyDown(e, "solPanelAdInput")}
                        readOnly={panelRoles.sol.isVezne}
                        style={{
                          height: "24px",
                          fontSize: "11.5px",
                          padding: "0 6px",
                          backgroundColor: panelRoles.sol.isVezne ? "#f8fafc" : "#ffffff",
                        }}
                      />
                      <Button
                        variant="light"
                        className="p-0 px-1 border border-start-0 d-flex align-items-center justify-content-center"
                        style={{ height: "24px" }}
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
              </div>

              {/* Tablo Konteyneri */}
              <div
                style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: "4px",
                  overflow: "hidden",
                  backgroundColor: "#ffffff",
                }}
              >
                <div
                  style={{
                    minHeight: "100px",
                    maxHeight: "350px",
                    overflowY: "auto",
                  }}
                >
                  <table
                    className="w-100"
                    data-table-type="sol"
                    style={{
                      borderCollapse: "collapse",
                      fontSize: "12px",
                      color: "#000000",
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          backgroundColor: "#dbeafe",
                          height: "25px",
                          color: "#1e3a8a",
                          textAlign: "center",
                          position: "sticky",
                          top: 0,
                          zIndex: 1,
                          borderBottom: "1px solid #93c5fd",
                          fontWeight: 700,
                        }}
                      >
                        <th style={{ width: "95px", padding: "2px 4px", borderRight: "1px solid #bfdbfe" }}>SMB</th>
                        <th style={{ width: "140px", padding: "2px 6px", borderRight: "1px solid #bfdbfe" }}>Miktar</th>
                        <th style={{ padding: "2px 6px" }}>{col3Header}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {solSatirlar.map((row, idx) => (
                        <tr
                          key={row.id}
                          data-row-id={row.id}
                          data-table-type="sol"
                          style={{
                            height: "25px",
                            borderBottom: "1px solid #e2e8f0",
                            backgroundColor: idx === selectedSolIndex && activeSide === "sol" ? "#eff6ff" : idx === selectedSolIndex ? "#f8fafc" : "#ffffff",
                          }}
                          onClick={() => {
                            setSelectedSolIndex(idx);
                            setActiveSide("sol");
                            setActiveRowIndex(idx);
                          }}
                        >
                          {/* 1. SMB */}
                          <td style={{ padding: 0, borderRight: "1px solid #e2e8f0" }}>
                            <div className="d-flex align-items-center">
                              <input
                                id={`grid-input-sol-${idx}-smb`}
                                type="text"
                                value={row.paraKodu || ""}
                                onChange={(e) => {
                                  const val = e.target.value.toUpperCase();
                                  handleGridChange("sol", idx, "paraKodu", val);
                                }}
                                onFocus={() => {
                                  setActiveSide("sol");
                                  setActiveRowIndex(idx);
                                  setSelectedSolIndex(idx);
                                  setActiveField("smb");
                                }}
                                onKeyDown={(e) => handleCellKeyDown(e, "sol", idx, "smb")}
                                style={{
                                  width: "100%",
                                  height: "24px",
                                  border: "none",
                                  outline: "none",
                                  padding: "0 4px",
                                  fontSize: "12px",
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
                          <td
                            style={{
                              padding: 0,
                              borderRight: "1px solid #e2e8f0",
                              backgroundColor: row.paraKodu && (!row.meblag || Number(row.meblag) <= 0) ? "#fef2f2" : "transparent",
                            }}
                          >
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
                                height: "24px",
                                border:
                                  row.paraKodu && (!row.meblag || Number(row.meblag) <= 0)
                                    ? "1.5px solid #dc2626"
                                    : "none",
                                borderRadius: row.paraKodu && (!row.meblag || Number(row.meblag) <= 0) ? "2px" : "0",
                                outline: "none",
                                padding: "0 6px",
                                fontSize: "12px",
                                textAlign: "right",
                                fontWeight: 600,
                                color:
                                  row.paraKodu && (!row.meblag || Number(row.meblag) <= 0)
                                    ? "#b91c1c"
                                    : "#0f172a",
                                backgroundColor:
                                  row.paraKodu && (!row.meblag || Number(row.meblag) <= 0)
                                    ? "#fef2f2"
                                    : "transparent",
                                boxShadow:
                                  row.paraKodu && (!row.meblag || Number(row.meblag) <= 0)
                                    ? "inset 0 0 0 1px #dc2626"
                                    : "none",
                              }}
                            />
                          </td>

                          {/* 3. Çapraz kur / Has / Kur */}
                          <td style={{ padding: 0, borderRight: "1px solid #e2e8f0" }}>
                            <input
                              id={`grid-input-sol-${idx}-kur`}
                              type="text"
                              inputMode="decimal"
                              readOnly={mutabakatTuru !== "has" && !kurAcik}
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
                                height: "24px",
                                border: "none",
                                outline: "none",
                                padding: "0 6px",
                                fontSize: "12px",
                                textAlign: "right",
                                fontWeight: 500,
                                color: "#0f172a",
                                backgroundColor: "transparent",
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Dip Toplam */}
              <div className="d-flex align-items-center justify-content-between mt-1.5 pt-1.5 border-top">
                <span className="small text-muted" style={{ fontSize: "11px" }}>
                  {solSatirlar.filter((r) => r.paraKodu || r.meblag).length} kalem
                </span>
                <div className="d-flex align-items-center gap-2">
                  <span className="fw-semibold text-dark" style={{ fontSize: "12px" }}>
                    {dipToplamLabel}:
                  </span>
                  <span
                    className="fw-bold font-monospace text-primary px-2.5 py-0.5 border rounded bg-light"
                    style={{ fontSize: "13px", minWidth: "110px", textAlign: "right" }}
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
              className="p-2 bg-white h-100 d-flex flex-column justify-content-between rounded border shadow-2xs"
              style={{
                borderColor: "#94a3b8",
                borderWidth: "1.5px",
              }}
            >
              {/* Üst Şerit: Başlık Ribbon + Kod & Ad Tek Satırda */}
              <div className="mb-1.5 rounded overflow-hidden border" style={{ borderColor: "#cbd5e1" }}>
                {/* Pembe / Normal Başlık Şeridi */}
                <div
                  className="w-100 text-center fw-bold text-nowrap text-uppercase"
                  style={{
                    height: "25px",
                    lineHeight: "25px",
                    fontSize: "12px",
                    backgroundColor: panelRoles.sag.isPink ? "#ff66cc" : "#e2e8f0",
                    color: "#000000",
                    letterSpacing: "0.8px",
                    borderBottom: "1px solid #cbd5e1",
                  }}
                >
                  {panelRoles.sag.title}
                </div>

                {/* Kod ve Ad Alanları (Tek satırda, yan yana) */}
                <div className="d-flex align-items-center gap-2 p-1.5 bg-light">
                  <div className="d-flex align-items-center gap-1" style={{ minWidth: "150px", maxWidth: "180px" }}>
                    <span className="small fw-semibold text-secondary" style={{ fontSize: "11.5px" }}>Kod:</span>
                    <InputGroup size="sm" style={{ height: "24px" }}>
                      <Form.Control
                        id="sagPanelKodInput"
                        value={panelRoles.sag.kod}
                        onChange={(e) => {
                          if (panelRoles.sag.cariTarget === "cari1") setCariKod(e.target.value);
                          else if (panelRoles.sag.cariTarget === "cari2") setCari2Kod(e.target.value);
                        }}
                        onKeyDown={(e) => handleHeaderKeyDown(e, "sagPanelKodInput")}
                        readOnly={panelRoles.sag.isVezne}
                        style={{
                          height: "24px",
                          fontSize: "11.5px",
                          padding: "0 6px",
                          backgroundColor: panelRoles.sag.isVezne ? "#f8fafc" : "#ffffff",
                        }}
                      />
                      <Button
                        variant="light"
                        className="p-0 px-1 border border-start-0 d-flex align-items-center justify-content-center"
                        style={{ height: "24px" }}
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

                  <div className="d-flex align-items-center gap-1 flex-grow-1">
                    <span className="small fw-semibold text-secondary" style={{ fontSize: "11.5px" }}>Ad:</span>
                    <InputGroup size="sm" style={{ height: "24px" }}>
                      <Form.Control
                        id="sagPanelAdInput"
                        value={panelRoles.sag.ad}
                        onChange={(e) => {
                          if (panelRoles.sag.cariTarget === "cari1") setCariAd(e.target.value);
                          else if (panelRoles.sag.cariTarget === "cari2") setCari2Ad(e.target.value);
                        }}
                        onKeyDown={(e) => handleHeaderKeyDown(e, "sagPanelAdInput")}
                        readOnly={panelRoles.sag.isVezne}
                        style={{
                          height: "24px",
                          fontSize: "11.5px",
                          padding: "0 6px",
                          backgroundColor: panelRoles.sag.isVezne ? "#f8fafc" : "#ffffff",
                        }}
                      />
                      <Button
                        variant="light"
                        className="p-0 px-1 border border-start-0 d-flex align-items-center justify-content-center"
                        style={{ height: "24px" }}
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
              </div>

              {/* Tablo Konteyneri */}
              <div
                style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: "4px",
                  overflow: "hidden",
                  backgroundColor: "#ffffff",
                }}
              >
                <div
                  style={{
                    minHeight: "100px",
                    maxHeight: "350px",
                    overflowY: "auto",
                  }}
                >
                  <table
                    className="w-100"
                    data-table-type="sag"
                    style={{
                      borderCollapse: "collapse",
                      fontSize: "12px",
                      color: "#000000",
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          backgroundColor: "#dbeafe",
                          height: "25px",
                          color: "#1e3a8a",
                          textAlign: "center",
                          position: "sticky",
                          top: 0,
                          zIndex: 1,
                          borderBottom: "1px solid #93c5fd",
                          fontWeight: 700,
                        }}
                      >
                        <th style={{ width: "95px", padding: "2px 4px", borderRight: "1px solid #bfdbfe" }}>SMB</th>
                        <th style={{ width: "140px", padding: "2px 6px", borderRight: "1px solid #bfdbfe" }}>Miktar</th>
                        <th style={{ padding: "2px 6px" }}>{col3Header}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sagSatirlar.map((row, idx) => (
                        <tr
                          key={row.id}
                          data-row-id={row.id}
                          data-table-type="sag"
                          style={{
                            height: "25px",
                            borderBottom: "1px solid #e2e8f0",
                            backgroundColor: idx === selectedSagIndex && activeSide === "sag" ? "#eff6ff" : idx === selectedSagIndex ? "#f8fafc" : "#ffffff",
                          }}
                          onClick={() => {
                            setSelectedSagIndex(idx);
                            setActiveSide("sag");
                            setActiveRowIndex(idx);
                          }}
                        >
                          {/* 1. SMB */}
                          <td style={{ padding: 0, borderRight: "1px solid #e2e8f0" }}>
                            <div className="d-flex align-items-center">
                              <input
                                id={`grid-input-sag-${idx}-smb`}
                                type="text"
                                value={row.paraKodu || ""}
                                onChange={(e) => {
                                  const val = e.target.value.toUpperCase();
                                  handleGridChange("sag", idx, "paraKodu", val);
                                }}
                                onFocus={() => {
                                  setActiveSide("sag");
                                  setActiveRowIndex(idx);
                                  setSelectedSagIndex(idx);
                                  setActiveField("smb");
                                }}
                                onKeyDown={(e) => handleCellKeyDown(e, "sag", idx, "smb")}
                                style={{
                                  width: "100%",
                                  height: "24px",
                                  border: "none",
                                  outline: "none",
                                  padding: "0 4px",
                                  fontSize: "12px",
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
                          <td
                            style={{
                              padding: 0,
                              borderRight: "1px solid #e2e8f0",
                              backgroundColor: row.paraKodu && (!row.meblag || Number(row.meblag) <= 0) ? "#fef2f2" : "transparent",
                            }}
                          >
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
                                height: "24px",
                                border:
                                  row.paraKodu && (!row.meblag || Number(row.meblag) <= 0)
                                    ? "1.5px solid #dc2626"
                                    : "none",
                                borderRadius: row.paraKodu && (!row.meblag || Number(row.meblag) <= 0) ? "2px" : "0",
                                outline: "none",
                                padding: "0 6px",
                                fontSize: "12px",
                                textAlign: "right",
                                fontWeight: 600,
                                color:
                                  row.paraKodu && (!row.meblag || Number(row.meblag) <= 0)
                                    ? "#b91c1c"
                                    : "#0f172a",
                                backgroundColor:
                                  row.paraKodu && (!row.meblag || Number(row.meblag) <= 0)
                                    ? "#fef2f2"
                                    : "transparent",
                                boxShadow:
                                  row.paraKodu && (!row.meblag || Number(row.meblag) <= 0)
                                    ? "inset 0 0 0 1px #dc2626"
                                    : "none",
                              }}
                            />
                          </td>

                          {/* 3. Çapraz kur / Has / Kur */}
                          <td style={{ padding: 0, borderRight: "1px solid #e2e8f0" }}>
                            <input
                              id={`grid-input-sag-${idx}-kur`}
                              type="text"
                              inputMode="decimal"
                              readOnly={mutabakatTuru !== "has" && !kurAcik}
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
                                height: "24px",
                                border: "none",
                                outline: "none",
                                padding: "0 6px",
                                fontSize: "12px",
                                textAlign: "right",
                                fontWeight: 500,
                                color: "#0f172a",
                                backgroundColor: "transparent",
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Dip Toplam */}
              <div className="d-flex align-items-center justify-content-between mt-1.5 pt-1.5 border-top">
                <span className="small text-muted" style={{ fontSize: "11px" }}>
                  {sagSatirlar.filter((r) => r.paraKodu || r.meblag).length} kalem
                </span>
                <div className="d-flex align-items-center gap-2">
                  <span className="fw-semibold text-dark" style={{ fontSize: "12px" }}>
                    {dipToplamLabel}:
                  </span>
                  <span
                    className="fw-bold font-monospace text-primary px-2.5 py-0.5 border rounded bg-light"
                    style={{ fontSize: "13px", minWidth: "110px", textAlign: "right" }}
                  >
                    {formatNumberDisplay(sagBazToplam)}
                  </span>
                </div>
              </div>
            </div>
          </Col>
        </Row>

        {/* 4. Alt Kısım: Ref No & Bakiye Farkı / Denge Kontrolü */}
        <div className="d-flex align-items-center justify-content-between mt-2 pt-1.5 border-top bg-white p-2 rounded border">
          <div className="d-flex align-items-center gap-2">
            <span className="small fw-semibold text-secondary" style={{ fontSize: "12px" }}>
              Ref No:
            </span>
            <Form.Control
              size="sm"
              value={refNo}
              onChange={(e) => setRefNo(e.target.value)}
              style={{
                height: "26px",
                width: "160px",
                fontSize: "12px",
              }}
            />
          </div>

          <div className="d-flex align-items-center gap-2">
            {(solBazToplam > 0 || sagBazToplam > 0) && (
              Math.abs(solBazToplam - sagBazToplam) < 0.005 ? (
                <span className="badge bg-success-subtle text-success border border-success-subtle px-2.5 py-1 fw-bold font-monospace" style={{ fontSize: "11.5px" }}>
                  ✓ DENGEDE (Fark: 0.00)
                </span>
              ) : (
                <span className="badge bg-danger-subtle text-danger border border-danger-subtle px-2.5 py-1 fw-bold font-monospace" style={{ fontSize: "11.5px" }}>
                  Fark: {formatNumberDisplay(Math.abs(solBazToplam - sagBazToplam))}
                </span>
              )
            )}
          </div>

          <div className="text-muted small" style={{ fontSize: "11.5px" }}>
            Kaydetmek için üst araç çubuğundaki <IconDeviceFloppy size={14} className="align-text-bottom text-primary" /> simgesini veya <strong>F1</strong> tuşunu kullanabilirsiniz.
          </div>
        </div>

        {/* 5. Alt Cyan Durum Çubuğu (Kısayol Tuşları) */}
        <div
          className="w-100 text-center text-nowrap fw-semibold mt-1.5 px-2"
          style={{
            height: "24px",
            lineHeight: "24px",
            backgroundColor: "#d5f3fe",
            color: "#0369a1",
            fontSize: "11.5px",
            borderRadius: "4px",
            border: "1px solid #bae6fd",
            userSelect: "none",
          }}
        >
          <span className="me-3 cursor-pointer" onClick={handleSave} style={{ cursor: "pointer" }}>
            <strong>F1)</strong> Kayıt
          </span>
          {kYetki.cariBakiye && (
            <span className="me-3 cursor-pointer" onClick={() => setShowBakiyeModal(true)} style={{ cursor: "pointer" }}>
              <strong>F5)</strong> Bakiye
            </span>
          )}
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
          <span className="me-3">
            <strong>F10)</strong> Kes
          </span>
          {!isDuzeltmeMode && (
            <span
              className="cursor-pointer text-success fw-bold"
              onClick={handleNew}
              style={{ cursor: "pointer" }}
              title="Yeni Kayıt (Ctrl+N)"
            >
              <strong>Ctrl+N)</strong> Yeni Kayıt
            </span>
          )}
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
        initialSearchTerm={showCariLookupTarget === "cari2" ? (cari2Kod || "") : (cariInputText || cariKod || "")}
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
            setTimeout(() => {
              const teslimEl = document.getElementById("teslimAlanInput");
              teslimEl?.focus();
            }, 60);
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
        initialSearchTerm={oncekiInputText || ""}
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
        initialSearchTerm={showParaLookupTarget ? ((showParaLookupTarget.side === "sol" ? solSatirlar[showParaLookupTarget.index]?.paraKodu : sagSatirlar[showParaLookupTarget.index]?.paraKodu) || "") : ""}
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


    </div>
  );
};

export default CariEmanetDekontPage;
