import sql from "mssql";
import crypto from "crypto";
import { getDbPool } from "../config/mssql.config.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";
export class DovizFisSqlRepository {
    static async ensureTablesAndProceduresExist(pool) {
        try {
            // 1. Table: TODVZ_FIS
            await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TODVZ_FIS')
        BEGIN
          CREATE TABLE [dbo].[TODVZ_FIS](
            [FIS_ID] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            [VEZNE_ID] INT NOT NULL,
            [TIP] TINYINT NOT NULL DEFAULT(0),
            [TARIH] DATETIME NOT NULL,
            [ZAMAN] DATETIME NOT NULL DEFAULT(GETDATE()),
            [SERI_NO] VARCHAR(20) NULL,
            [BELGE_NO] VARCHAR(50) NULL,
            [GELIS_NEDENI] VARCHAR(100) NULL,
            [KUR_TURU] TINYINT NOT NULL DEFAULT(0),
            [ISTATISTIK_ID] INT NULL,
            [CARI_KART_ID] INT NULL,
            [KAYITSIZ_MUSTERI_ID] INT NULL,
            [UNVAN] VARCHAR(100) NULL,
            [KISILIK_TIPI] TINYINT NOT NULL DEFAULT(0),
            [UYRUK_ID] INT NULL,
            [ULKE_ID] INT NULL,
            [PASAPORT_NO] VARCHAR(30) NULL,
            [HUKUKI_YAPI_ID] INT NULL,
            [VERGI_DAIRESI_ID] INT NULL,
            [VERGI_KIMLIK_NO] VARCHAR(20) NULL,
            [BABA_ADI] VARCHAR(50) NULL,
            [ADRES] VARCHAR(250) NULL,
            [ILCE_ID] INT NULL,
            [POSTA_KODU_ID] INT NULL,
            [IL_ID] INT NULL,
            [VEKIL_TURU] TINYINT NULL,
            [VEKIL_KISILIK_TIPI] TINYINT NULL,
            [VEKIL_ADI] VARCHAR(50) NULL,
            [VEKIL_KIMLIK_NO] VARCHAR(20) NULL,
            [TOPLAM_TUTAR] DECIMAL(18,4) NOT NULL DEFAULT(0),
            [YUVARLAMA] DECIMAL(18,4) NOT NULL DEFAULT(0),
            [ODEME_TUTARI] DECIMAL(18,4) NOT NULL DEFAULT(0),
            [BANKA_HESABI_ID] INT NULL,
            [KMV_UYGULAMA_SEKLI] TINYINT NULL,
            [EPOSTA] VARCHAR(100) NULL,
            [MERKEZ_USD_KURU] DECIMAL(18,6) NULL,
            [GISE_USD_KURU] DECIMAL(18,6) NULL,
            [GM_BEYANNAME_TARIH] DATETIME NULL,
            [GM_BEYANNAME_NO] VARCHAR(30) NULL,
            [GM_DOVIZ_TARIH] DATETIME NULL,
            [GM_DOVIZ_SAYI] VARCHAR(30) NULL,
            [GM_TEYIT_TARIH] DATETIME NULL,
            [GM_TEYIT_SAYI] VARCHAR(30) NULL,
            [GM_FATURA_NO] VARCHAR(30) NULL,
            [ARBITRAJ_ID] INT NULL,
            [TELEFON_NO] VARCHAR(30) NULL,
            [MESLEK_ID] INT NULL,
            [DOGUM_TARIHI] DATETIME NULL,
            [DOGUM_YERI] VARCHAR(100) NULL,
            [KIMLIK_SERI_NO] VARCHAR(30) NULL,
            [ANNE_ADI] VARCHAR(50) NULL,
            [IPTAL] BIT NOT NULL DEFAULT(0),
            [IPTAL_TARIHI] DATETIME NULL,
            [MASAK_LISTESINDE_VAR] BIT NOT NULL DEFAULT(0),
            [SUPHELI_ISLEMLER_YETKILI_ID] INT NULL,
            [YUVARLAMA_ARALIGI] DECIMAL(18,4) NULL,
            [YUVARLAMA_ESIGI] DECIMAL(18,4) NULL,
            [E_FATURA_POSTA_KUTUSU] VARCHAR(100) NULL,
            [BELGE_TURU] TINYINT NULL,
            [E_FATURA_ETTN] UNIQUEIDENTIFIER NULL,
            [KIMLIK_GECERLILIK_TARIHI] DATETIME NULL,
            [KIMLIK_BELGE_TURU] TINYINT NULL,
            [EKLEYEN_ID] INT NOT NULL DEFAULT(1),
            [EKLEME_ZAMANI] DATETIME NOT NULL DEFAULT(GETDATE()),
            [GUNCELLEYEN_ID] INT NOT NULL DEFAULT(1),
            [GUNCELLEME_ZAMANI] DATETIME NOT NULL DEFAULT(GETDATE()),
            [GUID] UNIQUEIDENTIFIER NULL
          )
        END

        IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TODVZ_FIS')
        BEGIN
          IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_FIS' AND COLUMN_NAME = 'SIRKET_TURU')
            ALTER TABLE [dbo].[TODVZ_FIS] ADD [SIRKET_TURU] TINYINT NULL;
          IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_FIS' AND COLUMN_NAME = 'DERNEK_AMACI')
            ALTER TABLE [dbo].[TODVZ_FIS] ADD [DERNEK_AMACI] VARCHAR(100) NULL;
          IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_FIS' AND COLUMN_NAME = 'YETKILI_KISI_ID')
            ALTER TABLE [dbo].[TODVZ_FIS] ADD [YETKILI_KISI_ID] INT NULL;
          IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_FIS' AND COLUMN_NAME = 'YETKILI_KISI')
            ALTER TABLE [dbo].[TODVZ_FIS] ADD [YETKILI_KISI] VARCHAR(100) NULL;
          IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_FIS' AND COLUMN_NAME = 'KIMLIK_KAYNAGI')
            ALTER TABLE [dbo].[TODVZ_FIS] ADD [KIMLIK_KAYNAGI] VARCHAR(100) NULL;
          IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_FIS' AND COLUMN_NAME = 'POSTA_KODU')
            ALTER TABLE [dbo].[TODVZ_FIS] ADD [POSTA_KODU] VARCHAR(20) NULL;
          IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_FIS' AND COLUMN_NAME = 'ILCE')
            ALTER TABLE [dbo].[TODVZ_FIS] ADD [ILCE] VARCHAR(100) NULL;
          IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TODVZ_FIS' AND COLUMN_NAME = 'IL')
            ALTER TABLE [dbo].[TODVZ_FIS] ADD [IL] VARCHAR(100) NULL;
        END
      `);
            // 2. Table: TODVZ_FIS_SATIRI
            await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TODVZ_FIS_SATIRI')
        BEGIN
          CREATE TABLE [dbo].[TODVZ_FIS_SATIRI](
            [FIS_SATIRI_ID] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            [FIS_ID] INT NOT NULL,
            [SATIR_NO] INT NOT NULL,
            [MIKTAR] DECIMAL(18,4) NOT NULL DEFAULT(0),
            [PARA_ID] INT NOT NULL,
            [KUR] DECIMAL(18,6) NOT NULL DEFAULT(1),
            [ISCILIK] DECIMAL(18,4) NOT NULL DEFAULT(0),
            [GISE_KURU] DECIMAL(18,6) NOT NULL DEFAULT(1),
            [TUTAR] DECIMAL(18,4) NOT NULL DEFAULT(0),
            [KOMISYON_ORANI] DECIMAL(18,4) NOT NULL DEFAULT(0),
            [KOMISYON] DECIMAL(18,4) NOT NULL DEFAULT(0),
            [BMV_ORANI] DECIMAL(18,4) NOT NULL DEFAULT(0),
            [BMV] DECIMAL(18,4) NOT NULL DEFAULT(0),
            [KMV_ORANI] DECIMAL(18,4) NOT NULL DEFAULT(0),
            [KMV] DECIMAL(18,4) NOT NULL DEFAULT(0),
            [KDV_ORANI] DECIMAL(18,4) NOT NULL DEFAULT(0),
            [KDV] DECIMAL(18,4) NOT NULL DEFAULT(0),
            [BANKA_HESABI_ID] INT NULL,
            [SERI_NO] VARCHAR(20) NULL,
            [BELGE_NO] VARCHAR(50) NULL,
            [ETTN] UNIQUEIDENTIFIER NULL,
            [E_BELGE_DURUMU] TINYINT NULL DEFAULT(0),
            [E_BELGE_HATA_ACIKLAMASI] VARCHAR(250) NULL
          )
        END
      `);
        }
        catch (err) {
            logger.warn("DovizFisSqlRepository.ensureTablesAndProceduresExist warning:", err);
        }
    }
    /**
     * Save or Update Döviz Fişi via Stored Procedure SODVZ_FIS_KAYDET
     */
    static async saveViaProcedure(dto, dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await DovizFisSqlRepository.ensureTablesAndProceduresExist(pool);
        const isUpdate = dto.fisId !== undefined && dto.fisId !== null && Number(dto.fisId) > 0;
        const targetFisId = isUpdate ? Number(dto.fisId) : null;
        const tip = dto.tip === 1 ? 1 : 0; // 0: Alış, 1: Satış
        const parseDate = (d) => {
            if (!d)
                return new Date();
            if (d instanceof Date) {
                if (isNaN(d.getTime()))
                    return new Date();
                const y = d.getFullYear();
                if (y <= 1900 || y > 9999)
                    return new Date();
                return d;
            }
            const str = String(d).trim();
            if (!str ||
                str === "null" ||
                str === "undefined" ||
                str === "NaN" ||
                str === "0" ||
                str === "0000-00-00" ||
                str.startsWith("0001-01-01") ||
                str.startsWith("1899-12-30") ||
                str.startsWith("1900-01-01")) {
                return new Date();
            }
            const dt = new Date(str);
            if (isNaN(dt.getTime()))
                return new Date();
            const y = dt.getFullYear();
            if (y <= 1900 || y > 9999)
                return new Date();
            return dt;
        };
        const safeDate = (val) => {
            if (!val)
                return null;
            if (val instanceof Date) {
                if (isNaN(val.getTime()))
                    return null;
                const y = val.getFullYear();
                if (y <= 1900 || y > 9999)
                    return null;
                return val;
            }
            const str = String(val).trim();
            if (!str ||
                str === "null" ||
                str === "undefined" ||
                str === "NaN" ||
                str === "0" ||
                str === "0000-00-00" ||
                str.startsWith("0001-01-01") ||
                str.startsWith("1899-12-30") ||
                str.startsWith("1900-01-01")) {
                return null;
            }
            const dt = new Date(str);
            if (isNaN(dt.getTime()))
                return null;
            const y = dt.getFullYear();
            if (y <= 1900 || y > 9999)
                return null;
            return dt;
        };
        const parsedTarih = parseDate(dto.tarih);
        const parsedZaman = parseDate(dto.zaman || dto.tarih);
        const currentYear = parsedTarih.getFullYear();
        // Default sequential numbers if not provided
        let seriNo = (dto.seriNo || "").trim();
        let belgeNo = (dto.belgeNo || "").trim();
        if (!seriNo || !belgeNo) {
            const seqRes = await pool.request().query(`
        SELECT COUNT(*) AS CNT FROM [dbo].[TODVZ_FIS] WITH (NOLOCK) WHERE [TIP] = ${tip}
      `);
            const nextNum = (Number(seqRes.recordset[0]?.CNT || 0) + 1).toString().padStart(7, "0");
            const nextBelgeNum = (Number(seqRes.recordset[0]?.CNT || 0) + 1).toString().padStart(10, "0");
            if (!seriNo) {
                seriNo = tip === 1 ? `YSS${nextNum}` : `YAB${nextNum}`;
            }
            if (!belgeNo) {
                belgeNo = tip === 1 ? `DIS${currentYear}${nextBelgeNum}` : `DIA${currentYear}${nextBelgeNum}`;
            }
        }
        // Pre-fetch para map from DB to ensure any missing or code-only paraId is accurately resolved
        const paraMap = new Map();
        try {
            const paraRes = await pool.request().query("SELECT PARA_ID, KOD FROM [dbo].[TODVZ_PARA] WITH (NOLOCK)");
            if (paraRes.recordset) {
                for (const p of paraRes.recordset) {
                    if (p.KOD)
                        paraMap.set(String(p.KOD).trim().toUpperCase(), Number(p.PARA_ID));
                }
            }
        }
        catch {
            // ignore
        }
        let defaultParaId = 1;
        if (paraMap.size > 0) {
            const firstVal = paraMap.values().next().value;
            if (firstVal && Number(firstVal) > 0)
                defaultParaId = Number(firstVal);
        }
        // Calculate totals from items - ALWAYS 0-indexed satirNo for SODVZ_FIS_KAYDET temp table
        let toplamTutar = 0;
        const items = dto.satirlar.map((s, idx) => {
            let pId = Number(s.paraId);
            if ((!pId || pId <= 0) && s.paraKodu) {
                pId = paraMap.get(String(s.paraKodu).trim().toUpperCase()) || 0;
            }
            if (!pId || pId <= 0) {
                pId = defaultParaId;
            }
            const miktar = Number(s.miktar) || 0;
            const kur = Number(s.kur) || 1.0;
            const tutar = Number(s.tutar) || (miktar * kur);
            toplamTutar += tutar;
            const satirNo = idx; // In SODVZ_FIS_KAYDET, SATIR_NO must always be 0-based for #TODVZ_ISKELE_FIS_SATIRI
            const bmvOrani = tip === 1 ? (s.bmvOrani !== undefined && s.bmvOrani !== null ? Number(s.bmvOrani) : 0.2) : 0;
            const bmv = tip === 1 ? (s.bmv !== undefined && s.bmv !== null && Number(s.bmv) > 0 ? Number(s.bmv) : (tutar * 0.002)) : 0;
            return {
                satirNo,
                paraId: pId,
                paraKodu: s.paraKodu || "",
                paraAdi: s.paraAdi || "",
                miktar,
                kur,
                iscilik: Number(s.iscilik) || 0,
                giseKuru: Number(s.giseKuru) || kur,
                tutar,
                komisyonOrani: Number(s.komisyonOrani) || 0,
                komisyon: Number(s.komisyon) || 0,
                bmvOrani,
                bmv,
                kmvOrani: Number(s.kmvOrani) || 0,
                kmv: Number(s.kmv) || 0,
                kdvOrani: Number(s.kdvOrani) || 0,
                kdv: Number(s.kdv) || 0,
                bankaHesabiId: s.bankaHesabiId || null,
                seriNo: s.seriNo || seriNo || null,
                belgeNo: s.belgeNo || belgeNo || null,
            };
        });
        const bsmvTotal = items.reduce((acc, r) => acc + (r.bmv || 0), 0);
        const calculatedOdeme = tip === 1 ? (toplamTutar + bsmvTotal) : toplamTutar;
        const finalToplamTutar = Number(dto.toplamTutar) || toplamTutar;
        const finalOdemeTutari = Number(dto.odemeTutari) || calculatedOdeme;
        const yuvarlama = Number(dto.yuvarlama) || 0;
        const unvan = (dto.unvan || "").trim() || "İsim beyan edilmemiştir";
        const gelisNedeni = (dto.gelisNedeni || "").trim() || "32 SAYILI KARAR GEREĞİ";
        const kurTuru = dto.kurTuru ?? 0;
        const istatistikId = dto.istatistikId || (tip === 1 ? 10285 : 9249);
        const kullaniciId = Number(dto.kullaniciId) || 1;
        const vezneId = (dto.vezneId && Number(dto.vezneId) > 0) ? Number(dto.vezneId) : kullaniciId;
        const guid = dto.guid || crypto.randomUUID();
        // Helper: Safely resolve positive integer ID or null (never pass 0 or negative ID into foreign key parameters)
        const toValidId = (v) => {
            const n = Number(v);
            return (!isNaN(n) && n > 0) ? n : null;
        };
        // Check if SODVZ_FIS_KAYDET exists in the DB
        const procCheck = await pool.request().query(`
      SELECT 1 FROM sys.procedures WHERE name = 'SODVZ_FIS_KAYDET'
    `);
        const hasProcedure = (procCheck.recordset?.length || 0) > 0;
        let savedFisId = targetFisId || 0;
        if (!dto.tarih) {
            throw ApiError.badRequest("Lütfen işlem tarihini belirtiniz.");
        }
        if (!items || items.length === 0) {
            throw ApiError.badRequest("Fiş kaydı için en az bir geçerli döviz satırı girilmelidir.");
        }
        for (let i = 0; i < items.length; i++) {
            const it = items[i];
            if (!it.paraId || it.paraId <= 0) {
                throw ApiError.badRequest(`${i + 1}. satırda döviz cinsi seçilmemiştir. Lütfen para birimini seçiniz.`);
            }
            if (it.miktar <= 0) {
                throw ApiError.badRequest(`${i + 1}. satırda miktar 0 veya negatif olamaz. Lütfen geçerli bir miktar giriniz.`);
            }
            if (it.kur <= 0) {
                throw ApiError.badRequest(`${i + 1}. satırda kur 0 veya negatif olamaz. Lütfen geçerli bir kur oranı giriniz.`);
            }
        }
        if (!hasProcedure) {
            throw ApiError.badRequest("Veritabanında SODVZ_FIS_KAYDET stored procedure bulunamadı. Kayıt işlemi sadece stored procedure üzerinden yapılmalıdır.");
        }
        // Execute strictly via Stored Procedure SODVZ_FIS_KAYDET
        try {
            const procReq = pool.request();
            const cleanSeriNo = (dto.seriNo && dto.seriNo.trim()) ? dto.seriNo.trim().slice(0, 20) : (seriNo ? seriNo.slice(0, 20) : null);
            const cleanBelgeNo = (dto.belgeNo && dto.belgeNo.trim()) ? dto.belgeNo.trim().slice(0, 20) : (belgeNo ? belgeNo.slice(0, 20) : null);
            const cleanUnvan = unvan.slice(0, 200);
            const cleanGelisNedeni = gelisNedeni.slice(0, 100);
            const cleanVkn = (dto.vergiKimlikNo || "").trim().slice(0, 20) || null;
            const cleanAdres = (dto.adres || "").trim().slice(0, 100) || null;
            const cleanTel = (dto.telefonNo || "").trim().slice(0, 20) || null;
            const cleanPasaport = (dto.pasaportNo || "").trim().slice(0, 20) || null;
            const cleanBaba = (dto.babaAdi || "").trim().slice(0, 200) || null;
            const cleanAnne = (dto.anneAdi || "").trim().slice(0, 200) || null;
            const cleanDogumYeri = (dto.dogumYeri || "").trim().slice(0, 100) || null;
            const cleanKimlikSeriNo = (dto.kimlikSeriNo || "").trim().slice(0, 20) || null;
            const cleanVekilAdi = (dto.vekilAdi || "").trim().slice(0, 200) || null;
            const cleanVekilKimlik = (dto.vekilKimlikNo || "").trim().slice(0, 20) || null;
            const cleanEposta = (dto.eposta || "").trim().slice(0, 100) || null;
            const cleanGmBeyannameNo = (dto.gmBeyannameNo || "").trim().slice(0, 20) || null;
            const cleanGmDovizSayi = (dto.gmDovizSayi || "").trim().slice(0, 20) || null;
            const cleanGmTeyitSayi = (dto.gmTeyitSayi || "").trim().slice(0, 20) || null;
            const cleanGmFaturaNo = (dto.gmFaturaNo || "").trim().slice(0, 20) || null;
            const cleanDernekAmaci = (dto.dernekAmaci || "").trim().slice(0, 200) || null;
            const cleanPostaKutusu = (dto.eFaturaPostaKutusu || "").trim().slice(0, 200) || null;
            // Header / Procedure Input Parameters
            procReq.input("FIS_ID_IN", sql.Int, targetFisId || null);
            procReq.input("VEZNE_ID", sql.Int, vezneId);
            procReq.input("TIP", sql.TinyInt, tip);
            procReq.input("TARIH", sql.DateTime, parsedTarih);
            procReq.input("ZAMAN", sql.DateTime, parsedZaman);
            procReq.input("SERI_NO_IN", sql.VarChar(20), cleanSeriNo);
            procReq.input("BELGE_NO_IN", sql.VarChar(20), cleanBelgeNo);
            procReq.input("GELIS_NEDENI", sql.VarChar(100), cleanGelisNedeni);
            procReq.input("KUR_TURU", sql.TinyInt, kurTuru);
            procReq.input("ISTATISTIK_ID", sql.Int, istatistikId);
            procReq.input("CARI_KART_ID", sql.Int, toValidId(dto.cariKartId));
            procReq.input("UNVAN", sql.VarChar(200), cleanUnvan);
            procReq.input("KISILIK_TIPI", sql.TinyInt, dto.kisilikTipi || 0);
            procReq.input("UYRUK_ID", sql.Int, toValidId(dto.uyrukId));
            procReq.input("ULKE_ID", sql.Int, toValidId(dto.ulkeId));
            procReq.input("PASAPORT_NO", sql.VarChar(20), cleanPasaport);
            procReq.input("HUKUKI_YAPI_ID", sql.Int, toValidId(dto.hukukiYapiId));
            procReq.input("VERGI_DAIRESI_ID", sql.Int, toValidId(dto.vergiDairesiId));
            procReq.input("VERGI_KIMLIK_NO", sql.VarChar(20), cleanVkn);
            procReq.input("BABA_ADI", sql.VarChar(200), cleanBaba);
            procReq.input("ADRES", sql.VarChar(100), cleanAdres);
            procReq.input("ILCE_ID", sql.Int, toValidId(dto.ilceId));
            procReq.input("POSTA_KODU_ID", sql.Int, toValidId(dto.postaKoduId));
            procReq.input("IL_ID", sql.Int, toValidId(dto.ilId));
            procReq.input("VEKIL_TURU", sql.TinyInt, dto.vekilTuru || 0);
            procReq.input("VEKIL_KISILIK_TIPI", sql.TinyInt, dto.vekilKisilikTipi || 0);
            procReq.input("VEKIL_ADI", sql.VarChar(200), cleanVekilAdi);
            procReq.input("VEKIL_KIMLIK_NO", sql.VarChar(20), cleanVekilKimlik);
            procReq.input("TOPLAM_TUTAR", sql.Float, finalToplamTutar);
            procReq.input("YUVARLAMA", sql.Float, yuvarlama);
            procReq.input("ODEME_TUTARI", sql.Float, finalOdemeTutari);
            procReq.input("BANKA_HESABI_ID", sql.Int, toValidId(dto.bankaHesabiId));
            procReq.input("KMV_UYGULAMA_SEKLI", sql.TinyInt, dto.kmvUygulamaSekli || 0);
            procReq.input("EPOSTA", sql.VarChar(100), cleanEposta);
            procReq.input("MERKEZ_USD_KURU", sql.Float, dto.merkezUsdKuru || 1.0);
            procReq.input("GISE_USD_KURU", sql.Float, dto.giseUsdKuru || 1.0);
            procReq.input("GM_BEYANNAME_TARIH", sql.DateTime, safeDate(dto.gmBeyannameTarih));
            procReq.input("GM_BEYANNAME_NO", sql.VarChar(20), cleanGmBeyannameNo);
            procReq.input("GM_DOVIZ_TARIH", sql.DateTime, safeDate(dto.gmDovizTarih));
            procReq.input("GM_DOVIZ_SAYI", sql.VarChar(20), cleanGmDovizSayi);
            procReq.input("GM_TEYIT_TARIH", sql.DateTime, safeDate(dto.gmTeyitTarih));
            procReq.input("GM_TEYIT_SAYI", sql.VarChar(20), cleanGmTeyitSayi);
            procReq.input("GM_FATURA_NO", sql.VarChar(20), cleanGmFaturaNo);
            procReq.input("ARBITRAJ_ID", sql.Int, toValidId(dto.arbitrajId));
            procReq.input("TELEFON_NO", sql.VarChar(20), cleanTel);
            procReq.input("MESLEK_ID", sql.Int, toValidId(dto.meslekId));
            procReq.input("DOGUM_TARIHI", sql.DateTime, safeDate(dto.dogumTarihi));
            procReq.input("DOGUM_YERI", sql.VarChar(100), cleanDogumYeri);
            procReq.input("KIMLIK_SERI_NO", sql.VarChar(20), cleanKimlikSeriNo);
            procReq.input("ANNE_ADI", sql.VarChar(200), cleanAnne);
            procReq.input("IPTAL", sql.Bit, dto.iptal ? 1 : 0);
            procReq.input("IPTAL_TARIHI", sql.DateTime, safeDate(dto.iptalTarihi));
            procReq.input("MASAK_LISTESINDE_VAR", sql.Bit, dto.masakListesindeVar ? 1 : 0);
            procReq.input("SUPHELI_ISLEMLER_YETKILI_ID", sql.Int, toValidId(dto.supheliIslemlerYetkiliId));
            procReq.input("YUVARLAMA_ARALIGI", sql.Float, dto.yuvarlamaAraligi || 0);
            procReq.input("YUVARLAMA_ESIGI", sql.Float, dto.yuvarlamaEsigi || 0);
            procReq.input("E_FATURA_POSTA_KUTUSU", sql.VarChar(200), cleanPostaKutusu);
            procReq.input("BELGE_TURU", sql.TinyInt, dto.belgeTuru || 0);
            procReq.input("KIMLIK_GECERLILIK_TARIHI", sql.DateTime, safeDate(dto.kimlikGecerlilikTarihi));
            procReq.input("KIMLIK_BELGE_TURU", sql.TinyInt, dto.kimlikBelgeTuru || 0);
            procReq.input("SIRKET_TURU", sql.TinyInt, dto.sirketTuru || 0);
            procReq.input("DERNEK_AMACI", sql.VarChar(200), cleanDernekAmaci);
            procReq.input("YETKILI_KISI_ID", sql.Int, toValidId(dto.yetkiliKisiId));
            procReq.input("CLEAN_YETKILI_KISI", sql.VarChar(100), (dto.yetkiliKisi || "").trim().slice(0, 100) || null);
            procReq.input("CLEAN_KIMLIK_KAYNAGI", sql.VarChar(100), (dto.kimlikKaynagi || "").trim().slice(0, 100) || null);
            procReq.input("CLEAN_DERNEK_AMACI", sql.VarChar(100), cleanDernekAmaci);
            procReq.input("SIRKET_TURU_VAL", sql.TinyInt, (dto.sirketTuru !== undefined && dto.sirketTuru !== null) ? Number(dto.sirketTuru) : null);
            procReq.input("CLEAN_POSTA_KODU", sql.VarChar(20), (dto.postaKodu || "").trim().slice(0, 20) || null);
            procReq.input("CLEAN_ILCE", sql.VarChar(100), (dto.ilce || "").trim().slice(0, 100) || null);
            procReq.input("CLEAN_IL", sql.VarChar(100), (dto.il || "").trim().slice(0, 100) || null);
            procReq.input("KULLANICI_ID", sql.Int, kullaniciId);
            procReq.input("YAZICI_ID", sql.Int, toValidId(dto.yaziciId));
            procReq.input("GUID_STR", sql.VarChar(40), guid.slice(0, 40));
            procReq.input("DEGISIKLIK_TAKIP_VAR", sql.Bit, dto.degisiklikTakipVar ? 1 : 0);
            // Row Parameter definitions
            const rowValuesSql = [];
            items.forEach((item, idx) => {
                const m = item.miktar;
                const k = item.kur;
                const tutar = item.tutar;
                const satirSeri = (item.seriNo || seriNo || "").slice(0, 20);
                const satirBelge = (item.belgeNo || belgeNo || "").slice(0, 50);
                rowValuesSql.push(`(
          @GUID_STR,
          ${idx},
          ${m},
          ${item.paraId},
          ${k},
          ${item.iscilik},
          ${item.giseKuru},
          ${tutar},
          ${item.komisyonOrani},
          ${item.komisyon},
          ${item.bmvOrani},
          ${item.bmv},
          ${item.kmvOrani},
          ${item.kmv},
          ${item.kdvOrani},
          ${item.kdv},
          ${item.bankaHesabiId ? Number(item.bankaHesabiId) : "NULL"},
          ${satirSeri ? `'${satirSeri.replace(/'/g, "''")}'` : "NULL"},
          ${satirBelge ? `'${satirBelge.replace(/'/g, "''")}'` : "NULL"}
        )`);
            });
            // Combined SQL Script Execution: Temporary Table + Dynamic Foreign Key Validation + Stored Procedure Call
            const batchQuery = `
        SET NOCOUNT ON;

        IF OBJECT_ID('tempdb..#TODVZ_ISKELE_FIS_SATIRI') IS NOT NULL
          DROP TABLE #TODVZ_ISKELE_FIS_SATIRI;

        CREATE TABLE #TODVZ_ISKELE_FIS_SATIRI (
          [GUID] VARCHAR(50) COLLATE database_default NOT NULL,
          [SATIR_NO] INT NOT NULL,
          [MIKTAR] DECIMAL(18,4) NOT NULL,
          [PARA_ID] INT NOT NULL,
          [KUR] DECIMAL(18,6) NOT NULL,
          [ISCILIK] DECIMAL(18,4) NOT NULL DEFAULT(0),
          [GISE_KURU] DECIMAL(18,6) NOT NULL DEFAULT(1),
          [TUTAR] DECIMAL(18,4) NOT NULL,
          [KOMISYON_ORANI] DECIMAL(18,4) NOT NULL DEFAULT(0),
          [KOMISYON] DECIMAL(18,4) NOT NULL DEFAULT(0),
          [BMV_ORANI] DECIMAL(18,4) NOT NULL DEFAULT(0),
          [BMV] DECIMAL(18,4) NOT NULL DEFAULT(0),
          [KMV_ORANI] DECIMAL(18,4) NOT NULL DEFAULT(0),
          [KMV] DECIMAL(18,4) NOT NULL DEFAULT(0),
          [KDV_ORANI] DECIMAL(18,4) NOT NULL DEFAULT(0),
          [KDV] DECIMAL(18,4) NOT NULL DEFAULT(0),
          [BANKA_HESABI_ID] INT NULL,
          [SERI_NO] VARCHAR(20) COLLATE database_default NULL,
          [BELGE_NO] VARCHAR(50) COLLATE database_default NULL,
          [ETTN] UNIQUEIDENTIFIER NULL,
          [E_BELGE_DURUMU] TINYINT NULL DEFAULT(0),
          [E_BELGE_HATA_ACIKLAMASI] VARCHAR(250) COLLATE database_default NULL
        );

        INSERT INTO #TODVZ_ISKELE_FIS_SATIRI (
          [GUID], [SATIR_NO], [MIKTAR], [PARA_ID], [KUR], [ISCILIK], [GISE_KURU], [TUTAR],
          [KOMISYON_ORANI], [KOMISYON], [BMV_ORANI], [BMV], [KMV_ORANI], [KMV], [KDV_ORANI], [KDV],
          [BANKA_HESABI_ID], [SERI_NO], [BELGE_NO]
        ) VALUES ${rowValuesSql.join(",\n")};

        DECLARE @P_FIS_ID INT = @FIS_ID_IN;
        DECLARE @P_SERI_NO VARCHAR(20) = @SERI_NO_IN;
        DECLARE @P_BELGE_NO VARCHAR(20) = @BELGE_NO_IN;
        DECLARE @P_YENI_KAYIT BIT = 0;
        DECLARE @P_GUID VARCHAR(40) = @GUID_STR;

        -- 1. Cari Kart Doğrulama (Seçili cari yoksa veya geçersizse NULL yapılır)
        DECLARE @EFF_CARI_KART_ID INT = CASE WHEN @CARI_KART_ID > 0 THEN @CARI_KART_ID ELSE NULL END;
        IF @EFF_CARI_KART_ID IS NOT NULL
        BEGIN
          IF OBJECT_ID('TODVZ_CARI_KART') IS NOT NULL
          BEGIN
            IF NOT EXISTS (SELECT 1 FROM TODVZ_CARI_KART WHERE CARI_KART_ID = @EFF_CARI_KART_ID)
              SET @EFF_CARI_KART_ID = NULL;
          END
          ELSE SET @EFF_CARI_KART_ID = NULL;
        END

        -- 2. İstatistik Tanımı Doğrulama
        DECLARE @EFF_ISTATISTIK_ID INT = CASE WHEN @ISTATISTIK_ID > 0 THEN @ISTATISTIK_ID ELSE NULL END;
        IF OBJECT_ID('TODVZ_ISTATISTIK') IS NOT NULL
        BEGIN
          IF @EFF_ISTATISTIK_ID IS NOT NULL AND NOT EXISTS (SELECT 1 FROM TODVZ_ISTATISTIK WHERE ISTATISTIK_ID = @EFF_ISTATISTIK_ID)
            SET @EFF_ISTATISTIK_ID = NULL;

          IF @EFF_ISTATISTIK_ID IS NULL
          BEGIN
            SELECT TOP 1 @EFF_ISTATISTIK_ID = ISTATISTIK_ID
            FROM TODVZ_ISTATISTIK
            ORDER BY CASE WHEN KOD IN ('10285', '9249') THEN 0 ELSE 1 END, ISTATISTIK_ID ASC;

            IF @EFF_ISTATISTIK_ID IS NULL
              SELECT TOP 1 @EFF_ISTATISTIK_ID = ISTATISTIK_ID FROM TODVZ_ISTATISTIK ORDER BY ISTATISTIK_ID ASC;
          END
        END

        -- 3. Vezne Doğrulama (Aktif vezne veya kullanıcının veznesi)
        DECLARE @EFF_VEZNE_ID INT = CASE WHEN @VEZNE_ID > 0 THEN @VEZNE_ID ELSE NULL END;
        IF OBJECT_ID('TODVZ_VEZNE') IS NOT NULL
        BEGIN
          IF @EFF_VEZNE_ID IS NULL OR NOT EXISTS (SELECT 1 FROM TODVZ_VEZNE WHERE VEZNE_ID = @EFF_VEZNE_ID)
          BEGIN
            SELECT TOP 1 @EFF_VEZNE_ID = VEZNE_ID FROM TODVZ_VEZNE ORDER BY VEZNE_ID ASC;
          END
        END
        IF @EFF_VEZNE_ID IS NULL SET @EFF_VEZNE_ID = 1;

        -- 4. Kullanıcı Doğrulama
        DECLARE @EFF_KULLANICI_ID INT = CASE WHEN @KULLANICI_ID > 0 THEN @KULLANICI_ID ELSE NULL END;
        IF OBJECT_ID('TODVZ_KULLANICI') IS NOT NULL
        BEGIN
          IF @EFF_KULLANICI_ID IS NULL OR NOT EXISTS (SELECT 1 FROM TODVZ_KULLANICI WHERE KULLANICI_ID = @EFF_KULLANICI_ID)
          BEGIN
            SELECT TOP 1 @EFF_KULLANICI_ID = KULLANICI_ID FROM TODVZ_KULLANICI ORDER BY KULLANICI_ID ASC;
          END
        END
        IF @EFF_KULLANICI_ID IS NULL SET @EFF_KULLANICI_ID = 1;

        -- 5. Ülke & Uyruk (TODVZ_ULKE)
        DECLARE @EFF_ULKE_ID INT = CASE WHEN @ULKE_ID > 0 THEN @ULKE_ID ELSE NULL END;
        IF @EFF_ULKE_ID IS NOT NULL
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM TODVZ_ULKE WHERE ULKE_ID = @EFF_ULKE_ID) SET @EFF_ULKE_ID = NULL;
        END

        DECLARE @EFF_UYRUK_ID INT = CASE WHEN @UYRUK_ID > 0 THEN @UYRUK_ID ELSE NULL END;
        IF @EFF_UYRUK_ID IS NOT NULL
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM TODVZ_ULKE WHERE ULKE_ID = @EFF_UYRUK_ID) SET @EFF_UYRUK_ID = NULL;
        END

        -- 6. İl & İlçe & Posta Kodu (TODVZ_TABLO_MADDESI)
        DECLARE @EFF_IL_ID INT = CASE WHEN @IL_ID > 0 THEN @IL_ID ELSE NULL END;
        IF @EFF_IL_ID IS NOT NULL
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM TODVZ_TABLO_MADDESI WHERE TABLO_MADDESI_ID = @EFF_IL_ID) SET @EFF_IL_ID = NULL;
        END

        DECLARE @EFF_ILCE_ID INT = CASE WHEN @ILCE_ID > 0 THEN @ILCE_ID ELSE NULL END;
        IF @EFF_ILCE_ID IS NOT NULL
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM TODVZ_TABLO_MADDESI WHERE TABLO_MADDESI_ID = @EFF_ILCE_ID) SET @EFF_ILCE_ID = NULL;
        END

        DECLARE @EFF_POSTA_KODU_ID INT = CASE WHEN @POSTA_KODU_ID > 0 THEN @POSTA_KODU_ID ELSE NULL END;
        IF @EFF_POSTA_KODU_ID IS NOT NULL
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM TODVZ_TABLO_MADDESI WHERE TABLO_MADDESI_ID = @EFF_POSTA_KODU_ID) SET @EFF_POSTA_KODU_ID = NULL;
        END

        -- 7. Vergi Dairesi & Hukuki Yapı & Meslek (TODVZ_TABLO_MADDESI)
        DECLARE @EFF_VERGI_DAIRESI_ID INT = CASE WHEN @VERGI_DAIRESI_ID > 0 THEN @VERGI_DAIRESI_ID ELSE NULL END;
        IF @EFF_VERGI_DAIRESI_ID IS NOT NULL
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM TODVZ_TABLO_MADDESI WHERE TABLO_MADDESI_ID = @EFF_VERGI_DAIRESI_ID) SET @EFF_VERGI_DAIRESI_ID = NULL;
        END

        DECLARE @EFF_HUKUKI_YAPI_ID INT = CASE WHEN @HUKUKI_YAPI_ID > 0 THEN @HUKUKI_YAPI_ID ELSE NULL END;
        IF @EFF_HUKUKI_YAPI_ID IS NOT NULL
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM TODVZ_TABLO_MADDESI WHERE TABLO_MADDESI_ID = @EFF_HUKUKI_YAPI_ID) SET @EFF_HUKUKI_YAPI_ID = NULL;
        END

        DECLARE @EFF_MESLEK_ID INT = CASE WHEN @MESLEK_ID > 0 THEN @MESLEK_ID ELSE NULL END;
        IF @EFF_MESLEK_ID IS NOT NULL
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM TODVZ_TABLO_MADDESI WHERE TABLO_MADDESI_ID = @EFF_MESLEK_ID) SET @EFF_MESLEK_ID = NULL;
        END

        -- 8. Banka Hesabı Doğrulama (TODVZ_CARI_KART)
        DECLARE @EFF_BANKA_HESABI_ID INT = CASE WHEN @BANKA_HESABI_ID > 0 THEN @BANKA_HESABI_ID ELSE NULL END;
        IF @EFF_BANKA_HESABI_ID IS NOT NULL
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM TODVZ_CARI_KART WHERE CARI_KART_ID = @EFF_BANKA_HESABI_ID) SET @EFF_BANKA_HESABI_ID = NULL;
        END

        -- 9. Arbitraj & Şüpheli & Yazıcı
        DECLARE @EFF_ARBITRAJ_ID INT = CASE WHEN @ARBITRAJ_ID > 0 THEN @ARBITRAJ_ID ELSE NULL END;
        IF @EFF_ARBITRAJ_ID IS NOT NULL
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM TODVZ_FIS WHERE FIS_ID = @EFF_ARBITRAJ_ID) SET @EFF_ARBITRAJ_ID = NULL;
        END

        DECLARE @EFF_SUPHELI_ID INT = CASE WHEN @SUPHELI_ISLEMLER_YETKILI_ID > 0 THEN @SUPHELI_ISLEMLER_YETKILI_ID ELSE NULL END;
        IF @EFF_SUPHELI_ID IS NOT NULL
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM TODVZ_KULLANICI WHERE KULLANICI_ID = @EFF_SUPHELI_ID) SET @EFF_SUPHELI_ID = NULL;
        END

        DECLARE @EFF_YAZICI_ID INT = CASE WHEN @YAZICI_ID > 0 THEN @YAZICI_ID ELSE NULL END;

        -- 10. TL (PARA_ID = 1) Varlık Kontrolü (Vezne bakiyesi için zorunlu)
        IF OBJECT_ID('TODVZ_PARA') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM TODVZ_PARA WHERE PARA_ID = 1)
        BEGIN
          BEGIN TRY
            SET IDENTITY_INSERT TODVZ_PARA ON;
            INSERT INTO TODVZ_PARA (PARA_ID, KOD, AD) VALUES (1, 'TL', 'TURK LIRASI');
            SET IDENTITY_INSERT TODVZ_PARA OFF;
          END TRY
          BEGIN CATCH
            BEGIN TRY
              INSERT INTO TODVZ_PARA (KOD, AD) VALUES ('TL', 'TURK LIRASI');
            END TRY
            BEGIN CATCH
            END CATCH
          END CATCH
        END

        -- 11. Vezne Bakiye TL Kaydı Kontrolü
        IF OBJECT_ID('TODVZ_VEZNE_BAKIYE') IS NOT NULL AND @EFF_VEZNE_ID IS NOT NULL
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM TODVZ_VEZNE_BAKIYE WHERE VEZNE_ID = @EFF_VEZNE_ID AND PARA_ID = 1)
          BEGIN
            BEGIN TRY
              INSERT INTO TODVZ_VEZNE_BAKIYE (VEZNE_ID, PARA_ID, MIKTAR) VALUES (@EFF_VEZNE_ID, 1, 0);
            END TRY
            BEGIN CATCH
            END CATCH
          END
        END

        -- 12. Seri No / Belge No Mükerrerlik Emniyeti
        IF @P_SERI_NO IS NOT NULL AND LEN(@P_SERI_NO) > 0
        BEGIN
          IF EXISTS (SELECT 1 FROM TODVZ_FIS WHERE SERI_NO = @P_SERI_NO AND (@P_FIS_ID IS NULL OR FIS_ID <> @P_FIS_ID))
          BEGIN
            SET @P_SERI_NO = NULL;
          END
        END

        IF @P_BELGE_NO IS NOT NULL AND LEN(@P_BELGE_NO) > 0
        BEGIN
          IF EXISTS (SELECT 1 FROM TODVZ_FIS WHERE BELGE_NO = @P_BELGE_NO AND (@P_FIS_ID IS NULL OR FIS_ID <> @P_FIS_ID))
          BEGIN
            SET @P_BELGE_NO = NULL;
          END
        END

        -- 13. Geçici Tablodaki Satırların Para ID ve Banka ID Kontrolü
        IF OBJECT_ID('TODVZ_PARA') IS NOT NULL
        BEGIN
          DECLARE @DEFAULT_PARA_ID INT;
          SELECT TOP 1 @DEFAULT_PARA_ID = PARA_ID FROM TODVZ_PARA ORDER BY PARA_ID ASC;

          UPDATE #TODVZ_ISKELE_FIS_SATIRI
          SET PARA_ID = @DEFAULT_PARA_ID
          WHERE NOT EXISTS (SELECT 1 FROM TODVZ_PARA P WHERE P.PARA_ID = #TODVZ_ISKELE_FIS_SATIRI.PARA_ID);
        END

        IF OBJECT_ID('TODVZ_CARI_KART') IS NOT NULL
        BEGIN
          UPDATE #TODVZ_ISKELE_FIS_SATIRI
          SET BANKA_HESABI_ID = NULL
          WHERE BANKA_HESABI_ID IS NOT NULL AND NOT EXISTS (SELECT 1 FROM TODVZ_CARI_KART WHERE CARI_KART_ID = #TODVZ_ISKELE_FIS_SATIRI.BANKA_HESABI_ID);
        END

        EXEC [dbo].[SODVZ_FIS_KAYDET]
          @FIS_ID = @P_FIS_ID OUTPUT,
          @VEZNE_ID = @EFF_VEZNE_ID,
          @TIP = @TIP,
          @TARIH = @TARIH,
          @ZAMAN = @ZAMAN,
          @SERI_NO = @P_SERI_NO OUTPUT,
          @BELGE_NO = @P_BELGE_NO OUTPUT,
          @GELIS_NEDENI = @GELIS_NEDENI,
          @KUR_TURU = @KUR_TURU,
          @ISTATISTIK_ID = @EFF_ISTATISTIK_ID,
          @CARI_KART_ID = @EFF_CARI_KART_ID,
          @UNVAN = @UNVAN,
          @KISILIK_TIPI = @KISILIK_TIPI,
          @UYRUK_ID = @EFF_UYRUK_ID,
          @ULKE_ID = @EFF_ULKE_ID,
          @PASAPORT_NO = @PASAPORT_NO,
          @HUKUKI_YAPI_ID = @EFF_HUKUKI_YAPI_ID,
          @VERGI_DAIRESI_ID = @EFF_VERGI_DAIRESI_ID,
          @VERGI_KIMLIK_NO = @VERGI_KIMLIK_NO,
          @BABA_ADI = @BABA_ADI,
          @ADRES = @ADRES,
          @ILCE_ID = @EFF_ILCE_ID,
          @POSTA_KODU_ID = @EFF_POSTA_KODU_ID,
          @IL_ID = @EFF_IL_ID,
          @VEKIL_TURU = @VEKIL_TURU,
          @VEKIL_KISILIK_TIPI = @VEKIL_KISILIK_TIPI,
          @VEKIL_ADI = @VEKIL_ADI,
          @VEKIL_KIMLIK_NO = @VEKIL_KIMLIK_NO,
          @TOPLAM_TUTAR = @TOPLAM_TUTAR,
          @YUVARLAMA = @YUVARLAMA,
          @ODEME_TUTARI = @ODEME_TUTARI,
          @BANKA_HESABI_ID = @EFF_BANKA_HESABI_ID,
          @KMV_UYGULAMA_SEKLI = @KMV_UYGULAMA_SEKLI,
          @EPOSTA = @EPOSTA,
          @MERKEZ_USD_KURU = @MERKEZ_USD_KURU,
          @GISE_USD_KURU = @GISE_USD_KURU,
          @GM_BEYANNAME_TARIH = @GM_BEYANNAME_TARIH,
          @GM_BEYANNAME_NO = @GM_BEYANNAME_NO,
          @GM_DOVIZ_TARIH = @GM_DOVIZ_TARIH,
          @GM_DOVIZ_SAYI = @GM_DOVIZ_SAYI,
          @GM_TEYIT_TARIH = @GM_TEYIT_TARIH,
          @GM_TEYIT_SAYI = @GM_TEYIT_SAYI,
          @GM_FATURA_NO = @GM_FATURA_NO,
          @ARBITRAJ_ID = @EFF_ARBITRAJ_ID,
          @TELEFON_NO = @TELEFON_NO,
          @MESLEK_ID = @EFF_MESLEK_ID,
          @DOGUM_TARIHI = @DOGUM_TARIHI,
          @DOGUM_YERI = @DOGUM_YERI,
          @KIMLIK_SERI_NO = @KIMLIK_SERI_NO,
          @ANNE_ADI = @ANNE_ADI,
          @IPTAL = @IPTAL,
          @IPTAL_TARIHI = @IPTAL_TARIHI,
          @MASAK_LISTESINDE_VAR = @MASAK_LISTESINDE_VAR,
          @SUPHELI_ISLEMLER_YETKILI_ID = @EFF_SUPHELI_ID,
          @YUVARLAMA_ARALIGI = @YUVARLAMA_ARALIGI,
          @YUVARLAMA_ESIGI = @YUVARLAMA_ESIGI,
          @E_FATURA_POSTA_KUTUSU = @E_FATURA_POSTA_KUTUSU,
          @BELGE_TURU = @BELGE_TURU,
          @KIMLIK_GECERLILIK_TARIHI = @KIMLIK_GECERLILIK_TARIHI,
          @KIMLIK_BELGE_TURU = @KIMLIK_BELGE_TURU,
          @KULLANICI_ID = @EFF_KULLANICI_ID,
          @YAZICI_ID = @EFF_YAZICI_ID,
          @GUID = @P_GUID,
          @DEGISIKLIK_TAKIP_VAR = @DEGISIKLIK_TAKIP_VAR,
          @YENI_KAYIT = @P_YENI_KAYIT OUTPUT;

        IF @P_FIS_ID IS NOT NULL AND @P_FIS_ID > 0
        BEGIN
          UPDATE [dbo].[TODVZ_FIS]
          SET 
            DERNEK_AMACI = COALESCE(@CLEAN_DERNEK_AMACI, DERNEK_AMACI),
            SIRKET_TURU = COALESCE(@SIRKET_TURU_VAL, SIRKET_TURU),
            YETKILI_KISI_ID = COALESCE(@YETKILI_KISI_ID, YETKILI_KISI_ID),
            YETKILI_KISI = COALESCE(@CLEAN_YETKILI_KISI, YETKILI_KISI),
            KIMLIK_KAYNAGI = COALESCE(@CLEAN_KIMLIK_KAYNAGI, KIMLIK_KAYNAGI),
            POSTA_KODU = COALESCE(@CLEAN_POSTA_KODU, POSTA_KODU),
            ILCE = COALESCE(@CLEAN_ILCE, ILCE),
            IL = COALESCE(@CLEAN_IL, IL),
            GM_BEYANNAME_NO = @GM_BEYANNAME_NO,
            GM_BEYANNAME_TARIH = @GM_BEYANNAME_TARIH,
            GM_DOVIZ_SAYI = @GM_DOVIZ_SAYI,
            GM_DOVIZ_TARIH = @GM_DOVIZ_TARIH,
            GM_TEYIT_SAYI = @GM_TEYIT_SAYI,
            GM_TEYIT_TARIH = @GM_TEYIT_TARIH,
            GM_FATURA_NO = @GM_FATURA_NO,
            TIP = @TIP
          WHERE FIS_ID = @P_FIS_ID;
        END

        IF OBJECT_ID('tempdb..#TODVZ_ISKELE_FIS_SATIRI') IS NOT NULL
          DROP TABLE #TODVZ_ISKELE_FIS_SATIRI;

        SELECT @P_FIS_ID AS OUT_FIS_ID, @P_SERI_NO AS OUT_SERI_NO, @P_BELGE_NO AS OUT_BELGE_NO, @P_YENI_KAYIT AS OUT_YENI_KAYIT;
      `;
            const procResult = await procReq.query(batchQuery);
            const outRecord = procResult.recordset?.[0];
            savedFisId = outRecord?.OUT_FIS_ID || targetFisId || 0;
            if (outRecord?.OUT_SERI_NO)
                seriNo = outRecord.OUT_SERI_NO;
            if (outRecord?.OUT_BELGE_NO)
                belgeNo = outRecord.OUT_BELGE_NO;
            // If savedFisId is still 0, try to resolve by GUID or Vezne
            if (!savedFisId || savedFisId <= 0) {
                const resolveReq = pool.request();
                resolveReq.input("G_VAL", sql.UniqueIdentifier, guid);
                const resolveRes = await resolveReq.query(`
            SELECT TOP 1 FIS_ID FROM [dbo].[TODVZ_FIS] WITH (NOLOCK) WHERE [GUID] = @G_VAL ORDER BY FIS_ID DESC
          `);
                if (resolveRes.recordset?.length > 0) {
                    savedFisId = Number(resolveRes.recordset[0].FIS_ID);
                }
            }
            if (savedFisId && savedFisId > 0) {
                try {
                    const updReq = pool.request();
                    updReq.input("UPD_ID", sql.Int, savedFisId);
                    updReq.input("U_DERNEK", sql.VarChar(100), (dto.dernekAmaci || "").trim().slice(0, 100) || null);
                    updReq.input("U_YETKILI", sql.VarChar(100), (dto.yetkiliKisi || "").trim().slice(0, 100) || null);
                    updReq.input("U_YETKILI_ID", sql.Int, toValidId(dto.yetkiliKisiId));
                    updReq.input("U_KAYNAK", sql.VarChar(100), (dto.kimlikKaynagi || "").trim().slice(0, 100) || null);
                    updReq.input("U_SIRKET_TURU", sql.TinyInt, (dto.sirketTuru !== undefined && dto.sirketTuru !== null) ? Number(dto.sirketTuru) : null);
                    updReq.input("U_POSTA_KODU", sql.VarChar(20), (dto.postaKodu || "").trim().slice(0, 20) || null);
                    updReq.input("U_ILCE", sql.VarChar(100), (dto.ilce || "").trim().slice(0, 100) || null);
                    updReq.input("U_IL", sql.VarChar(100), (dto.il || "").trim().slice(0, 100) || null);
                    updReq.input("U_GM_NO", sql.VarChar(30), (dto.gmBeyannameNo || "").trim().slice(0, 30) || null);
                    updReq.input("U_GM_TARIH", sql.DateTime, safeDate(dto.gmBeyannameTarih));
                    updReq.input("U_GM_DVZ_SAYI", sql.VarChar(30), (dto.gmDovizSayi || "").trim().slice(0, 30) || null);
                    updReq.input("U_GM_DVZ_TARIH", sql.DateTime, safeDate(dto.gmDovizTarih));
                    updReq.input("U_GM_TYT_SAYI", sql.VarChar(30), (dto.gmTeyitSayi || "").trim().slice(0, 30) || null);
                    updReq.input("U_GM_TYT_TARIH", sql.DateTime, safeDate(dto.gmTeyitTarih));
                    updReq.input("U_GM_FATURA", sql.VarChar(30), (dto.gmFaturaNo || "").trim().slice(0, 30) || null);
                    updReq.input("U_TIP", sql.TinyInt, tip);
                    await updReq.query(`
              UPDATE [dbo].[TODVZ_FIS]
              SET 
                DERNEK_AMACI = COALESCE(@U_DERNEK, DERNEK_AMACI),
                SIRKET_TURU = COALESCE(@U_SIRKET_TURU, SIRKET_TURU),
                YETKILI_KISI_ID = COALESCE(@U_YETKILI_ID, YETKILI_KISI_ID),
                YETKILI_KISI = COALESCE(@U_YETKILI, YETKILI_KISI),
                KIMLIK_KAYNAGI = COALESCE(@U_KAYNAK, KIMLIK_KAYNAGI),
                POSTA_KODU = COALESCE(@U_POSTA_KODU, POSTA_KODU),
                ILCE = COALESCE(@U_ILCE, ILCE),
                IL = COALESCE(@U_IL, IL),
                GM_BEYANNAME_NO = @U_GM_NO,
                GM_BEYANNAME_TARIH = @U_GM_TARIH,
                GM_DOVIZ_SAYI = @U_GM_DVZ_SAYI,
                GM_DOVIZ_TARIH = @U_GM_DVZ_TARIH,
                GM_TEYIT_SAYI = @U_GM_TYT_SAYI,
                GM_TEYIT_TARIH = @U_GM_TYT_TARIH,
                GM_FATURA_NO = @U_GM_FATURA,
                TIP = @U_TIP
              WHERE FIS_ID = @UPD_ID
            `);
                }
                catch (updErr) {
                    logger.warn("TODVZ_FIS supplementary update warning:", updErr);
                }
            }
        }
        catch (err) {
            const precedingMsgs = Array.isArray(err?.precedingErrors)
                ? err.precedingErrors.map((p) => p?.message).filter(Boolean).join(" | ")
                : "";
            const rawMsg = [err?.message, err?.originalError?.message, precedingMsgs, String(err)].filter(Boolean).join(" - ");
            logger.error("SODVZ_FIS_KAYDET execution error details:", {
                message: err?.message,
                precedingMsgs,
                original: err?.originalError?.message,
                rawMsg,
            });
            let userFriendlyMsg = err?.message || "Fiş kaydedilemedi.";
            if (precedingMsgs.includes("FOREIGN KEY") || rawMsg.includes("FOREIGN KEY")) {
                logger.error("SODVZ_FIS_KAYDET foreign key constraint violation details:", { rawMsg, precedingMsgs });
                if (rawMsg.includes("CARI_KART") || rawMsg.includes("BORCLU") || rawMsg.includes("ALACAKLI")) {
                    userFriendlyMsg = "Seçilen cari kart sistemde bulunamadı. Lütfen geçerli bir cari kart seçiniz veya boş bırakınız.";
                }
                else if (rawMsg.includes("VEZNE")) {
                    userFriendlyMsg = "Seçilen vezne sistemde tanımlı değil veya bu vezneye yetkiniz bulunmuyor.";
                }
                else if (rawMsg.includes("PARA")) {
                    userFriendlyMsg = "Seçilen döviz cinsi sistemde tanımlı değil. Lütfen geçerli bir para birimi seçiniz.";
                }
                else if (rawMsg.includes("ULKE") || rawMsg.includes("UYRUK")) {
                    userFriendlyMsg = "Seçilen ülke veya uyruk tanımı sistemde bulunamadı.";
                }
                else {
                    userFriendlyMsg = `Veritabanı ilişkisel kural hatası: ${precedingMsgs || err?.message || rawMsg}`;
                }
            }
            else if (rawMsg.includes("Cannot insert the value NULL") || rawMsg.includes("zorunlu")) {
                userFriendlyMsg = "Fiş kaydedilirken doldurulması zorunlu alanlardan biri eksik bırakıldı. Lütfen zorunlu alanları (Vezne, Tarih, Miktar, Kur) kontrol ediniz.";
            }
            else if (rawMsg.includes("out-of-range") || rawMsg.includes("converting date")) {
                userFriendlyMsg = "Girilen tarih veya saat formatı geçersiz. Lütfen geçerli bir gün/ay/yıl giriniz.";
            }
            else if (rawMsg.includes("string or binary data would be truncated")) {
                userFriendlyMsg = "Girilen metin alanlarından biri (Seri No, Belge No, Ünvan veya Adres) izin verilen maksimum karakter sınırını aşıyor.";
            }
            else if (rawMsg.includes("Numeratör bitiş sayısını geçmiş")) {
                userFriendlyMsg = "Vezne numeratör serisi dolmuştur. Lütfen Numaratör Tanımları menüsünden yeni bir seri aralığı belirleyiniz.";
            }
            else if (rawMsg.includes("bu seri no daha önce kaydedilmiş")) {
                userFriendlyMsg = "Girilen Seri No sistemde zaten kayıtlıdır. Lütfen farklı bir Seri No giriniz veya boş bırakarak sistemin otomatik numara vermesini sağlayınız.";
            }
            else if (rawMsg.includes("Seri noyu boş geçemezsiniz")) {
                userFriendlyMsg = "Fiş Seri Numarası boş bırakılamaz. Lütfen geçerli bir seri no giriniz.";
            }
            else if (rawMsg.includes("Onaylanmış hesap dönemine")) {
                userFriendlyMsg = "Onaylanmış hesap dönemine ait fiş kaydı veya güncellemesi yapılamaz. Lütfen güncel döneme ait bir tarih giriniz.";
            }
            else if (rawMsg.includes("Cari bakiye sınırı aşıldı")) {
                userFriendlyMsg = "Seçilen cari hesabın risk veya bakiye limiti aşıldığı için işlem tamamlanamadı.";
            }
            else if (rawMsg.includes("GİB e gönderilen fişleri değiştiremezsiniz")) {
                userFriendlyMsg = "GİB e (Gelir İdaresi Başkanlığı) gönderilmiş e-döviz fişleri üzerinde değişiklik yapılamaz.";
            }
            else if (rawMsg.includes("Vergi kimlik") || rawMsg.includes("Kimlik no") || rawMsg.includes("VERGI_SINIR")) {
                userFriendlyMsg = "Yasal vergi ve kimlik sınırları gereği müşteri ünvanı, vergi kimlik / TC kimlik numarası ve adres bilgilerinin eksiksiz girilmesi gerekmektedir.";
            }
            else if (rawMsg.includes("Invalid object name '#TODVZ_ISKELE_FIS_SATIRI'") || rawMsg.includes("TODVZ_ISKELE_FIS_SATIRI")) {
                userFriendlyMsg = "Fiş satırları geçici tablosu oluşturulurken bir hata oluştu. Lütfen tekrar deneyiniz.";
            }
            else if (rawMsg.includes("60238")) {
                userFriendlyMsg = "Kayıt işlemi veritabanı kuralları gereği geri alındı. Lütfen vezne yetkinizi, seçilen carinin risk limitini ve hesap dönemini kontrol ediniz.";
            }
            else if (rawMsg.includes("Fiş kaydedilemedi")) {
                userFriendlyMsg = "Fiş kaydedilemedi. Lütfen vezne, işlem tarihi, döviz kurları ve cari kart bilgilerini kontrol ediniz.";
            }
            throw ApiError.badRequest(userFriendlyMsg);
        }
        const savedRecord = await DovizFisSqlRepository.findById(savedFisId, dbContext);
        if (!savedRecord) {
            throw ApiError.notFound("Kaydedilen döviz fişi bulunamadı.");
        }
        return savedRecord;
    }
    /**
     * Get single Döviz Fişi by ID with lines
     */
    static async findById(id, dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        const fisRes = await pool.request().input("ID", sql.Int, id).query(`
      SELECT 
        F.*,
        V.KOD AS VEZNE_KOD, V.AD AS VEZNE_AD,
        C.KOD AS CARI_KOD, C.AD AS CARI_AD
      FROM [dbo].[TODVZ_FIS] F
      LEFT JOIN [dbo].[TODVZ_VEZNE] V ON V.VEZNE_ID = F.VEZNE_ID
      LEFT JOIN [dbo].[TODVZ_CARI_KART] C ON C.CARI_KART_ID = F.CARI_KART_ID
      WHERE F.FIS_ID = @ID
    `);
        if (!fisRes.recordset || fisRes.recordset.length === 0) {
            return null;
        }
        const row = fisRes.recordset[0];
        const satirlarRes = await pool.request().input("FIS_ID", sql.Int, id).query(`
      SELECT 
        S.*,
        P.KOD AS PARA_KOD, P.AD AS PARA_AD, P.HAS_ORANI
      FROM [dbo].[TODVZ_FIS_SATIRI] S
      LEFT JOIN [dbo].[TODVZ_PARA] P ON P.PARA_ID = S.PARA_ID
      WHERE S.FIS_ID = @FIS_ID
      ORDER BY S.SATIR_NO ASC
    `);
        const satirlar = (satirlarRes.recordset || []).map((s) => ({
            satirNo: Number(s.SATIR_NO) || 1,
            paraId: Number(s.PARA_ID),
            paraKodu: (s.PARA_KOD || "").trim().toUpperCase(),
            paraAdi: (s.PARA_AD || "").trim(),
            miktar: Number(s.MIKTAR) || 0,
            kur: Number(s.KUR) || 1.0,
            iscilik: Number(s.ISCILIK) || 0,
            giseKuru: Number(s.GISE_KURU) || 1.0,
            tutar: Number(s.TUTAR) || 0,
            komisyonOrani: Number(s.KOMISYON_ORANI) || 0,
            komisyon: Number(s.KOMISYON) || 0,
            bmvOrani: Number(s.BMV_ORANI) || 0,
            bmv: Number(s.BMV) || 0,
            kmvOrani: Number(s.KMV_ORANI) || 0,
            kmv: Number(s.KMV) || 0,
            kdvOrani: Number(s.KDV_ORANI) || 0,
            kdv: Number(s.KDV) || 0,
            bankaHesabiId: s.BANKA_HESABI_ID || null,
            seriNo: s.SERI_NO || "",
            belgeNo: s.BELGE_NO || "",
        }));
        const tip = Number(row.TIP) || 0;
        const bsmvSum = satirlar.reduce((acc, cur) => acc + cur.bmv, 0);
        const formatDbDate = (d) => {
            if (!d)
                return null;
            const dt = new Date(d);
            if (isNaN(dt.getTime()))
                return null;
            const y = dt.getFullYear();
            if (y <= 1900 || y > 9999)
                return null;
            return dt.toISOString().split("T")[0];
        };
        return {
            fisId: Number(row.FIS_ID),
            vezneId: Number(row.VEZNE_ID) || 1,
            vezneKod: (row.VEZNE_KOD || "00").trim(),
            vezneAd: (row.VEZNE_AD || "Ana kasa").trim(),
            tip,
            tipLabel: tip === 1 ? "Satış" : "Alış",
            tarih: row.TARIH ? new Date(row.TARIH).toISOString().split("T")[0] : "",
            zaman: row.ZAMAN ? new Date(row.ZAMAN).toLocaleTimeString("tr-TR") : "",
            seriNo: (row.SERI_NO || "").trim(),
            belgeNo: (row.BELGE_NO || "").trim(),
            gelisNedeni: (row.GELIS_NEDENI || "32 SAYILI KARAR GEREĞİ").trim(),
            kurTuru: Number(row.KUR_TURU) || 0,
            kurTuruLabel: (Number(row.KUR_TURU) || 0) === 0 ? "Efektif" : "Döviz",
            istatistikId: row.ISTATISTIK_ID || null,
            cariKartId: row.CARI_KART_ID || null,
            cariKod: (row.CARI_KOD || "").trim(),
            unvan: (row.UNVAN || row.CARI_AD || "İsim beyan edilmemiştir").trim(),
            kisilikTipi: Number(row.KISILIK_TIPI) || 0,
            uyrukId: row.UYRUK_ID || null,
            ulkeId: row.ULKE_ID || null,
            pasaportNo: row.PASAPORT_NO || "",
            hukukiYapiId: row.HUKUKI_YAPI_ID || null,
            vergiDairesiId: row.VERGI_DAIRESI_ID || null,
            vergiKimlikNo: row.VERGI_KIMLIK_NO || "",
            babaAdi: row.BABA_ADI || "",
            adres: row.ADRES || "",
            ilceId: row.ILCE_ID || null,
            ilce: (row.ILCE || "").trim(),
            postaKoduId: row.POSTA_KODU_ID || null,
            postaKodu: (row.POSTA_KODU || (row.POSTA_KODU_ID ? String(row.POSTA_KODU_ID) : "")).trim(),
            ilId: row.IL_ID || null,
            il: (row.IL || "").trim(),
            vekilTuru: row.VEKIL_TURU ?? 0,
            vekilKisilikTipi: row.VEKIL_KISILIK_TIPI ?? 0,
            vekilAdi: row.VEKIL_ADI || "",
            vekilKimlikNo: row.VEKIL_KIMLIK_NO || "",
            bankaHesabiId: row.BANKA_HESABI_ID || null,
            kmvUygulamaSekli: row.KMV_UYGULAMA_SEKLI ?? 0,
            eposta: row.EPOSTA || "",
            merkezUsdKuru: Number(row.MERKEZ_USD_KURU) || 1.0,
            giseUsdKuru: Number(row.GISE_USD_KURU) || 1.0,
            gmBeyannameTarih: formatDbDate(row.GM_BEYANNAME_TARIH),
            gmBeyannameNo: row.GM_BEYANNAME_NO || "",
            gmDovizTarih: formatDbDate(row.GM_DOVIZ_TARIH),
            gmDovizSayi: row.GM_DOVIZ_SAYI || "",
            gmTeyitTarih: formatDbDate(row.GM_TEYIT_TARIH),
            gmTeyitSayi: row.GM_TEYIT_SAYI || "",
            gmFaturaNo: row.GM_FATURA_NO || "",
            arbitrajId: row.ARBITRAJ_ID || null,
            telefonNo: row.TELEFON_NO || "",
            meslekId: row.MESLEK_ID || null,
            dogumTarihi: formatDbDate(row.DOGUM_TARIHI),
            dogumYeri: row.DOGUM_YERI || "",
            kimlikSeriNo: row.KIMLIK_SERI_NO || "",
            anneAdi: row.ANNE_ADI || "",
            sirketTuru: row.SIRKET_TURU ?? null,
            dernekAmaci: row.DERNEK_AMACI || "",
            yetkiliKisi: row.YETKILI_KISI || "",
            yetkiliKisiId: row.YETKILI_KISI_ID || null,
            kimlikKaynagi: row.KIMLIK_KAYNAGI || "",
            kimlikGecerlilikTarihi: formatDbDate(row.KIMLIK_GECERLILIK_TARIHI),
            kimlikBelgeTuru: row.KIMLIK_BELGE_TURU ?? 0,
            toplamTutar: Number(row.TOPLAM_TUTAR) || 0,
            yuvarlama: Number(row.YUVARLAMA) || 0,
            odemeTutari: Number(row.ODEME_TUTARI) || 0,
            bsmvTutar: bsmvSum,
            iptal: Boolean(row.IPTAL),
            iptalTarihi: row.IPTAL_TARIHI ? new Date(row.IPTAL_TARIHI).toISOString() : null,
            ekleyenId: Number(row.EKLEYEN_ID) || 1,
            eklemeZamani: row.EKLEME_ZAMANI ? new Date(row.EKLEME_ZAMANI).toISOString() : "",
            guncelleyenId: Number(row.GUNCELLEYEN_ID) || 1,
            guncellemeZamani: row.GUNCELLEME_ZAMANI ? new Date(row.GUNCELLEME_ZAMANI).toISOString() : "",
            satirlar,
        };
    }
    /**
     * Find all Döviz Fişi with search / filter
     */
    static async findAll(filter, dbContext) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        await DovizFisSqlRepository.ensureTablesAndProceduresExist(pool);
        const limit = filter?.limit || 100;
        const req = pool.request();
        let query = `
      SELECT TOP (${limit})
        F.FIS_ID AS fisId,
        F.TIP AS tip,
        CASE WHEN F.TIP = 1 THEN 'Satış' ELSE 'Alış' END AS tipLabel,
        F.TARIH AS tarih,
        F.SERI_NO AS seriNo,
        F.BELGE_NO AS belgeNo,
        F.UNVAN AS unvan,
        F.VERGI_KIMLIK_NO AS vergiKimlikNo,
        F.TOPLAM_TUTAR AS toplamTutar,
        F.ODEME_TUTARI AS odemeTutari,
        F.IPTAL AS iptal,
        V.KOD AS vezneKod,
        V.AD AS vezneAd,
        (SELECT COUNT(*) FROM [dbo].[TODVZ_FIS_SATIRI] S WHERE S.FIS_ID = F.FIS_ID) AS satirSayisi
      FROM [dbo].[TODVZ_FIS] F
      LEFT JOIN [dbo].[TODVZ_VEZNE] V ON V.VEZNE_ID = F.VEZNE_ID
      WHERE 1 = 1
    `;
        if (filter?.tip !== undefined && !isNaN(filter.tip)) {
            query += ` AND F.TIP = @TIP`;
            req.input("TIP", sql.TinyInt, filter.tip);
        }
        if (filter?.vezneId) {
            query += ` AND F.VEZNE_ID = @VEZNE_ID`;
            req.input("VEZNE_ID", sql.Int, filter.vezneId);
        }
        if (filter?.search) {
            const term = `%${filter.search.trim()}%`;
            query += ` AND (F.SERI_NO LIKE @SEARCH OR F.BELGE_NO LIKE @SEARCH OR F.UNVAN LIKE @SEARCH OR F.VERGI_KIMLIK_NO LIKE @SEARCH)`;
            req.input("SEARCH", sql.VarChar(100), term);
        }
        query += ` ORDER BY F.FIS_ID DESC`;
        const result = await req.query(query);
        return result.recordset || [];
    }
    /**
     * Delete or Cancel Döviz Fişi via Stored Procedure SODVZ_FIS_SIL
     */
    static async deleteFis(id, dbContext, kullaniciId = 1) {
        const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
        try {
            const procCheck = await pool.request().query(`
        SELECT 1 FROM sys.procedures WHERE name = 'SODVZ_FIS_SIL'
      `);
            if (procCheck.recordset?.length > 0) {
                const req = pool.request();
                req.input("FIS_ID", sql.Int, id);
                req.input("KULLANICI_ID", sql.Int, kullaniciId || 1);
                req.input("DEGISIKLIK_TAKIP_VAR", sql.Bit, 1);
                req.input("IPTAL_ET", sql.Bit, 0);
                await req.query(`
          EXEC [dbo].[SODVZ_FIS_SIL]
            @FIS_ID = @FIS_ID,
            @KULLANICI_ID = @KULLANICI_ID,
            @DEGISIKLIK_TAKIP_VAR = @DEGISIKLIK_TAKIP_VAR,
            @IPTAL_ET = @IPTAL_ET;
        `);
                return true;
            }
        }
        catch (procErr) {
            const msg = procErr?.originalError?.message || procErr?.message || String(procErr);
            logger.error("SODVZ_FIS_SIL error:", procErr);
            throw ApiError.badRequest(msg);
        }
        await pool.request().input("ID", sql.Int, id).query(`
      DELETE FROM [dbo].[TODVZ_FIS_SATIRI] WHERE FIS_ID = @ID;
      DELETE FROM [dbo].[TODVZ_FIS] WHERE FIS_ID = @ID;
    `);
        return true;
    }
    /**
     * Get Vezne Cash & Currency Balances dynamically
     */
    static async getVezneBakiye(vezneId, dbContext) {
        try {
            const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
            const tlRes = await pool
                .request()
                .input("VEZNE_ID", sql.Int, vezneId)
                .query(`
          SELECT 
            SUM(CASE WHEN F.TIP = 1 THEN ISNULL(F.ODEME_TUTARI, 0) WHEN F.TIP = 0 THEN -ISNULL(F.ODEME_TUTARI, 0) ELSE 0 END) AS TL_TOTAL
          FROM [dbo].[TODVZ_FIS] F
          WHERE F.VEZNE_ID = @VEZNE_ID AND (F.IPTAL = 0 OR F.IPTAL IS NULL);
        `);
            const currRes = await pool
                .request()
                .input("VEZNE_ID", sql.Int, vezneId)
                .query(`
          SELECT 
            UPPER(LTRIM(RTRIM(ISNULL(P.KOD, '')))) AS KOD,
            SUM(CASE WHEN F.TIP = 0 THEN ISNULL(S.MIKTAR, 0) WHEN F.TIP = 1 THEN -ISNULL(S.MIKTAR, 0) ELSE 0 END) AS MIKTAR
          FROM [dbo].[TODVZ_FIS_SATIRI] S
          INNER JOIN [dbo].[TODVZ_FIS] F ON S.FIS_ID = F.FIS_ID
          INNER JOIN [dbo].[TODVZ_PARA] P ON S.PARA_ID = P.PARA_ID
          WHERE F.VEZNE_ID = @VEZNE_ID AND (F.IPTAL = 0 OR F.IPTAL IS NULL)
          GROUP BY P.KOD;
        `);
            const tl = tlRes.recordset?.[0]?.TL_TOTAL || 0;
            let usd = 0;
            let eur = 0;
            if (currRes.recordset) {
                currRes.recordset.forEach((r) => {
                    if (r.KOD === "USD")
                        usd = Number(r.MIKTAR) || 0;
                    if (r.KOD === "EUR")
                        eur = Number(r.MIKTAR) || 0;
                });
            }
            return { tl, usd, eur };
        }
        catch (e) {
            logger.warn("getVezneBakiye error, returning 0:", e);
            return { tl: 0, usd: 0, eur: 0 };
        }
    }
}
