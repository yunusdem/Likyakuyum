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

export const gibService = {
  async vknSorgu(no: string): Promise<VknSorguSonucu> {
    // Portal sırası + yeniden giriş birkaç saniye sürebilir
    return (await apiClient.get<VknSorguSonucu>("/gib/vkn-sorgu", { no }, { timeoutMs: 45_000 })).data;
  },
};
