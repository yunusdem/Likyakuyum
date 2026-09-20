import { env } from "../config/env.config.js";
import { HttpStatus } from "../constants/httpStatusCodes.js";
import { IzlemeSqlRepository, OturumDurumu } from "../models/admin/izlemeSql.repository.js";
import { JwtPayload } from "../types/auth.types.js";
import { ApiError } from "../utils/ApiError.js";

/**
 * Kullanıcı oturumlarının merkezde izlenmesi (docs/ADMIN_PANEL_YOL_HARITASI.md, Faz 5). Token 30 gün geçerli olduğu
 * için dondurma / pasife alma / oturum kapatma ancak her istekte oturumun (token'daki sid) merkezden doğrulanmasıyla
 * anında etkili olur. Sonuç kısa süre önbelleklenir; yönetim panelindeki ilgili her işlem önbelleği temizler.
 * MERKEZ_GIRIS kapalıyken hiçbir şey yapmaz.
 */

const ONBELLEK_MS = 30_000;
const onbellek = new Map<string, { durum: OturumDurumu; zaman: number }>();

const NEDEN_MESAJI: Record<NonNullable<OturumDurumu["neden"]>, string> = {
  OTURUM_KAPALI: "Oturumunuz sonlandırıldı. Lütfen tekrar giriş yapınız.",
  KULLANICI_PASIF: "Kullanıcı hesabınız kapatılmış.",
  FIRMA_DONDURULDU: "Hesabınız donduruldu. Lütfen hizmet sağlayıcınızla iletişime geçiniz.",
  FIRMA_PASIF: "Bu hesap kullanımda değil.",
  LISANS_BITTI: "Hesabınız donduruldu: lisans süreniz doldu.",
};

export class OturumService {
  public static aktifMi(): boolean {
    return env.MERKEZ_GIRIS === "zorunlu";
  }

  public static onbellegiTemizle(): void {
    onbellek.clear();
  }

  public static ac(kullaniciId: number, firmaId: number, istemci: { ip: string; tarayici: string }): Promise<string> {
    return IzlemeSqlRepository.kullaniciOturumuAc(kullaniciId, firmaId, istemci.ip, istemci.tarayici);
  }

  public static async bitir(sid: string | undefined): Promise<void> {
    if (!sid || !this.aktifMi()) return;
    onbellek.delete(sid);
    await IzlemeSqlRepository.oturumuBitir(sid);
  }

  /**
   * authenticate içinden her istekte çağrılır. Geçersizse 401 (istemci "oturum bitti" akışına girer).
   * Geçici şifresini henüz değiştirmemiş kullanıcı yalnızca /auth uçlarını kullanabilir.
   */
  public static async dogrula(oturum: JwtPayload, istekYolu: string): Promise<void> {
    if (!this.aktifMi()) return;
    // Merkez açılmadan önce verilmiş (sid'siz) token'lar geçersizdir: herkes bir kez yeniden giriş yapar
    if (!oturum.sid) throw ApiError.unauthorized("Oturumunuzun yenilenmesi gerekiyor. Lütfen tekrar giriş yapınız.");

    let kayit = onbellek.get(oturum.sid);
    if (!kayit || Date.now() - kayit.zaman > ONBELLEK_MS) {
      kayit = { durum: await IzlemeSqlRepository.oturumDurumu(oturum.sid), zaman: Date.now() };
      onbellek.set(oturum.sid, kayit);
      if (onbellek.size > 5000) onbellek.clear();
    }

    const { durum } = kayit;
    if (!durum.gecerli) throw ApiError.unauthorized(NEDEN_MESAJI[durum.neden!]);
    if (durum.sifreDegismeli && !istekYolu.startsWith(`${env.API_PREFIX}/auth/`)) {
      throw new ApiError(HttpStatus.FORBIDDEN, "Devam etmeden önce şifrenizi belirlemelisiniz.", { kod: "SIFRE_DEGISMELI" });
    }
  }
}
