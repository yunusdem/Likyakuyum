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
  ButtonGroup,
} from "react-bootstrap";
import {
  IconFileText,
  IconShieldLock,
  IconUser,
  IconCoins,
  IconBinoculars,
  IconArrowRight,
  IconPlus,
  IconTrash,
  IconGripVertical,
} from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import LookupModal from "../../components/common/LookupModal";
import { CariService, CariKartItem } from "../../services/cariService";
import { apiClient } from "../../services/apiClient";
import {
  CariDekontService,
  CariDekontModel,
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
  kur: number | string; // Tahmini rayiç fiyatı / kur
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
  const [tip, setTip] = useState<number>(0); // 0: Emanet Alma (Giriş), 1: Emanet Verme (Çıkış)
  const [tarih, setTarih] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [vade, setVade] = useState<string>(""); // @VADE TARIH
  const [iptalTarihi, setIptalTarihi] = useState<string>(""); // @IPTAL_TARIHI TARIH
  const [aciklama, setAciklama] = useState<string>(""); // @ACIKLAMA
  const [kurCinsi, setKurCinsi] = useState<number>(0); // @KUR_CINSI (0: Serbest Piyasa, 1: Gişe Kuru, 2: TCMB)
  const [satirDurumu, setSatirDurumu] = useState<number>(0); // @SATIR_DURUMU (0: Normal, 1: İptal, 2: Beklemede)
  const [evrakTuru, setEvrakTuru] = useState<number>(0); // @EVRAK_TURU (0: Cari Dekont, 1: Fiş / Dönüşüm)
  const [oncekiId, setOncekiId] = useState<number | null>(null); // @ONCEKI_ID

  // Cari (Borçlu / Alacaklı)
  const [cariKartId, setCariKartId] = useState<number | null>(null);
  const [cariKod, setCariKod] = useState<string>("");
  const [cariAd, setCariAd] = useState<string>("");
  const [cariTelefon, setCariTelefon] = useState<string>("");
  const [cariInputText, setCariInputText] = useState<string>("");
  const [cariSuggestions, setCariSuggestions] = useState<CariKartItem[]>([]);
  const [showCariSuggest, setShowCariSuggest] = useState<boolean>(false);

  // Vezne
  const [vezneId, setVezneId] = useState<number>(1);
  const [vezneKod, setVezneKod] = useState<string>("");
  const [vezneAd, setVezneAd] = useState<string>("");

  // Diğer alanlar
  const [teslimEden, setTeslimEden] = useState<string>("");
  const [teslimAlan, setTeslimAlan] = useState<string>("");

  // Grid Satırları
  const [satirlar, setSatirlar] = useState<GridRowState[]>([
    {
      id: "line-1",
      satirNo: 1,
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
    },
  ]);

  // Selected row in grid for keyboard actions
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(0);

  // Drag and Drop state for grid rows
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Modals & UI
  const [showDekontSearchModal, setShowDekontSearchModal] = useState<boolean>(false);
  const [showCariLookup, setShowCariLookup] = useState<boolean>(false);
  const [showVezneLookup, setShowVezneLookup] = useState<boolean>(false);
  const [dekontSearchFilter, setDekontSearchFilter] = useState<string>("");
  const [alertInfo, setAlertInfo] = useState<{ type: "success" | "danger" | "warning" | "info"; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Table grid cell input refs: key `${rowIndex}-${colKey}`
  const cellRefs = useRef<{ [key: string]: HTMLElement | null }>({});

  // Helper: Kullanıcının kayıtlı veznesini bul ve ata (Sabit vezne)
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

  // 1. Lookupları ve Kayıtlı Dekontları Yükle
  const loadLookupsAndList = useCallback(async () => {
    setIsLoadingLookups(true);
    try {
      const [cariler, vezneler, paralar, dekontlar] = await Promise.all([
        CariService.getCariKartlar().catch(() => [] as CariKartItem[]),
        apiClient.get<VezneItem[]>("/vezne").then((r) => r.data || []).catch(() => [] as VezneItem[]),
        apiClient.get<ParaItem[]>("/para").then((r) => r.data || []).catch(() => [] as ParaItem[]),
        CariDekontService.getDekontList({ limit: 100 }).catch(() => [] as CariDekontListItem[]),
      ]);

      setCariList(cariler);
      setVezneList(vezneler);
      setParaList(paralar);
      setSavedDekonts(dekontlar);

      // Otomatik kullanıcının veznesini seç
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

  // Load a specific dekont record into form state
  const loadDekontRecord = useCallback(async (recordId: number) => {
    setIsSaving(true);
    try {
      const data = await CariDekontService.getDekontById(recordId);
      setCariDekontId(data.cariDekontId);
      setDekontNo(data.dekontNo);
      setTip(data.tip);
      setTarih(data.tarih ? data.tarih.split("T")[0] : new Date().toISOString().split("T")[0]);
      setVade(data.vade ? data.vade.split("T")[0] : "");
      setIptalTarihi(data.iptalTarihi ? data.iptalTarihi.split("T")[0] : "");
      setAciklama(data.aciklama || "");
      setKurCinsi(data.kurCinsi ?? 0);
      setSatirDurumu(data.satirDurumu ?? 0);
      setEvrakTuru(data.evrakTuru ?? 0);
      setOncekiId(data.oncekiId ?? null);

      // Cari
      const activeCariId = data.tip === 0 ? data.alacakliId : data.borcluId;
      const activeCariKod = data.tip === 0 ? data.alacakliKod : data.borcluKod;
      const activeCariAd = data.tip === 0 ? data.alacakliAd : data.borcluAd;

      const matchedCari = cariList.find((c) => c.id === activeCariId);
      const activeCariTelefon =
        data.telefon ||
        (data.tip === 0 ? data.alacakliTelefon : data.borcluTelefon) ||
        matchedCari?.telefon ||
        "";

      setCariKartId(activeCariId || null);
      setCariKod(activeCariKod || "");
      setCariAd(activeCariAd || "");
      setCariTelefon(activeCariTelefon);
      setCariInputText(activeCariKod && activeCariAd ? `${activeCariKod} - ${activeCariAd}` : (activeCariAd || activeCariKod || ""));
      setShowCariSuggest(false);

      // Vezne
      setVezneId(data.vezneId);
      setVezneKod(data.vezneKod);
      setVezneAd(data.vezneAd);

      // Teslim bilgisi
      if (data.tip === 0) {
        setTeslimEden(activeCariAd || "");
        setTeslimAlan(data.ekleyenAd || user?.username || "Veznedar");
      } else {
        setTeslimEden(user?.username || "Veznedar");
        setTeslimAlan(activeCariAd || "");
      }

      // Satırlar
      if (data.satirlar && data.satirlar.length > 0) {
        setSatirlar(
          data.satirlar.map((s, idx) => ({
            id: `line-${s.satirNo || idx + 1}-${Date.now()}`,
            satirNo: s.satirNo || idx + 1,
            paraId: s.paraId,
            paraKodu: s.paraKodu || "",
            paraAdi: s.paraAdi || "",
            meblag: s.meblag,
            hasOrani: s.hasOrani || 1.0,
            hasMiktar: s.hasMiktar,
            kur: s.kur,
            giseKuru: s.giseKuru,
            tutar: s.tutar,
            aciklama: s.aciklama || "",
          }))
        );
      } else {
        setSatirlar([
          {
            id: `line-1-${Date.now()}`,
            satirNo: 1,
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
          },
        ]);
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
  }, [user]);

  // Yeni Kayıt Butonu (Reset form)
  const handleNew = () => {
    setCariDekontId(null);
    setCurrentIndex(-1);
    setDekontNo("");
    setTarih(new Date().toISOString().split("T")[0]);
    setVade("");
    setIptalTarihi("");
    setOncekiId(null);
    setTip(0); // Varsayılan Emanet Alma (Giriş)
    setCariKartId(null);
    setCariKod("");
    setCariAd("");
    setCariTelefon("");
    setCariInputText("");
    setShowCariSuggest(false);
    applyUserVezne(vezneList);
    setAciklama("");
    setKurCinsi(0);
    setSatirDurumu(0);
    setEvrakTuru(0);
    setTeslimEden("");
    setTeslimAlan("");

    setSatirlar([
      {
        id: `line-1-${Date.now()}`,
        satirNo: 1,
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
      },
    ]);
    setSelectedRowIndex(0);
    setAlertInfo(null);
  };

  // Cari Seçildiğinde
  const handleSelectCari = (cari: CariKartItem) => {
    setCariKartId(cari.id);
    setCariKod(cari.kod);
    setCariAd(cari.ad);
    setCariTelefon(cari.telefon || "");
    setCariInputText(cari.kod ? `${cari.kod} - ${cari.ad}` : cari.ad);
    setShowCariSuggest(false);
    if (tip === 0) {
      setTeslimEden(cari.ad);
    } else {
      setTeslimAlan(cari.ad);
    }
    setShowCariLookup(false);
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

    // Birebir eşleşme varsa cariyi hemen bağla
    const exact = cariList.find(
      (c) =>
        (c.kod && c.kod.toLowerCase() === trimmed) ||
        (c.ad && c.ad.toLowerCase() === trimmed) ||
        `${c.kod} - ${c.ad}`.toLowerCase() === trimmed
    );
    if (exact) {
      setCariKartId(exact.id);
      setCariKod(exact.kod);
      setCariAd(exact.ad);
      setCariTelefon(exact.telefon || "");
      if (tip === 0) setTeslimEden(exact.ad);
      else setTeslimAlan(exact.ad);
    }
  };

  // Vezne Seçildiğinde
  const handleSelectVezne = (vezne: VezneItem) => {
    setVezneId(vezne.id);
    setVezneKod(vezne.kod);
    setVezneAd(vezne.ad);
    setShowVezneLookup(false);
  };

  // Grid Satır Değişikliği
  const handleGridChange = (
    index: number,
    field: keyof GridRowState,
    value: any
  ) => {
    setSatirlar((prev) => {
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

  // Satır Ekle
  const handleAddRow = () => {
    setSatirlar((prev) => [
      ...prev,
      {
        id: `line-${Date.now()}-${prev.length + 1}`,
        satirNo: prev.length + 1,
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
      },
    ]);
    setSelectedRowIndex(satirlar.length);
  };

  // Seçili Satırı Sil
  const handleDeleteSelectedRow = () => {
    if (satirlar.length <= 1) {
      setSatirlar([
        {
          id: `line-${Date.now()}-1`,
          satirNo: 1,
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
        },
      ]);
      setSelectedRowIndex(0);
      return;
    }

    const newRows = satirlar
      .filter((_, idx) => idx !== selectedRowIndex)
      .map((r, idx) => ({ ...r, satirNo: idx + 1 }));

    setSatirlar(newRows);
    setSelectedRowIndex(Math.max(0, selectedRowIndex - 1));
  };

  // Drag & Drop satır sıralama işleyicisi
  const handleDropRow = (targetIdx: number) => {
    if (draggedIndex === null || draggedIndex === targetIdx) return;
    const updated = [...satirlar];
    const [movedItem] = updated.splice(draggedIndex, 1);
    updated.splice(targetIdx, 0, movedItem);
    updated.forEach((line, idx) => {
      line.satirNo = idx + 1;
    });
    setSatirlar(updated);
    setSelectedRowIndex(targetIdx);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Grid Klavye Navigasyonu: Enter ve Sağ/Sol/Yukarı/Aşağı Yön Tuşları
  const gridColumns = ["paraId", "meblag", "hasOrani", "kur", "giseKuru", "aciklama"];

  const isCursorAtEnd = (target: any) => {
    if (!target) return true;
    if (target.tagName === "SELECT") return true;
    try {
      const val = String(target.value ?? "");
      if (typeof target.selectionStart === "number") {
        return target.selectionStart >= val.length;
      }
    } catch (e) {
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
    } catch (e) {
      return true;
    }
    return true;
  };

  const handleKeyDown = (
    e: React.KeyboardEvent,
    rowIndex: number,
    colName: string
  ) => {
    const colIdx = gridColumns.indexOf(colName);
    const target = e.target as any;

    if (e.key === "Enter") {
      e.preventDefault();
      // Bir sonraki hücreye veya bir sonraki satıra geç
      if (colIdx < gridColumns.length - 1) {
        const nextCol = gridColumns[colIdx + 1];
        const nextEl = cellRefs.current[`${rowIndex}-${nextCol}`] as HTMLInputElement | null;
        nextEl?.focus();
        if (nextEl?.select && nextEl.tagName !== "SELECT") nextEl.select();
      } else {
        // Satırın son sütununda
        if (rowIndex < satirlar.length - 1) {
          const nextRowEl = cellRefs.current[`${rowIndex + 1}-${gridColumns[0]}`] as HTMLElement | null;
          nextRowEl?.focus();
          setSelectedRowIndex(rowIndex + 1);
        } else {
          // Son satırın son verisinde Enter'a basınca otomatik yeni satır ekle!
          handleAddRow();
          setTimeout(() => {
            const newRowEl = cellRefs.current[`${rowIndex + 1}-${gridColumns[0]}`] as HTMLElement | null;
            newRowEl?.focus();
            setSelectedRowIndex(rowIndex + 1);
          }, 40);
        }
      }
    } else if (e.key === "ArrowRight") {
      // Yalnızca imleç input içindeki metnin/rakamın sonuna ulaştığında sağdaki hücreye geç
      if (isCursorAtEnd(target)) {
        if (colIdx < gridColumns.length - 1) {
          e.preventDefault();
          const nextCol = gridColumns[colIdx + 1];
          const nextEl = cellRefs.current[`${rowIndex}-${nextCol}`] as HTMLInputElement | null;
          nextEl?.focus();
          if (nextEl?.setSelectionRange && nextEl.tagName !== "SELECT") {
            nextEl.setSelectionRange(0, 0);
          }
        } else if (rowIndex < satirlar.length - 1) {
          e.preventDefault();
          const nextRowEl = cellRefs.current[`${rowIndex + 1}-${gridColumns[0]}`] as HTMLInputElement | null;
          nextRowEl?.focus();
          setSelectedRowIndex(rowIndex + 1);
        }
      }
    } else if (e.key === "ArrowLeft") {
      // Yalnızca imleç input içindeki metnin/rakamın en başına ulaştığında soldaki hücreye geç
      if (isCursorAtStart(target)) {
        if (colIdx > 0) {
          e.preventDefault();
          const prevCol = gridColumns[colIdx - 1];
          const prevEl = cellRefs.current[`${rowIndex}-${prevCol}`] as HTMLInputElement | null;
          prevEl?.focus();
          if (prevEl?.setSelectionRange && prevEl.tagName !== "SELECT") {
            const len = prevEl.value ? prevEl.value.length : 0;
            prevEl.setSelectionRange(len, len);
          }
        } else if (rowIndex > 0) {
          e.preventDefault();
          const prevRowEl = cellRefs.current[`${rowIndex - 1}-${gridColumns[gridColumns.length - 1]}`] as HTMLInputElement | null;
          prevRowEl?.focus();
          setSelectedRowIndex(rowIndex - 1);
        }
      }
    } else if (e.key === "ArrowDown") {
      // Yukarı ve aşağı HER ZAMAN bir alt satırdaki inputa gidecek
      if (rowIndex < satirlar.length - 1) {
        e.preventDefault();
        const downEl = cellRefs.current[`${rowIndex + 1}-${colName}`] as HTMLInputElement | null;
        downEl?.focus();
        setSelectedRowIndex(rowIndex + 1);
      }
    } else if (e.key === "ArrowUp") {
      // Yukarı ve aşağı HER ZAMAN bir üst satırdaki inputa gidecek
      if (rowIndex > 0) {
        e.preventDefault();
        const upEl = cellRefs.current[`${rowIndex - 1}-${colName}`] as HTMLInputElement | null;
        upEl?.focus();
        setSelectedRowIndex(rowIndex - 1);
      }
    }
  };

  // Toplamlar
  const totals = useMemo(() => {
    let toplamMiktar = 0;
    let toplamHas = 0;
    let toplamTutar = 0;

    satirlar.forEach((k) => {
      const m = parseFloat(String(k.meblag).replace(",", ".")) || 0;
      toplamMiktar += m;
      toplamHas += Number(k.hasMiktar) || 0;
      toplamTutar += Number(k.tutar) || 0;
    });

    return {
      toplamMiktar: Number(toplamMiktar.toFixed(2)),
      toplamHas: Number(toplamHas.toFixed(3)),
      toplamTutar: Number(toplamTutar.toFixed(2)),
      kalemSayisi: satirlar.filter((k) => (parseFloat(String(k.meblag).replace(",", ".")) || 0) > 0).length,
    };
  }, [satirlar]);

  // Kaydet Butonu (Both Insert and Update via SODVZ_CARI_DEKONT_KAYDET)
  const handleSave = async () => {
    // 1. Cari Hesap Kontrolü
    let targetCariId = cariKartId;
    if (!targetCariId && cariInputText.trim()) {
      const trimmed = cariInputText.trim().toLowerCase();
      const found = cariList.find(
        (c) =>
          (c.kod && c.kod.toLowerCase() === trimmed) ||
          (c.ad && c.ad.toLowerCase() === trimmed) ||
          `${c.kod} - ${c.ad}`.toLowerCase() === trimmed ||
          (c.kod && trimmed.includes(c.kod.toLowerCase())) ||
          (c.ad && trimmed.includes(c.ad.toLowerCase()))
      );
      if (found) {
        targetCariId = found.id;
        setCariKartId(found.id);
        setCariKod(found.kod);
        setCariAd(found.ad);
      }
    }

    if (!targetCariId) {
      setAlertInfo({
        type: "danger",
        message: "HATA [Cari Kodu / Adı]: Lütfen dekontun ait olduğu cari hesabı belirleyiniz. 'Cari Kodu / Adı' kutusuna cari kodunu veya ünvanını yazıp sağdaki arama butonuna [ 👓 ➔ ] tıklayarak listeden bir cari kart seçiniz.",
      });
      return;
    }

    // 2. İşlem Tarihi Kontrolü
    if (!tarih || !tarih.trim()) {
      setAlertInfo({
        type: "danger",
        message: "HATA [İşlem Tarihi]: İşlem tarihi boş bırakılamaz. Lütfen günün tarihini veya dekont tarihini (GG.AA.YYYY) giriniz.",
      });
      return;
    }
    const tParts = tarih.split("-");
    const tYear = parseInt(tParts[0], 10);
    if (isNaN(tYear) || tYear < 1900 || tYear > 2099) {
      setAlertInfo({
        type: "danger",
        message: `HATA [İşlem Tarihi]: Girdiğiniz yıl (${tParts[0]}) geçersizdir. Yıl 1900 ile 2099 arasında olmalıdır (Örn: 2026).`,
      });
      return;
    }

    // 3. Vade Tarihi Kontrolü (Örn: 20028 gibi hatalı yıllar engellenir)
    if (vade && vade.trim()) {
      const vParts = vade.split("-");
      const vYear = parseInt(vParts[0], 10);
      if (isNaN(vYear) || vYear < 1900 || vYear > 2099) {
        setAlertInfo({
          type: "danger",
          message: `HATA [Vade Tarihi]: Girdiğiniz vade yılı (${vParts[0]}) geçersizdir. Ekrandaki gibi 5 haneli (örn: 20028) veya hatalı bir yıl girilemez. Lütfen 1900 ile 2099 arasında 4 haneli geçerli bir yıl giriniz (Örn: 02.02.2028).`,
        });
        return;
      }
    }

    // 4. İptal Tarihi Kontrolü
    if (satirDurumu === 1) {
      if (!iptalTarihi || !iptalTarihi.trim()) {
        setAlertInfo({
          type: "danger",
          message: "HATA [İptal Tarihi]: Durum 'İptal Edildi' seçildiğinde lütfen bir iptal tarihi belirleyiniz.",
        });
        return;
      }
      const iParts = iptalTarihi.split("-");
      const iYear = parseInt(iParts[0], 10);
      if (isNaN(iYear) || iYear < 1900 || iYear > 2099) {
        setAlertInfo({
          type: "danger",
          message: `HATA [İptal Tarihi]: Girdiğiniz iptal tarihi yılı (${iParts[0]}) geçersizdir. Lütfen 1900 ile 2099 arasında geçerli bir yıl giriniz.`,
        });
        return;
      }
    }

    // 5. Vezne Kontrolü
    if (!vezneId || vezneId <= 0) {
      setAlertInfo({
        type: "danger",
        message: "HATA [Vezne]: İşlemi yapacak vezne belirlenemedi. Lütfen sistem yöneticiniz ile görüşerek kullanıcınıza bir vezne atanmasını sağlayınız.",
      });
      return;
    }

    // 6. Önceki Belge ID Kontrolü
    if (oncekiId !== null && oncekiId !== undefined && (isNaN(Number(oncekiId)) || Number(oncekiId) < 0)) {
      setAlertInfo({
        type: "danger",
        message: "HATA [Önceki Belge]: Önceki belge numarası sadece pozitif rakamlardan oluşmalıdır.",
      });
      return;
    }

    // 7. Tablo Satırları (Kalemler) Kontrolü
    if (!satirlar || satirlar.length === 0) {
      setAlertInfo({
        type: "danger",
        message: "HATA [Emanet Kalemleri]: Dekontu kaydetmek için en az 1 satır emanet kalemi girilmelidir.",
      });
      return;
    }

    for (let i = 0; i < satirlar.length; i++) {
      const line = satirlar[i];
      const seq = line.satirNo || i + 1;

      if (!line.paraId || line.paraId <= 0) {
        setAlertInfo({
          type: "danger",
          message: `HATA [Tablo ${seq}. Satır]: 'Cinsi / Para / Maden' seçilmemiş. Lütfen ${seq}. satırdaki açılır listeden bir para cinsi (TL, USD, EUR, Has Altın vb.) seçiniz.`,
        });
        cellRefs.current[`${i}-paraId`]?.focus();
        setSelectedRowIndex(i);
        return;
      }

      const m = parseFloat(String(line.meblag).replace(",", ".")) || 0;
      if (isNaN(m) || m <= 0) {
        setAlertInfo({
          type: "danger",
          message: `HATA [Tablo ${seq}. Satır]: Miktar 0 veya boş olamaz. Lütfen ${seq}. satırdaki 'Miktar / Gram' alanına pozitif bir miktar giriniz.`,
        });
        cellRefs.current[`${i}-meblag`]?.focus();
        setSelectedRowIndex(i);
        return;
      }

      const k = parseFloat(String(line.kur).replace(",", ".")) || 0;
      if (isNaN(k) || k <= 0) {
        setAlertInfo({
          type: "danger",
          message: `HATA [Tablo ${seq}. Satır]: Rayiç / Kur bedeli 0 veya boş olamaz. Lütfen ${seq}. satırdaki 'Rayiç / Kur' alanına geçerli bir değer giriniz.`,
        });
        cellRefs.current[`${i}-kur`]?.focus();
        setSelectedRowIndex(i);
        return;
      }
    }

    const validLines = satirlar.filter((k) => (parseFloat(String(k.meblag).replace(",", ".")) || 0) > 0);

    setIsSaving(true);
    setAlertInfo(null);

    try {
      const payload: SaveCariDekontPayload = {
        cariDekontId: cariDekontId && cariDekontId > 0 ? cariDekontId : null,
        tip,
        tarih,
        aciklama: aciklama.trim() || undefined,
        kurCinsi: Number(kurCinsi) || 0,
        borcluId: targetCariId,
        alacakliId: targetCariId,
        telefon: cariTelefon.trim() || undefined,
        vezneId: vezneId || 1,
        kullaniciId: Number(user?.id) || 1,
        degisiklikTakipVar: true,
        satirDurumu: Number(satirDurumu) || 0,
        evrakTuru: Number(evrakTuru) || 0,
        vade: vade ? vade : null,
        iptalTarihi: iptalTarihi ? iptalTarihi : (satirDurumu === 1 ? new Date().toISOString().split("T")[0] : null),
        oncekiId: oncekiId ? Number(oncekiId) : null,
        satirlar: validLines.map((line, idx) => ({
          satirNo: line.satirNo || idx + 1,
          tip,
          paraId: line.paraId,
          meblag: parseFloat(String(line.meblag).replace(",", ".")) || 0,
          kur: parseFloat(String(line.kur).replace(",", ".")) || 1.0,
          giseKuru: parseFloat(String(line.giseKuru).replace(",", ".")) || 1.0,
          aciklama: line.aciklama,
        })),
      };

      const saved = await CariDekontService.saveDekont(payload);
      setCariDekontId(saved.cariDekontId);
      setDekontNo(saved.dekontNo);

      setAlertInfo({
        type: "success",
        message: `SODVZ_CARI_DEKONT_KAYDET: ${saved.dekontNo} numaralı ${tip === 0 ? "Emanet Alma" : "Emanet Verme"} dekontu başarıyla kaydedildi.`,
      });

      // Refresh list of saved dekonts
      const updatedList = await CariDekontService.getDekontList({ limit: 100 });
      setSavedDekonts(updatedList);
      const newIdx = updatedList.findIndex((d) => d.cariDekontId === saved.cariDekontId);
      if (newIdx !== -1) setCurrentIndex(newIdx);
    } catch (err: any) {
      setAlertInfo({
        type: "danger",
        message: "Kaydetme hatası: " + (err?.response?.data?.message || err?.message || err),
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Sil Butonu (Üstteki ERPToolbar silme ikonu ile seçili tablo satırı silinir)
  const handleDelete = () => {
    if (satirlar.length > 1) {
      const updated = satirlar.filter((_, idx) => idx !== selectedRowIndex);
      updated.forEach((r, i) => {
        r.satirNo = i + 1;
      });
      setSatirlar(updated);
      setSelectedRowIndex(Math.max(0, selectedRowIndex - 1));
      setAlertInfo(null);
    } else {
      // 1 satır varsa içeriğini sıfırla
      setSatirlar([
        {
          id: `line-1-${Date.now()}`,
          satirNo: 1,
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
        },
      ]);
      setSelectedRowIndex(0);
      setAlertInfo(null);
    }
  };

  // Navigasyon Butonları
  const handleFirst = () => {
    if (savedDekonts.length > 0) {
      setCurrentIndex(0);
      loadDekontRecord(savedDekonts[0].cariDekontId);
    }
  };

  const handlePrev = () => {
    if (savedDekonts.length === 0) return;
    const nextIdx = currentIndex > 0 ? currentIndex - 1 : savedDekonts.length - 1;
    setCurrentIndex(nextIdx);
    loadDekontRecord(savedDekonts[nextIdx].cariDekontId);
  };

  const handleNext = () => {
    if (savedDekonts.length === 0) return;
    const nextIdx = currentIndex < savedDekonts.length - 1 ? currentIndex + 1 : 0;
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

  // Yazdır
  const handlePrint = () => {
    printReportTable<GridRowState>({
      title: `CARİ EMANET DEKONTU - ${tip === 0 ? "EMANET ALMA (GİRİŞ)" : "EMANET VERME (ÇIKIŞ)"}`,
      subtitle: `Dekont No: ${dekontNo || "YENİ"} | Tarih: ${tarih}${vade ? ` | Vade: ${vade}` : ""} | Cari: ${cariKod} - ${cariAd} | Vezne: ${vezneAd}`,
      data: satirlar.filter((s) => (parseFloat(String(s.meblag).replace(",", ".")) || 0) > 0),
      columns: [
        { header: "Sıra", width: "45px", align: "center", render: (k) => k.satirNo },
        { header: "Cinsi / Para", render: (k) => k.paraAdi || k.paraKodu || "-" },
        {
          header: "Miktar / Gram",
          align: "right",
          render: (k) => (parseFloat(String(k.meblag).replace(",", ".")) || 0).toFixed(2),
        },
        {
          header: "Has Oranı",
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
        {
          header: "Gişe Kuru",
          align: "right",
          render: (k) => {
            const gise = parseFloat(String(k.giseKuru).replace(",", ".")) || 0;
            return gise > 0 ? `${gise.toFixed(2)}` : "-";
          },
        },
        { header: "Tutar", align: "right", render: (k) => (k.tutar > 0 ? `${k.tutar.toFixed(2)} ₺` : "-") },
        { header: "Açıklama", render: (k) => k.aciklama || "-" },
      ],
      summaryInfo: `Toplam Kalem: ${totals.kalemSayisi} | Toplam Miktar: ${totals.toplamMiktar} | Toplam Has: ${totals.toplamHas} gr | Teslim Eden: ${teslimEden} | Teslim Alan: ${teslimAlan}`,
    });
  };

  // Filtered dekonts for Dürbün search modal
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

  return (
    <div className="cari-emanet-dekont-page container-fluid px-2 py-2">
      {/* 1. ERP Ribbon Toolbar (Başlık yanında Kaydet, Yeni, Sil, Dürbün, Print, vb.) */}
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
                {/* 1. Dekont / Fiş No with Dürbün */}
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

                {/* 2. İşlem Türü (Input alanından seçilir, varsayılan Giriş) */}
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

                {/* 4. Vade Tarihi (@VADE) */}
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

                {/* 5. İşlem Yapan Vezne (Kullanıcının kayıtlı veznesi, sabit) */}
                <Row className="g-2 align-items-center">
                  <Col xs={4}>
                    <Form.Label className="small fw-semibold mb-0 text-dark">Vezne</Form.Label>
                  </Col>
                  <Col xs={8}>
                    <Form.Control
                      size="sm"
                      value={vezneAd ? `${vezneKod} - ${vezneAd}` : (vezneKod || "Ana Vezne")}
                      readOnly
                      disabled
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
                    <Form.Label className="small fw-semibold mb-0 text-dark">Cari Kodu / Adı</Form.Label>
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

                {/* 5. Kur Cinsi (@KUR_CINSI) */}
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
                {/* 1. Evrak Türü (@EVRAK_TURU) */}
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

                {/* 2. Satır Durumu (@SATIR_DURUMU) */}
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

                {/* 3. İptal Tarihi (@IPTAL_TARIHI) */}
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

                {/* 4. Önceki Belge ID (@ONCEKI_ID) */}
                <Row className="g-2 align-items-center mb-1.5">
                  <Col xs={4}>
                    <Form.Label className="small fw-semibold mb-0 text-dark" title="Dönüşen önceki dekont / fiş kaydı">
                      Önceki Belge
                    </Form.Label>
                  </Col>
                  <Col xs={8}>
                    <Form.Control
                      type="number"
                      size="sm"
                      value={oncekiId ?? ""}
                      onChange={(e) => setOncekiId(e.target.value ? Number(e.target.value) : null)}
                      placeholder=""
                      className="font-monospace"
                    />
                  </Col>
                </Row>

                {/* 3. Genel Açıklama / Not */}
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

                {/* 4. Özet Değerler */}
                <div className="bg-light p-1.5 rounded border mt-auto">
                  <Row className="g-1 text-center font-monospace">
                    <Col xs={4}>
                      <div className="text-muted smaller">Toplam Brüt</div>
                      <div className="fw-bold small text-dark">{totals.toplamMiktar > 0 ? totals.toplamMiktar.toFixed(2) : "-"}</div>
                    </Col>
                    <Col xs={4}>
                      <div className="text-muted smaller">Toplam Has</div>
                      <div className="fw-bold small text-primary">{totals.toplamHas > 0 ? `${totals.toplamHas.toFixed(3)}g` : "-"}</div>
                    </Col>
                    <Col xs={4}>
                      <div className="text-muted smaller">Tahmini Tutar</div>
                      <div className="fw-bold small text-success">{totals.toplamTutar > 0 ? `${totals.toplamTutar.toFixed(2)}₺` : "-"}</div>
                    </Col>
                  </Row>
                </div>
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* 3. Emanet Kalemleri Grid Tablosu (Enter & Yön Tuşları ile Yönetilen ERP Tablo) */}
      <Card className="shadow-sm border border-secondary-subtle rounded-3 overflow-hidden mb-2">
        <Card.Header className="bg-light py-1.5 px-3 border-bottom d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-2">
            <IconCoins size={17} className="text-warning" />
            <span className="fw-bold small text-dark">Emanet Kalemleri Listesi</span>
            <Badge bg="secondary" className="small">
              {satirlar.length} Satır
            </Badge>
          </div>
        </Card.Header>

        <Card.Body className="p-0">
          <div className="table-responsive" style={{ minHeight: "220px", maxHeight: "400px" }}>
            <Table bordered hover size="sm" className="mb-0 align-middle text-nowrap">
              <thead className="table-light sticky-top" style={{ top: 0, zIndex: 2 }}>
                <tr className="small text-center user-select-none">
                  <th style={{ width: "45px" }}>#</th>
                  <th style={{ minWidth: "170px" }}>Cinsi / Para / Maden</th>
                  <th style={{ width: "125px" }}>Miktar / Gram</th>
                  <th style={{ width: "105px" }}>Ayar / Has Oranı</th>
                  <th style={{ width: "125px" }}>Has Karşılığı</th>
                  <th style={{ width: "115px" }}>Rayiç / Kur</th>
                  <th style={{ width: "115px" }}>Gişe Kuru</th>
                  <th style={{ width: "125px" }}>Tutar</th>
                  <th style={{ minWidth: "160px" }}>Açıklama / Poşet No</th>
                </tr>
              </thead>
              <tbody>
                {satirlar.map((row, idx) => {
                  const isSelected = selectedRowIndex === idx;
                  const isDragging = draggedIndex === idx;
                  const isDragOver = dragOverIndex === idx;

                  return (
                    <tr
                      key={row.id}
                      draggable={true}
                      onDragStart={(e) => {
                        setDraggedIndex(idx);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        if (dragOverIndex !== idx) setDragOverIndex(idx);
                      }}
                      onDragLeave={() => {
                        if (dragOverIndex === idx) setDragOverIndex(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleDropRow(idx);
                      }}
                      onDragEnd={() => {
                        setDraggedIndex(null);
                        setDragOverIndex(null);
                      }}
                      className={`${isSelected ? "table-active" : ""} ${
                        isDragging ? "opacity-25 bg-warning-subtle" : ""
                      } ${
                        isDragOver ? "border-top border-3 border-primary bg-primary-subtle" : ""
                      }`}
                      onClick={() => setSelectedRowIndex(idx)}
                    >
                      <td
                        className="text-center small text-muted fw-bold align-middle py-1 px-1 user-select-none"
                        style={{ cursor: "grab" }}
                        title="Mouse ile basılı tutarak satırı yukarı/aşağı kaydırabilirsiniz"
                      >
                        <div className="d-flex align-items-center justify-content-center gap-1">
                          <IconGripVertical size={13} className="text-secondary opacity-75" />
                          <span>{row.satirNo}</span>
                        </div>
                      </td>

                      {/* 1. Cinsi / Para */}
                      <td>
                        <Form.Select
                          ref={(el) => { cellRefs.current[`${idx}-paraId`] = el; }}
                          size="sm"
                          value={row.paraId}
                          onChange={(e) => handleGridChange(idx, "paraId", e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, idx, "paraId")}
                          className="py-0.5 border-0 bg-transparent fw-semibold"
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
                      <td>
                        <Form.Control
                          ref={(el) => { cellRefs.current[`${idx}-meblag`] = el; }}
                          size="sm"
                          type="text"
                          inputMode="decimal"
                          value={row.meblag === 0 ? "" : (row.meblag ?? "")}
                          onChange={(e) => handleGridChange(idx, "meblag", e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, idx, "meblag")}
                          className="text-end font-monospace fw-bold py-0.5 border-0 bg-transparent"
                        />
                      </td>

                      {/* 3. Has Oranı */}
                      <td>
                        <Form.Control
                          ref={(el) => { cellRefs.current[`${idx}-hasOrani`] = el; }}
                          size="sm"
                          type="text"
                          inputMode="decimal"
                          value={row.hasOrani ?? ""}
                          onChange={(e) => handleGridChange(idx, "hasOrani", e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, idx, "hasOrani")}
                          className="text-end font-monospace py-0.5 border-0 bg-transparent"
                        />
                      </td>

                      {/* 4. Has Karşılığı (Readonly) */}
                      <td className="text-end font-monospace fw-bold text-primary pe-3">
                        {row.hasMiktar.toFixed(3)}
                      </td>

                      {/* 5. Rayiç / Kur */}
                      <td>
                        <Form.Control
                          ref={(el) => { cellRefs.current[`${idx}-kur`] = el; }}
                          size="sm"
                          type="text"
                          inputMode="decimal"
                          value={row.kur === 0 ? "" : (row.kur ?? "")}
                          onChange={(e) => handleGridChange(idx, "kur", e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, idx, "kur")}
                          className="text-end font-monospace py-0.5 border-0 bg-transparent"
                        />
                      </td>

                      {/* 6. Gişe Kuru */}
                      <td>
                        <Form.Control
                          ref={(el) => { cellRefs.current[`${idx}-giseKuru`] = el; }}
                          size="sm"
                          type="text"
                          inputMode="decimal"
                          value={row.giseKuru === 0 ? "" : (row.giseKuru ?? "")}
                          onChange={(e) => handleGridChange(idx, "giseKuru", e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, idx, "giseKuru")}
                          className="text-end font-monospace py-0.5 border-0 bg-transparent"
                        />
                      </td>

                      {/* 7. Tutar (Readonly) */}
                      <td className="text-end font-monospace pe-3">
                        {row.tutar > 0 ? row.tutar.toLocaleString("tr-TR", { minimumFractionDigits: 2 }) : "-"}
                      </td>

                      {/* 8. Açıklama / Not */}
                      <td>
                        <Form.Control
                          ref={(el) => { cellRefs.current[`${idx}-aciklama`] = el; }}
                          size="sm"
                          value={row.aciklama}
                          onChange={(e) => handleGridChange(idx, "aciklama", e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, idx, "aciklama")}
                          className="py-0.5 border-0 bg-transparent"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        </Card.Body>

        {/* Toplamlar Alt Çubuğu */}
        <Card.Footer className="bg-light py-1.5 px-3 border-top">
          <Row className="align-items-center g-2 text-center text-md-end small">
            <Col xs={12} md={3} className="text-md-start text-muted">
              Girilen Kalem: <strong className="text-dark">{totals.kalemSayisi}</strong> adet
            </Col>
            <Col xs={4} md={3}>
              <span className="text-muted me-1">Toplam Brüt:</span>
              <strong className="font-monospace fs-6 text-dark">{totals.toplamMiktar.toFixed(2)}</strong>
            </Col>
            <Col xs={4} md={3}>
              <span className="text-muted me-1">Toplam Has:</span>
              <strong className="font-monospace fs-6 text-primary">{totals.toplamHas.toFixed(3)} gr</strong>
            </Col>
            <Col xs={4} md={3}>
              <span className="text-muted me-1">Tahmini Değer:</span>
              <strong className="font-monospace fs-6 text-success">
                {totals.toplamTutar.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺
              </strong>
            </Col>
          </Row>
        </Card.Footer>
      </Card>

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
          { header: "Tür", width: "120px", render: (d) => <Badge bg={d.tip === 0 ? "success" : "danger"}>{d.tipLabel}</Badge> },
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

      {/* Cari Lookup Modalı (Dürbün) */}
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
    </div>
  );
};

export default CariEmanetDekontPage;
