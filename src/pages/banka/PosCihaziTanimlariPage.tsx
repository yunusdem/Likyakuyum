import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Row, Col, Card, Form, Button, Alert, Modal, InputGroup, Badge } from "react-bootstrap";
import {
  IconCheck,
  IconAlertTriangle,
  IconBinoculars,
  IconClock,
  IconCreditCard,
  IconBuildingBank,
} from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import LookupModal, { LookupColumn } from "../../components/common/LookupModal";
import {
  PosCihaziService,
  PosCihaziItem,
  SavePosCihaziPayload,
} from "../../services/posCihaziService";
import { CariService, CariKartItem } from "../../services/cariService";
import { onlyDecimal, blockNonNumericKeys } from "../../utils/numericInput";
import useERPAutoFocus from "../../hooks/useERPAutoFocus";

export const PosCihaziTanimlariPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const queryId = searchParams.get("id");

  // ─── Form State ────────────────────────────────────────────────────────────
  const [posCihaziId, setPosCihaziId] = useState<number | null>(null);
  const [cariKartId, setCariKartId] = useState<number | null>(null);
  const [cariKodu, setCariKodu] = useState<string>("");
  const [cariUnvan, setCariUnvan] = useState<string>("");
  const [kod, setKod] = useState<string>("");
  const [ad, setAd] = useState<string>("");
  const [devir, setDevir] = useState<string>("");
  const [bakiye, setBakiye] = useState<number>(0);

  // ─── Input Refs ────────────────────────────────────────────────────────────
  const cariUnvanRef = useRef<HTMLInputElement | null>(null);
  const kodRef = useRef<HTMLInputElement | null>(null);
  const adRef = useRef<HTMLInputElement | null>(null);
  const devirRef = useRef<HTMLInputElement | null>(null);

  // ─── Lists & Data ──────────────────────────────────────────────────────────
  const [posList, setPosList] = useState<PosCihaziItem[]>([]);
  const [cariList, setCariList] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "danger" | "warning"; message: string } | null>(null);

  // ─── Modals & Search ───────────────────────────────────────────────────────
  const [showPosLookup, setShowPosLookup] = useState(false);
  const [showCariLookup, setShowCariLookup] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [posInitialSearch, setPosInitialSearch] = useState<string>("");
  const [cariInitialSearch, setCariInitialSearch] = useState<string>("");

  // Canlı Saat
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

  useERPAutoFocus({ preferredSelector: "#posCihazAdi", dependencies: [queryId] });

  useEffect(() => {
    const timer = setTimeout(() => {
      adRef.current?.focus();
      adRef.current?.select();
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  const showNotif = (type: "success" | "danger" | "warning", msg: string) => {
    setNotification({ type, message: msg });
    setTimeout(() => setNotification(null), 4000);
  };

  // ─── Veri Yükleme ──────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      const [posData, cariData] = await Promise.all([
        PosCihaziService.getPosCihazlari().catch(() => []),
        CariService.getCariKartlar().catch(() => []),
      ]);
      setPosList(posData);
      setCariList(cariData);
    } catch (err: any) {
      showNotif("danger", "POS cihazları listesi yüklenemedi.");
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Query ID ile doğrudan açma
  useEffect(() => {
    if (queryId && posList.length > 0) {
      const found = posList.find((p) => p.posCihaziId === Number(queryId));
      if (found) handleSelectPos(found);
    }
  }, [queryId, posList]);

  // ─── Kayıt Seçme ───────────────────────────────────────────────────────────
  const handleSelectPos = useCallback((item: PosCihaziItem) => {
    setPosCihaziId(item.posCihaziId);
    setCariKartId(item.cariKartId || null);
    setCariKodu(item.cariKodu || "");
    setCariUnvan(item.cariUnvan || "");
    setKod(item.kod || "");
    setAd(item.ad || "");
    setDevir(item.devir !== undefined && item.devir !== null ? String(item.devir) : "");
    setBakiye(Number(item.bakiye || 0));
  }, []);

  // ─── Formu Temizle (Yeni Kayıt - F4) ───────────────────────────────────────
  const handleNew = useCallback(() => {
    setPosCihaziId(null);
    setCariKartId(null);
    setCariKodu("");
    setCariUnvan("");
    setKod("");
    setAd("");
    setDevir("");
    setBakiye(0);
    setTimeout(() => {
      adRef.current?.focus();
    }, 50);
  }, []);

  // ─── Kayıtlar Arası Gezinme ────────────────────────────────────────────────
  const currentIndex = posList.findIndex((p) => p.posCihaziId === posCihaziId);
  const handleFirst = () => { if (posList.length) handleSelectPos(posList[0]); };
  const handlePrev = () => {
    if (currentIndex > 0) handleSelectPos(posList[currentIndex - 1]);
    else if (posList.length) handleSelectPos(posList[0]);
  };
  const handleNext = () => {
    if (currentIndex >= 0 && currentIndex < posList.length - 1) handleSelectPos(posList[currentIndex + 1]);
    else if (posList.length) handleSelectPos(posList[posList.length - 1]);
  };
  const handleLast = () => { if (posList.length) handleSelectPos(posList[posList.length - 1]); };

  // ─── Kaydet / Güncelle (F1) ────────────────────────────────────────────────
  const handleSave = async () => {
    if (!ad.trim()) {
      showNotif("warning", "Lütfen POS Cihaz Adı giriniz.");
      adRef.current?.focus();
      return;
    }

    setIsSaving(true);
    try {
      const payload: SavePosCihaziPayload = {
        posCihaziId,
        cariKartId: cariKartId || null,
        kod: kod.trim(),
        ad: ad.trim(),
        devir: devir !== "" ? parseFloat(String(devir).replace(",", ".")) : 0,
      };

      await PosCihaziService.savePosCihazi(payload);

      // Kayıt işleminden sonra listeyi yenile ve formu temizleyip odakla
      await loadData();
      handleNew();
    } catch (err: any) {
      showNotif("danger", err?.message || "POS cihazı kaydedilemedi.");
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Sil (F2) ──────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!posCihaziId) return;
    try {
      await PosCihaziService.deletePosCihazi(posCihaziId);
      showNotif("success", "POS Cihazı kaydı silindi.");
      setShowDeleteConfirm(false);
      handleNew();
      const updatedList = await PosCihaziService.getPosCihazlari();
      setPosList(updatedList);
    } catch (err: any) {
      showNotif("danger", err?.message || "POS cihazı silinemedi.");
      setShowDeleteConfirm(false);
    }
  };

  // ─── Klavye Kısayolları (Global) ───────────────────────────────────────────
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F1") {
        e.preventDefault();
        handleSave();
      } else if (e.key === "F2") {
        e.preventDefault();
        if (posCihaziId) setShowDeleteConfirm(true);
      } else if (e.key === "F3") {
        e.preventDefault();
        setPosInitialSearch("");
        setShowPosLookup(true);
      } else if (e.key === "F4") {
        if (!showPosLookup && !showCariLookup) {
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

  // ─── Alan Enter & Ok Tuşu Navigasyon İşleyicileri ─────────────────────────────
  const handleKodKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      adRef.current?.focus();
      adRef.current?.select();
    }
  };

  const handleAdKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      cariUnvanRef.current?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      kodRef.current?.focus();
    }
  };

  const handleCariKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = cariUnvan.trim().toLowerCase();
      if (!val) {
        setCariInitialSearch("");
        setShowCariLookup(true);
        return;
      }
      const matches = cariList.filter((c) => {
        const u = String(c.unvan || c.ad || "").toLowerCase();
        const k = String(c.kod || c.id || "").toLowerCase();
        return u.includes(val) || k.includes(val);
      });
      if (matches.length === 1) {
        const selected = matches[0];
        setCariKartId(selected.id || selected.cariKartId);
        setCariKodu(selected.kod || "");
        setCariUnvan(selected.unvan || selected.ad || "");
        devirRef.current?.focus();
      } else {
        setCariInitialSearch(cariUnvan.trim());
        setShowCariLookup(true);
      }
    } else if (e.key === "F4") {
      e.preventDefault();
      setCariInitialSearch(cariUnvan.trim());
      setShowCariLookup(true);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      adRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      devirRef.current?.focus();
    }
  };

  // ─── Lookup Kolonları ──────────────────────────────────────────────────────
  const posLookupColumns: LookupColumn<PosCihaziItem>[] = [
    {
      header: "Cihaz Kodu",
      width: "130px",
      render: (it) => <span className="font-monospace fw-bold text-primary">{it.kod}</span>,
    },
    {
      header: "POS Cihaz Adı",
      render: (it) => <span className="fw-semibold">{it.ad}</span>,
    },
    {
      header: "Banka / Cari",
      width: "200px",
      render: (it) => <span>{it.cariUnvan || "-"}</span>,
    },
    {
      header: "Devir",
      width: "120px",
      align: "right",
      render: (it) => (
        <span className="font-monospace">
          {Number(it.devir || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL
        </span>
      ),
    },
    {
      header: "Bakiye",
      width: "130px",
      align: "right",
      render: (it) => (
        <span className={`font-monospace fw-bold ${Number(it.bakiye || 0) < 0 ? "text-danger" : "text-success"}`}>
          {Number(it.bakiye || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL
        </span>
      ),
    },
  ];

  const cariLookupColumns: LookupColumn<any>[] = [
    {
      header: "Cari Kodu",
      width: "120px",
      render: (it) => <span className="font-monospace fw-bold text-primary">{it.kod || it.id}</span>,
    },
    {
      header: "Cari Ünvanı / Banka Adı",
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

  return (
    <div className="pos-tanimlari-page w-100 pb-3" style={{ overflowX: "hidden" }}>
      {/* ─── 1. ÜST ERP AKSİYON ŞERİDİ ──────────────────────────────────────── */}
      <ERPToolbar
        pageTitle="B- POS Cihazı Tanımları"
        hideSearch={false}
        hideDelete={false}
        onSave={handleSave}
        onDelete={() => {
          if (posCihaziId) setShowDeleteConfirm(true);
          else showNotif("warning", "Silinecek bir POS cihazı seçilmedi.");
        }}
        onNew={handleNew}
        onRefresh={loadData}
        onSearch={() => {
          setPosInitialSearch("");
          setShowPosLookup(true);
        }}
        onPrint={() => window.print()}
        onFirst={handleFirst}
        onPrev={handlePrev}
        onNext={handleNext}
        onLast={handleLast}
        modeText={posCihaziId ? `Düzenleme: #${posCihaziId} (${kod})` : "Yeni Kayıt Modu"}
        rightContent={
          <div className="d-flex align-items-center gap-2">
            <div className="d-flex align-items-center text-muted small bg-light px-2 py-1 rounded border font-monospace">
              <IconClock size={14} className="me-1 text-primary" />
              <span>{currentDateTime}</span>
            </div>
          </div>
        }
      />

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
            ) : (
              <IconAlertTriangle size={18} className="me-2 text-danger flex-shrink-0" />
            )}
            <span style={{ fontSize: "13px" }}>{notification.message}</span>
          </Alert>
        </div>
      )}

      {/* ─── 2. POS TANIM FORMU ─────────────────────────────────────────────── */}
      <Card className="border shadow-sm mb-3 w-100 bg-white">
        <Card.Body className="p-3">
          <Row className="g-3">
            {/* ─── SOL SÜTUN: Cihaz Bilgileri ────────────────────────────────── */}
            <Col lg={6} md={12}>
              {/* POS Cihaz Kodu */}
              <Form.Group as={Row} className="mb-2 align-items-center g-2">
                <Form.Label column style={{ width: "115px", flex: "0 0 115px", maxWidth: "115px" }} className="small fw-bold text-secondary text-start text-nowrap">
                  Cihaz Kodu :
                </Form.Label>
                <Col>
                  <div style={{ maxWidth: "280px" }}>
                    <Form.Control
                      ref={kodRef}
                      type="text"
                      size="sm"
                      value={kod}
                      onChange={(e) => setKod(e.target.value)}
                      onKeyDown={handleKodKeyDown}
                      placeholder="Otomatik"
                      className="fw-bold font-monospace text-primary shadow-none"
                    />
                  </div>
                </Col>
              </Form.Group>

              {/* POS Cihaz Adı */}
              <Form.Group as={Row} className="mb-2 align-items-center g-2">
                <Form.Label column style={{ width: "115px", flex: "0 0 115px", maxWidth: "115px" }} className="small fw-bold text-secondary text-start text-nowrap">
                  Cihaz Adı <span className="text-danger">*</span> :
                </Form.Label>
                <Col>
                  <div style={{ maxWidth: "280px" }}>
                    <Form.Control
                      ref={adRef}
                      id="posCihazAdi"
                      autoFocus
                      type="text"
                      size="sm"
                      value={ad}
                      onChange={(e) => setAd(e.target.value)}
                      onKeyDown={handleAdKeyDown}
                      className="fw-semibold shadow-none"
                    />
                  </div>
                </Col>
              </Form.Group>

              {/* Bağlı Cari / Banka Kartı */}
              <Form.Group as={Row} className="mb-2 align-items-center g-2">
                <Form.Label column style={{ width: "115px", flex: "0 0 115px", maxWidth: "115px" }} className="small fw-bold text-secondary text-start text-nowrap">
                  Bağlı Banka/Cari :
                </Form.Label>
                <Col>
                  <div style={{ maxWidth: "280px" }}>
                    <InputGroup size="sm">
                      <Form.Control
                        ref={cariUnvanRef}
                        type="text"
                        size="sm"
                        value={cariUnvan}
                        onChange={(e) => {
                          setCariUnvan(e.target.value);
                          if (!e.target.value.trim()) setCariKartId(null);
                        }}
                        onKeyDown={handleCariKeyDown}
                        className="fw-semibold shadow-none"
                      />
                      <Button
                        variant="outline-primary"
                        onClick={() => {
                          setCariInitialSearch(cariUnvan.trim());
                          setShowCariLookup(true);
                        }}
                        title="Banka / Cari Kartı Seç (F4)"
                      >
                        <IconBinoculars size={15} />
                      </Button>
                    </InputGroup>
                  </div>
                </Col>
              </Form.Group>
            </Col>

            {/* ─── SAĞ SÜTUN: Finansal Bilgiler & Bakiye ───────────────────────── */}
            <Col lg={6} md={12}>
              {/* Devir Tutarı */}
              <Form.Group as={Row} className="mb-2 align-items-center g-2">
                <Form.Label column style={{ width: "115px", flex: "0 0 115px", maxWidth: "115px" }} className="small fw-bold text-secondary text-start text-nowrap">
                  Devir Tutarı :
                </Form.Label>
                <Col>
                  <div style={{ maxWidth: "280px" }}>
                    <InputGroup size="sm">
                      <Form.Control
                        ref={devirRef}
                        type="text"
                        inputMode="decimal"
                        data-decimal="true"
                        size="sm"
                        value={devir}
                        onChange={(e) => {
                          const val = onlyDecimal(e.target.value);
                          setDevir(val);
                          const num = val !== "" ? parseFloat(String(val).replace(",", ".")) || 0 : 0;
                          setBakiye(num);
                        }}
                        onKeyDown={(e) => {
                          blockNonNumericKeys(e, true);
                          if (e.key === "Enter") {
                            e.preventDefault();
                            // Enter'a basıldığında kaydetme yapılmaz
                          } else if (e.key === "ArrowUp") {
                            e.preventDefault();
                            cariUnvanRef.current?.focus();
                          }
                        }}
                        className="text-end fw-bold font-monospace shadow-none"
                      />
                      <InputGroup.Text className="small">TL</InputGroup.Text>
                    </InputGroup>
                  </div>
                </Col>
              </Form.Group>

              {/* Anlık POS Bakiyesi */}
              <Form.Group as={Row} className="mb-2 align-items-center g-2">
                <Form.Label column style={{ width: "115px", flex: "0 0 115px", maxWidth: "115px" }} className="small fw-bold text-secondary text-start text-nowrap">
                  Cihaz Bakiyesi :
                </Form.Label>
                <Col>
                  <div style={{ maxWidth: "280px" }}>
                    <div className="d-flex align-items-center justify-content-between p-2 rounded border bg-light">
                      <div className="d-flex align-items-center gap-1.5 text-muted small">
                        <IconCreditCard size={18} className="text-primary" />
                        <span>Anlık POS Bakiye:</span>
                      </div>
                      {(() => {
                        const numVal = devir !== "" ? (parseFloat(String(devir).replace(",", ".")) || 0) : Number(bakiye || 0);
                        return (
                          <span className={`font-monospace fw-bold fs-6 ${numVal < 0 ? "text-danger" : "text-success"}`}>
                            {Number(numVal || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </Col>
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* ─── MODALLAR ────────────────────────────────────────────────────────── */}

      {/* 1. POS Cihazı Seçimi LookupModal (F3 / F4) */}
      <LookupModal<PosCihaziItem>
        show={showPosLookup}
        title="POS Cihazı Listesi (F3 / F4)"
        initialSearchTerm={posInitialSearch}
        columns={posLookupColumns}
        items={posList}
        filterFn={(it, term) => {
          const t = term.toLowerCase();
          return (
            (it.kod ? it.kod.toLowerCase().includes(t) : false) ||
            (it.ad ? it.ad.toLowerCase().includes(t) : false) ||
            (it.cariUnvan ? it.cariUnvan.toLowerCase().includes(t) : false)
          );
        }}
        onSelect={(selected: PosCihaziItem) => {
          handleSelectPos(selected);
          setShowPosLookup(false);
        }}
        onHide={() => setShowPosLookup(false)}
      />

      {/* 2. Cari Kart Seçimi LookupModal */}
      <LookupModal<any>
        show={showCariLookup}
        title="Banka / Cari Kartı Seçimi (F4)"
        initialSearchTerm={cariInitialSearch}
        columns={cariLookupColumns}
        items={cariList}
        filterFn={(it, term) => {
          const t = term.toLowerCase();
          return (
            (it.kod ? it.kod.toLowerCase().includes(t) : false) ||
            (it.ad ? it.ad.toLowerCase().includes(t) : false) ||
            (it.unvan ? it.unvan.toLowerCase().includes(t) : false) ||
            (it.telefon ? it.telefon.toLowerCase().includes(t) : false) ||
            (it.vergiKimlikNo ? it.vergiKimlikNo.toLowerCase().includes(t) : false) ||
            (it.tcKimlikNo ? it.tcKimlikNo.toLowerCase().includes(t) : false)
          );
        }}
        onSelect={(selected: any) => {
          setCariKartId(selected.id || selected.cariKartId);
          setCariKodu(selected.kod || "");
          setCariUnvan(selected.unvan || selected.ad || "");
          setShowCariLookup(false);
          devirRef.current?.focus();
        }}
        onHide={() => setShowCariLookup(false)}
      />

      {/* 3. Silme Onay Modalı */}
      <Modal show={showDeleteConfirm} onHide={() => setShowDeleteConfirm(false)} centered size="sm">
        <Modal.Header closeButton className="py-2">
          <Modal.Title className="fs-6 fw-bold text-danger d-flex align-items-center gap-2">
            <IconAlertTriangle size={18} /> POS Cihazını Sil
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="py-3 text-secondary" style={{ fontSize: "13px" }}>
          Bu POS cihazını (<strong>{kod}</strong> - {ad}) silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
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
    </div>
  );
};

export default PosCihaziTanimlariPage;
