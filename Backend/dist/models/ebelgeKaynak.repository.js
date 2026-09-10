import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { EbelgeSqlRepository } from "./ebelgeSql.repository.js";
import { ApiError } from "../utils/ApiError.js";
/**
 * e-Döviz fişleri ayrı bir görünümden gelir ve `EVRAK_TURU` taşımaz.
 * Tek bir anahtar şemasında toplamak için bu sabit kullanılır; fatura görünümü
 * yalnızca EVRAK_TURU=0 döndürdüğü için çakışma olmaz.
 */
export const DOVIZ_EVRAK_TURU = 99;
export const dovizMi = (k) => k.evrakTuru === DOVIZ_EVRAK_TURU;
export const kaynakAnahtar = (k) => `${k.evrakTuru}:${k.belgeId}:${k.belgeTuru}`;
export class EbelgeKaynakRepository {
    static async pool(ctx) {
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
      IF OBJECT_ID('dbo.VODVZ_GONDERIME_HAZIR_E_DOVIZ_FISI','V') IS NULL
        THROW 50002, 'Kaynak e-Döviz görünümü bu veritabanında bulunamadı.', 1;
    `);
        return pool;
    }
    static async list(f, ctx) {
        const pool = await this.pool(ctx);
        const r = pool.request().input("arama", sql.NVarChar(200), `%${f.arama || ""}%`)
            .input("durum", sql.VarChar(30), f.durum || null).input("tur", sql.Int, f.belgeTuru ?? null)
            .input("kaynak", sql.VarChar(10), f.kaynak || null)
            .input("ilk", sql.Date, f.baslangicTarihi || null).input("son", sql.Date, f.bitisTarihi || null)
            .input("atla", sql.Int, (f.sayfa - 1) * 50);
        // İki kaynak tek listede birleşir: sarraf/fatura görünümü ve e-Döviz fişi görünümü.
        // e-Döviz'de EVRAK_TURU yoktur; DOVIZ_EVRAK_TURU sabitiyle temsil edilir.
        // İptal edilmiş döviz fişleri hiç listelenmez.
        const result = await r.query(`
      WITH Kaynaklar AS (
        SELECT V.EVRAK_TURU evrakTuru, V.BELGE_ID belgeId, V.BELGE_TURU belgeTuru,
          'FATURA' kaynak, RTRIM(V.BELGE_NO) belgeNo, V.TARIH tarih, RTRIM(V.UNVAN) unvan,
          V.MIKTAR tutar, RTRIM(V.PARA_KODU) paraBirimi, RTRIM(V.ETTN) eskiEttn,
          V.E_BELGE_DURUMU eskiDurum, V.E_BELGE_HATA_ACIKLAMASI eskiHata
        FROM dbo.VODVZ_GONDERIME_HAZIR_E_BELGE V
        WHERE V.EVRAK_TURU=0 AND V.BELGE_TURU IN(0,1,2,3)
        UNION ALL
        SELECT ${DOVIZ_EVRAK_TURU}, D.BELGE_ID, D.FIS_TIPI,
          'DOVIZ', RTRIM(D.BELGE_NO), D.TARIH, RTRIM(D.UNVAN),
          D.MIKTAR, RTRIM(D.PARA_KODU), RTRIM(D.ETTN),
          D.E_BELGE_DURUMU, D.E_BELGE_HATA_ACIKLAMASI
        FROM dbo.VODVZ_GONDERIME_HAZIR_E_DOVIZ_FISI D
        WHERE ISNULL(D.IPTAL,0)=0
      )
      SELECT K.evrakTuru,K.belgeId,K.belgeTuru,K.kaynak,K.belgeNo,K.tarih,K.unvan,K.tutar,K.paraBirimi,
        K.eskiEttn,K.eskiDurum,
        COALESCE(G.GONDERIM_DURUMU,R.DURUM,
          CASE WHEN NULLIF(RTRIM(K.eskiHata),'') IS NOT NULL THEN 'HATA'
            WHEN ISNULL(K.eskiDurum,0)=0 AND NULLIF(K.eskiEttn,'') IS NULL THEN 'GONDERILMEDI'
            ELSE 'KONTROL_GEREKLI' END) durum,
        COALESCE(G.ICE_RESPONSE_MESAJ,R.HATA,K.eskiHata) hata,
        G.UUID uuid
      INTO #Kaynak
      FROM Kaynaklar K
      LEFT JOIN dbo.TODVZ_EBELGE_KAYNAK R ON R.ANAHTAR=CONCAT(K.evrakTuru,':',K.belgeId,':',K.belgeTuru)
      OUTER APPLY (SELECT TOP 1 * FROM dbo.TODVZ_EBELGE_GIDEN G
        WHERE G.BELGE_NO=K.belgeNo OR G.UUID=NULLIF(K.eskiEttn,'')
        ORDER BY G.OLUSTURMA_TARIHI DESC) G
      WHERE (@kaynak IS NULL OR K.kaynak=@kaynak)
        AND (@tur IS NULL OR K.belgeTuru=@tur)
        AND (@ilk IS NULL OR K.tarih>=@ilk) AND (@son IS NULL OR K.tarih<DATEADD(day,1,@son))
        AND (K.belgeNo LIKE @arama OR K.unvan LIKE @arama);
      SELECT COUNT(*) toplam FROM #Kaynak WHERE @durum IS NULL OR durum=@durum;
      SELECT * FROM #Kaynak WHERE @durum IS NULL OR durum=@durum
        ORDER BY tarih DESC,belgeId DESC,belgeTuru OFFSET @atla ROWS FETCH NEXT 50 ROWS ONLY;
    `);
        return { toplam: result.recordsets[0][0].toplam, kayitlar: result.recordsets[1] };
    }
    /**
     * e-Döviz detayı: başlık `VODVZ_GONDERIME_HAZIR_E_DOVIZ_FISI`'nden, belge içeriği
     * `VODVZ_E_DOVIZ_BELGESI_XSLT`'ten okunur (FIS_ID = BELGE_ID ile eşleşir).
     * `VODVZ_E_DOVIZ_BELGESI` görünümü yalnızca UUID taşıdığı için henüz
     * gönderilmemiş fişlerde kullanılamaz; bu yüzden XSLT görünümü kaynak alınır.
     */
    static async dovizDetay(k, ctx) {
        const pool = await this.pool(ctx);
        const res = await pool.request().input("id", sql.Int, k.belgeId).input("tip", sql.Int, k.belgeTuru).query(`
      SELECT TOP 2 D.*, X.*
      FROM dbo.VODVZ_GONDERIME_HAZIR_E_DOVIZ_FISI D
      LEFT JOIN dbo.VODVZ_E_DOVIZ_BELGESI_XSLT X ON X.FIS_ID=D.BELGE_ID
      WHERE D.BELGE_ID=@id AND D.FIS_TIPI=@tip AND ISNULL(D.IPTAL,0)=0;
    `);
        if (res.recordset.length !== 1) {
            throw ApiError.notFound("Kaynak döviz fişi bulunamadı, iptal edilmiş veya tekil değil.");
        }
        return { baslik: res.recordset[0], satirlar: [] };
    }
    static async detay(k, ctx) {
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
        const sets = res.recordsets;
        if (sets[0].length !== 1)
            throw ApiError.notFound("Kaynak belge bulunamadı veya tekil değil.");
        return { baslik: sets[0][0], satirlar: sets[1] };
    }
    static async reserve(k, belgeNo, ctx) {
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
            if (r.recordset[0].n !== 1)
                throw ApiError.conflict("Kaynak belge daha önce işleme alınmış; durumunu kontrol edin.");
        }
        catch (e) {
            if ([2601, 2627, 1205].includes(e.number))
                throw ApiError.conflict("Kaynak belge başka bir işlem tarafından alındı.");
            throw e;
        }
    }
    static async sonuc(k, durum, mesaj, ctx) {
        const pool = await this.pool(ctx);
        await pool.request().input("key", sql.VarChar(80), kaynakAnahtar(k)).input("durum", sql.VarChar(30), durum)
            .input("mesaj", sql.NVarChar(2000), mesaj.slice(0, 2000)).query(`UPDATE dbo.TODVZ_EBELGE_KAYNAK SET DURUM=@durum,HATA=@mesaj,TARIH=SYSDATETIME() WHERE ANAHTAR=@key`);
    }
}
