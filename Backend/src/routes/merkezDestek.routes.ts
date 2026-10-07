import { NextFunction, Request, Response, Router } from "express";
import rateLimit from "express-rate-limit";
import { FirmaSqlRepository } from "../models/admin/firmaSql.repository.js";
import { validate } from "../middlewares/validate.middleware.js";
import { destekIdSchema, mesajYazSchema, talepAcSchema } from "../schemas/destek.schema.js";
import { kurulumuDogrula } from "../services/admin/merkezKurulum.service.js";
import { DestekService } from "../services/destek/destek.service.js";
import { DestekKimlik } from "../types/destek.types.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { istemciIp } from "../utils/istemci.utils.js";

/**
 * Merkezin kurulum (exe) programlarına açtığı destek uçları (K3, K21). Oturum yok; kimlik başlıklarda:
 * x-likya-firma + x-likya-anahtar (heartbeat gibi) ve x-likya-kullanici (base64 JSON {kullaniciAdi, adSoyad, yonetici}).
 * Okundu / arşiv exe'de yerel tutulduğundan burada yalnız liste, konu, talep, mesaj ve ek vardır.
 */
const router = Router();

// Exe'ler panel açıkken dakikada bir liste çeker; firma başına birkaç kullanıcı için heartbeat sınırından geniş
const destekSiniri = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 900,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => istemciIp(req as Request),
  handler: (req, res, next) => next(new ApiError(429, "Çok fazla istek. Lütfen daha sonra tekrar deneyiniz.")),
});
router.use(destekSiniri);

interface ExeIstek extends Request {
  destekKimlik?: DestekKimlik;
}

const kimlik = async (req: ExeIstek, _res: Response, next: NextFunction) => {
  try {
    const firma = await kurulumuDogrula(String(req.headers["x-likya-firma"] || ""), String(req.headers["x-likya-anahtar"] || ""));
    let k: { kullaniciAdi?: string; adSoyad?: string | null; yonetici?: boolean } = {};
    try {
      k = JSON.parse(Buffer.from(String(req.headers["x-likya-kullanici"] || ""), "base64").toString("utf8"));
    } catch {
      /* başlık yok ya da bozuk */
    }
    const kullaniciAdi = String(k.kullaniciAdi || "").trim().slice(0, 50);
    if (!kullaniciAdi) throw ApiError.badRequest("Kullanıcı bilgisi eksik.");
    const tam = await FirmaSqlRepository.idIleBul(firma.firmaId);
    req.destekKimlik = {
      firmaId: firma.firmaId,
      firmaKodu: firma.firmaKodu,
      firmaUnvan: tam?.unvan || firma.firmaKodu,
      kullaniciId: null,
      kullaniciAdi,
      adSoyad: k.adSoyad ? String(k.adSoyad).slice(0, 100) : null,
      yonetici: !!k.yonetici,
    };
    next();
  } catch (err) {
    next(err);
  }
};
router.use(kimlik);

router.get(
  "/konular",
  asyncHandler(async (req: ExeIstek, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    return ApiResponse.ok(res, "Konular.", { konular: await DestekService.kullaniciKonulari(req.destekKimlik!, "tumu") });
  })
);

router.get(
  "/konular/:id",
  validate(destekIdSchema),
  asyncHandler(async (req: ExeIstek, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    return ApiResponse.ok(res, "Konu.", await DestekService.kullaniciKonu(req.destekKimlik!, Number(req.params.id), false));
  })
);

router.post(
  "/talepler",
  validate(talepAcSchema),
  asyncHandler(async (req: ExeIstek, res: Response) => {
    return ApiResponse.created(res, "Talep oluşturuldu.", await DestekService.talepAc(req.destekKimlik!, req.body));
  })
);

router.post(
  "/konular/:id/mesajlar",
  validate(mesajYazSchema),
  asyncHandler(async (req: ExeIstek, res: Response) => {
    return ApiResponse.ok(res, "Mesaj gönderildi.", await DestekService.kullaniciMesaj(req.destekKimlik!, Number(req.params.id), req.body));
  })
);

router.get(
  "/ek/:id",
  validate(destekIdSchema),
  asyncHandler(async (req: ExeIstek, res: Response) => {
    const d = await DestekService.kullaniciEk(req.destekKimlik!, Number(req.params.id));
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.type(d.mime);
    res.sendFile(d.yol);
  })
);

export default router;
