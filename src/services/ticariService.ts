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
  /** Karta özel eksi stok davranışı; null = Stok Ayarları'ndaki genel davranış (İş 9, G22) */
  stokKontrol: "UYAR" | "ENGELLE" | "SESSIZ" | null;
  /** Tedarikçi cari (İş 11, G10) */
  tedarikciCariId: number | null;
  tedarikciAd: string | null;
  /** İstekte liste verildiyse o listedeki fiyat; null → ana fiyat (satisFiyati) geçerli */
  listeFiyati?: number | null;
  /** Kart ayrıntısında tanımlı listelerdeki fiyatlar */
  listeFiyatlari?: { fiyatListesiId: number; ad: string; fiyat: number | null }[];
}

export interface FiyatIslemiGirdi {
  hedef: { tur: "grup" | "tedarikci" | "secili" | "tumu"; grupId?: number | null; cariId?: number | null; kartIdler?: number[] | null };
  fiyatListesiId?: number | null;
  alan: "satis" | "alis";
  islem: { tur: "yuzde" | "tutar" | "alisKar"; deger: number };
  yuvarlama: "kurus" | "tl" | "99";
  paraId?: number | null;
  pasifler?: boolean;
  aciklama?: string | null;
}
export interface FiyatIslemiSatiri { stokKartId: number; kod: string; ad: string; paraKodu: string; eski: number | null; yeni: number | null; atlandi: "para" | "alisYok" | "fiyatYok" | null }
export interface FiyatIslemiOnizleme { satirlar: FiyatIslemiSatiri[]; toplam: number; degisecek: number; atlanan: number; kesildi: boolean }
export interface FiyatIslemiGecmisKaydi { islemNo: number; tarih: string | null; alan: string; fiyatListesiId: number | null; listeAdi: string | null; aciklama: string; kart: number; kullaniciAdi: string | null; geriAlindi: boolean }

export interface Kampanya {
  kampanyaId: number; ad: string; baslangic: string; bitis: string; tur: 1 | 2; deger: number; hedefTuru: 1 | 2 | 3; aktif: boolean; aciklama: string | null;
  gruplar: { stokGrupId: number; ad: string }[]; kartlar: { stokKartId: number; kod: string; ad: string }[]; yururlukte: boolean;
}
export interface KampanyaGirdi {
  kampanyaId?: number | null; ad: string; baslangic: string; bitis: string; tur: 1 | 2; deger: number | string; hedefTuru: 1 | 2 | 3;
  grupIdler?: number[]; kartIdler?: number[]; aktif?: boolean; aciklama?: string | null;
}
import type { AktifKampanya } from "../../Backend/src/services/ticari/ticariHesap";
export type { AktifKampanya };

export interface FiyatListesi {
  fiyatListesiId: number;
  ad: string;
  aktif: boolean;
  sira: number;
  kartSayisi: number;
  cariSayisi: number;
}

/** Kartın geçerli KDV dahil fiyatı için liste fiyatı varsa o, yoksa ana fiyat */
export const kartSatisFiyati = (k: Pick<StokKart, "satisFiyati" | "listeFiyati">): number | null => (k.listeFiyati !== null && k.listeFiyati !== undefined ? k.listeFiyati : k.satisFiyati);

export const STOK_KONTROL_SECENEKLERI: { kod: string; ad: string }[] = [
  { kod: "", ad: "Ayarı kullan (Stok Ayarları)" }, { kod: "UYAR", ad: "Uyar ama sat" }, { kod: "ENGELLE", ad: "Engelle (eksiye düşemez)" }, { kod: "SESSIZ", ad: "Sessizce sat" },
];

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
  stokKontrol?: string | null;
  tedarikciCariId?: number | null;
  listeFiyatlari?: { fiyatListesiId: number; fiyat: number | string | null }[];
}

export const ETIKET_ALANLARI: { kod: EtiketAlani; ad: string }[] = [
  { kod: "ad", ad: "Ürün adı" }, { kod: "kod", ad: "Kod" }, { kod: "grup", ad: "Grup" }, { kod: "fiyat", ad: "Fiyat" }, { kod: "birim", ad: "Birim" },
];
export type EtiketAlani = "ad" | "kod" | "grup" | "fiyat" | "birim";
export interface EtiketDuzeni {
  genislikMm: number;
  yukseklikMm: number;
  barkodTipi: "CODE128" | "QR";
  alanlar: EtiketAlani[];
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
  /** Satıra uygulanan kampanya (İş 11) */
  kampanyaId?: number | null;
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
  /** Kullanılan fiyat listesi (İş 11); null = ana liste */
  fiyatListesiId?: number | null;
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
  satirlar: { stokKartId: number | null; urunAdi?: string; birim?: string; kdvOrani?: number; miktar: number; kdvDahilFiyat?: number | null; iskontoTuru?: number | null; iskontoDegeri?: number | null; kampanyaId?: number | null }[];
  odemeler?: TicariOdeme[];
  eksiStokOnay?: boolean;
  /** Kullanılan fiyat listesi (İş 11, G7); yoksa ana liste */
  fiyatListesiId?: number | null;
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

  // Fiyat listeleri (İş 11, G6–G9)
  async fiyatListeleri(yalnizAktif = false): Promise<FiyatListesi[]> {
    return (await apiClient.get("/ticari/fiyat-listeleri", temizle({ aktif: yalnizAktif ? "1" : undefined }))).data || [];
  },
  async fiyatListesiKaydet(g: { fiyatListesiId?: number | null; ad: string; aktif?: boolean; sira?: number | null }): Promise<FiyatListesi> {
    return (g.fiyatListesiId ? await apiClient.put(`/ticari/fiyat-listeleri/${g.fiyatListesiId}`, g) : await apiClient.post("/ticari/fiyat-listeleri", g)).data;
  },
  async fiyatListesiSil(id: number): Promise<void> {
    await apiClient.delete(`/ticari/fiyat-listeleri/${id}`);
  },
  async fiyatListesiCarileri(id: number): Promise<{ cariKartId: number; kod: string; unvan: string }[]> {
    return (await apiClient.get(`/ticari/fiyat-listeleri/${id}/cariler`)).data || [];
  },
  /** Carinin varsayılan fiyat listesi; yoksa null (ana liste) */
  async cariFiyatListesi(cariKartId: number): Promise<{ fiyatListesiId: number; ad: string } | null> {
    return (await apiClient.get(`/ticari/cari-fiyat-listesi/${cariKartId}`, undefined, { silent: true } as any)).data ?? null;
  },
  async cariFiyatListesiKaydet(cariKartId: number, fiyatListesiId: number | null): Promise<{ fiyatListesiId: number; ad: string } | null> {
    return (await apiClient.put(`/ticari/cari-fiyat-listesi/${cariKartId}`, { fiyatListesiId })).data ?? null;
  },

  // Kampanyalar (İş 11, G12)
  async kampanyalar(): Promise<Kampanya[]> {
    return (await apiClient.get("/ticari/kampanyalar")).data || [];
  },
  async aktifKampanyalar(): Promise<AktifKampanya[]> {
    return (await apiClient.get("/ticari/kampanyalar/aktif", undefined, { silent: true } as any)).data || [];
  },
  async kampanyaKaydet(g: KampanyaGirdi): Promise<Kampanya> {
    return (g.kampanyaId ? await apiClient.put(`/ticari/kampanyalar/${g.kampanyaId}`, g) : await apiClient.post("/ticari/kampanyalar", g)).data;
  },
  async kampanyaSil(id: number): Promise<void> {
    await apiClient.delete(`/ticari/kampanyalar/${id}`);
  },

  // Toplu fiyat işlemleri (İş 11, G11, G13, G14)
  async fiyatIslemiOnizle(g: FiyatIslemiGirdi): Promise<FiyatIslemiOnizleme> {
    return (await apiClient.post("/ticari/fiyat-islemi/onizle", g, { timeoutMs: 90000 } as any)).data;
  },
  async fiyatIslemiUygula(g: FiyatIslemiGirdi): Promise<{ islemNo: number; degisen: number; atlanan: number }> {
    return (await apiClient.post("/ticari/fiyat-islemi/uygula", g, { timeoutMs: 180000 } as any)).data;
  },
  async fiyatIslemiGeriAl(islemNo: number): Promise<{ islemNo: number; degisen: number }> {
    return (await apiClient.post("/ticari/fiyat-islemi/geri-al", { islemNo }, { timeoutMs: 180000 } as any)).data;
  },
  async fiyatIslemiGecmis(): Promise<FiyatIslemiGecmisKaydi[]> {
    return (await apiClient.get("/ticari/fiyat-islemi/gecmis")).data || [];
  },

  // Ticari etiket düzeni (İş 2, G5)
  async etiketDuzeni(): Promise<EtiketDuzeni> {
    return (await apiClient.get("/ticari/etiket-duzeni")).data;
  },
  async etiketDuzeniKaydet(d: EtiketDuzeni): Promise<EtiketDuzeni> {
    return (await apiClient.put("/ticari/etiket-duzeni", d)).data;
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
  /** Gruba kart ekleme / çıkarma (İş 10, G15) */
  async grupKartlari(id: number, g: { ekle?: number[]; cikar?: number[] }): Promise<{ eklenen: number; cikarilan: number; tasinan: number }> {
    return (await apiClient.put(`/ticari/gruplar/${id}/kartlar`, g)).data;
  },

  /** Sınırlı liste (varsayılan 500, en çok 2.000). idler: yalnız verilen kartlar (hızlı satış butonları, açık fişin satırları). liste: fiyat listesi → listeFiyati */
  async kartlar(f: { arama?: string; grupId?: number | null; aktif?: boolean | null; idler?: number[]; limit?: number; liste?: number | null } = {}): Promise<StokKart[]> {
    if (f.idler && !f.idler.length) return [];
    return (await apiClient.get("/ticari/kartlar", temizle({
      arama: f.arama, grupId: f.grupId, aktif: f.aktif === true ? "1" : f.aktif === false ? "0" : undefined,
      idler: f.idler ? [...new Set(f.idler.map(Number).filter((x) => x > 0))].join(",") : undefined, limit: f.limit, liste: f.liste || undefined,
    }))).data || [];
  },
  /** Sayfalı liste (G2): sayfa 1'den başlar, adet en çok 500 */
  async kartlarSayfali(f: { arama?: string; grupId?: number | null; aktif?: boolean | null; sayfa?: number; adet?: number; liste?: number | null } = {}): Promise<{ kartlar: StokKart[]; toplam: number; sayfa: number; adet: number }> {
    const r = (await apiClient.get("/ticari/kartlar/sayfali", temizle({
      arama: f.arama, grupId: f.grupId, aktif: f.aktif === true ? "1" : f.aktif === false ? "0" : undefined, sayfa: f.sayfa, adet: f.adet, liste: f.liste || undefined,
    }))).data;
    return { kartlar: r?.kartlar || [], toplam: Number(r?.toplam) || 0, sayfa: Number(r?.sayfa) || 1, adet: Number(r?.adet) || 200 };
  },
  async kart(id: number, liste?: number | null): Promise<StokKart> {
    return (await apiClient.get(`/ticari/kartlar/${id}`, temizle({ liste: liste || undefined }))).data;
  },
  /** Barkod ya da kodla tam eşleşen kart; yoksa null. liste: fiyat listesi → listeFiyati */
  async kartBul(deger: string, liste?: number | null): Promise<StokKart | null> {
    try {
      return (await apiClient.get(`/ticari/kart-bul/${encodeURIComponent(deger.trim())}`, temizle({ liste: liste || undefined }), { silent: true } as any)).data;
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
    // Büyük firmada (200.000 kart) rapor birkaç saniye sürer; genel 15 sn zaman aşımı yerine 90 sn
    return (await apiClient.get("/ticari/rapor/stok-durum", temizle({ ...f, yalnizEksik: f.yalnizEksik ? "1" : undefined, pasifler: f.pasifler ? "1" : undefined }), { timeoutMs: 90000 } as any)).data as {
      satirlar: StokDurumSatiri[]; toplam: { kart: number; deger: number; eksik: number; eksiBakiye: number }; kesildi?: boolean; sinir?: number;
    };
  },
  async hareketler(f: { stokKartId?: number | null; baslangic?: string; bitis?: string; belgeTuru?: number | null; grupId?: number | null } = {}) {
    return (await apiClient.get("/ticari/rapor/hareketler", temizle(f as any), { timeoutMs: 90000 } as any)).data as {
      satirlar: StokHareketSatiri[]; devirler: { stokKartId: number; kod: string; ad: string; birim: string; devir: number }[]; toplam: { giris: number; cikis: number };
      toplamSatir?: number; kesildi?: boolean; sinir?: number;
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
