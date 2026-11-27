import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { Table, Button, Badge, Alert, Modal, Dropdown } from "react-bootstrap";
import {
  IconBinoculars,
  IconCheck,
  IconAlertTriangle,
  IconInfoCircle,
  IconLock,
  IconColumns,
} from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import LookupModal, { LookupColumn } from "../../components/common/LookupModal";
import FisDurbunModal from "../../components/common/FisDurbunModal";
import { ParaUstuModal } from "./ParaUstuModal";
import { ParaItem, isDovizOrZiynetItem } from "./DovizFisiPage";
import { useAuth } from "../../context/AuthContext";
import { AuthService } from "../../services/authService";
import { apiClient } from "../../services/apiClient";
import { FastLookupCache } from "../../services/fastLookupCache";
import { KurService, KurRowItem } from "../../services/kurService";
import { CompanyService, TodvzTanimDto } from "../../services/companyService";
import { CashDeskService } from "../../services/cashDeskService";
import {
  DovizFisService,
  DovizFisModel,
  DovizFisListItem,
  SaveDovizFisPayload,
  IstatistikSecimItem,
} from "../../services/dovizFisService";
import { parseDecimal, parseKur, formatMiktar, formatTutar } from "../../utils/numericInput";
import { yerelGun } from "../../utils/fisTarihi";
import { dovizFisleriHtml } from "../../utils/belgeSablon/fisCikti";
import { fisiYazdir } from "../../utils/belgeSablon/yazdir";
import { useKullaniciYetkisi } from "../../hooks/useKullaniciYetkisi";
import { kurDegistirilebilir } from "../../../Backend/src/services/yetki/kullaniciYetkiKural";
import { isCtrlNEvent } from "../../utils/keyboardShortcuts";

const DEFAULT_CUSTOMER_NAME = "İsim beyan edilmemiştir";
const COL_VIS_STORAGE_KEY = "dovizSatirGrid_colVisibility_v1";

const DOVIZ_DURBUN_TIPLERI = [
  { deger: "0", ad: "Alış" },
  { deger: "1", ad: "Satış" },
  { deger: "arb", ad: "Arbitraj" },
];

interface SatirGridRow {
  id: string;
  fisId?: number | null;
  tip: 0 | 1; // 0: Alış, 1: Satış
  istatistikId: number | null;
  istatistikKodu: string;
  kurTuru: 0 | 1; // 0: Efektif, 1: Döviz
  paraId: number;
  paraKodu: string;
  paraAdi: string;
  urunTipi?: number;
  adet: string;
  miktar: string;
  kur: string;
  giseKuru: number;
  komisyonOrani: string;
  komisyon: string;
  bmvOrani: string;
  bmv: string;
  kmvOrani: string;
  kmv: string;
  tutar: string;
}

type CellCol =
  | "tip"
  | "istatistik"
  | "kurTuru"
  | "kod"
  | "adet"
  | "miktar"
  | "kur"
  | "komisyonOrani"
  | "tutar";

const CELL_ORDER: CellCol[] = [
  "tip",
  "istatistik",
  "kurTuru",
  "kod",
  "adet",
  "miktar",
  "kur",
  "komisyonOrani",
  "tutar",
];

type OptionalColKey =
  | "ad"
  | "adet"
  | "miktar"
  | "kur"
  | "komisyonOrani"
  | "komisyon"
  | "bmv"
  | "kmv"
  | "tutar";

const OPTIONAL_COL_LABELS: Array<{ key: OptionalColKey; label: string }> = [
  { key: "ad", label: "Ad" },
  { key: "adet", label: "Adet" },
  { key: "miktar", label: "Miktar" },
  { key: "kur", label: "Kur" },
  { key: "komisyonOrani", label: "Kom. %" },
  { key: "komisyon", label: "Komisyon" },
  { key: "bmv", label: "BMV" },
  { key: "kmv", label: "KMV" },
  { key: "tutar", label: "Tutar (TL)" },
];

let rowSeq = 1;
const nextRowId = () => `dg-row-${Date.now()}-${rowSeq++}`;

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

const getNowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
};

const pickDefaultIstatistik = (
  tipVal: 0 | 1,
  list: IstatistikSecimItem[],
  buyStatCode?: string,
  sellStatCode?: string
): IstatistikSecimItem | null => {
  const tipFiltered = list.filter((it) => Number(it.tip) === tipVal);
  const userStatKod = tipVal === 0 ? String(buyStatCode || "").trim() : String(sellStatCode || "").trim();
  if (userStatKod) {
    const byUser = tipFiltered.find(
      (it) =>
        String(it.kod || "").trim().toLowerCase() === userStatKod.toLowerCase() ||
        String(it.id) === userStatKod
    );
    if (byUser) return byUser;
  }
  return tipFiltered[0] || list[0] || null;
};

const buildEmptyRow = (
  tipVal: 0 | 1,
  kurTuruVal: 0 | 1,
  list: IstatistikSecimItem[],
  buyStatCode?: string,
  sellStatCode?: string
): SatirGridRow => {
  const defStat = pickDefaultIstatistik(tipVal, list, buyStatCode, sellStatCode);
  return {
    id: nextRowId(),
    fisId: null,
    tip: tipVal,
    istatistikId: defStat ? defStat.id : null,
    istatistikKodu: defStat ? defStat.kod : "",
    kurTuru: kurTuruVal,
    paraId: 0,
    paraKodu: "",
    paraAdi: "",
    urunTipi: 0,
    adet: "",
    miktar: "",
    kur: "",
    giseKuru: 0,
    komisyonOrani: defStat?.komisyonOrani ? formatMiktar(defStat.komisyonOrani) : "",
    komisyon: "",
    bmvOrani: tipVal === 1 && defStat?.bmvOrani ? formatMiktar(defStat.bmvOrani) : "",
    bmv: "",
    kmvOrani: tipVal === 1 && defStat?.kmvOrani ? formatMiktar(defStat.kmvOrani) : "",
    kmv: "",
    tutar: "",
  };
};

export const DovizFisiSatirGridPage: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isDuzeltmeMode = location.pathname.includes("duzeltme");

  const kYetki = useKullaniciYetkisi();
  const kurAcik = kurDegistirilebilir(kYetki);
  const userDovizZiynetGirisSekli = Number(
    user?.dovizZiynetGirisSekli ?? AuthService.getUser()?.dovizZiynetGirisSekli ?? 0
  );
  const isRecordLockedByUser = Boolean(
    user?.hasVezneLastTransactionsPerm && !user?.isSysAdmin
  );

  // Kolon görünürlüğü: Adet/Miktar kullanıcı ayarına göre (biri açık, diğeri kapalı); BMV & KMV varsayılan kapalı
  const defaultColVis = useMemo<Record<OptionalColKey, boolean>>(
    () => ({
      ad: true,
      adet: userDovizZiynetGirisSekli === 0,
      miktar: userDovizZiynetGirisSekli === 1,
      kur: true,
      komisyonOrani: true,
      komisyon: true,
      bmv: false,
      kmv: false,
      tutar: true,
    }),
    [userDovizZiynetGirisSekli]
  );

  const [colVisibility, setColVisibility] = useState<Record<OptionalColKey, boolean>>(() => {
    try {
      const saved = localStorage.getItem(COL_VIS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ad: parsed.ad !== undefined ? Boolean(parsed.ad) : true,
          adet: parsed.adet !== undefined ? Boolean(parsed.adet) : userDovizZiynetGirisSekli === 0,
          miktar: parsed.miktar !== undefined ? Boolean(parsed.miktar) : userDovizZiynetGirisSekli === 1,
          kur: parsed.kur !== undefined ? Boolean(parsed.kur) : true,
          komisyonOrani: parsed.komisyonOrani !== undefined ? Boolean(parsed.komisyonOrani) : true,
          komisyon: parsed.komisyon !== undefined ? Boolean(parsed.komisyon) : true,
          bmv: parsed.bmv !== undefined ? Boolean(parsed.bmv) : false,
          kmv: parsed.kmv !== undefined ? Boolean(parsed.kmv) : false,
          tutar: parsed.tutar !== undefined ? Boolean(parsed.tutar) : true,
        };
      }
    } catch {
      // ignore
    }
    return {
      ad: true,
      adet: userDovizZiynetGirisSekli === 0,
      miktar: userDovizZiynetGirisSekli === 1,
      kur: true,
      komisyonOrani: true,
      komisyon: true,
      bmv: false,
      kmv: false,
      tutar: true,
    };
  });

  const toggleColumn = useCallback((key: OptionalColKey) => {
    setColVisibility((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(COL_VIS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  // Lookups & Kurlar
  const [paraList, setParaList] = useState<ParaItem[]>([]);
  const [kurList, setKurList] = useState<KurRowItem[]>([]);
  const [istatistikList, setIstatistikList] = useState<IstatistikSecimItem[]>([]);
  const [tanim, setTanim] = useState<TodvzTanimDto | null>(null);
  const [vezneId, setVezneId] = useState<number>(1);
  const [vezneKod, setVezneKod] = useState<string>("01");
  const [vezneAd, setVezneAd] = useState<string>("");
  const [vezneList, setVezneList] = useState<{ id: number; kod: string; ad: string }[]>([]);
  const [topBalances, setTopBalances] = useState<{ tl: number; usd: number; eur: number }>({
    tl: 0,
    usd: 0,
    eur: 0,
  });

  // Düzeltme modu state
  const [fisList, setFisList] = useState<DovizFisListItem[]>([]);
  const [loadedFis, setLoadedFis] = useState<DovizFisModel | null>(null);
  const isLocked = Boolean(
    (isDuzeltmeMode && isRecordLockedByUser) || loadedFis?.gibeGonderildi
  );

  // Grid state (ilk açılışta hemen 1 satır hazır olsun ki Alış/Satış'a anında odaklansın)
  const [rows, setRows] = useState<SatirGridRow[]>(() => [
    buildEmptyRow(0, 0, [], user?.buyStatCode, user?.sellStatCode),
  ]);
  const [activeRowIndex, setActiveRowIndex] = useState<number>(0);
  const [invalidRowIds, setInvalidRowIds] = useState<Record<string, { kod?: boolean; qty?: boolean }>>({});
  const lastFocusedKodRef = useRef<string>("");

  // UI & Modals
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const [notification, setNotification] = useState<{
    type: "success" | "danger" | "warning" | "info";
    message: string;
  } | null>(null);

  const [showParaModal, setShowParaModal] = useState(false);
  const [paraModalRowId, setParaModalRowId] = useState<string | null>(null);
  const [paraSearchTerm, setParaSearchTerm] = useState("");

  const [showIstatistikModal, setShowIstatistikModal] = useState(false);
  const [istatistikModalRowId, setIstatistikModalRowId] = useState<string | null>(null);
  const [istatistikModalTip, setIstatistikModalTip] = useState<0 | 1>(0);
  const [istatistikSearchTerm, setIstatistikSearchTerm] = useState("");

  const [showFisSecimModal, setShowFisSecimModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showNewConfirm, setShowNewConfirm] = useState(false);

  const [paraUstuPrompt, setParaUstuPrompt] = useState<{
    toplam: number;
    resolve: (res: { alinanPara: number; paraUstu: number } | null) => void;
  } | null>(null);

  const showNotif = useCallback(
    (type: "success" | "danger" | "warning" | "info", message: string) => {
      setNotification({ type, message });
      setTimeout(() => {
        setNotification((prev) => (prev?.message === message ? null : prev));
      }, 3500);
    },
    []
  );

  const tlKurusSayisi = Math.max(2, Number((tanim as any)?.TL_KURUS_SAYISI ?? (tanim as any)?.tlKurusSayisi) || 2);
  const kurKurusSayisi = Number((tanim as any)?.KUR_KURUS_SAYISI ?? (tanim as any)?.kurKurusSayisi) || 4;
  const dovizKurusSayisi = Number((tanim as any)?.DOVIZ_KURUS_SAYISI ?? (tanim as any)?.dovizKurusSayisi) || 2;
  const kmvUygulamaSekli = Number((tanim as any)?.KMV_UYGULAMA_SEKLI ?? (tanim as any)?.kmvUygulamaSekli) || 0;

  const createEmptyRow = useCallback(
    (tipVal: 0 | 1 = 0, kurTuruVal: 0 | 1 = 0, list: IstatistikSecimItem[] = istatistikList) =>
      buildEmptyRow(tipVal, kurTuruVal, list, user?.buyStatCode, user?.sellStatCode),
    [istatistikList, user?.buyStatCode, user?.sellStatCode]
  );

  // Kur çözümü
  const resolveCurrencyRate = useCallback(
    (para: ParaItem | undefined | null, tipVal: 0 | 1, kurTuruVal: 0 | 1): number => {
      if (!para) return 0;
      const kodU = (para.kod || "").trim().toUpperCase();
      if (kodU === "TL" || kodU === "TRY" || kodU === "TRL") return 1;

      const kurRow = kurList.find(
        (k) =>
          Number(k.paraId) === Number(para.id) ||
          (k.kod || "").trim().toUpperCase() === kodU
      );
      if (kurRow) {
        if (kurTuruVal === 1) {
          const val = tipVal === 0 ? Number(kurRow.dovizAlis || 0) : Number(kurRow.dovizSatis || 0);
          if (val > 0) return val;
        }
        const ef = tipVal === 0 ? Number(kurRow.efektifAlis || 0) : Number(kurRow.efektifSatis || 0);
        if (ef > 0) return ef;
        const dv = tipVal === 0 ? Number(kurRow.dovizAlis || 0) : Number(kurRow.dovizSatis || 0);
        if (dv > 0) return dv;
      }

      if (kurTuruVal === 1) {
        const val = tipVal === 0 ? Number(para.dovizAlis || 0) : Number(para.dovizSatis || 0);
        if (val > 0) return val;
      }
      const ef = tipVal === 0 ? Number(para.efektifAlis || 0) : Number(para.efektifSatis || 0);
      if (ef > 0) return ef;
      return tipVal === 0 ? Number(para.dovizAlis || 0) : Number(para.dovizSatis || 0);
    },
    [kurList]
  );

  // Satır hesaplama
  const recalcRow = useCallback(
    (row: SatirGridRow): SatirGridRow => {
      const isPZ = isDovizOrZiynetItem(row.paraKodu, row.paraAdi, row.urunTipi);
      const qty =
        isPZ && userDovizZiynetGirisSekli === 0
          ? parseDecimal(row.adet || row.miktar)
          : parseDecimal(row.miktar || row.adet);
      const kurNum = parseKur(row.kur);
      const rawTutar = qty > 0 && kurNum > 0 ? round2(qty * kurNum) : 0;

      const komOran = parseDecimal(row.komisyonOrani);
      const komTutar = rawTutar > 0 && komOran > 0 ? round2((rawTutar * komOran) / 100) : 0;

      const bmvOran = row.tip === 1 ? parseDecimal(row.bmvOrani) : 0;
      const bmvTutar = row.tip === 1 && rawTutar > 0 && bmvOran > 0 ? round2((rawTutar * bmvOran) / 100) : 0;

      const kmvOran = row.tip === 1 ? parseDecimal(row.kmvOrani) : 0;
      let kmvTutar = 0;
      if (row.tip === 1 && rawTutar > 0 && kmvOran > 0) {
        const base = kmvUygulamaSekli === 1 ? rawTutar + komTutar : rawTutar;
        kmvTutar = round2((base * kmvOran) / 100);
      }

      return {
        ...row,
        komisyon: komTutar > 0 ? formatTutar(komTutar, tlKurusSayisi) : "",
        bmv: bmvTutar > 0 ? formatTutar(bmvTutar, tlKurusSayisi) : "",
        kmv: kmvTutar > 0 ? formatTutar(kmvTutar, tlKurusSayisi) : "",
        tutar: rawTutar > 0 ? formatTutar(rawTutar, tlKurusSayisi) : "",
      };
    },
    [userDovizZiynetGirisSekli, kmvUygulamaSekli, tlKurusSayisi]
  );

  // Vezne bakiyesi güncelle
  const refreshBalances = useCallback(async (vId: number) => {
    if (!vId) return;
    try {
      const b = await DovizFisService.getVezneBakiye(vId);
      setTopBalances({ tl: Number(b.tl) || 0, usd: Number(b.usd) || 0, eur: Number(b.eur) || 0 });
    } catch {
      // ignore
    }
  }, []);

  // Başlangıç verilerini yükle (STABİL bağımlılıklar — sonsuz döngü yok!)
  const buyStatCodeRef = useRef(user?.buyStatCode);
  const sellStatCodeRef = useRef(user?.sellStatCode);
  buyStatCodeRef.current = user?.buyStatCode;
  sellStatCodeRef.current = user?.sellStatCode;

  const loadLookupsAndList = useCallback(async () => {
    try {
      const [paralar, kurlar, istAlis, istSatis, tanimData, vezneler] = await Promise.all([
        FastLookupCache.get("paralar", () =>
          apiClient.get<ParaItem[]>("/para").then((r) => r.data || [])
        ).catch(() => []),
        KurService.getKurTablosu({ tur: 0 })
          .then((t) => t?.satirlar || [])
          .catch(() => []),
        DovizFisService.getIstatistikler(0).catch(() => []),
        DovizFisService.getIstatistikler(1).catch(() => []),
        CompanyService.getDefinitions().catch(() => null),
        CashDeskService.getVezneler().catch(() => []),
      ]);

      const mergedStats = [...(istAlis || []), ...(istSatis || [])];
      const uniqueStats = Array.from(new Map(mergedStats.map((s) => [s.id, s])).values());

      setParaList(Array.isArray(paralar) ? paralar : []);
      setKurList(Array.isArray(kurlar) ? kurlar : []);
      setIstatistikList(uniqueStats);
      setTanim(tanimData);
      setVezneList(
        Array.isArray(vezneler)
          ? vezneler.map((v: any) => ({ id: Number(v.id), kod: String(v.kod || ""), ad: String(v.ad || "") }))
          : []
      );

      const uVezneId = Number(user?.vezneId || 0);
      const foundVezne =
        (uVezneId && vezneler.find((v: any) => Number(v.id) === uVezneId)) ||
        (user?.cashierCode && vezneler.find((v: any) => String(v.kod) === String(user.cashierCode))) ||
        vezneler[0];
      const activeVezneId = foundVezne ? Number(foundVezne.id) : uVezneId || 1;
      setVezneId(activeVezneId);
      setVezneKod(foundVezne?.kod || user?.vezneKod || "01");
      setVezneAd(foundVezne?.ad || user?.vezneAd || "");
      refreshBalances(activeVezneId);

      if (isDuzeltmeMode) {
        const list = await DovizFisService.getFisList({ limit: 300 }).catch(() => []);
        setFisList(Array.isArray(list) ? list : []);
      }

      setRows((prev) => {
        if (prev.length === 0) {
          return [buildEmptyRow(0, 0, uniqueStats, buyStatCodeRef.current, sellStatCodeRef.current)];
        }
        // İlk boş satırda istatistik henüz atanmadıysa varsayılanı doldur
        if (prev.length === 1 && !prev[0].paraId && !prev[0].istatistikId) {
          const defStat = pickDefaultIstatistik(prev[0].tip, uniqueStats, buyStatCodeRef.current, sellStatCodeRef.current);
          if (defStat) {
            return [{
              ...prev[0],
              istatistikId: defStat.id,
              istatistikKodu: defStat.kod,
              komisyonOrani: defStat.komisyonOrani ? formatMiktar(defStat.komisyonOrani) : prev[0].komisyonOrani,
              bmvOrani: prev[0].tip === 1 && defStat.bmvOrani ? formatMiktar(defStat.bmvOrani) : prev[0].bmvOrani,
              kmvOrani: prev[0].tip === 1 && defStat.kmvOrani ? formatMiktar(defStat.kmvOrani) : prev[0].kmvOrani,
            }];
          }
        }
        return prev;
      });
    } catch (err: any) {
      showNotif("danger", err?.message || "Veriler yüklenemedi.");
    }
  }, [user?.vezneId, user?.cashierCode, user?.vezneKod, user?.vezneAd, isDuzeltmeMode, refreshBalances, showNotif]);

  useEffect(() => {
    loadLookupsAndList();
  }, [loadLookupsAndList]);

  // Hücre odağı yardımcısı
  const focusCell = useCallback((rowIndex: number, col: CellCol) => {
    setTimeout(() => {
      const el = document.getElementById(`dg-cell-${rowIndex}-${col}`) as
        | HTMLInputElement
        | HTMLSelectElement
        | null;
      if (el && !el.disabled) {
        el.focus();
        if (el instanceof HTMLInputElement) {
          el.select();
        }
      }
    }, 20);
  }, []);

  // Sayfa ilk açılınca otomatik Alış/Satış alanına odaklan
  useEffect(() => {
    const focusFirst = () => {
      const el = document.getElementById("dg-cell-0-tip") as HTMLSelectElement | null;
      if (el && !el.disabled) el.focus();
    };
    focusFirst();
    const t1 = window.setTimeout(focusFirst, 60);
    const t2 = window.setTimeout(focusFirst, 180);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  // Düzeltme modunda fiş yükle
  const loadFisById = useCallback(
    async (id: number) => {
      try {
        const fis = await DovizFisService.getFisById(id);
        if (!fis) return;
        setLoadedFis(fis);
        const fTip: 0 | 1 = Number(fis.tip) === 1 ? 1 : 0;
        const fKurTuru: 0 | 1 = Number(fis.kurTuru) === 1 ? 1 : 0;
        const statObj = istatistikList.find((s) => Number(s.id) === Number(fis.istatistikId));
        const loadedRows: SatirGridRow[] = (fis.satirlar || []).map((s) => {
          const paraObj = paraList.find((p) => Number(p.id) === Number(s.paraId));
          const isPZ = isDovizOrZiynetItem(s.paraKodu, s.paraAdi, paraObj?.urunTipi);
          const qtyStr = formatMiktar(s.miktar || 0);
          return {
            id: nextRowId(),
            fisId: fis.fisId,
            tip: fTip,
            istatistikId: fis.istatistikId ?? null,
            istatistikKodu: fis.istatistikKodu || statObj?.kod || "",
            kurTuru: fKurTuru,
            paraId: Number(s.paraId) || 0,
            paraKodu: (s.paraKodu || "").trim(),
            paraAdi: (s.paraAdi || "").trim(),
            urunTipi: paraObj?.urunTipi ?? 0,
            adet: isPZ && userDovizZiynetGirisSekli === 0 ? qtyStr : "",
            miktar: !isPZ || userDovizZiynetGirisSekli === 1 ? qtyStr : "",
            kur: s.kur ? formatTutar(s.kur, kurKurusSayisi) : "",
            giseKuru: Number(s.giseKuru || s.kur || 0),
            komisyonOrani: s.komisyonOrani ? formatMiktar(s.komisyonOrani) : "",
            komisyon: s.komisyon ? formatTutar(s.komisyon, tlKurusSayisi) : "",
            bmvOrani: s.bmvOrani ? formatMiktar(s.bmvOrani) : "",
            bmv: s.bmv ? formatTutar(s.bmv, tlKurusSayisi) : "",
            kmvOrani: s.kmvOrani ? formatMiktar(s.kmvOrani) : "",
            kmv: s.kmv ? formatTutar(s.kmv, tlKurusSayisi) : "",
            tutar: s.tutar ? formatTutar(s.tutar, tlKurusSayisi) : "",
          };
        });
        setRows(loadedRows.length > 0 ? loadedRows : [createEmptyRow(fTip, fKurTuru)]);
        setSearchParams({ id: String(fis.fisId) }, { replace: true });
        focusCell(0, "kod");
      } catch (err: any) {
        showNotif("danger", err?.message || "Fiş yüklenemedi.");
      }
    },
    [istatistikList, paraList, userDovizZiynetGirisSekli, kurKurusSayisi, tlKurusSayisi, createEmptyRow, setSearchParams, focusCell, showNotif]
  );

  // URL ?id= parametresi ile yükleme
  const urlLoadedRef = useRef(false);
  useEffect(() => {
    if (!isDuzeltmeMode || urlLoadedRef.current) return;
    const qId = Number(searchParams.get("id") || searchParams.get("fisId") || 0);
    if (qId > 0 && paraList.length > 0) {
      urlLoadedRef.current = true;
      loadFisById(qId);
    }
  }, [isDuzeltmeMode, searchParams, paraList.length, loadFisById]);

  // Yeni / Temizle
  const handleNew = useCallback(() => {
    setLoadedFis(null);
    setInvalidRowIds({});
    setRows([createEmptyRow(0, 0)]);
    setActiveRowIndex(0);
    focusCell(0, "tip");
  }, [createEmptyRow, focusCell]);

  // Grid modunda Ctrl+N veya Yeni Kayıt butonu için onay uyarısı
  const requestNew = useCallback(() => {
    setShowNewConfirm(true);
  }, []);

  // Satırda istatistik uygula
  const applyStatisticToRow = useCallback(
    (rowId: string, stat: IstatistikSecimItem | null) => {
      setRows((prev) =>
        prev.map((r) => {
          if (r.id !== rowId) return r;
          const next: SatirGridRow = {
            ...r,
            istatistikId: stat ? stat.id : null,
            istatistikKodu: stat ? stat.kod : "",
            komisyonOrani:
              kYetki.komisyonAlma && stat?.komisyonOrani
                ? formatMiktar(stat.komisyonOrani)
                : "",
            bmvOrani: r.tip === 1 && stat?.bmvOrani ? formatMiktar(stat.bmvOrani) : "",
            kmvOrani: r.tip === 1 && stat?.kmvOrani ? formatMiktar(stat.kmvOrani) : "",
          };
          return recalcRow(next);
        })
      );
    },
    [kYetki.komisyonAlma, recalcRow]
  );

  // Satırda para seçimi uygula
  const applyParaToRow = useCallback(
    (rowId: string, para: ParaItem, rowIndex: number) => {
      setRows((prev) =>
        prev.map((r) => {
          if (r.id !== rowId) return r;
          const autoRate = resolveCurrencyRate(para, r.tip, r.kurTuru);
          const next: SatirGridRow = {
            ...r,
            paraId: para.id,
            paraKodu: (para.kod || "").trim(),
            paraAdi: (para.ad || "").trim(),
            urunTipi: para.urunTipi ?? 0,
            giseKuru: autoRate,
            kur: autoRate > 0 ? formatTutar(autoRate, kurKurusSayisi) : r.kur,
          };
          return recalcRow(next);
        })
      );
      setInvalidRowIds((prev) => {
        if (!prev[rowId]?.kod) return prev;
        const next = { ...prev };
        next[rowId] = { ...next[rowId], kod: false };
        return next;
      });
      const isPZ = isDovizOrZiynetItem(para.kod, para.ad, para.urunTipi);
      const preferredCol: CellCol = isPZ && userDovizZiynetGirisSekli === 0 ? "adet" : "miktar";
      const targetCol: CellCol =
        preferredCol === "adet" && !colVisibility.adet
          ? (colVisibility.miktar ? "miktar" : "kur")
          : preferredCol === "miktar" && !colVisibility.miktar
          ? (colVisibility.adet ? "adet" : "kur")
          : preferredCol;
      focusCell(rowIndex, targetCol);
    },
    [resolveCurrencyRate, kurKurusSayisi, recalcRow, userDovizZiynetGirisSekli, colVisibility.adet, colVisibility.miktar, focusCell]
  );

  // Satır alan güncelleme
  const updateRowField = useCallback(
    (rowId: string, field: keyof SatirGridRow, value: any) => {
      setRows((prev) =>
        prev.map((r) => {
          if (r.id !== rowId) return r;
          let next: SatirGridRow = { ...r, [field]: value };

          if (field === "tip") {
            const newTip: 0 | 1 = Number(value) === 1 ? 1 : 0;
            const defStat = pickDefaultIstatistik(newTip, istatistikList, user?.buyStatCode, user?.sellStatCode);
            const paraObj = paraList.find((p) => Number(p.id) === Number(r.paraId));
            const newRate = paraObj ? resolveCurrencyRate(paraObj, newTip, r.kurTuru) : 0;
            next = {
              ...next,
              tip: newTip,
              istatistikId: defStat ? defStat.id : null,
              istatistikKodu: defStat ? defStat.kod : "",
              komisyonOrani:
                kYetki.komisyonAlma && defStat?.komisyonOrani
                  ? formatMiktar(defStat.komisyonOrani)
                  : "",
              bmvOrani: newTip === 1 && defStat?.bmvOrani ? formatMiktar(defStat.bmvOrani) : "",
              kmvOrani: newTip === 1 && defStat?.kmvOrani ? formatMiktar(defStat.kmvOrani) : "",
              giseKuru: newRate > 0 ? newRate : r.giseKuru,
              kur: newRate > 0 ? formatTutar(newRate, kurKurusSayisi) : r.kur,
            };
            return recalcRow(next);
          }

          if (field === "kurTuru") {
            const newKT: 0 | 1 = Number(value) === 1 ? 1 : 0;
            const paraObj = paraList.find((p) => Number(p.id) === Number(r.paraId));
            const newRate = paraObj ? resolveCurrencyRate(paraObj, r.tip, newKT) : 0;
            next = {
              ...next,
              kurTuru: newKT,
              giseKuru: newRate > 0 ? newRate : r.giseKuru,
              kur: newRate > 0 ? formatTutar(newRate, kurKurusSayisi) : r.kur,
            };
            return recalcRow(next);
          }

          if (field === "tutar") {
            const tNum = parseDecimal(value);
            const kurNum = parseKur(r.kur);
            const isPZ = isDovizOrZiynetItem(r.paraKodu, r.paraAdi, r.urunTipi);
            if (tNum > 0 && kurNum > 0) {
              const calcQty = tNum / kurNum;
              const formattedQty = formatMiktar(Number(calcQty.toFixed(dovizKurusSayisi)));
              if (isPZ && userDovizZiynetGirisSekli === 0) {
                next.adet = formattedQty;
              } else {
                next.miktar = formattedQty;
              }
            }
            return next;
          }

          if (
            field === "adet" ||
            field === "miktar" ||
            field === "kur" ||
            field === "komisyonOrani"
          ) {
            if (field === "adet" || field === "miktar") {
              if (parseDecimal(value) > 0) {
                setInvalidRowIds((inv) => {
                  if (!inv[rowId]?.qty) return inv;
                  return { ...inv, [rowId]: { ...inv[rowId], qty: false } };
                });
              }
            }
            return recalcRow(next);
          }

          if (field === "paraKodu") {
            const trimmed = String(value || "").trim();
            if (!trimmed) {
              next.paraId = 0;
              next.paraAdi = "";
              next.kur = "";
              next.tutar = "";
            }
          }

          return next;
        })
      );
    },
    [
      istatistikList,
      user?.buyStatCode,
      user?.sellStatCode,
      paraList,
      resolveCurrencyRate,
      kYetki.komisyonAlma,
      kurKurusSayisi,
      dovizKurusSayisi,
      userDovizZiynetGirisSekli,
      recalcRow,
    ]
  );

  // Satır ekle / sil
  const addNewRow = useCallback(
    (focusAfter = true) => {
      const last = rows[rows.length - 1];
      const newRow = createEmptyRow(last?.tip ?? 0, last?.kurTuru ?? 0);
      const nextIdx = rows.length;
      setRows((prev) => [...prev, newRow]);
      setActiveRowIndex(nextIdx);
      if (focusAfter) focusCell(nextIdx, "tip");
    },
    [rows, createEmptyRow, focusCell]
  );

  const removeRow = useCallback(
    (rowId: string) => {
      setInvalidRowIds((prev) => {
        if (!prev[rowId]) return prev;
        const next = { ...prev };
        delete next[rowId];
        return next;
      });
      setRows((prev) => {
        const filtered = prev.filter((r) => r.id !== rowId);
        return filtered.length > 0 ? filtered : [createEmptyRow(0, 0)];
      });
    },
    [createEmptyRow]
  );

  // Yeni satır eklemeden önce Kod ve Adet/Miktar doğrulaması
  const validateRowBeforeAdd = useCallback(
    (row: SatirGridRow, rowIndex: number): boolean => {
      const hasKod = Boolean(row.paraId && row.paraKodu.trim());
      const isPZ = isDovizOrZiynetItem(row.paraKodu, row.paraAdi, row.urunTipi);
      const qty =
        isPZ && userDovizZiynetGirisSekli === 0
          ? parseDecimal(row.adet || row.miktar)
          : parseDecimal(row.miktar || row.adet);
      const hasQty = qty > 0;

      if (!hasKod || !hasQty) {
        setInvalidRowIds((prev) => ({
          ...prev,
          [row.id]: { kod: !hasKod, qty: !hasQty },
        }));
        if (!hasKod) {
          focusCell(rowIndex, "kod");
        } else {
          const qtyCol: CellCol =
            isPZ && userDovizZiynetGirisSekli === 0
              ? (colVisibility.adet ? "adet" : "miktar")
              : (colVisibility.miktar ? "miktar" : "adet");
          focusCell(rowIndex, qtyCol);
        }
        return false;
      }

      setInvalidRowIds((prev) => {
        if (!prev[row.id]) return prev;
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
      return true;
    },
    [userDovizZiynetGirisSekli, colVisibility.adet, colVisibility.miktar, focusCell]
  );

  // Hücrenin görünür ve odaklanabilir olup olmadığını kontrol et
  const isCellFocusable = useCallback(
    (row: SatirGridRow, col: CellCol): boolean => {
      const isPZ = isDovizOrZiynetItem(row.paraKodu, row.paraAdi, row.urunTipi);
      if (col === "adet") return colVisibility.adet && isPZ && userDovizZiynetGirisSekli === 0;
      if (col === "miktar") return colVisibility.miktar && !(isPZ && userDovizZiynetGirisSekli === 0);
      if (col === "kur") return colVisibility.kur && kurAcik;
      if (col === "komisyonOrani") return colVisibility.komisyonOrani && kYetki.komisyonAlma;
      if (col === "tutar") return colVisibility.tutar;
      return true;
    },
    [colVisibility, userDovizZiynetGirisSekli, kurAcik, kYetki.komisyonAlma]
  );

  // Hücre klavye gezinme (Enter, Yön tuşları, F4)
  const handleCellKeyDown = useCallback(
    (
      e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>,
      rowIndex: number,
      col: CellCol
    ) => {
      const row = rows[rowIndex];
      if (!row) return;

      if (e.key === "F4") {
        if (col === "kod") {
          e.preventDefault();
          e.stopPropagation();
          setParaModalRowId(row.id);
          setParaSearchTerm((row.paraKodu || "").trim());
          setShowParaModal(true);
          return;
        }
        if (col === "istatistik") {
          e.preventDefault();
          e.stopPropagation();
          setIstatistikModalRowId(row.id);
          setIstatistikModalTip(row.tip);
          setIstatistikSearchTerm((row.istatistikKodu || "").trim());
          setShowIstatistikModal(true);
          return;
        }
      }

      if (col === "tip" && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        updateRowField(row.id, "tip", 0);
        return;
      }
      if (col === "tip" && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        updateRowField(row.id, "tip", 1);
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();

        if (col === "istatistik") {
          const val = (row.istatistikKodu || "").trim().toLowerCase();
          const tipList = istatistikList.filter((it) => Number(it.tip) === row.tip);
          if (val) {
            const exact = tipList.find((it) => (it.kod || "").trim().toLowerCase() === val);
            if (exact) {
              applyStatisticToRow(row.id, exact);
              focusCell(rowIndex, "kurTuru");
              return;
            }
            const matches = tipList.filter(
              (it) =>
                (it.kod || "").toLowerCase().includes(val) ||
                (it.ad || "").toLowerCase().includes(val)
            );
            if (matches.length === 1) {
              applyStatisticToRow(row.id, matches[0]);
              focusCell(rowIndex, "kurTuru");
              return;
            }
            setIstatistikModalRowId(row.id);
            setIstatistikModalTip(row.tip);
            setIstatistikSearchTerm(row.istatistikKodu.trim());
            setShowIstatistikModal(true);
            return;
          }
          focusCell(rowIndex, "kurTuru");
          return;
        }

        if (col === "kod") {
          const val = (row.paraKodu || "").trim().toLowerCase();
          const prevVal = (lastFocusedKodRef.current || "").trim().toLowerCase();
          // Boşsa veya içerisindeki kayıt değişmemiş ise modal açmadan sonraki hücreye geç
          if (!val || (row.paraId > 0 && val === prevVal)) {
            const curIdx = CELL_ORDER.indexOf("kod");
            for (let i = curIdx + 1; i < CELL_ORDER.length; i++) {
              if (isCellFocusable(row, CELL_ORDER[i])) {
                focusCell(rowIndex, CELL_ORDER[i]);
                return;
              }
            }
            return;
          }
          const exact = paraList.find((p) => (p.kod || "").trim().toLowerCase() === val);
          if (exact) {
            lastFocusedKodRef.current = (exact.kod || "").trim();
            applyParaToRow(row.id, exact, rowIndex);
            return;
          }
          const matches = paraList.filter(
            (p) =>
              (p.kod || "").toLowerCase().includes(val) ||
              (p.ad || "").toLowerCase().includes(val)
          );
          if (matches.length === 1) {
            lastFocusedKodRef.current = (matches[0].kod || "").trim();
            applyParaToRow(row.id, matches[0], rowIndex);
            return;
          }
          setParaModalRowId(row.id);
          setParaSearchTerm(row.paraKodu.trim());
          setShowParaModal(true);
          return;
        }

        const curIdx = CELL_ORDER.indexOf(col);
        for (let i = curIdx + 1; i < CELL_ORDER.length; i++) {
          const nextCol = CELL_ORDER[i];
          if (isCellFocusable(row, nextCol)) {
            focusCell(rowIndex, nextCol);
            return;
          }
        }

        // Satır sonunda Enter → alt satıra geç veya doğrulanmışsa yeni satır aç
        if (rowIndex < rows.length - 1) {
          setActiveRowIndex(rowIndex + 1);
          focusCell(rowIndex + 1, "tip");
        } else if (validateRowBeforeAdd(row, rowIndex)) {
          addNewRow(true);
        }
        return;
      }

      if (e.key === "ArrowRight") {
        const el = e.currentTarget;
        if (
          el instanceof HTMLInputElement &&
          el.selectionStart !== null &&
          el.selectionEnd !== null &&
          el.selectionStart === el.selectionEnd &&
          el.selectionEnd < el.value.length
        ) {
          return;
        }
        e.preventDefault();
        const curIdx = CELL_ORDER.indexOf(col);
        for (let i = curIdx + 1; i < CELL_ORDER.length; i++) {
          if (isCellFocusable(row, CELL_ORDER[i])) {
            focusCell(rowIndex, CELL_ORDER[i]);
            return;
          }
        }
      } else if (e.key === "ArrowLeft") {
        const el = e.currentTarget;
        if (
          el instanceof HTMLInputElement &&
          el.selectionStart !== null &&
          el.selectionEnd !== null &&
          el.selectionStart === el.selectionEnd &&
          el.selectionStart > 0
        ) {
          return;
        }
        e.preventDefault();
        const curIdx = CELL_ORDER.indexOf(col);
        for (let i = curIdx - 1; i >= 0; i--) {
          if (isCellFocusable(row, CELL_ORDER[i])) {
            focusCell(rowIndex, CELL_ORDER[i]);
            return;
          }
        }
      } else if (e.key === "ArrowDown") {
        if (e.currentTarget instanceof HTMLSelectElement && !e.altKey) return;
        e.preventDefault();
        if (rowIndex < rows.length - 1) {
          setActiveRowIndex(rowIndex + 1);
          focusCell(rowIndex + 1, col);
        } else if (validateRowBeforeAdd(row, rowIndex)) {
          addNewRow(true);
        }
      } else if (e.key === "ArrowUp") {
        if (e.currentTarget instanceof HTMLSelectElement && !e.altKey) return;
        e.preventDefault();
        if (rowIndex > 0) {
          setActiveRowIndex(rowIndex - 1);
          focusCell(rowIndex - 1, col);
        }
      }
    },
    [
      rows,
      istatistikList,
      paraList,
      updateRowField,
      applyStatisticToRow,
      applyParaToRow,
      isCellFocusable,
      focusCell,
      validateRowBeforeAdd,
      addNewRow,
    ]
  );

  // Dolu satır kontrolü
  const isRowFilled = useCallback(
    (r: SatirGridRow) => {
      if (!r.paraId) return false;
      const isPZ = isDovizOrZiynetItem(r.paraKodu, r.paraAdi, r.urunTipi);
      const qty =
        isPZ && userDovizZiynetGirisSekli === 0
          ? parseDecimal(r.adet || r.miktar)
          : parseDecimal(r.miktar || r.adet);
      const kurNum = parseKur(r.kur);
      return qty > 0 && kurNum > 0;
    },
    [userDovizZiynetGirisSekli]
  );

  // Toplamlar
  const totals = useMemo(() => {
    let alisCount = 0;
    let satisCount = 0;
    let alisTutar = 0;
    let satisTutar = 0;
    let komisyon = 0;
    let bmv = 0;
    let kmv = 0;
    for (const r of rows) {
      if (!isRowFilled(r)) continue;
      const t = parseDecimal(r.tutar);
      const k = parseDecimal(r.komisyon);
      const b = parseDecimal(r.bmv);
      const km = parseDecimal(r.kmv);
      komisyon += k;
      bmv += b;
      kmv += km;
      if (r.tip === 0) {
        alisCount++;
        alisTutar += Math.max(0, t - k);
      } else {
        satisCount++;
        satisTutar += t + k + b + km;
      }
    }
    return {
      alisCount,
      satisCount,
      alisTutar: round2(alisTutar),
      satisTutar: round2(satisTutar),
      komisyon: round2(komisyon),
      bmv: round2(bmv),
      kmv: round2(kmv),
    };
  }, [rows, isRowFilled]);

  // Toplu Kaydet (F1 / F10)
  const handleSave = useCallback(
    async (andDirectPrint: boolean = false) => {
      if (savingRef.current || isLocked) return;

      const filledRows = rows.filter(isRowFilled);
      if (filledRows.length === 0) {
        showNotif("warning", "Kaydedilecek geçerli bir satır giriniz (Kod, Miktar ve Kur zorunludur).");
        focusCell(0, "kod");
        return;
      }

      const paraUstuAktif = (user?.paraUstuVar ?? AuthService.getUser()?.paraUstuVar) !== false;
      const satisToplami = filledRows
        .filter((r) => r.tip === 1)
        .reduce(
          (acc, r) =>
            acc +
            parseDecimal(r.tutar) +
            parseDecimal(r.komisyon) +
            parseDecimal(r.bmv) +
            parseDecimal(r.kmv),
          0
        );

      let alinanParaVal = 0;
      let paraUstuVal = 0;
      if (andDirectPrint && satisToplami > 0 && paraUstuAktif) {
        const puRes = await new Promise<{ alinanPara: number; paraUstu: number } | null>((resolve) => {
          setParaUstuPrompt({ toplam: round2(satisToplami), resolve });
        });
        if (!puRes) return;
        alinanParaVal = puRes.alinanPara;
        paraUstuVal = puRes.paraUstu;
      }

      savingRef.current = true;
      setIsSaving(true);

      try {
        const tarih = isDuzeltmeMode && loadedFis?.tarih
          ? String(loadedFis.tarih).slice(0, 10)
          : yerelGun();
        const saat = isDuzeltmeMode && loadedFis?.zaman ? loadedFis.zaman : getNowTime();
        const savedList: DovizFisModel[] = [];

        const existingFisRows = isDuzeltmeMode && loadedFis
          ? filledRows.filter((r) => r.fisId === loadedFis.fisId)
          : [];
        const newSeparateRows = isDuzeltmeMode && loadedFis
          ? filledRows.filter((r) => r.fisId !== loadedFis.fisId)
          : filledRows;

        const buildSatirPayload = (r: SatirGridRow, idx: number) => {
          const isPZ = isDovizOrZiynetItem(r.paraKodu, r.paraAdi, r.urunTipi);
          const qty =
            isPZ && userDovizZiynetGirisSekli === 0
              ? parseDecimal(r.adet || r.miktar)
              : parseDecimal(r.miktar || r.adet);
          const kurNum = parseKur(r.kur);
          const tutarNum = parseDecimal(r.tutar) || round2(qty * kurNum);
          const komOran = parseDecimal(r.komisyonOrani);
          const komNum = parseDecimal(r.komisyon);
          const bmvOran = r.tip === 1 ? parseDecimal(r.bmvOrani) : 0;
          const bmvNum = r.tip === 1 ? parseDecimal(r.bmv) : 0;
          const kmvOran = r.tip === 1 ? parseDecimal(r.kmvOrani) : 0;
          const kmvNum = r.tip === 1 ? parseDecimal(r.kmv) : 0;
          return {
            satirNo: idx,
            paraId: r.paraId,
            paraKodu: r.paraKodu,
            paraAdi: r.paraAdi,
            miktar: qty,
            kur: kurNum,
            iscilik: 0,
            giseKuru: r.giseKuru || kurNum,
            tutar: tutarNum,
            komisyonOrani: komOran,
            komisyon: komNum,
            bmvOrani: bmvOran,
            bmv: bmvNum,
            kmvOrani: kmvOran,
            kmv: kmvNum,
            kdvOrani: 0,
            kdv: 0,
          };
        };

        if (existingFisRows.length > 0 && loadedFis) {
          const firstRow = existingFisRows[0];
          const satirlar = existingFisRows.map((r, i) => buildSatirPayload(r, i));
          const toplamTutar = round2(satirlar.reduce((a, s) => a + s.tutar, 0));
          const toplamEk = round2(
            satirlar.reduce((a, s) => a + s.bmv + s.kmv + (firstRow.tip === 1 ? s.komisyon : -s.komisyon), 0)
          );
          const odemeTutari = round2(Math.max(0, toplamTutar + toplamEk));
          const payload: SaveDovizFisPayload = {
            fisId: loadedFis.fisId,
            vezneId: loadedFis.vezneId || vezneId,
            tip: firstRow.tip,
            tarih,
            zaman: saat,
            seriNo: loadedFis.seriNo,
            belgeNo: loadedFis.belgeNo,
            kurTuru: firstRow.kurTuru,
            istatistikId: firstRow.istatistikId,
            cariKartId: loadedFis.cariKartId ?? null,
            unvan: loadedFis.unvan || DEFAULT_CUSTOMER_NAME,
            kisilikTipi: loadedFis.kisilikTipi ?? 0,
            toplamTutar,
            yuvarlama: 0,
            odemeTutari,
            alinanPara: firstRow.tip === 1 ? alinanParaVal : 0,
            paraUstu: firstRow.tip === 1 ? paraUstuVal : 0,
            masakListesindeVar: false,
            kullaniciId: Number(user?.id) || undefined,
            satirlar,
          };
          const saved = await DovizFisService.saveFis(payload);
          savedList.push(saved);
        }

        for (const r of newSeparateRows) {
          const satir = buildSatirPayload(r, 0);
          const toplamTutar = satir.tutar;
          const odemeTutari = round2(
            r.tip === 1
              ? toplamTutar + satir.bmv + satir.kmv + satir.komisyon
              : Math.max(0, toplamTutar - satir.komisyon)
          );
          const payload: SaveDovizFisPayload = {
            vezneId,
            tip: r.tip,
            tarih,
            zaman: saat,
            kurTuru: r.kurTuru,
            istatistikId: r.istatistikId,
            cariKartId: null,
            unvan: DEFAULT_CUSTOMER_NAME,
            kisilikTipi: 0,
            toplamTutar,
            yuvarlama: 0,
            odemeTutari,
            alinanPara: r.tip === 1 ? alinanParaVal : 0,
            paraUstu: r.tip === 1 ? paraUstuVal : 0,
            masakListesindeVar: false,
            kullaniciId: Number(user?.id) || undefined,
            satirlar: [satir],
          };
          const saved = await DovizFisService.saveFis(payload);
          savedList.push(saved);
        }

        showNotif(
          "success",
          isDuzeltmeMode
            ? `Fiş güncellendi (${savedList.length} kayıt).`
            : `${savedList.length} adet döviz fişi kaydedildi.`
        );

        if (andDirectPrint && savedList.length > 0) {
          for (const sf of savedList) {
            try {
              const html = await dovizFisleriHtml({
                fisId: sf.fisId,
                tip: sf.tip,
                tarih: sf.tarih,
                saat: sf.zaman,
                seriNo: sf.seriNo,
                belgeNo: sf.belgeNo,
                unvan: sf.unvan || DEFAULT_CUSTOMER_NAME,
                vergiKimlikNo: sf.vergiKimlikNo || "",
                vezneKod,
                istatistikKodu: sf.istatistikKodu || "",
                lines: (sf.satirlar || []).map((l) => ({
                  paraKodu: l.paraKodu,
                  paraAdi: l.paraAdi,
                  miktar: l.miktar,
                  kur: l.kur,
                  tutar: l.tutar,
                  bmv: l.bmv,
                  kmv: l.kmv,
                  kmvOrani: l.kmvOrani,
                  komisyon: l.komisyon,
                  seriNo: l.seriNo,
                  belgeNo: l.belgeNo,
                  ettn: l.ettn,
                })),
                toplamTutar: sf.toplamTutar,
                odemeTutari: sf.odemeTutari,
                alinanPara: sf.alinanPara,
                paraUstu: sf.paraUstu,
                dovizKurusSayisi,
                kurKurusSayisi,
                tlKurusSayisi,
              });
              await fisiYazdir(html, {
                printerId: Number(user?.printerId) || null,
                copies: 1,
                isPos: true,
              });
            } catch {
              // yazdırma hatası kaydı geri almaz
            }
          }
        }

        refreshBalances(vezneId);

        if (isDuzeltmeMode) {
          const list = await DovizFisService.getFisList({ limit: 300 }).catch(() => []);
          setFisList(Array.isArray(list) ? list : []);
          if (savedList[0]?.fisId) {
            await loadFisById(savedList[0].fisId);
          }
        } else {
          handleNew();
        }
      } catch (err: any) {
        showNotif("danger", err?.message || "Kayıt sırasında hata oluştu.");
      } finally {
        savingRef.current = false;
        setIsSaving(false);
      }
    },
    [
      isLocked,
      rows,
      isRowFilled,
      user?.paraUstuVar,
      user?.id,
      user?.printerId,
      isDuzeltmeMode,
      loadedFis,
      userDovizZiynetGirisSekli,
      vezneId,
      vezneKod,
      dovizKurusSayisi,
      kurKurusSayisi,
      tlKurusSayisi,
      refreshBalances,
      loadFisById,
      handleNew,
      focusCell,
      showNotif,
    ]
  );

  // Sil (Düzeltme modu)
  const handleDelete = useCallback(async () => {
    if (!loadedFis?.fisId || isLocked) return;
    try {
      await DovizFisService.deleteFis(loadedFis.fisId);
      setShowDeleteConfirm(false);
      showNotif("success", `#${loadedFis.belgeNo || loadedFis.fisId} fişi silindi.`);
      refreshBalances(vezneId);
      const list = await DovizFisService.getFisList({ limit: 300 }).catch(() => []);
      setFisList(Array.isArray(list) ? list : []);
      handleNew();
    } catch (err: any) {
      setShowDeleteConfirm(false);
      showNotif("danger", err?.message || "Fiş silinemedi.");
    }
  }, [loadedFis, isLocked, vezneId, refreshBalances, handleNew, showNotif]);

  // Gezinme (Düzeltme modu)
  const currentFisIdx = useMemo(
    () => (loadedFis ? fisList.findIndex((f) => Number(f.fisId) === Number(loadedFis.fisId)) : -1),
    [fisList, loadedFis]
  );

  const handleFirst = useCallback(() => {
    if (fisList.length > 0) loadFisById(fisList[0].fisId);
  }, [fisList, loadFisById]);

  const handleLast = useCallback(() => {
    if (fisList.length > 0) loadFisById(fisList[fisList.length - 1].fisId);
  }, [fisList, loadFisById]);

  const handlePrev = useCallback(() => {
    if (fisList.length === 0) return;
    if (currentFisIdx <= 0) {
      loadFisById(fisList[0].fisId);
      return;
    }
    loadFisById(fisList[currentFisIdx - 1].fisId);
  }, [fisList, currentFisIdx, loadFisById]);

  const handleNext = useCallback(() => {
    if (fisList.length === 0) return;
    if (currentFisIdx === -1) {
      loadFisById(fisList[0].fisId);
      return;
    }
    if (currentFisIdx >= fisList.length - 1) return;
    loadFisById(fisList[currentFisIdx + 1].fisId);
  }, [fisList, currentFisIdx, loadFisById]);

  // Global sağ tık menüsü (ERPContextMenu: Satır İşlemleri -> Satırı Sil / Yeni Satır Ekle)
  useEffect(() => {
    const handleGridDelete = (e: any) => {
      if (isLocked) return;
      const rowId = e.detail?.rowId;
      if (rowId) {
        removeRow(rowId);
      }
    };
    const handleGridAdd = () => {
      if (isLocked) return;
      const lastIdx = rows.length - 1;
      if (lastIdx >= 0 && validateRowBeforeAdd(rows[lastIdx], lastIdx)) {
        addNewRow(true);
      }
    };
    window.addEventListener("erp-grid-row-delete", handleGridDelete);
    window.addEventListener("erp-grid-row-add", handleGridAdd);
    return () => {
      window.removeEventListener("erp-grid-row-delete", handleGridDelete);
      window.removeEventListener("erp-grid-row-add", handleGridAdd);
    };
  }, [isLocked, removeRow, rows, validateRowBeforeAdd, addNewRow]);

  // Global kısayollar
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        showParaModal ||
        showIstatistikModal ||
        showFisSecimModal ||
        showDeleteConfirm ||
        showNewConfirm ||
        paraUstuPrompt !== null
      ) {
        return;
      }
      if (!isDuzeltmeMode && isCtrlNEvent(e)) {
        e.preventDefault();
        e.stopPropagation();
        requestNew();
        return;
      }
      if (e.key === "F1") {
        e.preventDefault();
        if (!e.repeat && !savingRef.current) handleSave(false);
      } else if (e.key === "F10") {
        e.preventDefault();
        if (!e.repeat && !savingRef.current) handleSave(true);
      } else if (e.key === "F2" && isDuzeltmeMode && loadedFis?.fisId && !isLocked) {
        e.preventDefault();
        setShowDeleteConfirm(true);
      } else if (e.key === "F3" && isDuzeltmeMode) {
        e.preventDefault();
        setShowFisSecimModal(true);
      } else if (e.key === "F4" && !isDuzeltmeMode) {
        const activeId = (document.activeElement as HTMLElement | null)?.id || "";
        if (activeId.endsWith("-kod") || activeId.endsWith("-istatistik")) {
          return;
        }
        e.preventDefault();
        requestNew();
      } else if (isDuzeltmeMode && e.key === "PageUp") {
        e.preventDefault();
        handlePrev();
      } else if (isDuzeltmeMode && e.key === "PageDown") {
        e.preventDefault();
        handleNext();
      }
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [
    showParaModal,
    showIstatistikModal,
    showFisSecimModal,
    showDeleteConfirm,
    showNewConfirm,
    paraUstuPrompt,
    isDuzeltmeMode,
    loadedFis?.fisId,
    isLocked,
    handleSave,
    requestNew,
    handlePrev,
    handleNext,
  ]);

  // Lookup kolonları
  const paraColumns: LookupColumn<ParaItem>[] = useMemo(
    () => [
      {
        header: "Kod",
        width: "90px",
        render: (p) => <span className="font-monospace fw-bold text-primary">{p.kod}</span>,
      },
      { header: "Para / Ürün Adı", render: (p) => <span className="fw-medium">{p.ad}</span> },
      {
        header: "Alış",
        width: "110px",
        align: "right",
        render: (p) => {
          const r = resolveCurrencyRate(p, 0, 0);
          return <span className="font-monospace text-success">{r > 0 ? formatTutar(r, kurKurusSayisi) : "-"}</span>;
        },
      },
      {
        header: "Satış",
        width: "110px",
        align: "right",
        render: (p) => {
          const r = resolveCurrencyRate(p, 1, 0);
          return <span className="font-monospace text-danger">{r > 0 ? formatTutar(r, kurKurusSayisi) : "-"}</span>;
        },
      },
    ],
    [resolveCurrencyRate, kurKurusSayisi]
  );

  const istatistikColumns: LookupColumn<IstatistikSecimItem>[] = useMemo(
    () => [
      {
        header: "Kod",
        width: "90px",
        render: (s) => <span className="font-monospace fw-bold text-primary">{s.kod}</span>,
      },
      { header: "Ad", render: (s) => <span className="fw-medium">{s.ad}</span> },
      {
        header: "Tip",
        width: "80px",
        align: "center",
        render: (s) => (
          <Badge bg={Number(s.tip) === 1 ? "danger" : "success"}>
            {Number(s.tip) === 1 ? "Satış" : "Alış"}
          </Badge>
        ),
      },
    ],
    []
  );

  const fisDurbunColumns: LookupColumn<DovizFisListItem>[] = useMemo(
    () => [
      {
        header: "Belge No",
        width: "120px",
        render: (f) => <span className="font-monospace fw-bold text-primary">{f.belgeNo || `#${f.fisId}`}</span>,
      },
      {
        header: "Tarih",
        width: "100px",
        render: (f) => (f.tarih ? new Date(f.tarih).toLocaleDateString("tr-TR") : "-"),
      },
      {
        header: "Tip",
        width: "80px",
        align: "center",
        render: (f) => (
          <Badge bg={Number(f.tip) === 1 ? "danger" : "success"}>
            {Number(f.tip) === 1 ? "Satış" : "Alış"}
          </Badge>
        ),
      },
      { header: "Ünvan", render: (f) => f.unvan || "-" },
      {
        header: "Tutar",
        width: "130px",
        align: "right",
        render: (f) => (
          <span className="font-monospace fw-semibold">
            {formatTutar(Number(f.odemeTutari || f.toplamTutar || 0), tlKurusSayisi)} TL
          </span>
        ),
      },
    ],
    [tlKurusSayisi]
  );

  const filteredIstatistikForModal = useMemo(
    () => istatistikList.filter((it) => Number(it.tip) === istatistikModalTip),
    [istatistikList, istatistikModalTip]
  );

  return (
    <div className="w-100 pb-2" style={{ overflowX: "hidden" }}>
      {/* Üst ERP Araç Çubuğu */}
      <ERPToolbar
        disableShortcuts={true}
        disabled={isSaving}
        pageTitle={isDuzeltmeMode ? "F- Döviz Fişi Düzeltme" : "E- Döviz Fişi Kayıt"}
        onNew={isDuzeltmeMode ? undefined : requestNew}
        hideNew={isDuzeltmeMode}
        onSave={isLocked ? undefined : () => handleSave(false)}
        hideSave={isLocked}
        onSaveAndPrint={isLocked ? undefined : () => handleSave(true)}
        onSearch={isDuzeltmeMode ? () => setShowFisSecimModal(true) : undefined}
        onDelete={isDuzeltmeMode && !isLocked && loadedFis?.fisId ? () => setShowDeleteConfirm(true) : undefined}
        hideSearch={!isDuzeltmeMode}
        hideDelete={!isDuzeltmeMode || isLocked}
        hideNavigation={!isDuzeltmeMode}
        onFirst={handleFirst}
        onPrev={handlePrev}
        onNext={handleNext}
        onLast={handleLast}
        onRefresh={loadLookupsAndList}
        centerContent={
          <div className="d-flex align-items-center gap-2">
            <Badge bg="primary" className="px-2 py-1" style={{ fontSize: "11.5px" }}>
              SATIR (GRİD) MODU
            </Badge>
            {isDuzeltmeMode && loadedFis && (
              <Badge bg={Number(loadedFis.tip) === 1 ? "danger" : "success"} className="px-2 py-1 font-monospace" style={{ fontSize: "11.5px" }}>
                #{loadedFis.belgeNo || loadedFis.fisId}
              </Badge>
            )}
            <div
              className="d-inline-flex align-items-center gap-1 px-2 py-0.5 rounded border bg-white shadow-2xs font-monospace"
              style={{ fontSize: "11.5px", height: "26px" }}
            >
              <span className="text-primary fw-bold" style={{ fontSize: "10.5px" }}>VEZNE:</span>
              <strong className="text-dark">{vezneKod}</strong>
              {vezneAd && <span className="text-muted">({vezneAd})</span>}
            </div>
          </div>
        }
        rightContent={
          <div className="d-flex align-items-center gap-2">
            <div className="d-flex align-items-center gap-2 px-2 py-0.5 bg-white rounded border shadow-2xs small font-monospace" style={{ fontSize: "11px" }}>
              <span className="text-muted">TL:</span>
              <strong className="text-dark">
                {topBalances.tl.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </strong>
              <span className="text-secondary opacity-50">|</span>
              <span className="text-muted">USD:</span>
              <strong className="text-dark">{topBalances.usd.toLocaleString("tr-TR")}</strong>
              <span className="text-secondary opacity-50">|</span>
              <span className="text-muted">EUR:</span>
              <strong className="text-dark">{topBalances.eur.toLocaleString("tr-TR")}</strong>
            </div>

            {/* Kolonlar Seçici */}
            <Dropdown align="end" autoClose="outside">
              <Dropdown.Toggle
                variant="outline-secondary"
                size="sm"
                className="d-inline-flex align-items-center gap-1 py-0 px-2"
                style={{ fontSize: "11.5px", height: "26px" }}
              >
                <IconColumns size={14} /> Kolonlar
              </Dropdown.Toggle>
              <Dropdown.Menu className="py-1 shadow-sm" style={{ minWidth: "155px", fontSize: "12px" }}>
                {OPTIONAL_COL_LABELS.map(({ key, label }) => (
                  <Dropdown.Item
                    key={key}
                    as="button"
                    type="button"
                    className="d-flex align-items-center gap-2 py-1 px-2"
                    onClick={() => toggleColumn(key)}
                  >
                    <span
                      className="d-inline-flex align-items-center justify-content-center rounded"
                      style={{
                        width: "14px",
                        height: "14px",
                        border: colVisibility[key] ? "1px solid #2563eb" : "1px solid #94a3b8",
                        backgroundColor: colVisibility[key] ? "#2563eb" : "#fff",
                      }}
                    >
                      {colVisibility[key] && (
                        <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2.5">
                          <polyline points="1,6 4,9 11,2" />
                        </svg>
                      )}
                    </span>
                    <span style={{ color: colVisibility[key] ? "#212529" : "#94a3b8" }}>{label}</span>
                  </Dropdown.Item>
                ))}
                <Dropdown.Divider className="my-1" />
                <Dropdown.Item
                  as="button"
                  type="button"
                  className="text-center small text-primary py-1"
                  onClick={() => {
                    setColVisibility(defaultColVis);
                    try {
                      localStorage.removeItem(COL_VIS_STORAGE_KEY);
                    } catch {
                      // ignore
                    }
                  }}
                >
                  Varsayılana Sıfırla
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </div>
        }
      />

      {isLocked && (
        <Alert variant="warning" className="d-flex align-items-center gap-2 my-1 py-1.5 px-3">
          <IconLock size={16} className="text-danger" />
          <span className="fw-bold small">Bu fiş salt okunurdur, değiştirilemez.</span>
        </Alert>
      )}

      {/* Bildirim Toast */}
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

      {/* Ana Grid Tablosu */}
      <div
        className="table-responsive border rounded bg-white shadow-2xs"
        style={{
          minHeight: "calc(100vh - 235px)",
          maxHeight: "calc(100vh - 235px)",
          overflowY: "auto",
          borderColor: "#cbd5e1",
        }}
      >
        <Table size="sm" className="mb-0 align-middle" style={{ borderCollapse: "collapse" }}>
          <thead className="position-sticky top-0" style={{ backgroundColor: "#dbeafe", color: "#1e293b", zIndex: 5 }}>
            <tr style={{ height: "32px", borderBottom: "1px solid #94a3b8", fontSize: "12px" }}>
              <th style={{ width: "42px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>#</th>
              <th style={{ width: "96px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Alış / Satış</th>
              <th style={{ width: "110px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>İstatistik</th>
              <th style={{ width: "92px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Kur Türü</th>
              <th style={{ width: "105px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Kod</th>
              {colVisibility.ad && <th style={{ minWidth: "130px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Ad</th>}
              {colVisibility.adet && <th style={{ width: "95px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Adet</th>}
              {colVisibility.miktar && <th style={{ width: "105px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Miktar</th>}
              {colVisibility.kur && <th style={{ width: "110px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Kur</th>}
              {colVisibility.komisyonOrani && <th style={{ width: "55px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Kom.%</th>}
              {colVisibility.komisyon && <th style={{ width: "85px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Komisyon</th>}
              {colVisibility.bmv && <th style={{ width: "75px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>BMV</th>}
              {colVisibility.kmv && <th style={{ width: "75px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>KMV</th>}
              {colVisibility.tutar && <th style={{ width: "125px", textAlign: "center" }}>Tutar (TL)</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const isPZ = isDovizOrZiynetItem(row.paraKodu, row.paraAdi, row.urunTipi);
              const isAdetPassive = !(isPZ && userDovizZiynetGirisSekli === 0);
              const isMiktarPassive = !isAdetPassive;
              const isAlis = row.tip === 0;
              const isKodInvalid = Boolean(invalidRowIds[row.id]?.kod);
              const isQtyInvalid = Boolean(invalidRowIds[row.id]?.qty);

              return (
                <tr
                  key={row.id}
                  data-row-id={row.id}
                  style={{
                    height: "32px",
                    backgroundColor: activeRowIndex === idx ? "#f8fafc" : "#ffffff",
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  {/* # */}
                  <td
                    className="text-center text-secondary small fw-semibold user-select-none"
                    style={{ borderRight: "1px solid #e2e8f0" }}
                    title="Satırı silmek için sağ tıklayın"
                  >
                    {idx + 1}
                  </td>

                  {/* Alış / Satış */}
                  <td
                    className="p-0"
                    style={{
                      borderRight: "1px solid #e2e8f0",
                      backgroundColor: isAlis ? "#f0fdf4" : "#fef2f2",
                    }}
                  >
                    <select
                      id={`dg-cell-${idx}-tip`}
                      autoFocus={idx === 0}
                      disabled={isLocked}
                      value={row.tip}
                      onFocus={() => setActiveRowIndex(idx)}
                      onChange={(e) => updateRowField(row.id, "tip", Number(e.target.value))}
                      onKeyDown={(e) => handleCellKeyDown(e, idx, "tip")}
                      className="form-select form-select-sm border-0 shadow-none fw-bold py-0 px-1"
                      style={{
                        height: "28px",
                        fontSize: "12px",
                        backgroundColor: "transparent",
                        color: isAlis ? "#15803d" : "#b91c1c",
                      }}
                    >
                      <option value={0}>Alış</option>
                      <option value={1}>Satış</option>
                    </select>
                  </td>

                  {/* İstatistik */}
                  <td className="p-0" style={{ borderRight: "1px solid #e2e8f0" }}>
                    <div className="d-flex align-items-center w-100 px-1">
                      <input
                        id={`dg-cell-${idx}-istatistik`}
                        type="text"
                        disabled={isLocked}
                        autoComplete="off"
                        className="form-control form-control-sm border-0 p-0 shadow-none font-monospace fw-semibold"
                        style={{ height: "26px", fontSize: "12px", backgroundColor: "transparent" }}
                        value={row.istatistikKodu}
                        onFocus={() => setActiveRowIndex(idx)}
                        onChange={(e) => updateRowField(row.id, "istatistikKodu", e.target.value)}
                        onKeyDown={(e) => handleCellKeyDown(e, idx, "istatistik")}
                        placeholder="İst."
                      />
                      <Button
                        variant="link"
                        disabled={isLocked}
                        tabIndex={-1}
                        className="p-0 px-1 text-secondary text-decoration-none"
                        onClick={() => {
                          setIstatistikModalRowId(row.id);
                          setIstatistikModalTip(row.tip);
                          setIstatistikSearchTerm((row.istatistikKodu || "").trim());
                          setShowIstatistikModal(true);
                        }}
                        title="İstatistik Seç (F4)"
                      >
                        <IconBinoculars size={13} />
                      </Button>
                    </div>
                  </td>

                  {/* Kur Türü */}
                  <td className="p-0" style={{ borderRight: "1px solid #e2e8f0" }}>
                    <select
                      id={`dg-cell-${idx}-kurTuru`}
                      disabled={isLocked}
                      value={row.kurTuru}
                      onFocus={() => setActiveRowIndex(idx)}
                      onChange={(e) => updateRowField(row.id, "kurTuru", Number(e.target.value))}
                      onKeyDown={(e) => handleCellKeyDown(e, idx, "kurTuru")}
                      className="form-select form-select-sm border-0 shadow-none py-0 px-1 fw-medium"
                      style={{ height: "28px", fontSize: "12px", backgroundColor: "transparent" }}
                    >
                      <option value={0}>Efektif</option>
                      <option value={1}>Döviz</option>
                    </select>
                  </td>

                  {/* Kod */}
                  <td
                    className="p-0"
                    style={{
                      borderRight: "1px solid #e2e8f0",
                      backgroundColor: isKodInvalid ? "#fee2e2" : undefined,
                      boxShadow: isKodInvalid ? "inset 0 0 0 2px #dc2626" : undefined,
                    }}
                  >
                    <div className="d-flex align-items-center w-100 px-1">
                      <input
                        id={`dg-cell-${idx}-kod`}
                        type="text"
                        disabled={isLocked}
                        autoComplete="off"
                        spellCheck={false}
                        className="form-control form-control-sm border-0 p-0 shadow-none font-monospace fw-bold text-uppercase"
                        style={{ height: "26px", fontSize: "13px", backgroundColor: "transparent" }}
                        value={row.paraKodu}
                        onFocus={() => {
                          setActiveRowIndex(idx);
                          lastFocusedKodRef.current = (row.paraKodu || "").trim();
                        }}
                        onChange={(e) =>
                          updateRowField(row.id, "paraKodu", e.target.value.toUpperCase())
                        }
                        onKeyDown={(e) => handleCellKeyDown(e, idx, "kod")}
                        placeholder="USD..."
                      />
                      <Button
                        variant="link"
                        disabled={isLocked}
                        tabIndex={-1}
                        className="p-0 px-1 text-secondary text-decoration-none"
                        onClick={() => {
                          setParaModalRowId(row.id);
                          setParaSearchTerm((row.paraKodu || "").trim());
                          setShowParaModal(true);
                        }}
                        title="Döviz / Para Seç (F4)"
                      >
                        <IconBinoculars size={13} />
                      </Button>
                    </div>
                  </td>

                  {/* Ad */}
                  {colVisibility.ad && (
                    <td
                      className="p-0 px-2 text-dark small text-truncate"
                      style={{ borderRight: "1px solid #e2e8f0", maxWidth: "160px" }}
                      title={row.paraAdi}
                    >
                      {row.paraAdi || "-"}
                    </td>
                  )}

                  {/* Adet */}
                  {colVisibility.adet && (
                    <td
                      className="p-0"
                      style={{
                        borderRight: "1px solid #e2e8f0",
                        backgroundColor: isAdetPassive ? "#e9ecef" : (isQtyInvalid ? "#fee2e2" : undefined),
                        boxShadow: !isAdetPassive && isQtyInvalid ? "inset 0 0 0 2px #dc2626" : undefined,
                      }}
                    >
                      <input
                        id={`dg-cell-${idx}-adet`}
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        disabled={isLocked || isAdetPassive}
                        tabIndex={isAdetPassive ? -1 : undefined}
                        className="form-control form-control-sm border-0 p-0 px-2 shadow-none font-monospace text-end"
                        style={{ height: "26px", fontSize: "13px", backgroundColor: "transparent" }}
                        value={isAdetPassive ? "" : row.adet}
                        onFocus={() => setActiveRowIndex(idx)}
                        onChange={(e) => updateRowField(row.id, "adet", e.target.value)}
                        onBlur={(e) => {
                          if (!isAdetPassive && e.target.value.trim()) {
                            updateRowField(row.id, "adet", formatMiktar(e.target.value));
                          }
                        }}
                        onKeyDown={(e) => handleCellKeyDown(e, idx, "adet")}
                      />
                    </td>
                  )}

                  {/* Miktar */}
                  {colVisibility.miktar && (
                    <td
                      className="p-0"
                      style={{
                        borderRight: "1px solid #e2e8f0",
                        backgroundColor: isMiktarPassive ? "#e9ecef" : (isQtyInvalid ? "#fee2e2" : undefined),
                        boxShadow: !isMiktarPassive && isQtyInvalid ? "inset 0 0 0 2px #dc2626" : undefined,
                      }}
                    >
                      <input
                        id={`dg-cell-${idx}-miktar`}
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        disabled={isLocked || isMiktarPassive}
                        tabIndex={isMiktarPassive ? -1 : undefined}
                        className="form-control form-control-sm border-0 p-0 px-2 shadow-none font-monospace text-end"
                        style={{ height: "26px", fontSize: "13px", backgroundColor: "transparent" }}
                        value={isMiktarPassive ? "" : row.miktar}
                        onFocus={() => setActiveRowIndex(idx)}
                        onChange={(e) => updateRowField(row.id, "miktar", e.target.value)}
                        onBlur={(e) => {
                          if (!isMiktarPassive && e.target.value.trim()) {
                            updateRowField(row.id, "miktar", formatMiktar(e.target.value));
                          }
                        }}
                        onKeyDown={(e) => handleCellKeyDown(e, idx, "miktar")}
                      />
                    </td>
                  )}

                  {/* Kur */}
                  {colVisibility.kur && (
                    <td
                      className="p-0"
                      style={{
                        borderRight: "1px solid #e2e8f0",
                        backgroundColor: !kurAcik ? "#e9ecef" : undefined,
                      }}
                    >
                      <input
                        id={`dg-cell-${idx}-kur`}
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        disabled={isLocked || !kurAcik}
                        tabIndex={!kurAcik ? -1 : undefined}
                        className="form-control form-control-sm border-0 p-0 px-2 shadow-none font-monospace text-end fw-semibold"
                        style={{ height: "26px", fontSize: "13px", backgroundColor: "transparent" }}
                        value={row.kur}
                        onFocus={() => setActiveRowIndex(idx)}
                        onChange={(e) => updateRowField(row.id, "kur", e.target.value)}
                        onBlur={(e) => {
                          const n = parseKur(e.target.value);
                          if (n > 0) updateRowField(row.id, "kur", formatTutar(n, kurKurusSayisi));
                        }}
                        onKeyDown={(e) => handleCellKeyDown(e, idx, "kur")}
                      />
                    </td>
                  )}

                  {/* Komisyon % */}
                  {colVisibility.komisyonOrani && (
                    <td
                      className="p-0"
                      style={{
                        borderRight: "1px solid #e2e8f0",
                        backgroundColor: !kYetki.komisyonAlma ? "#e9ecef" : undefined,
                      }}
                    >
                      <input
                        id={`dg-cell-${idx}-komisyonOrani`}
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        disabled={isLocked || !kYetki.komisyonAlma}
                        tabIndex={!kYetki.komisyonAlma ? -1 : undefined}
                        className="form-control form-control-sm border-0 p-0 px-1 shadow-none font-monospace text-end"
                        style={{ height: "26px", fontSize: "12px", backgroundColor: "transparent" }}
                        value={row.komisyonOrani}
                        onFocus={() => setActiveRowIndex(idx)}
                        onChange={(e) => updateRowField(row.id, "komisyonOrani", e.target.value)}
                        onKeyDown={(e) => handleCellKeyDown(e, idx, "komisyonOrani")}
                      />
                    </td>
                  )}

                  {/* Komisyon */}
                  {colVisibility.komisyon && (
                    <td className="p-0 px-2 text-end font-monospace small text-secondary" style={{ borderRight: "1px solid #e2e8f0" }}>
                      {row.komisyon || "-"}
                    </td>
                  )}

                  {/* BMV */}
                  {colVisibility.bmv && (
                    <td className="p-0 px-2 text-end font-monospace small text-secondary" style={{ borderRight: "1px solid #e2e8f0" }}>
                      {row.bmv || "-"}
                    </td>
                  )}

                  {/* KMV */}
                  {colVisibility.kmv && (
                    <td className="p-0 px-2 text-end font-monospace small text-secondary" style={{ borderRight: "1px solid #e2e8f0" }}>
                      {row.kmv || "-"}
                    </td>
                  )}

                  {/* Tutar */}
                  {colVisibility.tutar && (
                    <td className="p-0">
                      <input
                        id={`dg-cell-${idx}-tutar`}
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        disabled={isLocked}
                        className="form-control form-control-sm border-0 p-0 px-2 shadow-none font-monospace text-end fw-bold text-primary"
                        style={{ height: "26px", fontSize: "13px", backgroundColor: "transparent" }}
                        value={row.tutar}
                        onFocus={() => setActiveRowIndex(idx)}
                        onChange={(e) => updateRowField(row.id, "tutar", e.target.value)}
                        onKeyDown={(e) => handleCellKeyDown(e, idx, "tutar")}
                      />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </Table>
      </div>

      {/* Alt Toplam Özeti */}
      <div className="mt-2 p-2 bg-white border rounded shadow-2xs d-flex flex-wrap align-items-center justify-content-between gap-2">
        <div className="d-flex flex-wrap align-items-center gap-3 small">
          <div className="d-flex align-items-center gap-1.5">
            <Badge bg="success">Alış ({totals.alisCount})</Badge>
            <strong className="font-monospace text-success">
              {formatTutar(totals.alisTutar, tlKurusSayisi)} TL
            </strong>
          </div>
          <div className="d-flex align-items-center gap-1.5">
            <Badge bg="danger">Satış ({totals.satisCount})</Badge>
            <strong className="font-monospace text-danger">
              {formatTutar(totals.satisTutar, tlKurusSayisi)} TL
            </strong>
          </div>
          {totals.komisyon > 0 && (
            <span className="text-secondary font-monospace">
              Kom: <strong>{formatTutar(totals.komisyon, tlKurusSayisi)}</strong>
            </span>
          )}
          {colVisibility.bmv && totals.bmv > 0 && (
            <span className="text-secondary font-monospace">
              BMV: <strong>{formatTutar(totals.bmv, tlKurusSayisi)}</strong>
            </span>
          )}
          {colVisibility.kmv && totals.kmv > 0 && (
            <span className="text-secondary font-monospace">
              KMV: <strong>{formatTutar(totals.kmv, tlKurusSayisi)}</strong>
            </span>
          )}
        </div>
        <div className="text-muted" style={{ fontSize: "11px" }}>
          <strong>F1</strong>: Kaydet · <strong>F10</strong>: Kaydet &amp; Yazdır ·{" "}
          <strong>F4</strong>: Arama / Yeni · <strong>Sağ Tık</strong>: Satır Sil ·{" "}
          <strong>Enter / Oklar</strong>: Gezinme
        </div>
      </div>

      {/* Para / Döviz Seçim Modalı */}
      <LookupModal<ParaItem>
        show={showParaModal}
        initialSearchTerm={paraSearchTerm}
        title="Para / Döviz Seçiniz"
        selectOnDoubleClick={true}
        columns={paraColumns}
        items={paraList}
        filterFn={(it, term) => {
          const t = term.toLowerCase();
          return (
            (it.kod || "").toLowerCase().includes(t) ||
            (it.ad || "").toLowerCase().includes(t)
          );
        }}
        onSelect={(selected) => {
          const rIdx = rows.findIndex((r) => r.id === paraModalRowId);
          if (paraModalRowId && rIdx !== -1) {
            applyParaToRow(paraModalRowId, selected, rIdx);
          }
          setShowParaModal(false);
        }}
        onHide={() => setShowParaModal(false)}
      />

      {/* İstatistik Seçim Modalı */}
      <LookupModal<IstatistikSecimItem>
        show={showIstatistikModal}
        initialSearchTerm={istatistikSearchTerm}
        title="İstatistik Kodu Seçiniz"
        selectOnDoubleClick={true}
        columns={istatistikColumns}
        items={filteredIstatistikForModal}
        filterFn={(it, term) => {
          const t = term.toLowerCase();
          return (
            (it.kod || "").toLowerCase().includes(t) ||
            (it.ad || "").toLowerCase().includes(t)
          );
        }}
        onSelect={(selected) => {
          const rIdx = rows.findIndex((r) => r.id === istatistikModalRowId);
          if (istatistikModalRowId) {
            applyStatisticToRow(istatistikModalRowId, selected);
          }
          setShowIstatistikModal(false);
          if (rIdx !== -1) focusCell(rIdx, "kurTuru");
        }}
        onHide={() => setShowIstatistikModal(false)}
      />

      {/* Fiş Dürbün Modalı (Düzeltme Modu) */}
      <FisDurbunModal<DovizFisListItem>
        show={showFisSecimModal}
        title="Döviz Fişi Seçiniz"
        columns={fisDurbunColumns}
        getir={(parametreler, limit) => DovizFisService.getFisList({ ...parametreler, limit })}
        sunucuArama
        selectOnDoubleClick={true}
        searchPlaceholder="Belge no veya ünvan ile arayın..."
        alanlar={{ tarih: true, vezne: true, tip: true, belgeNo: true }}
        vezneler={vezneList.map((v) => ({ deger: String(v.id), ad: `${v.kod} - ${v.ad}` }))}
        tipler={DOVIZ_DURBUN_TIPLERI}
        onSelect={(selected) => {
          setShowFisSecimModal(false);
          loadFisById(selected.fisId);
        }}
        onHide={() => setShowFisSecimModal(false)}
      />

      {/* Para Üstü Modalı */}
      {paraUstuPrompt !== null && (
        <ParaUstuModal
          show={paraUstuPrompt !== null}
          onClose={() => {
            const r = paraUstuPrompt?.resolve;
            setParaUstuPrompt(null);
            r?.(null);
          }}
          fisToplamTutar={paraUstuPrompt.toplam}
          isDuzeltmeMode={isDuzeltmeMode}
          tlKurusSayisi={tlKurusSayisi}
          onApply={(res) => {
            const r = paraUstuPrompt?.resolve;
            setParaUstuPrompt(null);
            r?.(res);
          }}
        />
      )}

      {/* Yeni Kayıt Onay Modalı (Sadece Grid Modu) */}
      <Modal show={showNewConfirm} onHide={() => setShowNewConfirm(false)} centered size="sm">
        <Modal.Header closeButton>
          <Modal.Title className="fs-6 fw-bold text-warning d-flex align-items-center gap-2">
            <IconAlertTriangle size={18} /> Yeni Kayıt
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="py-3 text-center small">
          Ekrandaki mevcut satırlar temizlenip yeni kayıt başlatılacak. Devam etmek istiyor musunuz?
        </Modal.Body>
        <Modal.Footer className="py-2">
          <Button variant="secondary" size="sm" onClick={() => setShowNewConfirm(false)}>
            Vazgeç
          </Button>
          <Button
            variant="primary"
            size="sm"
            autoFocus
            onClick={() => {
              setShowNewConfirm(false);
              handleNew();
            }}
          >
            Evet, Temizle
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Silme Onay Modalı */}
      <Modal show={showDeleteConfirm} onHide={() => setShowDeleteConfirm(false)} centered size="sm">
        <Modal.Header closeButton>
          <Modal.Title className="fs-6 fw-bold text-danger">Fişi Sil</Modal.Title>
        </Modal.Header>
        <Modal.Body className="py-3 text-center small">
          <strong>#{loadedFis?.belgeNo || loadedFis?.fisId}</strong> numaralı döviz fişi silinecektir. Emin misiniz?
        </Modal.Body>
        <Modal.Footer className="py-2">
          <Button variant="secondary" size="sm" onClick={() => setShowDeleteConfirm(false)}>
            Vazgeç
          </Button>
          <Button variant="danger" size="sm" onClick={handleDelete}>
            Evet, Sil
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default DovizFisiSatirGridPage;
