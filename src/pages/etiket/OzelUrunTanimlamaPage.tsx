import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Container, Row, Col, Card, Form, Button, Alert, InputGroup, Badge, Modal } from "react-bootstrap";
import {
  IconBarcode,
  IconCheck,
  IconAlertTriangle,
  IconBinoculars,
  IconCamera,
  IconTrash,
  IconPlus,
  IconCoin,
  IconDiamond,
} from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import LookupModal, { LookupColumn } from "../../components/common/LookupModal";
import EtiketYazdirModal, { EtiketYazdirItem } from "./EtiketYazdirModal";
import {
  EtiketService,
  OzelUrunItem,
  SaveOzelUrunPayload,
  EtiketSablonItem,
} from "../../services/etiketService";
import { CariService, CariKartItem } from "../../services/cariService";
import { KurService } from "../../services/kurService";

export interface TasRowState {
  id: string;
  tasCinsi: string;
  tasMiktar: number | string;
  tasBirim: string;
  tasRenk: string;
  tasSaflik: string;
  tasAdet: number | string;
  tasTutar: number | string;
  tasTutarBirimi: string;
}

interface ParaItem {
  id: number;
  kod: string;
  ad: string;
  dovizSatis?: number | null;
  dovizAlis?: number | null;
}

const DEFAULT_PARALAR: ParaItem[] = [
  { id: 1, kod: "USD", ad: "Amerikan Doları" },
  { id: 2, kod: "EUR", ad: "Euro" },
  { id: 3, kod: "TL", ad: "Türk Lirası" },
  { id: 4, kod: "HAS", ad: "Has Altın" },
  { id: 5, kod: "GBP", ad: "İngiliz Sterlini" },
  { id: 6, kod: "CHF", ad: "İsviçre Frangı" },
];

const createEmptyTasRow = (): TasRowState => ({
  id: `tas-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
  tasCinsi: "Diamond1",
  tasMiktar: "",
  tasBirim: "Ct",
  tasRenk: "H",
  tasSaflik: "VS1",
  tasAdet: "",
  tasTutar: "",
  tasTutarBirimi: "USD",
});

export const OzelUrunTanimlamaPage: React.FC = () => {
  // ─── Form State (TODVZ_OZEL_URUN) ───────────────────────────────────────────
  const [ozelUrunId, setOzelUrunId] = useState<number | null>(null);
  const [tarih, setTarih] = useState<string>(new Date().toISOString().slice(0, 10));
  const [grupKodu, setGrupKodu] = useState<string>("");
  const [urunNo, setUrunNo] = useState<number | string>("");
  const [barkod, setBarkod] = useState<string>("");

  // Temel Özellikler
  const [mamulTipi, setMamulTipi] = useState<string>("Yüzük");
  const [ureticiFirma, setUreticiFirma] = useState<string>("");
  const [miktar, setMiktar] = useState<number | string>("");
  const [miktarBirimi, setMiktarBirimi] = useState<string>("Adet");
  const [orjinalKod, setOrjinalKod] = useState<string>("");
  const [ayar, setAyar] = useState<string>("14");
  const [modelOzellik1, setModelOzellik1] = useState<string>("");
  const [modelOzellik2, setModelOzellik2] = useState<string>("");
  const [banko, setBanko] = useState<string>("Banko 1");

  // Fiyatlandırma
  const [maliyet, setMaliyet] = useState<number | string>("");
  const [maliyetParaKodu, setMaliyetParaKodu] = useState<string>("USD");
  const [karYuzdesi, setKarYuzdesi] = useState<number | string>("");
  const [sabitle, setSabitle] = useState<boolean>(false);
  const [satisFiyati, setSatisFiyati] = useState<number | string>("");
  const [satisParaKodu, setSatisParaKodu] = useState<string>("USD");
  const [hizliGiris, setHizliGiris] = useState<boolean>(false);

  // Taş Detayları (Grid State)
  const [tasSatirlari, setTasSatirlar] = useState<TasRowState[]>([createEmptyTasRow()]);
  const [selectedTasIndex, setSelectedTasIndex] = useState<number>(0);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; rowIndex: number } | null>(null);

  // Resim
  const [resim, setResim] = useState<string | null>(null);

  // ─── UI & Liste State ───────────────────────────────────────────────────────
  const [ozelList, setOzelList] = useState<OzelUrunItem[]>([]);
  const [ureticiList, setUreticiList] = useState<string[]>([]);
  const [cariList, setCariList] = useState<CariKartItem[]>([]);
  const [paraList, setParaList] = useState<ParaItem[]>(DEFAULT_PARALAR);
  const [sablonlar, setSablonlar] = useState<EtiketSablonItem[]>([]);

  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "danger" | "warning"; message: string } | null>(null);

  const [showLookup, setShowLookup] = useState(false);
  const [showFirmaLookup, setShowFirmaLookup] = useState(false);
  const [showParaLookupTarget, setShowParaLookupTarget] = useState<"maliyet" | "satis" | { tasIndex: number } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const showNotif = (type: "success" | "danger" | "warning", msg: string) => {
    setNotification({ type, message: msg });
    setTimeout(() => setNotification(null), 4000);
  };

  // Close context menu on global click
  useEffect(() => {
    const handleGlobalClick = () => setContextMenu(null);
    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
  }, []);

  // ─── Yardımcı Sayı Temizleme Fonksiyonu ─────────────────────────────────────
  const cleanNum = (val: string): string => {
    let cleaned = val.replace(/,/g, ".").replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    if (parts.length > 2) {
      cleaned = parts[0] + "." + parts.slice(1).join("");
    }
    return cleaned;
  };

  // ─── Satış Fiyatı & Kâr Hesaplaması ─────────────────────────────────────────
  const handleMaliyetChange = (val: string) => {
    setMaliyet(val);
    const m = parseFloat(val) || 0;
    const k = parseFloat(String(karYuzdesi)) || 0;
    if (!sabitle) {
      if (val !== "" && m > 0) {
        const calcSat = Number((m * (1 + k / 100)).toFixed(2));
        setSatisFiyati(calcSat);
      } else if (!val) {
        setSatisFiyati("");
      }
    }
  };

  const handleKarYuzdeChange = (val: string) => {
    setKarYuzdesi(val);
    const k = parseFloat(val) || 0;
    const m = parseFloat(String(maliyet)) || 0;
    if (!sabitle && m > 0 && val !== "") {
      const calcSat = Number((m * (1 + k / 100)).toFixed(2));
      setSatisFiyati(calcSat);
    }
  };

  const handleSatisFiyatChange = (val: string) => {
    setSatisFiyati(val);
    const s = parseFloat(val) || 0;
    const m = parseFloat(String(maliyet)) || 0;
    if (m > 0 && !sabitle && s > 0) {
      const calcKar = Number((((s - m) / m) * 100).toFixed(1));
      setKarYuzdesi(calcKar);
    } else if (!val) {
      setKarYuzdesi("");
    }
  };

  // ─── Veri Yükleme ────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    try {
      const [list, ureticiler, sabl, cariler, kurTablo] = await Promise.all([
        EtiketService.getOzelUrunler({ limit: 500 }),
        EtiketService.getUreticiFirmalar().catch(() => []),
        EtiketService.getSablonlar(1).catch(() => []),
        CariService.getCariKartlar().catch(() => [] as CariKartItem[]),
        KurService.getKurTablosu({ tur: 0 }).catch(() => null),
      ]);
      setOzelList(list);
      setUreticiList(ureticiler.length ? ureticiler : ["ALTINBAŞ", "ATASAY", "ZEN", "BLUE DIAMOND"]);
      setSablonlar(sabl);
      setCariList(cariler.length ? cariler : ureticiler.map((u, idx) => ({ id: idx, kod: `FRM${idx + 1}`, ad: u, kisilikTipi: 1 } as any)));

      if (kurTablo?.satirlar && kurTablo.satirlar.length > 0) {
        const mappedParas = kurTablo.satirlar.map((s) => ({
          id: s.paraId,
          kod: s.kod,
          ad: s.ad,
          dovizSatis: s.dovizSatis,
          dovizAlis: s.dovizAlis,
        }));
        setParaList(mappedParas);
      }
    } catch (err: any) {
      showNotif("danger", err?.message || "Özel ürün stok listesi yüklenemedi.");
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ─── Taş Gridi İşlemleri (Spreadsheet Navigation & Row Management) ───────────
  const addNewTasRow = () => {
    const newRow = createEmptyTasRow();
    setTasSatirlar((prev) => {
      const nextList = [...prev, newRow];
      const nextIdx = nextList.length - 1;
      setSelectedTasIndex(nextIdx);
      setTimeout(() => {
        const nextEl = document.getElementById(`grid-tas-${nextIdx}-tasCinsi`);
        if (nextEl) nextEl.focus();
      }, 50);
      return nextList;
    });
  };

  const handleTasChange = (index: number, field: keyof TasRowState, val: any) => {
    setTasSatirlar((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index] = { ...next[index], [field]: val };
      }
      return next;
    });
  };

  const handleTasCellKeyDown = (
    e: React.KeyboardEvent<HTMLElement>,
    rowIndex: number,
    field: keyof TasRowState
  ) => {
    const fieldsOrder: (keyof TasRowState)[] = [
      "tasCinsi",
      "tasMiktar",
      "tasBirim",
      "tasRenk",
      "tasSaflik",
      "tasAdet",
      "tasTutar",
      "tasTutarBirimi",
    ];
    const currentFieldIndex = fieldsOrder.indexOf(field);

    if (e.key === "Enter") {
      e.preventDefault();

      // Tutar veya Para Birimi hücresinde Enter'a basılınca:
      if (field === "tasTutar" || field === "tasTutarBirimi") {
        if (rowIndex === tasSatirlari.length - 1) {
          // Son satırdayken doğrudan yeni satır ekle
          addNewTasRow();
          return;
        } else {
          // Sonraki satırın ilk hücresine git
          const nextIndex = rowIndex + 1;
          setSelectedTasIndex(nextIndex);
          setTimeout(() => {
            const nextEl = document.getElementById(`grid-tas-${nextIndex}-tasCinsi`);
            if (nextEl) nextEl.focus();
          }, 50);
          return;
        }
      }

      if (currentFieldIndex < fieldsOrder.length - 1) {
        const nextField = fieldsOrder[currentFieldIndex + 1];
        const nextEl = document.getElementById(`grid-tas-${rowIndex}-${nextField}`);
        if (nextEl) {
          nextEl.focus();
          if ("select" in nextEl && typeof (nextEl as any).select === "function") {
            (nextEl as any).select();
          }
        }
      }
    } else if (e.key === "ArrowRight") {
      const el = e.currentTarget as HTMLInputElement | HTMLSelectElement;
      const isInput = el && "selectionStart" in el;
      const isAtEnd = !isInput || (el.selectionStart === el.value?.length && el.selectionStart === el.selectionEnd);
      if (isAtEnd && currentFieldIndex < fieldsOrder.length - 1) {
        e.preventDefault();
        const nextField = fieldsOrder[currentFieldIndex + 1];
        const nextEl = document.getElementById(`grid-tas-${rowIndex}-${nextField}`);
        if (nextEl) {
          nextEl.focus();
          if ("select" in nextEl && typeof (nextEl as any).select === "function") {
            (nextEl as any).select();
          }
        }
      }
    } else if (e.key === "ArrowLeft") {
      const el = e.currentTarget as HTMLInputElement | HTMLSelectElement;
      const isInput = el && "selectionStart" in el;
      const isAtStart = !isInput || (el.selectionStart === 0 && el.selectionEnd === 0);
      if (isAtStart && currentFieldIndex > 0) {
        e.preventDefault();
        const prevField = fieldsOrder[currentFieldIndex - 1];
        const prevEl = document.getElementById(`grid-tas-${rowIndex}-${prevField}`);
        if (prevEl) {
          prevEl.focus();
          if ("select" in prevEl && typeof (prevEl as any).select === "function") {
            (prevEl as any).select();
          }
        }
      }
    } else if (e.key === "ArrowDown") {
      if (rowIndex < tasSatirlari.length - 1) {
        e.preventDefault();
        const nextIndex = rowIndex + 1;
        setSelectedTasIndex(nextIndex);
        const nextEl = document.getElementById(`grid-tas-${nextIndex}-${field}`);
        if (nextEl) nextEl.focus();
      }
    } else if (e.key === "ArrowUp") {
      if (rowIndex > 0) {
        e.preventDefault();
        const prevIndex = rowIndex - 1;
        setSelectedTasIndex(prevIndex);
        const prevEl = document.getElementById(`grid-tas-${prevIndex}-${field}`);
        if (prevEl) prevEl.focus();
      }
    }
  };

  const handleRemoveTasRow = (index: number) => {
    setTasSatirlar((prev) => {
      if (prev.length <= 1) {
        return [createEmptyTasRow()];
      }
      return prev.filter((_, idx) => idx !== index);
    });
    setSelectedTasIndex((prev) => Math.max(0, Math.min(prev, tasSatirlari.length - 2)));
  };

  // Taş Dip Toplam Hesapları
  const { totalTasKarat, totalTasAdet, totalTasTutar } = useMemo(() => {
    let miktarSum = 0;
    let adetSum = 0;
    let tutarSum = 0;
    tasSatirlari.forEach((r) => {
      miktarSum += Number(r.tasMiktar) || 0;
      adetSum += Number(r.tasAdet) || 0;
      tutarSum += Number(r.tasTutar) || 0;
    });
    return {
      totalTasKarat: miktarSum,
      totalTasAdet: adetSum,
      totalTasTutar: tutarSum,
    };
  }, [tasSatirlari]);

  // ─── Ürün Seçimi ─────────────────────────────────────────────────────────────
  const handleSelectUrun = (it: OzelUrunItem) => {
    setOzelUrunId(it.ozelUrunId);
    setTarih(it.tarih ? it.tarih.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setGrupKodu(it.grupKodu || "");
    setUrunNo(it.urunNo || "");
    setBarkod(it.barkod || (it.grupKodu && it.urunNo ? `${it.grupKodu}${it.urunNo}` : ""));

    setMamulTipi(it.mamulTipi || "Yüzük");
    setUreticiFirma(it.ureticiFirma || "");
    setMiktar(it.miktar ?? "");
    setMiktarBirimi(it.miktarBirimi || "Adet");
    setOrjinalKod(it.orjinalKod || "");
    setAyar(it.ayar || "14");
    setModelOzellik1(it.modelOzellik1 || "");
    setModelOzellik2(it.modelOzellik2 || "");
    setBanko(it.banko || "Banko 1");

    setMaliyet(it.maliyet ?? "");
    setMaliyetParaKodu(it.maliyetParaKodu || "USD");
    setKarYuzdesi(it.karYuzdesi ?? "");
    setSabitle(Boolean(it.sabitle));
    setSatisFiyati(it.satisFiyati ?? "");
    setSatisParaKodu(it.satisParaKodu || "USD");
    setHizliGiris(Boolean(it.hizliGiris));

    // Taş Gridi Doldur
    if (it.tasCinsi || it.tasMiktar || it.tasAdet || it.tasTutar) {
      setTasSatirlar([
        {
          id: `tas-${Date.now()}`,
          tasCinsi: it.tasCinsi || "Diamond1",
          tasMiktar: it.tasMiktar ?? "",
          tasBirim: it.tasBirim || "Ct",
          tasRenk: it.tasRenk || "H",
          tasSaflik: it.tasSaflik || "VS1",
          tasAdet: it.tasAdet ?? "",
          tasTutar: it.tasTutar ?? "",
          tasTutarBirimi: it.tasTutarBirimi || "USD",
        },
      ]);
    } else {
      setTasSatirlar([createEmptyTasRow()]);
    }

    setResim(it.resim || null);
    showNotif("success", `Özel ürün yüklendi: #${it.ozelUrunId} (${it.grupKodu}-${it.urunNo})`);
  };

  // ─── Yeni Ürün Hazırla (YENİ / F4) ──────────────────────────────────────────
  const handleNew = async () => {
    setOzelUrunId(null);
    setTarih(new Date().toISOString().slice(0, 10));
    setResim(null);
    setTasSatirlar([createEmptyTasRow()]);

    const targetGrup = (grupKodu.trim() || "PIRLANTA").toUpperCase();
    setGrupKodu(targetGrup);

    // Mevcut listedeki en büyük ürün numarasını bul
    const maxExistingNo = ozelList
      .filter((x) => (x.grupKodu || "").trim().toUpperCase() === targetGrup)
      .reduce((m, x) => (Number(x.urunNo) > m ? Number(x.urunNo) : m), 0);

    // Alt taraftaki alanlar (mamul tipi, üretici firma, ayar, taş bilgileri, fiyatlandırma vb.) korunur.
    try {
      const nextData = await EtiketService.getNextOzelUrunNo(targetGrup);
      const calculatedNo = Math.max(Number(nextData.sonNo) || 1, maxExistingNo + 1);
      setUrunNo(calculatedNo);
      setBarkod(nextData.barkod && nextData.sonNo === calculatedNo ? nextData.barkod : `${targetGrup}${String(calculatedNo).padStart(5, "0")}`);
      showNotif("success", `${targetGrup} grubu için sıradaki no: #${calculatedNo} otomatik atandı.`);
    } catch {
      const nextNo = maxExistingNo + 1;
      setUrunNo(nextNo);
      setBarkod(`${targetGrup}${String(nextNo).padStart(5, "0")}`);
      showNotif("success", `${targetGrup} grubu için sıradaki no: #${nextNo} otomatik atandı.`);
    }
  };

  // ─── Kaydet / Güncelle (F1 - SODVZ_OZEL_URUN_KAYDET) ────────────────────────
  const handleSave = async (): Promise<OzelUrunItem | null> => {
    if (!grupKodu.trim()) {
      showNotif("warning", "Lütfen grup kodu giriniz.");
      return null;
    }
    if (!urunNo || Number(urunNo) <= 0) {
      showNotif("warning", "Lütfen geçerli bir ürün no giriniz.");
      return null;
    }

    setIsSaving(true);
    try {
      const primaryTas =
        tasSatirlari.find((r) => r.tasMiktar || r.tasTutar || r.tasAdet) ||
        tasSatirlari[0] ||
        createEmptyTasRow();

      const finalBarkod = barkod.trim() || `${grupKodu.trim()}${urunNo}`;
      const payload: SaveOzelUrunPayload = {
        ozelUrunId,
        tarih,
        grupKodu: grupKodu.trim().toUpperCase(),
        urunNo: Number(urunNo),
        barkod: finalBarkod,
        mamulTipi: mamulTipi.trim(),
        ureticiFirma: ureticiFirma.trim(),
        miktar: Number(miktar) || 1,
        miktarBirimi,
        orjinalKod: orjinalKod.trim(),
        ayar,
        modelOzellik1: modelOzellik1.trim(),
        modelOzellik2: modelOzellik2.trim(),
        banko,
        maliyet: Number(maliyet) || 0,
        maliyetParaKodu,
        karYuzdesi: Number(karYuzdesi) || 0,
        sabitle,
        satisFiyati: Number(satisFiyati) || 0,
        satisParaKodu,
        hizliGiris,
        tasCinsi: primaryTas.tasCinsi ? primaryTas.tasCinsi.trim() : "Diamond1",
        tasMiktar: totalTasKarat > 0 ? totalTasKarat : (Number(primaryTas.tasMiktar) || null),
        tasBirim: primaryTas.tasBirim || "Ct",
        tasRenk: primaryTas.tasRenk ? primaryTas.tasRenk.trim() : "H",
        tasSaflik: primaryTas.tasSaflik ? primaryTas.tasSaflik.trim() : "VS1",
        tasAdet: totalTasAdet > 0 ? totalTasAdet : (Number(primaryTas.tasAdet) || null),
        tasTutar: totalTasTutar > 0 ? totalTasTutar : (Number(primaryTas.tasTutar) || null),
        tasTutarBirimi: primaryTas.tasTutarBirimi || "USD",
        resim: resim || null,
        satildi: false,
      };

      const saved = await EtiketService.saveOzelUrun(payload);
      showNotif("success", `Özel ürün başarıyla ${ozelUrunId ? "güncellendi" : "kaydedildi"}: #${saved.ozelUrunId} (${saved.grupKodu}-${saved.urunNo})`);
      setOzelUrunId(saved.ozelUrunId);
      setBarkod(saved.barkod || finalBarkod);

      const refreshed = await EtiketService.getOzelUrunler({ limit: 500 });
      setOzelList(refreshed);
      return saved;
    } catch (err: any) {
      showNotif("danger", err?.message || "Özel ürün kaydedilirken hata oluştu.");
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Sil (F2 - SODVZ_OZEL_URUN_SIL) ─────────────────────────────────────────
  const handleDelete = async () => {
    if (!ozelUrunId) {
      showNotif("warning", "Silinecek bir özel ürün seçiniz.");
      return;
    }
    setIsSaving(true);
    try {
      await EtiketService.deleteOzelUrun(ozelUrunId);
      showNotif("success", `#${ozelUrunId} numaralı özel ürün silindi.`);
      setShowDeleteConfirm(false);

      const refreshed = await EtiketService.getOzelUrunler({ limit: 500 });
      setOzelList(refreshed);
      if (refreshed.length > 0) {
        handleSelectUrun(refreshed[0]);
      } else {
        handleNew();
      }
    } catch (err: any) {
      showNotif("danger", err?.message || "Özel ürün silinirken hata oluştu.");
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Gezinme ────────────────────────────────────────────────────────────────
  const currentIndex = ozelList.findIndex((x) => x.ozelUrunId === ozelUrunId);

  const handleFirst = () => {
    if (ozelList.length > 0) handleSelectUrun(ozelList[0]);
  };
  const handlePrev = () => {
    if (currentIndex > 0) handleSelectUrun(ozelList[currentIndex - 1]);
  };
  const handleNext = () => {
    if (currentIndex >= 0 && currentIndex < ozelList.length - 1) {
      handleSelectUrun(ozelList[currentIndex + 1]);
    }
  };
  const handleLast = () => {
    if (ozelList.length > 0) handleSelectUrun(ozelList[ozelList.length - 1]);
  };

  // ─── Fotoğraf / Kamera ──────────────────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setResim(event.target?.result as string);
        showNotif("success", "Ürün fotoğrafı yüklendi.");
      };
      reader.readAsDataURL(file);
    }
  };

  // ─── Lookup Tablo Kolonları ──────────────────────────────────────────────────
  const lookupColumns: LookupColumn<OzelUrunItem>[] = [
    { header: "Grup", width: "90px", render: (it) => <Badge bg="primary">{it.grupKodu}</Badge> },
    { header: "Ürün No", width: "80px", render: (it) => `#${it.urunNo}` },
    { header: "Barkod", width: "120px", render: (it) => <span className="font-monospace fw-bold">{it.barkod || "-"}</span> },
    { header: "Mamul Tipi", width: "110px", render: (it) => it.mamulTipi || "-" },
    { header: "Üretici", width: "140px", render: (it) => it.ureticiFirma || "-" },
    { header: "Ayar", width: "70px", render: (it) => `${it.ayar || "-"}K` },
    { header: "Miktar", width: "90px", align: "right", render: (it) => `${it.miktar} ${it.miktarBirimi || "Adet"}` },
    { header: "Taş", width: "100px", render: (it) => it.tasCinsi || "-" },
    { header: "Satış Fiyatı", width: "110px", align: "right", render: (it) => `${Number(it.satisFiyati).toFixed(2)} ${it.satisParaKodu}` },
  ];

  const firmaLookupColumns: LookupColumn<CariKartItem>[] = [
    { header: "Firma Kodu", width: "100px", render: (it) => <Badge bg="secondary">{it.kod}</Badge> },
    { header: "Firma / Cari Adı", width: "220px", render: (it) => <span className="fw-bold">{it.ad}</span> },
    { header: "Yetkili", width: "140px", render: (it) => it.yetkiliKisi || "-" },
    { header: "Telefon", width: "120px", render: (it) => it.telefon || "-" },
  ];

  const paraLookupColumns: LookupColumn<ParaItem>[] = [
    { header: "Para Kodu", width: "100px", render: (it) => <Badge bg="primary">{it.kod}</Badge> },
    { header: "Açıklama / Para Adı", width: "220px", render: (it) => <span className="fw-bold">{it.ad}</span> },
    {
      header: "Satış Kuru",
      width: "120px",
      align: "right",
      render: (it) => (it.dovizSatis ? Number(it.dovizSatis).toFixed(4) : "-"),
    },
  ];

  const printItems: EtiketYazdirItem[] = [
    {
      id: ozelUrunId || 0,
      barkod: barkod || `${grupKodu}${urunNo}`,
      fields: {
        grupUrunNo: `${grupKodu}-${urunNo}`,
        mamulTipi: mamulTipi || "-",
        ureticiFirma: ureticiFirma || "-",
        ayar: `${ayar}K`,
        miktar: `${miktar} ${miktarBirimi}`,
        fiyat: `${satisFiyati} ${satisParaKodu}`,
        orjinalKod: orjinalKod || "-",
      },
    },
  ];

  return (
    <Container fluid className="py-2 px-3 px-lg-4 ozel-urun-tanimlama-page">
      {/* 1. Üst ERP Aksiyon Şeridi */}
      <ERPToolbar
        pageTitle="C- Barkodlu Özel Ürün Tanımlama"
        pageIcon={<IconDiamond size={20} />}
        disabled={isSaving}
        onSave={handleSave}
        onDelete={() => {
          if (ozelUrunId) setShowDeleteConfirm(true);
          else showNotif("warning", "Silinecek bir özel ürün seçiniz.");
        }}
        onNew={handleNew}
        onRefresh={() => window.location.reload()}
        onSearch={() => setShowLookup(true)}
        onPrint={() => setShowPrintModal(true)}
        onFirst={handleFirst}
        onPrev={handlePrev}
        onNext={handleNext}
        onLast={handleLast}
        modeText={ozelUrunId ? `Düzenleme: #${ozelUrunId} (${grupKodu}-${urunNo})` : "Yeni Kayıt Modu"}
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
            ) : (
              <IconAlertTriangle size={18} className="me-2 text-danger flex-shrink-0" />
            )}
            <span style={{ fontSize: "13px" }}>{notification.message}</span>
          </Alert>
        </div>
      )}

      {/* 2. Ana Kart */}
      <Card className="shadow-sm border-0 mb-3">
        <Card.Body className="p-3">
          {/* Üst Grup / No Barı */}
          <div className="bg-light p-2.5 rounded border mb-3">
            <Row className="g-2 align-items-center">
              <Col md={3} sm={6}>
                <Form.Group as={Row} className="g-1 align-items-center mb-0">
                  <Form.Label column sm={4} className="small fw-bold text-secondary text-sm-end text-start">
                    Tarih :
                  </Form.Label>
                  <Col sm={8}>
                    <Form.Control
                      type="date"
                      size="sm"
                      value={tarih}
                      onChange={(e) => setTarih(e.target.value)}
                      className="font-monospace"
                    />
                  </Col>
                </Form.Group>
              </Col>

              <Col md={5} sm={12}>
                <Form.Group as={Row} className="g-1 align-items-center mb-0">
                  <Form.Label column sm={3} className="small fw-bold text-secondary text-sm-end text-start">
                    Grup / No <span className="text-danger">*</span> :
                  </Form.Label>
                  <Col sm={9}>
                    <InputGroup size="sm">
                      <Form.Control
                        type="text"
                        value={grupKodu}
                        onChange={(e) => setGrupKodu(e.target.value.toUpperCase())}
                        style={{ maxWidth: "120px", fontWeight: "bold" }}
                        className="text-primary font-monospace"
                        placeholder=""
                      />
                      <Form.Control
                        type="number"
                        value={urunNo}
                        onChange={(e) => setUrunNo(e.target.value)}
                        style={{ maxWidth: "80px", fontWeight: "bold" }}
                        className="text-center font-monospace"
                        placeholder=""
                      />
                      <Button variant="outline-success" onClick={handleNew} title="Yeni Numara Al">
                        <IconPlus size={15} className="me-1" />
                        <span>Yeni</span>
                      </Button>
                      <Button variant="outline-primary" onClick={() => setShowLookup(true)} title="Kayıtlı Özel Ürünleri Listele (F3)">
                        <IconBinoculars size={15} />
                      </Button>
                    </InputGroup>
                  </Col>
                </Form.Group>
              </Col>

              <Col md={4} sm={12}>
                <Form.Group as={Row} className="g-1 align-items-center mb-0">
                  <Form.Label column sm={4} className="small fw-bold text-secondary text-sm-end text-start">
                    Barkod :
                  </Form.Label>
                  <Col sm={8}>
                    <Form.Control
                      type="text"
                      size="sm"
                      value={barkod}
                      onChange={(e) => setBarkod(e.target.value)}
                      className="font-monospace fw-bold text-dark bg-white"
                      placeholder=""
                    />
                  </Col>
                </Form.Group>
              </Col>
            </Row>
          </div>

          {/* Form Alanları (Sol Blok: Ürün Özellikleri / Sağ Blok: Fiyatlandırma & Resim) */}
          <Row className="g-3">
            {/* ─── SOL BLOK: Mamul & Özellikler ─── */}
            <Col lg={6} md={12}>
              <div className="border rounded p-3 h-100 bg-white">
                <div className="fw-bold text-dark border-bottom pb-1.5 mb-2.5 d-flex align-items-center gap-1.5">
                  <IconBarcode size={16} className="text-primary" />
                  <span>Mamul & Tasarım Bilgileri</span>
                </div>

                {/* Mamul Tipi */}
                <Form.Group as={Row} className="mb-2 align-items-center">
                  <Form.Label column sm={4} className="small fw-bold text-secondary text-sm-end text-start">
                    Mamul Tipi :
                  </Form.Label>
                  <Col sm={8}>
                    <Form.Select size="sm" value={mamulTipi} onChange={(e) => setMamulTipi(e.target.value)}>
                      <option value="Yüzük">Yüzük</option>
                      <option value="Kolye">Kolye</option>
                      <option value="Kupe">Küpe</option>
                      <option value="Bileklik">Bileklik</option>
                      <option value="Bilezik">Bilezik</option>
                      <option value="Broş">Broş</option>
                      <option value="Gerdanlık">Gerdanlık</option>
                      <option value="Set">Set / Takım</option>
                      <option value="Diğer">Diğer</option>
                    </Form.Select>
                  </Col>
                </Form.Group>

                {/* Üretici Firma */}
                <Form.Group as={Row} className="mb-2 align-items-center">
                  <Form.Label column sm={4} className="small fw-bold text-secondary text-sm-end text-start">
                    Üretici Firma :
                  </Form.Label>
                  <Col sm={8}>
                    <InputGroup size="sm">
                      <Form.Control
                        type="text"
                        list="ureticiFirmalarList"
                        value={ureticiFirma}
                        onChange={(e) => setUreticiFirma(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "F4") {
                            e.preventDefault();
                            setShowFirmaLookup(true);
                          }
                        }}
                        className="fw-semibold"
                        placeholder=""
                      />
                      <Button
                        variant="outline-secondary"
                        className="px-2 d-flex align-items-center"
                        onClick={() => setShowFirmaLookup(true)}
                        title="Firma Seç (Dürbün / F4)"
                      >
                        <IconBinoculars size={15} />
                      </Button>
                      <datalist id="ureticiFirmalarList">
                        {ureticiList.map((u) => (
                          <option key={u} value={u} />
                        ))}
                      </datalist>
                    </InputGroup>
                  </Col>
                </Form.Group>

                {/* Miktar & Birim */}
                <Form.Group as={Row} className="mb-2 align-items-center">
                  <Form.Label column sm={4} className="small fw-bold text-secondary text-sm-end text-start">
                    Miktar :
                  </Form.Label>
                  <Col sm={8}>
                    <InputGroup size="sm">
                      <Form.Control
                        type="text"
                        inputMode="decimal"
                        value={miktar === 0 || miktar === "0" ? "" : (miktar ?? "")}
                        onChange={(e) => setMiktar(cleanNum(e.target.value))}
                        className="font-monospace text-end"
                        placeholder=""
                      />
                      <Form.Select
                        size="sm"
                        value={miktarBirimi}
                        onChange={(e) => setMiktarBirimi(e.target.value)}
                        style={{ maxWidth: "90px" }}
                        className="font-monospace"
                      >
                        <option value="Adet">Adet</option>
                        <option value="Gram">Gram</option>
                        <option value="Çift">Çift</option>
                        <option value="Takım">Takım</option>
                      </Form.Select>
                    </InputGroup>
                  </Col>
                </Form.Group>

                {/* Orijinal Kod */}
                <Form.Group as={Row} className="mb-2 align-items-center">
                  <Form.Label column sm={4} className="small fw-bold text-secondary text-sm-end text-start">
                    Orijinal Kod :
                  </Form.Label>
                  <Col sm={8}>
                    <Form.Control
                      type="text"
                      size="sm"
                      value={orjinalKod}
                      onChange={(e) => setOrjinalKod(e.target.value)}
                      placeholder=""
                    />
                  </Col>
                </Form.Group>

                {/* Ayar */}
                <Form.Group as={Row} className="mb-2 align-items-center">
                  <Form.Label column sm={4} className="small fw-bold text-secondary text-sm-end text-start">
                    Ayar :
                  </Form.Label>
                  <Col sm={8}>
                    <Form.Select size="sm" value={ayar} onChange={(e) => setAyar(e.target.value)} className="font-monospace">
                      <option value="8">8 Ayar (333)</option>
                      <option value="14">14 Ayar (585)</option>
                      <option value="18">18 Ayar (750)</option>
                      <option value="21">21 Ayar (875)</option>
                      <option value="22">22 Ayar (916)</option>
                      <option value="24">24 Ayar (995 / Has)</option>
                      <option value="925">925 Gümüş</option>
                      <option value="950">950 Platin</option>
                    </Form.Select>
                  </Col>
                </Form.Group>

                {/* Model Özellik 1 */}
                <Form.Group as={Row} className="mb-2 align-items-center">
                  <Form.Label column sm={4} className="small fw-bold text-secondary text-sm-end text-start">
                    Model Özellik 1 :
                  </Form.Label>
                  <Col sm={8}>
                    <Form.Control
                      type="text"
                      size="sm"
                      value={modelOzellik1}
                      onChange={(e) => setModelOzellik1(e.target.value)}
                      placeholder=""
                    />
                  </Col>
                </Form.Group>

                {/* Model Özellik 2 */}
                <Form.Group as={Row} className="mb-2 align-items-center">
                  <Form.Label column sm={4} className="small fw-bold text-secondary text-sm-end text-start">
                    Model Özellik 2 :
                  </Form.Label>
                  <Col sm={8}>
                    <Form.Control
                      type="text"
                      size="sm"
                      value={modelOzellik2}
                      onChange={(e) => setModelOzellik2(e.target.value)}
                      placeholder=""
                    />
                  </Col>
                </Form.Group>

                {/* Banko / Vitrin Konumu */}
                <Form.Group as={Row} className="mb-0 align-items-center">
                  <Form.Label column sm={4} className="small fw-bold text-secondary text-sm-end text-start">
                    Banko / Konum :
                  </Form.Label>
                  <Col sm={8}>
                    <Form.Select size="sm" value={banko} onChange={(e) => setBanko(e.target.value)}>
                      <option value="Banko 1">Banko 1</option>
                      <option value="Banko 2">Banko 2</option>
                      <option value="Vitrin Ana">Vitrin Ana</option>
                      <option value="Kasa İçi">Kasa İçi</option>
                      <option value="Özel Koleksiyon">Özel Koleksiyon</option>
                    </Form.Select>
                  </Col>
                </Form.Group>
              </div>
            </Col>

            {/* ─── SAĞ BLOK: Fiyatlandırma & Kâr + Resim ─── */}
            <Col lg={6} md={12}>
              <div className="border rounded p-3 h-100 bg-white">
                <div className="fw-bold text-dark border-bottom pb-1.5 mb-2.5 d-flex align-items-center gap-1.5">
                  <IconCoin size={16} className="text-success" />
                  <span>Fiyatlandırma, Kâr & Resim</span>
                </div>

                <Row className="gx-2">
                  <Col sm={8}>
                    {/* Maliyet - Sadece Dürbünlü Seçim */}
                    <Form.Group as={Row} className="mb-2 align-items-center">
                      <Form.Label column sm={5} className="small fw-bold text-secondary text-sm-end text-start">
                        Maliyet :
                      </Form.Label>
                      <Col sm={7}>
                        <InputGroup size="sm">
                          <Form.Control
                            type="text"
                            inputMode="decimal"
                            value={maliyet === 0 || maliyet === "0" ? "" : (maliyet ?? "")}
                            onChange={(e) => handleMaliyetChange(cleanNum(e.target.value))}
                            className="fw-bold font-monospace text-end"
                            placeholder=""
                          />
                          <InputGroup.Text
                            className="font-monospace fw-bold bg-white text-dark border-end-0 px-2 cursor-pointer"
                            onClick={() => setShowParaLookupTarget("maliyet")}
                            style={{ minWidth: "50px", textAlign: "center", cursor: "pointer" }}
                            title="Para Birimi"
                          >
                            {maliyetParaKodu || "USD"}
                          </InputGroup.Text>
                          <Button
                            variant="outline-secondary"
                            size="sm"
                            className="px-2 d-flex align-items-center"
                            onClick={() => setShowParaLookupTarget("maliyet")}
                            title="Para Birimi Seç (Dürbün)"
                          >
                            <IconBinoculars size={14} />
                          </Button>
                        </InputGroup>
                      </Col>
                    </Form.Group>

                    {/* Kâr Yüzdesi */}
                    <Form.Group as={Row} className="mb-2 align-items-center">
                      <Form.Label column sm={5} className="small fw-bold text-secondary text-sm-end text-start">
                        Kâr Yüzdesi :
                      </Form.Label>
                      <Col sm={7}>
                        <InputGroup size="sm">
                          <Form.Control
                            type="text"
                            inputMode="decimal"
                            value={karYuzdesi === 0 || karYuzdesi === "0" ? "" : (karYuzdesi ?? "")}
                            onChange={(e) => handleKarYuzdeChange(cleanNum(e.target.value))}
                            className="font-monospace text-end fw-bold text-success"
                            placeholder=""
                          />
                          <InputGroup.Text className="bg-light">%</InputGroup.Text>
                        </InputGroup>
                      </Col>
                    </Form.Group>

                    {/* Sabitle Checkbox */}
                    <Form.Group as={Row} className="mb-2 align-items-center">
                      <Form.Label column sm={5} className="small fw-bold text-secondary text-sm-end text-start">
                        Fiyat Sabitle :
                      </Form.Label>
                      <Col sm={7}>
                        <Form.Check
                          type="checkbox"
                          id="sabitleCheck"
                          label="Sabitle (Otomatik Değişmez)"
                          checked={sabitle}
                          onChange={(e) => setSabitle(e.target.checked)}
                          className="small fw-semibold text-secondary"
                        />
                      </Col>
                    </Form.Group>

                    {/* Satış Fiyatı */}
                    <Form.Group as={Row} className="mb-2 align-items-center">
                      <Form.Label column sm={5} className="small fw-bold text-secondary text-sm-end text-start">
                        Satış Fiyatı :
                      </Form.Label>
                      <Col sm={7}>
                        <InputGroup size="sm">
                          <Form.Control
                            type="text"
                            inputMode="decimal"
                            value={satisFiyati === 0 || satisFiyati === "0" ? "" : (satisFiyati ?? "")}
                            onChange={(e) => handleSatisFiyatChange(cleanNum(e.target.value))}
                            className="fw-bold font-monospace text-primary text-end"
                            style={{ fontSize: "14px" }}
                            placeholder=""
                          />
                          <InputGroup.Text
                            className="font-monospace fw-bold bg-white text-primary border-end-0 px-2 cursor-pointer"
                            onClick={() => setShowParaLookupTarget("satis")}
                            style={{ minWidth: "50px", textAlign: "center", cursor: "pointer" }}
                            title="Para Birimi"
                          >
                            {satisParaKodu || "USD"}
                          </InputGroup.Text>
                          <Button
                            variant="outline-secondary"
                            size="sm"
                            className="px-2 d-flex align-items-center"
                            onClick={() => setShowParaLookupTarget("satis")}
                            title="Para Birimi Seç (Dürbün)"
                          >
                            <IconBinoculars size={14} />
                          </Button>
                        </InputGroup>
                      </Col>
                    </Form.Group>

                    {/* Hızlı Giriş Checkbox */}
                    <Form.Group as={Row} className="mb-2 align-items-center">
                      <Form.Label column sm={5} className="small fw-bold text-secondary text-sm-end text-start">
                        Hızlı Giriş :
                      </Form.Label>
                      <Col sm={7}>
                        <Form.Check
                          type="checkbox"
                          id="hizliGirisCheck"
                          label="Hızlı Giriş Modu"
                          checked={hizliGiris}
                          onChange={(e) => setHizliGiris(e.target.checked)}
                          className="small fw-semibold text-secondary"
                        />
                      </Col>
                    </Form.Group>
                  </Col>

                  {/* Fotoğraf / Kamera Önizleme */}
                  <Col sm={4} className="d-flex flex-column align-items-center justify-content-center">
                    <div
                      className="border rounded d-flex align-items-center justify-content-center bg-light w-100 mb-2 overflow-hidden position-relative"
                      style={{ height: "145px" }}
                    >
                      {resim ? (
                        <img src={resim} alt="Ürün" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                      ) : (
                        <div className="text-center text-muted small">
                          <IconCamera size={30} className="mb-1 opacity-50" />
                          <div>Fotoğraf Yok</div>
                        </div>
                      )}
                    </div>
                    <div className="d-flex gap-1.5 w-100">
                      <input
                        type="file"
                        accept="image/*"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        style={{ display: "none" }}
                      />
                      <Button
                        variant="outline-primary"
                        size="sm"
                        className="flex-fill fw-bold"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        ÇEK
                      </Button>
                      <Button
                        variant="outline-danger"
                        size="sm"
                        className="flex-fill fw-bold"
                        onClick={() => setResim(null)}
                        disabled={!resim}
                      >
                        R.Sil
                      </Button>
                    </div>
                  </Col>
                </Row>
              </div>
            </Col>
          </Row>

          {/* 3. Taş Bilgileri Ekle Gridi (CariEmanetDekontPage Vezne Giriş Formatında) */}
          <div className="mt-3 border rounded bg-white shadow-sm" style={{ borderColor: "#cbd5e1" }}>
            <div
              className="d-flex align-items-center justify-content-between px-3 py-2 border-bottom"
              style={{ backgroundColor: "#f8fafc" }}
            >
              <div className="fw-bold text-primary d-flex align-items-center gap-2" style={{ fontSize: "13px" }}>
                <IconDiamond size={17} />
                <span>Taş Bilgileri</span>
              </div>
              <div className="text-secondary small">
                <kbd style={{ fontSize: "11px", backgroundColor: "#e2e8f0", color: "#334155" }}>Enter</kbd> ile geçiş / yeni satır — <kbd style={{ fontSize: "11px", backgroundColor: "#e2e8f0", color: "#334155" }}>Sağ Tık</kbd> ile sil / ekle
              </div>
            </div>

            <div style={{ maxHeight: "260px", overflowY: "auto", overflowX: "auto" }}>
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
                      height: "26px",
                      color: "#0f3e74",
                      textAlign: "center",
                      position: "sticky",
                      top: 0,
                      zIndex: 1,
                      fontWeight: 600,
                    }}
                  >
                    <th style={{ width: "38px", padding: "2px 4px", borderRight: "1px solid #8ab8ee" }}>#</th>
                    <th style={{ width: "150px", padding: "2px 6px", borderRight: "1px solid #8ab8ee" }}>Taş Cinsi</th>
                    <th style={{ width: "110px", padding: "2px 6px", borderRight: "1px solid #8ab8ee" }}>Miktar (Ct)</th>
                    <th style={{ width: "70px", padding: "2px 6px", borderRight: "1px solid #8ab8ee" }}>Birim</th>
                    <th style={{ width: "70px", padding: "2px 6px", borderRight: "1px solid #8ab8ee" }}>Renk</th>
                    <th style={{ width: "80px", padding: "2px 6px", borderRight: "1px solid #8ab8ee" }}>Saflık</th>
                    <th style={{ width: "75px", padding: "2px 6px", borderRight: "1px solid #8ab8ee" }}>Adet</th>
                    <th style={{ width: "120px", padding: "2px 6px", borderRight: "1px solid #8ab8ee" }}>Tutar</th>
                    <th style={{ width: "95px", padding: "2px 6px" }}>Para Br.</th>
                  </tr>
                </thead>
                <tbody>
                  {tasSatirlari.map((row, idx) => (
                    <tr
                      key={row.id}
                      data-row-id={row.id}
                      style={{
                        height: "25px",
                        borderBottom: "1px solid #e0e0e0",
                        backgroundColor: idx === selectedTasIndex ? "#f1f5f9" : "#ffffff",
                      }}
                      onClick={() => setSelectedTasIndex(idx)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setSelectedTasIndex(idx);
                        setContextMenu({ x: e.clientX, y: e.clientY, rowIndex: idx });
                      }}
                    >
                      {/* 1. Sıra No */}
                      <td
                        className="text-center text-muted fw-bold font-monospace"
                        style={{ padding: 0, borderRight: "1px solid #e0e0e0", fontSize: "11px", backgroundColor: "#f8fafc" }}
                      >
                        {idx + 1}
                      </td>

                      {/* 2. Taş Cinsi */}
                      <td style={{ padding: 0, borderRight: "1px solid #e0e0e0" }}>
                        <select
                          id={`grid-tas-${idx}-tasCinsi`}
                          value={row.tasCinsi}
                          onChange={(e) => handleTasChange(idx, "tasCinsi", e.target.value)}
                          onFocus={() => setSelectedTasIndex(idx)}
                          onKeyDown={(e) => handleTasCellKeyDown(e, idx, "tasCinsi")}
                          style={{
                            width: "100%",
                            height: "23px",
                            border: "none",
                            outline: "none",
                            padding: "0 4px",
                            fontSize: "12px",
                            fontWeight: 600,
                            color: "#0f172a",
                            backgroundColor: "transparent",
                            cursor: "pointer",
                          }}
                        >
                          <option value="Diamond1">Diamond1</option>
                          <option value="Pırlanta">Pırlanta</option>
                          <option value="Safir">Safir</option>
                          <option value="Zümrüt">Zümrüt</option>
                          <option value="Yakut">Yakut</option>
                          <option value="Baget">Baget</option>
                          <option value="İnci">İnci</option>
                          <option value="Elmas">Elmas</option>
                        </select>
                      </td>

                      {/* 3. Miktar (Ct) */}
                      <td style={{ padding: 0, borderRight: "1px solid #e0e0e0" }}>
                        <input
                          id={`grid-tas-${idx}-tasMiktar`}
                          type="text"
                          inputMode="decimal"
                          value={row.tasMiktar}
                          onChange={(e) => handleTasChange(idx, "tasMiktar", cleanNum(e.target.value))}
                          onFocus={() => setSelectedTasIndex(idx)}
                          onKeyDown={(e) => handleTasCellKeyDown(e, idx, "tasMiktar")}
                          placeholder=""
                          style={{
                            width: "100%",
                            height: "23px",
                            border: "none",
                            outline: "none",
                            padding: "0 6px",
                            fontSize: "12.5px",
                            textAlign: "right",
                            fontFamily: "monospace",
                            fontWeight: 500,
                            color: "#0f172a",
                            backgroundColor: "transparent",
                          }}
                        />
                      </td>

                      {/* 4. Birim */}
                      <td style={{ padding: 0, borderRight: "1px solid #e0e0e0" }}>
                        <select
                          id={`grid-tas-${idx}-tasBirim`}
                          value={row.tasBirim}
                          onChange={(e) => handleTasChange(idx, "tasBirim", e.target.value)}
                          onFocus={() => setSelectedTasIndex(idx)}
                          onKeyDown={(e) => handleTasCellKeyDown(e, idx, "tasBirim")}
                          style={{
                            width: "100%",
                            height: "23px",
                            border: "none",
                            outline: "none",
                            padding: "0 2px",
                            fontSize: "12px",
                            fontFamily: "monospace",
                            color: "#0f172a",
                            backgroundColor: "transparent",
                          }}
                        >
                          <option value="Ct">Ct</option>
                          <option value="Gr">Gr</option>
                          <option value="Adet">Adet</option>
                        </select>
                      </td>

                      {/* 5. Renk */}
                      <td style={{ padding: 0, borderRight: "1px solid #e0e0e0" }}>
                        <select
                          id={`grid-tas-${idx}-tasRenk`}
                          value={row.tasRenk}
                          onChange={(e) => handleTasChange(idx, "tasRenk", e.target.value)}
                          onFocus={() => setSelectedTasIndex(idx)}
                          onKeyDown={(e) => handleTasCellKeyDown(e, idx, "tasRenk")}
                          style={{
                            width: "100%",
                            height: "23px",
                            border: "none",
                            outline: "none",
                            padding: "0 2px",
                            fontSize: "12px",
                            fontFamily: "monospace",
                            color: "#0f172a",
                            backgroundColor: "transparent",
                          }}
                        >
                          {["D", "E", "F", "G", "H", "I", "J", "K", "L", "M"].map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* 6. Saflık */}
                      <td style={{ padding: 0, borderRight: "1px solid #e0e0e0" }}>
                        <select
                          id={`grid-tas-${idx}-tasSaflik`}
                          value={row.tasSaflik}
                          onChange={(e) => handleTasChange(idx, "tasSaflik", e.target.value)}
                          onFocus={() => setSelectedTasIndex(idx)}
                          onKeyDown={(e) => handleTasCellKeyDown(e, idx, "tasSaflik")}
                          style={{
                            width: "100%",
                            height: "23px",
                            border: "none",
                            outline: "none",
                            padding: "0 2px",
                            fontSize: "12px",
                            fontFamily: "monospace",
                            color: "#0f172a",
                            backgroundColor: "transparent",
                          }}
                        >
                          {["FL", "IF", "VVS1", "VVS2", "VS1", "VS2", "SI1", "SI2", "I1"].map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* 7. Adet */}
                      <td style={{ padding: 0, borderRight: "1px solid #e0e0e0" }}>
                        <input
                          id={`grid-tas-${idx}-tasAdet`}
                          type="text"
                          inputMode="numeric"
                          value={row.tasAdet}
                          onChange={(e) => handleTasChange(idx, "tasAdet", cleanNum(e.target.value))}
                          onFocus={() => setSelectedTasIndex(idx)}
                          onKeyDown={(e) => handleTasCellKeyDown(e, idx, "tasAdet")}
                          placeholder=""
                          style={{
                            width: "100%",
                            height: "23px",
                            border: "none",
                            outline: "none",
                            padding: "0 4px",
                            fontSize: "12.5px",
                            textAlign: "center",
                            fontFamily: "monospace",
                            fontWeight: 500,
                            color: "#0f172a",
                            backgroundColor: "transparent",
                          }}
                        />
                      </td>

                      {/* 8. Tutar */}
                      <td style={{ padding: 0, borderRight: "1px solid #e0e0e0" }}>
                        <input
                          id={`grid-tas-${idx}-tasTutar`}
                          type="text"
                          inputMode="decimal"
                          value={row.tasTutar}
                          onChange={(e) => handleTasChange(idx, "tasTutar", cleanNum(e.target.value))}
                          onFocus={() => setSelectedTasIndex(idx)}
                          onKeyDown={(e) => handleTasCellKeyDown(e, idx, "tasTutar")}
                          placeholder=""
                          style={{
                            width: "100%",
                            height: "23px",
                            border: "none",
                            outline: "none",
                            padding: "0 6px",
                            fontSize: "12.5px",
                            textAlign: "right",
                            fontFamily: "monospace",
                            fontWeight: 500,
                            color: "#0f172a",
                            backgroundColor: "transparent",
                          }}
                        />
                      </td>

                      {/* 9. Para Birimi */}
                      <td style={{ padding: "0 4px" }}>
                        <div className="d-flex align-items-center justify-content-between">
                          <span
                            id={`grid-tas-${idx}-tasTutarBirimi`}
                            tabIndex={0}
                            onFocus={() => setSelectedTasIndex(idx)}
                            onKeyDown={(e) => handleTasCellKeyDown(e, idx, "tasTutarBirimi")}
                            onClick={() => setShowParaLookupTarget({ tasIndex: idx })}
                            className="font-monospace fw-bold text-primary px-1"
                            style={{ fontSize: "12px", outline: "none", cursor: "pointer" }}
                            title="Para Birimi Değiştir (Dürbün)"
                          >
                            {row.tasTutarBirimi || "USD"}
                          </span>
                          <Button
                            variant="link"
                            className="p-0 px-1 text-secondary text-decoration-none"
                            onClick={() => setShowParaLookupTarget({ tasIndex: idx })}
                            title="Para Seç (Dürbün)"
                          >
                            <IconBinoculars size={13} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Dip Toplam */}
            <div className="d-flex flex-wrap align-items-center justify-content-between p-2 px-3 border-top bg-light">
              <div className="text-muted small">
                Toplam <strong className="text-dark">{tasSatirlari.length}</strong> taş satırı tanımlı
              </div>
              <div className="d-flex align-items-center gap-3">
                <div className="d-flex align-items-center gap-1.5">
                  <span className="small text-secondary fw-semibold">Top. Karat:</span>
                  <span className="fw-bold font-monospace text-dark px-2 py-0.5 border bg-white rounded" style={{ fontSize: "12px" }}>
                    {totalTasKarat.toFixed(2)} Ct
                  </span>
                </div>
                <div className="d-flex align-items-center gap-1.5">
                  <span className="small text-secondary fw-semibold">Top. Adet:</span>
                  <span className="fw-bold font-monospace text-dark px-2 py-0.5 border bg-white rounded" style={{ fontSize: "12px" }}>
                    {totalTasAdet}
                  </span>
                </div>
                <div className="d-flex align-items-center gap-1.5">
                  <span className="small text-secondary fw-semibold">Top. Tutar:</span>
                  <span className="fw-bold font-monospace text-primary px-2.5 py-0.5 border bg-white rounded" style={{ fontSize: "13px" }}>
                    {totalTasTutar.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {tasSatirlari[0]?.tasTutarBirimi || "USD"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* ─── Sağ Tık Context Menu (Taş Tablosu) ────────────────────────────── */}
      {contextMenu && (
        <div
          style={{
            position: "fixed",
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 9999,
            backgroundColor: "#ffffff",
            border: "1px solid #cbd5e1",
            borderRadius: "6px",
            boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
            padding: "4px 0",
            minWidth: "160px",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="px-3 py-2 d-flex align-items-center gap-2 text-dark font-monospace fw-semibold"
            style={{ fontSize: "12.5px", cursor: "pointer" }}
            onClick={() => {
              addNewTasRow();
              setContextMenu(null);
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f1f5f9")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <IconPlus size={15} className="text-success" />
            <span>Yeni Satır Ekle</span>
          </div>
          <div
            className="px-3 py-2 d-flex align-items-center gap-2 text-danger font-monospace fw-semibold border-top"
            style={{ fontSize: "12.5px", cursor: "pointer" }}
            onClick={() => {
              handleRemoveTasRow(contextMenu.rowIndex);
              setContextMenu(null);
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#fee2e2")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <IconTrash size={15} />
            <span>Satırı Sil</span>
          </div>
        </div>
      )}

      {/* ─── MODALLAR ────────────────────────────────────────────────────────── */}

      {/* Özel Ürün Lookup Modalı (F3) */}
      <LookupModal<OzelUrunItem>
        show={showLookup}
        title="Barkodlu Özel Ürün Listesi"
        columns={lookupColumns}
        items={ozelList}
        filterFn={(it, term) => {
          const t = term.toLowerCase();
          return (
            (it.grupKodu ? it.grupKodu.toLowerCase().includes(t) : false) ||
            (it.barkod ? it.barkod.toLowerCase().includes(t) : false) ||
            (it.mamulTipi ? it.mamulTipi.toLowerCase().includes(t) : false) ||
            (it.orjinalKod ? it.orjinalKod.toLowerCase().includes(t) : false) ||
            (it.ureticiFirma ? it.ureticiFirma.toLowerCase().includes(t) : false) ||
            (it.tasCinsi ? it.tasCinsi.toLowerCase().includes(t) : false) ||
            String(it.urunNo).includes(t)
          );
        }}
        onSelect={(selected) => {
          handleSelectUrun(selected);
          setShowLookup(false);
        }}
        onHide={() => setShowLookup(false)}
      />

      {/* Üretici Firma Lookup Modalı (F4) */}
      <LookupModal<CariKartItem>
        show={showFirmaLookup}
        title="Üretici Firma Seçiniz"
        columns={firmaLookupColumns}
        items={cariList}
        filterFn={(it, term) => {
          const t = term.toLowerCase();
          return (
            (it.kod ? it.kod.toLowerCase().includes(t) : false) ||
            (it.ad ? it.ad.toLowerCase().includes(t) : false) ||
            (it.yetkiliKisi ? it.yetkiliKisi.toLowerCase().includes(t) : false) ||
            (it.telefon ? it.telefon.toLowerCase().includes(t) : false)
          );
        }}
        onSelect={(selected) => {
          setUreticiFirma(selected.ad || selected.kod || "");
          setShowFirmaLookup(false);
        }}
        onHide={() => setShowFirmaLookup(false)}
      />

      {/* Para / Döviz Birimi Lookup Modalı */}
      <LookupModal<ParaItem>
        show={Boolean(showParaLookupTarget)}
        title="Para / Döviz Birimi Seçiniz"
        columns={paraLookupColumns}
        items={paraList}
        filterFn={(it, term) => {
          const t = term.toLowerCase();
          return (
            (it.kod ? it.kod.toLowerCase().includes(t) : false) ||
            (it.ad ? it.ad.toLowerCase().includes(t) : false)
          );
        }}
        onSelect={(selected) => {
          if (showParaLookupTarget === "maliyet") {
            setMaliyetParaKodu(selected.kod);
          } else if (showParaLookupTarget === "satis") {
            setSatisParaKodu(selected.kod);
          } else if (
            typeof showParaLookupTarget === "object" &&
            showParaLookupTarget !== null &&
            "tasIndex" in showParaLookupTarget
          ) {
            handleTasChange(showParaLookupTarget.tasIndex, "tasTutarBirimi", selected.kod);
          }
          setShowParaLookupTarget(null);
        }}
        onHide={() => setShowParaLookupTarget(null)}
      />

      {/* Etiket Yazdır Modalı */}
      <EtiketYazdirModal
        show={showPrintModal}
        onHide={() => setShowPrintModal(false)}
        title="Özel Ürün Barkod Etiketi Basımı"
        sablon={sablonlar[0] || null}
        items={printItems}
      />

      {/* Silme Onay Modalı */}
      <Modal show={showDeleteConfirm} onHide={() => setShowDeleteConfirm(false)} centered size="sm">
        <Modal.Header closeButton className="py-2 bg-danger text-white">
          <Modal.Title className="fs-6 fw-bold">Özel Ürün Kaydı Silme</Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3">
          <p className="mb-0 text-secondary" style={{ fontSize: "13.5px" }}>
            <strong>#{ozelUrunId}</strong> numaralı (<strong>{grupKodu}-{urunNo}</strong>) özel ürün kaydını silmek istediğinize emin misiniz?
          </p>
        </Modal.Body>
        <Modal.Footer className="py-1 px-3">
          <Button variant="secondary" size="sm" onClick={() => setShowDeleteConfirm(false)}>
            Vazgeç
          </Button>
          <Button variant="danger" size="sm" onClick={handleDelete} disabled={isSaving}>
            Evet, Sil
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default OzelUrunTanimlamaPage;
