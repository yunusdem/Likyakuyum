import { assertAllowedServiceUrl } from "./ice.client.js";
import { logger } from "../../utils/logger.js";

/**
 * e-Döviz gövde sürümü seçimi (docs/EDOVIZ_SURUM2_YOL_HARITASI.md K1).
 *
 * ICE, GİB'in e-Döviz paketi v1.3'ü (30.11.2026) için `send_edoviz_basic` gövdesini AYNI ad altında değiştirdi
 * (TEST sunucusu 20.11.2026'da yeni yapıda, CANLI eski yapıda). Yanlış gövde sessizce bozulur: .NET eksik zorunlu
 * alanı varsayılanla doldurur, tanımadığı alanı atar. Bu yüzden hangi gövdenin gideceğine firmanın bağlı olduğu
 * ICE adresinin kendi tanımı (WSDL) karar verir:
 *
 * 1. `EDOVIZ_SURUM=1|2` ortam değişkeni (acil durum anahtarı) varsa o;
 * 2. WSDL'de `Odeme_Bilgileri` içinde `Musteri_Odeme_Yontemi` varsa 2, `Odeme_Yontemi` varsa 1;
 * 3. WSDL okunamazsa tarih: 30.11.2026 00:00 (TR) ve sonrası 2, öncesi 1.
 *
 * Sonuç adres başına önbellekte tutulur; ICE canlıyı güncellediğinde en geç önbellek süresi sonunda geçilir.
 */

export type EDovizSurum = 1 | 2;
export type EDovizSurumKaynagi = "ENV" | "WSDL" | "TARIH";
export interface EDovizSurumSonucu {
  surum: EDovizSurum;
  kaynak: EDovizSurumKaynagi;
}

/** GİB e-Döviz paketi v1.3'ün devreye girişi: 30.11.2026 00:00 Türkiye saati (UTC+3) */
export const EDOVIZ_SURUM2_BASLANGIC = Date.UTC(2026, 10, 29, 21, 0, 0);

const ONBELLEK_MS = 30 * 60_000;
/** WSDL okunamadığında yeniden denemeden önce beklenen süre (her gönderimde ağ beklemesin) */
const HATA_ONBELLEK_MS = 5 * 60_000;
const WSDL_ZAMAN_ASIMI_MS = 15_000;
const MAKS_WSDL_BAYT = 8 * 1024 * 1024;

/** WSDL metninden e-Döviz gövde sürümü; yapı tanınmazsa null. */
export const wsdlEDovizSurumu = (wsdl: string): EDovizSurum | null => {
  const m = String(wsdl || "").match(
    /<(?:[\w-]+:)?complexType\s+name="Odeme_Bilgileri"[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?complexType>/
  );
  if (!m) return null;
  if (/name="Musteri_Odeme_Yontemi"/.test(m[1])) return 2;
  if (/name="Odeme_Yontemi"/.test(m[1])) return 1;
  return null;
};

export const tarihEDovizSurumu = (simdi: number = Date.now()): EDovizSurum =>
  simdi >= EDOVIZ_SURUM2_BASLANGIC ? 2 : 1;

export const ortamEDovizSurumu = (deger: string | undefined = process.env.EDOVIZ_SURUM): EDovizSurum | null => {
  const d = String(deger ?? "").trim();
  return d === "1" ? 1 : d === "2" ? 2 : null;
};

export const wsdlAdresi = (servisUrl: string): string => {
  const url = assertAllowedServiceUrl(servisUrl);
  return `${url.origin}${url.pathname}?WSDL`;
};

type WsdlOkuyucu = (adres: string) => Promise<string>;

const wsdlOku: WsdlOkuyucu = async (adres) => {
  const controller = new AbortController();
  const zamanlayici = setTimeout(() => controller.abort(), WSDL_ZAMAN_ASIMI_MS);
  try {
    const cevap = await fetch(adres, { method: "GET", signal: controller.signal });
    if (!cevap.ok) throw new Error(`HTTP ${cevap.status}`);
    const uzunluk = Number(cevap.headers.get("content-length") || 0);
    if (uzunluk > MAKS_WSDL_BAYT) throw new Error("WSDL çok büyük");
    const metin = await cevap.text();
    if (metin.length > MAKS_WSDL_BAYT) throw new Error("WSDL çok büyük");
    return metin;
  } finally {
    clearTimeout(zamanlayici);
  }
};

interface OnbellekKaydi {
  surum: EDovizSurum | null;
  zaman: number;
}
const onbellek = new Map<string, OnbellekKaydi>();
const bekleyen = new Map<string, Promise<EDovizSurum | null>>();

/** Testler ve "ICE güncellendi, hemen geç" durumu için. */
export const edovizSurumOnbellekTemizle = (): void => {
  onbellek.clear();
  bekleyen.clear();
};

const wsdlSurumu = async (adres: string, okuyucu: WsdlOkuyucu, simdi: number): Promise<EDovizSurum | null> => {
  const kayit = onbellek.get(adres);
  if (kayit && simdi - kayit.zaman < (kayit.surum ? ONBELLEK_MS : HATA_ONBELLEK_MS)) return kayit.surum;
  const suren = bekleyen.get(adres);
  if (suren) return suren;
  const is = (async () => {
    let surum: EDovizSurum | null = null;
    try {
      surum = wsdlEDovizSurumu(await okuyucu(adres));
      if (!surum) logger.warn(`ICE WSDL'inde e-Döviz ödeme yapısı tanınmadı (${adres}); tarihe göre karar verilecek.`);
    } catch (e: any) {
      logger.warn(`ICE WSDL okunamadı (${adres}): ${e?.message || e}; e-Döviz sürümüne tarihe göre karar verilecek.`);
    }
    const onceki = onbellek.get(adres)?.surum;
    if (surum && onceki !== surum) logger.info(`e-Döviz sürüm ${surum} (WSDL) — ${adres}`);
    onbellek.set(adres, { surum, zaman: Date.now() });
    return surum;
  })();
  bekleyen.set(adres, is);
  try {
    return await is;
  } finally {
    bekleyen.delete(adres);
  }
};

/**
 * Firmanın ICE adresine gidecek e-Döviz gövde sürümü. Ağ hatası fırlatmaz: WSDL okunamazsa tarihe göre karar verir.
 * Geçersiz servis adresi ise (https/ICE alanı değil) zaten SOAP çağrısında da reddedileceği için hata fırlatır.
 */
export const edovizSurumu = async (
  servisUrl: string,
  secenek: { okuyucu?: WsdlOkuyucu; simdi?: number; ortam?: string } = {}
): Promise<EDovizSurumSonucu> => {
  const ortam = ortamEDovizSurumu("ortam" in secenek ? secenek.ortam : process.env.EDOVIZ_SURUM);
  if (ortam) return { surum: ortam, kaynak: "ENV" };
  const simdi = secenek.simdi ?? Date.now();
  const surum = await wsdlSurumu(wsdlAdresi(servisUrl), secenek.okuyucu ?? wsdlOku, simdi);
  return surum ? { surum, kaynak: "WSDL" } : { surum: tarihEDovizSurumu(simdi), kaynak: "TARIH" };
};
