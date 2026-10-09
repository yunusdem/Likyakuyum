import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { DbContext, EbelgeSqlRepository } from "./ebelgeSql.repository.js";
import { ApiError } from "../utils/ApiError.js";
import { logger } from "../utils/logger.js";
import { PERAKENDE_EVRAK_TURU } from "../services/ebelgePerakende.js";
import { PerakendeSqlRepository } from "./perakendeSql.repository.js";
import { PosEntegrasyonSqlRepository } from "./posEntegrasyonSql.repository.js";

export type KaynakKimlik = { evrakTuru: number; belgeId: number; belgeTuru: number; belgeNo?: string };
/** Perakende fişi (TODVZ_FATURA) — docs/PERAKENDE_EBELGE_YOL_HARITASI.md P11 */
export const perakendeMi = (k: { evrakTuru: number }) => k.evrakTuru === PERAKENDE_EVRAK_TURU;
/**
 * e-Döviz fişleri ayrı bir görünümden gelir ve `EVRAK_TURU` taşımaz.
 * Tek bir anahtar şemasında toplamak için bu sabit kullanılır; fatura görünümü
 * yalnızca EVRAK_TURU=0 döndürdüğü için çakışma olmaz.
 */
export const DOVIZ_EVRAK_TURU = 99;
export const dovizMi = (k: { evrakTuru: number }) => k.evrakTuru === DOVIZ_EVRAK_TURU;
export const kaynakAnahtar = (k: KaynakKimlik) => `${k.evrakTuru}:${k.belgeId}:${k.belgeTuru}${dovizMi(k) && k.belgeNo ? ':' + k.belgeNo.trim() : ''}`;
/** `kaynakAnahtar`'ın tersi: giden kaydındaki KAYNAK_FIS_ID'den kimliği geri kurar. */
export const kaynakKimlikCoz = (anahtar: string): KaynakKimlik | null => {
  const [evrak, id, tur, ...no] = (anahtar || '').split(':');
  const k = { evrakTuru: Number(evrak), belgeId: Number(id), belgeTuru: Number(tur), belgeNo: no.join(':') || undefined };
  return Number.isInteger(k.evrakTuru) && Number.isInteger(k.belgeId) && Number.isInteger(k.belgeTuru) && anahtar?.includes(':') ? k : null;
};
export function kaynakSecim(k: any): { secilebilir: boolean; engel: string | null } {
  let engel: string | null = null;
  if (k.uuid) engel = 'Belge giden kutusunda mevcut. Gönderim durumunu giden kutusundan kontrol edin.';
  // Perakende (P1, P6): iade gönderilmez; VKN'li cariden alışta belgeyi karşı taraf keser; POS onayı bitmeden satış gönderilmez
  else if (k.kaynak === 'PERAKENDE' && k.belgeTuru === 2) engel = 'İade fişi bu ekrandan gönderilmez.';
  else if (k.kaynak === 'PERAKENDE' && k.belgeTuru === 0 && String(k.aliciVkn || '').replace(/\D/g, '').length === 10) engel = 'Gönderilmez: mükellef (VKN\'li) cariden alışta faturayı karşı taraf keser.';
  else if (k.kaynak === 'PERAKENDE' && Number(k.posBekliyor) === 1) engel = 'POS tahsilatı bekleniyor: kart ödemesi cihazda onaylanmadan e-belge gönderilmez.';
  else if (k.kaynak !== 'DOVIZ' && k.kaynak !== 'PERAKENDE' && ![0, 1].includes(k.belgeTuru)) engel = 'Bu belge türünü kendi e-İrsaliye / e-Gider ekranından gönderin.';
  else if (Number(k.eskiDurum || 0) !== 0) engel = `Kaynak sistemde işlem kaydı var (durum ${k.eskiDurum}). ICE durumunu kontrol edin.`;
  else if (k.eskiHata?.trim()) engel = `Kaynak sistem hata açıklaması: ${k.eskiHata.trim()}`;
  else if (k.kaynak !== 'DOVIZ' && k.eskiEttn) engel = 'Kaynak faturada ETTN mevcut. Yeniden göndermeden önce ICE durumunu kontrol edin.';
  else if (!['GONDERILMEDI', 'HATA'].includes(k.durum)) engel = 'Belge daha önce işleme alınmış. Gönderim sonucu doğrulanmalıdır.';
  return { secilebilir: !engel, engel };
}
export class EbelgeKaynakRepository {
  private static async pool(ctx?: DbContext) {
    const pool = await getDbPool(ctx?.dbServer, ctx?.dbName);
    await EbelgeSqlRepository.ensureTablesExist(pool);
    // Liste sorgusu Perakende ve POS tablolarına doğrudan başvurur; henüz hiç kullanılmamış veritabanında da var olsunlar
    await PerakendeSqlRepository.ensureTablesAndProcedures(pool);
    await PosEntegrasyonSqlRepository.ensureTables(pool);
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
  static async list(f: { arama?: string; durum?: string; belgeTuru?: number; kaynak?: "FATURA" | "IRSALIYE" | "GIDER" | "DOVIZ" | "PERAKENDE_SATIS" | "PERAKENDE_ALIS"; baslangicTarihi?: string; bitisTarihi?: string; sayfa: number }, ctx?: DbContext) {
    const pool = await this.pool(ctx);
    const r = pool.request().input("arama", sql.NVarChar(200), `%${f.arama || ""}%`)
      .input("durum", sql.VarChar(30), f.durum || null).input("tur", sql.Int, f.belgeTuru ?? null)
      .input("kaynak", sql.VarChar(20), f.kaynak || null)
      .input("ilk", sql.Date, f.baslangicTarihi || null).input("son", sql.Date, f.bitisTarihi || null)
      .input("atla", sql.Int, (f.sayfa - 1) * 50);
    // İki kaynak tek listede birleşir: sarraf/fatura görünümü ve e-Döviz fişi görünümü.
    // e-Döviz'de EVRAK_TURU yoktur; DOVIZ_EVRAK_TURU sabitiyle temsil edilir.
    // İptal edilmiş döviz fişleri hiç listelenmez.
    const result = await r.query(`
      WITH Kaynaklar AS (
        SELECT V.EVRAK_TURU evrakTuru, V.BELGE_ID belgeId, V.BELGE_TURU belgeTuru,
          CAST('FATURA' AS varchar(20)) kaynak, RTRIM(V.BELGE_NO) belgeNo, V.TARIH tarih, RTRIM(V.UNVAN) unvan,
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
        K.eskiEttn,K.eskiDurum,K.eskiHata,
        -- Gönderim kuyruğu görünmez (docs/EBELGE_KUYRUK_YOL_HARITASI.md): sonucu beklenen belge "Gönderildi"
        COALESCE(CASE WHEN G.GONDERIM_DURUMU IN ('KUYRUKTA','GONDERILIYOR','BELIRSIZ','ONAYLANIYOR') THEN 'GONDERILDI' ELSE G.GONDERIM_DURUMU END,R.DURUM,
          CASE WHEN NULLIF(RTRIM(K.eskiHata),'') IS NOT NULL THEN 'HATA'
            WHEN ISNULL(K.eskiDurum,0)=0 AND (K.kaynak='DOVIZ' OR NULLIF(K.eskiEttn,'') IS NULL) THEN 'GONDERILMEDI'
            ELSE 'KONTROL_GEREKLI' END) durum,
        CASE WHEN G.GONDERIM_DURUMU IN ('KUYRUKTA','GONDERILIYOR','BELIRSIZ','ONAYLANIYOR') THEN NULL ELSE COALESCE(G.ICE_RESPONSE_MESAJ,R.HATA,K.eskiHata) END hata,
        G.UUID uuid,
        CAST(NULL AS varchar(20)) aliciVkn, CAST(0 AS int) posBekliyor
      INTO #Kaynak
      FROM Kaynaklar K
      OUTER APPLY (SELECT TOP 1 R.* FROM dbo.TODVZ_EBELGE_KAYNAK R
        WHERE R.ANAHTAR=CONCAT(K.evrakTuru,':',K.belgeId,':',K.belgeTuru)
          OR (K.kaynak='DOVIZ' AND R.ANAHTAR=CONCAT(K.evrakTuru,':',K.belgeId,':',K.belgeTuru,':',K.belgeNo))
        ORDER BY CASE WHEN R.DURUM='HATA' THEN 1 ELSE 0 END,R.TARIH DESC) R
      OUTER APPLY (SELECT TOP 1 * FROM dbo.TODVZ_EBELGE_GIDEN G
        -- ICE, reddettiği belgenin numarasını da kaydeder ("bu tarihte zaten
        -- oluşturulmuş"); HATA dahil her giden kaydı numarayı kilitler. Düzeltme
        -- yeni numaralı fişle yapılır.
        WHERE G.BELGE_NO=K.belgeNo OR G.UUID=NULLIF(K.eskiEttn,'')
        ORDER BY G.OLUSTURMA_TARIHI DESC) G
      WHERE (@kaynak IS NULL OR (@kaynak='DOVIZ' AND K.kaynak='DOVIZ')
        OR (@kaynak='FATURA' AND K.kaynak='FATURA' AND K.belgeTuru IN(0,1))
        OR (@kaynak='IRSALIYE' AND K.kaynak='FATURA' AND K.belgeTuru=2)
        OR (@kaynak='GIDER' AND K.kaynak='FATURA' AND K.belgeTuru=3))
        AND (@tur IS NULL OR K.belgeTuru=@tur)
        AND (@ilk IS NULL OR K.tarih>=@ilk) AND (@son IS NULL OR K.tarih<DATEADD(day,1,@son))
        AND (K.belgeNo LIKE @arama OR K.unvan LIKE @arama);

      -- Perakende fişleri (docs/PERAKENDE_EBELGE_YOL_HARITASI.md): evrakTuru 98, belgeTuru = fiş tipi (0 alış, 1 satış, 2 iade).
      -- Durum yalnız bizim kayıtlarımızdan (giden kutusu / kaynak kaydı) gelir; eskiDurum 0 sayılır.
      -- posBekliyor (P6): fişin POS işlemi varken bekleyen / belirsiz işlem var ya da onaylı tutar POS satır toplamını karşılamıyor.
      IF (@kaynak IS NULL OR @kaynak IN ('PERAKENDE_SATIS','PERAKENDE_ALIS'))
      INSERT INTO #Kaynak (evrakTuru,belgeId,belgeTuru,kaynak,belgeNo,tarih,unvan,tutar,paraBirimi,eskiEttn,eskiDurum,eskiHata,durum,hata,uuid,aliciVkn,posBekliyor)
      SELECT ${PERAKENDE_EVRAK_TURU}, F.FATURA_ID, F.FATURA_TIPI, 'PERAKENDE', RTRIM(F.FATURA_NO), F.TARIH, RTRIM(F.ALICI_UNVAN),
        F.GENEL_TOPLAM, CASE WHEN ISNULL(RTRIM(PB.KOD),'TL') IN ('TL','TRY') THEN 'TRY' ELSE RTRIM(PB.KOD) END, NULL, 0, NULL,
        COALESCE(CASE WHEN G.GONDERIM_DURUMU IN ('KUYRUKTA','GONDERILIYOR','BELIRSIZ','ONAYLANIYOR') THEN 'GONDERILDI' ELSE G.GONDERIM_DURUMU END, R.DURUM, 'GONDERILMEDI'),
        CASE WHEN G.GONDERIM_DURUMU IN ('KUYRUKTA','GONDERILIYOR','BELIRSIZ','ONAYLANIYOR') THEN NULL ELSE COALESCE(G.ICE_RESPONSE_MESAJ,R.HATA) END,
        G.UUID, RTRIM(F.ALICI_VKN_TCKN),
        CASE WHEN EXISTS (SELECT 1 FROM dbo.TODVZ_POS_ISLEM I WHERE I.BELGE_TURU='perakende' AND I.BELGE_ID=F.FATURA_ID)
          AND (EXISTS (SELECT 1 FROM dbo.TODVZ_POS_ISLEM I WHERE I.BELGE_TURU='perakende' AND I.BELGE_ID=F.FATURA_ID AND I.DURUM IN ('BEKLIYOR','BELIRSIZ'))
            OR ISNULL((SELECT SUM(O.TUTAR) FROM dbo.TODVZ_FATURA_ODEME O WHERE O.FATURA_ID=F.FATURA_ID AND O.ODEME_ARACI_TURU=2),0)
             > ISNULL((SELECT SUM(I.TUTAR) FROM dbo.TODVZ_POS_ISLEM I WHERE I.BELGE_TURU='perakende' AND I.BELGE_ID=F.FATURA_ID AND I.DURUM='ONAY' AND I.IADE_DURUMU=0),0) + 0.005)
          THEN 1 ELSE 0 END
      FROM dbo.TODVZ_FATURA F
      LEFT JOIN dbo.TODVZ_PARA PB ON PB.PARA_ID=F.PARA_ID
      OUTER APPLY (SELECT TOP 1 R.* FROM dbo.TODVZ_EBELGE_KAYNAK R WHERE R.ANAHTAR=CONCAT('${PERAKENDE_EVRAK_TURU}:',F.FATURA_ID,':',F.FATURA_TIPI)
        ORDER BY CASE WHEN R.DURUM='HATA' THEN 1 ELSE 0 END,R.TARIH DESC) R
      OUTER APPLY (SELECT TOP 1 * FROM dbo.TODVZ_EBELGE_GIDEN G WHERE G.BELGE_NO=RTRIM(F.FATURA_NO) OR G.UUID=CAST(F.ETTN AS varchar(40))
        ORDER BY G.OLUSTURMA_TARIHI DESC) G
      WHERE (@kaynak IS NULL OR (@kaynak='PERAKENDE_SATIS' AND F.FATURA_TIPI<>0) OR (@kaynak='PERAKENDE_ALIS' AND F.FATURA_TIPI=0))
        AND (@tur IS NULL OR F.FATURA_TIPI=@tur)
        AND (@ilk IS NULL OR F.TARIH>=@ilk) AND (@son IS NULL OR F.TARIH<DATEADD(day,1,@son))
        AND (F.FATURA_NO LIKE @arama OR F.ALICI_UNVAN LIKE @arama);
      -- Ekranda tek 'Hatalı' filtresi vardır: gönderilmiş ve gönderilmemiş dışındaki her durum
      -- (KONTROL_GEREKLI, BELIRSIZ, GONDERILIYOR…) onun altında listelenir. Bkz. docs/ebelge-revizyon.md K6
      SELECT COUNT(*) toplam FROM #Kaynak WHERE (@durum IS NULL OR durum=@durum OR (@durum='HATA' AND durum NOT IN('GONDERILDI','GONDERILMEDI')));
      SELECT * FROM #Kaynak WHERE (@durum IS NULL OR durum=@durum OR (@durum='HATA' AND durum NOT IN('GONDERILDI','GONDERILMEDI')))
        ORDER BY tarih DESC,evrakTuru,belgeId DESC,belgeTuru,belgeNo OFFSET @atla ROWS FETCH NEXT 50 ROWS ONLY;
    `);
    return { toplam: (result.recordsets as any)[0][0].toplam, kayitlar: (result.recordsets as any)[1].map((k: any) => ({ ...k, ...kaynakSecim(k) })) };
  }
  /**
   * e-Döviz detayı: başlık `VODVZ_GONDERIME_HAZIR_E_DOVIZ_FISI`'nden, belge içeriği
   * `VODVZ_E_DOVIZ_BELGESI_XSLT`'ten okunur (FIS_ID = BELGE_ID ile eşleşir).
   * `VODVZ_E_DOVIZ_BELGESI` görünümü yalnızca UUID taşıdığı için henüz
   * gönderilmemiş fişlerde kullanılamaz; bu yüzden XSLT görünümü kaynak alınır.
   */
  static async dovizDetay(k: KaynakKimlik, ctx?: DbContext) {
    const pool = await this.pool(ctx);
    const res = await pool.request().input("id", sql.Int, k.belgeId).input("tip", sql.Int, k.belgeTuru)
      .input("no", sql.VarChar(40), k.belgeNo?.trim() || null).query(`
      -- ICE, Ek_Bilgiler.Istatistik_No'yu belge türüyle doğrular; kod fişin istatistik tanımından gelir.
      SELECT TOP 2 D.*, RTRIM(I.KOD) AS ISTATISTIK_KOD, I.FIS_TIPI AS ISTATISTIK_FIS_TIPI
      FROM dbo.VODVZ_GONDERIME_HAZIR_E_DOVIZ_FISI D
      LEFT JOIN dbo.TODVZ_FIS F ON F.FIS_ID=D.BELGE_ID
      LEFT JOIN dbo.TODVZ_ISTATISTIK I ON I.ISTATISTIK_ID=F.ISTATISTIK_ID
      WHERE D.BELGE_ID=@id AND D.FIS_TIPI=@tip AND ISNULL(D.IPTAL,0)=0 AND (@no IS NULL OR RTRIM(D.BELGE_NO)=@no);
      SELECT TOP 2 X.* FROM dbo.VODVZ_E_DOVIZ_BELGESI_XSLT X
      JOIN dbo.VODVZ_GONDERIME_HAZIR_E_DOVIZ_FISI D ON X.FIS_ID=D.BELGE_ID AND RTRIM(X.ID)=RTRIM(D.BELGE_NO)
        AND (NULLIF(RTRIM(D.ETTN),'') IS NULL OR X.UUID=D.ETTN)
      WHERE D.BELGE_ID=@id AND D.FIS_TIPI=@tip AND ISNULL(D.IPTAL,0)=0 AND (@no IS NULL OR RTRIM(D.BELGE_NO)=@no);
    `);
    const sets = res.recordsets as any;
    if (sets[0].length !== 1) {
      throw ApiError.notFound("Kaynak döviz fişi bulunamadı, iptal edilmiş veya tekil değil.");
    }
    if (sets[1].length !== 1) throw ApiError.conflict('Döviz belgesinin ayrıntıları tekil olarak okunamadı. Fişin belge numarası ve ETTN alanlarını kontrol edin.');
    return { baslik: { ...sets[1][0], ...sets[0][0] }, satirlar: [] as any[] };
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
  /** Perakende fişi başlık + satırlar; firma e-Belge tanımındaki KDV muafiyet kodu Sarraf'taki gibi başlığa eklenir (P2). */
  static async perakendeDetay(k: KaynakKimlik, ctx?: DbContext) {
    const pool = await this.pool(ctx);
    const res = await pool.request().input("id", sql.Int, k.belgeId).input("tip", sql.Int, k.belgeTuru).query(`
      SELECT F.*, RTRIM(PB.KOD) AS PARA_KODU, T.E_FATURA_KDV_MUAFIYET_KODU, T.E_FATURA_KDV_MUAFIYET_ADI
      FROM dbo.TODVZ_FATURA F
      LEFT JOIN dbo.TODVZ_PARA PB ON PB.PARA_ID=F.PARA_ID
      OUTER APPLY (SELECT TOP 1 E_FATURA_KDV_MUAFIYET_KODU, E_FATURA_KDV_MUAFIYET_ADI FROM dbo.VODVZ_E_BELGE_TANIMI) T
      WHERE F.FATURA_ID=@id AND F.FATURA_TIPI=@tip;
      SELECT * FROM dbo.TODVZ_FATURA_SATIRI WHERE FATURA_ID=@id ORDER BY SATIR_NO, FATURA_SATIR_ID;
    `);
    const sets = res.recordsets as any;
    if (sets[0].length !== 1) throw ApiError.notFound("Perakende fişi bulunamadı.");
    return { baslik: sets[0][0], satirlar: sets[1] as any[] };
  }
  static async reserve(k: KaynakKimlik, belgeNo: string, ctx?: DbContext) {
    const pool = await this.pool(ctx);
    try {
      const r = await pool.request().input("key", sql.VarChar(80), kaynakAnahtar(k)).input("no", sql.VarChar(40), belgeNo).query(`
        SET XACT_ABORT ON;
        BEGIN TRANSACTION;
        IF @key LIKE '99:%' AND EXISTS(SELECT 1 FROM dbo.TODVZ_EBELGE_KAYNAK WITH(UPDLOCK,HOLDLOCK)
          WHERE ANAHTAR=LEFT(@key,LEN(@key)-CHARINDEX(':',REVERSE(@key))) AND DURUM<>'HATA')
        BEGIN ROLLBACK; THROW 50003, 'Fiş daha önce işleme alınmış; giden kutusunu kontrol edin.', 1; END;
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
    // Perakende fişine geri yazılır (P5): 1 = Gönderildi, diğerlerinde 0. GIB_STATU_KODU'na yazılmaz: canlı veritabanında
    // kolonun tipi farklı olabiliyor (metin yazınca "Conversion failed" verdi, 10.10.2026). Belge ICE'ye gitmiş olabilir;
    // fişe geri yazamamak gönderimi hatalı göstermemeli.
    if (perakendeMi(k)) {
      try {
        await pool.request().input("id", sql.Int, k.belgeId).input("durum", sql.VarChar(30), durum)
          .query(`UPDATE dbo.TODVZ_FATURA SET E_BELGE_DURUMU = CASE WHEN @durum='GONDERILDI' THEN 1 ELSE 0 END WHERE FATURA_ID=@id`);
      } catch (err: any) {
        logger.warn(`[e-Belge] Perakende fişine durum yazılamadı (${k.belgeId}): ${err?.message}`);
      }
    }
  }
}
