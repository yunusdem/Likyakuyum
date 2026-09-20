import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Row,
  Col,
  Card,
  Form,
  Button,
  Badge,
  Table,
  InputGroup,
  Alert,
  Modal,
} from "react-bootstrap";
import {
  IconBarcode,
  IconSearch,
  IconBinoculars,
  IconPlus,
  IconTrash,
  IconCheck,
  IconAlertTriangle,
  IconFileSpreadsheet,
  IconRefresh,
  IconDiamond,
  IconCoins,
  IconX,
  IconSparkles,
  IconCopy,
  IconRotate,
} from "@tabler/icons-react";
import { ERPToolbar } from "../../components/common/ERPToolbar";
import LookupModal, { LookupColumn } from "../../components/common/LookupModal";
import { EtiketService, AltinUrunItem, OzelUrunItem } from "../../services/etiketService";

export interface SayimSatirItem {
  id: string;
  barkod: string;
  urunTipi: "altin" | "ozel" | "diger";
  urunId?: number | null;
  grupKodu?: string;
  urunNo?: number;
  urunAdi: string;
  ayar?: string;
  model?: string;
  banko?: string;
  sistemAdet: number;
  sistemGram: number;
  sayilanAdet: number | string; // Başlangıçta ve silinince boş string ""
  sayilanGram: number | string; // Başlangıçta ve silinince boş string ""
  birimFiyat?: number;
  satildi?: boolean;
  notlar?: string;
  okutulmaZamani: string;
}

export interface SayimFisiModel {
  fisId: string;
  fisNo: string;
  tarih: string;
  saat: string;
  depoBanko: string;
  sayimTuru: string;
  personel: string;
  aciklama: string;
  durum: "SAYIMDA" | "TAMAMLANDI";
  satirlar: SayimSatirItem[];
  olusturmaTarihi: string;
  guncellemeTarihi: string;
}

const generateFisNo = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(100 + Math.random() * 900);
  return `SYM-${y}${m}${d}-${rand}`;
};

const parseDecimal = (val: any): number => {
  if (val === "" || val === null || val === undefined) return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  const cleaned = String(val).replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
};

export const BarkodluSayimFisiPage: React.FC = () => {
  // ─── Fiş Başlık Bilgileri ──────────────────────────────────────────────────
  const [sayimFisiId, setSayimFisiId] = useState<number | null>(null);
  const [fisNo, setFisNo] = useState<string>("");
  const [tarih, setTarih] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [saat, setSaat] = useState<string>(() => new Date().toTimeString().slice(0, 5));
  const [depoBanko, setDepoBanko] = useState<string>("Tüm Bankolar / Vitrin");
  const [sayimTuru, setSayimTuru] = useState<string>("Tümü (Altın & Özel)");
  const [personel, setPersonel] = useState<string>("Yetkili Kullanıcı");
  const [aciklama, setAciklama] = useState<string>("");
  const [durum, setDurum] = useState<"SAYIMDA" | "TAMAMLANDI">("SAYIMDA");

  // ─── Sayım Satırları & Arama ───────────────────────────────────────────────
  const [satirlar, setSatirlar] = useState<SayimSatirItem[]>([]);

  // ─── Filtreleme & Tablo Arama ──────────────────────────────────────────────
  const [tabloArama, setTabloArama] = useState<string>("");
  const [barkodGiris, setBarkodGiris] = useState<string>("");
  const barkodInputRef = useRef<HTMLInputElement | null>(null);
  const [filtreFark, setFiltreFark] = useState<"hepsi" | "sayilanlar" | "sayilmayanlar" | "farkli" | "uyumlu">("hepsi");

  // ─── Sayfa İlk Açıldığında İmleci Barkod Girişine Odakla ───────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      barkodInputRef.current?.focus();
    }, 250);
    return () => clearTimeout(timer);
  }, []);

  // ─── Veritabanı Ürünleri & Lookup ──────────────────────────────────────────
  const [altinUrunler, setAltinUrunler] = useState<AltinUrunItem[]>([]);
  const [ozelUrunler, setOzelUrunler] = useState<OzelUrunItem[]>([]);
  const [lookupOpen, setLookupOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [kayitliFislerModal, setKayitliFislerModal] = useState<boolean>(false);
  const [kayitliFisler, setKayitliFisler] = useState<any[]>([]);
  const [showYeniConfirm, setShowYeniConfirm] = useState<boolean>(false);
  const [showSilConfirm, setShowSilConfirm] = useState<boolean>(false);

  // ─── Dürbün ile Seçilen Satırı 5 Saniye Vurgulama ──────────────────────────
  const [highlightedRowId, setHighlightedRowId] = useState<string | null>(null);
  const highlightTimerRef = useRef<any>(null);

  // ─── Sağ Tık (Context Menu) State ─────────────────────────────────────────
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    satirId: string;
    barkod: string;
  } | null>(null);

  // ─── Geri Bildirim Bildirimleri (Ekran Ortasında Otomatik Kaybolan Küçük Toast) ───
  const [toastMsg, setToastMsg] = useState<{
    text: string;
    type: "success" | "danger" | "info" | "warning";
  } | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (
    text: string,
    type: "success" | "danger" | "info" | "warning" = "success"
  ) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToastMsg({ text, type });
    toastTimerRef.current = setTimeout(() => {
      setToastMsg(null);
    }, 2200);
  };

  // ─── [A- Barkod Fiyat] Sayfasındaki Kayıtlı Ürünleri Tabloya Aktar ─────────
  const populateAllDbProducts = useCallback((altinList: AltinUrunItem[], ozelList: OzelUrunItem[]) => {
    const list: SayimSatirItem[] = [];

    // 1. Altın & Sarrafiye Ürünleri
    altinList.forEach((a) => {
      const bcode = a.barkod || `${a.grupKodu}${a.urunNo}`;
      const name = a.model ? `${a.grupKodu} - ${a.model}` : `Altın Ürün (#${a.urunNo})`;
      list.push({
        id: `altin-${a.altinUrunId}`,
        barkod: bcode,
        urunTipi: "altin",
        urunId: a.altinUrunId,
        grupKodu: a.grupKodu,
        urunNo: a.urunNo,
        urunAdi: name,
        ayar: a.ayar || "22K",
        model: a.model || "",
        banko: a.banko || "Merkez Vitrin",
        sistemAdet: a.miktar ?? 1,
        sistemGram: Number(a.hasGram ?? 0),
        sayilanAdet: "", // Başlangıçta boş
        sayilanGram: "", // Başlangıçta boş
        birimFiyat: a.satisFiyati || 0,
        satildi: a.satildi,
        okutulmaZamani: "-",
      });
    });

    // 2. Özel & Pırlanta Ürünleri
    ozelList.forEach((o) => {
      const bcode = o.barkod || `${o.grupKodu}${o.urunNo}`;
      const name = o.modelOzellik1 || o.mamulTipi ? `${o.grupKodu} - ${o.mamulTipi || o.modelOzellik1}` : `Özel Ürün (#${o.urunNo})`;
      list.push({
        id: `ozel-${o.ozelUrunId}`,
        barkod: bcode,
        urunTipi: "ozel",
        urunId: o.ozelUrunId,
        grupKodu: o.grupKodu,
        urunNo: o.urunNo,
        urunAdi: name,
        ayar: o.ayar || "18K",
        model: o.modelOzellik1 || o.mamulTipi || "",
        banko: o.banko || "Özel Vitrin",
        sistemAdet: o.miktar ?? 1,
        sistemGram: Number(o.tasMiktar || o.miktar || 0),
        sayilanAdet: "", // Başlangıçta boş
        sayilanGram: "", // Başlangıçta boş
        birimFiyat: o.satisFiyati || 0,
        satildi: o.satildi,
        okutulmaZamani: "-",
      });
    });

    return list;
  }, []);

  const fetchAllDbProducts = useCallback(async () => {
    try {
      setLoading(true);
      const [altinRes, ozelRes] = await Promise.all([
        EtiketService.getAltinUrunler({ limit: 5000 }),
        EtiketService.getOzelUrunler({ limit: 5000 }),
      ]);
      const validAltin = altinRes || [];
      const validOzel = ozelRes || [];
      setAltinUrunler(validAltin);
      setOzelUrunler(validOzel);

      const dbList = populateAllDbProducts(validAltin, validOzel);

      // Sadece veritabanında kayıtlı ürünleri listele, varsa girilen sayımları koru
      setSatirlar((current) => {
        if (current.length === 0) {
          return dbList;
        }
        const currentMap = new Map<string, SayimSatirItem>();
        current.forEach((item) => {
          if (item.barkod) currentMap.set(item.barkod.toLowerCase(), item);
          currentMap.set(item.id, item);
        });

        const merged: SayimSatirItem[] = dbList.map((dbItem) => {
          const existing = currentMap.get(dbItem.barkod.toLowerCase()) || currentMap.get(dbItem.id);
          if (existing && (existing.sayilanAdet !== "" || existing.sayilanGram !== "" || existing.notlar)) {
            return {
              ...dbItem,
              sayilanAdet: existing.sayilanAdet ?? "",
              sayilanGram: existing.sayilanGram ?? "",
              notlar: existing.notlar || dbItem.notlar || "",
              okutulmaZamani: existing.okutulmaZamani || dbItem.okutulmaZamani || "-",
            };
          }
          return dbItem;
        });

        // Kullanıcının elle eklediği satırlar varsa koru
        current.forEach((item) => {
          if (
            item.id.startsWith("manual-") &&
            !merged.some((m) => m.id === item.id)
          ) {
            merged.push(item);
          }
        });

        return merged;
      });
    } catch (err) {
      console.warn("Ürün listesi çekilemedi:", err);
    } finally {
      setLoading(false);
    }
  }, [populateAllDbProducts]);

  const loadSavedSlips = useCallback(async () => {
    try {
      const dbSlips = await EtiketService.getSayimFisleri(100);
      if (Array.isArray(dbSlips) && dbSlips.length > 0) {
        setKayitliFisler(dbSlips);
        return dbSlips;
      }
    } catch { }

    try {
      const stored = localStorage.getItem("likya_sayim_fisleri");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setKayitliFisler(parsed);
          return parsed;
        }
      }
    } catch { }
    return [];
  }, []);

  const assignNextFisNo = useCallback(async () => {
    try {
      const nextNo = await EtiketService.getNextSayimFisNo();
      if (nextNo) {
        setFisNo(nextNo);
        return nextNo;
      }
    } catch { }
    const fallback = generateFisNo();
    setFisNo(fallback);
    return fallback;
  }, []);

  const handleKayitliFisYukle = useCallback(async (slip: any) => {
    try {
      let fullSlip = slip;
      const targetId = slip.sayimFisiId || slip.fisId;
      if (targetId) {
        try {
          const fetched = await EtiketService.getSayimFisiById(targetId);
          if (fetched) fullSlip = fetched;
        } catch (fetchErr) {
          console.warn("Fiş detayları veritabanından çekilemedi, liste verisiyle yükleniyor:", fetchErr);
        }
      }

      setSayimFisiId(fullSlip.sayimFisiId || null);
      setFisNo(fullSlip.fisNo || "");
      setTarih(fullSlip.tarih ? fullSlip.tarih.slice(0, 10) : new Date().toISOString().slice(0, 10));
      setSaat(fullSlip.saat ? fullSlip.saat.slice(0, 5) : new Date().toTimeString().slice(0, 5));
      setDepoBanko(fullSlip.depoBanko || "Tüm Bankolar / Vitrin");
      setPersonel(fullSlip.personel || "Yetkili Kullanıcı");
      setAciklama(fullSlip.aciklama || "");
      setDurum(fullSlip.durum === 2 || fullSlip.durum === "TAMAMLANDI" ? "TAMAMLANDI" : "SAYIMDA");

      if (Array.isArray(fullSlip.satirlar) && fullSlip.satirlar.length > 0) {
        const mappedSatirlar: SayimSatirItem[] = fullSlip.satirlar.map((s: any, idx: number) => ({
          id: s.satirId ? `db-${s.satirId}` : `slip-${idx}`,
          barkod: s.barkod || "",
          urunTipi: s.altinUrunId ? "altin" : "diger",
          urunId: s.altinUrunId || null,
          urunAdi: s.urunBilgisi || s.urunAdi || "-",
          ayar: s.ayar || "22K",
          banko: s.banko || "Merkez Vitrin",
          sistemAdet: Number(s.sistemAdet) || 0,
          sistemGram: Number(s.sistemGram) || 0,
          sayilanAdet: s.sayilanAdet !== null && s.sayilanAdet !== undefined ? String(s.sayilanAdet) : "",
          sayilanGram: s.sayilanGram !== null && s.sayilanGram !== undefined ? String(s.sayilanGram) : "",
          birimFiyat: Number(s.birimFiyat) || 0,
          okutulmaZamani: "-",
        }));
        setSatirlar(mappedSatirlar);
      }

      setKayitliFislerModal(false);
    } catch (err: any) {
      showToast("Fiş detayları yüklenirken hata oluştu.", "danger");
    }
  }, []);

  useEffect(() => {
    const initPage = async () => {
      setLoading(true);
      try {
        // 1. Veritabanındaki ürünleri yükle (Altın & Özel Ürünler)
        const [altinRes, ozelRes] = await Promise.all([
          EtiketService.getAltinUrunler({ limit: 5000 }),
          EtiketService.getOzelUrunler({ limit: 5000 }),
        ]);
        const validAltin = altinRes || [];
        const validOzel = ozelRes || [];
        setAltinUrunler(validAltin);
        setOzelUrunler(validOzel);

        // 2. Kayıtlı fişleri yükle
        const slips = await loadSavedSlips();
        if (Array.isArray(slips) && slips.length > 0) {
          // Sayfa ilk açıldığında en son kaydı (ilk eleman: slips[0]) otomatik yükle
          await handleKayitliFisYukle(slips[0]);
        } else {
          // Kayıtlı fiş yoksa yeni fiş için ürünleri listele
          const dbList = populateAllDbProducts(validAltin, validOzel);
          setSatirlar(dbList);
          await assignNextFisNo();
        }
      } catch (err) {
        console.error("Başlangıç verileri yüklenirken hata:", err);
        await assignNextFisNo();
      } finally {
        setLoading(false);
      }
    };

    initPage();
  }, [loadSavedSlips, handleKayitliFisYukle, populateAllDbProducts, assignNextFisNo]);

  // ─── 15 Saniyede Bir Otomatik Kayıt & Taslak Yedekleme ───────────────────────
  const currentStateRef = useRef({
    fisNo,
    tarih,
    saat,
    depoBanko,
    sayimTuru,
    personel,
    aciklama,
    durum,
    satirlar,
  });

  useEffect(() => {
    currentStateRef.current = {
      fisNo,
      tarih,
      saat,
      depoBanko,
      sayimTuru,
      personel,
      aciklama,
      durum,
      satirlar,
    };
  }, [fisNo, tarih, saat, depoBanko, sayimTuru, personel, aciklama, durum, satirlar]);

  useEffect(() => {
    const timer = setInterval(() => {
      const cur = currentStateRef.current;
      if (cur.satirlar.length > 0) {
        try {
          localStorage.setItem("likya_sayim_fisi_aktif_taslak", JSON.stringify({
            ...cur,
            autoSavedAt: new Date().toISOString(),
          }));
        } catch { }
      }
    }, 15000);

    return () => clearInterval(timer);
  }, []);

  // ─── Dışarı Tıklandığında Sağ Tık Menüsünü Kapat ─────────────────────────────
  useEffect(() => {
    const handleOutsideClick = () => {
      if (contextMenu?.visible) {
        setContextMenu(null);
      }
    };
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, [contextMenu]);

  // ─── Yeni Satır Ekleme (Son Satırda Enter ile veya Sağ Tık ile) ─────────────
  const handleYeniSatirEkle = (focusAfter = true) => {
    const newId = `manual-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const newItem: SayimSatirItem = {
      id: newId,
      barkod: `ALT-${Date.now().toString().slice(-6)}`,
      urunTipi: "altin",
      urunAdi: "Yeni Ürün Satırı",
      ayar: "22K",
      banko: depoBanko,
      sistemAdet: 1,
      sistemGram: 0,
      sayilanAdet: "",
      sayilanGram: "",
      birimFiyat: 0,
      okutulmaZamani: new Date().toLocaleTimeString(),
    };
    setSatirlar((prev) => {
      const nextList = [...prev, newItem];
      if (focusAfter) {
        setTimeout(() => {
          const newIdx = nextList.length - 1;
          const el = document.getElementById(`sayim-satir-${newId}`);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
          }
          const input = document.getElementById(`input-adet-${newIdx}`);
          input?.focus();
        }, 120);
      }
      return nextList;
    });
    showToast("Yeni satır eklendi.", "info");
  };

  // ─── Tablodan Satır Silme (Sağ Tık Menüsünden) ──────────────────────────────
  const handleSatirSil = (id: string) => {
    setSatirlar((prev) => prev.filter((s) => s.id !== id));
    setContextMenu(null);
    showToast("Satır tablodan silindi.", "info");
  };

  // ─── Tablo Hücresi Doğrudan Güncelleme (Virgüllü Sayı & Serbest Metin) ──────
  const handleSatirGuncelle = (id: string, field: keyof SayimSatirItem, value: any) => {
    setSatirlar((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleSatirMultiGuncelle = (id: string, updates: Partial<SayimSatirItem>) => {
    setSatirlar((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  // ─── Tablo Hücreleri Klavye Yön ve Enter Navigasyonu ────────────────────────
  const handleTableKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    idx: number,
    field: "adet" | "gram",
    totalRows: number
  ) => {
    const target = e.currentTarget;
    const isAtStart = target.selectionStart === 0 && target.selectionEnd === 0;
    const isAtEnd = target.selectionStart === target.value.length && target.selectionEnd === target.value.length;

    if (e.key === "Enter") {
      e.preventDefault();
      if (field === "adet") {
        // Sayılan Adet -> Sayılan Gram
        const nextInput = document.getElementById(`input-gram-${idx}`);
        nextInput?.focus();
        (nextInput as HTMLInputElement)?.select?.();
      } else if (field === "gram") {
        // Sayılan Gram -> Sonraki satırın Sayılan Adet'i. Son satırda ise yeni satır aç
        if (idx >= totalRows - 1) {
          handleYeniSatirEkle(true);
        } else {
          const nextInput = document.getElementById(`input-adet-${idx + 1}`);
          nextInput?.focus();
          (nextInput as HTMLInputElement)?.select?.();
        }
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (idx < totalRows - 1) {
        const nextInput = document.getElementById(`input-${field}-${idx + 1}`);
        nextInput?.focus();
        (nextInput as HTMLInputElement)?.select?.();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (idx > 0) {
        const prevInput = document.getElementById(`input-${field}-${idx - 1}`);
        prevInput?.focus();
        (prevInput as HTMLInputElement)?.select?.();
      }
    } else if (e.key === "ArrowRight") {
      if (isAtEnd) {
        if (field === "adet") {
          e.preventDefault();
          const nextInput = document.getElementById(`input-gram-${idx}`);
          nextInput?.focus();
          (nextInput as HTMLInputElement)?.select?.();
        } else if (field === "gram" && idx < totalRows - 1) {
          e.preventDefault();
          const nextInput = document.getElementById(`input-adet-${idx + 1}`);
          nextInput?.focus();
          (nextInput as HTMLInputElement)?.select?.();
        }
      }
    } else if (e.key === "ArrowLeft") {
      if (isAtStart) {
        if (field === "gram") {
          e.preventDefault();
          const prevInput = document.getElementById(`input-adet-${idx}`);
          prevInput?.focus();
          (prevInput as HTMLInputElement)?.select?.();
        } else if (field === "adet" && idx > 0) {
          e.preventDefault();
          const prevInput = document.getElementById(`input-gram-${idx - 1}`);
          prevInput?.focus();
          (prevInput as HTMLInputElement)?.select?.();
        }
      }
    }
  };

  // ─── Sağ Tık Context Menu İşleyicisi ────────────────────────────────────────
  const handleRowContextMenu = (e: React.MouseEvent, satir: SayimSatirItem) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      satirId: satir.id,
      barkod: satir.barkod,
    });
  };

  // ─── Lookup Arama Modalı Ürün Listesi (Dürbün) ─────────────────────────────
  const allLookupProducts = useMemo(() => {
    const list: Array<{
      id: string;
      barkod: string;
      tip: "altin" | "ozel";
      grup: string;
      ad: string;
      ayar: string;
      miktar: number;
      gram: number;
      fiyat: number;
    }> = [];

    altinUrunler.forEach((a) => {
      list.push({
        id: `altin-${a.altinUrunId}`,
        barkod: a.barkod || `ALT-${a.urunNo}`,
        tip: "altin",
        grup: a.grupKodu,
        ad: a.model ? `${a.grupKodu} - ${a.model}` : `Altın (#${a.urunNo})`,
        ayar: a.ayar || "22K",
        miktar: a.miktar || 1,
        gram: a.hasGram || 0,
        fiyat: a.satisFiyati || 0,
      });
    });

    ozelUrunler.forEach((o) => {
      list.push({
        id: `ozel-${o.ozelUrunId}`,
        barkod: o.barkod || `OZL-${o.urunNo}`,
        tip: "ozel",
        grup: o.grupKodu,
        ad: o.modelOzellik1 || o.mamulTipi ? `${o.grupKodu} - ${o.mamulTipi || o.modelOzellik1}` : `Özel Ürün (#${o.urunNo})`,
        ayar: o.ayar || "18K",
        miktar: o.miktar || 1,
        gram: o.tasMiktar || o.miktar || 0,
        fiyat: o.satisFiyati || 0,
      });
    });

    return list;
  }, [altinUrunler, ozelUrunler]);

  const lookupColumns: LookupColumn<any>[] = [
    {
      header: "Tip",
      width: "80px",
      render: (it) => (
        <Badge bg={it.tip === "altin" ? "warning" : "info"} className="text-dark">
          {it.tip === "altin" ? "Altın" : "Pırlanta"}
        </Badge>
      ),
    },
    { header: "Barkod", width: "130px", render: (it) => <span className="font-monospace fw-bold">{it.barkod}</span> },
    { header: "Ürün / Model", render: (it) => <span>{it.ad}</span> },
    { header: "Ayar", width: "70px", render: (it) => <span>{it.ayar}</span> },
    { header: "Stok Adet", width: "90px", align: "right", render: (it) => <span>{it.miktar}</span> },
    { header: "Gramaj", width: "90px", align: "right", render: (it) => <span className="fw-bold">{Number(it.gram).toFixed(2)} gr</span> },
  ];

  // Dürbünden ürün seçildiğinde: Tabloda varsa o satıra kay, 5 saniye mavi vurgula ve Sayılan Adet hücresine odaklan
  const handleLookupSelect = (item: any) => {
    setLookupOpen(false);
    const targetBarcode = (item.barkod || "").toLowerCase().trim();
    const foundIndex = satirlar.findIndex((s) => {
      if (targetBarcode && s.barkod && s.barkod.toLowerCase().trim() === targetBarcode) return true;
      if (item.id && s.id === item.id) return true;
      if (item.urunId && s.urunId && s.urunId === item.urunId && s.urunTipi === (item.tip || "altin")) return true;
      if (item.altinUrunId && s.urunId && s.urunId === item.altinUrunId) return true;
      return false;
    });

    if (foundIndex !== -1) {
      const foundRow = satirlar[foundIndex];
      setTimeout(() => {
        const el = document.getElementById(`sayim-satir-${foundRow.id}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        const inputAdet = document.getElementById(`input-adet-${foundIndex}`);
        inputAdet?.focus();
        (inputAdet as HTMLInputElement)?.select?.();
      }, 120);

      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      setHighlightedRowId(foundRow.id);
      highlightTimerRef.current = setTimeout(() => {
        setHighlightedRowId(null);
      }, 5000);
    } else {
      // Tabloda yoksa yeni satır olarak ekle
      const newRowId = item.id || `manual-${Date.now()}`;
      const newRow: SayimSatirItem = {
        id: newRowId,
        barkod: item.barkod || `BARKOD-${Date.now()}`,
        urunTipi: item.tip || "altin",
        urunAdi: item.ad || "Seçilen Ürün",
        ayar: item.ayar || "22K",
        banko: depoBanko,
        sistemAdet: item.miktar ?? 1,
        sistemGram: Number(item.gram ?? 0),
        sayilanAdet: "",
        sayilanGram: "",
        birimFiyat: item.fiyat || 0,
        okutulmaZamani: new Date().toLocaleTimeString(),
      };

      setSatirlar((prev) => {
        const nextList = [...prev, newRow];
        const newIdx = nextList.length - 1;
        setTimeout(() => {
          const el = document.getElementById(`sayim-satir-${newRowId}`);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
          }
          const inputAdet = document.getElementById(`input-adet-${newIdx}`);
          inputAdet?.focus();
          (inputAdet as HTMLInputElement)?.select?.();
        }, 120);
        return nextList;
      });

      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      setHighlightedRowId(newRowId);
      highlightTimerRef.current = setTimeout(() => {
        setHighlightedRowId(null);
      }, 5000);
    }
  };

  // ─── Barkod Giriş / Okutma Alanı Enter İşlemi ──────────────────────────────
  const handleBarkodGiris = (e?: React.FormEvent | React.KeyboardEvent) => {
    if (e && "preventDefault" in e) e.preventDefault();
    const rawCode = barkodGiris.trim();
    if (!rawCode) return;

    const lowerCode = rawCode.toLowerCase();

    // 1. Tabloda barkod veya ID ile eşleşen var mı?
    const foundIndex = satirlar.findIndex(
      (s) =>
        (s.barkod && s.barkod.toLowerCase().trim() === lowerCode) ||
        (s.urunId && String(s.urunId) === lowerCode)
    );

    if (foundIndex !== -1) {
      const foundRow = satirlar[foundIndex];
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      setHighlightedRowId(foundRow.id);
      highlightTimerRef.current = setTimeout(() => {
        setHighlightedRowId(null);
      }, 5000);

      setTimeout(() => {
        const el = document.getElementById(`sayim-satir-${foundRow.id}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        const inputAdet = document.getElementById(`input-adet-${foundIndex}`);
        inputAdet?.focus();
        (inputAdet as HTMLInputElement)?.select?.();
      }, 100);

      setBarkodGiris("");
      return;
    }

    // 2. Tabloda yoksa veritabanındaki ürünlerde ara ve tabloya ekle
    const dbItem = allLookupProducts.find(
      (item) =>
        (item.barkod && item.barkod.toLowerCase().trim() === lowerCode) ||
        (item.id && item.id.toLowerCase().trim() === lowerCode)
    );

    if (dbItem) {
      handleLookupSelect(dbItem);
      setBarkodGiris("");
    } else {
      // Veritabanında eşleşen ürün bulunmasa bile barkod ile yeni satır ekle
      const newId = `manual-${Date.now()}`;
      const newItem: SayimSatirItem = {
        id: newId,
        barkod: rawCode,
        urunTipi: "altin",
        urunAdi: `Ürün (${rawCode})`,
        ayar: "22K",
        banko: depoBanko,
        sistemAdet: 0,
        sistemGram: 0,
        sayilanAdet: "1",
        sayilanGram: "",
        birimFiyat: 0,
        okutulmaZamani: new Date().toLocaleTimeString(),
      };
      setSatirlar((prev) => {
        const nextList = [...prev, newItem];
        const newIdx = nextList.length - 1;
        setTimeout(() => {
          const el = document.getElementById(`sayim-satir-${newId}`);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
          const inputAdet = document.getElementById(`input-adet-${newIdx}`);
          inputAdet?.focus();
          (inputAdet as HTMLInputElement)?.select?.();
        }, 100);
        return nextList;
      });

      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      setHighlightedRowId(newId);
      highlightTimerRef.current = setTimeout(() => {
        setHighlightedRowId(null);
      }, 5000);

      setBarkodGiris("");
    }
  };

  // ─── Canlı İstatistikler & Özet Hesaplamaları ──────────────────────────────
  const stats = useMemo(() => {
    let toplamKalem = satirlar.length;
    let sayilanKalemSayisi = 0;
    let toplamSistemAdet = 0;
    let toplamSistemGram = 0;
    let toplamSayilanAdet = 0;
    let toplamSayilanGram = 0;
    let eslesenKalem = 0;
    let eksikKalem = 0;
    let fazlaKalem = 0;

    satirlar.forEach((s) => {
      const sAdet = Number(s.sistemAdet) || 0;
      const sGram = Number(s.sistemGram) || 0;
      toplamSistemAdet += sAdet;
      toplamSistemGram += sGram;

      const isCounted = s.sayilanAdet !== "" && s.sayilanAdet !== null && s.sayilanAdet !== undefined;
      if (isCounted) {
        sayilanKalemSayisi++;
        const cAdet = parseDecimal(s.sayilanAdet);
        const cGram = parseDecimal(s.sayilanGram);
        toplamSayilanAdet += cAdet;
        toplamSayilanGram += cGram;

        const diffAdet = Number((cAdet - sAdet).toFixed(3));
        if (Math.abs(diffAdet) < 0.0001) {
          eslesenKalem++;
        } else if (diffAdet < 0) {
          eksikKalem++;
        } else {
          fazlaKalem++;
        }
      }
    });

    const farkAdet = Number((toplamSayilanAdet - toplamSistemAdet).toFixed(3));
    const farkGram = Number((toplamSayilanGram - toplamSistemGram).toFixed(2));

    return {
      toplamKalem,
      sayilanKalemSayisi,
      toplamSistemAdet: Number(toplamSistemAdet.toFixed(3)),
      toplamSistemGram: Number(toplamSistemGram.toFixed(2)),
      toplamSayilanAdet: Number(toplamSayilanAdet.toFixed(3)),
      toplamSayilanGram: Number(toplamSayilanGram.toFixed(2)),
      farkAdet,
      farkGram,
      eslesenKalem,
      eksikKalem,
      fazlaKalem,
    };
  }, [satirlar]);

  // ─── Tablo Filtreleme ──────────────────────────────────────────────────────
  const filtrelenmisSatirlar = useMemo(() => {
    return satirlar.filter((s) => {
      // Metin araması
      if (tabloArama.trim()) {
        const q = tabloArama.toLowerCase();
        const matchText =
          (s.barkod && s.barkod.toLowerCase().includes(q)) ||
          (s.urunAdi && s.urunAdi.toLowerCase().includes(q)) ||
          (s.ayar && s.ayar.toLowerCase().includes(q)) ||
          (s.banko && s.banko.toLowerCase().includes(q)) ||
          (s.model && s.model.toLowerCase().includes(q));
        if (!matchText) return false;
      }

      const isCounted = s.sayilanAdet !== "" && s.sayilanAdet !== null && s.sayilanAdet !== undefined;
      const cAdet = parseDecimal(s.sayilanAdet);
      const sAdet = Number(s.sistemAdet) || 0;
      const diffAdet = cAdet - sAdet;

      if (filtreFark === "sayilanlar") return isCounted;
      if (filtreFark === "sayilmayanlar") return !isCounted;
      if (filtreFark === "uyumlu") return isCounted && Math.abs(diffAdet) < 0.0001;
      if (filtreFark === "farkli") return isCounted && Math.abs(diffAdet) >= 0.0001;

      return true;
    });
  }, [satirlar, tabloArama, filtreFark]);

  // ─── Üst Toolbar Aksiyonları ───────────────────────────────────────────────
  const handleYeni = () => {
    setShowYeniConfirm(true);
  };

  const handleYeniOnayla = () => {
    setShowYeniConfirm(false);
    setSayimFisiId(null);
    setFisNo("");
    setTarih(new Date().toISOString().slice(0, 10));
    setSaat(new Date().toTimeString().slice(0, 5));
    setAciklama("");
    setDurum("SAYIMDA");
    setHighlightedRowId(null);
    setSatirlar(populateAllDbProducts(altinUrunler, ozelUrunler));
    localStorage.removeItem("likya_sayim_fisi_aktif_taslak");
  };

  const handleKaydet = async () => {
    if (satirlar.length === 0) {
      showToast("Kaydetmek için en az bir satır bulunmalıdır.", "danger");
      return;
    }

    try {
      const now = new Date();
      const kayitTarih = now.toLocaleDateString("en-CA"); // "YYYY-MM-DD"
      const kayitSaat = now.toTimeString().slice(0, 8); // "HH:mm:ss"

      const sqlSatirlar = satirlar.map((s, idx) => {
        const isCounted = s.sayilanAdet !== "" && s.sayilanAdet !== null && s.sayilanAdet !== undefined;
        return {
          satirNo: idx + 1,
          altinUrunId: s.urunTipi === "altin" ? s.urunId : null,
          barkod: s.barkod || "",
          urunBilgisi: s.urunAdi || "-",
          ayar: s.ayar || null,
          banko: s.banko || null,
          sistemAdet: Number(s.sistemAdet) || 0,
          sistemGram: Number(s.sistemGram) || 0,
          sayilanAdet: isCounted ? parseDecimal(s.sayilanAdet) : null,
          sayilanGram: isCounted ? parseDecimal(s.sayilanGram) : null,
          birimFiyat: Number(s.birimFiyat) || 0,
        };
      });

      const payload = {
        sayimFisiId: sayimFisiId || null,
        fisNo: fisNo || undefined,
        tarih: kayitTarih,
        saat: kayitSaat,
        sistemAdet: stats.toplamSistemAdet,
        sistemGram: stats.toplamSistemGram,
        sayilanAdet: stats.toplamSayilanAdet,
        sayilanGram: stats.toplamSayilanGram,
        farkAdet: stats.farkAdet,
        farkGram: stats.farkGram,
        uyumluSayisi: stats.eslesenKalem,
        farkliSayisi: stats.eksikKalem + stats.fazlaKalem,
        toplamKalem: stats.toplamKalem,
        durum: durum === "TAMAMLANDI" ? 2 : durum === "SAYIMDA" ? 1 : 0,
        aciklama: aciklama || null,
        satirlar: sqlSatirlar,
      };

      const res = await EtiketService.saveSayimFisi(payload);
      const savedFisNo = res?.fisNo || fisNo;

      // Fiş kaydedildikten sonra tüm içerik boşaltılır ve yeni kayda geçilir
      setSayimFisiId(null);
      setFisNo("");
      setTarih(new Date().toLocaleDateString("en-CA"));
      setSaat(new Date().toTimeString().slice(0, 5));
      setAciklama("");
      setDurum("SAYIMDA");
      setHighlightedRowId(null);
      setSatirlar(populateAllDbProducts(altinUrunler, ozelUrunler));

      localStorage.removeItem("likya_sayim_fisi_aktif_taslak");
      loadSavedSlips();
      showToast(`✓ [${savedFisNo}] Sayım Fişi Başarıyla Kaydedildi!`, "success");
    } catch (err: any) {
      showToast(err?.message || "SQL Kayıt sırasında bir hata oluştu.", "danger");
    }
  };

  const handleSil = () => {
    if (sayimFisiId) {
      // Kayıtlı bir fiş düzenleniyorsa silme onay popup'ı aç
      setShowSilConfirm(true);
    } else {
      // Yeni fiş taslağı ise doğrudan sayılan miktarları sıfırla (onay bildirimi olmadan)
      setSatirlar((prev) =>
        prev.map((s) => ({
          ...s,
          sayilanAdet: "",
          sayilanGram: "",
          okutulmaZamani: "-",
        }))
      );
      setHighlightedRowId(null);
      showToast("Tüm sayılan miktarlar boşaltıldı.", "info");
    }
  };

  const handleSilOnayla = async () => {
    if (!sayimFisiId) {
      setShowSilConfirm(false);
      return;
    }
    try {
      await EtiketService.deleteSayimFisi(sayimFisiId);
      setShowSilConfirm(false);

      // Sayım fişini sıfırla ve yeni fişe geç
      setSayimFisiId(null);
      setFisNo("");
      setTarih(new Date().toISOString().split("T")[0]);
      setSaat(new Date().toTimeString().slice(0, 8));
      setAciklama("");
      setDurum("SAYIMDA");
      setHighlightedRowId(null);
      setSatirlar(populateAllDbProducts(altinUrunler, ozelUrunler));

      localStorage.removeItem("likya_sayim_fisi_aktif_taslak");
      loadSavedSlips();
      showToast("Sayım fişi kaydı başarıyla silindi.", "success");
    } catch (err: any) {
      showToast(err?.message || "Sayım fişi silinirken bir hata oluştu.", "danger");
    }
  };

  const handleYazdir = () => {
    window.print();
  };

  const handleExcelExport = () => {
    if (satirlar.length === 0) {
      showToast("Dışa aktarılacak satır bulunmuyor.", "danger");
      return;
    }

    const excelRows = satirlar.map((s, idx) => {
      const isCounted = s.sayilanAdet !== "" && s.sayilanAdet !== null && s.sayilanAdet !== undefined;
      const sAdet = Number(s.sistemAdet) || 0;
      const cAdet = isCounted ? parseDecimal(s.sayilanAdet) : 0;
      const sGram = Number(s.sistemGram) || 0;
      const cGram = isCounted ? parseDecimal(s.sayilanGram) : 0;
      const diffAdet = isCounted ? Number((cAdet - sAdet).toFixed(3)) : -sAdet;
      const diffGram = isCounted ? Number((cGram - sGram).toFixed(2)) : -sGram;

      let durumMetni = "Sayılmadı";
      if (isCounted) {
        if (Math.abs(diffAdet) < 0.0001 && Math.abs(diffGram) < 0.0001) {
          durumMetni = "Tam Uyum";
        } else if (diffAdet > 0 || diffGram > 0) {
          durumMetni = "Fazla";
        } else {
          durumMetni = "Eksik";
        }
      }

      return `
        <tr>
          <td style="mso-number-format:'\\@'; text-align:center;">${idx + 1}</td>
          <td style="mso-number-format:'\\@'; font-weight:bold;">${s.barkod || ""}</td>
          <td style="mso-number-format:'\\@';">${s.urunAdi || ""}</td>
          <td style="mso-number-format:'\\@'; text-align:center;">${s.ayar || ""}</td>
          <td style="mso-number-format:'\\@';">${s.banko || ""}</td>
          <td style="mso-number-format:'0'; text-align:right;">${sAdet}</td>
          <td style="mso-number-format:'0\\.00'; text-align:right;">${sGram.toFixed(2)}</td>
          <td style="mso-number-format:'0'; text-align:right; font-weight:bold; background-color:#eff6ff;">${isCounted ? cAdet : ""}</td>
          <td style="mso-number-format:'0\\.00'; text-align:right; font-weight:bold; background-color:#eff6ff;">${isCounted ? cGram.toFixed(2) : ""}</td>
          <td style="mso-number-format:'0'; text-align:right;">${isCounted ? (diffAdet > 0 ? "+" + diffAdet : diffAdet) : ""}</td>
          <td style="mso-number-format:'0\\.00'; text-align:right;">${isCounted ? (diffGram > 0 ? "+" + diffGram.toFixed(2) : diffGram.toFixed(2)) : ""}</td>
          <td style="mso-number-format:'\\@'; text-align:right;">${s.birimFiyat ? s.birimFiyat.toLocaleString("tr-TR") : "0"} ₺</td>
          <td style="mso-number-format:'\\@'; text-align:center;">${durumMetni}</td>
        </tr>
      `;
    }).join("");

    const excelHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
          <!--[if gte mso 9]>
          <xml>
            <x:ExcelWorkbook>
              <x:ExcelWorksheets>
                <x:ExcelWorksheet>
                  <x:Name>Sayim_Fisi</x:Name>
                  <x:WorksheetOptions>
                    <x:DisplayGridlines/>
                  </x:WorksheetOptions>
                </x:ExcelWorksheet>
              </x:ExcelWorksheets>
            </x:ExcelWorkbook>
          </xml>
          <![endif]-->
          <style>
            table { border-collapse: collapse; width: 100%; font-family: Calibri, Arial, sans-serif; }
            th { background-color: #1e3a8a; color: #ffffff; border: 1px solid #cbd5e1; padding: 6px 10px; font-size: 11pt; }
            td { border: 1px solid #e2e8f0; padding: 5px 8px; font-size: 10pt; mso-number-format: "\\@"; }
            .header-info { margin-bottom: 15px; font-size: 12pt; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header-info">
            <h2>LİKYA KUYUMCULUK - BARKODLU ÜRÜN SAYIM FİŞİ</h2>
            <p>Fiş No: <b>${fisNo || "Yeni Sayım"}</b> | Tarih: <b>${tarih} ${saat}</b> | Lokasyon: <b>${depoBanko}</b></p>
            <p>Toplam Kalem: <b>${stats.toplamKalem}</b> | Sayılan Kalem: <b>${stats.sayilanKalemSayisi}</b> | Sistem Adet/Gr: <b>${stats.toplamSistemAdet} adet / ${stats.toplamSistemGram.toFixed(2)} gr</b> | Sayılan Adet/Gr: <b>${stats.toplamSayilanAdet} adet / ${stats.toplamSayilanGram.toFixed(2)} gr</b> | Fark: <b>${stats.farkAdet} adet / ${stats.farkGram.toFixed(2)} gr</b></p>
          </div>
          <table>
            <thead>
              <tr>
                <th style="mso-number-format:'\\@';">#</th>
                <th style="mso-number-format:'\\@';">Barkod</th>
                <th style="mso-number-format:'\\@';">Ürün Bilgisi / Model</th>
                <th style="mso-number-format:'\\@';">Ayar</th>
                <th style="mso-number-format:'\\@';">Banko</th>
                <th>Sistem (Adet)</th>
                <th>Sistem (gr)</th>
                <th>Sayılan (Adet)</th>
                <th>Sayılan (gr)</th>
                <th>Adet Farkı</th>
                <th>Gram Farkı</th>
                <th style="mso-number-format:'\\@';">Birim Fiyat</th>
                <th style="mso-number-format:'\\@';">Durum</th>
              </tr>
            </thead>
            <tbody>
              ${excelRows}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const blob = new Blob([excelHtml], { type: "application/vnd.ms-excel;charset=utf-8" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Sayim_Fisi_${fisNo || 'Yeni'}_${tarih}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`✓ Tüm tablo (${satirlar.length} kalem) Excel formatında indirildi.`, "success");
  };
  // ─── Kayıtlar Arası Gezinti (İlk, Önceki, Sonraki, Son) ───────────────────
  const currentSlipIndex = useMemo(() => {
    if (!sayimFisiId && !fisNo) return -1;
    return kayitliFisler.findIndex(
      (f) => (sayimFisiId && f.sayimFisiId === sayimFisiId) || (f.fisNo && f.fisNo === fisNo)
    );
  }, [kayitliFisler, sayimFisiId, fisNo]);

  const handleFirst = () => {
    if (kayitliFisler.length === 0) {
      showToast("Kayıtlı fiş bulunmuyor.", "warning");
      return;
    }
    const firstSlip = kayitliFisler[kayitliFisler.length - 1];
    handleKayitliFisYukle(firstSlip);
  };

  const handleLast = () => {
    if (kayitliFisler.length === 0) {
      showToast("Kayıtlı fiş bulunmuyor.", "warning");
      return;
    }
    const lastSlip = kayitliFisler[0];
    handleKayitliFisYukle(lastSlip);
  };

  const handlePrev = () => {
    if (kayitliFisler.length === 0) {
      showToast("Kayıtlı fiş bulunmuyor.", "warning");
      return;
    }
    if (currentSlipIndex === -1) {
      handleLast();
      return;
    }
    if (currentSlipIndex < kayitliFisler.length - 1) {
      handleKayitliFisYukle(kayitliFisler[currentSlipIndex + 1]);
    } else {
      showToast("Zaten ilk kayıttasınız.", "info");
    }
  };

  const handleNext = () => {
    if (kayitliFisler.length === 0) {
      showToast("Kayıtlı fiş bulunmuyor.", "warning");
      return;
    }
    if (currentSlipIndex === -1) {
      handleFirst();
      return;
    }
    if (currentSlipIndex > 0) {
      handleKayitliFisYukle(kayitliFisler[currentSlipIndex - 1]);
    } else {
      showToast("Zaten son kayıttasınız.", "info");
    }
  };

  // ─── Global Klavye Kısayolları (F1: Kaydet, F2: Sil, F4: Yeni) ─────────────
  const handleKaydetRef = useRef(handleKaydet);
  handleKaydetRef.current = handleKaydet;
  const handleSilRef = useRef(handleSil);
  handleSilRef.current = handleSil;
  const handleYeniRef = useRef(handleYeni);
  handleYeniRef.current = handleYeni;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F1") {
        e.preventDefault();
        handleKaydetRef.current();
      } else if (e.key === "F2") {
        e.preventDefault();
        handleSilRef.current();
      } else if (e.key === "F4") {
        e.preventDefault();
        handleYeniRef.current();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // ─── Kayıtlı Sayım Fişleri Lookup Kolonları (B- Hesap Düzeltme Standartı) ─
  const sayimFisLookupColumns: LookupColumn<any>[] = [
    {
      header: "Oluşturulma Tarihi",
      width: "170px",
      render: (f) => (
        <span>
          <span className="fw-semibold text-dark">
            {f.tarih ? (f.tarih.includes("T") ? f.tarih.split("T")[0] : f.tarih) : "-"}
          </span>{" "}
          <small className="text-muted fw-normal">{f.saat ? f.saat.slice(0, 5) : ""}</small>
        </span>
      ),
    },
    {
      header: "Fiş No",
      width: "150px",
      render: (f) => (
        <span className="font-monospace fw-bold text-primary">{f.fisNo}</span>
      ),
    },
    {
      header: "Lokasyon / Depo",
      width: "160px",
      render: (f) => <span>{f.depoBanko || "Tüm Bankolar / Vitrin"}</span>,
    },
    {
      header: "Kalem Sayısı",
      width: "110px",
      align: "center",
      render: (f) => {
        const cnt = Array.isArray(f.satirlar) ? f.satirlar.length : f.toplamKalem || 0;
        return <Badge bg="secondary">{cnt} Kalem</Badge>;
      },
    },
    {
      header: "Durum",
      width: "110px",
      align: "center",
      render: (f) => {
        const isCompleted = f.durum === 2 || f.durum === "TAMAMLANDI";
        return (
          <Badge bg={isCompleted ? "success" : "primary"}>
            {isCompleted ? "TAMAMLANDI" : "SAYIMDA"}
          </Badge>
        );
      },
    },
    {
      header: "Açıklama",
      render: (f) => <span className="text-muted small">{f.aciklama || "-"}</span>,
    },
  ];

  return (
    <div className="sayim-fisi-page-container p-3">
      {/* ─── 1. ORİJİNAL ERP ARAÇ ÇUBUĞU (Sol Üst Orijinal ERP İkonları) ──────── */}
      <div className="mb-2 d-print-none">
        <ERPToolbar
          pageTitle="H- Barkodlu Ürün Sayım Fişi"
          pageIcon={<IconBarcode size={20} />}
          onNew={handleYeni}
          onSave={handleKaydet}
          onSearch={() => {
            setKayitliFislerModal(true);
          }}
          onDelete={handleSil}
          onFirst={handleFirst}
          onPrev={handlePrev}
          onNext={handleNext}
          onLast={handleLast}
          onPrint={handleYazdir}
          onRefresh={() => {
            fetchAllDbProducts();
            loadSavedSlips();
            showToast("Ürünler ve stok verileri yenilendi.", "info");
          }}
          rightContent={
            <div className="d-flex align-items-center gap-2 flex-wrap">
              {/* Excel'e Aktar Butonu (Tarih Saatin Solunda) */}
              <Button
                variant="success"
                size="sm"
                onClick={handleExcelExport}
                className="d-flex align-items-center gap-1 fw-semibold shadow-xs px-2.5 py-1"
                title="Tüm Sayım Listesini Excel Olarak İndir"
              >
                <IconFileSpreadsheet size={16} />
                <span>Excel</span>
              </Button>

              {/* Tarih ve Saat (Seçimsiz, yan yana, kompakt ve düz metin) */}
              <div
                className="d-flex align-items-center gap-1.5 px-2.5 py-1 bg-light rounded border text-secondary font-monospace"
                style={{ fontSize: "12px", height: "30px" }}
                title="Fiş Tarih ve Saati"
              >
                <span className="fw-bold text-dark">
                  {tarih ? (tarih.includes("-") ? tarih.split("-").reverse().join(".") : tarih) : new Date().toLocaleDateString("tr-TR")}
                </span>
                <span className="text-muted" style={{ userSelect: "none" }}>•</span>
                <span className="fw-semibold text-secondary">
                  {saat ? saat.slice(0, 5) : new Date().toTimeString().slice(0, 5)}
                </span>
              </div>

              {/* Fiş Numarası - Sadece kayıtlı fiş getirilmiş veya kaydedilmişse gösterilir */}
              {fisNo ? (
                <span
                  className="badge bg-white text-primary border border-primary-subtle font-monospace px-2.5 py-1 shadow-xs d-flex align-items-center"
                  style={{ fontSize: "12px", height: "30px" }}
                >
                  Fiş: <strong className="ms-1">{fisNo}</strong>
                </span>
              ) : null}

              {/* Durum Seçimi (Güncellenebilir) */}
              <div className="d-flex align-items-center" style={{ height: "30px" }}>
                <Form.Select
                  size="sm"
                  value={durum}
                  onChange={(e: any) => setDurum(e.target.value)}
                  className={`border fw-semibold py-0 ps-2 pe-4 shadow-none ${
                    durum === "TAMAMLANDI"
                      ? "bg-success bg-opacity-10 text-success border-success border-opacity-25"
                      : durum === "SAYIMDA"
                        ? "bg-primary bg-opacity-10 text-primary border-primary border-opacity-25"
                        : "bg-light text-secondary"
                  }`}
                  style={{ fontSize: "11.5px", height: "30px", width: "130px", cursor: "pointer" }}
                  title="Sayım Fişi Durumu (Değiştirip kaydedebilirsiniz)"
                >
                  <option value="SAYIMDA">SAYIMDA</option>
                  <option value="TAMAMLANDI">TAMAMLANDI</option>
                </Form.Select>
              </div>
            </div>
          }
        />
      </div>

      {/* ─── EKRAN ORTASINDA OTOMATİK KAYBOLAN BİLDİRİM TOAST'I ─────────────── */}
      {toastMsg && (
        <div className="erp-toast-container">
          <Alert
            variant={toastMsg.type === "danger" ? "danger" : toastMsg.type}
            dismissible
            onClose={() => setToastMsg(null)}
            className="erp-toast-item d-flex align-items-center mb-0 shadow py-2 px-3 border-0"
          >
            {toastMsg.type === "success" && (
              <IconCheck size={18} className="me-2 text-success flex-shrink-0" />
            )}
            {(toastMsg.type === "danger" || toastMsg.type === "warning") && (
              <IconAlertTriangle
                size={18}
                className={`me-2 flex-shrink-0 ${toastMsg.type === "danger" ? "text-danger" : "text-warning"
                  }`}
              />
            )}
            {toastMsg.type === "info" && (
              <IconSparkles size={18} className="me-2 text-info flex-shrink-0" />
            )}
            <span style={{ fontSize: "13px", fontWeight: 500 }}>{toastMsg.text}</span>
          </Alert>
        </div>
      )}

      {/* ─── 2. SAYIM TABLOSU, İSTATİSTİKLER & FİLTRELER ─────────────────── */}
      <style>{`
        .sayim-row-highlighted,
        .sayim-row-highlighted > td,
        .sayim-row-highlighted > th {
          background-color: #bae6fd !important;
          --bs-table-bg: #bae6fd !important;
          --bs-table-accent-bg: #bae6fd !important;
          color: #0c4a6e !important;
          font-weight: 600;
          box-shadow: inset 0 0 0 9999px #bae6fd !important;
        }
        .sayim-row-highlighted input {
          background-color: #ffffff !important;
          border-color: #0284c7 !important;
          box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.3) !important;
        }
      `}</style>
      <Card className="border shadow-sm mb-3">
        <Card.Header className="bg-white py-1 px-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
          {/* Sol: Kenarlıksız, Kalın Çizgilerle Ayrılmış Modern Canlı Özet */}
          <div className="d-flex align-items-center gap-3 flex-wrap text-secondary" style={{ fontSize: "12px" }}>
            {/* Sistem */}
            <div className="d-flex align-items-center gap-1" title="Sistemdeki Toplam Kayıt">
              <span className="text-muted fw-semibold">Sistem:</span>
              <span className="fw-bold text-dark font-monospace">
                {stats.toplamSistemAdet} <small className="text-muted fw-normal">({stats.toplamSistemGram.toFixed(1)}g)</small>
              </span>
            </div>

            {/* Dikey Çizgi */}
            <div style={{ width: "2px", height: "16px", backgroundColor: "#94a3b8", borderRadius: "1px" }} />

            {/* Sayılan */}
            <div className="d-flex align-items-center gap-1 text-primary" title="Fiilen Sayılan Toplam">
              <span className="fw-semibold">Sayılan:</span>
              <span className="fw-bold font-monospace">
                {stats.toplamSayilanAdet} <small className="fw-normal">({stats.toplamSayilanGram.toFixed(1)}g)</small>
              </span>
            </div>

            {/* Dikey Çizgi */}
            <div style={{ width: "2px", height: "16px", backgroundColor: "#94a3b8", borderRadius: "1px" }} />

            {/* Fark */}
            <div
              className={`d-flex align-items-center gap-1 font-monospace ${Math.abs(stats.farkAdet) < 0.0001 && Math.abs(stats.farkGram) < 0.0001
                ? "text-success"
                : stats.farkAdet < 0 || stats.farkGram < 0
                  ? "text-danger"
                  : "text-dark fw-bold"
                }`}
              title="Sayılan ve Sistem Farkı"
            >
              <span className="fw-semibold text-secondary">Fark:</span>
              <span className="fw-bold">{stats.farkAdet > 0 ? "+" + stats.farkAdet : stats.farkAdet}</span>
            </div>

            {/* Dikey Çizgi */}
            <div style={{ width: "2px", height: "16px", backgroundColor: "#94a3b8", borderRadius: "1px" }} />

            {/* Uyum */}
            <div className="d-flex align-items-center gap-1 text-success" title="Tam Uyumlu Kalem Sayısı">
              <span className="fw-semibold">✓ Uyum:</span>
              <span className="fw-bold font-monospace">{stats.eslesenKalem}</span>
            </div>

            {/* Dikey Çizgi */}
            <div style={{ width: "2px", height: "16px", backgroundColor: "#94a3b8", borderRadius: "1px" }} />

            {/* Farklı */}
            <div className="d-flex align-items-center gap-1 text-danger" title="Farklı Kalem Sayısı (Eksik / Fazla)">
              <span className="fw-semibold">⚠ Farklı:</span>
              <span className="fw-bold font-monospace">{stats.eksikKalem + stats.fazlaKalem}</span>
            </div>
          </div>

          {/* Orta: Fark ile Tabloda Ara Arasında Barkod Okutma / Giriş Alanı + Yeşil Dürbün İkonu */}
          <div className="d-flex align-items-center gap-1 d-print-none">
            <InputGroup size="sm" style={{ width: "200px" }}>
              <InputGroup.Text className="bg-white py-0 px-1.5 text-muted border-end-0">
                <IconBarcode size={14} />
              </InputGroup.Text>
              <Form.Control
                ref={barkodInputRef}
                placeholder="Barkod girin..."
                value={barkodGiris}
                onChange={(e) => setBarkodGiris(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleBarkodGiris(e);
                }}
                className="border-start-0 border-end-0 px-1"
                style={{ fontSize: "11.5px", height: "27px" }}
              />
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => handleBarkodGiris()}
                className="d-flex align-items-center justify-content-center px-1.5 bg-white border-start-0 text-secondary"
                style={{ height: "27px" }}
                title="Barkodu Tabloya Ekle / Bul (Enter)"
              >
                <IconSearch size={13} />
              </Button>
            </InputGroup>

            {/* Seçim için Yeşil Dürbün İkonu */}
            <Button
              variant="outline-success"
              size="sm"
              onClick={() => setLookupOpen(true)}
              className="d-flex align-items-center justify-content-center p-0"
              style={{ width: "27px", height: "27px", color: "#16a34a", borderColor: "#86efac", backgroundColor: "#f0fdf4" }}
              title="Etiket / Ürün Seç (Dürbün)"
            >
              <IconBinoculars size={16} />
            </Button>
          </div>

          {/* Sağ: Tablo Arama ve Filtre Dropdown */}
          <div className="d-flex align-items-center gap-1.5 d-print-none">
            {/* Tablo Arama */}
            <InputGroup size="sm" style={{ width: "130px" }}>
              <InputGroup.Text className="bg-white py-0 px-1.5 border-end-0">
                <IconSearch size={13} />
              </InputGroup.Text>
              <Form.Control
                placeholder="Tabloda ara..."
                value={tabloArama}
                onChange={(e) => setTabloArama(e.target.value)}
                className="border-start-0 ps-1"
                style={{ fontSize: "11.5px", height: "27px" }}
              />
            </InputGroup>

            {/* Filtre Dropdown (Tümü, Sayılan, Kalan, Farklı, Uyumlu) */}
            <Form.Select
              size="sm"
              value={filtreFark}
              onChange={(e: any) => setFiltreFark(e.target.value)}
              style={{ width: "135px", fontSize: "11.5px", height: "27px", fontWeight: 500, cursor: "pointer" }}
              className="border shadow-none py-0 ps-2 pe-4 bg-white"
            >
              <option value="hepsi">Tümü ({satirlar.length})</option>
              <option value="sayilanlar">Sayılan ({stats.sayilanKalemSayisi})</option>
              <option value="sayilmayanlar">Kalan ({satirlar.length - stats.sayilanKalemSayisi})</option>
              <option value="farkli">Farklı ({stats.eksikKalem + stats.fazlaKalem})</option>
              <option value="uyumlu">Uyumlu ({stats.eslesenKalem})</option>
            </Form.Select>
          </div>
        </Card.Header>

        <div className="table-responsive" style={{ maxHeight: "660px" }}>
          <Table hover bordered size="sm" className="align-middle mb-0 text-nowrap user-select-none">
            <thead className="table-light sticky-top" style={{ zIndex: 10 }}>
              <tr>
                <th style={{ width: "40px" }} className="text-center">#</th>
                <th style={{ width: "130px" }}>Barkod</th>
                <th>Ürün Bilgisi / Model</th>
                <th style={{ width: "70px" }}>Ayar</th>
                <th style={{ width: "100px" }}>Banko</th>
                <th style={{ width: "85px" }} className="text-end">Sistem (Adet)</th>
                <th style={{ width: "95px" }} className="text-end">Sistem (gr)</th>
                <th style={{ width: "100px" }} className="text-center bg-primary bg-opacity-10">Sayılan (Adet)</th>
                <th style={{ width: "105px" }} className="text-center bg-primary bg-opacity-10">Sayılan (gr)</th>
                <th style={{ width: "105px" }} className="text-center">Adet Farkı</th>
                <th style={{ width: "105px" }} className="text-center">Gram Farkı</th>
                <th style={{ width: "85px" }} className="text-end">Birim Fiyat</th>
              </tr>
            </thead>
            <tbody>
              {filtrelenmisSatirlar.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-5 text-muted">
                    <IconBarcode size={38} className="text-muted opacity-50 mb-2 d-block mx-auto" />
                    Gösterilecek ürün bulunamadı.
                  </td>
                </tr>
              ) : (
                filtrelenmisSatirlar.map((satir, idx) => {
                  const isCounted = satir.sayilanAdet !== "" && satir.sayilanAdet !== null && satir.sayilanAdet !== undefined;
                  const sAdet = Number(satir.sistemAdet) || 0;
                  const cAdet = parseDecimal(satir.sayilanAdet);
                  const sGram = Number(satir.sistemGram) || 0;
                  const cGram = parseDecimal(satir.sayilanGram);

                  const diffAdet = Number((cAdet - sAdet).toFixed(3));
                  const diffGram = Number((cGram - sGram).toFixed(2));
                  const isHighlighted = highlightedRowId === satir.id;

                  let rowBgClass = "";
                  if (isCounted) {
                    if (Math.abs(diffAdet) < 0.0001 && Math.abs(diffGram) < 0.0001) {
                      rowBgClass = "table-success bg-opacity-10";
                    } else if (diffAdet > 0 || diffGram > 0) {
                      rowBgClass = "table-warning bg-opacity-25";
                    } else if (diffAdet < 0 || diffGram < 0) {
                      rowBgClass = "table-danger bg-opacity-25";
                    }
                  }

                  return (
                    <tr
                      key={satir.id}
                      id={`sayim-satir-${satir.id}`}
                      className={isHighlighted ? "sayim-row-highlighted" : rowBgClass}
                      onClick={() => setHighlightedRowId(satir.id)}
                      onContextMenu={(e) => handleRowContextMenu(e, satir)}
                    >
                      <td className="text-center text-muted small">{idx + 1}</td>
                      <td>
                        <div className="d-flex align-items-center gap-1.5 font-monospace fw-bold text-dark">
                          {satir.urunTipi === "altin" ? (
                            <IconCoins size={15} className="text-warning flex-shrink-0" />
                          ) : (
                            <IconDiamond size={15} className="text-info flex-shrink-0" />
                          )}
                          <span>{satir.barkod}</span>
                        </div>
                      </td>
                      {/* Ürün Bilgisi / Model - Sadece Metin (Değiştirilmez) */}
                      <td>
                        <div className="fw-semibold text-dark">{satir.urunAdi || "—"}</div>
                        {satir.notlar && (
                          <div className="small text-muted fst-italic">{satir.notlar}</div>
                        )}
                      </td>
                      <td>
                        <span className="badge bg-light text-dark border">{satir.ayar || "—"}</span>
                      </td>
                      {/* Banko - Sadece Metin (Değiştirilmez) */}
                      <td>
                        <span className="small text-secondary fw-semibold">{satir.banko || "—"}</span>
                      </td>
                      <td className="text-end font-monospace">{sAdet}</td>
                      <td className="text-end font-monospace">{sGram.toFixed(2)} gr</td>

                      {/* Sayılan Adet - SADECE BURAYA VERİ GİRİLİR (Klavye Navigasyonu & Canlı Otomatik Hesaplama) */}
                      <td className="text-center bg-primary bg-opacity-10" style={{ minWidth: "90px" }}>
                        <Form.Control
                          id={`input-adet-${idx}`}
                          size="sm"
                          type="text"
                          placeholder=""
                          value={satir.sayilanAdet}
                          onChange={(e) => {
                            const raw = e.target.value.replace(",", ".");
                            if (raw === "") {
                              handleSatirMultiGuncelle(satir.id, {
                                sayilanAdet: "",
                                sayilanGram: "",
                              });
                            } else if (/^[0-9]*\.?[0-9]*$/.test(raw)) {
                              const countNum = parseFloat(raw) || 0;
                              const unitGram = sAdet > 0 ? sGram / sAdet : sGram;
                              const autoGram = unitGram > 0 ? (unitGram * countNum).toFixed(2) : "";
                              handleSatirMultiGuncelle(satir.id, {
                                sayilanAdet: raw,
                                sayilanGram: autoGram,
                              });
                            }
                          }}
                          onKeyDown={(e: any) => handleTableKeyDown(e, idx, "adet", filtrelenmisSatirlar.length)}
                          className="text-center fw-bold font-monospace border-primary shadow-none"
                          style={{
                            width: "80px",
                            height: "28px",
                            margin: "0 auto",
                            backgroundColor: isCounted ? "#eff6ff" : "#ffffff",
                          }}
                        />
                      </td>

                      {/* Sayılan Gram - SADECE BURAYA VERİ GİRİLİR (Klavye Navigasyonu & Canlı Otomatik Hesaplama) */}
                      <td className="text-center bg-primary bg-opacity-10" style={{ minWidth: "95px" }}>
                        <Form.Control
                          id={`input-gram-${idx}`}
                          size="sm"
                          type="text"
                          placeholder=""
                          value={satir.sayilanGram}
                          onChange={(e) => {
                            const raw = e.target.value.replace(",", ".");
                            if (raw === "") {
                              handleSatirMultiGuncelle(satir.id, { sayilanGram: "" });
                            } else if (/^[0-9]*\.?[0-9]*$/.test(raw)) {
                              const adetVal = satir.sayilanAdet !== "" ? satir.sayilanAdet : (sAdet > 0 ? String(sAdet) : "1");
                              handleSatirMultiGuncelle(satir.id, {
                                sayilanGram: raw,
                                sayilanAdet: adetVal,
                              });
                            }
                          }}
                          onKeyDown={(e: any) => handleTableKeyDown(e, idx, "gram", filtrelenmisSatirlar.length)}
                          className="text-center fw-bold font-monospace border-primary shadow-none"
                          style={{
                            width: "85px",
                            height: "28px",
                            margin: "0 auto",
                            backgroundColor: satir.sayilanGram !== "" ? "#eff6ff" : "#ffffff",
                          }}
                        />
                      </td>

                      {/* Adet Farkı */}
                      <td className="text-center font-monospace">
                        {!isCounted ? (
                          <span className="text-muted small fst-italic">—</span>
                        ) : Math.abs(diffAdet) < 0.0001 ? (
                          <Badge bg="success" className="px-2 py-1">
                            ✓ Tam Uyum
                          </Badge>
                        ) : diffAdet < 0 ? (
                          <Badge bg="danger" className="px-2 py-1">
                            {diffAdet} Eksik
                          </Badge>
                        ) : (
                          <Badge bg="warning" className="text-dark px-2 py-1">
                            +{diffAdet} Fazla
                          </Badge>
                        )}
                      </td>

                      {/* Gram Farkı */}
                      <td className="text-center font-monospace small">
                        {!isCounted ? (
                          <span className="text-muted fst-italic">—</span>
                        ) : Math.abs(diffGram) < 0.0001 ? (
                          <span className="text-success fw-bold">0.00 gr</span>
                        ) : diffGram < 0 ? (
                          <span className="text-danger fw-bold">{diffGram.toFixed(2)} gr</span>
                        ) : (
                          <span className="text-warning text-dark fw-bold">+{diffGram.toFixed(2)} gr</span>
                        )}
                      </td>

                      {/* Birim Fiyat */}
                      <td className="text-end font-monospace small">
                        {satir.birimFiyat ? `${satir.birimFiyat.toLocaleString("tr-TR")} ₺` : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </Table>
        </div>

        {/* Tablo Alt Bilgi / Kısayollar ve İpucu Şeridi */}
        <Card.Footer className="bg-light py-1.5 px-3 d-flex align-items-center justify-content-between text-muted" style={{ fontSize: "11.5px" }}>
          <div className="d-flex align-items-center gap-3">
            <span><strong className="text-dark">F1:</strong> Kaydet</span>
            <span className="text-secondary opacity-50">|</span>
            <span><strong className="text-dark">F2:</strong> Sil</span>
            <span className="text-secondary opacity-50">|</span>
            <span><strong className="text-dark">F4:</strong> Yeni</span>
          </div>
          <div className="fst-italic text-secondary">
            (Sağ tık: Satır Ekle / Sil)
          </div>
        </Card.Footer>
      </Card>

      {/* ─── 4. ÖZEL SAĞ TIK CONTEXT MENÜSÜ & ARKA PLAN PERDESİ ───────────────── */}
      {contextMenu?.visible && (
        <>
          {/* Tam ekran şeffaf perde: Alttaki yerlerin açılmasını veya yerli tarayıcı menüsünü engeller */}
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 9998,
              background: "transparent",
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setContextMenu(null);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setContextMenu(null);
            }}
          />

          <div
            style={{
              position: "fixed",
              top: contextMenu.y,
              left: contextMenu.x,
              zIndex: 9999,
              background: "#ffffff",
              borderRadius: 6,
              boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
              border: "1px solid #cbd5e1",
              padding: "4px 0",
              minWidth: 180,
            }}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            {/* Yeni Satır Ekle */}
            <div
              style={{
                padding: "7px 14px",
                fontSize: 13,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "#2563eb",
                fontWeight: 600,
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleYeniSatirEkle(true);
                setContextMenu(null);
              }}
            >
              <IconPlus size={16} />
              <span>Yeni Satır Ekle</span>
            </div>

            {/* Satırı Sil */}
            <div
              style={{
                padding: "7px 14px",
                fontSize: 13,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "#ef4444",
                fontWeight: 600,
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSatirSil(contextMenu.satirId);
              }}
            >
              <IconTrash size={16} />
              <span>Satırı Sil</span>
            </div>

            {/* Sayılanı Temizle */}
            <div
              style={{
                padding: "7px 14px",
                fontSize: 13,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "#475569",
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSatirGuncelle(contextMenu.satirId, "sayilanAdet", "");
                handleSatirGuncelle(contextMenu.satirId, "sayilanGram", "");
                setContextMenu(null);
                showToast("Sayılan miktar boşaltıldı.", "info");
              }}
            >
              <IconRotate size={16} />
              <span>Sayılanı Temizle (Boşalt)</span>
            </div>

            {/* Barkodu Kopyala */}
            <div
              style={{
                padding: "7px 14px",
                fontSize: 13,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "#475569",
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                navigator.clipboard.writeText(contextMenu.barkod);
                setContextMenu(null);
                showToast(`Barkod kopyalandı: ${contextMenu.barkod}`, "info");
              }}
            >
              <IconCopy size={16} />
              <span>Barkodu Kopyala</span>
            </div>
          </div>
        </>
      )}

      {/* ─── 5. ELLE ÜRÜN SEÇME LOOKUP MODALI (DÜRBÜN) ──────────────────────── */}
      <LookupModal
        show={lookupOpen}
        onHide={() => setLookupOpen(false)}
        title="Sistemden Ürün / Etiket Seç (Varsa Vurgular, Yoksa Tabloya Ekler)"
        items={allLookupProducts}
        columns={lookupColumns}
        isLoading={loading}
        searchPlaceholder="Barkod, model, ürün adı veya ayar ile arayın..."
        filterFn={(item, term) => {
          const q = term.toLowerCase();
          return (
            item.barkod.toLowerCase().includes(q) ||
            item.ad.toLowerCase().includes(q) ||
            item.ayar.toLowerCase().includes(q)
          );
        }}
        onSelect={handleLookupSelect}
      />

      {/* ─── 6. GEÇMİŞ / KAYITLI SAYIM FİŞLERİ LOOKUP MODALI (F3 / Dürbün) ─── */}
      <LookupModal<any>
        show={kayitliFislerModal}
        title="Kayıtlı Sayım Fişi Seçiniz"
        columns={sayimFisLookupColumns}
        items={kayitliFisler}
        searchPlaceholder="Fiş no, tarih, açıklama veya lokasyon ile ara..."
        filterFn={(f, term) => {
          const t = term.toLowerCase();
          return (
            (f.fisNo ? f.fisNo.toLowerCase().includes(t) : false) ||
            (f.tarih ? f.tarih.toLowerCase().includes(t) : false) ||
            (f.saat ? f.saat.toLowerCase().includes(t) : false) ||
            (f.depoBanko ? f.depoBanko.toLowerCase().includes(t) : false) ||
            (f.aciklama ? f.aciklama.toLowerCase().includes(t) : false)
          );
        }}
        onSelect={(selected) => {
          handleKayitliFisYukle(selected);
          setKayitliFislerModal(false);
        }}
        onHide={() => setKayitliFislerModal(false)}
      />

      {/* ─── 7. YENİ SAYIM FİŞİ ONAY POPUP MODALI ────────────────────────────── */}
      <Modal
        show={showYeniConfirm}
        onHide={() => setShowYeniConfirm(false)}
        centered
        size="sm"
      >
        <Modal.Header closeButton className="py-2 bg-light">
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 text-primary">
            <IconPlus size={18} />
            <span>Yeni Sayım Fişi</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="py-3">
          <p className="mb-0" style={{ fontSize: "13.5px", color: "#334155", lineHeight: "1.5" }}>
            Mevcut kayıt veritabanında korunarak yeni ve boş bir sayım fişine geçilecektir. Devam etmek istiyor musunuz?
          </p>
        </Modal.Body>
        <Modal.Footer className="py-2 d-flex justify-content-end gap-2 bg-light">
          <Button variant="secondary" size="sm" onClick={() => setShowYeniConfirm(false)}>
            Vazgeç
          </Button>
          <Button variant="primary" size="sm" onClick={handleYeniOnayla} className="px-3 fw-semibold">
            Tamam
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ─── 8. SAYIM FİŞİ SİLME ONAY POPUP MODALI ────────────────────────────── */}
      <Modal
        show={showSilConfirm}
        onHide={() => setShowSilConfirm(false)}
        centered
        size="sm"
      >
        <Modal.Header closeButton className="py-2 bg-light">
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 text-danger">
            <IconTrash size={18} />
            <span>Sayım Fişini Sil</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="py-3">
          <p className="mb-0" style={{ fontSize: "13.5px", color: "#334155", lineHeight: "1.5" }}>
            {fisNo ? (
              <>
                <strong className="text-dark font-monospace">[{fisNo}]</strong> numaralı kayıtlı sayım fişini veritabanından silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
              </>
            ) : (
              "Bu kayıtlı sayım fişini veritabanından silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
            )}
          </p>
        </Modal.Body>
        <Modal.Footer className="py-2 d-flex justify-content-end gap-2 bg-light">
          <Button variant="secondary" size="sm" onClick={() => setShowSilConfirm(false)}>
            Vazgeç
          </Button>
          <Button variant="danger" size="sm" onClick={handleSilOnayla} className="px-3 fw-semibold">
            Sil
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default BarkodluSayimFisiPage;
