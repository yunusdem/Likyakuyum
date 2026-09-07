import { Router } from "express";
import { ParaController } from "../controllers/para.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticate);

router.get("/", ParaController.listParalar);
router.post("/", ParaController.createPara);
router.get("/:id", ParaController.getParaById);
router.put("/:id", ParaController.updatePara);
router.delete("/:id", ParaController.deletePara);

export default router;
