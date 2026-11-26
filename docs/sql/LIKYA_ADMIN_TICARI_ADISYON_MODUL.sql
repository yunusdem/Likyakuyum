/* =============================================================================
   LIKYA_ADMIN — Ticari eksikleri + Adisyon menü kodları (docs/TICARI_ADISYON_YOL_HARITASI.md)

   Yeni kodlar (fazlar ilerledikçe bu listeye eklenir):
     ticari:ticari/iade-fisi        (Ticari İşlemler › Q- Satış İadesi, TA6)
     ticari:ticari/vardiya          (Ticari İşlemler › R- Vardiya (Kasa Açılış / Kapanış), TA8)
     ticari:ticari/gun-sonu         (Ticari İşlemler › S- Gün Sonu Raporu, TA7)
     ticari:ticari/sayim-fisi       (Ticari İşlemler › T- Sayım Fişi, TA11)
     ticari:ticari/fire-fisi        (Ticari İşlemler › U- Fire / Zayi Fişi, TA12)
     ticari:ticari/tedarikci-iade   (Ticari İşlemler › V- Tedarikçiye İade, TA13)
     ticari:ticari/efatura-giris    (Ticari İşlemler › W- e-Faturadan Stok Girişi, TA14)
     ticari:ticari/kar-raporu       (Ticari İşlemler › X- Kâr Raporu, TA15)
     ticari:ticari/skt-yaklasan     (Ticari İşlemler › Y- SKT Yaklaşanlar, TA16)
     ticari:ticari/parcalama        (Ticari İşlemler › Z- Parçalama Fişi, TA17)

   Modül ayarı yapılmış firmaların listesinde bu kodlar olmadığı için deploy sonrası menüde görünmezlerdi.
   Bu betik: 1) ADM_MODUL'e ekler, 2) içeriği yüklenmiş Kuyum ve Ticari paketlerine ekler,
   3) Ticari İşlemler menüsü AÇIK firmalarda açar.
   Kurulum: sunucuda SSMS'te, deploy ile birlikte bir kez (canlı için LIKYA_ADMIN, test için LIKYA_ADMIN_TEST).
   Tekrar çalıştırılabilir; panelden kapatılmış kodu yeniden AÇMAZ.
   Firma veritabanlarında göçler 040–048 (terazi, ek birim, iade, vardiya, sayım / fire, tedarikçiye iade, e-Fatura alım, SKT, parçalama) ilk kullanımda kendiliğinden uygulanır.
   ============================================================================= */

USE [LIKYA_ADMIN];
GO
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

-- 1) Katalog
DECLARE @k TABLE (KOD varchar(200), UST varchar(200), BASLIK nvarchar(200), TUR varchar(20));
INSERT @k VALUES
  ('ticari:ticari/iade-fisi', 'ticari', N'Q- Satış İadesi', 'ALT'),
  ('ticari:ticari/vardiya', 'ticari', N'R- Vardiya (Kasa Açılış / Kapanış)', 'ALT'),
  ('ticari:ticari/gun-sonu', 'ticari', N'S- Gün Sonu Raporu', 'ALT'),
  ('ticari:ticari/sayim-fisi', 'ticari', N'T- Sayım Fişi', 'ALT'),
  ('ticari:ticari/fire-fisi', 'ticari', N'U- Fire / Zayi Fişi', 'ALT'),
  ('ticari:ticari/tedarikci-iade', 'ticari', N'V- Tedarikçiye İade', 'ALT'),
  ('ticari:ticari/efatura-giris', 'ticari', N'W- e-Faturadan Stok Girişi', 'ALT'),
  ('ticari:ticari/kar-raporu', 'ticari', N'X- Kâr Raporu', 'ALT'),
  ('ticari:ticari/skt-yaklasan', 'ticari', N'Y- SKT Yaklaşanlar', 'ALT'),
  ('ticari:ticari/parcalama', 'ticari', N'Z- Parçalama Fişi', 'ALT');

INSERT INTO dbo.ADM_MODUL (MODUL_KODU, UST_KODU, BASLIK, TUR, SIRA)
SELECT k.KOD, k.UST, k.BASLIK, k.TUR, (SELECT ISNULL(MAX(SIRA), 0) FROM dbo.ADM_MODUL) + ROW_NUMBER() OVER (ORDER BY k.KOD)
FROM @k k
WHERE NOT EXISTS (SELECT 1 FROM dbo.ADM_MODUL m WHERE m.MODUL_KODU = k.KOD);
GO

-- 2) Ürün paketleri (içeriği yüklenmiş paketler)
IF OBJECT_ID('dbo.ADM_PAKET_MODUL') IS NOT NULL
BEGIN
  INSERT INTO dbo.ADM_PAKET_MODUL (PAKET_KODU, MODUL_KODU)
  SELECT x.PAKET, x.KOD
  FROM (VALUES
    ('kuyum', 'ticari:ticari/iade-fisi'), ('ticari', 'ticari:ticari/iade-fisi'),
    ('kuyum', 'ticari:ticari/vardiya'), ('ticari', 'ticari:ticari/vardiya'),
    ('kuyum', 'ticari:ticari/gun-sonu'), ('ticari', 'ticari:ticari/gun-sonu'),
    ('kuyum', 'ticari:ticari/sayim-fisi'), ('ticari', 'ticari:ticari/sayim-fisi'),
    ('kuyum', 'ticari:ticari/fire-fisi'), ('ticari', 'ticari:ticari/fire-fisi'),
    ('kuyum', 'ticari:ticari/tedarikci-iade'), ('ticari', 'ticari:ticari/tedarikci-iade'),
    ('kuyum', 'ticari:ticari/efatura-giris'), ('ticari', 'ticari:ticari/efatura-giris'),
    ('kuyum', 'ticari:ticari/kar-raporu'), ('ticari', 'ticari:ticari/kar-raporu'),
    ('kuyum', 'ticari:ticari/skt-yaklasan'), ('ticari', 'ticari:ticari/skt-yaklasan'),
    ('kuyum', 'ticari:ticari/parcalama'), ('ticari', 'ticari:ticari/parcalama')
  ) AS x (PAKET, KOD)
  JOIN dbo.ADM_PAKET p ON p.PAKET_KODU = x.PAKET AND p.ILK_ICERIK = 1
  WHERE NOT EXISTS (SELECT 1 FROM dbo.ADM_PAKET_MODUL y WHERE y.PAKET_KODU = x.PAKET AND y.MODUL_KODU = x.KOD);
END
GO

-- 3) Ticari İşlemler açık firmalarda kodları aç
INSERT INTO dbo.ADM_FIRMA_MODUL (FIRMA_ID, MODUL_KODU, ACIK)
SELECT DISTINCT f.FIRMA_ID, k.KOD, 1
FROM dbo.ADM_FIRMA_MODUL f
CROSS JOIN (VALUES ('ticari:ticari/iade-fisi'), ('ticari:ticari/vardiya'), ('ticari:ticari/gun-sonu'), ('ticari:ticari/sayim-fisi'), ('ticari:ticari/fire-fisi'), ('ticari:ticari/tedarikci-iade'), ('ticari:ticari/efatura-giris'), ('ticari:ticari/kar-raporu'), ('ticari:ticari/skt-yaklasan'), ('ticari:ticari/parcalama')) AS k (KOD)
WHERE f.MODUL_KODU = 'ticari' AND f.ACIK = 1
  AND NOT EXISTS (SELECT 1 FROM dbo.ADM_FIRMA_MODUL x WHERE x.FIRMA_ID = f.FIRMA_ID AND x.MODUL_KODU = k.KOD);
GO

-- Kontrol
SELECT MODUL_KODU, BASLIK FROM dbo.ADM_MODUL WHERE MODUL_KODU IN ('ticari:ticari/iade-fisi', 'ticari:ticari/vardiya', 'ticari:ticari/gun-sonu', 'ticari:ticari/sayim-fisi', 'ticari:ticari/fire-fisi', 'ticari:ticari/tedarikci-iade', 'ticari:ticari/efatura-giris', 'ticari:ticari/kar-raporu', 'ticari:ticari/skt-yaklasan', 'ticari:ticari/parcalama');
GO
