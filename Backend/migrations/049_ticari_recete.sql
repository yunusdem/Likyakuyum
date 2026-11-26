-- ============================================================================
-- Göç 049: Reçeteli ürün (docs/TICARI_ADISYON_YOL_HARITASI.md, TA18)
--   TODVZ_STOK_KART.RECETELI: menü ürünü; kendisi stok tutmaz, satılınca reçetedeki malzemeler stoktan düşer.
--   TODVZ_STOK_RECETE: ürünün 1 biriminde harcanan malzeme miktarı (malzemenin biriminde).
--   Satış: malzeme hareketleri stok hareket türü 7 (BELGE_ID = fatura, SATIR_NO = fatura satırı); porsiyon çarpanı tüketime uygulanır.
-- Yalnız ekleme; tekrar çalıştırılabilir. Uygulama da ilk kullanımda aynı dosyayı çalıştırır (ticariSema.ts).
-- ============================================================================

IF COL_LENGTH('dbo.TODVZ_STOK_KART', 'RECETELI') IS NULL
  ALTER TABLE dbo.TODVZ_STOK_KART ADD RECETELI BIT NOT NULL CONSTRAINT DF_TODVZ_STOK_KART_RECETELI DEFAULT 0;
GO
IF OBJECT_ID('dbo.TODVZ_STOK_RECETE', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.TODVZ_STOK_RECETE (
    STOK_KART_ID INT NOT NULL CONSTRAINT FK_TODVZ_STOK_RECETE_URUN REFERENCES dbo.TODVZ_STOK_KART (STOK_KART_ID),
    SATIR_NO INT NOT NULL,
    MALZEME_KART_ID INT NOT NULL CONSTRAINT FK_TODVZ_STOK_RECETE_MALZEME REFERENCES dbo.TODVZ_STOK_KART (STOK_KART_ID),
    MIKTAR DECIMAL(18,4) NOT NULL,
    CONSTRAINT PK_TODVZ_STOK_RECETE PRIMARY KEY (STOK_KART_ID, SATIR_NO)
  );
  CREATE NONCLUSTERED INDEX IX_TODVZ_STOK_RECETE_MALZEME ON dbo.TODVZ_STOK_RECETE (MALZEME_KART_ID);
END
GO
