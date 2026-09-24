import React, { useState, useEffect, useCallback, useRef } from "react";
import { Container, Row, Col, Card, Form, Button, Badge, Alert, Modal, InputGroup } from "react-bootstrap";
import {
  IconBuildingBank,
  IconCheck,
  IconCopy,
  IconBinoculars,
  IconAlertTriangle,
  IconClock,
  IconTrash,
  IconPlus,
} from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import LookupModal, { LookupColumn } from "../../components/common/LookupModal";
import { BankaService, BankaHesapItem, SaveBankaHesapPayload, BankaLookups } from "../../services/bankaService";
import { CariService } from "../../services/cariService";
import useERPAutoFocus from "../../hooks/useERPAutoFocus";

const DEFAULT_BANKALAR = [
  { id: 102001, kod: "102.01.001", ad: "Garanti BBVA", unvan: "Garanti BBVA", bankaAdi: "Garanti BBVA", iban: "TR33 0006 2000 0001 2345 6789 01", hesapNo: "6200000-1" },
  { id: 102002, kod: "102.01.002", ad: "Akbank", unvan: "Akbank", bankaAdi: "Akbank", iban: "TR45 0004 6000 0002 3456 7890 12", hesapNo: "4600000-2" },
  { id: 102003, kod: "102.01.003", ad: "İş Bankası", unvan: "İş Bankası", bankaAdi: "İş Bankası", iban: "TR64 0006 4000 0003 4567 8901 23", hesapNo: "6400000-3" },
  { id: 102004, kod: "102.01.004", ad: "Yapı Kredi", unvan: "Yapı Kredi", bankaAdi: "Yapı Kredi", iban: "TR92 0006 7000 0004 5678 9012 34", hesapNo: "6700000-4" },
  { id: 102005, kod: "102.01.005", ad: "Ziraat Bankası", unvan: "Ziraat Bankası", bankaAdi: "Ziraat Bankası", iban: "TR10 0001 0000 0005 6789 0123 45", hesapNo: "1000000-5" },
  { id: 102006, kod: "102.01.006", ad: "VakıfBank", unvan: "VakıfBank", bankaAdi: "VakıfBank", iban: "TR15 0001 5000 0006 7890 1234 56", hesapNo: "1500000-6" },
  { id: 102007, kod: "102.01.007", ad: "QNB Finansbank", unvan: "QNB Finansbank", bankaAdi: "QNB Finansbank", iban: "TR88 0011 1000 0007 8901 2345 67", hesapNo: "1110000-7" },
  { id: 102008, kod: "102.01.008", ad: "Halkbank", unvan: "Halkbank", bankaAdi: "Halkbank", iban: "TR20 0001 2000 0008 9012 3456 78", hesapNo: "1200000-8" },
  { id: 102009, kod: "102.01.009", ad: "DenizBank", unvan: "DenizBank", bankaAdi: "DenizBank", iban: "TR55 0013 4000 0009 0123 4567 89", hesapNo: "1340000-9" },
  { id: 102010, kod: "102.01.010", ad: "Türk Ekonomi Bankası (TEB)", unvan: "Türk Ekonomi Bankası (TEB)", bankaAdi: "Türk Ekonomi Bankası (TEB)", iban: "TR40 0032 0000 0010 1234 5678 90", hesapNo: "3200000-10" },
  { id: 102011, kod: "102.01.011", ad: "Kuveyt Türk", unvan: "Kuveyt Türk", bankaAdi: "Kuveyt Türk", iban: "TR30 0020 5000 0011 1234 5678 90", hesapNo: "2050000-11" },
  { id: 102012, kod: "102.01.012", ad: "Türkiye Finans", unvan: "Türkiye Finans", bankaAdi: "Türkiye Finans", iban: "TR80 0020 6000 0012 1234 5678 90", hesapNo: "2060000-12" },
  { id: 102013, kod: "102.01.013", ad: "Albaraka Türk", unvan: "Albaraka Türk", bankaAdi: "Albaraka Türk", iban: "TR70 0020 3000 0013 1234 5678 90", hesapNo: "2030000-13" },
  { id: 102014, kod: "102.01.014", ad: "Şekerbank", unvan: "Şekerbank", bankaAdi: "Şekerbank", iban: "TR50 0005 9000 0014 1234 5678 90", hesapNo: "5900000-14" },
  { id: 102015, kod: "102.01.015", ad: "ING", unvan: "ING", bankaAdi: "ING", iban: "TR60 0009 9000 0015 1234 5678 90", hesapNo: "9900000-15" },
  { id: 102016, kod: "102.01.016", ad: "HSBC", unvan: "HSBC", bankaAdi: "HSBC", iban: "TR11 0012 3000 0016 1234 5678 90", hesapNo: "1230000-16" },
  { id: 102017, kod: "102.01.017", ad: "Odeabank", unvan: "Odeabank", bankaAdi: "Odeabank", iban: "TR22 0014 6000 0017 1234 5678 90", hesapNo: "1460000-17" },
  { id: 102018, kod: "102.01.018", ad: "Fibabanka", unvan: "Fibabanka", bankaAdi: "Fibabanka", iban: "TR33 0010 3000 0018 1234 5678 90", hesapNo: "1030000-18" },
  { id: 102019, kod: "102.01.019", ad: "Alternatif Bank", unvan: "Alternatif Bank", bankaAdi: "Alternatif Bank", iban: "TR44 0012 4000 0019 1234 5678 90", hesapNo: "1240000-19" },
  { id: 102020, kod: "102.01.020", ad: "Anadolubank", unvan: "Anadolubank", bankaAdi: "Anadolubank", iban: "TR55 0013 5000 0020 1234 5678 90", hesapNo: "1350000-20" },
];

export const BankaHesapKartiPage: React.FC = () => {
  // ─── State: Form Data (Tüm inputlar boş başlayacak) ─────────────────────────
  const [bankaId, setBankaId] = useState<number | null>(null);
  const [hesapNo, setHesapNo] = useState("");
  const [hesapAdi, setHesapAdi] = useState("");
  const [iban, setIban] = useState("");
  const [subeAdi, setSubeAdi] = useState("");
  const [bankaAdiId, setBankaAdiId] = useState<number | null>(null);
  const [bankaAdiText, setBankaAdiText] = useState("");
  const [eFaturadaGozuksun, setEFaturadaGozuksun] = useState(false);
  const [muhHesapKodlari, setMuhHesapKodlari] = useState("");
  const [devir, setDevir] = useState<number | string>("");
  const [aktif, setAktif] = useState(true);

  // ─── State: UI & Data ──────────────────────────────────────────────────────
  const [bankaList, setBankaList] = useState<BankaHesapItem[]>([]);
  const [lookups, setLookups] = useState<BankaLookups>({
    bankaAdlari: DEFAULT_BANKALAR,
    paralar: [],
    vezneler: [],
    cariler: [],
    muhHesaplar: [],
  });
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "danger" | "warning"; message: string } | null>(null);
  const [copiedIban, setCopiedIban] = useState(false);

  // Canlı Tarih & Saat
  const [currentDateTime, setCurrentDateTime] = useState<string>("");

  useERPAutoFocus({ dependencies: [bankaId] });
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
  const [showLookupModal, setShowLookupModal] = useState(false);
  const [showBankNameModal, setShowBankNameModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [lookupSearchTerm, setLookupSearchTerm] = useState<string>("");
  const [bankNameSearchTerm, setBankNameSearchTerm] = useState<string>("");

  // Form Field Refs for Keyboard Navigation (SarrafFisiPage Style)
  const hesapNoRef = useRef<HTMLInputElement | null>(null);
  const hesapAdiRef = useRef<HTMLInputElement | null>(null);
  const bankaAdiRef = useRef<HTMLInputElement | null>(null);
  const subeAdiRef = useRef<HTMLInputElement | null>(null);
  const ibanRef = useRef<HTMLInputElement | null>(null);
  const devirRef = useRef<HTMLInputElement | null>(null);

  const showNotif = (type: "success" | "danger" | "warning", msg: string) => {
    setNotification({ type, message: msg });
    setTimeout(() => setNotification(null), 4000);
  };

  // ─── Load Initial Lookups (Inputlar boş kalacak) ─────────────────────────────
  const loadLookups = useCallback(async () => {
    try {
      const [list, lks, cariLks] = await Promise.all([
        BankaService.getBankalar(),
        BankaService.getLookups(),
        CariService.getLookups().catch(() => null),
      ]);
      setBankaList(list);
      const combinedBankalar = (lks.bankaAdlari && lks.bankaAdlari.length > 0)
        ? lks.bankaAdlari
        : (cariLks?.bankaList && cariLks.bankaList.length > 0)
        ? cariLks.bankaList
        : DEFAULT_BANKALAR;
      setLookups({
        ...lks,
        bankaAdlari: combinedBankalar,
      });
    } catch (err: any) {
      showNotif("danger", err?.message || "Banka verileri yüklenemedi.");
    }
  }, []);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  // ─── Form Actions ──────────────────────────────────────────────────────────
  // En soldaki F4 Yeni butonu formu tamamen boşaltır
  const handleNew = useCallback(() => {
    setBankaId(null);
    setHesapNo("");
    setHesapAdi("");
    setIban("");
    setSubeAdi("");
    setBankaAdiId(null);
    setBankaAdiText("");
    setEFaturadaGozuksun(false);
    setMuhHesapKodlari("");
    setDevir("");
    setAktif(true);
    hesapNoRef.current?.focus();
  }, []);

  // Üstten dürbün (F3) ile seçildiğinde form doğrudan doldurulur
  const handleSelectBanka = useCallback((b: BankaHesapItem) => {
    setBankaId(b.bankaId);
    setHesapNo(b.hesapNo || "");
    setHesapAdi(b.hesapAdi || "");
    setIban(b.iban || "");
    setSubeAdi(b.subeAdi || "");
    setBankaAdiId(b.bankaAdiId || null);
    setBankaAdiText(b.bankaAdi || "");
    setEFaturadaGozuksun(Boolean(b.eFaturadaGozuksun));
    setMuhHesapKodlari(b.muhHesapKodlari || "");
    setDevir(b.devir !== undefined && b.devir !== null ? b.devir : "");
    setAktif(b.aktif !== undefined ? Boolean(b.aktif) : true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!hesapNo.trim()) {
      showNotif("warning", "Lütfen hesap numarası giriniz.");
      hesapNoRef.current?.focus();
      return;
    }
    if (!hesapAdi.trim()) {
      showNotif("warning", "Lütfen hesap adı giriniz.");
      hesapAdiRef.current?.focus();
      return;
    }

    setIsSaving(true);
    try {
      const payload: SaveBankaHesapPayload = {
        bankaId,
        hesapNo: hesapNo.trim(),
        hesapAdi: hesapAdi.trim(),
        iban: iban.trim() || null,
        subeAdi: subeAdi.trim() || null,
        bankaAdiId,
        eFaturadaGozuksun,
        muhHesapKodlari: muhHesapKodlari.trim() || null,
        devir: Number(devir) || 0,
        aktif,
      };

      const saved = await BankaService.saveBanka(payload);
      showNotif("success", `Banka hesabı ${bankaId ? "güncellendi" : "kaydedildi"}: ${saved.hesapAdi}`);
      setBankaId(saved.bankaId);
      const updatedList = await BankaService.getBankalar();
      setBankaList(updatedList);
    } catch (err: any) {
      showNotif("danger", err?.message || "Kayıt sırasında hata oluştu.");
    } finally {
      setIsSaving(false);
    }
  }, [bankaId, hesapNo, hesapAdi, iban, subeAdi, bankaAdiId, eFaturadaGozuksun, muhHesapKodlari, devir, aktif]);

  const handleDelete = useCallback(async () => {
    if (!bankaId) return;
    try {
      await BankaService.deleteBanka(bankaId);
      showNotif("success", "Banka hesabı silindi.");
      setShowDeleteConfirm(false);
      handleNew();
      const updatedList = await BankaService.getBankalar();
      setBankaList(updatedList);
    } catch (err: any) {
      showNotif("danger", err?.message || "Banka hesabı silinemedi.");
      setShowDeleteConfirm(false);
    }
  }, [bankaId, handleNew]);

  const handleCopyIban = useCallback(() => {
    if (!iban) return;
    navigator.clipboard.writeText(iban.replace(/\s+/g, ""));
    setCopiedIban(true);
    setTimeout(() => setCopiedIban(false), 2000);
  }, [iban]);

  // ─── Navigation Between Records ────────────────────────────────────────────
  const currentIndex = bankaList.findIndex((b) => b.bankaId === bankaId);
  const handleFirst = () => { if (bankaList.length) handleSelectBanka(bankaList[0]); };
  const handlePrev = () => {
    if (currentIndex > 0) handleSelectBanka(bankaList[currentIndex - 1]);
    else if (bankaList.length) handleSelectBanka(bankaList[0]);
  };
  const handleNext = () => {
    if (currentIndex >= 0 && currentIndex < bankaList.length - 1) handleSelectBanka(bankaList[currentIndex + 1]);
    else if (bankaList.length) handleSelectBanka(bankaList[bankaList.length - 1]);
  };
  const handleLast = () => { if (bankaList.length) handleSelectBanka(bankaList[bankaList.length - 1]); };

  // ─── Keyboard Navigation & Search Handlers ─────────────────────────────
  const handleHesapNoKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = hesapNo.trim().toLowerCase();
      if (!val) {
        setLookupSearchTerm("");
        setShowLookupModal(true);
        return;
      }
      const matches = bankaList.filter((b) => {
        const hn = String(b.hesapNo || "").toLowerCase();
        const ha = String(b.hesapAdi || "").toLowerCase();
        const ba = String(b.bankaAdi || "").toLowerCase();
        const ib = String(b.iban || "").toLowerCase();
        return hn.includes(val) || ha.includes(val) || ba.includes(val) || ib.includes(val);
      });
      if (matches.length === 1) {
        handleSelectBanka(matches[0]);
        hesapAdiRef.current?.focus();
      } else {
        setLookupSearchTerm(hesapNo.trim());
        setShowLookupModal(true);
      }
    } else if (e.key === "F4") {
      e.preventDefault();
      setLookupSearchTerm(hesapNo.trim());
      setShowLookupModal(true);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      hesapAdiRef.current?.focus();
    }
  };

  const handleHesapAdiKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = hesapAdi.trim().toLowerCase();
      if (!val) {
        setLookupSearchTerm("");
        setShowLookupModal(true);
        return;
      }
      const matches = bankaList.filter((b) => {
        const ha = String(b.hesapAdi || "").toLowerCase();
        const hn = String(b.hesapNo || "").toLowerCase();
        const ba = String(b.bankaAdi || "").toLowerCase();
        return ha.includes(val) || hn.includes(val) || ba.includes(val);
      });
      if (matches.length === 1) {
        handleSelectBanka(matches[0]);
        bankaAdiRef.current?.focus();
      } else {
        setLookupSearchTerm(hesapAdi.trim());
        setShowLookupModal(true);
      }
    } else if (e.key === "F4") {
      e.preventDefault();
      setLookupSearchTerm(hesapAdi.trim());
      setShowLookupModal(true);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      hesapNoRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      bankaAdiRef.current?.focus();
    }
  };

  const handleBankaAdiKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = bankaAdiText.trim().toLowerCase();
      if (!val) {
        setBankNameSearchTerm("");
        setShowBankNameModal(true);
        return;
      }
      const matches = (lookups.bankaAdlari || []).filter((b) => {
        const name = String(b.bankaAdi || b.unvan || b.ad || "").toLowerCase();
        const code = String(b.kod || b.id || "").toLowerCase();
        return name.includes(val) || code.includes(val);
      });
      if (matches.length === 1) {
        const selected = matches[0];
        setBankaAdiId(selected.id);
        const name = selected.bankaAdi || selected.unvan || selected.ad || "";
        setBankaAdiText(name);
        subeAdiRef.current?.focus();
      } else {
        setBankNameSearchTerm(bankaAdiText.trim());
        setShowBankNameModal(true);
      }
    } else if (e.key === "F4") {
      e.preventDefault();
      setBankNameSearchTerm(bankaAdiText.trim());
      setShowBankNameModal(true);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      hesapAdiRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      subeAdiRef.current?.focus();
    }
  };

  const handleInputKeyDown = (
    e: React.KeyboardEvent<any>,
    nextRef?: React.RefObject<HTMLInputElement | null>,
    prevRef?: React.RefObject<HTMLInputElement | null>
  ) => {
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      nextRef?.current?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      prevRef?.current?.focus();
    }
  };

  // ─── Lookup Columns ────────────────────────────────────────────────────────
  const bankaLookupColumns: LookupColumn<BankaHesapItem>[] = [
    { header: "Hesap No", width: "120px", render: (it) => it.hesapNo },
    { header: "Hesap Adı", width: "240px", render: (it) => it.hesapAdi },
    { header: "Banka", width: "160px", render: (it) => it.bankaAdi || "-" },
    { header: "Şube", width: "140px", render: (it) => it.subeAdi || "-" },
    { header: "IBAN", width: "220px", render: (it) => it.iban || "-" },
    {
      header: "Devir",
      width: "120px",
      align: "right",
      render: (it) => (
        <span className="fw-semibold">
          {Number(it.devir || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL
        </span>
      ),
    },
    {
      header: "Bakiye",
      width: "120px",
      align: "right",
      render: (it) => (
        <span className={`fw-semibold ${Number(it.bakiye || 0) < 0 ? "text-danger" : "text-success"}`}>
          {Number(it.bakiye || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL
        </span>
      ),
    },
  ];

  const bankNameLookupColumns: LookupColumn<any>[] = [
    {
      header: "Hesap Kodu",
      width: "120px",
      render: (it) => <span className="font-monospace fw-bold text-primary">{it.kod || it.id}</span>,
    },
    {
      header: "Banka / Cari Ünvanı",
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

  return (
    <div className="banka-hesap-karti-page w-100 pb-3" style={{ overflowX: "hidden" }}>
      {/* 1. Üst ERP Aksiyon Şeridi (F3 Dürbün ve F4 En Soldaki Butonla Yönetilir) */}
      <ERPToolbar
        pageTitle="A- Banka Hesap Kartları"
        hideSearch={false}
        hideDelete={false}
        onSave={handleSave}
        onDelete={() => {
          if (bankaId) setShowDeleteConfirm(true);
          else showNotif("warning", "Silinecek bir banka hesabı seçiniz.");
        }}
        onNew={handleNew}
        onRefresh={loadLookups}
        onSearch={() => setShowLookupModal(true)}
        onPrint={() => window.print()}
        onFirst={handleFirst}
        onPrev={handlePrev}
        onNext={handleNext}
        onLast={handleLast}
        modeText={bankaId ? `Düzenleme: #${bankaId} ${hesapAdi}` : "Yeni Kayıt Modu"}
        rightContent={
          <div className="d-flex align-items-center gap-2">
            {bankaId && (
              <Badge bg={aktif ? "success" : "secondary"} className="px-2 py-1 fs-7">
                {aktif ? "Aktif Hesap" : "Pasif Hesap"}
              </Badge>
            )}
            {/* 0 hesap kayıtlı yazısı kaldırıldı, yerine canlı Tarih & Saat eklendi */}
            <div className="d-flex align-items-center text-muted small bg-light px-2 py-1 rounded border font-monospace">
              <IconClock size={14} className="me-1 text-primary" />
              <span>{currentDateTime}</span>
            </div>
          </div>
        }
      />

      {/* 1. Bildirim Paneli: Sağ altta beliren ve 4 sn sonra kaybolan toast */}
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

      {/* 2. Kart Giriş Formu (Solda Label, Sağda Input - Masaüstü ERP Düzeni) */}
      <Card className="border shadow-sm mb-3 w-100 bg-white">
        <Card.Body className="p-3">
          <Row className="g-3">
            {/* ─── SOL SÜTUN ──────────────────────────────────────────────── */}
            <Col lg={6} md={12}>
              {/* Hesap No */}
              <Form.Group as={Row} className="mb-2 align-items-center g-2">
                <Form.Label column style={{ width: "105px", flex: "0 0 105px", maxWidth: "105px" }} className="small fw-bold text-secondary text-start text-nowrap">
                  Hesap No <span className="text-danger">*</span> :
                </Form.Label>
                <Col>
                  <div style={{ maxWidth: "260px" }}>
                    <InputGroup size="sm">
                      <Form.Control
                        ref={hesapNoRef}
                        type="text"
                        size="sm"
                        value={hesapNo}
                        onChange={(e) => setHesapNo(e.target.value)}
                        onKeyDown={handleHesapNoKeyDown}
                        className="fw-bold font-monospace shadow-none"
                      />
                      <Button
                        variant="outline-primary"
                        onClick={() => {
                          setLookupSearchTerm(hesapNo.trim());
                          setShowLookupModal(true);
                        }}
                        title="Banka Hesabı Arama (F4 / F3)"
                      >
                        <IconBinoculars size={15} />
                      </Button>
                    </InputGroup>
                  </div>
                </Col>
              </Form.Group>

              {/* Hesap Adı */}
              <Form.Group as={Row} className="mb-2 align-items-center g-2">
                <Form.Label column style={{ width: "105px", flex: "0 0 105px", maxWidth: "105px" }} className="small fw-bold text-secondary text-start text-nowrap">
                  Hesap Adı <span className="text-danger">*</span> :
                </Form.Label>
                <Col>
                  <div style={{ maxWidth: "260px" }}>
                    <InputGroup size="sm">
                      <Form.Control
                        ref={hesapAdiRef}
                        type="text"
                        size="sm"
                        value={hesapAdi}
                        onChange={(e) => setHesapAdi(e.target.value)}
                        onKeyDown={handleHesapAdiKeyDown}
                        className="fw-semibold shadow-none"
                      />
                      <Button
                        variant="outline-primary"
                        onClick={() => {
                          setLookupSearchTerm(hesapAdi.trim());
                          setShowLookupModal(true);
                        }}
                        title="Banka Hesabı Arama (F4 / F3)"
                      >
                        <IconBinoculars size={15} />
                      </Button>
                    </InputGroup>
                  </div>
                </Col>
              </Form.Group>

              {/* Banka Adı (Lookup Dürbün) */}
              <Form.Group as={Row} className="mb-2 align-items-center g-2">
                <Form.Label column style={{ width: "105px", flex: "0 0 105px", maxWidth: "105px" }} className="small fw-bold text-secondary text-start text-nowrap">
                  Banka Adı :
                </Form.Label>
                <Col>
                  <div style={{ maxWidth: "260px" }}>
                    <InputGroup size="sm">
                      <Form.Control
                        ref={bankaAdiRef}
                        type="text"
                        size="sm"
                        value={bankaAdiText}
                        onChange={(e) => {
                          setBankaAdiText(e.target.value);
                          if (!e.target.value.trim()) {
                            setBankaAdiId(null);
                          }
                        }}
                        onKeyDown={handleBankaAdiKeyDown}
                        className="fw-semibold text-dark shadow-none"
                      />
                      <Button
                        variant="outline-primary"
                        onClick={() => {
                          setBankNameSearchTerm(bankaAdiText.trim());
                          setShowBankNameModal(true);
                        }}
                        title="Banka Seçimi (TODVZ_CARI_KART) (F4)"
                      >
                        <IconBinoculars size={15} />
                      </Button>
                    </InputGroup>
                  </div>
                </Col>
              </Form.Group>

              {/* Şube Adı */}
              <Form.Group as={Row} className="mb-2 align-items-center g-2">
                <Form.Label column style={{ width: "105px", flex: "0 0 105px", maxWidth: "105px" }} className="small fw-bold text-secondary text-start text-nowrap">
                  Şube Adı :
                </Form.Label>
                <Col>
                  <div style={{ maxWidth: "260px" }}>
                    <Form.Control
                      ref={subeAdiRef}
                      type="text"
                      size="sm"
                      value={subeAdi}
                      onChange={(e) => setSubeAdi(e.target.value)}
                      onKeyDown={(e) => handleInputKeyDown(e, ibanRef, bankaAdiRef)}
                    />
                  </div>
                </Col>
              </Form.Group>
            </Col>

            {/* ─── SAĞ SÜTUN ──────────────────────────────────────────────── */}
            <Col lg={6} md={12}>
              {/* IBAN Numarası */}
              <Form.Group as={Row} className="mb-2 align-items-center g-2">
                <Form.Label column style={{ width: "105px", flex: "0 0 105px", maxWidth: "105px" }} className="small fw-bold text-secondary text-start text-nowrap">
                  IBAN No :
                </Form.Label>
                <Col>
                  <div style={{ maxWidth: "260px" }}>
                    <InputGroup size="sm">
                      <Form.Control
                        ref={ibanRef}
                        type="text"
                        size="sm"
                        value={iban}
                        onChange={(e) => setIban(e.target.value.toUpperCase())}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleSave();
                          } else if (e.key === "ArrowUp") {
                            subeAdiRef.current?.focus();
                          }
                        }}
                        className="font-monospace"
                      />
                      <Button
                        variant="outline-secondary"
                        onClick={handleCopyIban}
                        title="IBAN'ı kopyala"
                        disabled={!iban}
                      >
                        {copiedIban ? <IconCheck size={15} className="text-success" /> : <IconCopy size={15} />}
                      </Button>
                    </InputGroup>
                  </div>
                </Col>
              </Form.Group>

              {/* e-Fatura Ayarı */}
              <Form.Group as={Row} className="mb-2 align-items-center g-2">
                <Form.Label column style={{ width: "105px", flex: "0 0 105px", maxWidth: "105px" }} className="small fw-bold text-secondary text-start text-nowrap">
                  e-Faturada :
                </Form.Label>
                <Col>
                  <div style={{ maxWidth: "260px" }}>
                    <Form.Check
                      type="switch"
                      id="eFaturadaGozuksun"
                      label="e-Faturada gözüksün"
                      checked={eFaturadaGozuksun}
                      onChange={(e) => setEFaturadaGozuksun(e.target.checked)}
                      className="small fw-semibold text-secondary"
                    />
                  </div>
                </Col>
              </Form.Group>

              {/* Hesap Durumu (Aktif) */}
              <Form.Group as={Row} className="mb-2 align-items-center g-2">
                <Form.Label column style={{ width: "105px", flex: "0 0 105px", maxWidth: "105px" }} className="small fw-bold text-secondary text-start text-nowrap">
                  Hesap Durumu :
                </Form.Label>
                <Col>
                  <div style={{ maxWidth: "260px" }}>
                    <Form.Check
                      type="switch"
                      id="aktif"
                      label={aktif ? "Aktif" : "Pasif"}
                      checked={aktif}
                      onChange={(e) => setAktif(e.target.checked)}
                      className="small fw-semibold text-success"
                    />
                  </div>
                </Col>
              </Form.Group>
            </Col>

            {/* ─── ALT BLOK: Muhasebe Hesap Kodları ───────────────────────── */}
            <Col xs={12} className="mt-2">
              <div className="bg-light p-3 rounded border">
                <Form.Group as={Row} className="align-items-center">
                  <Form.Label column lg={2} sm={3} className="small fw-bold text-secondary text-sm-end text-start mb-0">
                    Muh. Kodları :
                  </Form.Label>
                  <Col lg={10} sm={9}>
                    <div className="d-flex flex-wrap gap-1 mb-2">
                      {lookups.muhHesaplar.map((m) => (
                        <Button
                          key={m.kod}
                          variant={muhHesapKodlari.includes(m.kod) ? "primary" : "outline-secondary"}
                          size="sm"
                          style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                          onClick={() => {
                            const current = muhHesapKodlari.split(";").map((s) => s.trim()).filter(Boolean);
                            if (current.includes(m.kod)) {
                              setMuhHesapKodlari(current.filter((k) => k !== m.kod).join("; "));
                            } else {
                              setMuhHesapKodlari([...current, m.kod].join("; "));
                            }
                          }}
                        >
                          {m.kod} - {m.ad}
                        </Button>
                      ))}
                    </div>
                    <Form.Control
                      type="text"
                      size="sm"
                      value={muhHesapKodlari}
                      onChange={(e) => setMuhHesapKodlari(e.target.value)}
                      className="small font-monospace"
                    />
                  </Col>
                </Form.Group>
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* ─── MODALLAR ────────────────────────────────────────────────────────── */}

      {/* Üst Dürbün Butonundan (F3) Açılan Banka Arama LookupModal */}
      <LookupModal<BankaHesapItem>
        show={showLookupModal}
        title="Banka Hesabı Seçiniz (F3)"
        initialSearchTerm={lookupSearchTerm}
        columns={bankaLookupColumns}
        items={bankaList}
        filterFn={(it, term) => {
          const t = term.toLowerCase();
          return (
            (it.hesapNo ? it.hesapNo.toLowerCase().includes(t) : false) ||
            (it.hesapAdi ? it.hesapAdi.toLowerCase().includes(t) : false) ||
            (it.iban ? it.iban.toLowerCase().includes(t) : false) ||
            (it.subeAdi ? it.subeAdi.toLowerCase().includes(t) : false) ||
            (it.bankaAdi ? it.bankaAdi.toLowerCase().includes(t) : false)
          );
        }}
        onSelect={(selected: BankaHesapItem) => {
          handleSelectBanka(selected);
          setShowLookupModal(false);
        }}
        onHide={() => setShowLookupModal(false)}
      />

      {/* Banka Seçimi LookupModal (TODVZ_CARI_KART) */}
      <LookupModal<any>
        show={showBankNameModal}
        title="Banka / Cari Seçimi (TODVZ_CARI_KART)"
        initialSearchTerm={bankNameSearchTerm}
        columns={bankNameLookupColumns}
        items={lookups.bankaAdlari}
        filterFn={(it, term) => {
          const t = term.toLowerCase();
          return (
            (it.kod ? it.kod.toLowerCase().includes(t) : false) ||
            (it.ad ? it.ad.toLowerCase().includes(t) : false) ||
            (it.unvan ? it.unvan.toLowerCase().includes(t) : false) ||
            (it.iban ? it.iban.toLowerCase().includes(t) : false) ||
            (it.bankaAdi ? it.bankaAdi.toLowerCase().includes(t) : false)
          );
        }}
        onSelect={(selected: any) => {
          setBankaAdiId(selected.id);
          const name = selected.bankaAdi || selected.unvan || selected.ad || "";
          setBankaAdiText(name);
          // İnput alanlarının içleri BOŞ kalacak (hesapNo, hesapAdi, iban, subeAdi vs. otomatik doldurulmaz)
          setShowBankNameModal(false);
          subeAdiRef.current?.focus();
        }}
        onHide={() => setShowBankNameModal(false)}
      />

      {/* Silme Onay Modalı */}
      <Modal show={showDeleteConfirm} onHide={() => setShowDeleteConfirm(false)} centered size="sm">
        <Modal.Header closeButton>
          <Modal.Title className="fs-6 fw-bold text-danger d-flex align-items-center gap-2">
            <IconAlertTriangle size={18} /> Banka Hesabını Sil
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="py-3">
          <p className="mb-0 small">
            <strong>{hesapAdi}</strong> ({hesapNo}) banka hesabı silinecektir. Devam etmek istiyor musunuz?
          </p>
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

export default BankaHesapKartiPage;
