import React, { useEffect, useState, useRef } from "react";
import { Modal, Button } from "react-bootstrap";
import { IconPrinter, IconX, IconCheck } from "@tabler/icons-react";
import QRCode from "qrcode";
import { CompanyService, TodvzTanimDto } from "../../services/companyService";

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
  const [qrUrl, setQrUrl] = useState<string>("");
  const [company, setCompany] = useState<TodvzTanimDto | null>(null);

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

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      {/* Global CSS for Screen Preview and Pure 80mm Monochrome Thermal Print */}
      <style>{`
        @media screen {
          .thermal-modal-body {
            background-color: #525659;
            padding: 24px;
            display: flex;
            justify-content: center;
          }
          .thermal-paper {
            background-color: #ffffff;
            width: 80mm;
            min-height: 140mm;
            padding: 4mm 3mm;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.35);
            border-radius: 2px;
            color: #000000;
            font-family: 'Courier New', Courier, monospace, Arial, sans-serif;
            font-size: 11px;
            line-height: 1.22;
          }
        }

        @media print {
          /* Hide EVERYTHING else on page during print */
          body * {
            visibility: hidden !important;
          }
          .modal-backdrop, .modal {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            background: transparent !important;
          }
          #thermal-print-slip, #thermal-print-slip * {
            visibility: visible !important;
          }
          #thermal-print-slip {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 76mm !important;
            max-width: 76mm !important;
            margin: 0 !important;
            padding: 1mm 1.5mm !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: 'Courier New', Courier, monospace, Arial, sans-serif !important;
            font-size: 10.5px !important;
            line-height: 1.2 !important;
          }
          @page {
            size: 80mm auto;
            margin: 0mm !important;
          }
        }

        /* Thermal Elements */
        .thermal-box {
          border: 1px solid #000000;
          margin: 4px 0;
          padding: 2px 3px;
        }
        .thermal-box-title {
          font-weight: 900;
          text-align: center;
          font-size: 11px;
          text-transform: uppercase;
          border-bottom: 1px solid #000000;
          padding-bottom: 2px;
          margin-bottom: 3px;
        }
        .dashed-line {
          border-top: 1px dashed #000000;
          margin: 6px 0;
          height: 0;
        }
      `}</style>

      <Modal show={show} onHide={onHide} size="lg" centered backdrop="static">
        <Modal.Header closeButton className="bg-light py-2">
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2">
            <IconPrinter size={18} className="text-primary" />
            e-Döviz Fişi Yazdırma Önizleme ({isSatis ? "SATIŞ BELGESİ" : "ALIM BELGESİ"} - 80mm Termal)
          </Modal.Title>
        </Modal.Header>

        <Modal.Body className="thermal-modal-body p-3">
          <div id="thermal-print-slip" className="thermal-paper">
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
