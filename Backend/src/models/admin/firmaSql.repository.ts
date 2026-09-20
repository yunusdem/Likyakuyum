import sql from "mssql";
import { getAdminPool } from "../../config/adminDb.config.js";
import { FirmaDto, FirmaDurum, LisansDurumu, LISANS_UYARI_GUN } from "../../types/admin.types.js";

const SECIM = `
  SELECT f.FIRMA_ID, f.FIRMA_KODU, f.UNVAN, f.VKN_TCKN, f.VERGI_DAIRESI, f.YETKILI_KISI, f.TELEFON, f.EPOSTA, f.ADRES,
         f.DURUM, f.DURUM_NOTU, f.DURUM_TARIHI, f.BAGLANTI_MODU, f.DB_SERVER, f.DB_PORT, f.DB_NAME, f.DB_USER,
         CAST(CASE WHEN f.DB_SIFRE_ENC IS NULL THEN 0 ELSE 1 END AS BIT) AS DB_SIFRE_TANIMLI,
         f.DOGRULANDI, f.DOGRULAYAN_ADMIN_ID, a.KULLANICI_ADI AS DOGRULAYAN_ADMIN, f.DOGRULAMA_TARIHI, f.DOGRULAMA_NOTU,
         f.DB_SON_TEST_TARIHI, f.DB_SON_TEST_SONUCU, f.MASAK_DURUMU, f.MASAK_SON_KONTROL, f.OLUSTURMA_TARIHI,
         (SELECT COUNT(*) FROM dbo.ADM_KULLANICI k WHERE k.FIRMA_ID = f.FIRMA_ID AND k.DURUM = 'AKTIF') AS KULLANICI_SAYISI,
         l.LISANS_ID, l.BASLANGIC, l.BITIS, l.KULLANICI_LIMITI, l.PAKET_ADI,
         DATEDIFF(DAY, CAST(GETDATE() AS DATE), l.BITIS) AS KALAN_GUN
  FROM dbo.ADM_FIRMA f
  LEFT JOIN dbo.ADM_LISANS l ON l.FIRMA_ID = f.FIRMA_ID AND l.AKTIF = 1
  LEFT JOIN dbo.ADM_ADMIN a ON a.ADMIN_ID = f.DOGRULAYAN_ADMIN_ID
`;

/** DATE kolonu (UTC gece yarısı olarak okunur) → 'YYYY-AA-GG' */
export const gunYaz = (d: Date): string => d.toISOString().slice(0, 10);

const lisansDurumu = (lisansId: number | null, kalanGun: number | null): LisansDurumu => {
  if (lisansId === null || kalanGun === null) return "YOK";
  if (kalanGun < 0) return "BITMIS"; // bitiş günü dahil geçerlidir
  return kalanGun <= LISANS_UYARI_GUN ? "YAKINDA" : "GECERLI";
};

const satirdan = (r: any): FirmaDto => ({
  firmaId: r.FIRMA_ID,
  firmaKodu: r.FIRMA_KODU,
  unvan: r.UNVAN,
  vknTckn: r.VKN_TCKN ?? null,
  vergiDairesi: r.VERGI_DAIRESI ?? null,
  yetkiliKisi: r.YETKILI_KISI ?? null,
  telefon: r.TELEFON ?? null,
  eposta: r.EPOSTA ?? null,
  adres: r.ADRES ?? null,
  durum: r.DURUM,
  durumNotu: r.DURUM_NOTU ?? null,
  durumTarihi: r.DURUM_TARIHI ?? null,
  baglantiModu: r.BAGLANTI_MODU,
  dbServer: r.DB_SERVER,
  dbPort: r.DB_PORT,
  dbName: r.DB_NAME,
  dbUser: r.DB_USER ?? null,
  dbSifreTanimli: !!r.DB_SIFRE_TANIMLI,
  dogrulandi: !!r.DOGRULANDI,
  dogrulayanAdminId: r.DOGRULAYAN_ADMIN_ID ?? null,
  dogrulayanAdmin: r.DOGRULAYAN_ADMIN ?? null,
  dogrulamaTarihi: r.DOGRULAMA_TARIHI ?? null,
  dogrulamaNotu: r.DOGRULAMA_NOTU ?? null,
  dbSonTestTarihi: r.DB_SON_TEST_TARIHI ?? null,
  dbSonTestSonucu: r.DB_SON_TEST_SONUCU ?? null,
  masakDurumu: r.MASAK_DURUMU ?? null,
  masakSonKontrol: r.MASAK_SON_KONTROL ?? null,
  olusturmaTarihi: r.OLUSTURMA_TARIHI,
  kullaniciSayisi: r.KULLANICI_SAYISI || 0,
  lisansDurumu: lisansDurumu(r.LISANS_ID ?? null, r.KALAN_GUN ?? null),
  lisansKalanGun: r.LISANS_ID ? r.KALAN_GUN : null,
  aktifLisans: r.LISANS_ID
    ? {
        lisansId: r.LISANS_ID,
        baslangic: gunYaz(r.BASLANGIC),
        bitis: gunYaz(r.BITIS),
        kullaniciLimiti: r.KULLANICI_LIMITI,
        paketAdi: r.PAKET_ADI ?? null,
      }
    : null,
});

/** Tabloya yazılan, servis tarafından hazırlanmış alanlar. */
export interface FirmaYazim {
  firmaKodu: string;
  unvan: string;
  vknTckn: string | null;
  vergiDairesi: string | null;
  yetkiliKisi: string | null;
  telefon: string | null;
  eposta: string | null;
  adres: string | null;
  baglantiModu: string;
  dbServer: string;
  dbPort: number;
  dbName: string;
  dbAnahtar: string;
  dbUser: string | null;
}

const yazimGirdileri = (req: sql.Request, v: FirmaYazim): sql.Request =>
  req
    .input("firmaKodu", sql.VarChar(20), v.firmaKodu)
    .input("unvan", sql.NVarChar(200), v.unvan)
    .input("vknTckn", sql.VarChar(11), v.vknTckn)
    .input("vergiDairesi", sql.NVarChar(100), v.vergiDairesi)
    .input("yetkiliKisi", sql.NVarChar(100), v.yetkiliKisi)
    .input("telefon", sql.VarChar(30), v.telefon)
    .input("eposta", sql.NVarChar(150), v.eposta)
    .input("adres", sql.NVarChar(500), v.adres)
    .input("baglantiModu", sql.VarChar(10), v.baglantiModu)
    .input("dbServer", sql.NVarChar(200), v.dbServer)
    .input("dbPort", sql.Int, v.dbPort)
    .input("dbName", sql.NVarChar(128), v.dbName)
    .input("dbAnahtar", sql.VarChar(400), v.dbAnahtar)
    .input("dbUser", sql.NVarChar(128), v.dbUser);

export class FirmaSqlRepository {
  public static async listele(): Promise<FirmaDto[]> {
    const pool = await getAdminPool();
    const res = await pool.request().query(`${SECIM} ORDER BY f.UNVAN`);
    return res.recordset.map(satirdan);
  }

  public static async idIleBul(firmaId: number): Promise<FirmaDto | null> {
    const pool = await getAdminPool();
    const res = await pool.request().input("id", sql.Int, firmaId).query(`${SECIM} WHERE f.FIRMA_ID = @id`);
    return res.recordset[0] ? satirdan(res.recordset[0]) : null;
  }

  /** Giriş anında: kullanıcının bağlandığı sunucu+veritabanından firmayı bulur (bkz. firmaDbAnahtari). */
  public static async anahtarIleBul(dbAnahtar: string): Promise<FirmaDto | null> {
    const pool = await getAdminPool();
    const res = await pool.request().input("anahtar", sql.VarChar(400), dbAnahtar).query(`${SECIM} WHERE f.DB_ANAHTAR = @anahtar`);
    return res.recordset[0] ? satirdan(res.recordset[0]) : null;
  }

  public static async ekle(v: FirmaYazim, dbSifreEnc: string | null): Promise<number> {
    const pool = await getAdminPool();
    const res = await yazimGirdileri(pool.request(), v).input("dbSifreEnc", sql.VarChar(600), dbSifreEnc).query(`
      INSERT INTO dbo.ADM_FIRMA (FIRMA_KODU, UNVAN, VKN_TCKN, VERGI_DAIRESI, YETKILI_KISI, TELEFON, EPOSTA, ADRES,
                                 BAGLANTI_MODU, DB_SERVER, DB_PORT, DB_NAME, DB_ANAHTAR, DB_USER, DB_SIFRE_ENC, DURUM_TARIHI)
      VALUES (@firmaKodu, @unvan, @vknTckn, @vergiDairesi, @yetkiliKisi, @telefon, @eposta, @adres,
              @baglantiModu, @dbServer, @dbPort, @dbName, @dbAnahtar, @dbUser, @dbSifreEnc, GETDATE());
      SELECT CAST(SCOPE_IDENTITY() AS INT) AS FIRMA_ID;
    `);
    return res.recordset[0].FIRMA_ID;
  }

  /** dbSifreEnc undefined ise kayıtlı şifreye dokunulmaz; null ise silinir. */
  public static async guncelle(firmaId: number, v: FirmaYazim, dbSifreEnc: string | null | undefined): Promise<void> {
    const pool = await getAdminPool();
    const req = yazimGirdileri(pool.request(), v).input("id", sql.Int, firmaId);
    if (dbSifreEnc !== undefined) req.input("dbSifreEnc", sql.VarChar(600), dbSifreEnc);
    await req.query(`
      UPDATE dbo.ADM_FIRMA SET
        FIRMA_KODU = @firmaKodu, UNVAN = @unvan, VKN_TCKN = @vknTckn, VERGI_DAIRESI = @vergiDairesi,
        YETKILI_KISI = @yetkiliKisi, TELEFON = @telefon, EPOSTA = @eposta, ADRES = @adres,
        BAGLANTI_MODU = @baglantiModu, DB_SERVER = @dbServer, DB_PORT = @dbPort, DB_NAME = @dbName,
        DB_ANAHTAR = @dbAnahtar, DB_USER = @dbUser
        ${dbSifreEnc !== undefined ? ", DB_SIFRE_ENC = @dbSifreEnc" : ""}
      WHERE FIRMA_ID = @id
    `);
  }

  public static async durumDegistir(firmaId: number, durum: FirmaDurum, not: string | null): Promise<void> {
    const pool = await getAdminPool();
    await pool
      .request()
      .input("id", sql.Int, firmaId)
      .input("durum", sql.VarChar(12), durum)
      .input("not", sql.NVarChar(500), not)
      .query(`UPDATE dbo.ADM_FIRMA SET DURUM = @durum, DURUM_NOTU = @not, DURUM_TARIHI = GETDATE() WHERE FIRMA_ID = @id`);
  }

  public static async dogrulamaYaz(
    firmaId: number,
    dogrulandi: boolean,
    adminId: number,
    not: string | null
  ): Promise<void> {
    const pool = await getAdminPool();
    await pool
      .request()
      .input("id", sql.Int, firmaId)
      .input("dogrulandi", sql.Bit, dogrulandi)
      .input("adminId", sql.Int, adminId)
      .input("not", sql.NVarChar(500), not).query(`
        UPDATE dbo.ADM_FIRMA
        SET DOGRULANDI = @dogrulandi, DOGRULAYAN_ADMIN_ID = @adminId, DOGRULAMA_TARIHI = GETDATE(), DOGRULAMA_NOTU = @not
        WHERE FIRMA_ID = @id
      `);
  }

  /** Firma veritabanına bağlanmak için gereken bilgiler; şifre şifreli haliyle döner, yalnızca serviste çözülür. */
  public static async baglantiBilgisi(
    firmaId: number
  ): Promise<{ dbServer: string; dbPort: number; dbName: string; dbUser: string | null; dbSifreEnc: string | null } | null> {
    const pool = await getAdminPool();
    const res = await pool
      .request()
      .input("id", sql.Int, firmaId)
      .query(`SELECT DB_SERVER, DB_PORT, DB_NAME, DB_USER, DB_SIFRE_ENC FROM dbo.ADM_FIRMA WHERE FIRMA_ID = @id`);
    const r = res.recordset[0];
    if (!r) return null;
    return {
      dbServer: r.DB_SERVER,
      dbPort: r.DB_PORT,
      dbName: r.DB_NAME,
      dbUser: r.DB_USER ?? null,
      dbSifreEnc: r.DB_SIFRE_ENC ?? null,
    };
  }

  public static async dbTestSonucuYaz(firmaId: number, sonuc: string): Promise<void> {
    const pool = await getAdminPool();
    await pool
      .request()
      .input("id", sql.Int, firmaId)
      .input("sonuc", sql.NVarChar(500), sonuc.slice(0, 500))
      .query(`UPDATE dbo.ADM_FIRMA SET DB_SON_TEST_TARIHI = GETDATE(), DB_SON_TEST_SONUCU = @sonuc WHERE FIRMA_ID = @id`);
  }

  public static async masakDurumuYaz(firmaId: number, durum: string): Promise<void> {
    const pool = await getAdminPool();
    await pool
      .request()
      .input("id", sql.Int, firmaId)
      .input("durum", sql.NVarChar(200), durum.slice(0, 200))
      .query(`UPDATE dbo.ADM_FIRMA SET MASAK_DURUMU = @durum, MASAK_SON_KONTROL = GETDATE() WHERE FIRMA_ID = @id`);
  }

  public static async ozet(): Promise<{
    firmaToplam: number;
    firmaAktif: number;
    firmaDondurulmus: number;
    firmaPasif: number;
    dogrulanmamis: number;
    kullaniciAktif: number;
  }> {
    const pool = await getAdminPool();
    const res = await pool.request().query(`
      SELECT
        (SELECT COUNT(*) FROM dbo.ADM_FIRMA) AS FIRMA_TOPLAM,
        (SELECT COUNT(*) FROM dbo.ADM_FIRMA WHERE DURUM = 'AKTIF') AS FIRMA_AKTIF,
        (SELECT COUNT(*) FROM dbo.ADM_FIRMA WHERE DURUM = 'DONDURULMUS') AS FIRMA_DONDURULMUS,
        (SELECT COUNT(*) FROM dbo.ADM_FIRMA WHERE DURUM = 'PASIF') AS FIRMA_PASIF,
        (SELECT COUNT(*) FROM dbo.ADM_FIRMA WHERE DOGRULANDI = 0 AND DURUM <> 'PASIF') AS DOGRULANMAMIS,
        (SELECT COUNT(*) FROM dbo.ADM_KULLANICI WHERE DURUM = 'AKTIF') AS KULLANICI_AKTIF
    `);
    const r = res.recordset[0];
    return {
      firmaToplam: r.FIRMA_TOPLAM,
      firmaAktif: r.FIRMA_AKTIF,
      firmaDondurulmus: r.FIRMA_DONDURULMUS,
      firmaPasif: r.FIRMA_PASIF,
      dogrulanmamis: r.DOGRULANMAMIS,
      kullaniciAktif: r.KULLANICI_AKTIF,
    };
  }
}
