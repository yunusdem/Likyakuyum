import { Router } from "express";
import { CompanyController } from "../controllers/company.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
const router = Router();
// All company definition routes require authentication
router.use(authenticate);
router.get("/definitions", CompanyController.getDefinitions);
router.put("/definitions", CompanyController.updateDefinitions);
export default router;
