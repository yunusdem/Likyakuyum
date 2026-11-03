/* LIKYA_ADMIN göçü 003 — Hugin S1 POS entegrasyonu (PC Link + TSM Gateway) merkezi ayarları
   (docs/POS_ENTEGRASYON_YOL_HARITASI.md §0c). Tekrar çalıştırılabilir yazılır.
   ADM_POS_AYAR yoksa (docs/sql/LIKYA_ADMIN_POS.sql hiç çalıştırılmamış) hiçbir şey yapmaz; o betik bu kolonları da kurar. */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID('dbo.ADM_POS_AYAR') IS NOT NULL AND COL_LENGTH('dbo.ADM_POS_AYAR', 'HUGIN_GW_URL') IS NULL
BEGIN
  ALTER TABLE dbo.ADM_POS_AYAR ADD
    HUGIN_GW_URL        VARCHAR(300)  NULL,   -- https://pclink-gw.hugin.co (boşsa bu adres kullanılır)
    HUGIN_TSM_TOKEN_ENC VARCHAR(MAX)  NULL,   -- Hugin'in yazılım firmasına verdiği tsmToken (AES-256-GCM)
    HUGIN_YAZILIM_ID    VARCHAR(20)   NULL,   -- X-SoftwareId: yazılım firmasının VKN'si
    HUGIN_DONANIM_ID    VARCHAR(100)  NULL;   -- X-HardwareId: sunucunun sabit kimliği (boşsa LIKYAERP-SUNUCU)
END
GO
