import React, { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Container, Row, Col, Card, Form, Button, Badge, Alert, Modal, InputGroup } from "react-bootstrap";
import {
  IconBuildingBank,
  IconCheck,
  IconBinoculars,
  IconAlertTriangle,
  IconClock,
  IconArrowUpRight,
  IconArrowDownLeft,
  IconScale,
} from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import LookupModal, { LookupColumn } from "../../components/common/LookupModal";
import {
  KasaService,
  HesapItem,
  SaveHesapPayload,
} from "../../services/kasaService";
import { IskontoService, IskontoItem } from "../../services/iskontoService";
import useERPAutoFocus from "../../hooks/useERPAutoFocus";

export const KasaHesapKayitPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isEditPage = location.pathname.includes("hesap-duzeltme");

  // ─── State: Hesap Kartı (TODVZ_HESAP) ───────────────────────────────────────
  const [hesapId, setHesapId] = useState<number | null>(null);
  const [kod, setKod] = useState("");
  const [ad, setAd] = useState("");
  const [kdvOrani, setKdvOrani] = useState<number | string>(0);
  const [iskontoId, setIskontoId] = useState<number | null>(null);
  const [aktif, setAktif] = useState(true);

  // Read-only istatistiki alanlar
  const [toplamGiris, setToplamGiris] = useState<number>(0);
  const [toplamCikis, setToplamCikis] = useState<number>(0);
  const [bakiye, setBakiye] = useState<number>(0);
  const [eklemeZamani, setEklemeZamani] = useState<string | null>(null);
  const [guncellemeZamani, setGuncellemeZamani] = useState<string | null>(null);

  // ─── State: UI & Data ────────────────────────────────────────────────────────
  const [hesapList, setHesapList] = useState<HesapItem[]>([]);
  const [iskontoList, setIskontoList] = useState<IskontoItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "danger" | "warning"; message: string } | null>(null);

  const [showHesapLookup, setShowHesapLookup] = useState(false);
  const [showIskontoLookup, setShowIskontoLookup] = useState(false);
  const [showDeleteHesapConfirm, setShowDeleteHesapConfirm] = useState(false);

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

  useERPAutoFocus({ preferredSelector: "#hesapKoduInput", dependencies: [location.pathname, hesapId] });

  const kodRef = useRef<HTMLInputElement | null>(null);
  const adRef = useRef<HTMLInputElement | null>(null);
  const kdvRef = useRef<HTMLInputElement | null>(null);

  const showNotif = (type: "success" | "danger" | "warning", msg: string) => {
    setNotification({ type, message: msg });
    setTimeout(() => setNotification(null), 4000);
  };

  // ─── Hesap Kartı Seçimi ──────────────────────────────────────────────────────
  const handleSelectHesap = useCallback((h: HesapItem) => {
    setHesapId(h.hesapId);
    setKod(h.kod || "");
    setAd(h.ad || "");
    setKdvOrani(h.kdvOrani ?? 0);
    setIskontoId(h.iskontoId ?? null);
    setAktif(h.aktif !== undefined ? Boolean(h.aktif) : true);
    setToplamGiris(h.toplamGiris || 0);
    setToplamCikis(h.toplamCikis || 0);
    setBakiye(h.bakiye || 0);
    setEklemeZamani(h.eklemeZamani || null);
    setGuncellemeZamani(h.guncellemeZamani || null);
    setTimeout(() => {
      kodRef.current?.focus();
      kodRef.current?.select();
    }, 50);
  }, []);

  // ─── Yeni Hesap Açma ─────────────────────────────────────────────────────────
  const handleNew = useCallback(() => {
    if (isEditPage) {
      navigate("/kasa/hesap-kayit");
      return;
    }
    setHesapId(null);
    setKod("");
    setAd("");
    setKdvOrani(0);
    setIskontoId(null);
    setAktif(true);
    setToplamGiris(0);
    setToplamCikis(0);
    setBakiye(0);
    setEklemeZamani(null);
    setGuncellemeZamani(null);
    setTimeout(() => {
      kodRef.current?.focus();
      kodRef.current?.select();
    }, 50);
  }, [isEditPage, navigate]);

  // ─── Veri Yükleme ────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    try {
      const [hesaplar, iskontolar] = await Promise.all([
        KasaService.getHesaplar(),
        IskontoService.getIskontolar({ aktif: true }),
      ]);
      setHesapList(hesaplar);
      setIskontoList(iskontolar);

      if (isEditPage) {
        if (hesaplar.length > 0) {
          const sonKayit = hesaplar.reduce((max, h) => (h.hesapId > max.hesapId ? h : max));
          handleSelectHesap(sonKayit);
        } else {
          handleNew();
        }
      } else {
        // A- Hesap Kayıt: Tüm input alanları boş, KDV oranı 0
        setHesapId(null);
        setKod("");
        setAd("");
        setKdvOrani(0);
        setIskontoId(null);
        setAktif(true);
        setToplamGiris(0);
        setToplamCikis(0);
        setBakiye(0);
        setEklemeZamani(null);
        setGuncellemeZamani(null);
      }

      setTimeout(() => {
        kodRef.current?.focus();
        kodRef.current?.select();
      }, 100);
    } catch (err: any) {
      showNotif("danger", err?.message || "Hesap verileri yüklenemedi.");
    }
  }, [isEditPage, handleSelectHesap, handleNew]);

  useEffect(() => {
    loadAll();
  }, [loadAll, location.pathname]);

  // ─── Kaydet Aksiyonu (F1) ────────────────────────────────────────────────────
  const handleSave = useCallback(async (): Promise<HesapItem | null> => {
    if (!kod.trim()) {
      showNotif("warning", "Lütfen hesap kodu giriniz.");
      kodRef.current?.focus();
      return null;
    }
    if (!ad.trim()) {
      showNotif("warning", "Lütfen hesap adı giriniz.");
      adRef.current?.focus();
      return null;
    }
    setIsSaving(true);
    try {
      const finalKod = kod.trim();
      const payload: SaveHesapPayload = {
        hesapId,
        kod: finalKod,
        ad: ad.trim(),
        kdvOrani: Number(kdvOrani) || 0,
        iskontoId: iskontoId && Number(iskontoId) > 0 ? Number(iskontoId) : null,
      };
      const saved = await KasaService.saveHesap(payload);
      showNotif("success", `Hesap kartı ${hesapId ? "güncellendi" : "kaydedildi"}: ${saved.ad}`);
      const updatedList = await KasaService.getHesaplar();
      setHesapList(updatedList);
      if (!isEditPage) {
        handleNew();
      } else {
        const freshlyLoaded = updatedList.find((x) => x.hesapId === saved.hesapId);
        if (freshlyLoaded) {
          handleSelectHesap(freshlyLoaded);
        }
      }
      return saved;
    } catch (err: any) {
      showNotif("danger", err?.message || "Hesap kartı kaydedilirken hata oluştu.");
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [hesapId, kod, ad, kdvOrani, iskontoId, isEditPage, handleNew, handleSelectHesap]);

  // ─── Sil Aksiyonu (F2) ──────────────────────────────────────────────────────
  const handleDelete = useCallback(async () => {
    if (!hesapId) return;
    try {
      await KasaService.deleteHesap(hesapId);
      showNotif("success", "Hesap kartı silindi.");
      setShowDeleteHesapConfirm(false);
      handleNew();
      const updatedList = await KasaService.getHesaplar();
      setHesapList(updatedList);
    } catch (err: any) {
      showNotif("danger", err?.message || "Hesap kartı silinemedi.");
      setShowDeleteHesapConfirm(false);
    }
  }, [hesapId, handleNew]);

  // ─── Kayıtlar Arası Gezinme (Düzeltme Modu) ──────────────────────────────────
  const currentIndex = hesapList.findIndex((h) => h.hesapId === hesapId);
  const handleFirst = () => { if (hesapList.length) handleSelectHesap(hesapList[0]); };
  const handlePrev = () => {
    if (currentIndex > 0) handleSelectHesap(hesapList[currentIndex - 1]);
    else if (hesapList.length) handleSelectHesap(hesapList[0]);
  };
  const handleNext = () => {
    if (currentIndex >= 0 && currentIndex < hesapList.length - 1) handleSelectHesap(hesapList[currentIndex + 1]);
    else if (hesapList.length) handleSelectHesap(hesapList[hesapList.length - 1]);
  };
  const handleLast = () => { if (hesapList.length) handleSelectHesap(hesapList[hesapList.length - 1]); };

  // Seçili İskonto Nesnesi
  const selectedIskonto = iskontoList.find((x) => x.iskontoId === iskontoId) || null;

  // ─── Lookup Kolonları ────────────────────────────────────────────────────────
  const hesapLookupColumns: LookupColumn<HesapItem>[] = [
    { header: "Hesap Kodu", width: "130px", render: (it) => <span className="font-monospace fw-bold text-primary">{it.kod}</span> },
    { header: "Hesap Adı", render: (it) => it.ad },
    { header: "KDV Oranı", width: "90px", align: "right", render: (it) => `%${Number(it.kdvOrani || 0)}` },
    {
      header: "İskonto",
      width: "140px",
      render: (it) =>
        it.iskontoTanim ? (
          <Badge bg="info-subtle" className="text-dark border font-monospace">
            {it.iskontoKodu ? `[${it.iskontoKodu}] ` : ""}{it.iskontoTanim}
          </Badge>
        ) : (
          <span className="text-muted">-</span>
        ),
    },
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

  const iskontoLookupColumns: LookupColumn<IskontoItem>[] = [
    {
      header: "İskonto Kodu",
      width: "120px",
      render: (it) => <span className="font-monospace fw-bold text-dark">{it.kod || "-"}</span>,
    },
    {
      header: "İskonto Tanımı",
      render: (it) => <span className="fw-semibold">{it.tanim}</span>,
    },
    {
      header: "Tipi",
      width: "120px",
      align: "center",
      render: (it) => {
        if (it.iskontoTipi === 1) return <Badge bg="info" className="text-dark">Yüzde (%)</Badge>;
        if (it.iskontoTipi === 2) return <Badge bg="primary">Sabit Tutar</Badge>;
        if (it.iskontoTipi === 3) return <Badge bg="warning" className="text-dark">Has Gram</Badge>;
        return <Badge bg="secondary">Serbest</Badge>;
      },
    },
    {
      header: "Değer / Oran",
      width: "120px",
      align: "right",
      render: (it) => {
        if (it.iskontoTipi === 1) return <span className="font-monospace fw-bold text-primary">%{it.oran}</span>;
        if (it.iskontoTipi === 2) return <span className="font-monospace fw-bold text-success">{it.tutar?.toLocaleString("tr-TR")} ₺</span>;
        if (it.iskontoTipi === 3) return <span className="font-monospace fw-bold text-warning">{it.hasTutar} Gr Has</span>;
        return "-";
      },
    },
    {
      header: "Min. Fiş Tutarı",
      width: "120px",
      align: "right",
      render: (it) =>
        it.minTutar ? (
          <span className="font-monospace text-muted">{it.minTutar.toLocaleString("tr-TR")} ₺</span>
        ) : (
          <span className="text-muted">-</span>
        ),
    },
  ];

  return (
    <div className="kasa-hesap-kayit-page w-100 pb-3" style={{ overflowX: "hidden" }}>
      {/* 1. Üst ERP Aksiyon Şeridi (Tek kontrol noktası) */}
      <ERPToolbar
        pageTitle={isEditPage ? "B- Hesap Düzeltme" : "A- Hesap Kayıt"}
        pageIcon={<IconBuildingBank size={20} />}
        hideSearch={!isEditPage}
        hideDelete={!isEditPage}
        hideNavigation={!isEditPage}
        disabled={isSaving}
        onSave={handleSave}
        onDelete={() => {
          if (hesapId) setShowDeleteHesapConfirm(true);
          else showNotif("warning", "Silinecek bir hesap kartı seçiniz.");
        }}
        onNew={handleNew}
        onRefresh={loadAll}
        onSearch={() => setShowHesapLookup(true)}
        onPrint={() => window.print()}
        onFirst={handleFirst}
        onPrev={handlePrev}
        onNext={handleNext}
        onLast={handleLast}
        modeText={hesapId ? `Düzenleme: #${hesapId} ${ad}` : "Yeni Kayıt Modu"}
        rightContent={
          <div className="d-flex align-items-center gap-2">
            {hesapId && (
              <Badge bg={aktif ? "success" : "secondary"} className="px-2 py-1 fs-7">
                {aktif ? "Aktif Hesap" : "Pasif Hesap"}
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

      {/* 2. Hesap Kartı Formu */}
      <Card className="border shadow-sm mb-3 w-100 bg-white">
        <Card.Body className="p-3">
          <Row>
            <Col lg={6} md={12}>
              {/* Hesap Kodu */}
              <Form.Group as={Row} className="mb-2 align-items-center g-1">
                <Form.Label column style={{ width: "105px", flex: "0 0 105px", maxWidth: "105px" }} className="small fw-bold text-secondary text-start text-nowrap">
                  Hesap Kodu <span className="text-danger">*</span> :
                </Form.Label>
                <Col>
                  <div style={{ maxWidth: "260px" }}>
                    <Form.Control
                      id="hesapKoduInput"
                      data-autofocus="true"
                      ref={kodRef}
                      type="text"
                      size="sm"
                      value={kod}
                      onChange={(e) => setKod(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          adRef.current?.focus();
                        }
                      }}
                      className="fw-bold font-monospace"
                    />
                  </div>
                </Col>
              </Form.Group>

              {/* Hesap Adı */}
              <Form.Group as={Row} className="mb-2 align-items-center g-1">
                <Form.Label column style={{ width: "105px", flex: "0 0 105px", maxWidth: "105px" }} className="small fw-bold text-secondary text-start text-nowrap">
                  Hesap Adı <span className="text-danger">*</span> :
                </Form.Label>
                <Col>
                  <div style={{ maxWidth: "260px" }}>
                    <Form.Control
                      ref={adRef}
                      type="text"
                      size="sm"
                      value={ad}
                      onChange={(e) => setAd(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          kdvRef.current?.focus();
                        }
                      }}
                      className="fw-semibold"
                    />
                  </div>
                </Col>
              </Form.Group>

              {/* KDV Oranı */}
              <Form.Group as={Row} className="mb-2 align-items-center g-1">
                <Form.Label column style={{ width: "105px", flex: "0 0 105px", maxWidth: "105px" }} className="small fw-bold text-secondary text-start text-nowrap">
                  KDV Oranı (%) :
                </Form.Label>
                <Col>
                  <div style={{ maxWidth: "80px" }}>
                    <Form.Control
                      ref={kdvRef}
                      type="number"
                      size="sm"
                      value={kdvOrani}
                      onChange={(e) => setKdvOrani(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          setShowIskontoLookup(true);
                        }
                      }}
                      className="font-monospace text-end"
                    />
                  </div>
                </Col>
              </Form.Group>

              {/* İskonto Seçimi (Dürbünlü) */}
              <Form.Group as={Row} className="mb-2 align-items-center g-1">
                <Form.Label column style={{ width: "105px", flex: "0 0 105px", maxWidth: "105px" }} className="small fw-bold text-secondary text-start text-nowrap">
                  İskonto :
                </Form.Label>
                <Col>
                  <div style={{ maxWidth: "160px" }}>
                    <InputGroup size="sm">
                      <Form.Control
                        readOnly
                        value={
                          selectedIskonto
                            ? `${selectedIskonto.kod ? `[${selectedIskonto.kod}] ` : ""}${selectedIskonto.tanim}`
                            : ""
                        }
                        onClick={() => setShowIskontoLookup(true)}
                        style={{
                          fontSize: "12px",
                          cursor: "pointer",
                          backgroundColor: "#fff",
                          fontWeight: selectedIskonto ? 600 : "normal",
                        }}
                        title="İskonto Seçmek İçin Tıklayın (Dürbün)"
                      />
                      <Button
                        variant="outline-secondary"
                        className="px-2 py-0 d-flex align-items-center"
                        onClick={() => setShowIskontoLookup(true)}
                        title="İskonto Seç (Dürbün)"
                      >
                        <IconBinoculars size={14} />
                      </Button>
                    </InputGroup>
                  </div>
                </Col>
              </Form.Group>

              {/* Hesap Durumu */}
              <Form.Group as={Row} className="mb-2 align-items-center g-1">
                <Form.Label column style={{ width: "105px", flex: "0 0 105px", maxWidth: "105px" }} className="small fw-bold text-secondary text-start text-nowrap">
                  Hesap Durumu :
                </Form.Label>
                <Col>
                  <div style={{ maxWidth: "260px" }} className="ps-1">
                    <Form.Check
                      type="switch"
                      id="hesapAktif"
                      label={aktif ? "Aktif" : "Pasif"}
                      checked={aktif}
                      onChange={(e) => setAktif(e.target.checked)}
                      className="small fw-semibold text-success ms-1"
                    />
                  </div>
                </Col>
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* ─── MODALLAR ────────────────────────────────────────────────────────── */}

      {/* Hesap Lookup Modalı (F3) */}
      <LookupModal<HesapItem>
        show={showHesapLookup}
        title="Hesap Kartı Seçiniz"
        columns={hesapLookupColumns}
        items={hesapList}
        filterFn={(it, term) => {
          const t = term.toLowerCase();
          return (
            (it.kod ? it.kod.toLowerCase().includes(t) : false) ||
            (it.ad ? it.ad.toLowerCase().includes(t) : false) ||
            (it.iskontoTanim ? it.iskontoTanim.toLowerCase().includes(t) : false)
          );
        }}
        onSelect={(selected) => {
          handleSelectHesap(selected);
          setShowHesapLookup(false);
        }}
        onHide={() => setShowHesapLookup(false)}
      />

      {/* İskonto Lookup Modalı */}
      <LookupModal<IskontoItem>
        show={showIskontoLookup}
        title="Hesaba Bağlanacak İskonto Tanımını Seçiniz"
        columns={iskontoLookupColumns}
        items={iskontoList}
        filterFn={(it, term) => {
          const t = term.toLowerCase();
          return (
            (it.kod ? it.kod.toLowerCase().includes(t) : false) ||
            (it.tanim ? it.tanim.toLowerCase().includes(t) : false) ||
            (it.aciklama ? it.aciklama.toLowerCase().includes(t) : false)
          );
        }}
        onSelect={(selected) => {
          setIskontoId(selected.iskontoId);
          setShowIskontoLookup(false);
        }}
        onHide={() => setShowIskontoLookup(false)}
      />

      {/* Silme Onay Modalı */}
      <Modal show={showDeleteHesapConfirm} onHide={() => setShowDeleteHesapConfirm(false)} centered size="sm">
        <Modal.Header closeButton>
          <Modal.Title className="fs-6 fw-bold text-danger d-flex align-items-center gap-2">
            <IconAlertTriangle size={18} /> Hesap Kartını Sil
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="py-3">
          <p className="mb-0 small">
            <strong>{ad}</strong> ({kod}) hesap kartı silinecektir. Devam etmek istiyor musunuz?
          </p>
        </Modal.Body>
        <Modal.Footer className="py-2">
          <Button variant="secondary" size="sm" onClick={() => setShowDeleteHesapConfirm(false)}>
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

export default KasaHesapKayitPage;
