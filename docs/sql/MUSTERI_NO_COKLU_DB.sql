-- Musteri no ile giris: bir musterinin birden cok veritabani (her biri ayri firma kaydi) olabilsin.
-- Sunucuda SSMS'te, DEPLOY'DAN ONCE calistirilir. Tekrar calistirilabilir.
USE [LIKYA_ADMIN];
GO
SET QUOTED_IDENTIFIER ON;
GO
IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'UX_ADM_FIRMA_MUSTERI_NO')
  DROP INDEX [UX_ADM_FIRMA_MUSTERI_NO] ON [dbo].[ADM_FIRMA];
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ADM_FIRMA_MUSTERI_NO')
  CREATE INDEX [IX_ADM_FIRMA_MUSTERI_NO] ON [dbo].[ADM_FIRMA]([MUSTERI_NO]) WHERE [MUSTERI_NO] IS NOT NULL;
GO
-- Kontrol: musteri no bos olan firma giris ekranindan bulunamaz
SELECT FIRMA_ID, FIRMA_KODU, MUSTERI_NO, DB_NAME, DURUM,
       CASE WHEN DB_USER IS NULL OR DB_SIFRE_ENC IS NULL THEN 'EKSIK' ELSE 'TAMAM' END AS BAGLANTI_BILGISI
FROM dbo.ADM_FIRMA ORDER BY MUSTERI_NO, DB_NAME;
GO
