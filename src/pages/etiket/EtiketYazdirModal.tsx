import React, { useEffect, useRef, useState } from "react";
import { Modal, Button, Form, Row, Col } from "react-bootstrap";
import { IconPrinter, IconX } from "@tabler/icons-react";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import { EtiketSablonItem, EtiketSablonAlan } from "../../services/etiketService";
import { PrinterService, YaziciItem } from "../../services/printerService";

export interface EtiketYazdirItem {
  id: number | string;
  barkod: string;
  fields: Record<string, string>;
}

export interface EtiketYazdirModalProps {
  show: boolean;
  onHide: () => void;
  title: string;
  sablon: EtiketSablonItem | null;
  items: EtiketYazdirItem[];
  yazicilar?: YaziciItem[];
  onAfterPrint?: () => void;
}

const DEFAULT_ALANLAR: EtiketSablonAlan[] = [
  { key: "grupUrunNo", ad: "Ürün No", aktif: true, sira: 1 },
  { key: "mamulTipi", ad: "Mamul", aktif: true, sira: 2 },
  { key: "ayar", ad: "Ayar/Milyem", aktif: true, sira: 3 },
  { key: "has", ad: "Has", aktif: true, sira: 4 },
  { key: "gram", ad: "Gr", aktif: true, sira: 5 },
  { key: "tas", ad: "Taş/Karat", aktif: true, sira: 6 },
  { key: "fiyat", ad: "Fiyat", aktif: true, sira: 7 },
];

const BarcodeSvg: React.FC<{ value: string; tip: string }> = ({ value, tip }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  useEffect(() => {
    if (!value) return;
    if (tip === "QR") {
      QRCode.toDataURL(value, { margin: 0, width: 96 })
        .then(setQrDataUrl)
        .catch(() => setQrDataUrl(""));
    } else if (svgRef.current) {
      try {
        JsBarcode(svgRef.current, value, {
          format: "CODE128",
          displayValue: true,
          fontSize: 11,
          height: 34,
          margin: 2,
        });
      } catch {
        /* geçersiz barkod değeri - sessizce yoksay */
      }
    }
  }, [value, tip]);

  if (!value) return <span className="text-muted small">Barkod yok</span>;
  if (tip === "QR") {
    return qrDataUrl ? <img src={qrDataUrl} alt={value} style={{ width: 60, height: 60 }} /> : null;
  }
  return <svg ref={svgRef} />;
};

export const EtiketYazdirModal: React.FC<EtiketYazdirModalProps> = ({
  show,
  onHide,
  title,
  sablon,
  items,
  yazicilar: propYazicilar = [],
  onAfterPrint,
}) => {
  const [kopyaSayisi, setKopyaSayisi] = useState(1);
  const [yazicilar, setYazicilar] = useState<YaziciItem[]>(propYazicilar);
  const [yaziciId, setYaziciId] = useState<number | null>(null);

  useEffect(() => {
    if (propYazicilar && propYazicilar.length > 0) {
      setYazicilar(propYazicilar);
      if (!yaziciId) setYaziciId(propYazicilar[0].id);
    } else if (show) {
      PrinterService.getYazicilar()
        .then((list) => {
          if (list && list.length > 0) {
            setYazicilar(list);
            if (!yaziciId) setYaziciId(list[0].id);
          }
        })
        .catch(() => {});
    }
  }, [propYazicilar, show]);

  useEffect(() => {
    if (show) {
      setKopyaSayisi(1);
    }
  }, [show]);

  const genislik = sablon?.genislikMm || 40;
  const yukseklik = sablon?.yukseklikMm || 25;
  const kuyrukPayi = sablon?.kuyrukPayiMm || 0;
  const barkodTipi = sablon?.barkodTipi || "CODE128";
  const alanlar = (sablon?.alanlar && sablon.alanlar.length > 0 ? sablon.alanlar : DEFAULT_ALANLAR)
    .filter((a) => a.aktif)
    .sort((a, b) => a.sira - b.sira);
  const logoKonumu = sablon?.logoKonumu || "sol-ust";

  const handlePrint = () => {
    window.print();
    onAfterPrint?.();
  };

  const printItems: EtiketYazdirItem[] = [];
  for (const it of items) {
    for (let i = 0; i < kopyaSayisi; i++) printItems.push(it);
  }

  return (
    <Modal show={show} onHide={onHide} size="lg" centered backdrop="static">
      <Modal.Header closeButton className="py-2.5 bg-light">
        <Modal.Title className="fs-6 fw-bold text-dark d-flex align-items-center gap-2">
          <IconPrinter size={20} className="text-primary" />
          {title}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-3">
        <Row className="gx-3 gy-2 mb-3">
          <Col md={4}>
            <Form.Label className="small fw-bold text-secondary">Baskı Adedi (her ürün için)</Form.Label>
            <Form.Control
              type="number"
              size="sm"
              min={1}
              value={kopyaSayisi}
              onChange={(e) => setKopyaSayisi(Math.max(1, Number(e.target.value) || 1))}
            />
          </Col>
          <Col md={8}>
            <Form.Label className="small fw-bold text-secondary">Yazıcı Seçimi</Form.Label>
            <Form.Select size="sm" value={yaziciId ?? ""} onChange={(e) => setYaziciId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Varsayılan Yazıcı (Tarayıcı Yazdırma İletişim Kutusu)</option>
              {yazicilar.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.ad} {y.cihazAdi ? `(${y.cihazAdi})` : ""}
                </option>
              ))}
            </Form.Select>
          </Col>
        </Row>

        <div className="small text-muted mb-2">
          Toplam <strong>{items.length}</strong> ürün × <strong>{kopyaSayisi}</strong> kopya ={" "}
          <strong>{printItems.length}</strong> etiket yazdırılacak. Şablon:{" "}
          <strong>{sablon?.ad || "Varsayılan (40×25mm, CODE128)"}</strong>
        </div>

        <div
          id="etiket-print-root"
          className="border rounded p-2 d-flex flex-wrap gap-2"
          style={{ maxHeight: "360px", overflowY: "auto", background: "#f8f9fa" }}
        >
          {printItems.map((it, idx) => (
            <div
              key={`${it.id}-${idx}`}
              className="etiket-label bg-white border border-dark d-flex flex-column justify-content-between p-1"
              style={{
                width: `${genislik}mm`,
                height: `${yukseklik + kuyrukPayi}mm`,
                fontSize: "7px",
                lineHeight: 1.1,
                boxSizing: "border-box",
              }}
            >
              <div className="d-flex justify-content-between align-items-start">
                {logoKonumu !== "yok" && (
                  <div
                    className="border border-secondary text-secondary d-flex align-items-center justify-content-center"
                    style={{ width: "10mm", height: "5mm", fontSize: "5px", order: logoKonumu.includes("sag") ? 2 : 0 }}
                  >
                    LOGO
                  </div>
                )}
                <div className="flex-grow-1 ps-1">
                  {alanlar.map((a) => (
                    <div key={a.key} className="d-flex justify-content-between">
                      <span className="text-muted">{a.ad}:</span>
                      <span className="fw-bold ms-1">{it.fields[a.key] ?? "-"}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="d-flex justify-content-center mt-1">
                <BarcodeSvg value={it.barkod} tip={barkodTipi} />
              </div>
            </div>
          ))}
        </div>

        <style>{`
          @media print {
            body * { visibility: hidden; }
            #etiket-print-root, #etiket-print-root * { visibility: visible; }
            #etiket-print-root {
              position: absolute; left: 0; top: 0; max-height: none !important; overflow: visible !important;
              background: #fff !important; border: none !important;
            }
            .etiket-label { break-inside: avoid; }
          }
        `}</style>
      </Modal.Body>
      <Modal.Footer className="py-2 bg-light d-flex justify-content-between align-items-center">
        <span className="small text-muted">Toplam: {items.length} ürün</span>
        <div className="d-flex gap-2">
          <Button variant="secondary" size="sm" onClick={onHide}>
            <IconX size={14} className="me-1" />
            Kapat
          </Button>
          <Button variant="primary" size="sm" onClick={handlePrint} disabled={items.length === 0}>
            <IconPrinter size={14} className="me-1" />
            Yazdır
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default EtiketYazdirModal;
