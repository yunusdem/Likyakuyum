import { UserSqlRepository } from "../models/userSql.repository.js";
import { ApiError } from "../utils/ApiError.js";
import { comparePassword, hashPassword } from "../utils/password.utils.js";
import { generateAuthTokens, verifyRefreshToken } from "../utils/token.utils.js";
import { LoginInput, RegisterInput, RefreshTokenInput } from "../schemas/auth.schema.js";
import { AuthResponseData, TokenPair } from "../types/auth.types.js";
import { UserModel, UserResponseDto } from "../types/user.types.js";
import { ResponseMessages } from "../constants/responseMessages.js";
import { setDbCredentials } from "../config/mssql.config.js";
import { Istemci, MerkezGirisService } from "./merkezGiris.service.js";
import { ESKI_SIFRE_ISARETI, MerkezOturumBilgisi } from "../types/admin.types.js";
import { sifreDogrula } from "../utils/sifre.utils.js";
import { OturumService } from "./oturum.service.js";
import { env } from "../config/env.config.js";
import { kurulumBaglantisiniKaydet, kurulumDbContext, kurulumHavuzu } from "./kurulum/kurulumDb.js";
import { KurulumLisansService } from "./kurulum/kurulumLisans.service.js";

export class AuthService {
  /**
   * Müşteri no ile giriş (docs/GIRIS_VE_EBELGE_DUZENLEME.md G2-G7): firma, müşteri no + seçilen firmaId ile merkezde
   * bulunur; veritabanı bağlantısı firma kaydından sunucuda çözülür. Kullanıcı ve şifre merkezde (ADM_KULLANICI)
   * doğrulanır: kullanıcı o veritabanının firmasında tanımlı değilse giremez.
   */
  public static async login(input: LoginInput, istemci: Istemci = { ip: "", tarayici: "" }): Promise<AuthResponseData> {
    if (env.KURULUM_MODU) return this.kurulumGiris(input.username, input.password);
    const firma = await MerkezGirisService.musteriFirmaKontrol(input.musteriNo, input.firmaId, input.username, istemci);
    const b = await MerkezGirisService.firmaBaglantisi(firma.firmaId);

    await MerkezGirisService.havuzDogrula(b.dbServer, b.dbName, b.dbUser, b.dbSifre);
    setDbCredentials(b.dbServer, b.dbName, b.dbUser, b.dbSifre);

    const dbContext = { dbServer: b.dbServer, dbName: b.dbName };
    const user = await UserSqlRepository.findByUsername(input.username, dbContext);

    const kullanici = await MerkezGirisService.kullaniciDogrula(
      firma,
      input.username,
      input.password,
      user?.passwordHash || user?.password || null,
      istemci
    );
    if (!user) {
      throw ApiError.unauthorized(
        "Kullanıcı firma veritabanında bulunamadı. Lütfen hizmet sağlayıcınızla iletişime geçiniz."
      );
    }
    const sid = await OturumService.ac(kullanici.kullaniciId, firma.firmaId, istemci);
    return this.oturumAc(
      user,
      { ...dbContext, firmaId: firma.firmaId },
      await MerkezGirisService.oturumBilgisi({ firma, kullanici }),
      sid
    );
  }

  // ----------------------------------------------------------- Kurulum (exe) modu ---

  /** Kurulum modunda oturum bilgisi: firma ve lisans, merkez yerine yerel lisanstan gelir. */
  public static async kurulumOturumBilgisi(user: UserModel): Promise<MerkezOturumBilgisi> {
    const d = await KurulumLisansService.durum();
    const pool = await kurulumHavuzu();
    const sayi = (await pool.request().query(`SELECT COUNT(*) AS N FROM dbo.TODVZ_KULLANICI`)).recordset[0].N as number;
    return {
      firmaKodu: d.firmaKodu || "",
      firmaUnvan: d.firmaUnvan || "",
      firmaYoneticisi: !!user.isSysAdmin,
      sifreDegismeli: false,
      lisansBitis: d.bitis,
      lisansKalanGun: d.kalanGun,
      kullaniciLimiti: d.kullaniciLimiti,
      kullaniciSayisi: sayi,
      moduller: d.moduller,
      urunler: d.urunler ?? [],
      iletisim: d.iletisim,
    };
  }

  /** Kurulum modunda giriş: tek firma veritabanı .env'den; kullanıcı ve şifre firma veritabanındaki TODVZ_KULLANICI. */
  private static async kurulumGiris(username: string, password: string): Promise<AuthResponseData> {
    kurulumBaglantisiniKaydet();
    const dbContext = kurulumDbContext();
    const user = await UserSqlRepository.findByUsername(username, dbContext);
    const dogru = !!user && (await comparePassword(password, user.passwordHash || user.password || ""));
    if (!user || !dogru) throw ApiError.unauthorized(ResponseMessages.INVALID_CREDENTIALS);
    return this.oturumAc(user, { ...dbContext, firmaId: 0 }, await this.kurulumOturumBilgisi(user));
  }

  /** Kurulumun ilk açılışı: hiç kullanıcı yokken ilk yönetici (sistem yöneticisi) açılır; sonra bu uç kapanır. */
  public static async kurulumIlkYonetici(girdi: { username: string; fullName?: string; password: string }): Promise<AuthResponseData> {
    if (!env.KURULUM_MODU) throw ApiError.notFound("Bu işlem yalnız kurulum sürümünde vardır.");
    MerkezGirisService.sifreKuraliniDenetle(girdi.password);
    kurulumBaglantisiniKaydet();
    const pool = await kurulumHavuzu();
    const sayi = (await pool.request().query(`SELECT COUNT(*) AS N FROM dbo.TODVZ_KULLANICI`)).recordset[0].N as number;
    if (sayi > 0) throw ApiError.conflict("İlk yönetici zaten tanımlı. Kullanıcılar programın içinden açılır.");
    const dbContext = kurulumDbContext();
    const { UserService } = await import("./user.service.js");
    const yeni = await UserService.createUser(
      { username: girdi.username, fullName: girdi.fullName || girdi.username, password: girdi.password, isSysAdmin: true, role: "admin" } as any,
      dbContext
    );
    const user = await UserSqlRepository.findById(String(yeni.id), dbContext);
    if (!user) throw ApiError.internal("İlk yönetici oluşturulamadı.");
    return this.oturumAc(user, { ...dbContext, firmaId: 0 }, await this.kurulumOturumBilgisi(user));
  }

  /** Kurulumda henüz kullanıcı yok mu (giriş ekranı "ilk yönetici" formunu buna göre açar). */
  public static async kurulumKullaniciVarMi(): Promise<boolean> {
    kurulumBaglantisiniKaydet();
    const pool = await kurulumHavuzu();
    return ((await pool.request().query(`SELECT COUNT(*) AS N FROM dbo.TODVZ_KULLANICI`)).recordset[0].N as number) > 0;
  }

  /** Giriş ekranı: müşteri noya bağlı veritabanları. */
  public static musteriVeritabanlari(musteriNo: string) {
    return MerkezGirisService.musteriVeritabanlari(musteriNo);
  }

  private static oturumAc(
    user: UserModel,
    dbContext: { dbServer: string; dbName: string; firmaId: number },
    merkez?: MerkezOturumBilgisi,
    sid?: string
  ): AuthResponseData {
    // DB kullanıcı adı / şifresi token'a yazılmaz; authenticate bağlantıyı firmaId'den çözer
    const tokens = generateAuthTokens({
      userId: user.id,
      username: user.username,
      role: user.role,
      cashierCode: user.cashierCode,
      dbServer: dbContext.dbServer,
      dbName: dbContext.dbName,
      firmaId: dbContext.firmaId,
      ...(sid && { sid }),
    });

    return {
      user: { ...UserSqlRepository.toDto(user), ...(merkez && { merkez }) },
      tokens,
      baglanti: { dbServer: dbContext.dbServer, dbName: dbContext.dbName },
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
      if (env.KURULUM_MODU) {
        kurulumBaglantisiniKaydet();
        Object.assign(decoded, kurulumDbContext());
      } else if (decoded.firmaId) {
        const b = await MerkezGirisService.firmaBaglantisi(decoded.firmaId);
        setDbCredentials(b.dbServer, b.dbName, b.dbUser, b.dbSifre);
      }
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
        ...(decoded.firmaId && { firmaId: decoded.firmaId }),
        ...(decoded.sid && { sid: decoded.sid }),
      });

      return newTokens;
    } catch (error) {
      throw ApiError.unauthorized("Oturum yenileme başarısız. Lütfen tekrar giriş yapınız.");
    }
  }

  public static async logout(userId: string, sid?: string): Promise<void> {
    // JWT durumsuzdur; merkez açıksa oturum kaydı kapatılır ve token bir daha kabul edilmez
    await OturumService.bitir(sid);
  }

  public static async getProfile(userId: string, dbContext?: { dbServer?: string; dbName?: string }): Promise<UserResponseDto> {
    const user = await UserSqlRepository.findById(userId, dbContext);
    if (!user) {
      throw ApiError.notFound(ResponseMessages.USER_NOT_FOUND);
    }
    if (env.KURULUM_MODU) return { ...UserSqlRepository.toDto(user), merkez: await this.kurulumOturumBilgisi(user) } as any;
    // Merkez açıksa: firma dondurulmuş/pasif/lisansı bitmiş ya da kullanıcı kapatılmışsa 401 → istemci girişe döner
    const baglam = await MerkezGirisService.baglam({ ...dbContext, username: user.username });
    return { ...UserSqlRepository.toDto(user), ...(baglam && { merkez: await MerkezGirisService.oturumBilgisi(baglam) }) };
  }

  /**
   * Kullanıcının kendi şifresini değiştirmesi. Merkez açıksa şifre merkezde (bcrypt) doğrulanır ve yazılır,
   * ilk girişteki zorunlu değişim de buradan geçer; kapalıysa yalnızca firma veritabanındaki alan güncellenir.
   */
  public static async changePassword(
    oturum: { userId: string; dbServer?: string; dbName?: string },
    girdi: { currentPassword: string; newPassword: string }
  ): Promise<void> {
    const dbContext = { dbServer: oturum.dbServer, dbName: oturum.dbName };
    const user = await UserSqlRepository.findById(oturum.userId, dbContext);
    if (!user) throw ApiError.notFound(ResponseMessages.USER_NOT_FOUND);

    MerkezGirisService.sifreKuraliniDenetle(girdi.newPassword);
    if (girdi.newPassword === girdi.currentPassword) {
      throw ApiError.badRequest("Yeni şifre mevcut şifreyle aynı olamaz.");
    }

    const baglam = await MerkezGirisService.baglam({ ...dbContext, username: user.username });
    const mevcutDogru =
      baglam && baglam.kullanici.sifreHash !== ESKI_SIFRE_ISARETI
        ? await sifreDogrula(girdi.currentPassword, baglam.kullanici.sifreHash)
        : await comparePassword(girdi.currentPassword, user.passwordHash || user.password || "");
    if (!mevcutDogru) throw ApiError.badRequest("Mevcut şifre hatalı.");

    const ozet = baglam
      ? await MerkezGirisService.sifreYaz(baglam.kullanici.kullaniciId, girdi.newPassword, false)
      : await hashPassword(girdi.newPassword);
    await UserSqlRepository.updatePassword(user.id, ozet, dbContext);
    OturumService.onbellegiTemizle(); // "şifre değişmeli" kilidi hemen kalksın
  }
}


