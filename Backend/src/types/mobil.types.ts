import type { MobilErisimSatiri, MobilKullaniciKaydi } from "../models/admin/mobilKullaniciSql.repository.js";
import type { FirmaDto } from "./admin.types.js";

/** Mobil cari oturumu (docs/MOBIL_CARI_YOL_HARITASI.md, Faz 3) */
export interface MobilJwtPayload {
  tur: "MOBIL";
  /** ADM_MOBIL_KULLANICI.MOBIL_KULLANICI_ID */
  mk: number;
  /** ADM_MOBIL_OTURUM.OTURUM_ID */
  sid: string;
  /** Seçili veritabanı (firma); null = seçilmedi */
  fid: number | null;
  iat?: number;
  exp?: number;
}

/** mobilAuthenticate sonrası req.mobil */
export interface MobilBaglam {
  sid: string;
  kullanici: MobilKullaniciKaydi;
  /** Seçili veritabanındaki erişim; şifre değiştirilmeden ya da veritabanı seçilmeden null */
  erisim: MobilErisimSatiri | null;
  firma: FirmaDto | null;
  ctx: { dbServer: string; dbName: string } | null;
  /** Token'daki veritabanı artık kullanılamıyorsa nedeni (kullanıcı başka veritabanı seçer) */
  uyari?: string;
}

export interface MobilVeritabaniSecenegi {
  firmaId: number;
  kisaAd: string;
  unvan: string;
  cariAd: string | null;
}
