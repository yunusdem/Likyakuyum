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
  IconCrop,
} from "@tabler/icons-react";
import QRCode from "qrcode";
import { CariService } from "../../services/cariService";
import { CompanyService, TodvzTanimDto } from "../../services/companyService";
import { tutarYaziylaTr } from "../../utils/tutarYaziyla";
import { PrinterService, YaziciItem } from "../../services/printerService";
import { useAuth } from "../../context/AuthContext";
import { triggerSilentPrint } from "../../services/silentPrintService";
import { ImageCropperModal } from "../../components/common/ImageCropperModal";
import { autoCropIdCard } from "../../utils/imageCropUtils";
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

  // Kimlik Fotoğrafları (Ön ve Arka Yüz)
  const [frontPhoto, setFrontPhoto] = useState<string | null>(null);
  const [backPhoto, setBackPhoto] = useState<string | null>(null);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState<boolean>(false);
  const [isSavingToCari, setIsSavingToCari] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");

  // Fotoğraf Kırpma (Cropper) Durumu
  const [cropperTarget, setCropperTarget] = useState<"front" | "back" | null>(null);

  // Müşteri Tanı Formu alanlarının sıfırlanması için key ve düzenleme yardımcıları
  const [taniFormResetKey, setTaniFormResetKey] = useState<number>(0);

  // Müşteri Tanı Formu Alanları (Müşteri bilgisi varsa otomatik doldurulur, kullanıcı düzenleyebilir)
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

  // Müşteri bilgisi varsa otomatik doldur (Cari Kart veya fiş detayları)
  useEffect(() => {
    if (!show) return;

    const buildAdres = (adr?: string, ilce?: string, il?: string) => {
      const parts = [adr?.trim(), ilce?.trim(), il?.trim()].filter(Boolean);
      return parts.join(" - ");
    };

    const buildKimlikTuru = (tckn?: string, pasaport?: string) => {
      if (pasaport?.trim()) return `PASAPORT: ${pasaport.trim()}`;
      if (tckn?.trim()) return `T.C. KİMLİK KARTI / ${tckn.trim()}`;
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

    // Cari kart id varsa detayları sunucudan da sorgula ve eksik alanları tamamla
    if (cariKartId && cariKartId > 0) {
      CariService.getCariKartById(cariKartId)
        .then((cari) => {
          if (!cari) return;
          setTaniData((prev) => ({
            adSoyad: prev.adSoyad || cleanValue(cari.ad) || cleanValue(cari.yetkiliKisi),
            dogumTarihi: prev.dogumTarihi || formatDateTr(cari.dogumTarihi),
            dogumYeri: prev.dogumYeri || cleanValue(cari.dogumYeri),
            tcKimlikNo: prev.tcKimlikNo || cleanValue(cari.vergiKimlikNo),
            kimlikTuruNo:
              prev.kimlikTuruNo ||
              buildKimlikTuru(cleanValue(cari.vergiKimlikNo), cleanValue(cari.pasaportNo)),
            uyruk: prev.uyruk || (cleanValue(cari.vergiKimlikNo) ? "T.C." : ""),
            adres: prev.adres || cleanValue(cari.adres),
            meslek: prev.meslek || "",
            telefon: prev.telefon || cleanValue(cari.telefon),
          }));
        })
        .catch(() => {});
    }
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

  const captureCameraPhoto = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    let base64 = canvas.toDataURL("image/jpeg", 0.92);

    try {
      base64 = await autoCropIdCard(base64);
    } catch (err) {
      console.warn("Otomatik kırpma atlandı:", err);
    }

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

  // Fotoğraf Yükleme İşleyicisi (Dosya Seçimi)
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, isFront: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      let b64 = event.target?.result as string;
      if (b64) {
        try {
          b64 = await autoCropIdCard(b64);
        } catch (err) {
          console.warn("Otomatik kırpma atlandı:", err);
        }
        if (isFront) {
          setFrontPhoto(b64);
        } else {
          setBackPhoto(b64);
        }
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Kırpma Tamamlandığında
  const handleCropDone = (croppedBase64: string) => {
    if (cropperTarget === "front") {
      setFrontPhoto(croppedBase64);
    } else if (cropperTarget === "back") {
      setBackPhoto(croppedBase64);
    }
    setCropperTarget(null);
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
                      <div
                        className="position-relative"
                        style={{ cursor: "pointer" }}
                        onClick={() => setCropperTarget("front")}
                        title="Fotoğrafı kırpmak için tıklayın"
                      >
                        <img
                          src={frontPhoto}
                          alt="Ön Yüz"
                          style={{ width: "70px", height: "45px", objectFit: "cover", borderRadius: "4px", border: "1px solid #86efac" }}
                        />
                        <div
                          className="position-absolute bottom-0 end-0 bg-dark bg-opacity-70 text-white rounded-circle p-0.5 d-flex align-items-center justify-content-center m-0.5"
                          style={{ width: "16px", height: "16px" }}
                        >
                          <IconCrop size={10} />
                        </div>
                      </div>
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
                    {frontPhoto && (
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        className="py-1 px-2 d-inline-flex align-items-center gap-1"
                        style={{ fontSize: "11px" }}
                        onClick={() => setCropperTarget("front")}
                        title="Fotoğrafı kırp ve ayarla"
                      >
                        <IconCrop size={13} /> Kırp
                      </Button>
                    )}
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
                      <div
                        className="position-relative"
                        style={{ cursor: "pointer" }}
                        onClick={() => setCropperTarget("back")}
                        title="Fotoğrafı kırpmak için tıklayın"
                      >
                        <img
                          src={backPhoto}
                          alt="Arka Yüz"
                          style={{ width: "70px", height: "45px", objectFit: "cover", borderRadius: "4px", border: "1px solid #86efac" }}
                        />
                        <div
                          className="position-absolute bottom-0 end-0 bg-dark bg-opacity-70 text-white rounded-circle p-0.5 d-flex align-items-center justify-content-center m-0.5"
                          style={{ width: "16px", height: "16px" }}
                        >
                          <IconCrop size={10} />
                        </div>
                      </div>
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
                    {backPhoto && (
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        className="py-1 px-2 d-inline-flex align-items-center gap-1"
                        style={{ fontSize: "11px" }}
                        onClick={() => setCropperTarget("back")}
                        title="Fotoğrafı kırp ve ayarla"
                      >
                        <IconCrop size={13} /> Kırp
                      </Button>
                    )}
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

      {/* Manuel Fotoğraf Kırpma (Cropper) Modalı */}
      {cropperTarget && (
        <ImageCropperModal
          show={!!cropperTarget}
          onHide={() => setCropperTarget(null)}
          imageSrc={cropperTarget === "front" ? frontPhoto || "" : backPhoto || ""}
          title={cropperTarget === "front" ? "Kimlik Ön Yüzünü Kırp" : "Kimlik Arka Yüzünü Kırp"}
          onCropDone={handleCropDone}
        />
      )}
    </>
  );
};
