import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { EbelgeSqlRepository } from "./ebelgeSql.repository.js";
import { ApiError } from "../utils/ApiError.js";
import { logger } from "../utils/logger.js";
import { PERAKENDE_EVRAK_TURU } from "../services/ebelgePerakende.js";
import { PerakendeSqlRepository } from "./perakendeSql.repository.js";
import { PosEntegrasyonSqlRepository } from "./posEntegrasyonSql.repository.js";
/** Perakende fişi (TODVZ_FATURA) — docs/PERAKENDE_EBELGE_YOL_HARITASI.md P11 */
export const perakendeMi = (k) => k.evrakTuru === PERAKENDE_EVRAK_TURU;
/** Sarraf fişi (TODVZ_SARRAF_FISI); eski anahtarlarla uyum için evrakTuru 0 kalır (e-Banka mutabakatı da 0 kullanır) */
export const sarrafMi = (k) => k.evrakTuru === 0;
/**
 * e-Döviz fişleri ayrı bir görünümden gelir ve `EVRAK_TURU` taşımaz.
 * Tek bir anahtar şemasında toplamak için bu sabit kullanılır; fatura görünümü
 * yalnızca EVRAK_TURU=0 döndürdüğü için çakışma olmaz.
 */
export const DOVIZ_EVRAK_TURU = 99;
export const dovizMi = (k) => k.evrakTuru === DOVIZ_EVRAK_TURU;
export const kaynakAnahtar = (k) => `${k.evrakTuru}:${k.belgeId}:${k.belgeTuru}${dovizMi(k) && k.belgeNo ? ':' + k.belgeNo.trim() : ''}`;
/** `kaynakAnahtar`'ın tersi: giden kaydındaki KAYNAK_FIS_ID'den kimliği geri kurar. */
export const kaynakKimlikCoz = (anahtar) => {
    const [evrak, id, tur, ...no] = (anahtar || '').split(':');
    const k = { evrakTuru: Number(evrak), belgeId: Number(id), belgeTuru: Number(tur), belgeNo: no.join(':') || undefined };
    return Number.isInteger(k.evrakTuru) && Number.isInteger(k.belgeId) && Number.isInteger(k.belgeTuru) && anahtar?.includes(':') ? k : null;
};
export function kaynakSecim(k) {
    let engel = null;
    if (k.uuid)
        engel = 'Belge giden kutusunda mevcut. Gönderim durumunu giden kutusundan kontrol edin.';
    // Perakende (P1, P6): iade gönderilmez; VKN'li cariden alışta belgeyi karşı taraf keser; POS onayı bitmeden satış gönderilmez
    else if (k.kaynak === 'PERAKENDE' && k.belgeTuru === 2)
        engel = 'İade fişi bu ekrandan gönderilmez.';
    else if (k.kaynak === 'PERAKENDE' && k.belgeTuru === 0 && String(k.aliciVkn || '').replace(/\D/g, '').length === 10)
        engel = 'Gönderilmez: mükellef (VKN\'li) cariden alışta faturayı karşı taraf keser.';
    // Sarraf (evrakTuru 0; belgeTuru 1 satış, 2 e-İrsaliye seçili satış, 3 alış → e-Gider): Perakende ile aynı kurallar
    else if (k.kaynak === 'SARRAF' && k.belgeTuru === 2)
        engel = 'Fişte belge türü e-İrsaliye seçili; e-İrsaliye ekranından gönderin.';
    else if (k.kaynak === 'SARRAF' && k.belgeTuru === 3 && String(k.aliciVkn || '').replace(/\D/g, '').length === 10)
        engel = 'Gönderilmez: mükellef (VKN\'li) kişiden alışta faturayı karşı taraf keser.';
    else if ((k.kaynak === 'PERAKENDE' || k.kaynak === 'SARRAF') && Number(k.posBekliyor) === 1)
        engel = 'POS tahsilatı bekleniyor: kart ödemesi cihazda onaylanmadan e-belge gönderilmez.';
    else if (k.kaynak !== 'DOVIZ' && k.kaynak !== 'PERAKENDE' && k.kaynak !== 'SARRAF' && ![0, 1].includes(k.belgeTuru))
        engel = 'Bu belge türünü kendi e-İrsaliye / e-Gider ekranından gönderin.';
    else if (Number(k.eskiDurum || 0) !== 0)
        engel = `Kaynak sistemde işlem kaydı var (durum ${k.eskiDurum}). ICE durumunu kontrol edin.`;
    else if (k.eskiHata?.trim())
        engel = `Kaynak sistem hata açıklaması: ${k.eskiHata.trim()}`;
    else if (k.kaynak !== 'DOVIZ' && k.eskiEttn)
        engel = 'Kaynak faturada ETTN mevcut. Yeniden göndermeden önce ICE durumunu kontrol edin.';
    else if (!['GONDERILMEDI', 'HATA'].includes(k.durum))
        engel = 'Belge daha önce işleme alınmış. Gönderim sonucu doğrulanmalıdır.';
    return { secilebilir: !engel, engel };
}
export class EbelgeKaynakRepository {
    static async pool(ctx) {
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
      IF OBJECT_ID('dbo.VODVZ_SARRAF_FISI','V') IS NULL
        THROW 50001, 'Sarraf fişi görünümü (VODVZ_SARRAF_FISI) bu veritabanında bulunamadı.', 1;
      IF OBJECT_ID('dbo.VODVZ_GONDERIME_HAZIR_E_DOVIZ_FISI','V') IS NULL
        THROW 50002, 'Kaynak e-Döviz görünümü bu veritabanında bulunamadı.', 1;
    `);
        return pool;
    }
    static async list(f, ctx) {
        const pool = await this.pool(ctx);
        const r = pool.request().input("arama", sql.NVarChar(200), `%${f.arama || ""}%`)
            .input("durum", sql.VarChar(30), f.durum || null).input("tur", sql.Int, f.belgeTuru ?? null)
            .input("kaynak", sql.VarChar(20), f.kaynak || null)
            .input("ilk", sql.Date, f.baslangicTarihi || null).input("son", sql.Date, f.bitisTarihi || null)
            .input("atla", sql.Int, (f.sayfa - 1) * 50);
        // e-Döviz fişleri görünümden gelir (EVRAK_TURU yoktur; DOVIZ_EVRAK_TURU sabitiyle temsil edilir).
        // İptal edilmiş döviz fişleri hiç listelenmez. Sarraf ve Perakende fişleri aşağıda doğrudan tablolarından eklenir.
        const result = await r.query(`
      SELECT ${DOVIZ_EVRAK_TURU} evrakTuru, D.BELGE_ID belgeId, D.FIS_TIPI belgeTuru,
        CAST('DOVIZ' AS varchar(20)) kaynak, CAST(RTRIM(D.BELGE_NO) AS varchar(40)) belgeNo, D.TARIH tarih, CAST(RTRIM(D.UNVAN) AS nvarchar(300)) unvan,
        CAST(D.MIKTAR AS decimal(19,4)) tutar, CAST(RTRIM(D.PARA_KODU) AS varchar(10)) paraBirimi, CAST(RTRIM(D.ETTN) AS varchar(40)) eskiEttn,
        CAST(D.E_BELGE_DURUMU AS int) eskiDurum, CAST(D.E_BELGE_HATA_ACIKLAMASI AS nvarchar(2000)) eskiHata,
        -- Gönderim kuyruğu görünmez (docs/EBELGE_KUYRUK_YOL_HARITASI.md): sonucu beklenen belge "Gönderildi"
        COALESCE(CASE WHEN G.GONDERIM_DURUMU IN ('KUYRUKTA','GONDERILIYOR','BELIRSIZ','ONAYLANIYOR') THEN 'GONDERILDI' ELSE G.GONDERIM_DURUMU END,R.DURUM,
          CASE WHEN NULLIF(RTRIM(D.E_BELGE_HATA_ACIKLAMASI),'') IS NOT NULL THEN 'HATA'
            WHEN ISNULL(D.E_BELGE_DURUMU,0)=0 THEN 'GONDERILMEDI'
            ELSE 'KONTROL_GEREKLI' END) durum,
        CASE WHEN G.GONDERIM_DURUMU IN ('KUYRUKTA','GONDERILIYOR','BELIRSIZ','ONAYLANIYOR') THEN NULL ELSE COALESCE(G.ICE_RESPONSE_MESAJ,R.HATA,D.E_BELGE_HATA_ACIKLAMASI) END hata,
        G.UUID uuid,
        CAST(NULL AS varchar(20)) aliciVkn, CAST(0 AS int) posBekliyor
      INTO #Kaynak
      FROM dbo.VODVZ_GONDERIME_HAZIR_E_DOVIZ_FISI D
      OUTER APPLY (SELECT TOP 1 R.* FROM dbo.TODVZ_EBELGE_KAYNAK R
        WHERE R.ANAHTAR=CONCAT('${DOVIZ_EVRAK_TURU}:',D.BELGE_ID,':',D.FIS_TIPI)
          OR R.ANAHTAR=CONCAT('${DOVIZ_EVRAK_TURU}:',D.BELGE_ID,':',D.FIS_TIPI,':',RTRIM(D.BELGE_NO))
        ORDER BY CASE WHEN R.DURUM='HATA' THEN 1 ELSE 0 END,R.TARIH DESC) R
      OUTER APPLY (SELECT TOP 1 * FROM dbo.TODVZ_EBELGE_GIDEN G
        -- ICE, reddettiği belgenin numarasını da kaydeder ("bu tarihte zaten
        -- oluşturulmuş"); HATA dahil her giden kaydı numarayı kilitler. Düzeltme
        -- yeni numaralı fişle yapılır.
        WHERE G.BELGE_NO=RTRIM(D.BELGE_NO) OR G.UUID=NULLIF(RTRIM(D.ETTN),'')
        ORDER BY G.OLUSTURMA_TARIHI DESC) G
      WHERE ISNULL(D.IPTAL,0)=0 AND (@kaynak IS NULL OR @kaynak='DOVIZ')
        AND (@tur IS NULL OR D.FIS_TIPI=@tur)
        AND (@ilk IS NULL OR D.TARIH>=@ilk) AND (@son IS NULL OR D.TARIH<DATEADD(day,1,@son))
        AND (D.BELGE_NO LIKE @arama OR D.UNVAN LIKE @arama);

      -- Sarraf fişleri doğrudan tablodan (eski görünüm yalnız "e-Fatura" seçili ve e-belge başlangıç tarihi tanımlı
      -- fişleri veriyordu, numara olarak da fişin iç numarasını). Fiş, belge türü ve numara biçimi ne olursa olsun
      -- listelenir; e-Belge numarası gönderimde seriden verilir ve kaynak kaydına yazılır (belgeNo: verilmiş e-Belge
      -- numarası, yoksa fişin kendi numarası). belgeTuru: 1 satış, 2 e-İrsaliye seçili satış, 3 alış (e-Gider).
      -- Fişin kayıtta üretilmiş ETTN'si gönderim sayılmaz (eskiEttn boş); durum yalnız bizim kayıtlarımızdan.
      -- Reddedilen gönderimden sonra yeni numarayla yeniden gönderilebilsin diye HATA'daki giden kaydı seçimi kilitlemez.
      IF (@kaynak IS NULL OR @kaynak IN ('FATURA','IRSALIYE','GIDER'))
      INSERT INTO #Kaynak (evrakTuru,belgeId,belgeTuru,kaynak,belgeNo,tarih,unvan,tutar,paraBirimi,eskiEttn,eskiDurum,eskiHata,durum,hata,uuid,aliciVkn,posBekliyor)
      SELECT 0, S.SARRAF_FISI_ID, S.kaynakTuru, 'SARRAF', COALESCE(NULLIF(RTRIM(R.BELGE_NO),''), NULLIF(RTRIM(S.FIS_NO),''), CAST(S.SARRAF_FISI_ID AS varchar(20))),
        S.TARIH, RTRIM(S.UNVAN), ISNULL(T.TOPLAM,0), 'TRY', NULL, ISNULL(S.E_FATURA_DURUMU,0), NULLIF(RTRIM(S.E_FATURA_HATA_ACIKLAMASI),''),
        COALESCE(CASE WHEN G.GONDERIM_DURUMU IN ('KUYRUKTA','GONDERILIYOR','BELIRSIZ','ONAYLANIYOR') THEN 'GONDERILDI' ELSE G.GONDERIM_DURUMU END, R.DURUM,
          CASE WHEN NULLIF(RTRIM(S.E_FATURA_HATA_ACIKLAMASI),'') IS NOT NULL THEN 'HATA' WHEN ISNULL(S.E_FATURA_DURUMU,0)=0 THEN 'GONDERILMEDI' ELSE 'KONTROL_GEREKLI' END),
        CASE WHEN G.GONDERIM_DURUMU IN ('KUYRUKTA','GONDERILIYOR','BELIRSIZ','ONAYLANIYOR') THEN NULL ELSE COALESCE(G.ICE_RESPONSE_MESAJ,R.HATA,NULLIF(RTRIM(S.E_FATURA_HATA_ACIKLAMASI),'')) END,
        CASE WHEN G.GONDERIM_DURUMU='HATA' THEN NULL ELSE G.UUID END, RTRIM(S.VERGI_KIMLIK_NO),
        CASE WHEN EXISTS (SELECT 1 FROM dbo.TODVZ_POS_ISLEM I WHERE I.BELGE_TURU='sarraf' AND I.BELGE_ID=S.SARRAF_FISI_ID AND I.DURUM IN ('BEKLIYOR','BELIRSIZ'))
          THEN 1 ELSE 0 END
      FROM (SELECT X.*, CASE WHEN X.TIP=0 THEN 3 WHEN X.BELGE_TURU=2 THEN 2 ELSE 1 END kaynakTuru FROM dbo.TODVZ_SARRAF_FISI X) S
      OUTER APPLY (SELECT TOP 1 R.* FROM dbo.TODVZ_EBELGE_KAYNAK R WHERE R.ANAHTAR=CONCAT('0:',S.SARRAF_FISI_ID,':',S.kaynakTuru)
        ORDER BY R.TARIH DESC) R
      OUTER APPLY (SELECT TOP 1 * FROM dbo.TODVZ_EBELGE_GIDEN G WHERE G.KAYNAK_FIS_ID=CONCAT('0:',S.SARRAF_FISI_ID,':',S.kaynakTuru)
        ORDER BY G.OLUSTURMA_TARIHI DESC) G
      -- Tutar fişin kendi satırlarından (müşterinin ödediği; eski satır görünümü has gram × has kuru veriyordu)
      OUTER APPLY (SELECT SUM(ISNULL(E.TUTAR,0)) TOPLAM FROM dbo.TODVZ_SARRAF_FISI_SATIRI E WHERE E.SARRAF_FISI_ID=S.SARRAF_FISI_ID) T
      WHERE (@kaynak IS NULL OR (@kaynak='FATURA' AND S.kaynakTuru=1) OR (@kaynak='IRSALIYE' AND S.kaynakTuru=2) OR (@kaynak='GIDER' AND S.kaynakTuru=3))
        AND (@tur IS NULL OR S.kaynakTuru=@tur)
        AND (@ilk IS NULL OR S.TARIH>=@ilk) AND (@son IS NULL OR S.TARIH<DATEADD(day,1,@son))
        AND (S.FIS_NO LIKE @arama OR S.IRSALIYE_NO LIKE @arama OR S.UNVAN LIKE @arama OR R.BELGE_NO LIKE @arama);

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
        return { toplam: result.recordsets[0][0].toplam, kayitlar: result.recordsets[1].map((k) => ({ ...k, ...kaynakSecim(k) })) };
    }
    /**
     * e-Döviz detayı: başlık `VODVZ_GONDERIME_HAZIR_E_DOVIZ_FISI`'nden, belge içeriği
     * `VODVZ_E_DOVIZ_BELGESI_XSLT`'ten okunur (FIS_ID = BELGE_ID ile eşleşir).
     * `VODVZ_E_DOVIZ_BELGESI` görünümü yalnızca UUID taşıdığı için henüz
     * gönderilmemiş fişlerde kullanılamaz; bu yüzden XSLT görünümü kaynak alınır.
     */
    static async dovizDetay(k, ctx) {
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
        const sets = res.recordsets;
        if (sets[0].length !== 1) {
            throw ApiError.notFound("Kaynak döviz fişi bulunamadı, iptal edilmiş veya tekil değil.");
        }
        if (sets[1].length !== 1)
            throw ApiError.conflict('Döviz belgesinin ayrıntıları tekil olarak okunamadı. Fişin belge numarası ve ETTN alanlarını kontrol edin.');
        return { baslik: { ...sets[1][0], ...sets[0][0] }, satirlar: [] };
    }
    /**
     * Sarraf fişi başlık + satırlar (evrakTuru 0). Başlık fiş görünümünden (il / ilçe / vergi dairesi adları), gönderim
     * durumu tablodan; satırlar fişin kendi satırlarından (ürün adı ve birimi TODVZ_PARA'dan). Eski "gönderime hazır" ve
     * "e-fatura satırı" görünümleri kullanılmaz: biri yalnız "e-Fatura" seçili fişleri, diğeri fişten farklı tutar veriyordu.
     */
    static async detay(k, ctx) {
        const pool = await this.pool(ctx);
        const res = await pool.request().input("id", sql.Int, k.belgeId).query(`
      SELECT F.*, S.E_FATURA_DURUMU, S.E_FATURA_HATA_ACIKLAMASI, T.E_FATURA_KDV_MUAFIYET_KODU, T.E_FATURA_KDV_MUAFIYET_ADI
      FROM dbo.VODVZ_SARRAF_FISI F
      JOIN dbo.TODVZ_SARRAF_FISI S ON S.SARRAF_FISI_ID=F.SARRAF_FISI_ID
      OUTER APPLY (SELECT TOP 1 E_FATURA_KDV_MUAFIYET_KODU, E_FATURA_KDV_MUAFIYET_ADI FROM dbo.VODVZ_E_BELGE_TANIMI) T
      WHERE F.SARRAF_FISI_ID=@id;
      SELECT S.SATIR_NO, RTRIM(P.AD) URUN_ADI, P.BIRIM URUN_BIRIM, S.MIKTAR, S.ADET, S.ISCILIK_HAS_GRAM, S.TUTAR
        FROM dbo.TODVZ_SARRAF_FISI_SATIRI S LEFT JOIN dbo.TODVZ_PARA P ON P.PARA_ID=S.URUN_ID
        WHERE S.SARRAF_FISI_ID=@id ORDER BY S.SATIR_NO, S.SARRAF_FISI_SATIRI_ID;
    `);
        const sets = res.recordsets;
        if (sets[0].length !== 1)
            throw ApiError.notFound("Sarraf fişi bulunamadı veya tekil değil.");
        return { baslik: sets[0][0], satirlar: sets[1] };
    }
    /** Perakende fişi başlık + satırlar; firma e-Belge tanımındaki KDV muafiyet kodu Sarraf'taki gibi başlığa eklenir (P2). */
    static async perakendeDetay(k, ctx) {
        const pool = await this.pool(ctx);
        const res = await pool.request().input("id", sql.Int, k.belgeId).input("tip", sql.Int, k.belgeTuru).query(`
      SELECT F.*, RTRIM(PB.KOD) AS PARA_KODU, T.E_FATURA_KDV_MUAFIYET_KODU, T.E_FATURA_KDV_MUAFIYET_ADI
      FROM dbo.TODVZ_FATURA F
      LEFT JOIN dbo.TODVZ_PARA PB ON PB.PARA_ID=F.PARA_ID
      OUTER APPLY (SELECT TOP 1 E_FATURA_KDV_MUAFIYET_KODU, E_FATURA_KDV_MUAFIYET_ADI FROM dbo.VODVZ_E_BELGE_TANIMI) T
      WHERE F.FATURA_ID=@id AND F.FATURA_TIPI=@tip;
      SELECT * FROM dbo.TODVZ_FATURA_SATIRI WHERE FATURA_ID=@id ORDER BY SATIR_NO, FATURA_SATIR_ID;
    `);
        const sets = res.recordsets;
        if (sets[0].length !== 1)
            throw ApiError.notFound("Perakende fişi bulunamadı.");
        return { baslik: sets[0][0], satirlar: sets[1] };
    }
    static async reserve(k, belgeNo, ctx) {
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
        // Perakende fişine geri yazılır (P5): 1 = Gönderildi, diğerlerinde 0. GIB_STATU_KODU'na yazılmaz: canlı veritabanında
        // kolonun tipi farklı olabiliyor (metin yazınca "Conversion failed" verdi, 10.10.2026). Belge ICE'ye gitmiş olabilir;
        // fişe geri yazamamak gönderimi hatalı göstermemeli.
        if (sarrafMi(k)) {
            // Sarraf fişine geri yazılır: 1 = Gönderildi; diğerlerinde 0 (reddedilen fiş yeniden gönderilebilsin). Hiç
            // yazılmamış (boş) alan boş kalır: fiş değişmemiş sayılsın, yeniden hazırlamadan tekrar gönderilebilsin.
            try {
                await pool.request().input("id", sql.Int, k.belgeId).input("durum", sql.VarChar(30), durum)
                    .query(`UPDATE dbo.TODVZ_SARRAF_FISI SET E_FATURA_DURUMU = CASE WHEN @durum='GONDERILDI' THEN 1 WHEN E_FATURA_DURUMU IS NULL THEN NULL ELSE 0 END WHERE SARRAF_FISI_ID=@id`);
            }
            catch (err) {
                logger.warn(`[e-Belge] Sarraf fişine durum yazılamadı (${k.belgeId}): ${err?.message}`);
            }
        }
        if (perakendeMi(k)) {
            try {
                await pool.request().input("id", sql.Int, k.belgeId).input("durum", sql.VarChar(30), durum)
                    .query(`UPDATE dbo.TODVZ_FATURA SET E_BELGE_DURUMU = CASE WHEN @durum='GONDERILDI' THEN 1 ELSE 0 END WHERE FATURA_ID=@id`);
            }
            catch (err) {
                logger.warn(`[e-Belge] Perakende fişine durum yazılamadı (${k.belgeId}): ${err?.message}`);
            }
        }
    }
}
