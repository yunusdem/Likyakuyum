import { UserSqlRepository } from "../models/userSql.repository.js";
import { ApiError } from "../utils/ApiError.js";
import { comparePassword } from "../utils/password.utils.js";
import { generateAuthTokens, verifyRefreshToken } from "../utils/token.utils.js";
import { LoginInput, RegisterInput, RefreshTokenInput } from "../schemas/auth.schema.js";
import { AuthResponseData, TokenPair } from "../types/auth.types.js";
import { UserResponseDto } from "../types/user.types.js";
import { ResponseMessages } from "../constants/responseMessages.js";
import { setDbCredentials } from "../config/mssql.config.js";
import { env } from "../config/env.config.js";

export class AuthService {
  public static async login(input: LoginInput): Promise<AuthResponseData> {
    const mode = input.mode === "local" ? "local" : "cloud";
    let targetServer = "";
    let targetDb = "";
    let targetDbUser = "";
    let targetDbPassword = "";

    const rawServer = (
      input.dbServer ||
      (input as any).server ||
      (input as any).serverName ||
      (input as any).host ||
      ""
    ).trim();
    const rawDb = (input.dbName || (input as any).database || "").trim();
    const rawDbUser = (input.dbUser || (input as any).user || "").trim();
    const rawDbPassword =
      input.dbPassword !== undefined && input.dbPassword !== null
        ? input.dbPassword
        : ((input as any).passwordDb !== undefined && (input as any).passwordDb !== null
            ? (input as any).passwordDb
            : "");

    if (mode === "cloud") {
      // Bulut Modu: Formdan gelen sunucu/vt/kullanıcı/şifre varsa kullanılır, boşsa .env merkezi ayarları kullanılır
      targetServer = rawServer && rawServer !== "test" ? rawServer : (env.DB_SERVER || "127.0.0.1");
      targetDb = rawDb || env.DB_NAME || "R2016_dvz";
      targetDbUser = rawDbUser || env.DB_USER || "SA";
      targetDbPassword =
        rawDbPassword !== "" && rawDbPassword !== null && rawDbPassword !== undefined
          ? rawDbPassword
          : (env.DB_PASSWORD || "");
    } else {
      // Yerel Mod (Müşteri Dükkan SQL Server): Müşterinin statik IP/tünel adresi ve bağlantı bilgileri
      if (!rawServer) {
        throw ApiError.badRequest(
          "Yerel veritabanı modu için lütfen sunucu IP adresini (örn: 88.245.x.x,1433) giriniz."
        );
      }

      targetServer = rawServer;
      targetDb = rawDb || "R2016_dvz";
      targetDbUser = rawDbUser || "sa";
      targetDbPassword = rawDbPassword;
    }

    // Dinamik bağlantı havuzuna hedef sunucu kimlik bilgilerini kaydet
    setDbCredentials(targetServer, targetDb, targetDbUser, targetDbPassword);

    const dbContext = {
      dbServer: targetServer,
      dbName: targetDb,
      dbUser: targetDbUser,
      dbPassword: targetDbPassword,
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
    } else if (user.passwordHash) {
      try {
        isPasswordValid = await comparePassword(input.password, user.passwordHash);
      } catch (err) {
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


  public static async register(input: RegisterInput): Promise<AuthResponseData> {
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

  public static async refreshToken(input: RefreshTokenInput): Promise<TokenPair> {
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
    } catch (error) {
      throw ApiError.unauthorized("Oturum yenileme başarısız. Lütfen tekrar giriş yapınız.");
    }
  }

  public static async logout(userId: string): Promise<void> {
    // Stateless JWT token handling
  }

  public static async getProfile(userId: string, dbContext?: { dbServer?: string; dbName?: string }): Promise<UserResponseDto> {
    const user = await UserSqlRepository.findById(userId, dbContext);
    if (!user) {
      throw ApiError.notFound(ResponseMessages.USER_NOT_FOUND);
    }
    return UserSqlRepository.toDto(user);
  }
}


