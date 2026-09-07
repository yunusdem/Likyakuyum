import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { logger } from "../utils/logger.js";
import { UserRole } from "../constants/roles.js";
/**
 * Converts Hex color string (#RRGGBB) to Delphi/Windows COLORREF integer.
 * Windows COLORREF format is 0x00BBGGRR: R + (G << 8) + (B << 16)
 */
export const colorToDb = (color, defaultInt = 16777215) => {
    if (!color)
        return defaultInt;
    const str = color.trim().replace(/^#/, "");
    if (str.length === 6) {
        const r = parseInt(str.substring(0, 2), 16) || 0;
        const g = parseInt(str.substring(2, 4), 16) || 0;
        const b = parseInt(str.substring(4, 6), 16) || 0;
        return r + (g << 8) + (b << 16);
    }
    const parsed = parseInt(str, 10);
    return isNaN(parsed) ? defaultInt : parsed;
};
/**
 * Converts Delphi/Windows COLORREF integer back to Hex color string (#RRGGBB).
 */
export const colorFromDb = (val, defaultHex = "#ffffff") => {
    if (val === undefined || val === null)
        return defaultHex;
    const num = typeof val === "number" ? val : parseInt(String(val), 10);
    if (!isNaN(num)) {
        const positive = num < 0 ? (0xffffffff + num + 1) : num;
        const r = (positive & 0xff).toString(16).padStart(2, "0");
        const g = ((positive >> 8) & 0xff).toString(16).padStart(2, "0");
        const b = ((positive >> 16) & 0xff).toString(16).padStart(2, "0");
        return `#${r}${g}${b}`;
    }
    return defaultHex;
};
export const parseMenuFont = (raw) => {
    if (!raw)
        return { font: "Segoe UI, sans-serif", selectedBgColor: "#ff80ff" };
    if (raw.includes("|")) {
        const parts = raw.split("|");
        return {
            font: parts[0] || "Segoe UI, sans-serif",
            selectedBgColor: parts[1] || "#ff80ff",
        };
    }
    const match = raw.match(/(\d{7,10})$/);
    if (match) {
        const colorNum = parseInt(match[1], 10);
        const selectedBg = colorFromDb(colorNum, "#ff80ff");
        const cleanFont = raw.replace(/[^\x20-\x7E]/g, "").replace(/\d+$/, "").trim();
        return {
            font: cleanFont || "Segoe UI, sans-serif",
            selectedBgColor: selectedBg,
        };
    }
    return { font: raw, selectedBgColor: "#ff80ff" };
};
export const parseMenuHeaderFont = (raw) => {
    if (!raw)
        return { font: "Segoe UI, sans-serif", headerBgColor: "#000080" };
    if (raw.includes("|")) {
        const parts = raw.split("|");
        return {
            font: parts[0] || "Segoe UI, sans-serif",
            headerBgColor: parts[1] || "#000080",
        };
    }
    const match = raw.match(/(\d{7,10})$/);
    if (match) {
        const colorNum = parseInt(match[1], 10);
        const headerBg = colorFromDb(colorNum, "#000080");
        const cleanFont = raw.replace(/[^\x20-\x7E]/g, "").replace(/\d+$/, "").trim();
        return {
            font: cleanFont || "Segoe UI, sans-serif",
            headerBgColor: headerBg,
        };
    }
    return { font: raw, headerBgColor: "#000080" };
};
export const encodeMenuFont = (font, selectedBgColor) => {
    const f = font || "Segoe UI, sans-serif";
    const c = selectedBgColor || "#ff80ff";
    return `${f}|${c}`;
};
export const encodeMenuHeaderFont = (font, headerBgColor) => {
    const f = font || "Segoe UI, sans-serif";
    const c = headerBgColor || "#000080";
    return `${f}|${c}`;
};
const toBool = (val) => {
    return val === true || val === 1 || val === "1" || val === "true";
};
const toBit = (val) => {
    return toBool(val) ? 1 : 0;
};
const toInt = (val, defaultVal = 0) => {
    if (val === undefined || val === null || val === "")
        return defaultVal;
    const parsed = parseInt(String(val), 10);
    return isNaN(parsed) ? defaultVal : parsed;
};
const toFloat = (val, defaultVal = 0.0) => {
    if (val === undefined || val === null || val === "")
        return defaultVal;
    const parsed = parseFloat(String(val));
    return isNaN(parsed) ? defaultVal : parsed;
};
const toStatId = (val) => {
    if (val === undefined || val === null || val === "")
        return null;
    const cleaned = String(val).replace(/\D/g, "");
    if (!cleaned)
        return null;
    const parsed = parseInt(cleaned, 10);
    return isNaN(parsed) ? null : parsed;
};
const kurYetkisiToDb = (val) => {
    if (typeof val === "number")
        return val;
    const str = String(val || "").trim();
    if (str === "Yok" || str === "0")
        return 0;
    if (str === "Limitli" || str === "2")
        return 2;
    return 1; // "Var" -> 1
};
const kurYetkisiFromDb = (val) => {
    if (val === 0 || val === "0")
        return "Yok";
    if (val === 2 || val === "2")
        return "Limitli";
    return "Var";
};
export class UserSqlRepository {
    /**
     * Transforms raw TODVZ_KULLANICI SQL row into UserModel DTO
     */
    static mapEntityToModel(entity) {
        const isSysAdmin = toBool(entity.SISTEM_YONETICISI);
        const id = String(entity.KULLANICI_ID);
        const username = (entity.AD || "").trim();
        return {
            id,
            username,
            fullName: username || "Kullanıcı",
            email: `${username ? username.toLowerCase() : "user"}@kuyumcuerp.local`,
            password: entity.SIFRE || "",
            passwordHash: entity.SIFRE || "",
            role: isSysAdmin ? UserRole.ADMIN : UserRole.CASHIER,
            cashierCode: String(entity.VEZNE_ID ?? "0"),
            isActive: true,
            // Left column permissions
            isSysAdmin,
            displayDays: entity.FIS_GOSTERME_GUN_SAYISI ?? 0,
            hasWorkspacePerm: toBool(entity.ALAN_ISLEMLERI_YETKISI),
            hasDateChangePerm: toBool(entity.TARIH_DEGISTIRME_YETKISI),
            hasCommissionPerm: toBool(entity.KOMISYON_ALMA_YETKISI),
            hasSlipNoChangePerm: toBool(entity.FIS_NO_DEGISTIRME_YETKISI),
            hasCashDeskBalanceCheck: toBool(entity.VEZNE_BAKIYE_KONTROLU),
            canViewAccountBalance: toBool(entity.CARI_BAKIYE_GOREBILIR),
            canViewOpenTermTrans: toBool(entity.ACIK_VADELI_ISLEM_GOREBILIR),
            hasSlipBankAccountPerm: toBool(entity.FIS_BANKA_HESABI_SECME_YETKISI),
            hasSlipAmountChangePerm: toBool(entity.FIS_TUTAR_DEGISTIRME_YETKISI),
            isSuspiciousTransAuth: toBool(entity.SUPHELI_ISLEMLER_YETKILISI),
            noCrossRateCheck: toBool(entity.CAPRAZ_KUR_KONTROLU_YOK),
            // Middle hardware & rates
            printerId: String(entity.YAZICI_ID ?? "1"),
            horizontalZoom: entity.YATAY_ZOOM ?? 0,
            verticalZoom: entity.DIKEY_ZOOM ?? 0,
            hasCommissionRate: toBool(entity.HAREKET_TIPI_VAR),
            commissionRate: entity.KOMISYON_ORANI ?? 0,
            ratePermType: kurYetkisiFromDb(entity.KUR_YETKISI),
            ratePermValue: entity.KUR_TOLERANS_ORANI ?? 0,
            // Right menu permissions
            menuPerms: {
                mainMenu: String(entity.ANA_MENU_YETKISI ?? "Tam Yetki"),
                cashier: String(entity.VEZNE_ISLEMLERI_YETKISI ?? "Tam Yetki"),
                safe: String(entity.KASA_ISLEMLERI_YETKISI ?? "Tam Yetki"),
                exchange: String(entity.KUR_ISLEMLERI_YETKISI ?? "Tam Yetki"),
                accounts: String(entity.CARI_ISLEMLER_YETKISI ?? "Tam Yetki"),
                admin: String(entity.YONETICI_ISLEMLERI_YETKISI ?? (isSysAdmin ? "Tam Yetki" : "Yetki Yok")),
                accounting: String(entity.MUHASEBE_YETKISI ?? (isSysAdmin ? "Tam Yetki" : "Yetki Yok")),
                reports: String(entity.RAPORLAR_YETKISI ?? "Tam Yetki"),
                consolidatedReports: String(entity.KONSOLIDE_RAPORLAR_YETKISI ?? (isSysAdmin ? "Tam Yetki" : "Yetki Yok")),
                techOps: String(entity.TEKNIK_ISLEMLER_YETKISI ?? (isSysAdmin ? "Tam Yetki" : "Yetki Yok")),
                movementType: String(entity.HAREKET_TIPI ?? "1"),
            },
            // Stat codes
            buyStatCode: entity.ALIS_ISTATISTIK_ID != null ? String(entity.ALIS_ISTATISTIK_ID) : "",
            sellStatCode: entity.SATIS_ISTATISTIK_ID != null ? String(entity.SATIS_ISTATISTIK_ID) : "",
            arbitrageBuyStatCode: entity.ARBITRAJ_ALIS_ISTATISTIK_ID != null ? String(entity.ARBITRAJ_ALIS_ISTATISTIK_ID) : "",
            arbitrageSellStatCode: entity.ARBITRAJ_SATIS_ISTATISTIK_ID != null ? String(entity.ARBITRAJ_SATIS_ISTATISTIK_ID) : "",
            // E-Document & Masak
            integratorUsername: entity.ENTEGRATOR_KULLANICI_ADI || "",
            integratorPassword: entity.ENTEGRATOR_KULLANICI_SIFRESI || "",
            isEDocumentActive: toBool(entity.E_BELGE_KULLANILIYOR),
            masakUsername: entity.MASAK_KULLANICI_ADI || "",
            masakPassword: entity.MASAK_KULLANICI_SIFRESI || "",
            hasMasakWarning: toBool(entity.MASAK_UYARISI_VERSIN),
            noDeviationWarning: toBool(entity.SAPMA_UYARISI_VERILMESIN),
            canBeOutsideCounterRate: toBool(entity.GISE_KURU_DISINDA_OLABILIR),
            // Appearance Tab
            appearance: {
                enableProgramTheme: true,
                programBgColor: colorFromDb(entity.PROGRAM_ZEMIN_RENGI, "#f8fafc"),
                programTextColor: colorFromDb(entity.PROGRAM_YAZI_RENGI, "#0f172a"),
                programFont: entity.DIALOG_FONTU || "Segoe UI, sans-serif",
                gridHeaderBgColor: colorFromDb(entity.PROGRAM_GRID_BASLIK_RENGI, "#cbe5ff"),
                gridBgColor: colorFromDb(entity.PROGRAM_GRID_ZEMIN_RENGI, "#ffffff"),
                gridFont: entity.GRID_FONTU || "Segoe UI, sans-serif",
                windowBgColor: colorFromDb(entity.PROGRAM_PENCERE_ZEMIN_RENGI, "#ffffff"),
                windowTextColor: colorFromDb(entity.PROGRAM_PENCERE_YAZI_RENGI, "#000000"),
                windowFocusColor: colorFromDb(entity.PROGRAM_PENCERE_FOKUS_RENGI, "#e2e8f0"),
                enableMenuTheme: true,
                menuBgColor: colorFromDb(entity.MENU_ARKA_PLAN_RENGI, "#bfe0ff"),
                menuSelectedBgColor: parseMenuFont(entity.MENU_FONTU).selectedBgColor,
                menuFont: parseMenuFont(entity.MENU_FONTU).font,
                menuHeaderBgColor: parseMenuHeaderFont(entity.MENU_BASLIK_FONTU).headerBgColor,
                menuHeaderFont: parseMenuHeaderFont(entity.MENU_BASLIK_FONTU).font,
                menuBackdropColor: colorFromDb(entity.MENU_ARKA_PLAN_RENGI, "#ff8080"),
                enableBuyHeaderTheme: true,
                buyHeaderBgColor: colorFromDb(entity.ALIS_FISI_BASLIK_ZEMIN_RENGI, "#e2e8f0"),
                buyHeaderTextColor: colorFromDb(entity.ALIS_FISI_BASLIK_YAZI_RENGI, "#000000"),
                enableSellHeaderTheme: true,
                sellHeaderBgColor: colorFromDb(entity.SATIS_FISI_BASLIK_ZEMIN_RENGI, "#e2e8f0"),
                sellHeaderTextColor: colorFromDb(entity.SATIS_FISI_BASLIK_YAZI_RENGI, "#000000"),
            },
            createdAt: new Date(),
            updatedAt: new Date(),
        };
    }
    /**
     * Fetches all users from [dbo].[TODVZ_KULLANICI] in the target database
     */
    static async findAll(dbContext) {
        try {
            const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
            const result = await pool.request().query(`
        SELECT 
          [KULLANICI_ID]
          ,[AD]
          ,[SIFRE]
          ,[SISTEM_YONETICISI]
          ,[YAZICI_ID]
          ,[VEZNE_ID]
          ,[KUR_YETKISI]
          ,[KUR_TOLERANS_ORANI]
          ,[KOMISYON_ALMA_YETKISI]
          ,[PROGRAM_ZEMIN_RENGI]
          ,[PROGRAM_YAZI_RENGI]
          ,[MENU_FONTU]
          ,[MENU_BASLIK_FONTU]
          ,[PROGRAM_GRID_BASLIK_RENGI]
          ,[MENU_ARKA_PLAN_RENGI]
          ,[ANA_MENU_YETKISI]
          ,[VEZNE_ISLEMLERI_YETKISI]
          ,[KASA_ISLEMLERI_YETKISI]
          ,[KUR_ISLEMLERI_YETKISI]
          ,[CARI_ISLEMLER_YETKISI]
          ,[YONETICI_ISLEMLERI_YETKISI]
          ,[MUHASEBE_YETKISI]
          ,[RAPORLAR_YETKISI]
          ,[TEKNIK_ISLEMLER_YETKISI]
          ,[ALAN_ISLEMLERI_YETKISI]
          ,[TARIH_DEGISTIRME_YETKISI]
          ,[PROGRAM_GRID_ZEMIN_RENGI]
          ,[PROGRAM_PENCERE_ZEMIN_RENGI]
          ,[PROGRAM_PENCERE_YAZI_RENGI]
          ,[PROGRAM_PENCERE_FOKUS_RENGI]
          ,[DIALOG_FONTU]
          ,[GRID_FONTU]
          ,[DIKEY_ZOOM]
          ,[YATAY_ZOOM]
          ,[ALIS_FISI_BASLIK_ZEMIN_RENGI]
          ,[ALIS_FISI_BASLIK_YAZI_RENGI]
          ,[SATIS_FISI_BASLIK_ZEMIN_RENGI]
          ,[SATIS_FISI_BASLIK_YAZI_RENGI]
          ,[FIS_NO_DEGISTIRME_YETKISI]
          ,[VEZNE_BAKIYE_KONTROLU]
          ,[KOMISYON_ORANI]
          ,[HAREKET_TIPI_VAR]
          ,[HAREKET_TIPI]
          ,[CARI_BAKIYE_GOREBILIR]
          ,[ACIK_VADELI_ISLEM_GOREBILIR]
          ,[FIS_BANKA_HESABI_SECME_YETKISI]
          ,[FIS_TUTAR_DEGISTIRME_YETKISI]
          ,[FIS_GOSTERME_GUN_SAYISI]
          ,[KONSOLIDE_RAPORLAR_YETKISI]
          ,[ALIS_ISTATISTIK_ID]
          ,[SATIS_ISTATISTIK_ID]
          ,[ARBITRAJ_ALIS_ISTATISTIK_ID]
          ,[ARBITRAJ_SATIS_ISTATISTIK_ID]
          ,[ENTEGRATOR_KULLANICI_ADI]
          ,[ENTEGRATOR_KULLANICI_SIFRESI]
          ,[E_BELGE_KULLANILIYOR]
          ,[MASAK_KULLANICI_ADI]
          ,[MASAK_KULLANICI_SIFRESI]
          ,[MASAK_UYARISI_VERSIN]
          ,[SUPHELI_ISLEMLER_YETKILISI]
          ,[SAPMA_UYARISI_VERILMESIN]
          ,[GISE_KURU_DISINDA_OLABILIR]
          ,[CAPRAZ_KUR_KONTROLU_YOK]
        FROM [dbo].[TODVZ_KULLANICI]
        ORDER BY [KULLANICI_ID] ASC
      `);
            return result.recordset.map(UserSqlRepository.mapEntityToModel);
        }
        catch (error) {
            logger.error("UserSqlRepository.findAll error:", error);
            throw error;
        }
    }
    /**
     * Finds a user by ID using parameterized query in the target database
     */
    static async findById(id, dbContext) {
        try {
            const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
            const request = pool.request();
            request.input("userId", sql.Int, toInt(id));
            const result = await request.query(`
        SELECT TOP 1 *
        FROM [dbo].[TODVZ_KULLANICI]
        WHERE [KULLANICI_ID] = @userId
      `);
            if (!result.recordset || result.recordset.length === 0) {
                return null;
            }
            return UserSqlRepository.mapEntityToModel(result.recordset[0]);
        }
        catch (error) {
            logger.error(`UserSqlRepository.findById(${id}) error:`, error);
            throw error;
        }
    }
    /**
     * Finds a user by Username using parameterized query in the target database
     */
    static async findByUsername(username, dbContext) {
        try {
            const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
            const request = pool.request();
            request.input("username", sql.VarChar(50), username.trim());
            const result = await request.query(`
        SELECT TOP 1 *
        FROM [dbo].[TODVZ_KULLANICI]
        WHERE [AD] = @username
      `);
            if (!result.recordset || result.recordset.length === 0) {
                return null;
            }
            return UserSqlRepository.mapEntityToModel(result.recordset[0]);
        }
        catch (error) {
            if (error?.statusCode === 400 || error?.statusCode === 401 || error?.message?.includes("bağlanılamadı")) {
                throw error;
            }
            logger.error(`UserSqlRepository.findByUsername(${username}) error:`, error?.message || error);
            throw error;
        }
    }
    /**
     * Fetches all registered cashiers (Vezneler) from [dbo].[TODVZ_VEZNE] in the target database
     */
    static async getCashiers(dbContext) {
        try {
            const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
            const result = await pool.request().query(`
        SELECT [VEZNE_ID], ISNULL([KOD], '') AS [KOD], ISNULL([AD], 'Vezne ' + CAST([VEZNE_ID] AS VARCHAR(10))) AS [AD]
        FROM [dbo].[TODVZ_VEZNE]
        ORDER BY [VEZNE_ID] ASC
      `);
            return result.recordset.map((r) => ({
                id: r.VEZNE_ID,
                kod: (r.KOD || "").trim() || String(r.VEZNE_ID),
                name: r.AD || `Vezne ${r.VEZNE_ID}`,
            }));
        }
        catch (e) {
            logger.warn("Could not fetch TODVZ_VEZNE:", e);
            return [];
        }
    }
    /**
     * Resolves a valid VEZNE_ID from [dbo].[TODVZ_VEZNE] to satisfy foreign key constraint
     */
    static async resolveValidVezneId(pool, inputVezneId) {
        const rawStr = String(inputVezneId || "").trim();
        const rawId = toInt(inputVezneId, -1);
        if (rawId >= 0) {
            const check = await pool.request()
                .input("chkId", sql.Int, rawId)
                .query("SELECT TOP 1 [VEZNE_ID] FROM [dbo].[TODVZ_VEZNE] WHERE [VEZNE_ID] = @chkId");
            if (check.recordset && check.recordset.length > 0) {
                return rawId;
            }
        }
        if (rawStr) {
            const checkKod = await pool.request()
                .input("chkKod", sql.VarChar(50), rawStr)
                .query("SELECT TOP 1 [VEZNE_ID] FROM [dbo].[TODVZ_VEZNE] WHERE [KOD] = @chkKod");
            if (checkKod.recordset && checkKod.recordset.length > 0) {
                return checkKod.recordset[0].VEZNE_ID;
            }
        }
        // Fallback to first available vezne in TODVZ_VEZNE
        const firstVezne = await pool.request().query("SELECT TOP 1 [VEZNE_ID] FROM [dbo].[TODVZ_VEZNE] ORDER BY [VEZNE_ID] ASC");
        if (firstVezne.recordset && firstVezne.recordset.length > 0) {
            return firstVezne.recordset[0].VEZNE_ID;
        }
        return rawId >= 0 ? rawId : 1;
    }
    /**
     * Creates a new user in [dbo].[TODVZ_KULLANICI] with safe parameterized inputs in the target database
     */
    static async create(user, dbContext) {
        try {
            const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
            const request = pool.request();
            const username = (user.username || user.fullName || "Yeni_Kullanici").replace(/\s+/g, "").trim();
            const isSysAdmin = toBit(user.isSysAdmin);
            const app = user.appearance;
            const menu = user.menuPerms;
            const validVezneId = await UserSqlRepository.resolveValidVezneId(pool, user.cashierCode);
            request.input("AD", sql.VarChar(50), username);
            request.input("SIFRE", sql.VarChar(30), (user.password || "").slice(0, 30));
            request.input("SISTEM_YONETICISI", sql.Bit, isSysAdmin);
            request.input("YAZICI_ID", sql.Int, toInt(user.printerId, 1));
            request.input("VEZNE_ID", sql.Int, validVezneId);
            request.input("KUR_YETKISI", sql.TinyInt, kurYetkisiToDb(user.ratePermType));
            request.input("KUR_TOLERANS_ORANI", sql.Float, toFloat(user.ratePermValue, 0.0));
            request.input("KOMISYON_ALMA_YETKISI", sql.Bit, toBit(user.hasCommissionPerm));
            request.input("PROGRAM_ZEMIN_RENGI", sql.Int, colorToDb(app?.programBgColor, 16316664));
            request.input("PROGRAM_YAZI_RENGI", sql.Int, colorToDb(app?.programTextColor, 0));
            request.input("MENU_FONTU", sql.VarChar(200), encodeMenuFont(app?.menuFont, app?.menuSelectedBgColor).slice(0, 200));
            request.input("MENU_BASLIK_FONTU", sql.VarChar(200), encodeMenuHeaderFont(app?.menuHeaderFont, app?.menuHeaderBgColor).slice(0, 200));
            request.input("PROGRAM_GRID_BASLIK_RENGI", sql.Int, colorToDb(app?.gridHeaderBgColor, 16768459));
            request.input("MENU_ARKA_PLAN_RENGI", sql.Int, colorToDb(app?.menuBgColor || app?.menuBackdropColor, 16744575));
            request.input("ANA_MENU_YETKISI", sql.VarChar(16), (menu?.mainMenu || "Tam Yetki").slice(0, 16));
            request.input("VEZNE_ISLEMLERI_YETKISI", sql.VarChar(16), (menu?.cashier || "Tam Yetki").slice(0, 16));
            request.input("KASA_ISLEMLERI_YETKISI", sql.VarChar(16), (menu?.safe || "Tam Yetki").slice(0, 16));
            request.input("KUR_ISLEMLERI_YETKISI", sql.VarChar(16), (menu?.exchange || "Tam Yetki").slice(0, 16));
            request.input("CARI_ISLEMLER_YETKISI", sql.VarChar(16), (menu?.accounts || "Tam Yetki").slice(0, 16));
            request.input("YONETICI_ISLEMLERI_YETKISI", sql.VarChar(16), (menu?.admin || (isSysAdmin ? "Tam Yetki" : "Yetki Yok")).slice(0, 16));
            request.input("MUHASEBE_YETKISI", sql.VarChar(16), (menu?.accounting || (isSysAdmin ? "Tam Yetki" : "Yetki Yok")).slice(0, 16));
            request.input("RAPORLAR_YETKISI", sql.VarChar(16), (menu?.reports || "Tam Yetki").slice(0, 16));
            request.input("TEKNIK_ISLEMLER_YETKISI", sql.VarChar(16), (menu?.techOps || (isSysAdmin ? "Tam Yetki" : "Yetki Yok")).slice(0, 16));
            request.input("ALAN_ISLEMLERI_YETKISI", sql.Bit, toBit(user.hasWorkspacePerm));
            request.input("TARIH_DEGISTIRME_YETKISI", sql.Bit, toBit(user.hasDateChangePerm));
            request.input("PROGRAM_GRID_ZEMIN_RENGI", sql.Int, colorToDb(app?.gridBgColor, 16777215));
            request.input("PROGRAM_PENCERE_ZEMIN_RENGI", sql.Int, colorToDb(app?.windowBgColor, 16777215));
            request.input("PROGRAM_PENCERE_YAZI_RENGI", sql.Int, colorToDb(app?.windowTextColor, 0));
            request.input("PROGRAM_PENCERE_FOKUS_RENGI", sql.Int, colorToDb(app?.windowFocusColor, 15724527));
            request.input("DIALOG_FONTU", sql.VarChar(200), (app?.programFont || "Segoe UI, sans-serif").slice(0, 200));
            request.input("GRID_FONTU", sql.VarChar(200), (app?.gridFont || "Segoe UI, sans-serif").slice(0, 200));
            request.input("DIKEY_ZOOM", sql.Int, toInt(user.verticalZoom, 0));
            request.input("YATAY_ZOOM", sql.Int, toInt(user.horizontalZoom, 0));
            request.input("ALIS_FISI_BASLIK_ZEMIN_RENGI", sql.Int, colorToDb(app?.buyHeaderBgColor, 14803424));
            request.input("ALIS_FISI_BASLIK_YAZI_RENGI", sql.Int, colorToDb(app?.buyHeaderTextColor, 0));
            request.input("SATIS_FISI_BASLIK_ZEMIN_RENGI", sql.Int, colorToDb(app?.sellHeaderBgColor, 14803424));
            request.input("SATIS_FISI_BASLIK_YAZI_RENGI", sql.Int, colorToDb(app?.sellHeaderTextColor, 0));
            request.input("FIS_NO_DEGISTIRME_YETKISI", sql.Bit, toBit(user.hasSlipNoChangePerm));
            request.input("VEZNE_BAKIYE_KONTROLU", sql.Bit, toBit(user.hasCashDeskBalanceCheck));
            request.input("KOMISYON_ORANI", sql.Float, toFloat(user.commissionRate, 0.0));
            request.input("HAREKET_TIPI_VAR", sql.Bit, toBit(user.hasCommissionRate));
            request.input("HAREKET_TIPI", sql.TinyInt, toInt(menu?.movementType, 1));
            request.input("CARI_BAKIYE_GOREBILIR", sql.Bit, toBit(user.canViewAccountBalance));
            request.input("ACIK_VADELI_ISLEM_GOREBILIR", sql.Bit, toBit(user.canViewOpenTermTrans));
            request.input("FIS_BANKA_HESABI_SECME_YETKISI", sql.Bit, toBit(user.hasSlipBankAccountPerm));
            request.input("FIS_TUTAR_DEGISTIRME_YETKISI", sql.Bit, toBit(user.hasSlipAmountChangePerm));
            request.input("FIS_GOSTERME_GUN_SAYISI", sql.Int, toInt(user.displayDays, 0));
            request.input("KONSOLIDE_RAPORLAR_YETKISI", sql.VarChar(16), (menu?.consolidatedReports || (isSysAdmin ? "Tam Yetki" : "Yetki Yok")).slice(0, 16));
            request.input("ALIS_ISTATISTIK_ID", sql.Int, toStatId(user.buyStatCode));
            request.input("SATIS_ISTATISTIK_ID", sql.Int, toStatId(user.sellStatCode));
            request.input("ARBITRAJ_ALIS_ISTATISTIK_ID", sql.Int, toStatId(user.arbitrageBuyStatCode));
            request.input("ARBITRAJ_SATIS_ISTATISTIK_ID", sql.Int, toStatId(user.arbitrageSellStatCode));
            request.input("ENTEGRATOR_KULLANICI_ADI", sql.VarChar(200), (user.integratorUsername || "").slice(0, 200));
            request.input("ENTEGRATOR_KULLANICI_SIFRESI", sql.VarChar(30), (user.integratorPassword || "").slice(0, 30));
            request.input("E_BELGE_KULLANILIYOR", sql.Bit, toBit(user.isEDocumentActive));
            request.input("MASAK_KULLANICI_ADI", sql.VarChar(200), (user.masakUsername || "").slice(0, 200));
            request.input("MASAK_KULLANICI_SIFRESI", sql.VarChar(200), (user.masakPassword || "").slice(0, 200));
            request.input("MASAK_UYARISI_VERSIN", sql.Bit, toBit(user.hasMasakWarning));
            request.input("SUPHELI_ISLEMLER_YETKILISI", sql.Bit, toBit(user.isSuspiciousTransAuth));
            request.input("SAPMA_UYARISI_VERILMESIN", sql.Bit, toBit(user.noDeviationWarning));
            request.input("GISE_KURU_DISINDA_OLABILIR", sql.Bit, toBit(user.canBeOutsideCounterRate));
            request.input("CAPRAZ_KUR_KONTROLU_YOK", sql.Bit, toBit(user.noCrossRateCheck));
            const insertQuery = `
        INSERT INTO [dbo].[TODVZ_KULLANICI] (
          [AD], [SIFRE], [SISTEM_YONETICISI], [YAZICI_ID], [VEZNE_ID], [KUR_YETKISI],
          [KUR_TOLERANS_ORANI], [KOMISYON_ALMA_YETKISI], [PROGRAM_ZEMIN_RENGI], [PROGRAM_YAZI_RENGI],
          [MENU_FONTU], [MENU_BASLIK_FONTU], [PROGRAM_GRID_BASLIK_RENGI], [MENU_ARKA_PLAN_RENGI],
          [ANA_MENU_YETKISI], [VEZNE_ISLEMLERI_YETKISI], [KASA_ISLEMLERI_YETKISI], [KUR_ISLEMLERI_YETKISI],
          [CARI_ISLEMLER_YETKISI], [YONETICI_ISLEMLERI_YETKISI], [MUHASEBE_YETKISI], [RAPORLAR_YETKISI],
          [TEKNIK_ISLEMLER_YETKISI], [ALAN_ISLEMLERI_YETKISI], [TARIH_DEGISTIRME_YETKISI], [PROGRAM_GRID_ZEMIN_RENGI],
          [PROGRAM_PENCERE_ZEMIN_RENGI], [PROGRAM_PENCERE_YAZI_RENGI], [PROGRAM_PENCERE_FOKUS_RENGI],
          [DIALOG_FONTU], [GRID_FONTU], [DIKEY_ZOOM], [YATAY_ZOOM], [ALIS_FISI_BASLIK_ZEMIN_RENGI],
          [ALIS_FISI_BASLIK_YAZI_RENGI], [SATIS_FISI_BASLIK_ZEMIN_RENGI], [SATIS_FISI_BASLIK_YAZI_RENGI],
          [FIS_NO_DEGISTIRME_YETKISI], [VEZNE_BAKIYE_KONTROLU], [KOMISYON_ORANI], [HAREKET_TIPI_VAR],
          [HAREKET_TIPI], [CARI_BAKIYE_GOREBILIR], [ACIK_VADELI_ISLEM_GOREBILIR], [FIS_BANKA_HESABI_SECME_YETKISI],
          [FIS_TUTAR_DEGISTIRME_YETKISI], [FIS_GOSTERME_GUN_SAYISI], [KONSOLIDE_RAPORLAR_YETKISI],
          [ALIS_ISTATISTIK_ID], [SATIS_ISTATISTIK_ID], [ARBITRAJ_ALIS_ISTATISTIK_ID], [ARBITRAJ_SATIS_ISTATISTIK_ID],
          [ENTEGRATOR_KULLANICI_ADI], [ENTEGRATOR_KULLANICI_SIFRESI], [E_BELGE_KULLANILIYOR],
          [MASAK_KULLANICI_ADI], [MASAK_KULLANICI_SIFRESI], [MASAK_UYARISI_VERSIN], [SUPHELI_ISLEMLER_YETKILISI],
          [SAPMA_UYARISI_VERILMESIN], [GISE_KURU_DISINDA_OLABILIR], [CAPRAZ_KUR_KONTROLU_YOK]
        )
        VALUES (
          @AD, @SIFRE, @SISTEM_YONETICISI, @YAZICI_ID, @VEZNE_ID, @KUR_YETKISI,
          @KUR_TOLERANS_ORANI, @KOMISYON_ALMA_YETKISI, @PROGRAM_ZEMIN_RENGI, @PROGRAM_YAZI_RENGI,
          @MENU_FONTU, @MENU_BASLIK_FONTU, @PROGRAM_GRID_BASLIK_RENGI, @MENU_ARKA_PLAN_RENGI,
          @ANA_MENU_YETKISI, @VEZNE_ISLEMLERI_YETKISI, @KASA_ISLEMLERI_YETKISI, @KUR_ISLEMLERI_YETKISI,
          @CARI_ISLEMLER_YETKISI, @YONETICI_ISLEMLERI_YETKISI, @MUHASEBE_YETKISI, @RAPORLAR_YETKISI,
          @TEKNIK_ISLEMLER_YETKISI, @ALAN_ISLEMLERI_YETKISI, @TARIH_DEGISTIRME_YETKISI, @PROGRAM_GRID_ZEMIN_RENGI,
          @PROGRAM_PENCERE_ZEMIN_RENGI, @PROGRAM_PENCERE_YAZI_RENGI, @PROGRAM_PENCERE_FOKUS_RENGI,
          @DIALOG_FONTU, @GRID_FONTU, @DIKEY_ZOOM, @YATAY_ZOOM, @ALIS_FISI_BASLIK_ZEMIN_RENGI,
          @ALIS_FISI_BASLIK_YAZI_RENGI, @SATIS_FISI_BASLIK_ZEMIN_RENGI, @SATIS_FISI_BASLIK_YAZI_RENGI,
          @FIS_NO_DEGISTIRME_YETKISI, @VEZNE_BAKIYE_KONTROLU, @KOMISYON_ORANI, @HAREKET_TIPI_VAR,
          @HAREKET_TIPI, @CARI_BAKIYE_GOREBILIR, @ACIK_VADELI_ISLEM_GOREBILIR, @FIS_BANKA_HESABI_SECME_YETKISI,
          @FIS_TUTAR_DEGISTIRME_YETKISI, @FIS_GOSTERME_GUN_SAYISI, @KONSOLIDE_RAPORLAR_YETKISI,
          @ALIS_ISTATISTIK_ID, @SATIS_ISTATISTIK_ID, @ARBITRAJ_ALIS_ISTATISTIK_ID, @ARBITRAJ_SATIS_ISTATISTIK_ID,
          @ENTEGRATOR_KULLANICI_ADI, @ENTEGRATOR_KULLANICI_SIFRESI, @E_BELGE_KULLANILIYOR,
          @MASAK_KULLANICI_ADI, @MASAK_KULLANICI_SIFRESI, @MASAK_UYARISI_VERSIN, @SUPHELI_ISLEMLER_YETKILISI,
          @SAPMA_UYARISI_VERILMESIN, @GISE_KURU_DISINDA_OLABILIR, @CAPRAZ_KUR_KONTROLU_YOK
        );

        SELECT TOP 1 * FROM [dbo].[TODVZ_KULLANICI] WHERE [KULLANICI_ID] = SCOPE_IDENTITY();
      `;
            const result = await request.query(insertQuery);
            if (!result.recordset || result.recordset.length === 0) {
                throw new Error("Kullanıcı kaydı oluşturuldu fakat yeni kayıt geri alınamadı.");
            }
            return UserSqlRepository.mapEntityToModel(result.recordset[0]);
        }
        catch (error) {
            logger.error("UserSqlRepository.create error:", error);
            throw error;
        }
    }
    /**
     * Updates an existing user in [dbo].[TODVZ_KULLANICI] in the target database
     */
    static async update(id, user, dbContext) {
        try {
            const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
            const request = pool.request();
            const username = (user.username || user.fullName || "").replace(/\s+/g, "").trim();
            const isSysAdmin = toBit(user.isSysAdmin);
            const app = user.appearance;
            const menu = user.menuPerms;
            const validVezneId = await UserSqlRepository.resolveValidVezneId(pool, user.cashierCode);
            request.input("userId", sql.Int, toInt(id));
            request.input("AD", sql.VarChar(50), username);
            request.input("SIFRE", sql.VarChar(30), (user.password || "").slice(0, 30));
            request.input("SISTEM_YONETICISI", sql.Bit, isSysAdmin);
            request.input("YAZICI_ID", sql.Int, toInt(user.printerId, 1));
            request.input("VEZNE_ID", sql.Int, validVezneId);
            request.input("KUR_YETKISI", sql.TinyInt, kurYetkisiToDb(user.ratePermType));
            request.input("KUR_TOLERANS_ORANI", sql.Float, toFloat(user.ratePermValue, 0.0));
            request.input("KOMISYON_ALMA_YETKISI", sql.Bit, toBit(user.hasCommissionPerm));
            request.input("PROGRAM_ZEMIN_RENGI", sql.Int, colorToDb(app?.programBgColor, 16316664));
            request.input("PROGRAM_YAZI_RENGI", sql.Int, colorToDb(app?.programTextColor, 0));
            request.input("MENU_FONTU", sql.VarChar(200), encodeMenuFont(app?.menuFont, app?.menuSelectedBgColor).slice(0, 200));
            request.input("MENU_BASLIK_FONTU", sql.VarChar(200), encodeMenuHeaderFont(app?.menuHeaderFont, app?.menuHeaderBgColor).slice(0, 200));
            request.input("PROGRAM_GRID_BASLIK_RENGI", sql.Int, colorToDb(app?.gridHeaderBgColor, 16768459));
            request.input("MENU_ARKA_PLAN_RENGI", sql.Int, colorToDb(app?.menuBgColor || app?.menuBackdropColor, 16744575));
            request.input("ANA_MENU_YETKISI", sql.VarChar(16), (menu?.mainMenu || "Tam Yetki").slice(0, 16));
            request.input("VEZNE_ISLEMLERI_YETKISI", sql.VarChar(16), (menu?.cashier || "Tam Yetki").slice(0, 16));
            request.input("KASA_ISLEMLERI_YETKISI", sql.VarChar(16), (menu?.safe || "Tam Yetki").slice(0, 16));
            request.input("KUR_ISLEMLERI_YETKISI", sql.VarChar(16), (menu?.exchange || "Tam Yetki").slice(0, 16));
            request.input("CARI_ISLEMLER_YETKISI", sql.VarChar(16), (menu?.accounts || "Tam Yetki").slice(0, 16));
            request.input("YONETICI_ISLEMLERI_YETKISI", sql.VarChar(16), (menu?.admin || (isSysAdmin ? "Tam Yetki" : "Yetki Yok")).slice(0, 16));
            request.input("MUHASEBE_YETKISI", sql.VarChar(16), (menu?.accounting || (isSysAdmin ? "Tam Yetki" : "Yetki Yok")).slice(0, 16));
            request.input("RAPORLAR_YETKISI", sql.VarChar(16), (menu?.reports || "Tam Yetki").slice(0, 16));
            request.input("TEKNIK_ISLEMLER_YETKISI", sql.VarChar(16), (menu?.techOps || (isSysAdmin ? "Tam Yetki" : "Yetki Yok")).slice(0, 16));
            request.input("ALAN_ISLEMLERI_YETKISI", sql.Bit, toBit(user.hasWorkspacePerm));
            request.input("TARIH_DEGISTIRME_YETKISI", sql.Bit, toBit(user.hasDateChangePerm));
            request.input("PROGRAM_GRID_ZEMIN_RENGI", sql.Int, colorToDb(app?.gridBgColor, 16777215));
            request.input("PROGRAM_PENCERE_ZEMIN_RENGI", sql.Int, colorToDb(app?.windowBgColor, 16777215));
            request.input("PROGRAM_PENCERE_YAZI_RENGI", sql.Int, colorToDb(app?.windowTextColor, 0));
            request.input("PROGRAM_PENCERE_FOKUS_RENGI", sql.Int, colorToDb(app?.windowFocusColor, 15724527));
            request.input("DIALOG_FONTU", sql.VarChar(200), (app?.programFont || "Segoe UI, sans-serif").slice(0, 200));
            request.input("GRID_FONTU", sql.VarChar(200), (app?.gridFont || "Segoe UI, sans-serif").slice(0, 200));
            request.input("DIKEY_ZOOM", sql.Int, toInt(user.verticalZoom, 0));
            request.input("YATAY_ZOOM", sql.Int, toInt(user.horizontalZoom, 0));
            request.input("ALIS_FISI_BASLIK_ZEMIN_RENGI", sql.Int, colorToDb(app?.buyHeaderBgColor, 14803424));
            request.input("ALIS_FISI_BASLIK_YAZI_RENGI", sql.Int, colorToDb(app?.buyHeaderTextColor, 0));
            request.input("SATIS_FISI_BASLIK_ZEMIN_RENGI", sql.Int, colorToDb(app?.sellHeaderBgColor, 14803424));
            request.input("SATIS_FISI_BASLIK_YAZI_RENGI", sql.Int, colorToDb(app?.sellHeaderTextColor, 0));
            request.input("FIS_NO_DEGISTIRME_YETKISI", sql.Bit, toBit(user.hasSlipNoChangePerm));
            request.input("VEZNE_BAKIYE_KONTROLU", sql.Bit, toBit(user.hasCashDeskBalanceCheck));
            request.input("KOMISYON_ORANI", sql.Float, toFloat(user.commissionRate, 0.0));
            request.input("HAREKET_TIPI_VAR", sql.Bit, toBit(user.hasCommissionRate));
            request.input("HAREKET_TIPI", sql.TinyInt, toInt(menu?.movementType, 1));
            request.input("CARI_BAKIYE_GOREBILIR", sql.Bit, toBit(user.canViewAccountBalance));
            request.input("ACIK_VADELI_ISLEM_GOREBILIR", sql.Bit, toBit(user.canViewOpenTermTrans));
            request.input("FIS_BANKA_HESABI_SECME_YETKISI", sql.Bit, toBit(user.hasSlipBankAccountPerm));
            request.input("FIS_TUTAR_DEGISTIRME_YETKISI", sql.Bit, toBit(user.hasSlipAmountChangePerm));
            request.input("FIS_GOSTERME_GUN_SAYISI", sql.Int, toInt(user.displayDays, 0));
            request.input("KONSOLIDE_RAPORLAR_YETKISI", sql.VarChar(16), (menu?.consolidatedReports || (isSysAdmin ? "Tam Yetki" : "Yetki Yok")).slice(0, 16));
            request.input("ALIS_ISTATISTIK_ID", sql.Int, toStatId(user.buyStatCode));
            request.input("SATIS_ISTATISTIK_ID", sql.Int, toStatId(user.sellStatCode));
            request.input("ARBITRAJ_ALIS_ISTATISTIK_ID", sql.Int, toStatId(user.arbitrageBuyStatCode));
            request.input("ARBITRAJ_SATIS_ISTATISTIK_ID", sql.Int, toStatId(user.arbitrageSellStatCode));
            request.input("ENTEGRATOR_KULLANICI_ADI", sql.VarChar(200), (user.integratorUsername || "").slice(0, 200));
            request.input("ENTEGRATOR_KULLANICI_SIFRESI", sql.VarChar(30), (user.integratorPassword || "").slice(0, 30));
            request.input("E_BELGE_KULLANILIYOR", sql.Bit, toBit(user.isEDocumentActive));
            request.input("MASAK_KULLANICI_ADI", sql.VarChar(200), (user.masakUsername || "").slice(0, 200));
            request.input("MASAK_KULLANICI_SIFRESI", sql.VarChar(200), (user.masakPassword || "").slice(0, 200));
            request.input("MASAK_UYARISI_VERSIN", sql.Bit, toBit(user.hasMasakWarning));
            request.input("SUPHELI_ISLEMLER_YETKILISI", sql.Bit, toBit(user.isSuspiciousTransAuth));
            request.input("SAPMA_UYARISI_VERILMESIN", sql.Bit, toBit(user.noDeviationWarning));
            request.input("GISE_KURU_DISINDA_OLABILIR", sql.Bit, toBit(user.canBeOutsideCounterRate));
            request.input("CAPRAZ_KUR_KONTROLU_YOK", sql.Bit, toBit(user.noCrossRateCheck));
            const updateQuery = `
        UPDATE [dbo].[TODVZ_KULLANICI]
        SET 
          [AD] = @AD,
          [SIFRE] = CASE WHEN @SIFRE <> '' THEN @SIFRE ELSE [SIFRE] END,
          [SISTEM_YONETICISI] = @SISTEM_YONETICISI,
          [YAZICI_ID] = @YAZICI_ID,
          [VEZNE_ID] = @VEZNE_ID,
          [KUR_YETKISI] = @KUR_YETKISI,
          [KUR_TOLERANS_ORANI] = @KUR_TOLERANS_ORANI,
          [KOMISYON_ALMA_YETKISI] = @KOMISYON_ALMA_YETKISI,
          [PROGRAM_ZEMIN_RENGI] = @PROGRAM_ZEMIN_RENGI,
          [PROGRAM_YAZI_RENGI] = @PROGRAM_YAZI_RENGI,
          [MENU_FONTU] = @MENU_FONTU,
          [MENU_BASLIK_FONTU] = @MENU_BASLIK_FONTU,
          [PROGRAM_GRID_BASLIK_RENGI] = @PROGRAM_GRID_BASLIK_RENGI,
          [MENU_ARKA_PLAN_RENGI] = @MENU_ARKA_PLAN_RENGI,
          [ANA_MENU_YETKISI] = @ANA_MENU_YETKISI,
          [VEZNE_ISLEMLERI_YETKISI] = @VEZNE_ISLEMLERI_YETKISI,
          [KASA_ISLEMLERI_YETKISI] = @KASA_ISLEMLERI_YETKISI,
          [KUR_ISLEMLERI_YETKISI] = @KUR_ISLEMLERI_YETKISI,
          [CARI_ISLEMLER_YETKISI] = @CARI_ISLEMLER_YETKISI,
          [YONETICI_ISLEMLERI_YETKISI] = @YONETICI_ISLEMLERI_YETKISI,
          [MUHASEBE_YETKISI] = @MUHASEBE_YETKISI,
          [RAPORLAR_YETKISI] = @RAPORLAR_YETKISI,
          [TEKNIK_ISLEMLER_YETKISI] = @TEKNIK_ISLEMLER_YETKISI,
          [ALAN_ISLEMLERI_YETKISI] = @ALAN_ISLEMLERI_YETKISI,
          [TARIH_DEGISTIRME_YETKISI] = @TARIH_DEGISTIRME_YETKISI,
          [PROGRAM_GRID_ZEMIN_RENGI] = @PROGRAM_GRID_ZEMIN_RENGI,
          [PROGRAM_PENCERE_ZEMIN_RENGI] = @PROGRAM_PENCERE_ZEMIN_RENGI,
          [PROGRAM_PENCERE_YAZI_RENGI] = @PROGRAM_PENCERE_YAZI_RENGI,
          [PROGRAM_PENCERE_FOKUS_RENGI] = @PROGRAM_PENCERE_FOKUS_RENGI,
          [DIALOG_FONTU] = @DIALOG_FONTU,
          [GRID_FONTU] = @GRID_FONTU,
          [DIKEY_ZOOM] = @DIKEY_ZOOM,
          [YATAY_ZOOM] = @YATAY_ZOOM,
          [ALIS_FISI_BASLIK_ZEMIN_RENGI] = @ALIS_FISI_BASLIK_ZEMIN_RENGI,
          [ALIS_FISI_BASLIK_YAZI_RENGI] = @ALIS_FISI_BASLIK_YAZI_RENGI,
          [SATIS_FISI_BASLIK_ZEMIN_RENGI] = @SATIS_FISI_BASLIK_ZEMIN_RENGI,
          [SATIS_FISI_BASLIK_YAZI_RENGI] = @SATIS_FISI_BASLIK_YAZI_RENGI,
          [FIS_NO_DEGISTIRME_YETKISI] = @FIS_NO_DEGISTIRME_YETKISI,
          [VEZNE_BAKIYE_KONTROLU] = @VEZNE_BAKIYE_KONTROLU,
          [KOMISYON_ORANI] = @KOMISYON_ORANI,
          [HAREKET_TIPI_VAR] = @HAREKET_TIPI_VAR,
          [HAREKET_TIPI] = @HAREKET_TIPI,
          [CARI_BAKIYE_GOREBILIR] = @CARI_BAKIYE_GOREBILIR,
          [ACIK_VADELI_ISLEM_GOREBILIR] = @ACIK_VADELI_ISLEM_GOREBILIR,
          [FIS_BANKA_HESABI_SECME_YETKISI] = @FIS_BANKA_HESABI_SECME_YETKISI,
          [FIS_TUTAR_DEGISTIRME_YETKISI] = @FIS_TUTAR_DEGISTIRME_YETKISI,
          [FIS_GOSTERME_GUN_SAYISI] = @FIS_GOSTERME_GUN_SAYISI,
          [KONSOLIDE_RAPORLAR_YETKISI] = @KONSOLIDE_RAPORLAR_YETKISI,
          [ALIS_ISTATISTIK_ID] = @ALIS_ISTATISTIK_ID,
          [SATIS_ISTATISTIK_ID] = @SATIS_ISTATISTIK_ID,
          [ARBITRAJ_ALIS_ISTATISTIK_ID] = @ARBITRAJ_ALIS_ISTATISTIK_ID,
          [ARBITRAJ_SATIS_ISTATISTIK_ID] = @ARBITRAJ_SATIS_ISTATISTIK_ID,
          [ENTEGRATOR_KULLANICI_ADI] = @ENTEGRATOR_KULLANICI_ADI,
          [ENTEGRATOR_KULLANICI_SIFRESI] = @ENTEGRATOR_KULLANICI_SIFRESI,
          [E_BELGE_KULLANILIYOR] = @E_BELGE_KULLANILIYOR,
          [MASAK_KULLANICI_ADI] = @MASAK_KULLANICI_ADI,
          [MASAK_KULLANICI_SIFRESI] = @MASAK_KULLANICI_SIFRESI,
          [MASAK_UYARISI_VERSIN] = @MASAK_UYARISI_VERSIN,
          [SUPHELI_ISLEMLER_YETKILISI] = @SUPHELI_ISLEMLER_YETKILISI,
          [SAPMA_UYARISI_VERILMESIN] = @SAPMA_UYARISI_VERILMESIN,
          [GISE_KURU_DISINDA_OLABILIR] = @GISE_KURU_DISINDA_OLABILIR,
          [CAPRAZ_KUR_KONTROLU_YOK] = @CAPRAZ_KUR_KONTROLU_YOK
        WHERE [KULLANICI_ID] = @userId;

        SELECT TOP 1 * FROM [dbo].[TODVZ_KULLANICI] WHERE [KULLANICI_ID] = @userId;
      `;
            const result = await request.query(updateQuery);
            if (!result.recordset || result.recordset.length === 0) {
                return null;
            }
            return UserSqlRepository.mapEntityToModel(result.recordset[0]);
        }
        catch (error) {
            logger.error(`UserSqlRepository.update(${id}) error:`, error);
            throw error;
        }
    }
    /**
     * Directly updates appearance colors and fonts for a user in [dbo].[TODVZ_KULLANICI]
     */
    static async updateAppearance(id, appearance, dbContext) {
        try {
            const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
            const request = pool.request();
            request.input("userId", sql.Int, toInt(id));
            request.input("PROGRAM_ZEMIN_RENGI", sql.Int, colorToDb(appearance?.programBgColor, 16316664));
            request.input("PROGRAM_YAZI_RENGI", sql.Int, colorToDb(appearance?.programTextColor, 0));
            request.input("PROGRAM_GRID_BASLIK_RENGI", sql.Int, colorToDb(appearance?.gridHeaderBgColor, 16768459));
            request.input("PROGRAM_GRID_ZEMIN_RENGI", sql.Int, colorToDb(appearance?.gridBgColor, 16777215));
            request.input("PROGRAM_PENCERE_ZEMIN_RENGI", sql.Int, colorToDb(appearance?.windowBgColor, 16777215));
            request.input("PROGRAM_PENCERE_YAZI_RENGI", sql.Int, colorToDb(appearance?.windowTextColor, 0));
            request.input("PROGRAM_PENCERE_FOKUS_RENGI", sql.Int, colorToDb(appearance?.windowFocusColor, 15724527));
            request.input("MENU_ARKA_PLAN_RENGI", sql.Int, colorToDb(appearance?.menuBgColor || appearance?.menuBackdropColor, 16744575));
            request.input("DIALOG_FONTU", sql.VarChar(200), (appearance?.programFont || "Segoe UI, sans-serif").slice(0, 200));
            request.input("GRID_FONTU", sql.VarChar(200), (appearance?.gridFont || "Segoe UI, sans-serif").slice(0, 200));
            request.input("MENU_FONTU", sql.VarChar(200), encodeMenuFont(appearance?.menuFont, appearance?.menuSelectedBgColor).slice(0, 200));
            request.input("MENU_BASLIK_FONTU", sql.VarChar(200), encodeMenuHeaderFont(appearance?.menuHeaderFont, appearance?.menuHeaderBgColor).slice(0, 200));
            request.input("ALIS_FISI_BASLIK_ZEMIN_RENGI", sql.Int, colorToDb(appearance?.buyHeaderBgColor, 14803424));
            request.input("ALIS_FISI_BASLIK_YAZI_RENGI", sql.Int, colorToDb(appearance?.buyHeaderTextColor, 0));
            request.input("SATIS_FISI_BASLIK_ZEMIN_RENGI", sql.Int, colorToDb(appearance?.sellHeaderBgColor, 14803424));
            request.input("SATIS_FISI_BASLIK_YAZI_RENGI", sql.Int, colorToDb(appearance?.sellHeaderTextColor, 0));
            const query = `
        UPDATE [dbo].[TODVZ_KULLANICI]
        SET 
          [PROGRAM_ZEMIN_RENGI] = @PROGRAM_ZEMIN_RENGI,
          [PROGRAM_YAZI_RENGI] = @PROGRAM_YAZI_RENGI,
          [PROGRAM_GRID_BASLIK_RENGI] = @PROGRAM_GRID_BASLIK_RENGI,
          [PROGRAM_GRID_ZEMIN_RENGI] = @PROGRAM_GRID_ZEMIN_RENGI,
          [PROGRAM_PENCERE_ZEMIN_RENGI] = @PROGRAM_PENCERE_ZEMIN_RENGI,
          [PROGRAM_PENCERE_YAZI_RENGI] = @PROGRAM_PENCERE_YAZI_RENGI,
          [PROGRAM_PENCERE_FOKUS_RENGI] = @PROGRAM_PENCERE_FOKUS_RENGI,
          [MENU_ARKA_PLAN_RENGI] = @MENU_ARKA_PLAN_RENGI,
          [DIALOG_FONTU] = @DIALOG_FONTU,
          [GRID_FONTU] = @GRID_FONTU,
          [MENU_FONTU] = @MENU_FONTU,
          [MENU_BASLIK_FONTU] = @MENU_BASLIK_FONTU,
          [ALIS_FISI_BASLIK_ZEMIN_RENGI] = @ALIS_FISI_BASLIK_ZEMIN_RENGI,
          [ALIS_FISI_BASLIK_YAZI_RENGI] = @ALIS_FISI_BASLIK_YAZI_RENGI,
          [SATIS_FISI_BASLIK_ZEMIN_RENGI] = @SATIS_FISI_BASLIK_ZEMIN_RENGI,
          [SATIS_FISI_BASLIK_YAZI_RENGI] = @SATIS_FISI_BASLIK_YAZI_RENGI
        WHERE [KULLANICI_ID] = @userId;

        SELECT TOP 1 * FROM [dbo].[TODVZ_KULLANICI] WHERE [KULLANICI_ID] = @userId;
      `;
            const result = await request.query(query);
            if (!result.recordset || result.recordset.length === 0) {
                return null;
            }
            return UserSqlRepository.mapEntityToModel(result.recordset[0]);
        }
        catch (error) {
            logger.error(`UserSqlRepository.updateAppearance(${id}) error:`, error);
            throw error;
        }
    }
    /**
     * Deletes a user by ID using parameterized query in the target database
     */
    static async delete(id, dbContext) {
        try {
            const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
            const request = pool.request();
            request.input("userId", sql.Int, toInt(id));
            const result = await request.query(`
        DELETE FROM [dbo].[TODVZ_KULLANICI]
        WHERE [KULLANICI_ID] = @userId
      `);
            return (result.rowsAffected && result.rowsAffected[0] > 0) || false;
        }
        catch (error) {
            logger.error(`UserSqlRepository.delete(${id}) error:`, error);
            throw error;
        }
    }
    /**
     * Converts a UserModel into safe UserResponseDto
     */
    static toDto(user) {
        const { password, passwordHash, ...safeUser } = user;
        return safeUser;
    }
}
