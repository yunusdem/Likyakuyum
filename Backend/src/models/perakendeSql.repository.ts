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
  genelToplam: number;
  eBelgeDurumu: number; // 0: Taslak, 1: İletildi, 2: Onaylandı, 3: Hata, 4: İptal
  gibStatuKodu?: string | null;
  ekleyenId?: number | null;
  eklemeZamani?: string | null;
  satirlar?: FaturaSatiriModel[];
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
  genelToplam?: number;
  satirlar: CreateFaturaSatiriDto[];
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
export type InvoiceFilterDto = FaturaFilterDto;

export class PerakendeSqlRepository {
  /**
   * Ensures tables and stored procedures exist in the database
   */
  public static async ensureTablesAndProcedures(pool: sql.ConnectionPool): Promise<void> {
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
      `);

      // 3. Stored Procedure: SODVZ_FATURA_SIL
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

            -- Satılan altın ürünleri tekrar stoğa iade et
            IF OBJECT_ID('dbo.TODVZ_ALTIN_URUN') IS NOT NULL
            BEGIN
                UPDATE u
                SET u.SATILDI = 0,
                    u.GUNCELLEME_ZAMANI = GETDATE()
                FROM dbo.TODVZ_ALTIN_URUN u
                INNER JOIN dbo.TODVZ_FATURA_SATIRI s ON u.ALTIN_URUN_ID = s.ALTIN_URUN_ID
                WHERE s.FATURA_ID = @FATURA_ID;
            END;

            -- Satırları ve başlığı kaldır
            DELETE FROM dbo.TODVZ_FATURA_SATIRI WHERE FATURA_ID = @FATURA_ID;
            DELETE FROM dbo.TODVZ_FATURA WHERE FATURA_ID = @FATURA_ID;

            COMMIT TRAN;
            RETURN 0;
        END;
      `);
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
   * Query product by barcode from TODVZ_ALTIN_URUN (where SATILDI = 0)
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

    const query = `
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
    `;

    const res = await req.query(query);

    if (!res.recordset || res.recordset.length === 0) {
      throw ApiError.notFound(`'${cleanBarcode}' barkoduna ait altın ürün bulunamadı.`);
    }

    const row = res.recordset[0];

    if (row.SATILDI === true || row.SATILDI === 1) {
      throw ApiError.badRequest(
        `'${cleanBarcode}' barkodlu ürün (${row.MODEL || row.GRUP_KODU || "Altın Ürün"}) daha önce satılmıştır ve stokta mevcut değildir.`
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
    };
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

    let araToplam = 0;
    let toplamKdv = 0;
    let genelToplam = 0;

    dto.satirlar.forEach((s) => {
      const m = Number(s.miktar) || 1;
      const f = Number(s.birimFiyat) || 0;
      const kdvRate = Number(s.kdvOrani) || 0;
      const tutar = Math.round(m * f * 100) / 100;
      const kdvTutari = Math.round(tutar * (kdvRate / 100) * 100) / 100;
      araToplam += tutar;
      toplamKdv += kdvTutari;
      genelToplam += tutar + kdvTutari;
    });

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
            ARA_TOPLAM, TOPLAM_KDV, GENEL_TOPLAM, E_BELGE_DURUMU,
            EKLEYEN_ID, EKLEME_ZAMANI
          )
          OUTPUT INSERTED.FATURA_ID
          VALUES (
            @VEZNE_ID, @FATURA_NO, ISNULL(@ETTN, NEWID()), ISNULL(@TARIH, GETDATE()), @FATURA_TIPI, @SENARYO,
            @CARI_KART_ID, @ALICI_VKN_TCKN, @ALICI_UNVAN, @ADRES, @ILCE, @IL,
            @VERGI_DAIRESI, @EPOSTA, @TELEFON, @PARA_ID, @KUR,
            @ARA_TOPLAM, @TOPLAM_KDV, @GENEL_TOPLAM, 0,
            @KULLANICI_ID, GETDATE()
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

      // 3. Clear lines if updating
      if (dto.faturaId && dto.faturaId > 0) {
        const delReq = new sql.Request(transaction);
        delReq.input("FATURA_ID", sql.Int, outFaturaId);
        await delReq.query("DELETE FROM dbo.TODVZ_FATURA_SATIRI WHERE FATURA_ID = @FATURA_ID");
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

          lineReq.input("FATURA_ID", sql.Int, outFaturaId);
          lineReq.input("SATIR_NO", sql.Int, satirNo);
          lineReq.input("ALTIN_URUN_ID", sql.Int, row.altinUrunId || null);
          lineReq.input("BARKOD", sql.VarChar(50), (row.barkod || "").trim() || null);
          lineReq.input("URUN_ADI", sql.VarChar(200), (row.urunAdi || "Altın Ürün").trim());
          lineReq.input("AYAR", sql.VarChar(50), (row.ayar || "").trim() || null);
          lineReq.input("MIKTAR", sql.Float, m);
          lineReq.input("BIRIM", sql.VarChar(20), (row.birim || "Adet").trim());
          lineReq.input("GRAM", sql.Float, Number(row.gram) || 0);
          lineReq.input("HAS_GRAM", sql.Float, Number(row.hasGram) || 0);
          lineReq.input("BIRIM_FIYAT", sql.Float, f);
          lineReq.input("TUTAR", sql.Float, tutar);
          lineReq.input("KDV_ORANI", sql.Float, kdvRate);
          lineReq.input("KDV_TUTARI", sql.Float, kdvTutari);
          lineReq.input("TOPLAM_TUTAR", sql.Float, toplamTutar);

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

            IF OBJECT_ID('dbo.TODVZ_ALTIN_URUN') IS NOT NULL
            BEGIN
              IF (@ALTIN_URUN_ID IS NOT NULL AND @ALTIN_URUN_ID > 0)
              BEGIN
                UPDATE dbo.TODVZ_ALTIN_URUN
                SET SATILDI = 1, GUNCELLEME_ZAMANI = GETDATE()
                WHERE ALTIN_URUN_ID = @ALTIN_URUN_ID;
              END
              ELSE IF (@BARKOD IS NOT NULL AND LEN(LTRIM(RTRIM(@BARKOD))) > 0)
              BEGIN
                UPDATE dbo.TODVZ_ALTIN_URUN
                SET SATILDI = 1, GUNCELLEME_ZAMANI = GETDATE()
                WHERE BARKOD = @BARKOD;
              END;
            END;
          `;

          await lineReq.query(lineInsertQuery);
        }
      }

      // 5. Update header summary amounts from lines
      const summaryReq = new sql.Request(transaction);
      summaryReq.input("FATURA_ID", sql.Int, outFaturaId);
      await summaryReq.query(`
        UPDATE dbo.TODVZ_FATURA
        SET ARA_TOPLAM   = ISNULL((SELECT SUM(TUTAR) FROM dbo.TODVZ_FATURA_SATIRI WHERE FATURA_ID = @FATURA_ID), 0),
            TOPLAM_KDV   = ISNULL((SELECT SUM(KDV_TUTARI) FROM dbo.TODVZ_FATURA_SATIRI WHERE FATURA_ID = @FATURA_ID), 0),
            GENEL_TOPLAM = ISNULL((SELECT SUM(TOPLAM_TUTAR) FROM dbo.TODVZ_FATURA_SATIRI WHERE FATURA_ID = @FATURA_ID), 0)
        WHERE FATURA_ID = @FATURA_ID;
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
        f.[TOPLAM_KDV], f.[GENEL_TOPLAM], f.[E_BELGE_DURUMU], f.[GIB_STATU_KODU],
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
      genelToplam: Number(row.GENEL_TOPLAM) || 0,
      eBelgeDurumu: row.E_BELGE_DURUMU ?? 0,
      gibStatuKodu: row.GIB_STATU_KODU,
      ekleyenId: row.EKLEYEN_ID,
      eklemeZamani: row.EKLEME_ZAMANI ? new Date(row.EKLEME_ZAMANI).toISOString() : null,
      satirlar,
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
