import { Request, Response } from "express";
import { AuthService } from "../services/auth.service.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ResponseMessages } from "../constants/responseMessages.js";
import { HttpStatus } from "../constants/httpStatusCodes.js";
import { env } from "../config/env.config.js";

export class AuthController {
  public static login = asyncHandler(async (req: Request, res: Response) => {
    const result = await AuthService.login(req.body);

    // Set HTTP-only refresh token cookie for security
    res.cookie("refreshToken", result.tokens.refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return ApiResponse.ok(res, ResponseMessages.LOGIN_SUCCESS, result);
  });

  public static register = asyncHandler(async (req: Request, res: Response) => {
    const result = await AuthService.register(req.body);

    res.cookie("refreshToken", result.tokens.refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return ApiResponse.send(res, HttpStatus.CREATED, ResponseMessages.REGISTER_SUCCESS, result);
  });

  public static refreshToken = asyncHandler(async (req: Request, res: Response) => {
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

  public static logout = asyncHandler(async (req: Request, res: Response) => {
    if (req.user?.userId) {
      await AuthService.logout(req.user.userId);
    }

    res.clearCookie("refreshToken");
    return ApiResponse.ok(res, ResponseMessages.LOGOUT_SUCCESS);
  });

  public static getMe = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = { dbServer: req.user?.dbServer, dbName: req.user?.dbName };
    const user = await AuthService.getProfile(req.user!.userId, dbContext);
    return ApiResponse.ok(res, "Profil bilgisi başarıyla getirildi.", user);
  });

}
