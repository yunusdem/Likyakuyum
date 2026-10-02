// POS cihazı entegrasyonu (Inpos + Beko) — docs/POS_ENTEGRASYON_YOL_HARITASI.md

export type DbContext = { dbServer?: string; dbName?: string };

/** Firma bazında admin panelinden yönetilir (K25). test = sahte cihaz, hiçbir şey gitmez. */
export type PosMod = "kapali" | "test" | "canli";
/** yok = entegrasyonsuz cihaz, bugünkü gibi elle çalışır (K23) */
export type PosEntegrasyon = "yok" | "beko" | "inpos";
export type PosDurum = "BEKLIYOR" | "ONAY" | "RET" | "IPTAL" | "BELIRSIZ";
/** deneme = admin test konsolundan gönderilen, belgesiz işlem */
export type PosBelgeTuru = "perakende" | "sarraf" | "deneme";
export type PosBelgeTipi = "earsiv" | "efatura";
/** 0: yok · 1: iade bekliyor · 2: iade edildi */
export type PosIadeDurumu = 0 | 1 | 2;

export const ENTEGRASYONLAR: PosEntegrasyon[] = ["yok", "beko", "inpos"];
export const MODELLER: Record<PosEntegrasyon, string[]> = { yok: [], beko: ["300TR", "X30TR", "400TR"], inpos: ["M530"] };

/** Cevapsız kalan işlem bu süreden sonra Belirsiz'e düşer; cihaz o zamana kadar meşgul sayılır. */
export const ZAMAN_ASIMI_SN: Record<Exclude<PosMod, "kapali">, number> = { test: 30, canli: 180 };

/** Fiziksel cihaz. Muhasebe POS kartından (TODVZ_POS_CIHAZI) ayrıdır (K15). */
export interface PosTerminal {
  posTerminalId: number;
  ad: string;
  entegrasyon: PosEntegrasyon;
  model: string | null;
  sicilNo: string | null;
  /** Beko: Token terminal-id · Inpos: köprüdeki cihaz kimliği */
  terminalKimlik: string | null;
  /** Banka eşlemesi bulunamazsa kullanılacak muhasebe POS kartı */
  posCihaziId: number | null;
  posCihaziKod: string | null;
  posCihaziAd: string | null;
  aktif: boolean;
  /** Boşsa cihazı her vezne kullanabilir (K24) */
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

/** Cihazdan dönen banka → muhasebe POS kartı (K15) */
export interface PosBankaEsleme {
  bankaKodu: string;
  posCihaziId: number;
  posCihaziKod?: string | null;
  posCihaziAd?: string | null;
}

export interface PosIslem {
  posIslemId: number;
  istekKimlik: string;
  posTerminalId: number | null;
  terminalAd: string | null;
  entegrasyon: PosEntegrasyon;
  mod: Exclude<PosMod, "kapali">;
  belgeTuru: PosBelgeTuru;
  belgeId: number | null;
  belgeNo: string | null;
  belgeTipi: PosBelgeTipi;
  tutar: number;
  durum: PosDurum;
  /** Sonuç cihazdan gelmedi, kullanıcı işaretledi (K10, K17, K26) */
  elle: boolean;
  elleKullanici: string | null;
  elleZamani: string | null;
  iadeDurumu: PosIadeDurumu;
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
  surucuRef: string | null;
  posCihaziId: number | null;
  posCihaziKod: string | null;
  posCihaziAd: string | null;
  vezneId: number | null;
  kullanici: string | null;
  olusturma: string;
  sonucZamani: string | null;
  /** Cihaza gönderileli kaç saniye oldu (veritabanı saatiyle) */
  gecenSaniye: number | null;
}

export interface PosIslemOlustur {
  istekKimlik: string;
  posTerminalId: number | null;
  entegrasyon: PosEntegrasyon;
  mod: Exclude<PosMod, "kapali">;
  belgeTuru: PosBelgeTuru;
  belgeId: number | null;
  belgeNo: string | null;
  belgeTipi: PosBelgeTipi;
  tutar: number;
  durum: PosDurum;
  elle: boolean;
  posCihaziId: number | null;
  vezneId: number | null;
  kullaniciId: number | null;
}

/** Sürücünün cihazdan okuduğu sonuç */
export interface SurucuSonuc {
  durum: "ONAY" | "RET" | "IPTAL";
  bankaKodu?: string | null;
  bankaAdi?: string | null;
  taksit?: number | null;
  onayKodu?: string | null;
  kartNo?: string | null;
  cihazFisNo?: string | null;
  zNo?: string | null;
  hata?: string | null;
  ham?: unknown;
}

export interface SurucuIstek {
  islem: PosIslem;
  terminal: PosTerminal;
  aliciAd: string | null;
  /** Sonucun bu sunucuya geri bildirileceği adres (bulut sürücüleri için); yoksa null */
  donusAdresi: string | null;
}

/**
 * Cihaz sürücüsü. Her işlem tek bir kart çekimidir; parçalı ödemede her POS satırı ayrı işlemdir (K7).
 * gonder hata fırlatırsa işlem Ret olur. sorgula sonuç henüz yoksa null döner.
 */
export interface PosSurucu {
  gonder(istek: SurucuIstek): Promise<{ ref: string | null }>;
  sorgula(islem: PosIslem, terminal: PosTerminal): Promise<SurucuSonuc | null>;
  iptal(islem: PosIslem, terminal: PosTerminal): Promise<void>;
  /** Para çekmeden cihaza ulaşılıp ulaşılmadığını sınar; ekranda gösterilecek metni döner */
  baglantiTesti(terminal: PosTerminal): Promise<string>;
  gunSonu(terminal: PosTerminal): Promise<string>;
}

export const kurus = (tutar: number): number => Math.round(tutar * 100);
