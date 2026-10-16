import { sayfaErisimi } from "./modulKatalogu";
import type { KullaniciYetkisi } from "../../Backend/src/services/yetki/kullaniciYetkiKural";
import { HIZLI_SATIS_MODULLERI, HizliSatisModul } from "../../Backend/src/services/hizliSatis/hizliSatisKural";

/**
 * Hızlı Satış modül sekmeleri (docs/HIZLI_SATIS_YOL_HARITASI.md, H2–H3). Her modülün hızlı satışı kendi menü maddesiyle
 * (vezne:hizli-satis/sarraf …) firma bazında açılıp kapanır; sekmede yalnız açık olanlar görünür.
 */
export const hizliSatisYolu = (m: HizliSatisModul): string => `/hizli-satis/${m}`;

/** Lisansta ve (verilirse) kullanıcının menü yetkisinde açık hızlı satış modülleri */
export const acikHizliSatisModulleri = (acik: string[] | null | undefined, yetki?: KullaniciYetkisi | null): HizliSatisModul[] =>
  HIZLI_SATIS_MODULLERI.filter((m) => sayfaErisimi(acik, yetki, hizliSatisYolu(m)));

const SON_MODUL_ANAHTARI = "hizliSatis.sonModul";

export const sonModulOku = (): string | null => {
  try {
    return localStorage.getItem(SON_MODUL_ANAHTARI);
  } catch {
    return null;
  }
};

export const sonModulYaz = (m: HizliSatisModul): void => {
  try {
    localStorage.setItem(SON_MODUL_ANAHTARI, m);
  } catch {
    /* tarayıcı depolaması kapalı: hatırlanmaz */
  }
};

/** Üst kısayol (/hizli-satis): en son kullanılan modül açıksa o, değilse ilk açık modül (H2) */
export const acilisModulu = (acik: string[] | null | undefined, son: string | null, yetki?: KullaniciYetkisi | null): HizliSatisModul | null => {
  const liste = acikHizliSatisModulleri(acik, yetki);
  if (son && (liste as string[]).includes(son)) return son as HizliSatisModul;
  return liste[0] ?? null;
};
