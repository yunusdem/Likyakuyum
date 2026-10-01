import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";

export interface FaturaSatiriModel {
  faturaSatirId: number;
  faturaId: number;
  satirNo: number;
  altinUrunId?: number | null;
  barkod?: string | null;
  urunAdi: string;
  ayar?: string | null;
  miktar: number;
  birim: string;
  gram: number;
  hasGram: number;
  birimFiyat: number;
  tutar: number;
  kdvOrani: number;
  kdvTutari: number;
  toplamTutar: number;
}

export interface FaturaOdemeModel {
  faturaOdemeId?: number;
  faturaId: number;
  satirNo: number;
  odemeAraciTuru?: number;
  islemeYeri?: number;
  cariKartId?: number | null;
  posCihaziId?: number | null;
  cariKod?: string | null;
  cariUnvan?: string | null;
  paraId?: number | null;
  paraKodu: string;
  paraAdi?: string | null;
  adet?: number | null;
  miktar?: number | null;
  milyem?: number | null;
  hasGram?: number | null;
  kur: number;
  tutar: number;
}

export interface FaturaModel {
  faturaId: number;
  vezneId: number;
  vezneKod?: string | null;
  vezneAd?: string | null;
  faturaNo: string;
  ettn: string;
  tarih: string;
  faturaTipi: number; // 1: Satış, 2: İade
  senaryo: string; // EARSIVFATURA, TEMELFATURA, TICARIFATURA
  cariKartId?: number | null;
  cariKod?: string | null;
  cariUnvan?: string | null;
  aliciVknTckn: string;
  aliciUnvan: string;
  adres?: string | null;
  ilce?: string | null;
  il?: string | null;
  vergiDairesi?: string | null;
  eposta?: string | null;
  telefon?: string | null;
  paraId: number;
  paraKodu?: string | null;
  kur: number;
  araToplam: number;
  toplamKdv: number;
  iskontoId?: number | null;
  iskontoKodu?: string | null;
  iskontoOrani?: number;
  iskontoTutari?: number;
  genelToplam: number;
  eBelgeDurumu: number; // 0: Taslak, 1: İletildi, 2: Onaylandı, 3: Hata, 4: İptal
  gibStatuKodu?: string | null;
  ekleyenId?: number | null;
  eklemeZamani?: string | null;
  satirlar?: FaturaSatiriModel[];
  odemeler?: FaturaOdemeModel[];
}

export interface CreateFaturaSatiriDto {
  altinUrunId?: number | null;
  barkod?: string | null;
  urunAdi: string;
  ayar?: string | null;
  miktar: number;
  birim?: string;
  gram?: number;
  hasGram?: number;
  birimFiyat: number;
  kdvOrani?: number;
}

export interface CreateFaturaOdemeDto {
  satirNo?: number;
  odemeAraciTuru?: number;
  islemeYeri?: number;
  cariKartId?: number | null;
  posCihaziId?: number | null;
  cariKod?: string | null;
  cariUnvan?: string | null;
  paraId?: number | null;
  paraKodu: string;
  paraAdi?: string | null;
  adet?: number | null;
  miktar?: number | null;
  milyem?: number | null;
  hasGram?: number | null;
  kur?: number;
  tutar: number;
}

export interface CreateFaturaDto {
  faturaId?: number | null;
  vezneId?: number;
  faturaNo?: string;
  ettn?: string;
  tarih?: string;
  faturaTipi?: number; // 1: Satış, 2: İade
  senaryo?: string;
  cariKartId?: number | null;
  aliciVknTckn?: string;
  aliciUnvan?: string;
  adres?: string | null;
  ilce?: string | null;
  il?: string | null;
  vergiDairesi?: string | null;
  eposta?: string | null;
  telefon?: string | null;
  paraId?: number;
  kur?: number;
  araToplam?: number;
  toplamKdv?: number;
  iskontoId?: number | null;
  iskontoKodu?: string | null;
  iskontoOrani?: number | null;
  iskontoTutari?: number | null;
  genelToplam?: number;
  satirlar: CreateFaturaSatiriDto[];
  odemeler?: CreateFaturaOdemeDto[];
}

export interface FaturaFilterDto {
  baslangicTarihi?: string;
  bitisTarihi?: string;
  aliciVknTckn?: string;
  eBelgeDurumu?: number;
  search?: string;
  limit?: number;
}

export type CreateInvoiceDto = CreateFaturaDto;
export type CreateInvoiceLineDto = CreateFaturaSatiriDto;
export type CreateInvoiceOdemeDto = CreateFaturaOdemeDto;
export type InvoiceFilterDto = FaturaFilterDto;

/**
 * Perakende fişinin vezne etkisini geri alan SQL (@FID faturası, veritabanındaki hâlinden) — düzeltmede başlık güncellenmeden önce ve silmede kullanılır.
 * Barkodsuz satır: satırda saklanan stok parası / miktarı (STOK_PARA_ID / STOK_MIKTAR); 01.10.2026 öncesi satırlarda kaydetmedeki eski kural ve eşleştirme.
 * Vezneden tahsilat: yalnızca vezneye işlenmiş (VEZNE_ISLENDI = 1) ödeme satırları. Rapor denetimi 01.10.2026 — önceden düzeltme yeni başlığın veznesi / tipiyle
 * ve farklı bir para eşleştirmesiyle geri alıyor, tahsilatı hiç işlemiyordu.
 */
const PERAKENDE_VEZNE_GERI_AL = `
  DECLARE @GA_VEZNE INT, @GA_TIPI INT;
  SELECT @GA_VEZNE = VEZNE_ID, @GA_TIPI = FATURA_TIPI FROM dbo.TODVZ_FATURA WHERE FATURA_ID = @FID;
  IF @GA_VEZNE IS NOT NULL AND @GA_VEZNE > 0
  BEGIN
    DECLARE @GA TABLE (PARA_ID INT, M FLOAT);
    INSERT INTO @GA (PARA_ID, M)
      SELECT COALESCE(s.STOK_PARA_ID, E1.PARA_ID, E2.PARA_ID),
        CASE WHEN @GA_TIPI = 1 THEN 1 ELSE -1 END * COALESCE(s.STOK_MIKTAR, CASE WHEN s.GRAM > 0 THEN s.GRAM ELSE s.MIKTAR END)
      FROM dbo.TODVZ_FATURA_SATIRI s
      OUTER APPLY (SELECT TOP 1 P.PARA_ID FROM dbo.TODVZ_PARA P
        WHERE UPPER(LTRIM(RTRIM(P.KOD))) = UPPER(LTRIM(RTRIM(s.AYAR)))
           OR UPPER(LTRIM(RTRIM(P.KOD))) = UPPER(LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(ISNULL(s.AYAR, ''), ' AYAR', ''), 'AYAR', ''), ' ', ''))))
           OR UPPER(LTRIM(RTRIM(P.KOD))) = UPPER(LTRIM(RTRIM(ISNULL(s.URUN_ADI, ''))))
           OR UPPER(LTRIM(RTRIM(P.AD))) = UPPER(LTRIM(RTRIM(ISNULL(s.URUN_ADI, ''))))) E1
      OUTER APPLY (SELECT TOP 1 P.PARA_ID FROM dbo.TODVZ_PARA P
        WHERE E1.PARA_ID IS NULL AND (UPPER(LTRIM(RTRIM(P.AD))) IN (
          UPPER(LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(ISNULL(s.AYAR, ''), ' AYAR', ''), 'AYAR', ''), ' ', '')))) + ' AYAR',
          UPPER(LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(ISNULL(s.AYAR, ''), ' AYAR', ''), 'AYAR', ''), ' ', '')))) + ' AYAR ALTIN',
          UPPER(LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(ISNULL(s.AYAR, ''), ' AYAR', ''), 'AYAR', ''), ' ', ''))))))) E2
      WHERE s.FATURA_ID = @FID AND ISNULL(s.ALTIN_URUN_ID, 0) = 0 AND LEN(LTRIM(RTRIM(ISNULL(s.BARKOD, '')))) = 0
        AND COALESCE(s.STOK_MIKTAR, CASE WHEN s.GRAM > 0 THEN s.GRAM ELSE s.MIKTAR END) > 0;
    IF COL_LENGTH('dbo.TODVZ_FATURA_ODEME', 'VEZNE_ISLENDI') IS NOT NULL
      INSERT INTO @GA (PARA_ID, M)
        SELECT O.PARA_ID, CASE WHEN @GA_TIPI = 1 THEN -1 ELSE 1 END * ISNULL(NULLIF(O.MIKTAR, 0), O.TUTAR / NULLIF(O.KUR, 0))
        FROM dbo.TODVZ_FATURA_ODEME O WHERE O.FATURA_ID = @FID AND ISNULL(O.VEZNE_ISLENDI, 0) = 1;
    UPDATE B SET MIKTAR = B.MIKTAR + G.M
      FROM dbo.TODVZ_VEZNE_BAKIYE B JOIN (SELECT PARA_ID, SUM(M) M FROM @GA WHERE PARA_ID IS NOT NULL GROUP BY PARA_ID) G ON G.PARA_ID = B.PARA_ID
      WHERE B.VEZNE_ID = @GA_VEZNE;
    INSERT INTO dbo.TODVZ_VEZNE_BAKIYE (VEZNE_ID, PARA_ID, MIKTAR)
      SELECT @GA_VEZNE, G.PARA_ID, G.M FROM (SELECT PARA_ID, SUM(M) M FROM @GA WHERE PARA_ID IS NOT NULL GROUP BY PARA_ID) G
      WHERE NOT EXISTS (SELECT 1 FROM dbo.TODVZ_VEZNE_BAKIYE B WHERE B.VEZNE_ID = @GA_VEZNE AND B.PARA_ID = G.PARA_ID);
  END;`;

export class PerakendeSqlRepository {
  private static ensuredPools = new WeakSet<sql.ConnectionPool>();

  /**
   * Ensures tables and stored procedures exist in the database
   */
  public static async ensureTablesAndProcedures(pool: sql.ConnectionPool): Promise<void> {
    if (this.ensuredPools.has(pool)) return;
    try {
      // 1. TODVZ_FATURA Header Table
      await pool.request().batch(`
        IF OBJECT_ID('dbo.TODVZ_FATURA', 'U') IS NULL
        BEGIN
          CREATE TABLE dbo.TODVZ_FATURA (
            [FATURA_ID] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            [VEZNE_ID] INT NOT NULL DEFAULT 1,
            [FATURA_NO] VARCHAR(50) NOT NULL,
            [ETTN] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
            [TARIH] DATETIME NOT NULL DEFAULT GETDATE(),
            [FATURA_TIPI] TINYINT NOT NULL DEFAULT 1,
            [SENARYO] VARCHAR(50) NOT NULL DEFAULT 'EARSIVFATURA',
            [CARI_KART_ID] INT NULL,
            [ALICI_VKN_TCKN] VARCHAR(50) NOT NULL,
            [ALICI_UNVAN] VARCHAR(250) NOT NULL,
            [ADRES] VARCHAR(500) NULL,
            [ILCE] VARCHAR(100) NULL,
            [IL] VARCHAR(100) NULL,
            [VERGI_DAIRESI] VARCHAR(100) NULL,
            [EPOSTA] VARCHAR(100) NULL,
            [TELEFON] VARCHAR(50) NULL,
            [PARA_ID] INT NOT NULL DEFAULT 1,
            [KUR] FLOAT NOT NULL DEFAULT 1.0,
            [ARA_TOPLAM] FLOAT NOT NULL DEFAULT 0,
            [TOPLAM_KDV] FLOAT NOT NULL DEFAULT 0,
            [ISKONTO_ID] INT NULL,
            [ISKONTO_KODU] VARCHAR(50) NULL,
            [ISKONTO_ORANI] FLOAT NOT NULL DEFAULT 0,
            [ISKONTO_TUTARI] FLOAT NOT NULL DEFAULT 0,
            [GENEL_TOPLAM] FLOAT NOT NULL DEFAULT 0,
            [E_BELGE_DURUMU] TINYINT NOT NULL DEFAULT 0,
            [GIB_STATU_KODU] VARCHAR(50) NULL,
            [EKLEYEN_ID] INT NULL,
            [EKLEME_ZAMANI] DATETIME NOT NULL DEFAULT GETDATE(),
            [GUNCELLEYEN_ID] INT NULL,
            [GUNCELLEME_ZAMANI] DATETIME NULL
          );
          CREATE NONCLUSTERED INDEX IX_TODVZ_FATURA_TARIH ON dbo.TODVZ_FATURA([TARIH] DESC);
          CREATE NONCLUSTERED INDEX IX_TODVZ_FATURA_NO ON dbo.TODVZ_FATURA([FATURA_NO]);
        END
        ELSE
        BEGIN
          IF COL_LENGTH('dbo.TODVZ_FATURA', 'ISKONTO_ID') IS NULL ALTER TABLE dbo.TODVZ_FATURA ADD [ISKONTO_ID] INT NULL;
          IF COL_LENGTH('dbo.TODVZ_FATURA', 'ISKONTO_KODU') IS NULL ALTER TABLE dbo.TODVZ_FATURA ADD [ISKONTO_KODU] VARCHAR(50) NULL;
          IF COL_LENGTH('dbo.TODVZ_FATURA', 'ISKONTO_ORANI') IS NULL ALTER TABLE dbo.TODVZ_FATURA ADD [ISKONTO_ORANI] FLOAT NOT NULL DEFAULT 0;
          IF COL_LENGTH('dbo.TODVZ_FATURA', 'ISKONTO_TUTARI') IS NULL ALTER TABLE dbo.TODVZ_FATURA ADD [ISKONTO_TUTARI] FLOAT NOT NULL DEFAULT 0;
        END;
      `);

      // 2. TODVZ_FATURA_SATIRI Detail Table
      await pool.request().batch(`
        IF OBJECT_ID('dbo.TODVZ_FATURA_SATIRI', 'U') IS NULL
        BEGIN
          CREATE TABLE dbo.TODVZ_FATURA_SATIRI (
            [FATURA_SATIR_ID] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            [FATURA_ID] INT NOT NULL,
            [SATIR_NO] INT NOT NULL,
            [ALTIN_URUN_ID] INT NULL,
            [BARKOD] VARCHAR(50) NULL,
            [URUN_ADI] VARCHAR(200) NOT NULL,
            [AYAR] VARCHAR(50) NULL,
            [MIKTAR] FLOAT NOT NULL DEFAULT 1,
            [BIRIM] VARCHAR(20) NOT NULL DEFAULT 'Adet',
            [GRAM] FLOAT NOT NULL DEFAULT 0,
            [HAS_GRAM] FLOAT NOT NULL DEFAULT 0,
            [BIRIM_FIYAT] FLOAT NOT NULL DEFAULT 0,
            [TUTAR] FLOAT NOT NULL DEFAULT 0,
            [KDV_ORANI] FLOAT NOT NULL DEFAULT 0,
            [KDV_TUTARI] FLOAT NOT NULL DEFAULT 0,
            [TOPLAM_TUTAR] FLOAT NOT NULL DEFAULT 0
          );
          CREATE NONCLUSTERED INDEX IX_TODVZ_FATURA_SATIRI_FID ON dbo.TODVZ_FATURA_SATIRI([FATURA_ID]);
        END
        ELSE
        BEGIN
          IF COL_LENGTH('dbo.TODVZ_FATURA_SATIRI', 'FATURA_ID') IS NULL ALTER TABLE dbo.TODVZ_FATURA_SATIRI ADD [FATURA_ID] INT NOT NULL DEFAULT 0;
          IF COL_LENGTH('dbo.TODVZ_FATURA_SATIRI', 'SATIR_NO') IS NULL ALTER TABLE dbo.TODVZ_FATURA_SATIRI ADD [SATIR_NO] INT NOT NULL DEFAULT 1;
          IF COL_LENGTH('dbo.TODVZ_FATURA_SATIRI', 'ALTIN_URUN_ID') IS NULL ALTER TABLE dbo.TODVZ_FATURA_SATIRI ADD [ALTIN_URUN_ID] INT NULL;
          IF COL_LENGTH('dbo.TODVZ_FATURA_SATIRI', 'BARKOD') IS NULL ALTER TABLE dbo.TODVZ_FATURA_SATIRI ADD [BARKOD] VARCHAR(50) NULL;
          IF COL_LENGTH('dbo.TODVZ_FATURA_SATIRI', 'URUN_ADI') IS NULL ALTER TABLE dbo.TODVZ_FATURA_SATIRI ADD [URUN_ADI] VARCHAR(200) NULL;
          IF COL_LENGTH('dbo.TODVZ_FATURA_SATIRI', 'AYAR') IS NULL ALTER TABLE dbo.TODVZ_FATURA_SATIRI ADD [AYAR] VARCHAR(50) NULL;
          IF COL_LENGTH('dbo.TODVZ_FATURA_SATIRI', 'MIKTAR') IS NULL ALTER TABLE dbo.TODVZ_FATURA_SATIRI ADD [MIKTAR] FLOAT NOT NULL DEFAULT 1;
          IF COL_LENGTH('dbo.TODVZ_FATURA_SATIRI', 'BIRIM') IS NULL ALTER TABLE dbo.TODVZ_FATURA_SATIRI ADD [BIRIM] VARCHAR(20) NOT NULL DEFAULT 'Adet';
          IF COL_LENGTH('dbo.TODVZ_FATURA_SATIRI', 'GRAM') IS NULL ALTER TABLE dbo.TODVZ_FATURA_SATIRI ADD [GRAM] FLOAT NOT NULL DEFAULT 0;
          IF COL_LENGTH('dbo.TODVZ_FATURA_SATIRI', 'HAS_GRAM') IS NULL ALTER TABLE dbo.TODVZ_FATURA_SATIRI ADD [HAS_GRAM] FLOAT NOT NULL DEFAULT 0;
          IF COL_LENGTH('dbo.TODVZ_FATURA_SATIRI', 'BIRIM_FIYAT') IS NULL ALTER TABLE dbo.TODVZ_FATURA_SATIRI ADD [BIRIM_FIYAT] FLOAT NOT NULL DEFAULT 0;
          IF COL_LENGTH('dbo.TODVZ_FATURA_SATIRI', 'TUTAR') IS NULL ALTER TABLE dbo.TODVZ_FATURA_SATIRI ADD [TUTAR] FLOAT NOT NULL DEFAULT 0;
          IF COL_LENGTH('dbo.TODVZ_FATURA_SATIRI', 'KDV_ORANI') IS NULL ALTER TABLE dbo.TODVZ_FATURA_SATIRI ADD [KDV_ORANI] FLOAT NOT NULL DEFAULT 0;
          IF COL_LENGTH('dbo.TODVZ_FATURA_SATIRI', 'KDV_TUTARI') IS NULL ALTER TABLE dbo.TODVZ_FATURA_SATIRI ADD [KDV_TUTARI] FLOAT NOT NULL DEFAULT 0;
          IF COL_LENGTH('dbo.TODVZ_FATURA_SATIRI', 'TOPLAM_TUTAR') IS NULL ALTER TABLE dbo.TODVZ_FATURA_SATIRI ADD [TOPLAM_TUTAR] FLOAT NOT NULL DEFAULT 0;
        END;
        -- Barkodsuz satırın vezne stoğundan düşen parası ve miktarı (düzeltme / silme aynısını geri alır; raporlar da bunu okur)
        IF COL_LENGTH('dbo.TODVZ_FATURA_SATIRI', 'STOK_PARA_ID') IS NULL ALTER TABLE dbo.TODVZ_FATURA_SATIRI ADD [STOK_PARA_ID] INT NULL;
        IF COL_LENGTH('dbo.TODVZ_FATURA_SATIRI', 'STOK_MIKTAR') IS NULL ALTER TABLE dbo.TODVZ_FATURA_SATIRI ADD [STOK_MIKTAR] FLOAT NULL;
      `);

      // 2.b TODVZ_FATURA_ODEME Detail Table
      await pool.request().batch(`
        IF OBJECT_ID('dbo.TODVZ_FATURA_ODEME', 'U') IS NULL
        BEGIN
          CREATE TABLE dbo.TODVZ_FATURA_ODEME (
            [FATURA_ODEME_ID] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            [FATURA_ID] INT NOT NULL,
            [SATIR_NO] INT NOT NULL DEFAULT 1,
            [ODEME_ARACI_TURU] TINYINT NULL DEFAULT 0,
            [ISLEME_YERI] TINYINT NULL DEFAULT 0,
            [CARI_KART_ID] INT NULL,
            [POS_CIHAZI_ID] INT NULL,
            [CARI_KOD] VARCHAR(50) NULL,
            [CARI_UNVAN] VARCHAR(250) NULL,
            [PARA_ID] INT NULL,
            [PARA_KODU] VARCHAR(50) NULL,
            [PARA_ADI] VARCHAR(100) NULL,
            [ADET] FLOAT NULL,
            [MIKTAR] FLOAT NULL,
            [MILYEM] FLOAT NULL,
            [HAS_GRAM] FLOAT NULL,
            [KUR] FLOAT NOT NULL DEFAULT 1.0,
            [TUTAR] FLOAT NOT NULL DEFAULT 0,
            [EKLEME_ZAMANI] DATETIME NOT NULL DEFAULT GETDATE()
          );
          CREATE NONCLUSTERED INDEX IX_TODVZ_FATURA_ODEME_FID ON dbo.TODVZ_FATURA_ODEME([FATURA_ID]);
        END
        ELSE
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TODVZ_FATURA_ODEME') AND name = 'ODEME_ARACI_TURU')
            ALTER TABLE dbo.TODVZ_FATURA_ODEME ADD [ODEME_ARACI_TURU] TINYINT NULL DEFAULT 0;
          IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TODVZ_FATURA_ODEME') AND name = 'CARI_KART_ID')
            ALTER TABLE dbo.TODVZ_FATURA_ODEME ADD [CARI_KART_ID] INT NULL;
          IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TODVZ_FATURA_ODEME') AND name = 'POS_CIHAZI_ID')
            ALTER TABLE dbo.TODVZ_FATURA_ODEME ADD [POS_CIHAZI_ID] INT NULL;
          IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TODVZ_FATURA_ODEME') AND name = 'CARI_KOD')
            ALTER TABLE dbo.TODVZ_FATURA_ODEME ADD [CARI_KOD] VARCHAR(50) NULL;
          IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TODVZ_FATURA_ODEME') AND name = 'CARI_UNVAN')
            ALTER TABLE dbo.TODVZ_FATURA_ODEME ADD [CARI_UNVAN] VARCHAR(250) NULL;
          IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TODVZ_FATURA_ODEME') AND name = 'ISLEME_YERI')
            ALTER TABLE dbo.TODVZ_FATURA_ODEME ADD [ISLEME_YERI] TINYINT NULL DEFAULT 0;
        END;
        -- Vezneden tahsilatın vezne bakiyesine işlendiği satırlar (01.10.2026 öncesi tahsilatlar işlenmemişti; geri alma yalnız bunlara uygulanır)
        IF COL_LENGTH('dbo.TODVZ_FATURA_ODEME', 'VEZNE_ISLENDI') IS NULL ALTER TABLE dbo.TODVZ_FATURA_ODEME ADD [VEZNE_ISLENDI] BIT NULL;
      `);

      // 3. Stored Procedure: SODVZ_FATURA_KAYDET
      await pool.request().batch(`
        CREATE OR ALTER PROCEDURE dbo.SODVZ_FATURA_KAYDET
            @FATURA_ID          INT = NULL OUTPUT,
            @VEZNE_ID           INT,
            @FATURA_NO          VARCHAR(50),
            @ETTN               UNIQUEIDENTIFIER = NULL,
            @TARIH              DATETIME = NULL,
            @FATURA_TIPI        TINYINT = 1,
            @SENARYO            VARCHAR(50) = 'EARSIVFATURA',
            @CARI_KART_ID       INT = NULL,
            @ALICI_VKN_TCKN     VARCHAR(50),
            @ALICI_UNVAN        VARCHAR(250),
            @ADRES              VARCHAR(500) = NULL,
            @ILCE               VARCHAR(100) = NULL,
            @IL                 VARCHAR(100) = NULL,
            @VERGI_DAIRESI      VARCHAR(100) = NULL,
            @EPOSTA             VARCHAR(100) = NULL,
            @TELEFON            VARCHAR(50) = NULL,
            @PARA_ID            INT = 1,
            @KUR                FLOAT = 1.0,
            @ARA_TOPLAM         FLOAT = 0,
            @TOPLAM_KDV         FLOAT = 0,
            @GENEL_TOPLAM       FLOAT = 0,
            @ISKONTO_ID         INT = NULL,
            @ISKONTO_KODU       VARCHAR(50) = NULL,
            @ISKONTO_ORANI      FLOAT = 0,
            @ISKONTO_TUTARI     FLOAT = 0,
            @KULLANICI_ID       INT = NULL
        AS
        BEGIN
            SET NOCOUNT ON;

            IF @ETTN IS NULL SET @ETTN = NEWID();
            IF @TARIH IS NULL SET @TARIH = GETDATE();

            IF (@FATURA_ID IS NULL OR @FATURA_ID = 0)
            BEGIN
                IF EXISTS (SELECT 1 FROM dbo.TODVZ_FATURA WHERE FATURA_NO = @FATURA_NO)
                BEGIN
                    RAISERROR ('Bu fatura numarası daha önce kullanılmış.', 16, 1);
                    RETURN 1;
                END;

                INSERT INTO dbo.TODVZ_FATURA (
                    VEZNE_ID, FATURA_NO, ETTN, TARIH, FATURA_TIPI, SENARYO,
                    CARI_KART_ID, ALICI_VKN_TCKN, ALICI_UNVAN, ADRES, ILCE, IL,
                    VERGI_DAIRESI, EPOSTA, TELEFON, PARA_ID, KUR,
                    ARA_TOPLAM, TOPLAM_KDV, ISKONTO_ID, ISKONTO_KODU, ISKONTO_ORANI, ISKONTO_TUTARI, GENEL_TOPLAM,
                    E_BELGE_DURUMU, EKLEYEN_ID, EKLEME_ZAMANI
                )
                VALUES (
                    @VEZNE_ID, @FATURA_NO, @ETTN, @TARIH, @FATURA_TIPI, @SENARYO,
                    @CARI_KART_ID, @ALICI_VKN_TCKN, @ALICI_UNVAN, @ADRES, @ILCE, @IL,
                    @VERGI_DAIRESI, @EPOSTA, @TELEFON, @PARA_ID, @KUR,
                    @ARA_TOPLAM, @TOPLAM_KDV, @ISKONTO_ID, @ISKONTO_KODU, @ISKONTO_ORANI, @ISKONTO_TUTARI, @GENEL_TOPLAM,
                    0, @KULLANICI_ID, GETDATE()
                );

                SET @FATURA_ID = SCOPE_IDENTITY();
            END
            ELSE
            BEGIN
                UPDATE dbo.TODVZ_FATURA
                SET VEZNE_ID          = @VEZNE_ID,
                    FATURA_NO         = @FATURA_NO,
                    TARIH             = @TARIH,
                    FATURA_TIPI       = @FATURA_TIPI,
                    SENARYO           = @SENARYO,
                    CARI_KART_ID      = @CARI_KART_ID,
                    ALICI_VKN_TCKN    = @ALICI_VKN_TCKN,
                    ALICI_UNVAN       = @ALICI_UNVAN,
                    ADRES             = @ADRES,
                    ILCE              = @ILCE,
                    IL                = @IL,
                    VERGI_DAIRESI     = @VERGI_DAIRESI,
                    EPOSTA            = @EPOSTA,
                    TELEFON           = @TELEFON,
                    PARA_ID           = @PARA_ID,
                    KUR               = @KUR,
                    ARA_TOPLAM        = @ARA_TOPLAM,
                    TOPLAM_KDV        = @TOPLAM_KDV,
                    ISKONTO_ID        = @ISKONTO_ID,
                    ISKONTO_KODU      = @ISKONTO_KODU,
                    ISKONTO_ORANI     = @ISKONTO_ORANI,
                    ISKONTO_TUTARI    = @ISKONTO_TUTARI,
                    GENEL_TOPLAM      = @GENEL_TOPLAM,
                    GUNCELLEYEN_ID    = @KULLANICI_ID,
                    GUNCELLEME_ZAMANI = GETDATE()
                WHERE FATURA_ID = @FATURA_ID;
            END;

            RETURN 0;
        END;
      `);

      // 4. Stored Procedure: SODVZ_FATURA_SATIR_EKLE
      await pool.request().batch(`
        CREATE OR ALTER PROCEDURE dbo.SODVZ_FATURA_SATIR_EKLE
            @FATURA_ID          INT,
            @SATIR_NO           INT,
            @ALTIN_URUN_ID      INT = NULL,
            @BARKOD             VARCHAR(50) = NULL,
            @URUN_ADI           VARCHAR(200),
            @AYAR               VARCHAR(50) = NULL,
            @MIKTAR             FLOAT = 1,
            @BIRIM              VARCHAR(20) = 'Adet',
            @GRAM               FLOAT = 0,
            @HAS_GRAM           FLOAT = 0,
            @BIRIM_FIYAT        FLOAT,
            @KDV_ORANI          FLOAT = 0
        AS
        BEGIN
            SET NOCOUNT ON;

            DECLARE @TUTAR FLOAT = @MIKTAR * @BIRIM_FIYAT;
            DECLARE @KDV_TUTARI FLOAT = ROUND(@TUTAR * (@KDV_ORANI / 100.0), 2);
            DECLARE @TOPLAM_TUTAR FLOAT = @TUTAR + @KDV_TUTARI;

            BEGIN TRAN;

            INSERT INTO dbo.TODVZ_FATURA_SATIRI (
                FATURA_ID, SATIR_NO, ALTIN_URUN_ID, BARKOD, URUN_ADI,
                AYAR, MIKTAR, BIRIM, GRAM, HAS_GRAM,
                BIRIM_FIYAT, TUTAR, KDV_ORANI, KDV_TUTARI, TOPLAM_TUTAR
            )
            VALUES (
                @FATURA_ID, @SATIR_NO, @ALTIN_URUN_ID, @BARKOD, @URUN_ADI,
                @AYAR, @MIKTAR, @BIRIM, @GRAM, @HAS_GRAM,
                @BIRIM_FIYAT, @TUTAR, @KDV_ORANI, @KDV_TUTARI, @TOPLAM_TUTAR
            );

            -- Barkodlu ürün ise stoktan düş (SATILDI = 1)
            IF (@ALTIN_URUN_ID IS NOT NULL AND @ALTIN_URUN_ID > 0)
            BEGIN
                UPDATE dbo.TODVZ_ALTIN_URUN
                SET SATILDI = 1,
                    GUNCELLEME_ZAMANI = GETDATE()
                WHERE ALTIN_URUN_ID = @ALTIN_URUN_ID;
            END
            ELSE IF (@BARKOD IS NOT NULL AND LEN(@BARKOD) > 0)
            BEGIN
                UPDATE dbo.TODVZ_ALTIN_URUN
                SET SATILDI = 1,
                    GUNCELLEME_ZAMANI = GETDATE()
                WHERE BARKOD = @BARKOD;
            END;

            -- Fatura başlığındaki genel toplamları satırlardan ve kayıtlı iskontodan hesaplayarak güncelle
            UPDATE dbo.TODVZ_FATURA
            SET ARA_TOPLAM   = ISNULL((SELECT SUM(TUTAR) FROM dbo.TODVZ_FATURA_SATIRI WHERE FATURA_ID = @FATURA_ID), 0),
                TOPLAM_KDV   = ISNULL((SELECT SUM(KDV_TUTARI) FROM dbo.TODVZ_FATURA_SATIRI WHERE FATURA_ID = @FATURA_ID), 0),
                GENEL_TOPLAM = CASE 
                  WHEN (ISNULL((SELECT SUM(TOPLAM_TUTAR) FROM dbo.TODVZ_FATURA_SATIRI WHERE FATURA_ID = @FATURA_ID), 0) - ISNULL(ISKONTO_TUTARI, 0)) < 0 THEN 0
                  ELSE (ISNULL((SELECT SUM(TOPLAM_TUTAR) FROM dbo.TODVZ_FATURA_SATIRI WHERE FATURA_ID = @FATURA_ID), 0) - ISNULL(ISKONTO_TUTARI, 0))
                END
            WHERE FATURA_ID = @FATURA_ID;

            COMMIT TRAN;
            RETURN 0;
        END;
      `);

      // 5. Stored Procedure: SODVZ_FATURA_SIL
      await pool.request().batch(`
        CREATE OR ALTER PROCEDURE dbo.SODVZ_FATURA_SIL
            @FATURA_ID INT
        AS
        BEGIN
            SET NOCOUNT ON;

            IF NOT EXISTS (SELECT 1 FROM dbo.TODVZ_FATURA WHERE FATURA_ID = @FATURA_ID)
            BEGIN
                RAISERROR ('Silinmek istenen fatura bulunamadı.', 16, 1);
                RETURN 1;
            END

            -- GİB'e iletilmiş faturaların silinmesini engelle
            IF EXISTS (SELECT 1 FROM dbo.TODVZ_FATURA WHERE FATURA_ID = @FATURA_ID AND E_BELGE_DURUMU = 2)
            BEGIN
                RAISERROR ('GİB portalına iletilmiş onaylı e-faturalar doğrudan silinemez, iptal edilmelidir.', 16, 1);
                RETURN 1;
            END

            BEGIN TRAN;

            -- 1. Satılan altın ve özel ürünleri tekrar stoğa iade et
            IF OBJECT_ID('dbo.TODVZ_ALTIN_URUN') IS NOT NULL
            BEGIN
                UPDATE u
                SET u.SATILDI = 0,
                    u.GUNCELLEME_ZAMANI = GETDATE()
                FROM dbo.TODVZ_ALTIN_URUN u
                INNER JOIN dbo.TODVZ_FATURA_SATIRI s ON u.ALTIN_URUN_ID = s.ALTIN_URUN_ID OR (s.BARKOD IS NOT NULL AND u.BARKOD = s.BARKOD)
                WHERE s.FATURA_ID = @FATURA_ID;
            END;

            IF OBJECT_ID('dbo.TODVZ_OZEL_URUN') IS NOT NULL
            BEGIN
                UPDATE u
                SET u.SATILDI = 0,
                    u.GUNCELLEME_ZAMANI = GETDATE()
                FROM dbo.TODVZ_OZEL_URUN u
                INNER JOIN dbo.TODVZ_FATURA_SATIRI s ON (s.BARKOD IS NOT NULL AND u.BARKOD = s.BARKOD)
                WHERE s.FATURA_ID = @FATURA_ID;
            END;

            -- 2. Barkodsuz ürünlerin ve vezneden tahsilatın vezne etkisini geri al (kaydetmedeki kuralla; rapor denetimi 01.10.2026)
            DECLARE @FID INT = @FATURA_ID;
            ${PERAKENDE_VEZNE_GERI_AL}

            -- 2.b Faturanın işçilik hesabına yazılmış kasa kaydı ("Perakende Fişi İşçilik - Fatura No: …") fatura silinince kalmasın
            IF OBJECT_ID('dbo.TODVZ_HESAP_HAREKETI', 'U') IS NOT NULL
              DELETE H FROM dbo.TODVZ_HESAP_HAREKETI H JOIN dbo.TODVZ_FATURA F ON H.ACIKLAMA = 'Perakende Fişi İşçilik - Fatura No: ' + LTRIM(RTRIM(F.FATURA_NO))
              WHERE F.FATURA_ID = @FATURA_ID;

            -- Satırları, ödemeleri ve başlığı kaldır
            IF OBJECT_ID('dbo.TODVZ_FATURA_ODEME', 'U') IS NOT NULL
            BEGIN
                DELETE FROM dbo.TODVZ_FATURA_ODEME WHERE FATURA_ID = @FATURA_ID;
            END;
            DELETE FROM dbo.TODVZ_FATURA_SATIRI WHERE FATURA_ID = @FATURA_ID;
            DELETE FROM dbo.TODVZ_FATURA WHERE FATURA_ID = @FATURA_ID;

            COMMIT TRAN;
            RETURN 0;
        END;
      `);
      this.ensuredPools.add(pool);
    } catch (err: any) {
      logger.warn("PerakendeSqlRepository.ensureTablesAndProcedures warning:", err.message);
    }
  }

  /**
   * Generates next Invoice Number (guaranteed unused and synchronized with TODVZ_NUMERATOR & TODVZ_FATURA)
   */
  public static async getNextFaturaNo(
    prefix: string = "EAR",
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<string> {
    try {
      const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
      await this.ensureTablesAndProcedures(pool);

      const targetPfx = (prefix || "EAR").trim().toUpperCase();
      const req = pool.request();
      req.input("IN_PREFIX", sql.VarChar(20), targetPfx);

      const query = `
        DECLARE @ONEK VARCHAR(20) = NULL;
        DECLARE @SAYAC INT = 1;
        DECLARE @UZUNLUK INT = 16;
        DECLARE @ONUNE_SIFIR BIT = 1;
        DECLARE @TARGET_TUR INT = CASE WHEN @IN_PREFIX = 'EAR' THEN 26 ELSE 24 END;

        IF OBJECT_ID('dbo.TODVZ_NUMERATOR') IS NOT NULL
        BEGIN
          SELECT TOP 1 
            @TARGET_TUR = TUR,
            @ONEK = ONEK, 
            @SAYAC = BASLANGIC, 
            @UZUNLUK = UZUNLUK, 
            @ONUNE_SIFIR = ONUNE_SIFIR_KOY
          FROM dbo.TODVZ_NUMERATOR
          WHERE (ONEK LIKE @IN_PREFIX + '%' OR TUR = @TARGET_TUR OR (@IN_PREFIX = 'GIB' AND TUR IN (24, 25)) OR (@IN_PREFIX = 'EAR' AND TUR = 26))
          ORDER BY 
            CASE 
              WHEN ONEK LIKE @IN_PREFIX + '%' THEN 0 
              WHEN TUR = @TARGET_TUR THEN 1 
              ELSE 2 
            END,
            CASE WHEN YAZICI_ID IS NOT NULL THEN 0 ELSE 1 END;
        END;

        IF @ONEK IS NULL OR LEN(LTRIM(RTRIM(@ONEK))) = 0 OR @ONEK NOT LIKE @IN_PREFIX + '%'
        BEGIN
          SET @ONEK = @IN_PREFIX + CAST(YEAR(GETDATE()) AS VARCHAR(4));
        END;

        IF @UZUNLUK IS NULL OR @UZUNLUK < 2 SET @UZUNLUK = 16;
        IF @SAYAC IS NULL OR @SAYAC < 1 SET @SAYAC = 1;

        DECLARE @SAYAC_BOYU INT = @UZUNLUK - LEN(@ONEK);
        IF @SAYAC_BOYU < 2 SET @SAYAC_BOYU = 2;

        -- Candidate loop to guarantee non-duplicate against TODVZ_FATURA
        DECLARE @CANDIDATE VARCHAR(50);
        DECLARE @EXISTS BIT = 1;

        WHILE @EXISTS = 1
        BEGIN
          DECLARE @NUM_STR VARCHAR(20) = STR(@SAYAC, @SAYAC_BOYU, 0);
          IF @ONUNE_SIFIR = 1 SET @NUM_STR = REPLACE(@NUM_STR, ' ', '0');
          SET @CANDIDATE = RTRIM(@ONEK) + LTRIM(@NUM_STR);

          IF EXISTS (SELECT 1 FROM dbo.TODVZ_FATURA WHERE FATURA_NO = @CANDIDATE)
          BEGIN
            SET @SAYAC = @SAYAC + 1;
          END
          ELSE
          BEGIN
            SET @EXISTS = 0;
          END;
        END;

        -- Keep TODVZ_NUMERATOR.BASLANGIC updated so it doesn't fall behind
        IF OBJECT_ID('dbo.TODVZ_NUMERATOR') IS NOT NULL
        BEGIN
          UPDATE dbo.TODVZ_NUMERATOR
          SET BASLANGIC = @SAYAC
          WHERE TUR = @TARGET_TUR AND BASLANGIC < @SAYAC;
        END;

        SELECT @CANDIDATE AS NEXT_FATURA_NO;
      `;

      const res = await req.query(query);
      if (res.recordset && res.recordset[0]?.NEXT_FATURA_NO) {
        return res.recordset[0].NEXT_FATURA_NO.trim();
      }

      const year = new Date().getFullYear();
      return `${targetPfx}${year}000000001`;
    } catch (err) {
      logger.warn("PerakendeSqlRepository.getNextFaturaNo warning:", err);
      const year = new Date().getFullYear();
      return `${prefix || "EAR"}${year}000000001`;
    }
  }

  /**
   * Query product by barcode or currency code from TODVZ_ALTIN_URUN, TODVZ_OZEL_URUN, or TODVZ_PARA
   */
  public static async getProductByBarcode(
    barcode: string,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<any> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureTablesAndProcedures(pool);

    const cleanBarcode = barcode.trim();
    const req = pool.request();
    req.input("BARKOD", sql.VarChar(50), cleanBarcode);

    // 1. Check TODVZ_ALTIN_URUN
    const altinRes = await req.query(`
      SELECT TOP 1 
        u.[ALTIN_URUN_ID],
        u.[BARKOD],
        u.[GRUP_KODU],
        u.[URUN_NO],
        u.[AYAR],
        u.[MODEL],
        u.[ORJINAL_KOD],
        u.[URETICI_FIRMA],
        u.[MIKTAR],
        u.[HAS_GRAM],
        u.[SATIS_FIYATI],
        u.[SATIS_PARA_KODU],
        u.[SATILDI]
      FROM [dbo].[TODVZ_ALTIN_URUN] u
      WHERE u.[BARKOD] = @BARKOD
         OR CAST(u.[ALTIN_URUN_ID] AS VARCHAR(50)) = @BARKOD;
    `);

    if (altinRes.recordset && altinRes.recordset.length > 0) {
      const row = altinRes.recordset[0];
      if (row.SATILDI === true || row.SATILDI === 1) {
        throw ApiError.badRequest(
          `'${cleanBarcode}' barkodlu altın ürün (${row.MODEL || row.GRUP_KODU || "Altın Ürün"}) daha önce satılmıştır ve stokta mevcut değildir.`
        );
      }

      return {
        altinUrunId: row.ALTIN_URUN_ID,
        barkod: row.BARKOD || cleanBarcode,
        grupKodu: row.GRUP_KODU,
        urunNo: row.URUN_NO,
        urunAdi: row.MODEL || `${row.GRUP_KODU || "Altın"} ${row.AYAR || ""} Ürün`,
        ayar: row.AYAR || "24K",
        miktar: 1,
        birim: "Adet",
        gram: Number(row.MIKTAR) || 0,
        hasGram: Number(row.HAS_GRAM) || 0,
        satisFiyati: Number(row.SATIS_FIYATI) || 0,
        satisParaKodu: row.SATIS_PARA_KODU || "TL",
        satildi: false,
        isBarkodlu: true,
      };
    }

    // 2. Check TODVZ_OZEL_URUN
    const ozelRes = await req.query(`
      SELECT TOP 1 
        u.[OZEL_URUN_ID],
        u.[BARKOD],
        u.[GRUP_KODU],
        u.[URUN_NO],
        u.[AYAR],
        u.[MODEL_OZELLIK_1] AS [MODEL],
        u.[MAMUL_TIPI],
        u.[ORJINAL_KOD],
        u.[URETICI_FIRMA],
        u.[MIKTAR],
        u.[MIKTAR_BIRIMI],
        u.[SATIS_FIYATI],
        u.[SATIS_PARA_KODU],
        u.[SATILDI]
      FROM [dbo].[TODVZ_OZEL_URUN] u
      WHERE u.[BARKOD] = @BARKOD
         OR CAST(u.[OZEL_URUN_ID] AS VARCHAR(50)) = @BARKOD;
    `);

    if (ozelRes.recordset && ozelRes.recordset.length > 0) {
      const row = ozelRes.recordset[0];
      if (row.SATILDI === true || row.SATILDI === 1) {
        throw ApiError.badRequest(
          `'${cleanBarcode}' barkodlu özel ürün (${row.MODEL || row.MAMUL_TIPI || row.GRUP_KODU || "Özel Ürün"}) daha önce satılmıştır ve stokta mevcut değildir.`
        );
      }

      return {
        altinUrunId: null,
        barkod: row.BARKOD || cleanBarcode,
        grupKodu: row.GRUP_KODU,
        urunNo: row.URUN_NO,
        urunAdi: row.MODEL || row.MAMUL_TIPI || `${row.GRUP_KODU || "Özel"} ${row.AYAR || ""} Ürün`,
        ayar: row.AYAR || "24K",
        miktar: 1,
        birim: row.MIKTAR_BIRIMI || "Adet",
        gram: Number(row.MIKTAR) || 0,
        hasGram: 0,
        satisFiyati: Number(row.SATIS_FIYATI) || 0,
        satisParaKodu: row.SATIS_PARA_KODU || "USD",
        satildi: false,
        isBarkodlu: true,
      };
    }

    // 3. Check TODVZ_PARA (Döviz, Sarrafiye, Gram Altın vb. Örn: USD, EUR, ÇEY, 22, 14, 18, 24, HAS, TAM, YAR, ATA)
    const paraRes = await req.query(`
      SELECT TOP 1 
        p.[PARA_ID],
        p.[KOD],
        p.[AD],
        p.[HAS_ORANI],
        p.[URUN_TIPI]
      FROM [dbo].[TODVZ_PARA] p
      WHERE (UPPER(LTRIM(RTRIM(p.[KOD]))) = UPPER(LTRIM(RTRIM(@BARKOD)))
          OR UPPER(LTRIM(RTRIM(p.[AD]))) = UPPER(LTRIM(RTRIM(@BARKOD))))
        AND UPPER(LTRIM(RTRIM(p.[KOD]))) NOT IN ('TL', 'TRY', 'TRL', 'POS', 'HAVALE', 'EFT', 'KREDI KARTI');
    `);

    if (paraRes.recordset && paraRes.recordset.length > 0) {
      const row = paraRes.recordset[0];
      const isGram = Number(row.URUN_TIPI) === 0;
      return {
        altinUrunId: null,
        barkod: "",
        grupKodu: "",
        urunNo: 0,
        urunAdi: (row.AD || row.KOD).trim(),
        ayar: (row.KOD || "").trim(),
        miktar: 1,
        birim: isGram ? "Gram" : "Adet",
        gram: isGram ? 1 : 0,
        hasGram: Number(row.HAS_ORANI) || 0,
        satisFiyati: 0,
        satisParaKodu: "TL",
        satildi: false,
        isBarkodlu: false,
      };
    }

    throw ApiError.notFound(`'${cleanBarcode}' kod veya barkoduna ait ürün veya para tanımı bulunamadı.`);
  }

  /**
   * Creates or updates an invoice with SODVZ_NUMERATOR_URET, detail lines, and stock update
   */
  public static async createInvoice(
    dto: CreateFaturaDto,
    userId?: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<FaturaModel> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureTablesAndProcedures(pool);

    // Validation
    if (!dto.satirlar || dto.satirlar.length === 0) {
      throw ApiError.badRequest("Faturada en az 1 adet ürün satırı bulunmalıdır.");
    }

    const cleanVkn = (dto.aliciVknTckn || "11111111111").replace(/\D/g, "");
    const cleanUnvan = (dto.aliciUnvan || "NİHAİ TÜKETİCİ").trim();
    let faturaNo = dto.faturaNo?.trim() || "";

    const vezneId = dto.vezneId || 1;
    const faturaTipi = dto.faturaTipi ?? 1; // 1: Satış, 2: İade
    const senaryo = dto.senaryo?.trim() || "EARSIVFATURA";
    const paraId = dto.paraId || 1;
    const kur = dto.kur && dto.kur > 0 ? dto.kur : 1.0;

    const iskontoId = dto.iskontoId || null;
    const iskontoKodu = dto.iskontoKodu ? dto.iskontoKodu.trim() : null;
    const iskontoOrani = Number(dto.iskontoOrani) || 0;
    let iskontoTutari = Number(dto.iskontoTutari) || 0;

    let araToplam = 0;
    let toplamKdv = 0;

    dto.satirlar.forEach((s) => {
      const m = Number(s.miktar) || 1;
      const f = Number(s.birimFiyat) || 0;
      const kdvRate = Number(s.kdvOrani) || 0;
      const tutar = Math.round(m * f * 100) / 100;
      const kdvTutari = Math.round(tutar * (kdvRate / 100) * 100) / 100;
      araToplam += tutar;
      toplamKdv += kdvTutari;
    });

    if (iskontoOrani > 0 && iskontoTutari === 0) {
      iskontoTutari = Math.round(((araToplam + toplamKdv) * (iskontoOrani / 100)) * 100) / 100;
    }

    const brutToplam = araToplam + toplamKdv;
    const genelToplam = Math.max(0, Math.round((brutToplam - iskontoTutari) * 100) / 100);

    let outFaturaId: number = 0;
    let finalFaturaNo: string = faturaNo;

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const req = new sql.Request(transaction);

      // 1. Numerator Generation & Collision Resolution for both new records and scenario changes
      req.input("IN_FATURA_ID", sql.Int, dto.faturaId || 0);
      req.input("IN_FATURA_NO", sql.VarChar(50), faturaNo || null);
      req.input("IN_SENARYO", sql.VarChar(50), senaryo);

      const numGenQuery = `
        DECLARE @CURRENT_FID INT = @IN_FATURA_ID;
        DECLARE @GEN_NO VARCHAR(50) = @IN_FATURA_NO;
        DECLARE @PREFIX_KEY VARCHAR(10) = CASE WHEN @IN_SENARYO = 'EARSIVFATURA' THEN 'EAR' ELSE 'GIB' END;
        DECLARE @TARGET_TUR INT = CASE WHEN @IN_SENARYO = 'EARSIVFATURA' THEN 26 ELSE 24 END;
        DECLARE @ONEK VARCHAR(20) = NULL;
        DECLARE @ONUNE_SIFIR BIT = 1;
        DECLARE @SAYAC INT = 1;
        DECLARE @UZUNLUK INT = 16;
        DECLARE @YAZICI_ID INT = NULL;

        IF OBJECT_ID('dbo.TODVZ_NUMERATOR') IS NOT NULL
        BEGIN
          SELECT TOP 1 
            @TARGET_TUR = TUR, 
            @YAZICI_ID = YAZICI_ID,
            @ONEK = ONEK,
            @SAYAC = BASLANGIC,
            @UZUNLUK = UZUNLUK,
            @ONUNE_SIFIR = ONUNE_SIFIR_KOY
          FROM dbo.TODVZ_NUMERATOR
          WHERE (ONEK LIKE @PREFIX_KEY + '%' OR TUR = @TARGET_TUR OR (@PREFIX_KEY = 'GIB' AND TUR IN (24, 25)) OR (@PREFIX_KEY = 'EAR' AND TUR = 26))
          ORDER BY 
            CASE 
              WHEN ONEK LIKE @PREFIX_KEY + '%' THEN 0 
              WHEN TUR = @TARGET_TUR THEN 1 
              ELSE 2 
            END,
            CASE WHEN YAZICI_ID IS NOT NULL THEN 0 ELSE 1 END;
        END;

        IF @ONEK IS NULL OR LEN(LTRIM(RTRIM(@ONEK))) = 0 OR @ONEK NOT LIKE @PREFIX_KEY + '%'
        BEGIN
          SET @ONEK = @PREFIX_KEY + CAST(YEAR(GETDATE()) AS VARCHAR(4));
        END;

        IF @UZUNLUK IS NULL OR @UZUNLUK < 2 SET @UZUNLUK = 16;
        IF @SAYAC IS NULL OR @SAYAC < 1 SET @SAYAC = 1;

        DECLARE @SAYAC_BOYU INT = @UZUNLUK - LEN(@ONEK);
        IF @SAYAC_BOYU < 2 SET @SAYAC_BOYU = 2;

        -- Check if @GEN_NO is empty, or if it collides with ANOTHER invoice record:
        DECLARE @IS_COLLISION BIT = 0;
        IF (@GEN_NO IS NULL OR LEN(LTRIM(RTRIM(@GEN_NO))) = 0)
        BEGIN
          SET @IS_COLLISION = 1;
        END
        ELSE IF EXISTS(SELECT 1 FROM dbo.TODVZ_FATURA WHERE FATURA_NO = @GEN_NO AND (@CURRENT_FID = 0 OR FATURA_ID <> @CURRENT_FID))
        BEGIN
          SET @IS_COLLISION = 1;
        END;

        IF @IS_COLLISION = 1
        BEGIN
          -- Find next guaranteed unused sequence number for this prefix
          DECLARE @EXISTS BIT = 1;
          WHILE @EXISTS = 1
          BEGIN
            DECLARE @NUM_S VARCHAR(20) = STR(@SAYAC, @SAYAC_BOYU, 0);
            IF @ONUNE_SIFIR = 1 SET @NUM_S = REPLACE(@NUM_S, ' ', '0');
            SET @GEN_NO = RTRIM(@ONEK) + LTRIM(@NUM_S);

            IF EXISTS (SELECT 1 FROM dbo.TODVZ_FATURA WHERE FATURA_NO = @GEN_NO AND (@CURRENT_FID = 0 OR FATURA_ID <> @CURRENT_FID))
            BEGIN
              SET @SAYAC = @SAYAC + 1;
            END
            ELSE
            BEGIN
              SET @EXISTS = 0;
            END;
          END;

          -- Advance numerator in TODVZ_NUMERATOR so next call gets @SAYAC + 1
          IF OBJECT_ID('dbo.TODVZ_NUMERATOR') IS NOT NULL
          BEGIN
            UPDATE dbo.TODVZ_NUMERATOR 
            SET BASLANGIC = @SAYAC + 1
            WHERE TUR = @TARGET_TUR;
          END;
        END
        ELSE
        BEGIN
          -- Caller gave a clean number: if it matches the current counter, advance counter by 1
          IF OBJECT_ID('dbo.TODVZ_NUMERATOR') IS NOT NULL
          BEGIN
            UPDATE dbo.TODVZ_NUMERATOR 
            SET BASLANGIC = BASLANGIC + 1
            WHERE TUR = @TARGET_TUR AND @GEN_NO = RTRIM(@ONEK) + LTRIM(REPLACE(STR(@SAYAC, @SAYAC_BOYU, 0), ' ', '0'));
          END;
        END;

        SELECT @GEN_NO AS GENERATED_FATURA_NO;
      `;

      const numRes = await req.query(numGenQuery);
      if (numRes.recordset && numRes.recordset[0]?.GENERATED_FATURA_NO) {
        finalFaturaNo = numRes.recordset[0].GENERATED_FATURA_NO.trim();
      }

      if (!finalFaturaNo) {
        const year = new Date().getFullYear();
        const pfx = senaryo === "EARSIVFATURA" ? "EAR" : "GIB";
        finalFaturaNo = `${pfx}${year}000000001`;
      }

      // 1.b Düzeltme: faturanın eski vezne etkisi (barkodsuz satırlar + vezneden tahsilat) başlık güncellenmeden, eski vezne / tiple geri alınır
      if (dto.faturaId && dto.faturaId > 0) {
        await new sql.Request(transaction).input("FID", sql.Int, dto.faturaId).query(PERAKENDE_VEZNE_GERI_AL);
      }

      // 2. Insert or Update Header (TODVZ_FATURA)
      const saveHeadReq = new sql.Request(transaction);
      saveHeadReq.input("FATURA_ID", sql.Int, dto.faturaId || 0);
      saveHeadReq.input("VEZNE_ID", sql.Int, vezneId);
      saveHeadReq.input("FATURA_NO", sql.VarChar(50), finalFaturaNo);
      saveHeadReq.input("ETTN", sql.UniqueIdentifier, dto.ettn || null);
      saveHeadReq.input("TARIH", sql.DateTime, dto.tarih ? new Date(dto.tarih) : new Date());
      saveHeadReq.input("FATURA_TIPI", sql.TinyInt, faturaTipi);
      saveHeadReq.input("SENARYO", sql.VarChar(50), senaryo);
      saveHeadReq.input("CARI_KART_ID", sql.Int, dto.cariKartId || null);
      saveHeadReq.input("ALICI_VKN_TCKN", sql.VarChar(50), cleanVkn);
      saveHeadReq.input("ALICI_UNVAN", sql.VarChar(250), cleanUnvan);
      saveHeadReq.input("ADRES", sql.VarChar(500), dto.adres || null);
      saveHeadReq.input("ILCE", sql.VarChar(100), dto.ilce || null);
      saveHeadReq.input("IL", sql.VarChar(100), dto.il || null);
      saveHeadReq.input("VERGI_DAIRESI", sql.VarChar(100), dto.vergiDairesi || null);
      saveHeadReq.input("EPOSTA", sql.VarChar(100), dto.eposta || null);
      saveHeadReq.input("TELEFON", sql.VarChar(50), dto.telefon || null);
      saveHeadReq.input("PARA_ID", sql.Int, paraId);
      saveHeadReq.input("KUR", sql.Float, kur);
      saveHeadReq.input("ARA_TOPLAM", sql.Float, araToplam);
      saveHeadReq.input("TOPLAM_KDV", sql.Float, toplamKdv);
      saveHeadReq.input("ISKONTO_ID", sql.Int, iskontoId);
      saveHeadReq.input("ISKONTO_KODU", sql.VarChar(50), iskontoKodu);
      saveHeadReq.input("ISKONTO_ORANI", sql.Float, iskontoOrani);
      saveHeadReq.input("ISKONTO_TUTARI", sql.Float, iskontoTutari);
      saveHeadReq.input("GENEL_TOPLAM", sql.Float, genelToplam);
      saveHeadReq.input("KULLANICI_ID", sql.Int, userId || null);

      const headQuery = `
        DECLARE @OUT_ID INT = @FATURA_ID;

        IF (@OUT_ID IS NULL OR @OUT_ID = 0)
        BEGIN
          INSERT INTO dbo.TODVZ_FATURA (
            VEZNE_ID, FATURA_NO, ETTN, TARIH, FATURA_TIPI, SENARYO,
            CARI_KART_ID, ALICI_VKN_TCKN, ALICI_UNVAN, ADRES, ILCE, IL,
            VERGI_DAIRESI, EPOSTA, TELEFON, PARA_ID, KUR,
            ARA_TOPLAM, TOPLAM_KDV, ISKONTO_ID, ISKONTO_KODU, ISKONTO_ORANI, ISKONTO_TUTARI, GENEL_TOPLAM,
            E_BELGE_DURUMU, EKLEYEN_ID, EKLEME_ZAMANI
          )
          OUTPUT INSERTED.FATURA_ID
          VALUES (
            @VEZNE_ID, @FATURA_NO, ISNULL(@ETTN, NEWID()), ISNULL(@TARIH, GETDATE()), @FATURA_TIPI, @SENARYO,
            @CARI_KART_ID, @ALICI_VKN_TCKN, @ALICI_UNVAN, @ADRES, @ILCE, @IL,
            @VERGI_DAIRESI, @EPOSTA, @TELEFON, @PARA_ID, @KUR,
            @ARA_TOPLAM, @TOPLAM_KDV, @ISKONTO_ID, @ISKONTO_KODU, @ISKONTO_ORANI, @ISKONTO_TUTARI, @GENEL_TOPLAM,
            0, @KULLANICI_ID, GETDATE()
          );
        END
        ELSE
        BEGIN
          UPDATE dbo.TODVZ_FATURA
          SET VEZNE_ID          = @VEZNE_ID,
              FATURA_NO         = @FATURA_NO,
              TARIH             = ISNULL(@TARIH, GETDATE()),
              FATURA_TIPI       = @FATURA_TIPI,
              SENARYO           = @SENARYO,
              CARI_KART_ID      = @CARI_KART_ID,
              ALICI_VKN_TCKN    = @ALICI_VKN_TCKN,
              ALICI_UNVAN       = @ALICI_UNVAN,
              ADRES             = @ADRES,
              ILCE              = @ILCE,
              IL                = @IL,
              VERGI_DAIRESI     = @VERGI_DAIRESI,
              EPOSTA            = @EPOSTA,
              TELEFON           = @TELEFON,
              PARA_ID           = @PARA_ID,
              KUR               = @KUR,
              ARA_TOPLAM        = @ARA_TOPLAM,
              TOPLAM_KDV        = @TOPLAM_KDV,
              ISKONTO_ID        = @ISKONTO_ID,
              ISKONTO_KODU      = @ISKONTO_KODU,
              ISKONTO_ORANI     = @ISKONTO_ORANI,
              ISKONTO_TUTARI    = @ISKONTO_TUTARI,
              GENEL_TOPLAM      = @GENEL_TOPLAM,
              GUNCELLEYEN_ID    = @KULLANICI_ID,
              GUNCELLEME_ZAMANI = GETDATE()
          WHERE FATURA_ID = @OUT_ID;

          SELECT @OUT_ID AS FATURA_ID;
        END;
      `;

      const headResult = await saveHeadReq.query(headQuery);
      if (headResult.recordset && headResult.recordset[0]?.FATURA_ID) {
        outFaturaId = Number(headResult.recordset[0].FATURA_ID);
      }

      if (!outFaturaId || outFaturaId === 0) {
        throw new Error("Fatura başlığı oluşturulamadı.");
      }

      // 3. Clear lines if updating and revert previous stocks
      if (dto.faturaId && dto.faturaId > 0) {
        const revertReq = new sql.Request(transaction);
        revertReq.input("FATURA_ID", sql.Int, outFaturaId);
        await revertReq.query(`
          -- Revert previous barcode products
          IF OBJECT_ID('dbo.TODVZ_ALTIN_URUN') IS NOT NULL
          BEGIN
            UPDATE u
            SET u.SATILDI = 0, u.GUNCELLEME_ZAMANI = GETDATE()
            FROM dbo.TODVZ_ALTIN_URUN u
            INNER JOIN dbo.TODVZ_FATURA_SATIRI s ON u.ALTIN_URUN_ID = s.ALTIN_URUN_ID OR (s.BARKOD IS NOT NULL AND u.BARKOD = s.BARKOD)
            WHERE s.FATURA_ID = @FATURA_ID;
          END;

          IF OBJECT_ID('dbo.TODVZ_OZEL_URUN') IS NOT NULL
          BEGIN
            UPDATE u
            SET u.SATILDI = 0, u.GUNCELLEME_ZAMANI = GETDATE()
            FROM dbo.TODVZ_OZEL_URUN u
            INNER JOIN dbo.TODVZ_FATURA_SATIRI s ON (s.BARKOD IS NOT NULL AND u.BARKOD = s.BARKOD)
            WHERE s.FATURA_ID = @FATURA_ID;
          END;

          -- Barkodsuz satırların ve tahsilatın vezne etkisi başlık güncellenmeden önce geri alındı (1.b)

          DELETE FROM dbo.TODVZ_FATURA_SATIRI WHERE FATURA_ID = @FATURA_ID;
        `);
      }

      // 4. Insert Detail Lines (TODVZ_FATURA_SATIRI)
      if (dto.satirlar && dto.satirlar.length > 0) {
        for (let i = 0; i < dto.satirlar.length; i++) {
          const row = dto.satirlar[i];
          const satirNo = i + 1;
          const lineReq = new sql.Request(transaction);

          const m = Number(row.miktar) || 1;
          const f = Number(row.birimFiyat) || 0;
          const kdvRate = Number(row.kdvOrani) || 0;
          const tutar = Math.round(m * f * 100) / 100;
          const kdvTutari = Math.round(tutar * (kdvRate / 100) * 100) / 100;
          const toplamTutar = Math.round((tutar + kdvTutari) * 100) / 100;
          const gramVal = Number(row.gram) || 0;
          const hasGramVal = Number(row.hasGram) || 0;
          const cleanBarkod = (row.barkod || "").trim() || null;
          const isBarkodlu = Boolean(row.altinUrunId || cleanBarkod);

          lineReq.input("FATURA_ID", sql.Int, outFaturaId);
          lineReq.input("VEZNE_ID", sql.Int, vezneId);
          lineReq.input("FATURA_TIPI", sql.TinyInt, faturaTipi);
          lineReq.input("SATIR_NO", sql.Int, satirNo);
          lineReq.input("ALTIN_URUN_ID", sql.Int, row.altinUrunId || null);
          lineReq.input("BARKOD", sql.VarChar(50), cleanBarkod);
          lineReq.input("URUN_ADI", sql.VarChar(200), (row.urunAdi || "Altın Ürün").trim());
          lineReq.input("AYAR", sql.VarChar(50), (row.ayar || "").trim() || null);
          lineReq.input("MIKTAR", sql.Float, m);
          lineReq.input("BIRIM", sql.VarChar(20), (row.birim || "Adet").trim());
          lineReq.input("GRAM", sql.Float, gramVal);
          lineReq.input("HAS_GRAM", sql.Float, hasGramVal);
          lineReq.input("BIRIM_FIYAT", sql.Float, f);
          lineReq.input("TUTAR", sql.Float, tutar);
          lineReq.input("KDV_ORANI", sql.Float, kdvRate);
          lineReq.input("KDV_TUTARI", sql.Float, kdvTutari);
          lineReq.input("TOPLAM_TUTAR", sql.Float, toplamTutar);
          lineReq.input("IS_BARKODLU", sql.Bit, isBarkodlu ? 1 : 0);
          lineReq.input("STOK_MIKTAR", sql.Float, gramVal > 0 ? gramVal : m);

          const lineInsertQuery = `
            INSERT INTO dbo.TODVZ_FATURA_SATIRI (
              FATURA_ID, SATIR_NO, ALTIN_URUN_ID, BARKOD, URUN_ADI,
              AYAR, MIKTAR, BIRIM, GRAM, HAS_GRAM,
              BIRIM_FIYAT, TUTAR, KDV_ORANI, KDV_TUTARI, TOPLAM_TUTAR
            )
            VALUES (
              @FATURA_ID, @SATIR_NO, @ALTIN_URUN_ID, @BARKOD, @URUN_ADI,
              @AYAR, @MIKTAR, @BIRIM, @GRAM, @HAS_GRAM,
              @BIRIM_FIYAT, @TUTAR, @KDV_ORANI, @KDV_TUTARI, @TOPLAM_TUTAR
            );

            -- 1. Barkodlu ürün durumu (TODVZ_ALTIN_URUN & TODVZ_OZEL_URUN)
            IF (@IS_BARKODLU = 1)
            BEGIN
              DECLARE @NEW_SATILDI BIT = CASE WHEN @FATURA_TIPI = 1 THEN 1 ELSE 0 END;

              IF OBJECT_ID('dbo.TODVZ_ALTIN_URUN') IS NOT NULL
              BEGIN
                IF (@ALTIN_URUN_ID IS NOT NULL AND @ALTIN_URUN_ID > 0)
                  UPDATE dbo.TODVZ_ALTIN_URUN SET SATILDI = @NEW_SATILDI, GUNCELLEME_ZAMANI = GETDATE() WHERE ALTIN_URUN_ID = @ALTIN_URUN_ID;
                ELSE IF (@BARKOD IS NOT NULL AND LEN(LTRIM(RTRIM(@BARKOD))) > 0)
                  UPDATE dbo.TODVZ_ALTIN_URUN SET SATILDI = @NEW_SATILDI, GUNCELLEME_ZAMANI = GETDATE() WHERE BARKOD = @BARKOD;
              END;

              IF OBJECT_ID('dbo.TODVZ_OZEL_URUN') IS NOT NULL
              BEGIN
                IF (@BARKOD IS NOT NULL AND LEN(LTRIM(RTRIM(@BARKOD))) > 0)
                  UPDATE dbo.TODVZ_OZEL_URUN SET SATILDI = @NEW_SATILDI, GUNCELLEME_ZAMANI = GETDATE() WHERE BARKOD = @BARKOD;
              END;
            END
            ELSE
            BEGIN
              -- 2. Barkodsuz ürün / Para Tablosu Maddesi (USD, EUR, ÇEY, 22, 14, 18, 24, HAS vb.)
              IF (@VEZNE_ID IS NOT NULL AND @VEZNE_ID > 0 AND @STOK_MIKTAR > 0)
              BEGIN
                DECLARE @LINE_P_ID INT = NULL;
                DECLARE @CLEAN_AY VARCHAR(50) = UPPER(LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(ISNULL(@AYAR, ''), ' AYAR', ''), 'AYAR', ''), ' ', ''))));
                DECLARE @CLEAN_NM VARCHAR(100) = UPPER(LTRIM(RTRIM(ISNULL(@URUN_ADI, ''))));

                SELECT TOP 1 @LINE_P_ID = PARA_ID FROM dbo.TODVZ_PARA 
                WHERE UPPER(LTRIM(RTRIM(KOD))) = UPPER(LTRIM(RTRIM(@AYAR)))
                   OR UPPER(LTRIM(RTRIM(KOD))) = @CLEAN_AY
                   OR UPPER(LTRIM(RTRIM(KOD))) = @CLEAN_NM
                   OR UPPER(LTRIM(RTRIM(AD))) = @CLEAN_NM;

                IF @LINE_P_ID IS NULL
                BEGIN
                  SELECT TOP 1 @LINE_P_ID = PARA_ID FROM dbo.TODVZ_PARA 
                  WHERE (UPPER(LTRIM(RTRIM(AD))) = @CLEAN_AY + ' AYAR'
                     OR UPPER(LTRIM(RTRIM(AD))) = @CLEAN_AY + ' AYAR ALTIN'
                     OR UPPER(LTRIM(RTRIM(AD))) = @CLEAN_AY);
                END;

                IF @LINE_P_ID IS NOT NULL
                BEGIN
                  -- Adet birimli üründe (TODVZ_PARA.BIRIM 0) stok adetle düşer (sarraf fişiyle aynı); diğerlerinde gram, yoksa miktar (rapor denetimi 01.10.2026 —
                  -- önceden 2 çeyreklik satırda birim gramajı düşüyordu). Düşen para ve miktar satırda saklanır.
                  IF (SELECT BIRIM FROM dbo.TODVZ_PARA WHERE PARA_ID = @LINE_P_ID) = 0 SET @STOK_MIKTAR = @MIKTAR;
                  UPDATE dbo.TODVZ_FATURA_SATIRI SET STOK_PARA_ID = @LINE_P_ID, STOK_MIKTAR = @STOK_MIKTAR WHERE FATURA_ID = @FATURA_ID AND SATIR_NO = @SATIR_NO;
                  DECLARE @DIFF_STK FLOAT = CASE WHEN @FATURA_TIPI = 1 THEN -@STOK_MIKTAR ELSE @STOK_MIKTAR END;
                  IF EXISTS (SELECT 1 FROM dbo.TODVZ_VEZNE_BAKIYE WHERE VEZNE_ID = @VEZNE_ID AND PARA_ID = @LINE_P_ID)
                    UPDATE dbo.TODVZ_VEZNE_BAKIYE SET MIKTAR = MIKTAR + @DIFF_STK WHERE VEZNE_ID = @VEZNE_ID AND PARA_ID = @LINE_P_ID;
                  ELSE
                    INSERT INTO dbo.TODVZ_VEZNE_BAKIYE (VEZNE_ID, PARA_ID, MIKTAR) VALUES (@VEZNE_ID, @LINE_P_ID, @DIFF_STK);
                END;
              END;
            END;
          `;

          await lineReq.query(lineInsertQuery);
        }
      }

      // 4.b Insert Payment rows (ODEMELER)
      const odemeDelReq = new sql.Request(transaction);
      odemeDelReq.input("FATURA_ID", sql.Int, outFaturaId);
      await odemeDelReq.query(`
        IF OBJECT_ID('dbo.TODVZ_FATURA_ODEME', 'U') IS NOT NULL
        BEGIN
          DELETE FROM dbo.TODVZ_FATURA_ODEME WHERE FATURA_ID = @FATURA_ID;
        END;
      `);

      if (dto.odemeler && dto.odemeler.length > 0) {
        let odemeIdx = 1;
        for (const oRow of dto.odemeler) {
          const t = Number(oRow.tutar) || 0;
          const k = Number(oRow.kur) || 1;
          const paraKod = (oRow.paraKodu || "").trim();
          if (!paraKod && t === 0 && !oRow.cariKod) continue;

          const odemeReq = new sql.Request(transaction);
          const oat = Number(oRow.odemeAraciTuru) || 0;
          let iy = oat === 1 ? 1 : (oat === 2 ? 3 : (oat === 3 ? 2 : (oRow.islemeYeri != null ? Number(oRow.islemeYeri) : 0)));
          const posCihaziId = oat === 2 ? (oRow.posCihaziId || oRow.cariKartId || null) : null;
          const cariKartId = (oat === 1 || oat === 3) ? (oRow.cariKartId || null) : null;
          const cariKod = (oRow.cariKod || "").trim();
          const cariUnvan = (oRow.cariUnvan || "").trim();

          odemeReq.input("ODEME_ARACI_TURU", sql.TinyInt, oat);
          odemeReq.input("ISLEME_YERI", sql.TinyInt, iy);
          odemeReq.input("CARI_KART_ID", sql.Int, cariKartId || null);
          odemeReq.input("POS_CIHAZI_ID", sql.Int, posCihaziId || null);
          odemeReq.input("CARI_KOD", sql.VarChar(50), cariKod || null);
          odemeReq.input("CARI_UNVAN", sql.VarChar(250), cariUnvan || null);
          odemeReq.input("FATURA_ID", sql.Int, outFaturaId);
          odemeReq.input("SATIR_NO", sql.Int, oRow.satirNo || odemeIdx++);
          odemeReq.input("PARA_ID", sql.Int, oRow.paraId || null);
          odemeReq.input("PARA_KODU", sql.VarChar(50), paraKod || "TL");
          odemeReq.input("PARA_ADI", sql.VarChar(100), (oRow.paraAdi || "").trim());
          odemeReq.input("ADET", sql.Float, oRow.adet !== undefined && oRow.adet !== null && !isNaN(Number(oRow.adet)) ? Number(oRow.adet) : null);
          odemeReq.input("MIKTAR", sql.Float, oRow.miktar !== undefined && oRow.miktar !== null && !isNaN(Number(oRow.miktar)) ? Number(oRow.miktar) : null);
          odemeReq.input("MILYEM", sql.Float, oRow.milyem !== undefined && oRow.milyem !== null && !isNaN(Number(oRow.milyem)) ? Number(oRow.milyem) : null);
          odemeReq.input("HAS_GRAM", sql.Float, oRow.hasGram !== undefined && oRow.hasGram !== null && !isNaN(Number(oRow.hasGram)) ? Number(oRow.hasGram) : null);
          odemeReq.input("KUR", sql.Float, k > 0 ? k : 1);
          odemeReq.input("TUTAR", sql.Float, t);

          await odemeReq.query(`
            INSERT INTO dbo.TODVZ_FATURA_ODEME (
              FATURA_ID, SATIR_NO, ODEME_ARACI_TURU, ISLEME_YERI, CARI_KART_ID, POS_CIHAZI_ID, CARI_KOD, CARI_UNVAN,
              PARA_ID, PARA_KODU, PARA_ADI,
              ADET, MIKTAR, MILYEM, HAS_GRAM, KUR, TUTAR
            )
            VALUES (
              @FATURA_ID, @SATIR_NO, @ODEME_ARACI_TURU, @ISLEME_YERI, @CARI_KART_ID,
              COALESCE(@POS_CIHAZI_ID, (SELECT TOP 1 POS_CIHAZI_ID FROM dbo.TODVZ_POS_CIHAZI WHERE UPPER(LTRIM(RTRIM(KOD))) = UPPER(@CARI_KOD)), NULL),
              @CARI_KOD, @CARI_UNVAN,
              COALESCE(@PARA_ID, (SELECT TOP 1 PARA_ID FROM TODVZ_PARA WHERE UPPER(LTRIM(RTRIM(KOD))) = UPPER(@PARA_KODU)), 1),
              @PARA_KODU, @PARA_ADI,
              @ADET, @MIKTAR, @MILYEM, @HAS_GRAM, @KUR, @TUTAR
            );
          `);
        }
      }

      // 4.c Vezneden tahsilat (ödeme aracı vezne, işleme yeri vezne, geçerli para): satışta veznede giriş, alışta çıkış — vezne bakiyesine işlenir ve işaretlenir
      // (rapor denetimi 01.10.2026 — önceden hiçbir tahsilat vezneye yazılmıyordu; anlık vezne bakiyesi raporlardan sapıyordu)
      await new sql.Request(transaction).input("FID", sql.Int, outFaturaId).query(`
        DECLARE @TV INT, @TT INT;
        SELECT @TV = VEZNE_ID, @TT = FATURA_TIPI FROM dbo.TODVZ_FATURA WHERE FATURA_ID = @FID;
        IF @TV IS NOT NULL AND @TV > 0
        BEGIN
          UPDATE O SET VEZNE_ISLENDI = 1 FROM dbo.TODVZ_FATURA_ODEME O JOIN dbo.TODVZ_PARA P ON P.PARA_ID = O.PARA_ID
            WHERE O.FATURA_ID = @FID AND ISNULL(O.ODEME_ARACI_TURU, 0) = 0 AND ISNULL(O.ISLEME_YERI, 0) = 0 AND ISNULL(NULLIF(O.MIKTAR, 0), O.TUTAR / NULLIF(O.KUR, 0)) <> 0;
          DECLARE @TE TABLE (PARA_ID INT, M FLOAT);
          INSERT INTO @TE (PARA_ID, M)
            SELECT O.PARA_ID, SUM(CASE WHEN @TT = 1 THEN 1 ELSE -1 END * ISNULL(NULLIF(O.MIKTAR, 0), O.TUTAR / NULLIF(O.KUR, 0)))
            FROM dbo.TODVZ_FATURA_ODEME O WHERE O.FATURA_ID = @FID AND ISNULL(O.VEZNE_ISLENDI, 0) = 1 GROUP BY O.PARA_ID;
          UPDATE B SET MIKTAR = B.MIKTAR + E.M FROM dbo.TODVZ_VEZNE_BAKIYE B JOIN @TE E ON E.PARA_ID = B.PARA_ID WHERE B.VEZNE_ID = @TV;
          INSERT INTO dbo.TODVZ_VEZNE_BAKIYE (VEZNE_ID, PARA_ID, MIKTAR)
            SELECT @TV, E.PARA_ID, E.M FROM @TE E WHERE NOT EXISTS (SELECT 1 FROM dbo.TODVZ_VEZNE_BAKIYE B WHERE B.VEZNE_ID = @TV AND B.PARA_ID = E.PARA_ID);
        END;
      `);

      // 5. Update header summary amounts from lines taking stored discount into account
      const summaryReq = new sql.Request(transaction);
      summaryReq.input("FATURA_ID", sql.Int, outFaturaId);
      await summaryReq.query(`
        UPDATE dbo.TODVZ_FATURA
        SET ARA_TOPLAM   = ISNULL((SELECT SUM(TUTAR) FROM dbo.TODVZ_FATURA_SATIRI WHERE FATURA_ID = @FATURA_ID), 0),
            TOPLAM_KDV   = ISNULL((SELECT SUM(KDV_TUTARI) FROM dbo.TODVZ_FATURA_SATIRI WHERE FATURA_ID = @FATURA_ID), 0),
            GENEL_TOPLAM = CASE 
              WHEN (ISNULL((SELECT SUM(TOPLAM_TUTAR) FROM dbo.TODVZ_FATURA_SATIRI WHERE FATURA_ID = @FATURA_ID), 0) - ISNULL(ISKONTO_TUTARI, 0)) < 0 THEN 0
              ELSE (ISNULL((SELECT SUM(TOPLAM_TUTAR) FROM dbo.TODVZ_FATURA_SATIRI WHERE FATURA_ID = @FATURA_ID), 0) - ISNULL(ISKONTO_TUTARI, 0))
            END
        WHERE FATURA_ID = @FATURA_ID;

        -- İşçilik Hareketini TODVZ_HESAP_HAREKETI tablosuna işleme (Firma Tanımlarındaki ISCILIK_HESABI)
        DECLARE @ISCILIK_HESAP_KODU VARCHAR(50) = NULL;
        DECLARE @TARGET_ISCILIK_HESAP_ID INT = NULL;
        
        SELECT TOP 1 @ISCILIK_HESAP_KODU = LTRIM(RTRIM(ISCILIK_HESABI))
        FROM [dbo].[TODVZ_TANIM] WITH (NOLOCK);

        IF (@ISCILIK_HESAP_KODU IS NOT NULL AND LEN(@ISCILIK_HESAP_KODU) > 0)
        BEGIN
          SELECT TOP 1 @TARGET_ISCILIK_HESAP_ID = HESAP_ID 
          FROM [dbo].[TODVZ_HESAP] WITH (NOLOCK) 
          WHERE UPPER(LTRIM(RTRIM(KOD))) = UPPER(@ISCILIK_HESAP_KODU) 
             OR UPPER(LTRIM(RTRIM(AD))) = UPPER(@ISCILIK_HESAP_KODU)
             OR (ISNUMERIC(@ISCILIK_HESAP_KODU) = 1 AND HESAP_ID = CAST(@ISCILIK_HESAP_KODU AS INT));
        END;

        IF (@TARGET_ISCILIK_HESAP_ID IS NOT NULL)
        BEGIN
          DECLARE @F_NO VARCHAR(50);
          DECLARE @F_TARIH DATETIME;
          DECLARE @F_TIP TINYINT;
          DECLARE @F_VEZNE INT;
          DECLARE @F_EKLEYEN INT;
          DECLARE @F_KDV_ORANI FLOAT;
          DECLARE @F_KDV_TUTAR FLOAT;
          DECLARE @F_ARA_TOPLAM FLOAT;

          SELECT 
            @F_NO = FATURA_NO,
            @F_TARIH = TARIH,
            @F_TIP = FATURA_TIPI,
            @F_VEZNE = VEZNE_ID,
            @F_EKLEYEN = EKLEYEN_ID,
            @F_KDV_TUTAR = TOPLAM_KDV,
            @F_ARA_TOPLAM = ARA_TOPLAM
          FROM dbo.TODVZ_FATURA 
          WHERE FATURA_ID = @FATURA_ID;

          DELETE FROM [dbo].[TODVZ_HESAP_HAREKETI] 
          WHERE ACIKLAMA LIKE '%Perakende Fişi İşçilik%' AND ACIKLAMA LIKE '%' + LTRIM(RTRIM(@F_NO)) + '%';

          IF (@F_ARA_TOPLAM > 0)
          BEGIN
            DECLARE @HH_ACIKLAMA VARCHAR(200) = 'Perakende Fişi İşçilik - Fatura No: ' + LTRIM(RTRIM(@F_NO));
            DECLARE @HH_TIP TINYINT = CASE WHEN @F_TIP = 1 THEN 0 ELSE 1 END; -- Satış: 0 (Gelir Girişi), İade: 1 (Çıkış)
            
            INSERT INTO [dbo].[TODVZ_HESAP_HAREKETI] (
              HESAP_ID, TARIH, ACIKLAMA, PARA_ID, MEBLAG, KDV_ORANI, KDV, TIP, VEZNE_ID,
              EKLEYEN_ID, EKLEME_ZAMANI, GUNCELLEYEN_ID, GUNCELLEME_ZAMANI
            ) VALUES (
              @TARGET_ISCILIK_HESAP_ID, @F_TARIH, @HH_ACIKLAMA, 1, @F_ARA_TOPLAM, 
              0, ISNULL(@F_KDV_TUTAR, 0), @HH_TIP, @F_VEZNE,
              @F_EKLEYEN, GETDATE(), @F_EKLEYEN, GETDATE()
            );
          END;
        END;
      `);

      await transaction.commit();

      const result = await this.getInvoiceById(outFaturaId, dbContext);
      if (!result) throw new Error("Oluşturulan fatura getirilemedi.");
      return result;
    } catch (err: any) {
      await transaction.rollback().catch(() => {});
      const detailedMessage =
        err.originalError?.info?.message || err.originalError?.message || err.message || "Fatura kaydedilemedi.";
      logger.error("PerakendeSqlRepository.createInvoice error:", {
        message: detailedMessage,
        stack: err.stack,
      });
      throw ApiError.badRequest(`Fatura Kayıt Hatası: ${detailedMessage}`);
    }
  }

  /**
   * Get invoice header and line items by ID
   */
  public static async getInvoiceById(
    faturaId: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<FaturaModel | null> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureTablesAndProcedures(pool);

    const headReq = pool.request();
    headReq.input("FATURA_ID", sql.Int, faturaId);

    const headRes = await headReq.query(`
      SELECT 
        f.[FATURA_ID], f.[VEZNE_ID], f.[FATURA_NO], f.[ETTN], f.[TARIH],
        f.[FATURA_TIPI], f.[SENARYO], f.[CARI_KART_ID], f.[ALICI_VKN_TCKN],
        f.[ALICI_UNVAN], f.[ADRES], f.[ILCE], f.[IL], f.[VERGI_DAIRESI],
        f.[EPOSTA], f.[TELEFON], f.[PARA_ID], f.[KUR], f.[ARA_TOPLAM],
        f.[TOPLAM_KDV],
        ISNULL(f.[ISKONTO_ID], NULL) AS [ISKONTO_ID],
        ISNULL(f.[ISKONTO_KODU], '') AS [ISKONTO_KODU],
        ISNULL(f.[ISKONTO_ORANI], 0) AS [ISKONTO_ORANI],
        ISNULL(f.[ISKONTO_TUTARI], 0) AS [ISKONTO_TUTARI],
        f.[GENEL_TOPLAM], f.[E_BELGE_DURUMU], f.[GIB_STATU_KODU],
        f.[EKLEYEN_ID], f.[EKLEME_ZAMANI],
        v.[KOD] AS [VEZNE_KOD], v.[AD] AS [VEZNE_AD],
        p.[KOD] AS [PARA_KODU],
        c.[KOD] AS [CARI_KOD], c.[AD] AS [CARI_UNVAN]
      FROM [dbo].[TODVZ_FATURA] f
      LEFT JOIN [dbo].[TODVZ_VEZNE] v ON f.[VEZNE_ID] = v.[VEZNE_ID]
      LEFT JOIN [dbo].[TODVZ_PARA] p ON f.[PARA_ID] = p.[PARA_ID]
      LEFT JOIN [dbo].[TODVZ_CARI_KART] c ON f.[CARI_KART_ID] = c.[CARI_KART_ID]
      WHERE f.[FATURA_ID] = @FATURA_ID;
    `);

    if (!headRes.recordset || headRes.recordset.length === 0) {
      return null;
    }

    const row = headRes.recordset[0];

    const linesReq = pool.request();
    linesReq.input("FATURA_ID", sql.Int, faturaId);

    const linesRes = await linesReq.query(`
      SELECT 
        ISNULL(s.[FATURA_SATIR_ID], 0) AS [FATURA_SATIR_ID],
        s.[FATURA_ID],
        ISNULL(s.[SATIR_NO], 1) AS [SATIR_NO],
        s.[ALTIN_URUN_ID],
        ISNULL(NULLIF(s.[BARKOD], ''), ISNULL(u.[BARKOD], '')) AS [BARKOD],
        ISNULL(NULLIF(s.[URUN_ADI], ''), ISNULL(u.[MODEL], 'Altın Ürün')) AS [URUN_ADI],
        ISNULL(NULLIF(s.[AYAR], ''), ISNULL(u.[AYAR], '')) AS [AYAR],
        ISNULL(s.[MIKTAR], 1) AS [MIKTAR],
        ISNULL(s.[BIRIM], 'Adet') AS [BIRIM],
        ISNULL(NULLIF(s.[GRAM], 0), ISNULL(u.[MIKTAR], 0)) AS [GRAM],
        ISNULL(NULLIF(s.[HAS_GRAM], 0), ISNULL(u.[HAS_GRAM], 0)) AS [HAS_GRAM],
        ISNULL(s.[BIRIM_FIYAT], 0) AS [BIRIM_FIYAT],
        ISNULL(s.[TUTAR], 0) AS [TUTAR],
        ISNULL(s.[KDV_ORANI], 0) AS [KDV_ORANI],
        ISNULL(s.[KDV_TUTARI], 0) AS [KDV_TUTARI],
        ISNULL(s.[TOPLAM_TUTAR], 0) AS [TOPLAM_TUTAR]
      FROM [dbo].[TODVZ_FATURA_SATIRI] s
      LEFT JOIN [dbo].[TODVZ_ALTIN_URUN] u ON s.[ALTIN_URUN_ID] = u.[ALTIN_URUN_ID]
      WHERE s.[FATURA_ID] = @FATURA_ID
      ORDER BY s.[SATIR_NO] ASC;
    `);

    let satirlar: FaturaSatiriModel[] = (linesRes.recordset || []).map((s) => ({
      faturaSatirId: s.FATURA_SATIR_ID,
      faturaId: s.FATURA_ID,
      satirNo: s.SATIR_NO,
      altinUrunId: s.ALTIN_URUN_ID,
      barkod: s.BARKOD,
      urunAdi: s.URUN_ADI || "Altın Ürün",
      ayar: s.AYAR || "",
      miktar: Number(s.MIKTAR) || 1,
      birim: s.BIRIM || "Adet",
      gram: Number(s.GRAM) || 0,
      hasGram: Number(s.HAS_GRAM) || 0,
      birimFiyat: Number(s.BIRIM_FIYAT) || 0,
      tutar: Number(s.TUTAR) || 0,
      kdvOrani: Number(s.KDV_ORANI) || 0,
      kdvTutari: Number(s.KDV_TUTARI) || 0,
      toplamTutar: Number(s.TOPLAM_TUTAR) || 0,
    }));

    // Fallback: If satirlar is empty, check if header has amounts and generate a line item
    if (satirlar.length === 0 && (Number(row.GENEL_TOPLAM) > 0 || Number(row.ARA_TOPLAM) > 0)) {
      const aTop = Number(row.ARA_TOPLAM) || Number(row.GENEL_TOPLAM) || 0;
      const kTop = Number(row.TOPLAM_KDV) || 0;
      const gTop = Number(row.GENEL_TOPLAM) || aTop;
      satirlar = [
        {
          faturaSatirId: 1,
          faturaId: row.FATURA_ID,
          satirNo: 1,
          altinUrunId: null,
          barkod: "",
          urunAdi: "Perakende Satış Kalemi",
          ayar: "",
          miktar: 1,
          birim: "Adet",
          gram: 0,
          hasGram: 0,
          birimFiyat: aTop,
          tutar: aTop,
          kdvOrani: aTop > 0 && kTop > 0 ? Math.round((kTop / aTop) * 100) : 0,
          kdvTutari: kTop,
          toplamTutar: gTop,
        },
      ];
    }

    let odemeler: FaturaOdemeModel[] = [];
    try {
      const odemeReq = pool.request();
      odemeReq.input("FATURA_ID", sql.Int, faturaId);
      const odemeRes = await odemeReq.query(`
        IF OBJECT_ID('dbo.TODVZ_FATURA_ODEME', 'U') IS NOT NULL
        BEGIN
          SELECT 
            O.FATURA_ODEME_ID AS faturaOdemeId,
            O.FATURA_ID AS faturaId,
            O.SATIR_NO AS satirNo,
            O.ODEME_ARACI_TURU AS odemeAraciTuru,
            O.ISLEME_YERI AS islemeYeri,
            O.CARI_KART_ID AS cariKartId,
            O.POS_CIHAZI_ID AS posCihaziId,
            ISNULL(NULLIF(RTRIM(O.CARI_KOD), ''), ISNULL(RTRIM(PC.KOD), ISNULL(RTRIM(C.KOD), ''))) AS cariKod,
            ISNULL(NULLIF(RTRIM(O.CARI_UNVAN), ''), ISNULL(RTRIM(PC.AD), ISNULL(RTRIM(C.AD), ''))) AS cariUnvan,
            O.PARA_ID AS paraId,
            ISNULL(O.PARA_KODU, '') AS paraKodu,
            ISNULL(O.PARA_ADI, '') AS paraAdi,
            O.ADET AS adet,
            O.MIKTAR AS miktar,
            O.MILYEM AS milyem,
            O.HAS_GRAM AS hasGram,
            ISNULL(O.KUR, 1) AS kur,
            ISNULL(O.TUTAR, 0) AS tutar
          FROM dbo.TODVZ_FATURA_ODEME O WITH (NOLOCK)
            LEFT JOIN dbo.TODVZ_CARI_KART C WITH (NOLOCK) ON C.CARI_KART_ID = O.CARI_KART_ID
            LEFT JOIN dbo.TODVZ_POS_CIHAZI PC WITH (NOLOCK) ON PC.POS_CIHAZI_ID = O.POS_CIHAZI_ID OR (O.ODEME_ARACI_TURU = 2 AND PC.KOD = O.CARI_KOD)
          WHERE O.FATURA_ID = @FATURA_ID
          ORDER BY O.SATIR_NO ASC;
        END
        ELSE
        BEGIN
          SELECT 1 WHERE 1 = 0;
        END
      `);
      odemeler = (odemeRes.recordset || []).map((o: any) => ({
        faturaOdemeId: o.faturaOdemeId,
        faturaId: o.faturaId,
        satirNo: o.satirNo,
        odemeAraciTuru: o.odemeAraciTuru ?? 0,
        islemeYeri: o.islemeYeri ?? 0,
        cariKartId: o.cariKartId ?? null,
        posCihaziId: o.posCihaziId ?? null,
        cariKod: (o.cariKod || "").trim(),
        cariUnvan: o.cariUnvan || "",
        paraId: o.paraId,
        paraKodu: (o.paraKodu || "").trim(),
        paraAdi: (o.paraAdi || "").trim(),
        adet: o.adet !== null && o.adet !== undefined ? Number(o.adet) : null,
        miktar: o.miktar !== null && o.miktar !== undefined ? Number(o.miktar) : null,
        milyem: o.milyem !== null && o.milyem !== undefined ? Number(o.milyem) : null,
        hasGram: o.hasGram !== null && o.hasGram !== undefined ? Number(o.hasGram) : null,
        kur: Number(o.kur) || 1,
        tutar: Number(o.tutar) || 0,
      }));
    } catch (e) {
      logger.warn("PerakendeSqlRepository.getInvoiceById odeme fetch warning:", e);
    }

    return {
      faturaId: row.FATURA_ID,
      vezneId: row.VEZNE_ID,
      vezneKod: row.VEZNE_KOD,
      vezneAd: row.VEZNE_AD,
      faturaNo: row.FATURA_NO,
      ettn: String(row.ETTN),
      tarih: row.TARIH ? new Date(row.TARIH).toISOString() : new Date().toISOString(),
      faturaTipi: row.FATURA_TIPI,
      senaryo: row.SENARYO,
      cariKartId: row.CARI_KART_ID,
      cariKod: row.CARI_KOD || null,
      cariUnvan: row.CARI_UNVAN || null,
      aliciVknTckn: row.ALICI_VKN_TCKN,
      aliciUnvan: row.ALICI_UNVAN,
      adres: row.ADRES,
      ilce: row.ILCE,
      il: row.IL,
      vergiDairesi: row.VERGI_DAIRESI,
      eposta: row.EPOSTA,
      telefon: row.TELEFON,
      paraId: row.PARA_ID,
      paraKodu: row.PARA_KODU || "TL",
      kur: Number(row.KUR) || 1.0,
      araToplam: Number(row.ARA_TOPLAM) || 0,
      toplamKdv: Number(row.TOPLAM_KDV) || 0,
      iskontoId: row.ISKONTO_ID || null,
      iskontoKodu: row.ISKONTO_KODU || null,
      iskontoOrani: Number(row.ISKONTO_ORANI) || 0,
      iskontoTutari: Number(row.ISKONTO_TUTARI) || 0,
      genelToplam: Number(row.GENEL_TOPLAM) || 0,
      eBelgeDurumu: row.E_BELGE_DURUMU ?? 0,
      gibStatuKodu: row.GIB_STATU_KODU,
      ekleyenId: row.EKLEYEN_ID,
      eklemeZamani: row.EKLEME_ZAMANI ? new Date(row.EKLEME_ZAMANI).toISOString() : null,
      satirlar,
      odemeler,
    };
  }

  /**
   * List invoices with filters
   */
  public static async listInvoices(
    filter: FaturaFilterDto,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<FaturaModel[]> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureTablesAndProcedures(pool);

    const req = pool.request();
    let query = `
      SELECT TOP ${filter.limit || 500}
        f.[FATURA_ID],
        ISNULL(f.[VEZNE_ID], 1) AS [VEZNE_ID],
        ISNULL(f.[FATURA_NO], '') AS [FATURA_NO],
        f.[ETTN],
        ISNULL(f.[TARIH], GETDATE()) AS [TARIH],
        ISNULL(f.[FATURA_TIPI], 1) AS [FATURA_TIPI],
        ISNULL(f.[SENARYO], 'EARSIVFATURA') AS [SENARYO],
        f.[CARI_KART_ID],
        ISNULL(f.[ALICI_VKN_TCKN], '11111111111') AS [ALICI_VKN_TCKN],
        ISNULL(f.[ALICI_UNVAN], 'NİHAİ TÜKETİCİ') AS [ALICI_UNVAN],
        ISNULL(f.[ADRES], '') AS [ADRES],
        ISNULL(f.[ILCE], '') AS [ILCE],
        ISNULL(f.[IL], '') AS [IL],
        ISNULL(f.[VERGI_DAIRESI], '') AS [VERGI_DAIRESI],
        ISNULL(f.[EPOSTA], '') AS [EPOSTA],
        ISNULL(f.[TELEFON], '') AS [TELEFON],
        ISNULL(f.[PARA_ID], 1) AS [PARA_ID],
        ISNULL(f.[KUR], 1.0) AS [KUR],
        ISNULL(f.[ARA_TOPLAM], 0) AS [ARA_TOPLAM],
        ISNULL(f.[TOPLAM_KDV], 0) AS [TOPLAM_KDV],
        ISNULL(f.[ISKONTO_ID], NULL) AS [ISKONTO_ID],
        ISNULL(f.[ISKONTO_KODU], '') AS [ISKONTO_KODU],
        ISNULL(f.[ISKONTO_ORANI], 0) AS [ISKONTO_ORANI],
        ISNULL(f.[ISKONTO_TUTARI], 0) AS [ISKONTO_TUTARI],
        ISNULL(f.[GENEL_TOPLAM], 0) AS [GENEL_TOPLAM],
        ISNULL(f.[E_BELGE_DURUMU], 0) AS [E_BELGE_DURUMU],
        f.[GIB_STATU_KODU],
        f.[EKLEYEN_ID],
        f.[EKLEME_ZAMANI],
        ISNULL(v.[KOD], '') AS [VEZNE_KOD],
        ISNULL(v.[AD], '') AS [VEZNE_AD],
        ISNULL(p.[KOD], 'TL') AS [PARA_KODU],
        ISNULL(c.[KOD], '') AS [CARI_KOD],
        ISNULL(c.[AD], '') AS [CARI_UNVAN]
      FROM [dbo].[TODVZ_FATURA] f
      LEFT JOIN [dbo].[TODVZ_VEZNE] v ON f.[VEZNE_ID] = v.[VEZNE_ID]
      LEFT JOIN [dbo].[TODVZ_PARA] p ON f.[PARA_ID] = p.[PARA_ID]
      LEFT JOIN [dbo].[TODVZ_CARI_KART] c ON f.[CARI_KART_ID] = c.[CARI_KART_ID]
      WHERE 1=1
    `;

    if (filter.baslangicTarihi && filter.baslangicTarihi.trim()) {
      query += ` AND CAST(f.[TARIH] AS DATE) >= CAST(@BASLANGIC AS DATE)`;
      req.input("BASLANGIC", sql.VarChar(50), filter.baslangicTarihi.trim().substring(0, 10));
    }

    if (filter.bitisTarihi && filter.bitisTarihi.trim()) {
      query += ` AND CAST(f.[TARIH] AS DATE) <= CAST(@BITIS AS DATE)`;
      req.input("BITIS", sql.VarChar(50), filter.bitisTarihi.trim().substring(0, 10));
    }

    if (filter.aliciVknTckn && filter.aliciVknTckn.trim()) {
      query += ` AND f.[ALICI_VKN_TCKN] LIKE @VKN`;
      req.input("VKN", sql.VarChar(50), `%${filter.aliciVknTckn.trim()}%`);
    }

    if (filter.eBelgeDurumu !== undefined && filter.eBelgeDurumu !== null) {
      query += ` AND f.[E_BELGE_DURUMU] = @DURUM`;
      req.input("DURUM", sql.TinyInt, filter.eBelgeDurumu);
    }

    if (filter.search && filter.search.trim()) {
      query += ` AND (f.[FATURA_NO] LIKE @SEARCH OR f.[ALICI_UNVAN] LIKE @SEARCH OR f.[ALICI_VKN_TCKN] LIKE @SEARCH)`;
      req.input("SEARCH", sql.VarChar(200), `%${filter.search.trim()}%`);
    }

    query += ` ORDER BY f.[FATURA_ID] DESC;`;

    const res = await req.query(query);

    return (res.recordset || []).map((row) => ({
      faturaId: row.FATURA_ID,
      vezneId: row.VEZNE_ID,
      vezneKod: row.VEZNE_KOD,
      vezneAd: row.VEZNE_AD,
      faturaNo: row.FATURA_NO,
      ettn: String(row.ETTN || ""),
      tarih: row.TARIH ? new Date(row.TARIH).toISOString() : new Date().toISOString(),
      faturaTipi: Number(row.FATURA_TIPI) || 1,
      senaryo: row.SENARYO || "EARSIVFATURA",
      cariKartId: row.CARI_KART_ID,
      cariKod: row.CARI_KOD || null,
      cariUnvan: row.CARI_UNVAN || null,
      aliciVknTckn: row.ALICI_VKN_TCKN || "",
      aliciUnvan: row.ALICI_UNVAN || "",
      adres: row.ADRES || "",
      ilce: row.ILCE || "",
      il: row.IL || "",
      vergiDairesi: row.VERGI_DAIRESI || "",
      eposta: row.EPOSTA || "",
      telefon: row.TELEFON || "",
      paraId: row.PARA_ID || 1,
      paraKodu: row.PARA_KODU || "TL",
      kur: Number(row.KUR) || 1.0,
      araToplam: Number(row.ARA_TOPLAM) || 0,
      toplamKdv: Number(row.TOPLAM_KDV) || 0,
      iskontoId: row.ISKONTO_ID || null,
      iskontoKodu: row.ISKONTO_KODU || null,
      iskontoOrani: Number(row.ISKONTO_ORANI) || 0,
      iskontoTutari: Number(row.ISKONTO_TUTARI) || 0,
      genelToplam: Number(row.GENEL_TOPLAM) || 0,
      eBelgeDurumu: Number(row.E_BELGE_DURUMU) || 0,
      gibStatuKodu: row.GIB_STATU_KODU,
      ekleyenId: row.EKLEYEN_ID,
      eklemeZamani: row.EKLEME_ZAMANI ? new Date(row.EKLEME_ZAMANI).toISOString() : null,
    }));
  }

  /**
   * Delete invoice and return products back to stock using dbo.SODVZ_FATURA_SIL
   */
  public static async deleteInvoice(
    faturaId: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<void> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureTablesAndProcedures(pool);

    try {
      const req = pool.request();
      req.input("FATURA_ID", sql.Int, faturaId);
      await req.execute("dbo.SODVZ_FATURA_SIL");
    } catch (err: any) {
      const detailedMessage =
        err.originalError?.info?.message || err.originalError?.message || err.message || "Fatura silinemedi.";
      logger.error("PerakendeSqlRepository.deleteInvoice error:", {
        message: detailedMessage,
        faturaId,
      });
      throw ApiError.badRequest(`Fatura Silme Hatası: ${detailedMessage}`);
    }
  }
}
