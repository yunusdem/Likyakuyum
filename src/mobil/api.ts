/**
 * Mobil cari sitesinin sunucu istemcisi (/api/v1/mobil; docs/MOBIL_CARI_YOL_HARITASI.md). Token yalnız bu sitenin
 * localStorage'ında durur; personel uygulamasının oturumuyla karışmaz.
 */

const KOK = "/api/v1/mobil";
const JETON = "likya_mobil_jeton";
export const OTURUM_BITTI = "likya_mobil_oturum_bitti";

export class MobilHata extends Error {
  constructor(public durum: number, mesaj: string, public kod?: string) {
    super(mesaj);
  }
}

export const jetonOku = (): string | null => {
  try {
    return localStorage.getItem(JETON);
  } catch {
    return null;
  }
};

export const jetonYaz = (j: string | null) => {
  try {
    if (j) localStorage.setItem(JETON, j);
    else localStorage.removeItem(JETON);
  } catch {
    /* gizli sekme */
  }
};

export const hatirla = {
  oku: (ad: string): string => {
    try {
      return localStorage.getItem(`likya_mobil_${ad}`) || "";
    } catch {
      return "";
    }
  },
  yaz: (ad: string, v: string) => {
    try {
      localStorage.setItem(`likya_mobil_${ad}`, v);
    } catch {
      /* */
    }
  },
};

export async function istek<T>(yontem: "GET" | "POST" | "PUT" | "DELETE", yol: string, govde?: unknown): Promise<T> {
  const jeton = jetonOku();
  let y: Response;
  try {
    y = await fetch(`${KOK}${yol}`, {
      method: yontem,
      headers: { ...(govde !== undefined ? { "Content-Type": "application/json" } : {}), ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}) },
      body: govde !== undefined ? JSON.stringify(govde) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new MobilHata(0, "Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.");
  }
  const j: any = await y.json().catch(() => null);
  if (!y.ok) {
    if (y.status === 401 && yol !== "/giris") {
      jetonYaz(null);
      window.dispatchEvent(new Event(OTURUM_BITTI));
    }
    throw new MobilHata(y.status, j?.message || `İstek başarısız (${y.status}).`, j?.errors?.kod);
  }
  return j?.data as T;
}

/** Çıktı / PDF gibi ikili yanıtlar */
export async function dosyaIstek(yol: string): Promise<Blob> {
  const jeton = jetonOku();
  const y = await fetch(`${KOK}${yol}`, { headers: jeton ? { Authorization: `Bearer ${jeton}` } : {}, cache: "no-store" });
  if (!y.ok) {
    const j: any = await y.json().catch(() => null);
    if (y.status === 401) {
      jetonYaz(null);
      window.dispatchEvent(new Event(OTURUM_BITTI));
    }
    throw new MobilHata(y.status, j?.message || "Belge alınamadı.");
  }
  return y.blob();
}

export interface MobilVeritabani {
  firmaId: number;
  kisaAd: string;
  unvan: string;
  cariAd: string | null;
}

export interface MobilYetkiler {
  fiyat: boolean;
  bakiye: boolean;
  dokum: boolean;
  alis: boolean;
  satis: boolean;
}

export interface MobilKullanici {
  kullaniciAdi: string;
  adSoyad: string | null;
  musteriNo: string;
  sifreDegismeli: boolean;
}

export interface GirisYaniti {
  token: string;
  kullanici: MobilKullanici;
  veritabanlari: MobilVeritabani[];
  seciliFirmaId: number | null;
}

export interface BenYaniti {
  kullanici: MobilKullanici;
  veritabanlari: MobilVeritabani[];
  seciliFirmaId: number | null;
  kisaAd: string;
  unvan: string | null;
  cari: { kod: string | null; ad: string | null } | null;
  yetkiler: MobilYetkiler | null;
  uyari: string | null;
}

export const tl = (v: number | null | undefined, basamak = 2) =>
  v === null || v === undefined || Number.isNaN(v) ? "-" : v.toLocaleString("tr-TR", { minimumFractionDigits: basamak, maximumFractionDigits: basamak });
