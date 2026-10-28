import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Modal, Button, ProgressBar, Spinner, Alert, Dropdown } from "react-bootstrap";
import {
  IconCamera,
  IconUpload,
  IconZoomIn,
  IconCheck,
  IconAlertCircle,
  IconSparkles,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconFileText,
  IconPlus,
  IconTrash,
  IconArrowsExchange,
  IconEdit,
  IconCrop,
} from "@tabler/icons-react";
import {
  performOcrAndExtractData,
  OcrExtractedData,
  isKimlikBackFace,
  isKimlikFrontFace,
  isNoiseOrLabel,
  isValidTcKimlikNo,
  cleanSeri,
  scoreNameOrSurname,
  isValidNameOrSurname,
  turkishizeFromRawText,
} from "../../utils/kimlikOcrParser";
import { autoCropIdCard } from "../../utils/imageCropUtils";
import { CariFotografItem } from "../../services/cariService";
import { ImageCropperModal } from "../common/ImageCropperModal";

export interface CariKimlikFotografSectionProps {
  currentPhoto?: CariFotografItem | null;
  currentPhotos?: CariFotografItem[];
  pendingBase64?: string | null;
  pendingPhotos?: string[];
  selectedBelgeTuru: number; // 0: Kimlik, 1: Pasaport, 2: Vergi Levhası
  onBelgeTuruChange: (turu: number) => void;
  onPhotoSelected: (base64: string, file?: File) => void;
  onPhotosSelected?: (base64List: string[]) => void;
  onPhotoDeleted: (index?: number, photoId?: number) => void;
  onOcrApply: (data: OcrExtractedData) => void;
  disabled?: boolean;
}

export const CariKimlikFotografSection: React.FC<CariKimlikFotografSectionProps> = ({
  currentPhoto,
  currentPhotos,
  pendingBase64,
  pendingPhotos,
  selectedBelgeTuru,
  onBelgeTuruChange,
  onPhotoSelected,
  onPhotosSelected,
  onPhotoDeleted,
  onOcrApply,
  disabled = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Yerel fotoğraf listesi
  const [localPhotos, setLocalPhotos] = useState<string[]>([]);

  // Kamera Durumları
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  // Maksimum 2 resim kuralı uyarısı
  const [limitWarning, setLimitWarning] = useState<string | null>(null);

  useEffect(() => {
    if (!limitWarning) return;
    const timer = setTimeout(() => setLimitWarning(null), 4500);
    return () => clearTimeout(timer);
  }, [limitWarning]);

  // OCR Durumları
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStatus, setScanStatus] = useState("");
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<OcrExtractedData | null>(null);
  const [isApplied, setIsApplied] = useState(false);

  // Büyütme (Zoom) Modalı
  const [showZoomModal, setShowZoomModal] = useState(false);

  // Manuel Kırpma (Crop) Modalı
  const [showCropModal, setShowCropModal] = useState(false);

  // OCR Verilerini Doğrudan Düzenleme Modu
  const [isEditingOcr, setIsEditingOcr] = useState<boolean>(false);

  // Okunan Bilgiler panelinden doğrudan veri düzenleme
  const handleEditOcrField = (field: keyof OcrExtractedData, value: any) => {
    if (!extractedData) return;
    const updated: OcrExtractedData = { ...extractedData, [field]: value };
    if (field === "ad" || field === "soyad") {
      const ad = field === "ad" ? value : updated.ad || "";
      const soyad = field === "soyad" ? value : updated.soyad || "";
      updated.unvan = `${ad} ${soyad}`.trim();
    }
    if (field === "tcKimlikNo") {
      updated.vergiKimlikNo = value;
    }
    setExtractedData(updated);
    if (isApplied && onOcrApply) {
      onOcrApply(updated);
    }
  };

  // Aktif Fotoğraf İndeksi (Arkalı Önlü fotoğraflar arasında geçiş)
  const [activeIndex, setActiveIndex] = useState<number>(0);

  // Üst bileşenden gelen pendingPhotos senkronizasyonu
  useEffect(() => {
    if (pendingPhotos && pendingPhotos.length > 0) {
      setLocalPhotos(pendingPhotos);
    } else if (!pendingBase64 && (!pendingPhotos || pendingPhotos.length === 0)) {
      if (!currentPhotos || currentPhotos.length === 0) {
        setLocalPhotos([]);
        setExtractedData(null);
        setIsApplied(false);
      }
    }
  }, [pendingPhotos, pendingBase64, currentPhotos]);

  // Görüntülenecek Fotoğraf Listesini Birleştir
  const photoList = useMemo(() => {
    const list: Array<{ id?: number; base64: string; label: string; isSaved: boolean }> = [];

    // 1. Bekleyen fotoğraflar
    const pendingSources = localPhotos.length > 0 ? localPhotos : pendingPhotos || [];
    if (pendingSources.length > 0) {
      pendingSources.forEach((b64, idx) => {
        if (b64) {
          list.push({
            base64: b64,
            label: idx === 0 ? "1. Ön Yüz" : idx === 1 ? "2. Arka Yüz" : `${idx + 1}. Belge`,
            isSaved: false,
          });
        }
      });
    } else if (pendingBase64) {
      list.push({
        base64: pendingBase64,
        label: "1. Ön Yüz",
        isSaved: false,
      });
    }

    // 2. Veritabanından gelen fotoğraflar
    if (list.length === 0) {
      if (currentPhotos && currentPhotos.length > 0) {
        currentPhotos.forEach((cp, idx) => {
          const b64 = cp.dataUrl || (cp as any).fotografBase64 || "";
          if (b64) {
            list.push({
              id: cp.fotografId,
              base64: b64,
              label: idx === 0 ? "1. Ön Yüz" : idx === 1 ? "2. Arka Yüz" : `${idx + 1}. Belge`,
              isSaved: true,
            });
          }
        });
      } else if (currentPhoto) {
        const b64 = currentPhoto.dataUrl || (currentPhoto as any).fotografBase64 || "";
        if (b64) {
          list.push({
            id: currentPhoto.fotografId,
            base64: b64,
            label: "1. Ön Yüz",
            isSaved: true,
          });
        }
      }
    }

    return list.slice(0, 2);
  }, [localPhotos, pendingPhotos, pendingBase64, currentPhotos, currentPhoto]);

  const safeActiveIndex = activeIndex < photoList.length ? activeIndex : 0;
  const activePhoto = photoList[safeActiveIndex] || null;
  const displayImage = activePhoto?.base64 || null;
  const isSavedInSql = !!activePhoto?.isSaved;

  // Kamera Kapatma
  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
    setCameraError(null);
  }, [cameraStream]);

  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraStream]);

  // Otomatik OCR Taraması Çalıştır (Çoklu fotoğrafları zekice birleştirir)
  const triggerAutoOcr = useCallback(
    async (photosToScan: string[], isDeepAnalysis: boolean = false, skipReorder: boolean = false) => {
      if (!photosToScan || photosToScan.length === 0) return null;

      setIsScanning(true);
      setScanProgress(0);
      setScanStatus(isDeepAnalysis ? "Detaylı OCR analizi başlatılıyor..." : "Kimlik okunuyor...");
      setOcrError(null);
      setIsApplied(false);

      try {
        let currentPhotos = [...photosToScan];
        const scanResults: OcrExtractedData[] = [];

        for (let i = 0; i < currentPhotos.length; i++) {
          const photoSrc = currentPhotos[i];
          const label = i === 0 ? "1. Ön Yüz" : "2. Arka Yüz";
          setScanStatus(`${currentPhotos.length > 1 ? `[${label}] ` : ""}${isDeepAnalysis ? "Detaylı analiz yapılıyor..." : "Okunuyor..."}`);

          const res = await performOcrAndExtractData(
            photoSrc,
            selectedBelgeTuru,
            (progress, status) => {
              const stepRatio = 100 / currentPhotos.length;
              const currentTotal = Math.round(i * stepRatio + (progress * stepRatio) / 100);
              setScanProgress(currentTotal);
              setScanStatus(`${currentPhotos.length > 1 ? `[${label}] ` : ""}${status}`);
            },
            isDeepAnalysis
          );
          scanResults.push(res);
        }

        // Eğer 2 kimlik fotoğrafı varsa ve ters yüklenmişse (0: Arka Yüz, 1: Ön Yüz):
        // Kullanıcı manuel "Değiştir" yapmamışsa (skipReorder false) otomatik düzelt
        if (!skipReorder && selectedBelgeTuru === 0 && currentPhotos.length === 2 && scanResults.length === 2) {
          const is0Back = isKimlikBackFace(scanResults[0]);
          const is1Front = isKimlikFrontFace(scanResults[1]);
          if (is0Back && is1Front) {
            const reorderedPhotos = [currentPhotos[1], currentPhotos[0]];
            const reorderedResults = [scanResults[1], scanResults[0]];
            currentPhotos = reorderedPhotos;
            setLocalPhotos(reorderedPhotos);
            if (onPhotosSelected) onPhotosSelected(reorderedPhotos);
            scanResults[0] = reorderedResults[0];
            scanResults[1] = reorderedResults[1];
          }
        }

        // Birleştir: Ön yüz ve Arka yüz verilerini kusursuz harmanla
        let mergedData: OcrExtractedData = { ...scanResults[0] };
        for (let i = 1; i < scanResults.length; i++) {
          const res = scanResults[i];

          // TCKN: Eğer res'te geçerli (checksum tutan) TCKN varsa, veya mergedData'da hiç yoksa al
          if (res.tcKimlikNo) {
            if (!mergedData.tcKimlikNo) {
              mergedData.tcKimlikNo = res.tcKimlikNo;
            } else if (!isValidTcKimlikNo(mergedData.tcKimlikNo) && isValidTcKimlikNo(res.tcKimlikNo)) {
              mergedData.tcKimlikNo = res.tcKimlikNo;
            }
          }

          // VKN
          if (!mergedData.vergiKimlikNo && res.vergiKimlikNo) {
            mergedData.vergiKimlikNo = res.vergiKimlikNo;
          }

          // Ad: Kalite puanı daha yüksek olanı tercih et
          if (res.ad && isValidNameOrSurname(res.ad)) {
            if (!mergedData.ad || !isValidNameOrSurname(mergedData.ad) || scoreNameOrSurname(res.ad) >= scoreNameOrSurname(mergedData.ad)) {
              mergedData.ad = res.ad;
            }
          }

          // Soyad: Kalite puanı daha yüksek olanı tercih et (örn: DEMİRBAŞ > DEMIRBAS > YL)
          if (res.soyad && isValidNameOrSurname(res.soyad)) {
            if (!mergedData.soyad || !isValidNameOrSurname(mergedData.soyad) || scoreNameOrSurname(res.soyad) >= scoreNameOrSurname(mergedData.soyad)) {
              mergedData.soyad = res.soyad;
            }
          }

          // Unvan
          if (!mergedData.unvan && res.unvan) {
            mergedData.unvan = res.unvan;
          }

          // Seri No: 9 karakterli geçerli seri no (cleanSeri) öncelikli
          if (res.kimlikSeriNo) {
            const cleanCur = cleanSeri(mergedData.kimlikSeriNo);
            const cleanNew = cleanSeri(res.kimlikSeriNo);
            if (!cleanCur && cleanNew) {
              mergedData.kimlikSeriNo = cleanNew;
            } else if (cleanCur && cleanNew && cleanCur.length !== 9 && cleanNew.length === 9) {
              mergedData.kimlikSeriNo = cleanNew;
            }
          }

          // Tarihler & Cinsiyet
          if (!mergedData.dogumTarihi && res.dogumTarihi) mergedData.dogumTarihi = res.dogumTarihi;
          if (!mergedData.kimlikGecerlilikTarihi && res.kimlikGecerlilikTarihi)
            mergedData.kimlikGecerlilikTarihi = res.kimlikGecerlilikTarihi;
          if (!mergedData.cinsiyet && res.cinsiyet) mergedData.cinsiyet = res.cinsiyet;

          // Anne ve Baba Adı (özellikle arka yüzden gelir)
          if (res.anneAdi && isValidNameOrSurname(res.anneAdi)) {
            if (!mergedData.anneAdi || !isValidNameOrSurname(mergedData.anneAdi) || scoreNameOrSurname(res.anneAdi) > scoreNameOrSurname(mergedData.anneAdi)) {
              mergedData.anneAdi = res.anneAdi;
            }
          }
          if (res.babaAdi && isValidNameOrSurname(res.babaAdi)) {
            if (!mergedData.babaAdi || !isValidNameOrSurname(mergedData.babaAdi) || scoreNameOrSurname(res.babaAdi) > scoreNameOrSurname(mergedData.babaAdi)) {
              mergedData.babaAdi = res.babaAdi;
            }
          }

          if (!mergedData.dogumYeri && res.dogumYeri) mergedData.dogumYeri = res.dogumYeri;
          if (!mergedData.il && res.il) mergedData.il = res.il;
          if (!mergedData.ilce && res.ilce) mergedData.ilce = res.ilce;
          if (!mergedData.vergiDairesiAdi && res.vergiDairesiAdi) mergedData.vergiDairesiAdi = res.vergiDairesiAdi;
          if (!mergedData.pasaportNo && res.pasaportNo) mergedData.pasaportNo = res.pasaportNo;
          if (!mergedData.uyruk && res.uyruk) mergedData.uyruk = res.uyruk;
          if (!mergedData.ulke && res.ulke) mergedData.ulke = res.ulke;
          if (!mergedData.adres && res.adres) mergedData.adres = res.adres;
          if (!mergedData.faaliyetKonusu && res.faaliyetKonusu) mergedData.faaliyetKonusu = res.faaliyetKonusu;

          mergedData.rawText += "\n---\n" + (res.rawText || "");
        }

        // Son temizlik: geçersiz veya noise kelimeleri sil
        if (mergedData.ad && !isValidNameOrSurname(mergedData.ad)) delete mergedData.ad;
        if (mergedData.soyad && !isValidNameOrSurname(mergedData.soyad)) delete mergedData.soyad;
        if (mergedData.anneAdi && !isValidNameOrSurname(mergedData.anneAdi)) delete mergedData.anneAdi;
        if (mergedData.babaAdi && !isValidNameOrSurname(mergedData.babaAdi)) delete mergedData.babaAdi;

        // Seri No'yu son kez cleanSeri ile doğrula
        if (mergedData.kimlikSeriNo) {
          const validated = cleanSeri(mergedData.kimlikSeriNo);
          if (validated) {
            mergedData.kimlikSeriNo = validated;
          }
        }

        // Ham metindeki Türkçe karakterleri (örn. DEMİRBAŞ) geri yükle
        if (mergedData.soyad) {
          mergedData.soyad = turkishizeFromRawText(mergedData.soyad, mergedData.rawText);
        }
        if (mergedData.ad) {
          mergedData.ad = turkishizeFromRawText(mergedData.ad, mergedData.rawText);
        }

        // Cari Ünvan'ı Ad ve Soyad ile güncelle
        if (mergedData.ad && mergedData.soyad) {
          mergedData.unvan = `${mergedData.ad} ${mergedData.soyad}`.trim();
        } else if (mergedData.ad) {
          mergedData.unvan = mergedData.ad;
        } else if (mergedData.soyad) {
          mergedData.unvan = mergedData.soyad;
        }

        setExtractedData(mergedData);
        // Form alanları otomatik doldurulmaz; kullanıcı "Alanları Doldur" butonuna basınca aktarılır
        setIsApplied(false);
        return mergedData;
      } catch (err: any) {
        setOcrError("Kimlik metinleri okunurken hata: " + (err.message || err));
        return null;
      } finally {
        setIsScanning(false);
      }
    },
    [selectedBelgeTuru, onPhotosSelected, onOcrApply]
  );

  // Ön Yüz ile Arka Yüzün Yerini Değiştir (Kullanıcı dilediğinde tek tıkla ters çevirir)
  const handleSwapPhotos = () => {
    const currentList =
      localPhotos.length >= 2
        ? localPhotos
        : photoList.length >= 2
        ? photoList.map((p) => p.base64)
        : [];

    if (currentList.length >= 2) {
      const swapped = [currentList[1], currentList[0], ...currentList.slice(2)];
      setLocalPhotos(swapped);
      if (onPhotosSelected) {
        onPhotosSelected(swapped);
      }
      triggerAutoOcr(swapped, false, true);
    }
  };

  // Manuel Kırpma Tamamlandığında
  const handleCropDone = (croppedBase64: string) => {
    if (!croppedBase64) return;
    const targetIdx = safeActiveIndex;

    let baseList = localPhotos.length > 0 ? [...localPhotos] : photoList.map((p) => p.base64);

    if (baseList.length === 0) {
      baseList = [croppedBase64];
    } else if (targetIdx < baseList.length) {
      baseList[targetIdx] = croppedBase64;
    } else {
      baseList.push(croppedBase64);
    }

    setLocalPhotos(baseList);
    setShowCropModal(false);

    if (onPhotosSelected) {
      onPhotosSelected(baseList);
    } else if (onPhotoSelected) {
      onPhotoSelected(baseList[0]);
    }

    // Kırpılan görsel üzerinden OCR'ı tekrar çalıştır
    triggerAutoOcr(baseList);
  };

  // Kamera Başlat
  const startCamera = async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      setCameraStream(stream);
      setIsCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 150);
    } catch (err: any) {
      setCameraError("Kameraya erişilemedi: " + (err.message || "İzin verilmedi"));
    }
  };

  // Kameradan Çekim Yap
  const capturePhoto = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const rawBase64 = canvas.toDataURL("image/jpeg", 0.92);
    stopCamera();

    // Üstte/altta/kenarlarda boşluklar varsa otomatik kırp
    const base64 = await autoCropIdCard(rawBase64);

    const currentB64s = photoList.map((p) => p.base64);
    let updated: string[];
    let newActiveIdx = 0;

    if (currentB64s.length >= 2) {
      updated = [...currentB64s];
      const targetIdx = safeActiveIndex < updated.length ? safeActiveIndex : 0;
      updated[targetIdx] = base64;
      newActiveIdx = targetIdx;
      setLimitWarning(`En fazla 2 resim yüklenebilir. ${targetIdx + 1}. fotoğraf yeni çekilen görselle değiştirildi.`);
    } else {
      updated = [...currentB64s, base64].slice(0, 2);
      newActiveIdx = updated.length - 1;
    }

    setLocalPhotos(updated);
    setActiveIndex(newActiveIdx);

    if (onPhotosSelected) {
      onPhotosSelected(updated);
    } else {
      onPhotoSelected(base64);
    }

    triggerAutoOcr(updated);
  };

  // Dosya(lar)dan Seçme
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    let fileArray = Array.from(files);
    e.target.value = "";

    const currentB64s = photoList.map((p) => p.base64);

    if (currentB64s.length >= 2) {
      if (fileArray.length > 1) {
        setLimitWarning("En fazla 2 resim yüklenebilir. Yalnızca ilk seçilen dosya aktif fotoğrafın yerine alındı.");
      } else {
        setLimitWarning(`En fazla 2 resim yüklenebilir. ${safeActiveIndex + 1}. fotoğraf seçilen yeni görselle değiştirildi.`);
      }
      fileArray = fileArray.slice(0, 1);
    } else {
      const remainingSlots = 2 - currentB64s.length;
      if (fileArray.length > remainingSlots) {
        setLimitWarning(`En fazla 2 resim yüklenebilir. Seçilen ${fileArray.length} dosyadan ilk ${remainingSlots} tanesi yüklendi.`);
        fileArray = fileArray.slice(0, remainingSlots);
      }
    }

    try {
      const readPromises = fileArray.map((file) => {
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            const b64 = event.target?.result as string;
            resolve(b64 || "");
          };
          reader.onerror = () => resolve("");
          reader.readAsDataURL(file);
        });
      });

      const rawBase64List = (await Promise.all(readPromises)).filter(
        (b) => b && b.startsWith("data:")
      );

      if (rawBase64List.length === 0) return;

      // Üstte/altta boşluklar varsa otomatik kırp
      const croppedList = await Promise.all(
        rawBase64List.map((b64) => autoCropIdCard(b64))
      );

      let updated: string[];
      let newActiveIdx = 0;

      if (currentB64s.length >= 2) {
        updated = [...currentB64s];
        const targetIdx = safeActiveIndex < updated.length ? safeActiveIndex : 0;
        updated[targetIdx] = croppedList[0];
        newActiveIdx = targetIdx;
      } else {
        updated = [...currentB64s, ...croppedList].slice(0, 2);
        newActiveIdx = updated.length - 1;
      }

      setLocalPhotos(updated);
      setActiveIndex(newActiveIdx);

      if (onPhotosSelected) {
        onPhotosSelected(updated);
      } else {
        onPhotoSelected(croppedList[0]);
      }

      triggerAutoOcr(updated);
    } catch (err) {
      console.error("Kimlik görseli işlenirken hata:", err);
    }
  };

  // 2. Fotoğraf (Arka Yüz) Yükleme Tetikleyici
  const handleAddSecondPhotoClick = () => {
    if (photoList.length >= 2) {
      setLimitWarning("En fazla 2 resim yüklenebilir (Ön ve Arka Yüz).");
      return;
    }
    fileInputRef.current?.click();
  };

  // Aktif Fotoğrafı Sil
  const handleDeleteActivePhoto = () => {
    if (!activePhoto) return;
    const targetIdx = safeActiveIndex;
    const targetId = activePhoto.id;

    const nextLocal = localPhotos.filter((_, i) => i !== targetIdx);
    setLocalPhotos(nextLocal);

    if (onPhotosSelected) {
      onPhotosSelected(nextLocal);
    }
    onPhotoDeleted(targetIdx, targetId);

    if (safeActiveIndex > 0) {
      setActiveIndex(safeActiveIndex - 1);
    } else {
      setActiveIndex(0);
    }
  };

  // "İlgili Alanları Doldur" butonu tıklandığında
  const handleFillFieldsClick = async () => {
    if (extractedData) {
      onOcrApply(extractedData);
      setIsApplied(true);
      return;
    }

    if (photoList.length > 0) {
      const sources = photoList.map((p) => p.base64);
      const res = await triggerAutoOcr(sources);
      if (res) {
        onOcrApply(res);
        setIsApplied(true);
      }
    }
  };

  // Tarihleri Türkçe formatta (GG.AA.YYYY) gösterme yardımcısı
  const formatDateTr = (iso?: string) => {
    if (!iso) return "-";
    const parts = iso.split("-");
    if (parts.length === 3) {
      return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    return iso;
  };

  return (
    <div className="d-flex flex-column align-items-center w-100">
      {/* 1. Belge Türü Seçimi (Kimlik / Pasaport / Vergi Levhası) */}
      <div
        className="d-flex align-items-center gap-1 mb-1.5 w-100 bg-light p-0.5 rounded-2 border"
        title="Belge Türü Seçimi (Kimlik / Pasaport / Vergi Levhası)"
      >
        <button
          type="button"
          className={`btn btn-sm p-0 flex-fill text-center border-0 ${selectedBelgeTuru === 0 ? "fw-bold text-primary bg-white shadow-2xs rounded-1" : "text-muted"
            }`}
          onClick={() => onBelgeTuruChange(0)}
          disabled={disabled}
          style={{ fontSize: "10px", lineHeight: "1.8" }}
        >
          Kimlik
        </button>
        <button
          type="button"
          className={`btn btn-sm p-0 flex-fill text-center border-0 ${selectedBelgeTuru === 1 ? "fw-bold text-primary bg-white shadow-2xs rounded-1" : "text-muted"
            }`}
          onClick={() => onBelgeTuruChange(1)}
          disabled={disabled}
          style={{ fontSize: "10px", lineHeight: "1.8" }}
        >
          Pasaport
        </button>
        <button
          type="button"
          className={`btn btn-sm p-0 flex-fill text-center border-0 ${selectedBelgeTuru === 2 ? "fw-bold text-primary bg-white shadow-2xs rounded-1" : "text-muted"
            }`}
          onClick={() => onBelgeTuruChange(2)}
          disabled={disabled}
          style={{ fontSize: "10px", lineHeight: "1.8" }}
        >
          Vergi
        </button>
      </div>

      {/* 2. Arkalı Önlü Fotoğraf Sekmesi */}
      {photoList.length > 0 && (
        <div className="d-flex align-items-center justify-content-between w-100 mb-1 px-0.5">
          <div className="d-flex align-items-center gap-1 flex-wrap">
            {photoList.map((p, idx) => (
              <button
                key={idx}
                type="button"
                className={`btn btn-sm px-1.5 py-0 border ${idx === safeActiveIndex
                    ? "btn-primary text-white fw-bold shadow-2xs"
                    : "btn-light text-secondary"
                  }`}
                style={{ fontSize: "9.5px", borderRadius: "6px", lineHeight: "1.6" }}
                onClick={() => setActiveIndex(idx)}
                title={`${p.label} - Görüntüle`}
              >
                {idx === 0 ? "1. Ön" : idx === 1 ? "2. Arka" : `${idx + 1}`}
              </button>
            ))}

            {photoList.length === 1 && (
              <button
                type="button"
                className="btn btn-sm btn-outline-success px-1.5 py-0 border-dashed"
                style={{ fontSize: "9px", borderRadius: "6px", lineHeight: "1.6" }}
                onClick={handleAddSecondPhotoClick}
                title="2. Arka Yüz Fotoğrafını Ekle"
              >
                + Arka
              </button>
            )}

            {/* Ön / Arka Yer Değiştir Butonu */}
            {photoList.length >= 2 && (
              <button
                type="button"
                className="btn btn-sm btn-outline-primary px-1 py-0 d-flex align-items-center gap-0.5 fw-semibold shadow-2xs"
                style={{ fontSize: "9px", borderRadius: "6px", lineHeight: "1.6" }}
                onClick={handleSwapPhotos}
                title="Ön yüz ile arka yüz fotoğraflarının sırasını değiştir"
              >
                <IconArrowsExchange size={11} stroke={2.2} />
                <span>Değiştir</span>
              </button>
            )}
          </div>
          <span className="text-muted small" style={{ fontSize: "9.5px" }}>
            {safeActiveIndex + 1}/{photoList.length}
          </span>
        </div>
      )}

      {/* Limit Uyarısı */}
      {limitWarning && (
        <Alert
          variant="warning"
          dismissible
          onClose={() => setLimitWarning(null)}
          className="d-flex align-items-center gap-1.5 py-1 px-2 mb-1.5 shadow-2xs border-warning text-dark w-100"
          style={{ fontSize: "10.5px", lineHeight: "1.3" }}
        >
          <IconAlertCircle size={14} className="text-warning flex-shrink-0" />
          <span>{limitWarning}</span>
        </Alert>
      )}

      {/* 3. Fotoğraf Önizleme Kutusu */}
      <div
        className="position-relative border rounded-3 bg-white d-flex flex-column align-items-center justify-content-center overflow-hidden mb-1.5 shadow-2xs w-100"
        style={{
          height: "125px",
          borderWidth: "1.5px",
          borderColor: displayImage ? "#0d6efd" : "#ced4da",
          backgroundColor: "#fcfcfc",
          cursor: "pointer",
        }}
        onClick={() => {
          if (displayImage) {
            setShowZoomModal(true);
          } else {
            fileInputRef.current?.click();
          }
        }}
        title={displayImage ? "Büyütmek için tıklayın" : "Fotoğraf yüklemek için tıklayın"}
      >
        {displayImage ? (
          <>
            <img
              src={displayImage}
              alt="Kimlik Fotoğrafı"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                padding: "3px",
              }}
            />
            <div
              className="position-absolute top-0 start-0 m-1 bg-dark bg-opacity-70 text-white rounded-1 px-1 py-0.5"
              style={{ fontSize: "9px", fontWeight: 600, letterSpacing: "0.2px" }}
            >
              {activePhoto?.label || "1. Ön Yüz"}
            </div>

            <div
              className="position-absolute top-0 end-0 m-1 bg-dark bg-opacity-70 text-white rounded-circle p-1 d-flex align-items-center justify-content-center shadow-sm"
              style={{ width: "22px", height: "22px", cursor: "pointer", zIndex: 2 }}
              onClick={(e) => {
                e.stopPropagation();
                setShowCropModal(true);
              }}
              title="Kimlik Fotoğrafını Kırp"
            >
              <IconCrop size={12} stroke={2} />
            </div>

            <div
              className="position-absolute bottom-0 end-0 m-1 bg-dark bg-opacity-60 text-white rounded-circle p-1 d-flex align-items-center justify-content-center"
              style={{ width: "20px", height: "20px" }}
              title="Büyüt"
            >
              <IconZoomIn size={11} />
            </div>
          </>
        ) : (
          <div className="d-flex flex-column align-items-center justify-content-center text-center p-2">
            <IconCamera
              size={36}
              stroke={1.3}
              className="text-secondary opacity-60 mb-1"
            />
            <span
              className="fw-semibold text-secondary"
              style={{ fontSize: "11px", letterSpacing: "-0.2px" }}
            >
              Fotoğraf Yok
            </span>
            <span className="text-muted" style={{ fontSize: "9px" }}>
              Ön / Arka Yüz Seç (Maks 2)
            </span>
          </div>
        )}
      </div>

      {/* 4. Butonlar: 2. Fotoğraf Ekleme, Yükle/Değiştir ve Sil */}
      <div className="d-flex flex-column gap-1 w-100">
        {photoList.length === 1 && (
          <button
            type="button"
            className="btn btn-sm btn-outline-success w-100 d-flex align-items-center justify-content-center gap-1 py-1 px-1 fw-bold shadow-2xs"
            onClick={handleAddSecondPhotoClick}
            style={{
              borderRadius: "8px",
              fontSize: "11px",
              lineHeight: "1.4",
            }}
            title="Arka Yüz veya 2. Belge Fotoğrafını Ekle"
          >
            <IconPlus size={13} stroke={2.5} />
            <span>2. Arka Yüz Ekle</span>
          </button>
        )}

        {displayImage && (
          <button
            type="button"
            className="btn btn-sm btn-outline-primary w-100 d-flex align-items-center justify-content-center gap-1 py-1 px-1 fw-bold shadow-2xs"
            onClick={() => setShowCropModal(true)}
            style={{
              borderRadius: "8px",
              fontSize: "11px",
              lineHeight: "1.4",
            }}
            title="Kimlik fotoğrafını manuel olarak kırp ve düzenle"
          >
            <IconCrop size={13} stroke={2.2} />
            <span>Fotoğrafı Kırp</span>
          </button>
        )}

        {/* YÜKLE / DEĞİŞTİR Açılır Butonu */}
        <Dropdown className="w-100">
          <Dropdown.Toggle
            as="button"
            type="button"
            className="btn w-100 d-flex align-items-center justify-content-center gap-1 py-1 px-1 fw-bold shadow-2xs"
            disabled={disabled}
            style={{
              borderRadius: "8px",
              border: "1.5px solid #20c997",
              color: "#198754",
              backgroundColor: "transparent",
              fontSize: "11.5px",
              letterSpacing: "0.3px",
              lineHeight: "1.4",
            }}
          >
            <IconCamera size={13} stroke={1.8} />
            <span>
              {photoList.length === 0
                ? "FOTOĞRAF YÜKLE (Maks 2)"
                : photoList.length === 1
                ? "FOTOĞRAF (1/2)"
                : "FOTOĞRAF (2/2)"}
            </span>
            <IconChevronDown size={12} stroke={2} />
          </Dropdown.Toggle>

          <Dropdown.Menu className="shadow border-0 py-1" style={{ fontSize: "11.5px", minWidth: "180px" }}>
            <Dropdown.Item
              onClick={() => fileInputRef.current?.click()}
              className="d-flex align-items-center gap-2 py-1.5"
            >
              <IconUpload size={14} className="text-success" />
              <span>
                {photoList.length === 0
                  ? "Dosyadan Seç (En fazla 2)"
                  : photoList.length === 1
                  ? "Dosyadan Seç (2. Arka Yüz)"
                  : `Aktif Fotoğrafı Değiştir (${safeActiveIndex + 1}. Belge)`}
              </span>
            </Dropdown.Item>
            <Dropdown.Item
              onClick={startCamera}
              className="d-flex align-items-center gap-2 py-1.5"
            >
              <IconCamera size={14} className="text-primary" />
              <span>
                {photoList.length === 0
                  ? "Kameradan Çek (En fazla 2)"
                  : photoList.length === 1
                  ? "Kameradan Çek (2. Arka Yüz)"
                  : `Aktif Fotoğrafı Değiştir (${safeActiveIndex + 1}. Belge)`}
              </span>
            </Dropdown.Item>
            {photoList.length > 0 && (
              <>
                <Dropdown.Divider />
                <Dropdown.Item
                  onClick={() => setShowCropModal(true)}
                  className="d-flex align-items-center gap-2 py-1.5"
                >
                  <IconCrop size={14} className="text-primary" />
                  <span>Fotoğrafı Kırp</span>
                </Dropdown.Item>
                <Dropdown.Item
                  onClick={() => triggerAutoOcr(photoList.map((p) => p.base64), true)}
                  className="d-flex align-items-center gap-2 py-1.5"
                  disabled={isScanning}
                >
                  <IconSparkles size={14} className="text-warning" />
                  <span>Yeniden Oku (Detaylı Analiz)</span>
                </Dropdown.Item>
                <Dropdown.Item
                  onClick={() => setShowZoomModal(true)}
                  className="d-flex align-items-center gap-2 py-1.5"
                >
                  <IconZoomIn size={14} className="text-secondary" />
                  <span>Fotoğrafları İncele</span>
                </Dropdown.Item>
              </>
            )}
          </Dropdown.Menu>
        </Dropdown>

        {/* SİL Butonu */}
        {photoList.length > 0 && (
          <button
            type="button"
            className="btn w-100 d-flex align-items-center justify-content-center gap-1 py-1 px-1 fw-semibold shadow-2xs"
            disabled={photoList.length === 0 || disabled}
            onClick={handleDeleteActivePhoto}
            style={{
              borderRadius: "8px",
              border: "1px solid #ff7675",
              color: "#e03131",
              backgroundColor: "transparent",
              fontSize: "11px",
              lineHeight: "1.4",
            }}
            title={photoList.length > 1 ? `Aktif Olanı Sil (${activePhoto?.label})` : "Fotoğrafı Sil"}
          >
            <IconTrash size={12} stroke={1.8} />
            <span>{photoList.length > 1 ? `Sil (${activePhoto?.label})` : "Fotoğrafı Sil"}</span>
          </button>
        )}

        {/* 5. İLGİLİ ALANLARI DOLDUR BUTONU */}
        {photoList.length > 0 && (
          <div className="w-100 mt-1">
            <button
              type="button"
              className={`btn w-100 d-flex align-items-center justify-content-center gap-1 py-1.5 px-1 fw-bold shadow-sm ${isScanning
                  ? "btn-secondary"
                  : isApplied
                    ? "btn-outline-success"
                    : "btn-success text-white"
                }`}
              style={{
                borderRadius: "8px",
                fontSize: "11px",
                letterSpacing: "0.2px",
              }}
              disabled={disabled || isScanning}
              onClick={handleFillFieldsClick}
              title="Görsellerden okunan kimlik bilgilerini form alanlarına aktar"
            >
              {isScanning ? (
                <>
                  <Spinner size="sm" animation="border" style={{ width: "12px", height: "12px" }} />
                  <span>Okunuyor...</span>
                </>
              ) : isApplied ? (
                <>
                  <IconCheck size={13} />
                  <span>Alanlar Dolduruldu</span>
                </>
              ) : (
                <>
                  <IconFileText size={13} />
                  <span>Alanları Doldur</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Yanlış Okuma Durumunda Hızlı Detaylı Yeniden Oku Bağlantısı */}
        {photoList.length > 0 && (
          <div className="d-flex align-items-center justify-content-center w-100 mt-1">
            <button
              type="button"
              className="btn btn-link btn-sm p-0 text-decoration-none text-muted d-flex align-items-center gap-1"
              style={{ fontSize: "9.5px" }}
              disabled={isScanning}
              onClick={() => triggerAutoOcr(photoList.map((p) => p.base64), true)}
              title="Görselleri en baştan çok daha detaylı analiz et (Yüksek çözünürlük, adaptif kontrast, binarize eşikleme ve MRZ odaklı)"
            >
              <IconSparkles size={11} className="text-warning" />
              <span>Yanlış okunduysa: <strong className="text-primary text-decoration-underline">Detaylı Yeniden Oku</strong></span>
            </button>
          </div>
        )}

        {/* Eksik Arka Yüz Bilgilendirme Kartı */}
        {selectedBelgeTuru === 0 && photoList.length === 1 && !extractedData?.babaAdi && !extractedData?.anneAdi && (
          <div
            className="mt-2 p-2 rounded-3 border border-warning-subtle text-start w-100 shadow-2xs"
            style={{ backgroundColor: "#fff9db", fontSize: "10px", lineHeight: "1.35" }}
          >
            <div className="d-flex align-items-center justify-content-between mb-1">
              <span className="fw-bold text-dark d-flex align-items-center gap-1">
                <span>💡 1. Ön Yüz Okundu</span>
              </span>
              <span className="badge bg-warning text-dark" style={{ fontSize: "8.5px" }}>
                Arka Yüz Eksik
              </span>
            </div>
            <div className="text-secondary mb-1.5" style={{ fontSize: "9.5px" }}>
              Yeni çipli kimliklerde <strong>Anne Adı</strong> ve <strong>Baba Adı</strong> arka yüzde yer alır.
              <br />
              <span className="text-muted" style={{ fontSize: "9px" }}>
                (Doğum Yeri ve İl/İlçe yeni kimliklerde çipte saklanır, kart üstünde yazmaz).
              </span>
            </div>
            <button
              type="button"
              className="btn btn-warning btn-sm w-100 py-1 px-1 fw-bold d-flex align-items-center justify-content-center gap-1 shadow-2xs"
              style={{ fontSize: "10px", borderRadius: "6px" }}
              onClick={handleAddSecondPhotoClick}
            >
              <span>➕ 2. Arka Yüzü Yükle</span>
            </button>
          </div>
        )}

        {/* 6. EKSİKSİZ OKUNAN BELGE BİLGİLERİ TABLOSU (Kullanıcının talep ettiği satır satır liste) */}
        {extractedData && (
          <div
            className="mt-2 p-2 bg-white border border-success-subtle rounded-3 shadow-2xs text-start w-100"
            style={{ fontSize: "10px", lineHeight: "1.4" }}
          >
            <div className="d-flex align-items-center justify-content-between border-bottom pb-1 mb-1.5">
              <span className="text-success fw-bold d-flex align-items-center gap-1">
                <IconCheck size={12} /> Okunan Bilgiler
              </span>
              <div className="d-flex align-items-center gap-1">

                <button
                  type="button"
                  className={`btn btn-xs ${isEditingOcr ? "btn-success text-white" : "btn-outline-primary"} py-0 px-1.5`}
                  style={{ fontSize: "9px", lineHeight: "1.2" }}
                  onClick={() => setIsEditingOcr(!isEditingOcr)}
                  title={isEditingOcr ? "Düzenlemeyi Bitir" : "Okunan Bilgileri Düzenle"}
                >
                  {isEditingOcr ? (
                    <>
                      <IconCheck size={10} className="me-0.5" /> Tamam
                    </>
                  ) : (
                    <>
                      <IconEdit size={10} className="me-0.5" /> Düzenle
                    </>
                  )}
                </button>
                <span className="badge bg-primary-subtle text-primary border border-primary-subtle" style={{ fontSize: "9px" }}>
                  {extractedData.belgeTuru === 1 ? "Pasaport" : extractedData.belgeTuru === 2 ? "Vergi Levhası" : "T.C. Kimlik"}
                </span>
              </div>
            </div>

            <div className="d-flex flex-column gap-1">
              {/* Belge Türü */}
              <div className="d-flex justify-content-between align-items-center py-0.5 border-bottom border-light">
                <span className="text-muted">Belge Türü:</span>
                <strong className="text-dark">
                  {extractedData.belgeTuru === 1 ? "Pasaport" : extractedData.belgeTuru === 2 ? "Vergi Levhası" : "T.C. Kimlik Kartı"}
                </strong>
              </div>

              {/* TCKN / VKN */}
              <div className="d-flex justify-content-between align-items-center py-0.5 border-bottom border-light">
                <span className="text-muted">{extractedData.belgeTuru === 2 ? "VKN / TCKN:" : "T.C. Kimlik No:"}</span>
                {isEditingOcr ? (
                  <input
                    type="text"
                    className="form-control form-control-sm py-0 px-1 text-end font-monospace fw-bold"
                    style={{ fontSize: "10px", height: "20px", maxWidth: "125px" }}
                    value={extractedData.tcKimlikNo || extractedData.vergiKimlikNo || ""}
                    onChange={(e) => handleEditOcrField("tcKimlikNo", e.target.value)}
                  />
                ) : (
                  <strong className="text-dark font-monospace text-primary">
                    {extractedData.tcKimlikNo || extractedData.vergiKimlikNo || "—"}
                  </strong>
                )}
              </div>

              {/* Cari Ünvan / Ad */}
              <div className="d-flex justify-content-between align-items-start py-0.5 border-bottom border-light">
                <span className="text-muted flex-shrink-0">Cari Ünvan:</span>
                {isEditingOcr ? (
                  <input
                    type="text"
                    className="form-control form-control-sm py-0 px-1 text-end fw-semibold"
                    style={{ fontSize: "10px", height: "20px", maxWidth: "125px" }}
                    value={extractedData.unvan || `${extractedData.ad || ""} ${extractedData.soyad || ""}`.trim()}
                    onChange={(e) => handleEditOcrField("unvan", e.target.value)}
                  />
                ) : (
                  <strong className="text-dark text-end ms-1 text-break">
                    {extractedData.unvan || `${extractedData.ad || ""} ${extractedData.soyad || ""}`.trim() || "—"}
                  </strong>
                )}
              </div>

              {/* Adı */}
              <div className="d-flex justify-content-between align-items-center py-0.5 border-bottom border-light">
                <span className="text-muted">Adı:</span>
                {isEditingOcr ? (
                  <input
                    type="text"
                    className="form-control form-control-sm py-0 px-1 text-end fw-semibold"
                    style={{ fontSize: "10px", height: "20px", maxWidth: "125px" }}
                    value={extractedData.ad || ""}
                    onChange={(e) => handleEditOcrField("ad", e.target.value)}
                  />
                ) : (
                  <strong className="text-dark">{extractedData.ad || "—"}</strong>
                )}
              </div>

              {/* Soyadı */}
              <div className="d-flex justify-content-between align-items-center py-0.5 border-bottom border-light">
                <span className="text-muted">Soyadı:</span>
                {isEditingOcr ? (
                  <input
                    type="text"
                    className="form-control form-control-sm py-0 px-1 text-end fw-semibold"
                    style={{ fontSize: "10px", height: "20px", maxWidth: "125px" }}
                    value={extractedData.soyad || ""}
                    onChange={(e) => handleEditOcrField("soyad", e.target.value)}
                  />
                ) : (
                  <strong className="text-dark">{extractedData.soyad || "—"}</strong>
                )}
              </div>

              {/* Kimlik Seri No (Kimlik için) */}
              {extractedData.belgeTuru === 0 && (
                <div className="d-flex justify-content-between align-items-center py-0.5 border-bottom border-light">
                  <span className="text-muted">Kimlik Seri No:</span>
                  {isEditingOcr ? (
                    <input
                      type="text"
                      className="form-control form-control-sm py-0 px-1 text-end font-monospace"
                      style={{ fontSize: "10px", height: "20px", maxWidth: "125px" }}
                      value={extractedData.kimlikSeriNo || ""}
                      onChange={(e) => handleEditOcrField("kimlikSeriNo", e.target.value)}
                    />
                  ) : (
                    <strong className="text-dark font-monospace">{extractedData.kimlikSeriNo || "—"}</strong>
                  )}
                </div>
              )}

              {/* Pasaport No (Pasaport için) */}
              {(extractedData.belgeTuru === 1 || extractedData.pasaportNo) && (
                <div className="d-flex justify-content-between align-items-center py-0.5 border-bottom border-light">
                  <span className="text-muted">Pasaport No:</span>
                  {isEditingOcr ? (
                    <input
                      type="text"
                      className="form-control form-control-sm py-0 px-1 text-end font-monospace"
                      style={{ fontSize: "10px", height: "20px", maxWidth: "125px" }}
                      value={extractedData.pasaportNo || ""}
                      onChange={(e) => handleEditOcrField("pasaportNo", e.target.value)}
                    />
                  ) : (
                    <strong className="text-dark font-monospace">{extractedData.pasaportNo || "—"}</strong>
                  )}
                </div>
              )}

              {/* Doğum Tarihi (Sadece Kimlik ve Pasaport) */}
              {extractedData.belgeTuru !== 2 && (
                <div className="d-flex justify-content-between align-items-center py-0.5 border-bottom border-light">
                  <span className="text-muted">Doğum Tarihi:</span>
                  {isEditingOcr ? (
                    <input
                      type="date"
                      className="form-control form-control-sm py-0 px-1 text-end font-monospace"
                      style={{ fontSize: "9px", height: "20px", maxWidth: "125px" }}
                      value={extractedData.dogumTarihi || ""}
                      onChange={(e) => handleEditOcrField("dogumTarihi", e.target.value)}
                    />
                  ) : (
                    <strong className="text-dark font-monospace">
                      {extractedData.dogumTarihi ? formatDateTr(extractedData.dogumTarihi) : "—"}
                    </strong>
                  )}
                </div>
              )}

              {/* Geçerlilik Tarihi */}
              {extractedData.belgeTuru !== 2 && (
                <div className="d-flex justify-content-between align-items-center py-0.5 border-bottom border-light">
                  <span className="text-muted">Geçerlilik Tarihi:</span>
                  {isEditingOcr ? (
                    <input
                      type="date"
                      className="form-control form-control-sm py-0 px-1 text-end font-monospace"
                      style={{ fontSize: "9px", height: "20px", maxWidth: "125px" }}
                      value={extractedData.kimlikGecerlilikTarihi || ""}
                      onChange={(e) => handleEditOcrField("kimlikGecerlilikTarihi", e.target.value)}
                    />
                  ) : (
                    <strong className="text-dark font-monospace">
                      {extractedData.kimlikGecerlilikTarihi ? formatDateTr(extractedData.kimlikGecerlilikTarihi) : "—"}
                    </strong>
                  )}
                </div>
              )}

              {/* Cinsiyet */}
              {extractedData.belgeTuru !== 2 && (
                <div className="d-flex justify-content-between align-items-center py-0.5 border-bottom border-light">
                  <span className="text-muted">Cinsiyet:</span>
                  {isEditingOcr ? (
                    <select
                      className="form-select form-select-sm py-0 px-1 text-end"
                      style={{ fontSize: "9px", height: "20px", maxWidth: "125px" }}
                      value={extractedData.cinsiyet || ""}
                      onChange={(e) => handleEditOcrField("cinsiyet", e.target.value)}
                    >
                      <option value="">Seçiniz</option>
                      <option value="Erkek (E)">Erkek (E)</option>
                      <option value="Kadın (K)">Kadın (K)</option>
                    </select>
                  ) : (
                    <strong className="text-dark">{extractedData.cinsiyet || "—"}</strong>
                  )}
                </div>
              )}

              {/* Ülke & Uyruk */}
              <div className="d-flex justify-content-between align-items-center py-0.5 border-bottom border-light">
                <span className="text-muted">Ülke / Uyruk:</span>
                <strong className="text-dark">
                  {(extractedData.ulke || "Türkiye")} / {(extractedData.uyruk || "T.C.")}
                </strong>
              </div>

              {/* Baba Adı (Sadece Kimlik ve Pasaport) */}
              {extractedData.belgeTuru !== 2 && (
                <div className="d-flex justify-content-between align-items-center py-0.5 border-bottom border-light">
                  <span className="text-muted">Baba Adı:</span>
                  {isEditingOcr ? (
                    <input
                      type="text"
                      className="form-control form-control-sm py-0 px-1 text-end fw-semibold"
                      style={{ fontSize: "10px", height: "20px", maxWidth: "125px" }}
                      value={extractedData.babaAdi || ""}
                      placeholder="Baba Adı"
                      onChange={(e) => handleEditOcrField("babaAdi", e.target.value)}
                    />
                  ) : extractedData.babaAdi ? (
                    <strong className="text-dark">{extractedData.babaAdi}</strong>
                  ) : extractedData.belgeTuru === 0 && photoList.length < 2 ? (
                    <span
                      className="text-danger fw-bold"
                      style={{ cursor: "pointer", textDecoration: "underline" }}
                      onClick={handleAddSecondPhotoClick}
                      title="2. Arka Yüzü ekleyerek okutabilirsiniz"
                    >
                      + Arka Yüzü Yükle ↗
                    </span>
                  ) : (
                    <span className="text-muted fst-italic">
                      {extractedData.belgeTuru === 0 ? "Okunamadı" : "Belgede Yok"}
                    </span>
                  )}
                </div>
              )}

              {/* Anne Adı (Sadece Kimlik ve Pasaport) */}
              {extractedData.belgeTuru !== 2 && (
                <div className="d-flex justify-content-between align-items-center py-0.5 border-bottom border-light">
                  <span className="text-muted">Anne Adı:</span>
                  {isEditingOcr ? (
                    <input
                      type="text"
                      className="form-control form-control-sm py-0 px-1 text-end fw-semibold"
                      style={{ fontSize: "10px", height: "20px", maxWidth: "125px" }}
                      value={extractedData.anneAdi || ""}
                      placeholder="Anne Adı"
                      onChange={(e) => handleEditOcrField("anneAdi", e.target.value)}
                    />
                  ) : extractedData.anneAdi ? (
                    <strong className="text-dark">{extractedData.anneAdi}</strong>
                  ) : extractedData.belgeTuru === 0 && photoList.length < 2 ? (
                    <span
                      className="text-danger fw-bold"
                      style={{ cursor: "pointer", textDecoration: "underline" }}
                      onClick={handleAddSecondPhotoClick}
                      title="2. Arka Yüzü ekleyerek okutabilirsiniz"
                    >
                      + Arka Yüzü Yükle ↗
                    </span>
                  ) : (
                    <span className="text-muted fst-italic">
                      {extractedData.belgeTuru === 0 ? "Okunamadı" : "Belgede Yok"}
                    </span>
                  )}
                </div>
              )}


              {/* Doğum Yeri (Sadece Pasaport için gösterilir, Kimlikte yoktur) */}
              {extractedData.belgeTuru === 1 && (
                <div className="d-flex justify-content-between align-items-center py-0.5 border-bottom border-light">
                  <span className="text-muted">Doğum Yeri:</span>
                  <strong className="text-dark">{extractedData.dogumYeri || "—"}</strong>
                </div>
              )}

              {/* İl (Sadece Vergi Levhası için gösterilir, Kimlikte yoktur) */}
              {extractedData.belgeTuru === 2 && (
                <div className="d-flex justify-content-between align-items-center py-0.5 border-bottom border-light">
                  <span className="text-muted">İl:</span>
                  <strong className="text-dark">{extractedData.il || "—"}</strong>
                </div>
              )}

              {/* İlçe (Sadece Vergi Levhası için gösterilir, Kimlikte yoktur) */}
              {extractedData.belgeTuru === 2 && (
                <div className="d-flex justify-content-between align-items-center py-0.5 border-bottom border-light">
                  <span className="text-muted">İlçe:</span>
                  <strong className="text-dark">{extractedData.ilce || "—"}</strong>
                </div>
              )}

              {/* Vergi Dairesi (Vergi Levhası veya Varsa) */}
              {(extractedData.belgeTuru === 2 || extractedData.vergiDairesiAdi) && (
                <div className="d-flex justify-content-between align-items-center py-0.5 border-bottom border-light">
                  <span className="text-muted">Vergi Dairesi:</span>
                  <strong className="text-dark">{extractedData.vergiDairesiAdi || "—"}</strong>
                </div>
              )}

              {/* Adres (Vergi Levhası veya Varsa) */}
              {(extractedData.belgeTuru === 2 || extractedData.adres) && (
                <div className="d-flex flex-column py-0.5 border-bottom border-light">
                  <span className="text-muted">Adres:</span>
                  <span className="text-dark fw-semibold text-break">{extractedData.adres || "—"}</span>
                </div>
              )}

              {/* Ana Faaliyet (Vergi Levhası veya Varsa) */}
              {(extractedData.belgeTuru === 2 || extractedData.faaliyetKonusu) && (
                <div className="d-flex flex-column py-0.5">
                  <span className="text-muted">Ana Faaliyet:</span>
                  <span className="text-dark fw-semibold text-break">{extractedData.faaliyetKonusu || "—"}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {!isSavedInSql && photoList.length > 0 && (
          <div className="text-center mt-0.5">
            <span
              className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle fw-semibold"
              style={{ fontSize: "8.5px" }}
            >
              ● Kayıt Bekliyor ({photoList.length})
            </span>
          </div>
        )}

        {/* Gizli Dosya Seçici */}
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: "none" }}
          accept="image/*,application/pdf"
          multiple
          onClick={(e) => {
            (e.target as any).value = null;
          }}
          onChange={handleFileChange}
        />

        {/* İlerleme Çubuğu */}
        {isScanning && (
          <div className="bg-white p-1 rounded-2 border mt-1 w-100">
            <div
              className="d-flex justify-content-between align-items-center mb-1"
              style={{ fontSize: "9px" }}
            >
              <span
                className="fw-semibold text-primary d-flex align-items-center gap-1 text-truncate"
                style={{ maxWidth: "120px" }}
              >
                <Spinner size="sm" animation="grow" style={{ width: "6px", height: "6px" }} /> {scanStatus}
              </span>
              <span className="fw-bold">{scanProgress}%</span>
            </div>
            <ProgressBar now={scanProgress} variant="primary" animated style={{ height: "4px" }} />
          </div>
        )}

        {/* Hata Bildirimi */}
        {ocrError && (
          <Alert
            variant="danger"
            className="py-1 px-1 mb-0 mt-1 small d-flex align-items-center gap-1 w-100"
            dismissible
            onClose={() => setOcrError(null)}
            style={{ fontSize: "9px" }}
          >
            <IconAlertCircle size={12} className="flex-shrink-0" />
            <span className="text-truncate">{ocrError}</span>
          </Alert>
        )}
      </div>

      {/* Kamera Modalı */}
      <Modal show={isCameraActive} onHide={stopCamera} centered size="lg">
        <Modal.Header closeButton className="py-2">
          <Modal.Title className="h6 d-flex align-items-center gap-2 mb-0">
            <IconCamera size={18} className="text-primary" />
            <span>Kimlik / Pasaport Fotoğrafı Çek</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3 text-center bg-dark">
          {cameraError ? (
            <Alert variant="danger" className="mb-0 text-start">
              {cameraError}
            </Alert>
          ) : (
            <div className="position-relative d-inline-block w-100" style={{ maxWidth: "640px" }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ width: "100%", maxHeight: "420px", borderRadius: "8px", objectFit: "contain" }}
              />
              <div
                className="position-absolute top-50 start-50 translate-middle border border-warning border-2 rounded-3"
                style={{
                  width: "80%",
                  height: "65%",
                  pointerEvents: "none",
                  boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.4)",
                }}
              >
                <span className="badge bg-warning text-dark position-absolute top-0 start-50 translate-middle-x mt-2">
                  Belgeyi Bu Alana Hizalayın
                </span>
              </div>
            </div>
          )}
          <canvas ref={canvasRef} style={{ display: "none" }} />
        </Modal.Body>
        <Modal.Footer className="py-2 d-flex justify-content-between">
          <Button variant="secondary" size="sm" onClick={stopCamera}>
            İptal
          </Button>
          <Button
            variant="success"
            className="fw-bold px-4 text-white d-flex align-items-center gap-2"
            onClick={capturePhoto}
            disabled={!isCameraActive || !!cameraError}
          >
            <IconCamera size={18} />
            <span>Fotoğrafı Çek & Ekle</span>
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Büyütme Modalı */}
      <Modal show={showZoomModal} onHide={() => setShowZoomModal(false)} centered size="xl">
        <Modal.Header closeButton className="py-2">
          <Modal.Title className="h6 d-flex align-items-center gap-2 mb-0">
            <IconZoomIn size={18} className="text-primary" />
            <span>
              {selectedBelgeTuru === 1 ? "Pasaport" : selectedBelgeTuru === 2 ? "Vergi Levhası" : "T.C. Kimlik"}{" "}
              Fotoğrafı
              {photoList.length > 1
                ? ` (${safeActiveIndex + 1} / ${photoList.length} - ${activePhoto?.label})`
                : ""}
            </span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3 text-center bg-light">
          {displayImage ? (
            <div className="d-flex flex-column align-items-center justify-content-center">
              <img
                src={displayImage}
                alt="Belge Tam Boyut"
                style={{
                  maxWidth: "100%",
                  maxHeight: "70vh",
                  objectFit: "contain",
                  borderRadius: "8px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                }}
              />

              {photoList.length > 1 && (
                <div className="d-flex align-items-center justify-content-center gap-2 mt-3 bg-white p-2 rounded-3 shadow-sm border">
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    disabled={safeActiveIndex === 0}
                    onClick={() => setActiveIndex(Math.max(0, safeActiveIndex - 1))}
                  >
                    <IconChevronLeft size={16} /> Önceki
                  </Button>
                  <div className="d-flex gap-1.5 mx-2">
                    {photoList.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className={`btn btn-sm ${idx === safeActiveIndex ? "btn-primary text-white" : "btn-outline-secondary"
                          }`}
                        onClick={() => setActiveIndex(idx)}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    disabled={safeActiveIndex === photoList.length - 1}
                    onClick={() => setActiveIndex(Math.min(photoList.length - 1, safeActiveIndex + 1))}
                  >
                    Sonraki <IconChevronRight size={16} />
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted my-4">Görüntülenecek fotoğraf bulunamadı.</p>
          )}
        </Modal.Body>
        <Modal.Footer className="py-2 d-flex justify-content-between">
          <Button variant="secondary" size="sm" onClick={() => setShowZoomModal(false)}>
            Kapat
          </Button>
          {displayImage && (
            <div className="d-flex align-items-center gap-2">
              <Button
                variant="outline-primary"
                size="sm"
                className="d-flex align-items-center gap-1.5"
                onClick={() => {
                  setShowZoomModal(false);
                  setShowCropModal(true);
                }}
              >
                <IconCrop size={16} />
                <span>Fotoğrafı Kırp</span>
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="d-flex align-items-center gap-1.5"
                onClick={() => {
                  setShowZoomModal(false);
                  triggerAutoOcr(photoList.map((p) => p.base64), true);
                }}
              >
                <IconSparkles size={16} />
                <span>Detaylı Yeniden Oku</span>
              </Button>
            </div>
          )}
        </Modal.Footer>
      </Modal>

      {/* Manuel Kırpma (Crop) Modalı */}
      {displayImage && (
        <ImageCropperModal
          show={showCropModal}
          onHide={() => setShowCropModal(false)}
          imageSrc={displayImage}
          onCropDone={handleCropDone}
          title={`${activePhoto?.label || "Kimlik"} Fotoğrafını Kırp`}
        />
      )}
    </div>
  );
};
