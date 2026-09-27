import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";
export class BankaSqlRepository {
    /**
     * Tabloların veritabanında var olduğunu denetler ve gerekirse oluşturur.
     */
    static async ensureTables(pool) {
        try {
            await pool.request().batch(`
        IF OBJECT_ID('TODVZ_BANKA', 'U') IS NULL
        BEGIN
          CREATE TABLE [dbo].[TODVZ_BANKA] (
            [BANKA_ID] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            [HESAP_NO] VARCHAR(50) NOT NULL,
            [HESAP_ADI] VARCHAR(200) NOT NULL,
            [IBAN] VARCHAR(34) NULL,
            [SUBE_ADI] VARCHAR(100) NULL,
            [BANKA_ADI_ID] INT NULL,
            [E_FATURADA_GOZUKSUN] BIT NOT NULL DEFAULT 0,
            [MUH_HESAP_KODLARI] VARCHAR(500) NULL,
            [DEVIR] FLOAT NOT NULL DEFAULT 0,
            [AKTIF] BIT NOT NULL DEFAULT 1,
            [EKLEYEN_ID] INT NULL,
            [EKLEME_ZAMANI] DATETIME NOT NULL DEFAULT GETDATE(),
            [GUNCELLEYEN_ID] INT NULL,
            [GUNCELLEME_ZAMANI] DATETIME NULL
          );
        END;

        IF OBJECT_ID('TODVZ_BANKA_HAREKET', 'U') IS NULL
        BEGIN
          CREATE TABLE [dbo].[TODVZ_BANKA_HAREKET] (
            [BANKA_HAREKET_ID] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            [ISLEM_TIPI] TINYINT NOT NULL,
            [BANKA_ID] INT NOT NULL,
            [CARI_KART_ID] INT NULL,
            [VEZNE_ID] INT NULL,
            [TARIH] DATETIME NOT NULL DEFAULT GETDATE(),
            [BELGE_NO] VARCHAR(50) NULL,
            [ACIKLAMA] VARCHAR(250) NULL,
            [IPTAL] BIT NOT NULL DEFAULT 0,
            [IPTAL_TARIHI] DATETIME NULL,
            [EKLEYEN_ID] INT NULL,
            [EKLEME_ZAMANI] DATETIME NOT NULL DEFAULT GETDATE(),
            [GUNCELLEYEN_ID] INT NULL,
            [GUNCELLEME_ZAMANI] DATETIME NULL
          );
        END;

        IF OBJECT_ID('TODVZ_BANKA_HAREKET_SATIRI', 'U') IS NULL
        BEGIN
          CREATE TABLE [dbo].[TODVZ_BANKA_HAREKET_SATIRI] (
            [BANKA_HAREKET_ID] INT NOT NULL,
            [SATIR_NO] INT NOT NULL,
            [PARA_ID] INT NOT NULL,
            [MEBLAG] FLOAT NOT NULL DEFAULT 0,
            [KUR] FLOAT NOT NULL DEFAULT 1,
            [GISE_KURU] FLOAT NOT NULL DEFAULT 1,
            [TUTAR_TL] FLOAT NOT NULL DEFAULT 0,
            [ACIKLAMA] VARCHAR(250) NULL,
            CONSTRAINT [PK_TODVZ_BANKA_HAREKET_SATIRI] PRIMARY KEY CLUSTERED ([BANKA_HAREKET_ID] ASC, [SATIR_NO] ASC)
          );
        END;
      `);
        }
        catch (err) {
            logger.warn(`[BankaSqlRepository.ensureTables] Warning: ${err.message}`);
        }
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // A - BANKA HESAP KARTLARI CRUD
    // ═══════════════════════════════════════════════════════════════════════════
    static async listBankalar(filter, dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await this.ensureTables(pool);
        let query = `
      SELECT 
        b.BANKA_ID,
        b.HESAP_NO,
        b.HESAP_ADI,
        b.IBAN,
        b.SUBE_ADI,
        b.BANKA_ADI_ID,
        COALESCE(c.AD, tm.AD, '') AS BANKA_KURUM_ADI,
        b.E_FATURADA_GOZUKSUN,
        b.MUH_HESAP_KODLARI,
        b.DEVIR,
        b.AKTIF,
        b.EKLEYEN_ID,
        b.EKLEME_ZAMANI,
        b.GUNCELLEYEN_ID,
        b.GUNCELLEME_ZAMANI,
        ISNULL((
          SELECT SUM(s.TUTAR_TL)
          FROM TODVZ_BANKA_HAREKET h
          JOIN TODVZ_BANKA_HAREKET_SATIRI s ON s.BANKA_HAREKET_ID = h.BANKA_HAREKET_ID
          WHERE h.BANKA_ID = b.BANKA_ID AND h.IPTAL = 0 AND h.ISLEM_TIPI IN (0, 2)
        ), 0) AS TOPLAM_GIRIS,
        ISNULL((
          SELECT SUM(s.TUTAR_TL)
          FROM TODVZ_BANKA_HAREKET h
          JOIN TODVZ_BANKA_HAREKET_SATIRI s ON s.BANKA_HAREKET_ID = h.BANKA_HAREKET_ID
          WHERE h.BANKA_ID = b.BANKA_ID AND h.IPTAL = 0 AND h.ISLEM_TIPI IN (1, 3)
        ), 0) AS TOPLAM_CIKIS
      FROM TODVZ_BANKA b
      LEFT JOIN TODVZ_TABLO_MADDESI tm ON tm.TABLO_MADDESI_ID = b.BANKA_ADI_ID
      LEFT JOIN TODVZ_CARI_KART c ON c.CARI_KART_ID = b.BANKA_ADI_ID
      WHERE 1=1
    `;
        const request = pool.request();
        if (filter?.aktif !== undefined) {
            query += ` AND b.AKTIF = @AKTIF`;
            request.input("AKTIF", sql.Bit, filter.aktif ? 1 : 0);
        }
        if (filter?.search && filter.search.trim()) {
            query += ` AND (
        b.HESAP_NO LIKE @SEARCH OR 
        b.HESAP_ADI LIKE @SEARCH OR 
        b.IBAN LIKE @SEARCH OR 
        b.SUBE_ADI LIKE @SEARCH OR
        tm.AD LIKE @SEARCH OR
        c.AD LIKE @SEARCH
      )`;
            request.input("SEARCH", sql.VarChar(100), `%${filter.search.trim()}%`);
        }
        query += ` ORDER BY b.HESAP_NO ASC, b.HESAP_ADI ASC`;
        const res = await request.query(query);
        return (res.recordset || []).map((r) => {
            const devir = Number(r.DEVIR) || 0;
            const toplamGiris = Number(r.TOPLAM_GIRIS) || 0;
            const toplamCikis = Number(r.TOPLAM_CIKIS) || 0;
            return {
                bankaId: r.BANKA_ID,
                hesapNo: (r.HESAP_NO || "").trim(),
                hesapAdi: (r.HESAP_ADI || "").trim(),
                iban: r.IBAN ? (r.IBAN || "").trim() : null,
                subeAdi: r.SUBE_ADI ? (r.SUBE_ADI || "").trim() : null,
                bankaAdiId: r.BANKA_ADI_ID || null,
                bankaAdi: r.BANKA_KURUM_ADI ? r.BANKA_KURUM_ADI.trim() : null,
                eFaturadaGozuksun: Boolean(r.E_FATURADA_GOZUKSUN),
                muhHesapKodlari: r.MUH_HESAP_KODLARI || null,
                devir,
                aktif: Boolean(r.AKTIF),
                toplamGiris,
                toplamCikis,
                bakiye: devir + toplamGiris - toplamCikis,
                ekleyenId: r.EKLEYEN_ID,
                eklemeZamani: r.EKLEME_ZAMANI ? new Date(r.EKLEME_ZAMANI).toISOString() : null,
                guncelleyenId: r.GUNCELLEYEN_ID,
                guncellemeZamani: r.GUNCELLEME_ZAMANI ? new Date(r.GUNCELLEME_ZAMANI).toISOString() : null,
            };
        });
    }
    static async getBankaById(bankaId, dbContext) {
        const list = await this.listBankalar(undefined, dbContext);
        const item = list.find((b) => b.bankaId === bankaId);
        return item || null;
    }
    static async getNextHesapNo(dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await this.ensureTables(pool);
        const res = await pool.request().query(`
      SELECT TOP 1 HESAP_NO FROM TODVZ_BANKA ORDER BY BANKA_ID DESC
    `);
        const last = res.recordset?.[0]?.HESAP_NO;
        if (!last)
            return "102.01.001";
        const parts = last.split(".");
        if (parts.length === 3 && !isNaN(Number(parts[2]))) {
            const nextNum = Number(parts[2]) + 1;
            return `${parts[0]}.${parts[1]}.${String(nextNum).padStart(3, "0")}`;
        }
        return `102.01.${String(Date.now()).slice(-3)}`;
    }
    static async saveBanka(dto, kullaniciId, dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await this.ensureTables(pool);
        const isUpdate = dto.bankaId !== undefined && dto.bankaId !== null && Number(dto.bankaId) > 0;
        const req = pool.request();
        req.input("HESAP_NO", sql.VarChar(50), (dto.hesapNo || "").trim());
        req.input("HESAP_ADI", sql.VarChar(200), (dto.hesapAdi || "").trim());
        req.input("IBAN", sql.VarChar(34), dto.iban ? dto.iban.trim() : null);
        req.input("SUBE_ADI", sql.VarChar(100), dto.subeAdi ? dto.subeAdi.trim() : null);
        req.input("BANKA_ADI_ID", sql.Int, dto.bankaAdiId || null);
        req.input("E_FATURADA_GOZUKSUN", sql.Bit, dto.eFaturadaGozuksun ? 1 : 0);
        req.input("MUH_HESAP_KODLARI", sql.VarChar(500), dto.muhHesapKodlari || null);
        req.input("DEVIR", sql.Float, Number(dto.devir) || 0);
        req.input("AKTIF", sql.Bit, dto.aktif !== undefined ? (dto.aktif ? 1 : 0) : 1);
        req.input("KULLANICI_ID", sql.Int, kullaniciId || 1);
        let savedId;
        if (isUpdate) {
            savedId = Number(dto.bankaId);
            req.input("BANKA_ID", sql.Int, savedId);
            await req.query(`
        UPDATE TODVZ_BANKA
        SET 
          HESAP_NO = @HESAP_NO,
          HESAP_ADI = @HESAP_ADI,
          IBAN = @IBAN,
          SUBE_ADI = @SUBE_ADI,
          BANKA_ADI_ID = @BANKA_ADI_ID,
          E_FATURADA_GOZUKSUN = @E_FATURADA_GOZUKSUN,
          MUH_HESAP_KODLARI = @MUH_HESAP_KODLARI,
          DEVIR = @DEVIR,
          AKTIF = @AKTIF,
          GUNCELLEYEN_ID = @KULLANICI_ID,
          GUNCELLEME_ZAMANI = GETDATE()
        WHERE BANKA_ID = @BANKA_ID
      `);
        }
        else {
            // Check if BANKA_ID is an identity column
            const checkIdentity = await pool.request().query(`
        SELECT COLUMNPROPERTY(OBJECT_ID('TODVZ_BANKA'), 'BANKA_ID', 'IsIdentity') AS IsIdentity
      `);
            const isIdentity = checkIdentity.recordset?.[0]?.IsIdentity === 1;
            if (isIdentity) {
                const insertRes = await req.query(`
          INSERT INTO TODVZ_BANKA (
            HESAP_NO, HESAP_ADI, IBAN, SUBE_ADI, BANKA_ADI_ID,
            E_FATURADA_GOZUKSUN, MUH_HESAP_KODLARI, DEVIR, AKTIF,
            EKLEYEN_ID, EKLEME_ZAMANI
          )
          VALUES (
            @HESAP_NO, @HESAP_ADI, @IBAN, @SUBE_ADI, @BANKA_ADI_ID,
            @E_FATURADA_GOZUKSUN, @MUH_HESAP_KODLARI, @DEVIR, @AKTIF,
            @KULLANICI_ID, GETDATE()
          );
          SELECT SCOPE_IDENTITY() AS [NEW_ID];
        `);
                savedId = Number(insertRes.recordset?.[0]?.NEW_ID);
            }
            else {
                const nextIdRes = await pool.request().query(`
          SELECT ISNULL(MAX(BANKA_ID), 0) + 1 AS [NEXT_ID] FROM TODVZ_BANKA
        `);
                savedId = Number(nextIdRes.recordset?.[0]?.NEXT_ID);
                req.input("NEW_BANKA_ID", sql.Int, savedId);
                await req.query(`
          INSERT INTO TODVZ_BANKA (
            BANKA_ID, HESAP_NO, HESAP_ADI, IBAN, SUBE_ADI, BANKA_ADI_ID,
            E_FATURADA_GOZUKSUN, MUH_HESAP_KODLARI, DEVIR, AKTIF,
            EKLEYEN_ID, EKLEME_ZAMANI
          )
          VALUES (
            @NEW_BANKA_ID, @HESAP_NO, @HESAP_ADI, @IBAN, @SUBE_ADI, @BANKA_ADI_ID,
            @E_FATURADA_GOZUKSUN, @MUH_HESAP_KODLARI, @DEVIR, @AKTIF,
            @KULLANICI_ID, GETDATE()
          );
        `);
            }
        }
        const saved = await this.getBankaById(savedId, dbContext);
        if (!saved)
            throw ApiError.internal("Banka hesabı kaydedildi ancak okunamadı.");
        return saved;
    }
    static async deleteBanka(bankaId, kullaniciId, dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await this.ensureTables(pool);
        // Hareket kontrolü
        const hareketCount = await pool.request()
            .input("BANKA_ID", sql.Int, bankaId)
            .query(`SELECT COUNT(1) as cnt FROM TODVZ_BANKA_HAREKET WHERE BANKA_ID = @BANKA_ID`);
        if ((hareketCount.recordset?.[0]?.cnt || 0) > 0) {
            throw ApiError.badRequest("Bu banka hesabına ait hareket kayıtları bulunmaktadır, doğrudan silinemez.");
        }
        await pool.request()
            .input("BANKA_ID", sql.Int, bankaId)
            .query(`DELETE FROM TODVZ_BANKA WHERE BANKA_ID = @BANKA_ID`);
        return true;
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // D - BANKA HESAP HAREKETLERİ & SATIRLARI CRUD
    // ═══════════════════════════════════════════════════════════════════════════
    static async listHareketler(filter, dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await this.ensureTables(pool);
        const topLimit = filter?.limit && filter.limit > 0 ? filter.limit : 2000;
        let query = `
      SELECT TOP (${topLimit})
        h.BANKA_HAREKET_ID,
        h.ISLEM_TIPI,
        h.BANKA_ID,
        b.HESAP_NO AS BANKA_HESAP_NO,
        b.HESAP_ADI AS BANKA_HESAP_ADI,
        b.IBAN AS BANKA_IBAN,
        h.CARI_KART_ID,
        c.KOD AS CARI_KOD,
        c.AD AS CARI_UNVAN,
        h.VEZNE_ID,
        v.KOD AS VEZNE_KOD,
        v.AD AS VEZNE_AD,
        h.TARIH,
        h.BELGE_NO,
        h.ACIKLAMA,
        h.IPTAL,
        h.IPTAL_TARIHI,
        h.EKLEYEN_ID,
        h.EKLEME_ZAMANI,
        h.GUNCELLEYEN_ID,
        h.GUNCELLEME_ZAMANI,
        ISNULL((
          SELECT SUM(s.TUTAR_TL) FROM TODVZ_BANKA_HAREKET_SATIRI s WHERE s.BANKA_HAREKET_ID = h.BANKA_HAREKET_ID
        ), 0) AS TOPLAM_TUTAR_TL,
        ISNULL((
          SELECT SUM(s.MEBLAG) FROM TODVZ_BANKA_HAREKET_SATIRI s WHERE s.BANKA_HAREKET_ID = h.BANKA_HAREKET_ID
        ), 0) AS TOPLAM_MEBLAG
      FROM TODVZ_BANKA_HAREKET h
      LEFT JOIN TODVZ_BANKA b ON b.BANKA_ID = h.BANKA_ID
      LEFT JOIN TODVZ_CARI_KART c ON c.CARI_KART_ID = h.CARI_KART_ID
      LEFT JOIN TODVZ_VEZNE v ON v.VEZNE_ID = h.VEZNE_ID
      WHERE 1=1
    `;
        const req = pool.request();
        if (filter?.bankaId) {
            query += ` AND h.BANKA_ID = @BANKA_ID`;
            req.input("BANKA_ID", sql.Int, filter.bankaId);
        }
        if (filter?.cariKartId) {
            query += ` AND h.CARI_KART_ID = @CARI_KART_ID`;
            req.input("CARI_KART_ID", sql.Int, filter.cariKartId);
        }
        if (filter?.vezneId) {
            query += ` AND h.VEZNE_ID = @VEZNE_ID`;
            req.input("VEZNE_ID", sql.Int, filter.vezneId);
        }
        if (filter?.islemTipi !== undefined && filter.islemTipi !== null) {
            query += ` AND h.ISLEM_TIPI = @ISLEM_TIPI`;
            req.input("ISLEM_TIPI", sql.TinyInt, filter.islemTipi);
        }
        if (filter?.baslangicTarihi) {
            query += ` AND h.TARIH >= @BASLANGIC`;
            req.input("BASLANGIC", sql.DateTime, new Date(filter.baslangicTarihi));
        }
        if (filter?.bitisTarihi) {
            query += ` AND h.TARIH <= @BITIS`;
            req.input("BITIS", sql.DateTime, new Date(filter.bitisTarihi));
        }
        if (filter?.search && filter.search.trim()) {
            query += ` AND (
        h.BELGE_NO LIKE @SEARCH OR
        h.ACIKLAMA LIKE @SEARCH OR
        b.HESAP_ADI LIKE @SEARCH OR
        c.AD LIKE @SEARCH OR
        v.AD LIKE @SEARCH
      )`;
            req.input("SEARCH", sql.VarChar(100), `%${filter.search.trim()}%`);
        }
        query += ` ORDER BY h.TARIH ASC, h.BANKA_HAREKET_ID ASC`;
        const res = await req.query(query);
        const headers = res.recordset || [];
        if (!headers.length)
            return [];
        const hareketIds = headers.map((h) => h.BANKA_HAREKET_ID);
        // Satırları çekelim
        const satirlarRes = await pool.request().query(`
      SELECT 
        s.BANKA_HAREKET_ID,
        s.SATIR_NO,
        s.PARA_ID,
        p.KOD AS PARA_KODU,
        p.AD AS PARA_ADI,
        s.MEBLAG,
        s.KUR,
        s.GISE_KURU,
        s.TUTAR_TL,
        s.ACIKLAMA
      FROM TODVZ_BANKA_HAREKET_SATIRI s
      LEFT JOIN TODVZ_PARA p ON p.PARA_ID = s.PARA_ID
      WHERE s.BANKA_HAREKET_ID IN (${hareketIds.join(",")})
      ORDER BY s.BANKA_HAREKET_ID ASC, s.SATIR_NO ASC
    `);
        const satirlarMap = new Map();
        for (const s of satirlarRes.recordset || []) {
            const arr = satirlarMap.get(s.BANKA_HAREKET_ID) || [];
            arr.push({
                bankaHareketId: s.BANKA_HAREKET_ID,
                satirNo: s.SATIR_NO,
                paraId: s.PARA_ID,
                paraKodu: (s.PARA_KODU || "TL").trim(),
                paraAdi: (s.PARA_ADI || "").trim(),
                meblag: Number(s.MEBLAG) || 0,
                kur: Number(s.KUR) || 1,
                giseKuru: Number(s.GISE_KURU) || 1,
                tutarTl: Number(s.TUTAR_TL) || 0,
                aciklama: s.ACIKLAMA || null,
            });
            satirlarMap.set(s.BANKA_HAREKET_ID, arr);
        }
        return headers.map((h) => ({
            bankaHareketId: h.BANKA_HAREKET_ID,
            islemTipi: Number(h.ISLEM_TIPI),
            bankaId: h.BANKA_ID,
            bankaHesapNo: h.BANKA_HESAP_NO ? h.BANKA_HESAP_NO.trim() : "",
            bankaHesapAdi: h.BANKA_HESAP_ADI ? h.BANKA_HESAP_ADI.trim() : "",
            bankaIban: h.BANKA_IBAN ? h.BANKA_IBAN.trim() : "",
            cariKartId: h.CARI_KART_ID || null,
            cariKod: h.CARI_KOD ? h.CARI_KOD.trim() : null,
            cariUnvan: h.CARI_UNVAN ? h.CARI_UNVAN.trim() : null,
            vezneId: h.VEZNE_ID || null,
            vezneKod: h.VEZNE_KOD ? h.VEZNE_KOD.trim() : null,
            vezneAd: h.VEZNE_AD ? h.VEZNE_AD.trim() : null,
            tarih: h.TARIH ? new Date(h.TARIH).toISOString() : new Date().toISOString(),
            belgeNo: h.BELGE_NO ? h.BELGE_NO.trim() : null,
            aciklama: h.ACIKLAMA ? h.ACIKLAMA.trim() : null,
            iptal: Boolean(h.IPTAL),
            iptalTarihi: h.IPTAL_TARIHI ? new Date(h.IPTAL_TARIHI).toISOString() : null,
            toplamTutarTl: Number(h.TOPLAM_TUTAR_TL) || 0,
            toplamMeblag: Number(h.TOPLAM_MEBLAG) || 0,
            ekleyenId: h.EKLEYEN_ID,
            eklemeZamani: h.EKLEME_ZAMANI ? new Date(h.EKLEME_ZAMANI).toISOString() : null,
            guncelleyenId: h.GUNCELLEYEN_ID,
            guncellemeZamani: h.GUNCELLEME_ZAMANI ? new Date(h.GUNCELLEME_ZAMANI).toISOString() : null,
            satirlar: satirlarMap.get(h.BANKA_HAREKET_ID) || [],
        }));
    }
    static async getHareketById(bankaHareketId, dbContext) {
        const list = await this.listHareketler({ search: undefined, limit: 1 }, dbContext);
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        const res = await pool.request()
            .input("ID", sql.Int, bankaHareketId)
            .query(`SELECT TOP 1 BANKA_HAREKET_ID FROM TODVZ_BANKA_HAREKET WHERE BANKA_HAREKET_ID = @ID`);
        if (!res.recordset?.length)
            return null;
        const fullList = await this.listHareketler({ limit: 1 }, dbContext);
        const exactQuery = await pool.request().input("ID", sql.Int, bankaHareketId).query(`
      SELECT 
        h.BANKA_HAREKET_ID, h.ISLEM_TIPI, h.BANKA_ID, b.HESAP_NO AS BANKA_HESAP_NO,
        b.HESAP_ADI AS BANKA_HESAP_ADI, b.IBAN AS BANKA_IBAN, h.CARI_KART_ID,
        c.KOD AS CARI_KOD, c.AD AS CARI_UNVAN, h.VEZNE_ID, v.KOD AS VEZNE_KOD,
        v.AD AS VEZNE_AD, h.TARIH, h.BELGE_NO, h.ACIKLAMA, h.IPTAL, h.IPTAL_TARIHI,
        h.EKLEYEN_ID, h.EKLEME_ZAMANI, h.GUNCELLEYEN_ID, h.GUNCELLEME_ZAMANI
      FROM TODVZ_BANKA_HAREKET h
      LEFT JOIN TODVZ_BANKA b ON b.BANKA_ID = h.BANKA_ID
      LEFT JOIN TODVZ_CARI_KART c ON c.CARI_KART_ID = h.CARI_KART_ID
      LEFT JOIN TODVZ_VEZNE v ON v.VEZNE_ID = h.VEZNE_ID
      WHERE h.BANKA_HAREKET_ID = @ID
    `);
        if (!exactQuery.recordset?.length)
            return null;
        const h = exactQuery.recordset[0];
        const satirlarRes = await pool.request().input("ID", sql.Int, bankaHareketId).query(`
      SELECT 
        s.BANKA_HAREKET_ID, s.SATIR_NO, s.PARA_ID, p.KOD AS PARA_KODU,
        p.AD AS PARA_ADI, s.MEBLAG, s.KUR, s.GISE_KURU, s.TUTAR_TL, s.ACIKLAMA
      FROM TODVZ_BANKA_HAREKET_SATIRI s
      LEFT JOIN TODVZ_PARA p ON p.PARA_ID = s.PARA_ID
      WHERE s.BANKA_HAREKET_ID = @ID
      ORDER BY s.SATIR_NO ASC
    `);
        const satirlar = (satirlarRes.recordset || []).map((s) => ({
            bankaHareketId: s.BANKA_HAREKET_ID,
            satirNo: s.SATIR_NO,
            paraId: s.PARA_ID,
            paraKodu: (s.PARA_KODU || "TL").trim(),
            paraAdi: (s.PARA_ADI || "").trim(),
            meblag: Number(s.MEBLAG) || 0,
            kur: Number(s.KUR) || 1,
            giseKuru: Number(s.GISE_KURU) || 1,
            tutarTl: Number(s.TUTAR_TL) || 0,
            aciklama: s.ACIKLAMA || null,
        }));
        return {
            bankaHareketId: h.BANKA_HAREKET_ID,
            islemTipi: Number(h.ISLEM_TIPI),
            bankaId: h.BANKA_ID,
            bankaHesapNo: h.BANKA_HESAP_NO ? h.BANKA_HESAP_NO.trim() : "",
            bankaHesapAdi: h.BANKA_HESAP_ADI ? h.BANKA_HESAP_ADI.trim() : "",
            bankaIban: h.BANKA_IBAN ? h.BANKA_IBAN.trim() : "",
            cariKartId: h.CARI_KART_ID || null,
            cariKod: h.CARI_KOD ? h.CARI_KOD.trim() : null,
            cariUnvan: h.CARI_UNVAN ? h.CARI_UNVAN.trim() : null,
            vezneId: h.VEZNE_ID || null,
            vezneKod: h.VEZNE_KOD ? h.VEZNE_KOD.trim() : null,
            vezneAd: h.VEZNE_AD ? h.VEZNE_AD.trim() : null,
            tarih: h.TARIH ? new Date(h.TARIH).toISOString() : new Date().toISOString(),
            belgeNo: h.BELGE_NO ? h.BELGE_NO.trim() : null,
            aciklama: h.ACIKLAMA ? h.ACIKLAMA.trim() : null,
            iptal: Boolean(h.IPTAL),
            iptalTarihi: h.IPTAL_TARIHI ? new Date(h.IPTAL_TARIHI).toISOString() : null,
            toplamTutarTl: satirlar.reduce((s, r) => s + r.tutarTl, 0),
            toplamMeblag: satirlar.reduce((s, r) => s + r.meblag, 0),
            ekleyenId: h.EKLEYEN_ID,
            eklemeZamani: h.EKLEME_ZAMANI ? new Date(h.EKLEME_ZAMANI).toISOString() : null,
            guncelleyenId: h.GUNCELLEYEN_ID,
            guncellemeZamani: h.GUNCELLEME_ZAMANI ? new Date(h.GUNCELLEME_ZAMANI).toISOString() : null,
            satirlar,
        };
    }
    static async saveHareket(dto, kullaniciId, dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await this.ensureTables(pool);
        const isUpdate = dto.bankaHareketId !== undefined && dto.bankaHareketId !== null && Number(dto.bankaHareketId) > 0;
        const transaction = new sql.Transaction(pool);
        await transaction.begin();
        try {
            let savedId;
            const headerReq = new sql.Request(transaction);
            let effectiveBankaId = Number(dto.bankaId);
            // ─── BANKA_ID Geçerliliği & FK Doğrulama ──────────────────────────────
            const checkBankaReq = new sql.Request(transaction);
            checkBankaReq.input("CHK_BID", sql.Int, effectiveBankaId);
            const checkBankaRes = await checkBankaReq.query(`
        SELECT TOP 1 BANKA_ID FROM TODVZ_BANKA WHERE BANKA_ID = @CHK_BID
      `);
            if (!checkBankaRes.recordset?.[0]) {
                let foundExistingId = null;
                // 1. Hesap No ile TODVZ_BANKA içinde ara
                if (dto.bankaHesapNo && dto.bankaHesapNo.trim()) {
                    const matchNoRes = await new sql.Request(transaction)
                        .input("MATCH_NO", sql.VarChar(50), dto.bankaHesapNo.trim())
                        .query(`SELECT TOP 1 BANKA_ID FROM TODVZ_BANKA WHERE HESAP_NO = @MATCH_NO`);
                    if (matchNoRes.recordset?.[0]?.BANKA_ID) {
                        foundExistingId = Number(matchNoRes.recordset[0].BANKA_ID);
                    }
                }
                // 2. Hesap Adı ile TODVZ_BANKA içinde ara
                if (!foundExistingId && dto.bankaHesapAdi && dto.bankaHesapAdi.trim()) {
                    const matchAdiRes = await new sql.Request(transaction)
                        .input("MATCH_ADI", sql.VarChar(200), dto.bankaHesapAdi.trim())
                        .query(`SELECT TOP 1 BANKA_ID FROM TODVZ_BANKA WHERE HESAP_ADI = @MATCH_ADI`);
                    if (matchAdiRes.recordset?.[0]?.BANKA_ID) {
                        foundExistingId = Number(matchAdiRes.recordset[0].BANKA_ID);
                    }
                }
                if (foundExistingId) {
                    effectiveBankaId = foundExistingId;
                }
                else {
                    // 3. TODVZ_BANKA içinde hesap kartı yoksa, TODVZ_CARI_KART veya verilen bilgilerle otomatik kart aç:
                    let yeniHesapNo = (dto.bankaHesapNo || "").trim();
                    let yeniHesapAdi = (dto.bankaHesapAdi || "").trim();
                    let yeniIban = null;
                    if (!yeniHesapNo || !yeniHesapAdi) {
                        const cariBankaRes = await new sql.Request(transaction)
                            .input("CARI_BID", sql.Int, effectiveBankaId)
                            .query(`SELECT TOP 1 KOD, AD, UNVAN, IBAN FROM TODVZ_CARI_KART WHERE CARI_KART_ID = @CARI_BID`);
                        if (cariBankaRes.recordset?.[0]) {
                            yeniHesapNo = yeniHesapNo || (cariBankaRes.recordset[0].KOD || "").trim();
                            yeniHesapAdi = yeniHesapAdi || (cariBankaRes.recordset[0].UNVAN || cariBankaRes.recordset[0].AD || "").trim();
                            yeniIban = cariBankaRes.recordset[0].IBAN ? String(cariBankaRes.recordset[0].IBAN).trim() : null;
                        }
                    }
                    if (!yeniHesapNo)
                        yeniHesapNo = "102.01.001";
                    if (!yeniHesapAdi)
                        yeniHesapAdi = "Banka Ticari TL Hesabı";
                    const checkIdentity = await new sql.Request(transaction).query(`
            SELECT COLUMNPROPERTY(OBJECT_ID('TODVZ_BANKA'), 'BANKA_ID', 'IsIdentity') AS IsIdentity
          `);
                    const isIdentity = checkIdentity.recordset?.[0]?.IsIdentity === 1;
                    if (isIdentity) {
                        const insRes = await new sql.Request(transaction)
                            .input("HNO", sql.VarChar(50), yeniHesapNo)
                            .input("HADI", sql.VarChar(200), yeniHesapAdi)
                            .input("IBAN", sql.VarChar(34), yeniIban)
                            .input("UID", sql.Int, kullaniciId || 1)
                            .query(`
                INSERT INTO TODVZ_BANKA (HESAP_NO, HESAP_ADI, IBAN, DEVIR, AKTIF, EKLEYEN_ID, EKLEME_ZAMANI)
                VALUES (@HNO, @HADI, @IBAN, 0, 1, @UID, GETDATE());
                SELECT SCOPE_IDENTITY() AS [NEW_ID];
              `);
                        const createdId = Number(insRes.recordset?.[0]?.NEW_ID);
                        if (createdId > 0) {
                            effectiveBankaId = createdId;
                        }
                    }
                    else {
                        const nextIdRes = await new sql.Request(transaction).query(`
              SELECT ISNULL(MAX(BANKA_ID), 0) + 1 AS [NEXT_ID] FROM TODVZ_BANKA
            `);
                        const nextId = Number(nextIdRes.recordset?.[0]?.NEXT_ID) || 1;
                        await new sql.Request(transaction)
                            .input("NEW_BANKA_ID", sql.Int, nextId)
                            .input("HNO", sql.VarChar(50), yeniHesapNo)
                            .input("HADI", sql.VarChar(200), yeniHesapAdi)
                            .input("IBAN", sql.VarChar(34), yeniIban)
                            .input("UID", sql.Int, kullaniciId || 1)
                            .query(`
                INSERT INTO TODVZ_BANKA (BANKA_ID, HESAP_NO, HESAP_ADI, IBAN, DEVIR, AKTIF, EKLEYEN_ID, EKLEME_ZAMANI)
                VALUES (@NEW_BANKA_ID, @HNO, @HADI, @IBAN, 0, 1, @UID, GETDATE());
              `);
                        effectiveBankaId = nextId;
                    }
                    // Son garanti kontrol: Eğer hala geçerli değilse tablodaki ilk kaydı al
                    const finalBankaCheck = await new sql.Request(transaction)
                        .input("FBID", sql.Int, effectiveBankaId)
                        .query(`SELECT TOP 1 BANKA_ID FROM TODVZ_BANKA WHERE BANKA_ID = @FBID`);
                    if (!finalBankaCheck.recordset?.[0]?.BANKA_ID) {
                        const fallbackBanka = await new sql.Request(transaction).query(`
              SELECT TOP 1 BANKA_ID FROM TODVZ_BANKA ORDER BY BANKA_ID ASC
            `);
                        if (fallbackBanka.recordset?.[0]?.BANKA_ID) {
                            effectiveBankaId = Number(fallbackBanka.recordset[0].BANKA_ID);
                        }
                    }
                }
            }
            // ─── CARI_KART_ID Doğrulama ──────────────────────────────────────────
            let effectiveCariId = dto.cariKartId ? Number(dto.cariKartId) : null;
            if (effectiveCariId) {
                const checkCari = await new sql.Request(transaction)
                    .input("CHK_CID", sql.Int, effectiveCariId)
                    .query(`SELECT TOP 1 CARI_KART_ID FROM TODVZ_CARI_KART WHERE CARI_KART_ID = @CHK_CID`);
                if (!checkCari.recordset?.[0]) {
                    effectiveCariId = null;
                }
            }
            // ─── VEZNE_ID Doğrulama ───────────────────────────────────────────────
            let effectiveVezneId = dto.vezneId ? Number(dto.vezneId) : null;
            if (effectiveVezneId) {
                const checkVezne = await new sql.Request(transaction)
                    .input("CHK_VID", sql.Int, effectiveVezneId)
                    .query(`SELECT TOP 1 VEZNE_ID FROM TODVZ_VEZNE WHERE VEZNE_ID = @CHK_VID`);
                if (!checkVezne.recordset?.[0]) {
                    effectiveVezneId = null;
                }
            }
            headerReq.input("ISLEM_TIPI", sql.TinyInt, Number(dto.islemTipi) || 0);
            headerReq.input("BANKA_ID", sql.Int, effectiveBankaId);
            headerReq.input("CARI_KART_ID", sql.Int, effectiveCariId);
            headerReq.input("VEZNE_ID", sql.Int, effectiveVezneId);
            headerReq.input("TARIH", sql.DateTime, dto.tarih ? new Date(dto.tarih) : new Date());
            headerReq.input("BELGE_NO", sql.VarChar(50), dto.belgeNo ? dto.belgeNo.trim() : null);
            headerReq.input("ACIKLAMA", sql.VarChar(250), dto.aciklama ? dto.aciklama.trim() : null);
            headerReq.input("KULLANICI_ID", sql.Int, kullaniciId || 1);
            if (isUpdate) {
                savedId = Number(dto.bankaHareketId);
                headerReq.input("BANKA_HAREKET_ID", sql.Int, savedId);
                await headerReq.query(`
          UPDATE TODVZ_BANKA_HAREKET
          SET
            ISLEM_TIPI = @ISLEM_TIPI,
            BANKA_ID = @BANKA_ID,
            CARI_KART_ID = @CARI_KART_ID,
            VEZNE_ID = @VEZNE_ID,
            TARIH = @TARIH,
            BELGE_NO = @BELGE_NO,
            ACIKLAMA = @ACIKLAMA,
            GUNCELLEYEN_ID = @KULLANICI_ID,
            GUNCELLEME_ZAMANI = GETDATE()
          WHERE BANKA_HAREKET_ID = @BANKA_HAREKET_ID
        `);
                // Eski satırları silelim
                const delReq = new sql.Request(transaction);
                delReq.input("BANKA_HAREKET_ID", sql.Int, savedId);
                await delReq.query(`DELETE FROM TODVZ_BANKA_HAREKET_SATIRI WHERE BANKA_HAREKET_ID = @BANKA_HAREKET_ID`);
            }
            else {
                const checkIdentity = await new sql.Request(transaction).query(`
          SELECT COLUMNPROPERTY(OBJECT_ID('TODVZ_BANKA_HAREKET'), 'BANKA_HAREKET_ID', 'IsIdentity') AS IsIdentity
        `);
                const isIdentity = checkIdentity.recordset?.[0]?.IsIdentity === 1;
                if (isIdentity) {
                    const insertRes = await headerReq.query(`
            INSERT INTO TODVZ_BANKA_HAREKET (
              ISLEM_TIPI, BANKA_ID, CARI_KART_ID, VEZNE_ID,
              TARIH, BELGE_NO, ACIKLAMA, IPTAL,
              EKLEYEN_ID, EKLEME_ZAMANI
            )
            VALUES (
              @ISLEM_TIPI, @BANKA_ID, @CARI_KART_ID, @VEZNE_ID,
              @TARIH, @BELGE_NO, @ACIKLAMA, 0,
              @KULLANICI_ID, GETDATE()
            );
            SELECT SCOPE_IDENTITY() AS [NEW_ID];
          `);
                    savedId = Number(insertRes.recordset?.[0]?.NEW_ID);
                }
                else {
                    const nextIdRes = await new sql.Request(transaction).query(`
            SELECT ISNULL(MAX(BANKA_HAREKET_ID), 0) + 1 AS [NEXT_ID] FROM TODVZ_BANKA_HAREKET
          `);
                    savedId = Number(nextIdRes.recordset?.[0]?.NEXT_ID);
                    headerReq.input("NEW_HAREKET_ID", sql.Int, savedId);
                    await headerReq.query(`
            INSERT INTO TODVZ_BANKA_HAREKET (
              BANKA_HAREKET_ID, ISLEM_TIPI, BANKA_ID, CARI_KART_ID, VEZNE_ID,
              TARIH, BELGE_NO, ACIKLAMA, IPTAL,
              EKLEYEN_ID, EKLEME_ZAMANI
            )
            VALUES (
              @NEW_HAREKET_ID, @ISLEM_TIPI, @BANKA_ID, @CARI_KART_ID, @VEZNE_ID,
              @TARIH, @BELGE_NO, @ACIKLAMA, 0,
              @KULLANICI_ID, GETDATE()
            );
          `);
                }
            }
            // Satırları ekleyelim (satirlar boş ise doğrudan meblag alanından 1 satır oluştur)
            let satirlarToSave = dto.satirlar || [];
            if (satirlarToSave.length === 0 && dto.meblag !== undefined && Number(dto.meblag) > 0) {
                satirlarToSave = [{
                        paraId: dto.paraId || 1,
                        meblag: Number(dto.meblag),
                        kur: 1,
                        giseKuru: 1,
                        tutarTl: Number(dto.meblag),
                        aciklama: dto.aciklama,
                    }];
            }
            const validLines = satirlarToSave.filter((s) => s.paraId > 0 && Number(s.meblag) > 0);
            for (let i = 0; i < validLines.length; i++) {
                const line = validLines[i];
                const lineReq = new sql.Request(transaction);
                const meblag = Number(line.meblag) || 0;
                const kur = Number(line.kur) || 1;
                const giseKuru = Number(line.giseKuru) || kur;
                const tutarTl = line.tutarTl !== undefined && Number(line.tutarTl) > 0
                    ? Number(line.tutarTl)
                    : parseFloat((meblag * kur).toFixed(2));
                let effectiveParaId = Number(line.paraId) || 1;
                const checkPara = await new sql.Request(transaction)
                    .input("CHK_PID", sql.Int, effectiveParaId)
                    .query(`SELECT TOP 1 PARA_ID FROM TODVZ_PARA WHERE PARA_ID = @CHK_PID`);
                if (!checkPara.recordset?.[0]) {
                    const firstPara = await new sql.Request(transaction).query(`SELECT TOP 1 PARA_ID FROM TODVZ_PARA ORDER BY PARA_ID ASC`);
                    if (firstPara.recordset?.[0]?.PARA_ID) {
                        effectiveParaId = Number(firstPara.recordset[0].PARA_ID);
                    }
                }
                lineReq.input("BANKA_HAREKET_ID", sql.Int, savedId);
                lineReq.input("SATIR_NO", sql.Int, i + 1);
                lineReq.input("PARA_ID", sql.Int, effectiveParaId);
                lineReq.input("MEBLAG", sql.Float, meblag);
                lineReq.input("KUR", sql.Float, kur);
                lineReq.input("GISE_KURU", sql.Float, giseKuru);
                lineReq.input("TUTAR_TL", sql.Float, tutarTl);
                lineReq.input("ACIKLAMA", sql.VarChar(250), line.aciklama ? line.aciklama.trim() : null);
                await lineReq.query(`
          INSERT INTO TODVZ_BANKA_HAREKET_SATIRI (
            BANKA_HAREKET_ID, SATIR_NO, PARA_ID, MEBLAG, KUR, GISE_KURU, TUTAR_TL, ACIKLAMA
          )
          VALUES (
            @BANKA_HAREKET_ID, @SATIR_NO, @PARA_ID, @MEBLAG, @KUR, @GISE_KURU, @TUTAR_TL, @ACIKLAMA
          );
        `);
            }
            await transaction.commit();
            const saved = await this.getHareketById(savedId, dbContext);
            if (!saved)
                throw ApiError.internal("Banka hareketi kaydedildi ancak okunamadı.");
            return saved;
        }
        catch (err) {
            await transaction.rollback();
            logger.error("[BankaSqlRepository.saveHareket] Error:", err);
            throw ApiError.badRequest(err.message || "Banka hareketi kaydedilemedi.");
        }
    }
    static async deleteHareket(bankaHareketId, kullaniciId, dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await this.ensureTables(pool);
        const transaction = new sql.Transaction(pool);
        await transaction.begin();
        try {
            const satReq = new sql.Request(transaction);
            satReq.input("ID", sql.Int, bankaHareketId);
            await satReq.query(`DELETE FROM TODVZ_BANKA_HAREKET_SATIRI WHERE BANKA_HAREKET_ID = @ID`);
            const headReq = new sql.Request(transaction);
            headReq.input("ID", sql.Int, bankaHareketId);
            await headReq.query(`DELETE FROM TODVZ_BANKA_HAREKET WHERE BANKA_HAREKET_ID = @ID`);
            // e-Banka: Vomsis'ten otomatik kesilmiş fiş silinirse hareket "aktarılmayacak" olur, kendiliğinden yeniden fiş kesilmez (docs/EBANKA_VOMSIS_YOL_HARITASI.md, E23)
            const ebankaReq = new sql.Request(transaction);
            ebankaReq.input("ID", sql.Int, bankaHareketId);
            await ebankaReq.query(`
        IF OBJECT_ID('TODVZ_EBANKA_HAREKET', 'U') IS NOT NULL
          UPDATE TODVZ_EBANKA_HAREKET SET AKTARIM_DURUMU = 2, BANKA_HAREKET_ID = NULL WHERE BANKA_HAREKET_ID = @ID;
        -- POS satırlarından elle kesilmiş fiş silinirse satırlar yeniden fişlenebilir olur (E21)
        IF OBJECT_ID('TODVZ_EBANKA_POS_HAREKET', 'U') IS NOT NULL
          UPDATE TODVZ_EBANKA_POS_HAREKET SET BANKA_HAREKET_ID = NULL WHERE BANKA_HAREKET_ID = @ID;
      `);
            await transaction.commit();
            return true;
        }
        catch (err) {
            await transaction.rollback();
            throw ApiError.badRequest(err.message || "Banka hareketi silinemedi.");
        }
    }
    static async toggleIptalHareket(bankaHareketId, iptal, kullaniciId, dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await this.ensureTables(pool);
        const req = pool.request();
        req.input("ID", sql.Int, bankaHareketId);
        req.input("IPTAL", sql.Bit, iptal ? 1 : 0);
        req.input("KULLANICI_ID", sql.Int, kullaniciId || 1);
        await req.query(`
      UPDATE TODVZ_BANKA_HAREKET
      SET 
        IPTAL = @IPTAL,
        IPTAL_TARIHI = CASE WHEN @IPTAL = 1 THEN GETDATE() ELSE NULL END,
        GUNCELLEYEN_ID = @KULLANICI_ID,
        GUNCELLEME_ZAMANI = GETDATE()
      WHERE BANKA_HAREKET_ID = @ID;

      -- e-Banka: Vomsis'ten kesilmiş fiş iptal edilince hareket "aktarılmayacak" olur; iptal geri alınırsa yeniden "aktarıldı" (E23)
      IF OBJECT_ID('TODVZ_EBANKA_HAREKET', 'U') IS NOT NULL
        UPDATE TODVZ_EBANKA_HAREKET SET AKTARIM_DURUMU = CASE WHEN @IPTAL = 1 THEN 2 ELSE 1 END WHERE BANKA_HAREKET_ID = @ID;
    `);
        return true;
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // LOOKUPS (Banka Adı Dürbün, Muhasebe Kodları, Paralar, Cariler, Vezneler)
    // ═══════════════════════════════════════════════════════════════════════════
    static async getLookups(dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await this.ensureTables(pool);
        // 1. Banka Adları (TODVZ_CARI_KART içerisindeki banka hesapları ve kartları)
        let bankaAdlari = [];
        try {
            const cariBankaRes = await pool.request().query(`
        SELECT 
          CARI_KART_ID as id,
          KOD as kod,
          AD as ad,
          AD as unvan,
          AD as bankaAdi,
          ISNULL(TELEFON, '') as telefon,
          ISNULL(VERGI_KIMLIK_NO, '') as vergiNo,
          ISNULL(ADRES, '') as adres
        FROM [dbo].[TODVZ_CARI_KART]
        WHERE KOD LIKE '102%' 
           OR AD LIKE '%BANK%' 
           OR FILTRE LIKE '%Banka%' 
           OR AD LIKE '%KATILIM%' 
           OR AD LIKE '%GARANT%' 
           OR AD LIKE '%AKBANK%' 
           OR AD LIKE '%İŞ BANK%' 
           OR AD LIKE '%VAKIF%' 
           OR AD LIKE '%ZİRAAT%' 
           OR AD LIKE '%YAPI KREDİ%' 
           OR AD LIKE '%HALK%' 
           OR AD LIKE '%QNB%' 
           OR AD LIKE '%DENİZ%' 
           OR AD LIKE '%TEB%'
        ORDER BY KOD ASC, AD ASC
      `);
            bankaAdlari = cariBankaRes.recordset || [];
        }
        catch (err) {
            logger.warn(`[BankaSqlRepository.getLookups] CARI_KART banka sorgusu: ${err.message}`);
            bankaAdlari = [];
        }
        // Yedek / Varsayılan Standart Bankalar (DovizFisiPage eşleniği)
        if (bankaAdlari.length === 0) {
            bankaAdlari = [
                { id: 102001, kod: "102.01.001", ad: "Garanti BBVA - Ticari TL Hesabı", unvan: "Garanti BBVA - Ticari TL Hesabı", bankaAdi: "Garanti BBVA", iban: "TR33 0006 2000 0001 2345 6789 01", hesapNo: "6200000-1" },
                { id: 102002, kod: "102.01.002", ad: "Akbank - Ana Şube Cari Hesap", unvan: "Akbank - Ana Şube Cari Hesap", bankaAdi: "Akbank", iban: "TR45 0004 6000 0002 3456 7890 12", hesapNo: "4600000-2" },
                { id: 102003, kod: "102.01.003", ad: "İş Bankası - Kapalıçarşı Ticari TL", unvan: "İş Bankası - Kapalıçarşı Ticari TL", bankaAdi: "İş Bankası", iban: "TR64 0006 4000 0003 4567 8901 23", hesapNo: "6400000-3" },
                { id: 102004, kod: "102.01.004", ad: "Yapı Kredi - Döviz & Altın Operasyon", unvan: "Yapı Kredi - Döviz & Altın Operasyon", bankaAdi: "Yapı Kredi", iban: "TR92 0006 7000 0004 5678 9012 34", hesapNo: "6700000-4" },
                { id: 102005, kod: "102.01.005", ad: "Ziraat Bankası - Kurumsal Vadesiz", unvan: "Ziraat Bankası - Kurumsal Vadesiz", bankaAdi: "Ziraat Bankası", iban: "TR10 0001 0000 0005 6789 0123 45", hesapNo: "1000000-5" },
                { id: 102006, kod: "102.01.006", ad: "VakıfBank - Merkez Şube Hesabı", unvan: "VakıfBank - Merkez Şube Hesabı", bankaAdi: "VakıfBank", iban: "TR15 0001 5000 0006 7890 1234 56", hesapNo: "1500000-6" },
                { id: 102007, kod: "102.01.007", ad: "QNB Finansbank - Kurumsal Cari", unvan: "QNB Finansbank - Kurumsal Cari", bankaAdi: "QNB Finansbank", iban: "TR88 0011 1000 0007 8901 2345 67", hesapNo: "1110000-7" },
                { id: 102008, kod: "102.01.008", ad: "Halkbank - Ticari Cari Hesap", unvan: "Halkbank - Ticari Cari Hesap", bankaAdi: "Halkbank", iban: "TR20 0001 2000 0008 9012 3456 78", hesapNo: "1200000-8" },
                { id: 102009, kod: "102.01.009", ad: "DenizBank - Merkez Şube", unvan: "DenizBank - Merkez Şube", bankaAdi: "DenizBank", iban: "TR55 0013 4000 0009 0123 4567 89", hesapNo: "1340000-9" },
                { id: 102010, kod: "102.01.010", ad: "Kuveyt Türk - Katılım Hesabı", unvan: "Kuveyt Türk - Katılım Hesabı", bankaAdi: "Kuveyt Türk", iban: "TR30 0020 5000 0010 1234 5678 90", hesapNo: "2050000-10" },
            ];
        }
        // 2. Paralar (TODVZ_PARA)
        let paralar = [];
        try {
            const pRes = await pool.request().query(`
        SELECT PARA_ID as id, KOD as kod, AD as ad, DOVIZ_ALIS_HUCRE_ORANI as alisKuru, DOVIZ_SATIS_HUCRE_ORANI as satisKuru
        FROM TODVZ_PARA
        ORDER BY PARA_ID ASC
      `);
            paralar = pRes.recordset || [];
        }
        catch {
            paralar = [
                { id: 1, kod: "TL", ad: "Türk Lirası", alisKuru: 1, satisKuru: 1 },
                { id: 2, kod: "USD", ad: "Amerikan Doları", alisKuru: 34.5, satisKuru: 34.6 },
                { id: 3, kod: "EUR", ad: "Euro", alisKuru: 37.8, satisKuru: 37.9 },
                { id: 4, kod: "HAS", ad: "Has Altın", alisKuru: 3000, satisKuru: 3020 },
            ];
        }
        // 3. Vezneler (TODVZ_VEZNE)
        let vezneler = [];
        try {
            const vRes = await pool.request().query(`
        SELECT VEZNE_ID as id, KOD as kod, AD as ad
        FROM TODVZ_VEZNE
        ORDER BY KOD ASC
      `);
            vezneler = vRes.recordset || [];
        }
        catch {
            vezneler = [];
        }
        // 4. Cariler (TODVZ_CARI_KART)
        let cariler = [];
        try {
            const cRes = await pool.request().query(`
        SELECT TOP 300 CARI_KART_ID as id, KOD as kod, AD as unvan, TELEFON as telefon, VERGI_KIMLIK_NO as vergiNo
        FROM TODVZ_CARI_KART
        ORDER BY KOD ASC
      `);
            cariler = cRes.recordset || [];
        }
        catch {
            cariler = [];
        }
        // 5. Muhasebe Kodları (TODVZ_MUH_HESAP)
        let muhHesaplar = [];
        try {
            const mRes = await pool.request().query(`
        SELECT MUH_HESAP_KODU as kod, ACIKLAMA as ad
        FROM TODVZ_MUH_HESAP
        WHERE MUH_HESAP_KODU LIKE '102%' OR MUH_HESAP_KODU LIKE '100%' OR MUH_HESAP_KODU LIKE '108%'
        ORDER BY MUH_HESAP_KODU ASC
      `);
            muhHesaplar = mRes.recordset || [];
        }
        catch {
            muhHesaplar = [
                { kod: "102.01.001", ad: "Garanti BBVA Ticari TL" },
                { kod: "102.01.002", ad: "Akbank Ticari TL" },
                { kod: "102.01.003", ad: "İş Bankası Ticari TL" },
                { kod: "102.02.001", ad: "Garanti BBVA Döviz USD" },
                { kod: "102.02.002", ad: "Akbank Döviz EUR" },
                { kod: "108.01.001", ad: "Diğer Hazır Değerler - POS" },
            ];
        }
        return {
            bankaAdlari,
            paralar,
            vezneler,
            cariler,
            muhHesaplar,
        };
    }
}
