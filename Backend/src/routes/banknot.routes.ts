import { Router } from "express";
import { BanknotController } from "../controllers/banknot.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

// Allow authenticated requests
router.use(authenticate);

router.get("/currencies", BanknotController.getCurrencies);
router.post("/create-currency", BanknotController.createCurrency);
router.get("/:paraId", BanknotController.getBanknotlarByParaId);
router.post("/:paraId", BanknotController.saveBanknotlar);
router.delete("/currency/:paraId", BanknotController.deleteCurrency);
router.delete("/:paraId", BanknotController.deleteBanknotlar);

export default router;
