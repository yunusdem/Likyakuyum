import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import type { DbBaglam } from "./mobilFirmaSql.repository.js";

/**
 * Mobil emirler — firma veritabanı (Backend/migrations/024_mobil.sql; docs/MOBIL_CARI_YOL_HARITASI.md K17, K30–K33).
 * Süre denetimi daima SQL saatiyle (GETDATE): sürücü DATETIME'ı UTC saydığı için JS'te karşılaştırılmaz.
 */

const havuz = (ctx: DbBaglam) => getDbPool(ctx.dbServer, ctx.dbName);

export type EmirDurum = "BEKLIYOR" | "ISLENIYOR" | "ONAYLANDI" | "REDDEDILDI" | "SURESI_DOLDU" | "IPTAL";

export interface MobilEmir {
  emirId: number;
  cariKartId: number;
  cariKod: string | null;
  cariAd: string | null;
  mobilKullaniciId: number;
  mobilKullaniciAdi: string | null;
  tur: "PARA" | "STOK";
  yon: "AL" | "SAT";
  toplamTl: number;
  tercih: string | null;
  notu: string | null;
  durum: EmirDurum;
  olusturmaTarihi: Date;
  gecerlilikBitis: Date;
  kalanSn: number;
  islemTarihi: Date | null;
  isleyenKullaniciAdi: string | null;
  redNedeni: string | null;
  odemeSekli: string | null;
  fisTuru: string | null;
  fisId: number | null;
  fisNo: string | null;
  satirlar: { urunId: number; urunKod: string | null; urunAd: string | null; miktar: number; birim: string | null; birimFiyat: number; tutar: number }[];
}

const SECIM = `
  SELECT E.*, RTRIM(C.KOD) CARI_KOD, RTRIM(C.AD) CARI_AD,
         CASE WHEN E.DURUM = 'BEKLIYOR' THEN DATEDIFF(SECOND, DATEADD(HOUR, 3, GETUTCDATE()), E.GECERLILIK_BITIS) ELSE 0 END KALAN_SN
  FROM dbo.LKY_MOBIL_EMIR E LEFT JOIN dbo.TODVZ_CARI_KART C ON C.CARI_KART_ID = E.CARI_KART_ID`;

const emirOku = (x: any, satirlar: any[]): MobilEmir => ({
  emirId: x.EMIR_ID,
  cariKartId: x.CARI_KART_ID,
  cariKod: x.CARI_KOD ?? null,
  cariAd: x.CARI_AD ?? null,
  mobilKullaniciId: x.MOBIL_KULLANICI_ID,
  mobilKullaniciAdi: x.MOBIL_KULLANICI_ADI ?? null,
  tur: x.TUR,
  yon: x.YON,
  toplamTl: Number(x.TOPLAM_TL),
  tercih: x.TERCIH ?? null,
  notu: x.NOTU ?? null,
  durum: x.DURUM,
  olusturmaTarihi: x.OLUSTURMA_TARIHI,
  gecerlilikBitis: x.GECERLILIK_BITIS,
  kalanSn: Math.max(0, Number(x.KALAN_SN) || 0),
  islemTarihi: x.ISLEM_TARIHI ?? null,
  isleyenKullaniciAdi: x.ISLEYEN_KULLANICI_ADI ?? null,
  redNedeni: x.RED_NEDENI ?? null,
  odemeSekli: x.ODEME_SEKLI ?? null,
  fisTuru: x.FIS_TURU ?? null,
  fisId: x.FIS_ID ?? null,
  fisNo: x.FIS_NO ?? null,
  satirlar: satirlar
    .filter((s) => s.EMIR_ID === x.EMIR_ID)
    .map((s) => ({
      urunId: s.URUN_ID,
      urunKod: s.URUN_KOD ?? null,
      urunAd: s.URUN_AD ?? null,
      miktar: Number(s.MIKTAR),
      birim: s.BIRIM ?? null,
      birimFiyat: Number(s.BIRIM_FIYAT),
      tutar: Number(s.TUTAR),
    })),
});

export class MobilEmirSqlRepository {
  /** Süresi geçmiş bekleyen emirleri işaretler; işaretlenenleri döner (cariye e-posta için) */
  public static async suresiDolanlariIsle(ctx: DbBaglam): Promise<{ emirId: number; mobilKullaniciId: number; cariKartId: number }[]> {
    const r = await (await havuz(ctx)).request().query(`
      UPDATE dbo.LKY_MOBIL_EMIR SET DURUM = 'SURESI_DOLDU', ISLEM_TARIHI = DATEADD(HOUR, 3, GETUTCDATE())
      OUTPUT inserted.EMIR_ID, inserted.MOBIL_KULLANICI_ID, inserted.CARI_KART_ID
      WHERE DURUM = 'BEKLIYOR' AND GECERLILIK_BITIS <= DATEADD(HOUR, 3, GETUTCDATE());`);
    return r.recordset.map((x: any) => ({ emirId: x.EMIR_ID, mobilKullaniciId: x.MOBIL_KULLANICI_ID, cariKartId: x.CARI_KART_ID }));
  }

  public static async bekleyenVarMi(ctx: DbBaglam): Promise<boolean> {
    const r = await (await havuz(ctx)).request().query(`SELECT CASE WHEN EXISTS (SELECT 1 FROM dbo.LKY_MOBIL_EMIR WHERE DURUM = 'BEKLIYOR') THEN 1 ELSE 0 END AS V`);
    return !!r.recordset[0].V;
  }

  /** Carinin bugünkü (bekleyen + onaylanan) emir toplamı ve onay bekleyen alış emirleri toplamı */
  public static async cariToplamlari(ctx: DbBaglam, cariKartId: number): Promise<{ bugun: number; bekleyenAlis: number }> {
    const r = await (await havuz(ctx)).request().input("cari", sql.Int, cariKartId).query(`
      SELECT
        ISNULL(SUM(CASE WHEN DURUM IN ('BEKLIYOR','ONAYLANDI') AND CAST(OLUSTURMA_TARIHI AS date) = CAST(DATEADD(HOUR, 3, GETUTCDATE()) AS date) THEN TOPLAM_TL END), 0) AS BUGUN,
        ISNULL(SUM(CASE WHEN DURUM = 'BEKLIYOR' AND YON = 'AL' THEN TOPLAM_TL END), 0) AS BEKLEYEN_ALIS
      FROM dbo.LKY_MOBIL_EMIR WHERE CARI_KART_ID = @cari;`);
    return { bugun: Number(r.recordset[0].BUGUN), bekleyenAlis: Number(r.recordset[0].BEKLEYEN_ALIS) };
  }

  /**
   * Yeni emir (tek işlem). Emir saatleri Türkiye saatiyle tutulur (DATEADD(HOUR, 3, GETUTCDATE())): veritabanı / Node
   * sunucusunun saat dilimi farklı olabilir (canlı sunucu UTC-7, utils/zaman.utils.ts); süreler hep aynı saatle karşılaştırılır.
   */
  public static async ekle(
    ctx: DbBaglam,
    e: {
      cariKartId: number;
      mobilKullaniciId: number;
      mobilKullaniciAdi: string;
      tur: "PARA" | "STOK";
      yon: "AL" | "SAT";
      toplamTl: number;
      tercih: string | null;
      notu: string | null;
      gecerlilikSn: number;
      satirlar: { urunId: number; urunKod: string; urunAd: string; miktar: number; birim: string; birimFiyat: number; tutar: number }[];
    }
  ): Promise<number> {
    const pool = await havuz(ctx);
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      const r = await new sql.Request(tx)
        .input("cari", sql.Int, e.cariKartId)
        .input("mk", sql.Int, e.mobilKullaniciId)
        .input("mkAd", sql.NVarChar(100), e.mobilKullaniciAdi)
        .input("tur", sql.VarChar(10), e.tur)
        .input("yon", sql.VarChar(3), e.yon)
        .input("toplam", sql.Decimal(18, 2), e.toplamTl)
        .input("tercih", sql.VarChar(20), e.tercih)
        .input("notu", sql.NVarChar(500), e.notu)
        .input("sn", sql.Int, e.gecerlilikSn).query(`
          INSERT INTO dbo.LKY_MOBIL_EMIR (CARI_KART_ID, MOBIL_KULLANICI_ID, MOBIL_KULLANICI_ADI, TUR, YON, TOPLAM_TL, TERCIH, NOTU, OLUSTURMA_TARIHI, GECERLILIK_BITIS)
          VALUES (@cari, @mk, @mkAd, @tur, @yon, @toplam, @tercih, @notu, DATEADD(HOUR, 3, GETUTCDATE()), DATEADD(SECOND, @sn, DATEADD(HOUR, 3, GETUTCDATE())));
          SELECT CAST(SCOPE_IDENTITY() AS int) AS ID;`);
      const id = r.recordset[0].ID;
      for (const s of e.satirlar) {
        await new sql.Request(tx)
          .input("id", sql.Int, id)
          .input("urun", sql.Int, s.urunId)
          .input("kod", sql.NVarChar(40), s.urunKod)
          .input("ad", sql.NVarChar(200), s.urunAd)
          .input("miktar", sql.Decimal(18, 4), s.miktar)
          .input("birim", sql.NVarChar(10), s.birim)
          .input("fiyat", sql.Decimal(18, 6), s.birimFiyat)
          .input("tutar", sql.Decimal(18, 2), s.tutar)
          .query(`INSERT INTO dbo.LKY_MOBIL_EMIR_SATIRI (EMIR_ID, URUN_ID, URUN_KOD, URUN_AD, MIKTAR, BIRIM, BIRIM_FIYAT, TUTAR)
                  VALUES (@id, @urun, @kod, @ad, @miktar, @birim, @fiyat, @tutar)`);
      }
      await tx.commit();
      return id;
    } catch (err) {
      await tx.rollback().catch(() => undefined);
      throw err;
    }
  }

  public static async getir(ctx: DbBaglam, emirId: number): Promise<MobilEmir | null> {
    const r = await (await havuz(ctx)).request().input("id", sql.Int, emirId).query(`
      ${SECIM} WHERE E.EMIR_ID = @id;
      SELECT * FROM dbo.LKY_MOBIL_EMIR_SATIRI WHERE EMIR_ID = @id ORDER BY SATIR_ID;`);
    const s = (r as any).recordsets as any[][];
    return s[0]?.[0] ? emirOku(s[0][0], s[1] || []) : null;
  }

  /** Liste: cari verilirse yalnız onun; durum verilirse süzülür; en yeni önce */
  public static async liste(ctx: DbBaglam, f: { cariKartId?: number; durum?: EmirDurum | null; gun?: number; adet?: number }): Promise<MobilEmir[]> {
    const r = await (await havuz(ctx))
      .request()
      .input("cari", sql.Int, f.cariKartId ?? null)
      .input("durum", sql.VarChar(12), f.durum ?? null)
      .input("gun", sql.Int, f.gun ?? 30)
      .input("adet", sql.Int, Math.min(Math.max(f.adet ?? 100, 1), 500)).query(`
      DECLARE @idler TABLE (EMIR_ID int PRIMARY KEY);
      INSERT INTO @idler SELECT TOP (@adet) EMIR_ID FROM dbo.LKY_MOBIL_EMIR
      WHERE (@cari IS NULL OR CARI_KART_ID = @cari) AND (@durum IS NULL OR DURUM = @durum)
        AND (DURUM = 'BEKLIYOR' OR OLUSTURMA_TARIHI >= DATEADD(DAY, -@gun, DATEADD(HOUR, 3, GETUTCDATE())))
      ORDER BY EMIR_ID DESC;
      ${SECIM} WHERE E.EMIR_ID IN (SELECT EMIR_ID FROM @idler) ORDER BY CASE WHEN E.DURUM = 'BEKLIYOR' THEN 0 ELSE 1 END, E.EMIR_ID DESC;
      SELECT S.* FROM dbo.LKY_MOBIL_EMIR_SATIRI S WHERE S.EMIR_ID IN (SELECT EMIR_ID FROM @idler) ORDER BY S.SATIR_ID;`);
    const s = (r as any).recordsets as any[][];
    return (s[0] || []).map((x) => emirOku(x, s[1] || []));
  }

  /** Cari kendi bekleyen emrini iptal eder; durum aynı anda değişmişse false */
  public static async cariIptal(ctx: DbBaglam, emirId: number, cariKartId: number): Promise<boolean> {
    const r = await (await havuz(ctx))
      .request()
      .input("id", sql.Int, emirId)
      .input("cari", sql.Int, cariKartId)
      .query(`UPDATE dbo.LKY_MOBIL_EMIR SET DURUM = 'IPTAL', ISLEM_TARIHI = DATEADD(HOUR, 3, GETUTCDATE())
              OUTPUT inserted.EMIR_ID
              WHERE EMIR_ID = @id AND CARI_KART_ID = @cari AND DURUM = 'BEKLIYOR' AND GECERLILIK_BITIS > DATEADD(HOUR, 3, GETUTCDATE());`);
    return r.recordset.length > 0;
  }

  /** Bekleyen emir sayısı (personel bildirimi) */
  public static async bekleyenSayisi(ctx: DbBaglam): Promise<{ sayi: number; sonEmirId: number | null }> {
    const r = await (await havuz(ctx)).request().query(`
      SELECT COUNT(*) AS N, MAX(EMIR_ID) AS SON FROM dbo.LKY_MOBIL_EMIR WHERE DURUM = 'BEKLIYOR' AND GECERLILIK_BITIS > DATEADD(HOUR, 3, GETUTCDATE());`);
    return { sayi: Number(r.recordset[0].N), sonEmirId: r.recordset[0].SON ?? null };
  }
}
