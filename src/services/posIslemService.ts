import { apiClient } from "./apiClient";

// POS cihazı entegrasyonu (Inpos + Beko) — docs/POS_ENTEGRASYON_YOL_HARITASI.md

/** Firmanın POS modu; yönetim panelinden belirlenir. test = örnek cihaz, hiçbir yere istek gitmez. */
export type PosMod = "kapali" | "test" | "canli";
/** yok = entegrasyonsuz cihaz: tutar cihaza elle girilir, program yalnızca kaydını tutar */
export type PosEntegrasyon = "yok" | "beko" | "inpos";
export type PosDurum = "BEKLIYOR" | "ONAY" | "RET" | "IPTAL" | "BELIRSIZ";
export type PosBelgeTuru = "perakende" | "sarraf";
export type PosBelgeTipi = "earsiv" | "efatura";

/** Fiziksel cihaz. Muhasebe POS kartından (B- POS Cihazı Tanımları) ayrıdır. */
export interface PosTerminal {
  posTerminalId: number;
  ad: string;
  entegrasyon: PosEntegrasyon;
  model: string | null;
  sicilNo: string | null;
  terminalKimlik: string | null;
  posCihaziId: number | null;
  posCihaziKod: string | null;
  posCihaziAd: string | null;
  aktif: boolean;
  /** Boşsa cihazı her vezne kullanabilir */
  vezneIdler: number[];
}

export interface PosTerminalKaydet {
  posTerminalId?: number | null;
  ad: string;
  entegrasyon: PosEntegrasyon;
  model: string | null;
  sicilNo: string | null;
  terminalKimlik: string | null;
  posCihaziId: number | null;
  aktif: boolean;
  vezneIdler: number[];
}

export interface PosBankaEsleme {
  bankaKodu: string;
  posCihaziId: number;
  posCihaziKod?: string | null;
  posCihaziAd?: string | null;
}

export interface PosIslem {
  posIslemId: number;
  istekKimlik: string;
  /** Aynı fişte birlikte gönderilen POS satırlarının ortak kimliği (fiş başına tek sipariş); tek satırda null */
  grupKimlik: string | null;
  posTerminalId: number | null;
  terminalAd: string | null;
  entegrasyon: PosEntegrasyon;
  mod: "test" | "canli";
  belgeTuru: PosBelgeTuru | "deneme";
  belgeId: number | null;
  belgeNo: string | null;
  belgeTipi: PosBelgeTipi;
  tutar: number;
  durum: PosDurum;
  /** Sonuç cihazdan gelmedi, kullanıcı işaretledi */
  elle: boolean;
  elleKullanici: string | null;
  elleZamani: string | null;
  /** 0: yok · 1: iade bekliyor · 2: iade edildi */
  iadeDurumu: 0 | 1 | 2;
  iadeKullanici: string | null;
  iadeZamani: string | null;
  bankaKodu: string | null;
  bankaAdi: string | null;
  taksit: number | null;
  onayKodu: string | null;
  kartNo: string | null;
  cihazFisNo: string | null;
  zNo: string | null;
  hata: string | null;
  posCihaziId: number | null;
  posCihaziKod: string | null;
  posCihaziAd: string | null;
  vezneId: number | null;
  kullanici: string | null;
  olusturma: string;
  sonucZamani: string | null;
  gecenSaniye: number | null;
}

export interface PosDurumBilgisi {
  mod: PosMod;
  terminaller: PosTerminal[];
}

export interface PosTanimlar {
  mod: PosMod;
  terminaller: PosTerminal[];
  bankaEslemeleri: PosBankaEsleme[];
  modeller: Record<PosEntegrasyon, string[]>;
}

export interface PosTahsilatGirdi {
  /** Her çekim denemesi için yeni üretilir; aynı kimlik ikinci kez giderse cihaza yeniden gönderilmez */
  istekKimlik: string;
  posTerminalId: number | null;
  tutar: number;
  belgeTuru: PosBelgeTuru;
  belgeId?: number | null;
  belgeNo?: string | null;
  belgeTipi: PosBelgeTipi;
  posCihaziId?: number | null;
  vezneId?: number | null;
  aliciAd?: string | null;
  /** Alıcının VKN / TCKN'si (bilgi fişine basılır) */
  aliciVkn?: string | null;
}

/** Fiş cihaza gönderilmeden önce tahsil edilmiş kısım (nakit / havale / cari); cihaz yalnız kart tutarını çeker */
export interface PosPesinOdeme {
  tur: "nakit" | "havale" | "cari";
  tutar: number;
}

/** Fişin ürün satırı; cihazdaki bilgi fişinde kalem olarak basılır. tutar KDV dahil satır toplamı. */
export interface PosKalem {
  ad: string;
  miktar: number;
  tutar: number;
  kdvOrani: number;
}

/** Fiş başına tek sipariş (Inpos): aynı fişin bütün POS satırları birlikte gider */
export interface PosTopluGirdi {
  grupKimlik: string;
  posTerminalId: number | null;
  satirlar: { istekKimlik: string; tutar: number; posCihaziId?: number | null }[];
  pesinOdemeler: PosPesinOdeme[];
  kalemler?: PosKalem[];
  belgeTuru: PosBelgeTuru;
  belgeId?: number | null;
  belgeNo?: string | null;
  belgeTipi: PosBelgeTipi;
  vezneId?: number | null;
  aliciAd?: string | null;
  aliciVkn?: string | null;
}

export interface PosBankaHareketi {
  vomsisId: number;
  islemTarihi: string | null;
  saat: string | null;
  bankaAdi: string;
  kartNo: string | null;
  brut: number;
  taksitSayisi: number | null;
  provizyonNo: string | null;
  /** Eşleştiği tahsilat; yoksa null */
  posIslemId: number | null;
}

export interface PosIslemListesi {
  mod: PosMod;
  satirlar: (PosIslem & { vomsisId: number | null })[];
  toplam: number;
  bankaHareketleri: PosBankaHareketi[];
  terminaller: { posTerminalId: number; ad: string }[];
}

export interface PosIslemFiltre {
  baslangic: string;
  bitis: string;
  durum?: string;
  posTerminalId?: number;
  arama?: string;
  sayfa?: number;
  sayfaBoyutu?: number;
}

export class PosIslemService {
  public static async getDurum(vezneId?: number | null): Promise<PosDurumBilgisi> {
    return (await apiClient.get<PosDurumBilgisi>("/pos/durum", { vezneId: vezneId || undefined })).data;
  }

  public static async getTanimlar(): Promise<PosTanimlar> {
    return (await apiClient.get<PosTanimlar>("/pos/tanimlar")).data;
  }

  public static async terminalKaydet(dto: PosTerminalKaydet): Promise<PosTerminal> {
    return (await apiClient.post<PosTerminal>("/pos/terminaller", dto)).data;
  }

  public static async terminalSil(posTerminalId: number): Promise<void> {
    await apiClient.delete(`/pos/terminaller/${posTerminalId}`);
  }

  public static async baglantiTesti(posTerminalId: number): Promise<{ mod: PosMod; ayrinti: string }> {
    return (await apiClient.post<{ mod: PosMod; ayrinti: string }>(`/pos/terminaller/${posTerminalId}/baglanti-testi`)).data;
  }

  public static async gunSonu(posTerminalId: number): Promise<{ mod: PosMod; ayrinti: string }> {
    return (await apiClient.post<{ mod: PosMod; ayrinti: string }>(`/pos/terminaller/${posTerminalId}/gun-sonu`)).data;
  }

  public static async bankaEslemeleriniYaz(eslemeler: { bankaKodu: string; posCihaziId: number }[]): Promise<PosBankaEsleme[]> {
    return (await apiClient.put<PosBankaEsleme[]>("/pos/banka-eslemeleri", { eslemeler })).data;
  }

  /** Tutarı cihaza gönderir. Sonuç sonradan gelir: getIslem ile yoklanır. */
  public static async baslat(girdi: PosTahsilatGirdi): Promise<PosIslem> {
    return (await apiClient.post<PosIslem>("/pos/islemler", girdi)).data;
  }

  /** Fiş başına tek sipariş: satırlar birlikte cihaza gider, her satır için işlem döner (satır sırasıyla). */
  public static async baslatToplu(girdi: PosTopluGirdi): Promise<PosIslem[]> {
    return (await apiClient.post<PosIslem[]>("/pos/islemler/toplu", girdi)).data || [];
  }

  /** Cihaza hiç göndermeden "alındı" kaydı açar. */
  public static async elleAlindi(girdi: PosTahsilatGirdi): Promise<PosIslem> {
    return (await apiClient.post<PosIslem>("/pos/islemler/elle-alindi", girdi)).data;
  }

  public static async getIslem(posIslemId: number): Promise<PosIslem> {
    return (await apiClient.get<PosIslem>(`/pos/islemler/${posIslemId}`)).data;
  }

  public static async iptal(posIslemId: number): Promise<PosIslem> {
    return (await apiClient.post<PosIslem>(`/pos/islemler/${posIslemId}/iptal`)).data;
  }

  public static async elleIsaretle(posIslemId: number, alindi: boolean): Promise<PosIslem> {
    return (await apiClient.post<PosIslem>(`/pos/islemler/${posIslemId}/elle`, { alindi })).data;
  }

  public static async iadeIsaretle(posIslemId: number, iadeDurumu: 0 | 1 | 2): Promise<PosIslem> {
    return (await apiClient.post<PosIslem>(`/pos/islemler/${posIslemId}/iade`, { iadeDurumu })).data;
  }

  public static async belgeyeBagla(posIslemIdler: number[], belgeTuru: PosBelgeTuru, belgeId: number, belgeNo?: string | null): Promise<void> {
    await apiClient.post("/pos/islemler/belgeye-bagla", { posIslemIdler, belgeTuru, belgeId, belgeNo: belgeNo || null });
  }

  public static async getBelgeIslemleri(belgeTuru: PosBelgeTuru, belgeId: number): Promise<PosIslem[]> {
    return (await apiClient.get<PosIslem[]>("/pos/islemler/belge", { belgeTuru, belgeId })).data || [];
  }

  public static async getIslemler(filtre: PosIslemFiltre): Promise<PosIslemListesi> {
    return (await apiClient.get<PosIslemListesi>("/pos/islemler", filtre)).data;
  }
}
