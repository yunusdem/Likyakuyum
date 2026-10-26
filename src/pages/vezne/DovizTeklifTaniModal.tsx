import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Modal, Button, Row, Col, Spinner, Badge, Alert } from "react-bootstrap";
import {
  IconPrinter,
  IconX,
  IconUpload,
  IconTrash,
  IconDeviceFloppy,
  IconId,
  IconFileText,
  IconCamera,
  IconCheck,
} from "@tabler/icons-react";
import QRCode from "qrcode";
import { CariService } from "../../services/cariService";
import { TodvzTanimDto } from "../../services/companyService";
import { tutarYaziylaTr } from "../../utils/tutarYaziyla";
import { PrinterService, YaziciItem } from "../../services/printerService";
import { useAuth } from "../../context/AuthContext";
import { triggerSilentPrint } from "../../services/silentPrintService";

const formatNumberTr = (val: number, decimals: number = 2) => {
  if (val === undefined || val === null || isNaN(val)) return "0,00";
  return val.toLocaleString("tr-TR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

export interface DovizTeklifTaniModalProps {
  show: boolean;
  onHide: () => void;
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
  // Satırlar & tutarlar
  lines: Array<{
    paraKodu: string;
    paraAdi?: string;
    miktar: number | string;
    kur: number | string;
    tutar: number | string;
    usdKarsiligi?: number | string;
    bmv?: number | string;
    ettn?: string;
  }>;
  toplamTutar?: number;
  totalMasraf?: number;
  sonToplam?: number;
  bsmvTutari?: number;
  giseUsdKuru?: number;
  istatistikKodu?: string;
  gelisNedeni?: string;
  // Firma bilgileri
  companyDefinitions?: TodvzTanimDto | null;
}

export const DovizTeklifTaniModal: React.FC<DovizTeklifTaniModalProps> = ({
  show,
  onHide,
  tip,
  tarih,
  saat,
  seriNo = "",
  belgeNo = "",
  unvan = "",
  vergiKimlikNo = "",
  cariKartId,
  detayUyruk = "",
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
  lines = [],
  toplamTutar = 0,
  totalMasraf = 0,
  sonToplam = 0,
  bsmvTutari = 0,
  giseUsdKuru = 1,
  istatistikKodu = "",
  gelisNedeni = "",
  companyDefinitions,
}) => {
  const { user } = useAuth();

  // Yazıcı Listesi ve Seçimi (F9 Fiş Yazdırma ile aynı sistem)
  const [printers, setPrinters] = useState<YaziciItem[]>([]);
  const [systemPrinters, setSystemPrinters] = useState<{ name: string; isDefault?: boolean }[]>([]);
  const [selectedPrinterName, setSelectedPrinterName] = useState<string>("");
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [printSuccessMsg, setPrintSuccessMsg] = useState<string | null>(null);

  // Kimlik Fotoğrafları (Ön ve Arka Yüz)
  const [frontPhoto, setFrontPhoto] = useState<string | null>(null);
  const [backPhoto, setBackPhoto] = useState<string | null>(null);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState<boolean>(false);
  const [isSavingToCari, setIsSavingToCari] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");

  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);

  // Kamera Çekim Modalı State
  const [showCameraModal, setShowCameraModal] = useState<boolean>(false);
  const [cameraTarget, setCameraTarget] = useState<"front" | "back">("front");
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const videoRef = useRef<HTMLVideoElement>(null);

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

  // Kamera akışını durdur
  const stopCameraStream = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
  }, [cameraStream]);

  // Kamera Modalını Aç
  const openCameraModal = async (target: "front" | "back") => {
    setCameraTarget(target);
    setShowCameraModal(true);
    setCameraError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("Tarayıcınız kamera erişimini desteklemiyor veya güvenli bağlantı (HTTPS/localhost) gereklidir.");
        return;
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      const vDevs = devices.filter((d) => d.kind === "videoinput");
      setVideoDevices(vDevs);

      const constraints: MediaStreamConstraints = {
        video: selectedDeviceId
          ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
          : { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setCameraStream(stream);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 150);
    } catch (err: any) {
      setCameraError("Kameraya erişilemedi: " + (err.message || "İzin verilmedi"));
    }
  };

  const handleDeviceChange = async (devId: string) => {
    setSelectedDeviceId(devId);
    stopCameraStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: devId }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      setCameraStream(stream);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 150);
    } catch (err: any) {
      setCameraError("Kamera değiştirilemedi: " + (err.message || ""));
    }
  };

  const captureCameraPhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64 = canvas.toDataURL("image/jpeg", 0.92);

    if (cameraTarget === "front") {
      setFrontPhoto(base64);
    } else {
      setBackPhoto(base64);
    }
    stopCameraStream();
    setShowCameraModal(false);
  };

  const closeCameraModal = () => {
    stopCameraStream();
    setShowCameraModal(false);
  };

  useEffect(() => {
    if (!show) {
      stopCameraStream();
    }
  }, [show, stopCameraStream]);

  // Müşteri kartında önceden kayıtlı fotoğraflar varsa otomatik getir (Bir kere kaydedince tekrar sormaz)
  useEffect(() => {
    if (!show) return;
    if (cariKartId) {
      setIsLoadingPhotos(true);
      CariService.getCariFotograf(cariKartId)
        .then((res) => {
          if (res.fotograflar && res.fotograflar.length > 0) {
            const f1 = res.fotograflar[0]?.dataUrl || (res.fotograflar[0] as any)?.base64 || null;
            const f2 = res.fotograflar[1]?.dataUrl || (res.fotograflar[1] as any)?.base64 || null;
            if (f1) setFrontPhoto(f1);
            if (f2) setBackPhoto(f2);
          } else if (res.fotograf) {
            const f = res.fotograf.dataUrl || (res.fotograf as any)?.base64 || null;
            if (f) setFrontPhoto(f);
          }
        })
        .catch(() => {})
        .finally(() => setIsLoadingPhotos(false));
    }
  }, [show, cariKartId]);

  // Karekod üretimi (Fişte ne varsa o kodlanır)
  useEffect(() => {
    if (!show) return;
    const qrPayload = JSON.stringify({
      belgeNo: belgeNo || seriNo || "",
      tarih: tarih || "",
      musteri: unvan || "",
      tckn: vergiKimlikNo || "",
      tutar: sonToplam || 0,
      tip: tip === 0 ? "ALIM" : "SATIM",
    });

    QRCode.toDataURL(qrPayload, {
      width: 140,
      margin: 1,
      errorCorrectionLevel: "M",
    })
      .then((url) => setQrCodeDataUrl(url))
      .catch(() => {});
  }, [show, belgeNo, seriNo, tarih, unvan, vergiKimlikNo, sonToplam, tip]);

  // Fotoğraf Yükleme İşleyicisi (Dosya Seçimi)
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, isFront: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const b64 = event.target?.result as string;
      if (isFront) {
        setFrontPhoto(b64);
      } else {
        setBackPhoto(b64);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Yüklenen Fotoğrafları Müşteri Kartına Kaydet (Cari Kart Id varsa)
  const handleSavePhotosToCari = async () => {
    if (!cariKartId) {
      alert("Fotoğrafları cari karta bağlayabilmek için geçerli bir kayıtlı müşteri seçilmelidir.");
      return;
    }
    if (!frontPhoto && !backPhoto) {
      alert("Lütfen önce kaydedilecek kimlik ön veya arka yüz fotoğrafı yükleyiniz.");
      return;
    }

    try {
      setIsSavingToCari(true);
      if (frontPhoto) {
        await CariService.saveCariFotograf(cariKartId, {
          base64: frontPhoto,
          belgeTuru: 0,
          dosyaAdi: "kimlik_on.jpg",
          mimeTipi: "image/jpeg",
        });
      }
      if (backPhoto) {
        await CariService.saveCariFotograf(cariKartId, {
          base64: backPhoto,
          belgeTuru: 0,
          dosyaAdi: "kimlik_arka.jpg",
          mimeTipi: "image/jpeg",
        });
      }
      setSaveSuccessMsg("✅ Kimlik fotoğrafları müşteri kartına kaydedildi.");
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err: any) {
      alert("Fotoğraflar kaydedilirken hata oluştu: " + (err.message || err));
    } finally {
      setIsSavingToCari(false);
    }
  };

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
          table {
            border-collapse: collapse !important;
            width: 100%;
          }
          table, th, td {
            border: 1px solid #000000 !important;
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

  // Hesaplanan Metin ve Değerler (Fişte ne varsa sadece onlar)
  const isAlis = tip === 0;
  const islemTuruText = isAlis ? "ALIS" : "SATIS";
  const effectiveBelgeNo = belgeNo || seriNo || "";
  const displaySaat = saat || "";
  const displayTarih = tarih || "";

  // Firma bilgileri (Sistemde tanımlı olan neyse o, sahte/mock veri yok)
  const firmaAdi = companyDefinitions?.FIRMA_ADI || "";
  const subeAdi = companyDefinitions?.SUBE_ADI ? `${companyDefinitions.SUBE_ADI}` : "";
  const firmaAdres = companyDefinitions?.ADRES || "";
  const firmaVkn = companyDefinitions?.VERGI_KIMLIK_NO || "";
  const subeKodu = companyDefinitions?.SUBE_KODU ? String(companyDefinitions.SUBE_KODU) : "1";

  // Müşteri bilgileri (Sadece fişte girilmiş olanlar)
  const musteriAdres = detayAdres || [detayIlce, detayIl].filter(Boolean).join(" / ") || "";

  // Döviz satırları (Fişteki gerçek satırlar)
  const validLines = (lines || []).filter((l) => Number(l.miktar) > 0 || Number(l.tutar) > 0);
  const primaryLine = validLines[0] || null;

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
              <span className="fw-bold fs-6">Döviz İşlem Evrak & Gerçek Kişi Tanı Formu (A4 Teklif)</span>
              <Badge bg="warning" text="dark" className="border border-warning-subtle fw-bold" style={{ fontSize: "11px" }}>
                Fiş Kaydedilmeden Yazdırılır (Teklif)
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

          {/* Fotoğraf Yükleme ve Hızlı İşlem Paneli (Yazdırmada Gizlenir) */}
          <div className="p-2.5 mb-3 bg-white border rounded-3 shadow-2xs d-print-none">
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2 pb-2 border-bottom">
              <div className="d-flex align-items-center gap-2">
                <IconId size={18} className="text-primary" />
                <strong style={{ fontSize: "13px" }}>Müşteri Kimlik Fotoğrafları (Ön & Arka Yüz)</strong>
                {isLoadingPhotos && <Spinner animation="border" size="sm" className="text-primary" />}
              </div>
              <div className="d-flex align-items-center gap-2">
                {cariKartId && (
                  <Button
                    variant="outline-success"
                    size="sm"
                    className="d-flex align-items-center gap-1 fw-bold"
                    style={{ fontSize: "12px" }}
                    onClick={handleSavePhotosToCari}
                    disabled={isSavingToCari || (!frontPhoto && !backPhoto)}
                  >
                    {isSavingToCari ? <Spinner animation="border" size="sm" /> : <IconDeviceFloppy size={14} />}
                    <span>Kimlik Fotoğraflarını Müşteri Kartına Kaydet</span>
                  </Button>
                )}
              </div>
            </div>

            {saveSuccessMsg && (
              <Alert variant="success" className="py-1 px-2 mb-2" style={{ fontSize: "12px" }}>
                {saveSuccessMsg}
              </Alert>
            )}

            <Row className="g-2">
              {/* Ön Yüz Yükleme */}
              <Col md={6}>
                <div
                  className="p-2 border rounded-2 d-flex align-items-center justify-content-between"
                  style={{ backgroundColor: frontPhoto ? "#f0fdf4" : "#f8fafc", minHeight: "65px" }}
                >
                  <div className="d-flex align-items-center gap-2">
                    {frontPhoto ? (
                      <img
                        src={frontPhoto}
                        alt="Ön Yüz"
                        style={{ width: "70px", height: "45px", objectFit: "cover", borderRadius: "4px", border: "1px solid #86efac" }}
                      />
                    ) : (
                      <div
                        className="d-flex align-items-center justify-content-center bg-light text-muted border rounded"
                        style={{ width: "70px", height: "45px", fontSize: "10px" }}
                      >
                        Ön Yüz Yok
                      </div>
                    )}
                    <div>
                      <div className="fw-bold" style={{ fontSize: "12px" }}>
                        1. Kimlik Ön Yüzü
                      </div>
                      <div className="text-muted" style={{ fontSize: "11px" }}>
                        {frontPhoto ? "Fotoğraf yüklendi ✓" : "Dosyadan seçin veya kamerayla çekin"}
                      </div>
                    </div>
                  </div>
                  <div className="d-flex align-items-center gap-1">
                    <Button
                      variant={frontPhoto ? "outline-primary" : "primary"}
                      size="sm"
                      className="py-1 px-2 d-inline-flex align-items-center gap-1"
                      style={{ fontSize: "11px" }}
                      onClick={() => frontInputRef.current?.click()}
                      title="Bilgisayardan dosya seç"
                    >
                      <IconUpload size={13} /> {frontPhoto ? "Dosyadan Değiştir" : "Dosyadan Seç"}
                    </Button>
                    <Button
                      variant={frontPhoto ? "outline-info" : "info"}
                      size="sm"
                      className="py-1 px-2 text-white d-inline-flex align-items-center gap-1"
                      style={{ fontSize: "11px", backgroundColor: "#0284c7", borderColor: "#0369a1" }}
                      onClick={() => openCameraModal("front")}
                      title="Kamera ile fotoğraf çek"
                    >
                      <IconCamera size={13} /> Kamera
                    </Button>
                    {frontPhoto && (
                      <Button
                        variant="outline-danger"
                        size="sm"
                        className="py-1 px-1.5"
                        onClick={() => setFrontPhoto(null)}
                        title="Fotoğrafı Kaldır"
                      >
                        <IconTrash size={13} />
                      </Button>
                    )}
                  </div>
                </div>
              </Col>

              {/* Arka Yüz Yükleme */}
              <Col md={6}>
                <div
                  className="p-2 border rounded-2 d-flex align-items-center justify-content-between"
                  style={{ backgroundColor: backPhoto ? "#f0fdf4" : "#f8fafc", minHeight: "65px" }}
                >
                  <div className="d-flex align-items-center gap-2">
                    {backPhoto ? (
                      <img
                        src={backPhoto}
                        alt="Arka Yüz"
                        style={{ width: "70px", height: "45px", objectFit: "cover", borderRadius: "4px", border: "1px solid #86efac" }}
                      />
                    ) : (
                      <div
                        className="d-flex align-items-center justify-content-center bg-light text-muted border rounded"
                        style={{ width: "70px", height: "45px", fontSize: "10px" }}
                      >
                        Arka Yüz Yok
                      </div>
                    )}
                    <div>
                      <div className="fw-bold" style={{ fontSize: "12px" }}>
                        2. Kimlik Arka Yüzü
                      </div>
                      <div className="text-muted" style={{ fontSize: "11px" }}>
                        {backPhoto ? "Fotoğraf yüklendi ✓" : "Dosyadan seçin veya kamerayla çekin"}
                      </div>
                    </div>
                  </div>
                  <div className="d-flex align-items-center gap-1">
                    <Button
                      variant={backPhoto ? "outline-primary" : "primary"}
                      size="sm"
                      className="py-1 px-2 d-inline-flex align-items-center gap-1"
                      style={{ fontSize: "11px" }}
                      onClick={() => backInputRef.current?.click()}
                      title="Bilgisayardan dosya seç"
                    >
                      <IconUpload size={13} /> {backPhoto ? "Dosyadan Değiştir" : "Dosyadan Seç"}
                    </Button>
                    <Button
                      variant={backPhoto ? "outline-info" : "info"}
                      size="sm"
                      className="py-1 px-2 text-white d-inline-flex align-items-center gap-1"
                      style={{ fontSize: "11px", backgroundColor: "#0284c7", borderColor: "#0369a1" }}
                      onClick={() => openCameraModal("back")}
                      title="Kamera ile fotoğraf çek"
                    >
                      <IconCamera size={13} /> Kamera
                    </Button>
                    {backPhoto && (
                      <Button
                        variant="outline-danger"
                        size="sm"
                        className="py-1 px-1.5"
                        onClick={() => setBackPhoto(null)}
                        title="Fotoğrafı Kaldır"
                      >
                        <IconTrash size={13} />
                      </Button>
                    )}
                  </div>
                </div>
              </Col>
            </Row>

            <input
              ref={frontInputRef}
              type="file"
              accept="image/*"
              className="d-none"
              onChange={(e) => handlePhotoUpload(e, true)}
            />
            <input
              ref={backInputRef}
              type="file"
              accept="image/*"
              className="d-none"
              onChange={(e) => handlePhotoUpload(e, false)}
            />
          </div>

          {/* ════════════════════════════════════════════════════════════════════════════════════════════════
              BİREBİR A4 EVRAK ÇIKTISI (KESİNLİKLE TEK SAYFA - 2. SAYFAYA TAŞMAZ, YAZILAR ÜST ÜSTE BİNMEZ)
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
                fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Arial, sans-serif",
                fontSize: "9px",
                lineHeight: "1.25",
                color: "#000",
                overflow: "hidden",
                pageBreakInside: "avoid",
                breakInside: "avoid",
              }}
            >
              {/* 1. BAŞLIK */}
              <div
                className="text-center fw-bold text-uppercase py-1 mb-1.5"
                style={{
                  fontSize: "12px",
                  letterSpacing: "0.5px",
                  borderBottom: "1.5px solid #000",
                  lineHeight: "1.2",
                }}
              >
                DOVIZ ISLEM EVRAK - GERCEK KISI TANI FORMU
              </div>

              {/* 2. KİMLİK FOTOĞRAFLARI (YAN YANA İKİ KUTU - Sabit Oran, Taşma Yapmaz) */}
              <div className="d-flex gap-2.5 mb-1.5" style={{ height: "110px", width: "100%" }}>
                {/* Sol: Ön Yüz */}
                <div
                  className="flex-fill border border-dark rounded-1 d-flex align-items-center justify-content-center p-1"
                  style={{ backgroundColor: "#fafafa", height: "100%", overflow: "hidden" }}
                >
                  {frontPhoto ? (
                    <img
                      src={frontPhoto}
                      alt="Kimlik Ön Yüz"
                      style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain", borderRadius: "2px" }}
                    />
                  ) : (
                    <div className="text-center text-muted fst-italic" style={{ fontSize: "10px" }}>
                      [ TÜRKİYE CUMHURİYETİ KİMLİK KARTI - ÖN YÜZ FOTOKOPİSİ ALANI ]
                    </div>
                  )}
                </div>

                {/* Sağ: Arka Yüz */}
                <div
                  className="flex-fill border border-dark rounded-1 d-flex align-items-center justify-content-center p-1"
                  style={{ backgroundColor: "#fafafa", height: "100%", overflow: "hidden" }}
                >
                  {backPhoto ? (
                    <img
                      src={backPhoto}
                      alt="Kimlik Arka Yüz"
                      style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain", borderRadius: "2px" }}
                    />
                  ) : (
                    <div className="text-center text-muted fst-italic" style={{ fontSize: "10px" }}>
                      [ TÜRKİYE CUMHURİYETİ KİMLİK KARTI - ARKA YÜZ FOTOKOPİSİ ALANI ]
                    </div>
                  )}
                </div>
              </div>

              {/* 3. İŞLEM ÖZET SATIRLARI (Sadece fişteki gerçek bilgiler) */}
              <div
                className="py-1 px-1 mb-1.5"
                style={{
                  borderTop: "1px solid #000",
                  borderBottom: "1px solid #000",
                  fontSize: "9px",
                  lineHeight: "1.3",
                }}
              >
                <div className="d-flex justify-content-between">
                  <span>
                    <strong>Islem No:</strong> {effectiveBelgeNo || "—"}
                  </span>
                  <span>
                    <strong>Tarih:</strong> {displayTarih} {displaySaat}
                  </span>
                  <span>
                    <strong>İşlem:</strong> {islemTuruText}
                  </span>
                </div>
                <div className="d-flex justify-content-between">
                  <span>
                    <strong>Musteri:</strong> {unvan || "—"}
                  </span>
                  <span>
                    <strong>TC:</strong> {vergiKimlikNo || "—"}
                  </span>
                  <span>
                    <strong>Seri:</strong> {seriNo || "—"}
                  </span>
                </div>
                <div className="d-flex justify-content-between fw-bold">
                  <span>
                    {validLines.length > 0
                      ? validLines.map((l) => `${l.paraKodu} ${formatNumberTr(Number(l.miktar), 2)} x ${formatNumberTr(Number(l.kur), 4)} = ${formatNumberTr(Number(l.tutar), 2)} TL`).join(" | ")
                      : "—"}
                  </span>
                  <span>USD: {primaryLine ? formatNumberTr(Number(primaryLine.usdKarsiligi || primaryLine.miktar), 2) : "0,00"}</span>
                  <span>Vergi: {formatNumberTr(Number(bsmvTutari || 0), 2)}</span>
                  <span>Vergili: {formatNumberTr(Number(sonToplam || 0), 2)} TL</span>
                </div>
              </div>

              {/* 4. e-DÖVİZ VE KIYMETLİ MADEN ALIM / SATIM BELGESİ (GİB ŞABLONU) */}
              <div className="border border-dark mb-1.5 p-1.5" style={{ backgroundColor: "#ffffff" }}>
                {/* Üst Logo ve Başlık Satırı */}
                <div className="d-flex justify-content-between align-items-center pb-1 border-bottom border-dark">
                  {/* Müessese Bilgileri */}
                  <div style={{ width: "45%", fontSize: "8.5px", lineHeight: "1.2" }}>
                    <div className="fw-bold text-decoration-underline mb-0.5">DÜZENLEYEN YETKİLİ MÜESSESE BİLGİLERİ</div>
                    <div className="fw-bold">{firmaAdi} {subeAdi}</div>
                    <div>{firmaAdres}</div>
                    <div>VKN: {firmaVkn}</div>
                  </div>

                  {/* GİB Logo ve Başlık */}
                  <div className="text-center" style={{ width: "35%" }}>
                    <img
                      src="/images/logo/logo-gib.png"
                      alt="GİB"
                      style={{ height: "34px", objectFit: "contain", marginBottom: "1px" }}
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                    <div className="fw-bold" style={{ fontSize: "9px", lineHeight: "1.15" }}>
                      e-DÖVİZ VE KIYMETLİ MADEN<br />
                      {isAlis ? "ALIM BELGESİ" : "SATIM BELGESİ"}
                    </div>
                  </div>

                  {/* QR Kod */}
                  <div className="text-end" style={{ width: "20%" }}>
                    {qrCodeDataUrl ? (
                      <img src={qrCodeDataUrl} alt="QR Kod" style={{ width: "55px", height: "55px" }} />
                    ) : (
                      <div className="border border-dark d-inline-block text-center p-1" style={{ width: "55px", height: "55px", fontSize: "7.5px" }}>
                        KAREKOD
                      </div>
                    )}
                  </div>
                </div>

                {/* Müşteri ve Belge Bilgileri İkili Blok */}
                <div className="d-flex border-bottom border-dark" style={{ minHeight: "58px" }}>
                  {/* Sol Kutu: Döviz Satan/Alan Bilgileri */}
                  <div className="p-1 border-end border-dark" style={{ width: "60%", fontSize: "8.5px", lineHeight: "1.25" }}>
                    <div className="fw-bold text-decoration-underline mb-0.5">
                      DÖVİZ {isAlis ? "SATAN" : "ALAN"} KİŞİ/KURULUŞ BİLGİLERİ
                    </div>
                    <div className="fw-bold">{unvan || "—"}</div>
                    <div>{musteriAdres}</div>
                    <div>TCKN: {vergiKimlikNo || "—"}</div>
                    <div>MUSTERITURU: {detayCariTipi === "Firma" ? "TUZELKISI" : "GERCEKKISI"}</div>
                    {primaryLine?.ettn && (
                      <div className="font-monospace text-muted" style={{ fontSize: "7.5px" }}>
                        ETTN: {primaryLine.ettn}
                      </div>
                    )}
                  </div>

                  {/* Sağ Kutu: Belge Bilgileri */}
                  <div className="p-1" style={{ width: "40%", fontSize: "8.5px", lineHeight: "1.25" }}>
                    <div className="fw-bold text-decoration-underline mb-0.5">
                      {isAlis ? "ALIM" : "SATIM"} BELGESİ BİLGİLERİ
                    </div>
                    <div className="d-flex justify-content-between">
                      <span>Belge Numarası:</span> <strong>{effectiveBelgeNo || "—"}</strong>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span>Düzenleme Tarihi:</span> <span>{displayTarih} {displaySaat}</span>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span>Dosya No-Şube Kodu:</span> <span>{subeKodu}</span>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span>İstatistik No.(lar):</span> <span>{istatistikKodu || "—"}</span>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span>Senaryo:</span> <span>EDOVIZBELGE</span>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span>Tip:</span> <strong>{isAlis ? "ALIM" : "SATIM"}</strong>
                    </div>
                  </div>
                </div>

                {/* Satın Alınan / Satılan Döviz Tablosu */}
                <div className="pt-1">
                  <div className="fw-bold text-center border-bottom border-dark pb-0.5 mb-1" style={{ fontSize: "9px" }}>
                    {isAlis ? "SATIN ALINAN" : "SATILAN"} DÖVİZE/EFEKTİFE AİT BİLGİLER
                  </div>

                  <div className="d-flex" style={{ fontSize: "8.5px" }}>
                    {/* Sol Taraf: Finansal Rakamlar */}
                    <table className="table table-sm table-bordered border-dark mb-0" style={{ width: "55%", fontSize: "8px" }}>
                      <tbody>
                        {validLines.length > 0 ? (
                          validLines.map((line, idx) => (
                            <React.Fragment key={idx}>
                              <tr>
                                <td style={{ width: "60%", padding: "1.5px 4px" }}>Döviz/Efektifinin Miktarı / Birimi</td>
                                <td className="text-end fw-bold" style={{ padding: "1.5px 4px" }}>{formatNumberTr(Number(line.miktar), 2)} {line.paraKodu}</td>
                              </tr>
                              <tr>
                                <td style={{ padding: "1.5px 4px" }}>Uygulanan Kur</td>
                                <td className="text-end fw-bold" style={{ padding: "1.5px 4px" }}>{formatNumberTr(Number(line.kur), 4)}</td>
                              </tr>
                              <tr>
                                <td style={{ padding: "1.5px 4px" }}>TL Karşılığı</td>
                                <td className="text-end fw-bold" style={{ padding: "1.5px 4px" }}>{formatNumberTr(Number(line.tutar), 2)} TRY</td>
                              </tr>
                              <tr>
                                <td style={{ padding: "1.5px 4px" }}>ABD Doları Karşılığı</td>
                                <td className="text-end" style={{ padding: "1.5px 4px" }}>{formatNumberTr(Number(line.usdKarsiligi || line.miktar), 2)} USD</td>
                              </tr>
                            </React.Fragment>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={2} className="text-center text-muted py-1" style={{ padding: "1.5px 4px" }}>Döviz kalemi bulunmamaktadır</td>
                          </tr>
                        )}
                        <tr>
                          <td style={{ padding: "1.5px 4px" }}>BSMV</td>
                          <td className="text-end" style={{ padding: "1.5px 4px" }}>{formatNumberTr(Number(bsmvTutari || 0), 2)} TL</td>
                        </tr>
                        <tr className="table-light">
                          <td className="fw-bold" style={{ padding: "1.5px 4px" }}>Toplam Tutar</td>
                          <td className="text-end fw-bold" style={{ padding: "1.5px 4px" }}>{formatNumberTr(Number(sonToplam || 0), 2)} TL</td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Sağ Taraf: İthalat/Gümrük/Beyan Metadata (Sağ tarafları tamamen boş) */}
                    <table className="table table-sm table-bordered border-dark mb-0 ms-1" style={{ width: "45%", fontSize: "7.5px" }}>
                      <tbody>
                        <tr>
                          <td style={{ padding: "1.5px 4px" }}>Ait Olduğu Fatura No</td>
                          <td style={{ width: "40%", padding: "1.5px 4px" }}></td>
                        </tr>
                        <tr>
                          <td style={{ padding: "1.5px 4px" }}>Geldiği Ülke</td>
                          <td style={{ padding: "1.5px 4px" }}></td>
                        </tr>
                        <tr>
                          <td style={{ padding: "1.5px 4px" }}>Geliş Nedeni</td>
                          <td style={{ padding: "1.5px 4px" }}></td>
                        </tr>
                        <tr>
                          <td style={{ padding: "1.5px 4px" }}>Gümrük Beyannamelerinin Tarihi</td>
                          <td style={{ padding: "1.5px 4px" }}></td>
                        </tr>
                        <tr>
                          <td style={{ padding: "1.5px 4px" }}>Gümrük Beyannamesi No</td>
                          <td style={{ padding: "1.5px 4px" }}></td>
                        </tr>
                        <tr>
                          <td style={{ padding: "1.5px 4px" }}>Döviz Beyan Tutanağı Tarihi</td>
                          <td style={{ padding: "1.5px 4px" }}></td>
                        </tr>
                        <tr>
                          <td style={{ padding: "1.5px 4px" }}>Döviz Beyan Tutanağı Sayısı</td>
                          <td style={{ padding: "1.5px 4px" }}></td>
                        </tr>
                        <tr>
                          <td style={{ padding: "1.5px 4px" }}>Gümrük Müdürlüğü Teyid Yazısı Tarihi</td>
                          <td style={{ padding: "1.5px 4px" }}></td>
                        </tr>
                        <tr>
                          <td style={{ padding: "1.5px 4px" }}>Gümrük Müdürlüğü Teyid Yazısı Sayısı</td>
                          <td style={{ padding: "1.5px 4px" }}></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="pt-0.5 mt-0.5 border-top border-dark fw-bold" style={{ fontSize: "8.5px" }}>
                    Not: {tutarYaziyla || "—"}
                  </div>
                </div>
              </div>

              {/* 5. MASAK GERÇEK KİŞİ TANI FORMU TABLOSU
                  (Kişisel bilgiler bölümündeki tüm alanlar elle doldurulmak üzere TAMAMEN BOŞ) */}
              <table
                className="table table-sm table-bordered border-dark mb-1.5"
                style={{
                  width: "100%",
                  fontSize: "9px",
                  borderCollapse: "collapse",
                }}
              >
                <tbody>
                  <tr>
                    <td className="fw-bold bg-light" style={{ width: "28%", padding: "3.5px 6px" }}>
                      UYRUK
                    </td>
                    <td style={{ padding: "3.5px 6px", height: "20px" }}></td>
                  </tr>
                  <tr>
                    <td className="fw-bold bg-light" style={{ padding: "3.5px 6px" }}>
                      DOGUM YERI
                    </td>
                    <td style={{ padding: "3.5px 6px", height: "20px" }}></td>
                  </tr>
                  <tr>
                    <td className="fw-bold bg-light" style={{ padding: "3.5px 6px" }}>
                      ANNE - BABA ISMI
                    </td>
                    <td style={{ padding: "3.5px 6px", height: "20px" }}></td>
                  </tr>
                  <tr>
                    <td className="fw-bold bg-light" style={{ padding: "3.5px 6px" }}>
                      MESLEGI VE UNVANI
                    </td>
                    <td style={{ padding: "3.5px 6px", height: "20px" }}></td>
                  </tr>
                  <tr>
                    <td className="fw-bold bg-light" style={{ padding: "3.5px 6px" }}>
                      TELEFON NUMARASI
                    </td>
                    <td style={{ padding: "3.5px 6px", height: "20px" }}></td>
                  </tr>
                  <tr>
                    <td className="fw-bold bg-light" style={{ padding: "3.5px 6px" }}>
                      ACIK ADRES - 1
                    </td>
                    <td style={{ padding: "3.5px 6px", height: "20px" }}></td>
                  </tr>
                  <tr>
                    <td className="fw-bold bg-light" style={{ padding: "3.5px 6px" }}>
                      ACIK ADRES - 2
                    </td>
                    <td style={{ padding: "3.5px 6px", height: "20px" }}></td>
                  </tr>
                  <tr>
                    <td className="fw-bold bg-light" style={{ padding: "3.5px 6px" }}>
                      ACIKLAMA ( NOT )
                    </td>
                    <td style={{ padding: "3.5px 6px", height: "20px" }}></td>
                  </tr>
                </tbody>
              </table>

              {/* 6. YASAL TAAHHÜT METNİ VE İMZA ALANI (Üst üste binmez, temiz aralık) */}
              <div style={{ fontSize: "8px", lineHeight: "1.25" }}>
                <div>
                  Yukarıda belirtilen bilgilerin dogru oldugunu, herhangi bir degisiklik olmasi durumunda ilgili degisikligin tarafiniza derhal bildirilecegini sahsim adina kabul, beyan ve taahhut ederim.
                </div>
                <div className="d-flex justify-content-between align-items-center mt-2 pt-1">
                  <div style={{ fontSize: "9.5px" }}>
                    <span className="fw-bold">AD SOYAD :</span> &nbsp;&nbsp;
                    <span
                      style={{
                        display: "inline-block",
                        width: "180px",
                        borderBottom: "1px solid #000",
                        verticalAlign: "bottom",
                      }}
                    ></span>
                  </div>
                  <div style={{ fontSize: "9.5px" }}>
                    <span className="fw-bold">TARİH - İMZA :</span> &nbsp;&nbsp;
                    <span
                      style={{
                        display: "inline-block",
                        width: "160px",
                        borderBottom: "1px solid #000",
                        verticalAlign: "bottom",
                      }}
                    ></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Modal.Body>

        {/* Yazdırma Medyası Stilleri */}
        <style>{`
          @media print {
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

      {/* KAMERA ÇEKİM MODALI */}
      <Modal
        show={showCameraModal}
        onHide={closeCameraModal}
        size="lg"
        centered
        backdrop="static"
        className="d-print-none"
      >
        <Modal.Header closeButton className="py-2 bg-light">
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2">
            <IconCamera size={18} className="text-primary" />
            <span>Kamera ile Kimlik Fotoğrafı Çek ({cameraTarget === "front" ? "Ön Yüz" : "Arka Yüz"})</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3 bg-dark text-white text-center">
          {cameraError ? (
            <Alert variant="danger" className="mb-0 text-start">
              {cameraError}
            </Alert>
          ) : (
            <div className="position-relative d-inline-block w-100" style={{ maxWidth: "640px", minHeight: "360px" }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: "100%",
                  maxHeight: "400px",
                  objectFit: "cover",
                  borderRadius: "8px",
                  backgroundColor: "#000",
                }}
              />
              {/* Kimlik hizalama kılavuz çerçevesi */}
              <div
                style={{
                  position: "absolute",
                  top: "10%",
                  left: "10%",
                  width: "80%",
                  height: "80%",
                  border: "2px dashed rgba(255, 255, 255, 0.75)",
                  borderRadius: "10px",
                  pointerEvents: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span className="badge bg-dark bg-opacity-75 text-white px-3 py-1.5 fs-7 border border-white-50">
                  Kimliği bu çerçevenin içine hizalayınız
                </span>
              </div>
            </div>
          )}

          {/* Kamera Aygıtı Seçimi */}
          {videoDevices.length > 1 && (
            <div className="d-flex align-items-center justify-content-center gap-2 mt-2">
              <span className="small text-white-50">Kamera Seç:</span>
              <select
                className="form-select form-select-sm w-auto bg-secondary text-white border-0"
                value={selectedDeviceId}
                onChange={(e) => handleDeviceChange(e.target.value)}
              >
                {videoDevices.map((dev, idx) => (
                  <option key={dev.deviceId || idx} value={dev.deviceId}>
                    {dev.label || `Kamera ${idx + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="py-2 bg-light d-flex justify-content-between">
          <Button variant="secondary" size="sm" onClick={closeCameraModal}>
            İptal
          </Button>
          <Button
            variant="success"
            size="sm"
            className="d-flex align-items-center gap-1.5 fw-bold px-3"
            onClick={captureCameraPhoto}
            disabled={!cameraStream || !!cameraError}
          >
            <IconCamera size={16} /> Fotoğrafı Çek ve Ekle
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};
