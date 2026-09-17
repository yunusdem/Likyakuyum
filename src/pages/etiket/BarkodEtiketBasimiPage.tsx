import React, { useState, useEffect, useCallback, useRef } from "react";
import { Row, Col, Card, Form, Button, Alert, InputGroup, Badge, Modal } from "react-bootstrap";
import {
  IconBarcode,
  IconAlertTriangle,
  IconCheck,
  IconBinoculars,
  IconPrinter,
  IconSearch,
  IconPhoto,
  IconRefresh,
  IconDiamond,
  IconCoins,
  IconSparkles,
  IconChevronLeft,
  IconChevronRight,
  IconScale,
  IconTag,
  IconBuildingStore,
  IconEye,
  IconZoomIn,
  IconMaximize,
  IconX,
} from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import LookupModal, { LookupColumn } from "../../components/common/LookupModal";
import EtiketYazdirModal, { EtiketYazdirItem } from "./EtiketYazdirModal";
import { EtiketService, AltinUrunItem, OzelUrunItem, EtiketSablonItem } from "../../services/etiketService";
import { PrinterService, YaziciItem } from "../../services/printerService";

type Bulunan =
  | { tip: "altin"; urun: AltinUrunItem }
  | { tip: "ozel"; urun: OzelUrunItem };

const resolveImageUrl = (imgStr: string | null | undefined): string => {
  if (!imgStr) return "";
  const trimmed = imgStr.trim();
  if (
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://")
  ) {
    return trimmed;
  }
  if (trimmed.startsWith("/") || trimmed.startsWith("uploads/")) {
    return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  }
  if (trimmed.length > 50 && !trimmed.includes("/") && !trimmed.includes(".")) {
    return `data:image/jpeg;base64,${trimmed}`;
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
};

export const BarkodEtiketBasimiPage: React.FC = () => {
  const [barkodInput, setBarkodInput] = useState("");
  const [bulunan, setBulunan] = useState<Bulunan | null>(null);
  const [seciliFotoIndex, setSeciliFotoIndex] = useState(0);
  const [aranıyor, setAraniyor] = useState(false);

  const [altinList, setAltinList] = useState<AltinUrunItem[]>([]);
  const [ozelList, setOzelList] = useState<OzelUrunItem[]>([]);
  const [sablonlar, setSablonlar] = useState<EtiketSablonItem[]>([]);
  const [yazicilar, setYazicilar] = useState<YaziciItem[]>([]);
  const [notification, setNotification] = useState<{ type: "success" | "danger" | "warning"; message: string } | null>(null);

  const [showLookup, setShowLookup] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showFotoModal, setShowFotoModal] = useState(false);

  const barkodRef = useRef<HTMLInputElement | null>(null);

  const showNotif = (type: "success" | "danger" | "warning", msg: string) => {
    setNotification({ type, message: msg });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadAll = useCallback(async () => {
    try {
      const [altin, ozel, sabl, yzc] = await Promise.all([
        EtiketService.getAltinUrunler({ limit: 500 }),
        EtiketService.getOzelUrunler({ limit: 500 }),
        EtiketService.getSablonlar(),
        PrinterService.getYazicilar().catch(() => []),
      ]);
      setAltinList(altin);
      setOzelList(ozel);
      setSablonlar(sabl);
      setYazicilar(yzc);
    } catch (err: any) {
      showNotif("danger", err?.message || "Veriler yüklenemedi.");
    }
  }, []);

  useEffect(() => {
    loadAll();
    barkodRef.current?.focus();
  }, [loadAll]);

  const handleAra = useCallback(async () => {
    const kod = barkodInput.trim();
    if (!kod) {
      showNotif("warning", "Lütfen barkod okutunuz veya yazınız.");
      return;
    }
    setAraniyor(true);
    try {
      const altin = await EtiketService.getAltinUrunByBarkod(kod).catch(() => null);
      if (altin) {
        setBulunan({ tip: "altin", urun: altin });
        setSeciliFotoIndex(0);
        showNotif("success", `Bulundu: ${altin.grupKodu}-${altin.urunNo} (${altin.model || "Sarrafiye"})`);
        return;
      }
      const ozel = await EtiketService.getOzelUrunByBarkod(kod).catch(() => null);
      if (ozel) {
        setBulunan({ tip: "ozel", urun: ozel });
        setSeciliFotoIndex(0);
        showNotif("success", `Bulundu: ${ozel.grupKodu}-${ozel.urunNo} (${ozel.mamulTipi || "Özel Ürün"})`);
        return;
      }
      setBulunan(null);
      showNotif("danger", `"${kod}" barkoduna ait ürün bulunamadı.`);
    } finally {
      setAraniyor(false);
    }
  }, [barkodInput]);

  const handleSelectFromLookup = (item: AltinUrunItem | OzelUrunItem, tip: "altin" | "ozel") => {
    if (tip === "altin") setBulunan({ tip: "altin", urun: item as AltinUrunItem });
    else setBulunan({ tip: "ozel", urun: item as OzelUrunItem });
    setSeciliFotoIndex(0);
    setBarkodInput((item as any).barkod || `${item.grupKodu}${item.urunNo}`);
    setShowLookup(false);
  };

  const handleClear = () => {
    setBulunan(null);
    setSeciliFotoIndex(0);
    setBarkodInput("");
    setTimeout(() => barkodRef.current?.focus(), 50);
  };

  const combinedLookupItems: { tip: "altin" | "ozel"; item: AltinUrunItem | OzelUrunItem }[] = [
    ...altinList.map((it) => ({ tip: "altin" as const, item: it })),
    ...ozelList.map((it) => ({ tip: "ozel" as const, item: it })),
  ];

  const lookupColumns: LookupColumn<{ tip: "altin" | "ozel"; item: AltinUrunItem | OzelUrunItem }>[] = [
    { header: "Tip", width: "90px", render: (it) => <Badge bg={it.tip === "altin" ? "warning" : "info"}>{it.tip === "altin" ? "Altın" : "Özel"}</Badge> },
    { header: "Barkod", width: "120px", render: (it) => <span className="font-monospace fw-bold text-primary">{it.item.barkod || "-"}</span> },
    { header: "Grup-No", width: "100px", render: (it) => `${it.item.grupKodu}-${it.item.urunNo}` },
    { header: "Açıklama", render: (it) => (it.tip === "altin" ? (it.item as AltinUrunItem).model : (it.item as OzelUrunItem).mamulTipi) || "-" },
    { header: "Üretici", render: (it) => it.item.ureticiFirma || "-" },
  ];

  const varsayilanSablon = sablonlar.find((s) => s.varsayilan) || sablonlar[0] || null;

  // Fotoğrafları normalize et
  const fotograflar: string[] = bulunan
    ? (bulunan.urun.resimler && bulunan.urun.resimler.length > 0)
      ? bulunan.urun.resimler
      : (bulunan.urun.resim ? [bulunan.urun.resim] : [])
    : [];

  const handlePrevFoto = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (fotograflar.length <= 1) return;
    setSeciliFotoIndex((prev) => (prev > 0 ? prev - 1 : fotograflar.length - 1));
  };

  const handleNextFoto = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (fotograflar.length <= 1) return;
    setSeciliFotoIndex((prev) => (prev < fotograflar.length - 1 ? prev + 1 : 0));
  };

  const printItems: EtiketYazdirItem[] = bulunan
    ? [
      bulunan.tip === "altin"
        ? {
          id: bulunan.urun.altinUrunId,
          barkod: bulunan.urun.barkod || `${bulunan.urun.grupKodu}${bulunan.urun.urunNo}`,
          fields: {
            grupUrunNo: `${bulunan.urun.grupKodu}-${bulunan.urun.urunNo}`,
            ayar: bulunan.urun.ayar || "-",
            has: String(bulunan.urun.hasGram || 0),
            gram: String(bulunan.urun.miktar || 0),
            fiyat: `${bulunan.urun.satisFiyati} ${bulunan.urun.satisParaKodu}`,
          },
        }
        : {
          id: (bulunan.urun as OzelUrunItem).ozelUrunId,
          barkod: bulunan.urun.barkod || `${bulunan.urun.grupKodu}${bulunan.urun.urunNo}`,
          fields: {
            grupUrunNo: `${bulunan.urun.grupKodu}-${bulunan.urun.urunNo}`,
            montur: (bulunan.urun as OzelUrunItem).ayar || "-",
            tasCinsi: (bulunan.urun as OzelUrunItem).tasCinsi || "-",
            fiyat: `${bulunan.urun.satisFiyati} ${bulunan.urun.satisParaKodu}`,
          },
        },
    ]
    : [];

  return (
    <div className="barkod-etiket-basimi-page w-100 pb-4" style={{ overflowX: "hidden" }}>
      <ERPToolbar
        pageTitle="A- Barkod & Etiket Basımı"
        pageIcon={
          fotograflar.length > 0 ? (
            <div
              className="rounded-circle overflow-hidden shadow-xs border border-secondary border-opacity-25 d-flex align-items-center justify-content-center"
              style={{ width: "26px", height: "26px", backgroundColor: "#fff" }}
            >
              <img
                src={resolveImageUrl(fotograflar[seciliFotoIndex || 0])}
                alt="Ürün İkonu"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
          ) : (
            <IconBarcode size={20} />
          )
        }
        hideDelete
        hideNavigation
        onSearch={() => setShowLookup(true)}
        onRefresh={loadAll}
        onPrint={() => (bulunan ? setShowPrintModal(true) : showNotif("warning", "Önce bir ürün bulun veya seçin."))}
        modeText="Barkod Okutma / Etiket Basım Ekranı"
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

      {/* Ana Kapsayıcı */}
      <div
        className="d-flex flex-column align-items-center w-100 px-3"
        style={{
          minHeight: bulunan ? "auto" : "calc(80vh - 120px)",
          justifyContent: bulunan ? "flex-start" : "center",
          paddingTop: bulunan ? "1rem" : "0",
          transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Barkod Okutma & Arama Kartı */}
        <div
          style={{
            width: "100%",
            maxWidth: bulunan ? "920px" : "640px",
            transition: "all 0.35s ease",
          }}
        >
          <Card
            className="border-0 shadow-sm rounded-4 overflow-hidden mb-3"
            style={{
              backgroundColor: "#ffffff",
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.03)",
            }}
          >
            <Card.Body className={bulunan ? "p-3" : "p-4"}>
              {!bulunan && (
                <div className="text-center mb-3">
                  <div
                    className="d-inline-flex align-items-center justify-content-center rounded-circle bg-primary bg-opacity-10 text-primary mb-2"
                    style={{ width: "54px", height: "54px" }}
                  >
                    <IconBarcode size={28} strokeWidth={2} />
                  </div>
                  <h5 className="fw-bold text-dark mb-1">Barkod Okutma & Etiket Basımı</h5>
                  <p className="text-muted small mb-0">
                    Barkod okutunuz, manuel yazınız veya dürbün ikonu ile listeden seçiniz.
                  </p>
                </div>
              )}

              <div className="d-flex align-items-center gap-2">
                <InputGroup size="lg" className="shadow-xs rounded-3 overflow-hidden border">
                  <InputGroup.Text className="bg-light border-0 px-3 text-secondary">
                    <IconBarcode size={22} className="text-primary" />
                  </InputGroup.Text>
                  <Form.Control
                    ref={barkodRef}
                    autoFocus
                    placeholder="Barkod okutun veya yazın..."
                    value={barkodInput}
                    onChange={(e) => setBarkodInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAra();
                      }
                    }}
                    className="font-monospace fw-bold border-0"
                    style={{ fontSize: "16px", letterSpacing: "0.5px" }}
                  />
                  <Button
                    variant="primary"
                    onClick={handleAra}
                    disabled={aranıyor}
                    className="px-4 d-flex align-items-center gap-1.5 fw-bold"
                  >
                    <IconSearch size={18} />
                    <span>Bul</span>
                  </Button>
                  <Button
                    variant="light"
                    className="border-start text-secondary px-3"
                    onClick={() => setShowLookup(true)}
                    title="Listeden Çağır (Dürbün)"
                  >
                    <IconBinoculars size={19} className="text-primary" />
                  </Button>
                </InputGroup>

                {bulunan && (
                  <Button
                    variant="outline-secondary"
                    size="lg"
                    onClick={handleClear}
                    title="Yeni Barkod Okut / Temizle"
                    className="px-3 d-flex align-items-center justify-content-center rounded-3"
                    style={{ height: "48px" }}
                  >
                    <IconRefresh size={18} />
                  </Button>
                )}
              </div>
            </Card.Body>
          </Card>
        </div>

        {/* Ürün Seçildiğinde Açılan Kart */}
        {bulunan && (
          <div
            className="w-100 fade-in-scale"
            style={{
              maxWidth: "920px",
              animation: "fadeInUp 0.3s ease-out",
            }}
          >
            <Card className="border-0 shadow-lg rounded-4 overflow-hidden mb-3 bg-white">
              {/* Kart Üst Başlık Şeridi */}
              <div
                className="py-3 px-4 d-flex align-items-center justify-content-between text-white"
                style={{
                  background:
                    bulunan.tip === "altin"
                      ? "linear-gradient(135deg, #b45309 0%, #d97706 50%, #f59e0b 100%)"
                      : "linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #3b82f6 100%)",
                }}
              >
                <div className="d-flex align-items-center gap-3">
                  <div
                    onClick={() => {
                      if (fotograflar.length > 0) setShowFotoModal(true);
                    }}
                    className="rounded-circle bg-white d-flex align-items-center justify-content-center overflow-hidden shadow-sm flex-shrink-0"
                    style={{
                      width: "46px",
                      height: "46px",
                      border: "2px solid rgba(255,255,255,0.8)",
                      cursor: fotograflar.length > 0 ? "pointer" : "default",
                      backgroundColor: "#ffffff",
                    }}
                    title={fotograflar.length > 0 ? "Büyütmek için tıklayın" : ""}
                  >
                    {fotograflar.length > 0 && fotograflar[seciliFotoIndex || 0] ? (
                      <img
                        src={resolveImageUrl(fotograflar[seciliFotoIndex || 0])}
                        alt="Ürün Görseli"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      <div
                        className="w-100 h-100 d-flex align-items-center justify-content-center"
                        style={{
                          background:
                            bulunan.tip === "altin"
                              ? "linear-gradient(135deg, #d97706, #b45309)"
                              : "linear-gradient(135deg, #2563eb, #1e3a8a)",
                        }}
                      >
                        {bulunan.tip === "altin" ? (
                          <IconCoins size={22} className="text-white" />
                        ) : (
                          <IconDiamond size={22} className="text-white" />
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="d-flex align-items-center gap-2">
                      <span className="fw-bolder fs-5 tracking-wide font-monospace">
                        {bulunan.urun.grupKodu}-{bulunan.urun.urunNo}
                      </span>
                      <Badge
                        bg="light"
                        text="dark"
                        className="fw-bold px-2 py-1 shadow-xs"
                        style={{ fontSize: "11px" }}
                      >
                        {bulunan.tip === "altin" ? "ALTIN / SARRAFİYE" : "ÖZEL / PIRLANTA"}
                      </Badge>
                      {bulunan.urun.satildi && (
                        <Badge bg="danger" className="px-2 py-1 shadow-xs">SATILDI</Badge>
                      )}
                    </div>
                    <div className="small text-white text-opacity-90 fw-semibold mt-0.5">
                      {bulunan.tip === "altin"
                        ? (bulunan.urun as AltinUrunItem).model || "Altın Ürün"
                        : (bulunan.urun as OzelUrunItem).mamulTipi || "Özel Ürün"}
                    </div>
                  </div>
                </div>

                <div className="d-flex align-items-center gap-2">
                  <span className="small text-white text-opacity-80 font-monospace d-none d-sm-inline">
                    Barkod: <strong>{bulunan.urun.barkod || `${bulunan.urun.grupKodu}${bulunan.urun.urunNo}`}</strong>
                  </span>
                </div>
              </div>

              {/* Kart Gövdesi: Çoklu Fotoğraf Galerisi + Detay Bilgileri */}
              <Card.Body className="p-3 p-md-4">
                <Row className="g-4 align-items-stretch">
                  {/* Sol Sütun: Çoklu Fotoğraf Galerisi */}
                  <Col md={5} lg={5}>
                    <div className="d-flex flex-column h-100 gap-2">
                      {/* Ana Görsel Görüntüleyici */}
                      <div
                        className="rounded-3 border d-flex flex-column align-items-center justify-content-center position-relative overflow-hidden bg-light group"
                        style={{
                          height: "260px",
                          boxShadow: "inset 0 2px 5px rgba(0,0,0,0.03)",
                          backgroundColor: "#f8fafc",
                          cursor: fotograflar.length > 0 ? "zoom-in" : "default",
                        }}
                        onClick={() => {
                          if (fotograflar.length > 0) setShowFotoModal(true);
                        }}
                        title={fotograflar.length > 0 ? "Büyütmek için tıklayın" : ""}
                      >
                        {fotograflar.length > 0 && fotograflar[seciliFotoIndex] ? (
                          <>
                            <img
                              src={resolveImageUrl(fotograflar[seciliFotoIndex])}
                              alt={`Ürün Görseli ${seciliFotoIndex + 1}`}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "contain",
                                padding: "8px",
                                transition: "all 0.3s ease",
                              }}
                            />

                            {/* Büyütme Butonu (Sağ Üst) */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowFotoModal(true);
                              }}
                              className="btn btn-sm btn-light border position-absolute end-0 top-0 m-2 rounded-circle d-flex align-items-center justify-content-center shadow-sm"
                              style={{ width: "32px", height: "32px", zIndex: 6, opacity: 0.85 }}
                              title="Fotoğrafı Büyüt (Tam Ekran)"
                            >
                              <IconMaximize size={16} className="text-dark" />
                            </button>

                            {/* Sol / Sağ Ok Butonları */}
                            {fotograflar.length > 1 && (
                              <>
                                <button
                                  type="button"
                                  onClick={handlePrevFoto}
                                  className="btn btn-sm btn-dark position-absolute start-0 top-50 translate-middle-y ms-2 rounded-circle d-flex align-items-center justify-content-center opacity-75 shadow"
                                  style={{ width: "32px", height: "32px", zIndex: 5, padding: 0 }}
                                  title="Önceki Fotoğraf"
                                >
                                  <IconChevronLeft size={18} />
                                </button>
                                <button
                                  type="button"
                                  onClick={handleNextFoto}
                                  className="btn btn-sm btn-dark position-absolute end-0 top-50 translate-middle-y me-2 rounded-circle d-flex align-items-center justify-content-center opacity-75 shadow"
                                  style={{ width: "32px", height: "32px", zIndex: 5, padding: 0 }}
                                  title="Sonraki Fotoğraf"
                                >
                                  <IconChevronRight size={18} />
                                </button>
                              </>
                            )}

                            {/* Sayaç Rozeti */}
                            <div
                              className="position-absolute bottom-0 end-0 bg-dark bg-opacity-75 text-white px-2 py-0.5 rounded-top-start small font-monospace"
                              style={{ fontSize: "11px", letterSpacing: "0.5px" }}
                            >
                              {seciliFotoIndex + 1} / {fotograflar.length} Fotoğraf
                            </div>
                          </>
                        ) : (
                          <div className="d-flex flex-column align-items-center text-muted p-3 text-center">
                            <div
                              className="rounded-circle bg-white shadow-xs p-3 mb-2 d-flex align-items-center justify-content-center"
                              style={{ width: "64px", height: "64px" }}
                            >
                              <IconPhoto size={32} className="text-secondary opacity-50" />
                            </div>
                            <span className="small fw-semibold text-secondary">Fotoğraf Yüklenmemiş</span>
                          </div>
                        )}
                      </div>

                      {/* Küçük Resim Thumbnail Şeridi */}
                      {fotograflar.length > 1 && (
                        <div
                          className="d-flex align-items-center gap-2 overflow-auto py-1 px-1 bg-light rounded-3 border"
                          style={{ maxWidth: "100%" }}
                        >
                          {fotograflar.map((imgUrl, idx) => (
                            <div
                              key={idx}
                              onClick={() => setSeciliFotoIndex(idx)}
                              className={`rounded border p-0.5 transition-all ${
                                idx === seciliFotoIndex
                                  ? "border-primary border-2 shadow-sm scale-105"
                                  : "border-secondary border-opacity-25 opacity-70 hover-opacity-100"
                              }`}
                              style={{
                                width: "46px",
                                height: "46px",
                                flexShrink: 0,
                                cursor: "pointer",
                                background: "#fff",
                              }}
                              title={`Fotoğraf ${idx + 1}`}
                            >
                              <img
                                src={resolveImageUrl(imgUrl)}
                                alt={`thumb-${idx}`}
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                  borderRadius: "3px",
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </Col>

                  {/* Sağ Sütun: Fiyat ve Ürün Detayları */}
                  <Col md={7} lg={7}>
                    <div className="d-flex flex-column justify-content-between h-100 gap-3">
                      {/* Fiyat Banner Kutusu */}
                      <div
                        className="rounded-3 p-3 d-flex flex-wrap align-items-center justify-content-between gap-3 border shadow-xs"
                        style={{
                          background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
                          borderColor: "#86efac",
                        }}
                      >
                        <div>
                          <div className="text-success small fw-bold text-uppercase" style={{ fontSize: "11px", letterSpacing: "0.5px" }}>
                            Satış Fiyatı
                          </div>
                          <div className="fs-2 fw-bolder text-dark lh-1 mt-1">
                            {Number(bulunan.urun.satisFiyati || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}{" "}
                            <span className="fs-5 fw-bold text-success">{bulunan.urun.satisParaKodu || "USD"}</span>
                          </div>
                          <div className="text-muted mt-1 font-monospace" style={{ fontSize: "11px" }}>
                            {bulunan.tip === "altin" ? (
                              <>
                                Birim İşçilik: <strong>{(bulunan.urun as AltinUrunItem).maliyetIscilik || 0} {(bulunan.urun as AltinUrunItem).maliyetIscilikParaKodu || "USD"}</strong>
                              </>
                            ) : (
                              <>
                                Montür: <strong>{(bulunan.urun as OzelUrunItem).ayar || "14K"} / {(bulunan.urun as OzelUrunItem).miktar || 0} gr</strong>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Fiyatın Sağındaki Koyu Yeşil Ürün İsmi Paneli */}
                        <div
                          className="rounded-3 p-3 px-4 shadow-sm d-flex align-items-center justify-content-center text-white text-center"
                          style={{
                            background: "linear-gradient(135deg, #14532d 0%, #166534 60%, #15803d 100%)",
                            minWidth: "170px",
                            border: "1px solid rgba(255,255,255,0.15)",
                          }}
                        >
                          <div className="d-flex align-items-center gap-2">
                            <IconSparkles size={18} className="text-warning flex-shrink-0" />
                            <span className="fw-bold fs-6 text-white text-capitalize" style={{ letterSpacing: "0.3px" }}>
                              {bulunan.tip === "altin"
                                ? (bulunan.urun as AltinUrunItem).model || "Altın Ürün"
                                : (bulunan.urun as OzelUrunItem).mamulTipi || "Pırlanta Yüzük"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Bilgi Grid Alanı */}
                      <div className="bg-light rounded-3 p-3 border">
                        <Row className="g-2.5">
                          <Col xs={6} sm={4}>
                            <div className="text-muted small" style={{ fontSize: "11px" }}>Grup / No</div>
                            <div className="fw-bold text-dark font-monospace fs-6">{bulunan.urun.grupKodu}-{bulunan.urun.urunNo}</div>
                          </Col>

                          <Col xs={6} sm={4}>
                            <div className="text-muted small" style={{ fontSize: "11px" }}>Barkod</div>
                            <div className="fw-bold text-dark font-monospace fs-6">{bulunan.urun.barkod || "-"}</div>
                          </Col>

                          <Col xs={6} sm={4}>
                            <div className="text-muted small" style={{ fontSize: "11px" }}>Üretici Firma</div>
                            <div className="fw-bold text-dark text-truncate fs-6">{bulunan.urun.ureticiFirma || "-"}</div>
                          </Col>

                          {bulunan.tip === "altin" ? (
                            <>
                              <Col xs={6} sm={4}>
                                <div className="text-muted small" style={{ fontSize: "11px" }}>Model</div>
                                <div className="fw-bold text-dark text-truncate">{(bulunan.urun as AltinUrunItem).model || "-"}</div>
                              </Col>
                              <Col xs={6} sm={4}>
                                <div className="text-muted small" style={{ fontSize: "11px" }}>Ayar</div>
                                <div className="fw-bold text-dark">{(bulunan.urun as AltinUrunItem).ayar || "-"}</div>
                              </Col>
                              <Col xs={6} sm={4}>
                                <div className="text-muted small" style={{ fontSize: "11px" }}>Gram / Miktar</div>
                                <div className="fw-bold text-dark">{(bulunan.urun as AltinUrunItem).miktar} gr</div>
                              </Col>
                              <Col xs={6} sm={4}>
                                <div className="text-muted small" style={{ fontSize: "11px" }}>Has Gram</div>
                                <div className="fw-bold text-dark">{(bulunan.urun as AltinUrunItem).hasGram} gr</div>
                              </Col>
                              <Col xs={6} sm={4}>
                                <div className="text-muted small" style={{ fontSize: "11px" }}>İşçilik Tutarı</div>
                                <div className="fw-bold text-dark">
                                  {(bulunan.urun as AltinUrunItem).satisIscilikTutari || 0} {(bulunan.urun as AltinUrunItem).satisParaKodu}
                                </div>
                              </Col>
                              <Col xs={6} sm={4}>
                                <div className="text-muted small" style={{ fontSize: "11px" }}>Banko</div>
                                <div className="fw-bold text-dark">{(bulunan.urun as AltinUrunItem).banko || "-"}</div>
                              </Col>
                            </>
                          ) : (
                            <>
                              <Col xs={6} sm={4}>
                                <div className="text-muted small" style={{ fontSize: "11px" }}>Mamul Tipi</div>
                                <div className="fw-bold text-dark text-truncate">{(bulunan.urun as OzelUrunItem).mamulTipi || "-"}</div>
                              </Col>
                              <Col xs={6} sm={4}>
                                <div className="text-muted small" style={{ fontSize: "11px" }}>Montür / Ayar</div>
                                <div className="fw-bold text-dark">{(bulunan.urun as OzelUrunItem).ayar || "-"}</div>
                              </Col>
                              <Col xs={6} sm={4}>
                                <div className="text-muted small" style={{ fontSize: "11px" }}>Taş Cinsi</div>
                                <div className="fw-bold text-dark">{(bulunan.urun as OzelUrunItem).tasCinsi || "-"}</div>
                              </Col>
                              <Col xs={6} sm={4}>
                                <div className="text-muted small" style={{ fontSize: "11px" }}>Karat / Miktar</div>
                                <div className="fw-bold text-dark">{(bulunan.urun as OzelUrunItem).tasMiktar ?? "-"}</div>
                              </Col>
                              <Col xs={6} sm={4}>
                                <div className="text-muted small" style={{ fontSize: "11px" }}>Taş Berraklık</div>
                                <div className="fw-bold text-dark">{(bulunan.urun as OzelUrunItem).tasSaflik || "-"}</div>
                              </Col>
                              <Col xs={6} sm={4}>
                                <div className="text-muted small" style={{ fontSize: "11px" }}>Taş Renk</div>
                                <div className="fw-bold text-dark">{(bulunan.urun as OzelUrunItem).tasRenk || "-"}</div>
                              </Col>
                            </>
                          )}
                        </Row>
                      </div>

                      {/* Aksiyon Butonları */}
                      <div className="d-flex align-items-center justify-content-end gap-2 pt-1">
                        <Button
                          variant="light"
                          className="border text-secondary fw-semibold px-3 d-flex align-items-center gap-1.5"
                          onClick={handleClear}
                        >
                          <IconRefresh size={16} />
                          <span>Yeni Arama</span>
                        </Button>
                        <Button
                          variant="success"
                          size="lg"
                          onClick={() => setShowPrintModal(true)}
                          className="px-4 fw-bold shadow-sm d-flex align-items-center gap-2"
                        >
                          <IconPrinter size={20} />
                          <span>Etikete Bas</span>
                        </Button>
                      </div>
                    </div>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          </div>
        )}
      </div>

      <LookupModal<{ tip: "altin" | "ozel"; item: AltinUrunItem | OzelUrunItem }>
        show={showLookup}
        title="Ürün Çağır (Ekrandan Seçim)"
        columns={lookupColumns}
        items={combinedLookupItems}
        filterFn={(it, term) => {
          const t = term.toLowerCase();
          return (
            (it.item.barkod ? it.item.barkod.toLowerCase().includes(t) : false) ||
            it.item.grupKodu.toLowerCase().includes(t) ||
            String(it.item.urunNo).includes(t) ||
            (it.item.ureticiFirma ? it.item.ureticiFirma.toLowerCase().includes(t) : false)
          );
        }}
        onSelect={(selected) => handleSelectFromLookup(selected.item, selected.tip)}
        onHide={() => setShowLookup(false)}
      />

      <EtiketYazdirModal
        show={showPrintModal}
        onHide={() => setShowPrintModal(false)}
        title="Etiket Basımı"
        sablon={varsayilanSablon}
        items={printItems}
        yazicilar={yazicilar}
        onAfterPrint={async () => {
          if (!bulunan) return;
          if (bulunan.tip === "altin") {
            await EtiketService.markAltinUrunYazdirildi([bulunan.urun.altinUrunId], true);
          } else {
            await EtiketService.markOzelUrunYazdirildi([(bulunan.urun as OzelUrunItem).ozelUrunId], true);
          }
        }}
      />

      {/* ─── Fotoğraf Büyütme Lightbox Modalı ─── */}
      <Modal
        show={Boolean(showFotoModal && bulunan)}
        onHide={() => setShowFotoModal(false)}
        centered
        size="lg"
        contentClassName="bg-transparent border-0 shadow-none"
      >
        <div
          className="position-relative bg-dark bg-opacity-95 rounded-4 p-3 d-flex flex-column align-items-center shadow-lg border border-secondary border-opacity-50"
          style={{ backdropFilter: "blur(8px)" }}
        >
          {/* Üst Bar: Başlık ve Kapat Butonu */}
          <div className="d-flex align-items-center justify-content-between w-100 mb-2 px-2 text-white">
            <div className="d-flex align-items-center gap-2">
              <span className="fw-bold font-monospace fs-6">
                {bulunan ? `${bulunan.urun.grupKodu}-${bulunan.urun.urunNo}` : ""}
              </span>
              <span className="text-secondary small">
                {bulunan
                  ? (bulunan.tip === "altin"
                    ? (bulunan.urun as AltinUrunItem)?.model
                    : (bulunan.urun as OzelUrunItem)?.mamulTipi) || "Ürün Görseli"
                  : ""}
              </span>
              {fotograflar.length > 1 && (
                <Badge bg="secondary" className="font-monospace">
                  {seciliFotoIndex + 1} / {fotograflar.length}
                </Badge>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowFotoModal(false)}
              className="btn btn-sm btn-outline-light rounded-circle d-flex align-items-center justify-content-center"
              style={{ width: "34px", height: "34px" }}
              title="Kapat"
            >
              <IconX size={20} />
            </button>
          </div>

          {/* Büyük Görsel Alanı */}
          <div
            className="position-relative w-100 d-flex align-items-center justify-content-center bg-black bg-opacity-40 rounded-3 overflow-hidden p-2"
            style={{ maxHeight: "75vh", minHeight: "350px" }}
          >
            {fotograflar.length > 0 && fotograflar[seciliFotoIndex] && (
              <img
                src={resolveImageUrl(fotograflar[seciliFotoIndex])}
                alt="Büyük Ürün Fotoğrafı"
                style={{
                  maxWidth: "100%",
                  maxHeight: "70vh",
                  objectFit: "contain",
                  borderRadius: "6px",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
                }}
              />
            )}

            {/* Sol / Sağ Oklar */}
            {fotograflar.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={handlePrevFoto}
                  className="btn btn-dark position-absolute start-0 top-50 translate-middle-y ms-3 rounded-circle d-flex align-items-center justify-content-center opacity-85 shadow-lg border border-secondary"
                  style={{ width: "44px", height: "44px", zIndex: 10 }}
                  title="Önceki Fotoğraf"
                >
                  <IconChevronLeft size={24} className="text-white" />
                </button>
                <button
                  type="button"
                  onClick={handleNextFoto}
                  className="btn btn-dark position-absolute end-0 top-50 translate-middle-y me-3 rounded-circle d-flex align-items-center justify-content-center opacity-85 shadow-lg border border-secondary"
                  style={{ width: "44px", height: "44px", zIndex: 10 }}
                  title="Sonraki Fotoğraf"
                >
                  <IconChevronRight size={24} className="text-white" />
                </button>
              </>
            )}
          </div>

          {/* Alt Küçük Resim Şeridi */}
          {fotograflar.length > 1 && (
            <div className="d-flex align-items-center gap-2 mt-3 overflow-auto py-1 px-2">
              {fotograflar.map((imgUrl, idx) => (
                <div
                  key={idx}
                  onClick={() => setSeciliFotoIndex(idx)}
                  className={`rounded border p-0.5 cursor-pointer transition-all ${
                    idx === seciliFotoIndex
                      ? "border-warning border-2 scale-110 shadow"
                      : "border-secondary opacity-60 hover-opacity-100"
                  }`}
                  style={{ width: "50px", height: "50px", background: "#fff", cursor: "pointer" }}
                >
                  <img
                    src={resolveImageUrl(imgUrl)}
                    alt={`thumb-${idx}`}
                    style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "3px" }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default BarkodEtiketBasimiPage;

