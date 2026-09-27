import React, { useEffect, useState, useRef } from "react";
import { Modal, Button, Form } from "react-bootstrap";
import { IconPrinter, IconX, IconCheck } from "@tabler/icons-react";
import QRCode from "qrcode";
import { CompanyService, TodvzTanimDto } from "../../services/companyService";
import { PrinterService, YaziciItem } from "../../services/printerService";
import { VezneItem } from "../../services/cashDeskService";
import { resolveEffectivePrinter, ResolvedPrinterResult } from "../../utils/printerResolver";
import { useAuth } from "../../context/AuthContext";

export interface PrintLineItem {
  paraKodu: string;
  paraAdi?: string;
  miktar: number | string;
  kur: number | string;
  tutar: number | string;
  usdKarsiligi?: number | string;
  bmv?: number | string;
  komisyon?: number | string;
}

export interface DovizFisiPrintModalProps {
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
  vezneKod?: string;
  vezne?: any;
  istatistikKodu?: string;
  guid?: string;
  lines: PrintLineItem[];
  toplamTutar?: number;
  odemeTutari?: number;
  bsmvTutari?: number;
  komisyonTutari?: number;
  giseUsdKuru?: number;
  dovizKurusSayisi?: number;
  kurKurusSayisi?: number;
  tlKurusSayisi?: number;
}

/**
 * Converts numeric amount to Turkish textual representation ("Yazıyla")
 * Example: 11302.56 -> "#OnBirBin ÜçYüzİki TL ElliAltı Krş#"
 * Example: 2360 -> "#İkiBin ÜçYüzAltmış TL#"
 */
export function tutarYaziyla(sayi: number, isSatis: boolean): string {
  if (isNaN(sayi) || sayi === 0) return isSatis ? "#Sıfır TL#" : "Sıfır TL";

  const birler = ["", "Bir", "İki", "Üç", "Dört", "Beş", "Altı", "Yedi", "Sekiz", "Dokuz"];
  const onlar = ["", "On", "Yirmi", "Otuz", "Kırk", "Elli", "Altmış", "Yetmiş", "Seksen", "Doksan"];
  const basamaklar = ["", "Bin", "Milyon", "Milyar", "Trilyon"];

  function grupOku(n: number, grupIndex: number): string {
    if (n === 0) return "";
    let str = "";
    const yuzler = Math.floor(n / 100);
    const kalan = n % 100;
    const onluk = Math.floor(kalan / 10);
    const birlik = kalan % 10;

    if (yuzler === 1) {
      str += "ÜçYüz"; // handled below
      str = "Yüz";
    } else if (yuzler > 1) {
      str += birler[yuzler] + "Yüz";
    }

    str += onlar[onluk];

    if (grupIndex === 1 && n === 1) {
      // "Bin" vs "BirBin": Fotoğrafta 11.000 -> OnBirBin, 2.000 -> İkiBin
      str += "";
    } else {
      str += birler[birlik];
    }

    if (basamaklar[grupIndex]) {
      str += " " + basamaklar[grupIndex] + " ";
    }
    return str;
  }

  const tamKisim = Math.floor(Math.abs(sayi));
  const kurusKisim = Math.round((Math.abs(sayi) - tamKisim) * 100);

  let tamYazi = "";
  let temp = tamKisim;
  let grup = 0;

  if (temp === 0) {
    tamYazi = "Sıfır";
  } else {
    while (temp > 0) {
      const uclu = temp % 1000;
      if (uclu > 0) {
        const parca = grupOku(uclu, grup);
        tamYazi = parca.trim() + " " + tamYazi;
      }
      temp = Math.floor(temp / 1000);
      grup++;
    }
  }

  tamYazi = tamYazi.trim().replace(/\s+/g, " ");

  let sonuc = "";
  if (isSatis) {
    sonuc = `#${tamYazi} TL`;
    if (kurusKisim > 0) {
      const onluk = Math.floor(kurusKisim / 10);
      const birlik = kurusKisim % 10;
      const kurusYazi = onlar[onluk] + birler[birlik];
      sonuc += ` ${kurusYazi} Krş#`;
    } else {
      sonuc += "#";
    }
  } else {
    sonuc = `Yazıyla ${tamYazi} TL`;
    if (kurusKisim > 0) {
      const onluk = Math.floor(kurusKisim / 10);
      const birlik = kurusKisim % 10;
      const kurusYazi = onlar[onluk] + birler[birlik];
      sonuc += ` ${kurusYazi} Krş`;
    }
  }

  return sonuc;
}

export const DovizFisiPrintModal: React.FC<DovizFisiPrintModalProps> = ({
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
  vezneKod,
  vezne,
  istatistikKodu,
  guid,
  lines,
  toplamTutar,
  odemeTutari,
  bsmvTutari,
  komisyonTutari,
  giseUsdKuru,
  dovizKurusSayisi,
  kurKurusSayisi,
  tlKurusSayisi,
}) => {
  const isSatis = tip === 1;
  const { user } = useAuth();
  const [qrUrl, setQrUrl] = useState<string>("");
  const [company, setCompany] = useState<TodvzTanimDto | null>(null);
  const [printers, setPrinters] = useState<YaziciItem[]>([]);
  const [selectedPrinterId, setSelectedPrinterId] = useState<number | null>(null);
  const [resolvedResult, setResolvedResult] = useState<ResolvedPrinterResult | null>(null);

  // Load printers and resolve effective printer based on vezne/user/tip
  useEffect(() => {
    if (show) {
      PrinterService.getYazicilar()
        .then((list) => {
          setPrinters(list);
          const resolved = resolveEffectivePrinter({
            pageType: "doviz",
            tip,
            vezne,
            user,
            printers: list,
          });
          setResolvedResult(resolved);
          setSelectedPrinterId(resolved.printerId);
        })
        .catch(() => {
          const resolved = resolveEffectivePrinter({
            pageType: "doviz",
            tip,
            vezne,
            user,
            printers: [],
          });
          setResolvedResult(resolved);
        });
    }
  }, [show, tip, vezne, user]);

  const effMiktarKurus = dovizKurusSayisi ?? (company?.DOVIZ_KURUS_SAYISI !== undefined && company?.DOVIZ_KURUS_SAYISI !== null ? Number(company.DOVIZ_KURUS_SAYISI) : 2);
  const effKurKurus = kurKurusSayisi ?? (company?.KUR_KURUS_SAYISI !== undefined && company?.KUR_KURUS_SAYISI !== null ? Number(company.KUR_KURUS_SAYISI) : 4);
  const effTlKurus = tlKurusSayisi ?? (company?.TL_KURUS_SAYISI !== undefined && company?.TL_KURUS_SAYISI !== null ? Number(company.TL_KURUS_SAYISI) : 2);

  // Fallback / default company values matching the real thermal receipt
  const firmaAdi = company?.FIRMA_ADI || "DİKMEN DOVİZ AS";
  const firmaAdres = company?.ADRES || "ATATURK CAD.44/A 48300 FETHİYE/MUĞLA";
  const firmaTel = company?.TELEFON || "02526141338";
  const firmaWeb = "www.dikmendoviz.com.tr";
  const firmaEposta = "info@dikmendoviz.com.tr";
  const firmaVD = "FETHİYE / 2960034014";
  const firmaMersis = "0296003401400010 / 2052";

  // Effective ETTN (UUID)
  const ettn = (
    guid ||
    (fisId
      ? `FD5AA22A-A68D-4B2E-87CF-E958E38${String(fisId).padStart(4, "0")}`
      : "FD5AA22A-A68D-4B2E-87CF-E958E380439F")
  ).toUpperCase();

  // Effective Belge No
  const currentBelgeNo = (
    belgeNo ||
    seriNo ||
    (isSatis ? "DIS2026000013948" : "DIA2026000053118")
  ).trim();

  // Effective Date and Time
  const displayDate = tarih
    ? tarih.split("-").reverse().join("/")
    : new Date().toLocaleDateString("tr-TR");

  const displayTime = saat || new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

  // Effective Sub / Stat
  const subeNo = "1 - 284";
  const istNo = istatistikKodu || (isSatis ? "10285" : "9249");

  // Customer info
  const musteriAdi = (unvan || "").trim() || "İsim beyan edilmemiştir";
  const musteriSehir = (
    detayIlce || detayIl
      ? `${(detayIlce || "").toUpperCase()}/${(detayIl || "").toUpperCase()}`
      : "FETHİYE/MUĞLA"
  ).trim();
  const musteriUyruk = (detayUyruk || "TR").trim().toUpperCase();
  const musteriTckn = (vergiKimlikNo || "11111111111").trim();
  const musteriTuru = (detayCariTipi === "Firma" ? "TUZELKISI" : "GERCEKKISI");
  const musteriMeslek = (detayMeslek || "").trim();

  // Valid lines
  const validLines = (lines || []).filter((l) => {
    const m = typeof l.miktar === "number" ? l.miktar : parseFloat(String(l.miktar).replace(/,/g, ".")) || 0;
    const k = typeof l.kur === "number" ? l.kur : parseFloat(String(l.kur).replace(/,/g, ".")) || 0;
    return m > 0 && k > 0;
  });

  // Calculate totals
  const totalTl = validLines.reduce((acc, l) => {
    const t = typeof l.tutar === "number" ? l.tutar : parseFloat(String(l.tutar).replace(/,/g, ".")) || 0;
    return acc + t;
  }, 0);

  const bsmvVal = isSatis
    ? (bsmvTutari !== undefined && bsmvTutari !== null
        ? Number(bsmvTutari)
        : Math.round(totalTl * 0.002 * 100) / 100)
    : 0;

  const grandTotal = isSatis ? totalTl + bsmvVal : (odemeTutari ?? totalTl);

  // Format currency helpers
  const fmt = (num: number, decimals: number = 2): string => {
    return Number(num || 0).toLocaleString("tr-TR", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  // Generate QR code data URL
  useEffect(() => {
    if (show) {
      const qrData = `https://ebelge.gib.gov.tr/edoviz?ettn=${ettn}&vkn=2960034014&t=${tarih}&tut=${grandTotal.toFixed(2)}`;
      QRCode.toDataURL(qrData, {
        width: 140,
        margin: 0,
        errorCorrectionLevel: "M",
      })
        .then((url) => setQrUrl(url))
        .catch((err) => console.error("QR Code Error:", err));

      CompanyService.getDefinitions()
        .then((data) => {
          if (data && data.FIRMA_ADI) setCompany(data);
        })
        .catch(() => {});
    }
  }, [show, ettn, tarih, grandTotal]);

  const handlePrint = async () => {
    const slipEl = document.getElementById("thermal-print-slip");
    if (!slipEl) return;
    const contentHtml = slipEl.innerHTML;

    // 1. Doğrudan donanım/ağ yazıcısına çıktı göndermeyi dene
    try {
      const res = await PrinterService.directPrint({
        printerId: selectedPrinterId,
        printerName: resolvedResult?.printer?.cihazAdi || resolvedResult?.printer?.ad,
        documentTitle: `e-Döviz Fişi - ${currentBelgeNo}`,
        htmlContent: contentHtml,
        isPos: true,
        copies: resolvedResult?.kopyaSayisi || 1,
      });

      if (res.success && !res.fallbackToBrowser) {
        return;
      }
    } catch {
      // Tarayıcı fallback akışına devam edilir
    }

    // 2. Tarayıcı gizli iframe yazdırma motoru (Sadece fiş verilerini yazdırır, sayfayı asla yazdırmaz)
    let iframe = document.getElementById("thermal-print-iframe") as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = "thermal-print-iframe";
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>e-Döviz Fişi - ${currentBelgeNo}</title>
          <style>
            @page {
              size: auto;
              margin: 0mm !important;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body {
              width: 100%;
              max-width: 80mm;
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
            table {
              border-collapse: collapse;
              width: 100%;
            }
            img {
              max-width: 100%;
            }
          </style>
        </head>
        <body>
          <div class="thermal-paper">
            ${slipEl.innerHTML}
          </div>
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }, 100);
  };

  // Auto print trigger when opened via F10 or direct-print
  useEffect(() => {
    if (show && autoPrint) {
      const timer = setTimeout(() => {
        handlePrint();
        onHide();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [show, autoPrint]);

  // F8 Shortcut for print when modal is open
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!show) return;
      if (e.key === "F8") {
        e.preventDefault();
        handlePrint();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [show]);

  const renderSlipContent = () => (
    <>
      {/* 1. Üst Başlık ve Karekod (GİB Logo + Belge Adı & QR Code) */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        {/* Sol: GİB Logo & Belge Başlığı */}
        <div style={{ width: "58%", textAlign: "left" }}>
          {/* Gelir İdaresi Başkanlığı Monochrome Vector Emblem */}
          <div style={{ width: "52px", height: "52px", margin: "0 0 4px 0" }}>
            <svg viewBox="0 0 100 100" width="52" height="52">
              <circle cx="50" cy="50" r="47" fill="none" stroke="#000" strokeWidth="2.5" />
              <circle cx="50" cy="50" r="43" fill="none" stroke="#000" strokeWidth="1" />
              {/* Stylized GİB Emblem Arch & Crescent */}
              <path
                d="M 50 18 C 30 18 18 32 18 50 C 18 68 32 82 50 82 C 68 82 80 70 82 54 L 62 54 C 60 62 56 66 50 66 C 40 66 32 58 32 50 C 32 40 40 32 50 32 C 58 32 64 38 66 45 L 82 40 C 78 28 66 18 50 18 Z"
                fill="#000"
              />
              <path
                d="M 50 38 C 44 38 40 43 40 50 C 40 57 44 62 50 62 C 55 62 58 59 60 55 L 60 45 L 50 45 L 50 40 L 68 40 L 68 56 C 65 64 58 70 50 70 C 38 70 30 61 30 50 C 30 39 38 30 50 30 C 58 30 65 35 68 42 L 62 44 C 60 40 56 38 50 38 Z"
                fill="#fff"
              />
            </svg>
          </div>

          <div style={{ fontWeight: 800, fontSize: "10.5px", lineHeight: "1.25", textTransform: "uppercase" }}>
            e-DÖVİZ VE KIYMETLİ<br />
            MADEN {isSatis ? "SATIM" : "ALIM"} BELGESİ
          </div>
        </div>

        {/* Sağ: Karekod (QR Code) */}
        <div style={{ width: "38%", textAlign: "right" }}>
          {qrUrl ? (
            <img
              src={qrUrl}
              alt="e-Döviz Karekod"
              style={{ width: "88px", height: "88px", display: "inline-block", imageRendering: "pixelated" }}
            />
          ) : (
            <div style={{ width: "88px", height: "88px", border: "1px dashed #000", display: "inline-block" }} />
          )}
        </div>
      </div>

            {/* Ayrım Çizgisi */}
            <div className="dashed-line" />

            {/* 2. Düzenleyen Yetkili Müessese Bilgileri */}
            <div style={{ textAlign: "center", marginBottom: "5px" }}>
              <div style={{ fontWeight: 900, fontSize: "11px", letterSpacing: "0.5px" }}>
                DÜZENLEYEN YETKİLİ MÜESSESE BİLGİLERİ
              </div>
              <div style={{ fontWeight: 800, fontSize: "11px", margin: "1px 0" }}>
                {firmaAdi}
              </div>
              <div style={{ fontSize: "10.5px", fontWeight: 700, margin: "2px 0" }}>
                {firmaAdres}
              </div>

              <div style={{ textAlign: "left", fontSize: "10px", marginTop: "3px" }}>
                <div style={{ display: "flex" }}>
                  <span style={{ width: "100px" }}>Tel</span>
                  <span>: {firmaTel}</span>
                </div>
                <div style={{ display: "flex" }}>
                  <span style={{ width: "100px" }}>Web Sitesi</span>
                  <span>: {firmaWeb}</span>
                </div>
                <div style={{ display: "flex" }}>
                  <span style={{ width: "100px" }}>E-posta</span>
                  <span>: {firmaEposta}</span>
                </div>
                <div style={{ display: "flex" }}>
                  <span style={{ width: "100px" }}>VD / VKN</span>
                  <span>: {firmaVD}</span>
                </div>
                <div style={{ display: "flex" }}>
                  <span style={{ width: "100px" }}>Mersis/Tic.Sic.No</span>
                  <span>: {firmaMersis}</span>
                </div>
              </div>
            </div>

            {/* 3. Belge Bilgileri Kutusu (Çerçeveli Tablo) */}
            <div className="thermal-box">
              <div className="thermal-box-title">
                {isSatis ? "SATIM" : "ALIM"} BELGESİ BİLGİLERİ
              </div>
              <table style={{ width: "100%", fontSize: "10.5px", borderCollapse: "collapse" }}>
                <tbody>
                  <tr>
                    <td style={{ width: "75px", padding: "1px 0" }}>Belge No</td>
                    <td style={{ fontWeight: 900, fontSize: "12px", padding: "1px 0" }}>
                      {currentBelgeNo}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: "1px 0" }}>Tarih</td>
                    <td style={{ fontWeight: 800, padding: "1px 0" }}>
                      {displayDate} &nbsp;&nbsp; {displayTime}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: "1px 0" }}>Şube/İst.No</td>
                    <td style={{ fontWeight: 800, padding: "1px 0" }}>
                      {subeNo} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; / {istNo}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: "1px 0" }}>Seri / Tip</td>
                    <td style={{ fontWeight: 800, padding: "1px 0" }}>
                      EDOVIZBELGE / {isSatis ? "SATIM" : "ALIM"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 4. Müşteri / Döviz Alan - Satan Bilgileri */}
            <div style={{ margin: "4px 0", fontSize: "10px", lineHeight: "1.3" }}>
              <div style={{ fontWeight: 800, textTransform: "uppercase" }}>
                {isSatis ? "DÖVİZ ALAN KİŞİ / KURULUŞ BİLGİLERİ" : "DÖVİZ SATAN KİŞİ/KURULUŞ BİLGİLERİ"}
              </div>
              <div style={{ fontWeight: 800 }}>{musteriAdi}</div>
              <div style={{ fontWeight: 800 }}>{musteriSehir}</div>

              <div style={{ marginTop: "3px" }}>
                Uyruk : {musteriUyruk} / Pasaport no : {detayPasaportNo || ""}
              </div>
              <div>
                VD : / TCKN: {musteriTckn}
              </div>
              <div>
                MüşteriTürü : {musteriTuru} / Mesleği : {musteriMeslek}
              </div>
              <div style={{ fontWeight: 800, fontSize: "9.5px", wordBreak: "break-all", marginTop: "2px" }}>
                ETTN : {ettn}
              </div>
            </div>

            {/* 5. Döviz / Tutar Tablosu (Çerçeveli Tablo) */}
            <div className="thermal-box">
              <div className="thermal-box-title">
                {isSatis ? "SATILAN DÖVİZE/EFEKTİFE AİT BİLGİLER" : "SATIN ALINAN DÖVİZE/EFEKTİFE AİT BİLGİLER"}
              </div>
              <table style={{ width: "100%", fontSize: "10.5px", borderCollapse: "collapse" }}>
                <tbody>
                  {validLines.length > 0 ? (
                    validLines.map((l, idx) => {
                      const m = typeof l.miktar === "number" ? l.miktar : parseFloat(String(l.miktar).replace(/,/g, ".")) || 0;
                      const k = typeof l.kur === "number" ? l.kur : parseFloat(String(l.kur).replace(/,/g, ".")) || 0;
                      const tut = typeof l.tutar === "number" ? l.tutar : parseFloat(String(l.tutar).replace(/,/g, ".")) || m * k;
                      const pKod = (l.paraKodu || "USD").toUpperCase();

                      // Calculate USD equivalent if currency is EUR or others
                      let usdEquivalent: number | null = null;
                      if (pKod !== "USD" && pKod !== "TL" && pKod !== "TRY") {
                        const usdRate = giseUsdKuru && giseUsdKuru > 0 ? giseUsdKuru : 48.36;
                        usdEquivalent = Math.round((tut / usdRate) * 100) / 100;
                      }

                      return (
                        <React.Fragment key={idx}>
                          <tr>
                            <td style={{ padding: "1px 0" }}>Döviz/Efektifin Mik. / Brm</td>
                            <td style={{ textAlign: "right", fontWeight: 800, padding: "1px 0" }}>
                              {fmt(m, effMiktarKurus)} {pKod}
                            </td>
                          </tr>
                          <tr>
                            <td style={{ padding: "1px 0" }}>Uygulanan Kur</td>
                            <td style={{ textAlign: "right", fontWeight: 800, padding: "1px 0" }}>
                              {fmt(k, effKurKurus)}
                            </td>
                          </tr>
                          <tr>
                            <td style={{ padding: "1px 0" }}>TL Karşılığı</td>
                            <td style={{ textAlign: "right", fontWeight: 800, padding: "1px 0" }}>
                              {fmt(tut, effTlKurus)} TL
                            </td>
                          </tr>
                          {usdEquivalent !== null && (
                            <tr>
                              <td style={{ padding: "1px 0" }}>ABD Doları Karşılığı</td>
                              <td style={{ textAlign: "right", fontWeight: 800, padding: "1px 0" }}>
                                {fmt(usdEquivalent, 2)} USD
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={2} style={{ textAlign: "center", padding: "4px" }}>Döviz satırı bulunamadı</td>
                    </tr>
                  )}

                  {/* Satışta BSMV Satırı */}
                  {isSatis && bsmvVal > 0 && (
                    <tr>
                      <td style={{ padding: "1px 0" }}>BSMV</td>
                      <td style={{ textAlign: "right", fontWeight: 800, padding: "1px 0" }}>
                        {fmt(bsmvVal, effTlKurus)} TL
                      </td>
                    </tr>
                  )}

                  {/* Toplam Tutar */}
                  <tr style={{ borderTop: "1px solid #000" }}>
                    <td style={{ fontWeight: 900, fontSize: "11.5px", paddingTop: "3px" }}>
                      Toplam Tutar
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 900, fontSize: "12px", paddingTop: "3px" }}>
                      {fmt(grandTotal, effTlKurus)} TL
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 6. Alt Kapanış ve İmzalar Kutusu (Çerçeveli) */}
            <div className="thermal-box" style={{ fontSize: "10px", lineHeight: "1.3" }}>
              {isSatis ? (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Komisyon</span>
                    <span style={{ fontWeight: 800 }}>0,00</span>
                  </div>
                  <div style={{ fontWeight: 800, margin: "2px 0" }}>
                    Yazıyla {tutarYaziyla(grandTotal, true)}
                  </div>
                  <div style={{ fontSize: "9px" }}>Kmv kura dahil değildir.</div>

                  <div style={{ display: "flex", justifyContent: "space-between", margin: "2px 0" }}>
                    <span>Ülke Kodu: TR</span>
                    <span>Uyruk:: TR</span>
                    <span>Vezne adı : {vezneKod || "01"}</span>
                  </div>

                  <div style={{ margin: "2px 0" }}>
                    Satışın Dayanağı &nbsp;&nbsp;&nbsp;&nbsp; 32 SAYILI KARAR GEREĞİ
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900, fontSize: "11px", marginTop: "3px" }}>
                    <span>A.P.: {fmt(grandTotal, effTlKurus)}</span>
                    <span>P.U.: 0,00</span>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Geldiği Ülke</span>
                    <span style={{ fontWeight: 800 }}>Türkiye</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", margin: "2px 0" }}>
                    <span>Komisyon &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; : &nbsp;&nbsp;&nbsp;&nbsp; 0,00</span>
                    <span>Vezne adı : {vezneKod || "01"}</span>
                  </div>
                  <div style={{ fontWeight: 800, margin: "2px 0" }}>
                    {tutarYaziyla(grandTotal, false)}
                  </div>
                </>
              )}
            </div>
    </>
  );

  return (
    <>
      {/* Global CSS for Screen Preview and Pure 80mm Monochrome Thermal Print */}
      <style>{`
        @media screen {
          .thermal-modal-body {
            background-color: #525659;
            padding: 16px;
            display: flex;
            justify-content: center;
            overflow: auto;
          }
          .thermal-paper {
            background-color: #ffffff;
            width: 80mm;
            min-height: 120mm;
            padding: 2.5mm 3mm;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.35);
            border-radius: 2px;
            color: #000000;
            font-family: 'Courier New', Courier, monospace, Arial, sans-serif;
            font-size: 10.5px;
            line-height: 1.2;
          }
        }

        /* Thermal Elements */
        .thermal-box {
          border: 1px solid #000000;
          margin: 3px 0;
          padding: 1.5px 2.5px;
          page-break-inside: avoid;
          break-inside: avoid;
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
          margin: 4px 0;
          height: 0;
        }
      `}</style>

      {/* Hidden off-screen slip for direct printing (F10) and robust DOM extraction */}
      {show && (
        <div
          style={{
            position: "fixed",
            left: "-99999px",
            top: "-99999px",
            opacity: 0,
            pointerEvents: "none",
            zIndex: -1,
          }}
        >
          <div id="thermal-print-slip" className="thermal-paper">
            {renderSlipContent()}
          </div>
        </div>
      )}

      {/* Screen Preview Modal (F9 / Manual Preview) */}
      <Modal show={show && !autoPrint} onHide={onHide} size="lg" centered backdrop="static">
        <Modal.Header closeButton className="bg-light py-2 px-3">
          <div className="d-flex align-items-center justify-content-between w-100 me-2 flex-wrap gap-2">
            <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 mb-0">
              <IconPrinter size={18} className="text-primary" />
              e-Döviz Fişi ({isSatis ? "SATIŞ BELGESİ" : "ALIM BELGESİ"} - 80mm)
            </Modal.Title>
            <div className="d-flex align-items-center gap-2">
              <span className="text-secondary small fw-bold">Yazıcı:</span>
              <Form.Select
                size="sm"
                value={selectedPrinterId || ""}
                onChange={(e) => setSelectedPrinterId(e.target.value ? Number(e.target.value) : null)}
                style={{ width: "200px", fontSize: "12px", fontWeight: 600 }}
              >
                {printers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.ad || p.cihazAdi || `Yazıcı #${p.id}`} {p.kopyaSayisi ? `(${p.kopyaSayisi} Kopya)` : ""}
                  </option>
                ))}
                {printers.length === 0 && <option value="">Sistem Varsayılan Yazıcısı</option>}
              </Form.Select>
              {resolvedResult?.sourceLabel && (
                <span className="badge bg-secondary bg-opacity-10 text-secondary border px-2 py-1" style={{ fontSize: "10px" }}>
                  {resolvedResult.sourceLabel}
                </span>
              )}
            </div>
          </div>
        </Modal.Header>

        <Modal.Body className="thermal-modal-body p-3">
          <div className="thermal-paper">
            {renderSlipContent()}
          </div>
        </Modal.Body>

        <Modal.Footer className="bg-light py-2 d-flex justify-content-between">
          <Button variant="secondary" size="sm" onClick={onHide} className="d-flex align-items-center gap-1">
            <IconX size={15} /> Kapat
          </Button>
          <Button variant="primary" size="sm" onClick={handlePrint} className="d-flex align-items-center gap-1 px-4 fw-bold shadow-xs">
            <IconPrinter size={16} /> Yazdır (F8 / Termal Çıktı)
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};
