import express, { Router } from "express";
import { AktarimController } from "../controllers/admin/aktarim.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { aktarimFirmaSchema, aktarSchema, isSchema, kilitAcSchema, parcaSchema, yuklemeBaslatSchema, yuklemeSchema } from "../schemas/aktarim.schema.js";

/**
 * Eski programdan veri aktarımı — admin uçları (docs/VERITABANI_TASIMA_YOL_HARITASI.md).
 * admin.routes.ts oturum ve şifre denetiminden SONRA çağırır; testler aynı tanımları kendi yönlendiricisine ekler.
 */
export const aktarimRotalariniEkle = (router: Router): void => {
  // Yedek parça parça yüklenir (8 MB parça, X-Parca-Sha256 ile bütünlük)
  router.get("/firmalar/:id/aktarim/yuklemeler", validate(aktarimFirmaSchema), AktarimController.yuklemeler);
  router.post("/firmalar/:id/aktarim/yuklemeler", validate(yuklemeBaslatSchema), AktarimController.yuklemeBaslat);
  router.put(
    "/firmalar/:id/aktarim/yuklemeler/:yuklemeId/parca/:sira",
    express.raw({ type: "application/octet-stream", limit: "9mb" }),
    validate(parcaSchema),
    AktarimController.parca
  );
  router.post("/firmalar/:id/aktarim/yuklemeler/:yuklemeId/bitir", validate(yuklemeSchema), AktarimController.yuklemeBitir);
  router.delete("/firmalar/:id/aktarim/yuklemeler/:yuklemeId", validate(yuklemeSchema), AktarimController.yuklemeSil);
  // İnceleme / aktarım / doğrulama arka planda iş olarak çalışır; durum sorgulanır, sonuç raporda kalır
  router.post("/firmalar/:id/aktarim/yuklemeler/:yuklemeId/incele", validate(yuklemeSchema), AktarimController.incele);
  router.post("/firmalar/:id/aktarim/yuklemeler/:yuklemeId/aktar", validate(aktarSchema), AktarimController.aktar);
  router.post("/firmalar/:id/aktarim/yuklemeler/:yuklemeId/dogrula", validate(yuklemeSchema), AktarimController.dogrula);
  router.get("/firmalar/:id/aktarim/yuklemeler/:yuklemeId/rapor", validate(yuklemeSchema), AktarimController.rapor);
  router.get("/firmalar/:id/aktarim/isler/:isId", validate(isSchema), AktarimController.isDurumu);
  // Aktarım kilidi (§13): açıkken kullanım / e-belge kilitleri uygulanmaz, aktarım firmayı ilk hâline döndürüp yazar; eşlerle birlikte
  router.get("/firmalar/:id/aktarim/kilit", validate(aktarimFirmaSchema), AktarimController.kilitDurumu);
  router.post("/firmalar/:id/aktarim/kilit/ac", validate(kilitAcSchema), AktarimController.kilitAc);
  router.post("/firmalar/:id/aktarim/kilit/kapat", validate(aktarimFirmaSchema), AktarimController.kilitKapat);
};
