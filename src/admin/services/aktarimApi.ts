// Eski programdan veri aktarımı — admin paneli API istemcisi (docs/VERITABANI_TASIMA_YOL_HARITASI.md)
import { AdminApiHatasi, OTURUM_BITTI_OLAYI, tokenOku } from "./adminApi";

const API_KOK = "/api/v1/admin";

export type EngelSeviye = "ENGEL" | "UYARI";
export interface Engel {
  kod: string;
  seviye: EngelSeviye;
  mesaj: string;
}

export interface YuklemeBilgisi {
  yuklemeId: string;
  firmaId: number | null;
  dosyaAdi: string;
  boyut: number;
  parcaBoyutu: number;
  parcaSayisi: number;
  alinan: number[];
  durum: "YUKLENIYOR" | "HAZIR" | "HATA";
  hata: string | null;
  yedekYolu: string | null;
  yedekBoyutu: number | null;
  baslangic: string;
  bitis: string | null;
  incelendi?: boolean;
  aktarildi?: boolean | null;
  dogrulandi?: boolean | null;
}

export interface AktarimIsi {
  isId: string;
  firmaId: number;
  yuklemeId: string;
  tur: "INCELE" | "AKTAR" | "DOGRULA";
  durum: "CALISIYOR" | "BITTI" | "HATA";
  adim: string;
  yuzde: number;
  mesaj: string;
  baslangic: string;
  bitis: string | null;
  hata: string | null;
}

export interface EDovizSerisi {
  seri: string;
  numaratorSiradaki: number | null;
  belgeSayisi: number;
  sonBelge: string | null;
  gonderilen: number;
  sonGonderilen: string | null;
  gonderilmeyen: number;
  ilkGonderilmeyenTarih: string | null;
  sonGonderilmeyenTarih: string | null;
}

export interface IncelemeOzeti {
  yedek: { position: number; tur: number; dbAdi: string; sqlSurumu: string; tarih: string | null; boyut: number; collation: string };
  eskiProgram: boolean;
  programSurumu: string | null;
  firma: { ad: string | null; vkn: string | null; adres: string | null; telefon: string | null };
  alan: { fisleriAktarilacak: boolean | null; digerVeritabani: string | null };
  nesneler: { tablo: number; gorunum: number; yordam: number; sifreliYordam: number; tetik: number };
  toplamSatir: number;
  tablolar: { ad: string; satir: number }[];
  fis: {
    doviz: { adet: number; ilk: string | null; son: string | null };
    sarraf: { adet: number; ilk: string | null; son: string | null };
    cariKart: number;
    cariHareket: number;
    vezneTransferi: number;
  };
  kullanicilar: string[];
  bagliVeritabanlari: { db: string; nesneler: string[] }[];
  eDoviz: { logVar: boolean; seriler: EDovizSerisi[] };
  engeller: Engel[];
}

export type CiftRolu = "RESMI" | "CALISMA";

export interface IncelemeSonucu {
  ozet: IncelemeOzeti | null;
  engeller: Engel[];
  plan: { kopyalanacak: number; sablonTemizlenecek: string[]; kurallar: { tablo: string; kolon: string; aciklama: string }[]; bosBirakilan: number } | null;
  firmaDolu: { fis: number; sarrafFisi: number; kullanici: number } | null;
  esAdaylari: { firmaId: number; firmaKodu: string; unvan: string; dbName: string }[];
  onerilenRol: CiftRolu | null;
  zaman: string;
}

export type KontrolDurumu = "TAMAM" | "FARK" | "UYARI" | "BILGI";
export interface DogrulamaKontrolu {
  grup: string;
  tablo: string | null;
  ad: string;
  durum: KontrolDurumu;
  kaynak?: string | number | null;
  hedef?: string | number | null;
  ayrinti?: string;
  ornekler?: string[];
}
export interface DogrulamaRaporu {
  basarili: boolean;
  kaynakDb: string;
  hedefDb: string;
  zaman: string;
  sureMs: number;
  ozet: { tablo: number; satir: number; tamam: number; fark: number; uyari: number };
  kontroller: DogrulamaKontrolu[];
}

export interface AktarimRaporu {
  basarili: boolean;
  /** COMMIT'ten sonra yapılan kontrolün hükmü: tamlık + doğru yer (ayrıntı: "Aktarım sonrası kontrol") */
  sonKontrol?: { basarili: boolean; yuzde: number; dogruYer: boolean; firmaGirisiyleOkundu: boolean; metin: string } | null;
  bildirim?: boolean;
  hata: string | null;
  engeller: Engel[];
  aktarim: {
    basarili: boolean;
    sureMs: number;
    onYedek: string | null;
    tablolar: { tablo: string; islem: string; kaynakSatir: number; silinen: number; yazilan: number }[];
    korunanKullanicilar: string[];
    cakisanKullanicilar: string[];
    notlar: string[];
    kurallar: { tablo: string; kolon: string; aciklama: string }[];
  } | null;
  dogrulama: DogrulamaRaporu | null;
  cift: { hedefDb: string; esHedefDb: string; esEskiAdi: string; rol: CiftRolu; esFirmaId: number } | null;
  kullaniciEslemesi: number;
  yapan: string;
  zaman: string;
}

const oturumBitti = (status: number) => {
  if (status === 401) window.dispatchEvent(new Event(OTURUM_BITTI_OLAYI));
};

async function istek<T>(yontem: string, yol: string, govde?: unknown, ikili?: { veri: ArrayBuffer; basliklar: Record<string, string> }): Promise<T> {
  const token = tokenOku();
  let yanit: Response;
  try {
    yanit = await fetch(`${API_KOK}${yol}`, {
      method: yontem,
      headers: {
        ...(ikili ? { "Content-Type": "application/octet-stream", ...ikili.basliklar } : govde !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: ikili ? ikili.veri : govde !== undefined ? JSON.stringify(govde) : undefined,
      credentials: "omit",
      cache: "no-store",
    });
  } catch {
    throw new AdminApiHatasi(0, "Sunucuya ulaşılamadı.");
  }
  const json = await yanit.json().catch(() => null);
  if (!yanit.ok) {
    oturumBitti(yanit.status);
    throw new AdminApiHatasi(yanit.status, json?.message || `İstek başarısız (${yanit.status}).`);
  }
  return json?.data as T;
}

const sha256 = async (veri: ArrayBuffer): Promise<string | null> => {
  try {
    if (!window.crypto?.subtle) return null;
    const ozet = await window.crypto.subtle.digest("SHA-256", veri);
    return [...new Uint8Array(ozet)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
};

export const aktarimApi = {
  yuklemeler: (firmaId: number) => istek<YuklemeBilgisi[]>("GET", `/firmalar/${firmaId}/aktarim/yuklemeler`),
  yuklemeSil: (firmaId: number, yuklemeId: string) => istek<null>("DELETE", `/firmalar/${firmaId}/aktarim/yuklemeler/${yuklemeId}`),
  incele: (firmaId: number, yuklemeId: string) => istek<AktarimIsi>("POST", `/firmalar/${firmaId}/aktarim/yuklemeler/${yuklemeId}/incele`),
  aktar: (firmaId: number, yuklemeId: string, girdi: { onay: string; esFirmaId?: number | null; rol?: CiftRolu | null; taslakOnay?: boolean; firmaOnay?: boolean }) =>
    istek<AktarimIsi>("POST", `/firmalar/${firmaId}/aktarim/yuklemeler/${yuklemeId}/aktar`, girdi),
  dogrula: (firmaId: number, yuklemeId: string) => istek<AktarimIsi>("POST", `/firmalar/${firmaId}/aktarim/yuklemeler/${yuklemeId}/dogrula`),
  isDurumu: (firmaId: number, isId: string) => istek<AktarimIsi>("GET", `/firmalar/${firmaId}/aktarim/isler/${isId}`),
  rapor: (firmaId: number, yuklemeId: string) =>
    istek<{ inceleme: IncelemeSonucu | null; rapor: AktarimRaporu | null; dogrulama: DogrulamaRaporu | null }>("GET", `/firmalar/${firmaId}/aktarim/yuklemeler/${yuklemeId}/rapor`),

  /**
   * Dosyayı 8 MB'lık parçalar hâlinde yükler (iki parça aynı anda; her parça SHA-256 ile denetlenir, hata olursa 3 kez yeniden denenir).
   * Bitince sunucu parçaları birleştirir, zip ise içinden .bak'ı çıkarır ve SQL yedeği olduğunu denetler.
   */
  yedekYukle: async (firmaId: number, dosya: File, ilerleme: (yuklenen: number, toplam: number) => void, iptal?: { iptal: boolean }): Promise<YuklemeBilgisi> => {
    const b = await istek<YuklemeBilgisi>("POST", `/firmalar/${firmaId}/aktarim/yuklemeler`, { dosyaAdi: dosya.name, boyut: dosya.size });
    let yuklenen = 0;
    let sira = 0;
    const sonraki = () => (sira < b.parcaSayisi ? ++sira : null);
    const gonder = async (no: number) => {
      const bas = (no - 1) * b.parcaBoyutu;
      const veri = await dosya.slice(bas, Math.min(bas + b.parcaBoyutu, dosya.size)).arrayBuffer();
      const ozet = await sha256(veri);
      for (let deneme = 1; ; deneme++) {
        if (iptal?.iptal) throw new AdminApiHatasi(0, "Yükleme iptal edildi.");
        try {
          await istek("PUT", `/firmalar/${firmaId}/aktarim/yuklemeler/${b.yuklemeId}/parca/${no}`, undefined, { veri, basliklar: ozet ? { "X-Parca-Sha256": ozet } : {} });
          break;
        } catch (err) {
          if (deneme >= 3 || (err instanceof AdminApiHatasi && err.status === 401)) throw err;
          await new Promise((r) => setTimeout(r, 1000 * deneme));
        }
      }
      yuklenen += veri.byteLength;
      ilerleme(yuklenen, dosya.size);
    };
    const isci = async () => {
      for (let no = sonraki(); no !== null; no = sonraki()) await gonder(no);
    };
    await Promise.all([isci(), isci()]);
    return istek<YuklemeBilgisi>("POST", `/firmalar/${firmaId}/aktarim/yuklemeler/${b.yuklemeId}/bitir`);
  },
};

export const boyutYaz = (bayt: number | null | undefined): string => {
  if (!bayt && bayt !== 0) return "-";
  if (bayt >= 1024 ** 3) return `${(bayt / 1024 ** 3).toFixed(2)} GB`;
  if (bayt >= 1024 ** 2) return `${(bayt / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bayt / 1024))} KB`;
};
