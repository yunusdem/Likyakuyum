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

  public static async ensureTablesAndProcedures(): Promise<void> {
    if (this.tableInitialized) return;
    try {
      const pool = await getDbPool();
      await pool.request().query(`
        IF OBJECT_ID('dbo.TODVZ_VEZNE_PARA_SAYIM', 'U') IS NULL
        BEGIN
          CREATE TABLE dbo.TODVZ_VEZNE_PARA_SAYIM (
            SAYIM_ID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
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
            KAYIT_TARIHI DATETIME NOT NULL DEFAULT GETDATE()
          );
        END;

        IF OBJECT_ID('dbo.TODVZ_VEZNE_PARA_SAYIM_SATIRI', 'U') IS NULL
        BEGIN
          CREATE TABLE dbo.TODVZ_VEZNE_PARA_SAYIM_SATIRI (
            SATIR_ID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
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
      logger.warn("Vezne para sayım tabloları kontrolünde uyarı:", err);
    }
  }

  /**
   * Stored Procedure: SODVZ_VEZNE_PARA_SAYIM_KAYDET ve SODVZ_VEZNE_PARA_SAYIM_SATIR_EKLE kullanarak kaydeder
   */
  public static async saveSayim(payload: SaveVezneParaSayimPayload): Promise<{ sayimId: number }> {
    await this.ensureTablesAndProcedures();
    const pool = await getDbPool();
    const now = new Date();
    const currentTimeStr = now.toTimeString().split(" ")[0].slice(0, 5);
    const countsJsonStr = payload.countsMap ? JSON.stringify(payload.countsMap) : "{}";

    const req = pool.request();
    req.output("SAYIM_ID", sql.Int, payload.sayimId && payload.sayimId > 0 ? payload.sayimId : null);
    req.input("TARIH", sql.Date, payload.tarih ? new Date(payload.tarih) : now);
    req.input("SAAT", sql.VarChar(10), payload.saat || currentTimeStr);
    req.input("VEZNE_ID", sql.Int, payload.vezneId);
    req.input("VEZNE_KODU", sql.VarChar(50), payload.vezneKodu || "");
    req.input("VEZNE_ADI", sql.VarChar(150), payload.vezneAdi || "");
    req.input("KULLANICI_ID", sql.Int, payload.kullaniciId || null);
    req.input("KULLANICI_ADI", sql.VarChar(150), payload.kullaniciAdi || "");
    req.input("ACIKLAMA", sql.VarChar(500), payload.aciklama || "");
    req.input("GENEL_DURUM", sql.VarChar(50), payload.genelDurum || "Dengede");
    req.input("COUNTS_JSON", sql.NVarChar(sql.MAX), countsJsonStr);

    let sayimId: number | null = null;
    try {
      const spRes = await req.execute("dbo.SODVZ_VEZNE_PARA_SAYIM_KAYDET");
      sayimId = spRes.output?.SAYIM_ID || spRes.recordset?.[0]?.SAYIM_ID || payload.sayimId || null;
    } catch {
      // Prosedür henüz derlenmediyse fallback doğrudan insert/update
      if (!payload.sayimId || payload.sayimId <= 0) {
        const ins = await pool.request()
          .input("TARIH", sql.Date, payload.tarih ? new Date(payload.tarih) : now)
          .input("SAAT", sql.VarChar(10), payload.saat || currentTimeStr)
          .input("VEZNE_ID", sql.Int, payload.vezneId)
          .input("VEZNE_KODU", sql.VarChar(50), payload.vezneKodu || "")
          .input("VEZNE_ADI", sql.VarChar(150), payload.vezneAdi || "")
          .input("KULLANICI_ID", sql.Int, payload.kullaniciId || null)
          .input("KULLANICI_ADI", sql.VarChar(150), payload.kullaniciAdi || "")
          .input("ACIKLAMA", sql.VarChar(500), payload.aciklama || "")
          .input("GENEL_DURUM", sql.VarChar(50), payload.genelDurum || "Dengede")
          .input("COUNTS_JSON", sql.NVarChar(sql.MAX), countsJsonStr)
          .query(`
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
        sayimId = ins.recordset[0]?.SAYIM_ID;
      } else {
        sayimId = payload.sayimId;
        await pool.request()
          .input("SAYIM_ID", sql.Int, sayimId)
          .input("TARIH", sql.Date, payload.tarih ? new Date(payload.tarih) : now)
          .input("SAAT", sql.VarChar(10), payload.saat || currentTimeStr)
          .input("VEZNE_ID", sql.Int, payload.vezneId)
          .input("VEZNE_KODU", sql.VarChar(50), payload.vezneKodu || "")
          .input("VEZNE_ADI", sql.VarChar(150), payload.vezneAdi || "")
          .input("KULLANICI_ID", sql.Int, payload.kullaniciId || null)
          .input("KULLANICI_ADI", sql.VarChar(150), payload.kullaniciAdi || "")
          .input("ACIKLAMA", sql.VarChar(500), payload.aciklama || "")
          .input("GENEL_DURUM", sql.VarChar(50), payload.genelDurum || "Dengede")
          .input("COUNTS_JSON", sql.NVarChar(sql.MAX), countsJsonStr)
          .query(`
            UPDATE dbo.TODVZ_VEZNE_PARA_SAYIM
            SET
              TARIH = @TARIH,
              SAAT = @SAAT,
              VEZNE_ID = @VEZNE_ID,
              VEZNE_KODU = @VEZNE_KODU,
              VEZNE_ADI = @VEZNE_ADI,
              KULLANICI_ID = @KULLANICI_ID,
              KULLANICI_ADI = @KULLANICI_ADI,
              ACIKLAMA = @ACIKLAMA,
              GENEL_DURUM = @GENEL_DURUM,
              COUNTS_JSON = @COUNTS_JSON,
              KAYIT_TARIHI = GETDATE()
            WHERE SAYIM_ID = @SAYIM_ID;
            DELETE FROM dbo.TODVZ_VEZNE_PARA_SAYIM_SATIRI WHERE SAYIM_ID = @SAYIM_ID;
          `);
      }
    }

    if (!sayimId) {
      throw new Error("Sayım ID üretilemedi.");
    }

    // Satırları Ekle (SODVZ_VEZNE_PARA_SAYIM_SATIR_EKLE)
    if (payload.satirlar && payload.satirlar.length > 0) {
      for (const satir of payload.satirlar) {
        try {
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

          await satReq.execute("dbo.SODVZ_VEZNE_PARA_SAYIM_SATIR_EKLE");
        } catch {
          // Fallback direct insert
          const satReqFallback = pool.request();
          satReqFallback.input("SAYIM_ID", sql.Int, sayimId);
          satReqFallback.input("PARA_ID", sql.Int, satir.paraId || 0);
          satReqFallback.input("PARA_KODU", sql.VarChar(20), satir.paraKodu || "");
          satReqFallback.input("PARA_ADI", sql.VarChar(100), satir.paraAdi || "");
          satReqFallback.input("KASA_BAKIYESI", sql.Float, satir.kasaBakiyesi || 0);
          satReqFallback.input("SAYILAN_TUTAR", sql.Float, satir.sayilanTutar || 0);
          satReqFallback.input("FARK", sql.Float, satir.fark || 0);
          satReqFallback.input("TOPLAM_ADET", sql.Int, satir.toplamAdet || 0);
          satReqFallback.input("KUPURLER_JSON", sql.NVarChar(sql.MAX), satir.kupurler ? JSON.stringify(satir.kupurler) : "{}");

          await satReqFallback.query(`
            INSERT INTO dbo.TODVZ_VEZNE_PARA_SAYIM_SATIRI (
              SAYIM_ID, PARA_ID, PARA_KODU, PARA_ADI, KASA_BAKIYESI, SAYILAN_TUTAR, FARK, TOPLAM_ADET, KUPURLER_JSON
            ) VALUES (
              @SAYIM_ID, @PARA_ID, @PARA_KODU, @PARA_ADI, @KASA_BAKIYESI, @SAYILAN_TUTAR, @FARK, @TOPLAM_ADET, @KUPURLER_JSON
            );
          `);
        }
      }
    }

    return { sayimId };
  }

  /**
   * Veznenin en son sayımını getirir
   */
  public static async getSonSayimByVezne(vezneId: number): Promise<any | null> {
    await this.ensureTablesAndProcedures();
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

  /**
   * Stored Procedure: SODVZ_VEZNE_PARA_SAYIM_LISTELE
   */
  public static async getGecmisSayimlar(vezneId: number, limit = 100): Promise<any[]> {
    await this.ensureTablesAndProcedures();
    const pool = await getDbPool();
    const req = pool.request();
    req.input("VEZNE_ID", sql.Int, vezneId || 0);
    req.input("LIMIT", sql.Int, limit);

    try {
      const spRes = await req.execute("dbo.SODVZ_VEZNE_PARA_SAYIM_LISTELE");
      return spRes.recordset || [];
    } catch {
      // Fallback
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
  }

  /**
   * Stored Procedure: SODVZ_VEZNE_PARA_SAYIM_GETIR
   */
  public static async getSayimById(sayimId: number): Promise<any | null> {
    await this.ensureTablesAndProcedures();
    const pool = await getDbPool();
    const req = pool.request();
    req.input("SAYIM_ID", sql.Int, sayimId);

    try {
      const spRes: any = await req.execute("dbo.SODVZ_VEZNE_PARA_SAYIM_GETIR");
      const recordsets = spRes.recordsets as any[] || [];
      const header = recordsets[0]?.[0];
      if (!header) return null;

      try {
        header.countsMap = header.countsJson ? JSON.parse(header.countsJson) : {};
      } catch {
        header.countsMap = {};
      }

      const rows = recordsets[1] || [];
      header.satirlar = rows.map((s: any) => {
        try {
          s.kupurler = s.kupurlerJson ? JSON.parse(s.kupurlerJson) : {};
        } catch {
          s.kupurler = {};
        }
        return s;
      });

      return header;
    } catch {
      // Fallback
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

      item.satirlar = satRes.recordset.map((s: any) => {
        try {
          s.kupurler = s.kupurlerJson ? JSON.parse(s.kupurlerJson) : {};
        } catch {
          s.kupurler = {};
        }
        return s;
      });

      return item;
    }
  }

  /**
   * Stored Procedure: SODVZ_VEZNE_PARA_SAYIM_SIL
   */
  public static async deleteSayim(sayimId: number): Promise<boolean> {
    await this.ensureTablesAndProcedures();
    const pool = await getDbPool();
    const req = pool.request();
    req.input("SAYIM_ID", sql.Int, sayimId);

    try {
      await req.execute("dbo.SODVZ_VEZNE_PARA_SAYIM_SIL");
    } catch {
      await req.query(`
        DELETE FROM dbo.TODVZ_VEZNE_PARA_SAYIM_SATIRI WHERE SAYIM_ID = @SAYIM_ID;
        DELETE FROM dbo.TODVZ_VEZNE_PARA_SAYIM WHERE SAYIM_ID = @SAYIM_ID;
      `);
    }

    return true;
  }
}
