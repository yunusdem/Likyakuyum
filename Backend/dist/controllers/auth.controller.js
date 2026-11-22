import { AuthService } from "../services/auth.service.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ResponseMessages } from "../constants/responseMessages.js";
import { HttpStatus } from "../constants/httpStatusCodes.js";
import { env } from "../config/env.config.js";
import { istemciIp, istemciTarayici } from "../utils/istemci.utils.js";
import { kullaniciYetkisi, yetkiGerekli } from "../services/yetki/kullaniciYetkisi.js";
export class AuthController {
    static login = asyncHandler(async (req, res) => {
        const result = await AuthService.login(req.body, { ip: istemciIp(req), tarayici: istemciTarayici(req) });
        // Set HTTP-only refresh token cookie for security
        res.cookie("refreshToken", result.tokens.refreshToken, {
            httpOnly: true,
            secure: env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });
        return ApiResponse.ok(res, ResponseMessages.LOGIN_SUCCESS, result);
    });
    static musteriVeritabanlari = asyncHandler(async (req, res) => {
        const liste = await AuthService.musteriVeritabanlari(String(req.query.musteriNo || ""));
        return ApiResponse.ok(res, "Veritabanları listelendi.", liste);
    });
    static register = asyncHandler(async (req, res) => {
        const result = await AuthService.register(req.body);
        res.cookie("refreshToken", result.tokens.refreshToken, {
            httpOnly: true,
            secure: env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        return ApiResponse.send(res, HttpStatus.CREATED, ResponseMessages.REGISTER_SUCCESS, result);
    });
    static refreshToken = asyncHandler(async (req, res) => {
        const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;
        const tokens = await AuthService.refreshToken({ refreshToken });
        res.cookie("refreshToken", tokens.refreshToken, {
            httpOnly: true,
            secure: env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        return ApiResponse.ok(res, ResponseMessages.TOKEN_REFRESH_SUCCESS, tokens);
    });
    static logout = asyncHandler(async (req, res) => {
        if (req.user?.userId) {
            await AuthService.logout(req.user.userId, req.user.sid);
        }
        res.clearCookie("refreshToken");
        return ApiResponse.ok(res, ResponseMessages.LOGOUT_SUCCESS);
    });
    static getMe = asyncHandler(async (req, res) => {
        const dbContext = {
            dbServer: req.user?.dbServer,
            dbName: req.user?.dbName,
            firmaId: req.user?.firmaId,
            username: req.user?.username,
        };
        const user = await AuthService.getProfile(req.user.userId, dbContext);
        return ApiResponse.ok(res, "Profil bilgisi başarıyla getirildi.", user);
    });
    /** Alan değiştirme listesi: yetkisiz kullanıcıya yalnız bulunulan alan (sağ üst rozet ve sekme başlığı için) */
    static alanlar = asyncHandler(async (req, res) => {
        const yetkili = env.KURULUM_MODU ? false : await kullaniciYetkisi(req).then((y) => y.calismaAlani).catch(() => false);
        const sonuc = await AuthService.alanlar({ firmaId: req.user?.firmaId, dbName: req.user?.dbName, username: req.user.username }, yetkili);
        return ApiResponse.ok(res, "Alanlar listelendi.", sonuc);
    });
    /** Alan değiştirme: aynı müşteri noya bağlı başka veritabanına şifresiz geçiş; yanıt ve çerez girişle aynı */
    static alanDegistir = asyncHandler(async (req, res) => {
        await yetkiGerekli(req, (y) => y.calismaAlani, "Alan değiştirmek için kullanıcı kartınızda 'Çalışma alanı işlemleri yetkisi' olmalıdır.");
        const result = await AuthService.alanDegistir(req.user, Number(req.body.firmaId), {
            ip: istemciIp(req),
            tarayici: istemciTarayici(req),
        });
        res.cookie("refreshToken", result.tokens.refreshToken, {
            httpOnly: true,
            secure: env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        return ApiResponse.ok(res, "Alan değiştirildi.", result);
    });
    static changePassword = asyncHandler(async (req, res) => {
        const tokens = await AuthService.changePassword({ userId: req.user.userId, dbServer: req.user?.dbServer, dbName: req.user?.dbName }, req.body);
        // Kurulumda eski jeton şifre damgası yüzünden düşer; istemci yenisini saklar
        return ApiResponse.ok(res, "Şifreniz değiştirildi.", tokens ? { tokens } : undefined);
    });
}
