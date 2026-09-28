import sql from "mssql";
import { getAdminPool } from "../../config/adminDb.config.js";
import { sifrele, sifreCoz } from "../../utils/kripto.utils.js";
import { logger } from "../../utils/logger.js";

/** Merkezi GİB hesabı, VKN sorgu önbelleği ve sorgu kaydı (LIKYA_ADMIN; docs/GIB_VKN_SORGU_YOL_HARITASI.md). */

export interface GibHesapDurumu {
  tanimli: boolean;
  kullaniciKodu: string | null;
  sonBasariliGiris: Date | null;
  sonHata: string | null;
  sonHataTarihi: Date | null;
  guncellemeTarihi: Date | null;
}

export interface VknOnbellekKaydi {
  no: string;
  tur: "VKN" | "TCKN";
  sonuc: "BULUNDU" | "KAYIT_YOK";
  unvan: string | null;
  ad: string | null;
  soyad: string | null;
  vergiDairesi: string | null;
  sorguTarihi: Date;
}

export class GibSqlRepository {
  /** Çözülmüş hesap bilgisi; tanımsızsa ya da çözülemezse null. Yalnız sunucu içinde kullanılır. */
  public static async hesap(): Promise<{ kullaniciKodu: string; sifre: string } | null> {
    const pool = await getAdminPool();
    const r = await pool.request().query(`SELECT KULLANICI_KODU_ENC, SIFRE_ENC FROM dbo.ADM_GIB_HESAP WHERE HESAP_ID = 1`);
    const satir = r.recordset[0];
    if (!satir) return null;
    const kullaniciKodu = sifreCoz(satir.KULLANICI_KODU_ENC);
    const sifre = sifreCoz(satir.SIFRE_ENC);
    if (!kullaniciKodu || !sifre) {
      logger.error("[GIB] Merkezi hesap çözülemedi (ADMIN_DB_ENC_KEY değişmiş olabilir).");
      return null;
    }
    return { kullaniciKodu, sifre };
  }

  public static async durum(): Promise<GibHesapDurumu> {
    const pool = await getAdminPool();
    const r = await pool.request().query(`
      SELECT KULLANICI_KODU_ENC, SON_BASARILI_GIRIS, SON_HATA, SON_HATA_TARIHI, GUNCELLEME_TARIHI
      FROM dbo.ADM_GIB_HESAP WHERE HESAP_ID = 1
    `);
    const s = r.recordset[0];
    if (!s) return { tanimli: false, kullaniciKodu: null, sonBasariliGiris: null, sonHata: null, sonHataTarihi: null, guncellemeTarihi: null };
    return {
      tanimli: true,
      kullaniciKodu: sifreCoz(s.KULLANICI_KODU_ENC),
      sonBasariliGiris: s.SON_BASARILI_GIRIS ?? null,
      sonHata: s.SON_HATA ?? null,
      sonHataTarihi: s.SON_HATA_TARIHI ?? null,
      guncellemeTarihi: s.GUNCELLEME_TARIHI ?? null,
    };
  }

  public static async hesapYaz(kullaniciKodu: string, sifre: string, adminId: number): Promise<void> {
    const pool = await getAdminPool();
    await pool
      .request()
      .input("kod", sql.NVarChar(500), sifrele(kullaniciKodu))
      .input("sifre", sql.NVarChar(1000), sifrele(sifre))
      .input("adminId", sql.Int, adminId).query(`
        MERGE dbo.ADM_GIB_HESAP AS h
        USING (SELECT 1 AS HESAP_ID) AS k ON h.HESAP_ID = k.HESAP_ID
        WHEN MATCHED THEN UPDATE SET KULLANICI_KODU_ENC = @kod, SIFRE_ENC = @sifre, SON_BASARILI_GIRIS = NULL,
             SON_HATA = NULL, SON_HATA_TARIHI = NULL, GUNCELLEYEN_ADMIN_ID = @adminId, GUNCELLEME_TARIHI = GETDATE()
        WHEN NOT MATCHED THEN INSERT (HESAP_ID, KULLANICI_KODU_ENC, SIFRE_ENC, GUNCELLEYEN_ADMIN_ID)
             VALUES (1, @kod, @sifre, @adminId);
      `);
  }

  public static async hesapSil(): Promise<void> {
    const pool = await getAdminPool();
    await pool.request().query(`DELETE FROM dbo.ADM_GIB_HESAP WHERE HESAP_ID = 1`);
  }

  /** Giriş sonucunu hesaba işler; hata yazılamazsa asıl işlem bozulmaz. */
  public static async girisSonucu(basarili: boolean, hata?: string): Promise<void> {
    try {
      const pool = await getAdminPool();
      const req = pool.request();
      if (basarili) {
        await req.query(`UPDATE dbo.ADM_GIB_HESAP SET SON_BASARILI_GIRIS = GETDATE(), SON_HATA = NULL, SON_HATA_TARIHI = NULL WHERE HESAP_ID = 1`);
      } else {
        await req
          .input("hata", sql.NVarChar(500), (hata || "Bilinmeyen hata").slice(0, 500))
          .query(`UPDATE dbo.ADM_GIB_HESAP SET SON_HATA = @hata, SON_HATA_TARIHI = GETDATE() WHERE HESAP_ID = 1`);
      }
    } catch (err: any) {
      logger.error(`[GIB] Giriş sonucu yazılamadı: ${err?.message}`);
    }
  }

  public static async onbellekOku(no: string): Promise<VknOnbellekKaydi | null> {
    const pool = await getAdminPool();
    const r = await pool
      .request()
      .input("no", sql.VarChar(11), no)
      .query(`SELECT NO, TUR, SONUC, UNVAN, AD, SOYAD, VERGI_DAIRESI, SORGU_TARIHI FROM dbo.ADM_VKN_SORGU WHERE NO = @no`);
    const s = r.recordset[0];
    if (!s) return null;
    return {
      no: s.NO,
      tur: s.TUR,
      sonuc: s.SONUC,
      unvan: s.UNVAN ?? null,
      ad: s.AD ?? null,
      soyad: s.SOYAD ?? null,
      vergiDairesi: s.VERGI_DAIRESI ?? null,
      sorguTarihi: s.SORGU_TARIHI,
    };
  }

  public static async onbellekYaz(k: Omit<VknOnbellekKaydi, "sorguTarihi">): Promise<void> {
    try {
      const pool = await getAdminPool();
      await pool
        .request()
        .input("no", sql.VarChar(11), k.no)
        .input("tur", sql.VarChar(4), k.tur)
        .input("sonuc", sql.VarChar(10), k.sonuc)
        .input("unvan", sql.NVarChar(300), k.unvan?.slice(0, 300) ?? null)
        .input("ad", sql.NVarChar(100), k.ad?.slice(0, 100) ?? null)
        .input("soyad", sql.NVarChar(100), k.soyad?.slice(0, 100) ?? null)
        .input("vd", sql.NVarChar(150), k.vergiDairesi?.slice(0, 150) ?? null).query(`
          MERGE dbo.ADM_VKN_SORGU AS h
          USING (SELECT @no AS NO) AS k ON h.NO = k.NO
          WHEN MATCHED THEN UPDATE SET TUR = @tur, SONUC = @sonuc, UNVAN = @unvan, AD = @ad, SOYAD = @soyad,
               VERGI_DAIRESI = @vd, SORGU_TARIHI = GETDATE()
          WHEN NOT MATCHED THEN INSERT (NO, TUR, SONUC, UNVAN, AD, SOYAD, VERGI_DAIRESI)
               VALUES (@no, @tur, @sonuc, @unvan, @ad, @soyad, @vd);
        `);
    } catch (err: any) {
      logger.error(`[GIB] Önbelleğe yazılamadı: ${err?.message}`);
    }
  }

  public static async sorguLogu(k: {
    firmaId: number | null;
    dbAdi: string | null;
    kullanici: string;
    no: string;
    sonuc: "BULUNDU" | "KAYIT_YOK" | "HATA";
    kaynak: string | null;
  }): Promise<void> {
    try {
      const pool = await getAdminPool();
      await pool
        .request()
        .input("firmaId", sql.Int, k.firmaId)
        .input("db", sql.NVarChar(128), k.dbAdi?.slice(0, 128) ?? null)
        .input("kullanici", sql.NVarChar(100), (k.kullanici || "").slice(0, 100))
        .input("no", sql.VarChar(11), k.no)
        .input("sonuc", sql.VarChar(12), k.sonuc)
        .input("kaynak", sql.VarChar(10), k.kaynak).query(`
          INSERT INTO dbo.ADM_VKN_SORGU_LOG (FIRMA_ID, DB_ADI, KULLANICI, NO, SONUC, KAYNAK)
          VALUES (@firmaId, @db, @kullanici, @no, @sonuc, @kaynak)
        `);
    } catch (err: any) {
      logger.error(`[GIB] Sorgu kaydı yazılamadı: ${err?.message}`);
    }
  }
}
