import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";

export interface TodvzCariHareketEntity {
  CARI_HAREKET_ID: number;
  CARI_KART_ID: number;
  TARIH: Date;
  HAREKET_TIPI: number;
  ACIKLAMA: string | null;
  TIP: number; // 0: Borç, 1: Alacak
  EKLEYEN_ID: number;
  EKLEME_ZAMANI: Date;
  GUNCELLEYEN_ID: number;
  GUNCELLEME_ZAMANI: Date;
  VEZNE_ID: number;
  POS_CIHAZI_ID: number | null;
  // Joined fields
  CARI_KOD?: string;
  CARI_AD?: string;
  VEZNE_KOD?: string;
  VEZNE_AD?: string;
}

export interface TodvzCariHareketSatiriEntity {
  CARI_HAREKET_ID: number;
  SATIR_NO: number;
  PARA_ID: number;
  MEBLAG: number;
  // Joined fields
  PARA_KOD?: string;
  PARA_AD?: string;
  HAS_ORANI?: number;
}

export interface CariHareketSatiriModel {
  satirNo: number;
  paraId: number;
  paraKodu: string;
  paraAdi?: string;
  meblag: number;
  hasOrani?: number;
}

export interface CariHareketModel {
  id: number;
  cariKartId: number;
  cariKod: string;
  cariAd: string;
  tarih: string;
  hareketTipi: number;
  hareketTipiLabel: string;
  aciklama: string;
  tip: number; // 0: Borç, 1: Alacak
  tipLabel: string;
  ekleyenId: number;
  eklemeZamani: string;
  guncelleyenId: number;
  guncellemeZamani: string;
  vezneId: number;
  vezneKod: string;
  vezneAd: string;
  posCihaziId: number | null;
  satirlar: CariHareketSatiriModel[];
  toplamSatirSayisi?: number;
  satirlarOzet?: string;
}

export interface CariHareketInputDto {
  cariKartId: number;
  tarih: string;
  hareketTipi?: number;
  aciklama?: string | null;
  tip: number; // 0: Borç, 1: Alacak
  vezneId: number;
  posCihaziId?: number | null;
  satirlar: {
    paraId: number;
    meblag: number;
  }[];
}

export interface CariBakiyeRow {
  paraId: number;
  kod: string;
  ad: string;
  borcBakiye: number;
  alacakBakiye: number;
  netBakiye: number;
  yon: "B" | "A" | "-";
  hasOrani?: number;
}

export interface CariBakiyeSummary {
  cariKartId: number;
  kod: string;
  ad: string;
  satirlar: CariBakiyeRow[];
  netHasBakiye: number;
  netHasYon: "B" | "A" | "-";
  headerLabel: string; // e.g. "792 HAS A"
}

const HAREKET_TIPI_LABELS: Record<number, string> = {
  0: "Nakit",
  1: "Banka / Havale",
  2: "POS / Kredi Kartı",
  3: "Dekont",
  4: "Virman",
  5: "Devir",
};

export class CariHareketSqlRepository {
  /**
   * Automatically ensure tables TODVZ_CARI_HAREKET and TODVZ_CARI_HAREKET_SATIRI exist in the database.
   */
  public static async ensureTablesExist(pool: sql.ConnectionPool): Promise<void> {
    const checkQuery = `
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TODVZ_CARI_HAREKET')
      BEGIN
        CREATE TABLE [dbo].[TODVZ_CARI_HAREKET] (
          [CARI_HAREKET_ID] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
          [CARI_KART_ID] INT NOT NULL,
          [TARIH] DATETIME NOT NULL DEFAULT GETDATE(),
          [HAREKET_TIPI] TINYINT NOT NULL DEFAULT 0,
          [ACIKLAMA] VARCHAR(100) NULL,
          [TIP] TINYINT NOT NULL DEFAULT 0,
          [EKLEYEN_ID] INT NOT NULL DEFAULT 1,
          [EKLEME_ZAMANI] DATETIME NOT NULL DEFAULT GETDATE(),
          [GUNCELLEYEN_ID] INT NOT NULL DEFAULT 1,
          [GUNCELLEME_ZAMANI] DATETIME NOT NULL DEFAULT GETDATE(),
          [VEZNE_ID] INT NOT NULL DEFAULT 1,
          [POS_CIHAZI_ID] INT NULL
        );
      END

      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TODVZ_CARI_HAREKET_SATIRI')
      BEGIN
        CREATE TABLE [dbo].[TODVZ_CARI_HAREKET_SATIRI] (
          [CARI_HAREKET_ID] INT NOT NULL,
          [SATIR_NO] INT NOT NULL,
          [PARA_ID] INT NOT NULL,
          [MEBLAG] FLOAT NOT NULL DEFAULT 0,
          CONSTRAINT [PK_TODVZ_CARI_HAREKET_SATIRI] PRIMARY KEY CLUSTERED ([CARI_HAREKET_ID] ASC, [SATIR_NO] ASC)
        );
      END
    `;
    try {
      await pool.request().query(checkQuery);
    } catch (err) {
      logger.warn("CariHareketSqlRepository.ensureTablesExist warning:", err);
    }
  }

  private static formatIsoDate(d?: Date | null): string {
    if (!d) return "";
    try {
      return new Date(d).toISOString();
    } catch {
      return "";
    }
  }

  public static async findAll(
    filters?: {
      startDate?: string;
      endDate?: string;
      cariKartId?: number;
      vezneId?: number;
      tip?: number;
      hareketTipi?: number;
      search?: string;
    },
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<CariHareketModel[]> {
    try {
      const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
      await CariHareketSqlRepository.ensureTablesExist(pool);

      const request = pool.request();
      let startParam: Date | null = null;
      let endParam: Date | null = null;

      if (filters?.startDate && filters.startDate.trim()) {
        startParam = new Date(filters.startDate);
        request.input("startDate", sql.DateTime, startParam);
      }
      if (filters?.endDate && filters.endDate.trim()) {
        endParam = new Date(filters.endDate);
        endParam.setHours(23, 59, 59, 999);
        request.input("endDate", sql.DateTime, endParam);
      }
      if (filters?.cariKartId) {
        request.input("cariKartId", sql.Int, Number(filters.cariKartId));
      }
      if (filters?.vezneId) {
        request.input("vezneId", sql.Int, Number(filters.vezneId));
      }
      if (filters?.tip !== undefined && filters?.tip !== null && String(filters?.tip) !== "-1") {
        request.input("tip", sql.TinyInt, Number(filters.tip));
      }
      if (filters?.hareketTipi !== undefined && filters?.hareketTipi !== null && String(filters?.hareketTipi) !== "-1") {
        request.input("hareketTipi", sql.TinyInt, Number(filters.hareketTipi));
      }
      if (filters?.search && filters.search.trim()) {
        request.input("search", sql.VarChar(100), `%${filters.search.trim()}%`);
      }

      // Build unified query across all slip sources
      const queries: string[] = [];

      // 1. TODVZ_CARI_HAREKET
      let chWhere = ["1=1"];
      if (startParam) chWhere.push("H.[TARIH] >= @startDate");
      if (endParam) chWhere.push("H.[TARIH] <= @endDate");
      if (filters?.cariKartId) chWhere.push("H.[CARI_KART_ID] = @cariKartId");
      if (filters?.vezneId) chWhere.push("H.[VEZNE_ID] = @vezneId");
      if (filters?.tip !== undefined && filters?.tip !== null && String(filters?.tip) !== "-1") chWhere.push("H.[TIP] = @tip");
      if (filters?.hareketTipi !== undefined && filters?.hareketTipi !== null && String(filters?.hareketTipi) !== "-1") chWhere.push("H.[HAREKET_TIPI] = @hareketTipi");
      if (filters?.search && filters.search.trim()) {
        chWhere.push("(C.[KOD] LIKE @search OR C.[AD] LIKE @search OR H.[ACIKLAMA] LIKE @search OR V.[KOD] LIKE @search OR V.[AD] LIKE @search)");
      }

      queries.push(`
        SELECT 
          H.[CARI_HAREKET_ID] AS [ID],
          'CARI_HAREKET' AS [KAYNAK],
          H.[CARI_KART_ID],
          H.[TARIH],
          H.[HAREKET_TIPI],
          H.[ACIKLAMA],
          H.[TIP],
          H.[EKLEYEN_ID],
          H.[EKLEME_ZAMANI],
          H.[GUNCELLEYEN_ID],
          H.[GUNCELLEME_ZAMANI],
          H.[VEZNE_ID],
          H.[POS_CIHAZI_ID],
          LTRIM(RTRIM(ISNULL(C.[KOD], ''))) AS [CARI_KOD],
          LTRIM(RTRIM(ISNULL(C.[AD], ''))) AS [CARI_AD],
          LTRIM(RTRIM(ISNULL(V.[KOD], ''))) AS [VEZNE_KOD],
          LTRIM(RTRIM(ISNULL(V.[AD], ''))) AS [VEZNE_AD]
        FROM [dbo].[TODVZ_CARI_HAREKET] H WITH (NOLOCK)
        LEFT JOIN [dbo].[TODVZ_CARI_KART] C WITH (NOLOCK) ON H.[CARI_KART_ID] = C.[CARI_KART_ID]
        LEFT JOIN [dbo].[TODVZ_VEZNE] V WITH (NOLOCK) ON H.[VEZNE_ID] = V.[VEZNE_ID]
        WHERE ${chWhere.join(" AND ")}
      `);

      // 2. TODVZ_SARRAF_FISI (with Cari)
      let sfWhere = ["(SF.[CARI_KART_ID] IS NOT NULL OR OS.[CARI_KART_ID] IS NOT NULL OR OS.[ODEME_ARACI_TURU] = 1)"];
      if (startParam) sfWhere.push("SF.[TARIH] >= @startDate");
      if (endParam) sfWhere.push("SF.[TARIH] <= @endDate");
      if (filters?.cariKartId) sfWhere.push("ISNULL(OS.[CARI_KART_ID], SF.[CARI_KART_ID]) = @cariKartId");
      if (filters?.vezneId) sfWhere.push("SF.[VEZNE_ID] = @vezneId");
      if (filters?.tip !== undefined && filters?.tip !== null && String(filters?.tip) !== "-1") {
        // SF.TIP: 0 Alış (Alacak=1), 1 Satış (Borç=0)
        sfWhere.push("(CASE WHEN SF.[TIP] = 1 THEN 0 ELSE 1 END) = @tip");
      }
      if (filters?.hareketTipi !== undefined && filters?.hareketTipi !== null && String(filters?.hareketTipi) !== "-1") {
        // Sarraf fişleri hareketTipi = 10
        if (Number(filters.hareketTipi) !== 10) sfWhere.push("1=0");
      }
      if (filters?.search && filters.search.trim()) {
        sfWhere.push("(C.[KOD] LIKE @search OR C.[AD] LIKE @search OR SF.[UNVAN] LIKE @search OR SF.[FIS_NO] LIKE @search)");
      }

      queries.push(`
        SELECT 
          SF.[SARRAF_FISI_ID] AS [ID],
          'SARRAF_FISI' AS [KAYNAK],
          ISNULL(OS.[CARI_KART_ID], SF.[CARI_KART_ID]) AS [CARI_KART_ID],
          SF.[TARIH],
          10 AS [HAREKET_TIPI],
          CASE WHEN SF.[TIP] = 1 THEN 'Sarraf Satış Fişi #' + ISNULL(SF.[FIS_NO], CAST(SF.[SARRAF_FISI_ID] AS VARCHAR)) ELSE 'Sarraf Alış Fişi #' + ISNULL(SF.[FIS_NO], CAST(SF.[SARRAF_FISI_ID] AS VARCHAR)) END AS [ACIKLAMA],
          CASE WHEN SF.[TIP] = 1 THEN 0 ELSE 1 END AS [TIP],
          1 AS [EKLEYEN_ID],
          ISNULL(SF.[EKLEME_ZAMANI], SF.[TARIH]) AS [EKLEME_ZAMANI],
          1 AS [GUNCELLEYEN_ID],
          ISNULL(SF.[EKLEME_ZAMANI], SF.[TARIH]) AS [GUNCELLEME_ZAMANI],
          SF.[VEZNE_ID],
          NULL AS [POS_CIHAZI_ID],
          LTRIM(RTRIM(ISNULL(C.[KOD], ''))) AS [CARI_KOD],
          LTRIM(RTRIM(ISNULL(C.[AD], ISNULL(SF.[UNVAN], '')))) AS [CARI_AD],
          LTRIM(RTRIM(ISNULL(V.[KOD], ''))) AS [VEZNE_KOD],
          LTRIM(RTRIM(ISNULL(V.[AD], ''))) AS [VEZNE_AD]
        FROM [dbo].[TODVZ_SARRAF_FISI] SF WITH (NOLOCK)
        LEFT JOIN [dbo].[TODVZ_ODEME_SATIRI] OS WITH (NOLOCK) ON OS.[SARRAF_FISI_ID] = SF.[SARRAF_FISI_ID] AND (OS.[ODEME_ARACI_TURU] = 1 OR OS.[CARI_KART_ID] IS NOT NULL)
        LEFT JOIN [dbo].[TODVZ_CARI_KART] C WITH (NOLOCK) ON C.[CARI_KART_ID] = ISNULL(OS.[CARI_KART_ID], SF.[CARI_KART_ID])
        LEFT JOIN [dbo].[TODVZ_VEZNE] V WITH (NOLOCK) ON SF.[VEZNE_ID] = V.[VEZNE_ID]
        WHERE ${sfWhere.join(" AND ")}
      `);

      // 3. TODVZ_FIS (Döviz Fişi)
      let dfWhere = ["F.[CARI_KART_ID] IS NOT NULL", "ISNULL(F.[IPTAL], 0) = 0"];
      if (startParam) dfWhere.push("F.[TARIH] >= @startDate");
      if (endParam) dfWhere.push("F.[TARIH] <= @endDate");
      if (filters?.cariKartId) dfWhere.push("F.[CARI_KART_ID] = @cariKartId");
      if (filters?.vezneId) dfWhere.push("F.[VEZNE_ID] = @vezneId");
      if (filters?.tip !== undefined && filters?.tip !== null && String(filters?.tip) !== "-1") {
        // F.TIP: 0 Alış (Alacak=1), 1 Satış (Borç=0), 2 Arbitraj
        dfWhere.push("(CASE WHEN F.[TIP] = 1 THEN 0 ELSE 1 END) = @tip");
      }
      if (filters?.hareketTipi !== undefined && filters?.hareketTipi !== null && String(filters?.hareketTipi) !== "-1") {
        if (Number(filters.hareketTipi) !== 11) dfWhere.push("1=0");
      }
      if (filters?.search && filters.search.trim()) {
        dfWhere.push("(C.[KOD] LIKE @search OR C.[AD] LIKE @search OR F.[UNVAN] LIKE @search OR F.[BELGE_NO] LIKE @search)");
      }

      queries.push(`
        SELECT 
          F.[FIS_ID] AS [ID],
          'DOVIZ_FISI' AS [KAYNAK],
          F.[CARI_KART_ID],
          F.[TARIH],
          11 AS [HAREKET_TIPI],
          CASE 
            WHEN F.[TIP] = 0 THEN 'Döviz Alış Fişi #' + ISNULL(F.[BELGE_NO], CAST(F.[FIS_ID] AS VARCHAR))
            WHEN F.[TIP] = 1 THEN 'Döviz Satış Fişi #' + ISNULL(F.[BELGE_NO], CAST(F.[FIS_ID] AS VARCHAR))
            ELSE 'Döviz Arbitraj Fişi #' + ISNULL(F.[BELGE_NO], CAST(F.[FIS_ID] AS VARCHAR))
          END AS [ACIKLAMA],
          CASE WHEN F.[TIP] = 1 THEN 0 ELSE 1 END AS [TIP],
          ISNULL(F.[EKLEYEN_ID], 1) AS [EKLEYEN_ID],
          ISNULL(F.[EKLEME_ZAMANI], F.[TARIH]) AS [EKLEME_ZAMANI],
          ISNULL(F.[GUNCELLEYEN_ID], 1) AS [GUNCELLEYEN_ID],
          ISNULL(F.[GUNCELLEME_ZAMANI], F.[TARIH]) AS [GUNCELLEME_ZAMANI],
          F.[VEZNE_ID],
          NULL AS [POS_CIHAZI_ID],
          LTRIM(RTRIM(ISNULL(C.[KOD], ''))) AS [CARI_KOD],
          LTRIM(RTRIM(ISNULL(C.[AD], ISNULL(F.[UNVAN], '')))) AS [CARI_AD],
          LTRIM(RTRIM(ISNULL(V.[KOD], ''))) AS [VEZNE_KOD],
          LTRIM(RTRIM(ISNULL(V.[AD], ''))) AS [VEZNE_AD]
        FROM [dbo].[TODVZ_FIS] F WITH (NOLOCK)
        LEFT JOIN [dbo].[TODVZ_CARI_KART] C WITH (NOLOCK) ON C.[CARI_KART_ID] = F.[CARI_KART_ID]
        LEFT JOIN [dbo].[TODVZ_VEZNE] V WITH (NOLOCK) ON F.[VEZNE_ID] = V.[VEZNE_ID]
        WHERE ${dfWhere.join(" AND ")}
      `);

      // 4. TODVZ_FATURA (Perakende Faturası)
      let fatWhere = ["(FAT.[CARI_KART_ID] IS NOT NULL OR FO.[CARI_KART_ID] IS NOT NULL)"];
      if (startParam) fatWhere.push("FAT.[TARIH] >= @startDate");
      if (endParam) fatWhere.push("FAT.[TARIH] <= @endDate");
      if (filters?.cariKartId) fatWhere.push("ISNULL(FO.[CARI_KART_ID], FAT.[CARI_KART_ID]) = @cariKartId");
      if (filters?.vezneId) fatWhere.push("FAT.[VEZNE_ID] = @vezneId");
      if (filters?.tip !== undefined && filters?.tip !== null && String(filters?.tip) !== "-1") {
        // FAT.FATURA_TIPI: 1 Satış (Borç=0), 2 İade (Alacak=1)
        fatWhere.push("(CASE WHEN FAT.[FATURA_TIPI] = 1 THEN 0 ELSE 1 END) = @tip");
      }
      if (filters?.hareketTipi !== undefined && filters?.hareketTipi !== null && String(filters?.hareketTipi) !== "-1") {
        if (Number(filters.hareketTipi) !== 12) fatWhere.push("1=0");
      }
      if (filters?.search && filters.search.trim()) {
        fatWhere.push("(C.[KOD] LIKE @search OR C.[AD] LIKE @search OR FAT.[ALICI_UNVAN] LIKE @search OR FAT.[FATURA_NO] LIKE @search)");
      }

      queries.push(`
        SELECT 
          FAT.[FATURA_ID] AS [ID],
          'FATURA' AS [KAYNAK],
          ISNULL(FO.[CARI_KART_ID], FAT.[CARI_KART_ID]) AS [CARI_KART_ID],
          FAT.[TARIH],
          12 AS [HAREKET_TIPI],
          CASE WHEN FAT.[FATURA_TIPI] = 1 THEN 'Perakende Satış Faturası #' + ISNULL(FAT.[FATURA_NO], CAST(FAT.[FATURA_ID] AS VARCHAR)) ELSE 'Perakende İade Faturası #' + ISNULL(FAT.[FATURA_NO], CAST(FAT.[FATURA_ID] AS VARCHAR)) END AS [ACIKLAMA],
          CASE WHEN FAT.[FATURA_TIPI] = 1 THEN 0 ELSE 1 END AS [TIP],
          1 AS [EKLEYEN_ID],
          FAT.[TARIH] AS [EKLEME_ZAMANI],
          1 AS [GUNCELLEYEN_ID],
          FAT.[TARIH] AS [GUNCELLEME_ZAMANI],
          FAT.[VEZNE_ID],
          NULL AS [POS_CIHAZI_ID],
          LTRIM(RTRIM(ISNULL(C.[KOD], ''))) AS [CARI_KOD],
          LTRIM(RTRIM(ISNULL(C.[AD], ISNULL(FAT.[ALICI_UNVAN], '')))) AS [CARI_AD],
          LTRIM(RTRIM(ISNULL(V.[KOD], ''))) AS [VEZNE_KOD],
          LTRIM(RTRIM(ISNULL(V.[AD], ''))) AS [VEZNE_AD]
        FROM [dbo].[TODVZ_FATURA] FAT WITH (NOLOCK)
        LEFT JOIN [dbo].[TODVZ_FATURA_ODEME] FO WITH (NOLOCK) ON FO.[FATURA_ID] = FAT.[FATURA_ID] AND (FO.[ODEME_ARACI_TURU] = 1 OR FO.[CARI_KART_ID] IS NOT NULL)
        LEFT JOIN [dbo].[TODVZ_CARI_KART] C WITH (NOLOCK) ON C.[CARI_KART_ID] = ISNULL(FO.[CARI_KART_ID], FAT.[CARI_KART_ID])
        LEFT JOIN [dbo].[TODVZ_VEZNE] V WITH (NOLOCK) ON FAT.[VEZNE_ID] = V.[VEZNE_ID]
        WHERE ${fatWhere.join(" AND ")}
      `);

      const finalUnionQuery = `
        WITH CombinedMovements AS (
          ${queries.join("\nUNION ALL\n")}
        )
        SELECT DISTINCT
          [ID] AS [CARI_HAREKET_ID],
          [KAYNAK],
          [CARI_KART_ID],
          [TARIH],
          [HAREKET_TIPI],
          [ACIKLAMA],
          [TIP],
          [EKLEYEN_ID],
          [EKLEME_ZAMANI],
          [GUNCELLEYEN_ID],
          [GUNCELLEME_ZAMANI],
          [VEZNE_ID],
          [POS_CIHAZI_ID],
          [CARI_KOD],
          [CARI_AD],
          [VEZNE_KOD],
          [VEZNE_AD]
        FROM CombinedMovements
        WHERE [CARI_KART_ID] IS NOT NULL
        ORDER BY [TARIH] DESC, [ID] DESC;
      `;

      const result = await request.query<any>(finalUnionQuery);
      const headers = result.recordset || [];

      if (headers.length === 0) return [];

      // Fetch lines for Cari Hareket
      const chIds = headers.filter((h) => h.KAYNAK === "CARI_HAREKET").map((h) => h.CARI_HAREKET_ID);
      const chLinesMap = new Map<number, CariHareketSatiriModel[]>();
      if (chIds.length > 0) {
        const linesQuery = `
          SELECT 
            S.[CARI_HAREKET_ID],
            S.[SATIR_NO],
            S.[PARA_ID],
            S.[MEBLAG],
            LTRIM(RTRIM(ISNULL(P.[KOD], ''))) AS [PARA_KOD],
            LTRIM(RTRIM(ISNULL(P.[AD], ''))) AS [PARA_AD],
            P.[HAS_ORANI]
          FROM [dbo].[TODVZ_CARI_HAREKET_SATIRI] S WITH (NOLOCK)
          LEFT JOIN [dbo].[TODVZ_PARA] P WITH (NOLOCK) ON S.[PARA_ID] = P.[PARA_ID]
          WHERE S.[CARI_HAREKET_ID] IN (${chIds.join(",")})
          ORDER BY S.[CARI_HAREKET_ID] ASC, S.[SATIR_NO] ASC;
        `;
        const linesResult = await pool.request().query<TodvzCariHareketSatiriEntity>(linesQuery);
        for (const line of linesResult.recordset || []) {
          if (!chLinesMap.has(line.CARI_HAREKET_ID)) {
            chLinesMap.set(line.CARI_HAREKET_ID, []);
          }
          chLinesMap.get(line.CARI_HAREKET_ID)!.push({
            satirNo: line.SATIR_NO,
            paraId: line.PARA_ID,
            paraKodu: line.PARA_KOD || "",
            paraAdi: line.PARA_AD || "",
            meblag: line.MEBLAG || 0,
            hasOrani: line.HAS_ORANI ?? 1,
          });
        }
      }

      // Fetch lines for Sarraf Fisi
      const sfIds = headers.filter((h) => h.KAYNAK === "SARRAF_FISI").map((h) => h.CARI_HAREKET_ID);
      const sfLinesMap = new Map<number, CariHareketSatiriModel[]>();
      if (sfIds.length > 0) {
        const sfQuery = `
          SELECT 
            OS.[SARRAF_FISI_ID],
            OS.[SATIR_NO],
            OS.[PARA_ID],
            OS.[TUTAR] AS [MEBLAG],
            ISNULL(NULLIF(RTRIM(OS.[PARA_KODU]), ''), RTRIM(P.[KOD])) AS [PARA_KOD],
            ISNULL(NULLIF(RTRIM(OS.[PARA_ADI]), ''), RTRIM(P.[AD])) AS [PARA_AD],
            ISNULL(P.[HAS_ORANI], 1) AS [HAS_ORANI]
          FROM [dbo].[TODVZ_ODEME_SATIRI] OS WITH (NOLOCK)
          LEFT JOIN [dbo].[TODVZ_PARA] P WITH (NOLOCK) ON OS.[PARA_ID] = P.[PARA_ID]
          WHERE OS.[SARRAF_FISI_ID] IN (${sfIds.join(",")})
          UNION ALL
          SELECT
            SFS.[SARRAF_FISI_ID],
            SFS.[SATIR_NO],
            ISNULL(SFS.[URUN_ID], 1) AS [PARA_ID],
            ISNULL(SFS.[TUTAR], SFS.[HAS_GRAM]) AS [MEBLAG],
            ISNULL(RTRIM(P.[KOD]), 'HAS') AS [PARA_KOD],
            ISNULL(RTRIM(P.[AD]), 'Has Altın') AS [PARA_AD],
            ISNULL(P.[HAS_ORANI], 1) AS [HAS_ORANI]
          FROM [dbo].[TODVZ_SARRAF_FISI_SATIRI] SFS WITH (NOLOCK)
          LEFT JOIN [dbo].[TODVZ_PARA] P WITH (NOLOCK) ON SFS.[URUN_ID] = P.[PARA_ID]
          WHERE SFS.[SARRAF_FISI_ID] IN (${sfIds.join(",")})
            AND NOT EXISTS (SELECT 1 FROM [dbo].[TODVZ_ODEME_SATIRI] WHERE SARRAF_FISI_ID = SFS.SARRAF_FISI_ID);
        `;
        const sfRes = await pool.request().query<any>(sfQuery);
        for (const line of sfRes.recordset || []) {
          if (!sfLinesMap.has(line.SARRAF_FISI_ID)) sfLinesMap.set(line.SARRAF_FISI_ID, []);
          sfLinesMap.get(line.SARRAF_FISI_ID)!.push({
            satirNo: line.SATIR_NO || 1,
            paraId: line.PARA_ID || 1,
            paraKodu: line.PARA_KOD || "TL",
            paraAdi: line.PARA_AD || "",
            meblag: line.MEBLAG || 0,
            hasOrani: line.HAS_ORANI ?? 1,
          });
        }
      }

      // Fetch lines for Doviz Fisi
      const dfIds = headers.filter((h) => h.KAYNAK === "DOVIZ_FISI").map((h) => h.CARI_HAREKET_ID);
      const dfLinesMap = new Map<number, CariHareketSatiriModel[]>();
      if (dfIds.length > 0) {
        const dfQuery = `
          SELECT 
            FS.[FIS_ID],
            FS.[SATIR_NO],
            FS.[PARA_ID],
            FS.[TUTAR] AS [MEBLAG],
            LTRIM(RTRIM(ISNULL(P.[KOD], ''))) AS [PARA_KOD],
            LTRIM(RTRIM(ISNULL(P.[AD], ''))) AS [PARA_AD],
            ISNULL(P.[HAS_ORANI], 1) AS [HAS_ORANI]
          FROM [dbo].[TODVZ_FIS_SATIRI] FS WITH (NOLOCK)
          LEFT JOIN [dbo].[TODVZ_PARA] P WITH (NOLOCK) ON FS.[PARA_ID] = P.[PARA_ID]
          WHERE FS.[FIS_ID] IN (${dfIds.join(",")});
        `;
        const dfRes = await pool.request().query<any>(dfQuery);
        for (const line of dfRes.recordset || []) {
          if (!dfLinesMap.has(line.FIS_ID)) dfLinesMap.set(line.FIS_ID, []);
          dfLinesMap.get(line.FIS_ID)!.push({
            satirNo: line.SATIR_NO || 1,
            paraId: line.PARA_ID || 1,
            paraKodu: line.PARA_KOD || "TL",
            paraAdi: line.PARA_AD || "",
            meblag: line.MEBLAG || 0,
            hasOrani: line.HAS_ORANI ?? 1,
          });
        }
      }

      // Fetch lines for Fatura
      const fatIds = headers.filter((h) => h.KAYNAK === "FATURA").map((h) => h.CARI_HAREKET_ID);
      const fatLinesMap = new Map<number, CariHareketSatiriModel[]>();
      if (fatIds.length > 0) {
        const fatQuery = `
          SELECT 
            FAT.[FATURA_ID],
            1 AS [SATIR_NO],
            1 AS [PARA_ID],
            FAT.[GENEL_TOPLAM] AS [MEBLAG],
            'TL' AS [PARA_KOD],
            'Türk Lirası' AS [PARA_AD],
            0 AS [HAS_ORANI]
          FROM [dbo].[TODVZ_FATURA] FAT WITH (NOLOCK)
          WHERE FAT.[FATURA_ID] IN (${fatIds.join(",")});
        `;
        const fatRes = await pool.request().query<any>(fatQuery);
        for (const line of fatRes.recordset || []) {
          if (!fatLinesMap.has(line.FATURA_ID)) fatLinesMap.set(line.FATURA_ID, []);
          fatLinesMap.get(line.FATURA_ID)!.push({
            satirNo: line.SATIR_NO,
            paraId: line.PARA_ID,
            paraKodu: line.PARA_KOD,
            paraAdi: line.PARA_AD,
            meblag: line.MEBLAG || 0,
            hasOrani: line.HAS_ORANI ?? 0,
          });
        }
      }

      const HAREKET_TIPI_ALL_LABELS: Record<number, string> = {
        0: "Nakit",
        1: "Banka / Havale",
        2: "POS / Kredi Kartı",
        3: "Dekont",
        4: "Virman",
        5: "Devir",
        10: "Sarraf Fişi",
        11: "Döviz Fişi",
        12: "Perakende Faturası",
      };

      return headers.map((h) => {
        let lines: CariHareketSatiriModel[] = [];
        if (h.KAYNAK === "CARI_HAREKET") lines = chLinesMap.get(h.CARI_HAREKET_ID) || [];
        else if (h.KAYNAK === "SARRAF_FISI") lines = sfLinesMap.get(h.CARI_HAREKET_ID) || [];
        else if (h.KAYNAK === "DOVIZ_FISI") lines = dfLinesMap.get(h.CARI_HAREKET_ID) || [];
        else if (h.KAYNAK === "FATURA") lines = fatLinesMap.get(h.CARI_HAREKET_ID) || [];

        const ozet = lines
          .map((l) => `${new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(l.meblag)} ${l.paraKodu}`)
          .join(", ");

        return {
          id: h.CARI_HAREKET_ID,
          cariKartId: h.CARI_KART_ID,
          cariKod: h.CARI_KOD || "",
          cariAd: h.CARI_AD || "",
          tarih: CariHareketSqlRepository.formatIsoDate(h.TARIH),
          hareketTipi: h.HAREKET_TIPI,
          hareketTipiLabel: HAREKET_TIPI_ALL_LABELS[h.HAREKET_TIPI] || "Diğer",
          aciklama: (h.ACIKLAMA || "").trim(),
          tip: h.TIP,
          tipLabel: h.TIP === 0 ? "Borç" : "Alacak",
          ekleyenId: h.EKLEYEN_ID || 1,
          eklemeZamani: CariHareketSqlRepository.formatIsoDate(h.EKLEME_ZAMANI),
          guncelleyenId: h.GUNCELLEYEN_ID || 1,
          guncellemeZamani: CariHareketSqlRepository.formatIsoDate(h.GUNCELLEME_ZAMANI),
          vezneId: h.VEZNE_ID || 1,
          vezneKod: h.VEZNE_KOD || "",
          vezneAd: h.VEZNE_AD || "",
          posCihaziId: h.POS_CIHAZI_ID ?? null,
          satirlar: lines,
          toplamSatirSayisi: lines.length,
          satirlarOzet: ozet,
        };
      });
    } catch (error) {
      logger.error("CariHareketSqlRepository.findAll error:", error);
      throw error;
    }
  }

  public static async findById(
    id: number | string,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<CariHareketModel | null> {
    try {
      const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
      await CariHareketSqlRepository.ensureTablesExist(pool);

      const request = pool.request();
      request.input("id", sql.Int, parseInt(String(id), 10));

      const query = `
        SELECT TOP 1
          H.[CARI_HAREKET_ID],
          H.[CARI_KART_ID],
          H.[TARIH],
          H.[HAREKET_TIPI],
          H.[ACIKLAMA],
          H.[TIP],
          H.[EKLEYEN_ID],
          H.[EKLEME_ZAMANI],
          H.[GUNCELLEYEN_ID],
          H.[GUNCELLEME_ZAMANI],
          H.[VEZNE_ID],
          H.[POS_CIHAZI_ID],
          LTRIM(RTRIM(ISNULL(C.[KOD], ''))) AS [CARI_KOD],
          LTRIM(RTRIM(ISNULL(C.[AD], ''))) AS [CARI_AD],
          LTRIM(RTRIM(ISNULL(V.[KOD], ''))) AS [VEZNE_KOD],
          LTRIM(RTRIM(ISNULL(V.[AD], ''))) AS [VEZNE_AD]
        FROM [dbo].[TODVZ_CARI_HAREKET] H
        LEFT JOIN [dbo].[TODVZ_CARI_KART] C ON H.[CARI_KART_ID] = C.[CARI_KART_ID]
        LEFT JOIN [dbo].[TODVZ_VEZNE] V ON H.[VEZNE_ID] = V.[VEZNE_ID]
        WHERE H.[CARI_HAREKET_ID] = @id;
      `;

      const result = await request.query<TodvzCariHareketEntity>(query);
      if (!result.recordset || result.recordset.length === 0) return null;

      const h = result.recordset[0];

      // Fetch lines
      const lineRequest = pool.request();
      lineRequest.input("id", sql.Int, h.CARI_HAREKET_ID);
      const linesResult = await lineRequest.query<TodvzCariHareketSatiriEntity>(`
        SELECT 
          S.[CARI_HAREKET_ID],
          S.[SATIR_NO],
          S.[PARA_ID],
          S.[MEBLAG],
          LTRIM(RTRIM(ISNULL(P.[KOD], ''))) AS [PARA_KOD],
          LTRIM(RTRIM(ISNULL(P.[AD], ''))) AS [PARA_AD],
          P.[HAS_ORANI]
        FROM [dbo].[TODVZ_CARI_HAREKET_SATIRI] S
        LEFT JOIN [dbo].[TODVZ_PARA] P ON S.[PARA_ID] = P.[PARA_ID]
        WHERE S.[CARI_HAREKET_ID] = @id
        ORDER BY S.[SATIR_NO] ASC;
      `);

      const lines: CariHareketSatiriModel[] = (linesResult.recordset || []).map((l) => ({
        satirNo: l.SATIR_NO,
        paraId: l.PARA_ID,
        paraKodu: l.PARA_KOD || "",
        paraAdi: l.PARA_AD || "",
        meblag: l.MEBLAG || 0,
        hasOrani: l.HAS_ORANI ?? 1,
      }));

      const ozet = lines
        .map((l) => `${new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(l.meblag)} ${l.paraKodu}`)
        .join(", ");

      return {
        id: h.CARI_HAREKET_ID,
        cariKartId: h.CARI_KART_ID,
        cariKod: h.CARI_KOD || "",
        cariAd: h.CARI_AD || "",
        tarih: CariHareketSqlRepository.formatIsoDate(h.TARIH),
        hareketTipi: h.HAREKET_TIPI,
        hareketTipiLabel: HAREKET_TIPI_LABELS[h.HAREKET_TIPI] || "Diğer",
        aciklama: (h.ACIKLAMA || "").trim(),
        tip: h.TIP,
        tipLabel: h.TIP === 0 ? "Borç" : "Alacak",
        ekleyenId: h.EKLEYEN_ID,
        eklemeZamani: CariHareketSqlRepository.formatIsoDate(h.EKLEME_ZAMANI),
        guncelleyenId: h.GUNCELLEYEN_ID,
        guncellemeZamani: CariHareketSqlRepository.formatIsoDate(h.GUNCELLEME_ZAMANI),
        vezneId: h.VEZNE_ID,
        vezneKod: h.VEZNE_KOD || "",
        vezneAd: h.VEZNE_AD || "",
        posCihaziId: h.POS_CIHAZI_ID ?? null,
        satirlar: lines,
        toplamSatirSayisi: lines.length,
        satirlarOzet: ozet,
      };
    } catch (error) {
      logger.error(`CariHareketSqlRepository.findById(${id}) error:`, error);
      throw error;
    }
  }

  public static async create(
    data: CariHareketInputDto,
    userId: number = 1,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<CariHareketModel> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await CariHareketSqlRepository.ensureTablesExist(pool);

    const transaction = new sql.Transaction(pool);
    try {
      await transaction.begin();

      const headerRequest = new sql.Request(transaction);
      headerRequest.input("CARI_KART_ID", sql.Int, data.cariKartId);
      headerRequest.input("TARIH", sql.DateTime, data.tarih ? new Date(data.tarih) : new Date());
      headerRequest.input("HAREKET_TIPI", sql.TinyInt, data.hareketTipi ?? 0);
      headerRequest.input("ACIKLAMA", sql.VarChar(100), (data.aciklama || "").trim().slice(0, 100));
      headerRequest.input("TIP", sql.TinyInt, data.tip ?? 0);
      headerRequest.input("EKLEYEN_ID", sql.Int, userId);
      headerRequest.input("GUNCELLEYEN_ID", sql.Int, userId);
      headerRequest.input("VEZNE_ID", sql.Int, data.vezneId);
      headerRequest.input("POS_CIHAZI_ID", sql.Int, data.posCihaziId || null);

      const insertHeaderQuery = `
        INSERT INTO [dbo].[TODVZ_CARI_HAREKET] (
          [CARI_KART_ID], [TARIH], [HAREKET_TIPI], [ACIKLAMA], [TIP],
          [EKLEYEN_ID], [EKLEME_ZAMANI], [GUNCELLEYEN_ID], [GUNCELLEME_ZAMANI],
          [VEZNE_ID], [POS_CIHAZI_ID]
        )
        VALUES (
          @CARI_KART_ID, @TARIH, @HAREKET_TIPI, @ACIKLAMA, @TIP,
          @EKLEYEN_ID, GETDATE(), @GUNCELLEYEN_ID, GETDATE(),
          @VEZNE_ID, @POS_CIHAZI_ID
        );
        SELECT CAST(SCOPE_IDENTITY() AS INT) AS [CARI_HAREKET_ID];
      `;

      const headerRes = await headerRequest.query<{ CARI_HAREKET_ID: number }>(insertHeaderQuery);
      const newId = headerRes.recordset[0]?.CARI_HAREKET_ID;
      if (!newId) {
        throw new Error("Cari hareket başlığı oluşturulamadı.");
      }

      // Insert lines
      const validLines = (data.satirlar || []).filter((s) => s.paraId && s.meblag > 0);
      for (let i = 0; i < validLines.length; i++) {
        const line = validLines[i];
        const lineReq = new sql.Request(transaction);
        lineReq.input("CARI_HAREKET_ID", sql.Int, newId);
        lineReq.input("SATIR_NO", sql.Int, i + 1);
        lineReq.input("PARA_ID", sql.Int, line.paraId);
        lineReq.input("MEBLAG", sql.Float, Number(line.meblag));

        await lineReq.query(`
          INSERT INTO [dbo].[TODVZ_CARI_HAREKET_SATIRI] ([CARI_HAREKET_ID], [SATIR_NO], [PARA_ID], [MEBLAG])
          VALUES (@CARI_HAREKET_ID, @SATIR_NO, @PARA_ID, @MEBLAG);
        `);
      }

      await transaction.commit();

      const created = await CariHareketSqlRepository.findById(newId, dbContext);
      if (!created) {
        throw ApiError.internal("Cari hareket eklendi ancak veri okunamadı.");
      }
      return created;
    } catch (error) {
      await transaction.rollback();
      logger.error("CariHareketSqlRepository.create error:", error);
      throw error;
    }
  }

  public static async update(
    id: number | string,
    data: CariHareketInputDto,
    userId: number = 1,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<CariHareketModel> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await CariHareketSqlRepository.ensureTablesExist(pool);

    const transaction = new sql.Transaction(pool);
    try {
      await transaction.begin();

      const numId = parseInt(String(id), 10);
      const headerRequest = new sql.Request(transaction);
      headerRequest.input("CARI_HAREKET_ID", sql.Int, numId);
      headerRequest.input("CARI_KART_ID", sql.Int, data.cariKartId);
      headerRequest.input("TARIH", sql.DateTime, data.tarih ? new Date(data.tarih) : new Date());
      headerRequest.input("HAREKET_TIPI", sql.TinyInt, data.hareketTipi ?? 0);
      headerRequest.input("ACIKLAMA", sql.VarChar(100), (data.aciklama || "").trim().slice(0, 100));
      headerRequest.input("TIP", sql.TinyInt, data.tip ?? 0);
      headerRequest.input("GUNCELLEYEN_ID", sql.Int, userId);
      headerRequest.input("VEZNE_ID", sql.Int, data.vezneId);
      headerRequest.input("POS_CIHAZI_ID", sql.Int, data.posCihaziId || null);

      await headerRequest.query(`
        UPDATE [dbo].[TODVZ_CARI_HAREKET]
        SET
          [CARI_KART_ID] = @CARI_KART_ID,
          [TARIH] = @TARIH,
          [HAREKET_TIPI] = @HAREKET_TIPI,
          [ACIKLAMA] = @ACIKLAMA,
          [TIP] = @TIP,
          [GUNCELLEYEN_ID] = @GUNCELLEYEN_ID,
          [GUNCELLEME_ZAMANI] = GETDATE(),
          [VEZNE_ID] = @VEZNE_ID,
          [POS_CIHAZI_ID] = @POS_CIHAZI_ID
        WHERE [CARI_HAREKET_ID] = @CARI_HAREKET_ID;
      `);

      // Delete existing lines
      const delReq = new sql.Request(transaction);
      delReq.input("CARI_HAREKET_ID", sql.Int, numId);
      await delReq.query("DELETE FROM [dbo].[TODVZ_CARI_HAREKET_SATIRI] WHERE [CARI_HAREKET_ID] = @CARI_HAREKET_ID;");

      // Insert new lines
      const validLines = (data.satirlar || []).filter((s) => s.paraId && s.meblag > 0);
      for (let i = 0; i < validLines.length; i++) {
        const line = validLines[i];
        const lineReq = new sql.Request(transaction);
        lineReq.input("CARI_HAREKET_ID", sql.Int, numId);
        lineReq.input("SATIR_NO", sql.Int, i + 1);
        lineReq.input("PARA_ID", sql.Int, line.paraId);
        lineReq.input("MEBLAG", sql.Float, Number(line.meblag));

        await lineReq.query(`
          INSERT INTO [dbo].[TODVZ_CARI_HAREKET_SATIRI] ([CARI_HAREKET_ID], [SATIR_NO], [PARA_ID], [MEBLAG])
          VALUES (@CARI_HAREKET_ID, @SATIR_NO, @PARA_ID, @MEBLAG);
        `);
      }

      await transaction.commit();

      const updated = await CariHareketSqlRepository.findById(numId, dbContext);
      if (!updated) {
        throw ApiError.internal("Cari hareket güncellendi ancak okunamadı.");
      }
      return updated;
    } catch (error) {
      await transaction.rollback();
      logger.error(`CariHareketSqlRepository.update(${id}) error:`, error);
      throw error;
    }
  }

  public static async delete(
    id: number | string,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<boolean> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await CariHareketSqlRepository.ensureTablesExist(pool);

    const transaction = new sql.Transaction(pool);
    try {
      await transaction.begin();
      const numId = parseInt(String(id), 10);

      const delLines = new sql.Request(transaction);
      delLines.input("CARI_HAREKET_ID", sql.Int, numId);
      await delLines.query("DELETE FROM [dbo].[TODVZ_CARI_HAREKET_SATIRI] WHERE [CARI_HAREKET_ID] = @CARI_HAREKET_ID;");

      const delHeader = new sql.Request(transaction);
      delHeader.input("CARI_HAREKET_ID", sql.Int, numId);
      const res = await delHeader.query("DELETE FROM [dbo].[TODVZ_CARI_HAREKET] WHERE [CARI_HAREKET_ID] = @CARI_HAREKET_ID;");

      await transaction.commit();
      return (res.rowsAffected[0] || 0) > 0;
    } catch (error) {
      await transaction.rollback();
      logger.error(`CariHareketSqlRepository.delete(${id}) error:`, error);
      throw error;
    }
  }

  public static async getNavigationIds(
    currentId?: number | string,
    dbContext?: { dbServer?: string; dbName?: string }
  ) {
    try {
      const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
      await CariHareketSqlRepository.ensureTablesExist(pool);

      const query = `
        SELECT [CARI_HAREKET_ID]
        FROM [dbo].[TODVZ_CARI_HAREKET]
        ORDER BY [CARI_HAREKET_ID] ASC;
      `;
      const res = await pool.request().query<{ CARI_HAREKET_ID: number }>(query);
      const ids = (res.recordset || []).map((r) => r.CARI_HAREKET_ID);

      if (ids.length === 0) {
        return { firstId: null, prevId: null, nextId: null, lastId: null, currentIndex: -1, total: 0 };
      }

      const firstId = ids[0];
      const lastId = ids[ids.length - 1];

      if (!currentId) {
        return { firstId, prevId: null, nextId: ids[1] || null, lastId, currentIndex: 0, total: ids.length };
      }

      const cur = parseInt(String(currentId), 10);
      const idx = ids.indexOf(cur);

      return {
        firstId,
        prevId: idx > 0 ? ids[idx - 1] : null,
        nextId: idx >= 0 && idx < ids.length - 1 ? ids[idx + 1] : null,
        lastId,
        currentIndex: idx,
        total: ids.length,
      };
    } catch (error) {
      logger.error("CariHareketSqlRepository.getNavigationIds error:", error);
      return { firstId: null, prevId: null, nextId: null, lastId: null, currentIndex: -1, total: 0 };
    }
  }

  /**
   * Calculates the real-time balance breakdown of a Cari Kart for all currencies.
   */
  public static async getCariBakiye(
    cariKartId: number | string,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<CariBakiyeSummary> {
    try {
      const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
      await CariHareketSqlRepository.ensureTablesExist(pool);

      const id = parseInt(String(cariKartId), 10);

      // 1. Get Cari Card details
      const cariRes = await pool
        .request()
        .input("id", sql.Int, id)
        .query<{ CARI_KART_ID: number; KOD: string; AD: string }>(`
          SELECT [CARI_KART_ID], LTRIM(RTRIM(ISNULL([KOD], ''))) AS [KOD], LTRIM(RTRIM(ISNULL([AD], ''))) AS [AD]
          FROM [dbo].[TODVZ_CARI_KART] WITH (NOLOCK)
          WHERE [CARI_KART_ID] = @id;
        `);

      const cari = cariRes.recordset[0] || { CARI_KART_ID: id, KOD: "", AD: "" };

      // 2. Aggregate all lines across all sources for this customer
      // TIP = 0: Borç, TIP = 1: Alacak
      const bakiyeQuery = `
        WITH AllMovements AS (
          -- 1. TODVZ_CARI_HAREKET
          SELECT 
            S.[PARA_ID],
            CASE WHEN H.[TIP] = 0 THEN S.[MEBLAG] ELSE 0 END AS [BORC],
            CASE WHEN H.[TIP] = 1 THEN S.[MEBLAG] ELSE 0 END AS [ALACAK]
          FROM [dbo].[TODVZ_CARI_HAREKET_SATIRI] S WITH (NOLOCK)
          INNER JOIN [dbo].[TODVZ_CARI_HAREKET] H WITH (NOLOCK) ON S.[CARI_HAREKET_ID] = H.[CARI_HAREKET_ID]
          WHERE H.[CARI_KART_ID] = @id

          UNION ALL

          -- 2. TODVZ_SARRAF_FISI (Ödeme satırları - Cari Açık Hesap)
          SELECT 
            OS.[PARA_ID],
            CASE WHEN SF.[TIP] = 1 THEN OS.[TUTAR] ELSE 0 END AS [BORC],
            CASE WHEN SF.[TIP] = 0 THEN OS.[TUTAR] ELSE 0 END AS [ALACAK]
          FROM [dbo].[TODVZ_ODEME_SATIRI] OS WITH (NOLOCK)
          INNER JOIN [dbo].[TODVZ_SARRAF_FISI] SF WITH (NOLOCK) ON OS.[SARRAF_FISI_ID] = SF.[SARRAF_FISI_ID]
          WHERE (OS.[CARI_KART_ID] = @id OR (SF.[CARI_KART_ID] = @id AND OS.[ODEME_ARACI_TURU] = 1))

          UNION ALL

          -- 2b. TODVZ_SARRAF_FISI (Doğrudan fiş satırları eğer ödeme satırı yoksa)
          SELECT 
            ISNULL(SFS.[URUN_ID], 1) AS [PARA_ID],
            CASE WHEN SF.[TIP] = 1 THEN ISNULL(SFS.[TUTAR], SFS.[HAS_GRAM]) ELSE 0 END AS [BORC],
            CASE WHEN SF.[TIP] = 0 THEN ISNULL(SFS.[TUTAR], SFS.[HAS_GRAM]) ELSE 0 END AS [ALACAK]
          FROM [dbo].[TODVZ_SARRAF_FISI_SATIRI] SFS WITH (NOLOCK)
          INNER JOIN [dbo].[TODVZ_SARRAF_FISI] SF WITH (NOLOCK) ON SFS.[SARRAF_FISI_ID] = SF.[SARRAF_FISI_ID]
          WHERE SF.[CARI_KART_ID] = @id
            AND NOT EXISTS (SELECT 1 FROM [dbo].[TODVZ_ODEME_SATIRI] WHERE SARRAF_FISI_ID = SF.SARRAF_FISI_ID)

          UNION ALL

          -- 3. TODVZ_FIS (Döviz Fişi)
          SELECT 
            FS.[PARA_ID],
            CASE WHEN F.[TIP] = 1 THEN FS.[TUTAR] ELSE 0 END AS [BORC],
            CASE WHEN F.[TIP] = 0 THEN FS.[TUTAR] ELSE 0 END AS [ALACAK]
          FROM [dbo].[TODVZ_FIS_SATIRI] FS WITH (NOLOCK)
          INNER JOIN [dbo].[TODVZ_FIS] F WITH (NOLOCK) ON FS.[FIS_ID] = F.[FIS_ID]
          WHERE F.[CARI_KART_ID] = @id AND ISNULL(F.[IPTAL], 0) = 0

          UNION ALL

          -- 4. TODVZ_FATURA (Perakende Faturası)
          SELECT 
            1 AS [PARA_ID], -- TL
            CASE WHEN FAT.[FATURA_TIPI] = 1 THEN FAT.[GENEL_TOPLAM] ELSE 0 END AS [BORC],
            CASE WHEN FAT.[FATURA_TIPI] = 2 THEN FAT.[GENEL_TOPLAM] ELSE 0 END AS [ALACAK]
          FROM [dbo].[TODVZ_FATURA] FAT WITH (NOLOCK)
          WHERE (FAT.[CARI_KART_ID] = @id OR EXISTS (SELECT 1 FROM [dbo].[TODVZ_FATURA_ODEME] WHERE FATURA_ID = FAT.FATURA_ID AND CARI_KART_ID = @id))
        )
        SELECT 
          M.[PARA_ID],
          LTRIM(RTRIM(ISNULL(P.[KOD], 'TL'))) AS [PARA_KOD],
          LTRIM(RTRIM(ISNULL(P.[AD], 'Türk Lirası'))) AS [PARA_AD],
          ISNULL(P.[HAS_ORANI], 1) AS [HAS_ORANI],
          ISNULL(P.[SIRA_NO], 99) AS [SIRA_NO],
          SUM(M.[BORC]) AS [TOPLAM_BORC],
          SUM(M.[ALACAK]) AS [TOPLAM_ALACAK]
        FROM AllMovements M
        LEFT JOIN [dbo].[TODVZ_PARA] P WITH (NOLOCK) ON M.[PARA_ID] = P.[PARA_ID]
        GROUP BY M.[PARA_ID], P.[KOD], P.[AD], P.[HAS_ORANI], P.[SIRA_NO]
        ORDER BY ISNULL(P.[SIRA_NO], 99) ASC, P.[KOD] ASC;
      `;

      const result = await pool.request().input("id", sql.Int, id).query<{
        PARA_ID: number;
        PARA_KOD: string;
        PARA_AD: string;
        HAS_ORANI: number;
        SIRA_NO: number;
        TOPLAM_BORC: number;
        TOPLAM_ALACAK: number;
      }>(bakiyeQuery);

      const rows: CariBakiyeRow[] = [];
      let totalNetHas = 0; // positive = Alacak, negative = Borç

      for (const r of result.recordset || []) {
        const borc = r.TOPLAM_BORC || 0;
        const alacak = r.TOPLAM_ALACAK || 0;
        const diff = alacak - borc; // > 0 Alacak, < 0 Borç

        let borcBakiye = 0;
        let alacakBakiye = 0;
        let yon: "B" | "A" | "-" = "-";

        if (diff < -0.0001) {
          borcBakiye = Math.abs(diff);
          yon = "B";
        } else if (diff > 0.0001) {
          alacakBakiye = diff;
          yon = "A";
        }

        const hasOrani = r.HAS_ORANI || 1;
        const isGoldOrHas = (r.PARA_KOD || "").toUpperCase().includes("HAS") || hasOrani > 0;
        if (isGoldOrHas && (borcBakiye > 0 || alacakBakiye > 0)) {
          totalNetHas += diff * hasOrani;
        }

        if (borc > 0 || alacak > 0 || borcBakiye > 0 || alacakBakiye > 0) {
          rows.push({
            paraId: r.PARA_ID || 1,
            kod: r.PARA_KOD || "TL",
            ad: r.PARA_AD || "Türk Lirası",
            borcBakiye,
            alacakBakiye,
            netBakiye: Math.abs(diff),
            yon,
            hasOrani,
          });
        }
      }

      let netHasYon: "B" | "A" | "-" = "-";
      let absHas = Math.abs(totalNetHas);
      if (totalNetHas > 0.001) {
        netHasYon = "A";
      } else if (totalNetHas < -0.001) {
        netHasYon = "B";
      }

      const formattedHas = new Intl.NumberFormat("tr-TR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(absHas);

      const headerLabel = absHas > 0.001 ? `${formattedHas} HAS ${netHasYon}` : "HAS 0.00";

      return {
        cariKartId: id,
        kod: cari.KOD,
        ad: cari.AD,
        satirlar: rows,
        netHasBakiye: absHas,
        netHasYon,
        headerLabel,
      };
    } catch (error) {
      logger.error(`CariHareketSqlRepository.getCariBakiye(${cariKartId}) error:`, error);
      return {
        cariKartId: Number(cariKartId),
        kod: "",
        ad: "",
        satirlar: [],
        netHasBakiye: 0,
        netHasYon: "-",
        headerLabel: "HAS 0.00",
      };
    }
  }
}
