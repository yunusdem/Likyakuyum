import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Modal, Button, Row, Col, Spinner, Badge, Alert } from "react-bootstrap";
import {
  IconPrinter,
  IconX,
  IconId,
  IconFileText,
  IconCheck,
} from "@tabler/icons-react";
import QRCode from "qrcode";
import { CariService, CariKartItem } from "../../services/cariService";
import { CompanyService, TodvzTanimDto } from "../../services/companyService";
import { tutarYaziylaTr } from "../../utils/tutarYaziyla";
import { PrinterService, YaziciItem } from "../../services/printerService";
import { useAuth } from "../../context/AuthContext";
import { triggerSilentPrint } from "../../services/silentPrintService";
import { sarrafFisHtml, dovizFisHtml, FisHtml } from "../../utils/belgeSablon/fisCikti";

const formatNumberTr = (val: number, decimals: number = 2) => {
  if (val === undefined || val === null || isNaN(val)) return "0,00";
  return val.toLocaleString("tr-TR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

// Boş / tanımsız değerleri kalemle doldurulabilmesi için temiz string'e dönüştür
const cleanValue = (val?: string | null): string => {
  if (!val) return "";
  const s = String(val).trim();
  if (
    s === "-" ||
    s === "—" ||
    s.toLowerCase() === "tanımsız" ||
    s.toLowerCase() === "null" ||
    s.toLowerCase() === "undefined"
  ) {
    return "";
  }
  return s;
};

const formatDateTr = (dateStr?: string | null): string => {
  if (!dateStr) return "";
  const clean = dateStr.trim();
  if (!clean || clean === "-" || clean === "—") return "";
  if (clean.includes("T")) {
    const p = clean.split("T")[0].split("-");
    if (p.length === 3) return `${p[2]}.${p[1]}.${p[0]}`;
  }
  if (clean.includes("-")) {
    const p = clean.split("-");
    if (p.length === 3) return `${p[2]}.${p[1]}.${p[0]}`;
  }
  if (clean.includes("/")) {
    const p = clean.split("/");
    if (p.length === 3) return `${p[0].padStart(2, "0")}.${p[1].padStart(2, "0")}.${p[2]}`;
  }
  return clean;
};

export interface DovizTeklifTaniModalProps {
  pageType?: "doviz" | "sarraf";
  show: boolean;
  onHide: () => void;
  fisId?: number | null;
  tip: number; // 0: Alış, 1: Satış
  tarih: string;
  saat?: string;
  seriNo?: string;
  belgeNo?: string;
  unvan: string;
  vergiKimlikNo?: string;
  cariKartId?: number | null;
  // Detay alanları
  detayUyruk?: string;
  detayDogumTarihi?: string;
  detayDogumYeri?: string;
  detayBabaAdi?: string;
  detayAnneAdi?: string;
  detayMeslek?: string;
  detayTelefon?: string;
  detayIlce?: string;
  detayIl?: string;
  detayAdres?: string;
  detayPasaportNo?: string;
  detayCariTipi?: string;
  detayVergiDairesi?: string;
  // Satırlar & tutarlar
  lines: Array<{
    paraKodu: string;
    paraAdi?: string;
    miktar: number | string;
    kur: number | string;
    tutar: number | string;
    usdKarsiligi?: number | string;
    bmv?: number | string;
    kmv?: number | string;
    ettn?: string;
    adet?: number | string;
    milyem?: number | string;
    hasGram?: number | string;
    iscilikiMiktari?: number | string;
    iscilikHasGram?: number | string;
    urunKodu?: string;
    urunAdi?: string;
  }>;
  satirlar?: any[];
  odemeSatirlari?: any[];
  toplamTutar?: number;
  totalMasraf?: number;
  sonToplam?: number;
  bsmvTutari?: number;
  totalKmv?: number;
  komisyonTutari?: number;
  giseUsdKuru?: number;
  istatistikKodu?: string;
  gelisNedeni?: string;
  geldigiUlke?: string;
  vezneKod?: string;
  vezneAd?: string;
  vezne?: any;
  kullaniciAdi?: string;
  toplamHas?: number;
  odenenTutar?: number;
  kalanTutar?: number;
  // Firma bilgileri
  companyDefinitions?: TodvzTanimDto | null;
  firmaVergiDairesi?: string;
  firmaIlce?: string;
  firmaIl?: string;
  ettn?: string;
}

export const DovizTeklifTaniModal: React.FC<DovizTeklifTaniModalProps> = ({
  pageType = "doviz",
  show,
  onHide,
  fisId,
  tip,
  tarih,
  saat,
  seriNo = "",
  belgeNo = "",
  unvan = "",
  vergiKimlikNo = "",
  cariKartId,
  detayUyruk = "",
  detayDogumTarihi = "",
  detayDogumYeri = "",
  detayBabaAdi = "",
  detayAnneAdi = "",
  detayMeslek = "",
  detayTelefon = "",
  detayIlce = "",
  detayIl = "",
  detayAdres = "",
  detayPasaportNo = "",
  detayCariTipi = "",
  detayVergiDairesi = "",
  lines = [],
  satirlar,
  odemeSatirlari,
  toplamTutar = 0,
  totalMasraf = 0,
  sonToplam = 0,
  bsmvTutari = 0,
  totalKmv = 0,
  komisyonTutari = 0,
  giseUsdKuru = 1,
  istatistikKodu = "",
  gelisNedeni = "",
  geldigiUlke = "",
  vezneKod = "",
  vezneAd = "",
  vezne,
  kullaniciAdi,
  toplamHas = 0,
  odenenTutar = 0,
  kalanTutar = 0,
  companyDefinitions,
  firmaVergiDairesi = "",
  firmaIlce = "",
  firmaIl = "",
  ettn = "",
}) => {
  const { user } = useAuth();

  // Yazıcı Listesi ve Seçimi (F9 Fiş Yazdırma ile aynı sistem)
  const [printers, setPrinters] = useState<YaziciItem[]>([]);
  const [systemPrinters, setSystemPrinters] = useState<{ name: string; isDefault?: boolean }[]>([]);
  const [selectedPrinterName, setSelectedPrinterName] = useState<string>("");
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [printSuccessMsg, setPrintSuccessMsg] = useState<string | null>(null);

  // Kimlik Fotoğrafları (Kayıtlı Cari Karttan getirilir)
  const [frontPhoto, setFrontPhoto] = useState<string | null>(null);
  const [backPhoto, setBackPhoto] = useState<string | null>(null);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState<boolean>(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");

  // Müşteri Tanı Formu alanlarının sıfırlanması için key ve düzenleme yardımcıları
  const [taniFormResetKey, setTaniFormResetKey] = useState<number>(0);

  // Müşteri Tanı Formu Alanları (Kayıtlı cari kart varsa otomatik doldurulur)
  const [taniData, setTaniData] = useState({
    adSoyad: "",
    dogumTarihi: "",
    dogumYeri: "",
    tcKimlikNo: "",
    kimlikTuruNo: "",
    uyruk: "",
    adres: "",
    meslek: "",
    telefon: "",
  });

  // 80 mm Termal Fiş Önizleme Durumu (F9 Fiş Yazdırma ile birebir aynı)
  const [thermalReceiptHtml, setThermalReceiptHtml] = useState<string | null>(null);
  const [thermalReceiptHeight, setThermalReceiptHeight] = useState<number>(0);
  const [isGeneratingReceipt, setIsGeneratingReceipt] = useState<boolean>(false);

  // Müşteri bilgisi ve kayıtlı cari kart kontrolü (TC Kimlik varsa gösterilir, yoksa tekrar yükleme dayatılmaz)
  useEffect(() => {
    if (!show) return;

    // Önceki müşteriden kalan fotoğrafları sıfırla
    setFrontPhoto(null);
    setBackPhoto(null);

    const buildAdres = (adr?: string, ilce?: string, il?: string) => {
      const parts = [adr?.trim(), ilce?.trim(), il?.trim()].filter(Boolean);
      return parts.join(" - ");
    };

    const buildKimlikTuru = (tckn?: string, pasaport?: string) => {
      const cleanPass = cleanValue(pasaport);
      const cleanTc = cleanValue(tckn);
      if (cleanPass) return `PASAPORT: ${cleanPass}`;
      if (cleanTc) return `T.C. KİMLİK KARTI / ${cleanTc}`;
      return "";
    };

    const initial = {
      adSoyad: cleanValue(unvan),
      dogumTarihi: formatDateTr(detayDogumTarihi),
      dogumYeri: cleanValue(detayDogumYeri),
      tcKimlikNo: cleanValue(vergiKimlikNo),
      kimlikTuruNo: buildKimlikTuru(cleanValue(vergiKimlikNo), cleanValue(detayPasaportNo)),
      uyruk: cleanValue(detayUyruk) || (cleanValue(vergiKimlikNo) ? "T.C." : ""),
      adres: buildAdres(detayAdres, detayIlce, detayIl),
      meslek: cleanValue(detayMeslek),
      telefon: cleanValue(detayTelefon),
    };

    setTaniData(initial);

    let isMounted = true;

    const loadCariDetails = async () => {
      let targetCari: CariKartItem | null = null;

      // 1. Doğrudan Cari Kart ID ile sorgula
      if (cariKartId && cariKartId > 0) {
        try {
          targetCari = await CariService.getCariKartById(cariKartId);
        } catch {}
      }

      // 2. Cari Kart ID yoksa ama vergiKimlikNo veya unvan varsa kayıtlı kartlar arasında ara
      if (!targetCari && (vergiKimlikNo || unvan)) {
        try {
          const list = await CariService.getCariKartlar();
          const cleanVkn = cleanValue(vergiKimlikNo).replace(/\D/g, "");
          if (cleanVkn) {
            targetCari = list.find((c) => (c.vergiKimlikNo || "").replace(/\D/g, "") === cleanVkn) || null;
          }
          if (!targetCari && unvan && unvan.trim() && unvan.trim().toUpperCase() !== "MUHTELİF MÜŞTERİ") {
            targetCari = list.find((c) => (c.ad || "").trim().toLowerCase() === unvan.trim().toLowerCase()) || null;
          }
        } catch {}
      }

      if (!isMounted || !targetCari) return;

      const effectiveVkn = cleanValue(targetCari.vergiKimlikNo) || cleanValue(vergiKimlikNo);
      const effectivePasaport = cleanValue(targetCari.pasaportNo) || cleanValue(detayPasaportNo);

      setTaniData((prev) => ({
        adSoyad: cleanValue(targetCari?.ad) || cleanValue(targetCari?.yetkiliKisi) || prev.adSoyad,
        dogumTarihi: formatDateTr(targetCari?.dogumTarihi) || prev.dogumTarihi,
        dogumYeri: cleanValue(targetCari?.dogumYeri) || prev.dogumYeri,
        tcKimlikNo: effectiveVkn || prev.tcKimlikNo,
        kimlikTuruNo: buildKimlikTuru(effectiveVkn || prev.tcKimlikNo, effectivePasaport) || prev.kimlikTuruNo,
        uyruk: (effectiveVkn ? "T.C." : "") || prev.uyruk,
        adres: cleanValue(targetCari?.adres) || prev.adres,
        meslek: prev.meslek || "",
        telefon: cleanValue(targetCari?.telefon) || prev.telefon,
      }));

      // Kayıtlı cari kartın önceden yüklenmiş kimlik fotoğrafları varsa otomatik getir
      if (targetCari.id) {
        setIsLoadingPhotos(true);
        try {
          const res = await CariService.getCariFotograf(targetCari.id);
          if (!isMounted) return;
          if (res.fotograflar && res.fotograflar.length > 0) {
            const f1 = res.fotograflar[0]?.dataUrl || (res.fotograflar[0] as any)?.base64 || null;
            const f2 = res.fotograflar[1]?.dataUrl || (res.fotograflar[1] as any)?.base64 || null;
            if (f1) setFrontPhoto(f1);
            if (f2) setBackPhoto(f2);
          } else if (res.fotograf) {
            const f = res.fotograf.dataUrl || (res.fotograf as any)?.base64 || null;
            if (f) setFrontPhoto(f);
          }
        } catch {}
        finally {
          if (isMounted) setIsLoadingPhotos(false);
        }
      }
    };

    loadCariDetails();

    return () => {
      isMounted = false;
    };
  }, [
    show,
    cariKartId,
    unvan,
    vergiKimlikNo,
    detayDogumTarihi,
    detayDogumYeri,
    detayBabaAdi,
    detayAnneAdi,
    detayMeslek,
    detayTelefon,
    detayAdres,
    detayUyruk,
    detayPasaportNo,
    detayIlce,
    detayIl,
  ]);

  // 80 mm Termal Fiş Çıktısını Hazırla (F9 ile birebir aynı sarrafFisHtml veya dovizFisHtml)
  useEffect(() => {
    if (!show) {
      setThermalReceiptHtml(null);
      setThermalReceiptHeight(0);
      return;
    }
    let cancelled = false;
    setIsGeneratingReceipt(true);

    const loadReceipt = async () => {
      try {
        if (pageType === "sarraf") {
          const rawSatirlar =
            satirlar && satirlar.length > 0
              ? satirlar
              : lines.map((l: any, i: number) => ({
                  satirNo: i + 1,
                  urunKodu: l.paraKodu || l.urunKodu || "",
                  urunAdi: l.paraAdi || l.urunAdi || l.paraKodu || "SARRAFİYE",
                  miktar: l.miktar || 0,
                  adet: l.adet || 1,
                  kur: l.kur || 0,
                  tutar: l.tutar || 0,
                  milyem: l.milyem,
                  hasGram: l.hasGram,
                  iscilikiMiktari: l.iscilikiMiktari,
                  iscilikHasGram: l.iscilikHasGram,
                }));
          const girdi = {
            fisId: fisId || null,
            tip,
            tarih,
            saat,
            seriNo,
            belgeNo: belgeNo || "TEKLİF",
            unvan: taniData.adSoyad || unvan,
            vergiKimlikNo: taniData.tcKimlikNo || vergiKimlikNo,
            detayIl: detayIl,
            detayIlce: detayIlce,
            detayUyruk: taniData.uyruk || detayUyruk,
            detayPasaportNo: detayPasaportNo,
            detayMeslek: taniData.meslek || detayMeslek,
            detayCariTipi: detayCariTipi,
            detayAdres: taniData.adres || detayAdres,
            detayTelefonNo: taniData.telefon || detayTelefon,
            vezneKod: vezneKod,
            vezne: vezne || (vezneAd ? { ad: vezneAd, kod: vezneKod } : null),
            kullaniciAdi: kullaniciAdi || user?.fullName || user?.username || "Kasiyer",
            satirlar: rawSatirlar,
            odemeSatirlari: odemeSatirlari || [],
            toplamTutar: toplamTutar || sonToplam || 0,
            toplamHas: toplamHas || 0,
            odenenTutar: odenenTutar || 0,
            kalanTutar: kalanTutar || 0,
          };
          const res = await sarrafFisHtml(girdi, "80");
          if (!cancelled && res?.html) {
            setThermalReceiptHtml(res.html);
            setThermalReceiptHeight(res.yukseklik || 0);
          }
        } else {
          // Döviz fişi
          const girdi = {
            fisId: fisId || null,
            tip,
            tarih,
            saat,
            seriNo,
            belgeNo: belgeNo || "TEKLİF",
            unvan: taniData.adSoyad || unvan,
            vergiKimlikNo: taniData.tcKimlikNo || vergiKimlikNo,
            detayIl: detayIl,
            detayIlce: detayIlce,
            detayUyruk: taniData.uyruk || detayUyruk,
            detayPasaportNo: detayPasaportNo,
            detayMeslek: taniData.meslek || detayMeslek,
            detayCariTipi: detayCariTipi,
            detayAdres: taniData.adres || detayAdres,
            detayTelefonNo: taniData.telefon || detayTelefon,
            vezneKod: vezneKod,
            vezne: vezne || (vezneAd ? { ad: vezneAd, kod: vezneKod } : null),
            kullaniciAdi: kullaniciAdi || user?.fullName || user?.username || "Kasiyer",
            lines: lines || [],
            toplamTutar: toplamTutar || 0,
            totalMasraf: totalMasraf || 0,
            sonToplam: sonToplam || toplamTutar || 0,
            bsmvTutari: bsmvTutari || 0,
            totalKmv: totalKmv || 0,
            komisyonTutari: komisyonTutari || 0,
            giseUsdKuru: giseUsdKuru || 1,
            istatistikKodu: istatistikKodu || "",
            gelisNedeni: gelisNedeni || "",
            geldigiUlke: geldigiUlke || "",
          };
          const res = await dovizFisHtml(girdi);
          if (!cancelled && res?.html) {
            setThermalReceiptHtml(res.html);
            setThermalReceiptHeight(res.yukseklik || 0);
          }
        }
      } catch (err) {
        console.warn("Müşteri tanı formunda 80mm fiş oluşturma hatası:", err);
      } finally {
        if (!cancelled) setIsGeneratingReceipt(false);
      }
    };

    loadReceipt();
    return () => {
      cancelled = true;
    };
  }, [
    show,
    pageType,
    tip,
    tarih,
    saat,
    seriNo,
    belgeNo,
    unvan,
    vergiKimlikNo,
    lines,
    satirlar,
    odemeSatirlari,
    toplamTutar,
    sonToplam,
    toplamHas,
    odenenTutar,
    kalanTutar,
    taniData.adSoyad,
    taniData.tcKimlikNo,
    taniData.adres,
    taniData.telefon,
  ]);

  const thermalScale = useMemo(() => {
    if (!thermalReceiptHeight || thermalReceiptHeight <= 0) return 0.95;
    // 340pt is the available height in the right column of the A4 layout
    if (thermalReceiptHeight > 340) {
      return Math.min(1, Math.max(0.68, Math.round((340 / thermalReceiptHeight) * 100) / 100));
    }
    return 0.95;
  }, [thermalReceiptHeight]);

  useEffect(() => {
    if (show) {
      setTaniFormResetKey((prev) => prev + 1);
    }
  }, [show]);

  const handleTaniCellKeyDown = (e: React.KeyboardEvent<HTMLTableCellElement>, allowMultiline = false) => {
    if (e.key === "Enter" && !allowMultiline) {
      e.preventDefault();
      const cells = Array.from(document.querySelectorAll<HTMLTableCellElement>(".tani-editable-cell"));
      const idx = cells.indexOf(e.currentTarget);
      if (idx >= 0 && idx < cells.length - 1) {
        cells[idx + 1].focus();
      }
    }
  };

  const handleTaniCellPaste = (e: React.ClipboardEvent<HTMLTableCellElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    if (document.queryCommandSupported("insertText")) {
      document.execCommand("insertText", false, text);
    } else {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(text));
        range.collapse(false);
      }
    }
  };

  // Firma tanımları prop gelmediyse veya geciktiyse kendisi servis üzerinden çeker
  const [internalCompDef, setInternalCompDef] = useState<TodvzTanimDto | null>(null);

  useEffect(() => {
    if (show && !companyDefinitions && !internalCompDef) {
      CompanyService.getDefinitions()
        .then((def) => {
          if (def) setInternalCompDef(def);
        })
        .catch(() => {});
    }
  }, [show, companyDefinitions, internalCompDef]);

  const activeCompDef = companyDefinitions || internalCompDef;


  // Yazıcıları F9'daki gibi yükle
  useEffect(() => {
    if (!show) return;
    Promise.all([
      PrinterService.getYazicilar().catch(() => [] as YaziciItem[]),
      PrinterService.getSystemPrinters(user).catch(() => [] as any[]),
    ]).then(([dbList, sysList]) => {
      setPrinters(dbList);
      setSystemPrinters(sysList);

      const savedA4 =
        localStorage.getItem("likya_last_a4_printer") ||
        localStorage.getItem("likya_last_selected_printer");

      if (savedA4) {
        setSelectedPrinterName(savedA4);
      } else if (sysList && sysList.length > 0) {
        const def = sysList.find((p) => p.isDefault) || sysList[0];
        setSelectedPrinterName(def.name);
      } else if (dbList && dbList.length > 0) {
        setSelectedPrinterName(dbList[0].cihazAdi || dbList[0].ad || "");
      }
    });
  }, [show, user]);

  const handlePrinterChange = (name: string) => {
    setSelectedPrinterName(name);
    if (name) {
      localStorage.setItem("likya_last_a4_printer", name);
      fetch("http://127.0.0.1:9100/api/set-default", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ printerName: name }),
      }).catch(() => {});
    }
  };

  const printerOptions = useMemo(() => {
    const list: { name: string; isDefault?: boolean }[] = [];
    const seen = new Set<string>();

    for (const sys of systemPrinters) {
      if (sys.name && !seen.has(sys.name.toLowerCase())) {
        seen.add(sys.name.toLowerCase());
        list.push({ name: sys.name, isDefault: sys.isDefault });
      }
    }

    for (const db of printers) {
      const name = db.cihazAdi || db.ad;
      if (name && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        list.push({ name, isDefault: false });
      }
    }

    return list;
  }, [systemPrinters, printers]);

  // Karekod üretimi (Fişte ve Firma Tanımlarında ne varsa o kodlanır)
  useEffect(() => {
    if (!show) return;
    const qrPayload = JSON.stringify({
      belgeNo: cleanValue(belgeNo) || cleanValue(seriNo) || "",
      tip: tip === 0 ? "ALIM" : "SATIM",
      tarih: cleanValue(tarih),
      vkn: cleanValue(activeCompDef?.VERGI_KIMLIK_NO),
      musteri: cleanValue(vergiKimlikNo),
      tutar: sonToplam || 0,
      ettn: cleanValue(lines?.[0]?.ettn) || cleanValue(ettn) || null,
    });

    QRCode.toDataURL(qrPayload, {
      width: 140,
      margin: 1,
      errorCorrectionLevel: "M",
    })
      .then((url) => setQrCodeDataUrl(url))
      .catch(() => {});
  }, [show, belgeNo, seriNo, tarih, vergiKimlikNo, sonToplam, tip, activeCompDef, lines, ettn]);

  // ══════════════════════════════════════════════════════════════════════════════
  // DOĞRUDAN VE SESSİZ YAZDIRMA (CHROME ÖNİZLEMESİ AÇILMAZ, DOĞRUDAN YAZICIYA GİDER)
  // ══════════════════════════════════════════════════════════════════════════════
  const handleDirectPrint = async () => {
    const printArea = document.getElementById("a4-tani-formu-printable");
    if (!printArea || isPrinting) return;

    setIsPrinting(true);
    setPrintSuccessMsg(null);

    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>DOVIZ ISLEM EVRAK - GERCEK KISI TANI FORMU</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 5mm 8mm;
          }
          * {
            box-sizing: border-box;
          }
          body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #000000;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .a4-tani-sheet {
            width: 100%;
            max-width: 194mm;
            max-height: 282mm;
            margin: 0 auto;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            overflow: hidden !important;
          }
          #tani-formu-tablosu {
            border-collapse: collapse !important;
            width: 100%;
          }
          #tani-formu-tablosu, #tani-formu-tablosu th, #tani-formu-tablosu td {
            border: 1px solid #000000 !important;
          }
          .belge-sablon {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .tani-editable-cell {
            outline: none !important;
            box-shadow: none !important;
            background-color: transparent !important;
          }
        </style>
      </head>
      <body>
        <div class="a4-tani-sheet">
          ${printArea.innerHTML}
        </div>
      </body>
      </html>
    `;

    try {
      const res = await triggerSilentPrint({
        html: fullHtml,
        printerName: selectedPrinterName || null,
        copies: 1,
        isPos: false, // Standart A4 ofis yazıcısı modu
        title: "Doviz_Teklif_Tani_Formu",
        allowBrowserFallback: false,
      });

      if (res.success) {
        setPrintSuccessMsg(`✅ Belge doğrudan "${selectedPrinterName || 'Varsayılan Yazıcı'}" cihazına iletildi.`);
        setTimeout(() => setPrintSuccessMsg(null), 4000);
      } else {
        // Yerel bridge yanıt vermezse sessiz gizli iframe fallback
        printViaHiddenIframe(fullHtml);
      }
    } catch {
      printViaHiddenIframe(fullHtml);
    } finally {
      setIsPrinting(false);
    }
  };

  const printViaHiddenIframe = (html: string) => {
    let iframe = document.getElementById("silent-a4-print-iframe") as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = "silent-a4-print-iframe";
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "none";
      iframe.style.visibility = "hidden";
      document.body.appendChild(iframe);
    }
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch {}
      }, 250);
    }
  };

  const kimlikTuruBelgeNo = (() => {
    const pNo = cleanValue(detayPasaportNo);
    const sNo = cleanValue(seriNo);
    const tcNo = cleanValue(vergiKimlikNo);
    if (pNo) return `PASAPORT / ${pNo}`;
    if (sNo) return `T.C. KİMLİK KARTI / ${sNo}`;
    if (tcNo) return "T.C. KİMLİK KARTI";
    return "";
  })();

  // Hesaplanan Metin ve Değerler (Fişte ve Firma Tanımlarında ne varsa sadece onlar, statik/sahte veri YOK)
  const isAlis = tip === 0;
  const islemTuruText = isAlis ? "ALIS" : "SATIS";
  const effectiveBelgeNo = cleanValue(belgeNo) || cleanValue(seriNo) || "";
  const displaySaat = cleanValue(saat);
  const displayTarih = cleanValue(tarih);

  // Firma bilgileri (Sistemde tanımlı olan neyse o, statik mock veri asla yok)
  const firmaAdi = cleanValue(activeCompDef?.FIRMA_ADI);
  const firmaSubeKodu = cleanValue(activeCompDef?.SUBE_KODU ? String(activeCompDef.SUBE_KODU) : "");
  const firmaDosyaNo = cleanValue(activeCompDef?.DOSYA_NO);
  const firmaTel = cleanValue(activeCompDef?.TELEFON);
  const firmaWeb = cleanValue(activeCompDef?.WEB_ADRESI);
  const firmaEposta = cleanValue(activeCompDef?.EPOSTA);
  const firmaVkn = cleanValue(activeCompDef?.VERGI_KIMLIK_NO);
  const firmaVd = cleanValue(
    firmaVergiDairesi ||
    (activeCompDef as any)?.VERGI_DAIRESI_ADI ||
    (activeCompDef?.VERGI_DAIRESI_ID ? String(activeCompDef.VERGI_DAIRESI_ID) : "")
  );
  const firmaMersis = cleanValue(activeCompDef?.MERSIS_NO);
  const firmaTicSicil = cleanValue(activeCompDef?.TICARET_SICIL_NO);

  // İl / İlçe ile birleşik firma adresi
  const firmaAdresTemel = cleanValue(activeCompDef?.ADRES);
  const firmaIlceIl = [cleanValue(firmaIlce), cleanValue(firmaIl)].filter(Boolean).join(" / ");
  const firmaAdres = firmaAdresTemel
    ? (firmaIlceIl && !firmaAdresTemel.toLowerCase().includes(cleanValue(firmaIl).toLowerCase())
        ? `${firmaAdresTemel} ${firmaIlceIl}`
        : firmaAdresTemel)
    : firmaIlceIl;

  // VD / VKN birleşik
  const firmaVdVkn = [firmaVd, firmaVkn].filter(Boolean).join(" / ");

  // Mersis / Tic.Sic.No birleşik
  const firmaMersisSicil = [firmaMersis, firmaTicSicil].filter(Boolean).join(" / ");

  // Şube / İst. No: subeKodu - dosyaNo / istatistikKodu
  const firmaSubeNo = [firmaSubeKodu, firmaDosyaNo].filter(Boolean).join(" - ");
  const subeIstNo = [firmaSubeNo, cleanValue(istatistikKodu)].filter(Boolean).join(" / ");

  // Kuruş basamak sayıları (Firma Tanımlarından)
  const tlKurusSayisi = activeCompDef?.TL_KURUS_SAYISI !== undefined && activeCompDef?.TL_KURUS_SAYISI !== null
    ? Math.max(2, Number(activeCompDef.TL_KURUS_SAYISI))
    : 2;
  const dovizKurusSayisi = activeCompDef?.DOVIZ_KURUS_SAYISI !== undefined && activeCompDef?.DOVIZ_KURUS_SAYISI !== null
    ? Number(activeCompDef.DOVIZ_KURUS_SAYISI)
    : 2;
  const kurKurusSayisi = activeCompDef?.KUR_KURUS_SAYISI !== undefined && activeCompDef?.KUR_KURUS_SAYISI !== null
    ? Number(activeCompDef.KUR_KURUS_SAYISI)
    : 4;

  // Müşteri bilgileri (Sadece fişte girilmiş olanlar)
  const musteriAdres = detayAdres || [detayIlce, detayIl].filter(Boolean).join(" / ") || "";

  // Döviz satırları (Fişteki gerçek satırlar)
  const validLines = (lines || []).filter((l) => Number(l.miktar) > 0 || Number(l.tutar) > 0);
  const primaryLine = validLines[0] || null;

  // ETTN (Sadece fişte/satırda varsa)
  const effectiveEttn = cleanValue(primaryLine?.ettn) || cleanValue(ettn);

  // Vezne ve Geldiği Ülke
  const displayVezne = cleanValue(vezneKod) || cleanValue(vezneAd) || (firmaSubeKodu ? firmaSubeKodu.padStart(2, "0") : "");
  const displayGeldigiUlke = cleanValue(geldigiUlke) || cleanValue(gelisNedeni) || cleanValue(detayUyruk) || (cleanValue(vergiKimlikNo) ? "Türkiye" : "");

  // Tutar Yazıyla (Sadece fişte tutar varsa yazılır)
  const tutarYaziyla = sonToplam > 0 ? tutarYaziylaTr(Number(sonToplam)) : "";

  return (
    <>
      <Modal
        show={show}
        onHide={onHide}
        size="xl"
        centered
        backdrop="static"
        className="doviz-teklif-tani-modal"
      >
        {/* Modal Başlığı ve Kontroller (Yazdırmada Gizlenir) */}
        <Modal.Header closeButton className="py-2 bg-light border-bottom d-print-none">
          <div className="d-flex align-items-center justify-content-between w-100 me-2 flex-wrap gap-2">
            <div className="d-flex align-items-center gap-2">
              <IconFileText size={20} className="text-primary" />
              <span className="fw-bold fs-6">
                Müşteri Tanı Formu & {pageType === "sarraf" ? "Sarraf" : "Döviz"} İşlem Evrakı (A4)
              </span>
              <Badge bg="info" className="text-white fw-bold shadow-xs" style={{ fontSize: "11px" }}>
                Shift+F10 (Kayıt Etmeden)
              </Badge>
              {cariKartId && (
                <Badge bg="info" className="text-white" style={{ fontSize: "11px" }}>
                  Müşteri: #{cariKartId}
                </Badge>
              )}
            </div>

            <div className="d-flex align-items-center gap-2">
              {/* Yazıcı Seçimi (F9'daki gibi) */}
              <div className="d-flex align-items-center gap-1.5">
                <span className="small fw-bold text-secondary text-nowrap" style={{ fontSize: "11.5px" }}>
                  Yazıcı:
                </span>
                <select
                  className="form-select form-select-sm"
                  style={{ width: "230px", fontSize: "12px", height: "31px" }}
                  value={selectedPrinterName}
                  onChange={(e) => handlePrinterChange(e.target.value)}
                >
                  {printerOptions.length > 0 ? (
                    printerOptions.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name} {p.isDefault ? "(Varsayılan)" : ""}
                      </option>
                    ))
                  ) : (
                    <option value="">{selectedPrinterName || "Varsayılan Yazıcı"}</option>
                  )}
                </select>
              </div>

              <Button
                variant="primary"
                size="sm"
                className="fw-bold px-3 d-flex align-items-center gap-1.5 shadow-2xs"
                style={{ height: "31px", fontSize: "12px" }}
                onClick={handleDirectPrint}
                disabled={isPrinting}
                title="Chrome önizleme penceresi açılmadan doğrudan seçili yazıcıya gönderir"
              >
                {isPrinting ? <Spinner animation="border" size="sm" /> : <IconPrinter size={15} />}
                <span>{isPrinting ? "Yazdırılıyor..." : "Yazdır (A4)"}</span>
              </Button>
            </div>
          </div>
        </Modal.Header>

        <Modal.Body className="p-3 bg-secondary-subtle">
          {printSuccessMsg && (
            <Alert variant="success" className="py-1.5 px-3 mb-2.5 d-print-none fw-semibold shadow-2xs d-flex align-items-center gap-2" style={{ fontSize: "12.5px" }}>
              <IconCheck size={16} /> {printSuccessMsg}
            </Alert>
          )}



          {/* ════════════════════════════════════════════════════════════════════════════════════════════════
              BİREBİR A4 EVRAK ÇIKTISI (GÖRSELDEKİ TARZDA - TEK SAYFA, KALEMLE DOLDURULABİLİR)
          ════════════════════════════════════════════════════════════════════════════════════════════════ */}
          <div className="d-flex justify-content-center">
            <div
              id="a4-tani-formu-printable"
              className="a4-tani-sheet bg-white text-dark shadow-sm"
              style={{
                width: "210mm",
                maxWidth: "210mm",
                maxHeight: "282mm",
                padding: "6mm 10mm",
                boxSizing: "border-box",
                fontFamily: "Arial, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                fontSize: "9px",
                lineHeight: "1.25",
                color: "#000",
                overflow: "hidden",
                pageBreakInside: "avoid",
                breakInside: "avoid",
              }}
            >
              {/* 1. ÜST BAŞLIK */}
              <div style={{ marginBottom: "7px" }}>
                <div style={{ fontWeight: "bold", fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.2px" }}>
                  {firmaAdi}
                </div>
                <div style={{ fontWeight: "bold", fontSize: "11px", textTransform: "uppercase", marginTop: "2px" }}>
                  GERÇEK KİŞİLER İÇİN MÜŞTERİ TANI FORMU
                </div>
              </div>

              {/* 2. MÜŞTERİ TANI FORMU TABLOSU (Müşteri bilgisi varsa otomatik doldurulur, düzenlenebilir) */}
              <table
                id="tani-formu-tablosu"
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  border: "1.5px solid #000",
                  fontSize: "9.5px",
                  lineHeight: "1.25",
                  marginBottom: "9px",
                }}
              >
                <tbody key={`${taniFormResetKey}-${taniData.adSoyad || ''}-${taniData.tcKimlikNo || ''}`}>
                  <tr>
                    <td style={{ width: "210px", fontWeight: "bold", border: "1px solid #000", padding: "2px 6px" }}>
                      Adı ve soyadı
                    </td>
                    <td
                      contentEditable
                      suppressContentEditableWarning
                      className="tani-editable-cell"
                      onKeyDown={(e) => handleTaniCellKeyDown(e, false)}
                      onPaste={handleTaniCellPaste}
                      onBlur={(e) => {
                        const v = e.currentTarget.innerText.trim();
                        setTaniData((prev) => ({ ...prev, adSoyad: v }));
                      }}
                      title="Bilgi girmek için tıklayınız"
                      style={{
                        border: "1px solid #000",
                        padding: "2px 6px",
                        fontWeight: "500",
                        textTransform: "uppercase",
                        height: "19px",
                        minHeight: "19px",
                        cursor: "text",
                        outline: "none",
                        verticalAlign: "middle",
                      }}
                    >
                      {taniData.adSoyad}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: "bold", border: "1px solid #000", padding: "2px 6px" }}>
                      Doğum tarihi
                    </td>
                    <td
                      contentEditable
                      suppressContentEditableWarning
                      className="tani-editable-cell"
                      onKeyDown={(e) => handleTaniCellKeyDown(e, false)}
                      onPaste={handleTaniCellPaste}
                      onBlur={(e) => {
                        const v = e.currentTarget.innerText.trim();
                        setTaniData((prev) => ({ ...prev, dogumTarihi: v }));
                      }}
                      title="Bilgi girmek için tıklayınız"
                      style={{
                        border: "1px solid #000",
                        padding: "2px 6px",
                        height: "19px",
                        minHeight: "19px",
                        cursor: "text",
                        outline: "none",
                        verticalAlign: "middle",
                      }}
                    >
                      {taniData.dogumTarihi}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: "bold", border: "1px solid #000", padding: "2px 6px" }}>
                      Doğum yeri
                    </td>
                    <td
                      contentEditable
                      suppressContentEditableWarning
                      className="tani-editable-cell"
                      onKeyDown={(e) => handleTaniCellKeyDown(e, false)}
                      onPaste={handleTaniCellPaste}
                      onBlur={(e) => {
                        const v = e.currentTarget.innerText.trim();
                        setTaniData((prev) => ({ ...prev, dogumYeri: v }));
                      }}
                      title="Bilgi girmek için tıklayınız"
                      style={{
                        border: "1px solid #000",
                        padding: "2px 6px",
                        textTransform: "uppercase",
                        height: "19px",
                        minHeight: "19px",
                        cursor: "text",
                        outline: "none",
                        verticalAlign: "middle",
                      }}
                    >
                      {taniData.dogumYeri}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: "bold", border: "1px solid #000", padding: "2px 6px" }}>
                      T.C. kimlik numarası
                    </td>
                    <td
                      contentEditable
                      suppressContentEditableWarning
                      className="tani-editable-cell"
                      onKeyDown={(e) => handleTaniCellKeyDown(e, false)}
                      onPaste={handleTaniCellPaste}
                      onBlur={(e) => {
                        const v = e.currentTarget.innerText.trim();
                        setTaniData((prev) => ({ ...prev, tcKimlikNo: v }));
                      }}
                      title="Bilgi girmek için tıklayınız"
                      style={{
                        border: "1px solid #000",
                        padding: "2px 6px",
                        height: "19px",
                        minHeight: "19px",
                        cursor: "text",
                        outline: "none",
                        verticalAlign: "middle",
                      }}
                    >
                      {taniData.tcKimlikNo}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: "bold", border: "1px solid #000", padding: "2px 6px" }}>
                      Kimlik türü / belge no
                    </td>
                    <td
                      contentEditable
                      suppressContentEditableWarning
                      className="tani-editable-cell"
                      onKeyDown={(e) => handleTaniCellKeyDown(e, false)}
                      onPaste={handleTaniCellPaste}
                      onBlur={(e) => {
                        const v = e.currentTarget.innerText.trim();
                        setTaniData((prev) => ({ ...prev, kimlikTuruNo: v }));
                      }}
                      title="Bilgi girmek için tıklayınız"
                      style={{
                        border: "1px solid #000",
                        padding: "2px 6px",
                        height: "19px",
                        minHeight: "19px",
                        cursor: "text",
                        outline: "none",
                        verticalAlign: "middle",
                      }}
                    >
                      {taniData.kimlikTuruNo}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: "bold", border: "1px solid #000", padding: "2px 6px" }}>
                      Uyruğu
                    </td>
                    <td
                      contentEditable
                      suppressContentEditableWarning
                      className="tani-editable-cell"
                      onKeyDown={(e) => handleTaniCellKeyDown(e, false)}
                      onPaste={handleTaniCellPaste}
                      onBlur={(e) => {
                        const v = e.currentTarget.innerText.trim();
                        setTaniData((prev) => ({ ...prev, uyruk: v }));
                      }}
                      title="Bilgi girmek için tıklayınız"
                      style={{
                        border: "1px solid #000",
                        padding: "2px 6px",
                        textTransform: "uppercase",
                        height: "19px",
                        minHeight: "19px",
                        cursor: "text",
                        outline: "none",
                        verticalAlign: "middle",
                      }}
                    >
                      {taniData.uyruk}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: "bold", border: "1px solid #000", padding: "2px 6px" }}>
                      Adresi
                    </td>
                    <td
                      contentEditable
                      suppressContentEditableWarning
                      className="tani-editable-cell"
                      onKeyDown={(e) => handleTaniCellKeyDown(e, true)}
                      onPaste={handleTaniCellPaste}
                      onBlur={(e) => {
                        const v = e.currentTarget.innerText.trim();
                        setTaniData((prev) => ({ ...prev, adres: v }));
                      }}
                      title="Bilgi girmek için tıklayınız"
                      style={{
                        border: "1px solid #000",
                        padding: "2px 6px",
                        textTransform: "uppercase",
                        minHeight: "19px",
                        cursor: "text",
                        outline: "none",
                        verticalAlign: "middle",
                      }}
                    >
                      {taniData.adres}
                    </td>
                  </tr>
                  <tr style={{ height: "13px" }}>
                    <td style={{ border: "1px solid #000", padding: "1px 6px" }}></td>
                    <td
                      contentEditable
                      suppressContentEditableWarning
                      className="tani-editable-cell"
                      onKeyDown={(e) => handleTaniCellKeyDown(e, false)}
                      onPaste={handleTaniCellPaste}
                      title="Bilgi girmek için tıklayınız"
                      style={{
                        border: "1px solid #000",
                        padding: "1px 6px",
                        height: "13px",
                        minHeight: "13px",
                        cursor: "text",
                        outline: "none",
                        verticalAlign: "middle",
                      }}
                    ></td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: "bold", border: "1px solid #000", padding: "2px 6px" }}>
                      Mesleği
                    </td>
                    <td
                      contentEditable
                      suppressContentEditableWarning
                      className="tani-editable-cell"
                      onKeyDown={(e) => handleTaniCellKeyDown(e, false)}
                      onPaste={handleTaniCellPaste}
                      onBlur={(e) => {
                        const v = e.currentTarget.innerText.trim();
                        setTaniData((prev) => ({ ...prev, meslek: v }));
                      }}
                      title="Bilgi girmek için tıklayınız"
                      style={{
                        border: "1px solid #000",
                        padding: "2px 6px",
                        textTransform: "uppercase",
                        height: "19px",
                        minHeight: "19px",
                        cursor: "text",
                        outline: "none",
                        verticalAlign: "middle",
                      }}
                    >
                      {taniData.meslek}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: "bold", border: "1px solid #000", padding: "2px 6px" }}>
                      Telefonu
                    </td>
                    <td
                      contentEditable
                      suppressContentEditableWarning
                      className="tani-editable-cell"
                      onKeyDown={(e) => handleTaniCellKeyDown(e, false)}
                      onPaste={handleTaniCellPaste}
                      onBlur={(e) => {
                        const v = e.currentTarget.innerText.trim();
                        setTaniData((prev) => ({ ...prev, telefon: v }));
                      }}
                      title="Bilgi girmek için tıklayınız"
                      style={{
                        border: "1px solid #000",
                        padding: "2px 6px",
                        height: "19px",
                        minHeight: "19px",
                        cursor: "text",
                        outline: "none",
                        verticalAlign: "middle",
                      }}
                    >
                      {taniData.telefon}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* 3. İKİ SÜTUNLU ALT GÖVDE: SOLDA FOTOKOPİ, SAĞDA DÖVİZ İŞLEM FİŞİ */}
              <div style={{ display: "flex", gap: "12px", width: "100%", alignItems: "flex-start" }}>
                {/* SOL SÜTUN: KİMLİK / PASAPORT FOTOKOPİSİ */}
                <div style={{ width: "47%", display: "flex", flexDirection: "column" }}>
                  <div style={{ fontWeight: "bold", fontSize: "10.5px", textTransform: "uppercase", marginBottom: "5px" }}>
                    KİMLİK / PASAPORT FOTOKOPİSİ
                  </div>

                  {/* Fotoğraf Kutusu: Üstte Arka Yüz, Altta Ön Yüz */}
                  <div
                    style={{
                      border: "1.5px solid #000",
                      width: "100%",
                      height: "270px",
                      display: "flex",
                      flexDirection: "column",
                      backgroundColor: "#ffffff",
                      overflow: "hidden",
                    }}
                  >
                    {backPhoto && frontPhoto ? (
                      <>
                        <div
                          style={{
                            height: "50%",
                            width: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            borderBottom: "1px solid #e2e8f0",
                            overflow: "hidden",
                            padding: "2px",
                          }}
                        >
                          <img
                            src={backPhoto}
                            alt="Kimlik Arka Yüz"
                            style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }}
                          />
                        </div>
                        <div
                          style={{
                            height: "50%",
                            width: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            overflow: "hidden",
                            padding: "2px",
                          }}
                        >
                          <img
                            src={frontPhoto}
                            alt="Kimlik Ön Yüz"
                            style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }}
                          />
                        </div>
                      </>
                    ) : frontPhoto ? (
                      <div
                        style={{
                          height: "100%",
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "2px",
                        }}
                      >
                        <img
                          src={frontPhoto}
                          alt="Kimlik Fotoğrafı"
                          style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }}
                        />
                      </div>
                    ) : backPhoto ? (
                      <div
                        style={{
                          height: "100%",
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "2px",
                        }}
                      >
                        <img
                          src={backPhoto}
                          alt="Kimlik Fotoğrafı"
                          style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }}
                        />
                      </div>
                    ) : (
                      <div
                        style={{
                          height: "100%",
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: "#fafafa",
                        }}
                      ></div>
                    )}
                  </div>

                  {/* Beyan ve İmza Alanı */}
                  <div style={{ marginTop: "11px", fontSize: "9px", lineHeight: "1.35", color: "#000" }}>
                    <div>
                      {pageType === "sarraf"
                        ? "Kıymetli maden, ziynet ve sarrafiye alım satım işlemlerinde başkası hesabına hareket etmediğimi beyan ve kabul ederim."
                        : "Döviz alım satım işlemlerinde başkası hesabına hareket etmediğimi beyan ve kabul ederim."}
                    </div>
                    <div style={{ marginTop: "24px", fontWeight: "bold" }}>
                      Müşterinin adı, soyadı ve imzası
                    </div>
                    <div style={{ marginTop: "46px", fontSize: "8.5px" }}>
                      Ek: 1. Kimlik ve/veya Pasaport Fotokopisi
                    </div>
                  </div>
                </div>

                {/* SAĞ SÜTUN: 80 MM TERMAL FİŞ (F9 İLE BİREBİR AYNI) */}
                <div style={{ width: "53%", display: "flex", flexDirection: "column" }}>
                  <div
                    style={{
                      fontWeight: "bold",
                      fontSize: "10px",
                      textTransform: "uppercase",
                      marginBottom: "4px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>{pageType === "sarraf" ? "SARRAF İŞLEM FİŞİ (80 mm)" : "DÖVİZ İŞLEM FİŞİ (80 mm)"}</span>
                    <span style={{ fontSize: "8px", fontWeight: "normal", color: "#666" }}>
                      80 mm Termal Fiş
                    </span>
                  </div>

                  {thermalReceiptHtml ? (
                    <div
                      style={{
                        border: "1px dashed #777",
                        borderRadius: "2px",
                        padding: "2px",
                        backgroundColor: "#ffffff",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "flex-start",
                        overflow: "hidden",
                        minHeight: "155mm",
                        maxHeight: "172mm",
                        boxSizing: "border-box",
                      }}
                    >
                      <div
                        style={{
                          transform: `scale(${thermalScale})`,
                          transformOrigin: "top center",
                          width: "226.77pt", // 80mm
                          backgroundColor: "#ffffff",
                        }}
                        dangerouslySetInnerHTML={{ __html: thermalReceiptHtml }}
                      />
                    </div>
                  ) : isGeneratingReceipt ? (
                    <div
                      style={{
                        border: "1px dashed #aaa",
                        borderRadius: "2px",
                        padding: "30px 10px",
                        textAlign: "center",
                        color: "#555",
                        fontSize: "9.5px",
                        backgroundColor: "#fafafa",
                        minHeight: "155mm",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                      }}
                    >
                      <div className="spinner-border spinner-border-sm text-primary" role="status" />
                      <span>80 mm işlem fişi hazırlanıyor...</span>
                    </div>
                  ) : (
                    <div
                      style={{
                        border: "1px dashed #aaa",
                        borderRadius: "2px",
                        padding: "20px",
                        textAlign: "center",
                        color: "#888",
                        fontSize: "9.5px",
                        backgroundColor: "#fafafa",
                        minHeight: "155mm",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      Fiş bilgisi bulunamadı veya henüz eklenmedi.
                    </div>
                  )}
                </div>
              </div>

              {/* 4. ALT YASAL MEVZUAT BİLGİLENDİRMESİ */}
              <div style={{ marginTop: "9px", fontSize: "7.5px", lineHeight: "1.2", color: "#333" }}>
                * Bu formdaki bilgiler ve ekli belgeler; 5549 Sayılı Suç Gelirlerinin Aklanmasının Önlenmesi ve Terörün Finansmanının Önlenmesine Dair Tedbirler Hakkında Yönetmeliğin ilgili maddeleri kapsamında talep edilmektedir.
              </div>
            </div>
          </div>
        </Modal.Body>

        {/* Yazdırma ve Düzenleme Stilleri */}
        <style>{`
          .tani-editable-cell {
            outline: none;
            cursor: text;
            transition: background-color 0.15s ease;
          }
          .tani-editable-cell:hover {
            background-color: #f1f5f9;
          }
          .tani-editable-cell:focus {
            background-color: #ffffff;
            box-shadow: inset 0 0 0 1.5px #2563eb !important;
          }
          @media print {
            .tani-editable-cell {
              outline: none !important;
              box-shadow: none !important;
              background-color: transparent !important;
            }
            body * {
              visibility: hidden !important;
            }
            #a4-tani-formu-printable,
            #a4-tani-formu-printable * {
              visibility: visible !important;
            }
            #a4-tani-formu-printable {
              position: fixed !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              max-height: 282mm !important;
              margin: 0 !important;
              padding: 5mm 8mm !important;
              box-shadow: none !important;
              background: #ffffff !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              overflow: hidden !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            .modal, .modal-backdrop {
              position: static !important;
              background: transparent !important;
            }
          }
        `}</style>
      </Modal>


    </>
  );
};
