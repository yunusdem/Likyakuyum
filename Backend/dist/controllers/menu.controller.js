import { MenuSqlRepository } from "../models/menuSql.repository.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
export class MenuController {
    static getDbContext(req) {
        return {
            dbServer: req.user?.dbServer ||
                req.headers["x-db-server"] ||
                req.query.dbServer ||
                req.body?.dbServer,
            dbName: req.user?.dbName ||
                req.headers["x-db-name"] ||
                req.query.dbName ||
                req.body?.dbName,
        };
    }
    static getKullaniciId(req) {
        const userObj = req.user;
        return Number(userObj?.userId || userObj?.id) || 1;
    }
    static listMenus = asyncHandler(async (req, res) => {
        const dbContext = MenuController.getDbContext(req);
        const aktifQuery = req.query.aktif;
        const aktifFiltre = aktifQuery !== undefined
            ? aktifQuery === "true" || aktifQuery === "1"
            : undefined;
        const menus = await MenuSqlRepository.listMenus(aktifFiltre, dbContext);
        return ApiResponse.ok(res, "Menüler listelendi.", menus);
    });
    static saveMenu = asyncHandler(async (req, res) => {
        const dbContext = MenuController.getDbContext(req);
        const kullaniciId = MenuController.getKullaniciId(req);
        const body = req.body;
        const saved = await MenuSqlRepository.saveMenu({
            menuId: body.menuId ? Number(body.menuId) : null,
            menuKodu: body.menuKodu,
            menuAdi: body.menuAdi,
            aciklama: body.aciklama,
            siraNo: body.siraNo !== undefined ? Number(body.siraNo) : 0,
            aktif: body.aktif !== undefined ? Boolean(body.aktif) : true,
            kullaniciId,
        }, dbContext);
        return ApiResponse.ok(res, "Menü başarıyla kaydedildi.", saved);
    });
    static deleteMenu = asyncHandler(async (req, res) => {
        const dbContext = MenuController.getDbContext(req);
        const menuId = Number(req.params.id);
        await MenuSqlRepository.deleteMenu(menuId, dbContext);
        return ApiResponse.ok(res, "Menü başarıyla silindi.", { success: true });
    });
    static getKatalogUrunleri = asyncHandler(async (req, res) => {
        const dbContext = MenuController.getDbContext(req);
        const rawMenuId = req.query.menuId;
        const parsedMenuId = rawMenuId ? Number(rawMenuId) : null;
        const menuId = parsedMenuId && !isNaN(parsedMenuId) && parsedMenuId > 0 ? parsedMenuId : null;
        const items = await MenuSqlRepository.getKatalogUrunleri(menuId, dbContext);
        return ApiResponse.ok(res, "Katalog ürünleri getirildi.", items);
    });
}
