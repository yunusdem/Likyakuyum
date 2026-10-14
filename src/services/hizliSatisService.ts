import { apiClient } from "./apiClient";
import type { HizliSatisModul } from "../../Backend/src/services/hizliSatis/hizliSatisKural";

/** Hızlı Satış istemcisi (docs/HIZLI_SATIS_YOL_HARITASI.md): buton düzeni, ayarlar, fiş işareti */

export interface HizliSatisButon {
  butonId: number;
  sira: number;
  urunTuru: number;
  urunId: number | null;
  ad: string;
  ozelAd: string | null;
  urunKodu: string | null;
  urunAdi: string | null;
  urunTipi: number | null;
  birim: string | null;
  renk: string | null;
  fiyat: number | null;
  ozelFiyat: number | null;
  kdvOrani: number | null;
  gecersiz: boolean;
  resimVar: boolean;
  resim?: string | null;
}

export interface HizliSatisSekme {
  sekmeId: number;
  ad: string;
  sira: number;
  butonlar: HizliSatisButon[];
}

export interface DuzenButonGirdisi {
  butonId?: number | null;
  urunTuru: number;
  urunId?: number | null;
  ad?: string | null;
  renk?: string | null;
  fiyat?: number | null;
  kdvOrani?: number | null;
  /** undefined: dokunma, null: sil, data URL: yeni resim */
  resim?: string | null;
}

export interface DuzenSekmeGirdisi {
  sekmeId?: number | null;
  ad: string;
  butonlar: DuzenButonGirdisi[];
}

export interface HizliSatisAyarlari {
  faturaSiniri: number;
  kullanicilar: { kullaniciId: number; ad: string; yonetici: boolean; yetkili: boolean }[];
}

export interface HizliSatisYetki {
  fiyatYetkisi: boolean;
  sistemYoneticisi: boolean;
  faturaSiniri: number;
}

export interface AliciSorguSonucu {
  kaynak: "cari" | "fatura" | "sarraf" | "doviz" | "kayitsiz" | "gib" | null;
  mesaj?: string;
  cariKartId?: number | null;
  cariKod?: string | null;
  unvan?: string;
  vknTckn?: string;
  adres?: string;
  il?: string;
  ilce?: string;
  vergiDairesi?: string;
  telefon?: string;
  eposta?: string;
  mukellef?: boolean;
  uyari?: string | null;
}

export interface HizliSatisFisi {
  fisId: number;
  fisNo: string;
  tarih: string;
  unvan: string;
  tutar: number;
  tip: 0 | 1;
  kullanici: string | null;
  zaman: string;
}

export interface BekleyenSepet {
  bekleyenId: number;
  vezneId: number | null;
  kullaniciId: number | null;
  kullaniciAdi: string | null;
  tip: 0 | 1;
  musteri: string | null;
  aciklama: string | null;
  kalem: number;
  toplam: number;
  zaman: string;
  eski: boolean;
}

export const HizliSatisService = {
  async yetki(): Promise<HizliSatisYetki> {
    return (await apiClient.get("/hizli-satis/yetki")).data;
  },
  async duzen(modul: HizliSatisModul, resimli = true): Promise<HizliSatisSekme[]> {
    return (await apiClient.get(`/hizli-satis/duzen/${modul}`, resimli ? undefined : { resim: "0" })).data || [];
  },
  async duzenKaydet(modul: HizliSatisModul, sekmeler: DuzenSekmeGirdisi[]): Promise<HizliSatisSekme[]> {
    return (await apiClient.put(`/hizli-satis/duzen/${modul}`, { sekmeler })).data || [];
  },
  async ayarlar(): Promise<HizliSatisAyarlari> {
    return (await apiClient.get("/hizli-satis/ayarlar")).data;
  },
  async ayarKaydet(g: { faturaSiniri?: number; yetkiliKullanicilar?: number[] }): Promise<HizliSatisAyarlari> {
    return (await apiClient.put("/hizli-satis/ayarlar", g)).data;
  },
  /** TCKN/VKN ile alıcı: firmanın kayıtları, sonra GİB (H13). Bulunamazsa { kaynak: null, mesaj } */
  async aliciSorgula(no: string): Promise<AliciSorguSonucu> {
    return (await apiClient.get(`/hizli-satis/alici/${encodeURIComponent(no)}`)).data;
  },
  /** Hızlı satıştan kaydedilen fişler (son `gun` gün) */
  async fisler(modul: HizliSatisModul, gun = 1): Promise<HizliSatisFisi[]> {
    return (await apiClient.get(`/hizli-satis/fisler/${modul}`, { gun })).data || [];
  },
  // ── Bekleyen sepetler (H25–H28) ──
  async bekleyenler(modul: HizliSatisModul, vezneId: number | null, tumu = false): Promise<BekleyenSepet[]> {
    return (await apiClient.get(`/hizli-satis/bekleyen/liste/${modul}`, { ...(vezneId ? { vezneId } : {}), ...(tumu ? { tumu: "1" } : {}) })).data || [];
  },
  async bekleyenGetir(id: number, vezneId: number | null): Promise<{ bekleyenId: number; modul: string; tip: 0 | 1; icerik: any }> {
    return (await apiClient.get(`/hizli-satis/bekleyen/${id}`, vezneId ? { vezneId } : undefined)).data;
  },
  async bekleyenKaydet(g: { modul: HizliSatisModul; vezneId: number | null; tip: 0 | 1; musteri: string | null; aciklama: string | null; kalem: number; toplam: number; icerik: unknown }): Promise<{ bekleyenId: number }> {
    return (await apiClient.post("/hizli-satis/bekleyen", g)).data;
  },
  async bekleyenSil(id: number, vezneId: number | null): Promise<void> {
    await apiClient.delete(`/hizli-satis/bekleyen/${id}${vezneId ? `?vezneId=${vezneId}` : ""}`);
  },
  async isaretle(modul: HizliSatisModul, fisId: number): Promise<void> {
    await apiClient.post("/hizli-satis/isaretle", { modul, fisId });
  },
  async isaretliler(modul: HizliSatisModul, fisIdler: number[]): Promise<number[]> {
    if (!fisIdler.length) return [];
    return (await apiClient.post("/hizli-satis/isaretliler", { modul, fisIdler })).data || [];
  },
};
