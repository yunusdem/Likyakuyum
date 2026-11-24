-- Migration 037: Döviz fişine Alınan Para ve Para Üstü alanları + kayıt prosedürü
--
-- TODVZ_FIS.ALINAN_PARA / TODVZ_FIS.PARA_USTU
--    Döviz Fişi Kayıt / Düzeltme ekranlarında F12 Para Üstü modalından girilen
--    Alınan Para ve Para Üstü tutarlarını saklar. Yeniden çalıştırılabilir (idempotent).

IF OBJECT_ID('dbo.TODVZ_FIS', 'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.TODVZ_FIS', 'ALINAN_PARA') IS NULL
        ALTER TABLE [dbo].[TODVZ_FIS] ADD [ALINAN_PARA] DECIMAL(18,4) NOT NULL CONSTRAINT DF_TODVZ_FIS_ALINAN_PARA DEFAULT(0);

    IF COL_LENGTH('dbo.TODVZ_FIS', 'PARA_USTU') IS NULL
        ALTER TABLE [dbo].[TODVZ_FIS] ADD [PARA_USTU] DECIMAL(18,4) NOT NULL CONSTRAINT DF_TODVZ_FIS_PARA_USTU DEFAULT(0);
END;
GO

CREATE OR ALTER PROCEDURE [dbo].[SODVZ_FIS_PARA_USTU_KAYDET]
    @FIS_ID INT,
    @ALINAN_PARA DECIMAL(18,4) = 0,
    @PARA_USTU DECIMAL(18,4) = 0
AS
BEGIN
    SET NOCOUNT ON;

    IF @FIS_ID IS NULL OR @FIS_ID <= 0
        RETURN;

    UPDATE [dbo].[TODVZ_FIS]
    SET
        [ALINAN_PARA] = ISNULL(@ALINAN_PARA, 0),
        [PARA_USTU]   = ISNULL(@PARA_USTU, 0)
    WHERE [FIS_ID] = @FIS_ID;
END;
GO
