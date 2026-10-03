import type sql from "mssql";

/**
 * Şema kurulumu gibi bir işi bağlantı havuzu başına yalnız bir kez çalıştırır.
 * Sonuç (başarılı ya da başarısız) havuza bağlı saklanır; aynı anda gelen çağrılar
 * aynı sözü bekler, iş tekrar gönderilmez. Hata kaydı işin kendi içinde yazıldığı
 * için havuz başına bir kez düşer. Havuz kapanıp yeniden kurulursa iş yeniden çalışır.
 */
export const havuzBasinaBirKez = (
  is: (pool: sql.ConnectionPool) => Promise<void>
): ((pool: sql.ConnectionPool) => Promise<void>) => {
  const sonuclar = new WeakMap<sql.ConnectionPool, Promise<void>>();
  return (pool) => {
    let sonuc = sonuclar.get(pool);
    if (!sonuc) {
      sonuc = is(pool);
      // Saklanan başarısız söz kimse beklemezken işlenmemiş ret uyarısı vermesin
      sonuc.catch(() => undefined);
      sonuclar.set(pool, sonuc);
    }
    return sonuc;
  };
};
