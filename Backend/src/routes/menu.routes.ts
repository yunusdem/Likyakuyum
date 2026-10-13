import { Router } from "express";
import { MenuController } from "../controllers/menu.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

// TV ekranı için katalog ürünlerini getirme (oturum kontrolüyle veya development serbest)
router.get("/katalog-urunler", authenticate, MenuController.getKatalogUrunleri);

// Menü Yönetimi
router.get("/", authenticate, MenuController.listMenus);
router.post("/", authenticate, MenuController.saveMenu);
router.delete("/:id", authenticate, MenuController.deleteMenu);

export default router;
