import { UserService } from "../services/user.service.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ResponseMessages } from "../constants/responseMessages.js";
import { HttpStatus } from "../constants/httpStatusCodes.js";
import { FirmaKullaniciMerkezService } from "../services/firmaKullaniciMerkez.service.js";
import { env } from "../config/env.config.js";
import { KurulumLisansService } from "../services/kurulum/kurulumLisans.service.js";
import { MerkezGirisService } from "../services/merkezGiris.service.js";
import { kullaniciYetkisi } from "../services/yetki/kullaniciYetkisi.js";
import { UserSqlRepository } from "../models/userSql.repository.js";
import { hashPassword } from "../utils/password.utils.js";
import { geciciSifreUret } from "../utils/sifre.utils.js";
import { kurulumKartOnbelleginiTemizle } from "../services/kurulum/kurulumKart.js";
import { AuthService } from "../services/auth.service.js";
/**
 * Kullanıcı kartlarını yöneten: merkez açıkken firma yöneticisi, değilse (kurulum / merkez kapalı) sistem yöneticisi.
 * Yönetici olmayan yalnız kendi kartını görür ve onda yalnız kendine ait ayarları değiştirir (yetki, vezne, istatistik,
 * entegratör/MASAK bilgileri yöneticinindir) — yoksa kasiyer kendini sistem yöneticisi yapabiliyor, veznesini değiştirebiliyordu.
 * Sistem yöneticiliği jetondaki rolden değil kullanıcı kartından okunur (fiş yetkileriyle aynı kaynak): yöneticiliği
 * kaldırılan kullanıcı jetonu geçerli kaldıkça kartları yönetebiliyor, kendini yeniden yönetici yapabiliyordu.
 */
const kartYoneticisiMi = async (req, merkez) => merkez ? !!merkez.kullanici.firmaYoneticisi : (await kullaniciYetkisi(req)).yonetici;
const kendisiMi = (req, id) => !!req.user?.userId && String(req.user.userId) === String(id);
const YONETICI_GEREKLI = "Kullanıcı tanımlarını yalnız sistem yöneticisi değiştirebilir.";
/** Yönetici olmayanın kendi kartında değiştirebildiği alanlar */
const KENDI_ALANLARI = ["password", "appearance", "printerId", "horizontalZoom", "verticalZoom"];
const kendiAlanlari = (girdi) => Object.fromEntries(KENDI_ALANLARI.filter((k) => girdi[k] !== undefined).map((k) => [k, girdi[k]]));
export class UserController {
    static listUsers = asyncHandler(async (req, res) => {
        const dbContext = { dbServer: req.user?.dbServer, dbName: req.user?.dbName };
        const sonuc = await UserService.listUsers(req.query, dbContext);
        const yonetici = await kartYoneticisiMi(req, await FirmaKullaniciMerkezService.baglam(req.user));
        const users = yonetici ? sonuc.users : sonuc.users.filter((u) => kendisiMi(req, String(u.id)));
        const total = yonetici ? sonuc.total : users.length;
        const page = req.query.page ? parseInt(req.query.page, 10) : 1;
        const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20;
        return ApiResponse.ok(res, ResponseMessages.USERS_FETCHED, users, {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        });
    });
    static getUserById = asyncHandler(async (req, res) => {
        const dbContext = { dbServer: req.user?.dbServer, dbName: req.user?.dbName };
        if (!kendisiMi(req, req.params.id) && !(await kartYoneticisiMi(req, await FirmaKullaniciMerkezService.baglam(req.user)))) {
            throw ApiError.forbidden(YONETICI_GEREKLI);
        }
        const user = await UserService.getUserById(req.params.id, dbContext);
        return ApiResponse.ok(res, ResponseMessages.USER_FETCHED, user);
    });
    static createUser = asyncHandler(async (req, res) => {
        const dbContext = { dbServer: req.user?.dbServer, dbName: req.user?.dbName };
        // Merkez açıksa (MERKEZ_GIRIS=zorunlu): firma yöneticisi + şifre kuralı + lisans limiti; kapalıysa merkez = null
        const merkez = await FirmaKullaniciMerkezService.baglam(req.user);
        if (merkez)
            FirmaKullaniciMerkezService.olusturmaOnDenetimi(merkez, req.body);
        else if (!(await kartYoneticisiMi(req, null)))
            throw ApiError.forbidden(YONETICI_GEREKLI);
        // Kurulum: şifre kuralı (boş şifreli kart giriş yapamıyor ama limitte yer tutuyordu) ve lisanstaki kullanıcı limiti;
        // limit denetimi ile kayıt sırayla (aynı anda gelen iki istek limiti aşmasın)
        if (env.KURULUM_MODU)
            MerkezGirisService.sifreKuraliniDenetle(String(req.body?.password || ""));
        const ac = async () => {
            if (env.KURULUM_MODU)
                await KurulumLisansService.kullaniciAcilabilirMi();
            const u = await UserService.createUser(req.body, dbContext);
            // Limit içinde programdan açılan kullanıcı izinli sınıra yazılır (lisans düşürülünce de girebilsin, E9)
            if (env.KURULUM_MODU)
                await KurulumLisansService.kullaniciEklendi(Number(u.id)).catch(() => undefined);
            return u;
        };
        const newUser = env.KURULUM_MODU ? await KurulumLisansService.kullaniciKaydiSirasi(ac) : await ac();
        if (merkez)
            await FirmaKullaniciMerkezService.olusturmaSonrasi(merkez, newUser, req.body.password, dbContext);
        return ApiResponse.send(res, HttpStatus.CREATED, ResponseMessages.USER_CREATED, newUser);
    });
    static updateUser = asyncHandler(async (req, res) => {
        const dbContext = { dbServer: req.user?.dbServer, dbName: req.user?.dbName };
        const merkez = await FirmaKullaniciMerkezService.baglam(req.user);
        const yonetici = await kartYoneticisiMi(req, merkez);
        if (!yonetici && !kendisiMi(req, req.params.id))
            throw ApiError.forbidden(YONETICI_GEREKLI);
        const girdi = yonetici ? req.body : kendiAlanlari(req.body || {});
        // Kurulumda kart üzerinden şifre değişiminde de şifre kuralı (yeni kullanıcıda uygulanıyordu, kartta tek harf yazılabiliyordu)
        if (env.KURULUM_MODU && String(girdi.password || "") !== "")
            MerkezGirisService.sifreKuraliniDenetle(String(girdi.password));
        const eskiKullaniciAdi = merkez ? (await UserService.getUserById(req.params.id, dbContext)).username : "";
        if (merkez)
            FirmaKullaniciMerkezService.guncellemeOnDenetimi(merkez, eskiKullaniciAdi, girdi);
        const updatedUser = await UserService.updateUser(req.params.id, girdi, dbContext);
        if (merkez) {
            await FirmaKullaniciMerkezService.guncellemeSonrasi(merkez, eskiKullaniciAdi, updatedUser, girdi.password || undefined);
        }
        // Kurulum: şifre değiştiyse o kullanıcının eski oturumları düşer (şifre damgası); kendi kartıysa bu oturum yeni jetonla sürer
        if (env.KURULUM_MODU && String(girdi.password || "") !== "") {
            kurulumKartOnbelleginiTemizle(req.params.id);
            if (kendisiMi(req, req.params.id)) {
                return ApiResponse.ok(res, ResponseMessages.USER_UPDATED, { ...updatedUser, oturumJetonu: (await AuthService.kurulumJetonu(req.params.id)).accessToken });
            }
        }
        return ApiResponse.ok(res, ResponseMessages.USER_UPDATED, updatedUser);
    });
    static deleteUser = asyncHandler(async (req, res) => {
        const dbContext = { dbServer: req.user?.dbServer, dbName: req.user?.dbName };
        if (await FirmaKullaniciMerkezService.baglam(req.user))
            FirmaKullaniciMerkezService.silmeEngeli();
        if (!(await kartYoneticisiMi(req, null)))
            throw ApiError.forbidden(YONETICI_GEREKLI);
        if (kendisiMi(req, req.params.id))
            throw ApiError.badRequest("Kendi kullanıcı kartınızı silemezsiniz.");
        await UserService.deleteUser(req.params.id, dbContext);
        if (env.KURULUM_MODU)
            kurulumKartOnbelleginiTemizle(req.params.id);
        return ApiResponse.ok(res, ResponseMessages.USER_DELETED);
    });
    static sifreSifirla = asyncHandler(async (req, res) => {
        const dbContext = { dbServer: req.user?.dbServer, dbName: req.user?.dbName };
        res.setHeader("Cache-Control", "no-store");
        if (!(await FirmaKullaniciMerkezService.baglam(req.user))) {
            // Merkez yokken (kurulum / merkez girişi kapalı) geçici şifre yalnız firma veritabanındaki karta yazılır. Kurulumda
            // ekran mevcut kartta şifre kutusu yerine bu düğmeyi gösterir; merkez yolu burada her zaman 400 veriyordu.
            if (!(await kartYoneticisiMi(req, null)))
                throw ApiError.forbidden(YONETICI_GEREKLI);
            if (kendisiMi(req, req.params.id))
                throw ApiError.badRequest("Kendi şifrenizi 'Şifre Değiştir' ekranından değiştirin.");
            const hedef = await UserSqlRepository.findById(req.params.id, dbContext);
            if (!hedef)
                throw ApiError.notFound("Kullanıcı bulunamadı.");
            const geciciSifre = geciciSifreUret();
            await UserSqlRepository.updatePassword(hedef.id, await hashPassword(geciciSifre), dbContext);
            if (env.KURULUM_MODU)
                kurulumKartOnbelleginiTemizle(hedef.id); // eski oturumları düşsün
            return ApiResponse.ok(res, "Şifre sıfırlandı.", { geciciSifre });
        }
        const sonuc = await FirmaKullaniciMerkezService.sifreSifirla(req.user, req.params.id, dbContext);
        return ApiResponse.ok(res, "Şifre sıfırlandı.", sonuc);
    });
    static getCashiers = asyncHandler(async (req, res) => {
        const dbContext = { dbServer: req.user?.dbServer, dbName: req.user?.dbName };
        const cashiers = await UserService.getCashiers(dbContext);
        return ApiResponse.ok(res, "Vezneler başarıyla getirildi", cashiers);
    });
    static updateMyAppearance = asyncHandler(async (req, res) => {
        const userId = req.user?.userId;
        if (!userId) {
            throw ApiError.unauthorized("Giriş yapmış kullanıcı bulunamadı.");
        }
        const dbContext = { dbServer: req.user?.dbServer, dbName: req.user?.dbName };
        const appearance = req.body.appearance || req.body;
        const updated = await UserService.updateAppearance(String(userId), appearance, dbContext);
        return ApiResponse.ok(res, "Görünüm ayarları başarıyla veritabanına kaydedildi.", updated);
    });
}
