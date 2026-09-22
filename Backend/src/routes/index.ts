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
import raporRoutes from "./rapor.routes.js";
import vezneTransferiRoutes from "./vezneTransferi.routes.js";
import vezneIzlemeRoutes from "./vezneIzleme.routes.js";
import sarrafFisRoutes from "./sarrafFis.routes.js";
import bankaRoutes from "./banka.routes.js";
import kasaRoutes from "./kasa.routes.js";
import etiketRoutes from "./etiket.routes.js";
import ayarRoutes from "./ayar.routes.js";
import perakendeRoutes from "./perakende.routes.js";
import adminRoutes from "./admin.routes.js";
import sayimRoutes from "./sayim.routes.js";
import iskontoRoutes from "./iskonto.routes.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { modulKapisi } from "../middlewares/modul.middleware.js";

const apiRouter = Router();

// Firma bazlı modül kısıtı: önek → kullanan modüller eşlemesi services/admin/modul.service.ts API_MODULLERI'nde.
// MERKEZ_GIRIS kapalıyken ve modül ayarı yapılmamış firmada hiçbir şeyi kısıtlamaz.
const kapi = (onek: string) => [authenticate, modulKapisi(onek)];

apiRouter.use("/health", healthRoutes);
apiRouter.use("/admin", adminRoutes);
apiRouter.use("/auth", authRoutes);
apiRouter.use("/users", userRoutes);
apiRouter.use("/company", companyRoutes);
apiRouter.use("/ayar", ayarRoutes);
apiRouter.use("/ayarlar-tanim", ayarRoutes);
apiRouter.use("/iskonto", iskontoRoutes);
apiRouter.use("/ayarlar/iskonto", iskontoRoutes);
apiRouter.use("/sayim", sayimRoutes);
apiRouter.use("/banka", kapi("/banka"), bankaRoutes);
apiRouter.use("/kasa", kapi("/kasa"), kasaRoutes);
apiRouter.use("/etiket", kapi("/etiket"), etiketRoutes);
apiRouter.use("/vezne/izleme", kapi("/vezne-izleme"), vezneIzlemeRoutes);
apiRouter.use("/vezne-izleme", kapi("/vezne-izleme"), vezneIzlemeRoutes);
apiRouter.use("/vezne", vezneRoutes);
apiRouter.use("/cash-desks", vezneRoutes);
apiRouter.use("/vezne-transferi", kapi("/vezne-transferi"), vezneTransferiRoutes);
apiRouter.use("/vezne/transfer", kapi("/vezne-transferi"), vezneTransferiRoutes);
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
apiRouter.use("/cari-hareket", kapi("/cari-hareket"), cariHareketRoutes);
apiRouter.use("/cari-hareketler", kapi("/cari-hareket"), cariHareketRoutes);
apiRouter.use("/cari-dekont", kapi("/cari-dekont"), cariDekontRoutes);
apiRouter.use("/cari/dekont", kapi("/cari-dekont"), cariDekontRoutes);
apiRouter.use("/doviz-fis", kapi("/doviz-fis"), dovizFisRoutes);
apiRouter.use("/vezne/doviz-fis", kapi("/doviz-fis"), dovizFisRoutes);
apiRouter.use("/tanimlar", tanimlarRoutes);
apiRouter.use("/kur", kurRoutes);
apiRouter.use("/pano", panoRoutes);
apiRouter.use("/kur/pano-tanimi", panoRoutes);
apiRouter.use("/banknot", banknotRoutes);
apiRouter.use("/banknotes", banknotRoutes);
apiRouter.use("/e-belge", kapi("/e-belge"), ebelgeRoutes);
apiRouter.use("/masak", kapi("/masak"), masakRoutes);
apiRouter.use("/belge", belgeRoutes);
apiRouter.use("/rapor", kapi("/rapor"), raporRoutes);
apiRouter.use("/sarraf-fis", kapi("/sarraf-fis"), sarrafFisRoutes);
apiRouter.use("/vezne/sarraf-fis", kapi("/sarraf-fis"), sarrafFisRoutes);
apiRouter.use("/perakende", kapi("/perakende"), perakendeRoutes);
apiRouter.use("/vezne/perakende", kapi("/perakende"), perakendeRoutes);

export default apiRouter;







