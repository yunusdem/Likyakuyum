import crypto from "crypto";
import sql from "mssql";
import { env } from "../../config/env.config.js";
import { kurulumHavuzu } from "./kurulumDb.js";

/**
 * Kurulum (exe) oturumlarında kullanıcı kartı denetimi (docs/BULUT_VE_EXE_LISANS_YOL_HARITASI.md §14 D11).
 * Bulutta oturum kaydı merkezdedir; kurulumda yoktur. Jeton 30 gün geçerli olduğu için silinen kullanıcı ya da şifresi
 * değiştirilen kullanıcının eski jetonu kabul ediliyordu. Her istekte kart (60 sn önbellekle) okunur: kart yoksa ya da
 * jetondaki şifre damgası karttaki şifreyle uyuşmuyorsa oturum düşer.
 */

const ONBELLEK_MS = 60 * 1000;
const onbellek = new Map<string, { zaman: number; kart: { damga: string } | null }>();
/** Temizlik sayacı: temizlikten önce başlamış bir okuma eski şifreyi önbelleğe geri yazmasın (E17) */
const surum = new Map<string, number>();

/**
 * Şifre özetinin kısa damgası (jetona yazılır; şifrenin kendisi ya da özeti jetonda taşınmaz). Anahtarlı (HMAC):
 * eski düz metin şifrelerde anahtarsız özet, jetonu ele geçirenin zayıf şifreyi çevrimdışı denemesine açıktı (E16).
 */
export const sifreDamgasi = (sifreOzeti: string | null | undefined): string =>
  crypto
    .createHmac("sha256", env.JWT_ACCESS_SECRET || "likya-sd")
    .update(`likya-sd|${sifreOzeti || ""}`)
    .digest("base64url")
    .slice(0, 16);

/** Kullanıcı kartı ve şifre damgası; kart yoksa null. `taze`: önbelleğe bakılmaz (damga uyuşmazlığında bir kez) */
export const kurulumKarti = async (userId: unknown, taze = false): Promise<{ damga: string } | null> => {
  const id = Number(userId);
  if (!Number.isInteger(id) || id <= 0) return null;
  const anahtar = String(id);
  const k = onbellek.get(anahtar);
  if (!taze && k && Date.now() - k.zaman < ONBELLEK_MS) return k.kart;
  const s0 = surum.get(anahtar) ?? 0;
  const pool = await kurulumHavuzu();
  const r = await pool.request().input("K", sql.Int, id).query(`SELECT SIFRE FROM dbo.TODVZ_KULLANICI WHERE KULLANICI_ID = @K`);
  const satir = r.recordset[0];
  const kart = satir ? { damga: sifreDamgasi(String(satir.SIFRE ?? "").trim()) } : null;
  if ((surum.get(anahtar) ?? 0) === s0) onbellek.set(anahtar, { zaman: Date.now(), kart });
  return kart;
};

/** Kart silinince ya da şifresi değişince önbellekten düşer: eski jeton bir sonraki istekte reddedilir */
export const kurulumKartOnbelleginiTemizle = (userId: unknown): void => {
  const anahtar = String(Number(userId));
  onbellek.delete(anahtar);
  surum.set(anahtar, (surum.get(anahtar) ?? 0) + 1);
};
