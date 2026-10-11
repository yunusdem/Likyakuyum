import { mkdirSync, type Dirent } from "node:fs";
import { readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.config.js";
import { BelgeSqlRepository, DbContext } from "../models/belgeSql.repository.js";
import { ApiError } from "../utils/ApiError.js";
import { logger } from "../utils/logger.js";
import { kurulumKoku } from "./kurulum/guncelleyici.js";

/**
 * Firmanın dosya klasörü (docs/FIRMA_OZEL_AYARLAR_YOL_HARITASI.md, K6–K8, K12).
 *
 * Kök: bulutta `BELGE_KOK\{dbName}`, kurulumda (exe) `{app}\Belgeler`. Firma Tanımı'ndaki "Belge Dizini"
 * (`TODVZ_TANIM.BELGE_DIZINI`) bu kökün altında bir alt klasör adıdır; mutlak yol ya da üst klasöre çıkış
 * kabul edilmez (K7). Firmanın yazdığı her dosya buradan üretilen yolun içinde kalır.
 */

export const KLASOR_TURLERI = ["Belgeler", "Raporlar", "eBelge", "Yazdirma", "Resimler", "Logolar"] as const;
export type KlasorTuru = (typeof KLASOR_TURLERI)[number];

const ALT_KLASOR_AZAMI = 60;

/** "Belge Dizini" değeri geçerli bir alt klasör adı mı? Boş → ad yok; mutlak yol / ayraç / ".." → geçersiz. */
export function altKlasorAdiDenetle(deger: string | null | undefined): { ad: string | null; gecersiz: boolean } {
  const s = String(deger ?? "").trim();
  if (!s) return { ad: null, gecersiz: false };
  const gecerli =
    s.length <= ALT_KLASOR_AZAMI &&
    /^[\p{L}\p{N} _.-]+$/u.test(s) &&
    !/^\.+$/.test(s) &&
    !s.endsWith(".") &&
    !/^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i.test(s);
  return gecerli ? { ad: s, gecersiz: false } : { ad: null, gecersiz: true };
}

/** Veritabanı adından klasör adı (belgeArsiv ile aynı kural). */
export const dbKlasorAdi = (dbName: string | null | undefined): string =>
  (String(dbName || "").trim() || "varsayilan").replace(/[^A-Za-z0-9_-]/g, "_");

/** Bulutta bir firmanın (veritabanının) bütün klasörü — firma silmede taşınan yer. */
export const bulutFirmaYolu = (dbName: string, belgeKok = env.BELGE_KOK): string =>
  path.join(path.resolve(belgeKok), dbKlasorAdi(dbName));

/** Saf hesap: firmanın kök klasörü. */
export function firmaKokYolu(p: {
  kurulum: boolean;
  dbName?: string | null;
  belgeKok: string;
  kurulumKoku: string;
  altKlasor?: string | null;
}): string {
  const taban = p.kurulum ? path.join(path.resolve(p.kurulumKoku), "Belgeler") : bulutFirmaYolu(p.dbName || "", p.belgeKok);
  const alt = altKlasorAdiDenetle(p.altKlasor).ad;
  return alt ? path.join(taban, alt) : taban;
}

/** Parçaları köke ekler; sonuç kökün dışına çıkarsa hata. */
export function guvenliBirlestir(kok: string, ...parcalar: string[]): string {
  const k = path.resolve(kok);
  const yol = path.resolve(k, ...parcalar.map((x) => String(x ?? "")));
  if (!icindeMi(k, yol)) throw ApiError.badRequest("Dosya yolu firma klasörünün dışına çıkamaz.");
  return yol;
}

/** `yol` `kok`'ün kendisi ya da altında mı? (Windows'ta büyük/küçük harf duyarsız) */
export function icindeMi(kok: string, yol: string): boolean {
  const norm = (x: string) => (process.platform === "win32" ? path.resolve(x).toLowerCase() : path.resolve(x));
  const rel = path.relative(norm(kok), norm(yol));
  return rel === "" || (!!rel && !rel.startsWith("..") && !path.isAbsolute(rel));
}

/** Dosya adını tek parça, güvenli hale getirir. */
export const guvenliDosyaAdi = (ad: string, yedek = "dosya"): string => {
  const s = String(ad ?? "")
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, "_")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 150);
  return s || yedek;
};

// "Belge Dizini" her dosya yazımında veritabanından okunmasın (Firma Tanımı kaydedilince temizlenir).
const ONBELLEK_MS = 60_000;
const altKlasorOnbellek = new Map<string, { deger: string | null; zaman: number }>();

export function firmaKlasoruOnbellekTemizle(dbName?: string | null): void {
  if (dbName) altKlasorOnbellek.delete(dbKlasorAdi(dbName));
  else altKlasorOnbellek.clear();
}

async function belgeDiziniOku(ctx?: DbContext): Promise<string | null> {
  const anahtar = dbKlasorAdi(ctx?.dbName);
  const o = altKlasorOnbellek.get(anahtar);
  if (o && Date.now() - o.zaman < ONBELLEK_MS) return o.deger;
  const deger = await BelgeSqlRepository.firmaBelgeDizini(ctx);
  altKlasorOnbellek.set(anahtar, { deger, zaman: Date.now() });
  return deger;
}

export interface FirmaKokBilgisi {
  yol: string;
  altKlasor: string | null;
  /** Firma Tanımı'ndaki değer alt klasör adı olarak geçersizse (eski mutlak yol vb.) yok sayıldı */
  uyari: string | null;
}

/** İsteğin firmasının kök klasörü (oluşturmaz). */
export async function firmaKoku(ctx?: DbContext): Promise<FirmaKokBilgisi> {
  const ham = await belgeDiziniOku(ctx);
  const d = altKlasorAdiDenetle(ham);
  const yol = firmaKokYolu({
    kurulum: env.KURULUM_MODU,
    dbName: ctx?.dbName,
    belgeKok: env.BELGE_KOK,
    kurulumKoku: kurulumKoku(),
    altKlasor: d.ad,
  });
  return {
    yol,
    altKlasor: d.ad,
    uyari: d.gecersiz ? `Firma Tanımı'ndaki Belge Dizini ("${ham}") alt klasör adı olmadığı için kullanılmadı.` : null,
  };
}

/** İsteğin firmasının ilgili klasörü; `alt` parçaları eklenir, klasör yoksa oluşturulur. */
export async function firmaKlasoru(ctx: DbContext | undefined, tur: KlasorTuru, ...alt: string[]): Promise<string> {
  const { yol: kok } = await firmaKoku(ctx);
  const hedef = guvenliBirlestir(kok, tur, ...alt);
  try {
    mkdirSync(hedef, { recursive: true });
  } catch (e: any) {
    throw ApiError.badRequest(`Firma klasörü oluşturulamadı (${hedef}): ${e?.code || e?.message || e}. Klasör yazma iznini kontrol edin.`);
  }
  return hedef;
}

/** `20261011_154502` biçiminde zaman damgası (dosya adları için) */
export function zamanDamgasi(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/**
 * Çıktının kopyasını firma klasörüne `{tür}\{yıl}\{ay}\{ad}` olarak yazar. Kopya yan iştir: yazılamazsa uyarı
 * günlüğe düşer, asıl işlem (indirme, gönderim) durmaz. Yazılan yolu döner.
 */
export async function kopyaKaydet(
  ctx: DbContext | undefined,
  tur: KlasorTuru,
  dosyaAdi: string,
  veri: Buffer | string,
  tarih?: string | Date | null
): Promise<string | null> {
  try {
    const klasor = await firmaKlasoru(ctx, tur, ...yilAy(tarih));
    const yol = guvenliBirlestir(klasor, guvenliDosyaAdi(dosyaAdi));
    await writeFile(yol, veri);
    return yol;
  } catch (e: any) {
    logger.warn(`Firma klasörü: ${tur} kopyası yazılamadı (${dosyaAdi}): ${e?.message || e}`);
    return null;
  }
}

export interface KlasorOgesi {
  ad: string;
  klasor: boolean;
  boyut: number;
  tarih: string;
}

/** İstemciden gelen göreli yol ("Belgeler/2026/10") → parçalar; boş parça, "." ve ".." atılmaz, reddedilir. */
export function goreliParcalar(goreli: string | null | undefined): string[] {
  const parcalar = String(goreli ?? "").split(/[\\/]+/).filter(Boolean);
  if (parcalar.some((p) => p === "." || p === ".." || p.includes(":"))) throw ApiError.badRequest("Klasör yolu geçersiz.");
  return parcalar;
}

/** Firma klasöründeki bir klasörün içeriği (klasörler önce, sonra ada göre). Klasör yoksa boş liste. */
export async function klasorListele(ctx: DbContext | undefined, goreli?: string | null): Promise<KlasorOgesi[]> {
  const { yol: kok } = await firmaKoku(ctx);
  const hedef = guvenliBirlestir(kok, ...goreliParcalar(goreli));
  let girdiler: Dirent[];
  try {
    girdiler = await readdir(hedef, { withFileTypes: true });
  } catch (e: any) {
    if (e?.code === "ENOENT") return [];
    throw ApiError.badRequest(`Klasör okunamadı: ${e?.code || e?.message || e}`);
  }
  const ogeler: KlasorOgesi[] = [];
  for (const g of girdiler) {
    if (g.name.startsWith(".") || (!g.isDirectory() && !g.isFile())) continue;
    try {
      const st = await stat(path.join(hedef, g.name));
      ogeler.push({ ad: g.name, klasor: g.isDirectory(), boyut: g.isDirectory() ? 0 : st.size, tarih: st.mtime.toISOString() });
    } catch {
      /* okunamayan öğe atlanır */
    }
  }
  return ogeler.sort((a, b) => Number(b.klasor) - Number(a.klasor) || a.ad.localeCompare(b.ad, "tr"));
}

/** İndirilecek dosyanın tam yolu (firma klasörünün içinde, var olan bir dosya olmalı). */
export async function firmaDosyasi(ctx: DbContext | undefined, goreli: string | null | undefined): Promise<string> {
  const parcalar = goreliParcalar(goreli);
  if (!parcalar.length) throw ApiError.badRequest("Dosya yolu verilmelidir.");
  const { yol: kok } = await firmaKoku(ctx);
  const yol = guvenliBirlestir(kok, ...parcalar);
  try {
    if ((await stat(yol)).isFile()) return yol;
  } catch {
    /* aşağıda bulunamadı */
  }
  throw ApiError.notFound("Dosya bulunamadı.");
}

/** Tarih → `yyyy`, `mm` alt klasörleri */
export function yilAy(tarih?: string | Date | null): [string, string] {
  const d = tarih ? new Date(tarih) : new Date();
  const g = Number.isNaN(d.getTime()) ? new Date() : d;
  return [String(g.getFullYear()), String(g.getMonth() + 1).padStart(2, "0")];
}
