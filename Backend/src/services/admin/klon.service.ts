import sql from "mssql";
import { env } from "../../config/env.config.js";
import { AyarSqlRepository } from "../../models/admin/ayarSql.repository.js";
import { bugunTr } from "../../utils/zaman.utils.js";
import { parseServerAndPort, veritabaniHavuzlariniKapat } from "../../config/mssql.config.js";
import { FirmaSqlRepository } from "../../models/admin/firmaSql.repository.js";
import { AdminLogSqlRepository } from "../../models/admin/adminLogSql.repository.js";
import { AdminBaglam, BulutFirmaGirdi, FirmaDto } from "../../types/admin.types.js";
import { ApiError } from "../../utils/ApiError.js";
import { logger } from "../../utils/logger.js";
import { baglantiSina, firmaDbAnahtari } from "./firmaBaglanti.service.js";
import { FirmaService } from "./firma.service.js";
import { KullaniciService } from "./kullanici.service.js";

/**
 * Bulut firma: sunucumuzda şablon yedeğinden (LIKYA_SABLON) yeni, boş bir firma veritabanı açar.
 * docs/BULUT_VE_EXE_LISANS_YOL_HARITASI.md, 6.1 · Kararlar K1-K4.
 *
 * Veritabanı ve SQL girişi, ayrı ve dar yetkili `likya_klon` hesabıyla açılır (docs/sql/KLON_HESABI.sql):
 * CREATE ANY DATABASE + ALTER ANY LOGIN. Hesap açtığı veritabanının sahibi olur; mevcut firmaları silemez.
 * Adımlardan biri başarısız olursa o ana kadar yapılan her şey geri alınır.
 */

const AD_KURALI = /^[A-Za-z][A-Za-z0-9_]{2,63}$/;
const AYRILMIS_DB = ["master", "model", "msdb", "tempdb", "likya_admin", "likya_sablon"];
const AYRILMIS_GIRIS = ["sa", "likya_klon", "likya_admin_app"];

/**
 * Firma SQL girişinin şifre kuralı. SQL Server'ın CHECK_POLICY denetimi Windows yerel güvenlik ayarına bağlıdır
 * (bazı makinelerde kapalı); kural bu yüzden uygulamada da uygulanır: en az 8 karakter, büyük harf / küçük harf /
 * rakam / işaretten en az üçü, kullanıcı adını içermez.
 */
export const dbSifreKuralHatasi = (sifre: string, kullaniciAdi: string): string | null => {
  if (sifre.length < 8) return "Veritabanı şifresi en az 8 karakter olmalıdır.";
  const turler = [/[A-ZÇĞİÖŞÜ]/, /[a-zçğıöşü]/, /[0-9]/, /[^A-Za-z0-9ÇĞİÖŞÜçğıöşü]/].filter((r) => r.test(sifre)).length;
  if (turler < 3) return "Veritabanı şifresi büyük harf, küçük harf, rakam ve işaretten en az üçünü içermelidir.";
  if (kullaniciAdi && sifre.toLowerCase().includes(kullaniciAdi.toLowerCase())) {
    return "Veritabanı şifresi kullanıcı adını içeremez.";
  }
  return null;
};

/** Aynı anda aynı veritabanı adıyla iki istek gelirse ikincisi beklemeden reddedilir. */
const suruyor = new Set<string>();

export const klonYapilandirildiMi = (): boolean => !!env.KLON_DB_USER && !!env.KLON_DB_PASSWORD;

/** [ad] — adlar AD_KURALI'ndan geçtiği için yalnız güvenlik kemeri */
export const kd = (ad: string): string => `[${ad.replace(/]/g, "]]")}]`;
/** N'metin' */
export const nm = (metin: string): string => `N'${metin.replace(/'/g, "''")}'`;

export const klonHavuzu = async (veritabani: string): Promise<sql.ConnectionPool> => {
  const { host, port } = parseServerAndPort(
    env.KLON_DB_SERVER || env.ADMIN_DB_SERVER,
    Number(env.KLON_DB_PORT) || env.ADMIN_DB_PORT || 1433
  );
  return new sql.ConnectionPool({
    server: host,
    port,
    database: veritabani,
    user: env.KLON_DB_USER,
    password: env.KLON_DB_PASSWORD,
    options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true },
    pool: { max: 1, min: 0, idleTimeoutMillis: 1000 },
    connectionTimeout: 15000,
    requestTimeout: 10 * 60 * 1000, // geri yükleme büyük şablonda dakikalar sürebilir
  }).connect();
};

export const klonIle = async <T>(veritabani: string, is: (pool: sql.ConnectionPool) => Promise<T>): Promise<T> => {
  const pool = await klonHavuzu(veritabani);
  try {
    return await is(pool);
  } finally {
    pool.close().catch(() => undefined);
  }
};

/** SQL Server hata numarasına göre yöneticiye anlaşılır mesaj. */
const sqlHataMetni = (err: any, ctx: { dbName: string; dbUser: string; sablon: string }): string => {
  const no = Number(err?.number ?? err?.originalError?.info?.number);
  const msg = String(err?.message || err || "Bilinmeyen hata");
  if (no === 15118 || no === 15116 || no === 15115 || no === 15114) {
    return "Veritabanı şifresi SQL Server şifre kuralına uymuyor: en az 8 karakter; büyük harf, küçük harf, rakam ve işaretten en az üçü bulunmalı ve kullanıcı adını içermemeli.";
  }
  if (no === 1801) return `${ctx.dbName} adlı bir veritabanı sunucuda zaten var.`;
  if (no === 15025) return `${ctx.dbUser} adlı bir SQL girişi sunucuda zaten var.`;
  if (no === 3201 || no === 3203) return `Şablon yedeği okunamadı (${ctx.sablon}). Dosya yolunu ve SQL Server'ın klasör iznini kontrol edin.`;
  if (no === 5133 || no === 3156 || no === 5170) return `Veritabanı dosyası oluşturulamadı: ${msg.slice(0, 200)}`;
  if (no === 262 || no === 15247 || no === 916 || no === 229) {
    return "Klonlama hesabının (likya_klon) yetkisi bu işlem için yetmiyor. docs/sql/KLON_HESABI.sql betiğini kontrol edin.";
  }
  if (msg.includes("Login failed") && msg.includes(env.KLON_DB_USER)) {
    return "Klonlama hesabıyla (likya_klon) sunucuya bağlanılamadı. Backend/.env.local içindeki KLON_DB_PASSWORD hesabın şifresiyle aynı olmalı.";
  }
  return msg.slice(0, 300);
};

const sablonYolu = (): Promise<string> => AyarSqlRepository.oku("SABLON_YEDEK_DOSYASI");

export class KlonService {
  public static durum(): { klonAcik: boolean; sunucu: string } {
    return { klonAcik: klonYapilandirildiMi(), sunucu: env.BULUT_DB_SUNUCU };
  }

  public static async olustur(
    yapan: AdminBaglam,
    girdi: BulutFirmaGirdi
  ): Promise<{ firma: FirmaDto; ilkKullanici: { kullaniciAdi: string; geciciSifre: string } }> {
    if (!klonYapilandirildiMi()) {
      throw ApiError.badRequest(
        "Bu sunucuda veritabanı oluşturma kapalı: Backend/.env.local içinde KLON_DB_USER ve KLON_DB_PASSWORD tanımlı değil."
      );
    }

    const dbName = girdi.dbName.trim();
    const dbUser = girdi.dbUser.trim();
    const dbSifre = girdi.dbSifre;
    const firmaKodu = girdi.firmaKodu.trim().toUpperCase();
    const sunucu = env.BULUT_DB_SUNUCU;

    if (!AD_KURALI.test(dbName) || AYRILMIS_DB.includes(dbName.toLowerCase())) {
      throw ApiError.badRequest("Veritabanı adı harfle başlamalı; yalnız harf, rakam ve alt çizgi içermeli (3-64 karakter).");
    }
    if (!AD_KURALI.test(dbUser) || AYRILMIS_GIRIS.includes(dbUser.toLowerCase())) {
      throw ApiError.badRequest("Veritabanı kullanıcı adı harfle başlamalı; yalnız harf, rakam ve alt çizgi içermeli (3-64 karakter).");
    }
    const sifreHatasi = dbSifreKuralHatasi(dbSifre, dbUser);
    if (sifreHatasi) throw ApiError.badRequest(sifreHatasi);
    if (girdi.lisansBitis < bugunTr()) throw ApiError.badRequest("Lisans bitiş tarihi bugünden önce olamaz.");

    const { anahtar } = firmaDbAnahtari(sunucu, dbName);
    const cakisma = await FirmaSqlRepository.cakismaVarMi(firmaKodu, anahtar);
    if (cakisma === "KOD") throw ApiError.conflict("Bu firma kodu başka bir firmada kullanılıyor.");
    if (cakisma === "DB") throw ApiError.conflict("Bu veritabanı adı başka bir firmaya tanımlı.");

    const kilit = dbName.toLowerCase();
    if (suruyor.has(kilit)) throw ApiError.conflict("Bu veritabanı şu anda oluşturuluyor; lütfen bekleyin.");
    suruyor.add(kilit);

    const sablon = await sablonYolu();
    const ctx = { dbName, dbUser, sablon };
    let dbAcildi = false;
    let girisAcildi = false;
    let firmaId: number | null = null;

    try {
      // 1) Ön kontrol + şablondan geri yükleme (master üzerinde, likya_klon ile)
      await klonIle("master", async (pool) => {
        const on = await pool
          .request()
          .input("db", sql.NVarChar(128), dbName)
          .input("giris", sql.NVarChar(128), dbUser)
          .query(`SELECT DB_ID(@db) AS DBID, SUSER_ID(@giris) AS GIRIS,
                         CAST(SERVERPROPERTY('InstanceDefaultDataPath') AS nvarchar(260)) AS VERI,
                         CAST(SERVERPROPERTY('InstanceDefaultLogPath') AS nvarchar(260)) AS LOG`);
        const r = on.recordset[0];
        // Şablonun sahibi likya_klon değilse geri yüklenen veritabanına bu hesap giremez ve silemez (yarım kalırdı)
        const sablonSahibi = await pool
          .request()
          .query(`SELECT SUSER_SNAME(owner_sid) AS SAHIP FROM sys.databases WHERE name = N'LIKYA_SABLON'`);
        const sahipAdi = sablonSahibi.recordset[0]?.SAHIP;
        if (sahipAdi && String(sahipAdi).toLowerCase() !== env.KLON_DB_USER.toLowerCase()) {
          throw ApiError.badRequest(
            `Şablonun (LIKYA_SABLON) sahibi ${sahipAdi}; ${env.KLON_DB_USER} olmalı. Sunucuda docs/sql/SABLON_SAHIPLIGI.sql betiği çalıştırılmalı.`
          );
        }
        if (r.DBID !== null) throw ApiError.conflict(`${dbName} adlı bir veritabanı sunucuda zaten var.`);
        if (r.GIRIS !== null) throw ApiError.conflict(`${dbUser} adlı bir SQL girişi sunucuda zaten var.`);

        const dosyalar = await pool.request().input("yol", sql.NVarChar(400), sablon).query(`RESTORE FILELISTONLY FROM DISK = @yol`);
        let veriSira = 0;
        const move = (dosyalar.recordset as any[])
          .map((f) => {
            const log = String(f.Type).toUpperCase() === "L";
            const hedef = log
              ? `${r.LOG}${dbName}_log.ldf`
              : `${r.VERI}${dbName}${veriSira++ === 0 ? ".mdf" : `_${veriSira}.ndf`}`;
            return `MOVE ${nm(String(f.LogicalName))} TO ${nm(hedef)}`;
          })
          .join(", ");
        if (!move) throw new Error("Şablon yedeğinde dosya bulunamadı.");

        await pool
          .request()
          .input("yol", sql.NVarChar(400), sablon)
          .query(`RESTORE DATABASE ${kd(dbName)} FROM DISK = @yol WITH RECOVERY, ${move}`);
        dbAcildi = true;

        // Sahibi likya_klon olmalı: sonra yalnız bu hesap silebilsin ve şablondaki hiçbir kullanıcı taşınmamış olsun
        const sahip = await pool
          .request()
          .input("db", sql.NVarChar(128), dbName)
          .query(`SELECT SUSER_SNAME(owner_sid) AS SAHIP FROM sys.databases WHERE name = @db`);
        if (String(sahip.recordset[0]?.SAHIP || "").toLowerCase() !== env.KLON_DB_USER.toLowerCase()) {
          throw new Error("Yeni veritabanının sahibi doğrulanamadı.");
        }

        await pool.request().batch(
          `CREATE LOGIN ${kd(dbUser)} WITH PASSWORD = ${nm(dbSifre)}, CHECK_POLICY = ON, CHECK_EXPIRATION = OFF, DEFAULT_DATABASE = ${kd(dbName)};`
        );
        girisAcildi = true;
      });

      // 2) Yeni veritabanında: firma girişine yetki + firma bilgilerini TODVZ_TANIM'a yaz
      const yeniDbHavuzu = await klonHavuzu(dbName).catch((err: any) => {
        if (String(err?.message || "").includes("Login failed")) {
          throw ApiError.badRequest(
            `Klonlama hesabı yeni veritabanına (${dbName}) giremedi; şablonun sahibi ${env.KLON_DB_USER} olmalı (docs/sql/SABLON_SAHIPLIGI.sql).`
          );
        }
        throw err;
      });
      yeniDbHavuzu.close().catch(() => undefined);
      await klonIle(dbName, async (pool) => {
        await pool.request().batch(`CREATE USER ${kd(dbUser)} FOR LOGIN ${kd(dbUser)}; ALTER ROLE [db_owner] ADD MEMBER ${kd(dbUser)};`);
        await pool
          .request()
          .input("unvan", sql.NVarChar(200), girdi.unvan.trim())
          .input("vkn", sql.NVarChar(20), (girdi.vknTckn || "").trim())
          .input("adres", sql.NVarChar(500), (girdi.adres || "").trim())
          .input("telefon", sql.NVarChar(30), (girdi.telefon || "").trim())
          .input("eposta", sql.NVarChar(150), (girdi.eposta || "").trim())
          .query(`
            IF OBJECT_ID('dbo.TODVZ_TANIM') IS NOT NULL
              UPDATE dbo.TODVZ_TANIM SET
                FIRMA_ADI       = LEFT(@unvan,   COL_LENGTH('dbo.TODVZ_TANIM', 'FIRMA_ADI')),
                VERGI_KIMLIK_NO = LEFT(@vkn,     COL_LENGTH('dbo.TODVZ_TANIM', 'VERGI_KIMLIK_NO')),
                ADRES           = LEFT(@adres,   COL_LENGTH('dbo.TODVZ_TANIM', 'ADRES')),
                TELEFON         = LEFT(@telefon, COL_LENGTH('dbo.TODVZ_TANIM', 'TELEFON')),
                EPOSTA          = LEFT(@eposta,  COL_LENGTH('dbo.TODVZ_TANIM', 'EPOSTA'));
          `);
      });

      // 3) Firmanın kendi girişiyle bağlanılabildiğini doğrula
      await baglantiSina(sunucu, dbName, dbUser, dbSifre);

      // 4) Merkez kayıtları: firma, lisans, ilk kullanıcı (firma yöneticisi)
      const firma = await FirmaService.ekle(yapan, {
        firmaKodu,
        musteriNo: girdi.musteriNo,
        prgTur: girdi.prgTur,
        unvan: girdi.unvan,
        vknTckn: girdi.vknTckn,
        vergiDairesi: girdi.vergiDairesi,
        yetkiliKisi: girdi.yetkiliKisi,
        telefon: girdi.telefon,
        eposta: girdi.eposta,
        adres: girdi.adres,
        baglantiModu: "cloud",
        dbServer: sunucu,
        dbName,
        dbUser,
        dbSifre,
      });
      firmaId = firma.firmaId;

      await FirmaService.lisansEkle(yapan, firmaId, {
        baslangic: bugunTr(),
        bitis: girdi.lisansBitis,
        kullaniciLimiti: girdi.kullaniciLimiti,
        notlar: "Bulut firma oluşturulurken verildi.",
      });

      const { kullanici, geciciSifre } = await KullaniciService.ekle(yapan, firmaId, {
        kullaniciAdi: girdi.ilkKullaniciAdi,
        adSoyad: girdi.ilkKullaniciAdSoyad,
        firmaYoneticisi: true,
      });

      await AdminLogSqlRepository.islemLogu({
        adminId: yapan.adminId,
        islem: "FIRMA_DB_OLUSTURULDU",
        hedefTur: "FIRMA",
        hedefId: firmaId,
        yeni: { firmaKodu, dbName, dbUser, sablon, ilkKullanici: kullanici.kullaniciAdi, lisansBitis: girdi.lisansBitis, kullaniciLimiti: girdi.kullaniciLimiti },
      });

      return { firma: await FirmaService.getir(firmaId), ilkKullanici: { kullaniciAdi: kullanici.kullaniciAdi, geciciSifre } };
    } catch (err: any) {
      if (firmaId !== null || dbAcildi || girisAcildi) {
        const geriAlinan = await this.geriAl({ firmaId, dbAcildi, girisAcildi, dbName, dbUser, sunucu });
        await AdminLogSqlRepository.islemLogu({
          adminId: yapan.adminId,
          islem: "FIRMA_DB_OLUSTURMA_GERI_ALINDI",
          hedefTur: "FIRMA",
          hedefId: firmaKodu,
          yeni: { dbName, dbUser, hata: String(err?.message || err).slice(0, 500), ...geriAlinan },
        });
      }
      if (err instanceof ApiError) throw err;
      logger.error(`[KLON] ${dbName} oluşturulamadı: ${err?.message}`);
      throw ApiError.badRequest(`Firma veritabanı oluşturulamadı: ${sqlHataMetni(err, ctx)}`);
    } finally {
      suruyor.delete(kilit);
    }
  }

  /** Yarım kalan oluşturmayı tersten geri alır. Her adım bağımsız denenir; sonuç işlem kaydına yazılır. */
  private static async geriAl(d: {
    firmaId: number | null;
    dbAcildi: boolean;
    girisAcildi: boolean;
    dbName: string;
    dbUser: string;
    sunucu: string;
  }): Promise<{ merkezKaydiSilindi?: boolean; veritabaniSilindi?: boolean; girisSilindi?: boolean; geriAlmaHatasi?: string[] }> {
    const sonuc: { merkezKaydiSilindi?: boolean; veritabaniSilindi?: boolean; girisSilindi?: boolean; geriAlmaHatasi?: string[] } = {};
    const hatalar: string[] = [];

    if (d.firmaId !== null) {
      try {
        await FirmaSqlRepository.yeniFirmayiGeriAl(d.firmaId);
        sonuc.merkezKaydiSilindi = true;
      } catch (err: any) {
        hatalar.push(`merkez kaydı: ${err?.message}`);
        logger.error(`[KLON] Firma kaydı (${d.firmaId}) geri alınamadı: ${err?.message}`);
      }
    }

    if (d.dbAcildi || d.girisAcildi) {
      await veritabaniHavuzlariniKapat(d.sunucu, d.dbName).catch(() => undefined);
      try {
        await klonIle("master", async (pool) => {
          if (d.dbAcildi) {
            try {
              await pool
                .request()
                .batch(
                  `IF DB_ID(${nm(d.dbName)}) IS NOT NULL BEGIN ALTER DATABASE ${kd(d.dbName)} SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE ${kd(d.dbName)}; END`
                );
              sonuc.veritabaniSilindi = true;
            } catch (err: any) {
              hatalar.push(`veritabanı: ${err?.message}`);
            }
          }
          if (d.girisAcildi) {
            try {
              await pool.request().batch(`IF SUSER_ID(${nm(d.dbUser)}) IS NOT NULL DROP LOGIN ${kd(d.dbUser)};`);
              sonuc.girisSilindi = true;
            } catch (err: any) {
              hatalar.push(`SQL girişi: ${err?.message}`);
            }
          }
        });
      } catch (err: any) {
        hatalar.push(`bağlantı: ${err?.message}`);
      }
      if (hatalar.length) logger.error(`[KLON] ${d.dbName} geri alma eksik kaldı: ${hatalar.join(" | ")}`);
    }

    if (hatalar.length) sonuc.geriAlmaHatasi = hatalar;
    return sonuc;
  }
}
