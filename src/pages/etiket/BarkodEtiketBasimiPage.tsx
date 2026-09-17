import React, { useState, useEffect, useCallback, useRef } from "react";
import { Row, Col, Card, Form, Button, Alert, InputGroup, Badge } from "react-bootstrap";
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
  const [aranıyor, setAraniyor] = useState(false);

  const [altinList, setAltinList] = useState<AltinUrunItem[]>([]);
  const [ozelList, setOzelList] = useState<OzelUrunItem[]>([]);
  const [sablonlar, setSablonlar] = useState<EtiketSablonItem[]>([]);
  const [yazicilar, setYazicilar] = useState<YaziciItem[]>([]);
  const [notification, setNotification] = useState<{ type: "success" | "danger" | "warning"; message: string } | null>(null);

  const [showLookup, setShowLookup] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

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
        showNotif("success", `Bulundu: ${altin.grupKodu}-${altin.urunNo} (${altin.model || "Sarrafiye"})`);
        return;
      }
      const ozel = await EtiketService.getOzelUrunByBarkod(kod).catch(() => null);
      if (ozel) {
        setBulunan({ tip: "ozel", urun: ozel });
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
    setBarkodInput((item as any).barkod || `${item.grupKodu}${item.urunNo}`);
    setShowLookup(false);
  };

  const handleClear = () => {
    setBulunan(null);
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
        pageIcon={<IconBarcode size={20} />}
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

      {/* Ana Kapsayıcı: Başlangıçta tam ortalı, ürün seçilince yukarı kayan yapı */}
      <div
        className="d-flex flex-column align-items-center w-100 px-3"
        style={{
          minHeight: bulunan ? "auto" : "calc(80vh - 120px)",
          justifyContent: bulunan ? "flex-start" : "center",
          paddingTop: bulunan ? "1.5rem" : "0",
          transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Ortalanmış Barkod Arama Kartı */}
        <div
          style={{
            width: "100%",
            maxWidth: bulunan ? "840px" : "640px",
            transition: "all 0.35s ease",
          }}
        >
          <Card
            className="border shadow-sm rounded-4 overflow-hidden mb-3"
            style={{
              borderColor: bulunan ? "#e2e8f0" : "#cbd5e1",
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
                    Barkod okutunuz, manuel giriniz veya dürbün ikonu ile listeden seçiniz.
                  </p>
                </div>
              )}

              <div className="d-flex align-items-center gap-2">
                <InputGroup size={bulunan ? "lg" : "lg"} className="shadow-xs rounded-3 overflow-hidden">
                  <InputGroup.Text className="bg-light border-end-0 px-3 text-secondary">
                    <IconBarcode size={20} />
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
                    className="font-monospace fw-bold border-start-0 border-end-0"
                    style={{ fontSize: "16px", letterSpacing: "0.5px" }}
                  />
                  <Button
                    variant="primary"
                    onClick={handleAra}
                    disabled={aranıyor}
                    className="px-3 d-flex align-items-center gap-1.5 fw-semibold"
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
                    <IconBinoculars size={18} className="text-primary" />
                  </Button>
                </InputGroup>

                {bulunan && (
                  <Button
                    variant="outline-secondary"
                    size="lg"
                    onClick={handleClear}
                    title="Yeni Barkod Okut / Temizle"
                    className="px-3 d-flex align-items-center justify-content-center"
                    style={{ height: "48px" }}
                  >
                    <IconRefresh size={18} />
                  </Button>
                )}
              </div>
            </Card.Body>
          </Card>
        </div>

        {/* Ürün Seçildiğinde Altında Açılan Kart */}
        {bulunan && (
          <div
            className="w-100 fade-in-scale"
            style={{
              maxWidth: "840px",
              animation: "fadeInUp 0.3s ease-out",
            }}
          >
            <Card className="border shadow-sm rounded-4 overflow-hidden mb-3">
              {/* Kart Başlığı */}
              <Card.Header className="bg-light bg-opacity-75 border-bottom py-2.5 px-3 px-md-4 d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center gap-2">
                  {bulunan.tip === "altin" ? (
                    <IconCoins size={20} className="text-warning flex-shrink-0" />
                  ) : (
                    <IconDiamond size={20} className="text-info flex-shrink-0" />
                  )}
                  <div>
                    <span className="fw-bold text-dark fs-6 me-2">
                      {bulunan.urun.grupKodu}-{bulunan.urun.urunNo}
                    </span>
                    <span className="text-secondary small fw-semibold">
                      {bulunan.tip === "altin"
                        ? (bulunan.urun as AltinUrunItem).model || "Sarrafiye / Altın"
                        : (bulunan.urun as OzelUrunItem).mamulTipi || "Özel / Pırlanta"}
                    </span>
                  </div>
                </div>

                <div className="d-flex align-items-center gap-2">
                  <Badge bg={bulunan.tip === "altin" ? "warning" : "info"} className="px-2.5 py-1.5 fs-7">
                    {bulunan.tip === "altin" ? "Altın / Sarrafiye" : "Özel / Pırlanta"}
                  </Badge>
                  {bulunan.urun.satildi && (
                    <Badge bg="danger" className="px-2 py-1">Satıldı</Badge>
                  )}
                </div>
              </Card.Header>

              {/* Kart Gövdesi: Fotoğraf + Detay Bilgileri */}
              <Card.Body className="p-3 p-md-4">
                <Row className="g-4 align-items-stretch">
                  {/* Sol Sütun: Ürün Fotoğrafı */}
                  <Col md={5} lg={4}>
                    <div
                      className="rounded-3 border d-flex flex-column align-items-center justify-content-center position-relative overflow-hidden bg-light"
                      style={{
                        minHeight: "220px",
                        height: "100%",
                        boxShadow: "inset 0 2px 4px rgba(0,0,0,0.02)",
                      }}
                    >
                      {bulunan.urun.resim ? (
                        <img
                          src={resolveImageUrl(bulunan.urun.resim)}
                          alt="Ürün Fotoğrafı"
                          style={{
                            width: "100%",
                            height: "100%",
                            maxHeight: "240px",
                            objectFit: "contain",
                            padding: "6px",
                          }}
                        />
                      ) : (
                        <div className="d-flex flex-column align-items-center text-muted p-3 text-center">
                          <div
                            className="rounded-circle bg-white shadow-xs p-3 mb-2 d-flex align-items-center justify-content-center"
                            style={{ width: "64px", height: "64px" }}
                          >
                            <IconPhoto size={32} className="text-secondary opacity-50" />
                          </div>
                          <span className="small fw-semibold text-secondary">Ürün Fotoğrafı Yok</span>
                        </div>
                      )}

                      {/* Barkod Etiketi Overlay */}
                      <div
                        className="position-absolute bottom-0 start-0 end-0 bg-dark bg-opacity-75 text-white py-1 px-2 text-center small font-monospace"
                        style={{ fontSize: "11px", letterSpacing: "0.5px" }}
                      >
                        {bulunan.urun.barkod || `${bulunan.urun.grupKodu}-${bulunan.urun.urunNo}`}
                      </div>
                    </div>
                  </Col>

                  {/* Sağ Sütun: Ürün Detayları */}
                  <Col md={7} lg={8}>
                    <div className="d-flex flex-column justify-content-between h-100 gap-3">
                      {/* Fiyat Öne Çıkarma Kutusu */}
                      <div
                        className="rounded-3 p-3 d-flex align-items-center justify-content-between border"
                        style={{
                          background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
                          borderColor: "#86efac",
                        }}
                      >
                        <div>
                          <div className="text-success small fw-bold text-uppercase" style={{ fontSize: "11px", letterSpacing: "0.5px" }}>
                            Satış Fiyatı
                          </div>
                          <div className="fs-3 fw-bolder text-dark">
                            {Number(bulunan.urun.satisFiyati || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}{" "}
                            <span className="fs-6 fw-bold text-success">{bulunan.urun.satisParaKodu}</span>
                          </div>
                        </div>
                        <div className="text-end">
                          <span className="badge bg-success bg-opacity-20 text-success border border-success border-opacity-25 px-2.5 py-1 rounded-pill">
                            <IconSparkles size={13} className="me-1" /> Aktif Satış
                          </span>
                        </div>
                      </div>

                      {/* Bilgi Grid Alanı */}
                      <div className="bg-light rounded-3 p-3 border">
                        <Row className="g-2.5">
                          <Col xs={6} sm={4}>
                            <div className="text-muted" style={{ fontSize: "11.5px" }}>Grup / No</div>
                            <div className="fw-bold text-dark font-monospace">{bulunan.urun.grupKodu}-{bulunan.urun.urunNo}</div>
                          </Col>

                          <Col xs={6} sm={4}>
                            <div className="text-muted" style={{ fontSize: "11.5px" }}>Barkod</div>
                            <div className="fw-bold text-dark font-monospace">{bulunan.urun.barkod || "-"}</div>
                          </Col>

                          <Col xs={6} sm={4}>
                            <div className="text-muted" style={{ fontSize: "11.5px" }}>Üretici Firma</div>
                            <div className="fw-bold text-dark text-truncate">{bulunan.urun.ureticiFirma || "-"}</div>
                          </Col>

                          {bulunan.tip === "altin" ? (
                            <>
                              <Col xs={6} sm={4}>
                                <div className="text-muted" style={{ fontSize: "11.5px" }}>Model</div>
                                <div className="fw-bold text-dark text-truncate">{(bulunan.urun as AltinUrunItem).model || "-"}</div>
                              </Col>
                              <Col xs={6} sm={4}>
                                <div className="text-muted" style={{ fontSize: "11.5px" }}>Ayar</div>
                                <div className="fw-bold text-dark">{(bulunan.urun as AltinUrunItem).ayar || "-"}</div>
                              </Col>
                              <Col xs={6} sm={4}>
                                <div className="text-muted" style={{ fontSize: "11.5px" }}>Gram / Miktar</div>
                                <div className="fw-bold text-dark">{(bulunan.urun as AltinUrunItem).miktar} gr</div>
                              </Col>
                              <Col xs={6} sm={4}>
                                <div className="text-muted" style={{ fontSize: "11.5px" }}>Has Gram</div>
                                <div className="fw-bold text-dark">{(bulunan.urun as AltinUrunItem).hasGram} gr</div>
                              </Col>
                              <Col xs={6} sm={4}>
                                <div className="text-muted" style={{ fontSize: "11.5px" }}>İşçilik Tutarı</div>
                                <div className="fw-bold text-dark">
                                  {(bulunan.urun as AltinUrunItem).satisIscilikTutari || 0} {(bulunan.urun as AltinUrunItem).satisParaKodu}
                                </div>
                              </Col>
                              <Col xs={6} sm={4}>
                                <div className="text-muted" style={{ fontSize: "11.5px" }}>Banko</div>
                                <div className="fw-bold text-dark">{(bulunan.urun as AltinUrunItem).banko || "-"}</div>
                              </Col>
                            </>
                          ) : (
                            <>
                              <Col xs={6} sm={4}>
                                <div className="text-muted" style={{ fontSize: "11.5px" }}>Mamul Tipi</div>
                                <div className="fw-bold text-dark text-truncate">{(bulunan.urun as OzelUrunItem).mamulTipi || "-"}</div>
                              </Col>
                              <Col xs={6} sm={4}>
                                <div className="text-muted" style={{ fontSize: "11.5px" }}>Montür / Ayar</div>
                                <div className="fw-bold text-dark">{(bulunan.urun as OzelUrunItem).ayar || "-"}</div>
                              </Col>
                              <Col xs={6} sm={4}>
                                <div className="text-muted" style={{ fontSize: "11.5px" }}>Taş Cinsi</div>
                                <div className="fw-bold text-dark">{(bulunan.urun as OzelUrunItem).tasCinsi || "-"}</div>
                              </Col>
                              <Col xs={6} sm={4}>
                                <div className="text-muted" style={{ fontSize: "11.5px" }}>Karat / Miktar</div>
                                <div className="fw-bold text-dark">{(bulunan.urun as OzelUrunItem).tasMiktar ?? "-"}</div>
                              </Col>
                              <Col xs={6} sm={4}>
                                <div className="text-muted" style={{ fontSize: "11.5px" }}>Taş Berraklık</div>
                                <div className="fw-bold text-dark">{(bulunan.urun as OzelUrunItem).tasSaflik || "-"}</div>
                              </Col>
                              <Col xs={6} sm={4}>
                                <div className="text-muted" style={{ fontSize: "11.5px" }}>Taş Renk</div>
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
                          className="border text-secondary fw-semibold px-3"
                          onClick={handleClear}
                        >
                          <IconRefresh size={16} className="me-1.5" />
                          Yeni Arama
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
    </div>
  );
};

export default BarkodEtiketBasimiPage;
