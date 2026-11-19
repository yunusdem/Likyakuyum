import { CekmeliKaynak, getir, sayi, haricMi } from "../yardimci.js";
const ADRES = "https://didimmerkezdoviz.com/feed/kurlar.json";
/** Sitedeki `g` → pano grubu. Sıra ekrandaki sıra; tanımadığımız grup "Diğer" altında sona gelir. */
const GRUPLAR = [
    { g: "doviz", kod: "doviz", baslik: "Döviz" },
    { g: "altin", kod: "altin", baslik: "Altın" },
    { g: "gumus", kod: "gumus", baslik: "Gümüş" },
];
const DIGER = { g: "", kod: "kulce", baslik: "Diğer" };
/** 1 gramlık, ölçüsüz (sarrafiye olmayan) altın satırı → ortak kod */
const AYAR_ORTAK = { 24: "GRAM", 22: "AYAR22", 18: "AYAR18", 14: "AYAR14" };
const ortakKod = (k, kod) => {
    if (k.g === "doviz")
        return /^[A-Z]{3}$/.test(kod) ? `${kod}TRY` : undefined;
    if (k.g === "altin" && k.gold && Number(k.gold.gram) === 1 && !k.gold.size)
        return AYAR_ORTAK[Number(k.gold.ayar)];
    return undefined;
};
const saat = (iso) => {
    const d = iso ? new Date(iso) : null;
    return d && !Number.isNaN(d.getTime())
        ? d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" })
        : null;
};
export class DidimKaynak extends CekmeliKaynak {
    kod = "didim";
    ad = "Didim Merkez Döviz";
    site = "didimmerkezdoviz.com";
    aralikMs = 2000;
    async cek() {
        const yanit = await getir(ADRES, {
            headers: { Referer: "https://didimmerkezdoviz.com/", Accept: "application/json", "Cache-Control": "no-cache" },
        });
        // JSON yerine sayfa (ör. Cloudflare doğrulaması) dönerse ham ayrıştırma hatası yerine anlaşılır mesaj
        const j = (await yanit.json().catch(() => null));
        if (!j || !Array.isArray(j.rates))
            throw new Error("Beklenmeyen yanıt");
        // Site yenileme aralığını kendi bildirir (en az 2 sn); ona uyulur
        this.aralikMs = Math.min(60, Math.max(2, Number(j.poll) || 2)) * 1000;
        const zaman = saat(j.updated_at);
        const gruplar = new Map();
        for (const t of [...GRUPLAR, DIGER])
            gruplar.set(t.g, { kod: t.kod, baslik: t.baslik, tur: "alis-satis", satirlar: [] });
        for (const k of j.rates) {
            const kod = typeof k?.c === "string" ? k.c.trim().toUpperCase() : "";
            const ad = k?.n?.tr?.trim() || k?.lb?.trim() || kod;
            if (!kod || haricMi(kod, ad))
                continue;
            const ok = ortakKod(k, kod);
            const altAd = k.g === "doviz" ? kod : k.gold?.ayar ? `${k.gold.ayar} ayar` : undefined;
            const satir = {
                kod,
                ad,
                ...(altAd ? { altAd } : {}),
                ...(ok ? { ortakKod: ok } : {}),
                alis: sayi(k.b),
                satis: sayi(k.s),
                ondalik: Number.isInteger(k.dec) && k.dec >= 0 ? k.dec : 2,
                degisim: typeof k.d === "number" && Number.isFinite(k.d) ? k.d : null,
                zaman,
            };
            (gruplar.get(k.g ?? "") ?? gruplar.get(DIGER.g)).satirlar.push(satir);
        }
        return [...gruplar.values()];
    }
}
