/**
 * Otomatik Kimlik / Belge Kırpma Yardımcısı (Auto Crop ID Card)
 * 
 * Tarayıcı (flatbed scanner), doküman taraması veya kameradan yüklenen kimliklerde;
 * kimlik dışında kalan üst, alt ve yan boşlukları (beyaz, siyah veya boş arka plan alanlarını)
 * tespit ederek görseli otomatik olarak kimliğin kendisine kırpar.
 */

export async function autoCropIdCard(imageSrc: string): Promise<string> {
  // Eğer geçerli bir data URL değilse işlem yapmadan döndür
  if (!imageSrc || !imageSrc.startsWith("data:image/")) {
    return imageSrc;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const origW = img.naturalWidth || img.width;
        const origH = img.naturalHeight || img.height;

        // Çok küçük görseller için işlem yapma
        if (origW < 50 || origH < 50) {
          resolve(imageSrc);
          return;
        }

        // Hızlı piksel analizi için küçültülmüş analiz tuvali kullan
        const maxDim = 800;
        let w = origW;
        let h = origH;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          resolve(imageSrc);
          return;
        }

        ctx.drawImage(img, 0, 0, w, h);
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;

        // 1. Köşeleri ve kenar bantlarını örnekleyerek arka plan rengini ve türünü tespit et
        const sampleSize = Math.max(3, Math.min(12, Math.floor(Math.min(w, h) * 0.03)));
        let bgR = 0, bgG = 0, bgB = 0, bgCount = 0;
        let whiteCount = 0;
        let darkCount = 0;

        const samplePatch = (startX: number, startY: number) => {
          const endY = Math.min(h, startY + sampleSize);
          const endX = Math.min(w, startX + sampleSize);
          for (let py = startY; py < endY; py++) {
            for (let px = startX; px < endX; px++) {
              const idx = (py * w + px) * 4;
              const a = data[idx + 3];
              if (a < 50) continue; // Şeffaf alanları geç
              const r = data[idx];
              const g = data[idx + 1];
              const b = data[idx + 2];
              bgR += r;
              bgG += g;
              bgB += b;
              bgCount++;
              const lum = 0.299 * r + 0.587 * g + 0.114 * b;
              if (lum > 215) whiteCount++;
              else if (lum < 45) darkCount++;
            }
          }
        };

        samplePatch(0, 0); // Sol üst
        samplePatch(Math.max(0, w - sampleSize), 0); // Sağ üst
        samplePatch(0, Math.max(0, h - sampleSize)); // Sol alt
        samplePatch(Math.max(0, w - sampleSize), Math.max(0, h - sampleSize)); // Sağ alt

        const isMostlyWhiteBg = bgCount > 0 && whiteCount / bgCount > 0.6;
        const isMostlyDarkBg = bgCount > 0 && darkCount / bgCount > 0.6;

        const avgR = bgCount > 0 ? bgR / bgCount : 255;
        const avgG = bgCount > 0 ? bgG / bgCount : 255;
        const avgB = bgCount > 0 ? bgB / bgCount : 255;

        // Bir pikselin arka plan mı yoksa kimlik içeriği mi olduğunu belirler
        const isContentPixel = (x: number, y: number): boolean => {
          const idx = (y * w + x) * 4;
          const a = data[idx + 3];
          if (a < 50) return false;

          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];

          if (isMostlyWhiteBg) {
            // Beyaz/açık zemin (Standart tarayıcı veya A4 sayfası)
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            if (lum < 210) return true;
            // Renk doygunluğu kontrolü (kimlik üzerindeki renkler/desenler)
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            if (max - min > 18) return true;
            const dist = Math.sqrt((r - avgR) ** 2 + (g - avgG) ** 2 + (b - avgB) ** 2);
            return dist > 25;
          } else if (isMostlyDarkBg) {
            // Siyah/koyu zemin (Açık tarayıcı kapağı veya koyu masaüstü)
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            return lum > 55;
          } else {
            // Düz renkli farklı arka plan
            const dist = Math.sqrt((r - avgR) ** 2 + (g - avgG) ** 2 + (b - avgB) ** 2);
            return dist > 32;
          }
        };

        // 2. Üst ve alt sınırları (satır bazlı) tara
        // Eşik: Bir satırın kimlik içermesi için genişliğinin en az %3.5'inde içerik pikseli olmalı
        const rowContentThreshold = Math.max(10, Math.floor(w * 0.035));

        let top = -1;
        let bottom = -1;

        // Üst kenar tespiti (yukarıdan aşağıya)
        for (let y = 0; y < h; y++) {
          let count = 0;
          for (let x = 0; x < w; x++) {
            if (isContentPixel(x, y)) {
              count++;
              if (count >= rowContentThreshold) break;
            }
          }
          if (count >= rowContentThreshold) {
            // Tek piksellik gürültüleri engellemek için sonraki satırı doğrula
            if (y + 1 < h) {
              let nextCount = 0;
              for (let x = 0; x < w; x++) {
                if (isContentPixel(x, y + 1)) {
                  nextCount++;
                  if (nextCount >= rowContentThreshold) break;
                }
              }
              if (nextCount >= rowContentThreshold) {
                top = y;
                break;
              }
            } else {
              top = y;
              break;
            }
          }
        }

        // Alt kenar tespiti (aşağıdan yukarıya)
        for (let y = h - 1; y >= (top !== -1 ? top : 0); y--) {
          let count = 0;
          for (let x = 0; x < w; x++) {
            if (isContentPixel(x, y)) {
              count++;
              if (count >= rowContentThreshold) break;
            }
          }
          if (count >= rowContentThreshold) {
            if (y - 1 >= 0) {
              let prevCount = 0;
              for (let x = 0; x < w; x++) {
                if (isContentPixel(x, y - 1)) {
                  prevCount++;
                  if (prevCount >= rowContentThreshold) break;
                }
              }
              if (prevCount >= rowContentThreshold) {
                bottom = y;
                break;
              }
            } else {
              bottom = y;
              break;
            }
          }
        }

        if (top === -1 || bottom === -1 || bottom <= top) {
          resolve(imageSrc);
          return;
        }

        // 3. Sol ve sağ sınırları (sütun bazlı) tara
        const colHeight = bottom - top + 1;
        const colContentThreshold = Math.max(10, Math.floor(colHeight * 0.035));

        let left = -1;
        let right = -1;

        // Sol kenar tespiti (soldan sağa)
        for (let x = 0; x < w; x++) {
          let count = 0;
          for (let y = top; y <= bottom; y++) {
            if (isContentPixel(x, y)) {
              count++;
              if (count >= colContentThreshold) break;
            }
          }
          if (count >= colContentThreshold) {
            if (x + 1 < w) {
              let nextCount = 0;
              for (let y = top; y <= bottom; y++) {
                if (isContentPixel(x + 1, y)) {
                  nextCount++;
                  if (nextCount >= colContentThreshold) break;
                }
              }
              if (nextCount >= colContentThreshold) {
                left = x;
                break;
              }
            } else {
              left = x;
              break;
            }
          }
        }

        // Sağ kenar tespiti (sağdan sola)
        for (let x = w - 1; x >= (left !== -1 ? left : 0); x--) {
          let count = 0;
          for (let y = top; y <= bottom; y++) {
            if (isContentPixel(x, y)) {
              count++;
              if (count >= colContentThreshold) break;
            }
          }
          if (count >= colContentThreshold) {
            if (x - 1 >= 0) {
              let prevCount = 0;
              for (let y = top; y <= bottom; y++) {
                if (isContentPixel(x - 1, y)) {
                  prevCount++;
                  if (prevCount >= colContentThreshold) break;
                }
              }
              if (prevCount >= colContentThreshold) {
                right = x;
                break;
              }
            } else {
              right = x;
              break;
            }
          }
        }

        if (left === -1 || right === -1 || right <= left) {
          resolve(imageSrc);
          return;
        }

        // 4. Boşluk yüzdesi kontrolü
        const topMarginPct = top / h;
        const bottomMarginPct = (h - 1 - bottom) / h;
        const leftMarginPct = left / w;
        const rightMarginPct = (w - 1 - right) / w;

        // Eğer üstte veya altta (veya kenarlarda) belirgin boşluk yoksa (%2.5'ten az) zaten kırpılmıştır
        const hasSignificantTopBottom = topMarginPct > 0.025 || bottomMarginPct > 0.025;
        const hasSignificantSides = leftMarginPct > 0.025 || rightMarginPct > 0.025;

        if (!hasSignificantTopBottom && !hasSignificantSides) {
          resolve(imageSrc);
          return;
        }

        // Tespit edilen alan kimlik olamayacak kadar küçükse (gürültü vs.) kırpma
        const detectedW = right - left;
        const detectedH = bottom - top;
        if (detectedW < w * 0.12 || detectedH < h * 0.1) {
          resolve(imageSrc);
          return;
        }

        // 5. Güvenlik payı (padding: ~%1.8 - 2): Kimliğin yuvarlak köşeleri ve kenar yazıları kesilmesin
        const padX = Math.round(detectedW * 0.018);
        const padY = Math.round(detectedH * 0.018);

        const safeTop = topMarginPct > 0.025 ? Math.max(0, top - padY) : 0;
        const safeBottom = bottomMarginPct > 0.025 ? Math.min(h - 1, bottom + padY) : h - 1;
        const safeLeft = leftMarginPct > 0.025 ? Math.max(0, left - padX) : 0;
        const safeRight = rightMarginPct > 0.025 ? Math.min(w - 1, right + padX) : w - 1;

        // 6. Orijinal yüksek çözünürlüklü koordinatlara eşle ve kırp
        const scaleX = origW / w;
        const scaleY = origH / h;

        const origCropX = Math.max(0, Math.floor(safeLeft * scaleX));
        const origCropY = Math.max(0, Math.floor(safeTop * scaleY));
        const origCropW = Math.min(origW - origCropX, Math.ceil((safeRight - safeLeft + 1) * scaleX));
        const origCropH = Math.min(origH - origCropY, Math.ceil((safeBottom - safeTop + 1) * scaleY));

        if (origCropW <= 50 || origCropH <= 50) {
          resolve(imageSrc);
          return;
        }

        const cropCanvas = document.createElement("canvas");
        cropCanvas.width = origCropW;
        cropCanvas.height = origCropH;
        const cropCtx = cropCanvas.getContext("2d");
        if (!cropCtx) {
          resolve(imageSrc);
          return;
        }

        cropCtx.drawImage(
          img,
          origCropX,
          origCropY,
          origCropW,
          origCropH,
          0,
          0,
          origCropW,
          origCropH
        );

        const mime = imageSrc.startsWith("data:image/png") ? "image/png" : "image/jpeg";
        const resultBase64 = cropCanvas.toDataURL(mime, 0.94);
        resolve(resultBase64);
      } catch (err) {
        console.warn("Otomatik kimlik kırpma atlandı:", err);
        resolve(imageSrc);
      }
    };

    img.onerror = () => {
      resolve(imageSrc);
    };

    img.src = imageSrc;
  });
}
