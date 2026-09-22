import React, { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import {
  Container,
  Row,
  Col,
  Card,
  Form,
  Button,
  Badge,
  Alert,
  Modal,
  ButtonGroup,
} from "react-bootstrap";
import {
  IconPercentage,
  IconCheck,
  IconAlertTriangle,
  IconClock,
  IconScale,
  IconCurrencyLira,
} from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import CodeLookupInput from "../../components/common/CodeLookupInput";
import LookupModal, { LookupColumn } from "../../components/common/LookupModal";
import {
  IskontoService,
  IskontoItem,
  SaveIskontoPayload,
} from "../../services/iskontoService";
import useERPAutoFocus from "../../hooks/useERPAutoFocus";

export const IskontoDefinitionsPage: React.FC = () => {
  const location = useLocation();

  // ─── State: İskonto Kartı (TODVZ_ISKONTO) ──────────────────────────────────
  const [iskontoId, setIskontoId] = useState<number | null>(null);
  const [kod, setKod] = useState("");
  const [tanim, setTanim] = useState("");
  const [iskontoTipi, setIskontoTipi] = useState<number>(1); // 1: Yüzde (%), 2: Sabit Tutar (TL), 3: Has Gram, 0: Serbest
  const [oran, setOran] = useState<string | number>("");
  const [tutar, setTutar] = useState<string | number>("");
  const [hasTutar, setHasTutar] = useState<string | number>("");
  const [minTutar, setMinTutar] = useState<string | number>("");
  const [maxIskontoTutari, setMaxIskontoTutari] = useState<string | number>("");
  const [aktif, setAktif] = useState(true);
  const [aciklama, setAciklama] = useState("");

  const [eklemeZamani, setEklemeZamani] = useState<string | null>(null);
  const [guncellemeZamani, setGuncellemeZamani] = useState<string | null>(null);

  // ─── State: UI & Data ──────────────────────────────────────────────────────
  const [iskontoList, setIskontoList] = useState<IskontoItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "danger" | "warning";
    message: string;
  } | null>(null);

  const [showLookup, setShowLookup] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Canlı Saat / Tarih
  const [currentDateTime, setCurrentDateTime] = useState<string>("");
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentDateTime(
        now.toLocaleDateString("tr-TR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }) +
        " " +
        now.toLocaleTimeString("tr-TR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useERPAutoFocus({
    preferredSelector: "#iskontoTanimInput",
    dependencies: [location.pathname, iskontoId],
  });

  const tanimRef = useRef<HTMLInputElement | null>(null);
  const oranRef = useRef<HTMLInputElement | null>(null);
  const tutarRef = useRef<HTMLInputElement | null>(null);
  const hasTutarRef = useRef<HTMLInputElement | null>(null);
  const minTutarRef = useRef<HTMLInputElement | null>(null);
  const maxTutarRef = useRef<HTMLInputElement | null>(null);
  const aciklamaRef = useRef<HTMLInputElement | null>(null);

  const showNotif = (type: "success" | "danger" | "warning", msg: string) => {
    setNotification({ type, message: msg });
    setTimeout(() => setNotification(null), 4000);
  };

  // ─── Otomatik Kod Üretimi (Çakışmasız, Sıralı) ─────────────────────────────
  const generateNextKod = useCallback((list: IskontoItem[]) => {
    if (!list || list.length === 0) return "ISK001";
    const existingCodes = new Set<string>();
    let maxNum = 0;
    list.forEach((item) => {
      const trimmed = (item.kod || "").trim().toUpperCase();
      if (trimmed) existingCodes.add(trimmed);
      const match = trimmed.match(/^ISK(\d+)$/);
      if (match) {
        const n = parseInt(match[1], 10);
        if (!isNaN(n) && n > maxNum) maxNum = n;
      }
    });
    let candidateNum = Math.max(maxNum + 1, list.length + 1);
    let candidateCode = `ISK${String(candidateNum).padStart(3, "0")}`;
    while (existingCodes.has(candidateCode)) {
      candidateNum++;
      candidateCode = `ISK${String(candidateNum).padStart(3, "0")}`;
    }
    return candidateCode;
  }, []);

  // ─── Kart Seçimi ────────────────────────────────────────────────────────────
  const handleSelectIskonto = useCallback((item?: IskontoItem | null) => {
    if (!item) return;
    setIskontoId(item.iskontoId || null);
    setKod(item.kod || "");
    setTanim(item.tanim || "");
    setIskontoTipi(
      item.iskontoTipi !== undefined && item.iskontoTipi !== null
        ? Number(item.iskontoTipi)
        : 1
    );
    setOran(item.oran !== undefined && item.oran !== null ? item.oran : "");
    setTutar(item.tutar !== undefined && item.tutar !== null ? item.tutar : "");
    setHasTutar(
      item.hasTutar !== undefined && item.hasTutar !== null ? item.hasTutar : ""
    );
    setMinTutar(
      item.minTutar !== undefined && item.minTutar !== null ? item.minTutar : ""
    );
    setMaxIskontoTutari(
      item.maxIskontoTutari !== undefined && item.maxIskontoTutari !== null
        ? item.maxIskontoTutari
        : ""
    );
    setAktif(item.aktif !== undefined ? Boolean(item.aktif) : true);
    setAciklama(item.aciklama || "");
    setEklemeZamani(item.eklemeZamani || null);
    setGuncellemeZamani(item.guncellemeZamani || null);

    setTimeout(() => {
      tanimRef.current?.focus();
      tanimRef.current?.select();
    }, 50);
  }, []);

  // ─── Yeni Kayıt Açma ───────────────────────────────────────────────────────
  const handleNew = useCallback(() => {
    setIskontoId(null);
    setKod(generateNextKod(iskontoList));
    setTanim("");
    setIskontoTipi(1);
    setOran("");
    setTutar("");
    setHasTutar("");
    setMinTutar("");
    setMaxIskontoTutari("");
    setAktif(true);
    setAciklama("");
    setEklemeZamani(null);
    setGuncellemeZamani(null);

    setTimeout(() => {
      tanimRef.current?.focus();
    }, 50);
  }, [iskontoList, generateNextKod]);

  // ─── Veri Yükleme ──────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    try {
      const items = await IskontoService.getIskontolar();
      const safeItems = Array.isArray(items)
        ? [...items].sort((a, b) => (a.iskontoId || 0) - (b.iskontoId || 0))
        : [];
      setIskontoList(safeItems);

      if (safeItems.length > 0 && iskontoId === null) {
        setKod(generateNextKod(safeItems));
      }

      setTimeout(() => {
        tanimRef.current?.focus();
      }, 100);
    } catch (err: any) {
      showNotif("danger", err?.message || "İskonto verileri yüklenemedi.");
    }
  }, [iskontoId, generateNextKod]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ─── Kaydet Aksiyonu (F1) ──────────────────────────────────────────────────
  const handleSave = useCallback(async (): Promise<IskontoItem | null> => {
    if (!tanim || !tanim.trim()) {
      showNotif("warning", "Lütfen iskonto tanımı giriniz.");
      tanimRef.current?.focus();
      return null;
    }

    setIsSaving(true);
    try {
      const effectiveKod = kod.trim() || generateNextKod(iskontoList);
      const payload: SaveIskontoPayload = {
        iskontoId,
        kod: effectiveKod,
        tanim: tanim.trim(),
        iskontoTipi: Number(iskontoTipi),
        oran: iskontoTipi === 1 && oran !== "" ? Number(oran) : undefined,
        tutar: iskontoTipi === 2 && tutar !== "" ? Number(tutar) : undefined,
        hasTutar:
          iskontoTipi === 3 && hasTutar !== "" ? Number(hasTutar) : undefined,
        minTutar: minTutar !== "" ? Number(minTutar) : undefined,
        maxIskontoTutari:
          maxIskontoTutari !== "" ? Number(maxIskontoTutari) : undefined,
        aktif,
        aciklama: aciklama.trim() || undefined,
      };

      const saved = await IskontoService.saveIskonto(payload);
      const savedName = saved?.tanim || tanim.trim();
      showNotif(
        "success",
        `İskonto tanımı ${iskontoId ? "güncellendi" : "kaydedildi"}: "${savedName}"`
      );

      const updatedList = await IskontoService.getIskontolar();
      const safeList = Array.isArray(updatedList)
        ? [...updatedList].sort((a, b) => (a.iskontoId || 0) - (b.iskontoId || 0))
        : [];
      setIskontoList(safeList);

      if (saved?.iskontoId) {
        const freshlyLoaded = safeList.find(
          (x) => x && x.iskontoId === saved.iskontoId
        );
        if (freshlyLoaded) {
          handleSelectIskonto(freshlyLoaded);
        } else {
          handleNew();
        }
      } else {
        handleNew();
      }

      return saved || null;
    } catch (err: any) {
      showNotif(
        "danger",
        err?.message || "İskonto tanımı kaydedilirken bir hata oluştu."
      );
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [
    iskontoId,
    kod,
    tanim,
    iskontoTipi,
    oran,
    tutar,
    hasTutar,
    minTutar,
    maxIskontoTutari,
    aktif,
    aciklama,
    iskontoList,
    generateNextKod,
    handleNew,
    handleSelectIskonto,
  ]);

  // ─── Sil Aksiyonu (F2) ────────────────────────────────────────────────────
  const handleDelete = useCallback(async () => {
    if (!iskontoId) return;
    try {
      await IskontoService.deleteIskonto(iskontoId, true);
      showNotif("success", "İskonto tanımı başarıyla silindi.");
      setShowDeleteConfirm(false);
      handleNew();
      const updatedList = await IskontoService.getIskontolar();
      const safeList = Array.isArray(updatedList)
        ? [...updatedList].sort((a, b) => (a.iskontoId || 0) - (b.iskontoId || 0))
        : [];
      setIskontoList(safeList);
    } catch (err: any) {
      showNotif("danger", err?.message || "İskonto tanımı silinemedi.");
      setShowDeleteConfirm(false);
    }
  }, [iskontoId, handleNew]);

  // ─── Kayıtlar Arası Gezinme ────────────────────────────────────────────────
  const currentIndex = iskontoList.findIndex(
    (item) => item && item.iskontoId === iskontoId
  );
  const handleFirst = () => {
    if (iskontoList.length > 0 && iskontoList[0]) handleSelectIskonto(iskontoList[0]);
  };
  const handlePrev = () => {
    if (currentIndex > 0 && iskontoList[currentIndex - 1])
      handleSelectIskonto(iskontoList[currentIndex - 1]);
    else if (iskontoList.length > 0 && iskontoList[0])
      handleSelectIskonto(iskontoList[0]);
  };
  const handleNext = () => {
    if (currentIndex >= 0 && currentIndex < iskontoList.length - 1 && iskontoList[currentIndex + 1])
      handleSelectIskonto(iskontoList[currentIndex + 1]);
    else if (iskontoList.length > 0 && iskontoList[iskontoList.length - 1])
      handleSelectIskonto(iskontoList[iskontoList.length - 1]);
  };
  const handleLast = () => {
    if (iskontoList.length > 0 && iskontoList[iskontoList.length - 1])
      handleSelectIskonto(iskontoList[iskontoList.length - 1]);
  };

  // ─── İskonto Tipi Etiketi ──────────────────────────────────────────────────
  const renderIskontoTipiBadge = (tip?: number | null) => {
    switch (tip) {
      case 1:
        return (
          <Badge bg="primary" className="fw-semibold">
            Yüzde (%)
          </Badge>
        );
      case 2:
        return (
          <Badge bg="success" className="fw-semibold">
            Sabit Tutar (TL)
          </Badge>
        );
      case 3:
        return (
          <Badge bg="warning" text="dark" className="fw-semibold">
            Altın / Has (gr)
          </Badge>
        );
      default:
        return (
          <Badge bg="secondary" className="fw-semibold">
            Serbest / İsim
          </Badge>
        );
    }
  };

  // ─── Lookup Kolonları (F3 Arama Modalı) ─────────────────────────────────────
  const lookupColumns: LookupColumn<IskontoItem>[] = [
    {
      header: "Kod",
      width: "100px",
      render: (it) => (
        <span className="font-monospace fw-bold text-primary">
          {it.kod || "-"}
        </span>
      ),
    },
    {
      header: "İskonto Tanımı",
      render: (it) => <span className="fw-semibold">{it.tanim}</span>,
    },
    {
      header: "İskonto Tipi",
      width: "130px",
      render: (it) => renderIskontoTipiBadge(it.iskontoTipi),
    },
    {
      header: "Değer",
      width: "120px",
      align: "right",
      render: (it) => {
        if (it.iskontoTipi === 1)
          return <span className="fw-bold text-primary">%{it.oran}</span>;
        if (it.iskontoTipi === 2)
          return (
            <span className="fw-bold text-success font-monospace">
              {Number(it.tutar || 0).toLocaleString("tr-TR", {
                minimumFractionDigits: 2,
              })}{" "}
              TL
            </span>
          );
        if (it.iskontoTipi === 3)
          return (
            <span className="fw-bold text-warning font-monospace">
              {Number(it.hasTutar || 0).toFixed(3)} gr Has
            </span>
          );
        return <span className="text-muted small">Serbest</span>;
      },
    },
    {
      header: "Durum",
      width: "90px",
      align: "center",
      render: (it) => (
        <Badge bg={it.aktif ? "success" : "secondary"}>
          {it.aktif ? "Aktif" : "Pasif"}
        </Badge>
      ),
    },
  ];

  return (
    <div
      className="iskonto-tanimlari-page w-100 pb-3"
      style={{ overflowX: "hidden" }}
    >
      {/* 1. Üst ERP Aksiyon Şeridi */}
      <ERPToolbar
        pageTitle="H- İskonto Tanımları"
        pageIcon={<IconPercentage size={20} />}
        disabled={isSaving}
        onSave={handleSave}
        onDelete={() => {
          if (iskontoId) setShowDeleteConfirm(true);
          else showNotif("warning", "Silinecek bir iskonto tanımı seçiniz.");
        }}
        onNew={handleNew}
        onRefresh={loadAll}
        onSearch={() => setShowLookup(true)}
        onPrint={() => window.print()}
        onFirst={handleFirst}
        onPrev={handlePrev}
        onNext={handleNext}
        onLast={handleLast}
        modeText={
          iskontoId ? `Düzenleme: #${iskontoId} ${tanim}` : "Yeni Kayıt Modu"
        }
        rightContent={
          <div className="d-flex align-items-center gap-2">
            {iskontoId && (
              <Badge
                bg={aktif ? "success" : "secondary"}
                className="px-2 py-1 fs-7"
              >
                {aktif ? "Aktif İskonto" : "Pasif İskonto"}
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
              <IconAlertTriangle
                size={18}
                className="me-2 text-danger flex-shrink-0"
              />
            )}
            <span style={{ fontSize: "13px" }}>{notification.message}</span>
          </Alert>
        </div>
      )}

      {/* 2. İskonto Kartı Formu (Tam Sayfa Dış Kenarlık) */}
      <Card className="border shadow-sm mb-3 w-100 bg-white">
        <Card.Body className="p-3">
          <Row>
            <Col lg={7} md={12}>
              {/* İskonto Kodu - Dürbünlü Kod/Kayıt Seçici */}
              <Form.Group as={Row} className="mb-1.5 align-items-center g-1">
                <Form.Label
                  column
                  style={{ width: "135px", flex: "0 0 135px", maxWidth: "135px" }}
                  className="small fw-bold text-secondary text-start text-nowrap"
                >
                  İskonto Kodu :
                </Form.Label>
                <Col>
                  <div style={{ maxWidth: "250px" }}>
                    <CodeLookupInput
                      id="iskontoKoduInput"
                      size="sm"
                      value={kod}
                      onChange={(e) => setKod(e.target.value.toUpperCase())}
                      onLookupClick={() => setShowLookup(true)}
                      lookupTitle="Tanımlı İskontolardan Seç (Dürbün)"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          tanimRef.current?.focus();
                        }
                      }}
                      className="fw-bold font-monospace"
                    />
                  </div>
                </Col>
              </Form.Group>

              {/* İskonto Tanımı */}
              <Form.Group as={Row} className="mb-1.5 align-items-center g-1">
                <Form.Label
                  column
                  style={{ width: "135px", flex: "0 0 135px", maxWidth: "135px" }}
                  className="small fw-bold text-secondary text-start text-nowrap"
                >
                  İskonto Tanımı <span className="text-danger">*</span> :
                </Form.Label>
                <Col>
                  <div style={{ maxWidth: "360px" }}>
                    <Form.Control
                      id="iskontoTanimInput"
                      data-autofocus="true"
                      autoFocus
                      ref={tanimRef}
                      type="text"
                      size="sm"
                      value={tanim}
                      onChange={(e) => setTanim(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (iskontoTipi === 1) oranRef.current?.focus();
                          else if (iskontoTipi === 2) tutarRef.current?.focus();
                          else if (iskontoTipi === 3) hasTutarRef.current?.focus();
                          else minTutarRef.current?.focus();
                        }
                      }}
                      className="fw-semibold"
                    />
                  </div>
                </Col>
              </Form.Group>

              {/* İskonto Tipi - ButtonGroup */}
              <Form.Group as={Row} className="mb-1.5 align-items-center g-1">
                <Form.Label
                  column
                  style={{ width: "135px", flex: "0 0 135px", maxWidth: "135px" }}
                  className="small fw-bold text-secondary text-start text-nowrap"
                >
                  İskonto Tipi :
                </Form.Label>
                <Col>
                  <ButtonGroup size="sm" className="w-auto">
                    <Button
                      variant={iskontoTipi === 1 ? "primary" : "outline-secondary"}
                      onClick={() => {
                        setIskontoTipi(1);
                        setTimeout(() => oranRef.current?.focus(), 50);
                      }}
                      className="px-2.5 py-1 fw-semibold small"
                    >
                      <IconPercentage size={15} className="me-1" /> % Yüzde
                    </Button>
                    <Button
                      variant={iskontoTipi === 2 ? "primary" : "outline-secondary"}
                      onClick={() => {
                        setIskontoTipi(2);
                        setTimeout(() => tutarRef.current?.focus(), 50);
                      }}
                      className="px-2.5 py-1 fw-semibold small"
                    >
                      <IconCurrencyLira size={15} className="me-1" /> Sabit Tutar (TL)
                    </Button>
                    <Button
                      variant={iskontoTipi === 3 ? "primary" : "outline-secondary"}
                      onClick={() => {
                        setIskontoTipi(3);
                        setTimeout(() => hasTutarRef.current?.focus(), 50);
                      }}
                      className="px-2.5 py-1 fw-semibold small"
                    >
                      <IconScale size={15} className="me-1" /> Has Gram (gr)
                    </Button>
                    <Button
                      variant={iskontoTipi === 0 ? "primary" : "outline-secondary"}
                      onClick={() => {
                        setIskontoTipi(0);
                        setTimeout(() => minTutarRef.current?.focus(), 50);
                      }}
                      className="px-2.5 py-1 fw-semibold small"
                    >
                      Serbest
                    </Button>
                  </ButtonGroup>
                </Col>
              </Form.Group>

              {/* Tipe Bağlı İskonto Değerleri */}
              {iskontoTipi === 1 && (
                <Form.Group as={Row} className="mb-1.5 align-items-center g-1">
                  <Form.Label
                    column
                    style={{ width: "135px", flex: "0 0 135px", maxWidth: "135px" }}
                    className="small fw-bold text-secondary text-start text-nowrap"
                  >
                    Yüzde Oranı (%) <span className="text-danger">*</span> :
                  </Form.Label>
                  <Col>
                    <div style={{ maxWidth: "120px" }}>
                      <Form.Control
                        ref={oranRef}
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        size="sm"
                        value={oran}
                        onChange={(e) => setOran(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            minTutarRef.current?.focus();
                          }
                        }}
                        className="font-monospace text-end fw-bold"
                      />
                    </div>
                  </Col>
                </Form.Group>
              )}

              {iskontoTipi === 2 && (
                <Form.Group as={Row} className="mb-1.5 align-items-center g-1">
                  <Form.Label
                    column
                    style={{ width: "135px", flex: "0 0 135px", maxWidth: "135px" }}
                    className="small fw-bold text-secondary text-start text-nowrap"
                  >
                    Sabit Tutar (TL) <span className="text-danger">*</span> :
                  </Form.Label>
                  <Col>
                    <div style={{ maxWidth: "150px" }}>
                      <Form.Control
                        ref={tutarRef}
                        type="number"
                        step="0.01"
                        min="0"
                        size="sm"
                        value={tutar}
                        onChange={(e) => setTutar(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            minTutarRef.current?.focus();
                          }
                        }}
                        className="font-monospace text-end fw-bold"
                      />
                    </div>
                  </Col>
                </Form.Group>
              )}

              {iskontoTipi === 3 && (
                <Form.Group as={Row} className="mb-1.5 align-items-center g-1">
                  <Form.Label
                    column
                    style={{ width: "135px", flex: "0 0 135px", maxWidth: "135px" }}
                    className="small fw-bold text-secondary text-start text-nowrap"
                  >
                    Has Altın (gr) <span className="text-danger">*</span> :
                  </Form.Label>
                  <Col>
                    <div style={{ maxWidth: "150px" }}>
                      <Form.Control
                        ref={hasTutarRef}
                        type="number"
                        step="0.001"
                        min="0"
                        size="sm"
                        value={hasTutar}
                        onChange={(e) => setHasTutar(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            minTutarRef.current?.focus();
                          }
                        }}
                        className="font-monospace text-end fw-bold"
                      />
                    </div>
                  </Col>
                </Form.Group>
              )}

              {/* Satış Alt Limiti (Min Tutar) */}
              <Form.Group as={Row} className="mb-1.5 align-items-center g-1">
                <Form.Label
                  column
                  style={{ width: "135px", flex: "0 0 135px", maxWidth: "135px" }}
                  className="small fw-bold text-secondary text-start text-nowrap"
                >
                  Min. Satış Tutarı :
                </Form.Label>
                <Col>
                  <div style={{ maxWidth: "150px" }}>
                    <Form.Control
                      ref={minTutarRef}
                      type="number"
                      step="0.01"
                      min="0"
                      size="sm"
                      value={minTutar}
                      onChange={(e) => setMinTutar(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          maxTutarRef.current?.focus();
                        }
                      }}
                      className="font-monospace text-end"
                    />
                  </div>
                </Col>
              </Form.Group>

              {/* Tavan İskonto Tutarı (Max Tutar) */}
              <Form.Group as={Row} className="mb-1.5 align-items-center g-1">
                <Form.Label
                  column
                  style={{ width: "135px", flex: "0 0 135px", maxWidth: "135px" }}
                  className="small fw-bold text-secondary text-start text-nowrap"
                >
                  Max Tutar (Tavan) :
                </Form.Label>
                <Col>
                  <div style={{ maxWidth: "150px" }}>
                    <Form.Control
                      ref={maxTutarRef}
                      type="number"
                      step="0.01"
                      min="0"
                      size="sm"
                      value={maxIskontoTutari}
                      onChange={(e) => setMaxIskontoTutari(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          aciklamaRef.current?.focus();
                        }
                      }}
                      className="font-monospace text-end"
                    />
                  </div>
                </Col>
              </Form.Group>

              {/* Açıklama */}
              <Form.Group as={Row} className="mb-1.5 align-items-center g-1">
                <Form.Label
                  column
                  style={{ width: "135px", flex: "0 0 135px", maxWidth: "135px" }}
                  className="small fw-bold text-secondary text-start text-nowrap"
                >
                  Açıklama :
                </Form.Label>
                <Col>
                  <div style={{ maxWidth: "360px" }}>
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
                        }
                      }}
                    />
                  </div>
                </Col>
              </Form.Group>

              {/* Durum (Aktif / Pasif) */}
              <Form.Group as={Row} className="mb-1.5 align-items-center g-1">
                <Form.Label
                  column
                  style={{ width: "135px", flex: "0 0 135px", maxWidth: "135px" }}
                  className="small fw-bold text-secondary text-start text-nowrap"
                >
                  İskonto Durumu :
                </Form.Label>
                <Col>
                  <div style={{ maxWidth: "240px" }}>
                    <Form.Check
                      type="switch"
                      id="iskontoAktifSwitch"
                      label={aktif ? "Aktif" : "Pasif"}
                      checked={aktif}
                      onChange={(e) => setAktif(e.target.checked)}
                      className="small fw-semibold text-success"
                    />
                  </div>
                </Col>
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* ─── MODALLAR ────────────────────────────────────────────────────────── */}

      {/* İskonto Lookup Modalı (F3) */}
      <LookupModal<IskontoItem>
        show={showLookup}
        title="İskonto Tanımı Seçiniz"
        columns={lookupColumns}
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
          handleSelectIskonto(selected);
          setShowLookup(false);
        }}
        onHide={() => setShowLookup(false)}
      />

      {/* Silme Onay Modalı */}
      <Modal
        show={showDeleteConfirm}
        onHide={() => setShowDeleteConfirm(false)}
        centered
        size="sm"
      >
        <Modal.Header closeButton>
          <Modal.Title className="fs-6 fw-bold text-danger d-flex align-items-center gap-2">
            <IconAlertTriangle size={18} /> İskonto Tanımını Sil
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="py-3">
          <p className="mb-0 small">
            <strong>{tanim}</strong> ({kod}) iskonto tanımı veritabanından kalıcı olarak silinecektir. Devam etmek istiyor musunuz?
          </p>
        </Modal.Body>
        <Modal.Footer className="py-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowDeleteConfirm(false)}
          >
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

export default IskontoDefinitionsPage;
