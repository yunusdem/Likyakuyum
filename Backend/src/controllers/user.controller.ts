import { Request, Response } from "express";
import { UserService } from "../services/user.service.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ResponseMessages } from "../constants/responseMessages.js";
import { HttpStatus } from "../constants/httpStatusCodes.js";
import { FirmaKullaniciMerkezService } from "../services/firmaKullaniciMerkez.service.js";

export class UserController {
  public static listUsers = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = { dbServer: req.user?.dbServer, dbName: req.user?.dbName };
    const { users, total } = await UserService.listUsers(req.query as any, dbContext);
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

    return ApiResponse.ok(res, ResponseMessages.USERS_FETCHED, users, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  });

  public static getUserById = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = { dbServer: req.user?.dbServer, dbName: req.user?.dbName };
    const user = await UserService.getUserById(req.params.id, dbContext);
    return ApiResponse.ok(res, ResponseMessages.USER_FETCHED, user);
  });

  public static createUser = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = { dbServer: req.user?.dbServer, dbName: req.user?.dbName };
    // Merkez açıksa (MERKEZ_GIRIS=zorunlu): firma yöneticisi + şifre kuralı + lisans limiti; kapalıysa merkez = null
    const merkez = await FirmaKullaniciMerkezService.baglam(req.user);
    if (merkez) FirmaKullaniciMerkezService.olusturmaOnDenetimi(merkez, req.body);
    const newUser = await UserService.createUser(req.body, dbContext);
    if (merkez) await FirmaKullaniciMerkezService.olusturmaSonrasi(merkez, newUser, req.body.password, dbContext);
    return ApiResponse.send(res, HttpStatus.CREATED, ResponseMessages.USER_CREATED, newUser);
  });

  public static updateUser = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = { dbServer: req.user?.dbServer, dbName: req.user?.dbName };
    const merkez = await FirmaKullaniciMerkezService.baglam(req.user);
    const eskiKullaniciAdi = merkez ? (await UserService.getUserById(req.params.id, dbContext)).username : "";
    if (merkez) FirmaKullaniciMerkezService.guncellemeOnDenetimi(merkez, eskiKullaniciAdi, req.body);
    const updatedUser = await UserService.updateUser(req.params.id, req.body, dbContext);
    if (merkez) {
      await FirmaKullaniciMerkezService.guncellemeSonrasi(merkez, eskiKullaniciAdi, updatedUser, req.body.password || undefined);
    }
    return ApiResponse.ok(res, ResponseMessages.USER_UPDATED, updatedUser);
  });

  public static deleteUser = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = { dbServer: req.user?.dbServer, dbName: req.user?.dbName };
    if (await FirmaKullaniciMerkezService.baglam(req.user)) FirmaKullaniciMerkezService.silmeEngeli();
    await UserService.deleteUser(req.params.id, dbContext);
    return ApiResponse.ok(res, ResponseMessages.USER_DELETED);
  });

  public static sifreSifirla = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = { dbServer: req.user?.dbServer, dbName: req.user?.dbName };
    const sonuc = await FirmaKullaniciMerkezService.sifreSifirla(req.user, req.params.id, dbContext);
    res.setHeader("Cache-Control", "no-store");
    return ApiResponse.ok(res, "Şifre sıfırlandı.", sonuc);
  });

  public static getCashiers = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = { dbServer: req.user?.dbServer, dbName: req.user?.dbName };
    const cashiers = await UserService.getCashiers(dbContext);
    return ApiResponse.ok(res, "Vezneler başarıyla getirildi", cashiers);
  });

  public static updateMyAppearance = asyncHandler(async (req: Request, res: Response) => {
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




