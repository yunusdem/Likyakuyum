import { randomUUID } from "crypto";
import { logger } from "../../utils/logger.js";

/**
 * GİB e-Arşiv Portalı istemcisi — yalnız VKN/TCKN'den unvan / ad-soyad / vergi dairesi sorgusu
 * (docs/GIB_VKN_SORGU_YOL_HARITASI.md). Portalın belgelenmemiş iç servisidir; GİB değiştirirse düzeltme bu dosyadadır.
 *
 * - Token bellekte tutulur, her sorguda yeniden giriş yapılmaz; oturum hatasında bir kez yeniden girilir.
 * - İstekler tek sıradan gider (aynı anda tek istek + kısa bekleme); merkezi hesap GİB'de kilitlenmesin.
 */

const PORTAL = "https://earsivportal.efatura.gov.tr";
const ZAMAN_ASIMI_MS = 15_000;
const ISTEK_ARASI_MS = 300;
const TOKEN_OMRU_MS = 20 * 60_000;

export type GibHataTuru = "GIRIS" | "BAGLANTI" | "CEVAP";

export class GibPortalHatasi extends Error {
  constructor(public readonly tur: GibHataTuru, mesaj: string) {
    super(mesaj);
  }
}

export interface GibHesap {
  kullaniciKodu: string;
  sifre: string;
}

export interface GibKisiBilgisi {
  unvan: string | null;
  ad: string | null;
  soyad: string | null;
  vergiDairesi: string | null;
}

const temiz = (v: unknown): string | null => {
  const s = typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
  return s ? s : null;
};

/** Portal hatası {"error":"1","messages":[{"type":"4","text":"..."}]} biçimindedir. */
const hataMetni = (veri: any): string | null => {
  if (!veri || typeof veri !== "object" || !veri.error) return null;
  const m = Array.isArray(veri.messages) ? veri.messages[0] : null;
  return temiz(typeof m === "string" ? m : m?.text) || "GİB portalı hata döndürdü.";
};

const oturumHatasiMi = (metin: string) => /oturum|token|zaman ?aşım|yeniden giriş/i.test(metin);

/** Kişi/kurum bulunamadı anlamındaki portal mesajları */
export const kayitYokMesajiMi = (metin: string) => /bulunama|kayıt(lı)? (yok|değil)|mevcut değil/i.test(metin);

const post = async (yol: string, alanlar: Record<string, string>): Promise<any> => {
  const kontrol = new AbortController();
  const zamanlayici = setTimeout(() => kontrol.abort(), ZAMAN_ASIMI_MS);
  let cevap: Response;
  try {
    cevap = await fetch(`${PORTAL}${yol}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Accept: "application/json, text/javascript, */*; q=0.01",
        Referer: `${PORTAL}/intragiris.html`,
      },
      body: new URLSearchParams(alanlar).toString(),
      signal: kontrol.signal,
    });
  } catch (err: any) {
    throw new GibPortalHatasi(
      "BAGLANTI",
      err?.name === "AbortError" ? "GİB portalı zamanında cevap vermedi." : `GİB portalına bağlanılamadı (${err?.cause?.code || err?.message}).`
    );
  } finally {
    clearTimeout(zamanlayici);
  }
  const metin = await cevap.text();
  try {
    return JSON.parse(metin);
  } catch {
    throw new GibPortalHatasi("BAGLANTI", `GİB portalı beklenmeyen cevap verdi (HTTP ${cevap.status}).`);
  }
};

let token: string | null = null;
let tokenZamani = 0;
let tokenHesabi = "";
let sira: Promise<unknown> = Promise.resolve();

const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** İşleri tek sıraya dizer; biri hata verse de sıradaki çalışır. */
const siraya = <T>(is: () => Promise<T>): Promise<T> => {
  const sonuc = sira.then(is, is);
  sira = sonuc.then(
    () => bekle(ISTEK_ARASI_MS),
    () => bekle(ISTEK_ARASI_MS)
  );
  return sonuc;
};

const hesapAnahtari = (h: GibHesap) => `${h.kullaniciKodu}\u0000${h.sifre}`;

const girisYap = async (hesap: GibHesap): Promise<string> => {
  const veri = await post("/earsiv-services/assos-login", {
    assoscmd: "anologin",
    rtype: "json",
    userid: hesap.kullaniciKodu,
    sifre: hesap.sifre,
    sifre2: hesap.sifre,
    parola: "1",
  });
  const hata = hataMetni(veri);
  if (hata) throw new GibPortalHatasi("GIRIS", hata);
  const t = temiz(veri?.token);
  if (!t) throw new GibPortalHatasi("GIRIS", "GİB portalı giriş cevabında oturum anahtarı yok.");
  token = t;
  tokenZamani = Date.now();
  tokenHesabi = hesapAnahtari(hesap);
  return t;
};

const cikisYap = async (t: string): Promise<void> => {
  try {
    await post("/earsiv-services/assos-login", { assoscmd: "logout", rtype: "json", token: t });
  } catch {
    // çıkış yapılamaması sorun değil; oturum portalda kendiliğinden düşer
  }
};

const gecerliToken = async (hesap: GibHesap): Promise<string> => {
  if (token && tokenHesabi === hesapAnahtari(hesap) && Date.now() - tokenZamani < TOKEN_OMRU_MS) return token;
  if (token) {
    const eski = token;
    token = null;
    await cikisYap(eski);
  }
  return girisYap(hesap);
};

const dispatch = (t: string, cmd: string, pageName: string, jp: unknown) =>
  post("/earsiv-services/dispatch", { cmd, callid: randomUUID(), pageName, token: t, jp: JSON.stringify(jp) });

export class EarsivPortalClient {
  /**
   * VKN/TCKN → unvan, ad, soyad, vergi dairesi. Kayıt yoksa bütün alanları null olan nesne döner.
   * Hata durumunda GibPortalHatasi fırlatır.
   */
  public static kisiGetir(hesap: GibHesap, no: string): Promise<GibKisiBilgisi> {
    return siraya(async () => {
      const cmd = "SICIL_VEYA_MERNISTEN_BILGILERI_GETIR";
      const sayfa = "RG_BASITFATURA";
      let veri = await dispatch(await gecerliToken(hesap), cmd, sayfa, { vknTcknn: no });
      let hata = hataMetni(veri);
      if (hata && oturumHatasiMi(hata)) {
        token = null;
        veri = await dispatch(await girisYap(hesap), cmd, sayfa, { vknTcknn: no });
        hata = hataMetni(veri);
      }
      if (hata) {
        if (kayitYokMesajiMi(hata)) return { unvan: null, ad: null, soyad: null, vergiDairesi: null };
        throw new GibPortalHatasi("CEVAP", hata);
      }
      const d = veri?.data ?? {};
      return { unvan: temiz(d.unvan), ad: temiz(d.adi), soyad: temiz(d.soyadi), vergiDairesi: temiz(d.vergiDairesi) };
    });
  }

  /**
   * Admin panelindeki "Bağlantıyı Dene": giriş + çıkış. GİB yeni girişte eski oturumu düşürebileceği için
   * bellekteki oturum da bırakılır; sonraki sorgu yeniden giriş yapar.
   */
  public static girisDene(hesap: GibHesap): Promise<void> {
    return siraya(async () => {
      const eski = token;
      token = null;
      tokenHesabi = "";
      if (eski) await cikisYap(eski);
      const t = await girisYap(hesap);
      token = null;
      tokenHesabi = "";
      await cikisYap(t);
    });
  }

  /** Hesap değişince bellekteki oturum bırakılır. */
  public static oturumuBirak(): void {
    const eski = token;
    token = null;
    tokenHesabi = "";
    if (eski) siraya(() => cikisYap(eski)).catch((e) => logger.warn(`[GIB] Çıkış yapılamadı: ${e?.message}`));
  }
}
