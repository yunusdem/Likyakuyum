import React, { useState, useEffect, useCallback, useRef } from "react";
import { Container, Row, Col, Card, Form, Button, Alert, InputGroup, Badge } from "react-bootstrap";
import { IconBarcode, IconAlertTriangle, IconCheck, IconBinoculars, IconPrinter, IconSearch } from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import LookupModal, { LookupColumn } from "../../components/common/LookupModal";
import EtiketYazdirModal, { EtiketYazdirItem } from "./EtiketYazdirModal";
import { EtiketService, AltinUrunItem, OzelUrunItem, EtiketSablonItem } from "../../services/etiketService";
import { PrinterService, YaziciItem } from "../../services/printerService";

type Bulunan =
  | { tip: "altin"; urun: AltinUrunItem }
  | { tip: "ozel"; urun: OzelUrunItem };

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
    setBulunan(null);
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
      showNotif("danger", `"${kod}" barkoduna ait ürün bulunamadı.`);
    } finally {
      setAraniyor(false);
    }
  }, [barkodInput]);

  const handleSelectFromLookup = (item: AltinUrunItem | OzelUrunItem, tip: "altin" | "ozel") => {
    if (tip === "altin") setBulunan({ tip: "altin", urun: item as AltinUrunItem });
    else setBulunan({ tip: "ozel", urun: item as OzelUrunItem });
    setBarkodInput((item as any).barkod || "");
    setShowLookup(false);
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
    <Container fluid className="py-3 px-3 px-lg-4">
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

      <Card className="shadow-sm border-0 mb-3">
        <Card.Header className="bg-light py-2 px-3 border-bottom d-flex align-items-center gap-2">
          <IconBarcode size={18} className="text-primary" />
          <span className="fw-bold text-dark">Barkod Okutma / Ürün Çağırma</span>
        </Card.Header>
        <Card.Body className="p-3">
          <Row className="g-2 align-items-end">
            <Col md={7}>
              <Form.Label className="small fw-bold text-secondary">Barkod</Form.Label>
              <InputGroup>
                <InputGroup.Text><IconBarcode size={16} /></InputGroup.Text>
                <Form.Control
                  ref={barkodRef}
                  autoFocus
                  size="lg"
                  value={barkodInput}
                  onChange={(e) => setBarkodInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAra();
                    }
                  }}
                  className="font-monospace"
                />
                <Button variant="primary" onClick={handleAra} disabled={aranıyor}>
                  <IconSearch size={16} className="me-1" />
                  Ara
                </Button>
                <Button variant="outline-primary" onClick={() => setShowLookup(true)} title="Ekrandan Çağır (Dürbün)">
                  <IconBinoculars size={16} />
                </Button>
              </InputGroup>
            </Col>
            <Col md={5} className="d-flex justify-content-end">
              <Button variant="success" size="lg" onClick={() => (bulunan ? setShowPrintModal(true) : showNotif("warning", "Önce bir ürün bulun veya seçin."))} disabled={!bulunan}>
                <IconPrinter size={18} className="me-2" />
                Etikete Bas
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {bulunan && (
        <Card className="shadow-sm border-0 mb-3">
          <Card.Header className="bg-light py-2 px-3 border-bottom d-flex align-items-center justify-content-between">
            <span className="fw-bold text-dark">Bulunan Ürün</span>
            <Badge bg={bulunan.tip === "altin" ? "warning" : "info"}>{bulunan.tip === "altin" ? "Altın / Sarrafiye" : "Özel / Pırlanta"}</Badge>
          </Card.Header>
          <Card.Body className="p-3">
            <Row className="gy-2">
              <Col md={3}><span className="text-muted small">Grup-No:</span> <strong>{bulunan.urun.grupKodu}-{bulunan.urun.urunNo}</strong></Col>
              <Col md={3}><span className="text-muted small">Barkod:</span> <strong className="font-monospace">{bulunan.urun.barkod || "-"}</strong></Col>
              <Col md={3}><span className="text-muted small">Üretici:</span> <strong>{bulunan.urun.ureticiFirma || "-"}</strong></Col>
              <Col md={3}>
                <span className="text-muted small">Fiyat:</span>{" "}
                <strong>{Number(bulunan.urun.satisFiyati || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} {bulunan.urun.satisParaKodu}</strong>
              </Col>
              {bulunan.tip === "altin" ? (
                <>
                  <Col md={3}><span className="text-muted small">Model:</span> <strong>{(bulunan.urun as AltinUrunItem).model || "-"}</strong></Col>
                  <Col md={3}><span className="text-muted small">Ayar:</span> <strong>{(bulunan.urun as AltinUrunItem).ayar || "-"}</strong></Col>
                  <Col md={3}><span className="text-muted small">Gram:</span> <strong>{(bulunan.urun as AltinUrunItem).miktar}</strong></Col>
                  <Col md={3}><span className="text-muted small">Has:</span> <strong>{(bulunan.urun as AltinUrunItem).hasGram}</strong></Col>
                </>
              ) : (
                <>
                  <Col md={3}><span className="text-muted small">Mamul Tipi:</span> <strong>{(bulunan.urun as OzelUrunItem).mamulTipi || "-"}</strong></Col>
                  <Col md={3}><span className="text-muted small">Taş Cinsi:</span> <strong>{(bulunan.urun as OzelUrunItem).tasCinsi || "-"}</strong></Col>
                  <Col md={3}><span className="text-muted small">Karat:</span> <strong>{(bulunan.urun as OzelUrunItem).tasMiktar ?? "-"}</strong></Col>
                  <Col md={3}><span className="text-muted small">Berraklık:</span> <strong>{(bulunan.urun as OzelUrunItem).tasSaflik || "-"}</strong></Col>
                </>
              )}
            </Row>
          </Card.Body>
        </Card>
      )}

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
    </Container>
  );
};

export default BarkodEtiketBasimiPage;
