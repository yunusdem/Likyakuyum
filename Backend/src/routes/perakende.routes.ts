import { Router } from "express";
import { PerakendeController } from "../controllers/perakende.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticate);

// Barcode Product Lookup
router.get("/urun/barkod/:barkod", PerakendeController.getProductByBarcode);
router.get("/barkod/:barkod", PerakendeController.getProductByBarcode);

// Next Invoice Number
router.get("/fatura-no/next", PerakendeController.getNextFaturaNo);
router.get("/next-no", PerakendeController.getNextFaturaNo);

// Invoices CRUD
router.post("/fatura", PerakendeController.createInvoice);
router.get("/fatura", PerakendeController.listInvoices);
router.get("/fatura/:id", PerakendeController.getInvoiceById);
router.delete("/fatura/:id", PerakendeController.deleteInvoice);

// Root fallbacks for convenient routing (e.g., /api/v1/perakende)
router.post("/", PerakendeController.createInvoice);
router.get("/", PerakendeController.listInvoices);
router.get("/:id", PerakendeController.getInvoiceById);
router.delete("/:id", PerakendeController.deleteInvoice);

export default router;
