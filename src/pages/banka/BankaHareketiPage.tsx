import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Container, Row, Col, Card, Form, Button, Badge, Alert, Modal, InputGroup } from "react-bootstrap";
import {
  IconBuildingBank,
  IconCheck,
  IconBinoculars,
  IconAlertTriangle,
  IconClock,
} from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import LookupModal, { LookupColumn } from "../../components/common/LookupModal";
import {
  BankaService,
  BankaHareketItem,
  SaveBankaHareketPayload,
  BankaHesapItem,
} from "../../services/bankaService";
import { CariService } from "../../services/cariService";

// Varsayılan Standart Bankalar (DovizFisiPage eşleniği)
const DEFAULT_BANKALAR = [
  { id: 102001, kod: "102.01.001", ad: "Garanti BBVA - Ticari TL Hesabı", unvan: "Garanti BBVA - Ticari TL Hesabı", bankaAdi: "Garanti BBVA", iban: "TR33 0006 2000 0001 2345 6789 01", hesapNo: "6200000-1" },
  { id: 102002, kod: "102.01.002", ad: "Akbank - Ana Şube Cari Hesap", unvan: "Akbank - Ana Şube Cari Hesap", bankaAdi: "Akbank", iban: "TR45 0004 6000 0002 3456 7890 12", hesapNo: "4600000-2" },
  { id: 102003, kod: "102.01.003", ad: "İş Bankası - Kapalıçarşı Ticari TL", unvan: "İş Bankası - Kapalıçarşı Ticari TL", bankaAdi: "İş Bankası", iban: "TR64 0006 4000 0003 4567 8901 23", hesapNo: "6400000-3" },
  { id: 102004, kod: "102.01.004", ad: "Yapı Kredi - Döviz & Altın Operasyon", unvan: "Yapı Kredi - Döviz & Altın Operasyon", bankaAdi: "Yapı Kredi", iban: "TR92 0006 7000 0004 5678 9012 34", hesapNo: "6700000-4" },
  { id: 102005, kod: "102.01.005", ad: "Ziraat Bankası - Kurumsal Vadesiz", unvan: "Ziraat Bankası - Kurumsal Vadesiz", bankaAdi: "Ziraat Bankası", iban: "TR10 0001 0000 0005 6789 0123 45", hesapNo: "1000000-5" },
  { id: 102006, kod: "102.01.006", ad: "VakıfBank - Merkez Şube Hesabı", unvan: "VakıfBank - Merkez Şube Hesabı", bankaAdi: "VakıfBank", iban: "TR15 0001 5000 0006 7890 1234 56", hesapNo: "1500000-6" },
  { id: 102007, kod: "102.01.007", ad: "QNB Finansbank - Kurumsal Cari", unvan: "QNB Finansbank - Kurumsal Cari", bankaAdi: "QNB Finansbank", iban: "TR88 0011 1000 0007 8901 2345 67", hesapNo: "1110000-7" },
  { id: 102008, kod: "102.01.008", ad: "Halkbank - Ticari Cari Hesap", unvan: "Halkbank - Ticari Cari Hesap", bankaAdi: "Halkbank", iban: "TR20 0001 2000 0008 9012 3456 78", hesapNo: "1200000-8" },
  { id: 102009, kod: "102.01.009", ad: "DenizBank - Merkez Şube", unvan: "DenizBank - Merkez Şube", bankaAdi: "DenizBank", iban: "TR55 0013 4000 0009 0123 4567 89", hesapNo: "1340000-9" },
  { id: 102010, kod: "102.01.010", ad: "Kuveyt Türk - Katılım Hesabı", unvan: "Kuveyt Türk - Katılım Hesabı", bankaAdi: "Kuveyt Türk", iban: "TR30 0020 5000 0010 1234 5678 90", hesapNo: "2050000-10" },
  { id: 102011, kod: "102.01.011", ad: "Türk Ekonomi Bankası (TEB)", unvan: "Türk Ekonomi Bankası (TEB)", bankaAdi: "Türk Ekonomi Bankası (TEB)", iban: "TR40 0032 0000 0011 1234 5678 90", hesapNo: "3200000-11" },
  { id: 102012, kod: "102.01.012", ad: "Türkiye Finans Katılım", unvan: "Türkiye Finans Katılım", bankaAdi: "Türkiye Finans", iban: "TR80 0020 6000 0012 1234 5678 90", hesapNo: "2060000-12" },
  { id: 102013, kod: "102.01.013", ad: "Albaraka Türk Katılım", unvan: "Albaraka Türk Katılım", bankaAdi: "Albaraka Türk", iban: "TR70 0020 3000 0013 1234 5678 90", hesapNo: "2030000-13" },
  { id: 102014, kod: "102.01.014", ad: "Şekerbank", unvan: "Şekerbank", bankaAdi: "Şekerbank", iban: "TR50 0005 9000 0014 1234 5678 90", hesapNo: "5900000-14" },
  { id: 102015, kod: "102.01.015", ad: "ING Bank", unvan: "ING Bank", bankaAdi: "ING Bank", iban: "TR60 0009 9000 0015 1234 5678 90", hesapNo: "9900000-15" },
];

const ISLEM_TIPLERI = [
  { value: 0, label: "0- Gelen Havale / EFT (Giriş)" },
  { value: 1, label: "1- Giden Havale / EFT (Çıkış)" },
  { value: 2, label: "2- Kasadan Bankaya Nakit Yatırma" },
  { value: 3, label: "3- Bankadan Kasaya Nakit Çekme" },
  { value: 4, label: "4- Banka Virmanı (Hesaplar Arası)" },
];

export const BankaHareketiPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const queryId = searchParams.get("id");

  // ─── Form State (Banka Hesap Kartları UI İle Birebir Uyumlu) ────────────────
  const [hareketId, setHareketId] = useState<number | null>(null);
  const [islemTipi, setIslemTipi] = useState<number>(0);
  const [hesapNo, setHesapNo] = useState<string>("");
  const [hesapAdi, setHesapAdi] = useState<string>("");
  const [bankaId, setBankaId] = useState<number | null>(null);
  const [cariAdi, setCariAdi] = useState<string>("");
  const [cariKartId, setCariKartId] = useState<number | null>(null);
  const [tarih, setTarih] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [aciklama, setAciklama] = useState<string>("");
  const [meblag, setMeblag] = useState<string>("");

  // ─── Input Refs (Enter İle Gezinme) ─────────────────────────────────────────
  const islemTipiRef = useRef<HTMLSelectElement | null>(null);
  const hesapNoRef = useRef<HTMLInputElement | null>(null);
  const hesapAdiRef = useRef<HTMLInputElement | null>(null);
  const cariAdiRef = useRef<HTMLInputElement | null>(null);
  const tarihRef = useRef<HTMLInputElement | null>(null);
  const meblagRef = useRef<HTMLInputElement | null>(null);
  const aciklamaRef = useRef<HTMLInputElement | null>(null);

  // ─── Lookups & Lists ───────────────────────────────────────────────────────
  const [bankaList, setBankaList] = useState<any[]>(DEFAULT_BANKALAR);
  const [cariList, setCariList] = useState<any[]>([]);
  const [hareketList, setHareketList] = useState<BankaHareketItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "danger" | "warning"; message: string } | null>(null);

  // Canlı Tarih & Saat
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

  // Modals
  const [showHareketLookup, setShowHareketLookup] = useState(false);
  const [showBankaLookup, setShowBankaLookup] = useState(false);
  const [showCariLookup, setShowCariLookup] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const showNotif = (type: "success" | "danger" | "warning", msg: string) => {
    setNotification({ type, message: msg });
    setTimeout(() => setNotification(null), 4000);
  };

  // ─── Load Initial Lookups & Movements ───────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      const [bankalar, hareketler, cariLk, lookups] = await Promise.all([
        BankaService.getBankalar().catch(() => []),
        BankaService.getHareketler().catch(() => []),
        CariService.getLookups().catch(() => null),
        BankaService.getLookups().catch(() => null),
      ]);

      const combinedBankalar: any[] = [];
      const seen = new Set<string>();

      // 1. TODVZ_BANKA hesap kartları
      (bankalar || []).forEach((b: BankaHesapItem) => {
        const key = `b-${b.bankaId}`;
        if (!seen.has(key)) {
          seen.add(key);
          combinedBankalar.push({
            id: b.bankaId,
            bankaId: b.bankaId,
            kod: b.hesapNo,
            ad: b.hesapAdi,
            unvan: b.hesapAdi,
            bankaAdi: b.bankaAdi || b.hesapAdi,
            iban: b.iban || "",
            hesapNo: b.hesapNo || "",
            subeAdi: b.subeAdi || "",
          });
        }
      });

      // 2. TODVZ_CARI_KART banka hesapları (DovizFisiPage gibi)
      const cariBankaList = (lookups?.bankaAdlari && lookups.bankaAdlari.length > 0)
        ? lookups.bankaAdlari
        : (cariLk?.bankaList || []);

      (cariBankaList || []).forEach((b: any) => {
        const key = `c-${b.id || b.kod}`;
        if (!seen.has(key)) {
          seen.add(key);
          combinedBankalar.push({
            id: b.id,
            bankaId: b.id,
            kod: b.kod,
            ad: b.ad || b.unvan || b.bankaAdi,
            unvan: b.unvan || b.ad || b.bankaAdi,
            bankaAdi: b.bankaAdi || b.ad,
            iban: b.iban || "",
            hesapNo: b.hesapNo || b.kod || "",
            subeAdi: b.subeAdi || "",
          });
        }
      });

      // 3. Fallback DEFAULT_BANKALAR (Hiçbir zaman boş kalmasın)
      DEFAULT_BANKALAR.forEach((b) => {
        const key = `def-${b.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          combinedBankalar.push(b);
        }
      });

      setBankaList(combinedBankalar);
      setHareketList(hareketler || []);
      if (lookups?.cariler && lookups.cariler.length > 0) {
        setCariList(lookups.cariler);
      }
    } catch (err: any) {
      showNotif("danger", err?.message || "Veriler yüklenirken hata oluştu.");
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Query ID ile açılma ───────────────────────────────────────────────────
  useEffect(() => {
    if (queryId && hareketList.length > 0) {
      const found = hareketList.find((h) => h.bankaHareketId === Number(queryId));
      if (found) {
        handleSelectHareket(found);
      }
    }
  }, [queryId, hareketList]);

  // ─── Seçilen Hareketi Forma Yükle (Görüntüleme / Düzenleme / Silme) ─────────
  const handleSelectHareket = useCallback((h: BankaHareketItem) => {
    setHareketId(h.bankaHareketId);
    setIslemTipi(h.islemTipi);
    setBankaId(h.bankaId);
    setHesapNo(h.bankaHesapNo || "");
    setHesapAdi(h.bankaHesapAdi || "");
    setCariKartId(h.cariKartId || null);
    setCariAdi(h.cariUnvan || "");
    setTarih(h.tarih ? h.tarih.split("T")[0] : new Date().toISOString().split("T")[0]);
    setAciklama(h.aciklama || "");

    const tutar = Number(h.toplamMeblag || h.satirlar?.[0]?.meblag || 0);
    setMeblag(tutar > 0 ? String(tutar) : "");

    showNotif("success", `Banka hareketi yüklendi: #${h.bankaHareketId}`);
  }, []);

  // ─── Formu Tamamen Temizle (F4 / Yeni Butonu) ──────────────────────────────
  const handleNew = useCallback(() => {
    setHareketId(null);
    setIslemTipi(0);
    setHesapNo("");
    setHesapAdi("");
    setBankaId(null);
    setCariAdi("");
    setCariKartId(null);
    setTarih(new Date().toISOString().split("T")[0]);
    setAciklama("");
    setMeblag("");
    hesapNoRef.current?.focus();
  }, []);

  // ─── İlk, Önceki, Sonraki, Son Kayıt Dolaşımı ───────────────────────────────
  const currentIndex = hareketList.findIndex((h) => h.bankaHareketId === hareketId);
  const handleFirst = () => { if (hareketList.length) handleSelectHareket(hareketList[0]); };
  const handlePrev = () => {
    if (currentIndex > 0) handleSelectHareket(hareketList[currentIndex - 1]);
    else if (hareketList.length) handleSelectHareket(hareketList[0]);
  };
  const handleNext = () => {
    if (currentIndex >= 0 && currentIndex < hareketList.length - 1) handleSelectHareket(hareketList[currentIndex + 1]);
    else if (hareketList.length) handleSelectHareket(hareketList[hareketList.length - 1]);
  };
  const handleLast = () => { if (hareketList.length) handleSelectHareket(hareketList[hareketList.length - 1]); };

  // ─── Kaydet / Güncelle ─────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!bankaId && !hesapNo.trim()) {
      showNotif("warning", "Lütfen bir banka hesabı seçiniz.");
      hesapNoRef.current?.focus();
      return;
    }

    const numMeblag = parseFloat(String(meblag).replace(",", "."));
    if (isNaN(numMeblag) || numMeblag <= 0) {
      showNotif("warning", "Lütfen geçerli bir meblağ giriniz.");
      meblagRef.current?.focus();
      return;
    }

    setIsSaving(true);
    try {
      let effectiveBankaId = bankaId;
      if (!effectiveBankaId) {
        const found = bankaList.find(
          (b) => String(b.kod || "").trim() === hesapNo.trim() || String(b.hesapNo || "").trim() === hesapNo.trim()
        );
        if (found) effectiveBankaId = found.bankaId || found.id;
      }

      if (!effectiveBankaId) {
        effectiveBankaId = bankaList[0]?.bankaId || bankaList[0]?.id || 1;
      }

      const payload: SaveBankaHareketPayload = {
        bankaHareketId: hareketId,
        islemTipi,
        bankaId: effectiveBankaId,
        bankaHesapNo: hesapNo.trim() || undefined,
        bankaHesapAdi: hesapAdi.trim() || undefined,
        cariKartId: cariKartId || null,
        tarih,
        aciklama: aciklama.trim() || null,
        meblag: numMeblag,
        paraId: 1, // TL
        satirlar: [
          {
            satirNo: 1,
            paraId: 1,
            meblag: numMeblag,
            kur: 1,
            giseKuru: 1,
            tutarTl: numMeblag,
            aciklama: aciklama.trim() || null,
          },
        ],
      };

      const saved = await BankaService.saveHareket(payload);
      showNotif("success", `Banka hareketi ${hareketId ? "güncellendi" : "kaydedildi"}: #${saved.bankaHareketId}`);
      setHareketId(saved.bankaHareketId);

      const updatedList = await BankaService.getHareketler();
      setHareketList(updatedList);
    } catch (err: any) {
      showNotif("danger", err?.message || "Banka hareketi kaydedilemedi.");
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Sil (Delete) ──────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!hareketId) return;
    try {
      await BankaService.deleteHareket(hareketId);
      showNotif("success", "Banka hareketi silindi.");
      setShowDeleteConfirm(false);
      handleNew();
      const updatedList = await BankaService.getHareketler();
      setHareketList(updatedList);
    } catch (err: any) {
      showNotif("danger", err?.message || "Banka hareketi silinemedi.");
    }
  };

  // ─── Klavye Kısayolları (Global & Form İçi) ────────────────────────────────
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F1") {
        e.preventDefault();
        handleSave();
      } else if (e.key === "F2") {
        e.preventDefault();
        if (hareketId) setShowDeleteConfirm(true);
      } else if (e.key === "F3") {
        e.preventDefault();
        setShowHareketLookup(true);
      } else if (e.key === "F4") {
        if (!showBankaLookup && !showCariLookup && !showHareketLookup) {
          e.preventDefault();
          handleNew();
        }
      } else if (e.key === "F5") {
        e.preventDefault();
        loadData();
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  });

  const handleInputKeyDown = (
    e: React.KeyboardEvent,
    nextRef?: React.RefObject<any>,
    prevRef?: React.RefObject<any>
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      nextRef?.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      nextRef?.current?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      prevRef?.current?.focus();
    }
  };

  // ─── Modallar İçin Lookup Kolonları ────────────────────────────────────────
  // 1. Banka Hesabı Seçimi Kolonları (DovizFisiPage ile birebir aynı)
  const bankaLookupColumns: LookupColumn<any>[] = [
    {
      header: "Hesap Kodu",
      width: "120px",
      render: (it) => <span className="font-monospace fw-bold text-primary">{it.kod || it.id}</span>,
    },
    {
      header: "Banka / Hesap Ünvanı",
      render: (it) => <span className="fw-semibold">{it.ad || it.unvan || it.bankaAdi}</span>,
    },
    {
      header: "IBAN",
      width: "230px",
      render: (it) => <span className="font-monospace small text-muted">{it.iban || "-"}</span>,
    },
    {
      header: "Hesap / Şube No",
      width: "140px",
      render: (it) => <span>{it.hesapNo || it.subeAdi || "-"}</span>,
    },
  ];

  // 2. Cari Kart Seçimi Kolonları
  const cariLookupColumns: LookupColumn<any>[] = [
    {
      header: "Cari Kodu",
      width: "120px",
      render: (it) => <span className="font-monospace fw-bold text-primary">{it.kod || it.id}</span>,
    },
    {
      header: "Cari Ünvanı / Adı",
      render: (it) => <span className="fw-semibold">{it.unvan || it.ad}</span>,
    },
    {
      header: "Telefon",
      width: "130px",
      render: (it) => <span>{it.telefon || "-"}</span>,
    },
    {
      header: "Vergi / TC No",
      width: "140px",
      render: (it) => <span>{it.vergiKimlikNo || it.tcKimlikNo || "-"}</span>,
    },
  ];

  // 3. Mevcut Banka Hareketleri Seçimi (F3 Dürbün)
  const hareketLookupColumns: LookupColumn<BankaHareketItem>[] = [
    {
      header: "#",
      width: "60px",
      render: (it) => <span className="font-monospace text-muted">{it.bankaHareketId}</span>,
    },
    {
      header: "Tarih",
      width: "100px",
      render: (it) => (
        <span className="font-monospace">
          {new Date(it.tarih).toLocaleDateString("tr-TR")}
        </span>
      ),
    },
    {
      header: "İşlem Tipi",
      width: "150px",
      render: (it) => {
        const matched = ISLEM_TIPLERI.find((t) => t.value === it.islemTipi);
        return <span className="fw-semibold">{matched?.label || it.islemTipi}</span>;
      },
    },
    {
      header: "Hesap No",
      width: "120px",
      render: (it) => <span className="font-monospace text-primary">{it.bankaHesapNo || "-"}</span>,
    },
    {
      header: "Hesap Adı",
      render: (it) => <span className="fw-semibold">{it.bankaHesapAdi || "-"}</span>,
    },
    {
      header: "Cari Adı",
      render: (it) => <span>{it.cariUnvan || "-"}</span>,
    },
    {
      header: "Meblağ",
      width: "130px",
      align: "right",
      render: (it) => (
        <span className="fw-bold font-monospace text-dark">
          {Number(it.toplamMeblag || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL
        </span>
      ),
    },
    {
      header: "Açıklama",
      render: (it) => <span className="small text-muted">{it.aciklama || "-"}</span>,
    },
  ];

  return (
    <Container fluid className="py-3 px-3 px-lg-4 banka-hareketi-page">
      {/* ─── 1. ÜST ERP AKSİYON ŞERİDİ (Banka Hesap Kartları İle Birebir Aynı) ── */}
      <ERPToolbar
        pageTitle="D- Banka Hesap Hareketleri"
        hideSearch={false}
        hideDelete={false}
        onSave={handleSave}
        onDelete={() => {
          if (hareketId) setShowDeleteConfirm(true);
          else showNotif("warning", "Silinecek bir hareket seçilmedi.");
        }}
        onNew={handleNew}
        onRefresh={loadData}
        onSearch={() => setShowHareketLookup(true)}
        onPrint={() => window.print()}
        onFirst={handleFirst}
        onPrev={handlePrev}
        onNext={handleNext}
        onLast={handleLast}
        rightContent={
          <div className="d-flex align-items-center gap-2">
            {hareketId && (
              <Badge bg="primary" className="px-2 py-1 fs-7">
                Kayıt #{hareketId}
              </Badge>
            )}
            <div className="d-flex align-items-center text-muted small bg-light px-2 py-1 rounded border font-monospace">
              <IconClock size={14} className="me-1 text-primary" />
              <span>{currentDateTime}</span>
            </div>
          </div>
        }
      />

      {notification && (
        <Alert
          variant={notification.type}
          dismissible
          onClose={() => setNotification(null)}
          className="d-flex align-items-center mb-3 shadow-sm py-2"
        >
          {notification.type === "success" ? (
            <IconCheck size={18} className="me-2 text-success" />
          ) : (
            <IconAlertTriangle size={18} className="me-2 text-danger" />
          )}
          <span>{notification.message}</span>
        </Alert>
      )}

      {/* ─── 2. HAREKET GİRİŞ FORMU (Banka Hesap Kartları UI Düzeninde) ──────── */}
      <Card className="shadow-sm border-0 mb-3">
        <Card.Header className="bg-light py-2 px-3 border-bottom d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-2">
            <IconBuildingBank size={18} className="text-primary" />
            <span className="fw-bold text-dark">Banka Hareketi Bilgileri</span>
          </div>
        </Card.Header>

        <Card.Body className="p-3">
          <Row className="gx-4 gy-2">
            {/* ─── SOL SÜTUN ──────────────────────────────────────────────── */}
            <Col lg={6} md={12}>
              {/* İşlem Tipi */}
              <Form.Group as={Row} className="mb-2 align-items-center">
                <Form.Label column sm={4} className="small fw-bold text-secondary text-sm-end text-start">
                  İşlem Tipi <span className="text-danger">*</span> :
                </Form.Label>
                <Col sm={8}>
                  <Form.Select
                    ref={islemTipiRef}
                    size="sm"
                    value={islemTipi}
                    onChange={(e) => setIslemTipi(Number(e.target.value))}
                    onKeyDown={(e) => handleInputKeyDown(e, hesapNoRef, undefined)}
                    className="fw-semibold bg-white text-dark shadow-none"
                  >
                    {ISLEM_TIPLERI.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </Form.Select>
                </Col>
              </Form.Group>

              {/* Hesap No */}
              <Form.Group as={Row} className="mb-2 align-items-center">
                <Form.Label column sm={4} className="small fw-bold text-secondary text-sm-end text-start">
                  Hesap No <span className="text-danger">*</span> :
                </Form.Label>
                <Col sm={8}>
                  <InputGroup size="sm">
                    <Form.Control
                      ref={hesapNoRef}
                      type="text"
                      size="sm"
                      value={hesapNo}
                      onChange={(e) => setHesapNo(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "F4") {
                          e.preventDefault();
                          setShowBankaLookup(true);
                        } else {
                          handleInputKeyDown(e, hesapAdiRef, islemTipiRef);
                        }
                      }}
                      className="fw-bold text-primary font-monospace shadow-none"
                    />
                    <Button
                      variant="outline-primary"
                      onClick={() => setShowBankaLookup(true)}
                      title="Banka Hesabı Seçimi (TODVZ_BANKA_HESABI) (F4)"
                    >
                      <IconBinoculars size={15} />
                    </Button>
                  </InputGroup>
                </Col>
              </Form.Group>

              {/* Hesap Adı */}
              <Form.Group as={Row} className="mb-2 align-items-center">
                <Form.Label column sm={4} className="small fw-bold text-secondary text-sm-end text-start">
                  Hesap Adı <span className="text-danger">*</span> :
                </Form.Label>
                <Col sm={8}>
                  <InputGroup size="sm">
                    <Form.Control
                      ref={hesapAdiRef}
                      type="text"
                      size="sm"
                      value={hesapAdi}
                      onChange={(e) => setHesapAdi(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "F4") {
                          e.preventDefault();
                          setShowBankaLookup(true);
                        } else {
                          handleInputKeyDown(e, cariAdiRef, hesapNoRef);
                        }
                      }}
                      className="fw-semibold shadow-none"
                    />
                    <Button
                      variant="outline-primary"
                      onClick={() => setShowBankaLookup(true)}
                      title="Banka Hesabı Seçimi (TODVZ_BANKA_HESABI) (F4)"
                    >
                      <IconBinoculars size={15} />
                    </Button>
                  </InputGroup>
                </Col>
              </Form.Group>

              {/* Cari Adı */}
              <Form.Group as={Row} className="mb-2 align-items-center">
                <Form.Label column sm={4} className="small fw-bold text-secondary text-sm-end text-start">
                  Cari Adı :
                </Form.Label>
                <Col sm={8}>
                  <InputGroup size="sm">
                    <Form.Control
                      ref={cariAdiRef}
                      type="text"
                      size="sm"
                      value={cariAdi}
                      onChange={(e) => {
                        setCariAdi(e.target.value);
                        if (!e.target.value.trim()) setCariKartId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "F4") {
                          e.preventDefault();
                          setShowCariLookup(true);
                        } else {
                          handleInputKeyDown(e, tarihRef, hesapAdiRef);
                        }
                      }}
                      className="fw-semibold shadow-none"
                    />
                    <Button
                      variant="outline-primary"
                      onClick={() => setShowCariLookup(true)}
                      title="Cari Kart Seçimi (TODVZ_CARI_KART) (F4)"
                    >
                      <IconBinoculars size={15} />
                    </Button>
                  </InputGroup>
                </Col>
              </Form.Group>
            </Col>

            {/* ─── SAĞ SÜTUN ──────────────────────────────────────────────── */}
            <Col lg={6} md={12}>
              {/* Tarih */}
              <Form.Group as={Row} className="mb-2 align-items-center">
                <Form.Label column sm={4} className="small fw-bold text-secondary text-sm-end text-start">
                  Tarih <span className="text-danger">*</span> :
                </Form.Label>
                <Col sm={8}>
                  <Form.Control
                    ref={tarihRef}
                    type="date"
                    size="sm"
                    value={tarih}
                    onChange={(e) => setTarih(e.target.value)}
                    onKeyDown={(e) => handleInputKeyDown(e, meblagRef, cariAdiRef)}
                    className="font-monospace shadow-none"
                  />
                </Col>
              </Form.Group>

              {/* Meblağ */}
              <Form.Group as={Row} className="mb-2 align-items-center">
                <Form.Label column sm={4} className="small fw-bold text-secondary text-sm-end text-start">
                  Meblağ <span className="text-danger">*</span> :
                </Form.Label>
                <Col sm={8}>
                  <InputGroup size="sm">
                    <Form.Control
                      ref={meblagRef}
                      type="number"
                      step="0.01"
                      size="sm"
                      value={meblag}
                      onChange={(e) => setMeblag(e.target.value)}
                      onKeyDown={(e) => handleInputKeyDown(e, aciklamaRef, tarihRef)}
                      className="text-end fw-bold font-monospace shadow-none"
                    />
                    <InputGroup.Text className="small">TL</InputGroup.Text>
                  </InputGroup>
                </Col>
              </Form.Group>

              {/* Açıklama */}
              <Form.Group as={Row} className="mb-2 align-items-center">
                <Form.Label column sm={4} className="small fw-bold text-secondary text-sm-end text-start">
                  Açıklama :
                </Form.Label>
                <Col sm={8}>
                  <Form.Control
                    ref={aciklamaRef}
                    type="text"
                    size="sm"
                    value={aciklama}
                    onChange={(e) => setAciklama(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSave();
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        meblagRef.current?.focus();
                      }
                    }}
                    className="shadow-none"
                  />
                </Col>
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* ─── MODALLAR ────────────────────────────────────────────────────────── */}

      {/* 1. Banka Hesabı Seçimi (DovizFisiPage ile Birebir Aynı) */}
      <LookupModal<any>
        show={showBankaLookup}
        title="Banka Hesabı Seçimi (TODVZ_BANKA_HESABI) (F4)"
        columns={bankaLookupColumns}
        items={bankaList}
        filterFn={(it, term) => {
          const t = term.toLowerCase();
          return (
            (it.kod ? it.kod.toLowerCase().includes(t) : false) ||
            (it.ad ? it.ad.toLowerCase().includes(t) : false) ||
            (it.unvan ? it.unvan.toLowerCase().includes(t) : false) ||
            (it.iban ? it.iban.toLowerCase().includes(t) : false) ||
            (it.bankaAdi ? it.bankaAdi.toLowerCase().includes(t) : false) ||
            (it.hesapNo ? it.hesapNo.toLowerCase().includes(t) : false) ||
            (it.subeAdi ? it.subeAdi.toLowerCase().includes(t) : false)
          );
        }}
        onSelect={(selected: any) => {
          setBankaId(selected.bankaId || selected.id);
          setHesapNo(selected.hesapNo || selected.kod || "");
          setHesapAdi(selected.ad || selected.unvan || selected.bankaAdi || "");
          setShowBankaLookup(false);
          cariAdiRef.current?.focus();
        }}
        onHide={() => setShowBankaLookup(false)}
      />

      {/* 2. Cari Kart Seçimi (TODVZ_CARI_KART) */}
      <LookupModal<any>
        show={showCariLookup}
        title="Cari Kart Seçimi (TODVZ_CARI_KART) (F4)"
        columns={cariLookupColumns}
        items={cariList}
        filterFn={(it, term) => {
          const t = term.toLowerCase();
          return (
            (it.kod ? it.kod.toLowerCase().includes(t) : false) ||
            (it.ad ? it.ad.toLowerCase().includes(t) : false) ||
            (it.unvan ? it.unvan.toLowerCase().includes(t) : false) ||
            (it.telefon ? it.telefon.toLowerCase().includes(t) : false)
          );
        }}
        onSelect={(selected: any) => {
          setCariKartId(selected.id || selected.cariKartId);
          setCariAdi(selected.unvan || selected.ad || "");
          setShowCariLookup(false);
          tarihRef.current?.focus();
        }}
        onHide={() => setShowCariLookup(false)}
      />

      {/* 3. Banka Hareketi Arama (F3 Dürbün - Mevcut Kayıtlar) */}
      <LookupModal<BankaHareketItem>
        show={showHareketLookup}
        title="Banka Hareketi Arama (F3)"
        columns={hareketLookupColumns}
        items={hareketList}
        filterFn={(it, term) => {
          const t = term.toLowerCase();
          return (
            (it.bankaHareketId ? String(it.bankaHareketId).includes(t) : false) ||
            (it.bankaHesapNo ? it.bankaHesapNo.toLowerCase().includes(t) : false) ||
            (it.bankaHesapAdi ? it.bankaHesapAdi.toLowerCase().includes(t) : false) ||
            (it.cariUnvan ? it.cariUnvan.toLowerCase().includes(t) : false) ||
            (it.aciklama ? it.aciklama.toLowerCase().includes(t) : false)
          );
        }}
        onSelect={(selected: BankaHareketItem) => {
          handleSelectHareket(selected);
          setShowHareketLookup(false);
        }}
        onHide={() => setShowHareketLookup(false)}
      />

      {/* 4. Silme Onay Modalı */}
      <Modal show={showDeleteConfirm} onHide={() => setShowDeleteConfirm(false)} centered size="sm">
        <Modal.Header closeButton className="py-2">
          <Modal.Title className="fs-6 fw-bold text-danger d-flex align-items-center gap-2">
            <IconAlertTriangle size={18} /> Hareketi Sil
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="py-3 text-secondary" style={{ fontSize: "13px" }}>
          Bu banka hareketini (#{hareketId}) silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
        </Modal.Body>
        <Modal.Footer className="py-2 bg-light">
          <Button variant="secondary" size="sm" onClick={() => setShowDeleteConfirm(false)}>
            Vazgeç
          </Button>
          <Button variant="danger" size="sm" onClick={handleDelete}>
            Evet, Sil
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default BankaHareketiPage;
