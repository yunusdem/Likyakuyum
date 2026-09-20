import sql from "mssql";
import { getDbPool, parseServerAndPort } from "../../config/mssql.config.js";
import { FirmaSqlRepository } from "../../models/admin/firmaSql.repository.js";
import { ApiError } from "../../utils/ApiError.js";
import { sifreCoz } from "../../utils/kripto.utils.js";

/**
 * Giriş anında firmayı bulmak için eşleşme anahtarı: küçükharf(host):port:küçükharf(veritabanı).
 * "localhost" → "127.0.0.1" ve "host,port" / "host:port" yazımları parseServerAndPort ile tekleştirilir;
 * toLowerCase dilden bağımsızdır (SQL Server'ın Türkçe sıralamasındaki I/ı farkından etkilenmez).
 */
export const firmaDbAnahtari = (dbServer: string, dbName: string): { host: string; port: number; anahtar: string } => {
  const { host, port } = parseServerAndPort(dbServer, 1433);
  return { host, port, anahtar: `${host.toLowerCase()}:${port}:${dbName.trim().toLowerCase()}` };
};

export const hataMetni = (err: any): string => {
  const msg = String(err?.message || err || "Bilinmeyen hata");
  if (msg.includes("Login failed")) return "Veritabanı kullanıcı adı veya şifresi hatalı.";
  if (err?.code === "ETIMEOUT" || msg.includes("timeout")) return "Sunucuya ulaşılamadı (zaman aşımı).";
  if (err?.code === "ESOCKET" || msg.includes("ECONNREFUSED") || msg.includes("getaddrinfo")) {
    return "Sunucuya ulaşılamadı (adres/port kapalı veya hatalı).";
  }
  if (msg.includes("Cannot open database")) return "Veritabanı bulunamadı veya kullanıcının erişimi yok.";
  return msg.slice(0, 300);
};

/**
 * Verilen bilgilerle kısa ömürlü bir bağlantı açıp kapatır; bağlanamazsa anlaşılır bir 400 hatası verir.
 * Paylaşılan havuza (getDbPool) gitmeden ÖNCE çağrılır: o havuz bağlanamadığında ya başka bir firmanın açık
 * bağlantısına düşüyor ya da açık bağlantı yoksa yanıt vermeden bekliyor.
 */
export const baglantiSina = async (dbServer: string, dbName: string, dbUser: string, dbSifre: string): Promise<void> => {
  const { host, port } = parseServerAndPort(dbServer, 1433);
  const pool = new sql.ConnectionPool({
    server: host,
    port,
    database: dbName,
    user: dbUser,
    password: dbSifre,
    options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true },
    pool: { max: 1, min: 0, idleTimeoutMillis: 1000 },
    connectionTimeout: 10000,
  });
  try {
    await pool.connect();
  } catch (err) {
    throw ApiError.badRequest(`Firma veritabanına (${dbName}) bağlanılamadı: ${hataMetni(err)}`);
  } finally {
    pool.close().catch(() => undefined);
  }
};

/**
 * Firma veritabanında tek seferlik bir iş çalıştırır. Kullanıcı tarafının paylaşılan havuzu (getDbPool)
 * BİLİNÇLİ olarak kullanılmaz: o havuz bağlanamayınca başka bir firmanın açık bağlantısına düşebiliyor,
 * bu da burada yanlış "bağlantı başarılı" sonucu ve yanlış firmadan veri okuma demek olurdu.
 */
export const firmaDbIleCalistir = async <T>(firmaId: number, is: (pool: sql.ConnectionPool) => Promise<T>): Promise<T> => {
  const b = await FirmaSqlRepository.baglantiBilgisi(firmaId);
  if (!b) throw ApiError.notFound("Firma bulunamadı.");
  if (!b.dbUser) throw new Error("Veritabanı kullanıcı adı tanımlı değil.");
  const sifre = sifreCoz(b.dbSifreEnc);
  if (b.dbSifreEnc && sifre === null) {
    throw new Error("Kayıtlı veritabanı şifresi çözülemedi (ADMIN_DB_ENC_KEY değişmiş olabilir). Şifreyi yeniden girin.");
  }
  if (!sifre) throw new Error("Veritabanı şifresi tanımlı değil.");

  const { host } = parseServerAndPort(b.dbServer, b.dbPort);
  const pool = new sql.ConnectionPool({
    server: host,
    port: b.dbPort,
    database: b.dbName,
    user: b.dbUser,
    password: sifre,
    options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true },
    pool: { max: 2, min: 0, idleTimeoutMillis: 5000 },
    connectionTimeout: 10000,
    requestTimeout: 15000,
  });
  try {
    await pool.connect();
    return await is(pool);
  } finally {
    pool.close().catch(() => undefined);
  }
};

/**
 * Kullanıcı tarafının repository'lerini (ör. UserSqlRepository) bir firmanın veritabanında, panelde kayıtlı bağlantı
 * bilgisiyle çalıştırabilmek için paylaşılan havuzu hazırlar ve dbContext döndürür. Önce kendi bağlantımızla
 * erişilebilirlik sınanır, sonra havuzun gerçekten bu veritabanına bağlandığı doğrulanır (başka firmaya düşme riski).
 */
export const firmaDbContextHazirla = async (firmaId: number): Promise<{ dbServer: string; dbName: string }> => {
  try {
    await firmaDbIleCalistir(firmaId, async (pool) => pool.request().query("SELECT 1 AS OK"));
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    throw ApiError.badRequest(`Firma veritabanına bağlanılamadı: ${hataMetni(err)}`);
  }
  const b = (await FirmaSqlRepository.baglantiBilgisi(firmaId))!;
  const pool = await getDbPool(b.dbServer, b.dbName, b.dbUser!, sifreCoz(b.dbSifreEnc)!);
  const res = await pool.request().query("SELECT DB_NAME() AS D");
  if (String(res.recordset[0]?.D || "").toLowerCase() !== b.dbName.trim().toLowerCase()) {
    throw ApiError.badRequest("Firma veritabanı bağlantısı doğrulanamadı; işlem yapılmadı.");
  }
  return { dbServer: b.dbServer, dbName: b.dbName };
};

export class FirmaBaglantiService {
  /** Bağlantıyı dener, sonucu firmaya yazar. Hata fırlatmaz; sonucu döndürür. */
  public static async dbTest(firmaId: number): Promise<{ basarili: boolean; sonuc: string }> {
    let basarili = false;
    let sonuc: string;
    try {
      sonuc = await firmaDbIleCalistir(firmaId, async (pool) => {
        const res = await pool.request().query(`
          SELECT DB_NAME() AS DB_ADI,
                 CASE WHEN OBJECT_ID('dbo.TODVZ_KULLANICI') IS NULL THEN -1
                      ELSE (SELECT COUNT(*) FROM dbo.TODVZ_KULLANICI) END AS KULLANICI_SAYISI
        `);
        const r = res.recordset[0];
        if (r.KULLANICI_SAYISI < 0) {
          return `Bağlantı kuruldu ancak ${r.DB_ADI} bir Likya veritabanı değil (TODVZ_KULLANICI tablosu yok).`;
        }
        basarili = true;
        return `Başarılı: ${r.DB_ADI}, ${r.KULLANICI_SAYISI} kullanıcı kaydı.`;
      });
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      sonuc = `Başarısız: ${hataMetni(err)}`;
    }
    await FirmaSqlRepository.dbTestSonucuYaz(firmaId, sonuc);
    return { basarili, sonuc };
  }

  /** Firma veritabanından MASAK durumunu okur: hesabı tanımlı kullanıcı sayısı ve listelerin son başarılı güncellemesi. */
  public static async masakKontrol(firmaId: number): Promise<{ sonuc: string }> {
    let sonuc: string;
    try {
      sonuc = await firmaDbIleCalistir(firmaId, async (pool) => {
        const res = await pool.request().query(`
          DECLARE @hesap INT = NULL, @sonGuncelleme DATETIME = NULL, @kayit INT = NULL;
          IF COL_LENGTH('dbo.TODVZ_KULLANICI', 'MASAK_KULLANICI_ADI') IS NOT NULL
            EXEC sp_executesql N'SELECT @n = COUNT(*) FROM dbo.TODVZ_KULLANICI WHERE LTRIM(RTRIM(ISNULL(MASAK_KULLANICI_ADI, ''''))) <> ''''',
                               N'@n INT OUTPUT', @n = @hesap OUTPUT;
          IF OBJECT_ID('dbo.TODVZ_MASAK_GUNCELLEME') IS NOT NULL
            EXEC sp_executesql N'SELECT @t = MAX(BITIS_ZAMANI) FROM dbo.TODVZ_MASAK_GUNCELLEME WHERE DURUM = ''BASARILI''',
                               N'@t DATETIME OUTPUT', @t = @sonGuncelleme OUTPUT;
          IF OBJECT_ID('dbo.TODVZ_MASAK_LISTE') IS NOT NULL
            EXEC sp_executesql N'SELECT @k = COUNT(*) FROM dbo.TODVZ_MASAK_LISTE', N'@k INT OUTPUT', @k = @kayit OUTPUT;
          SELECT @hesap AS HESAP, @sonGuncelleme AS SON_GUNCELLEME, @kayit AS KAYIT;
        `);
        const r = res.recordset[0];
        const parcalar: string[] = [];
        parcalar.push(
          r.HESAP === null ? "MASAK hesap alanı yok" : r.HESAP > 0 ? `MASAK hesabı tanımlı kullanıcı: ${r.HESAP}` : "MASAK hesabı tanımlı değil"
        );
        if (r.KAYIT === null) parcalar.push("liste tablosu yok");
        else {
          const tarih = r.SON_GUNCELLEME ? (r.SON_GUNCELLEME as Date).toISOString().slice(0, 10) : "hiç";
          parcalar.push(`liste: ${r.KAYIT} kayıt, son güncelleme: ${tarih}`);
        }
        return parcalar.join(" · ");
      });
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      sonuc = `Kontrol edilemedi: ${hataMetni(err)}`;
    }
    await FirmaSqlRepository.masakDurumuYaz(firmaId, sonuc);
    return { sonuc };
  }
}
