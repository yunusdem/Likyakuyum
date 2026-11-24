-- Migration 038: Vezne "Açılış farkı" satırlarını açıklaması boş kasa hareketlerinden arındırır (Firma Varlıkları denetimi 24.11.2026)
--
-- Sorun: raporların vezne hareket kaynağı (Backend/src/services/rapor/kaynak.ts) fişlerin işçilik / ödeme kayıtlarını
--    `NOT (ACIKLAMA LIKE ...)` ile ayıklıyordu; ACIKLAMA NULL olan kasa hesap hareketi (TODVZ_HESAP_HAREKETI) de bu yüzden
--    vezne hareketlerinden düşüyordu. TODVZ_VEZNE_BAKIYE_DUZELTME tablosu ilk kurulurken yazılan "Açılış farkı (belgesiz bakiye)"
--    (KAYNAK 0) satırı = anlık bakiye − belgelerden hesaplanan bakiye olduğundan, o anda var olan bu düşen hareketleri örtmüştü.
--    Kaynak düzeltildi (ISNULL); bu satırlar olduğu gibi kalırsa aynı tutarlar iki kez sayılır.
--
-- Düzeltme: açılış farkı yazılmış (KAYNAK 0 satırı olan) veritabanında, açılış farkının yazıldığı ana kadar eklenmiş
--    (EKLEME_ZAMANI <= ilk KAYNAK 0 satırının EKLEME_ZAMANI) açıklaması NULL kasa hareketlerinin vezne × para net etkisi
--    (giriş +, çıkış −; KDV ayrıca TL'ye) açılış farkından düşülür ve belgeden hesaplanan eski bakiyeye (ESKI_MIKTAR) eklenir.
--    Sonuç sıfırsa satır silinir; o vezne × parada açılış farkı satırı yoksa eksi tutarla eklenir (tarih / açıklama ilk satırınki).
--    Şablondan açılan ya da eski programdan aktarılan firmada KAYNAK 0 satırı yoktur → hiçbir şey değişmez.
--    Tek seferliktir (LKY_SEMA_SURUMU); yeniden çalıştırılırsa ikinci kez düşmesin diye tabloya genişletilmiş özellik işareti konur.
IF OBJECT_ID('dbo.TODVZ_VEZNE_BAKIYE_DUZELTME', 'U') IS NOT NULL
   AND OBJECT_ID('dbo.TODVZ_HESAP_HAREKETI', 'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.TODVZ_VEZNE_BAKIYE_DUZELTME') AND minor_id = 0
                   AND name = N'LKY_ACILIS_FARKI_BOS_ACIKLAMA')
-- İç IF ayrı komut: tablo yokken dış koşul yanlış olur ve tabloya değinen komutlar hiç derlenmez (tek IF'te AND kısa devre yapmaz)
BEGIN
IF EXISTS (SELECT 1 FROM dbo.TODVZ_VEZNE_BAKIYE_DUZELTME WHERE KAYNAK = 0)
BEGIN
    DECLARE @an DATETIME, @tarih DATETIME, @aciklama VARCHAR(200);
    SELECT TOP 1 @an = EKLEME_ZAMANI, @tarih = TARIH, @aciklama = ACIKLAMA
    FROM dbo.TODVZ_VEZNE_BAKIYE_DUZELTME WHERE KAYNAK = 0 ORDER BY EKLEME_ZAMANI, VEZNE_BAKIYE_DUZELTME_ID;
    DECLARE @tl INT = ISNULL((SELECT TOP 1 PARA_ID FROM dbo.TODVZ_PARA WHERE RTRIM(UPPER(KOD)) IN ('TL','TRY') ORDER BY PARA_ID), 1);

    -- Geçici tablo (tablo değişkeni değil): tablo değişkenli komut önceden derlenir ve TODVZ_VEZNE_BAKIYE_DUZELTME olmayan veritabanında
    -- IF'e girmeden "Invalid object name" verir; geçici tabloda ad çözümü komut çalışırken yapılır.
    IF OBJECT_ID('tempdb..#dusen') IS NOT NULL DROP TABLE #dusen;
    CREATE TABLE #dusen (VEZNE_ID INT NOT NULL, PARA_ID INT NOT NULL, NET FLOAT NOT NULL, PRIMARY KEY (VEZNE_ID, PARA_ID));
    INSERT INTO #dusen (VEZNE_ID, PARA_ID, NET)
    SELECT X.VEZNE_ID, X.PARA_ID, SUM(X.NET)
    FROM (
        SELECT KH.VEZNE_ID, KH.PARA_ID, CASE WHEN KH.TIP = 0 THEN KH.MEBLAG ELSE -KH.MEBLAG END AS NET
        FROM dbo.TODVZ_HESAP_HAREKETI KH
        WHERE KH.ACIKLAMA IS NULL AND KH.EKLEME_ZAMANI <= @an
        UNION ALL
        SELECT KH.VEZNE_ID, @tl, CASE WHEN KH.TIP = 0 THEN KH.KDV ELSE -KH.KDV END
        FROM dbo.TODVZ_HESAP_HAREKETI KH
        WHERE KH.ACIKLAMA IS NULL AND KH.EKLEME_ZAMANI <= @an AND ISNULL(KH.KDV, 0) > 0
    ) X
    WHERE X.VEZNE_ID IS NOT NULL AND X.PARA_ID IS NOT NULL
    GROUP BY X.VEZNE_ID, X.PARA_ID
    HAVING ABS(SUM(X.NET)) >= 0.00005;

    UPDATE D SET D.MIKTAR = D.MIKTAR - U.NET, D.ESKI_MIKTAR = ISNULL(D.ESKI_MIKTAR, 0) + U.NET
    FROM dbo.TODVZ_VEZNE_BAKIYE_DUZELTME D
    JOIN #dusen U ON U.VEZNE_ID = D.VEZNE_ID AND U.PARA_ID = D.PARA_ID
    WHERE D.KAYNAK = 0;

    INSERT INTO dbo.TODVZ_VEZNE_BAKIYE_DUZELTME (VEZNE_ID, PARA_ID, MIKTAR, ESKI_MIKTAR, YENI_MIKTAR, TARIH, KAYNAK, ACIKLAMA, EKLEME_ZAMANI)
    SELECT U.VEZNE_ID, U.PARA_ID, -U.NET, NULL, NULL, @tarih, 0, @aciklama, @an
    FROM #dusen U
    WHERE NOT EXISTS (SELECT 1 FROM dbo.TODVZ_VEZNE_BAKIYE_DUZELTME D WHERE D.KAYNAK = 0 AND D.VEZNE_ID = U.VEZNE_ID AND D.PARA_ID = U.PARA_ID);

    DELETE FROM dbo.TODVZ_VEZNE_BAKIYE_DUZELTME WHERE KAYNAK = 0 AND ABS(MIKTAR) < 0.00005;

    DROP TABLE #dusen;
    EXEC sys.sp_addextendedproperty @name = N'LKY_ACILIS_FARKI_BOS_ACIKLAMA', @value = N'038',
         @level0type = N'SCHEMA', @level0name = N'dbo', @level1type = N'TABLE', @level1name = N'TODVZ_VEZNE_BAKIYE_DUZELTME';
END
END
GO
