import { apiClient } from "./apiClient";

/**
 * Tanıtım sitesi iletişim / ön bilgi formu (docs/ILETISIM_FORMU_YOL_HARITASI.md).
 * Backend: POST /api/v1/iletisim/form — giriş gerektirmez; içerik info@likyakuyum.com'a mail olarak gider.
 */
export interface IletisimFormVerisi {
  adSoyad: string;
  firma?: string;
  telefon: string;
  eposta?: string;
  sehir?: string;
  mesaj?: string;
  /** Hangi sayfadan gönderildi */
  kaynak: "ana-sayfa" | "iletisim";
  /** Honeypot — gerçek kullanıcı boş bırakır */
  web?: string;
}

export const iletisimService = {
  formGonder: async (veri: IletisimFormVerisi): Promise<string> => {
    const r = await apiClient.post<{ alindi: boolean }>("/iletisim/form", veri, { timeoutMs: 40000 });
    return r.message || "Talebiniz alındı.";
  },
};
