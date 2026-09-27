import { UserSqlRepository } from "../models/userSql.repository.js";
import { ApiError } from "../utils/ApiError.js";
import { comparePassword, hashPassword } from "../utils/password.utils.js";
import { generateAuthTokens, verifyRefreshToken } from "../utils/token.utils.js";
import { ResponseMessages } from "../constants/responseMessages.js";
import { setDbCredentials } from "../config/mssql.config.js";
import { MerkezGirisService } from "./merkezGiris.service.js";
import { ESKI_SIFRE_ISARETI } from "../types/admin.types.js";
import { sifreDogrula } from "../utils/sifre.utils.js";
import { OturumService } from "./oturum.service.js";
export class AuthService {
    /**
     * Müşteri no ile giriş (docs/GIRIS_VE_EBELGE_DUZENLEME.md G2-G7): firma, müşteri no + seçilen firmaId ile merkezde
     * bulunur; veritabanı bağlantısı firma kaydından sunucuda çözülür. Kullanıcı ve şifre merkezde (ADM_KULLANICI)
     * doğrulanır: kullanıcı o veritabanının firmasında tanımlı değilse giremez.
     */
    static async login(input, istemci = { ip: "", tarayici: "" }) {
        const firma = await MerkezGirisService.musteriFirmaKontrol(input.musteriNo, input.firmaId, input.username, istemci);
        const b = await MerkezGirisService.firmaBaglantisi(firma.firmaId);
        await MerkezGirisService.havuzDogrula(b.dbServer, b.dbName, b.dbUser, b.dbSifre);
        setDbCredentials(b.dbServer, b.dbName, b.dbUser, b.dbSifre);
        const dbContext = { dbServer: b.dbServer, dbName: b.dbName };
        const user = await UserSqlRepository.findByUsername(input.username, dbContext);
        const kullanici = await MerkezGirisService.kullaniciDogrula(firma, input.username, input.password, user?.passwordHash || user?.password || null, istemci);
        if (!user) {
            throw ApiError.unauthorized("Kullanıcı firma veritabanında bulunamadı. Lütfen hizmet sağlayıcınızla iletişime geçiniz.");
        }
        const sid = await OturumService.ac(kullanici.kullaniciId, firma.firmaId, istemci);
        return this.oturumAc(user, { ...dbContext, firmaId: firma.firmaId }, await MerkezGirisService.oturumBilgisi({ firma, kullanici }), sid);
    }
    /** Giriş ekranı: müşteri noya bağlı veritabanları. */
    static musteriVeritabanlari(musteriNo) {
        return MerkezGirisService.musteriVeritabanlari(musteriNo);
    }
    static oturumAc(user, dbContext, merkez, sid) {
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
            if (decoded.firmaId) {
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
        }
        catch (error) {
            throw ApiError.unauthorized("Oturum yenileme başarısız. Lütfen tekrar giriş yapınız.");
        }
    }
    static async logout(userId, sid) {
        // JWT durumsuzdur; merkez açıksa oturum kaydı kapatılır ve token bir daha kabul edilmez
        await OturumService.bitir(sid);
    }
    static async getProfile(userId, dbContext) {
        const user = await UserSqlRepository.findById(userId, dbContext);
        if (!user) {
            throw ApiError.notFound(ResponseMessages.USER_NOT_FOUND);
        }
        // Merkez açıksa: firma dondurulmuş/pasif/lisansı bitmiş ya da kullanıcı kapatılmışsa 401 → istemci girişe döner
        const baglam = await MerkezGirisService.baglam({ ...dbContext, username: user.username });
        return { ...UserSqlRepository.toDto(user), ...(baglam && { merkez: await MerkezGirisService.oturumBilgisi(baglam) }) };
    }
    /**
     * Kullanıcının kendi şifresini değiştirmesi. Merkez açıksa şifre merkezde (bcrypt) doğrulanır ve yazılır,
     * ilk girişteki zorunlu değişim de buradan geçer; kapalıysa yalnızca firma veritabanındaki alan güncellenir.
     */
    static async changePassword(oturum, girdi) {
        const dbContext = { dbServer: oturum.dbServer, dbName: oturum.dbName };
        const user = await UserSqlRepository.findById(oturum.userId, dbContext);
        if (!user)
            throw ApiError.notFound(ResponseMessages.USER_NOT_FOUND);
        MerkezGirisService.sifreKuraliniDenetle(girdi.newPassword);
        if (girdi.newPassword === girdi.currentPassword) {
            throw ApiError.badRequest("Yeni şifre mevcut şifreyle aynı olamaz.");
        }
        const baglam = await MerkezGirisService.baglam({ ...dbContext, username: user.username });
        const mevcutDogru = baglam && baglam.kullanici.sifreHash !== ESKI_SIFRE_ISARETI
            ? await sifreDogrula(girdi.currentPassword, baglam.kullanici.sifreHash)
            : await comparePassword(girdi.currentPassword, user.passwordHash || user.password || "");
        if (!mevcutDogru)
            throw ApiError.badRequest("Mevcut şifre hatalı.");
        const ozet = baglam
            ? await MerkezGirisService.sifreYaz(baglam.kullanici.kullaniciId, girdi.newPassword, false)
            : await hashPassword(girdi.newPassword);
        await UserSqlRepository.updatePassword(user.id, ozet, dbContext);
        OturumService.onbellegiTemizle(); // "şifre değişmeli" kilidi hemen kalksın
    }
}
