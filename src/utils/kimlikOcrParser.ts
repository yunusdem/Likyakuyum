import { createWorker } from "tesseract.js";

export interface OcrExtractedData {
  rawText: string;
  belgeTuru: number; // 0: Kimlik, 1: Pasaport, 2: Vergi Levhası
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
  if (data.rawText) {
    const u = data.rawText.toLocaleUpperCase("tr-TR");
    if (u.includes("I<TUR") || u.includes("ANNE ADI") || u.includes("BABA ADI") || u.includes("MOTHER") || u.includes("FATHER") || u.includes("VEREN MAKAM") || u.includes("İÇİŞLERİ")) {
      return true;
    }
  }
  return false;
}

/**
 * Bir kimlik görselinin veya okunan verisinin Ön Yüz olup olmadığını tespit eder
 */
export function isKimlikFrontFace(data: OcrExtractedData): boolean {
  if (data.rawText) {
    const u = data.rawText.toLocaleUpperCase("tr-TR");
    if ((u.includes("KİMLİK NO") || u.includes("KIMLIK NO") || u.includes("IDENTITY NO") || u.includes("GIVEN") || u.includes("SURNAME") || u.includes("SOYADI")) && !u.includes("I<TUR") && !u.includes("ANNE ADI")) {
      return true;
    }
  }
  return false;
}

/**
 * Görselden metin okur (Tesseract.js OCR - PSM 11 Sparse Text modu)
 */
export async function performOcrAndExtractData(
  imageBase64: string,
  targetBelgeTuru: number = 0,
  onProgress?: (progress: number, statusText: string) => void
): Promise<OcrExtractedData> {
  onProgress?.(15, "OCR motoru hazırlanıyor...");
  const worker = await createWorker("tur+eng");

  // PSM 11 + Sabit 300 DPI + Kelime Boşluklarını Koruma (Farklı PC/çözünürlüklerde 'Estimating resolution' hatasını ve kaymaları önler)
  await worker.setParameters({
    tessedit_pageseg_mode: "11" as any,
    user_defined_dpi: "300",
    preserve_interword_spaces: "1",
  });

  onProgress?.(40, "Metinler ve kimlik bilgileri okunuyor...");
  // 1. Orijinal renkli görsel ile tanı
  const ret = await worker.recognize(imageBase64);
  let rawText = ret.data.text || "";

  // 2. Eğer metin azsa veya anahtar kelimeler eksikse alternatif netleştirme dene
  const normUpper = rawText.toLocaleUpperCase("tr-TR");
  const hasValidContent =
    normUpper.length >= 70 &&
    (normUpper.includes("TÜRKİYE") ||
      normUpper.includes("TURKIYE") ||
      normUpper.includes("TURKEY") ||
      normUpper.includes("KİMLİK") ||
      normUpper.includes("KIMLIK") ||
      normUpper.includes("VERGİ") ||
      normUpper.includes("VERGI") ||
      normUpper.includes("PASAPORT") ||
      normUpper.includes("PASSPORT") ||
      normUpper.includes("I<TUR") ||
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
];

export function isNoiseOrLabel(str: string): boolean {
  if (!str) return true;
  const trimmed = str.trim();
  if (trimmed.length <= 1) return true;
  const u1 = trimmed.toUpperCase();
  const u2 = trimmed.toLocaleUpperCase("tr-TR");
  return NOISE_WORDS.includes(u1) || NOISE_WORDS.includes(u2);
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
 * Vergi Levhası (GİB Standart Şablonu) Özel Ayrıştırıcısı
 */
export function parseVergiLevhasi(rawText: string, lines: string[]): OcrExtractedData {
  const result: OcrExtractedData = {
    rawText,
    belgeTuru: 2,
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
    cleanUpperText.includes("VERGİ LEVHASI") ||
    cleanUpperText.includes("VERGI LEVHASI") ||
    cleanUpperText.includes("GELİR İDARESİ") ||
    cleanUpperText.includes("GELIR IDARES") ||
    cleanUpperText.includes("TİCARET UNVANI") ||
    cleanUpperText.includes("TICARET UNVANI") ||
    cleanUpperText.includes("BEYAN OLUNAN MATRAH") ||
    cleanUpperText.includes("TAHAKKUK EDEN VERGİ")
  ) {
    belgeTuru = 2; // Vergi Levhası
  } else if (
    cleanUpperText.includes("PASSPORT") ||
    cleanUpperText.includes("PASAPORT") ||
    cleanUpperText.includes("P<TUR") ||
    cleanUpperText.includes("P<")
  ) {
    belgeTuru = 1; // Pasaport
  } else if (defaultBelgeTuru === 0) {
    belgeTuru = 0; // T.C. Kimlik
  }

  // EĞER VERGİ LEVHASI İSE DOĞRUDAN ÖZELLEŞTİRİLMİŞ VERGİ LEVHASI PARSER'INI ÇALIŞTIR
  if (belgeTuru === 2) {
    return parseVergiLevhasi(rawText, lines);
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
  if (result.belgeTuru === 2 || !result.tcKimlikNo) {
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

    // MRZ Line 2: (\d{6})\d([MF<])(\d{6}) -> YYMMDD (Doğum) + Gender + YYMMDD (Geçerlilik)
    const mrz2 = compactLine.match(/(\d{6})\d([MF<])(\d{6})/i);
    if (mrz2) {
      const bYY = parseInt(mrz2[1].substring(0, 2), 10);
      const bMM = mrz2[1].substring(2, 4);
      const bDD = mrz2[1].substring(4, 6);
      const bYear = bYY > 35 ? 1900 + bYY : 2000 + bYY;
      if (!result.dogumTarihi) {
        result.dogumTarihi = `${bYear}-${bMM}-${bDD}`;
      }

      if (mrz2[2] === "F") result.cinsiyet = "Kadın (K)";
      else if (mrz2[2] === "M") result.cinsiyet = "Erkek (E)";

      const eYY = parseInt(mrz2[3].substring(0, 2), 10);
      const eMM = mrz2[3].substring(2, 4);
      const eDD = mrz2[3].substring(4, 6);
      const eYear = 2000 + eYY;
      if (!result.kimlikGecerlilikTarihi) {
        result.kimlikGecerlilikTarihi = `${eYear}-${eMM}-${eDD}`;
      }
    }

    // MRZ Line 3: SURNAME<<GIVEN<NAME (Sadece gerçek MRZ satırlarında çalışır)
    if (compactLine.includes("<") && compactLine.length >= 10) {
      const mrz3 = compactLine.match(/^([A-ZÇĞİÖŞÜ]{2,})<+([A-ZÇĞİÖŞÜ< ]+)/i);
      if (mrz3) {
        const s = mrz3[1].toUpperCase();
        const g = mrz3[2].replace(/</g, " ").replace(/\s+/g, " ").trim().toUpperCase();
        if (s !== "TUR" && s !== "XXX" && s.length >= 2 && !isNoiseOrLabel(s)) {
          if (!result.soyad || isNoiseOrLabel(result.soyad)) {
            result.soyad = s;
          }
          if (!result.ad || isNoiseOrLabel(result.ad)) {
            result.ad = g;
          }
          if (!result.unvan) {
            result.unvan = `${g} ${s}`.trim();
          }
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
        result.soyad = pMatch[2].toUpperCase();
        result.ad = pMatch[3].replace(/</g, " ").trim().toUpperCase();
        result.unvan = `${result.ad} ${result.soyad}`;
      }
    }
  }

  // ─── 4. ÖN YÜZ & ETİKET BAZLI ÇOK YÖNLÜ AYRIŞTIRMA (Aynı Satır, Sonraki, Önceki) ──

  // A) SOYADI (Surname)
  if (!result.soyad || isNoiseOrLabel(result.soyad)) {
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
        if (cleanSame.length >= 2 && !isNoiseOrLabel(cleanSame) && !/\d/.test(sameLineVal)) {
          result.soyad = cleanSame;
          break;
        }

        // 2. Takip eden satırlara bak (i + 1 .. i + 5)
        for (let j = i + 1; j <= Math.min(i + 5, lines.length - 1); j++) {
          const nextRaw = lines[j].trim();
          const nextU = nextRaw.toLocaleUpperCase("tr-TR");

          // Eğer sonraki alan etiketine ulaştıysak dur
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

          // Çok kısa veya tek harfli gürültüleri atla (A, e, ©, vb.)
          if (nextRaw.length <= 1) continue;

          // Rakam içeren satırları atla (TCKN vb.)
          if (/\d{4,}/.test(nextRaw) || (result.tcKimlikNo && nextRaw.includes(result.tcKimlikNo))) continue;

          const w = cleanTextString(nextRaw);
          if (w.length >= 2 && !isNoiseOrLabel(w)) {
            result.soyad = w;
            break;
          }
        }
        if (result.soyad && !isNoiseOrLabel(result.soyad)) break;
      }
    }

    // 3. TCKN'nin altındaki satırlar arasında Soyadı arama
    if ((!result.soyad || isNoiseOrLabel(result.soyad)) && result.tcKimlikNo) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(result.tcKimlikNo)) {
          for (let j = i + 1; j <= Math.min(i + 4, lines.length - 1); j++) {
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
            if (nextU.includes("ADI") || nextU.includes("GIVEN")) break;
            if (nextRaw.length <= 1) continue;
            if (/\d/.test(nextRaw)) continue;

            const w = cleanTextString(nextRaw);
            if (w.length >= 2 && !isNoiseOrLabel(w)) {
              result.soyad = w;
              break;
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
        const sameLineVal = line.replace(/.*(?:ADI|GIVEN\s*NAMES?|NAMES?)[:\s\/-]*/i, "").trim();
        const cleanSame = cleanTextString(sameLineVal);
        if (cleanSame.length >= 2 && !isNoiseOrLabel(cleanSame) && !/\d/.test(sameLineVal)) {
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
            nextU.includes("SERI")
          ) {
            break;
          }
          if (nextRaw.length <= 1) continue;
          if (/\d/.test(nextRaw)) continue;

          const cleaned = cleanTextString(nextRaw);
          if (cleaned.length >= 2 && !isNoiseOrLabel(cleaned)) {
            result.ad = cleaned;
            break;
          }
        }
        if (result.ad && !isNoiseOrLabel(result.ad)) break;
      }
    }

    // 4. Soyadı satırından sonraki satır
    if (!result.ad && result.soyad) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLocaleUpperCase("tr-TR").includes(result.soyad)) {
          for (let j = i + 1; j <= Math.min(i + 3, lines.length - 1); j++) {
            const cleaned = cleanTextString(lines[j]);
            const words = cleaned.split(/\s+/).filter((x) => x.length >= 2 && !isNoiseOrLabel(x));
            if (words.length > 0) {
              result.ad = words.join(" ").toUpperCase();
              break;
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
        // 1. Aynı satırda değer var mı? (Örn: "Anne Adı: HEDİYE")
        const sameLineVal = line.replace(/.*(?:ANNE\s*ADI|ANA\s*ADI|MOTHER'?S?\s*NAME)[:\s\/-]*/i, "").trim();
        const cleanSame = cleanTextString(sameLineVal);
        if (cleanSame.length >= 2 && !isNoiseOrLabel(cleanSame)) {
          result.anneAdi = cleanSame.split(/\s+/).slice(0, 2).join(" ");
          break;
        }
        // 2. Takip eden satırlara bak
        for (let j = i + 1; j <= Math.min(i + 3, lines.length - 1); j++) {
          const cleaned = cleanTextString(lines[j]);
          const words = cleaned.split(/\s+/).filter((w) => w.length >= 2 && !isNoiseOrLabel(w));
          if (words.length > 0) {
            result.anneAdi = words.slice(0, 2).join(" ");
            break;
          }
        }
        if (result.anneAdi) break;

        // 3. Önceki satıra bak
        if (i > 0) {
          const prev = cleanTextString(lines[i - 1]);
          if (prev.length >= 2 && !isNoiseOrLabel(prev)) {
            result.anneAdi = prev.split(/\s+/).slice(0, 2).join(" ");
            break;
          }
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
        // 1. Aynı satırda değer var mı? (Örn: "Baba Adı: MEDENİ")
        const sameLineVal = line.replace(/.*(?:BABA\s*ADI|FATHER'?S?\s*NAME)[:\s\/-]*/i, "").trim();
        const cleanSame = cleanTextString(sameLineVal);
        if (cleanSame.length >= 2 && !isNoiseOrLabel(cleanSame)) {
          result.babaAdi = cleanSame.split(/\s+/).slice(0, 2).join(" ");
          break;
        }
        // 2. Takip eden satırlara bak
        for (let j = i + 1; j <= Math.min(i + 3, lines.length - 1); j++) {
          const cleaned = cleanTextString(lines[j]);
          const words = cleaned.split(/\s+/).filter((w) => w.length >= 2 && !isNoiseOrLabel(w));
          if (words.length > 0) {
            result.babaAdi = words.slice(0, 2).join(" ");
            break;
          }
        }
        if (result.babaAdi) break;

        // 3. Önceki satıra bak
        if (i > 0) {
          const prev = cleanTextString(lines[i - 1]);
          if (prev.length >= 2 && !isNoiseOrLabel(prev)) {
            result.babaAdi = prev.split(/\s+/).slice(0, 2).join(" ");
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
  if (result.belgeTuru === 2) {
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
  if (result.ad && result.soyad && !result.unvan) {
    result.unvan = `${result.ad} ${result.soyad}`.trim();
  }

  if (!result.ulke) {
    result.ulke = "Türkiye";
    if (!result.uyruk) result.uyruk = "T.C. / TUR";
  }

  return result;
}
