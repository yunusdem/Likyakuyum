-- Migration 039: Pano tanımında kur türü (efektif / döviz)
--
-- TODVZ_PANO.EFEKTIF_KUR
--    1 = LED panoya / Pano API'ye (JSON, XML, TXT, HTML) ve uygulama içi Pano ekranına efektif alış/satış verilir,
--    0 = döviz alış/satış. Varsayılan 1: eski program panoda her zaman efektif gösterirdi; mevcut bütün panolar
--    kolon eklenirken 1 ile dolar. Pano Tanımları ekranındaki "Kur türü — Efektif alış / satış" kutusu bu alandır.
--    Yeniden çalıştırılabilir (idempotent); aynı kolonu PanoSqlRepository tablo kontrolü de aynı adla ekler.

IF OBJECT_ID('dbo.TODVZ_PANO', 'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.TODVZ_PANO', 'EFEKTIF_KUR') IS NULL
        ALTER TABLE [dbo].[TODVZ_PANO] ADD [EFEKTIF_KUR] BIT NOT NULL CONSTRAINT [DF_TODVZ_PANO_EFEKTIF_KUR] DEFAULT(1);
END;
GO
