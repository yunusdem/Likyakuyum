import React, { useEffect, useRef, useState } from "react";
import { Modal, Button, Form, Row, Col } from "react-bootstrap";
import { IconPrinter, IconX, IconAdjustmentsHorizontal } from "@tabler/icons-react";
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
  { alan: "grupUrunNo", key: "grupUrunNo", ad: "Ürün No", aktif: true, sira: 1 },
  { alan: "mamulTipi", key: "mamulTipi", ad: "Mamul", aktif: true, sira: 2 },
  { alan: "ayar", key: "ayar", ad: "Ayar/Milyem", aktif: true, sira: 3 },
  { alan: "has", key: "has", ad: "Has", aktif: true, sira: 4 },
  { alan: "gram", key: "gram", ad: "Gr", aktif: true, sira: 5 },
  { alan: "tas", key: "tas", ad: "Taş/Karat", aktif: true, sira: 6 },
  { alan: "fiyat", key: "fiyat", ad: "Fiyat", aktif: true, sira: 7 },
];

function getBarcodeSvgString(
  value: string,
  format: string,
  widthMm: number,
  heightMm: number,
  showText = true,
  barcodeText?: string
): string {
  try {
    const svgNode = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const displayVal = value || "123456789";
    const customText = (barcodeText !== undefined && barcodeText.trim() !== "") ? barcodeText : displayVal;
    JsBarcode(svgNode, displayVal, {
      format: format === "EAN13" ? "EAN13" : "CODE128",
      width: 1.5,
      height: Math.max(12, heightMm * 3.78 * 0.7),
      displayValue: showText !== false,
      text: customText,
      fontSize: 9,
      fontOptions: "bold",
      margin: 1,
      textMargin: 1,
    });
    const wAttr = svgNode.getAttribute("width") || "100";
    const hAttr = svgNode.getAttribute("height") || "40";
    svgNode.setAttribute("viewBox", `0 0 ${wAttr} ${hAttr}`);
    svgNode.removeAttribute("width");
    svgNode.removeAttribute("height");
    svgNode.setAttribute("preserveAspectRatio", "none");
    svgNode.setAttribute("style", "width: 100%; height: 100%; display: block; shape-rendering: crispEdges;");
    return svgNode.outerHTML;
  } catch {
    return `<div style="font-size:8px;text-align:center;width:100%;height:100%;">${value || "BARCODE"}</div>`;
  }
}

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
          fontSize: 10,
          fontOptions: "bold",
          height: 30,
          margin: 1,
          textMargin: 1,
        });
        const svg = svgRef.current;
        const wAttr = svg.getAttribute("width") || "100";
        const hAttr = svg.getAttribute("height") || "40";
        svg.setAttribute("viewBox", `0 0 ${wAttr} ${hAttr}`);
        svg.removeAttribute("width");
        svg.removeAttribute("height");
        svg.setAttribute("style", "width: 100%; height: 100%; display: block; shape-rendering: crispEdges;");
        svg.setAttribute("preserveAspectRatio", "none");
      } catch {
        /* geçersiz barkod değeri */
      }
    }
  }, [value, tip]);

  if (!value) return <span className="text-muted small">Barkod yok</span>;
  if (tip === "QR") {
    return qrDataUrl ? <img src={qrDataUrl} alt={value} style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : null;
  }
  return <svg ref={svgRef} style={{ width: "100%", height: "100%", display: "block" }} />;
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
  const [ustKaydirma, setUstKaydirma] = useState<number>(sablon?.yaziciUstKaydirmaMm ?? -0.8);
  const [solKaydirma, setSolKaydirma] = useState<number>(sablon?.yaziciSolKaydirmaMm ?? 0);

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
      setUstKaydirma(sablon?.yaziciUstKaydirmaMm ?? -0.8);
      setSolKaydirma(sablon?.yaziciSolKaydirmaMm ?? 0);
    }
  }, [show, sablon]);

  const genislik = sablon?.genislikMm || 40;
  const yukseklik = sablon?.yukseklikMm || 25;
  const kuyrukPayi = sablon?.kuyrukPayiMm || 0;
  const barkodTipi = sablon?.barkodTipi || "CODE128";
  const alanlar = (sablon?.alanlar && sablon.alanlar.length > 0 ? sablon.alanlar : DEFAULT_ALANLAR)
    .filter((a) => a.aktif !== false)
    .sort((a, b) => (a.sira ?? 0) - (b.sira ?? 0));
  const logoKonumu = sablon?.logoKonumu || "sol-ust";

  const printItems: EtiketYazdirItem[] = [];
  for (const it of items) {
    for (let i = 0; i < kopyaSayisi; i++) printItems.push(it);
  }

  const handlePrint = () => {
    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
      window.print();
      onAfterPrint?.();
      return;
    }

    const labelHtmls = printItems.map((it) => {
      const isVisualDesign = alanlar.some((a) => a.x !== undefined && a.y !== undefined);
      if (isVisualDesign) {
        const elemsHtml = alanlar.map((elem) => {
          const valKey = elem.key || elem.fieldKey || elem.alan;
          let itemVal = it.fields[valKey];
          if (itemVal === undefined) {
            if (valKey === "barkod" || valKey === "barcode") itemVal = it.barkod;
            else if (valKey === "grupUrunNo" || valKey === "urunNo") itemVal = it.fields["grupUrunNo"] || it.fields["urunNo"] || "";
            else if (valKey === "gram" || valKey === "gramaj" || valKey === "hasGram") itemVal = it.fields["gram"] || it.fields["gramaj"] || it.fields["hasGram"] || "";
            else if (valKey === "ayar") itemVal = it.fields["ayar"] || "";
            else if (valKey === "satisFiyati" || valKey === "fiyat") itemVal = it.fields["satisFiyati"] || it.fields["fiyat"] || "";
            else itemVal = "-";
          }
          const elemType = elem.type || elem.etiketElementTipi;
          const sampleVal = (elemType === "text")
            ? (elem.text || elem.customText || elem.ad || "")
            : `${elem.prefix || ""}${itemVal}${elem.suffix || ""}`;

          const widthMm = elem.width ?? elem.genislik ?? 15;
          const heightMm = elem.height ?? elem.yukseklik ?? 4;
          const rot = elem.rotation || 0;
          const alignSelf = elem.textAlign === "right" ? "flex-end" : elem.textAlign === "center" ? "center" : "flex-start";

          let content = "";
          if (elemType === "barcode") {
            content = getBarcodeSvgString(it.barkod, "CODE128", widthMm, heightMm, elem.showBarcodeText ?? elem.showText ?? true, elem.barcodeText);
          } else if (elemType === "qrcode" || elemType === "qr") {
            content = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:7pt;font-weight:bold;">[QR: ${it.barkod}]</div>`;
          } else {
            content = `<span style="width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block;line-height:1.1; -webkit-text-size-adjust: 100% !important; text-size-adjust: 100% !important;">${sampleVal}</span>`;
          }

          return `
            <div style="
              position: absolute;
              left: ${(elem.x || 0) + solKaydirma}mm;
              top: ${(elem.y || 0) - ustKaydirma}mm;
              width: ${widthMm}mm;
              height: ${heightMm}mm;
              font-size: ${elem.fontSize || 7.5}pt;
              font-weight: ${elem.fontWeight === "bold" ? "bold" : (elem.fontWeight || "normal")};
              font-family: ${elem.fontFamily || "Arial, sans-serif"};
              color: ${elem.color || "#000000"};
              background-color: ${elem.backgroundColor || "transparent"};
              transform: rotate(${rot}deg);
              transform-origin: center center;
              display: flex;
              align-items: center;
              justify-content: ${alignSelf};
              text-align: ${elem.textAlign || "left"};
              white-space: nowrap;
              overflow: hidden;
              line-height: 1.1;
              box-sizing: border-box;
              -webkit-text-size-adjust: 100% !important;
              text-size-adjust: 100% !important;
            ">
              ${content}
            </div>
          `;
        }).join("\n");

        return `
          <div class="label-page" style="
            width: ${genislik}mm;
            height: ${yukseklik}mm;
            position: relative;
            overflow: hidden;
            background: #ffffff;
            box-sizing: border-box;
            page-break-after: always;
            break-after: page;
          ">
            ${elemsHtml}
          </div>
        `;
      }

      return `
        <div class="label-page" style="
          width: ${genislik}mm;
          height: ${yukseklik + kuyrukPayi}mm;
          position: relative;
          overflow: hidden;
          background: #ffffff;
          box-sizing: border-box;
          font-size: 7px;
          line-height: 1.1;
          padding: 1mm;
          padding-top: ${Math.max(0, 1 - ustKaydirma)}mm;
          padding-left: ${Math.max(0, 1 + solKaydirma)}mm;
          page-break-after: always;
          break-after: page;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        ">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            ${logoKonumu !== "yok" ? `<div style="width:10mm;height:5mm;border:0.2mm solid #000;font-size:5px;display:flex;align-items:center;justify-content:center;order:${logoKonumu.includes("sag") ? 2 : 0}">LOGO</div>` : ""}
            <div style="flex-grow:1;padding-left:1mm;">
              ${alanlar.map((a) => `<div style="display:flex;justify-content:space-between;"><span style="color:#666;">${a.ad}:</span><span style="font-weight:bold;">${it.fields[a.key] ?? "-"}</span></div>`).join("")}
            </div>
          </div>
          <div style="display:flex;justify-content:center;margin-top:1mm;">
            ${getBarcodeSvgString(it.barkod, barkodTipi, genislik * 0.8, 8, true)}
          </div>
        </div>
      `;
    }).join("\n");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${title}</title>
          <style>
            @page {
              size: ${genislik}mm ${yukseklik + kuyrukPayi}mm;
              margin: 0 !important;
            }
            *, *::before, *::after {
              box-sizing: border-box !important;
              margin: 0 !important;
              padding: 0 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
              -webkit-text-size-adjust: 100% !important;
              text-size-adjust: 100% !important;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              width: ${genislik}mm !important;
              height: ${yukseklik + kuyrukPayi}mm !important;
              background: #ffffff !important;
              overflow: hidden !important;
            }
            .label-page {
              width: ${genislik}mm !important;
              height: ${yukseklik + kuyrukPayi}mm !important;
              position: absolute !important;
              top: 0 !important;
              left: 0 !important;
            }
            .label-page:last-child {
              page-break-after: avoid !important;
              break-after: avoid !important;
            }
          </style>
        </head>
        <body>
          ${labelHtmls}
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.focus();
                window.print();
                setTimeout(function() { window.close(); }, 700);
              }, 250);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    onAfterPrint?.();
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered backdrop="static">
      <Modal.Header closeButton className="py-2.5 bg-light">
        <Modal.Title className="fs-6 fw-bold text-dark d-flex align-items-center gap-2">
          <IconPrinter size={20} className="text-primary" />
          {title}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-3">
        {/* Yazıcı ve Kopya Seçimi */}
        <Row className="gx-3 gy-2 mb-2">
          <Col md={3}>
            <Form.Label className="small fw-bold text-secondary mb-1">Baskı Adedi (ürün başı)</Form.Label>
            <Form.Control
              type="number"
              size="sm"
              min={1}
              value={kopyaSayisi}
              onChange={(e) => setKopyaSayisi(Math.max(1, Number(e.target.value) || 1))}
            />
          </Col>
          <Col md={9}>
            <Form.Label className="small fw-bold text-secondary mb-1">Yazıcı Seçimi</Form.Label>
            <Form.Select size="sm" value={yaziciId ?? ""} onChange={(e) => setYaziciId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Varsayılan Yazıcı (Sistem İletişim Kutusu)</option>
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

        {/* Etiket Önizleme Alanı */}
        <div
          id="etiket-print-root"
          className="border rounded p-2 d-flex flex-wrap gap-2 mb-3"
          style={{ maxHeight: "300px", overflowY: "auto", background: "#f8f9fa" }}
        >
          {printItems.map((it, idx) => {
            const isVisualDesign = alanlar.some((a) => a.x !== undefined && a.y !== undefined);

            if (isVisualDesign) {
              return (
                <div
                  key={`${it.id}-${idx}`}
                  className="etiket-label bg-white border border-dark position-relative"
                  style={{
                    width: `${genislik}mm`,
                    height: `${yukseklik}mm`,
                    boxSizing: "border-box",
                    overflow: "hidden",
                    color: "#000000",
                    pageBreakInside: "avoid",
                  }}
                >
                  {alanlar.map((elem) => {
                    const valKey = elem.key || elem.fieldKey || elem.alan;
                    let itemVal = it.fields[valKey];
                    if (itemVal === undefined) {
                      if (valKey === "barkod" || valKey === "barcode") itemVal = it.barkod;
                      else if (valKey === "grupUrunNo" || valKey === "urunNo") itemVal = it.fields["grupUrunNo"] || it.fields["urunNo"] || "";
                      else if (valKey === "gram" || valKey === "gramaj" || valKey === "hasGram") itemVal = it.fields["gram"] || it.fields["gramaj"] || it.fields["hasGram"] || "";
                      else if (valKey === "ayar") itemVal = it.fields["ayar"] || "";
                      else if (valKey === "satisFiyati" || valKey === "fiyat") itemVal = it.fields["satisFiyati"] || it.fields["fiyat"] || "";
                      else itemVal = "-";
                    }
                    const elemType = elem.type || elem.etiketElementTipi;
                    const sampleVal = (elemType === "text")
                      ? (elem.text || elem.customText || elem.ad || "")
                      : `${elem.prefix || ""}${itemVal}${elem.suffix || ""}`;

                    const widthMm = elem.width ?? elem.genislik ?? 15;
                    const heightMm = elem.height ?? elem.yukseklik ?? 4;

                    return (
                      <div
                        key={elem.id || elem.key || elem.alan}
                        className="position-absolute d-flex align-items-center"
                        style={{
                          left: `${(elem.x || 0) + solKaydirma}mm`,
                          top: `${(elem.y || 0) - ustKaydirma}mm`,
                          width: `${widthMm}mm`,
                          height: `${heightMm}mm`,
                          fontSize: `${elem.fontSize || 7.5}pt`,
                          fontWeight: elem.fontWeight === "bold" ? "bold" : (elem.fontWeight || "normal"),
                          fontFamily: elem.fontFamily || "Arial, sans-serif",
                          color: elem.color || "#000000",
                          backgroundColor: elem.backgroundColor || "transparent",
                          transform: elem.rotation ? `rotate(${elem.rotation}deg)` : undefined,
                          transformOrigin: "center center",
                          justifyContent:
                            elem.textAlign === "center"
                              ? "center"
                              : elem.textAlign === "right"
                              ? "flex-end"
                              : "flex-start",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          lineHeight: 1.1,
                          boxSizing: "border-box",
                          WebkitTextSizeAdjust: "100%",
                          textSizeAdjust: "100%",
                        }}
                      >
                        {elemType === "barcode" ? (
                          <BarcodeSvg value={it.barkod} tip="CODE128" />
                        ) : elemType === "qrcode" || elemType === "qr" ? (
                          <BarcodeSvg value={it.barkod} tip="QR" />
                        ) : elemType === "rfid" ? (
                          <div className="d-flex align-items-center gap-1 border border-dark px-1" style={{ fontSize: "5pt" }}>
                            <span>RFID</span>
                          </div>
                        ) : (
                          <span style={{ width: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sampleVal}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            }

            return (
              <div
                key={`${it.id}-${idx}`}
                className="etiket-label bg-white border border-dark d-flex flex-column justify-content-between p-1"
                style={{
                  width: `${genislik}mm`,
                  height: `${yukseklik + kuyrukPayi}mm`,
                  fontSize: "7px",
                  lineHeight: 1.1,
                  boxSizing: "border-box",
                  paddingTop: `${Math.max(0, 1 - ustKaydirma)}mm`,
                  paddingLeft: `${Math.max(0, 1 + solKaydirma)}mm`,
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
            );
          })}
        </div>

        {/* EN ALTA YERLEŞTİRİLEN Yazıcı Baskı Kaydırma & Kalibrasyon Ayarları */}
        <div className="bg-light border rounded p-2.5">
          <div className="d-flex align-items-center justify-content-between mb-2">
            <span className="small fw-bold text-dark d-flex align-items-center gap-1">
              <IconAdjustmentsHorizontal size={17} className="text-primary" />
              Yazıcı Baskı Kaydırma & Kalibrasyon Ayarları (mm)
            </span>
            <span className="text-muted" style={{ fontSize: "10px" }}>
              Yazıcınıza göre milimetrik kaydırma yapabilirsiniz
            </span>
          </div>

          <Row className="gx-3 gy-2">
            {/* Dikey Kaydırma (Yukarı / Aşağı) */}
            <Col md={6}>
              <div className="d-flex justify-content-between align-items-center mb-1">
                <Form.Label className="small mb-0 text-secondary fw-semibold">
                  Dikey Kaydırma (Yukarı / Aşağı):
                </Form.Label>
                <span className={`badge ${ustKaydirma !== 0 ? "bg-primary" : "bg-secondary"}`}>
                  {ustKaydirma > 0 ? `+${ustKaydirma}` : ustKaydirma} mm
                </span>
              </div>
              <div className="d-flex align-items-center gap-1">
                <Button
                  variant="outline-secondary"
                  size="sm"
                  className="px-2 py-0 fw-bold"
                  title="Yukarı Kaydır (Sayı Artar: +0.5mm)"
                  onClick={() => setUstKaydirma((v) => Math.round((v + 0.5) * 10) / 10)}
                >
                  ▲ Yukarı (+0.5)
                </Button>
                <Form.Control
                  type="number"
                  size="sm"
                  step="0.1"
                  className="text-center px-1"
                  style={{ width: "70px" }}
                  value={ustKaydirma}
                  onChange={(e) => setUstKaydirma(Number(e.target.value) || 0)}
                />
                <Button
                  variant="outline-secondary"
                  size="sm"
                  className="px-2 py-0 fw-bold"
                  title="Aşağı Kaydır (Sayı Azalır: -0.5mm)"
                  onClick={() => setUstKaydirma((v) => Math.round((v - 0.5) * 10) / 10)}
                >
                  ▼ Aşağı (-0.5)
                </Button>
              </div>
            </Col>

            {/* Yatay Kaydırma (Sola / Sağa) */}
            <Col md={6}>
              <div className="d-flex justify-content-between align-items-center mb-1">
                <Form.Label className="small mb-0 text-secondary fw-semibold">
                  Yatay Kaydırma (Sola / Sağa):
                </Form.Label>
                <span className={`badge ${solKaydirma !== 0 ? "bg-primary" : "bg-secondary"}`}>
                  {solKaydirma > 0 ? `+${solKaydirma}` : solKaydirma} mm
                </span>
              </div>
              <div className="d-flex align-items-center gap-1">
                <Button
                  variant="outline-secondary"
                  size="sm"
                  className="px-2 py-0 fw-bold"
                  title="Sola Kaydır (Sayı Azalır: -0.5mm)"
                  onClick={() => setSolKaydirma((v) => Math.round((v - 0.5) * 10) / 10)}
                >
                  ◄ Sola (-0.5)
                </Button>
                <Form.Control
                  type="number"
                  size="sm"
                  step="0.1"
                  className="text-center px-1"
                  style={{ width: "70px" }}
                  value={solKaydirma}
                  onChange={(e) => setSolKaydirma(Number(e.target.value) || 0)}
                />
                <Button
                  variant="outline-secondary"
                  size="sm"
                  className="px-2 py-0 fw-bold"
                  title="Sağa Kaydır (Sayı Artar: +0.5mm)"
                  onClick={() => setSolKaydirma((v) => Math.round((v + 0.5) * 10) / 10)}
                >
                  Sağa (+0.5) ►
                </Button>
              </div>
            </Col>
          </Row>
        </div>

        <style>{`
          @media print {
            @page {
              size: ${genislik}mm ${yukseklik}mm;
              margin: 0 !important;
            }
            *, *::before, *::after {
              box-sizing: border-box !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              -webkit-text-size-adjust: 100% !important;
              text-size-adjust: 100% !important;
            }
            body { margin: 0 !important; padding: 0 !important; }
            body * { visibility: hidden; }
            #etiket-print-root, #etiket-print-root * { visibility: visible; }
            #etiket-print-root {
              position: absolute !important; left: 0 !important; top: 0 !important; max-height: none !important; overflow: visible !important;
              background: #fff !important; border: none !important; margin: 0 !important; padding: 0 !important;
            }
            .etiket-label { break-inside: avoid; page-break-inside: avoid; }
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
