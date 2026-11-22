import sql from "mssql";
/**
 * SQL koşulu (başında AND yok) — kayıt yoksa null. @kkKullanici / @kkVezne parametrelerini isteğe bağlar (her istekte bir kez çağrılır).
 * Kolon adları: kayıt tablolarının hepsinde ekleyen EKLEYEN_ID'de (KULLANICI_ID yok); vezneKolon null ise vezne bakılmaz.
 */
export function kendiKayitKosulu(req, alias, k, kolonlar = {}) {
    if (!k || !(k.kullaniciId > 0))
        return null;
    const kk = kolonlar.kullanici || "EKLEYEN_ID";
    const vk = kolonlar.vezne === undefined ? "VEZNE_ID" : kolonlar.vezne;
    req.input("kkKullanici", sql.Int, k.kullaniciId).input("kkVezne", sql.Int, k.vezneId || 0);
    return vk ? `(${alias}.${kk} = @kkKullanici OR (@kkVezne > 0 AND ${alias}.${vk} = @kkVezne))` : `${alias}.${kk} = @kkKullanici`;
}
