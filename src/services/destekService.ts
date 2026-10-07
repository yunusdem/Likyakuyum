import { apiClient, getEffectiveApiUrl } from "./apiClient";
import { EkGirdi, KonuOzet, KullaniciSekmesi, MesajDto, Oncelik, TalepTuru } from "../components/destek/destekOrtak";

/** Destek (talep) + bildirimler — docs/DESTEK_VE_BILDIRIM_YOL_HARITASI.md. Sunucu: /api/v1/destek */

export * from "../components/destek/destekOrtak";

export interface KonuDetay {
  konu: KonuOzet;
  mesajlar: MesajDto[];
  cevrimdisi?: boolean;
}

export interface KullaniciOzet {
  okunmamis: number;
  onemli: KonuOzet[];
  kurulu: boolean;
  cevrimdisi?: boolean;
}

export interface TalepGirdi {
  baslik: string;
  metin: string;
  talepTuru?: TalepTuru;
  oncelik?: Oncelik;
  ekran?: string | null;
  ekler?: EkGirdi[];
}

export const dosyayiBase64Yap = (dosya: File): Promise<EkGirdi> =>
  new Promise((resolve, reject) => {
    const okuyucu = new FileReader();
    okuyucu.onerror = () => reject(new Error("Dosya okunamadı."));
    okuyucu.onload = () => {
      const metin = String(okuyucu.result || "");
      resolve({ dosyaAdi: dosya.name, mime: dosya.type, veri: metin.replace(/^data:[^,]*,/, "") });
    };
    okuyucu.readAsDataURL(dosya);
  });

const ekOnbellek = new Map<number, Promise<string>>();

/** Ek görsel yetkili uçtan okunur (Authorization gerekir); nesne adresi önbelleklenir. */
export const ekAdresi = (ekId: number): Promise<string> => {
  let p = ekOnbellek.get(ekId);
  if (!p) {
    const token = localStorage.getItem("kuyumcu_erp_access_token");
    const dbServer = localStorage.getItem("kuyumcu_erp_last_server") || localStorage.getItem("kuyumcu_erp_active_server");
    const dbName = localStorage.getItem("kuyumcu_erp_last_db") || localStorage.getItem("kuyumcu_erp_active_db");
    p = fetch(`${getEffectiveApiUrl()}/destek/ek/${ekId}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(dbServer ? { "x-db-server": dbServer } : {}),
        ...(dbName ? { "x-db-name": dbName } : {}),
      },
    }).then(async (r) => {
      if (!r.ok) throw new Error("Görsel alınamadı.");
      return URL.createObjectURL(await r.blob());
    });
    p.catch(() => ekOnbellek.delete(ekId));
    ekOnbellek.set(ekId, p);
  }
  return p;
};

export const DESTEK_DEGISTI_OLAYI = "likya_destek_degisti";
/** Zil sayacının hemen tazelenmesi için (talep açıldı, okundu vb.) */
export const destekDegisti = () => window.dispatchEvent(new Event(DESTEK_DEGISTI_OLAYI));

export const DestekService = {
  async ozet(): Promise<KullaniciOzet> {
    return (await apiClient.get<KullaniciOzet>("/destek/ozet")).data;
  },
  async konular(sekme: KullaniciSekmesi): Promise<{ konular: KonuOzet[]; cevrimdisi: boolean }> {
    return (await apiClient.get<{ konular: KonuOzet[]; cevrimdisi: boolean }>("/destek/konular", { sekme })).data;
  },
  async konu(konuId: number): Promise<KonuDetay> {
    const d = (await apiClient.get<KonuDetay>(`/destek/konular/${konuId}`)).data;
    destekDegisti(); // sunucu okundu işaretledi; zil sayacı hemen tazelensin
    return d;
  },
  async talepAc(girdi: TalepGirdi): Promise<KonuDetay> {
    const d = (await apiClient.post<KonuDetay>("/destek/talepler", girdi)).data;
    destekDegisti();
    return d;
  },
  async mesajYaz(konuId: number, metin: string, ekler?: EkGirdi[]): Promise<KonuDetay> {
    const d = (await apiClient.post<KonuDetay>(`/destek/konular/${konuId}/mesajlar`, { metin, ekler })).data;
    destekDegisti();
    return d;
  },
  async okundu(konuId?: number | null): Promise<void> {
    await apiClient.post("/destek/okundu", konuId ? { konuId } : {});
    destekDegisti();
  },
  async arsiv(konuId: number, deger: boolean): Promise<void> {
    await apiClient.post(`/destek/konular/${konuId}/arsiv`, { deger });
    destekDegisti();
  },
  async onemliOkundu(konuId: number): Promise<void> {
    await apiClient.post(`/destek/konular/${konuId}/onemli-okundu`, {});
    destekDegisti();
  },
};
