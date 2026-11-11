-- Migration 030: Cari Kart İşlem Gösterme Gün Sayısı
-- Kullanıcı tanımlarındaki "İşlem gösterme gün sayısı" özelliğinin cari kartlara da eklenmesi

IF COL_LENGTH('dbo.TODVZ_CARI_KART', 'ISLEM_GOSTERME_GUN_SAYISI') IS NULL
BEGIN
    ALTER TABLE [dbo].[TODVZ_CARI_KART] ADD [ISLEM_GOSTERME_GUN_SAYISI] INT NULL CONSTRAINT DF_TODVZ_CARI_KART_ISLEM_GOSTERME_GUN_SAYISI DEFAULT 0;
END;

