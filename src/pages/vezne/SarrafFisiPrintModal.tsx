import React, { useEffect, useState, useRef } from "react";
import { Modal, Button } from "react-bootstrap";
import {
  IconPrinter,
  IconX,
  IconCheck,
  IconReceipt,
  IconFileText,
} from "@tabler/icons-react";
import QRCode from "qrcode";
import { CompanyService, TodvzTanimDto } from "../../services/companyService";

export interface SarrafPrintLineItem {
  satirNo?: number;
  urunKodu?: string;
  urunAdi: string;
  adet?: number | string;
  miktar?: number | string;
  milyem?: number | string;
  hasGram?: number | string;
  iscilikiMiktari?: number | string;
  iscilikHasGram?: number | string;
  iscilikHesaplamaSekli?: number;
  kur?: number | string;
  tutar?: number | string;
  aciklama?: string;
  urunTipi?: number;
  karat?: number | string;
}

export interface SarrafPrintOdemeItem {
  satirNo?: number;
  odemeAraciTuru?: number;
  paraKodu?: string;
  paraAdi?: string;
  adet?: number | string;
  miktar?: number | string;
  milyem?: number | string;
  hasGram?: number | string;
  kur?: number | string;
  tutar?: number | string;
}

export interface SarrafFisiPrintModalProps {
  show: boolean;
  onHide: () => void;
  autoPrint?: boolean;
  fisId?: number | null;
  tip: number; // 0: Alış, 1: Satış
  tarih: string;
  saat?: string;
  seriNo?: string;
  belgeNo?: string;
  unvan?: string;
  vergiKimlikNo?: string;
  detayIl?: string;
  detayIlce?: string;
  detayUyruk?: string;
  detayPasaportNo?: string;
  detayMeslek?: string;
  detayCariTipi?: string;
  detayAdres?: string;
  detayTelefonNo?: string;
  vezneKod?: string;
  kullaniciAdi?: string;
  satirlar: SarrafPrintLineItem[];
  odemeSatirlari?: SarrafPrintOdemeItem[];
  toplamTutar?: number;
  toplamHas?: number;
  odenenTutar?: number;
  kalanTutar?: number;
}

/**
 * Converts numeric amount to Turkish textual representation ("Yazıyla")
 */
export function tutarYaziyla(sayi: number, isSatis: boolean): string {
  if (isNaN(sayi) || sayi === 0) return isSatis ? "#Sıfır TL#" : "Sıfır TL";

  const birler = ["", "Bir", "İki", "Üç", "Dört", "Beş", "Altı", "Yedi", "Sekiz", "Dokuz"];
  const onlar = ["", "On", "Yirmi", "Otuz", "Kırk", "Elli", "Altmış", "Yetmiş", "Seksen", "Doksan"];
  const basamaklar = ["", "Bin", "Milyon", "Milyar", "Trilyon"];

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

  const tamKisim = Math.floor(Math.abs(sayi));
  const kurusKisim = Math.round((Math.abs(sayi) - tamKisim) * 100);

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

  let metin = isSatis ? `#${sonuc} TL` : `${sonuc} TL`;
  if (kurusKisim > 0) {
    metin += ` ${ucluGrupOku(kurusKisim)} Krş`;
  }
  if (isSatis) metin += "#";

  return metin;
}

export const SarrafFisiPrintModal: React.FC<SarrafFisiPrintModalProps> = ({
  show,
  onHide,
  autoPrint = false,
  fisId,
  tip,
  tarih,
  saat,
  seriNo,
  belgeNo,
  unvan,
  vergiKimlikNo,
  detayIl,
  detayIlce,
  detayUyruk,
  detayPasaportNo,
  detayMeslek,
  detayCariTipi,
  detayAdres,
  detayTelefonNo,
  vezneKod,
  kullaniciAdi,
  satirlar,
  odemeSatirlari = [],
  toplamTutar = 0,
  toplamHas = 0,
  odenenTutar = 0,
  kalanTutar = 0,
}) => {
  const [printType, setPrintType] = useState<"A4" | "POS">("POS");
  const [company, setCompany] = useState<TodvzTanimDto | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const printAreaRef = useRef<HTMLDivElement>(null);

  const isSatis = Number(tip) === 1;
  const isAlis = Number(tip) === 0;
  const fisTuruBaslik = isSatis ? "SARRAF SATIŞ FİŞİ" : "SARRAF ALIŞ FİŞİ";
  const fisNoStr = (seriNo ? `${seriNo}-` : "") + (belgeNo || (fisId ? String(fisId) : ""));

  useEffect(() => {
    if (show) {
      CompanyService.getDefinitions().then(setCompany).catch(console.error);
    }
  }, [show]);

  useEffect(() => {
    if (show) {
      const qrContent = `VKN:${company?.VERGI_KIMLIK_NO || "0000000000"}|NO:${fisNoStr}|TAR:${tarih}|TOP:${toplamTutar.toFixed(2)}|HAS:${toplamHas.toFixed(4)}`;
      QRCode.toDataURL(qrContent, { width: 120, margin: 1 })
        .then(setQrDataUrl)
        .catch(() => setQrDataUrl(""));
    }
  }, [show, company, fisNoStr, tarih, toplamTutar, toplamHas]);

  const handlePrint = () => {
    const isPos = printType === "POS";
    const targetId = isPos ? "sarraf-pos-print-target" : "sarraf-a4-print-target";
    const slipEl = document.getElementById(targetId);
    if (!slipEl) {
      window.print();
      return;
    }

    let iframe = document.getElementById("sarraf-print-iframe") as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = "sarraf-print-iframe";
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
          <title>${fisTuruBaslik} - ${fisNoStr}</title>
          <style>
            @page {
              size: ${isPos ? "auto" : "A4 portrait"};
              margin: ${isPos ? "0mm !important" : "10mm !important"};
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body {
              width: 100%;
              max-width: ${isPos ? "80mm" : "100%"};
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff;
              font-family: 'Courier New', Courier, monospace, Arial, sans-serif;
              color: #000000;
              height: auto !important;
              overflow: visible !important;
            }
            .thermal-paper {
              position: static !important;
              width: 100%;
              max-width: 78mm;
              margin: 0 auto !important;
              padding: 1.5mm 2.5mm 3mm 2.5mm !important;
              background: #ffffff;
              color: #000000;
              font-family: 'Courier New', Courier, monospace, Arial, sans-serif;
              font-size: 10px;
              line-height: 1.18;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              page-break-after: avoid !important;
            }
            .a4-paper {
              position: static !important;
              width: 100%;
              max-width: 210mm;
              margin: 0 auto !important;
              padding: 8mm !important;
              background: #ffffff;
              color: #000000;
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              font-size: 11px;
              line-height: 1.35;
            }
            .thermal-box {
              border: 1px solid #000000;
              margin: 2px 0;
              padding: 1.5px 2.5px;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            .thermal-box-title {
              font-weight: 900;
              text-align: center;
              font-size: 10.5px;
              text-transform: uppercase;
              border-bottom: 1px solid #000000;
              padding-bottom: 1px;
              margin-bottom: 2px;
            }
            .dashed-line {
              border-top: 1px dashed #000000;
              margin: 3px 0;
              height: 0;
            }
            .solid-line {
              border-top: 1px solid #000000;
              margin: 3px 0;
              height: 0;
            }
            table {
              border-collapse: collapse;
              width: 100%;
            }
            th, td {
              padding: 1px 2px;
            }
            .text-right {
              text-align: right;
            }
            .text-center {
              text-align: center;
            }
            .fw-bold {
              font-weight: bold;
            }
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
    }, 150);
  };

  // Auto print trigger when opened via F10 or direct-print
  useEffect(() => {
    if (show && autoPrint) {
      const timer = setTimeout(() => {
        handlePrint();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [show, autoPrint]);

  // F8/F10 Shortcuts inside Print Modal
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!show) return;
      if (e.key === "F8" || e.key === "F10") {
        e.preventDefault();
        e.stopPropagation();
        handlePrint();
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onHide();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [show, printType]);

  const activeSatirlar = satirlar.filter(
    (l) => Number(l.miktar) > 0 || Number(l.tutar) > 0 || Number(l.adet) > 0 || (l.urunAdi && l.urunAdi.trim() !== "")
  );

  const activeOdemeler = odemeSatirlari.filter(
    (o) => Number(o.miktar) > 0 || Number(o.tutar) > 0 || Number(o.adet) > 0 || (o.paraKodu && o.paraKodu.trim() !== "")
  );

  return (
    <Modal
      show={show}
      onHide={onHide}
      size="lg"
      centered
      className="sarraf-print-modal"
    >
      <Modal.Header closeButton className="bg-light py-2 px-3 border-bottom d-print-none">
        <div className="d-flex align-items-center justify-content-between w-100 me-3">
          <div className="d-flex align-items-center gap-2">
            <IconReceipt size={20} className="text-primary" />
            <h6 className="mb-0 fw-bold">{fisTuruBaslik} Yazdır</h6>
          </div>
          <div className="d-flex align-items-center gap-2">
            <div className="btn-group btn-group-sm" role="group">
              <button
                type="button"
                className={`btn ${printType === "POS" ? "btn-primary" : "btn-outline-secondary"}`}
                onClick={() => setPrintType("POS")}
              >
                <IconReceipt size={14} className="me-1" />
                80mm Termal (POS)
              </button>
              <button
                type="button"
                className={`btn ${printType === "A4" ? "btn-primary" : "btn-outline-secondary"}`}
                onClick={() => setPrintType("A4")}
              >
                <IconFileText size={14} className="me-1" />
                A4 Belge
              </button>
            </div>
            <Button variant="success" size="sm" onClick={handlePrint} className="px-3">
              <IconPrinter size={15} className="me-1" />
              Yazdır (F10)
            </Button>
          </div>
        </div>
      </Modal.Header>

      <Modal.Body className="p-3 bg-secondary bg-opacity-10 d-flex justify-content-center" style={{ maxHeight: "75vh", overflowY: "auto" }}>
        {printType === "POS" ? (
          /* ======================== 80mm POS TERMAL FİŞ ======================== */
          <div
            id="sarraf-pos-print-target"
            ref={printAreaRef}
            className="bg-white p-3 shadow-sm border text-dark"
            style={{
              width: "360px",
              fontFamily: "'Courier New', Courier, monospace",
              fontSize: "11px",
              lineHeight: "1.25",
              color: "#000",
            }}
          >
            {/* Firma Başlığı */}
            <div className="text-center mb-2">
              <div className="fw-bold" style={{ fontSize: "13px" }}>
                {company?.FIRMA_ADI || "LİKYA KUYUMCULUK"}
              </div>
              {company?.SUBE_ADI && <div style={{ fontSize: "10px" }}>{company.SUBE_ADI}</div>}
              {company?.ADRES && <div style={{ fontSize: "9.5px" }}>{company.ADRES}</div>}
              {company?.VERGI_KIMLIK_NO && (
                <div style={{ fontSize: "9.5px" }}>VKN: {company.VERGI_KIMLIK_NO}</div>
              )}
              {company?.TELEFON && <div style={{ fontSize: "9.5px" }}>Tel: {company.TELEFON}</div>}
            </div>

            <div className="dashed-line" style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />

            {/* Belge Başlığı ve Bilgileri */}
            <div className="text-center fw-bold my-1" style={{ fontSize: "12px", textDecoration: "underline" }}>
              {fisTuruBaslik}
            </div>

            <div style={{ fontSize: "10.5px" }}>
              <div className="d-flex justify-content-between">
                <span>Fiş No: <b>{fisNoStr || "-"}</b></span>
                <span>Tarih: <b>{tarih || "-"}</b></span>
              </div>
              <div className="d-flex justify-content-between">
                <span>Vezne: <b>{vezneKod || "-"}</b></span>
                <span>Saat: <b>{saat || new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</b></span>
              </div>
              {kullaniciAdi && <div>Kasiyer: <b>{kullaniciAdi}</b></div>}
            </div>

            <div className="dashed-line" style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />

            {/* Müşteri Bilgileri */}
            <div style={{ fontSize: "10.5px" }}>
              <div>Müşteri: <b>{unvan || "PERAKENDE MÜŞTERİ"}</b></div>
              {vergiKimlikNo && <div>TCKN / VKN: <b>{vergiKimlikNo}</b></div>}
              {detayTelefonNo && <div>Tel: {detayTelefonNo}</div>}
              {detayAdres && <div>Adres: {detayAdres}</div>}
            </div>

            <div className="dashed-line" style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />

            {/* Satırlar Tablosu */}
            <div className="fw-bold mb-1" style={{ fontSize: "10px" }}>
              <span>ÜRÜN / HAREKET DETAYLARI</span>
            </div>
            <table style={{ width: "100%", fontSize: "10px", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #000" }}>
                  <th style={{ textAlign: "left", paddingBottom: "2px" }}>Ürün / Cinsi</th>
                  <th style={{ textAlign: "right", paddingBottom: "2px" }}>Miktar</th>
                  <th style={{ textAlign: "right", paddingBottom: "2px" }}>Ayar/Kur</th>
                  <th style={{ textAlign: "right", paddingBottom: "2px" }}>Tutar (TL)</th>
                </tr>
              </thead>
              <tbody>
                {activeSatirlar.map((s, idx) => {
                  const miktarNum = Number(s.miktar) || 0;
                  const adetNum = Number(s.adet) || 0;
                  const milyemNum = Number(s.milyem) || 0;
                  const kurNum = Number(s.kur) || 0;
                  const tutarNum = Number(s.tutar) || 0;
                  const hasNum = Number(s.hasGram) || 0;

                  return (
                    <tr key={idx} style={{ verticalAlign: "top" }}>
                      <td style={{ padding: "2px 0" }}>
                        <div className="fw-bold">{s.urunAdi || s.urunKodu || `Satır ${idx + 1}`}</div>
                        {hasNum > 0 && (
                          <div style={{ fontSize: "9px", color: "#333" }}>
                            Has: {hasNum.toFixed(4)} gr
                          </div>
                        )}
                        {s.aciklama && <div style={{ fontSize: "9px", fontStyle: "italic" }}>{s.aciklama}</div>}
                      </td>
                      <td style={{ textAlign: "right", padding: "2px 0", whiteSpace: "nowrap" }}>
                        {miktarNum > 0 ? `${miktarNum.toFixed(2)} gr` : (adetNum > 0 ? `${adetNum} ad` : "-")}
                      </td>
                      <td style={{ textAlign: "right", padding: "2px 0", whiteSpace: "nowrap" }}>
                        {milyemNum > 0 ? milyemNum : (kurNum > 0 ? kurNum.toFixed(2) : "-")}
                      </td>
                      <td style={{ textAlign: "right", padding: "2px 0", fontWeight: "bold", whiteSpace: "nowrap" }}>
                        {tutarNum.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="solid-line" style={{ borderTop: "1px solid #000", margin: "4px 0" }} />

            {/* Ödemeler / Tahsilat Tablosu (Varsa) */}
            {activeOdemeler.length > 0 && (
              <>
                <div className="fw-bold mb-1" style={{ fontSize: "10px" }}>
                  <span>ÖDEME / TAHSİLAT DETAYI</span>
                </div>
                <table style={{ width: "100%", fontSize: "10px", borderCollapse: "collapse", marginBottom: "4px" }}>
                  <tbody>
                    {activeOdemeler.map((o, oIdx) => {
                      const oMiktar = Number(o.miktar) || Number(o.adet) || 0;
                      const oTutar = Number(o.tutar) || 0;
                      return (
                        <tr key={oIdx}>
                          <td>{o.paraKodu || o.paraAdi || "Nakit TL"}</td>
                          <td style={{ textAlign: "right" }}>{oMiktar > 0 ? oMiktar.toFixed(2) : ""}</td>
                          <td style={{ textAlign: "right", fontWeight: "bold" }}>
                            {oTutar.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="dashed-line" style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />
              </>
            )}

            {/* Toplamlar Bölümü */}
            <div style={{ fontSize: "11px" }}>
              {toplamHas > 0 && (
                <div className="d-flex justify-content-between">
                  <span>Toplam Has Gram:</span>
                  <span className="fw-bold">{toplamHas.toFixed(4)} gr</span>
                </div>
              )}
              <div className="d-flex justify-content-between fw-bold" style={{ fontSize: "12px" }}>
                <span>GENEL TOPLAM:</span>
                <span>{toplamTutar.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL</span>
              </div>
              {odenenTutar > 0 && (
                <div className="d-flex justify-content-between">
                  <span>Ödenen / Alınan:</span>
                  <span>{odenenTutar.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL</span>
                </div>
              )}
              {kalanTutar !== 0 && (
                <div className="d-flex justify-content-between text-danger">
                  <span>Kalan Bakiye:</span>
                  <span>{Math.abs(kalanTutar).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL</span>
                </div>
              )}
            </div>

            <div className="dashed-line" style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />

            {/* Yazıyla Tutar */}
            <div className="text-center fst-italic my-1" style={{ fontSize: "9.5px" }}>
              Yalnız: <b>{tutarYaziyla(toplamTutar, isSatis)}</b>
            </div>

            <div className="dashed-line" style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />

            {/* QR Kod ve İmza Alanı */}
            <div className="d-flex align-items-center justify-content-between my-2">
              {qrDataUrl && (
                <img src={qrDataUrl} alt="QR Code" style={{ width: "55px", height: "55px" }} />
              )}
              <div className="text-center flex-grow-1" style={{ fontSize: "9px" }}>
                <div>BİLGİ FİŞİDİR</div>
                <div>MALİ DEĞERİ YOKTUR</div>
                <div className="fw-bold mt-1">İyi Günlerde Kullanınız</div>
              </div>
            </div>

            {/* İmza Alanı */}
            <div className="d-flex justify-content-between text-center mt-3 pt-2" style={{ borderTop: "1px dotted #888", fontSize: "9.5px" }}>
              <div>
                <div>Teslim Eden</div>
                <div className="mt-3">İmza</div>
              </div>
              <div>
                <div>Teslim Alan</div>
                <div className="mt-3">İmza</div>
              </div>
            </div>
          </div>
        ) : (
          /* ======================== A4 FORMATI ======================== */
          <div
            id="sarraf-a4-print-target"
            ref={printAreaRef}
            className="bg-white p-4 shadow-sm border text-dark"
            style={{
              width: "750px",
              fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
              fontSize: "12px",
              lineHeight: "1.4",
              color: "#000",
            }}
          >
            {/* A4 Header */}
            <div className="d-flex justify-content-between align-items-start border-bottom pb-3 mb-3">
              <div>
                <h4 className="fw-bold mb-1 text-primary">{company?.FIRMA_ADI || "LİKYA KUYUMCULUK"}</h4>
                {company?.SUBE_ADI && <div className="text-muted small">{company.SUBE_ADI}</div>}
                {company?.ADRES && <div>{company.ADRES}</div>}
                {company?.VERGI_KIMLIK_NO && <div>VKN: {company.VERGI_KIMLIK_NO}</div>}
                {company?.TELEFON && <div>Tel: {company.TELEFON}</div>}
              </div>
              <div className="text-end">
                <h4 className="fw-bold mb-1">{fisTuruBaslik}</h4>
                <div className="text-muted">Fiş No: <b>{fisNoStr || "-"}</b></div>
                <div>Tarih: <b>{tarih || "-"}</b></div>
                <div>Saat: <b>{saat || new Date().toLocaleTimeString("tr-TR")}</b></div>
                <div>Vezne: <b>{vezneKod || "-"}</b></div>
                {kullaniciAdi && <div>Kasiyer: <b>{kullaniciAdi}</b></div>}
              </div>
            </div>

            {/* A4 Cari Bilgileri */}
            <div className="card p-2 bg-light mb-3">
              <div className="row">
                <div className="col-8">
                  <div className="fw-bold">SAYIN / ÜNVAN: {unvan || "PERAKENDE MÜŞTERİ"}</div>
                  {vergiKimlikNo && <div>TCKN / VKN: {vergiKimlikNo}</div>}
                  {detayAdres && <div>Adres: {detayAdres} {detayIlce ? `${detayIlce} / ` : ""}{detayIl || ""}</div>}
                </div>
                <div className="col-4 text-end">
                  {detayTelefonNo && <div>Tel: {detayTelefonNo}</div>}
                  {detayPasaportNo && <div>Pasaport No: {detayPasaportNo}</div>}
                </div>
              </div>
            </div>

            {/* A4 Tablo */}
            <table className="table table-bordered table-sm mb-3" style={{ fontSize: "11px" }}>
              <thead className="table-secondary">
                <tr>
                  <th style={{ width: "40px" }} className="text-center">S.No</th>
                  <th>Ürün / İşlem Açıklaması</th>
                  <th style={{ width: "80px" }} className="text-end">Adet</th>
                  <th style={{ width: "90px" }} className="text-end">Miktar (Gr)</th>
                  <th style={{ width: "80px" }} className="text-end">Milyem</th>
                  <th style={{ width: "90px" }} className="text-end">Has Gram</th>
                  <th style={{ width: "90px" }} className="text-end">Birim Fiyat</th>
                  <th style={{ width: "110px" }} className="text-end">Tutar (TL)</th>
                </tr>
              </thead>
              <tbody>
                {activeSatirlar.map((s, idx) => {
                  const miktarNum = Number(s.miktar) || 0;
                  const adetNum = Number(s.adet) || 0;
                  const milyemNum = Number(s.milyem) || 0;
                  const hasNum = Number(s.hasGram) || 0;
                  const kurNum = Number(s.kur) || 0;
                  const tutarNum = Number(s.tutar) || 0;

                  return (
                    <tr key={idx}>
                      <td className="text-center">{idx + 1}</td>
                      <td>
                        <div className="fw-bold">{s.urunAdi || s.urunKodu || "-"}</div>
                        {s.aciklama && <div className="text-muted small">{s.aciklama}</div>}
                      </td>
                      <td className="text-end">{adetNum > 0 ? adetNum : "-"}</td>
                      <td className="text-end">{miktarNum > 0 ? miktarNum.toFixed(2) : "-"}</td>
                      <td className="text-end">{milyemNum > 0 ? milyemNum : "-"}</td>
                      <td className="text-end">{hasNum > 0 ? hasNum.toFixed(4) : "-"}</td>
                      <td className="text-end">{kurNum > 0 ? kurNum.toFixed(2) : "-"}</td>
                      <td className="text-end fw-bold">
                        {tutarNum.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* A4 Özet ve Alt Alan */}
            <div className="row">
              <div className="col-7">
                {activeOdemeler.length > 0 && (
                  <div className="card p-2 mb-2 bg-light">
                    <div className="fw-bold small mb-1">Ödeme / Tahsilat Dökümü:</div>
                    <table className="table table-sm table-borderless mb-0" style={{ fontSize: "10.5px" }}>
                      <tbody>
                        {activeOdemeler.map((o, oIdx) => (
                          <tr key={oIdx}>
                            <td>{o.paraKodu || o.paraAdi || "Nakit TL"}</td>
                            <td className="text-end">{Number(o.miktar) > 0 ? Number(o.miktar).toFixed(2) : ""}</td>
                            <td className="text-end fw-bold">
                              {Number(o.tutar).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="p-2 border rounded bg-light small mb-2">
                  <div>Yazıyla: <b>{tutarYaziyla(toplamTutar, isSatis)}</b></div>
                </div>
                <div className="d-flex align-items-center gap-3">
                  {qrDataUrl && (
                    <img src={qrDataUrl} alt="QR Code" style={{ width: "65px", height: "65px" }} />
                  )}
                  <div className="small text-muted">
                    <div>Bu belge bilgi amaçlıdır, mali mühür yerine geçmez.</div>
                    <div>İşlemlerinizde bizi tercih ettiğiniz için teşekkür ederiz.</div>
                  </div>
                </div>
              </div>

              <div className="col-5">
                <div className="card p-3 bg-light">
                  <table className="table table-sm table-borderless mb-0" style={{ fontSize: "11.5px" }}>
                    <tbody>
                      {toplamHas > 0 && (
                        <tr>
                          <td>Toplam Has Gram:</td>
                          <td className="text-end fw-bold">{toplamHas.toFixed(4)} gr</td>
                        </tr>
                      )}
                      <tr className="border-top">
                        <td className="fw-bold" style={{ fontSize: "13px" }}>GENEL TOPLAM:</td>
                        <td className="text-end fw-bold" style={{ fontSize: "13px" }}>
                          {toplamTutar.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL
                        </td>
                      </tr>
                      {odenenTutar > 0 && (
                        <tr>
                          <td>Ödenen / Alınan:</td>
                          <td className="text-end">{odenenTutar.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL</td>
                        </tr>
                      )}
                      {kalanTutar !== 0 && (
                        <tr className="text-danger">
                          <td>Kalan Bakiye:</td>
                          <td className="text-end fw-bold">{Math.abs(kalanTutar).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="row text-center mt-4 pt-3 border-top" style={{ fontSize: "11px" }}>
                  <div className="col-6">
                    <div>Teslim Eden</div>
                    <div className="mt-4">İmza</div>
                  </div>
                  <div className="col-6">
                    <div>Teslim Alan</div>
                    <div className="mt-4">İmza</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal.Body>

      <Modal.Footer className="bg-light py-2 px-3 border-top d-print-none">
        <div className="d-flex justify-content-between w-100 align-items-center">
          <small className="text-muted">
            Kısayol: <kbd>F10</kbd> veya <kbd>F8</kbd> Yazdır | <kbd>ESC</kbd> Kapat
          </small>
          <div className="d-flex gap-2">
            <Button variant="outline-secondary" size="sm" onClick={onHide}>
              <IconX size={15} className="me-1" />
              Kapat (ESC)
            </Button>
            <Button variant="primary" size="sm" onClick={handlePrint}>
              <IconPrinter size={15} className="me-1" />
              Yazdır (F10)
            </Button>
          </div>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default SarrafFisiPrintModal;
