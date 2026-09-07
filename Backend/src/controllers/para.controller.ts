import { Request, Response } from "express";
import { ParaService } from "../services/para.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";

export class ParaController {
  private static getDbContext(req: Request) {
    return {
      dbServer: req.user?.dbServer || (req.query.dbServer as string) || (req.body.dbServer as string),
      dbName: req.user?.dbName || (req.query.dbName as string) || (req.body.dbName as string),
    };
  }

  /**
   * GET /api/v1/para
   */
  public static listParalar = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = ParaController.getDbContext(req);
    const paralar = await ParaService.listParalar(dbContext);
    return ApiResponse.ok(res, "Ürünler / Para birimleri başarıyla listelendi.", paralar);
  });

  /**
   * GET /api/v1/para/:id
   */
  public static getParaById = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = ParaController.getDbContext(req);
    const para = await ParaService.getParaById(req.params.id, dbContext);
    return ApiResponse.ok(res, "Ürün detayları getirildi.", para);
  });

  /**
   * POST /api/v1/para
   */
  public static createPara = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = ParaController.getDbContext(req);
    const created = await ParaService.createPara(req.body, dbContext);
    return ApiResponse.created(res, "Ürün / Para birimi başarıyla oluşturuldu.", created);
  });

  /**
   * PUT /api/v1/para/:id
   */
  public static updatePara = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = ParaController.getDbContext(req);
    const updated = await ParaService.updatePara(req.params.id, req.body, dbContext);
    return ApiResponse.ok(res, "Ürün bilgileri başarıyla güncellendi.", updated);
  });

  /**
   * DELETE /api/v1/para/:id
   */
  public static deletePara = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = ParaController.getDbContext(req);
    await ParaService.deletePara(req.params.id, dbContext);
    return ApiResponse.ok(res, "Ürün / Para birimi başarıyla silindi.", { id: req.params.id });
  });
}
