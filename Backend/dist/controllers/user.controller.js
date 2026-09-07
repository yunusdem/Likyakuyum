import { UserService } from "../services/user.service.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ResponseMessages } from "../constants/responseMessages.js";
import { HttpStatus } from "../constants/httpStatusCodes.js";
export class UserController {
    static listUsers = asyncHandler(async (req, res) => {
        const dbContext = { dbServer: req.user?.dbServer, dbName: req.user?.dbName };
        const { users, total } = await UserService.listUsers(req.query, dbContext);
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
        const user = await UserService.getUserById(req.params.id, dbContext);
        return ApiResponse.ok(res, ResponseMessages.USER_FETCHED, user);
    });
    static createUser = asyncHandler(async (req, res) => {
        const dbContext = { dbServer: req.user?.dbServer, dbName: req.user?.dbName };
        const newUser = await UserService.createUser(req.body, dbContext);
        return ApiResponse.send(res, HttpStatus.CREATED, ResponseMessages.USER_CREATED, newUser);
    });
    static updateUser = asyncHandler(async (req, res) => {
        const dbContext = { dbServer: req.user?.dbServer, dbName: req.user?.dbName };
        const updatedUser = await UserService.updateUser(req.params.id, req.body, dbContext);
        return ApiResponse.ok(res, ResponseMessages.USER_UPDATED, updatedUser);
    });
    static deleteUser = asyncHandler(async (req, res) => {
        const dbContext = { dbServer: req.user?.dbServer, dbName: req.user?.dbName };
        await UserService.deleteUser(req.params.id, dbContext);
        return ApiResponse.ok(res, ResponseMessages.USER_DELETED);
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
