import { mkdirSync } from "node:fs";
import { readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.config.js";
import { BelgeSqlRepository } from "../models/belgeSql.repository.js";
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
export const KLASOR_TURLERI = ["Belgeler", "Raporlar", "eBelge", "Yazdirma", "Resimler", "Logolar", "Sablonlar"];
const ALT_KLASOR_AZAMI = 60;
/** "Belge Dizini" değeri geçerli bir alt klasör adı mı? Boş → ad yok; mutlak yol / ayraç / ".." → geçersiz. */
export function altKlasorAdiDenetle(deger) {
    const s = String(deger ?? "").trim();
    if (!s)
        return { ad: null, gecersiz: false };
    const gecerli = s.length <= ALT_KLASOR_AZAMI &&
        /^[\p{L}\p{N} _.-]+$/u.test(s) &&
        !/^\.+$/.test(s) &&
        !s.endsWith(".") &&
        !/^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i.test(s);
    return gecerli ? { ad: s, gecersiz: false } : { ad: null, gecersiz: true };
}
/** Veritabanı adından klasör adı (belgeArsiv ile aynı kural). */
export const dbKlasorAdi = (dbName) => (String(dbName || "").trim() || "varsayilan").replace(/[^A-Za-z0-9_-]/g, "_");
/** Bulutta bir firmanın (veritabanının) bütün klasörü — firma silmede taşınan yer. */
export const bulutFirmaYolu = (dbName, belgeKok = env.BELGE_KOK) => path.join(path.resolve(belgeKok), dbKlasorAdi(dbName));
/** Saf hesap: firmanın kök klasörü. */
export function firmaKokYolu(p) {
    const taban = p.kurulum ? path.join(path.resolve(p.kurulumKoku), "Belgeler") : bulutFirmaYolu(p.dbName || "", p.belgeKok);
    const alt = altKlasorAdiDenetle(p.altKlasor).ad;
    return alt ? path.join(taban, alt) : taban;
}
/** Parçaları köke ekler; sonuç kökün dışına çıkarsa hata. */
export function guvenliBirlestir(kok, ...parcalar) {
    const k = path.resolve(kok);
    const yol = path.resolve(k, ...parcalar.map((x) => String(x ?? "")));
    if (!icindeMi(k, yol))
        throw ApiError.badRequest("Dosya yolu firma klasörünün dışına çıkamaz.");
    return yol;
}
/** `yol` `kok`'ün kendisi ya da altında mı? (Windows'ta büyük/küçük harf duyarsız) */
export function icindeMi(kok, yol) {
    const norm = (x) => (process.platform === "win32" ? path.resolve(x).toLowerCase() : path.resolve(x));
    const rel = path.relative(norm(kok), norm(yol));
    return rel === "" || (!!rel && !rel.startsWith("..") && !path.isAbsolute(rel));
}
/** Dosya adını tek parça, güvenli hale getirir. */
export const guvenliDosyaAdi = (ad, yedek = "dosya") => {
    const s = String(ad ?? "")
        .replace(/[\\/:*?"<>|\x00-\x1f]/g, "_")
        .replace(/^\.+/, "")
        .trim()
        .slice(0, 150);
    return s || yedek;
};
// "Belge Dizini" her dosya yazımında veritabanından okunmasın (Firma Tanımı kaydedilince temizlenir).
const ONBELLEK_MS = 60_000;
const altKlasorOnbellek = new Map();
export function firmaKlasoruOnbellekTemizle(dbName) {
    if (dbName)
        altKlasorOnbellek.delete(dbKlasorAdi(dbName));
    else
        altKlasorOnbellek.clear();
}
async function belgeDiziniOku(ctx) {
    const anahtar = dbKlasorAdi(ctx?.dbName);
    const o = altKlasorOnbellek.get(anahtar);
    if (o && Date.now() - o.zaman < ONBELLEK_MS)
        return o.deger;
    const deger = await BelgeSqlRepository.firmaBelgeDizini(ctx);
    altKlasorOnbellek.set(anahtar, { deger, zaman: Date.now() });
    return deger;
}
/** İsteğin firmasının kök klasörü (oluşturmaz). */
export async function firmaKoku(ctx) {
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
export async function firmaKlasoru(ctx, tur, ...alt) {
    const { yol: kok } = await firmaKoku(ctx);
    const hedef = guvenliBirlestir(kok, tur, ...alt);
    try {
        mkdirSync(hedef, { recursive: true });
    }
    catch (e) {
        throw ApiError.badRequest(`Firma klasörü oluşturulamadı (${hedef}): ${e?.code || e?.message || e}. Klasör yazma iznini kontrol edin.`);
    }
    return hedef;
}
/** `20261011_154502` biçiminde zaman damgası (dosya adları için) */
export function zamanDamgasi(d = new Date()) {
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
/**
 * Çıktının kopyasını firma klasörüne `{tür}\{yıl}\{ay}\{ad}` olarak yazar. Kopya yan iştir: yazılamazsa uyarı
 * günlüğe düşer, asıl işlem (indirme, gönderim) durmaz. Yazılan yolu döner.
 */
export async function kopyaKaydet(ctx, tur, dosyaAdi, veri, tarih) {
    try {
        const klasor = await firmaKlasoru(ctx, tur, ...yilAy(tarih));
        const yol = guvenliBirlestir(klasor, guvenliDosyaAdi(dosyaAdi));
        await writeFile(yol, veri);
        return yol;
    }
    catch (e) {
        logger.warn(`Firma klasörü: ${tur} kopyası yazılamadı (${dosyaAdi}): ${e?.message || e}`);
        return null;
    }
}
/** İstemciden gelen göreli yol ("Belgeler/2026/10") → parçalar; boş parça, "." ve ".." atılmaz, reddedilir. */
export function goreliParcalar(goreli) {
    const parcalar = String(goreli ?? "").split(/[\\/]+/).filter(Boolean);
    if (parcalar.some((p) => p === "." || p === ".." || p.includes(":")))
        throw ApiError.badRequest("Klasör yolu geçersiz.");
    return parcalar;
}
/** Firma klasöründeki bir klasörün içeriği (klasörler önce, sonra ada göre). Klasör yoksa boş liste. */
export async function klasorListele(ctx, goreli) {
    const { yol: kok } = await firmaKoku(ctx);
    const hedef = guvenliBirlestir(kok, ...goreliParcalar(goreli));
    let girdiler;
    try {
        girdiler = await readdir(hedef, { withFileTypes: true });
    }
    catch (e) {
        if (e?.code === "ENOENT")
            return [];
        throw ApiError.badRequest(`Klasör okunamadı: ${e?.code || e?.message || e}`);
    }
    const ogeler = [];
    for (const g of girdiler) {
        if (g.name.startsWith(".") || (!g.isDirectory() && !g.isFile()))
            continue;
        try {
            const st = await stat(path.join(hedef, g.name));
            ogeler.push({ ad: g.name, klasor: g.isDirectory(), boyut: g.isDirectory() ? 0 : st.size, tarih: st.mtime.toISOString() });
        }
        catch {
            /* okunamayan öğe atlanır */
        }
    }
    return ogeler.sort((a, b) => Number(b.klasor) - Number(a.klasor) || a.ad.localeCompare(b.ad, "tr"));
}
/** İndirilecek dosyanın tam yolu (firma klasörünün içinde, var olan bir dosya olmalı). */
export async function firmaDosyasi(ctx, goreli) {
    const parcalar = goreliParcalar(goreli);
    if (!parcalar.length)
        throw ApiError.badRequest("Dosya yolu verilmelidir.");
    const { yol: kok } = await firmaKoku(ctx);
    const yol = guvenliBirlestir(kok, ...parcalar);
    try {
        if ((await stat(yol)).isFile())
            return yol;
    }
    catch {
        /* aşağıda bulunamadı */
    }
    throw ApiError.notFound("Dosya bulunamadı.");
}
/** Tarih → `yyyy`, `mm` alt klasörleri */
export function yilAy(tarih) {
    const d = tarih ? new Date(tarih) : new Date();
    const g = Number.isNaN(d.getTime()) ? new Date() : d;
    return [String(g.getFullYear()), String(g.getMonth() + 1).padStart(2, "0")];
}
