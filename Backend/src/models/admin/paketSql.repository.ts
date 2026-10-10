import sql from "mssql";
import { getAdminPool } from "../../config/adminDb.config.js";
import { urunleriOku, urunleriYaz } from "../../services/admin/paketHesap.js";

/**
 * ADM_PAKET, ADM_PAKET_MODUL, ADM_LISANS.URUNLER, ADM_FIRMA_MODUL_ISTISNA (docs/sql/LIKYA_ADMIN_URUN_PAKET.sql).
 * Betik sunucuda çalıştırılmamışsa bu tablolar yoktur: okuma uçları "ürünsüz" döner, mevcut akış bozulmaz.
 */

export interface PaketSatiri {
  paketKodu: string;
  ad: string;
  sira: number;
  cekirdek: boolean;
  hepsi: boolean;
  ilkIcerik: boolean;
  guncellemeTarihi: Date | null;
  guncelleyen: string | null;
  moduller: string[];
}

export interface FirmaUrunSatiri {
  firmaId: number;
  firmaKodu: string;
  unvan: string;
  baglantiModu: string;
  lisansId: number;
  urunler: string[];
}

let semaVar = false;
let sonDenetim = 0;

export class PaketSqlRepository {
  /** Şema kurulu mu? Kurulduktan sonra bir daha sorulmaz; kurulu değilse dakikada bir yeniden bakılır. */
  public static async semaVarMi(): Promise<boolean> {
    if (semaVar) return true;
    if (Date.now() - sonDenetim < 60_000) return false;
    sonDenetim = Date.now();
    const pool = await getAdminPool();
    const r = (
      await pool.request().query(`
        SELECT CAST(CASE WHEN COL_LENGTH('dbo.ADM_LISANS', 'URUNLER') IS NOT NULL
                          AND OBJECT_ID('dbo.ADM_PAKET') IS NOT NULL AND OBJECT_ID('dbo.ADM_PAKET_MODUL') IS NOT NULL
                          AND OBJECT_ID('dbo.ADM_FIRMA_MODUL_ISTISNA') IS NOT NULL THEN 1 ELSE 0 END AS BIT) AS V`)
    ).recordset[0];
    semaVar = !!r.V;
    return semaVar;
  }

  /** Testler için */
  public static semaBilgisiniSifirla(): void {
    semaVar = false;
    sonDenetim = 0;
  }

  /** Lisans sorgularına eklenecek URUNLER kolonu; şema yoksa sabit NULL. */
  public static async urunKolonu(takmaAd = ""): Promise<string> {
    const on = takmaAd ? `${takmaAd}.` : "";
    return (await this.semaVarMi()) ? `${on}URUNLER` : "CAST(NULL AS VARCHAR(200)) AS URUNLER";
  }

  public static async paketler(): Promise<PaketSatiri[]> {
    const pool = await getAdminPool();
    const res = await pool.request().query(`
      SELECT p.PAKET_KODU, p.AD, p.SIRA, p.CEKIRDEK, p.HEPSI, p.ILK_ICERIK, p.GUNCELLEME_TARIHI, a.KULLANICI_ADI AS GUNCELLEYEN
      FROM dbo.ADM_PAKET p LEFT JOIN dbo.ADM_ADMIN a ON a.ADMIN_ID = p.GUNCELLEYEN_ADMIN_ID
      ORDER BY p.SIRA, p.PAKET_KODU;
      SELECT PAKET_KODU, MODUL_KODU FROM dbo.ADM_PAKET_MODUL;
    `);
    const [paketler, moduller] = res.recordsets as any[];
    const harita = new Map<string, string[]>();
    for (const r of moduller) harita.set(r.PAKET_KODU, [...(harita.get(r.PAKET_KODU) || []), r.MODUL_KODU]);
    return paketler.map((r: any) => ({
      paketKodu: r.PAKET_KODU,
      ad: r.AD,
      sira: r.SIRA,
      cekirdek: !!r.CEKIRDEK,
      hepsi: !!r.HEPSI,
      ilkIcerik: !!r.ILK_ICERIK,
      guncellemeTarihi: r.GUNCELLEME_TARIHI ?? null,
      guncelleyen: r.GUNCELLEYEN ?? null,
      moduller: harita.get(r.PAKET_KODU) || [],
    }));
  }

  /** Paketin modül listesini tümüyle değiştirir. ilkIcerik=true: yalnız henüz doldurulmamış pakete yazar. */
  public static async paketIcerikYaz(paketKodu: string, moduller: string[], adminId: number | null, ilkIcerik = false): Promise<boolean> {
    const kodlar = [...new Set(moduller)];
    const pool = await getAdminPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      const p = (
        await new sql.Request(tx)
          .input("kod", sql.VarChar(20), paketKodu)
          .query(`SELECT ILK_ICERIK, HEPSI FROM dbo.ADM_PAKET WITH (UPDLOCK, HOLDLOCK) WHERE PAKET_KODU = @kod`)
      ).recordset[0];
      if (!p || p.HEPSI || (ilkIcerik && p.ILK_ICERIK)) {
        await tx.rollback();
        return false;
      }
      await new sql.Request(tx).input("kod", sql.VarChar(20), paketKodu).query(`DELETE FROM dbo.ADM_PAKET_MODUL WHERE PAKET_KODU = @kod`);
      // İstek başına 2100 parametre sınırı: 500'lük dilimler
      for (let i = 0; i < kodlar.length; i += 500) {
        const dilim = kodlar.slice(i, i + 500);
        const req = new sql.Request(tx).input("kod", sql.VarChar(20), paketKodu);
        dilim.forEach((m, j) => req.input(`m${j}`, sql.VarChar(100), m));
        await req.query(`INSERT INTO dbo.ADM_PAKET_MODUL (PAKET_KODU, MODUL_KODU) VALUES ${dilim.map((_, j) => `(@kod, @m${j})`).join(", ")}`);
      }
      await new sql.Request(tx)
        .input("kod", sql.VarChar(20), paketKodu)
        .input("adminId", sql.Int, adminId)
        .query(`UPDATE dbo.ADM_PAKET SET ILK_ICERIK = 1, GUNCELLEYEN_ADMIN_ID = @adminId, GUNCELLEME_TARIHI = GETDATE() WHERE PAKET_KODU = @kod`);
      await tx.commit();
      return true;
    } catch (err) {
      await tx.rollback().catch(() => undefined);
      throw err;
    }
  }

  /** Firmanın aktif lisansındaki ürünler. Şema yoksa / lisans yoksa / ürün seçilmemişse boş dizi. */
  public static async firmaUrunleri(firmaId: number): Promise<string[]> {
    if (!(await this.semaVarMi())) return [];
    const pool = await getAdminPool();
    const r = (
      await pool.request().input("id", sql.Int, firmaId).query(`SELECT URUNLER FROM dbo.ADM_LISANS WHERE FIRMA_ID = @id AND AKTIF = 1`)
    ).recordset[0];
    return urunleriOku(r?.URUNLER);
  }

  /** Aktif lisansında ürün seçili tüm firmalar. */
  public static async urunluFirmalar(): Promise<FirmaUrunSatiri[]> {
    if (!(await this.semaVarMi())) return [];
    const pool = await getAdminPool();
    const res = await pool.request().query(`
      SELECT f.FIRMA_ID, f.FIRMA_KODU, f.UNVAN, f.BAGLANTI_MODU, l.LISANS_ID, l.URUNLER
      FROM dbo.ADM_LISANS l INNER JOIN dbo.ADM_FIRMA f ON f.FIRMA_ID = l.FIRMA_ID
      WHERE l.AKTIF = 1 AND l.URUNLER IS NOT NULL AND l.URUNLER <> '' AND f.DURUM <> 'SILINDI'
    `);
    return res.recordset.map((r: any) => ({
      firmaId: r.FIRMA_ID,
      firmaKodu: r.FIRMA_KODU,
      unvan: r.UNVAN,
      baglantiModu: r.BAGLANTI_MODU,
      lisansId: r.LISANS_ID,
      urunler: urunleriOku(r.URUNLER),
    }));
  }

  public static async lisansUrunleriniYaz(lisansId: number, urunler: string[]): Promise<void> {
    const pool = await getAdminPool();
    await pool
      .request()
      .input("id", sql.Int, lisansId)
      .input("urunler", sql.VarChar(200), urunleriYaz(urunler))
      .query(`UPDATE dbo.ADM_LISANS SET URUNLER = @urunler WHERE LISANS_ID = @id`);
  }

  public static async istisnalar(firmaId: number): Promise<{ ek: string[]; cikar: string[] }> {
    if (!(await this.semaVarMi())) return { ek: [], cikar: [] };
    const pool = await getAdminPool();
    const res = await pool
      .request()
      .input("id", sql.Int, firmaId)
      .query(`SELECT MODUL_KODU, TUR FROM dbo.ADM_FIRMA_MODUL_ISTISNA WHERE FIRMA_ID = @id`);
    return {
      ek: res.recordset.filter((r: any) => r.TUR === "EK").map((r: any) => r.MODUL_KODU),
      cikar: res.recordset.filter((r: any) => r.TUR === "CIKAR").map((r: any) => r.MODUL_KODU),
    };
  }

  /** Firmanın istisnalarını tümüyle değiştirir (boş listeler = istisna yok). */
  public static async istisnalariYaz(firmaId: number, ek: string[], cikar: string[], adminId: number | null): Promise<void> {
    const satirlar: [string, string][] = [...new Set(ek)].map((k) => [k, "EK"]);
    const ekKume = new Set(ek);
    for (const k of new Set(cikar)) if (!ekKume.has(k)) satirlar.push([k, "CIKAR"]);

    const pool = await getAdminPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      await new sql.Request(tx).input("id", sql.Int, firmaId).query(`DELETE FROM dbo.ADM_FIRMA_MODUL_ISTISNA WHERE FIRMA_ID = @id`);
      for (let i = 0; i < satirlar.length; i += 500) {
        const dilim = satirlar.slice(i, i + 500);
        const req = new sql.Request(tx).input("id", sql.Int, firmaId).input("adminId", sql.Int, adminId);
        dilim.forEach(([k, t], j) => req.input(`k${j}`, sql.VarChar(100), k).input(`t${j}`, sql.VarChar(5), t));
        await req.query(
          `INSERT INTO dbo.ADM_FIRMA_MODUL_ISTISNA (FIRMA_ID, MODUL_KODU, TUR, ADMIN_ID) VALUES ${dilim
            .map((_, j) => `(@id, @k${j}, @t${j}, @adminId)`)
            .join(", ")}`
        );
      }
      await tx.commit();
    } catch (err) {
      await tx.rollback().catch(() => undefined);
      throw err;
    }
  }
}
