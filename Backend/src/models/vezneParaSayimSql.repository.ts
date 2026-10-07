import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { logger } from "../utils/logger.js";

export interface VezneParaSayimSatirPayload {
  paraId: number;
  paraKodu: string;
  paraAdi?: string;
  kasaBakiyesi: number;
  sayilanTutar: number;
  fark: number;
  toplamAdet: number;
  kupurler?: Record<number | string, number>;
}

export interface SaveVezneParaSayimPayload {
  sayimId?: number | null;
  tarih: string;
  saat?: string;
  vezneId: number;
  vezneKodu?: string;
  vezneAdi?: string;
  kullaniciId?: number | null;
  kullaniciAdi?: string;
  aciklama?: string;
  genelDurum?: string;
  countsMap?: Record<string, Record<number | string, number>>;
  satirlar?: VezneParaSayimSatirPayload[];
}

export class VezneParaSayimSqlRepository {
  private static tableInitialized = false;

  public static async ensureTables(): Promise<void> {
    if (this.tableInitialized) return;
    try {
      const pool = await getDbPool();
      await pool.request().query(`
        IF OBJECT_ID('dbo.TODVZ_VEZNE_PARA_SAYIM', 'U') IS NULL
        BEGIN
          CREATE TABLE dbo.TODVZ_VEZNE_PARA_SAYIM (
            SAYIM_ID INT IDENTITY(1,1) PRIMARY KEY,
            TARIH DATE NOT NULL,
            SAAT VARCHAR(10) NULL,
            VEZNE_ID INT NOT NULL,
            VEZNE_KODU VARCHAR(50) NULL,
            VEZNE_ADI VARCHAR(150) NULL,
            KULLANICI_ID INT NULL,
            KULLANICI_ADI VARCHAR(150) NULL,
            ACIKLAMA VARCHAR(500) NULL,
            GENEL_DURUM VARCHAR(50) NULL,
            COUNTS_JSON NVARCHAR(MAX) NULL,
            KAYIT_TARIHI DATETIME DEFAULT GETDATE()
          );
        END;

        IF OBJECT_ID('dbo.TODVZ_VEZNE_PARA_SAYIM_SATIRI', 'U') IS NULL
        BEGIN
          CREATE TABLE dbo.TODVZ_VEZNE_PARA_SAYIM_SATIRI (
            SATIR_ID INT IDENTITY(1,1) PRIMARY KEY,
            SAYIM_ID INT NOT NULL,
            PARA_ID INT NOT NULL,
            PARA_KODU VARCHAR(20) NOT NULL,
            PARA_ADI VARCHAR(100) NULL,
            KASA_BAKIYESI FLOAT NOT NULL DEFAULT 0,
            SAYILAN_TUTAR FLOAT NOT NULL DEFAULT 0,
            FARK FLOAT NOT NULL DEFAULT 0,
            TOPLAM_ADET INT NOT NULL DEFAULT 0,
            KUPURLER_JSON NVARCHAR(MAX) NULL,
            CONSTRAINT FK_TODVZ_VEZNE_PARA_SAYIM FOREIGN KEY (SAYIM_ID) REFERENCES dbo.TODVZ_VEZNE_PARA_SAYIM(SAYIM_ID) ON DELETE CASCADE
          );
        END;
      `);
      this.tableInitialized = true;
    } catch (err) {
      logger.warn("Vezne para sayım tabloları oluşturulurken uyarı:", err);
    }
  }

  public static async saveSayim(payload: SaveVezneParaSayimPayload): Promise<{ sayimId: number }> {
    await this.ensureTables();
    const pool = await getDbPool();
    const now = new Date();
    const currentTimeStr = now.toTimeString().split(" ")[0].slice(0, 5);

    const countsJsonStr = payload.countsMap ? JSON.stringify(payload.countsMap) : "{}";

    const insertReq = pool.request();
    insertReq.input("TARIH", sql.Date, payload.tarih ? new Date(payload.tarih) : now);
    insertReq.input("SAAT", sql.VarChar(10), payload.saat || currentTimeStr);
    insertReq.input("VEZNE_ID", sql.Int, payload.vezneId);
    insertReq.input("VEZNE_KODU", sql.VarChar(50), payload.vezneKodu || "");
    insertReq.input("VEZNE_ADI", sql.VarChar(150), payload.vezneAdi || "");
    insertReq.input("KULLANICI_ID", sql.Int, payload.kullaniciId || null);
    insertReq.input("KULLANICI_ADI", sql.VarChar(150), payload.kullaniciAdi || "");
    insertReq.input("ACIKLAMA", sql.VarChar(500), payload.aciklama || "");
    insertReq.input("GENEL_DURUM", sql.VarChar(50), payload.genelDurum || "Kaydedildi");
    insertReq.input("COUNTS_JSON", sql.NVarChar(sql.MAX), countsJsonStr);

    const insertRes = await insertReq.query(`
      INSERT INTO dbo.TODVZ_VEZNE_PARA_SAYIM (
        TARIH, SAAT, VEZNE_ID, VEZNE_KODU, VEZNE_ADI,
        KULLANICI_ID, KULLANICI_ADI, ACIKLAMA, GENEL_DURUM, COUNTS_JSON, KAYIT_TARIHI
      )
      OUTPUT INSERTED.SAYIM_ID
      VALUES (
        @TARIH, @SAAT, @VEZNE_ID, @VEZNE_KODU, @VEZNE_ADI,
        @KULLANICI_ID, @KULLANICI_ADI, @ACIKLAMA, @GENEL_DURUM, @COUNTS_JSON, GETDATE()
      );
    `);

    const sayimId = insertRes.recordset[0]?.SAYIM_ID;

    if (sayimId && payload.satirlar && payload.satirlar.length > 0) {
      for (const satir of payload.satirlar) {
        const satReq = pool.request();
        satReq.input("SAYIM_ID", sql.Int, sayimId);
        satReq.input("PARA_ID", sql.Int, satir.paraId || 0);
        satReq.input("PARA_KODU", sql.VarChar(20), satir.paraKodu || "");
        satReq.input("PARA_ADI", sql.VarChar(100), satir.paraAdi || "");
        satReq.input("KASA_BAKIYESI", sql.Float, satir.kasaBakiyesi || 0);
        satReq.input("SAYILAN_TUTAR", sql.Float, satir.sayilanTutar || 0);
        satReq.input("FARK", sql.Float, satir.fark || 0);
        satReq.input("TOPLAM_ADET", sql.Int, satir.toplamAdet || 0);
        satReq.input("KUPURLER_JSON", sql.NVarChar(sql.MAX), satir.kupurler ? JSON.stringify(satir.kupurler) : "{}");

        await satReq.query(`
          INSERT INTO dbo.TODVZ_VEZNE_PARA_SAYIM_SATIRI (
            SAYIM_ID, PARA_ID, PARA_KODU, PARA_ADI, KASA_BAKIYESI, SAYILAN_TUTAR, FARK, TOPLAM_ADET, KUPURLER_JSON
          ) VALUES (
            @SAYIM_ID, @PARA_ID, @PARA_KODU, @PARA_ADI, @KASA_BAKIYESI, @SAYILAN_TUTAR, @FARK, @TOPLAM_ADET, @KUPURLER_JSON
          );
        `);
      }
    }

    return { sayimId };
  }

  public static async getSonSayimByVezne(vezneId: number): Promise<any | null> {
    await this.ensureTables();
    const pool = await getDbPool();
    const req = pool.request();
    req.input("VEZNE_ID", sql.Int, vezneId);

    const res = await req.query(`
      SELECT TOP 1 
        SAYIM_ID AS sayimId,
        TARIH AS tarih,
        SAAT AS saat,
        VEZNE_ID AS vezneId,
        VEZNE_KODU AS vezneKodu,
        VEZNE_ADI AS vezneAdi,
        KULLANICI_ID AS kullaniciId,
        KULLANICI_ADI AS kullaniciAdi,
        ACIKLAMA AS aciklama,
        GENEL_DURUM AS genelDurum,
        COUNTS_JSON AS countsJson,
        KAYIT_TARIHI AS kayitTarihi
      FROM dbo.TODVZ_VEZNE_PARA_SAYIM
      WHERE VEZNE_ID = @VEZNE_ID
      ORDER BY SAYIM_ID DESC;
    `);

    if (res.recordset.length === 0) return null;
    const item = res.recordset[0];
    try {
      item.countsMap = item.countsJson ? JSON.parse(item.countsJson) : {};
    } catch {
      item.countsMap = {};
    }
    return item;
  }

  public static async getGecmisSayimlar(vezneId: number, limit = 50): Promise<any[]> {
    await this.ensureTables();
    const pool = await getDbPool();
    const req = pool.request();
    req.input("VEZNE_ID", sql.Int, vezneId);
    req.input("LIMIT", sql.Int, limit);

    const res = await req.query(`
      SELECT TOP (@LIMIT)
        SAYIM_ID AS sayimId,
        TARIH AS tarih,
        SAAT AS saat,
        VEZNE_ID AS vezneId,
        VEZNE_KODU AS vezneKodu,
        VEZNE_ADI AS vezneAdi,
        KULLANICI_ID AS kullaniciId,
        KULLANICI_ADI AS kullaniciAdi,
        ACIKLAMA AS aciklama,
        GENEL_DURUM AS genelDurum,
        KAYIT_TARIHI AS kayitTarihi
      FROM dbo.TODVZ_VEZNE_PARA_SAYIM
      WHERE (@VEZNE_ID = 0 OR VEZNE_ID = @VEZNE_ID)
      ORDER BY SAYIM_ID DESC;
    `);

    return res.recordset;
  }

  public static async getSayimById(sayimId: number): Promise<any | null> {
    await this.ensureTables();
    const pool = await getDbPool();
    const req = pool.request();
    req.input("SAYIM_ID", sql.Int, sayimId);

    const headerRes = await req.query(`
      SELECT 
        SAYIM_ID AS sayimId,
        TARIH AS tarih,
        SAAT AS saat,
        VEZNE_ID AS vezneId,
        VEZNE_KODU AS vezneKodu,
        VEZNE_ADI AS vezneAdi,
        KULLANICI_ID AS kullaniciId,
        KULLANICI_ADI AS kullaniciAdi,
        ACIKLAMA AS aciklama,
        GENEL_DURUM AS genelDurum,
        COUNTS_JSON AS countsJson,
        KAYIT_TARIHI AS kayitTarihi
      FROM dbo.TODVZ_VEZNE_PARA_SAYIM
      WHERE SAYIM_ID = @SAYIM_ID;
    `);

    if (headerRes.recordset.length === 0) return null;
    const item = headerRes.recordset[0];
    try {
      item.countsMap = item.countsJson ? JSON.parse(item.countsJson) : {};
    } catch {
      item.countsMap = {};
    }

    const satReq = pool.request();
    satReq.input("SAYIM_ID", sql.Int, sayimId);
    const satRes = await satReq.query(`
      SELECT 
        SATIR_ID AS satirId,
        SAYIM_ID AS sayimId,
        PARA_ID AS paraId,
        PARA_KODU AS paraKodu,
        PARA_ADI AS paraAdi,
        KASA_BAKIYESI AS kasaBakiyesi,
        SAYILAN_TUTAR AS sayilanTutar,
        FARK AS fark,
        TOPLAM_ADET AS toplamAdet,
        KUPURLER_JSON AS kupurlerJson
      FROM dbo.TODVZ_VEZNE_PARA_SAYIM_SATIRI
      WHERE SAYIM_ID = @SAYIM_ID
      ORDER BY SATIR_ID ASC;
    `);

    item.satirlar = satRes.recordset.map((s) => {
      try {
        s.kupurler = s.kupurlerJson ? JSON.parse(s.kupurlerJson) : {};
      } catch {
        s.kupurler = {};
      }
      return s;
    });

    return item;
  }

  public static async deleteSayim(sayimId: number): Promise<boolean> {
    await this.ensureTables();
    const pool = await getDbPool();
    const req = pool.request();
    req.input("SAYIM_ID", sql.Int, sayimId);

    await req.query(`
      DELETE FROM dbo.TODVZ_VEZNE_PARA_SAYIM_SATIRI WHERE SAYIM_ID = @SAYIM_ID;
      DELETE FROM dbo.TODVZ_VEZNE_PARA_SAYIM WHERE SAYIM_ID = @SAYIM_ID;
    `);

    return true;
  }
}
