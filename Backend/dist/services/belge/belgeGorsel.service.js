import PDFDocument from "pdfkit";
import { BelgeGorselSqlRepository } from "../../models/belgeGorselSql.repository.js";
import { ApiError } from "../../utils/ApiError.js";
import { HttpStatus } from "../../constants/httpStatusCodes.js";
import { kopyaKaydet } from "../firmaKlasoru.js";
import { FIS_TURU_KODLARI, FIS_TURLERI } from "./belgeTurleri.js";
import { firmaGorselAnahtari } from "./sablonCekirdek.js";
import { etkinSablon } from "./sablonDeposu.js";
/**
 * Firmanın logo ve imza / kaşe görselleri (docs/FIS_TASARIM_YOL_HARITASI.md, 4.3).
 * PNG / JPG, en çok 1 MB; tür dosyanın baytlarından anlaşılır (uzantıya / bildirilen türe bakılmaz) ve görsel
 * pdfkit ile açılabilmelidir. Şablon görsele adıyla bağlanır; silinen görsel fişte boş kalır, fiş bozulmaz.
 */
export const GORSEL_AZAMI_BAYT = 1024 * 1024;
export const GORSEL_SAYISI_AZAMI = 30;
const AD_DESENI = /^[\p{L}\p{N}][\p{L}\p{N} _.-]{0,39}$/u;
export function gorselAdiDenetle(ad) {
    const a = String(ad ?? "").trim().replace(/\s+/g, " ");
    if (!AD_DESENI.test(a))
        throw ApiError.badRequest("Görsel adı 1–40 karakter olmalı; harf, rakam, boşluk, nokta, tire ve alt çizgi kullanılabilir.");
    return a;
}
/** data URL ya da düz base64 → bayt + gerçek tür. Geçersizse anlaşılır hata. */
export function gorselCoz(girdi) {
    const m = /^data:[^;,]*;base64,(.*)$/s.exec(String(girdi ?? ""));
    const b64 = (m ? m[1] : String(girdi ?? "")).replace(/\s+/g, "");
    if (!b64 || !/^[A-Za-z0-9+/]+=*$/.test(b64))
        throw ApiError.badRequest("Görsel verisi okunamadı (base64 bekleniyor).");
    const veri = Buffer.from(b64, "base64");
    if (veri.length === 0)
        throw ApiError.badRequest("Görsel boş.");
    if (veri.length > GORSEL_AZAMI_BAYT)
        throw ApiError.badRequest(`Görsel çok büyük (en çok ${GORSEL_AZAMI_BAYT / 1024 / 1024} MB).`);
    const png = veri.length > 8 && veri.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const jpg = veri.length > 3 && veri[0] === 0xff && veri[1] === 0xd8 && veri[2] === 0xff;
    if (!png && !jpg)
        throw ApiError.badRequest("Yalnızca PNG ve JPG görseller kabul edilir (dosya içeriği bunlardan biri değil).");
    let genislik = 0, yukseklik = 0;
    try {
        const resim = new PDFDocument({ autoFirstPage: false }).openImage(veri);
        genislik = Number(resim.width);
        yukseklik = Number(resim.height);
    }
    catch (e) {
        throw ApiError.badRequest(`Görsel bozuk ya da desteklenmeyen biçimde: ${e?.message || e}`);
    }
    if (!(genislik > 0 && yukseklik > 0) || genislik > 8000 || yukseklik > 8000)
        throw ApiError.badRequest("Görsel ölçüsü geçersiz (en çok 8000 × 8000 piksel).");
    return { veri, mime: png ? "image/png" : "image/jpeg", genislik, yukseklik };
}
const dataUrl = (g) => (g.veri ? `data:${g.mime};base64,${g.veri.toString("base64")}` : "");
/** Şablondaki logo / imza öğelerinin görsel adları */
export function sablonGorselAdlari(sablon) {
    return [...new Set(sablon.ogeler.filter(o => (o.tip === "logo" || o.tip === "imza") && typeof o.gorsel === "string").map(o => String(o.gorsel)))];
}
export class BelgeGorselService {
    static async listele(ctx) {
        const [gorseller, kullanim] = await Promise.all([BelgeGorselSqlRepository.listele(true, ctx), this.kullanim(ctx)]);
        return gorseller.map(g => ({
            id: g.id, ad: g.ad, tur: g.tur, mime: g.mime, boyut: g.boyut, tarih: g.tarih, dataUrl: dataUrl(g),
            kullanildigiBelgeler: kullanim.get(g.ad.toLocaleLowerCase("tr-TR")) || [],
        }));
    }
    static async adlar(ctx) {
        return (await BelgeGorselSqlRepository.listele(false, ctx)).map(g => g.ad);
    }
    /** Görsel adı → onu kullanan belge türlerinin adları (firmanın etkin şablonlarında) */
    static async kullanim(ctx) {
        const harita = new Map();
        for (const tur of FIS_TURU_KODLARI) {
            const { sablon, kaynak } = await etkinSablon(tur, ctx);
            if (kaynak !== "FIRMA")
                continue;
            for (const ad of sablonGorselAdlari(sablon)) {
                const k = ad.toLocaleLowerCase("tr-TR");
                harita.set(k, [...(harita.get(k) || []), FIS_TURLERI[tur].ad]);
            }
        }
        return harita;
    }
    static async ekle(girdi, kullaniciId, ctx) {
        const ad = gorselAdiDenetle(girdi.ad);
        const tur = girdi.tur === "IMZA" ? "IMZA" : girdi.tur === "LOGO" ? "LOGO" : (() => { throw ApiError.badRequest("Tür LOGO ya da IMZA olmalı."); })();
        const g = gorselCoz(girdi.dataUrl);
        const mevcut = await BelgeGorselSqlRepository.listele(false, ctx);
        if (mevcut.length >= GORSEL_SAYISI_AZAMI)
            throw ApiError.badRequest(`En çok ${GORSEL_SAYISI_AZAMI} görsel yüklenebilir; kullanılmayanları silin.`);
        if (mevcut.some(m => m.ad.toLocaleLowerCase("tr-TR") === ad.toLocaleLowerCase("tr-TR")))
            throw ApiError.conflict(`"${ad}" adında bir görsel zaten var; başka bir ad verin.`);
        const id = await BelgeGorselSqlRepository.ekle({ ad, tur, mime: g.mime, veri: g.veri }, kullaniciId, ctx);
        // Kopya firma klasörüne (docs/FIRMA_OZEL_AYARLAR_YOL_HARITASI.md, K8); asıl kayıt veritabanında
        void kopyaKaydet(ctx, "Logolar", `belge_${id}_${ad}.${g.mime === "image/png" ? "png" : "jpg"}`, g.veri);
        return { id, ad, tur, mime: g.mime, boyut: g.veri.length, genislik: g.genislik, yukseklik: g.yukseklik };
    }
    /** Şablonlarda kullanılan görsel `zorla` olmadan silinmez (409 + kullanan belgeler). */
    static async sil(id, zorla, ctx) {
        const g = (await BelgeGorselSqlRepository.listele(false, ctx)).find(x => x.id === id);
        if (!g)
            throw ApiError.notFound("Görsel bulunamadı.");
        const kullanan = (await this.kullanim(ctx)).get(g.ad.toLocaleLowerCase("tr-TR")) || [];
        if (kullanan.length && !zorla) {
            throw new ApiError(HttpStatus.CONFLICT, `"${g.ad}" şu belgelerde kullanılıyor: ${kullanan.join(", ")}. Silinirse bu belgelerde boş kalır.`, { kod: "GORSEL_KULLANILIYOR", kullanan });
        }
        await BelgeGorselSqlRepository.sil(id, ctx);
        return { id, ad: g.ad, kullanan };
    }
    /** Şablonun firma görselleri: çizim anahtarı → data URL (HTML çizici). */
    static async harita(sablon, ctx) {
        const adlar = sablonGorselAdlari(sablon);
        if (!adlar.length)
            return {};
        const sonuc = {};
        const gorseller = await BelgeGorselSqlRepository.adlarla(adlar, ctx).catch(() => []);
        for (const ad of adlar) {
            const g = gorseller.find(x => x.ad.toLocaleLowerCase("tr-TR") === ad.toLocaleLowerCase("tr-TR"));
            if (g)
                sonuc[firmaGorselAnahtari(ad)] = dataUrl(g);
        }
        return sonuc;
    }
    /** PDF çizici için çözücü: firma görselleri önceden yüklenir, diğerleri belge klasöründen. */
    static async cozucu(sablon, yedek, ctx) {
        const h = await this.harita(sablon, ctx);
        return (dosya) => {
            const d = h[dosya];
            if (d)
                return Buffer.from(d.slice(d.indexOf(",") + 1), "base64");
            return dosya.startsWith("firma:") ? null : yedek(dosya);
        };
    }
}
