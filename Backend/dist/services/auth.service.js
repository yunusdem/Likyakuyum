import { UserSqlRepository } from "../models/userSql.repository.js";
import { ApiError } from "../utils/ApiError.js";
import { comparePassword } from "../utils/password.utils.js";
import { generateAuthTokens, verifyRefreshToken } from "../utils/token.utils.js";
import { ResponseMessages } from "../constants/responseMessages.js";
import { setDbCredentials } from "../config/mssql.config.js";
import { env } from "../config/env.config.js";
export class AuthService {
    static async login(input) {
        const rawServer = (input.dbServer || input.server || input.serverName || input.host || "").trim();
        const rawDb = (input.dbName || input.database || "").trim();
        const rawDbUser = (input.dbUser || input.user || "").trim() || "SA";
        const rawDbPassword = input.dbPassword !== undefined && input.dbPassword !== null
            ? input.dbPassword
            : (input.passwordDb !== undefined && input.passwordDb !== null ? input.passwordDb : "");
        if (!rawServer) {
            throw ApiError.badRequest("Lütfen sunucu adını seçiniz veya giriniz.");
        }
        if (!rawDb) {
            throw ApiError.badRequest("Lütfen veritabanı adını seçiniz veya giriniz.");
        }
        if (!rawDbUser) {
            throw ApiError.badRequest("Lütfen veritabanı kullanıcı adını giriniz.");
        }
        // Windows Server ortamında Node.js'in SQL Server'a bağlanabilmesi için localhost -> 127.0.0.1 fallback
        const cleanServer = rawServer.toLowerCase() === "localhost" ? "127.0.0.1" : rawServer;
        const cleanDb = rawDb;
        const cleanDbUser = rawDbUser;
        const cleanDbPassword = rawDbPassword !== null && rawDbPassword !== undefined && String(rawDbPassword).trim() !== ""
            ? rawDbPassword
            : (env.DB_PASSWORD || "");
        // Dinamik olarak MSSQL havuzuna kullanıcının login ekranından girdiği bilgileri kaydet
        setDbCredentials(cleanServer, cleanDb, cleanDbUser, cleanDbPassword);
        if (rawServer !== cleanServer) {
            setDbCredentials(rawServer, cleanDb, cleanDbUser, cleanDbPassword);
        }
        const dbContext = {
            dbServer: cleanServer,
            dbName: cleanDb,
            dbUser: cleanDbUser,
            dbPassword: cleanDbPassword,
        };
        const user = await UserSqlRepository.findByUsername(input.username, dbContext);
        if (!user) {
            throw ApiError.unauthorized(ResponseMessages.INVALID_CREDENTIALS);
        }
        if (!user.isActive) {
            throw ApiError.forbidden("Kullanıcı hesabı pasif durumdadır. Lütfen sistem yöneticisi ile iletişime geçiniz.");
        }
        // Support both plaintext and bcrypt/HMAC hashed passwords from TODVZ_KULLANICI
        let isPasswordValid = false;
        if (user.password && user.password === input.password) {
            isPasswordValid = true;
        }
        else if (user.passwordHash) {
            try {
                isPasswordValid = await comparePassword(input.password, user.passwordHash);
            }
            catch (err) {
                isPasswordValid = user.passwordHash === input.password;
            }
        }
        if (!isPasswordValid) {
            throw ApiError.unauthorized(ResponseMessages.INVALID_CREDENTIALS);
        }
        const tokens = generateAuthTokens({
            userId: user.id,
            username: user.username,
            role: user.role,
            cashierCode: user.cashierCode,
            dbServer: dbContext.dbServer,
            dbName: dbContext.dbName,
            dbUser: dbContext.dbUser,
            dbPassword: dbContext.dbPassword,
        });
        return {
            user: UserSqlRepository.toDto(user),
            tokens,
        };
    }
    static async register(input) {
        const existingUser = await UserSqlRepository.findByUsername(input.username);
        if (existingUser) {
            throw ApiError.conflict(`'${input.username}' kullanıcı adı zaten kullanılıyor.`);
        }
        const newUser = await UserSqlRepository.create({
            username: input.username,
            fullName: input.fullName || input.username,
            email: input.email || undefined,
            password: input.password,
            passwordHash: input.password,
            role: input.role,
            cashierCode: input.cashierCode,
            isActive: true,
            isSysAdmin: input.role === "admin",
            displayDays: 0,
            hasWorkspacePerm: true,
            hasDateChangePerm: false,
            hasCommissionPerm: false,
            hasSlipNoChangePerm: false,
            hasCashDeskBalanceCheck: false,
            canViewAccountBalance: true,
            canViewOpenTermTrans: false,
            hasSlipBankAccountPerm: false,
            hasSlipAmountChangePerm: false,
            isSuspiciousTransAuth: false,
            noCrossRateCheck: false,
            printerId: "1",
            horizontalZoom: 0,
            verticalZoom: 0,
            hasCommissionRate: false,
            commissionRate: 0,
            ratePermType: "Var",
            ratePermValue: 0,
            menuPerms: {
                mainMenu: "Tam Yetki",
                cashier: "Tam Yetki",
                safe: "Tam Yetki",
                exchange: "Tam Yetki",
                accounts: "Tam Yetki",
                admin: input.role === "admin" ? "Tam Yetki" : "Yetki Yok",
                accounting: input.role === "admin" ? "Tam Yetki" : "Yetki Yok",
                reports: "Tam Yetki",
                consolidatedReports: input.role === "admin" ? "Tam Yetki" : "Yetki Yok",
                techOps: input.role === "admin" ? "Tam Yetki" : "Yetki Yok",
                movementType: "Tam Yetki",
            },
            buyStatCode: "",
            sellStatCode: "",
            arbitrageBuyStatCode: "",
            arbitrageSellStatCode: "",
            appearance: {
                enableProgramTheme: true,
                programBgColor: "#f8fafc",
                programTextColor: "#0f172a",
                programFont: "Segoe UI, sans-serif",
                gridHeaderBgColor: "#cbe5ff",
                gridBgColor: "#ffffff",
                gridFont: "Segoe UI, sans-serif",
                windowBgColor: "#ffffff",
                windowTextColor: "#000000",
                windowFocusColor: "#e2e8f0",
                enableMenuTheme: true,
                menuBgColor: "#bfe0ff",
                menuSelectedBgColor: "#ff80ff",
                menuFont: "Segoe UI, sans-serif",
                menuHeaderBgColor: "#000080",
                menuHeaderFont: "Segoe UI, sans-serif",
                menuBackdropColor: "#ff8080",
                enableBuyHeaderTheme: false,
                buyHeaderBgColor: "#e2e8f0",
                buyHeaderTextColor: "#000000",
                enableSellHeaderTheme: false,
                sellHeaderBgColor: "#e2e8f0",
                sellHeaderTextColor: "#000000",
            },
        });
        const tokens = generateAuthTokens({
            userId: newUser.id,
            username: newUser.username,
            role: newUser.role,
            cashierCode: newUser.cashierCode,
        });
        return {
            user: UserSqlRepository.toDto(newUser),
            tokens,
        };
    }
    static async refreshToken(input) {
        try {
            const decoded = verifyRefreshToken(input.refreshToken);
            const dbContext = { dbServer: decoded.dbServer, dbName: decoded.dbName };
            const user = await UserSqlRepository.findById(decoded.userId, dbContext);
            if (!user || !user.isActive) {
                throw ApiError.unauthorized("Geçersiz veya iptal edilmiş oturum tokenı.");
            }
            const newTokens = generateAuthTokens({
                userId: user.id,
                username: user.username,
                role: user.role,
                cashierCode: user.cashierCode,
                dbServer: decoded.dbServer,
                dbName: decoded.dbName,
            });
            return newTokens;
        }
        catch (error) {
            throw ApiError.unauthorized("Oturum yenileme başarısız. Lütfen tekrar giriş yapınız.");
        }
    }
    static async logout(userId) {
        // Stateless JWT token handling
    }
    static async getProfile(userId, dbContext) {
        const user = await UserSqlRepository.findById(userId, dbContext);
        if (!user) {
            throw ApiError.notFound(ResponseMessages.USER_NOT_FOUND);
        }
        return UserSqlRepository.toDto(user);
    }
}
