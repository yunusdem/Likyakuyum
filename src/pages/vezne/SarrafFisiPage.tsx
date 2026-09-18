import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, Row, Col, Form, Button, Table, Badge, Alert, InputGroup, Modal, Spinner } from "react-bootstrap";
import {
  IconCheck, IconBinoculars, IconAlertTriangle, IconPlus, IconShieldExclamation, IconShieldCheck,
} from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import LookupModal, { LookupColumn } from "../../components/common/LookupModal";
import { useAuth } from "../../context/AuthContext";
import { MasakService, MasakEslesme } from "../../services/masakService";
import { MasakSonucModal } from "../../components/masak/MasakSonucModal";
import MasakModal from "../../components/masak/MasakModal";
import {
  SarrafFisService, SaveSarrafFisPayload, SarrafFisListItem,
  UrunItem, VezneBakiyeItem,
} from "../../services/sarrafFisService";
import { CashDeskService } from "../../services/cashDeskService";
import { MusteriSecimModal, SelectedCustomerResult } from "./MusteriSecimModal";
import { CariService, CariKartItem } from "../../services/cariService";
import { DovizFisService, KayitsizMusteriItem } from "../../services/dovizFisService";
import { onlyDecimal, onlyDigits, blockNonNumericKeys } from "../../utils/numericInput";

// ─── Types ────────────────────────────────────────────────────────────────────
interface VezneItem { id: number; kod: string; ad: string; }

interface GridRow {
  id: string;
  satirId?: number | null;
  satirNo: number;
  urunId: number;
  urunKodu: string;
  urunAdi: string;
  adet: number | string;
  miktar: number | string;
  milyem: number | string;
  hasGram: number | string;
  iscilikHesaplamaSekli: number | string;
  iscilikiMiktari: number | string;
  iscilikHasGram: number | string;
  kur: number | string;
  tutar: number | string;
  urunTipi: number;
  karat: number | string;
  aciklama: string;
}

interface OdemeRow {
  id: string;
  satirNo: number;
  odemeAraciTuru: number;
  paraId: number | null;
  paraKodu: string;
  miktar: number | string;
  milyem: number | string;
  hasGram: number | string;
  kur: number | string;
  tutar: number | string;
}

const GRID_COLS = [
  "urunKodu", "adet", "miktar", "milyem", "hasGram",
  "iscilikHesaplamaSekli", "iscilikiMiktari", "iscilikHasGram", "kur", "tutar",
] as const;
type GridColKey = typeof GRID_COLS[number];

const makeId = () => `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const createEmptyRow = (satirNo = 1): GridRow => ({
  id: makeId(), satirId: null, satirNo, urunId: 0, urunKodu: "", urunAdi: "",
  adet: "", miktar: "", milyem: "", hasGram: "", iscilikHesaplamaSekli: 0,
  iscilikiMiktari: "", iscilikHasGram: "", kur: "", tutar: "", urunTipi: 0, karat: "", aciklama: "",
});
const createEmptyOdemeRow = (satirNo: number): OdemeRow => ({
  id: makeId(), satirNo, odemeAraciTuru: 0, paraId: null, paraKodu: "TL",
  miktar: "", milyem: 0, hasGram: "", kur: 1, tutar: "",
});

const recomputeRow = (r: GridRow, defaultKur: number = 0): GridRow => {
  const adet = Number(r.adet) || 0;
  const miktar = Number(r.miktar) || 0;
  const milyem = Number(r.milyem) || 0;
  const base = miktar > 0 ? miktar : adet;
  const hasGram = base > 0 && milyem > 0 ? parseFloat(((base * milyem) / 1000).toFixed(4)) : (r.hasGram === "" ? "" : 0);

  const iscilikSekli = Number(r.iscilikHesaplamaSekli) || 0;
  const iscilikiMiktari = Number(r.iscilikiMiktari) || 0;
  let iscilikHasGram: number | string = 0;
  if (iscilikSekli === 0) {
    // Adet
    const effectiveAdet = adet > 0 ? adet : 1;
    iscilikHasGram = iscilikiMiktari > 0 ? parseFloat(((effectiveAdet * iscilikiMiktari) / 1000).toFixed(4)) : 0;
  } else if (iscilikSekli === 1) {
    // Toplam
    iscilikHasGram = iscilikiMiktari > 0 ? parseFloat((iscilikiMiktari / 1000).toFixed(4)) : 0;
  } else {
    // Yok (2)
    iscilikHasGram = 0;
  }

  const kur = Number(r.kur) > 0 ? Number(r.kur) : (defaultKur > 0 ? defaultKur : (r.kur || ""));
  const totalRowHas = (Number(hasGram) || 0) + (Number(iscilikHasGram) || 0);
  const tutar = totalRowHas > 0 && Number(kur) > 0 ? parseFloat((totalRowHas * Number(kur)).toFixed(2)) : (r.tutar === "" ? "" : 0);

  return {
    ...r,
    hasGram: hasGram === 0 && base === 0 ? "" : hasGram,
    iscilikHasGram: iscilikHasGram === 0 && iscilikiMiktari === 0 ? "" : iscilikHasGram,
    kur,
    tutar: tutar === 0 && totalRowHas === 0 ? "" : tutar,
  };
};

const DEFAULT_CUSTOMER_NAME = "İsim beyan edilmemiştir";

const getUserVezne = (list: VezneItem[], cashierCode?: string): VezneItem | undefined => {
  if (!list.length) return undefined;
  const t = String(cashierCode || "").trim();
  if (t) {
    const m = list.find((v) => String(v.id) === t || v.kod.trim() === t) ||
              (!isNaN(Number(t)) ? list.find((v) => v.id === Number(t)) : undefined);
    if (m) return m;
  }
  return list[0];
};

export interface SarrafFisiPageProps {
  isPerakende?: boolean;
  isDuzeltme?: boolean;
}

export const SarrafFisiPage: React.FC<SarrafFisiPageProps> = ({
  isPerakende = false,
  isDuzeltme = false,
}) => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const queryId = searchParams.get("id") || searchParams.get("sarrafFisiId");

  const [notification, setNotification] = useState<{ type: "success"|"danger"|"warning"; message: string } | null>(null);
  const showNotif = (type: "success"|"danger"|"warning", msg: string) => {
    setNotification({ type, message: msg });
    setTimeout(() => setNotification(null), 4500);
  };

  // Lookups
  const [vezneList, setVezneList] = useState<VezneItem[]>([]);
  const [urunList, setUrunList] = useState<UrunItem[]>([]);
  const [bakiyeler, setBakiyeler] = useState<VezneBakiyeItem[]>([]);
  const [fisList, setFisList] = useState<SarrafFisListItem[]>([]);
  const [cariList, setCariList] = useState<CariKartItem[]>([]);
  const [kayitsizMusteriList, setKayitsizMusteriList] = useState<KayitsizMusteriItem[]>([]);
  const [showCariModal, setShowCariModal] = useState<boolean>(false);

  // Header State
  const [fisId, setFisId] = useState<number | null>(null);
  const [fisNo, setFisNo] = useState("");
  const [tarih, setTarih] = useState(() => new Date().toISOString().split("T")[0]);
  const [saat, setSaat] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  });
  const [tip, setTip] = useState<0|1>(0);
  const [belgeTuru, setBelgeTuru] = useState(0);
  const [unvan, setUnvan] = useState(DEFAULT_CUSTOMER_NAME);
  const [cariKartId, setCariKartId] = useState<number|null>(null);
  const [altinHasKuru, setAltinHasKuru] = useState<number|string>("");
  const [alisKuru, setAlisKuru] = useState<number|string>("");
  const [satisKuru, setSatisKuru] = useState<number|string>("");
  const [gumusHasKuru, setGumusHasKuru] = useState<number|string>("");
  const [kdvOrani, setKdvOrani] = useState<number|string>("");
  const [vezneId, setVezneId] = useState(0);
  const [vezneKod, setVezneKod] = useState("");
  const [vezneAd, setVezneAd] = useState("");

  // Detay Modal State
  const [detayUnvan, setDetayUnvan] = useState(DEFAULT_CUSTOMER_NAME);
  const [detayKisilikTipi, setDetayKisilikTipi] = useState(0);
  const [detayVergiKimlikNo, setDetayVergiKimlikNo] = useState("");
  const [detayBabaAdi, setDetayBabaAdi] = useState("");
  const [detayAnneAdi, setDetayAnneAdi] = useState("");
  const [detayAdres, setDetayAdres] = useState("");
  const [detayEposta, setDetayEposta] = useState("");
  const [detayTelefonNo, setDetayTelefonNo] = useState("");
  const [detayDogumTarihi, setDetayDogumTarihi] = useState("");
  const [detayDogumYeri, setDetayDogumYeri] = useState("");
  const [detayKimlikSeriNo, setDetayKimlikSeriNo] = useState("");
  const [detayPasaportNo, setDetayPasaportNo] = useState("");
  const [detayKimlikBelgeTuru, setDetayKimlikBelgeTuru] = useState(0);
  const [detayKimlikGecerlilikTarihi, setDetayKimlikGecerlilikTarihi] = useState("");
  const [detayVekilAdi, setDetayVekilAdi] = useState("");
  const [detayVekilKimlikNo, setDetayVekilKimlikNo] = useState("");

  // Grid State
  const [lines, setLines] = useState<GridRow[]>([createEmptyRow(1)]);
  const [activeRowIndex, setActiveRowIndex] = useState(0);
  const rowInputRefs = useRef<Record<string, HTMLInputElement|HTMLSelectElement|null>>({});
  const [odemeRows, setOdemeRows] = useState<OdemeRow[]>([createEmptyOdemeRow(1)]);

  // Header Element Refs for Keyboard Navigation
  const islemRef = useRef<HTMLSelectElement | null>(null);
  const belgeTuruRef = useRef<HTMLSelectElement | null>(null);
  const zamanTarihRef = useRef<HTMLInputElement | null>(null);
  const zamanSaatRef = useRef<HTMLInputElement | null>(null);
  const adRef = useRef<HTMLInputElement | null>(null);
  const belgeNoRef = useRef<HTMLInputElement | null>(null);

  // Detay Modal Element Refs for Keyboard Navigation
  const detayRefs = useRef<Record<string, HTMLInputElement | HTMLSelectElement | null>>({});
  const DETAY_FIELDS = [
    "unvan", "kisilikTipi", "kimlikBelgeTuru", "vergiKimlikNo", "kimlikSeriNo",
    "pasaportNo", "babaAdi", "anneAdi", "dogumTarihi", "dogumYeri",
    "kimlikGecerlilikTarihi", "telefonNo", "adres", "eposta", "vekilAdi", "vekilKimlikNo",
  ] as const;

  // Modals
  const [showFisModal, setShowFisModal] = useState(false);
  const [showVezneModal, setShowVezneModal] = useState(false);
  const [showUrunModal, setShowUrunModal] = useState(false);
  const [activeRowIdForUrun, setActiveRowIdForUrun] = useState<string|null>(null);
  const [isUrunLoading, setIsUrunLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDetayModal, setShowDetayModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Totals
  const totalAdet = lines.reduce((s, r) => s + (Number(r.adet)||0), 0);
  const totalMiktar = lines.reduce((s, r) => s + (Number(r.miktar)||0), 0);
  const totalHasGram = lines.reduce((s, r) => s + (Number(r.hasGram)||0), 0);
  const totalIscilikMiktari = lines.reduce((s, r) => s + (Number(r.iscilikiMiktari)||0), 0);
  const totalIscilikHasGram = lines.reduce((s, r) => s + (Number(r.iscilikHasGram)||0), 0);
  const totalTutar = lines.reduce((s, r) => s + (Number(r.tutar)||0), 0);
  const totalOdemeTutar = odemeRows.reduce((s, r) => s + (Number(r.tutar)||0), 0);
  const hasKuruNum = Number(altinHasKuru) || 0;
  const alisHas = (totalHasGram + totalIscilikHasGram) > 0
    ? (totalHasGram + totalIscilikHasGram)
    : (hasKuruNum > 0 ? totalTutar / hasKuruNum : 0);
  const odemeHas = hasKuruNum > 0 ? totalOdemeTutar / hasKuruNum : (totalOdemeTutar === totalTutar ? alisHas : 0);
  const farkTL = totalTutar - totalOdemeTutar;
  const farkHas = alisHas - odemeHas;

  // MASAK Sorgulama ve Limit Takip Durumu
  const [isSearchingMasak, setIsSearchingMasak] = useState<boolean>(false);
  const [masakModalOpen, setMasakModalOpen] = useState<boolean>(false);
  const [masakManagementOpen, setMasakManagementOpen] = useState<boolean>(false);
  const [masakResult, setMasakResult] = useState<{
    queriedName?: string;
    queriedId?: string;
    matches: MasakEslesme[];
    searched: boolean;
  }>({ matches: [], searched: false });

  // 185.000 TL veya 5.000 USD MASAK Yasal Sınır Kontrolü
  const isMasakLimitExceeded = (
    totalTutar >= 185000 ||
    totalOdemeTutar >= 185000 ||
    odemeRows.some((o) => (o.paraKodu === "USD" || o.paraKodu === "$") && Number(o.miktar) >= 5000)
  );

  // MASAK limiti aşıldığında popup/toast bildirim göster
  const prevMasakLimitRef = useRef(false);
  useEffect(() => {
    if (isMasakLimitExceeded && !prevMasakLimitRef.current) {
      showNotif("warning", "⚠️ MASAK Yasal Sınırı Aşıldı (≥185.000 TL / 5.000 USD): Mevzuat gereği İsim, T.C. Kimlik / VKN, Adres ve Hukuki Yapı alanları zorunludur.");
    }
    prevMasakLimitRef.current = isMasakLimitExceeded;
  }, [isMasakLimitExceeded]);

  const handleSearchMasak = async (explicitName?: string, explicitId?: string) => {
    const rawName = explicitName !== undefined ? explicitName : unvan;
    const rawId = explicitId !== undefined ? explicitId : detayVergiKimlikNo;

    const isAnon = !rawName || !rawName.trim() ||
      rawName.trim().toUpperCase() === "İSİM BEYAN EDİLMEMİŞTİR" ||
      rawName.trim().toUpperCase() === "ISIM BEYAN EDILMEMISTIR";

    const cleanName = isAnon ? "" : rawName.trim();
    const cleanId = (rawId || "").trim();

    if (!cleanName && !cleanId) {
      showNotif("warning", "MASAK sorgusu yapabilmek için lütfen Müşteri Adı / Ünvan veya T.C. Kimlik / VKN giriniz.");
      return;
    }

    try {
      setIsSearchingMasak(true);
      const res = await MasakService.sorgula({
        ad: cleanName || undefined,
        kimlikNo: cleanId || undefined,
        limit: 30,
      });

      const matches = res?.kayitlar || [];
      setMasakResult({
        queriedName: cleanName || cleanId,
        queriedId: cleanId,
        matches,
        searched: true,
      });
      setMasakModalOpen(true);

      if (matches.length > 0) {
        showNotif("danger", `🚨 DİKKAT: "${cleanName || cleanId}" için MASAK listelerinde ${matches.length} eşleşme bulundu!`);
      } else {
        showNotif("success", `✅ MASAK Sorgulaması Temiz: "${cleanName || cleanId}" için listede kısıtlama kaydı bulunamadı.`);
      }
    } catch (err: any) {
      showNotif("danger", `MASAK sorgusu yapılamadı: ${err?.message || "Sunucu bağlantı hatası"}`);
    } finally {
      setIsSearchingMasak(false);
    }
  };

  // Sayfa ilk açılınca otomatik inputa / işleme odaklan
  useEffect(() => {
    const timer = setTimeout(() => {
      islemRef.current?.focus();
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  // Auto-sync single payment row to totalTutar and alisHas so Fark = 0
  useEffect(() => {
    setOdemeRows((prev) => {
      if (prev.length === 1) {
        const first = prev[0];
        if (first.paraKodu === "TL" || !first.paraKodu) {
          const tutarVal = totalTutar > 0 ? parseFloat(totalTutar.toFixed(2)) : "";
          const hasVal = alisHas > 0 ? parseFloat(alisHas.toFixed(4)) : "";
          if (first.tutar !== tutarVal || first.miktar !== tutarVal || first.hasGram !== hasVal) {
            return [{
              ...first,
              miktar: tutarVal,
              tutar: tutarVal,
              hasGram: hasVal,
              kur: 1,
            }];
          }
        }
      }
      return prev;
    });
  }, [totalTutar, alisHas]);

  // Load lookups & user's default vezne
  useEffect(() => {
    (async () => {
      try {
        const [vezneler, urunler, fisler, cariler, kayitsizlar] = await Promise.all([
          CashDeskService.getVezneler().catch((): VezneItem[] => []),
          SarrafFisService.getUrunler().catch(() => []),
          SarrafFisService.getFisList({ limit: 200 }).catch(() => []),
          CariService.getCariKartlar().catch(() => [] as CariKartItem[]),
          DovizFisService.getKayitsizMusteriler().catch(() => []),
        ]);
        setVezneList(vezneler as VezneItem[]);
        setUrunList(urunler);
        setFisList(fisler);
        setCariList(cariler as CariKartItem[]);
        setKayitsizMusteriList(kayitsizlar as KayitsizMusteriItem[]);
        if (!queryId) {
          let userVezneId: number | null = null;
          if (user?.id) {
            userVezneId = await SarrafFisService.getUserVezneId(Number(user.id)).catch(() => null);
          }
          let uv: VezneItem | undefined;
          if (userVezneId) {
            uv = (vezneler as VezneItem[]).find((v) => v.id === userVezneId);
          }
          if (!uv) {
            uv = getUserVezne(vezneler as VezneItem[], user?.cashierCode);
          }
          if (uv) {
            setVezneId(uv.id); setVezneKod(uv.kod); setVezneAd(uv.ad);
            const bak = await SarrafFisService.getVezneBakiye(uv.id).catch(() => []);
            setBakiyeler(bak);
          }
        }
      } catch (e) { console.error(e); }
    })();
  }, [queryId, user?.id, user?.cashierCode]);

  // Reset form (keeps cashier's vezne intact, clears all inputs)
  const resetForm = useCallback(() => {
    setFisId(null);
    setFisNo("");
    setTarih(new Date().toISOString().split("T")[0]);
    const d = new Date();
    setSaat(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
    setTip(0);
    setBelgeTuru(0);
    setUnvan(DEFAULT_CUSTOMER_NAME);
    setCariKartId(null);
    setAltinHasKuru("");
    setAlisKuru("");
    setSatisKuru("");
    setGumusHasKuru("");
    setKdvOrani("");
    setDetayUnvan(DEFAULT_CUSTOMER_NAME);
    setDetayKisilikTipi(0);
    setDetayVergiKimlikNo("");
    setDetayBabaAdi("");
    setDetayAnneAdi("");
    setDetayAdres("");
    setDetayEposta("");
    setDetayTelefonNo("");
    setDetayDogumTarihi("");
    setDetayDogumYeri("");
    setDetayKimlikSeriNo("");
    setDetayPasaportNo("");
    setDetayKimlikBelgeTuru(0);
    setDetayKimlikGecerlilikTarihi("");
    setDetayVekilAdi("");
    setDetayVekilKimlikNo("");
    setLines([createEmptyRow(1)]);
    setActiveRowIndex(0);
    setOdemeRows([createEmptyOdemeRow(1)]);
  }, []);

  // Load by ID
  const loadFisById = useCallback(async (id: number) => {
    try {
      const data = await SarrafFisService.getFisById(id);
      if (!data) return;
      setFisId(data.sarrafFisiId); setFisNo(data.fisNo || "");
      setTarih(data.tarih || new Date().toISOString().split("T")[0]);
      if (data.saat) setSaat(new Date(data.saat).toTimeString().slice(0, 5));
      setTip((data.tip as 0|1) || 0);
      setBelgeTuru(data.belgeTuru || 0);
      setUnvan(data.unvan || DEFAULT_CUSTOMER_NAME);
      setCariKartId(data.cariKartId || null);
      setAltinHasKuru(data.altinHasKuru || "");
      setAlisKuru(data.alisKuru || "");
      setSatisKuru(data.satisKuru || "");
      setGumusHasKuru(data.gumusHasKuru || "");
      setKdvOrani(data.kdvOrani || "");
      if (data.vezneId) {
        setVezneId(data.vezneId);
        const vz = vezneList.find((v) => v.id === data.vezneId);
        if (vz) { setVezneKod(vz.kod); setVezneAd(vz.ad); }
        const bak = await SarrafFisService.getVezneBakiye(data.vezneId).catch(() => []);
        setBakiyeler(bak);
      }
      setDetayUnvan(data.unvan || DEFAULT_CUSTOMER_NAME);
      setDetayKisilikTipi((data as any).kisilikTipi || 0);
      setDetayVergiKimlikNo((data as any).vergiKimlikNo || "");
      setDetayBabaAdi((data as any).babaAdi || "");
      setDetayAnneAdi((data as any).anneAdi || "");
      setDetayAdres((data as any).adres || "");
      setDetayEposta((data as any).eposta || "");
      setDetayTelefonNo((data as any).telefonNo || "");
      setDetayDogumTarihi((data as any).dogumTarihi || "");
      setDetayDogumYeri((data as any).dogumYeri || "");
      setDetayKimlikSeriNo((data as any).kimlikSeriNo || "");
      setDetayPasaportNo((data as any).pasaportNo || "");
      setDetayKimlikBelgeTuru((data as any).kimlikBelgeTuru || 0);
      setDetayKimlikGecerlilikTarihi((data as any).kimlikGecerlilikTarihi || "");
      setDetayVekilAdi((data as any).vekilAdi || "");
      setDetayVekilKimlikNo((data as any).vekilKimlikNo || "");
      if (data.satirlar?.length) {
        const mapped = data.satirlar.map((s: any) => ({
          id: `row-${s.sarrafFisiSatiriId || makeId()}`,
          satirId: s.sarrafFisiSatiriId,
          satirNo: s.satirNo,
          urunId: s.urunId || 0,
          urunKodu: s.urunKodu,
          urunAdi: s.urunAdi,
          adet: s.adet,
          miktar: s.miktar,
          milyem: s.milyem,
          hasGram: s.hasGram,
          iscilikHesaplamaSekli: s.iscilikHesaplamaSekli || 0,
          iscilikiMiktari: s.iscilikiMiktari,
          iscilikHasGram: s.iscilikHasGram,
          kur: s.kur,
          tutar: s.tutar,
          urunTipi: s.urunTipi || 0,
          karat: s.karat || "",
          aciklama: s.aciklama || "",
        }));
        setLines([...mapped, createEmptyRow(mapped.length + 1)]);
      }
      if (data.odemeSatirlari?.length) {
        setOdemeRows(data.odemeSatirlari.map((o: any) => ({
          id: makeId(),
          satirNo: o.satirNo,
          odemeAraciTuru: o.odemeAraciTuru,
          paraId: o.paraId,
          paraKodu: o.paraKodu || "TL",
          miktar: o.miktar,
          milyem: o.milyem,
          hasGram: o.hasGram,
          kur: o.kur,
          tutar: o.tutar,
        })));
      }
    } catch (e) { showNotif("danger", "Fiş yüklenemedi"); }
  }, [vezneList]);

  useEffect(() => { if (queryId) loadFisById(Number(queryId)); }, [queryId, loadFisById]);

  // Save
  const handleSave = useCallback(async () => {
    if (!vezneId) { showNotif("warning", "Vezne seçiniz"); return; }
    const validLines = lines.filter((l) => l.urunId > 0 && Number(l.miktar) > 0);
    if (!validLines.length) { showNotif("warning", "En az bir geçerli satır giriniz"); return; }

    // 185.000 TL veya 5.000 USD MASAK Sınır ve Kimlik Bilgisi Kontrolü
    if (isMasakLimitExceeded) {
      const activeUnvan = (unvan || detayUnvan || "").trim();
      const isAnon = !activeUnvan ||
        activeUnvan.toUpperCase() === "İSİM BEYAN EDİLMEMİŞTİR" ||
        activeUnvan.toUpperCase() === "ISIM BEYAN EDILMEMISTIR";

      const missingFields: string[] = [];
      if (isAnon) missingFields.push("İsim / Ünvan");
      if (!detayVergiKimlikNo || !detayVergiKimlikNo.trim()) missingFields.push("T.C. Kimlik / VKN");
      if (!detayAdres || !detayAdres.trim()) missingFields.push("Müşteri Adresi");
      if (detayKisilikTipi === undefined || detayKisilikTipi === null) missingFields.push("Hukuki Yapı / Kişilik Tipi");

      if (missingFields.length > 0) {
        showNotif("warning", `⚠️ MASAK Yasal Sınırı Aşıldı (≥185.000 TL / 5.000 USD): Mevzuat gereği ${missingFields.join(", ")} zorunludur. Lütfen Detay penceresinden eksik bilgileri doldurunuz.`);
        openDetayModal();
        return;
      }

      // Sınır aşıldığında MASAK sorgulamasını otomatik çalıştır
      try {
        const cleanName = isAnon ? "" : (unvan || detayUnvan || "").trim();
        const cleanId = (detayVergiKimlikNo || "").trim();
        if (cleanName || cleanId) {
          const res = await MasakService.sorgula({
            ad: cleanName || undefined,
            kimlikNo: cleanId || undefined,
            limit: 15,
          });
          const matches = res?.kayitlar || [];
          setMasakResult({
            queriedName: cleanName || cleanId,
            queriedId: cleanId,
            matches,
            searched: true,
          });
          if (matches.length > 0) {
            setMasakModalOpen(true);
            showNotif("danger", `🚨 DİKKAT: "${cleanName || cleanId}" için MASAK listelerinde ${matches.length} eşleşme bulundu!`);
          }
        }
      } catch (err) {
        console.error("Auto MASAK check error:", err);
      }
    }

    setIsSaving(true);
    try {
      const payload: SaveSarrafFisPayload = {
        sarrafFisiId: fisId,
        vezneId,
        cariKartId,
        tarih,
        saat: tarih + "T" + saat + ":00",
        fisNo: fisNo || null,
        tip,
        altinHasKuru: Number(altinHasKuru) || 0,
        alisKuru: Number(alisKuru) || 0,
        satisKuru: Number(satisKuru) || 0,
        gumusHasKuru: Number(gumusHasKuru) || 0,
        kdvOrani: Number(kdvOrani) || null,
        belgeTuru,
        unvan: unvan || detayUnvan || null,
        kisilikTipi: detayKisilikTipi || null,
        vergiKimlikNo: detayVergiKimlikNo || null,
        babaAdi: detayBabaAdi || null,
        anneAdi: detayAnneAdi || null,
        adres: detayAdres || null,
        eposta: detayEposta || null,
        telefonNo: detayTelefonNo || null,
        dogumTarihi: detayDogumTarihi || null,
        dogumYeri: detayDogumYeri || null,
        kimlikSeriNo: detayKimlikSeriNo || null,
        pasaportNo: detayPasaportNo || null,
        kimlikBelgeTuru: detayKimlikBelgeTuru || null,
        kimlikGecerlilikTarihi: detayKimlikGecerlilikTarihi || null,
        vekilAdi: detayVekilAdi || null,
        vekilKimlikNo: detayVekilKimlikNo || null,
        masakListesindeVar: (masakResult.matches && masakResult.matches.length > 0) ? true : false,
        kullaniciId: Number(user?.id) || 1,
        yazdirilanBelgeTipi: 0,
        satirlar: validLines.map((l, i) => ({
          satirId: l.satirId ?? null,
          satirNo: i + 1,
          urunId: l.urunId,
          miktar: Number(l.miktar) || 0,
          milyem: Number(l.milyem) || 0,
          hasGram: Number(l.hasGram) || 0,
          adet: Number(l.adet) || 0,
          iscilikiMiktari: Number(l.iscilikiMiktari) || 0,
          iscilikHasGram: Number(l.iscilikHasGram) || 0,
          iscilikHesaplamaSekli: l.iscilikHesaplamaSekli !== undefined && l.iscilikHesaplamaSekli !== null && !isNaN(Number(l.iscilikHesaplamaSekli)) ? Number(l.iscilikHesaplamaSekli) : 0,
          aciklama: l.aciklama || null,
          kur: Number(l.kur) || 0,
          tutar: Number(l.tutar) || 0,
          urunTipi: l.urunTipi || 0,
          karat: l.karat && !isNaN(Number(l.karat)) ? Number(l.karat) : null,
        })),
        odemeSatirlari: odemeRows.filter((o) => Number(o.miktar) > 0 || Number(o.tutar) > 0).map((o, i) => ({
          satirNo: i + 1,
          islemeYeri: 0,
          odemeAraciTuru: o.odemeAraciTuru || 0,
          paraId: o.paraId || null,
          miktar: Number(o.miktar) || 0,
          milyem: Number(o.milyem) || 0,
          hasGram: Number(o.hasGram) || 0,
          kur: Number(o.kur) || 1,
          tutar: Number(o.tutar) || 0,
        })),
      };
      const result = await SarrafFisService.saveFis(payload);
      showNotif("success", `Fiş ${result.yeniKayit ? "kaydedildi" : "güncellendi"} — ${result.fisNo || result.sarrafFisiId}`);
      resetForm();
      const bak = await SarrafFisService.getVezneBakiye(vezneId).catch(() => bakiyeler);
      setBakiyeler(bak);
      const fl = await SarrafFisService.getFisList({ limit: 200 }).catch(() => fisList);
      setFisList(fl);
    } catch (e: any) {
      showNotif("danger", e?.message || "Kayıt hatası");
    } finally {
      setIsSaving(false);
    }
  }, [vezneId, fisId, fisNo, tarih, saat, tip, belgeTuru, altinHasKuru, alisKuru, satisKuru,
      gumusHasKuru, kdvOrani, unvan, detayUnvan, detayKisilikTipi, detayVergiKimlikNo,
      detayBabaAdi, detayAnneAdi, detayAdres, detayEposta, detayTelefonNo, detayDogumTarihi,
      detayDogumYeri, detayKimlikSeriNo, detayPasaportNo, detayKimlikBelgeTuru,
      detayKimlikGecerlilikTarihi, detayVekilAdi, detayVekilKimlikNo,
      cariKartId, lines, odemeRows, user?.id, bakiyeler, fisList, resetForm]);

  // Delete
  const handleDelete = useCallback(async () => {
    if (!fisId) return;
    try {
      await SarrafFisService.deleteFis(fisId, Number(user?.id) || 1);
      showNotif("success", "Fiş silindi");
      resetForm();
      setShowDeleteConfirm(false);
      const fl = await SarrafFisService.getFisList({ limit: 200 }).catch(() => []);
      setFisList(fl);
    } catch (e: any) {
      showNotif("danger", e?.message || "Silme hatası");
      setShowDeleteConfirm(false);
    }
  }, [fisId, user?.id, resetForm]);

  // Customer selection from MusteriSecimModal
  const handleSelectCustomer = useCallback((result: SelectedCustomerResult) => {
    const selectedName = (result.unvan || "").trim() || DEFAULT_CUSTOMER_NAME;
    setUnvan(selectedName);
    setDetayUnvan(selectedName);

    if (result.type === "registered") {
      setCariKartId(result.id);
    } else if (result.type === "unregistered") {
      setCariKartId(-result.id);
    } else {
      setCariKartId(null);
    }

    if (result.vergiKimlikNo) {
      setDetayVergiKimlikNo(result.vergiKimlikNo);
    }
    if (result.adres) {
      setDetayAdres(result.adres);
    }
    if (result.telefon) {
      setDetayTelefonNo(result.telefon);
    }

    const raw = result.raw as any;
    if (raw) {
      if (raw.kisilikTipi !== undefined && raw.kisilikTipi !== null) {
        setDetayKisilikTipi(Number(raw.kisilikTipi));
      }
      if (raw.vergiKimlikNo) setDetayVergiKimlikNo(raw.vergiKimlikNo);
      if (raw.babaAdi) setDetayBabaAdi(raw.babaAdi);
      if (raw.anneAdi) setDetayAnneAdi(raw.anneAdi);
      if (raw.adres) setDetayAdres(raw.adres);
      if (raw.eposta) setDetayEposta(raw.eposta);
      if (raw.telefon) setDetayTelefonNo(raw.telefon);
      if (raw.dogumTarihi) setDetayDogumTarihi(String(raw.dogumTarihi).split("T")[0]);
      if (raw.dogumYeri) setDetayDogumYeri(raw.dogumYeri);
      if (raw.kimlikSeriNo) setDetayKimlikSeriNo(raw.kimlikSeriNo);
      if (raw.pasaportNo) setDetayPasaportNo(raw.pasaportNo);
      if (raw.kimlikBelgeTuru !== undefined && raw.kimlikBelgeTuru !== null) {
        setDetayKimlikBelgeTuru(Number(raw.kimlikBelgeTuru));
      }
      if (raw.kimlikGecerlilikTarihi) {
        setDetayKimlikGecerlilikTarihi(String(raw.kimlikGecerlilikTarihi).split("T")[0]);
      }
      if (raw.vekilAdi) setDetayVekilAdi(raw.vekilAdi);
      if (raw.vekilKimlikNo) setDetayVekilKimlikNo(raw.vekilKimlikNo);
    }

    setShowCariModal(false);
  }, []);

  // Open F5 Detay Modal (syncing current Unvan if set)
  const openDetayModal = useCallback(() => {
    if (unvan && unvan !== DEFAULT_CUSTOMER_NAME && (!detayUnvan || detayUnvan === DEFAULT_CUSTOMER_NAME)) {
      setDetayUnvan(unvan);
    }
    setShowDetayModal(true);
  }, [unvan, detayUnvan]);

  // Detay save
  const handleSaveDetay = useCallback(async () => {
    if (!fisId) {
      // Just keep in state if fis is not yet saved to DB
      setUnvan(detayUnvan || DEFAULT_CUSTOMER_NAME);
      setShowDetayModal(false);
      showNotif("success", "Müşteri bilgileri fişe uygulandı");
      return;
    }
    try {
      await SarrafFisService.saveDetay(fisId, {
        unvan: detayUnvan || null,
        kisilikTipi: detayKisilikTipi || null,
        vergiKimlikNo: detayVergiKimlikNo || null,
        babaAdi: detayBabaAdi || null,
        anneAdi: detayAnneAdi || null,
        adres: detayAdres || null,
        eposta: detayEposta || null,
        telefonNo: detayTelefonNo || null,
        dogumTarihi: detayDogumTarihi || null,
        dogumYeri: detayDogumYeri || null,
        kimlikSeriNo: detayKimlikSeriNo || null,
        pasaportNo: detayPasaportNo || null,
        kimlikBelgeTuru: detayKimlikBelgeTuru || null,
        kimlikGecerlilikTarihi: detayKimlikGecerlilikTarihi || null,
        vekilAdi: detayVekilAdi || null,
        vekilKimlikNo: detayVekilKimlikNo || null,
        kullaniciId: Number(user?.id) || 1,
      });
      setUnvan(detayUnvan || DEFAULT_CUSTOMER_NAME);
      showNotif("success", "Müşteri detayı kaydedildi");
      setShowDetayModal(false);
    } catch (e: any) {
      showNotif("danger", e?.message || "Detay kayıt hatası");
    }
  }, [fisId, detayUnvan, detayKisilikTipi, detayVergiKimlikNo, detayBabaAdi, detayAnneAdi,
      detayAdres, detayEposta, detayTelefonNo, detayDogumTarihi, detayDogumYeri,
      detayKimlikSeriNo, detayPasaportNo, detayKimlikBelgeTuru, detayKimlikGecerlilikTarihi,
      detayVekilAdi, detayVekilKimlikNo, user?.id]);

  // Has Kuru change
  const handleAltinHasKuruChange = useCallback((val: string) => {
    const cleanVal = onlyDecimal(val);
    setAltinHasKuru(cleanVal);
    const newKur = Number(cleanVal) || 0;
    if (newKur > 0) {
      setLines((prev) => prev.map((r) => {
        const updated = { ...r, kur: newKur };
        return recomputeRow(updated, newKur);
      }));
    }
  }, []);

  // Row update
  const updateRow = useCallback((rowId: string, field: keyof GridRow, value: any) => {
    let sanitizedValue = value;
    if (field === "adet") {
      sanitizedValue = onlyDigits(String(value));
    } else if (
      field === "miktar" ||
      field === "milyem" ||
      field === "hasGram" ||
      field === "iscilikiMiktari" ||
      field === "iscilikHasGram" ||
      field === "kur" ||
      field === "tutar" ||
      field === "karat"
    ) {
      sanitizedValue = onlyDecimal(String(value));
    }

    const curHasKuru = Number(altinHasKuru) || 0;
    setLines((prev) => prev.map((r) => {
      if (r.id !== rowId) return r;
      const updated = { ...r, [field]: sanitizedValue };
      return recomputeRow(updated, curHasKuru);
    }));
  }, [altinHasKuru]);

  const updateOdemeRow = useCallback((rowId: string, field: keyof OdemeRow, value: any) => {
    let sanitizedValue = value;
    if (
      field === "miktar" ||
      field === "milyem" ||
      field === "hasGram" ||
      field === "kur" ||
      field === "tutar"
    ) {
      sanitizedValue = onlyDecimal(String(value));
    }

    setOdemeRows((prev) => prev.map((r) => {
      if (r.id !== rowId) return r;
      const u = { ...r, [field]: sanitizedValue };
      const curHasKuru = Number(altinHasKuru) || 0;
      if (field === "miktar" || field === "kur") {
        const mik = Number(field === "miktar" ? sanitizedValue : r.miktar) || 0;
        const kur = Number(field === "kur" ? sanitizedValue : r.kur) || 1;
        u.tutar = parseFloat((mik * kur).toFixed(2));
        if (curHasKuru > 0) {
          u.hasGram = parseFloat((u.tutar / curHasKuru).toFixed(4));
        }
      }
      return u;
    }));
  }, [altinHasKuru]);

  const handleDeleteLine = useCallback((rowId: string) => {
    setLines((prev) => {
      if (prev.length <= 1) {
        return [createEmptyRow(1)];
      }
      const filtered = prev.filter((r) => r.id !== rowId);
      return filtered.map((r, idx) => ({ ...r, satirNo: idx + 1 }));
    });
  }, []);

  const handleDeleteOdemeRow = useCallback((rowId: string) => {
    setOdemeRows((prev) => {
      if (prev.length <= 1) {
        return [createEmptyOdemeRow(1)];
      }
      const filtered = prev.filter((r) => r.id !== rowId);
      return filtered.map((r, idx) => ({ ...r, satirNo: idx + 1 }));
    });
  }, []);

  // Sağ tık menüsü eylemleri (Satırı Sil & Yeni Satır Ekle - Her iki tablo için duyarlı)
  useEffect(() => {
    const handleGridDelete = (e: any) => {
      const rowId = e.detail?.rowId;
      const tableType = e.detail?.tableType;
      if (!rowId) return;

      if (tableType === "odeme" || odemeRows.some((o) => o.id === rowId)) {
        handleDeleteOdemeRow(rowId);
      } else {
        handleDeleteLine(rowId);
      }
    };

    const handleGridAdd = (e: any) => {
      const tableType = e.detail?.tableType;
      const rowId = e.detail?.rowId;

      if (tableType === "odeme" || (rowId && odemeRows.some((o) => o.id === rowId))) {
        setOdemeRows((prev) => [...prev, createEmptyOdemeRow(prev.length + 1)]);
      } else {
        setLines((prev) => [...prev, createEmptyRow(prev.length + 1)]);
      }
    };

    window.addEventListener("erp-grid-row-delete", handleGridDelete);
    window.addEventListener("erp-grid-row-add", handleGridAdd);
    return () => {
      window.removeEventListener("erp-grid-row-delete", handleGridDelete);
      window.removeEventListener("erp-grid-row-add", handleGridAdd);
    };
  }, [handleDeleteLine, handleDeleteOdemeRow, odemeRows]);

  // Bildirimlerin belli süre sonra otomatik kaybolması
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Open product modal with eager data fetch if empty
  const openUrunModal = useCallback(async (rowId: string) => {
    setActiveRowIdForUrun(rowId);
    setShowUrunModal(true);
    if (urunList.length === 0) {
      setIsUrunLoading(true);
      try {
        const u = await SarrafFisService.getUrunler();
        if (u && u.length > 0) {
          setUrunList(u);
        }
      } catch (err) {
        console.error("Error fetching products on modal open:", err);
      } finally {
        setIsUrunLoading(false);
      }
    }
  }, [urunList.length]);

  // ─── Safe selection bounds helper (prevents DOMException on date/time/number inputs) ──
  const getSelectionBounds = (el: any): { isAtStart: boolean; isAtEnd: boolean } => {
    if (!el || !(el instanceof HTMLInputElement)) {
      return { isAtStart: true, isAtEnd: true };
    }
    try {
      const len = el.value ? el.value.length : 0;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      if (typeof start === "number" && typeof end === "number") {
        return {
          isAtStart: start === 0,
          isAtEnd: end === len,
        };
      }
    } catch (err) {}
    return { isAtStart: true, isAtEnd: true };
  };

  const focusGridCell = (
    rowId: string,
    field: GridColKey,
    mode: "select" | "start" | "end" = "select"
  ) => {
    const el = rowInputRefs.current[`${rowId}_${field}`];
    if (el) {
      el.focus();
      if (el instanceof HTMLInputElement) {
        try {
          if (mode === "select") {
            el.select();
          } else if (mode === "start") {
            el.setSelectionRange(0, 0);
          } else if (mode === "end") {
            const len = el.value ? el.value.length : 0;
            el.setSelectionRange(len, len);
          }
        } catch {}
      }
    }
  };

  // ─── Keyboard Navigation: Header Fields ──────────────────────────────────────
  const handleHeaderKeyDown = (
    e: React.KeyboardEvent<any>,
    field: "islem" | "belgeTuru" | "zamanTarih" | "zamanSaat" | "ad" | "belgeNo"
  ) => {
    const { isAtStart, isAtEnd } = getSelectionBounds(e.currentTarget);

    if (e.key === "Enter") {
      e.preventDefault();
      if (field === "islem") belgeTuruRef.current?.focus();
      else if (field === "belgeTuru") zamanTarihRef.current?.focus();
      else if (field === "zamanTarih") zamanSaatRef.current?.focus();
      else if (field === "zamanSaat") adRef.current?.focus();
      else if (field === "ad") belgeNoRef.current?.focus();
      else if (field === "belgeNo") {
        if (lines.length > 0) {
          setActiveRowIndex(0);
          focusGridCell(lines[0].id, "urunKodu", "select");
        }
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (field === "islem" || field === "belgeTuru") adRef.current?.focus();
      else if (field === "zamanTarih" || field === "zamanSaat") belgeNoRef.current?.focus();
      else if (field === "ad" || field === "belgeNo") {
        if (lines.length > 0) {
          setActiveRowIndex(0);
          focusGridCell(lines[0].id, "urunKodu", "select");
        }
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (field === "ad") islemRef.current?.focus();
      else if (field === "belgeNo") zamanTarihRef.current?.focus();
    } else if (e.key === "ArrowRight") {
      if (isAtEnd) {
        e.preventDefault();
        if (field === "islem") belgeTuruRef.current?.focus();
        else if (field === "belgeTuru") zamanTarihRef.current?.focus();
        else if (field === "zamanTarih") zamanSaatRef.current?.focus();
        else if (field === "zamanSaat") adRef.current?.focus();
        else if (field === "ad") belgeNoRef.current?.focus();
        else if (field === "belgeNo") {
          if (lines.length > 0) {
            setActiveRowIndex(0);
            focusGridCell(lines[0].id, "urunKodu", "select");
          }
        }
      }
    } else if (e.key === "ArrowLeft") {
      if (isAtStart) {
        e.preventDefault();
        if (field === "belgeTuru") islemRef.current?.focus();
        else if (field === "zamanTarih") belgeTuruRef.current?.focus();
        else if (field === "zamanSaat") zamanTarihRef.current?.focus();
        else if (field === "ad") zamanSaatRef.current?.focus();
        else if (field === "belgeNo") adRef.current?.focus();
      }
    }
  };

  // ─── Keyboard Navigation: Grid ───────────────────────────────────────────────
  const handleGridKeyDown = useCallback((
    e: React.KeyboardEvent<HTMLElement>,
    rowIndex: number,
    colKey: GridColKey,
    rowId: string
  ) => {
    const colIdx = GRID_COLS.indexOf(colKey);
    const totalCols = GRID_COLS.length;
    const { isAtStart, isAtEnd } = getSelectionBounds(e.currentTarget);

    if (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) {
      e.preventDefault();
      // On urunKodu, try to resolve product or open lookup
      if (colKey === "urunKodu") {
        const row = lines[rowIndex];
        const val = (row.urunKodu || "").trim();
        if (!val) {
          openUrunModal(rowId);
          return;
        }
        const found = urunList.find((u) => u.kod.trim().toLowerCase() === val.toLowerCase());
        if (found) {
          const curHasKuru = Number(altinHasKuru) || 0;
          setLines((prev) => prev.map((r) => {
            if (r.id !== rowId) return r;
            const hasOrani = found.hasOrani || 0;
            const adet = Number(r.adet) || 1;
            const miktar = Number(found.gramaj) > 0 ? Number(found.gramaj) * adet : (Number(r.miktar) || 0);
            const iscilikiMiktari = found.iscilik ? Math.round(found.iscilik * 1000) : (Number(r.iscilikiMiktari) || 0);
            const milyem = hasOrani > 0 ? Math.round(hasOrani * 1000) : (Number(r.milyem) || 0);
            const updated: GridRow = {
              ...r,
              urunId: found.paraId,
              urunKodu: found.kod,
              urunAdi: found.ad,
              adet,
              miktar: miktar > 0 ? miktar : r.miktar,
              milyem,
              iscilikHesaplamaSekli: r.iscilikHesaplamaSekli !== "" ? r.iscilikHesaplamaSekli : 0,
              iscilikiMiktari: iscilikiMiktari > 0 ? iscilikiMiktari : r.iscilikiMiktari,
              urunTipi: found.urunTipi || 0,
              kur: Number(r.kur) > 0 ? r.kur : (curHasKuru > 0 ? curHasKuru : ""),
            };
            return recomputeRow(updated, curHasKuru);
          }));
          setTimeout(() => focusGridCell(rowId, "adet", "select"), 20);
          return;
        } else {
          openUrunModal(rowId);
          return;
        }
      }

      // Next column in same row
      if (colIdx + 1 < totalCols) {
        const nk = GRID_COLS[colIdx + 1];
        focusGridCell(rowId, nk, "select");
      } else {
        // Last column in row -> automatic new row!
        if (rowIndex < lines.length - 1) {
          const nr = lines[rowIndex + 1];
          setActiveRowIndex(rowIndex + 1);
          focusGridCell(nr.id, "urunKodu", "select");
        } else {
          const newRow = createEmptyRow(lines.length + 1);
          setLines((prev) => [...prev, newRow]);
          setActiveRowIndex(rowIndex + 1);
          setTimeout(() => focusGridCell(newRow.id, "urunKodu", "select"), 30);
        }
      }
    } else if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault();
      if (colIdx > 0) {
        const pk = GRID_COLS[colIdx - 1];
        focusGridCell(rowId, pk, "select");
      } else if (rowIndex > 0) {
        const pr = lines[rowIndex - 1];
        setActiveRowIndex(rowIndex - 1);
        focusGridCell(pr.id, GRID_COLS[totalCols - 1], "select");
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (rowIndex < lines.length - 1) {
        const nr = lines[rowIndex + 1];
        setActiveRowIndex(rowIndex + 1);
        focusGridCell(nr.id, colKey, "select");
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (rowIndex > 0) {
        const pr = lines[rowIndex - 1];
        setActiveRowIndex(rowIndex - 1);
        focusGridCell(pr.id, colKey, "select");
      } else {
        // Jump back to header
        if (colIdx < 4) adRef.current?.focus();
        else belgeNoRef.current?.focus();
      }
    } else if (e.key === "ArrowRight") {
      if (isAtEnd) {
        e.preventDefault();
        if (colIdx + 1 < totalCols) {
          const nk = GRID_COLS[colIdx + 1];
          focusGridCell(rowId, nk, "start");
        } else if (rowIndex < lines.length - 1) {
          const nr = lines[rowIndex + 1];
          setActiveRowIndex(rowIndex + 1);
          focusGridCell(nr.id, "urunKodu", "start");
        }
      }
    } else if (e.key === "ArrowLeft") {
      if (isAtStart) {
        e.preventDefault();
        if (colIdx > 0) {
          const pk = GRID_COLS[colIdx - 1];
          focusGridCell(rowId, pk, "end");
        } else if (rowIndex > 0) {
          const pr = lines[rowIndex - 1];
          setActiveRowIndex(rowIndex - 1);
          focusGridCell(pr.id, GRID_COLS[totalCols - 1], "end");
        }
      }
    }
  }, [lines, urunList, updateRow, altinHasKuru]);

  // ─── Keyboard Navigation: Detay Modal ─────────────────────────────────────────
  const handleDetayKeyDown = (
    e: React.KeyboardEvent<any>,
    fieldName: typeof DETAY_FIELDS[number]
  ) => {
    const idx = DETAY_FIELDS.indexOf(fieldName);
    const { isAtStart, isAtEnd } = getSelectionBounds(e.currentTarget);

    if (e.key === "Enter") {
      e.preventDefault();
      if (idx + 1 < DETAY_FIELDS.length) {
        detayRefs.current[DETAY_FIELDS[idx + 1]]?.focus();
      } else {
        handleSaveDetay();
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (idx + 1 < DETAY_FIELDS.length) {
        detayRefs.current[DETAY_FIELDS[idx + 1]]?.focus();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (idx > 0) {
        detayRefs.current[DETAY_FIELDS[idx - 1]]?.focus();
      }
    } else if (e.key === "ArrowRight") {
      if (isAtEnd && idx + 1 < DETAY_FIELDS.length) {
        e.preventDefault();
        detayRefs.current[DETAY_FIELDS[idx + 1]]?.focus();
      }
    } else if (e.key === "ArrowLeft") {
      if (isAtStart && idx > 0) {
        e.preventDefault();
        detayRefs.current[DETAY_FIELDS[idx - 1]]?.focus();
      }
    }
  };

  // ─── Global F-key shortcuts ──────────────────────────────────────────────────
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (["INPUT","TEXTAREA","SELECT"].includes((e.target as HTMLElement)?.tagName) &&
          !["F1","F3","F4","F5","F8"].includes(e.key)) {
        return;
      }
      if (e.key === "F1") { e.preventDefault(); handleSave(); }
      else if (e.key === "F3") { e.preventDefault(); setShowFisModal(true); }
      else if (e.key === "F4") { e.preventDefault(); resetForm(); }
      else if (e.key === "F5") { e.preventDefault(); openDetayModal(); }
      else if (e.key === "F8") { e.preventDefault(); if (fisId) setShowDeleteConfirm(true); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [handleSave, resetForm, fisId, openDetayModal]);

  // LookupModal columns
  const fisColumns: LookupColumn<SarrafFisListItem>[] = [
    { header: "Belge No", render: (i) => i.fisNo },
    { header: "Tarih", render: (i) => i.tarih, width: "100px" },
    { header: "Tip", render: (i) => <Badge bg={i.tip === 0 ? "primary" : "success"}>{i.tipLabel}</Badge>, width: "60px" },
    { header: "Müşteri", render: (i) => i.unvan },
    { header: "Has Kur", render: (i) => i.altinHasKuru?.toLocaleString("tr-TR"), width: "90px", align: "right" },
  ];

  const vezneColumns: LookupColumn<VezneItem>[] = [
    { header: "Kod", render: (i) => i.kod, width: "80px" },
    { header: "Ad", render: (i) => i.ad },
  ];

  const urunColumns: LookupColumn<UrunItem>[] = [
    { header: "Kod", render: (i) => i.kod, width: "80px" },
    { header: "Ad", render: (i) => i.ad },
    { header: "Has Oranı", render: (i) => i.hasOrani?.toString() || "", width: "90px", align: "right" },
    { header: "Birim", render: (i) => i.birim?.toString() || "", width: "60px" },
  ];

  const getBakiyeDisplay = () => {
    const f = (kod: string) => bakiyeler.find((b) => b.paraKodu === kod || b.paraKodu === (kod === "TL" ? "TRY" : kod));
    const fmt = (v?: number) => (v || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `TL : ${fmt(f("TL")?.miktar)}    USD : ${fmt(f("USD")?.miktar)}    EUR : ${fmt(f("EUR")?.miktar)}`;
  };

  const tipLabel = tip === 0 ? "ALIŞ İŞLEMİ" : "SATIŞ İŞLEMİ";
  const belgeLabel = belgeTuru === 0 ? "Kağıt fatura" : belgeTuru === 1 ? "e-Fatura" : "e-İrsaliye";

  // ─── Render ──────────────────────────────────────────────────────────────────
  const displayTitle = isPerakende
    ? "B- Perakende Fişi"
    : isDuzeltme
    ? "A- Genel Sarraf Fişi Düzeltme"
    : "A- Genel Sarraf Fişi";

  return (
    <div className="sarraf-fisi-page w-100 pb-3" style={{ fontFamily: "'Segoe UI', sans-serif", fontSize: "12.5px" }}>
      <ERPToolbar
        disableShortcuts
        pageTitle={
          <span style={{ fontWeight: 700, fontSize: "14px" }}>
            {displayTitle}{" "}
            <Badge bg={tip === 0 ? "primary" : "success"} style={{ fontSize: "11px" }}>
              {tip === 0 ? "ALIŞ" : "SATIŞ"}
            </Badge>
          </span>
        }
        onNew={resetForm}
        onSave={handleSave}
        onSearch={() => setShowFisModal(true)}
        onDetailSearch={openDetayModal}
        onDelete={fisId ? () => setShowDeleteConfirm(true) : undefined}
        hideDelete={!fisId}
        onPrint={() => window.print()}
      />

      {/* Sağ altta beliren ve 3.5 sn sonra yok olan bildirim */}
      {notification && (
        <div className="erp-toast-container">
          <Alert variant={notification.type} className="erp-toast-item py-2 px-3 mb-0 border-0 shadow small" dismissible onClose={() => setNotification(null)}>
            {notification.message}
          </Alert>
        </div>
      )}

      {/* ─── Top Vezne + Bakiye Summary ────────────────────────────────────────── */}
      <div className="d-flex align-items-center gap-3 mb-2 px-2 py-1 border rounded bg-light" style={{ flexWrap: "wrap" }}>
        <div className="d-flex align-items-center gap-1">
          <span className="fw-bold text-primary" style={{ fontSize: "12px", minWidth: 45 }}>VEZNE</span>
          <div className="input-group input-group-sm" style={{ width: 95 }}>
            <input
              type="text"
              value={vezneKod}
              readOnly
              onClick={() => setShowVezneModal(true)}
              className="form-control form-control-sm text-center fw-bold bg-white"
              style={{ cursor: "pointer", fontSize: "12px" }}
            />
            <Button
              size="sm"
              variant="outline-secondary"
              className="px-2 py-0 d-flex align-items-center"
              onClick={() => setShowVezneModal(true)}
              title="Vezne Seç"
            >
              <IconBinoculars size={14} />
            </Button>
          </div>
          {vezneAd && <span className="text-muted small ms-1">({vezneAd})</span>}
        </div>
        <span className="text-dark fw-semibold" style={{ fontSize: "12px", letterSpacing: "0.3px" }}>
          {getBakiyeDisplay()}
        </span>
        <div className="ms-auto fw-bold text-uppercase" style={{ fontSize: "15px", color: tip === 0 ? "#0d6efd" : "#198754" }}>
          {tipLabel} / {belgeLabel}
        </div>
      </div>

      <Card className="shadow-sm mb-2">
        <Card.Body className="p-2">
          {/* ─── Header Form: Labels on Left, Inputs on Right ───────────────────── */}
          <Row className="g-2 mb-2">
            {/* Left Column: İşlem / Belge Türü & Ad */}
            <Col xs={12} md={6}>
              {/* Row 1: İşlem & Belge Türü */}
              <div className="d-flex align-items-center mb-1">
                <label style={{ width: 70, minWidth: 70, fontSize: "12px", fontWeight: 600 }}>İşlem</label>
                <div className="d-flex gap-1" style={{ flex: 1 }}>
                  <Form.Select
                    ref={islemRef}
                    size="sm"
                    value={tip}
                    onChange={(e) => setTip(Number(e.target.value) as 0|1)}
                    onKeyDown={(e) => handleHeaderKeyDown(e, "islem")}
                    style={{ flex: 1 }}
                  >
                    <option value={0}>ALIŞ</option>
                    <option value={1}>SATIŞ</option>
                  </Form.Select>
                  <Form.Select
                    ref={belgeTuruRef}
                    size="sm"
                    value={belgeTuru}
                    onChange={(e) => setBelgeTuru(Number(e.target.value))}
                    onKeyDown={(e) => handleHeaderKeyDown(e, "belgeTuru")}
                    style={{ flex: 1 }}
                  >
                    <option value={0}>Kağıt fatura</option>
                    <option value={1}>e-Fatura</option>
                    <option value={2}>e-İrsaliye</option>
                  </Form.Select>
                </div>
              </div>

              {/* Row 2: Ad */}
              <div className="d-flex align-items-center mb-1">
                <label style={{ width: 70, minWidth: 70, fontSize: "12px", fontWeight: 600 }}>Ad</label>
                <InputGroup size="sm" style={{ flex: 1 }}>
                  <Form.Control
                    ref={adRef}
                    value={unvan}
                    onChange={(e) => {
                      setUnvan(e.target.value);
                      if (cariKartId) setCariKartId(null);
                    }}
                    onBlur={() => {
                      if (!unvan || !unvan.trim()) {
                        setUnvan(DEFAULT_CUSTOMER_NAME);
                      }
                    }}
                    onKeyDown={(e) => handleHeaderKeyDown(e, "ad")}
                    placeholder=""
                  />
                  <Button
                    variant="outline-secondary"
                    className="px-2 py-0 d-flex align-items-center"
                    onClick={() => {
                      setShowCariModal(true);
                      if (cariList.length === 0) {
                        CariService.getCariKartlar().then((r) => setCariList(r || [])).catch(() => {});
                        DovizFisService.getKayitsizMusteriler().then((r) => setKayitsizMusteriList(r || [])).catch(() => {});
                      }
                    }}
                    title="Cari / Müşteri Seç"
                  >
                    <IconBinoculars size={14} />
                  </Button>
                  <Button
                    variant="outline-danger"
                    className="px-2 py-0 d-flex align-items-center justify-content-center gap-1"
                    style={{ fontSize: "11px", fontWeight: 600 }}
                    onClick={() => handleSearchMasak(unvan, detayVergiKimlikNo)}
                    disabled={isSearchingMasak}
                    title="İsim ve TC/VKN ile MASAK Listelerinde Sorgula"
                  >
                    {isSearchingMasak ? <Spinner animation="border" size="sm" /> : <IconShieldExclamation size={14} color="#dc2626" />}
                    <span className="d-none d-sm-inline text-danger">MASAK</span>
                  </Button>
                </InputGroup>
              </div>
            </Col>

            {/* Right Column: Zaman & Belge No */}
            <Col xs={12} md={6}>
              {/* Row 1: Zaman */}
              <div className="d-flex align-items-center mb-1">
                <label style={{ width: 70, minWidth: 70, fontSize: "12px", fontWeight: 600 }}>Zaman</label>
                <div className="d-flex gap-1" style={{ flex: 1 }}>
                  <Form.Control
                    ref={zamanTarihRef}
                    type="date"
                    size="sm"
                    value={tarih}
                    onChange={(e) => setTarih(e.target.value)}
                    onKeyDown={(e) => handleHeaderKeyDown(e, "zamanTarih")}
                    style={{ flex: 1 }}
                  />
                  <Form.Control
                    ref={zamanSaatRef}
                    type="time"
                    size="sm"
                    value={saat}
                    onChange={(e) => setSaat(e.target.value)}
                    onKeyDown={(e) => handleHeaderKeyDown(e, "zamanSaat")}
                    style={{ width: 90 }}
                  />
                </div>
              </div>

              {/* Row 2: Belge No */}
              <div className="d-flex align-items-center mb-1">
                <label style={{ width: 70, minWidth: 70, fontSize: "12px", fontWeight: 600 }}>Belge no</label>
                <Form.Control
                  ref={belgeNoRef}
                  size="sm"
                  value={fisNo}
                  onChange={(e) => setFisNo(e.target.value)}
                  onKeyDown={(e) => handleHeaderKeyDown(e, "belgeNo")}
                  placeholder=""
                  style={{ flex: 1 }}
                />
              </div>
            </Col>
          </Row>

          {/* ─── Grid / Satır Tablosu ───────────────────────────────────────────── */}
          <div style={{ overflowX: "auto" }}>
            <Table bordered size="sm" hover className="mb-1" style={{ fontSize: "11.5px", minWidth: 960 }}>
              <thead style={{ background: "#d9e8fb", color: "#000" }}>
                <tr>
                  <th style={{ width: 25 }} className="text-center">#</th>
                  <th style={{ width: 110 }}>Ürün kodu</th>
                  <th style={{ width: 140 }}>Ürün adı</th>
                  <th style={{ width: 55 }}>Adet</th>
                  <th style={{ width: 75 }}>Miktar</th>
                  <th style={{ width: 65 }}>Milyem</th>
                  <th style={{ width: 85 }}>Altın (Has Gr)</th>
                  <th style={{ width: 85 }}>İşçilik şekli</th>
                  <th style={{ width: 85 }}>İşçilik (mg)</th>
                  <th style={{ width: 85 }}>İşçilik (Has)</th>
                  <th style={{ width: 105 }}>Kur</th>
                  <th style={{ width: 105 }}>Tutar</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((row, rowIndex) => (
                  <tr key={row.id} data-row-id={row.id} data-table-type="kalemler" style={rowIndex === activeRowIndex ? { background: "#edf5ff" } : {}}>
                    <td className="text-muted text-center" style={{ padding: "2px", fontSize: "10px", verticalAlign: "middle" }}>
                      {rowIndex + 1}
                    </td>

                    {/* Ürün kodu */}
                    <td>
                      <InputGroup size="sm">
                        <Form.Control
                          ref={(el) => { rowInputRefs.current[`${row.id}_urunKodu`] = el; }}
                          value={row.urunKodu}
                          onChange={(e) => updateRow(row.id, "urunKodu", e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "F4") {
                              e.preventDefault();
                              openUrunModal(row.id);
                              return;
                            }
                            handleGridKeyDown(e, rowIndex, "urunKodu", row.id);
                          }}
                          onFocus={() => setActiveRowIndex(rowIndex)}
                          style={{ fontSize: "11px", padding: "1px 4px" }}
                        />
                        <Button
                          variant="outline-secondary"
                          className="px-1 py-0 d-flex align-items-center"
                          onClick={() => openUrunModal(row.id)}
                          title="Ürün Seç"
                        >
                          <IconBinoculars size={12} />
                        </Button>
                      </InputGroup>
                    </td>

                    {/* Ürün adı - read only */}
                    <td>
                      <Form.Control
                        size="sm"
                        value={row.urunAdi}
                        readOnly
                        style={{ fontSize: "11px", padding: "1px 4px", background: "#f8f9fa" }}
                      />
                    </td>

                    {/* Adet */}
                    <td>
                      <Form.Control
                        ref={(el) => { rowInputRefs.current[`${row.id}_adet`] = el; }}
                        inputMode="numeric"
                        size="sm"
                        value={row.adet}
                        onChange={(e) => updateRow(row.id, "adet", e.target.value)}
                        onKeyDown={(e) => handleGridKeyDown(e, rowIndex, "adet", row.id)}
                        onFocus={() => setActiveRowIndex(rowIndex)}
                        style={{ fontSize: "11px", padding: "1px 4px" }}
                      />
                    </td>

                    {/* Miktar */}
                    <td>
                      <Form.Control
                        ref={(el) => { rowInputRefs.current[`${row.id}_miktar`] = el; }}
                        inputMode="decimal"
                        size="sm"
                        value={row.miktar}
                        onChange={(e) => updateRow(row.id, "miktar", e.target.value)}
                        onKeyDown={(e) => handleGridKeyDown(e, rowIndex, "miktar", row.id)}
                        onFocus={() => setActiveRowIndex(rowIndex)}
                        style={{ fontSize: "11px", padding: "1px 4px" }}
                      />
                    </td>

                    {/* Milyem */}
                    <td>
                      <Form.Control
                        ref={(el) => { rowInputRefs.current[`${row.id}_milyem`] = el; }}
                        inputMode="decimal"
                        data-decimal="true"
                        size="sm"
                        value={row.milyem}
                        onChange={(e) => updateRow(row.id, "milyem", e.target.value)}
                        onKeyDown={(e) => handleGridKeyDown(e, rowIndex, "milyem", row.id)}
                        onFocus={() => setActiveRowIndex(rowIndex)}
                        style={{ fontSize: "11px", padding: "1px 4px" }}
                      />
                    </td>

                    {/* Altın (Has Gr) */}
                    <td>
                      <Form.Control
                        ref={(el) => { rowInputRefs.current[`${row.id}_hasGram`] = el; }}
                        inputMode="decimal"
                        data-decimal="true"
                        size="sm"
                        value={row.hasGram}
                        onChange={(e) => updateRow(row.id, "hasGram", e.target.value)}
                        onKeyDown={(e) => handleGridKeyDown(e, rowIndex, "hasGram", row.id)}
                        onFocus={() => setActiveRowIndex(rowIndex)}
                        style={{ fontSize: "11px", padding: "1px 4px" }}
                      />
                    </td>

                    {/* İşçilik şekli */}
                    <td>
                      <Form.Select
                        size="sm"
                        value={row.iscilikHesaplamaSekli}
                        ref={(el) => { rowInputRefs.current[`${row.id}_iscilikHesaplamaSekli`] = el; }}
                        onChange={(e) => updateRow(row.id, "iscilikHesaplamaSekli", Number(e.target.value))}
                        onKeyDown={(e) => handleGridKeyDown(e, rowIndex, "iscilikHesaplamaSekli", row.id)}
                        onFocus={() => setActiveRowIndex(rowIndex)}
                        style={{ fontSize: "10.5px", padding: "1px 2px" }}
                      >
                        <option value={0}>Adet</option>
                        <option value={1}>Toplam</option>
                        <option value={2}>Yok</option>
                      </Form.Select>
                    </td>

                    {/* İşçilik miktarı */}
                    <td>
                      <Form.Control
                        ref={(el) => { rowInputRefs.current[`${row.id}_iscilikiMiktari`] = el; }}
                        inputMode="decimal"
                        data-decimal="true"
                        size="sm"
                        value={row.iscilikiMiktari}
                        onChange={(e) => updateRow(row.id, "iscilikiMiktari", e.target.value)}
                        onKeyDown={(e) => handleGridKeyDown(e, rowIndex, "iscilikiMiktari", row.id)}
                        onFocus={() => setActiveRowIndex(rowIndex)}
                        style={{ fontSize: "11px", padding: "1px 4px" }}
                      />
                    </td>

                    {/* İşçilik Has Gram */}
                    <td>
                      <Form.Control
                        ref={(el) => { rowInputRefs.current[`${row.id}_iscilikHasGram`] = el; }}
                        inputMode="decimal"
                        size="sm"
                        value={row.iscilikHasGram}
                        onChange={(e) => updateRow(row.id, "iscilikHasGram", e.target.value)}
                        onKeyDown={(e) => handleGridKeyDown(e, rowIndex, "iscilikHasGram", row.id)}
                        onFocus={() => setActiveRowIndex(rowIndex)}
                        style={{ fontSize: "11px", padding: "1px 4px" }}
                      />
                    </td>

                    {/* Kur */}
                    <td>
                      <Form.Control
                        ref={(el) => { rowInputRefs.current[`${row.id}_kur`] = el; }}
                        inputMode="decimal"
                        size="sm"
                        value={row.kur}
                        onChange={(e) => updateRow(row.id, "kur", e.target.value)}
                        onKeyDown={(e) => handleGridKeyDown(e, rowIndex, "kur", row.id)}
                        onFocus={() => setActiveRowIndex(rowIndex)}
                        style={{ fontSize: "11px", padding: "1px 4px" }}
                      />
                    </td>

                    {/* Tutar */}
                    <td>
                      <Form.Control
                        ref={(el) => { rowInputRefs.current[`${row.id}_tutar`] = el; }}
                        inputMode="decimal"
                        size="sm"
                        value={row.tutar}
                        onChange={(e) => updateRow(row.id, "tutar", e.target.value)}
                        onKeyDown={(e) => handleGridKeyDown(e, rowIndex, "tutar", row.id)}
                        onFocus={() => setActiveRowIndex(rowIndex)}
                        style={{ fontSize: "11px", padding: "1px 4px" }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot style={{ background: "#f2f4f7", fontWeight: 600, fontSize: "11px" }}>
                <tr>
                  <td colSpan={3} className="text-end small">Toplam</td>
                  <td style={{ textAlign: "right" }}>{totalAdet || ""}</td>
                  <td style={{ textAlign: "right" }}>{totalMiktar ? totalMiktar.toFixed(3) : ""}</td>
                  <td></td>
                  <td style={{ textAlign: "right" }}>{totalHasGram ? totalHasGram.toFixed(4) : ""}</td>
                  <td></td>
                  <td style={{ textAlign: "right" }}>{totalIscilikMiktari || ""}</td>
                  <td style={{ textAlign: "right" }}>{totalIscilikHasGram ? totalIscilikHasGram.toFixed(4) : ""}</td>
                  <td></td>
                  <td style={{ textAlign: "right" }}>
                    {totalTutar ? totalTutar.toLocaleString("tr-TR", { minimumFractionDigits: 2 }) + " TL" : ""}
                  </td>
                </tr>
              </tfoot>
            </Table>
          </div>

          {/* ─── Bottom Sections: TL/HAS | Kur/KDV | ÖDEME ──────────────────────── */}
          <Row className="g-2 mt-1 align-items-start">
            {/* TL / HAS Summary Table */}
            <Col xs={12} md={3}>
              <Table bordered size="sm" className="mb-0" style={{ fontSize: "11.5px" }}>
                <thead className="table-light">
                  <tr>
                    <th></th>
                    <th className="text-center">TL</th>
                    <th className="text-center">HAS</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="fw-semibold">Alış</td>
                    <td className="text-end">{totalTutar.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</td>
                    <td className="text-end">{alisHas.toFixed(4)}</td>
                  </tr>
                  <tr>
                    <td className="fw-semibold">Ödeme</td>
                    <td className="text-end">{totalOdemeTutar.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</td>
                    <td className="text-end">{odemeHas.toFixed(4)}</td>
                  </tr>
                  <tr>
                    <td className="fw-bold">Fark</td>
                    <td className="text-end fw-bold" style={{ color: farkTL !== 0 ? "#dc3545" : "inherit" }}>
                      {farkTL.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="text-end fw-bold" style={{ color: farkHas !== 0 ? "#dc3545" : "inherit" }}>
                      {farkHas.toFixed(4)}
                    </td>
                  </tr>
                </tbody>
              </Table>
            </Col>

            {/* Has Kuru & İşçilik KDV % */}
            <Col xs={12} md={3}>
              <div className="d-flex flex-column gap-2 p-1 border rounded bg-white">
                <div className="d-flex align-items-center">
                  <label style={{ width: 85, minWidth: 85, fontSize: "11.5px", fontWeight: 600 }}>Has kuru</label>
                  <Form.Control
                    type="number"
                    size="sm"
                    value={altinHasKuru}
                    onChange={(e) => handleAltinHasKuruChange(e.target.value)}
                    style={{ flex: 1, fontSize: "11.5px" }}
                  />
                </div>
                <div className="d-flex align-items-center">
                  <label style={{ width: 85, minWidth: 85, fontSize: "11.5px", fontWeight: 600 }}>İşçilik KDV %</label>
                  <div className="d-flex gap-1" style={{ flex: 1 }}>
                    <Form.Control
                      type="number"
                      size="sm"
                      value={kdvOrani}
                      onChange={(e) => setKdvOrani(e.target.value)}
                      style={{ width: 55, fontSize: "11.5px" }}
                    />
                    <Form.Control
                      type="number"
                      size="sm"
                      readOnly
                      value={((Number(kdvOrani)||0) * (Number(altinHasKuru)||0) * totalIscilikHasGram / 100).toFixed(2)}
                      style={{ flex: 1, background: "#f8f9fa", fontSize: "11.5px" }}
                    />
                  </div>
                </div>
              </div>
            </Col>

            {/* ÖDEME Table */}
            <Col xs={12} md={6}>
              <div className="border rounded p-1 bg-white">
                <Table bordered size="sm" className="mb-1" style={{ fontSize: "11px" }}>
                  <thead style={{ background: "#e2e6ea" }}>
                    <tr>
                      <th style={{ width: 20 }} className="text-center">V</th>
                      <th style={{ width: 50 }}>Para</th>
                      <th>Miktar</th>
                      <th>Milyem</th>
                      <th>Has Gr</th>
                      <th>Kur</th>
                      <th>Tutar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {odemeRows.map((oRow) => (
                      <tr key={oRow.id} data-row-id={oRow.id} data-table-type="odeme">
                        <td className="text-muted text-center" style={{ fontSize: "10px", padding: "1px" }}>V</td>
                        <td>
                          <Form.Control
                            size="sm"
                            value={oRow.paraKodu}
                            onChange={(e) => updateOdemeRow(oRow.id, "paraKodu", e.target.value)}
                            style={{ fontSize: "10.5px", padding: "1px 2px" }}
                          />
                        </td>
                        <td>
                          <Form.Control
                            type="number"
                            size="sm"
                            value={oRow.miktar}
                            onChange={(e) => updateOdemeRow(oRow.id, "miktar", e.target.value)}
                            style={{ fontSize: "10.5px", padding: "1px 2px" }}
                          />
                        </td>
                        <td>
                          <Form.Control
                            type="number"
                            size="sm"
                            value={oRow.milyem}
                            onChange={(e) => updateOdemeRow(oRow.id, "milyem", e.target.value)}
                            style={{ fontSize: "10.5px", padding: "1px 2px" }}
                          />
                        </td>
                        <td>
                          <Form.Control
                            type="number"
                            size="sm"
                            value={oRow.hasGram}
                            onChange={(e) => updateOdemeRow(oRow.id, "hasGram", e.target.value)}
                            style={{ fontSize: "10.5px", padding: "1px 2px" }}
                          />
                        </td>
                        <td>
                          <Form.Control
                            type="number"
                            size="sm"
                            value={oRow.kur}
                            onChange={(e) => updateOdemeRow(oRow.id, "kur", e.target.value)}
                            style={{ fontSize: "10.5px", padding: "1px 2px" }}
                          />
                        </td>
                        <td className="text-end fw-semibold" style={{ padding: "2px 4px" }}>
                          {Number(oRow.tutar) ? Number(oRow.tutar).toLocaleString("tr-TR", { minimumFractionDigits: 2 }) : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={6} className="text-end fw-bold" style={{ padding: "2px 4px" }}>TOPLAM</td>
                      <td className="text-end fw-bold" style={{ padding: "2px 4px" }}>
                        {totalOdemeTutar.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL
                      </td>
                    </tr>
                  </tfoot>
                </Table>
              </div>
            </Col>
          </Row>

          {/* ─── Shortcut Bar ─────────────────────────────────────────────────── */}
          <div className="d-flex gap-3 flex-wrap mt-2 pt-2 border-top">
            {[["F1","Kaydet"],["F3","Ara"],["F4","Yeni"],["F5","Detay"],["F8","Sil"],["F11","Yazdır"]].map(([k,l]) => (
              <span
                key={k}
                className="d-inline-flex align-items-center gap-1"
                style={{ fontSize: "11px", cursor: k === "F5" ? "pointer" : "default" }}
                onClick={k === "F5" ? openDetayModal : undefined}
                title={k === "F5" ? "Müşteri Detayı Aç (F5)" : undefined}
              >
                <Badge bg="secondary" className="px-1 py-0" style={{ fontSize: "10px" }}>{k}</Badge>
                <span className="text-muted">{l}</span>
              </span>
            ))}
          </div>
        </Card.Body>
      </Card>

      {/* ─── MODALS ───────────────────────────────────────────────────────────── */}

      {/* Cari / Müşteri Seçim Modalı (Kayıtlı Cariler & Kayıtsız Müşteriler) */}
      <MusteriSecimModal
        show={showCariModal}
        onClose={() => setShowCariModal(false)}
        cariler={cariList}
        kayitsizMusteriler={kayitsizMusteriList}
        onSelectCustomer={handleSelectCustomer}
        currentUnvan={unvan}
      />

      {/* Fiş Ara Modalı (F3) */}
      <LookupModal<SarrafFisListItem>
        show={showFisModal}
        onHide={() => setShowFisModal(false)}
        title="Sarraf Fişi Ara (F3)"
        items={fisList}
        columns={fisColumns}
        filterFn={(item, term) => {
          const t = term.toLowerCase();
          return (item.fisNo || "").toLowerCase().includes(t) ||
                 (item.unvan || "").toLowerCase().includes(t) ||
                 (item.tarih || "").includes(t);
        }}
        onSelect={(item) => { setShowFisModal(false); loadFisById(item.sarrafFisiId); }}
      />

      {/* Vezne Seç Modalı */}
      <LookupModal<VezneItem>
        show={showVezneModal}
        onHide={() => setShowVezneModal(false)}
        title="Vezne Seç"
        items={vezneList}
        columns={vezneColumns}
        filterFn={(item, term) => {
          const t = term.toLowerCase();
          return item.kod.toLowerCase().includes(t) || item.ad.toLowerCase().includes(t);
        }}
        onSelect={async (item) => {
          setVezneId(item.id); setVezneKod(item.kod); setVezneAd(item.ad);
          setShowVezneModal(false);
          const bak = await SarrafFisService.getVezneBakiye(item.id).catch(() => []);
          setBakiyeler(bak);
        }}
      />

      {/* Ürün Seç Modalı */}
      <LookupModal<UrunItem>
        show={showUrunModal}
        onHide={() => { setShowUrunModal(false); setActiveRowIdForUrun(null); }}
        title="Ürün Seç (F4)"
        items={urunList}
        isLoading={isUrunLoading}
        columns={urunColumns}
        filterFn={(item, term) => {
          const t = (term || "").toLowerCase().trim();
          if (!t) return true;
          const k = (item.kod || "").toLowerCase();
          const a = (item.ad || "").toLowerCase();
          return k.includes(t) || a.includes(t);
        }}
        onSelect={(item) => {
          if (activeRowIdForUrun) {
            const curHasKuru = Number(altinHasKuru) || 0;
            setLines((prev) => prev.map((r) => {
              if (r.id !== activeRowIdForUrun) return r;
              const hasOrani = item.hasOrani || 0;
              const adet = Number(r.adet) || 1;
              const miktar = Number(item.gramaj) > 0 ? Number(item.gramaj) * adet : (Number(r.miktar) || 0);
              const iscilikiMiktari = item.iscilik ? Math.round(item.iscilik * 1000) : (Number(r.iscilikiMiktari) || 0);
              const milyem = hasOrani > 0 ? Math.round(hasOrani * 1000) : (Number(r.milyem) || 0);
              const updated: GridRow = {
                ...r,
                urunId: item.paraId,
                urunKodu: item.kod,
                urunAdi: item.ad,
                adet,
                miktar: miktar > 0 ? miktar : r.miktar,
                milyem,
                iscilikHesaplamaSekli: r.iscilikHesaplamaSekli !== "" ? r.iscilikHesaplamaSekli : 0,
                iscilikiMiktari: iscilikiMiktari > 0 ? iscilikiMiktari : r.iscilikiMiktari,
                urunTipi: item.urunTipi || 0,
                kur: Number(r.kur) > 0 ? r.kur : (curHasKuru > 0 ? curHasKuru : ""),
              };
              return recomputeRow(updated, curHasKuru);
            }));
            setTimeout(() => rowInputRefs.current[`${activeRowIdForUrun}_adet`]?.focus(), 20);
          }
          setShowUrunModal(false);
          setActiveRowIdForUrun(null);
        }}
      />

      {/* Silme Onay Modalı (F8) */}
      <Modal show={showDeleteConfirm} onHide={() => setShowDeleteConfirm(false)} centered size="sm">
        <Modal.Header closeButton className="py-2">
          <Modal.Title className="h6 mb-0">
            <IconAlertTriangle size={16} className="text-danger me-1" />
            Belgeyi Sil
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="small py-2">
          Belge <strong>#{fisNo || fisId}</strong> silinecektir. Emin misiniz?
        </Modal.Body>
        <Modal.Footer className="py-1">
          <Button size="sm" variant="secondary" onClick={() => setShowDeleteConfirm(false)}>İptal</Button>
          <Button size="sm" variant="danger" onClick={handleDelete}>Sil</Button>
        </Modal.Footer>
      </Modal>

      {/* ─── F5 Detay Modalı: Label solda, Input sağda, Enter/Yön Tuşları ile Geçiş ─ */}
      <Modal show={showDetayModal} onHide={() => setShowDetayModal(false)} centered size="lg">
        <Modal.Header closeButton className="py-2">
          <Modal.Title className="h6 mb-0 d-flex align-items-center">
            <IconBinoculars size={16} className="text-primary me-2" />
            Müşteri Detayı — F5
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3">
          <Row className="g-2">
            {/* Sol Kolon */}
            <Col xs={12} md={6}>
              <div className="d-flex align-items-center mb-2">
                <label style={{ width: 135, minWidth: 135, fontSize: "12px", fontWeight: 600 }}>Unvan / Ad Soyad</label>
                <Form.Control
                  ref={(el) => { detayRefs.current["unvan"] = el; }}
                  size="sm"
                  value={detayUnvan}
                  onChange={(e) => setDetayUnvan(e.target.value)}
                  onKeyDown={(e) => handleDetayKeyDown(e, "unvan")}
                  style={{ flex: 1 }}
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <label style={{ width: 135, minWidth: 135, fontSize: "12px", fontWeight: 600 }}>Kişilik Tipi</label>
                <Form.Select
                  ref={(el) => { detayRefs.current["kisilikTipi"] = el; }}
                  size="sm"
                  value={detayKisilikTipi}
                  onChange={(e) => setDetayKisilikTipi(Number(e.target.value))}
                  onKeyDown={(e) => handleDetayKeyDown(e, "kisilikTipi")}
                  style={{ flex: 1 }}
                >
                  <option value={0}>Gerçek Kişi</option>
                  <option value={1}>Tüzel Kişi</option>
                </Form.Select>
              </div>

              <div className="d-flex align-items-center mb-2">
                <label style={{ width: 135, minWidth: 135, fontSize: "12px", fontWeight: 600 }}>Kimlik Belge Türü</label>
                <Form.Select
                  ref={(el) => { detayRefs.current["kimlikBelgeTuru"] = el; }}
                  size="sm"
                  value={detayKimlikBelgeTuru}
                  onChange={(e) => setDetayKimlikBelgeTuru(Number(e.target.value))}
                  onKeyDown={(e) => handleDetayKeyDown(e, "kimlikBelgeTuru")}
                  style={{ flex: 1 }}
                >
                  <option value={0}>T.C. Kimlik</option>
                  <option value={1}>Pasaport</option>
                  <option value={2}>Ehliyet</option>
                </Form.Select>
              </div>

              <div className="d-flex align-items-center mb-2">
                <label style={{ width: 135, minWidth: 135, fontSize: "12px", fontWeight: 600 }}>Vergi / TC Kimlik</label>
                <InputGroup size="sm" style={{ flex: 1 }}>
                  <Form.Control
                    ref={(el) => { detayRefs.current["vergiKimlikNo"] = el; }}
                    value={detayVergiKimlikNo}
                    onChange={(e) => setDetayVergiKimlikNo(e.target.value.replace(/\D/g, ""))}
                    onKeyDown={(e) => handleDetayKeyDown(e, "vergiKimlikNo")}
                    maxLength={20}
                  />
                  <Button
                    variant="outline-danger"
                    className="px-2 py-0 d-flex align-items-center justify-content-center gap-1"
                    style={{ fontSize: "11px", fontWeight: 600 }}
                    onClick={() => handleSearchMasak(detayUnvan || unvan, detayVergiKimlikNo)}
                    disabled={isSearchingMasak}
                    title="Bu TC/VKN ile MASAK Listelerinde Sorgula"
                  >
                    {isSearchingMasak ? <Spinner animation="border" size="sm" /> : <IconShieldExclamation size={13} color="#dc2626" />}
                    <span>MASAK</span>
                  </Button>
                </InputGroup>
              </div>

              <div className="d-flex align-items-center mb-2">
                <label style={{ width: 135, minWidth: 135, fontSize: "12px", fontWeight: 600 }}>Kimlik Seri No</label>
                <Form.Control
                  ref={(el) => { detayRefs.current["kimlikSeriNo"] = el; }}
                  size="sm"
                  value={detayKimlikSeriNo}
                  onChange={(e) => setDetayKimlikSeriNo(e.target.value)}
                  onKeyDown={(e) => handleDetayKeyDown(e, "kimlikSeriNo")}
                  maxLength={20}
                  style={{ flex: 1 }}
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <label style={{ width: 135, minWidth: 135, fontSize: "12px", fontWeight: 600 }}>Pasaport No</label>
                <Form.Control
                  ref={(el) => { detayRefs.current["pasaportNo"] = el; }}
                  size="sm"
                  value={detayPasaportNo}
                  onChange={(e) => setDetayPasaportNo(e.target.value)}
                  onKeyDown={(e) => handleDetayKeyDown(e, "pasaportNo")}
                  maxLength={20}
                  style={{ flex: 1 }}
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <label style={{ width: 135, minWidth: 135, fontSize: "12px", fontWeight: 600 }}>Baba Adı</label>
                <Form.Control
                  ref={(el) => { detayRefs.current["babaAdi"] = el; }}
                  size="sm"
                  value={detayBabaAdi}
                  onChange={(e) => setDetayBabaAdi(e.target.value)}
                  onKeyDown={(e) => handleDetayKeyDown(e, "babaAdi")}
                  style={{ flex: 1 }}
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <label style={{ width: 135, minWidth: 135, fontSize: "12px", fontWeight: 600 }}>Anne Adı</label>
                <Form.Control
                  ref={(el) => { detayRefs.current["anneAdi"] = el; }}
                  size="sm"
                  value={detayAnneAdi}
                  onChange={(e) => setDetayAnneAdi(e.target.value)}
                  onKeyDown={(e) => handleDetayKeyDown(e, "anneAdi")}
                  style={{ flex: 1 }}
                />
              </div>
            </Col>

            {/* Sağ Kolon */}
            <Col xs={12} md={6}>
              <div className="d-flex align-items-center mb-2">
                <label style={{ width: 135, minWidth: 135, fontSize: "12px", fontWeight: 600 }}>Doğum Tarihi</label>
                <Form.Control
                  ref={(el) => { detayRefs.current["dogumTarihi"] = el; }}
                  type="date"
                  size="sm"
                  value={detayDogumTarihi}
                  onChange={(e) => setDetayDogumTarihi(e.target.value)}
                  onKeyDown={(e) => handleDetayKeyDown(e, "dogumTarihi")}
                  style={{ flex: 1 }}
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <label style={{ width: 135, minWidth: 135, fontSize: "12px", fontWeight: 600 }}>Doğum Yeri</label>
                <Form.Control
                  ref={(el) => { detayRefs.current["dogumYeri"] = el; }}
                  size="sm"
                  value={detayDogumYeri}
                  onChange={(e) => setDetayDogumYeri(e.target.value)}
                  onKeyDown={(e) => handleDetayKeyDown(e, "dogumYeri")}
                  style={{ flex: 1 }}
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <label style={{ width: 135, minWidth: 135, fontSize: "12px", fontWeight: 600 }}>Kimlik Geçerlilik</label>
                <Form.Control
                  ref={(el) => { detayRefs.current["kimlikGecerlilikTarihi"] = el; }}
                  type="date"
                  size="sm"
                  value={detayKimlikGecerlilikTarihi}
                  onChange={(e) => setDetayKimlikGecerlilikTarihi(e.target.value)}
                  onKeyDown={(e) => handleDetayKeyDown(e, "kimlikGecerlilikTarihi")}
                  style={{ flex: 1 }}
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <label style={{ width: 135, minWidth: 135, fontSize: "12px", fontWeight: 600 }}>Telefon</label>
                <Form.Control
                  ref={(el) => { detayRefs.current["telefonNo"] = el; }}
                  size="sm"
                  value={detayTelefonNo}
                  onChange={(e) => setDetayTelefonNo(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => handleDetayKeyDown(e, "telefonNo")}
                  style={{ flex: 1 }}
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <label style={{ width: 135, minWidth: 135, fontSize: "12px", fontWeight: 600 }}>Adres</label>
                <Form.Control
                  ref={(el) => { detayRefs.current["adres"] = el; }}
                  size="sm"
                  value={detayAdres}
                  onChange={(e) => setDetayAdres(e.target.value)}
                  onKeyDown={(e) => handleDetayKeyDown(e, "adres")}
                  style={{ flex: 1 }}
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <label style={{ width: 135, minWidth: 135, fontSize: "12px", fontWeight: 600 }}>E-posta</label>
                <Form.Control
                  ref={(el) => { detayRefs.current["eposta"] = el; }}
                  size="sm"
                  type="email"
                  value={detayEposta}
                  onChange={(e) => setDetayEposta(e.target.value)}
                  onKeyDown={(e) => handleDetayKeyDown(e, "eposta")}
                  style={{ flex: 1 }}
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <label style={{ width: 135, minWidth: 135, fontSize: "12px", fontWeight: 600 }}>Vekil Adı</label>
                <Form.Control
                  ref={(el) => { detayRefs.current["vekilAdi"] = el; }}
                  size="sm"
                  value={detayVekilAdi}
                  onChange={(e) => setDetayVekilAdi(e.target.value)}
                  onKeyDown={(e) => handleDetayKeyDown(e, "vekilAdi")}
                  style={{ flex: 1 }}
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <label style={{ width: 135, minWidth: 135, fontSize: "12px", fontWeight: 600 }}>Vekil Kimlik No</label>
                <Form.Control
                  ref={(el) => { detayRefs.current["vekilKimlikNo"] = el; }}
                  size="sm"
                  value={detayVekilKimlikNo}
                  onChange={(e) => setDetayVekilKimlikNo(e.target.value)}
                  onKeyDown={(e) => handleDetayKeyDown(e, "vekilKimlikNo")}
                  style={{ flex: 1 }}
                />
              </div>
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer className="py-1">
          <Button size="sm" variant="secondary" onClick={() => setShowDetayModal(false)}>İptal</Button>
          <Button size="sm" variant="success" onClick={handleSaveDetay}>
            <IconCheck size={14} className="me-1" />
            Uygula / Kaydet
          </Button>
        </Modal.Footer>
      </Modal>

      {/* MASAK Sorgulama Sonuç Modalı */}
      <MasakSonucModal
        show={masakModalOpen}
        onHide={() => setMasakModalOpen(false)}
        queriedName={masakResult.queriedName}
        queriedId={masakResult.queriedId}
        matches={masakResult.matches}
        searched={masakResult.searched}
        onOpenMasakManagement={() => setMasakManagementOpen(true)}
      />

      {/* MASAK Resmi Listeleri Yönetme / Güncelleme Modalı */}
      <MasakModal
        show={masakManagementOpen}
        onHide={() => setMasakManagementOpen(false)}
      />
    </div>
  );
};

export default SarrafFisiPage;
