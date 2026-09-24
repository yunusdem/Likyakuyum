import React, { useEffect, useState, useRef } from "react";
import { Modal, Button, Form } from "react-bootstrap";
import {
  IconPrinter,
  IconX,
  IconCheck,
  IconReceipt,
  IconFileText,
  IconDownload,
} from "@tabler/icons-react";
import QRCode from "qrcode";
import { CompanyService, TodvzTanimDto } from "../../services/companyService";
import { PerakendeFaturaModel, PerakendeFaturaSatiriItem } from "../../services/perakendeService";

export interface PerakendeFisiPrintModalProps {
  show: boolean;
  onHide: () => void;
  fatura: PerakendeFaturaModel | null;
  autoPrint?: boolean;
}

/**
 * Converts numeric amount to Turkish textual representation ("Yazıyla")
 */
export function tutarYaziyla(sayi: number): string {
  if (isNaN(sayi) || sayi === 0) return "#Sıfır TL#";

  const birler = ["", "Bir", "İki", "Üç", "Dört", "Beş", "Altı", "Yedi", "Sekiz", "Dokuz"];
  const onlar = ["", "On", "Yirmi", "Otuz", "Kırk", "Elli", "Altmış", "Yetmiş", "Seksen", "Doksan"];
  const basamaklar = ["", "Bin", "Milyon", "Milyar", "Trilyon"];

  const tamKisim = Math.floor(Math.abs(sayi));
  const kurusKisim = Math.round((Math.abs(sayi) - tamKisim) * 100);

  function ucluGrupOku(n: number): string {
    const yuzler = Math.floor(n / 100);
    const onlarBas = Math.floor((n % 100) / 10);
    const birlerBas = n % 10;
    let sonuc = "";
    if (yuzler > 1) sonuc += birler[yuzler] + "Yüz";
    else if (yuzler === 1) sonuc += "Yüz";
    sonuc += onlar[onlarBas];
    sonuc += birler[birlerBas];
    return sonuc;
  }

  let sonuc = "";
  let kalan = tamKisim;
  let grupIndex = 0;

  if (tamKisim === 0) {
    sonuc = "Sıfır";
  } else {
    while (kalan > 0) {
      const grup = kalan % 1000;
      if (grup > 0) {
        if (grupIndex === 1 && grup === 1) {
          sonuc = "Bin" + sonuc;
        } else {
          sonuc = ucluGrupOku(grup) + basamaklar[grupIndex] + sonuc;
        }
      }
      kalan = Math.floor(kalan / 1000);
      grupIndex++;
    }
  }

  let metin = `#${sonuc} TL`;
  if (kurusKisim > 0) {
    metin += ` ${ucluGrupOku(kurusKisim)} Krş`;
  }
  metin += "#";

  return metin;
}

export const PerakendeFisiPrintModal: React.FC<PerakendeFisiPrintModalProps> = ({
  show,
  onHide,
  fatura,
  autoPrint = false,
}) => {
  const [printType, setPrintType] = useState<"A4" | "POS">("POS");
  const [company, setCompany] = useState<TodvzTanimDto | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const printAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (show) {
      CompanyService.getDefinitions().then(setCompany).catch(console.error);
    }
  }, [show]);

  useEffect(() => {
    if (fatura && show) {
      const qrContent = `VKN:${company?.VERGI_KIMLIK_NO || "0000000000"}|AVKN:${fatura.aliciVknTckn}|NO:${fatura.faturaNo}|ETTN:${fatura.ettn}|TAR:${fatura.tarih}|TOP:${fatura.genelToplam.toFixed(2)}`;
      QRCode.toDataURL(qrContent, { width: 120, margin: 1 })
        .then(setQrDataUrl)
        .catch(() => setQrDataUrl(""));
    }
  }, [fatura, show, company]);

  const handlePrint = () => {
    const isPos = printType === "POS";
    const targetId = isPos ? "perakende-pos-print-target" : "perakende-a4-print-target";
    const slipEl = document.getElementById(targetId);
    if (!slipEl) {
      window.print();
      return;
    }

    let iframe = document.getElementById("perakende-print-iframe") as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = "perakende-print-iframe";
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${isPos ? "Perakende Bilgi Fişi" : "e-Arşiv Fatura"} - ${fatura?.faturaNo || ""}</title>
          <style>
            @page {
              size: ${isPos ? "auto" : "A4 portrait"};
              margin: ${isPos ? "0mm" : "5mm"} !important;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body {
              width: 100%;
              max-width: ${isPos ? "80mm" : "210mm"};
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff;
              font-family: ${isPos ? "'Courier New', Courier, monospace, Arial, sans-serif" : "Arial, Helvetica, sans-serif"};
              color: #000000;
              height: auto !important;
              overflow: visible !important;
            }
            .thermal-paper {
              position: static !important;
              width: 100%;
              max-width: 78mm;
              margin: 0 auto !important;
              padding: 2mm 3mm 4mm 3mm !important;
              background: #ffffff;
              color: #000000;
              font-family: 'Courier New', Courier, monospace, Arial, sans-serif;
              font-size: 11px;
              line-height: 1.25;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              page-break-after: avoid !important;
            }
            .a4-paper {
              width: 210mm;
              min-height: 297mm;
              margin: 0 auto;
              padding: 10mm;
              font-family: Arial, Helvetica, sans-serif;
              font-size: 12px;
              line-height: 1.4;
            }
            table {
              border-collapse: collapse;
              width: 100%;
            }
            th, td {
              padding: 2px 2px;
            }
            img {
              max-width: 100%;
            }
            .text-start { text-align: left; }
            .text-end { text-align: right; }
            .text-center { text-align: center; }
            .fw-bold { font-weight: bold; }
            .border-top { border-top: 1px solid #000000; }
            .border-bottom { border-bottom: 1px solid #000000; }
            .my-1 { margin-top: 4px; margin-bottom: 4px; }
            .py-1 { padding-top: 4px; padding-bottom: 4px; }
            .mb-1 { margin-bottom: 4px; }
            .mb-2 { margin-bottom: 8px; }
            .mt-1 { margin-top: 4px; }
            .mt-2 { margin-top: 8px; }
            .fs-6 { font-size: 13px; }
            .d-flex { display: flex; }
            .justify-content-between { justify-content: space-between; }
          </style>
        </head>
        <body>
          <div class="${isPos ? "thermal-paper" : "a4-paper"}">
            ${slipEl.innerHTML}
          </div>
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }, 200);
  };

  // Auto print trigger when opened via F10 or direct-print
  useEffect(() => {
    if (show && autoPrint && fatura) {
      const timer = setTimeout(() => {
        handlePrint();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [show, autoPrint, fatura, qrDataUrl]);

  // Keyboard shortcut listener (F8 / F10 inside print modal)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!show) return;
      if (e.key === "F8" || e.key === "F10") {
        e.preventDefault();
        handlePrint();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [show, printType, fatura]);

  if (!fatura) return null;

  const satirlar: PerakendeFaturaSatiriItem[] = fatura.satirlar || [];
  const totalGram = satirlar.reduce((acc, s) => acc + (Number(s.gram) || 0), 0);
  const totalHasGram = satirlar.reduce((acc, s) => acc + (Number(s.hasGram) || 0), 0);

  return (
    <Modal
      show={show}
      onHide={onHide}
      size="xl"
      centered
      className="perakende-print-modal"
      backdrop="static"
    >
      <Modal.Header closeButton className="bg-light py-2 px-3 border-bottom d-print-none">
        <div className="d-flex align-items-center gap-2">
          <div className="p-2 rounded bg-primary text-white">
            <IconPrinter size={20} />
          </div>
          <div>
            <h6 className="mb-0 fw-bold">Perakende Fişi / E-Fatura Yazdırma Önizleme</h6>
            <small className="text-muted">
              Fatura No: <strong className="text-dark">{fatura.faturaNo}</strong> | ETTN: {fatura.ettn}
            </small>
          </div>
        </div>

        <div className="ms-auto d-flex align-items-center gap-2 me-3">
          <div className="btn-group btn-group-sm">
            <button
              type="button"
              className={`btn ${printType === "A4" ? "btn-primary" : "btn-outline-secondary"}`}
              onClick={() => setPrintType("A4")}
            >
              <IconFileText size={16} className="me-1" />
              A4 E-Arşiv / Fatura
            </button>
            <button
              type="button"
              className={`btn ${printType === "POS" ? "btn-primary" : "btn-outline-secondary"}`}
              onClick={() => setPrintType("POS")}
            >
              <IconReceipt size={16} className="me-1" />
              80mm Termal Fiş
            </button>
          </div>
        </div>
      </Modal.Header>

      <Modal.Body className="p-4 bg-light overflow-auto" style={{ maxHeight: "calc(85vh - 110px)" }}>
        {/* Printable Area Wrapper */}
        <div className="d-flex justify-content-center">
          {printType === "A4" ? (
            /* ========================================================
               A4 E-ARŞİV / E-FATURA TASARIMI
               ======================================================== */
            <div
              ref={printAreaRef}
              id="perakende-a4-print-target"
              className="bg-white shadow-sm border p-4 text-dark"
              style={{
                width: "210mm",
                minHeight: "297mm",
                fontSize: "12px",
                lineHeight: "1.4",
                boxSizing: "border-box",
                fontFamily: "Arial, Helvetica, sans-serif",
              }}
            >
              {/* Top Row: Logo & Company Info & GİB Box */}
              <div className="d-flex justify-content-between align-items-start border-bottom pb-3 mb-3">
                <div style={{ maxWidth: "55%" }}>
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <img
                      src="/images/logo/logo.svg"
                      alt="Logo"
                      style={{ height: "40px", objectFit: "contain" }}
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = "none";
                      }}
                    />
                    <h5 className="fw-bold mb-0 text-dark">
                      {company?.FIRMA_ADI || "LİKYA KUYUMCULUK SAN. VE TİC. LTD. ŞTİ."}
                    </h5>
                  </div>
                  <div className="small text-muted">
                    <div>{company?.ADRES || "Kuyumcular Çarşısı No:12/A"}</div>
                    <div>
                      {company?.SUBE_ADI || "Merkez"}
                    </div>
                    <div>
                      <strong>Tel:</strong> {company?.TELEFON || "0 (212) 000 00 00"} |{" "}
                      <strong>E-Posta:</strong> {company?.EPOSTA || "info@likyakuyumculuk.com"}
                    </div>
                    <div>
                      <strong>VKN:</strong> {company?.VERGI_KIMLIK_NO || "1234567890"} |{" "}
                      <strong>Tic.Sicil No:</strong> {company?.TICARET_SICIL_NO || "123456"}
                    </div>
                  </div>
                </div>

                <div className="text-end" style={{ minWidth: "220px" }}>
                  <div className="border border-primary rounded p-2 text-center bg-light mb-2">
                    <div className="badge bg-primary text-white text-uppercase px-2 py-1 mb-1">
                      {fatura.senaryo || "e-Arşiv Fatura"}
                    </div>
                    <div className="fw-bold text-dark fs-6">{fatura.faturaNo}</div>
                    <div className="text-muted small" style={{ fontSize: "10px" }}>
                      ETTN: {fatura.ettn}
                    </div>
                  </div>

                  {qrDataUrl && (
                    <div className="text-end">
                      <img
                        src={qrDataUrl}
                        alt="E-Belge Karekod"
                        style={{ width: "80px", height: "80px", border: "1px solid #ddd" }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Invoice Meta and Customer Info Boxes */}
              <div className="row g-2 mb-3">
                {/* Customer Box */}
                <div className="col-7">
                  <div className="border rounded p-2 h-100 bg-light">
                    <div className="fw-bold text-primary border-bottom pb-1 mb-1 small text-uppercase">
                      Sayın (Müşteri Bilgileri)
                    </div>
                    <div className="fw-bold fs-6 text-dark mb-1">
                      {fatura.aliciUnvan || "NİHAİ TÜKETİCİ"}
                    </div>
                    <div className="small">
                      <strong>TCKN / VKN:</strong> {fatura.aliciVknTckn || "11111111111"}
                    </div>
                    {fatura.vergiDairesi && (
                      <div className="small">
                        <strong>Vergi Dairesi:</strong> {fatura.vergiDairesi}
                      </div>
                    )}
                    <div className="small">
                      <strong>Adres:</strong> {fatura.adres || "-"}
                    </div>
                    <div className="small">
                      <strong>İl / İlçe:</strong> {fatura.ilce || "-"} / {fatura.il || "-"}
                    </div>
                    {fatura.telefon && (
                      <div className="small">
                        <strong>Tel:</strong> {fatura.telefon}
                      </div>
                    )}
                  </div>
                </div>

                {/* Meta Box */}
                <div className="col-5">
                  <div className="border rounded p-2 h-100 bg-light">
                    <div className="fw-bold text-primary border-bottom pb-1 mb-1 small text-uppercase">
                      Fatura Detayları
                    </div>
                    <table className="table table-sm table-borderless mb-0 small">
                      <tbody>
                        <tr>
                          <td className="text-muted py-0 ps-0">Özelleştirme No:</td>
                          <td className="fw-bold py-0 text-end">TR1.2</td>
                        </tr>
                        <tr>
                          <td className="text-muted py-0 ps-0">Senaryo:</td>
                          <td className="fw-bold py-0 text-end">{fatura.senaryo}</td>
                        </tr>
                        <tr>
                          <td className="text-muted py-0 ps-0">Fatura Tipi:</td>
                          <td className="fw-bold py-0 text-end">
                            {fatura.faturaTipi === 2 ? "İADE" : "SATIS"}
                          </td>
                        </tr>
                        <tr>
                          <td className="text-muted py-0 ps-0">Düzenleme Tarihi:</td>
                          <td className="fw-bold py-0 text-end">
                            {new Date(fatura.tarih).toLocaleDateString("tr-TR")}
                          </td>
                        </tr>
                        <tr>
                          <td className="text-muted py-0 ps-0">Düzenleme Zamanı:</td>
                          <td className="fw-bold py-0 text-end">
                            {new Date(fatura.tarih).toLocaleTimeString("tr-TR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                        </tr>
                        <tr>
                          <td className="text-muted py-0 ps-0">Para Birimi / Kur:</td>
                          <td className="fw-bold py-0 text-end">
                            {fatura.paraKodu || "TL"} (1.00)
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="table-responsive mb-3">
                <table className="table table-sm table-bordered border-dark align-middle mb-0" style={{ fontSize: "11px" }}>
                  <thead className="table-secondary text-center">
                    <tr>
                      <th style={{ width: "30px" }}>No</th>
                      <th style={{ width: "90px" }}>Barkod</th>
                      <th>Mal / Hizmet Açıklaması</th>
                      <th style={{ width: "45px" }}>Ayar</th>
                      <th style={{ width: "45px" }}>Miktar</th>
                      <th style={{ width: "60px" }}>Gram</th>
                      <th style={{ width: "60px" }}>Has Gr</th>
                      <th style={{ width: "75px" }}>Birim Fiyat</th>
                      <th style={{ width: "50px" }}>KDV %</th>
                      <th style={{ width: "65px" }}>KDV Tutarı</th>
                      <th style={{ width: "85px" }}>Toplam Tutar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {satirlar.map((satir, idx) => (
                      <tr key={idx}>
                        <td className="text-center">{satir.satirNo || idx + 1}</td>
                        <td className="text-center font-monospace">{satir.barkod || "-"}</td>
                        <td>
                          <div className="fw-bold">{satir.urunAdi}</div>
                        </td>
                        <td className="text-center">{satir.ayar || "-"}</td>
                        <td className="text-center">{satir.miktar}</td>
                        <td className="text-end font-monospace">
                          {Number(satir.gram || 0).toFixed(2)}
                        </td>
                        <td className="text-end font-monospace">
                          {Number(satir.hasGram || 0).toFixed(3)}
                        </td>
                        <td className="text-end font-monospace">
                          {Number(satir.birimFiyat || 0).toLocaleString("tr-TR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="text-center">%{satir.kdvOrani || 0}</td>
                        <td className="text-end font-monospace">
                          {Number(satir.kdvTutari || 0).toLocaleString("tr-TR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="text-end fw-bold font-monospace">
                          {Number(satir.toplamTutar || 0).toLocaleString("tr-TR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{" "}
                          ₺
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals & Notes Row */}
              <div className="row g-2 mb-3">
                <div className="col-7">
                  <div className="border rounded p-2 h-100 bg-light small">
                    <div className="fw-bold text-muted mb-1">Yalnız:</div>
                    <div className="fw-bold text-dark mb-2">
                      {tutarYaziyla(fatura.genelToplam)}
                    </div>
                    <div className="text-muted" style={{ fontSize: "10px" }}>
                      <strong>Not:</strong> Bu belge 213 Sayılı Vergi Usul Kanunu hükümlerine göre düzenlenmiştir.
                      E-Arşiv Fatura Tebliği uyarınca elektronik ortamda düzenlenmiş ve imzalanmıştır.
                    </div>
                  </div>
                </div>

                <div className="col-5">
                  <table className="table table-sm table-bordered mb-0 small">
                    <tbody>
                      <tr>
                        <td className="text-muted">Toplam Gram / Has:</td>
                        <td className="text-end font-monospace">
                          {totalGram.toFixed(2)} gr / {totalHasGram.toFixed(3)} has
                        </td>
                      </tr>
                      <tr>
                        <td className="text-muted">Mal Hizmet Toplamı:</td>
                        <td className="text-end font-monospace">
                          {fatura.araToplam.toLocaleString("tr-TR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{" "}
                          ₺
                        </td>
                      </tr>
                      <tr>
                        <td className="text-muted">Hesaplanan KDV:</td>
                        <td className="text-end font-monospace">
                          {fatura.toplamKdv.toLocaleString("tr-TR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{" "}
                          ₺
                        </td>
                      </tr>
                      {Number(fatura.iskontoTutari || 0) > 0 && (
                        <tr className="text-danger">
                          <td className="fw-semibold">
                            İskonto {Number(fatura.iskontoOrani || 0) > 0 ? `(%${fatura.iskontoOrani})` : ""}:
                          </td>
                          <td className="text-end font-monospace fw-semibold">
                            -{Number(fatura.iskontoTutari).toLocaleString("tr-TR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{" "}
                            ₺
                          </td>
                        </tr>
                      )}
                      <tr className="table-active">
                        <td className="fw-bold fs-6">Ödenecek Tutar:</td>
                        <td className="text-end fw-bold fs-6 text-primary font-monospace">
                          {fatura.genelToplam.toLocaleString("tr-TR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{" "}
                          ₺
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Signature / Footer */}
              <div className="d-flex justify-content-between align-items-end pt-4 border-top text-center small text-muted">
                <div style={{ width: "200px" }}>
                  <div>Teslim Eden</div>
                  <div className="fw-bold text-dark pt-4">İmza / Kaşe</div>
                </div>
                <div style={{ width: "200px" }}>
                  <div>Teslim Alan</div>
                  <div className="fw-bold text-dark pt-4">{fatura.aliciUnvan}</div>
                </div>
              </div>
            </div>
          ) : (
            /* ========================================================
               80mm TERMAL BİLGİ FİŞİ TASARIMI
               ======================================================== */
            <div
              ref={printAreaRef}
              id="perakende-pos-print-target"
              className="bg-white shadow-sm border p-3 text-dark"
              style={{
                width: "80mm",
                fontSize: "11px",
                lineHeight: "1.3",
                boxSizing: "border-box",
                fontFamily: "monospace",
              }}
            >
              <div className="text-center mb-2">
                <div className="fw-bold fs-6">
                  {company?.FIRMA_ADI || "LİKYA KUYUMCULUK"}
                </div>
                <div style={{ fontSize: "10px" }}>
                  {company?.ADRES || "Kuyumcular Çarşısı No:12/A"}
                </div>
                <div style={{ fontSize: "10px" }}>
                  {company?.SUBE_ADI || "Merkez"}
                </div>
                <div style={{ fontSize: "10px" }}>
                  VKN: {company?.VERGI_KIMLIK_NO || "1234567890"} | TEL: {company?.TELEFON || "-"}
                </div>
                <div className="border-top border-bottom my-1 py-1 fw-bold">
                  PERAKENDE SATIŞ BİLGİ FİŞİ
                </div>
              </div>

              <div className="mb-2" style={{ fontSize: "10px" }}>
                <div><strong>Fatura No:</strong> {fatura.faturaNo}</div>
                <div><strong>Tarih:</strong> {new Date(fatura.tarih).toLocaleString("tr-TR")}</div>
                <div><strong>Müşteri:</strong> {fatura.aliciUnvan}</div>
                <div><strong>TCKN/VKN:</strong> {fatura.aliciVknTckn}</div>
                <div><strong>Senaryo:</strong> {fatura.senaryo}</div>
              </div>

              <div className="border-top border-bottom py-1 mb-2">
                <table className="w-100" style={{ fontSize: "10px" }}>
                  <thead>
                    <tr className="border-bottom">
                      <th className="text-start">Ürün</th>
                      <th className="text-end">Gr/Fyt</th>
                      <th className="text-end">Tutar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {satirlar.map((s, i) => (
                      <tr key={i}>
                        <td className="text-start">
                          <div>{s.urunAdi}</div>
                          <div className="text-muted" style={{ fontSize: "9px" }}>
                            {s.barkod} | {s.ayar || ""}
                          </div>
                        </td>
                        <td className="text-end">
                          <div>{Number(s.gram || 0).toFixed(2)}g</div>
                          <div style={{ fontSize: "9px" }}>
                            {Number(s.birimFiyat).toLocaleString("tr-TR")}
                          </div>
                        </td>
                        <td className="text-end fw-bold">
                          {Number(s.toplamTutar).toLocaleString("tr-TR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mb-2 text-end" style={{ fontSize: "11px" }}>
                <div>Ara Toplam: {fatura.araToplam.toFixed(2)} ₺</div>
                <div>KDV: {fatura.toplamKdv.toFixed(2)} ₺</div>
                {Number(fatura.iskontoTutari || 0) > 0 && (
                  <div>
                    İskonto {Number(fatura.iskontoOrani || 0) > 0 ? `(%${fatura.iskontoOrani})` : ""}: -
                    {Number(fatura.iskontoTutari).toFixed(2)} ₺
                  </div>
                )}
                <div className="fw-bold fs-6 border-top pt-1">
                  GENEL TOPLAM: {fatura.genelToplam.toFixed(2)} ₺
                </div>
              </div>

              {qrDataUrl && (
                <div className="text-center my-2">
                  <img
                    src={qrDataUrl}
                    alt="QR"
                    style={{ width: "65px", height: "65px" }}
                  />
                  <div style={{ fontSize: "8px" }} className="text-muted mt-1">
                    ETTN: {fatura.ettn}
                  </div>
                </div>
              )}

              <div className="text-center text-muted mt-2 border-top pt-1" style={{ fontSize: "9px" }}>
                İyi günlerde kullanmanız dileğiyle.
                <br />
                Mali değeri yoktur, bilgi fişidir.
              </div>
            </div>
          )}
        </div>
      </Modal.Body>

      <Modal.Footer className="bg-light py-2 px-3 border-top d-print-none">
        <Button variant="outline-secondary" size="sm" onClick={onHide}>
          <IconX size={16} className="me-1" />
          Kapat
        </Button>
        <Button variant="primary" size="sm" onClick={handlePrint}>
          <IconPrinter size={16} className="me-1" />
          Yazdır
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
