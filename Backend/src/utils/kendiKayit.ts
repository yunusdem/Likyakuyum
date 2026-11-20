import sql from "mssql";

/**
 * "Kendi kayıtları" yetkisi (göç 028) liste süzgeci: kullanıcı yalnız kendi eklediği ya da kart veznesindeki kayıtları görür —
 * Sarraf / Döviz / Perakende / Cari hareket listelerindeki kuralla aynı (fisYetkileri.kayitErisimi açılışta, isDelete silmede denetler).
 * Kasa, emanet dekont, banka, ticari satış / stok girişi ve e-Belge Kaynak listelerinde eksikti: kullanıcı başkasının kaydını
 * listede görüp açamıyordu (ortak alan denetimi 19.11.2026).
 */
export interface KendiKayit {
  kullaniciId: number;
  /** Kart veznesi; 0 ise yalnız kullanıcının kendi kayıtları */
  vezneId: number;
}

/**
 * SQL koşulu (başında AND yok) — kayıt yoksa null. @kkKullanici / @kkVezne parametrelerini isteğe bağlar (her istekte bir kez çağrılır).
 * Kolon adları: kayıt tablolarının hepsinde ekleyen EKLEYEN_ID'de (KULLANICI_ID yok); vezneKolon null ise vezne bakılmaz.
 */
export function kendiKayitKosulu(
  req: sql.Request,
  alias: string,
  k: KendiKayit | null | undefined,
  kolonlar: { kullanici?: string; vezne?: string | null } = {}
): string | null {
  if (!k || !(k.kullaniciId > 0)) return null;
  const kk = kolonlar.kullanici || "EKLEYEN_ID";
  const vk = kolonlar.vezne === undefined ? "VEZNE_ID" : kolonlar.vezne;
  req.input("kkKullanici", sql.Int, k.kullaniciId).input("kkVezne", sql.Int, k.vezneId || 0);
  return vk ? `(${alias}.${kk} = @kkKullanici OR (@kkVezne > 0 AND ${alias}.${vk} = @kkVezne))` : `${alias}.${kk} = @kkKullanici`;
}
