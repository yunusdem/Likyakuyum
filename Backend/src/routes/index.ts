import { Router } from "express";
import authRoutes from "./auth.routes.js";
import userRoutes from "./user.routes.js";
import companyRoutes from "./company.routes.js";
import vezneRoutes from "./vezne.routes.js";
import yaziciRoutes from "./yazici.routes.js";
import paraRoutes from "./para.routes.js";
import istatistikRoutes from "./istatistik.routes.js";
import numeratorRoutes from "./numerator.routes.js";
import cariRoutes from "./cari.routes.js";
import cariHareketRoutes from "./cariHareket.routes.js";
import healthRoutes from "./health.routes.js";
import kurRoutes from "./kur.routes.js";
import panoRoutes from "./pano.routes.js";
import banknotRoutes from "./banknot.routes.js";
import cariDekontRoutes from "./cariDekont.routes.js";
import ebelgeRoutes from "./ebelge.routes.js";
import dovizFisRoutes from "./dovizFis.routes.js";
import tanimlarRoutes from "./tanimlar.routes.js";
import masakRoutes from "./masak.routes.js";
import belgeRoutes from "./belge.routes.js";

const apiRouter = Router();

apiRouter.use("/health", healthRoutes);
apiRouter.use("/auth", authRoutes);
apiRouter.use("/users", userRoutes);
apiRouter.use("/company", companyRoutes);
apiRouter.use("/vezne", vezneRoutes);
apiRouter.use("/cash-desks", vezneRoutes);
apiRouter.use("/yazici", yaziciRoutes);
apiRouter.use("/printers", yaziciRoutes);
apiRouter.use("/para", paraRoutes);
apiRouter.use("/products", paraRoutes);
apiRouter.use("/istatistik", istatistikRoutes);
apiRouter.use("/statistics", istatistikRoutes);
apiRouter.use("/numerator", numeratorRoutes);
apiRouter.use("/numerators", numeratorRoutes);
apiRouter.use("/cari", cariRoutes);
apiRouter.use("/accounts", cariRoutes);
apiRouter.use("/cari-hareket", cariHareketRoutes);
apiRouter.use("/cari-hareketler", cariHareketRoutes);
apiRouter.use("/cari-dekont", cariDekontRoutes);
apiRouter.use("/cari/dekont", cariDekontRoutes);
apiRouter.use("/doviz-fis", dovizFisRoutes);
apiRouter.use("/vezne/doviz-fis", dovizFisRoutes);
apiRouter.use("/tanimlar", tanimlarRoutes);
apiRouter.use("/kur", kurRoutes);
apiRouter.use("/pano", panoRoutes);
apiRouter.use("/kur/pano-tanimi", panoRoutes);
apiRouter.use("/banknot", banknotRoutes);
apiRouter.use("/banknotes", banknotRoutes);
apiRouter.use("/e-belge", ebelgeRoutes);
apiRouter.use("/masak", masakRoutes);
apiRouter.use("/belge", belgeRoutes);

export default apiRouter;







