import crypto from "crypto";
import { LISANS_ACIK_ANAHTAR } from "../../constants/lisansAcikAnahtar.js";

/**
 * Çevrimdışı lisans kodu: LKY1.<base64url(JSON)>.<base64url(Ed25519 imzası)>
 * docs/BULUT_VE_EXE_LISANS_YOL_HARITASI.md, 7.3 · K8, K14, K17.
 * Kodu yalnızca özel anahtarı bilen merkez sunucu üretebilir; kurulum, koda gömülü açık anahtarla doğrular.
 */

export const LISANS_ONEKI = "LKY1";

export interface LisansIletisim {
  telefon: string;
  eposta: string;
  metin: string;
}

export interface LisansVerisi {
  v: 1;
  /** Firma kodu (kurulumun firma.lky dosyasındakiyle aynı olmalı) */
  firmaKodu: string;
  firmaId: number;
  lisansId: number;
  /** Firma içinde artan; eski kod yenisinin yerine yüklenemez */
  seri: number;
  /** XXXX-XXXX-XXXX-XXXX; null = makineye bağlı değil (yalnız özel durum) */
  makine: string | null;
  baslangic: string;
  bitis: string;
  kullaniciLimiti: number;
  /** Açık modül kodları; null = kısıt yok */
  moduller: string[] | null;
  /** Lisanstaki ürün paketleri (yalnız gösterim; kısıt moduller'dedir). Eski kodlarda yoktur. */
  urunler?: string[] | null;
  iletisim: LisansIletisim;
  /** Kodun üretildiği an (ISO) */
  verilme: string;
}

export type LisansKoduHatasi = "BICIM" | "IMZA" | "ANAHTAR_YOK";

export class LisansKoduGecersiz extends Error {
  constructor(public readonly neden: LisansKoduHatasi, mesaj: string) {
    super(mesaj);
  }
}

const b64u = (b: Buffer): string => b.toString("base64url");

/** Testler ve merkez sunucu için: koda gömülü değeri geçersiz kılar (ortam değişkeninden asla okunmaz). */
let acikAnahtarB64: string = LISANS_ACIK_ANAHTAR;
export const lisansAcikAnahtariniAyarla = (b64: string): void => {
  acikAnahtarB64 = b64;
};
export const lisansAcikAnahtari = (): string => acikAnahtarB64;

export const ozelAnahtarOku = (b64: string): crypto.KeyObject => {
  const k = crypto.createPrivateKey({ key: Buffer.from(b64, "base64"), format: "der", type: "pkcs8" });
  if (k.asymmetricKeyType !== "ed25519") throw new Error("Lisans özel anahtarı Ed25519 değil.");
  return k;
};

export const acikAnahtarOku = (b64: string): crypto.KeyObject => {
  const k = crypto.createPublicKey({ key: Buffer.from(b64, "base64"), format: "der", type: "spki" });
  if (k.asymmetricKeyType !== "ed25519") throw new Error("Lisans açık anahtarı Ed25519 değil.");
  return k;
};

/** Özel anahtardan açık anahtar (base64 SPKI). */
export const acikAnahtarTuret = (ozelB64: string): string =>
  crypto.createPublicKey(ozelAnahtarOku(ozelB64)).export({ format: "der", type: "spki" }).toString("base64");

/** Herhangi bir veriyi imzalı metne çevirir (lisans kodu ve firma.lky aynı biçimi kullanır). */
export const imzaliMetinUret = (onek: string, veri: unknown, ozelB64: string): string => {
  const govde = b64u(Buffer.from(JSON.stringify(veri), "utf8"));
  const imza = crypto.sign(null, Buffer.from(`${onek}.${govde}`, "utf8"), ozelAnahtarOku(ozelB64));
  return `${onek}.${govde}.${b64u(imza)}`;
};

export const imzaliMetinCoz = <T>(onek: string, metin: string, acikB64: string = acikAnahtarB64): T => {
  if (!acikB64) throw new LisansKoduGecersiz("ANAHTAR_YOK", "Programda lisans doğrulama anahtarı tanımlı değil.");
  const temiz = String(metin || "").replace(/\s+/g, "");
  const parca = temiz.split(".");
  if (parca.length !== 3 || parca[0] !== onek || !parca[1] || !parca[2]) {
    throw new LisansKoduGecersiz("BICIM", "Kod biçimi hatalı. Kodu eksiksiz yapıştırdığınızdan emin olun.");
  }
  let dogru = false;
  try {
    dogru = crypto.verify(
      null,
      Buffer.from(`${parca[0]}.${parca[1]}`, "utf8"),
      acikAnahtarOku(acikB64),
      Buffer.from(parca[2], "base64url")
    );
  } catch {
    dogru = false;
  }
  if (!dogru) throw new LisansKoduGecersiz("IMZA", "Kod doğrulanamadı (geçersiz veya değiştirilmiş).");
  try {
    return JSON.parse(Buffer.from(parca[1], "base64url").toString("utf8")) as T;
  } catch {
    throw new LisansKoduGecersiz("BICIM", "Kod içeriği okunamadı.");
  }
};

const GUN = /^\d{4}-\d{2}-\d{2}$/;

export const lisansKoduUret = (veri: LisansVerisi, ozelB64: string): string => imzaliMetinUret(LISANS_ONEKI, veri, ozelB64);

/** İmzayı ve alanların biçimini doğrular; içerik kurallarını (makine, tarih) kurulum servisi denetler. */
export const lisansKoduCoz = (kod: string, acikB64?: string): LisansVerisi => {
  const v = imzaliMetinCoz<LisansVerisi>(LISANS_ONEKI, kod, acikB64);
  const alanlarDogru =
    v &&
    v.v === 1 &&
    typeof v.firmaKodu === "string" &&
    Number.isInteger(v.firmaId) &&
    Number.isInteger(v.lisansId) &&
    Number.isInteger(v.seri) &&
    (v.makine === null || typeof v.makine === "string") &&
    GUN.test(v.baslangic) &&
    GUN.test(v.bitis) &&
    Number.isInteger(v.kullaniciLimiti) &&
    v.kullaniciLimiti > 0 &&
    (v.moduller === null || Array.isArray(v.moduller)) &&
    (v.urunler === undefined || v.urunler === null || Array.isArray(v.urunler)) &&
    !!v.iletisim;
  if (!alanlarDogru) throw new LisansKoduGecersiz("BICIM", "Kod içeriği eksik veya hatalı.");
  return v;
};
