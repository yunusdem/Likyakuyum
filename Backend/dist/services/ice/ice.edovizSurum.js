import { assertAllowedServiceUrl } from "./ice.client.js";
import { logger } from "../../utils/logger.js";
/** GİB e-Döviz paketi v1.3'ün devreye girişi: 30.11.2026 00:00 Türkiye saati (UTC+3) */
export const EDOVIZ_SURUM2_BASLANGIC = Date.UTC(2026, 10, 29, 21, 0, 0);
const ONBELLEK_MS = 30 * 60_000;
/** WSDL okunamadığında yeniden denemeden önce beklenen süre (her gönderimde ağ beklemesin) */
const HATA_ONBELLEK_MS = 5 * 60_000;
const WSDL_ZAMAN_ASIMI_MS = 15_000;
const MAKS_WSDL_BAYT = 8 * 1024 * 1024;
/** WSDL metninden e-Döviz gövde sürümü; yapı tanınmazsa null. */
export const wsdlEDovizSurumu = (wsdl) => {
    const m = String(wsdl || "").match(/<(?:[\w-]+:)?complexType\s+name="Odeme_Bilgileri"[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?complexType>/);
    if (!m)
        return null;
    if (/name="Musteri_Odeme_Yontemi"/.test(m[1]))
        return 2;
    if (/name="Odeme_Yontemi"/.test(m[1]))
        return 1;
    return null;
};
export const tarihEDovizSurumu = (simdi = Date.now()) => simdi >= EDOVIZ_SURUM2_BASLANGIC ? 2 : 1;
export const ortamEDovizSurumu = (deger = process.env.EDOVIZ_SURUM) => {
    const d = String(deger ?? "").trim();
    return d === "1" ? 1 : d === "2" ? 2 : null;
};
export const wsdlAdresi = (servisUrl) => {
    const url = assertAllowedServiceUrl(servisUrl);
    return `${url.origin}${url.pathname}?WSDL`;
};
const wsdlOku = async (adres) => {
    const controller = new AbortController();
    const zamanlayici = setTimeout(() => controller.abort(), WSDL_ZAMAN_ASIMI_MS);
    try {
        const cevap = await fetch(adres, { method: "GET", signal: controller.signal });
        if (!cevap.ok)
            throw new Error(`HTTP ${cevap.status}`);
        const uzunluk = Number(cevap.headers.get("content-length") || 0);
        if (uzunluk > MAKS_WSDL_BAYT)
            throw new Error("WSDL çok büyük");
        const metin = await cevap.text();
        if (metin.length > MAKS_WSDL_BAYT)
            throw new Error("WSDL çok büyük");
        return metin;
    }
    finally {
        clearTimeout(zamanlayici);
    }
};
const onbellek = new Map();
const bekleyen = new Map();
/** Testler ve "ICE güncellendi, hemen geç" durumu için. */
export const edovizSurumOnbellekTemizle = () => {
    onbellek.clear();
    bekleyen.clear();
};
const wsdlSurumu = async (adres, okuyucu, simdi) => {
    const kayit = onbellek.get(adres);
    if (kayit && simdi - kayit.zaman < (kayit.surum ? ONBELLEK_MS : HATA_ONBELLEK_MS))
        return kayit.surum;
    const suren = bekleyen.get(adres);
    if (suren)
        return suren;
    const is = (async () => {
        let surum = null;
        try {
            surum = wsdlEDovizSurumu(await okuyucu(adres));
            if (!surum)
                logger.warn(`ICE WSDL'inde e-Döviz ödeme yapısı tanınmadı (${adres}); tarihe göre karar verilecek.`);
        }
        catch (e) {
            logger.warn(`ICE WSDL okunamadı (${adres}): ${e?.message || e}; e-Döviz sürümüne tarihe göre karar verilecek.`);
        }
        const onceki = onbellek.get(adres)?.surum;
        if (surum && onceki !== surum)
            logger.info(`e-Döviz sürüm ${surum} (WSDL) — ${adres}`);
        onbellek.set(adres, { surum, zaman: Date.now() });
        return surum;
    })();
    bekleyen.set(adres, is);
    try {
        return await is;
    }
    finally {
        bekleyen.delete(adres);
    }
};
/**
 * Firmanın ICE adresine gidecek e-Döviz gövde sürümü. Ağ hatası fırlatmaz: WSDL okunamazsa tarihe göre karar verir.
 * Geçersiz servis adresi ise (https/ICE alanı değil) zaten SOAP çağrısında da reddedileceği için hata fırlatır.
 */
export const edovizSurumu = async (servisUrl, secenek = {}) => {
    const ortam = ortamEDovizSurumu("ortam" in secenek ? secenek.ortam : process.env.EDOVIZ_SURUM);
    if (ortam)
        return { surum: ortam, kaynak: "ENV" };
    const simdi = secenek.simdi ?? Date.now();
    const surum = await wsdlSurumu(wsdlAdresi(servisUrl), secenek.okuyucu ?? wsdlOku, simdi);
    return surum ? { surum, kaynak: "WSDL" } : { surum: tarihEDovizSurumu(simdi), kaynak: "TARIH" };
};
