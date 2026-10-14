import { apiClient } from "./apiClient";
import { dosyaGetir } from "./raporService";

/** Ticari İşlemler istemcisi (docs/TICARI_ISLEMLER_YOL_HARITASI.md): stok kartı, grup, giriş, satış fişi, raporlar */

export interface StokGrup {
  stokGrupId: number;
  ad: string;
  aktif: boolean;
  kartSayisi: number;
}

export interface StokKart {
  stokKartId: number;
  kod: string;
  ad: string;
  stokGrupId: number | null;
  grupAdi: string | null;
  birim: string;
  kdvOrani: number;
  satisFiyati: number | null;
  fiyatKdvDahil: boolean;
  paraId: number | null;
  paraKodu: string | null;
  alisFiyati: number | null;
  sonAlisFiyati: number | null;
  sonAlisTarihi: string | null;
  enAzStok: number | null;
  aktif: boolean;
  aciklama: string | null;
  barkodlar: string[];
  bakiye: number;
  resimVar: boolean;
  resim?: string | null;
}

export interface StokKartGirdi {
  stokKartId?: number | null;
  kod?: string;
  ad: string;
  stokGrupId?: number | null;
  birim?: string;
  kdvOrani?: number | string | null;
  satisFiyati?: number | string | null;
  fiyatKdvDahil?: boolean;
  paraId?: number | null;
  alisFiyati?: number | string | null;
  enAzStok?: number | string | null;
  aktif?: boolean;
  aciklama?: string | null;
  barkodlar?: string[];
  resim?: string | null;
}

export interface StokAyarlari {
  eksiStok: "UYAR" | "ENGELLE" | "SESSIZ";
  kullanicilar: { kullaniciId: number; ad: string; yonetici: boolean; yetkili: boolean }[];
}

export interface StokGirisSatiri {
  satirNo?: number;
  stokKartId: number;
  kod?: string;
  ad?: string;
  birim?: string;
  miktar: number;
  birimFiyat: number;
  kdvOrani: number;
  tutar?: number;
  kdvTutari?: number;
  toplamTutar?: number;
}

export interface StokGiris {
  stokGirisId: number;
  fisNo: string;
  tarih: string;
  cariKartId: number | null;
  cariKod: string | null;
  cariAd: string | null;
  belgeNo: string | null;
  aciklama: string | null;
  araToplam: number;
  toplamKdv: number;
  genelToplam: number;
  cariHareketId?: number | null;
  vezneId?: number | null;
  satirlar?: StokGirisSatiri[];
  satirSayisi?: number;
  toplamMiktar?: number;
}

export interface TicariSatisSatiri {
  satirNo: number;
  /** Serbest ürün satırında (Hızlı Satış) boş */
  stokKartId: number | null;
  kod: string;
  barkod: string;
  urunAdi: string;
  miktar: number;
  birim: string;
  kdvDahilFiyat: number;
  kdvOrani: number;
  iskontoTuru: number;
  iskontoDegeri: number | null;
  birimFiyat: number;
  tutar: number;
  iskontoTutari: number;
  matrah: number;
  kdvTutari: number;
  toplamTutar: number;
  brutDahil: number;
}

export interface TicariOdeme {
  faturaOdemeId?: number;
  satirNo?: number;
  odemeAraciTuru: number;
  cariKartId?: number | null;
  posCihaziId?: number | null;
  cariKod?: string | null;
  cariUnvan?: string | null;
  paraId?: number | null;
  paraKodu?: string | null;
  paraAdi?: string | null;
  miktar?: number | null;
  kur?: number | null;
  tutar: number;
}

export interface TicariSatisFisi {
  faturaId: number;
  vezneId: number;
  vezneKod: string | null;
  vezneAd: string | null;
  faturaNo: string;
  ettn: string;
  tarih: string;
  senaryo: string;
  cariKartId: number | null;
  cariKod: string | null;
  cariUnvan: string | null;
  aliciVknTckn: string;
  aliciUnvan: string;
  adres: string | null;
  ilce: string | null;
  il: string | null;
  vergiDairesi: string | null;
  eposta: string | null;
  telefon: string | null;
  araToplam: number;
  toplamKdv: number;
  iskontoId: number | null;
  iskontoKodu: string | null;
  iskontoOrani: number;
  iskontoTutari: number;
  iskontoTuru: number;
  iskontoDegeri: number;
  genelToplam: number;
  brutDahil: number;
  toplamIskontoDahil: number;
  eBelgeDurumu: number;
  satirlar: TicariSatisSatiri[];
  odemeler: TicariOdeme[];
}

export interface TicariSatisGirdi {
  faturaId?: number | null;
  vezneId?: number | null;
  faturaNo?: string | null;
  tarih?: string | null;
  senaryo?: string | null;
  cariKartId?: number | null;
  aliciVknTckn?: string | null;
  aliciUnvan?: string | null;
  adres?: string | null;
  ilce?: string | null;
  il?: string | null;
  vergiDairesi?: string | null;
  eposta?: string | null;
  telefon?: string | null;
  iskontoId?: number | null;
  iskontoKodu?: string | null;
  iskontoTuru?: number | null;
  iskontoDegeri?: number | null;
  /** stokKartId boş + urunAdi/kdvOrani dolu: serbest ürün (Hızlı Satış, stoktan düşmez) */
  satirlar: { stokKartId: number | null; urunAdi?: string; birim?: string; kdvOrani?: number; miktar: number; kdvDahilFiyat?: number | null; iskontoTuru?: number | null; iskontoDegeri?: number | null }[];
  odemeler?: TicariOdeme[];
  eksiStokOnay?: boolean;
}

export interface TicariSatisListeSatiri {
  faturaId: number;
  faturaNo: string;
  tarih: string;
  senaryo: string;
  aliciVknTckn: string;
  aliciUnvan: string;
  cariKartId: number | null;
  cariKod: string | null;
  vezneId: number | null;
  vezneKod: string | null;
  satirSayisi: number;
  brutDahil: number;
  iskonto: number;
  matrah: number;
  toplamKdv: number;
  genelToplam: number;
  nakit: number;
  kart: number;
  cari: number;
  havale: number;
  eBelgeDurumu: number;
}

export interface StokDurumSatiri {
  stokKartId: number;
  kod: string;
  ad: string;
  grupAdi: string;
  birim: string;
  giris: number;
  cikis: number;
  bakiye: number;
  enAzStok: number | null;
  eksik: boolean;
  maliyet: number | null;
  deger: number | null;
  sonHareket: string | null;
  aktif: boolean;
}

export interface StokHareketSatiri {
  stokHareketId: number;
  stokKartId: number;
  kod: string;
  ad: string;
  birim: string;
  tarih: string;
  belgeTuru: number;
  belgeTuruAdi: string;
  belgeId: number;
  belgeNo: string;
  karsiTaraf: string;
  giris: number;
  cikis: number;
  birimFiyat: number | null;
  bakiye: number | null;
}

export interface ExcelOnizleme {
  sutunHatalari: string[];
  bilgiler: string[];
  satirlar: { satir: number; deger: Record<string, string>; durum: "YENI" | "GUNCELLE"; eslesenKod: string | null; hatalar: { sutun: string; mesaj: string }[] }[];
  hataliSatir: number;
  yeni: number;
  guncellenecek: number;
  acilisKalemi: number;
  yuklenebilir: boolean;
}

/** Eksi stok uyarısı (409, errors.kod = EKSI_STOK): ekran onay sorup eksiStokOnay ile yeniden gönderir */
export const eksiStokUyarisiMi = (e: any): boolean => e?.status === 409 && e?.kod === "EKSI_STOK";

const temizle = (p: Record<string, any>) => Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== null && v !== ""));

export const TicariService = {
  async yetki(): Promise<{ yonetebilir: boolean; sistemYoneticisi: boolean }> {
    return (await apiClient.get("/ticari/yetki")).data;
  },
  async ayarlar(): Promise<StokAyarlari> {
    return (await apiClient.get("/ticari/ayarlar")).data;
  },
  async ayarKaydet(g: { eksiStok?: string; yetkiliKullanicilar?: number[] }): Promise<StokAyarlari> {
    return (await apiClient.put("/ticari/ayarlar", g)).data;
  },

  async gruplar(): Promise<StokGrup[]> {
    return (await apiClient.get("/ticari/gruplar")).data || [];
  },
  async grupKaydet(g: { stokGrupId?: number | null; ad: string; aktif?: boolean }): Promise<StokGrup> {
    return (g.stokGrupId ? await apiClient.put(`/ticari/gruplar/${g.stokGrupId}`, g) : await apiClient.post("/ticari/gruplar", g)).data;
  },
  async grupSil(id: number): Promise<void> {
    await apiClient.delete(`/ticari/gruplar/${id}`);
  },

  async kartlar(f: { arama?: string; grupId?: number | null; aktif?: boolean | null } = {}): Promise<StokKart[]> {
    return (await apiClient.get("/ticari/kartlar", temizle({ arama: f.arama, grupId: f.grupId, aktif: f.aktif === true ? "1" : f.aktif === false ? "0" : undefined }))).data || [];
  },
  async kart(id: number): Promise<StokKart> {
    return (await apiClient.get(`/ticari/kartlar/${id}`)).data;
  },
  /** Barkod ya da kodla tam eşleşen kart; yoksa null */
  async kartBul(deger: string): Promise<StokKart | null> {
    try {
      return (await apiClient.get(`/ticari/kart-bul/${encodeURIComponent(deger.trim())}`, undefined, { silent: true } as any)).data;
    } catch (e: any) {
      if (e?.status === 404) return null;
      throw e;
    }
  },
  async kartKaydet(g: StokKartGirdi): Promise<StokKart> {
    return (g.stokKartId ? await apiClient.put(`/ticari/kartlar/${g.stokKartId}`, g) : await apiClient.post("/ticari/kartlar", g)).data;
  },
  async kartSil(id: number): Promise<void> {
    await apiClient.delete(`/ticari/kartlar/${id}`);
  },

  async excelOrnek(): Promise<Blob> {
    return dosyaGetir("/ticari/excel/ornek", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  },
  async excelOnizle(dosya: string): Promise<ExcelOnizleme> {
    return (await apiClient.post("/ticari/excel/onizle", { dosya }, { timeoutMs: 120000 } as any)).data;
  },
  async excelYukle(dosya: string): Promise<{ yeni: number; guncellenen: number; acilisFisNo: string | null }> {
    return (await apiClient.post("/ticari/excel/yukle", { dosya }, { timeoutMs: 300000 } as any)).data;
  },

  async girisSiraNo(): Promise<string> {
    return (await apiClient.get("/ticari/giris/sira-no")).data?.fisNo || "";
  },
  async girisListe(f: { baslangic?: string; bitis?: string; cariKartId?: number | null; arama?: string } = {}): Promise<StokGiris[]> {
    return (await apiClient.get("/ticari/giris", temizle(f as any))).data || [];
  },
  async giris(id: number): Promise<StokGiris> {
    return (await apiClient.get(`/ticari/giris/${id}`)).data;
  },
  async girisKaydet(g: { stokGirisId?: number | null; tarih?: string; cariKartId?: number | null; belgeNo?: string; aciklama?: string; vezneId?: number | null;
    satirlar: { stokKartId: number; miktar: number; birimFiyat?: number | null; kdvOrani?: number | null }[]; eksiStokOnay?: boolean }): Promise<{ fis: StokGiris; uyari: string | null }> {
    return (g.stokGirisId ? await apiClient.put(`/ticari/giris/${g.stokGirisId}`, g) : await apiClient.post("/ticari/giris", g)).data;
  },
  async girisSil(id: number, onay = false): Promise<void> {
    await apiClient.delete(`/ticari/giris/${id}${onay ? "?onay=1" : ""}`);
  },

  async satisSiraNo(senaryo: string): Promise<string> {
    return (await apiClient.get("/ticari/satis/sira-no", { senaryo })).data?.faturaNo || "";
  },
  async satisListe(f: { baslangic?: string; bitis?: string; arama?: string; eBelgeDurumu?: number | null; stokKartId?: number | null } = {}): Promise<TicariSatisListeSatiri[]> {
    return (await apiClient.get("/ticari/satis", temizle(f as any))).data || [];
  },
  async satisKimlikler(): Promise<{ faturaId: number; faturaNo: string }[]> {
    return (await apiClient.get("/ticari/satis/kimlikler")).data || [];
  },
  async satis(id: number): Promise<TicariSatisFisi> {
    return (await apiClient.get(`/ticari/satis/${id}`)).data;
  },
  async satisKaydet(g: TicariSatisGirdi): Promise<{ fis: TicariSatisFisi; uyari: string | null }> {
    return (g.faturaId ? await apiClient.put(`/ticari/satis/${g.faturaId}`, g) : await apiClient.post("/ticari/satis", g)).data;
  },
  async satisSil(id: number): Promise<void> {
    await apiClient.delete(`/ticari/satis/${id}`);
  },

  async stokDurum(f: { tarih?: string; grupId?: number | null; arama?: string; yalnizEksik?: boolean; pasifler?: boolean } = {}) {
    return (await apiClient.get("/ticari/rapor/stok-durum", temizle({ ...f, yalnizEksik: f.yalnizEksik ? "1" : undefined, pasifler: f.pasifler ? "1" : undefined }))).data as {
      satirlar: StokDurumSatiri[]; toplam: { kart: number; deger: number; eksik: number; eksiBakiye: number };
    };
  },
  async hareketler(f: { stokKartId?: number | null; baslangic?: string; bitis?: string; belgeTuru?: number | null; grupId?: number | null } = {}) {
    return (await apiClient.get("/ticari/rapor/hareketler", temizle(f as any))).data as {
      satirlar: StokHareketSatiri[]; devirler: { stokKartId: number; kod: string; ad: string; birim: string; devir: number }[]; toplam: { giris: number; cikis: number };
    };
  },
};

export const BIRIM_SECENEKLERI = ["Adet", "Kg", "Gr", "Lt", "Metre", "Paket", "Kutu"];
export const KDV_SECENEKLERI = [0, 1, 10, 20];

export const para = (n: number | null | undefined, hane = 2) =>
  n === null || n === undefined || Number.isNaN(Number(n)) ? "" : Number(n).toLocaleString("tr-TR", { minimumFractionDigits: hane, maximumFractionDigits: hane });
export const miktarYaz = (n: number | null | undefined) =>
  n === null || n === undefined ? "" : Number(n).toLocaleString("tr-TR", { maximumFractionDigits: 4 });
export const tarihYaz = (t: string | null | undefined) => (t ? new Date(t).toLocaleDateString("tr-TR") : "");
export const saatYaz = (t: string | null | undefined) => (t ? new Date(t).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : "");

/** Dosyayı base64 veri adresine çevirir (Excel yükleme, resim) */
export const dosyaOku = (f: File): Promise<string> =>
  new Promise((tamam, hata) => {
    const r = new FileReader();
    r.onload = () => tamam(String(r.result || ""));
    r.onerror = () => hata(new Error("Dosya okunamadı."));
    r.readAsDataURL(f);
  });
