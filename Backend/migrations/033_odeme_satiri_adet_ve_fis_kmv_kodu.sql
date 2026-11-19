-- Migration 033: Ödeme satırı ADET kolonu + fişlerde "KMV kura dahil" kodlaması (19.11.2026 veri aktarımı denetimi)
--
-- 1) TODVZ_ODEME_SATIRI.ADET
--    Cari hareket listesi ve cari bakiyesi sorguları (cariHareketSql.repository) ödeme satırında ADET kolonunu okur; kolonu ekleyen
--    göç ya da kod yoktu. Kolonun olmadığı veritabanında sorgu "Invalid column name 'ADET'" verir, cari bakiyesi boş döner.
--    TODVZ_FATURA_ODEME.ADET ile aynı tip.
IF OBJECT_ID('dbo.TODVZ_ODEME_SATIRI', 'U') IS NOT NULL AND COL_LENGTH('dbo.TODVZ_ODEME_SATIRI', 'ADET') IS NULL
    ALTER TABLE [dbo].[TODVZ_ODEME_SATIRI] ADD [ADET] FLOAT NULL;
GO

-- 2) TODVZ_FIS.KMV_UYGULAMA_SEKLI — fişe "kura dahil" için 2 yazılmış kayıtlar
--    Sağlayıcının e-Döviz belge görünümleri fişteki değeri eski KMV_KURA_DAHIL biti gibi okur: yalnız 1 iken "K.M.V. Kura dahildir" der
--    ve ödenecek tutara KMV eklemez; 2'de ekler. Uygulama "2 - Kura Dahil" ayarında fişe 2 yazıyordu (artık 1 yazar, utils/kmv.utils.ts);
--    e-Döviz belgesindeki ödenecek tutar fişin ödeme tutarından KMV kadar fazla çıkıyordu. Eski kuralla aktarılmış firmalar da böyle.
--    Dokunulmayanlar:
--      - KMV'si ödeme tutarına EKLENMİŞ (gerçekten kurdan hariç ödenmiş) fiş: fişin kendi tutarlarına bakılır;
--      - BİZİM SİSTEMİMİZLE (ICE) GÖNDERİLMİŞ e-Döviz belgesi olan fiş: belge o tutarla gitti, kaydı değişirse bizdeki kopya gönderilenle
--        uyuşmaz. (Eski programla gönderilmiş belgeler — "Eski programla gönderildi" işareti — düzeltilir: onlar KMV'siz tutarla gitti.)
IF OBJECT_ID('dbo.TODVZ_FIS', 'U') IS NOT NULL AND COL_LENGTH('dbo.TODVZ_FIS', 'KMV_UYGULAMA_SEKLI') IS NOT NULL
   AND OBJECT_ID('dbo.TODVZ_FIS_SATIRI', 'U') IS NOT NULL
BEGIN
    DECLARE @gonderimKosulu nvarchar(max) = N'';
    IF OBJECT_ID('dbo.TODVZ_EBELGE_KAYNAK', 'U') IS NOT NULL
        SET @gonderimKosulu = N'
      AND NOT EXISTS (
            SELECT 1 FROM dbo.TODVZ_EBELGE_KAYNAK K
            WHERE K.ANAHTAR LIKE N''99:'' + CAST(F.FIS_ID AS nvarchar(20)) + N'':%''
              AND K.DURUM NOT IN (''GONDERILMEDI'', ''HATA'')
              AND ISNULL(K.HATA, N'''') NOT LIKE N''Eski programla%'')';
    DECLARE @komut nvarchar(max) = N'
    UPDATE F
    SET KMV_UYGULAMA_SEKLI = 1
    FROM dbo.TODVZ_FIS F
    OUTER APPLY (
        SELECT SUM(ISNULL(S.KMV, 0)) AS KMV, SUM(ISNULL(S.BMV, 0) + ISNULL(S.KOMISYON, 0)) AS DIGER
        FROM dbo.TODVZ_FIS_SATIRI S WHERE S.FIS_ID = F.FIS_ID
    ) X
    WHERE F.KMV_UYGULAMA_SEKLI = 2
      AND NOT (
            ISNULL(X.KMV, 0) > 0
        -- ödeme - toplam - (BSMV + komisyon): 0''a yakınsa KMV ödemede yok (kura dahil), KMV''ye yakınsa ödemeye eklenmiş (kurdan hariç)
        AND ABS((ISNULL(F.ODEME_TUTARI, 0) - ISNULL(F.TOPLAM_TUTAR, 0)) - ISNULL(X.DIGER, 0) - X.KMV)
          < ABS((ISNULL(F.ODEME_TUTARI, 0) - ISNULL(F.TOPLAM_TUTAR, 0)) - ISNULL(X.DIGER, 0))
      )' + @gonderimKosulu + N';';
    EXEC sys.sp_executesql @komut;
END;
