/**
 * ICE Teknoloji entegratör servisi tipleri.
 *
 * Kaynak: docs/ice/integration-2026-09-09.wsdl (canlı WSDL, 100 operasyon)
 * Paketteki 2020 tarihli WSDL değil — bkz. docs/ice-baglanti.md §3.
 */

/** Login sonrası dönen, sonraki her çağrının gövdesine konan oturum başlığı */
export interface IceLoginHeader {
  Session_ID: string;
  IP_Number: string;
  Security_Key: string;
}

/** Login cevabındaki hata bloğu */
export interface IceLoginException {
  Error_Code?: number;
  Message?: string;
  IP_Number?: string;
  /** Hatalı giriş denemesi sayısı — 0'dan büyükse otomatik yeniden deneme durdurulur */
  Number_Of_Incorrect?: number;
}

export interface IceLoginResult {
  isSuccecss: boolean; // WSDL'deki yazım hatası birebir korunuyor
  Exception_Type?: IceLoginException;
  Login_Request_Header?: IceLoginHeader;
}

/** ICE'nin döndürdüğü fault kodları (dokümantasyon #18) */
export type IceFaultCode =
  | "TIMEOUT"
  | "ERROR"
  | "FORMAT"
  | "NOTFOUND"
  | "EXISTS"
  | "AUTHORIZATION";

/** Bağlantı ayarları — TODVZ_EBELGE_AYAR tablosunun çözülmüş hali */
export interface IceConnectionConfig {
  servisUrl: string;
  kullaniciAdi: string;
  sifre: string;
  uygulamaAdi: string;
  uygulamaSurum: string;
  /** Oturum önbelleği anahtarı için — çok kiracılı ayrım */
  dbServer?: string;
  dbName?: string;
}

/** Bir SOAP çağrısının denetim kaydı için özet bilgisi */
export interface IceCallTrace {
  metod: string;
  basarili: boolean;
  faultKodu?: string;
  hataMesaji?: string;
  sureMs: number;
}

/** ice.client.ts çağrı sonucu */
export interface IceCallResult<T = any> {
  data: T;
  trace: IceCallTrace;
}

/** Belge türleri — canlı WSDL'deki Belge_Turu enum'u birebir */
export const ICE_BELGE_TURLERI = [
  "EFatura",
  "EArsiv",
  "EMustahsil",
  "ESMM",
  "EDoviz",
  "EAdisyon",
  "EGiderPusulasi",
  "EIrsaliye",
  "EIrsaliyeYanit",
] as const;

export type IceBelgeTuru = (typeof ICE_BELGE_TURLERI)[number];

/** Ayar kaydının API'ye dönen, şifresi maskelenmiş hali */
export interface EbelgeAyarView {
  id: number;
  ortam: "CANLI" | "TEST";
  servisUrl: string;
  kullaniciAdi: string;
  /** Şifre asla dönmez; yalnızca tanımlı olup olmadığı bildirilir */
  sifreTanimli: boolean;
  uygulamaAdi: string;
  uygulamaSurum: string;
  firmaVkn: string;
  firmaAlias: string;
  /** UBL-TR'de adreste zorunlu: gönderici il / ilçe */
  firmaIl: string;
  firmaIlce: string;
  aktif: boolean;
  guncelleyen: string | null;
  guncellemeTarihi: Date | null;
}

/** Bağlantı testi sonucu */
export interface EbelgeBaglantiTestSonucu {
  servisAyakta: boolean;
  healthCevabi: string | null;
  girisBasarili: boolean;
  hataMesaji: string | null;
  hataliDenemeSayisi: number | null;
  kontor: IceKontorSatiri[] | null;
  sureMs: number;
}

/** Get_Credit cevabındaki kontör satırı (DataSet olarak geliyor, alanlar esnek) */
export interface IceKontorSatiri {
  [alan: string]: string | number | null;
}
