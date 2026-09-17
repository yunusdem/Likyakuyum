import React, { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Container, Row, Col, Card, Form, Button, Alert, Modal, Badge, Table, ButtonGroup } from "react-bootstrap";
import {
  IconLayoutGrid,
  IconCheck,
  IconAlertTriangle,
  IconGripVertical,
  IconBuildingStore,
  IconZoomIn,
  IconZoomOut,
  IconSparkles,
} from "@tabler/icons-react";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import ERPToolbar from "../../components/common/ERPToolbar";
import LookupModal, { LookupColumn } from "../../components/common/LookupModal";
import { EtiketService, EtiketSablonItem, EtiketSablonAlan } from "../../services/etiketService";

const ETIKET_TIPLERI = [
  { value: 0, ad: "Altın / Sarrafiye" },
  { value: 1, ad: "Özel / Pırlanta" },
  { value: 2, ad: "Yüzük / Bilezik" },
  { value: 3, ad: "Fiyat & Ayar" },
];

const FIELD_CANDIDATES: Record<number, { key: string; ad: string }[]> = {
  0: [
    { key: "grupUrunNo", ad: "Ürün No" },
    { key: "ayar", ad: "Ayar" },
    { key: "has", ad: "Has" },
    { key: "gram", ad: "Gram" },
    { key: "ureticiKodu", ad: "Üretici Kodu" },
    { key: "model", ad: "Model" },
    { key: "fiyat", ad: "Fiyat" },
  ],
  1: [
    { key: "grupUrunNo", ad: "Ürün No" },
    { key: "mamulTipi", ad: "Mamul Tipi" },
    { key: "tasCinsi", ad: "Taş Cinsi" },
    { key: "karat", ad: "Karat" },
    { key: "renk", ad: "Renk" },
    { key: "berraklik", ad: "Berraklık" },
    { key: "fiyat", ad: "Fiyat" },
  ],
  2: [
    { key: "grupUrunNo", ad: "Ürün No" },
    { key: "ayar", ad: "Ayar" },
    { key: "has", ad: "Has Karşılığı" },
    { key: "gram", ad: "Gram" },
    { key: "ureticiKodu", ad: "Üretici Kodu" },
    { key: "fiyat", ad: "Fiyat" },
  ],
  3: [
    { key: "grupUrunNo", ad: "Ürün No" },
    { key: "montur", ad: "Montür Ayarı" },
    { key: "tasCinsi", ad: "Taş Cinsi" },
    { key: "karat", ad: "Karat" },
    { key: "renk", ad: "Renk" },
    { key: "berraklik", ad: "Berraklık" },
    { key: "fiyat", ad: "Fiyat" },
  ],
};

const LOGO_KONUMLARI = [
  { value: "sol-ust", ad: "Sol Üst" },
  { value: "sag-ust", ad: "Sağ Üst" },
  { value: "orta-ust", ad: "Orta Üst" },
  { value: "yok", ad: "Logo Yok" },
];

const getSampleValue = (key: string, tip: number): string => {
  const samples: Record<string, string> = {
    grupUrunNo: tip === 1 ? "PIR-204" : tip === 2 ? "BLZ-305" : tip === 3 ? "FYT-501" : "YZK-1001",
    ayar: tip === 3 ? "750 (18K)" : "916 (22K)",
    montur: "750 (18K)",
    has: "4.580 gr",
    gram: "5.000 gr",
    ureticiKodu: "ORJ-88",
    model: "Klasik Kelebek",
    fiyat: tip === 1 ? "1.250 USD" : tip === 3 ? "2.100 USD" : "18.500 TL",
    mamulTipi: "Tektaş Yüzük",
    tasCinsi: "Pırlanta / Diamond",
    karat: "0.35 Ct",
    renk: "F",
    berraklik: "VS1",
  };
  return samples[key] || "Örnek";
};

const PreviewBarcodeSvg: React.FC<{ value: string; tip: "CODE128" | "QR"; scale?: number }> = ({
  value,
  tip,
  scale = 1.5,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  useEffect(() => {
    if (!value) return;
    if (tip === "QR") {
      QRCode.toDataURL(value, { margin: 1, width: Math.round(54 * scale) })
        .then(setQrDataUrl)
        .catch(() => setQrDataUrl(""));
    } else if (svgRef.current) {
      try {
        JsBarcode(svgRef.current, value, {
          format: "CODE128",
          displayValue: true,
          fontSize: Math.max(9, Math.round(7 * scale)),
          height: Math.max(16, Math.round(18 * scale)),
          margin: 1,
          width: Math.max(1, 1 * (scale >= 1.5 ? 1.2 : 1)),
          font: "monospace",
        });
      } catch {
        /* ignore invalid barcode */
      }
    }
  }, [value, tip, scale]);

  if (!value) return <span className="text-muted small">Barkod yok</span>;
  if (tip === "QR") {
    return qrDataUrl ? (
      <div className="d-flex flex-column align-items-center">
        <img
          src={qrDataUrl}
          alt={value}
          style={{ width: Math.round(48 * scale), height: Math.round(48 * scale) }}
        />
        <span className="font-monospace fw-bold" style={{ fontSize: `${Math.max(7, 6 * scale)}px` }}>
          {value}
        </span>
      </div>
    ) : null;
  }
  return <svg ref={svgRef} style={{ maxWidth: "100%", height: "auto" }} />;
};

export const UrunEtiketTasarimiPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isOzel = location.pathname.includes("ozel");
  const isAltin = location.pathname.includes("altin");
  const pageTitle = isOzel
    ? "G- Özel Ürün Etiket Tasarımı"
    : isAltin
    ? "F- Altın Etiket Tasarımı"
    : "D- Ürün Etiket Tasarımı";

  const [etiketSablonId, setEtiketSablonId] = useState<number | null>(null);
  const [ad, setAd] = useState("");
  const [etiketTipi, setEtiketTipi] = useState(isOzel ? 1 : 0);
  const [genislikMm, setGenislikMm] = useState<number | string>(40);
  const [yukseklikMm, setYukseklikMm] = useState<number | string>(25);
  const [kuyrukPayiMm, setKuyrukPayiMm] = useState<number | string>(0);
  const [logoKonumu, setLogoKonumu] = useState("sol-ust");
  const [barkodTipi, setBarkodTipi] = useState<"CODE128" | "QR">("CODE128");
  const [alanlar, setAlanlar] = useState<EtiketSablonAlan[]>([]);
  const [varsayilan, setVarsayilan] = useState(false);
  const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null);
  const [draggedKey, setDraggedKey] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [previewZoom, setPreviewZoom] = useState<number>(1.6);

  const [sablonList, setSablonList] = useState<EtiketSablonItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "danger" | "warning"; message: string } | null>(null);
  const [showLookup, setShowLookup] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const adRef = useRef<HTMLInputElement | null>(null);
  const etiketTipiRef = useRef<HTMLSelectElement | null>(null);
  const genislikMmRef = useRef<HTMLInputElement | null>(null);
  const yukseklikMmRef = useRef<HTMLInputElement | null>(null);
  const kuyrukPayiMmRef = useRef<HTMLInputElement | null>(null);
  const logoKonumuRef = useRef<HTMLSelectElement | null>(null);
  const barkodTipiCode128Ref = useRef<HTMLInputElement | null>(null);
  const varsayilanRef = useRef<HTMLInputElement | null>(null);
  const rowInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  const showNotif = (type: "success" | "danger" | "warning", msg: string) => {
    setNotification({ type, message: msg });
    setTimeout(() => setNotification(null), 4000);
  };

  // Ok tuşları (Aşağı/Yukarı) ve Enter ile alanlar arası geçiş
  const handleFieldKeyDown = (
    e: React.KeyboardEvent<any>,
    nextRef?: React.RefObject<any>,
    prevRef?: React.RefObject<any>
  ) => {
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      if (nextRef?.current) nextRef.current.focus();
      else handleSave();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      prevRef?.current?.focus();
    }
  };

  const loadAll = useCallback(async () => {
    try {
      const list = await EtiketService.getSablonlar();
      setSablonList(list);
    } catch (err: any) {
      showNotif("danger", err?.message || "Şablonlar yüklenemedi.");
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleNew = useCallback(() => {
    setEtiketSablonId(null);
    setAd("");
    setEtiketTipi(0);
    setGenislikMm(40);
    setYukseklikMm(25);
    setKuyrukPayiMm(0);
    setLogoKonumu("sol-ust");
    setBarkodTipi("CODE128");
    setAlanlar(FIELD_CANDIDATES[0].map((f, idx) => ({ key: f.key, ad: f.ad, aktif: idx < 4, sira: idx + 1 })));
    setVarsayilan(false);
    setActiveRowIndex(null);
    setDraggedKey(null);
    setDragOverKey(null);
    adRef.current?.focus();
  }, []);

  useEffect(() => {
    handleNew();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = useCallback((s: EtiketSablonItem) => {
    setEtiketSablonId(s.etiketSablonId);
    setAd(s.ad);
    setEtiketTipi(s.etiketTipi);
    setGenislikMm(s.genislikMm);
    setYukseklikMm(s.yukseklikMm);
    setKuyrukPayiMm(s.kuyrukPayiMm);
    setLogoKonumu(s.logoKonumu);
    setBarkodTipi((s.barkodTipi as "CODE128" | "QR") || "CODE128");
    setAlanlar(s.alanlar && s.alanlar.length > 0 ? s.alanlar : FIELD_CANDIDATES[s.etiketTipi]?.map((f, idx) => ({ key: f.key, ad: f.ad, aktif: true, sira: idx + 1 })) || []);
    setVarsayilan(s.varsayilan);
    setActiveRowIndex(null);
    setDraggedKey(null);
    setDragOverKey(null);
  }, []);

  // Etiket tipi değiştiğinde alan listesini yenile
  const handleEtiketTipiChange = (val: number) => {
    setEtiketTipi(val);
    setAlanlar(FIELD_CANDIDATES[val].map((f, idx) => ({ key: f.key, ad: f.ad, aktif: idx < 4, sira: idx + 1 })));
  };

  const handleSave = useCallback(async () => {
    if (!ad.trim()) {
      showNotif("warning", "Lütfen şablon adı giriniz.");
      adRef.current?.focus();
      return;
    }
    setIsSaving(true);
    try {
      const saved = await EtiketService.saveSablon({
        etiketSablonId,
        ad: ad.trim(),
        etiketTipi,
        genislikMm: Number(genislikMm) || 40,
        yukseklikMm: Number(yukseklikMm) || 25,
        kuyrukPayiMm: Number(kuyrukPayiMm) || 0,
        logoKonumu,
        barkodTipi,
        alanlar,
        varsayilan,
      });
      showNotif("success", `Etiket şablonu ${etiketSablonId ? "güncellendi" : "kaydedildi"}: ${saved.ad}`);
      setEtiketSablonId(saved.etiketSablonId);
      await loadAll();
    } catch (err: any) {
      showNotif("danger", err?.message || "Kayıt sırasında hata oluştu.");
    } finally {
      setIsSaving(false);
    }
  }, [etiketSablonId, ad, etiketTipi, genislikMm, yukseklikMm, kuyrukPayiMm, logoKonumu, barkodTipi, alanlar, varsayilan, loadAll]);

  const handleDelete = useCallback(async () => {
    if (!etiketSablonId) return;
    try {
      await EtiketService.deleteSablon(etiketSablonId);
      showNotif("success", "Etiket şablonu silindi.");
      setShowDeleteConfirm(false);
      handleNew();
      await loadAll();
    } catch (err: any) {
      showNotif("danger", err?.message || "Şablon silinemedi.");
      setShowDeleteConfirm(false);
    }
  }, [etiketSablonId, handleNew, loadAll]);

  const toggleAlan = (key: string) => {
    setAlanlar((prev) => prev.map((a) => (a.key === key ? { ...a, aktif: !a.aktif } : a)));
  };

  const updateAlanAdi = (key: string, yeniAd: string) => {
    setAlanlar((prev) => prev.map((a) => (a.key === key ? { ...a, ad: yeniAd } : a)));
  };

  const reorderAlanlar = (sourceKey: string, targetKey: string) => {
    setAlanlar((prev) => {
      const list = [...prev].sort((a, b) => a.sira - b.sira);
      const sourceIdx = list.findIndex((a) => a.key === sourceKey);
      const targetIdx = list.findIndex((a) => a.key === targetKey);
      if (sourceIdx < 0 || targetIdx < 0 || sourceIdx === targetIdx) return prev;
      const [moved] = list.splice(sourceIdx, 1);
      list.splice(targetIdx, 0, moved);
      return list.map((item, idx) => ({ ...item, sira: idx + 1 }));
    });
  };

  const sortedAlanlar = [...alanlar].sort((a, b) => a.sira - b.sira);

  // Tablo içinde yukarı/aşağı ok veya enter ile satırlar arası geçiş
  const handleGridInputKeyDown = (e: React.KeyboardEvent<any>, index: number) => {
    if (e.key === "ArrowDown" || e.key === "Enter") {
      e.preventDefault();
      const nextIndex = index + 1;
      if (nextIndex < sortedAlanlar.length) {
        const nextKey = sortedAlanlar[nextIndex].key;
        rowInputRefs.current[nextKey]?.focus();
        setActiveRowIndex(nextIndex);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prevIndex = index - 1;
      if (prevIndex >= 0) {
        const prevKey = sortedAlanlar[prevIndex].key;
        rowInputRefs.current[prevKey]?.focus();
        setActiveRowIndex(prevIndex);
      }
    }
  };

  const lookupColumns: LookupColumn<EtiketSablonItem>[] = [
    { header: "Ad", render: (it) => <span className="fw-bold">{it.ad}</span> },
    { header: "Tip", width: "160px", render: (it) => ETIKET_TIPLERI.find((t) => t.value === it.etiketTipi)?.ad || "-" },
    { header: "Ölçü mm", width: "110px", render: (it) => `${it.genislikMm}×${it.yukseklikMm}` },
    { header: "Barkod", width: "90px", render: (it) => it.barkodTipi },
    {
      header: "Varsayılan",
      width: "90px",
      align: "center",
      render: (it) => (it.varsayilan ? <Badge bg="success">Evet</Badge> : <Badge bg="secondary">Hayır</Badge>),
    },
  ];

  return (
    <div className="urun-etiket-tasarimi-page w-100 pb-3" style={{ overflowX: "hidden" }}>
      <ERPToolbar
        pageTitle={pageTitle}
        pageIcon={<IconLayoutGrid size={20} />}
        disabled={isSaving}
        onSave={handleSave}
        onDelete={() => {
          if (etiketSablonId) setShowDeleteConfirm(true);
          else showNotif("warning", "Silinecek bir şablon seçiniz.");
        }}
        onNew={handleNew}
        onRefresh={loadAll}
        onSearch={() => setShowLookup(true)}
        hideNavigation
        modeText={etiketSablonId ? `Düzenleme: #${etiketSablonId} ${ad}` : "Yeni Şablon Modu"}
      />

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

      <Row className="gx-3">
        <Col lg={7}>
          {/* Parametre Alanları */}
          <Card className="shadow-sm border-0 mb-3" style={{ border: "1px solid #c9d8ea" }}>
            <Card.Body className="p-3">
              <Form.Group as={Row} className="mb-2 align-items-center g-2">
                <Form.Label column style={{ width: "125px", flex: "0 0 125px", maxWidth: "125px" }} className="small fw-bold text-secondary text-start text-nowrap">
                  Şablon Adı <span className="text-danger">*</span> :
                </Form.Label>
                <Col>
                  <Form.Control
                    ref={adRef}
                    type="text"
                    size="sm"
                    value={ad}
                    onChange={(e) => setAd(e.target.value)}
                    onKeyDown={(e) => handleFieldKeyDown(e, etiketTipiRef)}
                  />
                </Col>
              </Form.Group>

              <Form.Group as={Row} className="mb-2 align-items-center g-2">
                <Form.Label column style={{ width: "125px", flex: "0 0 125px", maxWidth: "125px" }} className="small fw-bold text-secondary text-start text-nowrap">
                  Etiket Tipi :
                </Form.Label>
                <Col>
                  <Form.Select
                    ref={etiketTipiRef}
                    size="sm"
                    value={etiketTipi}
                    onChange={(e) => handleEtiketTipiChange(Number(e.target.value))}
                    onKeyDown={(e) => handleFieldKeyDown(e, genislikMmRef, adRef)}
                  >
                    {ETIKET_TIPLERI.map((t) => (
                      <option key={t.value} value={t.value}>{t.ad}</option>
                    ))}
                  </Form.Select>
                </Col>
              </Form.Group>

              <div className="d-flex align-items-center mb-2 g-2">
                <div style={{ width: "125px", flex: "0 0 125px", maxWidth: "125px" }} />
                <div className="flex-grow-1">
                  <Row className="g-2">
                    <Col>
                      <Form.Label className="small text-muted mb-0">Etiket Eni mm</Form.Label>
                      <Form.Control
                        ref={genislikMmRef}
                        type="number"
                        size="sm"
                        value={genislikMm}
                        onChange={(e) => setGenislikMm(e.target.value)}
                        onKeyDown={(e) => handleFieldKeyDown(e, yukseklikMmRef, etiketTipiRef)}
                      />
                    </Col>
                    <Col>
                      <Form.Label className="small text-muted mb-0">Etiket Boyu mm</Form.Label>
                      <Form.Control
                        ref={yukseklikMmRef}
                        type="number"
                        size="sm"
                        value={yukseklikMm}
                        onChange={(e) => setYukseklikMm(e.target.value)}
                        onKeyDown={(e) => handleFieldKeyDown(e, kuyrukPayiMmRef, genislikMmRef)}
                      />
                    </Col>
                    <Col>
                      <Form.Label className="small text-muted mb-0">Kuyruk Payı mm</Form.Label>
                      <Form.Control
                        ref={kuyrukPayiMmRef}
                        type="number"
                        size="sm"
                        value={kuyrukPayiMm}
                        onChange={(e) => setKuyrukPayiMm(e.target.value)}
                        onKeyDown={(e) => handleFieldKeyDown(e, logoKonumuRef, yukseklikMmRef)}
                      />
                    </Col>
                  </Row>
                </div>
              </div>

              <Form.Group as={Row} className="mb-2 align-items-center g-2">
                <Form.Label column style={{ width: "125px", flex: "0 0 125px", maxWidth: "125px" }} className="small fw-bold text-secondary text-start text-nowrap">
                  Logo Konumu :
                </Form.Label>
                <Col>
                  <Form.Select
                    ref={logoKonumuRef}
                    size="sm"
                    value={logoKonumu}
                    onChange={(e) => setLogoKonumu(e.target.value)}
                    onKeyDown={(e) => handleFieldKeyDown(e, barkodTipiCode128Ref, kuyrukPayiMmRef)}
                  >
                    {LOGO_KONUMLARI.map((l) => (
                      <option key={l.value} value={l.value}>{l.ad}</option>
                    ))}
                  </Form.Select>
                </Col>
              </Form.Group>

              <Form.Group as={Row} className="mb-2 align-items-center g-2">
                <Form.Label column style={{ width: "125px", flex: "0 0 125px", maxWidth: "125px" }} className="small fw-bold text-secondary text-start text-nowrap">
                  Barkod Tipi :
                </Form.Label>
                <Col>
                  <div className="d-flex gap-3">
                    <Form.Check
                      ref={barkodTipiCode128Ref}
                      type="radio"
                      id="barkodCode128"
                      name="barkodTipi"
                      label="Code128 Çizgi Barkod"
                      checked={barkodTipi === "CODE128"}
                      onChange={() => setBarkodTipi("CODE128")}
                      onKeyDown={(e) => handleFieldKeyDown(e, varsayilanRef, logoKonumuRef)}
                    />
                    <Form.Check
                      type="radio"
                      id="barkodQr"
                      name="barkodTipi"
                      label="QR Kod"
                      checked={barkodTipi === "QR"}
                      onChange={() => setBarkodTipi("QR")}
                    />
                  </div>
                </Col>
              </Form.Group>

              <Form.Group as={Row} className="mb-0 align-items-center g-2">
                <Form.Label column style={{ width: "125px", flex: "0 0 125px", maxWidth: "125px" }} className="small fw-bold text-secondary text-start text-nowrap">
                  Varsayılan Şablon :
                </Form.Label>
                <Col>
                  <Form.Check
                    ref={varsayilanRef}
                    type="switch"
                    id="varsayilanSwitch"
                    label="Bu etiket tipi için varsayılan şablon olsun"
                    checked={varsayilan}
                    onChange={(e) => setVarsayilan(e.target.checked)}
                    onKeyDown={(e) => handleFieldKeyDown(e, undefined, barkodTipiCode128Ref)}
                    className="small fw-semibold text-success"
                  />
                </Col>
              </Form.Group>
            </Card.Body>
          </Card>

          {/* Etikete Basılacak Alanlar - Mouse ile Sürükle Bırak Sıralama Tablosu */}
          <div style={{ overflowX: "auto" }} className="mb-3">
            <Table bordered size="sm" hover className="mb-0 bg-white shadow-sm" style={{ fontSize: "11.5px" }}>
              <thead style={{ background: "#d9e8fb", color: "#000" }}>
                <tr>
                  <th style={{ width: 42 }} className="text-center" title="Sıralamak için satırı sürükleyip bırakabilirsiniz">#</th>
                  <th style={{ width: 45 }} className="text-center">Aktif</th>
                  <th style={{ width: 130 }}>Alan kodu</th>
                  <th>Etiket üzerindeki adı</th>
                </tr>
              </thead>
              <tbody>
                {sortedAlanlar.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center text-muted py-3">
                      Bu etiket tipi için alan bulunamadı.
                    </td>
                  </tr>
                ) : (
                  sortedAlanlar.map((row, rowIndex) => {
                    const isDragging = draggedKey === row.key;
                    const isDragOver = dragOverKey === row.key && draggedKey !== row.key;
                    return (
                      <tr
                        key={row.key}
                        data-row-id={row.key}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", row.key);
                          e.dataTransfer.effectAllowed = "move";
                          setDraggedKey(row.key);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          if (dragOverKey !== row.key) setDragOverKey(row.key);
                        }}
                        onDragEnd={() => {
                          setDraggedKey(null);
                          setDragOverKey(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const sourceKey = e.dataTransfer.getData("text/plain") || draggedKey;
                          if (sourceKey && sourceKey !== row.key) {
                            reorderAlanlar(sourceKey, row.key);
                          }
                          setDraggedKey(null);
                          setDragOverKey(null);
                        }}
                        style={{
                          background: isDragging
                            ? "#e9ecef"
                            : isDragOver
                            ? "#d0ebff"
                            : rowIndex === activeRowIndex
                            ? "#edf5ff"
                            : "transparent",
                          opacity: isDragging ? 0.5 : 1,
                          borderTop: isDragOver ? "2px solid #1971c2" : undefined,
                          cursor: "grab",
                          transition: "background 0.15s ease",
                        }}
                        onClick={() => setActiveRowIndex(rowIndex)}
                      >
                        {/* # ve Drag Handle */}
                        <td
                          className="text-muted text-center"
                          style={{
                            padding: "2px 4px",
                            fontSize: "10.5px",
                            verticalAlign: "middle",
                            userSelect: "none",
                          }}
                          title="Sıralamak için yukarı/aşağı sürükleyin"
                        >
                          <div className="d-flex align-items-center justify-content-center gap-1">
                            <IconGripVertical size={13} className="text-secondary opacity-75" />
                            <span>{rowIndex + 1}</span>
                          </div>
                        </td>

                        {/* Aktif Checkbox */}
                        <td
                          className="text-center"
                          style={{ verticalAlign: "middle", padding: "2px" }}
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <Form.Check
                            checked={row.aktif}
                            onChange={() => toggleAlan(row.key)}
                            style={{ display: "inline-block", margin: 0 }}
                          />
                        </td>

                        {/* Alan kodu */}
                        <td style={{ verticalAlign: "middle", padding: "2px 6px", fontSize: "11px", fontFamily: "monospace", color: "#495057", userSelect: "none" }}>
                          {row.key}
                        </td>

                        {/* Etiket üzerindeki adı */}
                        <td
                          style={{ padding: "2px 4px", verticalAlign: "middle" }}
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <Form.Control
                            ref={(el) => {
                              rowInputRefs.current[row.key] = el;
                            }}
                            size="sm"
                            value={row.ad}
                            onChange={(e) => updateAlanAdi(row.key, e.target.value)}
                            onKeyDown={(e) => handleGridInputKeyDown(e, rowIndex)}
                            onFocus={() => setActiveRowIndex(rowIndex)}
                            style={{ fontSize: "11.5px", padding: "1px 6px", height: "24px" }}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </Table>
          </div>
        </Col>

        {/* Canlı Önizleme */}
        <Col lg={5}>
          <Card className="shadow-sm border-0 mb-3" style={{ border: "1px solid #c9d8ea" }}>
            <Card.Header className="bg-light py-2 px-3 border-bottom d-flex align-items-center justify-content-between flex-wrap gap-2">
              <div className="d-flex align-items-center gap-2">
                <IconSparkles size={16} className="text-primary" />
                <span className="fw-bold text-dark">Canlı Önizleme</span>
                <Badge bg="primary" className="fw-normal">
                  {genislikMm} × {yukseklikMm} mm
                  {Number(kuyrukPayiMm) > 0 ? ` + ${kuyrukPayiMm} mm Kuyruk` : ""}
                </Badge>
              </div>
              <ButtonGroup size="sm">
                <Button
                  variant={previewZoom === 1.0 ? "primary" : "outline-secondary"}
                  onClick={() => setPreviewZoom(1.0)}
                  style={{ fontSize: "11px", padding: "2px 8px" }}
                  title="Gerçek Boyut (1x)"
                >
                  1.0x
                </Button>
                <Button
                  variant={previewZoom === 1.5 ? "primary" : "outline-secondary"}
                  onClick={() => setPreviewZoom(1.5)}
                  style={{ fontSize: "11px", padding: "2px 8px" }}
                  title="Ölçekli (1.5x)"
                >
                  1.5x
                </Button>
                <Button
                  variant={previewZoom === 2.0 ? "primary" : "outline-secondary"}
                  onClick={() => setPreviewZoom(2.0)}
                  style={{ fontSize: "11px", padding: "2px 8px" }}
                  title="Büyük Görünüm (2x)"
                >
                  2.0x
                </Button>
              </ButtonGroup>
            </Card.Header>

            <Card.Body
              className="p-4 d-flex align-items-center justify-content-center overflow-auto"
              style={{
                background: "repeating-linear-gradient(45deg, #f8f9fa, #f8f9fa 12px, #f1f3f5 12px, #f1f3f5 24px)",
                minHeight: "340px",
              }}
            >
              {(() => {
                const wMm = Number(genislikMm) || 40;
                const hMm = Number(yukseklikMm) || 25;
                const tailMm = Number(kuyrukPayiMm) || 0;
                const pxPerMm = 3.78 * previewZoom;
                const labelWidthPx = Math.max(160, Math.round(wMm * pxPerMm));
                const labelHeightPx = Math.max(110, Math.round(hMm * pxPerMm));
                const tailWidthPx = Math.round(tailMm * pxPerMm);
                const sampleBarcode =
                  etiketTipi === 1 ? "PIR204" : etiketTipi === 2 ? "BLZ305" : etiketTipi === 3 ? "FYT501" : "YZK1001";
                const activeFields = sortedAlanlar.filter((a) => a.aktif);
                const fontSizePx = Math.max(8, Math.round(5.8 * previewZoom));

                return (
                  <div className="d-flex align-items-stretch shadow-lg rounded" style={{ maxWidth: "100%" }}>
                    {/* Ana Etiket Gövdesi */}
                    <div
                      className="bg-white border border-dark rounded-start d-flex flex-column justify-content-between position-relative"
                      style={{
                        width: `${labelWidthPx}px`,
                        height: `${labelHeightPx}px`,
                        padding: `${Math.max(4, Math.round(3 * previewZoom))}px`,
                        boxSizing: "border-box",
                        fontFamily: "Inter, system-ui, -apple-system, sans-serif",
                      }}
                    >
                      {/* Üst Alan: Logo ve Alan Listesi */}
                      <div
                        className={`d-flex ${
                          logoKonumu === "orta-ust"
                            ? "flex-column align-items-center"
                            : logoKonumu === "sag-ust"
                            ? "flex-row-reverse justify-content-between align-items-start"
                            : "flex-row justify-content-between align-items-start"
                        } w-100`}
                        style={{ gap: `${Math.max(4, Math.round(3 * previewZoom))}px` }}
                      >
                        {/* Logo Kutusu */}
                        {logoKonumu !== "yok" && (
                          <div
                            className="border border-secondary rounded d-flex flex-column align-items-center justify-content-center text-secondary bg-light flex-shrink-0"
                            style={{
                              width: `${Math.max(34, Math.round(10 * pxPerMm))}px`,
                              height: `${Math.max(22, Math.round(6 * pxPerMm))}px`,
                              fontSize: `${Math.max(7, Math.round(4.8 * previewZoom))}px`,
                              fontWeight: 700,
                              letterSpacing: "0.5px",
                            }}
                          >
                            <IconBuildingStore size={Math.max(12, Math.round(10 * previewZoom))} />
                            <span>LOGO</span>
                          </div>
                        )}

                        {/* Seçili Alanlar */}
                        <div className="flex-grow-1 overflow-hidden" style={{ minWidth: 0 }}>
                          {activeFields.length === 0 ? (
                            <div
                              className="text-muted text-center fst-italic py-2"
                              style={{ fontSize: `${fontSizePx}px` }}
                            >
                              Hiçbir alan seçilmedi
                            </div>
                          ) : (
                            activeFields.map((a) => (
                              <div
                                key={a.key}
                                className="d-flex justify-content-between align-items-baseline mb-0.5"
                                style={{
                                  fontSize: `${fontSizePx}px`,
                                  lineHeight: 1.25,
                                  borderBottom: "1px dotted #e9ecef",
                                  paddingBottom: "1px",
                                }}
                              >
                                <span className="text-secondary text-truncate me-1" style={{ maxWidth: "55%" }}>
                                  {a.ad}:
                                </span>
                                <span className="fw-bold text-dark font-monospace text-truncate text-end">
                                  {getSampleValue(a.key, etiketTipi)}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Alt Alan: Gerçek Barkod / QR Görseli */}
                      <div className="d-flex flex-column align-items-center justify-content-center pt-1 mt-auto border-top">
                        <PreviewBarcodeSvg value={sampleBarcode} tip={barkodTipi} scale={previewZoom} />
                      </div>
                    </div>

                    {/* Kuyruk Payı (Kelebek / Kuyruklu etiketler için) */}
                    {tailMm > 0 && (
                      <div
                        className="d-flex flex-column align-items-center justify-content-center text-muted border border-dark border-start-0 rounded-end position-relative"
                        style={{
                          width: `${Math.max(36, tailWidthPx)}px`,
                          height: `${labelHeightPx}px`,
                          background:
                            "repeating-linear-gradient(45deg, #ffffff, #ffffff 4px, #f1f3f5 4px, #f1f3f5 8px)",
                          borderLeft: "2px dashed #6c757d",
                          fontSize: `${Math.max(7, Math.round(5 * previewZoom))}px`,
                          writingMode: "vertical-rl",
                          textOrientation: "mixed",
                          letterSpacing: "1px",
                          fontWeight: 600,
                          padding: "4px",
                          userSelect: "none",
                        }}
                        title={`Kuyruk Payı (${tailMm} mm) - Yüzük/Bilezik boğum alanı`}
                      >
                        KUYRUK ({tailMm} mm)
                      </div>
                    )}
                  </div>
                );
              })()}
            </Card.Body>

            <Card.Footer className="py-2 bg-light d-flex align-items-center justify-content-between flex-wrap gap-1 small text-muted">
              <div>
                Barkod Formatı: <strong className="text-dark">{barkodTipi}</strong> | Aktif Alan:{" "}
                <strong className="text-dark">{sortedAlanlar.filter((a) => a.aktif).length}</strong>
              </div>
              <div style={{ fontSize: "11px" }}>
                Gerçek yazdırma çıktısı seçilen etiket yazıcısına göre milimetrik olarak işlenir.
              </div>
            </Card.Footer>
          </Card>
        </Col>
      </Row>

      <LookupModal<EtiketSablonItem>
        show={showLookup}
        title="Etiket Şablonu Seçiniz"
        columns={lookupColumns}
        items={sablonList}
        filterFn={(it, term) => it.ad.toLowerCase().includes(term.toLowerCase())}
        onSelect={(selected) => {
          handleSelect(selected);
          setShowLookup(false);
        }}
        onHide={() => setShowLookup(false)}
      />

      <Modal show={showDeleteConfirm} onHide={() => setShowDeleteConfirm(false)} centered size="sm">
        <Modal.Header closeButton>
          <Modal.Title className="fs-6 fw-bold text-danger d-flex align-items-center gap-2">
            <IconAlertTriangle size={18} /> Şablonu Sil
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="py-3">
          <p className="mb-0 small">
            <strong>{ad}</strong> şablonu silinecektir. Devam etmek istiyor musunuz?
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

export default UrunEtiketTasarimiPage;

