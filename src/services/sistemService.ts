import { apiClient } from "./apiClient";
import type { LisansIletisim } from "./userService";

/** Bulut / kurulum (exe) sürümü ayrımı ve kurulumun çevrimdışı lisansı (docs/BULUT_VE_EXE_LISANS_YOL_HARITASI.md). */

export interface SistemBilgisi {
  kurulum: boolean;
  surum: string;
  firma?: { firmaKodu: string; unvan: string; musteriNo: string } | null;
  /** Kurulumda firma veritabanında hiç kullanıcı var mı (yoksa ilk yönetici formu açılır) */
  kullaniciVar?: boolean | null;
}

export interface KurulumLisansDurumu {
  durum: "GECERLI" | "UYARI" | "KILITLI";
  neden: string | null;
  mesaj: string | null;
  makineKimligi: string;
  firmaKodu: string | null;
  firmaUnvan: string | null;
  bitis: string | null;
  kalanGun: number | null;
  kullaniciLimiti: number | null;
  iletisim: LisansIletisim;
}

let bilgiOnbellek: Promise<SistemBilgisi> | null = null;

export const SistemService = {
  bilgi(yenile = false): Promise<SistemBilgisi> {
    if (!bilgiOnbellek || yenile) {
      bilgiOnbellek = apiClient
        .get<SistemBilgisi>("/sistem/bilgi")
        .then((r) => r.data as SistemBilgisi)
        .catch(() => {
          // Hata önbelleğe alınmaz: sunucu açılırken bir kez ulaşılamadıysa kurulum bulut sanılıp kalmasın
          bilgiOnbellek = null;
          return { kurulum: false, surum: "" };
        });
    }
    return bilgiOnbellek;
  },
  /** Kilit ekranı: merkezden lisans denetimi (giriş gerekmez; merkeze en çok 30 sn'de bir gidilir) */
  async lisansKontrol(): Promise<{ merkezeUlasildi: boolean | null; hata: string | null; lisansYuklendi: boolean; lisans: KurulumLisansDurumu }> {
    return (await apiClient.post<any>("/sistem/lisans-kontrol")).data;
  },
  async lisansDurumu(): Promise<KurulumLisansDurumu> {
    return (await apiClient.get<KurulumLisansDurumu>("/auth/lisans-durum")).data as KurulumLisansDurumu;
  },
  async lisansYukle(kod: string): Promise<KurulumLisansDurumu> {
    return (await apiClient.post<KurulumLisansDurumu>("/auth/lisans-yukle", { kod })).data as KurulumLisansDurumu;
  },
  async ilkYonetici(girdi: { username: string; fullName: string; password: string }): Promise<void> {
    await apiClient.post("/auth/ilk-yonetici", girdi);
  },
};
