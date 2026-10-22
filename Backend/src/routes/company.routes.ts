import { Router } from "express";
import { CompanyController } from "../controllers/company.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

// All company definition routes require authentication
router.use(authenticate);

router.get("/definitions", CompanyController.getDefinitions);
router.put("/definitions", CompanyController.updateDefinitions);
router.get("/alanlar", CompanyController.getAlanlar);
router.get("/klasor", CompanyController.getKlasor);
router.get("/klasor/liste", CompanyController.klasorListe);
router.get("/klasor/indir", CompanyController.klasorIndir);

export default router;
