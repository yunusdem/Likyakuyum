/**
 * Fiş dürbünü gelişmiş filtresi (docs/FIS_TARIH_VE_DURBUN_YOL_HARITASI.md D1–D4).
 * İstek sorgusundaki filtre alanlarını okur, her ekranın verdiği kolon haritasıyla parametreli SQL koşulu üretir.
 * Kolon ifadeleri yalnız kod içinden (sabit metin) gelir; kullanıcı değeri her zaman @DRB_* parametresidir.
 */
import sql from "mssql";

export interface FisDurbunFiltre {
  /** YYYY-MM-DD (dahil) */
  tarihBas?: string;
  /** YYYY-MM-DD (dahil) */
  tarihBit?: string;
  vezneId?: number;
  /** Para / ürün kimliği (fiş satırında geçen) */
  urunId?: number;
  /** Ürün adı / kodu metni (kimlik listesi olmayan ekranlar: ticari stok kartı) */
  urun?: string;
  /** Ekrana göre anlamı değişen tip değeri (sayı ya da sabit anahtar) */
  tip?: string;
  /** Cari kodu / ünvan / VKN metni */
  cari?: string;
  tutarMin?: number;
  tutarMax?: number;
  /** Belge / seri / fiş no metni */
  belgeNo?: string;
  /**
   * Dürbün "Tümü" (tarih sınırı yok, drbTum=1): koşul üretmez, yalnız isteğin dürbün isteği olduğunu bildirir; böylece
   * durbunFiltresiVar true olur, DURBUN_EN_FAZLA tavanı / en yeni kayıtlardan kesme uygulanır (ortak alan denetimi 19.11.2026, #36)
   */
  tumu?: boolean;
}

export interface FisDurbunKolonlari {
  /** Tarih kolonu ya da gün ifadesi (ör. "F.TARIH" veya "CAST(DATEADD(hour, 3, F.TARIH) AS date)") */
  tarih?: string;
  /** Vezne / kasa / banka hesabı kolonları; birden çoksa VEYA ile bağlanır (ör. alan / veren vezne) */
  vezne?: string[];
  /** Fiş satırında para / ürün arayan EXISTS ifadesi; içinde @DRB_URUN geçmeli */
  urunExists?: string;
  /** Doğrudan başlıktaki para kolonu (satır tablosu yoksa) */
  urunKolon?: string;
  /** Ürün metni EXISTS ifadesi; içinde @DRB_URUNM geçmeli */
  urunMetinExists?: string;
  /** Tip kolonu (tamsayı karşılaştırması) */
  tip?: string;
  /** Tip değeri → sabit SQL koşulu (türetilmiş tipler için; listede olmayan değer yok sayılır) */
  tipKosullari?: Record<string, string>;
  /** Cari metninin aranacağı kolonlar */
  cari?: string[];
  /** Tutar ifadesi */
  tutar?: string;
  /** Belge no metninin aranacağı kolonlar */
  belgeNo?: string[];
}

export interface DurbunParametre {
  ad: string;
  tur: "varchar10" | "int" | "nvarchar" | "decimal";
  deger: string | number;
}

export interface DurbunKosulSonucu {
  /** " AND (...) AND (...)" biçiminde, boşsa "" */
  sql: string;
  kosullar: string[];
  parametreler: DurbunParametre[];
}

const TARIH_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** YYYY-MM-DD ve gerçek bir takvim günü ise döner */
export function gecerliGun(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim().slice(0, 10);
  const m = TARIH_RE.exec(s);
  if (!m) return undefined;
  const y = Number(m[1]), a = Number(m[2]), g = Number(m[3]);
  const d = new Date(Date.UTC(y, a - 1, g));
  if (d.getUTCFullYear() !== y || d.getUTCMonth() !== a - 1 || d.getUTCDate() !== g) return undefined;
  if (y < 1900 || y > 2200) return undefined;
  return s;
}

/** YYYY-MM-DD gününe n gün ekler (takvim üzerinden, saat dilimsiz) */
export function gunEkle(gun: string, n: number): string {
  const [y, a, g] = gun.split("-").map(Number);
  return new Date(Date.UTC(y, a - 1, g + n)).toISOString().slice(0, 10);
}

function tamsayi(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

/**
 * "1.234,50" / "1234.5" / "1234,5" → 1234.5; "1.000" → 1000. Ön yüzün parseDecimal kuralıyla aynı (src/utils/numericInput.ts;
 * sunucuda o dosya yok, kural burada aynı sırayla yazıldı): nokta+virgül → sondaki ayraç ondalık; yalnız virgül → tekse ondalık,
 * çoksa binlik; yalnız nokta → çoksa binlik, tekse ve öncesi 1–3 hane (0 değil) + sonrası tam 3 hane ise binlik, değilse ondalık.
 * Önceden "1.000" 1 okunuyordu (ortak alan denetimi 19.11.2026, #52).
 */
export function tutarOku(v: unknown): number | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  const s = String(v).trim().replace(/\s/g, "");
  if (!s || !/^-?[\d.,]+$/.test(s) || !/\d/.test(s)) return undefined;
  let temiz: string;
  if (s.includes(",") && s.includes(".")) {
    temiz = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (s.includes(",")) {
    temiz = s.split(",").length > 2 ? s.replace(/,/g, "") : s.replace(",", ".");
  } else if (s.includes(".")) {
    const p = s.split(".");
    const binlik = p.length > 2 || (p[0].length >= 1 && p[0].length <= 3 && p[0] !== "0" && p[1].length === 3);
    temiz = binlik ? s.replace(/\./g, "") : s;
  } else {
    temiz = s;
  }
  const n = parseFloat(temiz);
  return Number.isFinite(n) ? n : undefined;
}

function metin(v: unknown, enUzun = 100): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  return s ? s.slice(0, enUzun) : undefined;
}

/**
 * İstek sorgusundan filtre alanlarını okur (geçersiz değerler yok sayılır). Ekranların eski parametreleriyle (vezneId, tip,
 * baslangic…) çakışmasın diye hepsi drb öneklidir: drbBas, drbBit, drbVezne, drbUrunId, drbUrun, drbTip, drbCari,
 * drbTutarMin, drbTutarMax, drbBelge, drbTum ("Tümü" işareti).
 */
export function fisDurbunFiltresiOku(q: Record<string, unknown> | undefined | null): FisDurbunFiltre {
  const s = q || {};
  const f: FisDurbunFiltre = {};
  const bas = gecerliGun(s.drbBas);
  const bit = gecerliGun(s.drbBit);
  if (bas) f.tarihBas = bas;
  if (bit) f.tarihBit = bit;
  const vezne = tamsayi(s.drbVezne);
  if (vezne) f.vezneId = vezne;
  const urunId = tamsayi(s.drbUrunId);
  if (urunId) f.urunId = urunId;
  const urun = metin(s.drbUrun);
  if (urun) f.urun = urun;
  const tip = metin(s.drbTip, 20);
  if (tip !== undefined && /^[A-Za-z0-9_-]+$/.test(tip)) f.tip = tip;
  const cari = metin(s.drbCari);
  if (cari) f.cari = cari;
  const tmin = tutarOku(s.drbTutarMin);
  const tmax = tutarOku(s.drbTutarMax);
  if (tmin !== undefined) f.tutarMin = tmin;
  if (tmax !== undefined) f.tutarMax = tmax;
  const belge = metin(s.drbBelge, 60);
  if (belge) f.belgeNo = belge;
  // "Tümü": tarih yok ama dürbün isteği (ortak alan denetimi 19.11.2026, #36)
  if (s.drbTum === "1" || s.drbTum === 1 || s.drbTum === "true" || s.drbTum === true) f.tumu = true;
  return f;
}

/** Filtrede en az bir alan dolu mu (dürbün isteği mi); "Tümü" işareti (tumu) de sayılır */
export function durbunFiltresiVar(f: FisDurbunFiltre | undefined | null): boolean {
  return !!f && Object.values(f).some((v) => v !== undefined && v !== null && v !== "");
}

/** LIKE joker karakterlerini (%, _, [) düz karakter yapar */
export function likeKacis(s: string): string {
  return s.replace(/\[/g, "[[]").replace(/%/g, "[%]").replace(/_/g, "[_]");
}

/** Filtre + kolon haritası → parametreli koşullar. Haritada olmayan alan yok sayılır. */
export function fisDurbunKosullari(f: FisDurbunFiltre | undefined | null, k: FisDurbunKolonlari): DurbunKosulSonucu {
  const kosullar: string[] = [];
  const parametreler: DurbunParametre[] = [];
  if (!f) return { sql: "", kosullar, parametreler };

  if (k.tarih && f.tarihBas) {
    kosullar.push(`${k.tarih} >= CAST(@DRB_BAS AS date)`);
    parametreler.push({ ad: "DRB_BAS", tur: "varchar10", deger: f.tarihBas });
  }
  if (k.tarih && f.tarihBit) {
    kosullar.push(`${k.tarih} < DATEADD(day, 1, CAST(@DRB_BIT AS date))`);
    parametreler.push({ ad: "DRB_BIT", tur: "varchar10", deger: f.tarihBit });
  }
  if (k.vezne?.length && f.vezneId) {
    kosullar.push(k.vezne.length === 1 ? `${k.vezne[0]} = @DRB_VEZNE` : `(${k.vezne.map((c) => `${c} = @DRB_VEZNE`).join(" OR ")})`);
    parametreler.push({ ad: "DRB_VEZNE", tur: "int", deger: f.vezneId });
  }
  if (f.urunId && (k.urunExists || k.urunKolon)) {
    kosullar.push(k.urunExists ? k.urunExists : `${k.urunKolon} = @DRB_URUN`);
    parametreler.push({ ad: "DRB_URUN", tur: "int", deger: f.urunId });
  }
  if (f.urun && k.urunMetinExists) {
    kosullar.push(k.urunMetinExists);
    parametreler.push({ ad: "DRB_URUNM", tur: "nvarchar", deger: `%${likeKacis(f.urun)}%` });
  }
  if (f.tip !== undefined && f.tip !== "") {
    if (k.tipKosullari) {
      const kosul = Object.prototype.hasOwnProperty.call(k.tipKosullari, f.tip) ? k.tipKosullari[f.tip] : undefined;
      if (kosul) kosullar.push(kosul);
    } else if (k.tip && /^\d+$/.test(f.tip)) {
      kosullar.push(`${k.tip} = @DRB_TIP`);
      parametreler.push({ ad: "DRB_TIP", tur: "int", deger: Number(f.tip) });
    }
  }
  if (k.cari?.length && f.cari) {
    kosullar.push(`(${k.cari.map((c) => `${c} LIKE @DRB_CARI`).join(" OR ")})`);
    parametreler.push({ ad: "DRB_CARI", tur: "nvarchar", deger: `%${likeKacis(f.cari)}%` });
  }
  if (k.tutar && f.tutarMin !== undefined) {
    kosullar.push(`${k.tutar} >= @DRB_TMIN`);
    parametreler.push({ ad: "DRB_TMIN", tur: "decimal", deger: f.tutarMin });
  }
  if (k.tutar && f.tutarMax !== undefined) {
    kosullar.push(`${k.tutar} <= @DRB_TMAX`);
    parametreler.push({ ad: "DRB_TMAX", tur: "decimal", deger: f.tutarMax });
  }
  if (k.belgeNo?.length && f.belgeNo) {
    kosullar.push(`(${k.belgeNo.map((c) => `${c} LIKE @DRB_BELGE`).join(" OR ")})`);
    parametreler.push({ ad: "DRB_BELGE", tur: "nvarchar", deger: `%${likeKacis(f.belgeNo)}%` });
  }
  return { sql: kosullar.length ? " AND " + kosullar.join(" AND ") : "", kosullar, parametreler };
}

/** Üretilen parametreleri mssql isteğine bağlar */
export function durbunParametreleriniBagla(req: sql.Request, parametreler: DurbunParametre[]): void {
  for (const p of parametreler) {
    if (p.tur === "varchar10") req.input(p.ad, sql.VarChar(10), p.deger);
    else if (p.tur === "int") req.input(p.ad, sql.Int, p.deger);
    else if (p.tur === "decimal") req.input(p.ad, sql.Decimal(19, 4), p.deger);
    else req.input(p.ad, sql.NVarChar(210), p.deger);
  }
}

/** Dürbün isteğinde dönen satır sınırı (sınıra takılınca ön yüz "daraltın" der; +1 ile istenir) */
export const DURBUN_EN_FAZLA = 1001;

/** İstekteki limit; dürbün filtresi varsa tavan DURBUN_EN_FAZLA, yoksa ekranın eski tavanı */
export function durbunLimiti(istenen: unknown, varsayilan: number, eskiTavan: number, filtreVar: boolean): number {
  const n = Math.trunc(Number(istenen));
  const tavan = filtreVar ? Math.max(eskiTavan, DURBUN_EN_FAZLA) : eskiTavan;
  if (!Number.isFinite(n) || n <= 0) return Math.min(varsayilan, tavan);
  return Math.min(n, tavan);
}

/**
 * Bellekteki kayıtlar için aynı filtre (birleşik kaynaklı listeler: cari hareket, banka fiş satırları).
 * Erişim fonksiyonu verilmeyen alan yok sayılır.
 */
export interface BellekErisimi<T> {
  tarih?: (x: T) => string | null | undefined;
  vezne?: (x: T) => Array<number | null | undefined>;
  urunler?: (x: T) => Array<number | null | undefined>;
  tip?: (x: T) => string | number | null | undefined;
  cari?: (x: T) => Array<string | null | undefined>;
  tutarlar?: (x: T) => number[];
  belgeNo?: (x: T) => Array<string | number | null | undefined>;
}

const kucuk = (s: unknown) => String(s ?? "").toLocaleLowerCase("tr-TR");

/**
 * Kaydın günü. Eski fiş tabloları TARIH'i yerel duvar saatiyle tutar; sürücü (useUTC) bunu UTC sayıp okuduğu için
 * toISOString()'in ilk 10 karakteri kaydın kendi günüdür (+3 saat eklenmez). Erişim fonksiyonu gerekirse günü kendisi verir.
 */
export function kayitGunu(v: string | null | undefined): string {
  return v ? String(v).slice(0, 10) : "";
}

export function bellekteSuz<T>(liste: T[], f: FisDurbunFiltre | undefined | null, e: BellekErisimi<T>): T[] {
  if (!f || !durbunFiltresiVar(f)) return liste;
  return liste.filter((x) => {
    if (e.tarih && (f.tarihBas || f.tarihBit)) {
      const g = kayitGunu(e.tarih(x));
      if (f.tarihBas && g < f.tarihBas) return false;
      if (f.tarihBit && g > f.tarihBit) return false;
    }
    if (e.vezne && f.vezneId && !e.vezne(x).some((v) => Number(v) === f.vezneId)) return false;
    if (e.urunler && f.urunId && !e.urunler(x).some((v) => Number(v) === f.urunId)) return false;
    if (e.tip && f.tip !== undefined && f.tip !== "" && String(e.tip(x)) !== f.tip) return false;
    if (e.cari && f.cari) {
      const a = kucuk(f.cari);
      if (!e.cari(x).some((c) => kucuk(c).includes(a))) return false;
    }
    if (e.tutarlar && (f.tutarMin !== undefined || f.tutarMax !== undefined)) {
      const ok = e.tutarlar(x).some((t) => (f.tutarMin === undefined || t >= f.tutarMin) && (f.tutarMax === undefined || t <= f.tutarMax));
      if (!ok) return false;
    }
    if (e.belgeNo && f.belgeNo) {
      const a = kucuk(f.belgeNo);
      if (!e.belgeNo(x).some((b) => kucuk(b).includes(a))) return false;
    }
    return true;
  });
}
