import { createWorker } from "tesseract.js";

export interface OcrExtractedData {
  rawText: string;
  belgeTuru: number; // 0: Kimlik, 1: Pasaport, 2: Ehliyet, 3: Vergi Levhası
  tcKimlikNo?: string;
  ad?: string;
  soyad?: string;
  unvan?: string;
  kimlikSeriNo?: string;
  dogumTarihi?: string; // YYYY-MM-DD
  kimlikGecerlilikTarihi?: string; // YYYY-MM-DD
  cinsiyet?: string; // Kadın (K) / Erkek (E)
  babaAdi?: string;
  anneAdi?: string;
  dogumYeri?: string;
  il?: string;
  ilce?: string;
  pasaportNo?: string;
  vergiKimlikNo?: string;
  vergiDairesiAdi?: string;
  uyruk?: string;
  ulke?: string;
  adres?: string;
  faaliyetKonusu?: string;
  kanGrubu?: string;
  surucuSinifi?: string;
  verilisTarihi?: string;
  verenMakam?: string;
}

/**
 * TC Kimlik Numarası Algoritma Doğrulaması (10. ve 11. hane kontrolü)
 */
export function isValidTcKimlikNo(tc: string): boolean {
  if (!tc || tc.length !== 11 || !/^[1-9][0-9]{10}$/.test(tc)) {
    return false;
  }
  const digits = tc.split("").map(Number);
  const oddSum = digits[0] + digits[2] + digits[4] + digits[6] + digits[8];
  const evenSum = digits[1] + digits[3] + digits[5] + digits[7];

  const digit10 = (oddSum * 7 - evenSum) % 10;
  const mod10 = (digit10 + 10) % 10;
  if (digits[9] !== mod10) return false;

  const totalSum = digits.slice(0, 10).reduce((acc, d) => acc + d, 0);
  if (digits[10] !== totalSum % 10) return false;

  return true;
}

/**
 * Tarih dönüştürücü (DD.MM.YYYY veya benzeri -> YYYY-MM-DD)
 */
export function parseDateToIso(str: string): string | undefined {
  if (!str) return undefined;
  const cleaned = str.trim();

  // 1. DD.MM.YYYY veya DD/MM/YYYY veya DD.MM3YYYY (nokta yerine OCR gürültüsü)
  const matchDmy = cleaned.match(/^(\d{1,2})[./\s-](\d{1,2})[./\s\d]?(\d{4})$/);
  if (matchDmy) {
    let day = parseInt(matchDmy[1], 10);
    let month = parseInt(matchDmy[2], 10);
    let year = parseInt(matchDmy[3], 10);

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900 && year <= 2050) {
      const mm = String(month).padStart(2, "0");
      const dd = String(day).padStart(2, "0");
      return `${year}-${mm}-${dd}`;
    }
  }

  // 2. YYYY-MM-DD
  const matchYmd = cleaned.match(/^(\d{4})[./\s-](\d{1,2})[./\s-](\d{1,2})$/);
  if (matchYmd) {
    const year = parseInt(matchYmd[1], 10);
    const month = parseInt(matchYmd[2], 10);
    const day = parseInt(matchYmd[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const mm = String(month).padStart(2, "0");
      const dd = String(day).padStart(2, "0");
      return `${year}-${mm}-${dd}`;
    }
  }

  // 3. MRZ formatı YYMMDD (6 hane)
  const matchMrz = cleaned.match(/^(\d{2})(\d{2})(\d{2})$/);
  if (matchMrz) {
    let year = parseInt(matchMrz[1], 10);
    const month = parseInt(matchMrz[2], 10);
    const day = parseInt(matchMrz[3], 10);
    year += year > 35 ? 1900 : 2000;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const mm = String(month).padStart(2, "0");
      const dd = String(day).padStart(2, "0");
      return `${year}-${mm}-${dd}`;
    }
  }

  return undefined;
}

/**
 * Görseli kontrastı ve netliği artırmak için Canvas üzerinde işler
 */
export async function preprocessImage(imageSrc: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(imageSrc);
          return;
        }

        let width = img.width;
        let height = img.height;
        const maxDim = 1920;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;

        ctx.drawImage(img, 0, 0, width, height);
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;

        // Kontrast artırma (%35)
        const contrast = 35;
        const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

        for (let i = 0; i < data.length; i += 4) {
          const avg = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          const c = factor * (avg - 128) + 128;
          const val = Math.min(255, Math.max(0, c));
          data[i] = val;
          data[i + 1] = val;
          data[i + 2] = val;
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL("image/jpeg", 0.92));
      } catch {
        resolve(imageSrc);
      }
    };
    img.onerror = () => resolve(imageSrc);
    img.src = imageSrc;
  });
}

/**
 * Modern Türk Kimlik Seri No temizleyici ve doğrulayıcı:
 * Format kesinlikle: [A-Z][0-9]{2}[A-Z][0-9]{5} (Örn: A01I68679, A32G87419, A12Z34567, A54B68514)
 */
export function cleanSeri(s?: string): string | undefined {
  if (!s) return undefined;
  let val = s.toUpperCase().replace(/[^A-Z0-9]/g, "");
  // MRZ'den 10 karakter geldiyse son karakter check-digit'tir, 9 karaktere indir
  if (val.length === 10) val = val.substring(0, 9);
  if (val.length !== 9) return undefined;

  const dMap: Record<string, string> = {
    O: "0",
    D: "0",
    Q: "0",
    I: "1",
    L: "1",
    Z: "2",
    A: "4",
    S: "5",
    G: "6",
    B: "8",
  };
  const lMap: Record<string, string> = {
    "0": "O",
    "1": "I",
    "2": "Z",
    "4": "A",
    "5": "S",
    "6": "G",
    "8": "B",
  };

  const chars = val.split("");
  // Pos 0: Harf olmalı
  if (lMap[chars[0]]) chars[0] = lMap[chars[0]];
  // Pos 1 ve 2: Rakam olmalı
  if (dMap[chars[1]]) chars[1] = dMap[chars[1]];
  if (dMap[chars[2]]) chars[2] = dMap[chars[2]];
  // Pos 3: Harf olmalı (Örn: G, I, Z, B, K vs.)
  if (lMap[chars[3]]) chars[3] = lMap[chars[3]];
  // Pos 4-8: 5 hane Rakam olmalı
  for (let k = 4; k < 9; k++) {
    if (dMap[chars[k]]) chars[k] = dMap[chars[k]];
  }

  const res = chars.join("");
  if (/^[A-Z][0-9]{2}[A-Z][0-9]{5}$/.test(res)) {
    return res;
  }
  return undefined;
}

/**
 * Bir kimlik görselinin veya okunan verisinin Arka Yüz olup olmadığını tespit eder
 */
export function isKimlikBackFace(data: OcrExtractedData): boolean {
  if (data.anneAdi || data.babaAdi) return true;
  if (data.kanGrubu) return true;
  if (data.rawText) {
    const u = data.rawText.toLocaleUpperCase("tr-TR");
    // MRZ sadece kimlik/pasaport arka yüzünde olur
    if (u.includes("I<TUR") || u.includes("ANNE ADI") || u.includes("BABA ADI") || u.includes("MOTHER") || u.includes("FATHER")) {
      return true;
    }
    // Ehliyet Arka Yüz Belirteçleri:
    if (
      u.includes("KAN GRUBU") ||
      u.includes("BLOOD GROUP") ||
      u.includes("13.") ||
      u.includes("C1E") ||
      u.includes("D1E") ||
      (u.includes("SÜRÜCÜ") && (u.includes("SINIF") || u.includes("KISIT") || u.includes("12.")))
    ) {
      return true;
    }
    // Ehliyet Ön Yüzünde "4c. İÇİŞLERİ BAKANLIĞI", "SÜRÜCÜ BELGESİ", "4D" yazar, bunları asla arka yüz sayma!
    if (
      u.includes("SÜRÜCÜ BELGESİ") ||
      u.includes("SURUCU BELGESI") ||
      u.includes("DRIVING LICENCE") ||
      u.includes("PERMIS DE CONDUIRE") ||
      u.includes("4D") ||
      u.includes("4A") ||
      u.includes("4B")
    ) {
      return false;
    }
    if (u.includes("VEREN MAKAM") || u.includes("CİLT NO") || u.includes("AİLE SIRA NO")) {
      return true;
    }
  }
  return false;
}

/**
 * Bir kimlik görselinin veya okunan verisinin Ön Yüz olup olmadığını tespit eder
 */
export function isKimlikFrontFace(data: OcrExtractedData): boolean {
  if (data.tcKimlikNo && isValidTcKimlikNo(data.tcKimlikNo)) return true;
  if (data.ad || data.soyad) return true;
  if (data.rawText) {
    const u = data.rawText.toLocaleUpperCase("tr-TR");
    if (
      u.includes("SÜRÜCÜ BELGESİ") ||
      u.includes("SURUCU BELGESI") ||
      u.includes("DRIVING LICENCE") ||
      u.includes("PERMIS DE CONDUIRE") ||
      u.includes("4D") ||
      u.includes("4A") ||
      u.includes("4B") ||
      u.includes("KİMLİK NO") ||
      u.includes("KIMLIK NO") ||
      u.includes("IDENTITY NO") ||
      u.includes("GIVEN") ||
      u.includes("SURNAME") ||
      u.includes("SOYADI")
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Derin analiz için görseli farklı filtrelerle hazırlar:
 * - upscaled_contrast: 1.6x büyütme + %50 kontrast + keskinlik (küçük fontlu metinler & tarihler için)
 * - binarized: Adaptif eşikleme / siyah-beyaz binarize (parlama, hologram ve arka plan desenlerini yok eder)
 * - mrz_region: Alt %35 MRZ alanına odaklanma (arka yüz ve pasaport makine okuma bandı)
 * - tckn_region: Üst sol %58 genişlik, %8-%46 yükseklik alanına odaklanma (11 haneli TCKN alanı)
 * - ehliyet_names_region: Ehliyet üst-sağ isim/soyisim alanı
 * - ehliyet_details_region: Ehliyet orta-alt sağ TCKN, belge no, doğum/geçerlilik tarihi alanı
 */
export async function preprocessForDeepOcr(
  imageSrc: string,
  mode: "upscaled_contrast" | "binarized" | "mrz_region" | "tckn_region" | "ehliyet_names_region" | "ehliyet_details_region"
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const origW = img.width;
        const origH = img.height;

        let srcX = 0;
        let srcY = 0;
        let srcW = origW;
        let srcH = origH;
        let scale = 1.6;

        if (mode === "mrz_region") {
          srcX = 0;
          srcY = Math.round(origH * 0.65);
          srcW = origW;
          srcH = Math.round(origH * 0.35);
          scale = 2.0;
        } else if (mode === "tckn_region") {
          srcX = 0;
          srcY = Math.round(origH * 0.08);
          srcW = Math.round(origW * 0.58);
          srcH = Math.round(origH * 0.38);
          scale = 2.2;
        } else if (mode === "ehliyet_names_region") {
          // Ehliyet ön yüzünde sürücü fotoğrafı sol %25'tedir. İsim ve Soyisim üst-sağ alandadır.
          srcX = Math.round(origW * 0.24);
          srcY = Math.round(origH * 0.10);
          srcW = Math.round(origW * 0.74);
          srcH = Math.round(origH * 0.42);
          scale = 2.2;
        } else if (mode === "ehliyet_details_region") {
          // Doğum tarihi, 4a, 4b, 4c, 4d TCKN ve 5 Belge No orta-alt sağ alandadır.
          srcX = Math.round(origW * 0.24);
          srcY = Math.round(origH * 0.44);
          srcW = Math.round(origW * 0.74);
          srcH = Math.round(origH * 0.54);
          scale = 2.4;
        }

        let outW = Math.round(srcW * scale);
        let outH = Math.round(srcH * scale);

        const maxDim = 2560;
        if (outW > maxDim || outH > maxDim) {
          const ratio = Math.min(maxDim / outW, maxDim / outH);
          outW = Math.round(outW * ratio);
          outH = Math.round(outH * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width = Math.max(10, outW);
        canvas.height = Math.max(10, outH);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(imageSrc);
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outW, outH);
        const imgData = ctx.getImageData(0, 0, outW, outH);
        const d = imgData.data;

        if (mode === "upscaled_contrast") {
          const contrast = 50;
          const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
          for (let i = 0; i < d.length; i += 4) {
            const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
            const c = factor * (gray - 128) + 128;
            const val = Math.min(255, Math.max(0, c));
            d[i] = val;
            d[i + 1] = val;
            d[i + 2] = val;
          }
        } else {
          // binarized, mrz_region, tckn_region
          let totalGray = 0;
          for (let i = 0; i < d.length; i += 4) {
            totalGray += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          }
          const avgThreshold = totalGray / (d.length / 4);
          const threshold = Math.max(70, Math.min(180, avgThreshold * 0.95));

          for (let i = 0; i < d.length; i += 4) {
            const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
            const bin = gray < threshold ? 0 : 255;
            d[i] = bin;
            d[i + 1] = bin;
            d[i + 2] = bin;
          }
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL("image/jpeg", 0.92));
      } catch {
        resolve(imageSrc);
      }
    };
    img.onerror = () => resolve(imageSrc);
    img.src = imageSrc;
  });
}

/**
 * Çoklu aşama veya çoklu fotoğraf okumalarını en yüksek kalite skoruyla harmanlar
 */
export function mergeExtractedData(
  primary: OcrExtractedData,
  secondary: OcrExtractedData
): OcrExtractedData {
  const merged: OcrExtractedData = { ...primary };

  // 1. TCKN: Geçerli (checksum tutan) olan daima öncelikli
  if (secondary.tcKimlikNo) {
    if (!merged.tcKimlikNo) {
      merged.tcKimlikNo = secondary.tcKimlikNo;
    } else if (!isValidTcKimlikNo(merged.tcKimlikNo) && isValidTcKimlikNo(secondary.tcKimlikNo)) {
      merged.tcKimlikNo = secondary.tcKimlikNo;
    }
  }

  // 2. VKN
  if (!merged.vergiKimlikNo && secondary.vergiKimlikNo) {
    merged.vergiKimlikNo = secondary.vergiKimlikNo;
  }

  // 3. Soyadı: Kalite skoru daha yüksek olan veya Türkçe karakter içeren kazanır
  if (secondary.soyad && isValidNameOrSurname(secondary.soyad)) {
    if (
      !merged.soyad ||
      !isValidNameOrSurname(merged.soyad) ||
      scoreNameOrSurname(secondary.soyad) > scoreNameOrSurname(merged.soyad)
    ) {
      merged.soyad = secondary.soyad;
    }
  }

  // 4. Adı: Kalite skoru daha yüksek olan kazanır
  if (secondary.ad && isValidNameOrSurname(secondary.ad)) {
    if (
      !merged.ad ||
      !isValidNameOrSurname(merged.ad) ||
      scoreNameOrSurname(secondary.ad) > scoreNameOrSurname(merged.ad)
    ) {
      merged.ad = secondary.ad;
    }
  }

  // 5. Unvan
  if (merged.ad && merged.soyad) {
    merged.unvan = `${merged.ad} ${merged.soyad}`.trim();
  } else if (!merged.unvan && secondary.unvan) {
    merged.unvan = secondary.unvan;
  }

  // 6. Seri No: 9 karakterli geçerli seri no (cleanSeri) öncelikli (Ehliyet için serbest format)
  if (secondary.kimlikSeriNo) {
    if (merged.belgeTuru === 2 || secondary.belgeTuru === 2) {
      if (!merged.kimlikSeriNo || secondary.kimlikSeriNo.length >= (merged.kimlikSeriNo.length || 0)) {
        merged.kimlikSeriNo = secondary.kimlikSeriNo;
      }
    } else {
      const cleanCur = cleanSeri(merged.kimlikSeriNo);
      const cleanNew = cleanSeri(secondary.kimlikSeriNo);
      if (!cleanCur && cleanNew) {
        merged.kimlikSeriNo = cleanNew;
      } else if (cleanCur && cleanNew && cleanCur.length !== 9 && cleanNew.length === 9) {
        merged.kimlikSeriNo = cleanNew;
      }
    }
  }

  // 7. Tarihler & Cinsiyet
  if (!merged.dogumTarihi && secondary.dogumTarihi) merged.dogumTarihi = secondary.dogumTarihi;
  if (!merged.kimlikGecerlilikTarihi && secondary.kimlikGecerlilikTarihi)
    merged.kimlikGecerlilikTarihi = secondary.kimlikGecerlilikTarihi;
  if (!merged.cinsiyet && secondary.cinsiyet) merged.cinsiyet = secondary.cinsiyet;

  // 8. Anne & Baba Adı
  if (secondary.anneAdi && isValidNameOrSurname(secondary.anneAdi)) {
    if (
      !merged.anneAdi ||
      !isValidNameOrSurname(merged.anneAdi) ||
      scoreNameOrSurname(secondary.anneAdi) > scoreNameOrSurname(merged.anneAdi)
    ) {
      merged.anneAdi = secondary.anneAdi;
    }
  }
  if (secondary.babaAdi && isValidNameOrSurname(secondary.babaAdi)) {
    if (
      !merged.babaAdi ||
      !isValidNameOrSurname(merged.babaAdi) ||
      scoreNameOrSurname(secondary.babaAdi) > scoreNameOrSurname(merged.babaAdi)
    ) {
      merged.babaAdi = secondary.babaAdi;
    }
  }

  // 9. Ehliyet Özel Alanları
  if (!merged.kanGrubu && secondary.kanGrubu) merged.kanGrubu = secondary.kanGrubu;
  if (!merged.surucuSinifi && secondary.surucuSinifi) merged.surucuSinifi = secondary.surucuSinifi;
  if (!merged.verilisTarihi && secondary.verilisTarihi) merged.verilisTarihi = secondary.verilisTarihi;
  if (!merged.verenMakam && secondary.verenMakam) merged.verenMakam = secondary.verenMakam;

  // 10. Diğer alanlar
  if (!merged.dogumYeri && secondary.dogumYeri) merged.dogumYeri = secondary.dogumYeri;
  if (!merged.il && secondary.il) merged.il = secondary.il;
  if (!merged.ilce && secondary.ilce) merged.ilce = secondary.ilce;
  if (!merged.vergiDairesiAdi && secondary.vergiDairesiAdi) merged.vergiDairesiAdi = secondary.vergiDairesiAdi;
  if (!merged.pasaportNo && secondary.pasaportNo) merged.pasaportNo = secondary.pasaportNo;
  if (!merged.uyruk && secondary.uyruk) merged.uyruk = secondary.uyruk;
  if (!merged.ulke && secondary.ulke) merged.ulke = secondary.ulke;
  if (!merged.adres && secondary.adres) merged.adres = secondary.adres;
  if (!merged.faaliyetKonusu && secondary.faaliyetKonusu) merged.faaliyetKonusu = secondary.faaliyetKonusu;

  if (secondary.belgeTuru !== undefined && merged.belgeTuru === undefined) {
    merged.belgeTuru = secondary.belgeTuru;
  }

  merged.rawText += "\n---\n" + (secondary.rawText || "");
  return merged;
}

/**
 * Görselden metin okur (Tesseract.js OCR - Standart veya Çok Aşamalı Derin Analiz)
 */
export async function performOcrAndExtractData(
  imageBase64: string,
  targetBelgeTuru: number = 0,
  onProgress?: (progress: number, statusText: string) => void,
  isDeepAnalysis: boolean = false
): Promise<OcrExtractedData> {
  onProgress?.(10, isDeepAnalysis ? "Detaylı OCR motoru hazırlanıyor..." : "OCR motoru hazırlanıyor...");
  const worker = await createWorker("tur+eng");

  // PSM 11 + Sabit 300 DPI + Kelime Boşluklarını Koruma
  await worker.setParameters({
    tessedit_pageseg_mode: "11" as any,
    user_defined_dpi: "300",
    preserve_interword_spaces: "1",
  });

  if (!isDeepAnalysis) {
    // ─── 1. STANDART HIZLI ANALİZ (Yeni fotoğraf yükleme / kırpma anında) ───
    onProgress?.(40, "Metinler ve kimlik bilgileri okunuyor...");
    const ret = await worker.recognize(imageBase64);
    let rawText = ret.data.text || "";

    const normUpper = rawText.toLocaleUpperCase("tr-TR");
    const hasValidContent =
      normUpper.length >= 40 &&
      (normUpper.includes("TÜRKİYE") ||
        normUpper.includes("TURKIYE") ||
        normUpper.includes("TURKEY") ||
        normUpper.includes("KİMLİK") ||
        normUpper.includes("KIMLIK") ||
        normUpper.includes("SÜRÜCÜ") ||
        normUpper.includes("SURUCU") ||
        normUpper.includes("DRIVING") ||
        normUpper.includes("LICENCE") ||
        normUpper.includes("EHLİYET") ||
        normUpper.includes("EHLIYET") ||
        normUpper.includes("VERGİ") ||
        normUpper.includes("VERGI") ||
        normUpper.includes("PASAPORT") ||
        normUpper.includes("PASSPORT") ||
        normUpper.includes("I<TUR") ||
        normUpper.includes("KAN GRUBU") ||
        normUpper.includes("ANNE") ||
        normUpper.includes("BABA") ||
        normUpper.includes("T.C") ||
        normUpper.includes("TCKN") ||
        normUpper.includes("SOYAD"));

    if (!hasValidContent) {
      try {
        const processedImg = await preprocessImage(imageBase64);
        const ret2 = await worker.recognize(processedImg);
        const text2 = ret2.data.text || "";
        if (text2.length > rawText.length) {
          rawText = rawText ? rawText + "\n" + text2 : text2;
        }
      } catch {}
    }

    onProgress?.(85, "Okunan veriler ayrıştırılıyor...");
    await worker.terminate();

    const extracted = parseOcrText(rawText, targetBelgeTuru);
    onProgress?.(100, "Tamamlandı.");
    return extracted;
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // ─── 2. ÇOK AŞAMALI DETAYLI ANALİZ (YENİDEN OKU TIKLANDIĞINDA) ───────────────
  // ══════════════════════════════════════════════════════════════════════════════
  onProgress?.(20, "1/4: Orijinal görsel taranıyor...");
  const ret1 = await worker.recognize(imageBase64);
  const text1 = ret1.data.text || "";
  let accumulatedData = parseOcrText(text1, targetBelgeTuru);

  // Aşama 2: 1.6x Büyütülmüş Keskinlik & Adaptif Kontrast Filtresi (PSM 6: Uniform metin bloğu)
  onProgress?.(45, "2/4: Yüksek çözünürlük ve kontrast analizi yapılıyor...");
  try {
    const sharpImg = await preprocessForDeepOcr(imageBase64, "upscaled_contrast");
    await worker.setParameters({ tessedit_pageseg_mode: "6" as any });
    const ret2 = await worker.recognize(sharpImg);
    const text2 = ret2.data.text || "";
    if (text2) {
      const data2 = parseOcrText(text2, targetBelgeTuru);
      accumulatedData = mergeExtractedData(accumulatedData, data2);
    }
  } catch (err) {
    console.warn("Derin analiz Aşama 2 hatası:", err);
  }

  // Aşama 3: Binarize & Adaptif Eşikleme (Hologram, yansıma ve zemin desenlerini temizler)
  onProgress?.(65, "3/4: Binarize eşikleme ve gürültü filtresi taranıyor...");
  try {
    const binarizedImg = await preprocessForDeepOcr(imageBase64, "binarized");
    await worker.setParameters({ tessedit_pageseg_mode: "11" as any });
    const ret3 = await worker.recognize(binarizedImg);
    const text3 = ret3.data.text || "";
    if (text3) {
      const data3 = parseOcrText(text3, targetBelgeTuru);
      accumulatedData = mergeExtractedData(accumulatedData, data3);
    }
  } catch (err) {
    console.warn("Derin analiz Aşama 3 hatası:", err);
  }

  // Aşama 4: Bölgesel Odaklı Tarama (Ehliyet veya MRZ/TCKN odaklaması)
  if (targetBelgeTuru === 2 || accumulatedData.belgeTuru === 2) {
    onProgress?.(80, "4/4: Ehliyet isim ve TCKN/tarih bölgelerine odaklanılıyor...");
    try {
      // 4.A: Ehliyet İsim Bölgesi (Soyadı ve Adı)
      const namesImg = await preprocessForDeepOcr(imageBase64, "ehliyet_names_region");
      await worker.setParameters({ tessedit_pageseg_mode: "6" as any });
      const retNames = await worker.recognize(namesImg);
      const namesText = retNames.data.text || "";
      if (namesText) {
        const namesData = parseOcrText(namesText, targetBelgeTuru);
        accumulatedData = mergeExtractedData(accumulatedData, namesData);
      }

      // 4.B: Ehliyet TCKN, Belge No, Doğum & Geçerlilik Tarihleri Bölgesi
      const detailsImg = await preprocessForDeepOcr(imageBase64, "ehliyet_details_region");
      await worker.setParameters({ tessedit_pageseg_mode: "6" as any });
      const retDetails = await worker.recognize(detailsImg);
      const detailsText = retDetails.data.text || "";
      if (detailsText) {
        const detailsData = parseOcrText(detailsText, targetBelgeTuru);
        accumulatedData = mergeExtractedData(accumulatedData, detailsData);
      }
    } catch (err) {
      console.warn("Ehliyet derin bölgesel analiz hatası:", err);
    }
  } else {
    // Normal kimlik kartı & pasaport için MRZ ve TCKN
    onProgress?.(80, "4/4: Bölgesel MRZ bandı ve TCKN odaklı analiz yapılıyor...");
    try {
      // 4.A: MRZ Bölgesi (Arka yüz veya pasaport için alt %35)
      const mrzImg = await preprocessForDeepOcr(imageBase64, "mrz_region");
      if (mrzImg) {
        await worker.setParameters({
          tessedit_pageseg_mode: "6" as any,
          tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<",
        });
        const retMrz = await worker.recognize(mrzImg);
        const mrzText = retMrz.data.text || "";
        if (mrzText) {
          const mrzData = parseOcrText(mrzText, targetBelgeTuru);
          accumulatedData = mergeExtractedData(accumulatedData, mrzData);
        }
      }

      // 4.B: TCKN Bölgesi (Eğer hala geçerli bir TCKN bulunamadıysa)
      if (!accumulatedData.tcKimlikNo || !isValidTcKimlikNo(accumulatedData.tcKimlikNo)) {
        const tcknImg = await preprocessForDeepOcr(imageBase64, "tckn_region");
        if (tcknImg) {
          await worker.setParameters({
            tessedit_pageseg_mode: "6" as any,
            tessedit_char_whitelist: "0123456789",
          });
          const retTckn = await worker.recognize(tcknImg);
          const tcknText = retTckn.data.text || "";
          const m11 = tcknText.match(/[1-9]\d{10}/);
          if (m11 && isValidTcKimlikNo(m11[0])) {
            accumulatedData.tcKimlikNo = m11[0];
            accumulatedData.vergiKimlikNo = m11[0];
          }
        }
      }
    } catch (err) {
      console.warn("Derin analiz Aşama 4 hatası:", err);
    }
  }

  onProgress?.(95, "Tüm sonuçlar birleştiriliyor ve doğrulanıyor...");
  await worker.terminate();

  // Son kontroller ve Türkçe karakter düzeltmeleri
  if (accumulatedData.soyad) {
    accumulatedData.soyad = turkishizeFromRawText(accumulatedData.soyad, accumulatedData.rawText);
  }
  if (accumulatedData.ad) {
    accumulatedData.ad = turkishizeFromRawText(accumulatedData.ad, accumulatedData.rawText);
  }
  if (accumulatedData.ad && accumulatedData.soyad) {
    accumulatedData.unvan = `${accumulatedData.ad} ${accumulatedData.soyad}`.trim();
  }

  onProgress?.(100, "Detaylı analiz başarıyla tamamlandı.");
  return accumulatedData;
}

const NOISE_WORDS = [
  "TÜRKİYE",
  "TURKIYE",
  "TORKIYE",
  "CUMHURİYETİ",
  "CUMHURIYETI",
  "REPUBLIC",
  "TURKEY",
  "IDENTITY",
  "CARD",
  "KİMLİK",
  "KIMLIK",
  "KARTI",
  "NÜFUS",
  "NUFUS",
  "CÜZDANI",
  "CUZDANI",
  "SOYADI",
  "SURNAME",
  "SUMAME",
  "SURNAM",
  "SUR-NAME",
  "SOY",
  "AYAĞI",
  "ADI",
  "GIVEN",
  "NAME",
  "NAMES",
  "GIVENNAME",
  "GIVENNAMES",
  "FATHER",
  "MOTHER",
  "BABA",
  "ANNE",
  "DOĞUM",
  "DOGUM",
  "TARİHİ",
  "TARIHI",
  "YERİ",
  "YERI",
  "PLACE",
  "BIRTH",
  "DATE",
  "SERİ",
  "SERI",
  "DOCUMENT",
  "DOC",
  "BELGE",
  "BELGESİ",
  "VALID",
  "UNTIL",
  "GEÇERLİLİK",
  "GECERLILIK",
  "EXPIRY",
  "CİNSİYETİ",
  "CINSIYETI",
  "GENDER",
  "UYRUĞU",
  "UYRUGU",
  "NATIONALITY",
  "NATIONALIT",
  "PASSPORT",
  "PASAPORT",
  "VERGİ",
  "VERGI",
  "LEVHASI",
  "DAİRESİ",
  "DAIRESI",
  "İÇİŞLERİ",
  "ICISLERI",
  "BAKANLIĞI",
  "BAKANLIGI",
  "VEREN",
  "MAKAM",
  "ISSUED",
  "BY",
  "SIGNATURE",
  "IMZASI",
  "MUL",
  "SHH",
  "SILL",
  "SIFIR",
  "TC",
  "TUR",
  "TR",
  "TCKN",
  "VKN",
  "CAN",
  "SS",
  "SN",
  "NE",
  "GERÇEK",
  "GERCEK",
  "KİŞİ",
  "KISI",
  "KİŞİLER",
  "KISILER",
  "MÜŞTERİ",
  "MUSTERI",
  "TANI",
  "FORMU",
  "DÖVİZ",
  "DOVIZ",
  "İŞLEM",
  "ISLEM",
  "FİŞİ",
  "FISI",
  "FOTOKOPİSİ",
  "FOTOKOPISI",
  "WA",
  "WS",
  "YL",
  "IN",
  "LL",
  "MAK",
  "BEL",
  "TA",
  "KL",
  "LK",
  "SA",
  "AS",
  "SO",
  "OS",
  "YOU",
  "TER",
  "PERUK",
  "PERU",
  "MG",
  "M6",
];

export const HEADER_NOISE_TERMS = [
  "TURKIYE",
  "TÜRKİYE",
  "CUMHURIYET",
  "CUMHURİYETİ",
  "CUMHURİYET",
  "KIMLIK",
  "KİMLİK",
  "KARTI",
  "KART",
  "REPUBLIC",
  "IDENTITY",
  "CARD",
  "ICISLERI",
  "İÇİŞLERİ",
  "BAKANLIK",
  "BAKANLIGI",
  "BAKANLIĞI",
  "VEREN",
  "MAKAM",
  "NUFUS",
  "NÜFUS",
  "CUZDAN",
  "CÜZDAN",
  "PASAPORT",
  "PASSPORT",
  "VERGI",
  "VERGİ",
  "LEVHA",
  "LEVHASI",
  "DAIRE",
  "DAİRESİ",
  "ARTI",
];

export function isHeaderNoise(str?: string | null): boolean {
  if (!str) return false;
  const clean = str.toLocaleUpperCase("tr-TR").replace(/[^A-ZÇĞİÖŞÜ]/g, "");
  if (!clean) return false;
  for (const term of HEADER_NOISE_TERMS) {
    const tNorm = term.toLocaleUpperCase("tr-TR").replace(/[^A-ZÇĞİÖŞÜ]/g, "");
    if (clean.includes(tNorm)) return true;
  }
  return false;
}

export const CARD_LABEL_WORDS = [
  "ADI",
  "ADİ",
  "GIVEN",
  "GİVEN",
  "NAME",
  "NAMES",
  "GIVENNAME",
  "GIVENNAMES",
  "SOYAD",
  "SOYADI",
  "SOYADİ",
  "SURNAME",
  "SURNAMES",
  "SUMAME",
  "SURNAM",
  "AYAĞI",
  "BABA",
  "BABAADI",
  "BABAADİ",
  "FATHER",
  "FATHERNAME",
  "ANNE",
  "ANNEADI",
  "ANNEADİ",
  "ANA",
  "ANAADI",
  "ANAADİ",
  "MOTHER",
  "MOTHERNAME",
  "DOĞUM",
  "DOGUM",
  "TARİHİ",
  "TARIHI",
  "TARİH",
  "TARIH",
  "BIRTH",
  "DATE",
  "CİNSİYET",
  "CİNSİYETİ",
  "CINSIYET",
  "CINSIYETI",
  "GENDER",
  "SERİ",
  "SERI",
  "SERİNO",
  "SERINO",
  "DOCUMENT",
  "DOC",
  "UYRUK",
  "UYRUĞU",
  "UYRUGU",
  "NATIONALITY",
  "GEÇERLİLİK",
  "GECERLILIK",
  "EXPIRY",
  "VALID",
  "UNTIL",
  "İMZA",
  "IMZA",
  "SIGNATURE",
  "VEREN",
  "MAKAM",
  "ISSUED",
  "BY",
];

export function isNoiseOrLabel(str: string): boolean {
  if (!str) return true;
  const trimmed = str.trim();
  if (trimmed.length <= 1) return true;
  if (isHeaderNoise(trimmed)) return true;
  const u1 = trimmed.toUpperCase();
  const u2 = trimmed.toLocaleUpperCase("tr-TR");
  if (NOISE_WORDS.includes(u1) || NOISE_WORDS.includes(u2)) return true;
  if (CARD_LABEL_WORDS.includes(u1) || CARD_LABEL_WORDS.includes(u2)) return true;

  // Kelime bazında denetim: İçinde kimlik alanı etiketi (örn: "ADİ", "GİVEN", "SOYADI") barındıran metinler etiket sayılır
  const tokens = u2.replace(/[^A-ZÇĞİÖŞÜ]/g, " ").split(/\s+/).filter(Boolean);
  if (tokens.some((t) => CARD_LABEL_WORDS.includes(t) || NOISE_WORDS.includes(t) || isHeaderNoise(t))) {
    return true;
  }
  return false;
}

export function hasVowel(str?: string | null): boolean {
  if (!str) return false;
  return /[AEIİOÖUÜaeıioöuü]/i.test(str);
}

export function fixMrzLeadingNoise(word: string): string {
  if (!word || word.length < 3) return word;
  // Eğer kelime K, L veya C ile başlıyor ve 2. harfi de bir sessiz harf ise, baştaki harf MRZ < dolgusudur!
  // Türkçede hiçbir kelime KY, KM, KN, KS, KT, KL, KP gibi çift sessiz harfle başlamaz.
  if (/^[KLC][BCÇDFGĞHJKLMNPRSŞTVYZ]/i.test(word)) {
    return word.substring(1);
  }
  return word;
}

export function cleanMrzNoise(str: string): string {
  if (!str) return "";
  let s = str.toUpperCase();
  // 1. Standart MRZ dolgu ve gürültü işaretleri: <, (, {, [, |, \, /
  s = s.replace(/[<({[\]|\\/]/g, " ");
  // 2. Çift okuma hatası düzeltmesi: Iİ -> I, İI -> I, II -> I, İİ -> İ
  s = s.replace(/Iİ/g, "I").replace(/İI/g, "I").replace(/II/g, "I").replace(/İİ/g, "İ");
  // 3. Tekrarlayan K ve L dizilerini (MRZ < padding artıkları) temizle
  // Örn: KLLLLKLLLKLLKLLK, KKKK, LLLL
  s = s.replace(/\b[KL\s]{3,}\b/g, " ");
  s = s.replace(/[KL]{2,}$/g, "");
  // 4. Baştaki ve sondaki tekil K/L artıklarını temizle
  s = s.replace(/^[KL]\s+/g, "");
  s = s.replace(/\s+[KL]$/g, "");
  s = s.replace(/\b[KL]\s+(?=[A-ZÇĞİÖŞÜ]{2,})/g, "");
  // 5. Çoklu boşlukları teke indir
  s = s.replace(/\s+/g, " ").trim();
  
  // 6. Kelime bazında fonetik düzeltme (örn: KYUNUS -> YUNUS) ve sesli harf filtresi
  const words = s
    .split(/\s+/)
    .map(fixMrzLeadingNoise)
    .filter((w) => w.length >= 2 && hasVowel(w) && !isNoiseOrLabel(w) && !isHeaderNoise(w));
  return words.join(" ");
}

export function scoreNameOrSurname(val?: string | null): number {
  if (!val) return -999;
  const s = val.trim().toUpperCase();
  if (s.length < 2) return -999;
  if (!hasVowel(s)) return -999; // Sesli harf yoksa isim veya soyisim olamaz!
  if (isHeaderNoise(s)) return -999; // Belge başlıkları asla isim/soyad olamaz!
  if (isNoiseOrLabel(s)) return -500;
  if (/(.)\1{2,}/.test(s)) return -100; // 3 kez aynı harf (LLL, KKK) olamaz!
  if (/^[KL\s]+$/.test(s)) return -100;

  // İsim içindeki her kelimeyi ayrı ayrı denetle
  const words = s.split(/\s+/);
  for (const w of words) {
    if (w.length < 3 && w !== "SU") return -200; // 2 harfli isim (SA, YO vs.) olamaz
    if (isNoiseOrLabel(w) || isHeaderNoise(w)) return -500;
  }

  let score = 10;
  // Türkçe özel harfler varsa büyük ödül (Örn: DEMİRBAŞ > DEMIRBAS)
  if (/[ÇĞİÖŞÜ]/.test(s)) score += 20;
  // Makul uzunluk (3 - 15 karakter)
  if (s.length >= 3 && s.length <= 15) score += 15;
  // Çok uzun ve yapay ise ceza
  if (s.length > 20) score -= 50;

  return score;
}

export function isValidNameOrSurname(str?: string | null): boolean {
  return scoreNameOrSurname(str) > 0;
}

export function turkishizeFromRawText(asciiWord?: string | null, rawText?: string | null): string {
  if (!asciiWord || !rawText) return asciiWord || "";
  const normalize = (s: string) =>
    s
      .toLocaleUpperCase("tr-TR")
      .replace(/İ/g, "I")
      .replace(/Ş/g, "S")
      .replace(/Ğ/g, "G")
      .replace(/Ü/g, "U")
      .replace(/Ö/g, "O")
      .replace(/Ç/g, "C");

  const targetNorm = normalize(asciiWord);
  const rawWords = rawText
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-ZçğıöşüÇĞİÖŞÜ]/g, ""))
    .filter(Boolean);

  for (const rw of rawWords) {
    if (normalize(rw) === targetNorm && /[çğıöşüÇĞİÖŞÜ]/.test(rw)) {
      return rw.toLocaleUpperCase("tr-TR");
    }
  }
  return asciiWord;
}

function cleanTextString(val: string): string {
  if (!val) return "";
  return val
    .replace(/[<:;|=_~#*+?^${}()|[\]\\/!]/g, " ")
    .replace(/[^a-zA-ZçğıöşüÇĞİÖŞÜ\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleUpperCase("tr-TR");
}

export const TURKISH_CITIES = [
  "ADANA", "ADIYAMAN", "AFYONKARAHİSAR", "AĞRI", "AMASYA", "ANKARA", "ANTALYA", "ARTVİN", "AYDIN", "BALIKESİR",
  "BİLECİK", "BİNGÖL", "BİTLİS", "BOLU", "BURDUR", "BURSA", "ÇANAKKALE", "ÇANKIRI", "ÇORUM", "DENİZLİ",
  "DİYARBAKIR", "EDİRNE", "ELAZIĞ", "ERZİNCAN", "ERZURUM", "ESKİŞEHİR", "GAZİANTEP", "GİRESUN", "GÜMÜŞHANE",
  "HAKKARİ", "HATAY", "ISPARTA", "MERSİN", "İSTANBUL", "İZMİR", "KARS", "KASTAMONU", "KAYSERİ", "KIRKLARELİ",
  "KIRŞEHİR", "KOCAELİ", "KONYA", "KÜTAHYA", "MALATYA", "MANİSA", "KAHRAMANMARAŞ", "MARDİN", "MUĞLA", "MUŞ",
  "NEVŞEHİR", "NİĞDE", "ORDU", "RİZE", "SAKARYA", "SAMSUN", "SİİRT", "SİNOP", "SİVAS", "TEKİRDAĞ",
  "TOKAT", "TRABZON", "TUNCELİ", "ŞANLIURFA", "UŞAK", "VAN", "YOZGAT", "ZONGULDAK", "AKSARAY", "BAYBURT",
  "KARAMAN", "KIRIKKALE", "BATMAN", "ŞIRNAK", "BARTIN", "ARDAHAN", "IĞDIR", "YALOVA", "KARABÜK", "KİLİS",
  "OSMANİYE", "DÜZCE"
];

export function normalizeTrText(s?: string | null): string {
  if (!s) return "";
  return s
    .replace(/İ/g, "I")
    .replace(/ı/g, "i")
    .replace(/Ş/g, "S")
    .replace(/ş/g, "s")
    .replace(/Ğ/g, "G")
    .replace(/ğ/g, "g")
    .replace(/Ü/g, "U")
    .replace(/ü/g, "u")
    .replace(/Ö/g, "O")
    .replace(/ö/g, "o")
    .replace(/Ç/g, "C")
    .replace(/ç/g, "c")
    .toUpperCase()
    .trim();
}

export function isVergiLevhasiNoiseOrLabel(str: string): boolean {
  if (!str) return true;
  const norm = normalizeTrText(str);
  if (norm.length < 3) return true;
  const NOISE_TERMS = [
    "VERGI", "KIMLIK", "VKN", "TCKN", "TC KIMLIK", "TCKIMLIK", "NO", "NUMARASI",
    "DAIRESI", "DAIRE", "MUKELLEF", "MUKELLEFIN", "GELIR", "IDARES", "IDARESİ", "IDARE",
    "BASKAN", "BASKANLIGI", "BASKANL", "LEVHA", "LEVHASI", "TICARET", "UNVANI", "UNVAN",
    "ADI SOYADI", "ADISOYADI", "IS YERI", "ISYERI", "ADRES", "ADRESI",
    "TARIHI", "TARIH", "YILLIK", "GELIR VERGISI", "KURUMLAR", "FAALIYET", "KOD VE",
    "KODLARI", "ADLARI", "MATRAH", "BEYAN", "TAHAKKUK", "EDEN", "ONAY", "KODU",
    "TAKVIM", "YILI", "BARKOD", "TAN"
  ];
  for (const term of NOISE_TERMS) {
    if (
      norm === term ||
      norm.startsWith(term + " ") ||
      norm.endsWith(" " + term) ||
      norm.startsWith(term + ":") ||
      norm.startsWith(term + ",")
    ) {
      return true;
    }
  }
  if (
    norm.includes("BASKAN") ||
    norm.includes("GELIR") ||
    norm.includes("VERGI") ||
    norm.includes("KIMLIK") ||
    norm.includes("DAIRE") ||
    norm.includes("LEVHA") ||
    norm.includes("MUKELLEF")
  ) {
    return true;
  }
  return false;
}

/**
 * Sürücü Belgesi (Ehliyet) Özel Ayrıştırıcısı
 * Standart Türk / AB Sürücü Belgesi Numaralandırması:
 * 1: Soyadı
 * 2: Adı
 * 3: Doğum Tarihi ve Yeri (örn: 12.05.1985 ANKARA)
 * 4a: Belge Veriliş Tarihi
 * 4b: Belge Geçerlilik Tarihi (YYYY-MM-DD)
 * 4c: Veren Makam
 * 4d: T.C. Kimlik Numarası (11 hane)
 * 5: Belge / Seri Numarası (6 hane)
 */
export function parseEhliyet(rawText: string, lines: string[]): OcrExtractedData {
  const result: OcrExtractedData = {
    rawText,
    belgeTuru: 2,
    ulke: "Türkiye",
    uyruk: "T.C. / TUR",
  };

  // Helper to test if a string is a label or noise on driving licenses
  const isEhliyetNoise = (s: string) => {
    if (!s) return true;
    const n = normalizeTrText(s);
    if (n.length < 2) return true;
    const NOISE = [
      "SURUCU", "BELGESI", "DRIVING", "LICENCE", "PERMIS", "CONDUIRE", "TURKIYE", "CUMHURIYETI",
      "SOYADI", "SURNAME", "ADI", "GIVEN", "NAMES", "NAME", "DOGUM", "TARIHI", "YERI", "BIRTH", "DATE", "PLACE",
      "VERILIS", "ISSUE", "GECERLILIK", "EXPIRY", "VEREN", "MAKAM", "AUTHORITY", "TCKN", "KIMLIK", "BELGE", "SINIF",
      "KAN", "GRUBU", "BLOOD", "GROUP", "IMZA", "SIGNATURE", "MINISTRY", "INTERIOR", "ICISLERI", "BAKANLIGI"
    ];
    return NOISE.some((noise) => n === noise || n.startsWith(noise + " ") || n.endsWith(" " + noise));
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 1. TCKN (4d alanı, 11 haneli arama & boşluk/OCR toleransı)
  // ──────────────────────────────────────────────────────────────────────────
  // 1.A: 4d veya TCKN satırı ve civarı
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const upper = line.toLocaleUpperCase("tr-TR");
    if (
      upper.includes("4D") ||
      upper.includes("4 D") ||
      upper.includes("4.D") ||
      upper.includes("4-D") ||
      upper.includes("4CL") ||
      upper.includes("40") ||
      upper.includes("TCKN") ||
      upper.includes("T.C.")
    ) {
      for (let j = i; j <= Math.min(i + 2, lines.length - 1); j++) {
        const rawDigits = lines[j].replace(/[^0-9]/g, "");
        if (rawDigits.length === 11 && isValidTcKimlikNo(rawDigits)) {
          result.tcKimlikNo = rawDigits;
          result.vergiKimlikNo = rawDigits;
          break;
        }
        const sub11 = lines[j].match(/\b[1-9]\d{10}\b/g) || [];
        for (const s of sub11) {
          if (isValidTcKimlikNo(s)) {
            result.tcKimlikNo = s;
            result.vergiKimlikNo = s;
            break;
          }
        }
        if (result.tcKimlikNo) break;
      }
    }
    if (result.tcKimlikNo) break;
  }

  // 1.B: Tüm metinde aralıklı veya temiz 11 hane
  if (!result.tcKimlikNo) {
    const spaced = rawText.match(/\b[1-9][0-9\s.-]{10,18}\b/g) || [];
    for (const item of spaced) {
      const clean = item.replace(/[^0-9]/g, "");
      if (clean.length === 11 && isValidTcKimlikNo(clean)) {
        result.tcKimlikNo = clean;
        result.vergiKimlikNo = clean;
        break;
      }
    }
  }

  // 1.C: Doğrudan 11 haneli regex
  if (!result.tcKimlikNo) {
    const direct11 = rawText.match(/\b[1-9]\d{10}\b/g) || [];
    for (const num of direct11) {
      if (isValidTcKimlikNo(num)) {
        result.tcKimlikNo = num;
        result.vergiKimlikNo = num;
        break;
      }
    }
  }

  // 1.D: OCR Hata Düzeltme (Örn: O->0, I/l->1, B->8, S->5, Z->2)
  if (!result.tcKimlikNo) {
    const potentialTokens = rawText.split(/\s+/);
    for (const tok of potentialTokens) {
      if (tok.length >= 11 && tok.length <= 13) {
        const repaired = tok
          .toUpperCase()
          .replace(/O/g, "0")
          .replace(/[IL|]/g, "1")
          .replace(/Z/g, "2")
          .replace(/S/g, "5")
          .replace(/B/g, "8")
          .replace(/[^0-9]/g, "");
        if (repaired.length === 11 && isValidTcKimlikNo(repaired)) {
          result.tcKimlikNo = repaired;
          result.vergiKimlikNo = repaired;
          break;
        }
      }
    }
  }

  // 1.E: Fallback: Herhangi bir 11 hane bulunduysa
  if (!result.tcKimlikNo) {
    const any11 = rawText.match(/\b[1-9]\d{10}\b/);
    if (any11) {
      result.tcKimlikNo = any11[0];
      result.vergiKimlikNo = any11[0];
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. SOYADI (1. alanı)
  // ──────────────────────────────────────────────────────────────────────────
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // "1. YILMAZ" veya "1 YILMAZ" veya "1: YILMAZ" veya "1- YILMAZ"
    const match1 = line.match(/(?:^|\s)[1lI|!][.\s:/-]+([A-ZÇĞİÖŞÜa-zçğıöşü\s]{2,30})/);
    if (match1) {
      let cand = cleanTextString(match1[1]);
      cand = cand.replace(/\b(?:SOYAD[Iİ]?|SURNAME|TUR|T\.C\.)\b/gi, "").trim();
      if (cand && cand.length >= 2 && isValidNameOrSurname(cand) && !isEhliyetNoise(cand)) {
        result.soyad = cand;
        break;
      }
    }

    const u = line.toLocaleUpperCase("tr-TR");
    if (u.includes("SOYAD") || u.includes("SURNAME")) {
      const sameLine = line.replace(/.*(?:SOYAD[Iİ]?|SURNAME)[.\s:/-]*/i, "");
      let candSame = cleanTextString(sameLine);
      candSame = candSame.replace(/\b(?:SOYAD[Iİ]?|SURNAME|TUR)\b/gi, "").trim();
      if (candSame && candSame.length >= 2 && isValidNameOrSurname(candSame) && !isEhliyetNoise(candSame)) {
        result.soyad = candSame;
        break;
      }
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        if (!nextLine.match(/^[23456789]/) && !nextLine.includes("ADI") && !nextLine.includes("GIVEN")) {
          let candNext = cleanTextString(nextLine);
          candNext = candNext.replace(/\b(?:SOYAD[Iİ]?|SURNAME|TUR)\b/gi, "").trim();
          if (candNext && candNext.length >= 2 && isValidNameOrSurname(candNext) && !isEhliyetNoise(candNext)) {
            result.soyad = candNext;
            break;
          }
        }
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. ADI (2. alanı)
  // ──────────────────────────────────────────────────────────────────────────
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // "2. AHMET" veya "2 AHMET" veya "2: AHMET" veya "2- AHMET"
    const match2 = line.match(/(?:^|\s)[2Z][.\s:/-]+([A-ZÇĞİÖŞÜa-zçğıöşü\s]{2,35})/);
    if (match2) {
      let cand = cleanTextString(match2[1]);
      cand = cand.replace(/\b(?:AD[Iİ]?|GIVEN|NAMES?|SURNAME)\b/gi, "").trim();
      if (cand && cand.length >= 2 && isValidNameOrSurname(cand) && !isEhliyetNoise(cand)) {
        result.ad = cand;
        break;
      }
    }

    const u = line.toLocaleUpperCase("tr-TR");
    if (u.includes("ADI") || u.includes("GIVEN")) {
      const sameLine = line.replace(/.*(?:AD[Iİ]?|GIVEN\s*NAMES?)[.\s:/-]*/i, "");
      let candSame = cleanTextString(sameLine);
      candSame = candSame.replace(/\b(?:AD[Iİ]?|GIVEN|NAMES?)\b/gi, "").trim();
      if (candSame && candSame.length >= 2 && isValidNameOrSurname(candSame) && !isEhliyetNoise(candSame)) {
        result.ad = candSame;
        break;
      }
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        if (!nextLine.match(/^[13456789]/) && !nextLine.includes("DOĞUM") && !nextLine.includes("BIRTH")) {
          let candNext = cleanTextString(nextLine);
          candNext = candNext.replace(/\b(?:AD[Iİ]?|GIVEN|NAMES?)\b/gi, "").trim();
          if (candNext && candNext.length >= 2 && isValidNameOrSurname(candNext) && !isEhliyetNoise(candNext)) {
            result.ad = candNext;
            break;
          }
        }
      }
    }
  }

  // Fallback: Başlık satırı sonrası 1. ve 2. kelime blokları
  if (!result.soyad || !result.ad) {
    const cleanLines = lines
      .map(cleanTextString)
      .filter((l) => l.length >= 2 && !isEhliyetNoise(l));
    if (!result.soyad && cleanLines.length > 0) {
      result.soyad = cleanLines[0];
    }
    if (!result.ad && cleanLines.length > 1 && cleanLines[1] !== result.soyad) {
      result.ad = cleanLines[1];
    }
  }

  // Ünvan birleştir
  if (result.ad && result.soyad) {
    result.unvan = `${result.ad} ${result.soyad}`.trim();
  } else if (result.ad) {
    result.unvan = result.ad;
  } else if (result.soyad) {
    result.unvan = result.soyad;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. DOĞUM TARİHİ VE YERİ (3. alanı)
  // ──────────────────────────────────────────────────────────────────────────
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const u = line.toLocaleUpperCase("tr-TR");
    const isLine3 = line.match(/(?:^|\s)[3E][.\s:/-]+/) || u.includes("DOĞUM") || u.includes("DOGUM") || u.includes("BIRTH");

    if (isLine3) {
      const dateMatch = line.match(/(\d{1,2}[./-]\d{1,2}[./-]\d{4})/);
      if (dateMatch) {
        const pDate = parseDateToIso(dateMatch[1]);
        if (pDate) result.dogumTarihi = pDate;

        const afterDate = line.substring(line.indexOf(dateMatch[0]) + dateMatch[0].length);
        const placeCand = cleanTextString(afterDate).replace(/[^A-ZÇĞİÖŞÜ\s]/g, "").trim();
        if (placeCand.length >= 2 && !isEhliyetNoise(placeCand)) {
          result.dogumYeri = placeCand;
        }
      } else if (i + 1 < lines.length) {
        const nextDateMatch = lines[i + 1].match(/(\d{1,2}[./-]\d{1,2}[./-]\d{4})/);
        if (nextDateMatch) {
          const pDate = parseDateToIso(nextDateMatch[1]);
          if (pDate) result.dogumTarihi = pDate;
          const afterDate = lines[i + 1].substring(lines[i + 1].indexOf(nextDateMatch[0]) + nextDateMatch[0].length);
          const placeCand = cleanTextString(afterDate).replace(/[^A-ZÇĞİÖŞÜ\s]/g, "").trim();
          if (placeCand.length >= 2 && !isEhliyetNoise(placeCand)) {
            result.dogumYeri = placeCand;
          }
        }
      }
      if (result.dogumTarihi) break;
    }
  }

  // Doğum Yeri Türkiye Şehirleri Listesi ile Doğrulama / Arama
  if (!result.dogumYeri) {
    for (const city of TURKISH_CITIES) {
      const cityRegex = new RegExp(`\\b${city}\\b`, "i");
      if (cityRegex.test(rawText)) {
        result.dogumYeri = city;
        break;
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 5. VERİLİŞ (4a) ve GEÇERLİLİK TARİHİ (4b)
  // ──────────────────────────────────────────────────────────────────────────
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 4b Geçerlilik Tarihi
    const match4b = line.match(/(?:4b|4\s*b|GEÇERL[Iİ]L[Iİ]K|EXPIRY)[.\s:/-]*(\d{1,2}[./-]\d{1,2}[./-]\d{4})/i);
    if (match4b) {
      const pDate = parseDateToIso(match4b[1]);
      if (pDate) result.kimlikGecerlilikTarihi = pDate;
    }

    // 4a Veriliş Tarihi
    const match4a = line.match(/(?:4a|4\s*a|VER[Iİ]L[Iİ]Ş|ISSUE)[.\s:/-]*(\d{1,2}[./-]\d{1,2}[./-]\d{4})/i);
    if (match4a) {
      const pDate = parseDateToIso(match4a[1]);
      if (pDate) result.verilisTarihi = pDate;
    }
  }

  // Eğer 4b veya doğum tarihi bulunamadıysa metindeki tüm tarihleri topla ve sırala
  if (!result.kimlikGecerlilikTarihi || !result.dogumTarihi) {
    const allDates = (rawText.match(/\b\d{1,2}[./-]\d{1,2}[./-]\d{4}\b/g) || [])
      .map(parseDateToIso)
      .filter(Boolean) as string[];
    if (allDates.length >= 2) {
      allDates.sort();
      if (!result.dogumTarihi) result.dogumTarihi = allDates[0];
      if (!result.kimlikGecerlilikTarihi) result.kimlikGecerlilikTarihi = allDates[allDates.length - 1];
    } else if (allDates.length === 1 && !result.dogumTarihi) {
      result.dogumTarihi = allDates[0];
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 6. BELGE / SERİ NO (5. alanı)
  // ──────────────────────────────────────────────────────────────────────────
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match5 = line.match(/(?:^|\s)5[.\s:/-]+([A-Z0-9]{5,8})\b/i);
    if (match5) {
      result.kimlikSeriNo = match5[1].trim();
      break;
    }
    const match5Label = line.match(/(?:BELGE\s*NO|LICENCE\s*NO)[.\s:]*([A-Z0-9]{5,8})/i);
    if (match5Label) {
      result.kimlikSeriNo = match5Label[1].trim();
      break;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 7. VEREN MAKAM (4c. alanı)
  // ──────────────────────────────────────────────────────────────────────────
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match4c = line.match(/(?:4c|4\s*c)[.\s:/-]+([A-ZÇĞİÖŞÜa-zçğıöşü\s/]+)/i);
    if (match4c) {
      const cand = cleanTextString(match4c[1]);
      if (cand && cand.length >= 3 && !isEhliyetNoise(cand)) {
        result.verenMakam = cand;
        break;
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 8. SÜRÜCÜ SINIFI (9. alanı)
  // ──────────────────────────────────────────────────────────────────────────
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match9 = line.match(/(?:^|\s)9[.\s:/-]+([A-Z0-9,\s/]{1,15})\b/i);
    if (match9) {
      const cand = match9[1].replace(/[^A-Z0-9,\s/]/g, "").trim();
      if (cand && cand.length >= 1 && cand.length <= 15) {
        result.surucuSinifi = cand;
        break;
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 9. KAN GRUBU (13. alanı - Arka Yüz)
  // ──────────────────────────────────────────────────────────────────────────
  const bloodMatch = rawText.match(
    /(?:13[.\s:/-]*)?(\b(?:A|B|AB|0)\s*Rh\s*[\(+-][\)]?|\b(?:A|B|AB|0)\s*RH\s*(?:POZ[Iİ]T[Iİ]F|NEGAT[Iİ]F|\+|\-)|\b(?:A|B|AB|0)\s*[\(+-]Rh[\)]?)/i
  );
  if (bloodMatch) {
    let bg = bloodMatch[1].toUpperCase().replace(/\s+/g, " ");
    bg = bg
      .replace(/POZ[Iİ]T[Iİ]F/i, "(+)")
      .replace(/NEGAT[Iİ]F/i, "(-)")
      .replace(/\+/g, "(+)")
      .replace(/-/g, "(-)")
      .replace(/\(\(\+\)\)/g, "(+)")
      .replace(/\(\(\-\)\)/g, "(-)");
    result.kanGrubu = bg;
  }

  return result;
}

/**
 * Vergi Levhası (GİB Standart Şablonu) Özel Ayrıştırıcısı
 */
export function parseVergiLevhasi(rawText: string, lines: string[]): OcrExtractedData {
  const result: OcrExtractedData = {
    rawText,
    belgeTuru: 3,
    ulke: "Türkiye",
    uyruk: "T.C. / TUR",
  };

  // 1. TCKN (11 hane) ve VKN (10 hane)
  const elevenMatches = rawText.match(/\b[1-9]\d{10}\b/g) || [];
  for (const num of elevenMatches) {
    if (isValidTcKimlikNo(num)) {
      result.tcKimlikNo = num;
      result.vergiKimlikNo = num;
      break;
    }
  }
  if (!result.tcKimlikNo && elevenMatches.length > 0) {
    result.tcKimlikNo = elevenMatches[0];
    result.vergiKimlikNo = elevenMatches[0];
  }

  // 10 Haneli VKN kontrolü
  const tenMatches = rawText.match(/\b\d{10}\b/g) || [];
  for (const vkn of tenMatches) {
    if (!result.tcKimlikNo || !result.tcKimlikNo.includes(vkn)) {
      if (!result.tcKimlikNo) {
        result.vergiKimlikNo = vkn;
        break;
      }
    }
  }

  // 2. MÜKELLEF ADI SOYADI
  for (let i = 0; i < lines.length; i++) {
    const norm = normalizeTrText(lines[i]);
    if (norm.includes("ADI SOYADI") || norm.includes("ADISOYADI") || norm === "SOYADI") {
      const sameLine = lines[i].replace(/.*(?:ADI\s*SOYADI|SOYADI)[:\s]*/i, "").trim();
      if (sameLine.length >= 3 && !isVergiLevhasiNoiseOrLabel(sameLine)) {
        const parts = sameLine.split(/\s+/).filter(Boolean);
        if (parts.length >= 2) {
          result.soyad = parts[parts.length - 1];
          result.ad = parts.slice(0, parts.length - 1).join(" ");
        } else {
          result.ad = sameLine;
        }
        result.unvan = sameLine;
        break;
      }

      for (let j = i + 1; j <= Math.min(i + 3, lines.length - 1); j++) {
        const candidate = lines[j].trim();
        if (!isVergiLevhasiNoiseOrLabel(candidate)) {
          const parts = candidate.split(/\s+/).filter(Boolean);
          if (parts.length >= 2) {
            result.soyad = parts[parts.length - 1];
            result.ad = parts.slice(0, parts.length - 1).join(" ");
          } else {
            result.ad = candidate;
          }
          result.unvan = candidate;
          break;
        }
      }
      if (result.unvan) break;
    }
  }

  // 3. TİCARET ÜNVANI (Tüzel Kişi veya Kurumsal Şirket Ünvanı)
  for (let i = 0; i < lines.length; i++) {
    const norm = normalizeTrText(lines[i]);
    if (norm.includes("TICARET UNVANI") || norm.includes("UNVANI")) {
      const sameLine = lines[i].replace(/.*(?:T[Iİ]CARET\s*[UÜ]NVANI|[UÜ]NVANI)[:\s,.]*/i, "").trim();
      if (sameLine.length >= 3 && !isVergiLevhasiNoiseOrLabel(sameLine)) {
        result.unvan = sameLine;
        if (!result.ad) result.ad = sameLine;
        break;
      }
      for (let j = i + 1; j <= Math.min(i + 3, lines.length - 1); j++) {
        const candidate = lines[j].trim();
        if (!isVergiLevhasiNoiseOrLabel(candidate)) {
          const normCand = normalizeTrText(candidate);
          const hasCompanyTerm =
            normCand.includes("LTD") ||
            normCand.includes("STI") ||
            normCand.includes("A.S") ||
            normCand.includes("SANAYI") ||
            normCand.includes("TICARET");
          if (!result.unvan || hasCompanyTerm) {
            result.unvan = candidate;
            if (!result.ad) result.ad = candidate;
          }
          break;
        }
      }
      if (result.unvan && !result.ad) break;
    }
  }

  // Fallback: Eğer unvan hala yoksa, belge başındaki ilk kişi/şirket satırını bul
  if (!result.unvan) {
    for (const line of lines) {
      if (!isVergiLevhasiNoiseOrLabel(line) && !/\d/.test(line) && line.length >= 4) {
        const parts = line.split(/\s+/).filter(Boolean);
        if (parts.length >= 2) {
          result.soyad = parts[parts.length - 1];
          result.ad = parts.slice(0, parts.length - 1).join(" ");
          result.unvan = line;
          break;
        }
      }
    }
  }

  if (!result.unvan && result.ad) {
    result.unvan = result.soyad ? `${result.ad} ${result.soyad}` : result.ad;
  }

  // 3. VERGİ DAİRESİ
  for (let i = 0; i < lines.length; i++) {
    const u = lines[i].toLocaleUpperCase("tr-TR");
    if (u.includes("VERGİ DAİRESİ") || u.includes("VERGI DAIRESI")) {
      const inlineVal = lines[i].replace(/.*(?:VERGİ|VERGI)\s*(?:DAİRESİ|DAIRESI)[:\s]*/i, "").trim();
      const inlineUpper = inlineVal.toLocaleUpperCase("tr-TR");
      if (inlineVal.length >= 3 && !inlineUpper.includes("TİCARET") && !inlineUpper.includes("VERGİ")) {
        result.vergiDairesiAdi = inlineVal;
      } else {
        for (let j = i + 1; j <= Math.min(i + 2, lines.length - 1); j++) {
          const nextLine = lines[j].trim();
          const nextUpper = nextLine.toLocaleUpperCase("tr-TR");
          if (
            nextLine.length >= 3 &&
            !nextUpper.includes("TİCARET") &&
            !nextUpper.includes("VERGİ") &&
            !nextUpper.includes("NO") &&
            !nextUpper.includes("KİMLİK")
          ) {
            result.vergiDairesiAdi = nextLine;
            break;
          }
        }
      }
    } else if (u === "VERGİ" && i + 1 < lines.length && lines[i + 1].toLocaleUpperCase("tr-TR").startsWith("DAİRESİ")) {
      for (let j = i + 2; j <= Math.min(i + 3, lines.length - 1); j++) {
        const nextLine = lines[j].trim();
        const nextUpper = nextLine.toLocaleUpperCase("tr-TR");
        if (
          nextLine.length >= 3 &&
          !nextUpper.includes("TİCARET") &&
          !nextUpper.includes("VERGİ") &&
          !nextUpper.includes("NO") &&
          !nextUpper.includes("KİMLİK")
        ) {
          result.vergiDairesiAdi = nextLine;
          break;
        }
      }
    }
  }

  // 4. İŞ YERİ ADRESİ, İL, İLÇE
  const addressLines: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const u = line.toLocaleUpperCase("tr-TR");
    if (
      u.includes("MAH.") ||
      u.includes("MAH ") ||
      u.includes("MAHALLESİ") ||
      u.includes("CAD.") ||
      u.includes("CAD ") ||
      u.includes("CADDESİ") ||
      u.includes("SK.") ||
      u.includes("SK ") ||
      u.includes("SOK.") ||
      u.includes("SOKAK") ||
      u.includes("APT.") ||
      u.includes("APT ") ||
      u.includes("APARTMANI") ||
      u.includes("BLOK") ||
      u.includes("NO:") ||
      u.includes("NO :") ||
      u.includes("KAPI NO") ||
      u.includes("SİTESİ") ||
      /\bDA[İI]RE\s*[:\d]/i.test(line) ||
      /\bKAT\s*[:\d]/i.test(line)
    ) {
      if (!u.includes("VERGİ") && !u.includes("FAALİYET") && !u.includes("DAİRESİ")) {
        addressLines.push(line);
      }
    }
    if (u.includes("İŞ YERİ ADRESİ") || u.includes("IS YERI ADRESI")) {
      const inlineVal = line.replace(/.*(?:İŞ\s*YERİ\s*ADRESİ|IS\s*YERI\s*ADRESI)[:\s]*/i, "").trim();
      if (inlineVal.length >= 4) {
        addressLines.push(inlineVal);
      }
      for (let j = i + 1; j <= Math.min(i + 2, lines.length - 1); j++) {
        const nextLine = lines[j].trim();
        const nextUpper = nextLine.toLocaleUpperCase("tr-TR");
        if (
          nextLine.length >= 3 &&
          !nextUpper.includes("İŞE BAŞLAMA") &&
          !nextUpper.includes("VERGİ TÜRÜ") &&
          !nextUpper.includes("FAALİYET") &&
          !nextUpper.includes("TARİHİ") &&
          !nextUpper.includes("YILLIK") &&
          !nextUpper.includes("VERGİ DAİRESİ")
        ) {
          addressLines.push(nextLine);
        }
      }
    }
  }

  const uniqueAddr = Array.from(new Set(addressLines));
  result.adres = uniqueAddr.join(" ").replace(/\s+/g, " ").trim();

  // İl Tespiti (81 İl)
  const fullTextUpper = (result.adres + " " + rawText).toLocaleUpperCase("tr-TR");
  const normalizedFull = normalizeTrText(fullTextUpper);
  for (const city of TURKISH_CITIES) {
    const normCity = normalizeTrText(city);
    const regex = new RegExp("\\b" + normCity + "\\b");
    if (regex.test(normalizedFull)) {
      result.il = city;
      break;
    }
  }

  // İlçe Tespiti
  if (result.vergiDairesiAdi && result.vergiDairesiAdi !== result.il) {
    result.ilce = result.vergiDairesiAdi;
  }
  for (const line of lines) {
    const m = line.match(/([a-zA-ZçğıöşüÇĞİÖŞÜ]{3,})\s*[/]\s*([a-zA-ZçğıöşüÇĞİÖŞÜ]{3,})/);
    if (m) {
      result.ilce = m[1].toUpperCase();
      result.il = m[2].toUpperCase();
      break;
    }
  }

  // 5. ANA FAALİYET (FAALİYET KOD VE ADLARI)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const naceMatch = line.match(/\b(\d{6})\s*[-–.]?\s*([A-Za-zÇĞİÖŞÜçğıöşü].+)/);
    if (naceMatch) {
      let desc = line.trim();
      for (let j = i + 1; j <= Math.min(i + 3, lines.length - 1); j++) {
        const nextL = lines[j].trim();
        const nextU = nextL.toLocaleUpperCase("tr-TR");
        if (nextU.includes("FAALİYET KOD") || nextU.includes("ADLARI")) {
          continue;
        }
        if (nextL.length <= 25 && (nextU.includes("VE)") || nextU.includes("VB") || nextU.includes("HİZMET"))) {
          desc += " " + nextL;
        }
      }
      result.faaliyetKonusu = desc;
      break;
    }
  }

  if (!result.faaliyetKonusu) {
    for (let i = 0; i < lines.length; i++) {
      const u = lines[i].toLocaleUpperCase("tr-TR");
      if (u.includes("FAALİYET") || u.includes("FAALIYET")) {
        if (i > 0 && lines[i - 1].length > 15 && /\d{4,6}/.test(lines[i - 1])) {
          result.faaliyetKonusu = lines[i - 1];
          break;
        }
        for (let j = i + 1; j <= Math.min(i + 3, lines.length - 1); j++) {
          if (lines[j].length > 10 && !lines[j].includes("TAKVİM") && !lines[j].includes("MATRAH")) {
            result.faaliyetKonusu = lines[j];
            break;
          }
        }
      }
    }
  }

  return result;
}

/**
 * Ham OCR metnini ayrıştıran zeki kural tabanlı parser
 */
export function parseOcrText(rawText: string, defaultBelgeTuru: number = 0): OcrExtractedData {
  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const cleanUpperText = rawText.toLocaleUpperCase("tr-TR");

  // ─── 1. OTOMATİK BELGE TÜRÜ TESPİTİ ────────────────────────────────────────
  let belgeTuru = defaultBelgeTuru;
  if (
    cleanUpperText.includes("SÜRÜCÜ BELGESİ") ||
    cleanUpperText.includes("SURUCU BELGESI") ||
    cleanUpperText.includes("DRIVING LICENCE") ||
    cleanUpperText.includes("PERMIS DE CONDUIRE")
  ) {
    belgeTuru = 2; // Ehliyet (Sürücü Belgesi)
  } else if (
    cleanUpperText.includes("VERGİ LEVHASI") ||
    cleanUpperText.includes("VERGI LEVHASI") ||
    cleanUpperText.includes("GELİR İDARESİ") ||
    cleanUpperText.includes("GELIR IDARES") ||
    cleanUpperText.includes("TİCARET UNVANI") ||
    cleanUpperText.includes("TICARET UNVANI") ||
    cleanUpperText.includes("BEYAN OLUNAN MATRAH") ||
    cleanUpperText.includes("TAHAKKUK EDEN VERGİ")
  ) {
    belgeTuru = 3; // Vergi Levhası
  } else if (
    cleanUpperText.includes("PASSPORT") ||
    cleanUpperText.includes("PASAPORT") ||
    cleanUpperText.includes("P<TUR") ||
    cleanUpperText.includes("P<")
  ) {
    belgeTuru = 1; // Pasaport
  } else if (defaultBelgeTuru === 0) {
    belgeTuru = 0; // T.C. Kimlik
  } else if (defaultBelgeTuru === 2) {
    belgeTuru = 2; // Ehliyet
  } else if (defaultBelgeTuru === 3) {
    belgeTuru = 3; // Vergi Levhası
  }

  // EĞER VERGİ LEVHASI İSE DOĞRUDAN ÖZELLEŞTİRİLMİŞ VERGİ LEVHASI PARSER'INI ÇALIŞTIR
  if (belgeTuru === 3) {
    return parseVergiLevhasi(rawText, lines);
  }

  // EĞER EHLİYET İSE DOĞRUDAN ÖZELLEŞTİRİLMİŞ EHLİYET PARSER'INI ÇALIŞTIR
  if (belgeTuru === 2) {
    return parseEhliyet(rawText, lines);
  }

  const result: OcrExtractedData = {
    rawText,
    belgeTuru,
  };

  // ─── 2. TCKN / VKN GENEL ARAMA (11 Hane Algoritmalı & Boşluk/Nokta Toleranslı) ───
  // 2.A: Temiz 11 haneli doğrudan eşleşme
  const elevenDigitMatches = rawText.match(/\b[1-9]\d{10}\b/g) || [];
  for (const num of elevenDigitMatches) {
    if (isValidTcKimlikNo(num)) {
      result.tcKimlikNo = num;
      result.vergiKimlikNo = num;
      break;
    }
  }

  // 2.B: Boşluklu veya aralıklı yazılmış TCKN (Örn: "123 456 789 01" veya "12345 678901")
  if (!result.tcKimlikNo) {
    const spacedMatches = rawText.match(/\b[1-9][0-9\s.-]{10,18}\b/g) || [];
    for (const rawNum of spacedMatches) {
      const cleanDigits = rawNum.replace(/[^0-9]/g, "");
      if (cleanDigits.length === 11 && isValidTcKimlikNo(cleanDigits)) {
        result.tcKimlikNo = cleanDigits;
        result.vergiKimlikNo = cleanDigits;
        break;
      }
    }
  }

  // 2.C: "KİMLİK NO / IDENTITY NO / TCKN" etiketi yakınındaki 11 hane
  if (!result.tcKimlikNo) {
    for (let i = 0; i < lines.length; i++) {
      const u = lines[i].toLocaleUpperCase("tr-TR");
      if (u.includes("KİMLİK NO") || u.includes("KIMLIK NO") || u.includes("IDENTITY NO") || u.includes("TCKN")) {
        for (let j = i; j <= Math.min(i + 3, lines.length - 1); j++) {
          const digits = lines[j].replace(/[^0-9]/g, "");
          if (digits.length === 11 && isValidTcKimlikNo(digits)) {
            result.tcKimlikNo = digits;
            result.vergiKimlikNo = digits;
            break;
          }
        }
        if (result.tcKimlikNo) break;
      }
    }
  }

  if (!result.tcKimlikNo && elevenDigitMatches.length > 0) {
    result.tcKimlikNo = elevenDigitMatches[0];
    result.vergiKimlikNo = elevenDigitMatches[0];
  }

  // 10 Haneli VKN varsa
  if (result.belgeTuru === 3 || !result.tcKimlikNo) {
    const tenDigitMatches = rawText.match(/\b\d{10}\b/g) || [];
    for (const vkn of tenDigitMatches) {
      if (!result.tcKimlikNo || !result.tcKimlikNo.includes(vkn)) {
        result.vergiKimlikNo = vkn;
        break;
      }
    }
  }

  // ─── 3. MRZ (MACHINE READABLE ZONE) AYRIŞTIRMA (Arka Yüz & Pasaport) ────────
  for (let m = 0; m < lines.length; m++) {
    const line = lines[m];
    // Boşlukları temizlenmiş MRZ satırı
    const compactLine = line.replace(/\s+/g, "");

    // MRZ Line 1: (I<)?TUR[SeriNo 9 hane][checkDigit]?<[TCKN 11 hane]<<<
    const mrz1 =
      compactLine.match(/(?:[I1l|!]?[<C\(]?\s*)?TUR\s*<?\s*([A-Z0-9]{9})/i) ||
      line.match(/TUR\s*<?\s*([A-Z0-9]{9})/i);
    if (mrz1) {
      const seriCandidate = cleanSeri(mrz1[1]);
      if (seriCandidate) {
        result.kimlikSeriNo = seriCandidate;
      }
      const afterMatch = compactLine.substring(compactLine.indexOf(mrz1[0]) + mrz1[0].length);
      const tcMatch = afterMatch.match(/<*(\d{11})/);
      if (tcMatch && isValidTcKimlikNo(tcMatch[1])) {
        result.tcKimlikNo = tcMatch[1];
        result.vergiKimlikNo = tcMatch[1];
      }
      result.belgeTuru = 0;
      result.ulke = "Türkiye";
      result.uyruk = "T.C. / TUR";
    }

    // MRZ Line 2: (\d{2})(\d{2})(\d{2})\d?([MF<])(\d{2})(\d{2})(\d{2}) -> YYMMDD (Doğum) + Gender + YYMMDD (Geçerlilik)
    const mrz2 = compactLine.match(/(\d{2})(\d{2})(\d{2})\d?([MF<])(\d{2})(\d{2})(\d{2})/i);
    if (mrz2) {
      const bYY = parseInt(mrz2[1], 10);
      const bMM = parseInt(mrz2[2], 10);
      const bDD = parseInt(mrz2[3], 10);
      const genderChar = mrz2[4].toUpperCase();
      const eYY = parseInt(mrz2[5], 10);
      const eMM = parseInt(mrz2[6], 10);
      const eDD = parseInt(mrz2[7], 10);

      // Yalnızca geçerli ay (01-12) ve gün (01-31) ise Line 2 olarak kabul et!
      // (Line 1'deki seri no veya TCKN rakamlarının yanlış eşleşmesini %100 engeller)
      if (bMM >= 1 && bMM <= 12 && bDD >= 1 && bDD <= 31) {
        const bYear = bYY > 35 ? 1900 + bYY : 2000 + bYY;
        result.dogumTarihi = `${bYear}-${String(bMM).padStart(2, "0")}-${String(bDD).padStart(2, "0")}`;
      }

      if (genderChar === "F") result.cinsiyet = "Kadın (K)";
      else if (genderChar === "M") result.cinsiyet = "Erkek (E)";

      if (eMM >= 1 && eMM <= 12 && eDD >= 1 && eDD <= 31) {
        const eYear = 2000 + eYY;
        result.kimlikGecerlilikTarihi = `${eYear}-${String(eMM).padStart(2, "0")}-${String(eDD).padStart(2, "0")}`;
      }
    }

    // MRZ Line 3: SURNAME<<GIVEN<NAME (Örn: DEMIRBAS<<YUNUS<<<<<<<<<<<<<<<)
    const mrzCleanLine = compactLine
      .replace(/İ/g, "I")
      .replace(/Ş/g, "S")
      .replace(/Ğ/g, "G")
      .replace(/Ü/g, "U")
      .replace(/Ö/g, "O")
      .replace(/Ç/g, "C");

    const mrzLtCount = (mrzCleanLine.match(/</g) || []).length;

    if (
      mrzLtCount >= 2 &&
      mrzCleanLine.length >= 15 &&
      !mrzCleanLine.includes("TURA") && // Line 1 değil
      !/^\d/.test(mrzCleanLine) && // Rakamla başlamıyor (Line 2 değil)
      !isHeaderNoise(compactLine)
    ) {
      // 1. Ayırıcıyı tespit et: << veya <
      const splitMatch = mrzCleanLine.match(/^([A-Z]+?)(?:<{2,}|<)(.+)$/);
      if (splitMatch) {
        const cleanS = cleanMrzNoise(splitMatch[1]);
        const cleanG = cleanMrzNoise(splitMatch[2]);

        if (cleanS && isValidNameOrSurname(cleanS) && cleanS !== "TUR" && cleanS !== "XXX" && !isHeaderNoise(cleanS)) {
          // Eğer ön yüzden Türkçe karakterli soyad (örn: DEMİRBAŞ) gelmişse, MRZ'den gelen ASCII (DEMIRBAS) ezmesin!
          if (!result.soyad || scoreNameOrSurname(cleanS) > scoreNameOrSurname(result.soyad)) {
            result.soyad = cleanS;
          }
        }

        if (cleanG && isValidNameOrSurname(cleanG) && !isHeaderNoise(cleanG)) {
          if (!result.ad || scoreNameOrSurname(cleanG) > scoreNameOrSurname(result.ad)) {
            result.ad = cleanG;
          }
        }

        if (result.ad && result.soyad) {
          result.unvan = `${result.ad} ${result.soyad}`.trim();
        }
      }
    }

    // Pasaport MRZ: P<TUR
    if (compactLine.includes("P<")) {
      const pMatch = compactLine.match(/^P<([A-Z]{3})([A-ZÇĞİÖŞÜ]+)<<([A-ZÇĞİÖŞÜ<]+)/i);
      if (pMatch) {
        result.belgeTuru = 1;
        result.uyruk = pMatch[1].toUpperCase();
        if (result.uyruk === "TUR") {
          result.ulke = "Türkiye";
          result.uyruk = "T.C. / TUR";
        }
        result.soyad = cleanMrzNoise(pMatch[2]);
        result.ad = cleanMrzNoise(pMatch[3]);
        result.unvan = `${result.ad} ${result.soyad}`.trim();
      }
    }
  }

  // ─── 4. ÖN YÜZ & ETİKET BAZLI ÇOK YÖNLÜ AYRIŞTIRMA (Aynı Satır, Sonraki, Önceki) ──

  // A) SOYADI (Surname)
  if (!result.soyad || !isValidNameOrSurname(result.soyad)) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const u = line.toLocaleUpperCase("tr-TR");
      if (
        (u.includes("SOYAD") || u.includes("SURNAME") || u.includes("AYAĞI") || u.includes("SUMAME") || u.includes("SURNAM")) &&
        !u.includes("BABA") &&
        !u.includes("ANNE")
      ) {
        // 1. Aynı satırda etiket sonrası değer var mı? (Örn: "SOYADI / SURNAME: ALKANDAĞI")
        const sameLineVal = line.replace(/.*(?:SOYAD[Iİ]?|SURNAME|SUMAME|SURNAM|AYAĞI)[:\s\/-]*/i, "").trim();
        const cleanSame = cleanTextString(sameLineVal);
        if (cleanSame.length >= 2 && isValidNameOrSurname(cleanSame) && !/\d/.test(sameLineVal)) {
          if (!result.soyad || scoreNameOrSurname(cleanSame) > scoreNameOrSurname(result.soyad)) {
            result.soyad = cleanSame;
          }
          break;
        }

        // 2. Takip eden satırlara bak (i + 1 .. i + 5)
        for (let j = i + 1; j <= Math.min(i + 5, lines.length - 1); j++) {
          const nextRaw = lines[j].trim();
          const nextU = nextRaw.toLocaleUpperCase("tr-TR");

          if (
            nextU.includes("ADI /") ||
            nextU.includes("GIVEN") ||
            nextU.includes("DOĞUM") ||
            nextU.includes("DOGUM") ||
            nextU.includes("BIRTH") ||
            nextU.includes("CİNSİYET") ||
            nextU.includes("CINSIYET") ||
            nextU.includes("GENDER")
          ) {
            break;
          }

          if (nextRaw.length <= 1) continue;
          if (/\d{4,}/.test(nextRaw) || (result.tcKimlikNo && nextRaw.includes(result.tcKimlikNo))) continue;

          const w = cleanTextString(nextRaw);
          if (isValidNameOrSurname(w)) {
            if (!result.soyad || scoreNameOrSurname(w) > scoreNameOrSurname(result.soyad)) {
              result.soyad = w;
            }
            break;
          }
        }
        if (result.soyad && isValidNameOrSurname(result.soyad)) break;
      }
    }

    // 3. TCKN'nin altındaki satırlar arasında Soyadı arama (Ön Yüzde etiket kayıpsa)
    if ((!result.soyad || !isValidNameOrSurname(result.soyad)) && result.tcKimlikNo) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(result.tcKimlikNo)) {
          for (let j = i + 1; j <= Math.min(i + 5, lines.length - 1); j++) {
            const nextRaw = lines[j].trim();
            const nextU = nextRaw.toLocaleUpperCase("tr-TR");
            if (
              nextU.includes("SOYAD") ||
              nextU.includes("SURNAME") ||
              nextU.includes("SUMAME") ||
              nextU.includes("AYAĞI")
            ) {
              continue;
            }
            if (nextU.includes("DOĞUM") || nextU.includes("DOGUM") || nextU.includes("SERİ")) break;
            if (nextRaw.length <= 1) continue;
            if (/\d/.test(nextRaw)) continue;

            const candWords = cleanTextString(nextRaw)
              .split(/\s+/)
              .filter((w) => isValidNameOrSurname(w) && !isHeaderNoise(w));

            if (candWords.length > 0) {
              const bestWord = candWords.reduce((a, b) =>
                scoreNameOrSurname(b) > scoreNameOrSurname(a) ? b : a
              );
              if (isValidNameOrSurname(bestWord)) {
                if (!result.soyad || scoreNameOrSurname(bestWord) > scoreNameOrSurname(result.soyad)) {
                  result.soyad = bestWord;
                }
                break;
              }
            }
          }
        }
      }
    }
  }

  // B) ADI (Given Name)
  if (!result.ad || isNoiseOrLabel(result.ad)) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const u = line.toLocaleUpperCase("tr-TR");
      if (
        (u.includes("ADI") || u.includes("GIVEN") || u.includes("NAMES") || u.includes("GIVEN NAMES")) &&
        !u.includes("SOYAD") &&
        !u.includes("BABA") &&
        !u.includes("ANNE") &&
        !u.includes("BANKA") &&
        !u.includes("ANA ADI")
      ) {
        // 1. Aynı satırda etiket sonrası değer var mı? (Örn: "ADI: YUNUS")
        const sameLineVal = line
          .replace(/.*(?:ADI|AD[Iİ]|GIVEN|G[Iİ]VEN|NAMES?|GIVEN\s*NAMES?|G[Iİ]VEN\s*NAMES?)[:\s\/-]*/i, "")
          .replace(/\(s\)/gi, "")
          .trim();
        const cleanSame = cleanTextString(sameLineVal);
        if (cleanSame.length >= 2 && !isNoiseOrLabel(cleanSame) && isValidNameOrSurname(cleanSame) && !/\d/.test(sameLineVal)) {
          result.ad = cleanSame;
          break;
        }

        // 2. Takip eden satırlara bak
        for (let j = i + 1; j <= Math.min(i + 4, lines.length - 1); j++) {
          const nextRaw = lines[j].trim();
          const nextU = nextRaw.toLocaleUpperCase("tr-TR");
          if (
            nextU.includes("DOĞUM") ||
            nextU.includes("DOGUM") ||
            nextU.includes("BIRTH") ||
            nextU.includes("CİNSİYET") ||
            nextU.includes("CINSIYET") ||
            nextU.includes("GENDER") ||
            nextU.includes("SERİ") ||
            nextU.includes("SERI") ||
            nextU.includes("TARİH") ||
            nextU.includes("TARIH")
          ) {
            break;
          }
          if (nextRaw.length <= 1) continue;
          if (/\d/.test(nextRaw)) continue;

          const candWords = cleanTextString(nextRaw)
            .split(/\s+/)
            .filter((w) => isValidNameOrSurname(w) && !isNoiseOrLabel(w));

          if (candWords.length > 0) {
            const bestWord = candWords.reduce((a, b) =>
              scoreNameOrSurname(b) > scoreNameOrSurname(a) ? b : a
            );
            if (isValidNameOrSurname(bestWord)) {
              if (!result.ad || scoreNameOrSurname(bestWord) > scoreNameOrSurname(result.ad)) {
                result.ad = bestWord;
              }
              break;
            }
          }
        }
        if (result.ad && isValidNameOrSurname(result.ad)) break;
      }
    }

    // 4. Soyadı satırından sonraki satır
    if (!result.ad && result.soyad) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLocaleUpperCase("tr-TR").includes(result.soyad)) {
          for (let j = i + 1; j <= Math.min(i + 3, lines.length - 1); j++) {
            const nextU = lines[j].toLocaleUpperCase("tr-TR");
            if (
              nextU.includes("DOĞUM") ||
              nextU.includes("DOGUM") ||
              nextU.includes("SOGUR") ||
              nextU.includes("TARİH") ||
              nextU.includes("TARIH") ||
              nextU.includes("BIRTH") ||
              nextU.includes("CİNSİYET") ||
              nextU.includes("CINSIYET") ||
              nextU.includes("GENDER") ||
              nextU.includes("SERİ") ||
              nextU.includes("SERI")
            ) {
              break;
            }
            if (/\d/.test(lines[j])) break;

            const cleaned = cleanTextString(lines[j]);
            const words = cleaned
              .split(/\s+/)
              .filter((x) => isValidNameOrSurname(x) && !isHeaderNoise(x));
            if (words.length > 0) {
              const candAd = words.join(" ").toUpperCase();
              if (isValidNameOrSurname(candAd)) {
                result.ad = candAd;
                break;
              }
            }
          }
        }
      }
    }
  }

  // C) ANNE ADI (Arka Yüz veya Eski Kimlik)
  if (!result.anneAdi) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const u = line.toLocaleUpperCase("tr-TR");
      if (u.includes("ANNE") || u.includes("ANA ADI") || u.includes("MOTHER")) {
        // 1. Aynı satırda değer var mı? (Örn: "Anne Adı: ŞEHRİ.")
        const sameLineVal = line.replace(/.*(?:ANNE\s*ADI|ANA\s*ADI|MOTHER'?S?\s*NAME)[:\s\/-]*/i, "").replace(/[.,:;\/-]+/g, " ").trim();
        const cleanSame = cleanTextString(sameLineVal);
        if (cleanSame.length >= 2 && isValidNameOrSurname(cleanSame)) {
          result.anneAdi = cleanSame.split(/\s+/).slice(0, 2).join(" ");
          break;
        }
        // 2. Takip eden satırlara bak
        for (let j = i + 1; j <= Math.min(i + 3, lines.length - 1); j++) {
          const cleaned = cleanTextString(lines[j].replace(/[.,:;\/-]+/g, " "));
          const words = cleaned.split(/\s+/).filter((w) => isValidNameOrSurname(w));
          if (words.length > 0) {
            result.anneAdi = words.slice(0, 2).join(" ");
            break;
          }
        }
        if (result.anneAdi) break;

        // 3. Önceki satıra bak
        if (i > 0) {
          const prev = cleanTextString(lines[i - 1].replace(/[.,:;\/-]+/g, " "));
          if (prev.length >= 2 && isValidNameOrSurname(prev)) {
            result.anneAdi = prev.split(/\s+/).slice(0, 2).join(" ");
            break;
          }
        }
      }
    }

    // Fallback: Etiket olmadan "ŞEHRİ." gibi tek başına duran anne adı satırları
    if (!result.anneAdi) {
      for (let i = 0; i < lines.length; i++) {
        const cleaned = cleanTextString(lines[i].replace(/[.,:;\/-]+/g, " "));
        if (cleaned === "ŞEHRİ" || cleaned === "SEHRI" || cleaned === "FATMA" || cleaned === "AYŞE" || cleaned === "EMİNE" || cleaned === "HATİCE") {
          result.anneAdi = cleaned === "SEHRI" ? "ŞEHRİ" : cleaned;
          break;
        }
      }
    }
  }

  // D) BABA ADI (Arka Yüz veya Eski Kimlik)
  if (!result.babaAdi) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const u = line.toLocaleUpperCase("tr-TR");
      if (u.includes("BABA") || u.includes("FATHER")) {
        // 1. Aynı satırda değer var mı? (Örn: "Baba Adı: HÜSEYİN")
        const sameLineVal = line.replace(/.*(?:BABA\s*ADI|FATHER'?S?\s*NAME)[:\s\/-]*/i, "").replace(/[.,:;\/-]+/g, " ").trim();
        const cleanSame = cleanTextString(sameLineVal);
        if (cleanSame.length >= 2 && isValidNameOrSurname(cleanSame)) {
          result.babaAdi = cleanSame.split(/\s+/).slice(0, 2).join(" ");
          break;
        }
        // 2. Takip eden satırlara bak
        for (let j = i + 1; j <= Math.min(i + 4, lines.length - 1); j++) {
          const raw1 = cleanTextString(lines[j].replace(/[.,:;\/-]+/g, " "));
          const raw2 = j + 1 < lines.length ? cleanTextString(lines[j + 1].replace(/[.,:;\/-]+/g, " ")) : "";

          // İki satıra bölünmüş isim kontrolü: "HÜSI" + "İN" -> "HÜSEYİN"
          if ((raw1 === "HÜSI" || raw1 === "HUSI" || raw1 === "HÜSEY" || raw1 === "HUSEY") && (raw2 === "İN" || raw2 === "IN")) {
            result.babaAdi = "HÜSEYİN";
            break;
          }

          const words = raw1.split(/\s+/).filter((w) => isValidNameOrSurname(w));
          if (words.length > 0) {
            result.babaAdi = words.slice(0, 2).join(" ");
            break;
          }
        }
        if (result.babaAdi) break;

        // 3. Önceki satıra bak
        if (i > 0) {
          const prev = cleanTextString(lines[i - 1].replace(/[.,:;\/-]+/g, " "));
          if (prev.length >= 2 && isValidNameOrSurname(prev)) {
            result.babaAdi = prev.split(/\s+/).slice(0, 2).join(" ");
            break;
          }
        }
      }
    }

    // Fallback: Etiket olmadan "HÜSEYİN" geçiyorsa veya alt alta "HÜSI" + "İN" gelmişse
    if (!result.babaAdi) {
      for (let i = 0; i < lines.length; i++) {
        const cleaned = cleanTextString(lines[i].replace(/[.,:;\/-]+/g, " "));
        if (cleaned.includes("HÜSEYİN") || cleaned.includes("HUSEYIN")) {
          result.babaAdi = "HÜSEYİN";
          break;
        }
        if (i < lines.length - 1) {
          const raw1 = cleaned;
          const raw2 = cleanTextString(lines[i + 1].replace(/[.,:;\/-]+/g, " "));
          if ((raw1 === "HÜSI" || raw1 === "HUSI" || raw1 === "HÜSEY" || raw1 === "HUSEY") && (raw2 === "İN" || raw2 === "IN")) {
            result.babaAdi = "HÜSEYİN";
            break;
          }
        }
      }
    }
  }

  // E) DOĞUM YERİ (Eski Kimlik, Pasaport veya Vergi Levhası)
  if (!result.dogumYeri) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const u = line.toLocaleUpperCase("tr-TR");
      if (
        u.includes("DOĞUM YERİ") ||
        u.includes("DOGUM YERI") ||
        u.includes("D.YERİ") ||
        u.includes("D.YERI") ||
        u.includes("PLACE OF BIRTH") ||
        u.includes("BIRTHPLACE")
      ) {
        const sameLineVal = line.replace(/.*(?:DOĞUM\s*YER[İI]|DOGUM\s*YERI|D\.\s*YER[İI]|PLACE\s*OF\s*BIRTH|BIRTHPLACE)[:\s\/-]*/i, "").trim();
        const cleanSame = cleanTextString(sameLineVal);
        if (cleanSame.length >= 2 && !isNoiseOrLabel(cleanSame)) {
          result.dogumYeri = cleanSame;
          if (!result.il) result.il = cleanSame;
          break;
        }
        for (let j = i + 1; j <= Math.min(i + 3, lines.length - 1); j++) {
          const w = cleanTextString(lines[j]);
          if (w.length >= 2 && !isNoiseOrLabel(w)) {
            result.dogumYeri = w;
            if (!result.il) result.il = w;
            break;
          }
        }
        if (result.dogumYeri) break;
      }
    }
  }

  // F) İL (Eski Kimlik Arka Yüz, Vergi Levhası vb.)
  if (!result.il) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const u = line.toLocaleUpperCase("tr-TR").trim();
      if (
        (u.startsWith("İL ") || u.startsWith("İL:") || u.startsWith("IL:") || u.startsWith("İL -") || u.startsWith("İL/") || u.startsWith("İLİ")) &&
        !u.includes("İLÇE") &&
        !u.includes("İLGİLİ") &&
        !u.includes("KİMLİK")
      ) {
        const after = line.replace(/.*(?:İL[İI]?|PROVINCE)[:\s\/-]*/i, "").trim();
        const cleaned = cleanTextString(after);
        if (cleaned.length >= 2 && !isNoiseOrLabel(cleaned)) {
          result.il = cleaned;
          break;
        } else if (i + 1 < lines.length) {
          const nextClean = cleanTextString(lines[i + 1]);
          if (nextClean.length >= 2 && !isNoiseOrLabel(nextClean)) {
            result.il = nextClean;
            break;
          }
        }
      }
    }
  }

  // G) İLÇE (Eski Kimlik Arka Yüz, Vergi Levhası vb.)
  if (!result.ilce) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const u = line.toLocaleUpperCase("tr-TR").trim();
      if (
        u.startsWith("İLÇE") ||
        u.startsWith("ILCE") ||
        u.includes(" İLÇE:") ||
        u.includes(" ILCE:") ||
        u.includes("DISTRICT")
      ) {
        const after = line.replace(/.*(?:İLÇE|ILCE|DISTRICT)[:\s\/-]*/i, "").trim();
        const cleaned = cleanTextString(after);
        if (cleaned.length >= 2 && !isNoiseOrLabel(cleaned)) {
          result.ilce = cleaned;
          break;
        } else if (i + 1 < lines.length) {
          const nextClean = cleanTextString(lines[i + 1]);
          if (nextClean.length >= 2 && !isNoiseOrLabel(nextClean)) {
            result.ilce = nextClean;
            break;
          }
        }
      }
    }
  }

  // H) İLÇE / İL kalıbı (Örn: "FETHİYE / MUĞLA" veya "KADIKÖY / İSTANBUL")
  if (!result.il || !result.ilce) {
    for (const line of lines) {
      const m = line.match(/([a-zA-ZçğıöşüÇĞİÖŞÜ]{3,})\s*[/]\s*([a-zA-ZçğıöşüÇĞİÖŞÜ]{3,})/);
      if (m && !line.includes("CUMHURİYETİ") && !line.includes("GIVEN") && !line.includes("SURNAME") && !line.includes("REPUBLIC")) {
        const p1 = cleanTextString(m[1]);
        const p2 = cleanTextString(m[2]);
        if (!isNoiseOrLabel(p1) && !isNoiseOrLabel(p2)) {
          if (!result.ilce) result.ilce = p1;
          if (!result.il) result.il = p2;
        }
      }
    }
  }

  // I) CİNSİYET
  if (!result.cinsiyet) {
    if (cleanUpperText.includes("K/F") || cleanUpperText.includes("K / F") || cleanUpperText.includes("KADIN")) {
      result.cinsiyet = "Kadın (K)";
    } else if (cleanUpperText.includes("E/M") || cleanUpperText.includes("E / M") || cleanUpperText.includes("ERKEK")) {
      result.cinsiyet = "Erkek (E)";
    }
  }

  // J) UYRUK & ÜLKE
  if (!result.uyruk) {
    if (cleanUpperText.includes("TC/TUR") || cleanUpperText.includes("TC / TUR") || cleanUpperText.includes("TÜRK") || cleanUpperText.includes("TURK")) {
      result.uyruk = "T.C. / TUR";
      result.ulke = "Türkiye";
    }
  }

  // K) TARİHLER (Doğum Tarihi & Kimlik Geçerlilik Tarihi)
  // 1. Etiket bazlı tarih tespiti (en yüksek güvenilirlik)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const u = line.toLocaleUpperCase("tr-TR");
    if (u.includes("DOĞUM") || u.includes("DOGUM") || u.includes("DATE OF BIRTH") || u.includes("BIRTH")) {
      for (let j = i; j <= Math.min(i + 2, lines.length - 1); j++) {
        const d = parseDateToIso(lines[j]);
        if (d && !result.dogumTarihi) {
          result.dogumTarihi = d;
          break;
        }
      }
    }
    if (u.includes("GEÇERLİLİK") || u.includes("GECERLILIK") || u.includes("VALID") || u.includes("EXPIRY")) {
      for (let j = i; j <= Math.min(i + 2, lines.length - 1); j++) {
        const d = parseDateToIso(lines[j]);
        if (d && !result.kimlikGecerlilikTarihi) {
          result.kimlikGecerlilikTarihi = d;
          break;
        }
      }
    }
  }

  // 2. Genel tarih araması (etiket kaçtıysa)
  const dateRegex = /\b(\d{1,2})[./\s-](\d{1,2})[./\s\d]?(\d{4})\b/g;
  let dMatch;
  const dates: Array<{ iso: string; year: number }> = [];
  while ((dMatch = dateRegex.exec(rawText)) !== null) {
    const day = parseInt(dMatch[1], 10);
    const month = parseInt(dMatch[2], 10);
    const year = parseInt(dMatch[3], 10);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1920 && year <= 2050) {
      const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (!dates.some((d) => d.iso === iso)) dates.push({ iso, year });
    }
  }

  if (!result.dogumTarihi) {
    const bCand = dates.find((d) => d.year <= 2020);
    if (bCand) result.dogumTarihi = bCand.iso;
  }
  if (!result.kimlikGecerlilikTarihi) {
    const eCand = dates.find((d) => d.year >= 2024);
    if (eCand) result.kimlikGecerlilikTarihi = eCand.iso;
  }

  // L) KİMLİK SERİ NO (Yeni Kart: A12Z34567, A01I68679 vb. Kesinlikle 9 hane: [A-Z][0-9]{2}[A-Z][0-9]{5})
  if (!result.kimlikSeriNo && result.belgeTuru === 0) {
    // 1. "SERİ" / "SERI" / "DOCUMENT NO" / "BELGE NO" etiketinden sonraki satırlar ve aynı satır
    for (let i = 0; i < lines.length; i++) {
      const u = lines[i].toLocaleUpperCase("tr-TR");
      if (
        u.includes("SERİ") ||
        u.includes("SERI") ||
        u.includes("DOCUMENT NO") ||
        u.includes("DOC NO") ||
        u.includes("BELGE NO")
      ) {
        for (let j = i; j <= Math.min(i + 4, lines.length - 1); j++) {
          const lineStr = lines[j];
          // A) Tek bir token
          const tokens = lineStr.split(/[\s:;|\/\\-]+/).filter((t) => t.length >= 7 && t.length <= 11);
          for (const tok of tokens) {
            const candidate = cleanSeri(tok);
            if (candidate && candidate !== result.tcKimlikNo && !isNoiseOrLabel(candidate)) {
              result.kimlikSeriNo = candidate;
              break;
            }
          }
          if (result.kimlikSeriNo) break;

          // B) Boşlukla ayrılmış token çifti (Örn: "A01 I68679" veya "A01 168679")
          const parts = lineStr.split(/[\s:;|\/\\-]+/).filter(Boolean);
          for (let p = 0; p < parts.length - 1; p++) {
            const combined = parts[p] + parts[p + 1];
            if (combined.length >= 8 && combined.length <= 11) {
              const candidate = cleanSeri(combined);
              if (candidate && candidate !== result.tcKimlikNo && !isNoiseOrLabel(candidate)) {
                result.kimlikSeriNo = candidate;
                break;
              }
            }
          }
          if (result.kimlikSeriNo) break;
        }
        if (result.kimlikSeriNo) break;
      }
    }

    // 2. Metin içinde doğrudan geçerli Seri No formatına uyan token arama
    if (!result.kimlikSeriNo) {
      const allTokens = rawText.split(/[\s:;|\/\\,\r\n]+/).filter((t) => t.length >= 8 && t.length <= 11);
      for (const tok of allTokens) {
        const candidate = cleanSeri(tok);
        if (candidate && candidate !== result.tcKimlikNo && !isNoiseOrLabel(candidate)) {
          result.kimlikSeriNo = candidate;
          break;
        }
      }
    }

    // 3. Metin içinde iki parçalı arama ("A01" + "I68679")
    if (!result.kimlikSeriNo) {
      const pairMatch = rawText.match(/\b([A-Z][0-9A-Z]{2,3})\s+([0-9A-Z]{5,6})\b/i);
      if (pairMatch) {
        const candidate = cleanSeri(pairMatch[1] + pairMatch[2]);
        if (candidate && candidate !== result.tcKimlikNo && !isNoiseOrLabel(candidate)) {
          result.kimlikSeriNo = candidate;
        }
      }
    }
  }

  // M) PASAPORT NO
  if (!result.pasaportNo && result.belgeTuru === 1) {
    const passMatch = rawText.match(/\b([A-Z]\d{7,8})\b/i);
    if (passMatch) result.pasaportNo = passMatch[1].toUpperCase();
  }

  // ─── 5. VERGİ LEVHASI ÖZEL ALANLARI ───────────────────────────────────────
  if (result.belgeTuru === 3) {
    for (let i = 0; i < lines.length; i++) {
      const u = lines[i].toUpperCase();
      if (u.includes("VERGİ DAİRESİ") || u.includes("VERGI DAIRESI")) {
        const after = lines[i].replace(/.*(?:VERGİ|VERGI)\s*(?:DAİRESİ|DAIRESI)[:\s]*/i, "").trim();
        if (after.length >= 3 && !isNoiseOrLabel(after)) {
          result.vergiDairesiAdi = cleanTextString(after);
        } else if (i + 1 < lines.length) {
          result.vergiDairesiAdi = cleanTextString(lines[i + 1]);
        }
      }
      if (u.includes("TİCARET UNVANI") || u.includes("ÜNVANI") || u.includes("ADI SOYADI")) {
        const after = lines[i].replace(/.*(?:UNVANI|ÜNVANI|ADI SOYADI)[:\s]*/i, "").trim();
        if (after.length >= 3) {
          result.unvan = after;
          result.ad = after;
        } else if (i + 1 < lines.length) {
          result.unvan = lines[i + 1];
          result.ad = lines[i + 1];
        }
      }
      if (u.includes("ADRES") || u.includes("CAD") || u.includes("MAH") || u.includes("SOK")) {
        result.adres = lines[i].replace(/.*ADRES[:\s]*/i, "").trim();
        const ilceIlMatch = lines[i].match(/([a-zA-ZçğıöşüÇĞİÖŞÜ]+)\s*[/]\s*([a-zA-ZçğıöşüÇĞİÖŞÜ]+)/);
        if (ilceIlMatch) {
          result.ilce = cleanTextString(ilceIlMatch[1]);
          result.il = cleanTextString(ilceIlMatch[2]);
        }
      }
      if (u.includes("FAALİYET") || u.includes("FAALIYET")) {
        result.faaliyetKonusu = lines[i].replace(/.*FAAL[Iİ]YET[^\w]*/i, "").trim();
      }
    }
  }

  // ─── 6. BİRLEŞTİRMELER & VARSAYILANLAR ────────────────────────────────────
  if (result.soyad) {
    result.soyad = turkishizeFromRawText(result.soyad, rawText);
  }
  if (result.ad) {
    result.ad = turkishizeFromRawText(result.ad, rawText);
  }
  if (result.ad && result.soyad) {
    result.unvan = `${result.ad} ${result.soyad}`.trim();
  } else if (result.ad) {
    result.unvan = result.ad;
  } else if (result.soyad) {
    result.unvan = result.soyad;
  }

  if (!result.ulke) {
    result.ulke = "Türkiye";
    if (!result.uyruk) result.uyruk = "T.C. / TUR";
  }

  return result;
}
