import { apiClient } from "./apiClient";

/** GİB VKN/TCKN sorgusu (Backend: GET /gib/vkn-sorgu; docs/GIB_VKN_SORGU_YOL_HARITASI.md) */
export interface VknSorguSonucu {
  no: string;
  tur: "VKN" | "TCKN";
  sonuc: "BULUNDU" | "KAYIT_YOK";
  unvan: string | null;
  ad: string | null;
  soyad: string | null;
  vergiDairesi: string | null;
  kaynak: "GIB" | "ONBELLEK" | "ICE";
  sorguTarihi: string;
  /** ICE yedeğinden gelince dolu: vergi dairesi yok */
  uyari: string | null;
}

/** Firmanın kendi GİB hesabı (şifre hiçbir zaman dönmez) */
export interface GibHesapDurumu {
  tanimli: boolean;
  kullaniciKodu: string | null;
  sonBasariliGiris: string | null;
  sonHata: string | null;
  sonHataTarihi: string | null;
  guncelleyen: string | null;
  guncellemeTarihi: string | null;
}

export const gibService = {
  async vknSorgu(no: string): Promise<VknSorguSonucu> {
    // Portal sırası + yeniden giriş birkaç saniye sürebilir
    return (await apiClient.get<VknSorguSonucu>("/gib/vkn-sorgu", { no }, { timeoutMs: 45_000 })).data;
  },
  async hesap(): Promise<GibHesapDurumu> {
    return (await apiClient.get<GibHesapDurumu>("/gib/hesap")).data;
  },
  async hesapKaydet(kullaniciKodu: string, sifre: string): Promise<GibHesapDurumu> {
    return (await apiClient.put<GibHesapDurumu>("/gib/hesap", { kullaniciKodu, sifre })).data;
  },
  async hesapSil(): Promise<GibHesapDurumu> {
    return (await apiClient.delete<GibHesapDurumu>("/gib/hesap")).data;
  },
  async hesapDene(): Promise<GibHesapDurumu> {
    return (await apiClient.post<GibHesapDurumu>("/gib/hesap/dene", {}, { timeoutMs: 45_000 })).data;
  },
};
