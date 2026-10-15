import { Request, Response } from "express";
import { MenuSqlRepository } from "../models/menuSql.repository.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export class MenuController {
  private static getDbContext(req: Request) {
    return {
      dbServer:
        req.user?.dbServer ||
        (req.headers["x-db-server"] as string) ||
        (req.query.dbServer as string) ||
        (req.body?.dbServer as string),
      dbName:
        req.user?.dbName ||
        (req.headers["x-db-name"] as string) ||
        (req.query.dbName as string) ||
        (req.body?.dbName as string),
    };
  }

  private static getKullaniciId(req: Request) {
    const userObj = req.user as any;
    return Number(userObj?.userId || userObj?.id) || 1;
  }

  public static listMenus = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = MenuController.getDbContext(req);
    const aktifQuery = req.query.aktif;
    const aktifFiltre =
      aktifQuery !== undefined
        ? aktifQuery === "true" || aktifQuery === "1"
        : undefined;

    const menus = await MenuSqlRepository.listMenus(aktifFiltre, dbContext);
    return ApiResponse.ok(res, "Menüler listelendi.", menus);
  });

  public static saveMenu = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = MenuController.getDbContext(req);
    const kullaniciId = MenuController.getKullaniciId(req);
    const body = req.body;

    const saved = await MenuSqlRepository.saveMenu(
      {
        menuId: body.menuId ? Number(body.menuId) : null,
        menuKodu: body.menuKodu,
        menuAdi: body.menuAdi,
        aciklama: body.aciklama,
        siraNo: body.siraNo !== undefined ? Number(body.siraNo) : 0,
        aktif: body.aktif !== undefined ? Boolean(body.aktif) : true,
        kullaniciId,
      },
      dbContext
    );

    return ApiResponse.ok(res, "Menü başarıyla kaydedildi.", saved);
  });

  public static deleteMenu = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = MenuController.getDbContext(req);
    const menuId = Number(req.params.id);
    await MenuSqlRepository.deleteMenu(menuId, dbContext);
    return ApiResponse.ok(res, "Menü başarıyla silindi.", { success: true });
  });

  public static getKatalogUrunleri = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = MenuController.getDbContext(req);
    const rawMenuId = req.query.menuId;
    const parsedMenuId = rawMenuId ? Number(rawMenuId) : null;
    const menuId = parsedMenuId && !isNaN(parsedMenuId) && parsedMenuId > 0 ? parsedMenuId : null;
    const items = await MenuSqlRepository.getKatalogUrunleri(menuId, dbContext);
    return ApiResponse.ok(res, "Katalog ürünleri getirildi.", items);
  });
}
