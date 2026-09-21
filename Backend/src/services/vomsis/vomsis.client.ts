import { env } from "../../config/env.config.js";
import { HttpStatus } from "../../constants/httpStatusCodes.js";
import { DbContext, EBankaSqlRepository, VomsisServis } from "../../models/ebankaSql.repository.js";
import { ApiError } from "../../utils/ApiError.js";
import { sifreCoz, sifrele } from "../../utils/kripto.utils.js";
import { logger } from "../../utils/logger.js";
import { SAHTE_TOKEN, sahteYanit } from "./vomsis.sahte.js";

/**
 * Vomsis API istemcisi (https://apiportal.vomsis.com).
 *  - banka: Hesap Hareketleri + POS Rapor → developers.vomsis.com/api/v2
 *  - vpos : Sanal POS                     → uygulama.vomsis.com/api/vpos/v3
 * Vomsis yalnızca kendi paneline tanımlı statik IP'lerden istek kabul eder; bu yüzden tüm çağrılar sunucudan yapılır.
 * Token 24 saat geçerlidir; firma veritabanında şifreli saklanır ve süresi dolmadan yeniden kullanılır.
 */

const SERVISLER: Record<VomsisServis, { taban: string; girisYolu: string }> = {
  banka: { taban: "https://developers.vomsis.com/api/v2", girisYolu: "/authenticate" },
  vpos: { taban: "https://uygulama.vomsis.com/api/vpos/v3", girisYolu: "/auth/token" },
};

const ZAMAN_ASIMI_MS = 30_000;
const TOKEN_OMRU_MS = 23 * 60 * 60 * 1000; // 24 saatlik tokenı 1 saat erken yenile
const MIN_ANAHTAR_UZUNLUGU = 32;

export interface VomsisIstek {
  metod?: "GET" | "POST" | "PUT" | "DELETE";
  sorgu?: Record<string, string | number | undefined | null>;
  govde?: unknown;
}

const sifrelemeHazirMi = (): boolean => env.ADMIN_DB_ENC_KEY.length >= MIN_ANAHTAR_UZUNLUGU;

/** app_secret ve token firma veritabanına düz metin yazılmaz. */
export const gizliSifrele = (duzMetin: string): string => {
  if (!sifrelemeHazirMi()) {
    throw ApiError.badRequest("Sunucuda şifreleme anahtarı tanımlı değil (ADMIN_DB_ENC_KEY, en az 32 karakter). API şifresi kaydedilemez.");
  }
  return sifrele(duzMetin);
};

const sorguMetni = (sorgu?: VomsisIstek["sorgu"]): string => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sorgu || {})) if (v !== undefined && v !== null && v !== "") p.append(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
};

const vomsisHatasi = (durum: number, govde: any): ApiError => {
  const mesaj = govde?.message || govde?.error || govde?.errors || "";
  const ek = typeof mesaj === "string" ? mesaj : JSON.stringify(mesaj);
  if (durum === 401 || durum === 403) {
    return new ApiError(
      HttpStatus.BAD_GATEWAY,
      `Vomsis isteği reddetti (${durum}). API anahtarı/şifresi hatalı olabilir ya da sunucunun IP adresi Vomsis panelindeki API uygulamasına tanımlı değildir.${ek ? ` Vomsis: ${ek}` : ""}`
    );
  }
  if (durum === 429) return new ApiError(HttpStatus.BAD_GATEWAY, "Vomsis çağrı sınırına takıldı (servisler 5 dakikada bir çağrılabilir). Biraz sonra yeniden deneyin.");
  return new ApiError(HttpStatus.BAD_GATEWAY, `Vomsis hata döndürdü (${durum}).${ek ? ` ${ek}` : ""}`);
};

const httpIstek = async (url: string, metod: string, token: string | null, govde?: unknown): Promise<{ durum: number; veri: any }> => {
  const kontrol = new AbortController();
  const zamanlayici = setTimeout(() => kontrol.abort(), ZAMAN_ASIMI_MS);
  try {
    const yanit = await fetch(url, {
      method: metod,
      headers: {
        Accept: "application/json",
        ...(govde !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: govde !== undefined ? JSON.stringify(govde) : undefined,
      signal: kontrol.signal,
    });
    const metin = await yanit.text();
    let veri: any = null;
    try {
      veri = metin ? JSON.parse(metin) : null;
    } catch {
      veri = { message: metin.slice(0, 300) };
    }
    return { durum: yanit.status, veri };
  } catch (err: any) {
    if (err?.name === "AbortError") throw new ApiError(HttpStatus.BAD_GATEWAY, "Vomsis yanıt vermedi (zaman aşımı).");
    throw new ApiError(HttpStatus.BAD_GATEWAY, `Vomsis'e ulaşılamadı: ${err?.message || err}`);
  } finally {
    clearTimeout(zamanlayici);
  }
};

export class VomsisClient {
  /** vpos için ayrı anahtar girilmemişse banka anahtarı kullanılır. */
  private static async kimlik(servis: VomsisServis, dbContext?: DbContext): Promise<{ appKey: string; appSecret: string }> {
    const ayar = await EBankaSqlRepository.ayarGetir(dbContext);
    const ayriVpos = servis === "vpos" && ayar?.vposAppKey;
    const appKey = ayriVpos ? ayar!.vposAppKey : ayar?.appKey;
    const sifreli = ayriVpos ? ayar!.vposAppSecretSifreli : ayar?.appSecretSifreli;
    if (!appKey || !sifreli) throw ApiError.badRequest("Vomsis API anahtarı tanımlı değil. F- e-Banka > Ayarlar ekranından girin.");
    const appSecret = sifreCoz(sifreli);
    if (!appSecret) throw ApiError.badRequest("Kayıtlı Vomsis API şifresi çözülemedi (sunucu şifreleme anahtarı değişmiş olabilir). Şifreyi yeniden girin.");
    return { appKey, appSecret };
  }

  private static async girisYap(servis: VomsisServis, dbContext?: DbContext): Promise<string> {
    const { appKey, appSecret } = await this.kimlik(servis, dbContext);
    const s = SERVISLER[servis];
    const { durum, veri } = await httpIstek(`${s.taban}${s.girisYolu}`, "POST", null, { app_key: appKey, app_secret: appSecret });
    if (durum >= 400 || !veri?.token) throw vomsisHatasi(durum >= 400 ? durum : 401, veri);
    const token = String(veri.token);
    await EBankaSqlRepository.tokenYaz(servis, gizliSifrele(token), new Date(Date.now() + TOKEN_OMRU_MS), dbContext);
    return token;
  }

  private static async token(servis: VomsisServis, dbContext?: DbContext): Promise<string> {
    const kayit = await EBankaSqlRepository.tokenGetir(servis, dbContext);
    if (kayit && kayit.bitis.getTime() > Date.now()) {
      const t = sifreCoz(kayit.sifreli);
      if (t) return t;
    }
    return this.girisYap(servis, dbContext);
  }

  public static async istek<T = any>(servis: VomsisServis, yol: string, secenek: VomsisIstek = {}, dbContext?: DbContext): Promise<T> {
    const metod = secenek.metod || "GET";
    const ayar = await EBankaSqlRepository.ayarGetir(dbContext);

    if (!ayar || ayar.mod === "sahte") {
      const yanit = sahteYanit(servis, metod, yol, secenek.sorgu, secenek.govde);
      if (yanit === undefined) throw new ApiError(HttpStatus.NOT_IMPLEMENTED, `Bu Vomsis ucu test (örnek veri) modunda henüz yok: ${metod} ${yol}`);
      return yanit as T;
    }

    const url = `${SERVISLER[servis].taban}${yol}${sorguMetni(secenek.sorgu)}`;
    let token = await this.token(servis, dbContext);
    let { durum, veri } = await httpIstek(url, metod, token, secenek.govde);

    // Token Vomsis tarafında düşmüş olabilir: bir kez yenileyip tekrar dene
    if (durum === 401) {
      await EBankaSqlRepository.tokenYaz(servis, null, null, dbContext);
      token = await this.girisYap(servis, dbContext);
      ({ durum, veri } = await httpIstek(url, metod, token, secenek.govde));
    }
    if (durum >= 400) {
      logger.warn(`[VomsisClient] ${metod} ${yol} → ${durum}`);
      throw vomsisHatasi(durum, veri);
    }
    return veri as T;
  }

  /** Canlı modda yeni token alarak anahtarı ve IP iznini sınar; sahte modda örnek veriyi döndürür. */
  public static async baglantiTesti(servis: VomsisServis, dbContext?: DbContext): Promise<{ mod: "sahte" | "canli"; ayrinti: string }> {
    const ayar = await EBankaSqlRepository.ayarGetir(dbContext);
    if (!ayar || ayar.mod === "sahte") {
      if (servis === "vpos") return { mod: "sahte", ayrinti: `Test modu: Sanal POS örnek veriyle çalışır (${SAHTE_TOKEN}).` };
      const { banks } = await this.istek<{ banks: unknown[] }>("banka", "/banks", {}, dbContext);
      return { mod: "sahte", ayrinti: `Test modu: örnek veriden ${banks.length} banka okundu. Vomsis'e istek gönderilmedi.` };
    }
    await EBankaSqlRepository.tokenYaz(servis, null, null, dbContext);
    await this.girisYap(servis, dbContext);
    if (servis === "vpos") return { mod: "canli", ayrinti: "Sanal POS oturumu açıldı." };
    const { banks } = await this.istek<{ banks: unknown[] }>("banka", "/banks", {}, dbContext);
    return { mod: "canli", ayrinti: `Oturum açıldı, ${Array.isArray(banks) ? banks.length : 0} banka tanımlı.` };
  }
}
