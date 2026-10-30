import { Request } from "express";
import { KullaniciGorunumRepository, MODUL_KODU_SINIRI } from "../../models/kullaniciGorunum.repository.js";
import { FirmaKullaniciMerkezService } from "../firmaKullaniciMerkez.service.js";
import { kullaniciYetkisi } from "../yetki/kullaniciYetkisi.js";

/**
 * Kullanıcı görünümü (docs/KULLANICI_GORUNUM_YOL_HARITASI.md): yöneticinin çalışana kapattığı modül kodları.
 * G2: etkin liste = firma lisansı − kapalılar. G5: yöneticiye (merkez açıkken firma yöneticisi, değilse sistem
 * yöneticisi; Kullanıcı Tanımları'ndaki kuralla aynı) uygulanmaz ve ayarı yalnız yönetici değiştirir.
 */

/** Katalog kodu (vezne, vezne:vezne/sarraf-fisi-kayit, raporlar:#vezne-raporlari, ust:kur) ya da kontrol düğmesi (kontrol:tema) */
export const MODUL_KODU_DESENI = /^[a-z0-9-]+(:[a-z0-9#/._-]+)?$/;

export const gecerliKodMu = (kod: unknown): kod is string =>
  typeof kod === "string" && kod.length > 0 && kod.length <= MODUL_KODU_SINIRI && MODUL_KODU_DESENI.test(kod);

/** Görünüm ayarını yöneten / görünümden muaf kullanıcı mı (G5) */
export const gorunumYoneticisiMi = async (req: Request): Promise<boolean> => {
  try {
    const merkez = await FirmaKullaniciMerkezService.baglam(req.user).catch(() => null);
    if (merkez) return !!merkez.kullanici.firmaYoneticisi;
    return (await kullaniciYetkisi(req)).yonetici;
  } catch {
    return req.user?.role === "admin";
  }
};

const baglam = (req: Request) => ({ dbServer: req.user?.dbServer, dbName: req.user?.dbName });

const ONBELLEK = Symbol("oturumKapalilari");

/** Oturum kullanıcısının kapalı kodları; yöneticide boş (G5). Kaydı olmayan kullanıcıda boş. İstek başına bir kez okunur. */
export const oturumKapalilari = async (req: Request): Promise<string[]> => {
  const r = req as any;
  if (r[ONBELLEK]) return r[ONBELLEK];
  const id = Number(req.user?.userId);
  if (!Number.isInteger(id) || id <= 0) return [];
  const kapali = await KullaniciGorunumRepository.kapalilar(id, baglam(req));
  const sonuc = !kapali.length || (await gorunumYoneticisiMi(req)) ? [] : kapali;
  r[ONBELLEK] = sonuc;
  return sonuc;
};

/** Belirli bir kullanıcı için (giriş / profil yanıtı): yöneticiyse boş */
export const kullaniciKapalilari = async (
  kullaniciId: number | string,
  yonetici: boolean,
  ctx?: { dbServer?: string; dbName?: string }
): Promise<string[]> => {
  if (yonetici) return [];
  const id = Number(kullaniciId);
  if (!Number.isInteger(id) || id <= 0) return [];
  return KullaniciGorunumRepository.kapalilar(id, ctx);
};

/**
 * Firma lisansı − kapalılar (G2). acik null (kısıtsız) ise sunucu kataloğu bilmediği için null kalır; ön yüz kendi
 * kataloğundan düşer. Kapalı liste boşsa liste olduğu gibi döner (aynı dizi; önbellek karşılaştırmaları bozulmasın).
 */
export const etkinModuller = (acik: string[] | null, kapali: string[]): string[] | null => {
  if (!acik || !kapali.length) return acik;
  const k = new Set(kapali);
  return acik.filter((kod) => !k.has(kod));
};
