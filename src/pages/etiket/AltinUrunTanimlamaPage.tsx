import React, { useState, useEffect, useCallback, useRef } from "react";
import { Container, Row, Col, Card, Form, Button, Alert, InputGroup, Badge, Modal } from "react-bootstrap";
import {
  IconBarcode,
  IconCheck,
  IconAlertTriangle,
  IconBinoculars,
  IconPrinter,
  IconCamera,
  IconTrash,
  IconPlus,
  IconRefresh,
  IconArrowLeft,
  IconArrowRight,
  IconX,
  IconScale,
  IconCoin,
  IconCalculator,
} from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import LookupModal, { LookupColumn } from "../../components/common/LookupModal";
import EtiketYazdirModal, { EtiketYazdirItem } from "./EtiketYazdirModal";
import {
  EtiketService,
  AltinUrunItem,
  SaveAltinUrunPayload,
  EtiketSablonItem,
} from "../../services/etiketService";
import { CariService, CariKartItem } from "../../services/cariService";
import { KurService, KurRowItem } from "../../services/kurService";

const AYAR_MILYEM_MAP: Record<string, number> = {
  "24": 1000,
  "24 AYAR": 1000,
  "22": 916,
  "22 AYAR": 916,
  "22 FANTAZI": 916,
  "22 FANTAZİ": 916,
  "18": 750,
  "18 AYAR": 750,
  "14": 585,
  "14 AYAR": 585,
  "8": 333,
  "8 AYAR": 333,
};

export const AltinUrunTanimlamaPage: React.FC = () => {
  // ─── Form State ─────────────────────────────────────────────────────────────
  const [altinUrunId, setAltinUrunId] = useState<number | null>(null);
  const [tarih, setTarih] = useState<string>(new Date().toISOString().slice(0, 10));
  const [grupKodu, setGrupKodu] = useState<string>("");
  const [urunNo, setUrunNo] = useState<number | string>("");
  const [barkod, setBarkod] = useState<string>("");
  const [ayar, setAyar] = useState<string>("22 FANTAZI");
  const [ureticiFirma, setUreticiFirma] = useState<string>("");
  const [orjinalKod, setOrjinalKod] = useState<string>("");
  const [model, setModel] = useState<string>("");
  const [banko, setBanko] = useState<string>("Banko 1");

  // Gramaj ve Hesap Alanları
  const [miktar, setMiktar] = useState<number | string>("");
  const [hasGram, setHasGram] = useState<number | string>("");
  const [maliyetIscilik, setMaliyetIscilik] = useState<number | string>("");
  const [maliyetIscilikParaKodu, setMaliyetIscilikParaKodu] = useState<string>("HAS");
  const [maliyetIscilikBirim, setMaliyetIscilikBirim] = useState<string>("Gram");
  const [maliyetIscilikTutari, setMaliyetIscilikTutari] = useState<number | string>("");

  const [satisIscilik, setSatisIscilik] = useState<number | string>("");
  const [satisIscilikTutari, setSatisIscilikTutari] = useState<number | string>("");
  const [iscilikKari, setIscilikKari] = useState<number | string>("");

  // Maliyet, Satış & Kâr
  const [maliyet, setMaliyet] = useState<number | string>("");
  const [maliyetParaKodu, setMaliyetParaKodu] = useState<string>("HAS");
  const [satisFiyati, setSatisFiyati] = useState<number | string>("");
  const [satisParaKodu, setSatisParaKodu] = useState<string>("HAS");
  const [satisKariYuzde, setSatisKariYuzde] = useState<number | string>("");

  // Anlık Kur Göstergeleri
  const [hasKuru1, setHasKuru1] = useState<number | string>("");
  const [hasKuru2, setHasKuru2] = useState<number | string>("");
  const [altinKuru, setAltinKuru] = useState<number | string>("");

  // Resim / Fotoğraf
  const [resim, setResim] = useState<string | null>(null);

  // ─── UI & Liste State ───────────────────────────────────────────────────────
  const [altinList, setAltinList] = useState<AltinUrunItem[]>([]);
  const [grupList, setGrupList] = useState<string[]>([]);
  const [ureticiList, setUreticiList] = useState<string[]>([]);
  const [cariList, setCariList] = useState<CariKartItem[]>([]);
  const [sablonlar, setSablonlar] = useState<EtiketSablonItem[]>([]);
  const [kurRows, setKurRows] = useState<KurRowItem[]>([]);

  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "danger" | "warning"; message: string } | null>(null);

  const [showLookup, setShowLookup] = useState(false);
  const [showFirmaLookup, setShowFirmaLookup] = useState(false);
  const [showKurLookup, setShowKurLookup] = useState<"has1" | "altin" | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const grupKoduRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    grupKoduRef.current?.focus();
  }, []);

  const showNotif = (type: "success" | "danger" | "warning", msg: string) => {
    setNotification({ type, message: msg });
    setTimeout(() => setNotification(null), 4000);
  };

  // ─── Otomatik Hesaplama Motoru (İşçilik, Has, Maliyet, Satış, Kâr) ─────────
  // ─── Yardımcı Sayı Temizleme Fonksiyonu ─────────────────────────────────────
  const cleanNum = (val: string): string => {
    let cleaned = val.replace(/,/g, ".").replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    if (parts.length > 2) {
      cleaned = parts[0] + "." + parts.slice(1).join("");
    }
    return cleaned;
  };

  // ─── Hesaplama Motoru ────────────────────────────────────────────────────────
  const recalculateAll = useCallback(
    (
      curMiktar: number,
      curAyar: string,
      curMaliyetIscilik: number,
      curMaliyetBirim: string,
      curSatisIscilik: number,
      curMaliyetPara: string,
      curSatisPara: string,
      manualKarYuzde?: number
    ) => {
      const milyem = AYAR_MILYEM_MAP[curAyar.toUpperCase()] || 916;
      // 1. Has Karşılığı
      const calcHas = curMiktar > 0 ? Number((curMiktar * (milyem / 1000)).toFixed(3)) : "";
      setHasGram(calcHas);

      // 2. Maliyet İşçilik Tutarı
      const calcMaliyetIscilikTutari =
        curMaliyetIscilik > 0
          ? curMaliyetBirim === "Gram"
            ? Number((curMaliyetIscilik * (curMiktar || 1)).toFixed(3))
            : Number(curMaliyetIscilik.toFixed(3))
          : "";
      setMaliyetIscilikTutari(calcMaliyetIscilikTutari);

      // 3. Satış İşçilik Tutarı
      const calcSatisIscilikTutari =
        curSatisIscilik > 0
          ? curMaliyetBirim === "Gram"
            ? Number((curSatisIscilik * (curMiktar || 1)).toFixed(3))
            : Number(curSatisIscilik.toFixed(3))
          : "";
      setSatisIscilikTutari(calcSatisIscilikTutari);

      // 4. İşçilik Kârı
      const cMaliyetIscilik = typeof calcMaliyetIscilikTutari === "number" ? calcMaliyetIscilikTutari : 0;
      const cSatisIscilik = typeof calcSatisIscilikTutari === "number" ? calcSatisIscilikTutari : 0;
      const calcIscilikKari = (cSatisIscilik > 0 || cMaliyetIscilik > 0) ? Number((cSatisIscilik - cMaliyetIscilik).toFixed(3)) : "";
      setIscilikKari(calcIscilikKari);

      // 5. Toplam Maliyet Tutarı
      const cHas = typeof calcHas === "number" ? calcHas : 0;
      const calcMaliyet = (cHas > 0 || cMaliyetIscilik > 0) ? Number((cHas + cMaliyetIscilik).toFixed(3)) : "";
      setMaliyet(calcMaliyet);

      // 6. Toplam Satış Tutarı
      const calcSatis = (cHas > 0 || cSatisIscilik > 0) ? Number((cHas + cSatisIscilik).toFixed(3)) : "";
      setSatisFiyati(calcSatis);

      // 7. Satış Kârı % (Has bazlı kâr)
      if (manualKarYuzde !== undefined && !isNaN(manualKarYuzde) && manualKarYuzde !== 0) {
        setSatisKariYuzde(manualKarYuzde);
      } else if (typeof calcMaliyet === "number" && calcMaliyet > 0 && typeof calcSatis === "number" && calcSatis > 0) {
        const yuzde = Number((((calcSatis - calcMaliyet) / calcMaliyet) * 100).toFixed(2));
        setSatisKariYuzde(yuzde);
      } else {
        setSatisKariYuzde("");
      }
    },
    []
  );

  // ─── Event Handlers ─────────────────────────────────────────────────────────
  const handleAyarChange = (newAyar: string) => {
    setAyar(newAyar);
    recalculateAll(
      Number(miktar) || 0,
      newAyar,
      Number(maliyetIscilik) || 0,
      maliyetIscilikBirim,
      Number(satisIscilik) || 0,
      maliyetParaKodu,
      satisParaKodu
    );
  };

  const handleMiktarChange = (val: string) => {
    setMiktar(val);
    const num = parseFloat(val) || 0;
    recalculateAll(
      num,
      ayar,
      Number(maliyetIscilik) || 0,
      maliyetIscilikBirim,
      Number(satisIscilik) || 0,
      maliyetParaKodu,
      satisParaKodu
    );
  };

  const handleMaliyetIscilikChange = (val: string) => {
    setMaliyetIscilik(val);
    const num = parseFloat(val) || 0;
    recalculateAll(
      Number(miktar) || 0,
      ayar,
      num,
      maliyetIscilikBirim,
      Number(satisIscilik) || 0,
      maliyetParaKodu,
      satisParaKodu
    );
  };

  const handleSatisIscilikChange = (val: string) => {
    setSatisIscilik(val);
    const num = parseFloat(val) || 0;
    recalculateAll(
      Number(miktar) || 0,
      ayar,
      Number(maliyetIscilik) || 0,
      maliyetIscilikBirim,
      num,
      maliyetParaKodu,
      satisParaKodu
    );
  };

  const handleMaliyetBirimChange = (newBirim: string) => {
    setMaliyetIscilikBirim(newBirim);
    recalculateAll(
      Number(miktar) || 0,
      ayar,
      Number(maliyetIscilik) || 0,
      newBirim,
      Number(satisIscilik) || 0,
      maliyetParaKodu,
      satisParaKodu
    );
  };

  const handleSatisFiyatiChange = (val: string) => {
    setSatisFiyati(val);
    const num = parseFloat(val) || 0;
    const curMaliyet = Number(maliyet) || 0;
    if (curMaliyet > 0 && num > 0) {
      const yuzde = Number((((num - curMaliyet) / curMaliyet) * 100).toFixed(2));
      setSatisKariYuzde(yuzde);
    } else if (!val) {
      setSatisKariYuzde("");
    }
  };

  const handleKarYuzdeChange = (val: string) => {
    setSatisKariYuzde(val);
    const yuzde = parseFloat(val) || 0;
    const curMaliyet = Number(maliyet) || 0;
    if (curMaliyet > 0 && val !== "") {
      const newSatis = Number((curMaliyet * (1 + yuzde / 100)).toFixed(3));
      setSatisFiyati(newSatis);
    }
  };

  const handleMaliyetChange = (val: string) => {
    setMaliyet(val);
    const num = parseFloat(val) || 0;
    const curSatis = Number(satisFiyati) || 0;
    if (num > 0 && curSatis > 0) {
      const yuzde = Number((((curSatis - num) / num) * 100).toFixed(2));
      setSatisKariYuzde(yuzde);
    }
  };

  const handleHasGramChange = (val: string) => {
    setHasGram(val);
    const num = parseFloat(val) || 0;
    const curMaliyetTutari = Number(maliyetIscilikTutari) || 0;
    if (val !== "") {
      const calcMaliyet = Number((num + curMaliyetTutari).toFixed(3));
      setMaliyet(calcMaliyet);
      const curSatisTutari = Number(satisIscilikTutari) || 0;
      const calcSatis = Number((num + curSatisTutari).toFixed(3));
      setSatisFiyati(calcSatis);
    }
  };

  const handleMaliyetIscilikTutariChange = (val: string) => {
    setMaliyetIscilikTutari(val);
    const num = parseFloat(val) || 0;
    const curHas = Number(hasGram) || 0;
    if (val !== "" || curHas > 0) {
      setMaliyet(Number((curHas + num).toFixed(3)));
    }
  };

  const handleSatisIscilikTutariChange = (val: string) => {
    setSatisIscilikTutari(val);
    const num = parseFloat(val) || 0;
    const curHas = Number(hasGram) || 0;
    if (val !== "" || curHas > 0) {
      setSatisFiyati(Number((curHas + num).toFixed(3)));
    }
  };

  const handleIscilikKariChange = (val: string) => {
    setIscilikKari(val);
    const num = parseFloat(val) || 0;
    const curMaliyetIscilik = Number(maliyetIscilikTutari) || 0;
    if (val !== "" || curMaliyetIscilik > 0) {
      setSatisIscilikTutari(Number((curMaliyetIscilik + num).toFixed(3)));
    }
  };

  // ─── Veri Yükleme ────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    try {
      const [list, gruplar, ureticiler, sabl, cariler, kurTablosu] = await Promise.all([
        EtiketService.getAltinUrunler({ limit: 500 }),
        EtiketService.getGrupKodlari().catch(() => []),
        EtiketService.getUreticiFirmalar().catch(() => []),
        EtiketService.getSablonlar(0).catch(() => []),
        CariService.getCariKartlar().catch(() => [] as CariKartItem[]),
        KurService.getKurTablosu({ tur: 0 }).catch(() => null),
      ]);
      setAltinList(list);
      setGrupList(gruplar.length ? gruplar : ["ALYANS", "BILEZIK", "KOLYE", "KUPE", "YUZUK", "ZINCIR"]);
      setUreticiList(ureticiler.length ? ureticiler : ["DOVIZ A-S", "ALTINBAS", "ATASAY", "FAVORİ"]);
      setSablonlar(sabl);
      setCariList(cariler.length ? cariler : ureticiler.map((u, idx) => ({ id: idx, kod: `FRM${idx + 1}`, ad: u, kisilikTipi: 1 } as any)));

      if (kurTablosu?.satirlar && kurTablosu.satirlar.length > 0) {
        setKurRows(kurTablosu.satirlar);
        const hasRow = kurTablosu.satirlar.find((s) => (s.kod || "").toUpperCase() === "HAS");
        if (hasRow && (hasRow.dovizSatis || hasRow.dovizAlis)) {
          setHasKuru1((prev) => (prev ? prev : String(hasRow.dovizSatis || hasRow.dovizAlis)));
        }
        const altinRow = kurTablosu.satirlar.find((s) => {
          const k = (s.kod || "").toUpperCase();
          return k.includes("ALTIN") || k.includes("24") || k.includes("USD");
        });
        if (altinRow && (altinRow.dovizSatis || altinRow.dovizAlis)) {
          setAltinKuru((prev) => (prev ? prev : String(altinRow.dovizSatis || altinRow.dovizAlis)));
        }
      }
    } catch (err: any) {
      showNotif("danger", err?.message || "Altın stok listesi yüklenemedi.");
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ─── Ürün Seçimi ─────────────────────────────────────────────────────────────
  const handleSelectUrun = (it: AltinUrunItem) => {
    setAltinUrunId(it.altinUrunId);
    setTarih(it.tarih ? it.tarih.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setGrupKodu(it.grupKodu || "");
    setUrunNo(it.urunNo || "");
    setBarkod(it.barkod || (it.grupKodu && it.urunNo ? `${it.grupKodu}${it.urunNo}` : ""));
    setAyar(it.ayar || "22 FANTAZI");
    setUreticiFirma(it.ureticiFirma || "");
    setOrjinalKod(it.orjinalKod || "");
    setModel(it.model || "");
    setBanko(it.banko || "Banko 1");

    setMiktar(it.miktar ?? "");
    setHasGram(it.hasGram ?? "");
    setMaliyetIscilik(it.maliyetIscilik ?? "");
    setMaliyetIscilikParaKodu(it.maliyetIscilikParaKodu || "HAS");
    setMaliyetIscilikBirim(it.maliyetIscilikBirim || "Gram");
    setMaliyetIscilikTutari(it.maliyetIscilikTutari ?? "");

    setSatisIscilik(it.satisIscilik ?? "");
    setSatisIscilikTutari(it.satisIscilikTutari ?? "");
    setIscilikKari(it.iscilikKari ?? "");

    setMaliyet(it.maliyet ?? "");
    setMaliyetParaKodu(it.maliyetParaKodu || "HAS");
    setSatisFiyati(it.satisFiyati ?? "");
    setSatisParaKodu(it.satisParaKodu || "HAS");
    setSatisKariYuzde(it.satisKariYuzde ?? "");

    setHasKuru1(it.hasKuru1 ?? "");
    setHasKuru2(it.hasKuru2 ?? "");
    setAltinKuru(it.altinKuru ?? "");
    setResim(it.resim || null);

    showNotif("success", `Ürün yüklendi: #${it.altinUrunId} (${it.grupKodu}-${it.urunNo})`);
  };

  // ─── Yeni Ürün Hazırla (YENİ / F4) ──────────────────────────────────────────
  const handleNew = async () => {
    setAltinUrunId(null);
    setTarih(new Date().toISOString().slice(0, 10));
    setResim(null);

    const targetGrup = (grupKodu.trim() || grupList[0] || "ALYANS").toUpperCase();
    setGrupKodu(targetGrup);

    // Mevcut listedeki en büyük ürün numarasını bul
    const maxExistingNo = altinList
      .filter((x) => (x.grupKodu || "").trim().toUpperCase() === targetGrup)
      .reduce((m, x) => (Number(x.urunNo) > m ? Number(x.urunNo) : m), 0);

    // Alt taraftaki alanlar (ayar, üretici firma, işçilik, kurlar vb.) silinmez, korunur.
    try {
      const nextData = await EtiketService.getNextAltinUrunNo(targetGrup);
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

  // ─── Kaydet / Güncelle (F1 - SODVZ_ALTIN_URUN_KAYDET) ────────────────────────
  const handleSave = async (): Promise<AltinUrunItem | null> => {
    if (!grupKodu.trim()) {
      showNotif("warning", "Lütfen grup kodu giriniz.");
      return null;
    }
    if (!urunNo || Number(urunNo) <= 0) {
      showNotif("warning", "Lütfen geçerli bir ürün no giriniz.");
      return null;
    }
    if (!miktar || Number(miktar) <= 0) {
      showNotif("warning", "Lütfen ürün miktarını (gram) giriniz.");
      return null;
    }

    setIsSaving(true);
    try {
      const finalBarkod = barkod.trim() || `${grupKodu.trim()}${urunNo}`;
      const payload: SaveAltinUrunPayload = {
        altinUrunId,
        tarih,
        grupKodu: grupKodu.trim().toUpperCase(),
        urunNo: Number(urunNo),
        barkod: finalBarkod,
        ayar,
        ureticiFirma: ureticiFirma.trim(),
        orjinalKod: orjinalKod.trim(),
        model: model.trim(),
        banko,
        miktar: Number(miktar) || 0,
        hasGram: Number(hasGram) || 0,
        maliyetIscilik: Number(maliyetIscilik) || 0,
        maliyetIscilikParaKodu,
        maliyetIscilikBirim,
        maliyetIscilikTutari: Number(maliyetIscilikTutari) || 0,
        satisIscilik: Number(satisIscilik) || 0,
        satisIscilikTutari: Number(satisIscilikTutari) || 0,
        iscilikKari: Number(iscilikKari) || 0,
        maliyet: Number(maliyet) || 0,
        maliyetParaKodu,
        satisFiyati: Number(satisFiyati) || 0,
        satisParaKodu,
        satisKariYuzde: Number(satisKariYuzde) || 0,
        hasKuru1: Number(hasKuru1) || null,
        hasKuru2: Number(hasKuru2) || null,
        altinKuru: Number(altinKuru) || null,
        resim: resim || null,
        satildi: false,
      };

      const saved = await EtiketService.saveAltinUrun(payload);
      showNotif("success", `Altın ürün başarıyla ${altinUrunId ? "güncellendi" : "kaydedildi"}: #${saved.altinUrunId} (${saved.grupKodu}-${saved.urunNo})`);
      setAltinUrunId(saved.altinUrunId);
      setBarkod(saved.barkod || finalBarkod);

      const refreshed = await EtiketService.getAltinUrunler({ limit: 500 });
      setAltinList(refreshed);
      return saved;
    } catch (err: any) {
      showNotif("danger", err?.message || "Altın ürün kaydedilirken hata oluştu.");
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Sil (F2 - SODVZ_ALTIN_URUN_SIL) ─────────────────────────────────────────
  const handleDelete = async () => {
    if (!altinUrunId) {
      showNotif("warning", "Silinecek bir altın ürün seçiniz.");
      return;
    }
    setIsSaving(true);
    try {
      await EtiketService.deleteAltinUrun(altinUrunId);
      showNotif("success", `#${altinUrunId} numaralı altın ürün silindi.`);
      setShowDeleteConfirm(false);

      const refreshed = await EtiketService.getAltinUrunler({ limit: 500 });
      setAltinList(refreshed);
      if (refreshed.length > 0) {
        handleSelectUrun(refreshed[0]);
      } else {
        handleNew();
      }
    } catch (err: any) {
      showNotif("danger", err?.message || "Altın ürün silinirken hata oluştu.");
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Gezinme (İlk, Önceki, Sonraki, Son) ──────────────────────────────────────
  const currentIndex = altinList.findIndex((x) => x.altinUrunId === altinUrunId);

  const handleFirst = () => {
    if (altinList.length > 0) handleSelectUrun(altinList[0]);
  };
  const handlePrev = () => {
    if (currentIndex > 0) handleSelectUrun(altinList[currentIndex - 1]);
  };
  const handleNext = () => {
    if (currentIndex >= 0 && currentIndex < altinList.length - 1) {
      handleSelectUrun(altinList[currentIndex + 1]);
    }
  };
  const handleLast = () => {
    if (altinList.length > 0) handleSelectUrun(altinList[altinList.length - 1]);
  };

  // ─── Fotoğraf / Kamera İşlemleri ────────────────────────────────────────────
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

  // ─── Lookup Kolonları ────────────────────────────────────────────────────────
  const lookupColumns: LookupColumn<AltinUrunItem>[] = [
    { header: "ID", width: "70px", render: (it) => <span className="font-monospace fw-bold text-primary">#{it.altinUrunId}</span> },
    { header: "Grup-No", width: "110px", render: (it) => <span className="fw-bold">{it.grupKodu}-{it.urunNo}</span> },
    { header: "Barkod", width: "120px", render: (it) => <span className="font-monospace text-secondary">{it.barkod || "-"}</span> },
    { header: "Ayar", width: "90px", render: (it) => it.ayar || "-" },
    { header: "Miktar (gr)", width: "100px", align: "right", render: (it) => <span className="fw-semibold font-monospace">{Number(it.miktar || 0).toFixed(2)} gr</span> },
    { header: "Has (gr)", width: "90px", align: "right", render: (it) => <span className="text-warning-emphasis font-monospace fw-bold">{Number(it.hasGram || 0).toFixed(2)}</span> },
    { header: "Model / Açıklama", render: (it) => it.model || it.orjinalKod || "-" },
    { header: "Üretici", render: (it) => it.ureticiFirma || "-" },
  ];

  const firmaLookupColumns: LookupColumn<CariKartItem>[] = [
    { header: "Cari Kodu", width: "120px", render: (it) => <span className="font-monospace fw-bold">{it.kod}</span> },
    { header: "Firma / Ünvan", render: (it) => <span className="fw-semibold text-primary">{it.ad}</span> },
    { header: "Yetkili", width: "150px", render: (it) => it.yetkiliKisi || "-" },
    { header: "Telefon", width: "130px", render: (it) => it.telefon || "-" },
  ];

  const kurLookupColumns: LookupColumn<KurRowItem>[] = [
    { header: "Kod", width: "90px", render: (it) => <span className="font-monospace fw-bold text-primary">{it.kod}</span> },
    { header: "Para / Maden Adı", render: (it) => <span className="fw-semibold">{it.ad}</span> },
    { header: "Döviz Satış", width: "120px", align: "right", render: (it) => <span className="font-monospace fw-bold text-success">{it.dovizSatis ? Number(it.dovizSatis).toFixed(2) : "-"}</span> },
    { header: "Döviz Alış", width: "120px", align: "right", render: (it) => <span className="font-monospace">{it.dovizAlis ? Number(it.dovizAlis).toFixed(2) : "-"}</span> },
    { header: "Efektif Satış", width: "120px", align: "right", render: (it) => <span className="font-monospace">{it.efektifSatis ? Number(it.efektifSatis).toFixed(2) : "-"}</span> },
  ];

  const printItems: EtiketYazdirItem[] = [
    {
      id: altinUrunId || 0,
      barkod: barkod || `${grupKodu}${urunNo}`,
      fields: {
        grupUrunNo: `${grupKodu}-${urunNo}`,
        ayar: ayar || "-",
        has: String(hasGram || 0),
        gram: `${miktar} gr`,
        fiyat: `${satisFiyati} ${satisParaKodu}`,
        model: model || "-",
      },
    },
  ];

  return (
    <div className="altin-urun-tanimlama-page w-100 pb-3" style={{ overflowX: "hidden" }}>
      {/* 1. Üst ERP Aksiyon Şeridi */}
      <ERPToolbar
        pageTitle="B- Barkodlu Altın Ürün Tanımlama"
        pageIcon={<IconBarcode size={20} />}
        disabled={isSaving}
        onSave={handleSave}
        onDelete={() => {
          if (altinUrunId) setShowDeleteConfirm(true);
          else showNotif("warning", "Silinecek bir ürün seçiniz.");
        }}
        onNew={handleNew}
        onRefresh={() => window.location.reload()}
        onSearch={() => setShowLookup(true)}
        onPrint={() => setShowPrintModal(true)}
        onFirst={handleFirst}
        onPrev={handlePrev}
        onNext={handleNext}
        onLast={handleLast}
        modeText={altinUrunId ? `Düzenleme: #${altinUrunId} (${grupKodu}-${urunNo})` : "Yeni Kayıt Modu"}
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

      {/* 2. Ana Kart / Masaüstü Form Yerleşimi */}
      <Card className="shadow-sm border-0 mb-3">
        <Card.Body className="p-3">
          {/* Üst Bilgiler & Grup / Ürün Kodu Şeridi */}
          <div className="bg-light p-2.5 rounded border mb-3">
            <Row className="g-2 align-items-center">
              <Col md={3} sm={6}>
                <Form.Group as={Row} className="g-1 align-items-center mb-0">
                  <Form.Label column style={{ width: "55px", flex: "0 0 55px", maxWidth: "55px" }} className="small fw-bold text-secondary text-start text-nowrap">
                    Tarih :
                  </Form.Label>
                  <Col>
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
                  <Form.Label column style={{ width: "95px", flex: "0 0 95px", maxWidth: "95px" }} className="small fw-bold text-secondary text-start text-nowrap">
                    Grup / No <span className="text-danger">*</span> :
                  </Form.Label>
                  <Col>
                    <InputGroup size="sm">
                      <Form.Control
                        ref={grupKoduRef}
                        type="text"
                        value={grupKodu}
                        onChange={(e) => setGrupKodu(e.target.value.toUpperCase())}
                        style={{ maxWidth: "120px", fontWeight: "bold" }}
                        className="text-primary font-monospace"
                      />
                      <Form.Control
                        type="number"
                        value={urunNo}
                        onChange={(e) => setUrunNo(parseInt(e.target.value, 10) || 1)}
                        style={{ maxWidth: "80px", fontWeight: "bold" }}
                        className="text-center font-monospace"
                      />
                      <Button variant="outline-success" onClick={handleNew} title="Yeni Numara Al">
                        <IconPlus size={15} className="me-1" />
                        <span>Yeni</span>
                      </Button>
                      <Button variant="outline-primary" onClick={() => setShowLookup(true)} title="Kayıtlı Altın Ürünleri Listele (F3)">
                        <IconBinoculars size={15} />
                      </Button>
                    </InputGroup>
                  </Col>
                </Form.Group>
              </Col>

              <Col md={4} sm={12}>
                <Form.Group as={Row} className="g-1 align-items-center mb-0">
                  <Form.Label column style={{ width: "95px", flex: "0 0 95px", maxWidth: "95px" }} className="small fw-bold text-secondary text-start text-nowrap">
                    Barkod Kodu :
                  </Form.Label>
                  <Col>
                    <Form.Control
                      type="text"
                      size="sm"
                      value={barkod || `${grupKodu}${urunNo}`}
                      onChange={(e) => setBarkod(e.target.value)}
                      className="font-monospace fw-bold text-dark bg-white"
                    />
                  </Col>
                </Form.Group>
              </Col>
            </Row>
          </div>

          <Row className="gx-4 gy-2">
            {/* ─── SOL BLOK: Ürün Kimliği & Fiyatlandırma ─── */}
            <Col lg={6} md={12}>
              <div className="border rounded p-3 h-100 bg-white">
                <div className="fw-bold text-primary border-bottom pb-1.5 mb-2.5 d-flex align-items-center gap-1.5">
                  <IconScale size={16} />
                  <span>Ürün Kimliği ve Özellikleri</span>
                </div>

                {/* Ayar */}
                <Form.Group as={Row} className="mb-2 align-items-center g-2">
                  <Form.Label column style={{ width: "105px", flex: "0 0 105px", maxWidth: "105px" }} className="small fw-bold text-secondary text-start text-nowrap">
                    Ayar :
                  </Form.Label>
                  <Col>
                    <Form.Select size="sm" value={ayar} onChange={(e) => handleAyarChange(e.target.value)} className="fw-bold">
                      <option value="22 FANTAZI">22 FANTAZI (916)</option>
                      <option value="24">24 Ayar (1000)</option>
                      <option value="22">22 Ayar (916)</option>
                      <option value="18">18 Ayar (750)</option>
                      <option value="14">14 Ayar (585)</option>
                      <option value="8">8 Ayar (333)</option>
                    </Form.Select>
                  </Col>
                </Form.Group>

                {/* Üretici Firma */}
                <Form.Group as={Row} className="mb-2 align-items-center g-2">
                  <Form.Label column style={{ width: "105px", flex: "0 0 105px", maxWidth: "105px" }} className="small fw-bold text-secondary text-start text-nowrap">
                    Üretici Firma :
                  </Form.Label>
                  <Col>
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
                        placeholder="Firma seçiniz veya yazınız"
                      />
                      <Button
                        variant="outline-secondary"
                        className="px-2 d-flex align-items-center"
                        onClick={() => setShowFirmaLookup(true)}
                        title="Firma Seç (Dürbün / F4)"
                      >
                        <IconBinoculars size={15} />
                      </Button>
                    </InputGroup>
                    <datalist id="ureticiFirmalarList">
                      {ureticiList.map((u, i) => (
                        <option key={i} value={u} />
                      ))}
                    </datalist>
                  </Col>
                </Form.Group>

                {/* Orjinal Kod */}
                <Form.Group as={Row} className="mb-2 align-items-center g-2">
                  <Form.Label column style={{ width: "105px", flex: "0 0 105px", maxWidth: "105px" }} className="small fw-bold text-secondary text-start text-nowrap">
                    Orjinal Kod :
                  </Form.Label>
                  <Col>
                    <Form.Control
                      type="text"
                      size="sm"
                      value={orjinalKod}
                      onChange={(e) => setOrjinalKod(e.target.value)}
                      className="font-monospace"
                    />
                  </Col>
                </Form.Group>

                {/* Model */}
                <Form.Group as={Row} className="mb-2 align-items-center g-2">
                  <Form.Label column style={{ width: "105px", flex: "0 0 105px", maxWidth: "105px" }} className="small fw-bold text-secondary text-start text-nowrap">
                    Model :
                  </Form.Label>
                  <Col>
                    <Form.Control type="text" size="sm" value={model} onChange={(e) => setModel(e.target.value)} />
                  </Col>
                </Form.Group>

                {/* Banko */}
                <Form.Group as={Row} className="mb-2 align-items-center g-2">
                  <Form.Label column style={{ width: "105px", flex: "0 0 105px", maxWidth: "105px" }} className="small fw-bold text-secondary text-start text-nowrap">
                    Banko :
                  </Form.Label>
                  <Col>
                    <Form.Select size="sm" value={banko} onChange={(e) => setBanko(e.target.value)}>
                      <option value="Banko 1">Banko 1</option>
                      <option value="Banko 2">Banko 2</option>
                      <option value="Vitrin">Vitrin</option>
                      <option value="Kasa">Kasa</option>
                      <option value="Depo">Depo</option>
                    </Form.Select>
                  </Col>
                </Form.Group>

                <div className="fw-bold text-primary border-bottom pb-1.5 mt-3 mb-2.5 d-flex align-items-center gap-1.5">
                  <IconCoin size={16} />
                  <span>Maliyet, Satış ve Kâr Fiyatlandırması</span>
                </div>

                {/* Maliyet */}
                <Form.Group as={Row} className="mb-2 align-items-center g-2">
                  <Form.Label column style={{ width: "105px", flex: "0 0 105px", maxWidth: "105px" }} className="small fw-bold text-secondary text-start text-nowrap">
                    Maliyet :
                  </Form.Label>
                  <Col>
                    <InputGroup size="sm">
                      <Form.Control
                        type="text"
                        inputMode="decimal"
                        value={maliyet === 0 || maliyet === "0" ? "" : (maliyet ?? "")}
                        onChange={(e) => handleMaliyetChange(cleanNum(e.target.value))}
                        className="fw-bold font-monospace text-end"
                        placeholder=""
                      />
                      <Form.Select
                        size="sm"
                        value={maliyetParaKodu}
                        onChange={(e) => setMaliyetParaKodu(e.target.value)}
                        style={{ maxWidth: "85px" }}
                        className="font-monospace fw-bold"
                      >
                        <option value="HAS">HAS</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="TL">TL</option>
                      </Form.Select>
                    </InputGroup>
                  </Col>
                </Form.Group>

                {/* Satış Fiyatı */}
                <Form.Group as={Row} className="mb-2 align-items-center g-2">
                  <Form.Label column style={{ width: "105px", flex: "0 0 105px", maxWidth: "105px" }} className="small fw-bold text-secondary text-start text-nowrap">
                    Satış Fiyatı :
                  </Form.Label>
                  <Col>
                    <InputGroup size="sm">
                      <Form.Control
                        type="text"
                        inputMode="decimal"
                        value={satisFiyati === 0 || satisFiyati === "0" ? "" : (satisFiyati ?? "")}
                        onChange={(e) => handleSatisFiyatiChange(cleanNum(e.target.value))}
                        className="fw-bold font-monospace text-primary text-end"
                        style={{ fontSize: "14px" }}
                        placeholder=""
                      />
                      <Form.Select
                        size="sm"
                        value={satisParaKodu}
                        onChange={(e) => setSatisParaKodu(e.target.value)}
                        style={{ maxWidth: "85px" }}
                        className="font-monospace fw-bold text-primary"
                      >
                        <option value="HAS">HAS</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="TL">TL</option>
                      </Form.Select>
                    </InputGroup>
                  </Col>
                </Form.Group>

                {/* Satış Kârı % */}
                <Form.Group as={Row} className="mb-2 align-items-center g-2">
                  <Form.Label column style={{ width: "105px", flex: "0 0 105px", maxWidth: "105px" }} className="small fw-bold text-secondary text-start text-nowrap">
                    Satış Kârı % :
                  </Form.Label>
                  <Col>
                    <InputGroup size="sm">
                      <Form.Control
                        type="text"
                        inputMode="decimal"
                        value={satisKariYuzde === 0 || satisKariYuzde === "0" ? "" : (satisKariYuzde ?? "")}
                        onChange={(e) => handleKarYuzdeChange(cleanNum(e.target.value))}
                        className="font-monospace text-end fw-bold text-success"
                        placeholder=""
                      />
                      <InputGroup.Text className="bg-light">%</InputGroup.Text>
                    </InputGroup>
                  </Col>
                </Form.Group>
              </div>
            </Col>

            {/* ─── SAĞ BLOK: Miktar, İşçilik & Hesap Motoru + Resim ─── */}
            <Col lg={6} md={12}>
              <div className="border rounded p-3 h-100 bg-white">
                <div className="fw-bold text-primary border-bottom pb-1.5 mb-2.5 d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center gap-1.5">
                    <IconCalculator size={16} />
                    <span>Miktar ve İşçilik Hesap Motoru</span>
                  </div>
                </div>

                <Row className="gx-2">
                  <Col sm={8}>
                    {/* Miktar (Gram) */}
                    <Form.Group as={Row} className="mb-2 align-items-center g-2">
                      <Form.Label column style={{ width: "125px", flex: "0 0 125px", maxWidth: "125px" }} className="small fw-bold text-secondary text-start text-nowrap">
                        Miktar (Gram) <span className="text-danger">*</span> :
                      </Form.Label>
                      <Col>
                        <Form.Control
                          type="text"
                          inputMode="decimal"
                          size="sm"
                          value={miktar === 0 || miktar === "0" ? "" : (miktar ?? "")}
                          onChange={(e) => handleMiktarChange(cleanNum(e.target.value))}
                          className="fw-bold font-monospace text-end"
                          placeholder=""
                        />
                      </Col>
                    </Form.Group>

                    {/* Has Karşılığı */}
                    <Form.Group as={Row} className="mb-2 align-items-center g-2">
                      <Form.Label column style={{ width: "125px", flex: "0 0 125px", maxWidth: "125px" }} className="small fw-bold text-secondary text-start text-nowrap">
                        Has Karşılığı :
                      </Form.Label>
                      <Col>
                        <Form.Control
                          type="text"
                          inputMode="decimal"
                          size="sm"
                          value={hasGram === 0 || hasGram === "0" ? "" : (hasGram ?? "")}
                          onChange={(e) => handleHasGramChange(cleanNum(e.target.value))}
                          className="fw-bold font-monospace text-end text-warning-emphasis"
                          placeholder=""
                        />
                      </Col>
                    </Form.Group>

                    {/* Maliyet İşçilik */}
                    <Form.Group as={Row} className="mb-1.5 align-items-center g-2">
                      <Form.Label column style={{ width: "125px", flex: "0 0 125px", maxWidth: "125px" }} className="small fw-bold text-secondary text-start text-nowrap">
                        Maliyet İşçilik :
                      </Form.Label>
                      <Col>
                        <Form.Control
                          type="text"
                          inputMode="decimal"
                          size="sm"
                          value={maliyetIscilik === 0 || maliyetIscilik === "0" ? "" : (maliyetIscilik ?? "")}
                          onChange={(e) => handleMaliyetIscilikChange(cleanNum(e.target.value))}
                          className="font-monospace text-end"
                          placeholder=""
                        />
                      </Col>
                    </Form.Group>

                    {/* Maliyet İşçilik Birim & Para (Bir alt satırda) */}
                    <Form.Group as={Row} className="mb-2 align-items-center g-2">
                      <Form.Label column style={{ width: "125px", flex: "0 0 125px", maxWidth: "125px" }} className="small fw-semibold text-muted text-start text-nowrap">
                        İşçilik Türü / Brm :
                      </Form.Label>
                      <Col>
                        <div className="d-flex gap-1.5">
                          <Form.Select
                            size="sm"
                            value={maliyetIscilikParaKodu}
                            onChange={(e) => setMaliyetIscilikParaKodu(e.target.value)}
                            className="font-monospace fw-semibold"
                          >
                            <option value="HAS">HAS</option>
                            <option value="TL">TL</option>
                            <option value="USD">USD</option>
                          </Form.Select>
                          <Form.Select
                            size="sm"
                            value={maliyetIscilikBirim}
                            onChange={(e) => handleMaliyetBirimChange(e.target.value)}
                            className="font-monospace fw-semibold"
                          >
                            <option value="Gram">Gram</option>
                            <option value="Adet">Adet</option>
                          </Form.Select>
                        </div>
                      </Col>
                    </Form.Group>

                    {/* Maliyet İşçilik Tutarı */}
                    <Form.Group as={Row} className="mb-2 align-items-center g-2">
                      <Form.Label column style={{ width: "125px", flex: "0 0 125px", maxWidth: "125px" }} className="small fw-bold text-secondary text-start text-nowrap">
                        İşçilik Tutarı :
                      </Form.Label>
                      <Col>
                        <Form.Control
                          type="text"
                          inputMode="decimal"
                          size="sm"
                          value={maliyetIscilikTutari === 0 || maliyetIscilikTutari === "0" ? "" : (maliyetIscilikTutari ?? "")}
                          onChange={(e) => handleMaliyetIscilikTutariChange(cleanNum(e.target.value))}
                          className="font-monospace text-end fw-semibold"
                          placeholder=""
                        />
                      </Col>
                    </Form.Group>

                    {/* Satış İşçilik */}
                    <Form.Group as={Row} className="mb-2 align-items-center g-2">
                      <Form.Label column style={{ width: "125px", flex: "0 0 125px", maxWidth: "125px" }} className="small fw-bold text-secondary text-start text-nowrap">
                        Satış İşçilik :
                      </Form.Label>
                      <Col>
                        <Form.Control
                          type="text"
                          inputMode="decimal"
                          size="sm"
                          value={satisIscilik === 0 || satisIscilik === "0" ? "" : (satisIscilik ?? "")}
                          onChange={(e) => handleSatisIscilikChange(cleanNum(e.target.value))}
                          className="font-monospace text-end"
                          placeholder=""
                        />
                      </Col>
                    </Form.Group>

                    {/* Satış İşçilik Tutarı */}
                    <Form.Group as={Row} className="mb-2 align-items-center g-2">
                      <Form.Label column style={{ width: "125px", flex: "0 0 125px", maxWidth: "125px" }} className="small fw-bold text-secondary text-start text-nowrap">
                        Satış İşç. Tutarı :
                      </Form.Label>
                      <Col>
                        <Form.Control
                          type="text"
                          inputMode="decimal"
                          size="sm"
                          value={satisIscilikTutari === 0 || satisIscilikTutari === "0" ? "" : (satisIscilikTutari ?? "")}
                          onChange={(e) => handleSatisIscilikTutariChange(cleanNum(e.target.value))}
                          className="font-monospace text-end fw-semibold"
                          placeholder=""
                        />
                      </Col>
                    </Form.Group>

                    {/* İşçilik Kârı */}
                    <Form.Group as={Row} className="mb-2 align-items-center g-2">
                      <Form.Label column style={{ width: "125px", flex: "0 0 125px", maxWidth: "125px" }} className="small fw-bold text-secondary text-start text-nowrap">
                        İşçilik Kârı :
                      </Form.Label>
                      <Col>
                        <Form.Control
                          type="text"
                          inputMode="decimal"
                          size="sm"
                          value={iscilikKari === 0 || iscilikKari === "0" ? "" : (iscilikKari ?? "")}
                          onChange={(e) => handleIscilikKariChange(cleanNum(e.target.value))}
                          className="font-monospace text-end fw-bold text-success"
                          placeholder=""
                        />
                      </Col>
                    </Form.Group>
                  </Col>

                  {/* Kamera & Resim Önizleme */}
                  <Col sm={4} className="d-flex flex-column align-items-center justify-content-center">
                    <div
                      className="border rounded d-flex align-items-center justify-content-center bg-light w-100 mb-2 overflow-hidden position-relative"
                      style={{ height: "150px" }}
                    >
                      {resim ? (
                        <img src={resim} alt="Ürün" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                      ) : (
                        <div className="text-center text-muted small">
                          <IconCamera size={32} className="mb-1 opacity-50" />
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
                        SİL
                      </Button>
                    </div>
                  </Col>
                </Row>
              </div>
            </Col>
          </Row>

          {/* 3. Alt Anlık Kurlar Bandı & Aksiyon Butonları */}
          <div className="mt-3 pt-3 border-top">
            <Row className="g-2 align-items-center justify-content-between">
              <Col lg={7} md={12}>
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <div className="p-1.5 px-2.5 rounded bg-light border d-flex align-items-center gap-2">
                    <span className="small text-muted fw-semibold">HAS Kuru 1:</span>
                    <InputGroup size="sm" style={{ width: "135px" }}>
                      <Form.Control
                        type="text"
                        inputMode="decimal"
                        value={hasKuru1 === 0 || hasKuru1 === "0" ? "" : (hasKuru1 ?? "")}
                        onChange={(e) => setHasKuru1(cleanNum(e.target.value))}
                        className="font-monospace text-end py-0 px-1 fw-bold"
                        placeholder=""
                      />
                      <Button
                        variant="outline-secondary"
                        className="px-1.5 py-0 d-flex align-items-center"
                        onClick={() => setShowKurLookup("has1")}
                        title="HAS Kuru Seç (Dürbün)"
                      >
                        <IconBinoculars size={14} />
                      </Button>
                    </InputGroup>
                  </div>

                  <div className="p-1.5 px-2.5 rounded bg-light border d-flex align-items-center gap-2">
                    <span className="small text-muted fw-semibold">Altın Kuru:</span>
                    <InputGroup size="sm" style={{ width: "135px" }}>
                      <Form.Control
                        type="text"
                        inputMode="decimal"
                        value={altinKuru === 0 || altinKuru === "0" ? "" : (altinKuru ?? "")}
                        onChange={(e) => setAltinKuru(cleanNum(e.target.value))}
                        className="font-monospace text-end py-0 px-1 fw-bold"
                        placeholder=""
                      />
                      <Button
                        variant="outline-secondary"
                        className="px-1.5 py-0 d-flex align-items-center"
                        onClick={() => setShowKurLookup("altin")}
                        title="Altın Kuru Seç (Dürbün)"
                      >
                        <IconBinoculars size={14} />
                      </Button>
                    </InputGroup>
                  </div>
                </div>
              </Col>

              <Col lg={5} md={12} className="text-lg-end text-start">
                <div className="d-flex align-items-center justify-content-lg-end justify-content-start gap-2 flex-wrap">
                  <Button variant="primary" size="sm" onClick={handleSave} disabled={isSaving} className="fw-bold px-3">
                    Güncelle / Kaydet (F1)
                  </Button>
                  <Button variant="outline-secondary" size="sm" onClick={handleNew}>
                    Vazgeç
                  </Button>
                  <Button variant="outline-dark" size="sm" onClick={() => fileInputRef.current?.click()}>
                    Resim
                  </Button>
                  <Button variant="outline-primary" size="sm" onClick={() => setShowPrintModal(true)} className="fw-bold">
                    Barkod
                  </Button>
                  {altinUrunId && (
                    <Button variant="outline-danger" size="sm" onClick={() => setShowDeleteConfirm(true)}>
                      Sil (F2)
                    </Button>
                  )}
                </div>
              </Col>
            </Row>
          </div>
        </Card.Body>
      </Card>

      {/* ─── MODALLAR ────────────────────────────────────────────────────────── */}

      {/* Altın Ürün Lookup Modalı (F3) */}
      <LookupModal<AltinUrunItem>
        show={showLookup}
        title="Barkodlu Altın Ürün Listesi"
        columns={lookupColumns}
        items={altinList}
        filterFn={(it, term) => {
          const t = term.toLowerCase();
          return (
            (it.grupKodu ? it.grupKodu.toLowerCase().includes(t) : false) ||
            (it.barkod ? it.barkod.toLowerCase().includes(t) : false) ||
            (it.model ? it.model.toLowerCase().includes(t) : false) ||
            (it.orjinalKod ? it.orjinalKod.toLowerCase().includes(t) : false) ||
            (it.ureticiFirma ? it.ureticiFirma.toLowerCase().includes(t) : false) ||
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
          setUreticiFirma(selected.ad);
          setShowFirmaLookup(false);
        }}
        onHide={() => setShowFirmaLookup(false)}
      />

      {/* HAS / Altın Kuru Lookup Modalı */}
      <LookupModal<KurRowItem>
        show={Boolean(showKurLookup)}
        title={showKurLookup === "has1" ? "HAS Kuru Seçiniz" : "Altın Kuru Seçiniz"}
        columns={kurLookupColumns}
        items={kurRows}
        filterFn={(it, term) => {
          const t = term.toLowerCase();
          return (
            (it.kod ? it.kod.toLowerCase().includes(t) : false) ||
            (it.ad ? it.ad.toLowerCase().includes(t) : false)
          );
        }}
        onSelect={(selected) => {
          const val = selected.dovizSatis || selected.efektifSatis || selected.dovizAlis || 0;
          if (showKurLookup === "has1") {
            setHasKuru1(val ? String(val) : "");
          } else if (showKurLookup === "altin") {
            setAltinKuru(val ? String(val) : "");
          }
          setShowKurLookup(null);
        }}
        onHide={() => setShowKurLookup(null)}
      />

      {/* Etiket Yazdır Modalı */}
      <EtiketYazdirModal
        show={showPrintModal}
        onHide={() => setShowPrintModal(false)}
        title="Altın Ürün Barkod Etiketi Basımı"
        sablon={sablonlar[0] || null}
        items={printItems}
      />

      {/* Silme Onay Modalı */}
      <Modal show={showDeleteConfirm} onHide={() => setShowDeleteConfirm(false)} centered size="sm">
        <Modal.Header closeButton className="py-2 bg-danger text-white">
          <Modal.Title className="fs-6 fw-bold">Altın Ürün Kaydı Silme</Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3">
          <p className="mb-0 text-secondary" style={{ fontSize: "13.5px" }}>
            <strong>#{altinUrunId}</strong> numaralı (<strong>{grupKodu}-{urunNo}</strong>) altın ürün kaydını silmek istediğinize emin misiniz?
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
    </div>
  );
};

export default AltinUrunTanimlamaPage;
