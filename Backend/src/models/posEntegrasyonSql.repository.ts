import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { logger } from "../utils/logger.js";
import {
  DbContext,
  PosBankaEsleme,
  PosDurum,
  PosIadeDurumu,
  PosIslem,
  PosIslemOlustur,
  PosTerminal,
  PosTerminalKaydet,
  SurucuSonuc,
} from "../services/pos/pos.types.js";

// POS cihazı entegrasyonu — docs/POS_ENTEGRASYON_YOL_HARITASI.md
// Fiziksel cihazlar (TODVZ_POS_TERMINAL) muhasebe POS kartlarından (TODVZ_POS_CIHAZI) ayrıdır (K15).

export interface PosIslemFiltre {
  baslangic?: string;
  bitis?: string;
  durum?: string;
  posTerminalId?: number;
  arama?: string;
  sayfa?: number;
  sayfaBoyutu?: number;
}

export interface VomsisPosSatiri {
  vomsisId: number;
  islemTarihi: string | null;
  saat: string | null;
  bankaAdi: string;
  kartNo: string | null;
  brut: number;
  taksitSayisi: number | null;
  provizyonNo: string | null;
}

const zaman = (d: Date | null | undefined): string | null => (d ? new Date(d).toISOString() : null);
const metin = (v: unknown): string | null => (v === null || v === undefined || String(v).trim() === "" ? null : String(v).trim());

const ISLEM_SECIMI = `
  SELECT i.*, DATEDIFF(SECOND, i.GONDERIM_ZAMANI, GETDATE()) AS GECEN_SN,
    t.AD AS TERMINAL_AD, p.KOD AS POS_CIHAZI_KOD, p.AD AS POS_CIHAZI_AD,
    k.AD AS KULLANICI_AD, ke.AD AS ELLE_KULLANICI_AD, ki.AD AS IADE_KULLANICI_AD
  FROM TODVZ_POS_ISLEM i
  LEFT JOIN TODVZ_POS_TERMINAL t ON t.POS_TERMINAL_ID = i.POS_TERMINAL_ID
  LEFT JOIN TODVZ_POS_CIHAZI p ON p.POS_CIHAZI_ID = i.POS_CIHAZI_ID
  LEFT JOIN TODVZ_KULLANICI k ON k.KULLANICI_ID = i.KULLANICI_ID
  LEFT JOIN TODVZ_KULLANICI ke ON ke.KULLANICI_ID = i.ELLE_KULLANICI_ID
  LEFT JOIN TODVZ_KULLANICI ki ON ki.KULLANICI_ID = i.IADE_KULLANICI_ID
`;

const islemden = (r: any): PosIslem => ({
  posIslemId: r.POS_ISLEM_ID,
  istekKimlik: r.ISTEK_KIMLIK,
  posTerminalId: r.POS_TERMINAL_ID ?? null,
  terminalAd: metin(r.TERMINAL_AD),
  entegrasyon: r.ENTEGRASYON,
  mod: r.MOD === "canli" ? "canli" : "test",
  belgeTuru: r.BELGE_TURU,
  belgeId: r.BELGE_ID ?? null,
  belgeNo: metin(r.BELGE_NO),
  belgeTipi: r.BELGE_TIPI === "efatura" ? "efatura" : "earsiv",
  tutar: Number(r.TUTAR) || 0,
  durum: r.DURUM,
  elle: Boolean(r.ELLE),
  elleKullanici: metin(r.ELLE_KULLANICI_AD),
  elleZamani: zaman(r.ELLE_ZAMANI),
  iadeDurumu: (Number(r.IADE_DURUMU) || 0) as PosIadeDurumu,
  iadeKullanici: metin(r.IADE_KULLANICI_AD),
  iadeZamani: zaman(r.IADE_ZAMANI),
  bankaKodu: metin(r.BANKA_KODU),
  bankaAdi: metin(r.BANKA_ADI),
  taksit: r.TAKSIT ?? null,
  onayKodu: metin(r.ONAY_KODU),
  kartNo: metin(r.KART_NO),
  cihazFisNo: metin(r.CIHAZ_FIS_NO),
  zNo: metin(r.Z_NO),
  hata: metin(r.HATA),
  surucuRef: metin(r.SURUCU_REF),
  posCihaziId: r.POS_CIHAZI_ID ?? null,
  posCihaziKod: metin(r.POS_CIHAZI_KOD),
  posCihaziAd: metin(r.POS_CIHAZI_AD),
  vezneId: r.VEZNE_ID ?? null,
  kullanici: metin(r.KULLANICI_AD),
  olusturma: zaman(r.OLUSTURMA)!,
  sonucZamani: zaman(r.SONUC_ZAMANI),
  gecenSaniye: r.GECEN_SN ?? null,
});

export class PosEntegrasyonSqlRepository {
  public static async ensureTables(pool: sql.ConnectionPool): Promise<void> {
    try {
      await pool.request().batch(`
        IF OBJECT_ID('TODVZ_POS_TERMINAL', 'U') IS NULL
        BEGIN
          CREATE TABLE [dbo].[TODVZ_POS_TERMINAL] (
            [POS_TERMINAL_ID] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            [AD] NVARCHAR(100) NOT NULL,
            [ENTEGRASYON] VARCHAR(10) NOT NULL DEFAULT 'yok',
            [MODEL] VARCHAR(30) NULL,
            [SICIL_NO] VARCHAR(50) NULL,
            [TERMINAL_KIMLIK] VARCHAR(100) NULL,
            [POS_CIHAZI_ID] INT NULL,
            [AKTIF] BIT NOT NULL DEFAULT 1,
            [OLUSTURMA] DATETIME NOT NULL DEFAULT GETDATE()
          );
        END;

        IF OBJECT_ID('TODVZ_POS_TERMINAL_VEZNE', 'U') IS NULL
        BEGIN
          CREATE TABLE [dbo].[TODVZ_POS_TERMINAL_VEZNE] (
            [POS_TERMINAL_ID] INT NOT NULL,
            [VEZNE_ID] INT NOT NULL,
            CONSTRAINT [PK_TODVZ_POS_TERMINAL_VEZNE] PRIMARY KEY ([POS_TERMINAL_ID], [VEZNE_ID])
          );
        END;

        IF OBJECT_ID('TODVZ_POS_BANKA_ESLEME', 'U') IS NULL
        BEGIN
          CREATE TABLE [dbo].[TODVZ_POS_BANKA_ESLEME] (
            [BANKA_KODU] NVARCHAR(100) NOT NULL PRIMARY KEY,
            [POS_CIHAZI_ID] INT NOT NULL
          );
        END;

        IF OBJECT_ID('TODVZ_POS_ISLEM', 'U') IS NULL
        BEGIN
          CREATE TABLE [dbo].[TODVZ_POS_ISLEM] (
            [POS_ISLEM_ID] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            [ISTEK_KIMLIK] VARCHAR(40) NOT NULL,
            [POS_TERMINAL_ID] INT NULL,
            [ENTEGRASYON] VARCHAR(10) NOT NULL,
            [MOD] VARCHAR(10) NOT NULL,
            [BELGE_TURU] VARCHAR(15) NOT NULL,
            [BELGE_ID] INT NULL,
            [BELGE_NO] VARCHAR(50) NULL,
            [BELGE_TIPI] VARCHAR(10) NOT NULL DEFAULT 'earsiv',
            [TUTAR] DECIMAL(18,2) NOT NULL,
            [DURUM] VARCHAR(15) NOT NULL,
            [ELLE] BIT NOT NULL DEFAULT 0,
            [ELLE_KULLANICI_ID] INT NULL,
            [ELLE_ZAMANI] DATETIME NULL,
            [IADE_DURUMU] TINYINT NOT NULL DEFAULT 0,
            [IADE_KULLANICI_ID] INT NULL,
            [IADE_ZAMANI] DATETIME NULL,
            [BANKA_KODU] NVARCHAR(100) NULL,
            [BANKA_ADI] NVARCHAR(100) NULL,
            [TAKSIT] INT NULL,
            [ONAY_KODU] VARCHAR(50) NULL,
            [KART_NO] VARCHAR(30) NULL,
            [CIHAZ_FIS_NO] VARCHAR(30) NULL,
            [Z_NO] VARCHAR(20) NULL,
            [HATA] NVARCHAR(300) NULL,
            [SURUCU_REF] VARCHAR(100) NULL,
            [HAM] NVARCHAR(MAX) NULL,
            [POS_CIHAZI_ID] INT NULL,
            [VEZNE_ID] INT NULL,
            [KULLANICI_ID] INT NULL,
            [OLUSTURMA] DATETIME NOT NULL DEFAULT GETDATE(),
            [GONDERIM_ZAMANI] DATETIME NULL,
            [SONUC_ZAMANI] DATETIME NULL
          );
          CREATE UNIQUE INDEX [UX_TODVZ_POS_ISLEM_ISTEK] ON [dbo].[TODVZ_POS_ISLEM] ([ISTEK_KIMLIK]);
          CREATE INDEX [IX_TODVZ_POS_ISLEM_BELGE] ON [dbo].[TODVZ_POS_ISLEM] ([BELGE_TURU], [BELGE_ID]);
          CREATE INDEX [IX_TODVZ_POS_ISLEM_TARIH] ON [dbo].[TODVZ_POS_ISLEM] ([OLUSTURMA] DESC);
        END;
      `);
    } catch (err: any) {
      logger.warn(`[PosEntegrasyonSqlRepository.ensureTables] Warning: ${err.message}`);
    }
  }

  private static async pool(dbContext?: DbContext): Promise<sql.ConnectionPool> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    await this.ensureTables(pool);
    return pool;
  }

  // ─── Terminaller ───────────────────────────────────────────────────────────

  private static async terminaller(pool: sql.ConnectionPool, kosul: string, hazirla?: (r: sql.Request) => void): Promise<PosTerminal[]> {
    const req = pool.request();
    hazirla?.(req);
    const rows = (
      await req.query(`
        SELECT t.*, p.KOD AS POS_CIHAZI_KOD, p.AD AS POS_CIHAZI_AD
        FROM TODVZ_POS_TERMINAL t
        LEFT JOIN TODVZ_POS_CIHAZI p ON p.POS_CIHAZI_ID = t.POS_CIHAZI_ID
        ${kosul}
        ORDER BY t.AD
      `)
    ).recordset;
    if (!rows.length) return [];
    const vezneler = (await pool.request().query(`SELECT POS_TERMINAL_ID, VEZNE_ID FROM TODVZ_POS_TERMINAL_VEZNE`)).recordset;
    return rows.map((r: any) => ({
      posTerminalId: r.POS_TERMINAL_ID,
      ad: r.AD,
      entegrasyon: r.ENTEGRASYON,
      model: metin(r.MODEL),
      sicilNo: metin(r.SICIL_NO),
      terminalKimlik: metin(r.TERMINAL_KIMLIK),
      posCihaziId: r.POS_CIHAZI_ID ?? null,
      posCihaziKod: metin(r.POS_CIHAZI_KOD),
      posCihaziAd: metin(r.POS_CIHAZI_AD),
      aktif: Boolean(r.AKTIF),
      vezneIdler: vezneler.filter((v: any) => v.POS_TERMINAL_ID === r.POS_TERMINAL_ID).map((v: any) => v.VEZNE_ID as number),
    }));
  }

  public static async terminalleriListele(dbContext?: DbContext): Promise<PosTerminal[]> {
    return this.terminaller(await this.pool(dbContext), "");
  }

  public static async terminalGetir(posTerminalId: number, dbContext?: DbContext): Promise<PosTerminal | null> {
    const liste = await this.terminaller(await this.pool(dbContext), "WHERE t.POS_TERMINAL_ID = @ID", (r) => r.input("ID", sql.Int, posTerminalId));
    return liste[0] ?? null;
  }

  /** Veznenin kullanabildiği aktif cihazlar. Hiçbir vezneye bağlanmamış cihazı her vezne kullanır (K24). */
  public static async vezneTerminalleri(vezneId: number | null, dbContext?: DbContext): Promise<PosTerminal[]> {
    const liste = await this.terminaller(await this.pool(dbContext), "WHERE t.AKTIF = 1");
    return liste.filter((t) => t.vezneIdler.length === 0 || (vezneId !== null && t.vezneIdler.includes(vezneId)));
  }

  public static async terminalKaydet(dto: PosTerminalKaydet, dbContext?: DbContext): Promise<number> {
    const pool = await this.pool(dbContext);
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      const req = new sql.Request(tx);
      req.input("ID", sql.Int, dto.posTerminalId ?? null);
      req.input("AD", sql.NVarChar(100), dto.ad);
      req.input("ENTEGRASYON", sql.VarChar(10), dto.entegrasyon);
      req.input("MODEL", sql.VarChar(30), dto.model);
      req.input("SICIL_NO", sql.VarChar(50), dto.sicilNo);
      req.input("TERMINAL_KIMLIK", sql.VarChar(100), dto.terminalKimlik);
      req.input("POS_CIHAZI_ID", sql.Int, dto.posCihaziId);
      req.input("AKTIF", sql.Bit, dto.aktif ? 1 : 0);
      const id: number = (
        await req.query(`
          IF @ID IS NULL
          BEGIN
            INSERT INTO TODVZ_POS_TERMINAL (AD, ENTEGRASYON, MODEL, SICIL_NO, TERMINAL_KIMLIK, POS_CIHAZI_ID, AKTIF)
            VALUES (@AD, @ENTEGRASYON, @MODEL, @SICIL_NO, @TERMINAL_KIMLIK, @POS_CIHAZI_ID, @AKTIF);
            SELECT CAST(SCOPE_IDENTITY() AS INT) AS ID;
          END
          ELSE
          BEGIN
            UPDATE TODVZ_POS_TERMINAL SET AD = @AD, ENTEGRASYON = @ENTEGRASYON, MODEL = @MODEL, SICIL_NO = @SICIL_NO,
              TERMINAL_KIMLIK = @TERMINAL_KIMLIK, POS_CIHAZI_ID = @POS_CIHAZI_ID, AKTIF = @AKTIF
            WHERE POS_TERMINAL_ID = @ID;
            SELECT CASE WHEN @@ROWCOUNT > 0 THEN @ID ELSE NULL END AS ID;
          END
        `)
      ).recordset[0]?.ID;
      if (!id) throw new Error("POS cihazı bulunamadı.");

      await new sql.Request(tx).input("ID", sql.Int, id).query(`DELETE FROM TODVZ_POS_TERMINAL_VEZNE WHERE POS_TERMINAL_ID = @ID`);
      for (const vezneId of [...new Set(dto.vezneIdler)]) {
        await new sql.Request(tx)
          .input("ID", sql.Int, id)
          .input("VEZNE_ID", sql.Int, vezneId)
          .query(`INSERT INTO TODVZ_POS_TERMINAL_VEZNE (POS_TERMINAL_ID, VEZNE_ID) VALUES (@ID, @VEZNE_ID)`);
      }
      await tx.commit();
      return id;
    } catch (err) {
      await tx.rollback().catch(() => undefined);
      throw err;
    }
  }

  /** İşlemi olan cihaz silinmez (kayıtlar cihaz adını gösterir); false döner. */
  public static async terminalSil(posTerminalId: number, dbContext?: DbContext): Promise<boolean> {
    const pool = await this.pool(dbContext);
    const r = await pool.request().input("ID", sql.Int, posTerminalId).query(`
      IF EXISTS (SELECT 1 FROM TODVZ_POS_ISLEM WHERE POS_TERMINAL_ID = @ID) SELECT 0 AS SILINDI
      ELSE
      BEGIN
        DELETE FROM TODVZ_POS_TERMINAL_VEZNE WHERE POS_TERMINAL_ID = @ID;
        DELETE FROM TODVZ_POS_TERMINAL WHERE POS_TERMINAL_ID = @ID;
        SELECT 1 AS SILINDI;
      END
    `);
    return Boolean(r.recordset[0]?.SILINDI);
  }

  // ─── Banka → muhasebe POS kartı eşlemesi ───────────────────────────────────

  public static async bankaEslemeleri(dbContext?: DbContext): Promise<PosBankaEsleme[]> {
    const pool = await this.pool(dbContext);
    const rows = (
      await pool.request().query(`
        SELECT e.BANKA_KODU, e.POS_CIHAZI_ID, p.KOD, p.AD
        FROM TODVZ_POS_BANKA_ESLEME e LEFT JOIN TODVZ_POS_CIHAZI p ON p.POS_CIHAZI_ID = e.POS_CIHAZI_ID
        ORDER BY e.BANKA_KODU
      `)
    ).recordset;
    return rows.map((r: any) => ({ bankaKodu: r.BANKA_KODU, posCihaziId: r.POS_CIHAZI_ID, posCihaziKod: metin(r.KOD), posCihaziAd: metin(r.AD) }));
  }

  public static async bankaEslemeleriniYaz(liste: PosBankaEsleme[], dbContext?: DbContext): Promise<void> {
    const pool = await this.pool(dbContext);
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      await new sql.Request(tx).query(`DELETE FROM TODVZ_POS_BANKA_ESLEME`);
      for (const e of liste) {
        await new sql.Request(tx)
          .input("BANKA_KODU", sql.NVarChar(100), e.bankaKodu)
          .input("POS_CIHAZI_ID", sql.Int, e.posCihaziId)
          .query(`INSERT INTO TODVZ_POS_BANKA_ESLEME (BANKA_KODU, POS_CIHAZI_ID) VALUES (@BANKA_KODU, @POS_CIHAZI_ID)`);
      }
      await tx.commit();
    } catch (err) {
      await tx.rollback().catch(() => undefined);
      throw err;
    }
  }

  /** Sonuçta dönen bankanın muhasebe kartı; eşleme yoksa null. Büyük/küçük harf ayrımı yapılmaz. */
  public static async bankaninPosCihazi(bankaKodu: string, dbContext?: DbContext): Promise<number | null> {
    const pool = await this.pool(dbContext);
    const r = await pool
      .request()
      .input("BANKA_KODU", sql.NVarChar(100), bankaKodu)
      .query(`SELECT TOP 1 POS_CIHAZI_ID FROM TODVZ_POS_BANKA_ESLEME WHERE UPPER(BANKA_KODU) = UPPER(@BANKA_KODU)`);
    return r.recordset[0]?.POS_CIHAZI_ID ?? null;
  }

  // ─── İşlemler ──────────────────────────────────────────────────────────────

  /**
   * İşlemi tek adımda açar. Aynı istek kimliği ikinci kez gelirse var olan işlem döner (mükerrer çekim olmaz).
   * Cihazda süresi dolmamış bekleyen bir işlem varsa "mesgul" döner (K6).
   */
  public static async islemOlustur(dto: PosIslemOlustur, zamanAsimiSn: number, dbContext?: DbContext): Promise<{ posIslemId: number; yeni: boolean } | "mesgul"> {
    const pool = await this.pool(dbContext);
    const req = pool.request();
    req.input("ISTEK", sql.VarChar(40), dto.istekKimlik);
    req.input("TERMINAL", sql.Int, dto.posTerminalId);
    req.input("ENTEGRASYON", sql.VarChar(10), dto.entegrasyon);
    req.input("MOD", sql.VarChar(10), dto.mod);
    req.input("BELGE_TURU", sql.VarChar(15), dto.belgeTuru);
    req.input("BELGE_ID", sql.Int, dto.belgeId);
    req.input("BELGE_NO", sql.VarChar(50), dto.belgeNo);
    req.input("BELGE_TIPI", sql.VarChar(10), dto.belgeTipi);
    req.input("TUTAR", sql.Decimal(18, 2), dto.tutar);
    req.input("DURUM", sql.VarChar(15), dto.durum);
    req.input("ELLE", sql.Bit, dto.elle ? 1 : 0);
    req.input("POS_CIHAZI_ID", sql.Int, dto.posCihaziId);
    req.input("VEZNE_ID", sql.Int, dto.vezneId);
    req.input("KULLANICI_ID", sql.Int, dto.kullaniciId);
    req.input("ZAMAN_ASIMI", sql.Int, zamanAsimiSn);

    const r = (
      await req.query(`
        SET XACT_ABORT ON;
        BEGIN TRAN;
        DECLARE @ID INT;
        SELECT @ID = POS_ISLEM_ID FROM TODVZ_POS_ISLEM WITH (UPDLOCK, HOLDLOCK) WHERE ISTEK_KIMLIK = @ISTEK;

        IF @ID IS NOT NULL
        BEGIN
          COMMIT;
          SELECT @ID AS ID, 0 AS YENI, 0 AS MESGUL;
        END
        ELSE IF @DURUM = 'BEKLIYOR' AND @TERMINAL IS NOT NULL AND EXISTS (
          SELECT 1 FROM TODVZ_POS_ISLEM WITH (UPDLOCK, HOLDLOCK)
          WHERE POS_TERMINAL_ID = @TERMINAL AND DURUM = 'BEKLIYOR' AND DATEDIFF(SECOND, GONDERIM_ZAMANI, GETDATE()) < @ZAMAN_ASIMI
        )
        BEGIN
          COMMIT;
          SELECT NULL AS ID, 0 AS YENI, 1 AS MESGUL;
        END
        ELSE
        BEGIN
          INSERT INTO TODVZ_POS_ISLEM (ISTEK_KIMLIK, POS_TERMINAL_ID, ENTEGRASYON, [MOD], BELGE_TURU, BELGE_ID, BELGE_NO, BELGE_TIPI, TUTAR, DURUM,
            ELLE, ELLE_KULLANICI_ID, ELLE_ZAMANI, POS_CIHAZI_ID, VEZNE_ID, KULLANICI_ID, GONDERIM_ZAMANI, SONUC_ZAMANI)
          VALUES (@ISTEK, @TERMINAL, @ENTEGRASYON, @MOD, @BELGE_TURU, @BELGE_ID, @BELGE_NO, @BELGE_TIPI, @TUTAR, @DURUM,
            @ELLE, CASE WHEN @ELLE = 1 THEN @KULLANICI_ID END, CASE WHEN @ELLE = 1 THEN GETDATE() END, @POS_CIHAZI_ID, @VEZNE_ID, @KULLANICI_ID,
            GETDATE(), CASE WHEN @DURUM <> 'BEKLIYOR' THEN GETDATE() END);
          SET @ID = CAST(SCOPE_IDENTITY() AS INT);
          COMMIT;
          SELECT @ID AS ID, 1 AS YENI, 0 AS MESGUL;
        END
      `)
    ).recordset[0];
    if (r?.MESGUL) return "mesgul";
    return { posIslemId: r.ID, yeni: Boolean(r.YENI) };
  }

  public static async islemGetir(posIslemId: number, dbContext?: DbContext): Promise<PosIslem | null> {
    const pool = await this.pool(dbContext);
    const r = (await pool.request().input("ID", sql.Int, posIslemId).query(`${ISLEM_SECIMI} WHERE i.POS_ISLEM_ID = @ID`)).recordset[0];
    return r ? islemden(r) : null;
  }

  public static async refYaz(posIslemId: number, ref: string | null, dbContext?: DbContext): Promise<void> {
    const pool = await this.pool(dbContext);
    await pool.request().input("ID", sql.Int, posIslemId).input("REF", sql.VarChar(100), ref).query(`UPDATE TODVZ_POS_ISLEM SET SURUCU_REF = @REF WHERE POS_ISLEM_ID = @ID`);
  }

  /**
   * Cihazdan gelen sonucu yazar. Yalnızca hâlâ bekleyen ya da zaman aşımıyla Belirsiz'e düşmüş ve elle işaretlenmemiş işlemi
   * değiştirir: sonuç gecikmeli ya da iki kez gelse de kayıt bir kez yazılır, kullanıcının elle işareti ezilmez.
   */
  public static async sonucYaz(posIslemId: number, s: SurucuSonuc, posCihaziId: number | null, dbContext?: DbContext): Promise<boolean> {
    const pool = await this.pool(dbContext);
    const req = pool.request();
    req.input("ID", sql.Int, posIslemId);
    req.input("DURUM", sql.VarChar(15), s.durum);
    req.input("BANKA_KODU", sql.NVarChar(100), metin(s.bankaKodu)?.slice(0, 100) ?? null);
    req.input("BANKA_ADI", sql.NVarChar(100), metin(s.bankaAdi)?.slice(0, 100) ?? null);
    req.input("TAKSIT", sql.Int, s.taksit ?? null);
    req.input("ONAY_KODU", sql.VarChar(50), metin(s.onayKodu)?.slice(0, 50) ?? null);
    req.input("KART_NO", sql.VarChar(30), metin(s.kartNo)?.slice(0, 30) ?? null);
    req.input("CIHAZ_FIS_NO", sql.VarChar(30), metin(s.cihazFisNo)?.slice(0, 30) ?? null);
    req.input("Z_NO", sql.VarChar(20), metin(s.zNo)?.slice(0, 20) ?? null);
    req.input("HATA", sql.NVarChar(300), metin(s.hata)?.slice(0, 300) ?? null);
    req.input("HAM", sql.NVarChar(sql.MAX), s.ham === undefined ? null : JSON.stringify(s.ham));
    req.input("POS_CIHAZI_ID", sql.Int, posCihaziId);
    const r = await req.query(`
      UPDATE TODVZ_POS_ISLEM SET DURUM = @DURUM, BANKA_KODU = @BANKA_KODU, BANKA_ADI = @BANKA_ADI, TAKSIT = @TAKSIT, ONAY_KODU = @ONAY_KODU,
        KART_NO = @KART_NO, CIHAZ_FIS_NO = @CIHAZ_FIS_NO, Z_NO = @Z_NO, HATA = @HATA, HAM = @HAM,
        POS_CIHAZI_ID = COALESCE(@POS_CIHAZI_ID, POS_CIHAZI_ID), SONUC_ZAMANI = GETDATE()
      WHERE POS_ISLEM_ID = @ID AND DURUM IN ('BEKLIYOR', 'BELIRSIZ') AND ELLE = 0
    `);
    return (r.rowsAffected?.[0] || 0) > 0;
  }

  /** Bekleyen işlemi verilen duruma çeker (zaman aşımı → BELIRSIZ, gönderilemedi → RET, vazgeçildi → IPTAL). */
  public static async bekleyeniKapat(posIslemId: number, durum: PosDurum, hata: string | null, dbContext?: DbContext): Promise<boolean> {
    const pool = await this.pool(dbContext);
    const r = await pool
      .request()
      .input("ID", sql.Int, posIslemId)
      .input("DURUM", sql.VarChar(15), durum)
      .input("HATA", sql.NVarChar(300), hata ? hata.slice(0, 300) : null)
      .query(`UPDATE TODVZ_POS_ISLEM SET DURUM = @DURUM, HATA = @HATA, SONUC_ZAMANI = GETDATE() WHERE POS_ISLEM_ID = @ID AND DURUM = 'BEKLIYOR'`);
    return (r.rowsAffected?.[0] || 0) > 0;
  }

  /** Kullanıcının elle işareti: Alındı → ONAY, Alınmadı → RET. Cihazdan kesin sonuç gelmiş işlem değişmez. */
  public static async elleIsaretle(posIslemId: number, alindi: boolean, kullaniciId: number | null, dbContext?: DbContext): Promise<boolean> {
    const pool = await this.pool(dbContext);
    const r = await pool
      .request()
      .input("ID", sql.Int, posIslemId)
      .input("DURUM", sql.VarChar(15), alindi ? "ONAY" : "RET")
      .input("KULLANICI_ID", sql.Int, kullaniciId)
      .query(`
        UPDATE TODVZ_POS_ISLEM SET DURUM = @DURUM, ELLE = 1, ELLE_KULLANICI_ID = @KULLANICI_ID, ELLE_ZAMANI = GETDATE(), SONUC_ZAMANI = GETDATE()
        WHERE POS_ISLEM_ID = @ID AND (DURUM IN ('BEKLIYOR', 'BELIRSIZ') OR ELLE = 1)
      `);
    return (r.rowsAffected?.[0] || 0) > 0;
  }

  /** İade işareti yalnızca tahsil edilmiş (ONAY) işleme konur. */
  public static async iadeIsaretle(posIslemId: number, iadeDurumu: PosIadeDurumu, kullaniciId: number | null, dbContext?: DbContext): Promise<boolean> {
    const pool = await this.pool(dbContext);
    const r = await pool
      .request()
      .input("ID", sql.Int, posIslemId)
      .input("IADE", sql.TinyInt, iadeDurumu)
      .input("KULLANICI_ID", sql.Int, kullaniciId)
      .query(`
        UPDATE TODVZ_POS_ISLEM SET IADE_DURUMU = @IADE,
          IADE_KULLANICI_ID = CASE WHEN @IADE = 0 THEN NULL ELSE @KULLANICI_ID END,
          IADE_ZAMANI = CASE WHEN @IADE = 0 THEN NULL ELSE GETDATE() END
        WHERE POS_ISLEM_ID = @ID AND DURUM = 'ONAY'
      `);
    return (r.rowsAffected?.[0] || 0) > 0;
  }

  /** Fiş kaydedilince, fişten önce alınan tahsilatlar fişe bağlanır (K13). Başka belgeye bağlı işlem değişmez. */
  public static async belgeyeBagla(posIslemIdler: number[], belgeTuru: string, belgeId: number, belgeNo: string | null, dbContext?: DbContext): Promise<number> {
    if (!posIslemIdler.length) return 0;
    const pool = await this.pool(dbContext);
    const req = pool.request();
    req.input("BELGE_TURU", sql.VarChar(15), belgeTuru);
    req.input("BELGE_ID", sql.Int, belgeId);
    req.input("BELGE_NO", sql.VarChar(50), belgeNo);
    posIslemIdler.forEach((id, i) => req.input(`i${i}`, sql.Int, id));
    const r = await req.query(`
      UPDATE TODVZ_POS_ISLEM SET BELGE_ID = @BELGE_ID, BELGE_NO = COALESCE(@BELGE_NO, BELGE_NO)
      WHERE POS_ISLEM_ID IN (${posIslemIdler.map((_, i) => `@i${i}`).join(", ")}) AND BELGE_TURU = @BELGE_TURU AND (BELGE_ID IS NULL OR BELGE_ID = @BELGE_ID)
    `);
    return r.rowsAffected?.[0] || 0;
  }

  /** Bir fişin tahsil edilmiş ve iade edilmemiş POS işlemleri (düzeltmede satırlarla karşılaştırmak için). */
  public static async belgeIslemleri(belgeTuru: string, belgeId: number, dbContext?: DbContext): Promise<PosIslem[]> {
    const pool = await this.pool(dbContext);
    const rows = (
      await pool
        .request()
        .input("BELGE_TURU", sql.VarChar(15), belgeTuru)
        .input("BELGE_ID", sql.Int, belgeId)
        .query(`${ISLEM_SECIMI} WHERE i.BELGE_TURU = @BELGE_TURU AND i.BELGE_ID = @BELGE_ID AND i.DURUM = 'ONAY' AND i.IADE_DURUMU = 0 ORDER BY i.POS_ISLEM_ID`)
    ).recordset;
    return rows.map(islemden);
  }

  public static async islemleriListele(f: PosIslemFiltre, dbContext?: DbContext): Promise<{ satirlar: PosIslem[]; toplam: number }> {
    const pool = await this.pool(dbContext);
    const kosullar: string[] = ["i.BELGE_TURU <> 'deneme'"];
    const hazirla = (req: sql.Request) => {
      if (f.baslangic) req.input("BAS", sql.Date, new Date(f.baslangic));
      if (f.bitis) req.input("BIT", sql.Date, new Date(f.bitis));
      if (f.posTerminalId) req.input("TERMINAL", sql.Int, f.posTerminalId);
      if (f.arama) req.input("ARA", sql.NVarChar(120), `%${f.arama}%`);
    };
    if (f.baslangic) kosullar.push("CAST(i.OLUSTURMA AS DATE) >= @BAS");
    if (f.bitis) kosullar.push("CAST(i.OLUSTURMA AS DATE) <= @BIT");
    if (f.posTerminalId) kosullar.push("i.POS_TERMINAL_ID = @TERMINAL");
    if (f.arama) kosullar.push("(i.BELGE_NO LIKE @ARA OR i.ONAY_KODU LIKE @ARA OR i.KART_NO LIKE @ARA OR i.BANKA_ADI LIKE @ARA)");
    // Süzgeçler ekrandaki sekmelerle aynıdır
    if (f.durum === "onay") kosullar.push("i.DURUM = 'ONAY' AND i.ELLE = 0");
    else if (f.durum === "ret") kosullar.push("i.DURUM IN ('RET', 'IPTAL')");
    else if (f.durum === "belirsiz") kosullar.push("i.DURUM IN ('BELIRSIZ', 'BEKLIYOR')");
    else if (f.durum === "elle") kosullar.push("i.ELLE = 1");
    else if (f.durum === "iade") kosullar.push("i.IADE_DURUMU > 0");
    else if (f.durum === "fissiz") kosullar.push("i.DURUM = 'ONAY' AND i.BELGE_ID IS NULL");
    const nerede = `WHERE ${kosullar.join(" AND ")}`;

    const boyut = Math.min(Math.max(f.sayfaBoyutu || 100, 1), 500);
    const sayfa = Math.max(f.sayfa || 1, 1);

    const sayReq = pool.request();
    hazirla(sayReq);
    const toplam: number = (await sayReq.query(`SELECT COUNT(*) AS N FROM TODVZ_POS_ISLEM i ${nerede}`)).recordset[0].N;

    const req = pool.request();
    hazirla(req);
    req.input("ATLA", sql.Int, (sayfa - 1) * boyut);
    req.input("AL", sql.Int, boyut);
    const rows = (await req.query(`${ISLEM_SECIMI} ${nerede} ORDER BY i.POS_ISLEM_ID DESC OFFSET @ATLA ROWS FETCH NEXT @AL ROWS ONLY`)).recordset;
    return { satirlar: rows.map(islemden), toplam };
  }

  /** Bankanın sonradan bildirdiği POS hareketleri (e-Banka eşitlemesiyle gelir). e-Banka hiç kullanılmamışsa boş döner. */
  public static async vomsisPosHareketleri(baslangic: string, bitis: string, dbContext?: DbContext): Promise<VomsisPosSatiri[]> {
    const pool = await this.pool(dbContext);
    const req = pool.request();
    req.input("BAS", sql.Date, new Date(baslangic));
    req.input("BIT", sql.Date, new Date(bitis));
    const rows = (
      await req.query(`
        IF OBJECT_ID('TODVZ_EBANKA_POS_HAREKET', 'U') IS NULL OR OBJECT_ID('TODVZ_EBANKA_POS_TERMINAL', 'U') IS NULL
          SELECT TOP 0 CAST(NULL AS INT) AS VOMSIS_ID
        ELSE
          SELECT h.VOMSIS_ID, h.ISLEM_TARIHI, CONVERT(VARCHAR(8), h.SAAT, 108) AS SAAT, t.BANKA_ADI, h.KART_NO, h.BRUT, h.TAKSIT_SAYISI, h.PROVIZYON_NO
          FROM TODVZ_EBANKA_POS_HAREKET h
          LEFT JOIN TODVZ_EBANKA_POS_TERMINAL t ON t.VOMSIS_TERMINAL_ID = h.VOMSIS_TERMINAL_ID
          WHERE h.ISLEM_TARIHI >= @BAS AND h.ISLEM_TARIHI <= @BIT
          ORDER BY h.ISLEM_TARIHI DESC, h.VOMSIS_ID DESC
      `)
    ).recordset;
    return rows.map((r: any) => ({
      vomsisId: r.VOMSIS_ID,
      islemTarihi: r.ISLEM_TARIHI ? new Date(r.ISLEM_TARIHI).toISOString().slice(0, 10) : null,
      saat: metin(r.SAAT),
      bankaAdi: r.BANKA_ADI || "",
      kartNo: metin(r.KART_NO),
      brut: Number(r.BRUT) || 0,
      taksitSayisi: r.TAKSIT_SAYISI ?? null,
      provizyonNo: metin(r.PROVIZYON_NO),
    }));
  }
}
