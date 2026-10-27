import React, { useState, useRef, useEffect, useCallback } from "react";
import { Modal, Button, ButtonGroup, Spinner } from "react-bootstrap";
import {
  IconCrop,
  IconRotateClockwise,
  IconSparkles,
  IconRefresh,
  IconCheck,
  IconX,
} from "@tabler/icons-react";
import { autoCropIdCard } from "../../utils/imageCropUtils";

export interface ImageCropperModalProps {
  show: boolean;
  onHide: () => void;
  imageSrc: string;
  title?: string;
  onCropDone: (croppedBase64: string) => void;
}

interface CropRect {
  x: number; // 0..100 (%)
  y: number; // 0..100 (%)
  width: number; // 0..100 (%)
  height: number; // 0..100 (%)
}

type DragHandle = "move" | "nw" | "ne" | "sw" | "se" | "n" | "s" | "w" | "e" | null;

export const ImageCropperModal: React.FC<ImageCropperModalProps> = ({
  show,
  onHide,
  imageSrc,
  title = "Kimlik Fotoğrafını Kırp",
  onCropDone,
}) => {
  const [currentImage, setCurrentImage] = useState<string>(imageSrc);
  const [isRotating, setIsRotating] = useState<boolean>(false);
  const [isAutoCropping, setIsAutoCropping] = useState<boolean>(false);

  // Kırpma kutusu (yüzde bazlı, varsayılan olarak %4 emniyet paylı iç alan)
  const [crop, setCrop] = useState<CropRect>({
    x: 5,
    y: 5,
    width: 90,
    height: 90,
  });

  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // Sürükleme durumu
  const dragRef = useRef<{
    activeHandle: DragHandle;
    startX: number;
    startY: number;
    startCrop: CropRect;
    boxWidth: number;
    boxHeight: number;
  } | null>(null);

  useEffect(() => {
    if (show) {
      setCurrentImage(imageSrc);
      setCrop({ x: 5, y: 5, width: 90, height: 90 });
    }
  }, [show, imageSrc]);

  // Görseli 90 Derece Döndürme
  const handleRotate = async () => {
    if (isRotating || !currentImage) return;
    setIsRotating(true);
    try {
      const rotated = await new Promise<string>((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.height;
          canvas.height = img.width;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(currentImage);
            return;
          }
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate((90 * Math.PI) / 180);
          ctx.drawImage(img, -img.width / 2, -img.height / 2);
          resolve(
            canvas.toDataURL(
              currentImage.startsWith("data:image/png") ? "image/png" : "image/jpeg",
              0.94
            )
          );
        };
        img.onerror = () => resolve(currentImage);
        img.src = currentImage;
      });

      setCurrentImage(rotated);
      setCrop({ x: 5, y: 5, width: 90, height: 90 });
    } catch {
      // sessizce geç
    } finally {
      setIsRotating(false);
    }
  };

  // Otomatik Boşlukları Kırp Butonu
  const handleAutoCrop = async () => {
    if (isAutoCropping || !currentImage) return;
    setIsAutoCropping(true);
    try {
      const res = await autoCropIdCard(currentImage);
      if (res && res !== currentImage) {
        setCurrentImage(res);
        setCrop({ x: 0, y: 0, width: 100, height: 100 });
      }
    } finally {
      setIsAutoCropping(false);
    }
  };

  // Kimlik Oranı (ID-1 Standardı: 85.6mm x 53.98mm = 1.586:1)
  const handleSnapToIdRatio = () => {
    const img = imageRef.current;
    if (!img) return;
    const nw = img.naturalWidth || 1;
    const nh = img.naturalHeight || 1;

    // Hedef oran W/H = 1.586
    const targetRatio = 1.586;
    // Görselin piksel en/boy oranı
    const imgRatio = nw / nh;

    // Yüzde cinsinden hedeflenen genişlik/yükseklik
    let wPct = 90;
    let hPct = (wPct * imgRatio) / targetRatio;

    if (hPct > 90) {
      hPct = 90;
      wPct = (hPct * targetRatio) / imgRatio;
    }

    setCrop({
      x: Math.max(0, (100 - wPct) / 2),
      y: Math.max(0, (100 - hPct) / 2),
      width: Math.min(100, wPct),
      height: Math.min(100, hPct),
    });
  };

  // Tamamını Seç (Sıfırla)
  const handleResetToFull = () => {
    setCrop({ x: 0, y: 0, width: 100, height: 100 });
  };

  // Sürükleme Başlatıcı
  const startDrag = (handle: DragHandle, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    dragRef.current = {
      activeHandle: handle,
      startX: e.clientX,
      startY: e.clientY,
      startCrop: { ...crop },
      boxWidth: rect.width,
      boxHeight: rect.height,
    };

    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  // Sürükleme Hareketi
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    e.preventDefault();

    const { activeHandle, startX, startY, startCrop, boxWidth, boxHeight } = dragRef.current;
    if (boxWidth <= 0 || boxHeight <= 0) return;

    const deltaX = ((e.clientX - startX) / boxWidth) * 100;
    const deltaY = ((e.clientY - startY) / boxHeight) * 100;

    const minSize = 6; // En az %6 boyut

    if (activeHandle === "move") {
      let nextX = startCrop.x + deltaX;
      let nextY = startCrop.y + deltaY;

      nextX = Math.max(0, Math.min(100 - startCrop.width, nextX));
      nextY = Math.max(0, Math.min(100 - startCrop.height, nextY));

      setCrop((prev) => ({ ...prev, x: nextX, y: nextY }));
      return;
    }

    let { x, y, width, height } = startCrop;

    // Yatay tutamaçlar
    if (activeHandle === "nw" || activeHandle === "w" || activeHandle === "sw") {
      const maxX = startCrop.x + startCrop.width - minSize;
      const newX = Math.max(0, Math.min(maxX, startCrop.x + deltaX));
      width = startCrop.width + (startCrop.x - newX);
      x = newX;
    } else if (activeHandle === "ne" || activeHandle === "e" || activeHandle === "se") {
      const maxW = 100 - startCrop.x;
      width = Math.max(minSize, Math.min(maxW, startCrop.width + deltaX));
    }

    // Dikey tutamaçlar
    if (activeHandle === "nw" || activeHandle === "n" || activeHandle === "ne") {
      const maxY = startCrop.y + startCrop.height - minSize;
      const newY = Math.max(0, Math.min(maxY, startCrop.y + deltaY));
      height = startCrop.height + (startCrop.y - newY);
      y = newY;
    } else if (activeHandle === "sw" || activeHandle === "s" || activeHandle === "se") {
      const maxH = 100 - startCrop.y;
      height = Math.max(minSize, Math.min(maxH, startCrop.height + deltaY));
    }

    setCrop({
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      width: Math.round(width * 10) / 10,
      height: Math.round(height * 10) / 10,
    });
  };

  // Sürükleme Bitişi
  const onPointerUp = (e: React.PointerEvent) => {
    if (dragRef.current) {
      dragRef.current = null;
      try {
        (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch {}
    }
  };

  // Kırp ve Onayla
  const handleApplyCrop = () => {
    const img = imageRef.current;
    if (!img) return;

    const nw = img.naturalWidth;
    const nh = img.naturalHeight;

    const cropX = Math.max(0, Math.round((crop.x / 100) * nw));
    const cropY = Math.max(0, Math.round((crop.y / 100) * nh));
    const cropW = Math.min(nw - cropX, Math.round((crop.width / 100) * nw));
    const cropH = Math.min(nh - cropY, Math.round((crop.height / 100) * nh));

    if (cropW <= 10 || cropH <= 10) {
      onHide();
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = cropW;
    canvas.height = cropH;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      onHide();
      return;
    }

    ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
    const mime = currentImage.startsWith("data:image/png") ? "image/png" : "image/jpeg";
    const result = canvas.toDataURL(mime, 0.94);

    onCropDone(result);
    onHide();
  };

  return (
    <Modal
      show={show}
      onHide={onHide}
      size="lg"
      centered
      backdrop="static"
      className="image-cropper-modal"
    >
      <Modal.Header closeButton className="py-2 px-3 bg-light border-bottom">
        <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 mb-0">
          <IconCrop size={18} className="text-primary" />
          <span>{title}</span>
        </Modal.Title>
      </Modal.Header>

      <Modal.Body className="p-3 bg-dark d-flex flex-column align-items-center justify-content-center">
        {/* Kontrol Butonları */}
        <div className="d-flex flex-wrap align-items-center justify-content-center gap-2 mb-3 w-100">
          <ButtonGroup size="sm">
            <Button
              variant="outline-light"
              className="fw-semibold px-2.5 py-1 d-flex align-items-center gap-1.5"
              onClick={handleSnapToIdRatio}
              title="Standart Kimlik Kartı Oranına Ayarla (~1.58:1)"
            >
              <IconCrop size={14} />
              <span>Kimlik Oranı</span>
            </Button>
            <Button
              variant="outline-light"
              className="fw-semibold px-2.5 py-1 d-flex align-items-center gap-1.5"
              onClick={handleResetToFull}
              title="Tüm Görseli Seç"
            >
              <IconRefresh size={14} />
              <span>Tamamı</span>
            </Button>
            <Button
              variant="outline-light"
              className="fw-semibold px-2.5 py-1 d-flex align-items-center gap-1.5"
              onClick={handleAutoCrop}
              disabled={isAutoCropping}
              title="Boşlukları Otomatik Kırp"
            >
              {isAutoCropping ? <Spinner animation="border" size="sm" /> : <IconSparkles size={14} className="text-warning" />}
              <span>Otomatik Kırp</span>
            </Button>
            <Button
              variant="outline-light"
              className="fw-semibold px-2.5 py-1 d-flex align-items-center gap-1.5"
              onClick={handleRotate}
              disabled={isRotating}
              title="Görseli 90 Derece Sağa Döndür"
            >
              {isRotating ? <Spinner animation="border" size="sm" /> : <IconRotateClockwise size={14} />}
              <span>90° Döndür</span>
            </Button>
          </ButtonGroup>
        </div>

        {/* Görsel ve Kırpma Alanı */}
        <div
          ref={containerRef}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          style={{
            position: "relative",
            display: "inline-block",
            maxWidth: "100%",
            maxHeight: "62vh",
            userSelect: "none",
            touchAction: "none",
            backgroundColor: "#1e293b",
            borderRadius: "6px",
            overflow: "hidden",
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          }}
        >
          <img
            ref={imageRef}
            src={currentImage}
            alt="Kırpılacak Görsel"
            draggable={false}
            style={{
              display: "block",
              maxWidth: "100%",
              maxHeight: "62vh",
              objectFit: "contain",
              pointerEvents: "none",
            }}
          />

          {/* Dış Karartma Katmanları (Kırpma alanı dışı) */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: `${crop.y}%`,
              backgroundColor: "rgba(0, 0, 0, 0.65)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: `${100 - crop.y - crop.height}%`,
              backgroundColor: "rgba(0, 0, 0, 0.65)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: `${crop.y}%`,
              bottom: `${100 - crop.y - crop.height}%`,
              left: 0,
              width: `${crop.x}%`,
              backgroundColor: "rgba(0, 0, 0, 0.65)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: `${crop.y}%`,
              bottom: `${100 - crop.y - crop.height}%`,
              right: 0,
              width: `${100 - crop.x - crop.width}%`,
              backgroundColor: "rgba(0, 0, 0, 0.65)",
              pointerEvents: "none",
            }}
          />

          {/* Kırpma Çerçevesi (Hareket Ettirilebilir ve Boyutlandırılabilir) */}
          <div
            onPointerDown={(e) => startDrag("move", e)}
            style={{
              position: "absolute",
              top: `${crop.y}%`,
              left: `${crop.x}%`,
              width: `${crop.width}%`,
              height: `${crop.height}%`,
              border: "2px solid #3b82f6",
              boxShadow: "0 0 0 1px rgba(255, 255, 255, 0.7), inset 0 0 0 1px rgba(255, 255, 255, 0.4)",
              cursor: "move",
              boxSizing: "border-box",
            }}
          >
            {/* Üçler Kuralı Izgara Çizgileri */}
            <div
              style={{
                position: "absolute",
                top: "33.33%",
                left: 0,
                right: 0,
                borderTop: "1px dashed rgba(255, 255, 255, 0.4)",
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: "66.66%",
                left: 0,
                right: 0,
                borderTop: "1px dashed rgba(255, 255, 255, 0.4)",
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: "33.33%",
                top: 0,
                bottom: 0,
                borderLeft: "1px dashed rgba(255, 255, 255, 0.4)",
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: "66.66%",
                top: 0,
                bottom: 0,
                borderLeft: "1px dashed rgba(255, 255, 255, 0.4)",
                pointerEvents: "none",
              }}
            />

            {/* Köşe Tutamaçları */}
            <div
              onPointerDown={(e) => startDrag("nw", e)}
              style={{
                position: "absolute",
                top: -6,
                left: -6,
                width: 13,
                height: 13,
                backgroundColor: "#2563eb",
                border: "2px solid #ffffff",
                cursor: "nwse-resize",
                zIndex: 10,
              }}
            />
            <div
              onPointerDown={(e) => startDrag("ne", e)}
              style={{
                position: "absolute",
                top: -6,
                right: -6,
                width: 13,
                height: 13,
                backgroundColor: "#2563eb",
                border: "2px solid #ffffff",
                cursor: "nesw-resize",
                zIndex: 10,
              }}
            />
            <div
              onPointerDown={(e) => startDrag("sw", e)}
              style={{
                position: "absolute",
                bottom: -6,
                left: -6,
                width: 13,
                height: 13,
                backgroundColor: "#2563eb",
                border: "2px solid #ffffff",
                cursor: "nesw-resize",
                zIndex: 10,
              }}
            />
            <div
              onPointerDown={(e) => startDrag("se", e)}
              style={{
                position: "absolute",
                bottom: -6,
                right: -6,
                width: 13,
                height: 13,
                backgroundColor: "#2563eb",
                border: "2px solid #ffffff",
                cursor: "nwse-resize",
                zIndex: 10,
              }}
            />

            {/* Kenar Tutamaçları */}
            <div
              onPointerDown={(e) => startDrag("n", e)}
              style={{
                position: "absolute",
                top: -5,
                left: "50%",
                transform: "translateX(-50%)",
                width: 20,
                height: 8,
                backgroundColor: "#2563eb",
                border: "1.5px solid #ffffff",
                borderRadius: "3px",
                cursor: "ns-resize",
                zIndex: 10,
              }}
            />
            <div
              onPointerDown={(e) => startDrag("s", e)}
              style={{
                position: "absolute",
                bottom: -5,
                left: "50%",
                transform: "translateX(-50%)",
                width: 20,
                height: 8,
                backgroundColor: "#2563eb",
                border: "1.5px solid #ffffff",
                borderRadius: "3px",
                cursor: "ns-resize",
                zIndex: 10,
              }}
            />
            <div
              onPointerDown={(e) => startDrag("w", e)}
              style={{
                position: "absolute",
                left: -5,
                top: "50%",
                transform: "translateY(-50%)",
                width: 8,
                height: 20,
                backgroundColor: "#2563eb",
                border: "1.5px solid #ffffff",
                borderRadius: "3px",
                cursor: "ew-resize",
                zIndex: 10,
              }}
            />
            <div
              onPointerDown={(e) => startDrag("e", e)}
              style={{
                position: "absolute",
                right: -5,
                top: "50%",
                transform: "translateY(-50%)",
                width: 8,
                height: 20,
                backgroundColor: "#2563eb",
                border: "1.5px solid #ffffff",
                borderRadius: "3px",
                cursor: "ew-resize",
                zIndex: 10,
              }}
            />
          </div>
        </div>

        <div className="mt-2 text-white-50 small" style={{ fontSize: "11px" }}>
          💡 Mavi çerçeveyi sürükleyerek veya kenarlarından tutarak kimlik alanını ayarlayabilirsiniz.
        </div>
      </Modal.Body>

      <Modal.Footer className="py-2 px-3 bg-light border-top d-flex justify-content-between">
        <Button variant="secondary" size="sm" onClick={onHide} className="px-3">
          <IconX size={15} className="me-1" />
          <span>İptal</span>
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleApplyCrop}
          className="fw-bold px-4 d-flex align-items-center gap-1.5"
        >
          <IconCheck size={16} />
          <span>Kırp ve Uygula</span>
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ImageCropperModal;
