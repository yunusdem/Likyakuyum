import { WsIstemci } from "./wsIstemci.js";
import { logger } from "../utils/logger.js";
export const TARAYICI_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";
/** "48.9660", 48.966 → 48.966. Sıfır ve boş → null (kaynaklar fiyatı olmayan sembolü 0 gönderiyor). */
export const sayi = (v) => {
    if (v === null || v === undefined || v === "")
        return null;
    const n = typeof v === "number" ? v : Number(String(v).trim());
    return Number.isFinite(n) && n !== 0 ? n : null;
};
/** Türkçe biçim: "6.537.659", "48,951", "$4.173,61", "%-0,20" → sayı */
export const sayiTR = (v) => {
    if (v === null || v === undefined)
        return null;
    const s = String(v).replace(/[^\d,.\-]/g, "").replace(/\./g, "").replace(",", ".");
    return s ? sayi(s) : null;
};
/** Metindeki ondalık hane sayısı: "48.9660" → 4, "6.570,51" (TR) → 2 */
export const ondalikSay = (v, tr = false) => {
    const s = String(v ?? "").trim();
    const ayrac = tr ? "," : ".";
    const i = s.lastIndexOf(ayrac);
    return i < 0 ? 0 : s.length - i - 1;
};
export const SAAT = (d = new Date()) => d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Europe/Istanbul" });
/** Platin / paladyum hiçbir kaynakta gösterilmez (kullanıcı kararı). */
export const haricMi = (...metinler) => metinler.some((m) => /PLATIN|PLATİN|PALADYUM|XPT|XPD/i.test(m ?? ""));
export const getir = async (adres, secenek = {}) => {
    const { zamanAsimiMs = 8000, headers, ...kalan } = secenek;
    const yanit = await fetch(adres, {
        ...kalan,
        headers: { "User-Agent": TARAYICI_UA, "Accept-Language": "tr-TR,tr;q=0.9", ...headers },
        signal: AbortSignal.timeout(zamanAsimiMs),
    });
    if (!yanit.ok)
        throw new Error(`HTTP ${yanit.status}`);
    return yanit;
};
/** Boş satırları ve boş grupları atar. */
export const temizle = (gruplar) => gruplar
    .map((g) => ({
    ...g,
    satirlar: g.satirlar.filter((s) => s.alis !== null || s.satis !== null),
}))
    .filter((g) => g.satirlar.length > 0);
/** Kaynakların ortak durumu: son veri, hata, kopukluk. */
export class TabanKaynak {
    gruplar = [];
    sonGuncelleme = null;
    sonHata = null;
    calisiyor = false;
    /** Bu süreden eski veri "kopuk" sayılır */
    eskimeMs = 90_000;
    veriGeldi(gruplar) {
        const temiz = temizle(gruplar);
        if (!temiz.length)
            return;
        this.gruplar = temiz;
        this.sonGuncelleme = new Date();
        this.sonHata = null;
    }
    hataOldu(mesaj) {
        if (this.sonHata !== mesaj)
            logger.warn(`[piyasa:${this.kod}] ${mesaj}`);
        this.sonHata = mesaj;
    }
    anlik() {
        const yas = this.sonGuncelleme ? Date.now() - this.sonGuncelleme.getTime() : Infinity;
        const durum = !this.sonGuncelleme
            ? this.sonHata
                ? "kopuk"
                : "bekliyor"
            : yas > this.eskimeMs
                ? "kopuk"
                : "canli";
        return {
            kod: this.kod,
            ad: this.ad,
            site: this.site,
            durum,
            sonGuncelleme: this.sonGuncelleme?.toISOString() ?? null,
            hata: durum === "canli" ? null : this.sonHata,
            gruplar: this.gruplar,
        };
    }
}
/** Belirli aralıkla HTTP'den çeken kaynak. Hata olursa bekleme artarak (en çok 30 sn) yeniden dener. */
export class CekmeliKaynak extends TabanKaynak {
    zamanlayici = null;
    ardisikHata = 0;
    baslat() {
        if (this.calisiyor)
            return;
        this.calisiyor = true;
        void this.tur();
    }
    durdur() {
        this.calisiyor = false;
        if (this.zamanlayici)
            clearTimeout(this.zamanlayici);
        this.zamanlayici = null;
    }
    async tur() {
        if (!this.calisiyor)
            return;
        try {
            this.veriGeldi(await this.cek());
            this.ardisikHata = 0;
        }
        catch (e) {
            this.ardisikHata++;
            this.hataOldu(e?.name === "TimeoutError" ? "Zaman aşımı" : e?.message || String(e));
        }
        if (!this.calisiyor)
            return;
        const bekle = this.ardisikHata ? Math.min(30_000, this.aralikMs * 2 ** this.ardisikHata) : this.aralikMs;
        this.zamanlayici = setTimeout(() => void this.tur(), bekle);
    }
}
/**
 * socket.io v4 (Engine.IO 4) istemcisi — yalnız websocket taşıması, varsayılan ad alanı.
 * Kopunca 1 sn'den başlayıp 30 sn'ye kadar artan beklemeyle yeniden bağlanır.
 */
export class SocketIoBaglanti {
    adres;
    basliklar;
    olaylar;
    ws = null;
    dinleyiciler = new Map();
    acik = false;
    deneme = 0;
    yenidenZamanlayici = null;
    nabizZamanlayici = null;
    nabizAraligi = 25_000;
    nabizSuresi = 20_000;
    constructor(adres, basliklar, olaylar) {
        this.adres = adres;
        this.basliklar = basliklar;
        this.olaylar = olaylar;
    }
    on(olay, fn) {
        this.dinleyiciler.set(olay, fn);
        return this;
    }
    baslat() {
        this.acik = true;
        this.baglan();
    }
    durdur() {
        this.acik = false;
        if (this.yenidenZamanlayici)
            clearTimeout(this.yenidenZamanlayici);
        if (this.nabizZamanlayici)
            clearTimeout(this.nabizZamanlayici);
        this.ws?.kapat();
        this.ws = null;
    }
    nabizBekle() {
        if (this.nabizZamanlayici)
            clearTimeout(this.nabizZamanlayici);
        this.nabizZamanlayici = setTimeout(() => {
            this.olaylar.hata("Sunucu nabzı kesildi");
            this.ws?.kapat(4000, "nabız yok");
        }, this.nabizAraligi + this.nabizSuresi);
    }
    baglan() {
        if (!this.acik)
            return;
        const ayrac = this.adres.includes("?") ? "&" : "?";
        const ws = new WsIstemci(`${this.adres}${ayrac}EIO=4&transport=websocket`, this.basliklar);
        this.ws = ws;
        ws.on("message", (m) => {
            const tip = m[0];
            if (tip === "0") {
                try {
                    const el = JSON.parse(m.slice(1));
                    this.nabizAraligi = el.pingInterval ?? this.nabizAraligi;
                    this.nabizSuresi = el.pingTimeout ?? this.nabizSuresi;
                }
                catch {
                    /* varsayılanlar kalır */
                }
                ws.gonder("40");
                this.nabizBekle();
            }
            else if (tip === "2") {
                ws.gonder("3");
                this.nabizBekle();
            }
            else if (m.startsWith("40")) {
                this.deneme = 0;
                this.olaylar.baglandi?.();
            }
            else if (m.startsWith("42")) {
                try {
                    const [olay, veri] = JSON.parse(m.slice(2));
                    this.dinleyiciler.get(olay)?.(veri);
                }
                catch (e) {
                    this.olaylar.hata(`Mesaj çözülemedi: ${e?.message}`);
                }
            }
            else if (m.startsWith("44")) {
                this.olaylar.hata(`Ad alanı reddedildi: ${m.slice(2, 200)}`);
            }
        });
        ws.on("error", (e) => this.olaylar.hata(e.message));
        ws.on("close", () => {
            if (this.nabizZamanlayici)
                clearTimeout(this.nabizZamanlayici);
            if (!this.acik || this.ws !== ws)
                return;
            const bekle = Math.min(30_000, 1000 * 2 ** this.deneme++);
            this.yenidenZamanlayici = setTimeout(() => this.baglan(), bekle);
        });
        ws.baglan();
    }
}
/** Ham WebSocket (socket.io değil) için aynı yeniden bağlanma davranışı. */
export class HamWsBaglanti {
    adres;
    basliklar;
    olaylar;
    sessizlikMs;
    ws = null;
    acik = false;
    deneme = 0;
    yenidenZamanlayici = null;
    sessizlikZamanlayici = null;
    constructor(adres, basliklar, olaylar, 
    /** Bu kadar süre mesaj gelmezse bağlantı yenilenir */
    sessizlikMs = 60_000) {
        this.adres = adres;
        this.basliklar = basliklar;
        this.olaylar = olaylar;
        this.sessizlikMs = sessizlikMs;
    }
    baslat() {
        this.acik = true;
        this.baglan();
    }
    durdur() {
        this.acik = false;
        if (this.yenidenZamanlayici)
            clearTimeout(this.yenidenZamanlayici);
        if (this.sessizlikZamanlayici)
            clearTimeout(this.sessizlikZamanlayici);
        this.ws?.kapat();
        this.ws = null;
    }
    sessizlikBekle() {
        if (this.sessizlikZamanlayici)
            clearTimeout(this.sessizlikZamanlayici);
        this.sessizlikZamanlayici = setTimeout(() => {
            this.olaylar.hata("Canlı veri kesildi");
            this.ws?.kapat(4000, "sessizlik");
        }, this.sessizlikMs);
    }
    baglan() {
        if (!this.acik)
            return;
        const ws = new WsIstemci(this.adres, this.basliklar);
        this.ws = ws;
        ws.on("open", () => {
            this.deneme = 0;
            this.sessizlikBekle();
            this.olaylar.acildi((m) => ws.gonder(m));
        });
        ws.on("message", (m) => {
            this.sessizlikBekle();
            this.olaylar.mesaj(m);
        });
        ws.on("error", (e) => this.olaylar.hata(e.message));
        ws.on("close", () => {
            if (this.sessizlikZamanlayici)
                clearTimeout(this.sessizlikZamanlayici);
            if (!this.acik || this.ws !== ws)
                return;
            const bekle = Math.min(30_000, 1000 * 2 ** this.deneme++);
            this.yenidenZamanlayici = setTimeout(() => this.baglan(), bekle);
        });
        ws.baglan();
    }
}
