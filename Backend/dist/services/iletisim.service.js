import { env } from "../config/env.config.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";
import { HttpStatus } from "../constants/httpStatusCodes.js";
import { mailGonder, mailYapilandirildiMi } from "./mail.service.js";
/**
 * Tanıtım sitesi iletişim / ön bilgi formu (docs/ILETISIM_FORMU_YOL_HARITASI.md).
 * Veritabanına yazılmaz (İ5): form içeriği info@likyakuyum.com'a (ILETISIM_ALICI) mail olarak gider,
 * e-posta yazan kişiye "talebiniz alındı" maili atılır (İ6).
 */
const PENCERE_MS = 10 * 60 * 1000;
const PENCEREDE_EN_FAZLA = 5;
// IP → gönderim zamanları (bellek içi; sunucu yeniden başlayınca sıfırlanır — İ8)
const gonderimler = new Map();
const hizSiniriKontrol = (ip) => {
    const simdi = Date.now();
    const liste = (gonderimler.get(ip) || []).filter((t) => simdi - t < PENCERE_MS);
    if (liste.length >= PENCEREDE_EN_FAZLA) {
        throw new ApiError(HttpStatus.TOO_MANY_REQUESTS, "Kısa sürede çok fazla gönderim yapıldı. Lütfen birkaç dakika sonra tekrar deneyin ya da bizi arayın.");
    }
    liste.push(simdi);
    gonderimler.set(ip, liste);
    // Harita büyümesin: eski IP'leri ara sıra temizle
    if (gonderimler.size > 5000) {
        for (const [k, v] of gonderimler)
            if (!v.some((t) => simdi - t < PENCERE_MS))
                gonderimler.delete(k);
    }
};
const htmlKacis = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const satir = (etiket, deger) => deger
    ? `<tr><td style="padding:6px 12px 6px 0;color:#6b7280;white-space:nowrap;vertical-align:top">${etiket}</td>` +
        `<td style="padding:6px 0;color:#111827">${htmlKacis(deger).replace(/\n/g, "<br>")}</td></tr>`
    : "";
const kaynakAdi = (k) => (k === "iletisim" ? "İletişim sayfası" : "Ana sayfa");
const tarihMetni = () => new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", dateStyle: "short", timeStyle: "short" });
/** Bize gelen mail: form içeriği. */
const bildirimMaili = (g, ip) => {
    const alanlar = [
        ["Ad Soyad", g.adSoyad],
        ["Firma / Mağaza", g.firma],
        ["Telefon", g.telefon],
        ["E-posta", g.eposta],
        ["Şehir", g.sehir],
        ["Mesaj", g.mesaj],
        ["Kaynak", kaynakAdi(g.kaynak)],
        ["Tarih", tarihMetni()],
        ["IP", ip],
    ];
    const metin = `Web sitesinden yeni bilgi talebi\n\n` +
        alanlar
            .filter(([, v]) => v)
            .map(([k, v]) => `${k}: ${v}`)
            .join("\n");
    const html = `<div style="font-family:Segoe UI,Arial,sans-serif;font-size:15px;color:#1f2937;max-width:600px">` +
        `<h2 style="font-size:18px;margin:0 0 12px">Web sitesinden yeni bilgi talebi</h2>` +
        `<table style="border-collapse:collapse;font-size:15px">${alanlar.map(([k, v]) => satir(k, v)).join("")}</table>` +
        (g.telefon
            ? `<p style="margin:20px 0 0"><a href="tel:${htmlKacis(g.telefon.replace(/\s/g, ""))}" ` +
                `style="background:#3b5d50;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;display:inline-block">Ara: ${htmlKacis(g.telefon)}</a></p>`
            : "") +
        `</div>`;
    return { konu: `Web sitesi bilgi talebi — ${g.adSoyad}${g.firma ? ` (${g.firma})` : ""}`, metin, html };
};
/** Formu dolduran kişiye giden otomatik cevap. */
const otomatikCevapMaili = (g) => {
    const ad = g.adSoyad;
    const metin = `Merhaba ${ad},\n\n` +
        `Likya Kuyum web sitesi üzerinden gönderdiğiniz bilgi talebi bize ulaştı. Ekibimiz en kısa sürede sizinle iletişime geçecek.\n\n` +
        `Acil bir konu için bizi arayabilir ya da WhatsApp'tan yazabilirsiniz: +90 532 673 26 22\n\n` +
        `Likya Kuyum\ninfo@likyakuyum.com`;
    const html = `<div style="font-family:Segoe UI,Arial,sans-serif;font-size:15px;color:#1f2937;max-width:520px">` +
        `<p>Merhaba <strong>${htmlKacis(ad)}</strong>,</p>` +
        `<p>Likya Kuyum web sitesi üzerinden gönderdiğiniz bilgi talebi bize ulaştı. Ekibimiz en kısa sürede sizinle iletişime geçecek.</p>` +
        `<p>Acil bir konu için bizi arayabilir ya da WhatsApp'tan yazabilirsiniz: ` +
        `<a href="tel:+905326732622" style="color:#3b5d50;font-weight:600">+90 532 673 26 22</a></p>` +
        `<p style="color:#6b7280;font-size:13px">Likya Kuyum · info@likyakuyum.com</p></div>`;
    return { konu: "Likya Kuyum — talebiniz alındı", metin, html };
};
export class IletisimService {
    static mailHazirMi() {
        return mailYapilandirildiMi();
    }
    static async formGonder(girdi, ip) {
        // Honeypot dolu → bot; sessizce "alındı" dön, mail atma (İ8)
        if (girdi.web) {
            logger.warn(`[ILETISIM] Honeypot dolu, gönderim yok sayıldı (${ip})`);
            return;
        }
        hizSiniriKontrol(ip);
        if (!mailYapilandirildiMi()) {
            logger.error(`[ILETISIM] Mail ayarı yok; form alınamadı (${girdi.adSoyad}, ${girdi.telefon})`);
            throw new ApiError(HttpStatus.SERVICE_UNAVAILABLE, "Form şu anda iletilemiyor. Lütfen bizi arayın ya da WhatsApp'tan yazın.");
        }
        const alici = env.ILETISIM_ALICI || "info@likyakuyum.com";
        await mailGonder({ kime: alici, ...bildirimMaili(girdi, ip) });
        logger.info(`[ILETISIM] Form maili gönderildi → ${alici} (${girdi.adSoyad}, ${kaynakAdi(girdi.kaynak)})`);
        // Otomatik cevap: başarısız olsa bile form başarılı sayılır (İ6)
        if (girdi.eposta) {
            try {
                await mailGonder({ kime: girdi.eposta, ...otomatikCevapMaili(girdi) });
            }
            catch (err) {
                logger.warn(`[ILETISIM] Otomatik cevap gönderilemedi (${girdi.eposta}): ${err?.message}`);
            }
        }
    }
}
