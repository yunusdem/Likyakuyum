import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { DbContext, EbelgeSqlRepository } from "./ebelgeSql.repository.js";
import { ApiError } from "../utils/ApiError.js";

export type KaynakKimlik = { evrakTuru: number; belgeId: number; belgeTuru: number };
export const kaynakAnahtar = (k: KaynakKimlik) => `${k.evrakTuru}:${k.belgeId}:${k.belgeTuru}`;
export class EbelgeKaynakRepository {
  private static async pool(ctx?: DbContext) {
    const pool = await getDbPool(ctx?.dbServer, ctx?.dbName);
    await EbelgeSqlRepository.ensureTablesExist(pool);
    await pool.request().query(`
      IF OBJECT_ID('dbo.TODVZ_EBELGE_KAYNAK','U') IS NULL
      BEGIN TRY
        CREATE TABLE dbo.TODVZ_EBELGE_KAYNAK (
          ANAHTAR varchar(80) NOT NULL PRIMARY KEY, BELGE_NO varchar(40) NOT NULL,
          DURUM varchar(30) NOT NULL, HATA nvarchar(2000) NULL, TARIH datetime2 NOT NULL DEFAULT SYSDATETIME()
        );
      END TRY BEGIN CATCH IF ERROR_NUMBER() <> 2714 THROW; END CATCH;
      IF OBJECT_ID('dbo.VODVZ_GONDERIME_HAZIR_E_BELGE','V') IS NULL
        THROW 50001, 'Kaynak e-Belge görünümü bu veritabanında bulunamadı.', 1;
    `);
    return pool;
  }
  static async list(f: { arama?: string; durum?: string; belgeTuru?: number; baslangicTarihi?: string; bitisTarihi?: string; sayfa: number }, ctx?: DbContext) {
    const pool = await this.pool(ctx);
    const r = pool.request().input("arama", sql.NVarChar(200), `%${f.arama || ""}%`)
      .input("durum", sql.VarChar(30), f.durum || null).input("tur", sql.Int, f.belgeTuru ?? null)
      .input("ilk", sql.Date, f.baslangicTarihi || null).input("son", sql.Date, f.bitisTarihi || null)
      .input("atla", sql.Int, (f.sayfa - 1) * 50);
    const result = await r.query(`
      SELECT V.EVRAK_TURU evrakTuru,V.BELGE_ID belgeId,V.BELGE_TURU belgeTuru,
        RTRIM(V.BELGE_NO) belgeNo,V.TARIH tarih,RTRIM(V.UNVAN) unvan,V.MIKTAR tutar,
        RTRIM(V.PARA_KODU) paraBirimi,RTRIM(V.ETTN) eskiEttn,V.E_BELGE_DURUMU eskiDurum,
        COALESCE(G.GONDERIM_DURUMU,K.DURUM,
          CASE WHEN NULLIF(RTRIM(V.E_BELGE_HATA_ACIKLAMASI),'') IS NOT NULL THEN 'HATA'
            WHEN ISNULL(V.E_BELGE_DURUMU,0)=0 AND NULLIF(RTRIM(V.ETTN),'') IS NULL THEN 'GONDERILMEDI'
            ELSE 'KONTROL_GEREKLI' END) durum,
        COALESCE(G.ICE_RESPONSE_MESAJ,K.HATA,V.E_BELGE_HATA_ACIKLAMASI) hata,
        G.UUID uuid
      INTO #Kaynak
      FROM dbo.VODVZ_GONDERIME_HAZIR_E_BELGE V
      LEFT JOIN dbo.TODVZ_EBELGE_KAYNAK K ON K.ANAHTAR=CONCAT(V.EVRAK_TURU,':',V.BELGE_ID,':',V.BELGE_TURU)
      OUTER APPLY (SELECT TOP 1 * FROM dbo.TODVZ_EBELGE_GIDEN G
        WHERE G.BELGE_NO=RTRIM(V.BELGE_NO) OR G.UUID=NULLIF(RTRIM(V.ETTN),'')
        ORDER BY G.OLUSTURMA_TARIHI DESC) G
      WHERE V.EVRAK_TURU=0 AND V.BELGE_TURU IN(0,1,2,3)
        AND (@tur IS NULL OR V.BELGE_TURU=@tur)
        AND (@ilk IS NULL OR V.TARIH>=@ilk) AND (@son IS NULL OR V.TARIH<DATEADD(day,1,@son))
        AND (V.BELGE_NO LIKE @arama OR V.UNVAN LIKE @arama);
      SELECT COUNT(*) toplam FROM #Kaynak WHERE @durum IS NULL OR durum=@durum;
      SELECT * FROM #Kaynak WHERE @durum IS NULL OR durum=@durum
        ORDER BY tarih DESC,belgeId DESC,belgeTuru OFFSET @atla ROWS FETCH NEXT 50 ROWS ONLY;
    `);
    return { toplam: (result.recordsets as any)[0][0].toplam, kayitlar: (result.recordsets as any)[1] };
  }
  static async detay(k: KaynakKimlik, ctx?: DbContext) {
    const pool = await this.pool(ctx);
    const res = await pool.request().input("evrak", sql.Int, k.evrakTuru).input("id", sql.Int, k.belgeId).input("tur", sql.Int, k.belgeTuru).query(`
      SELECT V.*,F.VERGI_KIMLIK_NO,F.VERGI_DAIRESI_ADI,F.IL_ADI,F.ILCE_ADI,F.ADRES,
        T.E_FATURA_KDV_MUAFIYET_KODU,T.E_FATURA_KDV_MUAFIYET_ADI
      FROM dbo.VODVZ_GONDERIME_HAZIR_E_BELGE V
      JOIN dbo.VODVZ_SARRAF_FISI F ON F.SARRAF_FISI_ID=V.BELGE_ID
      CROSS JOIN dbo.VODVZ_E_BELGE_TANIMI T
      WHERE V.EVRAK_TURU=@evrak AND V.EVRAK_TURU=0 AND V.BELGE_ID=@id AND V.BELGE_TURU=@tur;
      SELECT SATIR_NO,PARA_ADI,BIRIM_ADI,MIKTAR,TUTAR,KDV_ORANI,KDV
        FROM dbo.VODVZ_E_FATURA_SATIRI WHERE EVRAK_TURU=@evrak AND EVRAK_ID=@id ORDER BY SATIR_NO;
    `);
    const sets = res.recordsets as any;
    if (sets[0].length !== 1) throw ApiError.notFound("Kaynak belge bulunamadı veya tekil değil.");
    return { baslik: sets[0][0], satirlar: sets[1] as any[] };
  }
  static async reserve(k: KaynakKimlik, belgeNo: string, ctx?: DbContext) {
    const pool = await this.pool(ctx);
    try {
      const r = await pool.request().input("key", sql.VarChar(80), kaynakAnahtar(k)).input("no", sql.VarChar(40), belgeNo).query(`
        SET XACT_ABORT ON;
        BEGIN TRANSACTION;
        IF EXISTS(SELECT 1 FROM dbo.TODVZ_EBELGE_KAYNAK WITH(UPDLOCK,HOLDLOCK) WHERE ANAHTAR=@key)
          UPDATE dbo.TODVZ_EBELGE_KAYNAK SET DURUM='GONDERILIYOR',BELGE_NO=@no,HATA=NULL,TARIH=SYSDATETIME() WHERE ANAHTAR=@key AND DURUM='HATA';
        ELSE INSERT dbo.TODVZ_EBELGE_KAYNAK(ANAHTAR,BELGE_NO,DURUM) VALUES(@key,@no,'GONDERILIYOR');
        DECLARE @n int=@@ROWCOUNT;
        COMMIT;
        SELECT @n n;
      `);
      if (r.recordset[0].n !== 1) throw ApiError.conflict("Kaynak belge daha önce işleme alınmış; durumunu kontrol edin.");
    } catch (e: any) {
      if ([2601,2627,1205].includes(e.number)) throw ApiError.conflict("Kaynak belge başka bir işlem tarafından alındı.");
      throw e;
    }
  }
  static async sonuc(k: KaynakKimlik, durum: string, mesaj: string, ctx?: DbContext) {
    const pool = await this.pool(ctx);
    await pool.request().input("key",sql.VarChar(80),kaynakAnahtar(k)).input("durum",sql.VarChar(30),durum)
      .input("mesaj",sql.NVarChar(2000),mesaj.slice(0,2000)).query(`UPDATE dbo.TODVZ_EBELGE_KAYNAK SET DURUM=@durum,HATA=@mesaj,TARIH=SYSDATETIME() WHERE ANAHTAR=@key`);
  }
}
