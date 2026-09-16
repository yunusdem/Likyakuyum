import React, { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
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
} from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import LookupModal, { LookupColumn } from "../../components/common/LookupModal";
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
import useERPAutoFocus from "../../hooks/useERPAutoFocus";

export const KasaHareketPage: React.FC = () => {
  const location = useLocation();
  const isEditPage = location.pathname.includes("hareket-duzeltme");

  // ─── State: Hareket Form Alanları (TODVZ_HESAP_HAREKETI) ───────────────────
  const [hesapHareketiId, setHesapHareketiId] = useState<number | null>(null);
  const [tarih, setTarih] = useState<string>(new Date().toISOString().slice(0, 10));
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
  const [notification, setNotification] = useState<{ type: "success" | "danger" | "warning"; message: string } | null>(null);

  // Modallar
  const [showHareketLookup, setShowHareketLookup] = useState(false);
  const [showHesapLookup, setShowHesapLookup] = useState(false);
  const [showVezneLookup, setShowVezneLookup] = useState(false);
  const [showParaLookup, setShowParaLookup] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const hasAutoSelectedRef = useRef(false);
  const meblagRef = useRef<HTMLInputElement | null>(null);
  const aciklamaRef = useRef<HTMLInputElement | null>(null);

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

  useERPAutoFocus({ dependencies: [hesapHareketiId] });

  const showNotif = (type: "success" | "danger" | "warning", msg: string) => {
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
  const handleMeblagChange = (val: string) => {
    setMeblag(val);
    const mNum = parseFloat(val) || 0;
    const oNum = parseFloat(String(kdvOrani)) || 0;
    if (mNum > 0 && oNum > 0) {
      setKdvTutari(parseFloat(((mNum * oNum) / 100).toFixed(4)));
    } else {
      setKdvTutari(0);
    }
  };

  const handleKdvOraniChange = (val: string) => {
    setKdvOrani(val);
    const mNum = parseFloat(String(meblag)) || 0;
    const oNum = parseFloat(val) || 0;
    if (mNum > 0 && oNum > 0) {
      setKdvTutari(parseFloat(((mNum * oNum) / 100).toFixed(4)));
    } else {
      setKdvTutari(0);
    }
  };

  const handleKdvTutariChange = (val: string) => {
    setKdvTutari(val);
    const mNum = parseFloat(String(meblag)) || 0;
    const kNum = parseFloat(val) || 0;
    if (mNum > 0 && kNum > 0) {
      setKdvOrani(parseFloat(((kNum / mNum) * 100).toFixed(2)));
    }
  };

  const meblagNum = parseFloat(String(meblag)) || 0;
  const kdvTutariNum = parseFloat(String(kdvTutari)) || 0;
  const genelToplam = meblagNum + kdvTutariNum;

  const mevcutVezneBakiye = vezneBakiyeler.find(
    (b) => Number(b.paraId) === Number(paraId) || (b.paraKodu && b.paraKodu.toUpperCase() === (paraKod || "").toUpperCase())
  )?.miktar ?? 0;

  // ─── Hesap Seçimi ────────────────────────────────────────────────────────────
  const handleSelectHesap = useCallback((h: HesapItem) => {
    setHesapId(h.hesapId);
    setHesapKod(h.kod || "");
    setHesapAd(h.ad || "");
    setHesapBakiye(h.bakiye || 0);
    const oran = h.kdvOrani ?? 0;
    setKdvOrani(oran);

    const mNum = parseFloat(String(meblag)) || 0;
    if (mNum > 0 && oran > 0) {
      setKdvTutari(parseFloat(((mNum * oran) / 100).toFixed(4)));
    } else {
      setKdvTutari(0);
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
      }
    }

    setTimeout(() => meblagRef.current?.focus(), 50);
  }, [lookups.paralar, meblag]);

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
      setHesapList(hesaplar);
      setHareketList(hareketler);
      setLookups(lks);
      setVezneList(vezneler);

      // Para birimi varsayılanı: HAS veya ilk para
      let defaultParaId = paraId;
      if (!defaultParaId && lks.paralar.length > 0) {
        const hasAltin = lks.paralar.find((p) => ["HAS", "GR"].includes((p.kod || "").toUpperCase()));
        const defaultPara = hasAltin || lks.paralar[0];
        setParaId(defaultPara.id);
        setParaKod(defaultPara.kod);
        setParaAd(defaultPara.ad);
        defaultParaId = defaultPara.id;
      }

      // Vezne varsayılanı: Kullanıcının veznesi veya ilk vezne
      let defaultVezneId = vezneId;
      if (!defaultVezneId) {
        const defaultVezne =
          (kullaniciVezneId && vezneler.find((v) => v.id === kullaniciVezneId)) || vezneler[0] || null;
        if (defaultVezne) {
          setVezneId(defaultVezne.id);
          setVezneKod(defaultVezne.kod);
          setVezneAd(defaultVezne.ad);
          defaultVezneId = defaultVezne.id;
        }
      }

      // Otomatik Üretim Hesabı Ön-seçimi (Kayıt modunda ve henüz hesap seçilmemişse)
      if (!isEditPage && !hesapId && hesaplar.length > 0) {
        let uretimIdStr = localStorage.getItem("kuyumcu_erp_uretim_hesabi_id");
        let targetAccount = uretimIdStr ? hesaplar.find((h) => String(h.hesapId) === uretimIdStr) : null;

        if (!targetAccount) {
          try {
            const defs = await CompanyService.getDefinitions();
            if (defs?.URETIM_HESABI_ID) {
              targetAccount = hesaplar.find((h) => h.hesapId === defs.URETIM_HESABI_ID) || null;
            }
          } catch {
            // ignore
          }
        }

        if (!targetAccount) {
          targetAccount = hesaplar.find((h) => {
            const txt = `${h.kod || ""} ${h.ad || ""}`.toLocaleUpperCase("tr-TR");
            return txt.includes("URETIM") || txt.includes("ÜRETİM") || txt.includes("İMALAT") || txt.includes("IMALAT");
          }) || null;
        }

        if (targetAccount) {
          handleSelectHesap(targetAccount);
        }
      }

      if (defaultVezneId) {
        fetchVezneBakiyeler(defaultVezneId);
      }
    } catch (err: any) {
      showNotif("danger", err?.message || "Kasa hareket verileri yüklenemedi.");
    }
  }, [paraId, vezneId, isEditPage, hesapId, handleSelectHesap, fetchVezneBakiyeler]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Düzeltme modunda ilk açılışta otomatik olarak en son hareketi seç
  useEffect(() => {
    if (isEditPage && !hasAutoSelectedRef.current && hareketList.length > 0) {
      hasAutoSelectedRef.current = true;
      const sonHareket = hareketList[0]; // En yeni tarihli hareket
      handleSelectHareket(sonHareket);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditPage, hareketList]);

  // Vezne seçildiğinde anlık bakiyeleri yükle
  useEffect(() => {
    if (vezneId) {
      fetchVezneBakiyeler(vezneId);
    } else {
      setVezneBakiyeler([]);
    }
  }, [vezneId, fetchVezneBakiyeler]);

  // ─── Hareket Seçimi ──────────────────────────────────────────────────────────
  const handleSelectHareket = useCallback((h: HesapHareketiItem) => {
    setHesapHareketiId(h.hesapHareketiId);
    setTarih((h.tarih || "").slice(0, 10));
    setAciklama(h.aciklama || "");
    setTip(h.tip);
    setHesapId(h.hesapId);
    setHesapKod(h.hesapKod || "");
    setHesapAd(h.hesapAd || "");
    setVezneId(h.vezneId);
    setVezneKod(h.vezneKod || "");
    setVezneAd(h.vezneAd || "");
    setParaId(h.paraId);
    setParaKod(h.paraKodu || "");
    setParaAd(h.paraAdi || "");
    setMeblag(h.meblag);
    setKdvOrani(h.kdvOrani ?? 0);
    const calculatedKdv = h.kdv !== undefined && h.kdv !== null ? h.kdv : (h.meblag && h.kdvOrani ? parseFloat(((h.meblag * h.kdvOrani) / 100).toFixed(4)) : 0);
    setKdvTutari(calculatedKdv);
    setEklemeZamani(h.eklemeZamani || null);
    setGuncellemeZamani(h.guncellemeZamani || null);

    // Seçilen hesabın güncel bakiye bilgisini güncelle
    const foundHesap = hesapList.find((x) => x.hesapId === h.hesapId);
    if (foundHesap) {
      setHesapBakiye(foundHesap.bakiye || 0);
    }
    if (h.vezneId) {
      fetchVezneBakiyeler(h.vezneId);
    }
  }, [hesapList, fetchVezneBakiyeler]);

  // ─── Yeni Kayıt Modu (F4) - Üretim Hesabı Otomatik Seçilir ──────────────────
  const handleNew = useCallback(() => {
    setHesapHareketiId(null);
    setTarih(new Date().toISOString().slice(0, 10));
    setAciklama("");
    setTip(1);

    // Otomatik Üretim Hesabı Seçimi
    let uretimIdStr = localStorage.getItem("kuyumcu_erp_uretim_hesabi_id");
    let targetAccount = uretimIdStr ? hesapList.find((h) => String(h.hesapId) === uretimIdStr) : null;
    if (!targetAccount) {
      targetAccount = hesapList.find((h) => {
        const txt = `${h.kod || ""} ${h.ad || ""}`.toLocaleUpperCase("tr-TR");
        return txt.includes("URETIM") || txt.includes("ÜRETİM") || txt.includes("İMALAT") || txt.includes("IMALAT");
      }) || null;
    }

    if (targetAccount) {
      handleSelectHesap(targetAccount);
    } else {
      setHesapId(null);
      setHesapKod("");
      setHesapAd("");
      setHesapBakiye(0);
      setKdvOrani(0);
      setKdvTutari(0);
    }

    setMeblag("");
    setEklemeZamani(null);
    setGuncellemeZamani(null);
    if (vezneId) {
      fetchVezneBakiyeler(vezneId);
    }
  }, [hesapList, handleSelectHesap, vezneId, fetchVezneBakiyeler]);

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
    if (!meblag || Number(meblag) <= 0) {
      showNotif("warning", "Lütfen geçerli bir gramaj/meblağ giriniz.");
      meblagRef.current?.focus();
      return null;
    }

    setIsSaving(true);
    try {
      const meblagNumber = parseFloat(String(meblag)) || 0;
      const kdvOraniNumber = parseFloat(String(kdvOrani)) || 0;
      const kdvTutariNumber = parseFloat(String(kdvTutari)) || 0;
      const defaultAciklama = aciklama.trim() || `${hesapAd} ${tip === 1 ? "Hammadde Çıkış Fişi" : "Hammadde Giriş Fişi"}`;
      const payload: SaveHesapHareketiPayload = {
        hesapHareketiId,
        hesapId,
        tarih,
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
      setHareketList(updatedHareketler);
      setHesapList(updatedHesaplar);

      // Vezne bakiyesini anlık güncelle
      if (vezneId) {
        fetchVezneBakiyeler(vezneId);
      }

      // Kayıt sayfasında kayıt olduktan hemen sonra formu tamamen temizle
      if (!isEditPage) {
        handleNew();
      } else {
        setHesapHareketiId(saved.hesapHareketiId);
        setAciklama(saved.aciklama || defaultAciklama);
      }

      return saved;
    } catch (err: any) {
      showNotif("danger", err?.message || "Kasa hareketi kaydedilirken hata oluştu.");
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [hesapId, vezneId, paraId, meblag, tip, aciklama, hesapAd, hesapHareketiId, tarih, kdvOrani, kdvTutari, degisiklikTakipVar, isEditPage, handleNew, fetchVezneBakiyeler]);

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
      setHareketList(updatedHareketler);
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
  const currentIndex = hareketList.findIndex((h) => h.hesapHareketiId === hesapHareketiId);
  const handleFirst = () => { if (hareketList.length) handleSelectHareket(hareketList[hareketList.length - 1]); };
  const handlePrev = () => {
    if (currentIndex < hareketList.length - 1) handleSelectHareket(hareketList[currentIndex + 1]);
    else if (hareketList.length) handleSelectHareket(hareketList[0]);
  };
  const handleNext = () => {
    if (currentIndex > 0) handleSelectHareket(hareketList[currentIndex - 1]);
    else if (hareketList.length) handleSelectHareket(hareketList[hareketList.length - 1]);
  };
  const handleLast = () => { if (hareketList.length) handleSelectHareket(hareketList[0]); };

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
        <span className="fw-semibold">
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
    { header: "Hesap Adı", render: (it) => it.ad },
    { header: "KDV Oranı", width: "90px", align: "right", render: (it) => `%${Number(it.kdvOrani || 0)}` },
    {
      header: "Bakiye",
      width: "130px",
      align: "right",
      render: (it) => (
        <span className={`fw-semibold ${Number(it.bakiye || 0) < 0 ? "text-danger" : "text-success"}`}>
          {Number(it.bakiye || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
        </span>
      ),
    },
  ];

  const vezneColumns: LookupColumn<VezneItem>[] = [
    { header: "Kod", render: (i) => i.kod, width: "80px" },
    { header: "Ad", render: (i) => i.ad },
  ];

  const paraColumns: LookupColumn<{ id: number; kod: string; ad: string }>[] = [
    { header: "Kod", render: (i) => i.kod, width: "80px" },
    { header: "Ad", render: (i) => i.ad },
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
        onNew={handleNew}
        onRefresh={() => window.location.reload()}
        onSearch={() => setShowHareketLookup(true)}
        onPrint={() => window.print()}
        onFirst={handleFirst}
        onPrev={handlePrev}
        onNext={handleNext}
        onLast={handleLast}
        modeText={hesapHareketiId ? `Düzenleme: #${hesapHareketiId} ${hesapAd}` : "Yeni Hareket Modu"}
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
            ) : (
              <IconAlertTriangle size={18} className="me-2 text-danger flex-shrink-0" />
            )}
            <span style={{ fontSize: "13px" }}>{notification.message}</span>
          </Alert>
        </div>
      )}

      {/* 2. Kasa Hareketi Formu */}
      <Card className="border shadow-sm mb-3 w-100 bg-white">
        <Card.Body className="p-3">
          <Row className="g-3">
            {/* ─── SOL SÜTUN: Temel Bilgiler ─── */}
            <Col lg={6} md={12}>
              {/* İşlem Tarihi */}
              <Form.Group as={Row} className="mb-2 align-items-center g-2">
                <Form.Label column style={{ width: "125px", flex: "0 0 125px", maxWidth: "125px" }} className="small fw-bold text-secondary text-start">
                  İşlem Tarihi <span className="text-danger">*</span> :
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

              {/* İşlem Türü (Giriş / Çıkış) */}
              <Form.Group as={Row} className="mb-2 align-items-center g-2">
                <Form.Label column style={{ width: "125px", flex: "0 0 125px", maxWidth: "125px" }} className="small fw-bold text-secondary text-start">
                  İşlem Türü <span className="text-danger">*</span> :
                </Form.Label>
                <Col>
                  <Form.Select
                    size="sm"
                    value={tip}
                    onChange={(e) => setTip(Number(e.target.value))}
                    className="fw-semibold"
                  >
                    <option value={1}>Kasadan Çıkış</option>
                    <option value={0}>Kasaya Giriş</option>
                  </Form.Select>
                </Col>
              </Form.Group>

              {/* Hesap Seçimi */}
              <Form.Group as={Row} className="mb-2 align-items-center g-2">
                <Form.Label column style={{ width: "125px", flex: "0 0 125px", maxWidth: "125px" }} className="small fw-bold text-secondary text-start">
                  Hesap Seçimi <span className="text-danger">*</span> :
                </Form.Label>
                <Col>
                  <InputGroup size="sm">
                    <Form.Control
                      type="text"
                      readOnly
                      placeholder=""
                      value={hesapKod ? `${hesapKod} - ${hesapAd}` : hesapAd}
                      className="fw-bold bg-light"
                    />
                    <Button
                      variant="outline-secondary"
                      onClick={() => setShowHesapLookup(true)}
                      title="Hesap Listesinden Seç (F3)"
                    >
                      <IconBinoculars size={16} />
                    </Button>
                  </InputGroup>
                </Col>
              </Form.Group>

              {/* Açıklama */}
              <Form.Group as={Row} className="mb-2 align-items-center g-2">
                <Form.Label column style={{ width: "125px", flex: "0 0 125px", maxWidth: "125px" }} className="small fw-bold text-secondary text-start">
                  Açıklama :
                </Form.Label>
                <Col>
                  <Form.Control
                    type="text"
                    size="sm"
                    value={aciklama}
                    onChange={(e) => setAciklama(e.target.value)}
                  />
                </Col>
              </Form.Group>
            </Col>

            {/* ─── SAĞ SÜTUN: Finansal Bilgiler & Vezne ─── */}
            <Col lg={6} md={12}>
              {/* Vezne Seçimi */}
              <Form.Group as={Row} className="mb-2 align-items-center g-2">
                <Form.Label column style={{ width: "125px", flex: "0 0 125px", maxWidth: "125px" }} className="small fw-bold text-secondary text-start">
                  Vezne <span className="text-danger">*</span> :
                </Form.Label>
                <Col>
                  <InputGroup size="sm">
                    <Form.Control
                      type="text"
                      readOnly
                      placeholder=""
                      value={vezneKod ? `${vezneKod} - ${vezneAd}` : vezneAd}
                      className="fw-semibold bg-light"
                    />
                    <Button
                      variant="outline-secondary"
                      onClick={() => setShowVezneLookup(true)}
                      title="Vezne Seç"
                    >
                      <IconBinoculars size={16} />
                    </Button>
                  </InputGroup>
                </Col>
              </Form.Group>

              {/* Gramaj / Meblağ & Para Birimi Seçici */}
              <Form.Group as={Row} className="mb-2 align-items-center g-2">
                <Form.Label column style={{ width: "125px", flex: "0 0 125px", maxWidth: "125px" }} className="small fw-bold text-secondary text-start">
                  Gramaj / Meblağ <span className="text-danger">*</span> :
                </Form.Label>
                <Col>
                  <InputGroup size="sm">
                    <Form.Control
                      type="number"
                      step="any"
                      value={meblag}
                      onChange={(e) => handleMeblagChange(e.target.value)}
                      className="fw-bold font-monospace text-primary text-end allow-full-width"
                      style={{ minWidth: "120px", flex: "1 1 auto" }}
                    />
                    {/* Açılır Para Birimi Kutusu (Kısa ve aşağı oku kaldırılmış) */}
                    <Form.Select
                      size="sm"
                      value={paraId ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val) {
                          setParaId(null);
                          setParaKod("TL");
                        } else {
                          const pId = Number(val);
                          const matched = lookups.paralar.find((p) => p.id === pId);
                          if (matched) {
                            setParaId(matched.id);
                            setParaKod(matched.kod);
                          }
                        }
                      }}
                      style={{
                        width: "56px",
                        maxWidth: "56px",
                        minWidth: "56px",
                        fontWeight: "bold",
                        backgroundImage: "none",
                        appearance: "none",
                        WebkitAppearance: "none",
                        textAlign: "center",
                        paddingLeft: "4px",
                        paddingRight: "4px",
                      }}
                      className="bg-light font-monospace text-center flex-shrink-0"
                    >
                      {lookups.paralar.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.kod}
                        </option>
                      ))}
                    </Form.Select>
                    <Button
                      variant="outline-secondary"
                      onClick={() => setShowParaLookup(true)}
                      title="Para Birimi Ara"
                    >
                      <IconBinoculars size={15} />
                    </Button>
                  </InputGroup>
                </Col>
              </Form.Group>

              {/* KDV Oranı (%) & KDV Tutarı */}
              <Form.Group as={Row} className="mb-2 align-items-center g-2">
                <Form.Label column style={{ width: "125px", flex: "0 0 125px", maxWidth: "125px" }} className="small fw-bold text-secondary text-start">
                  KDV Oranı (%) :
                </Form.Label>
                <Col>
                  <div className="d-flex align-items-center gap-2">
                    <Form.Control
                      type="number"
                      step="any"
                      size="sm"
                      value={kdvOrani}
                      onChange={(e) => handleKdvOraniChange(e.target.value)}
                      className="font-monospace text-end"
                      style={{ maxWidth: "80px" }}
                    />
                    <span className="small fw-bold text-secondary flex-shrink-0">Tutar:</span>
                    <Form.Control
                      type="number"
                      step="any"
                      size="sm"
                      value={kdvTutari}
                      onChange={(e) => handleKdvTutariChange(e.target.value)}
                      className="font-monospace text-end bg-light fw-semibold"
                    />
                  </div>
                </Col>
              </Form.Group>

              {/* Genel Toplam (Meblağ + KDV) */}
              <Form.Group as={Row} className="mb-2 align-items-center g-2">
                <Form.Label column style={{ width: "125px", flex: "0 0 125px", maxWidth: "125px" }} className="small fw-bold text-secondary text-start">
                  Toplam Tutar :
                </Form.Label>
                <Col>
                  <Form.Control
                    type="text"
                    size="sm"
                    readOnly
                    value={`${genelToplam.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ${paraKod}`}
                    className="fw-bold font-monospace bg-light text-end"
                  />
                </Col>
              </Form.Group>

              {/* Değişiklik Takip Switch */}
              <Form.Group as={Row} className="mb-2 align-items-center g-2">
                <Form.Label column style={{ width: "125px", flex: "0 0 125px", maxWidth: "125px" }} className="small fw-bold text-secondary text-start">
                  Değişiklik Takibi :
                </Form.Label>
                <Col>
                  <Form.Check
                    type="switch"
                    id="logTakip"
                    label="Log Kaydı Tutulsun"
                    checked={degisiklikTakipVar}
                    onChange={(e) => setDegisiklikTakipVar(e.target.checked)}
                    className="small fw-semibold text-secondary"
                  />
                </Col>
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* ─── MODALLAR ────────────────────────────────────────────────────────── */}

      {/* Hareket Lookup (F3) */}
      <LookupModal<HesapHareketiItem>
        show={showHareketLookup}
        title="Kasa Hareketi Seçiniz"
        columns={hareketLookupColumns}
        items={hareketList}
        filterFn={(it, term) => {
          const t = term.toLowerCase();
          return (
            (it.aciklama ? it.aciklama.toLowerCase().includes(t) : false) ||
            (it.hesapAd ? it.hesapAd.toLowerCase().includes(t) : false) ||
            (it.hesapKod ? it.hesapKod.toLowerCase().includes(t) : false) ||
            (it.vezneAd ? it.vezneAd.toLowerCase().includes(t) : false)
          );
        }}
        onSelect={(selected) => {
          handleSelectHareket(selected);
          setShowHareketLookup(false);
        }}
        onHide={() => setShowHareketLookup(false)}
      />

      {/* Hesap Lookup Modalı */}
      <LookupModal<HesapItem>
        show={showHesapLookup}
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
        }}
        onHide={() => setShowHesapLookup(false)}
      />

      {/* Vezne Lookup Modalı */}
      <LookupModal<VezneItem>
        show={showVezneLookup}
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
          fetchVezneBakiyeler(selected.id);
          setShowVezneLookup(false);
        }}
        onHide={() => setShowVezneLookup(false)}
      />

      {/* Para/Birim Lookup Modalı */}
      <LookupModal<{ id: number; kod: string; ad: string }>
        show={showParaLookup}
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
          setShowParaLookup(false);
        }}
        onHide={() => setShowParaLookup(false)}
      />

      {/* Silme Onay Modalı */}
      <Modal show={showDeleteConfirm} onHide={() => setShowDeleteConfirm(false)} centered size="sm">
        <Modal.Header closeButton>
          <Modal.Title className="fs-6 fw-bold text-danger d-flex align-items-center gap-2">
            <IconAlertTriangle size={18} /> Kasa Hareketini Geri Al
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="py-3">
          <p className="mb-0 small">
            <strong>#{hesapHareketiId}</strong> numaralı hareket ({hesapAd} - {meblag} {paraKod}) geri alınacak ve vezne bakiyesi eski haline döndürülecektir. Devam etmek istiyor musunuz?
          </p>
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
