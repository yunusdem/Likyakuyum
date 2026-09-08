import crypto from "crypto";
import ExcelJS from "exceljs";
import { MasakKayitDto, MasakListeKod } from "../models/masakSql.repository.js";
import { ApiError } from "./ApiError.js";
import { logger } from "./logger.js";

/**
 * MASAK Excel dosyalarının indirilmesi ve ayrıştırılması.
 *
 * Kaynak: T.C. Hazine ve Maliye Bakanlığı — ms.hmb.gov.tr
 * Dört listenin kolon seti birbirinden farklı olduğu için eşleme kolon sırasına göre değil
 * BAŞLIK METNİNE göre yapılır; eşlenemeyen kolonlar EK_BILGI içine JSON olarak yazılır.
 */

/** İndirmeye izin verilen tek adres öneki (SSRF önlemi) */
export const MASAK_IZINLI_ONEK = "https://ms.hmb.gov.tr/";

export interface MasakKaynakTanimi {
  listeKod: MasakListeKod;
  listeAdi: string;
  varsayilanUrl: string;
}

/**
 * Varsayılan kaynak adresleri. Kullanıcı ekrandan yeni adres girerse o kullanılır;
 * girilen adres TODVZ_MASAK_LISTE.KAYNAK_URL'de kalıcı olur (bkz. yol haritası 8.4).
 */
export const MASAK_KAYNAKLAR: Record<MasakListeKod, MasakKaynakTanimi> = {
  A: {
    listeKod: "A",
    listeAdi: "BMGK Kararına İstinaden Malvarlıkları Dondurulanlar (6415 S.K. m.5)",
    varsayilanUrl:
      "https://ms.hmb.gov.tr/uploads/sites/12/2026/08/A-BIRLESMIS-MILLETLER-GUVENLIK-KONSEYI-KARARINA-ISTINADEN-MALVARLIKLARI-DONDURULANLAR-6415-SAYILI-KANUN-5.-MADDE-27.08-40e72586a1281a0e.xlsx",
  },
  B: {
    listeKod: "B",
    listeAdi: "Yabancı Ülke Taleplerine İstinaden Malvarlıkları Dondurulanlar (6415 S.K. m.6)",
    varsayilanUrl:
      "https://ms.hmb.gov.tr/uploads/sites/12/2026/01/B-YABANCI-ULKE-TALEPLERINE-ISTINADEN-MALVARLIKLARI-DONDURULANLAR-6415-SAYILI-KANUN-6.-MADDE-0cb2484e46e910b1.xlsx",
  },
  C: {
    listeKod: "C",
    listeAdi: "İç Dondurma Kararı ile Malvarlıkları Dondurulanlar (6415 S.K. m.7)",
    varsayilanUrl:
      "https://ms.hmb.gov.tr/uploads/sites/12/2026/07/C-IC-DONDURMA-KARARI-ILE-MALVARLIKLARI-DONDURULANLAR-6415-SAYILI-KANUN-7.-MADDE-G-6e6f23b75ed73de9.xlsx",
  },
  "3AB": {
    listeKod: "3AB",
    listeAdi: "7262 Sayılı Kanun 3.A ve 3.B Maddeleri Kapsamında Dondurulanlar",
    varsayilanUrl:
      "https://ms.hmb.gov.tr/uploads/sites/12/2026/07/D-7262-SAYILI-KANUN-3.A-VE-3.B-MADDELERI-EXCEL-29.07.2026-7065dd0684b9962c.xlsx",
  },
};

/* ============================================================================
   Metin yardımcıları
   ========================================================================== */

const TR_HARF_ESLEME: Record<string, string> = {
  İ: "I",
  I: "I",
  Ş: "S",
  Ğ: "G",
  Ü: "U",
  Ö: "O",
  Ç: "C",
  Â: "A",
  Î: "I",
  Û: "U",
  Ê: "E",
};

/**
 * Arama ve karşılaştırma için metni normalize eder:
 * büyük harf (tr) → Türkçe/aksanlı harfler sadeleşir → noktalama boşluğa döner → tek boşluk.
 * Örn: "ABD AL-BASET AZZOUZ " → "ABD AL BASET AZZOUZ"
 */
export const normalizeMetin = (value?: string | null): string => {
  if (value === null || value === undefined) return "";

  let s = String(value).replace(/ /g, " ");
  s = s.toLocaleUpperCase("tr-TR");
  s = s.replace(/[İIŞĞÜÖÇÂÎÛÊ]/g, (ch) => TR_HARF_ESLEME[ch] ?? ch);
  // Latin aksanlarını ayır ve at (Arapça/Kiril harfleri korunur)
  s = s.normalize("NFD").replace(/[̀-ͯ]/g, "");
  // Harf ve rakam dışındaki her şey boşluk
  s = s.replace(/[^\p{L}\p{N} ]+/gu, " ");
  s = s.replace(/\s+/g, " ").trim();

  return s;
};

/** Boşlukları sadeleştirir ama metnin kendisini bozmaz (veritabanına yazılan hâli) */
const temizle = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const s = String(value)
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
  return s.length ? s : null;
};

/** T.C. kimlik numarası algoritma doğrulaması (pasaport/karar numaralarını elemek için) */
export const tcknGecerliMi = (value: string): boolean => {
  if (!/^[1-9]\d{10}$/.test(value)) return false;
  const d = value.split("").map(Number);
  const tek = d[0] + d[2] + d[4] + d[6] + d[8];
  const cift = d[1] + d[3] + d[5] + d[7];
  const onuncu = (tek * 7 - cift) % 10;
  if (onuncu !== d[9]) return false;
  const toplam = d.slice(0, 10).reduce((a, b) => a + b, 0);
  return toplam % 10 === d[10];
};

/** Serbest metin içinden geçerli TCKN'yi ayıklar */
export const tcknAyikla = (metin?: string | null): string | null => {
  if (!metin) return null;
  const adaylar = String(metin).match(/\d{11}/g);
  if (!adaylar) return null;
  for (const aday of adaylar) {
    if (tcknGecerliMi(aday)) return aday;
  }
  return null;
};

/** Serbest metin içinden VKN adayını ayıklar (TCKN bulunmadıysa) */
export const vknAyikla = (metin?: string | null): string | null => {
  if (!metin) return null;
  // Öncesinde/sonrasında başka rakam olmayan tam 10 haneli sayı
  const eslesme = String(metin).match(/(?<!\d)\d{10}(?!\d)/g);
  if (!eslesme) return null;
  return eslesme[0];
};

const TR_AYLAR: Record<string, number> = {
  OCAK: 1,
  SUBAT: 2,
  MART: 3,
  NISAN: 4,
  MAYIS: 5,
  HAZIRAN: 6,
  TEMMUZ: 7,
  AGUSTOS: 8,
  EYLUL: 9,
  EKIM: 10,
  KASIM: 11,
  ARALIK: 12,
};

/**
 * Serbest metin tarihi ayrıştırmayı dener. Ayrıştırılamazsa null döner
 * (ham metin her hâlükârda DOGUM_TARIHI kolonunda saklanır).
 * Desteklenen: 1978-06-05, 05.06.1978, 5/6/1978, "7 Şubat 1966"
 */
export const tarihAyikla = (deger: unknown): Date | null => {
  if (deger === null || deger === undefined) return null;
  if (deger instanceof Date && !isNaN(deger.getTime())) return deger;

  const ham = String(deger).trim();
  if (!ham) return null;

  const iso = ham.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const d = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
    return isNaN(d.getTime()) ? null : d;
  }

  const noktali = ham.match(/(?<!\d)(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})(?!\d)/);
  if (noktali) {
    const d = new Date(Date.UTC(Number(noktali[3]), Number(noktali[2]) - 1, Number(noktali[1])));
    return isNaN(d.getTime()) ? null : d;
  }

  const norm = normalizeMetin(ham);
  const yazili = norm.match(/(?<!\d)(\d{1,2}) ([A-Z]+) (\d{4})(?!\d)/);
  if (yazili && TR_AYLAR[yazili[2]]) {
    const d = new Date(Date.UTC(Number(yazili[3]), TR_AYLAR[yazili[2]] - 1, Number(yazili[1])));
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
};

const TUZEL_ISARETLERI = [
  "LTD",
  "STI",
  "A S",
  "AS ",
  "ANONIM",
  "SIRKET",
  "SIRKETI",
  "HOLDING",
  "GROUP",
  "GRUP",
  "COMPANY",
  "CORPORATION",
  "CORP",
  "INC",
  "LLC",
  "BANK",
  "BANKASI",
  "VAKF",
  "VAKFI",
  "DERNEK",
  "DERNEGI",
  "FOUNDATION",
  "ASSOCIATION",
  "ORGANIZATION",
  "ORGANIZASYON",
  "TRADING",
  "LIMITED",
  "TICARET",
  "KURULUS",
];

/** Kayıt tipi tahmini: TCKN varsa gerçek kişi, ünvanda tüzel kişilik işareti varsa tüzel */
const kayitTipiTahmin = (adNorm: string, tckn: string | null): "GERCEK" | "TUZEL" | null => {
  if (tckn) return "GERCEK";
  const ad = ` ${adNorm} `;
  if (TUZEL_ISARETLERI.some((isaret) => ad.includes(` ${isaret} `) || ad.includes(`${isaret} `))) {
    return "TUZEL";
  }
  return null;
};

/* ============================================================================
   İndirme
   ========================================================================== */

export interface IndirilenDosya {
  buffer: Buffer;
  hash: string;
  boyut: number;
}

/** Adresin izinli olup olmadığını kontrol eder (SSRF önlemi + yanlış link koruması) */
export const adresGecerliMi = (url?: string | null): boolean => {
  if (!url) return false;
  const u = url.trim();
  if (!u.toLowerCase().startsWith(MASAK_IZINLI_ONEK)) return false;
  return u.toLowerCase().endsWith(".xlsx") || u.toLowerCase().endsWith(".xls");
};

/**
 * MASAK Excel dosyasını indirir. Başarısızlıkta 3 kez dener.
 * Not: ms.hmb.gov.tr'nin HTML sayfaları bota kapalıdır (403) ancak /uploads altındaki
 * dosyalar açıktır; bu yüzden indirme sunucu tarafından yapılabiliyor.
 */
export const indirDosya = async (
  url: string,
  opts: { timeoutMs?: number; deneme?: number } = {}
): Promise<IndirilenDosya> => {
  if (!adresGecerliMi(url)) {
    throw ApiError.badRequest(
      "Geçersiz kaynak adresi. Yalnızca https://ms.hmb.gov.tr/ ile başlayan .xlsx adresleri kabul edilir."
    );
  }

  const timeoutMs = opts.timeoutMs ?? 60000;
  const toplamDeneme = opts.deneme ?? 3;
  let sonHata: unknown = null;

  for (let deneme = 1; deneme <= toplamDeneme; deneme++) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Accept:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,*/*",
        },
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        throw new Error(
          response.status === 404
            ? "Adrese ulaşılamadı (HTTP 404) — bağlantı değişmiş olabilir, MASAK sayfasındaki güncel adresi giriniz."
            : `Dosya indirilemedi (HTTP ${response.status}).`
        );
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length < 1024) {
        throw new Error("İndirilen dosya beklenenden küçük, geçerli bir Excel dosyası değil.");
      }
      // xlsx bir zip arşividir: 'PK' imzası
      if (!(buffer[0] === 0x50 && buffer[1] === 0x4b)) {
        throw new Error("İndirilen içerik Excel dosyası değil (muhtemelen bir hata sayfası döndü).");
      }

      return {
        buffer,
        hash: crypto.createHash("sha256").update(buffer).digest("hex"),
        boyut: buffer.length,
      };
    } catch (error: any) {
      sonHata = error;
      const mesaj = error?.message || String(error);
      logger.warn(`MASAK indirme denemesi ${deneme}/${toplamDeneme} başarısız: ${mesaj}`);
      if (deneme < toplamDeneme) {
        await new Promise((r) => setTimeout(r, 1000 * deneme));
      }
    }
  }

  const mesaj =
    (sonHata as any)?.name === "TimeoutError"
      ? "Dosya indirme zaman aşımına uğradı. İnternet bağlantınızı kontrol ediniz."
      : (sonHata as any)?.message || "Dosya indirilemedi.";
  throw ApiError.badRequest(mesaj);
};

/* ============================================================================
   Ayrıştırma
   ========================================================================== */

type HedefAlan =
  | "siraNo"
  | "adUnvan"
  | "kimlikNo"
  | "digerIsimler"
  | "orijinalAd"
  | "eskiAdi"
  | "gorevi"
  | "adres"
  | "uyruk"
  | "digerUyruk"
  | "yaptirimTuru"
  | "anneAdi"
  | "babaAdi"
  | "dogumTarihi"
  | "dogumYeri"
  | "orgut"
  | "kurulusYapisi"
  | "listeyeAlinma"
  | "kararBilgi"
  | "resmiGazete"
  | "digerBilgiler";

/**
 * Başlık eşleme sözlüğü. Sıra ÖNEMLİDİR: daha özel kalıp önce gelir
 * (ör. "TABİ OLDUĞU DİĞER UYRUK" → digerUyruk, "UYRUĞU" → uyruk).
 */
const BASLIK_ESLEME: { alan: HedefAlan; kalip: (b: string) => boolean }[] = [
  { alan: "siraNo", kalip: (b) => b === "SIRA NO" || b.startsWith("SIRA NO") },
  { alan: "digerUyruk", kalip: (b) => b.includes("TABI OLDUGU") },
  { alan: "digerIsimler", kalip: (b) => b.includes("DIGER ISIM") },
  { alan: "digerBilgiler", kalip: (b) => b.includes("DIGER BILGILER") },
  { alan: "orijinalAd", kalip: (b) => b.includes("ORIJINAL") },
  { alan: "eskiAdi", kalip: (b) => b.includes("ESKI ADI") },
  { alan: "kurulusYapisi", kalip: (b) => b.includes("KURULUS YAPISI") },
  { alan: "listeyeAlinma", kalip: (b) => b.includes("LISTEYE ALINMA") },
  { alan: "dogumTarihi", kalip: (b) => b.includes("DOGUM TARIHI") },
  { alan: "dogumYeri", kalip: (b) => b.includes("DOGUM YERI") },
  { alan: "anneAdi", kalip: (b) => b.includes("ANNE ADI") },
  { alan: "babaAdi", kalip: (b) => b.includes("BABA ADI") },
  { alan: "yaptirimTuru", kalip: (b) => b.includes("YAPTIRIM") },
  { alan: "resmiGazete", kalip: (b) => b.includes("GAZETE") },
  { alan: "kararBilgi", kalip: (b) => b.includes("KARAR") },
  { alan: "orgut", kalip: (b) => b.includes("ORGUT") },
  { alan: "gorevi", kalip: (b) => b.includes("GOREV") },
  { alan: "adres", kalip: (b) => b.includes("ADRES") },
  { alan: "uyruk", kalip: (b) => b.includes("UYRU") },
  {
    alan: "kimlikNo",
    kalip: (b) =>
      b.includes("TCKN") || b.includes("PASAPORT") || b.includes("KIMLIK NO") || b.includes("VKN"),
  },
  {
    alan: "adUnvan",
    kalip: (b) =>
      b.includes("AD SOYAD") ||
      b.includes("ADI SOYADI") ||
      b.includes("ORGANIZASYON ADI") ||
      b.includes("UNVANI") ||
      b.includes("UNVAN"),
  },
];

const baslikAlanBul = (baslik: string): HedefAlan | null => {
  const b = normalizeMetin(baslik);
  if (!b) return null;
  for (const { alan, kalip } of BASLIK_ESLEME) {
    if (kalip(b)) return alan;
  }
  return null;
};

/** ExcelJS hücresinden düz metin çıkarır (zengin metin, formül, köprü, tarih dahil) */
const hucreMetni = (deger: ExcelJS.CellValue): string | null => {
  if (deger === null || deger === undefined) return null;

  if (deger instanceof Date) {
    const y = deger.getFullYear();
    const a = String(deger.getMonth() + 1).padStart(2, "0");
    const g = String(deger.getDate()).padStart(2, "0");
    return `${y}-${a}-${g}`;
  }

  if (typeof deger === "object") {
    const nesne = deger as any;
    if (Array.isArray(nesne.richText)) {
      return temizle(nesne.richText.map((p: any) => p.text ?? "").join(""));
    }
    if (nesne.text !== undefined) return temizle(nesne.text);
    if (nesne.result !== undefined) return temizle(nesne.result);
    if (nesne.hyperlink !== undefined) return temizle(nesne.hyperlink);
    if (nesne.error !== undefined) return null;
    return temizle(String(nesne));
  }

  return temizle(deger);
};

/** Hücrenin ham değeri (tarih ayrıştırma için Date nesnesi korunur) */
const hucreHam = (deger: ExcelJS.CellValue): unknown => {
  if (deger && typeof deger === "object" && !(deger instanceof Date)) {
    const nesne = deger as any;
    if (nesne.result !== undefined) return nesne.result;
  }
  return deger;
};

export interface AyristirmaSonucu {
  kayitlar: MasakKayitDto[];
  baslikSatiri: number;
  eslesmeyenBasliklar: string[];
  atlananSatir: number;
}

/**
 * MASAK Excel dosyasını ayrıştırır.
 * - Başlık satırı ilk 12 satır içinde otomatik bulunur (A listesinde 2. satırdadır).
 * - Kolonlar başlık metnine göre eşlenir, eşlenemeyenler EK_BILGI'ye JSON olarak yazılır.
 * - Ad/ünvan kolonu boş olan satırlar atlanır (dosya sonundaki boş kuyruk satırları).
 */
export const parseMasakExcel = async (
  buffer: Buffer,
  listeKod: MasakListeKod,
  listeAdi?: string | null
): Promise<AyristirmaSonucu> => {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as any);
  } catch (error: any) {
    throw ApiError.badRequest(
      `Excel dosyası okunamadı: ${error?.message || "biçim tanınmadı"}. Adresin doğru dosyayı gösterdiğinden emin olunuz.`
    );
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw ApiError.badRequest("Excel dosyasında sayfa bulunamadı.");
  }

  // --- 1) Satırları düz metin matrisine çevir
  const satirlar: { metin: (string | null)[]; ham: unknown[] }[] = [];
  worksheet.eachRow({ includeEmpty: true }, (row) => {
    const metin: (string | null)[] = [];
    const ham: unknown[] = [];
    const kolonSayisi = Math.max(row.cellCount, worksheet.columnCount);
    for (let c = 1; c <= kolonSayisi; c++) {
      const cell = row.getCell(c);
      metin.push(hucreMetni(cell.value));
      ham.push(hucreHam(cell.value));
    }
    satirlar.push({ metin, ham });
  });

  if (satirlar.length === 0) {
    throw ApiError.badRequest("Excel dosyası boş.");
  }

  // --- 2) Başlık satırını bul
  // Puan = satırdaki FARKLI alan sayısı. "Farklı" olması şart: A listesinin 1. satırı
  // birleştirilmiş bir başlık hücresi (A1:P1) ve 16 hücrenin hepsi aynı metni döndürüyor;
  // hücre sayarsak sahte satır kazanıyor. Ayrıca ad/ünvan kolonu olan satır önceliklidir.
  let baslikIndex = -1;
  let enIyiSkor = 0;
  let enIyiAdVar = false;
  const taranacak = Math.min(12, satirlar.length);

  for (let i = 0; i < taranacak; i++) {
    const alanlar = new Set<HedefAlan>();
    for (const h of satirlar[i].metin) {
      if (!h) continue;
      const alan = baslikAlanBul(h);
      if (alan) alanlar.add(alan);
    }
    const skor = alanlar.size;
    const adVar = alanlar.has("adUnvan");

    // Ad/ünvan içeren satır her zaman içermeyene tercih edilir
    if ((adVar && !enIyiAdVar) || (adVar === enIyiAdVar && skor > enIyiSkor)) {
      enIyiSkor = skor;
      enIyiAdVar = adVar;
      baslikIndex = i;
    }
  }

  if (baslikIndex < 0 || enIyiSkor < 3) {
    throw ApiError.badRequest(
      "Excel dosyasında beklenen başlık satırı bulunamadı. Dosya biçimi değişmiş olabilir."
    );
  }

  // --- 3) Kolon eşlemesi
  const basliklar = satirlar[baslikIndex].metin;
  const alanKolon = new Map<HedefAlan, number>();
  const eslesmeyen: { index: number; baslik: string }[] = [];

  basliklar.forEach((baslik, index) => {
    if (!baslik) return;
    const alan = baslikAlanBul(baslik);
    if (alan && !alanKolon.has(alan)) {
      alanKolon.set(alan, index);
    } else {
      eslesmeyen.push({ index, baslik });
    }
  });

  const adKolon = alanKolon.get("adUnvan");
  if (adKolon === undefined) {
    throw ApiError.badRequest("Excel dosyasında ad/ünvan kolonu bulunamadı.");
  }

  // A listesinde sıra no kolonunun başlığı boştur → ad kolonundan önceki ilk kolonu kullan
  let siraKolon = alanKolon.get("siraNo");
  if (siraKolon === undefined && adKolon > 0) {
    siraKolon = 0;
  }

  const alanDeger = (satir: (string | null)[], alan: HedefAlan): string | null => {
    const idx = alanKolon.get(alan);
    if (idx === undefined) return null;
    return satir[idx] ?? null;
  };

  // --- 4) Satırları kayıtlara çevir
  const kayitlar: MasakKayitDto[] = [];
  let atlanan = 0;

  for (let i = baslikIndex + 1; i < satirlar.length; i++) {
    const satir = satirlar[i].metin;
    const adUnvan = satir[adKolon];

    if (!adUnvan || !adUnvan.trim()) {
      atlanan++;
      continue;
    }

    const kimlikNo = alanDeger(satir, "kimlikNo");
    const tckn = tcknAyikla(kimlikNo);
    const vkn = tckn ? null : vknAyikla(kimlikNo);
    const adNorm = normalizeMetin(adUnvan);
    const digerIsimler = alanDeger(satir, "digerIsimler");

    const dogumTarihiMetin = alanDeger(satir, "dogumTarihi");
    const dogumTarihiIdx = alanKolon.get("dogumTarihi");
    const dogumTarihiDt =
      dogumTarihiIdx !== undefined
        ? tarihAyikla(satirlar[i].ham[dogumTarihiIdx]) ?? tarihAyikla(dogumTarihiMetin)
        : null;

    let siraNo: number | null = null;
    if (siraKolon !== undefined) {
      const ham = satir[siraKolon];
      const sayi = ham ? parseInt(String(ham).replace(/\D/g, ""), 10) : NaN;
      siraNo = isNaN(sayi) ? null : sayi;
    }

    // Eşlenemeyen kolonlardaki dolu değerler kaybolmasın
    const ek: Record<string, string> = {};
    for (const { index, baslik } of eslesmeyen) {
      const deger = satir[index];
      if (deger && deger.trim()) {
        ek[baslik.replace(/\s+/g, " ").trim()] = deger;
      }
    }

    kayitlar.push({
      listeKod,
      listeAdi: listeAdi ?? MASAK_KAYNAKLAR[listeKod]?.listeAdi ?? null,
      siraNo,
      adUnvan,
      adUnvanNorm: adNorm,
      kayitTipi: kayitTipiTahmin(adNorm, tckn),
      kimlikNo,
      tckn,
      vkn,
      digerIsimler,
      digerIsimlerNorm: digerIsimler ? normalizeMetin(digerIsimler) : null,
      orijinalAd: alanDeger(satir, "orijinalAd"),
      eskiAdi: alanDeger(satir, "eskiAdi"),
      gorevi: alanDeger(satir, "gorevi"),
      adres: alanDeger(satir, "adres"),
      uyruk: alanDeger(satir, "uyruk"),
      digerUyruk: alanDeger(satir, "digerUyruk"),
      // 3AB (D) dosyasında "MVD YAPTIRIM TÜRÜ" kolonu yok; listenin kendisi yaptırım türünü belirtir
      yaptirimTuru:
        alanDeger(satir, "yaptirimTuru") ??
        (listeKod === "3AB" ? "7262 SAYILI KANUN 3.A/3.B KAPSAMINDA" : null),
      anneAdi: alanDeger(satir, "anneAdi"),
      babaAdi: alanDeger(satir, "babaAdi"),
      dogumTarihi: dogumTarihiMetin,
      dogumTarihiDt,
      dogumYeri: alanDeger(satir, "dogumYeri"),
      orgut: alanDeger(satir, "orgut"),
      kurulusYapisi: alanDeger(satir, "kurulusYapisi"),
      listeyeAlinma: alanDeger(satir, "listeyeAlinma"),
      kararBilgi: alanDeger(satir, "kararBilgi"),
      resmiGazete: alanDeger(satir, "resmiGazete"),
      digerBilgiler: alanDeger(satir, "digerBilgiler"),
      ekBilgi: Object.keys(ek).length ? JSON.stringify(ek) : null,
    });
  }

  if (kayitlar.length === 0) {
    throw ApiError.badRequest(
      "Excel dosyasında kayıt bulunamadı. Dosya biçimi değişmiş olabilir."
    );
  }

  return {
    kayitlar,
    baslikSatiri: baslikIndex + 1,
    eslesmeyenBasliklar: eslesmeyen.map((e) => e.baslik),
    atlananSatir: atlanan,
  };
};
